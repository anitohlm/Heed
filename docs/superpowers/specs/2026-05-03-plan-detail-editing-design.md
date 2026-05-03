# Plan Detail Editing Design

**Goal:** Allow users to edit the icon, title, and date of a project or event plan from within `PlanDetailScreen`.

**Architecture:** A ✎ button in the top bar toggles an edit panel. A new `updatePlan` mutation is added to `usePlans`. `PlanDetailScreen` gains `editingPlan` + `editDraft` state and an `onUpdatePlan` prop. `PlansPanel` passes `updatePlan` down.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern)

---

## 1. Top bar changes

The top bar currently renders: `‹ Plans` (left) · icon + title (centre).

A ✎ button is added to the right edge. It is `color: C.border`, `cursor: pointer`, no border/background (ghost). When `editingPlan` is true it renders × instead of ✎.

Layout:
```
[ ‹ Plans ]   [ {icon} {title} ]   [ ✎ ]
```

Tapping ✎ sets `editingPlan = true` and initialises `editDraft` from the current plan fields. Tapping × sets `editingPlan = false` and discards the draft.

---

## 2. Edit panel

Rendered immediately below the top bar when `editingPlan` is true, above the progress bar.

Layout (two rows):
```
Row 1:  [ icon input 36×36 ]  [ title input (flex: 1) ]
Row 2:  [ date label "Due" / "Date" ]  [ date input (flex: 1) ]
Row 3:  [ Cancel button ]  [ spacer ]  [ Save button ]
```

Fields:
- **Icon input** — `<input>` 36×36px, `text-align: center`, `fontSize: 22`, pre-filled with `plan.icon`
- **Title input** — `<input>`, `flex: 1`, pre-filled with `plan.title`
- **Date label** — `"Due"` for `project`, `"Date"` for `event`; `fontSize: 12`, `color: C.inkMute`
- **Date input** — `<input>`, `flex: 1`, pre-filled with the plan's date value (see §4)
- **Cancel** — ghost button, `color: C.inkMute`; calls `cancelEditPlan()`
- **Save** — primary-style button, `color: C.ochre`, `fontWeight: 700`; calls `saveEditPlan()`

All inputs share the existing inline-edit style: `border: none`, `borderBottom: 1.5px solid C.ochre`, `outline: none`, `background: transparent`, `fontFamily: inherit`.

---

## 3. State and handlers in PlanDetailScreen

New state:
```js
const [editingPlan, setEditingPlan] = useState(false)
const [editDraft, setEditDraft] = useState({ icon: '', title: '', date: '' })
```

New prop: `onUpdatePlan` (called with `(planId, updates)`)

```js
function openEditPlan() {
  setEditDraft({
    icon: plan.icon,
    title: plan.title,
    date: plan.type === 'project' ? (plan.dueDate ?? '') : formatEventDate(plan.eventDate),
  })
  setEditingPlan(true)
}

function cancelEditPlan() {
  setEditingPlan(false)
}

function saveEditPlan() {
  const updates = {
    icon: editDraft.icon.trim() || plan.icon,
    title: editDraft.title.trim() || plan.title,
  }
  if (plan.type === 'project') updates.dueDate = editDraft.date.trim()
  if (plan.type === 'event')   updates.eventDate = editDraft.date.trim()
  onUpdatePlan(plan.id, updates)
  setEditingPlan(false)
}
```

`formatEventDate(val)` — if `val` is a `Date` object, returns `val.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`. If it is a string, returns it as-is.

---

## 4. Date field display

- **Project** — reads/writes `plan.dueDate` (already a plain string, e.g. `"Jun 15"`)
- **Event** — reads `plan.eventDate`; if a `Date` object, formats via `formatEventDate`; if already a string, uses as-is. Writes back as a plain string (user-typed value).

`PlanCard`'s "days until" subtitle for events:
```js
const daysUntil = plan.eventDate
  ? Math.round((new Date(plan.eventDate) - new Date()) / 86400000)
  : null
```
Wrapping in `new Date(...)` handles both `Date` objects and ISO/display strings. If parsing fails (returns `NaN`), `daysUntil` remains `NaN` — guard with `isNaN(daysUntil) ? null : daysUntil`.

---

## 5. `usePlans` — new `updatePlan` mutation

```js
const updatePlan = useCallback((planId, updates) => {
  setPlans(prev => prev.map(p => p.id !== planId ? p : { ...p, ...updates }))
}, [])
```

Return value expanded to include `updatePlan`.

---

## 6. `PlansPanel` wiring

`PlansPanel` destructures `updatePlan` from `usePlans` and passes it to `PlanDetailScreen`:

```jsx
<PlanDetailScreen
  ...existing props...
  onUpdatePlan={updatePlan}
/>
```

`LifeTab` passes `{ ...plansHook }` to `PlansPanel` — since `PlansPanel` now accepts `updatePlan` as a prop, no changes needed in `LifeTab` as long as `usePlans` returns `updatePlan` (spread takes care of it).

---

## 7. What doesn't change

- Goal plans remain non-tappable — no detail screen, no editing.
- Task editing interactions in `PlanDetailScreen` are unchanged.
- `AddPlanSheet` is unchanged — it creates new plans as before.
- `PLAN_TYPES` and the existing form in `AddPlanSheet` are unchanged.
