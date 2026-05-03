# Context Tab Improvements Design

**Goal:** Make the Context tab actively useful — quick to log a life event, clear when one is active, and informative about past impact on tasks.

**Architecture:** All new UI lives in `web/app/page.jsx`. No new API endpoints are needed for the frontend demo; context state is managed locally in `HeedApp`. The existing `AddContextModal` handles custom contexts; new quick-add chips bypass it for common scenarios.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern)

---

## 1. Quick-add chips

Four pill-shaped buttons at the top of the Context tab:

- 🌿 Sick
- 🌾 Busy week
- ✈️ Traveling
- 🌸 Celebration

Tapping any chip opens a **duration bottom sheet** (not the full Add Context modal). The sheet shows the context type label and a row of duration buttons: **1 day · 2 days · 3 days · 5 days · 1 week**. One button is pre-selected (2 days for Sick, 1 week for Traveling, etc.). A primary "Activate [type] mode" button submits.

On submit: sheet closes, a toast appears ("Sick mode activated — Heed is holding your tasks"), and an active context card appears at the top of the tab.

The existing "+ Add context" button remains for custom/other types.

---

## 2. Active context card

When a context is currently active, a prominent card renders above the Upcoming section with an ochre border and warm background. It shows:

- Type icon + label ("🌿 Sick — rest mode")
- Date range + "started X days ago"
- A "Day X of Y" pill badge (top-right)
- A summary line: "Heed is holding **N tasks** until you're back. [Routine name] paused."
- Two action buttons:
  - **"I'm better now"** (primary, sage green) — opens the recovery summary sheet
  - **"Extend 2 days"** (ghost) — adds 2 days to the end date, updates the badge, shows toast

Only one active context card renders at a time (the most recently started one).

---

## 3. Recovery summary sheet

Triggered by "I'm better now". A bottom sheet slides up showing:

- Heading: "Glad you're back 🌿" (or appropriate emoji for the context type)
- Summary line: "Sick mode ran for **N days**. Here's what Heed held back:"
- A list of up to 3 held tasks with their overdue delta (e.g. "+3d overdue"), plus a "+ N more tasks" line if there are more
- Two buttons:
  - **"Resume all"** (primary) — closes the sheet, ends the context, toast "You're back — tasks resumed"
  - **"Ease back in"** (ghost) — closes the sheet, ends the context, but only surfaces the top 3 most-overdue tasks in Today immediately; the rest resume over the following 2 days (simulated with a flag on each task)

After either action the active context card disappears and the context moves to the Past section.

---

## 4. Past contexts — task impact count

Each past context row gains a right-aligned impact count: e.g. **"12 skipped"** in rust/red with a small "tasks" label below. This is a static display (demo data for now; future API can supply real counts).

---

## 5. What doesn't change

- The Upcoming section and ContextRow component stay as-is (they already work well)
- The "+ Add context" button and AddContextModal are unchanged
- The tip at the bottom ("You can also tell Heed in plain language…") stays

---

## Components to add / modify

| Component | Change |
|---|---|
| `ContextTab` | Add quick-add chips, active context card, wire new sheets |
| `QuickContextSheet` | New — duration picker bottom sheet (shared for all 4 types) |
| `ActiveContextCard` | New — prominent card for the running context |
| `RecoverySummarySheet` | New — "Glad you're back" sheet with held-task list |
| `ContextRow` | Add optional impact count display on the right |
| `HeedApp` | Add `activeContext` state, `handleQuickContext`, `handleEndContext`, `handleExtendContext` |

---

## State shape

```js
// activeContext in HeedApp
{
  id: string,
  type: 'sick' | 'busy' | 'travel' | 'celebration',
  label: string,       // "Sick — rest mode"
  startDate: Date,
  endDate: Date,
  heldTaskIds: string[],  // tasks held during this context
}
```

`heldTaskIds` is populated when the context activates — it captures the IDs of all currently active tasks so the recovery sheet can list them.
