// Question-paper structure for the Document Translator (src/mayekPaper.js).
import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareSource, buildModel, makeSet, answerKey, answerIndex, splitInlineOptions, paperStats, numbered } from '../src/mayekPaper.js'

const PAPER = [
  'Section A',
  '1. What is the capital of India? [1]',
  '(a) Delhi (b) Mumbai (c) Kolkata (d) Chennai',
  'Ans: a',
  '2. Find x if 2x + 3 = 11. (2 marks)',
  'a) 3', 'b) 4', 'c) 5', 'd) 6',
  'Answer: (b)',
  '3. Name the largest planet. Ans: Jupiter',
  'Section B',
  '4. Write a short note on the river Imphal. [5]',
]

test('inline options are split, a question with options on its line too', () => {
  assert.deepEqual(splitInlineOptions('(a) Delhi (b) Mumbai (c) Kolkata'), ['(a) Delhi', '(b) Mumbai', '(c) Kolkata'])
  assert.deepEqual(splitInlineOptions('1. Capital? (a) Delhi (b) Mumbai'), ['1. Capital?', '(a) Delhi', '(b) Mumbai'])
  assert.deepEqual(splitInlineOptions('Vitamin A. It helps the eyes.'), ['Vitamin A. It helps the eyes.'])
  assert.deepEqual(splitInlineOptions('(b) one (a) two'), ['(b) one (a) two'])
})

test('answers and marks are taken out of the paper text', () => {
  const items = prepareSource(PAPER)
  assert.equal(items.some(i => /^ans/i.test(i.en)), false)
  const q = items.filter(i => /^\d\./.test(i.en))
  assert.deepEqual(q.map(i => [i.en, i.marks, i.answer]), [
    ['1. What is the capital of India?', '1', 'a'],
    ['2. Find x if 2x + 3 = 11.', '2', '(b)'],
    ['3. Name the largest planet.', '', 'Jupiter'],
    ['4. Write a short note on the river Imphal.', '5', ''],
  ])
})

test('model groups options under questions and strips labels', () => {
  const m = buildModel(prepareSource(PAPER).map(i => ({ ...i, mm: i.en })))
  assert.deepEqual(m.blocks.map(b => b.type), ['section', 'question', 'question', 'question', 'section', 'question'])
  const q1 = m.blocks[1]
  assert.equal(q1.en, 'What is the capital of India?')
  assert.deepEqual(q1.body.map(b => b.en), ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'])
  assert.equal(answerIndex(q1), 0)
  assert.equal(answerIndex(m.blocks[2]), 1)
  assert.deepEqual(paperStats(m), { questions: 4, mcq: 2, withMarks: 3, marks: 8, answers: 3, maxOptions: 4 })
})

test('sets shuffle within sections and keep answers with their options', () => {
  const m = buildModel(prepareSource(PAPER).map(i => ({ ...i, mm: i.en })))
  assert.deepEqual(makeSet(m, 0), m)
  for (const n of [1, 2, 3]) {
    const s = makeSet(m, n)
    assert.deepEqual(s.blocks.map(b => b.type), m.blocks.map(b => b.type))
    assert.equal(s.blocks[5].en, m.blocks[5].en) // the only question in Section B stays
    const key = answerKey(s)
    for (const k of key) {
      const q = numbered(s).find(b => b.no === k.no)
      if (q.en.startsWith('What is the capital')) assert.equal(k.text, 'Delhi')
      if (q.en.startsWith('Find x')) assert.equal(k.text, '4')
      if (q.en.startsWith('Name the largest')) assert.deepEqual([k.letter, k.text], ['', 'Jupiter'])
    }
    assert.deepEqual(makeSet(m, n), s) // the same every time
  }
  assert.notDeepEqual(JSON.stringify(makeSet(m, 1)), JSON.stringify(makeSet(m, 2)))
})
