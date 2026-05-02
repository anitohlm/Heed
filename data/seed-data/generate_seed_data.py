"""
Heed seed data generator.

Generates synthetic data for a single fictional user (Maya) with intentional
patterns baked in to support demo moments. See 03_DATA_SPEC.md section 4 for
the patterns this script is designed to produce.

Run: python generate_seed_data.py
Output: seed-data/{users,tasks,completions,user_context,ph_calendar}.json
"""

import json
import uuid
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Deterministic output — re-running gives the same data
random.seed(42)

OUTPUT_DIR = Path(__file__).parent / "seed-data"
OUTPUT_DIR.mkdir(exist_ok=True)

# Anchor "now" to the hackathon week for realistic demo timing.
# This is the date in the spec: Apr 21, 2026.
NOW = datetime(2026, 4, 21, 10, 0, tzinfo=timezone.utc)
USER_ID = "usr_heed_demo_001"


def iso(dt):
    """Consistent ISO 8601 formatting."""
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# USERS
# ---------------------------------------------------------------------------
users = [
    {
        "id": USER_ID,
        "display_name": "Maya",
        "timezone": "Asia/Manila",
        "language_preference": "taglish",
        "notification_quiet_hours": {"start": "22:00", "end": "07:00"},
        "created_at": iso(NOW - timedelta(days=180)),
    }
]


# ---------------------------------------------------------------------------
# TASKS — 18 tasks designed to produce specific demo moments
# ---------------------------------------------------------------------------
# Each tuple: (name, description, category, importance, cadence_days_target,
#              explicit_cadence, start_offset_days, pattern_hint)
#
# pattern_hint drives how completions are generated further down.

TASK_SPECS = [
    # Pattern 1: "Call Mom" — missed last 3 Sundays. Demonstrates cadence break detection.
    ("Call Mom", "Weekly check-in call", "relationships", "high", 7, None, 150, "weekly_then_missed_3"),

    # Pattern 2: "Clean aircon filter" — 5 completions at ~11 week intervals. Demonstrates learning.
    ("Clean aircon filter", None, "home", "medium", 77, None, 400, "every_11_weeks_x5"),

    # Pattern 3: "Pay Meralco" — done on 14th-15th every month. Demonstrates payday-aligned pattern.
    ("Pay Meralco bill", "Electricity", "finance", "high", 30, None, 150, "monthly_mid_month"),

    # Pattern 4: "Water the plants" — skipped during past travel, otherwise reliable.
    ("Water the plants", None, "home", "medium", 3, 3, 150, "every_3_days_with_travel_skips"),

    # Pattern 5: "Change toothbrush" — done once 4 months ago. Demonstrates "what am I forgetting?"
    ("Change toothbrush", "Every 3-4 months per dentist", "health", "medium", 100, None, 150, "done_once_long_ago"),

    # Steady-state tasks that help the agent look normal
    ("Pay water bill (Maynilad)", None, "finance", "high", 30, None, 150, "monthly_first_week"),
    ("Pay PLDT internet", None, "finance", "high", 30, None, 150, "monthly_end_of_month"),
    ("Refill water dispenser", "5-gallon tank", "home", "medium", 10, None, 140, "every_9_to_12_days"),
    ("Wash bedsheets", None, "home", "medium", 14, None, 150, "every_2_weeks"),
    ("Clean cat litter box", None, "home", "high", 2, 2, 150, "every_2_days_reliable"),
    ("Vitamin D supplement", None, "health", "low", 1, 1, 150, "daily_inconsistent"),
    ("Exercise (30 min)", "Walk or home workout", "self_care", "medium", 2, None, 150, "3_to_4_per_week"),
    ("Update expense tracker", None, "admin", "medium", 7, 7, 150, "weekly_weekend"),
    ("Submit timesheet", "For freelance clients", "work", "high", 7, 7, 150, "weekly_friday"),
    ("Back up laptop files", None, "admin", "medium", 30, None, 150, "monthly_roughly"),
    ("Dentist appointment", None, "health", "high", 180, None, 400, "every_6_months"),
    ("Renew driver's license check", "Check expiry", "admin", "low", 365, None, 400, "yearly_check"),
    ("Call Dad", "Check in", "relationships", "medium", 14, None, 150, "biweekly_inconsistent"),
]


def make_task(name, description, category, importance, target_cadence, explicit_cadence, start_offset, pattern):
    task_id = new_id("task")
    created = NOW - timedelta(days=start_offset)
    return {
        "id": task_id,
        "user_id": USER_ID,
        "name": name,
        "description": description,
        "category": category,
        "created_at": iso(created),
        "explicit_cadence_days": explicit_cadence,
        "learned_cadence_days": None,  # filled later based on completions
        "learned_confidence": None,
        "last_done_at": None,           # filled later
        "next_due_at": None,            # filled later
        "status": "active",
        "importance": importance,
        "_pattern": pattern,            # internal hint, stripped before writing
        "_target_cadence": target_cadence,
    }


tasks = [make_task(*spec) for spec in TASK_SPECS]


# ---------------------------------------------------------------------------
# COMPLETIONS — generated according to each task's pattern
# ---------------------------------------------------------------------------

TAGLISH_NOTES = [
    "tapos na", "done", "okay", "alas otso ginawa", "before work",
    "napag-iwanan", "hinabol ko", "late na nag-log", "pagod pero done",
    "pabalik from errands", "habol sa deadline", "kasama ng iba",
]

SKIP_NOTES_TOO_BUSY = ["sobrang busy", "meeting all day", "wala talaga time", "ayoko muna"]
SKIP_NOTES_FORGOT = ["nakalimutan ko", "forgot completely", "ay shet"]

completions = []


def add_completion(task_id, when, event_type="done", note=None, skip_reason=None):
    completions.append({
        "id": new_id("comp"),
        "user_id": USER_ID,
        "task_id": task_id,
        "completed_at": iso(when),
        "event_type": event_type,
        "note": note,
        "skip_reason": skip_reason,
    })


def at_hour(date, hour_range=(8, 21)):
    """Random hour within reasonable waking window, for realism."""
    h = random.randint(*hour_range)
    m = random.randint(0, 59)
    return date.replace(hour=h, minute=m, second=0, microsecond=0)


# Past travel window: Dec 20-27, 2025 (for "water plants" skips).
PAST_TRAVEL_START = datetime(2025, 12, 20, tzinfo=timezone.utc)
PAST_TRAVEL_END = datetime(2025, 12, 27, tzinfo=timezone.utc)


def generate_for_task(task):
    pattern = task["_pattern"]
    start = datetime.fromisoformat(task["created_at"].replace("Z", "+00:00"))
    task_id = task["id"]

    if pattern == "weekly_then_missed_3":
        # Weekly Sundays for ~20 weeks, then last 3 Sundays are missed.
        sunday = start + timedelta(days=(6 - start.weekday()) % 7)
        week = 0
        while sunday < NOW - timedelta(days=21):  # stop 3 weeks before now
            add_completion(task_id, at_hour(sunday, (17, 20)), note=random.choice(["chika time", "good chat", None]))
            sunday += timedelta(days=7)
            week += 1

    elif pattern == "every_11_weeks_x5":
        # 5 completions at ~77-day intervals with small jitter.
        intervals = [77, 84, 70, 77, 84]
        current = start + timedelta(days=14)
        for iv in intervals:
            add_completion(task_id, at_hour(current), note="matagal na hindi nalilinis" if random.random() < 0.5 else None)
            current += timedelta(days=iv)

    elif pattern == "monthly_mid_month":
        # 14th-15th of each month going back 5 months.
        for months_back in range(5, 0, -1):
            base = NOW.replace(day=14) - timedelta(days=30 * months_back)
            day_of_month = random.choice([14, 15])
            when = base.replace(day=day_of_month)
            add_completion(task_id, at_hour(when), note="pang-payday" if random.random() < 0.3 else None)

    elif pattern == "every_3_days_with_travel_skips":
        # Every ~3 days. During Dec 20-27 travel window, mark as skipped (not_applicable).
        current = start + timedelta(days=2)
        while current < NOW - timedelta(days=2):
            if PAST_TRAVEL_START <= current <= PAST_TRAVEL_END:
                add_completion(task_id, at_hour(current, (10, 18)), event_type="skipped",
                               skip_reason="not_applicable", note="out of town")
            else:
                add_completion(task_id, at_hour(current, (7, 9)), note=None)
            current += timedelta(days=random.choice([2, 3, 3, 4]))

    elif pattern == "done_once_long_ago":
        # Single completion roughly 4 months before now.
        add_completion(task_id, at_hour(NOW - timedelta(days=125)), note="sa wakas napalitan")

    elif pattern == "monthly_first_week":
        for months_back in range(5, 0, -1):
            base = NOW.replace(day=3) - timedelta(days=30 * months_back)
            when = base.replace(day=random.choice([2, 3, 4, 5]))
            add_completion(task_id, at_hour(when))

    elif pattern == "monthly_end_of_month":
        for months_back in range(5, 0, -1):
            base = NOW.replace(day=27) - timedelta(days=30 * months_back)
            when = base.replace(day=random.choice([26, 27, 28]))
            add_completion(task_id, at_hour(when))

    elif pattern == "every_9_to_12_days":
        current = start + timedelta(days=5)
        while current < NOW - timedelta(days=3):
            add_completion(task_id, at_hour(current), note=random.choice(["sariwa", None, None]))
            current += timedelta(days=random.choice([9, 10, 10, 11, 12]))

    elif pattern == "every_2_weeks":
        current = start + timedelta(days=7)
        while current < NOW - timedelta(days=5):
            add_completion(task_id, at_hour(current, (10, 14)))
            current += timedelta(days=random.choice([13, 14, 14, 15, 16]))

    elif pattern == "every_2_days_reliable":
        current = start + timedelta(days=1)
        while current < NOW - timedelta(days=1):
            add_completion(task_id, at_hour(current, (7, 22)))
            current += timedelta(days=random.choice([1, 2, 2, 2, 3]))

    elif pattern == "daily_inconsistent":
        # Not every day — 4-6 out of 7 days
        current = start
        while current < NOW:
            if random.random() < 0.7:
                add_completion(task_id, at_hour(current, (7, 10)))
            else:
                if random.random() < 0.3:
                    add_completion(task_id, at_hour(current, (8, 9)),
                                   event_type="skipped", skip_reason="forgot",
                                   note=random.choice(SKIP_NOTES_FORGOT))
            current += timedelta(days=1)

    elif pattern == "3_to_4_per_week":
        current = start
        while current < NOW - timedelta(days=1):
            week_end = current + timedelta(days=7)
            # pick 3-4 days in this week
            days_done = sorted(random.sample(range(7), random.choice([3, 3, 4])))
            for d in days_done:
                when = current + timedelta(days=d)
                if when < NOW:
                    add_completion(task_id, at_hour(when, (6, 8)),
                                   note=random.choice(["brisk walk", "home workout", "yoga", None]))
            current = week_end

    elif pattern == "weekly_weekend":
        sat = start + timedelta(days=(5 - start.weekday()) % 7)
        while sat < NOW - timedelta(days=3):
            if random.random() < 0.85:
                add_completion(task_id, at_hour(sat, (10, 15)))
            else:
                add_completion(task_id, at_hour(sat, (10, 15)),
                               event_type="skipped", skip_reason="too_busy",
                               note=random.choice(SKIP_NOTES_TOO_BUSY))
            sat += timedelta(days=7)

    elif pattern == "weekly_friday":
        fri = start + timedelta(days=(4 - start.weekday()) % 7)
        while fri < NOW - timedelta(days=3):
            add_completion(task_id, at_hour(fri, (15, 18)))
            fri += timedelta(days=7)

    elif pattern == "monthly_roughly":
        for months_back in range(5, 0, -1):
            base = NOW.replace(day=10) - timedelta(days=30 * months_back)
            jitter = random.randint(-4, 6)
            when = base + timedelta(days=jitter)
            add_completion(task_id, at_hour(when, (20, 22)))

    elif pattern == "every_6_months":
        # One completion, about 7 months ago. That makes it overdue.
        add_completion(task_id, at_hour(NOW - timedelta(days=215)), note="cleaning tapos")

    elif pattern == "yearly_check":
        # Created 400 days ago, done once early on.
        add_completion(task_id, at_hour(NOW - timedelta(days=395)), note="okay pa hanggang 2027")

    elif pattern == "biweekly_inconsistent":
        current = start + timedelta(days=10)
        while current < NOW - timedelta(days=7):
            add_completion(task_id, at_hour(current, (18, 21)),
                           note=random.choice(["good catchup", "short talk lang", None]))
            current += timedelta(days=random.choice([12, 14, 16, 18, 21]))


for task in tasks:
    generate_for_task(task)


# ---------------------------------------------------------------------------
# COMPUTE last_done_at, next_due_at, learned cadence for each task
# ---------------------------------------------------------------------------

def compute_task_state(task, task_completions):
    done_completions = [c for c in task_completions if c["event_type"] == "done"]
    done_completions.sort(key=lambda c: c["completed_at"])

    if done_completions:
        task["last_done_at"] = done_completions[-1]["completed_at"]
    else:
        task["last_done_at"] = None

    # Learned cadence: only if enough completions and enough history
    # Threshold: 5 completions AND 21 days of history. Lower than an ideal
    # statistical bar, but necessary for sparse real-world tasks (like
    # "clean aircon filter" which might only be done 4x/year).
    if len(done_completions) >= 5:
        first = datetime.fromisoformat(done_completions[0]["completed_at"].replace("Z", "+00:00"))
        last = datetime.fromisoformat(done_completions[-1]["completed_at"].replace("Z", "+00:00"))
        if (last - first).days >= 21:
            # Compute average interval
            intervals = []
            for a, b in zip(done_completions, done_completions[1:]):
                da = datetime.fromisoformat(a["completed_at"].replace("Z", "+00:00"))
                db = datetime.fromisoformat(b["completed_at"].replace("Z", "+00:00"))
                intervals.append((db - da).days)
            if intervals:
                avg = sum(intervals) / len(intervals)
                task["learned_cadence_days"] = round(avg, 1)
                # Confidence 0.3 at 5, 0.95 at 20+
                n = len(done_completions)
                if n >= 20:
                    task["learned_confidence"] = 0.95
                else:
                    task["learned_confidence"] = round(0.3 + (n - 5) * (0.95 - 0.3) / 15, 2)

    # next_due_at: last_done + effective cadence
    effective = task["explicit_cadence_days"] or task["learned_cadence_days"]
    if effective and task["last_done_at"]:
        last_done = datetime.fromisoformat(task["last_done_at"].replace("Z", "+00:00"))
        task["next_due_at"] = iso(last_done + timedelta(days=effective))


for task in tasks:
    task_completions = [c for c in completions if c["task_id"] == task["id"]]
    compute_task_state(task, task_completions)

# Strip internal hint fields before writing
for task in tasks:
    task.pop("_pattern", None)
    task.pop("_target_cadence", None)


# ---------------------------------------------------------------------------
# USER_CONTEXT — past travel + upcoming travel, plus one illness, plus busy week
# ---------------------------------------------------------------------------

user_context = [
    {
        "id": new_id("ctx"),
        "user_id": USER_ID,
        "context_type": "travel",
        "start_date": "2025-12-20",
        "end_date": "2025-12-27",
        "description": "Christmas trip to Baguio with family",
        "created_at": iso(datetime(2025, 12, 18, 10, 0, tzinfo=timezone.utc)),
    },
    {
        "id": new_id("ctx"),
        "user_id": USER_ID,
        "context_type": "illness",
        "start_date": "2026-02-10",
        "end_date": "2026-02-14",
        "description": "Flu — bed rest, skip non-essentials",
        "created_at": iso(datetime(2026, 2, 10, 8, 0, tzinfo=timezone.utc)),
    },
    {
        "id": new_id("ctx"),
        "user_id": USER_ID,
        "context_type": "busy",
        "start_date": "2026-03-16",
        "end_date": "2026-03-22",
        "description": "Client deadline week — back-to-back shoots",
        "created_at": iso(datetime(2026, 3, 15, 20, 0, tzinfo=timezone.utc)),
    },
    {
        "id": new_id("ctx"),
        "user_id": USER_ID,
        "context_type": "travel",
        "start_date": "2026-04-28",
        "end_date": "2026-05-02",
        "description": "Trip to Singapore for DEF CON",
        "created_at": iso(NOW - timedelta(days=5)),
    },
]


# ---------------------------------------------------------------------------
# PH_CALENDAR — 30 events for AI Search
# ---------------------------------------------------------------------------

ph_calendar = [
    # National holidays (2026)
    {"event_name": "New Year's Day", "event_type": "holiday", "date": "2026-01-01", "is_recurring_yearly": True, "description": "Regular holiday nationwide", "affects": "everything closed, family gatherings"},
    {"event_name": "Chinese New Year", "event_type": "holiday", "date": "2026-02-17", "is_recurring_yearly": True, "description": "Special non-working holiday", "affects": "some businesses closed, family celebrations"},
    {"event_name": "EDSA People Power Anniversary", "event_type": "holiday", "date": "2026-02-25", "is_recurring_yearly": True, "description": "Special non-working holiday", "affects": "government offices closed"},
    {"event_name": "Maundy Thursday", "event_type": "holiday", "date": "2026-04-02", "is_recurring_yearly": False, "description": "Holy Week — regular holiday", "affects": "nearly everything closed, travel heavy"},
    {"event_name": "Good Friday", "event_type": "holiday", "date": "2026-04-03", "is_recurring_yearly": False, "description": "Holy Week — regular holiday", "affects": "nearly everything closed, quiet day"},
    {"event_name": "Araw ng Kagitingan", "event_type": "holiday", "date": "2026-04-09", "is_recurring_yearly": True, "description": "Day of Valor — regular holiday", "affects": "government offices closed"},
    {"event_name": "Labor Day", "event_type": "holiday", "date": "2026-05-01", "is_recurring_yearly": True, "description": "Regular holiday", "affects": "most businesses closed"},
    {"event_name": "Independence Day", "event_type": "holiday", "date": "2026-06-12", "is_recurring_yearly": True, "description": "Regular holiday", "affects": "government and many businesses closed"},
    {"event_name": "Ninoy Aquino Day", "event_type": "holiday", "date": "2026-08-21", "is_recurring_yearly": True, "description": "Special non-working holiday", "affects": "government offices closed"},
    {"event_name": "National Heroes Day", "event_type": "holiday", "date": "2026-08-31", "is_recurring_yearly": True, "description": "Last Monday of August — regular holiday", "affects": "most businesses closed"},
    {"event_name": "All Saints' Day", "event_type": "holiday", "date": "2026-11-01", "is_recurring_yearly": True, "description": "Special non-working holiday", "affects": "cemetery visits, family gatherings, travel heavy"},
    {"event_name": "All Souls' Day", "event_type": "holiday", "date": "2026-11-02", "is_recurring_yearly": True, "description": "Special non-working holiday", "affects": "cemetery visits continue"},
    {"event_name": "Bonifacio Day", "event_type": "holiday", "date": "2026-11-30", "is_recurring_yearly": True, "description": "Regular holiday", "affects": "government offices closed"},
    {"event_name": "Feast of the Immaculate Conception", "event_type": "holiday", "date": "2026-12-08", "is_recurring_yearly": True, "description": "Special non-working holiday", "affects": "many businesses closed"},
    {"event_name": "Christmas Eve", "event_type": "holiday", "date": "2026-12-24", "is_recurring_yearly": True, "description": "Special non-working holiday; Noche Buena preparations", "affects": "family gatherings, grocery heavy, traffic"},
    {"event_name": "Christmas Day", "event_type": "holiday", "date": "2026-12-25", "is_recurring_yearly": True, "description": "Regular holiday", "affects": "everything closed, family day"},
    {"event_name": "Rizal Day", "event_type": "holiday", "date": "2026-12-30", "is_recurring_yearly": True, "description": "Regular holiday", "affects": "government offices closed"},
    {"event_name": "New Year's Eve", "event_type": "holiday", "date": "2026-12-31", "is_recurring_yearly": True, "description": "Special non-working holiday; Media Noche", "affects": "family gatherings, grocery heavy, fireworks"},

    # Cultural / observance periods
    {"event_name": "Holy Week", "event_type": "observance", "date": "2026-03-29", "is_recurring_yearly": False, "description": "Palm Sunday to Easter — widely observed quiet week", "affects": "travel out of cities, businesses wind down"},
    {"event_name": "Undas", "event_type": "observance", "date": "2026-10-30", "is_recurring_yearly": True, "description": "Extended All Saints/All Souls period", "affects": "cemetery visits, travel to provinces"},
    {"event_name": "Christmas season (ber months start)", "event_type": "observance", "date": "2026-09-01", "is_recurring_yearly": True, "description": "Filipino Christmas season informally begins", "affects": "festive mood, shopping increases"},
    {"event_name": "Simbang Gabi starts", "event_type": "observance", "date": "2026-12-16", "is_recurring_yearly": True, "description": "9 dawn masses leading to Christmas", "affects": "early morning schedules, bibingka stalls"},

    # Payday cycles (semi-monthly, standard PH private sector)
    {"event_name": "Mid-month payday", "event_type": "payday", "date": "2026-04-15", "is_recurring_yearly": False, "description": "Typical 15th-of-month private sector payday", "affects": "bill payments, transfers, groceries"},
    {"event_name": "End-month payday", "event_type": "payday", "date": "2026-04-30", "is_recurring_yearly": False, "description": "Typical end-of-month private sector payday", "affects": "bill payments, transfers, groceries"},
    {"event_name": "Mid-month payday (May)", "event_type": "payday", "date": "2026-05-15", "is_recurring_yearly": False, "description": "Typical 15th-of-month payday", "affects": "bill payments, transfers"},
    {"event_name": "End-month payday (May)", "event_type": "payday", "date": "2026-05-30", "is_recurring_yearly": False, "description": "Typical end-of-month payday", "affects": "bill payments, transfers"},

    # Utility and bill cycles (typical windows)
    {"event_name": "Meralco billing cycle typical cutoff", "event_type": "bill_cycle", "date": "2026-04-14", "is_recurring_yearly": False, "description": "Typical mid-month Meralco due date", "affects": "electricity disconnection risk if missed"},
    {"event_name": "Maynilad/Manila Water typical cutoff", "event_type": "bill_cycle", "date": "2026-04-10", "is_recurring_yearly": False, "description": "Typical early-month water bill due", "affects": "water service disconnection risk if missed"},
    {"event_name": "PLDT/Globe/Converge typical cutoff", "event_type": "bill_cycle", "date": "2026-04-28", "is_recurring_yearly": False, "description": "Typical end-of-month internet due", "affects": "internet disconnection risk if missed"},
    {"event_name": "Rainy season begins", "event_type": "season", "date": "2026-06-01", "is_recurring_yearly": True, "description": "Habagat / southwest monsoon", "affects": "mold in aircons, flooding, stock water"},
]

# Add id fields to ph_calendar
for i, ev in enumerate(ph_calendar):
    ev["id"] = f"phcal_{i:03d}"


# ---------------------------------------------------------------------------
# WRITE FILES
# ---------------------------------------------------------------------------

def write_json(filename, data):
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  {filename}: {len(data)} records")


print("Writing seed data to", OUTPUT_DIR)
write_json("users.json", users)
write_json("tasks.json", tasks)
write_json("completions.json", completions)
write_json("user_context.json", user_context)
write_json("ph_calendar.json", ph_calendar)

print(f"\nTotal completions generated: {len(completions)}")
print(f"Tasks with learned cadence: {sum(1 for t in tasks if t['learned_cadence_days'])}")
print(f"Tasks overdue as of {iso(NOW)}:")
for t in tasks:
    if t["next_due_at"] and t["next_due_at"] < iso(NOW):
        overdue_days = (NOW - datetime.fromisoformat(t["next_due_at"].replace("Z", "+00:00"))).days
        print(f"  - {t['name']}: {overdue_days} days overdue")
