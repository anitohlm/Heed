# Quick Capture & Ask Heed Creator Design

**Goal:** Give forgetful users two reliable ways to write down a task or routine the moment they remember it — a persistent capture bar on Today, and a fixed Ask Heed that actually creates items instead of refusing.

**Architecture:** Three layers of change. (1) Frontend: new `CaptureBar` component on Today tab, updated `useChat` hook to handle `add_routine`, updated `AskInlineModal`/`AskTab` with `onRoutineAdded` prop. (2) Backend functions: new `POST /api/parse_capture` endpoint, `add_routine` case added to `POST /api/execute_action`. (3) Agent layer: `advisor_system.md` updated to allow creation, `AgentAction` model fixed to include `add_task`/`add_routine`, `add_routine` added to advisor tool schema.

**Tech stack:** React 18 / Next.js 14 (frontend), Python Azure Functions (backend), Claude claude-haiku-4-5 for parse_capture, Claude claude-sonnet-4-6 for advisor_stream.

---

## 1. Capture Bar (Today tab)

### Component

New `CaptureBar` component in `web/app/page.jsx`. Placed at the top of the Today tab content, above the task list sections.

**Props:**
```js
CaptureBar({ onCreateTask, onCreateRoutine, onViewTask })
```

**State:**
```js
const [text, setText]       = useState('')
const [state, setState]     = useState('idle')   // 'idle' | 'submitting' | 'error'
```

**Appearance — idle:**
- White pill-shaped bar with a gold `✦` icon, italic placeholder "What do you need to remember?", mic button on the right
- Border: `1.5px solid C.border`; on focus/active: `1.5px solid C.ochre`

**Appearance — typing:**
- Border changes to `C.warmDark`, send arrow `→` replaces mic
- Mic re-appears alongside send so voice is still accessible

**Appearance — submitting:**
- Input disabled, bar shows `🦉 Writing it down…` in muted italic, no send button

**Appearance — error:**
- Border goes `C.rust`, brief error message inside bar, resets after 3 s

**Submit flow:**
1. `POST /api/parse_capture` with `{ text }`
2. Response `{ type: 'task', payload }` → call `onCreateTask(payload)` → `POST /api/tasks`
3. Response `{ type: 'routine', payload }` → call `onCreateRoutine(payload)`
4. Show toast: `"Task added — [name]"` with **View →** button calling `onViewTask(task)`; or `"Routine added — [name]"` (no view button for routines — user edits from Tracks)
5. Clear input, return to idle

**Mic button:** Uses existing `useMic()` hook pattern. On final transcript, sets `text` and auto-submits.

### Wiring in HeedApp

`TodayTab` receives two new props: `onCapture` (creates task) and `onCaptureRoutine` (adds routine). Inside `HeedApp`:
- `onCapture` → same handler as `handleAddTask`, adapted to accept the parse_capture payload shape
- `onCaptureRoutine` → `handleAddRoutine`
- `onViewTask(task)` → opens the task detail modal (sets `editingTask` + opens modal, or navigates to task — same as tapping a task card's detail)

---

## 2. `POST /api/parse_capture` (new Azure Function)

**File:** `functions/function_app.py`

**Route:** `POST /api/parse_capture`

**Request body:**
```json
{ "text": "Call mom this weekend" }
```

**Response — task:**
```json
{
  "type": "task",
  "payload": {
    "name": "Call mom this weekend",
    "category": "relationships",
    "importance": "medium",
    "explicit_cadence_days": null
  }
}
```

**Response — routine:**
```json
{
  "type": "routine",
  "payload": {
    "name": "Morning routine",
    "items": ["Stretch", "Vitamins", "Journal"],
    "frequency": "daily",
    "importance": "core"
  }
}
```

**Implementation:** Single `client.messages.create` call using `claude-haiku-4-5-20251001` (fastest, cheapest). No streaming. System prompt:

```
Parse this into a structured Heed item. Respond with JSON only — no explanation.

Classify as "task" if it is a one-time thing: a reminder, errand, call, payment, appointment.
Classify as "routine" if it is recurring: a habit, daily/weekly practice, or cluster of repeated actions.

Task format:
{"type":"task","payload":{"name":"...","category":"relationships|finance|admin|home|health|work|self_care","importance":"high|medium|low","explicit_cadence_days":null}}

Routine format:
{"type":"routine","payload":{"name":"...","items":["item1","item2"],"frequency":"daily|weekdays|weekly|monthly","importance":"nice-to-have|core|non-negotiable"}}

Rules:
- Keep names short and action-oriented (≤6 words)
- For routines, extract any items mentioned; if none, use ["..."] as a single placeholder item named after the activity
- Default category for tasks: "health" if physical, "relationships" if about people, "admin" otherwise
- Default frequency for routines: "daily"
- Default importance for routines: "core"
```

**Error handling:** Return `400` if `text` is missing or empty. Return `500` with `{"error":"parse failed"}` if the Claude response is not valid JSON; frontend falls back to creating a plain task with the raw text as the name.

---

## 3. Fix Ask Heed — agent layer

### 3a. `agents/prompts/advisor_system.md`

Add a new section after the existing scope rules:

```markdown
## Creating tasks and routines

When the user asks Heed to remember something, add a task, or build a routine, use `propose_action` immediately — do not refuse or explain that you cannot do it.

**Triggers for add_task:** "remind me to", "add a task", "don't let me forget", "I need to", "write down", "note that", or any direct instruction to capture a one-time item.

**Triggers for add_routine:** "add a routine", "every morning/evening/week", "I want to start doing", "build a routine", or any recurring habit the user wants to track.

After proposing the action:
- For tasks: reply with one word — "Done." — then show no further commentary unless the user asks.
- For routines: reply with one sentence — "Added. You can adjust frequency and importance in Tracks." — nothing more.

Never say "I can't create tasks" or "that's not what I do." Creation is core to what Heed does.
```

### 3b. `agents/models.py` — fix AgentAction

Current `action_type` Literal is missing `add_task` and `add_routine`. Fix:

```python
action_type: Literal[
    "mark_done", "skip", "defer",
    "lighten_routine", "add_context",
    "add_task", "add_routine"
]
```

For `add_routine`, the payload schema:
```python
class AddRoutinePayload(BaseModel):
    name: str
    items: list[str]
    frequency: str = "daily"          # daily | weekdays | weekly | monthly
    importance: str = "core"          # nice-to-have | core | non-negotiable
    notes: str | None = None
```

### 3c. `agents/advisor.py` — add `add_routine` to tool schema

In the `propose_action` tool's `action_type` enum, add `"add_routine"`. Add its `input_schema` properties alongside `add_task`:

```python
"add_routine": {
    "name": {"type": "string", "description": "Short routine name"},
    "items": {"type": "array", "items": {"type": "string"}, "description": "List of items in the routine"},
    "frequency": {"type": "string", "enum": ["daily","weekdays","weekly","monthly"], "description": "How often"},
    "importance": {"type": "string", "enum": ["nice-to-have","core","non-negotiable"]},
    "notes": {"type": "string"}
}
```

---

## 4. Fix Ask Heed — execute_action backend

### `functions/function_app.py` — add `add_routine` case

In the `execute_action` function, after the `add_task` block:

```python
elif action_type == "add_routine":
    name       = payload.get("name", "").strip()
    items      = payload.get("items", [])
    frequency  = payload.get("frequency", "daily")
    importance = payload.get("importance", "core")
    notes      = payload.get("notes")
    if not name or not items:
        return error_response("name and items required", 400)

    # Load current routines from Cosmos
    routines = get_user_state("routines") or []
    new_routine = {
        "id": f"custom_{int(time.time() * 1000)}",
        "name": name,
        "notes": notes,
        "frequency": frequency,
        "importance": importance,
        "items": [i.strip() for i in items if i.strip()],
        "completion14d": [False] * 14,
        "insight": "Just added — building up history.",
        "suggestion": None,
        "weekRate": "no data yet",
        "startDate": None,
        "endDate": None,
    }
    routines.append(new_routine)
    save_user_state("routines", routines)
    return func.HttpResponse(
        json.dumps({"ok": True, "summary": f"Routine added: {name}", "routine": new_routine}),
        content_type="application/json"
    )
```

---

## 5. Fix Ask Heed — frontend

### 5a. `useChat` hook — handle `add_routine`

In `executeAction` (currently handles `lighten_routine` and `add_task`), add:

```js
} else if (action.action_type === 'add_routine') {
  const res = await fetch(`${FUNCTIONS_URL}/api/execute_action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type: 'add_routine', payload: action.payload }),
  })
  const data = await res.json()
  if (data.ok) {
    onRoutineAdded?.(data.routine)
    return { status: 'confirmed', summary: data.summary }
  }
  return { status: 'error', summary: data.error || 'Could not add routine' }
}
```

`useChat` receives `onRoutineAdded` as a new option alongside the existing `onTaskAdded`.

### 5b. `AskInlineModal` — add `onRoutineAdded` prop

```js
function AskInlineModal({ open, onClose, onLightenRoutine, onTaskAdded, onRoutineAdded }) {
  const chat = useChat({ onLightenRoutine, onTaskAdded, onRoutineAdded })
  // ...
}
```

### 5c. `AskTab` — add `onRoutineAdded` prop

```js
function AskTab({ ..., onRoutineAdded }) {
  const { ... } = useChat({ onLightenRoutine, onTaskAdded, onRoutineAdded })
  // ...
}
```

### 5d. HeedApp — wire `onRoutineAdded`

Wherever `<AskInlineModal>` and `<AskTab>` are rendered, add:
```jsx
onRoutineAdded={handleAddRoutine}
```

`handleAddRoutine` already exists — it saves the routine to state and persists to Cosmos.

### 5e. Ask Heed action card in chat

When `executeAction` resolves with `status: 'confirmed'` for `add_task` or `add_routine`, the existing message rendering shows the action result. Update the action result UI to show:

**Task card** (green):

The `execute_action` response for `add_task` already returns the created task object. Store it in the message's `action.result` field so the card can reference it. `onViewTask` is a new prop of `AskTab`/`AskInlineModal` threaded from `HeedApp` → `setEditingTask(task); setModalOpen(true)`.

```jsx
<div style={{ background: '#f0faf0', border: '1.5px solid #7c9e6e', borderRadius: 10, padding: '8px 12px', marginTop: 4 }}>
  <div style={{ fontSize: 10, fontWeight: 700, color: '#4a7a4a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>✓ Task added</div>
  <div style={{ fontSize: 13, fontWeight: 600, color: '#2d4a2d' }}>{msg.action.payload.name}</div>
  <button onClick={() => onViewTask(msg.action.result)} style={{ fontSize: 11, color: '#7c5333', fontWeight: 600, background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', fontFamily: 'inherit' }}>View →</button>
</div>
```

**Routine card** (amber):
```jsx
<div style={{ background: '#f5edde', border: '1.5px solid #c8a96e', borderRadius: 10, padding: '8px 12px', marginTop: 4 }}>
  <div style={{ fontSize: 10, fontWeight: 700, color: '#a06c20', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>↻ Routine added</div>
  <div style={{ fontSize: 13, fontWeight: 600, color: '#3d2b1f' }}>{action.payload.name}</div>
  <div style={{ fontSize: 11, color: '#9e7a40', marginTop: 2 }}>{action.payload.frequency} · {action.payload.items.length} items · {action.payload.importance}</div>
  <div style={{ fontSize: 11, color: '#7c5333', fontWeight: 600, marginTop: 4 }}>Edit in Tracks →</div>
</div>
```

`onViewTask` navigates to the task detail — same handler used when tapping a task in the Today list.

---

## 6. What doesn't change

- `useMic` hook — unchanged; mic in capture bar and Ask Heed mic both use the same hook
- Toast system — existing `Toast` component used as-is; `onView` callback already supported
- Routine storage/sync (`handleAddRoutine`, `PUT /api/user_state/routines`) — unchanged
- Task storage/sync (`handleAddTask`, `POST /api/tasks`) — unchanged
- All other advisor actions (mark_done, skip, defer, lighten_routine, add_context) — unchanged
