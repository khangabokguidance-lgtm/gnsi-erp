// missionSainikStudents.js — the student list of Mission Sainik: every Sainik student, and the Combined Course students (pure, unit-tested).
// Uses the same rules as the rest of the ERP (classifyStudent / courseOf), so a student is in the same batch here as in Students.
import { classifyStudent } from './studentClass.js'

export const SAINIK_VIEWS = [['all', 'All students'], ['sainik', 'Sainik'], ['combined', 'Combined course']]

// A student row → what the list needs, or null when the student is in neither course.
export function sainikRow(s) {
  const c = classifyStudent(s)
  if (c.course !== 'Sainik' && c.course !== 'Combined Course') return null
  return {
    id: s.id, name: String(s.name || '').trim(), gcc: s.gcc_no || s.admission_no || '', phone: s.phone || '', status: s.status || '',
    course: c.course, group: c.course === 'Sainik' ? 'sainik' : 'combined', batch: c.label, batchKey: c.key, medium: c.medium || '',
    photo: s.photo_url || '', photoPath: s.photo_path || '',
  }
}

// Every Sainik + Combined student, sorted by name.
export function sainikRoster(students) {
  return (students || []).map(sainikRow).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
}

// view: 'all' | 'sainik' | 'combined'; batchKey: '' or a class key (achiever, combined-mm …); q: search text (name, GCC, phone, batch).
export function filterRoster(roster, { view = 'all', batchKey = '', q = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  return (roster || []).filter(r =>
    (view === 'all' || r.group === view) && (!batchKey || r.batchKey === batchKey)
    && (!needle || [r.name, r.gcc, r.phone, r.batch].join(' ').toLowerCase().includes(needle)))
}

// Counts for the chips: by view, and by batch inside the chosen view. Batches come out in a stable order (Sainik first).
export function rosterCounts(roster, view = 'all') {
  const base = (roster || []).filter(r => view === 'all' || r.group === view)
  const batches = new Map()
  base.forEach(r => { const e = batches.get(r.batchKey) || { key: r.batchKey, label: r.batch, group: r.group, n: 0 }; e.n++; batches.set(r.batchKey, e) })
  return {
    all: (roster || []).length, sainik: (roster || []).filter(r => r.group === 'sainik').length, combined: (roster || []).filter(r => r.group === 'combined').length,
    batches: [...batches.values()].sort((a, b) => (a.group === b.group ? a.label.localeCompare(b.label) : a.group === 'sainik' ? -1 : 1)),
  }
}
