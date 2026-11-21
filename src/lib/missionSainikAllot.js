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

// How many of a subject's tests each teacher sets. Count the current spread (everyone who sets at least one, plus the panel at 0).
export function currentCounts(rows, setters = []) {
  const m = Object.fromEntries((setters || []).map(s => [s, 0]))
  ;(rows || []).forEach(r => { if (r.setter) m[r.setter] = (m[r.setter] || 0) + 1 })
  return m
}

// Give each teacher exactly the number of tests the admin asked for. targets: { name: count }.
// Tests already submitted (status other than Pending) keep their setter and count toward that person's number, so nobody can be set below
// what they have already handed in. Pending tests that already sit with someone who still has room stay put; the rest go, in test order,
// to whoever still needs the most (ties → order of `targets`). Returns { changes: [{ id, test_no, setter }] } or { error }.
export function assignByCounts(rows, targets) {
  const names = Object.keys(targets || {})
  const sorted = [...(rows || [])].sort((a, b) => a.test_no - b.test_no)
  const want = {}
  for (const n of names) {
    const v = Number(targets[n]); if (!Number.isInteger(v) || v < 0) return { error: `The number for ${n} must be 0 or more.` }
    want[n] = v
  }
  const fixed = {}
  sorted.filter(r => r.status !== 'Pending').forEach(r => { fixed[r.setter] = (fixed[r.setter] || 0) + 1 })
  for (const n of Object.keys(fixed)) {
    if (!(n in want)) return { error: `${n} has already handed in ${fixed[n]} test(s); keep them in the list.` }
    if (want[n] < fixed[n]) return { error: `${n} has already handed in ${fixed[n]} test(s), so cannot be set below that.` }
  }
  const room = Object.fromEntries(names.map(n => [n, want[n] - (fixed[n] || 0)]))
  const pending = sorted.filter(r => r.status === 'Pending')
  const total = names.reduce((s, n) => s + want[n], 0)
  if (total !== sorted.length) return { error: `The numbers add up to ${total}, but there are ${sorted.length} tests.` }
  const loose = []
  pending.forEach(r => { if (r.setter in room && room[r.setter] > 0) room[r.setter]--; else loose.push(r) })
  const changes = []
  loose.forEach(r => {
    const pick = names.reduce((best, n) => (room[n] > room[best] ? n : best), names[0])
    room[pick]--
    if (r.setter !== pick) changes.push({ id: r.id, test_no: r.test_no, setter: pick })
  })
  return { changes }
}

// Give one teacher exactly `want` of a subject's Pre Mock tests (adding them to the subject if they are new), taking from, or giving to, the
// others so the total stays the same. Same rules as assignByCounts: submitted tests stay put, nobody drops below what they handed in.
// setters = the panel for this subject (so they appear in the counts even at 0). Returns { changes } or { error }.
export function retarget(rows, name, want, setters = []) {
  const t = currentCounts(rows, [...(setters || []), name])
  const floor = n => (rows || []).filter(r => r.setter === n && r.status !== 'Pending').length
  const w = Number(want)
  if (!Number.isInteger(w) || w < 0) return { error: 'Enter 0 or a whole number of tests.' }
  if (w < floor(name)) return { error: `${name} has already handed in ${floor(name)} test(s), so cannot be set below that.` }
  if (w > (rows || []).length) return { error: `There are only ${rows.length} tests.` }
  let need = w - t[name]
  const others = () => Object.keys(t).filter(n => n !== name)
  while (need > 0) {                                  // take from whoever has the most above what they handed in
    const donor = others().filter(n => t[n] > floor(n)).sort((a, b) => t[b] - t[a])[0]
    if (!donor) return { error: 'The other teachers have no test left to give up (they have handed them in).' }
    t[donor]--; t[name]++; need--
  }
  while (need < 0) {                                  // give back to whoever has the fewest
    const taker = others().sort((a, b) => t[a] - t[b])[0]
    if (!taker) return { error: 'Add another teacher to take the tests you are removing.' }
    t[taker]++; t[name]--; need++
  }
  return assignByCounts(rows, t)
}

// Verifier after a setter change: keep a hand-picked verifier; follow the panel rule when the old one was automatic (or empty).
export function nextVerifier(row, subjectKey, newSetter, setters) {
  const auto = pickVerifier(subjectKey, newSetter, setters)
  const wasAuto = !row.verifier || row.verifier === pickVerifier(subjectKey, row.setter, setters)
  return wasAuto ? (auto || row.verifier || null) : row.verifier
}

// Practice sets: give `want` of a subject's practice sets to one teacher by taking Pending sets that are not already theirs (lowest id first).
// Returns { changes: [{ id, setter }] } or { error }. Lowering is done by giving the set to someone else in the Allotment, so it is refused here.
export function practiceGive(rows, name, want) {
  const w = Number(want)
  if (!Number.isInteger(w) || w < 0) return { error: 'Enter 0 or a whole number of practice sets.' }
  const mine = (rows || []).filter(r => r.setter === name).length
  if (w < mine) return { error: `${name} already has ${mine} practice set(s). To give one away, change its setter on the Practice tab.` }
  const free = (rows || []).filter(r => r.status === 'Pending' && r.setter !== name).sort((a, b) => a.id - b.id)
  if (w - mine > free.length) return { error: `Only ${free.length} more practice set(s) can be given (the rest are already submitted).` }
  return { changes: free.slice(0, w - mine).map(r => ({ id: r.id, setter: name })) }
}
