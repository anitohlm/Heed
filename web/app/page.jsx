"use client"
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './globals.css'
import { THEMES, OWL_THEMES, themeState, setThemeState, DEFAULT_THEME } from './themes'

// Functions backend URL — baked in at build time via NEXT_PUBLIC_FUNCTIONS_URL
const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 'http://localhost:7071'

// ── Module-level tab definitions (shared by HeedApp and MobileDrawer) ─────
const APP_TABS = [
  { id: 'today',    label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'ask',      label: 'Ask Heed' },
  { id: 'tracks',   label: 'Tracks' },
  { id: 'context',  label: 'Life' },
]

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
const CATEGORY = {
  relationships: { color: '#E8714C', bg: '#3A1F18', icon: '✿' },
  finance:       { color: '#E0B36A', bg: '#2D2618', icon: '◈' },
  admin:         { color: '#A89B82', bg: '#26221A', icon: '◷' },
  home:          { color: '#8FB89A', bg: '#1F2D24', icon: '⌂' },
  health:        { color: '#D4A24C', bg: '#2D2618', icon: '✚' },
  work:          { color: '#C9A989', bg: '#2A2218', icon: '◰' },
  self_care:     { color: '#D9907F', bg: '#33211C', icon: '◐' },
}

// ── Static seed data (offline/demo fallback) ───────────────────
const QUICK_CONTEXT_CONFIG = {
  sick:        { label: 'Sick — rest mode',          icon: '🌿', defaultDays: 2, question: 'How long are you sick?',           activateLabel: 'Activate rest mode',        toastMsg: 'Rest mode activated — Heed is holding your tasks' },
  busy:        { label: 'Busy week',                 icon: '🌾', defaultDays: 5, question: 'How long is your busy period?',    activateLabel: 'Activate busy mode',        toastMsg: 'Busy mode activated — Heed is holding your tasks' },
  travel:      { label: 'Traveling',                 icon: '✈️', defaultDays: 7, question: 'How many days are you traveling?', activateLabel: 'Activate travel mode',      toastMsg: 'Travel mode activated — Heed is holding your tasks' },
  celebration: { label: 'Celebration',               icon: '🌸', defaultDays: 1, question: 'How long is the celebration?',     activateLabel: 'Activate celebration mode', toastMsg: 'Celebration mode activated — Heed is holding your tasks' },
}
const ROUTINES = [
  {
    id: 'morning', name: 'Morning routine', schedule: 'Weekdays, ~7:00 AM',
    items: ['Stretch (5 min)', 'Vitamin D + B-complex', 'Make coffee', 'Quick journal'],
    completion14d: [true,true,true,true,false,false,true,true,true,false,true,true,false,false],
    insight: 'You skipped Mon and Tue this week.',
    suggestion: 'Want me to lighten this for the rest of the week?',
    weekRate: '5 of 7 last week',
  },
  {
    id: 'evening', name: 'Evening wind-down', schedule: 'Daily, ~10:00 PM',
    items: ['Phone away', 'Read 10 pages', 'Lights out by 11'],
    completion14d: [true,true,true,true,true,true,true,true,true,true,true,true,true,false],
    insight: 'Solid pattern. Staying out of your way.',
    suggestion: null,
    weekRate: '6 of 7 last week',
  },
]

// TASKS_DEMO is the offline/demo seed used as fallback when the API has no
// data, AND the source-of-truth when the user clicks "Load demo data" (the
// heed.use-demo flag is on). The mix is tuned so Focus Today (overdue OR
// dueIn===0) always has 5 cards: 3 daily today-tasks + 2 overdue.
const TASKS_DEMO = (() => {
  const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() }
  const from = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  return [
    // Daily — due today (dueIn === 0)
    { id: 'demo_today_1', status: 'active', name: 'Take vitamins',         category: 'health', importance: 'high',   next_due_at: ago(0), last_done_at: ago(1), explicit_cadence_days: 1 },
    { id: 'demo_today_2', status: 'active', name: 'Drink 8 cups of water', category: 'health', importance: 'medium', next_due_at: ago(0), last_done_at: ago(1), explicit_cadence_days: 1 },
    { id: 'demo_today_3', status: 'active', name: 'Quick journal',         category: 'health', importance: 'low',    next_due_at: ago(0), last_done_at: ago(1), explicit_cadence_days: 1 },
    // Overdue
    { id: 'demo_over_1',  status: 'active', name: 'Pay electricity bill',   category: 'finance',       importance: 'high',   next_due_at: ago(3), last_done_at: ago(33), explicit_cadence_days: 30 },
    { id: 'demo_over_2',  status: 'active', name: 'Call Mom',               category: 'relationships', importance: 'high',   next_due_at: ago(2), last_done_at: ago(9),  learned_cadence_days: 7 },
    // Upcoming
    { id: 'demo_up_1',    status: 'active', name: 'Refill water dispenser', category: 'home',          importance: 'medium', next_due_at: from(2), last_done_at: ago(12), explicit_cadence_days: 14 },
    { id: 'demo_up_2',    status: 'active', name: 'Clean bathroom',         category: 'home',          importance: 'medium', next_due_at: from(4), last_done_at: ago(10), explicit_cadence_days: 14 },
    { id: 'demo_up_3',    status: 'active', name: 'Back up photos',         category: 'admin',         importance: 'low',    next_due_at: from(7), last_done_at: ago(23), explicit_cadence_days: 30 },
  ]
})()

// Tracks whether the user has clicked "Load demo data" — when on, the app
// uses TASKS_DEMO / ROUTINES / DEMO_PLANS as source-of-truth and skips the
// /api/tasks fetch so the demo never gets overridden by stale Cosmos data.
// Cleared by Reset all data.
const isDemoMode = () => {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem('heed.use-demo') === '1' } catch { return false }
}

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
  const d = new Date(Date.now() - Math.max(0, streakCount - 1) * 86400000)
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

const CONTEXTS_PAST = [
  {
    type: 'travel', start: 'Dec 20, 2025', end: 'Dec 27, 2025', desc: 'Christmas trip to Baguio', skipped: 9,
    heldTasks: [
      { label: 'Pay Meralco bill',       overdueDays: 7 },
      { label: 'Call Mom',               overdueDays: 7 },
      { label: 'Submit timesheet',       overdueDays: 0 },
      { label: 'Refill water dispenser', overdueDays: 3 },
      { label: 'Morning routine',        overdueDays: 0 },
    ],
  },
  {
    type: 'illness', start: 'Feb 10, 2026', end: 'Feb 14, 2026', desc: 'Flu — bed rest', skipped: 12,
    heldTasks: [
      { label: 'Pay Meralco bill', overdueDays: 5 },
      { label: 'Call Mom',         overdueDays: 5 },
      { label: 'Morning routine',  overdueDays: 0 },
      { label: 'Evening wind-down', overdueDays: 0 },
    ],
  },
  {
    type: 'busy', start: 'Mar 16, 2026', end: 'Mar 22, 2026', desc: 'Client deadline week', skipped: 7,
    heldTasks: [
      { label: 'Cat litter box',          overdueDays: 6 },
      { label: 'Update expense tracker',  overdueDays: 6 },
      { label: 'Wash bedsheets',          overdueDays: 0 },
    ],
  },
]
const CONTEXTS_UPCOMING_DEMO = [
  {
    type: 'travel',
    start: 'Jun 5, 2026',
    end: 'Jun 9, 2026',
    desc: 'Singapore trip',
    _startDate: new Date('2026-06-05'),
    routinesPaused: 2,
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
        'Soft-start Jun 10 — essentials only',
        'Aircon cleaning can wait until that weekend',
      ],
    },
  },
]
const DEMO_PLANS = [
  {
    id: 'plan-1', type: 'project', icon: '📦', title: 'Move apartments',
    dueDate: 'Jun 15',
    tasks: [
      { label: 'Book moving truck',           done: true },
      { label: 'Notify landlord',             done: true },
      { label: 'Pack bedroom',                done: false },
      { label: 'Transfer utilities',          done: false },
      { label: 'Update address with bank',    done: false },
      { label: 'Deep clean current unit',     done: false },
      { label: 'Return keys',                 done: false },
    ],
  },
  {
    id: 'plan-2', type: 'event', icon: '📅', title: 'Job interview — Acme Co.',
    eventDate: new Date('2026-05-08'),
    tasks: [
      { label: 'Research the company',        done: true },
      { label: 'Prepare questions to ask',    done: false },
      { label: 'Iron outfit',                 done: false },
    ],
  },
  {
    id: 'plan-3', type: 'goal', goalKind: 'numeric', icon: '🎯', title: 'Save ₱50,000',
    current: 31500, target: 50000, unit: '₱', targetDate: 'Aug 2026',
  },
]
const SUGGESTIONS = [
  { text: "What am I forgetting?", emoji: "🦉" },
  { text: "Plan around my Singapore trip", emoji: "🗺️" },
  { text: "I have a busy week — lighten my routine", emoji: "🪶" },
  { text: "Why did I skip my morning routine this week?", emoji: "🌅" },
]
const SCRIPTED_RESPONSES = {
  "What am I forgetting?": {
    thinking: [
      "Looking at tasks overdue more than 3 days...",
      "Cross-referencing your importance settings...",
      "Checking if any context windows explain the misses...",
      "Filtering out things you intentionally skipped...",
    ],
    answer: `Here's what you're forgetting, sorted by what matters most:\n\n**🔴 Disconnection risk:**\n• **Maynilad bill** — 19 days overdue. You usually pay this early in the month.\n• **Meralco bill** — 9 days overdue. Mid-month pattern, payday-aligned.\n\n**🟡 Personal:**\n• **Call Mom** — 17 days overdue. You called her every Sunday for 19 weeks straight, then three Sundays got skipped. Your pattern broke.\n\n**🟢 Easier wins:**\n• **Clean aircon filter** — 78 days since last clean. Still inside your usual ~11-week range.\n• **Change toothbrush** — last logged 4 months ago.\n\nWant me to plan these around your Singapore trip next week?`,
    actions: [
      { action_type: 'defer', emoji: '→', label: 'Defer Maynilad bill', payload: { defer_until: '2026-05-10' } },
    ],
    chips: [
      { emoji: '🗺️', text: 'Plan around my Singapore trip' },
      { emoji: '🕊️', text: 'Why did I skip calling Mom?' },
      { emoji: '✓', text: 'I already paid the bills' },
    ],
  },
  "Plan around my Singapore trip": {
    thinking: [
      "Reading your travel context: Apr 28 to May 2...",
      "Identifying tasks and routines that fall in that window...",
      "Categorizing by what truly can't wait...",
      "Drafting a pre-trip and after-trip plan...",
    ],
    answer: `Got it — **Singapore trip Apr 28 – May 2** is locked in.\n\n**Before you leave (next 6 days):**\n• Pay Maynilad and Meralco — handle these this week.\n• Submit timesheet (Friday).\n• Refill water dispenser the day before you fly.\n\n**While you're away:**\n• I'll pause your morning and evening routines automatically.\n\n**When you're back (May 3–5):**\n• I'll resume your routines on May 3 with a soft start — just the essentials.\n• Aircon cleaning can wait until that weekend.`,
    chips: [
      { emoji: '🍃', text: 'Lighten my routine while away' },
      { emoji: '🌾', text: 'What am I forgetting before I leave?' },
      { emoji: '🌱', text: 'Looks good, thanks' },
    ],
  },
  "I have a busy week — lighten my routine": {
    thinking: [
      "Adding 'busy' context to your timeline...",
      "Looking at your morning routine: 4 items...",
      "Checking which items you tend to keep even on busy days...",
    ],
    answer: `Acknowledged — I'm marking this week as busy.\n\n**Your morning routine, lightened:**\nLooking at your skip patterns from the last three busy weeks, you almost always keep:\n• Vitamins (you keep these 90% of the time, even when stressed)\n• Coffee (you wouldn't skip this if the building was on fire)\n\n**My suggestion:** This week, your morning routine is just **vitamins + coffee.** I won't ping you about stretch or journal. We'll bring them back once your week clears up.`,
    actions: [
      { action_type: 'lighten_routine', emoji: '🪶', label: 'Lighten Morning Routine', routine_id: 'morning', payload: { duration_days: 7, preview: { remove: [{ name: 'Stretching', duration_min: 5 }, { name: 'Morning journal', duration_min: 10 }], keep: ['Vitamins', 'Coffee'] } } },
    ],
    chips: [
      { emoji: '🍂', text: 'How long until things calm down?' },
      { emoji: '🌙', text: 'Lighten my evening routine too' },
      { emoji: '✓', text: "Sounds right, let's do it" },
    ],
  },
  "Why did I skip my morning routine this week?": {
    thinking: [
      "Looking at your morning routine completion history...",
      "Cross-referencing skip days with your calendar context...",
    ],
    answer: `You skipped Monday and Tuesday this week.\n\n**Pattern across both days:**\n• Both days you woke up later than usual (after 8 AM based on first task logs).\n• You marked the skip as "too busy" both times.\n\n**The bigger picture:**\nYour morning routine completion drops sharply when your bedtime goes past 11 PM. When sleep slips, your morning slips with it.\n\nWant me to send a quiet "wind down" nudge at 10:30 PM on nights when you've been up late?`,
    actions: [
      { action_type: 'lighten_routine', emoji: '🪶', label: 'Lighten it this week', routine_id: 'morning', payload: { duration_days: 5, preview: { remove: [{ name: 'Stretching', duration_min: 5 }, { name: 'Morning journal', duration_min: 10 }], keep: ['Vitamins', 'Coffee'] } } },
      { action_type: 'skip', emoji: '🍂', label: 'Skip this week entirely', payload: {} },
    ],
    chips: [
      { emoji: '🌳', text: 'Show me the full skip history' },
      { emoji: '🌱', text: 'Lighten the routine permanently' },
      { emoji: '🪴', text: 'Thanks, I just needed to know' },
    ],
  },
}
const FALLBACK_RESPONSE = {
  thinking: ["Searching your task memory...", "Cross-referencing context...", "Drafting a response..."],
  answer: `I'm reaching out to your personal agent now. If I seem slow, I'm probably thinking hard.\n\nIn this prototype, a few scripted responses are pre-wired — try one of the suggestion chips above to see the full experience. The live agent uses Azure OpenAI + AI Search to answer anything about your tasks and patterns.`,
  chips: [
    { emoji: '🦉', text: 'What am I forgetting?' },
    { emoji: '🗺️', text: 'Plan around my Singapore trip' },
    { emoji: '🪶', text: 'I have a busy week — lighten my routine' },
  ],
}

// ── Helpers ────────────────────────────────────────────────────
// Heuristic cadence suggestion based on task name. Returns { days, reason }
// for known patterns, or null. Pre-fills the Add Task cadence picker so common
// life-admin tasks land at sensible defaults without the user thinking.
function suggestCadence(name) {
  if (!name) return null
  const s = name.toLowerCase().trim()
  const rules = [
    { re: /\bpay\b.*\b(bill|maynilad|meralco|rent|electric|water|internet|pldt|globe|mortgage)\b/, days: 30, reason: 'looks like a monthly bill' },
    { re: /\b(maynilad|meralco|pldt|globe|electric|water bill|water dispenser refill)\b/, days: 30, reason: 'looks like a monthly bill' },
    { re: /\b(rent|mortgage|insurance|subscription)\b/, days: 30, reason: 'looks monthly' },
    { re: /\bsubmit (timesheet|report)\b/, days: 7, reason: 'usually weekly' },
    { re: /\b(call|text)\s+(mom|dad|mother|father|family|grandma|grandpa|sister|brother)\b/, days: 7, reason: 'weekly check-in' },
    { re: /\b(water|refill)\b.*\b(plant|water dispenser|filter)\b/, days: 7, reason: 'usually weekly' },
    { re: /\b(water|water the)\s+plants?\b/, days: 7, reason: 'usually weekly' },
    { re: /\b(wash|change)\b.*\b(bedsheet|sheet|laundry|clothes)\b/, days: 14, reason: 'every two weeks works for most' },
    { re: /\b(clean)\b.*\b(aircon|filter|fridge|oven)\b/, days: 28, reason: 'roughly monthly' },
    { re: /\b(aircon filter)\b/, days: 56, reason: 'every ~8 weeks is typical' },
    { re: /\b(cat|litter|cat litter)\b/, days: 3, reason: 'every few days' },
    { re: /\b(trash|garbage|bin)\b/, days: 7, reason: 'usually weekly' },
    { re: /\b(exercise|gym|workout|run|jog|walk)\b/, days: 3, reason: 'every few days keeps the streak' },
    { re: /\b(vitamin|supplement|meds|medication|take.*pill)\b/, days: 1, reason: 'daily' },
    { re: /\b(journal|stretch|meditate|read|reading)\b/, days: 1, reason: 'daily habit' },
    { re: /\b(grocery|groceries|shopping|market)\b/, days: 7, reason: 'usually weekly' },
    { re: /\b(haircut)\b/, days: 42, reason: 'every ~6 weeks for most' },
    { re: /\b(dentist|dental)\b/, days: 180, reason: 'every six months' },
    { re: /\b(doctor|checkup|annual)\b/, days: 365, reason: 'yearly' },
  ]
  for (const r of rules) {
    if (r.re.test(s)) return { days: r.days, reason: r.reason }
  }
  return null
}

// Render a relative day-count into prose so cards, banners, and empty-states
// all speak the same way: today / tomorrow / in 3 days / in 2 weeks /
// in 4 months. Pairs with formatCadence below; both return prose.
function formatRelativeDays(days) {
  if (days == null) return ''
  const n = Math.round(Number(days))
  if (!Number.isFinite(n)) return ''
  if (n <= 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n < 14) return `in ${n} days`
  const weeks = Math.round(n / 7)
  if (weeks <= 8) return `in ${weeks} weeks`
  const months = Math.round(n / 30)
  return `in ${months} month${months === 1 ? '' : 's'}`
}

// Render a cadence in days into something a human reads as natural prose.
// "33.6 days" reads like a sensor log; "~5 weeks" reads like a friend.
function formatCadence(days, { learned } = {}) {
  if (days == null) return 'still learning your cadence'
  const n = Number(days)
  if (!Number.isFinite(n) || n <= 0) return 'still learning your cadence'
  const tilde = learned ? '~' : ''
  if (n < 1.5) return 'daily'
  if (n <= 14) return `every ${tilde}${Math.round(n)} days`
  if (n <= 56) {
    const weeks = Math.round(n / 7)
    return weeks === 1 ? 'weekly' : `every ${tilde}${weeks} weeks`
  }
  if (n <= 90 && Math.abs(n - 30) <= 4) return 'monthly'
  if (n <= 365) {
    const months = Math.round(n / 30)
    return months === 1 ? 'monthly' : `every ${tilde}${months} months`
  }
  return `every ${tilde}${Math.round(n / 30)} months`
}

function computeTaskDisplay(task) {
  const now = new Date()
  const nextDue = task.next_due_at ? new Date(task.next_due_at) : null
  const lastDoneDate = task.last_done_at ? new Date(task.last_done_at) : null
  let overdue = null
  let dueIn
  if (nextDue) {
    const diffMs = now - nextDue
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays > 0) overdue = diffDays
    else dueIn = Math.abs(diffDays)
  }
  const cadence = task.learned_cadence_days
    ? formatCadence(task.learned_cadence_days, { learned: true })
    : task.explicit_cadence_days
    ? formatCadence(task.explicit_cadence_days)
    : 'still learning your cadence'
  let lastDone = 'never'
  if (lastDoneDate) {
    const d = Math.floor((now - lastDoneDate) / 86400000)
    lastDone = d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
  }
  return { ...task, cadence, lastDone, overdue, dueIn, learned: !!task.learned_cadence_days }
}

function formatContextDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function mapApiContext(ctx) {
  return {
    type: ctx.context_type || ctx.type || 'other',
    desc: ctx.description || ctx.desc || '',
    start: formatContextDate(ctx.start_date) || ctx.start || '',
    end: formatContextDate(ctx.end_date) || ctx.end || '',
    _endDate: ctx.end_date ? new Date(ctx.end_date) : new Date(),
  }
}

// ── useChat hook ───────────────────────────────────────────────
function useChat({ onLightenRoutine, onTaskAdded } = {}) {
  const [messages, setMessages] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem('heed.chat-history.v1')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map(m => ({ role: m.role, content: m.content }))
        .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length > 0)
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(null)
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const toSave = messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
      localStorage.setItem('heed.chat-history.v1', JSON.stringify(toSave))
    } catch (_) {}
  }, [messages])

  const send = useCallback(async (text) => {
    if (busy) return
    const trimmed = text.trim()
    if (!trimmed) return
    const snapshot = [...messages]
    setMessages(m => [...m, { role: 'user', content: trimmed }])
    setInput('')
    setBusy(true)
    setThinking([])

    let thinkingSteps = []
    let finalText = ''
    let pendingActions = []
    let pendingChips = []

    try {
      const resp = await fetch(`${FUNCTIONS_URL}/api/advisor_stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: snapshot }),
      })
      if (!resp.ok) throw new Error(`${resp.status}`)
      const ndjson = await resp.text()
      const events = ndjson.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line) } catch { return null }
      }).filter(Boolean)
      thinkingSteps = events.filter(e => e.type === 'thinking').map(e => e.step)
      pendingActions = events
        .filter(e => e.type === 'action')
        .map(({ type, ...rest }) => rest)
      const chipsEvent = events.find(e => e.type === 'chips')
      pendingChips = chipsEvent?.chips || []
      const done = events.find(e => e.type === 'done')
      finalText = done?.final_text || events.filter(e => e.type === 'delta').map(e => e.text).join('') || ''
      if (!finalText) throw new Error('empty')
    } catch {
      const scripted = SCRIPTED_RESPONSES[trimmed] || FALLBACK_RESPONSE
      thinkingSteps = scripted.thinking
      finalText = scripted.answer
      pendingActions = scripted.actions || []
      pendingChips = scripted.chips || []
    }

    for (let i = 0; i < thinkingSteps.length; i++) {
      setThinking(thinkingSteps.slice(0, i + 1))
      await new Promise(r => setTimeout(r, 120 + Math.random() * 80))
    }
    setThinking(null)

    const words = finalText.split(' ')
    let acc = ''
    for (let i = 0; i < words.length; i++) {
      acc += (i > 0 ? ' ' : '') + words[i]
      setStreaming(acc)
      await new Promise(r => setTimeout(r, 8 + Math.random() * 8))
    }
    setMessages(m => [...m, { role: 'assistant', content: acc, actions: pendingActions, chips: pendingChips }])
    setStreaming('')
    setBusy(false)
  }, [busy, messages])

  const executeAction = useCallback(async (messageIndex, actionIndex) => {
    const msg = messages[messageIndex]
    if (!msg?.actions?.[actionIndex]) return
    const action = msg.actions[actionIndex]
    if (action.confirmed) return

    try {
      const resp = await fetch(`${FUNCTIONS_URL}/api/execute_action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: action.action_type,
          payload: { ...action.payload, task_id: action.task_id, routine_id: action.routine_id },
        }),
      })
      const result = await resp.json()
      if (!result.ok) throw new Error(result.error || 'Failed')
      let displaySummary = result.summary
      if (action.action_type === 'lighten_routine') {
        const itemsToStrike = (action.payload?.preview?.remove || []).map(x => typeof x === 'object' ? x.name : x)
        const keep = action.payload?.preview?.keep || []
        if (itemsToStrike.length > 0) {
          displaySummary = `Removed: ${itemsToStrike.join(', ')}${keep.length > 0 ? ` · Kept: ${keep.join(', ')}` : ''}`
        }
        onLightenRoutine?.(action.routine_id, itemsToStrike.length > 0 ? itemsToStrike : null)
      }
      if (action.action_type === 'add_task' && result.ok) {
        onTaskAdded?.()
      }
      setMessages(msgs => msgs.map((m, i) => {
        if (i !== messageIndex) return m
        return {
          ...m,
          actions: m.actions.map((a, j) =>
            j === actionIndex ? { ...a, confirmed: true, summary: displaySummary } : a
          ),
        }
      }))
    } catch (err) {
      setMessages(msgs => msgs.map((m, i) => {
        if (i !== messageIndex) return m
        return {
          ...m,
          actions: m.actions.map((a, j) =>
            j === actionIndex ? { ...a, error: err.message } : a
          ),
        }
      }))
    }
  }, [messages])

  return { messages, input, setInput, thinking, streaming, busy, send, executeAction }
}

// ── useMic hook ────────────────────────────────────────────────
function useMic(onTranscript, onEnd) {
  const [listening, setListening] = useState(false)
  const recogRef = useRef(null)
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  const stop = useCallback(() => { recogRef.current?.stop() }, [])
  const toggle = useCallback(() => {
    if (!supported) return
    if (listening) { stop(); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.lang = 'en-US'; r.interimResults = true; r.continuous = false
    r.onstart = () => setListening(true)
    r.onresult = (e) => {
      const transcript = Array.from(e.results).map(res => res[0].transcript).join('')
      const isFinal = e.results[e.results.length - 1].isFinal
      onTranscript(transcript, isFinal)
    }
    r.onend = () => { setListening(false); onEnd?.() }
    r.onerror = () => { setListening(false); onEnd?.() }
    recogRef.current = r
    r.start()
  }, [listening, supported, onTranscript, onEnd, stop])
  useEffect(() => () => recogRef.current?.abort(), [])
  return { listening, toggle, supported }
}

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

// ── Settings ──────────────────────────────────────────────────
const PRESET_COLORS = ['#C9854A','#8FB89A','#D4A24C','#5B8DB8','#9B7BB8','#E8714C','#7A8EA0','#8A9460']

function AvatarButton({ name, onClick }) {
  const initials = (name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <button
      onClick={onClick}
      aria-label="Settings"
      style={{
        width: 36, height: 36, borderRadius: '50%', background: C.warmDark,
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
        fontFamily: 'Lora, Georgia, serif', fontSize: 14, fontWeight: 600, color: C.cream,
        letterSpacing: 0.3, transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.82' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      {initials}
    </button>
  )
}

function SettingsRow({ children, last = false, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', padding: '0 16px', minHeight: 52, gap: 12,
        borderBottom: last ? 'none' : `1px solid ${C.hairline}`,
        background: hover && onClick ? C.bellySoft : 'transparent',
        transition: 'background 0.12s',
        cursor: onClick ? 'pointer' : 'default',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </div>
  )
}

function SettingsSheet({ open, onClose, userName, onUserName, theme, onTheme, customCategories, onAddCategory, customEventTypes, onAddEventType, onResetAllData, onLoadDemoData, efMode, onSetEfMode }) {
  const [nameVal, setNameVal] = useState(userName)
  const [nameSaved, setNameSaved] = useState(false)
  const [pendingTheme, setPendingTheme] = useState(theme)
  const [catIcon, setCatIcon] = useState('✦')
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(PRESET_COLORS[0])
  const [catOpen, setCatOpen] = useState(false)
  const [evtIcon, setEvtIcon] = useState('◈')
  const [evtLabel, setEvtLabel] = useState('')
  const [evtDays, setEvtDays] = useState('3')
  const [evtOpen, setEvtOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setNameVal(userName)
      setNameSaved(false)
      setPendingTheme(theme)
    }
  }, [open, userName, theme])

  if (!open) return null

  const builtinCategories = Object.entries(CATEGORY).map(([id, v]) => ({ id, ...v, name: id.replace('_', ' ') }))
  const builtinEvents = Object.entries(QUICK_CONTEXT_CONFIG).map(([id, v]) => ({ id, icon: v.icon, label: v.label, defaultDays: v.defaultDays }))

  const submitCategory = () => {
    if (!catName.trim()) return
    onAddCategory({ id: `cat_${Date.now()}`, icon: catIcon, name: catName.trim(), color: catColor, bg: catColor + '22' })
    setCatName(''); setCatIcon('✦'); setCatColor(PRESET_COLORS[0]); setCatOpen(false)
  }
  const submitEvent = () => {
    if (!evtLabel.trim()) return
    onAddEventType({ id: `evt_${Date.now()}`, icon: evtIcon, label: evtLabel.trim(), defaultDays: parseInt(evtDays) || 3 })
    setEvtLabel(''); setEvtIcon('◈'); setEvtDays('3'); setEvtOpen(false)
  }

  const inputSt = { width: '100%', boxSizing: 'border-box', background: C.paperHi, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }
  const group = { background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 8 }

  const fieldLabel = (text, htmlFor) => (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 11, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{text}</label>
  )
  const secLabel = (text, sub) => (
    <div style={{ marginBottom: 6, marginTop: 20, paddingLeft: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, letterSpacing: 0.5, textTransform: 'uppercase' }}>{text}</div>
      {sub && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  )
  const iconTile = (icon, bg) => (
    <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
  )

  const initials = (nameVal || 'U').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(4px)', animation: 'heed-fadeIn 0.2s ease' }}/>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, display: 'flex', justifyContent: 'center', animation: 'heed-slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ background: C.paperHi, width: '100%', maxWidth: 520, borderRadius: '22px 22px 0 0', padding: '0 16px 0 16px', boxShadow: '0 -12px 48px rgba(124,83,51,0.22)', border: `1px solid ${C.border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

          {/* Handle + Header */}
          <div style={{ flexShrink: 0, paddingTop: 12, paddingBottom: 16 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 18px' }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, fontFamily: 'Lora, Georgia, serif', fontSize: 21, fontWeight: 600, color: C.ink }}>Settings</div>
              <button
                onClick={onClose}
                aria-label="Close settings"
                style={{ width: 44, height: 44, borderRadius: '50%', background: C.paper, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.12s', touchAction: 'manipulation' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.bellySoft }}
                onMouseLeave={e => { e.currentTarget.style.background = C.paper }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>

            {/* Profile */}
            <div style={{ ...group, marginTop: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 16px', borderBottom: `1px solid ${C.hairline}` }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${C.warmDark} 0%, ${C.ochre} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Lora, Georgia, serif', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5, boxShadow: `0 4px 16px ${C.warmDark}33`, marginBottom: 10 }}>
                  {initials}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, fontFamily: 'Lora, Georgia, serif' }}>{nameVal || 'Your name'}</div>
              </div>
              <div style={{ padding: '14px 16px' }}>
                {fieldLabel('Display name', 'settings-name')}
                <input
                  id="settings-name"
                  value={nameVal}
                  onChange={e => { setNameVal(e.target.value); setNameSaved(false) }}
                  onBlur={e => { e.target.style.borderColor = C.border }}
                  onFocus={e => { e.target.style.borderColor = C.warmDark }}
                  onKeyDown={e => { if (e.key === 'Enter') { onUserName(nameVal); setNameSaved(true) } }}
                  placeholder="Your name"
                  style={{ ...inputSt }}
                  autoComplete="name"
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  {nameSaved
                    ? <span style={{ fontSize: 12.5, color: C.sage, fontWeight: 600 }}>✓ Saved</span>
                    : <button
                        onClick={() => { onUserName(nameVal); setNameSaved(true) }}
                        disabled={!nameVal.trim()}
                        style={{ ...getBtnPrimary(), opacity: !nameVal.trim() ? 0.45 : 1 }}
                      >Save</button>
                  }
                </div>
              </div>
            </div>

            {/* Appearance */}
            {secLabel('Appearance')}
            <div style={group}>
              <SettingsRow last>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  {iconTile(
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke={C.ochre} strokeWidth="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={C.ochre} strokeWidth="2" strokeLinecap="round"/></svg>,
                    C.ochre + '20'
                  )}
                  <span style={{ fontSize: 15, color: C.ink, fontWeight: 500 }}>Theme</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ThemeSwitcher theme={pendingTheme} onTheme={setPendingTheme}/>
                  {pendingTheme === theme
                    ? <span style={{ fontSize: 12.5, color: C.sage, fontWeight: 600, minWidth: 54, textAlign: 'right' }}>✓ Saved</span>
                    : <button
                        onClick={() => onTheme(pendingTheme)}
                        style={{ ...getBtnPrimary() }}
                      >Save</button>
                  }
                </div>
              </SettingsRow>
            </div>

            {/* Task Categories */}
            {secLabel('Task Categories', 'Used to tag and group your tasks')}
            <div style={group}>
              {builtinCategories.map((cat, i) => (
                <SettingsRow key={cat.id} last={i === builtinCategories.length - 1 && customCategories.length === 0 && !catOpen}>
                  {iconTile(<span style={{ color: cat.color }}>{cat.icon}</span>, cat.color + '20')}
                  <span style={{ fontSize: 15, color: C.ink, textTransform: 'capitalize', flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 10, color: C.inkMute, fontWeight: 700, background: C.hairline, borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>Built-in</span>
                </SettingsRow>
              ))}
              {customCategories.map((cat, i) => (
                <SettingsRow key={cat.id} last={i === customCategories.length - 1 && !catOpen}>
                  {iconTile(<span style={{ color: cat.color }}>{cat.icon}</span>, cat.color + '20')}
                  <span style={{ fontSize: 15, color: C.ink, flex: 1 }}>{cat.name}</span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }}/>
                </SettingsRow>
              ))}
              {catOpen ? (
                <div style={{ padding: '16px', borderTop: `1px solid ${C.hairline}`, background: C.paperHi }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div>
                      {fieldLabel('Icon', 'cat-icon-input')}
                      <input id="cat-icon-input" value={catIcon} onChange={e => setCatIcon(e.target.value)} style={{ ...inputSt, width: 52, textAlign: 'center', padding: '10px 6px' }}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      {fieldLabel('Name', 'cat-name-input')}
                      <input id="cat-name-input" value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitCategory() }} placeholder="e.g. Learning" style={{ ...inputSt }} autoFocus/>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    {fieldLabel('Color')}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setCatColor(c)}
                          aria-label={`Color ${c}`}
                          aria-pressed={catColor === c}
                          style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: catColor === c ? `3px solid ${C.ink}` : '3px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
                        >
                          {catColor === c && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={submitCategory} style={{ flex: 1, background: C.warmDark, color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>Add category</button>
                    <button onClick={() => setCatOpen(false)} style={{ flex: 1, background: 'transparent', color: C.inkSoft, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '13px 0', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <SettingsRow last onClick={() => setCatOpen(true)}>
                  {iconTile(<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={C.sage} strokeWidth="2.2" strokeLinecap="round"/></svg>, C.sage + '22')}
                  <span style={{ fontSize: 15, color: C.sage, fontWeight: 600 }}>Add category</span>
                </SettingsRow>
              )}
            </div>

            {/* Life Event Types */}
            {secLabel('Life Event Types', 'Modes that adjust your task flow')}
            <div style={group}>
              {builtinEvents.map((evt, i) => (
                <SettingsRow key={evt.id} last={i === builtinEvents.length - 1 && customEventTypes.length === 0 && !evtOpen}>
                  {iconTile(evt.icon, C.ochre + '18')}
                  <span style={{ fontSize: 15, color: C.ink, flex: 1 }}>{evt.label.split(' —')[0]}</span>
                  <span style={{ fontSize: 12, color: C.inkMute, fontWeight: 600 }}>{evt.defaultDays}d</span>
                </SettingsRow>
              ))}
              {customEventTypes.map((evt, i) => (
                <SettingsRow key={evt.id} last={i === customEventTypes.length - 1 && !evtOpen}>
                  {iconTile(evt.icon, C.border)}
                  <span style={{ fontSize: 15, color: C.ink, flex: 1 }}>{evt.label}</span>
                  <span style={{ fontSize: 12, color: C.inkMute, fontWeight: 600 }}>{evt.defaultDays}d</span>
                </SettingsRow>
              ))}
              {evtOpen ? (
                <div style={{ padding: '16px', borderTop: `1px solid ${C.hairline}`, background: C.paperHi }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div>
                      {fieldLabel('Icon', 'evt-icon-input')}
                      <input id="evt-icon-input" value={evtIcon} onChange={e => setEvtIcon(e.target.value)} style={{ ...inputSt, width: 52, textAlign: 'center', padding: '10px 6px' }}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      {fieldLabel('Name', 'evt-name-input')}
                      <input id="evt-name-input" value={evtLabel} onChange={e => setEvtLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitEvent() }} placeholder="e.g. Vacation" style={{ ...inputSt }} autoFocus/>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    {fieldLabel('Default duration', 'evt-days-input')}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input id="evt-days-input" type="number" inputMode="numeric" min="1" max="60" value={evtDays} onChange={e => setEvtDays(e.target.value)} style={{ ...inputSt, width: 80, textAlign: 'center' }}/>
                      <span style={{ fontSize: 14, color: C.inkSoft }}>days</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={submitEvent} style={{ flex: 1, background: C.warmDark, color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>Add event type</button>
                    <button onClick={() => setEvtOpen(false)} style={{ flex: 1, background: 'transparent', color: C.inkSoft, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '13px 0', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <SettingsRow last onClick={() => setEvtOpen(true)}>
                  {iconTile(<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={C.sage} strokeWidth="2.2" strokeLinecap="round"/></svg>, C.sage + '22')}
                  <span style={{ fontSize: 15, color: C.sage, fontWeight: 600 }}>Add event type</span>
                </SettingsRow>
              )}
            </div>

            {/* Focus mode toggle — surfaces "Just one thing" mode for crash
                days. Same flag the Today header toggles, so this is a calm
                discoverability path for users who don't notice the inline pill. */}
            {secLabel('Focus')}
            <div style={group}>
              <SettingsRow last
                onClick={() => onSetEfMode?.(!efMode)}>
                {iconTile(
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke={C.warmDark} strokeWidth="1.6"/>
                    <circle cx="12" cy="12" r="3.5" fill={C.warmDark}/>
                  </svg>,
                  C.warmDark + '18'
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: C.ink, fontWeight: 500 }}>Just one thing</div>
                  <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
                    Today shows only the single most important task. For crash days when a full list overwhelms.
                  </div>
                </div>
                {/* Switch — 46×28 pill (was 38×22). On=sage (semantic positive
                    state, matches streaks / ✓ accents). Wrapped in a 44pt
                    hit-area so tap target meets iOS HIG / Material even though
                    the visible pill is narrower. role="switch" + aria-checked
                    so screen readers announce on/off (was aria-hidden before). */}
                <span style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  minWidth: 56, height: 44,
                  marginRight: -8,
                }}>
                  <span
                    role="switch"
                    aria-checked={efMode ? 'true' : 'false'}
                    aria-label={`Just one thing mode${efMode ? ', on' : ', off'}`}
                    style={{
                      width: 46, height: 28,
                      borderRadius: 999,
                      background: efMode ? C.sage : C.border,
                      position: 'relative',
                      transition: 'background 0.18s',
                    }}>
                    <span aria-hidden="true" style={{
                      position: 'absolute',
                      top: 3,
                      left: efMode ? 21 : 3,
                      width: 22, height: 22,
                      borderRadius: '50%',
                      background: C.cream,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
                      transition: 'left 0.18s cubic-bezier(0.32,0.72,0,1)',
                    }}/>
                  </span>
                </span>
              </SettingsRow>
            </div>

            {/* Demo data — replaces existing data with a curated seed.
                Useful for hackathon judges or for resetting to a known
                "everything populated" state for screenshots. */}
            {onLoadDemoData && secLabel('Demo data')}
            {onLoadDemoData && (
              <div style={{
                background: C.paper,
                border: `1px solid ${C.sage}55`,
                borderRadius: 14,
                padding: '20px 18px',
                marginTop: 8,
                boxShadow: `0 0 0 1px ${C.sage}11 inset`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                  <div style={{
                    flexShrink: 0,
                    width: 44, height: 44, borderRadius: 11,
                    background: C.sage + '22',
                    border: `1px solid ${C.sage}33`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 3v18M3 12h18" stroke={C.sage} strokeWidth="1.8" strokeLinecap="round"/>
                      <circle cx="12" cy="12" r="9" stroke={C.sage} strokeWidth="1.8"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 4, letterSpacing: -0.1 }}>
                      Load demo data
                    </div>
                    <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
                      Replaces everything with a curated demo set: tasks due today, two routines, three plans. Designed so a fresh look at the app shows Focus Today populated.
                    </div>
                    <div style={{ fontSize: 11.5, color: C.ochre, fontStyle: 'italic', marginTop: 6 }}>
                      Overwrites your current tasks, routines, and plans.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window === 'undefined') return
                    const ok = window.confirm(
                      'Load demo data?\n\n' +
                      'This wipes your current tasks, routines, plans, and chat history, ' +
                      'then loads a curated demo set so Focus Today is populated. ' +
                      'Use this if you want a fresh, judge-ready view.'
                    )
                    if (!ok) return
                    onLoadDemoData()
                  }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: `1.5px solid ${C.sage}99`,
                    color: C.sage,
                    padding: '11px 14px',
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    letterSpacing: 0.2,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.sage; e.currentTarget.style.color = C.cream }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.sage }}
                >
                  Load demo data
                </button>
              </div>
            )}

            {/* Danger zone — pulled out of the standard list group so the
                destructive action has visual weight, breathing room, and a
                clear "this is different" treatment. */}
            {secLabel('Danger zone')}
            <div style={{
              background: C.paper,
              border: `1px solid ${C.rust}55`,
              borderRadius: 14,
              padding: '20px 18px',
              marginTop: 8,
              boxShadow: `0 0 0 1px ${C.rust}11 inset`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{
                  flexShrink: 0,
                  width: 44, height: 44, borderRadius: 11,
                  background: C.rust + '22',
                  border: `1px solid ${C.rust}33`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" stroke={C.rust} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 4, letterSpacing: -0.1 }}>
                    Reset all data
                  </div>
                  <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
                    Permanently removes your tasks, routines, plans, contexts, completions, and chat history — on this device and on the server. You'll start with a fresh app.
                  </div>
                  <div style={{ fontSize: 11.5, color: C.rust, fontStyle: 'italic', marginTop: 6 }}>
                    This cannot be undone.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window === 'undefined') return
                  const ok = window.confirm(
                    'Reset all data?\n\n' +
                    'This permanently removes your tasks, routines, plans, contexts, completions, ' +
                    'and chat history — both on this device and on the server. ' +
                    'You will start with a fresh app. This cannot be undone.'
                  )
                  if (!ok) return
                  onResetAllData?.()
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: `1.5px solid ${C.rust}88`,
                  color: C.rust,
                  padding: '11px 14px',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  letterSpacing: 0.2,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.rust; e.currentTarget.style.color = C.cream }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.rust }}
              >
                Reset everything
              </button>
            </div>

            {/* About */}
            {secLabel('About')}
            <div style={group}>
              <SettingsRow>
                {iconTile(
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z" stroke={C.warmDark} strokeWidth="1.8"/><path d="M12 11v5M12 8h.01" stroke={C.warmDark} strokeWidth="1.8" strokeLinecap="round"/></svg>,
                  C.warmDark + '18'
                )}
                <span style={{ fontSize: 15, color: C.ink, fontWeight: 500, flex: 1 }}>Heed</span>
                <span style={{ fontSize: 13, color: C.inkMute }}>v1.0</span>
              </SettingsRow>
              <SettingsRow last>
                {iconTile(
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={C.ochre} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  C.ochre + '18'
                )}
                <span style={{ fontSize: 15, color: C.ink, fontWeight: 500, flex: 1 }}>Made with intention</span>
                <span style={{ fontSize: 13, color: C.inkMute }}>anitohlm</span>
              </SettingsRow>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}

// ── MobileBottomNav ────────────────────────────────────────────
function MobileBottomNav({ tab, onTab, onMicAsk, overdueCount = 0 }) {
  const askActive = tab === 'ask'
  const [pressing, setPressing] = useState(false)
  const pressTimer = useRef(null)
  const latestTranscript = useRef('')

  const { listening: micListening, toggle: startMic, supported: micSupported } = useMic(
    useCallback((text) => { latestTranscript.current = text }, []),
    useCallback(() => {
      const t = latestTranscript.current.trim()
      latestTranscript.current = ''
      if (t) onMicAsk?.(t)
    }, [onMicAsk])
  )

  const handleOwlDown = useCallback((e) => {
    if (!micSupported) return
    e.preventDefault()
    setPressing(true)
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null
      setPressing(false)
      startMic()
    }, 500)
  }, [micSupported, startMic])

  const handleOwlUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
      setPressing(false)
      onTab('ask')
    }
  }, [onTab])

  const handleOwlCancel = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
      setPressing(false)
    }
  }, [])

  return (
    <>
      <nav
        className="heed-bottom-nav"
        aria-label="Main navigation"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: C.paper,
          borderTop: `1px solid ${C.border}`,
          zIndex: 50,
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -2px 16px rgba(0,0,0,0.12)',
          overflow: 'visible',
        }}
      >
        {/* Opaque "podium" behind the owl. The owl button sits at top:-30 and
            uses a circular border-radius — so the corners of its bounding box
            (above the nav top edge) are transparent and let chat content
            scroll through. This shield is a paper-colored hump (semicircle
            top, flat bottom) that fills those corners and visually extends
            the nav surface up around the owl. */}
        <div aria-hidden="true" style={{
          position: 'absolute',
          top: -30, left: '50%', transform: 'translateX(-50%)',
          width: 84, height: 30,
          background: C.paper,
          borderRadius: '42px 42px 0 0',
          zIndex: 51,
          pointerEvents: 'none',
        }}/>
        {/* Owl circle — tap = Ask Heed screen; long-press = mic then auto-send */}
        <button
          onPointerDown={micSupported ? handleOwlDown : undefined}
          onPointerUp={micSupported ? handleOwlUp : undefined}
          onPointerLeave={micSupported ? handleOwlCancel : undefined}
          onPointerCancel={micSupported ? handleOwlCancel : undefined}
          onClick={micSupported ? undefined : () => onTab('ask')}
          onContextMenu={e => e.preventDefault()}
          aria-label={micListening ? 'Listening… release to send' : 'Ask Heed — hold to speak'}
          aria-current={askActive ? 'page' : undefined}
          style={{
            position: 'absolute',
            top: -30,
            left: '50%',
            transform: `translateX(-50%) scale(${pressing ? 1.12 : 1})`,
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: C.paper,
            border: `2.5px solid ${micListening ? '#e53e3e' : askActive ? C.warmDark : `${C.warmDark}99`}`,
            boxShadow: micListening
              ? `0 0 0 3px #fff3f3, 0 0 0 8px rgba(229,62,62,0.35), 0 -4px 20px rgba(229,62,62,0.3)`
              : askActive
              ? `0 0 0 3px ${C.paper}, 0 0 0 6px ${C.warmDark}55, 0 -6px 24px rgba(0,0,0,0.28)`
              : `0 0 0 3px ${C.paper}, 0 0 0 5px ${C.border}, 0 -4px 20px rgba(0,0,0,0.22)`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            zIndex: 52,
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
            animation: micListening ? 'heed-mic-pulse 1.2s ease-in-out infinite' : 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <MayaOwl size={50} idle={false} mood={micListening ? 'thinking' : 'calm'} speaking={micListening}/>
        </button>

        {APP_TABS.map(t => {
          const active = tab === t.id
          const isAsk = t.id === 'ask'
          if (isAsk) return <div key="ask" style={{ flex: 1 }} />
          const ic = active ? C.warmDark : C.inkMute
          const navIcon = {
            today: (
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <path d="M8.5 2C8.5 2,14.5 5.5,14.5 10C14.5 13,12 15,8.5 15C5 15,2.5 13,2.5 10C2.5 5.5,8.5 2,8.5 2Z"
                  stroke={ic} strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M8.5 15V8" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M5.5 10.5L8.5 8L11.5 10.5" stroke={ic} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ),
            calendar: (
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <rect x="1.5" y="4.5" width="14" height="11" rx="2.5" stroke={ic} strokeWidth="1.4"/>
                <path d="M5.5 2.5v4M11.5 2.5v4M1.5 8.5h14" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="5.5" cy="12" r="1" fill={ic}/>
                <circle cx="8.5" cy="12" r="1" fill={ic}/>
                <circle cx="11.5" cy="12" r="1" fill={ic}/>
              </svg>
            ),
            tracks: (
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <path d="M8.5 15.5V6.5" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M8.5 10.5C6.5 8.5,3.5 8.5,2.5 9.5" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M8.5 7.5C10.5 5.5,13.5 5.5,14.5 6.5" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M8.5 6V2.5" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="8.5" cy="2.5" r="1.2" fill={ic}/>
              </svg>
            ),
            context: (
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <path d="M2 5C4 3,6 2.5,8.5 2.5C11 2.5,13 3,15 5" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M2 9C4 7,6 6.5,8.5 6.5C11 6.5,13 7,15 9" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M2 13C4 11,6 10.5,8.5 10.5C11 10.5,13 11,15 13" stroke={ic} strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            ),
          }[t.id]
          return (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                borderTop: `2px solid ${active ? C.warmDark : 'transparent'}`,
                padding: '8px 4px 7px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                cursor: 'pointer',
                fontFamily: 'inherit',
                minWidth: 0,
              }}
            >
              <div style={{ position: 'relative', transition: 'opacity 0.15s', opacity: active ? 1 : 0.7 }}>
                {navIcon}
                {/* Overdue badge — only on Today, only when something needs attention.
                    Replaces real push notifications until Capacitor wraps the app. */}
                {t.id === 'today' && overdueCount > 0 && (
                  <span aria-label={`${overdueCount} overdue`} style={{
                    position: 'absolute',
                    top: -5, right: -8,
                    minWidth: 16, height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: C.rust,
                    color: C.cream,
                    fontSize: 9.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    border: `1.5px solid ${C.paper}`,
                    lineHeight: 1,
                  }}>
                    {overdueCount > 9 ? '9+' : overdueCount}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color: ic,
                letterSpacing: 0.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                padding: '0 2px',
                transition: 'color 0.15s',
              }}>
                {t.label}
              </span>
            </button>
          )
        })}
      </nav>
    </>
  )
}

// ── MayaOwl ────────────────────────────────────────────────────
function MayaOwl({ size = 120, mood = 'calm', speaking = false, idle = true }) {
  const uid = React.useId().replace(/:/g, '')
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
          <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
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
        <ellipse cx="100" cy="140" rx="58" ry="65" fill={oc.body} filter={`url(#${uid}-glow)`}/>

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

// ── Shared components ──────────────────────────────────────────
function Pill({ children, tone = 'ink', glow = false }) {
  const tones = {
    ink:    { bg: C.belly,    color: C.inkSoft },
    sage:   { bg: C.sageSoft, color: C.sage },
    danger: { bg: C.rustSoft, color: C.rust },
    warn:   { bg: C.ochreSoft, color: C.ochre },
  }
  const t = tones[tone] || tones.ink
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      background: t.bg, color: t.color,
      boxShadow: glow ? `0 0 8px ${t.color}44` : 'none',
    }}>{children}</span>
  )
}

function ImportanceBadge({ importance }) {
  const cfg = {
    low:    { bg: C.sage,  weight: 400, shadow: 'none' },
    medium: { bg: C.ochre, weight: 500, shadow: 'none' },
    high:   { bg: C.rust,  weight: 700, shadow: `0 2px 8px ${C.rust}40` },
  }
  const key = cfg[importance] ? importance : 'medium'
  const { bg, weight, shadow } = cfg[key]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg, color: C.cream,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 11.5, fontWeight: weight, letterSpacing: 0.1,
      boxShadow: shadow, flexShrink: 0,
    }}>
      {key === 'low' && (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <circle cx="4" cy="4" r="3" fill="none" stroke={C.cream} strokeWidth="1.5"/>
        </svg>
      )}
      {key === 'medium' && (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <polygon points="4,0.5 7.5,4 4,7.5 0.5,4" fill={C.cream}/>
        </svg>
      )}
      {key === 'high' && (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <circle cx="4" cy="4" r="3.5" fill={C.cream}/>
        </svg>
      )}
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  )
}

function CategoryBadge({ category }) {
  const c = CATEGORY[category] || CATEGORY.admin
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      background: c.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, color: c.color,
    }}>{c.icon}</div>
  )
}

// Themed date field: input-shaped trigger that opens a brand-themed
// calendar panel (replaces the OS native date picker, which uses the
// blue-on-white system style and breaks the warm-dark earthy palette).
// `value` is an ISO YYYY-MM-DD string, '' when empty. `onChange(iso)`.
function DateField({ value, onChange, placeholder = 'Pick a date' }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) { const d = new Date(value + 'T00:00:00'); if (!isNaN(d)) return new Date(d.getFullYear(), d.getMonth(), 1) }
    const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const wrapRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const valueDate = value ? new Date(value + 'T00:00:00') : null
  const today = new Date(); today.setHours(0,0,0,0)
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const displayLabel = valueDate
    ? valueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder
  // Build the 6-row grid: monday-first, leading days from previous month, then this month, then trailing.
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const startWeekday = (firstOfMonth.getDay() + 6) % 7  // Mon=0..Sun=6
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const isSameDay = (a, b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
  function pickDay(d) {
    const picked = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d, 12, 0, 0)
    const iso = `${picked.getFullYear()}-${String(picked.getMonth()+1).padStart(2,'0')}-${String(picked.getDate()).padStart(2,'0')}`
    onChange(iso)
    setOpen(false)
  }
  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: C.paper,
          border: `1.5px solid ${open ? C.warmDark : C.border}`,
          borderRadius: 10,
          padding: '9px 12px',
          minHeight: 44,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: value ? C.ink : C.inkMute,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.15s',
        }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
          <rect x="1.5" y="3" width="11" height="9.5" rx="1.5" stroke={C.inkMute} strokeWidth="1.2"/>
          <path d="M4 1.5v3M10 1.5v3M1.5 6h11" stroke={C.inkMute} strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span style={{ flex: 1 }}>{displayLabel}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Choose date" style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: C.paperHi,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
          zIndex: 200,
          width: 280,
          animation: 'heed-fadeUp 0.16s cubic-bezier(0.32,0.72,0,1)',
        }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
              aria-label="Previous month"
              style={{ background: 'none', border: 'none', color: C.inkSoft, padding: 6, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, lineHeight: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2l-5 5 5 5" stroke={C.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            </button>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 14, fontWeight: 600, color: C.warmDark }}>{monthLabel}</div>
            <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
              aria-label="Next month"
              style={{ background: 'none', border: 'none', color: C.inkSoft, padding: 6, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, lineHeight: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke={C.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            </button>
          </div>
          {/* weekday row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['M','T','W','T','F','S','S'].map((wd, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, textAlign: 'center', padding: '4px 0', letterSpacing: 0.5 }}>{wd}</div>
            ))}
          </div>
          {/* day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={i} style={{ height: 32 }}/>
              const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d)
              const isToday = isSameDay(cellDate, today)
              const isSelected = isSameDay(cellDate, valueDate)
              return (
                <button key={i} type="button" onClick={() => pickDay(d)}
                  aria-label={cellDate.toDateString()}
                  aria-pressed={isSelected}
                  style={{
                    height: 32,
                    background: isSelected ? C.warmDark : isToday ? C.bellySoft : 'transparent',
                    color: isSelected ? C.cream : isToday ? C.warmDark : C.ink,
                    border: 'none',
                    borderRadius: 7,
                    fontSize: 12.5,
                    fontWeight: isSelected || isToday ? 700 : 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSelected && !isToday) e.currentTarget.style.background = C.bellySoft + '80' }}
                  onMouseLeave={e => { if (!isSelected && !isToday) e.currentTarget.style.background = 'transparent' }}
                >{d}</button>
              )
            })}
          </div>
          {/* footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTop: `1px solid ${C.hairline}`, paddingTop: 10 }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
              Clear
            </button>
            <button type="button" onClick={() => {
                const t = new Date()
                const iso = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
                onChange(iso); setOpen(false)
              }}
              style={{ background: 'none', border: 'none', color: C.warmDark, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
              Today →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Themed dropdown: looks and behaves like a native <select> trigger but
// opens a custom-styled list panel so hover/selected states use brand
// colors instead of the OS-default highlight (blue band on Chrome/Android).
// Used for the Category field in AddTaskModal. `options` is an array of
// { id, label, color, bg, icon }.
function CategoryDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const selected = options.find(o => o.id === value) || options[0]
  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: C.paper,
          border: `1.5px solid ${open ? C.warmDark : C.border}`,
          borderRadius: 10,
          padding: '8px 14px 8px 10px',
          minHeight: 44,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 14, color: C.ink,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.15s',
        }}>
        {selected && (
          <span style={{
            width: 24, height: 24, borderRadius: 6,
            background: selected.bg,
            color: selected.color,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, lineHeight: 1, flexShrink: 0,
          }}>{selected.icon}</span>
        )}
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : 'Pick a category'}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M2 4l4 4 4-4" stroke={C.inkMute} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: C.paperHi,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 4,
          boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
          zIndex: 200,
          maxHeight: 280, overflowY: 'auto',
          animation: 'heed-fadeUp 0.16s cubic-bezier(0.32,0.72,0,1)',
        }}>
          {options.map(opt => {
            const isSel = opt.id === value
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(opt.id); setOpen(false) }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = opt.bg }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: isSel ? opt.bg : 'transparent',
                  border: 'none',
                  color: isSel ? opt.color : C.ink,
                  fontSize: 13.5,
                  fontWeight: isSel ? 700 : 500,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                  minHeight: 40,
                }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: isSel ? opt.color : opt.bg,
                  color: isSel ? C.cream : opt.color,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12.5, lineHeight: 1, flexShrink: 0,
                  transition: 'background 0.12s, color 0.12s',
                }}>{opt.icon}</span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                {isSel && <span aria-hidden="true" style={{ color: opt.color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── BotanicalDivider ───────────────────────────────────────────
function BotanicalDivider({ type = 'leaf' }) {
  const color = C.inkMute
  if (type === 'stem') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ flexShrink: 0 }}>
        <line x1="11" y1="2" x2="11" y2="20" stroke={color} strokeWidth="1.3"/>
        <ellipse cx="5" cy="9" rx="6" ry="2.5" fill={color} opacity="0.55" transform="rotate(-20 5 9)"/>
        <ellipse cx="17" cy="13" rx="6" ry="2.5" fill={color} opacity="0.45" transform="rotate(20 17 13)"/>
        <ellipse cx="4" cy="16" rx="5" ry="2" fill={color} opacity="0.35" transform="rotate(-25 4 16)"/>
      </svg>
    )
  }
  if (type === 'berry') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M 2 11 Q 11 7 20 11" stroke={color} strokeWidth="1.3" fill="none"/>
        {[5, 11, 17].map((x) => {
          const t = (x - 2) / 18
          const pathY = Math.pow(1-t,2)*11 + 2*(1-t)*t*7 + Math.pow(t,2)*11
          return <circle key={x} cx={x} cy={pathY + 3} r="2.2" fill={color} opacity="0.55"/>
        })}
      </svg>
    )
  }
  if (type === 'thorn') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ flexShrink: 0 }}>
        <line x1="2" y1="11" x2="20" y2="11" stroke={color} strokeWidth="1.3"/>
        <path d="M 7 11 L 5 7" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M 15 11 L 17 7" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M 2 11 Q 11 7 20 11" stroke={color} strokeWidth="1.3" fill="none"/>
      <ellipse cx="6"  cy="9"  rx="5" ry="2.2" fill={color} opacity="0.5" transform="rotate(-15 6 9)"/>
      <ellipse cx="11" cy="7"  rx="5" ry="2.2" fill={color} opacity="0.4"/>
      <ellipse cx="16" cy="9"  rx="5" ry="2.2" fill={color} opacity="0.5" transform="rotate(15 16 9)"/>
    </svg>
  )
}

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
  )
}

function parseInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: C.warmDark, fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      : part
  )
}

function renderMarkdown(text) {
  if (!text) return null
  const blocks = text.split(/\n\n+/)
  return blocks.map((block, bi) => {
    const lines = block.split('\n')
    const bullets = lines.filter(l => l.startsWith('• ') || l.startsWith('- '))
    if (bullets.length > 0 && bullets.length === lines.length) {
      return (
        <div key={bi} style={{ marginBottom: 6 }}>
          {lines.map((line, li) => (
            <div key={li} style={{ display: 'flex', gap: 7, marginBottom: 4, paddingLeft: 2, lineHeight: 1.5 }}>
              <span style={{ color: C.sage, fontWeight: 700, flexShrink: 0, marginTop: 1, fontSize: 13 }}>·</span>
              <span style={{ flex: 1 }}>{parseInline(line.slice(2))}</span>
            </div>
          ))}
        </div>
      )
    }
    if (bullets.length > 0) {
      return (
        <div key={bi} style={{ marginBottom: 6 }}>
          {lines.map((line, li) => {
            if (line.startsWith('• ') || line.startsWith('- ')) {
              return (
                <div key={li} style={{ display: 'flex', gap: 7, marginBottom: 4, paddingLeft: 2, lineHeight: 1.5 }}>
                  <span style={{ color: C.sage, fontWeight: 700, flexShrink: 0, marginTop: 1, fontSize: 13 }}>·</span>
                  <span style={{ flex: 1 }}>{parseInline(line.slice(2))}</span>
                </div>
              )
            }
            return <div key={li} style={{ marginBottom: 2, lineHeight: 1.55 }}>{parseInline(line)}</div>
          })}
        </div>
      )
    }
    return <div key={bi} style={{ marginBottom: 6, lineHeight: 1.55 }}>{parseInline(block)}</div>
  })
}

function Bubble({ role, content, streaming: isStreaming, actions, chips, onConfirm, onChipClick }) {
  const [activePreviewIndex, setActivePreviewIndex] = useState(null)
  const isUser = role === 'user'
  const hasActions = !isUser && actions?.length > 0
  const hasChips = !isUser && chips?.length > 0

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12, animation: 'heed-fadeUp 0.3s ease' }}>
      <div style={{
        maxWidth: '84%',
        background: isUser ? C.warmDark : C.paper,
        color: isUser ? C.cream : C.ink,
        padding: '12px 16px',
        borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
        border: isUser ? 'none' : `1px solid ${C.border}`,
        fontSize: 14, lineHeight: 1.55,
        whiteSpace: isStreaming ? 'pre-wrap' : 'normal',
        boxShadow: isUser ? C.shadowSoft : 'none', fontFamily: 'inherit',
      }}>
        {isUser || isStreaming ? content : renderMarkdown(content)}
        {isStreaming && <span style={{ opacity: 0.5, animation: 'heed-blink 1s infinite' }}>▍</span>}

        {hasActions && (
          <div style={{ borderTop: `1px solid ${C.hairline}`, marginTop: 12, paddingTop: 10 }}>
            {actions.map((action, i) => {
              if (action.confirmed) {
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.sageSoft, borderRadius: 8, marginBottom: 6, animation: 'heed-fadeIn 0.3s ease' }}>
                    <span style={{ color: C.sage, fontSize: 15, flexShrink: 0 }}>✓</span>
                    <div>
                      <div style={{ fontSize: 12.5, color: C.sage, fontWeight: 600 }}>{action.label}</div>
                      {action.summary && <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 1 }}>{action.summary}</div>}
                    </div>
                  </div>
                )
              }
              if (activePreviewIndex === i) {
                const preview = action.payload?.preview || {}
                return (
                  <div key={i} style={{ background: C.sageSoft, border: `1px solid ${C.sage}55`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, animation: 'heed-fadeIn 0.2s ease' }}>
                    <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.sage, fontWeight: 700, marginBottom: 8 }}>Preview — {action.label}</div>
                    {preview.remove?.length > 0 ? (
                      <>
                        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 6 }}>Remove for {action.payload?.duration_days || 7} days:</div>
                        {preview.remove.map((item, j) => (
                          <div key={j} style={{ fontSize: 12.5, color: C.ink, marginBottom: 3 }}>
                            ✕&nbsp;{typeof item === 'object' ? item.name : item}
                            {item?.duration_min ? <span style={{ color: C.inkMute }}>&nbsp;{item.duration_min} min</span> : null}
                          </div>
                        ))}
                        {preview.keep?.length > 0 && (
                          <>
                            <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 4, marginTop: 10 }}>Keeping:</div>
                            {preview.keep.map((item, j) => (
                              <div key={j} style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 2 }}>· {item}</div>
                            ))}
                          </>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 8 }}>
                        {action.action_type === 'mark_done' && 'Mark this task as completed.'}
                        {action.action_type === 'skip' && 'Skip this task for now.'}
                        {action.action_type === 'defer' && `Defer to ${action.payload?.defer_until?.slice(0, 10) || 'later'}.`}
                        {action.action_type === 'add_context' && 'Add this context window to your timeline.'}
                        {action.action_type === 'lighten_routine' && 'Reduce your routine for the next week.'}
                      </div>
                    )}
                    {action.error && (
                      <div style={{ fontSize: 12, color: C.rust, marginBottom: 8 }}>{action.error} — try again</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => { onConfirm && onConfirm(i, action); setActivePreviewIndex(null) }}
                        style={{ flex: 1, background: C.sageSoft, border: `1px solid ${C.sage}`, color: C.sage, padding: '7px 0', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setActivePreviewIndex(null)}
                        style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.inkMute, padding: '7px 16px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }
              const isDefer = action.action_type === 'defer'
              // Only lighten_routine has a meaningful preview (the items
              // being removed vs kept). Every other action — add_context,
              // mark_done, skip, defer, add_task — has all info in the
              // payload already and the chip tap IS the confirmation.
              // Going through a preview-then-confirm step for those reads
              // as "nothing happened" to the user, who has to scroll-find
              // the second button.
              const needsPreview = action.action_type === 'lighten_routine' && (action.payload?.preview?.remove?.length > 0)
              return (
                <button key={i}
                  onClick={() => {
                    if (needsPreview) setActivePreviewIndex(i)
                    else onConfirm && onConfirm(i, action)
                  }}
                  style={{
                    background: isDefer ? C.bellySoft : C.sageSoft,
                    border: `1.5px solid ${isDefer ? C.ochre : C.sage}`,
                    color: isDefer ? C.ochre : C.sage,
                    padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontFamily: 'inherit', marginRight: 8, marginBottom: 6, transition: 'all 0.15s',
                    boxShadow: `0 1px 4px ${isDefer ? C.ochre : C.sage}22`,
                  }}
                >
                  <span>{action.emoji}</span>{action.label}
                </button>
              )
            })}
          </div>
        )}

        {hasChips && (
          <div style={{ marginTop: hasActions ? 8 : 12, paddingTop: 8, borderTop: `1px solid ${C.hairline}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>Follow up</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {chips.map((chip, i) => (
                <button key={i}
                  onClick={() => onChipClick && onChipClick(chip.text)}
                  style={{ background: C.bellySoft, border: `1.5px solid ${C.warmDark}33`, color: C.warmDark, padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', fontWeight: 500 }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.ochreSoft; e.currentTarget.style.borderColor = C.warmDark + '66' }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.bellySoft; e.currentTarget.style.borderColor = C.warmDark + '33' }}
                >
                  <span style={{ fontSize: 12 }}>{chip.emoji}</span>{chip.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── useSwipe ────────────────────────────────────────────────────
// Touch + mouse events with explicit preventDefault on touchmove —
// matches the swipe-prototype "A — Subtle" pattern (rot mult 0.06).
// Pointer events were unreliable on some Android Chrome builds where
// the gesture system would intercept horizontal moves despite
// touch-action: pan-y. Touchmove preventDefault is more declarative.
function useSwipe(onRight, onLeft, threshold = 80) {
  const ref = useRef(null)
  const cb = useRef({ onRight, onLeft, threshold })
  cb.current.onRight = onRight
  cb.current.onLeft = onLeft
  cb.current.threshold = threshold

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wrap = el.parentElement
    const st = { startX: null, startY: null, decided: null }

    const getBadges = () => ({
      done: wrap?.querySelector('[data-badge="done"]'),
      skip: wrap?.querySelector('[data-badge="skip"]'),
    })

    const applyDrag = (dx) => {
      const clamped = Math.max(-130, Math.min(130, dx))
      el.style.transform = `translateX(${clamped}px) rotate(${clamped * 0.06}deg) scale(${1 + Math.abs(clamped) / 130 * 0.03})`
      el.style.transition = 'none'
      const progress = Math.min(Math.abs(clamped) / 80, 1)
      const { done, skip } = getBadges()
      if (done) done.style.opacity = clamped > 0 ? progress : 0
      if (skip) skip.style.opacity = clamped < 0 ? progress : 0
    }

    const snapBack = () => {
      const { done, skip } = getBadges()
      if (done) done.style.opacity = 0
      if (skip) skip.style.opacity = 0
      el.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform = 'translateX(0) rotate(0deg) scale(1)'
      el.addEventListener('transitionend', () => { el.style.transform = ''; el.style.transition = '' }, { once: true })
    }

    const flyOff = (dx) => {
      const dir = dx > 0 ? 1 : -1
      const { done, skip } = getBadges()
      if (done) done.style.opacity = 0
      if (skip) skip.style.opacity = 0
      el.style.transition = 'transform 0.28s ease-in'
      el.style.transform = `translateX(${dir * window.innerWidth * 1.2}px) rotate(${dir * 22}deg) scale(0.9)`
      setTimeout(() => {
        el.style.transform = ''; el.style.transition = ''
        if (dx > 0) cb.current.onRight?.()
        else cb.current.onLeft?.()
      }, 290)
    }

    const beginDrag = (clientX, clientY) => {
      st.startX = clientX; st.startY = clientY; st.active = false
      el.style.animation = 'none'  // cancel fill-mode freeze so JS transform takes over
      el.style.transition = 'none'
    }

    const moveDrag = (clientX, clientY, evt) => {
      if (st.startX === null) return
      const dx = clientX - st.startX
      // Activate on |dx| > 8 regardless of dy — matches swipe-prototype.
      // touch-action:pan-y already keeps clearly-vertical gestures from reaching JS;
      // a JS-side dy check rejected valid diagonal swipes (e.g. dx=10 dy=11).
      if (!st.active && Math.abs(dx) > 8) st.active = true
      if (!st.active) return
      if (evt && evt.cancelable) evt.preventDefault()
      applyDrag(dx)
    }

    const endDrag = (clientX) => {
      if (st.startX === null) { st.active = false; return }
      const dx = clientX - st.startX
      const wasActive = st.active
      st.startX = null; st.startY = null; st.active = false
      if (!wasActive) {
        // Plain tap — never modified transform, so don't snapBack. Calling
        // snapBack here applies translateX(0) which creates a stacking context
        // on heed-card and traps the ⋯ menu popover below the open-menu
        // backdrop, eating the menu-item click. Just restore the animation
        // and transition that beginDrag cleared.
        el.style.animation = ''
        el.style.transition = ''
        return
      }
      if (Math.abs(dx) >= cb.current.threshold) flyOff(dx)
      else snapBack()
    }

    const ts = (e) => beginDrag(e.touches[0].clientX, e.touches[0].clientY)
    const tm = (e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY, e)
    const te = (e) => endDrag(e.changedTouches[0].clientX)
    const tc = () => { st.startX = null; st.startY = null; st.active = false; snapBack() }
    const md = (e) => { if (e.button === 0) beginDrag(e.clientX, e.clientY) }
    const mm = (e) => moveDrag(e.clientX, e.clientY, e)
    const mu = (e) => endDrag(e.clientX)

    el.addEventListener('touchstart', ts, { passive: true })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', te)
    el.addEventListener('touchcancel', tc)
    el.addEventListener('mousedown', md)
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)

    return () => {
      el.removeEventListener('touchstart', ts)
      el.removeEventListener('touchmove', tm)
      el.removeEventListener('touchend', te)
      el.removeEventListener('touchcancel', tc)
      el.removeEventListener('mousedown', md)
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', mu)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { ref }
}

// ── SwipeHint ──────────────────────────────────────────────────
function SwipeHint({ onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2800)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, borderRadius: 12, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', animation: 'heed-fadeIn 0.4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${C.sage}ee`, borderRadius: 8, padding: '5px 10px' }}>
        <span style={{ fontSize: 13 }}>→</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.cream }}>Done</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${C.ochre}ee`, borderRadius: 8, padding: '5px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.cream }}>Skip</span>
        <span style={{ fontSize: 13 }}>←</span>
      </div>
    </div>
  )
}

// ── TaskCard ───────────────────────────────────────────────────
function TaskCard({ task, delay = 0, onMarkDone, onSkip, onEdit, onAddToRoutine, onBuildRoutine, showHint = false, onHintDismiss }) {
  const [completing, setCompleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const completingRef = useRef(false)
  const timerRef = useRef(null)
  const handleDone = useCallback(() => {
    if (completingRef.current) return
    completingRef.current = true
    setCompleting(true)
    timerRef.current = setTimeout(() => onMarkDone?.(task), 600)
  }, [onMarkDone, task])
  useEffect(() => () => clearTimeout(timerRef.current), [])
  const { ref: swipeRef } = useSwipe(handleDone, () => onSkip?.(task))
  const c = CATEGORY[task.category] || CATEGORY.admin
  const isOverdue = task.overdue != null
  const isCritical = isOverdue && task.overdue >= 7

  const menuItems = [
    {
      label: 'Mark done',
      color: C.sage,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke={C.sage} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      action: () => { handleDone(); setMenuOpen(false) },
    },
    {
      label: 'Skip',
      color: C.ochre,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M13 17l5-5-5-5" stroke={C.ochre} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 17l5-5-5-5" stroke={C.ochre} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      action: () => { onSkip?.(task); setMenuOpen(false) },
    },
    {
      label: 'Edit task',
      color: C.inkSoft,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      action: () => { onEdit?.(task); setMenuOpen(false) },
    },
    {
      label: 'Add to a routine',
      color: C.inkSoft,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke={C.inkSoft} strokeWidth="1.8"/><path d="M12 8v8M8 12h8" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round"/></svg>,
      action: () => { onAddToRoutine?.(task); setMenuOpen(false) },
    },
    {
      label: 'Build a routine',
      color: C.inkSoft,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M17 2l4 4-4 4" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 014-4h14" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 22l-4-4 4-4" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 01-4 4H3" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      action: () => { onBuildRoutine?.(task); setMenuOpen(false) },
    },
  ]

  return (
    <div style={{
      position: 'relative',
      touchAction: 'pan-y',
      userSelect: 'none',
      // Lift this card above later siblings while the ⋯ menu is open. Without
      // this, the popover is z-stacked under the next card's content because
      // sibling stacking is determined by DOM order when no stacking context
      // is established. zIndex on a position:relative element creates one.
      ...(menuOpen ? { zIndex: 60 } : null),
      ...(completing ? {
        animation: 'heed-done-out 0.38s cubic-bezier(0.4,0,0.8,0.2) 0.22s forwards',
        overflow: 'hidden',
      } : { marginBottom: 10 }),
    }}>
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }}/>}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
        pointerEvents: 'none',
      }}>
        <span data-badge="done" style={{ fontSize: 18, color: C.sage, opacity: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>✓ <span style={{ fontSize: 12, fontWeight: 700 }}>Done</span></span>
        <span data-badge="skip" style={{ fontSize: 18, color: C.ochre, opacity: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ fontSize: 12, fontWeight: 700 }}>Skip</span> ↷</span>
      </div>
      <div
        ref={swipeRef}
        className="heed-card"
        style={{
          background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
          border: `1.5px solid ${isCritical ? C.rust + '44' : C.border}`,
          borderRadius: 12, padding: '14px 16px 14px 20px',
          boxShadow: C.shadowSoft,
          position: 'relative',
          animation: completing ? 'heed-done-flash 0.22s ease forwards' : 'heed-fadeUp 0.5s ease both',
          animationDelay: completing ? undefined : `${delay}ms`,
        }}
      >
        {showHint && <SwipeHint onDismiss={onHintDismiss}/>}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isCritical ? C.rust : c.color, borderRadius: '3px 0 0 3px' }}/>
        {completing && (
          <div style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: '#4a7c59',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'heed-done-check 0.22s ease forwards',
            zIndex: 2,
          }}>
            <span style={{ color: 'white', fontSize: 13, lineHeight: 1 }}>✓</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          <CategoryBadge category={task.category}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: C.ink, letterSpacing: -0.1 }}>{task.name}</span>
              {task.learned && <Pill tone="sage">✨ learned</Pill>}
              {task.importance && <ImportanceBadge importance={task.importance}/>}
            </div>
            <div style={{ fontSize: 12.5, color: C.inkMute }}>{task.cadence} · last done {task.lastDone}</div>
            {task.description && (
              <div style={{ fontSize: 12, color: C.inkSoft, fontStyle: 'italic', marginTop: 4, lineHeight: 1.4 }}>{task.description}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <div style={{ textAlign: 'right', minWidth: 64 }}>
              {isOverdue && (<>
                <div style={{ fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 600, color: isCritical ? C.rust : C.ochre, lineHeight: 1 }}>{task.overdue}d</div>
                <div style={{ fontSize: 10, color: C.inkMute, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 }}>overdue</div>
              </>)}
              {!isOverdue && task.dueIn === 0 && <Pill tone="sage">today</Pill>}
              {!isOverdue && task.dueIn > 0 && <div style={{ fontSize: 12.5, color: C.inkMute }}>{formatRelativeDays(task.dueIn)}</div>}
            </div>
            {/* ⋮ menu button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(m => !m) }}
                aria-label="Task options"
                style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', flexShrink: 0, marginRight: -6 }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: menuOpen ? C.bellySoft : 'transparent',
                  border: `1px solid ${menuOpen ? C.border : 'transparent'}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { if (!menuOpen) { e.currentTarget.style.background = C.bellySoft; e.currentTarget.style.borderColor = C.border } }}
                  onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
                >
                  <svg width="3" height="13" viewBox="0 0 3 13" fill="none">
                    <circle cx="1.5" cy="1.5" r="1.4" fill={C.inkSoft}/>
                    <circle cx="1.5" cy="6.5" r="1.4" fill={C.inkSoft}/>
                    <circle cx="1.5" cy="11.5" r="1.4" fill={C.inkSoft}/>
                  </svg>
                </span>
              </button>
              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 2px)', right: 0, zIndex: 50,
                  background: C.paperHi, border: `1px solid ${C.border}`, borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(44,24,16,0.15)', minWidth: 172, overflow: 'hidden',
                  animation: 'heed-fadeIn 0.15s ease',
                }}>
                  {menuItems.map((item, i) => (
                    <button key={i} onClick={item.action} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '0 14px', minHeight: 42, background: 'transparent', border: 'none',
                      borderBottom: i < menuItems.length - 1 ? `1px solid ${C.hairline}` : 'none',
                      fontSize: 13.5, color: item.color === C.sage ? C.sage : item.color === C.ochre ? C.ochre : C.ink,
                      fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', touchAction: 'manipulation', transition: 'background 0.1s',
                      boxSizing: 'border-box',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.bellySoft }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {item.icon}{item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── FocusTaskRow ───────────────────────────────────────────────
// Stripped-down today-only row: just a checkbox + name. Used in the
// "Focus today" section on the Today tab. No metadata, no menu — the
// goal is a clean glanceable list of what needs doing today, not a
// management surface (that lives on Tracks). Only the CHECKBOX is
// the tap target — making the whole row a button caused accidental
// ticks during scroll on mobile and made cards "disappear" when
// users were just trying to read them.
function FocusTaskRow({ task, delay = 0, onMarkDone }) {
  const [checked, setChecked] = useState(false)
  const [completing, setCompleting] = useState(false)
  const completingRef = useRef(false)
  const handleCheck = useCallback((e) => {
    if (e) e.stopPropagation()
    if (completingRef.current) return
    completingRef.current = true
    setChecked(true)
    // Beat 1 (0–320ms): checkbox fills + check draws.
    // Beat 2 (320ms+): row slides off via heed-done-out.
    // Beat 3 (~700ms): parent removes the task from the list.
    setTimeout(() => setCompleting(true), 320)
    setTimeout(() => onMarkDone?.(task), 700)
  }, [task, onMarkDone])
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        marginBottom: 10,
        animation: completing
          ? 'heed-done-out 0.38s cubic-bezier(0.4,0,0.8,0.2) forwards'
          : 'heed-fadeUp 0.5s ease both',
        animationDelay: completing ? undefined : `${delay}ms`,
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: C.shadowSoft,
      }}
    >
      <button
        type="button"
        onClick={handleCheck}
        aria-label={`Mark "${task.name}" done`}
        aria-pressed={checked}
        style={{
          // 44px hit area (Apple HIG / Material) wrapping the visual 24px box.
          width: 44, height: 44,
          flexShrink: 0,
          margin: '-10px -10px -10px -10px',
          padding: 0,
          background: 'transparent',
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          fontFamily: 'inherit',
        }}
      >
        <span aria-hidden="true" style={{
          width: 24, height: 24,
          borderRadius: 7,
          border: `2px solid ${checked ? C.sage : C.border}`,
          background: checked ? C.sage : 'transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {checked && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7l3 3 5-6"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 16,
                  strokeDashoffset: 16,
                  animation: 'heed-check-draw 0.28s cubic-bezier(0.4, 0, 0.2, 1) 0.05s forwards',
                }}
              />
            </svg>
          )}
        </span>
      </button>
      <span style={{
        fontSize: 15,
        fontWeight: 600,
        color: C.ink,
        letterSpacing: -0.1,
        textDecoration: checked ? 'line-through' : 'none',
        opacity: checked ? 0.5 : 1,
        transition: 'opacity 0.25s ease, text-decoration 0.25s ease',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {task.name}
      </span>
    </div>
  )
}

// ── useShareCard ──────────────────────────────────────────────
function useShareCard() {
  async function captureCard(el) {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(el, { scale: 1, useCORS: true, logging: false })
    return new Promise((resolve, reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png')
    )
  }

  async function downloadCard(el, filename) {
    const blob = await captureCard(el)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
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
    setTimeout(() => URL.revokeObjectURL(url), 100)
    onFallback?.()
  }

  return { downloadCard, shareCard }
}

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

// ── RoutineRow (Today tab — compact at-a-glance) ────────────────
function RoutineRow({ routine, delay = 0, onMarkDone, onSkipToday, onLighten }) {
  const last7 = routine.completion14d.slice(-7)
  const thisWeekCount = last7.filter(Boolean).length
  const isHealthy = thisWeekCount >= 5
  const isAttention = routine.suggestion != null
  const isLightened = !!routine.lightenedItems?.length
  const borderColor = isLightened ? `${C.sage}73` : isAttention ? `${C.ochre}73` : C.border
  const items = routine.items || []
  // Collapsed by default to keep Today scannable when there are several
  // routines. Tap the header to expand into the checklist + Mark all done.
  const [expanded, setExpanded] = useState(false)
  // Per-item ticked state. Visual only — when all are ticked (or the user
  // taps Mark all done) the routine fires onMarkDone for the day. We don't
  // persist individual items because the data model only tracks the routine
  // as a whole (completion14d = one bool per day).
  const [checkedItems, setCheckedItems] = useState(() => new Set())
  const [completing, setCompleting] = useState(false)
  const completingRef = useRef(false)
  const triggerComplete = useCallback(() => {
    if (completingRef.current) return
    completingRef.current = true
    setCheckedItems(new Set(items.map((_, i) => i)))
    setTimeout(() => setCompleting(true), 320)
    setTimeout(() => onMarkDone?.(routine.id), 700)
  }, [items, onMarkDone, routine.id])
  const toggleItem = (idx) => {
    if (completingRef.current) return
    setCheckedItems(s => {
      const n = new Set(s)
      if (n.has(idx)) n.delete(idx)
      else n.add(idx)
      // Auto-complete when every item is ticked. Defer the trigger so we
      // don't call setState during a setState updater.
      if (n.size === items.length && items.length > 0) {
        setTimeout(() => triggerComplete(), 200)
      }
      return n
    })
  }
  return (
    <div style={{
      background: C.paperHi,
      border: `1px solid ${borderColor}`,
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 10,
      animation: completing ? 'heed-done-out 0.38s cubic-bezier(0.4,0,0.8,0.2) forwards' : 'heed-fadeUp 0.5s ease both',
      animationDelay: completing ? undefined : `${delay}ms`,
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${routine.name}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%',
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          marginBottom: expanded ? 12 : 0,
        }}
      >
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
          style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <path d="M5 3l4 4-4 4" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: C.ink }}>{routine.name}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: isHealthy ? C.sage : C.ochre, whiteSpace: 'nowrap' }}>
          {isHealthy ? '✓' : '⚠'} {thisWeekCount}/7 this week
        </span>
      </button>

      {expanded && (
        <>
          {items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px 0' }}>
              {items.map((item, i) => {
                const checked = checkedItems.has(i)
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => toggleItem(i)}
                      aria-pressed={checked}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%',
                        padding: '7px 0',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span aria-hidden="true" style={{
                        width: 22, height: 22, flexShrink: 0,
                        borderRadius: 6,
                        border: `2px solid ${checked ? C.sage : C.border}`,
                        background: checked ? C.sage : 'transparent',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}>
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M3 7l3 3 5-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <span style={{
                        fontSize: 13.5,
                        color: checked ? C.inkMute : C.ink,
                        textDecoration: checked ? 'line-through' : 'none',
                        flex: 1,
                        minWidth: 0,
                        transition: 'color 0.18s, text-decoration 0.18s',
                      }}>{item}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={triggerComplete}
            disabled={completing}
            style={{
              width: '100%',
              background: completing ? C.sage : 'transparent',
              color: completing ? C.cream : C.sage,
              border: `1.5px solid ${C.sage}`,
              padding: '9px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: completing ? 'default' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: 0.2,
              transition: 'all 0.18s',
              opacity: completing ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!completing) { e.currentTarget.style.background = C.sage; e.currentTarget.style.color = C.cream } }}
            onMouseLeave={e => { if (!completing) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.sage } }}
          >
            ✓ Mark all done
          </button>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flex: 1 }}>
              {last7.map((done, i) => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: done ? C.sage : C.border }}/>
              ))}
              <span style={{ marginLeft: 6, fontSize: 10, color: C.inkMute, fontStyle: 'italic' }}>last 7 days</span>
            </div>
            {isLightened && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: C.sage, background: C.sageSoft, border: `1px solid ${C.sage}4d`, borderRadius: 999, padding: '2px 9px' }}>
                {routine.lightenedItems.length} items optional
              </span>
            )}
            {isAttention && !isLightened && (
              <button
                type="button"
                onClick={() => onLighten?.(routine.id)}
                style={{ fontSize: 10.5, fontWeight: 600, color: C.ochre, background: C.ochreSoft, border: `1px solid ${C.ochre}40`, borderRadius: 999, padding: '2px 9px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Lighten this week →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── RoutineCard ────────────────────────────────────────────────
function RoutineCard({ routine, delay = 0, onMarkDone, onLighten, onEdit, onShare, onMarkDay }) {
  const [hover, setHover] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const completionRate = routine.completion14d.filter(Boolean).length / routine.completion14d.length
  const doneDays = routine.completion14d.filter(Boolean).length
  const totalDays = routine.completion14d.length
  const lastWeekDone = routine.completion14d.slice(-7).filter(Boolean).length
  const isAttentionWorthy = routine.suggestion !== null
  // Close popover on outside click / Escape
  useEffect(() => {
    if (!statsOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setStatsOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [statsOpen])

  const menuItems = [
    {
      label: 'Mark today done',
      color: C.sage,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke={C.sage} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      action: () => { onMarkDone?.(routine.id); setMenuOpen(false) },
    },
    ...(isAttentionWorthy ? [{
      label: 'Lighten this week',
      color: C.ochre,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke={C.ochre} strokeWidth="1.8"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={C.ochre} strokeWidth="1.8" strokeLinecap="round"/></svg>,
      action: () => { onLighten?.(routine.id); setMenuOpen(false) },
    }] : []),
    {
      label: 'Edit',
      color: C.ink,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      action: () => { onEdit?.(routine); setMenuOpen(false) },
    },
    {
      label: 'Share card',
      color: C.ink,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke={C.inkSoft} strokeWidth="1.8"/><circle cx="6" cy="12" r="3" stroke={C.inkSoft} strokeWidth="1.8"/><circle cx="18" cy="19" r="3" stroke={C.inkSoft} strokeWidth="1.8"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" stroke={C.inkSoft} strokeWidth="1.8" strokeLinecap="round"/></svg>,
      action: () => { onShare?.(routine); setMenuOpen(false) },
    },
  ]

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
        border: `1.5px solid ${isAttentionWorthy ? C.ochre + '66' : C.border}`,
        borderRadius: 14, padding: '18px 20px', marginBottom: 12,
        boxShadow: hover ? C.shadowMed : C.shadowSoft,
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'all 0.25s ease', position: 'relative',
        // Lift above later sibling cards while ⋯ menu or stats popover is open
        // so the absolute-positioned children are not z-stacked under the
        // next card's content.
        zIndex: (menuOpen || statsOpen) ? 60 : undefined,
        animation: 'heed-fadeUp 0.5s ease both', animationDelay: `${delay}ms`,
      }}
    >
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }}/>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <div style={{ marginBottom: 3 }}>
            <span style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{routine.name}</span>
          </div>
          <div style={{ fontSize: 12, color: C.inkMute }}>{routine.schedule} · {routine.weekRate}</div>
          {routine.notes && <div style={{ fontSize: 12, color: C.inkSoft, fontStyle: 'italic', marginTop: 3, lineHeight: 1.4 }}>{routine.notes}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: 52, height: 52 }}>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setStatsOpen(o => !o); setMenuOpen(false) }}
              aria-haspopup="dialog"
              aria-expanded={statsOpen}
              aria-label={`Completion rate: ${Math.round(completionRate * 100)}%. Tap for breakdown.`}
              style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}
            >
              <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="26" cy="26" r="22" fill="none" stroke={C.hairline} strokeWidth="3"/>
                <circle cx="26" cy="26" r="22" fill="none"
                  stroke={completionRate > 0.8 ? C.sage : completionRate > 0.5 ? C.ochre : C.rust}
                  strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${completionRate * 138} 138`}
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Lora, serif', fontSize: 13, fontWeight: 600, color: C.warmDark }}>
                {Math.round(completionRate * 100)}%
              </div>
            </button>
            {statsOpen && (
              <>
                {/* invisible scrim to close on outside tap */}
                <div onClick={() => setStatsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }}/>
                <div role="dialog" aria-label="Completion breakdown" style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: C.paperHi,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  zIndex: 50,
                  minWidth: 180,
                  animation: 'heed-fadeUp 0.18s cubic-bezier(0.32,0.72,0,1)',
                }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
                    Completion rate
                  </div>
                  <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
                    <div><strong style={{ color: C.warmDark }}>{doneDays} of {totalDays} days</strong> · last 2 weeks</div>
                    <div><strong style={{ color: C.warmDark }}>{lastWeekDone} of 7 days</strong> · last week</div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(m => !m) }}
              aria-label="Routine options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              style={{
                width: 44, height: 44, background: 'transparent', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'manipulation', flexShrink: 0,
              }}
            >
              <span style={{
                width: 30, height: 30, borderRadius: '50%',
                background: menuOpen ? C.bellySoft : 'transparent',
                border: `1px solid ${menuOpen ? C.border : 'transparent'}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { if (!menuOpen) { e.currentTarget.style.background = C.bellySoft; e.currentTarget.style.borderColor = C.border } }}
                onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
              >
                <svg width="4" height="16" viewBox="0 0 4 16" fill="none">
                  <circle cx="2" cy="2" r="1.8" fill={C.inkSoft}/>
                  <circle cx="2" cy="8" r="1.8" fill={C.inkSoft}/>
                  <circle cx="2" cy="14" r="1.8" fill={C.inkSoft}/>
                </svg>
              </span>
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 2px)', right: 0, zIndex: 50,
                background: C.paperHi, border: `1px solid ${C.border}`, borderRadius: 12,
                boxShadow: '0 8px 24px rgba(44,24,16,0.15)', minWidth: 188, overflow: 'hidden',
                animation: 'heed-fadeIn 0.15s ease',
              }}>
                {menuItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '0 14px', minHeight: 44, background: 'transparent', border: 'none',
                      borderBottom: i < menuItems.length - 1 ? `1px solid ${C.hairline}` : 'none',
                      fontSize: 14, color: item.color === C.sage ? C.sage : item.color === C.ochre ? C.ochre : C.ink,
                      fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', touchAction: 'manipulation', transition: 'background 0.1s',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bellySoft }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {routine.items.map((item, i) => {
          const isOptional = routine.lightenedItems?.includes(item)
          const isDoneToday = (routine.todayItemsDone || []).includes(item)
          return (
            <button
              key={i}
              onClick={() => onMarkDay && !isOptional && onMarkDay(routine.id, '__item__', item)}
              disabled={!onMarkDay || isOptional}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: 500, fontFamily: 'inherit',
                background: isDoneToday ? C.sage + '22' : isOptional ? 'transparent' : C.bellySoft,
                color: isDoneToday ? C.sage : isOptional ? C.inkMute : C.warmDark,
                border: isDoneToday ? `1px solid ${C.sage}55` : isOptional ? `1px dashed ${C.border}` : '1px solid transparent',
                textDecoration: isOptional ? 'line-through' : 'none',
                opacity: isOptional ? 0.6 : 1,
                cursor: onMarkDay && !isOptional ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}>
              {isDoneToday ? '✓ ' : ''}{item}
            </button>
          )
        })}
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>Last 14 days</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {routine.completion14d.map((done, i) => {
            const len = routine.completion14d.length
            const daysAgo = (len - 1) - i
            const label = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`
            return (
              <button key={i}
                onClick={() => onMarkDay && onMarkDay(routine.id, i, !done)}
                disabled={!onMarkDay}
                aria-label={`Mark ${label} ${done ? 'not done' : 'done'}`}
                title={`${done ? 'Done' : 'Not done'} ${label} — click to toggle`}
                style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: onMarkDay ? 'pointer' : 'default', lineHeight: 0 }}>
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
                  <path d="M8 1 C8 1, 15 5, 15 10 C15 14, 12 17, 8 17 C4 17, 1 14, 1 10 C1 5, 8 1, 8 1 Z"
                    fill={done ? C.sage : 'transparent'}
                    stroke={done ? C.sage : C.border}
                    strokeWidth="1.5"
                    strokeDasharray={done ? 'none' : '2 2'}
                  />
                </svg>
              </button>
            )
          })}
          <div style={{ marginLeft: 8, fontSize: 10, color: C.inkMute, fontStyle: 'italic' }}>today →</div>
        </div>
      </div>
      {routine.lightenedItems?.length ? (
        <div style={{ background: C.sageSoft, border: `1px solid ${C.sage}44`, borderRadius: 10, padding: '10px 14px', animation: 'heed-fadeIn 0.3s ease' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.sage, marginBottom: 8 }}>✓ Lightened for this week</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Keeping</div>
              {routine.items.filter(i => !routine.lightenedItems.includes(i)).map(item => (
                <div key={item} style={{ fontSize: 12, color: C.ink, marginBottom: 2 }}>· {item}</div>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Optional this week</div>
              {routine.lightenedItems.map(item => (
                <div key={item} style={{ fontSize: 12, color: C.inkMute, textDecoration: 'line-through', marginBottom: 2 }}>· {item}</div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: isAttentionWorthy ? C.ochreSoft : C.sageSoft, border: `1px solid ${isAttentionWorthy ? C.ochre + '44' : C.sage + '44'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ marginTop: 1 }}><MayaOwl size={24} idle={false}/></div>
          <div style={{ flex: 1, fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{routine.insight}</div>
            {routine.suggestion && <div style={{ fontStyle: 'italic' }}>{routine.suggestion}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ContextBanner ──────────────────────────────────────────────
function ContextBanner({ upcomingContexts, onAskHeed }) {
  const [hover, setHover] = useState(false)
  const [planExpanded, setPlanExpanded] = useState(false)
  const [daysAway, setDaysAway] = useState(null)
  const ctx = upcomingContexts?.[0]
  useEffect(() => {
    if (ctx?._startDate) setDaysAway(Math.ceil((ctx._startDate - new Date()) / 86400000))
  }, [ctx?._startDate])
  if (!upcomingContexts || upcomingContexts.length === 0) return null
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: `linear-gradient(120deg, ${C.ochreSoft} 0%, ${C.bellySoft} 100%)`,
        border: `1px solid ${C.ochre}66`, borderRadius: 14, padding: '14px 18px', marginBottom: 22,
        boxShadow: hover ? C.shadowMed : C.shadowSoft, transition: 'all 0.2s ease',
        position: 'relative', overflow: 'hidden', animation: 'heed-fadeUp 0.5s ease both',
      }}
    >
      <div style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, opacity: 0.08, background: C.ochre, borderRadius: '50%' }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>🗺️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.warmDark, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 }}>
            Upcoming{daysAway != null ? ` · ${daysAway} days away` : ''}
          </div>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>
            <strong>{ctx.desc}</strong>{ctx.start && ctx.end ? ` ${ctx.start} – ${ctx.end}.` : ''}{' '}
            I've already noted this to plan around it.
          </div>
        </div>
        {ctx.plan && (
          <button
            onClick={() => setPlanExpanded(e => !e)}
            style={{ ...getBtnGhost(), fontSize: 12, whiteSpace: 'nowrap', color: planExpanded ? C.warmDark : C.inkSoft, borderColor: planExpanded ? `${C.ochre}44` : C.border }}
          >
            {planExpanded ? 'Hide plan ↑' : 'See plan →'}
          </button>
        )}
      </div>
      {planExpanded && ctx.plan && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, animation: 'heed-fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              {ctx.plan.before && ctx.plan.before.length > 0 && (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: C.ochre, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>Before you leave</div>
                  {ctx.plan.before.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: C.inkSoft, marginBottom: 4, lineHeight: 1.4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.ochre, flexShrink: 0, marginTop: 5 }}/>
                      {item}
                    </div>
                  ))}
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              {ctx.plan.during && ctx.plan.during.length > 0 && (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: C.sage, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>While away</div>
                  {ctx.plan.during.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: C.inkSoft, marginBottom: 4, lineHeight: 1.4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.sage, flexShrink: 0, marginTop: 5 }}/>
                      {item}
                    </div>
                  ))}
                </>
              )}
              {ctx.plan.after && ctx.plan.after.length > 0 && (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginTop: ctx.plan.during && ctx.plan.during.length > 0 ? 10 : 0 }}>When you're back</div>
                  {ctx.plan.after.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: C.inkSoft, marginBottom: 4, lineHeight: 1.4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.inkMute, flexShrink: 0, marginTop: 5 }}/>
                      {item}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          {ctx.askQuery && onAskHeed && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: C.inkMute }}>Want a more detailed plan?</span>
              <button
                onClick={() => onAskHeed(ctx.askQuery)}
                style={{ background: 'none', border: 'none', color: C.sage, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                Ask Heed →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TodayTab ───────────────────────────────────────────────────
function TodayTab({ tasks, routines, plans = [], upcomingContexts, skippedTasks = [], userName = '', efMode = false, onSetEfMode, onMarkDone, onSkip, onUnskip, onMarkRoutineDone, onSkipRoutineToday, onLightenRoutine, onEditRoutine, onAskHeed, onMoreOptions, onShareCard, onAddTask, onEditTask, onAddToRoutine, onBuildRoutine, onNavigateToPlans }) {
  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem('heed.swipe-hint-seen')
  })
  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false)
    try { localStorage.setItem('heed.swipe-hint-seen', '1') } catch (_) {}
  }, [])
  const [showAllTasks, setShowAllTasks] = useState(false)
  function scoreTask(task) {
    let score = 0
    if (task.overdue != null) score += task.overdue * 3
    if (task.dueIn !== undefined) score += Math.max(0, 14 - task.dueIn)
    if (upcomingContexts && upcomingContexts.length > 0) {
      const contextTypes = upcomingContexts.map(c => (c.type || '').toLowerCase())
      const cat = (task.category || '').toLowerCase()
      if (contextTypes.some(ct => cat.includes(ct) || ct.includes(cat))) score += 5
    }
    return score
  }
  const scoredTasks = tasks.map(t => ({ task: t, score: scoreTask(t) })).sort((a, b) => b.score - a.score)
  // Focus today = ONLY tasks for today: overdue (need handling now) or due today.
  // Future tasks (dueIn > 0) drop into "Also upcoming" under the See-all toggle.
  const isForToday = (t) => t.overdue != null || t.dueIn === 0
  const focusTasks = scoredTasks.filter(s => isForToday(s.task)).map(s => s.task)
  const remainingTasks = scoredTasks.filter(s => !isForToday(s.task)).map(s => s.task)
  const overdueRemaining = []
  const upcomingRemaining = remainingTasks.filter(t => t.dueIn !== undefined && t.dueIn > 0)
  // Empty-state momentum: best routine streak + next upcoming context.
  const bestStreak = (() => {
    let best = { name: '', count: 0 }
    for (const r of routines) {
      const c14 = r.completion14d || []
      let cur = 0
      for (let i = c14.length - 1; i >= 0; i--) {
        if (c14[i]) cur++
        else break
      }
      if (cur > best.count) best = { name: r.name, count: cur }
    }
    return best.count > 0 ? best : null
  })()
  const nextContext = upcomingContexts && upcomingContexts.length > 0 ? upcomingContexts[0] : null
  const nextContextDays = nextContext?._startDate
    ? Math.max(0, Math.ceil((nextContext._startDate - new Date()) / 86400000))
    : null
  // EF (executive-function) mode — render-time short-circuit. When on, Today
  // shows ONLY the single highest-priority task, no banner, no routines, no
  // coming-up. Designed for crash days when seeing a long list causes
  // shutdown. A small "show all" link drops back to the full view.
  if (efMode) {
    const oneTask = focusTasks[0]
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button onClick={() => onSetEfMode?.(false)}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.inkSoft, padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Show all
          </button>
        </div>
        {oneTask ? (
          <FocusTaskRow task={oneTask} delay={0} onMarkDone={onMarkDone}/>
        ) : (
          <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 18px', boxShadow: C.shadowSoft, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 500, color: C.warmDark, marginBottom: 6 }}>
              Nothing today.
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>
              Rest. Heed will surface things when they need you.
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <ContextBanner upcomingContexts={upcomingContexts} onAskHeed={onAskHeed}/>
      <SectionHeader motif="leaf" count={focusTasks.length}>Focus today</SectionHeader>
      {focusTasks.length > 0 ? (
        focusTasks.map((t, i) => (
          <FocusTaskRow key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone}/>
        ))
      ) : (
        <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: C.shadowSoft }}>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.5, marginBottom: 8 }}>
            Nothing critical right now. Nice.
          </div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>
            {bestStreak && <>You're on a <strong style={{ color: C.sage }}>{bestStreak.count}-day</strong> streak with <strong>{bestStreak.name}</strong>. </>}
            {nextContext && nextContextDays !== null && (
              <>Next up: <strong>{nextContext.desc || nextContext.type}</strong> in {nextContextDays} day{nextContextDays === 1 ? '' : 's'}.</>
            )}
            {!bestStreak && !nextContext && <>Use this calm to plan ahead — what would you regret forgetting?</>}
          </div>
          {nextContext?.askQuery && onAskHeed && (
            <button
              onClick={() => onAskHeed(nextContext.askQuery)}
              style={{ marginTop: 12, background: C.warmDark, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Plan around {nextContext.desc || nextContext.type} →
            </button>
          )}
        </div>
      )}
      <div style={{ marginTop: 28 }}>
        <SectionHeader motif="stem" count={routines.length}>Routines</SectionHeader>
        {routines.map((r, i) => <RoutineRow key={r.id} routine={r} delay={i * 80} onMarkDone={onMarkRoutineDone} onSkipToday={onSkipRoutineToday} onLighten={onLightenRoutine}/>)}
      </div>
      {(() => {
        // Show plans that are still in progress: projects with undone tasks,
        // numeric goals not yet hit, milestone goals not yet achieved, and
        // any future event. Cap at 3 so Today stays glanceable.
        const inProgress = plans.filter(p => {
          if (p.type === 'project') return Array.isArray(p.tasks) && p.tasks.some(t => !t.done)
          if (p.type === 'goal') return p.goalKind === 'milestone' ? !p.achieved : (p.current ?? 0) < (p.target ?? 0)
          if (p.type === 'event') {
            if (!p.eventDate) return true
            const d = new Date(p.eventDate)
            return !isNaN(d) && d >= new Date(new Date().toDateString())
          }
          return true
        }).slice(0, 3)
        if (inProgress.length === 0) return null
        return (
          <div style={{ marginTop: 28 }}>
            <SectionHeader motif="branch" count={inProgress.length}>Plans</SectionHeader>
            {inProgress.map((p, i) => (
              <TodayPlanCard key={p.id} plan={p} delay={i * 50} onSelect={onNavigateToPlans ? () => onNavigateToPlans() : undefined}/>
            ))}
          </div>
        )
      })()}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: C.inkMute, textAlign: 'center', marginBottom: 10, fontFamily: 'inherit' }}>Anything else?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {remainingTasks.length > 0 && (
            <button onClick={() => setShowAllTasks(t => !t)} type="button"
              style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '7px 15px', fontSize: 12.5, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
              📋 {showAllTasks ? 'Hide tasks' : 'See all tasks'}
            </button>
          )}
          {onAddTask && (
            <button onClick={onAddTask} type="button"
              style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '7px 15px', fontSize: 12.5, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add a task
            </button>
          )}
          <button onClick={() => onAskHeed && onAskHeed('')} type="button"
            style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '7px 15px', fontSize: 12.5, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✨ Ask Heed
          </button>
        </div>
      </div>
      {showAllTasks && (
        <div style={{ marginTop: 16 }}>
          {overdueRemaining.length > 0 && (
            <CollapsibleTodaySection motif="thorn" label="Also overdue" count={overdueRemaining.length} defaultOpen={overdueRemaining.length <= 4}>
              {overdueRemaining.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onEdit={onEditTask} onAddToRoutine={onAddToRoutine} onBuildRoutine={onBuildRoutine} showHint={false} onHintDismiss={dismissSwipeHint}/>)}
            </CollapsibleTodaySection>
          )}
          {upcomingRemaining.length > 0 && (
            <CollapsibleTodaySection motif="berry" label="Coming up" count={upcomingRemaining.length} defaultOpen={upcomingRemaining.length <= 6}>
              {upcomingRemaining.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onEdit={onEditTask} onAddToRoutine={onAddToRoutine} onBuildRoutine={onBuildRoutine} showHint={false} onHintDismiss={dismissSwipeHint}/>)}
            </CollapsibleTodaySection>
          )}
        </div>
      )}
      {skippedTasks.length > 0 && onUnskip && (
        <div style={{ marginTop: 28, padding: '10px 14px', background: C.bellySoft, border: `1px solid ${C.border}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Skipped today · {skippedTasks.length}
          </span>
          {skippedTasks.map(s => (
            <button key={s.id} onClick={() => onUnskip(s.id)}
              style={{ background: 'transparent', border: `1px dashed ${C.border}`, color: C.inkSoft, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              ↻ {s.name}
            </button>
          ))}
          <span style={{ fontSize: 11, color: C.inkMute, fontStyle: 'italic', marginLeft: 'auto' }}>tap to bring back</span>
        </div>
      )}
    </div>
  )
}

// Collapsible section header for Today. Header is a button; tap toggles open.
function CollapsibleTodaySection({ motif, label, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginTop: 28 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
        aria-expanded={open}>
        <SectionHeader motif={motif} count={count}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {label}
            <span style={{ fontSize: 11, color: C.inkMute, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
          </span>
        </SectionHeader>
      </button>
      {open && children}
    </div>
  )
}

// ── AskTab ─────────────────────────────────────────────────────
function SuggestionChip({ suggestion, onClick, disabled, delay = 0 }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? C.bellySoft : C.paper, border: `1.5px solid ${hover ? C.warmDark + '66' : C.border}`,
        color: C.warmDark, padding: '10px 16px', borderRadius: 999,
        fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.2s ease',
        transform: hover ? 'translateY(-2px)' : 'none', boxShadow: hover ? C.shadowMed : 'none',
        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
        animation: 'heed-fadeUp 0.4s ease both', animationDelay: `${delay}ms`,
      }}
    >
      <span style={{ fontSize: 14 }}>{suggestion.emoji}</span>{suggestion.text}
    </button>
  )
}

function ThinkingBubble({ steps }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12, animation: 'heed-fadeUp 0.25s ease' }}>
      <div style={{
        background: C.paper,
        border: `1px solid ${C.border}`,
        borderRadius: '14px 14px 14px 3px',
        padding: '12px 16px',
        boxShadow: C.shadowSoft,
      }}>
        {/* Bouncing dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                background: C.warmDark,
                animation: 'heed-dot-bounce 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.18}s`,
              }}/>
            ))}
          </div>
          {steps.length === 0 && (
            <span style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic' }}>thinking…</span>
          )}
        </div>

        {/* Steps revealed one by one */}
        {steps.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {steps.map((step, i) => {
              const isLatest = i === steps.length - 1
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  opacity: isLatest ? 1 : 0.5,
                  animation: 'heed-fadeUp 0.3s ease both',
                }}>
                  <span style={{
                    fontSize: 8, color: isLatest ? C.sage : C.inkMute,
                    marginTop: 5, flexShrink: 0,
                  }}>●</span>
                  <span style={{
                    fontSize: 12.5, color: isLatest ? C.inkSoft : C.inkMute,
                    fontStyle: 'italic', lineHeight: 1.5,
                  }}>{step}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MicButton({ listening, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label={listening ? 'Stop recording' : 'Speak your question'}
      style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: listening ? '#e53e3e' : C.paper,
        border: `1.5px solid ${listening ? '#e53e3e' : C.border}`,
        color: listening ? '#fff' : C.inkMute,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, transition: 'all 0.2s ease',
        boxShadow: listening ? '0 0 0 4px rgba(229,62,62,0.25)' : 'none',
        animation: listening ? 'heed-mic-pulse 1.2s ease-in-out infinite' : 'none',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.9"/>
        <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
        <line x1="12" y1="20" x2="12" y2="23" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
        <line x1="9" y1="23" x2="15" y2="23" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

function AskTab({ prefill = '', autoSend = false, onAutoSendDone, onLightenRoutine, onTaskAdded }) {
  const { messages, input, setInput, thinking, streaming, busy, send, executeAction } = useChat({ onLightenRoutine, onTaskAdded })
  const scrollRef = useRef(null)
  const { listening, toggle: toggleMic, supported: micSupported } = useMic(useCallback((text, isFinal) => { if (isFinal) send(text) }, [send]))
  useEffect(() => {
    if (!prefill) return
    if (autoSend) {
      send(prefill)
      onAutoSendDone?.()
    } else {
      setInput(prefill)
    }
  }, [prefill, autoSend]) // eslint-disable-line react-hooks/exhaustive-deps
  const owlMood = busy ? 'thinking' : 'calm'
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, thinking, streaming])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600 }}>
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0 32px 0', animation: 'heed-fadeUp 0.5s ease' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 18 }}>
            <div style={{ position: 'absolute', inset: -28, borderRadius: '50%', background: `radial-gradient(circle, ${C.ochreSoft} 0%, transparent 65%)`, animation: 'heed-breathe 4s ease-in-out infinite' }}/>
            <div style={{ position: 'relative' }}><MayaOwl size={150} mood={owlMood} speaking={busy}/></div>
          </div>
          <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 26, color: C.warmDark, marginBottom: 6, letterSpacing: -0.5, fontWeight: 600 }}>
            Hi. What can I help you remember?
          </div>
          <div style={{ fontSize: 13.5, color: C.inkMute, marginBottom: 24, fontStyle: 'italic' }}>
            Ask me anything about your tasks, routines, or schedule.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 640, margin: '0 auto' }}>
            {SUGGESTIONS.map((s, i) => <SuggestionChip key={s.text} suggestion={s} onClick={() => send(s.text)} disabled={busy} delay={i * 80}/>)}
          </div>
        </div>
      )}
      {messages.length > 0 && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 4px', marginBottom: 12 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}><MayaOwl size={72} mood={owlMood} speaking={busy}/></div>
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content}
              actions={m.actions} chips={m.chips}
              onConfirm={(actionIndex) => executeAction(i, actionIndex)}
              onChipClick={(text) => send(text)}
            />
          ))}
          {thinking !== null && <ThinkingBubble steps={thinking}/>}
          {streaming && <Bubble role="assistant" content={streaming} streaming/>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: '14px 4px', borderTop: messages.length > 0 ? `1px solid ${C.hairline}` : 'none', alignItems: 'center' }}>
        {micSupported && <MicButton listening={listening} onToggle={toggleMic} disabled={busy}/>}
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder={listening ? 'Listening…' : 'Ask Heed anything…'} disabled={busy}
          style={{ flex: 1, background: C.paper, border: `1.5px solid ${listening ? '#e53e3e' : C.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
          onFocus={e => { e.target.style.borderColor = C.warmDark }}
          onBlur={e => { if (!listening) e.target.style.borderColor = C.border }}
        />
        <button onClick={() => send(input)} disabled={busy || !input.trim()} style={{ ...getBtnPrimary(), padding: '12px 22px', fontSize: 13, opacity: (busy || !input.trim()) ? 0.5 : 1 }}>Send</button>
      </div>
    </div>
  )
}

// ── TracksTab ──────────────────────────────────────────────────
function SegmentButton({ active, onClick, label, count, accent }) {
  return (
    <button onClick={onClick} style={{ flex: 1, background: active ? accent : 'transparent', color: active ? C.cream : C.inkSoft, border: 'none', padding: '8px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <span>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, background: active ? 'rgba(253,248,238,0.25)' : C.belly, color: active ? C.cream : C.inkMute, padding: '1px 7px', borderRadius: 999, transition: 'all 0.18s' }}>{count}</span>
    </button>
  )
}

function TracksTab({ tasks, routines, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine, onAddTask, onAddRoutine, onMoreOptions, onShareCard, onMarkRoutineDay, onEditTask, onAddToRoutine, onBuildRoutine }) {
  const [subtab, setSubtab] = useState('routines')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('due')
  const filteredTasks = useMemo(() => {
    const base = filter === 'all' ? tasks : tasks.filter(t => t.category === filter)
    if (sortBy === 'alpha') return [...base].sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'severity') return [...base].sort((a, b) => {
      const score = t => (t.overdue || 0) * 3 + Math.max(0, 14 - (t.dueIn ?? 14))
      return score(b) - score(a)
    })
    // due: overdue first (dueIn < 0, most overdue first), then upcoming by dueIn asc, then no-date last
    return [...base].sort((a, b) => {
      const aD = a.dueIn ?? Infinity
      const bD = b.dueIn ?? Infinity
      return aD - bD
    })
  }, [tasks, filter, sortBy])
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <SectionHeader>Tracks</SectionHeader>
        <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', marginTop: -8 }}>Everything Heed is following for you.</div>
      </div>
      <div style={{ display: 'flex', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, marginBottom: 18, gap: 4 }}>
        <SegmentButton active={subtab === 'routines'} onClick={() => setSubtab('routines')} label="Routines" count={routines.length} accent={C.sage}/>
        <SegmentButton active={subtab === 'tasks'} onClick={() => setSubtab('tasks')} label="Tasks" count={tasks.length} accent={C.warmDark}/>
      </div>
      {subtab === 'routines' && (
        <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={onAddRoutine} style={getBtnPrimary()}>+ Build routine</button>
          </div>
          {routines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 50} onMarkDone={onMarkRoutineDone} onLighten={onLightenRoutine} onEdit={onEditRoutine} onShare={onShareCard} onMarkDay={onMarkRoutineDay}/>)}
        </div>
      )}
      {subtab === 'tasks' && (
        <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all','home','finance','relationships','health','admin','work'].map(cat => (
                <button key={cat} onClick={() => setFilter(cat)} style={{ background: filter === cat ? C.warmDark : C.paper, color: filter === cat ? C.cream : C.warmDark, border: `1px solid ${filter === cat ? C.warmDark : C.border}`, padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit', transition: 'all 0.15s' }}>{cat}</button>
              ))}
            </div>
            <button onClick={onAddTask} style={getBtnPrimary()}>+ Add task</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: C.inkMute, marginRight: 2 }}>Sort:</span>
            {[{ key: 'due', label: 'Due date' }, { key: 'alpha', label: 'A–Z' }, { key: 'severity', label: 'Severity' }].map(({ key, label }) => (
              <button key={key} onClick={() => setSortBy(key)} style={{ background: sortBy === key ? C.warmDark : C.paper, color: sortBy === key ? C.cream : C.inkSoft, border: `1px solid ${sortBy === key ? C.warmDark : C.border}`, padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: sortBy === key ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', minHeight: 28 }}>{label}</button>
            ))}
          </div>
          <div>
            {filteredTasks.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 30} onMarkDone={onMarkDone} onSkip={onSkip} onEdit={onEditTask} onAddToRoutine={onAddToRoutine} onBuildRoutine={onBuildRoutine}/>)}
          </div>
          <div style={{ marginTop: 18, fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', textAlign: 'center' }}>✨ = cadence learned by the agent from your behavior</div>
        </div>
      )}
    </div>
  )
}

// ── Life Events helpers ─────────────────────────────────────────
function ContextRow({ ctx, highlight, onDetailOpen }) {
  const icons = { travel: '🗺️', illness: '🌿', busy: '🌾', celebration: '🌸' }
  const tasksBeforeCount = ctx.plan?.before?.length || 0
  const routinesPaused = ctx.routinesPaused || 0
  return (
    <div
      onClick={() => onDetailOpen?.(ctx)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0', borderTop: `1px solid ${C.hairline}`, cursor: onDetailOpen ? 'pointer' : 'default' }}
    >
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: highlight ? C.ochreSoft : C.bellySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, marginTop: 2 }}>
        {icons[ctx.type] || '📌'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, marginBottom: 2 }}>{ctx.desc}</div>
        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: highlight && (tasksBeforeCount > 0 || routinesPaused > 0) ? 8 : 0 }}>
          {ctx.start} → {ctx.end}
        </div>
        {highlight && (tasksBeforeCount > 0 || routinesPaused > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tasksBeforeCount > 0 && (
              <span style={{ background: C.bellySoft, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 10.5, color: C.inkSoft }}>
                📋 {tasksBeforeCount} task{tasksBeforeCount !== 1 ? 's' : ''} before you go
              </span>
            )}
            {routinesPaused > 0 && (
              <span style={{ background: C.bellySoft, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 10.5, color: C.inkSoft }}>
                ⏸ {routinesPaused} routine{routinesPaused !== 1 ? 's' : ''} paused
              </span>
            )}
          </div>
        )}
      </div>
      {highlight && <Pill tone="warn" glow>soon</Pill>}
      {!highlight && ctx.skipped != null && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.rust }}>{ctx.skipped} skipped</div>
          <div style={{ fontSize: 10, color: C.inkMute }}>tasks</div>
        </div>
      )}
    </div>
  )
}

const CONTEXT_CHIPS = [
  { type: 'sick',        label: '🌿 Sick' },
  { type: 'busy',        label: '🌾 Busy week' },
  { type: 'travel',      label: '✈️ Traveling' },
  { type: 'celebration', label: '🌸 Celebration' },
]

// ── usePlans — localStorage-backed plan state with backend write-through ──
function normalizePlan(p) {
  if (p.type === 'goal' && !p.goalKind) return { ...p, goalKind: 'numeric' }
  return p
}

function usePlans(initialPlans) {
  const [plans, setPlans] = useState(() => {
    try {
      const saved = localStorage.getItem('heed_plans')
      return saved ? JSON.parse(saved).map(normalizePlan) : initialPlans
    } catch {
      return initialPlans
    }
  })

  const _hydrated = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || _hydrated.current) return
    _hydrated.current = true
    if (isDemoMode()) return  // demo mode — keep DEMO_PLANS default, skip API
    fetch(`${FUNCTIONS_URL}/api/user_state/plans`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items = data && Array.isArray(data.items) ? data.items : null
        if (items && items.length > 0) setPlans(items.map(normalizePlan))
        else {
          // Backend empty — push current local copy up so a future device finds it.
          let cur
          try { cur = JSON.parse(localStorage.getItem('heed_plans') || '[]') } catch { cur = [] }
          if (Array.isArray(cur) && cur.length > 0) {
            fetch(`${FUNCTIONS_URL}/api/user_state/plans`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: cur }),
            }).catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    localStorage.setItem('heed_plans', JSON.stringify(plans))
    if (!_hydrated.current) return
    if (isDemoMode()) return  // demo mode — local-only, don't write to API
    fetch(`${FUNCTIONS_URL}/api/user_state/plans`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: plans }),
    }).catch(() => {})
  }, [plans])

  const checkTask = useCallback((planId, taskIndex) => {
    setPlans(prev => prev.map(p => p.id !== planId || !p.tasks ? p : {
      ...p, tasks: p.tasks.map((t, i) => i === taskIndex ? { ...t, done: !t.done } : t),
    }))
  }, [])

  const renameTask = useCallback((planId, taskIndex, newLabel) => {
    setPlans(prev => prev.map(p => p.id !== planId || !p.tasks ? p : {
      ...p, tasks: p.tasks.map((t, i) => i === taskIndex ? { ...t, label: newLabel } : t),
    }))
  }, [])

  const addTask = useCallback((planId, label) => {
    setPlans(prev => prev.map(p => p.id !== planId || !p.tasks ? p : {
      ...p, tasks: [...p.tasks, { label, done: false }],
    }))
  }, [])

  const deleteTask = useCallback((planId, taskIndex) => {
    setPlans(prev => prev.map(p => p.id !== planId || !p.tasks ? p : {
      ...p, tasks: p.tasks.filter((_, i) => i !== taskIndex),
    }))
  }, [])

  const reorderTasks = useCallback((planId, fromIndex, toIndex) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId || !p.tasks) return p
      const t = [...p.tasks]
      const [moved] = t.splice(fromIndex, 1)
      t.splice(toIndex, 0, moved)
      return { ...p, tasks: t }
    }))
  }, [])

  const addPlan = useCallback((plan) => {
    setPlans(prev => [plan, ...prev])
  }, [])

  const updatePlan = useCallback((planId, updates) => {
    const { tasks: _t, ...safeUpdates } = updates
    setPlans(prev => prev.map(p => p.id !== planId ? p : { ...p, ...safeUpdates }))
  }, [])

  return { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan, updatePlan }
}

// ── PlanCard ────────────────────────────────────────────────────
const PLAN_ICON_BG = { project: '#f0e8d8', goal: '#f5f0d8', event: '#e8f0e8' }

function PlanCard({ plan, delay = 0, onSelectPlan }) {
  const doneCount = plan.tasks ? plan.tasks.filter(t => t.done).length : 0
  const totalCount = plan.tasks ? plan.tasks.length : 0
  const pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0
  const goalPct = plan.type === 'goal'
    ? (plan.goalKind === 'milestone'
        ? (plan.achieved ? 100 : 0)
        : plan.target > 0 ? Math.round(plan.current / plan.target * 100) : 0)
    : 0
  const parsedEventDate = plan.eventDate ? new Date(plan.eventDate) : null
  const daysUntil = parsedEventDate && !isNaN(parsedEventDate)
    ? Math.round((parsedEventDate - new Date()) / 86400000)
    : null
  const undone = plan.tasks ? plan.tasks.filter(t => !t.done) : []

  const subtitle = plan.type === 'project'
    ? `${doneCount} of ${totalCount} tasks · Due ${plan.dueDate}`
    : plan.type === 'goal'
    ? (plan.goalKind === 'milestone'
        ? (plan.targetDate && plan.targetDate !== 'No date set' ? `Target: ${plan.targetDate}` : 'No date set')
        : `${plan.unit}${(plan.current ?? 0).toLocaleString()} saved · Target ${plan.targetDate}`)
    : daysUntil === null ? 'No date set'
    : daysUntil <= 0    ? 'Today!'
    : daysUntil === 1   ? 'Tomorrow'
    : `in ${daysUntil} days`

  const badge = {
    project: <div style={{ fontSize: 13, fontWeight: 700, color: C.rust, flexShrink: 0 }}>{pct}%</div>,
    goal:    plan.goalKind === 'milestone'
               ? (plan.achieved ? <div style={{ background: '#d4edda', color: '#2d6a4f', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>Done ✓</div> : null)
               : <div style={{ fontSize: 13, fontWeight: 700, color: C.ochre, flexShrink: 0 }}>{goalPct}%</div>,
    event:   undone.length > 0
               ? <div style={{ background: '#e8f0e8', color: '#3a6840', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{undone.length} left</div>
               : null,
  }[plan.type]

  return (
    <div onClick={onSelectPlan ? () => onSelectPlan(plan.id) : undefined} style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10, animation: `heed-fadeIn 0.2s ease ${delay}ms both`, cursor: onSelectPlan ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: PLAN_ICON_BG[plan.type] || C.bellySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {plan.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.title}</div>
          {plan.description ? (
            <div style={{ fontSize: 11.5, color: C.inkSoft, fontStyle: 'italic', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{plan.description}</div>
          ) : null}
          <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>{subtitle}</div>
        </div>
        {badge}
      </div>

      {(plan.type === 'project' || plan.type === 'goal') && (
        <div style={{ height: 4, background: C.bellySoft, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, background: plan.type === 'project' ? C.rust : C.ochre, width: `${plan.type === 'project' ? pct : goalPct}%`, transition: 'width 0.4s ease' }}/>
        </div>
      )}

      {plan.type === 'goal' && plan.goalKind !== 'milestone' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ background: '#f5f0d8', color: '#7a6a20', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
            {plan.unit}{((plan.target ?? 0) - (plan.current ?? 0)).toLocaleString()} to go
          </span>
        </div>
      )}

    </div>
  )
}

// ── TodayPlanCard ──────────────────────────────────────────────
// Compact, glanceable plan card for the Today tab. Distinct from the full
// PlanCard used on Life: smaller footprint, accent-colored type stripe on
// the left, and a circular progress ring on the right (instead of a linear
// bar) so the eye lands on completion immediately. Tap → Life tab via the
// onSelect callback.
function TodayPlanCard({ plan, delay = 0, onSelect }) {
  const accent = plan.type === 'project' ? C.rust
                : plan.type === 'goal'    ? C.ochre
                :                            C.sage
  // Type-specific computed fields.
  const data = (() => {
    if (plan.type === 'project') {
      const tasks = plan.tasks || []
      const done = tasks.filter(t => t.done).length
      const total = tasks.length
      const pct = total > 0 ? Math.round(done / total * 100) : 0
      const nextTask = tasks.find(t => !t.done)
      return {
        pct,
        showRing: true,
        line2: nextTask ? `Next — ${nextTask.label}` : 'All tasks done',
      }
    }
    if (plan.type === 'goal') {
      if (plan.goalKind === 'milestone') {
        return {
          pct: plan.achieved ? 100 : 0,
          showRing: false,
          line2: plan.achieved ? '✓ Achieved' : (plan.targetDate && plan.targetDate !== 'No date set' ? `Target ${plan.targetDate}` : 'In progress'),
          milestone: true,
        }
      }
      const cur = plan.current ?? 0
      const tgt = plan.target ?? 0
      const pct = tgt > 0 ? Math.round(cur / tgt * 100) : 0
      const remaining = Math.max(0, tgt - cur)
      return {
        pct,
        showRing: true,
        line2: `${plan.unit || ''}${remaining.toLocaleString()} to go`,
      }
    }
    // event
    const date = plan.eventDate ? new Date(plan.eventDate) : null
    const days = date && !isNaN(date) ? Math.round((date - new Date()) / 86400000) : null
    const undone = (plan.tasks || []).filter(t => !t.done).length
    let line2
    if (days === null) line2 = 'No date set'
    else if (days <= 0) line2 = 'Today!'
    else if (days === 1) line2 = 'Tomorrow'
    else line2 = `in ${days} days`
    return {
      pct: 0,
      showRing: false,
      line2,
      eventBadge: undone > 0 ? `${undone} to do` : '✓ Ready',
      days,
    }
  })()

  return (
    <div
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }) : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px 12px 16px',
        background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        marginBottom: 10,
        cursor: onSelect ? 'pointer' : 'default',
        animation: 'heed-fadeUp 0.5s ease both',
        animationDelay: `${delay}ms`,
        boxShadow: C.shadowSoft,
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${accent}1f`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{plan.icon || '📌'}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Lora, serif',
          fontSize: 14.5, fontWeight: 600,
          color: C.ink,
          letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{plan.title}</div>
        <div style={{
          fontSize: 11.5, color: C.inkMute, marginTop: 2, fontStyle: 'italic',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{data.line2}</div>
      </div>

      {data.showRing ? (
        <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }} aria-label={`${data.pct} percent complete`}>
          <svg width="38" height="38" viewBox="0 0 38 38">
            <circle cx="19" cy="19" r="15.5" fill="none" stroke={C.border} strokeWidth="2.5"/>
            <circle
              cx="19" cy="19" r="15.5" fill="none"
              stroke={accent} strokeWidth="2.5"
              strokeDasharray={`${(data.pct / 100) * 97.39} 97.39`}
              strokeLinecap="round"
              transform="rotate(-90 19 19)"
              style={{ transition: 'stroke-dasharray 0.45s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, fontWeight: 700, color: accent,
            letterSpacing: -0.3,
          }}>{data.pct}%</div>
        </div>
      ) : data.milestone ? (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: data.pct === 100 ? C.sage : C.ochre,
          background: data.pct === 100 ? C.sageSoft : C.ochreSoft,
          border: `1px solid ${(data.pct === 100 ? C.sage : C.ochre)}40`,
          borderRadius: 999,
          padding: '4px 10px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>{data.pct === 100 ? 'Done' : 'In progress'}</span>
      ) : (
        // event — show pill with days or "to do" count
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {data.days !== null && data.days >= 0 && data.days <= 7 && (
            <span style={{
              fontFamily: 'Lora, serif',
              fontSize: 18, fontWeight: 600, color: accent, lineHeight: 1, letterSpacing: -0.4,
            }}>{data.days === 0 ? '!' : `${data.days}d`}</span>
          )}
          <span style={{
            fontSize: 10.5, fontWeight: 600,
            color: accent,
            background: `${accent}1a`,
            border: `1px solid ${accent}40`,
            borderRadius: 999,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
          }}>{data.eventBadge}</span>
        </div>
      )}
    </div>
  )
}

// ── PlanDetailScreen ───────────────────────────────────────────
function PlanDetailScreen({ plan, onBack, onCheck, onRename, onAddTask, onDeleteTask, onReorder, onUpdatePlan }) {
  const [editingIndex, setEditingIndex] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [swipedIndex, setSwipedIndex] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [editDraft, setEditDraft] = useState({ icon: '', title: '', date: '', description: '' })
  // Edit-all mode: holds working copies of each task label so Save can persist
  // them in one batch instead of inline-renaming per row.
  const [taskDrafts, setTaskDrafts] = useState([])
  const rowRefs = useRef([])
  // Separate ref array for the edit-panel rows — they're a different DOM
  // structure (inputs, not the live list) so we can't share rowRefs.
  const editRowRefs = useRef([])
  const swipeStart = useRef({ x: null, index: null })
  const dragRef = useRef({ dragIndex: null, dropIndex: null })
  const editDragRef = useRef({ dragIndex: null, dropIndex: null })
  const [editDragIndex, setEditDragIndex] = useState(null)
  const [editDropIndex, setEditDropIndex] = useState(null)
  const [completingIdx, setCompletingIdx] = useState(null)

  const doneCount = plan.tasks.filter(t => t.done).length
  const totalCount = plan.tasks.length
  const pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0

  useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, plan.tasks.length)
  }, [plan.tasks.length])

  function startEdit(i, label) {
    setSwipedIndex(null)
    setEditingIndex(i)
    setEditValue(label)
  }
  function commitEdit() {
    if (editingIndex !== null && editValue.trim()) onRename(plan.id, editingIndex, editValue.trim())
    setEditingIndex(null)
    setEditValue('')
  }
  function cancelEdit() { setEditingIndex(null); setEditValue('') }

  function handleAddTask() {
    if (!newTaskLabel.trim()) return
    onAddTask(plan.id, newTaskLabel.trim())
    setNewTaskLabel('')
  }

  function handleDragPointerDown(e, i) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { dragIndex: i, dropIndex: i }
    setDragIndex(i)
    setDropIndex(i)
  }
  function handleDragPointerMove(e) {
    if (dragRef.current.dragIndex === null) return
    let nearest = dragRef.current.dragIndex
    let minDist = Infinity
    rowRefs.current.forEach((el, idx) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(e.clientY - mid)
      if (dist < minDist) { minDist = dist; nearest = idx }
    })
    dragRef.current.dropIndex = nearest
    setDropIndex(nearest)
  }
  function handleDragPointerUp() {
    const { dragIndex: di, dropIndex: dpi } = dragRef.current
    if (di !== null && dpi !== null && di !== dpi) onReorder(plan.id, di, dpi)
    dragRef.current = { dragIndex: null, dropIndex: null }
    setDragIndex(null)
    setDropIndex(null)
    setEditingIndex(null)
    setEditValue('')
  }

  // Edit-panel drag handlers — same pattern, but reorder taskDrafts (local
  // working copy) AND call onReorder so plan.tasks stays in sync. Keeping them
  // synced means the rename batch on Save can use straight indices.
  function handleEditDragPointerDown(e, i) {
    e.currentTarget.setPointerCapture(e.pointerId)
    editDragRef.current = { dragIndex: i, dropIndex: i }
    setEditDragIndex(i)
    setEditDropIndex(i)
  }
  function handleEditDragPointerMove(e) {
    if (editDragRef.current.dragIndex === null) return
    let nearest = editDragRef.current.dragIndex
    let minDist = Infinity
    editRowRefs.current.forEach((el, idx) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(e.clientY - mid)
      if (dist < minDist) { minDist = dist; nearest = idx }
    })
    editDragRef.current.dropIndex = nearest
    setEditDropIndex(nearest)
  }
  function handleEditDragPointerUp() {
    const { dragIndex: di, dropIndex: dpi } = editDragRef.current
    if (di !== null && dpi !== null && di !== dpi) {
      // Move within taskDrafts.
      setTaskDrafts(arr => {
        const next = [...arr]
        const [moved] = next.splice(di, 1)
        next.splice(dpi, 0, moved)
        return next
      })
      // Mirror into the underlying plan so subsequent renames + checkboxes
      // line up by index. Persists immediately even if the user later cancels
      // — but cancel preserving order is acceptable, matching the existing
      // eager-reorder behavior in non-edit mode.
      onReorder(plan.id, di, dpi)
    }
    editDragRef.current = { dragIndex: null, dropIndex: null }
    setEditDragIndex(null)
    setEditDropIndex(null)
  }

  function formatEventDate(val) {
    if (!val) return ''
    if (val instanceof Date) return val.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return String(val)
  }

  function openEditPlan() {
    setEditDraft({
      icon: plan.icon,
      title: plan.title,
      date: plan.type === 'project' ? (plan.dueDate ?? '') : formatEventDate(plan.eventDate),
      description: plan.description ?? '',
    })
    setTaskDrafts(plan.tasks.map(t => t.label))
    setEditingPlan(true)
    setSwipedIndex(null)
  }
  function cancelEditPlan() { setEditingPlan(false); setTaskDrafts([]) }
  function saveEditPlan() {
    const updates = {
      icon: editDraft.icon.trim() || plan.icon,
      title: editDraft.title.trim() || plan.title,
      description: editDraft.description.trim(),
    }
    if (plan.type === 'project') updates.dueDate = editDraft.date.trim()
    if (plan.type === 'event')   updates.eventDate = editDraft.date.trim()
    onUpdatePlan?.(plan.id, updates)
    // Persist any renamed tasks in one pass.
    taskDrafts.forEach((label, i) => {
      const next = label.trim()
      if (next && plan.tasks[i] && next !== plan.tasks[i].label) {
        onRename(plan.id, i, next)
      }
    })
    setEditingPlan(false)
    setTaskDrafts([])
  }

  return (
    <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
      {/* top bar — back link on its own line, plan title below */}
      <div style={{ marginBottom: 6 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.ochre, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>‹ Plans</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: plan.description && !editingPlan ? 6 : 14 }}>
        <span style={{ fontSize: 20 }}>{plan.icon}</span>
        <span style={{ flex: 1, fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, color: C.warmDark, letterSpacing: -0.2 }}>{plan.title}</span>
        <button
          onClick={editingPlan ? cancelEditPlan : openEditPlan}
          aria-label={editingPlan ? 'Cancel edit' : 'Edit plan'}
          style={{ background: 'none', border: `1px solid ${C.border}`, color: C.warmDark, fontSize: 18, fontWeight: 400, cursor: 'pointer', padding: '2px 10px', fontFamily: 'inherit', lineHeight: 1, borderRadius: 999 }}>
          {editingPlan ? '✕' : '⋯'}
        </button>
      </div>
      {plan.description && !editingPlan && (
        <div style={{ fontSize: 13, color: C.inkSoft, fontStyle: 'italic', marginBottom: 14, lineHeight: 1.5, paddingLeft: 2 }}>
          {plan.description}
        </div>
      )}

      {/* due date / event date — shown in normal view */}
      {!editingPlan && (plan.dueDate || plan.eventDate) && (
        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 10, paddingLeft: 2 }}>
          {plan.type === 'project' && plan.dueDate && `Due: ${plan.dueDate}`}
          {plan.type === 'event' && plan.eventDate && `Date: ${formatEventDate(plan.eventDate)}`}
        </div>
      )}

      {/* edit panel */}
      {editingPlan && (
        <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <input
              value={editDraft.icon}
              onChange={e => setEditDraft(d => ({ ...d, icon: e.target.value }))}
              style={{ width: 36, height: 36, textAlign: 'center', fontSize: 22, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', flexShrink: 0 }}
            />
            <input
              value={editDraft.title}
              onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
              style={{ flex: 1, fontSize: 14, fontWeight: 600, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', color: C.ink }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.inkMute, flexShrink: 0 }}>{plan.type === 'project' ? 'Due' : 'Date'}</span>
            <input
              value={editDraft.date}
              onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))}
              placeholder={plan.type === 'project' ? 'e.g. Jun 15' : 'e.g. May 8'}
              style={{ flex: 1, fontSize: 13, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', color: C.ink }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.inkMute }}>Description <span style={{ fontWeight: 400 }}>(optional)</span></span>
            <textarea
              value={editDraft.description}
              onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="What's this plan for?"
              rows={2}
              style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 13, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', background: 'transparent', fontFamily: 'inherit', color: C.ink, resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {/* Tasks editor — single edit-all flow */}
          {plan.tasks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Tasks <span style={{ fontWeight: 400, color: C.inkMute, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>· drag ≡ to reorder</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {taskDrafts.map((label, i) => {
                  const isDragging = editDragIndex === i
                  const isDropAbove = editDropIndex === i && editDragIndex !== null && editDragIndex !== i && i <= editDragIndex
                  const isDropBelow = editDropIndex === i && editDragIndex !== null && editDragIndex !== i && i > editDragIndex
                  return (
                    <div key={i} ref={el => { editRowRefs.current[i] = el }}>
                      {isDropAbove && <div style={{ height: 2, background: C.ochre, marginBottom: 4 }}/>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: isDragging ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                        <span
                          onPointerDown={e => handleEditDragPointerDown(e, i)}
                          onPointerMove={handleEditDragPointerMove}
                          onPointerUp={handleEditDragPointerUp}
                          style={{ fontSize: 16, color: C.border, cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0, touchAction: 'none', padding: '0 4px', lineHeight: 1, userSelect: 'none' }}
                          aria-label="Drag to reorder"
                        >≡</span>
                        <input
                          value={label}
                          onChange={e => setTaskDrafts(arr => arr.map((v, j) => j === i ? e.target.value : v))}
                          style={{ flex: 1, boxSizing: 'border-box', fontSize: 13, color: C.ink, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', outline: 'none', fontFamily: 'inherit' }}
                        />
                      </div>
                      {isDropBelow && <div style={{ height: 2, background: C.ochre, marginTop: 4 }}/>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* add task inside edit mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingTop: 4, borderTop: `1px solid ${C.hairline}` }}>
            <span style={{ fontSize: 17, color: C.ochre, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>+</span>
            <input
              placeholder="Add a task…"
              value={newTaskLabel}
              onChange={e => setNewTaskLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              onBlur={handleAddTask}
              style={{ flex: 1, border: 'none', borderBottom: `1px solid ${C.hairline}`, outline: 'none', fontSize: 13, color: C.ink, background: 'transparent', padding: '2px 0', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={cancelEditPlan} style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>Cancel</button>
            <button onClick={saveEditPlan} style={{ background: 'none', border: 'none', color: C.ochre, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>Save →</button>
          </div>
        </div>
      )}

      {/* progress bar + task list — hidden while editing to avoid showing the
          same tasks twice (the edit panel above already lists them as inputs) */}
      {!editingPlan && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 5, background: C.bellySoft, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: C.rust, width: `${pct}%`, transition: 'width 0.3s ease' }}/>
        </div>
        <div style={{ fontSize: 11.5, color: C.inkMute, fontWeight: 600, whiteSpace: 'nowrap' }}>{doneCount} / {totalCount} done</div>
      </div>
      )}

      {/* task list */}
      {!editingPlan && (
      <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {plan.tasks.map((task, i) => {
          const isSwiped = swipedIndex === i
          const isDragging = dragIndex === i
          const isDropAbove = dropIndex === i && dragIndex !== null && dragIndex !== i && i <= dragIndex
          const isDropBelow = dropIndex === i && dragIndex !== null && dragIndex !== i && i > dragIndex
          const isEditing = editingIndex === i

          return (
            <div
              key={i}
              ref={el => { rowRefs.current[i] = el }}
              style={{ position: 'relative', overflow: 'hidden' }}
              onPointerDown={e => {
                if (e.target.closest('[data-drag-handle]')) return
                swipeStart.current = { x: e.clientX, index: i }
              }}
              onPointerMove={e => {
                if (swipeStart.current.index !== i || swipeStart.current.x === null) return
                const dx = e.clientX - swipeStart.current.x
                if (dx < -60) { setSwipedIndex(i); swipeStart.current.x = null }
                else if (dx > 20) { setSwipedIndex(null); swipeStart.current.x = null }
              }}
              onPointerUp={() => { swipeStart.current = { x: null, index: null } }}
            >
              {isDropAbove && <div style={{ height: 2, background: C.ochre, margin: '0 12px' }}/>}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                borderTop: i === 0 ? 'none' : `1px solid ${C.hairline}`,
                background: isDragging ? '#fffaef' : 'transparent',
                boxShadow: isDragging ? '0 3px 10px rgba(0,0,0,.12)' : 'none',
                borderRadius: isDragging ? 6 : 0,
                transform: isSwiped ? 'translateX(-68px)' : 'translateX(0)',
                transition: isDragging ? 'none' : 'transform 0.2s ease',
                userSelect: 'none',
              }}>
                {/* checkbox */}
                <div
                  onClick={() => {
                    if (completingIdx === i) return
                    setSwipedIndex(null)
                    setEditingIndex(null)
                    if (task.done) {
                      onCheck(plan.id, i)
                      return
                    }
                    setCompletingIdx(i)
                    setTimeout(() => {
                      onCheck(plan.id, i)
                      setCompletingIdx(null)
                    }, 350)
                  }}
                  style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                    border: `1.5px solid ${completingIdx === i ? C.sage : task.done ? C.sage + '99' : C.border}`,
                    background: completingIdx === i ? C.sage : task.done ? C.sage + '33' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                    ...(completingIdx === i ? { animation: 'heed-done-check 0.22s ease forwards' } : {}),
                  }}
                >
                  {(task.done || completingIdx === i) && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
                </div>
                {/* label or edit input */}
                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                    style={{ flex: 1, border: 'none', borderBottom: `1.5px solid ${C.ochre}`, outline: 'none', fontSize: 13, color: C.ink, background: 'transparent', padding: '1px 0', fontFamily: 'inherit' }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: task.done ? C.inkMute : C.ink, textDecoration: task.done ? 'line-through' : 'none' }}>{task.label}</span>
                )}
                {/* per-row pencil removed — task editing flows through the
                    single ✎ Edit button at the top of the screen now. */}
              </div>
              {/* swipe delete button */}
              {isSwiped && (
                <div onClick={() => { setSwipedIndex(null); onDeleteTask(plan.id, i) }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 68, background: '#e05050', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>Delete</div>
              )}
              {isDropBelow && <div style={{ height: 2, background: C.ochre, margin: '0 12px' }}/>}
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

// ── AddPlanSheet ─────────────────────────────────────────────────
const PLAN_TYPES = [
  { type: 'project', icon: '📦', label: 'Project',  desc: 'A goal with a checklist of steps' },
  { type: 'goal',    icon: '🎯', label: 'Goal',     desc: 'Something to work toward with a measurable target' },
  { type: 'event',   icon: '📅', label: 'Event',    desc: 'A date you\'re preparing for' },
]

function getSuggestedTasks(type, title) {
  const t = title.toLowerCase()
  // Strip leading verbs so "the thing" survives ("Cook nilaga" → "nilaga").
  const subject = t.replace(/^(cook|make|bake|build|fix|repair|learn|study|clean|organize|declutter|plan|prepare|finish|start)\s+/i, '').trim() || t
  if (type === 'project') {
    if (/mov(e|ing)|apartment|flat|reloc/.test(t))
      return ['Book moving truck', 'Notify landlord', 'Pack bedroom', 'Pack kitchen', 'Update address with bank', 'Arrange utilities transfer', 'Clean old place']
    if (/launch|startup|product release/.test(t))
      return ['Define scope and goals', 'Design mockups', 'Build MVP', 'Write documentation', 'Plan launch day', 'Gather early feedback']
    if (/website|web app|site|landing page/.test(t))
      return ['Write copy', 'Design layouts', 'Set up hosting', 'Configure domain', 'Test on mobile', 'Go live']
    if (/wedding|marry|engagement/.test(t))
      return ['Book venue', 'Send invitations', 'Arrange catering', 'Book photographer', 'Order flowers', 'Plan honeymoon']
    if (/renovate|renovation|remodel/.test(t))
      return ['Get contractor quotes', 'Choose materials', 'Clear the space', 'Order supplies', 'Schedule inspections', 'Final walkthrough']
    if (/hire|recruit|onboard/.test(t))
      return ['Write job description', 'Post to job boards', 'Screen applications', 'Schedule interviews', 'Make offer', 'Onboarding plan']
    if (/book|writ(e|ing)|publish|novel|memoir/.test(t))
      return ['Outline chapters', 'Write first draft', 'Edit and revise', 'Design cover', 'Proofread', 'Publish or share']
    // Cooking / recipes — covers "Cook nilaga", "Make sinigang", "Bake bread", etc.
    if (/^cook|^make.+(soup|stew|pasta|curry|bread|cake|pie|dish)|^bak(e|ing)|recipe|nilaga|sinigang|adobo|kare[- ]?kare|menudo/.test(t))
      return [`Find a ${subject} recipe`, 'List ingredients', 'Buy groceries', 'Prep ingredients', `Cook ${subject}`, 'Plate and serve', 'Save the recipe if it worked']
    // Learning / studying / a course / a skill
    if (/learn|study|course|tutorial|skill|master|practice|memoriz|exam prep/.test(t))
      return [`Set a goal for ${subject}`, 'Find one good resource', 'Schedule daily practice (15–30 min)', 'Track progress weekly', 'Test what you learned', 'Teach it back to someone']
    // Fitness / training / habit-building
    if (/workout|fitness|gym|run|marathon|train(ing)?|lift|yoga|swim|cycle|cycling|diet/.test(t))
      return ['Set a target (date or measure)', 'Plan weekly schedule', 'Take baseline measurements', 'Prepare gear / space', 'Track sessions', 'Review progress weekly']
    // Cleaning / decluttering / organizing
    if (/clean|declutter|organi[sz]e|tidy|kondo|kondo-?style|sweep/.test(t))
      return [`Pick a starting zone for ${subject}`, 'Sort: keep / donate / toss', 'Bag up what is leaving', 'Wipe and reset surfaces', 'Put back with a system', 'Photograph the result']
    // Gardening / plants
    if (/garden|plant|grow|seedling|herb/.test(t))
      return [`Pick a spot for ${subject}`, 'Buy seeds or seedlings', 'Prepare soil', 'Plant', 'Set watering schedule', 'Track first signs of growth']
    // Crafting / DIY / build something
    if (/diy|craft|build|sew|knit|paint|3d print|woodwork/.test(t))
      return [`Sketch what ${subject} should look like`, 'List materials', 'Buy or gather supplies', 'Set aside a working block', 'Build / make the thing', 'Show or photograph the result']
    // Generic but personalized fallback — uses the user's words instead of
    // sounding like a corporate template.
    return [`Plan ${subject}`, `Gather what you need for ${subject}`, `Block time for ${subject}`, `Make a first attempt`, `Reflect on how ${subject} went`]
  }
  if (type === 'event') {
    if (/interview/.test(t))
      return ['Research the company', 'Prepare answers for common questions', 'Iron outfit', 'Plan route and commute', 'Arrive 10 min early', 'Prepare questions to ask']
    if (/present|talk|speak|conference/.test(t))
      return ['Outline key points', 'Create slides', 'Practice 3 times', 'Prepare for Q&A', 'Test equipment', 'Arrive early to set up']
    if (/trip|travel|fly|vacation|holiday/.test(t))
      return ['Book flights', 'Book accommodation', 'Pack essentials', 'Check passport and visa', 'Notify bank', 'Plan itinerary']
    if (/birthday|party|celebrat/.test(t))
      return ['Set guest list', 'Send invites', 'Order cake', 'Prepare venue', 'Plan activities', 'Get decorations']
    if (/exam|test|quiz|review/.test(t))
      return ['Review notes', 'Do practice tests', 'Get good sleep before', 'Prepare materials', 'Arrive early']
    if (/meet|meeting|workshop/.test(t))
      return ['Prepare agenda', 'Review relevant materials', 'Confirm attendees', 'Book room or send link', 'Send follow-up after']
    if (/dinner|lunch|date|gather/.test(t))
      return ['Confirm guest list', 'Book restaurant or prepare menu', 'Send reminder', 'Prepare conversation topics']
    return ['Confirm details', 'Prepare materials', 'Check logistics', 'Arrive on time', 'Follow up after']
  }
  return []
}

function AddPlanSheet({ onClose, onAdd }) {
  const [step, setStep]   = useState('pick')   // 'pick' | 'form'
  const [type, setType]   = useState(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate]         = useState('')
  const [tasksText, setTasksText]     = useState('')
  const [goalKind, setGoalKind]       = useState('milestone')  // 'milestone' | 'numeric'
  const [targetAmt, setTargetAmt]     = useState('')
  const [unit, setUnit]               = useState('₱')
  const [targetDate, setTargetDate]   = useState('')
  const [eventDate, setEventDate]     = useState('')
  const [description, setDescription] = useState('')
  const [suggestDismissed, setSuggestDismissed] = useState(false)
  const [addedSuggestions, setAddedSuggestions] = useState([])
  // AI-generated suggestions, when the user opts in via "Smarter suggestions".
  // null = haven't asked, [] = asked and got nothing (fall back), array = use these
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  const inputStyle = { width: '100%', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 4 }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: C.inkMute, display: 'block', marginTop: 12 }

  // Reset AI suggestions whenever the title or type changes — they're stale.
  useEffect(() => { setAiSuggestions(null); setAiError(null) }, [title, type])

  const heuristicSuggestions = (type === 'project' || type === 'event') && title.trim().length >= 3
    ? getSuggestedTasks(type, title)
    : []
  const suggestions = aiSuggestions && aiSuggestions.length > 0 ? aiSuggestions : heuristicSuggestions
  const showSuggest = suggestions.length > 0 && !suggestDismissed

  const fetchSmarterSuggestions = async () => {
    if (!title.trim() || aiLoading) return
    setAiLoading(true); setAiError(null)
    try {
      const resp = await fetch(`${FUNCTIONS_URL}/api/suggest_tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), type }),
      })
      if (!resp.ok) throw new Error('Request failed')
      const data = await resp.json()
      const tasks = Array.isArray(data?.tasks) ? data.tasks.filter(t => typeof t === 'string' && t.trim()).slice(0, 8) : []
      if (tasks.length === 0) throw new Error('No suggestions returned')
      setAiSuggestions(tasks)
      setAddedSuggestions(prev => prev.filter(item => tasks.includes(item)))
    } catch (err) {
      setAiError("Couldn't reach Heed — keeping the basic suggestions.")
    } finally {
      setAiLoading(false)
    }
  }

  const addSuggestion = (item) => {
    if (addedSuggestions.includes(item)) return
    setAddedSuggestions(prev => [...prev, item])
    setTasksText(prev => prev.trim() ? prev.trim() + '\n' + item : item)
  }

  const suggestPrompt = showSuggest && (
    <div style={{ background: C.bellySoft, border: `1px solid ${C.belly}`, borderRadius: 10, padding: '10px 12px', marginTop: 12, animation: 'heed-fadeIn 0.25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <MayaOwl size={22} idle={true}/>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: C.warmDark }}>
          Tap to add · based on "{title.trim().slice(0, 24)}{title.trim().length > 24 ? '…' : ''}"
        </div>
        <button onClick={() => setSuggestDismissed(true)} style={{ fontSize: 13, color: C.inkMute, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1, touchAction: 'manipulation' }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {suggestions.map((item, i) => {
          const added = addedSuggestions.includes(item)
          return (
            <button key={i} onClick={() => addSuggestion(item)} disabled={added}
              style={{
                fontSize: 12, fontWeight: 500, borderRadius: 999, padding: '5px 11px',
                border: `1px solid ${added ? C.sage + '80' : C.belly}`,
                background: added ? C.sageSoft : C.paper,
                color: added ? C.sage : C.inkSoft,
                cursor: added ? 'default' : 'pointer',
                touchAction: 'manipulation', fontFamily: 'inherit',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              {added
                ? <><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.sage} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>{item}</>
                : <><span style={{ fontSize: 14, lineHeight: 1, color: C.warmDark, fontWeight: 700 }}>+</span>{item}</>
              }
            </button>
          )
        })}
      </div>
      {/* Smarter suggestions — opt-in LLM call. Shown only when AI hasn't
          replaced the chips yet. After it succeeds, the button hides
          (chips above are now AI-generated). */}
      {!aiSuggestions && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={fetchSmarterSuggestions}
            disabled={aiLoading || !title.trim()}
            style={{
              background: 'transparent',
              border: `1px dashed ${C.warmDark}66`,
              color: C.warmDark,
              padding: '5px 11px',
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: aiLoading || !title.trim() ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: aiLoading || !title.trim() ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 5,
              transition: 'all 0.15s',
            }}>
            {aiLoading
              ? <><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${C.warmDark}33`, borderTopColor: C.warmDark, animation: 'heed-spin 0.8s linear infinite' }}/> Thinking…</>
              : <>✨ Smarter suggestions</>
            }
          </button>
          {aiError && (
            <span style={{ fontSize: 11, color: C.rust, fontStyle: 'italic' }}>{aiError}</span>
          )}
        </div>
      )}
    </div>
  )

  const handleSubmit = () => {
    if (!title.trim()) return
    if (!type) return
    if (type === 'goal' && goalKind === 'numeric' && (parseFloat(targetAmt) || 0) < 1) return
    const parsedTasks = tasksText.split('\n').map(s => s.trim()).filter(Boolean).map(label => ({ label, done: false }))
    const planType = PLAN_TYPES.find(p => p.type === type)
    if (!planType) return
    const plan = { id: `plan-${Date.now()}`, type, icon: planType.icon, title: title.trim(), description: description.trim() }
    if (type === 'project') { plan.dueDate = dueDate || 'No due date'; plan.tasks = parsedTasks }
    if (type === 'goal' && goalKind === 'milestone') { plan.goalKind = 'milestone'; plan.targetDate = targetDate || 'No date set'; plan.achieved = false }
    if (type === 'goal' && goalKind === 'numeric')   { plan.goalKind = 'numeric'; plan.current = 0; plan.target = parseFloat(targetAmt) || 0; plan.unit = unit || ''; plan.targetDate = targetDate || 'No target date' }
    if (type === 'event')   { plan.eventDate = eventDate ? new Date(eventDate) : null; plan.tasks = parsedTasks }
    onAdd(plan)
    setStep('pick'); setType(null); setTitle(''); setDescription(''); setDueDate(''); setTasksText(''); setTargetAmt(''); setUnit('₱'); setTargetDate(''); setEventDate(''); setGoalKind('milestone')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `22px 22px calc(22px + env(safe-area-inset-bottom)) 22px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 18px' }}/>

        {step === 'pick' && (
          <>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.warmDark, marginBottom: 4 }}>What kind of plan?</div>
            <div style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 18 }}>Choose a type to get started</div>
            {PLAN_TYPES.map(pt => (
              <button key={pt.type} onClick={() => { setType(pt.type); setStep('form') }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: PLAN_ICON_BG[pt.type], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{pt.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{pt.label}</div>
                  <div style={{ fontSize: 12, color: C.inkMute, marginTop: 2 }}>{pt.desc}</div>
                </div>
              </button>
            ))}
            <button onClick={onClose} style={{ width: '100%', background: 'transparent', border: 'none', color: C.inkMute, fontSize: 13, cursor: 'pointer', padding: '10px 0', fontFamily: 'inherit' }}>Cancel</button>
          </>
        )}

        {step === 'form' && type && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Back</button>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.warmDark }}>
                {PLAN_TYPES.find(p => p.type === type).icon} New {PLAN_TYPES.find(p => p.type === type).label}
              </div>
            </div>

            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} placeholder="e.g. Move apartments" value={title} onChange={e => setTitle(e.target.value)} autoFocus/>

            <label style={labelStyle}>Description <span style={{ fontWeight: 400, color: C.inkMute }}>(optional)</span></label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="What's this plan for?" value={description} onChange={e => setDescription(e.target.value)}/>

            {type === 'project' && (
              <>
                <label style={labelStyle}>Due date (optional)</label>
                <input type="date" style={inputStyle} value={dueDate} onChange={e => setDueDate(e.target.value)}/>
                {suggestPrompt}
                <label style={labelStyle}>Tasks (one per line, optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder={"Book moving truck\nPack bedroom\nNotify landlord"} value={tasksText} onChange={e => setTasksText(e.target.value)}/>
              </>
            )}

            {type === 'goal' && (
              <>
                <label style={labelStyle}>Goal type</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {[{ k: 'milestone', label: 'Milestone', sub: 'Text-based' }, { k: 'numeric', label: 'Numeric', sub: 'Track amount' }].map(({ k, label, sub }) => (
                    <button key={k} onClick={() => setGoalKind(k)} style={{ flex: 1, background: goalKind === k ? C.bellySoft : C.paper, border: `1.5px solid ${goalKind === k ? C.warmDark + '66' : C.border}`, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: goalKind === k ? C.warmDark : C.ink }}>{label}</div>
                      <div style={{ fontSize: 11, color: C.inkMute, marginTop: 1 }}>{sub}</div>
                    </button>
                  ))}
                </div>
                {goalKind === 'numeric' && (
                  <>
                    <label style={labelStyle}>Target amount *</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <input style={{ ...inputStyle, width: 64, marginTop: 0 }} placeholder="₱" value={unit} onChange={e => setUnit(e.target.value)}/>
                      <input type="number" min="1" style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="50000" value={targetAmt} onChange={e => setTargetAmt(e.target.value)}/>
                    </div>
                  </>
                )}
                <label style={labelStyle}>Target date (optional)</label>
                <input style={inputStyle} placeholder="e.g. Aug 2026" value={targetDate} onChange={e => setTargetDate(e.target.value)}/>
              </>
            )}

            {type === 'event' && (
              <>
                <label style={labelStyle}>Event date *</label>
                <input type="date" style={inputStyle} value={eventDate} onChange={e => setEventDate(e.target.value)}/>
                {suggestPrompt}
                <label style={labelStyle}>Prep tasks (one per line, optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder={"Research the company\nIron outfit"} value={tasksText} onChange={e => setTasksText(e.target.value)}/>
              </>
            )}

            <button onClick={handleSubmit} style={{ ...getBtnPrimary(), width: '100%', marginTop: 18, padding: '11px 0', fontSize: 14, borderRadius: 10 }}>
              Create plan
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── GoalDetailScreen ───────────────────────────────────────────────
function GoalDetailScreen({ plan, onBack, onUpdatePlan }) {
  const isMilestone = plan.goalKind === 'milestone'
  const [val, setVal] = useState(String(plan.current ?? 0))
  useEffect(() => { if (!isMilestone) setVal(String(plan.current ?? 0)) }, [plan.current, isMilestone])

  const pct = isMilestone
    ? (plan.achieved ? 100 : 0)
    : plan.target > 0 ? Math.min(100, Math.round((plan.current ?? 0) / plan.target * 100)) : 0
  const remaining = isMilestone ? 0 : Math.max(0, plan.target - (plan.current ?? 0))

  function submitNumeric() {
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) return
    onUpdatePlan?.(plan.id, { current: n })
  }

  return (
    <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
      <div style={{ marginBottom: 6 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.ochre, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>‹ Plans</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: plan.description ? 6 : 14 }}>
        <span style={{ fontSize: 20 }}>{plan.icon}</span>
        <span style={{ flex: 1, fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, color: C.warmDark, letterSpacing: -0.2 }}>{plan.title}</span>
      </div>
      {plan.description && (
        <div style={{ fontSize: 13, color: C.inkSoft, fontStyle: 'italic', marginBottom: 14, lineHeight: 1.5, paddingLeft: 2 }}>
          {plan.description}
        </div>
      )}
      {plan.targetDate && plan.targetDate !== 'No date set' && (
        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 14, paddingLeft: 2 }}>
          Target: {plan.targetDate}
        </div>
      )}

      <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ height: 6, background: C.bellySoft, borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: isMilestone ? C.sage : C.ochre, width: `${pct}%`, transition: 'width 0.4s ease' }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.inkMute, marginBottom: 16 }}>
          <span>{pct}%{isMilestone ? (plan.achieved ? ' · Achieved!' : ' · In progress') : ' saved'}</span>
          {!isMilestone && <span>{plan.unit}{remaining.toLocaleString()} to go</span>}
        </div>
        {isMilestone ? (
          <button onClick={() => onUpdatePlan?.(plan.id, { achieved: !plan.achieved })}
            style={{ ...getBtnPrimary(), width: '100%', padding: '12px 0', fontSize: 14 }}>
            {plan.achieved ? 'Mark as in progress' : 'Mark as achieved ✓'}
          </button>
        ) : (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.inkMute, display: 'block', marginBottom: 6 }}>
              Update current amount ({plan.unit})
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="number" min="0" value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitNumeric()}
                style={{ flex: 1, background: C.paperHi, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 15, color: C.ink, outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => { e.target.style.borderColor = C.warmDark }}
                onBlur={e => { e.target.style.borderColor = C.border }}/>
              <button onClick={submitNumeric} style={{ ...getBtnPrimary(), padding: '11px 18px', fontSize: 14 }}>Save</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── GoalUpdateSheet ────────────────────────────────────────────────
function GoalUpdateSheet({ plan, onClose, onSave }) {
  const isMilestone = plan.goalKind === 'milestone'
  const [val, setVal] = useState(String(plan.current ?? 0))
  const pct = !isMilestone && plan.target > 0 ? Math.min(100, Math.round((parseFloat(val) || 0) / plan.target * 100)) : 0
  const remaining = !isMilestone ? Math.max(0, plan.target - (parseFloat(val) || 0)) : 0
  const submitNumeric = () => {
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) return
    onSave({ current: n })
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `22px 22px calc(22px + env(safe-area-inset-bottom)) 22px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 18px' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f5f0d8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{plan.icon}</div>
          <div>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, color: C.warmDark }}>{plan.title}</div>
            <div style={{ fontSize: 12, color: C.inkMute, marginTop: 2 }}>
              {isMilestone
                ? (plan.targetDate && plan.targetDate !== 'No date set' ? `Target: ${plan.targetDate}` : 'No date set')
                : `Target: ${plan.unit}${(plan.target ?? 0).toLocaleString()} · ${plan.targetDate}`}
            </div>
          </div>
        </div>

        {isMilestone ? (
          <>
            <div style={{ background: plan.achieved ? '#d4edda' : C.bellySoft, borderRadius: 12, padding: '14px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>{plan.achieved ? '✓' : '◯'}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: plan.achieved ? '#2d6a4f' : C.inkMute }}>
                  {plan.achieved ? 'Achieved!' : 'Not yet achieved'}
                </div>
                <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>
                  {plan.achieved ? 'Tap below to mark as still in progress.' : 'Tap below when you\'ve reached this goal.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => onSave({ achieved: !plan.achieved })}
                style={{ ...getBtnPrimary(), flex: 1, padding: '12px 0', fontSize: 14 }}
              >
                {plan.achieved ? 'Mark as in progress' : 'Mark as achieved ✓'}
              </button>
              <button onClick={onClose} style={{ ...getBtnGhost(), flex: 1, padding: '12px 0', fontSize: 14 }}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ height: 6, background: C.bellySoft, borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: C.ochre, width: `${pct}%`, transition: 'width 0.3s ease' }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.inkMute, marginBottom: 18 }}>
              <span>{pct}% saved</span>
              <span>{plan.unit}{remaining.toLocaleString()} to go</span>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.inkMute, display: 'block', marginBottom: 6 }}>
              Current amount ({plan.unit})
            </label>
            <input
              type="number"
              min="0"
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitNumeric()}
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', background: C.paperHi, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 16, color: C.ink, outline: 'none', fontFamily: 'inherit', marginBottom: 14 }}
              onFocus={e => { e.target.style.borderColor = C.warmDark }}
              onBlur={e => { e.target.style.borderColor = C.border }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submitNumeric} style={{ ...getBtnPrimary(), flex: 1, padding: '12px 0', fontSize: 14 }}>Save progress</button>
              <button onClick={onClose} style={{ ...getBtnGhost(), flex: 1, padding: '12px 0', fontSize: 14 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── PlansPanel ───────────────────────────────────────────────────
function PlansPanel({ plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan, updatePlan }) {
  const [addOpen, setAddOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState(null)

  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null

  if (selectedPlan && selectedPlan.type !== 'goal') {
    return (
      <PlanDetailScreen
        plan={selectedPlan}
        onBack={() => setSelectedPlanId(null)}
        onCheck={checkTask}
        onRename={renameTask}
        onAddTask={addTask}
        onDeleteTask={deleteTask}
        onReorder={reorderTasks}
        onUpdatePlan={updatePlan}
      />
    )
  }

  if (selectedPlan && selectedPlan.type === 'goal') {
    return (
      <GoalDetailScreen
        plan={selectedPlan}
        onBack={() => setSelectedPlanId(null)}
        onUpdatePlan={updatePlan}
      />
    )
  }

  return (
    <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setAddOpen(true)} style={getBtnPrimary()}>+ Add plan</button>
      </div>
      {plans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: C.inkMute, fontSize: 13, fontStyle: 'italic' }}>
          No plans yet. Tap "+ Add plan" to create a goal, project, or event.
        </div>
      )}
      {plans.map((p, i) => (
        <PlanCard
          key={p.id}
          plan={p}
          delay={i * 50}
          onSelectPlan={(id) => setSelectedPlanId(id)}
        />
      ))}
      {addOpen && <AddPlanSheet onClose={() => setAddOpen(false)} onAdd={p => { addPlan(p); setAddOpen(false) }}/>}
    </div>
  )
}

// ── LifeEventsPanel ─────────────────────────────────────────────
function LifeEventsPanel({ allUpcoming, activeContext, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }) {
  return (
    <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {CONTEXT_CHIPS.map(c => (
          <button key={c.type} onClick={() => onQuickContext(c.type)}
            style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '6px 14px', fontSize: 12, color: C.ink, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.ochre; e.currentTarget.style.background = C.ochreSoft }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.paper }}
          >{c.label}</button>
        ))}
        <button onClick={onAddContext}
          style={{ background: 'transparent', border: `1.5px solid ${C.border}`, borderRadius: 999, padding: '6px 14px', fontSize: 12, color: C.inkSoft, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.ochre }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border }}
        >+ Add event</button>
      </div>
      {activeContext && (
        <ActiveContextCard
          context={activeContext}
          onImBetter={onImBetter}
          onExtend={onExtend}
          onClick={() => onDetailOpen?.(activeContext, 'active')}
        />
      )}
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16, boxShadow: C.shadowSoft }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>Upcoming</div>
        {allUpcoming.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', padding: '8px 0' }}>Nothing on the horizon. Tap a chip above if something came up, or "+ Add event" to plan ahead.</div>
        ) : allUpcoming.map((c, i) => (
          <ContextRow key={`u-${i}`} ctx={c} highlight onDetailOpen={ctx => onDetailOpen?.(ctx, 'upcoming')}/>
        ))}
      </div>
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, boxShadow: C.shadowSoft }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>Past</div>
        {CONTEXTS_PAST.map((c, i) => (
          <ContextRow key={`p-${i}`} ctx={c} onDetailOpen={ctx => onDetailOpen?.(ctx, 'past')}/>
        ))}
      </div>
      <div style={{ marginTop: 20, padding: '14px 16px', background: C.bellySoft, borderRadius: 10, fontSize: 13, color: C.ink, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span>You can also tell Heed in plain language — try <em>"I'm sick this week"</em> or <em>"I'm traveling next month."</em></span>
      </div>
    </div>
  )
}

// ── LifeTab ──────────────────────────────────────────────────────
function LifeTab({ upcoming, active, activeContext, plansHook, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }) {
  const [subtab, setSubtab] = useState('plans')
  const allUpcoming = [...(active || []).map(mapApiContext), ...(upcoming || []).map(mapApiContext)]
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <SectionHeader>Life</SectionHeader>
        <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', marginTop: -8 }}>Your plans and life events, in one place.</div>
      </div>
      <div style={{ display: 'flex', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, marginBottom: 18, gap: 4 }}>
        <SegmentButton active={subtab === 'plans'} onClick={() => setSubtab('plans')} label="Plans" count={plansHook.plans.length} accent={C.warmDark}/>
        <SegmentButton active={subtab === 'events'} onClick={() => setSubtab('events')} label="Life Events" count={allUpcoming.length} accent={C.sage}/>
      </div>
      {subtab === 'plans'  && <PlansPanel {...plansHook}/>}
      {subtab === 'events' && (
        <LifeEventsPanel
          allUpcoming={allUpcoming}
          activeContext={activeContext}
          onAddContext={onAddContext}
          onQuickContext={onQuickContext}
          onImBetter={onImBetter}
          onExtend={onExtend}
          onDetailOpen={onDetailOpen}
        />
      )}
    </div>
  )
}

// ── CalendarTab ────────────────────────────────────────────────
const TODAY_DATE = new Date()

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function fmtMonth(d) { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
const parseDue = val => { if (!val) return null; const d = new Date(val); return isNaN(d) ? null : d }

// Routine schedule string → array of weekday indices (0=Mon … 6=Sun, matching WeekDetail).
function routineDays(routine) {
  const s = (routine?.schedule || '').toLowerCase()
  if (s.includes('weekday')) return [0,1,2,3,4]
  if (s.includes('weekend')) return [5,6]
  if (s.includes('daily'))   return [0,1,2,3,4,5,6]
  return [0,1,2,3,4,5,6] // 'Custom' / unknown — treat as daily until we have structured day data
}

// ── Monthly retrospective ─────────────────────────────────────────
// Builds a Retrospective object client-side from current state. Phase 1:
// approximations in places where we don't yet have backend completion
// history (noted inline). Backend endpoint will replace this in Phase 1b
// keeping the same shape, so the UI doesn't change.
function computeRetrospective(period, { tasks = [], routines = [], contexts = [], recentSkips = [] } = {}) {
  // period: { year, monthIndex } where monthIndex is 0-based
  const periodStart = new Date(period.year, period.monthIndex, 1)
  const periodEnd   = new Date(period.year, period.monthIndex + 1, 0, 23, 59, 59)
  const now = new Date()
  const isPartial = now <= periodEnd  // "April so far" if month not yet over
  const daysInPeriod = Math.min(
    Math.floor((Math.min(periodEnd, now) - periodStart) / 86400000) + 1,
    new Date(period.year, period.monthIndex + 1, 0).getDate(),
  )
  const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // ── Routine summaries ──────────────────────────────────
  // Approximation: completion14d covers the last 14 days, indexed 0=oldest..13=today.
  // For a past month we don't have full history — extrapolate from recent rate.
  const routineSummaries = routines.map(r => {
    const completion = r.completion14d || []
    const recentDone = completion.filter(Boolean).length
    const recentRate = completion.length ? recentDone / completion.length : 0
    const days = routineDays(r)
    // How many days the routine was *due* in this period
    const daysDue = (() => {
      let count = 0
      for (let i = 0; i < daysInPeriod; i++) {
        const d = new Date(periodStart); d.setDate(d.getDate() + i)
        const wd = (d.getDay() + 6) % 7  // Sun=6 → 6, Mon=0
        if (days.includes(wd)) count++
      }
      return count
    })()
    const daysCompleted = Math.round(daysDue * recentRate)
    // Best streak in completion14d as a stand-in
    let bestStreak = 0, cur = 0
    for (const d of completion) { if (d) { cur++; bestStreak = Math.max(bestStreak, cur) } else cur = 0 }
    let note = null
    if (daysDue > 0) {
      const rate = daysCompleted / daysDue
      if (rate >= 0.85 && bestStreak >= 7) note = `Strong this month. Best run: ${bestStreak} days.`
      else if (rate >= 0.85) note = `Solid pattern. Slipped ${daysDue - daysCompleted} day${daysDue - daysCompleted === 1 ? '' : 's'}.`
      else if (rate >= 0.5)  note = `${daysCompleted}/${daysDue}. Some slips clustered around weekends.`
      else                   note = `Off-pattern this month — ${daysCompleted}/${daysDue}.`
    } else {
      note = 'Just started — building up history.'
    }
    return {
      routine_id: r.id,
      name: r.name,
      days_due: daysDue,
      days_completed: daysCompleted,
      completion_rate: daysDue > 0 ? daysCompleted / daysDue : 0,
      best_streak: bestStreak,
      note,
    }
  })

  // ── Top-line stats ──────────────────────────────────────
  // Approximation: tasks with last_done_at inside the period count as 1 completion each.
  // (Backend will give us multi-completion accuracy later.)
  const taskCompletions = tasks.filter(t => {
    const d = parseDue(t.last_done_at)
    return d && d >= periodStart && d <= periodEnd
  }).length
  const routineCompletions = routineSummaries.reduce((s, r) => s + r.days_completed, 0)
  const routineSkips = routineSummaries.reduce((s, r) => s + (r.days_due - r.days_completed), 0)
  const completions = taskCompletions + routineCompletions
  const skips = routineSkips // Task skips not tracked in current frontend state.
  const totalDue = completions + skips
  const completionRate = totalDue > 0 ? completions / totalDue : 0

  // ── Cadence changes ────────────────────────────────────
  // We don't yet have a history of what cadence WAS — only the current learned/explicit value.
  // For Phase 1, surface tasks with a learned_cadence_days that differs from explicit_cadence_days
  // (Heed has adjusted) OR newly learned (no prior explicit).
  const cadenceChanges = tasks
    .filter(t => t.learned_cadence_days && t.learned_cadence_days > 0)
    .map(t => {
      const before = t.explicit_cadence_days
      const after = Math.round(t.learned_cadence_days * 10) / 10
      // Approximation: cycles_observed = floor(daysSinceCreated / cadence). Without created_at,
      // assume "enough" if last_done_at is set and rate is steady. Use a heuristic.
      const cycles = before
        ? Math.max(2, Math.round(Math.abs(after - before) > 1 ? 4 : 6))
        : 2
      const confidence = cycles >= 6 ? 'high' : cycles >= 3 ? 'medium' : 'low'
      return {
        task_id: t.id,
        task_name: t.name,
        before_days: before || null,
        after_days: after,
        cycles_observed: cycles,
        confidence,
      }
    })
    .slice(0, 6)

  // ── Worth attention ─────────────────────────────────────
  // Tasks where next_due_at has been overdue more than ~1.5x the cadence — signals slipping.
  const needsAttention = tasks
    .map(t => {
      const due = parseDue(t.next_due_at)
      if (!due) return null
      const cad = t.learned_cadence_days || t.explicit_cadence_days
      if (!cad) return null
      const overdueDays = Math.max(0, Math.floor((now - due) / 86400000))
      if (overdueDays < cad * 0.5) return null
      const overdueCycles = Math.floor(overdueDays / cad) + (overdueDays % cad > 0 ? 1 : 0)
      if (overdueCycles < 2) return null
      const suggested = Math.round(cad * 1.25)
      return {
        task_id: t.id,
        task_name: t.name,
        issue: 'overdue_repeat',
        detail: `Overdue ${overdueCycles} cycles. Cadence may be too tight at ${cad}d.`,
        suggested_action: 'adjust_cadence',
        suggested_payload: { new_cadence_days: suggested },
        suggested_label: `Push to ${suggested} d`,
      }
    })
    .filter(Boolean)
    .slice(0, 4)

  // ── Skip-reason attention items ─────────────────────────
  // Reads recentSkips (in-memory log populated by handleSkip). Detects:
  //   forgot_pattern — same task skipped as 'forgot' 3+ times this period
  //   busy_cluster   — 3+ 'busy' skips on the same task this period
  // Supplements the cadence-based items above without replacing them.
  const skipsThisPeriod = recentSkips.filter(s => {
    const ts = new Date(s.ts)
    return ts >= periodStart && ts <= periodEnd
  })
  const forgotByTask = new Map()
  const busyByTask = new Map()
  for (const s of skipsThisPeriod) {
    if (s.reason === 'forgot') forgotByTask.set(s.task_id, (forgotByTask.get(s.task_id) || 0) + 1)
    else if (s.reason === 'too_busy') busyByTask.set(s.task_id, (busyByTask.get(s.task_id) || 0) + 1)
  }
  const seenAttentionIds = new Set(needsAttention.map(a => a.task_id))
  for (const [taskId, count] of forgotByTask) {
    if (count < 3 || seenAttentionIds.has(taskId)) continue
    const skip = skipsThisPeriod.find(s => s.task_id === taskId && s.reason === 'forgot')
    if (!skip) continue
    needsAttention.push({
      task_id: taskId,
      task_name: skip.task_name || 'This task',
      issue: 'forgot_pattern',
      detail: `Marked "Forgot" ${count} times this month. The cadence may be drifting out of memory — want a different cue?`,
      suggested_action: 'review',
      suggested_payload: null,
      suggested_label: null,
    })
    seenAttentionIds.add(taskId)
  }
  for (const [taskId, count] of busyByTask) {
    if (count < 3 || seenAttentionIds.has(taskId)) continue
    const skip = skipsThisPeriod.find(s => s.task_id === taskId && s.reason === 'too_busy')
    if (!skip) continue
    needsAttention.push({
      task_id: taskId,
      task_name: skip.task_name || 'This task',
      issue: 'busy_cluster',
      detail: `Skipped as "Busy" ${count} times. Cadence may be too tight for your real load.`,
      suggested_action: 'review',
      suggested_payload: null,
      suggested_label: null,
    })
    seenAttentionIds.add(taskId)
  }

  // ── Context impact ──────────────────────────────────────
  const contextImpacts = (contexts || [])
    .filter(c => {
      const start = parseDue(c.start_date || c.start)
      const end = parseDue(c.end_date || c.end) || start
      return start && start <= periodEnd && (end || start) >= periodStart
    })
    .map(c => {
      const start = parseDue(c.start_date || c.start)
      const end = parseDue(c.end_date || c.end) || start
      const days = Math.max(1, Math.floor((end - start) / 86400000) + 1)
      const heldTasks = (c.heldTasks || []).length || c.skipped || 0
      const recoveryDays = (c.heldTasks || []).reduce((m, t) => Math.max(m, t.overdueDays || 0), 0)
      let recovery
      if (recoveryDays === 0) recovery = 'Back on rhythm right after.'
      else if (recoveryDays <= 3) recovery = `Back on rhythm in ${recoveryDays} day${recoveryDays === 1 ? '' : 's'}.`
      else recovery = `Took ${recoveryDays} days to settle back.`
      return {
        context_id: c.id || `${c.type}-${c.start_date || c.start}`,
        type: c.context_type || c.type || 'busy',
        description: c.description || c.desc || '',
        start: c.start_date || c.start,
        end: c.end_date || c.end || c.start_date || c.start,
        days,
        paused_routines: c.routinesPaused || 0,
        held_tasks: heldTasks,
        recovery,
      }
    })

  // ── Headline (rule-based, see spec §4.1) ───────────────
  const strongestRoutine = routineSummaries.slice().sort((a, b) => b.completion_rate - a.completion_rate)[0]
  const monthName = periodStart.toLocaleDateString('en-US', { month: 'long' })
  let headline
  if (isPartial && daysInPeriod < 21) {
    headline = `Here's the partial picture for ${monthName} — too early to call patterns.`
  } else if (completionRate >= 0.85) {
    headline = `Steady ${monthName}. ${strongestRoutine?.name || 'Your routines'} carried this month.`
  } else if (completionRate >= 0.60) {
    headline = `Mixed ${monthName}. ${strongestRoutine?.name || 'Routines'} held, ad-hoc tasks slipped.`
  } else if (contextImpacts.length > 0) {
    headline = `${monthName} was light — your ${contextImpacts[0].type} window covers most of it.`
  } else {
    headline = `Quiet ${monthName}. Most tasks slipped a cycle or two.`
  }

  // ── Patterns (rule-based) ───────────────────────────────
  // Aggregate weekday vs weekend completion across all routines, only counting
  // days the routine was actually scheduled. completion14d is indexed
  // 0=oldest..N-1=today, so daysAgo = (length-1) - i.
  const patterns = []
  let wdDue = 0, wdDone = 0, weDue = 0, weDone = 0
  for (const r of routines) {
    const days = routineDays(r)
    const completion = r.completion14d || []
    for (let i = 0; i < completion.length; i++) {
      const daysAgo = completion.length - 1 - i
      const date = new Date(now); date.setDate(date.getDate() - daysAgo)
      const wd = (date.getDay() + 6) % 7  // Mon=0..Sun=6
      if (!days.includes(wd)) continue
      if (wd >= 5) { weDue++; if (completion[i]) weDone++ }
      else         { wdDue++; if (completion[i]) wdDone++ }
    }
  }
  if (wdDue >= 4 && weDue >= 2) {
    const wdRate = wdDone / wdDue
    const weRate = weDone / weDue
    if (wdRate - weRate > 0.3) {
      patterns.push({
        kind: 'weekend_slip',
        label: 'Weekday person',
        detail: `Mon–Fri ${Math.round(wdRate * 100)}%, weekends ${Math.round(weRate * 100)}%.`,
      })
    } else if (weRate - wdRate > 0.3) {
      patterns.push({
        kind: 'weekday_slip',
        label: 'Weekend person',
        detail: `Sat–Sun ${Math.round(weRate * 100)}%, weekdays ${Math.round(wdRate * 100)}%.`,
      })
    }
  }

  // Morning vs evening routine comparison (when we can identify both by name)
  const morningR = routines.find(r => /morning/i.test(r.name))
  const eveningR = routines.find(r => /evening|wind[- ]?down|night/i.test(r.name))
  if (morningR && eveningR) {
    const mc = morningR.completion14d || []
    const ec = eveningR.completion14d || []
    const mRate = mc.length ? mc.filter(Boolean).length / mc.length : 0
    const eRate = ec.length ? ec.filter(Boolean).length / ec.length : 0
    if (mRate - eRate > 0.25) {
      patterns.push({
        kind: 'morning_strong',
        label: 'Mornings carried this month',
        detail: `${Math.round(mRate * 100)}% mornings vs ${Math.round(eRate * 100)}% evenings.`,
      })
    } else if (eRate - mRate > 0.25) {
      patterns.push({
        kind: 'evening_slip',
        label: 'Evenings drift',
        detail: `Wind-down completed ${Math.round(eRate * 100)}%, ~${Math.round((mRate - eRate) * -100)}% lower than mornings.`,
      })
    }
  }

  // ── Suggestions (actionable follow-ups) ─────────────────
  // Only adjust_cadence is wired through in this phase; lighten/lower_importance
  // remain as future work since they need richer payload composition.
  const suggestions = []
  for (const a of needsAttention) {
    if (a.suggested_action === 'adjust_cadence' && a.suggested_payload?.new_cadence_days) {
      suggestions.push({
        id: `adjust-${a.task_id}`,
        text: `Push ${a.task_name} cadence to every ${a.suggested_payload.new_cadence_days}d?`,
        action_type: 'adjust_cadence',
        target_id: a.task_id,
        target_name: a.task_name,
        payload: a.suggested_payload,
        cta_label: `Push to ${a.suggested_payload.new_cadence_days}d`,
      })
    }
  }

  return {
    period: `${period.year}-${String(period.monthIndex + 1).padStart(2, '0')}`,
    period_label: periodLabel,
    headline,
    is_partial: isPartial,
    completions,
    skips,
    completion_rate: completionRate,
    routines: routineSummaries,
    cadence_changes: cadenceChanges,
    needs_attention: needsAttention,
    contexts: contextImpacts,
    patterns,
    suggestions,
  }
}

function MonthStrip({ tasks, monthOffset, selectedWeekStart, onWeekSelect, onMonthChange }) {
  const touchRef = useRef(null)

  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const monthYear = base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Build list of week-Monday dates that overlap this month
  const firstMonday = startOfWeek(base)
  const lastOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0)
  const weeks = []
  let cur = new Date(firstMonday)
  while (cur <= lastOfMonth && weeks.length < 6) {
    weeks.push(new Date(cur))
    cur = addDays(cur, 7)
  }

  const dotColor = { high: C.rust, medium: C.ochre, low: C.sage }
  function handleTouchStart(e) {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function handleTouchEnd(e) {
    if (!touchRef.current) return
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.y)
    if (Math.abs(dx) > 40 && dy < 60) onMonthChange(dx < 0 ? 1 : -1)
    touchRef.current = null
  }

  const selKey = selectedWeekStart.toDateString()

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => onMonthChange(-1)} style={{ background: 'none', border: 'none', fontSize: 18, color: C.inkSoft, cursor: 'pointer', padding: '0 6px', lineHeight: 1 }}>‹</button>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 600, color: C.warmDark }}>{monthYear}</div>
        <button onClick={() => onMonthChange(1)} style={{ background: 'none', border: 'none', fontSize: 18, color: C.inkSoft, cursor: 'pointer', padding: '0 6px', lineHeight: 1 }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: C.inkMute, letterSpacing: 0.5 }}>{d}</div>
        ))}
      </div>
      {weeks.map((weekMon, wi) => {
        const isSelected = weekMon.toDateString() === selKey
        return (
          <div key={weekMon.toDateString()} onClick={() => onWeekSelect(weekMon)}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, background: isSelected ? C.bellySoft : 'transparent', borderRadius: 6, padding: '3px 0', marginBottom: 2, cursor: 'pointer' }}>
            {[0,1,2,3,4,5,6].map(di => {
              const date = addDays(weekMon, di)
              const inMonth = date.getMonth() === base.getMonth()
              const isToday = sameDay(date, today)
              const dayTasks = tasks.filter(t => { const d = parseDue(t.next_due_at); return d && sameDay(d, date) })
              const levels = [...new Set(dayTasks.map(t => t.importance).filter(Boolean))]
              return (
                <div key={di} style={{ textAlign: 'center', padding: '3px 0' }}>
                  <div style={{ fontSize: 11, color: isToday ? C.rust : inMonth ? C.ink : C.inkMute, fontWeight: isToday ? 700 : 400 }}>
                    {date.getDate()}
                  </div>
                  {levels.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 1 }}>
                      {(['high','medium','low']).filter(l => levels.includes(l)).map(l => (
                        <div key={l} style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor[l] }}/>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function WeekDetail({ tasks, weekStart, onTaskTap, onWeekOffsetChange, onAddTask, contexts = [], onAddContext, routines = [], onEditRoutine }) {
  const today = new Date()
  const impColor = { high: C.rust, medium: C.ochre, low: C.sage }
  const impIcon  = { high: '●', medium: '◆', low: '○' }

  const swipeRef = useRef(null)
  function handleTouchStart(e) {
    swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function handleTouchEnd(e) {
    if (!swipeRef.current) return
    const dx = e.changedTouches[0].clientX - swipeRef.current.x
    const dy = Math.abs(e.changedTouches[0].clientY - swipeRef.current.y)
    if (Math.abs(dx) > 40 && dy < 60) onWeekOffsetChange(dx < 0 ? 1 : -1)
    swipeRef.current = null
  }

  function contextsOnDay(date) {
    return contexts.filter(ctx => {
      if (!ctx.start_date) return false
      const s = new Date(ctx.start_date); s.setHours(0,0,0,0)
      const e = ctx.end_date ? new Date(ctx.end_date) : new Date(ctx.start_date); e.setHours(23,59,59,999)
      return date >= s && date <= e
    })
  }

  const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel   = addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 10 }}>
        Week of {startLabel} – {endLabel}
      </div>
      {routines.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>
            Routines
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {routines.map(r => {
              const days = routineDays(r)
              return (
                <button key={r.id} onClick={() => onEditRoutine && onEditRoutine(r)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: C.sage + '14', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}>
                  <div style={{ flexShrink: 0, width: 110, fontSize: 12, fontWeight: 600, color: C.warmDark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.name}
                  </div>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                    {[0,1,2,3,4,5,6].map(i => {
                      const on = days.includes(i)
                      return (
                        <div key={i} style={{ height: 6, borderRadius: 3, background: on ? C.sage + 'BB' : C.sage + '22' }}/>
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[0,1,2,3,4,5,6].map(i => {
          const date     = addDays(weekStart, i)
          const isToday  = sameDay(date, today)
          const dayTasks = tasks.filter(t => { const d = parseDue(t.next_due_at); return d && sameDay(d, date) })
          const dayCtxs  = contextsOnDay(date)
          const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
          return (
            <div key={i}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 10px', borderRadius: 8, background: isToday ? C.bellySoft + '80' : 'transparent', minHeight: 40 }}>
              <div style={{ flexShrink: 0, width: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.inkMute, textTransform: 'uppercase', letterSpacing: 0.5 }}>{dayNames[i]}</div>
                <div style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 600, color: isToday ? C.cream : C.warmDark, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? C.warmDark : 'transparent', marginTop: 2 }}>
                  {date.getDate()}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', paddingTop: 6 }}>
                {dayCtxs.map((ctx, j) => {
                  const cfg = QUICK_CONTEXT_CONFIG[ctx.context_type] || {}
                  return (
                    <div key={j} style={{ background: C.ochreSoft, border: `1px solid ${C.ochre}55`, borderRadius: 5, padding: '3px 8px', fontSize: 10.5, color: C.warmDark, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cfg.icon || '📅'} {ctx.description || cfg.label || ctx.context_type}
                    </div>
                  )
                })}
                {dayTasks.map(task => {
                  const imp  = task.importance || 'medium'
                  const bg   = impColor[imp] || C.ochre
                  const icon = impIcon[imp]  || '◆'
                  return (
                    <div key={task.id}
                      onClick={() => onTaskTap(task)}
                      style={{ background: bg, borderRadius: 5, padding: '4px 10px', fontSize: 11, color: C.cream, fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {icon} {task.name}
                    </div>
                  )
                })}
                {dayTasks.length === 0 && (
                  <button onClick={() => onAddTask(date)}
                    style={{ background: 'none', border: `1px dashed ${C.border}`, color: C.inkMute, padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: 0.6 }}>
                    + Add task
                  </button>
                )}
                {dayCtxs.length === 0 && (
                  <button onClick={() => onAddContext && onAddContext(date)}
                    style={{ background: 'none', border: `1px dashed ${C.border}`, color: C.inkMute, padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: 0.45 }}>
                    + Add context
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskDetailSheet({ task, onClose, onMarkDone, onSkip, onReschedule }) {
  const [translateY, setTranslateY] = useState(100)
  const touchRef    = useRef(null)
  const dateInputRef = useRef(null)

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setTranslateY(0))
    )
    return () => cancelAnimationFrame(id)
  }, [])

  function handleTouchStart(e) { touchRef.current = e.touches[0].clientY }
  function handleTouchMove(e) {
    if (touchRef.current == null) return
    const dy = e.touches[0].clientY - touchRef.current
    if (dy > 0) setTranslateY(dy)
  }
  function handleTouchEnd(e) {
    if (touchRef.current == null) return
    const dy = e.changedTouches[0].clientY - touchRef.current
    touchRef.current = null
    if (dy > 80) { onClose(); return }
    setTranslateY(0)
  }

  const cadenceLabel = task.learned_cadence_days
    ? `every ~${task.learned_cadence_days} days`
    : task.explicit_cadence_days
    ? `every ~${task.explicit_cadence_days} days`
    : 'unset'

  const lastDoneLabel = task.last_done_at
    ? new Date(task.last_done_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Never'

  const dueLabel = task.next_due_at
    ? parseDue(task.next_due_at)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '—'
    : '—'

  function reschedule(newDate) {
    onReschedule(task.id, newDate)
    onClose()
  }

  const quickDates = [
    { label: 'Today',   date: () => new Date() },
    { label: '+1 day',  date: () => addDays(new Date(), 1) },
    { label: '+3 days', date: () => addDays(new Date(), 3) },
    { label: '+1 week', date: () => addDays(new Date(), 7) },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: `${C.ink}66` }}/>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '16px 16px 0 0', padding: '12px 20px 32px', boxShadow: `0 -4px 24px ${C.ink}22`, transform: `translateY(${translateY}px)`, transition: translateY === 0 ? 'transform 0.3s ease-out' : 'none', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 16px' }}/>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, color: C.warmDark, marginBottom: 8 }}>{task.name}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {task.category && (
                <span style={{ background: C.sage, color: C.cream, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{task.category}</span>
              )}
              <ImportanceBadge importance={task.importance}/>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: C.inkMute, marginBottom: 2 }}>Due</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.rust }}>{dueLabel}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[{ label: 'Cadence', value: cadenceLabel }, { label: 'Last done', value: lastDoneLabel }].map(({ label, value }) => (
            <div key={label} style={{ background: C.bellySoft, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: C.inkMute, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.inkMute, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>Reschedule to</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {quickDates.map(({ label, date }) => (
              <button key={label} onClick={() => reschedule(date())}
                style={{ background: C.paper, border: `1.5px solid ${C.border}`, color: C.ink, padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
            <button
              onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
              style={{ background: C.paper, border: `1.5px solid ${C.border}`, color: C.ink, padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
              Pick date…
            </button>
            <input ref={dateInputRef} type="date"
              style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              onChange={e => { if (e.target.value) reschedule(new Date(e.target.value + 'T12:00:00')) }}/>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { onMarkDone(task); onClose() }}
            style={{ flex: 1, background: C.sage, color: C.cream, border: 'none', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✓ Mark Done
          </button>
          <button onClick={() => { onSkip(task); onClose() }}
            style={{ flex: 1, background: C.paper, color: C.inkSoft, border: `1.5px solid ${C.border}`, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↷ Skip
          </button>
        </div>
      </div>
    </div>
  )
}

function CalendarTab({ tasks, contexts, routines, recentSkips = [], onReschedule, onMarkDone, onSkip, onAddTask, onAddContext, onEditRoutine, onApplyRetroSuggestion }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [weekStart, setWeekStart]     = useState(startOfWeek(TODAY_DATE))
  const [detailTask, setDetailTask]   = useState(null)
  const [retroOpen, setRetroOpen]     = useState(false)

  useEffect(() => {
    const target = (weekStart.getFullYear() - TODAY_DATE.getFullYear()) * 12
      + (weekStart.getMonth() - TODAY_DATE.getMonth())
    setMonthOffset(target)
  }, [weekStart])

  function handleWeekOffsetChange(delta) {
    setWeekStart(ws => addDays(ws, delta * 7))
  }

  // Month being viewed in the strip — used for the retrospective pill below.
  const viewedMonthBase = new Date(TODAY_DATE.getFullYear(), TODAY_DATE.getMonth() + monthOffset, 1)
  const viewedPeriod = { year: viewedMonthBase.getFullYear(), monthIndex: viewedMonthBase.getMonth() }
  const viewedMonthLabel = viewedMonthBase.toLocaleDateString('en-US', { month: 'long' })
  const isPastMonth = monthOffset < 0
  const isCurrentMonth = monthOffset === 0
  const showRetroPill = isPastMonth || isCurrentMonth  // Hide for future months.
  const retrospective = retroOpen ? computeRetrospective(viewedPeriod, { tasks, routines, contexts, recentSkips }) : null

  return (
    <div>
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 16, boxShadow: C.shadowSoft }}>
        <MonthStrip
          tasks={tasks}
          monthOffset={monthOffset}
          selectedWeekStart={weekStart}
          onWeekSelect={setWeekStart}
          onMonthChange={delta => setMonthOffset(o => o + delta)}
        />
        {showRetroPill && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <button onClick={() => setRetroOpen(true)}
              style={{
                background: isPastMonth ? C.bellySoft : 'transparent',
                border: `1px solid ${isPastMonth ? C.warmDark + '55' : C.border}`,
                color: isPastMonth ? C.warmDark : C.inkMute,
                padding: '6px 14px', borderRadius: 999, fontSize: 12,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}>
              <span aria-hidden="true">📊</span>
              {isPastMonth ? `${viewedMonthLabel} retrospective →` : `${viewedMonthLabel} so far →`}
            </button>
          </div>
        )}
        <div style={{ borderTop: `1px solid ${C.hairline}`, margin: '12px 0' }}/>
        <WeekDetail
          tasks={tasks}
          weekStart={weekStart}
          contexts={contexts}
          routines={routines}
          onTaskTap={setDetailTask}
          onWeekOffsetChange={handleWeekOffsetChange}
          onAddTask={onAddTask}
          onAddContext={onAddContext}
          onEditRoutine={onEditRoutine}
        />
      </div>
      <div style={{ padding: '12px 16px', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: C.shadowSoft }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Legend</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ImportanceBadge importance="low"/>
          <ImportanceBadge importance="medium"/>
          <ImportanceBadge importance="high"/>
        </div>
      </div>
      {detailTask && (
        <TaskDetailSheet
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onMarkDone={onMarkDone}
          onSkip={onSkip}
          onReschedule={onReschedule}
        />
      )}
      {retroOpen && (
        <RetrospectiveSheet retrospective={retrospective} onClose={() => setRetroOpen(false)} onApplySuggestion={onApplyRetroSuggestion}/>
      )}
    </div>
  )
}

// ── HeedFAB ────────────────────────────────────────────────────
function SpeedDialItem({ label, sublabel, icon, iconBg, iconFg, onClick, delay = 0 }) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'heed-slideRight 0.25s cubic-bezier(0.34,1.56,0.64,1) both', animationDelay: `${delay}ms` }}>
      <div style={{ background: C.paperHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', boxShadow: C.shadowMed, textAlign: 'right', minWidth: 140 }}>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 14, fontWeight: 600, color: C.warmDark, lineHeight: 1.1 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.inkMute, fontStyle: 'italic', marginTop: 2 }}>{sublabel}</div>
      </div>
      <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-label={label}
        style={{ width: 48, height: 48, borderRadius: '50%', background: iconBg, border: `2px solid ${C.cream}`, color: iconFg, fontSize: 24, fontWeight: 700, cursor: 'pointer', boxShadow: hover ? '0 8px 22px rgba(124,83,51,0.30)' : '0 4px 12px rgba(124,83,51,0.20)', transform: hover ? 'translateY(-2px) scale(1.06)' : 'none', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'inherit', flexShrink: 0 }}>
        {icon}
      </button>
    </div>
  )
}

function HeedFAB({ onAddTask, onAskHeed, onAddRoutine }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])
  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(44,24,16,0.18)', animation: 'heed-fadeIn 0.18s ease' }}/>}
      {open && (
        <div style={{ position: 'fixed', bottom: 96, right: 28, zIndex: 51, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <SpeedDialItem label="Add a task" sublabel="Track something new" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" stroke="currentColor" strokeWidth="1.9"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>} iconBg={C.ochre} iconFg={C.warmDeep} onClick={() => { setOpen(false); onAddTask() }} delay={0}/>
          <SpeedDialItem label="Build a routine" sublabel="A cluster of things together" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 2l4 4-4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/><path d="M7 22l-4-4 4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>} iconBg={C.sage} iconFg={C.cream} onClick={() => { setOpen(false); onAddRoutine() }} delay={50}/>
          <SpeedDialItem label="Ask Heed" sublabel="Get answers from anywhere" icon={<MayaOwl size={22} idle={false}/>} iconBg={C.bellySoft} iconFg={C.warmDark} onClick={() => { setOpen(false); onAskHeed() }} delay={100}/>
        </div>
      )}
      <button className="heed-fab-btn" onClick={() => setOpen(o => !o)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        aria-label={open ? 'Close menu' : 'Open Heed menu'} aria-expanded={open}
        style={{ position: 'fixed', bottom: 28, right: 28, width: 52, height: 52, borderRadius: '50%', border: 'none', background: `radial-gradient(circle at 35% 30%, ${C.warm} 0%, ${C.warmDark} 70%, ${C.warmDeep} 100%)`, cursor: 'pointer', boxShadow: (hover || open) ? '0 12px 32px rgba(124,83,51,0.35), 0 0 0 6px rgba(212,162,76,0.15)' : '0 6px 18px rgba(124,83,51,0.30)', transform: open ? 'rotate(45deg) scale(1.05)' : hover ? 'translateY(-3px) scale(1.05)' : 'none', transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 52 }}>
        <div style={{ position: 'relative', animation: (hover && !open) ? 'heed-bob 0.6s ease-in-out infinite' : 'none', transform: open ? 'rotate(-45deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <MayaOwl size={32} idle={false}/>
        </div>
        <div style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: open ? C.rust : C.ochre, color: open ? C.cream : C.warmDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', border: `2px solid ${C.cream}`, transition: 'background 0.2s' }}>+</div>
      </button>
    </>
  )
}

// ── AskInlineModal ─────────────────────────────────────────────
function AskInlineModal({ open, onClose, onLightenRoutine }) {
  const { messages, input, setInput, thinking, streaming, busy, send, executeAction } = useChat({ onLightenRoutine })
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const { listening, toggle: toggleMic, supported: micSupported } = useMic(useCallback((text, isFinal) => { if (isFinal) send(text) }, [send]))
  useEffect(() => { if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100) }, [open])
  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, thinking, streaming])
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(4px)', animation: 'heed-fadeIn 0.2s ease' }}/>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, display: 'flex', justifyContent: 'center', animation: 'heed-slideUp 0.3s cubic-bezier(0.16,1,0.3,1)', pointerEvents: 'none' }}>
        <div style={{ background: C.paperHi, width: '100%', maxWidth: 560, margin: '0 16px 16px 16px', borderRadius: '20px 20px 14px 14px', padding: '20px 22px 16px 22px', boxShadow: '0 -8px 40px rgba(124,83,51,0.25)', border: `1px solid ${C.border}`, pointerEvents: 'auto', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', background: `radial-gradient(circle, ${C.ochreSoft} 0%, transparent 70%)`, animation: 'heed-breathe 4s ease-in-out infinite' }}/>
              <div style={{ position: 'relative' }}><MayaOwl size={40} mood={busy ? 'thinking' : 'calm'} speaking={busy} idle={!busy}/></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 17, fontWeight: 600, color: C.warmDark, letterSpacing: -0.2, lineHeight: 1.1, marginBottom: 2 }}>Ask Heed</div>
              <div style={{ fontSize: 11.5, color: C.inkMute, fontStyle: 'italic' }}>Quick chat — your answer in a moment</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.inkMute, cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginBottom: 12, minHeight: messages.length === 0 ? 'auto' : 200 }}>
            {messages.length === 0 && !busy && (
              <>
                <div style={{ fontSize: 13, color: C.inkSoft, fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>
                  Pick one to start, or just type.
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={s.text} onClick={() => send(s.text)} disabled={busy}
                      style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.warmDark, padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, animation: 'heed-fadeUp 0.3s ease both', animationDelay: `${i * 60}ms`, transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.bellySoft }}
                      onMouseLeave={e => { e.currentTarget.style.background = C.paper }}
                    >
                      <span style={{ fontSize: 13 }}>{s.emoji}</span>{s.text}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content}
                actions={m.actions} chips={m.chips}
                onConfirm={(actionIndex) => executeAction(i, actionIndex)}
                onChipClick={(text) => send(text)}
              />
            ))}
            {thinking !== null && <ThinkingBubble steps={thinking}/>}
            {streaming && <Bubble role="assistant" content={streaming} streaming/>}
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: messages.length > 0 ? `1px solid ${C.hairline}` : 'none', flexShrink: 0, alignItems: 'center' }}>
            {micSupported && <MicButton listening={listening} onToggle={toggleMic} disabled={busy}/>}
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(input)} placeholder={listening ? 'Listening…' : 'Ask Heed anything…'} disabled={busy}
              style={{ flex: 1, background: C.paper, border: `1.5px solid ${listening ? '#e53e3e' : C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
              onFocus={e => { e.target.style.borderColor = C.warmDark }} onBlur={e => { if (!listening) e.target.style.borderColor = C.border }}
            />
            <button onClick={() => send(input)} disabled={busy || !input.trim()} style={{ ...getBtnPrimary(), padding: '10px 18px', fontSize: 13, opacity: (busy || !input.trim()) ? 0.5 : 1 }}>Send</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── AddTaskModal ───────────────────────────────────────────────
function AddTaskModal({ open, onClose, onSubmit, onDelete, initialData = null, customCategories = [] }) {
  const isEdit = !!initialData
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  useEffect(() => { if (!open) { setConfirmingDelete(false); setShowImportanceInfo(false) } }, [open])
  const [name, setName] = useState('')
  const [category, setCategory] = useState('home')
  const [importance, setImportance] = useState('medium')
  const [cadenceMode, setCadenceMode] = useState('learn')
  const [cadenceDays, setCadenceDays] = useState(7)
  const [cadenceTouched, setCadenceTouched] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [description, setDescription] = useState('')
  const [showImportanceInfo, setShowImportanceInfo] = useState(false)
  const importanceInfoRef = useRef(null)
  useEffect(() => {
    if (!showImportanceInfo) return
    const handler = (e) => {
      if (importanceInfoRef.current && !importanceInfoRef.current.contains(e.target)) {
        setShowImportanceInfo(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showImportanceInfo])
  const inputRef = useRef(null)
  useEffect(() => {
    if (!open) return
    if (initialData) {
      setName(initialData.name || '')
      setCategory(initialData.category || 'home')
      setImportance(initialData.importance || 'medium')
      const explicit = initialData.explicit_cadence_days
      setCadenceMode(explicit ? 'set' : 'learn')
      setCadenceDays(explicit || 7)
      setCadenceTouched(true)  // existing task — don't override
      setDueDate(initialData.dueDate || '')
      setDueTime(initialData.dueTime || '')
      setDescription(initialData.description || '')
    } else {
      setName(''); setCategory('home'); setImportance('medium'); setCadenceMode('learn'); setCadenceDays(7); setDueDate(''); setDueTime(''); setDescription('')
      setCadenceTouched(false)
    }
    if (inputRef.current) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, initialData])
  // Auto-suggest cadence from the task name as the user types — only when
  // they haven't already touched the cadence picker. New tasks only.
  const cadenceSuggestion = !isEdit ? suggestCadence(name) : null
  useEffect(() => {
    if (isEdit || cadenceTouched || !cadenceSuggestion) return
    setCadenceMode('set')
    setCadenceDays(cadenceSuggestion.days)
  }, [cadenceSuggestion?.days, isEdit, cadenceTouched])
  const markCadenceTouched = () => setCadenceTouched(true)
  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  const submit = () => {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      category,
      importance,
      explicit_cadence_days: cadenceMode === 'set' ? cadenceDays : null,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      description: description.trim() || null,
    }
    if (isEdit) payload.id = initialData.id
    onSubmit(payload)
    onClose()
  }
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(4px)', animation: 'heed-fadeIn 0.2s ease' }}/>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, display: 'flex', justifyContent: 'center', animation: 'heed-slideUp 0.3s cubic-bezier(0.16,1,0.3,1)', pointerEvents: 'none' }}>
        <div style={{ background: C.paperHi, width: '100%', maxWidth: 520, margin: '0 16px 16px 16px', borderRadius: '20px 20px 14px 14px', padding: '22px 22px 18px 22px', boxShadow: '0 -8px 40px rgba(124,83,51,0.25)', border: `1px solid ${C.border}`, pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.ochreSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MayaOwl size={28} idle={false}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 19, fontWeight: 600, color: C.warmDark, letterSpacing: -0.3, lineHeight: 1.1, marginBottom: 2 }}>{isEdit ? 'Edit task' : 'What should I help you remember?'}</div>
              <div style={{ fontSize: 12, color: C.inkMute, fontStyle: 'italic' }}>{isEdit ? 'Update the details below.' : "I'll figure out the best schedule for it."}</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.inkMute, cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={getFieldLabel()}>Task name</label>
            <input ref={inputRef} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="e.g. Clean the aircon filter"
              style={{ width: '100%', boxSizing: 'border-box', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
              onFocus={e => { e.target.style.borderColor = C.warmDark }} onBlur={e => { e.target.style.borderColor = C.border }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={getFieldLabel()}>Category</label>
            <CategoryDropdown
              value={category}
              onChange={setCategory}
              options={[
                ...Object.keys(CATEGORY).map(id => ({
                  id,
                  label: id.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  color: CATEGORY[id].color,
                  bg: CATEGORY[id].bg,
                  icon: CATEGORY[id].icon,
                })),
                ...customCategories.map(cat => ({
                  id: cat.id,
                  label: cat.name,
                  color: cat.color || C.warmDark,
                  bg: (cat.color || C.warmDark) + '22',
                  icon: cat.icon,
                })),
              ]}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }} ref={importanceInfoRef}>
              <label style={getFieldLabel()}>How important?</label>
              <button
                onClick={() => setShowImportanceInfo(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: C.inkMute, lineHeight: 1 }}
                aria-label="What do importance levels mean?"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="6.5" fill="none" stroke={C.inkMute} strokeWidth="1.5"/>
                  <text x="7.5" y="11.5" textAnchor="middle" fontSize="9" fontWeight="700" fill={C.inkMute} fontFamily="inherit">?</text>
                </svg>
              </button>
              {showImportanceInfo && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30,
                  background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10,
                  padding: '10px 14px', boxShadow: C.shadowMed, minWidth: 230,
                  animation: 'heed-fadeIn 0.15s ease',
                }}>
                  {[
                    { label: 'Low',    color: C.sage,  desc: 'Do it when you have a free window' },
                    { label: 'Medium', color: C.ochre, desc: 'Should happen this week' },
                    { label: 'High',   color: C.rust,  desc: 'Must happen — urgent or critical' },
                  ].map(({ label, color, desc }, i, arr) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: i < arr.length - 1 ? 6 : 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color, minWidth: 46 }}>{label}</span>
                      <span style={{ fontSize: 12, color: C.inkMute, lineHeight: 1.4 }}>{desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'low',    tone: C.sage  },
                { v: 'medium', tone: C.ochre },
                { v: 'high',   tone: C.rust  },
              ].map(({ v, tone }) => (
                <button key={v} onClick={() => setImportance(v)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: tone, color: C.cream,
                    padding: '10px 6px', borderRadius: 10,
                    fontSize: 13,
                    fontWeight: v === 'high' ? 700 : v === 'medium' ? 500 : 400,
                    border: importance === v ? `2.5px solid ${C.cream}` : '2.5px solid transparent',
                    boxShadow: importance === v
                      ? (v === 'high' ? `0 0 0 2px ${tone}, 0 3px 10px ${tone}50` : `0 0 0 2px ${tone}`)
                      : 'none',
                    opacity: importance === v ? 1 : 0.5,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {v === 'low' && (
                      <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
                        <circle cx="6.5" cy="6.5" r="5" fill="none" stroke={C.cream} strokeWidth="2"/>
                      </svg>
                    )}
                    {v === 'medium' && (
                      <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
                        <polygon points="6.5,1.5 11.5,6.5 6.5,11.5 1.5,6.5" fill={C.cream}/>
                      </svg>
                    )}
                    {v === 'high' && (
                      <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
                        <circle cx="6.5" cy="6.5" r="5.5" fill={C.cream}/>
                      </svg>
                    )}
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={getFieldLabel()}>How often?</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button onClick={() => { setCadenceMode('learn'); markCadenceTouched() }} style={{ flex: 1, background: cadenceMode === 'learn' ? C.bellySoft : C.paper, color: cadenceMode === 'learn' ? C.warmDark : C.inkSoft, border: `1.5px solid ${cadenceMode === 'learn' ? C.warmDark + '66' : C.border}`, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s' }}>
                <span style={{ color: C.sage }}>✨</span>Let Heed learn it
              </button>
              <button onClick={() => { setCadenceMode('set'); markCadenceTouched() }} style={{ flex: 1, background: cadenceMode === 'set' ? C.bellySoft : C.paper, color: cadenceMode === 'set' ? C.warmDark : C.inkSoft, border: `1.5px solid ${cadenceMode === 'set' ? C.warmDark + '66' : C.border}`, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>I'll set it</button>
            </div>
            {!cadenceTouched && cadenceSuggestion && cadenceMode === 'set' && (
              <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic', marginBottom: 8, paddingLeft: 2 }}>
                ✨ Suggested {formatCadence(cadenceSuggestion.days)} — {cadenceSuggestion.reason}.
              </div>
            )}
            {cadenceMode === 'set' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bellySoft, padding: '10px 14px', borderRadius: 8, animation: 'heed-fadeIn 0.2s ease' }}>
                <span style={{ fontSize: 13, color: C.warmDark }}>Every</span>
                <input type="number" min="1" max="365" value={cadenceDays} onChange={e => { setCadenceDays(Math.max(1, Number(e.target.value)||1)); markCadenceTouched() }}
                  style={{ width: 60, padding: '5px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, textAlign: 'center', fontFamily: 'inherit', color: C.ink, background: C.paper }}
                />
                <span style={{ fontSize: 13, color: C.warmDark }}>day{cadenceDays===1?'':'s'}</span>
                <div style={{ flex: 1, fontSize: 11, color: C.inkMute, fontStyle: 'italic', textAlign: 'right' }}>
                  {[1,7,14,30].map(n => <button key={n} onClick={() => { setCadenceDays(n); markCadenceTouched() }} style={{ background: 'transparent', border: 'none', color: C.warmDark, fontWeight: 600, cursor: 'pointer', padding: '0 4px', fontFamily: 'inherit', fontSize: 11 }}>{n}d</button>)}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={getFieldLabel()}>Due date & time <span style={{ fontWeight: 400, color: C.inkMute, fontStyle: 'italic' }}>(optional)</span></label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <DateField value={dueDate} onChange={setDueDate} placeholder="Pick a date"/>
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} disabled={!dueDate}
                style={{ flex: '0 0 110px', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: dueTime ? C.ink : C.inkMute, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s', opacity: dueDate ? 1 : 0.4 }}
                onFocus={e => { e.target.style.borderColor = C.warmDark }} onBlur={e => { e.target.style.borderColor = C.border }}
              />
            </div>
            {(dueDate || dueTime) && (
              <button onClick={() => { setDueDate(''); setDueTime('') }} style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 11.5, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>Clear</button>
            )}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={getFieldLabel()}>Notes <span style={{ fontWeight: 400, color: C.inkMute, fontStyle: 'italic' }}>(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Anything to remember about this — supplier, account number, why it matters…"
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: C.ink, outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 56, transition: 'border-color 0.15s' }}
              onFocus={e => { e.target.style.borderColor = C.warmDark }} onBlur={e => { e.target.style.borderColor = C.border }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            {isEdit && onDelete && (
              <button
                onClick={() => setConfirmingDelete(true)}
                style={{ background: 'transparent', border: `1px solid ${C.rust}66`, color: C.rust, padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginRight: 'auto' }}
              >
                Delete
              </button>
            )}
            <button onClick={onClose} style={getBtnGhost()}>Cancel</button>
            <button onClick={submit} disabled={!name.trim()} style={{ ...getBtnPrimary(), padding: '8px 18px', opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>{isEdit ? 'Save changes' : 'Add task'}</button>
          </div>
        </div>
      </div>
      {confirmingDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setConfirmingDelete(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', animation: 'heed-fadeIn 0.18s ease' }}/>
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', animation: 'heed-slideUp 0.28s cubic-bezier(0.16,1,0.3,1)', pointerEvents: 'none' }}>
            <div style={{ background: C.paperHi, width: '100%', maxWidth: 440, margin: '0 16px 16px 16px', borderRadius: '20px 20px 14px 14px', padding: '22px 22px 18px 22px', boxShadow: '0 -8px 40px rgba(0,0,0,0.35)', border: `1px solid ${C.border}`, pointerEvents: 'auto' }}>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, color: C.warmDark, marginBottom: 6 }}>
                Remove "{initialData?.name || 'this task'}"?
              </div>
              <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, marginBottom: 18 }}>
                This can't be undone. The task and its history will be removed.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmingDelete(false)} style={getBtnGhost()}>Cancel</button>
                <button
                  onClick={() => { setConfirmingDelete(false); onDelete(initialData); onClose() }}
                  style={{ background: C.rust, color: C.cream, border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── AddContextModal ────────────────────────────────────────────
function AddContextModal({ open, onClose, onSubmit }) {
  const [type, setType] = useState('travel')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const descRef = useRef(null)
  useEffect(() => { if (open && descRef.current) setTimeout(() => descRef.current?.focus(), 50) }, [open])
  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  useEffect(() => { if (startDate && !endDate) setEndDate(startDate) }, [startDate, endDate])
  const isValid = description.trim() && startDate && endDate && (new Date(endDate) >= new Date(startDate))
  const submit = () => {
    if (!isValid) return
    onSubmit({ type, description: description.trim(), notes: notes.trim() || null, startDate, endDate })
    setType('travel'); setStartDate(''); setEndDate(''); setDescription(''); setNotes('')
    onClose()
  }
  if (!open) return null
  const typeOptions = [
    { v: 'travel', label: 'Travel', icon: '🗺️', tone: C.ochre },
    { v: 'illness', label: 'Illness', icon: '🌿', tone: C.rust },
    { v: 'busy', label: 'Busy week', icon: '🌾', tone: C.warmDark },
    { v: 'celebration', label: 'Celebration', icon: '🌸', tone: C.rose },
  ]
  const inputStyle = { width: '100%', boxSizing: 'border-box', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(4px)', animation: 'heed-fadeIn 0.2s ease' }}/>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, display: 'flex', justifyContent: 'center', animation: 'heed-slideUp 0.3s cubic-bezier(0.16,1,0.3,1)', pointerEvents: 'none' }}>
        <div style={{ background: C.paperHi, width: '100%', maxWidth: 520, margin: '0 16px 16px 16px', borderRadius: '20px 20px 14px 14px', padding: '22px 22px 18px 22px', boxShadow: '0 -8px 40px rgba(124,83,51,0.25)', border: `1px solid ${C.border}`, pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.bellySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MayaOwl size={28} idle={false}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 19, fontWeight: 600, color: C.warmDark, letterSpacing: -0.3, lineHeight: 1.1, marginBottom: 2 }}>What's coming up?</div>
              <div style={{ fontSize: 12, color: C.inkMute, fontStyle: 'italic' }}>I'll plan around it. No nag, no missed-pattern flags.</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.inkMute, cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={getFieldLabel()}>Type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {typeOptions.map(({v,label,icon,tone}) => (
                <button key={v} onClick={() => setType(v)} style={{ flex: 1, minWidth: 100, background: type === v ? tone : C.paper, color: type === v ? C.cream : C.inkSoft, border: `1.5px solid ${type === v ? tone : C.border}`, padding: '8px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={getFieldLabel()}>What's happening?</label>
            <input ref={descRef} value={description} onChange={e => setDescription(e.target.value)} onKeyDown={e => e.key === 'Enter' && isValid && submit()}
              placeholder={type==='travel'?"e.g. Singapore for DEF CON":type==='illness'?"e.g. Flu, taking it easy":type==='busy'?"e.g. Client deadline week":"e.g. Tita's 60th birthday weekend"}
              style={inputStyle} onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
            />
          </div>
          <div style={{ marginBottom: 14, display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={getFieldLabel()}>From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }}/>
            </div>
            <div style={{ flex: 1 }}>
              <label style={getFieldLabel()}>To</label>
              <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }}/>
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={getFieldLabel()}>Notes <span style={{ fontWeight: 400, color: C.inkMute, fontStyle: 'italic' }}>(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra details…"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={getBtnGhost()}>Cancel</button>
            <button onClick={submit} disabled={!isValid} style={{ ...getBtnPrimary(), padding: '8px 18px', opacity: isValid ? 1 : 0.5, cursor: isValid ? 'pointer' : 'not-allowed' }}>Add context</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── AddRoutineModal (simplified) ───────────────────────────────
function AddRoutineModal({ open, onClose, onSubmit, initialData = null, seedTask = null, tasks = [] }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ id: 1, name: '' }])
  const [openPickerIndex, setOpenPickerIndex] = useState(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const nameRef = useRef(null)
  const inputStyle = { flex: 1, minWidth: 0, background: C.paper, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, color: C.ink, outline: 'none', fontFamily: 'inherit' }
  function filteredTasks() {
    const q = pickerSearch.toLowerCase()
    return tasks.filter(t => t.name.toLowerCase().includes(q))
  }

  function pickTask(idx, task) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, name: task.name } : it))
    setOpenPickerIndex(null)
    setPickerSearch('')
  }

  useEffect(() => {
    if (!open) return
    setOpenPickerIndex(null)
    setPickerSearch('')
    if (initialData) {
      setName(initialData.name || '')
      setNotes(initialData.notes || '')
      setItems(initialData.items?.map((item, i) => ({ id: i + 1, name: item })) || [{ id: 1, name: '' }])
      setStartDate(initialData.startDate || '')
      setEndDate(initialData.endDate || '')
    } else if (seedTask) {
      setName('')
      setNotes('')
      setItems([{ id: 1, name: seedTask.name }, { id: 2, name: '' }])
      setStartDate(''); setEndDate('')
    } else {
      setName(''); setNotes(''); setItems([{ id: 1, name: '' }]); setStartDate(''); setEndDate('')
    }
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [open])
  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  const addItem = () => setItems(i => [...i, { id: Math.max(...i.map(x=>x.id))+1, name: '' }])
  const removeItem = (id) => { if (items.length > 1) setItems(i => i.filter(x => x.id !== id)) }
  const updateItem = (id, val) => setItems(i => i.map(x => x.id===id ? {...x, name: val} : x))
  const submit = () => {
    if (!name.trim()) return
    const validItems = items.filter(i => i.name.trim())
    if (!validItems.length) return
    const dateRange = { startDate: startDate || null, endDate: endDate || null }
    if (initialData) {
      onSubmit({ ...initialData, name: name.trim(), notes: notes.trim() || null, items: validItems.map(i => i.name.trim()), ...dateRange })
    } else {
      onSubmit({ id: `custom_${Date.now()}`, name: name.trim(), notes: notes.trim() || null, schedule: 'Custom', items: validItems.map(i => i.name.trim()), completion14d: Array(14).fill(false), insight: 'Just added — building up history.', suggestion: null, weekRate: 'no data yet', ...dateRange })
    }
    onClose()
  }
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(4px)', animation: 'heed-fadeIn 0.2s ease' }}/>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, display: 'flex', justifyContent: 'center', animation: 'heed-slideUp 0.3s cubic-bezier(0.16,1,0.3,1)', pointerEvents: 'none' }}>
        <div style={{ background: C.paperHi, width: '100%', maxWidth: 520, margin: '0 16px 16px 16px', borderRadius: '20px 20px 14px 14px', padding: '22px 22px 18px 22px', boxShadow: '0 -8px 40px rgba(124,83,51,0.25)', border: `1px solid ${C.border}`, pointerEvents: 'auto', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexShrink: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.bellySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MayaOwl size={28} idle={false}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 19, fontWeight: 600, color: C.warmDark, letterSpacing: -0.3, lineHeight: 1.1, marginBottom: 2 }}>{initialData ? 'Edit routine' : 'Build a routine'}</div>
              <div style={{ fontSize: 12, color: C.inkMute, fontStyle: 'italic' }}>{initialData ? 'Update name or items.' : 'A cluster of things that happen together.'}</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.inkMute, cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={getFieldLabel()}>Routine name</label>
              <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning routine, Sunday reset"
                style={{ width: '100%', boxSizing: 'border-box', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={getFieldLabel()}>Notes <span style={{ fontWeight: 400, color: C.inkMute, fontStyle: 'italic' }}>(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any context or reminders for this routine…"
                rows={2}
                style={{ width: '100%', boxSizing: 'border-box', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.ink, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s', resize: 'vertical' }}
                onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={getFieldLabel()}>Items in this routine</label>
              {items.map((item, idx) => {
                const ft = openPickerIndex === idx ? filteredTasks() : []
                return (
                <div key={item.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: openPickerIndex === idx ? 0 : 6 }}>
                    <input value={item.name} onChange={e => updateItem(item.id, e.target.value)} placeholder={`Item ${idx+1} (e.g. ${['Stretch 5 min','Vitamins','Read 10 pages'][idx]||'...'})`} style={inputStyle}/>
                    <button onClick={() => { setOpenPickerIndex(openPickerIndex === idx ? null : idx); setPickerSearch('') }} type="button" aria-label={openPickerIndex === idx ? 'Close task picker' : 'Pick a task'} style={{ background: 'transparent', border: 'none', color: openPickerIndex === idx ? C.ochre : C.border, cursor: 'pointer', fontSize: 15, padding: '0 4px', lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}>📎</button>
                    <button onClick={() => { setOpenPickerIndex(null); removeItem(item.id) }} disabled={items.length===1} style={{ background: 'transparent', border: 'none', color: items.length===1 ? C.hairline : C.inkMute, cursor: items.length===1 ? 'not-allowed' : 'pointer', fontSize: 16, padding: '0 6px', lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}>×</button>
                  </div>
                  {openPickerIndex === idx && (
                    <div style={{ border: `1.5px solid ${C.ochre}`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: C.paperHi, marginBottom: 6, maxHeight: 180, overflowY: 'auto', animation: 'heed-dropdown 0.15s ease' }}>
                      <input
                        autoFocus
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                        placeholder="Search tasks…"
                        style={{ width: '100%', border: 'none', borderBottom: `1px solid ${C.hairline}`, padding: '7px 10px', fontSize: 12.5, outline: 'none', background: C.paper, fontFamily: 'inherit', boxSizing: 'border-box', position: 'sticky', top: 0 }}
                      />
                      {ft.map(task => (
                        <button key={task.id} onClick={() => pickTask(idx, task)} type="button"
                          style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: `1px solid ${C.hairline}`, width: '100%', background: 'none', fontFamily: 'inherit', textAlign: 'left' }}>
                          <span style={{ color: C.ink, fontSize: 13 }}>{task.name}</span>
                          <span style={{ color: C.inkMute, fontSize: 11 }}>{task.category}</span>
                        </button>
                      ))}
                      {ft.length === 0 && (
                        <div style={{ padding: '10px', color: C.inkMute, fontSize: 12.5, textAlign: 'center' }}>No tasks match</div>
                      )}
                    </div>
                  )}
                </div>
                )
              })}
              <button onClick={addItem} style={{ background: 'transparent', color: C.warmDark, border: `1.5px dashed ${C.border}`, padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%', transition: 'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.warmDark;e.currentTarget.style.background=C.bellySoft}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background='transparent'}}
              >+ Add another item</button>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={getFieldLabel()}>Date range <span style={{ fontWeight: 400, color: C.inkMute, fontStyle: 'italic' }}>(optional)</span></label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: startDate ? C.ink : C.inkMute, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
                />
                <span style={{ color: C.inkMute, fontSize: 12, flexShrink: 0 }}>to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined}
                  style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: endDate ? C.ink : C.inkMute, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                  onFocus={e=>{e.target.style.borderColor=C.warmDark}} onBlur={e=>{e.target.style.borderColor=C.border}}
                />
              </div>
              {(startDate || endDate) && (
                <button onClick={() => { setStartDate(''); setEndDate('') }} style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 11.5, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>Clear dates</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${C.hairline}`, flexShrink: 0 }}>
            <button onClick={onClose} style={getBtnGhost()}>Cancel</button>
            <button onClick={submit} disabled={!name.trim()||items.every(i=>!i.name.trim())} style={{ ...getBtnPrimary(), padding: '8px 18px', opacity: (name.trim()&&items.some(i=>i.name.trim())) ? 1 : 0.5, cursor: (name.trim()&&items.some(i=>i.name.trim())) ? 'pointer' : 'not-allowed' }}>{initialData ? 'Save changes' : 'Build routine'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ message, onView, onUndo, onDismiss, reasons, onReason }) {
  const [picked, setPicked] = useState(null)
  const hasSecondRow = (reasons && reasons.length > 0) || onUndo || onView
  // Outer wrapper handles centering (translateX(-50%) on a fixed element).
  // Inner wrapper runs the slide-up animation. Splitting them is required
  // because the keyframe animates `transform`, which would otherwise wipe
  // out the centering — making the toast slide in from the right edge then
  // snap to center when the animation ends.
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, maxWidth: 'calc(100vw - 32px)',
    }}>
      <div style={{
        background: '#222B33', border: '1px solid #2A3540', borderLeft: `3px solid ${C.sage}`,
        borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
        animation: 'heed-toast-up 0.32s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column', gap: 8,
        minWidth: 240,
      }}>
        {/* Row 1 — message + dismiss */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>✓</span>
          <span style={{ fontSize: 13, color: '#e8e0d0', fontWeight: 500, flex: 1 }}>{message}</span>
          <button onClick={onDismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: C.inkMute, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>
        {/* Row 2 — chips + Undo/View, when present */}
        {hasSecondRow && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            {reasons && reasons.length > 0 && reasons.map(r => {
              const isPicked = picked === r.value
              return (
                <button key={r.value} onClick={() => { if (picked) return; setPicked(r.value); onReason?.(r.value) }}
                  style={{
                    background: isPicked ? C.sage + '33' : 'transparent',
                    border: `1px solid ${isPicked ? C.sage : C.inkMute}`,
                    color: isPicked ? C.sage : C.inkSoft,
                    padding: '3px 9px', borderRadius: 999, fontSize: 11,
                    cursor: picked ? 'default' : 'pointer', fontWeight: 600, fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}>
                  {isPicked ? '✓ ' : ''}{r.label}
                </button>
              )
            })}
            {onUndo && (
              <button onClick={onUndo} style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${C.inkMute}`, color: C.inkSoft, padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Undo</button>
            )}
            {onView && (
              <button onClick={onView} style={{ marginLeft: onUndo ? 4 : 'auto', background: 'transparent', border: `1px solid ${C.sage}`, color: C.sage, padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>View Tracks</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── RetrospectiveSheet ─────────────────────────────────────────
// Phase 1: client-side computed retrospective. See computeRetrospective().
// Phase 2: rule-based patterns + suggestion buttons wired via onApplySuggestion.
function RetrospectiveSheet({ retrospective, onClose, onApplySuggestion }) {
  const [translateY, setTranslateY] = useState(100)
  const [appliedIds, setAppliedIds] = useState(() => new Set())
  const [pendingId, setPendingId] = useState(null)
  const touchRef = useRef(null)
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setTranslateY(0))
    )
    return () => cancelAnimationFrame(id)
  }, [])
  function handleTouchStart(e) { touchRef.current = e.touches[0].clientY }
  function handleTouchMove(e) {
    if (touchRef.current == null) return
    const dy = e.touches[0].clientY - touchRef.current
    if (dy > 0) setTranslateY(dy)
  }
  function handleTouchEnd(e) {
    if (touchRef.current == null) return
    const dy = e.changedTouches[0].clientY - touchRef.current
    touchRef.current = null
    if (dy > 80) { onClose(); return }
    setTranslateY(0)
  }
  if (!retrospective) return null
  const r = retrospective
  const ratePct = Math.round(r.completion_rate * 100)
  const sectionLabel = (text) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase', margin: '20px 0 10px' }}>{text}</div>
  )
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: `${C.ink}66` }}/>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '16px 16px 0 0', padding: '12px 20px calc(32px + env(safe-area-inset-bottom))', boxShadow: `0 -4px 24px ${C.ink}22`, transform: `translateY(${translateY}px)`, transition: translateY === 0 ? 'transform 0.3s ease-out' : 'none', maxHeight: '88vh', overflowY: 'auto' }}
      >
        <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 16px' }}/>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.inkMute, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
          {r.period_label}{r.is_partial ? ' · so far' : ''}
        </div>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 600, color: C.warmDark, lineHeight: 1.25, marginBottom: 16 }}>
          {r.headline}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'complete', value: `${ratePct}%`, tone: ratePct >= 80 ? C.sage : ratePct >= 50 ? C.ochre : C.rust },
            { label: 'done',     value: r.completions, tone: C.warmDark },
            { label: 'skipped',  value: r.skips,       tone: C.inkSoft },
          ].map(t => (
            <div key={t.label} style={{ background: C.bellySoft, borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 700, color: t.tone, lineHeight: 1.1 }}>{t.value}</div>
              <div style={{ fontSize: 10, color: C.inkMute, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 }}>{t.label}</div>
            </div>
          ))}
        </div>
        {r.routines.length > 0 && (
          <>
            {sectionLabel('Routines')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {r.routines.map(rt => {
                const pct = Math.round(rt.completion_rate * 100)
                return (
                  <div key={rt.routine_id} style={{ background: C.sage + '14', border: `1px solid ${C.sage}22`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <div style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 600, color: C.ink }}>{rt.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: pct >= 80 ? C.sage : pct >= 50 ? C.ochre : C.rust }}>
                        {rt.days_completed}/{rt.days_due} · {pct}%
                      </div>
                    </div>
                    {rt.note && <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.4 }}>{rt.note}</div>}
                    {rt.best_streak > 0 && (
                      <div style={{ fontSize: 11, color: C.inkMute, marginTop: 4 }}>Best streak: {rt.best_streak} days</div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {r.cadence_changes.length > 0 && (
          <>
            {sectionLabel('What I learned')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.cadence_changes.map(c => {
                let line
                if (c.before_days == null) {
                  line = <>— every <strong>~{c.after_days}d</strong>. {c.cycles_observed} cycle{c.cycles_observed === 1 ? '' : 's'}, {c.confidence} confidence.</>
                } else if (c.after_days > c.before_days) {
                  line = <>— stretched from ~{c.before_days}d to <strong>~{c.after_days}d</strong>.</>
                } else if (c.after_days < c.before_days) {
                  line = <>— tightened from ~{c.before_days}d to <strong>~{c.after_days}d</strong>.</>
                } else {
                  line = <>— stable at <strong>~{c.after_days}d</strong>.</>
                }
                return (
                  <div key={c.task_id} style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600 }}>{c.task_name}</span> {line}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {r.needs_attention.length > 0 && (
          <>
            {sectionLabel('Worth attention')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.needs_attention.map(a => {
                const sid = `adjust-${a.task_id}`
                const applied = appliedIds.has(sid)
                const pending = pendingId === sid
                const canApply = a.suggested_action === 'adjust_cadence' && a.suggested_payload?.new_cadence_days
                return (
                  <div key={a.task_id} style={{ background: C.ochreSoft, border: `1px solid ${C.ochre}44`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 3 }}>{a.task_name}</div>
                    <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>{a.detail}</div>
                    {canApply && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={applied || pending}
                          onClick={async () => {
                            if (!onApplySuggestion) return
                            setPendingId(sid)
                            try {
                              const ok = await onApplySuggestion({
                                action_type: 'adjust_cadence',
                                target_id: a.task_id,
                                target_name: a.task_name,
                                payload: a.suggested_payload,
                              })
                              if (ok) setAppliedIds(s => new Set([...s, sid]))
                            } finally {
                              setPendingId(null)
                            }
                          }}
                          style={{
                            background: applied ? C.sage : C.warmDark,
                            color: C.cream,
                            border: 'none',
                            padding: '7px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: (applied || pending) ? 'default' : 'pointer',
                            opacity: pending ? 0.6 : 1,
                            fontFamily: 'inherit',
                          }}>
                          {applied ? `✓ Pushed to ${a.suggested_payload.new_cadence_days}d` : pending ? 'Applying…' : a.suggested_label}
                        </button>
                        {!applied && !pending && (
                          <button
                            onClick={() => setAppliedIds(s => new Set([...s, sid]))}
                            style={{
                              background: 'transparent',
                              color: C.inkMute,
                              border: `1px solid ${C.border}`,
                              padding: '7px 12px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}>
                            Dismiss
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {r.patterns.length > 0 && (
          <>
            {sectionLabel('Patterns')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.patterns.map((p, i) => (
                <div key={`${p.kind}-${i}`} style={{ background: C.bellySoft, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.warmDark, marginBottom: 2 }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>{p.detail}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {r.contexts.length > 0 && (
          <>
            {sectionLabel('Contexts')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.contexts.map(c => {
                const emoji = { travel: '🗺️', illness: '🌿', busy: '🌾', celebration: '🌸' }[c.type] || '📅'
                return (
                  <div key={c.context_id} style={{ background: C.bellySoft, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
                      {emoji} {c.description || c.type}
                    </div>
                    <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
                      Held {c.held_tasks} task{c.held_tasks === 1 ? '' : 's'}
                      {c.paused_routines > 0 && `, paused ${c.paused_routines} routine${c.paused_routines === 1 ? '' : 's'}`}.
                      {' '}{c.recovery}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <button
            onClick={async () => {
              const lines = []
              lines.push(`Heed retrospective — ${r.period_label}${r.is_partial ? ' (partial)' : ''}`)
              lines.push('')
              lines.push(r.headline)
              lines.push('')
              lines.push(`${ratePct}% complete · ${r.completions} done · ${r.skips} skipped`)
              if (r.routines.length > 0) {
                lines.push('')
                lines.push('Routines:')
                for (const rt of r.routines) lines.push(`  • ${rt.name} — ${rt.days_completed}/${rt.days_due} (${Math.round(rt.completion_rate * 100)}%)`)
              }
              if (r.patterns.length > 0) {
                lines.push('')
                for (const p of r.patterns) lines.push(`${p.label}: ${p.detail}`)
              }
              const text = lines.join('\n')
              try {
                if (typeof navigator !== 'undefined' && navigator.share) {
                  await navigator.share({ title: `Heed: ${r.period_label}`, text })
                  return
                }
              } catch (_) { /* user cancelled or share failed — fall through */ }
              try {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText(text)
                }
              } catch (_) {}
            }}
            style={{ background: C.warmDark, color: C.cream, border: 'none', padding: '8px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" stroke={C.cream} strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 6l-4-4-4 4M12 2v14" stroke={C.cream} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Share retrospective
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: C.inkMute, marginTop: 14, textAlign: 'center', fontStyle: 'italic' }}>
          {r.is_partial ? 'Partial — month still in progress.' : 'Generated from your activity this month.'}
        </div>
      </div>
    </div>
  )
}

// ── TaskOptionsSheet ───────────────────────────────────────────
function TaskOptionsSheet({ task, onClose, onMarkDone, onSkip, onEdit, onAddToRoutine, onBuildRoutine }) {
  if (!task) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <CategoryBadge category={task.category}/>
          {task.importance && <ImportanceBadge importance={task.importance}/>}
          {task.learned && <Pill tone="sage">✨ learned</Pill>}
        </div>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{task.name}</div>
        {task.description && (
          <div style={{ fontSize: 13, color: C.inkSoft, fontStyle: 'italic', marginBottom: 8, lineHeight: 1.5 }}>{task.description}</div>
        )}
        <div style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 16 }}>
          {task.cadence} · last done {task.lastDone}
          {task.overdue != null && <span style={{ color: task.overdue >= 7 ? C.rust : C.ochre, fontWeight: 600, marginLeft: 6 }}>· {task.overdue}d overdue</span>}
          {task.overdue == null && task.dueIn === 0 && <span style={{ color: C.sage, fontWeight: 600, marginLeft: 6 }}>· due today</span>}
          {task.overdue == null && task.dueIn > 0 && <span style={{ color: C.inkMute, marginLeft: 6 }}>· in {task.dueIn}d</span>}
        </div>
        <div style={{ height: 1, background: C.hairline, marginBottom: 16 }}/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* primary actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { onMarkDone?.(task); onClose() }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 16px', background: C.sage + '18', border: `1.5px solid ${C.sage}55`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={C.sage} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.sage }}>Mark done</span>
            </button>
            <button onClick={() => { onSkip?.(task); onClose() }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 16px', background: C.ochre + '15', border: `1.5px solid ${C.ochre}44`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 17l5-5-5-5" stroke={C.ochre} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 17l5-5-5-5" stroke={C.ochre} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.ochre }}>Skip</span>
            </button>
          </div>
          {onEdit && (
            <button onClick={() => { onEdit(task); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: C.bellySoft, border: `1.5px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.warmDark + '88'}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.warmDark + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M16.5 4.5l3 3L8 19l-4 1 1-4L16.5 4.5z" stroke={C.warmDark} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 2 }}>Edit task</div>
                <div style={{ fontSize: 12, color: C.inkMute }}>Update name, category, importance, or cadence</div>
              </div>
            </button>
          )}
          <button onClick={() => { onAddToRoutine(task); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: C.bellySoft, border: `1.5px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.sage + '88'}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.sage + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke={C.sage} strokeWidth="1.8"/><path d="M12 8v8M8 12h8" stroke={C.sage} strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 2 }}>Add to a routine</div>
              <div style={{ fontSize: 12, color: C.inkMute }}>Pick an existing routine to add this to</div>
            </div>
          </button>
          <button onClick={() => { onBuildRoutine(task); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: C.bellySoft, border: `1.5px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.ochre + '88'}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.ochre + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 2l4 4-4 4" stroke={C.ochre} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={C.ochre} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 22l-4-4 4-4" stroke={C.ochre} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={C.ochre} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 2 }}>Build a routine from this</div>
              <div style={{ fontSize: 12, color: C.inkMute }}>Start a new routine using this task</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AddToRoutineSheet ──────────────────────────────────────────
function AddToRoutineSheet({ task, routines, onClose, onSelect }) {
  if (!task) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 3 }}>Add to a routine</div>
        <div style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 20 }}>Choose a routine to add "{task.name}" to</div>
        {routines.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkMute, fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>No routines yet. Build one first.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {routines.map(r => (
              <button key={r.id} onClick={() => { onSelect(task, r.id); onClose() }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: C.bellySoft, border: `1.5px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.sage + '88'}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: C.sage + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={C.sage} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: C.inkMute, marginTop: 2 }}>{r.items.length} items · {r.schedule}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const QUICK_SHEET_DURATIONS = [1, 2, 3, 5, 7]
const QUICK_SHEET_LABELS = { 1: '1 day', 2: '2 days', 3: '3 days', 5: '5 days', 7: '1 week' }

// ── QuickContextSheet ──────────────────────────────────────────
function QuickContextSheet({ type, onClose, onActivate }) {
  const cfg = type ? QUICK_CONTEXT_CONFIG[type] : null
  const [selected, setSelected] = useState(cfg?.defaultDays ?? 2)
  useEffect(() => {
    const defaultDays = type ? QUICK_CONTEXT_CONFIG[type]?.defaultDays : null
    if (defaultDays != null) setSelected(defaultDays)
  }, [type])
  if (!type) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{cfg.icon} {cfg.question}</div>
        <div style={{ fontSize: 12, color: C.inkMute, marginBottom: 16 }}>Heed will hold your tasks until then</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {QUICK_SHEET_DURATIONS.map(d => (
            <button key={d} onClick={() => setSelected(d)} style={{ flex: 1, background: selected === d ? C.warmDark : C.bellySoft, color: selected === d ? C.cream : C.ink, border: 'none', borderRadius: 10, padding: '10px 4px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {QUICK_SHEET_LABELS[d]}
            </button>
          ))}
        </div>
        <button onClick={() => { onActivate(type, selected); onClose() }} style={{ ...getBtnPrimary(), width: '100%', padding: 12, fontSize: 14, fontWeight: 700, borderRadius: 10 }}>
          {cfg.activateLabel}
        </button>
      </div>
    </div>
  )
}

// ── ActiveContextCard ──────────────────────────────────────────
function ActiveContextCard({ context, onImBetter, onExtend, onClick }) {
  if (!context) return null
  const now = new Date()
  const daysSinceStart = Math.max(0, Math.floor((now - context.startDate) / 86400000))
  const totalDays = Math.max(1, Math.round((context.endDate - context.startDate) / 86400000) + 1)
  const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const startedLabel = daysSinceStart === 0 ? 'started today' : `started ${daysSinceStart}d ago`
  return (
    <div onClick={onClick} style={{ background: C.ochreSoft, border: `2px solid ${C.ochre}`, borderRadius: 14, padding: 16, marginBottom: 20, boxShadow: `0 4px 16px ${C.ochre}26`, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 3 }}>{context.icon} {context.label}</div>
          <div style={{ fontSize: 12, color: C.inkMute }}>{fmtDate(context.startDate)} → {fmtDate(context.endDate)} · {startedLabel}</div>
        </div>
        <div style={{ background: C.ochre, color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>Day {daysSinceStart + 1} of {totalDays}</div>
      </div>
      <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', fontSize: 12.5, color: C.ink, marginBottom: 12 }}>
        Heed is holding <strong>{context.heldTaskIds.length} tasks</strong> until you're back. Morning &amp; evening routines paused.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={e => { e.stopPropagation(); onImBetter?.() }} style={{ ...getBtnPrimary(), flex: 1, background: C.sage, padding: '9px 14px' }}>I'm better now</button>
        <button onClick={e => { e.stopPropagation(); onExtend?.() }} style={{ ...getBtnGhost(), padding: '9px 14px' }}>Extend 2 days</button>
      </div>
    </div>
  )
}

// ── RecoverySummarySheet ───────────────────────────────────────
function RecoverySummarySheet({ open, context, heldTasks, onClose, onResumeAll, onEaseBack }) {
  if (!open || !context) return null
  const now = new Date()
  const days = Math.max(1, Math.round((now - context.startDate) / 86400000))
  const top3 = heldTasks.slice(0, 3)
  const extraCount = Math.max(0, heldTasks.length - 3)
  const gladEmoji = QUICK_CONTEXT_CONFIG[context.type]?.icon || '✨'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Glad you're back {gladEmoji}</div>
        <div style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 14 }}>{context.label} ran for <strong>{days} day{days !== 1 ? 's' : ''}</strong>. Here's what Heed held back:</div>
        <div style={{ background: C.bellySoft, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          {top3.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.inkMute, padding: '4px 0' }}>No tasks were held during this period.</div>
          ) : (
            <>
              {top3.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.ink, padding: '4px 0', borderBottom: (i < top3.length - 1 || extraCount > 0) ? `1px solid ${C.hairline}` : 'none' }}>
                  <span>{t.name}</span>
                  {t.overdue ? <span style={{ color: C.rust, fontWeight: 600 }}>+{t.overdue}d overdue</span> : <span style={{ color: C.inkMute }}>held</span>}
                </div>
              ))}
              {extraCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.inkMute, padding: '4px 0' }}>
                  <span>+ {extraCount} more task{extraCount !== 1 ? 's' : ''}</span>
                  <span style={{ color: C.sage, fontWeight: 600 }}>held</span>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onResumeAll} style={{ ...getBtnPrimary(), flex: 2, background: C.sage, padding: 11, fontSize: 13, fontWeight: 700, borderRadius: 10 }}>Resume all</button>
          <button onClick={onEaseBack} style={{ ...getBtnGhost(), flex: 1, padding: 11, fontSize: 13, borderRadius: 10 }}>Ease back in</button>
        </div>
      </div>
    </div>
  )
}

// ── Standalone sheet components ────────────────────────────────
function SheetSectionCard({ children, style }) {
  return <div style={{ background: C.bellySoft, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', ...style }}>{children}</div>
}
function SheetSectionLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>
}

// ── ShareCardSheet ─────────────────────────────────────────────
function ShareCardSheet({ routine, onClose }) {
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

  if (!routine) return null

  const slug = routine.name.toLowerCase().replace(/\s+/g, '-')
  const filename = `heed-${slug}-${variant}.png`

  async function handleDownload() {
    setLoading(true)
    try {
      await downloadCard(hiddenRef.current, filename)
    } catch {
      // PNG encoding or download failed silently
    } finally {
      setLoading(false)
    }
  }

  async function handleShare() {
    setLoading(true)
    try {
      await shareCard(hiddenRef.current, filename, () => setFallbackToast(true))
    } catch {
      // PNG encoding or share failed silently
    } finally {
      setLoading(false)
    }
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

// ── ContextDetailSheet ─────────────────────────────────────────
function ContextDetailSheet({ open, ctx, heldTasks, onClose, onImBetter, onExtend, onAskHeed }) {
  if (!open || !ctx) return null

  const fmtDate = d => {
    if (!d) return ''
    const parsed = typeof d === 'string' ? new Date(d) : d
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const now = new Date()
  let subtitle = `${ctx.start || ''} → ${ctx.end || ''}`
  if (ctx._status === 'upcoming' && ctx._startDate) {
    const daysAway = Math.ceil((ctx._startDate - now) / 86400000)
    const weeksAway = Math.ceil(daysAway / 7)
    subtitle += daysAway <= 0 ? ' · this week' : daysAway < 7 ? ` · in ${daysAway} day${daysAway !== 1 ? 's' : ''}` : ` · in ${weeksAway} week${weeksAway !== 1 ? 's' : ''}`
  }
  if (ctx._status === 'active') {
    const daysSinceStart = Math.max(0, Math.floor((now - ctx.startDate) / 86400000))
    const totalDays = Math.max(1, Math.round((ctx.endDate - ctx.startDate) / 86400000) + 1)
    subtitle = `${fmtDate(ctx.startDate)} → ${fmtDate(ctx.endDate)} · Day ${daysSinceStart + 1} of ${totalDays}`
  }
  if (ctx._status === 'past') {
    const startD = new Date(ctx.start)
    const endD = new Date(ctx.end)
    const dur = Math.max(1, Math.round((endD - startD) / 86400000) + 1)
    subtitle = `${ctx.start} → ${ctx.end} · ${dur} day${dur !== 1 ? 's' : ''}`
  }

  const icons = { travel: '🗺️', illness: '🌿', busy: '🌾', celebration: '🌸' }
  const icon = ctx.icon || icons[ctx.type] || '📌'
  const bgForIcon = ctx._status === 'active' ? C.ochreSoft : ctx._status === 'upcoming' ? C.ochreSoft : C.bellySoft

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: bgForIcon, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 3 }}>{ctx.desc || ctx.label}</div>
            <div style={{ fontSize: 12, color: C.inkMute }}>{subtitle}</div>
          </div>
        </div>

        {ctx._status === 'upcoming' && (() => {
          const tasksBefore = ctx.plan?.before || []
          const whileAway = ctx.plan?.during?.[0] || ''
          const comingBack = ctx.plan?.after?.[0] || ''
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {tasksBefore.length > 0 && (
                <SheetSectionCard>
                  <SheetSectionLabel>Before you go</SheetSectionLabel>
                  {tasksBefore.slice(0, 5).map((t, i) => (
                    <div key={i} style={{ fontSize: 13, color: C.ink, padding: '2px 0' }}>• {t}</div>
                  ))}
                </SheetSectionCard>
              )}
              {(whileAway || comingBack) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {whileAway && (
                    <SheetSectionCard style={{ flex: 1 }}>
                      <SheetSectionLabel>While away</SheetSectionLabel>
                      <div style={{ fontSize: 12.5, color: C.inkSoft }}>{whileAway}</div>
                    </SheetSectionCard>
                  )}
                  {comingBack && (
                    <SheetSectionCard style={{ flex: 1 }}>
                      <SheetSectionLabel>Coming back</SheetSectionLabel>
                      <div style={{ fontSize: 12.5, color: C.inkSoft }}>{comingBack}</div>
                    </SheetSectionCard>
                  )}
                </div>
              )}
              <button onClick={() => { onClose(); onAskHeed?.(ctx.askQuery || '') }} style={{ ...getBtnPrimary(), width: '100%', padding: 12, fontSize: 13, fontWeight: 700, borderRadius: 10 }}>
                Ask Heed to plan around this
              </button>
            </div>
          )
        })()}

        {ctx._status === 'active' && (() => {
          const top3 = (heldTasks || []).slice(0, 3)
          const extraCount = Math.max(0, (heldTasks || []).length - 3)
          return (
            <div style={{ marginBottom: 16 }}>
              <SheetSectionCard style={{ marginBottom: 12 }}>
                {top3.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.inkMute }}>Heed is holding your tasks while {ctx.label} is active.</div>
                ) : (
                  <>
                    {top3.map((t, i) => (
                      <div key={t.id || i} style={{ fontSize: 13, color: C.ink, padding: '4px 0', borderBottom: i < top3.length - 1 ? `1px solid ${C.hairline}` : 'none' }}>
                        {t.name}
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <div style={{ fontSize: 12.5, color: C.inkMute, padding: '4px 0' }}>+ {extraCount} more task{extraCount !== 1 ? 's' : ''}</div>
                    )}
                  </>
                )}
              </SheetSectionCard>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onImBetter} style={{ ...getBtnPrimary(), flex: 1, background: C.sage, padding: '10px 14px' }}>I'm better now</button>
                <button onClick={onExtend} style={{ ...getBtnGhost(), padding: '10px 14px' }}>Extend 2 days</button>
              </div>
            </div>
          )
        })()}

        {ctx._status === 'past' && (() => {
          const tasks = ctx.heldTasks || []
          const top3 = tasks.slice(0, 3)
          const extraCount = Math.max(0, tasks.length - 3)
          return (
            <SheetSectionCard style={{ marginBottom: 16 }}>
              {tasks.length === 0 ? (
                <div style={{ fontSize: 13, color: C.inkMute }}>No tasks were held during this period.</div>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 8 }}>
                    Heed held back <strong>{ctx.skipped}</strong> tasks during this period:
                  </div>
                  {top3.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.ink, padding: '4px 0', borderBottom: (i < top3.length - 1 || extraCount > 0) ? `1px solid ${C.hairline}` : 'none' }}>
                      <span>{t.label}</span>
                      {t.overdueDays > 0
                        ? <span style={{ color: C.rust, fontWeight: 600 }}>+{t.overdueDays}d overdue</span>
                        : <span style={{ color: C.inkMute }}>paused</span>
                      }
                    </div>
                  ))}
                  {extraCount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.inkMute, padding: '4px 0' }}>
                      <span>+ {extraCount} more task{extraCount !== 1 ? 's' : ''}</span>
                      <span style={{ color: C.sage, fontWeight: 600 }}>held</span>
                    </div>
                  )}
                </>
              )}
            </SheetSectionCard>
          )
        })()}
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────
export default function HeedApp() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // When the user has clicked "Load demo data", initialise apiTasks with the
  // curated TASKS_DEMO seed and skip the /api/tasks fetch (see effect below)
  // — otherwise stale Cosmos data overrides the demo and Focus Today empties.
  const [apiTasks, setApiTasks] = useState(() => isDemoMode() ? TASKS_DEMO : [])
  const [apiContexts, setApiContexts] = useState({ active: [], upcoming: [] })
  const [dismissedIds, setDismissedIds] = useState(new Set())
  // Last ~200 skip events with reason. Retrospective reads these to detect
  // forgot/busy patterns. Backend completion log will replace this in Phase 1b.
  const [recentSkips, setRecentSkips] = useState([])
  // Tasks the user skipped via swipe-left today. Renders as a footer on Today
  // so they can bring one back without searching the API once the toast Undo
  // window closes.
  const [skippedTasks, setSkippedTasks] = useState([])
  const [routines, setRoutines] = useState(ROUTINES)
  // Hydrate routines: try backend first, fall back to localStorage, then to
  // the default ROUTINES seed. localStorage stays the synchronous source of
  // truth so the UI is never blank waiting on the network. Backend is a
  // write-through cache so a reinstall / different device finds the user's
  // real routines instead of the demo seed.
  const _routinesHydrated = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || _routinesHydrated.current) return
    _routinesHydrated.current = true
    let local = null
    try {
      const raw = window.localStorage.getItem('heed.routines.v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          local = parsed
          setRoutines(parsed)
        }
      }
    } catch (_) {}
    if (isDemoMode()) return  // demo mode — keep ROUTINES default, skip API
    fetch(`${FUNCTIONS_URL}/api/user_state/routines`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items = data && Array.isArray(data.items) ? data.items : null
        if (items && items.length > 0) setRoutines(items)
        else if (local) {
          // Backend is empty but we have a local copy → push it up so a
          // future reinstall on the same user finds it.
          fetch(`${FUNCTIONS_URL}/api/user_state/routines`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: local }),
          }).catch(() => {})
        }
      })
      .catch(() => { /* offline / error — local copy already in state */ })
  }, [FUNCTIONS_URL])
  // Persist on every change. localStorage write is synchronous; backend PUT
  // is fire-and-forget. We don't block UI on the network round-trip.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem('heed.routines.v1', JSON.stringify(routines)) } catch (_) {}
    if (!_routinesHydrated.current) return  // skip the very first render
    if (isDemoMode()) return  // demo mode — local-only, don't write to API
    fetch(`${FUNCTIONS_URL}/api/user_state/routines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: routines }),
    }).catch(() => {})
  }, [routines, FUNCTIONS_URL])
  // Plans live at HeedApp level so both Today (read-only summary) and Life
  // (full management surface) share one source of truth.
  const plansHook = usePlans(DEMO_PLANS)
  const [tab, setTab] = useState('today')
  const [theme, setTheme] = useState(DEFAULT_THEME)
  setThemeState(theme)
  const handleSetTheme = useCallback((name) => setTheme(name), [])
  useEffect(() => {
    const saved = localStorage.getItem('heed-theme')
    if (saved && THEMES[saved]) setTheme(saved)
  }, [])
  useEffect(() => {
    localStorage.setItem('heed-theme', theme)
  }, [theme])
  const [toast, setToast] = useState(null)
  const [askPrefill, setAskPrefill] = useState('')
  const [askAutoSend, setAskAutoSend] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [askOpen, setAskOpen] = useState(false)
  const [routineModalOpen, setRoutineModalOpen] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState(null)
  const [contextModalOpen, setContextModalOpen] = useState(false)
  const [taskOptionsTask, setTaskOptionsTask] = useState(null)
  const [addToRoutineTask, setAddToRoutineTask] = useState(null)
  const [buildRoutineTask, setBuildRoutineTask] = useState(null)
  const [activeContext, setActiveContext] = useState(null)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [quickContextType, setQuickContextType] = useState(null)
  const [detailCtx, setDetailCtx] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [shareCtx, setShareCtx] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // "Just one thing" / executive-function mode — strips Today down to the
  // single highest-priority card. Designed for crash days where seeing 12
  // items causes shutdown. Persisted to localStorage so it survives refresh.
  const [efMode, setEfMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('heed.ef-mode') === '1'
  })
  const handleSetEfMode = useCallback((on) => {
    setEfMode(on)
    try { localStorage.setItem('heed.ef-mode', on ? '1' : '0') } catch (_) {}
  }, [])
  const [userName, setUserName] = useState(() => {
    if (typeof window === 'undefined') return 'Maya'
    return localStorage.getItem('heed-username') || 'Maya'
  })
  const handleUserName = useCallback((name) => {
    setUserName(name)
    try { localStorage.setItem('heed-username', name) } catch (_) {}
  }, [])
  const [customCategories, setCustomCategories] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem('heed.categories.v1')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [customEventTypes, setCustomEventTypes] = useState([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem('heed.categories.v1', JSON.stringify(customCategories)) } catch (_) {}
  }, [customCategories])

  useEffect(() => {
    // Skip API in demo mode — apiTasks is already seeded with TASKS_DEMO and
    // a real fetch would clobber it with stale Cosmos data.
    if (isDemoMode()) return
    fetch(`${FUNCTIONS_URL}/api/tasks`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setApiTasks(data))
      .catch(() => {})
    fetch(`${FUNCTIONS_URL}/api/context`)
      .then(r => r.json())
      .then(data => data && setApiContexts(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!toast) return
    // Toasts with reason chips need a longer window so the user can read +
    // tap a chip before they vanish.
    const ms = toast.reasons ? 6000 : 3000
    const t = setTimeout(() => setToast(null), ms)
    return () => clearTimeout(t)
  }, [toast])

  const displayTasks = (apiTasks.length > 0 ? apiTasks : TASKS_DEMO)
    .filter(t => t.status === 'active' && !dismissedIds.has(t.id))
    .map(computeTaskDisplay)

  // Document title prefix when something is overdue — the cheapest possible
  // "notification" surface. A user with the Heed tab open in another window
  // (or returning to it) sees "(3) Heed — …" and gets pulled back. Stops
  // short of real push (Capacitor will handle that natively).
  useEffect(() => {
    if (typeof document === 'undefined') return
    const overdue = displayTasks.filter(t => (t.overdue || 0) > 0).length
    const base = 'Heed — The agent that remembers what you forget.'
    document.title = overdue > 0 ? `(${overdue}) ${base}` : base
  }, [displayTasks])

  const apiUpcoming = [
    ...(apiContexts.upcoming || []).map(c => ({ ...mapApiContext(c), _startDate: c.start_date ? new Date(c.start_date) : null })),
    ...(apiContexts.active || []).map(c => ({ ...mapApiContext(c), _startDate: c.start_date ? new Date(c.start_date) : null })),
  ]
  const enrichedUpcoming = apiUpcoming.map(c => {
    if (c.plan) return c
    const demo = CONTEXTS_UPCOMING_DEMO.find(d => d.desc === c.desc)
      || CONTEXTS_UPCOMING_DEMO.find(d => d.type === c.type)
    return demo ? { ...c, plan: demo.plan, askQuery: demo.askQuery } : c
  })
  const upcomingContexts = enrichedUpcoming.length > 0 ? enrichedUpcoming : CONTEXTS_UPCOMING_DEMO

  // Greeting for the header. Lives at HeedApp (not TodayTab) so it shows on
  // every tab and the in-page TodayTab title doesn't duplicate it.
  const headerGreeting = (() => {
    const hour = new Date().getHours()
    const time = hour < 5 ? 'Late night'
               : hour < 12 ? 'Morning'
               : hour < 17 ? 'Afternoon'
               : hour < 22 ? 'Evening'
               : 'Late evening'
    const first = (userName || '').trim().split(/\s+/)[0]
    const headline = first ? `${time}, ${first}.` : `${time}.`
    const todayCount = displayTasks.filter(t => t.overdue != null || t.dueIn === 0).length
    const overdue = displayTasks.filter(t => (t.overdue || 0) >= 7).length
    let sub
    if (overdue > 0) sub = `${overdue} ${overdue === 1 ? 'task needs' : 'tasks need'} your attention today.`
    else if (todayCount > 0) sub = `${todayCount} ${todayCount === 1 ? 'thing' : 'things'} on your plate today.`
    else sub = `Nothing pressing right now.`
    return { headline, sub }
  })()

  const handleMarkDone = useCallback(async (task) => {
    const taskId = typeof task === 'string' ? task : task.id
    const taskName = typeof task === 'string' ? 'Task' : task.name
    // One-time vs recurring: a task with no explicit cadence and no learned
    // cadence is a one-shot todo (e.g. "Buy gift for Maya"). On done, archive
    // it locally so it doesn't reappear. Recurring tasks (any cadence set)
    // roll forward — backend handles the next_due_at recompute on completion.
    const taskObj = typeof task === 'object' ? task : null
    const isOneTime = taskObj && !taskObj.explicit_cadence_days && !taskObj.learned_cadence_days
    setDismissedIds(s => new Set([...s, taskId]))
    if (isOneTime) {
      setApiTasks(t => t.map(x => x.id === taskId ? { ...x, status: 'archived' } : x))
    }
    setToast({
      message: `"${taskName}" marked done`,
      onUndo: () => {
        setDismissedIds(s => { const n = new Set(s); n.delete(taskId); return n })
        if (isOneTime) setApiTasks(t => t.map(x => x.id === taskId ? { ...x, status: 'active' } : x))
        setToast(null)
      },
    })
    fetch(`${FUNCTIONS_URL}/api/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, event_type: 'done' }),
    }).catch(() => {})
    // For one-time tasks, also patch the backend status so the next /api/tasks
    // GET doesn't bring it back.
    if (isOneTime) {
      fetch(`${FUNCTIONS_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      }).catch(() => {})
    }
  }, [FUNCTIONS_URL])

  const handleSkip = useCallback(async (task) => {
    const taskId = typeof task === 'string' ? task : task.id
    const taskName = typeof task === 'string' ? 'Task' : task.name
    setDismissedIds(s => new Set([...s, taskId]))
    setSkippedTasks(s => s.find(x => x.id === taskId) ? s : [...s, { id: taskId, name: taskName }])
    // First post records the skip with reason='other'. The toast then offers
    // three reason chips; tapping one fires a follow-up POST that overwrites
    // the reason. Without this, the advisor's slip-pattern logic only ever
    // sees "other" and can't tell "too busy" from "forgot".
    // We also keep a local copy in recentSkips for retrospective patterns.
    const recordSkip = (reason) => {
      fetch(`${FUNCTIONS_URL}/api/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, event_type: 'skipped', skip_reason: reason }),
      }).catch(() => {})
      setRecentSkips(s => {
        // Replace any earlier 'other'-reason entry for the same task in the
        // last 60 seconds with the refined reason — keeps the local log clean.
        const cutoff = Date.now() - 60_000
        const filtered = s.filter(e => !(e.task_id === taskId && e.ts >= cutoff && e.reason === 'other'))
        return [{ task_id: taskId, task_name: taskName, reason, ts: Date.now() }, ...filtered].slice(0, 200)
      })
    }
    recordSkip('other')
    setToast({
      message: `"${taskName}" skipped — why?`,
      onUndo: () => { setDismissedIds(s => { const n = new Set(s); n.delete(taskId); return n }); setToast(null) },
      reasons: [
        // Values must match backend SkipReason enum:
        // still_fine | not_applicable | forgot | too_busy | other.
        { value: 'too_busy',   label: 'Busy' },
        { value: 'forgot',     label: 'Forgot' },
        { value: 'still_fine', label: 'Not today' },
      ],
      onReason: recordSkip,
    })
  }, [FUNCTIONS_URL])

  // Bring a skipped task back into Today's view. Reverses the skip locally;
  // we don't yet roll back the backend completion event since the user may
  // genuinely have skipped and is just changing their mind. The backend
  // sees a skip + no further done event for the day, which is correct.
  const handleUnskip = useCallback((taskId) => {
    setDismissedIds(s => { const n = new Set(s); n.delete(taskId); return n })
    setSkippedTasks(s => s.filter(x => x.id !== taskId))
  }, [])

  const handleReschedule = useCallback(async (taskId, newDate) => {
    const d = new Date(newDate)
    if (isNaN(d.getTime())) return
    try {
      const res = await fetch(`${FUNCTIONS_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_due_at: d.toISOString() }),
      })
      if (!res.ok) return
    } catch { return }
    fetch(`${FUNCTIONS_URL}/api/tasks`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setApiTasks(data))
      .catch(() => {})
  }, [FUNCTIONS_URL])

  const handleAskHeed = useCallback((query) => {
    // Auto-send whenever a non-empty query is passed (e.g. "Plan around my
    // Singapore trip" from the context banner). Empty/undefined query just
    // opens the tab blank — preserves the speed-dial "Ask Heed" entry point.
    const q = (query || '').trim()
    setAskPrefill(q)
    setAskAutoSend(q.length > 0)
    setTab('ask')
  }, [])

  const handleMicAsk = useCallback((transcript) => {
    setAskPrefill(transcript)
    setAskAutoSend(true)
    setTab('ask')
  }, [])

  const handleToastView = useCallback(() => {
    setToast(null)
    setTab('tracks')
  }, [])

  const handleAddTask = useCallback(async (data) => {
    const body = { name: data.name, category: data.category, importance: data.importance, explicit_cadence_days: data.explicit_cadence_days || null, description: data.description || null }
    const isEdit = !!data.id
    try {
      const resp = await fetch(
        isEdit ? `${FUNCTIONS_URL}/api/tasks/${data.id}` : `${FUNCTIONS_URL}/api/tasks`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (resp.ok) {
        const updated = await resp.json()
        if (isEdit) {
          setApiTasks(t => t.map(x => x.id === data.id ? updated : x))
          setToast({ message: 'Updated.' })
        } else {
          setApiTasks(t => [...t, updated])
          setToast({ message: "Got it. I'll watch this one.", showView: true })
          setTab('today')
        }
      }
    } catch {}
    setEditingTask(null)
  }, [FUNCTIONS_URL])

  const handleEditTask = useCallback((task) => {
    setEditingTask(task)
    setModalOpen(true)
  }, [])

  const handleDeleteTask = useCallback(async (task) => {
    if (!task?.id) return
    try {
      const resp = await fetch(`${FUNCTIONS_URL}/api/tasks/${task.id}`, { method: 'DELETE' })
      if (!resp.ok && resp.status !== 404) return
    } catch { return }
    setApiTasks(t => t.filter(x => x.id !== task.id))
    setEditingTask(null)
    setToast({ message: `${task.name || 'Task'} removed.` })
  }, [FUNCTIONS_URL])

  // Apply a Phase 2 retrospective suggestion. Returns true if the action
  // Wipe all data — backend tasks/completions/contexts/user_state and every
  // localStorage key Heed owns. Used by the Reset row in Settings. Reloads
  // after to make sure no in-memory state survives.
  const handleResetAllData = useCallback(async () => {
    try {
      await fetch(`${FUNCTIONS_URL}/api/reset`, { method: 'POST' })
    } catch (_) {}
    if (typeof window !== 'undefined') {
      try {
        const keysToWipe = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && (k.startsWith('heed.') || k.startsWith('heed_') || k === 'heed-theme')) keysToWipe.push(k)
        }
        keysToWipe.forEach(k => localStorage.removeItem(k))
        // Defensive: clear the demo flag explicitly even if the prefix loop
        // already caught it. Reset means real-API mode.
        localStorage.removeItem('heed.use-demo')
      } catch (_) {}
      window.location.reload()
    }
  }, [FUNCTIONS_URL])

  // Loads a curated demo set so judges see Focus Today populated. Pure
  // client-side: wipes localStorage, sets the heed.use-demo flag, reloads.
  // On reload, isDemoMode() is true → apiTasks initial = TASKS_DEMO,
  // /api/tasks fetch is skipped, routines/plans fall back to their
  // built-in defaults (ROUTINES, DEMO_PLANS). No backend calls means no
  // race, no silent failure, no stale Cosmos overwriting the demo.
  const handleLoadDemoData = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const keysToWipe = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('heed.') || k.startsWith('heed_'))) keysToWipe.push(k)
      }
      keysToWipe.forEach(k => localStorage.removeItem(k))
      localStorage.setItem('heed.use-demo', '1')
    } catch (_) {}
    window.location.reload()
  }, [])

  // succeeded so the sheet can mark it as ✓. Phase 2 wires adjust_cadence
  // (PATCH /api/tasks/{id}); other action_types fall through to no-op.
  const handleApplyRetroSuggestion = useCallback(async (suggestion) => {
    try {
      if (suggestion.action_type === 'adjust_cadence') {
        const newDays = suggestion.payload?.new_cadence_days
        if (!newDays || !suggestion.target_id) return false
        const resp = await fetch(`${FUNCTIONS_URL}/api/tasks/${suggestion.target_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ explicit_cadence_days: newDays }),
        })
        if (!resp.ok) return false
        const updated = await resp.json()
        setApiTasks(t => t.map(x => x.id === suggestion.target_id ? updated : x))
        setToast({ message: `${suggestion.target_name || 'Task'} cadence pushed to ${newDays}d` })
        return true
      }
      return false
    } catch {
      return false
    }
  }, [FUNCTIONS_URL])

  const handleAddContext = useCallback(async (data) => {
    const body = { context_type: data.type, start_date: data.startDate, end_date: data.endDate, description: data.description }
    try {
      const resp = await fetch(`${FUNCTIONS_URL}/api/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (resp.ok) {
        fetch(`${FUNCTIONS_URL}/api/context`)
          .then(r => r.json())
          .then(d => d && setApiContexts(d))
          .catch(() => {})
        setToast({ message: "Noted. I'll plan around it." })
      }
    } catch {}
  }, [FUNCTIONS_URL])

  const handleAddRoutine = useCallback((routineData) => {
    const isEdit = !routineData.id.startsWith('custom_')
    setRoutines(rs =>
      isEdit
        ? rs.map(r => r.id === routineData.id ? { ...r, name: routineData.name, items: routineData.items } : r)
        : [...rs, routineData]
    )
    setToast({ message: isEdit ? 'Routine updated.' : 'Routine added — building up history.', showView: true })
    setEditingRoutine(null)
    setTab('today')
  }, [])

  const handleMarkRoutineDone = useCallback((routineId) => {
    setRoutines(rs => rs.map(r => {
      if (r.id !== routineId) return r
      const updated = [...r.completion14d]
      updated[updated.length - 1] = true
      return { ...r, completion14d: updated }
    }))
    setToast({ message: 'Done for today. Nice.' })
  }, [])

  const handleSkipRoutineToday = useCallback((routineId) => {
    setToast({ message: 'Skipped for today.' })
  }, [])

  // Toggle a single day in the routine's 14-day completion strip,
  // OR toggle a single ITEM done for today when index === '__item__'.
  // Index 0 is the oldest day, length-1 is today.
  const handleMarkRoutineDay = useCallback((routineId, index, value) => {
    if (index === '__item__') {
      // value is the item name; toggle in todayItemsDone array.
      setRoutines(rs => rs.map(r => {
        if (r.id !== routineId) return r
        const cur = r.todayItemsDone || []
        const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value]
        // Filter out lightened items so they never count.
        const live = (r.items || []).filter(it => !(r.lightenedItems || []).includes(it))
        const allDone = live.length > 0 && live.every(it => next.includes(it))
        const updatedC14 = [...(r.completion14d || [])]
        if (updatedC14.length && allDone) updatedC14[updatedC14.length - 1] = true
        return { ...r, todayItemsDone: next, completion14d: updatedC14 }
      }))
      return
    }
    setRoutines(rs => rs.map(r => {
      if (r.id !== routineId) return r
      const updated = [...r.completion14d]
      if (index < 0 || index >= updated.length) return r
      updated[index] = !!value
      return { ...r, completion14d: updated }
    }))
    const daysAgo = (() => {
      const r = routines.find(x => x.id === routineId)
      if (!r) return 0
      return (r.completion14d.length - 1) - index
    })()
    const when = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`
    setToast({ message: value ? `Marked ${when} done.` : `Cleared ${when}.` })
  }, [routines])

  const handleLightenRoutine = useCallback((routineId, itemsToStrike = null) => {
    setRoutines(rs => rs.map(r => {
      if (r.id !== routineId) return r
      const strike = itemsToStrike || r.items.slice(Math.ceil(r.items.length / 2))
      return { ...r, suggestion: null, insight: 'Lightened for this week.', lightenedItems: strike }
    }))
    setToast({ message: "Lightened. I'll keep it gentle this week." })
  }, [])

  const handleShareOpen = useCallback((routine) => setShareCtx(routine), [])

  const handleShareClose = useCallback(() => setShareCtx(null), [])

  const handleEditRoutine = useCallback((routine) => {
    setEditingRoutine(routine)
    setRoutineModalOpen(true)
  }, [])

  const handleMoreOptions = useCallback((task) => {
    setTaskOptionsTask(task)
  }, [])

  const handleQuickContext = useCallback((type, days) => {
    const cfg = QUICK_CONTEXT_CONFIG[type]
    if (!cfg) return
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days - 1)
    const heldTaskIds = apiTasks
      .filter(t => t.status === 'active' && !dismissedIds.has(t.id))
      .map(t => t.id)
    setActiveContext({ id: `ctx-${Date.now()}`, type, label: cfg.label, icon: cfg.icon, startDate, endDate, heldTaskIds })
    setToast({ message: cfg.toastMsg })
  }, [apiTasks, dismissedIds])

  const handleExtendContext = useCallback(() => {
    setActiveContext(ctx => {
      if (!ctx) return ctx
      const newEnd = new Date(ctx.endDate)
      newEnd.setDate(newEnd.getDate() + 2)
      return { ...ctx, endDate: newEnd }
    })
    setToast({ message: "+2 days. I'll hold the line." })
  }, [])

  const handleEndContext = useCallback((mode) => {
    setActiveContext(null)
    setRecoveryOpen(false)
    setToast({ message: mode === 'resume' ? "You're back — tasks resumed" : 'Easing you back in — top tasks surfaced' })
  }, [])

  const handleDetailOpen = useCallback((ctx, status) => {
    setDetailCtx({ ...ctx, _status: status })
    setDetailOpen(true)
  }, [])

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false)
  }, [])


  const handleAddTaskToRoutine = useCallback((task, routineId) => {
    setRoutines(rs => rs.map(r => {
      if (r.id !== routineId) return r
      if (r.items.includes(task.name)) return r
      return { ...r, items: [...r.items, task.name] }
    }))
    setToast({ message: `"${task.name}" added to routine` })
  }, [])

  const tabs = APP_TABS

  const [todayStr, setTodayStr] = useState('')
  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))
  }, [])

  if (!mounted) return null

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at 30% 0%, ${C.paper} 0%, ${C.cream} 60%)`, color: C.ink, fontFamily: '"Nunito Sans", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Nunito+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes heed-fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes heed-dropdown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes heed-tab-in { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes heed-toast-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes heed-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes heed-fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes heed-pulse { 0%,100% { opacity:0.4; transform:translateX(-50%) scale(1); } 50% { opacity:1; transform:translateX(-50%) scale(1.4); } }
        @keyframes heed-breathe { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:0.85; transform:scale(1.05); } }
        @keyframes heed-done-flash { from {} to { background: #e8f5ee; } }
        @keyframes heed-done-check { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes heed-check-draw { to { stroke-dashoffset: 0; } }
        @keyframes heed-done-out { 0% { transform: translateX(0); opacity: 1; max-height: 120px; margin-bottom: 10px; } 50% { transform: translateX(14px); opacity: 0.4; } 100% { transform: translateX(80px); opacity: 0; max-height: 0; margin-bottom: 0; } }
        @keyframes heed-mic-pulse { 0%,100% { box-shadow: 0 0 0 3px #fff3f3, 0 0 0 6px rgba(229,62,62,0.2), 0 -4px 20px rgba(229,62,62,0.2); } 50% { box-shadow: 0 0 0 3px #fff3f3, 0 0 0 11px rgba(229,62,62,0.45), 0 -4px 24px rgba(229,62,62,0.35); } }
        @keyframes heed-blink { 0%,50%,100% { opacity:1; } 25%,75% { opacity:0.3; } }
        @keyframes heed-bob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-2px); } }
        @keyframes heed-dot-bounce { 0%,60%,100% { transform:translateY(0); opacity:0.4; } 30% { transform:translateY(-6px); opacity:1; } }
        @keyframes heed-slideUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
        @keyframes heed-slideRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes heed-slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
        ::selection { background:${C.warmDark}; color:${C.cream}; }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      {activeContext && (() => {
        const stripeColor = { travel: C.ochre, illness: C.sage, busy: C.warmDark, celebration: C.rust }[activeContext.type] || C.warmDark
        const emoji = { travel: '🗺️', illness: '🌿', busy: '🌾', celebration: '🌸' }[activeContext.type] || '📍'
        return (
          <div style={{ position: 'sticky', top: 0, zIndex: 11, background: stripeColor, color: C.cream, fontSize: 12, fontWeight: 600, padding: '5px 16px', textAlign: 'center', letterSpacing: 0.2 }}>
            {emoji} {activeContext.label || activeContext.desc || activeContext.type} — Heed is going gentle
          </div>
        )
      })()}
      <header className="heed-header" style={{ borderBottom: `1px solid ${C.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`, position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Owl mood reflects state: worried if anything is severely overdue,
              else calm. Animates 'speaking' during streaming chat (handled by
              the Ask sheet's own MayaOwl). */}
          <MayaOwl size={40} mood={displayTasks.some(t => (t.overdue || 0) >= 7) ? 'worried' : 'calm'}/>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 22, fontWeight: 600, color: C.warmDark, letterSpacing: -0.5, lineHeight: 1.1 }}>{headerGreeting.headline}</div>
            <div className="heed-header-subtitle" style={{ fontSize: 12, color: C.inkSoft, fontStyle: 'italic', marginTop: 3, lineHeight: 1.4 }}>{headerGreeting.sub}</div>
          </div>
        </div>
        <div className="heed-tab-name" style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
          {tabs.find(t => t.id === tab)?.label}
        </div>
        <div className="heed-header-date" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>{todayStr}</div>
            <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>Hi, {userName} 👋</div>
          </div>
          <AvatarButton name={userName} onClick={() => setSettingsOpen(true)}/>
        </div>
        <div className="heed-theme-mobile" style={{ alignItems: 'center' }}>
          <AvatarButton name={userName} onClick={() => setSettingsOpen(true)}/>
        </div>
      </header>

      <nav className="heed-nav" style={{ display: 'flex', gap: 4, padding: '0 32px', borderBottom: `1px solid ${C.hairline}`, background: C.paper }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'transparent', border: 'none', padding: '14px 20px', fontSize: 14, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.warmDark : C.inkMute, cursor: 'pointer', borderBottom: `2px solid ${tab === t.id ? C.warmDark : 'transparent'}`, marginBottom: -1, fontFamily: 'inherit', transition: 'color 0.15s' }}>
            {t.label}
          </button>
        ))}
      </nav>

      <MobileBottomNav tab={tab} onTab={setTab} onMicAsk={handleMicAsk} overdueCount={displayTasks.filter(t => (t.overdue || 0) > 0).length}/>

      <main className="heed-main" style={{ maxWidth: 820, margin: '0 auto', padding: '28px 32px 100px 32px', minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
        {/* keyed wrapper so React remounts subtree on tab change → CSS animation
            replays. Slide-in from a few px right + fade gives a native-feeling
            transition without tracking previous tab for direction. */}
        <div key={tab} style={{ animation: 'heed-tab-in 0.28s cubic-bezier(0.32,0.72,0,1) both', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          {tab === 'today' && <TodayTab tasks={displayTasks} routines={routines} plans={plansHook.plans} upcomingContexts={upcomingContexts} skippedTasks={skippedTasks} userName={userName} efMode={efMode} onSetEfMode={handleSetEfMode} onMarkDone={handleMarkDone} onSkip={handleSkip} onUnskip={handleUnskip} onMarkRoutineDone={handleMarkRoutineDone} onSkipRoutineToday={handleSkipRoutineToday} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAskHeed={handleAskHeed} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen} onAddTask={() => setModalOpen(true)} onEditTask={handleEditTask} onAddToRoutine={t => setAddToRoutineTask(t)} onBuildRoutine={t => { setBuildRoutineTask(t); setRoutineModalOpen(true) }} onNavigateToPlans={() => setTab('context')}/>}
          {tab === 'calendar' && <CalendarTab tasks={apiTasks} contexts={[...(apiContexts.active||[]), ...(apiContexts.upcoming||[])]} routines={routines} recentSkips={recentSkips} onReschedule={handleReschedule} onMarkDone={handleMarkDone} onSkip={handleSkip} onAddTask={() => setModalOpen(true)} onAddContext={() => setContextModalOpen(true)} onEditRoutine={handleEditRoutine} onApplyRetroSuggestion={handleApplyRetroSuggestion}/>}
          {tab === 'ask' && <AskTab prefill={askPrefill} autoSend={askAutoSend} onAutoSendDone={() => { setAskAutoSend(false); setAskPrefill('') }} onLightenRoutine={handleLightenRoutine} onTaskAdded={() => fetch(`${FUNCTIONS_URL}/api/tasks`).then(r => r.json()).then(d => Array.isArray(d) && setApiTasks(d)).catch(() => {})}/>}
          {tab === 'tracks' && <TracksTab tasks={displayTasks} routines={routines} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAddTask={() => setModalOpen(true)} onAddRoutine={() => setRoutineModalOpen(true)} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen} onMarkRoutineDay={handleMarkRoutineDay} onEditTask={handleEditTask} onAddToRoutine={t => setAddToRoutineTask(t)} onBuildRoutine={t => { setBuildRoutineTask(t); setRoutineModalOpen(true) }}/>}
          {tab === 'context' && <LifeTab upcoming={apiContexts.upcoming} active={apiContexts.active} activeContext={activeContext} plansHook={plansHook} onAddContext={() => setContextModalOpen(true)} onQuickContext={type => setQuickContextType(type)} onImBetter={() => setRecoveryOpen(true)} onExtend={handleExtendContext} onDetailOpen={handleDetailOpen}/>}
        </div>
      </main>

      <footer style={{ textAlign: 'center', fontSize: 11, color: C.inkMute, padding: '24px', borderTop: `1px solid ${C.hairline}`, fontStyle: 'italic' }}>
        Heed — CWB Hackathon 2026 · Azure OpenAI + Cosmos DB + AI Search
      </footer>

      <AddTaskModal open={modalOpen} onClose={() => { setModalOpen(false); setEditingTask(null) }} onSubmit={handleAddTask} onDelete={handleDeleteTask} initialData={editingTask} customCategories={customCategories}/>
      <AddRoutineModal open={routineModalOpen} onClose={() => { setRoutineModalOpen(false); setEditingRoutine(null); setBuildRoutineTask(null) }} onSubmit={handleAddRoutine} initialData={editingRoutine} seedTask={buildRoutineTask} tasks={displayTasks}/>
      <AddContextModal open={contextModalOpen} onClose={() => setContextModalOpen(false)} onSubmit={handleAddContext}/>
      <AskInlineModal open={askOpen} onClose={() => setAskOpen(false)} onLightenRoutine={handleLightenRoutine}/>
      <TaskOptionsSheet task={taskOptionsTask} onClose={() => setTaskOptionsTask(null)} onMarkDone={handleMarkDone} onSkip={handleSkip} onEdit={handleEditTask} onAddToRoutine={t => setAddToRoutineTask(t)} onBuildRoutine={t => { setBuildRoutineTask(t); setRoutineModalOpen(true) }}/>
      <AddToRoutineSheet task={addToRoutineTask} routines={routines} onClose={() => setAddToRoutineTask(null)} onSelect={handleAddTaskToRoutine}/>
      <QuickContextSheet type={quickContextType} onClose={() => setQuickContextType(null)} onActivate={handleQuickContext}/>
      <RecoverySummarySheet open={recoveryOpen} context={activeContext} heldTasks={activeContext ? displayTasks.filter(t => activeContext.heldTaskIds.includes(t.id)) : []} onClose={() => setRecoveryOpen(false)} onResumeAll={() => handleEndContext('resume')} onEaseBack={() => handleEndContext('ease')}/>
      <ContextDetailSheet
        open={detailOpen}
        ctx={detailCtx}
        heldTasks={detailCtx?._status === 'active' && activeContext ? displayTasks.filter(t => activeContext.heldTaskIds.includes(t.id)) : []}
        onClose={handleDetailClose}
        onImBetter={() => { handleDetailClose(); setRecoveryOpen(true) }}
        onExtend={() => { handleDetailClose(); handleExtendContext() }}
        onAskHeed={handleAskHeed}
      />
      <ShareCardSheet routine={shareCtx} onClose={handleShareClose}/>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} userName={userName} onUserName={handleUserName} theme={theme} onTheme={handleSetTheme} customCategories={customCategories} onAddCategory={cat => setCustomCategories(cs => [...cs, cat])} customEventTypes={customEventTypes} onAddEventType={evt => setCustomEventTypes(es => [...es, evt])} onResetAllData={handleResetAllData} onLoadDemoData={handleLoadDemoData} efMode={efMode} onSetEfMode={handleSetEfMode}/>
      {toast && <Toast message={toast.message} onView={toast.showView ? handleToastView : undefined} onUndo={toast.onUndo} onDismiss={() => setToast(null)} reasons={toast.reasons} onReason={toast.onReason}/>}
      <HeedFAB onAddTask={() => setModalOpen(true)} onAskHeed={() => setAskOpen(true)} onAddRoutine={() => setRoutineModalOpen(true)}/>
    </div>
  )
}
