import test from 'node:test'
import assert from 'node:assert/strict'
import { readiness, summary } from '../src/lib/cbtReadiness.js'

const q = (no, answer) => ({ no, answer, options: ['A', 'B', 'C', 'D'].map(k => ({ key: k })) })
const T = (o = {}) => ({ durationMin: 30, marking: {}, sections: [{ questions: [q(1, 'A'), q(2, 'B'), q(3, null)] }], ...o })
const ALL = { extra: true, district: true, dobEntered: true, studentDistrict: true, guestsInfo: true }
const row = (o = {}) => ({ id: 't', status: 'live', access_code: '246810', opens_at: null, closes_at: null, ...o })
const get = (cs, id) => cs.find(c => c.id === id)

test('a missing migration is a problem and names the file', () => {
  const cs = readiness({ row: row(), test: T(), probes: { ...ALL, dobEntered: false } })
  assert.equal(get(cs, 'db').status, 'bad'); assert.match(get(cs, 'db').detail, /20261066/)
  assert.equal(get(readiness({ row: row(), test: T(), probes: ALL }), 'db').status, 'ok')
})

test('answer key: questions with no answer are flagged', () => {
  const k = get(readiness({ row: row(), test: T(), probes: ALL }), 'key')
  assert.equal(k.status, 'bad'); assert.match(k.detail, /1 of 3/)
  const full = T(); full.sections[0].questions[2].answer = 'C'
  assert.equal(get(readiness({ row: row(), test: full, probes: ALL }), 'key').status, 'ok')
})

test('access code and the time window', () => {
  assert.equal(get(readiness({ row: row({ access_code: '' }), test: T(), probes: ALL }), 'code').status, 'bad')
  assert.equal(get(readiness({ row: row({ access_code: 'abc' }), test: T(), probes: ALL }), 'code').status, 'warn')
  const past = readiness({ row: row({ closes_at: new Date(Date.now() - 1000).toISOString() }), test: T(), probes: ALL })
  assert.equal(get(past, 'window').status, 'bad')
  assert.equal(get(readiness({ row: row(), test: T(), probes: ALL }), 'window').status, 'warn')
})

test('students without a parent number block; without a date of birth only warn; inactive ones are ignored', () => {
  const students = [
    { id: 1, parent_phone: '9876543210', dob: '2010-01-01' },
    { id: 2, father_phone: '98765 43211', dob: '' },
    { id: 3, parent_phone: '', dob: '2011-02-02' },
    { id: 4, parent_phone: '', status: 'Left' },
    { id: 5, parent_phone: '', deleted_at: '2026-01-01' },
  ]
  const cs = readiness({ row: row(), test: T(), probes: ALL, students })
  assert.equal(get(cs, 'phones').status, 'bad'); assert.match(get(cs, 'phones').label, /^1 active student has no parent number/)
  assert.equal(get(cs, 'dobs').status, 'warn'); assert.match(get(cs, 'dobs').label, /^1 active student has no date of birth/)
  const good = readiness({ row: row(), test: T(), probes: ALL, students: students.slice(0, 1) })
  assert.equal(get(good, 'phones').status, 'ok'); assert.equal(get(good, 'dobs').status, 'ok')
})

test('guests are flagged, settings are summarised, and the summary counts problems', () => {
  const t = T({ marking: { guests: true, shuffle: { questions: true }, proctor: { fullscreen: 'strict', camera: 'off' }, sectionMinutes: [10, 0], minMinutes: 5 } })
  const cs = readiness({ row: row(), test: t, probes: ALL })
  assert.equal(get(cs, 'guests').status, 'warn')
  assert.match(get(cs, 'settings').detail, /shuffling on.*full screen: strict.*camera off.*section timers on.*earliest submit 5 min/)
  const s = summary(cs); assert.ok(s.bad >= 1 && s.warn >= 2)
})
