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

import { parseExamRef, examHref, extractCode } from '../src/lib/cbtRef.js'
test('exam link or plain Test ID is understood', () => {
  assert.deepEqual(parseExamRef('https://guidancekhangabok.in/exam?t=abc123&c=4455'), { id: 'abc123', code: '4455' })
  assert.deepEqual(parseExamRef('guidancekhangabok.in/exam?t=abc123'), { id: 'abc123', code: '' })
  assert.deepEqual(parseExamRef('  t-8f2a91  '), { id: 't-8f2a91', code: '' })
  for (const bad of ['', '   ', 'https://x.in/exam', 'a', '<script>', 'https://x.in/exam?t=a b!']) assert.equal(parseExamRef(bad), null, bad)
  assert.equal(examHref({ id: 'abc', code: '12 3' }), '/exam?t=abc&c=12%203')
})

import { splitPublicTests, showBlocks, FINDER_FILTERS } from '../src/lib/cbtFinder.js'
test('finder filter: open vs upcoming split and ordering', () => {
  const r = splitPublicTests([
    { id: 'u2', state: 'not_open', opensAt: '2026-12-10T00:00:00Z' }, { id: 'o2', state: 'open', closesAt: null },
    { id: 'u1', state: 'not_open', opensAt: '2026-11-12T00:00:00Z' }, { id: 'o1', state: 'open', closesAt: '2026-11-11T00:00:00Z' }, null,
  ])
  assert.deepEqual(r.open.map(x => x.id), ['o1', 'o2'])        // closing soonest first, no end last
  assert.deepEqual(r.upcoming.map(x => x.id), ['u1', 'u2'])    // opening soonest first
  assert.deepEqual(splitPublicTests(undefined), { open: [], upcoming: [] })
})
test('finder filter: which blocks each chip shows', () => {
  assert.deepEqual(showBlocks('all'), { open: true, upcoming: true, practice: true, top: true })
  assert.deepEqual(showBlocks('open'), { open: true, upcoming: false, practice: false, top: false })
  assert.deepEqual(showBlocks('upcoming'), { open: false, upcoming: true, practice: false, top: false })
  assert.deepEqual(showBlocks('practice'), { open: false, upcoming: false, practice: true, top: false })
  assert.deepEqual(showBlocks('top'), { open: false, upcoming: false, practice: false, top: true })
  assert.equal(FINDER_FILTERS.length, 5)
})

test('the access code is picked out of free text', () => {
  assert.equal(extractCode('Access code: 123456'), '123456')
  assert.equal(extractCode('access code - AB12cd'), 'AB12cd')
  assert.equal(extractCode('Your code is 998877'), '998877')
  assert.equal(extractCode('https://x.in/exam?t=abc&c=4455'), '4455')
  assert.equal(extractCode('Duration: 120 minutes'), null)
  assert.equal(extractCode('Access code: 12'), null, 'too short to be a code')
  assert.equal(extractCode(''), null); assert.equal(extractCode(undefined), null)
})
test('a pasted WhatsApp invitation gives the test AND the code', () => {
  const invite = `Online exam: 8th Mega Mock 5
Link: https://guidancekhangabok.in/exam?t=t-8f2a91
Access code: 482915
Duration: 120 minutes
Opens: 12 Nov 2026, 10:00 am
Use a steady internet connection. Keep the page open until you submit.`
  assert.deepEqual(parseExamRef(invite), { id: 't-8f2a91', code: '482915' })
  assert.deepEqual(parseExamRef('Join here 👉 guidancekhangabok.in/exam?t=abc123 — code: 7788'), { id: 'abc123', code: '7788' })
  assert.deepEqual(parseExamRef('https://guidancekhangabok.in/exam?t=abc123&c=99'), { id: 'abc123', code: '99'.length >= 4 ? '99' : '99' })
  assert.equal(parseExamRef('Online exam: no link here\nAccess code: 123456'), null, 'a code without a test cannot open anything')
})

test('the paste parser only reads the first few thousand characters', () => {
  const huge = 'x '.repeat(5000) + 'https://guidancekhangabok.in/exam?t=abc123 Access code: 482915'
  assert.equal(parseExamRef(huge), null, 'a link buried after 10 000 characters is ignored')
  assert.equal(extractCode(huge), null)
  assert.deepEqual(parseExamRef('Link: https://guidancekhangabok.in/exam?t=abc123 Access code: 482915'.padEnd(3000, ' ')), { id: 'abc123', code: '482915' })
})
