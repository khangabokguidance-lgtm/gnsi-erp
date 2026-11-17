import test from 'node:test'
import assert from 'node:assert/strict'
import { splitPastedQuestion, countQuestionStarts, applyAnswerKey } from '../src/lib/questionPaste.js'
import { parseQuestions } from '../src/lib/missionSainikQuestions.js'

test('splits one pasted question into question, options and answer', () => {
  const f = splitPastedQuestion('Q5. What is 3/4 + 1/4?\nA) 1/2\nB) 1\nC) 3/4\nD) 2\nAns: B\nExp: same denominator')
  assert.equal(f.question, 'What is 3/4 + 1/4?')
  assert.deepEqual([f.a, f.b, f.c, f.d], ['1/2', '1', '3/4', '2'])
  assert.equal(f.ans, 'B')
  assert.equal(f.exp, 'same denominator')
})

test('works without a question number, lowercase and bracketed options, and no answer', () => {
  const f = splitPastedQuestion('Which is a prime?\n(a) 4\n(b) 6\n(c) 7\n(d) 9')
  assert.equal(f.question, 'Which is a prime?')
  assert.equal(f.c, '7')
  assert.equal(f.ans, '')
})

test('multi-line question text is kept together', () => {
  const f = splitPastedQuestion('1. The sum of two numbers\nis 10. Find one.\nA. 3\nB. 4\nC. 5\nD. 6')
  assert.equal(f.question, 'The sum of two numbers is 10. Find one.')
})

test('returns null for text that is not a question with options', () => {
  assert.equal(splitPastedQuestion('just a sentence\nand another'), null)
  assert.equal(splitPastedQuestion('hello'), null)
})

test('counts question starts but not Ans/Exp lines', () => {
  assert.equal(countQuestionStarts('Q1. a\nA) x\nAns: A\nQ2. b\nA) y'), 2)
  assert.equal(countQuestionStarts('1) one\n2) two\n3) three'), 3)
})

test('trailing answer key fills in missing answers', () => {
  const text = 'Q1. First?\nA) a\nB) b\nC) c\nD) d\nQ2. Second?\nA) a\nB) b\nC) c\nD) d\nAnswer key: 1-B 2-D'
  const r = parseQuestions(applyAnswerKey(text))
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.questions.map(q => q.answer), ['B', 'D'])
})

test('answer key does not override an answer already given', () => {
  const text = '1. First?\nA) a\nB) b\nC) c\nD) d\nAns: A\n2. Second?\nA) a\nB) b\nC) c\nD) d\nAnswers: 1.C 2.C'
  const r = parseQuestions(applyAnswerKey(text))
  assert.deepEqual(r.questions.map(q => q.answer), ['A', 'C'])
})

test('text without a key is returned unchanged', () => {
  const t = 'Q1. x\nA) a\nB) b\nC) c\nD) d\nAns: A'
  assert.equal(applyAnswerKey(t), t)
})
