# Context Detail Sheets Design

**Goal:** Let users tap any context row to see a rich detail sheet — what tasks were held, what's coming up, how to plan around it.

**Architecture:** All UI in `web/app/page.jsx`. A single new `ContextDetailSheet` component handles upcoming, active, and past contexts by branching on `ctx._status`. Two new state vars in `HeedApp`: `detailCtx` and `detailOpen`. Mock data fields added to `CONTEXTS_UPCOMING` and `CONTEXTS_PAST` entries. No new API or routing needed.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern)

---

## 1. Row chips (summary inline on every context row)

All context rows show summary chips — small pill badges below the title/date line. Chips show the most relevant stats at a glance.

**Upcoming rows:** chips rendered from the context's mock data:
- `"📋 N tasks before you go"` if `ctx.tasksBefore.length > 0`
- `"⏸ N routines paused"` if `ctx.routinesPaused > 0`

**Active context card:** existing chip-like elements in `ActiveContextCard` already communicate held tasks and days remaining — no new chips needed.

**Past rows:** already partially implemented — shows `"N tasks skipped"` in rust if `ctx.skipped != null`. No change needed.

All rows gain `cursor: pointer` and `onClick` → `onDetailOpen(ctx)`.

---

## 2. Detail sheet — structure

A bottom sheet that slides up when any context row is tapped. Uses the same pattern as existing sheets: `position: fixed`, backdrop overlay, `heed-slideUp` animation, `env(safe-area-inset-bottom)` padding, `zIndex: 200`.

Header: always shows icon circle + title (Lora serif, 16px bold) + date range + relative label ("in 4 weeks" / "Day 2 of 5" / "5 days ago"). Drag handle at top.

Body: varies by context status — see sections below.

Dismiss: tap backdrop or a future swipe-down gesture.

---

## 3. Detail sheet — upcoming contexts

Sections stacked vertically with 10px gap, each in a `#fdf8ee` card with `#e8dfd4` border:

**"Before you go"** — bullet list of `ctx.tasksBefore` items (up to 5). Label in uppercase muted style.

**"While away"** and **"Coming back"** — rendered side by side (two equal-width cards). "While away" shows `ctx.whileAway` (e.g. "Morning & evening routines paused"). "Coming back" shows `ctx.comingBack` (e.g. "Soft-start Jun 10 — essentials only").

**CTA button** at bottom: "Ask Heed to plan around this" — full-width, primary style (`C.warmDark` background, `C.paper` text). For now this is a no-op (future: opens chat tab pre-filled).

---

## 4. Detail sheet — active contexts

Shows the same header (icon + title + date range + "Day X of Y").

Body: a single section card listing held tasks — up to 3 items each showing `task.label`. If more than 3, shows "+ N more tasks" in muted style.

Below the list: the same two action buttons from `ActiveContextCard`:
- **"I'm better now"** (sage primary) → calls existing `onImBetter`
- **"Extend 2 days"** (ghost) → calls existing `onExtend`

This means `ActiveContextCard` also gets `onClick → onDetailOpen(ctx, 'active')`, and the sheet duplicates the card's actions for convenience. The card itself stays — the sheet is additional detail, not a replacement.

---

## 5. Detail sheet — past contexts

Header shows icon + title + date range + duration (e.g. "5 days").

Body: a single section card.

- Intro line: `"Heed held back N tasks during this period:"` (if `ctx.skipped > 0`)
- Task list: up to 3 rows from `ctx.heldTasks` array. Each row: task label (left) + overdue delta (right, rust bold, e.g. "+5d overdue") or `"paused"` in muted style if not overdue.
- If more than 3: `"+ N more tasks"` row in muted, right side shows `"held"` in sage.

If `ctx.skipped === 0` or no `heldTasks`: shows `"No tasks were held during this period."` in muted style.

No action buttons on past sheets.

---

## 6. Mock data additions

`CONTEXTS_UPCOMING` entries get new fields:
```js
{
  tasksBefore: ['Pay Maynilad & Meralco', 'Submit timesheet (Friday)', 'Refill water dispenser'],
  routinesPaused: 2,
  whileAway: 'Morning & evening routines paused',
  comingBack: 'Soft-start Jun 10 — essentials only',
}
```

`CONTEXTS_PAST` entries get new fields:
```js
{
  heldTasks: [
    { label: 'Pay Meralco bill', overdueDays: 5 },
    { label: 'Call Mom', overdueDays: 5 },
    { label: 'Morning routine', overdueDays: 0 },
  ],
}
```

`overdueDays: 0` means the task was paused (not overdue), rendered as `"paused"` in muted style. Positive values render as `"+Nd overdue"` in rust.

---

## 7. New state in HeedApp

```js
const [detailCtx, setDetailCtx] = useState(null)   // context object being shown
const [detailOpen, setDetailOpen] = useState(false)
```

Handler: `handleDetailOpen(ctx, status)` — enriches `ctx` with a `_status: 'upcoming' | 'active' | 'past'` field, sets `detailCtx`, sets `detailOpen = true`. Using a prefixed field avoids conflicts with any future API `status` field.  
Dismiss: `handleDetailClose()` — sets `detailOpen = false` (keep `detailCtx` until close animation ends, same as existing sheet pattern).

---

## 8. Components to add / modify

| Component | Change |
|---|---|
| `ContextDetailSheet` | New — single sheet branching on `ctx.status` |
| `ContextRow` | Add chips row, `cursor: pointer`, `onClick` |
| `ActiveContextCard` | Add `onClick` → `onDetailOpen(ctx)` |
| `ContextTab` | Pass `onDetailOpen` down; add `ContextDetailSheet` to render |
| `HeedApp` | Add `detailCtx`, `detailOpen`, `handleDetailOpen`, `handleDetailClose` |
| `CONTEXTS_UPCOMING` | Add `tasksBefore`, `routinesPaused`, `whileAway`, `comingBack` fields |
| `CONTEXTS_PAST` | Add `heldTasks: [{label, overdueDays}]` fields |

---

## 9. What doesn't change

- `QuickContextSheet`, `RecoverySummarySheet` — unchanged
- Bottom navigation, tabs, other sections — unchanged
- `AddContextModal` — unchanged
- Overall Context tab layout — unchanged; chips and tappability are additive
