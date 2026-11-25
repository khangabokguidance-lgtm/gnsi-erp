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
