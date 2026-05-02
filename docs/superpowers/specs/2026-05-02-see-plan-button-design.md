# Design: See Plan Button on Context Banner

**Date:** 2026-05-02
**Status:** Approved

---

## Problem

The `ContextBanner` on the Today tab shows an upcoming trip or event with a "See plan →" button. The button is currently dead — it has no `onClick` handler and shows nothing when clicked. Users have no way to see how Heed has planned around their upcoming event.

---

## Solution

Clicking "See plan →" expands the banner in-place to reveal a static, structured trip plan. A two-column layout shows Before / During / After sections. A "Ask Heed →" link at the bottom lets the user hand off to the full AI flow if they want more detail.

---

## Architecture

All changes are confined to `web/app/page.jsx`. No new files, no new dependencies.

### Data: `plan` field on CONTEXTS_UPCOMING

Each entry in `CONTEXTS_UPCOMING` gains a `plan` object:

```js
{
  type: 'travel',
  start: 'Apr 28, 2026',
  end: 'May 2, 2026',
  desc: 'Singapore trip',
  askQuery: 'Plan around my Singapore trip',
  plan: {
    before: [
      'Pay Maynilad & Meralco this week',
      'Submit timesheet (Friday)',
      'Refill water dispenser the day before you fly',
    ],
    during: [
      'Morning and evening routines paused automatically',
    ],
    after: [
      'Soft-start May 3 — essentials only',
      'Aircon cleaning can wait until that weekend',
    ],
  },
}
```

The `askQuery` string is used to pre-fill the Ask Heed input when the user taps "Ask Heed →".

### State

**`ContextBanner`** (local):
```js
const [planExpanded, setPlanExpanded] = useState(false)
```

**`App`** (lifted):
```js
const [askPrefill, setAskPrefill] = useState('')
```

### Component changes

| Component | Change |
|---|---|
| `ContextBanner` | Add `planExpanded` toggle, inline plan render, "Ask Heed →" link; accept `onAskHeed` prop |
| `TodayTab` | Accept and forward `onAskHeed` prop to `ContextBanner` |
| `App` | Add `askPrefill` state; add `handleAskHeed(query)` callback that sets `askPrefill` and calls `setTab('ask')`; pass `onAskHeed={handleAskHeed}` to `TodayTab` |
| `AskTab` | Accept `prefill` prop; `useEffect` on `prefill` change to populate the query input |

### Expanded banner layout

```
┌─────────────────────────────────────────────────────┐
│ ✈️  Upcoming · 6 days away                           │
│    Singapore trip Apr 28 – May 2. ...    [Hide ↑]   │
│ ─────────────────────────────────────────────────── │
│  BEFORE YOU LEAVE        WHILE AWAY                  │
│  · Pay Maynilad          · Routines paused           │
│  · Submit timesheet                                  │
│  · Refill water          WHEN YOU'RE BACK            │
│                          · Soft-start May 3          │
│                          · Aircon that weekend       │
│ ─────────────────────────────────────────────────── │
│  Want more detail? Ask Heed →                        │
└─────────────────────────────────────────────────────┘
```

The button label switches: "See plan →" when collapsed, "Hide plan ↑" when expanded.

### Ask Heed hand-off

When the user clicks "Ask Heed →":
1. `onAskHeed(ctx.askQuery)` fires
2. App sets `askPrefill = ctx.askQuery` and `tab = 'ask'`
3. `AskTab` receives `prefill` and populates the query input via `useEffect`
4. The user lands on the Ask Heed tab with the query ready — they submit it themselves

The user submits manually (not auto-submitted) so they can review or edit the query first.

---

## Styling

Follows existing Heed design tokens (`C` object):

| Element | Token |
|---|---|
| Divider between header and plan | `C.border` |
| "Before" label | `C.ochre` |
| "During" label | `C.sage` |
| "After" label | `C.inkMute` |
| Plan item text | `C.inkSoft` |
| "Ask Heed →" text | `C.sage` |
| Surrounding label text | `C.inkMute` |

---

## Out of Scope

- Auto-submitting the Ask Heed query (user lands on tab with prefill, submits themselves)
- Plans for non-travel contexts (illness, busy week) — `plan` field is optional; if absent, banner shows no expand button
- Editing or regenerating the static plan from within the banner
- Animation on expand/collapse (plain show/hide, consistent with existing modal patterns)
