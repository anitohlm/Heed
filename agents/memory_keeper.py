"""
Memory Keeper agent.

Runs every 6 hours via timer-triggered Function. For each active task,
analyzes completion history and writes back learned_cadence_days,
learned_confidence, and pattern observations.

Uses GPT-4o-mini for cost. The math (interval averaging, variance) is done
in Python, not by the model — the model's job is to interpret the math
and produce structured pattern observations and flags.

See agents/prompts/memory_keeper_system.md for the full system prompt.
"""

import os
import json
import logging
import statistics
from pathlib import Path
from datetime import datetime, timezone, timedelta
from openai import AzureOpenAI

_log = logging.getLogger("heed")
from agents.models import Task, Completion, CadenceUpdate, UserContext
from agents.tools.cosmos_tool import (
    get_active_tasks,
    get_completions,
    get_active_contexts,
    get_past_contexts,
    _get_database,
)


# -----------------------------------------------------------------------------
# Prompt loading — read the markdown file at startup
# -----------------------------------------------------------------------------

_PROMPT_PATH = Path(__file__).parent / "prompts" / "memory_keeper_system.md"


def _load_system_prompt() -> str:
    """Read the system prompt from disk. Cached at module import."""
    return _PROMPT_PATH.read_text(encoding="utf-8")


SYSTEM_PROMPT = _load_system_prompt()


# -----------------------------------------------------------------------------
# Math layer — deterministic, runs in Python
# -----------------------------------------------------------------------------

# Thresholds match data spec section 7
MIN_COMPLETIONS = 5
MIN_DAYS_OF_HISTORY = 21


def _compute_intervals(completions: list[Completion]) -> list[float]:
    """Return the day intervals between consecutive 'done' completions."""
    done = sorted(
        [c for c in completions if c.event_type == "done"],
        key=lambda c: c.completed_at,
    )
    if len(done) < 2:
        return []
    return [
        (done[i + 1].completed_at - done[i].completed_at).total_seconds() / 86400
        for i in range(len(done) - 1)
    ]


def _compute_cadence_stats(completions: list[Completion]) -> dict:
    """
    Compute the deterministic cadence math. The model never does this part.

    Returns dict with keys: count, mean_days, stdev_days, coefficient_of_variation,
    span_days, latest_completion_at. Or {"insufficient": True, "reason": "..."}.
    """
    done = [c for c in completions if c.event_type == "done"]
    if len(done) < MIN_COMPLETIONS:
        return {
            "insufficient": True,
            "reason": f"only {len(done)} completion(s), need {MIN_COMPLETIONS}",
        }

    sorted_done = sorted(done, key=lambda c: c.completed_at)
    span_days = (sorted_done[-1].completed_at - sorted_done[0].completed_at).days
    if span_days < MIN_DAYS_OF_HISTORY:
        return {
            "insufficient": True,
            "reason": f"only {span_days} days of history, need {MIN_DAYS_OF_HISTORY}",
        }

    intervals = _compute_intervals(completions)
    mean_days = statistics.mean(intervals)
    stdev_days = statistics.stdev(intervals) if len(intervals) > 1 else 0.0
    cv = stdev_days / mean_days if mean_days > 0 else 0.0

    return {
        "insufficient": False,
        "count": len(done),
        "mean_days": round(mean_days, 1),
        "stdev_days": round(stdev_days, 2),
        "coefficient_of_variation": round(cv, 3),
        "span_days": span_days,
        "latest_completion_at": sorted_done[-1].completed_at.isoformat(),
    }


def _compute_confidence(stats: dict) -> float:
    """
    Map cadence stats to a confidence in [0.30, 0.95].

    Per memory_keeper_system.md:
      - More completions → higher confidence (capped at 0.95)
      - High variance (CV > 0.5) → reduce by 0.2
      - Linear interpolation between count thresholds
    """
    n = stats["count"]
    if n >= 20:
        base = 0.95
    elif n >= 5:
        # Linear from 0.30 at n=5 to 0.95 at n=20
        base = 0.30 + (n - 5) * (0.95 - 0.30) / 15
    else:
        return 0.0  # shouldn't reach here, but defensive

    if stats["coefficient_of_variation"] > 0.5:
        base -= 0.2

    return round(max(0.0, min(0.95, base)), 2)


def _detect_day_of_week_pattern(completions: list[Completion]) -> str | None:
    """
    If 80%+ of done completions land on the same weekday, return a description.
    Else return None.
    """
    done = [c for c in completions if c.event_type == "done"]
    if len(done) < 5:
        return None

    weekdays = [c.completed_at.weekday() for c in done]
    most_common_day = max(set(weekdays), key=weekdays.count)
    pct = weekdays.count(most_common_day) / len(weekdays)
    if pct < 0.80:
        return None

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return f"{int(pct * 100)}% of completions land on {day_names[most_common_day]}"


def _detect_pattern_break(
    task: Task,
    completions: list[Completion],
    contexts: list[UserContext],
) -> bool:
    """
    Pattern break = the last 3+ scheduled occurrences are all missed,
    AND those missed occurrences are NOT inside a context window.
    """
    cadence = task.explicit_cadence_days or task.learned_cadence_days
    if not cadence or not task.last_done_at:
        return False

    now = datetime.now(timezone.utc)
    expected_misses = 0
    expected_at = task.last_done_at + timedelta(days=cadence)

    while expected_at < now:
        # Was there a context window covering this date?
        explained = any(
            ctx.start_date <= expected_at.date() <= ctx.end_date
            for ctx in contexts
        )
        if not explained:
            expected_misses += 1
        expected_at += timedelta(days=cadence)

    return expected_misses >= 3


# -----------------------------------------------------------------------------
# Model layer — interprets the math, produces pattern_observations
# -----------------------------------------------------------------------------

def _client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_KEY"],
        api_version="2024-08-01-preview",
    )


def _call_model_for_observations(
    task: Task,
    stats: dict,
    dow_pattern: str | None,
    pattern_break: bool,
) -> CadenceUpdate:
    """
    Build the user message describing the math, ask the model for structured
    pattern observations + flags. Model returns JSON conforming to CadenceUpdate.
    """
    deployment = os.environ.get("OPENAI_DEPLOYMENT_KEEPER", "heed-keeper")
    client = _client()

    user_message = json.dumps({
        "task": {
            "id": task.id,
            "name": task.name,
            "category": task.category,
            "importance": task.importance,
            "explicit_cadence_days": task.explicit_cadence_days,
        },
        "stats": stats,
        "day_of_week_pattern": dow_pattern,
        "has_pattern_break": pattern_break,
    }, ensure_ascii=False)

    # Microsoft Agent Framework / Semantic Kernel integration was deferred.
    # The hand-rolled loop here is exercised by the test suite and the math
    # layer (above) does the load-bearing work — the model is only asked to
    # interpret pre-computed stats. Wrapping in SK adds a dependency surface
    # without changing behaviour. Revisit when the framework offers
    # something we can't do here (e.g. cross-agent message passing).
    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    raw = json.loads(response.choices[0].message.content)
    # Validate via Pydantic to enforce the schema in the system prompt
    return CadenceUpdate(**raw)


# -----------------------------------------------------------------------------
# Orchestration
# -----------------------------------------------------------------------------

def process_task(task: Task, user_id: str) -> CadenceUpdate:
    """Process a single task: math first, then model interpretation."""
    completions = get_completions(task.id, user_id)
    # Pattern-break detection needs to know whether a missed slot fell inside
    # any context window — including ones that ended recently.
    contexts = get_active_contexts(user_id) + get_past_contexts(user_id, days_back=90)
    stats = _compute_cadence_stats(completions)

    if stats.get("insufficient"):
        return CadenceUpdate(
            task_id=task.id,
            learned_cadence_days=None,
            learned_confidence=None,
            pattern_observations=[stats["reason"]],
            flags=["likely_forgotten"] if len(completions) <= 1 else [],
            reason="insufficient data",
        )

    dow_pattern = _detect_day_of_week_pattern(completions)
    pattern_break = _detect_pattern_break(task, completions, contexts)

    return _call_model_for_observations(task, stats, dow_pattern, pattern_break)


def run_for_user(user_id: str) -> list[CadenceUpdate]:
    """Process all active tasks for a user. Called by the timer Function."""
    tasks = get_active_tasks(user_id)
    updates = []
    for task in tasks:
        try:
            update = process_task(task, user_id)
            updates.append(update)
            _persist_update(task.id, user_id, update)
        except Exception as e:
            # Don't let one task failure kill the run. Goes to App Insights via
            # the heed logger (see agents/telemetry.py).
            _log.exception(
                "memory_keeper.process_task failed",
                extra={"task_id": task.id, "user_id": user_id, "error": str(e)},
            )
    return updates


def _persist_update(task_id: str, user_id: str, update: CadenceUpdate) -> None:
    """Write the cadence + observations back to the task in Cosmos."""
    from azure.cosmos import operations as cosmos_ops
    container = _get_database().get_container_client("tasks")

    patch_ops = [
        {"op": "set", "path": "/learned_cadence_days", "value": update.learned_cadence_days},
        {"op": "set", "path": "/learned_confidence", "value": update.learned_confidence},
        {"op": "set", "path": "/pattern_observations", "value": update.pattern_observations},
        {"op": "set", "path": "/pattern_flags", "value": update.flags},
    ]
    container.patch_item(item=task_id, partition_key=user_id, patch_operations=patch_ops)
