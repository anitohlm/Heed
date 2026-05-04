# Routine Frequency & Importance Design

**Goal:** Replace the `AddRoutineModal` bottom sheet with a full-screen `BuildRoutineScreen`, adding structured frequency (daily/weekdays/weekly/monthly/annually) and importance (nice-to-have / core habit / non-negotiable) fields to every routine.

**Architecture:** Single component rename + refactor inside `web/app/page.jsx`. `AddRoutineModal` becomes `BuildRoutineScreen` — a full-viewport overlay that slides in from the right. Two new fields added to the routine data model (`frequency`, `importance`); `frequencyDays` added for weekly routines. The `schedule` string shown on cards is derived from these structured fields going forward. Existing seed routines keep their raw `schedule` string and show no importance badge.

**Tech stack:** React 18, Next.js 14, inline styles, existing `useState`/`useCallback` patterns.

---

## 1. Data Model

Add three new optional fields to every routine object created in `BuildRoutineScreen.submit`:

```js
{
  frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'annually',
  frequencyDays: number[],   // only set when frequency === 'weekly'; Mon=1…Sun=0
  importance: 'nice-to-have' | 'core' | 'non-negotiable',
}
```

`schedule` is no longer set to `'Custom'` for new routines. Instead it is derived at render time:

```js
function deriveSchedule(routine) {
  if (!routine.frequency) return routine.schedule  // backward compat
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

**Importance badge values and colours:**

| Value | Label | Background | Text colour |
|---|---|---|---|
| `'nice-to-have'` | Nice-to-have | `#f5f2ed` | `#9e9080` |
| `'core'` | Core habit | `#fdf0d8` | `#a06c20` |
| `'non-negotiable'` | Non-negotiable | `#fdeaea` | `#9b3535` |

---

## 2. BuildRoutineScreen (replaces AddRoutineModal)

### Layout

Full-viewport overlay:
- `position:fixed; inset:0; zIndex:200; background:C.paper`
- Slide-in animation from right: new keyframe `heed-slideInRight` — `from { transform:translateX(100%) } to { transform:translateX(0) }`
- Three-part flex column: top nav bar → scrollable body → sticky footer

### Top nav bar

```
← [title]
```

- Back arrow (`←`) calls `onClose()` — no confirmation needed (data is cleared on open)
- Title: `'Build a routine'` on create, `'Edit routine'` on edit

### Form field order

1. **Routine name** (existing input, autoFocus)
2. **Frequency** (NEW) — pill buttons: `Daily / Weekdays / Weekly / Monthly / Annually`; defaults to `'daily'` on open
   - When `frequency === 'weekly'`: show a 7-chip day-of-week row (Su Mo Tu We Th Fr Sa); defaults to `[1]` (Monday); multi-select toggle
3. **Importance** (NEW) — three pills: `Nice-to-have / Core habit / Non-negotiable`; defaults to `'core'`
4. **Notes** (existing, optional textarea)
5. **Items in this routine** (existing item list + task picker)
6. **Date range** (existing, optional)

### Sticky footer

Single full-width primary button: `'Build routine'` (create) or `'Save changes'` (edit). Disabled when name is empty or no items have text.

### State

```js
const [frequency, setFrequency]         = useState('daily')
const [frequencyDays, setFrequencyDays]  = useState([1])   // Mon default
const [importance, setImportance]        = useState('core')
```

Reset on open alongside existing state resets.

On edit (`initialData`), pre-fill:
```js
setFrequency(initialData.frequency || 'daily')
setFrequencyDays(initialData.frequencyDays || [1])
setImportance(initialData.importance || 'core')
```

### Submit

```js
const routine = {
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
}
```

---

## 3. RoutineCard — importance badge + schedule

**Schedule line** (line ~2884): replace `{routine.schedule}` with `{deriveSchedule(routine)}`.

**Importance badge**: shown only when `routine.importance` is set. Placed to the right of the routine name on the card title row:

```jsx
{routine.importance && (
  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
    background: IMPORTANCE_STYLES[routine.importance].bg,
    color: IMPORTANCE_STYLES[routine.importance].fg }}>
    {IMPORTANCE_LABELS[routine.importance]}
  </span>
)}
```

Define at module level:
```js
const IMPORTANCE_LABELS = { 'nice-to-have': 'Nice-to-have', 'core': 'Core habit', 'non-negotiable': 'Non-negotiable' }
const IMPORTANCE_STYLES = {
  'nice-to-have': { bg: '#f5f2ed', fg: '#9e9080' },
  'core':         { bg: '#fdf0d8', fg: '#a06c20' },
  'non-negotiable': { bg: '#fdeaea', fg: '#9b3535' },
}
```

---

## 4. Invocation — replacing AddRoutineModal

All call sites that render `<AddRoutineModal .../>` become `<BuildRoutineScreen .../>`. Props are identical. The component name change is the only external difference.

---

## 5. What Doesn't Change

- Seed routines (`ROUTINES`) — no `frequency`/`importance` fields; display falls back to existing `schedule` string and no badge
- `useEffect`-based routine hydration, persistence, and backend sync — untouched
- `RoutineRow` swipe, done animation, lighten flow — untouched
- `useRoutines` / `setRoutines` — no changes
