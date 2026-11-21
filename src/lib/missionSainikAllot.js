// missionSainikAllot.js — choosing which teacher sets each Pre Mock test paper (pure, unit-tested).
// rows: Pre Mock task rows { id, test_no, subject, setter, status }.  setters: the panel's setters for that subject, in panel order.

// Verifier rule (same as the notice): GK is checked by Arunkumar; otherwise the next setter on the panel checks, so two verify each other and three rotate.
export function pickVerifier(subjectKey, setter, setters) {
  if (subjectKey === 'gk') return 'Arunkumar'
  const list = setters || []
  const i = list.indexOf(setter)
  if (i < 0 || list.length < 2) return ''
  return list[(i + 1) % list.length]
}

// Number of tests each person sets (all statuses), for showing the workload next to a name.
export function setterLoad(rows) {
  const m = {}
  ;(rows || []).forEach(r => { if (r.setter) m[r.setter] = (m[r.setter] || 0) + 1 })
  return m
}

// Share one subject's tests evenly between its setters. Tests already submitted (status other than Pending) keep their setter and count
// toward that person's total; each Pending test, in test order, goes to whoever has the fewest so far (ties → panel order).
// Returns [{ id, test_no, setter }] for the rows that CHANGE.
export function shareEvenly(rows, setters) {
  const list = [...new Set(setters || [])]
  if (!list.length) return []
  const sorted = [...(rows || [])].sort((a, b) => a.test_no - b.test_no)
  const count = Object.fromEntries(list.map(s => [s, 0]))
  sorted.filter(r => r.status !== 'Pending').forEach(r => { if (r.setter in count) count[r.setter]++ })
  const out = []
  sorted.filter(r => r.status === 'Pending').forEach(r => {
    const pick = list.reduce((best, s) => (count[s] < count[best] ? s : best), list[0])
    count[pick]++
    if (r.setter !== pick) out.push({ id: r.id, test_no: r.test_no, setter: pick })
  })
  return out
}

// Copy the previous test's setters onto this test's Pending papers (same subject). Returns [{ id, setter }] for rows that change.
export function copyPrevious(rows, testNo) {
  const prev = {}
  ;(rows || []).filter(r => r.test_no === testNo - 1).forEach(r => { prev[r.subject] = r.setter })
  return (rows || []).filter(r => r.test_no === testNo && r.status === 'Pending' && prev[r.subject] && prev[r.subject] !== r.setter).map(r => ({ id: r.id, setter: prev[r.subject], subject: r.subject }))
}
