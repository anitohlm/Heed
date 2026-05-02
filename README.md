# Heed

**The agent that remembers what you forget.**

Heed is a personal agentic assistant for forgetful adults. It learns your task cadences from behavior, surfaces the right things at the right time, and plans around your life — trips, illness, busy weeks — without nagging you about patterns you already know are broken.

Built for the Microsoft CWB Hackathon 2026.

---

## What it does

- **Cadence learning** — tracks when you complete recurring tasks and learns your natural rhythm over time (not just a fixed interval)
- **Context awareness** — tell it about a trip or a sick week; it stops counting misses during that window
- **Ask Heed** — chat interface backed by GPT-4o + Azure AI Search; answers questions like "what am I forgetting?" and "why did I skip my morning routine?"
- **Today view** — surfaced by importance and overdue days; the most critical thing is always first
- **Calendar** — week view showing how the agent has scheduled your tasks around cadence, importance, and context windows

---

## Architecture

```
Browser (Next.js 14, Azure Static Web Apps)
    │
    ├── GET /api/tasks, /api/context     ──► Azure Functions (func-heed)
    ├── POST /api/completions            ──►   │
    └── POST /api/advisor_stream         ──►   │
                                               │
                                    ┌──────────┼──────────┐
                                    ▼          ▼          ▼
                                Cosmos DB  Azure AI    Azure OpenAI
                                           Search      (gpt-4o, gpt-4o-mini,
                                                        text-embed-3-small)
```

| Component | Azure service |
|---|---|
| Frontend | Azure Static Web Apps (Free tier) |
| Backend API | Azure Functions (Consumption, Python 3.11) |
| Database | Azure Cosmos DB for NoSQL |
| Vector search | Azure AI Search (`gratitudechain-search`) |
| LLM | Azure OpenAI via AI Foundry (`openai-heed`) — gpt-5.4, gpt-5.4-mini, text-embed-3-small |
| Secrets | Azure Key Vault (`kv-heed-hack`) |

---

## Local development

### Prerequisites

- Python 3.11, Node.js 20+
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- Azure CLI (`az login`)

### 1. Secrets

```bash
cp data/.env.example data/.env
# fill in COSMOS_CONNECTION_STRING, AZURE_SEARCH_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY

cp functions/local.settings.json.example functions/local.settings.json
# fill in the same values
```

### 2. Seed data

```bash
pip install -r requirements.txt
cd data && python load_seed.py
```

### 3. Functions backend

```bash
cd functions && func start
# http://localhost:7071
```

### 4. Frontend

```bash
cd web
cp .env.local.example .env.local   # already has NEXT_PUBLIC_FUNCTIONS_URL=http://localhost:7071
npm install && npm run dev
# http://localhost:3000
```

---

## Deployment

### Functions

```powershell
cd functions
.\deploy_functions.ps1
```

Copies `agents/` into `functions/` for bundling, publishes to `func-heed`, cleans up.

### Frontend — Azure Static Web Apps

The GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) auto-deploys on every push to `main`.

**One-time setup:**

```bash
# Get the SWA deployment token
az staticwebapp secrets list --name <swa-name> --resource-group heed --query "properties.apiKey" -o tsv
```

Add the token to GitHub: **Settings → Secrets → Actions → `AZURE_STATIC_WEB_APPS_API_TOKEN`**

Then push to `main`. The workflow bakes in `NEXT_PUBLIC_FUNCTIONS_URL=https://func-heed.azurewebsites.net` at build time.

---

## Repository structure

```
Heed/
├── agents/
│   ├── advisor.py           # Advisor agent — streaming chat + today view
│   ├── memory_keeper.py     # Cadence learning (runs every 6h via timer)
│   ├── models.py            # Pydantic models
│   └── tools/               # cosmos_tool, search_tool, action_tools
├── data/
│   ├── load_seed.py         # Seed loader (Cosmos + AI Search + embeddings)
│   └── seed-data/
├── docs/
│   ├── SAFETY.md            # Risk model + 12-scenario manual eval
│   └── MULTI_MODEL_COMPARISON.md
├── functions/
│   ├── function_app.py      # 8 HTTP endpoints + memory_keeper_timer
│   └── deploy_functions.ps1
└── web/
    ├── app/page.jsx         # Full frontend — 5 tabs, Maya owl, 4 modals
    └── next.config.mjs      # Static export
```

---

## Key design decisions

**Hand-rolled agent loop instead of a framework.**
The Advisor needed to be an async generator (streaming SSE events mid-tool-call). Stable frameworks at the time of build were synchronous. The loop is ~80 lines and fully transparent.

**Functions collects all SSE events before returning.**
Azure Functions Consumption plan does not support chunked streaming. The backend collects events into NDJSON; the frontend replays them with word-by-word delays to preserve the streaming feel.

**Reuses `gratitudechain-search`.**
Free tier allows one AI Search service per subscription. The existing service was repurposed with two new indexes (`task_memory`, `ph_calendar`).

---

## Evaluation

| | Result |
|---|---|
| Safety (12 adversarial scenarios) | 9 passed, 3 partial — see `docs/SAFETY.md` |
| Model comparison | gpt-5.4 for Advisor, gpt-5.4-mini for Memory Keeper — see `docs/MULTI_MODEL_COMPARISON.md` |

---

## Known limitations (hackathon scope)

- Single-user: `USER_ID = "usr_heed_demo_001"` hardcoded throughout; no auth
- Routines are frontend-only in v0 — no Cosmos backing
- Bing grounding scaffolded but disabled (Bing Search v7 API deprecated during build)
- CORS open (`*`) on all Functions endpoints — production would use API Management
