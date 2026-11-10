import test from 'node:test'
import assert from 'node:assert/strict'
import { agoText, rankPractice } from '../src/lib/cbtFinder.js'

const NOW = Date.parse('2026-11-10T12:00:00Z')
test('agoText reads naturally', () => {
  assert.equal(agoText('2026-11-10T11:59:40Z', NOW), 'just now')
  assert.equal(agoText('2026-11-10T11:30:00Z', NOW), '30 min ago')
  assert.equal(agoText('2026-11-10T09:00:00Z', NOW), '3 hours ago')
  assert.equal(agoText('2026-11-10T11:00:00Z', NOW), '1 hour ago')
  assert.equal(agoText('2026-11-07T12:00:00Z', NOW), '3 days ago')
  assert.equal(agoText('2026-09-01T12:00:00Z', NOW), null)
  assert.equal(agoText('', NOW), null)
  assert.equal(agoText('2027-01-01T00:00:00Z', NOW), null)
})
test('rankPractice puts the newest first and tags it', () => {
  const r = rankPractice([{ id: 'a', closedAt: '2026-11-10T02:00:00Z' }, { id: 'b', closedAt: '2026-11-10T06:00:00Z' }, { id: 'c', closedAt: '2026-11-01T06:00:00Z' }], NOW)
  assert.deepEqual(r.map(x => x.id), ['b', 'a', 'c'])
  assert.deepEqual(r.map(x => x.latest), [true, false, false])
  assert.deepEqual(r.map(x => x.isNew), [true, true, false])
  assert.equal(r[0].ago, '6 hours ago')
})
test('rankPractice copes with missing times and empty input', () => {
  assert.deepEqual(rankPractice(null), [])
  const r = rankPractice([{ id: 'x' }], NOW)
  assert.equal(r[0].latest, false)
  assert.equal(r[0].ago, null)
})
