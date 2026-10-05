import test from 'node:test'
import assert from 'node:assert/strict'
import { computeRiskIndex, buildActionItems, buildTimeline } from '../src/lib/studentChart.js'

const healthy = { profile: { attendance: { pct: 95, totalMarked: 40 }, discipline: [], complaints: [], sickbay: [], leave: [], gatePasses: [], fees: {} }, dues: { totalDue: 0 }, student: { status: 'Active' } }

test('risk: healthy student scores 0 / Low', () => {
  const r = computeRiskIndex(healthy)
  assert.equal(r.score, 0); assert.equal(r.level, 'Low'); assert.deepEqual(r.reasons, [])
})

test('risk: low attendance + dues add up with reasons', () => {
  const r = computeRiskIndex({ ...healthy, profile: { ...healthy.profile, attendance: { pct: 55, totalMarked: 20 } }, dues: { totalDue: 12000 } })
  assert.equal(r.score, 55); assert.equal(r.level, 'Moderate'); assert.equal(r.reasons.length, 2)
})

test('risk: tiny attendance sample is ignored; score is capped at 100', () => {
  assert.equal(computeRiskIndex({ ...healthy, profile: { ...healthy.profile, attendance: { pct: 0, totalMarked: 2 } } }).score, 0)
  const bad = computeRiskIndex({ profile: { attendance: { pct: 10, totalMarked: 30 }, discipline: [{}, {}, {}], complaints: [{}, {}], sickbay: [{ status: 'Admitted' }] }, dues: { totalDue: 50000 }, student: { status: 'Dropout' } })
  assert.equal(bad.score, 100); assert.equal(bad.level, 'High')
})

test('risk: tolerates missing inputs', () => {
  assert.equal(computeRiskIndex().score, 0)
  assert.deepEqual(buildActionItems(), [])
  assert.deepEqual(buildTimeline(), [])
})

test('actions: closed discipline is not an action; pending leave and dues are', () => {
  const items = buildActionItems({ profile: { discipline: [{ status: 'Closed' }], leave: [{ status: 'Pending' }], attendance: {} }, dues: { totalDue: 500 }, student: {} })
  assert.deepEqual(items.map(i => i.key), ['fees', 'leave'])
})

test('timeline: merges modules, newest first, skips bad dates, honours limit', () => {
  const t = buildTimeline({ student: { admission_date: '2026-04-12' }, profile: { fees: { admFeeCols: [{ pay_date: '2026-10-02', amount: 3000 }] }, exams: [{ exam_date: '2026-09-20', subject: 'Maths', marks_obtained: 88 }], discipline: [{ date: 'garbage' }], sickbay: [], leave: [], gatePasses: [], complaints: [] } })
  assert.deepEqual(t.map(e => e.module), ['Fees', 'Exams', 'Admission'])
  assert.equal(t[0].title, 'Fee payment ₹3,000')
  assert.equal(buildTimeline({ profile: { exams: Array.from({ length: 30 }, (_, i) => ({ exam_date: `2026-01-${String(i % 28 + 1).padStart(2, '0')}` })) } }, 5).length, 5)
})
