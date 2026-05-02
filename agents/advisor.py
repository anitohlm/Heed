"""
Advisor agent — user-facing reasoning over the user's tasks, routines, and context.

Streams output token-by-token to the frontend via the advisor_stream Function.
Calls tools to ground every claim in real data.

See agents/prompts/advisor_system.md for the full system prompt — that file
is the contract for how this agent thinks.
"""

import os
import json
from pathlib import Path
from typing import AsyncIterator
from openai import AzureOpenAI
from agents.tools import cosmos_tool, search_tool, bing_tool, action_tools
from agents.models import AgentAction


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
            "description": "Propose a structured action (mark done, skip, defer, lighten routine, add context). For multi-task or destructive actions, ALWAYS set requires_confirmation=true and wait for user response.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": ["mark_done", "skip", "defer", "lighten_routine", "add_context"],
                    },
                    "task_id": {"type": "string"},
                    "routine_id": {"type": "string"},
                    "payload": {"type": "object"},
                    "requires_confirmation": {"type": "boolean", "default": True},
                },
                "required": ["action_type"],
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
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def _today_view_json(user_id: str) -> str:
    """Compose the today view from Cosmos. Used by the get_today_view tool."""
    from datetime import datetime, timezone, timedelta
    from agents.models import TodayView

    now = datetime.now(timezone.utc)
    today_end = now.replace(hour=23, minute=59, second=59)
    week_end = now + timedelta(days=7)

    tasks = cosmos_tool.get_active_tasks(user_id)
    active_contexts = cosmos_tool.get_active_contexts(user_id)
    upcoming_contexts = cosmos_tool.get_upcoming_contexts(user_id)

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

def _client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_KEY"],
        api_version="2024-08-01-preview",
    )


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
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    final_text = ""
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

            # Dispatch each tool call and append results
            for tc in tool_calls_acc.values():
                try:
                    args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    args = {}

                yield {"type": "tool_call", "name": tc["name"]}
                result = _dispatch_tool(tc["name"], args, user_id)
                preview = result[:120] + "..." if len(result) > 120 else result
                yield {"type": "tool_result", "name": tc["name"], "preview": preview}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })
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
