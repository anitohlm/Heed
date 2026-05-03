# Calendar Tab Redesign

## Goal

Replace the static demo calendar with a real, interactive calendar connected to actual task data. Features: two-tier layout (compact month strip + full week detail), swipeable month/week navigation, tap-to-detail sheet, drag-to-reschedule, and quick reschedule buttons.

## Background

The current `CalendarTab` is disconnected from the app's task state — it uses a hardcoded `buildSchedule()` function returning demo data. It has no swipe support, no task interaction, and no month navigation beyond week-by-week buttons. `CalendarTab` receives no props from `HeedApp`.

## Architecture

**Two files change:**
- `web/app/page.jsx` — all frontend changes (no new files)
- `functions/function_app.py` — add `next_due_at` to `allowed_fields` in `PATCH /tasks/{id}`

**Data flow:**
- `HeedApp` passes `apiTasks` (raw from API) to `CalendarTab`
- `CalendarTab` maps each task to its `next_due_at` date for placement
- Reschedule calls `PATCH /api/tasks/{task_id}` with `{ next_due_at: isoString }`

**New sub-components** (all defined inside `page.jsx`):
- `MonthStrip` — compact month grid with colored importance dots, swipeable
- `WeekDetail` — 7-column week view with colored task chips, swipeable
- `TaskDetailSheet` — bottom sheet: task info + quick reschedule + Mark Done / Skip

## Layout

```
┌─────────────────────────────┐
│  ‹  May 2026  ›             │  ← month header, swipe or tap arrows
│  M  T  W  T  F  S  S        │
│  28 29 30  1  2  3  4       │  ← week row (highlighted = selected week)
│           ●     ◆  ○        │  ← importance dots (rust/ochre/sage)
│  5  6  7  8  9  10 11       │
│     ●     ◆                 │
│  ...                        │
├─────────────────────────────┤  ← divider
│  Week of May 1–7            │
│  Mon Tue Wed Thu Fri Sat Sun │  ← 7-column week detail
│               1   2   3   4 │
│                  [Pay Mayn] │
│                  [Call Mom] │
│                         [ ] │
└─────────────────────────────┘
```

Tapping any week row in the month strip jumps the week detail to that week. Swiping the week detail left/right navigates weeks and syncs the month strip highlight.

## Components

### `MonthStrip({ tasks, monthOffset, selectedWeekStart, onWeekSelect, onMonthChange })`

- Renders a 7-column mini grid for the full month
- Each cell shows the date number and up to 3 colored dots (one per importance level present: rust for high, ochre for medium, sage for low) — max 3 dots total regardless of task count
- The week row containing `selectedWeekStart` is highlighted with a soft background pill
- `onWeekSelect(date)` — called when user taps a week row; passes the Monday of that week
- `onMonthChange(delta)` — called with +1 or -1 when user taps arrows or swipes the strip
- Swipe detection: `touchstart` / `touchend` on the strip container; swipe left = next month (+1), swipe right = prev month (-1); threshold 40px horizontal, less than 60px vertical

### `WeekDetail({ tasks, weekStart, onTaskTap, onTaskDrop })`

- Renders the 7-column week grid (Mon–Sun) with the existing day header style
- Task chips: filled pill, background = task importance color (`C.rust` / `C.ochre` / `C.sage`), cream text, truncated label
- Each chip has the importance icon (●/◆/○) as a prefix character
- Today column gets a soft `C.bellySoft` background tint
- **Swipe navigation:** `touchstart` / `touchend` on the grid container; left swipe = next week, right swipe = prev week; threshold 40px; calls `onWeekOffsetChange(delta)` passed from parent
- **Drag to reschedule:**
  - `pointerdown` on a chip starts a drag; `setPointerCapture` keeps events flowing
  - During drag: chip opacity drops to 0.4, a ghost `<div>` follows the pointer (chip clone, `position: fixed`, `pointer-events: none`)
  - Target column (under pointer) gets a `C.sageSoft` highlight
  - `pointerup` on a different column calls `onTaskDrop(task, newDate)`
  - Drop on the same column cancels with no API call
  - Ghost and highlight are cleaned up on `pointerup` or `pointercancel`

### `TaskDetailSheet({ task, onClose, onMarkDone, onSkip, onReschedule })`

- Fixed overlay: `position: fixed, inset: 0` with semi-transparent backdrop (`C.ink` at 40% opacity)
- Sheet slides up from bottom: `position: fixed, bottom: 0, left: 0, right: 0`; animated with `transform: translateY` transition (300ms ease-out)
- Drag handle bar at top (36×4px pill)
- Swipe-down to dismiss: `touchstart` / `touchmove` / `touchend` tracking; if downward drag > 80px, call `onClose`
- **Content:**
  - Task name (Lora serif, 18px)
  - Category badge + `ImportanceBadge` side by side
  - Two stat tiles: Cadence | Last done
  - **Reschedule row:** quick buttons — `Today`, `+1 day`, `+3 days`, `+1 week`, `Pick date…`
    - `Pick date…` opens a native `<input type="date">` via `ref.click()`
    - Each button calls `onReschedule(task.id, newDate)` then `onClose`
  - **Action row:** `✓ Mark Done` (sage filled) + `↷ Skip` (ghost)
- Backdrop click calls `onClose`

### Updated `CalendarTab({ tasks })`

Replaces the current implementation entirely. State:
- `monthOffset` (int, default 0) — months from current month
- `weekStart` (Date) — Monday of the currently displayed week (default = this week's Monday)
- `detailTask` (task | null) — which task's sheet is open

Derived:
- `monthTasks`: tasks with a `next_due_at` that falls within the displayed month
- `weekTasks`: tasks with a `next_due_at` that falls within `weekStart..weekStart+6`
- Tasks without `next_due_at` are not shown on the calendar

When week detail navigates to a week in a different month than the strip shows, update `monthOffset` to match.

Remove `buildSchedule`, `ROUTINE_TRACKS`, and `CalendarChip` (replaced by chip rendering inside `WeekDetail`).

Keep the existing legend (`<ImportanceBadge importance="low/medium/high"/>`) at the bottom.

## Backend Change

In `functions/function_app.py`, line ~221:

```python
# Before
allowed_fields = {"name", "description", "category", "importance",
                  "status", "explicit_cadence_days"}

# After
allowed_fields = {"name", "description", "category", "importance",
                  "status", "explicit_cadence_days", "next_due_at"}
```

This allows `PATCH /api/tasks/{task_id}` with `{ "next_due_at": "2026-05-10T00:00:00Z" }` to reschedule a task.

## Reschedule API Call

```js
async function rescheduleTask(taskId, newDate) {
  const iso = new Date(newDate).toISOString()
  await fetch(`${FUNCTIONS_URL}/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ next_due_at: iso }),
  })
}
```

After a successful reschedule, `CalendarTab` calls `onReschedule(taskId, newDate)` which is a prop passed from `HeedApp`. `HeedApp` handles the `PATCH` call and then re-fetches `/api/tasks` into `apiTasks` state, which flows back down to `CalendarTab` — no full page reload needed.

## What Does Not Change

- `ImportanceBadge` component — used as-is for the legend and chip colors
- `HeroCard`, `TaskCard`, `TodayTab` — unchanged
- Task data model — `next_due_at` already exists, no schema changes
- The existing Routines row in the calendar is removed (routines don't have `next_due_at`; they'll appear as a future enhancement)
