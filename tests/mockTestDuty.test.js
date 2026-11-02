import test from 'node:test'
import assert from 'node:assert/strict'
import { collectDuties, removedList, mayAct, sameName, initials, assignmentsFrom, parseScope, mixScope, filterDutiesBySubjects, dutySubjects } from '../src/lib/mockTestDuty.js'

const row = (sid, batch, p1, p2, name = sid) => [1, 2].map((t, i) => ({ sid, student_name: name.toUpperCase(), gcc_no: sid.charCodeAt(0), batch, test_no: t, marks: { Maths: (i ? p2 : p1) / 4, EVS: 20 }, max_marks: { Maths: 25, EVS: 25 }, total: 0, max_total: 50 })).map((r) => ({ ...r, total: r.marks.Maths + r.marks.EVS }))
const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].flatMap((s, i) => row(s, 'X', 20 + i * 12, 22 + i * 12)).concat(row('p', 'Y', 50, 50))
const optsFor = (basis, scope) => ({ basis, ...(parseScope(scope).mix ? { mix: true, classes: parseScope(scope).classes } : { batch: parseScope(scope).batch }) })
// saved assignments: Meera on class X overall G1+G2, Rohit on the mixed set for Maths G7
const mentors = { 'overall|class:X|1': { name: 'Meera Singh', title: 'Teacher' }, 'overall|class:X|2': { name: 'Meera Singh', title: 'Teacher' }, 'Maths|mix:all|7': { name: 'Rohit Sharma', title: 'House Master' } }
const assignments = assignmentsFrom(mentors)

test('names and initials', () => {
  assert.equal(sameName(' Meera  ', 'meera'), true); assert.equal(sameName('Meera', 'Meera Singh'), false); assert.equal(sameName('Meera', ' meera '), true); assert.equal(sameName('', ''), false)
  assert.equal(initials('Meera Singh Rao'), 'MS'); assert.equal(initials(''), '?')
})
test('duties are gathered per person across every subject', () => {
  const d = collectDuties({ rows, assignments, optsFor, removedFor: () => ({}) })
  assert.deepEqual(d.map((p) => p.name), ['Meera Singh', 'Rohit Sharma'])
  const meera = d.find((p) => p.name === 'Meera Singh')
  assert.ok(meera.sections.every((s) => s.group <= 2 && s.subject === 'Overall marks'))
  assert.ok(meera.students >= 2)
  const rohit = d.find((p) => p.name === 'Rohit Sharma')
  assert.equal(rohit.sections[0].subject, 'Maths'); assert.equal(rohit.sections[0].group, 7)
  assert.ok(rohit.sections[0].students[0].score !== null)
})
test('removed students leave the duty lists (per subject)', () => {
  const base = collectDuties({ rows, assignments, optsFor, removedFor: () => ({}) })
  const all = base.find((p) => p.name === 'Meera Singh').sections.flatMap((s) => s.students.map((x) => x.sid))
  const victim = all[0]
  const d = collectDuties({ rows, assignments, optsFor, removedFor: (b) => (b === '' ? { [victim]: {} } : {}) })
  const left = d.find((p) => p.name === 'Meera Singh').sections.flatMap((s) => s.students.map((x) => x.sid))
  assert.ok(!left.includes(victim))
})
test('a manually built group appears under its duty person with the chosen students', () => {
  const custom = [{ id: 'cg-1', name: 'Maths booster', basis: 'Maths', dutyName: 'Meera Singh', dutyTitle: 'Teacher', students: ['a', 'p', 'zzz'], note: 'Tue 5pm' }]
  const d = collectDuties({ rows, assignments: [], optsFor, removedFor: () => ({}), custom })
  const sec = d.find((p) => p.name === 'Meera Singh').sections.find((s) => s.kind === 'custom')
  assert.equal(sec.label, 'Maths booster'); assert.equal(sec.note, 'Tue 5pm')
  assert.deepEqual(sec.students.map((s) => s.sid).sort(), ['a', 'p'])     // unknown student key ignored
  assert.equal(collectDuties({ rows, assignments: [], optsFor, removedFor: () => ({}), custom: [{ ...custom[0], dutyName: '' }] }).some((p) => p.sections.some((s) => s.kind === 'custom')), false)
})
test('removed list and who may act', () => {
  const l = removedList({ overall: { a: { reason: 'Left', by: 'Meera', at: '2026-11-02' } }, Maths: { p: { reason: '' } } }, rows)
  assert.deepEqual(l.map((x) => [x.name, x.basis, x.reason]), [['A', '', 'Left'], ['P', 'Maths', '']])
  assert.equal(mayAct({ canEdit: true, userName: 'x', dutyName: 'y' }), true)
  assert.equal(mayAct({ canEdit: false, userName: 'Meera Singh', dutyName: 'meera singh' }), true)
  assert.equal(mayAct({ canEdit: false, userName: 'Meera Singh', dutyName: 'Rohit Sharma' }), false)
  assert.equal(mayAct({ canEdit: false, userName: '', dutyName: '' }), false)
})

test('a teacher is also recognised by their Staff Record id when the login name differs', () => {
  assert.equal(mayAct({ canEdit: false, userName: 'meera.s', dutyName: 'Meera Singh', userStaffId: 20, dutyStaffId: '20' }), true)
  assert.equal(mayAct({ canEdit: false, userName: 'meera.s', dutyName: 'Meera Singh', userStaffId: 20, dutyStaffId: 21 }), false)
  assert.equal(mayAct({ canEdit: false, userName: 'x', dutyName: 'y', userStaffId: null, dutyStaffId: null }), false)
})

test('every duty section carries the instruction of its assignment (where / why / when / what)', () => {
  const inst = { venue: 'Room 4', reason: 'Maths revision', days: ['Tue'], from: '17:00', to: '18:00', instruction: 'Take attendance' }
  const d = collectDuties({ rows, assignments: assignmentsFrom({ 'overall|class:X|1': { name: 'Meera Singh', title: 'Teacher', ...inst } }), optsFor, removedFor: () => ({}) })
  assert.deepEqual(d[0].sections[0].instruction, inst)
  const custom = [{ id: 'c1', name: 'Booster', basis: '', dutyName: 'Meera Singh', students: ['a'], venue: 'Hall', days: 'Mon,Wed', time_from: '16:00', time_to: '17:00' }, { id: 'c2', name: 'Old', basis: '', dutyName: 'Meera Singh', students: ['b'], note: 'Tue 5pm, Room 4' }]
  const dd = collectDuties({ rows, assignments: [], optsFor, removedFor: () => ({}), custom })
  const secs = dd[0].sections
  assert.deepEqual([secs[0].instruction.venue, secs[0].instruction.days, secs[0].instruction.from], ['Hall', ['Mon', 'Wed'], '16:00'])
  assert.equal(secs[1].instruction.instruction, 'Tue 5pm, Room 4')     // an older free-text note becomes the instruction
})

test('scopes round-trip, and the saved assignments are read back as a list', () => {
  assert.deepEqual(parseScope('class:Lakshya A'), { mix: false, batch: 'Lakshya A', language: '', classes: [] })
  assert.deepEqual(parseScope('mix:all'), { mix: true, batch: '', language: '', classes: [] })
  assert.deepEqual(parseScope('mix:English'), { mix: true, batch: '', language: 'English', classes: [] })
  assert.deepEqual(parseScope(mixScope('Meitei Mayek', ['Umeed', 'Lakshya A'])), { mix: true, batch: '', language: 'Meitei Mayek', classes: ['Lakshya A', 'Umeed'] })
  assert.equal(mixScope('', []), 'mix:all')
  const a = assignmentsFrom({ 'overall|class:X|3': { name: 'A' }, 'Maths|mix:all|7': { name: 'B' }, 'bad|key': { name: 'C' }, 'overall|class:X|1': {} })
  assert.deepEqual(a.map((x) => [x.basis, x.scope, x.grp, x.mentor.name]), [['', 'class:X', 3, 'A'], ['Maths', 'mix:all', 7, 'B']])
})
test('duties do not depend on which layout or filter is on screen: class-wise and mixed assignments both appear', () => {
  const d = collectDuties({ rows, assignments, optsFor, removedFor: () => ({}) })
  assert.deepEqual(d.map((p) => p.name), ['Meera Singh', 'Rohit Sharma'])
  assert.ok(d.find((p) => p.name === 'Rohit Sharma').sections[0].mixed)
  assert.match(d.find((p) => p.name === 'Rohit Sharma').sections[0].label, /^Mixed classes · all languages · Group 7/)
  assert.equal(d.find((p) => p.name === 'Meera Singh').sections[0].scope, 'class:X')
})
test('a mixed assignment keeps the classes it was made for', () => {
  const a = assignmentsFrom({ 'overall|mix:all:Y|1': { name: 'Zed', title: 'Teacher' } })
  const d = collectDuties({ rows, assignments: a, optsFor, removedFor: () => ({}) })
  const sec = d[0].sections[0]
  assert.ok(sec.students.every((s) => s.class === 'Y')); assert.match(sec.label, /\(Y\)/)
})

test('choosing subjects keeps only those duties and recounts each person', () => {
  const st = (sid) => ({ sid })
  const duties = [
    { name: 'Meera', sections: [{ subject: 'Overall marks', students: [st('a'), st('b')] }, { subject: 'Mathematics', students: [st('b'), st('c')] }], groups: 2, students: 3 },
    { name: 'Rohit', sections: [{ subject: 'EVS', students: [st('d')] }], groups: 1, students: 1 },
  ]
  assert.deepEqual(dutySubjects(duties), ['Overall marks', 'EVS', 'Mathematics'])
  assert.equal(filterDutiesBySubjects(duties, []), duties)                          // nothing chosen = everything
  const m = filterDutiesBySubjects(duties, ['Mathematics'])
  assert.deepEqual(m.map((p) => [p.name, p.groups, p.students]), [['Meera', 1, 2]])  // Rohit has no Mathematics duty
  const both = filterDutiesBySubjects(duties, ['Overall marks', 'EVS'])
  assert.deepEqual(both.map((p) => [p.name, p.groups, p.students]), [['Meera', 1, 2], ['Rohit', 1, 1]])
  assert.deepEqual(filterDutiesBySubjects(duties, ['Passage']), [])
  assert.equal(duties[0].groups, 2)                                                   // the original is not changed
})
