# Context Tab Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quick-add context chips, an active-context card with "I'm better now" / "Extend 2 days" actions, and a recovery summary sheet to the Context tab.

**Architecture:** All new UI lives in `web/app/page.jsx`. No new API endpoints. `activeContext` state is managed locally in `HeedApp`. Six tasks: constants → state/handlers → three new component definitions → wire everything together.

**Tech Stack:** React 18, Next.js 14, inline styles, existing `C.*` design tokens, `getBtnPrimary()` / `getBtnGhost()` style helpers.

---

## File map

| File | Change |
|---|---|
| `web/app/page.jsx:57-61` | Add `QUICK_CONTEXT_CONFIG`; add `skipped` to `CONTEXTS_PAST` rows |
| `web/app/page.jsx:2334` | Add three new state vars to HeedApp |
| `web/app/page.jsx:2480-2492` | Add three new handlers to HeedApp |
| `web/app/page.jsx:2307` | Insert `QuickContextSheet` component (before HeedApp) |
| `web/app/page.jsx:2307` | Insert `ActiveContextCard` component (before HeedApp) |
| `web/app/page.jsx:2307` | Insert `RecoverySummarySheet` component (before HeedApp) |
| `web/app/page.jsx:1638-1678` | Update `ContextRow` (skipped count) + `ContextTab` (chips + active card) |
| `web/app/page.jsx:2556,2567-2568` | Wire new props/sheets in HeedApp render |

---

## Task 1: Add QUICK_CONTEXT_CONFIG constant and skipped counts to CONTEXTS_PAST

**Files:**
- Modify: `web/app/page.jsx:57-61`

- [ ] **Step 1: Add `QUICK_CONTEXT_CONFIG` after the closing of the existing `CATEGORY` block (around line 36) and update `CONTEXTS_PAST`**

In `web/app/page.jsx`, insert the following constant immediately before the `ROUTINES` declaration (around line 39):

```js
const QUICK_CONTEXT_CONFIG = {
  sick:        { label: 'Sick — rest mode',          icon: '🌿', defaultDays: 2, question: 'How long are you sick?',           activateLabel: 'Activate rest mode',        toastMsg: 'Rest mode activated — Heed is holding your tasks' },
  busy:        { label: 'Busy week',                 icon: '🌾', defaultDays: 5, question: 'How long is your busy period?',    activateLabel: 'Activate busy mode',        toastMsg: 'Busy mode activated — Heed is holding your tasks' },
  travel:      { label: 'Traveling',                 icon: '✈️', defaultDays: 7, question: 'How many days are you traveling?', activateLabel: 'Activate travel mode',      toastMsg: 'Travel mode activated — Heed is holding your tasks' },
  celebration: { label: 'Celebration',               icon: '🌸', defaultDays: 1, question: 'How long is the celebration?',     activateLabel: 'Activate celebration mode', toastMsg: 'Celebration mode activated — Heed is holding your tasks' },
}
```

Replace the existing `CONTEXTS_PAST` (lines 57-61) with:

```js
const CONTEXTS_PAST = [
  { type: 'travel',  start: 'Dec 20, 2025', end: 'Dec 27, 2025', desc: 'Christmas trip to Baguio', skipped: 9 },
  { type: 'illness', start: 'Feb 10, 2026', end: 'Feb 14, 2026', desc: 'Flu — bed rest',            skipped: 12 },
  { type: 'busy',    start: 'Mar 16, 2026', end: 'Mar 22, 2026', desc: 'Client deadline week',      skipped: 7 },
]
```

- [ ] **Step 2: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add QUICK_CONTEXT_CONFIG and skipped counts to CONTEXTS_PAST"
```

---

## Task 2: Add activeContext state + three handlers to HeedApp

**Files:**
- Modify: `web/app/page.jsx` (HeedApp function body)

- [ ] **Step 1: Add three state variables**

After line 2334 (`const [buildRoutineTask, setBuildRoutineTask] = useState(null)`), insert:

```js
  const [activeContext, setActiveContext] = useState(null)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [quickContextType, setQuickContextType] = useState(null)
```

- [ ] **Step 2: Add three handlers**

After the `handleMoreOptions` handler (around line 2482), insert:

```js
  const handleQuickContext = useCallback((type, days) => {
    const cfg = QUICK_CONTEXT_CONFIG[type]
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days - 1)
    const heldTaskIds = apiTasks
      .filter(t => t.status === 'active' && !dismissedIds.has(t.id))
      .map(t => t.id)
    setActiveContext({ id: `ctx-${Date.now()}`, type, label: cfg.label, icon: cfg.icon, startDate, endDate, heldTaskIds })
    setToast({ message: cfg.toastMsg })
  }, [apiTasks, dismissedIds])

  const handleExtendContext = useCallback(() => {
    setActiveContext(ctx => {
      if (!ctx) return ctx
      const newEnd = new Date(ctx.endDate)
      newEnd.setDate(newEnd.getDate() + 2)
      return { ...ctx, endDate: newEnd }
    })
    setToast({ message: 'Extended by 2 days' })
  }, [])

  const handleEndContext = useCallback((mode) => {
    setActiveContext(null)
    setRecoveryOpen(false)
    setToast({ message: mode === 'resume' ? "You're back — tasks resumed" : 'Easing you back in — top tasks surfaced' })
  }, [])
```

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add activeContext state and quick-context handlers to HeedApp"
```

---

## Task 3: Add QuickContextSheet component

**Files:**
- Modify: `web/app/page.jsx` (insert before `// ── Main App` comment at line 2308)

- [ ] **Step 1: Insert the component**

Insert the following block immediately before the `// ── Main App ─────` comment (line 2308):

```jsx
// ── QuickContextSheet ──────────────────────────────────────────
function QuickContextSheet({ type, onClose, onActivate }) {
  const DURATIONS = [1, 2, 3, 5, 7]
  const LABELS = { 1: '1 day', 2: '2 days', 3: '3 days', 5: '5 days', 7: '1 week' }
  const cfg = type ? QUICK_CONTEXT_CONFIG[type] : null
  const [selected, setSelected] = useState(cfg?.defaultDays ?? 2)
  useEffect(() => { if (cfg) setSelected(cfg.defaultDays) }, [type])
  if (!type) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{cfg.icon} {cfg.question}</div>
        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 16 }}>Heed will hold your tasks until then</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {DURATIONS.map(d => (
            <button key={d} onClick={() => setSelected(d)} style={{ flex: 1, background: selected === d ? C.warmDark : C.bellySoft, color: selected === d ? C.cream : C.ink, border: 'none', borderRadius: 10, padding: '10px 4px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {LABELS[d]}
            </button>
          ))}
        </div>
        <button onClick={() => { onActivate(type, selected); onClose() }} style={{ ...getBtnPrimary(), width: '100%', padding: 12, fontSize: 14, fontWeight: 700, borderRadius: 10 }}>
          {cfg.activateLabel}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add QuickContextSheet component"
```

---

## Task 4: Add ActiveContextCard component

**Files:**
- Modify: `web/app/page.jsx` (insert after QuickContextSheet, before HeedApp)

- [ ] **Step 1: Insert the component**

Insert the following block immediately after the closing `}` of `QuickContextSheet` (just before the `// ── Main App` comment):

```jsx
// ── ActiveContextCard ──────────────────────────────────────────
function ActiveContextCard({ context, onImBetter, onExtend }) {
  if (!context) return null
  const now = new Date()
  const daysSinceStart = Math.max(0, Math.floor((now - context.startDate) / 86400000))
  const totalDays = Math.max(1, Math.round((context.endDate - context.startDate) / 86400000) + 1)
  const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const startedLabel = daysSinceStart === 0 ? 'started today' : `started ${daysSinceStart}d ago`
  return (
    <div style={{ background: C.ochreSoft, border: `2px solid ${C.ochre}`, borderRadius: 14, padding: 16, marginBottom: 20, boxShadow: `0 4px 16px ${C.ochre}26` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 3 }}>{context.icon} {context.label}</div>
          <div style={{ fontSize: 12, color: C.inkMute }}>{fmtDate(context.startDate)} → {fmtDate(context.endDate)} · {startedLabel}</div>
        </div>
        <div style={{ background: C.ochre, color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>Day {daysSinceStart + 1} of {totalDays}</div>
      </div>
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', fontSize: 12.5, color: C.ink, marginBottom: 12 }}>
        Heed is holding <strong>{context.heldTaskIds.length} tasks</strong> until you're back. Morning &amp; evening routines paused.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onImBetter} style={{ ...getBtnPrimary(), flex: 1, background: C.sage, padding: '9px 14px' }}>I'm better now</button>
        <button onClick={onExtend} style={{ ...getBtnGhost(), padding: '9px 14px' }}>Extend 2 days</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add ActiveContextCard component"
```

---

## Task 5: Add RecoverySummarySheet component

**Files:**
- Modify: `web/app/page.jsx` (insert after ActiveContextCard, before HeedApp)

- [ ] **Step 1: Insert the component**

Insert the following block immediately after the closing `}` of `ActiveContextCard`:

```jsx
// ── RecoverySummarySheet ───────────────────────────────────────
function RecoverySummarySheet({ open, context, heldTasks, onClose, onResumeAll, onEaseBack }) {
  if (!open || !context) return null
  const now = new Date()
  const days = Math.max(1, Math.round((now - context.startDate) / 86400000))
  const top3 = heldTasks.slice(0, 3)
  const extraCount = Math.max(0, heldTasks.length - 3)
  const gladEmoji = QUICK_CONTEXT_CONFIG[context.type]?.icon || '✨'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Glad you're back {gladEmoji}</div>
        <div style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 14 }}>{context.label} ran for <strong>{days} day{days !== 1 ? 's' : ''}</strong>. Here's what Heed held back:</div>
        <div style={{ background: C.bellySoft, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          {top3.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.inkMute, padding: '4px 0' }}>No tasks were held during this period.</div>
          ) : (
            <>
              {top3.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.ink, padding: '4px 0', borderBottom: (i < top3.length - 1 || extraCount > 0) ? `1px solid ${C.hairline}` : 'none' }}>
                  <span>{t.name}</span>
                  {t.overdue ? <span style={{ color: C.rust, fontWeight: 600 }}>+{t.overdue}d overdue</span> : <span style={{ color: C.inkMute }}>held</span>}
                </div>
              ))}
              {extraCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.inkMute, padding: '4px 0' }}>
                  <span>+ {extraCount} more task{extraCount !== 1 ? 's' : ''}</span>
                  <span style={{ color: C.sage, fontWeight: 600 }}>held</span>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onResumeAll} style={{ ...getBtnPrimary(), flex: 2, background: C.sage, padding: 11, fontSize: 13, fontWeight: 700, borderRadius: 10 }}>Resume all</button>
          <button onClick={onEaseBack} style={{ ...getBtnGhost(), flex: 1, padding: 11, fontSize: 13, borderRadius: 10 }}>Ease back in</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add RecoverySummarySheet component"
```

---

## Task 6: Update ContextRow + ContextTab + wire HeedApp

**Files:**
- Modify: `web/app/page.jsx:1638-1678` (ContextRow, ContextTab)
- Modify: `web/app/page.jsx:2556` (ContextTab call in HeedApp render)
- Modify: `web/app/page.jsx:2567-2568` (new sheets in HeedApp render)

- [ ] **Step 1: Update ContextRow to show skipped count**

Replace the existing `ContextRow` function (lines 1638–1651) with:

```jsx
function ContextRow({ ctx, highlight }) {
  const icons = { travel: '🗺️', illness: '🌿', busy: '🌾', celebration: '🌸' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: `1px solid ${C.hairline}` }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: highlight ? C.ochreSoft : C.bellySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        {icons[ctx.type] || '📌'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, marginBottom: 2 }}>{ctx.desc}</div>
        <div style={{ fontSize: 12, color: C.inkMute }}>{ctx.start} → {ctx.end}</div>
      </div>
      {highlight && <Pill tone="warn" glow>soon</Pill>}
      {!highlight && ctx.skipped != null && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.rust }}>{ctx.skipped} skipped</div>
          <div style={{ fontSize: 10, color: C.inkMute }}>tasks</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace ContextTab with version that includes chips + active card**

Replace the existing `ContextTab` function (lines 1654–1678) with:

```jsx
function ContextTab({ upcoming, active, activeContext, onAddContext, onQuickContext, onImBetter, onExtend }) {
  const allUpcoming = [...(active || []).map(mapApiContext), ...(upcoming || []).map(mapApiContext)]
  const CHIPS = [
    { type: 'sick',        label: '🌿 Sick' },
    { type: 'busy',        label: '🌾 Busy week' },
    { type: 'travel',      label: '✈️ Traveling' },
    { type: 'celebration', label: '🌸 Celebration' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <SectionHeader>Context windows</SectionHeader>
        <button onClick={onAddContext} style={getBtnPrimary()}>+ Add context</button>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 20 }}>
        {CHIPS.map(c => (
          <button key={c.type} onClick={() => onQuickContext(c.type)}
            style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '6px 14px', fontSize: 12, color: C.ink, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.ochre; e.currentTarget.style.background = C.ochreSoft }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.paper }}
          >{c.label}</button>
        ))}
      </div>
      {activeContext && <ActiveContextCard context={activeContext} onImBetter={onImBetter} onExtend={onExtend}/>}
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16, boxShadow: C.shadowSoft }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>Upcoming</div>
        {allUpcoming.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', padding: '8px 0' }}>Nothing on the horizon. Tap "+ Add context" if you have a trip, illness, or busy week coming up.</div>
        ) : allUpcoming.map((c, i) => <ContextRow key={`u-${i}`} ctx={c} highlight/>)}
      </div>
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, boxShadow: C.shadowSoft }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>Past</div>
        {CONTEXTS_PAST.map((c, i) => <ContextRow key={`p-${i}`} ctx={c}/>)}
      </div>
      <div style={{ marginTop: 20, padding: '14px 16px', background: C.bellySoft, borderRadius: 10, fontSize: 13, color: C.ink, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span>You can also tell Heed about context in plain language — try <em>"I'm sick this week"</em> or <em>"I'm traveling next month."</em></span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update the ContextTab call in HeedApp render**

Find this line (around line 2556):
```jsx
        {tab === 'context' && <ContextTab upcoming={apiContexts.upcoming} active={apiContexts.active} onAddContext={() => setContextModalOpen(true)}/>}
```

Replace it with:
```jsx
        {tab === 'context' && <ContextTab upcoming={apiContexts.upcoming} active={apiContexts.active} activeContext={activeContext} onAddContext={() => setContextModalOpen(true)} onQuickContext={type => setQuickContextType(type)} onImBetter={() => setRecoveryOpen(true)} onExtend={handleExtendContext}/>}
```

- [ ] **Step 4: Add the two new sheets to HeedApp render**

Find this line (around line 2568):
```jsx
      <AddToRoutineSheet task={addToRoutineTask} routines={routines} onClose={() => setAddToRoutineTask(null)} onSelect={handleAddTaskToRoutine}/>
```

Add the following two lines immediately after it:
```jsx
      <QuickContextSheet type={quickContextType} onClose={() => setQuickContextType(null)} onActivate={handleQuickContext}/>
      <RecoverySummarySheet open={recoveryOpen} context={activeContext} heldTasks={activeContext ? displayTasks.filter(t => activeContext.heldTaskIds.includes(t.id)) : []} onClose={() => setRecoveryOpen(false)} onResumeAll={() => handleEndContext('resume')} onEaseBack={() => handleEndContext('ease')}/>
```

- [ ] **Step 5: Verify in browser**

Dev server should already be running at http://localhost:3000.

1. Open the Context tab.
2. Confirm four chips appear below the header: 🌿 Sick · 🌾 Busy week · ✈️ Traveling · 🌸 Celebration.
3. Tap "🌿 Sick" → a bottom sheet slides up titled "🌿 How long are you sick?" with duration buttons (1 day pre-selected at 2 days). Confirm "2 days" is highlighted.
4. Tap "Activate rest mode" → sheet closes, toast appears "Rest mode activated — Heed is holding your tasks", and an ochre-bordered active context card appears above the Upcoming section.
5. Confirm the card shows "🌿 Sick — rest mode", date range, "Day 1 of 2" badge, tasks count, and two buttons.
6. Tap "Extend 2 days" → toast "Extended by 2 days", badge updates to "Day 1 of 4".
7. Tap "I'm better now" → recovery summary sheet slides up titled "Glad you're back 🌿".
8. Tap "Resume all" → sheet closes, active card disappears, toast "You're back — tasks resumed".
9. In the Past section, confirm each row shows a rust-colored skipped count (12 skipped, 7 skipped, 9 skipped).

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: wire up Context tab improvements — chips, active card, recovery sheet"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| 4 quick-add chips | Task 6 ContextTab chips |
| Duration bottom sheet with pre-selected default | Task 3 QuickContextSheet |
| Toast on activate | Task 2 handleQuickContext |
| Active context card (ochre border) | Task 4 ActiveContextCard |
| Day X of Y badge | Task 4 ActiveContextCard |
| N tasks held summary | Task 4 ActiveContextCard |
| "I'm better now" → recovery sheet | Task 6 ContextTab onImBetter prop |
| "Extend 2 days" → updates date + toast | Task 2 handleExtendContext |
| Recovery sheet with held task list | Task 5 RecoverySummarySheet |
| "Resume all" ends context | Task 2 handleEndContext('resume') |
| "Ease back in" ends context | Task 2 handleEndContext('ease') |
| Past contexts show skipped count | Task 6 ContextRow + Task 1 CONTEXTS_PAST |
| "+ Add context" button unchanged | Not touched |
| Upcoming section unchanged | Not touched |
| Tip at bottom unchanged | Not touched |

**No gaps found.** All spec sections have a corresponding task.
