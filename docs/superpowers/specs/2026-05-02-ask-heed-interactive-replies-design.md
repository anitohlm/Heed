# Ask Heed — Interactive Replies Design

**Date:** 2026-05-02
**Status:** Approved

## Overview

Upgrade Ask Heed's chat replies from plain text to interactive messages: inline action pills for concrete proposals, a preview-then-confirm flow when the user taps an action, and contextual follow-up chips that always appear below every reply to keep the conversation flowing.

Four pieces change or are added:
1. Message data structure gains optional `actions` and `chips` arrays
2. `AssistantBubble` rendering gains action pills, a preview card, a confirmed state, and a chip row
3. Backend gains a `suggest_followups` tool and emits two new stream event types (`action`, `chips`)
4. New `POST /api/execute_action` endpoint executes confirmed actions

Nothing about the input area, send flow, or thinking/streaming animation changes.

---

## Data Structures

### Extended message object
```js
{
  role: 'user' | 'assistant',
  content: string,
  // assistant-only, optional:
  actions: Array<{
    type: string,       // 'mark_done' | 'skip' | 'defer' | 'lighten_routine' | 'add_context'
    emoji: string,
    label: string,
    payload: object,    // routine_id, task_id, duration_days, etc.
    confirmed?: boolean,
    summary?: string    // set after execution: "Morning Routine lightened for 7 days"
  }>,
  chips: Array<{ emoji: string, text: string }>
}
```

`actions` is empty for most replies. `chips` always has 2–3 items on every assistant message.

### New NDJSON stream event types

Emitted before the existing `done` event:

```json
{ "type": "action", "action_type": "lighten_routine", "label": "Lighten it", "emoji": "🪶", "payload": { "routine_id": "abc", "duration_days": 7, "preview": { "remove": [{"name": "Stretching", "duration_min": 5}, {"name": "Morning journal", "duration_min": 10}], "keep": ["Meditation", "Cold shower"] } } }
{ "type": "chips", "chips": [{ "emoji": "🌿", "text": "What else should I know?" }, { "emoji": "📋", "text": "Show me what's overdue" }] }
```

The `payload.preview` field carries everything the preview card needs to render — no extra API call between tap and Confirm. The backend must populate it when emitting the `action` event. For `mark_done` and `skip` the preview is simpler (just the task name); for `lighten_routine` it includes the remove/keep lists.

### Execute action request / response
```js
// Request
POST /api/execute_action
{ "action_type": "lighten_routine", "payload": { "routine_id": "abc", "duration_days": 7 } }

// Response
{ "ok": true, "summary": "Stretching + journaling paused for 7 days" }
```

---

## UI Components

### AssistantBubble — three states

**State 1 — Default reply**
- Reply text rendered as before
- Below the text, a separator line, then action pills (if any): colored background, colored border, emoji + label. Visual weight signals "do something".
- Below action pills: chip row — subtle grey background, grey border, small font. Visual weight signals "keep talking".

**State 2 — Preview card (after tapping an action pill)**
- Action pills replaced by an inline preview card within the same bubble.
- Card shows: title ("Preview — Lighten Morning Routine"), list of what will be removed (with durations), list of what will be kept, duration.
- Two buttons: **Confirm** (full-width green) and **Cancel** (smaller, ghost).
- Chips remain visible and tappable below the card.
- Cancel restores the action pills.

**State 3 — Confirmed**
- Preview card replaced by a compact done row: green check icon, bold action name, one-line summary of what changed.
- This state is permanent — user can scroll back and see what was done.
- Chips remain visible below.

### Visual hierarchy

| Element | Style |
|---|---|
| Action pills | Colored bg + border (green for lighten/skip, blue for defer), 13px |
| Chip row | Dark bg, subtle grey border, 11px, muted color |
| Preview card | Dark green tinted bg, green border, 12px |
| Confirm button | Full green, bold |
| Done row | Green check, 12px summary |

---

## Backend Changes

### agents/advisor.py

**New tool: `suggest_followups`**
```python
{
    "name": "suggest_followups",
    "description": "Suggest 2-3 contextual follow-up chips to show the user after your response.",
    "parameters": {
        "type": "object",
        "properties": {
            "chips": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "emoji": { "type": "string" },
                        "text":  { "type": "string" }
                    },
                    "required": ["emoji", "text"]
                },
                "minItems": 2,
                "maxItems": 3
            }
        },
        "required": ["chips"]
    }
}
```

Added to the existing `TOOLS` list alongside `propose_action`.

**Tool dispatch** — handle `suggest_followups` by yielding a `chips` event; handle `propose_action` by yielding an `action` event (instead of the current no-op / internal-only behavior).

### agents/prompts/advisor_system.md

Add to the end of the system prompt:

> Always call `suggest_followups` at the end of every response with 2–3 chips relevant to what you just said. Chips should be specific to the conversation, not generic ("Tell me about my evening routine" beats "Tell me more").

### functions/function_app.py

**New route: `POST /api/execute_action`**
- Receives `{ action_type, payload }`
- Dispatches to the appropriate internal function (same helpers the advisor already calls)
- Supported action types: `mark_done`, `skip`, `defer`, `lighten_routine`, `add_context`
- Returns `{ ok: true, summary: string }` on success, `{ ok: false, error: string }` on failure

---

## Frontend Changes (page.jsx)

### useChat hook

**Parse new event types in `send()`:**
```js
case 'action':  pendingActions.push(event);  break;
case 'chips':   pendingChips = event.chips;  break;
```
Both attached to the message object when the `done` event fires.

**New `executeAction(messageIndex, actionIndex)` function:**
1. Set loading state on the specific action (disables Confirm button, shows spinner)
2. `POST /api/execute_action` with `{ action_type, payload }`
3. On success: update `messages[messageIndex].actions[actionIndex]` to `{ ...action, confirmed: true, summary }`
4. On error: show inline error text inside the preview card, restore Confirm button

**Chip tap:**
Calls existing `send(chip.text)` — identical to tapping a suggestion chip on the empty state. No new logic.

---

## Interaction Flow

```
User opens Ask Heed
  → Asks question or taps suggestion chip

Agent streams response
  → may call propose_action  → emits "action" event
  → calls suggest_followups  → emits "chips" event
  → streams text deltas
  → emits "done"

useChat attaches actions + chips to message

AssistantBubble renders:
  [text]
  [action pill: 🪶 Lighten it]  [action pill: ⏭ Skip week]
  ─────────────────────────────────────
  [chip: What's overdue?]  [chip: Tell me more]  [chip: Thanks]

User taps action pill
  → Action pills replaced by preview card
  → Preview shows exact changes + Confirm/Cancel

User taps Confirm
  → POST /api/execute_action
  → Preview card replaced by done row: ✓ Morning Routine lightened

User taps chip
  → send(chip.text) → new user message → new response cycle
```

---

## Error Handling

- If `execute_action` fails: inline error inside the preview card ("Couldn't apply this change — try again"), Confirm button restored.
- If agent doesn't call `suggest_followups` (shouldn't happen but might): no chip row rendered, no crash.
- If agent doesn't call `propose_action`: no action pills rendered, only chips.

---

## Out of Scope

- Undo after confirming an action
- Multiple actions in a single reply (design supports it via array, but agent will typically propose one)
- Persisting conversation history across page refreshes
- Changes to `AskInlineModal` (same component, inherits all changes automatically)
