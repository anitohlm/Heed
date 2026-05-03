# Minimalist Routine Row (Today Tab) — Design Spec

## Goal

Replace the full `RoutineCard` in the Today tab with a compact two-line row that shows only what's needed at a glance — name, last-7-day health signal, and a swipe-to-act interaction. The detailed card (14-day chart, owl insight block, action buttons, circular ring) stays in the Tracks tab unchanged.

## Architecture

Two separate components share the same `routine` data object:

- **`RoutineRow`** — new compact component used in Today tab only
- **`RoutineCard`** — existing full component, unchanged, used in Tracks tab

`TodayTab` swaps `RoutineCard` → `RoutineRow`. `TracksTab` keeps `RoutineCard`.

## Visual Design

### Layout (two rows)

```
┌─────────────────────────────────────────────┐  ← 1px border (border / ochre-tinted when attention)
│  Morning routine          ✓ 6/7 this week   │  ← top row: name (left) + rate badge (right)
│  ● ● ● ● ○ ● ●  today →                    │  ← bottom row: 7 pip dots + label
└─────────────────────────────────────────────┘
```

Padding: 11px 14px. Border-radius: 10px. Background: `C.paperHi`. Margin-bottom: 8px.

### Top row

- **Name**: 14px, weight 600, `C.ink`, Nunito Sans
- **Rate badge**: 11px, weight 700
  - `✓ N/7 this week` in `C.sage` when completionRate > 0.71 (≥5/7)
  - `⚠ N/7 this week` in `C.ochre` when completionRate ≤ 0.71 and > 0.42
  - No badge change for very poor (ochre covers it), border tints handle the rest

### Data derivation

```js
const last7 = routine.completion14d.slice(-7)           // last 7 days only
const thisWeekCount = last7.filter(Boolean).length       // e.g. 6
const isHealthy = thisWeekCount >= 5                     // ≥5/7 = sage; <5 = ochre
const isAttention = routine.suggestion !== null
const isLightened = !!routine.lightenedItems?.length
```

### Bottom row

- **7 pip dots** (`last7`): 6×6px circles, gap 3px
  - Completed day: `C.sage` fill
  - Missed day: `C.border` fill
- **"today →"** label: 10px, `C.inkMute`, italic, margin-left 4px
- **Attention pill** (right side, when `isAttention && !isLightened`):
  - Text: `Lighten this week →`
  - Style: 10.5px, weight 600, `C.ochre` text, `C.ochreSoft` bg, 1px ochre border, border-radius 999px, padding 2px 9px
  - Tap → calls `onLighten(routine.id)`
- **Lightened pill** (right side, when `isLightened`):
  - Text: `${routine.lightenedItems.length} items optional`
  - Style: same shape, `C.sage` text, `C.sageSoft` bg, sage border

### Rate badge (top row right)

```js
isHealthy
  ? `✓ ${thisWeekCount}/7 this week`   // C.sage
  : `⚠ ${thisWeekCount}/7 this week`   // C.ochre
```

### Border tinting

- Default: `1px solid C.border`
- Attention-worthy (`isAttention && !isLightened`): `1px solid rgba(C.ochre, 0.45)`
- Lightened (`isLightened`): `1px solid rgba(C.sage, 0.45)`

## Swipe Interaction

`RoutineRow` uses the existing `useSwipe` hook, same configuration as `HeroCard`/`TaskCard`:

- **Swipe right** → `onMarkDone(routine.id)` — mark today done
- **Swipe left** → `onSkipToday(routine.id)` — skip today's occurrence (new handler in HeedApp, calls `setToast` + fires to API like task skip)
- Badge overlay: `data-badge="done"` (✓, sage) and `data-badge="skip"` (↷, ochre) positioned absolute behind the card, same pattern as task cards
- Outer wrapper: `position: relative`, `touchAction: 'pan-y'`, `userSelect: 'none'`

## Removed from Today tab (moved to Tracks)

| Removed element | Where it lives now |
|---|---|
| Circular SVG progress ring (52px) | Tracks tab `RoutineCard` |
| 14-day completion leaf chart | Tracks tab `RoutineCard` |
| Owl insight block | Tracks tab `RoutineCard` |
| "Mark today done" button | Replaced by swipe-right |
| "Lighten this week" button | Replaced by pill tap |
| "Edit" / "Share card" buttons | Tracks tab `RoutineCard` |

## New handler: `handleSkipRoutineToday`

Added to `HeedApp`. Fires a toast `"Skipped today"` and optionally calls the completions API with `event_type: 'skipped'` for the routine (same pattern as `handleSkip` for tasks). Does **not** update `last_done_at` or `lightenedItems`.

## Props

```js
function RoutineRow({ routine, delay = 0, onMarkDone, onSkipToday, onLighten })
```

- `routine` — same shape as before (id, name, completion14d, suggestion, lightenedItems)
- `delay` — animation stagger (ms)
- `onMarkDone(routineId)` — maps to existing `handleMarkRoutineDone`
- `onSkipToday(routineId)` — new, maps to new `handleSkipRoutineToday`
- `onLighten(routineId)` — maps to existing `handleLightenRoutine`

## TodayTab change

```jsx
// before
{routines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 80} onMarkDone={onMarkRoutineDone} onLighten={onLightenRoutine} onEdit={onEditRoutine} onShare={onShareCard}/>)}

// after
{routines.map((r, i) => <RoutineRow key={r.id} routine={r} delay={i * 80} onMarkDone={onMarkRoutineDone} onSkipToday={onSkipRoutineToday} onLighten={onLightenRoutine}/>)}
```

`TodayTab` receives `onSkipRoutineToday` as a new prop from `HeedApp`.

## Animation

`heed-fadeUp 0.5s ease both` with `animationDelay: \`${delay}ms\`` — same as other cards. Cancel animation on drag start via `el.style.animation = 'none'` (same fix as task cards).
