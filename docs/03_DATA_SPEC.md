# Heed — Synthetic Data Spec

This document defines the data model for Heed, the seed data imported on Day 1, and the rationale for non-obvious schema decisions. Every schema choice below is load-bearing — the agent behaviors depend on these fields existing with specific shapes.

**Principle:** all seed data is 100% synthetic. No real names, phone numbers, email addresses, or places of work. The persona below is fictional, satisfying the rubric's PII requirement by default.

---

## 1. The Persona

All seed data belongs to a single fictional user. A single persona keeps the demo coherent and lets the agent's reasoning feel specific rather than generic.

```
user_id: usr_heed_demo_001
display_name: Maya
timezone: Asia/Manila
occupation_hint: freelance graphic designer, Quezon City
lives_with: partner, one cat
notes: busy workload, occasional travel for shoots, 
       prone to forgetting recurring admin and self-care tasks
```

Maya is fictional and does not represent any real user.

---

## 2. Cosmos DB — Containers and Schemas

Cosmos DB is the source of truth and holds state that changes often. There are four containers, with partition keys chosen so every query in the app filters on `user_id`.

### 2.1 `tasks`

**Purpose:** One document per recurring task the user wants to track.

**Partition key:** `/user_id`

**Schema:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Cosmos doc id, format `task_<uuid>` |
| `user_id` | string | yes | Partition key |
| `name` | string | yes | Short label, e.g. "Clean aircon filter" |
| `description` | string | no | Optional longer context |
| `category` | string | yes | One of: `home`, `health`, `admin`, `relationships`, `self_care`, `work`, `finance` |
| `created_at` | ISO 8601 | yes | UTC timestamp |
| `explicit_cadence_days` | number or null | no | User-set interval; null means "learn it" |
| `learned_cadence_days` | number or null | no | Agent-inferred interval; null until enough data |
| `learned_confidence` | number or null | no | 0.0–1.0; how confident the agent is |
| `last_done_at` | ISO 8601 or null | no | Most recent completion timestamp |
| `next_due_at` | ISO 8601 or null | no | Computed; see rules below |
| `status` | string | yes | `active`, `paused`, `archived` |
| `importance` | string | yes | `low`, `medium`, `high` — affects triage ranking |

**Cadence rules:**

- A task uses `explicit_cadence_days` if set. Otherwise it uses `learned_cadence_days`.
- `learned_cadence_days` stays null until the task has at least **5 completions** AND at least **3 weeks** of history. Before that, the agent says "still learning your cadence."
- `learned_confidence` starts at 0.3 at threshold 5 and rises linearly to 0.95 by 20 completions.
- `next_due_at` = `last_done_at` + effective_cadence_days (whichever of explicit/learned applies).

The 5-completions / 3-weeks threshold is lower than an ideal statistical bar. Sparse tasks like "clean aircon filter" only happen 4–5 times per year; a higher threshold would never engage cadence learning for them. The trade-off is accepting lower-confidence inferences on low-frequency tasks; the `learned_confidence` field communicates that uncertainty in the UI.

### 2.2 `completions`

**Purpose:** One document per time a task was done (or deliberately skipped).

**Partition key:** `/user_id`

**Schema:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | `comp_<uuid>` |
| `user_id` | string | yes | Partition key |
| `task_id` | string | yes | References `tasks.id` |
| `completed_at` | ISO 8601 | yes | When the event occurred |
| `event_type` | string | yes | `done`, `skipped`, `deferred` |
| `note` | string | no | Free-text user note |
| `skip_reason` | string | no | Set only when `event_type=skipped`: `still_fine`, `not_applicable`, `forgot`, `too_busy`, `other` |

A "skip" with reason `still_fine` does not increase urgency — the user is actively saying "I don't need this yet." A "skip" with reason `forgot` does increase it. This distinction is what enables the smart-misses behavior.

### 2.3 `user_context`

**Purpose:** Time-bound facts about the user's life that affect scheduling.

**Partition key:** `/user_id`

**Schema:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | `ctx_<uuid>` |
| `user_id` | string | yes | Partition key |
| `context_type` | string | yes | `travel`, `illness`, `busy`, `celebration`, `other` |
| `start_date` | ISO 8601 | yes | Date, not datetime |
| `end_date` | ISO 8601 | yes | Date, not datetime — inclusive |
| `description` | string | yes | Free text — read by the agent |
| `created_at` | ISO 8601 | yes | When the context was logged |

**Agent rule:** during any active context window, recurring tasks not marked `importance=high` are deferred to the first day after `end_date`. High-importance tasks still fire but with a softer message acknowledging the context.

### 2.4 `users`

**Purpose:** User profile.

**Partition key:** `/id`

**Schema:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Same as `user_id` everywhere else |
| `display_name` | string | yes | What the agent calls the user |
| `timezone` | string | yes | IANA, e.g. `Asia/Manila` |
| `language_preference` | string | yes | `english`, `taglish` |
| `notification_quiet_hours` | object | no | `{start: "22:00", end: "07:00"}` |
| `created_at` | ISO 8601 | yes | Signup time |

---

## 3. Azure AI Search — Indexes

AI Search is the retrieval layer, not a source of truth. Cosmos is never mutated through AI Search. The indexer runs on a schedule and reads from Cosmos.

### 3.1 `task_memory` index

**Purpose:** Semantic retrieval for "what am I forgetting?" and similar open queries.

**Fields:**

| Field | Type | Searchable | Filterable | Notes |
|---|---|---|---|---|
| `id` | string (key) | no | yes | Matches `tasks.id` |
| `user_id` | string | no | yes | Filtered by user always |
| `name` | string | yes | no | The task label |
| `description` | string | yes | no | If set |
| `category` | string | yes | yes | |
| `recent_notes` | string | yes | no | Concatenated last 5 completion notes |
| `last_done_at` | DateTimeOffset | no | yes | For recency ranking |
| `next_due_at` | DateTimeOffset | no | yes | For overdue filtering |
| `importance` | string | no | yes | |
| `status` | string | no | yes | `archived` is excluded from queries |
| `content_vector` | Collection(Edm.Single) | yes (vector) | no | Embedding of name + description + recent_notes |

**Embedding model:** `text-embedding-3-small` via Azure OpenAI.

**Re-indexing:** the indexer pulls from Cosmos change feed every 5 minutes.

### 3.2 `ph_calendar` index

**Purpose:** Ground the agent in Philippine time-and-culture context. Small static corpus, seeded once.

**Fields:**

| Field | Type | Searchable | Filterable |
|---|---|---|---|
| `id` | string (key) | no | yes |
| `event_name` | string | yes | yes |
| `event_type` | string | yes | yes |
| `date` | DateTimeOffset | no | yes |
| `is_recurring_yearly` | boolean | no | yes |
| `description` | string | yes | no |
| `affects` | string | yes | yes |

---

## 4. Seed Data

Five files are produced alongside this spec:

- `seed-data/users.json` — Maya's profile
- `seed-data/tasks.json` — 18 tasks across 6 categories
- `seed-data/completions.json` — ~430 completion records spanning ~5 months
- `seed-data/user_context.json` — 4 context windows (past and upcoming)
- `seed-data/ph_calendar.json` — 30 PH holiday and cultural event entries

### Patterns embedded in the seed data

The following patterns are deliberately present in the seed data to support specific demo moments:

1. **"Call Mom" — missed three Sundays in a row.** Demonstrates pattern-break detection and the "your pattern broke, want to change the cadence?" proactive insight.
2. **"Clean aircon filter" — done 5 times with intervals of 10, 12, 11, 13, 11 weeks.** Demonstrates cadence learning converging on ~11 weeks even without an explicit interval.
3. **"Pay Meralco" — always done on the 14th–15th of the month.** Demonstrates calendar-aware pattern detection tied to PH payday cycles.
4. **"Water the plants" — skipped 4 times during a past travel window** with `skip_reason=not_applicable`. Demonstrates that the agent excludes context-window skips from its pattern-break logic.
5. **"Change toothbrush" — last done 4 months ago, no completions since.** Demonstrates "what am I forgetting?" surfacing a forgotten low-frequency task.
6. **Upcoming travel context: Apr 28–May 2 to Singapore.** Demonstrates context-sync deferral on tasks falling in that window.
7. **Mix of Tagalog, Taglish, and English completion notes.** Validates that the agent handles code-switched input correctly.

---

## 5. Day-1 Loading Procedure

In order:

1. Create Cosmos DB account + database `heed` + four containers with partition keys as specified above.
2. Load `users.json` → `users` container.
3. Load `tasks.json` → `tasks` container.
4. Load `completions.json` → `completions` container.
5. Load `user_context.json` → `user_context` container.
6. Create AI Search service.
7. Create `task_memory` index with the schema above. Point an indexer at the Cosmos `tasks` container. Wait for first indexer run.
8. Create `ph_calendar` index. Upload `ph_calendar.json` directly (no indexer — static corpus).

The loader script (`data/load_seed.py`) implements steps 1–8 using `azure-cosmos` and `azure-search-documents`.

---

## 6. Out of Scope

The following are deliberately not included:

- **Authentication.** Single hardcoded `user_id`. Multi-tenant auth would require row-level security and per-user index partitions.
- **Multi-user data.** One persona, many tasks. Multiple users would muddy the partition-key story without serving the demo.
- **Calendar entries beyond 2026.** The `ph_calendar` index covers only the current year.
- **Task dependencies, sub-tasks, or projects.** Heed is a memory system, not a project manager.

---

## 7. Documented Heuristics

The following decisions are heuristics rather than research-backed choices, documented for transparency:

- **5 completions + 3 weeks before cadence learning.** Lowered from an initial 7/4 after testing showed sparse tasks could not clear the higher bar. Trade-off documented in section 2.1.
- **Confidence curve 0.3 → 0.95 linear.** A Bayesian posterior would be more rigorous; linear was chosen for simplicity at the hackathon scope.
- **Category list of seven.** Sufficient for the demo. A production product would let users define their own categories.
- **Skip reasons enum (5 values).** Selected based on the most useful operational distinctions. User testing could collapse `too_busy` and `forgot` into a single category in practice.

If a heuristic produces incorrect agent behavior during the build, the heuristic is updated in this spec before any code change.
