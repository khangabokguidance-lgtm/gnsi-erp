import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBoard, classCounts, filterEntries, sortEntries, summarize, toppers, tableOf, csvOf, workbookSheets, whatsappText } from '../src/lib/cbtResultBoard.js'

const sec = (m, max = 20) => ({ label: 'A', title: 'Maths', marks: m, max })
const row = (id, name, gcc, marks, over = {}) => ({
  attempt: { id, gcc, candidate: { name, roll: String(gcc) }, state: 'submitted', startedAt: 1, submittedAt: 2, proctor: over.proctor || null, switches: 0 },
  g: { marks, max: 40, percent: Math.round((marks / 40) * 1000) / 10, correct: marks, wrong: 0, skipped: 0, accuracy: 90, sections: [sec(marks)] },
  submitted: over.submitted !== false, took: over.took ?? 30, rank: over.rank ?? 1,
})
const students = [
  { id: 's1', name: 'Anil', gcc_no: 1, batch: 'Lakshya A', course: 'Navodaya' }, { id: 's2', name: 'Bina', gcc_no: 2, batch: 'Lakshya A', course: 'Navodaya' },
  { id: 's3', name: 'Chaoba', gcc_no: 3, batch: 'Umeed', course: 'Navodaya' }, { id: 's4', name: 'Dolly', gcc_no: 4, batch: '—', course: 'Combined Course' },
  { id: 's5', name: 'Ema', gcc_no: 5, batch: '—', course: 'Combined Course' }, { id: 's6', name: 'Fem', gcc_no: 6, batch: 'Lakshya B', course: 'Navodaya' },
]
const secondary = { s4: ['Combined Navodaya Course (MM)'], s5: ['Combined Navodaya Course(ENG)'] }
const rows = [row('a1', 'Anil', 1, 36), row('a2', 'Bina', 2, 36), row('a3', 'Chaoba', 3, 30), row('a4', 'Dolly', 4, 38), row('a5', 'Ema', 5, 20), row('a6', 'Guest Kid', 99, 10), row('a7', 'Fem', 6, 25, { submitted: false })]

test('every attempt gets its class from the ERP; unknown candidates are guests', () => {
  const b = buildBoard({ test: {}, rows, students, secondaryMap: secondary })
  const by = Object.fromEntries(b.map(e => [e.name, e.classKey]))
  assert.deepEqual(by, { Anil: 'lakshya-a', Bina: 'lakshya-a', Chaoba: 'umeed', Dolly: 'combined-mm', Ema: 'combined-eng', 'Guest Kid': 'guest', Fem: 'lakshya-b' })
  assert.deepEqual(classCounts(b).map(c => c.label), ['Lakshya A', 'Lakshya B', 'Umeed', 'Combined · Manipuri', 'Combined · English', 'Guest / not in ERP'])
})
test('class ranks: ties share a rank inside the class; unfinished attempts are not ranked', () => {
  const b = buildBoard({ test: {}, rows, students, secondaryMap: secondary })
  const g = n => b.find(e => e.name === n)
  assert.equal(g('Anil').classRank, 1); assert.equal(g('Bina').classRank, 1)
  assert.equal(g('Dolly').classRank, 1); assert.equal(g('Fem').classRank, null)
  assert.equal(g('Dolly').percentile, 100, 'the overall topper is at the 100th percentile'); assert.equal(g('Guest Kid').percentile, 0, 'the lowest submitted is at 0')
})
test('filters: class, search, status, minimum percent, pass mark, flagged', () => {
  const b = buildBoard({ test: {}, rows: [...rows.slice(0, 2), row('x', 'Flagged One', 3, 30, { proctor: { none: 2 } })], students, secondaryMap: secondary })
  assert.equal(filterEntries(b, { classKeys: new Set(['lakshya-a']) }).length, 2)
  assert.equal(filterEntries(b, { q: 'bina' }).length, 1); assert.equal(filterEntries(b, { q: '3' }).length, 1)
  assert.equal(filterEntries(b, { minPercent: 80 }).length, 2); assert.equal(filterEntries(b, { passOnly: true, cutoff: 85 }).length, 2)
  assert.equal(filterEntries(b, { flaggedOnly: true }).length, 1)
  assert.equal(filterEntries(buildBoard({ test: {}, rows, students }), { status: 'inprogress' }).length, 1)
})
test('sorting', () => {
  const b = buildBoard({ test: {}, rows, students, secondaryMap: secondary })
  assert.equal(sortEntries(b, 'marks')[0].name, 'Dolly'); assert.equal(sortEntries(b, 'marks', 'desc').at(-1).name, 'Dolly')
  assert.equal(sortEntries(b, 'name')[0].name, 'Anil'); assert.equal(sortEntries(b, 'class')[0].classKey, 'lakshya-a')
})
test('summary per class and overall, with the pass mark', () => {
  const b = buildBoard({ test: {}, rows, students, secondaryMap: secondary })
  const s = summarize(b, 60)
  assert.equal(s.overall.count, 7); assert.equal(s.overall.submitted, 6); assert.equal(s.overall.inProgress, 1)
  assert.equal(s.overall.highest, 38); assert.equal(s.overall.lowest, 10)
  const la = s.byClass.find(c => c.key === 'lakshya-a'); assert.equal(la.count, 2); assert.equal(la.avgPercent, 90); assert.equal(la.passRate, 100)
  assert.equal(s.byClass.find(c => c.key === 'combined-eng').passRate, 0)
  assert.equal(s.overall.pass, 4)   // 36,36,38 and ... 30/40 = 75% passes at 60, 20/40 and 10/40 do not
  assert.equal(s.sectionBest[0].name, 'Dolly')
  const t = toppers(b, 1); assert.equal(t.find(x => x.key === 'combined-mm').list[0].name, 'Dolly')
})
test('exports: CSV is safe, Excel has a summary, an all sheet and one sheet per class, WhatsApp text lists toppers', () => {
  const b = buildBoard({ test: { name: 'Mock 5' }, rows: [row('f', '=SUM(A1)', 77, 30)], students, secondaryMap: secondary })
  assert.ok(csvOf(tableOf(b)).includes("'=SUM(A1)"), 'a formula in a name is neutralised')
  const all = buildBoard({ test: {}, rows, students, secondaryMap: secondary })
  const sheets = workbookSheets({ test: { name: 'Mock 5' }, entries: all, summary: summarize(all, 40), cutoff: 40 })
  assert.deepEqual(sheets.map(s => s.name), ['Summary', 'All results', 'Lakshya A', 'Lakshya B', 'Umeed', 'Combined · Manipuri', 'Combined · English', 'Guest - not in ERP'])
  assert.equal(sheets[1].aoa.length, 1 + 7); assert.equal(sheets[2].aoa.length, 1 + 2)
  const txt = whatsappText({ test: { name: 'Mock 5' }, summary: summarize(all, 40), tops: toppers(all, 3) })
  assert.match(txt, /\*Combined · Manipuri\*/); assert.match(txt, /🥇 Dolly — 38\/40 \(95%\)/)
})
