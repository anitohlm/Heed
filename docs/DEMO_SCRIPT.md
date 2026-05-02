# Heed — Demo Video Script

**Length:** 4:00 (240 seconds)
**Format:** Voice-over only. Screen recording as visual.

This document contains the spoken script in five beats, plus production notes for recording.

---

## Beat 1 — The Hook (0:00 – 0:25)

**Visual:** Open on the Today tab. Hero card visible — "Call Mom, 17 days overdue." Camera does not move.

**Voice-over:**

> Maya called her mom every Sunday for nineteen weeks. Then three Sundays in a row, she didn't.
>
> She's not a bad daughter. She's a freelance designer with a chaotic schedule, two unpaid bills, an aircon filter that's eighty days old, and a brain that — like most adult brains — wasn't built to hold all of it.
>
> This is Heed. The agent that remembers what you forget.

**Pause: 1 second of silence on the hero card.**

---

## Beat 2 — The Product (0:25 – 1:00)

**Visual:** Click the FAB. Speed dial appears. Click "Ask Heed." Inline modal opens. Click the "What am I forgetting?" suggestion chip. Thinking steps appear. Response streams in.

**Voice-over:**

> Heed isn't a reminder app. It's an agent. You ask it questions in plain language, and it reasons across your tasks, your routines, your context, and your patterns to answer.
>
> Watch what happens when Maya asks what she's forgetting.

**Pause: ~7 seconds of silence while the agent thinks and the response streams. The streaming text is the demonstration.**

**Voice-over resumes:**

> The agent didn't return a list. It prioritized — bills first because there's a real disconnection risk, then the personal stuff, then the easier wins. It noticed the pattern break on Mom and offered to draft a message or change the cadence. And it tied everything back to a Singapore trip Maya has next week.
>
> That's not retrieval. That's reasoning.

---

## Beat 3 — Agentic Behavior (1:00 – 2:30)

**Visual sequence:**
- 1:00 — Today tab. Scroll to routine cards. Hover the "Morning routine" card.
- 1:25 — Click into Ask Heed. Click "Why did I skip my morning routine this week?" Let it stream.
- 1:55 — Open new chat. Click "I have a busy week — lighten my routine." Let it stream.
- 2:20 — Brief glance at the Calendar tab — Singapore trip tinted band, routines paused inside it.

**Voice-over:**

> Three things make Heed genuinely agentic, not just a chatbot with retrieval.
>
> **First — cadence learning.**
> The aircon filter on Maya's task list says "every seventy-six days." She didn't set that. The agent inferred it from five completion records over the past year. Each task has a confidence score the agent updates in the background — based on how much data it has, how regular the intervals are, how recent the activity is. The math runs every six hours on a smaller, cheaper model.

**(Show the routine card with the agent's annotation. Brief pause.)**

> **Second — context-aware reasoning.**
> When Maya asks why she skipped her morning routine, Heed doesn't say "you skipped Monday and Tuesday." It traces the cause — late nights, late wake-ups, a pattern over eight weeks where bedtime past eleven predicts a missed morning. Then it proposes a specific intervention.

**(Show the streaming response.)**

> **Third — adaptation under pressure.**
> When Maya tells Heed she has a busy week, the agent looks at three previous busy weeks, sees what she actually kept versus dropped, and proposes a lighter version of her routine grounded in her real behavior. Not a generic "do less." A specific reduction that matches her actual patterns.

**(Show the streaming response. Cut to Calendar.)**

> The Calendar makes the agent's work visible. The Singapore trip is shaded across those five days. Routines automatically pause inside the window. Tasks defer themselves to after Maya gets back.

---

## Beat 4 — Architecture (2:30 – 3:15)

**Visual:** Cut to architecture diagram, full-screen.

**Voice-over:**

> Heed runs on Azure end to end.
>
> The frontend is Next.js on Azure Static Web Apps. The agents are Python, on Azure Functions, built with Microsoft Agent Framework. There are two agents — an Advisor running on GPT-4o for user-facing reasoning, and a Memory Keeper running on the smaller GPT-4o-mini, doing cadence inference autonomously every six hours.
>
> Why two models? Reasoning quality versus cost. The Advisor needs the bigger model to handle multi-step planning. The Memory Keeper does deterministic math interpretation — perfect work for a smaller model running cheaply at scale.
>
> Grounding comes from two sources. Azure AI Search holds the user's task memory and a curated Philippine calendar — holidays, payday cycles, bill cycles. Bing fills in anything the index doesn't cover, but never reaches the Advisor raw — every Bing response goes through a sanitizer first. More on that in a second.
>
> Cosmos DB is the source of truth. All secrets live in Key Vault. None are in code.

---

## Beat 5 — Safety and Close (3:15 – 4:00)

**Visual:**
- 3:15 — Cut to SAFETY.md open in a viewer. Scroll to the eval table.
- 3:35 — Cut to the bing_tool.py file. Briefly show the SANITIZER_SYSTEM_PROMPT block.
- 3:50 — Cut back to the Today tab, full app visible.

**Voice-over:**

> Heed handles real personal data, so safety isn't optional.
>
> We model the user input and Bing results as untrusted sources. Retrieved task text is wrapped in tagged context the model treats as data, not instructions. Every agent action is a structured tool call validated before execution. Azure AI Content Safety runs on input and output. And — the part most teams skip — we tested twelve adversarial scenarios manually. Nine passed cleanly. Three showed quality-of-care gaps we documented openly in SAFETY.md.

**Brief pause.**

> The single non-obvious choice: Bing search results never reach the main agent. They go through a smaller-model sanitizer first that strips anything looking like instructions. That defends against indirect prompt injection — the failure mode that's already broken real production agents.

**Cut back to Today tab.**

> Heed is built. The agents reason. The cadences learn. The schedule adapts. There's a roadmap of things we deliberately didn't ship — multi-tenant auth, Bayesian cadence, structured agent tracing — listed openly in the README.
>
> But what's here is real. And it does what it claims.

**Hold the final frame for 2 seconds. End.**

---

## Production Notes

### Voice direction throughout

- Conversational, not announcer.
- Slight downward inflection at the end of important sentences for confidence.
- Pause after each demo moment lands. The streaming agent text is the demonstration.
- Speak at approximately 155 words per minute.

### Key delivery moments

- **Opening sentence (0:00):** Slow down. Make sure "she didn't" lands.
- **"That's not retrieval. That's reasoning." (~0:55):** Pause before this line.
- **"Heed" pronunciation:** single syllable, rhymes with "seed."
- **The 7-second silence in Beat 2:** non-negotiable. Do not narrate over the streaming response.
- **"First — cadence learning" / "Second — context-aware reasoning" / "Third — adaptation under pressure":** say each header slightly slower than surrounding sentences.
- **Closing four sentences:** *"Heed is built. The agents reason. The cadences learn. The schedule adapts."* Staccato, not softened.

### Recording approach

- Record audio first against a stopwatch; record screen capture afterwards, performing actions in time with the audio.
- Re-record audio in chunks if a section flubs — splice cleanly between beats.
- USB mic or AirPods Pro recommended over laptop mic.

### Word count and timing

- Beat 1: ~52 words → 25s with pause
- Beat 2: ~95 words + 7s silence → 35s
- Beat 3: ~225 words + visual transitions → 90s
- Beat 4: ~145 words → 45s
- Beat 5: ~140 words + pauses + outro → 45s
- Total spoken: ~657 words at 155 wpm = 4:14 of speech, lands at ~4:00 with natural pauses

### Pre-recording checklist

- Prototype state matches script (overdue items present, Singapore trip in the future, routine completion grids visible)
- Browser zoom 100%, dev tools closed, notifications disabled
- System Do Not Disturb enabled
- One full silent dry run of the screen capture
- Audio levels tested at speaking volume
- One backup take of audio before the "real" take

### What not to add

- No "thanks for watching" outro
- No background music
- No on-screen presenter cam in the corner
