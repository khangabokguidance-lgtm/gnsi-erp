import test from 'node:test'
import assert from 'node:assert/strict'
import { recordsFrom, applyReportFilter, emptyReportFilter, buildReport, smartInsights, sortRecords, trendLabel, QUICK_REPORTS, NOT_ASSIGNED } from '../src/lib/mockTestReport.js'
import { classGroups } from '../src/lib/mockTestGroups.js'

// 3 tests per student: tN rows; students a..l in class X (weak..strong), a few in class Y
const mk = (sid, batch, scores, evsAdj = 0) => scores.map((p, i) => ({ sid, student_name: sid.toUpperCase(), gcc_no: sid.charCodeAt(0), batch, test_no: i + 1, marks: { Maths: p / 4, EVS: Math.max(0, p / 4 - evsAdj) }, max_marks: { Maths: 25, EVS: 25 }, total: p / 2 - evsAdj / 2, max_total: 50 }))
const rows = [
  ...mk('a', 'X', [20, 18, 16]),            // declining, weak
  ...mk('b', 'X', [30, 34, 38]),            // improving
  ...mk('c', 'X', [50, 50, 50], 10),        // steady, EVS weaker
  ...mk('d', 'X', [60, 62, 64]),
  ...mk('e', 'X', [75, 76, 77]),
  ...mk('f', 'X', [85, 88, 91]),
  ...mk('g', 'X', [95, 96, 97]),
  ...mk('p', 'Y', [40, 40, 40]),
]
const ctxFor = (extra = {}) => ({
  hmOf: (g) => (g === 'a'.charCodeAt(0) ? { house: 'Shivaji', label: 'Rohit Sharma' } : { house: 'Ashoka', label: 'Anita Devi' }),
  mentorOf: (c, g) => (g.no === 1 ? { name: 'Mentor One' } : null),
  autoGroupOf: () => 2, basis: '', passPct: 40, ...extra,
})
const classes = classGroups(rows, {})
const recs = recordsFrom(classes, ctxFor())

test('one record per student, with trend, house, HM and assigned mentor', () => {
  assert.equal(recs.length, 8)
  const a = recs.find((r) => r.name === 'A')
  assert.equal(a.trendText, 'Declining'); assert.equal(a.house, 'Shivaji'); assert.equal(a.hm, 'Rohit Sharma'); assert.equal(a.below, true)
  assert.equal(recs.find((r) => r.name === 'B').trendText, 'Improving')
  assert.equal(recs.find((r) => r.name === 'C').trendText, 'Steady')
  assert.equal(trendLabel(null), '')
})
test('filters: group range, class, house, trend, score, below pass, search, mentor', () => {
  const f = (o) => applyReportFilter(recs, { ...emptyReportFilter(), ...o }).map((r) => r.name).sort().join('')
  assert.equal(f({}), 'ABCDEFGP')
  assert.equal(f({ classes: ['Y'] }), 'P')
  assert.equal(f({ house: 'Shivaji' }), 'A')
  assert.equal(f({ trend: 'Declining' }), 'A')
  assert.equal(f({ trend: 'Improving' }).includes('B'), true)
  assert.equal(f({ scoreMin: 85 }), 'FG')
  assert.equal(f({ scoreMax: 25 }), 'A')
  assert.equal(f({ belowPass: true }).includes('A'), true)
  assert.equal(f({ q: 'd' }), 'D')
  assert.ok(f({ groupFrom: 7, groupTo: 7 }).length >= 1 && !f({ groupFrom: 7, groupTo: 7 }).includes('A'))
  assert.equal(f({ weakest: 'EVS' }).includes('C'), true)
  const withMentor = applyReportFilter(recs, { ...emptyReportFilter(), mentor: 'Mentor One' })
  assert.ok(withMentor.length && withMentor.every((r) => r.mentor === 'Mentor One'))
  const none = applyReportFilter(recs, { ...emptyReportFilter(), mentor: NOT_ASSIGNED })
  assert.ok(none.length && none.every((r) => !r.mentor))
  assert.equal(none.length + withMentor.length, 8)
})
test('sorting', () => {
  assert.equal(sortRecords(recs, 'scoreAsc')[0].name, 'A')
  assert.equal(sortRecords(recs, 'scoreDesc')[0].name, 'G')
  assert.equal(sortRecords(recs, 'trendAsc')[0].name, 'A')
  assert.equal(sortRecords(recs, 'trendDesc')[0].name, 'B')
})
test('the six report types', () => {
  const ctx = {}
  const roster = buildReport('roster', recs, ctx)
  assert.equal(roster.rows.length, 8); assert.ok(roster.columns.some((c) => c.label === 'House Master / Mistress'))
  assert.equal(roster.rows[0]['Assigned mentor'] !== undefined, true)
  const cards = buildReport('cards', recs, ctx)
  assert.deepEqual(cards.subjects.sort(), ['EVS', 'Maths']); assert.ok(cards.rows.find((r) => r.Name === 'C')['Study focus'].startsWith('EVS'))
  const sum = buildReport('summary', recs, ctx)
  assert.ok(sum.rows.length >= 2); assert.equal(sum.rows.reduce((t, r) => t + r.Students, 0), 8)
  const sub = buildReport('subjects', recs, ctx)
  assert.ok(sub.columns.some((c) => c.key === 'Maths')); assert.ok(sub.heat.includes('EVS'))
  const men = buildReport('mentors', recs, ctx)
  assert.ok(men.rows.some((r) => r.Person === 'Mentor One') && men.rows.some((r) => r.Person === 'Not assigned'))
  assert.equal(men.rows.reduce((t, r) => t + r['Students in those groups'], 0), 8)
  const moved = buildReport('moves', recordsFrom(classGroups(rows, { overrides: { a: 7 } }), ctxFor()), ctx)
  assert.deepEqual(moved.rows.map((r) => [r.Name, r.From, r.To.startsWith('Group 7')]), [['A', 'Group 2', true]])
})
test('smart insights say what matters', () => {
  const t = smartInsights(recs, { passPct: 40 }).join(' | ')
  assert.match(t, /8 students/); assert.match(t, /below the 40% pass mark/); assert.match(t, /Weakest subject overall: EVS/)
  assert.match(t, /Groups 1–2/); assert.match(t, /1 declining: A/); assert.match(t, /no House Master/)
  assert.deepEqual(smartInsights([]), ['No students match the filters.'])
})
test('quick reports set a type and filters that exist', () => {
  const ids = QUICK_REPORTS.map((q) => q.id)
  assert.ok(ids.includes('support') && ids.includes('declining'))
  QUICK_REPORTS.forEach((q) => { assert.ok(['roster', 'cards', 'summary', 'subjects', 'mentors', 'moves'].includes(q.type)); Object.keys(q.filter).forEach((k) => assert.ok(k in emptyReportFilter())) })
})
