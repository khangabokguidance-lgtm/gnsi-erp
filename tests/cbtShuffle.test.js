import test from 'node:test'
import assert from 'node:assert/strict'
import { presentTest, optionsDependOnEachOther, isShuffled } from '../src/lib/cbtShuffle.js'
import { grade } from '../src/lib/cbtEngine.js'

const opts = (...t) => ['A', 'B', 'C', 'D'].map((k, i) => ({ key: k, text: t[i] ?? `opt ${k}` }))
const q = (no, o = {}) => ({ no, figure: false, text: `Q${no}`, options: opts(), passage: '', answer: 'B', ...o })
const base = (shuffle, extra = []) => ({
  id: 't1', name: 'T', durationMin: 30, marking: { correct: 1, wrong: 0, ...(shuffle ? { shuffle } : {}) },
  sections: [{ id: 's1', title: 'S', questions: [...Array.from({ length: 12 }, (_, i) => q(i + 1)), ...extra] }],
})

test('no setting, no seed → the same test object', () => {
  const t = base(null)
  assert.equal(presentTest(t, 'att1'), t)
  const t2 = base({ questions: true })
  assert.equal(presentTest(t2, ''), t2)
  assert.equal(isShuffled(t), false)
})

test('same attempt → same order; different attempts → different orders', () => {
  const t = base({ questions: true, options: true })
  const nos = x => presentTest(t, x).sections[0].questions.map(z => z.no).join(',')
  assert.equal(nos('a'), nos('a'))
  const set = new Set(['a', 'b', 'c', 'd', 'e'].map(nos))
  assert.ok(set.size > 1)
})

test('every question and option is kept — only the order changes', () => {
  const p = presentTest(base({ questions: true, options: true }), 'x')
  const qs = p.sections[0].questions
  assert.deepEqual(qs.map(z => z.no).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1))
  for (const z of qs) assert.deepEqual(z.options.map(o => o.key).sort(), ['A', 'B', 'C', 'D'])
  assert.deepEqual(qs.map(z => z.pos), Array.from({ length: 12 }, (_, i) => i + 1))
  for (const z of qs) assert.deepEqual(z.options.map(o => o.label), ['A', 'B', 'C', 'D'])
})

test('marking is unchanged: answers are by question no. and original option key', () => {
  const t = base({ questions: true, options: true })
  const answers = { 1: 'B', 2: 'B', 3: 'A' }
  assert.deepEqual(grade(presentTest(t, 'x'), answers).marks, grade(t, answers).marks)
})

test('options only: question order untouched, no pos', () => {
  const p = presentTest(base({ options: true }), 'x')
  assert.deepEqual(p.sections[0].questions.map(z => z.no), Array.from({ length: 12 }, (_, i) => i + 1))
  assert.equal(p.sections[0].questions[0].pos, undefined)
})

test('questions sharing a passage stay together, in order', () => {
  const t = base({ questions: true }, [q(13, { passage: 'P' }), q(14, { passage: 'P' }), q(15, { passage: 'P' })])
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const nos = presentTest(t, seed).sections[0].questions.map(z => z.no)
    const i = nos.indexOf(13)
    assert.deepEqual(nos.slice(i, i + 3), [13, 14, 15])
  }
})

test('figure questions and "all of the above" questions keep their options', () => {
  const fig = q(20, { figure: true })
  const dep = q(21, { options: opts('red', 'blue', 'green', 'All of the above') })
  const dep2 = q(22, { options: opts('1 only', '2 only', 'Both A and B', 'None') })
  const t = base({ options: true }, [fig, dep, dep2])
  assert.ok(optionsDependOnEachOther(dep) && optionsDependOnEachOther(dep2) && !optionsDependOnEachOther(q(1)))
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    const byNo = Object.fromEntries(presentTest(t, seed).sections[0].questions.map(z => [z.no, z]))
    for (const n of [20, 21, 22]) assert.deepEqual(byNo[n].options.map(o => o.key), ['A', 'B', 'C', 'D'])
  }
})

test('the original test is never modified', () => {
  const t = base({ questions: true, options: true })
  const before = JSON.stringify(t)
  presentTest(t, 'x')
  assert.equal(JSON.stringify(t), before)
})
