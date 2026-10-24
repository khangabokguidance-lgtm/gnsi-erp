import test from 'node:test'
import assert from 'node:assert/strict'
import { integrityReport, similarPairs } from '../src/lib/cbtIntegrity.js'

const qs = Array.from({ length: 20 }, (_, i) => ({ no: i + 1, answer: 'A', options: [] }))
const T = { id: 't', name: 'T', durationMin: 60, marking: { correct: 1, wrong: 0 }, sections: [{ id: 's', label: 'A', title: 'A', questions: qs }] }
const ans = (right, wrong) => { const o = {}; for (let i = 1; i <= 20; i++) o[i] = i <= right ? 'A' : (i <= right + wrong ? wrong === 0 ? undefined : 'B' : undefined); return o }
const row = (id, name, answers, extra = {}, took = 40) => {
  const marks = Object.entries(answers).filter(([, v]) => v === 'A').length
  return { attempt: { id, candidate: { name, roll: id }, answers, switches: 0, ...extra }, g: { marks, max: 20 }, submitted: true, took }
}
// wrong sets: Asha & Bina both wrong on 6..12 with B; Chitra wrong on 13..18 with B
const asha = row('a', 'Asha', { ...ans(5, 0), ...Object.fromEntries([6, 7, 8, 9, 10, 11, 12].map(n => [n, 'B'])) })
const bina = row('b', 'Bina', { ...ans(5, 0), ...Object.fromEntries([6, 7, 8, 9, 10, 11, 12].map(n => [n, 'B'])), 13: 'A' })
const chitra = row('c', 'Chitra', { ...ans(5, 0), ...Object.fromEntries([13, 14, 15, 16, 17, 18].map(n => [n, 'B'])) })

test('two candidates with the same wrong answers on many questions are paired; a different set is not', () => {
  const pairs = similarPairs(T, [asha, bina, chitra])
  assert.equal(pairs.length, 1)
  assert.deepEqual([pairs[0].a.attempt.id, pairs[0].b.attempt.id], ['a', 'b'])
  assert.equal(pairs[0].same, 7)
})

test('too few shared wrong answers is not a pair (two good students agree on right answers)', () => {
  const x = row('x', 'X', ans(18, 0)), y = row('y', 'Y', ans(18, 0))
  assert.equal(similarPairs(T, [x, y]).length, 0)
})

test('risk points: signals add up to a level, each with a reason', () => {
  const sus = row('s', 'Sus', ans(19, 0), { switches: 4, takeovers: 1, ip: '1.1.1.1', ipLast: '2.2.2.2', gcc: '42', erpMatch: false, proctor: { none: 5, log: [] } }, 10)
  const clean = row('k', 'Clean', ans(10, 0), {}, 50)
  const { entries } = integrityReport(T, [sus, clean])
  const s = entries.find(e => e.row === sus), c = entries.find(e => e.row === clean)
  assert.equal(s.level, 'high')
  assert.ok(s.reasons.some(r => /left the exam screen 4/.test(r)) && s.reasons.some(r => /taken over/.test(r)) && s.reasons.some(r => /network address changed/.test(r)) && s.reasons.some(r => /does not match/.test(r)) && s.reasons.some(r => /finished in 10 min/.test(r)))
  assert.equal(c.level, 'low'); assert.equal(c.reasons.length, 0)
})

test('candidates on the same network are noted but one alone is not enough to flag', () => {
  const p = row('p', 'P', ans(10, 0), { ip: '9.9.9.9', ipLast: '9.9.9.9' }), q = row('q', 'Q', ans(10, 0), { ip: '9.9.9.9', ipLast: '9.9.9.9' })
  const { entries } = integrityReport(T, [p, q])
  assert.ok(entries[0].reasons.some(r => /same network as 1 other/.test(r)))
  assert.equal(entries[0].level, 'low')
})

test('answering most questions within seconds with a high score is flagged', () => {
  const fast = row('f', 'Fast', ans(18, 0), { timing: Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, 2])) }, 30)
  const { entries } = integrityReport(T, [fast])
  assert.ok(entries[0].reasons.some(r => /within 3 seconds/.test(r)))
})
