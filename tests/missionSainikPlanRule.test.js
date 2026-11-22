import test from 'node:test'
import assert from 'node:assert/strict'
import { matchChapter, routePreMock } from '../src/lib/missionSainikPlanRule.js'

const q = (n, topic) => ({ question: 'Q' + n, topic })
const PLAN = ['Natural Numbers, Prime and Composite Numbers, Roman Numerals']

test('matchChapter ignores case and spacing and returns the plan spelling', () => {
  assert.equal(matchChapter(PLAN, '  natural numbers,  prime and composite numbers, roman numerals '), PLAN[0])
  assert.equal(matchChapter(PLAN, 'Fractions'), null)
  assert.equal(matchChapter([], 'x'), null)
})

test('a single planned chapter tags untagged questions', () => {
  const r = routePreMock({ list: [q(1, ''), q(2, undefined)], chapters: PLAN, defTopic: PLAN[0], room: 25 })
  assert.deepEqual(r.paper.map(x => x.topic), [PLAN[0], PLAN[0]])
  assert.equal(r.extra.length, 0)
})

test('a chapter outside the plan is refused with the planned list', () => {
  const r = routePreMock({ list: [q(1, PLAN[0]), q(2, 'Fractions')], chapters: PLAN, defTopic: '', room: 25 })
  assert.equal(r.error, 'chapter'); assert.equal(r.bad.length, 1); assert.equal(r.bad[0].topic, 'Fractions'); assert.deepEqual(r.planned, PLAN)
})

test('several planned chapters and no pick: untagged questions are refused', () => {
  const r = routePreMock({ list: [q(1, '')], chapters: ['A', 'B'], defTopic: '', room: 25 })
  assert.equal(r.error, 'chapter')
})

test('only the room left goes to the paper; the rest are extra, in order', () => {
  const list = Array.from({ length: 6 }, (_, i) => q(i + 1, PLAN[0]))
  const r = routePreMock({ list, chapters: PLAN, defTopic: PLAN[0], room: 4 })
  assert.deepEqual(r.paper.map(x => x.question), ['Q1', 'Q2', 'Q3', 'Q4'])
  assert.deepEqual(r.extra.map(x => x.question), ['Q5', 'Q6'])
})

test('a full section sends everything to the practice bank', () => {
  const r = routePreMock({ list: [q(1, PLAN[0])], chapters: PLAN, defTopic: PLAN[0], room: 0 })
  assert.equal(r.paper.length, 0); assert.equal(r.extra.length, 1)
})

test('no plan for this test: nothing is refused, the topic is kept as typed', () => {
  const r = routePreMock({ list: [q(1, 'Anything')], chapters: [], room: 25 })
  assert.equal(r.paper[0].topic, 'Anything')
})

import { offPlan, planState } from '../src/lib/missionSainikPlanRule.js'

test('planState: one chapter is ok, none is not planned, several is a problem', () => {
  assert.equal(planState(PLAN), 'ok'); assert.equal(planState([]), 'none'); assert.equal(planState(['A', 'B']), 'multi')
})

test('offPlan lists untagged and other-chapter questions, and nothing when there is no plan', () => {
  const list = [q(1, PLAN[0]), q(2, 'Fractions'), q(3, ''), q(4, '  natural numbers, prime and composite numbers, roman numerals')]
  assert.deepEqual(offPlan(list, PLAN).map(x => x.question), ['Q2', 'Q3'])
  assert.deepEqual(offPlan(list, []), [])
})
