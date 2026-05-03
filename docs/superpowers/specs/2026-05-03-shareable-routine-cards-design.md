# Shareable Routine Cards Design

**Goal:** Let users download or share a beautiful branded image card of any routine — celebrating their streak, completion rate, or routine identity — to social media, messaging apps, or camera roll.

**Architecture:** All UI in `web/app/page.jsx`. A new `ShareCardSheet` bottom sheet (matching existing sheet patterns) contains a live `ShareableCard` preview with variant + theme pickers. PNG generation uses `html2canvas` on a hidden full-size card element. A new `useShareCard` hook handles capture + Web Share API. New state in `HeedApp`: `shareCtx` and `shareOpen`. A "Share card" button is added to `RoutineCard`'s action row.

**Tech Stack:** React 18, Next.js 14, inline styles (existing pattern), `html2canvas` (new dependency), Web Share API (native browser)

---

## 1. Card variants

Three variants — user picks one before sharing.

### Streak
- Hero: Lora serif, 700 weight, massive number (the current streak count)
- Sub-label: "DAY STREAK" — small caps, tracked, accent colour
- Date line: "STARTED [date]" — derived from `today − streakCount` days, muted uppercase
- 14-day leaf row: same leaf SVG motif as in-app, rendered as a horizontal row
- Suitable label: "Last 14 days" below the leaf row

Streak count computed from `routine.completion14d`: longest consecutive `true` run ending at index 13 (today).

Started date: `new Date(Date.now() - streakCount * 86400000)` formatted as "Apr 21, 2026".

### Progress
- Hero: Lora serif "87%" centred inside a circular progress ring (same ring as in-app, scaled up)
- Ring has a soft inner glow (duplicate stroke at 2× width, 12% opacity)
- Sub-label: "COMPLETED · LAST 14 DAYS" below the ring, muted uppercase
- Completion % = `Math.round(completion14d.filter(Boolean).length / 14 * 100)`

### Routine
- Title: "My [Routine Name]" — Lora serif, bold, dominant
- Schedule line: e.g. "Weekdays · 7:00 AM" — muted small caps
- Items: each `routine.items` entry as a pill chip (background + border in accent colour, same border treatment as in-app)
- Small stat badge at bottom: "87% · 14d" — compact summary, accent colour

---

## 2. Themes

Three themes selectable via dot pickers in the share sheet. Theme is persisted to `localStorage` under `heed_shareTheme` so the user's last choice is remembered.

### B · Dark Elevated
- Background: `linear-gradient(160deg, #2c1c10 0%, #1a0c08 65%, #221510 100%)`
- Accent: `#c8a450` (warm gold)
- Text: `#fdf5e8` (warm white — contrast ≥7:1 on bg)
- Owl colours: body `#d4a870`, tuft `#8a5030`, eye ring `#f5e8d0`, pupil `#2a1510`, beak `#c8a450`

### D · Forest Night
- Background: `linear-gradient(155deg, #1c3228 0%, #0e1e16 65%, #152820 100%)`
- Accent: `#a8c5a0` (sage green)
- Text: `#e8f0e4` (sage white — contrast ≥7:1 on bg)
- Owl colours: body `#c8d4b0`, tuft `#3a5030`, eye ring `#e8f4e0`, pupil `#1a2818`, beak `#88b070`

### E · Parisian Chic
- Background: `linear-gradient(170deg, #f5ede8 0%, #edddd4 55%, #e5d0c0 100%)`
- Accent: `#8a5444` (terracotta)
- Text: `#1c1218` (near-black — contrast ≥12:1 on bg)
- Thin vertical rule on left edge: `linear-gradient(180deg, #8a544466, transparent)`
- Owl colours: body `#8a5444`, tuft `#5a2820`, eye ring `#f0e0d0`, pupil `#1c0808`, beak `#c87850`

**Shared decorative elements on all themes:**
- Subtle noise texture: SVG `feTurbulence` overlay at 4% opacity
- Corner arc lines: two concentric arcs from top-right corner in accent colour (0.4–0.6px stroke, 20–40% opacity)
- Multi-layer box shadow: `0 8px 24px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.25)`

---

## 3. Brand signature (all cards, all variants)

Bottom of every card, separated by a 1px divider in theme colour:
- Maya owl SVG at 20×23px (static, no animation — snapshot of the idle pose): body, tufts, eye rings, pupils, beak only; no branch, no talons
- "heed" in Lora serif 700, accent colour, 0.5px letter-spacing
- "RITUAL" in tiny tracked uppercase, right-aligned, muted (22–30% opacity)

Owl colours are theme-specific (see per-theme spec above).

---

## 4. Card dimensions and export

**Actual exported image:** 750 × 1000 px (3:4). Rendered off-screen in a hidden `div` using real pixel dimensions, then captured via `html2canvas`.

**In-sheet preview:** 138 × 184 px (same 3:4 ratio). Renders the same `ShareableCard` component scaled down via `transform: scale(0.184)` with `transform-origin: top left` on a 138px-wide container (avoids re-rendering at a different size).

---

## 5. Share bottom sheet — `ShareCardSheet`

Triggered by the "Share card" button on `RoutineCard`. Follows the existing bottom sheet pattern: `position: fixed`, backdrop overlay, `heed-slideUp` animation, drag handle, `env(safe-area-inset-bottom)` padding, `zIndex: 200`.

**Layout (top to bottom):**
1. Drag handle (32 × 4 px, `#e0d8d0`)
2. Title: "Share your routine card" — Lora 15px bold
3. Card preview: 138 × 184 px container showing `ShareableCard` at scale
4. Variant tabs: `Streak | Progress | Routine` — pill tab group in `#f5f0ea` tray, active tab white with shadow
5. Theme dots: label "THEME" + three 26px circle dots (B/D/E), active dot has accent-coloured border + outer ring
6. Button row: "⬇ Download PNG" (primary, `#3d2b1f` bg) + "↗ Share" (ghost, `#e0d4c8` border)

**Download PNG:**
1. Set `shareLoading = true` (disables buttons, shows spinner on Download)
2. Render hidden full-size `ShareableCard` (750 × 1000 px) off-screen
3. `html2canvas(el, { scale: 1, useCORS: true })` → canvas → `.toBlob()`
4. Create object URL → `<a download="heed-[routineName]-[variant].png">` → `.click()` → revoke URL
5. Set `shareLoading = false`

**Share (Web Share API):**
1. Same capture flow as download
2. `navigator.share({ files: [new File([blob], 'heed-card.png', { type: 'image/png' })] })`
3. Fallback (Web Share not supported): trigger download instead; show toast "Saved to downloads — share from there"

---

## 6. New state in `HeedApp`

```js
const [shareCtx, setShareCtx]     = useState(null)   // routine object being shared
const [shareOpen, setShareOpen]   = useState(false)
```

`shareLoading` is local state inside `ShareCardSheet` (not hoisted to `HeedApp`) — it only affects the sheet's buttons during PNG capture.

Handler: `handleShareOpen(routine)` — sets `shareCtx = routine`, `shareOpen = true`.
Dismiss: `handleShareClose()` — sets `shareOpen = false` (keep `shareCtx` until animation ends).

---

## 7. Components to add / modify

| Component | Change |
|---|---|
| `ShareableCard` | New — pure render, no state. Props: `routine`, `variant`, `theme`. Renders at whatever size its container sets. |
| `ShareCardSheet` | New — bottom sheet with preview, tabs, dots, download + share buttons. Props: `open`, `routine`, `onClose`. |
| `useShareCard` | New hook — `captureCard(el)` → PNG blob. Handles html2canvas + Web Share API + download fallback. |
| `RoutineCard` | Add "Share card" button to action row (ghost style, after "Edit") |
| `HeedApp` | Add `shareCtx`, `shareOpen`, `handleShareOpen`, `handleShareClose`. Add `ShareCardSheet` to render tree. |

---

## 8. Mock data / derived data

No new mock data needed. All card content derives from the existing `routine` object:

| Card field | Source |
|---|---|
| Routine name | `routine.name` → `"My " + routine.name` |
| Schedule | `routine.schedule` |
| Items | `routine.items` |
| Streak count | Computed: longest consecutive `true` run from end of `routine.completion14d` |
| Started date | `new Date(Date.now() - streakCount * 86400000)` |
| Completion % | `Math.round(completion14d.filter(Boolean).length / 14 * 100)` |
| Leaf dots | `routine.completion14d` (14 booleans) |

---

## 9. New dependency

`html2canvas` — client-side DOM-to-canvas. Install: `npm install html2canvas`. Import only in the `useShareCard` hook (dynamic import to avoid SSR issues with Next.js).

```js
const html2canvas = (await import('html2canvas')).default
```

---

## 10. What doesn't change

- `ContextDetailSheet`, `QuickContextSheet`, `RecoverySummarySheet` — unchanged
- `AddContextModal`, `AddPlanSheet` — unchanged
- Bottom navigation, tabs, other sections — unchanged
- Existing `RoutineCard` layout — "Share card" button is additive to the existing action row
