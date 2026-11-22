import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseQuestions } from '../src/lib/missionSainikQuestions.js'

test('options written two per line are split into A, B, C, D', () => {
  const { questions, errors } = parseQuestions('1. Water changing into vapour on heating is called:\n(a) Freezing    (b) Condensation\n(c) Evaporation (d) Precipitation\nAns: C')
  assert.deepEqual(errors, [])
  assert.equal(questions[0].option_a, 'Freezing')
  assert.equal(questions[0].option_b, 'Condensation')
  assert.equal(questions[0].option_c, 'Evaporation')
  assert.equal(questions[0].option_d, 'Precipitation')
})

test('one option per line still works', () => {
  const { questions } = parseQuestions('Q1. Pick\nA) one\nB) two\nC) three\nD) four\nAns: B')
  assert.equal(questions[0].option_d, 'four')
})

import { applyAnswerKey } from '../src/lib/questionPaste.js'
test('a separate answer key fills in Ans lines by question number', () => {
  const body = '1. A?\n(a) x (b) y\n(c) z (d) w\n2. B?\nA) 1\nB) 2\nC) 3\nD) 4'
  const { questions, errors } = parseQuestions(applyAnswerKey(body + '\nAnswer key: 1-C 2-B'))
  assert.deepEqual(errors, [])
  assert.deepEqual(questions.map(q => q.answer), ['C', 'B'])
})

test('text like "and d." inside an option is not taken for the next option', () => {
  const { questions } = parseQuestions('1. Pick\n(a) Only a\n(b) Only b\n(c) Only a and d. Both are true\n(d) None\nAns: C')
  assert.equal(questions[0].option_c, 'Only a and d. Both are true')
  assert.equal(questions[0].option_d, 'None')
})
test('B) and B. style inline options still split', () => {
  const a = parseQuestions('1. Q\nA) one B) two\nC) three D) four\nAns: B').questions[0]
  assert.deepEqual([a.option_a, a.option_b, a.option_c, a.option_d], ['one', 'two', 'three', 'four'])
  const b = parseQuestions('1. Q\nA. one B. two\nC. three D. four\nAns: B').questions[0]
  assert.deepEqual([b.option_a, b.option_b, b.option_c, b.option_d], ['one', 'two', 'three', 'four'])
})

import { parseWithKey, friendlyErrors } from '../src/lib/missionSainikQuestions.js'
test('parseWithKey applies a separate answer key by question number', () => {
  const body = '1. A?\n(a) x (b) y\n(c) z (d) w\n2. B?\nA) 1\nB) 2\nC) 3\nD) 4'
  const r = parseWithKey(body, '1-C 2-B')
  assert.deepEqual(r.errors, []); assert.deepEqual(r.questions.map(q => q.answer), ['C', 'B'])
  assert.equal(parseWithKey(body, '').errors.length, 2)   // without a key the answers are missing
})
test('friendlyErrors turns parser messages into short plain sentences', () => {
  assert.deepEqual(friendlyErrors(['Question 3: missing option B, option D, Ans', 'Question 4: missing Ans']), ['Q3: add option B, option D and the answer', 'Q4: add the answer'])
})
