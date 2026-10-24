import test from 'node:test'
import assert from 'node:assert/strict'
import { newAttempt, statusOf, go, select, clear, mark, counts, neighbour, secondsLeft, clock, parseKey, grade, keyStatus, flatQuestions, STATUS } from '../src/lib/cbtEngine.js'
import { parseLines, buildTest, attachImages } from '../src/lib/cbtPaper.js'

const mk = (no, answer = null) => ({ no, answer, text: `q${no}`, options: [] })
const T = { id: 't1', name: 'Mock', durationMin: 120, marking: { correct: 1.25, wrong: 0.25 },
  sections: [{ id: 's1', label: 'A', title: 'MA', questions: [mk(1, 'A'), mk(2, 'B'), mk(3, 'C')] }, { id: 's2', label: 'B', title: 'AR', questions: [mk(4, 'D'), mk(5, null)] }] }

test('question status follows the SSC palette rules', () => {
  let a = newAttempt(T, { name: 'Asha' })
  assert.equal(statusOf(a, 1), STATUS.NV)
  a = go(a, 1); assert.equal(statusOf(a, 1), STATUS.NA)
  a = select(a, 1, 'B'); assert.equal(statusOf(a, 1), STATUS.A)
  a = mark(a, 1); assert.equal(statusOf(a, 1), STATUS.AMR)
  a = clear(a, 1); assert.equal(statusOf(a, 1), STATUS.NA)
  a = mark(go(a, 2), 2); assert.equal(statusOf(a, 2), STATUS.MR)
  assert.deepEqual(counts(a, flatQuestions(T)), { notVisited: 3, notAnswered: 1, answered: 0, marked: 1, answeredMarked: 0 })
})

test('moving between questions', () => {
  assert.equal(neighbour(T, 3, 1), 4)
  assert.equal(neighbour(T, 5, 1), 5)
  assert.equal(neighbour(T, 1, -1), 1)
})

test('the clock counts from the start time and never goes below zero', () => {
  const a = newAttempt(T, {}, 1000)
  assert.equal(secondsLeft(a, T, 1000), 7200)
  assert.equal(secondsLeft(a, T, 1000 + 3600e3), 3600)
  assert.equal(secondsLeft(a, T, 1000 + 9999e3), 0)
  assert.equal(clock(7200), '02:00:00'); assert.equal(clock(65), '00:01:05'); assert.equal(clock(-3), '00:00:00')
})

test('answer key: pairs, plain letters, errors', () => {
  const nos = [1, 2, 3, 4, 5]
  assert.deepEqual(parseKey('1-A, 2-B\n3:C  4 D 5. a', nos).key, { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A' })
  assert.deepEqual(parseKey('abcda', nos), { key: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A' }, errors: [] })
  assert.match(parseKey('ABC', nos).errors[0], /3 letters found for 5 questions/)
  assert.match(parseKey('9-A', nos).errors[0], /Question 9 is not in this test/)
  assert.match(parseKey('1-A 1-B', nos).errors[0], /two answers/)
  assert.deepEqual(parseKey('', nos), { key: {}, errors: [] })
})

test('scoring: marks, negative marking, sections, unscored questions', () => {
  const g = grade(T, { 1: 'A', 2: 'C', 4: 'D', 5: 'A' })
  assert.equal(g.correct, 2); assert.equal(g.wrong, 1); assert.equal(g.attempted, 4); assert.equal(g.skipped, 1)
  assert.equal(g.marks, 2.25)       // 2 × 1.25 − 0.25
  assert.equal(g.max, 5)            // 4 scored questions × 1.25
  assert.equal(g.unscored, 1); assert.equal(g.complete, false)
  assert.equal(g.sections[0].marks, 1); assert.equal(g.sections[1].marks, 1.25)
  assert.equal(g.accuracy, 50)
  assert.deepEqual(keyStatus(T), { set: 4, total: 5, complete: false })
})

test('a paper is parsed into sections, passages, figures and a matched second language', () => {
  const en = ['SECTION - A MENTAL ABILITY TEST', 'Directions: pick one.', 'Q1.', 'Q2.',
    'SECTION - II', 'ENVIRONMENTAL STUDY', 'Q3. What is a shelter?', '(A) A house', '(B) A tent', '(C) A boat', '(D) A cave',
    'PASSAGE', 'x'.repeat(150), 'Q4. Why?', '(A) a (B) b', '(C) c (D) d', '', 'Passage - 2', 'Q5. Fill in the blank:', 'Water flows ____ .', '(A ) up (b) down', '(C) left (D) right',
    '6. No q prefix', '(A) 1', '(B) 2', '(C) 3', '(D) 4']
  const mm = ['seKsN - I title', 'Q3. mm three', '(A) a1', '(B) b1', '(C) c1', '(D) d1', 'p'.repeat(150), 'Q4. mm four', '(A) a (B) b', '(C) c (D) d']
  const { sections, warnings } = buildTest(en, mm)
  assert.deepEqual(sections.map(s => [s.label, s.title, s.questions.map(q => q.no)]), [['A', 'MENTAL ABILITY TEST', [1, 2]], ['II', 'ENVIRONMENTAL STUDY', [3, 4, 5, 6]]])
  assert.equal(sections[0].directions, 'pick one.')
  const q = n => sections.flatMap(s => s.questions).find(x => x.no === n)
  assert.equal(q(1).figure, true); assert.equal(q(3).figure, false)
  assert.equal(q(3).textMm, 'mm three'); assert.equal(q(3).options[2].textMm, 'c1')
  assert.equal(q(4).passage.length, 150); assert.equal(q(4).passageMm.length, 150); assert.equal(q(3).passage, '')
  assert.deepEqual(q(4).options.map(o => o.text), ['a', 'b', 'c', 'd'])
  assert.equal(q(5).text, 'Fill in the blank:\nWater flows ____ .')
  assert.deepEqual(q(5).options.map(o => o.key + o.text), ['Aup', 'Bdown', 'Cleft', 'Dright'])
  assert.equal(q(5).passage.length, 150)     // "Passage - 2" has no text of its own, so Q5 keeps passage 1
  assert.equal(q(6).text, 'No q prefix')
  assert.ok(warnings.some(w => /Question 5 is missing from the Meitei Mayek paper/.test(w)))
  assert.ok(warnings.some(w => /Question 6 is missing/.test(w)))
  const imgWarn = attachImages(sections, [{ dataUrl: 'data:1' }])
  assert.equal(q(1).image, 'data:1'); assert.equal(q(2).image, null)
  assert.ok(imgWarn.some(w => /2 figure questions but 1 picture/.test(w)))
})

test('missing and duplicate question numbers are reported', () => {
  const { warnings } = buildTest(['Q1. a', '(A) 1', '(B) 2', '(C) 3', '(D) 4', 'Q3. c', '(A) 1', '(B) 2', '(C) 3'])
  assert.ok(warnings.some(w => /Question 2 was not found/.test(w)))
  assert.ok(warnings.some(w => /Question 3 has 3 options/.test(w)))
  assert.equal(parseLines(['Q1. x', '(A) 1', '(A) 2']).warnings.length, 1)
})

import { resultRows, resultsCSV } from '../src/lib/cbtEngine.js'

test('results are ranked, ties share a rank, in-progress attempts are listed last', () => {
  const at = (name, answers, state = 'submitted', min = 60) => ({ id: name, candidate: { name, roll: '' }, answers, state, startedAt: 0, submittedAt: state === 'submitted' ? min * 60000 : null, switches: 0 })
  const rows = resultRows(T, [at('Low', { 1: 'B' }), at('Top', { 1: 'A', 2: 'B', 3: 'C', 4: 'D' }), at('Tie', { 1: 'A', 2: 'B', 3: 'C', 4: 'D' }, 'submitted', 90), at('Live', { 1: 'A' }, 'inprogress')])
  assert.deepEqual(rows.map(r => [r.attempt.id, r.rank]), [['Top', 1], ['Tie', 1], ['Low', 3], ['Live', null]])
  const csv = resultsCSV(T, [at('Asha, K', { 1: 'A' })])
  assert.match(csv, /"Asha, K"/)
  assert.match(csv.split('\r\n')[0], /^\uFEFFRank,Name,Roll no\.,Status/)
})
