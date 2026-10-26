import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAddonMap, addonFor, withAddon, applyAddon } from '../src/feeAddon.js'

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
  const r = applyAddon({ flatFee: 4000, courseFee: 3000, admissionFee: 6000 }, 'Combined Course', 500)
  assert.equal(r.courseFee, 3500)
  assert.equal(r.flatFee, 4500)
  assert.equal(r.admissionFee, 6000)   // admission is not monthly — untouched
  assert.equal(r.addonFee, 500)
})

test('other courses and a zero add-on are left exactly as they were', () => {
  const base = { flatFee: 4000, courseFee: 3000, admissionFee: 6000 }
  assert.equal(applyAddon(base, 'Sainik', 500), base)
  assert.equal(applyAddon(base, 'Navodaya', 500), base)
  assert.equal(applyAddon(base, 'Combined Course', 0), base)
})
