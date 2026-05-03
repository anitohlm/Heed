# Unified Importance System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all ad-hoc importance styling across the app with a single `ImportanceBadge` component (bold filled, icon + label, consistent font-weight scale) shown on every task card and in the calendar legend, and update the Add Task modal selector to match.

**Architecture:** One new component (`ImportanceBadge`) inserted in `web/app/page.jsx` after the existing `Pill` component. Four call sites updated: `HeroCard`, `TaskCard`, `AddTaskModal`, and the calendar legend. No backend or data model changes.

**Tech Stack:** React (JSX), inline styles, theme tokens from `C` proxy, SVG icons inline.

---

## File Map

- Modify only: `web/app/page.jsx`
  - Add `ImportanceBadge` component after line 650 (after `Pill`)
  - Update `HeroCard` line 990: replace `<Pill tone="danger">high</Pill>` guard
  - Update `TaskCard` line 1070: same replacement
  - Update `AddTaskModal` lines 1827–1830: replace importance selector buttons
  - Update calendar legend lines 1613–1633: replace soft chips with `ImportanceBadge`

---

### Task 1: Add `ImportanceBadge` component

**Files:**
- Modify: `web/app/page.jsx:650` (insert after the closing `}` of `Pill`)

- [ ] **Step 1: Open `web/app/page.jsx` and locate the end of the `Pill` component**

The `Pill` component ends at line 650 with a closing `}`. The line immediately after is blank, then `function CategoryBadge`.

- [ ] **Step 2: Insert `ImportanceBadge` between `Pill` and `CategoryBadge`**

Add the following block after line 650:

```jsx
function ImportanceBadge({ importance }) {
  const cfg = {
    low:    { bg: C.sage,  weight: 400, shadow: 'none' },
    medium: { bg: C.ochre, weight: 500, shadow: 'none' },
    high:   { bg: C.rust,  weight: 700, shadow: `0 2px 8px ${C.rust}40` },
  }
  const { bg, weight, shadow } = cfg[importance] || cfg.medium
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg, color: C.cream,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 11.5, fontWeight: weight, letterSpacing: 0.1,
      boxShadow: shadow, flexShrink: 0,
    }}>
      {importance === 'low' && (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <circle cx="4" cy="4" r="3" fill="none" stroke={C.cream} strokeWidth="1.5"/>
        </svg>
      )}
      {importance === 'medium' && (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <polygon points="4,0.5 7.5,4 4,7.5 0.5,4" fill={C.cream}/>
        </svg>
      )}
      {importance === 'high' && (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <circle cx="4" cy="4" r="3.5" fill={C.cream}/>
        </svg>
      )}
      {importance.charAt(0).toUpperCase() + importance.slice(1)}
    </span>
  )
}
```

- [ ] **Step 3: Verify the dev server (localhost:3001) still renders without errors**

The component is not used yet, so nothing visible changes. Check the browser console for syntax errors.

---

### Task 2: Update `HeroCard` and `TaskCard`

**Files:**
- Modify: `web/app/page.jsx:990` (HeroCard)
- Modify: `web/app/page.jsx:1070` (TaskCard)

Both currently read:
```jsx
{task.importance === 'high' && <Pill tone="danger">high</Pill>}
```

- [ ] **Step 1: Replace the importance line in `HeroCard` (line ~990)**

Find this exact block in `HeroCard` (inside the flex row with `task.name` and `task.learned`):

```jsx
{task.importance === 'high' && <Pill tone="danger">high</Pill>}
```

Replace with:

```jsx
{task.importance && <ImportanceBadge importance={task.importance}/>}
```

- [ ] **Step 2: Replace the importance line in `TaskCard` (line ~1070)**

Find the same pattern in `TaskCard`:

```jsx
{task.importance === 'high' && <Pill tone="danger">high</Pill>}
```

Replace with:

```jsx
{task.importance && <ImportanceBadge importance={task.importance}/>}
```

- [ ] **Step 3: Verify in the browser**

Open localhost:3001 and check the Today tab. Every task card should now show a colored badge — sage for Low, ochre for Medium, rust for High. Previously only High showed anything.

Expected appearance:
- Low: green filled pill, ○ ring icon, weight 400
- Medium: amber filled pill, ◆ diamond icon, weight 500
- High: rust filled pill, ● circle icon, weight 700, subtle shadow

- [ ] **Step 4: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add ImportanceBadge component and show on all task cards"
```

---

### Task 3: Update `AddTaskModal` importance selector

**Files:**
- Modify: `web/app/page.jsx:1827–1830` (the importance button row in `AddTaskModal`)

Current code (lines 1827–1830):
```jsx
<div style={{ display: 'flex', gap: 6 }}>
  {[{v:'low',label:'Low',tone:C.sage},{v:'medium',label:'Medium',tone:C.ochre},{v:'high',label:'High',tone:C.rust}].map(({v,label,tone}) => (
    <button key={v} onClick={() => setImportance(v)} style={{ flex: 1, background: importance === v ? tone : C.paper, color: importance === v ? C.cream : C.inkSoft, border: `1.5px solid ${importance === v ? tone : C.border}`, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>{label}</button>
  ))}
</div>
```

- [ ] **Step 1: Replace the importance selector block**

Replace the entire `<div style={{ display: 'flex', gap: 6 }}>...</div>` block (the one containing the three importance buttons) with:

```jsx
<div style={{ display: 'flex', gap: 8 }}>
  {[
    { v: 'low',    tone: C.sage  },
    { v: 'medium', tone: C.ochre },
    { v: 'high',   tone: C.rust  },
  ].map(({ v, tone }) => (
    <button key={v} onClick={() => setImportance(v)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        background: tone, color: C.cream,
        padding: '11px 8px', borderRadius: 10, minHeight: 44,
        fontSize: 13,
        fontWeight: v === 'high' ? 700 : v === 'medium' ? 500 : 400,
        border: importance === v ? `2.5px solid ${C.cream}` : '2.5px solid transparent',
        boxShadow: importance === v
          ? (v === 'high' ? `0 0 0 2px ${tone}, 0 3px 10px ${tone}50` : `0 0 0 2px ${tone}`)
          : 'none',
        opacity: importance === v ? 1 : 0.5,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
      }}>
      {v === 'low' && (
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" fill="none" stroke={C.cream} strokeWidth="2"/>
        </svg>
      )}
      {v === 'medium' && (
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
          <polygon points="6.5,1.5 11.5,6.5 6.5,11.5 1.5,6.5" fill={C.cream}/>
        </svg>
      )}
      {v === 'high' && (
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5.5" fill={C.cream}/>
        </svg>
      )}
      {v.charAt(0).toUpperCase() + v.slice(1)}
    </button>
  ))}
</div>
```

- [ ] **Step 2: Verify in the browser**

Open the Add Task modal (FAB → "Add a task"). The importance row should show three always-filled colored buttons. The selected one (Medium by default) has a white border ring and full opacity; the other two are dimmed to 50%.

Tap each button to confirm:
- Selection ring moves to the tapped button
- Dimmed buttons sharpen to full opacity when selected
- All three buttons are at least 44px tall

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: update AddTaskModal importance selector to bold filled buttons"
```

---

### Task 4: Update calendar legend + build + push

**Files:**
- Modify: `web/app/page.jsx` (calendar legend block)

Current legend block (around lines 1613–1633):
```jsx
<div style={{ marginTop: 16, padding: '12px 16px', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: C.shadowSoft }}>
  <div style={{ fontSize: 10.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Legend</div>
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {[
      { color: C.rust,  bg: C.rustSoft,  label: 'Urgent',    shape: 'circle'  },
      { color: C.ochre, bg: C.ochreSoft, label: 'Important',  shape: 'diamond' },
      { color: C.sage,  bg: C.sageSoft,  label: 'Routine',    shape: 'ring'    },
    ].map(({ color, bg, label, shape }) => (
      <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6, background: bg, border: `1.5px solid ${color}66`, padding: '5px 11px' }}>
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true" style={{ flexShrink: 0 }}>
          {shape === 'circle'  && <circle cx="6.5" cy="6.5" r="5" fill={color}/>}
          {shape === 'diamond' && <polygon points="6.5,1.5 11.5,6.5 6.5,11.5 1.5,6.5" fill={color}/>}
          {shape === 'ring'    && <circle cx="6.5" cy="6.5" r="4" fill="none" stroke={color} strokeWidth="2.5"/>}
        </svg>
        <span style={{ fontSize: 12, color, fontWeight: 600 }}>{label}</span>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 1: Replace the legend chips with `ImportanceBadge`**

Replace the entire legend `<div>` block above with:

```jsx
<div style={{ marginTop: 16, padding: '12px 16px', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: C.shadowSoft }}>
  <div style={{ fontSize: 10.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Legend</div>
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <ImportanceBadge importance="low"/>
    <ImportanceBadge importance="medium"/>
    <ImportanceBadge importance="high"/>
  </div>
</div>
```

- [ ] **Step 2: Verify in the browser**

Open the Calendar tab. The legend should show three bold-filled pills — sage Low, ochre Medium, rust High — matching the exact same badge that appears on task cards.

- [ ] **Step 3: Build the static export**

```powershell
cd web
npm run build
```

Expected: build completes with no errors, `web/out/` updated.

- [ ] **Step 4: Commit everything and push**

```bash
git add web/app/page.jsx web/out
git commit -m "feat: unify calendar legend and complete importance system"
git push
```
