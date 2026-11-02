import test from 'node:test'
import assert from 'node:assert/strict'
import { recordsFrom, applyReportFilter, emptyReportFilter, buildReport, smartInsights, sortRecords, trendLabel, QUICK_REPORTS, NOT_ASSIGNED, dutyRows } from '../src/lib/mockTestReport.js'
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
  mentorOf: (c, g) => (g.no === 1 ? { name: 'Mentor One', title: 'Teacher' } : g.no === 2 ? { name: 'Rohit Sharma', title: 'House Master' } : null),
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
  const other = applyReportFilter(recs, { ...emptyReportFilter(), mentor: 'Rohit Sharma' })
  assert.equal(none.length + withMentor.length + other.length, 8)
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
  assert.equal(roster.rows[0]['On duty (subject)'] !== undefined, true)
  const cards = buildReport('cards', recs, ctx)
  assert.deepEqual(cards.subjects.sort(), ['EVS', 'Maths']); assert.ok(cards.rows.find((r) => r.Name === 'C')['Study focus'].startsWith('EVS'))
  const sum = buildReport('summary', recs, ctx)
  assert.ok(sum.rows.length >= 2); assert.equal(sum.rows.reduce((t, r) => t + r.Students, 0), 8)
  const sub = buildReport('subjects', recs, ctx)
  assert.ok(sub.columns.some((c) => c.key === 'Maths')); assert.ok(sub.heat.includes('EVS'))
  const men = buildReport('mentors', recs, ctx)
  assert.ok(men.rows.some((r) => r.Person === 'Mentor One (Teacher)') && men.rows.some((r) => r.Person === 'Nobody on duty'))
  assert.equal(men.rows.reduce((t, r) => t + r['Students in those groups'], 0), 8)
  const moved = buildReport('moves', recordsFrom(classGroups(rows, { overrides: { a: 7 } }), ctxFor()), ctx)
  assert.deepEqual(moved.rows.map((r) => [r.Name, r.From, r.To.startsWith('Group 7')]), [['A', 'Group 2', true]])
})
test('smart insights say what matters', () => {
  const t = smartInsights(recs, { passPct: 40 }).join(' | ')
  assert.match(t, /8 students/); assert.match(t, /below the 40% pass mark/); assert.match(t, /Weakest subject overall: EVS/)
  assert.match(t, /Groups 1–2/); assert.match(t, /1 declining: A/); assert.match(t, /nobody assigned for duty/)
  assert.deepEqual(smartInsights([]), ['No students match the filters.'])
})
test('quick reports set a type and filters that exist', () => {
  const ids = QUICK_REPORTS.map((q) => q.id)
  assert.ok(ids.includes('support') && ids.includes('declining'))
  QUICK_REPORTS.forEach((q) => { assert.ok(['roster', 'cards', 'summary', 'subjects', 'mentors', 'moves'].includes(q.type)); Object.keys(q.filter).forEach((k) => assert.ok(k in emptyReportFilter())) })
})

test('duty roster names the person and title; house counts only for House Masters', () => {
  const men = buildReport('mentors', recs, {})
  assert.ok(men.rows.some((r) => r.Person === 'Mentor One (Teacher)' && r['Students from their house'] === '—'))
  assert.ok(men.rows.some((r) => r.Person === 'Rohit Sharma (House Master)' && typeof r['Students from their house'] === 'number'))
  assert.equal(men.title, 'Duty roster')
})

test('the duty roster says where, when and why for each group', () => {
  const inst = { venue: 'Room 4', reason: 'Maths revision', days: ['Tue'], from: '17:00', to: '18:00' }
  const ctx2 = ctxFor({ mentorOf: (c, g) => (g.no === 1 ? { name: 'Mentor One', title: 'Teacher', ...inst } : null) })
  const men = buildReport('mentors', recordsFrom(classes, ctx2), {})
  const row = men.rows.find((r) => r.Person.startsWith('Mentor One'))
  assert.match(row['Where / when / why'], /Where: Room 4 · When: Tue · 5:00 pm–6:00 pm · Why: Maths revision/)
  assert.equal(men.rows.find((r) => r.Person === 'Nobody on duty')['Where / when / why'], '—')
  assert.ok(men.columns.some((c) => c.key === 'Where / when / why'))
})

// duties as collectDuties returns them: Meera on Overall G1 + Mathematics G2, Rohit on EVS G7
const sec = (subject, group, label, n, scores, inst = {}) => ({ kind: 'group', subject, basis: subject === 'Overall marks' ? '' : subject, group, label, set: 'Combined English', mixed: false, students: scores.map((score, i) => ({ sid: `${label}${i}`, score })).slice(0, n), instruction: inst })
const duties = [
  { name: 'Meera Singh', title: 'Senior Teacher', groups: 2, students: 4, sections: [
    sec('Overall marks', 1, 'Combined English · Group 1', 2, [30, 50], { venue: 'Room 4', days: ['Tue'], from: '17:00', to: '18:00', reason: 'Revision' }),
    sec('Mathematics', 2, 'Combined English · Group 2', 2, [45, 65]) ] },
  { name: 'Rohit Sharma', title: 'House Master', groups: 1, students: 1, sections: [sec('EVS', 7, 'Combined English · Group 7', 1, [90])] },
]
test('duty roster names the SUBJECT each person supervises, across every subject', () => {
  const r = buildReport('mentors', [], { duties, passPct: 40 })
  assert.ok(r.dutyView); assert.equal(r.groupBy, 'Person on duty')
  assert.ok(r.columns.some((c) => c.key === 'Supervises study duty for'))
  assert.deepEqual(r.rows.map((x) => [x['Person on duty'], x['Supervises study duty for']]), [['Meera Singh (Senior Teacher)', 'Overall marks'], ['Meera Singh (Senior Teacher)', 'Mathematics'], ['Rohit Sharma (House Master)', 'EVS']])
  assert.deepEqual([r.rows[0].Where, r.rows[0]['Days & time'], r.rows[0].Why, r.rows[0]['Below pass']], ['Room 4', 'Tue · 5:00 pm–6:00 pm', 'Revision', 1])
  assert.equal(r.rows[1].Where, '—')
})
test('duty roster filters: person, supervised subject, group range', () => {
  const f = (o) => dutyRows(duties, { ...emptyReportFilter(), ...o }).map((x) => `${x.person}:${x.subject}`)
  assert.deepEqual(f({ dutySubject: 'EVS' }), ['Rohit Sharma:EVS'])
  assert.deepEqual(f({ mentor: 'Meera Singh' }), ['Meera Singh:Overall marks', 'Meera Singh:Mathematics'])
  assert.deepEqual(f({ groupFrom: 7, groupTo: 7 }), ['Rohit Sharma:EVS'])
  assert.deepEqual(f({ dutySubject: 'Passage' }), [])
})
test('other reports name the subject next to the person on duty', () => {
  const rr = recordsFrom(classes, ctxFor({ basis: '' }))
  assert.ok(buildReport('roster', rr, { basis: '' }).rows.some((x) => x['On duty (subject)'] === 'Mentor One — Overall marks'))
  const rm = recordsFrom(classes, ctxFor({ basis: 'Maths' }))
  assert.ok(buildReport('summary', rm, { basis: 'Maths' }).rows.some((x) => x['On duty (subject)'] === 'Mentor One — Maths'))
  assert.equal(buildReport('mentors', rr, { basis: 'Maths' }).rows.find((x) => x.Person.startsWith('Mentor One'))['Supervises (subject)'], 'Maths')
})
test('insights say who supervises what and which subjects have nobody', () => {
  const t = smartInsights(recs, { passPct: 40, duties, allSubjects: ['Mathematics', 'EVS', 'Passage'] }).join(' | ')
  assert.match(t, /2 people supervise study duty across 3 subjects: Overall marks \(Meera Singh\); EVS \(Rohit Sharma\); Mathematics \(Meera Singh\)/)
  assert.match(t, /Nobody is assigned to supervise: Passage\./)
})
