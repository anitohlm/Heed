# Routine Frequency & Importance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `AddRoutineModal` bottom sheet with a `BuildRoutineScreen` full-screen overlay, adding structured frequency and importance fields to every routine.

**Architecture:** All changes are in `web/app/page.jsx` (single-file React app). Three module-level constants added at line 63; `AddRoutineModal` (lines 6177–6336) replaced with `BuildRoutineScreen`; two lines in `RoutineCard` updated; one call site renamed. After code edits, `web/out/` must be rebuilt via `npm run build` in the `web/` directory.

**Tech Stack:** React 18, Next.js 14, inline styles, `useState`/`useEffect`/`useRef`

---

## File Map

| File | Action |
|---|---|
| `web/app/page.jsx` line 63 | Insert `IMPORTANCE_LABELS`, `IMPORTANCE_STYLES`, `deriveSchedule` |
| `web/app/page.jsx` lines 2986–2989 | Add importance badge; replace `routine.schedule` with `deriveSchedule(routine)` |
| `web/app/page.jsx` lines 6177–6336 | Replace `AddRoutineModal` with `BuildRoutineScreen` |
| `web/app/page.jsx` line 7889 | Rename `<AddRoutineModal` → `<BuildRoutineScreen` |
| `web/out/` | Rebuild static export |

---

## Task 1: Module-level constants

**Files:**
- Modify: `web/app/page.jsx` at line 63 (after the closing `]` of the `ROUTINES` array)

No automated test framework exists in this project. Verify by visual inspection in the browser after Task 4.

- [ ] **Step 1: Insert constants after line 62**

After line 62 (the closing `]` of `ROUTINES`), insert these three declarations:

```js
const IMPORTANCE_LABELS = { 'nice-to-have': 'Nice-to-have', 'core': 'Core habit', 'non-negotiable': 'Non-negotiable' }
const IMPORTANCE_STYLES = {
  'nice-to-have': { bg: '#f5f2ed', fg: '#9e9080' },
  'core':         { bg: '#fdf0d8', fg: '#a06c20' },
  'non-negotiable': { bg: '#fdeaea', fg: '#9b3535' },
}
function deriveSchedule(routine) {
  if (!routine.frequency) return routine.schedule
  const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']
  switch (routine.frequency) {
    case 'daily':    return 'Daily'
    case 'weekdays': return 'Weekdays'
    case 'weekly': {
      const days = (routine.frequencyDays || []).sort().map(d => DAY_LABELS[d]).join(' ')
      return days ? `Weekly · ${days}` : 'Weekly'
    }
    case 'monthly':  return 'Monthly'
    case 'annually': return 'Annually'
    default:         return routine.schedule
  }
}
```

The exact `old_string` to match:
```
]

// TASKS_DEMO is the offline/demo seed
```

Replace with:
```
]

const IMPORTANCE_LABELS = { 'nice-to-have': 'Nice-to-have', 'core': 'Core habit', 'non-negotiable': 'Non-negotiable' }
const IMPORTANCE_STYLES = {
  'nice-to-have': { bg: '#f5f2ed', fg: '#9e9080' },
  'core':         { bg: '#fdf0d8', fg: '#a06c20' },
  'non-negotiable': { bg: '#fdeaea', fg: '#9b3535' },
}
function deriveSchedule(routine) {
  if (!routine.frequency) return routine.schedule
  const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']
  switch (routine.frequency) {
    case 'daily':    return 'Daily'
    case 'weekdays': return 'Weekdays'
    case 'weekly': {
      const days = (routine.frequencyDays || []).sort().map(d => DAY_LABELS[d]).join(' ')
      return days ? `Weekly · ${days}` : 'Weekly'
    }
    case 'monthly':  return 'Monthly'
    case 'annually': return 'Annually'
    default:         return routine.schedule
  }
}

// TASKS_DEMO is the offline/demo seed
```

- [ ] **Step 2: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add IMPORTANCE_LABELS, IMPORTANCE_STYLES, deriveSchedule constants"
```

---

## Task 2: Replace AddRoutineModal with BuildRoutineScreen

**Files:**
- Modify: `web/app/page.jsx` lines 6177–6336

- [ ] **Step 1: Replace the entire component**

Find this exact string (the comment + function signature through the closing brace):
```
// ── AddRoutineModal (simplified) ───────────────────────────────
function AddRoutineModal({ open, onClose, onSubmit, initialData = null, seedTask = null, tasks = [] }) {
```

Replace the block from that line through the closing `}` at line 6336 with:

```jsx
// ── BuildRoutineScreen (replaces AddRoutineModal) ──────────────
function BuildRoutineScreen({ open, onClose, onSubmit, initialData = null, seedTask = null, tasks = [] }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ id: 1, name: '' }])
  const [openPickerIndex, setOpenPickerIndex] = useState(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [frequencyDays, setFrequencyDays] = useState([1])
  const [importance, setImportance] = useState('core')
  const nameRef = useRef(null)
  const inputStyle = { flex: 1, minWidth: 0, background: C.paper, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, color: C.ink, outline: 'none', fontFamily: 'inherit' }

  function filteredTasks() {
    const q = pickerSearch.toLowerCase()
    return tasks.filter(t => t.name.toLowerCase().includes(q))
  }

  function pickTask(idx, task) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, name: task.name } : it))
    setOpenPickerIndex(null)
    setPickerSearch('')
  }

  useEffect(() => {
    if (!open) return
    setOpenPickerIndex(null)
    setPickerSearch('')
    if (initialData) {
      setName(initialData.name || '')
      setNotes(initialData.notes || '')
      setItems(initialData.items?.map((item, i) => ({ id: i + 1, name: item })) || [{ id: 1, name: '' }])
      setStartDate(initialData.startDate || '')
      setEndDate(initialData.endDate || '')
      setFrequency(initialData.frequency || 'daily')
      setFrequencyDays(initialData.frequencyDays || [1])
      setImportance(initialData.importance || 'core')
    } else if (seedTask) {
      setName('')
      setNotes('')
      setItems([{ id: 1, name: seedTask.name }, { id: 2, name: '' }])
      setStartDate(''); setEndDate('')
      setFrequency('daily'); setFrequencyDays([1]); setImportance('core')
    } else {
      setName(''); setNotes(''); setItems([{ id: 1, name: '' }]); setStartDate(''); setEndDate('')
      setFrequency('daily'); setFrequencyDays([1]); setImportance('core')
    }
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])

  const addItem = () => setItems(i => [...i, { id: Math.max(...i.map(x=>x.id))+1, name: '' }])
  const removeItem = (id) => { if (items.length > 1) setItems(i => i.filter(x => x.id !== id)) }
  const updateItem = (id, val) => setItems(i => i.map(x => x.id===id ? {...x, name: val} : x))
  const toggleDay = (d) => setFrequencyDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const submit = () => {
    if (!name.trim()) return
    const validItems = items.filter(i => i.name.trim())
    if (!validItems.length) return
    onSubmit({
      id: initialData ? initialData.id : `custom_${Date.now()}`,
      name: name.trim(),
      notes: notes.trim() || null,
      frequency,
      ...(frequency === 'weekly' ? { frequencyDays } : {}),
      importance,
      items: validItems.map(i => i.name.trim()),
      completion14d: initialData?.completion14d ?? Array(14).fill(false),
      insight: initialData?.insight ?? 'Just added — building up history.',
      suggestion: null,
      weekRate: initialData?.weekRate ?? 'no data yet',
      startDate: startDate || null,
      endDate: endDate || null,
    })
    onClose()
  }

  if (!open) return null

  const freqOptions = [
    { v: 'daily', label: 'Daily' },
    { v: 'weekdays', label: 'Weekdays' },
    { v: 'weekly', label: 'Weekly' },
    { v: 'monthly', label: 'Monthly' },
    { v: 'annually', label: 'Annually' },
  ]
  const DAY_CHIPS = ['Su','Mo','Tu','We','Th','Fr','Sa']
  const impOptions = [
    { v: 'nice-to-have', label: 'Nice-to-have' },
    { v: 'core', label: 'Core habit' },
    { v: 'non-negotiable', label: 'Non-negotiable' },
  ]
  const fieldLabel = { fontSize: 10.5, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }
  const pillBase = { padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1.5px solid ${C.border}`, background: C.paper, color: C.inkSoft, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: C.paper, display: 'flex', flexDirection: 'column', animation: 'heed-slideIn 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 10px', gap: 10, background: C.paperHi, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Back" style={{ background: 'transparent', border: 'none', color: C.warmDark, cursor: 'pointer', fontSize: 20, padding: '2px 8px 2px 0', lineHeight: 1, fontFamily: 'inherit', fontWeight: 700 }}>←</button>
        <span style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 17, fontWeight: 700, color: C.warmDark, letterSpacing: -0.2, flex: 1 }}>{initialData ? 'Edit routine' : 'Build a routine'}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px' }}>
        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Routine name</label>
          <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning routine, Sunday reset"
            style={{ width: '100%', boxSizing: 'border-box', background: C.paperHi, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
            onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Frequency</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {freqOptions.map(({ v, label }) => (
              <button key={v} onClick={() => setFrequency(v)} style={{ ...pillBase, background: frequency === v ? C.warmDark : C.paper, borderColor: frequency === v ? C.warmDark : C.border, color: frequency === v ? C.cream : C.inkSoft }}>{label}</button>
            ))}
          </div>
          {frequency === 'weekly' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {DAY_CHIPS.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)} style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${frequencyDays.includes(i) ? C.warmDark : C.border}`, background: frequencyDays.includes(i) ? C.warmDark : C.paper, color: frequencyDays.includes(i) ? C.cream : C.inkMute, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Importance</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {impOptions.map(({ v, label }) => (
              <button key={v} onClick={() => setImportance(v)} style={{ ...pillBase, background: IMPORTANCE_STYLES[v].bg, color: IMPORTANCE_STYLES[v].fg, borderColor: importance === v ? IMPORTANCE_STYLES[v].fg : '#e0d8ce', outline: importance === v ? `2.5px solid ${IMPORTANCE_STYLES[v].fg}` : 'none', outlineOffset: importance === v ? '2px' : '0' }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Notes <span style={{ fontWeight: 400, color: C.inkMute, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any context or reminders for this routine…"
            rows={2}
            style={{ width: '100%', boxSizing: 'border-box', background: C.paperHi, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s', resize: 'vertical' }}
            onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Items in this routine</label>
          {items.map((item, idx) => {
            const ft = openPickerIndex === idx ? filteredTasks() : []
            return (
              <div key={item.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: openPickerIndex === idx ? 0 : 6 }}>
                  <input value={item.name} onChange={e => updateItem(item.id, e.target.value)} placeholder={`Item ${idx+1} (e.g. ${['Stretch 5 min','Vitamins','Read 10 pages'][idx]||'...'})`} style={inputStyle}/>
                  <button onClick={() => { setOpenPickerIndex(openPickerIndex === idx ? null : idx); setPickerSearch('') }} type="button" aria-label={openPickerIndex === idx ? 'Close task picker' : 'Pick a task'} style={{ background: 'transparent', border: 'none', color: openPickerIndex === idx ? C.ochre : C.border, cursor: 'pointer', fontSize: 15, padding: '0 4px', lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}>📎</button>
                  <button onClick={() => { setOpenPickerIndex(null); removeItem(item.id) }} disabled={items.length===1} style={{ background: 'transparent', border: 'none', color: items.length===1 ? C.hairline : C.inkMute, cursor: items.length===1 ? 'not-allowed' : 'pointer', fontSize: 16, padding: '0 6px', lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}>×</button>
                </div>
                {openPickerIndex === idx && (
                  <div style={{ border: `1.5px solid ${C.ochre}`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: C.paperHi, marginBottom: 6, maxHeight: 180, overflowY: 'auto', animation: 'heed-dropdown 0.15s ease' }}>
                    <input
                      autoFocus
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search tasks…"
                      style={{ width: '100%', border: 'none', borderBottom: `1px solid ${C.hairline}`, padding: '7px 10px', fontSize: 12.5, outline: 'none', background: C.paper, fontFamily: 'inherit', boxSizing: 'border-box', position: 'sticky', top: 0 }}
                    />
                    {ft.map(task => (
                      <button key={task.id} onClick={() => pickTask(idx, task)} type="button"
                        style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: `1px solid ${C.hairline}`, width: '100%', background: 'none', fontFamily: 'inherit', textAlign: 'left' }}>
                        <span style={{ color: C.ink, fontSize: 13 }}>{task.name}</span>
                        <span style={{ color: C.inkMute, fontSize: 11 }}>{task.category}</span>
                      </button>
                    ))}
                    {ft.length === 0 && (
                      <div style={{ padding: '10px', color: C.inkMute, fontSize: 12.5, textAlign: 'center' }}>No tasks match</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={addItem} style={{ background: 'transparent', color: C.warmDark, border: `1.5px dashed ${C.border}`, padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%', transition: 'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.warmDark;e.currentTarget.style.background=C.bellySoft}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background='transparent'}}
          >+ Add another item</button>
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={fieldLabel}>Date range <span style={{ fontWeight: 400, color: C.inkMute, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ flex: 1, background: C.paperHi, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: startDate ? C.ink : C.inkMute, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
              onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
            />
            <span style={{ color: C.inkMute, fontSize: 12, flexShrink: 0 }}>to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined}
              style={{ flex: 1, background: C.paperHi, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: endDate ? C.ink : C.inkMute, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
              onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
            />
          </div>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate('') }} style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 11.5, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>Clear dates</button>
          )}
        </div>
      </div>
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.paperHi, flexShrink: 0 }}>
        <button onClick={submit} disabled={!name.trim()||items.every(i=>!i.name.trim())} style={{ ...getBtnPrimary(), width: '100%', padding: '13px', opacity: (name.trim()&&items.some(i=>i.name.trim())) ? 1 : 0.5, cursor: (name.trim()&&items.some(i=>i.name.trim())) ? 'pointer' : 'not-allowed' }}>{initialData ? 'Save changes' : 'Build routine'}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add BuildRoutineScreen with frequency and importance fields"
```

---

## Task 3: RoutineCard — importance badge + deriveSchedule

**Files:**
- Modify: `web/app/page.jsx` lines 2986–2989

- [ ] **Step 1: Update the name row (add badge, wrap in flex)**

Find this exact block (around line 2986):
```jsx
          <div style={{ marginBottom: 3 }}>
            <span style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{routine.name}</span>
          </div>
          <div style={{ fontSize: 12, color: C.inkMute }}>{routine.schedule} · {routine.weekRate}</div>
```

Replace with:
```jsx
          <div style={{ marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{routine.name}</span>
            {routine.importance && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: IMPORTANCE_STYLES[routine.importance].bg,
                color: IMPORTANCE_STYLES[routine.importance].fg }}>
                {IMPORTANCE_LABELS[routine.importance]}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.inkMute }}>{deriveSchedule(routine)} · {routine.weekRate}</div>
```

- [ ] **Step 2: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: show importance badge and derived schedule on RoutineCard"
```

---

## Task 4: Rename call site, rebuild, push

**Files:**
- Modify: `web/app/page.jsx` line 7889
- Rebuild: `web/out/`

- [ ] **Step 1: Rename the call site**

Find (line 7889):
```jsx
      <AddRoutineModal open={routineModalOpen} onClose={() => { setRoutineModalOpen(false); setEditingRoutine(null); setBuildRoutineTask(null) }} onSubmit={handleAddRoutine} initialData={editingRoutine} seedTask={buildRoutineTask} tasks={displayTasks}/>
```

Replace `AddRoutineModal` with `BuildRoutineScreen` (two occurrences on that line — the opening and the self-closing tag only have one tag name):
```jsx
      <BuildRoutineScreen open={routineModalOpen} onClose={() => { setRoutineModalOpen(false); setEditingRoutine(null); setBuildRoutineTask(null) }} onSubmit={handleAddRoutine} initialData={editingRoutine} seedTask={buildRoutineTask} tasks={displayTasks}/>
```

- [ ] **Step 2: Rebuild the static export**

```powershell
cd C:\Users\hmanito\Heed\web
npm run build
```

Expected: `web/out/` updated; no TypeScript or build errors.

- [ ] **Step 3: Verify visually**

Open `http://localhost:3000` (or open `web/out/index.html` directly). Navigate to Routines. Tap "+ Build routine". Confirm:
- Screen slides in full-viewport from the right
- Back arrow `←` in top-left closes screen
- Frequency pill row (Daily / Weekdays / Weekly / Monthly / Annually) with Daily pre-selected
- Selecting "Weekly" reveals 7 day chips (Su Mo Tu We Th Fr Sa), Monday pre-highlighted
- Importance row (Nice-to-have / Core habit / Non-negotiable) with "Core habit" pre-selected with outline
- Existing routines (Morning routine, Evening wind-down) still show their `schedule` string — no importance badge
- After creating a routine: importance badge appears on the card beside the name; schedule shows "Daily" / "Weekdays" / etc.

- [ ] **Step 4: Commit and push**

```bash
git add web/app/page.jsx web/out
git commit -m "feat: routine frequency and importance — rename call site, rebuild"
git push
```
