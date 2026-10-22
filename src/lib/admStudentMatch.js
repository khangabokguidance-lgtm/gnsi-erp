// admStudentMatch.js — pure comparison of the Admissions and Students modules, joined on GCC number.
// Finds records that exist on one side only, duplicate GCC numbers, and shared fields that disagree.
// The field list mirrors ADM_STUDENT_SYNC_FIELDS (Admissions.jsx) / STUDENT_ADM_SYNC_FIELDS (Students.jsx).

export const SYNC_FIELDS = [
  // [admissions column, students column, label, kind]
  ['applicant_name', 'name', 'Name', 'text'], ['dob', 'dob', 'Date of birth', 'date'], ['gender', 'gender', 'Gender', 'text'],
  ['blood_group', 'blood_group', 'Blood group', 'text'], ['course', 'course', 'Course', 'text'], ['batch', 'batch', 'Batch', 'text'],
  ['class_name', 'class_name', 'Class', 'text'], ['house', 'house', 'House', 'text'], ['hostel_type', 'hostel_type', 'Hostel type', 'text'],
  ['session', 'session', 'Session', 'text'], ['father_name', 'father_name', "Father's name", 'text'], ['mother_name', 'mother_name', "Mother's name", 'text'],
  ['phone', 'phone', 'Phone', 'phone'], ['parent_phone', 'parent_phone', 'Parent phone', 'phone'], ['address', 'address', 'Address', 'text'],
  ['prev_school', 'prev_school', 'Previous school', 'text'],
]

export const gk = v => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? String(n) : '' }
const norm = (v, kind) => {
  if (v == null) return ''
  const s = String(v).trim()
  if (kind === 'date') return s.slice(0, 10)
  if (kind === 'phone') return s.replace(/\D/g, '').slice(-10)
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '')
}
const isLive = s => !s.deleted_at && s.status !== 'Deleted'

export function matchAdmissionsStudents({ admissions = [], students = [] }) {
  const group = (rows, key) => { const m = new Map(); for (const r of rows) { const g = key(r); if (!g) continue; if (!m.has(g)) m.set(g, []); m.get(g).push(r) } return m }
  const admBy = group(admissions, a => gk(a.gcc_no))
  const stuBy = group(students.filter(isLive), s => gk(s.gcc_no))
  const who = (g, a, s) => ({ gcc: g, name: (s && s.name) || (a && a.applicant_name) || '—' })

  const enrolledNoStudent = [], studentNoAdmission = [], studentButNotEnrolled = [], duplicates = [], statusDiff = [], fieldDiffs = []
  for (const [g, rows] of admBy) if (rows.length > 1) duplicates.push({ ...who(g, rows[0], null), where: 'Admissions', count: rows.length })
  for (const [g, rows] of stuBy) if (rows.length > 1) duplicates.push({ ...who(g, null, rows[0]), where: 'Students', count: rows.length })

  for (const [g, rows] of admBy) {
    const a = rows.find(r => r.status === 'Enrolled') || rows[0]
    const s = stuBy.get(g)?.[0]
    if (!s) { if (rows.some(r => r.status === 'Enrolled')) enrolledNoStudent.push(who(g, a, null)); continue }
    if (!rows.some(r => r.status === 'Enrolled')) studentButNotEnrolled.push({ ...who(g, a, s), admStatus: a.status || '—', stuStatus: s.status || 'Active' })
    if ((s.status === 'Dropout' || s.status === 'Inactive') && a.status === 'Enrolled') statusDiff.push({ ...who(g, a, s), admStatus: a.status, stuStatus: s.status })
    for (const [ac, sc, label, kind] of SYNC_FIELDS) {
      const av = norm(a[ac], kind), sv = norm(s[sc], kind)
      if (av === sv) continue
      fieldDiffs.push({ ...who(g, a, s), field: label, adm: a[ac] ?? '', stu: s[sc] ?? '',
        type: !av ? 'blank in Admissions' : !sv ? 'blank in Students' : 'different' })
    }
  }
  for (const [g, rows] of stuBy) {
    const s = rows[0]
    if (!admBy.has(g) && (!s.status || s.status === 'Active')) studentNoAdmission.push(who(g, null, s))
  }
  const byGcc = (a, b) => Number(a.gcc) - Number(b.gcc)
  ;[enrolledNoStudent, studentNoAdmission, studentButNotEnrolled, duplicates, statusDiff, fieldDiffs].forEach(l => l.sort(byGcc))
  const fieldCounts = {}
  for (const d of fieldDiffs) fieldCounts[d.field] = (fieldCounts[d.field] || 0) + 1
  return {
    admissionsCount: admissions.length, studentsCount: [...stuBy.values()].flat().length, paired: [...admBy.keys()].filter(g => stuBy.has(g)).length,
    enrolledNoStudent, studentNoAdmission, studentButNotEnrolled, duplicates, statusDiff, fieldDiffs, fieldCounts,
  }
}

// Per-GCC link state for badges and filters. state: 'ok' | 'noStudent' | 'notEnrolled' | 'status' | 'diff' | 'dup'
// (GCCs with no student that are not Enrolled are simply absent — that is normal for an open application).
export const LINK_LABEL = { ok: 'Linked', noStudent: 'No student record', notEnrolled: 'Student not Enrolled', status: 'Status differs', diff: 'Fields differ', dup: 'Duplicate GCC' }
export function admissionLinks({ admissions = [], students = [] }) {
  const r = matchAdmissionsStudents({ admissions, students })
  const links = new Map()
  const set = (g, state, extra = {}) => { const cur = links.get(g); if (!cur || RANK[state] > RANK[cur.state]) links.set(g, { ...(cur || {}), state, ...extra }) }
  const RANK = { ok: 0, diff: 1, status: 2, notEnrolled: 3, dup: 4, noStudent: 5 }
  const liveStu = new Set(students.filter(isLive).map(s => gk(s.gcc_no)))
  for (const a of admissions) { const g = gk(a.gcc_no); if (g && liveStu.has(g)) set(g, 'ok') }
  for (const x of r.fieldDiffs) { set(x.gcc, 'diff'); const l = links.get(x.gcc); l.diffs = [...(l.diffs || []), x] }
  for (const x of r.statusDiff) set(x.gcc, 'status', { note: `Admission says ${x.admStatus}, student is ${x.stuStatus}` })
  for (const x of r.studentButNotEnrolled) set(x.gcc, 'notEnrolled', { note: `Student exists (${x.stuStatus}) but admission is ${x.admStatus}` })
  for (const x of r.duplicates) set(x.gcc, 'dup', { note: `${x.count} rows in ${x.where}` })
  for (const x of r.enrolledNoStudent) set(x.gcc, 'noStudent', { note: 'Marked Enrolled but there is no student with this GCC' })
  return links
}
