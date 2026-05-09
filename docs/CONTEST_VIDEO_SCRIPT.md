# Heed — Contest Video Script

**Submission:** Microsoft CWB Hackathon 2026 — *Build your agentic personal assistant*
**Length:** 4:30 (270 seconds)
**Format:** Voice-over over screen recording. No presenter cam, no music.

This script is calibrated to the contest rubric: planning, reasoning, multi-step
action, grounding on own data **and** external sources, Azure services,
Microsoft Foundry models, multi-model comparison, and risk/safety evaluation.

A note on accuracy: every claim in this script matches what is actually in the
repository. Where a feature is scaffolded but not live (Bing runtime calls), the
script shows the **defensive code** rather than asserting a live demo.

---

## Beat 1 — The Problem (0:00 – 0:25)

**Visual:** Open on the Today tab. Hero card visible — *"Call Mom, 17 days
overdue."* Smaller cards beneath: aircon filter (80 days), unpaid bill,
morning-routine streak broken. Camera does not move.

**Voice-over:**

> Maya called her mom every Sunday for nineteen weeks. Then three Sundays in a
> row, she didn't.
>
> She's not a bad daughter. She's a freelance designer with a Singapore trip
> next week, two unpaid bills, an aircon filter that's eighty days old, and a
> brain that — like most adult brains — wasn't built to hold all of it.
>
> This is Heed. An agentic personal assistant for the things you forget.

**Pause: 1 second on the hero card.**

---

## Beat 2 — Reasoning, Not Retrieval (0:25 – 1:15)

**Visual:** Click the FAB → "Ask Heed". Click the suggestion chip *"What am I
forgetting?"*. Thinking-step row appears: `get_today_view`,
`get_active_contexts`, `search_task_memory`. Response streams in token-by-token.
Action chip appears at the end (*"Draft a message to Mom"*) with follow-up chips.

**Voice-over:**

> Heed isn't a reminder app. It's an agent that plans, reasons, and acts
> across multiple steps.
>
> Watch what happens when Maya asks what she's forgetting.

**Pause: ~7 seconds. Let the thinking steps and streaming text play. Do not
narrate over the demo.**

**Voice-over resumes:**

> Three things just happened on screen. The agent **planned** — it called three
> tools in parallel: today view, active contexts, and a semantic search across
> Maya's task memory. It **reasoned** — it didn't return a list, it prioritized.
> Bills first because there's a real disconnection risk. Then the personal
> stuff. Then the easier wins. And it **proposed an action** — a structured
> tool call to draft a message, gated behind user confirmation.
>
> That's the loop the contest is asking for. Plan, reason, act — across
> multiple steps, grounded in real data.

---

## Beat 3 — Three Agentic Behaviors (1:15 – 2:35)

**Visual sequence:**
- 1:15 — Today tab. Hover the aircon-filter card; the inferred *"every ~76
  days"* label is visible.
- 1:35 — New Ask Heed query: *"Why did I skip my morning routine this week?"*.
  Let it stream.
- 2:00 — New query: *"I have a busy week — lighten my routine."* Let the
  preview render: *Remove: Stretching, Morning journal. Keep: Vitamins,
  Coffee.* Action chip waits for confirmation.
- 2:25 — Cut to Calendar tab. Tinted band over the Singapore trip; routines
  paused inside the window.

**Voice-over:**

> Three things make Heed genuinely agentic, not just a chatbot with retrieval.
>
> **First — cadence learning.**
> Maya never told Heed her aircon filter is on a 76-day cycle. The Memory
> Keeper agent inferred it from her completion history. It runs every six
> hours over every active task. The math — interval averaging, variance,
> day-of-week distribution — runs deterministically in Python. The model's job
> is only to interpret the math into structured pattern observations and
> confidence scores. Math you trust to code, language you trust to the model.

**(Pause for the routine annotation to land.)**

> **Second — context-aware reasoning.**
> When Maya asks why she skipped her morning routine, the agent doesn't say
> *"you missed Monday and Tuesday."* It traces the cause. Late nights, late
> wake-ups, a pattern over the last eight weeks where bedtime past eleven
> predicts a missed morning. Then it proposes one specific intervention — not
> a generic suggestion.

**(Stream completes.)**

> **Third — adaptation under pressure.**
> When Maya tells Heed she has a busy week, the agent doesn't just lower the
> bar. It looks at three previous busy weeks, sees what she actually kept
> versus dropped, and proposes a lighter version grounded in her real
> behavior. The change is previewed — *remove these, keep these* — and the
> agent will not apply it until Maya confirms.

**(Cut to Calendar.)**

> The Calendar surfaces the agent's planning. The Singapore trip is shaded
> across five days. Routines pause inside the window. Tasks that fall in
> that window defer themselves until after Maya gets back. Context isn't a
> setting Maya manages — it's a thing she tells Heed about, and Heed plans
> around it.

---

## Beat 4 — Architecture and Multi-Model Foundry (2:35 – 3:30)

**Visual:** Cut to architecture diagram. Highlight each component as named.
Then briefly cut to `docs/MULTI_MODEL_COMPARISON.md` showing the comparison
table.

**Voice-over:**

> Heed runs entirely on Azure. The frontend is Next.js on Azure Static Web
> Apps. The agents are Python on Azure Functions. Cosmos DB is the source of
> truth. Azure AI Search holds two indexes — the user's task memory with vector
> embeddings, and a curated Philippine calendar of holidays, payday cycles, and
> bill cycles. Every secret lives in Azure Key Vault. Nothing in code.
>
> Two agents, two models, deployed through Microsoft Foundry on Azure OpenAI.
>
> The **Advisor** runs on **GPT-4o**, because user-facing reasoning needs the
> larger model for multi-step planning and pattern synthesis.
>
> The **Memory Keeper** runs on **GPT-4o-mini**, because cadence interpretation
> is structured-output work over deterministic math — and at four runs per day
> per task, cost discipline matters. We benchmarked both models head-to-head:
> GPT-4o-mini was sixteen times cheaper, two-and-a-half times faster, and
> produced equivalent flags. We documented that comparison openly in the repo.
>
> One detail worth noting on the agent loop: we evaluated Microsoft Agent
> Framework, but its streaming ChatAgent wasn't stable enough for our
> async-generator SSE pattern at build time. We ship a transparent
> hand-rolled OpenAI tool-calling loop instead — eighty lines of Python, full
> control over every event the frontend renders.

---

## Beat 5 — Safety, Honestly (3:30 – 4:15)

**Visual:**
- 3:30 — Cut to `docs/SAFETY.md`. Scroll to the threat model table, then to
  the 12-scenario evaluation table. Linger on the three partial-pass rows.
- 4:00 — Cut to `agents/tools/bing_tool.py`. Highlight `SANITIZER_SYSTEM_PROMPT`
  and the comment *"Bing results are NEVER passed raw to the Advisor."*

**Voice-over:**

> Heed handles real personal data, so safety isn't a checkbox.
>
> We model two crossings as untrusted: user input and any external web result.
> Retrieved task text is wrapped in tagged context the model treats as data,
> not instructions. Every state-changing action is a structured tool call,
> validated server-side before execution. Azure AI Content Safety runs on
> input and output. And — the part most teams skip — we ran twelve adversarial
> scenarios manually. Nine passed cleanly. Three showed quality-of-care gaps
> we documented openly in `SAFETY.md` rather than hiding.
>
> The non-obvious choice: external search results never reach the Advisor
> raw. They go through a smaller-model sanitizer first that strips anything
> resembling instructions and emits structured JSON. That defends against
> indirect prompt injection — the failure mode that's already broken real
> production agents.

**(Cut back to Today tab.)**

> Heed plans. Heed reasons. Heed acts — and only after you confirm.
>
> The agents are built. The cadences learn. The schedule adapts around real
> life. And the gaps we know about — multi-tenant auth, Bayesian confidence,
> structured agent tracing — are listed openly in the README, not hidden.
>
> What's here is real. And it does what it claims.

**Hold the final frame for 2 seconds. End.**

---

## Production Notes

### Voice direction

- Conversational, not announcer.
- Slight downward inflection on the conclusion of each beat for confidence.
- Pause after each demo moment lands. The streaming agent text **is** the
  demonstration — do not narrate over it.
- ~155 words per minute. The script lands at approximately 4:15 of speech;
  the remaining seconds are intentional pauses.

### Key delivery moments

- **"She didn't."** (0:13) — slow down, let it land.
- **"Plan, reason, act — across multiple steps, grounded in real data."**
  (~1:10) — pause before this line. This is the contest-rubric anchor.
- **"Math you trust to code, language you trust to the model."** (~1:35) —
  staccato. This is the differentiator quote.
- **"Heed" pronunciation:** single syllable, rhymes with "seed."
- **"Plans. Reasons. Acts."** in the close — staccato, not softened.

### Pre-recording checklist

Before recording the screen capture:

- Demo data state: overdue items present, Singapore trip dated next week,
  routine completion grids visible, aircon filter showing the inferred 76-day
  cadence.
- Browser zoom at 100%, dev tools closed, system Do Not Disturb on.
- Run the silent dry-run of the full demo path twice before the take.
- Test audio levels at speaking volume; record one backup audio take.
- Make sure the model-comparison file shows GPT-4o / GPT-4o-mini consistently
  before screen-capture (the repository currently has a stale `gpt-5.4`
  draft in `MULTI_MODEL_COMPARISON.md` — fix or do not show that file
  on screen).

### Word counts (per beat, approximate)

| Beat | Words | Time on screen |
|---|---|---|
| 1 — Problem | 60 | 0:25 |
| 2 — Reasoning demo | 85 + 7s silence | 0:50 |
| 3 — Three agentic behaviors | 290 | 1:20 |
| 4 — Architecture + multi-model | 200 | 0:55 |
| 5 — Safety + close | 180 | 0:45 |
| **Total** | **~815 spoken** | **~4:15** |

### Things deliberately not in this script

- No "thanks for watching" outro.
- No background music.
- No claim that the build uses Microsoft Agent Framework — it doesn't, and
  asserting otherwise on a recorded submission is worse than skipping the
  bonus.
- No live Bing demo — the sanitizer is a defensive pattern shown in code,
  not a runtime call.
- No exposed keys, no PII, no real names. The persona "Maya" and all data
  are synthetic, per the contest rules.
