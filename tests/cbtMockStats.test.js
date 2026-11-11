import test from 'node:test'
import assert from 'node:assert/strict'
import { countOnce, statsOf, viewsText, appearedText, DAY_MS, YEAR_MS } from '../src/lib/cbtMockStats.js'

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) } }

test('countOnce: counts the first time, not again within the window, again after it', () => {
  const s = mem()
  assert.equal(countOnce(s, 'a', 1000, DAY_MS), true)
  assert.equal(countOnce(s, 'a', 1000 + DAY_MS - 1, DAY_MS), false)
  assert.equal(countOnce(s, 'a', 1000 + DAY_MS, DAY_MS), true)
  assert.equal(countOnce(s, 'b', 1000, YEAR_MS), true)          // another key is independent
})
test('countOnce: blocked storage still counts (a counter must not break the page)', () => {
  const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(countOnce(broken, 'a'), true)
})
test('statsOf: nothing to show until there is a count; bad numbers are ignored', () => {
  assert.equal(statsOf({}, 'x'), null)
  assert.equal(statsOf(null, 'x'), null)
  assert.equal(statsOf({ x: { views: 0, starts: 0 } }, 'x'), null)
  assert.deepEqual(statsOf({ x: { views: '12', starts: -3 } }, 'x'), { views: 12, starts: 0 })
})
test('texts: singular and Indian digit grouping', () => {
  assert.equal(viewsText(1), '1 view')
  assert.equal(viewsText(1234567), '12,34,567 views')
  assert.equal(appearedText(1), '1 student appeared')
  assert.equal(appearedText(56), '56 students appeared')
})
