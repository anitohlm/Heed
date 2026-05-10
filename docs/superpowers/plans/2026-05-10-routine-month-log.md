# Routine Month Log + Per-Item Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary `completion14d: bool[]` with `{done, total}[]` so every day records the fraction of items completed, then build a calendar-month detail screen (opened from each routine card) that renders the history as a continuously-shaded heatmap.

**Architecture:** All changes live in `web/app/page.jsx`. The data shape change is a one-shot frontend migration with lazy back-compat in the read path (the backend stores routines as opaque JSON via `PUT /api/user_state/routines`, so no backend work). Per-item check-off and the `lightenedItems` mechanism already exist; the work is making the daily aggregation honest about partial completion. The month log is a new top-level screen rendered behind a portal, addressed by routine id.

**Tech Stack:** React 18, Next.js 14, inline styles via the `C` theme proxy, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-10-routine-month-log-design.md`

---

## File Map

| File | Change |
|---|---|
| `web/app/page.jsx` (helpers near line 150 + 8484) | Add `normaliseCompletionEntry`, `entryIsFullyDone`, `entryFrac`. Update `computeStreakCount`, `computeCompletionPct`, `routineDayState` to read both old (`bool`) and new (`{done,total}`) entries. |
| `web/app/page.jsx:12113` (`handleMarkRoutineDay`) | When toggling a per-item state, write `{done, total}` (not boolean `true`) to `completion14d[len-1]`. |
| `web/app/page.jsx:12077` (`handleMarkRoutineDone`) | "Mark all done" — set the trailing entry to `{done: total, total}` and fill `todayItemsDone` with all live items. |
| `web/app/page.jsx` (HeedApp body, near other top-level effects ~line 11380) | Add a daily-rollover effect: on mount and on each visibility change, advance any routine whose trailing entry is for a date older than today. |
| `web/app/page.jsx` (insert near `RoutineCard` ~line 3685) | Add `RoutineMonthLog` component (the new screen) + a `mixSageBeige(frac)` color helper. |
| `web/app/page.jsx:3685+` (`RoutineCard`) | Add a "See month log →" footer row inside each card. |
| `web/app/page.jsx` (HeedApp + `TracksTab`) | Add `monthLogRoutineId` state, plumb open/close handlers from `TracksTab` → `RoutineCard`, render `RoutineMonthLog` inside the same portal stack as other detail screens. |
| `agents/advisor.py:318+` | One-line change: read `completion14d[i]` as `bool(c.done === c.total)` instead of `bool(c)`. |

No backend changes (functions, AI Search, OpenAI). No new endpoints. No DB migrations.

---

## Design Token Quick Reference

Available via `C` proxy: `C.cream, C.paper, C.paperHi, C.border, C.hairline, C.bellySoft, C.ink, C.inkSoft, C.inkMute, C.warmDark, C.rust, C.sage, C.sageSoft, C.ochre`.

Existing helpers in scope: `startOfWeek, addDays, sameDay, parseDue, routineDays, computeStreakCount, computeCompletionPct, routineDayState, FUNCTIONS_URL, authHeaders, isDemoMode`.

---

## Task 1 — Data shape: `bool` ⇄ `{done, total}` back-compat

**Files:**
- Modify: `web/app/page.jsx` near line 150 (helpers `computeStreakCount` / `computeCompletionPct` already live here).

- [ ] **Step 1: Insert three small normalisation helpers**

Above the existing `function computeStreakCount(...)` (around line 150), insert:

```jsx
// Normalise one completion14d entry. Accepts the legacy boolean shape
// (true = fully done that day) and the new {done, total} shape. Returns
// {done: number, total: number}. Caller passes the routine's current live
// item count so legacy `true` can be expanded to a fraction with the right
// denominator.
function normaliseCompletionEntry(entry, liveTotal) {
  if (entry && typeof entry === 'object' && typeof entry.done === 'number' && typeof entry.total === 'number') {
    return { done: Math.max(0, entry.done|0), total: Math.max(0, entry.total|0) }
  }
  if (entry === true)  return { done: liveTotal, total: liveTotal }
  return { done: 0, total: liveTotal }
}
function entryIsFullyDone(entry) {
  return entry && entry.total > 0 && entry.done === entry.total
}
function entryFrac(entry) {
  if (!entry || !entry.total) return 0
  return Math.min(1, Math.max(0, entry.done / entry.total))
}
```

- [ ] **Step 2: Update `computeStreakCount` to read either shape**

Replace the existing function (around line 150) with:

```jsx
function computeStreakCount(completion14d, routine) {
  const liveTotal = (routine?.items || []).filter(it => !(routine?.lightenedItems || []).includes(it)).length || (routine?.items || []).length || 1
  let count = 0
  for (let i = (completion14d || []).length - 1; i >= 0; i--) {
    const e = normaliseCompletionEntry(completion14d[i], liveTotal)
    if (!entryIsFullyDone(e)) break
    count++
  }
  return count
}
```

- [ ] **Step 3: Update `computeCompletionPct` to read either shape**

Replace the existing function (around line 162) with:

```jsx
function computeCompletionPct(completion14d, routine) {
  const arr = completion14d || []
  if (arr.length === 0) return 0
  const liveTotal = (routine?.items || []).filter(it => !(routine?.lightenedItems || []).includes(it)).length || (routine?.items || []).length || 1
  const fullDays = arr.filter(e => entryIsFullyDone(normaliseCompletionEntry(e, liveTotal))).length
  return Math.round(fullDays / arr.length * 100)
}
```

- [ ] **Step 4: Update every call site for the new signature**

Search the file for `computeStreakCount(` and `computeCompletionPct(` and add the routine arg at each call:

```bash
git grep -n "computeStreakCount\|computeCompletionPct" web/app/page.jsx
```

Expected hits: ~lines 3441–3442 inside `RoutineCard` and possibly inside the share-card composer. Update each:

```jsx
// before
const streak = computeStreakCount(routine.completion14d)
const pct = computeCompletionPct(routine.completion14d)
// after
const streak = computeStreakCount(routine.completion14d, routine)
const pct = computeCompletionPct(routine.completion14d, routine)
```

- [ ] **Step 5: Update `routineDayState` (used by Calendar streak grid)**

Find `function routineDayState(routine, date, today = new Date())` around line 8495. The current line `return arr[idx] ? 'done' : 'missed'` reads a raw boolean. Replace the function body's last three lines with:

```jsx
  const arr = routine.completion14d || []
  const idx = arr.length - 1 - daysFromToday
  if (idx < 0 || idx >= arr.length) return 'missed'
  const liveTotal = (routine.items || []).filter(it => !(routine.lightenedItems || []).includes(it)).length || (routine.items || []).length || 1
  const e = normaliseCompletionEntry(arr[idx], liveTotal)
  return entryIsFullyDone(e) ? 'done' : 'missed'
}
```

(Keeps the Calendar tab's streak grid binary — out of scope to change here.)

- [ ] **Step 6: Verify the dev server compiles**

```bash
cd web && npm run dev
```

Expected: clean compile, Tracks tab still renders RoutineCard with the streak strip, Calendar tab still renders the routines streak grid. Both should look identical to before — same colors, same numbers.

- [ ] **Step 7: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: completion14d back-compat — accepts {done,total} alongside bool"
```

---

## Task 2 — Per-item toggle records `{done, total}` for today

**Files:**
- Modify: `web/app/page.jsx:12113` (`handleMarkRoutineDay`).

- [ ] **Step 1: Replace the `'__item__'` branch**

Find the block starting `if (index === '__item__') {` (around line 12115). Replace the inner `setRoutines(rs => { ... })` callback with:

```jsx
setRoutines(rs => {
  prevSnapshot = rs
  return rs.map(r => {
    if (r.id !== routineId) return r
    const cur = r.todayItemsDone || []
    const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value]
    const live = (r.items || []).filter(it => !(r.lightenedItems || []).includes(it))
    const liveTotal = live.length || (r.items || []).length || 1
    // Count only items that are still live AND in `next`. This way, an
    // already-checked item that gets lightened later doesn't inflate `done`.
    const liveDone = next.filter(it => live.includes(it)).length
    const updatedC14 = [...(r.completion14d || [])]
    if (updatedC14.length) {
      updatedC14[updatedC14.length - 1] = { done: liveDone, total: liveTotal }
    }
    return { ...r, todayItemsDone: next, completion14d: updatedC14 }
  })
})
```

- [ ] **Step 2: Verify check-off updates the heatmap data live**

```bash
cd web && npm run dev
```

1. Open Tracks tab. Tap an item on a routine card.
2. Open the React devtools or `localStorage.getItem('heed.routines.v1')` — the routine's `completion14d[length-1]` should now be `{done: 1, total: <liveTotal>}` (not `true`).
3. Tap another item — `done` increments. Tap to uncheck — `done` decrements.

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: per-item toggle writes {done,total} to today's completion entry"
```

---

## Task 3 — `handleMarkRoutineDone` ("Mark all done") writes `{done, total}`

**Files:**
- Modify: `web/app/page.jsx:12077` (`handleMarkRoutineDone`).

- [ ] **Step 1: Replace the function body**

Find `const handleMarkRoutineDone = useCallback((routineId) => {` (around line 12077). Replace the whole callback with:

```jsx
const handleMarkRoutineDone = useCallback((routineId) => {
  let prevValue = null
  let prevItemsDone = null
  setRoutines(rs => rs.map(r => {
    if (r.id !== routineId) return r
    const live = (r.items || []).filter(it => !(r.lightenedItems || []).includes(it))
    const liveTotal = live.length || (r.items || []).length || 1
    const updated = [...(r.completion14d || [])]
    prevValue = updated.length ? updated[updated.length - 1] : null
    prevItemsDone = r.todayItemsDone || []
    if (updated.length) {
      updated[updated.length - 1] = { done: liveTotal, total: liveTotal }
    }
    return { ...r, completion14d: updated, todayItemsDone: [...live] }
  }))
  setToast({
    message: 'Done for today. Nice.',
    onUndo: () => {
      setRoutines(rs => rs.map(r => {
        if (r.id !== routineId) return r
        const reverted = [...(r.completion14d || [])]
        if (reverted.length) reverted[reverted.length - 1] = prevValue
        return { ...r, completion14d: reverted, todayItemsDone: prevItemsDone || [] }
      }))
      setToast(null)
    },
  })
}, [])
```

- [ ] **Step 2: Verify**

```bash
cd web && npm run dev
```

1. On Tracks → a routine card, open the ⋯ menu, tap "Mark today done".
2. All item chips on that card should now render as checked (sage tint).
3. The trailing `completion14d` entry in `localStorage.getItem('heed.routines.v1')` should be `{done: liveTotal, total: liveTotal}`.
4. Tap Undo on the toast — items return to their prior checked state, completion entry returns to its prior value.

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: 'Mark today done' writes {done:total,total} and fills todayItemsDone"
```

---

## Task 4 — Daily roll-over: advance the 14-day window when the day changes

**Files:**
- Modify: `web/app/page.jsx` (HeedApp body, near other initialization effects ~line 11380).

The current code never advances `completion14d`. Index `len-1` is treated as "today" but nothing rolls when midnight passes. After this task, on any mount or visibility-change, routines whose stored "today date" is older than the system's current date are rolled forward — one append + drop oldest per missed day, and `todayItemsDone` resets.

We track "the date the trailing entry was written" via a new sibling field `last_rollover_date: 'YYYY-MM-DD'` on each routine. Routines without it (legacy) are migrated on first roll-over.

- [ ] **Step 1: Add a roll-over helper near the top of the file**

Insert just below `normaliseCompletionEntry` (around line 165):

```jsx
// Advance a routine's completion14d window by `daysToRoll` days. For each
// rolled day, append a new {done:0, total:liveTotal} entry (the day the user
// missed) and drop the oldest. Returns a new routine object.
function rollRoutineForward(routine, daysToRoll, todayIso) {
  if (!daysToRoll || daysToRoll <= 0) return routine
  const live = (routine.items || []).filter(it => !(routine.lightenedItems || []).includes(it))
  const liveTotal = live.length || (routine.items || []).length || 1
  const arr = [...(routine.completion14d || [])]
  for (let i = 0; i < daysToRoll; i++) {
    arr.push({ done: 0, total: liveTotal })
    if (arr.length > 14) arr.shift()
  }
  return {
    ...routine,
    completion14d: arr,
    todayItemsDone: [],
    last_rollover_date: todayIso,
    // Lightened items stay in place — they're a "this week" decision the
    // user made; rolling a single day doesn't reset that scope.
  }
}
```

- [ ] **Step 2: Add the roll-over effect inside `HeedApp`**

Find the routines hydration effect (around line 11340). Immediately AFTER the `useEffect(() => { ... }, [routines, FUNCTIONS_URL])` persistence block (around line 11374), add:

```jsx
// Daily roll-over: advance any routine whose last_rollover_date is older
// than today. Runs on mount and whenever the tab becomes visible (covers
// "left the app open overnight").
useEffect(() => {
  function maybeRoll() {
    setRoutines(rs => {
      const today = new Date()
      const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
      let changed = false
      const next = rs.map(r => {
        const last = r.last_rollover_date
        if (!last) {
          // Legacy routine — adopt today as the baseline without rolling.
          changed = true
          return { ...r, last_rollover_date: todayIso }
        }
        if (last === todayIso) return r
        // Days between last and today (rough — ignores DST seconds).
        const lastDate = new Date(last + 'T00:00:00')
        const ms = today.setHours(0,0,0,0) - lastDate.getTime()
        const daysToRoll = Math.max(0, Math.round(ms / 86400000))
        if (daysToRoll === 0) return r
        changed = true
        return rollRoutineForward(r, daysToRoll, todayIso)
      })
      return changed ? next : rs
    })
  }
  maybeRoll()
  function onVis() { if (document.visibilityState === 'visible') maybeRoll() }
  document.addEventListener('visibilitychange', onVis)
  return () => document.removeEventListener('visibilitychange', onVis)
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

- [ ] **Step 3: Verify with a manual time-travel**

```bash
cd web && npm run dev
```

1. Open the app today, mark some items on a routine — `last_rollover_date` should now be today's date (e.g. `2026-05-10`).
2. Stop the dev server, in devtools rewrite `localStorage.heed.routines.v1` so one routine's `last_rollover_date` is two days ago.
3. Restart the dev server and reload the page.
4. That routine's `completion14d` should have grown by 2 (and the oldest entries dropped if it exceeded 14). The new trailing entry is `{done: 0, total: liveTotal}` for today; `todayItemsDone` is `[]`.

- [ ] **Step 4: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: daily roll-over for routine completion14d (visibility-aware)"
```

---

## Task 5 — `RoutineMonthLog` component (the new screen)

**Files:**
- Modify: `web/app/page.jsx` — insert `RoutineMonthLog` and `mixSageBeige` immediately above `RoutineCard` (around line 3685).

- [ ] **Step 1: Add the color mix helper**

Insert above `function RoutineCard(...)`:

```jsx
// Linear-RGB mix between two hex colors. Used by the month log heatmap so
// each cell's shade scales to the routine's done/total fraction (no fixed
// buckets — a 7-item routine gets 7 visible steps automatically).
function mixHex(a, b, t) {
  const pa = a.startsWith('#') ? a.slice(1) : a
  const pb = b.startsWith('#') ? b.slice(1) : b
  const ar = parseInt(pa.slice(0,2),16), ag = parseInt(pa.slice(2,4),16), ab = parseInt(pa.slice(4,6),16)
  const br = parseInt(pb.slice(0,2),16), bg = parseInt(pb.slice(2,4),16), bb = parseInt(pb.slice(4,6),16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  const hex = (n) => n.toString(16).padStart(2,'0')
  return `#${hex(r)}${hex(g)}${hex(bl)}`
}
function mixSageBeige(frac) {
  return mixHex(C.border, C.sage, Math.min(1, Math.max(0, frac)))
}
```

- [ ] **Step 2: Insert the screen component**

Immediately after the helpers above, insert:

```jsx
function RoutineMonthLog({ routine, onClose, onMarkAllDone, onLighten, onEdit, onShare }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [tooltip, setTooltip] = useState(null) // { date, frac, done, total, items }

  const live = (routine.items || []).filter(it => !(routine.lightenedItems || []).includes(it))
  const liveTotal = live.length || (routine.items || []).length || 1

  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const monthLabel = base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isCurrentMonth = monthOffset === 0
  const canGoForward = monthOffset < 0

  // Build the list of week-Mondays that overlap this month (5 or 6 weeks).
  const firstMonday = startOfWeek(base)
  const lastOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0)
  const weeks = []
  let cur = new Date(firstMonday)
  while (cur <= lastOfMonth && weeks.length < 6) {
    weeks.push(new Date(cur))
    cur = addDays(cur, 7)
  }

  // Stats — for the visible month, scoped to scheduled days.
  const sched = routineDays(routine)
  let sumDone = 0, sumTotal = 0
  for (let i = 0; i < weeks.length; i++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(weeks[i], d)
      if (date.getMonth() !== base.getMonth()) continue
      if (date > today) continue
      if (!sched.includes((date.getDay() + 6) % 7)) continue
      const e = entryForDate(routine, date, today, liveTotal)
      if (!e) continue
      sumDone += e.done
      sumTotal += e.total
    }
  }
  const avgFrac = sumTotal ? sumDone / sumTotal : 0
  const avgLabel = `${(avgFrac * liveTotal).toFixed(1)} / ${liveTotal}`
  const streak = computeStreakCount(routine.completion14d, routine)
  // Best run from completion14d (not month-scoped — same definition as RoutineCard's stats).
  let best = 0, run = 0
  for (const raw of (routine.completion14d || [])) {
    if (entryIsFullyDone(normaliseCompletionEntry(raw, liveTotal))) { run++; best = Math.max(best, run) }
    else run = 0
  }

  return (
    <div role="dialog" aria-label={`${routine.name} month log`}
      style={{ position: 'fixed', inset: 0, zIndex: 235, background: C.paper, display: 'flex', flexDirection: 'column', animation: 'heed-slideIn 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Back"
          style={{ background: 'none', border: 'none', color: C.warmDark, fontSize: 22, cursor: 'pointer', padding: '2px 8px 2px 0', lineHeight: 1, fontFamily: 'inherit' }}>
          ‹
        </button>
        <span style={{ fontSize: 18 }}>{routine.icon || '📅'}</span>
        <span style={{ flex: 1, fontFamily: 'Lora, Georgia, serif', fontSize: 16, fontWeight: 600, color: C.warmDark, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {routine.name} <span style={{ color: C.inkMute, fontWeight: 500, fontSize: 12 }}>· {liveTotal} item{liveTotal === 1 ? '' : 's'}</span>
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          {[
            { lbl: 'Avg this month', val: sumTotal ? avgLabel : '—' },
            { lbl: 'Streak (full)',  val: `${streak} d` },
            { lbl: 'Best run',       val: `${best} d` },
          ].map(({ lbl, val }) => (
            <div key={lbl} style={{ background: C.bellySoft, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: C.inkMute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{lbl}</div>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 14, fontWeight: 600, color: C.warmDark, marginTop: 2 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Month nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: 8 }}>
          <button onClick={() => setMonthOffset(o => o - 1)} aria-label="Previous month"
            style={{ background: 'none', border: 'none', color: C.warmDark, fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '0 8px' }}>
            ‹
          </button>
          <span style={{ fontFamily: 'Lora, serif', fontWeight: 600, color: C.warmDark, fontSize: 14 }}>{monthLabel}</span>
          <button onClick={() => canGoForward && setMonthOffset(o => o + 1)} aria-label="Next month"
            disabled={!canGoForward}
            style={{ background: 'none', border: 'none', color: canGoForward ? C.warmDark : C.inkMute, fontSize: 16, fontWeight: 700, cursor: canGoForward ? 'pointer' : 'default', opacity: canGoForward ? 1 : 0.4, padding: '0 8px' }}>
            ›
          </button>
        </div>

        {/* Weekday header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 5 }}>
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: C.inkMute, letterSpacing: 0.5 }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {weeks.map((weekMon, wi) => (
            [0,1,2,3,4,5,6].map(di => {
              const date = addDays(weekMon, di)
              const inMonth = date.getMonth() === base.getMonth()
              const isToday = sameDay(date, today)
              const wd = (date.getDay() + 6) % 7
              const scheduled = sched.includes(wd)
              const isFuture = date > today
              const e = entryForDate(routine, date, today, liveTotal)
              let bg = C.bellySoft, color = C.inkMute, borderStyle = 'solid', opacity = 1, border = 'none'
              let fracLabel = ''
              if (!inMonth) {
                bg = 'transparent'; border = `1px dashed ${C.hairline}`; color = C.inkMute; opacity = 0.5
              } else if (!scheduled) {
                bg = C.bellySoft; opacity = 0.55; color = C.inkMute
              } else if (isFuture) {
                bg = C.bellySoft; color = C.inkMute
              } else if (!e) {
                bg = 'transparent'; border = `1px dashed ${C.hairline}`; color = C.inkMute
              } else {
                const f = entryFrac(e)
                bg = mixSageBeige(f)
                color = f >= 0.5 ? C.cream : C.ink
                fracLabel = `${e.done}/${e.total}`
              }
              const boxShadow = isToday ? `inset 0 0 0 1.5px ${C.warmDark}` : 'none'
              return (
                <button key={`${wi}-${di}`}
                  onClick={() => {
                    if (!e) return
                    setTooltip({
                      date,
                      done: e.done, total: e.total,
                      frac: entryFrac(e),
                      items: sameDay(date, today) ? (routine.todayItemsDone || []) : null,
                    })
                  }}
                  disabled={!e}
                  style={{
                    aspectRatio: '1 / 1', borderRadius: 7, border, background: bg, color,
                    opacity, boxShadow, cursor: e ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600, fontFamily: 'inherit', padding: 0,
                  }}>
                  <span style={{ lineHeight: 1 }}>{date.getDate()}</span>
                  {fracLabel && <span style={{ fontSize: 7, opacity: 0.85, marginTop: 1, lineHeight: 1 }}>{fracLabel}</span>}
                </button>
              )
            })
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 10, color: C.ink, flexWrap: 'wrap' }}>
          <span>0/{liveTotal}</span>
          <span style={{ display: 'inline-flex', gap: 2 }}>
            {Array.from({ length: liveTotal + 1 }, (_, i) => (
              <span key={i} style={{ width: 14, height: 14, borderRadius: 3, background: mixSageBeige(i / liveTotal) }}/>
            ))}
          </span>
          <span>{liveTotal}/{liveTotal}</span>
          <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: C.bellySoft, opacity: 0.55 }}/>Off-day
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: C.bellySoft }}/>Future
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: 'transparent', border: `1px dashed ${C.hairline}` }}/>No data
          </span>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => onLighten?.(routine.id)}
            style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.border}`, color: C.warmDark, padding: '10px 0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            🪶 Lighten this week
          </button>
          <button onClick={() => onMarkAllDone?.(routine.id)}
            style={{ flex: 1, background: C.rust, color: C.cream, border: 'none', padding: '10px 0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✓ Mark all done
          </button>
        </div>
      </div>

      {/* Tap-cell tooltip */}
      {tooltip && (
        <div role="dialog" aria-label="Day detail"
          onClick={() => setTooltip(null)}
          style={{ position: 'absolute', inset: 0, background: `${C.ink}66`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.paperHi, borderRadius: '14px 14px 0 0', padding: '16px 18px 22px', width: '100%', maxWidth: 420, boxShadow: '0 -4px 20px rgba(0,0,0,0.12)' }}>
            <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 12px' }}/>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 14, fontWeight: 700, color: C.warmDark, marginBottom: 6 }}>
              {tooltip.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
              <strong style={{ color: C.warmDark }}>{tooltip.done} / {tooltip.total} done</strong>
              {tooltip.frac > 0 && tooltip.frac < 1 ? ' · partial' : ''}
            </div>
            {tooltip.items && tooltip.items.length > 0 && (
              <div style={{ fontSize: 12, color: C.inkSoft }}>
                Done: {tooltip.items.join(', ')}
              </div>
            )}
            {tooltip.items && tooltip.items.length === 0 && (
              <div style={{ fontSize: 12, color: C.inkMute, fontStyle: 'italic' }}>No items checked.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Resolve a date to its completion14d entry for the routine, or null when
// the date is outside the persisted window.
function entryForDate(routine, date, today, liveTotal) {
  const arr = routine.completion14d || []
  const t = new Date(today); t.setHours(0,0,0,0)
  const d = new Date(date);  d.setHours(0,0,0,0)
  const daysFromToday = Math.round((t - d) / 86400000)
  if (daysFromToday < 0) return null
  const idx = arr.length - 1 - daysFromToday
  if (idx < 0 || idx >= arr.length) return null
  return normaliseCompletionEntry(arr[idx], liveTotal)
}
```

- [ ] **Step 3: Sanity-check syntax**

```bash
cd web && npm run dev
```

Expected: clean compile. The component isn't rendered yet — that's Task 6.

- [ ] **Step 4: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add RoutineMonthLog screen + mixSageBeige color helper"
```

---

## Task 6 — Wire "See month log →" on `RoutineCard` and render the screen

**Files:**
- Modify: `web/app/page.jsx:3685+` (`RoutineCard`).
- Modify: `web/app/page.jsx:4693+` (`TracksTab`).
- Modify: `web/app/page.jsx` (HeedApp body — add `monthLogRoutineId` state + render).

- [ ] **Step 1: Add the footer link inside `RoutineCard`**

Find the inside of `RoutineCard` after the "Last 14 days" block (search for `today →` around line 3924) and BEFORE the `routine.lightenedItems?.length ? (` line. Insert this new footer row:

```jsx
{onOpenMonthLog && (
  <button onClick={() => onOpenMonthLog(routine.id)}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', marginTop: 4, marginBottom: 8, padding: '8px 0',
      borderTop: `1px solid ${C.hairline}`,
      background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    }}>
    <span style={{ fontSize: 12, color: C.warmDark, fontWeight: 600 }}>📊 See month log</span>
    <span style={{ fontSize: 16, color: C.inkMute, fontWeight: 700 }}>›</span>
  </button>
)}
```

(`borderTop: 1px solid C.hairline` keeps it visually attached but separated.)

- [ ] **Step 2: Add `onOpenMonthLog` to `RoutineCard`'s props**

Update the function signature at line 3685:

```jsx
function RoutineCard({ routine, delay = 0, onMarkDone, onLighten, onEdit, onShare, onMarkDay, onOpenMonthLog }) {
```

- [ ] **Step 3: Forward `onOpenMonthLog` from `TracksTab`**

Find `<RoutineCard` inside `TracksTab` (around line 4753). Add the prop:

```jsx
routines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 50} onMarkDone={onMarkRoutineDone} onLighten={onLightenRoutine} onEdit={onEditRoutine} onShare={onShareCard} onMarkDay={onMarkRoutineDay} onOpenMonthLog={onOpenMonthLog}/>)
```

Add `onOpenMonthLog` to `TracksTab`'s prop destructure (line 4693):

```jsx
function TracksTab({ tasks, routines, plans, checkTask, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine, onAddTask, onAddRoutine, onMoreOptions, onShareCard, onMarkRoutineDay, onEditTask, onAddToRoutine, onBuildRoutine, onOpenMonthLog }) {
```

- [ ] **Step 4: Add state + render in `HeedApp`**

Find the `<TracksTab` call site (around line 12474). Pass the new handler:

```jsx
{tab === 'tracks' && <TracksTab tasks={displayTasks} routines={routines} plans={plansHook.plans} checkTask={plansHook.checkTask} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAddTask={() => setModalOpen(true)} onAddRoutine={() => setRoutineModalOpen(true)} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen} onMarkRoutineDay={handleMarkRoutineDay} onEditTask={handleEditTask} onAddToRoutine={t => setAddToRoutineTask(t)} onBuildRoutine={t => { setBuildRoutineTask(t); setRoutineModalOpen(true) }} onOpenMonthLog={id => setMonthLogRoutineId(id)}/>}
```

Add the state variable near the other screen-state useStates inside HeedApp (e.g. near `editingTask`, `taskOptionsTask` — search for `useState(null)` cluster around line 12300–12400). Add:

```jsx
const [monthLogRoutineId, setMonthLogRoutineId] = useState(null)
const monthLogRoutine = monthLogRoutineId ? routines.find(r => r.id === monthLogRoutineId) : null
```

Then render the screen alongside the other detail screens — find a suitable portal-mounted block near other modal/sheet renders (search for `<TaskOptionsSheet` around line 12480ish) and add:

```jsx
{monthLogRoutine && (
  <RoutineMonthLog
    routine={monthLogRoutine}
    onClose={() => setMonthLogRoutineId(null)}
    onMarkAllDone={(id) => handleMarkRoutineDone(id)}
    onLighten={(id) => handleLightenRoutine(id)}
    onEdit={handleEditRoutine}
    onShare={handleShareOpen}
  />
)}
```

- [ ] **Step 5: Verify end-to-end**

```bash
cd web && npm run dev
```

1. Open Tracks tab. Each routine card shows the new "📊 See month log →" footer.
2. Tap it → the month log screen slides in from the right.
3. Stats up top reflect the visible month. Calendar grid shows shaded squares for days with data, "no data" dashed cells for older days, off-day dim cells for weekends (if it's a weekday-only routine), future cells for upcoming days.
4. Today has the inset rust border.
5. Tap a shaded cell → bottom sheet shows date + done/total + (for today) the list of completed items.
6. Use the ‹ › arrows to navigate to last month — cells should be all "no data" until enough days have rolled over.
7. Tap "Mark all done" — closes the screen, RoutineCard now shows all items checked.
8. Tap back → back to Tracks tab.

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: open RoutineMonthLog from Tracks via 'See month log' footer"
```

---

## Task 7 — Theme sweep + advisor input normalisation

**Files:**
- Modify: `agents/advisor.py:318+`.
- No new code in `web/app/page.jsx`; this task is verification + a one-line backend change.

- [ ] **Step 1: Update the advisor's read of `completion14d`**

Open `agents/advisor.py` and find the routine-summary block around line 318. Each access of `completion14d[i]` (or `c[-1]`, `c[-2]`) currently treats it as a boolean. Wrap each access with a small inline normaliser. Find this block (around line 318):

```python
completion14d = r.get("completion14d") or []
if not isinstance(completion14d, list):
    completion14d = []
last7 = completion14d[-7:]
...
done_today = bool(completion14d[-1]) if completion14d else False
done_yesterday = bool(completion14d[-2]) if len(completion14d) >= 2 else False
```

Replace with:

```python
completion14d = r.get("completion14d") or []
if not isinstance(completion14d, list):
    completion14d = []

def _norm(entry):
    """Read either {done:int, total:int} or legacy bool. Returns True iff fully done."""
    if isinstance(entry, dict):
        d, t = entry.get("done"), entry.get("total")
        return isinstance(d, (int, float)) and isinstance(t, (int, float)) and t > 0 and d >= t
    return bool(entry)

last7 = [_norm(e) for e in completion14d[-7:]]
done_today = _norm(completion14d[-1]) if completion14d else False
done_yesterday = _norm(completion14d[-2]) if len(completion14d) >= 2 else False
```

Adjust any subsequent `for i, v in enumerate(reversed(completion14d)):` similarly — replace `v` with `_norm(v)` where it's used as a boolean.

- [ ] **Step 2: Theme sweep — manual verify all six themes**

```bash
cd web && npm run dev
```

For each theme (Settings → Theme): `parchment-light`, `midnight-fern`, `inkwash`, `flamingo`, `candy`, `periwinkle`:

1. Open Tracks → tap a routine's "See month log".
2. Confirm cells with `done < total` are visibly distinct from cells with `done === total` and from cells with `done === 0`.
3. Confirm the legend gradient is readable (left end clearly different from right end).
4. Confirm the today inset border is visible.

If a dark theme (`midnight-fern`, `inkwash`) shows a near-flat gradient, change `mixSageBeige` to detect the active theme via `themeState.current` and substitute `C.sageSoft` for `C.sage` in those themes. Add the conditional inside `mixSageBeige`:

```jsx
function mixSageBeige(frac) {
  const dark = themeState.current === 'midnight-fern' || themeState.current === 'inkwash'
  const top = dark ? C.sageSoft : C.sage
  return mixHex(C.border, top, Math.min(1, Math.max(0, frac)))
}
```

(Only apply this fix if the manual sweep confirms it's needed.)

- [ ] **Step 3: Commit**

```bash
git add agents/advisor.py web/app/page.jsx
git commit -m "feat: advisor reads completion14d in either shape; theme sweep done"
```

---

## Task 8 — Production build + deploy

- [ ] **Step 1: Build**

```bash
cd web && npm run build
```

Expected: clean exit, `web/out/` regenerated.

- [ ] **Step 2: Commit the static export**

```bash
git add web/out
git commit -m "build: rebuild static export with routine month log"
```

- [ ] **Step 3: Push**

```bash
git push
```

Watch the GitHub Actions deploy. When green, hit the production URL and re-run the verification steps from Task 6.

---

## Verification checklist (after deploy)

- [ ] Each routine card on Tracks shows the new "See month log →" footer.
- [ ] Tapping it opens a slide-in screen with stats, month nav, calendar grid, legend, footer actions.
- [ ] Shaded cells encode `done/total` on a continuous gradient (a 7-item routine shows visibly different shades for 0,1,2,3,4,5,6,7 done; a 4-item routine shows 5).
- [ ] Today's cell has an inset rust border on top of its shade.
- [ ] Off-day cells (weekends on a weekday-only routine) render dim.
- [ ] Future cells render pale.
- [ ] Cells outside the persisted window render as dashed "no data."
- [ ] Tapping a cell with data opens a bottom sheet showing date + `done/total` + (for today only) the list of completed items.
- [ ] Per-item check-off on the routine card writes the new `{done, total}` shape; verify in `localStorage.heed.routines.v1`.
- [ ] "Mark all done" works and is undoable.
- [ ] Daily roll-over fires on visibility change (test by manually backdating `last_rollover_date` in localStorage).
- [ ] Advisor still answers routine questions correctly (e.g. ask "did I do my morning routine yesterday?").
- [ ] All six themes show a readable shade gradient.
