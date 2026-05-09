# Calendar Redesign v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the calendar tab's gradient routine bars with a per-day streak grid, and replace the bottom-fixed `TaskDetailSheet` with an inline expansion that pushes content (no overlay, no clipped buttons).

**Architecture:** All changes live in `web/app/page.jsx`. `WeekDetail` gains internal `expandedTaskId` state and renders an `InlineTaskDetail` card directly below the row of the tapped chip. `TaskDetailSheet` is deleted. A new helper `routineDayState(routine, date, completion14d)` classifies streak boxes. Effects are inline CSS using existing patterns plus a small `<style>` keyframe block injected once near the top of `CalendarTab`.

**Tech Stack:** React 18 (hooks), Next.js 14, inline styles via the `C` theme proxy, no new dependencies. Existing handlers: `handleReschedule`, `handleMarkDone`, `handleSkip` in `HeedApp`.

**Spec:** `docs/superpowers/specs/2026-05-09-calendar-redesign-v2-design.md`

---

## File Map

| File | Change |
|---|---|
| `web/app/page.jsx` ~line 7935 (after `routineDays`) | Add `routineDayState` helper |
| `web/app/page.jsx` 8337–8455 (`WeekDetail`) | Replace routines block; remove `+ Add context` stub; add `expandedTaskId` state + inline detail card; add `InlineTaskDetail` component above `WeekDetail` |
| `web/app/page.jsx` 8457–8574 (`TaskDetailSheet`) | **Delete entirely** |
| `web/app/page.jsx` 8576–8688 (`CalendarTab`) | Remove `detailTask` state; remove `<TaskDetailSheet>` render; remove the Legend card; drop `onTaskTap`, pass `onReschedule`/`onMarkDone`/`onSkip` to `WeekDetail`; inject `<style>` block with keyframes |
| `tests/calendar_inline_detail.spec.ts` | New playwright smoke test |

---

## Design Token Quick Reference

Available via `C` proxy:
- Surface: `C.paper`, `C.paperHi`, `C.cream`, `C.border`, `C.hairline`, `C.bellySoft`
- Text: `C.ink`, `C.inkSoft`, `C.inkMute`, `C.warmDark`
- Accent: `C.rust`, `C.ochre`, `C.sage`, `C.sageSoft`, `C.ochreSoft`

Existing helpers already in scope at the change site: `startOfWeek`, `addDays`, `sameDay`, `parseDue`, `routineDays`, `TODAY_DATE`, `ImportanceBadge`, `QUICK_CONTEXT_CONFIG`, `FUNCTIONS_URL`, `authHeaders`, `isDemoMode`.

---

## Task 1 — Add `routineDayState` helper

**Files:**
- Modify: `web/app/page.jsx` immediately after `routineDays` (around line 7942)

- [ ] **Step 1: Insert the helper**

After the `routineDays` function (around line 7942), insert:

```jsx
// Classify one day-cell of a routine streak grid.
// Returns 'done' | 'missed' | 'future' | 'off' (off = routine not scheduled this weekday).
// `completion14d` is indexed 0..13 where 13 = today, 0 = 13 days ago.
function routineDayState(routine, date, today = new Date()) {
  const t = new Date(today); t.setHours(0,0,0,0)
  const d = new Date(date);  d.setHours(0,0,0,0)
  const wd = (d.getDay() + 6) % 7  // Mon=0 … Sun=6
  const scheduled = routineDays(routine).includes(wd)
  if (!scheduled) return 'off'
  const daysFromToday = Math.round((t - d) / 86400000)
  if (daysFromToday < 0) return 'future'
  const arr = routine.completion14d || []
  const idx = arr.length - 1 - daysFromToday
  if (idx < 0 || idx >= arr.length) return 'missed'  // older than the window
  return arr[idx] ? 'done' : 'missed'
}
```

- [ ] **Step 2: Verify dev server compiles**

```bash
cd web && npm run dev
```

Expected: no compile errors. The helper isn't used yet but must parse cleanly.

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add routineDayState helper for streak grid"
```

---

## Task 2 — Replace routines block with the streak grid

**Files:**
- Modify: `web/app/page.jsx` 8371–8398 (the `routines.length > 0` block inside `WeekDetail`)

- [ ] **Step 1: Replace the existing routines block**

Find the block in `WeekDetail` that begins with `{routines.length > 0 && (` (currently around line 8371) and ends at the matching `)}` before the day-rows `<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>` (currently around line 8398). Replace the entire block with:

```jsx
{routines.length > 0 && (
  <div style={{ marginBottom: 14 }}>
    <div style={{
      fontSize: 9, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6,
      textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span>Routines · this week</span>
      <span style={{ fontSize: 8, color: C.inkMute, opacity: 0.7 }}>tap to edit</span>
    </div>
    <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px' }}>
      {routines.map(r => {
        const stateBg = { done: C.sage, missed: C.border, future: C.bellySoft, off: C.bellySoft }
        const stateFg = { done: C.cream, missed: C.inkMute, future: C.inkMute, off: C.inkMute }
        const stateOpacity = { done: 1, missed: 1, future: 1, off: 0.4 }
        return (
          <button key={r.id} onClick={() => onEditRoutine && onEditRoutine(r)}
            style={{
              display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8,
              alignItems: 'center', width: '100%', padding: '4px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
            }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.warmDark,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{r.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {[0,1,2,3,4,5,6].map(i => {
                const date = addDays(weekStart, i)
                const state = routineDayState(r, date, today)
                const isToday = sameDay(date, today)
                return (
                  <div key={i} style={{
                    aspectRatio: '1 / 1', minWidth: 16, maxHeight: 22,
                    borderRadius: 4,
                    background: stateBg[state],
                    color: stateFg[state],
                    opacity: stateOpacity[state],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700,
                    boxShadow: isToday ? `inset 0 0 0 1.5px ${C.warmDark}` : 'none',
                  }}>
                    {['M','T','W','T','F','S','S'][i]}
                  </div>
                )
              })}
            </div>
          </button>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify visually**

```bash
cd web && npm run dev
```

1. Open http://localhost:3000 → Calendar tab.
2. The Routines header should now read **"Routines · this week"** with **"tap to edit"** on the right.
3. Each routine renders as one row: name on the left, 7 small day-boxes labeled M T W T F S S.
4. Today's box has an inset border. Past days that the routine fired are sage-filled with cream text. Past scheduled-but-not-done are beige. Future scheduled days are pale belly-soft. Off-days (routine not scheduled this weekday) are the same pale color but at 40% opacity.
5. Click a routine row → existing edit-routine sheet opens (unchanged).

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: routines block as streak grid with done/missed/future states"
```

---

## Task 3 — Drop the `+ Add context` per-row stub

**Files:**
- Modify: `web/app/page.jsx` ~8442–8447 (inside `WeekDetail`'s day-row map)

- [ ] **Step 1: Remove the add-context button**

Inside the day-row mapping in `WeekDetail`, locate the JSX block:

```jsx
{dayCtxs.length === 0 && (
  <button onClick={() => onAddContext && onAddContext(date)}
    style={{ background: 'none', border: `1px dashed ${C.border}`, color: C.inkMute, padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: 0.45 }}>
    + Add context
  </button>
)}
```

Delete it entirely. The `+ Add task` stub immediately above it stays.

- [ ] **Step 2: Drop `onAddContext` from the `WeekDetail` props destructure**

Change the function signature at line 8337 from:

```jsx
function WeekDetail({ tasks, weekStart, onTaskTap, onWeekOffsetChange, onAddTask, contexts = [], onAddContext, routines = [], onEditRoutine }) {
```

to:

```jsx
function WeekDetail({ tasks, weekStart, onTaskTap, onWeekOffsetChange, onAddTask, contexts = [], routines = [], onEditRoutine }) {
```

(`onAddContext` removed.)

- [ ] **Step 3: Stop forwarding `onAddContext` from `CalendarTab`**

In the `<WeekDetail … />` call inside `CalendarTab` (around line 8654), remove the `onAddContext={onAddContext}` line. `CalendarTab` keeps the prop on its own signature and on the FAB call site — nothing else changes.

- [ ] **Step 4: Verify**

```bash
cd web && npm run dev
```

Open Calendar tab. Day rows with no context should now show only `+ Add task` (one stub, not two). FAB still has Add Context option.

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: remove per-row +Add context stub from calendar week rows"
```

---

## Task 4 — Add `InlineTaskDetail` component

**Files:**
- Modify: `web/app/page.jsx` — insert `InlineTaskDetail` immediately above `WeekDetail` (around line 8336, before `function WeekDetail`)

- [ ] **Step 1: Insert the component**

Insert the following function definition above `function WeekDetail(...)`:

```jsx
function InlineTaskDetail({ task, onClose, onMarkDone, onSkip, onReschedule }) {
  const dateInputRef = useRef(null)
  const [pulse, setPulse] = useState(false)

  const cadenceLabel = task.learned_cadence_days
    ? `every ~${task.learned_cadence_days} days`
    : task.explicit_cadence_days
    ? `every ~${task.explicit_cadence_days} days`
    : 'unset'
  const lastDoneLabel = task.last_done_at
    ? new Date(task.last_done_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Never'
  const dueLabel = task.next_due_at
    ? parseDue(task.next_due_at)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '—'
    : '—'

  function reschedule(newDate) {
    onReschedule(task.id, newDate)
    onClose()
  }

  const quickDates = [
    { label: 'Today',   date: () => new Date() },
    { label: '+1 day',  date: () => addDays(new Date(), 1) },
    { label: '+3 days', date: () => addDays(new Date(), 3) },
    { label: '+1 week', date: () => addDays(new Date(), 7) },
  ]

  return (
    <div
      data-testid="inline-task-detail"
      onClick={e => e.stopPropagation()}
      className="heed-inline-detail"
      style={{
        margin: '4px 8px',
        background: C.paperHi,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 12,
        boxShadow: '0 2px 8px rgba(124,83,51,0.06)',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: 'Lora, serif', fontSize: 14, fontWeight: 700, color: C.warmDark }}>{task.name}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <ImportanceBadge importance={task.importance}/>
            {task.category && (
              <span style={{ background: C.sage, color: C.cream, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{task.category}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: C.inkMute, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Due</div>
          <div style={{ fontSize: 12, color: C.rust, fontWeight: 700 }}>{dueLabel}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[{ l: 'Cadence', v: cadenceLabel }, { l: 'Last done', v: lastDoneLabel }].map(({ l, v }) => (
          <div key={l} style={{ background: C.bellySoft, borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 9, color: C.inkMute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{l}</div>
            <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: C.inkMute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Reschedule to</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {quickDates.map(({ label, date }) => (
          <button key={label} onClick={() => reschedule(date())}
            style={{ background: C.paper, border: `1.5px solid ${C.border}`, color: C.ink, padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
        <button onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
          style={{ background: C.paper, border: `1.5px solid ${C.border}`, color: C.ink, padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          📅 Pick
        </button>
        <input ref={dateInputRef} type="date"
          style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          onChange={e => { if (e.target.value) reschedule(new Date(e.target.value + 'T12:00:00')) }}/>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => {
            setPulse(true)
            setTimeout(() => { onMarkDone(task); onClose() }, 120)
          }}
          className={pulse ? 'heed-pulse' : ''}
          style={{ flex: 1, background: C.sage, color: C.cream, border: 'none', padding: 8, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          ✓ Mark done
        </button>
        <button onClick={() => { onSkip(task); onClose() }}
          style={{ flex: 1, background: C.paper, color: C.warmDark, border: `1.5px solid ${C.border}`, padding: 8, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↷ Skip
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `expandedTaskId` state and inline rendering inside `WeekDetail`**

Update `WeekDetail`'s signature to also receive `onMarkDone`, `onSkip`, `onReschedule`:

```jsx
function WeekDetail({ tasks, weekStart, onWeekOffsetChange, onAddTask, contexts = [], routines = [], onEditRoutine, onMarkDone, onSkip, onReschedule }) {
```

(Note: `onTaskTap` is removed — `WeekDetail` now handles its own state.)

Immediately after the existing `const today = new Date()` at the top of `WeekDetail`, add:

```jsx
const [expandedTaskId, setExpandedTaskId] = useState(null)
const expandedTask = tasks.find(t => t.id === expandedTaskId) || null

// Close on outside tap (anything not inside a chip or the inline card).
useEffect(() => {
  if (!expandedTaskId) return
  function onDocPointerDown(e) {
    const el = e.target
    if (el.closest && (el.closest('[data-task-chip]') || el.closest('[data-testid="inline-task-detail"]'))) return
    setExpandedTaskId(null)
  }
  document.addEventListener('pointerdown', onDocPointerDown)
  return () => document.removeEventListener('pointerdown', onDocPointerDown)
}, [expandedTaskId])
```

- [ ] **Step 3: Replace the entire day-row map with the wrapped Fragment version**

Find the day-row map in `WeekDetail` (currently around line 8400 — the `<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>` block that contains `[0,1,2,3,4,5,6].map(i => { … })`). Replace the **entire `[0,1,2,3,4,5,6].map(...)` block** with:

```jsx
{[0,1,2,3,4,5,6].map(i => {
  const date     = addDays(weekStart, i)
  const isToday  = sameDay(date, today)
  const dayTasks = tasks.filter(t => { const d = parseDue(t.next_due_at); return d && sameDay(d, date) })
  const dayCtxs  = contextsOnDay(date)
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const showCardHere = expandedTask && (() => {
    const d = parseDue(expandedTask.next_due_at)
    return d && sameDay(d, date)
  })()
  return (
    <React.Fragment key={i}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 10px', borderRadius: 8, background: isToday ? C.bellySoft + '80' : 'transparent', minHeight: 40 }}>
        <div style={{ flexShrink: 0, width: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: 0.5 }}>{dayNames[i]}</div>
          <div className={isToday ? 'heed-today-glow' : ''}
            style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 600, color: isToday ? C.cream : C.warmDark, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? C.warmDark : 'transparent', marginTop: 2 }}>
            {date.getDate()}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', paddingTop: 6 }}>
          {dayCtxs.map((ctx, j) => {
            const cfg = QUICK_CONTEXT_CONFIG[ctx.context_type] || {}
            return (
              <div key={j} style={{ background: C.ochreSoft, border: `1px solid ${C.ochre}55`, borderRadius: 5, padding: '3px 8px', fontSize: 10.5, color: C.warmDark, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cfg.icon || '📅'} {ctx.description || cfg.label || ctx.context_type}
              </div>
            )
          })}
          {dayTasks.map(task => {
            const imp  = task.importance || 'medium'
            const bg   = ({ high: C.rust, medium: C.ochre, low: C.sage })[imp] || C.ochre
            const icon = ({ high: '●', medium: '◆', low: '○' })[imp] || '◆'
            const isExpanded = expandedTaskId === task.id
            return (
              <div key={task.id}
                data-task-chip
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedTaskId(prev => prev === task.id ? null : task.id)
                }}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)' }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                style={{
                  background: bg, borderRadius: 5, padding: '4px 10px',
                  fontSize: 11, color: C.cream, fontWeight: 600, cursor: 'pointer',
                  userSelect: 'none', whiteSpace: 'nowrap',
                  boxShadow: isExpanded ? `inset 0 0 0 1.5px ${C.warmDark}` : 'none',
                  transition: 'transform 80ms ease-out',
                }}>
                {icon} {task.name}
              </div>
            )
          })}
          {dayTasks.length === 0 && dayCtxs.length === 0 && (
            <button onClick={() => onAddTask(date)}
              style={{ background: 'none', border: `1px dashed ${C.border}`, color: C.inkMute, padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: 0.55, transition: 'opacity 140ms' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = 1 }}
              onMouseLeave={e => { e.currentTarget.style.opacity = 0.55 }}>
              + Add task
            </button>
          )}
        </div>
      </div>
      {showCardHere && (
        <InlineTaskDetail
          task={expandedTask}
          onClose={() => setExpandedTaskId(null)}
          onMarkDone={onMarkDone}
          onSkip={onSkip}
          onReschedule={onReschedule}
        />
      )}
    </React.Fragment>
  )
})}
```

Note three things baked into this replacement:
- **Empty-state condition tightened** to `dayTasks.length === 0 && dayCtxs.length === 0` (was `dayTasks.length === 0` only — but the old `+ Add context` second stub is gone in Task 3). Add-task only appears when the row is fully empty.
- **`heed-today-glow` className** on the today date pill — this reads cleanly here even though the keyframes themselves arrive in Task 6.
- **`+ Add task` opacity transition** added inline (matches spec ⑥).

Make sure `React` is in scope. The existing top-of-file react import looks like `import React, { useState, useRef, useEffect } from 'react'` (or similar) — `React.Fragment` is available either way. If your file uses pure named imports without the default `React`, add `Fragment` to the named list and replace `<React.Fragment …>` with `<Fragment …>` accordingly.

- [ ] **Step 4: Verify the file compiles**

```bash
cd web && npm run dev
```

Expected: no compile errors. The card may not render yet from `CalendarTab` (it still passes `onTaskTap` instead of the new handlers — that's fixed in Task 5).

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add InlineTaskDetail and expandedTaskId state to WeekDetail"
```

---

## Task 5 — Delete `TaskDetailSheet`, remove Legend, rewire `CalendarTab`

**Files:**
- Modify: `web/app/page.jsx` 8457–8574 (delete `TaskDetailSheet`)
- Modify: `web/app/page.jsx` 8576–8688 (`CalendarTab`)

- [ ] **Step 1: Delete `TaskDetailSheet` entirely**

Remove the entire `function TaskDetailSheet(...) { … }` block (lines 8457–8574). Nothing else in the file references it after this task — verify with `git grep TaskDetailSheet` if you want.

- [ ] **Step 2: Remove `detailTask` state and the sheet render**

In `CalendarTab` (around line 8576), delete the line:

```jsx
const [detailTask, setDetailTask]   = useState(null)
```

And delete the block:

```jsx
{detailTask && (
  <TaskDetailSheet
    task={detailTask}
    onClose={() => setDetailTask(null)}
    onMarkDone={onMarkDone}
    onSkip={onSkip}
    onReschedule={onReschedule}
  />
)}
```

- [ ] **Step 3: Remove the Legend card**

Delete the entire `<div>` block that renders the legend (around lines 8666–8673):

```jsx
<div style={{ padding: '12px 16px', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: C.shadowSoft }}>
  <div style={{ fontSize: 10.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Legend</div>
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <ImportanceBadge importance="low"/>
    <ImportanceBadge importance="medium"/>
    <ImportanceBadge importance="high"/>
  </div>
</div>
```

- [ ] **Step 4: Update the `<WeekDetail … />` call**

Change the existing call (around line 8654) from:

```jsx
<WeekDetail
  tasks={tasks}
  weekStart={weekStart}
  contexts={contexts}
  routines={routines}
  onTaskTap={setDetailTask}
  onWeekOffsetChange={handleWeekOffsetChange}
  onAddTask={onAddTask}
  onAddContext={onAddContext}
  onEditRoutine={onEditRoutine}
/>
```

to:

```jsx
<WeekDetail
  tasks={tasks}
  weekStart={weekStart}
  contexts={contexts}
  routines={routines}
  onWeekOffsetChange={handleWeekOffsetChange}
  onAddTask={onAddTask}
  onEditRoutine={onEditRoutine}
  onMarkDone={onMarkDone}
  onSkip={onSkip}
  onReschedule={onReschedule}
/>
```

- [ ] **Step 5: Verify end-to-end**

```bash
cd web && npm run dev
```

1. Open http://localhost:3000 → Calendar tab.
2. Tap a task chip → an inline card appears directly under that day's row, pushing later rows down. No backdrop, no overlay.
3. Tap the same chip again → card collapses.
4. Tap a different chip on a different day → first card closes, new card appears under the new row.
5. Tap anywhere outside any chip or card (e.g., the month header) → card closes.
6. From the card: click "+1 day" → API PATCH fires (Network tab), card closes, chip moves to the new day.
7. From the card: click "Mark done" → button stays pressed visually for ~120ms, then card closes and chip is removed/refetched per existing handler.
8. Bottom of screen: no Legend card. No bottom sheet. Tab bar is still visible and never overlapped by detail UI.

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: remove TaskDetailSheet and Legend; wire WeekDetail to handlers directly"
```

---

## Task 6 — Effects (animations + reduced-motion)

**Files:**
- Modify: `web/app/page.jsx` — add a `<style>` block inside `CalendarTab` (top of return, before the main card div)

- [ ] **Step 1: Inject keyframes and animation classes**

Inside `CalendarTab`, immediately after the opening `return (` and `<div>`, add:

```jsx
<style>{`
  @keyframes heed-inline-in {
    from { opacity: 0; transform: translateY(-4px); max-height: 0; }
    to   { opacity: 1; transform: translateY(0);   max-height: 600px; }
  }
  @keyframes heed-pulse-once {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.04); }
    100% { transform: scale(1); }
  }
  @keyframes heed-today-glow {
    0%   { box-shadow: 0 0 0 0 rgba(124,83,51,0.55); }
    100% { box-shadow: 0 0 0 4px rgba(124,83,51,0); }
  }
  .heed-inline-detail { animation: heed-inline-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both; overflow: hidden; }
  .heed-pulse { animation: heed-pulse-once 220ms ease-in-out; }
  .heed-today-glow { animation: heed-today-glow 600ms ease-out; }
  @media (prefers-reduced-motion: reduce) {
    .heed-inline-detail, .heed-pulse, .heed-today-glow { animation: none !important; }
    [data-task-chip] { transition: none !important; }
  }
`}</style>
```

- [ ] **Step 2: Add the today-glow class to the today date pill**

Inside the day-row map in `WeekDetail`, find the `<div>` that renders the today date number circle (currently has `background: isToday ? C.warmDark : 'transparent'` around line 8411). Add `className={isToday ? 'heed-today-glow' : ''}`:

```jsx
<div className={isToday ? 'heed-today-glow' : ''} style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 600, color: isToday ? C.cream : C.warmDark, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? C.warmDark : 'transparent', marginTop: 2 }}>
  {date.getDate()}
</div>
```

- [ ] **Step 3: Verify animations**

```bash
cd web && npm run dev
```

1. Tap a task chip → card slides/fades in over ~220ms.
2. Click Mark done → button briefly scales up before card closes.
3. Today's date number has a brief glow on first render.
4. Open Chrome DevTools → Rendering → enable "Emulate CSS prefers-reduced-motion: reduce" → reload → reopen Calendar. The card should appear instantly with no fade/scale; chip press has no scale.

- [ ] **Step 4: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add inline-detail/pulse/glow animations with reduced-motion guard"
```

---

## Task 7 — Playwright smoke test for inline detail

**Files:**
- Create: `tests/calendar_inline_detail.spec.ts`

- [ ] **Step 1: Confirm playwright config and existing test pattern**

Read `tests/low_day_flow.spec.ts` (existing) to see how the suite navigates to the calendar tab and what the base URL is. Match its setup style.

```bash
ls tests/
cat tests/low_day_flow.spec.ts | head -30
cat playwright.config.ts | head -30
```

- [ ] **Step 2: Write the smoke test**

Create `tests/calendar_inline_detail.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Calendar inline task detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Calendar/i }).click()
  })

  test('tapping a task chip opens an inline detail card under its row', async ({ page }) => {
    // Find any task chip in the week view (importance prefix is ●/◆/○).
    const chip = page.locator('[data-task-chip]').first()
    await expect(chip).toBeVisible()
    await chip.click()

    const card = page.getByTestId('inline-task-detail')
    await expect(card).toBeVisible()
    await expect(card.getByText(/Mark done/i)).toBeVisible()
    await expect(card.getByText(/Skip/i)).toBeVisible()
    await expect(card.getByText(/Reschedule to/i)).toBeVisible()
  })

  test('tapping the same chip again closes the card', async ({ page }) => {
    const chip = page.locator('[data-task-chip]').first()
    await chip.click()
    await expect(page.getByTestId('inline-task-detail')).toBeVisible()
    await chip.click()
    await expect(page.getByTestId('inline-task-detail')).toHaveCount(0)
  })

  test('tapping outside the card closes it', async ({ page }) => {
    await page.locator('[data-task-chip]').first().click()
    await expect(page.getByTestId('inline-task-detail')).toBeVisible()
    // Click the month header — outside any chip or card.
    await page.getByText(/May|June|April|July|August|September|October|November|December|January|February|March/).first().click()
    await expect(page.getByTestId('inline-task-detail')).toHaveCount(0)
  })

  test('no fixed bottom sheet exists anymore', async ({ page }) => {
    await page.locator('[data-task-chip]').first().click()
    // Old TaskDetailSheet had a fixed-position container with a drag handle (36×4 div).
    // The inline card lives in normal document flow, so nothing should be position:fixed
    // for the detail UI.
    const fixedSheets = page.locator('div').filter({
      hasText: /Reschedule to/,
    }).evaluateAll(els =>
      els.some(el => getComputedStyle(el).position === 'fixed')
    )
    expect(await fixedSheets).toBe(false)
  })
})
```

- [ ] **Step 3: Run the test**

```bash
cd web && npm run dev   # in one terminal
# in another:
npx playwright test tests/calendar_inline_detail.spec.ts --reporter=line
```

Expected: all 4 tests pass. If a test fails because there's no task chip in the visible week (demo data shows e.g. May), navigate the week with the swipe/arrows or seed the test with a known date — adjust the test to start from a known-good week and add an appropriate `await page.evaluate(...)` to set the week if needed.

- [ ] **Step 4: Commit**

```bash
git add tests/calendar_inline_detail.spec.ts
git commit -m "test: playwright smoke for calendar inline task detail"
```

---

## Task 8 — Production build, manual sweep, push

**Files:** none modified — verification + deploy.

- [ ] **Step 1: Run the spec's full manual checklist**

Open `docs/superpowers/specs/2026-05-09-calendar-redesign-v2-design.md` → "Testing" section. Walk through all 12 numbered checks against the dev server. For any failure, fix it (with a new commit) before proceeding.

- [ ] **Step 2: Production build**

```bash
cd web && npm run build
```

Expected: clean exit, `web/out/` regenerated.

- [ ] **Step 3: Commit the static export**

```bash
git add web/out
git commit -m "build: rebuild static export with calendar v2"
```

- [ ] **Step 4: Push**

```bash
git push
```

Watch the GitHub Actions deploy job. When it finishes, open the production URL and re-run checks 1, 2, 5, 7 from the spec on the live site.

---

## Verification checklist (after deploy)

- [ ] Routines block shows the streak grid with done/missed/future/off states (not the old gradient bars).
- [ ] Today's box in the streak grid has an inset border.
- [ ] Tapping a task chip opens an inline detail card under that day's row, pushing content down.
- [ ] All action buttons (Mark done, Skip, +1 day, etc.) are reachable on a small viewport — never hidden behind the tab bar.
- [ ] The old bottom Legend card is gone.
- [ ] No bottom sheet ever appears for task detail.
- [ ] Day rows with no task and no context show a single `+ Add task` stub (no `+ Add context` stub).
- [ ] Reschedule via inline pill triggers a PATCH and the chip moves to the new day.
- [ ] `prefers-reduced-motion: reduce` disables all transitions and keyframes for the calendar.
- [ ] Playwright smoke test (`tests/calendar_inline_detail.spec.ts`) passes against the dev server.
