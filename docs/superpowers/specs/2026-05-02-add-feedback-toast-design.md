# Design: Add Feedback Toast on Task / Routine Creation

**Date:** 2026-05-02
**Status:** Approved

---

## Problem

When a user adds a task or routine, the modal closes and the app silently switches to the Today tab. There is no confirmation that the action succeeded and no quick path to see the new item in context.

---

## Solution

A toast notification slides up from the bottom after a successful add. It auto-dismisses after 3 seconds. A "View Tracks" button on the right lets the user jump directly to the Tracks tab where the new item appears.

---

## Architecture

All changes are confined to `web/app/page.jsx`. No new files, no new dependencies.

### State

```js
const [toast, setToast] = useState(null) // { message: string } | null
```

Added to the main `App` component alongside existing state (tasks, routines, tab, modals).

### Auto-dismiss

```js
useEffect(() => {
  if (!toast) return
  const t = setTimeout(() => setToast(null), 3000)
  return () => clearTimeout(t)
}, [toast])
```

The cleanup function prevents a stale timer from clearing a newer toast if two adds happen in quick succession.

### Trigger points

| Handler | Condition | Message |
|---|---|---|
| `handleAddTask` | `resp.ok === true` | `"Task added"` |
| `handleAddRoutine` | always (frontend-only, no API call) | `"Routine added"` |

Both handlers already call `setTab('today')` after completion — this is kept unchanged. The toast appears on the Today tab.

### View action

```js
const handleToastView = useCallback(() => {
  setToast(null)
  setTab('tracks')
}, [])
```

---

## Toast Component

A new `Toast` function component in `page.jsx`:

- **Left**: `✓` checkmark + message text
- **Right**: "View Tracks" sage-green outlined button + `×` dismiss
- **Position**: `fixed`, `bottom: 24px`, centered horizontally, `z-index: 9999`
- **Animation**: slide-up entrance (`slideUp` keyframe, 0.4s `cubic-bezier(0.16,1,0.3,1)`)
- **Styling**: inline styles using existing design tokens

| Token | Value |
|---|---|
| Background | `#222B33` |
| Border | `1px solid #2A3540`, left accent `3px solid #8FB89A` |
| Message text | `#F5EDD8`, 13px, weight 500 |
| "View Tracks" button | sage border `#8FB89A`, sage text, transparent bg |
| Dismiss `×` | `#8A8270` |
| Shadow | `0 6px 22px rgba(0,0,0,0.45)` |

Rendered once at the bottom of the main `App` return, outside the tab panel, inside the app shell:

```jsx
{toast && (
  <Toast
    message={toast.message}
    onView={handleToastView}
    onDismiss={() => setToast(null)}
  />
)}
```

---

## Out of Scope

- Toast for context window adds (different flow, lower frequency)
- Toast stacking / queue (only one add can happen at a time in this UI)
- Error toasts (API errors are currently silent; not changed here)
- Animations on dismiss (slide-down exit animation; adds complexity for minimal gain)
