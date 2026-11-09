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
  assert.deepEqual(cbtFlashFrom(m), { on: true, text: 'Hello', link: '/exam' })
  assert.equal(cbtFlashSettings({ on: false }).cbt_flash_on, 'no')
})
