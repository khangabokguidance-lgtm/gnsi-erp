// cbtCertLogic.js — pure helpers for the CBT result certificate: find the ERP student behind an attempt, certificate
// numbers and the performance band. No browser or database code here so it can be unit-tested.

const gccKey = v => String(v ?? '').replace(/\D/g, '').replace(/^0+/, '')
const nameKey = v => String(v ?? '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim()

// The ERP student for an attempt: by GCC no. (typed on the online form, or typed as the roll no.), else by an exact
// name that belongs to one student only. { student, how } — how: 'gcc' | 'roll' | 'name' | null.
export function findStudent(students, attempt) {
  const list = students || []
  const byGcc = k => (k ? list.find(s => gccKey(s.gcc_no) === k) : null)
  let s = byGcc(gccKey(attempt?.gcc))
  if (s) return { student: s, how: 'gcc' }
  s = byGcc(gccKey(attempt?.candidate?.roll))
  if (s) return { student: s, how: 'roll' }
  const n = nameKey(attempt?.candidate?.name)
  if (n) {
    const hits = list.filter(x => nameKey(x.name) === n)
    if (hits.length === 1) return { student: hits[0], how: 'name' }
  }
  return { student: null, how: null }
}

// The attempt a staff member means when they type a GCC no. for a test: that student's submitted attempt, best marks first.
export function attemptForGcc(rows, students, gcc) {
  const k = gccKey(gcc)
  if (!k) return null
  const mine = (rows || []).filter(r => r.submitted && findStudent(students, r.attempt).student && gccKey(findStudent(students, r.attempt).student.gcc_no) === k)
  return mine.sort((a, b) => b.g.marks - a.g.marks)[0] || null
}

export const certNumber = (test, student, year = new Date().getFullYear()) =>
  `GNSI/CBT/${year}/${String(test?.id || '').replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase() || 'TEST'}-${String(gccKey(student?.gcc_no) || '0').padStart(4, '0')}`

export function band(percent) {
  if (percent == null) return { label: 'Participation', note: 'for taking part in' }
  if (percent >= 90) return { label: 'Outstanding', note: 'with an outstanding performance in' }
  if (percent >= 75) return { label: 'Excellent', note: 'with an excellent performance in' }
  if (percent >= 60) return { label: 'Very good', note: 'with a very good performance in' }
  if (percent >= 40) return { label: 'Satisfactory', note: 'with a satisfactory performance in' }
  return { label: 'Participation', note: 'for taking part in' }
}

// The parent's number as kept on the student record (the same fields the fee reminders use).
export const parentPhoneOf = st => {
  const raw = st?.parent_phone || st?.parent_contact || st?.guardian_phone || st?.father_phone || st?.mother_phone || st?.guardian_mobile || st?.mobile || st?.phone || ''
  const d = String(raw).replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : String(raw || '').trim()
}

