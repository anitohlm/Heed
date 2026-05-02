# Heed — Business Plan

**Tagline:** *Pay attention to the things you'd otherwise forget.*

---

## 1. The Problem

Adults running full lives are drowning in small recurring responsibilities that don't fit a calendar and don't fit a to-do list. This problem is universal. I'm building Heed where it's most acute and least served first — the Philippines — and expanding from there.

In the PH context, the texture is local: paying Meralco before the cutoff, refilling the water dispenser before it runs out, following up with a supplier last messaged three weeks ago, calling Tita on her birthday, changing the aircon filter every few months, renewing your driver's license before expiry. The structural problem is global.

Calendar apps assume you know *when* something needs to happen. Reminder apps assume you know *what* needs to happen. Existing tools fail when the timing depends on patterns the user hasn't articulated, when the person is too overwhelmed to set up the system, or when context shifts (travel, illness, deadline weeks) and the schedule doesn't adapt.

The result is a constant low-grade dread: *what am I forgetting?* Heed is built to answer that question.

---

## 2. The Solution

Heed is an agentic personal assistant that learns the user's life and surfaces what matters when it matters. Four core agentic behaviors:

1. **Cadence learning.** The agent infers task intervals from completion history. Tasks don't need to be configured with rigid recurrence rules; over five completions and three weeks of activity, the agent develops a confidence-scored model of how often each task actually happens.

2. **Smart misses.** When a task is skipped, the user can attach a reason — *still fine*, *not applicable*, *forgot*, *too busy*. The agent uses these reasons to interpret the skip rather than treating it as a failure.

3. **Context awareness.** Travel, illness, and busy weeks reshape the schedule. The agent shifts due dates, lightens routines, and explains what it changed and why.

4. **"What am I forgetting?"** Open-ended chat with the agent, grounded in the user's actual data. The agent prioritizes by urgency and importance, not chronology.

---

## 3. Target Users

**Primary segment (build for first):** Filipinos in NCR with high mental load — working professionals, founders, parents, caregivers. Smartphone-first, Taglish-comfortable, 25-45 years old. Already use 2-3 productivity apps but find them either too rigid or too empty.

**Secondary segment:** Filipinos with executive function challenges (ADHD, anxiety, post-burnout recovery). The neurodivergent angle is explicit — Heed is built for brains that don't fit standard productivity-app assumptions.

**Tertiary (later):** Indonesia and Vietnam — similar mental-load profile, similar smartphone-first penetration.

---

## 4. Why This, Why Now

The Philippines has 64M smartphone users and one of the highest social media engagement rates in the world. Productivity-app penetration in the local market is dominated by US-built tools that don't understand Taglish, GCash, jeepney-life context, or Filipino family dynamics. The opening for a locally-built, agentic, culturally-aware product is real.

The technology is also newly possible. Agentic patterns — tool use, multi-step planning, autonomous background updates — became reliable in 2024-2025. A product like Heed wasn't buildable two years ago.

---

## 5. Differentiation

Existing tools and where they fall short for this user:

| Tool | Strength | Where it fails for this user |
|---|---|---|
| Todoist | Robust task management | Rigid, no learning, no PH context |
| TickTick | Habit + task in one app | Generic, not agentic, doesn't adapt to life |
| Routinery | ADHD-focused routines | Routines only, no broader task layer |
| Tiimo | Visual schedule for ND users | Calendar-shaped, no inference |
| Apple/Google Reminders | Free, native | Pure recall, no judgment |

Heed's defensible position:
- **Cadence learning** that's grounded in actual user behavior, not declared rules
- **Filipino cultural context** — Taglish input, GCash integration, PH calendar grounding
- **Agentic adaptation** rather than passive reminders
- **Trust-first product design** — the agent never nags or shames, even when patterns break

---

## 6. Monetization

**Free tier:** Up to 25 active tasks, 2 routines, 30-day completion history.

**Premium tier:** ₱149/month or ₱1,499/year. Unlimited tasks and routines, full history, advanced agent features (deeper pattern analysis, multi-month planning, calendar export).

**Founder estimate** of conversion at 3-5% based on comparable PH-market apps in the productivity and wellness category. Pricing aligned to Spotify PH (₱149/month) — the local benchmark for what consumers will pay for a useful subscription.

No ads. Ever. Heed handles personal data; ad-targeting is incompatible with that trust.

---

## 7. Go-To-Market

1. **Phase 1 (now–mid-2026):** Ship the hackathon submission as v0. Recruit 50 beta users from the founder's network and PH ADHD/productivity communities.
2. **Phase 2 (late 2026):** Public beta launch on iOS + Android. Founder-led content on LinkedIn and TikTok using the "building in public" playbook. Micro-influencer trades (free Premium for honest review).
3. **Phase 3 (2027):** Paid acquisition on Facebook/Instagram targeting PH ADHD community, working parents, productivity enthusiasts. TikTok organic with short Taglish demo videos.
4. **Phase 4 (2027–2028):** Expand to Indonesia and Vietnam — Bahasa and Vietnamese localization is the hard part; the agentic architecture transfers cleanly.

---

## 8. Roadmap (12 months)

**Month 1-2:** Hackathon v0 → private beta. Validate core cadence learning loop.
**Month 3-4:** Public beta. iOS + Android native shells around the existing Next.js app.
**Month 5-6:** Premium tier launch. GCash recurring billing.
**Month 7-9:** Multi-tenant infrastructure (auth, data isolation, rate limiting). Bayesian cadence model replacing the heuristic v0.
**Month 10-12:** Bahasa beta. Indonesia GTM begins.

---

## 9. Founder Background

I'm a Filipina founder building AI-powered products for the Philippine market. Heed is a personal itch (*"I'm not good at memory"*) plus a market I already understand. Infrastructure learnings from prior products — Xendit, Supabase patterns, Filipino consumer UX — transfer directly.

---

## 10. The Ask

Heed is currently being built as a Microsoft AI hackathon submission. Post-hackathon, the goal is to validate the v0 with 50 beta users over 8 weeks before deciding on the path forward — bootstrap, angel round, or accelerator.
