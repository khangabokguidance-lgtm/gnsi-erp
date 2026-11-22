import test from 'node:test'
import assert from 'node:assert/strict'
import { nearDuplicate, findNear, stemSimilarity } from '../src/lib/missionSainikSimilar.js'

const Q = (question, a, b, c, d, answer) => ({ question, option_a: a, option_b: b, option_c: c, option_d: d, answer })

test('a verbal question reworded but with the same options and answer is near', () => {
  const x = Q('A ______ of judges presided over the high-profile case.', 'flock', 'herd', 'bench', 'bundle', 'C')
  const y = Q('The high-profile case was presided over by a ______ of judges.', 'flock', 'herd', 'bench', 'bundle', 'C')
  assert.equal(nearDuplicate(x, y).near, true)
})

test('almost the same wording is near even if the options differ', () => {
  const x = Q('Which of the following is the capital city of the state of Manipur?', 'Imphal', 'Kohima', 'Aizawl', 'Shillong', 'A')
  const y = Q('Which of the following is the capital city of the state of Manipur', 'Imphal', 'Kohima', 'Aizawl', 'Itanagar', 'A')
  assert.equal(nearDuplicate(x, y).near, true)
})

test('two different sums with the same four numbers are NOT near', () => {
  const x = Q('What is 12 + 8?', '10', '20', '30', '40', 'B')
  const y = Q('What is 5 × 4?', '10', '20', '30', '40', 'B')
  assert.equal(nearDuplicate(x, y).near, false)
})

test('the same sentence with a different number in a long sum is not near when the options differ', () => {
  const x = Q('A shopkeeper buys 15 pens at Rs 12 each and sells them at Rs 14 each. Find the profit.', '25', '30', '35', '40', 'B')
  const y = Q('A shopkeeper buys 15 pens at Rs 12 each and sells them at Rs 16 each. Find the profit.', '50', '60', '70', '80', 'B')
  assert.equal(nearDuplicate(x, y).near, false)
})

test('same stem but a different correct answer is not near (options-based rule needs the same answer)', () => {
  const x = Q('Choose the synonym of rapid.', 'quick', 'slow', 'late', 'weak', 'A')
  const y = Q('Select the opposite of rapid.', 'quick', 'slow', 'late', 'weak', 'B')
  assert.equal(nearDuplicate(x, y).near, false)
})

test('totally different questions are not near', () => {
  assert.equal(nearDuplicate(Q('Who wrote the Ramayana?', 'Valmiki', 'Vyasa', 'Kalidasa', 'Tulsidas', 'A'), Q('Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Earth', 'Mars', 'A')).near, false)
})

test('findNear skips exact copies (handled elsewhere) and reports the question it resembles', () => {
  const existing = [Q('A ______ of judges presided over the case.', 'flock', 'herd', 'bench', 'bundle', 'C')]
  const list = [Q('A ______ of judges presided over the case.', 'flock', 'herd', 'bench', 'bundle', 'C'), Q('The case was presided over by a ______ of judges.', 'flock', 'herd', 'bench', 'bundle', 'C')]
  const r = findNear(list, existing)
  assert.equal(r.length, 1); assert.equal(r[0].q.question.startsWith('The case'), true); assert.ok(r[0].like)
})

test('stemSimilarity is 1 for the same text and low for unrelated text', () => {
  assert.equal(stemSimilarity({ question: 'Same text here' }, { question: 'same TEXT here!' }), 1)
  assert.ok(stemSimilarity({ question: 'abc def' }, { question: 'xyz uvw' }) < 0.1)
})
