# Heed — Technical Reference

> **DEPRECATED — moved to a single consolidated tech doc.**
>
> All technical documentation is now maintained in **[`docs/Heed_Azure_Setup.docx`](Heed_Azure_Setup.docx)** (Word format).
>
> That file is the single source of truth and now covers:
> - Azure infrastructure provisioning, secrets, and resource inventory
> - Phase B seed data
> - Known gaps and next steps
> - **§9 Security: LLM scope and prompt-injection defense** (new)
>
> When you need to update the docs, edit `generate_azure_doc.py` at the repo root and re-run:
>
> ```powershell
> python generate_azure_doc.py
> ```
>
> The content below is kept for historical reference only and may be out of date. Do not edit it — make changes in the generator script instead.

---

# (Historical) Heed — Technical Reference

This is the living technical document for the Heed codebase. It reflects the actual current state, not the original planned architecture. Update it whenever a significant feature ships.

Last updated: 2026-05-04

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Repository layout](#2-repository-layout)
3. [Frontend — `web/app/page.jsx`](#3-frontend--webapppagejsx)
4. [Themes system](#4-themes-system)
5. [State management patterns](#5-state-management-patterns)
6. [Custom hooks](#6-custom-hooks)
7. [Component inventory](#7-component-inventory)
8. [Feature inventory](#8-feature-inventory)
9. [localStorage keys](#9-localstorage-keys)
10. [Backend — Azure Functions](#10-backend--azure-functions)
11. [Data model (Cosmos DB)](#11-data-model-cosmos-db)
12. [AI Search indexes](#12-ai-search-indexes)
13. [Agent layer](#13-agent-layer)
14. [Build & deploy](#14-build--deploy)
15. [Local development](#15-local-development)
16. [Conventions & patterns](#16-conventions--patterns)

---

## 1. Architecture

```
Browser (Next.js 14, Azure Static Web Apps)
    │
    ├── GET/POST /api/tasks              ──► Azure Functions (func-heed)
    ├── PATCH/DELETE /api/tasks/{id}     ──►   Python 3.11, v2 programming model
    ├── POST /api/completions            ──►   │
    ├── GET/POST /api/context            ──►   │
    ├── GET /api/today                   ──►   │
    └── POST /api/advisor_stream         ──►   │
                                               │
                                    ┌──────────┼──────────┐
                                    ▼          ▼          ▼
                                Cosmos DB  Azure AI    Azure OpenAI
                                (NoSQL)    Search      (gpt-5.4, gpt-5.4-mini,
                                                        text-embed-3-small)
```

| Component | Azure service |
|---|---|
| Frontend | Azure Static Web Apps (Free tier) — serves `web/out/` |
| Backend | Azure Functions (Consumption plan, Python 3.11) |
| Database | Azure Cosmos DB for NoSQL |
| Vector search | Azure AI Search (`gratitudechain-search`) |
| LLM | Azure OpenAI via AI Foundry (`openai-heed`) |
| Secrets | Azure Key Vault (`kv-heed-hack`) via Managed Identity |

**Key architectural constraint:** Azure Functions Consumption plan does not support chunked HTTP streaming. The advisor agent collects all SSE events into NDJSON and returns the full response at once. The Next.js route `/api/agent/stream` replays events to the browser with word-level delays to simulate streaming.

---

## 2. Repository layout

```
Heed/
├── README.md                    Project overview, local dev, deployment
├── docs/
│   ├── TECHNICAL.md             ← this file
│   ├── 01_BUSINESS_PLAN.md
│   ├── 02_MARKET_RESEARCH.md
│   ├── 03_DATA_SPEC.md          Cosmos schema + AI Search indexes (detailed)
│   ├── 04_REPO_STRUCTURE.md     Early planned layout (partially superseded)
│   ├── SAFETY.md                Risk model + adversarial eval
│   ├── MULTI_MODEL_COMPARISON.md
│   └── superpowers/
│       ├── specs/               Design specs (brainstorm outputs, one per feature)
│       └── plans/               Implementation plans (subagent execution inputs)
│
├── web/                         ─── NEXT.JS FRONTEND ───
│   ├── app/
│   │   ├── page.jsx             ← ALL frontend code lives here (~5960 lines)
│   │   ├── layout.jsx           Root layout, Google Fonts
│   │   ├── globals.css          Reset + keyframe animations
│   │   └── themes.js            Theme palettes + owl colour maps
│   ├── next.config.mjs          Static export config (output: 'export')
│   ├── package.json
│   └── out/                     Pre-built static export (committed for SWA)
│
├── functions/
│   ├── function_app.py          ALL backend endpoints (Python v2 model)
│   ├── host.json
│   ├── requirements.txt
│   ├── deploy_functions.ps1     Copies agents/ in, publishes, cleans up
│   └── local.settings.json.example
│
├── agents/
│   ├── advisor.py               Streaming advisor agent (async generator)
│   ├── memory_keeper.py         Cadence learning (timer-triggered, every 6h)
│   ├── models.py                Pydantic models
│   ├── tools/
│   │   ├── cosmos_tool.py       Read tasks, completions, context from Cosmos
│   │   ├── action_tools.py      Mark done, skip, defer, add task
│   │   └── search_tool.py       Azure AI Search queries
│   └── prompts/
│       ├── advisor_system.md    Advisor system prompt (loaded at runtime)
│       └── memory_keeper_system.md
│
├── data/
│   ├── load_seed.py             Seeds Cosmos + AI Search (run once)
│   └── seed-data/               JSON seed files for demo user
│
├── infra/
│   └── bicep/                   IaC for all Azure resources
│
└── .github/
    └── workflows/
        └── azure-static-web-apps.yml   CI/CD: push to main → SWA deploy
```

---

## 3. Frontend — `web/app/page.jsx`

The entire frontend is one `'use client'` file (~5960 lines). No TypeScript, no external component library, all styles inline. This was a deliberate choice for hackathon speed.

### File structure (top to bottom)

| Lines | Content |
|---|---|
| 1–30 | Imports, `FUNCTIONS_URL`, `APP_TABS`, color proxy `C` |
| 31–78 | `CATEGORY` map, `QUICK_CONTEXT_CONFIG`, `ROUTINES` seed data |
| 79–288 | `TASKS_DEMO` (demo task seed), utility functions |
| 289–397 | `suggestCadence`, `formatRelativeDays`, `formatCadence`, `computeTaskDisplay`, date helpers |
| 398–526 | `useChat` hook (AI chat state machine) |
| 527–566 | `useMic` hook (Web Speech API) |
| 567–869 | `ThemeSwitcher`, `AvatarButton`, `SettingsRow`, `SettingsSheet` |
| 870–1054 | `MobileBottomNav` |
| 1055–1513 | `MayaOwl` SVG, `OwlSignature`, primitive UI components |
| 1514–1624 | `useSwipe` hook |
| 1625–1777 | `HeroCard`, `TaskCard` |
| 1778–2159 | `useShareCard`, `ShareableCard` variants, `RoutineRow`, `RoutineCard` |
| 2160–2365 | `ContextBanner`, `TodayTab` |
| 2366–2448 | `CollapsibleTodaySection`, `SuggestionChip`, `ThinkingBubble`, `MicButton` |
| 2449–2524 | `AskTab` |
| 2525–2618 | `TracksTab`, `ContextRow`, `SegmentButton` |
| 2619–3026 | `usePlans`, `PlanCard`, `PlanDetailScreen` |
| 3027–3251 | `AddPlanSheet`, `PlansPanel`, `LifeEventsPanel`, `LifeTab` |
| 3252–3902 | Calendar utilities, `MonthStrip`, `WeekDetail`, `TaskDetailSheet`, `CalendarTab` |
| 3993–4040 | `SpeedDialItem`, `HeedFAB` |
| 4041–4114 | `AskInlineModal` |
| 4115–4346 | `AddTaskModal` |
| 4347–4426 | `AddContextModal` |
| 4427–4576 | `AddRoutineModal` (includes task picker) |
| 4577–4638 | `Toast` |
| 4639–4972 | `RetrospectiveSheet`, `TaskOptionsSheet`, `AddToRoutineSheet` |
| 5012–5274 | `QuickContextSheet`, `ActiveContextCard`, `RecoverySummarySheet`, sheet primitives, `ShareCardSheet`, `ContextDetailSheet` |
| 5275–5960 | `HeedApp` (root component — all state, all handlers) |

### Design token proxy (`C`)

All color tokens are accessed via the `C` proxy object. Each property read goes through a getter that reads `THEMES[themeState.current][key]`. This makes every render automatically use the active theme without any context or re-renders.

```js
// Usage — read live theme color anywhere in JSX
color: C.ochre
background: C.paper
border: `1px solid ${C.hairline}`
```

Never hardcode hex values — always use `C.*` tokens. See `web/app/themes.js` for all token names.

### Category map

```js
const CATEGORY = {
  relationships, finance, admin, home, health, work, self_care
}
// Each entry: { color, bg, icon }
```

Custom categories (added via Settings) are stored in localStorage and merged at runtime.

---

## 4. Themes system

**File:** `web/app/themes.js`

Three built-in themes: `warm` (default), `forest`, `ink`.

Each theme exports:
- Color palette tokens (20+ keys)
- `OWL_THEMES` — colour maps for `MayaOwl` SVG fills per theme

Active theme is stored in `localStorage('heed_theme')` and in a module-level `themeState` object. The `C` proxy reads `themeState.current` on every render, so theme switches are immediate without React context.

```js
// themes.js exports
export const THEMES = { warm: {...}, forest: {...}, ink: {...} }
export const OWL_THEMES = { warm: {...}, forest: {...}, ink: {...} }
export let themeState = { current: 'warm' }
export function setThemeState(name) { themeState.current = name }
export const DEFAULT_THEME = 'warm'
```

---

## 5. State management patterns

All app-level state lives in `HeedApp` (the root component, ~lines 5275–5960). It is passed down as props — no context, no external state manager.

### Task state

```js
const [apiTasks, setApiTasks] = useState([])
// Fetched from GET /api/tasks on mount; falls back to TASKS_DEMO if API unavailable
const displayTasks = apiTasks.length > 0 ? apiTasks : TASKS_DEMO
```

Mutations (`handleMarkDone`, `handleSkip`, `handleAddTask`, etc.) POST to the backend and then update `apiTasks` optimistically or via re-fetch.

### Plans state (localStorage, frontend-only)

```js
// Inside LifeTab — lifted for badge count
const plansHook = usePlans(DEMO_PLANS)
// Destructured: { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan, updatePlan }
```

All plan mutations use `setPlans(prev => prev.map(...))` — immutable updates, no direct mutation. Persisted to `localStorage('heed_plans')` via `useEffect`.

### Context state

```js
const [upcoming, setUpcoming] = useState([])     // all context windows
const [active, setActive] = useState([])          // currently active windows
const [activeContext, setActiveContext] = useState(null)  // most relevant single context
```

Fetched from `GET /api/context` on mount.

### UI state

Most UI state (modal open/close, selected items, edit drafts) is local to the component that owns the modal/sheet. `HeedApp` only holds state that multiple subtrees need.

---

## 6. Custom hooks

### `useChat({ onLightenRoutine })`

AI chat session. Manages messages, input, thinking steps, streaming, and action execution.

- `messages` — `[{ role, content, actions?, chips? }]`
- `send(text)` — appends user message, calls `/api/agent/stream` (via Next.js proxy), streams response, parses `[ACTION]` tokens
- `executeAction(msgIdx, actionIdx)` — fires confirmed actions back to the agent
- Chat history persisted to `localStorage('heed_chat')`

### `useMic(onTranscript, onEnd)`

Web Speech API wrapper.

- `toggle()` — starts or stops recognition
- `onTranscript(text, isFinal)` called for each result; `isFinal` is true on final recognition
- **Current behavior:** the caller in `AskTab` and `AskInlineModal` calls `send(text)` on `isFinal === true` — auto-sends without typing in the input box

### `usePlans(initialPlans)`

localStorage-backed plan state.

```js
const { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan, updatePlan } = usePlans(DEMO_PLANS)
```

- Lazy initializer reads `localStorage('heed_plans')` on first render
- `useEffect` writes to localStorage whenever `plans` changes
- `updatePlan(planId, updates)` strips `tasks` from updates to prevent accidental overwrite

### `useSwipe(onRight, onLeft, threshold)`

Pointer event swipe detector for task cards. Returns `{ handlers }` to spread onto a container element.

### `useShareCard()`

`html2canvas` + Web Share API. Returns `{ capture(el), share(blob), shareCard(routine, variant, theme) }`.

---

## 7. Component inventory

### Primitives

| Component | Purpose |
|---|---|
| `MayaOwl` | SVG owl avatar — moods: `calm`, `thinking`; `speaking` prop for animation |
| `OwlSignature` | Small inline owl for share cards |
| `Pill` | Colored badge pill |
| `ImportanceBadge` | low/medium/high badge |
| `CategoryBadge` | Category icon + label |
| `BotanicalDivider` | Leaf/flower section divider SVG |
| `SectionHeader` | Section title with count and motif |
| `Bubble` | Chat message bubble (user + assistant, supports streaming, actions, chips) |
| `ThinkingBubble` | Animated thinking steps indicator |
| `SuggestionChip` | Tappable suggestion pill in Ask Heed |
| `MicButton` | Microphone toggle button |
| `SegmentButton` | Tab segment control |
| `Toast` | Slide-up notification — supports undo, view, reason chips |

### Layout & Navigation

| Component | Purpose |
|---|---|
| `MobileBottomNav` | Fixed bottom nav bar with 5 tabs + mic shortcut |
| `HeedFAB` | Speed-dial FAB for Add Task / Ask Heed / Add Routine |
| `SpeedDialItem` | Individual FAB action item |
| `SettingsRow` | 44pt settings row with tap handler |
| `ThemeSwitcher` | Theme toggle (warm/forest/ink) |
| `AvatarButton` | User avatar circle |

### Task components

| Component | Purpose |
|---|---|
| `HeroCard` | First/priority task card (larger, swipeable) |
| `TaskCard` | Standard task card with swipe-to-done/skip |
| `CollapsibleTodaySection` | Collapsible section wrapper for Today tab |
| `TaskOptionsSheet` | Bottom sheet: view task details, edit, delete, build routine, skip w/ reason |
| `AddToRoutineSheet` | Pick a routine to add a task to |
| `AddTaskModal` | Create/edit task form (name, category, importance, cadence, due date) |
| `TaskDetailSheet` | Calendar tap → task detail view |

### Routine components

| Component | Purpose |
|---|---|
| `RoutineRow` | Compact routine row for Today tab |
| `RoutineCard` | Full routine card with streak, progress, share, lighten |
| `AddRoutineModal` | Create/edit routine (name, items, date range, task picker) |
| `ShareableCard` | Routine share card in 3 variants: streak, progress, routine |
| `ShareCardSheet` | Bottom sheet to pick share variant and export |

### Plan components

| Component | Purpose |
|---|---|
| `PlanCard` | Plan card (project/event/goal) in the Plans grid |
| `PlanDetailScreen` | Full-screen checklist for a plan's tasks |
| `AddPlanSheet` | Create a new plan (type, icon, title, date) |
| `PlansPanel` | Plans tab — card grid or detail screen |

### Calendar components

| Component | Purpose |
|---|---|
| `MonthStrip` | Month calendar with week selector |
| `WeekDetail` | Day-by-day week view with task slots |
| `RetrospectiveSheet` | Monthly retrospective — patterns + suggestions |
| `CalendarTab` | Calendar tab root |

### Context components

| Component | Purpose |
|---|---|
| `ContextBanner` | Upcoming context alert banner |
| `ContextRow` | Single context window row |
| `ActiveContextCard` | Currently active context (I'm better / extend) |
| `QuickContextSheet` | One-tap context activation (sick/busy/travel/celebration) |
| `AddContextModal` | Custom context window creation |
| `RecoverySummarySheet` | After context ends — resume all or ease back |
| `ContextDetailSheet` | Full detail for a context window |

### Modals / Sheets

| Component | Purpose |
|---|---|
| `AskInlineModal` | Floating bottom-sheet Ask Heed chat (used from FAB, owl) |
| `SettingsSheet` | Full settings sheet (profile, theme, categories, event types, about) |

### Tabs (root screens)

| Component | Purpose |
|---|---|
| `TodayTab` | Main today view — routines, tasks, context banner |
| `AskTab` | Full-screen Ask Heed chat |
| `TracksTab` | Routines + tasks segmented view |
| `LifeTab` | Plans + life events segmented view |
| `CalendarTab` | Calendar + retrospective |

### Root

| Component | Purpose |
|---|---|
| `HeedApp` | Root: all state, all handlers, tab routing, modals |

---

## 8. Feature inventory

### Today Tab
- Hero card (first overdue/due task) with swipe-to-done / swipe-to-skip
- Task cards with swipe gestures + swipe direction labels
- One-time swipe hint on first task card
- Skip with reason chips (still fine / not applicable / forgot / too busy / other)
- Task options sheet — view details, edit, delete, build/add-to routine
- Skipped tasks footer with ↻ unskip buttons
- Mark past days done (from calendar week view)
- Collapsible sections (overdue, upcoming, later)
- Routine rows with Lighten This Week and Skip Today

### Ask Heed (AI Chat)
- GPT-powered chat via Azure Functions advisor agent
- Suggestion chips on empty state
- Streaming response (word-by-word replay)
- Thinking steps indicator
- Action chips — confirm destructive actions before execution
- Add-task action: advisor proposes → user confirms → backend creates → frontend refreshes
- Mic button → auto-sends transcript on final recognition (no text shown in input)
- Long-press owl button → mic → auto-send to Ask Heed screen
- Chat history persisted in localStorage across sessions
- Inline modal variant (AskInlineModal) accessible from FAB and owl

### Tracks Tab (Routines)
- Routine cards with streak, progress bar, 14-day completion heatmap
- Lighten This Week (skips selected items for the week)
- Skip routine today
- Mark a past day done
- Edit routine (name, items, schedule, date range)
- Build a routine from a task (seeds first item)
- Add existing tasks to routine — 📎 per-row picker with inline search dropdown
- Shareable cards — html2canvas export in 3 variants (streak / progress / routine)

### Plans (Life Tab)
- Plan cards for project, event, and goal types
- Tap project/event card → detail screen
- Interactive task checklist: check/uncheck, inline rename, swipe-to-delete, drag-to-reorder
- Plan detail editing — icon, title, date via ✎ toggle panel
- Add new plan (type, icon, title, date)
- localStorage persistence via `usePlans` hook

### Calendar Tab
- Month strip with week selector
- Week detail: task slots by day, add task, add context
- Monthly retrospective — Phase 1 (patterns) and Phase 2 (adjust cadence buttons)
- Apply retrospective suggestions to task cadences
- Reschedule tasks from calendar

### Context / Life Events
- Quick context activation (sick, busy, travel, celebration) with duration selector
- Custom context window (type, description, date range)
- Active context card with I'm better / extend
- Recovery summary after context ends (resume all or ease back)
- Context detail sheet with held task list

### Settings
- Display name
- Theme switcher (warm / forest / ink)
- Custom task categories (added to CATEGORY map)
- Custom event types
- About section

### Global
- Toast notification system (slide-up, auto-dismiss, supports undo/view/reason chips)
- Botanical decorative dividers (leaf/flower motifs)
- Bottom nav (5 tabs + mic shortcut on Today tab)
- Speed-dial FAB (Add Task / Ask Heed / Add Routine)
- Responsive layout with hamburger drawer on mobile
- Three-theme system with instant switching

---

## 9. localStorage keys

| Key | Type | Owned by | Purpose |
|---|---|---|---|
| `heed_theme` | string | `HeedApp` | Active theme name (`warm`/`forest`/`ink`) |
| `heed_plans` | JSON array | `usePlans` | All plan data including tasks |
| `heed_chat` | JSON array | `useChat` | Chat message history |
| `heed_custom_categories` | JSON array | `HeedApp` | User-added task categories |
| `heed_custom_event_types` | JSON array | `HeedApp` | User-added event types |
| `heed_skipped_tasks` | JSON array | `HeedApp` | Task IDs skipped in current session |
| `heed_swipe_hint_shown` | boolean | `TaskCard` | Whether the swipe hint has been shown |

---

## 10. Backend — Azure Functions

**File:** `functions/function_app.py`
**Runtime:** Python 3.11, Azure Functions v2 programming model
**Auth:** `AuthLevel.ANONYMOUS` on all routes (single-user build)

### Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/advisor_stream` | Advisor agent — returns NDJSON of SSE events |
| `GET` | `/api/tasks` | List active tasks for the demo user |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/{task_id}` | Update task fields |
| `DELETE` | `/api/tasks/{task_id}` | Archive a task |
| `POST` | `/api/completions` | Mark done / skip (with reason) / defer |
| `GET` | `/api/context` | List context windows |
| `POST` | `/api/context` | Create a context window |
| `GET` | `/api/today` | Aggregated today view (tasks + routines + context) |
| `POST` | `/api/memory_keeper_run` | Manual trigger for memory keeper |

All responses include `Access-Control-Allow-Origin: *`. All OPTIONS preflight requests return 204.

### Timer

`memory_keeper_timer` — runs every 6 hours via Azure Functions timer trigger. Calls `run_for_user(USER_ID)` which re-infers cadences for all tasks that have enough completion history.

### Environment variables (via Key Vault in prod, `local.settings.json` in dev)

| Variable | Used by |
|---|---|
| `COSMOS_CONNECTION_STRING` | Cosmos DB CRUD |
| `AZURE_OPENAI_ENDPOINT` | Advisor + Memory Keeper |
| `AZURE_OPENAI_KEY` | Advisor + Memory Keeper |
| `AZURE_SEARCH_ENDPOINT` | Search tool |
| `AZURE_SEARCH_KEY` | Search tool |

---

## 11. Data model (Cosmos DB)

Database name: `heed`. Four containers, all partitioned on `/user_id` (except `users` which partitions on `/id`).

### `tasks`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `task_<uuid>` |
| `user_id` | string | Partition key |
| `name` | string | Short label |
| `description` | string? | Optional context |
| `category` | string | `home\|health\|admin\|relationships\|self_care\|work\|finance` |
| `importance` | string | `low\|medium\|high` |
| `status` | string | `active\|paused\|archived` |
| `explicit_cadence_days` | number? | User-set interval |
| `learned_cadence_days` | number? | Agent-inferred (requires 5 completions + 3 weeks) |
| `learned_confidence` | number? | 0.0–1.0 |
| `next_due_at` | ISO 8601? | `last_done_at + effective_cadence` |
| `last_done_at` | ISO 8601? | Most recent completion |
| `created_at` | ISO 8601 | |
| `dueDate` | string? | Optional one-off date (e.g. "Jun 15") |
| `dueTime` | string? | Optional one-off time |

### `completions`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `comp_<uuid>` |
| `task_id` | string | References `tasks.id` |
| `event_type` | string | `done\|skipped\|deferred` |
| `completed_at` | ISO 8601 | |
| `skip_reason` | string? | `still_fine\|not_applicable\|forgot\|too_busy\|other` |
| `note` | string? | Free text |

### `user_context`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ctx_<uuid>` |
| `context_type` | string | `travel\|illness\|busy\|celebration\|other` |
| `start_date` | ISO 8601 date | |
| `end_date` | ISO 8601 date | Inclusive |
| `description` | string | Read by the agent |

### `users`

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same as `user_id` everywhere |
| `display_name` | string | |
| `timezone` | string | IANA, default `Asia/Manila` |
| `language_preference` | string | `english\|taglish` |

---

## 12. AI Search indexes

### `task_memory`

Semantic + vector search over tasks. Fields: `id`, `user_id`, `name`, `description`, `category`, `recent_notes` (last 5 completion notes concatenated), `last_done_at`, `next_due_at`, `importance`, `status`, `content_vector` (text-embed-3-small embedding of name + description + notes).

Indexer pulls from Cosmos change feed every 5 minutes.

### `ph_calendar`

Static corpus of Philippine holidays and cultural events. Grounds the agent in local time/culture context. Seeded once, no indexer.

---

## 13. Agent layer

### Advisor (`agents/advisor.py`)

Async generator that streams SSE events. Tools available: `get_tasks`, `get_context`, `search_tasks`, `mark_done`, `skip_task`, `add_task`, `get_today_view`. Uses GPT-5.4 (or gpt-4o — whichever is configured in `openai-heed`). System prompt loaded from `agents/prompts/advisor_system.md`.

The advisor parses `[ACTION: ...]` tokens in its output — the frontend renders these as confirm buttons and fires them back as a second-turn user message when approved.

### Memory Keeper (`agents/memory_keeper.py`)

Runs every 6 hours. For each active task with sufficient history (≥5 completions, ≥3 weeks), re-computes `learned_cadence_days` and `learned_confidence` and updates the Cosmos document. Uses GPT-5.4-mini. System prompt loaded from `agents/prompts/memory_keeper_system.md`.

---

## 14. Build & deploy

### Frontend

The GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) triggers on push to `main`. It deploys the pre-built `web/out/` directory directly (no build step on CI — `skip_app_build: true`).

To rebuild `web/out` locally:
```bash
cd web && npm run build
# output goes to web/out/
```

Then commit `web/out/` along with the source change and push. The workflow picks up the new `out/` and deploys it.

**Why pre-built?** The SWA deployment token is baked into the workflow secret; the CI worker has no access to `NEXT_PUBLIC_FUNCTIONS_URL`, so the static export must be generated locally where `.env.local` is set.

### Backend (Functions)

```powershell
cd functions
.\deploy_functions.ps1
```

This script copies `agents/` into `functions/` (for bundling), runs `func azure functionapp publish func-heed`, then removes the copy.

---

## 15. Local development

### Prerequisites
- Node.js 20+, Python 3.11, Azure Functions Core Tools v4

### Frontend only (recommended for UI work)

```bash
cd web
npm install
npm run dev
# http://localhost:3000
# Falls back to TASKS_DEMO and DEMO_PLANS when backend unavailable
```

When `NEXT_PUBLIC_FUNCTIONS_URL` is not set, it defaults to `http://localhost:7071`. If the Functions process isn't running, the app falls back gracefully to demo seed data for tasks, plans, and routines.

### Full stack

```bash
# 1. Backend
cp functions/local.settings.json.example functions/local.settings.json
# Fill in Cosmos, OpenAI, Search keys
cd functions && func start

# 2. Frontend (separate terminal)
cd web
cp .env.local.example .env.local   # already has NEXT_PUBLIC_FUNCTIONS_URL=http://localhost:7071
npm run dev
```

---

## 16. Conventions & patterns

### No TypeScript, no external component libs

All components are plain JavaScript functions. All styles are inline objects. No Tailwind, no shadcn, no Material UI. The style guide is the existing file — follow what's there.

### Color tokens — always use `C.*`

```js
// ✅ correct
style={{ color: C.ochre, background: C.paper }}

// ❌ wrong
style={{ color: '#D4A24C', background: '#FDFAF4' }}
```

### Button defaults

All non-submit buttons inside forms must have `type="button"` to prevent accidental form submission.

Interactive elements that are not naturally buttons (e.g. clickable divs) should be converted to `<button>` for keyboard accessibility. Apply `background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit'` to reset button defaults.

When a button style has both `border: 'none'` and `borderBottom: ...`, put `border: 'none'` first — or replace it with explicit `borderTop/Left/Right: 'none'` — because `border` shorthand overrides longhand properties that follow it.

### State mutations — immutable only

```js
// ✅ correct
setItems(prev => prev.map((it, i) => i === idx ? { ...it, name } : it))

// ❌ wrong
items[idx].name = name
setItems(items)
```

### Animations

All keyframes live in the `<style>` block at the bottom of `HeedApp`'s JSX. Naming convention: `heed-<name>`. Available keyframes:

| Name | Effect |
|---|---|
| `heed-fadeIn` | opacity 0→1 |
| `heed-fadeUp` | opacity 0→1 + translateY 8px→0 |
| `heed-dropdown` | opacity 0→1 + translateY -6px→0 (dropdowns) |
| `heed-slideUp` | opacity 0→1 + translateY 40px→0 (bottom sheets) |
| `heed-slideRight` | opacity 0→1 + translateX 20px→0 |
| `heed-slideIn` | translateX 100%→0 (full drawer slide) |
| `heed-tab-in` | opacity 0→1 + translateX 12px→0 (tab changes) |
| `heed-toast-up` | opacity 0→1 + translateY 20px→0 |
| `heed-breathe` | scale + opacity pulse (owl glow) |
| `heed-bob` | translateY bounce (FAB hover) |
| `heed-pulse` | scale + opacity (indicator dot) |
| `heed-blink` | opacity blink |
| `heed-mic-pulse` | box-shadow pulse (mic recording indicator) |

### Helpers placed before conditional returns

In function components with early-return guards (`if (!open) return null`), all derived values, helper functions, and constants must be declared before the guard — not between the guard and the JSX `return`. This follows React's linting rules.

### Helper function `filteredTasks()` pattern

When a helper is called multiple times in JSX (e.g. once for a list and once for an empty-state check), compute it once:

```js
items.map((item, idx) => {
  const ft = openPickerIndex === idx ? filteredTasks() : []
  return (
    <div key={item.id}>
      ...
      {ft.map(task => ...)}
      {ft.length === 0 && ...}
    </div>
  )
})
```

### Picker state reset on modal open

Any pickers or inline sub-UI within a modal must be reset when the modal opens. Add resets to the `useEffect([open])` that already handles other form state.

### Skip-reason enum values

The frontend chip values must match the backend `SkipReason` enum exactly:
`still_fine`, `not_applicable`, `forgot`, `too_busy`, `other`

### Commits

No `Co-Authored-By` trailers. Short imperative subject line. Use `feat:`, `fix:`, `docs:`, `build:`, `refactor:` prefixes.
