"""
Heed — Azure Functions backend (Python v2 programming model).

Six functions:
  POST /advisor_stream       — streams Advisor agent output as SSE
  GET  /tasks                — list active tasks
  POST /tasks                — create a task
  PATCH /tasks/{task_id}     — update a task field
  DELETE /tasks/{task_id}    — archive a task
  POST /completions          — mark done / skip / defer
  GET  /context              — list context windows
  POST /context              — create a context window
  GET  /today                — aggregated today view
  POST /memory_keeper_run    — manual trigger (timer runs on schedule)

Timer: memory_keeper_timer — runs every 6 hours.

All secrets come from Key Vault via Managed Identity in production.
For local dev, set values in local.settings.json (copy from .example).
"""

import sys
import os

# Make agents/ importable. In local dev this resolves to the repo root.
# For Azure deployment, run deploy_functions.ps1 first which copies
# agents/ into this directory.
_repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

import json
import logging
import asyncio
import uuid
from datetime import datetime, timezone
import azure.functions as func

from agents.advisor import stream_response
from agents.memory_keeper import run_for_user
from agents.tools import cosmos_tool, action_tools
from agents.models import AgentAction

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

USER_ID = "usr_heed_demo_001"  # Single-user build — no auth in scope


# ── Helpers ───────────────────────────────────────────────────────────────────

def _json_response(data, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data, default=str),
        status_code=status_code,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )


def _error(message: str, status_code: int = 400) -> func.HttpResponse:
    return _json_response({"error": message}, status_code)


def _run_async(coro):
    """Run an async coroutine from a sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ── advisor_stream ─────────────────────────────────────────────────────────────

@app.route(route="advisor_stream", methods=["POST", "OPTIONS"])
def advisor_stream(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/advisor_stream
    Body: {"message": "...", "history": [...]}

    Collects all agent SSE events and returns them as newline-delimited JSON.
    The Next.js /api/agent/stream route re-streams them to the browser as SSE.

    Azure Functions consumption plan does not support true chunked streaming,
    so we collect the full agent run and return it in one response.
    """
    if req.method == "OPTIONS":
        return func.HttpResponse(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        )

    try:
        body = req.get_json()
    except ValueError:
        return _error("Invalid JSON body")

    message = body.get("message", "").strip()
    history = body.get("history", [])

    if not message:
        return _error("message is required")

    if len(message) > 4000:
        return _error("Message too long (max 4000 chars)", 413)

    async def collect_events():
        events = []
        async for event in stream_response(USER_ID, message, history):
            events.append(event)
        return events

    try:
        events = _run_async(collect_events())
        # Return as newline-delimited JSON — Next.js parses and re-streams
        ndjson = "\n".join(json.dumps(e, default=str) for e in events)
        return func.HttpResponse(
            ndjson,
            status_code=200,
            mimetype="application/x-ndjson",
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        logging.exception("advisor_stream failed")
        return _error(f"Agent error: {str(e)}", 500)


# ── tasks ──────────────────────────────────────────────────────────────────────

@app.route(route="tasks", methods=["GET", "POST", "OPTIONS"])
def tasks(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    if req.method == "GET":
        try:
            task_list = cosmos_tool.get_active_tasks(USER_ID)
            return _json_response([t.model_dump(mode="json") for t in task_list])
        except Exception as e:
            logging.exception("tasks GET failed")
            return _error(str(e), 500)

    if req.method == "POST":
        try:
            body = req.get_json()
        except ValueError:
            return _error("Invalid JSON body")

        required = ["name", "category", "importance"]
        missing = [f for f in required if not body.get(f)]
        if missing:
            return _error(f"Missing required fields: {missing}")

        from datetime import datetime, timezone
        import uuid

        task = {
            "id": f"task_{uuid.uuid4().hex[:12]}",
            "user_id": USER_ID,
            "name": body["name"],
            "description": body.get("description"),
            "category": body["category"],
            "importance": body["importance"],
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "explicit_cadence_days": body.get("explicit_cadence_days"),
            "learned_cadence_days": None,
            "learned_confidence": None,
            "last_done_at": None,
            "next_due_at": None,
        }

        db = cosmos_tool._get_database()
        db.get_container_client("tasks").create_item(body=task)
        return _json_response(task, 201)


@app.route(route="tasks/{task_id}", methods=["PATCH", "DELETE", "OPTIONS"])
def task_by_id(req: func.HttpRequest) -> func.HttpResponse:
    task_id = req.route_params.get("task_id")

    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    if req.method == "DELETE":
        task = cosmos_tool.get_task(task_id, USER_ID)
        if not task:
            return _error("Task not found", 404)
        task_dict = task.model_dump(mode="json")
        task_dict["status"] = "archived"
        cosmos_tool._get_database().get_container_client("tasks").replace_item(
            item=task_id, body=task_dict
        )
        return _json_response({"success": True})

    if req.method == "PATCH":
        try:
            body = req.get_json()
        except ValueError:
            return _error("Invalid JSON body")

        task = cosmos_tool.get_task(task_id, USER_ID)
        if not task:
            return _error("Task not found", 404)

        allowed_fields = {"name", "description", "category", "importance",
                          "status", "explicit_cadence_days", "next_due_at"}
        task_dict = task.model_dump(mode="json")

        if "next_due_at" in body and body["next_due_at"] is not None:
            try:
                datetime.fromisoformat(str(body["next_due_at"]).replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                return _error("next_due_at must be a valid ISO 8601 datetime string")

        for field in allowed_fields:
            if field in body:
                task_dict[field] = body[field]

        cosmos_tool._get_database().get_container_client("tasks").replace_item(
            item=task_id, body=task_dict
        )
        return _json_response(task_dict)


# ── suggest_tasks ──────────────────────────────────────────────────────────────

@app.route(route="suggest_tasks", methods=["POST", "OPTIONS"])
def suggest_tasks(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/suggest_tasks
    Body: {"title": "Cook nilaga", "type": "project" | "event"}
    Returns: {"tasks": ["Find a nilaga recipe", "List ingredients", ...]}

    Lightweight one-shot LLM call (no tools, no streaming). Used when the
    user taps "✨ Smarter suggestions" while creating a plan. Falls back to
    the heuristic suggester on the frontend if this fails.
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

    title = (body.get("title") or "").strip()
    plan_type = (body.get("type") or "project").strip().lower()
    if not title:
        return _error("title required")
    if len(title) > 200:
        return _error("title too long", 413)
    if plan_type not in ("project", "event", "goal"):
        plan_type = "project"

    system = (
        f"You are a planning assistant for Heed, a personal task app. The user "
        f"is creating a new {plan_type}. Suggest 5-7 concrete, specific tasks they "
        "should consider. Each task: a short imperative phrase (3-8 words). "
        "Match the user's exact domain — if they say 'Cook nilaga', suggest "
        "Filipino-cooking-specific tasks like 'Buy beef shank' or 'Prep tomatoes "
        "and onions', not generic 'Plan dish'. If 'Learn guitar', music-learning "
        "tasks. Be specific to the actual subject named. No corporate phases "
        "('Define scope', 'Execute first steps') — those are useless.\n\n"
        'Respond with a single JSON object and nothing else. No prose, no '
        'markdown fences, no explanation. Exact shape:\n'
        '{{"tasks": ["First task", "Second task", "Third task"]}}'
    )

    try:
        # Reuse the advisor's already-working AzureOpenAI client. Same env
        # vars, same auth path — if /api/advisor_stream works, this works.
        from agents.advisor import _client as _advisor_client
        client = _advisor_client()
        deployment = os.environ.get("OPENAI_DEPLOYMENT_ADVISOR", "heed-advisor")
        resp = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f'{plan_type.capitalize()}: "{title}"'},
            ],
            # response_format=json_object intentionally omitted — some Azure
            # deployments reject it; we instruct via the prompt and parse
            # defensively below (handles raw JSON, ```json fenced blocks).
            max_tokens=400,
            temperature=0.7,
        )
        text = (resp.choices[0].message.content or "").strip()
        # Strip markdown code fences if the model added them anyway.
        if text.startswith("```"):
            text = text.strip("`").lstrip()
            if text.startswith("json"):
                text = text[4:].lstrip()
            if text.endswith("```"):
                text = text[:-3].rstrip()
        # Handle plain JSON object or raw array.
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            # Last-resort: extract the first top-level array we can find.
            import re
            m = re.search(r"\[[\s\S]*\]", text)
            if not m:
                return _error("LLM response not parseable as JSON", 502)
            parsed = json.loads(m.group(0))
        tasks_raw = parsed.get("tasks", []) if isinstance(parsed, dict) else parsed
        if not isinstance(tasks_raw, list):
            return _error("LLM response missing tasks array", 502)
        tasks = [
            t.strip() for t in tasks_raw
            if isinstance(t, str) and t.strip() and len(t.strip()) <= 80
        ][:7]
        if not tasks:
            return _error("No suggestions returned", 502)
        return _json_response({"tasks": tasks})
    except Exception as e:
        logging.exception("suggest_tasks failed")
        return _error(f"LLM error: {str(e)}", 502)


# ── completions ────────────────────────────────────────────────────────────────

@app.route(route="completions", methods=["POST", "OPTIONS"])
def completions(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/completions
    Body: {"task_id": "...", "event_type": "done|skipped|deferred",
           "note": "...", "skip_reason": "...", "defer_until": "..."}
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

    task_id = body.get("task_id")
    event_type = body.get("event_type")

    if not task_id or not event_type:
        return _error("task_id and event_type required")

    if event_type == "done":
        result = action_tools.mark_task_done(task_id, USER_ID, note=body.get("note"))
    elif event_type == "skipped":
        result = action_tools.skip_task(
            task_id, USER_ID,
            skip_reason=body.get("skip_reason", "other"),
            note=body.get("note"),
        )
    elif event_type == "deferred":
        if not body.get("defer_until"):
            return _error("defer_until required for deferred event")
        result = action_tools.defer_task(
            task_id, USER_ID,
            defer_until=body["defer_until"],
            reason=body.get("note"),
        )
    else:
        return _error(f"Invalid event_type: {event_type}")

    status = 200 if result.get("success") else 400
    return _json_response(result, status)


# ── context ────────────────────────────────────────────────────────────────────

@app.route(route="context", methods=["GET", "POST", "OPTIONS"])
def context(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    if req.method == "GET":
        try:
            active = cosmos_tool.get_active_contexts(USER_ID)
            upcoming = cosmos_tool.get_upcoming_contexts(USER_ID)
            return _json_response({
                "active": [c.model_dump(mode="json") for c in active],
                "upcoming": [c.model_dump(mode="json") for c in upcoming],
            })
        except Exception as e:
            logging.exception("context GET failed")
            return _error(str(e), 500)

    if req.method == "POST":
        try:
            body = req.get_json()
        except ValueError:
            return _error("Invalid JSON body")

        result = action_tools.add_user_context(
            user_id=USER_ID,
            context_type=body.get("context_type", "other"),
            start_date=body.get("start_date", ""),
            end_date=body.get("end_date", ""),
            description=body.get("description", ""),
        )
        status = 201 if result.get("success") else 400
        return _json_response(result, status)


# ── today_view ─────────────────────────────────────────────────────────────────

@app.route(route="today", methods=["GET", "OPTIONS"])
def today_view(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/today — aggregated view for the Today tab."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    try:
        from agents.advisor import _today_view_json
        return func.HttpResponse(
            _today_view_json(USER_ID),
            status_code=200,
            mimetype="application/json",
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        logging.exception("today_view failed")
        return _error(str(e), 500)


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
        routine_id = payload.get("routine_id") or "default"
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

    elif action_type == "add_task":
        name = payload.get("name", "").strip()
        category = payload.get("category", "admin")
        importance = payload.get("importance", "medium")
        if not name:
            return _json_response({"ok": False, "error": "name is required for add_task"}, 400)
        task = {
            "id": f"task_{uuid.uuid4().hex[:12]}",
            "user_id": USER_ID,
            "name": name,
            "description": payload.get("description"),
            "category": category,
            "importance": importance,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "explicit_cadence_days": payload.get("explicit_cadence_days"),
            "learned_cadence_days": None,
            "learned_confidence": None,
            "last_done_at": None,
            "next_due_at": None,
        }
        try:
            cosmos_tool._get_database().get_container_client("tasks").create_item(body=task)
        except Exception as e:
            logging.exception("add_task cosmos write failed")
            return _json_response({"ok": False, "error": str(e)}, 500)
        return _json_response({"ok": True, "summary": f"Added: {name}", "task": task}, 201)

    else:
        return _error(f"Unknown action_type: {action_type}", 400)


# ── memory_keeper_timer ────────────────────────────────────────────────────────

# ── user_state (routines + plans, single document per user) ────────────────────
# Write-through cache pattern: frontend keeps localStorage as source of truth
# for instant UX, but every change POSTs the full collection to /api/user_state.
# On mount, frontend GETs and prefers backend if present, falls back to local
# if the backend is unreachable. Single Cosmos doc per (user, kind) — simpler
# than per-item CRUD and matches how the data is used (whole-list reads).
_USER_STATE_CONTAINER_NAME = "user_state"


def _ensure_user_state_container():
    db = cosmos_tool._get_database()
    try:
        return db.get_container_client(_USER_STATE_CONTAINER_NAME)
    except Exception:
        pass
    # First request after deploy — create the container with /user_id partition key.
    try:
        from azure.cosmos import PartitionKey
        db.create_container_if_not_exists(
            id=_USER_STATE_CONTAINER_NAME,
            partition_key=PartitionKey(path="/user_id"),
        )
    except Exception:
        logging.exception("create user_state container failed")
    return db.get_container_client(_USER_STATE_CONTAINER_NAME)


@app.route(route="user_state/{kind}", methods=["GET", "PUT", "DELETE", "OPTIONS"])
def user_state(req: func.HttpRequest) -> func.HttpResponse:
    """
    GET    /api/user_state/routines  → { items: [...] }
    GET    /api/user_state/plans     → { items: [...] }
    PUT    /api/user_state/routines  body: { items: [...] }  (replace all)
    PUT    /api/user_state/plans     body: { items: [...] }  (replace all)
    DELETE /api/user_state/routines  → wipe
    DELETE /api/user_state/plans     → wipe

    Validated kinds: 'routines', 'plans'.
    """
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    kind = (req.route_params.get("kind") or "").lower()
    if kind not in ("routines", "plans"):
        return _error("kind must be 'routines' or 'plans'")

    doc_id = f"{USER_ID}__{kind}"
    container = _ensure_user_state_container()

    if req.method == "GET":
        try:
            doc = container.read_item(item=doc_id, partition_key=USER_ID)
            return _json_response({"items": doc.get("items", [])})
        except Exception:
            # Not found is the common case for first-time users.
            return _json_response({"items": []})

    if req.method == "DELETE":
        try:
            container.delete_item(item=doc_id, partition_key=USER_ID)
        except Exception:
            pass  # idempotent — already absent is success
        return _json_response({"ok": True})

    if req.method == "PUT":
        try:
            body = req.get_json()
        except ValueError:
            return _error("Invalid JSON body")
        items = body.get("items")
        if not isinstance(items, list):
            return _error("items must be an array")
        if len(items) > 500:
            return _error("Too many items (max 500 per kind)", 413)
        doc = {
            "id": doc_id,
            "user_id": USER_ID,
            "kind": kind,
            "items": items,
            "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        container.upsert_item(body=doc)
        return _json_response({"ok": True, "count": len(items)})


# ── reset (wipe everything for the current user) ───────────────────────────────

@app.route(route="reset", methods=["POST", "OPTIONS"])
def reset_user_data(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/reset
    Wipes the demo user's data: tasks, completions, user_context, user_state.
    Keeps the user record itself (for theme prefs, etc.).
    Frontend also clears localStorage in parallel, so a reload starts fresh.
    """
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    db = cosmos_tool._get_database()
    wiped = {}
    for cname in ("tasks", "completions", "user_context", _USER_STATE_CONTAINER_NAME):
        try:
            container = db.get_container_client(cname)
            # Query all docs for this user, then delete each.
            query = "SELECT c.id, c.user_id FROM c WHERE c.user_id = @uid"
            params = [{"name": "@uid", "value": USER_ID}]
            count = 0
            for item in container.query_items(query=query, parameters=params, enable_cross_partition_query=True):
                try:
                    container.delete_item(item=item["id"], partition_key=item.get("user_id", USER_ID))
                    count += 1
                except Exception:
                    pass
            wiped[cname] = count
        except Exception:
            wiped[cname] = "skipped (container missing)"
    return _json_response({"ok": True, "wiped": wiped})


@app.timer_trigger(
    schedule="0 0 */6 * * *",  # every 6 hours
    arg_name="timer",
    run_on_startup=False,
)
def memory_keeper_timer(timer: func.TimerRequest) -> None:
    """Runs every 6 hours. Computes cadence updates for all active tasks."""
    logging.info("Memory Keeper timer triggered")
    try:
        updates = run_for_user(USER_ID)
        logging.info(f"Memory Keeper completed: {len(updates)} tasks processed")
    except Exception as e:
        logging.exception(f"Memory Keeper failed: {e}")


@app.route(route="memory_keeper_run", methods=["POST", "OPTIONS"])
def memory_keeper_run(req: func.HttpRequest) -> func.HttpResponse:
    """Manual trigger for the Memory Keeper. Useful for testing."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    try:
        updates = run_for_user(USER_ID)
        return _json_response({
            "success": True,
            "tasks_processed": len(updates),
            "updates": [u.model_dump(mode="json") for u in updates],
        })
    except Exception as e:
        logging.exception("memory_keeper_run failed")
        return _error(str(e), 500)
