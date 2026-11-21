import test from 'node:test'
import assert from 'node:assert/strict'
import { FLOW, stepOfTab, flowNeighbors, flowStatus } from '../src/lib/missionSainikFlow.js'
import { NAV_GROUPS } from '../src/lib/missionSainikNav.js'

test('every flow step opens a real screen', () => {
  const ids = new Set(NAV_GROUPS.flatMap(g => g.items.map(i => i[0])))
  FLOW.forEach(s => { assert.ok(ids.has(s.tab), s.tab); s.tabs.forEach(t => assert.ok(ids.has(t), t)); assert.ok(s.tabs.includes(s.tab)) })
})

test('a screen belongs to one step only', () => {
  const all = FLOW.flatMap(s => s.tabs)
  assert.equal(new Set(all).size, all.length)
})

test('back / next neighbours', () => {
  const [p, c, n] = flowNeighbors('mine')
  assert.equal(c.id, 'set'); assert.equal(p.id, 'assign'); assert.equal(n.id, 'build')
  assert.equal(flowNeighbors('syllabus')[0], null)
  assert.equal(flowNeighbors('insights')[2], null)
  assert.deepEqual(flowNeighbors('guide'), [null, null, null])
  assert.equal(stepOfTab('megabuilder'), 3)
})

test('first unfinished step is "now"; finished ones are "done"', () => {
  const st = flowStatus({ plan: { done: 120, total: 120 }, assign: { done: 60, total: 120 }, set: { done: 0, total: 120 } })
  assert.deepEqual(st.map(s => s.status), ['done', 'now', 'next', 'next', 'next', 'next', 'next'])
  assert.equal(st[1].label2, '60/120'); assert.equal(st[1].pct, 50)
})

test('with no data the first step is "now"; steps without a total never count as done', () => {
  assert.equal(flowStatus({})[0].status, 'now')
  const all = flowStatus({ plan: { done: 1, total: 1 }, assign: { done: 1, total: 1 }, set: { done: 1, total: 1 }, marks: { done: 1, total: 1 } })
  assert.equal(all.find(s => s.id === 'build').status, 'now')
})
