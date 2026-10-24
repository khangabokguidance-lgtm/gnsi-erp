import test from 'node:test'
import assert from 'node:assert/strict'
import { friendly, examLink, SETUP_MSG, splitKey, joinKey, toAttempt, packMarks, infoTest, localAttempt, resultView, statusOf, inviteText } from '../src/lib/cbtOnlineLogic.js'
import { flatQuestions } from '../src/lib/cbtEngine.js'

const sections = [{ id: 's1', label: 'A', title: 'MA', questions: [
  { no: 1, text: 'one', options: [], answer: 'A', reviewed: true, figHash: ['h'], figHashMm: ['h'], images: ['data:x'] },
  { no: 2, text: 'two', options: [], answer: null }] }]

test('links and error messages', () => {
  assert.equal(examLink('t1', 'https://x.in'), 'https://x.in/exam?t=t1')
  assert.equal(friendly(new Error('EXAM-CODE: The access code is not correct.')), 'The access code is not correct.')
  assert.equal(friendly({ code: 'PGRST202', message: 'x' }), SETUP_MSG)
  assert.equal(friendly(new Error('Could not find the function public.cbt_start')), SETUP_MSG)
  assert.equal(friendly(new Error('Failed to fetch')), 'No internet connection.')
})

test('the paper published online carries no answers; the key travels separately and can be put back', () => {
  const { sections: paper, key } = splitKey({ sections })
  assert.deepEqual(key, { 1: 'A' })
  assert.equal(JSON.stringify(paper).includes('"answer"'), false)
  assert.equal(paper[0].questions[0].reviewed, undefined)
  assert.equal(paper[0].questions[0].images[0], 'data:x')     // the pictures stay
  assert.deepEqual(joinKey(paper, key)[0].questions.map(q => q.answer), ['A', null])
})

test('a server attempt row becomes an exam-screen attempt (marked + visited packed together)', () => {
  const row = { id: 'a1', test_id: 't1', candidate_name: 'Asha', roll: 'R1', phone: '9', started_at: '2026-10-24T10:00:00Z', submitted_at: '2026-10-24T11:00:00Z', state: 'submitted',
    answers: { 1: 'A' }, marked: packMarks({ 2: true }, { 1: true, 2: true }), current_no: 2, lang: 'mm', switches: 3, auto_submitted: true, score: { marks: 1 } }
  const a = toAttempt(row, 'Mock')
  assert.deepEqual([a.candidate.name, a.candidate.roll, a.source, a.state, a.switches, a.autoSubmitted], ['Asha', 'R1', 'online', 'submitted', 3, true])
  assert.deepEqual(a.marked, { 2: true }); assert.deepEqual(a.visited, { 1: true, 2: true })
  assert.equal(a.submittedAt - a.startedAt, 3600000)
  assert.deepEqual(toAttempt({ ...row, marked: { 5: true } }).marked, { 5: true })    // older rows: the map itself
})

test('the landing page shows the exam shape with only question numbers', () => {
  const t = infoTest({ id: 't1', name: 'Mock', durationMin: '90', marking: { correct: 1, wrong: 0 }, instructions: 'read', sections: [{ id: 's1', label: 'A', title: 'MA', count: 3, first: 41, last: 43 }] })
  assert.deepEqual(flatQuestions(t).map(q => q.no), [41, 42, 43]); assert.equal(t.durationMin, 90)
})

test('resuming: the server copy, or a newer copy kept on the device', () => {
  const t = { id: 't1', name: 'Mock', sections: [{ id: 's1', questions: [{ no: 1 }, { no: 2 }, { no: 3 }] }] }
  const att = { id: 'a1', startedAt: '2026-10-24T10:00:00Z', savedAt: '2026-10-24T10:05:00Z', answers: { 1: 'A' }, marked: packMarks({}, { 1: true }), current: 2, lang: 'en', switches: 1 }
  const cand = { name: 'A', roll: 'R' }
  const server = localAttempt(att, t, cand)
  assert.deepEqual(server.answers, { 1: 'A' }); assert.equal(server.current, 2); assert.deepEqual(server.visited, { 1: true, 2: true })
  const newer = { ts: Date.parse('2026-10-24T10:06:00Z'), answers: { 1: 'A', 2: 'C' }, marked: { 3: true }, visited: { 3: true }, current: 3, lang: 'mm', switches: 4 }
  const merged = localAttempt(att, t, cand, newer)
  assert.deepEqual(merged.answers, { 1: 'A', 2: 'C' }); assert.equal(merged.current, 3); assert.equal(merged.lang, 'mm'); assert.equal(merged.switches, 4)
  assert.deepEqual(Object.keys(merged.visited).sort(), ['1', '2', '3'])
  const older = localAttempt(att, t, cand, { ...newer, ts: Date.parse('2026-10-24T09:00:00Z') })
  assert.deepEqual(older.answers, { 1: 'A' })              // the device copy is older: the server wins
})

test('the result a candidate sees follows the exam settings', () => {
  const paper = { name: 'Mock', sections: [{ id: 's1', questions: [{ no: 1 }, { no: 2 }] }] }
  const full = resultView({ showResult: true, showAnswers: true, key: { 1: 'A', 2: 'B' }, answers: { 1: 'A' }, score: { marks: 1.25 }, attempt: { startedAt: '2026-10-24T10:00:00Z', submittedAt: '2026-10-24T10:30:00Z', switches: 2 }, test: paper }, null, { name: 'A', roll: 'R' })
  assert.deepEqual(full.test.sections[0].questions.map(q => q.answer), ['A', 'B']); assert.equal(full.attempt.score.marks, 1.25); assert.equal(full.attempt.switches, 2)
  const scoreOnly = resultView({ showResult: true, showAnswers: false, key: null, answers: { 1: 'A' }, score: { marks: 1.25 } }, paper, { name: 'A', roll: 'R' })
  assert.deepEqual(scoreOnly.test.sections[0].questions.map(q => q.answer), [null, null]); assert.equal(scoreOnly.test.showAnswers, false)
  const hidden = resultView({ showResult: false, showAnswers: false, key: null, answers: null, score: null }, paper, { name: 'A', roll: 'R' }, { answers: { 1: 'B' }, startedAt: 5 })
  assert.equal(hidden.test.showResult, false); assert.equal(hidden.attempt.score, null); assert.deepEqual(hidden.attempt.answers, { 1: 'B' })
})

test('status text and the invitation message', () => {
  const now = Date.now(), iso = d => new Date(now + d).toISOString()
  assert.equal(statusOf(null).label, 'Not online')
  assert.equal(statusOf({ status: 'live' }).label, 'Live')
  assert.equal(statusOf({ status: 'closed' }).label, 'Closed')
  assert.equal(statusOf({ status: 'live', closes_at: iso(-1000) }).label, 'Closed')
  assert.equal(statusOf({ status: 'live', opens_at: iso(86400000) }).label, 'Opens later')
  const msg = inviteText('Mock', { id: 't1', access_code: '123456', opens_at: null, closes_at: null }, 120)
  assert.match(msg, /Online exam: Mock\nLink: .*\/exam\?t=t1\nAccess code: 123456\nDuration: 120 minutes\nUse a steady/)
  assert.doesNotMatch(inviteText('Mock', { id: 't1', access_code: null }, 60), /Access code/)
})

test('the camera / shield log travels with the saved attempt and comes back on resume', () => {
  const x = { none: 2, shot: 1, log: [{ t: 1, k: 'none' }] }
  const packed = packMarks({ 1: true }, { 1: true }, x)
  assert.deepEqual(packed.x, x)
  assert.equal('x' in packMarks({}, {}), false, 'no log, nothing stored')
  const row = { id: 'a', test_id: 't', candidate_name: 'N', roll: 'r', started_at: '2026-10-24T10:00:00Z', state: 'inprogress', answers: {}, marked: packed, current_no: 1, lang: 'en', switches: 0 }
  assert.deepEqual(toAttempt(row).proctor, x)
  const back = localAttempt({ id: 'a', startedAt: '2026-10-24T10:00:00Z', answers: {}, marked: packed, current: 1, lang: 'en', switches: 0 }, { id: 't', name: 'T', sections: [{ questions: [{ no: 1 }] }] }, { name: 'N', roll: 'r' })
  assert.deepEqual(back.proctor, x)
})

test('a result whose answers are held back until the exam closes shows no review and says so', () => {
  const paper = { id: 't', name: 'T', sections: [{ id: 's', questions: [{ no: 1 }] }] }
  const later = resultView({ showResult: true, showAnswers: true, answersLater: true, score: { marks: 1 }, answers: { 1: 'A' }, key: null, test: null, attempt: { startedAt: '2026-10-24T10:00:00Z', submittedAt: '2026-10-24T10:30:00Z' } }, paper, { name: 'N', roll: 'r' })
  assert.equal(later.test.answersLater, true)
  assert.equal(later.test.showAnswers, false)
  assert.ok(!later.test.sections[0].questions[0].answer, 'no key put back')
  const open = resultView({ showResult: true, showAnswers: true, answersLater: false, score: { marks: 1 }, answers: { 1: 'A' }, key: { 1: 'A' }, test: paper, attempt: {} }, paper, { name: 'N', roll: 'r' })
  assert.equal(open.test.showAnswers, true)
  assert.equal(open.test.sections[0].questions[0].answer, 'A')
})
