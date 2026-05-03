# Life Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "Plans" tab to "Life" and restructure it as two segments — Plans (goals/projects/events) and Life Events (existing sick/travel/busy feature) — matching the Tracks tab pattern.

**Architecture:** All UI changes live in `web/app/page.jsx`. The existing `ContextTab` is replaced by a new `LifeTab` (segment control) + `LifeEventsPanel` (extracted ContextTab body) + `PlansPanel` (new plans list). A `PlanCard` component renders project/goal/event cards. An `AddPlanSheet` handles plan creation. Demo data only — no API changes.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern), `useState`/`useEffect`/`useRef` from React

---

### Task 1: Rename tab label and add DEMO_PLANS data

**Files:**
- Modify: `web/app/page.jsx:15` — change label
- Modify: `web/app/page.jsx:116` — insert DEMO_PLANS after CONTEXTS_UPCOMING_DEMO

- [ ] **Step 1: Change tab label from 'Plans' to 'Life'**

Find line 15 in `web/app/page.jsx`:
```js
  { id: 'context',  label: 'Plans' },
```
Change to:
```js
  { id: 'context',  label: 'Life' },
```

- [ ] **Step 2: Add DEMO_PLANS constant after CONTEXTS_UPCOMING_DEMO**

After the closing `]` of `CONTEXTS_UPCOMING_DEMO` (after line 116), insert:

```js
const DEMO_PLANS = [
  {
    id: 'plan-1', type: 'project', icon: '📦', title: 'Move apartments',
    dueDate: 'Jun 15',
    tasks: [
      { label: 'Book moving truck',           done: true },
      { label: 'Notify landlord',             done: true },
      { label: 'Pack bedroom',                done: false },
      { label: 'Transfer utilities',          done: false },
      { label: 'Update address with bank',    done: false },
      { label: 'Deep clean current unit',     done: false },
      { label: 'Return keys',                 done: false },
    ],
  },
  {
    id: 'plan-2', type: 'event', icon: '📅', title: 'Job interview — Acme Co.',
    eventDate: new Date('2026-05-08'),
    tasks: [
      { label: 'Research the company',        done: true },
      { label: 'Prepare questions to ask',    done: false },
      { label: 'Iron outfit',                 done: false },
    ],
  },
  {
    id: 'plan-3', type: 'goal', icon: '🎯', title: 'Save ₱50,000',
    current: 31500, target: 50000, unit: '₱', targetDate: 'Aug 2026',
  },
]
```

- [ ] **Step 3: Start dev server and verify tab label**

```
cd web && npm run dev
```

Open `http://localhost:3000`. Bottom nav should show **"Life"** instead of "Plans". No other visible change yet.

- [ ] **Step 4: Commit**

```
git add web/app/page.jsx
git commit -m "feat: rename Plans tab to Life, add DEMO_PLANS seed data"
```

---

### Task 2: PlanCard component

**Files:**
- Modify: `web/app/page.jsx` — insert PlanCard after the `CONTEXT_CHIPS` constant (around line 1713)

- [ ] **Step 1: Insert PlanCard after CONTEXT_CHIPS**

Find the line `const CONTEXT_CHIPS = [` and locate the closing `]` a few lines below it. Insert the following block immediately after that closing bracket:

```js
// ── PlanCard ────────────────────────────────────────────────────
const PLAN_ICON_BG = { project: '#f0e8d8', goal: '#f5f0d8', event: '#e8f0e8' }

function PlanCard({ plan, delay = 0 }) {
  const doneCount = plan.tasks ? plan.tasks.filter(t => t.done).length : 0
  const totalCount = plan.tasks ? plan.tasks.length : 0
  const pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0
  const goalPct = plan.type === 'goal' && plan.target > 0
    ? Math.round(plan.current / plan.target * 100)
    : 0
  const daysUntil = plan.eventDate
    ? Math.round((plan.eventDate - new Date()) / 86400000)
    : null
  const undone = plan.tasks ? plan.tasks.filter(t => !t.done) : []
  const preview = undone.slice(0, 2)
  const extra = undone.length - preview.length

  const subtitle = {
    project: `${doneCount} of ${totalCount} tasks · Due ${plan.dueDate}`,
    goal:    `${plan.unit}${plan.current.toLocaleString()} saved · Target ${plan.targetDate}`,
    event:   daysUntil === null ? plan.title
           : daysUntil <= 0    ? 'Today!'
           : daysUntil === 1   ? 'Tomorrow'
           : `in ${daysUntil} days`,
  }[plan.type]

  const badge = {
    project: <div style={{ fontSize: 13, fontWeight: 700, color: C.rust, flexShrink: 0 }}>{pct}%</div>,
    goal:    <div style={{ fontSize: 13, fontWeight: 700, color: C.ochre, flexShrink: 0 }}>{goalPct}%</div>,
    event:   undone.length > 0
               ? <div style={{ background: '#e8f0e8', color: '#3a6840', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{undone.length} left</div>
               : null,
  }[plan.type]

  return (
    <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10, animation: `heed-fadeIn 0.2s ease ${delay}ms both` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: PLAN_ICON_BG[plan.type] || C.bellySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {plan.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.title}</div>
          <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>{subtitle}</div>
        </div>
        {badge}
      </div>

      {(plan.type === 'project' || plan.type === 'goal') && (
        <div style={{ height: 4, background: C.bellySoft, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, background: plan.type === 'project' ? C.rust : C.ochre, width: `${plan.type === 'project' ? pct : goalPct}%`, transition: 'width 0.4s ease' }}/>
        </div>
      )}

      {plan.type === 'goal' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ background: '#f5f0d8', color: '#7a6a20', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
            {plan.unit}{(plan.target - plan.current).toLocaleString()} to go
          </span>
        </div>
      )}

      {(plan.type === 'project' || plan.type === 'event') && preview.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', borderTop: `1px solid ${C.hairline}`, fontSize: 12, color: C.ink }}>
          <div style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${C.border}`, flexShrink: 0 }}/>
          {t.label}
        </div>
      ))}
      {(plan.type === 'project' || plan.type === 'event') && extra > 0 && (
        <div style={{ fontSize: 11, color: C.inkMute, padding: '5px 0', borderTop: `1px solid ${C.hairline}`, marginTop: 2 }}>+ {extra} more task{extra !== 1 ? 's' : ''}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no syntax errors**

In terminal (from `web/`):
```
npx next build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no errors mentioning `PlanCard` or the lines you edited. (Build warnings about unused vars are fine.)

- [ ] **Step 3: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add PlanCard component (project/goal/event)"
```

---

### Task 3: AddPlanSheet component

**Files:**
- Modify: `web/app/page.jsx` — insert AddPlanSheet immediately after PlanCard

- [ ] **Step 1: Insert AddPlanSheet after PlanCard**

Find the closing `}` of `PlanCard` and insert immediately after:

```js
// ── AddPlanSheet ─────────────────────────────────────────────────
const PLAN_TYPES = [
  { type: 'project', icon: '📦', label: 'Project',  desc: 'A goal with a checklist of steps' },
  { type: 'goal',    icon: '🎯', label: 'Goal',     desc: 'Something to work toward with a measurable target' },
  { type: 'event',   icon: '📅', label: 'Event',    desc: 'A date you\'re preparing for' },
]

function AddPlanSheet({ onClose, onAdd }) {
  const [step, setStep]   = useState('pick')   // 'pick' | 'form'
  const [type, setType]   = useState(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate]         = useState('')
  const [tasksText, setTasksText]     = useState('')
  const [targetAmt, setTargetAmt]     = useState('')
  const [unit, setUnit]               = useState('₱')
  const [targetDate, setTargetDate]   = useState('')
  const [eventDate, setEventDate]     = useState('')

  const inputStyle = { width: '100%', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 4 }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: C.inkMute, display: 'block', marginTop: 12 }

  const handleSubmit = () => {
    if (!title.trim()) return
    const parsedTasks = tasksText.split('\n').map(s => s.trim()).filter(Boolean).map(label => ({ label, done: false }))
    const plan = { id: `plan-${Date.now()}`, type, icon: PLAN_TYPES.find(p => p.type === type).icon, title: title.trim() }
    if (type === 'project') { plan.dueDate = dueDate || 'No due date'; plan.tasks = parsedTasks }
    if (type === 'goal')    { plan.current = 0; plan.target = parseFloat(targetAmt) || 0; plan.unit = unit || ''; plan.targetDate = targetDate || 'No target date' }
    if (type === 'event')   { plan.eventDate = eventDate ? new Date(eventDate) : null; plan.tasks = parsedTasks }
    onAdd(plan)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `22px 22px calc(22px + env(safe-area-inset-bottom)) 22px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 18px' }}/>

        {step === 'pick' && (
          <>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.warmDark, marginBottom: 4 }}>What kind of plan?</div>
            <div style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 18 }}>Choose a type to get started</div>
            {PLAN_TYPES.map(pt => (
              <button key={pt.type} onClick={() => { setType(pt.type); setStep('form') }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: PLAN_ICON_BG[pt.type], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{pt.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{pt.label}</div>
                  <div style={{ fontSize: 12, color: C.inkMute, marginTop: 2 }}>{pt.desc}</div>
                </div>
              </button>
            ))}
            <button onClick={onClose} style={{ width: '100%', background: 'transparent', border: 'none', color: C.inkMute, fontSize: 13, cursor: 'pointer', padding: '10px 0', fontFamily: 'inherit' }}>Cancel</button>
          </>
        )}

        {step === 'form' && type && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Back</button>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.warmDark }}>
                {PLAN_TYPES.find(p => p.type === type).icon} New {PLAN_TYPES.find(p => p.type === type).label}
              </div>
            </div>

            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} placeholder="e.g. Move apartments" value={title} onChange={e => setTitle(e.target.value)} autoFocus/>

            {type === 'project' && (
              <>
                <label style={labelStyle}>Due date (optional)</label>
                <input type="date" style={inputStyle} value={dueDate} onChange={e => setDueDate(e.target.value)}/>
                <label style={labelStyle}>Tasks (one per line, optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder={"Book moving truck\nPack bedroom\nNotify landlord"} value={tasksText} onChange={e => setTasksText(e.target.value)}/>
              </>
            )}

            {type === 'goal' && (
              <>
                <label style={labelStyle}>Target amount *</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input style={{ ...inputStyle, width: 64, marginTop: 0 }} placeholder="₱" value={unit} onChange={e => setUnit(e.target.value)}/>
                  <input type="number" style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="50000" value={targetAmt} onChange={e => setTargetAmt(e.target.value)}/>
                </div>
                <label style={labelStyle}>Target date (optional)</label>
                <input style={inputStyle} placeholder="e.g. Aug 2026" value={targetDate} onChange={e => setTargetDate(e.target.value)}/>
              </>
            )}

            {type === 'event' && (
              <>
                <label style={labelStyle}>Event date *</label>
                <input type="date" style={inputStyle} value={eventDate} onChange={e => setEventDate(e.target.value)}/>
                <label style={labelStyle}>Prep tasks (one per line, optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder={"Research the company\nIron outfit"} value={tasksText} onChange={e => setTasksText(e.target.value)}/>
              </>
            )}

            <button onClick={handleSubmit} style={{ ...getBtnPrimary(), width: '100%', marginTop: 18, padding: '11px 0', fontSize: 14, borderRadius: 10 }}>
              Create plan
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no syntax errors**

```
npx next build 2>&1 | grep -E "^.*error" | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add AddPlanSheet component with type picker and per-type form"
```

---

### Task 4: PlansPanel component

**Files:**
- Modify: `web/app/page.jsx` — insert PlansPanel immediately after AddPlanSheet

- [ ] **Step 1: Insert PlansPanel after AddPlanSheet**

Find the closing `}` of `AddPlanSheet` and insert immediately after:

```js
// ── PlansPanel ───────────────────────────────────────────────────
function PlansPanel() {
  const [plans, setPlans] = useState(DEMO_PLANS)
  const [addOpen, setAddOpen] = useState(false)
  return (
    <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setAddOpen(true)} style={getBtnPrimary()}>+ Add plan</button>
      </div>
      {plans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: C.inkMute, fontSize: 13, fontStyle: 'italic' }}>
          No plans yet. Tap "+ Add plan" to create a goal, project, or event.
        </div>
      )}
      {plans.map((p, i) => <PlanCard key={p.id} plan={p} delay={i * 50}/>)}
      {addOpen && <AddPlanSheet onClose={() => setAddOpen(false)} onAdd={p => { setPlans(ps => [p, ...ps]); setAddOpen(false) }}/>}
    </div>
  )
}
```

- [ ] **Step 2: Verify no syntax errors**

```
npx next build 2>&1 | grep -E "^.*error" | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add PlansPanel with plan list and add-plan flow"
```

---

### Task 5: LifeEventsPanel + LifeTab + wire HeedApp + deploy

**Files:**
- Modify: `web/app/page.jsx` — replace `ContextTab` function with `LifeEventsPanel` + `LifeTab`, update HeedApp render

- [ ] **Step 1: Replace ContextTab with LifeEventsPanel + LifeTab**

Find the function definition line:
```js
function ContextTab({ upcoming, active, activeContext, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }) {
  const allUpcoming = [...(active || []).map(mapApiContext), ...(upcoming || []).map(mapApiContext)]
```

Delete the entire `ContextTab` function (from that line through its closing `}`) and replace with:

```js
// ── LifeEventsPanel ─────────────────────────────────────────────
function LifeEventsPanel({ allUpcoming, activeContext, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }) {
  return (
    <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {CONTEXT_CHIPS.map(c => (
          <button key={c.type} onClick={() => onQuickContext(c.type)}
            style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '6px 14px', fontSize: 12, color: C.ink, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.ochre; e.currentTarget.style.background = C.ochreSoft }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.paper }}
          >{c.label}</button>
        ))}
        <button onClick={onAddContext}
          style={{ background: 'transparent', border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '6px 14px', fontSize: 12, color: C.inkSoft, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.ochre }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border }}
        >+ Add event</button>
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
        {allUpcoming.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', padding: '8px 0' }}>Nothing on the horizon. Tap a chip above if something came up, or "+ Add event" to plan ahead.</div>
        ) : allUpcoming.map((c, i) => (
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
        <span>You can also tell Heed in plain language — try <em>"I'm sick this week"</em> or <em>"I'm traveling next month."</em></span>
      </div>
    </div>
  )
}

// ── LifeTab ──────────────────────────────────────────────────────
function LifeTab({ upcoming, active, activeContext, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }) {
  const [subtab, setSubtab] = useState('plans')
  const allUpcoming = [...(active || []).map(mapApiContext), ...(upcoming || []).map(mapApiContext)]
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <SectionHeader>Life</SectionHeader>
        <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', marginTop: -8 }}>Your plans and life events, in one place.</div>
      </div>
      <div style={{ display: 'flex', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, marginBottom: 18, gap: 4 }}>
        <SegmentButton active={subtab === 'plans'} onClick={() => setSubtab('plans')} label="Plans" count={DEMO_PLANS.length} accent={C.warmDark}/>
        <SegmentButton active={subtab === 'events'} onClick={() => setSubtab('events')} label="Life Events" count={allUpcoming.length} accent={C.sage}/>
      </div>
      {subtab === 'plans'  && <PlansPanel/>}
      {subtab === 'events' && (
        <LifeEventsPanel
          allUpcoming={allUpcoming}
          activeContext={activeContext}
          onAddContext={onAddContext}
          onQuickContext={onQuickContext}
          onImBetter={onImBetter}
          onExtend={onExtend}
          onDetailOpen={onDetailOpen}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update HeedApp render to use LifeTab**

Find this line (around line 3238):
```js
        {tab === 'context' && <ContextTab upcoming={apiContexts.upcoming} active={apiContexts.active} activeContext={activeContext} onAddContext={() => setContextModalOpen(true)} onQuickContext={type => setQuickContextType(type)} onImBetter={() => setRecoveryOpen(true)} onExtend={handleExtendContext} onDetailOpen={handleDetailOpen}/>}
```

Change `ContextTab` to `LifeTab`:
```js
        {tab === 'context' && <LifeTab upcoming={apiContexts.upcoming} active={apiContexts.active} activeContext={activeContext} onAddContext={() => setContextModalOpen(true)} onQuickContext={type => setQuickContextType(type)} onImBetter={() => setRecoveryOpen(true)} onExtend={handleExtendContext} onDetailOpen={handleDetailOpen}/>}
```

- [ ] **Step 3: Visual verify in dev server**

Make sure dev server is running (`npm run dev` in `web/`). Open `http://localhost:3000`.

- Bottom nav shows **"Life"**
- Tap "Life" → see "Life" heading with subtitle and segment control
- **Plans** segment (default): three plan cards — 📦 Move apartments (43% progress bar, 2 task previews), 📅 Job interview (countdown badge, task list), 🎯 Save ₱50,000 (63% progress, chip)
- Tap **"+ Add plan"**: sheet slides up with three type rows (Project / Goal / Event)
- Tap any type: form slides in with Back button, title field, type-specific fields, "Create plan" button
- Fill in a title and tap "Create plan": sheet closes, new card appears at top of list
- **Life Events** segment: chips row (🌿 Sick · 🌾 Busy week · ✈️ Traveling · 🌸 Celebration · + Add event), Singapore trip in Upcoming, 3 past events
- Tap a chip: QuickContextSheet slides up (existing feature, unchanged)

- [ ] **Step 4: Build static export**

```
cd web && npm run build
```
Expected: `✓ Generating static pages (4/4)` with no errors.

- [ ] **Step 5: Commit and push**

```
git add web/app/page.jsx web/out
git commit -m "feat: Life tab — Plans + Life Events segments with plan cards and add-plan sheet"
git push
```

Expected: GitHub Actions CI triggers, deploys to `https://brave-pond-035757400.7.azurestaticapps.net/` within ~1 minute.
