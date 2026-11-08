import test from 'node:test'
import assert from 'node:assert/strict'
import { sectionLimits, sectionTimed, settleSection, nextSection } from '../src/lib/cbtSections.js'
import { proctorOf, addEvent, fsExits, flagText } from '../src/lib/cbtProctorLogic.js'
import { questionStats, sectionStats, standings, summary, weakSections } from '../src/lib/cbtAnalytics.js'
import { rescorePlan } from '../src/lib/cbtRescore.js'
import { resultRows, grade } from '../src/lib/cbtEngine.js'

const q = (no, answer) => ({ no, text: `Q${no}`, options: ['A', 'B', 'C', 'D'].map(k => ({ key: k, text: k })), answer })
const T = (marking = {}) => ({
  id: 't', name: 'T', durationMin: 60, marking: { correct: 1, wrong: 0, ...marking },
  sections: [{ id: 's1', title: 'Maths', questions: [q(1, 'A'), q(2, 'B'), q(3, 'C')] }, { id: 's2', title: 'GK', questions: [q(4, 'D'), q(5, 'A')] }],
})
const att = (id, answers, state = 'submitted', score = null) => ({ id, state, answers, startedAt: 1000, submittedAt: 61000, candidate: { name: id, roll: id }, score })

test('fullscreen settings are read safely', () => {
  assert.deepEqual([proctorOf(T()).fullscreen, proctorOf(T()).maxFsExits], ['off', 3])
  assert.equal(proctorOf(T({ proctor: { fullscreen: 'strict', maxFsExits: 2 } })).maxFsExits, 2)
  assert.equal(proctorOf(T({ proctor: { fullscreen: 'weird' } })).fullscreen, 'off')
  const p = addEvent(addEvent(null, 'fsexit'), 'fsexit')
  assert.equal(fsExits(p), 2)
  assert.match(flagText(p), /Left full screen ×2/)
})

test('section limits and ordered opening', () => {
  const t = T({ sectionMinutes: [10, 0] })
  assert.deepEqual(sectionLimits(t), [10, 0]); assert.ok(sectionTimed(t)); assert.ok(!sectionTimed(T()))
  const at = 0
  assert.deepEqual(settleSection({ i: 0, at }, t, 5 * 60000), { i: 0, at, left: 300, over: false })
  const moved = settleSection({ i: 0, at }, t, 11 * 60000)
  assert.equal(moved.i, 1); assert.equal(moved.left, null); assert.equal(moved.at, 10 * 60000)
  assert.equal(nextSection({ i: 0, at: 0 }, t, 123).i, 1)
  assert.equal(nextSection({ i: 1, at: 0 }, t, 123).i, 1)      // stays on the last section
})

test('last section running out ends the exam; a reload mid-way catches up through several sections', () => {
  const t = T({ sectionMinutes: [5, 5] })
  assert.equal(settleSection({ i: 0, at: 0 }, t, 12 * 60000).over, true)
  const t3 = { ...T({ sectionMinutes: [5, 5, 5] }), sections: [...T().sections, { id: 's3', title: 'X', questions: [q(6, 'A')] }] }
  assert.equal(settleSection({ i: 0, at: 0 }, t3, 11 * 60000).i, 2)
})

const rows = () => resultRows(T(), [
  att('a', { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A' }),   // 5
  att('b', { 1: 'A', 2: 'C', 3: 'C', 4: 'D' }),            // 3
  att('c', { 1: 'B', 2: 'C', 4: 'A' }),                    // 0
  att('d', { 1: 'A' }, 'inprogress'),
])

test('question difficulty, option picks and suspicious keys', () => {
  const st = questionStats(T(), rows())
  const q2 = st.find(x => x.no === 2)
  assert.equal(q2.picks.B, 1); assert.equal(q2.picks.C, 2); assert.equal(q2.correct, 1)
  assert.equal(q2.pCorrect, 33.3); assert.equal(q2.level, 'hard')
  assert.equal(st.find(x => x.no === 1).level, 'medium')
  assert.equal(q2.topWrong, 'C')
  assert.equal(st.find(x => x.no === 5).skipped, 2)
  const many = resultRows(T(), ['a', 'b', 'c', 'd', 'e'].map(id => att(id, { 2: 'C' })))
  assert.ok(questionStats(T(), many).find(x => x.no === 2).suspect)   // everyone picked C, key says B
})

test('section stats, standings and summary count only submitted attempts', () => {
  const r = rows()
  const ss = sectionStats(T(), r)
  assert.equal(ss[0].max, 3); assert.equal(ss[0].avg, 1.67)
  const s = standings(r)
  assert.deepEqual([s.get('a').rank, s.get('b').rank, s.get('c').rank], [1, 2, 3])
  assert.equal(s.get('a').percentile, 100); assert.equal(s.get('c').percentile, 0); assert.equal(s.has('d'), false)
  assert.deepEqual([summary(r).count, summary(r).high, summary(r).low, summary(r).median], [3, 5, 0, 3])
  assert.equal(weakSections(r.find(x => x.attempt.id === 'b'))[0].title, 'GK')
})

test('re-evaluation finds who changed after a key correction', () => {
  const old = T()
  const attempts = [att('a', { 2: 'C' }, 'submitted', grade(old, { 2: 'C' })), att('b', { 2: 'B' }, 'submitted', grade(old, { 2: 'B' })), att('c', { 1: 'A' }, 'inprogress')]
  const fixed = T(); fixed.sections[0].questions[1].answer = 'C'      // key for Q2 corrected B → C
  const plan = rescorePlan(fixed, attempts)
  assert.equal(plan.changes.length, 2)
  assert.deepEqual(plan.changes.map(c => [c.attempt.id, c.delta]).sort(), [['a', 1], ['b', -1]])
  assert.equal(plan.unchanged, 0)
  assert.equal(rescorePlan(old, attempts).changes.length, 0)
})

import { liveState, liveCounts, DROP_AFTER_SEC } from '../src/lib/cbtLive.js'
import { secondsLeft } from '../src/lib/cbtEngine.js'

test('live view: in exam, dropped off, time up, done; extra time counts', () => {
  const t = T()                      // 60 min
  const now = 10 * 60000
  const base = { startedAt: 0, state: 'inprogress', answers: { 1: 'A', 2: null, 3: 'B' } }
  assert.deepEqual([liveState({ ...base, savedAt: now - 20000 }, t, now).kind, liveState({ ...base, savedAt: now - 20000 }, t, now).answered], ['live', 2])
  assert.equal(liveState({ ...base, savedAt: now - (DROP_AFTER_SEC + 5) * 1000 }, t, now).kind, 'dropped')
  assert.equal(liveState({ ...base, savedAt: null }, t, now).kind, 'dropped')        // never saved, 10 min after start
  assert.equal(liveState({ ...base, savedAt: now }, t, 61 * 60000).kind, 'timeup')
  assert.equal(liveState({ ...base, savedAt: 61 * 60000, extraSeconds: 300 }, t, 61 * 60000).kind, 'live')   // +5 min saved the attempt
  assert.equal(liveState({ ...base, state: 'submitted' }, t, now).kind, 'done')
  assert.equal(liveCounts([{ ...base, savedAt: now }, { ...base, savedAt: 0 }, { ...base, state: 'submitted' }], t, now).dropped, 1)
  assert.equal(secondsLeft({ startedAt: 0, extraSeconds: 120 }, t, 59 * 60000), 180)
})
