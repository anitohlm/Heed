"""
Action tools — the things the Advisor agent can DO, not just read.

Every action is structured. The Advisor proposes an action by calling one of
these functions; they validate, write to Cosmos, and return success/failure.
The agent NEVER mutates state without going through here.

Per SAFETY.md, Risk 7: multi-task destructive actions require explicit
confirmation. The validation layer here enforces that.
"""

import os
import uuid
from datetime import datetime, timezone, timedelta
from azure.cosmos import CosmosClient
from agents.models import Completion, AgentAction
from agents.tools.cosmos_tool import _get_database, get_task


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# -----------------------------------------------------------------------------
# Single-task actions (no confirmation needed)
# -----------------------------------------------------------------------------

def mark_task_done(task_id: str, user_id: str, note: str = None) -> dict:
    """
    Mark a task as completed. Records a completion and updates the task's
    last_done_at and next_due_at fields.

    Returns:
        {"success": True, "completion_id": "...", "next_due_at": "..."}
        {"success": False, "error": "..."}
    """
    task = get_task(task_id, user_id)
    if not task:
        return {"success": False, "error": f"Task {task_id} not found"}

    completion = Completion(
        id=_new_id("comp"),
        user_id=user_id,
        task_id=task_id,
        completed_at=datetime.now(timezone.utc),
        event_type="done",
        note=note,
    )

    completions_container = _get_database().get_container_client("completions")
    completions_container.create_item(body=completion.model_dump(mode="json"))

    # Update task: last_done_at, next_due_at, learned cadence will be
    # recomputed by Memory Keeper on its next pass.
    tasks_container = _get_database().get_container_client("tasks")
    task_dict = task.model_dump(mode="json")
    task_dict["last_done_at"] = completion.completed_at.isoformat().replace("+00:00", "Z")

    cadence = task.explicit_cadence_days or task.learned_cadence_days
    if cadence:
        next_due = completion.completed_at + timedelta(days=cadence)
        task_dict["next_due_at"] = next_due.isoformat().replace("+00:00", "Z")

    tasks_container.replace_item(item=task_id, body=task_dict)

    return {
        "success": True,
        "completion_id": completion.id,
        "next_due_at": task_dict.get("next_due_at"),
    }


def skip_task(task_id: str, user_id: str, skip_reason: str, note: str = None) -> dict:
    """Mark a task as skipped, with reason. Does NOT update last_done_at."""
    valid_reasons = {"still_fine", "not_applicable", "forgot", "too_busy", "other"}
    if skip_reason not in valid_reasons:
        return {"success": False, "error": f"Invalid skip_reason: {skip_reason}"}

    if not get_task(task_id, user_id):
        return {"success": False, "error": f"Task {task_id} not found"}

    completion = Completion(
        id=_new_id("comp"),
        user_id=user_id,
        task_id=task_id,
        completed_at=datetime.now(timezone.utc),
        event_type="skipped",
        skip_reason=skip_reason,
        note=note,
    )

    container = _get_database().get_container_client("completions")
    container.create_item(body=completion.model_dump(mode="json"))

    return {"success": True, "completion_id": completion.id}


def defer_task(task_id: str, user_id: str, defer_until: str, reason: str = None) -> dict:
    """Push next_due_at out to a specific date. Useful for context-window planning."""
    try:
        defer_dt = datetime.fromisoformat(defer_until.replace("Z", "+00:00"))
    except ValueError:
        return {"success": False, "error": f"Invalid date format: {defer_until}"}

    if defer_dt <= datetime.now(timezone.utc):
        return {"success": False, "error": "defer_until must be in the future"}

    task = get_task(task_id, user_id)
    if not task:
        return {"success": False, "error": f"Task {task_id} not found"}

    # Log a deferred completion record
    completion = Completion(
        id=_new_id("comp"),
        user_id=user_id,
        task_id=task_id,
        completed_at=datetime.now(timezone.utc),
        event_type="deferred",
        note=reason,
    )
    completions_container = _get_database().get_container_client("completions")
    completions_container.create_item(body=completion.model_dump(mode="json"))

    # Update next_due_at on the task
    tasks_container = _get_database().get_container_client("tasks")
    task_dict = task.model_dump(mode="json")
    task_dict["next_due_at"] = defer_dt.isoformat().replace("+00:00", "Z")
    tasks_container.replace_item(item=task_id, body=task_dict)

    return {"success": True, "next_due_at": task_dict["next_due_at"]}


# -----------------------------------------------------------------------------
# Context window actions
# -----------------------------------------------------------------------------

def add_user_context(
    user_id: str,
    context_type: str,
    start_date: str,
    end_date: str,
    description: str,
) -> dict:
    """Add a context window (travel, illness, busy)."""
    valid_types = {"travel", "illness", "busy", "celebration", "other"}
    if context_type not in valid_types:
        return {"success": False, "error": f"Invalid context_type: {context_type}"}

    try:
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
    except ValueError as e:
        return {"success": False, "error": f"Invalid date format: {e}"}

    if start_dt > end_dt:
        return {"success": False, "error": "start_date must be on or before end_date"}

    context = {
        "id": _new_id("ctx"),
        "user_id": user_id,
        "context_type": context_type,
        "start_date": start_date,
        "end_date": end_date,
        "description": description,
        "created_at": _now(),
    }
    container = _get_database().get_container_client("user_context")
    container.create_item(body=context)
    return {"success": True, "context_id": context["id"]}


# -----------------------------------------------------------------------------
# Multi-task actions — REQUIRE CONFIRMATION
# -----------------------------------------------------------------------------

def lighten_routine(routine_id: str, user_id: str, items_to_keep: list[str]) -> dict:
    """
    Reduce a routine to a subset of its items for the current week.

    REQUIRES CONFIRMATION at the agent layer. The Advisor must propose this
    as an AgentAction with requires_confirmation=True; only after the user
    confirms does the orchestrator call this function.
    """
    # Routines are not backed by Cosmos in this build — they live in the
    # frontend prototype only. This returns a structured proposal the agent
    # surfaces to the user; actual application is done client-side.
    return {
        "success": True,
        "routine_id": routine_id,
        "items_kept": items_to_keep,
        "note": "Lighter routine proposal applied. No Cosmos mutation — routines are frontend-only in v0.",
    }


def bulk_mark_done(task_ids: list[str], user_id: str) -> dict:
    """Mark multiple tasks done in one call. ALWAYS requires confirmation."""
    results = []
    for task_id in task_ids:
        result = mark_task_done(task_id, user_id)
        results.append({"task_id": task_id, **result})

    succeeded = sum(1 for r in results if r.get("success"))
    return {
        "success": succeeded == len(task_ids),
        "succeeded": succeeded,
        "failed": len(task_ids) - succeeded,
        "results": results,
    }


# -----------------------------------------------------------------------------
# Action validation — gatekeeper before execution
# -----------------------------------------------------------------------------

def validate_action(action: AgentAction, user_confirmed: bool = False) -> tuple[bool, str]:
    """
    Returns (allowed, reason). Called by the Function layer before any
    action tool is invoked.

    Per SAFETY.md Risk 7: actions with requires_confirmation=True must have
    user_confirmed=True before being allowed through.
    """
    if action.requires_confirmation and not user_confirmed:
        return False, "Action requires user confirmation"

    if action.action_type in {"mark_done", "skip", "defer"} and not action.task_id:
        return False, "task_id required for this action type"

    if action.action_type == "lighten_routine" and not action.routine_id:
        return False, "routine_id required for lighten_routine"

    if action.action_type == "add_context":
        required = {"context_type", "start_date", "end_date", "description"}
        missing = required - set(action.payload.keys())
        if missing:
            return False, f"Missing required fields: {missing}"

    return True, "OK"
