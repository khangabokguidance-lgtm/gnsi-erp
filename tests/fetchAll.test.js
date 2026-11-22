import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAll } from '../src/lib/missionSainikQuestions.js'

// A fake query: `total` rows with ids 1..total, served by range(from, to) like the database does; counts how many requests were made.
const fake = (total, fail = -1) => { const calls = []; return { calls, make: () => ({ range: async (from, to) => { calls.push([from, to]); if (from === fail) return { data: null, error: { message: 'boom' } }; return { data: Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => ({ id: from + i + 1 })), error: null } } }) } }

test('fetchAll returns every row, in order, for sizes around the page boundaries', async () => {
  for (const total of [0, 1, 999, 1000, 1001, 3999, 4000, 4001, 9000]) {
    const f = fake(total); const { data, error } = await fetchAll(f.make, 1000)
    assert.equal(error, null); assert.equal(data.length, total, 'total ' + total)
    assert.deepEqual(data.map(r => r.id), Array.from({ length: total }, (_, i) => i + 1))
  }
})

test('a list that fits in one page costs exactly one request', async () => {
  const f = fake(300); await fetchAll(f.make, 1000, 4)
  assert.equal(f.calls.length, 1)
})

test('a long list is fetched in parallel batches after the first page (9000 rows: 4 waits instead of 10)', async () => {
  const f = fake(9000); await fetchAll(f.make, 1000, 4)
  assert.equal(f.calls.length, 13)   // first page, then 3 batches of 4 pages; the last batch finds the end
})

test('fetchAll reports an error from any page', async () => {
  const f = fake(9000, 2000); const r = await fetchAll(f.make, 1000)
  assert.equal(r.data, null); assert.equal(r.error.message, 'boom')
})
