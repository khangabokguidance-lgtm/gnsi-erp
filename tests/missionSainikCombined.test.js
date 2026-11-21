import { test } from 'node:test'
import assert from 'node:assert/strict'
import { combinedHtml, canBuildCombined, testsAllowed, peopleOfTest } from '../src/lib/missionSainikCombined.js'

test('only an admin may build the combined paper', () => {
  assert.equal(canBuildCombined({ isAdmin: true }), true)
  assert.equal(canBuildCombined({ isAdmin: false }), false)
  assert.equal(canBuildCombined({}), false)
})

test('testsAllowed gives every test to an admin and none to anyone else', () => {
  assert.deepEqual(testsAllowed({ isAdmin: true, testNos: [1, 2, 3] }), [1, 2, 3])
  assert.deepEqual(testsAllowed({ isAdmin: false, testNos: [1, 2, 3] }), [])
  assert.deepEqual(peopleOfTest([{ setters: ['Anil'], verifiers: ['Meena'] }]).sort(), ['Anil', 'Meena'])
})

test('combined document lists every subject with answers, status and problems', () => {
  const q = { no: 1, question: 'What?', option_a: 'a1', option_b: 'b1', option_c: 'c1', option_d: 'd1', answer: 'B', explanation: 'because' }
  const html = combinedHtml({ inst: 'GNSI', tests: [{ id: 'PMT-01', date: '5 Dec', sections: [
    { label: 'Maths', q: 25, from: 1, items: [q], setters: ['Anil'], uploaders: ['Anil'], verifier: 'Meena', signoff: { verified_by: 'Meena' }, openNotes: 0 },
    { label: 'Science', q: 25, from: 26, items: [], setters: ['Sita'], uploaders: [], verifier: '', signoff: null, openNotes: 2 }],
  checks: [{ ok: false, text: '1 of 50 questions uploaded' }] }] })
  for (const w of ['PMT-01', 'Maths', 'Science', 'b1 ✔', 'Ans: B', 'because', 'Verified', 'Not verified', '2 open note', 'No questions uploaded yet', '1 of 50 questions uploaded', 'CONFIDENTIAL']) assert.ok(html.includes(w), w)
})
