// cbtIntegrity.js — the integrity report for a test's results: which candidates and which pairs look suspicious.
// Everything here is an INDICATOR for staff to look at, never proof — a school network, a weak signal or two bad
// luck days can each trigger a flag. Pure functions: rows come from resultRows() (attempt, g, submitted, took) and
// the test (with its answer key).
import { flagTotal } from './cbtProctorLogic.js'

export const LEVELS = { high: 6, medium: 3 }       // risk points → level

const wrongAnswers = (test, answers) => {
  const out = {}
  for (const s of test.sections) for (const q of s.questions) { const g = answers[q.no]; if (g && q.answer && g !== q.answer) out[q.no] = g }
  return out
}

// Pairs that picked the SAME WRONG option on many questions. Two good students agree on right answers; agreeing on
// the same wrong ones is what copying looks like. Needs ≥ 5 shared wrong answers and ≥ 60% of the smaller wrong-set.
export function similarPairs(test, rows, { minShared = 5, share = 0.6, max = 300 } = {}) {
  const list = rows.filter(r => r.submitted).slice(0, max).map(r => ({ r, w: wrongAnswers(test, r.attempt.answers || {}) }))
  const out = []
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]
    const na = Object.keys(a.w).length, nb = Object.keys(b.w).length
    if (Math.min(na, nb) < minShared) continue
    let same = 0
    for (const k of Object.keys(a.w)) if (b.w[k] === a.w[k]) same++
    if (same >= minShared && same / Math.min(na, nb) >= share) out.push({ a: a.r, b: b.r, same, of: Math.min(na, nb) })
  }
  return out.sort((x, y) => y.same - x.same)
}

// One entry per attempt: { row, points, level, reasons: [text] }
export function integrityReport(test, rows) {
  const submitted = rows.filter(r => r.submitted)
  const pairs = similarPairs(test, rows)
  const inPair = new Map()
  for (const p of pairs) for (const r of [p.a, p.b]) inPair.set(r.attempt.id, [...(inPair.get(r.attempt.id) || []), p])
  const ipCount = new Map()
  for (const r of submitted) if (r.attempt.ip && r.attempt.ip !== 'unknown') ipCount.set(r.attempt.ip, (ipCount.get(r.attempt.ip) || 0) + 1)
  const dur = Number(test.durationMin) || 0
  const entries = rows.map(row => {
    const a = row.attempt, reasons = []
    let points = 0
    const add = (n, t) => { points += n; reasons.push(t) }
    if ((a.switches || 0) >= 3) add(2, `left the exam screen ${a.switches} times`)
    else if ((a.switches || 0) >= 1) add(1, `left the exam screen ${a.switches}×`)
    const flags = flagTotal(a.proctor)
    if (flags >= 5) add(3, `${flags} camera / shield flags`)
    else if (flags >= 1) add(1, `${flags} camera / shield flag${flags === 1 ? '' : 's'}`)
    if ((a.takeovers || 0) >= 1) add(3, `exam taken over by another device ${a.takeovers}×`)
    if (a.ip && a.ipLast && a.ipLast !== a.ip && a.ip !== 'unknown' && a.ipLast !== 'unknown') add(1, 'network address changed during the exam')
    if (a.ip && a.ip !== 'unknown' && ipCount.get(a.ip) > 1) add(1, `same network as ${ipCount.get(a.ip) - 1} other candidate${ipCount.get(a.ip) === 2 ? '' : 's'}`)
    if (a.gcc && a.erpMatch === false) add(2, 'GCC no. does not match the name in the ERP')
    if (a.gcc && a.phoneVerified === false) add(1, 'parent number could not be verified (none on file in the ERP)')
    if (row.submitted && dur && row.took != null && row.took <= dur * 0.25 && row.g.max && row.g.marks >= row.g.max * 0.6) add(2, `finished in ${row.took} min (a quarter of the time) with ${row.g.marks}/${row.g.max}`)
    if (row.submitted && a.timing) {
      const secs = Object.values(a.timing)
      const quick = secs.filter(x => x <= 3).length, n = Object.keys(a.answers || {}).length
      if (n >= 10 && quick / n >= 0.6 && row.g.max && row.g.marks >= row.g.max * 0.6) add(2, `${quick} of ${n} answers given within 3 seconds of opening the question`)
    }
    for (const p of inPair.get(a.id) || []) {
      const other = p.a === row ? p.b : p.a
      add(3, `${p.same} of ${p.of} wrong answers identical to ${other.attempt.candidate.name}`)
    }
    return { row, points, level: points >= LEVELS.high ? 'high' : points >= LEVELS.medium ? 'medium' : 'low', reasons }
  })
  return { entries, pairs }
}
