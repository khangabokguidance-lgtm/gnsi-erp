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
  assert.equal(flowNeighbors('panel')[0], null)
  assert.equal(flowNeighbors('syllabus')[0].id, 'panel')
  assert.equal(flowNeighbors('insights')[2], null)
  assert.deepEqual(flowNeighbors('guide'), [null, null, null])
  assert.equal(stepOfTab('megabuilder'), 4)
  assert.equal(flowNeighbors('admit')[0].id, 'build'); assert.equal(flowNeighbors('admit')[2].id, 'marks')
  assert.equal(flowNeighbors('certs')[0].id, 'analyse'); assert.equal(flowNeighbors('mockmarks')[1].id, 'marks')
})

test('first unfinished step is "now"; finished ones are "done"', () => {
  const st = flowStatus({ panel: { done: 6, total: 6 }, plan: { done: 120, total: 120 }, assign: { done: 60, total: 120 }, set: { done: 0, total: 120 } })
  assert.deepEqual(st.map(s => s.status), ['done', 'done', 'now', 'next', 'next', 'next', 'next', 'next', 'next', 'next'])
  assert.equal(st[2].label2, '60/120'); assert.equal(st[2].pct, 50)
})

test('with no data the first step is "now"; steps without a total never count as done', () => {
  assert.equal(flowStatus({})[0].status, 'now')
  const all = flowStatus({ panel: { done: 1, total: 1 }, plan: { done: 1, total: 1 }, assign: { done: 1, total: 1 }, set: { done: 1, total: 1 }, marks: { done: 1, total: 1 } })
  assert.equal(all.find(s => s.id === 'build').status, 'now')
})

test('Foundation flow: every tab exists and the Back / Next helpers work on a custom flow', async () => {
  const { FOUNDATION_FLOW } = await import('../src/lib/missionFoundationFlow.js')
  const all = FOUNDATION_FLOW.flatMap(s => s.tabs)
  assert.equal(new Set(all).size, all.length)
  const [p, c, n] = flowNeighbors('maker', FOUNDATION_FLOW)
  assert.equal(c.id, 'papers'); assert.equal(p.id, 'teach'); assert.equal(n.id, 'conduct')
  assert.equal(flowNeighbors('prizes', FOUNDATION_FLOW)[2], null)
  assert.deepEqual(flowNeighbors('chat', FOUNDATION_FLOW), [null, null, null])
  const st = flowStatus({ schedule: { done: 8, total: 8 } }, FOUNDATION_FLOW)
  assert.equal(st[0].status, 'done'); assert.equal(st[1].status, 'now')
})
