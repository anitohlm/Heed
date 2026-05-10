# Routine Month Log + Per-Item Tracking — Design

**Date:** 2026-05-10
**Status:** Design approved, ready for implementation plan

## Goal

Add two connected pieces to the Tracks → Routines surface:

1. **Per-item check-off on each routine.** Today, "doing the morning routine" is a single boolean per day for the whole routine. Replace that with per-item check-off so the user can record partial completion ("I did 3 of 4 this morning").
2. **A month-log detail screen for any routine.** Tap "See month log →" on a routine card; a new screen shows a calendar-month heatmap. Each cell's shade encodes that day's `done / total` fraction on a continuous scale — so a 7-item routine has 8 visible shade steps, a 4-item routine has 5, etc.

## Why now

The current routine UX gives all-or-nothing feedback. Users with longer routines (5–7 items) are penalized for finishing 6 of 7 — the day looks identical to a 0-of-7 day. The streak grid in the Calendar tab and the existing `completion14d` strip on the routine card both reflect this. The detail screen and the per-item upgrade together let users see partial wins as partial wins.

## Out of scope

- Backfilling past days (the screen is read-only — no tapping a past cell to mark done).
- Notes per item, notes per day.
- Animations beyond the standard fade-in on screen open.
- Updating the Calendar-tab streak grid to use graduated shading (it stays binary; can be revisited later).
- A separate "all routines at once" overview screen.

---

## Data model change

### Today

Each routine has `completion14d: bool[]` — 14-element array of booleans, indexed `0..13` where `13` is today. A `true` means "marked done that day." The value is sourced from `functions/function_app.py` (currently hardcoded seed data; see lines ~869, ~1266, ~1273).

### After this change

`completion14d` becomes `{ done: number, total: number }[]` of the same length and same indexing convention.

- `done` = number of items checked off that day.
- `total` = number of items in the routine **at the time of completion** (so historical days remember their original count even if the user later adds/removes items).
- The 14-day window length is unchanged for now. (Extending it is a separate follow-up.)

### Backward compatibility

Reads from older docs / older API responses must keep working. The read path normalises:

- A legacy `true` → `{ done: total, total: total }` where `total` = current `routine.items.length`.
- A legacy `false` → `{ done: 0, total: total }`.
- Anything else (null, undefined) → `{ done: 0, total: total }`.

Writes always use the new shape. No DB migration job; the conversion happens lazily on read.

### Existing call sites that touch `completion14d`

These all keep working because they reduce to the same boolean semantics:

- `computeStreakCount(arr)` — counts trailing days where the routine was fully done. New behaviour: count trailing days where `done === total`.
- `computeCompletionPct(arr)` — returns "% of days fully done" out of 14. New behaviour: same denominator, same numerator (count days where `done === total`).
- `routineDayState(routine, date, today)` (Calendar streak grid) — returns `'done' | 'missed' | 'future' | 'off'`. `'done'` becomes `done === total`; otherwise the same.
- The advisor's reasoning over routines (`agents/advisor.py:318+`) reads `completion14d[-1]`, `completion14d[-2]`, etc. The advisor's input shape is normalised in the same read path so it sees a boolean (`done === total`) — no agent prompt changes needed.

This keeps the surface area of the change small.

---

## Per-item check-off (Screen 1: existing RoutineCard)

The existing `RoutineCard` (in `web/app/page.jsx`, ~line 3685) gains an item checklist visible directly on the card.

### Layout

```
☕ Morning routine                    ⋯
[████████████░░░░░░░] 3 / 4 today
☑ Stretch (5 min)
☑ Vitamin D + B-complex
☑ Make coffee
☐ Quick journal
─────────────────────────────────
📊 See month log               ›
```

- Header: icon + name + ⋯ menu (unchanged from today).
- **New:** thin progress bar showing `done / total` for today, with the count.
- **New:** vertical list of items as checkboxes. Tap toggles done-for-today.
- **New:** "See month log →" footer row, tappable, opens Screen 2.

### Behaviour

- Tapping a checkbox writes the new state immediately (optimistic). The progress bar updates.
- The existing "Mark today done" button in the ⋯ menu is repurposed as **"Mark all done"** — single tap to bulk-check.
- Tapping "See month log →" navigates to Screen 2 (no backdrop; full-screen replace).

### Persistence

- Today's per-item state lives in the routine doc under `today_completion: { items_done: string[], total: number, date: 'YYYY-MM-DD' }`. When the day rolls over, the daily aggregator (existing 6-hour Memory Keeper run) reads this, appends `{ done: items_done.length, total }` to `completion14d`, then resets `today_completion` to `{ items_done: [], total: routine.items.length, date: '<new today>' }`.
- Frontend optimistically updates `today_completion` and re-renders the progress bar before the PATCH returns.
- API: extend the existing routines write path (whatever it is in `function_app.py`) to accept `{ today_completion: { ... } }`. No new endpoint.

---

## Month log screen (Screen 2: new)

A new full-screen view for one routine.

### Header

- `‹` back button (returns to Tracks → Routines).
- Routine icon + name + total item count: `☕ Morning routine · 7 items`.
- `⋯` menu with the same actions as the card (Lighten, Edit, Share card, Mark all done).

### Stats row (3 cards)

- **Avg this month** — mean items-done per *scheduled* day in the visible month: `sum(done) / sum(total over scheduled days)`.
- **Streak** — trailing consecutive days with `done === total` (full completion). Across months, not just visible.
- **Best run** — longest such streak in the persisted window.

### Month navigation

`‹  May 2026  ›` row. Arrows flip the visible month. Forward beyond the current month is disabled (no future months). Backward is enabled but cells beyond the persisted window render as "no data."

### Calendar grid

- Standard 7-column Mon→Sun layout. 5 or 6 rows per month.
- Each cell is a square showing the day number plus the `done/total` fraction underneath (e.g. `13 \n 4/7`).
- Today gets the inset 1.5px rust border on top of its shade.

### Cell shade — continuous scale

Per-cell state is computed in this order:

1. If date is **off-day** for the routine's schedule → off-day style (`C.bellySoft` at 0.55 opacity, dim text).
2. Else if date is **future** → future style (`C.bellySoft`, dim text).
3. Else if no record exists for this day (older than persisted window) → no-data style (transparent, dashed border, dim text).
4. Else compute `frac = day.done / day.total`:
   - `frac === 0` → missed (`C.border` background, ink text).
   - `frac === 1` → done (`C.sage` background, cream text).
   - Otherwise → graduated shade between beige and sage.

### Shading formula

```
shade = mix(C.border, C.sage, frac)
text  = frac >= 0.5 ? C.cream : C.ink
```

`mix` is a normal RGB linear mix. We don't pre-bucket; the formula gives every routine its own scale automatically (1-item routine has 2 visible shades, 7-item has 8, etc.).

### Tap a cell

A small tooltip / bottom sheet appears with:

- The full date (`Wed May 13, 2026`).
- The fraction (`4 / 7 done`).
- The names of completed items (`Stretch, Vitamin D, Make coffee, Quick journal`).

Read-only. No backfill. Tapping outside dismisses.

### Legend

A small row at the bottom:

```
0/N  [□][▪][▪▪][▪▪▪][▪▪▪▪]…[■]  N/N    □ Off-day   □ Future   ⌐ No data
```

The gradient strip stretches to the routine's `total` (one square per step).

### Footer actions

`🪶 Lighten this week` and `✓ Mark all done` — same as the RoutineCard menu.

---

## Data flow

### Routine card (Screen 1)

- Reads `routine.today_completion` (new field) for today's checkbox state.
- On checkbox toggle: optimistic local update + PATCH `routines` with the new `today_completion`.
- Reads `routine.completion14d` (new shape) for the progress bar's history (used elsewhere; not visible on the card itself).

### Month log screen (Screen 2)

- Reads `routine.completion14d` for days inside the 14-day window.
- For days outside the window: render no-data. Phase 5 (optional follow-up) extends this with a `/api/completions?from=&to=` fetch scoped to the routine.
- All computation client-side; no new endpoints required for Phases 1–4.

---

## Phasing — single plan, ordered tasks

| Task | What | Why now |
|---|---|---|
| **A** | Data shape: `completion14d → {done, total}[]`; `routine.items: string[] → {id, label}[]` with lazy migration (`id = label` seed); back-compat in read path for both shapes; update all 4 call sites (`computeStreakCount`, `computeCompletionPct`, `routineDayState`, advisor input). | Everything else depends on the new shapes. |
| **B** | Per-item check-off on RoutineCard. New `today_completion` field. PATCH routines on toggle. "Mark all done" replaces "Mark today done" in the ⋯ menu. | Generates the data the heatmap will read. |
| **C** | Daily roll-over: when the user opens the app on a new day, the frontend reads `today_completion.date`; if it's yesterday, it appends `{done: items_done.length, total}` to `completion14d` and resets `today_completion`. (Backend Memory Keeper does the same in its 6-hour run for safety.) | Without this, `completion14d` never gains new entries. |
| **D** | Month log screen — calendar grid, continuous shade, month nav arrows, tap-cell tooltip, stats. | The screen the user asked for. |
| **E** | Wire "See month log →" on RoutineCard. | Navigation entry point. |

### Out of plan (separate follow-up)

- Extending `completion14d` beyond 14 days (so older months populate). Needs backend persistence work; can ship as `routine_history` enhancements once Phase D is in users' hands and we know what they actually scroll back to look at.

---

## Theme support

Heed has six themes (`parchment-light`, `midnight-fern`, `inkwash`, `flamingo`, `candy`, `periwinkle`, defined in `web/app/themes.js`). Every color used by this feature must be a theme token — never hardcoded hex.

- **Cell shade endpoints** — `C.border` (beige in light themes, deep desaturated in dark themes) and `C.sage` (the routine accent across every theme).
- **Cell shade formula** — `mix(C.border, C.sage, frac)` is computed at render time in JS using `tinycolor` or a 4-line linear-RGB blend (no new dep needed). Output is the theme-correct intermediate. **Do not pre-compute a fixed 8-step palette** — the gradient is a function of the active theme.
- **Cell text color** — `frac >= 0.5 ? C.cream : C.ink`. Both are theme tokens; no overrides.
- **Off-day / future / no-data** — `C.bellySoft` for filled, transparent + dashed `C.border` for no-data. All theme-aware.
- **Today indicator** — inset 1.5px `C.warmDark` border. Theme-aware (matches the existing today indicator on the Calendar tab streak grid).

### Dark-theme gotcha to verify during implementation

In `midnight-fern` and `inkwash`, `C.border` and `C.sage` are both dark and may sit close in luminance — the gradient could read as flat. The implementation task includes a manual sweep across all six themes; if the dark-theme gradient looks compressed, the fix is to use `C.sageSoft` (the lighter sage tint) as the upper endpoint in those themes only, behind a `prefers-color-scheme`-style guard inside the same color helper. Document the decision once verified.

---

## Risks / open questions

- **Item count changes over time.** If the user adds an 8th item to a 7-item routine, today's `total` jumps to 8 mid-day. Decision: `today_completion.total` is set at midnight (or on first read of the day) and stays put. Adding an item doesn't retroactively un-complete the day; the `total` updates the next day. Documented in the daily-rollover task.
- **Item identity vs name.** `routine.items: string[]` (today) → if we want to track per-item completion across days, we need stable IDs. Decision: items get auto-generated IDs (`{ id: string, label: string }`) when this change lands. Old data (`string[]`) is migrated lazily with `id = label` as the seed.
- **The advisor's reasoning.** The advisor reads the per-day boolean ("done today / done yesterday"). The read-path normalisation feeds it `done === total` so the agent's behaviour is unchanged unless we want partial-day awareness in prompts. We don't, for now — keep the agent stable.
- **One-item routines.** Edge case: a routine with a single item collapses to the old binary behaviour. That's fine; the heatmap shows two states (missed or done).
- **Empty routine (zero items).** Shouldn't be possible via the UI but defend in code: treat as off-day everywhere.
