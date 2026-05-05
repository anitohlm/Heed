"""
Advisor agent — user-facing reasoning over the user's tasks, routines, and context.

Streams output token-by-token to the frontend via the advisor_stream Function.
Calls tools to ground every claim in real data.

See agents/prompts/advisor_system.md for the full system prompt — that file
is the contract for how this agent thinks.
"""

import os
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator
from openai import AzureOpenAI
from agents.tools import cosmos_tool, search_tool, bing_tool, action_tools
from agents.models import AgentAction


# Tools whose only effect is to emit a frontend event (action chip, follow-up
# chips). Once the model has streamed its answer text and called only these,
# no further LLM iteration is needed — saves one full round trip per response.
_TERMINAL_TOOLS = {"propose_action", "suggest_followups"}


# -----------------------------------------------------------------------------
# Prompt loading
# -----------------------------------------------------------------------------

_PROMPT_PATH = Path(__file__).parent / "prompts" / "advisor_system.md"


def _load_system_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


SYSTEM_PROMPT = _load_system_prompt()


# -----------------------------------------------------------------------------
# Tool definitions — exposed to the model in OpenAI tool-use format
# -----------------------------------------------------------------------------

# These are the tool schemas the Advisor can call. The model decides when to
# invoke each; the orchestration loop dispatches and feeds results back.

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_today_view",
            "description": "Get the user's overdue tasks, tasks due today, and tasks coming up this week. Use this for any 'what should I do' or 'what's on my plate' question.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_task_memory",
            "description": "Semantic search over the user's tasks and notes. Use for open-ended questions like 'what am I forgetting' or 'anything related to home maintenance'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language query"},
                    "only_overdue": {"type": "boolean", "default": False},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_recent_tasks",
            "description": "List the user's tasks sorted by creation time, newest first. Use this for questions like 'what's the latest task I added', 'what did I just create', 'show me my newest tasks', or any question that needs to know when tasks were added. Returns up to `limit` tasks with their id, name, category, importance, created_at, and next_due_at.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Max tasks to return. Default 10, max 30.",
                        "default": 10,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_routines",
            "description": (
                "List the user's saved routines (grouped daily/weekly checklists like 'Morning routine' "
                "or 'Evening wind-down'). Each routine has a name, schedule, items list (sub-tasks like "
                "'Stretch', 'Vitamins'), and these completion fields you can rely on directly:\n"
                "  - done_today (bool): did the user complete this routine today?\n"
                "  - done_yesterday (bool): did they complete it yesterday?\n"
                "  - last_done_days_ago (int|null): 0=today, 1=yesterday, etc. null = not in last 14 days.\n"
                "  - done_last_7_days (int): count out of 7.\n"
                "  - last_7_days (bool[]): one entry per day, last entry = today.\n"
                "Use this tool for ANY routine question, including 'did I do X today', 'when did I last "
                "do my morning routine', 'how's my evening wind-down going', 'what routines do I have'. "
                "Routines are NOT the same as recurring tasks — they live in a separate store and have "
                "grouped sub-items."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_plans",
            "description": "List the user's saved plans (multi-step goals like a project, savings goal, or upcoming event). Each plan has a type ('project' | 'goal' | 'event'), title, optional description, and structured progress data: project plans have a tasks checklist with done flags, goal plans have current/target/unit, event plans have an eventDate. Use this for any question about plans specifically — 'how's my Singapore trip plan', 'what plans do I have', 'how much more do I need to save'. Plans are NOT the same as tasks: they're broader, longer-running, and live in a separate store.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task_history",
            "description": "Get all completion records for a specific task, including skips and reasons. Use when the user asks 'why did I skip X' or 'when did I last do Y'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string"},
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_active_contexts",
            "description": "Get current and upcoming context windows (travel, illness, busy periods). Always check this before planning around future dates.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_ph_calendar",
            "description": "Look up Philippine holidays, payday cycles, or bill cycles. Use this BEFORE trying Bing — the indexed data is more reliable.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "date_from": {"type": "string", "description": "ISO date"},
                    "date_to": {"type": "string", "description": "ISO date"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grounded_bing_search",
            "description": "Search the public web for information NOT in the indexed PH calendar. Use sparingly — the indexed data covers most needs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_action",
            "description": (
                "Propose a structured action (mark done, skip, defer, lighten routine, add context). "
                "For multi-task or destructive actions, ALWAYS set requires_confirmation=true and wait "
                "for user response. For lighten_routine, payload MUST include a preview object: "
                '{ "preview": { "remove": [{ "name": "Stretching" }, { "name": "Morning journal" }], '
                '"keep": ["Vitamins", "Coffee"] } }. The remove/keep lists must match the items you '
                "named in your prose so the user sees exactly what changes when they confirm."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": ["mark_done", "skip", "defer", "lighten_routine", "add_context", "add_task", "add_routine"],
                    },
                    "task_id": {"type": "string"},
                    "routine_id": {"type": "string"},
                    "payload": {
                        "type": "object",
                        "description": (
                            "Action-specific payload. For lighten_routine: { preview: { remove: "
                            "[{name: string}], keep: [string] }, duration_days?: number }. For defer: "
                            "{ defer_until: 'YYYY-MM-DD' }. For add_context: { context_type, "
                            "start_date, end_date, description }. "
                            "For add_task: { name, category, importance, explicit_cadence_days? } — "
                            "category must be one of: relationships, finance, admin, home, health, work, self_care. "
                            "For add_routine: { name, items: [string], frequency: daily|weekdays|weekly|monthly, "
                            "importance: nice-to-have|core|non-negotiable, notes? }."
                        ),
                    },
                    "requires_confirmation": {"type": "boolean", "default": True},
                },
                "required": ["action_type"],
            },
        },
    },
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
]


# -----------------------------------------------------------------------------
# Tool dispatch
# -----------------------------------------------------------------------------

def _dispatch_tool(name: str, arguments: dict, user_id: str) -> str:
    """Run a tool call and return a JSON string for the model."""
    try:
        if name == "get_today_view":
            return _today_view_json(user_id)
        elif name == "search_task_memory":
            results = search_tool.search_task_memory(
                user_id=user_id,
                query=arguments["query"],
                only_overdue=arguments.get("only_overdue", False),
            )
            return json.dumps({"results": results})
        elif name == "list_recent_tasks":
            limit = max(1, min(int(arguments.get("limit", 10) or 10), 30))
            tasks = cosmos_tool.get_active_tasks(user_id)
            # Sort by created_at desc; tasks without created_at sink to the end.
            sortable = sorted(
                tasks,
                key=lambda t: (t.created_at or datetime.min.replace(tzinfo=timezone.utc)),
                reverse=True,
            )[:limit]
            return json.dumps({
                "tasks": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "category": t.category,
                        "importance": t.importance,
                        "created_at": t.created_at.isoformat() if t.created_at else None,
                        "next_due_at": t.next_due_at.isoformat() if t.next_due_at else None,
                    }
                    for t in sortable
                ],
            }, default=str)
        elif name == "get_user_routines":
            routines = cosmos_tool.get_user_state(user_id, "routines")
            # Trim to fields the model needs — drop heavy / irrelevant ones.
            shaped = []
            for r in routines:
                completion14d = r.get("completion14d") or []
                if not isinstance(completion14d, list):
                    completion14d = []
                last7 = completion14d[-7:]
                done_last7 = sum(1 for x in last7 if x)
                # By convention, index len-1 of completion14d is TODAY.
                done_today = bool(completion14d[-1]) if completion14d else False
                done_yesterday = bool(completion14d[-2]) if len(completion14d) >= 2 else False
                # Index of the most recent True (0 = today, 1 = yesterday, etc).
                # None if the routine has never been done in the 14-day window.
                last_done_days_ago = None
                for i, v in enumerate(reversed(completion14d)):
                    if v:
                        last_done_days_ago = i
                        break
                shaped.append({
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "schedule": r.get("schedule"),
                    "items": r.get("items") or [],
                    "done_today": done_today,
                    "done_yesterday": done_yesterday,
                    "last_done_days_ago": last_done_days_ago,
                    "done_last_7_days": done_last7,
                    "last_7_days": list(last7),  # ordered oldest → newest, last entry = today
                    "lightened_items": r.get("lightenedItems") or [],
                    "suggestion": r.get("suggestion"),
                })
            return json.dumps({"routines": shaped}, default=str)
        elif name == "get_user_plans":
            plans = cosmos_tool.get_user_state(user_id, "plans")
            # Project tasks can be long; cap at 20 to keep the prompt small.
            shaped = []
            for p in plans:
                ptype = p.get("type")
                base = {
                    "id": p.get("id"),
                    "type": ptype,
                    "title": p.get("title"),
                    "description": p.get("description"),
                    "icon": p.get("icon"),
                }
                if ptype == "project":
                    tasks = (p.get("tasks") or [])[:20]
                    base["tasks"] = [
                        {"label": t.get("label"), "done": bool(t.get("done"))}
                        for t in tasks
                    ]
                    base["due_date"] = p.get("dueDate")
                elif ptype == "goal":
                    base["goal_kind"] = p.get("goalKind")
                    base["target"] = p.get("target")
                    base["current"] = p.get("current")
                    base["unit"] = p.get("unit")
                    base["target_date"] = p.get("targetDate")
                    base["achieved"] = p.get("achieved")
                elif ptype == "event":
                    base["event_date"] = p.get("eventDate")
                    tasks = (p.get("tasks") or [])[:20]
                    base["tasks"] = [
                        {"label": t.get("label"), "done": bool(t.get("done"))}
                        for t in tasks
                    ]
                shaped.append(base)
            return json.dumps({"plans": shaped}, default=str)
        elif name == "get_task_history":
            completions = cosmos_tool.get_completions(arguments["task_id"], user_id)
            return json.dumps({
                "completions": [c.model_dump(mode="json") for c in completions]
            })
        elif name == "get_active_contexts":
            contexts = cosmos_tool.get_active_contexts(user_id)
            upcoming = cosmos_tool.get_upcoming_contexts(user_id)
            return json.dumps({
                "active": [c.model_dump(mode="json") for c in contexts],
                "upcoming": [c.model_dump(mode="json") for c in upcoming],
            })
        elif name == "search_ph_calendar":
            results = search_tool.search_ph_calendar(
                query=arguments["query"],
                date_from=arguments.get("date_from"),
                date_to=arguments.get("date_to"),
            )
            return json.dumps({"results": results})
        elif name == "grounded_bing_search":
            return json.dumps(bing_tool.grounded_search(arguments["query"]))
        elif name == "propose_action":
            action = AgentAction(**arguments)
            allowed, reason = action_tools.validate_action(action, user_confirmed=False)
            return json.dumps({
                "proposed": True,
                "action": action.model_dump(mode="json"),
                "validation": {"allowed_immediately": allowed, "reason": reason},
            })
        elif name == "suggest_followups":
            return json.dumps({
                "ok": True,
                "chips_count": len(arguments.get("chips", [])),
            })
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


_ACTION_DISPLAY = {
    "mark_done":       ("Mark done",   "✓"),
    "skip":            ("Skip this",   "⏭"),
    "defer":           ("Defer",       "→"),
    "lighten_routine": ("Lighten it",  "🪶"),
    "add_context":     ("Add context", "📍"),
    "add_task":        ("Add task",    "＋"),
    "add_routine":     ("Add routine", "↻"),
}


def _today_view_json(user_id: str) -> str:
    """Compose the today view from Cosmos. Used by the get_today_view tool."""
    from datetime import datetime, timezone, timedelta
    from agents.models import TodayView

    now = datetime.now(timezone.utc)
    today_end = now.replace(hour=23, minute=59, second=59)
    week_end = now + timedelta(days=7)

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=3) as executor:
        f_tasks = executor.submit(cosmos_tool.get_active_tasks, user_id)
        f_active = executor.submit(cosmos_tool.get_active_contexts, user_id)
        f_upcoming = executor.submit(cosmos_tool.get_upcoming_contexts, user_id)
        tasks = f_tasks.result()
        active_contexts = f_active.result()
        upcoming_contexts = f_upcoming.result()

    overdue, due_today, upcoming_this_week = [], [], []
    for task in tasks:
        if not task.next_due_at:
            continue
        due = task.next_due_at
        if due < now:
            overdue.append(task)
        elif due <= today_end:
            due_today.append(task)
        elif due <= week_end:
            upcoming_this_week.append(task)

    # Sort overdue by most overdue first
    overdue.sort(key=lambda t: t.next_due_at)

    view = TodayView(
        date=now.date(),
        overdue=overdue,
        due_today=due_today,
        upcoming_this_week=upcoming_this_week,
        active_contexts=active_contexts,
        upcoming_contexts=upcoming_contexts,
    )
    return view.model_dump_json()


# -----------------------------------------------------------------------------
# The streaming agent loop
# -----------------------------------------------------------------------------

_OPENAI_CLIENT: AzureOpenAI | None = None


def _client() -> AzureOpenAI:
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None:
        _OPENAI_CLIENT = AzureOpenAI(
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_key=os.environ["AZURE_OPENAI_KEY"],
            api_version="2024-08-01-preview",
        )
    return _OPENAI_CLIENT


async def stream_response(
    user_id: str,
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> AsyncIterator[dict]:
    """
    Run the Advisor agent against a user message. Yields events as it runs:

      {"type": "thinking", "step": "Looking at tasks overdue..."}
      {"type": "tool_call", "name": "get_today_view"}
      {"type": "tool_result", "name": "get_today_view", "preview": "..."}
      {"type": "delta", "text": "Three things stand"}
      {"type": "delta", "text": " out:"}
      ...
      {"type": "done", "final_text": "...full response..."}

    The frontend consumes these via SSE and renders thinking steps and
    streaming text appropriately.
    """
    deployment = os.environ.get("OPENAI_DEPLOYMENT_ADVISOR", "heed-advisor")
    client = _client()

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if conversation_history:
        trimmed = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
        messages.extend(trimmed)
    messages.append({"role": "user", "content": user_message})

    final_text = ""
    chips_emitted = False
    max_iterations = 6  # Hard cap to prevent runaway tool loops

    # Microsoft Agent Framework's streaming ChatAgent wasn't stable enough at
    # build time for the async generator pattern we need here. Using a
    # hand-rolled OpenAI function-calling loop instead — same semantics,
    # full control over the SSE event shape.
    for iteration in range(max_iterations):
        yield {"type": "thinking", "step": f"Reasoning (pass {iteration + 1})..."}

        response = client.chat.completions.create(
            model=deployment,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            stream=True,
        )

        # Accumulate the streamed response
        current_text = ""
        tool_calls_acc = {}  # index -> {id, name, arguments}
        finish_reason = None

        for chunk in response:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            finish_reason = chunk.choices[0].finish_reason

            # Stream text deltas to the frontend
            if delta.content:
                current_text += delta.content
                yield {"type": "delta", "text": delta.content}

            # Accumulate tool call fragments
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_acc:
                        tool_calls_acc[idx] = {"id": tc.id or "", "name": "", "arguments": ""}
                    if tc.id:
                        tool_calls_acc[idx]["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            tool_calls_acc[idx]["name"] = tc.function.name
                        if tc.function.arguments:
                            tool_calls_acc[idx]["arguments"] += tc.function.arguments

        if finish_reason == "stop" or (finish_reason is None and current_text):
            final_text = current_text
            break

        if finish_reason == "tool_calls" and tool_calls_acc:
            # Append the assistant's tool-call message
            assistant_msg = {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": tc["arguments"]},
                    }
                    for tc in tool_calls_acc.values()
                ],
            }
            messages.append(assistant_msg)

            ordered = list(tool_calls_acc.values())
            parsed_args = []
            for tc in ordered:
                try:
                    parsed_args.append(json.loads(tc["arguments"]) if tc["arguments"] else {})
                except json.JSONDecodeError:
                    parsed_args.append({})

            # Yield tool_call events upfront (preserves prior UX of "thinking" → tools list)
            for tc in ordered:
                yield {"type": "tool_call", "name": tc["name"]}

            # Dispatch all tools concurrently — the LLM often calls 2+ data tools
            # (e.g. get_today_view + get_active_contexts) per iteration; running
            # them sequentially doubled the latency for no reason.
            results_by_id: dict[str, str] = {}
            with ThreadPoolExecutor(max_workers=max(1, len(ordered))) as executor:
                futures = {
                    executor.submit(_dispatch_tool, tc["name"], parsed_args[i], user_id): (i, tc)
                    for i, tc in enumerate(ordered)
                }
                for fut in as_completed(futures):
                    i, tc = futures[fut]
                    args = parsed_args[i]
                    result = fut.result()
                    results_by_id[tc["id"]] = result
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
                        chips_emitted = True
                        yield {"type": "chips", "chips": args.get("chips", [])}

            # Append tool results in the SAME order the model called them in,
            # which is what the OpenAI tool-call protocol expects.
            for tc in ordered:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": results_by_id[tc["id"]],
                })

            # Early-break: if the assistant streamed its final answer this
            # iteration AND every tool it called was terminal (no follow-up data
            # to digest), the next LLM round trip would just produce empty
            # content. Skip it — saves ~1–3 s of perceived latency.
            non_terminal = [tc["name"] for tc in ordered if tc["name"] not in _TERMINAL_TOOLS]
            if current_text and not non_terminal:
                final_text = current_text
                break
        else:
            # Unexpected finish — break to avoid infinite loop
            final_text = current_text
            break

    yield {"type": "done", "final_text": final_text}


# -----------------------------------------------------------------------------
# Synchronous version for non-streaming tests
# -----------------------------------------------------------------------------

def respond(user_id: str, user_message: str) -> str:
    """
    Non-streaming version. Useful for unit tests and the eval harness.
    Returns the final response text only.
    """
    import asyncio

    async def _collect():
        text = ""
        async for event in stream_response(user_id, user_message):
            if event["type"] == "done":
                text = event.get("final_text", "")
        return text

    return asyncio.run(_collect())
