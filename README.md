# Heed

**A gentle personal assistant for what you forget.**

Heed is an agentic personal assistant for the parts of life that quietly slip — household admin, health and wellness habits, savings goals, life events, and the small recurring commitments that fall through the cracks. It learns your real cadences from behavior, surfaces what's at risk first, and adapts to your actual capacity instead of an aspirational one.

Built for the **Microsoft CWB Hackathon 2026**.

**Live demo:** https://brave-pond-035757400.7.azurestaticapps.net/

---

## What it does

- **Today view sorted by risk** — disconnection-risk bills (utilities), then relationships, then daily habits. A 30-day-old toothbrush replacement does not outrank a 9-day-overdue Meralco bill.
- **Cadence learning** — the Memory Keeper agent runs every 6h, observing completion patterns and inferring per-task cadences once a task has ≥5 completions across ≥3 weeks.
- **Adaptive routines** — "Lighten this week" surfaces the items you've actually kept during prior busy weeks (Vitamins + Coffee, every time) and proposes pausing the rest. The agent matches your real capacity, not aspirational.
- **Life events with auto-pause** — tell Heed about a trip or a low day; the right tasks get held, routines pause, the screen palette shifts to a calmer periwinkle on Low Day.
- **Ask Heed (chat)** — multi-step reasoning grounded in your task memory (Azure AI Search) plus the public web (Grounding with Bing for time-sensitive queries). Every mutation is proposed as a confirm chip — the agent never writes without explicit user consent.
- **Plans + Goals** — milestone projects ("Run a marathon"), numeric goals ("Save ₱50,000" with inline savings logging + progress ring), and event-driven plans (a Singapore trip with a prep checklist).
- **Five themes + auto periwinkle on Low Day** — parchment-light (default), midnight-fern, inkwash, flamingo, candy. The whole app cross-dissolves to periwinkle the moment a Low Day context is active and reverts when it ends.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (PWA)                             │
│   Next.js 14 static export · Lora + Nunito Sans · 5 themes       │
│   localStorage: identity, themes, demo cache, plans, chat       │
└────────────────────────────────┬─────────────────────────────────┘
                                 │  X-User-ID + X-Auth-Token (HMAC)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│       AZURE STATIC WEB APPS  →  AZURE FUNCTIONS                  │
│           (Free tier)            (Consumption · Python 3.11)     │
│                                                                  │
│   /api/tasks · /api/completions · /api/context · /api/plans      │
│   /api/advisor_stream     ← streams NDJSON of agent events       │
│   /api/parse_capture      ← free-text → task or routine (Haiku)  │
│   /api/execute_action     ← gated mutations from agent proposals │
│   /api/memory_keeper_run  ← timer-triggered cadence learner      │
└─────┬────────────────────────────┬───────────────────────────────┘
      │                            │
      ▼                            ▼
┌──────────────────┐    ┌──────────────────────────────────────┐
│   COSMOS DB      │    │       AGENT LAYER (Python)            │
│   (NoSQL)        │    │                                       │
│   users · tasks  │    │  advisor.py    ← multi-step planning   │
│   completions    │    │   ├ tools/cosmos_tool   (read state)   │
│   user_context   │    │   ├ tools/search_tool   (AI Search)    │
│   user_state     │    │   ├ tools/bing_tool     (web grounding)│
│   (plans/        │    │   ├ tools/action_tools  (proposals +   │
│    routines)     │    │   │                      Risk-7 gate)  │
│                  │    │   └ tools/safety_tool   (prompt shield)│
│  partition: /user_id  │                                        │
│                  │    │  memory_keeper.py  ← cadence learner   │
└──────────────────┘    │     (timer · every 6h)                 │
                        │                                        │
                        │  auth.py · telemetry.py                │
                        └──────────┬─────────────────────────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
         ┌─────────────────┐ ┌────────────────┐ ┌────────────────┐
         │ AZURE OPENAI    │ │ AZURE AI       │ │ GROUNDING      │
         │ (Foundry)       │ │ SEARCH         │ │ WITH BING      │
         │                 │ │                │ │                │
         │ Sonnet 4.6      │ │ task_memory    │ │ Web facts for  │
         │  → Advisor      │ │  (vector+text) │ │ time-sensitive │
         │                 │ │                │ │ queries        │
         │ Haiku 4.5       │ │ ph_calendar    │ │                │
         │  → Capture      │ │  (cultural)    │ │                │
         │  → Memory Keeper│ │                │ │                │
         └─────────────────┘ └────────────────┘ └────────────────┘
```

| Component | Azure service |
|---|---|
| Frontend | Azure Static Web Apps (Free tier) — serves `web/out/` |
| Backend API | Azure Functions (Consumption plan, Python 3.11, v2 model) |
| Database | Azure Cosmos DB for NoSQL — partition key `/user_id` on every container |
| Vector search | Azure AI Search — `task_memory` (per-user vector + text), `ph_calendar` (PH holidays + cultural events) |
| LLM | Azure OpenAI via AI Foundry — Claude Sonnet 4.6 (advisor reasoning) + Claude Haiku 4.5 (capture parsing, Memory Keeper) |
| Web grounding | Grounding with Bing (called as a tool by the advisor) |
| Secrets | Azure Key Vault (`kv-heed-hack`) via Managed Identity |
| Content safety | Azure AI Content Safety prompt shield on every chat input |

---

## Multi-model strategy

| Model | Where | Why |
|---|---|---|
| **Claude Sonnet 4.6** | `advisor.py` — the agentic loop | Best for multi-step planning, tool selection, weighing trade-offs across the user's whole context. Higher per-token cost, justified by the small number of advisor calls per session. |
| **Claude Haiku 4.5** | `parse_capture` (free-text → structured task), `memory_keeper.py` (cadence pattern learner) | Narrow, well-defined extraction tasks. Sub-500ms latency on capture parsing. |

The split keeps cost low on the high-volume paths (capture + background learning) while the user-facing reasoning surface stays sharp. See `docs/MULTI_MODEL_COMPARISON.md` for the eval.

---

## Grounding strategy

Heed grounds in **two retrieval surfaces** so the agent can reason about both *your* world and *the* world.

1. **Personal data** — `task_memory` index in Azure AI Search. Vector + text search over your tasks, completion history, and the last 5 completion notes per task. The indexer pulls from the Cosmos change feed every 5 minutes. The `ph_calendar` index adds Philippine holidays and cultural events for local-time grounding.
2. **Public web** — Grounding with Bing. The advisor calls `bing_search` for queries that need fresh facts — "is Memorial Day a long weekend this year?", "what's the weather forecast for the trip?". Results are surfaced with the source URL so the user can verify.

This split means Heed never confuses what's personal (your tasks, your patterns) with what's public (dates, facts, world events).

---

## Safety & risk model

The full risk model with seven scenarios is in `docs/SAFETY.md`. In code:

| Risk | Mitigation |
|---|---|
| **Risk 1 — Prompt injection** via task names / chat input | Azure AI Content Safety prompt shield runs on every user message before the advisor sees it. Advisor system prompt also explicitly distrusts task content as instructions. |
| **Risk 2 — Hallucinated mutations** ("I added that for you" with no actual write) | Every mutation goes through `propose_action`; the frontend requires the user to tap a confirm button before `execute_action` fires. The agent cannot write to Cosmos directly. |
| **Risk 3 — Unsafe defer/skip on health-critical tasks** | Tasks marked `importance: 'non-negotiable'` are excluded from auto-lighten logic. |
| **Risk 4 — Stale cadence learning** | Memory Keeper requires ≥5 completions across ≥3 weeks before learning a cadence. |
| **Risk 5 — Cross-user data leak** | Every Cosmos query partitioned on `/user_id`; HMAC verification ensures the X-User-ID header matches the bearer of the X-Auth-Token. |
| **Risk 6 — Fabricated URLs from web grounding** | Bing tool wraps the official Grounding with Bing API which returns cited URLs from a real index; results surface as cards with source URL visible. |
| **Risk 7 — Multi-task destructive actions** | `validate_action` in `agents/tools/action_tools.py` intercepts proposals with `requires_confirmation=true` before any Cosmos write. The frontend renders these as typed-confirmation sheets. |

No PII anywhere in the demo. The `chelle` persona, her Singapore trip, her overdue Maynilad bill, the missed calls to Mom — all synthetic. The demo Cosmos bucket and committed seeds contain no real data.

---

## Local development

### Prerequisites

- Python 3.11, Node.js 20+
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- Azure CLI (`az login`)

### 1. Secrets

```bash
cp functions/local.settings.json.example functions/local.settings.json
# Fill in:
#   COSMOS_CONNECTION_STRING
#   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY
#   AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY
#   HEED_AUTH_SECRET (any random hex string for HMAC tokens)
#   BING_GROUNDING_ENDPOINT, BING_GROUNDING_KEY  (optional — falls back to non-grounded if absent)
#   CONTENT_SAFETY_ENDPOINT, CONTENT_SAFETY_KEY  (optional — prompt shield short-circuits to allow if absent)
```

No keys live in source. The frontend has zero secrets — it uses an HMAC token issued at registration and stored in localStorage. `.env.local` and `local.settings.json` are gitignored.

### 2. Seed data (one-time, optional for local dev — demo mode bypasses it)

```bash
pip install -r requirements.txt
cd data && python load_seed.py
```

### 3. Backend

```bash
cd functions && func start
# http://localhost:7071
```

### 4. Frontend

```bash
cd web
cp .env.local.example .env.local   # NEXT_PUBLIC_FUNCTIONS_URL=http://localhost:7071
npm install && npm run dev
# http://localhost:3000
```

For frontend-only work, pick "Try the demo" on the welcome modal — every screen populates from synthetic seeds and the AI runs against an injected demo-state context block, so you can iterate without the backend running.

---

## Deployment

### Frontend — Azure Static Web Apps

The GitHub Actions workflow (`.github/workflows/azure-static-web-apps-brave-pond-035757400.yml`) auto-deploys `web/out/` on every push to `main`. The static export must be committed (the CI worker can't access `NEXT_PUBLIC_FUNCTIONS_URL` to rebuild it):

```bash
cd web && npm run build
git add web/out && git commit -m "rebuild static export"
```

### Backend — Azure Functions

```powershell
cd functions
.\deploy_functions.ps1
```

This script copies `agents/` into `functions/` for bundling, runs `func azure functionapp publish func-heed`, then removes the copy.

---

## Repository structure

```
Heed/
├── agents/
│   ├── advisor.py           Streaming advisor (async generator)
│   ├── memory_keeper.py     Cadence learning (timer · every 6h)
│   ├── auth.py              HMAC token issue + verify
│   ├── telemetry.py         App Insights span helpers
│   ├── models.py            Pydantic AgentAction, AddRoutinePayload, etc.
│   └── tools/
│       ├── cosmos_tool.py   Read tasks, completions, context from Cosmos
│       ├── action_tools.py  Mark done, skip, defer, add task — Risk-7 gate
│       ├── search_tool.py   Azure AI Search queries
│       ├── bing_tool.py     Grounding with Bing — date-sensitive answers
│       └── safety_tool.py   Azure AI Content Safety prompt shield
├── data/
│   ├── load_seed.py         Seeds Cosmos + AI Search (run once)
│   └── seed-data/           JSON seed files
├── docs/
│   ├── TECHNICAL.md         Full technical reference
│   ├── SAFETY.md            Risk model + adversarial eval
│   └── MULTI_MODEL_COMPARISON.md
├── functions/
│   ├── function_app.py      All HTTP endpoints + memory_keeper_timer
│   └── deploy_functions.ps1
├── infra/
│   └── bicep/               IaC for all Azure resources
├── web/
│   ├── app/
│   │   ├── page.jsx         Full frontend (~12,000 lines, intentionally one file)
│   │   ├── layout.jsx       Root layout, viewport meta, Google Fonts
│   │   ├── globals.css      Reset + motion tokens (--m-fast/base/slow + easings)
│   │   └── themes.js        5 user themes + auto periwinkle for Low Day
│   ├── next.config.mjs      Static export config
│   └── out/                 Pre-built static export (committed for SWA deploy)
└── .github/
    └── workflows/
        └── azure-static-web-apps-brave-pond-035757400.yml
```

---

## Key design decisions

**Personal assistant, not a project manager.**
The Today list sorts by risk-of-disconnection first, then relationships, then daily habits. A 30-day-overdue toothbrush replacement (low importance) does not outrank a 9-day-overdue Meralco bill (high, finance). The risk-tier scoring keeps importance + category dominant; raw overdue days break ties within a tier.

**Hand-rolled agent loop instead of Microsoft Agent Framework.**
At hackathon scope, the framework's onboarding cost outweighed the velocity gains for our specific 2-agent layout. We considered it — the call-graph for Advisor and Memory Keeper would map cleanly to its primitives — and would adopt it in a Phase 2 build where the agent count grows beyond two.

**Functions buffers SSE events into NDJSON.**
Azure Functions Consumption plan does not support chunked HTTP streaming. The advisor collects `thinking` / `delta` / `action` events into NDJSON and returns the full payload at once; the frontend replays events word-by-word to preserve the streaming feel.

**Single `page.jsx` file.**
Hackathon velocity. Easier to grep than to navigate ten import trees. Inline styles + a theme proxy (`C[token]` reads the active theme on every access) means theme switches are immediate without React context. Trade-off: a real codebase would split into module boundaries.

**Demo mode is fully self-contained.**
The "Try the demo" path in the welcome modal flips a localStorage flag. While set: tasks, plans, contexts, routines come from curated synthetic seeds; user additions persist to localStorage so the demo is interactive, not read-only; Ask Heed prepends a `[Demo-mode user state]` block describing the current state so the live Azure OpenAI advisor has data to reason about. This is what makes the judge demo bulletproof — real LLM, real data flow, but no dependence on the demo bucket existing in production Cosmos.

---

## Evaluation

| | Result |
|---|---|
| Safety (7 risk scenarios) | All seven mitigated in code — see `docs/SAFETY.md` |
| Model comparison | Claude Sonnet 4.6 for Advisor, Haiku 4.5 for capture + Memory Keeper — see `docs/MULTI_MODEL_COMPARISON.md` |
| Accessibility | Color contrast ≥4.5:1 on all text; reduced-motion users get clamped transitions automatically; viewport meta + 44pt touch targets across mobile breakpoints |

---

## Known limitations (hackathon scope)

- **CORS open (`*`)** on all Functions endpoints — production would use API Management.
- **HMAC auth is interim.** Real auth is Entra ID / MSAL; we ran out of clock to wire that up. Tokens are deterministic per `(secret, username)` and gated behind `HEED_AUTH_REQUIRED` so the demo bucket stays open for judges.
- **Memory Keeper iterates only the demo user.** The timer-triggered job uses `"demo"` as the user bucket since there's no HTTP request context. A future update should iterate all Cosmos users.
- **Pre-built static export committed to repo.** `web/out/` is in git because the CI worker has no access to `NEXT_PUBLIC_FUNCTIONS_URL` and can't rebuild it. The next iteration moves env injection into the SWA config so CI can build cleanly.

---

## License

Hackathon submission — not yet licensed for redistribution.
