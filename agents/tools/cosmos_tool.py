"""
Cosmos DB tool layer.

Provides read access to Cosmos containers for the agents. Writes go through
the action_tools module so they can be validated.

This module reads connection info from environment, which Functions wires up
from Key Vault via Managed Identity. Never construct connection strings here.
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from azure.cosmos import CosmosClient, exceptions
from agents.models import Task, Completion, UserContext, User


# -----------------------------------------------------------------------------
# Client setup
# -----------------------------------------------------------------------------

_CLIENT: CosmosClient | None = None
_DATABASE = None


def _get_client() -> CosmosClient:
    global _CLIENT
    if _CLIENT is None:
        conn_str = os.environ.get("COSMOS_CONNECTION_STRING")
        if not conn_str:
            raise RuntimeError("COSMOS_CONNECTION_STRING not set")
        _CLIENT = CosmosClient.from_connection_string(conn_str)
    return _CLIENT


_DT_FIELDS = {"created_at", "last_done_at", "next_due_at", "completed_at", "start_date", "end_date"}

def _fix_item(item: dict) -> dict:
    """Strip the malformed +00:00Z suffix (both offset and Z) from datetime strings."""
    out = {}
    for k, v in item.items():
        if k in _DT_FIELDS and isinstance(v, str) and v.endswith("+00:00Z"):
            out[k] = v[:-1]  # drop trailing Z; +00:00 is already a valid UTC offset
        else:
            out[k] = v
    return out


def _get_database():
    global _DATABASE
    if _DATABASE is None:
        db_name = os.environ.get("COSMOS_DATABASE", "heed")
        _DATABASE = _get_client().get_database_client(db_name)
    return _DATABASE


# -----------------------------------------------------------------------------
# Read operations — used by both Advisor and Memory Keeper agents
# -----------------------------------------------------------------------------

def get_user(user_id: str) -> Optional[User]:
    """Fetch the user record."""
    container = _get_database().get_container_client("users")
    try:
        item = container.read_item(item=user_id, partition_key=user_id)
        return User(**item)
    except exceptions.CosmosResourceNotFoundError:
        return None


def get_active_tasks(user_id: str) -> list[Task]:
    """All tasks with status=active for this user."""
    container = _get_database().get_container_client("tasks")
    query = "SELECT * FROM c WHERE c.user_id = @uid AND c.status = 'active'"
    params = [{"name": "@uid", "value": user_id}]
    items = container.query_items(
        query=query,
        parameters=params,
        partition_key=user_id,
    )
    return [Task(**_fix_item(i)) for i in items]


def get_task(task_id: str, user_id: str) -> Optional[Task]:
    """Fetch a single task by ID."""
    container = _get_database().get_container_client("tasks")
    try:
        item = container.read_item(item=task_id, partition_key=user_id)
        return Task(**_fix_item(item))
    except exceptions.CosmosResourceNotFoundError:
        return None


def get_completions(task_id: str, user_id: str) -> list[Completion]:
    """All completions for a given task, ordered by completed_at ascending."""
    container = _get_database().get_container_client("completions")
    query = """
        SELECT * FROM c
        WHERE c.user_id = @uid AND c.task_id = @tid
        ORDER BY c.completed_at ASC
    """
    params = [
        {"name": "@uid", "value": user_id},
        {"name": "@tid", "value": task_id},
    ]
    items = container.query_items(
        query=query,
        parameters=params,
        partition_key=user_id,
    )
    return [Completion(**_fix_item(i)) for i in items]


def get_active_contexts(user_id: str, on_date: Optional[datetime] = None) -> list[UserContext]:
    """
    Context windows that are active on the given date (default: now).
    Active = today >= start_date AND today <= end_date.
    """
    if on_date is None:
        on_date = datetime.now(timezone.utc)
    iso_date = on_date.date().isoformat()

    container = _get_database().get_container_client("user_context")
    query = """
        SELECT * FROM c
        WHERE c.user_id = @uid
          AND c.start_date <= @d
          AND c.end_date >= @d
    """
    params = [
        {"name": "@uid", "value": user_id},
        {"name": "@d", "value": iso_date},
    ]
    items = container.query_items(
        query=query,
        parameters=params,
        partition_key=user_id,
    )
    return [UserContext(**_fix_item(i)) for i in items]


def get_upcoming_contexts(user_id: str, days_ahead: int = 30) -> list[UserContext]:
    """Context windows starting in the next N days."""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    cutoff = (now + timedelta(days=days_ahead)).date().isoformat()

    container = _get_database().get_container_client("user_context")
    query = """
        SELECT * FROM c
        WHERE c.user_id = @uid
          AND c.start_date > @today
          AND c.start_date <= @cutoff
    """
    params = [
        {"name": "@uid", "value": user_id},
        {"name": "@today", "value": today},
        {"name": "@cutoff", "value": cutoff},
    ]
    items = container.query_items(query=query, parameters=params, partition_key=user_id)
    return [UserContext(**_fix_item(i)) for i in items]


def get_recent_completions(user_id: str, days_back: int = 30) -> list[Completion]:
    """All completions across all tasks in the last N days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days_back)).isoformat()

    container = _get_database().get_container_client("completions")
    query = """
        SELECT * FROM c
        WHERE c.user_id = @uid
          AND c.completed_at >= @cutoff
        ORDER BY c.completed_at DESC
    """
    params = [
        {"name": "@uid", "value": user_id},
        {"name": "@cutoff", "value": cutoff},
    ]
    items = container.query_items(query=query, parameters=params, partition_key=user_id)
    return [Completion(**i) for i in items]
