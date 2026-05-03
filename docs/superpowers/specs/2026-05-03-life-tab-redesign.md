# Life Tab Redesign

**Goal:** Rename the Plans tab to "Life" and give it two segments — Plans (goals, projects, events you create) and Life Events (existing sick/travel/busy context feature) — matching the Tracks tab pattern.

**Architecture:** All UI in `web/app/page.jsx`. The existing `ContextTab` component is replaced by a new `LifeTab` component with a segment control. A new `PlansPanel` handles plan cards and the add-plan flow. The existing `LifeEventsPanel` is the renamed/refactored body of the current `ContextTab`. No new API or routing needed for the demo.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern)

---

## 1. Tab rename

- `APP_TABS` entry: `{ id: 'context', label: 'Life' }` — id unchanged, label changes from `'Plans'` to `'Life'`
- All existing references to the `context` tab ID remain as-is
- Bottom nav icon/label shows "Life"

---

## 2. LifeTab component

Replaces `ContextTab`. Renders a segment control then the active panel.

```jsx
function LifeTab({ upcoming, active, activeContext, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }) {
  const [subtab, setSubtab] = useState('plans')
  const allUpcoming = [...(active || []).map(mapApiContext), ...(upcoming || []).map(mapApiContext)]
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <SectionHeader>Life</SectionHeader>
        <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', marginTop: -8 }}>
          Your plans and life events, in one place.
        </div>
      </div>
      <div style={{ display: 'flex', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, marginBottom: 18, gap: 4 }}>
        <SegmentButton active={subtab === 'plans'} onClick={() => setSubtab('plans')} label="Plans" count={DEMO_PLANS.length} accent={C.warmDark} />
        <SegmentButton active={subtab === 'events'} onClick={() => setSubtab('events')} label="Life Events" count={allUpcoming.length} accent={C.sage} />
      </div>
      {subtab === 'plans'  && <PlansPanel />}
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

---

## 3. PlansPanel component

Renders the list of plan cards and the "+ Add plan" button. Demo data only — no API wiring.

```jsx
function PlansPanel() {
  const [plans, setPlans] = useState(DEMO_PLANS)
  const [addOpen, setAddOpen] = useState(false)
  return (
    <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setAddOpen(true)} style={getBtnPrimary()}>+ Add plan</button>
      </div>
      {plans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: C.inkMute, fontSize: 13, fontStyle: 'italic' }}>
          No plans yet. Tap "+ Add plan" to create a goal, project, or event.
        </div>
      )}
      {plans.map((p, i) => <PlanCard key={p.id} plan={p} delay={i * 50} />)}
      {addOpen && <AddPlanSheet onClose={() => setAddOpen(false)} onAdd={p => { setPlans(ps => [p, ...ps]); setAddOpen(false) }} />}
    </div>
  )
}
```

### Demo data

```js
const DEMO_PLANS = [
  {
    id: 'plan-1', type: 'project', icon: '📦', title: 'Move apartments',
    dueDate: 'Jun 15', tasks: [
      { label: 'Book moving truck', done: true },
      { label: 'Notify landlord', done: true },
      { label: 'Pack bedroom', done: false },
      { label: 'Transfer utilities', done: false },
      { label: 'Update address with bank', done: false },
    ],
  },
  {
    id: 'plan-2', type: 'event', icon: '📅', title: 'Job interview — Acme Co.',
    eventDate: new Date('2026-05-08'), tasks: [
      { label: 'Research the company', done: true },
      { label: 'Prepare questions to ask', done: false },
      { label: 'Iron outfit', done: false },
    ],
  },
  {
    id: 'plan-3', type: 'goal', icon: '🎯', title: 'Save ₱50,000',
    current: 31500, target: 50000, unit: '₱', targetDate: 'Aug 2026',
  },
]
```

---

## 4. PlanCard component

Branches on `plan.type`. All cards share the same outer shell.

**Shared shell:**
```jsx
<div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
    <div style={{ width: 34, height: 34, borderRadius: 9, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{plan.icon}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{plan.title}</div>
      <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>{subtitle}</div>
    </div>
    {badge}
  </div>
  {body}
</div>
```

**Project type:**
- `subtitle`: `"N of M tasks · Due [dueDate]"`
- `badge`: percentage (`doneCount / tasks.length * 100`) in `C.rust` colour
- `body`: progress bar (rust fill) + first 2 undone tasks as checkmark rows + "N more tasks" muted line if remainder > 0
- Completed task rows show the checkmark filled sage green; pending rows show empty border

**Goal type:**
- `subtitle`: `"[unit][current] saved · Target [targetDate]"`
- `badge`: percentage in ochre colour
- `body`: progress bar (ochre fill) + two chips: `"[unit][remaining] to go"` and `"N months left"`

**Event type:**
- `subtitle`: `"[formatted date] · in N days"` (days calculated from today; colour turns rust when ≤ 7 days)
- `badge`: `"N left"` pill in sage if there are undone tasks, else nothing
- `body`: same task row pattern as Project — first 2 rows shown, remainder as "+ N more tasks"

---

## 5. AddPlanSheet component

Bottom sheet. Slides up from bottom using existing `heed-slideUp` animation pattern.

**Step 1 — type picker:** Three tappable rows with icon + label + description:
- 📦 **Project** — "A goal with a checklist of steps"
- 🎯 **Goal** — "Something to work toward with a measurable target"
- 📅 **Event** — "A date you're preparing for"

**Step 2 — create form** (shown after type selection, same sheet):

*Project form fields:* Title (text), Due date (date input, optional), Initial tasks (textarea, one per line, optional)

*Goal form fields:* Title (text), Target amount (number), Unit prefix (text, e.g. "₱"), Target date (month picker, optional)

*Event form fields:* Title (text), Event date (date input, required), Prep tasks (textarea, one per line, optional)

**Submit:** "Create plan" button (primary). Generates a plan object with a unique `id` (`Date.now().toString()`), parses textarea lines into task arrays, adds to `plans` state. Sheet closes on submit.

**Dismiss:** tap backdrop or "Cancel" text button at top-left of sheet.

---

## 6. LifeEventsPanel component

Extracted from the current `ContextTab` body — identical behaviour, new component name.

Props: `{ allUpcoming, activeContext, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }`

Content (unchanged from current `ContextTab`):
- Quick chips row: 🌿 Sick · 🌾 Busy week · ✈️ Traveling · 🌸 Celebration
- `ActiveContextCard` (if `activeContext` is set)
- "+ Add event" button (calls `onAddContext`)
- Upcoming card with `ContextRow` list
- Past card with `CONTEXTS_PAST` rows
- Plain-language tip at bottom

---

## 7. HeedApp wiring

- In the tab render block, replace `tab === 'context' && <ContextTab .../>` with `tab === 'context' && <LifeTab .../>` — same props, no new ones needed for the demo
- The old `ContextTab` function is removed (replaced by `LifeTab` + `LifeEventsPanel`)

---

## 8. What doesn't change

- `ContextRow`, `ActiveContextCard`, `QuickContextSheet`, `RecoverySummarySheet`, `AddContextModal` — unchanged
- Calendar context markers — unchanged
- All other tabs — unchanged
- `APP_TABS` entry id stays `'context'` — only the label changes to `'Life'`
