import test from 'node:test'
import assert from 'node:assert/strict'
import { numberDiff, compareRows, compareSummary } from '../src/lib/cbtCompare.js'

test('matching numbers (including Meitei Mayek digits) are flagged as the same', () => {
  const d = numberDiff('The sum of 12 and 8 is', 'ꯃꯁꯤ ꯱꯲ ꯑꯃꯁꯨꯡ 8')
  assert.equal(d.same, true); assert.deepEqual(d.en.map(x => x.n), ['12', '8'])
})

test('a number with no partner in the other language is marked, and repeats are matched one-for-one', () => {
  // the screenshot case: English has the digit 6 twice ("6-digit … and 6"), Meitei Mayek only once
  const d = numberDiff('The smallest 6-digit number formed using the digits 0, 3, 5, 1, 8 and 6 is', 'ꯃꯥꯏꯅꯥꯁ 0, 3, 5, 1, 8 ꯑꯃꯁꯨꯡ 6')
  assert.equal(d.same, false)
  assert.deepEqual(d.en.filter(x => x.miss).map(x => x.n), ['6'])
  assert.equal(d.mm.some(x => x.miss), false)
})

test('numbers in the other language only are marked too, and no numbers at all is not a mismatch', () => {
  assert.deepEqual(numberDiff('Find x', 'Find 4 x').mm.filter(x => x.miss).map(x => x.n), ['4'])
  const none = numberDiff('Which is a mammal?', 'ꯀꯔꯤ ꯃꯥꯝꯃꯦꯜ?'); assert.equal(none.any, false); assert.equal(none.same, true)
})

test('rows are aligned: question, options, passage; figure questions only compare the passage', () => {
  const q = { no: 1, text: 'Q 5', textMm: 'Q 5', options: [{ key: 'A', text: '10', textMm: '10' }, { key: 'B', text: '20', textMm: '' }], passage: 'Read 3', passageMm: 'Read 4' }
  const rows = compareRows(q)
  assert.deepEqual(rows.map(r => r.id), ['q', 'oA', 'oB', 'p'])
  assert.equal(rows[2].missingMm, true)
  assert.deepEqual(compareSummary(rows), { numberMismatch: 2, oneSided: 1 })   // option B (20 vs nothing) and the passage (3 vs 4)
  assert.deepEqual(compareRows({ ...q, figure: true }).map(r => r.id), ['p'])
})
