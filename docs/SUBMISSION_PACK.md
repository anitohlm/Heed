# Heed — Submission Pack

CWB Hackathon 2026 · 2026-05-10

This document has three parts:
- **A.** Pre-recording checklist — do this before hitting record
- **B.** 5-minute demo video script — read along while recording
- **C.** System architecture — for the written submission

---

## A · Pre-recording checklist

Run through these 10 minutes before recording. Each box should be checkable.

### State setup
- [ ] Hard-reload the deployed site once Azure SWA finishes the latest deploy: https://brave-pond-035757400.7.azurestaticapps.net/
- [ ] Sign in as `chelle` (display name shows in greeting)
- [ ] On the welcome modal, pick **"Try the demo"** — gives you the curated seed
- [ ] Verify the parchment-light theme loads (warm cream, not dark)
- [ ] Verify the busy-period banner is visible at the top: *"🌾 Busy period — Heed is going gentle"*
- [ ] Open Ask Heed once and close — primes the chat surface

### Browser setup
- [ ] Mobile-emulator at 390×844 (iPhone 14) — desktop frames look bad on judge screens
- [ ] Hide bookmarks bar, make the window clean
- [ ] Set system to Do Not Disturb — no Slack pings mid-record
- [ ] Open DevTools and CLOSE it (otherwise the viewport shrinks)
- [ ] Refresh once to settle layout

### Sanity passes (60 seconds)
- [ ] Tap **"Plan around my Singapore trip"** chip in Ask Heed → AI streams a real response
- [ ] Tap a plan in Life → detail screen opens, ring shows progress
- [ ] Tap Settings (avatar) → fullscreen, parchment, back chevron works
- [ ] Add a quick task in CaptureBar → appears in Today

### If anything's broken
- [ ] Reset all data (Settings → Data → Danger zone) → re-pick demo from welcome modal
- [ ] If Ask Heed responds with "I don't see X", you're in **real-data** mode — switch to demo

---

## B · 5-minute demo video script

Read this conversationally — pauses where there are gaps. Total runtime ≈ 4:50.

> **[0:00–0:15] Hook**
>
> "Most productivity apps treat you like a project manager. They want lists, deadlines, status updates. But real life isn't a project — it's a quiet stream of small things you keep meaning to do.
>
> This is **Heed** — an agentic personal assistant for the things you forget."

*Show: app loads, Today tab visible.*

> **[0:15–0:50] Today tab**
>
> "Heed opens on Today. Notice what's NOT here — no streaks, no progress bars, no demands. Just the things that actually matter for today, sorted by what's risk-of-disconnection first.
>
> Maynilad — 19 days overdue, your water might get cut. Meralco — 9 days. Call Mom — you usually call every Sunday, you've missed three in a row.
>
> Heed knows your patterns. Not because you logged them, because it watched."

*Show: scroll Today list, hover over the overdue cards.*

> **[0:50–1:50] Ask Heed — the AI working**
>
> "When the week feels heavy, you can ask. Like — *Plan around my Singapore trip.*"

*Tap suggestion chip "Plan around my Singapore trip".*

> "Heed reads your travel context — June 5 to 9 — and your current task list. It pulls a pre-trip checklist, knows which routines to pause while you're gone, drafts a soft restart for when you get back."

*Wait for the streamed response to finish, then point at the action chips.*

> "Notice these aren't suggestions in text — they're actions. Tap one, Heed schedules it. The AI proposes; the user always confirms.
>
> Behind this: Azure OpenAI (Claude Sonnet 4.6) for reasoning, Azure AI Search for memory, Azure Functions for the agent loop. The AI sees your real task list, context windows, and history — that's how it knows about Maynilad and your Mom-on-Sunday pattern."

> **[1:50–2:30] Life tab — plans + events**
>
> "Goals and events live here. Singapore trip is an event — 26 days out, five prep tasks. Save ₱50,000 is a numeric goal — Heed tracks the progress ring, lets me log savings inline."

*Tap the savings goal, scroll the detail.*

> "And celebrations — when you finish a plan, Heed actually celebrates. Not a checkmark. A moment."

*Optional: complete a Garden Project task to trigger the celebration if it fires within scene.*

> **[2:30–3:10] Tracks — routines that bend with you**
>
> "Routines on Tracks. Morning routine: stretch, vitamins, coffee, journal. Heed shows my 14-day pattern and sees what I keep skipping.
>
> The unique part — *lighten this week*."

*Click "Lighten this week" on Morning routine.*

> "Heed says: vitamins and coffee, that's it. Skipping the rest. Why? Because looking at three previous busy weeks, those are the only two I never broke. The agent knows my actual capacity, not my aspirational one."

> **[3:10–3:50] Low Day & themes**
>
> "Some days are heavy. Heed has a Low Day mode."

*Tap Life → Events → "I'm having a low day".*

> "The whole app shifts — periwinkle palette, banner up top, routines pause automatically. No guilt, no asking why. Heed just makes space.
>
> When you feel better, it eases you back in — softly."

*Show the periwinkle theme. End it via "Feeling a bit better".*

> **[3:50–4:30] Settings & polish**
>
> "Five themes — parchment, midnight fern, inkwash, flamingo, candy. Sign-in pinned to parchment for the cold start. Animations follow a unified motion token system. Reduced-motion users get instant transitions automatically.
>
> The owl is hand-drawn SVG, mood-aware — calm, thinking, worried, speaking. It's the soul of the interface."

*Show Settings → Personalize → swap themes.*

> **[4:30–4:50] Tech stack callout + close**
>
> "Stack: Next.js 14 PWA on Azure Static Web Apps. Python Azure Functions on the Consumption plan. Cosmos DB for state, Azure AI Search for vector retrieval, Azure OpenAI for the LLM. Two agents — an Advisor that streams answers, a Memory Keeper that learns your cadences in the background.
>
> Heed is the agent that remembers what you forget. Thanks for watching."

*End on the Today screen with the owl visible.*

---

## C · System architecture

### One-line summary

Heed is a Next.js 14 PWA on Azure Static Web Apps, talking to Python Azure Functions that orchestrate two AI agents (Advisor + Memory Keeper) reading from Cosmos DB and Azure AI Search, powered by Azure OpenAI's Claude Sonnet 4.6 and Haiku 4.5.

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
│         AZURE STATIC WEB APPS  →  AZURE FUNCTIONS                │
│             (free tier)              (Consumption · Python 3.11)  │
│                                                                  │
│   /api/tasks · /api/completions · /api/context · /api/plans      │
│   /api/advisor_stream    ← streams NDJSON of agent events        │
│   /api/parse_capture     ← free-text → task or routine           │
│   /api/execute_action    ← gated mutations from agent proposals  │
│   /api/memory_keeper_run ← cron-triggered cadence learner        │
│                                                                  │
└─────┬─────────────────────────────┬──────────────────────────────┘
      │                             │
      ▼                             ▼
┌──────────────────┐         ┌──────────────────────────┐
│   COSMOS DB      │         │    AGENT LAYER (Python)   │
│   (NoSQL)        │         │                           │
│                  │         │  advisor.py               │
│  users           │         │   ├ tools/cosmos_tool     │
│  tasks           │         │   ├ tools/search_tool     │
│  completions     │         │   ├ tools/action_tools    │
│  user_context    │         │   ├ tools/safety_tool     │
│  user_state      │         │   └ tools/bing_tool       │
│  (JSON blobs:    │         │                           │
│   plans/         │         │  memory_keeper.py         │
│   routines)      │         │   (timer · every 6h)      │
│                  │         │                           │
│  partition: /user_id       │  auth.py · telemetry.py   │
└──────────────────┘         └────────────┬──────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────┐
                       │   AZURE OPENAI (AI Foundry)       │
                       │                                   │
                       │   claude-sonnet-4-6   ← advisor   │
                       │   claude-haiku-4-5    ← capture,  │
                       │                         memory    │
                       │                                   │
                       │   AZURE AI SEARCH                 │
                       │   ├ task_memory   (vector + text) │
                       │   └ ph_calendar   (cultural ground)│
                       └──────────────────────────────────┘
```

### Identity

No passwords, no sessions. Each browser stores a username + an HMAC-signed token in localStorage. Every request carries them as `X-User-ID` and `X-Auth-Token`. The backend verifies the HMAC and uses the username to scope every Cosmos read/write.

The `demo` user is open by design — judges can poke around without registering.

### The two agents

**Advisor** — streaming async generator. Tools: `get_tasks`, `get_today_view`, `get_context`, `search_tasks` (vector), and `propose_action` (the gate for any mutation). The frontend renders proposed actions as confirm buttons; only the user can accept. SSE events stream as NDJSON because the Functions Consumption plan can't do chunked HTTP — the frontend replays them word-by-word.

**Memory Keeper** — runs every 6 hours. Re-computes `learned_cadence_days` and confidence scores for tasks with ≥5 completions over ≥3 weeks. The "you call Mom every Sunday" pattern lives here.

### Demo mode

Demo flips a `heed.use-demo` flag in localStorage. While set:
- Tasks, plans, contexts, routines come from curated seeds (`TASKS_DEMO`, `DEMO_PLANS`, etc.)
- User additions persist to localStorage (`heed.demo-tasks.v1`, `heed.demo-contexts.v1`) so the demo is interactive, not read-only
- Ask Heed prepends a `[Demo-mode user state]` block describing the seed so Azure OpenAI has context to reason about (the backend Cosmos doesn't know about the demo)
- If the network fails, scripted fallbacks (`SCRIPTED_RESPONSES`, `PLAN_ADVICE_RESPONSES`) keep the experience moving

This is what makes the judge demo bulletproof — real AI, real data flow, but no dependence on the demo bucket existing in production Cosmos.

### Why these choices

| Decision | Reason |
|---|---|
| Single-file `page.jsx` (~12k lines) | Hackathon velocity; easier to grep than to navigate ten import trees |
| No TypeScript | Same; type inference doesn't pay off in 72 hours |
| Inline styles + theme proxy | Theme switches re-evaluate on every render — no FOUC |
| Static export + write-through localStorage | Offline-graceful, fast first paint, hackathon-grade resilience |
| Claude Sonnet for advisor, Haiku for capture | Sonnet for reasoning quality, Haiku for short-latency parsing |
| Anonymous auth + HMAC | Real auth is a multi-day project; this is the smallest secure thing that ships |

---

*End of submission pack.*
