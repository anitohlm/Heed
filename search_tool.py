"""
Azure AI Search tool layer.

Provides semantic search over two indexes:
  - task_memory: the user's tasks + recent completion notes, vector-indexed
  - ph_calendar: PH holidays, payday cycles, bill cycles (static corpus)

The Advisor agent calls these for "what am I forgetting?" style open queries
and for grounding in PH cultural context.
"""

import os
from typing import Optional
from azure.search.documents import SearchClient
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
    """Generate an embedding for a query string using text-embedding-3-small."""
    client = _openai_client()
    deployment = os.environ.get("OPENAI_DEPLOYMENT_EMBED", "heed-embed")
    # TODO: confirm model name matches your Azure deployment
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

    # TODO: build the proper VectorizedQuery + filter expression here.
    # The pattern is:
    #   - vector_queries=[VectorizedQuery(vector=vector, k_nearest_neighbors=top_k, fields="content_vector")]
    #   - filter=f"user_id eq '{user_id}' and status ne 'archived'" + overdue clause
    # Returns iterator of dicts; convert to list.
    raise NotImplementedError("Stub — assemble VectorizedQuery and filter")


def get_task_memory_by_id(task_id: str, user_id: str) -> Optional[dict]:
    """Direct lookup by document key. Cheap, no embedding."""
    # TODO: client.get_document(key=task_id) with optional user_id filter
    raise NotImplementedError("Stub")


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
    # TODO: build filter expression from date_from, date_to, event_types.
    # Example filter: "date ge 2026-04-01 and date le 2026-05-01 and event_type eq 'holiday'"
    # If query is non-trivial, also pass it as the search text.
    raise NotImplementedError("Stub")


def get_holidays_in_range(date_from: str, date_to: str) -> list[dict]:
    """Convenience wrapper for the most common case."""
    return search_ph_calendar(
        query="*",
        date_from=date_from,
        date_to=date_to,
        event_types=["holiday"],
    )
