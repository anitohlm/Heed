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
    low:        '#7070B0',
    lowSoft:    '#EEEAF6',
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
    low:        '#8A84B8',
    lowSoft:    '#1C1A2A',
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
    low:        '#8A84B8',
    lowSoft:    '#1A1820',
    shadowSoft: '0 2px 12px rgba(0,0,0,0.5)',
    shadowMed:  '0 6px 22px rgba(0,0,0,0.6)',
  },
  // Auto-applied while a Low Day context is active. Not selectable from the
  // Settings theme picker — the app swaps to it the moment activeContext.type
  // is 'low' and reverts to the user's chosen theme when the context ends.
  'periwinkle': {
    cream:      '#F1F0F8',
    paper:      '#E8E5F2',
    paperHi:    '#F6F4FB',
    border:     '#C8C2DD',
    hairline:   '#DAD4E8',
    ink:        '#2D2A4A',
    inkSoft:    '#6B6585',
    inkMute:    '#9A93B3',
    warm:       '#6E63A8',
    warmDark:   '#6E63A8',
    warmDeep:   '#F1F0F8',
    belly:      '#E8E5F2',
    bellySoft:  '#EDE9F5',
    rust:       '#8A5A8A',
    rustSoft:   '#F0E4F0',
    sage:       '#6A8E8A',
    sageSoft:   '#DDE6E4',
    ochre:      '#8A6E40',
    ochreSoft:  '#EDE5D6',
    rose:       '#B080A0',
    low:        '#6E63A8',
    lowSoft:    '#EEEAF6',
    shadowSoft: '0 2px 12px rgba(58,48,108,0.10)',
    shadowMed:  '0 6px 22px rgba(58,48,108,0.16)',
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
    body:    '#7AAA78',
    eyeRing: '#F0E6C4',
    pupil:   '#18140C',
    tuft:    '#A0682A',
    beak:    '#A0682A',
    cheek:   '#C47060',
  },
  'periwinkle': {
    body:    '#6E63A8',
    eyeRing: '#F6F4FB',
    pupil:   '#2D2A4A',
    tuft:    '#8A5A8A',
    beak:    '#8A6E40',
    cheek:   '#B080A0',
  },
}

export const DEFAULT_THEME = 'midnight-fern'

const _VALID_THEMES = new Set(Object.keys(THEMES))

// Mutable state object shared with page.jsx's C getter proxy.
// setThemeState() is called synchronously at the top of HeedApp render.
export const themeState = { current: DEFAULT_THEME }

export function setThemeState(name) {
  themeState.current = name
}
