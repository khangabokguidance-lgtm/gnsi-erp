import test from 'node:test'
import assert from 'node:assert/strict'
import { detectQuestions } from '../src/lib/detectQuestions.js'

const q = (n, ans = true) => `${n}. What is ${n}?\nA) one\nB) two\nC) three\nD) four\n${ans ? 'Answer: B\n' : ''}`

test('empty text is empty', () => assert.equal(detectQuestions('  \n ').kind, 'empty'))

test('plain notes have no questions', () => {
  const d = detectQuestions('# Water cycle\n\nWater evaporates from the sea.\n\n- point one\n- point two')
  assert.equal(d.kind, 'notes'); assert.equal(d.questions, 0); assert.match(d.text, /looks like notes/)
})

test('a question paper is detected, with answers counted', () => {
  const d = detectQuestions(Array.from({ length: 50 }, (_, i) => q(i + 1)).join('\n'))
  assert.equal(d.kind, 'questions'); assert.equal(d.questions, 50); assert.equal(d.withAnswers, 50); assert.match(d.text, /50 questions, all with answers/)
})

test('questions without answers, and options typed with bullets, still count', () => {
  const d = detectQuestions('1. First?\n• A) a\n• B) b\n• C) c\n• D) d\n\n2. Second?\n- A) a\n- B) b')
  assert.equal(d.questions, 2); assert.equal(d.withAnswers, 0); assert.match(d.text, /no answers/)
})

test('every question numbered "1." is still counted separately', () => {
  assert.equal(detectQuestions(q(1) + '\n' + q(1) + '\n' + q(1)).questions, 3)
})

test('questions among notes are mixed', () => {
  const notes = Array.from({ length: 12 }, (_, i) => `Note line number ${i + 1} about evaporation.`).join('\n')
  const d = detectQuestions(notes + '\n\n' + q(1) + '\n' + q(2))
  assert.equal(d.kind, 'mixed'); assert.equal(d.questions, 2)
})

test('a numbered list without options is not a question and is reported', () => {
  const d = detectQuestions('1. Boil the water\n2. Let it cool\n3. Pour it')
  assert.equal(d.kind, 'notes'); assert.equal(d.numberedNoOptions, 3); assert.match(d.text, /3 numbered lines had no A–D options/)
})

test('a wrapped question stem and an explanation line stay with their question', () => {
  const d = detectQuestions('1. This question is long and\ncontinues on a second line?\nA) a\nB) b\nC) c\nD) d\nAnswer: A\nExplanation: because.')
  assert.equal(d.questions, 1); assert.equal(d.kind, 'questions')
})

test('options written side by side on one line count as options', () => {
  const d = detectQuestions('Q1. What is 1?\n(A) one  (B) two  (C) three  (D) four\n\nQ2. What is 2?\n(A) one\t(B) two\t(C) three\t(D) four')
  assert.equal(d.questions, 2); assert.equal(d.numberedNoOptions, 0)
})
