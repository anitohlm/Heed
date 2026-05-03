# Context Detail Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add summary chips to context rows and a bottom sheet that slides up on tap, showing full context details (before/during/after for upcoming, held task list for past, actions for active).

**Architecture:** All changes in `web/app/page.jsx`. New `ContextDetailSheet` component inserted before `HeedApp`. Two new state vars (`detailCtx`, `detailOpen`) and two handlers (`handleDetailOpen`, `handleDetailClose`) in `HeedApp`. `ContextTab` is refactored to accept pre-processed `allUpcoming` prop (enabling demo data to show) and gets `onDetailOpen` wired through to `ContextRow`.

**Tech Stack:** React 18, Next.js 14, inline styles, `C.*` design tokens, `getBtnPrimary()` / `getBtnGhost()` helpers, `heed-slideUp` CSS animation (already defined in the global `<style>` block).

---

## File map

| File | Change |
|---|---|
| `web/app/page.jsx:63–91` | Add `routinesPaused` to `CONTEXTS_UPCOMING_DEMO`; add `heldTasks` to `CONTEXTS_PAST` |
| `web/app/page.jsx:1612–1675` | `ContextRow` — add chips + tappability; `ContextTab` — accept `allUpcoming` prop, pass `onDetailOpen` |
| `web/app/page.jsx` (after line ~2409) | Insert new `ContextDetailSheet` component |
| `web/app/page.jsx:2438–2440` | Add `detailCtx`, `detailOpen` state to `HeedApp` |
| `web/app/page.jsx:2617–2618` | Add `handleDetailOpen`, `handleDetailClose` handlers to `HeedApp` |
| `web/app/page.jsx:2691` | Update `<ContextTab>` call; add `<ContextDetailSheet>` to render tree |

---

## Task 1: Enrich mock data

**Files:**
- Modify: `web/app/page.jsx:63–91`

Add `routinesPaused` to the Singapore trip entry in `CONTEXTS_UPCOMING_DEMO` and add `heldTasks` arrays to all three `CONTEXTS_PAST` entries.

- [ ] **Step 1: Update `CONTEXTS_UPCOMING_DEMO`**

Find the `CONTEXTS_UPCOMING_DEMO` declaration (currently lines 68–91). Add `routinesPaused: 2` as a new field on the single entry object, right after `_startDate`:

```js
const CONTEXTS_UPCOMING_DEMO = [
  {
    type: 'travel',
    start: 'Jun 5, 2026',
    end: 'Jun 9, 2026',
    desc: 'Singapore trip',
    _startDate: new Date('2026-06-05'),
    routinesPaused: 2,
    askQuery: 'Plan around my Singapore trip',
    plan: {
      before: [
        'Pay Maynilad & Meralco this week',
        'Submit timesheet (Friday)',
        'Refill water dispenser the day before you fly',
      ],
      during: [
        'Morning and evening routines paused automatically',
      ],
      after: [
        'Soft-start Jun 10 — essentials only',
        'Aircon cleaning can wait until that weekend',
      ],
    },
  },
]
```

- [ ] **Step 2: Update `CONTEXTS_PAST`**

Find the `CONTEXTS_PAST` declaration (currently lines 63–67). Add a `heldTasks` array to each entry:

```js
const CONTEXTS_PAST = [
  {
    type: 'travel', start: 'Dec 20, 2025', end: 'Dec 27, 2025', desc: 'Christmas trip to Baguio', skipped: 9,
    heldTasks: [
      { label: 'Pay Meralco bill',       overdueDays: 7 },
      { label: 'Call Mom',               overdueDays: 7 },
      { label: 'Submit timesheet',       overdueDays: 0 },
      { label: 'Refill water dispenser', overdueDays: 3 },
      { label: 'Morning routine',        overdueDays: 0 },
    ],
  },
  {
    type: 'illness', start: 'Feb 10, 2026', end: 'Feb 14, 2026', desc: 'Flu — bed rest', skipped: 12,
    heldTasks: [
      { label: 'Pay Meralco bill', overdueDays: 5 },
      { label: 'Call Mom',         overdueDays: 5 },
      { label: 'Morning routine',  overdueDays: 0 },
      { label: 'Evening wind-down', overdueDays: 0 },
    ],
  },
  {
    type: 'busy', start: 'Mar 16, 2026', end: 'Mar 22, 2026', desc: 'Client deadline week', skipped: 7,
    heldTasks: [
      { label: 'Cat litter box',          overdueDays: 6 },
      { label: 'Update expense tracker',  overdueDays: 6 },
      { label: 'Wash bedsheets',          overdueDays: 0 },
    ],
  },
]
```

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: enrich context mock data with routinesPaused and heldTasks"
```

---

## Task 2: Add chips and tappability to ContextRow; fix ContextTab upcoming

**Files:**
- Modify: `web/app/page.jsx:1612–1675`

Two changes: (a) `ContextRow` gets chips for upcoming rows and becomes tappable; (b) `ContextTab` accepts `allUpcoming` instead of re-mapping raw API data, so demo entries are visible.

- [ ] **Step 1: Replace `ContextRow`**

Replace the entire `ContextRow` function (lines 1612–1632) with:

```jsx
function ContextRow({ ctx, highlight, onDetailOpen }) {
  const icons = { travel: '🗺️', illness: '🌿', busy: '🌾', celebration: '🌸' }
  const tasksBeforeCount = ctx.plan?.before?.length || 0
  const routinesPaused = ctx.routinesPaused || 0
  return (
    <div
      onClick={() => onDetailOpen?.(ctx)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0', borderTop: `1px solid ${C.hairline}`, cursor: onDetailOpen ? 'pointer' : 'default' }}
    >
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: highlight ? C.ochreSoft : C.bellySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, marginTop: 2 }}>
        {icons[ctx.type] || '📌'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, marginBottom: 2 }}>{ctx.desc}</div>
        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: highlight && (tasksBeforeCount > 0 || routinesPaused > 0) ? 8 : 0 }}>
          {ctx.start} → {ctx.end}
        </div>
        {highlight && (tasksBeforeCount > 0 || routinesPaused > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tasksBeforeCount > 0 && (
              <span style={{ background: C.bellySoft, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 10.5, color: C.inkSoft }}>
                📋 {tasksBeforeCount} task{tasksBeforeCount !== 1 ? 's' : ''} before you go
              </span>
            )}
            {routinesPaused > 0 && (
              <span style={{ background: C.bellySoft, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 10.5, color: C.inkSoft }}>
                ⏸ {routinesPaused} routine{routinesPaused !== 1 ? 's' : ''} paused
              </span>
            )}
          </div>
        )}
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

- [ ] **Step 2: Replace `ContextTab`**

Replace the entire `ContextTab` function (lines 1641–1675) with:

```jsx
function ContextTab({ allUpcoming, activeContext, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <SectionHeader>Context windows</SectionHeader>
        <button onClick={onAddContext} style={getBtnPrimary()}>+ Add context</button>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 20 }}>
        {CONTEXT_CHIPS.map(c => (
          <button key={c.type} onClick={() => onQuickContext(c.type)}
            style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '6px 14px', fontSize: 12, color: C.ink, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.ochre; e.currentTarget.style.background = C.ochreSoft }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.paper }}
          >{c.label}</button>
        ))}
      </div>
      {activeContext && (
        <ActiveContextCard
          context={activeContext}
          onImBetter={onImBetter}
          onExtend={onExtend}
          onClick={() => onDetailOpen?.(activeContext, 'active')}
        />
      )}
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16, boxShadow: C.shadowSoft }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>Upcoming</div>
        {(allUpcoming || []).length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', padding: '8px 0' }}>Nothing on the horizon. Tap "+ Add context" if you have a trip, illness, or busy week coming up.</div>
        ) : (allUpcoming || []).map((c, i) => (
          <ContextRow key={`u-${i}`} ctx={c} highlight onDetailOpen={ctx => onDetailOpen?.(ctx, 'upcoming')}/>
        ))}
      </div>
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, boxShadow: C.shadowSoft }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>Past</div>
        {CONTEXTS_PAST.map((c, i) => (
          <ContextRow key={`p-${i}`} ctx={c} onDetailOpen={ctx => onDetailOpen?.(ctx, 'past')}/>
        ))}
      </div>
      <div style={{ marginTop: 20, padding: '14px 16px', background: C.bellySoft, borderRadius: 10, fontSize: 13, color: C.ink, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span>You can also tell Heed about context in plain language — try <em>"I'm sick this week"</em> or <em>"I'm traveling next month."</em></span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add `onClick` prop to `ActiveContextCard`**

Find `ActiveContextCard` (around line 2340). Add `onClick` to its props and wire it to the outer container div:

Replace:
```jsx
function ActiveContextCard({ context, onImBetter, onExtend }) {
  if (!context) return null
  const now = new Date()
  const daysSinceStart = Math.max(0, Math.floor((now - context.startDate) / 86400000))
  const totalDays = Math.max(1, Math.round((context.endDate - context.startDate) / 86400000) + 1)
  const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const startedLabel = daysSinceStart === 0 ? 'started today' : `started ${daysSinceStart}d ago`
  return (
    <div style={{ background: C.ochreSoft, border: `2px solid ${C.ochre}`, borderRadius: 14, padding: 16, marginBottom: 20, boxShadow: `0 4px 16px ${C.ochre}26` }}>
```

With:
```jsx
function ActiveContextCard({ context, onImBetter, onExtend, onClick }) {
  if (!context) return null
  const now = new Date()
  const daysSinceStart = Math.max(0, Math.floor((now - context.startDate) / 86400000))
  const totalDays = Math.max(1, Math.round((context.endDate - context.startDate) / 86400000) + 1)
  const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const startedLabel = daysSinceStart === 0 ? 'started today' : `started ${daysSinceStart}d ago`
  return (
    <div onClick={onClick} style={{ background: C.ochreSoft, border: `2px solid ${C.ochre}`, borderRadius: 14, padding: 16, marginBottom: 20, boxShadow: `0 4px 16px ${C.ochre}26`, cursor: onClick ? 'pointer' : 'default' }}>
```

- [ ] **Step 4: Verify in browser**

Start the dev server: `cd web && npm run dev`

Open http://localhost:3000 and navigate to the Context tab. Verify:
- The Singapore trip row is visible in Upcoming (it was previously hidden — this is a fix)
- "📋 3 tasks before you go" and "⏸ 2 routines paused" chips appear below the Singapore trip title/date
- All rows have a pointer cursor on hover
- Past rows still show skipped counts

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add chips and tappability to ContextRow; fix ContextTab to show demo upcoming contexts"
```

---

## Task 3: Build ContextDetailSheet component

**Files:**
- Modify: `web/app/page.jsx` (insert before `HeedApp`, after `RecoverySummarySheet` around line 2409)

Single component that branches on `ctx._status` to render appropriate sheet content.

- [ ] **Step 1: Insert `ContextDetailSheet` after `RecoverySummarySheet`**

Find the comment `// ── Main App ───────────────────────────────────────────────────` (around line 2411). Insert the following component immediately before it:

```jsx
// ── ContextDetailSheet ─────────────────────────────────────────
function ContextDetailSheet({ open, ctx, heldTasks, onClose, onImBetter, onExtend }) {
  if (!open || !ctx) return null

  const fmtDate = d => {
    if (!d) return ''
    const parsed = typeof d === 'string' ? new Date(d) : d
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Build header subtitle string based on status
  const now = new Date()
  let subtitle = `${ctx.start || ''} → ${ctx.end || ''}`
  if (ctx._status === 'upcoming' && ctx._startDate) {
    const weeksAway = Math.ceil((ctx._startDate - now) / (7 * 86400000))
    const daysAway = Math.ceil((ctx._startDate - now) / 86400000)
    subtitle += daysAway <= 0 ? ' · this week' : daysAway < 7 ? ` · in ${daysAway} day${daysAway !== 1 ? 's' : ''}` : ` · in ${weeksAway} week${weeksAway !== 1 ? 's' : ''}`
  }
  if (ctx._status === 'active') {
    const daysSinceStart = Math.max(0, Math.floor((now - ctx.startDate) / 86400000))
    const totalDays = Math.max(1, Math.round((ctx.endDate - ctx.startDate) / 86400000) + 1)
    subtitle = `${fmtDate(ctx.startDate)} → ${fmtDate(ctx.endDate)} · Day ${daysSinceStart + 1} of ${totalDays}`
  }
  if (ctx._status === 'past') {
    const startD = new Date(ctx.start)
    const endD = new Date(ctx.end)
    const dur = Math.max(1, Math.round((endD - startD) / 86400000) + 1)
    subtitle = `${ctx.start} → ${ctx.end} · ${dur} day${dur !== 1 ? 's' : ''}`
  }

  const icons = { travel: '🗺️', illness: '🌿', busy: '🌾', celebration: '🌸' }
  const icon = ctx.icon || icons[ctx.type] || '📌'
  const bgForIcon = ctx._status === 'active' ? C.ochreSoft : ctx._status === 'upcoming' ? C.ochreSoft : C.bellySoft

  const SectionCard = ({ children, style }) => (
    <div style={{ background: C.bellySoft, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', ...style }}>
      {children}
    </div>
  )
  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: bgForIcon, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 3 }}>{ctx.desc || ctx.label}</div>
            <div style={{ fontSize: 12, color: C.inkMute }}>{subtitle}</div>
          </div>
        </div>

        {/* Upcoming body */}
        {ctx._status === 'upcoming' && (() => {
          const tasksBefore = ctx.plan?.before || []
          const whileAway = ctx.plan?.during?.[0] || ''
          const comingBack = ctx.plan?.after?.[0] || ''
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {tasksBefore.length > 0 && (
                <SectionCard>
                  <SectionLabel>Before you go</SectionLabel>
                  {tasksBefore.slice(0, 5).map((t, i) => (
                    <div key={i} style={{ fontSize: 13, color: C.ink, padding: '2px 0' }}>• {t}</div>
                  ))}
                </SectionCard>
              )}
              {(whileAway || comingBack) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {whileAway && (
                    <SectionCard style={{ flex: 1 }}>
                      <SectionLabel>While away</SectionLabel>
                      <div style={{ fontSize: 12.5, color: C.inkSoft }}>{whileAway}</div>
                    </SectionCard>
                  )}
                  {comingBack && (
                    <SectionCard style={{ flex: 1 }}>
                      <SectionLabel>Coming back</SectionLabel>
                      <div style={{ fontSize: 12.5, color: C.inkSoft }}>{comingBack}</div>
                    </SectionCard>
                  )}
                </div>
              )}
              <button style={{ ...getBtnPrimary(), width: '100%', padding: 12, fontSize: 13, fontWeight: 700, borderRadius: 10 }}>
                Ask Heed to plan around this
              </button>
            </div>
          )
        })()}

        {/* Active body */}
        {ctx._status === 'active' && (() => {
          const top3 = (heldTasks || []).slice(0, 3)
          const extraCount = Math.max(0, (heldTasks || []).length - 3)
          return (
            <div style={{ marginBottom: 16 }}>
              <SectionCard style={{ marginBottom: 12 }}>
                {top3.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.inkMute }}>Heed is holding your tasks while {ctx.label} is active.</div>
                ) : (
                  <>
                    {top3.map((t, i) => (
                      <div key={t.id || i} style={{ fontSize: 13, color: C.ink, padding: '4px 0', borderBottom: i < top3.length - 1 ? `1px solid ${C.hairline}` : 'none' }}>
                        {t.name}
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <div style={{ fontSize: 12.5, color: C.inkMute, padding: '4px 0' }}>+ {extraCount} more task{extraCount !== 1 ? 's' : ''}</div>
                    )}
                  </>
                )}
              </SectionCard>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onImBetter} style={{ ...getBtnPrimary(), flex: 1, background: C.sage, padding: '10px 14px' }}>I'm better now</button>
                <button onClick={onExtend} style={{ ...getBtnGhost(), padding: '10px 14px' }}>Extend 2 days</button>
              </div>
            </div>
          )
        })()}

        {/* Past body */}
        {ctx._status === 'past' && (() => {
          const tasks = ctx.heldTasks || []
          const top3 = tasks.slice(0, 3)
          const extraCount = Math.max(0, tasks.length - 3)
          return (
            <SectionCard style={{ marginBottom: 16 }}>
              {tasks.length === 0 ? (
                <div style={{ fontSize: 13, color: C.inkMute }}>No tasks were held during this period.</div>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 8 }}>
                    Heed held back <strong>{ctx.skipped}</strong> tasks during this period:
                  </div>
                  {top3.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.ink, padding: '4px 0', borderBottom: (i < top3.length - 1 || extraCount > 0) ? `1px solid ${C.hairline}` : 'none' }}>
                      <span>{t.label}</span>
                      {t.overdueDays > 0
                        ? <span style={{ color: C.rust, fontWeight: 600 }}>+{t.overdueDays}d overdue</span>
                        : <span style={{ color: C.inkMute }}>paused</span>
                      }
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
            </SectionCard>
          )
        })()}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify component renders without error**

With dev server running, navigate to Context tab. No console errors should appear (the sheet is not yet wired up so it doesn't render yet).

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add ContextDetailSheet component"
```

---

## Task 4: Wire state and handlers in HeedApp

**Files:**
- Modify: `web/app/page.jsx` (HeedApp state, handlers, render)

- [ ] **Step 1: Add `detailCtx` and `detailOpen` state**

Find the existing context-related state block in `HeedApp` (around lines 2438–2440):
```js
  const [activeContext, setActiveContext] = useState(null)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [quickContextType, setQuickContextType] = useState(null)
```

After those three lines, add:
```js
  const [detailCtx, setDetailCtx] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
```

- [ ] **Step 2: Add `handleDetailOpen` and `handleDetailClose` handlers**

Find `handleEndContext` (around lines 2613–2617). After its closing `}, [])`, add:

```js
  const handleDetailOpen = useCallback((ctx, status) => {
    setDetailCtx({ ...ctx, _status: status })
    setDetailOpen(true)
  }, [])

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false)
  }, [])
```

- [ ] **Step 3: Update the `<ContextTab>` render call**

Find the `<ContextTab>` render (line 2691):
```jsx
{tab === 'context' && <ContextTab upcoming={apiContexts.upcoming} active={apiContexts.active} activeContext={activeContext} onAddContext={() => setContextModalOpen(true)} onQuickContext={type => setQuickContextType(type)} onImBetter={() => setRecoveryOpen(true)} onExtend={handleExtendContext}/>}
```

Replace it with:
```jsx
{tab === 'context' && <ContextTab allUpcoming={upcomingContexts} activeContext={activeContext} onAddContext={() => setContextModalOpen(true)} onQuickContext={type => setQuickContextType(type)} onImBetter={() => setRecoveryOpen(true)} onExtend={handleExtendContext} onDetailOpen={handleDetailOpen}/>}
```

- [ ] **Step 4: Add `<ContextDetailSheet>` to the render tree**

Find the `<RecoverySummarySheet>` line (around line 2705):
```jsx
<RecoverySummarySheet open={recoveryOpen} context={activeContext} heldTasks={activeContext ? displayTasks.filter(t => activeContext.heldTaskIds.includes(t.id)) : []} onClose={() => setRecoveryOpen(false)} onResumeAll={() => handleEndContext('resume')} onEaseBack={() => handleEndContext('ease')}/>
```

After it, add:
```jsx
<ContextDetailSheet
  open={detailOpen}
  ctx={detailCtx}
  heldTasks={detailCtx?._status === 'active' && activeContext ? displayTasks.filter(t => activeContext.heldTaskIds.includes(t.id)) : []}
  onClose={handleDetailClose}
  onImBetter={() => { handleDetailClose(); setRecoveryOpen(true) }}
  onExtend={() => { handleDetailClose(); handleExtendContext() }}
/>
```

- [ ] **Step 5: Verify end-to-end in browser**

With dev server running, navigate to Context tab. Verify:
1. Singapore trip row shows chips ("📋 3 tasks before you go", "⏸ 2 routines paused")
2. Tapping the Singapore trip row opens a sheet with "Before you go" bullet list, "While away" / "Coming back" side-by-side cards, and "Ask Heed to plan around this" button
3. Tapping any past row (Baguio trip, Flu, Client deadline) opens a sheet with held task list and overdue deltas
4. Quick-activating a context (tap a chip, pick duration, activate), then tapping the ActiveContextCard — opens sheet with "I'm better now" + "Extend 2 days" buttons
5. Backdrop tap closes any open sheet
6. No console errors

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: wire ContextDetailSheet — tappable context rows open detail sheets"
```
