# Today Focus View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overwhelming Today tab with a focused daily digest — 3 AI-scored tasks shown by default, everything else hidden behind action chips.

**Architecture:** Pure frontend change to `TodayTab` in `web/app/page.jsx`. A `scoreTask` helper ranks each task by overdue days (×3), due proximity (0–14 pts), and context match (+5). Top 3 become `focusTasks`; the rest are hidden until the user taps "See all tasks". Three action chips at the bottom replace the old overdue/upcoming sections as default content.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern)

---

## File structure

| File | Change |
|---|---|
| `web/app/page.jsx` | Modify `TodayTab` (~line 2716) and its call site (~line 6725) |

---

### Task 1: Rewrite `TodayTab` — scoring logic, new JSX, state, prop

**Files:**
- Modify: `web/app/page.jsx` — `TodayTab` function (~lines 2716–2827)

Context: `TodayTab` currently computes `heroSet`/`otherOverdue`/`upcoming` and renders them as separate sections. This task replaces all of that with a scoring formula and a new layout.

- [ ] **Step 1: Replace the old scoring variables with `scoreTask` + new derivations**

Find (lines ~2725–2735 — the block from `const overdue` through `const upcoming`):
```js
  const overdue = tasks.filter(t => t.overdue != null).sort((a, b) => b.overdue - a.overdue)
  // Hero set: top overdue tasks within 25% of #1's days. So 12d/11d/10d all
  // become heroes; 12d/3d/2d only promotes the first.
  const heroSet = (() => {
    if (overdue.length === 0) return []
    const top = overdue[0].overdue || 1
    const cutoff = top * 0.75
    return overdue.filter(t => (t.overdue || 0) >= cutoff).slice(0, 3)
  })()
  const otherOverdue = overdue.slice(heroSet.length)
  const upcoming = tasks.filter(t => t.dueIn !== undefined)
```

Replace with:
```js
  function scoreTask(task) {
    let score = 0
    if (task.overdue != null) score += task.overdue * 3
    if (task.dueIn !== undefined) score += Math.max(0, 14 - task.dueIn)
    if (upcomingContexts && upcomingContexts.length > 0) {
      const contextTypes = upcomingContexts.map(c => (c.type || '').toLowerCase())
      const cat = (task.category || '').toLowerCase()
      if (contextTypes.some(ct => cat.includes(ct) || ct.includes(cat))) score += 5
    }
    return score
  }
  const scoredTasks = tasks.map(t => ({ task: t, score: scoreTask(t) })).sort((a, b) => b.score - a.score)
  const focusTasks = scoredTasks.slice(0, 3).map(s => s.task)
  const remainingTasks = scoredTasks.slice(3).map(s => s.task)
  const overdueRemaining = remainingTasks.filter(t => t.overdue != null)
  const upcomingRemaining = remainingTasks.filter(t => t.dueIn !== undefined)
```

- [ ] **Step 2: Add `onAddTask` prop to the function signature**

Find (line ~2716):
```js
function TodayTab({ tasks, routines, upcomingContexts, skippedTasks = [], onMarkDone, onSkip, onUnskip, onMarkRoutineDone, onSkipRoutineToday, onLightenRoutine, onEditRoutine, onAskHeed, onMoreOptions, onShareCard }) {
```

Replace with:
```js
function TodayTab({ tasks, routines, upcomingContexts, skippedTasks = [], onMarkDone, onSkip, onUnskip, onMarkRoutineDone, onSkipRoutineToday, onLightenRoutine, onEditRoutine, onAskHeed, onMoreOptions, onShareCard, onAddTask }) {
```

- [ ] **Step 3: Add `showAllTasks` state after `dismissSwipeHint`**

Find (lines ~2721–2724):
```js
  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false)
    try { localStorage.setItem('heed.swipe-hint-seen', '1') } catch (_) {}
  }, [])
```

Replace with:
```js
  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false)
    try { localStorage.setItem('heed.swipe-hint-seen', '1') } catch (_) {}
  }, [])
  const [showAllTasks, setShowAllTasks] = useState(false)
```

- [ ] **Step 4: Replace the JSX body — "Top of mind" → "Focus today", remove old sections, add chips + expanded view**

Find (the block from `<SectionHeader motif="leaf">` through the closing `)}` of the `upcoming` section — lines ~2762–2810):
```jsx
      <SectionHeader motif="leaf">Top of mind</SectionHeader>
      {heroSet.length > 0 ? (
        heroSet.map((t, i) => (
          <div key={t.id} style={{ marginBottom: i < heroSet.length - 1 ? 12 : 0 }}>
            <HeroCard task={t} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions}/>
          </div>
        ))
      ) : (
        <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: C.shadowSoft }}>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.5, marginBottom: 8 }}>
            Nothing critical right now. Nice.
          </div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>
            {bestStreak && <>You're on a <strong style={{ color: C.sage }}>{bestStreak.count}-day</strong> streak with <strong>{bestStreak.name}</strong>. </>}
            {nextContext && nextContextDays !== null && (
              <>Next up: <strong>{nextContext.desc || nextContext.type}</strong> in {nextContextDays} day{nextContextDays === 1 ? '' : 's'}.</>
            )}
            {!bestStreak && !nextContext && <>Use this calm to plan ahead — what would you regret forgetting?</>}
          </div>
          {nextContext?.askQuery && onAskHeed && (
            <button
              onClick={() => onAskHeed(nextContext.askQuery)}
              style={{ marginTop: 12, background: C.warmDark, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Plan around {nextContext.desc || nextContext.type} →
            </button>
          )}
        </div>
      )}
      <div style={{ marginTop: 28 }}>
        <SectionHeader motif="stem" count={routines.length}>Routines</SectionHeader>
        {routines.map((r, i) => <RoutineRow key={r.id} routine={r} delay={i * 80} onMarkDone={onMarkRoutineDone} onSkipToday={onSkipRoutineToday} onLighten={onLightenRoutine}/>)}
      </div>
      {otherOverdue.length > 0 && (
        <CollapsibleTodaySection
          motif="thorn" label="Also overdue" count={otherOverdue.length}
          // Auto-collapse when there are many — keeps Today scannable on heavy days.
          defaultOpen={otherOverdue.length <= 4}
        >
          {otherOverdue.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions} showHint={i === 0 && showSwipeHint} onHintDismiss={dismissSwipeHint}/>)}
        </CollapsibleTodaySection>
      )}
      {upcoming.length > 0 && (
        <CollapsibleTodaySection
          motif="berry" label="Coming up" count={upcoming.length}
          defaultOpen={upcoming.length <= 6}
        >
          {upcoming.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions} showHint={i === 0 && showSwipeHint && otherOverdue.length === 0} onHintDismiss={dismissSwipeHint}/>)}
        </CollapsibleTodaySection>
      )}
```

Replace with:
```jsx
      <SectionHeader motif="leaf" count={focusTasks.length}>Focus today</SectionHeader>
      {focusTasks.length > 0 ? (
        focusTasks.map((t, i) => (
          <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions} showHint={i === 0 && showSwipeHint} onHintDismiss={dismissSwipeHint}/>
        ))
      ) : (
        <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: C.shadowSoft }}>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.5, marginBottom: 8 }}>
            Nothing critical right now. Nice.
          </div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>
            {bestStreak && <>You're on a <strong style={{ color: C.sage }}>{bestStreak.count}-day</strong> streak with <strong>{bestStreak.name}</strong>. </>}
            {nextContext && nextContextDays !== null && (
              <>Next up: <strong>{nextContext.desc || nextContext.type}</strong> in {nextContextDays} day{nextContextDays === 1 ? '' : 's'}.</>
            )}
            {!bestStreak && !nextContext && <>Use this calm to plan ahead — what would you regret forgetting?</>}
          </div>
          {nextContext?.askQuery && onAskHeed && (
            <button
              onClick={() => onAskHeed(nextContext.askQuery)}
              style={{ marginTop: 12, background: C.warmDark, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Plan around {nextContext.desc || nextContext.type} →
            </button>
          )}
        </div>
      )}
      <div style={{ marginTop: 28 }}>
        <SectionHeader motif="stem" count={routines.length}>Routines</SectionHeader>
        {routines.map((r, i) => <RoutineRow key={r.id} routine={r} delay={i * 80} onMarkDone={onMarkRoutineDone} onSkipToday={onSkipRoutineToday} onLighten={onLightenRoutine}/>)}
      </div>
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: C.inkMute, textAlign: 'center', marginBottom: 10, fontFamily: 'inherit' }}>Anything else?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {remainingTasks.length > 0 && (
            <button onClick={() => setShowAllTasks(t => !t)} type="button"
              style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '7px 15px', fontSize: 12.5, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
              📋 {showAllTasks ? 'Hide tasks' : 'See all tasks'}
            </button>
          )}
          {onAddTask && (
            <button onClick={onAddTask} type="button"
              style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '7px 15px', fontSize: 12.5, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add a task
            </button>
          )}
          <button onClick={() => onAskHeed && onAskHeed('')} type="button"
            style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '7px 15px', fontSize: 12.5, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✨ Ask Heed
          </button>
        </div>
      </div>
      {showAllTasks && (
        <div style={{ marginTop: 16 }}>
          {overdueRemaining.length > 0 && (
            <CollapsibleTodaySection motif="thorn" label="Also overdue" count={overdueRemaining.length} defaultOpen={overdueRemaining.length <= 4}>
              {overdueRemaining.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions} showHint={false} onHintDismiss={dismissSwipeHint}/>)}
            </CollapsibleTodaySection>
          )}
          {upcomingRemaining.length > 0 && (
            <CollapsibleTodaySection motif="berry" label="Coming up" count={upcomingRemaining.length} defaultOpen={upcomingRemaining.length <= 6}>
              {upcomingRemaining.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions} showHint={false} onHintDismiss={dismissSwipeHint}/>)}
            </CollapsibleTodaySection>
          )}
        </div>
      )}
```

- [ ] **Step 5: Verify build**

```
cd C:\Users\hmanito\Heed\web && npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 6: Commit**

```
git add web/app/page.jsx
git commit -m "feat: rewrite TodayTab with AI focus scoring and action chips"
```

---

### Task 2: Wire `onAddTask` at call site, verify, E2E test

**Files:**
- Modify: `web/app/page.jsx` — `TodayTab` call site (~line 6725)

- [ ] **Step 1: Add `onAddTask` prop at the call site**

Find (line ~6725 — the only JSX line rendering `TodayTab`):
```jsx
{tab === 'today' && <TodayTab tasks={displayTasks} routines={routines} upcomingContexts={upcomingContexts} skippedTasks={skippedTasks} onMarkDone={handleMarkDone} onSkip={handleSkip} onUnskip={handleUnskip} onMarkRoutineDone={handleMarkRoutineDone} onSkipRoutineToday={handleSkipRoutineToday} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAskHeed={handleAskHeed} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen}/>}
```

Replace with:
```jsx
{tab === 'today' && <TodayTab tasks={displayTasks} routines={routines} upcomingContexts={upcomingContexts} skippedTasks={skippedTasks} onMarkDone={handleMarkDone} onSkip={handleSkip} onUnskip={handleUnskip} onMarkRoutineDone={handleMarkRoutineDone} onSkipRoutineToday={handleSkipRoutineToday} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAskHeed={handleAskHeed} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen} onAddTask={() => setModalOpen(true)}/>}
```

`setModalOpen` is already defined in `HeedApp` — it controls the Add Task modal.

- [ ] **Step 2: Verify build**

```
cd C:\Users\hmanito\Heed\web && npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: E2E browser test**

Start dev server:
```
cd C:\Users\hmanito\Heed\web && npm run dev
```

Open `http://localhost:3000` and verify:

1. Today tab opens → shows **"Focus today"** header with count badge and up to 3 task cards
2. Routines section still shows below focus tasks (unchanged)
3. **"Anything else?"** label and 3 chips appear below routines
4. **"📋 See all tasks"** chip only appears when there are more than 3 tasks total
5. Tap "See all tasks" → "Also overdue" and/or "Coming up" sections expand inline below chips; chip label changes to "Hide tasks"
6. Tap "Hide tasks" → expanded sections collapse
7. Tap **"+ Add a task"** → Add Task modal opens
8. Tap **"✨ Ask Heed"** → switches to Ask tab
9. Tasks with a category matching an active context (e.g. "travel" task when a travel context is active) appear in the focus 3 even if not the most overdue
10. With TASKS_DEMO data (no API), verify focus shows the 3 highest-scored demo tasks

- [ ] **Step 4: Commit**

```
git add web/app/page.jsx
git commit -m "feat: wire onAddTask to TodayTab call site"
```
