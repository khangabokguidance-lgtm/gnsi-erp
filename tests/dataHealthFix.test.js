import test from 'node:test'
import assert from 'node:assert/strict'
import { QUICK_FIXES, validateQuickFix } from '../src/lib/dataHealthFix.js'

const TODAY = '2026-10-05'

test('quick fix: only single-column checks are fixable', () => {
  assert.deepEqual(Object.keys(QUICK_FIXES).sort(), ['adm_future', 'adm_missing', 'batch', 'course', 'hostel', 'name'])
  assert.equal(validateQuickFix('gcc_dup', 'x', TODAY).ok, false)
  assert.equal(validateQuickFix('phone_invalid', '9999999999', TODAY).ok, false)
})

test('quick fix: trims text and rejects blanks / over-long values', () => {
  assert.deepEqual(validateQuickFix('course', '  Navodaya  ', TODAY), { ok: true, value: 'Navodaya' })
  assert.equal(validateQuickFix('name', '   ', TODAY).ok, false)
  assert.equal(validateQuickFix('batch', 'x'.repeat(121), TODAY).ok, false)
})

test('quick fix: hostel type must be one of the allowed values', () => {
  assert.equal(validateQuickFix('hostel', 'Boarder', TODAY).ok, true)
  assert.equal(validateQuickFix('hostel', 'Resident', TODAY).ok, false)
})

test('quick fix: admission date must be real, not future, not ancient', () => {
  assert.equal(validateQuickFix('adm_missing', '2026-04-12', TODAY).ok, true)
  assert.equal(validateQuickFix('adm_future', TODAY, TODAY).ok, true)
  assert.match(validateQuickFix('adm_future', '2026-10-06', TODAY).error, /future/)
  assert.match(validateQuickFix('adm_missing', '2026-13-45', TODAY).error, /valid/)
  assert.match(validateQuickFix('adm_missing', '1999-01-01', TODAY).error, /past/)
  assert.equal(validateQuickFix('adm_missing', '12/04/2026', TODAY).ok, false)
})
