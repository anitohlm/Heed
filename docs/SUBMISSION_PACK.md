# Heed — Submission Pack

CWB Hackathon 2026 · 2026-05-10

> **Heed is a gentle personal assistant for the parts of life you keep forgetting.**
> Health and wellness habits, household admin, life events, and the small commitments that fall through the cracks. It plans, reasons, takes action across multiple steps, and adapts to your real capacity — not your aspirational one.

This document has four parts:
- **A.** Pre-recording checklist
- **B.** 5-minute demo video script (covers safety + multi-model per the brief)
- **C.** System architecture
- **D.** Compliance & safety summary (data, secrets, risk mitigations)

---

## A · Pre-recording checklist

Run through these 10 minutes before recording.

### State setup
- [ ] Hard-reload the deployed site once Azure SWA finishes the latest deploy: https://brave-pond-035757400.7.azurestaticapps.net/
- [ ] Sign in as `chelle` (synthetic persona — not a real user)
- [ ] On the welcome modal, pick **"Try the demo"**
- [ ] Verify parchment-light theme loads
- [ ] Verify the busy-period banner is visible: *"🌾 Busy period — Heed is going gentle"*
- [ ] Open Ask Heed once, then close — primes the chat surface

### Browser setup
- [ ] Mobile-emulator at 390×844 (iPhone 14)
- [ ] Hide bookmarks bar
- [ ] System Do Not Disturb on
- [ ] DevTools closed
- [ ] Refresh once to settle layout

### Sanity passes
- [ ] Tap **"Plan around my Singapore trip"** — Heed streams a real LLM response that references the trip dates
- [ ] Tap a plan in Life → detail screen opens, ring shows progress
- [ ] Tap Settings → fullscreen, parchment, back chevron works
- [ ] Add a quick task in CaptureBar → appears in Today AND survives a refresh (demo persistence)

### Submission asset checklist
- [ ] GitHub repo public: https://github.com/anitohlm/Heed
- [ ] No API keys committed (verify `.env.local` is in `.gitignore`)
- [ ] No PII anywhere — everything in `TASKS_DEMO`, `DEMO_PLANS`, `ROUTINES` is synthetic
- [ ] `docs/SAFETY.md` present (referenced in the safety section of the video)
- [ ] Architecture diagram (this file, section C) renders as ASCII or copy into a clean image

---

## B · 5-minute demo video script

Read conversationally, paraphrase freely. Total runtime ≈ 4:55.

> **[0:00–0:15] Hook**
>
> "Most productivity apps treat you like a project manager. They want lists, deadlines, status updates. But real life isn't a project — it's a quiet stream of small things you keep meaning to do.
>
> This is **Heed** — a gentle personal assistant for what you forget."

*Show: app loads, Today tab.*

> **[0:15–0:50] Today — what your assistant noticed**
>
> "Heed opens on Today. There are no streaks, no progress bars, no demands. Just what actually matters today, sorted by what's at risk first.
>
> Maynilad — 19 days overdue, your water might get cut. Meralco — 9 days. Call Mom — you usually call every Sunday, three Sundays missed.
>
> Heed knows your patterns. Not because you logged them — because the assistant watched."

*Show: scroll Today list.*

> **[0:50–2:00] Ask Heed — agentic planning + reasoning**
>
> "When the week feels heavy, you can ask. Like — *Plan around my Singapore trip.*"

*Tap "Plan around my Singapore trip".*

> "Heed reads my travel context — June 5 to 9 — cross-references my task list, and plans **across three time windows**: before I leave, while I'm away, after I'm back. It pauses my routines for the trip, drafts a soft restart, and surfaces what to do this week."

*Wait for response, point at action chips.*

> "Notice these aren't suggestions buried in text — they're **actions**. Tap one, the assistant schedules it. The agent proposes; the user always confirms. That's the safety boundary: Heed never mutates your data without you saying yes.
>
> Under the hood: this is multi-step reasoning grounded in **two retrieval surfaces** — Azure AI Search over your task memory and completion history for personal context, plus Grounding with Bing for time-sensitive web facts when needed."

> **[2:00–2:40] Life — plans, events, money goals**
>
> "Goals and events live in Life. Singapore trip — five prep tasks, 26 days out. Save ₱50,000 — Heed tracks the ring, lets me log savings inline. When I finish a plan, the assistant celebrates."

*Tap savings goal, scroll detail.*

> **[2:40–3:20] Tracks — adaptive routines**
>
> "Routines on Tracks. The unique part — *lighten this week*."

*Click "Lighten this week" on Morning routine.*

> "Heed says: vitamins and coffee, that's it. Skip the rest. Why? Looking at three previous busy weeks, those are the only two I never broke. The assistant matches my **actual** capacity, not my aspirational one — which is what makes it gentle instead of guilt-inducing."

> **[3:20–4:00] Low Day & themes**
>
> "Some days are just heavy. Heed has a Low Day mode."

*Activate Low Day from Events.*

> "The whole interface shifts — periwinkle palette, banner up top, routines pause automatically. No questions asked. When I'm ready, it eases me back in."

*Show periwinkle. End it via "Feeling a bit better".*

> **[4:00–4:30] Multi-model + safety**
>
> "Heed uses **two models from Azure AI Foundry**, picked deliberately:
> - **Claude Sonnet 4.6** powers the Advisor — multi-step reasoning, tool calls, planning across days.
> - **Claude Haiku 4.5** handles fast paths — capture parsing and the Memory Keeper that learns my cadences in the background. Sonnet costs more per token but reasons better; Haiku is fast and cheap for narrow extraction.
>
> On safety: every destructive multi-task action — bulk delete, wipe routines, reset state — requires explicit user confirmation through a typed-gate sheet. The agent can propose; only the user disposes. We documented the full risk model in our SAFETY.md, including prompt-injection mitigations on the chat surface and a separate safety_tool.py guardrail that intercepts agent proposals before any Cosmos write."

*Show Settings → Personalize → swap themes.*

> **[4:30–4:55] Tech stack + close**
>
> "Stack: Next.js 14 PWA on Azure Static Web Apps. Python Azure Functions on Consumption plan. Cosmos DB for state, Azure AI Search for vector retrieval, Azure OpenAI for the LLMs, Grounding with Bing for web facts, Key Vault for secrets via Managed Identity — no API keys in source. All synthetic data, no PII anywhere.
>
> Heed is the assistant that remembers what you forget. Thanks for watching."

*End on the Today screen with the owl visible.*

---

## C · System architecture

### One-line summary

Heed is a Next.js 14 PWA on Azure Static Web Apps, talking to Python Azure Functions that orchestrate two AI agents (Advisor + Memory Keeper) reading from Cosmos DB and Azure AI Search, powered by Azure OpenAI's Claude Sonnet 4.6 and Haiku 4.5, with optional Grounding with Bing for time-sensitive web context.

### Component diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (PWA)                             │
│                                                                  │
│   Next.js 14 static export · Lora + Nunito Sans · 5 themes       │
│   localStorage: identity, themes, demo cache, plans, chat       │
│                                                                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │  X-User-ID + X-Auth-Token (HMAC)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│       AZURE STATIC WEB APPS  →  AZURE FUNCTIONS                  │
│           (free tier)            (Consumption · Python 3.11)     │
│                                                                  │
│   /api/tasks · /api/completions · /api/context · /api/plans      │
│   /api/advisor_stream    ← streams NDJSON of agent events        │
│   /api/parse_capture     ← free-text → task or routine (Haiku)   │
│   /api/execute_action    ← gated mutations from agent proposals  │
│   /api/memory_keeper_run ← cron-triggered cadence learner        │
│                                                                  │
└─────┬────────────────────────────┬───────────────────────────────┘
      │                            │
      ▼                            ▼
┌──────────────────┐    ┌──────────────────────────────────────┐
│   COSMOS DB      │    │       AGENT LAYER (Python)            │
│   (NoSQL)        │    │                                       │
│                  │    │  advisor.py    ← multi-step planning   │
│  users           │    │   ├ tools/cosmos_tool   (read tasks)   │
│  tasks           │    │   ├ tools/search_tool   (AI Search)    │
│  completions     │    │   ├ tools/bing_tool     (web grounding)│
│  user_context    │    │   ├ tools/action_tools  (proposals)    │
│  user_state      │    │   └ tools/safety_tool   (Risk-7 gate)  │
│  (plans/         │    │                                        │
│   routines)      │    │  memory_keeper.py  ← cadence learner   │
│                  │    │     (timer · every 6h)                 │
│  partition: /user_id   │                                        │
│                  │    │  auth.py · telemetry.py                │
└──────────────────┘    └──────────┬─────────────────────────────┘
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

### Multi-model strategy

| Model | Where | Why |
|---|---|---|
| **Claude Sonnet 4.6** | `advisor.py` — the agentic loop | Best for multi-step planning, tool selection, weighing trade-offs across the user's whole context. Higher per-token cost, justified by the small number of advisor calls per session. |
| **Claude Haiku 4.5** | `parse_capture` (free-text → structured task), `memory_keeper.py` (cadence pattern learner) | Narrow, well-defined extraction tasks where Sonnet would be wasteful. Haiku finishes capture parsing in <500ms. |

We deliberately chose two-model split over a single-model deployment: cost stays low on the high-volume paths (capture, background learning) while the user-facing reasoning surface stays sharp.

### Two agents

**Advisor** (`agents/advisor.py`) — streaming async generator. Tools:
- `get_tasks` / `get_today_view` / `get_context` — read the user's current state
- `search_tasks` — vector retrieval over Azure AI Search's `task_memory` index
- `bing_search` — Grounding with Bing for time-sensitive web context (deadlines, holidays, public events)
- `propose_action` — the gate for any mutation; the frontend renders these as confirm buttons

The frontend reads NDJSON events because Functions Consumption plan does not support chunked HTTP — events are buffered server-side and replayed word-by-word client-side to simulate streaming.

**Memory Keeper** (`agents/memory_keeper.py`) — runs every 6 hours. Re-computes `learned_cadence_days` and `learned_confidence` for tasks with ≥5 completions over ≥3 weeks. The "you call Mom every Sunday" pattern lives here.

### Grounding strategy (per the brief)

Heed grounds in **two retrieval surfaces**:

1. **Personal data** — Azure AI Search `task_memory` index. Vector + text search over the user's tasks, completion history, last 5 completion notes per task. Indexer pulls from Cosmos change feed every 5 minutes. The `ph_calendar` index adds Philippine holidays and cultural events for local-time grounding.
2. **Public web** — Grounding with Bing. The advisor calls `bing_search` for queries that need fresh web context: "is Memorial Day a long weekend this year?", "what's the weather forecast for the trip?". Results are cited with URL + snippet so the user can verify.

This split means Heed never confuses what's personal (tasks, contexts, patterns) with what's public (dates, facts, world events).

### Demo mode

Demo flips a `heed.use-demo` flag in localStorage. While set:
- Tasks, plans, contexts, routines come from curated synthetic seeds (`TASKS_DEMO`, `DEMO_PLANS`, `ROUTINES`, `ACTIVE_CONTEXT_DEMO`, `CONTEXTS_UPCOMING_DEMO`)
- User additions persist to localStorage (`heed.demo-tasks.v1`, `heed.demo-contexts.v1`) — the demo is interactive
- Ask Heed prepends a `[Demo-mode user state]` block describing the seed so the live Azure OpenAI advisor has context to reason about
- Network failures fall back to scripted answers (`SCRIPTED_RESPONSES`, `PLAN_ADVICE_RESPONSES`) so the demo never dead-ends

The user `chelle` and all of her data — Singapore trip, ₱50K savings goal, missed calls to Mom, overdue Maynilad bill — is fabricated. No real person's data is in the demo.

---

## D · Compliance & safety summary

### No PII

Every demo identity, task, plan, and context is synthetic. The `chelle` persona, her Singapore trip, her overdue bills, her family — all fabricated. The architecture supports real users via the `users` Cosmos container, but the demo bucket and committed seeds contain no real data.

### Secrets management

- All keys live in Azure Key Vault (`kv-heed-hack`).
- Functions read them via Managed Identity at runtime — no keys in `local.settings.json` of committed code.
- The repository's `.gitignore` excludes `.env.local`, `local.settings.json`, and any `*-key.json`.
- Frontend has zero secrets — it talks to Functions over HTTPS with the user's own HMAC token (`X-Auth-Token`), and that token is computed deterministically from a server-side `HEED_AUTH_SECRET` so a leaked token only impersonates one user, never the system.

### Risk model & mitigations

We documented the full risk model in `docs/SAFETY.md`. Highlights of how the live product mitigates each:

| Risk | Mitigation in code |
|---|---|
| **Risk 1 — Prompt injection via task names / chat input** | Advisor system prompt explicitly distrusts task content and chat history; the agent treats every user-content string as data, not instructions. |
| **Risk 2 — Hallucinated mutations** ("I added that for you" with no actual write) | Every mutation goes through `propose_action`; the frontend requires the user to tap a confirm button before `execute_action` fires. The agent cannot write to Cosmos directly. The `[Demo-mode user state]` system block also explicitly forbids the AI from claiming success without proposing the action. |
| **Risk 3 — Unsafe defer / skip suggestions on health-critical tasks** | Tasks marked `importance: 'non-negotiable'` are excluded from auto-lighten logic; the agent must propose them as separate confirmations with explicit user consent. |
| **Risk 4 — Stale cadence learning poisoning future suggestions** | Memory Keeper requires ≥5 completions over ≥3 weeks before learning a cadence; insufficient evidence falls back to the user's explicit setting. |
| **Risk 5 — Cross-user data leak** | Every Cosmos query partitioned on `/user_id`; `_get_user_id(req)` is the first call in every Function handler; HMAC verification ensures the X-User-ID header matches the bearer of the X-Auth-Token. |
| **Risk 6 — Bing grounding returning fabricated URLs** | Bing tool wraps the official Grounding with Bing API which returns cited URLs from a real index; results are surfaced as cards with the source URL visible to the user. |
| **Risk 7 — Multi-task destructive actions** (e.g. "delete all my Tuesday tasks") | `agents/tools/safety_tool.py` intercepts proposals with `requires_confirmation: true`; the frontend renders a typed-confirmation sheet (e.g. user must tap a destructive-tone button explicitly). Single-task destructive actions still confirm via the standard ConfirmSheet pattern. |

### Frameworks

We chose to write the agentic orchestration directly in Python rather than adopt the Microsoft Agent Framework. The reasoning: at hackathon scope (~72 hours) the framework's onboarding cost outweighed the velocity gains for our specific 2-agent layout. We considered the framework — the call-graph for Advisor and Memory Keeper would map cleanly to its agent / task primitives — and would adopt it in a Phase 2 build where the agent count grows beyond two and tool registration starts to pay off as a shared abstraction.

The Advisor uses Anthropic's Python SDK pointed at Azure OpenAI (Foundry) endpoints — same wire protocol, no model lock-in.

---

*End of submission pack.*
