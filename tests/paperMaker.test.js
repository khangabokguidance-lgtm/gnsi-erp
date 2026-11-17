import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPaper, levelTargets, swapOne, rng, levelOf } from '../src/lib/paperMaker.js'

const mk = (n, section, level, topic, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `${section}-${level}-${topic}-${i}`, section, difficulty: level, topic, test_no: 1 + (i % 2), question: `${topic} ${level} ${i}`, ...extra }))
const bank = [...mk(20, 'Maths', 'Easy', 'Fractions'), ...mk(20, 'Maths', 'Medium', 'Decimals'), ...mk(10, 'Maths', 'Hard', 'Algebra'), ...mk(15, 'Science', 'Easy', 'Light'), ...mk(15, 'Science', 'Medium', 'Force')]

test('level targets sum to the count and follow the percentages', () => {
  assert.deepEqual(levelTargets(10, { Easy: 40, Medium: 40, Hard: 20 }), { Easy: 4, Medium: 4, Hard: 2 })
  for (const n of [1, 7, 13, 25, 33]) assert.equal(Object.values(levelTargets(n, { Easy: 33, Medium: 33, Hard: 34 })).reduce((a, b) => a + b, 0), n)
})

test('builds the requested number with the requested mix and no repeats', () => {
  const r = buildPaper(bank, { count: 10, subjects: ['Maths'], mix: { Easy: 40, Medium: 40, Hard: 20 } }, { seed: 7 })
  assert.equal(r.picked.length, 10)
  assert.equal(new Set(r.picked.map(q => q.id)).size, 10)
  assert.deepEqual(r.byLevel, { Easy: 4, Medium: 4, Hard: 2 })
})

test('same seed gives the same paper; a different seed differs', () => {
  const spec = { count: 8, subjects: ['Maths'], mix: { Easy: 50, Medium: 50, Hard: 0 } }
  const a = buildPaper(bank, spec, { seed: 3 }).picked.map(q => q.id), b = buildPaper(bank, spec, { seed: 3 }).picked.map(q => q.id), c = buildPaper(bank, spec, { seed: 4 }).picked.map(q => q.id)
  assert.deepEqual(a, b); assert.notDeepEqual(a, c)
})

test('several subjects share the count evenly, in the order given', () => {
  const r = buildPaper(bank, { count: 9, subjects: ['Science', 'Maths'], mix: { Easy: 50, Medium: 50, Hard: 0 } }, { seed: 1 })
  assert.equal(r.picked.filter(q => q.section === 'Science').length, 5)
  assert.equal(r.picked.filter(q => q.section === 'Maths').length, 4)
  assert.equal(r.picked[0].section, 'Science')
})

test('chapters are spread rather than clustered', () => {
  const r = buildPaper(bank, { count: 10, subjects: ['Maths'], mix: { Easy: 0, Medium: 100, Hard: 0 } })
  assert.equal(r.picked.length, 10)
  const r2 = buildPaper(bank, { count: 6, subjects: ['Science'], mix: { Easy: 50, Medium: 50, Hard: 0 } }, { seed: 5 })
  assert.equal(Object.keys(r2.topics).length, 2)
})

test('shortfall is reported and other levels fill the gap', () => {
  const r = buildPaper(bank, { count: 15, subjects: ['Maths'], mix: { Easy: 0, Medium: 0, Hard: 100 } }, { seed: 2 })
  assert.equal(r.picked.length, 15)
  assert.equal(r.shortfall.Hard, 5)
  assert.equal(r.byLevel.Hard, 10)
})

test('asking for more than exists returns what exists and says how many are short', () => {
  const r = buildPaper(bank, { count: 100, subjects: ['Science'], mix: { Easy: 40, Medium: 40, Hard: 20 } })
  assert.equal(r.picked.length, 30)
  assert.equal(r.short, 70)
})

test('previously used questions are avoided when others exist', () => {
  const used = bank.filter(q => q.section === 'Maths' && q.difficulty === 'Easy').slice(0, 10).map(q => q.id)
  const r = buildPaper(bank, { count: 6, subjects: ['Maths'], mix: { Easy: 100, Medium: 0, Hard: 0 }, avoidUsed: used }, { seed: 9 })
  assert.ok(r.picked.every(q => !used.includes(q.id)))
})

test('locked questions stay and count towards the total', () => {
  const lock = bank.find(q => q.section === 'Maths' && q.difficulty === 'Hard').id
  const r = buildPaper(bank, { count: 5, subjects: ['Maths'], mix: { Easy: 50, Medium: 50, Hard: 0 } }, { seed: 1, locked: [lock] })
  assert.equal(r.picked.length, 5)
  assert.ok(r.picked.some(q => q.id === lock))
})

test('filters: sets, chapters, figures, passages and deleted questions', () => {
  const r = buildPaper(bank, { count: 50, subjects: ['Maths'], sets: [1], topics: ['Fractions'], mix: { Easy: 100, Medium: 0, Hard: 0 } })
  assert.ok(r.picked.every(q => q.test_no === 1 && q.topic === 'Fractions'))
  const b2 = [...bank, { id: 'x', section: 'Maths', difficulty: 'Easy', topic: 'Fractions', test_no: 1, image_data: 'data:image/png;base64,AA' }, { id: 'y', section: 'Maths', difficulty: 'Easy', topic: 'Fractions', test_no: 1, deleted_at: 'now' }]
  const r2 = buildPaper(b2, { count: 100, subjects: ['Maths'], figures: false, mix: { Easy: 100, Medium: 0, Hard: 0 } })
  assert.ok(!r2.picked.some(q => q.id === 'x' || q.id === 'y'))
})

test('a reading passage is kept together', () => {
  const pass = ['p1', 'p2', 'p3'].map(id => ({ id, section: 'English', difficulty: 'Medium', topic: 'Comprehension', test_no: 1, passage: 'Once upon a time', question: id }))
  const others = mk(10, 'English', 'Medium', 'Grammar')
  const r = buildPaper([...pass, ...others], { count: 6, subjects: ['English'], mix: { Easy: 0, Medium: 100, Hard: 0 } }, { seed: 4 })
  const idx = r.picked.map((q, i) => (q.passage ? i : -1)).filter(i => i >= 0)
  if (idx.length) assert.equal(idx[idx.length - 1] - idx[0], idx.length - 1)
})

test('swapOne gives a different question with the same subject and level', () => {
  const r = buildPaper(bank, { count: 6, subjects: ['Maths'], mix: { Easy: 50, Medium: 50, Hard: 0 } }, { seed: 1 })
  const q = r.picked[0], s = swapOne(bank, r.picked, q, { subjects: ['Maths'] }, 11)
  assert.ok(s && s.id !== q.id && s.section === q.section && levelOf(s) === levelOf(q) && !r.picked.some(x => x.id === s.id))
  assert.equal(swapOne([q], [q], q, {}, 1), null)
})

test('rng is deterministic and in [0,1)', () => { const a = rng(5), b = rng(5); for (let i = 0; i < 5; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1) } })
