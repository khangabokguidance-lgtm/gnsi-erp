import test from 'node:test'
import assert from 'node:assert/strict'
import { SYLLABUS_PLAN_2026, PLAN_SUBJECTS, planRows, diffPlan } from '../src/data/syllabusPlan2026.js'
import { SUBJECTS, TESTS } from '../src/missionSainikData.js'
import { parseSyllabusText } from '../src/lib/missionSainikExport.js'

test('the plan is 20 tests x 6 sections = 120 chapters, none empty', () => {
  assert.equal(SYLLABUS_PLAN_2026.length, 20)
  const rows = planRows()
  assert.equal(rows.length, 120)
  assert.ok(rows.every(r => r.chapter && r.chapter === r.chapter.trim() && !/\s{2,}|[,;]$/.test(r.chapter)))
  assert.deepEqual(SYLLABUS_PLAN_2026.map(r => r[0]), Array.from({ length: 20 }, (_, i) => i + 1))
})

test('subjects and test numbers match the app (so the builder finds them)', () => {
  assert.deepEqual(PLAN_SUBJECTS, SUBJECTS.map(s => s.label))
  assert.deepEqual(SYLLABUS_PLAN_2026.map(r => r[0]), TESTS.map(t => t.no))
})

test('spot checks against the document', () => {
  const at = (no, subject) => planRows().find(r => r.test_no === no && r.subject === subject).chapter
  assert.equal(at(1, 'Mathematics'), 'Natural Numbers, Prime and Composite Numbers, Roman Numerals')
  assert.equal(at(5, 'Science'), 'Water conservation & Pollution')   // the document's trailing comma is dropped
  assert.equal(at(12, 'General Knowledge'), 'Classical Dance of India')
  assert.equal(at(14, 'Mathematics'), 'Lines and Angles, Types of angle, Complementary and Supplementary angles')
  assert.equal(at(20, 'Vocabulary'), 'Idioms and phrases')
})

test('the plan survives the app\'s own paste-import parser unchanged', () => {
  const text = planRows().map(r => `${r.test_no}, ${r.subject}, ${r.chapter}`).join('\n')
  const { rows, errors } = parseSyllabusText(text, SUBJECTS)
  assert.deepEqual(errors, [])
  assert.deepEqual(rows, planRows())
})

test('diffPlan: empty database -> everything is added', () => {
  const d = diffPlan({})
  assert.equal(d.add.length, 120); assert.equal(d.change.length, 0); assert.equal(d.keep.length, 0); assert.equal(d.write.length, 120)
})

test('diffPlan: matching cells are kept, different ones changed, blanks added; spacing and case are ignored', () => {
  const syl = { '1|Mathematics': '  natural numbers, prime and composite numbers,  roman numerals ', '1|Reasoning': 'Something else', '1|Science': '   ' }
  const d = diffPlan(syl)
  assert.equal(d.keep.length, 1); assert.equal(d.change.length, 1); assert.equal(d.change[0].was, 'Something else')
  assert.equal(d.add.length, 118); assert.equal(d.write.length, 119)
})

test('diffPlan: a fully loaded plan changes nothing', () => {
  const syl = Object.fromEntries(planRows().map(r => [r.test_no + '|' + r.subject, r.chapter]))
  const d = diffPlan(syl)
  assert.equal(d.write.length, 0); assert.equal(d.keep.length, 120)
})
