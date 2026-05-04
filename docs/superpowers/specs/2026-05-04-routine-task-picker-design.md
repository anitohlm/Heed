# Routine Task Picker Design

**Goal:** Let users add existing tasks to a routine from within `AddRoutineModal` via a 📎 pick button on each item row that opens an inline dropdown.

**Architecture:** `AddRoutineModal` gains `openPickerIndex` / `pickerSearch` state and a `tasks` prop. Each item row gets a 📎 toggle button; the dropdown renders inline below the row. Selecting a task copies its name into the item field. Parent (`LifeTab`) passes `apiTasks` (or `TASKS_DEMO` fallback) as the `tasks` prop.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern)

---

## 1. New state in `AddRoutineModal`

```js
const [openPickerIndex, setOpenPickerIndex] = useState(null)
const [pickerSearch, setPickerSearch] = useState('')
```

- `openPickerIndex` — index of the row whose picker is open; `null` = none open
- `pickerSearch` — current search string in the open picker

---

## 2. `tasks` prop

`AddRoutineModal` receives a new `tasks` prop (array of task objects). Each task has at minimum `id`, `name`, and `category`.

The parent (`LifeTab`) passes:
```jsx
<AddRoutineModal
  ...existing props...
  tasks={apiTasks.length ? apiTasks : TASKS_DEMO}
/>
```

---

## 3. 📎 button on each item row

Each item row already renders a text input and a delete `×` button. A 📎 button is added to the right of the input:

```jsx
<button
  onClick={() => {
    setOpenPickerIndex(openPickerIndex === i ? null : i)
    setPickerSearch('')
  }}
  style={{ background: 'none', border: 'none', cursor: 'pointer', color: openPickerIndex === i ? C.ochre : C.border, fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
  type="button"
>📎</button>
```

Tapping 📎 toggles the picker for that row. Opening a new row's picker implicitly closes any previously open one (because `openPickerIndex` is a single value).

---

## 4. Inline dropdown

Rendered immediately below the item row when `openPickerIndex === i`:

```jsx
{openPickerIndex === i && (
  <div style={{ border: `1.5px solid ${C.ochre}`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: C.paperHi, zIndex: 10, maxHeight: 180, overflowY: 'auto', marginTop: -2 }}>
    <input
      autoFocus
      value={pickerSearch}
      onChange={e => setPickerSearch(e.target.value)}
      placeholder="Search tasks…"
      style={{ width: '100%', border: 'none', borderBottom: `1px solid ${C.hairline}`, padding: '7px 10px', fontSize: 12.5, outline: 'none', background: C.paper, fontFamily: 'inherit', boxSizing: 'border-box' }}
    />
    {filteredTasks().map(task => (
      <div
        key={task.id}
        onClick={() => pickTask(i, task)}
        style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.hairline}` }}
      >
        <span style={{ color: C.ink, fontSize: 13 }}>{task.name}</span>
        <span style={{ color: C.inkMute, fontSize: 11 }}>{task.category}</span>
      </div>
    ))}
    {filteredTasks().length === 0 && (
      <div style={{ padding: '10px', color: C.inkMute, fontSize: 12.5, textAlign: 'center' }}>No tasks match</div>
    )}
  </div>
)}
```

---

## 5. Helper functions

```js
function filteredTasks() {
  const q = pickerSearch.toLowerCase()
  return tasks.filter(t => t.name.toLowerCase().includes(q))
}

function pickTask(i, task) {
  setItems(prev => prev.map((it, idx) => idx === i ? { ...it, name: task.name } : it))
  setOpenPickerIndex(null)
  setPickerSearch('')
}
```

---

## 6. Closing the picker

The picker closes when:
- A task is selected (`pickTask`)
- The 📎 button of the same row is tapped again (toggle)
- A different row's 📎 is tapped (single `openPickerIndex` replaces the previous)

No outside-click dismiss is added — the modal's existing scroll/tap behaviour makes this unnecessary.

---

## 7. Data — no change

Items are stored as plain strings (`item.name`) in the routine. The picker is a fill convenience; there is no task ID stored. Items filled via the picker are indistinguishable from free-typed items after selection.

---

## 8. What doesn't change

- Item text inputs remain fully editable after a task is picked
- Free-text items work exactly as before
- `AddRoutineModal`'s existing `seedTask` pre-fill behaviour is unchanged
- Routine data shape is unchanged
