"""
Seed data loader for Heed.

Loads five JSON files into Cosmos DB and creates both AI Search indexes.
Generates embeddings for task_memory documents via Azure OpenAI.

Usage:
    cd data
    cp .env.example .env        # fill in your values
    python load_seed.py

All credentials from .env — never hardcoded here.
"""

import json
import os
import sys
import time
from pathlib import Path

from azure.cosmos import CosmosClient, PartitionKey, exceptions
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SearchField,
    SearchFieldDataType,
    SimpleField,
    SearchableField,
    VectorSearch,
    HnswAlgorithmConfiguration,
    VectorSearchProfile,
    SearchField as VectorField,
)
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SEED_DIR = Path(__file__).parent / "seed-data"

# ── Credentials from .env ─────────────────────────────────────────────────────

def _require(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        print(f"ERROR: {key} is not set in .env")
        sys.exit(1)
    return val


COSMOS_CONNECTION_STRING = _require("COSMOS_CONNECTION_STRING")
COSMOS_DATABASE = os.environ.get("COSMOS_DATABASE", "heed")
SEARCH_ENDPOINT = _require("AZURE_SEARCH_ENDPOINT")
SEARCH_KEY = _require("AZURE_SEARCH_KEY")
OPENAI_ENDPOINT = _require("AZURE_OPENAI_ENDPOINT")
OPENAI_KEY = _require("AZURE_OPENAI_KEY")
EMBED_DEPLOYMENT = os.environ.get("OPENAI_DEPLOYMENT_EMBED", "heed-embed")


# ── Clients ───────────────────────────────────────────────────────────────────

def _cosmos_db():
    client = CosmosClient.from_connection_string(COSMOS_CONNECTION_STRING)
    return client.get_database_client(COSMOS_DATABASE)


def _search_index_client():
    return SearchIndexClient(
        endpoint=SEARCH_ENDPOINT,
        credential=AzureKeyCredential(SEARCH_KEY),
    )


def _search_client(index_name: str):
    return SearchClient(
        endpoint=SEARCH_ENDPOINT,
        index_name=index_name,
        credential=AzureKeyCredential(SEARCH_KEY),
    )


def _openai_client():
    return AzureOpenAI(
        azure_endpoint=OPENAI_ENDPOINT,
        api_key=OPENAI_KEY,
        api_version="2024-08-01-preview",
    )


# ── Step 1: Cosmos containers ─────────────────────────────────────────────────

def ensure_containers():
    print("\n[1/5] Ensuring Cosmos containers exist...")
    db = _cosmos_db()
    containers = [
        ("users", "/id"),
        ("tasks", "/user_id"),
        ("completions", "/user_id"),
        ("user_context", "/user_id"),
    ]
    for name, pk in containers:
        try:
            db.create_container(id=name, partition_key=PartitionKey(path=pk))
            print(f"  Created container: {name}")
        except exceptions.CosmosResourceExistsError:
            print(f"  Container already exists: {name}")


# ── Step 2-5: Load JSON files into Cosmos ─────────────────────────────────────

def load_cosmos_container(container_name: str, json_file: str, partition_key_field: str):
    db = _cosmos_db()
    container = db.get_container_client(container_name)
    data = json.loads((SEED_DIR / json_file).read_text(encoding="utf-8"))

    created = skipped = 0
    for item in data:
        try:
            container.create_item(body=item)
            created += 1
        except exceptions.CosmosResourceExistsError:
            skipped += 1

    print(f"  {container_name}: {created} created, {skipped} already existed")


def load_cosmos():
    print("\n[2/5] Loading Cosmos seed data...")
    load_cosmos_container("users", "users.json", "id")
    load_cosmos_container("tasks", "tasks.json", "user_id")
    load_cosmos_container("completions", "completions.json", "user_id")
    load_cosmos_container("user_context", "user_context.json", "user_id")


# ── Step 3: Create AI Search indexes ─────────────────────────────────────────

def create_task_memory_index():
    print("\n[3/5] Creating task_memory AI Search index...")
    index_client = _search_index_client()

    fields = [
        SimpleField(name="id", type=SearchFieldDataType.String, key=True, filterable=True),
        SimpleField(name="user_id", type=SearchFieldDataType.String, filterable=True),
        SearchableField(name="name", type=SearchFieldDataType.String),
        SearchableField(name="description", type=SearchFieldDataType.String),
        SearchableField(name="category", type=SearchFieldDataType.String, filterable=True),
        SearchableField(name="recent_notes", type=SearchFieldDataType.String),
        SimpleField(name="last_done_at", type=SearchFieldDataType.DateTimeOffset, filterable=True, sortable=True),
        SimpleField(name="next_due_at", type=SearchFieldDataType.DateTimeOffset, filterable=True, sortable=True),
        SimpleField(name="importance", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="status", type=SearchFieldDataType.String, filterable=True),
        SearchField(
            name="content_vector",
            type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
            searchable=True,
            vector_search_dimensions=1536,
            vector_search_profile_name="heed-vector-profile",
        ),
    ]

    vector_search = VectorSearch(
        algorithms=[HnswAlgorithmConfiguration(name="heed-hnsw")],
        profiles=[VectorSearchProfile(name="heed-vector-profile", algorithm_configuration_name="heed-hnsw")],
    )

    index = SearchIndex(name="task_memory", fields=fields, vector_search=vector_search)

    try:
        index_client.create_or_update_index(index)
        print("  task_memory index created/updated")
    except Exception as e:
        print(f"  ERROR creating task_memory index: {e}")
        raise


def create_ph_calendar_index():
    print("\n[4/5] Creating ph_calendar AI Search index...")
    index_client = _search_index_client()

    fields = [
        SimpleField(name="id", type=SearchFieldDataType.String, key=True, filterable=True),
        SearchableField(name="event_name", type=SearchFieldDataType.String, filterable=True),
        SearchableField(name="event_type", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="date", type=SearchFieldDataType.DateTimeOffset, filterable=True, sortable=True),
        SimpleField(name="is_recurring_yearly", type=SearchFieldDataType.Boolean, filterable=True),
        SearchableField(name="description", type=SearchFieldDataType.String),
        SearchableField(name="affects", type=SearchFieldDataType.String, filterable=True),
    ]

    index = SearchIndex(name="ph_calendar", fields=fields)

    try:
        index_client.create_or_update_index(index)
        print("  ph_calendar index created/updated")
    except Exception as e:
        print(f"  ERROR creating ph_calendar index: {e}")
        raise


# ── Step 4: Upload ph_calendar documents ─────────────────────────────────────

def upload_ph_calendar():
    data = json.loads((SEED_DIR / "ph_calendar.json").read_text(encoding="utf-8"))

    # AI Search needs DateTimeOffset for date fields — append T00:00:00Z
    docs = []
    for item in data:
        doc = dict(item)
        if "T" not in doc["date"]:
            doc["date"] = doc["date"] + "T00:00:00Z"
        docs.append(doc)

    client = _search_client("ph_calendar")
    result = client.upload_documents(documents=docs)
    succeeded = sum(1 for r in result if r.succeeded)
    print(f"  ph_calendar: {succeeded}/{len(docs)} documents uploaded")


# ── Step 5: Generate embeddings and upload task_memory ────────────────────────

def _embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Azure OpenAI has a 2048-item batch limit."""
    client = _openai_client()
    response = client.embeddings.create(model=EMBED_DEPLOYMENT, input=texts)
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]


def _build_recent_notes(task_id: str, completions: list[dict]) -> str:
    """Concatenate the last 5 completion notes for a task."""
    task_completions = [
        c for c in completions
        if c["task_id"] == task_id and c.get("note")
    ]
    task_completions.sort(key=lambda c: c["completed_at"], reverse=True)
    notes = [c["note"] for c in task_completions[:5] if c.get("note")]
    return " | ".join(notes)


def upload_task_memory():
    print("\n[5/5] Generating embeddings and uploading task_memory...")
    tasks = json.loads((SEED_DIR / "tasks.json").read_text(encoding="utf-8"))
    completions = json.loads((SEED_DIR / "completions.json").read_text(encoding="utf-8"))

    # Build embedding input text for each task
    embed_texts = []
    for task in tasks:
        parts = [task["name"]]
        if task.get("description"):
            parts.append(task["description"])
        recent = _build_recent_notes(task["id"], completions)
        if recent:
            parts.append(recent)
        embed_texts.append(" ".join(parts))

    print(f"  Generating {len(embed_texts)} embeddings via {EMBED_DEPLOYMENT}...")
    # Small enough to do in one batch (18 tasks)
    vectors = _embed_batch(embed_texts)
    print("  Embeddings done.")

    # Build search documents
    docs = []
    for task, vector, recent_text in zip(tasks, vectors, embed_texts):
        doc = {
            "id": task["id"],
            "user_id": task["user_id"],
            "name": task["name"],
            "description": task.get("description") or "",
            "category": task["category"],
            "recent_notes": _build_recent_notes(task["id"], completions),
            "importance": task["importance"],
            "status": task["status"],
            "content_vector": vector,
        }
        # DateTimeOffset fields — only include if non-null
        if task.get("last_done_at"):
            doc["last_done_at"] = task["last_done_at"]
        if task.get("next_due_at"):
            doc["next_due_at"] = task["next_due_at"]
        docs.append(doc)

    client = _search_client("task_memory")
    result = client.upload_documents(documents=docs)
    succeeded = sum(1 for r in result if r.succeeded)
    print(f"  task_memory: {succeeded}/{len(docs)} documents uploaded")


# ── Verification hints ────────────────────────────────────────────────────────

def print_verification():
    print("\n── Verification checklist ──────────────────────────────────────")
    print("Cosmos DB (portal → Data Explorer):")
    print("  users       → should have 1 document  (usr_heed_demo_001)")
    print("  tasks       → should have 18 documents")
    print("  completions → should have ~430 documents")
    print("  user_context → should have 4 documents")
    print("")
    print("AI Search (portal → gratitudechain-search → Indexes):")
    print("  task_memory  → 18 documents, content_vector field populated")
    print("  ph_calendar  → 30 documents")
    print("")
    print("Quick search test (portal → task_memory → Search explorer):")
    print('  Query: {"search": "home maintenance", "top": 3}')
    print("  Expected: aircon filter, water dispenser, plants in results")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Heed seed data loader")
    print(f"Cosmos database : {COSMOS_DATABASE}")
    print(f"Search endpoint : {SEARCH_ENDPOINT}")
    print(f"Embed deployment: {EMBED_DEPLOYMENT}")

    ensure_containers()
    load_cosmos()
    create_task_memory_index()
    create_ph_calendar_index()
    # Small delay to let index creation propagate
    time.sleep(3)
    upload_ph_calendar()
    upload_task_memory()

    print("\nDone.")
    print_verification()
