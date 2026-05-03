# Interactive Plan Checklist Design

**Goal:** Make plan task lists checkable, editable, reorderable, and persistent — accessible via a dedicated detail screen within the Plans tab.

**Architecture:** `PlansPanel` gains a `selectedPlanId` state to navigate between the card list and a `PlanDetailScreen`. A `usePlans` hook replaces the existing `useState(DEMO_PLANS)` and handles localStorage persistence. All mutations (check, rename, add, delete, reorder) flow through the hook. Drag-to-reorder uses native pointer events — no new library dependency.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern), native Pointer Events API for drag

---

## 1. Navigation model

`PlansPanel` has two views controlled by `selectedPlanId` (string | null):

- **null** → renders the existing plan cards grid (`PlansGrid`)
- **set** → renders `PlanDetailScreen` for that plan

Tapping a plan card calls `setSelectedPlanId(plan.id)`. The "‹ Plans" back button in `PlanDetailScreen` calls `setSelectedPlanId(null)`. No animation required — a clean swap is fine.

Plan cards no longer show any task list or preview. They show: icon, title, type + date, and a progress bar with a `done / total` fraction.

---

## 2. `usePlans` hook

Replaces `useState(DEMO_PLANS)` in `PlansPanel`.

```js
function usePlans(initialPlans) {
  const [plans, setPlans] = useState(() => {
    try {
      const saved = localStorage.getItem('heed_plans')
      return saved ? JSON.parse(saved) : initialPlans
    } catch {
      return initialPlans
    }
  })

  useEffect(() => {
    localStorage.setItem('heed_plans', JSON.stringify(plans))
  }, [plans])

  function checkTask(planId, taskIndex) { ... }
  function renameTask(planId, taskIndex, newLabel) { ... }
  function addTask(planId, label) { ... }
  function deleteTask(planId, taskIndex) { ... }
  function reorderTasks(planId, fromIndex, toIndex) { ... }

  return { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks }
}
```

Each mutation uses `setPlans(prev => prev.map(...))` — immutable update, no direct mutation.

localStorage key: `heed_plans`. Stored as the full plans array JSON.

---

## 3. `PlanDetailScreen` component

Props: `plan`, `onBack`, `onCheck`, `onRename`, `onAddTask`, `onDeleteTask`, `onReorder`

**Layout (top to bottom):**
1. **Top bar** — "‹ Plans" back button (left), plan icon + title (centre)
2. **Progress bar row** — `done / total done` fraction on the right
3. **Task list** — all tasks (done + undone), each row described below
4. **Add task row** — `+` icon + text input at the bottom of the list

**Task row anatomy (left to right):**
- `≡` drag handle — `color: C.border`, `cursor: grab`; initiates drag on `pointerdown`
- Checkbox — 15×15px, `border-radius: 4px`; tapping toggles `done` via `onCheck`
- Task label — `flex: 1`; if `done`, `text-decoration: line-through`, `color: C.inkMute`
- `✎` pencil icon — `color: C.border`; tapping sets `editingIndex` to this row

**Editing state** (when `editingIndex === i`):
- Label replaced by `<input>` with current value, `border-bottom: 1.5px solid C.accent`, no border elsewhere
- `onBlur` or `Enter` saves via `onRename` and clears `editingIndex`
- `Escape` cancels (clears `editingIndex` without saving)

**Swipe-to-delete:**
- Track `pointerdown` → `pointermove` on each row; if horizontal delta > 60px leftward, reveal a red `Delete` button (68px wide) by translating the row content left
- Tapping `Delete` calls `onDeleteTask`
- Swiping back (rightward) or tapping elsewhere cancels the swipe

**Done tasks** are shown at the top of the list (checked, struck-through, muted). Undone tasks follow. Order within each group respects the stored `tasks` array order — drag reorder applies to the full array.

**Add task row:**
- `+` icon in `C.accent` colour
- `<input placeholder="Add a task…">` — `Enter` or blur-with-content calls `onAddTask(plan.id, label)` and clears the input

---

## 4. Drag-to-reorder

Native pointer events, no library.

State in `PlanDetailScreen`:
- `dragIndex` (number | null) — which task is being dragged
- `dropIndex` (number | null) — current insertion point

On `pointerdown` of a `≡` handle:
- Set `dragIndex`; call `el.setPointerCapture(e.pointerId)`

On `pointermove`:
- Calculate which row the pointer is over (by comparing `clientY` against row bounding rects)
- Update `dropIndex`

On `pointerup`:
- If `dragIndex !== dropIndex`, call `onReorder(plan.id, dragIndex, dropIndex)`
- Reset both to null

**Visual feedback while dragging:**
- Dragged row: `box-shadow: 0 3px 10px rgba(0,0,0,.12)`, slight `background: #fffaef`, `borderRadius: 6px`, `margin: 2px 8px`
- Drop target: 2px `C.accent` line between rows indicating insertion point

---

## 5. `PlansPanel` changes

```js
function PlansPanel({ ... }) {
  const { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks } = usePlans(DEMO_PLANS)
  const [selectedPlanId, setSelectedPlanId] = useState(null)

  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null

  if (selectedPlan) {
    return <PlanDetailScreen
      plan={selectedPlan}
      onBack={() => setSelectedPlanId(null)}
      onCheck={checkTask}
      onRename={renameTask}
      onAddTask={addTask}
      onDeleteTask={deleteTask}
      onReorder={reorderTasks}
    />
  }

  return <PlansGrid plans={plans} onSelectPlan={setSelectedPlanId} onAdd={...} />
}
```

The existing plan card grid rendering moves into a `PlansGrid` sub-component (or stays inline — both are fine).

---

## 6. `PlanCard` changes

Remove the task preview rows (`preview.map(...)`) and the `+ N more tasks` line. Card now shows only:
- Icon + title + type/date
- Progress bar + `done/total` fraction
- Tap handler: `onClick={() => onSelectPlan(plan.id)}`

---

## 7. Components to add / modify

| Component | Change |
|---|---|
| `usePlans` | New hook — localStorage persistence + 5 mutation functions |
| `PlanDetailScreen` | New component — top bar, task list with all interactions |
| `PlansPanel` | Add `selectedPlanId` state; call `usePlans`; render `PlanDetailScreen` or grid |
| `PlanCard` | Remove task preview; add `onClick` |

---

## 8. What doesn't change

- `AddPlanSheet` — unchanged; new plans are still added via the existing sheet
- Goal-type plans (`plan.type === 'goal'`) have no `tasks` array — `PlanDetailScreen` will never be opened for them (or can show an empty state if navigated to directly)
- Existing plan card visual style (colours, fonts, shadows) — unchanged except removal of task rows
