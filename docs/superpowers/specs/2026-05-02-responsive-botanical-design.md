# Heed — Responsive Layout + Botanical Theme Design

**Date:** 2026-05-02  
**Status:** Approved

---

## Overview

Two parallel changes to the Heed web app (`web/app/page.jsx`):

1. **Responsive layout** — make the app usable on phone and tablet
2. **Botanical / Herbarium theme system** — replace the current blue-grey palette with three selectable botanical themes, each with a unique contrasting owl

---

## 1. Responsive Layout

### Breakpoints

| Name | Range | Behaviour |
|------|-------|-----------|
| Phone | < 768px | Compact header + hamburger drawer navigation |
| Tablet | 768px – 1023px | Full tab bar, reduced padding, 640px max-width |
| Desktop | ≥ 1024px | Current layout unchanged, 820px max-width |

### Implementation approach

Extend the existing `<style>` block (already injected in `page.jsx` for keyframe animations) with `@media` rules. Inline styles handle component-level sizing; media queries handle structural breakpoints. No new dependencies.

### Phone layout (< 768px)

**Header:**
- Left: owl logo (32px) + "Heed" wordmark
- Center: active tab name (e.g. "Today")
- Right: hamburger icon (☰)
- Padding reduced to `12px 16px` (from `20px 32px`)
- Date/greeting hidden on phone to save space

**Navigation — hamburger drawer:**
- Hidden tab bar replaced by a slide-in drawer from the right
- Drawer contains all 5 tabs as full-width rows with active state
- Backdrop overlay (semi-transparent) behind the drawer; tap to dismiss
- Drawer persists tab state (active tab highlighted)
- Animated: slides in from right on open, slides out on close

**Main content:**
- `maxWidth: none` (full width)
- Padding reduced to `16px 16px 80px`

### Tablet layout (768px+)

- Full tab bar reappears (same as current desktop nav)
- Header shows logo + date/greeting (no hamburger)
- `maxWidth: 640px` centered (down from 820px on desktop)
- Padding: `20px 24px`

### Other responsive adjustments (both phone + tablet)

- Modals already use `width: 100%` + `maxWidth` — no change needed
- FAB position stays fixed bottom-right, slightly smaller on phone (52px vs 64px)
- Body font sizes stay fixed (13-14px body text does not trigger iOS auto-zoom)
- Input fields set to `fontSize: 16px` on mobile to prevent iOS auto-zoom on focus
- Cards and sections stack vertically — no change needed

---

## 2. Botanical / Herbarium Theme System

### Theme storage

User's chosen theme stored in `localStorage` under key `heed-theme`. Defaults to `midnight-fern` if not set.

### Theme switcher UI

Three coloured dots in the app header (right side, desktop only — same row as the date). On phone, the theme switcher lives inside the hamburger drawer (bottom of the drawer, below the 5 tabs). Each dot represents one theme. The active dot has a visible ring. Tapping a dot switches themes instantly — CSS custom properties update on `:root`.

### Theme definitions

All three themes use:
- **Typography:** Lora (serif, headings + section labels) + Nunito Sans (body) — already loaded
- **Botanical SVG motifs** as section dividers (leaf sprigs for "top of mind", plant stem for "routines", berry vine for "coming up")
- **Botanical branch + leaves** for the owl illustration

#### Theme A — Parchment Light

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#F5F0E6` | Page background |
| `--paper` | `#EDE7D7` | Header / nav background |
| `--paperHi` | `#F9F6EE` | Card background |
| `--border` | `#D4C9A8` | Card / nav borders |
| `--hairline` | `#E0D8C0` | Subtle dividers |
| `--ink` | `#2A3522` | Primary text |
| `--inkSoft` | `#7A7060` | Secondary text |
| `--inkMute` | `#A8987A` | Muted / labels |
| `--accent` | `#8B2E16` | Oxblood — critical items, active tab, primary buttons |
| `--accentAlt` | `#4A7040` | Sage green — routine items |
| `--shadow` | `0 2px 12px rgba(0,0,0,0.08)` | Card shadow |

**Owl:** Brown bark body (`#6B4820`), cream parchment eye rings (`#EDE7D7`), olive tufts (`#6A9060`), amber beak (`#A0682A`).

#### Theme B — Midnight Fern

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#0E1A12` | Page background |
| `--paper` | `#162218` | Header / nav background |
| `--paperHi` | `#1C2C1E` | Card background |
| `--border` | `#2A4030` | Card / nav borders |
| `--hairline` | `#1E3028` | Subtle dividers |
| `--ink` | `#E8DEC4` | Primary text |
| `--inkSoft` | `#A09880` | Secondary text |
| `--inkMute` | `#607860` | Muted / labels |
| `--accent` | `#C4553A` | Terracotta — critical items, active tab, primary buttons |
| `--accentAlt` | `#6A9E6A` | Fern green — routine items |
| `--shadow` | `0 2px 12px rgba(0,0,0,0.4)` | Card shadow |

**Owl:** Parchment cream body (`#D4C9A8`), forest-dark pupils (`#0E1A12`), fern green tufts (`#6A9E6A`), terracotta beak (`#C4553A`).

#### Theme C — Inkwash

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#18140C` | Page background |
| `--paper` | `#221C12` | Header / nav background |
| `--paperHi` | `#2C2418` | Card background |
| `--border` | `#3E3222` | Card / nav borders |
| `--hairline` | `#302818` | Subtle dividers |
| `--ink` | `#F0E6C4` | Primary text |
| `--inkSoft` | `#B0A080` | Secondary text |
| `--inkMute` | `#7A6A4A` | Muted / labels |
| `--accent` | `#A0682A` | Amber — critical items, active tab, primary buttons |
| `--accentAlt` | `#6A9060` | Olive green — routine items |
| `--shadow` | `0 2px 12px rgba(0,0,0,0.5)` | Card shadow |

**Owl:** Deep forest green body (`#2A4A2E`), warm parchment eye rings (`#F0E6C4`), amber tufts (`#A0682A`), amber beak.

### Owl illustration

The `MayaOwl` component receives a `theme` prop. The SVG is redrawn per theme with:
- Larger default size in header (40px, up from ~28px)
- Full illustrated version (body, wings, chest scallops, branch + leaves) in the Ask Heed tab hero
- Theme-specific colour mapping per the definitions above

### Botanical section dividers

Each section header in `TodayTab` (and other tabs) gets a botanical SVG divider replacing the plain text label:
- **Top of mind** — leaf sprig vine (horizontal, symmetrical)
- **Routines** — plant stem with side leaves
- **Coming up** — small berry dots on a vine
- **Overdue** — thorned branch (subtle warning feel)

Dividers use `--inkMute` colour so they're calming, not loud.

---

## 3. What is NOT changing

- All component logic, state management, API calls
- Modal structure (already responsive)
- Animation system (keyframes stay as-is, just recoloured via CSS vars)
- Font loading (Lora + Nunito Sans already in use)
- Next.js config, static export settings

---

## Out of Scope

- Light/dark auto-detection via `prefers-color-scheme` (user picks manually)
- Additional themes beyond the three defined here
- Accessibility audit (separate task)
