// Tests for the Exams module's URL-safe mark fetching (src/examShared.js).
import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMarksChunked } from '../src/examShared.js'

// Minimal fake of supabase.from().select().in().in().eq() that records each call.
function fakeSupabase(calls, failOn) {
  return {
    from() {
      const call = { in: {}, eq: {} }
      calls.push(call)
      const q = {
        select(cols) { call.cols = cols; return q },
        in(k, v) { call.in[k] = v; return q },
        eq(k, v) { call.eq[k] = v; return q },
        then(res) {
          const error = failOn && call.in.student_id.includes(failOn) ? { message: 'boom' } : null
          res({ data: error ? null : call.in.student_id.map(id => ({ student_id: id })), error })
        },
      }
      return q
    },
  }
}

test('splits large id lists into chunks and merges results', async () => {
  const calls = []
  const ids = Array.from({ length: 250 }, (_, i) => `s${i}`)
  const { data, error } = await fetchMarksChunked(fakeSupabase(calls), ids, ['e1'], { match: { exam_type_id: 't1' } })
  assert.equal(error, null)
  assert.equal(calls.length, 4)                       // 80 + 80 + 80 + 10
  assert.ok(calls.every(c => c.in.student_id.length <= 80))
  assert.ok(calls.every(c => c.eq.exam_type_id === 't1'))
  assert.equal(data.length, 250)
})

test('empty inputs return nothing without calling the database', async () => {
  const calls = []
  assert.deepEqual(await fetchMarksChunked(fakeSupabase(calls), [], ['e1']), { data: [], error: null })
  assert.deepEqual(await fetchMarksChunked(fakeSupabase(calls), ['s1'], []), { data: [], error: null })
  assert.equal(calls.length, 0)
})

test('reports an error if any chunk fails', async () => {
  const ids = Array.from({ length: 100 }, (_, i) => `s${i}`)
  const { error } = await fetchMarksChunked(fakeSupabase([], 's90'), ids, ['e1'])
  assert.equal(error.message, 'boom')
})
