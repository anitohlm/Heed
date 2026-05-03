# Shareable Routine Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Share card" button to every RoutineCard that opens a bottom sheet where users can download or share a beautiful branded PNG image of their routine (three variants, three themes).

**Architecture:** All new code lives in `web/app/page.jsx` (the existing single-file pattern). New components — `ShareableCard`, `ShareCardSheet` — follow the existing inline-styles + Lora serif visual language. A `useShareCard` hook handles `html2canvas` capture and the Web Share API. `HeedApp` gets two new state variables (`shareCtx`, `shareOpen`) and mounts `ShareCardSheet` alongside the existing sheets.

**Tech Stack:** React 18, Next.js 14 ("use client"), inline styles, `html2canvas` (new dependency, dynamically imported), Web Share API

---

## File structure

| File | Change |
|---|---|
| `web/package.json` | Add `html2canvas` dependency |
| `web/app/page.jsx` | Add utility functions, `SHARE_THEMES`, `OwlSignature`, variant helpers, `ShareableCard`, `useShareCard`, `ShareCardSheet`; modify `RoutineCard`, `TodayTab`, `TracksTab`, `HeedApp` |

---

### Task 1: Install html2canvas

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install html2canvas**

Run from `web/` directory:
```
cd C:\Users\hmanito\Heed\web
npm install html2canvas
```

Expected output includes: `added 1 package` and no errors.

- [ ] **Step 2: Verify package.json was updated**

Open `web/package.json`. Confirm `"html2canvas": "..."` appears under `"dependencies"`.

- [ ] **Step 3: Commit**

```
git add web/package.json web/package-lock.json
git commit -m "feat: install html2canvas for routine card PNG export"
```

---

### Task 2: Utility functions + SHARE_THEMES constant

**Files:**
- Modify: `web/app/page.jsx` — insert after line 62 (end of `ROUTINES` constant), before `const CONTEXTS_PAST`

- [ ] **Step 1: Insert share-card helper block into page.jsx**

Find the line:
```js
const CONTEXTS_PAST = [
```
(currently line 63 in the file). Insert the following block immediately BEFORE it:

```js
// ── Share-card helpers ─────────────────────────────────────────
function computeStreakCount(completion14d) {
  let count = 0
  for (let i = completion14d.length - 1; i >= 0; i--) {
    if (!completion14d[i]) break
    count++
  }
  return count
}
function formatStartedDate(streakCount) {
  const d = new Date(Date.now() - streakCount * 86400000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function computeCompletionPct(completion14d) {
  return Math.round(completion14d.filter(Boolean).length / 14 * 100)
}

const SHARE_THEMES = {
  B: {
    bg:      'linear-gradient(160deg, #2c1c10 0%, #1a0c08 65%, #221510 100%)',
    accent:  '#c8a450',
    text:    '#fdf5e8',
    divider: 'rgba(255,255,255,0.1)',
    vertRule: null,
    owl: { body: '#d4a870', tuft: '#8a5030', eyeRing: '#f5e8d0', pupil: '#2a1510', beak: '#c8a450' },
  },
  D: {
    bg:      'linear-gradient(155deg, #1c3228 0%, #0e1e16 65%, #152820 100%)',
    accent:  '#a8c5a0',
    text:    '#e8f0e4',
    divider: 'rgba(255,255,255,0.1)',
    vertRule: null,
    owl: { body: '#c8d4b0', tuft: '#3a5030', eyeRing: '#e8f4e0', pupil: '#1a2818', beak: '#88b070' },
  },
  E: {
    bg:      'linear-gradient(170deg, #f5ede8 0%, #edddd4 55%, #e5d0c0 100%)',
    accent:  '#8a5444',
    text:    '#1c1218',
    divider: '#8a544433',
    vertRule: 'linear-gradient(180deg, #8a544466, transparent)',
    owl: { body: '#8a5444', tuft: '#5a2820', eyeRing: '#f0e0d0', pupil: '#1c0808', beak: '#c87850' },
  },
}
```

- [ ] **Step 2: Verify build passes**

```
cd C:\Users\hmanito\Heed\web
npm run build
```

Expected: no errors. Warnings about `img` elements are fine.

- [ ] **Step 3: Verify streak logic manually**

Start dev server (`npm run dev`), open browser at `http://localhost:3000`, open DevTools console, paste:

```js
// Should return 0 — today (index 13) is false in both mock routines
console.log(computeStreakCount([true,true,true,true,false,false,true,true,true,false,true,true,false,false])) // 0
// Should return a positive number when today is true
console.log(computeStreakCount([false,false,true,true,true,false,true,true,true,false,true,true,true,true])) // 4
console.log(computeCompletionPct([true,true,true,true,false,false,true,true,true,false,true,true,false,false])) // 71
console.log(formatStartedDate(4)) // e.g. "Apr 29, 2026" (4 days ago)
```

(Note: `computeStreakCount` and friends are module-scope, so accessible in console when devtools is open on the page.)

- [ ] **Step 4: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add share-card utility functions and SHARE_THEMES config"
```

---

### Task 3: OwlSignature component

**Files:**
- Modify: `web/app/page.jsx` — insert immediately after the closing `}` of `MayaOwl` (after the line `}` that ends around line 747)

- [ ] **Step 1: Insert OwlSignature after MayaOwl**

Find the comment line `// ── Shared components ──────────────────────────────────────────` (currently after MayaOwl). Insert the following block immediately BEFORE that comment:

```js
// ── OwlSignature (static — used in ShareableCard brand bar) ───
function OwlSignature({ oc, size = 20 }) {
  const h = Math.round(size * 23 / 20)
  return (
    <svg width={size} height={h} viewBox="0 0 200 230" fill="none" aria-hidden="true">
      <ellipse cx="100" cy="140" rx="58" ry="65" fill={oc.body}/>
      <path d="M 72 82 Q 66 58 79 50 Q 85 68 85 83 Z" fill={oc.tuft}/>
      <path d="M 128 82 Q 134 58 121 50 Q 115 68 115 83 Z" fill={oc.tuft}/>
      <ellipse cx="100" cy="155" rx="36" ry="46" fill={oc.eyeRing} opacity="0.35"/>
      <circle cx="78" cy="100" r="20" fill={oc.eyeRing}/>
      <circle cx="122" cy="100" r="20" fill={oc.eyeRing}/>
      <ellipse cx="78" cy="100" rx="10" ry="10" fill={oc.pupil}/>
      <ellipse cx="122" cy="100" rx="10" ry="10" fill={oc.pupil}/>
      <circle cx="80" cy="96" r="3.5" fill={oc.eyeRing} opacity="0.7"/>
      <circle cx="124" cy="96" r="3.5" fill={oc.eyeRing} opacity="0.7"/>
      <path d="M 100 113 L 92 124 Q 100 130 108 124 Z" fill={oc.beak}/>
    </svg>
  )
}
```

- [ ] **Step 2: Verify build**

```
cd C:\Users\hmanito\Heed\web
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add OwlSignature static SVG component"
```

---

### Task 4: ShareableCard component

**Files:**
- Modify: `web/app/page.jsx` — insert immediately before `// ── RoutineCard ────────────────────────────────────────────────`

- [ ] **Step 1: Insert all four components before RoutineCard**

Find the comment `// ── RoutineCard ────────────────────────────────────────────────` and insert the following block immediately BEFORE it:

```js
// ── ShareableCard sub-variants ────────────────────────────────
function StreakVariant({ routine, t, streak, startedDate }) {
  return (
    <>
      <div style={{ fontSize: 26, fontWeight: 700, color: t.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
        My {routine.name}
      </div>
      <div style={{ fontFamily: 'Lora, serif', fontSize: 200, fontWeight: 700, color: t.text, lineHeight: 0.85, marginBottom: 12 }}>
        {streak}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: t.accent, letterSpacing: 6, textTransform: 'uppercase', marginBottom: 14 }}>
        DAY STREAK
      </div>
      <div style={{ fontSize: 18, color: t.text, opacity: 0.45, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 64 }}>
        STARTED {startedDate.toUpperCase()}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {routine.completion14d.map((done, i) => (
          <svg key={i} width="32" height="36" viewBox="0 0 16 18" fill="none" aria-hidden="true">
            <path d="M8 1 C8 1, 15 5, 15 10 C15 14, 12 17, 8 17 C4 17, 1 14, 1 10 C1 5, 8 1, 8 1 Z"
              fill={done ? t.accent : 'transparent'}
              stroke={done ? t.accent : `${t.accent}44`}
              strokeWidth="1.5"
            />
          </svg>
        ))}
      </div>
      <div style={{ fontSize: 18, color: t.text, opacity: 0.4, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'auto' }}>
        Last 14 days
      </div>
    </>
  )
}

function ProgressVariant({ routine, t, pct }) {
  const r = 120
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  return (
    <>
      <div style={{ fontSize: 26, fontWeight: 700, color: t.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 48 }}>
        My {routine.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, marginBottom: 48 }}>
        <div style={{ position: 'relative', width: 300, height: 300 }}>
          <svg width="300" height="300" viewBox="0 0 300 300" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="150" cy="150" r={r} fill="none" stroke={`${t.accent}22`} strokeWidth="18"/>
            <circle cx="150" cy="150" r={r} fill="none" stroke={t.accent} strokeWidth="36" opacity="0.12"/>
            <circle cx="150" cy="150" r={r} fill="none" stroke={t.accent} strokeWidth="18" strokeLinecap="round"
              strokeDasharray={`${filled} ${circ}`}/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Lora, serif', fontSize: 80, fontWeight: 700, color: t.text, lineHeight: 1 }}>
              {pct}%
            </span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text, opacity: 0.45, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 'auto' }}>
        COMPLETED · LAST 14 DAYS
      </div>
    </>
  )
}

function RoutineVariant({ routine, t, pct }) {
  return (
    <>
      <div style={{ fontFamily: 'Lora, serif', fontSize: 56, fontWeight: 700, color: t.text, lineHeight: 1.15, marginBottom: 18 }}>
        My {routine.name}
      </div>
      <div style={{ fontSize: 22, color: t.text, opacity: 0.5, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 56 }}>
        {routine.schedule}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 'auto' }}>
        {routine.items.map((item, i) => (
          <span key={i} style={{
            padding: '14px 26px', borderRadius: 999,
            background: `${t.accent}1a`,
            border: `1.5px solid ${t.accent}55`,
            fontSize: 20, color: t.text, fontWeight: 500,
          }}>{item}</span>
        ))}
      </div>
      <div style={{ alignSelf: 'flex-start', padding: '12px 24px', borderRadius: 999, background: `${t.accent}1a`, border: `1px solid ${t.accent}44`, display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 48 }}>
        <span style={{ fontFamily: 'Lora, serif', fontSize: 26, fontWeight: 700, color: t.accent }}>{pct}%</span>
        <span style={{ fontSize: 16, color: t.text, opacity: 0.55, letterSpacing: 1.5, textTransform: 'uppercase' }}>· 14d</span>
      </div>
    </>
  )
}

// ── ShareableCard ──────────────────────────────────────────────
function ShareableCard({ routine, variant = 'streak', theme = 'B' }) {
  const _uid = React.useId().replace(/:/g, '')  // unique per render instance (preview vs hidden)
  const t = SHARE_THEMES[theme]
  const streak = computeStreakCount(routine.completion14d)
  const pct = computeCompletionPct(routine.completion14d)
  const startedDate = formatStartedDate(streak)
  const uid = `${_uid}-${routine.id}-${theme}`
  const padLeft = t.vertRule ? 38 : 0
  return (
    <div style={{
      width: 750, height: 1000,
      background: t.bg,
      borderRadius: 24,
      padding: `60px 56px 48px 56px`,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.25)',
      fontFamily: '"Nunito Sans", -apple-system, sans-serif',
    }}>
      {/* Noise texture overlay */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.04 }} aria-hidden="true">
        <filter id={`${uid}-noise`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter={`url(#${uid}-noise)`}/>
      </svg>
      {/* Corner arc decoration */}
      <svg style={{ position: 'absolute', top: 0, right: 0, width: 220, height: 220, pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
        <circle cx="220" cy="0" r="130" fill="none" stroke={t.accent} strokeWidth="0.6" opacity="0.4"/>
        <circle cx="220" cy="0" r="175" fill="none" stroke={t.accent} strokeWidth="0.4" opacity="0.2"/>
      </svg>
      {/* Vertical rule for theme E */}
      {t.vertRule && (
        <div style={{ position: 'absolute', left: 30, top: 60, bottom: 60, width: 1.5, background: t.vertRule }}/>
      )}
      {/* Card content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: padLeft, minHeight: 0 }}>
        {variant === 'streak'   && <StreakVariant   routine={routine} t={t} streak={streak} startedDate={startedDate}/>}
        {variant === 'progress' && <ProgressVariant routine={routine} t={t} pct={pct}/>}
        {variant === 'routine'  && <RoutineVariant  routine={routine} t={t} pct={pct}/>}
      </div>
      {/* Brand bar */}
      <div style={{ borderTop: `1px solid ${t.divider}`, paddingTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: padLeft }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <OwlSignature oc={t.owl} size={20}/>
          <span style={{ fontFamily: 'Lora, serif', fontWeight: 700, fontSize: 20, color: t.accent, letterSpacing: 0.5 }}>heed</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.text, opacity: 0.25, letterSpacing: 3, textTransform: 'uppercase' }}>RITUAL</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```
cd C:\Users\hmanito\Heed\web
npm run build
```

Expected: no errors.

- [ ] **Step 3: Visually verify ShareableCard renders**

Start dev server (`npm run dev`). In `HeedApp`'s return JSX, temporarily add this line just before the closing `</main>` tag (line ~3509):

```jsx
<div style={{ padding: 20 }}>
  <ShareableCard routine={ROUTINES[0]} variant="streak" theme="B"/>
</div>
```

Open `http://localhost:3000`. You should see a full 750×1000px dark gold card with "My Morning routine", a large streak number, and leaf dots. Verify themes D and E by changing the `theme` prop.

- [ ] **Step 4: Remove the temporary debug render**

Remove the `<div style={{ padding: 20 }}>...<ShareableCard .../>...</div>` block you added in Step 3.

- [ ] **Step 5: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add ShareableCard component (streak, progress, routine variants)"
```

---

### Task 5: useShareCard hook

**Files:**
- Modify: `web/app/page.jsx` — insert immediately before `// ── ShareableCard sub-variants ────────────────────────────────`

- [ ] **Step 1: Insert useShareCard hook**

Find the comment `// ── ShareableCard sub-variants ────────────────────────────────` (added in Task 4). Insert this block immediately BEFORE it:

```js
// ── useShareCard ──────────────────────────────────────────────
function useShareCard() {
  async function captureCard(el) {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(el, { scale: 1, useCORS: true, logging: false })
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  }

  async function downloadCard(el, filename) {
    const blob = await captureCard(el)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function shareCard(el, filename, onFallback) {
    const blob = await captureCard(el)
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    onFallback?.()
  }

  return { downloadCard, shareCard }
}
```

- [ ] **Step 2: Verify build**

```
cd C:\Users\hmanito\Heed\web
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add useShareCard hook (html2canvas + Web Share API)"
```

---

### Task 6: ShareCardSheet component

**Files:**
- Modify: `web/app/page.jsx` — insert immediately before `// ── ContextDetailSheet ─────────────────────────────────────────`

- [ ] **Step 1: Insert ShareCardSheet**

Find the comment `// ── ContextDetailSheet ─────────────────────────────────────────` (currently around line 3046). Insert the following block immediately BEFORE it:

```js
// ── ShareCardSheet ─────────────────────────────────────────────
function ShareCardSheet({ open, routine, onClose }) {
  const [variant, setVariant] = useState('streak')
  const [shareTheme, setShareTheme] = useState('B')
  const [loading, setLoading] = useState(false)
  const [fallbackToast, setFallbackToast] = useState(false)
  const hiddenRef = useRef(null)
  const { downloadCard, shareCard } = useShareCard()

  useEffect(() => {
    const saved = localStorage.getItem('heed_shareTheme')
    if (saved && SHARE_THEMES[saved]) setShareTheme(saved)
  }, [])
  useEffect(() => {
    localStorage.setItem('heed_shareTheme', shareTheme)
  }, [shareTheme])
  useEffect(() => {
    if (!fallbackToast) return
    const id = setTimeout(() => setFallbackToast(false), 3500)
    return () => clearTimeout(id)
  }, [fallbackToast])

  if (!open || !routine) return null

  const slug = routine.name.toLowerCase().replace(/\s+/g, '-')
  const filename = `heed-${slug}-${variant}.png`

  async function handleDownload() {
    setLoading(true)
    try { await downloadCard(hiddenRef.current, filename) }
    finally { setLoading(false) }
  }

  async function handleShare() {
    setLoading(true)
    try { await shareCard(hiddenRef.current, filename, () => setFallbackToast(true)) }
    finally { setLoading(false) }
  }

  const VARIANTS = [['streak', 'Streak'], ['progress', 'Progress'], ['routine', 'Routine']]
  const THEME_DOT_COLORS = { B: '#c8a450', D: '#a8c5a0', E: '#8a5444' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: C.paper, borderRadius: '20px 20px 0 0',
        padding: `22px 22px calc(22px + env(safe-area-inset-bottom)) 22px`,
        animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* Drag handle */}
        <div style={{ width: 32, height: 4, background: '#e0d8d0', borderRadius: 999, margin: '0 auto 18px' }}/>

        {/* Title */}
        <div style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 20, textAlign: 'center' }}>
          Share your routine card
        </div>

        {/* Card preview — 138×184 = 750×1000 scaled by 0.184 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 138, height: 184, borderRadius: 5, overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
            <div style={{ width: 750, height: 1000, transform: 'scale(0.184)', transformOrigin: 'top left' }}>
              <ShareableCard routine={routine} variant={variant} theme={shareTheme}/>
            </div>
          </div>
        </div>

        {/* Variant tabs */}
        <div style={{ background: '#f5f0ea', borderRadius: 10, padding: 4, display: 'flex', gap: 4, marginBottom: 16 }}>
          {VARIANTS.map(([v, label]) => (
            <button key={v} onClick={() => setVariant(v)} style={{
              flex: 1, padding: '8px 0', borderRadius: 7,
              fontSize: 13, fontWeight: variant === v ? 700 : 500,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: variant === v ? '#fff' : 'transparent',
              color: variant === v ? C.warmDark : C.inkSoft,
              boxShadow: variant === v ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* Theme dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Theme</span>
          <div style={{ display: 'flex', gap: 10 }}>
            {Object.entries(THEME_DOT_COLORS).map(([key, color]) => (
              <button key={key} aria-label={`Theme ${key}`} onClick={() => setShareTheme(key)} style={{
                width: 26, height: 26, borderRadius: '50%',
                background: color, border: 'none', cursor: 'pointer',
                outline: shareTheme === key ? `3px solid ${color}` : '3px solid transparent',
                outlineOffset: 3,
                boxShadow: shareTheme === key ? `0 0 0 2px ${C.paper}` : 'none',
                transition: 'all 0.15s',
              }}/>
            ))}
          </div>
        </div>

        {/* Button row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={loading} onClick={handleDownload} style={{
            flex: 2, padding: '13px 0', borderRadius: 10, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: '#3d2b1f', color: '#fdf5e8',
            fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s',
          }}>
            {loading ? 'Saving…' : '⬇ Download PNG'}
          </button>
          <button disabled={loading} onClick={handleShare} style={{
            flex: 1, padding: '13px 0', borderRadius: 10,
            background: 'transparent', border: `1.5px solid #e0d4c8`,
            color: C.ink, fontSize: 14, fontWeight: 500,
            fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s',
          }}>
            ↗ Share
          </button>
        </div>

        {/* Fallback toast */}
        {fallbackToast && (
          <div style={{ marginTop: 12, padding: '8px 14px', background: C.bellySoft, borderRadius: 8, fontSize: 12, color: C.inkSoft, textAlign: 'center', animation: 'heed-fadeIn 0.2s ease' }}>
            Saved to downloads — share from there
          </div>
        )}

        {/* Hidden full-size card for html2canvas capture */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
          <div ref={hiddenRef}>
            <ShareableCard routine={routine} variant={variant} theme={shareTheme}/>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```
cd C:\Users\hmanito\Heed\web
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add web/app/page.jsx
git commit -m "feat: add ShareCardSheet bottom sheet component"
```

---

### Task 7: Wire RoutineCard, TodayTab, TracksTab, and HeedApp

**Files:**
- Modify: `web/app/page.jsx` — four locations

- [ ] **Step 1: Add onShare prop + "Share card" button to RoutineCard**

Find this line in `RoutineCard` (currently around line 1309):
```js
function RoutineCard({ routine, delay = 0, onMarkDone, onLighten, onEdit }) {
```

Replace it with:
```js
function RoutineCard({ routine, delay = 0, onMarkDone, onLighten, onEdit, onShare }) {
```

Then find the action-row button group at the bottom of `RoutineCard` (around line 1407–1411):
```jsx
      <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={getBtnPrimary()} onClick={() => onMarkDone && onMarkDone(routine.id)}>Mark today done</button>
        {isAttentionWorthy && <button style={{ ...getBtnPrimary(), background: C.ochre, color: C.warmDeep }} onClick={() => onLighten && onLighten(routine.id)}>Lighten this week</button>}
        <button style={getBtnGhost()} onClick={() => onEdit && onEdit(routine)}>Edit</button>
      </div>
```

Replace it with:
```jsx
      <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={getBtnPrimary()} onClick={() => onMarkDone && onMarkDone(routine.id)}>Mark today done</button>
        {isAttentionWorthy && <button style={{ ...getBtnPrimary(), background: C.ochre, color: C.warmDeep }} onClick={() => onLighten && onLighten(routine.id)}>Lighten this week</button>}
        <button style={getBtnGhost()} onClick={() => onEdit && onEdit(routine)}>Edit</button>
        <button style={getBtnGhost()} onClick={() => onShare && onShare(routine)}>Share card</button>
      </div>
```

- [ ] **Step 2: Add onShareCard prop to TodayTab and thread it to RoutineCard**

Find `TodayTab`'s function signature (around line 1517):
```js
function TodayTab({ tasks, routines, upcomingContexts, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine, onAskHeed, onMoreOptions }) {
```

Replace with:
```js
function TodayTab({ tasks, routines, upcomingContexts, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine, onAskHeed, onMoreOptions, onShareCard }) {
```

Find the `RoutineCard` usage inside `TodayTab` (around line 1531):
```jsx
        {routines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 80} onMarkDone={onMarkRoutineDone} onLighten={onLightenRoutine} onEdit={onEditRoutine}/>)}
```

Replace with:
```jsx
        {routines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 80} onMarkDone={onMarkRoutineDone} onLighten={onLightenRoutine} onEdit={onEditRoutine} onShare={onShareCard}/>)}
```

- [ ] **Step 3: Add onShareCard prop to TracksTab and thread it to RoutineCard**

Find `TracksTab`'s function signature (around line 1652):
```js
function TracksTab({ tasks, routines, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine, onAddTask, onAddRoutine, onMoreOptions }) {
```

Replace with:
```js
function TracksTab({ tasks, routines, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine, onAddTask, onAddRoutine, onMoreOptions, onShareCard }) {
```

Find the `RoutineCard` usage inside `TracksTab` (around line 1671):
```jsx
          {routines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 50} onMarkDone={onMarkRoutineDone} onLighten={onLightenRoutine} onEdit={onEditRoutine}/>)}
```

Replace with:
```jsx
          {routines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 50} onMarkDone={onMarkRoutineDone} onLighten={onLightenRoutine} onEdit={onEditRoutine} onShare={onShareCard}/>)}
```

- [ ] **Step 4: Add shareCtx / shareOpen state and handlers to HeedApp**

In `HeedApp`, find the block of state declarations that ends with:
```js
  const [detailCtx, setDetailCtx] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
```

Add two more lines immediately after:
```js
  const [shareCtx, setShareCtx] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
```

Then find (around line 3388):
```js
  const handleEditRoutine = useCallback((routine) => {
```

Add the following two handlers immediately BEFORE it:
```js
  const handleShareOpen = useCallback((routine) => {
    setShareCtx(routine)
    setShareOpen(true)
  }, [])

  const handleShareClose = useCallback(() => {
    setShareOpen(false)
  }, [])

```

- [ ] **Step 5: Mount ShareCardSheet in HeedApp's JSX**

Find the last rendered sheet in HeedApp's JSX (the `<ContextDetailSheet ... />` block, around line 3523). Add the following line immediately BEFORE the `{toast && <Toast .../>}` line:

```jsx
      <ShareCardSheet open={shareOpen} routine={shareCtx} onClose={handleShareClose}/>
```

- [ ] **Step 6: Pass onShareCard to TodayTab and TracksTab in JSX**

Find the `TodayTab` usage in HeedApp's JSX (around line 3504):
```jsx
        {tab === 'today' && <TodayTab tasks={displayTasks} routines={routines} upcomingContexts={upcomingContexts} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAskHeed={handleAskHeed} onMoreOptions={handleMoreOptions}/>}
```

Replace with:
```jsx
        {tab === 'today' && <TodayTab tasks={displayTasks} routines={routines} upcomingContexts={upcomingContexts} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAskHeed={handleAskHeed} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen}/>}
```

Find the `TracksTab` usage (around line 3507):
```jsx
        {tab === 'tracks' && <TracksTab tasks={displayTasks} routines={routines} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAddTask={() => setModalOpen(true)} onAddRoutine={() => setRoutineModalOpen(true)} onMoreOptions={handleMoreOptions}/>}
```

Replace with:
```jsx
        {tab === 'tracks' && <TracksTab tasks={displayTasks} routines={routines} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAddTask={() => setModalOpen(true)} onAddRoutine={() => setRoutineModalOpen(true)} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen}/>}
```

- [ ] **Step 7: Verify build**

```
cd C:\Users\hmanito\Heed\web
npm run build
```

Expected: no errors.

- [ ] **Step 8: End-to-end test in browser**

Start dev server:
```
cd C:\Users\hmanito\Heed\web
npm run dev
```

Open `http://localhost:3000`. Verify the following:

1. **Today tab** → Morning routine card → "Share card" button visible in action row.
2. Click "Share card" → bottom sheet slides up with card preview, variant tabs (Streak/Progress/Routine), and theme dots (gold/sage/terracotta).
3. Click each variant tab → preview updates to streak / ring / items layout.
4. Click each theme dot → preview recolors (dark gold / forest green / rose nude).
5. Reload page → last selected theme is restored (localStorage persistence).
6. Click "⬇ Download PNG" → spinner briefly appears → PNG file downloads. Open the downloaded file and verify it looks like the card preview.
7. **Tracks tab** → same routine cards also have "Share card" button.
8. **Streak card note:** The mock routines both have `completion14d[13] = false` (today not done), so the streak count will show 0. This is correct — the card will read "0 DAY STREAK". To test with a non-zero streak, temporarily change `completion14d[13]` to `true` in the `ROUTINES` constant for visual verification.

- [ ] **Step 9: Commit**

```
git add web/app/page.jsx
git commit -m "feat: wire ShareCardSheet to RoutineCard, TodayTab, TracksTab, HeedApp"
```
