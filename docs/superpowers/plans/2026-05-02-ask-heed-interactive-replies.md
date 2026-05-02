# Ask Heed Interactive Replies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ask Heed replies interactive — inline action pills the user can tap, a preview-then-confirm flow, and contextual follow-up chips on every response.

**Architecture:** The backend advisor agent emits two new NDJSON stream event types (`action` and `chips`). The frontend `useChat` hook collects them and attaches them to each message object. `Bubble` grows action pills, a preview card, a done state, and a chip row — all self-contained per message. A new `/api/execute_action` endpoint fires confirmed actions.

**Tech Stack:** Python (Azure Functions), React (Next.js, all in `web/app/page.jsx`), pytest for backend unit tests. No new packages needed.

---

## File map

| File | Change |
|---|---|
| `agents/advisor.py` | Add `suggest_followups` to `TOOLS`; handle in `_dispatch_tool`; emit `action`/`chips` events in `stream_response` |
| `agents/prompts/advisor_system.md` | Add `suggest_followups` instruction |
| `functions/function_app.py` | Add `POST /api/execute_action` route |
| `web/app/page.jsx` | Extend `useChat`; replace `Bubble`; update `AskTab` and `AskInlineModal` |
| `tests/test_suggest_followups.py` | New — unit tests for suggest_followups dispatch |
| `tests/test_execute_action.py` | New — unit tests for execute_action route |

---

## Task 1: Add `suggest_followups` tool to advisor.py

**Files:**
- Modify: `agents/advisor.py:41-142` (TOOLS list)
- Modify: `agents/advisor.py:149-193` (_dispatch_tool)
- Create: `tests/test_suggest_followups.py`

- [ ] **Step 1: Write the failing test**

Create `tests/__init__.py` (empty) and `tests/test_suggest_followups.py`:

```python
import json
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.advisor import _dispatch_tool


def test_suggest_followups_returns_proposed_true():
    chips = [
        {"emoji": "🌿", "text": "What else should I know?"},
        {"emoji": "📋", "text": "Show me what's overdue"},
    ]
    result = json.loads(_dispatch_tool("suggest_followups", {"chips": chips}, "test_user"))
    assert result["proposed"] is True
    assert result["chips_count"] == 2


def test_suggest_followups_empty_chips():
    result = json.loads(_dispatch_tool("suggest_followups", {"chips": []}, "test_user"))
    assert result["proposed"] is True
    assert result["chips_count"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\hmanito\heed
python -m pytest tests/test_suggest_followups.py -v
```

Expected: `FAILED` — `suggest_followups` falls through to the `else` branch returning `{"error": "Unknown tool: suggest_followups"}`.

- [ ] **Step 3: Add `suggest_followups` to TOOLS in advisor.py**

In `agents/advisor.py`, insert the following entry at line 142, immediately after the closing `},` of the `propose_action` entry and before the final `]`:

```python
    {
        "type": "function",
        "function": {
            "name": "suggest_followups",
            "description": "Suggest 2-3 contextual follow-up chips to show the user after your response. Always call this at the end of every response. Chips must be specific to what you just said — 'What about my gym routine?' beats 'Tell me more.'",
            "parameters": {
                "type": "object",
                "properties": {
                    "chips": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "emoji": {"type": "string"},
                                "text": {"type": "string"},
                            },
                            "required": ["emoji", "text"],
                        },
                        "minItems": 2,
                        "maxItems": 3,
                    },
                },
                "required": ["chips"],
            },
        },
    },
```

- [ ] **Step 4: Add handler in `_dispatch_tool`**

In `agents/advisor.py`, find the `elif name == "propose_action":` block (around line 182) and add a new branch immediately after it, before the `else`:

```python
        elif name == "suggest_followups":
            return json.dumps({
                "proposed": True,
                "chips_count": len(arguments.get("chips", [])),
            })
```

- [ ] **Step 5: Run test to verify it passes**

```
python -m pytest tests/test_suggest_followups.py -v
```

Expected: both tests `PASSED`.

- [ ] **Step 6: Commit**

```
git add agents/advisor.py tests/__init__.py tests/test_suggest_followups.py
git commit -m "feat: add suggest_followups tool to advisor"
```

---

## Task 2: Emit `action` and `chips` stream events in stream_response

**Files:**
- Modify: `agents/advisor.py:326-358` (the tool dispatch loop inside `stream_response`)

- [ ] **Step 1: Locate the loop in stream_response**

Open `agents/advisor.py`. Find the `for tc in tool_calls_acc.values():` block starting around line 343. It currently ends with `messages.append({...})`. You'll insert new code between `yield {"type": "tool_result", ...}` and `messages.append(...)`.

- [ ] **Step 2: Add the constant dict before `stream_response`**

Insert after the `_dispatch_tool` function (around line 194), before the `_today_view_json` function:

```python
_ACTION_DISPLAY = {
    "mark_done":       ("Mark done",  "✓"),
    "skip":            ("Skip this",  "⏭"),
    "defer":           ("Defer",      "→"),
    "lighten_routine": ("Lighten it", "🪶"),
    "add_context":     ("Add context","📍"),
}
```

- [ ] **Step 3: Emit special events after each tool_result**

In the `for tc in tool_calls_acc.values():` loop, find the line:
```python
yield {"type": "tool_result", "name": tc["name"], "preview": preview}
```

Immediately after that line, add:

```python
                if tc["name"] == "propose_action" and args:
                    action_type = args.get("action_type", "")
                    default_label, default_emoji = _ACTION_DISPLAY.get(
                        action_type, (action_type.replace("_", " ").title(), "")
                    )
                    payload = args.get("payload") or {}
                    yield {
                        "type": "action",
                        "action_type": action_type,
                        "label": payload.get("label", default_label),
                        "emoji": payload.get("emoji", default_emoji),
                        "task_id": args.get("task_id"),
                        "routine_id": args.get("routine_id"),
                        "payload": payload,
                    }
                elif tc["name"] == "suggest_followups" and args:
                    yield {"type": "chips", "chips": args.get("chips", [])}
```

- [ ] **Step 4: Verify the full modified loop looks correct**

The tool dispatch loop (starting around line 343) should now read:

```python
            for tc in tool_calls_acc.values():
                try:
                    args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    args = {}

                yield {"type": "tool_call", "name": tc["name"]}
                result = _dispatch_tool(tc["name"], args, user_id)
                preview = result[:120] + "..." if len(result) > 120 else result
                yield {"type": "tool_result", "name": tc["name"], "preview": preview}

                if tc["name"] == "propose_action" and args:
                    action_type = args.get("action_type", "")
                    default_label, default_emoji = _ACTION_DISPLAY.get(
                        action_type, (action_type.replace("_", " ").title(), "")
                    )
                    payload = args.get("payload") or {}
                    yield {
                        "type": "action",
                        "action_type": action_type,
                        "label": payload.get("label", default_label),
                        "emoji": payload.get("emoji", default_emoji),
                        "task_id": args.get("task_id"),
                        "routine_id": args.get("routine_id"),
                        "payload": payload,
                    }
                elif tc["name"] == "suggest_followups" and args:
                    yield {"type": "chips", "chips": args.get("chips", [])}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })
```

- [ ] **Step 5: Verify existing tests still pass**

```
python -m pytest tests/ -v
```

Expected: all previous tests `PASSED`.

- [ ] **Step 6: Commit**

```
git add agents/advisor.py
git commit -m "feat: emit action and chips stream events from advisor"
```

---

## Task 3: Update system prompt to always call suggest_followups

**Files:**
- Modify: `agents/prompts/advisor_system.md`

- [ ] **Step 1: Add instruction to the Output format section**

In `agents/prompts/advisor_system.md`, find the line:
```
Keep responses calibrated to the question. A "what am I forgetting" deserves 4-8 lines.
```

Insert a new paragraph immediately after that line:

```
At the end of every response, call `suggest_followups` with 2–3 chips tailored to what you just said. Make them specific — "What about my gym routine?" beats "Tell me more." Good chips open a natural next step, ask about a related area, or let the user dismiss gracefully.
```

- [ ] **Step 2: Commit**

```
git add agents/prompts/advisor_system.md
git commit -m "feat: instruct advisor to always call suggest_followups"
```

---

## Task 4: Add POST /api/execute_action endpoint

**Files:**
- Modify: `functions/function_app.py`
- Create: `tests/test_execute_action.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_execute_action.py`:

```python
import json
import sys, os
from unittest.mock import patch, MagicMock
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _make_request(body: dict, method: str = "POST"):
    """Minimal mock of an Azure Functions HttpRequest."""
    req = MagicMock()
    req.method = method
    req.get_json.return_value = body
    return req


def test_execute_action_mark_done_success():
    with patch("functions.function_app.action_tools") as mock_tools:
        mock_tools.mark_task_done.return_value = {"success": True, "completion_id": "comp_abc"}
        from functions.function_app import execute_action
        req = _make_request({"action_type": "mark_done", "payload": {"task_id": "task_123"}})
        resp = execute_action(req)
        body = json.loads(resp.get_body())
        assert body["ok"] is True
        assert "summary" in body
        mock_tools.mark_task_done.assert_called_once_with("task_123", "usr_heed_demo_001", note=None)


def test_execute_action_missing_action_type():
    from functions.function_app import execute_action
    req = _make_request({"payload": {}})
    resp = execute_action(req)
    assert resp.status_code == 400
    body = json.loads(resp.get_body())
    assert "error" in body


def test_execute_action_unknown_type():
    from functions.function_app import execute_action
    req = _make_request({"action_type": "fly_to_moon", "payload": {}})
    resp = execute_action(req)
    assert resp.status_code == 400


def test_execute_action_options_cors():
    from functions.function_app import execute_action
    req = _make_request({}, method="OPTIONS")
    resp = execute_action(req)
    assert resp.status_code == 204
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest tests/test_execute_action.py -v
```

Expected: `FAILED` — `execute_action` is not yet defined in `function_app.py`.

- [ ] **Step 3: Add the execute_action route to function_app.py**

In `functions/function_app.py`, insert the following before the `# ── memory_keeper_timer` section (around line 349):

```python
# ── execute_action ─────────────────────────────────────────────────────────────

@app.route(route="execute_action", methods=["POST", "OPTIONS"])
def execute_action(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/execute_action
    Body: {"action_type": "...", "payload": {...}}
    Executes a confirmed action proposed by the Advisor agent.
    """
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    try:
        body = req.get_json()
    except ValueError:
        return _error("Invalid JSON body")

    action_type = body.get("action_type")
    payload = body.get("payload") or {}

    if not action_type:
        return _error("action_type is required")

    if action_type == "mark_done":
        task_id = payload.get("task_id")
        if not task_id:
            return _error("task_id required for mark_done")
        result = action_tools.mark_task_done(task_id, USER_ID, note=payload.get("note"))
        if result.get("success"):
            return _json_response({"ok": True, "summary": "Task marked done"})
        return _json_response({"ok": False, "error": result.get("error", "Failed")}, 400)

    elif action_type == "skip":
        task_id = payload.get("task_id")
        if not task_id:
            return _error("task_id required for skip")
        result = action_tools.skip_task(
            task_id, USER_ID,
            skip_reason=payload.get("skip_reason", "other"),
            note=payload.get("note"),
        )
        if result.get("success"):
            return _json_response({"ok": True, "summary": "Task skipped"})
        return _json_response({"ok": False, "error": result.get("error", "Failed")}, 400)

    elif action_type == "defer":
        task_id = payload.get("task_id")
        defer_until = payload.get("defer_until")
        if not task_id:
            return _error("task_id required for defer")
        if not defer_until:
            return _error("defer_until required for defer")
        result = action_tools.defer_task(
            task_id, USER_ID,
            defer_until=defer_until,
            reason=payload.get("note"),
        )
        if result.get("success"):
            return _json_response({"ok": True, "summary": f"Task deferred to {defer_until[:10]}"})
        return _json_response({"ok": False, "error": result.get("error", "Failed")}, 400)

    elif action_type == "lighten_routine":
        routine_id = payload.get("routine_id")
        if not routine_id:
            return _error("routine_id required for lighten_routine")
        result = action_tools.lighten_routine(
            routine_id, USER_ID,
            items_to_keep=payload.get("keep", []),
        )
        if result.get("success"):
            removed = payload.get("preview", {}).get("remove", [])
            names = ", ".join(i["name"] if isinstance(i, dict) else i for i in removed)
            summary = f"Routine lightened" + (f" — removed: {names}" if names else "")
            return _json_response({"ok": True, "summary": summary})
        return _json_response({"ok": False, "error": result.get("error", "Failed")}, 400)

    elif action_type == "add_context":
        result = action_tools.add_user_context(
            user_id=USER_ID,
            context_type=payload.get("context_type", "other"),
            start_date=payload.get("start_date", ""),
            end_date=payload.get("end_date", ""),
            description=payload.get("description", ""),
        )
        if result.get("success"):
            return _json_response({"ok": True, "summary": "Context added"})
        return _json_response({"ok": False, "error": result.get("error", "Failed")}, 400)

    else:
        return _error(f"Unknown action_type: {action_type}", 400)
```

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest tests/test_execute_action.py -v
```

Expected: all 4 tests `PASSED`.

- [ ] **Step 5: Run all tests**

```
python -m pytest tests/ -v
```

Expected: all tests `PASSED`.

- [ ] **Step 6: Commit**

```
git add functions/function_app.py tests/test_execute_action.py
git commit -m "feat: add execute_action endpoint for confirmed advisor actions"
```

---

## Task 5: Extend useChat hook to collect action/chips events and execute actions

**Files:**
- Modify: `web/app/page.jsx:145-205` (useChat hook)

- [ ] **Step 1: Extend the send() function to collect new events**

In `web/app/page.jsx`, find the `useChat` hook (line 145). Inside the `send` callback, find these two lines immediately after `let finalText = ''`:

```js
    let thinkingSteps = []
    let finalText = ''
```

Replace them with:

```js
    let thinkingSteps = []
    let finalText = ''
    let pendingActions = []
    let pendingChips = []
```

- [ ] **Step 2: Parse action and chips events in the try block**

Inside `send`, find the block that processes events (currently around line 176):

```js
      thinkingSteps = events.filter(e => e.type === 'thinking').map(e => e.step)
      const done = events.find(e => e.type === 'done')
      finalText = done?.final_text || events.filter(e => e.type === 'delta').map(e => e.text).join('') || ''
      if (!finalText) throw new Error('empty')
```

Replace with:

```js
      thinkingSteps = events.filter(e => e.type === 'thinking').map(e => e.step)
      pendingActions = events
        .filter(e => e.type === 'action')
        .map(({ type, ...rest }) => rest)
      const chipsEvent = events.find(e => e.type === 'chips')
      pendingChips = chipsEvent?.chips || []
      const done = events.find(e => e.type === 'done')
      finalText = done?.final_text || events.filter(e => e.type === 'delta').map(e => e.text).join('') || ''
      if (!finalText) throw new Error('empty')
```

- [ ] **Step 3: Attach actions and chips to the message on completion**

Inside `send`, find the line that pushes the completed assistant message (currently around line 199):

```js
    setMessages(m => [...m, { role: 'assistant', content: acc }])
```

Replace with:

```js
    setMessages(m => [...m, { role: 'assistant', content: acc, actions: pendingActions, chips: pendingChips }])
```

- [ ] **Step 4: Add executeAction function to the hook**

Inside the `useChat` hook body, after the `send` callback definition and before the `return` statement, add:

```js
  const executeAction = useCallback(async (messageIndex, actionIndex) => {
    const msg = messages[messageIndex]
    if (!msg?.actions?.[actionIndex]) return
    const action = msg.actions[actionIndex]
    if (action.confirmed) return

    try {
      const resp = await fetch(`${FUNCTIONS_URL}/api/execute_action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: action.action_type,
          payload: { ...action.payload, task_id: action.task_id, routine_id: action.routine_id },
        }),
      })
      const result = await resp.json()
      if (!result.ok) throw new Error(result.error || 'Failed')
      setMessages(msgs => msgs.map((m, i) => {
        if (i !== messageIndex) return m
        return {
          ...m,
          actions: m.actions.map((a, j) =>
            j === actionIndex ? { ...a, confirmed: true, summary: result.summary } : a
          ),
        }
      }))
    } catch (err) {
      setMessages(msgs => msgs.map((m, i) => {
        if (i !== messageIndex) return m
        return {
          ...m,
          actions: m.actions.map((a, j) =>
            j === actionIndex ? { ...a, error: err.message } : a
          ),
        }
      }))
    }
  }, [messages])
```

- [ ] **Step 5: Export executeAction from the hook**

Find the `return` statement of `useChat` (currently line 204):

```js
  return { messages, input, setInput, thinking, streaming, busy, send }
```

Replace with:

```js
  return { messages, input, setInput, thinking, streaming, busy, send, executeAction }
```

- [ ] **Step 6: Manual smoke test — verify the hook change doesn't break the UI**

```
cd C:\Users\hmanito\heed\web
npm run dev
```

Open http://localhost:3000. The Ask Heed tab should open, suggestion chips should still work, and a chat should complete normally. No errors in the browser console.

- [ ] **Step 7: Commit**

```
git add web/app/page.jsx
git commit -m "feat: extend useChat to collect action/chips events and execute actions"
```

---

## Task 6: Add interactive Bubble UI with action pills, preview card, chip row

**Files:**
- Modify: `web/app/page.jsx:356-375` (Bubble component)
- Modify: `web/app/page.jsx:710-716` (AskTab message list)
- Modify: `web/app/page.jsx:1036` (AskInlineModal message list)

- [ ] **Step 1: Replace the Bubble component**

In `web/app/page.jsx`, find the entire `Bubble` function (lines 356–375):

```js
function Bubble({ role, content, streaming: isStreaming }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12, animation: 'heed-fadeUp 0.3s ease' }}>
      <div style={{
        maxWidth: '84%',
        background: isUser ? C.warmDark : C.paper,
        color: isUser ? C.cream : C.ink,
        padding: '12px 16px',
        borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
        border: isUser ? 'none' : `1px solid ${C.border}`,
        fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap',
        boxShadow: isUser ? C.shadowSoft : 'none', fontFamily: 'inherit',
      }}>
        {content}
        {isStreaming && <span style={{ opacity: 0.5, animation: 'heed-blink 1s infinite' }}>▍</span>}
      </div>
    </div>
  )
}
```

Replace the entire block with:

```js
function Bubble({ role, content, streaming: isStreaming, actions, chips, onConfirm, onChipClick }) {
  const [activePreviewIndex, setActivePreviewIndex] = useState(null)
  const isUser = role === 'user'
  const hasActions = !isUser && actions?.length > 0
  const hasChips = !isUser && chips?.length > 0

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12, animation: 'heed-fadeUp 0.3s ease' }}>
      <div style={{
        maxWidth: '84%',
        background: isUser ? C.warmDark : C.paper,
        color: isUser ? C.cream : C.ink,
        padding: '12px 16px',
        borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
        border: isUser ? 'none' : `1px solid ${C.border}`,
        fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap',
        boxShadow: isUser ? C.shadowSoft : 'none', fontFamily: 'inherit',
      }}>
        {content}
        {isStreaming && <span style={{ opacity: 0.5, animation: 'heed-blink 1s infinite' }}>▍</span>}

        {hasActions && (
          <div style={{ borderTop: `1px solid ${C.hairline}`, marginTop: 12, paddingTop: 10 }}>
            {actions.map((action, i) => {
              if (action.confirmed) {
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.sageSoft, borderRadius: 8, marginBottom: 6, animation: 'heed-fadeIn 0.3s ease' }}>
                    <span style={{ color: C.sage, fontSize: 15, flexShrink: 0 }}>✓</span>
                    <div>
                      <div style={{ fontSize: 12.5, color: C.sage, fontWeight: 600 }}>{action.label}</div>
                      {action.summary && <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 1 }}>{action.summary}</div>}
                    </div>
                  </div>
                )
              }
              if (activePreviewIndex === i) {
                const preview = action.payload?.preview || {}
                return (
                  <div key={i} style={{ background: C.sageSoft, border: `1px solid ${C.sage}55`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, animation: 'heed-fadeIn 0.2s ease' }}>
                    <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.sage, fontWeight: 700, marginBottom: 8 }}>Preview — {action.label}</div>
                    {preview.remove?.length > 0 ? (
                      <>
                        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 6 }}>Remove for {action.payload?.duration_days || 7} days:</div>
                        {preview.remove.map((item, j) => (
                          <div key={j} style={{ fontSize: 12.5, color: C.ink, marginBottom: 3 }}>
                            ✕&nbsp;{typeof item === 'object' ? item.name : item}
                            {item?.duration_min ? <span style={{ color: C.inkMute }}>&nbsp;{item.duration_min} min</span> : null}
                          </div>
                        ))}
                        {preview.keep?.length > 0 && (
                          <>
                            <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 4, marginTop: 10 }}>Keeping:</div>
                            {preview.keep.map((item, j) => (
                              <div key={j} style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 2 }}>· {item}</div>
                            ))}
                          </>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 8 }}>
                        {action.action_type === 'mark_done' && 'Mark this task as completed.'}
                        {action.action_type === 'skip' && 'Skip this task for now.'}
                        {action.action_type === 'defer' && `Defer to ${action.payload?.defer_until?.slice(0, 10) || 'later'}.`}
                        {action.action_type === 'add_context' && 'Add this context window to your timeline.'}
                        {action.action_type === 'lighten_routine' && 'Reduce your routine for the next week.'}
                      </div>
                    )}
                    {action.error && (
                      <div style={{ fontSize: 12, color: C.rust, marginBottom: 8 }}>{action.error} — try again</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => { onConfirm && onConfirm(i, action); setActivePreviewIndex(null) }}
                        style={{ flex: 1, background: C.sageSoft, border: `1px solid ${C.sage}`, color: C.sage, padding: '7px 0', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setActivePreviewIndex(null)}
                        style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.inkMute, padding: '7px 16px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }
              const isDefer = action.action_type === 'defer'
              return (
                <button key={i}
                  onClick={() => setActivePreviewIndex(i)}
                  style={{
                    background: isDefer ? '#162230' : C.sageSoft,
                    border: `1px solid ${isDefer ? '#4a6a8a' : C.sage + '99'}`,
                    color: isDefer ? '#7aabe0' : C.sage,
                    padding: '5px 13px', borderRadius: 20, fontSize: 12.5,
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontFamily: 'inherit', marginRight: 8, marginBottom: 6, transition: 'all 0.15s',
                  }}
                >
                  <span>{action.emoji}</span>{action.label}
                </button>
              )
            })}
          </div>
        )}

        {hasChips && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: hasActions ? 6 : 10 }}>
            {chips.map((chip, i) => (
              <button key={i}
                onClick={() => onChipClick && onChipClick(chip.text)}
                style={{ background: C.cream, border: `1px solid ${C.border}`, color: C.inkMute, padding: '4px 10px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.inkSoft }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.inkMute }}
              >
                <span style={{ fontSize: 12 }}>{chip.emoji}</span>{chip.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update AskTab to pass new props to Bubble**

In `web/app/page.jsx`, find `AskTab` (around line 684). Find the line that renders messages:

```js
          {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content}/>)}
```

Replace with:

```js
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content}
              actions={m.actions} chips={m.chips}
              onConfirm={(actionIndex) => executeAction(i, actionIndex)}
              onChipClick={(text) => send(text)}
            />
          ))}
```

Also update the destructure at the top of `AskTab` (line 685):

```js
  const { messages, input, setInput, thinking, streaming, busy, send } = useChat()
```

Replace with:

```js
  const { messages, input, setInput, thinking, streaming, busy, send, executeAction } = useChat()
```

- [ ] **Step 3: Update AskInlineModal to pass new props to Bubble**

In `web/app/page.jsx`, find `AskInlineModal` (around line 993). Update the destructure at line 994:

```js
  const { messages, input, setInput, thinking, streaming, busy, send } = useChat()
```

Replace with:

```js
  const { messages, input, setInput, thinking, streaming, busy, send, executeAction } = useChat()
```

Then find the line rendering messages in the modal (around line 1036):

```js
            {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content}/>)}
```

Replace with:

```js
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content}
                actions={m.actions} chips={m.chips}
                onConfirm={(actionIndex) => executeAction(i, actionIndex)}
                onChipClick={(text) => send(text)}
              />
            ))}
```

- [ ] **Step 4: Start the dev server and test the golden path**

```
cd C:\Users\hmanito\heed\web
npm run dev
```

Open http://localhost:3000 and navigate to the Ask Heed tab.

**Test 1 — existing conversation still works:**
- Type any message and send it
- Verify thinking steps animate, text streams word-by-word, no console errors
- Verify clicking a suggestion chip on the empty state still works

**Test 2 — chips appear on every response (requires live backend):**
- If the Azure Functions backend is running locally (`cd functions && func start`), send any message
- Verify 2–3 chip buttons appear below the response text in a muted grey style
- Tap a chip — verify it sends a new message to the chat

**Test 3 — action pills and preview flow (requires live backend with a propose_action response):**
- Send "I have a busy week — lighten my routine" (this should trigger propose_action)
- Verify a green "🪶 Lighten it" pill appears below the response
- Tap the pill — verify a preview card appears showing what will change
- Tap Cancel — verify the pill is restored
- Tap the pill again, then Confirm — verify the pill is replaced by a green "✓ Lightened" done row

**Test 4 — scripted fallback path (no backend needed):**
- Stop the backend if running
- Click "I have a busy week — lighten my routine" suggestion chip
- Verify the scripted response appears correctly (no action pills or chips — expected, scripted path doesn't emit them)
- Verify no JS errors in console

- [ ] **Step 5: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add interactive action pills, preview card, and chips to Bubble"
```

---

## Self-review checklist

Before opening the PR, verify:

- [ ] `python -m pytest tests/ -v` — all green
- [ ] `npm run build` in `web/` completes without errors
- [ ] Chips appear on every live assistant response (not on scripted fallback)
- [ ] Action pill → preview card → confirm flow works end-to-end
- [ ] Cancel restores the action pill
- [ ] Confirmed action shows done row permanently (persists when scrolling)
- [ ] Chip tap sends a new message
- [ ] `AskInlineModal` (the FAB bottom sheet) behaves identically to `AskTab`
- [ ] No regression in the Today and Tracks tabs
