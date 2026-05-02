import React, { useState, useEffect, useRef } from 'react';

// ========================================================================
// HEED — Interactive prototype (v3)
// Memory keeper for forgetful adults. Routines as a secondary feature.
// English-only. Editorial warmth meets dashboard precision.
// ========================================================================

// ============================================================
// THE OWL: Maya
// ============================================================
function MayaOwl({ size = 120, mood = "calm", speaking = false, idle = true }) {
  const [blinking, setBlinking] = useState(false);
  const [bob, setBob] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 180);
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!idle) return;
    const interval = setInterval(() => {
      setBob(b => (b + 1) % 360);
    }, 60);
    return () => clearInterval(interval);
  }, [idle]);

  const eyeOpenY = blinking ? 0.05 : (mood === "thinking" ? 0.7 : 1);
  const beakTilt = mood === "thinking" ? -3 : (mood === "happy" ? 4 : 0);
  const bobY = idle ? Math.sin(bob * Math.PI / 180) * 1.5 : 0;

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: `translateY(${speaking ? -2 + bobY : bobY}px) scale(${speaking ? 1.02 : 1})`,
        }}
      >
        <defs>
          <filter id="owlShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="bodyGradient" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#9A7048" />
            <stop offset="60%" stopColor="#6E4A30" />
            <stop offset="100%" stopColor="#4A301F" />
          </radialGradient>
          <radialGradient id="bellyGradient" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#C9B68C" />
            <stop offset="100%" stopColor="#9C8862" />
          </radialGradient>
        </defs>

        <ellipse cx="100" cy="115" rx="68" ry="72" fill="url(#bodyGradient)" filter="url(#owlShadow)" />
        <ellipse cx="100" cy="130" rx="45" ry="52" fill="url(#bellyGradient)" />
        <g opacity="0.35" fill="#D4A24C">
          {[[85,115],[100,110],[115,115],[92,130],[108,130],[85,145],[100,148],[115,145],[92,160],[108,160]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r="1.2" />
          ))}
        </g>
        <path d="M 38 100 Q 30 130 48 165 Q 55 145 60 115 Z" fill="#3A2616" opacity="0.9" />
        <path d="M 162 100 Q 170 130 152 165 Q 145 145 140 115 Z" fill="#3A2616" opacity="0.9" />
        <path d="M 65 60 Q 60 38 72 30 Q 78 48 78 62 Z" fill="#4A301F" />
        <path d="M 135 60 Q 140 38 128 30 Q 122 48 122 62 Z" fill="#4A301F" />
        <ellipse cx="100" cy="78" rx="52" ry="48" fill="#9C8862" />
        <circle cx="78" cy="78" r="20" fill="#E8DCB8" stroke="#3A2616" strokeWidth="2" />
        <circle cx="122" cy="78" r="20" fill="#E8DCB8" stroke="#3A2616" strokeWidth="2" />

        <g style={{ transition: 'transform 0.12s ease-out' }}>
          <ellipse cx="78" cy="78" rx="10" ry={10 * eyeOpenY} fill="#0F1419" />
          {!blinking && (<>
            <circle cx="80" cy="74" r="3.5" fill="#F5EDD8" />
            <circle cx="76" cy="80" r="1.5" fill="#F5EDD8" opacity="0.6" />
          </>)}
        </g>
        <g style={{ transition: 'transform 0.12s ease-out' }}>
          <ellipse cx="122" cy="78" rx="10" ry={10 * eyeOpenY} fill="#0F1419" />
          {!blinking && (<>
            <circle cx="124" cy="74" r="3.5" fill="#F5EDD8" />
            <circle cx="120" cy="80" r="1.5" fill="#F5EDD8" opacity="0.6" />
          </>)}
        </g>

        <g transform={`rotate(${beakTilt} 100 95)`}>
          <path d="M 100 92 L 92 102 Q 100 108 108 102 Z" fill="#B8924E" stroke="#3A2616" strokeWidth="1.2" />
        </g>

        <ellipse cx="68" cy="95" rx="5" ry="3" fill="#D9907F" opacity="0.35" />
        <ellipse cx="132" cy="95" rx="5" ry="3" fill="#D9907F" opacity="0.35" />

        <g fill="#B8924E" stroke="#3A2616" strokeWidth="1">
          <path d="M 86 178 L 82 188 M 90 178 L 90 190 M 94 178 L 98 188" strokeLinecap="round" />
          <path d="M 106 178 L 102 188 M 110 178 L 110 190 M 114 178 L 118 188" strokeLinecap="round" />
        </g>
      </svg>
      {speaking && (
        <span style={{
          position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
          width: 8, height: 8, borderRadius: '50%', background: '#8FB89A',
          animation: 'heed-pulse 1s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

// ============================================================
// DATA
// ============================================================

const TASKS = [
  { id: 1, name: "Call Mom", category: "relationships", importance: "high",
    cadence: "every ~6.4 days", lastDone: "23 days ago", overdue: 17,
    note: "You called every Sunday for 19 weeks, then 3 Sundays in a row got skipped.",
    insight: "Your pattern broke." },
  { id: 2, name: "Pay Maynilad bill", category: "finance", importance: "high",
    cadence: "every ~30 days", lastDone: "47 days ago", overdue: 19,
    note: "Usually paid early in the month. Disconnection risk.",
    insight: "Service may disconnect." },
  { id: 4, name: "Pay Meralco bill", category: "finance", importance: "high",
    cadence: "every ~29 days", lastDone: "38 days ago", overdue: 9,
    note: "Mid-month pattern, payday-aligned.",
    insight: "Tied to your payday cycle." },
  { id: 6, name: "Update expense tracker", category: "admin", importance: "medium",
    cadence: "every 7 days", lastDone: "10 days ago", overdue: 3,
    note: "Saturday ritual; missed last weekend." },
  { id: 7, name: "Clean aircon filter", category: "home", importance: "medium",
    cadence: "every ~76 days", lastDone: "78 days ago", overdue: 2,
    note: "5 cleanings observed at ~11 week intervals.", learned: true },
  { id: 8, name: "Clean cat litter box", category: "home", importance: "high",
    cadence: "every 2 days", lastDone: "2 days ago", dueIn: 0 },
  { id: 10, name: "Refill water dispenser", category: "home", importance: "medium",
    cadence: "every ~9.5 days", lastDone: "6 days ago", dueIn: 3, learned: true },
  { id: 11, name: "Submit timesheet", category: "work", importance: "high",
    cadence: "every 7 days", lastDone: "4 days ago", dueIn: 3 },
  { id: 12, name: "Wash bedsheets", category: "home", importance: "medium",
    cadence: "every ~14 days", lastDone: "9 days ago", dueIn: 5, learned: true },
  { id: 13, name: "Change toothbrush", category: "health", importance: "medium",
    cadence: "still learning your cadence", lastDone: "125 days ago", overdue: null,
    note: "Only 1 completion logged. Probably forgotten." },
];

const ROUTINES = [
  {
    id: "morning",
    name: "Morning routine",
    schedule: "Weekdays, ~7:00 AM",
    items: ["Stretch (5 min)", "Vitamin D + B-complex", "Make coffee", "Quick journal"],
    completion14d: [true,true,true,true,false,false,true,true,true,false,true,true,false,false],
    insight: "You skipped Mon and Tue this week.",
    suggestion: "Want me to lighten this for the rest of the week?",
    weekRate: "5 of 7 last week",
  },
  {
    id: "evening",
    name: "Evening wind-down",
    schedule: "Daily, ~10:00 PM",
    items: ["Phone away", "Read 10 pages", "Lights out by 11"],
    completion14d: [true,true,true,true,true,true,true,true,true,true,true,true,true,false],
    insight: "Solid pattern. Staying out of your way.",
    suggestion: null,
    weekRate: "6 of 7 last week",
  },
];

const CONTEXTS_PAST = [
  { type: "travel", start: "Dec 20, 2025", end: "Dec 27, 2025", desc: "Christmas trip to Baguio" },
  { type: "illness", start: "Feb 10, 2026", end: "Feb 14, 2026", desc: "Flu — bed rest" },
  { type: "busy", start: "Mar 16, 2026", end: "Mar 22, 2026", desc: "Client deadline week" },
];
const CONTEXTS_UPCOMING = [
  { type: "travel", start: "Apr 28, 2026", end: "May 2, 2026", desc: "Trip to Singapore", days: 7 },
];

const SUGGESTIONS = [
  { text: "What am I forgetting?", emoji: "🌿" },
  { text: "Plan around my Singapore trip", emoji: "✈️" },
  { text: "I have a busy week — lighten my routine", emoji: "🪶" },
  { text: "Why did I skip my morning routine this week?", emoji: "☕" },
];

const SCRIPTED_RESPONSES = {
  "What am I forgetting?": {
    thinking: [
      "Looking at tasks overdue more than 3 days...",
      "Cross-referencing your importance settings...",
      "Checking if any context windows explain the misses...",
      "Filtering out things you intentionally skipped...",
    ],
    answer: `Here's what you're forgetting, sorted by what matters most:

**🔴 Disconnection risk:**
• **Maynilad bill** — 19 days overdue. You usually pay this early in the month. It's been a while.
• **Meralco bill** — 9 days overdue. Mid-month pattern, payday-aligned. Worth handling today.

**🟡 Personal:**
• **Call Mom** — 17 days overdue. You called her every Sunday for 19 weeks straight, then three Sundays got skipped. Your pattern broke. Want me to draft a quick check-in message, or should I move this to weekdays so the cadence fits your life better?

**🟢 Easier wins:**
• **Clean aircon filter** — 78 days since last clean. Still inside your usual ~11-week range, but worth scheduling.
• **Change toothbrush** — last logged 4 months ago. You probably did it and forgot to mark it done, or it genuinely got missed.

Want me to plan these around your Singapore trip next week?`
  },
  "Plan around my Singapore trip": {
    thinking: [
      "Reading your travel context: Apr 28 to May 2...",
      "Identifying tasks and routines that fall in that window...",
      "Categorizing by what truly can't wait...",
      "Drafting a pre-trip and after-trip plan...",
    ],
    answer: `Got it — **Singapore trip Apr 28 – May 2** is locked in.

**Before you leave (next 6 days):**
• Pay Maynilad and Meralco — handle these this week to avoid disconnection.
• Submit timesheet (Friday).
• Refill water dispenser the day before you fly.

**While you're away:**
• I'll pause your morning and evening routines automatically — no point in tracking misses while you're traveling.
• Cat litter box and plant watering — do you have someone covering these? If yes, tell me their name and I'll exclude these from my "you forgot" list.

**When you're back (May 3–5):**
• I'll resume your routines on May 3 with a soft start — just the essentials for the first day.
• Aircon cleaning can wait until that weekend.

Want me to set up auto-pay reminders for the bills before you go?`
  },
  "I have a busy week — lighten my routine": {
    thinking: [
      "Adding 'busy' context to your timeline...",
      "Looking at your morning routine: 4 items...",
      "Checking which items you tend to keep even on busy days...",
      "Drafting a lighter version...",
    ],
    answer: `Acknowledged — I'm marking this week as busy.

**Your morning routine, lightened:**
Looking at your skip patterns from the last three busy weeks, you almost always keep:
• Vitamins (you keep these 90% of the time, even when stressed)
• Coffee (you wouldn't skip this if the building was on fire)

You usually drop:
• Stretch — you've skipped this on 7 of your last 10 busy days.
• Quick journal — same pattern.

**My suggestion:** This week, your morning routine is just **vitamins + coffee.** I won't ping you about stretch or journal. We'll bring them back on May 4 once your week clears up.

Sound right? I can adjust the lightened version if you'd rather keep something else in.`
  },
  "Why did I skip my morning routine this week?": {
    thinking: [
      "Looking at your morning routine completion history...",
      "Cross-referencing skip days with your calendar context...",
      "Checking for patterns in skip reasons...",
    ],
    answer: `You skipped Monday and Tuesday this week. Here's what I see:

**Pattern across both days:**
• Both days you woke up later than usual (after 8 AM based on first task logs).
• You marked the skip as "too busy" both times.
• Your evening routine those nights ran past midnight — so you were probably tired in the morning.

**The bigger picture:**
Looking at the last 8 weeks, your morning routine completion drops sharply when your bedtime goes past 11 PM. That's the signal — when sleep slips, your morning slips with it.

**A small suggestion:**
Want me to send a "wind down" nudge at 10:30 PM on nights when you've been up late the night before? Not as a habit lecture — just a quiet check-in. You can ignore it. But it might help break the cycle.

Or if you'd rather change the routine itself to be more forgiving, I can do that instead.`
  },
};

const FALLBACK_RESPONSE = {
  thinking: ["Searching your task memory...", "Cross-referencing context...", "Drafting a response..."],
  answer: `This prototype only has a few scripted answers wired up. Try one of the suggestion chips above to see how the real agent responds. The full version uses Microsoft Agent Framework with GPT-4o + Bing grounding to answer anything.`
};

// ============================================================
// DESIGN TOKENS — Dark mode editorial
// Key names preserved from the original light theme so every
// component re-themes by changing only this block. Semantic
// meanings remain identical: e.g. C.paper is still "the
// background of cards" — just dark now.
// ============================================================
const C = {
  // Surfaces (was cream/paper family)
  cream: '#0F1419',       // page background
  paper: '#1A2128',       // card background
  paperHi: '#222B33',     // elevated surface (modals, hero)

  // Text
  ink: '#F5EDD8',         // high-emphasis (was deep brown)
  inkSoft: '#D8CDB1',     // mid-emphasis
  inkMute: '#8A8270',     // low-emphasis / captions

  // Brand warm tones — repurposed for accents on dark
  warm: '#E0B36A',        // hover/glow accents
  warmDark: '#D4A24C',    // PRIMARY accent (mustard) — buttons, FAB
  warmDeep: '#0F1419',    // text on warm buttons (high contrast)

  // Belly tones — used for warm subtle backgrounds
  belly: '#3A3326',       // muted earth-on-dark
  bellySoft: '#2C2820',   // softer

  // Signal colors
  rust: '#E8714C',        // danger/critical (warmer coral than browser red)
  rustSoft: '#3A1F18',    // dark coral wash for danger backgrounds
  sage: '#8FB89A',        // success / learned / on-track
  sageSoft: '#1F2D24',    // dark sage wash
  ochre: '#D4A24C',       // attention / important (matches warmDark)
  ochreSoft: '#2D2618',   // dark mustard wash
  rose: '#D9907F',        // warmth in agent voice moments

  // Structure
  border: '#2A3540',      // visible borders
  hairline: '#1F2730',    // subtle dividers

  // Shadows on dark are subtler — heavier blur, lower alpha
  shadowSoft: '0 2px 12px rgba(0, 0, 0, 0.35)',
  shadowMed: '0 6px 22px rgba(0, 0, 0, 0.45)',
  shadowHigh: '0 12px 36px rgba(0, 0, 0, 0.55)',
};

// Category colors — re-tuned for dark backgrounds.
// Each foreground color is bright enough to read on dark; each
// background is a muted dark wash that still telegraphs the hue.
const CATEGORY = {
  relationships: { color: '#E8714C', bg: '#3A1F18', icon: '✿' },
  finance:       { color: '#E0B36A', bg: '#2D2618', icon: '◈' },
  admin:         { color: '#A89B82', bg: '#26221A', icon: '◷' },
  home:          { color: '#8FB89A', bg: '#1F2D24', icon: '⌂' },
  health:        { color: '#D4A24C', bg: '#2D2618', icon: '✚' },
  work:          { color: '#C9A989', bg: '#2A2218', icon: '◰' },
  self_care:     { color: '#D9907F', bg: '#33211C', icon: '◐' },
};

// ============================================================
// PRIMITIVES
// ============================================================
function Pill({ tone = "neutral", children, glow = false }) {
  const tones = {
    danger: { bg: C.rustSoft, fg: '#FFB59A' },
    warn: { bg: C.ochreSoft, fg: '#F2C97A' },
    sage: { bg: C.sageSoft, fg: '#B8D6BF' },
    neutral: { bg: C.belly, fg: C.inkSoft },
    ink: { bg: C.warmDark, fg: C.cream },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 999,
      fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
      textTransform: 'uppercase', background: t.bg, color: t.fg,
      boxShadow: glow ? `0 0 0 3px ${t.bg}88` : 'none',
    }}>{children}</span>
  );
}

function CategoryBadge({ category, size = 28 }) {
  const c = CATEGORY[category] || CATEGORY.admin;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: c.bg, color: c.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.55, fontWeight: 600, fontFamily: 'Lora, serif',
      flexShrink: 0,
    }}>
      {c.icon}
    </div>
  );
}

// ============================================================
// HERO CARD — agent's primary attention pick
// ============================================================
function HeroCard({ task }) {
  const [hover, setHover] = useState(false);
  const c = CATEGORY[task.category] || CATEGORY.admin;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: `linear-gradient(135deg, ${C.paperHi} 0%, ${c.bg}40 100%)`,
        border: `1px solid ${c.color}33`,
        borderRadius: 16,
        padding: '22px 24px',
        marginBottom: 18,
        boxShadow: hover ? C.shadowHigh : C.shadowMed,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
        animation: 'heed-fadeUp 0.5s ease both',
      }}
    >
      {/* Decorative corner mark */}
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 100, height: 100,
        background: c.color, opacity: 0.06, borderRadius: '50%',
      }} />

      <div style={{
        fontSize: 10, fontWeight: 700, color: c.color,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 14, height: 1.5, background: c.color, display: 'inline-block' }} />
        Heed thinks this matters most today
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <CategoryBadge category={task.category} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Lora, Georgia, serif', fontSize: 24,
            fontWeight: 600, color: C.ink, lineHeight: 1.2, marginBottom: 4,
            letterSpacing: -0.4,
          }}>{task.name}</div>
          <div style={{ fontSize: 13, color: C.inkMute, marginBottom: 12 }}>
            {task.cadence} · last done {task.lastDone}
          </div>
          {task.insight && (
            <div style={{
              fontSize: 14, color: C.ink, fontStyle: 'italic',
              borderLeft: `3px solid ${c.color}`, paddingLeft: 12, marginBottom: 14,
            }}>
              "{task.insight}"
            </div>
          )}
          {task.note && (
            <div style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.55, marginBottom: 14 }}>
              {task.note}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Lora, serif', fontSize: 32, fontWeight: 600,
            color: c.color, lineHeight: 1, letterSpacing: -1,
          }}>
            {task.overdue}
          </div>
          <div style={{ fontSize: 11, color: C.inkMute, fontWeight: 600,
            letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 }}>
            days overdue
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button style={{ ...btnPrimary, padding: '8px 16px' }}>Mark done</button>
        <button style={btnGhost}>Skip with reason</button>
        <button style={btnGhost}>Snooze 2 days</button>
      </div>
    </div>
  );
}

// ============================================================
// TASK CARD — secondary
// ============================================================
function TaskCard({ task, delay = 0 }) {
  const [hover, setHover] = useState(false);
  const isOverdue = task.overdue !== null && task.overdue !== undefined && task.overdue >= 0;
  const isCritical = isOverdue && task.overdue >= 7;
  const c = CATEGORY[task.category] || CATEGORY.admin;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.paper,
        border: `1px solid ${hover ? c.color + '55' : C.border}`,
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 10,
        boxShadow: hover ? C.shadowMed : C.shadowSoft,
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        animation: `heed-fadeUp 0.5s ease both`,
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Left edge accent */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: isCritical ? C.rust : c.color,
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
        <CategoryBadge category={task.category} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: C.ink, letterSpacing: -0.1 }}>
              {task.name}
            </span>
            {task.learned && <Pill tone="sage">✨ learned</Pill>}
            {task.importance === 'high' && <Pill tone="danger">high</Pill>}
          </div>
          <div style={{ fontSize: 12.5, color: C.inkMute, marginBottom: task.note ? 6 : 0 }}>
            {task.cadence} · last done {task.lastDone}
          </div>
          {task.note && (
            <div style={{
              fontSize: 12.5, color: C.inkSoft, fontStyle: 'italic',
              borderTop: `1px dashed ${C.hairline}`, paddingTop: 6, marginTop: 6,
            }}>
              {task.note}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
          {isOverdue && (
            <>
              <div style={{
                fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 600,
                color: isCritical ? C.rust : C.ochre, lineHeight: 1,
              }}>{task.overdue}d</div>
              <div style={{ fontSize: 10, color: C.inkMute, fontWeight: 600,
                letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 }}>
                overdue
              </div>
            </>
          )}
          {task.dueIn !== undefined && task.dueIn === 0 && (
            <Pill tone="sage">today</Pill>
          )}
          {task.dueIn !== undefined && task.dueIn > 0 && (
            <div style={{ fontSize: 12.5, color: C.inkMute }}>in {task.dueIn}d</div>
          )}
        </div>
      </div>

      {hover && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, animation: 'heed-fadeIn 0.2s ease' }}>
          <button style={btnPrimary}>Mark done</button>
          <button style={btnGhost}>Skip</button>
          <button style={btnGhost}>Snooze</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ROUTINE CARD — distinct from task cards, with rich pattern viz
// ============================================================
function RoutineCard({ routine, delay = 0 }) {
  const [hover, setHover] = useState(false);
  const completionRate = routine.completion14d.filter(Boolean).length / routine.completion14d.length;
  const isAttentionWorthy = routine.suggestion !== null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
        border: `1.5px solid ${isAttentionWorthy ? C.ochre + '66' : C.border}`,
        borderRadius: 14,
        padding: '18px 20px',
        marginBottom: 12,
        boxShadow: hover ? C.shadowMed : C.shadowSoft,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.25s ease',
        position: 'relative',
        animation: 'heed-fadeUp 0.5s ease both',
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{
              fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 600,
              color: C.ink, letterSpacing: -0.2,
            }}>{routine.name}</span>
            <Pill tone="ink">routine</Pill>
          </div>
          <div style={{ fontSize: 12, color: C.inkMute }}>
            {routine.schedule} · {routine.weekRate}
          </div>
        </div>

        {/* Completion percentage circle */}
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="26" cy="26" r="22" fill="none" stroke={C.hairline} strokeWidth="3" />
            <circle cx="26" cy="26" r="22" fill="none"
              stroke={completionRate > 0.8 ? C.sage : completionRate > 0.5 ? C.ochre : C.rust}
              strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${completionRate * 138} 138`}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Lora, serif', fontSize: 13, fontWeight: 600,
            color: C.warmDark,
          }}>
            {Math.round(completionRate * 100)}%
          </div>
        </div>
      </div>

      {/* Items as inline tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {routine.items.map((item, i) => (
          <span key={i} style={{
            fontSize: 12, padding: '4px 10px',
            background: C.bellySoft, color: C.warmDark,
            borderRadius: 6, fontWeight: 500,
          }}>
            {item}
          </span>
        ))}
      </div>

      {/* 14-day completion grid with day labels */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.inkMute,
          letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
        }}>
          Last 14 days
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {routine.completion14d.map((done, i) => (
            <div key={i}
              title={done ? 'completed' : 'missed'}
              style={{
                width: 18, height: 18, borderRadius: 4,
                background: done ? C.sage : 'transparent',
                border: done ? 'none' : `1.5px dashed ${C.border}`,
                animation: 'heed-fadeIn 0.3s ease both',
                animationDelay: `${i * 30}ms`,
              }}
            />
          ))}
          <div style={{ marginLeft: 8, fontSize: 10, color: C.inkMute, fontStyle: 'italic' }}>
            today →
          </div>
        </div>
      </div>

      {/* Agent voice */}
      <div style={{
        background: isAttentionWorthy ? C.ochreSoft : C.sageSoft,
        border: `1px solid ${isAttentionWorthy ? C.ochre + '44' : C.sage + '44'}`,
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <div style={{ marginTop: 1 }}>
          <MayaOwl size={24} idle={false} />
        </div>
        <div style={{ flex: 1, fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{routine.insight}</div>
          {routine.suggestion && <div style={{ fontStyle: 'italic' }}>{routine.suggestion}</div>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={btnPrimary}>Mark today done</button>
        {isAttentionWorthy && <button style={btnAccent}>Lighten this week</button>}
        <button style={btnGhost}>Edit</button>
      </div>
    </div>
  );
}

// ============================================================
// BUTTON STYLES
// ============================================================
const btnPrimary = {
  background: C.warmDark, color: C.cream, border: 'none',
  padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', letterSpacing: 0.2, fontFamily: 'inherit',
  transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
};
const btnAccent = {
  ...btnPrimary,
  background: C.ochre,
  color: C.warmDeep,
};
const btnGhost = {
  background: 'transparent', color: C.inkSoft,
  border: `1px solid ${C.border}`, padding: '7px 12px',
  borderRadius: 7, fontSize: 12.5, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
};

// ============================================================
// CONTEXT BANNER
// ============================================================
function ContextBanner() {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: `linear-gradient(120deg, ${C.ochreSoft} 0%, ${C.bellySoft} 100%)`,
        border: `1px solid ${C.ochre}66`,
        borderRadius: 14, padding: '14px 18px', marginBottom: 22,
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: hover ? C.shadowMed : C.shadowSoft,
        transition: 'all 0.2s ease',
        position: 'relative', overflow: 'hidden',
        animation: 'heed-fadeUp 0.5s ease both',
      }}
    >
      <div style={{
        position: 'absolute', right: -10, top: -10,
        width: 80, height: 80, opacity: 0.08,
        background: C.ochre, borderRadius: '50%',
      }} />
      <div style={{
        fontSize: 28, lineHeight: 1, flexShrink: 0,
      }}>✈️</div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: C.warmDark,
          letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2,
        }}>
          Upcoming · {CONTEXTS_UPCOMING[0].days} days away
        </div>
        <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>
          <strong>Singapore trip Apr 28 – May 2.</strong> I've already deferred 6 things to May 3, plus 2 to handle <em>before</em> you fly.
        </div>
      </div>
      <button style={{ ...btnGhost, fontSize: 12, whiteSpace: 'nowrap' }}>See plan →</button>
    </div>
  );
}

// ============================================================
// SECTION HEADER
// ============================================================
function SectionHeader({ children, count, accent = C.warmDark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
      <h3 style={{
        fontFamily: 'Lora, Georgia, serif', fontSize: 19, fontWeight: 600,
        color: accent, margin: 0, letterSpacing: -0.3,
      }}>
        {children}
      </h3>
      {count !== undefined && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.inkMute,
          letterSpacing: 0.6, textTransform: 'uppercase',
        }}>
          {count} {count === 1 ? 'item' : 'items'}
        </div>
      )}
      <div style={{ flex: 1, height: 1, background: C.hairline }} />
    </div>
  );
}

// ============================================================
// TODAY TAB
// ============================================================
function TodayTab({ extraTasks = [], extraRoutines = [] }) {
  const allTasks = [...TASKS, ...extraTasks];
  const allRoutines = [...ROUTINES, ...extraRoutines];
  const overdue = allTasks.filter(t => t.overdue !== null && t.overdue !== undefined && t.overdue >= 0)
    .sort((a, b) => b.overdue - a.overdue);
  const heroTask = overdue[0];
  const otherOverdue = overdue.slice(1);
  const upcoming = allTasks.filter(t => t.dueIn !== undefined);
  const newlyAdded = extraTasks.filter(t => t.overdue === null);

  return (
    <div>
      <ContextBanner />

      <SectionHeader>Top of mind</SectionHeader>
      {heroTask && <HeroCard task={heroTask} />}

      <div style={{ marginTop: 28 }}>
        <SectionHeader count={ROUTINES.length}>Routines</SectionHeader>
        {allRoutines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 80} />)}
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionHeader count={otherOverdue.length}>Also overdue</SectionHeader>
        {otherOverdue.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} />)}
      </div>

      {newlyAdded.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionHeader count={newlyAdded.length}>Just added</SectionHeader>
          {newlyAdded.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} />)}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <SectionHeader count={upcoming.length}>Coming up</SectionHeader>
        {upcoming.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} />)}
      </div>
    </div>
  );
}

// ============================================================
// ASK HEED TAB
// ============================================================
function AskTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(null);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking, streaming]);

  const send = async (text) => {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages(m => [...m, { role: 'user', content: trimmed }]);
    setInput('');
    setBusy(true);
    const response = SCRIPTED_RESPONSES[trimmed] || FALLBACK_RESPONSE;
    for (let i = 0; i < response.thinking.length; i++) {
      setThinking(response.thinking.slice(0, i + 1));
      await new Promise(r => setTimeout(r, 700 + Math.random() * 400));
    }
    setThinking(null);
    const words = response.answer.split(' ');
    let acc = '';
    for (let i = 0; i < words.length; i++) {
      acc += (i > 0 ? ' ' : '') + words[i];
      setStreaming(acc);
      await new Promise(r => setTimeout(r, 18 + Math.random() * 25));
    }
    setMessages(m => [...m, { role: 'assistant', content: acc }]);
    setStreaming('');
    setBusy(false);
  };

  const owlMood = busy ? "thinking" : "calm";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600 }}>
      {messages.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 0 32px 0',
          animation: 'heed-fadeUp 0.5s ease',
        }}>
          {/* Owl in ambient glow */}
          <div style={{
            position: 'relative', display: 'inline-block', marginBottom: 18,
          }}>
            <div style={{
              position: 'absolute', inset: -28, borderRadius: '50%',
              background: `radial-gradient(circle, ${C.ochreSoft} 0%, transparent 65%)`,
              animation: 'heed-breathe 4s ease-in-out infinite',
            }} />
            <div style={{ position: 'relative' }}>
              <MayaOwl size={150} mood={owlMood} speaking={busy} />
            </div>
          </div>

          <div style={{
            fontFamily: 'Lora, Georgia, serif', fontSize: 26,
            color: C.warmDark, marginBottom: 6, letterSpacing: -0.5,
            fontWeight: 600,
          }}>
            Hi Maya. What can I help you remember?
          </div>
          <div style={{ fontSize: 13.5, color: C.inkMute, marginBottom: 24, fontStyle: 'italic' }}>
            Ask me anything about your tasks, routines, or schedule.
          </div>

          <div style={{
            display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
            maxWidth: 640, margin: '0 auto',
          }}>
            {SUGGESTIONS.map((s, i) => (
              <SuggestionChip key={s.text} suggestion={s} onClick={() => send(s.text)} disabled={busy} delay={i * 80} />
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '12px 4px', marginBottom: 12,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <MayaOwl size={72} mood={owlMood} speaking={busy} />
          </div>
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {thinking && (
            <div style={{
              background: C.paper,
              border: `1px dashed ${C.border}`,
              borderRadius: 12, padding: '14px 16px', marginBottom: 12,
              fontSize: 12.5, color: C.inkMute, fontStyle: 'italic',
              animation: 'heed-fadeIn 0.3s ease',
            }}>
              {thinking.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0',
                  animation: 'heed-fadeUp 0.3s ease both',
                }}>
                  <span style={{ color: C.sage, fontSize: 14 }}>›</span>
                  <span>{t}</span>
                  {i === thinking.length - 1 && (
                    <span style={{ marginLeft: 4, color: C.sage }}>
                      <span style={{ animation: 'heed-blink 1s infinite' }}>●</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {streaming && <Bubble role="assistant" content={streaming} streaming />}
        </div>
      )}

      <div style={{
        display: 'flex', gap: 10, padding: '14px 4px',
        borderTop: messages.length > 0 ? `1px solid ${C.hairline}` : 'none',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Ask Heed anything..."
          disabled={busy}
          style={{
            flex: 1, background: C.paper,
            border: `1.5px solid ${C.border}`,
            borderRadius: 10, padding: '12px 16px',
            fontSize: 14, color: C.ink, outline: 'none',
            fontFamily: 'inherit', transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = C.warmDark}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <button onClick={() => send(input)} disabled={busy || !input.trim()} style={{
          ...btnPrimary, padding: '12px 22px', fontSize: 13,
          opacity: (busy || !input.trim()) ? 0.5 : 1,
        }}>Send</button>
      </div>
    </div>
  );
}

function SuggestionChip({ suggestion, onClick, disabled, delay = 0 }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? C.bellySoft : C.paper,
        border: `1.5px solid ${hover ? C.warmDark + '66' : C.border}`,
        color: C.warmDark,
        padding: '10px 16px', borderRadius: 999,
        fontSize: 13, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover ? C.shadowMed : 'none',
        fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 8,
        animation: 'heed-fadeUp 0.4s ease both',
        animationDelay: `${delay}ms`,
      }}
    >
      <span style={{ fontSize: 14 }}>{suggestion.emoji}</span>
      {suggestion.text}
    </button>
  );
}

function Bubble({ role, content, streaming }) {
  const isUser = role === 'user';
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12, animation: 'heed-fadeUp 0.3s ease',
    }}>
      <div style={{
        maxWidth: '84%',
        background: isUser ? C.warmDark : C.paper,
        color: isUser ? C.cream : C.ink,
        padding: '12px 16px',
        borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
        border: isUser ? 'none' : `1px solid ${C.border}`,
        fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap',
        boxShadow: isUser ? C.shadowSoft : 'none',
        fontFamily: 'inherit',
      }}>
        {content}
        {streaming && <span style={{ opacity: 0.5, animation: 'heed-blink 1s infinite' }}>▍</span>}
      </div>
    </div>
  );
}

// ============================================================
// TASKS TAB
// ============================================================
function TracksTab({ extraTasks = [], extraRoutines = [] }) {
  const [subtab, setSubtab] = useState('routines'); // 'routines' or 'tasks'
  const [filter, setFilter] = useState('all');
  const allTasks = [...TASKS, ...extraTasks];
  const allRoutines = [...ROUTINES, ...extraRoutines];
  const filteredTasks = filter === 'all' ? allTasks : allTasks.filter(t => t.category === filter);

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 18 }}>
        <SectionHeader>
          Tracks
        </SectionHeader>
        <div style={{
          fontSize: 12.5, color: C.inkMute, fontStyle: 'italic',
          marginTop: -8,
        }}>
          Everything Heed is following for you.
        </div>
      </div>

      {/* Segmented control: Routines | Tasks */}
      <div style={{
        display: 'flex',
        background: C.paper,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 4,
        marginBottom: 18,
        gap: 4,
      }}>
        <SegmentButton
          active={subtab === 'routines'}
          onClick={() => setSubtab('routines')}
          label="Routines"
          count={allRoutines.length}
          accent={C.sage}
        />
        <SegmentButton
          active={subtab === 'tasks'}
          onClick={() => setSubtab('tasks')}
          label="Tasks"
          count={allTasks.length}
          accent={C.warmDark}
        />
      </div>

      {/* Routines panel */}
      {subtab === 'routines' && (
        <div style={{ animation: 'paalala-fadeIn 0.2s ease' }}>
          {allRoutines.map((r, i) => <RoutineCard key={r.id} routine={r} delay={i * 50} />)}
        </div>
      )}

      {/* Tasks panel */}
      {subtab === 'tasks' && (
        <div style={{ animation: 'paalala-fadeIn 0.2s ease' }}>
          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {['all', 'home', 'finance', 'relationships', 'health', 'admin', 'work'].map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                background: filter === cat ? C.warmDark : C.paper,
                color: filter === cat ? C.cream : C.warmDark,
                border: `1px solid ${filter === cat ? C.warmDark : C.border}`,
                padding: '5px 12px', borderRadius: 999,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                textTransform: 'capitalize', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>{cat}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {filteredTasks.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 30} />)}
          </div>

          <div style={{
            marginTop: 18, fontSize: 12.5, color: C.inkMute,
            fontStyle: 'italic', textAlign: 'center',
          }}>
            ✨ = cadence learned by the agent from your behavior
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentButton({ active, onClick, label, count, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? accent : 'transparent',
        color: active ? C.cream : C.inkSoft,
        border: 'none',
        padding: '8px 14px',
        borderRadius: 7,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.18s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        letterSpacing: 0.1,
      }}
    >
      <span>{label}</span>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        background: active ? 'rgba(253, 248, 238, 0.25)' : C.belly,
        color: active ? C.cream : C.inkMute,
        padding: '1px 7px',
        borderRadius: 999,
        transition: 'all 0.18s',
      }}>{count}</span>
    </button>
  );
}

// ============================================================
// CONTEXT TAB
// ============================================================
function ContextTab({ extraContexts = [], onAddContext }) {
  // Today is anchored to the prototype's "now" — Apr 21, 2026
  const TODAY = new Date(2026, 3, 21);

  // Merge seed + user-added, then split by past/upcoming based on end_date vs today.
  // For the seed data, ctx.start and ctx.end are already pretty strings; for newly-
  // added ones we'll keep that contract by formatting before insertion.
  const allUpcoming = [
    ...CONTEXTS_UPCOMING,
    ...extraContexts.filter(c => c._endDate >= TODAY),
  ];
  const allPast = [
    ...CONTEXTS_PAST,
    ...extraContexts.filter(c => c._endDate < TODAY),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <SectionHeader>Context windows</SectionHeader>
        <button onClick={onAddContext} style={btnPrimary}>+ Add context</button>
      </div>

      <div style={{
        background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: 18, marginBottom: 16, boxShadow: C.shadowSoft,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.sage,
          letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase',
        }}>Upcoming</div>
        {allUpcoming.length === 0 && (
          <div style={{
            fontSize: 12.5, color: C.inkMute, fontStyle: 'italic',
            padding: '8px 0',
          }}>
            Nothing on the horizon. Tap "+ Add context" if you have a trip, illness, or busy week coming up.
          </div>
        )}
        {allUpcoming.map((c, i) => <ContextRow key={`u-${i}`} ctx={c} highlight />)}
      </div>

      <div style={{
        background: C.paper, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: 18, boxShadow: C.shadowSoft,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.inkMute,
          letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase',
        }}>Past</div>
        {allPast.map((c, i) => <ContextRow key={`p-${i}`} ctx={c} />)}
      </div>

      <div style={{
        marginTop: 20, padding: '14px 16px',
        background: C.bellySoft, borderRadius: 10,
        fontSize: 13, color: C.ink,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span>You can also tell Heed about context in plain language — try <em>"I'm sick this week"</em> or <em>"I'm traveling next month."</em></span>
      </div>
    </div>
  );
}

function ContextRow({ ctx, highlight }) {
  const icons = { travel: '✈️', illness: '🤒', busy: '⏱️', celebration: '🎉' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
      borderTop: `1px solid ${C.hairline}`,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: highlight ? C.ochreSoft : C.bellySoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{icons[ctx.type] || '📌'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, marginBottom: 2 }}>{ctx.desc}</div>
        <div style={{ fontSize: 12, color: C.inkMute }}>
          {ctx.start} → {ctx.end}
        </div>
      </div>
      {highlight && <Pill tone="warn" glow>soon</Pill>}
    </div>
  );
}

// ============================================================
// CALENDAR TAB — week view, agent reasoning made visible
// ============================================================

// Helpers
const TODAY_DATE = new Date(2026, 3, 21); // Apr 21, 2026 (month is 0-indexed)
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-first
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }
function fmtMonth(d) { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Build the schedule the agent has decided. This is the demo payload —
// shows tasks the agent has *placed* on dates (not just due-dates).
// Includes deferrals around the Singapore trip so the visualization
// tells a story.
function buildSchedule(weekStart) {
  const items = []; // {date, kind, label, color, category, deferred?}

  // Map: relative day offset from weekStart -> entries
  const push = (offset, kind, label, color, opts = {}) => {
    items.push({ date: addDays(weekStart, offset), kind, label, color, ...opts });
  };

  // The agent has placed these in the next 7 days (this week starts Mon Apr 20)
  // Today = Tue Apr 21, so offsets relative to Mon Apr 20:
  // 0=Mon Apr20, 1=Tue Apr21 (today), 2=Wed Apr22, 3=Thu Apr23,
  // 4=Fri Apr24, 5=Sat Apr25, 6=Sun Apr26
  push(1, 'task', 'Pay Maynilad', C.rust, { category: 'finance', priority: 'high' });
  push(1, 'task', 'Pay Meralco', C.rust, { category: 'finance', priority: 'high' });
  push(1, 'task', 'Call Mom', C.warmDark, { category: 'relationships', priority: 'high' });
  push(2, 'task', 'Refill water dispenser', C.sage, { category: 'home' });
  push(2, 'task', 'Vitamin D', C.ochre, { category: 'health' });
  push(3, 'task', 'Cat litter box', C.warmDark, { category: 'home', priority: 'high' });
  push(4, 'task', 'Submit timesheet', C.warmDark, { category: 'work', priority: 'high' });
  push(5, 'task', 'Update expense tracker', C.ochre, { category: 'admin' });
  push(5, 'task', 'Wash bedsheets', C.sage, { category: 'home' });
  push(6, 'task', 'Clean aircon filter', C.sage, { category: 'home' });

  return items;
}

// Routines that span days
const ROUTINE_TRACKS = [
  { id: 'morning', label: 'Morning routine', color: C.warmDark, days: [0, 1, 2, 3, 4] }, // Mon-Fri
  { id: 'evening', label: 'Evening wind-down', color: C.sage, days: [0, 1, 2, 3, 4, 5, 6] }, // every day
];

// Context windows that paint background
const CONTEXT_BANDS = [
  {
    id: 'sg',
    label: 'Singapore',
    color: C.ochre,
    bgColor: C.ochreSoft,
    start: new Date(2026, 3, 28),
    end: new Date(2026, 4, 2),
  },
];

function CalendarTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const baseWeek = startOfWeek(TODAY_DATE);
  const weekStart = addDays(baseWeek, weekOffset * 7);
  const schedule = buildSchedule(weekStart);

  return (
    <div>
      {/* Header with navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 18, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <SectionHeader>
            {fmtMonth(weekStart)}
          </SectionHeader>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            style={{ ...btnGhost, padding: '6px 12px', fontSize: 13 }}
          >‹ Previous</button>
          <button
            onClick={() => setWeekOffset(0)}
            style={{
              ...btnGhost,
              padding: '6px 12px', fontSize: 13,
              background: weekOffset === 0 ? C.bellySoft : 'transparent',
              borderColor: weekOffset === 0 ? C.warmDark + '66' : C.border,
              color: weekOffset === 0 ? C.warmDark : C.inkSoft,
              fontWeight: weekOffset === 0 ? 600 : 500,
            }}
          >This week</button>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            style={{ ...btnGhost, padding: '6px 12px', fontSize: 13 }}
          >Next ›</button>
        </div>
      </div>

      {/* Agent annotation strip */}
      <div style={{
        background: `linear-gradient(120deg, ${C.bellySoft} 0%, ${C.ochreSoft}88 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
        animation: 'heed-fadeUp 0.4s ease',
      }}>
        <MayaOwl size={32} idle={false} />
        <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5, flex: 1 }}>
          <strong>Heed has scheduled these for you.</strong> The agent placed each task on its
          best-fit day given your cadence patterns, importance, and the Singapore trip Apr 28 – May 2.
        </div>
      </div>

      {/* The week grid */}
      <div style={{
        background: C.paper,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: C.shadowSoft,
      }}>
        {/* Day headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          background: C.bellySoft, borderBottom: `1px solid ${C.border}`,
        }}>
          {DAYS_OF_WEEK.map((d, i) => {
            const date = addDays(weekStart, i);
            const isToday = sameDay(date, TODAY_DATE);
            return (
              <div key={i} style={{
                padding: '12px 10px',
                textAlign: 'center',
                borderRight: i < 6 ? `1px solid ${C.border}` : 'none',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: C.inkMute,
                  letterSpacing: 0.7, textTransform: 'uppercase',
                }}>{d}</div>
                <div style={{
                  fontFamily: 'Lora, serif',
                  fontSize: 18, fontWeight: 600,
                  color: isToday ? C.cream : C.warmDark,
                  marginTop: 2,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: '50%',
                  background: isToday ? C.warmDark : 'transparent',
                  lineHeight: 1,
                }}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Context bands row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          minHeight: 28, position: 'relative',
          background: C.paperHi,
          borderBottom: `1px solid ${C.hairline}`,
        }}>
          {[0,1,2,3,4,5,6].map(i => {
            const date = addDays(weekStart, i);
            const band = CONTEXT_BANDS.find(b => date >= b.start && date <= b.end);
            return (
              <div key={i} style={{
                borderRight: i < 6 ? `1px solid ${C.hairline}` : 'none',
                background: band ? band.bgColor : 'transparent',
                padding: '4px 8px',
                fontSize: 10.5, fontWeight: 700,
                color: band ? band.color : 'transparent',
                letterSpacing: 0.5, textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {band ? `✈ ${band.label}` : ''}
              </div>
            );
          })}
        </div>

        {/* Routine tracks */}
        {ROUTINE_TRACKS.map((track) => (
          <div key={track.id} style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: `1px solid ${C.hairline}`,
            background: C.paper,
          }}>
            {[0,1,2,3,4,5,6].map(i => {
              const isActive = track.days.includes(i);
              return (
                <div key={i} style={{
                  borderRight: i < 6 ? `1px solid ${C.hairline}` : 'none',
                  padding: '6px 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6,
                }}>
                  {isActive ? (
                    <>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: track.color,
                      }} />
                      <span style={{
                        fontSize: 10.5, color: track.color,
                        fontWeight: 600, letterSpacing: 0.2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {track.label}
                      </span>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}

        {/* Day cells with task chips */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          minHeight: 280,
        }}>
          {[0,1,2,3,4,5,6].map(i => {
            const date = addDays(weekStart, i);
            const dayItems = schedule.filter(s => sameDay(s.date, date));
            const isToday = sameDay(date, TODAY_DATE);
            const band = CONTEXT_BANDS.find(b => date >= b.start && date <= b.end);
            return (
              <div key={i} style={{
                borderRight: i < 6 ? `1px solid ${C.hairline}` : 'none',
                padding: '10px 8px',
                background: band ? band.bgColor + '40' : (isToday ? C.bellySoft + '50' : 'transparent'),
                display: 'flex', flexDirection: 'column', gap: 4,
                animation: 'heed-fadeIn 0.4s ease both',
                animationDelay: `${i * 60}ms`,
              }}>
                {dayItems.map((item, j) => (
                  <CalendarChip key={j} item={item} />
                ))}
                {dayItems.length === 0 && !band && (
                  <div style={{
                    fontSize: 11, color: C.inkMute + '88',
                    fontStyle: 'italic', textAlign: 'center', marginTop: 12,
                  }}>—</div>
                )}
                {band && dayItems.length === 0 && (
                  <div style={{
                    fontSize: 10.5, color: band.color, fontStyle: 'italic',
                    textAlign: 'center', marginTop: 16, opacity: 0.7,
                  }}>routines paused</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10,
        display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center',
        fontSize: 12, color: C.inkSoft,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMute,
          letterSpacing: 0.6, textTransform: 'uppercase' }}>Legend</div>
        <LegendDot color={C.rust} label="Critical / overdue" />
        <LegendDot color={C.warmDark} label="High importance" />
        <LegendDot color={C.ochre} label="Medium" />
        <LegendDot color={C.sage} label="Easy / routine" />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 16, height: 10, borderRadius: 3, background: C.ochreSoft,
            border: `1px solid ${C.ochre}66`,
          }} />
          <span>Context window</span>
        </div>
      </div>
    </div>
  );
}

function CalendarChip({ item }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? item.color + '22' : C.paper,
        border: `1px solid ${hover ? item.color : C.border}`,
        borderLeft: `3px solid ${item.color}`,
        borderRadius: 5,
        padding: '5px 8px',
        fontSize: 11.5, color: C.ink,
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 5,
        lineHeight: 1.2,
      }}
    >
      {item.priority === 'high' && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: item.color, flexShrink: 0,
        }} />
      )}
      <span style={{
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontWeight: item.priority === 'high' ? 600 : 500,
      }}>
        {item.label}
      </span>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', background: color,
      }} />
      <span>{label}</span>
    </div>
  );
}

// ============================================================
// FLOATING ACTION BUTTON — speed dial: Add task / Ask Heed
// ============================================================
function HeedFAB({ onAddTask, onAskHeed, onAddRoutine }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open]);

  const handleAdd = () => { setOpen(false); onAddTask(); };
  const handleAsk = () => { setOpen(false); onAskHeed(); };
  const handleRoutine = () => { setOpen(false); onAddRoutine(); };

  return (
    <>
      {/* Backdrop when open — captures outside clicks */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 49,
            background: 'rgba(44, 24, 16, 0.18)',
            animation: 'heed-fadeIn 0.18s ease',
          }}
        />
      )}

      {/* Speed-dial menu items */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 110, right: 28,
          zIndex: 51,
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end', gap: 10,
        }}>
          <SpeedDialItem
            label="Add a task"
            sublabel="Track something new"
            icon="+"
            iconBg={C.ochre}
            iconFg={C.warmDeep}
            onClick={handleAdd}
            delay={0}
          />
          <SpeedDialItem
            label="Build a routine"
            sublabel="A cluster of things together"
            icon="◆"
            iconBg={C.sage}
            iconFg={C.cream}
            onClick={handleRoutine}
            delay={50}
          />
          <SpeedDialItem
            label="Ask Heed"
            sublabel="Get answers from anywhere"
            icon={<MayaOwl size={22} idle={false} />}
            iconBg={C.bellySoft}
            iconFg={C.warmDark}
            onClick={handleAsk}
            delay={100}
          />
        </div>
      )}

      {/* The FAB itself */}
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={open ? 'Close menu' : 'Open Heed menu'}
        aria-expanded={open}
        style={{
          position: 'fixed',
          bottom: 28, right: 28,
          width: 64, height: 64,
          borderRadius: '50%',
          border: 'none',
          background: `radial-gradient(circle at 35% 30%, ${C.warm} 0%, ${C.warmDark} 70%, ${C.warmDeep} 100%)`,
          cursor: 'pointer',
          boxShadow: (hover || open)
            ? '0 12px 32px rgba(124, 83, 51, 0.35), 0 0 0 6px rgba(212, 162, 76, 0.15)'
            : '0 6px 18px rgba(124, 83, 51, 0.30)',
          transform: open
            ? 'rotate(45deg) scale(1.05)'
            : hover ? 'translateY(-3px) scale(1.05)' : 'translateY(0) scale(1)',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
          zIndex: 52,
        }}
      >
        {/* Mini owl inside the FAB — counter-rotates so it stays upright */}
        <div style={{
          position: 'relative',
          animation: (hover && !open) ? 'heed-bob 0.6s ease-in-out infinite' : 'none',
          transform: open ? 'rotate(-45deg)' : 'rotate(0)',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <MayaOwl size={42} idle={false} />
        </div>
        {/* Plus badge — becomes an X when open */}
        <div style={{
          position: 'absolute',
          top: 4, right: 4,
          width: 20, height: 20,
          borderRadius: '50%',
          background: open ? C.rust : C.ochre,
          color: open ? C.cream : C.warmDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, lineHeight: 1,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          border: `2px solid ${C.cream}`,
          transition: 'background 0.2s',
        }}>
          +
        </div>
      </button>
    </>
  );
}

function SpeedDialItem({ label, sublabel, icon, iconBg, iconFg, onClick, delay = 0 }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'heed-slideRight 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      animationDelay: `${delay}ms`,
    }}>
      {/* Label pill */}
      <div style={{
        background: C.paperHi,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '8px 14px',
        boxShadow: C.shadowMed,
        textAlign: 'right',
        minWidth: 140,
      }}>
        <div style={{
          fontFamily: 'Lora, serif',
          fontSize: 14, fontWeight: 600,
          color: C.warmDark, lineHeight: 1.1,
        }}>{label}</div>
        <div style={{
          fontSize: 11, color: C.inkMute,
          fontStyle: 'italic', marginTop: 2,
        }}>{sublabel}</div>
      </div>

      {/* Icon button */}
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={label}
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: iconBg,
          border: `2px solid ${C.cream}`,
          color: iconFg,
          fontSize: 24, fontWeight: 700,
          cursor: 'pointer',
          boxShadow: hover
            ? '0 8px 22px rgba(124, 83, 51, 0.30)'
            : '0 4px 12px rgba(124, 83, 51, 0.20)',
          transform: hover ? 'translateY(-2px) scale(1.06)' : 'translateY(0) scale(1)',
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        {icon}
      </button>
    </div>
  );
}

// ============================================================
// ASK HEED INLINE MODAL — chat from anywhere
// ============================================================
function AskInlineModal({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(null);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking, streaming]);

  const send = async (text) => {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages(m => [...m, { role: 'user', content: trimmed }]);
    setInput('');
    setBusy(true);
    const response = SCRIPTED_RESPONSES[trimmed] || FALLBACK_RESPONSE;
    for (let i = 0; i < response.thinking.length; i++) {
      setThinking(response.thinking.slice(0, i + 1));
      await new Promise(r => setTimeout(r, 600 + Math.random() * 300));
    }
    setThinking(null);
    const words = response.answer.split(' ');
    let acc = '';
    for (let i = 0; i < words.length; i++) {
      acc += (i > 0 ? ' ' : '') + words[i];
      setStreaming(acc);
      await new Promise(r => setTimeout(r, 16 + Math.random() * 22));
    }
    setMessages(m => [...m, { role: 'assistant', content: acc }]);
    setStreaming('');
    setBusy(false);
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(44, 24, 16, 0.45)',
          backdropFilter: 'blur(4px)',
          animation: 'heed-fadeIn 0.2s ease',
        }}
      />
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 101,
        display: 'flex', justifyContent: 'center',
        animation: 'heed-slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: C.paperHi,
          width: '100%', maxWidth: 560,
          margin: '0 16px 16px 16px',
          borderRadius: '20px 20px 14px 14px',
          padding: '20px 22px 16px 22px',
          boxShadow: '0 -8px 40px rgba(124, 83, 51, 0.25)',
          border: `1px solid ${C.border}`,
          pointerEvents: 'auto',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            flexShrink: 0,
          }}>
            <div style={{
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', inset: -6, borderRadius: '50%',
                background: `radial-gradient(circle, ${C.ochreSoft} 0%, transparent 70%)`,
                animation: 'heed-breathe 4s ease-in-out infinite',
              }} />
              <div style={{ position: 'relative' }}>
                <MayaOwl size={40} mood={busy ? 'thinking' : 'calm'} speaking={busy} idle={!busy} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Lora, Georgia, serif',
                fontSize: 17, fontWeight: 600, color: C.warmDark,
                letterSpacing: -0.2, lineHeight: 1.1, marginBottom: 2,
              }}>
                Ask Heed
              </div>
              <div style={{ fontSize: 11.5, color: C.inkMute, fontStyle: 'italic' }}>
                Quick chat — your answer in a moment
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none',
                color: C.inkMute, cursor: 'pointer',
                fontSize: 20, padding: 4, lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >×</button>
          </div>

          {/* Messages area */}
          <div ref={scrollRef} style={{
            flex: 1, overflowY: 'auto',
            paddingRight: 4, marginBottom: 12,
            minHeight: messages.length === 0 ? 'auto' : 200,
          }}>
            {messages.length === 0 && !busy && (
              <div style={{
                display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4,
              }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s.text}
                    onClick={() => send(s.text)}
                    disabled={busy}
                    style={{
                      background: C.paper,
                      border: `1px solid ${C.border}`,
                      color: C.warmDark,
                      padding: '7px 12px', borderRadius: 999,
                      fontSize: 12, fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      animation: 'heed-fadeUp 0.3s ease both',
                      animationDelay: `${i * 60}ms`,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bellySoft; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.paper; }}
                  >
                    <span style={{ fontSize: 13 }}>{s.emoji}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}

            {thinking && (
              <div style={{
                background: C.paper,
                border: `1px dashed ${C.border}`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 10,
                fontSize: 12, color: C.inkMute, fontStyle: 'italic',
              }}>
                {thinking.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0',
                    animation: 'heed-fadeUp 0.3s ease both',
                  }}>
                    <span style={{ color: C.sage, fontSize: 13 }}>›</span>
                    <span>{t}</span>
                    {i === thinking.length - 1 && (
                      <span style={{ marginLeft: 4, color: C.sage,
                        animation: 'heed-blink 1s infinite' }}>●</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {streaming && <Bubble role="assistant" content={streaming} streaming />}
          </div>

          {/* Input */}
          <div style={{
            display: 'flex', gap: 8, paddingTop: 10,
            borderTop: messages.length > 0 ? `1px solid ${C.hairline}` : 'none',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              placeholder="Ask Heed anything..."
              disabled={busy}
              style={{
                flex: 1, background: C.paper,
                border: `1.5px solid ${C.border}`,
                borderRadius: 10, padding: '10px 14px',
                fontSize: 14, color: C.ink, outline: 'none',
                fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = C.warmDark}
              onBlur={e => e.target.style.borderColor = C.border}
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              style={{
                ...btnPrimary, padding: '10px 18px', fontSize: 13,
                opacity: (busy || !input.trim()) ? 0.5 : 1,
              }}
            >Send</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// ADD TASK MODAL
// ============================================================
function AddTaskModal({ open, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('home');
  const [importance, setImportance] = useState('medium');
  const [cadenceMode, setCadenceMode] = useState('learn'); // 'learn' or 'set'
  const [cadenceDays, setCadenceDays] = useState(7);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const reset = () => {
    setName(''); setCategory('home'); setImportance('medium');
    setCadenceMode('learn'); setCadenceDays(7);
  };

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      category,
      importance,
      cadence: cadenceMode === 'set' ? `every ${cadenceDays} day${cadenceDays === 1 ? '' : 's'}` : 'still learning your cadence',
      lastDone: 'just added',
      dueIn: cadenceMode === 'set' ? cadenceDays : undefined,
      overdue: cadenceMode === 'learn' ? null : undefined,
    });
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(44, 24, 16, 0.45)',
          backdropFilter: 'blur(4px)',
          animation: 'heed-fadeIn 0.2s ease',
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 101,
        display: 'flex', justifyContent: 'center',
        animation: 'heed-slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: C.paperHi,
          width: '100%', maxWidth: 520,
          margin: '0 16px 16px 16px',
          borderRadius: '20px 20px 14px 14px',
          padding: '22px 22px 18px 22px',
          boxShadow: '0 -8px 40px rgba(124, 83, 51, 0.25)',
          border: `1px solid ${C.border}`,
          pointerEvents: 'auto',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: C.ochreSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MayaOwl size={28} idle={false} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Lora, Georgia, serif',
                fontSize: 19, fontWeight: 600, color: C.warmDark,
                letterSpacing: -0.3, lineHeight: 1.1, marginBottom: 2,
              }}>
                What should I help you remember?
              </div>
              <div style={{ fontSize: 12, color: C.inkMute, fontStyle: 'italic' }}>
                I'll figure out the best schedule for it.
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none',
                color: C.inkMute, cursor: 'pointer',
                fontSize: 20, padding: 4, lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >×</button>
          </div>

          {/* Task name */}
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Task name</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="e.g. Clean the aircon filter"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.paper,
                border: `1.5px solid ${C.border}`,
                borderRadius: 10, padding: '10px 14px',
                fontSize: 14, color: C.ink,
                outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = C.warmDark}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Category</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(CATEGORY).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    background: category === cat ? CATEGORY[cat].bg : C.paper,
                    color: category === cat ? CATEGORY[cat].color : C.inkSoft,
                    border: `1.5px solid ${category === cat ? CATEGORY[cat].color : C.border}`,
                    padding: '6px 12px', borderRadius: 999,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    textTransform: 'capitalize', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{CATEGORY[cat].icon}</span>
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Importance */}
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>How important?</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { v: 'low', label: 'Low', tone: C.sage },
                { v: 'medium', label: 'Medium', tone: C.ochre },
                { v: 'high', label: 'High', tone: C.rust },
              ].map(({ v, label, tone }) => (
                <button
                  key={v}
                  onClick={() => setImportance(v)}
                  style={{
                    flex: 1,
                    background: importance === v ? tone : C.paper,
                    color: importance === v ? C.cream : C.inkSoft,
                    border: `1.5px solid ${importance === v ? tone : C.border}`,
                    padding: '8px 12px', borderRadius: 8,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Cadence */}
          <div style={{ marginBottom: 18 }}>
            <label style={fieldLabel}>How often?</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                onClick={() => setCadenceMode('learn')}
                style={{
                  flex: 1,
                  background: cadenceMode === 'learn' ? C.bellySoft : C.paper,
                  color: cadenceMode === 'learn' ? C.warmDark : C.inkSoft,
                  border: `1.5px solid ${cadenceMode === 'learn' ? C.warmDark + '66' : C.border}`,
                  padding: '8px 12px', borderRadius: 8,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ color: C.sage }}>✨</span>
                Let Heed learn it
              </button>
              <button
                onClick={() => setCadenceMode('set')}
                style={{
                  flex: 1,
                  background: cadenceMode === 'set' ? C.bellySoft : C.paper,
                  color: cadenceMode === 'set' ? C.warmDark : C.inkSoft,
                  border: `1.5px solid ${cadenceMode === 'set' ? C.warmDark + '66' : C.border}`,
                  padding: '8px 12px', borderRadius: 8,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                I'll set it
              </button>
            </div>
            {cadenceMode === 'set' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: C.bellySoft, padding: '10px 14px', borderRadius: 8,
                animation: 'heed-fadeIn 0.2s ease',
              }}>
                <span style={{ fontSize: 13, color: C.warmDark }}>Every</span>
                <input
                  type="number" min="1" max="365"
                  value={cadenceDays}
                  onChange={e => setCadenceDays(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    width: 60, padding: '5px 10px',
                    border: `1px solid ${C.border}`, borderRadius: 6,
                    fontSize: 14, textAlign: 'center', fontFamily: 'inherit',
                    color: C.ink, background: C.paper,
                  }}
                />
                <span style={{ fontSize: 13, color: C.warmDark }}>
                  day{cadenceDays === 1 ? '' : 's'}
                </span>
                <div style={{ flex: 1, fontSize: 11, color: C.inkMute, fontStyle: 'italic', textAlign: 'right' }}>
                  Quick: 
                  {[1, 7, 14, 30].map(n => (
                    <button key={n} onClick={() => setCadenceDays(n)} style={{
                      background: 'transparent', border: 'none',
                      color: C.warmDark, fontWeight: 600,
                      cursor: 'pointer', padding: '0 4px', fontFamily: 'inherit',
                      fontSize: 11,
                    }}>{n}d</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btnGhost}>Cancel</button>
            <button
              onClick={submit}
              disabled={!name.trim()}
              style={{
                ...btnPrimary,
                padding: '8px 18px',
                opacity: name.trim() ? 1 : 0.5,
                cursor: name.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Add task
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// ADD ROUTINE MODAL — full-featured: items, importance, drag-reorder, lighten toggle
// ============================================================
function AddRoutineModal({ open, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('morning'); // morning, afternoon, evening, custom
  const [customTime, setCustomTime] = useState('07:00');
  const [days, setDays] = useState({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false });
  const [items, setItems] = useState([
    { id: 1, name: '', importance: 'medium' },
  ]);
  const [lightenOnBusy, setLightenOnBusy] = useState(true);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (open && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const reset = () => {
    setName(''); setTimeOfDay('morning'); setCustomTime('07:00');
    setDays({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false });
    setItems([{ id: 1, name: '', importance: 'medium' }]);
    setLightenOnBusy(true);
  };

  const addItem = () => {
    const newId = Math.max(0, ...items.map(i => i.id)) + 1;
    setItems([...items, { id: newId, name: '', importance: 'medium' }]);
  };

  const removeItem = (id) => {
    if (items.length === 1) return; // keep at least one
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id, patch) => {
    setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const setQuickDays = (preset) => {
    if (preset === 'weekdays') setDays({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false });
    else if (preset === 'weekends') setDays({ mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true });
    else if (preset === 'daily') setDays({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true });
  };

  const toggleDay = (key) => setDays({ ...days, [key]: !days[key] });

  // Drag-to-reorder via HTML5 drag-and-drop
  const onDragStart = (id) => setDraggingId(id);
  const onDragOver = (e, id) => {
    e.preventDefault();
    if (id !== draggingId) setDragOverId(id);
  };
  const onDragEnd = () => { setDraggingId(null); setDragOverId(null); };
  const onDrop = (targetId) => {
    if (draggingId === null || draggingId === targetId) {
      onDragEnd();
      return;
    }
    const fromIdx = items.findIndex(i => i.id === draggingId);
    const toIdx = items.findIndex(i => i.id === targetId);
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setItems(reordered);
    onDragEnd();
  };

  const submit = () => {
    if (!name.trim()) return;
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) return;

    const dayNames = Object.entries(days).filter(([_, v]) => v).map(([k]) => k.toUpperCase().slice(0,2));
    const isDaily = Object.values(days).every(v => v);
    const isWeekdays = days.mon && days.tue && days.wed && days.thu && days.fri && !days.sat && !days.sun;
    const isWeekends = days.sat && days.sun && !days.mon && !days.tue && !days.wed && !days.thu && !days.fri;
    const dayLabel = isDaily ? 'Daily' : isWeekdays ? 'Weekdays' : isWeekends ? 'Weekends' : dayNames.join(', ');

    const timeLabel = timeOfDay === 'custom' ? customTime : timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1);

    onSubmit({
      name: name.trim(),
      schedule: `${dayLabel}, ${timeLabel}`,
      items: validItems.map(i => i.name.trim()),
      itemDetails: validItems,
      lightenOnBusy,
      completion7d: [false, false, false, false, false, false, false],
      insight: 'Just added — building up history.',
      suggestion: null,
      weekRate: 'no data yet',
    });
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15, 20, 25, 0.55)',
          backdropFilter: 'blur(4px)',
          animation: 'paalala-fadeIn 0.2s ease',
        }}
      />
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 101,
        display: 'flex', justifyContent: 'center',
        animation: 'paalala-slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: C.paperHi,
          width: '100%', maxWidth: 540,
          margin: '0 16px 16px 16px',
          borderRadius: '20px 20px 14px 14px',
          boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.5)',
          border: `1px solid ${C.border}`,
          pointerEvents: 'auto',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header — pinned */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '20px 22px 14px 22px',
            borderBottom: `1px solid ${C.hairline}`,
            flexShrink: 0,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: C.bellySoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MayaOwl size={28} idle={false} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Lora, Georgia, serif',
                fontSize: 19, fontWeight: 600, color: C.warmDark,
                letterSpacing: -0.3, lineHeight: 1.1, marginBottom: 2,
              }}>
                Build a routine
              </div>
              <div style={{ fontSize: 12, color: C.inkMute, fontStyle: 'italic' }}>
                A cluster of things that happen together.
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none',
                color: C.inkMute, cursor: 'pointer',
                fontSize: 20, padding: 4, lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >×</button>
          </div>

          {/* Scrollable body */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '16px 22px 8px 22px',
          }}>
            {/* Routine name */}
            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Routine name</label>
              <input
                ref={nameInputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Morning routine, Sunday reset, Wind-down"
                style={routineInputStyle}
                onFocus={e => e.target.style.borderColor = C.warmDark}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>

            {/* Time of day */}
            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>When does it happen?</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {[
                  { v: 'morning', label: '☀ Morning' },
                  { v: 'afternoon', label: '◷ Afternoon' },
                  { v: 'evening', label: '☾ Evening' },
                  { v: 'custom', label: '⊕ Custom' },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setTimeOfDay(v)}
                    style={{
                      flex: 1, minWidth: 100,
                      background: timeOfDay === v ? C.bellySoft : C.paper,
                      color: timeOfDay === v ? C.warmDark : C.inkSoft,
                      border: `1.5px solid ${timeOfDay === v ? C.warmDark + '88' : C.border}`,
                      padding: '8px 10px', borderRadius: 8,
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >{label}</button>
                ))}
              </div>
              {timeOfDay === 'custom' && (
                <input
                  type="time"
                  value={customTime}
                  onChange={e => setCustomTime(e.target.value)}
                  style={{
                    ...routineInputStyle,
                    width: 'auto',
                    animation: 'paalala-fadeIn 0.2s ease',
                  }}
                />
              )}
            </div>

            {/* Days of week */}
            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Which days?</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {[
                  { k: 'mon', l: 'M' }, { k: 'tue', l: 'T' }, { k: 'wed', l: 'W' },
                  { k: 'thu', l: 'T' }, { k: 'fri', l: 'F' }, { k: 'sat', l: 'S' }, { k: 'sun', l: 'S' },
                ].map(({ k, l }) => (
                  <button
                    key={k}
                    onClick={() => toggleDay(k)}
                    style={{
                      flex: 1, aspectRatio: '1 / 1',
                      background: days[k] ? C.warmDark : C.paper,
                      color: days[k] ? C.cream : C.inkMute,
                      border: `1.5px solid ${days[k] ? C.warmDark : C.border}`,
                      borderRadius: 8,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >{l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { k: 'weekdays', l: 'Weekdays' },
                  { k: 'weekends', l: 'Weekends' },
                  { k: 'daily', l: 'Daily' },
                ].map(({ k, l }) => (
                  <button key={k} onClick={() => setQuickDays(k)} style={{
                    background: 'transparent',
                    color: C.inkMute,
                    border: `1px solid ${C.border}`,
                    padding: '4px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Items list with drag-reorder */}
            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Items in this routine</label>
              <div style={{ marginBottom: 8 }}>
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => onDragStart(item.id)}
                    onDragOver={(e) => onDragOver(e, item.id)}
                    onDragEnd={onDragEnd}
                    onDrop={() => onDrop(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 6,
                      padding: '6px 8px',
                      background: dragOverId === item.id ? C.bellySoft : 'transparent',
                      border: `1.5px solid ${draggingId === item.id ? C.warmDark : 'transparent'}`,
                      borderRadius: 8,
                      opacity: draggingId === item.id ? 0.5 : 1,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    {/* Drag handle */}
                    <div style={{
                      cursor: 'grab',
                      color: C.inkMute,
                      fontSize: 14,
                      padding: '0 4px',
                      userSelect: 'none',
                      flexShrink: 0,
                    }}>⋮⋮</div>

                    {/* Item input */}
                    <input
                      value={item.name}
                      onChange={e => updateItem(item.id, { name: e.target.value })}
                      placeholder={`Item ${idx + 1} (e.g. ${idx === 0 ? 'Stretch 5 min' : idx === 1 ? 'Vitamins' : 'Read 10 pages'})`}
                      style={{
                        flex: 1, minWidth: 0,
                        background: C.paper,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6, padding: '7px 10px',
                        fontSize: 13, color: C.ink,
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />

                    {/* Per-item importance */}
                    <select
                      value={item.importance}
                      onChange={e => updateItem(item.id, { importance: e.target.value })}
                      style={{
                        background: C.paper,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6, padding: '7px 6px',
                        fontSize: 11.5, color: C.inkSoft,
                        outline: 'none', fontFamily: 'inherit',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Med</option>
                      <option value="high">High</option>
                    </select>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      aria-label="Remove item"
                      style={{
                        background: 'transparent', border: 'none',
                        color: items.length === 1 ? C.hairline : C.inkMute,
                        cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                        fontSize: 16, padding: '0 6px', lineHeight: 1,
                        fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
              <button
                onClick={addItem}
                style={{
                  background: 'transparent',
                  color: C.warmDark,
                  border: `1.5px dashed ${C.border}`,
                  padding: '8px 14px', borderRadius: 8,
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', width: '100%',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.warmDark; e.currentTarget.style.background = C.bellySoft; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent'; }}
              >
                + Add another item
              </button>
              <div style={{
                fontSize: 11, color: C.inkMute,
                fontStyle: 'italic', textAlign: 'center', marginTop: 6,
              }}>
                Drag the ⋮⋮ handle to reorder
              </div>
            </div>

            {/* Lighten on busy days toggle */}
            <div style={{
              marginBottom: 8,
              padding: '12px 14px',
              background: lightenOnBusy ? C.sageSoft : C.paper,
              border: `1.5px solid ${lightenOnBusy ? C.sage + '66' : C.border}`,
              borderRadius: 10,
              display: 'flex', alignItems: 'flex-start', gap: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setLightenOnBusy(!lightenOnBusy)}
            >
              <div style={{
                width: 36, height: 20, borderRadius: 999,
                background: lightenOnBusy ? C.sage : C.border,
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0, marginTop: 1,
              }}>
                <div style={{
                  position: 'absolute',
                  top: 2, left: lightenOnBusy ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: C.cream,
                  transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: lightenOnBusy ? C.sage : C.inkSoft,
                  marginBottom: 2,
                }}>
                  Lighten this routine on busy days
                </div>
                <div style={{
                  fontSize: 11.5, color: C.inkMute, fontStyle: 'italic',
                  lineHeight: 1.4,
                }}>
                  When you mark a day as busy, Heed will keep only the high-importance items and skip the rest, no nag.
                </div>
              </div>
            </div>
          </div>

          {/* Footer — pinned */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            padding: '12px 22px 16px 22px',
            borderTop: `1px solid ${C.hairline}`,
            flexShrink: 0,
          }}>
            <button onClick={onClose} style={btnGhost}>Cancel</button>
            <button
              onClick={submit}
              disabled={!name.trim() || items.every(i => !i.name.trim())}
              style={{
                ...btnPrimary,
                padding: '8px 18px',
                opacity: (name.trim() && items.some(i => i.name.trim())) ? 1 : 0.5,
                cursor: (name.trim() && items.some(i => i.name.trim())) ? 'pointer' : 'not-allowed',
              }}
            >
              Build routine
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const routineInputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: C.paper,
  border: `1.5px solid ${C.border}`,
  borderRadius: 10, padding: '10px 14px',
  fontSize: 14, color: C.ink,
  outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

// ============================================================
// ADD CONTEXT MODAL
// ============================================================
function AddContextModal({ open, onClose, onSubmit }) {
  const [type, setType] = useState('travel');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const descInputRef = useRef(null);

  useEffect(() => {
    if (open && descInputRef.current) {
      setTimeout(() => descInputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const reset = () => {
    setType('travel'); setStartDate(''); setEndDate(''); setDescription('');
  };

  // Auto-fill end date if user only sets start (default same day)
  useEffect(() => {
    if (startDate && !endDate) setEndDate(startDate);
  }, [startDate, endDate]);

  const isValid = description.trim() && startDate && endDate && (new Date(endDate) >= new Date(startDate));

  const formatDateLabel = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const submit = () => {
    if (!isValid) return;
    const startD = new Date(startDate);
    const endD = new Date(endDate);
    onSubmit({
      type,
      desc: description.trim(),
      start: formatDateLabel(startDate),
      end: formatDateLabel(endDate),
      _startDate: startD,
      _endDate: endD,
    });
    reset();
    onClose();
  };

  if (!open) return null;

  const typeOptions = [
    { v: 'travel', label: 'Travel', icon: '✈️', tone: C.ochre },
    { v: 'illness', label: 'Illness', icon: '🤒', tone: C.rust },
    { v: 'busy', label: 'Busy week', icon: '⏱️', tone: C.warmDark },
    { v: 'celebration', label: 'Celebration', icon: '🎉', tone: C.rose },
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15, 20, 25, 0.55)',
          backdropFilter: 'blur(4px)',
          animation: 'paalala-fadeIn 0.2s ease',
        }}
      />
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 101,
        display: 'flex', justifyContent: 'center',
        animation: 'paalala-slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: C.paperHi,
          width: '100%', maxWidth: 520,
          margin: '0 16px 16px 16px',
          borderRadius: '20px 20px 14px 14px',
          padding: '22px 22px 18px 22px',
          boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.5)',
          border: `1px solid ${C.border}`,
          pointerEvents: 'auto',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: C.bellySoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MayaOwl size={28} idle={false} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Lora, Georgia, serif',
                fontSize: 19, fontWeight: 600, color: C.warmDark,
                letterSpacing: -0.3, lineHeight: 1.1, marginBottom: 2,
              }}>
                What's coming up?
              </div>
              <div style={{ fontSize: 12, color: C.inkMute, fontStyle: 'italic' }}>
                I'll plan around it. No nag, no missed-pattern flags.
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none',
                color: C.inkMute, cursor: 'pointer',
                fontSize: 20, padding: 4, lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >×</button>
          </div>

          {/* Type */}
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {typeOptions.map(({ v, label, icon, tone }) => (
                <button
                  key={v}
                  onClick={() => setType(v)}
                  style={{
                    flex: 1, minWidth: 100,
                    background: type === v ? tone : C.paper,
                    color: type === v ? C.cream : C.inkSoft,
                    border: `1.5px solid ${type === v ? tone : C.border}`,
                    padding: '8px 10px', borderRadius: 8,
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>What's happening?</label>
            <input
              ref={descInputRef}
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isValid && submit()}
              placeholder={
                type === 'travel' ? "e.g. Singapore for DEF CON" :
                type === 'illness' ? "e.g. Flu, taking it easy" :
                type === 'busy' ? "e.g. Client deadline week" :
                "e.g. Tita's 60th birthday weekend"
              }
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.paper,
                border: `1.5px solid ${C.border}`,
                borderRadius: 10, padding: '10px 14px',
                fontSize: 14, color: C.ink,
                outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = C.warmDark}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          {/* Dates */}
          <div style={{ marginBottom: 18, display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: C.paper,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 14, color: C.ink,
                  outline: 'none', fontFamily: 'inherit',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>To</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={e => setEndDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: C.paper,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 14, color: C.ink,
                  outline: 'none', fontFamily: 'inherit',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btnGhost}>Cancel</button>
            <button
              onClick={submit}
              disabled={!isValid}
              style={{
                ...btnPrimary,
                padding: '8px 18px',
                opacity: isValid ? 1 : 0.5,
                cursor: isValid ? 'pointer' : 'not-allowed',
              }}
            >
              Add context
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const fieldLabel = {
  display: 'block',
  fontSize: 11, fontWeight: 700, color: C.inkMute,
  letterSpacing: 0.6, textTransform: 'uppercase',
  marginBottom: 6,
};

// ============================================================
// MAIN APP
// ============================================================
export default function HeedApp() {
  const [tab, setTab] = useState('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [addedTasks, setAddedTasks] = useState([]);
  const [addedRoutines, setAddedRoutines] = useState([]);
  const [addedContexts, setAddedContexts] = useState([]);

  const handleAddTask = (taskData) => {
    const newTask = {
      id: 1000 + addedTasks.length,
      ...taskData,
    };
    setAddedTasks(t => [...t, newTask]);
    // Briefly bounce to Today tab so user sees the new task land
    setTab('today');
  };

  const handleAddRoutine = (routineData) => {
    const newRoutine = {
      id: `custom_${addedRoutines.length}`,
      ...routineData,
    };
    setAddedRoutines(r => [...r, newRoutine]);
    setTab('today');
  };

  const handleAddContext = (contextData) => {
    setAddedContexts(c => [...c, contextData]);
    // Stay on Context tab so user sees the new context land in Upcoming/Past
  };

  const tabs = [
    { id: 'today', label: 'Today', count: 8 },
    { id: 'calendar', label: 'Calendar' },
    { id: 'ask', label: 'Ask Heed' },
    { id: 'tracks', label: 'Tracks' },
    { id: 'context', label: 'Context' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 30% 0%, ${C.paper} 0%, ${C.cream} 60%)`,
      color: C.ink,
      fontFamily: '"Nunito Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Nunito+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes heed-fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heed-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes heed-pulse {
          0%, 100% { opacity: 0.4; transform: translateX(-50%) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.4); }
        }
        @keyframes heed-breathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.05); }
        }
        @keyframes heed-blink {
          0%, 50%, 100% { opacity: 1; }
          25%, 75% { opacity: 0.3; }
        }
        @keyframes heed-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes heed-slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heed-slideRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        ::selection { background: ${C.warmDark}; color: ${C.cream}; }
      `}</style>

      <header style={{
        borderBottom: `1px solid ${C.hairline}`,
        padding: '20px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(180deg, ${C.paperHi} 0%, ${C.paper} 100%)`,
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MayaOwl size={48} />
          <div>
            <div style={{
              fontFamily: 'Lora, Georgia, serif', fontSize: 26, fontWeight: 700,
              color: C.warmDark, letterSpacing: -0.7, lineHeight: 1,
            }}>Heed</div>
            <div style={{
              fontSize: 11.5, color: C.inkMute, fontStyle: 'italic',
              marginTop: 3, letterSpacing: 0.2,
            }}>The agent that remembers what you forget.</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>Tuesday, April 21</div>
          <div style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>Hi, Maya 👋</div>
        </div>
      </header>

      <nav style={{
        display: 'flex', gap: 4, padding: '0 32px',
        borderBottom: `1px solid ${C.hairline}`, background: C.paper,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'transparent', border: 'none',
            padding: '14px 20px', fontSize: 14,
            fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? C.warmDark : C.inkMute,
            cursor: 'pointer',
            borderBottom: `2px solid ${tab === t.id ? C.warmDark : 'transparent'}`,
            marginBottom: -1, display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: 'inherit', transition: 'color 0.15s',
          }}>
            {t.label}
            {t.count !== undefined && (
              <span style={{
                background: tab === t.id ? C.rust : C.border,
                color: tab === t.id ? C.cream : C.inkMute,
                padding: '1px 8px', borderRadius: 999,
                fontSize: 11, fontWeight: 700,
                transition: 'all 0.15s',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      <main style={{
        maxWidth: 820, margin: '0 auto',
        padding: '28px 32px 60px 32px',
        minHeight: 'calc(100vh - 140px)',
        display: 'flex', flexDirection: 'column',
      }}>
        {tab === 'today' && <TodayTab extraTasks={addedTasks} extraRoutines={addedRoutines} />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'ask' && <AskTab />}
        {tab === 'tracks' && <TracksTab extraTasks={addedTasks} extraRoutines={addedRoutines} />}
        {tab === 'context' && <ContextTab extraContexts={addedContexts} onAddContext={() => setContextModalOpen(true)} />}
      </main>

      <footer style={{
        textAlign: 'center', fontSize: 11, color: C.inkMute,
        padding: '24px', borderTop: `1px solid ${C.hairline}`,
        fontStyle: 'italic',
      }}>
        Prototype with scripted agent responses. The real app will use Microsoft Agent Framework + Azure OpenAI + Azure AI Search.
      </footer>

      <AddTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddTask}
      />
      <AddRoutineModal
        open={routineModalOpen}
        onClose={() => setRoutineModalOpen(false)}
        onSubmit={handleAddRoutine}
      />
      <AddContextModal
        open={contextModalOpen}
        onClose={() => setContextModalOpen(false)}
        onSubmit={handleAddContext}
      />
      <AskInlineModal
        open={askOpen}
        onClose={() => setAskOpen(false)}
      />
      <HeedFAB
        onAddTask={() => setModalOpen(true)}
        onAskHeed={() => setAskOpen(true)}
        onAddRoutine={() => setRoutineModalOpen(true)}
      />
    </div>
  );
}
