# Heed — Technical Reference

Last updated: 2026-05-10

---

## Table of Contents

1. [Overview](#1-overview)
   - [Architecture](#11-architecture)
   - [Repository layout](#12-repository-layout)
2. [Frontend](#2-frontend)
   - [page.jsx file structure](#21-pagejsx-file-structure)
   - [Design tokens & themes](#22-design-tokens--themes)
   - [State management](#23-state-management)
   - [Custom hooks](#24-custom-hooks)
   - [Component inventory](#25-component-inventory)
   - [Feature inventory](#26-feature-inventory)
   - [localStorage keys](#27-localstorage-keys)
3. [Backend](#3-backend)
   - [Azure Functions endpoints](#31-azure-functions-endpoints)
   - [Data model (Cosmos DB)](#32-data-model-cosmos-db)
   - [AI Search indexes](#33-ai-search-indexes)
   - [Agent layer](#34-agent-layer)
4. [Development](#4-development)
   - [Local development](#41-local-development)
   - [Build & deploy](#42-build--deploy)
5. [Code Standards](#5-code-standards)

---

## 1. Overview

### 1.1 Architecture

```
Browser (Next.js 14, Azure Static Web Apps)
    │
    ├── /api/tasks, /api/advisor_stream, ...   ──► Azure Functions (func-heed)
    │                                               Python 3.11, v2 programming model
    │                                               │
    │                                    ┌──────────┼──────────┐
    │                                    ▼          ▼          ▼
    │                                Cosmos DB  Azure AI    Azure OpenAI
    │                                (NoSQL)    Search      (heed-advisor: gpt-5.4,
    │                                                        heed-keeper: gpt-5.4-mini,
    │                                                        heed-embed: text-embedding-3-small)
    │
    └── X-User-ID header on every request → backend reads username for data isolation
```

| Component | Azure service |
|---|---|
| Frontend | Azure Static Web Apps (Free tier) — serves `web/out/` |
| Backend | Azure Functions (Consumption plan, Python 3.11) |
| Database | Azure Cosmos DB for NoSQL |
| Vector search | Azure AI Search (`gratitudechain-search`) |
| LLM | Azure OpenAI via AI Foundry (`openai-heed`) |
| Secrets | Azure Key Vault (`kv-heed-hack`) via Managed Identity |

**Identity:** Each browser stores a username in `localStorage('heed.username')` after the `UsernameGate` prompt. Every fetch to the backend sends `X-User-ID: <username>` plus `X-Auth-Token: <hmac>` (token issued at registration, also stored in localStorage). The backend reads them via `_get_user_id(req)` and an HMAC verify in `agents/auth.py` to scope all Cosmos reads/writes. No sessions, no passwords.

**Streaming constraint:** Azure Functions Consumption plan does not support chunked HTTP streaming. The advisor agent collects all SSE events into NDJSON and returns the full response at once. The frontend replays events word-by-word to simulate streaming.

---

### 1.2 Repository layout

```
Heed/
├── README.md
├── docs/
│   ├── TECHNICAL.md             ← this file
│   ├── 01_BUSINESS_PLAN.md
│   ├── 02_MARKET_RESEARCH.md
│   ├── 03_DATA_SPEC.md          Cosmos schema + AI Search indexes (detailed)
│   ├── 04_REPO_STRUCTURE.md
│   ├── SAFETY.md                Risk model + adversarial eval
│   ├── MULTI_MODEL_COMPARISON.md
│   └── superpowers/
│       ├── specs/               Design specs (one per feature)
│       └── plans/               Implementation plans (subagent execution inputs)
│
├── web/                         ─── NEXT.JS FRONTEND ───
│   ├── app/
│   │   ├── page.jsx             ALL frontend code (~12,000 lines)
│   │   ├── layout.jsx           Root layout, Google Fonts
│   │   ├── globals.css          Reset + motion tokens (durations, easings, reduced-motion fallback)
│   │   └── themes.js            Theme palettes (5 user-selectable + auto periwinkle) + owl colour maps
│   ├── next.config.mjs          Static export config (output: 'export')
│   ├── package.json
│   └── out/                     Pre-built static export (committed for SWA deploy)
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
│   ├── auth.py                  HMAC token issue + verify (X-Auth-Token header)
│   ├── telemetry.py             App Insights span helpers for agent calls
│   ├── models.py                Pydantic models (AgentAction, AddRoutinePayload, …)
│   ├── tools/
│   │   ├── cosmos_tool.py       Read tasks, completions, context from Cosmos
│   │   ├── action_tools.py      Mark done, skip, defer, add task, add routine
│   │   ├── search_tool.py       Azure AI Search queries
│   │   ├── bing_tool.py         Web grounding (date-sensitive answers)
│   │   └── safety_tool.py       Risk-7 guardrail: confirms multi-task destructive ops
│   └── prompts/
│       ├── advisor_system.md    Advisor system prompt (loaded at runtime)
│       └── memory_keeper_system.md
│
├── data/
│   ├── load_seed.py             Seeds Cosmos + AI Search (run once)
│   └── seed-data/               JSON seed files
│
├── infra/
│   └── bicep/                   IaC for all Azure resources
│
└── .github/
    └── workflows/
        └── azure-static-web-apps.yml   CI/CD: push to main → SWA deploy
```

---

## 2. Frontend

The entire frontend is one `'use client'` file (`web/app/page.jsx`, ~12,000 lines). No TypeScript, no external component library, all styles inline.

### 2.1 page.jsx file structure

Line numbers below are approximate — the file shifts every release. Search by symbol name (`function PlanDetailScreen`, `function HeedApp`, etc.) for an exact location.

| Lines (approx.) | Content |
|---|---|
| 1–30 | Imports, `FUNCTIONS_URL`, `APP_TABS`, color proxy `C` |
| 31–78 | `CATEGORY` map, `QUICK_CONTEXT_CONFIG`, `ROUTINES` seed |
| 79–288 | `TASKS_DEMO`, `DEMO_PLANS`, utility functions |
| 289–397 | `suggestCadence`, `formatRelativeDays`, `computeTaskDisplay`, date helpers |
| 398–566 | `useChat`, `useMic` hooks |
| 567–869 | `ThemeSwitcher`, `AvatarButton`, `SettingsRow`, `SettingsSheet` |
| 870–1054 | `MobileBottomNav` |
| 1055–1513 | `MayaOwl` SVG, `OwlSignature`, primitive UI components |
| 1514–1624 | `useSwipe` hook |
| 1625–2570 | `HeroCard`, `TaskCard`, `FocusTaskRow`, `CollapsibleTodaySection` |
| 2571–2670 | `SuggestionChip`, `ThinkingBubble`, `MicButton`, `AskTab` |
| 2671–2900 | `TracksTab`, `ContextRow`, `SegmentButton`, `CaptureBar` |
| 2901–4035 | `usePlans`, `PlanCard`, `PlanDetailScreen`, `AddPlanSheet`, `PlansPanel`, `LifeTab` |
| 4036–3902 | Calendar utilities, `MonthStrip`, `WeekDetail`, `TaskDetailSheet`, `CalendarTab` |
| ~4040 | `SpeedDialItem`, `HeedFAB` |
| ~4115 | `AskInlineModal`, `AddTaskModal`, `AddContextModal`, `AddRoutineModal` |
| ~4577 | `Toast`, `RetrospectiveSheet`, `TaskOptionsSheet`, `AddToRoutineSheet` |
| ~5012 | `QuickContextSheet`, `ActiveContextCard`, `RecoverySummarySheet`, `ContextDetailSheet` |
| ~7660 | `UsernameGate` component |
| ~7840 | `HeedApp` (root component — all state, all handlers) |

---

### 2.2 Design tokens & themes

**File:** `web/app/themes.js`

**Five user-selectable themes** plus one auto-applied theme:

| Theme | When | Vibe |
|---|---|---|
| `parchment-light` | User pick | Cream paper + sage + ochre — daytime calm |
| `midnight-fern` | User pick · default | Deep forest dark mode + cream ink |
| `inkwash` | User pick | Warm dark with bark/amber tones |
| `flamingo` | User pick | Coral + mulberry warm palette |
| `candy` | User pick | Hot pink + cosmos pastel + mint |
| `periwinkle` | **Auto** | Activated when an `activeContext.type === 'low'` (Low Day) is present; reverts to the user's pick when the context ends. Not selectable from the picker. |

Each theme exports a color palette (~25 tokens including `scrim`/`scrimLight` for modal overlays) and `OWL_THEMES` — colour maps for the `MayaOwl` SVG fills, rotated for cross-theme contrast.

Active theme is stored in `localStorage('heed-theme')` and in a module-level `themeState` object. The `C` proxy reads `themeState.current` on every render, so theme switches are immediate without React context. Theme transitions cross-dissolve over 320ms via `var(--m-slow)` on the body root.

```js
// themes.js exports
export const THEMES = { 'parchment-light': {...}, 'midnight-fern': {...}, 'inkwash': {...}, 'flamingo': {...}, 'candy': {...}, 'periwinkle': {...} }
export const OWL_THEMES = { /* same keys */ }
export const themeState = { current: 'midnight-fern' }
export function setThemeState(name) { themeState.current = name }
export const DEFAULT_THEME = 'midnight-fern'
```

**Usage rule:** Never hardcode hex values — always use `C.*` tokens.

```js
// ✅
style={{ color: C.ochre, background: C.paper }}
// ❌
style={{ color: '#D4A24C', background: '#FDFAF4' }}
```

---

### 2.3 State management

All app-level state lives in `HeedApp` (~line 7840). It is passed down as props — no context, no external state manager.

#### Identity state

```js
const [username, setUsername] = useState(() => getUsername())
// getUsername() reads localStorage('heed.username'), returns '' if absent
// UsernameGate renders when !username; dismisses by calling setUsername(u)
```

#### Task state

```js
const [apiTasks, setApiTasks] = useState(() => isDemoMode() ? TASKS_DEMO : [])
// Fetched from GET /api/tasks on mount (skipped in demo mode)
const displayTasks = apiTasks
  .filter(t => t.status === 'active' && !dismissedIds.has(t.id))
  .map(computeTaskDisplay)
```

Mutations (`handleMarkDone`, `handleSkip`, `handleAddTask`, etc.) POST to the backend and update `apiTasks` optimistically or via re-fetch.

#### Plans state

```js
const plansHook = usePlans(isDemoMode() ? DEMO_PLANS : [])
// { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan, updatePlan }
```

Persisted to `localStorage('heed_plans')` via `useEffect`. Demo plan IDs (`plan-1`, `plan-2`, `plan-3`) are automatically stripped when not in demo mode to prevent contamination from old code paths.

#### Routines state

```js
const [routines, setRoutines] = useState(isDemoMode() ? ROUTINES : [])
// Hydration: localStorage('heed.routines.v1') → backend GET /api/user_state/routines
// Default ROUTINES seed (morning/evening) is never pushed to backend
```

#### Context state

```js
const [apiContexts, setApiContexts] = useState({ active: [], upcoming: [] })
// Fetched from GET /api/context on mount
```

#### Demo mode

```js
const isDemoMode = () => localStorage.getItem('heed.use-demo') === '1'
```

When active: API fetches for tasks, routines, and plans are all skipped; TASKS_DEMO / ROUTINES / DEMO_PLANS are used as state. Settings shows a "Switch to real data" button that removes the flag and reloads.

---

### 2.4 Custom hooks

#### `useChat({ onLightenRoutine, onTaskAdded, onRoutineAdded })`

AI chat session. Manages messages, input, thinking steps, streaming, and action execution.

- `messages` — `[{ role, content, actions?, chips? }]`
- `send(text)` — appends user message, calls `/api/advisor_stream`, streams response, parses action tokens
- `executeAction(action)` — fires confirmed actions to `/api/execute_action`
- Chat history persisted to `localStorage('heed_chat')`

#### `useMic(onTranscript, onEnd)`

Web Speech API wrapper.

- `toggle()` — starts or stops recognition
- `onTranscript(text, isFinal)` — called for each result; `AskTab`/`AskInlineModal` auto-send on `isFinal === true`

#### `usePlans(initialPlans)`

localStorage-backed plan state with backend write-through.

```js
const { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan, updatePlan } = usePlans([])
```

- Lazy initializer reads `localStorage('heed_plans')`; strips demo plan IDs when not in demo mode
- Save `useEffect` persists to localStorage and PUTs to `/api/user_state/plans` on every change (skipped in demo mode)

#### `useSwipe(onRight, onLeft, threshold)`

Pointer event swipe detector for task cards. Returns a `ref` to attach to a container element.

#### `useShareCard()`

`html2canvas` + Web Share API. Returns `{ capture(el), share(blob), shareCard(routine, variant, theme) }`.

---

### 2.5 Component inventory

#### Primitives

| Component | Purpose |
|---|---|
| `MayaOwl` | SVG owl avatar — moods: `calm`, `thinking`; `speaking` prop for animation |
| `OwlSignature` | Small inline owl for share cards |
| `Pill` | Colored badge pill |
| `ImportanceBadge` | low / medium / high badge |
| `CategoryBadge` | Category icon + label |
| `BotanicalDivider` | Leaf/flower section divider SVG |
| `SectionHeader` | Section title with count and motif |
| `Bubble` | Chat message bubble (user + assistant, streaming, actions, chips) |
| `ThinkingBubble` | Animated thinking steps indicator |
| `SuggestionChip` | Tappable suggestion pill in Ask Heed |
| `MicButton` | Microphone toggle button |
| `SegmentButton` | Tab segment control |
| `Toast` | Slide-up notification — supports undo, view, reason chips |

#### Navigation & Layout

| Component | Purpose |
|---|---|
| `MobileBottomNav` | Fixed bottom nav bar with 5 tabs + mic shortcut |
| `HeedFAB` | Speed-dial FAB for Add Task / Ask Heed / Add Routine |
| `SpeedDialItem` | Individual FAB action item |
| `SettingsRow` | 44pt settings row with tap handler |
| `ThemeSwitcher` | Theme picker (parchment-light / midnight-fern / inkwash / flamingo / candy) |
| `AvatarButton` | User avatar circle — opens Settings |
| `UsernameGate` | Full-screen overlay for first-time / returning users |
| `DataModeWelcome` | One-shot post-login modal: choose demo data vs. real data (set via `heed.welcome-seen` flag) |

#### Task components

| Component | Purpose |
|---|---|
| `HeroCard` | First/priority task card (larger, swipeable) |
| `TaskCard` | Standard task card with swipe-to-done/skip |
| `FocusTaskRow` | Stripped focus card — tap anywhere to mark done |
| `CaptureBar` | Quick capture bar on Today tab |
| `CollapsibleTodaySection` | Collapsible section wrapper for Today tab |
| `TaskOptionsSheet` | Bottom sheet: view, edit, delete, build routine, skip w/ reason |
| `AddToRoutineSheet` | Pick a routine to add a task to |
| `AddTaskModal` | Create/edit task form (name, category, importance, cadence, due date) |
| `TaskDetailSheet` | Calendar tap → task detail view |

#### Routine components

| Component | Purpose |
|---|---|
| `RoutineRow` | Compact routine row for Today tab |
| `RoutineCard` | Full routine card with streak, progress, share, lighten |
| `AddRoutineModal` | Create/edit routine (name, items, date range, task picker) |
| `ShareableCard` | Routine share card in 3 variants: streak, progress, routine |
| `ShareCardSheet` | Bottom sheet to pick share variant and export |

#### Plan components

| Component | Purpose |
|---|---|
| `PlanCard` | Plan card (project / event / goal) in the Plans grid |
| `PlanDetailScreen` | Full-screen checklist for a plan's tasks |
| `PlanBubbleDetailScreen` | Plan detail with progress ring, log savings (numeric goals), milestone tasks |
| `EditPlanScreen` | Edit plan (icon, title, target date via `CalendarPicker`, target amount, type) |
| `AddPlanSheet` | Create a new plan (type, icon, title, date, goal kind) |
| `PlansPanel` | Plans tab — card grid or detail screen |
| `CalendarPicker` | Inline month/day picker used in `EditPlanScreen` and add flows |

#### Calendar components

| Component | Purpose |
|---|---|
| `MonthStrip` | Month calendar with week selector |
| `WeekDetail` | Day-by-day week view with task slots |
| `RetrospectiveSheet` | Monthly retrospective — patterns + suggestions |
| `CalendarTab` | Calendar tab root |

#### Context components

| Component | Purpose |
|---|---|
| `ContextBanner` | Upcoming context alert banner |
| `ContextRow` | Single context window row |
| `ActiveContextCard` | Currently active context (I'm better / extend) |
| `QuickContextSheet` | One-tap context activation (sick/busy/travel/celebration) |
| `AddContextModal` | Custom context window creation |
| `RecoverySummarySheet` | After context ends — resume all or ease back |
| `ContextDetailSheet` | Full detail for a context window |

#### Modals & Sheets

| Component | Purpose |
|---|---|
| `AskInlineModal` | Floating bottom-sheet Ask Heed chat (from FAB / owl) |
| `SettingsSheet` | Fullscreen Settings (despite the legacy name): index → detail nav. Index lists Profile + 5 destinations (Personalize, Categories, Data, Heed AI, About); each opens its own focused screen with a back chevron. |
| `ConfirmSheet` | Bottom-sheet replacement for `window.confirm` — used for sign out, reset, demo swap |
| `PlanCompletionCelebration` | Falling-petal + happy-owl + medallion celebration; fires once per plan via `heed.plan-celebrated.<id>` flag. Includes "Moves to Past Plans" pill. |

#### Tabs (root screens)

| Component | Purpose |
|---|---|
| `TodayTab` | Today view — capture bar, routines, focus cards, context banner |
| `AskTab` | Full-screen Ask Heed chat |
| `TracksTab` | Routines + tasks segmented view |
| `LifeTab` | Plans + life events segmented view |
| `CalendarTab` | Calendar + retrospective |
| `HeedApp` | Root: all state, all handlers, tab routing, all modals |

---

### 2.6 Feature inventory

#### Identity & Auth
- `UsernameGate` overlay on first visit — animated owl fly-in landing on a branch
- New user registers a unique username via `POST /api/register_username`
- Returning user identifies via `GET /api/check_username` (same username → same Cosmos bucket)
- Username stored in `localStorage('heed.username')`, sent as `X-User-ID` header on every fetch
- No passwords, no sessions — username is the identity token

#### Today Tab
- `CaptureBar` at top — type or speak to quick-create tasks or routines via `POST /api/parse_capture`
- Hero card (first overdue/due task) with swipe-to-done / swipe-to-skip
- Focus cards — tap anywhere (or tickbox) to mark done with 3-beat animation
- Collapsible sections (overdue, upcoming, later)
- Routine rows with Lighten This Week and Skip Today
- Skipped tasks footer with ↻ unskip buttons
- Context banner when a life event is active

#### Ask Heed (AI Chat)
- Claude-powered chat via Azure Functions advisor agent
- Suggestion chips on empty state; chips switch mode based on last turn
- Streaming response (word-by-word replay)
- Thinking steps indicator
- `add_task` and `add_routine` actions — advisor creates directly without confirmation prompt
- `edit_task` action — advisor can update task fields
- Green task card and amber routine card in chat after creation
- Mic button → auto-sends transcript on final recognition
- Long-press owl → mic → auto-send to Ask Heed
- Chat history persisted in `localStorage('heed_chat')`
- Inline modal variant (`AskInlineModal`) from FAB and owl

#### Tracks Tab (Routines)
- Routine cards with streak, progress bar, 14-day completion heatmap
- Edit routine (name, items, schedule, date range, importance, frequency)
- Lighten This Week / Skip routine today / Mark past day done
- Build a routine from a task
- Add existing tasks to routine — per-row picker with inline search
- Shareable cards — html2canvas export in 3 variants (streak / progress / routine)

#### Plans (Life Tab)
- Plan cards for project, event, and goal types
- Interactive task checklist: check/uncheck, inline rename, swipe-to-delete, drag-to-reorder
- Plan detail editing — icon, title, date
- Add new plan (type, icon, title, date)
- localStorage + backend write-through via `usePlans`

#### Calendar Tab
- Month strip with week selector
- Week detail: task slots by day, add task, add context
- Monthly retrospective — patterns + adjust cadence buttons
- Reschedule tasks from calendar

#### Context / Life Events
- Quick context activation (sick, busy, travel, celebration) with duration selector
- Custom context window (type, description, date range)
- Active context card with I'm better / extend
- Recovery summary after context ends (resume all or ease back)
- Context detail sheet with held task list

#### Settings (fullscreen with internal nav)
- Index screen with profile hero card + 5 chevron rows (Personalize · Categories · Data · Heed AI · About)
- **Profile** — avatar upload, display name, sign out (clears identity keys, returns to UsernameGate)
- **Personalize** — theme picker (5 themes), focus mode toggle
- **Categories** — custom task categories + custom life event types
- **Data** — demo data toggle, "Load demo data" / "Switch to real data", danger zone (full reset)
- **Heed AI** — clear chat history (today / all)
- **About** — version, credits

#### Plan completion celebration
- Fires when a plan reaches 100% completion (numeric goals: target reached; milestone goals: all tasks done)
- Petals + happy MayaOwl + sparkle medallion + "Plan complete." headline + "Moves to Past Plans" pill
- One-shot per plan via `heed.plan-celebrated.<id>` flag — won't replay on revisit
- Numeric goals get an additional money-savings sheet for amount logging with quick-add chips that scale to goal size

#### Welcome modal (one-shot post-login)
- `DataModeWelcome` shown when a user logs in with `!heed.welcome-seen`
- Two cards: "Try the demo" (Recommended) and "Use my own data"
- Sets `heed.welcome-seen = '1'` on dismiss; survives demo-mode swaps so it doesn't re-appear

#### Global
- Toast notification system (slide-up, auto-dismiss, undo / view / reason chips)
- Botanical decorative dividers
- Bottom nav (5 tabs + mic shortcut on Today tab)
- Speed-dial FAB (Add Task / Ask Heed / Add Routine)
- Five-theme system with instant switching + auto periwinkle on Low Day
- System-wide motion tokens — Settings detail slide, tab crossfade, theme cross-dissolve, prefers-reduced-motion fallback

---

### 2.7 localStorage keys

| Key | Type | Purpose |
|---|---|---|
| `heed.username` | string | Logged-in username; read by `getUsername()` for `X-User-ID` header |
| `heed.display-name` | string | Display name (separate from username — display can be edited; username can't) |
| `heed.avatar` | data-URL | Uploaded avatar (≤1 MB, JPEG/PNG/WebP/GIF) |
| `heed.auth-token` | string | HMAC token sent as `X-Auth-Token` on backend requests |
| `heed.use-demo` | `'1'` | Demo mode flag; cleared by "Switch to real data" |
| `heed.welcome-seen` | `'1'` | One-shot flag for `DataModeWelcome` modal — survives demo swaps |
| `heed-theme` | string | Active theme name (`parchment-light` / `midnight-fern` / `inkwash` / `flamingo` / `candy`) |
| `heed.efMode` | `'1'` | Focus mode toggle — strips Today down to essentials |
| `heed_plans` | JSON array | All plan data including tasks; write-through to backend |
| `heed.plan-celebrated.<id>` | `'1'` | Per-plan completion-celebration flag — prevents replay |
| `heed.routines.v1` | JSON array | Routines cache; write-through to backend |
| `heed.chat-history.v1` | JSON array | Ask Heed chat history (current); cleared today / cleared all from Settings |
| `heed_chat` | JSON array | Legacy chat key — kept for `useChat` hook compatibility |
| `heed_custom_categories` | JSON array | User-added task categories |
| `heed_custom_event_types` | JSON array | User-added event types |
| `heed_swipe_hint_shown` | `'1'` | Whether the first-swipe hint has been shown |

---

## 3. Backend

### 3.1 Azure Functions endpoints

**File:** `functions/function_app.py`  
**Runtime:** Python 3.11, Azure Functions v2 programming model  
**Auth:** `AuthLevel.ANONYMOUS` — identity is via `X-User-ID` header, not HTTP auth

All responses include `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: Content-Type, X-User-ID`. All OPTIONS preflights return 204.

#### Identity helpers

```python
def _get_user_id(req: func.HttpRequest) -> str:
    return req.headers.get('X-User-ID') or 'demo'
```

Every handler calls `user_id = _get_user_id(req)` as its first statement and passes it to all Cosmos operations.

#### Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/check_username?u=<name>` | Returns `{ available: bool }` — public registry check |
| `POST` | `/api/register_username` | Creates `{ id, created_at }` in `users` container |
| `GET` | `/api/tasks` | List active tasks for the user |
| `POST` | `/api/tasks` | Create a task (includes `created_at`) |
| `GET/PATCH/DELETE` | `/api/tasks/{task_id}` | Read / update / archive a task |
| `POST` | `/api/completions` | Mark done / skip (with reason) / defer |
| `GET/POST` | `/api/context` | List or create context windows |
| `GET` | `/api/today_view` | Aggregated today view (tasks + routines + context) |
| `POST` | `/api/advisor_stream` | Advisor agent — returns NDJSON of SSE events |
| `POST` | `/api/execute_action` | Execute an advisor-proposed action (mark_done, add_task, add_routine, edit_task, …) |
| `POST` | `/api/parse_capture` | Parse free text into a structured task or routine (`heed-keeper` / gpt-5.4-mini) |
| `POST` | `/api/suggest_tasks` | LLM-generated task suggestions |
| `GET/PUT` | `/api/user_state/{kind}` | Read / write user state blobs (routines, plans) |
| `POST` | `/api/reset` | Wipe all user data from Cosmos |
| `GET` | `/api/calendar_events` | Calendar events for the user |
| `GET` | `/api/ph_calendar` | Philippine holiday calendar |
| `POST` | `/api/memory_keeper_run` | Manual trigger for memory keeper |

#### Timer

`memory_keeper_timer` — runs every 6 hours. Uses `"demo"` as the user bucket (timer-triggered; no HTTP request context). A future update should iterate all Cosmos users.

#### Environment variables

| Variable | Used by |
|---|---|
| `COSMOS_CONNECTION_STRING` | All Cosmos operations |
| `AZURE_OPENAI_ENDPOINT` | Advisor, Memory Keeper, parse_capture |
| `AZURE_OPENAI_KEY` | Advisor, Memory Keeper, parse_capture |
| `AZURE_SEARCH_ENDPOINT` | Search tool |
| `AZURE_SEARCH_KEY` | Search tool |

---

### 3.2 Data model (Cosmos DB)

Database name: `heed`. Containers partitioned on `/user_id` except `users` (partitioned on `/id`).

#### `users`

| Field | Type | Notes |
|---|---|---|
| `id` | string | Username — same as `X-User-ID` header value |
| `created_at` | ISO 8601 | Registration timestamp |

#### `tasks`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `task_<uuid>` |
| `user_id` | string | Partition key |
| `name` | string | Short label |
| `description` | string? | Optional context |
| `category` | string | `home\|health\|admin\|relationships\|self_care\|work\|finance` |
| `importance` | string | `low\|medium\|high` |
| `status` | string | `active\|paused\|archived` |
| `created_at` | ISO 8601 | |
| `explicit_cadence_days` | number? | User-set interval |
| `learned_cadence_days` | number? | Agent-inferred (requires 5 completions + 3 weeks) |
| `learned_confidence` | number? | 0.0–1.0 |
| `next_due_at` | ISO 8601? | `last_done_at + effective_cadence` |
| `last_done_at` | ISO 8601? | Most recent completion |
| `dueDate` | string? | Optional one-off date (e.g. "Jun 15") |
| `dueTime` | string? | Optional one-off time |

#### `completions`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `comp_<uuid>` |
| `task_id` | string | References `tasks.id` |
| `user_id` | string | Partition key |
| `event_type` | string | `done\|skipped\|deferred` |
| `completed_at` | ISO 8601 | |
| `skip_reason` | string? | `still_fine\|not_applicable\|forgot\|too_busy\|other` |
| `note` | string? | Free text |

#### `user_context`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ctx_<uuid>` |
| `user_id` | string | Partition key |
| `context_type` | string | `travel\|illness\|busy\|celebration\|other` |
| `start_date` | ISO 8601 date | |
| `end_date` | ISO 8601 date | Inclusive |
| `description` | string | Read by the advisor |

#### `user_state`

Flexible key-value blobs. `id` is `<user_id>__<kind>` (e.g. `alice__routines`).

| Field | Type | Notes |
|---|---|---|
| `id` | string | `<user_id>__<kind>` |
| `user_id` | string | Partition key |
| `kind` | string | `routines\|plans` |
| `items` | JSON array | The state payload |

---

### 3.3 AI Search indexes

#### `task_memory`

Semantic + vector search over tasks. Fields: `id`, `user_id`, `name`, `description`, `category`, `recent_notes` (last 5 completion notes), `last_done_at`, `next_due_at`, `importance`, `status`, `content_vector` (text-embed-3-small embedding of name + description + notes).

Indexer pulls from Cosmos change feed every 5 minutes.

#### `ph_calendar`

Static corpus of Philippine holidays and cultural events. Grounds the advisor in local time/culture context. Seeded once, no indexer.

---

### 3.4 Agent layer

#### Advisor (`agents/advisor.py`)

Async generator that streams SSE events. Model: `heed-advisor` deployment (gpt-5.4) on Azure OpenAI. System prompt loaded from `agents/prompts/advisor_system.md`.

Available tools: `get_tasks`, `get_context`, `search_tasks`, `get_today_view`, `propose_action` (mark_done, skip, defer, add_task, add_routine, edit_task, lighten_routine, add_context).

The frontend renders proposed actions as confirm buttons (or executes immediately for creation actions) and fires them to `POST /api/execute_action`.

#### Memory Keeper (`agents/memory_keeper.py`)

Runs every 6 hours. Re-computes `learned_cadence_days` and `learned_confidence` for tasks with sufficient history (≥5 completions, ≥3 weeks). Model: `heed-keeper` deployment (gpt-5.4-mini) on Azure OpenAI.

#### Parse Capture (`POST /api/parse_capture`)

Single `chat.completions.create` call using the `heed-keeper` deployment (gpt-5.4-mini). Parses free text into `{ type: 'task'|'routine', payload: {...} }`. Used by the CaptureBar on Today tab.

---

## 4. Development

### 4.1 Local development

**Prerequisites:** Node.js 20+, Python 3.11, Azure Functions Core Tools v4

#### Frontend only (recommended for UI work)

```bash
cd web
npm install
npm run dev
# http://localhost:3000
```

When `NEXT_PUBLIC_FUNCTIONS_URL` is not set, it defaults to `http://localhost:7071`. If Functions isn't running, the app loads with empty state (no seeded fallback in real mode).

#### Full stack

```bash
# Terminal 1 — backend
cp functions/local.settings.json.example functions/local.settings.json
# Fill in Cosmos, OpenAI, Search keys
cd functions && func start

# Terminal 2 — frontend
cd web
cp .env.local.example .env.local   # NEXT_PUBLIC_FUNCTIONS_URL=http://localhost:7071
npm run dev
```

---

### 4.2 Build & deploy

#### Frontend

The GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) deploys `web/out/` directly on every push to `main` (`skip_app_build: true`).

To rebuild `web/out/` locally:
```bash
cd web && npm run build
```

Commit `web/out/` along with the source change and push. **Why pre-built?** The CI worker has no access to `NEXT_PUBLIC_FUNCTIONS_URL` or `.env.local`, so the export must be generated locally.

#### Backend (Functions)

```powershell
cd functions
.\deploy_functions.ps1
```

This script copies `agents/` into `functions/` (for bundling), runs `func azure functionapp publish func-heed`, then removes the copy.

---

## 5. Code Standards

### Color tokens — always use `C.*`

```js
// ✅
style={{ color: C.ochre, background: C.paper }}
// ❌
style={{ color: '#D4A24C', background: '#FDFAF4' }}
```

### No TypeScript, no external component libs

All components are plain JS functions, all styles are inline objects. No Tailwind, no shadcn, no Material UI. Follow what's already in the file.

### Immutable state mutations only

```js
// ✅
setItems(prev => prev.map((it, i) => i === idx ? { ...it, name } : it))
// ❌
items[idx].name = name; setItems(items)
```

### Button defaults

- All non-submit buttons inside forms: `type="button"`
- Clickable divs → convert to `<button>` with `background:'none', border:'none', cursor:'pointer', fontFamily:'inherit'`
- When `border: 'none'` and `borderBottom: ...` coexist, put `border` first (shorthand overrides longhand that follows)

### Motion tokens

Defined in `web/app/globals.css` as CSS variables so they work in both keyframes and inline JSX styles via `var(--…)`. Reduced-motion users get all transitions clamped to 0.01ms.

| Token | Value | Use |
|---|---|---|
| `--m-fast` | 160ms | Button press, toggle flip, chip state |
| `--m-base` | 220ms | Panel slide, modal in, tab change |
| `--m-slow` | 320ms | Screen transition, theme swap |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entering elements |
| `--ease-in` | `cubic-bezier(0.5, 0, 0.75, 0)` | Exiting (60–70% of enter dur) |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful overshoot |

Reusable utility classes also in `globals.css`:

| Class | Effect |
|---|---|
| `.heed-settings-detail` | Slide in from right (Settings detail screens, keyed off `settingsView`) |
| `.heed-tab-fade` | Crossfade + 6px lift (tab body wrapper, keyed off `tab`) |
| `.heed-stagger > *` | Per-child stagger via inline `style={{ '--i': index }}` (capped at 12) |
| `.heed-pressable` | Generic press-scale 0.98 with token transitions |
| `.heed-theme-bg` | Cross-dissolve background/border/color over `--m-slow` for theme swap |

### Keyframes

All keyframes live in the `<style>` block inside `HeedApp`'s JSX (or in `globals.css` for the motion utilities above). Naming: `heed-<name>`.

| Name | Effect |
|---|---|
| `heed-owl-fly` | Owl flies in from upper-right (auth screen) |
| `heed-fadeIn` | opacity 0→1 |
| `heed-fadeUp` | opacity 0→1 + translateY 8px→0 |
| `heed-dropdown` | opacity 0→1 + translateY -6px→0 |
| `heed-slideUp` | opacity 0→1 + translateY 40px→0 (bottom sheets) |
| `heed-slideRight` | opacity 0→1 + translateX 20px→0 |
| `heed-slideIn` | translateX 100%→0 (full drawer slide) |
| `heed-slide-in-right` | opacity 0→1 + translateX 16px→0 (Settings detail) |
| `heed-tab-crossfade` | opacity 0→1 + translateY 6px→0 (tab body wrapper) |
| `heed-stagger-up` | opacity 0→1 + translateY 8px→0 (list items, with `--i` delay) |
| `heed-toast-up` | opacity 0→1 + translateY 20px→0 |
| `heed-breathe` | scale + opacity pulse (owl glow) |
| `heed-bob` | translateY bounce |
| `heed-pulse` | scale + opacity (indicator dot) |
| `heed-blink` | opacity blink |
| `heed-mic-pulse` | box-shadow pulse (recording indicator) |
| `heed-done-out` | slide-right + fade + collapse (task mark-done) |
| `heed-done-check` | check icon scale-in |
| `heed-check-draw` | SVG stroke draw |
| `heed-petal-fall` | Petal drift (plan completion celebration) |
| `heed-medallion-breathe` | Sparkle medallion pulse (plan completion) |
| `heed-headline-reveal` | "Plan complete." headline reveal |

### Helpers before conditional returns

All derived values and helper functions must be declared before any early-return guard (`if (!open) return null`). This follows React's linting rules.

### Skip-reason enum

Frontend chip values must match backend exactly:
`still_fine`, `not_applicable`, `forgot`, `too_busy`, `other`

### Commits

No `Co-Authored-By` trailers. Short imperative subject. Prefixes: `feat:`, `fix:`, `docs:`, `build:`, `refactor:`.
