# Heed — Repo Structure

This document describes the layout of the Heed monorepo. The repo has three top-level workspaces — `web/` (Next.js frontend), `functions/` (Azure Functions Python backend), and `agents/` (shared Python module imported by the Functions). Seed data, documentation, and infrastructure configuration live at the root.

```
heed/
├── README.md                       Project overview, screenshots, demo link
├── SAFETY.md                       Risk and safety evaluation
├── ARCHITECTURE.md                 Long-form architecture writeup
├── architecture.svg                Diagram for README and submission
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml              GitHub Actions for SWA + Functions deploy
│
├── web/                            ─────── NEXT.JS FRONTEND ───────
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx              Root layout, fonts, theme
│   │   ├── page.tsx                Main app shell with tabs
│   │   ├── globals.css
│   │   ├── api/
│   │   │   ├── agent/
│   │   │   │   └── stream/
│   │   │   │       └── route.ts    SSE endpoint to Functions agent backend
│   │   │   ├── tasks/
│   │   │   │   └── route.ts        GET, POST tasks
│   │   │   ├── tasks/[id]/
│   │   │   │   └── route.ts        PATCH, DELETE single task
│   │   │   ├── completions/
│   │   │   │   └── route.ts        POST mark done / skip / snooze
│   │   │   ├── context/
│   │   │   │   └── route.ts        GET, POST user context windows
│   │   │   └── today/
│   │   │       └── route.ts        GET aggregated today view
│   │   └── (tabs)/                 Routes for sub-pages if split later
│   ├── components/
│   │   ├── owl/MayaOwl.tsx
│   │   ├── tabs/
│   │   │   ├── TodayTab.tsx
│   │   │   ├── CalendarTab.tsx
│   │   │   ├── AskTab.tsx
│   │   │   ├── TracksTab.tsx
│   │   │   └── ContextTab.tsx
│   │   ├── cards/
│   │   │   ├── HeroCard.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── RoutineCard.tsx
│   │   │   └── ContextBanner.tsx
│   │   ├── ui/                     shadcn/ui primitives
│   │   └── chat/
│   │       ├── Bubble.tsx
│   │       ├── ThinkingSteps.tsx
│   │       └── SuggestionChip.tsx
│   ├── lib/
│   │   ├── api.ts                  Typed fetchers for /api/* routes
│   │   ├── stream.ts               SSE consumer helper
│   │   ├── tokens.ts               Design tokens shared across components
│   │   └── types.ts                TypeScript types for Task, Routine, Context
│   └── public/
│       └── favicon.svg
│
├── functions/                      ─────── AZURE FUNCTIONS BACKEND ───────
│   ├── host.json                   Functions host config
│   ├── local.settings.json         (gitignored) local env values
│   ├── local.settings.json.example Template for local.settings.json
│   ├── requirements.txt            Python deps for Functions
│   ├── shared_code/__init__.py     Imports from /agents
│   ├── advisor_stream/             HTTP trigger, streams agent output
│   │   ├── __init__.py
│   │   └── function.json
│   ├── tasks_crud/                 HTTP trigger, CRUD on tasks
│   ├── completions_create/         HTTP trigger
│   ├── context_crud/               HTTP trigger
│   ├── today_view/                 HTTP trigger, aggregates today's data
│   └── memory_keeper_timer/        Timer trigger, every 6h
│
├── agents/                         ─────── SHARED AGENT CODE ───────
│   ├── __init__.py
│   ├── advisor.py                  Advisor agent (Microsoft Agent Framework)
│   ├── memory_keeper.py            Memory Keeper agent (cadence inference)
│   ├── tools/
│   │   ├── cosmos_tool.py          Read tasks, completions, context
│   │   ├── search_tool.py          Query AI Search indexes
│   │   ├── bing_tool.py            Bing grounding wrapper with sanitizer
│   │   └── action_tools.py         Mark done, skip, defer, plan
│   ├── prompts/
│   │   ├── advisor_system.md       Advisor system prompt
│   │   └── memory_keeper_system.md Memory keeper system prompt
│   └── models.py                   Pydantic models matching Cosmos schema
│
├── data/                           ─────── SEED + SCHEMA ───────
│   ├── 03_DATA_SPEC.md             Data spec (containers, schemas, indexes)
│   ├── generate_seed_data.py       Seed generator
│   ├── load_seed.py                Cosmos + AI Search loader (Day 1)
│   └── seed-data/
│       ├── users.json
│       ├── tasks.json
│       ├── completions.json
│       ├── user_context.json
│       └── ph_calendar.json
│
├── docs/                           ─────── SUBMISSION ARTIFACTS ───────
│   ├── 01_BUSINESS_PLAN.md
│   ├── 02_MARKET_RESEARCH.md
│   ├── DEMO_SCRIPT.md
│   ├── MULTI_MODEL_COMPARISON.md
│   └── screenshots/                Captures for README
│
└── infra/                          ─────── AZURE DEPLOY CONFIG ───────
    ├── bicep/
    │   ├── main.bicep              Resource group + all services
    │   └── modules/
    │       ├── cosmos.bicep
    │       ├── search.bicep
    │       ├── functions.bicep
    │       ├── swa.bicep
    │       └── keyvault.bicep
    └── deploy.md                   Manual portal steps
```

## Layout decisions

**Three workspaces.** The frontend, the Functions, and the shared agent code each have different package managers and runtimes. Three sibling folders keep boundaries visible.

**Agents in a shared module.** Both HTTP-triggered Functions (user requests) and the timer-triggered Function (background loop) call the same agents. Keeping `agents/` separate prevents code duplication; Functions import from it.

**Routes mirror data shape.** `/api/tasks`, `/api/completions`, `/api/context` map directly to Cosmos containers. Flat routing is easier to debug.

**SAFETY.md at the root.** It is the rubric differentiator. It belongs where the README links to it on the GitHub landing page, not buried inside `/docs`.

## Notable files

**`local.settings.json.example`** — template for the env vars Functions needs. Without this, onboarding the project to a new machine requires recreating the env from memory.

**`agents/prompts/*.md`** — agent system prompts as markdown files, not inline string literals. Easier to iterate, easier to diff in git, easier to edit precisely. The agent loads them at startup with a 3-line read-file helper.

## .gitignore

```
node_modules/
.next/
dist/
__pycache__/
*.pyc
.venv/
local.settings.json
.env
.env.local
.azure/
*.log
.DS_Store
```

## Files that never go in git

API keys. Connection strings. The contents of `local.settings.json`. Any code that hardcodes a secret should be moved to Key Vault and replaced with a reference. The hackathon rubric explicitly checks for this.
