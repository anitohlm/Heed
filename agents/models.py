"""
Pydantic models matching the Cosmos DB schema.

These mirror the structures defined in 03_DATA_SPEC.md exactly. If the spec
changes, this file changes. Both agents and tools import from here — never
duplicate field names or types elsewhere.

Note: these are the *application-level* models. Cosmos returns dicts; tools
parse those dicts into these models before passing to agents.
"""

from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Cosmos models
# -----------------------------------------------------------------------------

TaskCategory = Literal[
    "home", "health", "admin", "relationships",
    "self_care", "work", "finance"
]

Importance = Literal["low", "medium", "high"]

TaskStatus = Literal["active", "paused", "archived"]

EventType = Literal["done", "skipped", "deferred"]

SkipReason = Literal["still_fine", "not_applicable", "forgot", "too_busy", "other"]

ContextType = Literal["travel", "illness", "busy", "celebration", "other"]


class Task(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    category: TaskCategory
    created_at: datetime
    explicit_cadence_days: Optional[float] = None
    learned_cadence_days: Optional[float] = None
    learned_confidence: Optional[float] = None
    last_done_at: Optional[datetime] = None
    next_due_at: Optional[datetime] = None
    status: TaskStatus = "active"
    importance: Importance = "medium"


class Completion(BaseModel):
    id: str
    user_id: str
    task_id: str
    completed_at: datetime
    event_type: EventType
    note: Optional[str] = None
    skip_reason: Optional[SkipReason] = None


class UserContext(BaseModel):
    id: str
    user_id: str
    context_type: ContextType
    start_date: date
    end_date: date
    description: str
    created_at: datetime


class User(BaseModel):
    id: str
    display_name: str
    timezone: str
    language_preference: Literal["english", "taglish"] = "english"
    notification_quiet_hours: Optional[dict] = None
    created_at: datetime


# -----------------------------------------------------------------------------
# Memory Keeper output models — what the background agent writes back
# -----------------------------------------------------------------------------

PatternFlag = Literal[
    "pattern_break",      # consecutive misses where there shouldn't be
    "likely_forgotten",   # very low completion rate, may not matter to user anymore
    "high_variance",      # cadence is inconsistent, low confidence
    "context_explained",  # gaps are explained by context windows, not pattern issues
]


class CadenceUpdate(BaseModel):
    """One Memory Keeper output per task per run."""
    task_id: str
    learned_cadence_days: Optional[float]
    learned_confidence: Optional[float]
    pattern_observations: list[str] = Field(default_factory=list)
    flags: list[PatternFlag] = Field(default_factory=list)
    reason: Optional[str] = None  # for null cadence cases


# -----------------------------------------------------------------------------
# Advisor agent intermediate models — what the agent passes around
# -----------------------------------------------------------------------------

class TodayView(BaseModel):
    """Aggregated 'what does today look like' — composed by the today_view tool."""
    date: date
    overdue: list[Task]
    due_today: list[Task]
    upcoming_this_week: list[Task]
    active_contexts: list[UserContext]
    upcoming_contexts: list[UserContext]


class AgentAction(BaseModel):
    """A structured action the Advisor proposes. Validated before execution."""
    action_type: Literal["mark_done", "skip", "defer", "lighten_routine", "add_context"]
    task_id: Optional[str] = None
    routine_id: Optional[str] = None
    payload: dict = Field(default_factory=dict)
    requires_confirmation: bool = True
