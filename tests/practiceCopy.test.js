// The server builds the same practice file the admin screen would (api/ never imports from src/, so this keeps the two in step).
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPracticeFile, copySlug, entryOf } from '../api/_entrance/practice-copy.js'
import { buildMockFile, parseMock, MOCK_SLUG, manifestEntry } from '../src/lib/cbtMock.js'
import { joinKey } from '../src/lib/cbtOnlineLogic.js'

const paper = {
  id: 'tmw9f1doi51t', name: '8th Mega Mock Test Series', durationMin: 100, marking: { correct: 1.25, wrong: 0 }, instructions: 'Read.',
  sections: [{ id: 's1', title: 'A', questions: [{ no: 1, text: 'q1', options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }] }, { no: 2, text: 'q2', options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }] }] }],
  key: { 1: 'A', 2: 'B' },
}

test('file matches what the admin screen builds from the same paper', () => {
  const server = buildPracticeFile(paper, 1000)
  const admin = buildMockFile({ id: paper.id, name: paper.name, durationMin: 100, marking: paper.marking, instructions: paper.instructions, showResult: true, showAnswers: true, sections: joinKey(paper.sections, paper.key) }, { slug: server.slug, now: 1000 })
  assert.deepEqual(server, admin)
  assert.equal(parseMock(server).sections[0].questions[1].answer, 'B')   // the exam page accepts it
})
test('manifest entry matches the site\'s own', () => {
  const f = buildPracticeFile(paper, 1000)
  assert.deepEqual(entryOf(f, 2), manifestEntry(f))
})
test('slug is valid, unique per exam, and short names survive', () => {
  assert.match(copySlug(paper.name, paper.id), MOCK_SLUG)
  assert.notEqual(copySlug('Mock', 'aaa111'), copySlug('Mock', 'bbb222'))
  assert.match(copySlug('', 'ID_9'), MOCK_SLUG)
  assert.ok(copySlug('x'.repeat(200), 'tmw9f1doi51tzzzzzzzz').length <= 61)
})
test('a paper with an unkeyed question is refused (the score would be wrong)', () => {
  assert.throws(() => buildPracticeFile({ ...paper, key: { 1: 'A' } }), /answer key/)
  assert.throws(() => buildPracticeFile({ ...paper, sections: [] }), /no questions/)
})
