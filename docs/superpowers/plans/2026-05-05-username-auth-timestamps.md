# Username Auth & Timestamps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each user a persistent identity (username stored in localStorage, sent as `X-User-ID` header) so their data syncs across devices, and stamp every created item with `created_at`.

**Architecture:** Backend gets two new endpoints (`check_username`, `register_username`) and a new Cosmos `users` container. The hardcoded `USER_ID` constant is replaced by a `_get_user_id(req)` helper that reads the header. The frontend gets a `UsernameGate` overlay component and a `getUsername()` helper wired into every fetch call.

**Tech Stack:** Python Azure Functions (`functions/function_app.py`), React 18 / Next.js 14 (`web/app/page.jsx`), Azure Cosmos DB.

---

## File map

| File | Change |
|------|--------|
| `functions/function_app.py` | New `_ensure_users_container`, `_get_user_id`, `check_username`, `register_username`; remove `USER_ID` constant; replace ~35 `USER_ID` refs; add `created_at` to `add_routine`; fix CORS headers |
| `web/app/page.jsx` | New `getUsername()` helper, new `UsernameGate` component, `username` state in `HeedApp`, `X-User-ID` header on all 24 fetch calls |

---

## Task 1: Backend — CORS fix + users container + username endpoints

**Files:**
- Modify: `functions/function_app.py`

Every OPTIONS handler currently sends `Access-Control-Allow-Headers: "Content-Type"`. The browser will block `X-User-ID` unless it's listed. Fix all of them first, then add the new endpoints.

- [ ] **Step 1: Fix all CORS Access-Control-Allow-Headers**

Open `functions/function_app.py`. Do a global find-and-replace:

Find: `"Access-Control-Allow-Headers": "Content-Type"`
Replace with: `"Access-Control-Allow-Headers": "Content-Type, X-User-ID"`

This affects ~10 OPTIONS handlers throughout the file. Do it as a single replace-all operation.

- [ ] **Step 2: Add `_ensure_users_container` helper**

Find `_ensure_user_state_container` (around line 728). Add a new function directly before it:

```python
_USERS_CONTAINER_NAME = "users"

def _ensure_users_container():
    db = cosmos_tool._get_database()
    try:
        from azure.cosmos import PartitionKey
        return db.create_container_if_not_exists(
            id=_USERS_CONTAINER_NAME,
            partition_key=PartitionKey(path="/id"),
        )
    except Exception:
        logging.exception("ensure users container failed")
        return db.get_container_client(_USERS_CONTAINER_NAME)
```

- [ ] **Step 3: Add `GET /api/check_username` endpoint**

Add after the `_ensure_users_container` function:

```python
USERNAME_RE = re.compile(r'^[a-zA-Z0-9_-]{3,20}$')

@app.route(route="check_username", methods=["GET", "OPTIONS"])
def check_username(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-User-ID",
        })
    u = (req.params.get("u") or "").strip()
    if not u or not USERNAME_RE.match(u):
        return _error("Invalid username format", 400)
    try:
        container = _ensure_users_container()
        container.read_item(item=u, partition_key=u)
        return _json_response({"available": False})
    except Exception as e:
        if "404" in str(e) or "NotFound" in type(e).__name__:
            return _json_response({"available": True})
        logging.exception("check_username failed")
        return _error("Could not check username", 500)
```

Note: `re` is already imported in Python stdlib — add `import re` near the top of the file if it's not already there. Check with `grep -n "^import re" functions/function_app.py`.

- [ ] **Step 4: Add `POST /api/register_username` endpoint**

Add immediately after `check_username`:

```python
@app.route(route="register_username", methods=["POST", "OPTIONS"])
def register_username(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-User-ID",
        })
    try:
        body = req.get_json()
    except ValueError:
        return _error("Invalid JSON body")
    if not body:
        return _error("Request body is required")
    username = (body.get("username") or "").strip()
    if not username or not USERNAME_RE.match(username):
        return _error("Invalid username format", 400)
    try:
        from datetime import datetime, timezone
        container = _ensure_users_container()
        container.create_item(body={
            "id": username,
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        })
        return _json_response({"ok": True, "username": username})
    except Exception as e:
        if "409" in str(e) or "Conflict" in type(e).__name__:
            return _json_response({"error": "taken"}, 409)
        logging.exception("register_username failed")
        return _error("Could not register username", 500)
```

- [ ] **Step 5: Add `import re` if missing**

```bash
grep -n "^import re" functions/function_app.py
```

If not found, add `import re` near the other stdlib imports at the top of the file (alongside `import json`, `import os`, etc.).

- [ ] **Step 6: Verify Python syntax**

```bash
cd C:\Users\hmanito\Heed && python -m py_compile functions/function_app.py && echo "OK"
```

Expected: `OK` with no errors.

- [ ] **Step 7: Commit**

```bash
git add functions/function_app.py
git commit -m "feat: add username registry endpoints and fix CORS for X-User-ID"
```

---

## Task 2: Backend — replace hardcoded USER_ID with `_get_user_id(req)`

**Files:**
- Modify: `functions/function_app.py`

- [ ] **Step 1: Add `_get_user_id` helper and remove the constant**

Find the line:
```python
USER_ID = "usr_heed_demo_001"  # Single-user build — no auth in scope
```

Replace it with:
```python
def _get_user_id(req: func.HttpRequest) -> str:
    return req.headers.get("X-User-ID") or "demo"
```

- [ ] **Step 2: Update `advisor_stream`**

In `async def advisor_stream(req)`, after the OPTIONS check and body parse, add at the top of the handler logic:
```python
user_id = _get_user_id(req)
```
Then replace `USER_ID` → `user_id` on the line:
```python
async for event in stream_response(user_id, message, history):
```

- [ ] **Step 3: Update `tasks` (GET and POST)**

In `def tasks(req)`, add `user_id = _get_user_id(req)` right after the OPTIONS check.

Replace:
- `cosmos_tool.get_active_tasks(USER_ID)` → `cosmos_tool.get_active_tasks(user_id)`
- `"user_id": USER_ID` → `"user_id": user_id`

- [ ] **Step 4: Update `task_by_id` (PATCH and DELETE)**

In `def task_by_id(req)`, add `user_id = _get_user_id(req)` right after the OPTIONS check.

Replace all `USER_ID` → `user_id` in that function:
- `cosmos_tool.get_task(task_id, USER_ID)` → `cosmos_tool.get_task(task_id, user_id)` (appears twice)
- Any `USER_ID` in the replace_item/delete_item calls

- [ ] **Step 5: Update `suggest_tasks`**

In `def suggest_tasks(req)`, add `user_id = _get_user_id(req)` after the OPTIONS check.

Replace all `USER_ID` → `user_id` in that function (check around lines 246–340).

- [ ] **Step 6: Update `context`**

In `def context(req)`, add `user_id = _get_user_id(req)` after the OPTIONS check.

Replace:
- `cosmos_tool.get_active_contexts(USER_ID)` → `cosmos_tool.get_active_contexts(user_id)`
- `cosmos_tool.get_upcoming_contexts(USER_ID)` → `cosmos_tool.get_upcoming_contexts(user_id)`
- `user_id=USER_ID` → `user_id=user_id`

- [ ] **Step 7: Update `today_view`**

In `def today_view(req)`, add `user_id = _get_user_id(req)` after the OPTIONS check.

Replace:
- `_today_view_json(USER_ID)` → `_today_view_json(user_id)`

- [ ] **Step 8: Update `execute_action`**

In `def execute_action(req)`, add `user_id = _get_user_id(req)` after the OPTIONS check (before the body parse or right after it).

Replace ALL `USER_ID` → `user_id` in `execute_action`. The occurrences are:
- `action_tools.mark_task_done(task_id, USER_ID, ...)` (appears twice)
- `task_id, USER_ID,` (appears multiple times for skip/defer calls)
- `routine_id, USER_ID,`
- `user_id=USER_ID,` in add_task block
- `"user_id": USER_ID` in add_task document dict
- `"user_id": USER_ID` in add_routine document dict
- `f"{USER_ID}__routines"` → `f"{user_id}__routines"`
- `container.read_item(item=doc_id, partition_key=USER_ID)` → `partition_key=user_id`

- [ ] **Step 9: Update `user_state`**

In `def user_state(req)`, add `user_id = _get_user_id(req)` after the OPTIONS check.

Replace:
- `f"{USER_ID}__{kind}"` → `f"{user_id}__{kind}"`
- `container.read_item(item=doc_id, partition_key=USER_ID)` → `partition_key=user_id`
- `container.delete_item(item=doc_id, partition_key=USER_ID)` → `partition_key=user_id`
- `"user_id": USER_ID` → `"user_id": user_id`

- [ ] **Step 10: Update `reset_user_data`**

In `def reset_user_data(req)`, add `user_id = _get_user_id(req)` after the OPTIONS check.

Replace:
- `params = [{"name": "@uid", "value": USER_ID}]` → `"value": user_id`
- `partition_key=item.get("user_id", USER_ID)` → `partition_key=item.get("user_id", user_id)`

- [ ] **Step 11: Update `seed_demo_data`**

In `def seed_demo_data(req)`, add `user_id = _get_user_id(req)` after the OPTIONS check.

Replace:
- `parameters=[{"name": "@uid", "value": USER_ID}]` → `"value": user_id`
- `partition_key=item.get("user_id", USER_ID)` → `partition_key=item.get("user_id", user_id)`
- `"user_id": USER_ID` → `"user_id": user_id` (in all seed documents)
- `f"{USER_ID}__routines"` → `f"{user_id}__routines"`
- `f"{USER_ID}__plans"` → `f"{user_id}__plans"`

- [ ] **Step 12: Update `memory_keeper_run`**

`memory_keeper_run` is HTTP-triggered and has `req`. Add `user_id = _get_user_id(req)` and replace `USER_ID` → `user_id`.

`memory_keeper_timer` is timer-triggered (no `req`). Replace `USER_ID` there with the literal string `"demo"` — it's a background job with no request context.

- [ ] **Step 13: Verify no USER_ID references remain**

```bash
grep -n "USER_ID" functions/function_app.py
```

Expected: zero results (the constant and all references are gone).

- [ ] **Step 14: Verify Python syntax**

```bash
python -m py_compile functions/function_app.py && echo "OK"
```

Expected: `OK`.

- [ ] **Step 15: Commit**

```bash
git add functions/function_app.py
git commit -m "feat: replace hardcoded USER_ID with X-User-ID header in all handlers"
```

---

## Task 3: Backend — add `created_at` to `add_routine`

**Files:**
- Modify: `functions/function_app.py`

Note: `POST /api/tasks` already adds `created_at` (it was added in a previous feature). This task only adds it to `add_routine`.

- [ ] **Step 1: Find `add_routine` in `execute_action`**

```bash
grep -n "add_routine\|custom_.*uuid\|completion14d" functions/function_app.py | head -10
```

Find the `new_routine` dict in the `elif action_type == "add_routine":` block.

- [ ] **Step 2: Add `created_at` to the routine document**

The current `new_routine` dict looks like:
```python
new_routine = {
    "id": f"custom_{uuid.uuid4().hex[:12]}",
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
```

Add `created_at` after the `"id"` line:
```python
new_routine = {
    "id": f"custom_{uuid.uuid4().hex[:12]}",
    "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "name": name,
    ...
}
```

The `datetime` and `timezone` imports are already present in the file from the `create_task` handler. No new imports needed.

- [ ] **Step 3: Verify Python syntax**

```bash
python -m py_compile functions/function_app.py && echo "OK"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add functions/function_app.py
git commit -m "feat: add created_at timestamp to routine creation"
```

---

## Task 4: Frontend — `UsernameGate` component

**Files:**
- Modify: `web/app/page.jsx`

- [ ] **Step 1: Add `getUsername` helper**

Find the `FUNCTIONS_URL` constant near the top of `web/app/page.jsx`:
```bash
grep -n "FUNCTIONS_URL" web/app/page.jsx | head -3
```

Add `getUsername` immediately after `FUNCTIONS_URL`:
```js
function getUsername() {
  try { return localStorage.getItem('heed.username') || 'demo' } catch { return 'demo' }
}
```

- [ ] **Step 2: Add `UsernameGate` component**

Find `function HeedApp()`:
```bash
grep -n "^export default function HeedApp\|^function HeedApp" web/app/page.jsx
```

Add the `UsernameGate` component **immediately before** `HeedApp`. Use the `C` color tokens and inline styles matching the existing component style:

```jsx
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/

function UsernameGate({ onComplete }) {
  const [mode, setMode]         = React.useState('new')       // 'new' | 'returning'
  const [value, setValue]       = React.useState('')
  const [status, setStatus]     = React.useState('idle')      // 'idle'|'checking'|'available'|'taken'|'not_found'|'submitting'|'error'
  const [errorMsg, setErrorMsg] = React.useState('')
  const debounceRef             = React.useRef(null)

  const isValid = USERNAME_RE.test(value)

  React.useEffect(() => {
    if (mode !== 'new') return
    if (!isValid) { setStatus('idle'); return }
    clearTimeout(debounceRef.current)
    setStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${FUNCTIONS_URL}/api/check_username?u=${encodeURIComponent(value)}`)
        const data = await res.json()
        setStatus(data.available ? 'available' : 'taken')
      } catch {
        setStatus('idle')
      }
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [value, mode, isValid])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isValid) return
    setStatus('submitting')
    setErrorMsg('')
    try {
      if (mode === 'returning') {
        const res = await fetch(`${FUNCTIONS_URL}/api/check_username?u=${encodeURIComponent(value)}`)
        const data = await res.json()
        if (data.available) { setStatus('not_found'); setErrorMsg('Username not found — try again'); return }
        localStorage.setItem('heed.username', value)
        onComplete(value)
      } else {
        const res = await fetch(`${FUNCTIONS_URL}/api/register_username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: value }),
        })
        const data = await res.json()
        if (!data.ok) { setStatus('error'); setErrorMsg(data.error === 'taken' ? 'That username is taken' : 'Could not register — try again'); return }
        localStorage.setItem('heed.username', value)
        onComplete(value)
      }
    } catch {
      setStatus('error')
      setErrorMsg('Something went wrong — try again')
    }
  }

  const canSubmit = isValid && status !== 'submitting' && status !== 'checking' &&
    (mode === 'returning' || status === 'available')

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.cream, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ fontSize: 48 }}>🦉</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.ink, textAlign: 'center' }}>
          {mode === 'new' ? 'What should Heed call you?' : 'Welcome back'}
        </div>
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}
            onFocus={e => { e.currentTarget.style.borderColor = C.ochre }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border }}>
            <input
              value={value}
              onChange={e => { setValue(e.target.value); setErrorMsg('') }}
              placeholder="your-username"
              autoFocus
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: C.ink, fontFamily: 'inherit' }}
            />
          </div>
          {mode === 'new' && isValid && (status === 'available' || status === 'taken') && (
            <div style={{ fontSize: 11, color: status === 'available' ? '#4a7a4a' : C.rust, paddingLeft: 4 }}>
              {status === 'available' ? '✓ Available' : '✗ Already taken'}
            </div>
          )}
          {errorMsg && (
            <div style={{ fontSize: 11, color: C.rust, paddingLeft: 4 }}>{errorMsg}</div>
          )}
          <button type="submit" disabled={!canSubmit} style={{ background: canSubmit ? C.warmDark : C.border, color: canSubmit ? '#fff' : C.inkMute, border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 14, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default', fontFamily: 'inherit', marginTop: 4, transition: 'background 0.15s' }}>
            {status === 'submitting' ? 'One moment…' : mode === 'new' ? 'Get started' : 'Sign in'}
          </button>
        </form>
        <button onClick={() => { setMode(mode === 'new' ? 'returning' : 'new'); setValue(''); setStatus('idle'); setErrorMsg('') }}
          style={{ background: 'none', border: 'none', color: C.inkSoft, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          {mode === 'new' ? 'I already have a username →' : '← Create a new username'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add `username` state to `HeedApp` and render `UsernameGate`**

Inside `HeedApp`, find the first `useState` call near the top of the function. Add `username` state as the first state declaration:

```js
const [username, setUsername] = React.useState(() => {
  try { return localStorage.getItem('heed.username') || '' } catch { return '' }
})
```

Then find the return statement of `HeedApp`. Add the gate as the very first element inside the outermost `<div>`:

```jsx
{!username && <UsernameGate onComplete={u => setUsername(u)} />}
```

- [ ] **Step 4: Build to verify**

```bash
cd C:\Users\hmanito\Heed\web && npx next build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add UsernameGate overlay for first-time and returning users"
```

---

## Task 5: Frontend — `X-User-ID` header on all fetch calls

**Files:**
- Modify: `web/app/page.jsx`

There are 24 `fetch(` calls to `FUNCTIONS_URL`. Every one needs `'X-User-ID': getUsername()` in its headers. Some are GET requests with no current headers; others are POST/PUT/DELETE with existing headers.

- [ ] **Step 1: Identify all fetch calls**

```bash
grep -n "fetch(\`\${FUNCTIONS_URL}" web/app/page.jsx
```

This gives you line numbers for all 24 calls. Work through them in groups.

- [ ] **Step 2: Update GET fetches (no existing headers)**

For plain GET fetches like:
```js
fetch(`${FUNCTIONS_URL}/api/tasks`)
fetch(`${FUNCTIONS_URL}/api/user_state/routines`)
fetch(`${FUNCTIONS_URL}/api/user_state/plans`)
fetch(`${FUNCTIONS_URL}/api/context`)
fetch(`${FUNCTIONS_URL}/api/tasks`)  // second occurrence in refetch
```

Change each to:
```js
fetch(`${FUNCTIONS_URL}/api/tasks`, { headers: { 'X-User-ID': getUsername() } })
```

(Apply the same pattern for each URL.)

- [ ] **Step 3: Update POST/PUT/DELETE fetches (existing headers)**

For fetches that already pass `headers: { 'Content-Type': 'application/json' }`, add `'X-User-ID': getUsername()` alongside:

```js
headers: { 'Content-Type': 'application/json', 'X-User-ID': getUsername() },
```

The fetches to update:
- `POST /api/advisor_stream`
- `POST /api/execute_action` (useChat)
- `POST /api/execute_action` (CaptureBar via handleCaptureTask)
- `POST /api/parse_capture`
- `POST /api/suggest_tasks`
- `POST /api/tasks` (create task — handleCaptureTask and handleAddTask)
- `PATCH /api/tasks/:id` (update task)
- `DELETE /api/tasks/:id`
- `PUT /api/user_state/routines`
- `PUT /api/user_state/plans`
- `POST /api/context`
- `POST /api/completions` (appears twice)
- `POST /api/reset`

- [ ] **Step 4: Verify all fetches updated**

```bash
grep -n "fetch(\`\${FUNCTIONS_URL}" web/app/page.jsx | grep -v "X-User-ID\|getUsername"
```

This greps for fetches to FUNCTIONS_URL that do NOT yet include the header. Expected output should only show fetches where the header is correctly omitted (none — all should be updated). If any remain, fix them.

Note: This grep will show false positives for multi-line fetch calls where the header is on a different line. Manually verify those cases.

- [ ] **Step 5: Build to verify**

```bash
cd C:\Users\hmanito\Heed\web && npx next build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: send X-User-ID header on all backend fetch calls"
```

---

## Task 6: Rebuild `web/out` and push to deploy

**Files:**
- Modify: `web/out/` (generated)

- [ ] **Step 1: Clean build**

```bash
cd C:\Users\hmanito\Heed\web && npx next build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`, 4 static pages generated.

- [ ] **Step 2: Stage the rebuilt output**

```bash
cd C:\Users\hmanito\Heed && git add web/out
git diff --cached --stat
```

Expected: changes to `web/out/_next/static/chunks/app/page-*.js` and `web/out/index.html`.

- [ ] **Step 3: Commit and push**

```bash
git commit -m "build: rebuild web/out for username auth and timestamps"
git push origin main
```

Expected: push succeeds, GitHub Actions triggers the Azure Static Web Apps deploy.

- [ ] **Step 4: Smoke-test on production**

After the GitHub Actions deploy completes (~2 min):
1. Open the production URL in an incognito window
2. The `UsernameGate` overlay should appear immediately
3. Type a username → green ✓ or red ✗ shows after 500ms
4. Submit → app loads with your username
5. Create a task → close and reopen browser → task persists
6. Open in a second browser → same username → same tasks
7. Ask Heed "what's my latest task?" → it should mention the task by name

---

## Self-review

**Spec coverage:**
- ✅ Section 1 (UsernameGate): Task 4
- ✅ Section 2 (check_username): Task 1
- ✅ Section 3 (register_username): Task 1
- ✅ Section 4 (frontend identity threading): Tasks 4 + 5
- ✅ Section 5 (backend identity threading): Task 2
- ✅ Section 6 (timestamps on routines): Task 3; tasks already had `created_at`
- ✅ Section 7 (what doesn't change): no action needed

**Known limitation:** `memory_keeper_timer` (background timer function) has no HTTP request — it will use `"demo"` as the user bucket. This is acceptable for now; it's a maintenance job, not a user-facing endpoint.
