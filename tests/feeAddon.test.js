import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAddonMap, addonFor, withAddon, applyAddon, isCombinedByRecord, isCombinedTag } from '../src/feeAddon.js'

test('reads the stored map and ignores junk', () => {
  assert.deepEqual(parseAddonMap('{"2026-2027":500}'), { '2026-2027': 500 })
  assert.deepEqual(parseAddonMap('{"2026-2027":"600.4","2027-2028":-5,"x":"abc"}'), { '2026-2027': 600 })
  assert.deepEqual(parseAddonMap('not json'), {})
  assert.deepEqual(parseAddonMap(null), {})
  assert.deepEqual(parseAddonMap('[1,2]'), {})
})

test('addonFor is 0 when the session has none', () => {
  assert.equal(addonFor({ '2026-2027': 500 }, '2026-2027'), 500)
  assert.equal(addonFor({ '2026-2027': 500 }, '2027-2028'), 0)
  assert.equal(addonFor(undefined, '2026-2027'), 0)
})

test('withAddon sets, replaces and clears without touching other sessions', () => {
  const m = withAddon({ a: 100 }, 'b', 250)
  assert.deepEqual(m, { a: 100, b: 250 })
  assert.deepEqual(withAddon(m, 'a', 0), { b: 250 })
  assert.deepEqual(withAddon(m, 'b', ''), { a: 100 })
})

test('Combined students pay the add-on in every month type', () => {
  const r = applyAddon({ flatFee: 4000, courseFee: 3000, admissionFee: 6000 }, true, 500)
  assert.equal(r.courseFee, 3500)
  assert.equal(r.flatFee, 4500)
  assert.equal(r.admissionFee, 6000)   // admission is not monthly — untouched
  assert.equal(r.addonFee, 500)
  assert.equal(r.addonReason, 'course')
  assert.equal(applyAddon({ flatFee: 1, courseFee: 1 }, true, 50, 'exam').addonReason, 'exam')
})

test('non-Combined students and a zero add-on are left exactly as they were', () => {
  const base = { flatFee: 4000, courseFee: 3000, admissionFee: 6000 }
  assert.equal(applyAddon(base, false, 500), base)
  assert.equal(applyAddon(base, true, 0), base)
})

test('a student is Combined by record when the course or the batch text says so', () => {
  assert.equal(isCombinedByRecord('Combined Course', '—'), true)
  assert.equal(isCombinedByRecord('Sainik', 'Combined Navodaya Course (Sainik Appearing Group) MAN'), true)
  assert.equal(isCombinedByRecord('Sainik', 'Achiever'), false)
  assert.equal(isCombinedByRecord('', ''), false)
})

test('Exams Combined tags are recognised in every spelling', () => {
  for (const t of ['Combined Navodaya Course(ENG)', 'Combined Navodaya Course (MM)', 'COMBINED NAVODAY ENG']) assert.equal(isCombinedTag(t), true)
  assert.equal(isCombinedTag('Achiever'), false)
  assert.equal(isCombinedTag(null), false)
})
