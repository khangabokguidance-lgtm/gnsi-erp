// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSetMakerBridge } from '../src/setMakerBridge.js'

// A tiny in-memory stand-in for the parts of the Supabase client the bridge uses.
function fakeClient({ failWrite } = {}) {
  const rows = []
  const calls = []
  const client = {
    rows, calls,
    from(table) {
      assert.equal(table, 'set_maker_items')
      return {
        select() {
          return { eq: (_c, col) => ({ order: async () => ({ data: rows.filter((r) => r.collection === col), error: null }) }) }
        },
        async insert(row) { calls.push(['insert', row]); if (failWrite) return { error: { message: failWrite } }; rows.push(row); return { error: null } },
        delete() {
          return { eq: (_c, id) => ({ eq: async (_c2, col) => {
            calls.push(['delete', id, col])
            const i = rows.findIndex((r) => r.id === id && r.collection === col)
            if (i >= 0) rows.splice(i, 1)
            return { error: null }
          } }) }
        },
      }
    },
  }
  return client
}
const tick = () => new Promise((r) => setTimeout(r, 0))

test('questions and passages are kept apart and reach their own listeners', async () => {
  const client = fakeClient()
  const bridge = createSetMakerBridge({ client, canWrite: () => true, actor: () => 'teacher1' })
  const db = await bridge.use('db')
  const seen = { questions: [], passages: [] }
  db.collection('questions').onSnapshot((s) => { seen.questions = s.docs.map((d) => d.data()) })
  db.collection('passages').onSnapshot((s) => { seen.passages = s.docs.map((d) => d.data()) })
  const ref = await db.collection('questions').add({ section: 'evs', q: 'Q?', o: ['a', 'b', 'c', 'd'], a: 1 })
  await db.collection('passages').add({ text: 'P', qs: [] })
  await tick()
  assert.equal(seen.questions.length, 1)
  assert.equal(seen.questions[0].q, 'Q?')
  assert.equal(seen.passages.length, 1)
  assert.equal(client.calls[0][1].created_by, 'teacher1')
  await db.collection('questions').doc(ref.id).delete()
  await tick()
  assert.equal(seen.questions.length, 0)
  assert.equal(seen.passages.length, 1)
})

test('writes are refused without the add/edit permission, reads still work', async () => {
  const client = fakeClient()
  const bridge = createSetMakerBridge({ client, canWrite: () => false })
  const db = await bridge.use('db')
  await assert.rejects(db.collection('questions').add({ q: 'x' }), (e) => e.code === 'not_granted')
  await assert.rejects(db.collection('questions').doc('a').delete(), (e) => e.code === 'not_granted')
  assert.equal(await (await bridge.use('user')).canEdit(), false)
  assert.equal(client.calls.length, 0)
})

test('unknown collections and capabilities are rejected', async () => {
  const bridge = createSetMakerBridge({ client: fakeClient() })
  const db = await bridge.use('db')
  assert.throws(() => db.collection('sets'), TypeError)
  assert.equal(await bridge.use('assets'), null)
  assert.equal(await bridge.use('downloads'), null) // no saveFile given
})

test('a refused insert surfaces as not_granted', async () => {
  const bridge = createSetMakerBridge({ client: fakeClient({ failWrite: 'new row violates row-level security policy' }), canWrite: () => true })
  const db = await bridge.use('db')
  await assert.rejects(db.collection('passages').add({ text: 't', qs: [] }), (e) => e.code === 'not_granted')
})
