# Done Animation Design

**Goal:** When tasks, routines, or plan task checkboxes are marked done, play a satisfying completion animation before the state change takes effect.

**Architecture:** Each of the three components (`TaskCard`, `RoutineRow`, `PlanDetailScreen`) gets a local animation state. Done actions trigger the animation state first, wait for the animation to complete, then fire the actual callback. Three new CSS keyframes are added to the global `<style>` block.

**Tech Stack:** React 18, Next.js 14, CSS keyframes, inline styles (existing pattern)

---

## 1. Animation Sequence

### Tasks (`TaskCard`)

Total duration: **600ms**

1. **0–220ms** — card background flips to `#e8f5ee` (soft green); a green circle checkmark appears on the left edge of the card with a pop-in animation
2. **220–600ms** — the card slides right and collapses (height → 0, margin → 0)
3. At 600ms — `onMarkDone(task)` fires; item is removed from the list by the parent

### Routines (`RoutineRow`)

Total duration: **450ms**

1. **0–220ms** — card background flips to `#e8f5ee`; green circle checkmark appears on the left with pop-in
2. **220–450ms** — card background fades back to normal (`C.paperHi`)
3. At 450ms — `onMarkDone(routine.id)` fires; row stays, completion dot updates

### Plan task checkboxes (`PlanDetailScreen`)

Total duration: **350ms**

1. **0–220ms** — checkbox `div` background flips to `#4a7c59` (green); ✓ icon scales in
2. **220–350ms** — brief hold
3. At 350ms — `onCheck(plan.id, i)` fires; row stays with strikethrough + checked state

---

## 2. CSS Keyframes

Add three keyframes to the `<style>` block in `HeedApp` alongside the existing `heed-*` keyframes:

```css
@keyframes heed-done-flash { from {} to { background: #e8f5ee; } }
@keyframes heed-done-check { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes heed-done-out { 0% { transform: translateX(0); opacity: 1; max-height: 120px; margin-bottom: 10px; } 50% { transform: translateX(14px); opacity: 0.4; } 100% { transform: translateX(80px); opacity: 0; max-height: 0; margin-bottom: 0; } }
```

---

## 3. `TaskCard` Changes (`web/app/page.jsx` ~line 1948)

### New state

```js
const [completing, setCompleting] = useState(false)
```

### New `handleDone` function (replaces direct `onMarkDone` call)

```js
const handleDone = useCallback(() => {
  if (completing) return
  setCompleting(true)
  setTimeout(() => onMarkDone?.(task), 600)
}, [completing, onMarkDone, task])
```

### Wire `handleDone` to swipe and button

Replace:
```js
const { ref: swipeRef } = useSwipe(
  () => onMarkDone?.(task),
  () => onSkip?.(task),
)
```
With:
```js
const { ref: swipeRef } = useSwipe(handleDone, () => onSkip?.(task))
```

Also replace any direct `onMarkDone?.(task)` call in the "Mark done" button `onClick` with `handleDone()`.

### Outer wrapper — slide-out animation when completing

The outermost `<div>` (the one with `position: 'relative', marginBottom: 10`) gets the slide-out animation:

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

### Inner card — green flash when completing

The `div` with `ref={swipeRef}` (the visible card) gets a green background when `completing`:

```jsx
style={{
  ...existingStyles,
  ...(completing ? { animation: 'heed-done-flash 0.22s ease forwards' } : {}),
}}
```

### Checkmark element — appears inside card on the left when completing

Add immediately before the card's main content row (the `div` with `display:'flex', alignItems:'center'`):

```jsx
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
```

Note: The `div` with `ref={swipeRef}` must have `position: 'relative'` added to its style so the absolute checkmark is positioned correctly within it. Add `position: 'relative'` to that div's existing inline style object.

---

## 4. `RoutineRow` Changes (`web/app/page.jsx` ~line 2216)

### New state

```js
const [justDone, setJustDone] = useState(false)
```

### New `handleDone` function

```js
const handleDone = useCallback(() => {
  if (justDone) return
  setJustDone(true)
  setTimeout(() => {
    onMarkDone?.(routine.id)
    setJustDone(false)
  }, 450)
}, [justDone, onMarkDone, routine.id])
```

### Wire to swipe

Replace:
```js
const { ref: swipeRef } = useSwipe(
  () => onMarkDone?.(routine.id),
  () => onSkipToday?.(routine.id),
)
```
With:
```js
const { ref: swipeRef } = useSwipe(handleDone, () => onSkipToday?.(routine.id))
```

### Inner card — green flash and checkmark when `justDone`

Add `animation: 'heed-done-flash 0.22s ease forwards'` to the inner card div style when `justDone`.

Add the same checkmark element as TaskCard (position: absolute, left: 14) inside the card when `justDone`.

No slide-out animation — the row stays.

---

## 5. `PlanDetailScreen` Changes (`web/app/page.jsx` ~line 3160)

### New state

```js
const [completingIdx, setCompletingIdx] = useState(null)
```

### Checkbox click handler

Replace (line ~3458):
```jsx
onClick={() => { setSwipedIndex(null); setEditingIndex(null); onCheck(plan.id, i) }}
```
With:
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

### Checkbox style when `completingIdx === i`

When `completingIdx === i`, override the checkbox `div` style to show the animated green state:

```jsx
style={{
  width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
  border: `1.5px solid ${(task.done || completingIdx === i) ? C.rust : C.border}`,
  background: completingIdx === i ? '#4a7c59' : (task.done ? C.rust : 'transparent'),
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  ...(completingIdx === i ? { animation: 'heed-done-check 0.22s ease forwards' } : {}),
}}
```

The ✓ inside the checkbox:
```jsx
{(task.done || completingIdx === i) && (
  <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>
)}
```

---

## 6. What Doesn't Change

- `handleMarkDone` in `HeedApp` — unchanged; fires after the animation delay
- `handleMarkRoutineDone` in `HeedApp` — unchanged
- `checkTask` in `PlansTab`/`HeedApp` — unchanged
- Swipe gesture visual feedback (drag badges) — unchanged; the swipe badges still show during drag
- Toast notifications — unchanged; still appear after `onMarkDone` fires
- The `prefers-reduced-motion` CSS media query is not currently used elsewhere in this codebase, so it is not added here (consistent with existing pattern)
