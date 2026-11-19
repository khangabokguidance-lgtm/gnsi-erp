import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCalc, gradeOf, parseMark, cellState, subjSig } from '../src/houseMarksCalc.js'

const J = [{ n: 'Mental Ability', max: 50, min: '' }, { n: 'Arithmetic', max: 25, min: 7 }, { n: 'Language', max: 25, min: '' }]

test('parseMark: numbers, blanks, absent and invalid text', () => {
  assert.equal(parseMark('42'), 42)
  assert.equal(parseMark(' 12.5 '), 12.5)
  assert.equal(parseMark(''), null)
  assert.equal(parseMark(null), null)
  assert.equal(parseMark('-'), null)
  for (const a of ['ab', 'AB', 'a', 'Abs', 'absent']) assert.equal(parseMark(a), 'AB')
  assert.equal(parseMark('4x'), '4x')
})

test('cellState: out of range and below minimum', () => {
  assert.equal(cellState(51, J[0]), 'err')
  assert.equal(cellState(-1, J[0]), 'err')
  assert.equal(cellState('4x', J[0]), 'err')
  assert.equal(cellState(6, J[1]), 'low')
  assert.equal(cellState(7, J[1]), '')
  assert.equal(cellState('AB', J[1]), '')
  assert.equal(cellState(null, J[1]), '')
})

test('gradeOf boundaries', () => {
  assert.equal(gradeOf(100), 'A+'); assert.equal(gradeOf(90), 'A+'); assert.equal(gradeOf(89.9), 'A')
  assert.equal(gradeOf(40), 'D'); assert.equal(gradeOf(39.9), 'E'); assert.equal(gradeOf(0), 'E')
})

test('buildCalc ranks complete rows, ties share a rank, incomplete rows are not ranked', () => {
  const c = buildCalc([
    { id: 'a', m: [40, 20, 20] },   // 80
    { id: 'b', m: [40, 20, 20] },   // 80 tie
    { id: 'c', m: [30, 15, 10] },   // 55
    { id: 'd', m: [45, null, 20] }, // incomplete
  ], J, 100)
  assert.equal(c.a.rank, 1); assert.equal(c.b.rank, 1); assert.equal(c.c.rank, 3)
  assert.equal(c.d.rank, null); assert.equal(c.d.partial, true); assert.equal(c.d.complete, false)
  assert.equal(Math.round(c.a.pct), 80)
  assert.equal(c.a.grade, 'A'); assert.equal(c.c.grade, 'C')
})

test('buildCalc: absent in one subject still ranks on the rest; all absent is absent', () => {
  const c = buildCalc([{ id: 'a', m: [40, 'AB', 20] }, { id: 'z', m: ['AB', 'AB', 'AB'] }], J, 100)
  assert.equal(c.a.complete, true); assert.equal(c.a.rank, 1); assert.equal(c.a.pass, false)   // absent in Arithmetic (minimum 7)
  assert.equal(c.z.absent, true); assert.equal(c.z.rank, null)
})

test('buildCalc: pass needs every minimum; with no minimum it is 40%', () => {
  const c = buildCalc([{ id: 'low', m: [50, 6, 25] }, { id: 'ok', m: [30, 8, 10] }], J, 100)
  assert.equal(c.low.pass, false)      // 81% but Arithmetic 6 < 7
  assert.equal(c.ok.pass, true)
  const single = [{ n: 'Arithmetic', max: 50, min: '' }]
  const d = buildCalc([{ id: 'x', m: [19] }, { id: 'y', m: [20] }], single, 50)
  assert.equal(d.x.pass, false); assert.equal(d.y.pass, true)
})

test('buildCalc: an invalid cell blocks the row from ranking', () => {
  const c = buildCalc([{ id: 'a', m: [99, 10, 10] }, { id: 'b', m: [10, 10, 10] }], J, 100)
  assert.equal(c.a.bad, true); assert.equal(c.a.rank, null); assert.equal(c.b.rank, 1)
})

test('subjSig detects changes to subjects', () => {
  assert.equal(subjSig(J), subjSig(JSON.parse(JSON.stringify(J))))
  assert.notEqual(subjSig(J), subjSig([{ ...J[0], max: 60 }, J[1], J[2]]))
  assert.equal(subjSig([{ n: 'A', max: 10, min: '' }]), subjSig([{ n: 'A', max: '10', min: null }]))
})
