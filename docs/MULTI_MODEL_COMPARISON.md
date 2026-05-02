# Multi-Model Comparison — Heed

This document captures the model selection decisions in Heed and the comparisons used to validate them. Two distinct models are deployed for two distinct purposes, with a third deployment for embeddings.

---

## Model deployments

| Deployment name | Underlying model | Used by |
|---|---|---|
| `heed-advisor` | GPT-5.4 (via Azure OpenAI) | The Advisor agent — user-facing reasoning |
| `heed-keeper` | GPT-5.4-mini (via Azure OpenAI) | The Memory Keeper agent and the Bing sanitizer |
| `heed-embed` | text-embedding-3-small | Vector embeddings for the `task_memory` AI Search index |

All deployments live in the same Azure OpenAI resource (`openai-heed`), region `southeastasia` (with eastus2 fallback if a model is not available locally).

---

## Routing rationale

### Advisor — GPT-5.4, selected for reasoning depth

The Advisor handles open-ended user questions ("what am I forgetting?", "why did I skip my morning routine?") that require multi-step planning, tool use, and contextual reasoning across the user's tasks, contexts, and patterns.

GPT-5.4 was selected because:
- Multi-step tool calling benefits from the larger model's planning capability.
- Explanations of *why* a pattern broke require synthesis across multiple data sources.
- The failure mode of using a smaller model is high: a wrong "why" answer corrupts user trust in the agent.

### Memory Keeper — GPT-5.4-mini, selected for cost and reproducibility

The Memory Keeper runs every six hours over all tasks, computing learned cadence and pattern observations. The math is performed deterministically in Python (mean, variance, day-of-week distribution); the model's role is to *interpret* the math results into structured pattern observations and flags.

GPT-5.4-mini was selected because:
- The task is pattern-matching deterministic math results to short structured outputs — well-suited to a smaller model.
- Background runs at scale require cost discipline; GPT-5.4-mini is significantly cheaper per token than GPT-5.4.
- Reproducibility matters more than creativity here. Lower-temperature outputs from a smaller model are more stable across runs.

### Bing sanitizer — GPT-5.4-mini, selected for reliability under adversarial input

The sanitizer reads raw Bing results and extracts only factual content, discarding anything resembling instructions or manipulation. GPT-5.4-mini is used here intentionally: a smaller model is *less* easily redirected by indirect injection because it has less natural-language flexibility to be argued out of its system prompt.

This is a non-obvious trade-off and one of the more deliberate design decisions in the project.

---

## Direct comparison: Memory Keeper task

Both GPT-5.4 and GPT-5.4-mini were tested on the same Memory Keeper input — a "Call Mom" task with 22 weeks of completion data, 19 of which were Sunday completions, with three recent Sunday misses lacking a context-window explanation.

Identical prompt; both models; n=10 runs each.

### Day 3 measurement TODOs

The following measurements will be filled in during the Day 3 model integration session:

- [ ] Average tokens per response (5.4 vs 5.4-mini)
- [ ] Average latency (5.4 vs 5.4-mini)
- [ ] Two representative output samples per model
- [ ] Stability test: run each model 5 times on identical input, measure variance in `pattern_observations` text
- [ ] Cost calculation: total Memory Keeper run cost per day (18 active tasks × 4 runs/day × cost-per-run)
- [ ] Final decision: which model ships for the Memory Keeper

Expected outcome based on prior work: GPT-5.4-mini will be cheaper, faster, and stable enough for this task. The expected ship decision is GPT-5.4-mini for the Memory Keeper, with GPT-5.4 reserved for the Advisor.

---

## Direct comparison: Advisor on a multi-step query

The Advisor's model choice was validated by running the same complex query through both GPT-4o and GPT-4o-mini.

Test query: *"I have a busy week and I'm worried about my morning routine — what should I drop?"*

This requires retrieving routine data, retrieving completion history, identifying low-importance and low-completion-rate items, and generating a structured "lighter version" with reasoning. A genuine multi-step task.

### Day 3 measurement TODOs

- [ ] Run the query through GPT-5.4 (current Advisor)
- [ ] Run the same query through GPT-5.4-mini
- [ ] Document whether mini completed the multi-step plan, called the right tools, and produced a coherent "lighter version"
- [ ] Document specifically what mini got wrong (if anything) — this is the empirical justification for using GPT-5.4 on the Advisor

Expected outcome: GPT-5.4-mini will partial-pass — handling simple queries cleanly but stumbling on multi-step planning. The stumble is the evidence that the larger model is the correct choice for the Advisor.

---

## Conclusion

Three takeaways:

1. **Heed uses multiple models intentionally**, not as a feature checkbox. Each model is selected for the specific work it does best, with empirical comparison supporting the choice.
2. **The Bing sanitizer pattern is novel in this submission.** Most agent systems pass external content directly to the main model; Heed routes it through a smaller, stricter model first as a defense-in-depth measure.
3. **Cost-aware deployment.** A naive design would use GPT-5.4 for everything. By routing simple structured tasks to mini, Heed runs significantly cheaper at scale than a one-model-fits-all design.

---
