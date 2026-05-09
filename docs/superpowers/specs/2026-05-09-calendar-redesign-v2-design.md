# Calendar Redesign v2 — Streak Routines + Inline Detail

**Date:** 2026-05-09
**Status:** Design approved, ready for implementation plan

## Goal

Replace the calendar tab's current overlay-sheet detail and gradient routine bars with:

1. A **streak grid** for routines that shows done/missed/future at a glance
2. **Inline expansion** for task detail — no more position-fixed bottom sheet getting clipped by the tab bar or covering half the week

Three problems being solved:
- `TaskDetailSheet` is `position:fixed; bottom:0` and overlaps the tab bar (~70px), so its bottom buttons (Mark Done / Skip) and the "Reschedule to" row sit underneath the nav. Users can't reach them on small viewports.
- The detail sheet covers half the week — when open, the user loses context for the very thing they're rescheduling.
- The current routine bars (`web/app/page.jsx:8385-8392`) render as solid/faded gradient strips per weekday; they communicate "this routine fires on these weekdays" but not "did I actually do it." Users describe them as unreadable.

## Out of scope

- Month grid (`MonthStrip`) layout — unchanged.
- Retrospective sheet — unchanged.
- Drag-to-reschedule — already removed in current code; not adding back.
- Backend / API changes — none needed; uses existing `PATCH /tasks/{id}` and routine endpoints.

## Layout (top to bottom, inside the calendar card)

1. **Month header** — `‹ May 2026 ›` with the existing 📊 retro pill kept where it is. Unchanged.
2. **Month strip** (mini grid with importance dots). Unchanged.
3. **Hairline divider.** Unchanged.
4. **Routines streak block** — replaces the current `routines.length > 0` block in `WeekDetail`. See **Routines section** below.
5. **"Week of …" label.** Unchanged.
6. **Day rows** — one row per day, restructured. See **Day rows** below.
7. **Inline detail card** — appears below the row of the tapped task. See **Inline detail** below.

The bottom **Legend card** (`page.jsx:8666-8673`) is removed — importance is already obvious from the chip color and the icon prefix (●/◆/○).

## Routines section (replaces gradient bars)

For each routine in `props.routines`, render one row:

```
☕ Morning      [M][T][W][T][F][S][S]
🌙 Wind-down   [M][T][W][T][F][S][S]
```

The 7 boxes correspond to the **currently visible week** (`weekStart` … `weekStart + 6`), Mon→Sun.

**Box state, in order of priority:**

| State | Background | Text color | When |
|---|---|---|---|
| Done | `C.sage` | `C.cream` | The routine fired on that day in the visible week (see data source below). |
| Missed | `C.border` (beige) | `C.inkMute` | Date is in the past **and** the routine was scheduled (per `routineDays`) **and** not done. |
| Future | `C.bellySoft` | `C.inkMute` (dim) | Date is today or later **and** the routine is scheduled. |
| Off-day | `C.bellySoft` with 0.4 opacity | `C.inkMute` (dim) | Routine is not scheduled this weekday at all (e.g., weekend-only routine on a weekday). |
| Today indicator | Inset 1.5px `C.warmDark` border on top of the above background. |  | Whichever box is today. |

Each box shows the single weekday letter (M/T/W/T/F/S/S) so the row stays meaningful when scrolled or backed up.

**Data source for "done":**
- The current frontend has `routine.completion14d` (14-element bool array, `0 = oldest, 13 = today`).
- Map each visible-week day to its index in `completion14d`:
  - `idx = 13 - daysFromToday` where `daysFromToday = floor((today - date) / 86400000)`.
  - If `idx < 0` (future) → not done; classify as Future / Off-day.
  - If `idx > 13` or `idx >= completion14d.length` (more than 14 days back) → fall back to "missed if scheduled, off-day otherwise."
- Tap the row → fires existing `onEditRoutine(routine)`. Same as today.

**Visual:**
- Container: `C.paper` background, 1px `C.border`, 10px radius, 8px/10px padding.
- Layout: `display: grid; grid-template-columns: 110px 1fr; gap: 8px` per line.
- Box: `aspect-ratio: 1/1` so the row scales with width; min size ~16×16, max ~22×22; 4px radius; 3px gap between boxes.
- Routine name: 110px fixed, 11px font, semibold, ellipsis on overflow.

## Day rows (compressed)

One row per day, replacing the current Mon–Sun mapping in `WeekDetail`:

```
[Mon  11]   + Add task
[Tue  12]   ● Take vitamins
[Wed  13]   📅 Travel    ◆ Water plants
[Thu  14]   + Add task
…
```

**Layout:**
- Row container: `display: flex; gap: 8px; padding: 7px 8px; border-radius: 8px; min-height: 30px`.
- Today's row: background `C.bellySoft` (replaces today's `bellySoft + '80'`).
- Date label (left, 34px wide): weekday three-letter uppercase (`C.inkMute`, 8px, 700) above the day number (Lora 13px 600). On today, the day number renders inside a 20×20 `C.warmDark` circle with `C.cream` text.
- Right: wraps task chips and context chips, gap 4px.

**Routine chips do NOT render in day rows** — that information is already in the streak grid above. This is the change that makes rows scannable.

**Empty-state behavior:**
- If the row has zero tasks AND zero contexts → show a single `+ Add task` dashed pill.
- If the row has at least one chip → no add stub.
- The current `+ Add context` per-row stub is **removed**. Adding a context moves to the existing FAB / context-modal flow (`onAddContext` is still called by the FAB elsewhere — `WeekDetail` no longer calls it).

`onAddContext` prop is removed from `WeekDetail`. `CalendarTab` keeps it for now (still passed to FAB), but stops forwarding it to `WeekDetail`.

## Inline detail (replaces TaskDetailSheet)

When a task chip is tapped, a detail card appears **directly below the day row containing that task**, pushing later rows down. No backdrop, no swipe-to-dismiss, no fixed positioning.

**Mechanics:**
- `WeekDetail` owns `expandedTaskId` state. Tapping a chip sets the id; tapping the same chip again clears it; tapping a different chip swaps. Tapping outside any chip *or* card clears it (document-level pointerdown handler scoped to the card region).
- Only one card open at a time.
- The card renders inside the same flex column as the day rows, immediately after the row whose date matches the task's `next_due_at`.
- If the task is rescheduled and the new date is in a different visible day, the card stays attached to the original row until the user closes it; closing happens automatically after `onReschedule`, `onMarkDone`, or `onSkip` resolves (same as the old sheet).

**Card content** (mirrors the old sheet, reflowed for inline):
- Header row: task name (Lora 14, 700) + Due chip on the right (`Due` label + date in `C.rust`).
- Badge row: `ImportanceBadge` + `category` chip if present.
- Stats grid (2 columns): Cadence + Last done. Same `bellySoft` cards as today.
- "Reschedule to" label + quick-date pills: Today, +1 day, +3 days, +1 week, 📅 Pick (uses the existing hidden `<input type="date">` ref pattern).
- Action row: ✓ Mark done (sage solid) + ↷ Skip (cream outlined).

**Visual:**
- Card container: 1px `C.border`, 10px radius, 12px padding, background `C.paperHi` (token already defined in `web/app/themes.js`), `boxShadow: 0 2px 8px rgba(124,83,51,0.06)`.
- Margin: 4px top, 4px bottom; left/right margin 8px so it indents slightly from the day rows.

## Effects (animations + micro-interactions)

Keep these subtle and scoped — they should reinforce the change-of-state, not be decorative.

1. **Inline-detail expand/collapse**
   - On open: card animates from `max-height: 0; opacity: 0; transform: translateY(-4px)` to its natural height + `opacity: 1; translateY(0)` over **220ms `cubic-bezier(0.22, 1, 0.36, 1)`** (ease-out-quint).
   - On close: reverse, **160ms ease-in**.
   - Implementation: render the card always when `expandedTaskId === task.id`; use a CSS class with the open/closed transition. Avoid measuring scroll height — instead use `grid-template-rows: 0fr / 1fr` trick (modern browsers) or a fixed-ish max-height (e.g. `max-height: 600px` on open, `0` on close) for simplicity.

2. **Task chip tap feedback**
   - On `pointerdown`: `transform: scale(0.96)` + `transition: transform 80ms ease-out`. Releases on `pointerup` / `pointercancel`.
   - When chip is the currently-expanded one: persistent 1.5px inset border in `C.warmDark` so the user knows which chip the card belongs to.

3. **Streak-grid box hover/tap**
   - On `pointerdown` (only on the routine row, not per-box): `transform: scale(0.99)`.
   - No per-box interaction (boxes are display-only; the row is the tap target — same as today).

4. **Mark-done button**
   - Click triggers a brief check-pulse: button scales `1 → 1.04 → 1` over 220ms while the existing `onMarkDone` flow runs. The card closes ~120ms into the pulse so the user sees the feedback before the row reflows.

5. **"+ Add task" stub**
   - Default opacity 0.55, `transition: opacity 140ms`. Hover/focus → opacity 1.
   - On row tap (anywhere on the row, not the stub specifically): treat as task add only when the row has zero chips. (Match current behavior — already calls `onAddTask(date)`.)

6. **Today's date pill (in day row)**
   - Subtle glow on first mount only: `box-shadow: 0 0 0 0 C.warmDark` → `0 0 0 4px transparent` over 600ms, once. Disabled if `prefers-reduced-motion`.

7. **Reduced-motion**
   - All transitions wrapped in `@media (prefers-reduced-motion: reduce)` → set durations to 0 and remove transforms. The expand becomes an instant toggle; chip press has no scale.

## File / change map

| File | Change |
|---|---|
| `web/app/page.jsx:7919-8455` (`WeekDetail`, helpers) | Replace routines block with streak grid; remove per-row routine chips; remove `+ Add context` stub; add `expandedTaskId` state + inline detail rendering; remove `onAddContext` prop forwarding from `WeekDetail` (CalendarTab keeps it for FAB). |
| `web/app/page.jsx:8457-8574` (`TaskDetailSheet`) | **Delete** the component entirely. |
| `web/app/page.jsx:8576-8688` (`CalendarTab`) | Remove `detailTask` state and the `<TaskDetailSheet … />` render; rename `onTaskTap` plumbing so `WeekDetail` handles its own expansion; remove the bottom Legend card; pass `onReschedule`, `onMarkDone`, `onSkip` directly into `WeekDetail`. |
| `web/app/page.jsx` (CSS / styles) | Add a small block of keyframes / classes for the expand and chip-press transitions (or inline styles using the same pattern as today). |

No backend changes. No new dependencies.

## Testing

Manual checks (the test plan at `docs/qa/today-tab-test-cases.md` style):

1. Open Calendar tab on a small viewport (mobile width). Tap a task → detail expands inline; **all** action buttons (Mark done, Skip) are visible without scrolling past the tab bar.
2. Tap the same chip again → card collapses smoothly.
3. Tap a different chip → first card collapses, new card opens under the new row.
4. Tap outside any chip/card → card closes.
5. Routine streak: today's box has the inset border. A routine done yesterday shows a sage box with "T". A scheduled missed day shows beige. A future day shows pale.
6. Routine with `weekend` schedule: weekday boxes use the dim off-day style; Sat/Sun follow done/miss/future logic.
7. With 0 routines: the routines block does not render.
8. Reschedule from inline card: the card closes, the chip moves to the new day, the streak grid updates if `onReschedule` triggers a refetch.
9. Mark done: button pulses, card closes ~120ms in, chip disappears (or is greyed) per existing `handleMarkDone` behavior.
10. `prefers-reduced-motion: reduce` (Chrome devtools): expand is instant; no scale animations on chip press.
11. Demo mode: still functions (no API call leak).
12. Multiple tasks on the same day: tapping one expands its card under the row; tapping another swaps the chip's selected outline and the card content (single card position; content updates).

## Risks / open questions

- **Outside-tap close handler:** must not fire when tapping a chip in another row (would cause a flicker). Solution: handle the swap inside the chip click (set new id) and only treat document-level pointerdown as "close" when the target is not inside any chip or card.
- **Card position when the task's row scrolls offscreen:** the card flows with the row, so it scrolls naturally. Good — no special handling.
- **`completion14d` length:** the design assumes 14 entries. If the data is empty or shorter, the streak grid degrades to all-future / all-off-day boxes, which is acceptable.
- **`+ Add context` removal:** users who relied on the per-row context stub may need a hint. The FAB already has "Add context" so the path exists; no in-product onboarding planned.
