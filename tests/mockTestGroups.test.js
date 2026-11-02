import test from 'node:test'
import assert from 'node:assert/strict'
import { languageOfBatch, studentAverages, selfStudyGroups, classGroups } from '../src/lib/mockTestGroups.js'

const row = (sid, batch, test_no, ma, evs, name = sid) => ({ sid, student_name: name, gcc_no: sid, batch, test_no, marks: { Maths: ma, EVS: evs }, max_marks: { Maths: 25, EVS: 25 }, total: ma + evs, max_total: 50 })
// 14 students in one class, averages 7%..98% (two marks each)
const cls = (batch, n = 14) => Array.from({ length: n }, (_, i) => row(`s${i}`, batch, 1, i * 1.75, i * 1.75 + 0.0))

test('language comes from the class name', () => {
  assert.equal(languageOfBatch('Combined English'), 'English')
  assert.equal(languageOfBatch('Combined Manipuri'), 'Meitei Mayek')
  assert.equal(languageOfBatch('Combined MM'), 'Meitei Mayek')
  assert.equal(languageOfBatch('Lakshya A'), '')
})
test('a student is averaged over tests; weakest subject is found', () => {
  const [s] = studentAverages([row('a', 'X', 1, 10, 20), row('a', 'X', 2, 20, 20)])
  assert.equal(s.tests, 2)
  assert.equal(Math.round(s.avg), 70)         // (30/50 + 40/50) / 2
  assert.equal(s.weakest, 'Maths')
  assert.equal(s.strongest, 'EVS')
})
test('equal split: 7 groups of 2, weakest first', () => {
  const g = selfStudyGroups(studentAverages(cls('X')))
  assert.deepEqual(g.map((x) => x.n), [2, 2, 2, 2, 2, 2, 2])
  assert.equal(g[0].tag, 'Weakest'); assert.equal(g[6].tag, 'Strongest')
  assert.ok(g[0].avg < g[3].avg && g[3].avg < g[6].avg)
  assert.ok(g[0].max <= g[1].min)             // no overlap between neighbouring groups
})
test('equal split: uneven sizes differ by at most one; every student placed once', () => {
  const g = selfStudyGroups(studentAverages(cls('X', 45)))
  const sizes = g.map((x) => x.n)
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1)
  assert.equal(sizes.reduce((a, b) => a + b, 0), 45)
})
test('bands split uses fixed % limits', () => {
  const mk = (id, pct) => ({ sid: id, name: id, avg: pct, subj: {}, batch: 'X' })
  const g = selfStudyGroups([mk('a', 10), mk('b', 30), mk('c', 45), mk('d', 59.9), mk('e', 60), mk('f', 79), mk('g', 95)], { mode: 'bands' })
  assert.deepEqual(g.map((x) => x.students.map((s) => s.name).join('')), ['a', 'b', 'c', 'd', 'e', 'f', 'g'])
})
test('a tiny class still puts its strongest student in a high group, not the middle', () => {
  const g = selfStudyGroups(studentAverages(cls('X', 3)))
  assert.equal(g.filter((x) => x.n).length, 3)
  assert.ok(g[5].n + g[6].n + g[4].n >= 1)
})
test('classGroups: one entry per class, language filter keeps only that medium', () => {
  const rows = [...cls('Combined English', 10), ...cls('Combined Manipuri', 8).map((r) => ({ ...r, sid: 'm' + r.sid })), ...cls('Lakshya A', 7).map((r) => ({ ...r, sid: 'l' + r.sid }))]
  assert.deepEqual(classGroups(rows).map((c) => [c.batch, c.count]), [['Combined English', 10], ['Combined Manipuri', 8], ['Lakshya A', 7]])
  assert.deepEqual(classGroups(rows, { language: 'English' }).map((c) => c.batch), ['Combined English'])
  assert.deepEqual(classGroups(rows, { language: 'Meitei Mayek' }).map((c) => c.batch), ['Combined Manipuri'])
  assert.deepEqual(classGroups(rows, { batch: 'Lakshya A' }).map((c) => c.batch), ['Lakshya A'])
  assert.equal(classGroups(rows)[0].groups.length, 7)
})
test('a group names the subject its members are weakest in', () => {
  const rows = [row('a', 'X', 1, 5, 20), row('b', 'X', 1, 6, 22), row('c', 'X', 1, 20, 4), row('d', 'X', 1, 22, 5)]
  const g = selfStudyGroups(studentAverages(rows))
  const withStudents = g.filter((x) => x.n)
  assert.ok(withStudents.every((x) => x.focus === 'Maths' || x.focus === 'EVS'))
  // weakest overall is 'c' (80% Maths, 16% EVS) -> EVS; next is 'a' (20% Maths, 80% EVS) -> Maths
  assert.deepEqual(withStudents.slice(0, 2).map((x) => x.focus), ['EVS', 'Maths'])
})

import { subjectsOf } from '../src/lib/mockTestGroups.js'
// a (strong Maths, weak EVS) .. d (weak Maths, strong EVS) — overall averages are equal-ish
const sub = [row('a', 'X', 1, 25, 5), row('b', 'X', 1, 20, 10), row('c', 'X', 1, 10, 20), row('d', 'X', 1, 5, 25)]

test('subject-wise groups order students by that subject only', () => {
  const m = selfStudyGroups(studentAverages(sub), { basis: 'Maths' })
  const e = selfStudyGroups(studentAverages(sub), { basis: 'EVS' })
  const names = (g) => g.filter((x) => x.n).map((x) => x.students.map((s) => s.name).join())
  assert.deepEqual(names(m), ['d', 'c', 'b', 'a'])   // weakest Maths first
  assert.deepEqual(names(e), ['a', 'b', 'c', 'd'])   // weakest EVS first
  assert.equal(m.find((g) => g.n).focus, 'Maths')
  assert.deepEqual(subjectsOf(sub), ['Maths', 'EVS'])
})
test('a student with no marks in the chosen subject is left out of that subject’s groups', () => {
  const rows = [row('a', 'X', 1, 25, 5), { ...row('b', 'X', 1, 20, 10), marks: { EVS: 10 }, max_marks: { EVS: 25 } }]
  const g = selfStudyGroups(studentAverages(rows), { basis: 'Maths' })
  assert.equal(g.reduce((t, x) => t + x.n, 0), 1)
})
test('manual choice moves a student to the chosen group, per basis, and is flagged', () => {
  const st = studentAverages(sub)
  const g = selfStudyGroups(st, { basis: 'Maths', overrides: { a: 1 } })   // best in Maths forced into the weakest group
  assert.ok(g[0].students.some((s) => s.name === 'a' && s.manual))
  assert.equal(g[0].manualCount, 1)
  assert.equal(g.reduce((t, x) => t + x.n, 0), 4)                 // nobody lost or duplicated
  const other = selfStudyGroups(st, { basis: 'EVS', overrides: { a: 1 } })  // override applies by sid for any basis it is passed to
  assert.ok(other[0].students.some((s) => s.name === 'a'))
  const none = selfStudyGroups(st, { basis: 'Maths', overrides: { a: 99, b: 'x' } })   // invalid choices are ignored
  assert.equal(none.reduce((t, x) => t + x.manualCount, 0), 0)
})
test('mixed classes: one set of 7 groups across the classes, students keep their class', () => {
  const rows = [...cls('Combined English', 7), ...cls('Combined Manipuri', 7).map((r) => ({ ...r, sid: 'm' + r.sid }))]
  const [m] = classGroups(rows, { mix: true })
  assert.equal(m.mixed, true)
  assert.deepEqual(m.classes, ['Combined English', 'Combined Manipuri'])
  assert.equal(m.count, 14)
  assert.deepEqual(m.groups.map((g) => g.n), [2, 2, 2, 2, 2, 2, 2])
  assert.ok(m.groups.some((g) => new Set(g.students.map((s) => s.batch)).size === 2))   // a group holds both classes
  assert.deepEqual(classGroups(rows, { mix: true, classes: ['Combined English'] })[0].count, 7)
  assert.deepEqual(classGroups(rows, { mix: true, language: 'Meitei Mayek' })[0].classes, ['Combined Manipuri'])
  assert.deepEqual(classGroups(rows, { mix: true, classes: ['Nope'] }), [])
})

test('top group: Group 7 is exactly the best N, the rest spread over Groups 1-6', () => {
  const st = studentAverages(cls('X', 20))
  const g = selfStudyGroups(st, { topN: 5 })
  assert.equal(g[6].n, 5)
  assert.deepEqual(g[6].students.map((s) => s.name).sort(), ['s15', 's16', 's17', 's18', 's19'])
  assert.equal(g.slice(0, 6).reduce((t, x) => t + x.n, 0), 15)
  const sizes = g.slice(0, 6).map((x) => x.n)
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1)
})
test('top group: N larger than the class takes everyone; 0 means automatic; bands never reach Group 7 below the top', () => {
  const st = studentAverages(cls('X', 6))
  assert.equal(selfStudyGroups(st, { topN: 50 })[6].n, 6)
  assert.deepEqual(selfStudyGroups(st, { topN: 0 }).map((x) => x.n), selfStudyGroups(st).map((x) => x.n))
  const b = selfStudyGroups(studentAverages(cls('X', 14)), { topN: 3, mode: 'bands' })
  assert.equal(b[6].n, 3)
  assert.equal(b.reduce((t, x) => t + x.n, 0), 14)
})
test('top group across all classes of a language, mixed', () => {
  const rows = [...cls('Combined English', 10), ...cls('Combined English', 10).map((r) => ({ ...r, sid: 'e' + r.sid, batch: 'Lakshya A' })), ...cls('Combined Manipuri', 10).map((r) => ({ ...r, sid: 'm' + r.sid }))]
  const [m] = classGroups(rows, { mix: true, language: 'English', topN: 4 })
  assert.deepEqual(m.classes, ['Combined English'])
  assert.equal(m.groups[6].n, 4)
  assert.equal(classGroups(rows, { mix: true, topN: 6 })[0].groups[6].n, 6)
})
test('a manual choice still wins over the top group', () => {
  const g = selfStudyGroups(studentAverages(cls('X', 10)), { topN: 3, overrides: { s0: 7 } })
  assert.ok(g[6].students.some((s) => s.name === 's0' && s.manual))
  assert.equal(g.reduce((t, x) => t + x.n, 0), 10)
})

test('an admin-set class language wins over the class name, and puts the class in that language group', () => {
  assert.equal(languageOfBatch('Lakshya A'), '')
  assert.equal(languageOfBatch('Lakshya A', { 'Lakshya A': 'English' }), 'English')
  assert.equal(languageOfBatch('Combined Manipuri', { 'Combined Manipuri': 'English' }), 'English')   // setting wins over the name
  assert.equal(languageOfBatch('Lakshya A', { 'Lakshya A': 'Klingon' }), '')                          // only the two real languages count
  const rows = [...cls('Combined English', 8), ...cls('Lakshya A', 6).map((r) => ({ ...r, sid: 'l' + r.sid })), ...cls('Combined Manipuri', 5).map((r) => ({ ...r, sid: 'm' + r.sid }))]
  assert.deepEqual(classGroups(rows, { language: 'English' }).map((c) => c.batch), ['Combined English'])
  const languages = { 'Lakshya A': 'English' }
  assert.deepEqual(classGroups(rows, { language: 'English', languages }).map((c) => c.batch), ['Combined English', 'Lakshya A'])
  const [mix] = classGroups(rows, { language: 'English', languages, mix: true, topN: 4 })
  assert.deepEqual(mix.classes, ['Combined English', 'Lakshya A'])
  assert.equal(mix.count, 14)
  assert.equal(mix.groups[6].n, 4)
  assert.equal(classGroups(rows, { languages })[2].language, 'English')   // Lakshya A (sorted third)
})
