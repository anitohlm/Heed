# See Plan Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the "See plan →" button on the ContextBanner so it expands inline to show a structured before/during/after trip plan, with an "Ask Heed →" link that switches to the Ask Heed tab with the query pre-filled.

**Architecture:** All changes are in `web/app/page.jsx`. A static demo upcoming-context object (with a `plan` field) is added as a fallback when the API has no data. `ContextBanner` gains local `planExpanded` state and an inline plan render. A new `askPrefill` state in `App` is threaded down through `TodayTab` → `ContextBanner` → triggers a tab switch to Ask Heed when the link is clicked.

**Tech Stack:** React 18, Next.js 14, inline styles only (no CSS modules), no test framework — browser smoke tests used throughout.

---

### Task 1: Add static demo upcoming context with plan data

**Files:**
- Modify: `web/app/page.jsx` — add `CONTEXTS_UPCOMING_DEMO` constant (after `CONTEXTS_PAST` at line 55), update the `upcomingContexts` derived value in `HeedApp` (line 1364)

**Context:** `upcomingContexts` is currently derived 100% from the API (`apiContexts`). When the backend is offline the banner never renders, so the feature can't be demoed. We add a static fallback that activates only when the API returned nothing.

- [ ] **Step 1: Add `CONTEXTS_UPCOMING_DEMO` constant**

  In `web/app/page.jsx`, find the line:
  ```js
  const CONTEXTS_PAST = [
  ```
  (line 51). The `CONTEXTS_PAST` array ends on line 55 with `]`. Insert the following immediately after the closing `]` of `CONTEXTS_PAST`:

  ```js
  const CONTEXTS_UPCOMING_DEMO = [
    {
      type: 'travel',
      start: 'Apr 28, 2026',
      end: 'May 2, 2026',
      desc: 'Singapore trip',
      _startDate: new Date('2026-04-28'),
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
          'Soft-start May 3 — essentials only',
          'Aircon cleaning can wait until that weekend',
        ],
      },
    },
  ]
  ```

- [ ] **Step 2: Fall back to demo data in `upcomingContexts`**

  Find the `upcomingContexts` derived value in `HeedApp` (line 1364):
  ```js
  const upcomingContexts = [
    ...(apiContexts.upcoming || []).map(c => ({ ...mapApiContext(c), _startDate: c.start_date ? new Date(c.start_date) : null })),
    ...(apiContexts.active || []).map(c => ({ ...mapApiContext(c), _startDate: c.start_date ? new Date(c.start_date) : null })),
  ]
  ```

  Replace it with:
  ```js
  const apiUpcoming = [
    ...(apiContexts.upcoming || []).map(c => ({ ...mapApiContext(c), _startDate: c.start_date ? new Date(c.start_date) : null })),
    ...(apiContexts.active || []).map(c => ({ ...mapApiContext(c), _startDate: c.start_date ? new Date(c.start_date) : null })),
  ]
  const upcomingContexts = apiUpcoming.length > 0 ? apiUpcoming : CONTEXTS_UPCOMING_DEMO
  ```

- [ ] **Step 3: Verify dev server compiles**

  From `web/`:
  ```
  npm run dev
  ```
  Expected: `✓ Ready` with no errors. The ContextBanner should now appear on the Today tab showing the Singapore trip even with the backend offline.

- [ ] **Step 4: Commit**

  ```bash
  git add web/app/page.jsx
  git commit -m "feat: add static demo upcoming context with plan data"
  ```

---

### Task 2: Add `askPrefill` state and `handleAskHeed` callback to App

**Files:**
- Modify: `web/app/page.jsx` — `HeedApp` component state + new callback

**Context:** `ContextBanner` will call `onAskHeed(query)` when the user clicks "Ask Heed →". App owns the `tab` state, so the callback must live here. `AskTab` will receive `prefill` as a prop (Task 4) — App passes it down.

- [ ] **Step 1: Add `askPrefill` state**

  Find (line 1335–1341):
  ```js
  const [tab, setTab] = useState('today')
  const [toast, setToast] = useState(null)
  ```

  Add `askPrefill` immediately after:
  ```js
  const [tab, setTab] = useState('today')
  const [toast, setToast] = useState(null)
  const [askPrefill, setAskPrefill] = useState('')
  ```

- [ ] **Step 2: Add `handleAskHeed` callback**

  Find `const handleToastView = useCallback(() => {` (around line 1399). Add `handleAskHeed` immediately before it:

  ```js
  const handleAskHeed = useCallback((query) => {
    setAskPrefill(query)
    setTab('ask')
  }, [])
  ```

- [ ] **Step 3: Pass `askPrefill` to `AskTab` and `onAskHeed` to `TodayTab`**

  Find the JSX render lines in the `<main>` section (around line 1526):
  ```jsx
  {tab === 'today' && <TodayTab tasks={displayTasks} routines={routines} upcomingContexts={upcomingContexts} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine}/>}
  {tab === 'calendar' && <CalendarTab/>}
  {tab === 'ask' && <AskTab/>}
  ```

  Change to:
  ```jsx
  {tab === 'today' && <TodayTab tasks={displayTasks} routines={routines} upcomingContexts={upcomingContexts} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAskHeed={handleAskHeed}/>}
  {tab === 'calendar' && <CalendarTab/>}
  {tab === 'ask' && <AskTab prefill={askPrefill}/>}
  ```

- [ ] **Step 4: Verify dev server compiles**

  Check the terminal — no new errors expected. The app behaviour doesn't change yet (TodayTab doesn't forward `onAskHeed` to `ContextBanner` until Task 3).

- [ ] **Step 5: Commit**

  ```bash
  git add web/app/page.jsx
  git commit -m "feat: add askPrefill state and handleAskHeed callback to App"
  ```

---

### Task 3: Thread `onAskHeed` through `TodayTab` to `ContextBanner`

**Files:**
- Modify: `web/app/page.jsx` — `TodayTab` function signature + `ContextBanner` call

- [ ] **Step 1: Add `onAskHeed` to `TodayTab` signature**

  Find (line 617):
  ```js
  function TodayTab({ tasks, routines, upcomingContexts, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine }) {
  ```

  Change to:
  ```js
  function TodayTab({ tasks, routines, upcomingContexts, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine, onAskHeed }) {
  ```

- [ ] **Step 2: Forward `onAskHeed` to `ContextBanner`**

  Find (line 624):
  ```jsx
  <ContextBanner upcomingContexts={upcomingContexts}/>
  ```

  Change to:
  ```jsx
  <ContextBanner upcomingContexts={upcomingContexts} onAskHeed={onAskHeed}/>
  ```

- [ ] **Step 3: Verify compiles**

  Check terminal — no errors expected.

- [ ] **Step 4: Commit**

  ```bash
  git add web/app/page.jsx
  git commit -m "feat: thread onAskHeed prop through TodayTab to ContextBanner"
  ```

---

### Task 4: Wire `AskTab` to accept and apply a `prefill` prop

**Files:**
- Modify: `web/app/page.jsx` — `AskTab` function signature + `useEffect`

**Context:** When `prefill` changes (non-empty string), the input field should be populated so the user just has to hit Send. We don't auto-submit — the user stays in control. `prefill` is reset to `''` by App after the user navigates away (not in scope here — the input just gets populated once).

- [ ] **Step 1: Add `prefill` prop and `useEffect` to `AskTab`**

  Find (line 684):
  ```js
  function AskTab() {
    const { messages, input, setInput, thinking, streaming, busy, send } = useChat()
    const scrollRef = useRef(null)
  ```

  Change to:
  ```js
  function AskTab({ prefill = '' }) {
    const { messages, input, setInput, thinking, streaming, busy, send } = useChat()
    const scrollRef = useRef(null)
    useEffect(() => {
      if (prefill) setInput(prefill)
    }, [prefill])
  ```

- [ ] **Step 2: Verify dev server compiles**

  Check terminal — no errors expected.

- [ ] **Step 3: Commit**

  ```bash
  git add web/app/page.jsx
  git commit -m "feat: AskTab accepts prefill prop to pre-populate query input"
  ```

---

### Task 5: Implement `ContextBanner` expand/collapse with inline plan

**Files:**
- Modify: `web/app/page.jsx` — `ContextBanner` function

**Context:** This is the main visual change. The banner currently renders in a flat `display: flex` row. We change the outer container to `flexDirection: column` and conditionally show the expanded plan section below the header row. The button toggles between "See plan →" and "Hide plan ↑". The "Ask Heed →" link fires `onAskHeed(ctx.askQuery)`.

The `plan` field is optional — if `ctx.plan` is absent, the button doesn't render (so API-sourced contexts without a plan field show no button).

- [ ] **Step 1: Replace the entire `ContextBanner` function**

  Find the entire `ContextBanner` function (lines 582–614):
  ```js
  // ── ContextBanner ──────────────────────────────────────────────
  function ContextBanner({ upcomingContexts }) {
    const [hover, setHover] = useState(false)
    if (!upcomingContexts || upcomingContexts.length === 0) return null
    const ctx = upcomingContexts[0]
    const daysAway = ctx._startDate ? Math.ceil((ctx._startDate - new Date()) / 86400000) : null
    return (
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: `linear-gradient(120deg, ${C.ochreSoft} 0%, ${C.bellySoft} 100%)`,
          border: `1px solid ${C.ochre}66`, borderRadius: 14, padding: '14px 18px', marginBottom: 22,
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: hover ? C.shadowMed : C.shadowSoft, transition: 'all 0.2s ease',
          position: 'relative', overflow: 'hidden', animation: 'heed-fadeUp 0.5s ease both',
        }}
      >
        <div style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, opacity: 0.08, background: C.ochre, borderRadius: '50%' }}/>
        <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>✈️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.warmDark, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 }}>
            Upcoming{daysAway != null ? ` · ${daysAway} days away` : ''}
          </div>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>
            <strong>{ctx.desc}</strong>{ctx.start && ctx.end ? ` ${ctx.start} – ${ctx.end}.` : ''}{' '}
            I've already noted this to plan around it.
          </div>
        </div>
        <button style={{ ...btnGhost, fontSize: 12, whiteSpace: 'nowrap' }}>See plan →</button>
      </div>
    )
  }
  ```

  Replace it with:
  ```js
  // ── ContextBanner ──────────────────────────────────────────────
  function ContextBanner({ upcomingContexts, onAskHeed }) {
    const [hover, setHover] = useState(false)
    const [planExpanded, setPlanExpanded] = useState(false)
    if (!upcomingContexts || upcomingContexts.length === 0) return null
    const ctx = upcomingContexts[0]
    const daysAway = ctx._startDate ? Math.ceil((ctx._startDate - new Date()) / 86400000) : null
    return (
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: `linear-gradient(120deg, ${C.ochreSoft} 0%, ${C.bellySoft} 100%)`,
          border: `1px solid ${C.ochre}66`, borderRadius: 14, padding: '14px 18px', marginBottom: 22,
          boxShadow: hover ? C.shadowMed : C.shadowSoft, transition: 'all 0.2s ease',
          position: 'relative', overflow: 'hidden', animation: 'heed-fadeUp 0.5s ease both',
        }}
      >
        <div style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, opacity: 0.08, background: C.ochre, borderRadius: '50%' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>✈️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.warmDark, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 }}>
              Upcoming{daysAway != null ? ` · ${daysAway} days away` : ''}
            </div>
            <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>
              <strong>{ctx.desc}</strong>{ctx.start && ctx.end ? ` ${ctx.start} – ${ctx.end}.` : ''}{' '}
              I've already noted this to plan around it.
            </div>
          </div>
          {ctx.plan && (
            <button
              onClick={() => setPlanExpanded(e => !e)}
              style={{ ...btnGhost, fontSize: 12, whiteSpace: 'nowrap', color: planExpanded ? C.warmDark : C.inkSoft, borderColor: planExpanded ? `${C.ochre}44` : C.border }}
            >
              {planExpanded ? 'Hide plan ↑' : 'See plan →'}
            </button>
          )}
        </div>
        {planExpanded && ctx.plan && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, animation: 'heed-fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: C.ochre, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>Before you leave</div>
                {ctx.plan.before.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: C.inkSoft, marginBottom: 4, lineHeight: 1.4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.ochre, flexShrink: 0, marginTop: 5 }}/>
                    {item}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                {ctx.plan.during.length > 0 && (
                  <>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: C.sage, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>While away</div>
                    {ctx.plan.during.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: C.inkSoft, marginBottom: 4, lineHeight: 1.4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.sage, flexShrink: 0, marginTop: 5 }}/>
                        {item}
                      </div>
                    ))}
                  </>
                )}
                {ctx.plan.after.length > 0 && (
                  <>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginTop: ctx.plan.during.length > 0 ? 10 : 0 }}>When you're back</div>
                    {ctx.plan.after.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: C.inkSoft, marginBottom: 4, lineHeight: 1.4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.inkMute, flexShrink: 0, marginTop: 5 }}/>
                        {item}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
            {ctx.askQuery && onAskHeed && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: C.inkMute }}>Want a more detailed plan?</span>
                <button
                  onClick={() => onAskHeed(ctx.askQuery)}
                  style={{ background: 'none', border: 'none', color: C.sage, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                >
                  Ask Heed →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify dev server compiles**

  Check terminal — no errors expected.

- [ ] **Step 3: Browser smoke test — expand/collapse**

  Open `http://localhost:3000` (or the port shown in the terminal).

  - On the Today tab, the Singapore trip banner should be visible.
  - Click **"See plan →"**: the banner should expand to show Before / While Away / When you're back sections.
  - Button label should switch to **"Hide plan ↑"**.
  - Click **"Hide plan ↑"**: the plan should collapse.
  - Button label should switch back to **"See plan →"**.

- [ ] **Step 4: Browser smoke test — Ask Heed hand-off**

  With the plan expanded, click **"Ask Heed →"**.

  Expected:
  - App switches to the **Ask Heed** tab.
  - The query input is pre-filled with `"Plan around my Singapore trip"`.
  - The user has not yet submitted — they can edit or hit Send.

- [ ] **Step 5: Commit**

  ```bash
  git add web/app/page.jsx
  git commit -m "feat: wire See Plan button — inline expand with Ask Heed hand-off"
  ```

---

### Task 6: Push to remote

- [ ] **Step 1: Push**

  ```bash
  git push
  ```

  Expected: branch `main` pushed to remote, GitHub Actions deploys to Azure Static Web Apps.
