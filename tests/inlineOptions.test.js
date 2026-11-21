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
