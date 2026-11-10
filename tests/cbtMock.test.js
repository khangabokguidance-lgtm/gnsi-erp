import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMockFile, parseMock, slugify, manifestEntry, mockLink, MOCK_FORMAT } from '../src/lib/cbtMock.js'

const paper = (answered = true) => ({
  id: 't1', name: '8th Mega Mock Test', durationMin: 120, marking: { correct: 1, wrong: 0.25 }, instructions: 'Read.',
  sections: [{ id: 's1', name: 'GK', questions: [{ no: 1, text: 'Q1', options: ['a', 'b'], answer: 'a' }, { no: 2, text: 'Q2', options: ['a', 'b'], answer: answered ? 'b' : null }] }],
})

test('slugify makes a safe file name', () => {
  assert.equal(slugify('8th Mega Mock Test!'), '8th-mega-mock-test')
  assert.equal(slugify('   '), 'mock')
})
test('build then parse round-trips a keyed paper', () => {
  const f = buildMockFile(paper(), { now: 0 })
  assert.equal(f.format, MOCK_FORMAT)
  assert.equal(f.slug, '8th-mega-mock-test')
  const t = parseMock(JSON.parse(JSON.stringify(f)))
  assert.equal(t.id, 'mock-8th-mega-mock-test')
  assert.equal(t.sections[0].questions[1].answer, 'b')
  assert.equal(t.durationMin, 120)
})
test('a paper with a missing answer key is refused', () => {
  assert.throws(() => buildMockFile(paper(false)), /no answer key/)
})
test('an empty paper and a bad slug are refused', () => {
  assert.throws(() => buildMockFile({ name: 'x', sections: [] }), /no questions/)
  assert.throws(() => buildMockFile(paper(), { slug: '../evil' }), /a–z/)
})
test('parseMock rejects foreign or empty files', () => {
  assert.throws(() => parseMock(null))
  assert.throws(() => parseMock({ format: 'other' }))
  assert.throws(() => parseMock({ format: MOCK_FORMAT, sections: [] }))
})
test('manifest entry and link', () => {
  const f = buildMockFile(paper(), { now: Date.UTC(2026, 10, 10) })
  assert.deepEqual(manifestEntry(f), { slug: '8th-mega-mock-test', name: '8th Mega Mock Test', durationMin: 120, questions: 2, date: '2026-11-10', testId: 't1' })
  assert.equal(mockLink('a-b', 'https://x.in'), 'https://x.in/exam?mock=a-b')
})
