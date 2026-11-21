import { test } from 'node:test'
import assert from 'node:assert/strict'
import { combinedHtml, canBuildCombined, testsAllowed, peopleOfTest } from '../src/lib/missionSainikCombined.js'

const secs = [{ setters: ['Anil', 'Ravi'], verifiers: ['Meena'] }, { setters: ['Sita'], verifiers: [] }]
const isMe = n => x => x === n

test('admin and staff assigned to the test may build; others may not', () => {
  assert.equal(canBuildCombined({ isAdmin: true, isMe: isMe('Nobody'), sections: secs }), true)
  for (const n of ['Anil', 'Ravi', 'Sita', 'Meena']) assert.equal(canBuildCombined({ isAdmin: false, isMe: isMe(n), sections: secs }), true, n)
  assert.equal(canBuildCombined({ isAdmin: false, isMe: isMe('Outsider'), sections: secs }), false)
  assert.equal(canBuildCombined({ isAdmin: false, isMe: isMe('Anil'), sections: [] }), false)
})

test('testsAllowed keeps only the tests the person is assigned to', () => {
  const sectionsOf = t => (t === 1 ? [{ setters: ['Anil'] }] : [{ setters: ['Sita'] }])
  assert.deepEqual(testsAllowed({ isAdmin: false, isMe: isMe('Anil'), testNos: [1, 2, 3], sectionsOf }), [1])
  assert.deepEqual(testsAllowed({ isAdmin: true, isMe: isMe('x'), testNos: [1, 2, 3], sectionsOf }), [1, 2, 3])
  assert.deepEqual(peopleOfTest(secs).sort(), ['Anil', 'Meena', 'Ravi', 'Sita'])
})

test('combined document lists every subject with answers, status and problems', () => {
  const q = { no: 1, question: 'What?', option_a: 'a1', option_b: 'b1', option_c: 'c1', option_d: 'd1', answer: 'B', explanation: 'because' }
  const html = combinedHtml({ inst: 'GNSI', tests: [{ id: 'PMT-01', date: '5 Dec', sections: [
    { label: 'Maths', q: 25, from: 1, items: [q], setters: ['Anil'], uploaders: ['Anil'], verifier: 'Meena', signoff: { verified_by: 'Meena' }, openNotes: 0 },
    { label: 'Science', q: 25, from: 26, items: [], setters: ['Sita'], uploaders: [], verifier: '', signoff: null, openNotes: 2 }],
  checks: [{ ok: false, text: '1 of 50 questions uploaded' }] }] })
  for (const w of ['PMT-01', 'Maths', 'Science', 'b1 ✔', 'Ans: B', 'because', 'Verified', 'Not verified', '2 open note', 'No questions uploaded yet', '1 of 50 questions uploaded', 'CONFIDENTIAL']) assert.ok(html.includes(w), w)
})
