# Responsive Botanical Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add phone/tablet responsive layout with hamburger drawer, replace the blue-grey palette with three selectable botanical themes (Parchment Light, Midnight Fern, Inkwash), theme-matched owl illustrations standing on a botanical branch, and botanical SVG section dividers.

**Architecture:** A new `themes.js` module holds all three palettes and owl colour maps. The existing module-level `C` object is replaced with a getter-based proxy that reads from a mutable `themeState.current` at render time — no React context, no prop drilling — so every `C.xxx` reference in the existing 22+ components picks up the active theme automatically on re-render. Responsive breakpoints are driven by CSS classes in `globals.css` and existing `<style>` block in page.jsx; no new dependencies.

**Tech Stack:** Next.js 14.2 (static export), React 18.3, plain inline styles + CSS media queries, SVG for owl and botanical motifs.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `web/app/themes.js` | **Create** | THEMES palettes, OWL_THEMES, themeState, setThemeState |
| `web/app/page.jsx` | **Modify** | Replace C object, add getter proxy, factory fns, MayaOwl rewrite, ThemeSwitcher, MobileDrawer, BotanicalDivider, responsive header/nav/main, SectionHeader update |
| `web/app/globals.css` | **Modify** | Responsive utility classes + media queries |

---

## Task 1: Create `web/app/themes.js`

**Files:**
- Create: `web/app/themes.js`

- [ ] **Step 1: Write the file**

```javascript
// web/app/themes.js

export const THEMES = {
  'parchment-light': {
    cream:      '#F5F0E6',
    paper:      '#EDE7D7',
    paperHi:    '#F9F6EE',
    border:     '#D4C9A8',
    hairline:   '#E0D8C0',
    ink:        '#2A3522',
    inkSoft:    '#7A7060',
    inkMute:    '#A8987A',
    warm:       '#8B2E16',
    warmDark:   '#8B2E16',
    warmDeep:   '#F5F0E6',
    belly:      '#EDE7D7',
    bellySoft:  '#F0EAD8',
    rust:       '#8B2E16',
    rustSoft:   '#F0E4D8',
    sage:       '#4A7040',
    sageSoft:   '#DDE8D4',
    ochre:      '#8B4A20',
    ochreSoft:  '#F0E4D4',
    rose:       '#C06060',
    shadowSoft: '0 2px 12px rgba(0,0,0,0.08)',
    shadowMed:  '0 6px 22px rgba(0,0,0,0.12)',
  },
  'midnight-fern': {
    cream:      '#0E1A12',
    paper:      '#162218',
    paperHi:    '#1C2C1E',
    border:     '#2A4030',
    hairline:   '#1E3028',
    ink:        '#E8DEC4',
    inkSoft:    '#A09880',
    inkMute:    '#607860',
    warm:       '#C4553A',
    warmDark:   '#C4553A',
    warmDeep:   '#0E1A12',
    belly:      '#1C2C1E',
    bellySoft:  '#162218',
    rust:       '#C4553A',
    rustSoft:   '#2A1A14',
    sage:       '#6A9E6A',
    sageSoft:   '#1A2C1A',
    ochre:      '#C4703A',
    ochreSoft:  '#2A1C14',
    rose:       '#C47060',
    shadowSoft: '0 2px 12px rgba(0,0,0,0.4)',
    shadowMed:  '0 6px 22px rgba(0,0,0,0.5)',
  },
  'inkwash': {
    cream:      '#18140C',
    paper:      '#221C12',
    paperHi:    '#2C2418',
    border:     '#3E3222',
    hairline:   '#302818',
    ink:        '#F0E6C4',
    inkSoft:    '#B0A080',
    inkMute:    '#7A6A4A',
    warm:       '#A0682A',
    warmDark:   '#A0682A',
    warmDeep:   '#18140C',
    belly:      '#2C2418',
    bellySoft:  '#221C12',
    rust:       '#A0682A',
    rustSoft:   '#2A2010',
    sage:       '#6A9060',
    sageSoft:   '#1A2818',
    ochre:      '#A07030',
    ochreSoft:  '#2A2010',
    rose:       '#B07060',
    shadowSoft: '0 2px 12px rgba(0,0,0,0.5)',
    shadowMed:  '0 6px 22px rgba(0,0,0,0.6)',
  },
}

// Owl colours use cross-theme contrast rotation:
// parchment-light theme → brown bark owl
// midnight-fern theme   → parchment cream owl
// inkwash theme         → deep forest green owl
export const OWL_THEMES = {
  'parchment-light': {
    body:    '#6B4820',
    eyeRing: '#EDE7D7',
    pupil:   '#2A3522',
    tuft:    '#6A9060',
    beak:    '#A0682A',
    cheek:   '#D9907F',
  },
  'midnight-fern': {
    body:    '#D4C9A8',
    eyeRing: '#F9F6EE',
    pupil:   '#0E1A12',
    tuft:    '#6A9E6A',
    beak:    '#C4553A',
    cheek:   '#D9907F',
  },
  'inkwash': {
    body:    '#2A4A2E',
    eyeRing: '#F0E6C4',
    pupil:   '#18140C',
    tuft:    '#A0682A',
    beak:    '#A0682A',
    cheek:   '#C47060',
  },
}

export const DEFAULT_THEME = 'midnight-fern'

// Mutable state object shared with page.jsx's C getter proxy.
// setThemeState() is called synchronously at the top of HeedApp render.
export const themeState = {
  current: typeof window !== 'undefined'
    ? (localStorage.getItem('heed-theme') || DEFAULT_THEME)
    : DEFAULT_THEME,
}

export function setThemeState(name) {
  themeState.current = name
}
```

- [ ] **Step 2: Verify the file exists and has no syntax errors**

Run: `cd web && node -e "const t = require('./app/themes.js'); console.log(Object.keys(t))" 2>&1 || echo "Module check done (ESM expected)"`

Expected: Either prints keys or shows ESM error (that's fine — the `import` in page.jsx handles it).

- [ ] **Step 3: Commit**

```bash
git add web/app/themes.js
git commit -m "feat: add botanical themes module with three palettes and owl colour maps"
```

---

## Task 2: Replace `C` with getter proxy + update imports in `page.jsx`

**Files:**
- Modify: `web/app/page.jsx` (lines 1–21)

- [ ] **Step 1: Replace lines 1–21 with the new imports and getter-based `C`**

Replace this block:
```javascript
"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react'
import './globals.css'

// Functions backend URL — baked in at build time via NEXT_PUBLIC_FUNCTIONS_URL
const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 'http://localhost:7071'

// ── Design tokens ──────────────────────────────────────────────
const C = {
  cream: '#0F1419', paper: '#1A2128', paperHi: '#222B33',
  ink: '#F5EDD8', inkSoft: '#D8CDB1', inkMute: '#8A8270',
  warm: '#E0B36A', warmDark: '#D4A24C', warmDeep: '#0F1419',
  belly: '#3A3326', bellySoft: '#2C2820',
  rust: '#E8714C', rustSoft: '#3A1F18',
  sage: '#8FB89A', sageSoft: '#1F2D24',
  ochre: '#D4A24C', ochreSoft: '#2D2618',
  rose: '#D9907F',
  border: '#2A3540', hairline: '#1F2730',
  shadowSoft: '0 2px 12px rgba(0,0,0,0.35)',
  shadowMed: '0 6px 22px rgba(0,0,0,0.45)',
}
```

With:
```javascript
"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react'
import './globals.css'
import { THEMES, OWL_THEMES, themeState, setThemeState, DEFAULT_THEME } from './themes'

// Functions backend URL — baked in at build time via NEXT_PUBLIC_FUNCTIONS_URL
const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 'http://localhost:7071'

// ── Design tokens (getter proxy — reads active theme on each access) ──────
const C = {}
;['cream','paper','paperHi','border','hairline','ink','inkSoft','inkMute',
  'warm','warmDark','warmDeep','belly','bellySoft','rust','rustSoft','sage','sageSoft',
  'ochre','ochreSoft','rose','shadowSoft','shadowMed'].forEach(key => {
  Object.defineProperty(C, key, {
    get() { return THEMES[themeState.current][key] },
    enumerable: true,
  })
})
```

- [ ] **Step 2: Run build to check for import errors**

Run: `cd web && npx next build 2>&1 | tail -20`

Expected: Build completes. If you see "Cannot find module './themes'" — verify `web/app/themes.js` exists from Task 1.

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: replace C color object with getter proxy reading from themeState"
```

---

## Task 3: Convert style constants to factory functions + update all 30 usages

**Files:**
- Modify: `web/app/page.jsx` (lines 208–223 + all usages)

This task is mechanical but must be done carefully. `btnPrimary` / `btnGhost` / `fieldLabel` are module-level constants that captured C values at startup. They must become factory functions so each render call reads the live theme.

- [ ] **Step 1: Replace lines 208–223 with factory functions**

Replace:
```javascript
// ── Button styles ──────────────────────────────────────────────
const btnPrimary = {
  background: C.warmDark, color: C.cream, border: 'none',
  padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', letterSpacing: 0.2, fontFamily: 'inherit',
  transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
}
const btnGhost = {
  background: 'transparent', color: C.inkSoft,
  border: `1px solid ${C.border}`, padding: '7px 12px',
  borderRadius: 7, fontSize: 12.5, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
}
const fieldLabel = {
  display: 'block', fontSize: 11, fontWeight: 700, color: C.inkMute,
  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
}
```

With:
```javascript
// ── Button style factories (called each render so C reads current theme) ──
const getBtnPrimary = () => ({
  background: C.warmDark, color: C.cream, border: 'none',
  padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', letterSpacing: 0.2, fontFamily: 'inherit',
  transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
})
const getBtnGhost = () => ({
  background: 'transparent', color: C.inkSoft,
  border: `1px solid ${C.border}`, padding: '7px 12px',
  borderRadius: 7, fontSize: 12.5, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
})
const getFieldLabel = () => ({
  display: 'block', fontSize: 11, fontWeight: 700, color: C.inkMute,
  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
})
```

- [ ] **Step 2: Replace all 30 usages throughout page.jsx**

Use find-and-replace. Exact substitutions:

| Find | Replace with |
|------|-------------|
| `style={btnPrimary}` | `style={getBtnPrimary()}` |
| `style={btnGhost}` | `style={getBtnGhost()}` |
| `style={fieldLabel}` | `style={getFieldLabel()}` |
| `style={{ ...btnPrimary,` | `style={{ ...getBtnPrimary(),` |
| `style={{ ...btnGhost,` | `style={{ ...getBtnGhost(),` |

Verify count: after replacement, `btnPrimary` should appear 0 times (grep confirms), `getBtnPrimary` should appear 11 times (1 declaration + 10 usages). Same counts for ghost and fieldLabel.

- [ ] **Step 3: Verify with grep**

Run: `grep -c "btnPrimary\b" web/app/page.jsx && grep -c "getBtnPrimary" web/app/page.jsx`

Expected: `0` then `11`

Run: `grep -c "btnGhost\b" web/app/page.jsx && grep -c "getBtnGhost" web/app/page.jsx`

Expected: `0` then `11`

Run: `grep -c "fieldLabel\b" web/app/page.jsx && grep -c "getFieldLabel" web/app/page.jsx`

Expected: `0` then `11`

- [ ] **Step 4: Run build**

Run: `cd web && npx next build 2>&1 | tail -20`

Expected: Build passes with no errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: convert btnPrimary/btnGhost/fieldLabel to factory functions for theme reactivity"
```

---

## Task 4: Add theme state + ThemeSwitcher to HeedApp

**Files:**
- Modify: `web/app/page.jsx` (HeedApp function, header section)

- [ ] **Step 1: Add theme state and sync inside HeedApp**

Find the start of the HeedApp function (around line 1291). After the existing `useState` declarations, add:

```javascript
const [theme, setTheme] = useState(() => {
  if (typeof window !== 'undefined') return localStorage.getItem('heed-theme') || DEFAULT_THEME
  return DEFAULT_THEME
})
// Synchronously update themeState before render so all C.xxx reads get the right palette.
setThemeState(theme)

const handleSetTheme = useCallback((name) => setTheme(name), [])

useEffect(() => {
  if (typeof window !== 'undefined') localStorage.setItem('heed-theme', theme)
}, [theme])
```

Place this block immediately after:
```javascript
const [routines, setRoutines] = useState(ROUTINES)
const [tab, setTab] = useState('today')
```

So the block starts at the line that currently reads `const [modalOpen, setModalOpen] = useState(false)`.

- [ ] **Step 2: Add ThemeSwitcher component before MayaOwl (around line 225)**

Insert this new component after the `getFieldLabel` factory function block and before `// ── MayaOwl`:

```javascript
// ── ThemeSwitcher ──────────────────────────────────────────────
const THEME_META = {
  'parchment-light': { dot: '#8B2E16', label: 'Parchment Light' },
  'midnight-fern':   { dot: '#6A9E6A', label: 'Midnight Fern' },
  'inkwash':         { dot: '#A0682A', label: 'Inkwash' },
}
function ThemeSwitcher({ theme, onTheme }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {Object.entries(THEME_META).map(([id, { dot, label }]) => (
        <button
          key={id}
          title={label}
          onClick={() => onTheme(id)}
          style={{
            width: 14, height: 14, borderRadius: '50%', background: dot, padding: 0,
            border: theme === id ? `2px solid ${C.ink}` : '2px solid transparent',
            outline: theme === id ? `2px solid ${dot}` : 'none',
            outlineOffset: 2, cursor: 'pointer', transition: 'outline 0.15s',
          }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Update the header right-side div to include ThemeSwitcher**

Find the header's right-side div (currently):
```javascript
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>{todayStr}</div>
          <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>Hi, Maya 👋</div>
        </div>
```

Replace with:
```javascript
        <div className="heed-header-date" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ThemeSwitcher theme={theme} onTheme={handleSetTheme}/>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>{todayStr}</div>
            <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>Hi, Maya 👋</div>
          </div>
        </div>
```

- [ ] **Step 4: Run dev server and manually verify theme switching**

Run: `cd web && npm run dev`

Open `http://localhost:3000`. Verify:
- Three coloured dots appear in the header (right side)
- Clicking each dot changes the background, text colours, and accent colour throughout the entire app
- Refreshing the page preserves the chosen theme (localStorage persisted)

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add three-theme switcher with localStorage persistence"
```

---

## Task 5: Add responsive CSS to `globals.css`

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: Append the responsive utility classes and media queries**

Open `web/app/globals.css` (currently 17 lines). Append the following after the existing rules:

```css
/* ── Responsive layout ─────────────────────────────────────── */
.heed-header   { padding: 20px 32px; }
.heed-nav      { display: flex; }
.heed-hamburger { display: none; background: none; border: none; padding: 8px; cursor: pointer; line-height: 1; }
.heed-tab-name  { display: none; }
.heed-header-date { display: flex; }

/* Drawer — always rendered, hidden via transform */
.heed-drawer-backdrop {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
}
.heed-drawer-backdrop.visible { display: block; }
.heed-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; width: 260px;
  z-index: 101;
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.16,1,0.3,1);
}
.heed-drawer.open { transform: translateX(0); }

/* Phone  ─────────────────────────────────────────────────── */
@media (max-width: 767px) {
  .heed-header  { padding: 12px 16px !important; }
  .heed-nav     { display: none !important; }
  .heed-hamburger { display: flex !important; align-items: center; }
  .heed-tab-name  { display: block !important; }
  .heed-header-date { display: none !important; }
  .heed-header-subtitle { display: none; }
  .heed-main    { max-width: none !important; padding: 16px 16px 80px !important; }

  /* iOS auto-zoom prevention: any input smaller than 16px gets bumped */
  input, select, textarea { font-size: 16px !important; }
}

/* Tablet  ────────────────────────────────────────────────── */
@media (min-width: 768px) and (max-width: 1023px) {
  .heed-main { max-width: 640px !important; padding: 20px 24px !important; }
}
```

- [ ] **Step 2: Add drawer slide-in keyframe to page.jsx style block**

Find the `<style>` block in HeedApp (around line 1391). Add one new keyframe before `::selection`:

```javascript
        @keyframes heed-slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
```

Full updated style block:
```javascript
      <style>{`
        @keyframes heed-fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes heed-fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes heed-pulse { 0%,100% { opacity:0.4; transform:translateX(-50%) scale(1); } 50% { opacity:1; transform:translateX(-50%) scale(1.4); } }
        @keyframes heed-breathe { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:0.85; transform:scale(1.05); } }
        @keyframes heed-blink { 0%,50%,100% { opacity:1; } 25%,75% { opacity:0.3; } }
        @keyframes heed-bob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-2px); } }
        @keyframes heed-slideUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
        @keyframes heed-slideRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes heed-slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
        ::selection { background:${C.warmDark}; color:${C.cream}; }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
```

- [ ] **Step 3: Run build**

Run: `cd web && npx next build 2>&1 | tail -20`

Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/app/page.jsx
git commit -m "feat: add responsive CSS classes, media queries, and drawer keyframe"
```

---

## Task 6: Make header, nav, and main responsive (className attributes + hamburger)

**Files:**
- Modify: `web/app/page.jsx` (header, nav, main elements in HeedApp)

- [ ] **Step 1: Add className and hamburger button to the header**

Find the current header element (around line 1405):
```javascript
      <header style={{ borderBottom: `1px solid ${C.hairline}`, padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`, position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MayaOwl size={48}/>
          <div>
            <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 26, fontWeight: 700, color: C.warmDark, letterSpacing: -0.7, lineHeight: 1 }}>Heed</div>
            <div style={{ fontSize: 11.5, color: C.inkMute, fontStyle: 'italic', marginTop: 3, letterSpacing: 0.2 }}>The agent that remembers what you forget.</div>
          </div>
        </div>
        <div className="heed-header-date" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ThemeSwitcher theme={theme} onTheme={handleSetTheme}/>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>{todayStr}</div>
            <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>Hi, Maya 👋</div>
          </div>
        </div>
      </header>
```

Replace with (removes `padding: '20px 32px'` from inline so CSS class controls it; adds className, active tab name, hamburger):
```javascript
      <header className="heed-header" style={{ borderBottom: `1px solid ${C.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`, position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MayaOwl size={40}/>
          <div>
            <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 24, fontWeight: 700, color: C.warmDark, letterSpacing: -0.7, lineHeight: 1 }}>Heed</div>
            <div className="heed-header-subtitle" style={{ fontSize: 11.5, color: C.inkMute, fontStyle: 'italic', marginTop: 3, letterSpacing: 0.2 }}>The agent that remembers what you forget.</div>
          </div>
        </div>
        <div className="heed-tab-name" style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
          {tabs.find(t => t.id === tab)?.label}
        </div>
        <div className="heed-header-date" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ThemeSwitcher theme={theme} onTheme={handleSetTheme}/>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>{todayStr}</div>
            <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>Hi, Maya 👋</div>
          </div>
        </div>
        <button className="heed-hamburger" onClick={() => setDrawerOpen(true)} style={{ color: C.ink, fontSize: 22 }}>☰</button>
      </header>
```

- [ ] **Step 2: Add className to nav element**

Find:
```javascript
      <nav style={{ display: 'flex', gap: 4, padding: '0 32px', borderBottom: `1px solid ${C.hairline}`, background: C.paper }}>
```

Replace with:
```javascript
      <nav className="heed-nav" style={{ display: 'flex', gap: 4, padding: '0 32px', borderBottom: `1px solid ${C.hairline}`, background: C.paper }}>
```

- [ ] **Step 3: Add className to main element**

Find:
```javascript
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '28px 32px 100px 32px', minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
```

Replace with:
```javascript
      <main className="heed-main" style={{ maxWidth: 820, margin: '0 auto', padding: '28px 32px 100px 32px', minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
```

- [ ] **Step 4: Add `drawerOpen` state to HeedApp**

Find where the other `useState` calls are in HeedApp (after the theme state added in Task 4). Add:

```javascript
const [drawerOpen, setDrawerOpen] = useState(false)
```

- [ ] **Step 5: Run dev server and verify responsive breakpoints**

Run: `cd web && npm run dev`

Open `http://localhost:3000`. Use browser DevTools to toggle to a phone viewport (375px wide). Verify:
- Header shows owl + "Heed" on left, active tab name in center, hamburger (☰) on right
- Nav bar is hidden
- Main content fills full width with reduced padding
- Tapping ☰ doesn't crash (drawer opens, but MobileDrawer component isn't rendered yet — that's fine for now)

Switch to 800px tablet width. Verify:
- Full tab bar visible
- Date/theme switcher visible
- Max-width is 640px (content narrower than viewport)

- [ ] **Step 6: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add responsive classNames to header/nav/main and hamburger button"
```

---

## Task 7: Create MobileDrawer component

**Files:**
- Modify: `web/app/page.jsx` (new component + render in HeedApp)

- [ ] **Step 1: Add MobileDrawer component after ThemeSwitcher**

Insert the following after the `ThemeSwitcher` component and before `// ── MayaOwl`:

```javascript
// ── MobileDrawer ───────────────────────────────────────────────
function MobileDrawer({ open, onClose, tab, onTab, theme, onTheme }) {
  const drawerTabs = [
    { id: 'today',    label: 'Today' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'ask',      label: 'Ask Heed' },
    { id: 'tracks',   label: 'Tracks' },
    { id: 'context',  label: 'Context' },
  ]
  return (
    <>
      <div
        className={`heed-drawer-backdrop${open ? ' visible' : ''}`}
        onClick={onClose}
      />
      <div
        className={`heed-drawer${open ? ' open' : ''}`}
        style={{ background: C.paper, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ height: 64, borderBottom: `1px solid ${C.hairline}`, display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 18, fontWeight: 700, color: C.warmDark }}>Heed</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: C.inkMute, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {drawerTabs.map(t => (
            <button
              key={t.id}
              onClick={() => { onTab(t.id); onClose() }}
              style={{
                width: '100%', background: tab === t.id ? C.paperHi : 'transparent',
                border: 'none', borderLeft: `3px solid ${tab === t.id ? C.warmDark : 'transparent'}`,
                color: tab === t.id ? C.ink : C.inkSoft,
                padding: '16px 24px', fontSize: 15, fontWeight: tab === t.id ? 600 : 400,
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 24px', borderTop: `1px solid ${C.hairline}` }}>
          <div style={{ fontSize: 11, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Theme</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {Object.entries(THEME_META).map(([id, { dot, label }]) => (
              <button
                key={id}
                title={label}
                onClick={() => onTheme(id)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: dot, padding: 0,
                  border: theme === id ? `2px solid ${C.ink}` : '2px solid transparent',
                  outline: theme === id ? `2px solid ${dot}` : 'none',
                  outlineOffset: 2, cursor: 'pointer', transition: 'outline 0.15s',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Render MobileDrawer inside HeedApp**

Find the HeedApp return. After the closing `</nav>` tag and before `<main`, add:

```javascript
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tab={tab}
        onTab={setTab}
        theme={theme}
        onTheme={handleSetTheme}
      />
```

- [ ] **Step 3: Run dev server and test drawer on phone viewport**

Run: `cd web && npm run dev`

Open `http://localhost:3000` at 375px width. Verify:
- ☰ button opens the drawer from the right
- Backdrop overlay appears behind drawer
- All 5 tabs are listed; active tab is highlighted with left border in accent colour
- Tapping a tab switches content and closes the drawer
- Theme dots at the bottom change the app theme instantly (including the drawer's own colours)
- Tapping backdrop closes the drawer

- [ ] **Step 4: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add MobileDrawer component with tab nav and theme switcher"
```

---

## Task 8: Rewrite MayaOwl with botanical illustrated SVG

**Files:**
- Modify: `web/app/page.jsx` (lines 226–308, the MayaOwl component)

The new owl stands on a branch with leaves. Colour comes from `OWL_THEMES[themeState.current]`, giving a different owl per theme (cross-contrast rotation defined in Task 1).

- [ ] **Step 1: Replace the entire MayaOwl function**

Replace the block from `// ── MayaOwl ────` through the closing `}` (old lines 225–308) with:

```javascript
// ── MayaOwl ────────────────────────────────────────────────────
function MayaOwl({ size = 120, mood = 'calm', speaking = false, idle = true }) {
  const [blinking, setBlinking] = useState(false)
  const [bob, setBob] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setBlinking(true)
      setTimeout(() => setBlinking(false), 180)
    }, 3000 + Math.random() * 4000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (!idle) return
    const id = setInterval(() => setBob(b => (b + 1) % 360), 60)
    return () => clearInterval(id)
  }, [idle])

  const oc = OWL_THEMES[themeState.current]
  const eyeOpenY = blinking ? 0.05 : (mood === 'thinking' ? 0.7 : 1)
  const beakTilt = mood === 'thinking' ? -3 : (mood === 'happy' ? 4 : 0)
  const bobY = idle ? Math.sin(bob * Math.PI / 180) * 1.5 : 0

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <svg width={size} height={Math.round(size * 1.25)} viewBox="0 0 200 250" style={{
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        transform: `translateY(${speaking ? -2 + bobY : bobY}px) scale(${speaking ? 1.02 : 1})`,
        overflow: 'visible',
      }}>
        <defs>
          <filter id="owlGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
            <feOffset dx="0" dy="3" result="offsetblur"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Branch */}
        <path d="M 15 210 Q 60 205 100 208 Q 140 211 185 208"
          stroke={oc.beak} strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.65"/>
        {/* Bark texture on branch */}
        <path d="M 40 208 Q 60 205 80 208" stroke={oc.beak} strokeWidth="2" fill="none" opacity="0.3" strokeLinecap="round"/>
        <path d="M 110 208 Q 135 205 155 209" stroke={oc.beak} strokeWidth="2" fill="none" opacity="0.3" strokeLinecap="round"/>

        {/* Branch leaves */}
        <ellipse cx="28" cy="202" rx="16" ry="6" fill={oc.tuft} opacity="0.7" transform="rotate(-25 28 202)"/>
        <ellipse cx="50" cy="199" rx="13" ry="5" fill={oc.tuft} opacity="0.5" transform="rotate(10 50 199)"/>
        <ellipse cx="155" cy="200" rx="15" ry="5.5" fill={oc.tuft} opacity="0.65" transform="rotate(-12 155 200)"/>
        <ellipse cx="175" cy="203" rx="12" ry="4.5" fill={oc.tuft} opacity="0.5" transform="rotate(18 175 203)"/>

        {/* Body */}
        <ellipse cx="100" cy="140" rx="58" ry="65" fill={oc.body} filter="url(#owlGlow)"/>

        {/* Wing left */}
        <path d="M 44 125 Q 34 155 52 192 Q 60 168 66 138 Z" fill={oc.body} opacity="0.88"/>
        {/* Wing right */}
        <path d="M 156 125 Q 166 155 148 192 Q 140 168 134 138 Z" fill={oc.body} opacity="0.88"/>

        {/* Belly patch */}
        <ellipse cx="100" cy="155" rx="36" ry="46" fill={oc.eyeRing} opacity="0.35"/>

        {/* Belly scallop dots */}
        <g opacity="0.45" fill={oc.beak}>
          {[[87,138],[100,132],[113,138],[91,152],[109,152],[87,166],[100,170],[113,166],[91,180],[109,180]].map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.3"/>
          ))}
        </g>

        {/* Ear tufts */}
        <path d="M 72 82 Q 66 58 79 50 Q 85 68 85 83 Z" fill={oc.tuft}/>
        <path d="M 128 82 Q 134 58 121 50 Q 115 68 115 83 Z" fill={oc.tuft}/>

        {/* Face disk */}
        <ellipse cx="100" cy="102" rx="44" ry="42" fill={oc.eyeRing} opacity="0.22"/>

        {/* Eye rings */}
        <circle cx="78" cy="100" r="20" fill={oc.eyeRing} stroke={oc.body} strokeWidth="2.5"/>
        <circle cx="122" cy="100" r="20" fill={oc.eyeRing} stroke={oc.body} strokeWidth="2.5"/>

        {/* Left eye pupil + highlight */}
        <g style={{ transition: 'transform 0.12s ease-out' }}>
          <ellipse cx="78" cy="100" rx="10" ry={10 * eyeOpenY} fill={oc.pupil}/>
          {!blinking && (
            <>
              <circle cx="80" cy="96" r="3.5" fill={oc.eyeRing} opacity="0.65"/>
              <circle cx="76" cy="103" r="1.5" fill={oc.eyeRing} opacity="0.35"/>
            </>
          )}
        </g>
        {/* Right eye pupil + highlight */}
        <g style={{ transition: 'transform 0.12s ease-out' }}>
          <ellipse cx="122" cy="100" rx="10" ry={10 * eyeOpenY} fill={oc.pupil}/>
          {!blinking && (
            <>
              <circle cx="124" cy="96" r="3.5" fill={oc.eyeRing} opacity="0.65"/>
              <circle cx="120" cy="103" r="1.5" fill={oc.eyeRing} opacity="0.35"/>
            </>
          )}
        </g>

        {/* Beak */}
        <g transform={`rotate(${beakTilt} 100 116)`}>
          <path d="M 100 113 L 92 124 Q 100 130 108 124 Z" fill={oc.beak} stroke={oc.body} strokeWidth="1.2"/>
        </g>

        {/* Cheek blush */}
        <ellipse cx="62" cy="116" rx="7" ry="5" fill={oc.cheek} opacity="0.2"/>
        <ellipse cx="138" cy="116" rx="7" ry="5" fill={oc.cheek} opacity="0.2"/>

        {/* Talons gripping branch */}
        <g fill="none" stroke={oc.beak} strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
          <path d="M 82 197 L 78 210 M 87 197 L 86 212 M 92 197 L 96 210"/>
          <path d="M 108 197 L 104 210 M 113 197 L 113 212 M 118 197 L 122 210"/>
        </g>
      </svg>

      {speaking && (
        <span style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 8, height: 8, borderRadius: '50%', background: C.sage,
          animation: 'heed-pulse 1s ease-in-out infinite',
        }}/>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run dev server and verify owl renders correctly for all three themes**

Run: `cd web && npm run dev`

Open `http://localhost:3000`. Verify:
- **Midnight Fern** (default): cream/parchment owl on a terracotta-beaked branch with fern green leaf tufts
- Switch to **Parchment Light**: brown bark owl with olive-green tufts, warm amber beak
- Switch to **Inkwash**: deep forest green owl with amber tufts and beak, warm eye rings
- The owl blinks periodically and gently bobs on all themes
- The owl is visible in the header (40px) and as the hero in the Ask Heed tab (120px)

- [ ] **Step 3: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: rewrite MayaOwl with botanical branch illustration and cross-theme colour rotation"
```

---

## Task 9: Add BotanicalDivider + update SectionHeader

**Files:**
- Modify: `web/app/page.jsx` (new BotanicalDivider component, update SectionHeader, update TodayTab calls)

- [ ] **Step 1: Add BotanicalDivider component**

Find `function SectionHeader`. Insert the BotanicalDivider component immediately before it:

```javascript
// ── BotanicalDivider ───────────────────────────────────────────
function BotanicalDivider({ type = 'leaf' }) {
  const color = C.inkMute
  if (type === 'stem') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
        <line x1="11" y1="2" x2="11" y2="20" stroke={color} strokeWidth="1.3"/>
        <ellipse cx="5" cy="9" rx="6" ry="2.5" fill={color} opacity="0.55" transform="rotate(-20 5 9)"/>
        <ellipse cx="17" cy="13" rx="6" ry="2.5" fill={color} opacity="0.45" transform="rotate(20 17 13)"/>
        <ellipse cx="4" cy="16" rx="5" ry="2" fill={color} opacity="0.35" transform="rotate(-25 4 16)"/>
      </svg>
    )
  }
  if (type === 'berry') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
        <path d="M 2 11 Q 11 7 20 11" stroke={color} strokeWidth="1.3" fill="none"/>
        {[5, 11, 17].map(x => (
          <circle key={x} cx={x} cy={11 + Math.sin((x / 22) * Math.PI * 2) * 2.5} r="2.2" fill={color} opacity="0.55"/>
        ))}
      </svg>
    )
  }
  if (type === 'thorn') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
        <line x1="2" y1="11" x2="20" y2="11" stroke={color} strokeWidth="1.3"/>
        <path d="M 7 11 L 5 7" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M 15 11 L 17 7" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    )
  }
  // 'leaf' default — symmetrical leaf sprig
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
      <path d="M 2 11 Q 11 7 20 11" stroke={color} strokeWidth="1.3" fill="none"/>
      <ellipse cx="6"  cy="9"  rx="5" ry="2.2" fill={color} opacity="0.5" transform="rotate(-15 6 9)"/>
      <ellipse cx="11" cy="7"  rx="5" ry="2.2" fill={color} opacity="0.4"/>
      <ellipse cx="16" cy="9"  rx="5" ry="2.2" fill={color} opacity="0.5" transform="rotate(15 16 9)"/>
    </svg>
  )
}
```

- [ ] **Step 2: Update SectionHeader to accept a `motif` prop**

Find the existing SectionHeader:
```javascript
function SectionHeader({ children, count, accent = C.warmDark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
      <h3 style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 19, fontWeight: 600, color: accent, margin: 0, letterSpacing: -0.3 }}>{children}</h3>
      {count !== undefined && (
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {count} {count === 1 ? 'item' : 'items'}
        </div>
      )}
      <div style={{ flex: 1, height: 1, background: C.hairline }}/>
    </div>
```

Replace with:
```javascript
function SectionHeader({ children, count, accent = C.warmDark, motif }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      {motif && <BotanicalDivider type={motif}/>}
      <h3 style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 19, fontWeight: 600, color: accent, margin: 0, letterSpacing: -0.3 }}>{children}</h3>
      {count !== undefined && (
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {count} {count === 1 ? 'item' : 'items'}
        </div>
      )}
      <div style={{ flex: 1, height: 1, background: C.hairline }}/>
    </div>
```

- [ ] **Step 3: Add motif props to SectionHeader calls in TodayTab**

Find TodayTab and update these four calls:

| Before | After |
|--------|-------|
| `<SectionHeader>Top of mind</SectionHeader>` | `<SectionHeader motif="leaf">Top of mind</SectionHeader>` |
| `<SectionHeader count={routines.length}>Routines</SectionHeader>` | `<SectionHeader motif="stem" count={routines.length}>Routines</SectionHeader>` |
| `<SectionHeader count={otherOverdue.length}>Also overdue</SectionHeader>` | `<SectionHeader motif="thorn" count={otherOverdue.length}>Also overdue</SectionHeader>` |
| `<SectionHeader count={upcoming.length}>Coming up</SectionHeader>` | `<SectionHeader motif="berry" count={upcoming.length}>Coming up</SectionHeader>` |

- [ ] **Step 4: Run dev server and verify**

Run: `cd web && npm run dev`

Navigate to the Today tab. Verify:
- "Top of mind" has a small leaf sprig SVG before it
- "Routines" has a small plant stem SVG before it
- "Also overdue" (if visible) has a thorn branch SVG before it
- "Coming up" has a berry vine SVG before it
- All dividers use the muted `inkMute` colour from the active theme
- Switching themes updates divider colours immediately

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: add BotanicalDivider component and botanical motifs to section headers"
```

---

## Task 10: Final verification across all breakpoints and themes

**Files:**
- Read-only verification — no code changes unless bugs found.

- [ ] **Step 1: Run dev server**

Run: `cd web && npm run dev`

- [ ] **Step 2: Desktop verification (≥1024px)**

Open `http://localhost:3000` at full desktop width. Check:
- Three-dot theme switcher visible in header (right side, left of date)
- Parchment Light: warm cream/parchment background, oxblood accents, brown bark owl
- Midnight Fern: deep forest green background, terracotta accents, parchment cream owl
- Inkwash: dark amber-tinted background, amber accents, forest green owl
- Botanical dividers in Today tab section headers
- All modals open/close; Add Task, Add Context, Add Routine forms are functional
- Tab switching works

- [ ] **Step 3: Tablet verification (768–1023px)**

Resize browser to 800px. Check:
- Full tab bar visible (no hamburger)
- Header shows logo + date + theme switcher
- Max-width 640px (content narrower than viewport, centred)
- No horizontal scroll

- [ ] **Step 4: Phone verification (<768px)**

Resize browser to 375px. Check:
- Header: owl + "Heed" on left | active tab name centred | ☰ on right
- Subtitle "The agent that remembers..." is hidden
- Tab bar is hidden
- ☰ opens drawer from right; backdrop tap closes it
- Drawer tab switching works; active tab highlighted
- Theme switcher in drawer bottom works
- Content fills full width, reduced padding
- No horizontal scroll
- FAB button visible and functional at bottom-right
- Modals work correctly (they already use `maxWidth`)

- [ ] **Step 5: Fix any regressions, then run production build**

Run: `cd web && npx next build`

Expected: Build completes with no errors or warnings beyond standard Next.js output.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete responsive botanical design — three themes, MobileDrawer, botanical owl, SVG dividers"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Phone layout: compact header + hamburger → Task 6, 7
- [x] Tablet layout: full tab bar + 640px max-width → Task 5, 6
- [x] Desktop: unchanged 820px → CSS class lets inline style persist
- [x] Hamburger drawer: all 5 tabs, active state, backdrop dismiss → Task 7
- [x] Theme switcher: 3 dots in header (desktop), in drawer (phone) → Task 4, 7
- [x] localStorage persistence → Task 4
- [x] Parchment Light palette → Task 1
- [x] Midnight Fern palette → Task 1
- [x] Inkwash palette → Task 1
- [x] Cross-theme owl contrast rotation → Task 1, 8
- [x] Owl on branch with leaves → Task 8
- [x] Botanical section dividers (leaf/stem/berry/thorn) → Task 9
- [x] iOS auto-zoom prevention (input font-size: 16px) → Task 5
- [x] FAB stays fixed bottom-right (no change needed — already `position: fixed`)
- [x] Modal structure unchanged (already responsive)
- [x] Animation system unchanged (keyframes kept, new slideIn added)

### Type consistency
- `themeState.current` is set in HeedApp render (Task 4) before any C.xxx read — all components see correct theme
- `OWL_THEMES[themeState.current]` is accessed inside `MayaOwl` at render time — correct
- `THEME_META` is used in both `ThemeSwitcher` and `MobileDrawer` — same object reference, no duplication
- `getBtnPrimary()` / `getBtnGhost()` / `getFieldLabel()` — all 30 usages updated in Task 3
