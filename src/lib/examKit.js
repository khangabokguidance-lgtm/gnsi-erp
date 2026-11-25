// examKit.js — the Exam kit tab of Mission Sainik and Mission Foundation (pure, unit-tested).
// The tools themselves (roll chart, OMR sheets, question booklet) are self-contained pages in /public/exam-kit;
// the ERP only hands them the live student list as "GCC No,Name,Class" lines.

export const EXAM_KIT_BASE = '/exam-kit'

export const EXAM_KIT_TOOLS = {
  sainik: [
    { id: 'roll', label: 'Roll chart & attendance', file: 'sainik-roll-chart.html', roster: true,
      hint: 'Seating plan, roll chart with P / A, door notices and the room summary.' },
    { id: 'omr', label: 'OMR answer sheets', file: 'sainik-omr.html', roster: true,
      hint: 'A4 OMR sheet per student, answer key, checking and marks list.' },
  ],
  foundation: [
    { id: 'book', label: 'Question booklet', file: 'foundation-booklet.html', roster: false,
      hint: 'Foundation Group Monthly Test, November 2026: Udaan and Pragati papers.' },
    { id: 'roll', label: 'Roll chart & attendance', file: 'foundation-roll-chart.html', roster: true,
      hint: 'Seating plan, roll chart with P / A, door notices and the room summary.' },
    { id: 'omr', label: 'OMR answer sheets', file: 'foundation-omr.html', roster: true,
      hint: 'A4 OMR sheet per student, answer keys from the booklet, checking and marks list.' },
  ],
}

// Sainik batches as the tools name them ("Achiever" in Students → "Sainik Achiever" on the sheets).
const SAINIK_CLASS = { Achiever: 'Sainik Achiever', Leader: 'Sainik Leader', Champion: 'Sainik Champion' }

const clean = v => String(v ?? '').replace(/[,\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()

// Mission Sainik roster rows (sainikRow) → tool rows. Combined course students only when asked for.
export function sainikKitRows(roster, { includeCombined = false } = {}) {
  return (roster || [])
    .filter(r => r && (r.group === 'sainik' || (includeCombined && r.group === 'combined')))
    .map(r => ({ gcc: clean(r.gcc), name: clean(r.name), cls: clean(SAINIK_CLASS[r.batch] || r.batch) }))
    .filter(r => r.gcc && r.name)
}

// Mission Foundation placed students (foundationRoster().placed) → tool rows.
export function foundationKitRows(students) {
  return (students || [])
    .map(s => ({ gcc: clean(s.gcc_no || s.admission_no), name: clean(s.name), cls: clean(s.batchName || s.batch) }))
    .filter(r => r.gcc && r.name && r.cls)
}

// Tool rows → the CSV text the roll chart and OMR pages read, grouped by class then by name.
export function kitCsv(rows) {
  const order = []
  ;(rows || []).forEach(r => { if (!order.includes(r.cls)) order.push(r.cls) })
  const sorted = [...(rows || [])].sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls) || a.name.localeCompare(b.name))
  return ['GCC No,Name,Class', ...sorted.map(r => [r.gcc, r.name, r.cls].join(','))].join('\n')
}

// "Udaan 48 · Pragati 34"
export function kitCountLine(rows) {
  const m = new Map()
  ;(rows || []).forEach(r => m.set(r.cls, (m.get(r.cls) || 0) + 1))
  return [...m].map(([c, n]) => `${c} ${n}`).join(' · ')
}

// ── Test series → what the tools print ────────────────────────────────────────────────────────────────────
// A series test becomes one "exam" the roll chart and OMR pages fill in: title, date, time, sections and marks.
// sections: [{ name, q, each }]. tag keeps each test's answer key and marks apart inside the OMR page.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ''
}
export function durationText(min) {
  const n = Math.round(Number(min) || 0)
  if (n <= 0) return ''
  const h = Math.floor(n / 60), r = n % 60
  if (!h) return `${r} Minutes`
  return `${h} Hour${h > 1 ? 's' : ''}${r ? ` ${r} Minutes` : ''}`
}
const totals = secs => ({ q: secs.reduce((a, s) => a + s.q, 0), marks: secs.reduce((a, s) => a + s.q * s.each, 0) })

// Mission Sainik: kind 'pre' (PMT-NN, six sections of 25 × 2 marks) or 'mega' (MT-NN, AISSEE pattern, 150 minutes).
// subjects / mockSections come from missionSainikData (SUBJECTS, MOCK_SECTIONS); tests from TESTS / MOCK_TESTS.
export function sainikSeries(kind, tests, { subjects = [], mockSections = [] } = {}) {
  const pre = kind !== 'mega'
  const secs = pre
    ? subjects.map(s => ({ name: s.label, q: 25, each: 2 }))
    : mockSections.map(s => ({ name: s.label, q: s.q, each: s.q ? Math.round((s.marks / s.q) * 100) / 100 : 0 }))
  const label = pre ? 'Pre Mock Test' : 'Mega Mock Test'
  return (tests || []).map(t => ({
    tag: (pre ? 'pre-' : 'mega-') + t.id, id: t.id, date: t.date, label,
    title: `${label} · ${t.id}`, sub: 'Mission Sainik 2027', rollTitle: `Mission Sainik 2027 · ${label} ${t.id}`,
    minutes: pre ? 0 : 150, start: '', sections: secs, ...totals(secs),
  }))
}

// Mission Foundation: tests are rows of the tests table; each test's shared papers give the sections.
// defaults (SUBJECTS) fill a section whose questions / marks are not set yet.
export function foundationSeries(tests, papersByTest = {}, defaults = []) {
  return (tests || []).map(t => {
    const papers = papersByTest[t.id] || []
    const src = papers.length ? papers.map(p => ({ p, d: defaults.find(s => s.label === p.subject) || {} })) : defaults.map(d => ({ p: { subject: d.label }, d }))
    const secs = src.map(({ p, d }) => ({ name: p.subject, q: Number(p.questions ?? d.questions) || 0, each: Number(p.marks_each ?? d.marks_each) || 0 })).filter(s => s.q > 0)
    const id = t.title || `Test ${String(t.test_no || '').padStart(2, '0')}`
    return {
      tag: 'mf-' + (t.id ?? t.test_no), id, date: t.test_date, label: 'Weekly Test',
      title: `Foundation ${id}`, sub: 'Mission Foundation', rollTitle: `Mission Foundation · ${id}`,
      minutes: Number(t.duration_min) || 0, start: t.start_time || '', sections: secs, ...totals(secs),
    }
  })
}

// The test to open on: today's or the next one, else the last one.
export function pickTest(series, today) {
  if (!series?.length) return null
  return series.find(t => t.date >= today) || series[series.length - 1]
}

// The message the tool pages read (type 'gnsi-exam').
export function examMessage(t) {
  const time = [String(t.start || '').slice(0, 5), durationText(t.minutes)].filter(Boolean).join(' · ')
  return {
    type: 'gnsi-exam', tag: t.tag, id: t.id, title: t.title, sub: t.sub, rollTitle: t.rollTitle,
    date: longDate(t.date), time, marks: String(t.marks || ''),
    secs: t.sections.map(s => `${s.name}, ${s.q}, ${s.each}`).join('\n'),
  }
}
