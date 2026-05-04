# Done Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a satisfying green-flash + checkmark + slide-out animation whenever tasks, routines, or plan task checkboxes are marked done.

**Architecture:** Each of the three components (`TaskCard`, `RoutineRow`, `PlanDetailScreen`) gets a local animation state. Done actions trigger animation first, wait for it to complete, then fire the real callback. Three CSS keyframes are added to the global `<style>` block in `HeedApp`.

**Tech Stack:** React 18, Next.js 14, CSS keyframes, inline styles, `useCallback`

**Note on testing:** This codebase has no frontend test infrastructure — backend Python tests are in `tests/` but they don't cover JSX. Each task uses visual verification via `npm run dev` instead of automated tests.

---

## File Map

- Modify: `web/app/page.jsx`
  - Line 6696 — add 3 keyframes to `<style>` block
  - Lines 1948–2023 — `TaskCard` component
  - Lines 2216–2275 — `RoutineRow` component
  - Lines 3160–3180 — `PlanDetailScreen` state declarations
  - Lines 3456–3462 — `PlanDetailScreen` checkbox element

---

## Task 1: Keyframes + TaskCard animation

**Files:**
- Modify: `web/app/page.jsx`

- [ ] **Step 1: Add three keyframes after the existing `heed-breathe` keyframe (line 6696)**

Find this exact line:
```
        @keyframes heed-breathe { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:0.85; transform:scale(1.05); } }
```

Replace with:
```
        @keyframes heed-breathe { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:0.85; transform:scale(1.05); } }
        @keyframes heed-done-flash { from {} to { background: #e8f5ee; } }
        @keyframes heed-done-check { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes heed-done-out { 0% { transform: translateX(0); opacity: 1; max-height: 120px; margin-bottom: 10px; } 50% { transform: translateX(14px); opacity: 0.4; } 100% { transform: translateX(80px); opacity: 0; max-height: 0; margin-bottom: 0; } }
```

- [ ] **Step 2: Add `completing` state and `handleDone` to `TaskCard`**

In `TaskCard` (line ~1948), find:
```js
  const [hover, setHover] = useState(false)
  const { ref: swipeRef } = useSwipe(
    () => onMarkDone?.(task),
    () => onSkip?.(task),
  )
```

Replace with:
```js
  const [hover, setHover] = useState(false)
  const [completing, setCompleting] = useState(false)
  const handleDone = useCallback(() => {
    if (completing) return
    setCompleting(true)
    setTimeout(() => onMarkDone?.(task), 600)
  }, [completing, onMarkDone, task])
  const { ref: swipeRef } = useSwipe(handleDone, () => onSkip?.(task))
```

- [ ] **Step 3: Wire `handleDone` to the "Mark done" button**

Find (line ~2013):
```jsx
            <button style={getBtnPrimary()} onClick={() => onMarkDone?.(task)}>Mark done</button>
```

Replace with:
```jsx
            <button style={getBtnPrimary()} onClick={handleDone}>Mark done</button>
```

- [ ] **Step 4: Add slide-out animation to the TaskCard outer wrapper div**

Find (line ~1962):
```jsx
    <div style={{ position: 'relative', marginBottom: 10, touchAction: 'pan-y', userSelect: 'none' }}>
```

Replace with:
```jsx
    <div style={{
      position: 'relative',
      touchAction: 'pan-y',
      userSelect: 'none',
      ...(completing ? {
        animation: 'heed-done-out 0.38s cubic-bezier(0.4,0,0.8,0.2) 0.22s forwards',
        overflow: 'hidden',
      } : { marginBottom: 10 }),
    }}>
```

- [ ] **Step 5: Add green flash to the inner card div (swipeRef)**

Find (line ~1977):
```jsx
        style={{
          background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
          border: `1.5px solid ${isCritical ? C.rust + '44' : C.border}`,
          borderRadius: 12, padding: '14px 16px 14px 20px',
          boxShadow: hover ? C.shadowMed : C.shadowSoft,
          position: 'relative',
          animation: 'heed-fadeUp 0.5s ease both',
          animationDelay: `${delay}ms`,
        }}
```

Replace with:
```jsx
        style={{
          background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
          border: `1.5px solid ${isCritical ? C.rust + '44' : C.border}`,
          borderRadius: 12, padding: '14px 16px 14px 20px',
          boxShadow: hover ? C.shadowMed : C.shadowSoft,
          position: 'relative',
          animation: completing ? 'heed-done-flash 0.22s ease forwards' : 'heed-fadeUp 0.5s ease both',
          animationDelay: completing ? undefined : `${delay}ms`,
        }}
```

- [ ] **Step 6: Add the animated checkmark element inside the inner card div**

Find (line ~1988):
```jsx
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isCritical ? C.rust : c.color, borderRadius: '3px 0 0 3px' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
```

Replace with:
```jsx
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isCritical ? C.rust : c.color, borderRadius: '3px 0 0 3px' }}/>
        {completing && (
          <div style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: '#4a7c59',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'heed-done-check 0.22s ease forwards',
            zIndex: 2,
          }}>
            <span style={{ color: 'white', fontSize: 13, lineHeight: 1 }}>✓</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
```

- [ ] **Step 7: Start dev server and verify TaskCard animation**

Run: `npm run dev` in `web/` (or confirm it is already running on http://localhost:3000).

Open the Today tab. Hover a task card and click "Mark done". Confirm:
- Card flashes green immediately
- Green circle checkmark pops in on the left
- After ~220ms the card slides right and collapses
- After ~600ms the card disappears from the list

Also swipe a task card to the right and confirm the same animation plays.

- [ ] **Step 8: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add done animation to TaskCard and CSS keyframes"
```

---

## Task 2: RoutineRow animation

**Files:**
- Modify: `web/app/page.jsx`

- [ ] **Step 1: Add `justDone` state and `handleDone` to `RoutineRow`**

Find (line ~2222):
```js
  const borderColor = isLightened ? `${C.sage}73` : isAttention ? `${C.ochre}73` : C.border
  const { ref: swipeRef } = useSwipe(
    () => onMarkDone?.(routine.id),
    () => onSkipToday?.(routine.id),
  )
```

Replace with:
```js
  const borderColor = isLightened ? `${C.sage}73` : isAttention ? `${C.ochre}73` : C.border
  const [justDone, setJustDone] = useState(false)
  const handleDone = useCallback(() => {
    if (justDone) return
    setJustDone(true)
    setTimeout(() => {
      onMarkDone?.(routine.id)
      setJustDone(false)
    }, 450)
  }, [justDone, onMarkDone, routine.id])
  const { ref: swipeRef } = useSwipe(handleDone, () => onSkipToday?.(routine.id))
```

- [ ] **Step 2: Add `position: 'relative'` and green flash to the RoutineRow inner card div**

Find (line ~2233):
```jsx
      <div
        ref={swipeRef}
        className="heed-card"
        style={{
          background: C.paperHi,
          border: `1px solid ${borderColor}`,
          borderRadius: 10,
          padding: '11px 14px',
          animation: 'heed-fadeUp 0.5s ease both',
          animationDelay: `${delay}ms`,
        }}
      >
```

Replace with:
```jsx
      <div
        ref={swipeRef}
        className="heed-card"
        style={{
          background: C.paperHi,
          border: `1px solid ${borderColor}`,
          borderRadius: 10,
          padding: '11px 14px',
          position: 'relative',
          animation: justDone ? 'heed-done-flash 0.22s ease forwards' : 'heed-fadeUp 0.5s ease both',
          animationDelay: justDone ? undefined : `${delay}ms`,
        }}
      >
```

- [ ] **Step 3: Add animated checkmark element inside the RoutineRow inner div**

Find (line ~2245):
```jsx
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.ink }}>{routine.name}</span>
```

Replace with:
```jsx
        {justDone && (
          <div style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: '#4a7c59',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'heed-done-check 0.22s ease forwards',
            zIndex: 2,
          }}>
            <span style={{ color: 'white', fontSize: 13, lineHeight: 1 }}>✓</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.ink }}>{routine.name}</span>
```

- [ ] **Step 4: Verify RoutineRow animation in browser**

Swipe a routine row to the right (or trigger via the Routines tab). Confirm:
- Card flashes green
- Green circle checkmark pops in on the left
- After ~450ms the card returns to normal (no slide-out — routine rows stay)
- The routine's completion dot updates after the animation

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add done animation to RoutineRow"
```

---

## Task 3: PlanDetailScreen checkbox animation

**Files:**
- Modify: `web/app/page.jsx`

- [ ] **Step 1: Add `completingIdx` state to `PlanDetailScreen`**

Find (line ~3180):
```js
  const [editDropIndex, setEditDropIndex] = useState(null)
```

Replace with:
```js
  const [editDropIndex, setEditDropIndex] = useState(null)
  const [completingIdx, setCompletingIdx] = useState(null)
```

- [ ] **Step 2: Replace the checkbox `onClick` handler**

Find (line ~3458):
```jsx
                  onClick={() => { setSwipedIndex(null); setEditingIndex(null); onCheck(plan.id, i) }}
```

Replace with:
```jsx
                  onClick={() => {
                    if (completingIdx === i || task.done) return
                    setSwipedIndex(null)
                    setEditingIndex(null)
                    setCompletingIdx(i)
                    setTimeout(() => {
                      onCheck(plan.id, i)
                      setCompletingIdx(null)
                    }, 350)
                  }}
```

- [ ] **Step 3: Replace the checkbox `div` style**

Find (line ~3459):
```jsx
                  style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer', border: `1.5px solid ${task.done ? C.rust : C.border}`, background: task.done ? C.rust : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
```

Replace with:
```jsx
                  style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                    border: `1.5px solid ${(task.done || completingIdx === i) ? C.rust : C.border}`,
                    background: completingIdx === i ? '#4a7c59' : (task.done ? C.rust : 'transparent'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...(completingIdx === i ? { animation: 'heed-done-check 0.22s ease forwards' } : {}),
                  }}
```

- [ ] **Step 4: Update the checkmark render condition**

Find (line ~3461):
```jsx
                  {task.done && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
```

Replace with:
```jsx
                  {(task.done || completingIdx === i) && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
```

- [ ] **Step 5: Verify PlanDetailScreen checkbox animation in browser**

Open a plan in the Plans tab. Click an unchecked task checkbox. Confirm:
- Checkbox turns dark green and the ✓ scales in with a pop animation
- After ~350ms the task row updates to strikethrough + rust-colored checked state

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add done animation to PlanDetailScreen checkbox"
```
