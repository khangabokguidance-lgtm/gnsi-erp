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
