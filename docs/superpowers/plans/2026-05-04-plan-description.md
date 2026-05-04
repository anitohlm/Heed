# Plan Description Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional description field to plans so users can record the purpose of each plan, visible on the plan card and in the detail screen header, editable via the edit panel.

**Architecture:** Single file change — `web/app/page.jsx`. Three components touched: `AddPlanSheet` (creation), `PlanCard` (card display), `PlanDetailScreen` (header display + edit panel). No new components. `updatePlan` in `usePlans` already passes through any non-`tasks` field — no changes needed there.

**Tech Stack:** React 18, Next.js 14, inline styles, existing `useState`/`useCallback` patterns

**Note on testing:** No frontend test infrastructure exists. Each task verifies visually by checking the dev server (run `npm run dev` inside `web/`).

---

## File Map

- Modify only: `web/app/page.jsx`
  - Lines ~4022–4165 — `AddPlanSheet`: state + form field + handleSubmit + reset
  - Lines ~3561–3563 — `PlanCard`: description line after title
  - Lines ~3752–3761 — `PlanDetailScreen` header: description under title
  - Lines ~3716–3744 — `PlanDetailScreen` edit panel: editDraft init + textarea + save

---

## Task 1: AddPlanSheet — description state, field, and submission

**Files:**
- Modify: `web/app/page.jsx`

- [ ] **Step 1: Add `description` state**

Find (line ~4032):
```js
  const [suggestDismissed, setSuggestDismissed] = useState(false)
```

Replace with:
```js
  const [description, setDescription] = useState('')
  const [suggestDismissed, setSuggestDismissed] = useState(false)
```

- [ ] **Step 2: Add the description textarea after the Name field**

Find (line ~4198):
```jsx
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} placeholder="e.g. Move apartments" value={title} onChange={e => setTitle(e.target.value)} autoFocus/>

            {type === 'project' && (
```

Replace with:
```jsx
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} placeholder="e.g. Move apartments" value={title} onChange={e => setTitle(e.target.value)} autoFocus/>

            <label style={labelStyle}>Description <span style={{ fontWeight: 400, color: C.inkMute }}>(optional)</span></label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="What's this plan for?" value={description} onChange={e => setDescription(e.target.value)}/>

            {type === 'project' && (
```

- [ ] **Step 3: Include `description` in the plan object created by `handleSubmit`**

Find (line ~4158):
```js
    const plan = { id: `plan-${Date.now()}`, type, icon: planType.icon, title: title.trim() }
```

Replace with:
```js
    const plan = { id: `plan-${Date.now()}`, type, icon: planType.icon, title: title.trim(), description: description.trim() }
```

- [ ] **Step 4: Reset `description` after submission**

Find (line ~4161 — the reset line after `onAdd(plan)`):
```js
    setStep('pick'); setType(null); setTitle(''); setDueDate(''); setTasksText(''); setTargetAmt(''); setUnit('₱'); setTargetDate(''); setEventDate(''); setGoalKind('milestone')
```

Replace with:
```js
    setStep('pick'); setType(null); setTitle(''); setDescription(''); setDueDate(''); setTasksText(''); setTargetAmt(''); setUnit('₱'); setTargetDate(''); setEventDate(''); setGoalKind('milestone')
```

- [ ] **Step 5: Verify in browser**

With the dev server running, open the Plans tab, tap + to create a plan, pick any type. Confirm:
- "Description (optional)" textarea appears directly below the Name field
- Typing in it works
- Submitting creates the plan (description will be used in Tasks 2 and 3)

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add description field to plan creation form"
```

---

## Task 2: PlanCard — show description under title

**Files:**
- Modify: `web/app/page.jsx`

- [ ] **Step 1: Add description line to `PlanCard`**

Find (line ~3561):
```jsx
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.title}</div>
          <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>{subtitle}</div>
        </div>
```

Replace with:
```jsx
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.title}</div>
          {plan.description ? (
            <div style={{ fontSize: 11.5, color: C.inkSoft, fontStyle: 'italic', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{plan.description}</div>
          ) : null}
          <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>{subtitle}</div>
        </div>
```

- [ ] **Step 2: Verify in browser**

Create a plan with a description. Return to the Plans tab list view. Confirm:
- Description appears as one italic truncated line under the plan title
- Plans without a description show nothing (existing plans are unaffected)

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: show plan description on plan card"
```

---

## Task 3: PlanDetailScreen — description in header + edit panel

**Files:**
- Modify: `web/app/page.jsx`

- [ ] **Step 1: Show description under the title in the detail header**

Find (line ~3752):
```jsx
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>{plan.icon}</span>
        <span style={{ flex: 1, fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, color: C.warmDark, letterSpacing: -0.2 }}>{plan.title}</span>
        <button
          onClick={editingPlan ? cancelEditPlan : openEditPlan}
          aria-label={editingPlan ? 'Cancel edit' : 'Edit plan'}
          style={{ background: 'none', border: `1px solid ${C.border}`, color: C.warmDark, fontSize: 18, fontWeight: 400, cursor: 'pointer', padding: '2px 10px', fontFamily: 'inherit', lineHeight: 1, borderRadius: 999 }}>
          {editingPlan ? '✕' : '⋯'}
        </button>
      </div>
```

Replace with:
```jsx
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: plan.description && !editingPlan ? 6 : 14 }}>
        <span style={{ fontSize: 20 }}>{plan.icon}</span>
        <span style={{ flex: 1, fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, color: C.warmDark, letterSpacing: -0.2 }}>{plan.title}</span>
        <button
          onClick={editingPlan ? cancelEditPlan : openEditPlan}
          aria-label={editingPlan ? 'Cancel edit' : 'Edit plan'}
          style={{ background: 'none', border: `1px solid ${C.border}`, color: C.warmDark, fontSize: 18, fontWeight: 400, cursor: 'pointer', padding: '2px 10px', fontFamily: 'inherit', lineHeight: 1, borderRadius: 999 }}>
          {editingPlan ? '✕' : '⋯'}
        </button>
      </div>
      {plan.description && !editingPlan && (
        <div style={{ fontSize: 13, color: C.inkSoft, fontStyle: 'italic', marginBottom: 14, lineHeight: 1.5, paddingLeft: 2 }}>
          {plan.description}
        </div>
      )}
```

- [ ] **Step 2: Initialize `description` in `openEditPlan`**

Find (line ~3717):
```js
    setEditDraft({
      icon: plan.icon,
      title: plan.title,
      date: plan.type === 'project' ? (plan.dueDate ?? '') : formatEventDate(plan.eventDate),
    })
```

Replace with:
```js
    setEditDraft({
      icon: plan.icon,
      title: plan.title,
      date: plan.type === 'project' ? (plan.dueDate ?? '') : formatEventDate(plan.eventDate),
      description: plan.description ?? '',
    })
```

- [ ] **Step 3: Add description textarea to the edit panel**

Find (line ~3792):
```jsx
              style={{ flex: 1, fontSize: 13, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', color: C.ink }}
            />
          </div>
          {/* Tasks editor — single edit-all flow */}
```

Replace with:
```jsx
              style={{ flex: 1, fontSize: 13, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', color: C.ink }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.inkMute }}>Description <span style={{ fontWeight: 400 }}>(optional)</span></span>
            <textarea
              value={editDraft.description}
              onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="What's this plan for?"
              rows={2}
              style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 13, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', color: C.ink, resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {/* Tasks editor — single edit-all flow */}
```

- [ ] **Step 4: Save description in `saveEditPlan`**

Find (line ~3728):
```js
    const updates = {
      icon: editDraft.icon.trim() || plan.icon,
      title: editDraft.title.trim() || plan.title,
    }
```

Replace with:
```js
    const updates = {
      icon: editDraft.icon.trim() || plan.icon,
      title: editDraft.title.trim() || plan.title,
      description: editDraft.description.trim(),
    }
```

- [ ] **Step 5: Verify in browser**

Open the plan created in Task 1. Confirm:
- Description appears in italic under the title in normal view
- Tapping ⋯ opens the edit panel with the description field pre-filled
- Editing the description and saving updates it (visible in normal view and on the card)
- Plans without a description show nothing

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: show and edit plan description in detail screen"
```
