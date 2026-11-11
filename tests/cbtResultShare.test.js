import test from 'node:test'
import assert from 'node:assert/strict'
import { resultMessage, waLink, RESULT_WA_NUMBER } from '../src/lib/cbtResultShare.js'

const g = { marks: 62.5, max: 100, percent: 62.5, correct: 50, wrong: 10, skipped: 20, sections: [{ label: 'A', title: 'Mental Ability', marks: 20, max: 25 }, { label: 'B', title: 'Maths', marks: 42.5, max: 75 }] }

test('number is the one given, in wa.me format', () => assert.equal(RESULT_WA_NUMBER, '918974298074'))
test('message holds test, GCC, score, counts, time and sections', () => {
  const m = resultMessage({ testName: '10th Mega Mock Test', gcc: '123', g, tookMin: 87 })
  assert.match(m, /10th Mega Mock Test/)
  assert.match(m, /GCC no\.: 123/)
  assert.match(m, /Score: 62\.5 \/ 100 \(62\.5%\)/)
  assert.match(m, /Correct 50 · Wrong 10 · Not answered 20/)
  assert.match(m, /Time taken: 87 min/)
  assert.match(m, /A Mental Ability: 20\/25/)
})
test('no GCC / time → those lines are left out', () => {
  const m = resultMessage({ testName: 'T', gcc: '', g: { ...g, sections: [g.sections[0]] }, tookMin: null })
  assert.doesNotMatch(m, /GCC/)
  assert.doesNotMatch(m, /Time taken/)
  assert.doesNotMatch(m, /Mental Ability/)    // one section: no breakdown
})
test('link is wa.me/<number>?text=<encoded message>', () => {
  const u = waLink(RESULT_WA_NUMBER, 'Score: 5/10\nGood')
  assert.equal(u, 'https://wa.me/918974298074?text=Score%3A%205%2F10%0AGood')
})
