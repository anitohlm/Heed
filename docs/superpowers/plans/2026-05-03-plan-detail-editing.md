# Plan Detail Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit a plan's icon, title, and date from within `PlanDetailScreen` via a ✎ button that reveals an inline edit panel.

**Architecture:** One new `updatePlan` mutation in `usePlans`; `PlanCard` gets a `daysUntil` guard for string dates; `PlanDetailScreen` gains `editingPlan`/`editDraft` state, a ✎/× toggle in the top bar, and an edit panel; `PlansPanel` forwards `updatePlan` to `PlanDetailScreen`. All changes are in `web/app/page.jsx`.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern)

---

## File structure

| File | Change |
|---|---|
| `web/app/page.jsx` | Add `updatePlan` to `usePlans`; fix `PlanCard` daysUntil; add edit UI to `PlanDetailScreen`; wire `PlansPanel` |

---

### Task 1: Add `updatePlan` to `usePlans` and wire `PlansPanel`

**Files:**
- Modify: `web/app/page.jsx` — `usePlans` function (around line 2232) and `PlansPanel` function (around line 2594)

- [ ] **Step 1: Add `updatePlan` mutation to `usePlans`**

Find (line ~2232):
```js
  const addPlan = useCallback((plan) => {
    setPlans(prev => [plan, ...prev])
  }, [])

  return { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan }
}
```

Replace with:
```js
  const addPlan = useCallback((plan) => {
    setPlans(prev => [plan, ...prev])
  }, [])

  const updatePlan = useCallback((planId, updates) => {
    setPlans(prev => prev.map(p => p.id !== planId ? p : { ...p, ...updates }))
  }, [])

  return { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan, updatePlan }
}
```

- [ ] **Step 2: Add `updatePlan` to `PlansPanel` props and pass to `PlanDetailScreen`**

Find (line ~2594):
```js
function PlansPanel({ plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan }) {
```
Replace with:
```js
function PlansPanel({ plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan, updatePlan }) {
```

Find (line ~2602):
```jsx
      <PlanDetailScreen
        plan={selectedPlan}
        onBack={() => setSelectedPlanId(null)}
        onCheck={checkTask}
        onRename={renameTask}
        onAddTask={addTask}
        onDeleteTask={deleteTask}
        onReorder={reorderTasks}
      />
```
Replace with:
```jsx
      <PlanDetailScreen
        plan={selectedPlan}
        onBack={() => setSelectedPlanId(null)}
        onCheck={checkTask}
        onRename={renameTask}
        onAddTask={addTask}
        onDeleteTask={deleteTask}
        onReorder={reorderTasks}
        onUpdatePlan={updatePlan}
      />
```

- [ ] **Step 3: Verify build**

```
cd C:\Users\hmanito\Heed\web && npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add updatePlan mutation to usePlans, wire to PlansPanel"
```

---

### Task 2: Fix `PlanCard` daysUntil for string eventDate

**Files:**
- Modify: `web/app/page.jsx` — `PlanCard` function (around line 2249)

After the user edits an event's date, `plan.eventDate` becomes a plain string (e.g. `"May 8"`). The current arithmetic `plan.eventDate - new Date()` fails silently with `NaN` for strings.

- [ ] **Step 1: Fix daysUntil computation**

Find (line ~2249):
```js
  const daysUntil = plan.eventDate
    ? Math.round((plan.eventDate - new Date()) / 86400000)
    : null
```
Replace with:
```js
  const parsedEventDate = plan.eventDate ? new Date(plan.eventDate) : null
  const daysUntil = parsedEventDate && !isNaN(parsedEventDate)
    ? Math.round((parsedEventDate - new Date()) / 86400000)
    : null
```

- [ ] **Step 2: Verify build**

```
cd C:\Users\hmanito\Heed\web && npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```
git add web/app/page.jsx
git commit -m "fix: guard PlanCard daysUntil against string eventDate"
```

---

### Task 3: Edit panel in `PlanDetailScreen`

**Files:**
- Modify: `web/app/page.jsx` — `PlanDetailScreen` function (around line 2303)

- [ ] **Step 1: Add `onUpdatePlan` prop and edit state**

Find (line ~2303):
```js
function PlanDetailScreen({ plan, onBack, onCheck, onRename, onAddTask, onDeleteTask, onReorder }) {
  const [editingIndex, setEditingIndex] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [swipedIndex, setSwipedIndex] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const rowRefs = useRef([])
  const swipeStart = useRef({ x: null, index: null })
  const dragRef = useRef({ dragIndex: null, dropIndex: null })
```
Replace with:
```js
function PlanDetailScreen({ plan, onBack, onCheck, onRename, onAddTask, onDeleteTask, onReorder, onUpdatePlan }) {
  const [editingIndex, setEditingIndex] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [swipedIndex, setSwipedIndex] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [editDraft, setEditDraft] = useState({ icon: '', title: '', date: '' })
  const rowRefs = useRef([])
  const swipeStart = useRef({ x: null, index: null })
  const dragRef = useRef({ dragIndex: null, dropIndex: null })
```

- [ ] **Step 2: Add `formatEventDate` helper and plan-edit handlers**

Find (after `handleDragPointerUp` and before `return (`):
```js
  return (
    <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
```
Insert immediately before that line:
```js
  function formatEventDate(val) {
    if (!val) return ''
    if (val instanceof Date) return val.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return String(val)
  }

  function openEditPlan() {
    setEditDraft({
      icon: plan.icon,
      title: plan.title,
      date: plan.type === 'project' ? (plan.dueDate ?? '') : formatEventDate(plan.eventDate),
    })
    setEditingPlan(true)
  }
  function cancelEditPlan() { setEditingPlan(false) }
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

- [ ] **Step 3: Add ✎/× button to top bar**

Find (inside the return, the top bar div):
```jsx
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.ochre, fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>‹ Plans</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <span style={{ fontSize: 18 }}>{plan.icon}</span>
          <span style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 600, color: C.warmDark }}>{plan.title}</span>
        </div>
      </div>
```
Replace with:
```jsx
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.ochre, fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>‹ Plans</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <span style={{ fontSize: 18 }}>{plan.icon}</span>
          <span style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 600, color: C.warmDark }}>{plan.title}</span>
        </div>
        <button onClick={editingPlan ? cancelEditPlan : openEditPlan} style={{ background: 'none', border: 'none', color: C.border, fontSize: 16, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit', lineHeight: 1 }}>{editingPlan ? '×' : '✎'}</button>
      </div>
```

- [ ] **Step 4: Insert edit panel between top bar and progress bar**

Find (the progress bar JSX, immediately after the top bar closing `</div>`):
```jsx
      {/* progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
```
Insert immediately before it:
```jsx
      {/* edit panel */}
      {editingPlan && (
        <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <input
              value={editDraft.icon}
              onChange={e => setEditDraft(d => ({ ...d, icon: e.target.value }))}
              style={{ width: 36, height: 36, textAlign: 'center', fontSize: 22, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', flexShrink: 0 }}
            />
            <input
              value={editDraft.title}
              onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
              style={{ flex: 1, fontSize: 14, fontWeight: 600, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', color: C.ink }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.inkMute, flexShrink: 0 }}>{plan.type === 'project' ? 'Due' : 'Date'}</span>
            <input
              value={editDraft.date}
              onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))}
              placeholder={plan.type === 'project' ? 'e.g. Jun 15' : 'e.g. May 8'}
              style={{ flex: 1, fontSize: 13, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', color: C.ink }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={cancelEditPlan} style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>Cancel</button>
            <button onClick={saveEditPlan} style={{ background: 'none', border: 'none', color: C.ochre, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>Save →</button>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify build**

```
cd C:\Users\hmanito\Heed\web && npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 6: E2E browser test**

Start dev server:
```
cd C:\Users\hmanito\Heed\web && npm run dev
```

Open `http://localhost:3000`. Go to **Plans** tab and verify:

1. Tap "Move apartments" → detail screen opens.
2. Top bar shows `✎` on the right edge.
3. Tap `✎` → edit panel appears below top bar with icon, title, and "Due" date fields pre-filled.
4. Top bar `✎` becomes `×`.
5. Change the title to "Move to new place" → tap Save → top bar updates to new title. ✎ reappears.
6. Tap `✎` again → fields show updated values.
7. Change the date to "Jul 1" → Save → plan card in the list shows "Due Jul 1" in subtitle.
8. Tap `×` (cancel) → edit panel closes, no changes applied.
9. Tap "Job interview — Acme Co." → `✎` in top bar. Tap it → date label shows "Date", date field shows current event date. Edit and save → returns cleanly.
10. **Reload** → all edits persist (localStorage).

- [ ] **Step 7: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add plan detail editing — icon, title, date via edit panel"
```
