import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paperModel, paperHtml, answerKeyHtml, nextPosition, auditPaper } from '../src/lib/missionFoundationPaper.js'

const papers = [
  { subject: 'Mathematics I', questions: 2, marks_each: 2 },
  { subject: 'Reasoning', questions: 3, marks_each: 1 },
  { subject: 'EVS', questions: 1, marks_each: 2 },
]
const q = (id, subject, position, answer = 'A') => ({ id, subject, position, question: `${subject} q${position}`, option_a: 'w', option_b: 'x', option_c: 'y', option_d: 'z', answer })
const qs = [q('1', 'Reasoning', 2, 'C'), q('2', 'Mathematics I', 1), q('3', 'Reasoning', 1, 'B'), q('4', 'Mathematics I', 2, 'D'), q('5', 'Other', 1)]

test('combined paper numbers questions straight through the sections', () => {
  const m = paperModel(papers, qs)
  assert.deepEqual(m.sections.map(s => [s.letter, s.subject, s.start, s.end, s.items.length]), [['A', 'Mathematics I', 1, 2, 2], ['B', 'Reasoning', 3, 4, 2], ['C', 'EVS', 5, 4, 0]])
  assert.equal(m.total, 4)
  assert.equal(m.marks, 2 * 2 + 2 * 1)
  assert.equal(m.wanted, 6)
  assert.deepEqual(m.sections[1].items.map(x => x.answer), ['B', 'C'])   // typed order kept in Set A
})

test('set B shuffles inside a section but keeps answers right', () => {
  const many = Array.from({ length: 12 }, (_, i) => q(String(i), 'Reasoning', i + 1, 'ABCD'[i % 4]))
  const b = paperModel(papers, many, { set: 'B', seed: 't1' })
  const sec = b.sections[1]
  assert.equal(sec.items.length, 12)
  sec.items.forEach(it => {
    const orig = many.find(x => x.id === it.id)
    assert.equal(it.opts.find(o => o.k === it.answer).text, orig['option_' + orig.answer.toLowerCase()])
  })
  assert.deepEqual(paperModel(papers, many, { set: 'B', seed: 't1' }).sections[1].items.map(x => x.id), sec.items.map(x => x.id))
})

test('paper and answer key html', () => {
  const m = paperModel(papers, qs)
  const html = paperHtml(m, { title: 'Test 01', minutes: 120, instructions: 'One\nTwo' })
  assert.match(html, /Section A · Mathematics I/)
  assert.match(html, /Section B · Reasoning/)
  assert.doesNotMatch(html, /Section C · EVS/)       // empty section left out
  assert.match(html, /Time: 120 minutes/)
  assert.match(html, /Full marks: 6/)
  assert.match(html, /<b>3\.<\/b>/)
  const key = answerKeyHtml(m, { title: 'Test 01' })
  assert.match(key, /<b>3\.<\/b> B/)
  assert.match(key, /<b>4\.<\/b> C/)
})

test('next position', () => {
  assert.equal(nextPosition(qs, 'Reasoning'), 3)
  assert.equal(nextPosition(qs, 'EVS'), 1)
})

test('audit: empty, short and complete sections are told apart', () => {
  const a = auditPaper(paperModel(papers, qs))
  assert.equal(a.kind, 'incomplete')
  assert.deepEqual(a.sections.map(x => x.state), ['full', 'short', 'empty'])
  assert.match(a.text, /4 of 6 questions in 3 sections/); assert.match(a.text, /EVS: no questions yet/); assert.match(a.text, /Reasoning 2\/3 still short/)
  const done = auditPaper(paperModel([{ subject: 'Mathematics I', questions: 2, marks_each: 2 }], [q('1', 'Mathematics I', 1), q('2', 'Mathematics I', 2, 'B')]))
  assert.equal(done.kind, 'complete'); assert.equal(done.ready, true); assert.match(done.text, /Every question has four options and an answer/)
  assert.equal(auditPaper(paperModel(papers, [])).kind, 'empty')
})

test('audit: missing options, missing answers and repeats are listed with their question numbers', () => {
  const bad = [
    { ...q('1', 'Mathematics I', 1), option_c: '' },
    { ...q('2', 'Mathematics I', 2), answer: '' },
    { ...q('3', 'Reasoning', 1), question: 'Mathematics I q1' },
  ]
  const a = auditPaper(paperModel(papers, bad))
  assert.deepEqual(a.issues.map(i => [i.no, i.problem]), [[1, 'needs all four options'], [2, 'has no answer'], [3, 'repeats Q1']])
  assert.match(a.text, /1 without all four options/); assert.match(a.text, /1 without an answer/); assert.match(a.text, /1 repeated/)
})
