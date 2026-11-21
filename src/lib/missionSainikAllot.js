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

// Practice sets: make a teacher set exactly `want` practice sets of one subject (Set 1, Set 2 … up to the subject's number of sets).
// A practice task is one row per teacher per set, so this CREATES the missing sets for the teacher instead of taking them from others
// (the database allows one row per teacher, test_no and subject; the set number is stored in test_no, 0 = a legacy row whose set is its order).
// rows: the subject's practice rows. opts.sets = how many sets the subject has; opts.setNoOf(row) = the set a row stands for.
// Sets nobody else covers yet are chosen first. Returns { create: [{ test_no }] } or { error }.
export function practiceGive(rows, name, want, opts = {}) {
  const w = Number(want)
  if (!Number.isInteger(w) || w < 0) return { error: 'Enter 0 or a whole number of practice sets.' }
  const sets = Number(opts.sets) > 0 ? Number(opts.sets) : 1
  const setNoOf = opts.setNoOf || (r => (r.test_no > 0 ? r.test_no : 1))
  const mine = (rows || []).filter(r => r.setter === name)
  if (w < mine.length) return { error: `${name} already has ${mine.length} practice set(s). To give one away, change its setter on the Practice tab.` }
  if (w > sets) return { error: `This subject has only ${sets} practice set${sets === 1 ? '' : 's'}, so a teacher can set at most ${sets}.` }
  const have = new Set(mine.map(setNoOf))
  const cover = {}
  ;(rows || []).filter(r => r.setter !== name).forEach(r => { const k = setNoOf(r); cover[k] = (cover[k] || 0) + 1 })
  const free = Array.from({ length: sets }, (_, i) => i + 1).filter(k => !have.has(k)).sort((a, b) => (cover[a] || 0) - (cover[b] || 0) || a - b)
  return { create: free.slice(0, w - mine.length).map(test_no => ({ test_no })) }
}

// ── Several setters on one paper ──────────────────────────────────────────────────────────────────────
// `setter` is the main setter; `co_setters` holds the others, separated by ";". Everyone listed sets the paper and sees it in their tasks.
export const coSettersOf = row => String(row?.co_setters || '').split(';').map(s => s.trim()).filter(Boolean)
export const settersOfRow = row => [...new Set([row?.setter, ...coSettersOf(row)].filter(Boolean))]
export const joinCoSetters = list => [...new Set((list || []).map(s => String(s).trim()).filter(Boolean))].join('; ')
// Add or remove one co-setter. The main setter is never listed as a co-setter. Returns the new co_setters string ('' when none).
export function toggleCoSetter(row, name, on) {
  const cur = coSettersOf(row).filter(n => n !== name)
  if (on && name && name !== row?.setter) cur.push(name)
  return joinCoSetters(cur)
}
// "Sir A, Sir B" label from a naming function.
export const settersLabel = (row, nameFn = x => x) => settersOfRow(row).map(nameFn).join(' + ')

// ── Practice sets planner ─────────────────────────────────────────────────────────────────────────────
// Groups a subject's practice rows by the set they stand for: [{ no: 1, rows: [...] }, { no: 2, rows: [] }, ...] for no = 1..sets.
// setNoOf(row) gives the set of a row (rows added from the Panel carry it in test_no; older rows count by order).
export function groupBySet(rows, sets, setNoOf) {
  const n = Math.max(1, Number(sets) || 1)
  const out = Array.from({ length: n }, (_, i) => ({ no: i + 1, rows: [] }))
  ;(rows || []).forEach(r => { const k = Math.min(Math.max(setNoOf(r) || 1, 1), n); out[k - 1].rows.push(r) })
  return out
}

// Teachers who may still be added to a set: panel members and staff who are not already setting it.
export function addableTeachers(candidates, rowsInSet) {
  const have = new Set((rowsInSet || []).map(r => r.setter))
  return [...new Set((candidates || []).filter(Boolean))].filter(n => !have.has(n)).sort((a, b) => a.localeCompare(b))
}
