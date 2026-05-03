"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react'
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

const TASKS_DEMO = (() => {
  const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() }
  const from = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  return [
    { id: 'demo_1', status: 'active', name: 'Pay electricity bill',   category: 'finance',       next_due_at: ago(14), last_done_at: ago(44), explicit_cadence_days: 30 },
    { id: 'demo_2', status: 'active', name: 'Call Mom',               category: 'relationships', next_due_at: ago(8),  last_done_at: ago(15), learned_cadence_days: 7  },
    { id: 'demo_3', status: 'active', name: 'Refill water dispenser', category: 'home',          next_due_at: ago(5),  last_done_at: ago(19), explicit_cadence_days: 14 },
    { id: 'demo_4', status: 'active', name: 'Take vitamins',          category: 'health',        next_due_at: ago(3),  last_done_at: ago(3),  explicit_cadence_days: 1  },
    { id: 'demo_5', status: 'active', name: 'Submit expense report',  category: 'admin',         next_due_at: ago(1),  last_done_at: ago(31), explicit_cadence_days: 30 },
    { id: 'demo_6', status: 'active', name: 'Clean bathroom',         category: 'home',          next_due_at: from(2), last_done_at: ago(12), explicit_cadence_days: 14 },
    { id: 'demo_7', status: 'active', name: 'Back up photos',         category: 'admin',         next_due_at: from(5), last_done_at: ago(25), explicit_cadence_days: 30 },
  ]
})()

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
    id: 'plan-3', type: 'goal', icon: '🎯', title: 'Save ₱50,000',
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
    ? `every ~${task.learned_cadence_days} days`
    : task.explicit_cadence_days
    ? `every ${task.explicit_cadence_days} days`
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
function useChat({ onLightenRoutine } = {}) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(null)
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)

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
function useMic(onTranscript) {
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
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recogRef.current = r
    r.start()
  }, [listening, supported, onTranscript, stop])
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

// ── MobileBottomNav ────────────────────────────────────────────
function MobileBottomNav({ tab, onTab }) {
  const askActive = tab === 'ask'
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
        {/* Owl circle — overlaps the top edge of the nav bar */}
        <button
          onClick={() => onTab('ask')}
          aria-label="Ask Heed"
          aria-current={askActive ? 'page' : undefined}
          style={{
            position: 'absolute',
            top: -30,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: C.paper,
            border: `2.5px solid ${askActive ? C.warmDark : `${C.warmDark}99`}`,
            boxShadow: askActive
              ? `0 0 0 3px ${C.paper}, 0 0 0 6px ${C.warmDark}55, 0 -6px 24px rgba(0,0,0,0.28)`
              : `0 0 0 3px ${C.paper}, 0 0 0 5px ${C.border}, 0 -4px 20px rgba(0,0,0,0.22)`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            zIndex: 52,
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          }}
        >
          <MayaOwl size={50} idle={false}/>
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
              <div style={{ transition: 'opacity 0.15s', opacity: active ? 1 : 0.7 }}>
                {navIcon}
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
              return (
                <button key={i}
                  onClick={() => setActivePreviewIndex(i)}
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
      if (!wasActive) { snapBack(); return }
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

// ── HeroCard ───────────────────────────────────────────────────
function HeroCard({ task, onMarkDone, onSkip, onMoreOptions }) {
  const [hover, setHover] = useState(false)
  const { ref: swipeRef } = useSwipe(
    () => onMarkDone?.(task),
    () => onSkip?.(task),
  )
  const handleCardClick = (e) => {
    // Don't intercept clicks on inner buttons / inputs.
    if (e.target.closest('button, a, input, textarea, select')) return
    onMoreOptions?.(task)
  }
  const c = CATEGORY[task.category] || CATEGORY.admin
  const isCritical = task.overdue >= 7
  return (
    <div style={{ position: 'relative', marginBottom: 2, touchAction: 'pan-y', userSelect: 'none' }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
        pointerEvents: 'none',
      }}>
        <span data-badge="done" style={{ fontSize: 22, color: C.sage, opacity: 0 }}>✓</span>
        <span data-badge="skip" style={{ fontSize: 22, color: C.ochre, opacity: 0 }}>↷</span>
      </div>
      <div
        ref={swipeRef}
        className="heed-card"
        onClick={handleCardClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: `linear-gradient(135deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
          border: `1.5px solid ${isCritical ? C.rust + '66' : C.border}`,
          borderRadius: 16, padding: '22px 24px',
          boxShadow: hover ? C.shadowMed : C.shadowSoft,
          position: 'relative', overflow: 'hidden',
          animation: 'heed-fadeUp 0.5s ease both',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: isCritical ? C.rust : c.color }}/>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <CategoryBadge category={task.category}/>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: -0.3 }}>{task.name}</span>
              {task.learned && <Pill tone="sage">✨ learned</Pill>}
              {task.importance && <ImportanceBadge importance={task.importance}/>}
            </div>
            <div style={{ fontSize: 13, color: C.inkMute, marginBottom: task.note ? 10 : 0 }}>
              {task.cadence} · last done {task.lastDone}
            </div>
            {task.note && (
              <div style={{ fontSize: 13, color: C.inkSoft, fontStyle: 'italic', borderLeft: `3px solid ${C.border}`, paddingLeft: 12, marginTop: 10 }}>
                {task.note}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 36, fontWeight: 700, color: isCritical ? C.rust : C.ochre, lineHeight: 1 }}>
              {task.overdue}d
            </div>
            <div style={{ fontSize: 11, color: C.inkMute, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 }}>overdue</div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={getBtnPrimary()} onClick={() => onMarkDone?.(task)}>Mark done</button>
          <button style={getBtnGhost()} onClick={() => onSkip?.(task)}>Skip</button>
          <button aria-label="More options" style={{ ...getBtnGhost(), marginLeft: 'auto', width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0 }} onClick={() => onMoreOptions?.(task)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TaskCard ───────────────────────────────────────────────────
function TaskCard({ task, delay = 0, onMarkDone, onSkip, onMoreOptions }) {
  const [hover, setHover] = useState(false)
  const { ref: swipeRef } = useSwipe(
    () => onMarkDone?.(task),
    () => onSkip?.(task),
  )
  const handleCardClick = (e) => {
    if (e.target.closest('button, a, input, textarea, select')) return
    onMoreOptions?.(task)
  }
  const c = CATEGORY[task.category] || CATEGORY.admin
  const isOverdue = task.overdue != null
  const isCritical = isOverdue && task.overdue >= 7
  return (
    <div style={{ position: 'relative', marginBottom: 10, touchAction: 'pan-y', userSelect: 'none' }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
        pointerEvents: 'none',
      }}>
        <span data-badge="done" style={{ fontSize: 18, color: C.sage, opacity: 0 }}>✓</span>
        <span data-badge="skip" style={{ fontSize: 18, color: C.ochre, opacity: 0 }}>↷</span>
      </div>
      <div
        ref={swipeRef}
        className="heed-card"
        onClick={handleCardClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
          border: `1.5px solid ${isCritical ? C.rust + '44' : C.border}`,
          borderRadius: 12, padding: '14px 16px 14px 20px',
          boxShadow: hover ? C.shadowMed : C.shadowSoft,
          position: 'relative',
          animation: 'heed-fadeUp 0.5s ease both',
          animationDelay: `${delay}ms`,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isCritical ? C.rust : c.color, borderRadius: '3px 0 0 3px' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          <CategoryBadge category={task.category}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: C.ink, letterSpacing: -0.1 }}>{task.name}</span>
              {task.learned && <Pill tone="sage">✨ learned</Pill>}
              {task.importance && <ImportanceBadge importance={task.importance}/>}
            </div>
            <div style={{ fontSize: 12.5, color: C.inkMute }}>{task.cadence} · last done {task.lastDone}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
            {isOverdue && (<>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 600, color: isCritical ? C.rust : C.ochre, lineHeight: 1 }}>{task.overdue}d</div>
              <div style={{ fontSize: 10, color: C.inkMute, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 }}>overdue</div>
            </>)}
            {!isOverdue && task.dueIn === 0 && <Pill tone="sage">today</Pill>}
            {!isOverdue && task.dueIn > 0 && <div style={{ fontSize: 12.5, color: C.inkMute }}>in {task.dueIn}d</div>}
          </div>
        </div>
        {hover && (
          <div className="heed-task-actions" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', animation: 'heed-fadeIn 0.2s ease' }}>
            <button style={getBtnPrimary()} onClick={() => onMarkDone?.(task)}>Mark done</button>
            <button style={getBtnGhost()} onClick={() => onSkip?.(task)}>Skip</button>
            <button aria-label="More options" style={{ ...getBtnGhost(), marginLeft: 'auto', width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, flexShrink: 0 }} onClick={() => onMoreOptions?.(task)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>
            </button>
          </div>
        )}
      </div>
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
  const isAttention = routine.suggestion !== null
  const isLightened = !!routine.lightenedItems?.length
  const borderColor = isLightened
    ? `${C.sage}73`
    : isAttention && !isLightened
    ? `${C.ochre}73`
    : C.border
  const { ref: swipeRef } = useSwipe(
    () => onMarkDone?.(routine.id),
    () => onSkipToday?.(routine.id),
  )
  return (
    <div style={{ position: 'relative', marginBottom: 8, touchAction: 'pan-y', userSelect: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', pointerEvents: 'none' }}>
        <span data-badge="done" style={{ fontSize: 16, color: C.sage, opacity: 0 }}>✓</span>
        <span data-badge="skip" style={{ fontSize: 16, color: C.ochre, opacity: 0 }}>↷</span>
      </div>
      <div
        ref={swipeRef}
        className="heed-card"
        style={{
          background: C.paperHi,
          border: `1px solid ${borderColor}`,
          borderRadius: 10,
          padding: '11px 14px',
          animation: 'heed-fadeUp 0.5s ease both',
          animationDelay: `${delay}ms`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.ink }}>{routine.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: isHealthy ? C.sage : C.ochre }}>
            {isHealthy ? '✓' : '⚠'} {thisWeekCount}/7 this week
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {last7.map((done, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: done ? C.sage : C.border }}/>
            ))}
            <span style={{ marginLeft: 4, fontSize: 10, color: C.inkMute, fontStyle: 'italic' }}>today →</span>
          </div>
          {isLightened && (
            <span style={{ fontSize: 10.5, fontWeight: 600, color: C.sage, background: C.sageSoft, border: `1px solid ${C.sage}4d`, borderRadius: 999, padding: '2px 9px' }}>
              {routine.lightenedItems.length} items optional
            </span>
          )}
          {isAttention && !isLightened && (
            <span
              onClick={() => onLighten?.(routine.id)}
              style={{ fontSize: 10.5, fontWeight: 600, color: C.ochre, background: C.ochreSoft, border: `1px solid ${C.ochre}40`, borderRadius: 999, padding: '2px 9px', cursor: 'pointer' }}
            >
              Lighten this week →
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── RoutineCard ────────────────────────────────────────────────
function RoutineCard({ routine, delay = 0, onMarkDone, onLighten, onEdit, onShare }) {
  const [hover, setHover] = useState(false)
  const completionRate = routine.completion14d.filter(Boolean).length / routine.completion14d.length
  const isAttentionWorthy = routine.suggestion !== null
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
        animation: 'heed-fadeUp 0.5s ease both', animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ marginBottom: 3 }}>
            <span style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{routine.name}</span>
          </div>
          <div style={{ fontSize: 12, color: C.inkMute }}>{routine.schedule} · {routine.weekRate}</div>
        </div>
        <div style={{ position: 'relative', width: 52, height: 52 }}>
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
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {routine.items.map((item, i) => {
          const isOptional = routine.lightenedItems?.includes(item)
          return (
            <span key={i} style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: 500,
              background: isOptional ? 'transparent' : C.bellySoft,
              color: isOptional ? C.inkMute : C.warmDark,
              border: isOptional ? `1px dashed ${C.border}` : 'none',
              textDecoration: isOptional ? 'line-through' : 'none',
              opacity: isOptional ? 0.6 : 1,
            }}>{item}</span>
          )
        })}
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.inkMute, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>Last 14 days</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {routine.completion14d.map((done, i) => (
            <svg key={i} width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
              <path d="M8 1 C8 1, 15 5, 15 10 C15 14, 12 17, 8 17 C4 17, 1 14, 1 10 C1 5, 8 1, 8 1 Z"
                fill={done ? C.sage : 'transparent'}
                stroke={done ? C.sage : C.border}
                strokeWidth="1.5"
                strokeDasharray={done ? 'none' : '2 2'}
              />
            </svg>
          ))}
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
      <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={getBtnPrimary()} onClick={() => onMarkDone && onMarkDone(routine.id)}>Mark today done</button>
        {isAttentionWorthy && <button style={{ ...getBtnPrimary(), background: C.ochre, color: C.warmDeep }} onClick={() => onLighten && onLighten(routine.id)}>Lighten this week</button>}
        <button style={getBtnGhost()} onClick={() => onEdit && onEdit(routine)}>Edit</button>
        <button style={getBtnGhost()} onClick={() => onShare && onShare(routine)}>Share card</button>
      </div>
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
function TodayTab({ tasks, routines, upcomingContexts, onMarkDone, onSkip, onMarkRoutineDone, onSkipRoutineToday, onLightenRoutine, onEditRoutine, onAskHeed, onMoreOptions, onShareCard }) {
  const overdue = tasks.filter(t => t.overdue != null).sort((a, b) => b.overdue - a.overdue)
  const heroTask = overdue[0]
  const otherOverdue = overdue.slice(1)
  const upcoming = tasks.filter(t => t.dueIn !== undefined)
  return (
    <div>
      <ContextBanner upcomingContexts={upcomingContexts} onAskHeed={onAskHeed}/>
      <SectionHeader motif="leaf">Top of mind</SectionHeader>
      {heroTask ? <HeroCard task={heroTask} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions}/> : (
        <div style={{ fontSize: 13.5, color: C.inkMute, fontStyle: 'italic', padding: '12px 0' }}>Nothing critical right now. Nice.</div>
      )}
      <div style={{ marginTop: 28 }}>
        <SectionHeader motif="stem" count={routines.length}>Routines</SectionHeader>
        {routines.map((r, i) => <RoutineRow key={r.id} routine={r} delay={i * 80} onMarkDone={onMarkRoutineDone} onSkipToday={onSkipRoutineToday} onLighten={onLightenRoutine}/>)}
      </div>
      {otherOverdue.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionHeader motif="thorn" count={otherOverdue.length}>Also overdue</SectionHeader>
          {otherOverdue.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions}/>)}
        </div>
      )}
      {upcoming.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionHeader motif="berry" count={upcoming.length}>Coming up</SectionHeader>
          {upcoming.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions}/>)}
        </div>
      )}
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
    <div style={{ background: C.paper, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 12, fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', animation: 'heed-fadeIn 0.3s ease' }}>
      {steps.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', animation: 'heed-fadeUp 0.3s ease both' }}>
          <span style={{ color: C.sage, fontSize: 14 }}>›</span>
          <span>{t}</span>
          {i === steps.length - 1 && <span style={{ marginLeft: 4, color: C.sage, animation: 'heed-blink 1s infinite' }}>●</span>}
        </div>
      ))}
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
        animation: listening ? 'heed-breathe 1.2s ease-in-out infinite' : 'none',
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

function AskTab({ prefill = '', onLightenRoutine }) {
  const { messages, input, setInput, thinking, streaming, busy, send, executeAction } = useChat({ onLightenRoutine })
  const scrollRef = useRef(null)
  const { listening, toggle: toggleMic, supported: micSupported } = useMic(useCallback((text) => setInput(text), [setInput]))
  useEffect(() => {
    if (prefill) setInput(prefill)
  }, [prefill, setInput])
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
          {thinking && thinking.length > 0 && <ThinkingBubble steps={thinking}/>}
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

function TracksTab({ tasks, routines, onMarkDone, onSkip, onMarkRoutineDone, onLightenRoutine, onEditRoutine, onAddTask, onAddRoutine, onMoreOptions, onShareCard }) {
  const [subtab, setSubtab] = useState('routines')
  const [filter, setFilter] = useState('all')
  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.category === filter)
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
          {routines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 50} onMarkDone={onMarkRoutineDone} onLighten={onLightenRoutine} onEdit={onEditRoutine} onShare={onShareCard}/>)}
        </div>
      )}
      {subtab === 'tasks' && (
        <div style={{ animation: 'heed-fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all','home','finance','relationships','health','admin','work'].map(cat => (
                <button key={cat} onClick={() => setFilter(cat)} style={{ background: filter === cat ? C.warmDark : C.paper, color: filter === cat ? C.cream : C.warmDark, border: `1px solid ${filter === cat ? C.warmDark : C.border}`, padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit', transition: 'all 0.15s' }}>{cat}</button>
              ))}
            </div>
            <button onClick={onAddTask} style={getBtnPrimary()}>+ Add task</button>
          </div>
          <div>
            {filteredTasks.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 30} onMarkDone={onMarkDone} onSkip={onSkip} onMoreOptions={onMoreOptions}/>)}
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

// ── usePlans — localStorage-backed plan state ─────────────────
function usePlans(initialPlans) {
  const [plans, setPlans] = useState(() => {
    try {
      const saved = localStorage.getItem('heed_plans')
      return saved ? JSON.parse(saved) : initialPlans
    } catch {
      return initialPlans
    }
  })

  useEffect(() => {
    localStorage.setItem('heed_plans', JSON.stringify(plans))
  }, [plans])

  const checkTask = useCallback((planId, taskIndex) => {
    setPlans(prev => prev.map(p => p.id !== planId ? p : {
      ...p, tasks: p.tasks.map((t, i) => i === taskIndex ? { ...t, done: !t.done } : t),
    }))
  }, [])

  const renameTask = useCallback((planId, taskIndex, newLabel) => {
    setPlans(prev => prev.map(p => p.id !== planId ? p : {
      ...p, tasks: p.tasks.map((t, i) => i === taskIndex ? { ...t, label: newLabel } : t),
    }))
  }, [])

  const addTask = useCallback((planId, label) => {
    setPlans(prev => prev.map(p => p.id !== planId ? p : {
      ...p, tasks: [...p.tasks, { label, done: false }],
    }))
  }, [])

  const deleteTask = useCallback((planId, taskIndex) => {
    setPlans(prev => prev.map(p => p.id !== planId ? p : {
      ...p, tasks: p.tasks.filter((_, i) => i !== taskIndex),
    }))
  }, [])

  const reorderTasks = useCallback((planId, fromIndex, toIndex) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const t = [...p.tasks]
      const [moved] = t.splice(fromIndex, 1)
      t.splice(toIndex, 0, moved)
      return { ...p, tasks: t }
    }))
  }, [])

  const addPlan = useCallback((plan) => {
    setPlans(prev => [plan, ...prev])
  }, [])

  return { plans, checkTask, renameTask, addTask, deleteTask, reorderTasks, addPlan }
}

// ── PlanCard ────────────────────────────────────────────────────
const PLAN_ICON_BG = { project: '#f0e8d8', goal: '#f5f0d8', event: '#e8f0e8' }

function PlanCard({ plan, delay = 0 }) {
  const doneCount = plan.tasks ? plan.tasks.filter(t => t.done).length : 0
  const totalCount = plan.tasks ? plan.tasks.length : 0
  const pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0
  const goalPct = plan.type === 'goal' && plan.target > 0
    ? Math.round(plan.current / plan.target * 100)
    : 0
  const daysUntil = plan.eventDate
    ? Math.round((plan.eventDate - new Date()) / 86400000)
    : null
  const undone = plan.tasks ? plan.tasks.filter(t => !t.done) : []
  const preview = undone.slice(0, 2)
  const extra = undone.length - preview.length

  const subtitle = plan.type === 'project'
    ? `${doneCount} of ${totalCount} tasks · Due ${plan.dueDate}`
    : plan.type === 'goal'
    ? `${plan.unit}${(plan.current ?? 0).toLocaleString()} saved · Target ${plan.targetDate}`
    : daysUntil === null ? plan.title
    : daysUntil <= 0    ? 'Today!'
    : daysUntil === 1   ? 'Tomorrow'
    : `in ${daysUntil} days`

  const badge = {
    project: <div style={{ fontSize: 13, fontWeight: 700, color: C.rust, flexShrink: 0 }}>{pct}%</div>,
    goal:    <div style={{ fontSize: 13, fontWeight: 700, color: C.ochre, flexShrink: 0 }}>{goalPct}%</div>,
    event:   undone.length > 0
               ? <div style={{ background: '#e8f0e8', color: '#3a6840', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{undone.length} left</div>
               : null,
  }[plan.type]

  return (
    <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10, animation: `heed-fadeIn 0.2s ease ${delay}ms both` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: PLAN_ICON_BG[plan.type] || C.bellySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {plan.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.title}</div>
          <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>{subtitle}</div>
        </div>
        {badge}
      </div>

      {(plan.type === 'project' || plan.type === 'goal') && (
        <div style={{ height: 4, background: C.bellySoft, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, background: plan.type === 'project' ? C.rust : C.ochre, width: `${plan.type === 'project' ? pct : goalPct}%`, transition: 'width 0.4s ease' }}/>
        </div>
      )}

      {plan.type === 'goal' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ background: '#f5f0d8', color: '#7a6a20', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
            {plan.unit}{((plan.target ?? 0) - (plan.current ?? 0)).toLocaleString()} to go
          </span>
        </div>
      )}

      {(plan.type === 'project' || plan.type === 'event') && preview.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', borderTop: `1px solid ${C.hairline}`, fontSize: 12, color: C.ink }}>
          <div style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${C.border}`, flexShrink: 0 }}/>
          {t.label}
        </div>
      ))}
      {(plan.type === 'project' || plan.type === 'event') && extra > 0 && (
        <div style={{ fontSize: 11, color: C.inkMute, padding: '5px 0', borderTop: `1px solid ${C.hairline}`, marginTop: 2 }}>+ {extra} more task{extra !== 1 ? 's' : ''}</div>
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

function AddPlanSheet({ onClose, onAdd }) {
  const [step, setStep]   = useState('pick')   // 'pick' | 'form'
  const [type, setType]   = useState(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate]         = useState('')
  const [tasksText, setTasksText]     = useState('')
  const [targetAmt, setTargetAmt]     = useState('')
  const [unit, setUnit]               = useState('₱')
  const [targetDate, setTargetDate]   = useState('')
  const [eventDate, setEventDate]     = useState('')

  const inputStyle = { width: '100%', background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 4 }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: C.inkMute, display: 'block', marginTop: 12 }

  const handleSubmit = () => {
    if (!title.trim()) return
    if (type === 'goal' && (parseFloat(targetAmt) || 0) <= 0) return
    const parsedTasks = tasksText.split('\n').map(s => s.trim()).filter(Boolean).map(label => ({ label, done: false }))
    const plan = { id: `plan-${Date.now()}`, type, icon: PLAN_TYPES.find(p => p.type === type).icon, title: title.trim() }
    if (type === 'project') { plan.dueDate = dueDate || 'No due date'; plan.tasks = parsedTasks }
    if (type === 'goal')    { plan.current = 0; plan.target = parseFloat(targetAmt) || 0; plan.unit = unit || ''; plan.targetDate = targetDate || 'No target date' }
    if (type === 'event')   { plan.eventDate = eventDate ? new Date(eventDate) : null; plan.tasks = parsedTasks }
    onAdd(plan)
    setStep('pick'); setType(null); setTitle(''); setDueDate(''); setTasksText(''); setTargetAmt(''); setUnit('₱'); setTargetDate(''); setEventDate('')
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

            {type === 'project' && (
              <>
                <label style={labelStyle}>Due date (optional)</label>
                <input type="date" style={inputStyle} value={dueDate} onChange={e => setDueDate(e.target.value)}/>
                <label style={labelStyle}>Tasks (one per line, optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder={"Book moving truck\nPack bedroom\nNotify landlord"} value={tasksText} onChange={e => setTasksText(e.target.value)}/>
              </>
            )}

            {type === 'goal' && (
              <>
                <label style={labelStyle}>Target amount *</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input style={{ ...inputStyle, width: 64, marginTop: 0 }} placeholder="₱" value={unit} onChange={e => setUnit(e.target.value)}/>
                  <input type="number" style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="50000" value={targetAmt} onChange={e => setTargetAmt(e.target.value)}/>
                </div>
                <label style={labelStyle}>Target date (optional)</label>
                <input style={inputStyle} placeholder="e.g. Aug 2026" value={targetDate} onChange={e => setTargetDate(e.target.value)}/>
              </>
            )}

            {type === 'event' && (
              <>
                <label style={labelStyle}>Event date *</label>
                <input type="date" style={inputStyle} value={eventDate} onChange={e => setEventDate(e.target.value)}/>
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

// ── PlansPanel ───────────────────────────────────────────────────
function PlansPanel() {
  const [plans, setPlans] = useState(DEMO_PLANS)
  const [addOpen, setAddOpen] = useState(false)
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
      {plans.map((p, i) => <PlanCard key={p.id} plan={p} delay={i * 50}/>)}
      {addOpen && <AddPlanSheet onClose={() => setAddOpen(false)} onAdd={p => { setPlans(ps => [p, ...ps]); setAddOpen(false) }}/>}
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
function LifeTab({ upcoming, active, activeContext, onAddContext, onQuickContext, onImBetter, onExtend, onDetailOpen }) {
  const [subtab, setSubtab] = useState('plans')
  const allUpcoming = [...(active || []).map(mapApiContext), ...(upcoming || []).map(mapApiContext)]
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <SectionHeader>Life</SectionHeader>
        <div style={{ fontSize: 12.5, color: C.inkMute, fontStyle: 'italic', marginTop: -8 }}>Your plans and life events, in one place.</div>
      </div>
      <div style={{ display: 'flex', background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, marginBottom: 18, gap: 4 }}>
        <SegmentButton active={subtab === 'plans'} onClick={() => setSubtab('plans')} label="Plans" count={DEMO_PLANS.length} accent={C.warmDark}/>
        <SegmentButton active={subtab === 'events'} onClick={() => setSubtab('events')} label="Life Events" count={allUpcoming.length} accent={C.sage}/>
      </div>
      {subtab === 'plans'  && <PlansPanel/>}
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

function CalendarTab({ tasks, contexts, routines, onReschedule, onMarkDone, onSkip, onAddTask, onAddContext, onEditRoutine }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [weekStart, setWeekStart]     = useState(startOfWeek(TODAY_DATE))
  const [detailTask, setDetailTask]   = useState(null)

  useEffect(() => {
    const target = (weekStart.getFullYear() - TODAY_DATE.getFullYear()) * 12
      + (weekStart.getMonth() - TODAY_DATE.getMonth())
    setMonthOffset(target)
  }, [weekStart])

  function handleWeekOffsetChange(delta) {
    setWeekStart(ws => addDays(ws, delta * 7))
  }

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
        <div style={{ position: 'fixed', bottom: 110, right: 28, zIndex: 51, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <SpeedDialItem label="Add a task" sublabel="Track something new" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" stroke="currentColor" strokeWidth="1.9"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>} iconBg={C.ochre} iconFg={C.warmDeep} onClick={() => { setOpen(false); onAddTask() }} delay={0}/>
          <SpeedDialItem label="Build a routine" sublabel="A cluster of things together" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 2l4 4-4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/><path d="M7 22l-4-4 4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>} iconBg={C.sage} iconFg={C.cream} onClick={() => { setOpen(false); onAddRoutine() }} delay={50}/>
          <SpeedDialItem label="Ask Heed" sublabel="Get answers from anywhere" icon={<MayaOwl size={22} idle={false}/>} iconBg={C.bellySoft} iconFg={C.warmDark} onClick={() => { setOpen(false); onAskHeed() }} delay={100}/>
        </div>
      )}
      <button className="heed-fab-btn" onClick={() => setOpen(o => !o)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        aria-label={open ? 'Close menu' : 'Open Heed menu'} aria-expanded={open}
        style={{ position: 'fixed', bottom: 28, right: 28, width: 64, height: 64, borderRadius: '50%', border: 'none', background: `radial-gradient(circle at 35% 30%, ${C.warm} 0%, ${C.warmDark} 70%, ${C.warmDeep} 100%)`, cursor: 'pointer', boxShadow: (hover || open) ? '0 12px 32px rgba(124,83,51,0.35), 0 0 0 6px rgba(212,162,76,0.15)' : '0 6px 18px rgba(124,83,51,0.30)', transform: open ? 'rotate(45deg) scale(1.05)' : hover ? 'translateY(-3px) scale(1.05)' : 'none', transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 52 }}>
        <div style={{ position: 'relative', animation: (hover && !open) ? 'heed-bob 0.6s ease-in-out infinite' : 'none', transform: open ? 'rotate(-45deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <MayaOwl size={42} idle={false}/>
        </div>
        <div style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: open ? C.rust : C.ochre, color: open ? C.cream : C.warmDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', border: `2px solid ${C.cream}`, transition: 'background 0.2s' }}>+</div>
      </button>
    </>
  )
}

// ── AskInlineModal ─────────────────────────────────────────────
function AskInlineModal({ open, onClose, onLightenRoutine }) {
  const { messages, input, setInput, thinking, streaming, busy, send, executeAction } = useChat({ onLightenRoutine })
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const { listening, toggle: toggleMic, supported: micSupported } = useMic(useCallback((text) => setInput(text), [setInput]))
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
            )}
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content}
                actions={m.actions} chips={m.chips}
                onConfirm={(actionIndex) => executeAction(i, actionIndex)}
                onChipClick={(text) => send(text)}
              />
            ))}
            {thinking && thinking.length > 0 && <ThinkingBubble steps={thinking}/>}
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
function AddTaskModal({ open, onClose, onSubmit, initialData = null }) {
  const isEdit = !!initialData
  const [name, setName] = useState('')
  const [category, setCategory] = useState('home')
  const [importance, setImportance] = useState('medium')
  const [cadenceMode, setCadenceMode] = useState('learn')
  const [cadenceDays, setCadenceDays] = useState(7)
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
    } else {
      setName(''); setCategory('home'); setImportance('medium'); setCadenceMode('learn'); setCadenceDays(7)
    }
    if (inputRef.current) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, initialData])
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
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(CATEGORY).map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} style={{ background: category === cat ? CATEGORY[cat].bg : C.paper, color: category === cat ? CATEGORY[cat].color : C.inkSoft, border: `1.5px solid ${category === cat ? CATEGORY[cat].color : C.border}`, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 13 }}>{CATEGORY[cat].icon}</span>{cat.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={getFieldLabel()}>How important?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'low',    tone: C.sage  },
                { v: 'medium', tone: C.ochre },
                { v: 'high',   tone: C.rust  },
              ].map(({ v, tone }) => (
                <button key={v} onClick={() => setImportance(v)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: tone, color: C.cream,
                    padding: '11px 8px', borderRadius: 10, minHeight: 44,
                    fontSize: 13,
                    fontWeight: v === 'high' ? 700 : v === 'medium' ? 500 : 400,
                    border: importance === v ? `2.5px solid ${C.cream}` : '2.5px solid transparent',
                    boxShadow: importance === v
                      ? (v === 'high' ? `0 0 0 2px ${tone}, 0 3px 10px ${tone}50` : `0 0 0 2px ${tone}`)
                      : 'none',
                    opacity: importance === v ? 1 : 0.5,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
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
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={getFieldLabel()}>How often?</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button onClick={() => setCadenceMode('learn')} style={{ flex: 1, background: cadenceMode === 'learn' ? C.bellySoft : C.paper, color: cadenceMode === 'learn' ? C.warmDark : C.inkSoft, border: `1.5px solid ${cadenceMode === 'learn' ? C.warmDark + '66' : C.border}`, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s' }}>
                <span style={{ color: C.sage }}>✨</span>Let Heed learn it
              </button>
              <button onClick={() => setCadenceMode('set')} style={{ flex: 1, background: cadenceMode === 'set' ? C.bellySoft : C.paper, color: cadenceMode === 'set' ? C.warmDark : C.inkSoft, border: `1.5px solid ${cadenceMode === 'set' ? C.warmDark + '66' : C.border}`, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>I'll set it</button>
            </div>
            {cadenceMode === 'set' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bellySoft, padding: '10px 14px', borderRadius: 8, animation: 'heed-fadeIn 0.2s ease' }}>
                <span style={{ fontSize: 13, color: C.warmDark }}>Every</span>
                <input type="number" min="1" max="365" value={cadenceDays} onChange={e => setCadenceDays(Math.max(1, Number(e.target.value)||1))}
                  style={{ width: 60, padding: '5px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, textAlign: 'center', fontFamily: 'inherit', color: C.ink, background: C.paper }}
                />
                <span style={{ fontSize: 13, color: C.warmDark }}>day{cadenceDays===1?'':'s'}</span>
                <div style={{ flex: 1, fontSize: 11, color: C.inkMute, fontStyle: 'italic', textAlign: 'right' }}>
                  {[1,7,14,30].map(n => <button key={n} onClick={() => setCadenceDays(n)} style={{ background: 'transparent', border: 'none', color: C.warmDark, fontWeight: 600, cursor: 'pointer', padding: '0 4px', fontFamily: 'inherit', fontSize: 11 }}>{n}d</button>)}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={getBtnGhost()}>Cancel</button>
            <button onClick={submit} disabled={!name.trim()} style={{ ...getBtnPrimary(), padding: '8px 18px', opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>{isEdit ? 'Save changes' : 'Add task'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── AddContextModal ────────────────────────────────────────────
function AddContextModal({ open, onClose, onSubmit }) {
  const [type, setType] = useState('travel')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
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
    onSubmit({ type, description: description.trim(), startDate, endDate })
    setType('travel'); setStartDate(''); setEndDate(''); setDescription('')
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
          <div style={{ marginBottom: 18, display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={getFieldLabel()}>From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }}/>
            </div>
            <div style={{ flex: 1 }}>
              <label style={getFieldLabel()}>To</label>
              <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }}/>
            </div>
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
function AddRoutineModal({ open, onClose, onSubmit, initialData = null, seedTask = null }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState([{ id: 1, name: '' }])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const nameRef = useRef(null)
  useEffect(() => {
    if (!open) return
    if (initialData) {
      setName(initialData.name || '')
      setItems(initialData.items?.map((item, i) => ({ id: i + 1, name: item })) || [{ id: 1, name: '' }])
      setStartDate(initialData.startDate || '')
      setEndDate(initialData.endDate || '')
    } else if (seedTask) {
      setName('')
      setItems([{ id: 1, name: seedTask.name }, { id: 2, name: '' }])
      setStartDate(''); setEndDate('')
    } else {
      setName(''); setItems([{ id: 1, name: '' }]); setStartDate(''); setEndDate('')
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
      onSubmit({ ...initialData, name: name.trim(), items: validItems.map(i => i.name.trim()), ...dateRange })
    } else {
      onSubmit({ id: `custom_${Date.now()}`, name: name.trim(), schedule: 'Custom', items: validItems.map(i => i.name.trim()), completion14d: Array(14).fill(false), insight: 'Just added — building up history.', suggestion: null, weekRate: 'no data yet', ...dateRange })
    }
    onClose()
  }
  if (!open) return null
  const inputStyle = { flex: 1, minWidth: 0, background: C.paper, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, color: C.ink, outline: 'none', fontFamily: 'inherit' }
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
              <label style={getFieldLabel()}>Items in this routine</label>
              {items.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <input value={item.name} onChange={e => updateItem(item.id, e.target.value)} placeholder={`Item ${idx+1} (e.g. ${['Stretch 5 min','Vitamins','Read 10 pages'][idx]||'...'})`} style={inputStyle}/>
                  <button onClick={() => removeItem(item.id)} disabled={items.length===1} style={{ background: 'transparent', border: 'none', color: items.length===1 ? C.hairline : C.inkMute, cursor: items.length===1 ? 'not-allowed' : 'pointer', fontSize: 16, padding: '0 6px', lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}>×</button>
                </div>
              ))}
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
function Toast({ message, onView, onUndo, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#222B33', border: '1px solid #2A3540', borderLeft: `3px solid ${C.sage}`,
      borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center',
      gap: 10, boxShadow: '0 6px 22px rgba(0,0,0,0.45)', zIndex: 9999,
      animation: 'heed-slideUp 0.4s cubic-bezier(0.16,1,0.3,1)', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 16 }}>✓</span>
      <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{message}</span>
      {onUndo && (
        <button onClick={onUndo} style={{ marginLeft: 8, background: 'transparent', border: `1px solid ${C.inkMute}`, color: C.inkSoft, padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Undo</button>
      )}
      {onView && (
        <button onClick={onView} style={{ marginLeft: onUndo ? 4 : 8, background: 'transparent', border: `1px solid ${C.sage}`, color: C.sage, padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>View Tracks</button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss" style={{ marginLeft: 4, background: 'none', border: 'none', color: C.inkMute, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
    </div>
  )
}

// ── TaskOptionsSheet ───────────────────────────────────────────
function TaskOptionsSheet({ task, onClose, onEdit, onAddToRoutine, onBuildRoutine }) {
  if (!task) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, borderRadius: '20px 20px 0 0', padding: `24px 24px calc(24px + env(safe-area-inset-bottom)) 24px`, animation: 'heed-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }}/>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 3 }}>{task.name}</div>
        <div style={{ fontSize: 12.5, color: C.inkMute, marginBottom: 20 }}>{task.cadence}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  const [apiTasks, setApiTasks] = useState([])
  const [apiContexts, setApiContexts] = useState({ active: [], upcoming: [] })
  const [dismissedIds, setDismissedIds] = useState(new Set())
  const [routines, setRoutines] = useState(ROUTINES)
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

  useEffect(() => {
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
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const displayTasks = (apiTasks.length > 0 ? apiTasks : TASKS_DEMO)
    .filter(t => t.status === 'active' && !dismissedIds.has(t.id))
    .map(computeTaskDisplay)

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

  const handleMarkDone = useCallback(async (task) => {
    const taskId = typeof task === 'string' ? task : task.id
    const taskName = typeof task === 'string' ? 'Task' : task.name
    setDismissedIds(s => new Set([...s, taskId]))
    setToast({
      message: `"${taskName}" marked done`,
      onUndo: () => { setDismissedIds(s => { const n = new Set(s); n.delete(taskId); return n }); setToast(null) },
    })
    fetch(`${FUNCTIONS_URL}/api/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, event_type: 'done' }),
    }).catch(() => {})
  }, [FUNCTIONS_URL])

  const handleSkip = useCallback(async (task) => {
    const taskId = typeof task === 'string' ? task : task.id
    const taskName = typeof task === 'string' ? 'Task' : task.name
    setDismissedIds(s => new Set([...s, taskId]))
    setToast({
      message: `"${taskName}" skipped`,
      onUndo: () => { setDismissedIds(s => { const n = new Set(s); n.delete(taskId); return n }); setToast(null) },
    })
    fetch(`${FUNCTIONS_URL}/api/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, event_type: 'skipped', skip_reason: 'other' }),
    }).catch(() => {})
  }, [FUNCTIONS_URL])

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
    setAskPrefill(query)
    setTab('ask')
  }, [])

  const handleToastView = useCallback(() => {
    setToast(null)
    setTab('tracks')
  }, [])

  const handleAddTask = useCallback(async (data) => {
    const body = { name: data.name, category: data.category, importance: data.importance, explicit_cadence_days: data.explicit_cadence_days || null }
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
          setToast({ message: 'Task updated' })
        } else {
          setApiTasks(t => [...t, updated])
          setToast({ message: 'Task added', showView: true })
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
        setToast({ message: 'Context added' })
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
    setToast({ message: isEdit ? 'Routine updated' : 'Routine added', showView: true })
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
    setToast({ message: 'Routine marked done for today' })
  }, [])

  const handleSkipRoutineToday = useCallback((routineId) => {
    setToast({ message: 'Routine skipped for today' })
  }, [])

  const handleLightenRoutine = useCallback((routineId, itemsToStrike = null) => {
    setRoutines(rs => rs.map(r => {
      if (r.id !== routineId) return r
      const strike = itemsToStrike || r.items.slice(Math.ceil(r.items.length / 2))
      return { ...r, suggestion: null, insight: 'Lightened for this week.', lightenedItems: strike }
    }))
    setToast({ message: 'Routine lightened for this week' })
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
    setToast({ message: 'Extended by 2 days' })
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

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at 30% 0%, ${C.paper} 0%, ${C.cream} 60%)`, color: C.ink, fontFamily: '"Nunito Sans", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Nunito+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
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
        <div className="heed-theme-mobile" style={{ alignItems: 'center' }}>
          <ThemeSwitcher theme={theme} onTheme={handleSetTheme}/>
        </div>
      </header>

      <nav className="heed-nav" style={{ display: 'flex', gap: 4, padding: '0 32px', borderBottom: `1px solid ${C.hairline}`, background: C.paper }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'transparent', border: 'none', padding: '14px 20px', fontSize: 14, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.warmDark : C.inkMute, cursor: 'pointer', borderBottom: `2px solid ${tab === t.id ? C.warmDark : 'transparent'}`, marginBottom: -1, fontFamily: 'inherit', transition: 'color 0.15s' }}>
            {t.label}
          </button>
        ))}
      </nav>

      <MobileBottomNav tab={tab} onTab={setTab}/>

      <main className="heed-main" style={{ maxWidth: 820, margin: '0 auto', padding: '28px 32px 100px 32px', minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
        {tab === 'today' && <TodayTab tasks={displayTasks} routines={routines} upcomingContexts={upcomingContexts} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onSkipRoutineToday={handleSkipRoutineToday} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAskHeed={handleAskHeed} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen}/>}
        {tab === 'calendar' && <CalendarTab tasks={apiTasks} contexts={[...(apiContexts.active||[]), ...(apiContexts.upcoming||[])]} routines={routines} onReschedule={handleReschedule} onMarkDone={handleMarkDone} onSkip={handleSkip} onAddTask={() => setModalOpen(true)} onAddContext={() => setContextModalOpen(true)} onEditRoutine={handleEditRoutine}/>}
        {tab === 'ask' && <AskTab prefill={askPrefill} onLightenRoutine={handleLightenRoutine}/>}
        {tab === 'tracks' && <TracksTab tasks={displayTasks} routines={routines} onMarkDone={handleMarkDone} onSkip={handleSkip} onMarkRoutineDone={handleMarkRoutineDone} onLightenRoutine={handleLightenRoutine} onEditRoutine={handleEditRoutine} onAddTask={() => setModalOpen(true)} onAddRoutine={() => setRoutineModalOpen(true)} onMoreOptions={handleMoreOptions} onShareCard={handleShareOpen}/>}
        {tab === 'context' && <LifeTab upcoming={apiContexts.upcoming} active={apiContexts.active} activeContext={activeContext} onAddContext={() => setContextModalOpen(true)} onQuickContext={type => setQuickContextType(type)} onImBetter={() => setRecoveryOpen(true)} onExtend={handleExtendContext} onDetailOpen={handleDetailOpen}/>}
      </main>

      <footer style={{ textAlign: 'center', fontSize: 11, color: C.inkMute, padding: '24px', borderTop: `1px solid ${C.hairline}`, fontStyle: 'italic' }}>
        Heed — CWB Hackathon 2026 · Azure OpenAI + Cosmos DB + AI Search
      </footer>

      <AddTaskModal open={modalOpen} onClose={() => { setModalOpen(false); setEditingTask(null) }} onSubmit={handleAddTask} initialData={editingTask}/>
      <AddRoutineModal open={routineModalOpen} onClose={() => { setRoutineModalOpen(false); setEditingRoutine(null); setBuildRoutineTask(null) }} onSubmit={handleAddRoutine} initialData={editingRoutine} seedTask={buildRoutineTask}/>
      <AddContextModal open={contextModalOpen} onClose={() => setContextModalOpen(false)} onSubmit={handleAddContext}/>
      <AskInlineModal open={askOpen} onClose={() => setAskOpen(false)} onLightenRoutine={handleLightenRoutine}/>
      <TaskOptionsSheet task={taskOptionsTask} onClose={() => setTaskOptionsTask(null)} onEdit={handleEditTask} onAddToRoutine={t => setAddToRoutineTask(t)} onBuildRoutine={t => { setBuildRoutineTask(t); setRoutineModalOpen(true) }}/>
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
      {toast && <Toast message={toast.message} onView={toast.showView ? handleToastView : undefined} onUndo={toast.onUndo} onDismiss={() => setToast(null)} />}
      <HeedFAB onAddTask={() => setModalOpen(true)} onAskHeed={() => setAskOpen(true)} onAddRoutine={() => setRoutineModalOpen(true)}/>
    </div>
  )
}
