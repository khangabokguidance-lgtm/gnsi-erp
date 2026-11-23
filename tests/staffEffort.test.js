import test from 'node:test'
import assert from 'node:assert/strict'
import { staffBoard, questionPoints, badgesOf } from '../src/lib/staffEffort.js'

const q = (by, difficulty, extra = {}) => ({ uploaded_by: by, test_no: 1, section: 'Maths', difficulty, explanation: '', ...extra })
const many = (n, by, lv, extra) => Array.from({ length: n }, () => q(by, lv, extra))

test('points weigh the question level, and an explanation adds a quarter', () => {
  assert.equal(questionPoints(q('A', 'Easy')), 1)
  assert.equal(questionPoints(q('A', 'Medium')), 2)
  assert.equal(questionPoints(q('A', 'Hard', { explanation: 'because' })), 3.25)
  assert.equal(questionPoints(q('A', null)), 1)
})

test('hard questions outrank the same number of easy ones', () => {
  const assignments = [{ name: 'Ravi', test_no: 1, section: 'Maths', target: 20 }, { name: 'Bina', test_no: 1, section: 'Maths', target: 20 }, { name: 'Tomba', test_no: 1, section: 'Maths', target: 20 }]
  const rows = [...many(20, 'Ravi', 'Hard'), ...many(20, 'Bina', 'Easy'), ...many(5, 'Tomba', 'Medium')]
  const b = staffBoard({ assignments, rows })
  assert.deepEqual(b.people.map(p => p.name), ['Ravi', 'Bina', 'Tomba'])
  assert.equal(b.people[0].detector.id, 'star')
  assert.equal(b.people[1].detector.id, 'easyHeavy')
  assert.equal(b.people[2].detector.id, 'behind')
  assert.equal(b.people[0].progress, 100)
  assert.equal(b.people[2].progress, 25)
})

test('an allotted setter with nothing uploaded is flagged, and has no rank', () => {
  const b = staffBoard({ assignments: [{ name: 'Ravi', test_no: 1, section: 'Maths', target: 25 }, { name: 'Bina', test_no: 1, section: 'English', target: 25 }], rows: many(3, 'Ravi', 'Medium') })
  const bina = b.people.find(p => p.name === 'Bina')
  assert.equal(bina.detector.id, 'notStarted'); assert.equal(bina.rank, null)
})

test('uploads are matched to the panel name, and verified sections count', () => {
  const same = (who, name) => String(who).toLowerCase().includes(name.toLowerCase())
  const b = staffBoard({ assignments: [{ name: 'Ravi', test_no: 1, section: 'Maths', target: 10 }], rows: many(10, 'Ravi Kumar Singh', 'Hard'), signoffs: [{ test_no: 1, section: 'Maths' }], same })
  const r = b.people[0]
  assert.equal(b.people.length, 1); assert.equal(r.secsDone, 1); assert.equal(r.secsVerified, 1)
  assert.deepEqual(r.badges.map(x => x.id).sort(), ['allDone', 'finisher', 'first', 'hard', 'tagged', 'verified'].sort())
})

test('a balanced mix and explanations earn badges', () => {
  const p = { uploaded: 10, levels: { Easy: 4, Medium: 4, Hard: 2, untagged: 0 }, explained: 10, secsDone: 0, assignedSecs: 1, secsVerified: 0 }
  const ids = badgesOf(p).map(b => b.id)
  assert.ok(ids.includes('balanced')); assert.ok(ids.includes('explainer')); assert.ok(!ids.includes('hard'))
})
