# Unified Importance System Design

## Goal

Standardise the visual treatment of task importance (Low / Medium / High) across every surface in the app so the same label, color, icon, and weight appear consistently on task cards, the Add Task modal, and the calendar legend.

## Background

The app already uses `importance: "low" | "medium" | "high"` throughout the data model and backend. The problem was purely presentational:

- Task cards only showed a "high" pill; Low and Medium were invisible.
- The Add Task modal used soft outline buttons with no icons.
- The calendar legend used a different label language ("Urgent / Important / Routine") and a different visual direction (soft tinted chips).
- No single component encoded the full system — each surface had its own ad-hoc styling.

## Design Decisions

**Labels:** Low · Medium · High — matches the existing data model values exactly. No rename needed.

**Visual direction:** Bold filled — solid priority color as background, `C.cream` as text. Higher contrast than soft outlines, and the "High" badge stands out clearly on busy task lists.

**Icon language (shape = level):**
- Low → ○ open ring (lightweight, no fill)
- Medium → ◆ filled diamond (moderate weight)
- High → ● filled circle (solid, assertive) + subtle box-shadow

**Typography hierarchy:**
- Low → `font-weight: 400`
- Medium → `font-weight: 500`
- High → `font-weight: 700`

Color, icon, and weight all escalate together — no surface relies on color alone (satisfies WCAG `color-not-only`).

**Task cards:** All three levels get a badge (top-right on HeroCard, right-aligned on TaskCard). Previously only High was shown.

**Add Task modal:** The three selector buttons become full-color filled buttons (flex row, min-height 44px each to meet touch target requirements). Default selection remains Medium.

**Calendar legend:** Updated from the current soft-outline chips to match the bold filled direction, and relabelled from "Urgent / Important / Routine" to "Low / Medium / High" to match the rest of the app.

## Component

A single `ImportanceBadge` component encodes the whole system:

```jsx
function ImportanceBadge({ importance }) {
  const config = {
    low:    { bg: C.sage,  icon: 'ring',    weight: 400, shadow: false },
    medium: { bg: C.ochre, icon: 'diamond', weight: 500, shadow: false },
    high:   { bg: C.rust,  icon: 'circle',  weight: 700, shadow: true  },
  }
  const { bg, icon, weight, shadow } = config[importance] || config.medium
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg, color: C.cream,
      padding: '4px 11px', borderRadius: 999,
      fontSize: 12, fontWeight: weight,
      boxShadow: shadow ? `0 2px 8px ${bg}40` : 'none',
    }}>
      <ImportanceIcon type={icon} color={C.cream} size={9}/>
      {importance.charAt(0).toUpperCase() + importance.slice(1)}
    </span>
  )
}
```

A companion `ImportanceIcon` renders the correct SVG shape (ring / diamond / circle) at the given size and color — reused in both the badge and the modal selector buttons.

## Surfaces Changed

| Surface | Change |
|---|---|
| `HeroCard` | Replace `<Pill tone="danger">high</Pill>` with `<ImportanceBadge importance={task.importance}/>` |
| `TaskCard` | Same replacement; show for all tasks, not just high |
| `AddTaskModal` | Replace soft outline buttons with `ImportanceButton` (full-color, ≥44px, icon + label) |
| Calendar legend | Replace soft-outline chips with `ImportanceBadge` for each level |

## What Does Not Change

- Data model: `Importance = Literal["low", "medium", "high"]` in `agents/models.py` — unchanged.
- Seed data, search index, agent prompts — unchanged.
- The business rule in `03_DATA_SPEC.md` (high-importance tasks fire during context windows) — unchanged.
- Theme tokens (`C.sage`, `C.ochre`, `C.rust`) — unchanged.
