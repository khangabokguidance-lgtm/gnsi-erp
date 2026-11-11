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

import { practiceKey, gccDigits, gccValid, triesText, summarisePractice } from '../src/lib/cbtMockStats.js'
test('practice key: mock slug as is, past exam prefixed and cleaned', () => {
  assert.equal(practiceKey('mock', '10th-mega-mock-test'), '10th-mega-mock-test')
  assert.equal(practiceKey('exam', 'TMW9f1doi51t'), 'practice-tmw9f1doi51t')
  assert.equal(practiceKey('exam', 'a b/c'), 'practice-abc')
})
test('GCC no.: digits only, no leading zeros, 1–12 digits', () => {
  assert.equal(gccDigits(' 00123-45 '), '12345')
  assert.equal(gccValid('0012'), true)
  assert.equal(gccValid(''), false)
  assert.equal(gccValid('abc'), false)
  assert.equal(gccValid('1234567890123'), false)
})
test('tries text', () => {
  assert.equal(triesText(2), '2 tries left for this test.')
  assert.equal(triesText(1), '1 try left for this test.')
  assert.equal(triesText(0), 'That was your last try for this test.')
})
test('summarisePractice: one row per GCC + test, counted, newest first', () => {
  const r = summarisePractice([
    { gcc: '1', slug: 'a', started_at: '2026-11-11T10:00:00Z' },
    { gcc: '1', slug: 'a', started_at: '2026-11-11T12:00:00Z' },
    { gcc: '2', slug: 'a', started_at: '2026-11-11T11:00:00Z' },
    { gcc: '1', slug: 'b', started_at: '2026-11-10T09:00:00Z' },
  ])
  assert.equal(r.length, 3)
  assert.deepEqual(r[0], { gcc: '1', slug: 'a', tries: 2, last: '2026-11-11T12:00:00Z' })
  assert.equal(r[1].gcc, '2')
})
