import test from 'node:test'
import assert from 'node:assert/strict'
import { guessFromFilename, parseResultSheet } from '../src/lib/mockTestEngine.js'

test('file names: test number and batch, in the formats the sheets arrive in', () => {
  const g = guessFromFilename
  assert.deepEqual(g('10 COMBINED ENG RESULT.xls'), { test_no: 10, batch: 'Combined English' })
  assert.deepEqual(g('10 COMBINED MAN RESULT.xls'), { test_no: 10, batch: 'Combined Manipuri' })
  assert.deepEqual(g('10 LAKSHYA -A RESULT.xls'), { test_no: 10, batch: 'Lakshya A' })
  assert.deepEqual(g('10 LAKSHYA -B RESULT.xls'), { test_no: 10, batch: 'Lakshya B' })
  assert.deepEqual(g('10 UMED RESULT.xls'), { test_no: 10, batch: 'Umeed' })
  assert.deepEqual(g('11 RESULT CE.xls'), { test_no: 11, batch: 'Combined English' })
  assert.deepEqual(g('12 RESULT CM.xls'), { test_no: 12, batch: 'Combined Manipuri' })
  assert.deepEqual(g('13 RESULT L-A.xls'), { test_no: 13, batch: 'Lakshya A' })
  assert.deepEqual(g('13 RESULT L-B.xls'), { test_no: 13, batch: 'Lakshya B' })
  assert.deepEqual(g('16 RESULT U.xls'), { test_no: 16, batch: 'Umeed' })
})
test('file names: the older formats still work', () => {
  assert.deepEqual(guessFromFilename('RESULT OUT FOR 8TH PRE MOCK TEST FOR NAVODAYA LAKSHYA - A.xls'), { test_no: 8, batch: 'Lakshya A' })
  assert.equal(guessFromFilename('RESULT OF TEST 3 COMBINED ENGLISH.xls').batch, 'Combined English')
})
test('scanner columns (Side 1 Colored, Correct Questions, Status…) are not subjects', () => {
  const aoa = [
    ['Name of the Student', 'GCC NUMBER', 'Score', 'MENTAL ABILITY', 'EVS', 'MATHEMATICS', 'PASSAGE', 'Side 1 Colored', 'Side 2 BW', 'Side 2 Colored', 'Status', 'Correct Questions', 'Incorrect Questions', 'Blank Questions'],
    ['A STUDENT', 11, 80, 20, 20, 20, 20, null, null, 123456789, 'OK', 80, 5, 1],
    ['B STUDENT', 12, 60, 15, 15, 15, 15, null, null, 987654321, 'OK', 60, 20, 5],
  ]
  const p = parseResultSheet(aoa)
  assert.deepEqual(p.subjects, ['Mental Ability', 'EVS', 'Mathematics', 'Passage'])
  assert.deepEqual(p.warnings, [])
  assert.deepEqual(p.rows.map(r => [r.total, r.rank]), [[80, 1], [60, 2]])
})

test('GCC with leading zeros is the same GCC', async () => {
  const { gccDigits } = await import('../src/lib/mockTestEngine.js')
  assert.equal(gccDigits('0764'), '764')
  assert.equal(gccDigits('111*'), '111')
  assert.equal(gccDigits('N/A'), '')
  assert.equal(gccDigits(1130), '1130')
})
