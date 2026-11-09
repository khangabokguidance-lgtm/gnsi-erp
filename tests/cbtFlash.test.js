import test from 'node:test'
import assert from 'node:assert/strict'
import { cbtFlashFrom, cbtFlashSettings, CBT_FLASH_DEFAULT_TEXT } from '../src/lib/cbtFlash.js'

test('off by default, on only for yes/true/on/1', () => {
  assert.equal(cbtFlashFrom({}).on, false)
  assert.equal(cbtFlashFrom(null).on, false)
  for (const v of ['yes', 'YES', 'true', 'on', '1', ' yes ']) assert.equal(cbtFlashFrom({ cbt_flash_on: v }).on, true, v)
  for (const v of ['no', 'off', '0', '', undefined]) assert.equal(cbtFlashFrom({ cbt_flash_on: v }).on, false, String(v))
})
test('text falls back to the default and is capped', () => {
  assert.equal(cbtFlashFrom({ cbt_flash_on: 'yes' }).text, CBT_FLASH_DEFAULT_TEXT)
  assert.equal(cbtFlashFrom({ cbt_flash_text: 'x'.repeat(500) }).text.length, 200)
})
test('link: same-site path or https only, otherwise /exam', () => {
  assert.equal(cbtFlashFrom({ cbt_flash_link: '/exam?t=abc' }).link, '/exam?t=abc')
  assert.equal(cbtFlashFrom({ cbt_flash_link: 'https://x.in/a' }).link, 'https://x.in/a')
  for (const bad of ['javascript:alert(1)', '//evil.com', 'http://x.in', 'data:text/html,hi', '']) assert.equal(cbtFlashFrom({ cbt_flash_link: bad }).link, '/exam', bad)
})
test('save map round-trips', () => {
  const m = cbtFlashSettings({ on: true, text: ' Hello ', link: '/exam' })
  const f = cbtFlashFrom(m)
  assert.equal(f.on, true); assert.equal(f.text, 'Hello'); assert.equal(f.link, '/exam'); assert.equal(f.at, null)
  assert.equal(cbtFlashSettings({ on: false }).cbt_flash_on, 'no')
})

import { flashPhase, countdownParts, nextScheduled } from '../src/lib/cbtFlash.js'
test('phases: upcoming → live → ended', () => {
  const f = { at: '2026-11-12T04:30:00.000Z', end: '2026-11-12T06:30:00.000Z' }
  const t = s => Date.parse(s)
  assert.deepEqual(flashPhase(f, t('2026-11-12T04:00:00Z')), { phase: 'upcoming', ms: 30 * 60000 })
  assert.equal(flashPhase(f, t('2026-11-12T04:30:00Z')).phase, 'live')
  assert.equal(flashPhase(f, t('2026-11-12T06:30:00Z')).phase, 'ended')
  assert.equal(flashPhase({}, Date.now()).phase, 'live')            // no schedule = always live
  assert.equal(flashPhase({ at: '2026-11-12T04:30:00Z' }, t('2030-01-01T00:00:00Z')).phase, 'live') // no end: stays live
})
test('countdown parts and bad dates', () => {
  assert.deepEqual(countdownParts(93784000), { d: 1, h: 2, m: 3, s: 4 })
  assert.deepEqual(countdownParts(-5), { d: 0, h: 0, m: 0, s: 0 })
  assert.equal(cbtFlashFrom({ cbt_flash_at: 'garbage' }).at, null)
})
test('next scheduled test is the nearest future opening; closed or past ones are skipped', () => {
  const now = Date.parse('2026-11-10T00:00:00Z')
  const rows = [
    { id: 'a', opens_at: '2026-11-20T00:00:00Z', status: 'live' }, { id: 'b', opens_at: '2026-11-12T00:00:00Z', status: 'live' },
    { id: 'c', opens_at: '2026-11-11T00:00:00Z', status: 'closed' }, { id: 'd', opens_at: '2026-11-01T00:00:00Z', status: 'live' }, { id: 'e', opens_at: null, status: 'live' },
  ]
  assert.equal(nextScheduled(rows, now).id, 'b')
  assert.equal(nextScheduled([], now), null)
})
test('schedule round-trips through the saved settings', () => {
  const m = cbtFlashSettings({ on: true, text: 'x', link: '', at: '2026-11-12T04:30:00Z', end: '2026-11-12T06:30:00Z', label: 'Mock 5', test: 't1' })
  const f = cbtFlashFrom(m)
  assert.equal(f.at, '2026-11-12T04:30:00.000Z'); assert.equal(f.label, 'Mock 5'); assert.equal(f.test, 't1')
})

import { parseExamRef, examHref } from '../src/lib/cbtRef.js'
test('exam link or plain Test ID is understood', () => {
  assert.deepEqual(parseExamRef('https://guidancekhangabok.in/exam?t=abc123&c=4455'), { id: 'abc123', code: '4455' })
  assert.deepEqual(parseExamRef('guidancekhangabok.in/exam?t=abc123'), { id: 'abc123', code: '' })
  assert.deepEqual(parseExamRef('  t-8f2a91  '), { id: 't-8f2a91', code: '' })
  for (const bad of ['', '   ', 'https://x.in/exam', 'a', '<script>', 'https://x.in/exam?t=a b!']) assert.equal(parseExamRef(bad), null, bad)
  assert.equal(examHref({ id: 'abc', code: '12 3' }), '/exam?t=abc&c=12%203')
})
