import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultTestName, fixTestName, fileMockKind, inScope } from '../src/lib/mockTestEngine.js'

test('default test name follows the series kind', () => {
  assert.equal(defaultTestName('Mega Mock Test 2026', 13), 'Mega Mock Test 13')
  assert.equal(defaultTestName('Pre Mock Test 2026', 4), 'Pre Mock Test 4')
})

test('a Pre Mock name saved in a Mega series is shown as Mega, and the other way round', () => {
  assert.equal(fixTestName({ series: 'Mega Mock Test 2026', test_name: 'Pre Mock Test 13' }).test_name, 'Mega Mock Test 13')
  assert.equal(fixTestName({ series: 'Pre Mock Test 2026', test_name: '5th Mega Mock Test' }).test_name, '5th Pre Mock Test')
  const keep = { series: 'Mega Mock Test 2026', test_name: '13th Mega Mock Test' }
  assert.equal(fixTestName(keep), keep)
  assert.equal(fixTestName({ series: 'Mega Mock Test 2026', test_name: '' }).test_name, '')
})

test('file names tell Mega and Pre result sheets apart', () => {
  assert.equal(fileMockKind('13TH MEGA MOCK TEST RESULT FOR COMBINED ENGLISH.xlsx'), 'mega')
  assert.equal(fileMockKind('8TH PRE MOCK TEST LAKSHYA - A.xlsx'), 'pre')
  assert.equal(fileMockKind('8th Pre-Mock Umeed.xlsx'), 'pre')
  assert.equal(fileMockKind('11 RESULT CE.xlsx'), '')
  assert.ok(inScope('Mega Mock Test 2026', 'mega') && !inScope('Mega Mock Test 2026', 'pre'))
})
