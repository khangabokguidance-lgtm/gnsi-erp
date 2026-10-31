// House Master / Mistress study duty roster — the fixed daily timetable.
// Pure data + helpers (no React / Supabase) so it can be unit-tested.

// Courses a slot's task list is split by. 'Navodaya & Combined' share one row.
export const DUTY_GROUPS = [
  { key: 'navcomb', label: 'Navodaya & Combined', courses: ['Navodaya', 'Combined Course'] },
  { key: 'sainik', label: 'Sainik', courses: ['Sainik'] },
  { key: 'foundation', label: 'Foundation', courses: ['Foundation'] },
]

export const DUTY_SLOTS = [
  {
    key: 'self_duties',
    time: '5:30 AM – 6:00 AM',
    start: '05:30', end: '06:00',
    task: 'Self Duties',
    responsibility: 'Instruct all students to get ready for study.',
    tasks: null,
  },
  {
    key: 'morning_study',
    time: '6:00 AM – 7:00 AM',
    start: '06:00', end: '07:00',
    task: 'Morning study — practice in classroom',
    responsibility: 'Practice at 6:00–7:00 AM in the classroom. Upload the photo in the WhatsApp group.',
    photo: true,
    tasks: {
      navcomb: 'Meitei Mayek Passage',
      sainik: 'Science & GK',
      foundation: 'Reasoning',
    },
  },
  {
    key: 'afternoon_study',
    time: '3:15 PM – 4:45 PM',
    start: '15:15', end: '16:45',
    task: 'Afternoon study',
    responsibility: 'Supervise the practice below.',
    tasks: {
      navcomb: 'Maths Practice',
      sainik: 'Grammar, Vocabulary & Reasoning',
      foundation: 'Maths I & Maths II',
    },
  },
  {
    key: 'evening_study',
    time: '5:40 PM – 7:00 PM',
    start: '17:40', end: '19:00',
    task: 'Evening study',
    responsibility: 'Supervise the practice below. Check all classes in the ERP.',
    checkErp: true,
    tasks: {
      navcomb: 'EVS Practice',
      sainik: 'Maths I & II',
      foundation: 'EVS & Grammar',
    },
  },
]

export const ALL_STAFF_NOTE = 'Applies to all House Masters & Mistresses.'

// Which slot is running at "HH:MM" (24h). Returns the slot key or null.
export function currentSlotKey(hhmm) {
  const s = DUTY_SLOTS.find(sl => hhmm >= sl.start && hhmm < sl.end)
  return s ? s.key : null
}

// Checklist rows for one slot: one per course group (or a single row for
// slots with no per-course tasks). Keys are stable ids stored in the log.
export function slotItems(slot) {
  if (!slot.tasks) return [{ key: `${slot.key}:all`, label: slot.task }]
  return DUTY_GROUPS.map(g => ({ key: `${slot.key}:${g.key}`, label: `${g.label} — ${slot.tasks[g.key]}` }))
}

export const allItemKeys = () => DUTY_SLOTS.flatMap(s => slotItems(s).map(i => i.key))

// done: { [itemKey]: true }. Returns { done, total, pct }.
export function dutyProgress(done = {}) {
  const keys = allItemKeys()
  const n = keys.filter(k => done[k]).length
  return { done: n, total: keys.length, pct: Math.round((n / keys.length) * 100) }
}
