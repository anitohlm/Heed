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
    # TODO: this is the aggregation logic that pulls from get_active_tasks,
    # filters by overdue/due-today/upcoming based on next_due_at, and returns
    # the structured view. Lives here rather than in cosmos_tool because it's
    # presentation-shaped, not raw data.
    raise NotImplementedError("Stub — assemble TodayView from get_active_tasks")


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

    for iteration in range(max_iterations):
        # TODO: this is the iterative tool-calling loop. The shape:
        #   1. Call chat.completions.create with stream=True and tools=TOOLS
        #   2. While streaming: emit "thinking" / "delta" events
        #   3. If the model calls a tool: dispatch, append tool result to
        #      messages, continue the outer loop
        #   4. If the model produces a final answer: yield "done" and break
        #
        # Microsoft Agent Framework has primitives for this loop already;
        # the actual implementation should use them rather than rolling
        # the loop by hand. See the framework docs for ChatAgent / streaming.
        #
        # Until that's wired up, this stub yields a placeholder so the
        # frontend can be developed against the contract above.
        yield {
            "type": "thinking",
            "step": f"[stub iteration {iteration}] would call tools and stream here",
        }
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
    # TODO: same loop as stream_response but without the streaming events,
    # collect the final text and return it.
    raise NotImplementedError("Stub — fill in once stream_response works")
