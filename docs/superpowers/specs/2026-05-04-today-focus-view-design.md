# Today Focus View Design

**Goal:** Replace the overwhelming task dump on the Today tab with a focused daily digest — 3 AI-scored tasks surfaced by default, everything else hidden behind a single tap.

**Architecture:** Pure frontend change. A client-side scoring formula ranks tasks using overdue days, due proximity, and active context match. `TodayTab` derives `focusTasks` (top 3) and `remainingTasks` inline. Non-focus tasks are hidden by default and revealed by an action chip. No backend changes, no new persistence.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern)

---

## 1. Layout

Today renders in this order:

1. Greeting (unchanged)
2. ContextBanner (unchanged)
3. **"Focus today"** section — top 3 scored tasks as `TaskCard`s
4. **Routines** section — unchanged, same `RoutineRow` components
5. **Action chips row** — "📋 See all tasks", "+ Add a task", "✨ Ask Heed"
6. *(conditional)* Expanded remaining tasks — shown inline when "See all tasks" is tapped

The existing "Top of mind" hero cards, "Also overdue" collapsible, and "Coming up" collapsible are **removed** from the default view. They are replaced by the expanded remaining tasks section (step 6 above), which uses the existing `CollapsibleTodaySection` component and renders only when the user taps "See all tasks".

---

## 2. Scoring Formula

Each task receives a numeric score computed inline inside `TodayTab`:

```js
function scoreTask(task, upcomingContexts) {
  let score = 0

  // Overdue weight: 3 points per day overdue
  if (task.overdue != null) score += task.overdue * 3

  // Due proximity: tasks due within 14 days get points (max 14 for due today)
  if (task.dueIn !== undefined) score += Math.max(0, 14 - task.dueIn)

  // Context match bonus: +5 if task category matches any active/upcoming context type
  if (upcomingContexts && upcomingContexts.length > 0) {
    const contextTypes = upcomingContexts.map(c => (c.type || '').toLowerCase())
    const cat = (task.category || '').toLowerCase()
    if (contextTypes.some(ct => cat.includes(ct) || ct.includes(cat))) score += 5
  }

  return score
}
```

**Derivation inside `TodayTab`:**
```js
const scoredTasks = tasks
  .map(t => ({ task: t, score: scoreTask(t, upcomingContexts) }))
  .sort((a, b) => b.score - a.score)

const focusTasks = scoredTasks.slice(0, 3).map(s => s.task)
const remainingTasks = scoredTasks.slice(3).map(s => s.task)
```

If `tasks.length <= 3`, `focusTasks` contains all tasks and `remainingTasks` is empty (no chips row needed, or chips row without "See all tasks").

---

## 3. Focus Section

Section header: `🌿 Focus today` with count badge (using existing `SectionHeader` component).

Each focus task renders as a `TaskCard` — same component used in the existing "Also overdue" / "Coming up" sections. No new card component needed.

Empty state (zero tasks): reuse the existing "Nothing critical right now. Nice." card with streak + next context momentum text, unchanged.

---

## 4. Routines Section

Unchanged. Same `RoutineRow` components, same section header, same position below focus tasks.

---

## 5. Action Chips

Rendered below routines. Always shown.

```jsx
<div style={{ marginTop: 22 }}>
  <div style={{ fontSize: 11.5, color: C.inkMute, textAlign: 'center', marginBottom: 10 }}>
    Anything else?
  </div>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
    {remainingTasks.length > 0 && (
      <button onClick={() => setShowAllTasks(t => !t)} ...>
        📋 {showAllTasks ? 'Hide tasks' : 'See all tasks'}
      </button>
    )}
    <button onClick={onAddTask} ...>+ Add a task</button>
    <button onClick={() => onAskHeed('')} ...>✨ Ask Heed</button>
  </div>
</div>
```

Chip style: `background: C.paper`, `border: 1.5px solid C.border`, `borderRadius: 999`, `padding: 7px 15px`, `fontSize: 12.5`, `color: C.ink`, `fontFamily: inherit`.

**"📋 See all tasks"** — only rendered when `remainingTasks.length > 0`. Toggles `showAllTasks` state. Label flips to "Hide tasks" when expanded.

**"+ Add a task"** — calls `onAddTask()` (new prop, see §7).

**"✨ Ask Heed"** — calls `onAskHeed('')` (already a prop on `TodayTab`).

---

## 6. Expanded Remaining Tasks

Rendered inline below the chips when `showAllTasks === true`. Uses existing `CollapsibleTodaySection` to group by overdue vs. upcoming:

```jsx
{showAllTasks && (
  <div style={{ marginTop: 16 }}>
    {overdueRemaining.length > 0 && (
      <CollapsibleTodaySection motif="thorn" label="Also overdue" count={overdueRemaining.length} defaultOpen={overdueRemaining.length <= 4}>
        {overdueRemaining.map((t, i) => <TaskCard key={t.id} task={t} ... />)}
      </CollapsibleTodaySection>
    )}
    {upcomingRemaining.length > 0 && (
      <CollapsibleTodaySection motif="berry" label="Coming up" count={upcomingRemaining.length} defaultOpen={upcomingRemaining.length <= 6}>
        {upcomingRemaining.map((t, i) => <TaskCard key={t.id} task={t} ... />)}
      </CollapsibleTodaySection>
    )}
  </div>
)}
```

`overdueRemaining` = `remainingTasks.filter(t => t.overdue != null)`
`upcomingRemaining` = `remainingTasks.filter(t => t.dueIn !== undefined)`

---

## 7. Props & State Changes

### New state inside `TodayTab`
```js
const [showAllTasks, setShowAllTasks] = useState(false)
```

### New prop on `TodayTab`
```js
function TodayTab({ ..., onAddTask }) {
```

### Call site in `HeedApp` (~line 6442)
Add `onAddTask={() => setModalOpen(true)}` to the `<TodayTab .../>` JSX.

### Removed logic
- `heroSet` computation
- `otherOverdue` computation
- `upcoming` computation (the filter — `upcomingRemaining` replaces it in the expanded view)

These are replaced by `scoredTasks`, `focusTasks`, `remainingTasks` derivations.

---

## 8. What Doesn't Change

- Swipe hint logic (`showSwipeHint`, `dismissSwipeHint`) — unchanged, still shown on first `TaskCard`
- `ContextBanner` — unchanged
- Routines section — unchanged
- Skipped tasks strip — unchanged, still renders below everything if `skippedTasks.length > 0`
- `CollapsibleTodaySection` component — unchanged
- `TaskCard` component — unchanged
- `SectionHeader` component — unchanged
- All task action handlers (`onMarkDone`, `onSkip`, etc.) — unchanged
