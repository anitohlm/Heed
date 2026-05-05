# Username Auth & Timestamps Design

**Goal:** Give each user a persistent identity so their tasks and routines sync across devices, and stamp every created item with a timestamp so Heed can answer recency questions.

**Architecture:** Three layers. (1) Frontend: username prompt overlay on first load, `X-User-ID` header on every fetch. (2) Backend: dynamic `user_id` from header replacing hardcoded constant, two new endpoints for username check/register, `created_at` on item creation. (3) Data: new Cosmos `users` container for the username registry.

**Tech stack:** React 18 / Next.js 14 (frontend), Python Azure Functions (backend), Azure Cosmos DB (users container + existing tasks/routines containers).

---

## 1. Username Prompt Overlay

### Component

New `UsernameGate` component rendered at the root of `HeedApp`. Renders as a full-screen overlay when `localStorage('heed.username')` is empty. Disappears once a username is saved.

**State:**
```js
const [mode, setMode]         = useState('new')      // 'new' | 'returning'
const [value, setValue]       = useState('')
const [status, setStatus]     = useState('idle')      // 'idle' | 'checking' | 'available' | 'taken' | 'not_found' | 'submitting' | 'error'
const [errorMsg, setErrorMsg] = useState('')
```

**Validation (client-side, before any API call):**
- 3–20 characters
- Letters, numbers, underscores, hyphens only (`/^[a-zA-Z0-9_-]{3,20}$/`)
- No spaces

**New user flow:**
1. User types username → debounced 500 ms → `GET /api/check_username?u=<value>`
2. Response `{ available: true }` → show green ✓ "Available", enable submit
3. Response `{ available: false }` → show red ✗ "Already taken"
4. On submit → `POST /api/register_username` with `{ username }`
5. On success → `localStorage.setItem('heed.username', username)` → dismiss overlay
6. On error → show error message, stay on overlay

**Returning user flow:**
1. "I already have a username →" link switches `mode` to `'returning'`
2. No availability check while typing
3. On submit → `GET /api/check_username?u=<value>`
4. Response `{ available: false }` (username exists) → save to localStorage, dismiss
5. Response `{ available: true }` (username not found) → show "Username not found — try again"

**Appearance:**
- Centered card on cream background, Heed owl logo at top
- Headline: "What should Heed call you?" (new) / "Welcome back" (returning)
- Input: pill style matching CaptureBar, border turns ochre on focus
- Submit button: warm dark background, disabled until validation passes
- Availability indicator: inline below input, small text

### Wiring in HeedApp

```jsx
{!username && <UsernameGate onComplete={u => setUsername(u)} />}
```

`username` is a state variable in HeedApp initialized from `localStorage('heed.username')`. Once set, the overlay is gone for the lifetime of the session.

---

## 2. `GET /api/check_username`

**Route:** `GET /api/check_username?u=<username>`

**Logic:**
1. Read `u` from query params. If missing or invalid → return `400`.
2. Try to read document with `id = username` from Cosmos `users` container.
3. Found → `{ "available": false }`
4. Not found (404) → `{ "available": true }`

**No auth required** on this endpoint — it's a public registry check.

---

## 3. `POST /api/register_username`

**Route:** `POST /api/register_username`

**Request body:** `{ "username": "alice" }`

**Logic:**
1. Validate username format server-side (same regex as client).
2. Attempt to create document `{ "id": username, "created_at": <ISO> }` in `users` container.
3. Cosmos will reject with `409 Conflict` if the document already exists → return `409 { "error": "taken" }`.
4. On success → return `200 { "ok": true, "username": username }`.

**Users container:** Created on first call via `_ensure_users_container()` helper (same pattern as `_ensure_user_state_container()`). Partition key: `/id`.

---

## 4. Identity threading — frontend

**Helper function** added near the top of `page.jsx`:
```js
function getUsername() {
  try { return localStorage.getItem('heed.username') || 'demo' } catch { return 'demo' }
}
```

**Every `fetch()` call** to `FUNCTIONS_URL` gains:
```js
headers: { 'Content-Type': 'application/json', 'X-User-ID': getUsername() }
```

For GET requests that currently pass no headers, add the header object. For POST/PUT/DELETE requests that already have headers, add `'X-User-ID': getUsername()` alongside existing headers.

Calls covered: `/api/tasks` (GET, POST, PUT, DELETE), `/api/tasks/:id` (GET, PUT, DELETE), `/api/advisor_stream`, `/api/execute_action`, `/api/today_view`, `/api/parse_capture`, `/api/user_state/*`, `/api/suggest_tasks`, `/api/calendar_events`, `/api/ph_calendar`.

---

## 5. Identity threading — backend

**Remove:**
```python
USER_ID = "usr_heed_demo_001"  # Single-user build — no auth in scope
```

**Add helper** near top of `function_app.py`:
```python
def _get_user_id(req: func.HttpRequest) -> str:
    return req.headers.get('X-User-ID') or 'demo'
```

**Every route handler** replaces `USER_ID` with `_get_user_id(req)`. The `req` parameter is already available in every handler.

Handlers to update: `advisor_stream`, `get_tasks`, `create_task`, `update_task`, `delete_task`, `get_today_view`, `execute_action` (all action types), `get_user_state`, `save_user_state`, `suggest_tasks`, `parse_capture` (delegates, no direct USER_ID use), `calendar_events`, `ph_calendar`.

---

## 6. Timestamps

**`POST /api/tasks` (create_task):** Add to the task document:
```python
"created_at": datetime.now(timezone.utc).isoformat()
```

**`add_routine` in `execute_action`:** Already has `"id": f"custom_{uuid...}"`. Add:
```python
"created_at": datetime.now(timezone.utc).isoformat()
```

**`POST /api/register_username`:** Already includes `created_at` on the user doc (see Section 3).

**Advisor awareness:** `created_at` is included in task objects already passed to the LLM via the today view. No prompt changes needed — the advisor can read it naturally.

**Frontend:** No UI display for now. Timestamps are data-layer only.

---

## 7. What doesn't change

- Cosmos containers for tasks, routines, user_state — unchanged, already partition by `user_id`
- Demo mode (`heed.use-demo` localStorage flag) — still works; demo users get bucket `'demo'`
- All existing advisor actions (mark_done, skip, defer, etc.) — pick up `user_id` automatically via the helper
- `agents/cosmos_tool.py` — unchanged; it receives `user_id` as a parameter from callers
- Password, session tokens, JWT — out of scope for now
