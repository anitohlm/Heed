"""
Azure AI Search tool layer.

Provides semantic search over two indexes:
  - task_memory: the user's tasks + recent completion notes, vector-indexed
  - ph_calendar: PH holidays, payday cycles, bill cycles (static corpus)

The Advisor agent calls these for "what am I forgetting?" style open queries
and for grounding in PH cultural context.
"""

import os
from datetime import datetime, timezone
from typing import Optional
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI


# -----------------------------------------------------------------------------
# Client setup
# -----------------------------------------------------------------------------

def _search_client(index_name: str) -> SearchClient:
    endpoint = os.environ.get("AZURE_SEARCH_ENDPOINT")
    key = os.environ.get("AZURE_SEARCH_KEY")
    if not endpoint or not key:
        raise RuntimeError("Azure Search credentials not set")
    return SearchClient(
        endpoint=endpoint,
        index_name=index_name,
        credential=AzureKeyCredential(key),
    )


def _openai_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_KEY"],
        api_version="2024-08-01-preview",
    )


def _embed(text: str) -> list[float]:
    """Generate an embedding for a query string using text-embedding-3-small.

    Deployment name is `heed-embed` per docs/MULTI_MODEL_COMPARISON.md and
    data/.env.example. Override with OPENAI_DEPLOYMENT_EMBED if your
    deployment uses a different name.
    """
    client = _openai_client()
    deployment = os.environ.get("OPENAI_DEPLOYMENT_EMBED", "heed-embed")
    response = client.embeddings.create(model=deployment, input=text)
    return response.data[0].embedding


# -----------------------------------------------------------------------------
# task_memory index — semantic search over the user's tasks
# -----------------------------------------------------------------------------

def search_task_memory(
    user_id: str,
    query: str,
    top_k: int = 10,
    only_overdue: bool = False,
) -> list[dict]:
    """
    Vector + filter search over the task_memory index.

    The agent calls this for "what am I forgetting?" style questions where the
    answer requires semantic similarity (e.g., "things related to home" should
    match aircon, water dispenser, plants).
    """
    client = _search_client("task_memory")
    vector = _embed(query)

    filter_expr = f"user_id eq '{user_id}' and status ne 'archived'"
    if only_overdue:
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        filter_expr += f" and next_due_at le {now_iso}"

    vector_query = VectorizedQuery(
        vector=vector,
        k_nearest_neighbors=top_k,
        fields="content_vector",
    )

    results = client.search(
        search_text=query,
        vector_queries=[vector_query],
        filter=filter_expr,
        top=top_k,
        select=["id", "user_id", "name", "description", "category",
                "recent_notes", "last_done_at", "next_due_at", "importance", "status"],
    )
    return [dict(r) for r in results]


def get_task_memory_by_id(task_id: str, user_id: str) -> Optional[dict]:
    """Direct lookup by document key. Cheap, no embedding."""
    try:
        doc = client.get_document(key=task_id)
        if doc.get("user_id") != user_id:
            return None
        return dict(doc)
    except Exception:
        return None


# -----------------------------------------------------------------------------
# ph_calendar index — PH holidays, paydays, bill cycles
# -----------------------------------------------------------------------------

def search_ph_calendar(
    query: str,
    date_from: Optional[str] = None,  # ISO date
    date_to: Optional[str] = None,
    event_types: Optional[list[str]] = None,  # e.g. ["holiday", "payday"]
    top_k: int = 5,
) -> list[dict]:
    """
    Search the static PH calendar index.

    Used for grounding when the agent reasons about scheduling: "is there a
    holiday this week," "when's the next payday," etc.

    This index doesn't need vector search for most queries — exact filters on
    date and event_type are usually sufficient. But hybrid (text + filter) is
    fine if the query is loose.
    """
    client = _search_client("ph_calendar")

    filters = []
    if date_from:
        filters.append(f"date ge {date_from}T00:00:00Z")
    if date_to:
        filters.append(f"date le {date_to}T23:59:59Z")
    if event_types:
        type_clauses = " or ".join(f"event_type eq '{t}'" for t in event_types)
        filters.append(f"({type_clauses})")

    filter_expr = " and ".join(filters) if filters else None
    search_text = query if query and query != "*" else "*"

    results = client.search(
        search_text=search_text,
        filter=filter_expr,
        top=top_k,
        select=["id", "event_name", "event_type", "date",
                "is_recurring_yearly", "description", "affects"],
    )
    return [dict(r) for r in results]


def get_holidays_in_range(date_from: str, date_to: str) -> list[dict]:
    """Convenience wrapper for the most common case."""
    return search_ph_calendar(
        query="*",
        date_from=date_from,
        date_to=date_to,
        event_types=["holiday"],
    )
