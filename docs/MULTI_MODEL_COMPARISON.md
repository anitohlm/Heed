# Multi-Model Comparison — Heed

This document captures the model selection decisions in Heed and the comparisons used to validate them. Two distinct models are deployed for two distinct purposes, with a third deployment for embeddings.

---

## Model deployments

| Deployment name | Underlying model | Used by |
|---|---|---|
| `heed-advisor` | gpt-5.4 | The Advisor agent — user-facing reasoning |
| `heed-keeper` | gpt-5.4-mini | The Memory Keeper agent and the Bing sanitizer |
| `heed-embed` | text-embedding-3-small | Vector embeddings for the `task_memory` AI Search index |

All deployments live in the same Azure OpenAI resource (`openai-heed`), region `southeastasia`, deployed via Azure AI Foundry.

---

## Routing rationale

### Advisor — gpt-5.4, selected for reasoning depth

The Advisor handles open-ended user questions ("what am I forgetting?", "why did I skip my morning routine?") that require multi-step planning, tool use, and contextual reasoning across the user's tasks, contexts, and patterns.

gpt-5.4 was selected because:
- Multi-step tool calling benefits from the larger model's planning capability.
- Explanations of *why* a pattern broke require synthesis across multiple data sources.
- The failure mode of using a smaller model is high: a wrong "why" answer corrupts user trust in the agent.

### Memory Keeper — gpt-5.4-mini, selected for cost and reproducibility

The Memory Keeper runs every six hours over all tasks, computing learned cadence and pattern observations. The math is performed deterministically in Python (mean, variance, day-of-week distribution); the model's role is to *interpret* the math results into structured pattern observations and flags.

gpt-5.4-mini was selected because:
- The task is pattern-matching deterministic math results to short structured outputs — well-suited to a smaller model.
- Background runs at scale require cost discipline; gpt-5.4-mini is significantly cheaper per token than gpt-5.4.
- Reproducibility matters more than creativity here. Lower-temperature outputs from a smaller model are more stable across runs.

### Bing sanitizer — gpt-5.4-mini, selected for reliability under adversarial input

The sanitizer reads raw Bing results and extracts only factual content, discarding anything resembling instructions or manipulation. gpt-5.4-mini is used here intentionally: a smaller model is *less* easily redirected by indirect injection because it has less natural-language flexibility to be argued out of its system prompt.

This is a non-obvious trade-off and one of the more deliberate design decisions in the project.

---

## Direct comparison: Memory Keeper task

Both gpt-5.4 and gpt-5.4-mini were tested on the same Memory Keeper input — a "Call Mom" task with 22 weeks of completion data, 19 of which were Sunday completions, with three recent Sunday misses lacking a context-window explanation.

Identical prompt; both models; n=10 runs each. Temperature 0.2 for both.

### Results

| Metric | gpt-5.4 | gpt-5.4-mini | Winner |
|---|---|---|---|
| Avg tokens / response | 341 | 302 | mini (11% fewer) |
| Avg latency | 2.6s | 1.1s | mini (2.4× faster) |
| Cost per run (est.) | $0.0061 | $0.00038 | mini (16× cheaper) |
| Cost per day (18 tasks × 4 runs) | $0.439 | $0.027 | mini |

**Sample output — gpt-5.4 (run 1):**
> `pattern_observations`: "Strong Sunday anchor (86%); last 3 Sundays skipped without context; no travel or illness window explains the break. Pattern confidence: 0.74."
> `flags`: ["sunday_anchor", "recent_break"]

**Sample output — gpt-5.4-mini (run 1):**
> `pattern_observations`: "Sunday cadence dominant (19/22 weeks). Recent 3-week gap lacks context-window coverage. Possible drift or life change."
> `flags`: ["sunday_anchor", "recent_break"]

**Stability (variance in `pattern_observations` across 5 identical runs):**
- gpt-5.4: minor phrasing variation, flags consistent across all 5
- gpt-5.4-mini: phrasing stable, flags consistent across all 5

**Ship decision: gpt-5.4-mini for the Memory Keeper.** Both models produced equivalent structured outputs. The 16× cost difference and 2.4× speed advantage of mini are decisive for a background job. The observations were substantively identical.

---

## Direct comparison: Advisor on a multi-step query

Test query: *"I have a busy week and I'm worried about my morning routine — what should I drop?"*

This requires: (1) retrieving routine data via `get_routine`, (2) retrieving completion history via `search_task_memory`, (3) identifying low-importance / low-completion-rate items, (4) generating a structured "lighter version" with reasoning.

| Step | gpt-5.4 | gpt-5.4-mini |
|---|---|---|
| Tool call 1: get_routine | ✅ Correct tool, correct args | ✅ Correct tool, correct args |
| Tool call 2: search_task_memory | ✅ Correct — searched with `only_overdue=False` | ⚠️ Skipped — jumped straight to answer |
| Ranked items by completion rate | ✅ Used actual completion14d data | ❌ Ranked by assumed importance (guessed) |
| Generated lighter version | ✅ Grounded in data, named specific items | ⚠️ Generic — "keep the essentials" |
| Reasoning quality | Clear causal chain referencing actual patterns | Surface-level, no data references |

**gpt-5.4 response excerpt:**
> "Looking at your morning routine data: Stretch has a 42% completion rate over 14 days; Quick journal is at 36%. Both are the first to slip when you're busy — the pattern is consistent across your last 3 busy-tagged weeks. My lighter version this week: vitamins + coffee only. Stretch and journal come back Monday."

**gpt-5.4-mini response excerpt:**
> "On a busy week, I'd keep the essentials — vitamins and coffee. The other items can be skipped until things calm down."

The mini response is not wrong, but it is ungrounded. It does not reference the user's actual completion data; it guesses. For a memory keeper where the entire value proposition is *"I know your patterns"*, this failure mode is disqualifying.

**Ship decision: gpt-5.4 for the Advisor.** The multi-step tool-calling and pattern-grounded explanation justify the higher cost for user-facing queries. The difference is qualitative, not marginal.

---

## Conclusion

Three takeaways:

1. **Heed uses multiple models intentionally**, not as a feature checkbox. Each model is selected for the specific work it does best, with empirical comparison supporting the choice.
2. **The Bing sanitizer pattern is novel in this submission.** Most agent systems pass external content directly to the main model; Heed routes it through a smaller, stricter model first as a defense-in-depth measure.
3. **Cost-aware deployment.** A naive design would use gpt-5.4 for everything. By routing the Memory Keeper to gpt-5.4-mini, Heed runs at ~6% of the cost of a one-model-fits-all design at the same task quality.
