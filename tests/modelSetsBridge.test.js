// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { createModelSetsBridge, rowsToSnapshot, toBridgeError } from '../src/modelSetsBridge.js'

// A tiny in-memory stand-in for the parts of the Supabase client the bridge uses.
function fakeClient({ failWrite } = {}) {
  const rows = new Map()
  const calls = []
  const client = {
    rows, calls,
    from(table) {
      assert.equal(table, 'model_sets')
      return {
        select() { return { order: async () => ({ data: [...rows.values()], error: null }) } },
        async upsert(row) { calls.push(['upsert', row]); if (failWrite) return { error: { message: failWrite } }; rows.set(row.id, row); return { error: null } },
        delete() { return { eq: async (_c, id) => { calls.push(['delete', id]); rows.delete(id); return { error: null } } } },
      }
    },
    storage: {
      from: (bucket) => ({
        upload: async (path) => { calls.push(['upload', bucket, path]); return { error: null } },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
  }
  return client
}
const tick = () => new Promise((r) => setTimeout(r, 0))

test('rowsToSnapshot keeps object documents and drops malformed rows', () => {
  const snap = rowsToSnapshot([{ id: 'a', data: { title: 'A' } }, { id: 'b', data: null }, { id: 'c', data: [1] }, null])
  assert.equal(snap.size, 1)
  assert.equal(snap.docs[0].id, 'a')
  assert.deepEqual(snap.docs[0].data(), { title: 'A' })
})

test('toBridgeError maps refused writes and oversized sets to the codes the page understands', () => {
  assert.equal(toBridgeError({ message: 'new row violates row-level security policy for table "model_sets"' }).code, 'not_granted')
  assert.equal(toBridgeError({ message: 'violates check constraint "model_sets_data_size"' }).code, 'invalid_argument')
  assert.equal(toBridgeError({ message: 'Failed to fetch' }).code, 'unavailable')
})

test('a saved set reaches every subscriber, and delete removes it', async () => {
  const client = fakeClient()
  const bridge = createModelSetsBridge({ client, canWrite: () => true, actor: () => 'teacher1' })
  const db = await bridge.use('db')
  const seen = []
  const off = db.collection('sets').onSnapshot((s) => seen.push(s.docs.map((d) => d.id)))
  await tick()
  assert.deepEqual(seen.at(-1), [])
  await db.collection('sets').doc('s1').set({ title: 'Set 2', sections: [] })
  await tick()
  assert.deepEqual(seen.at(-1), ['s1'])
  assert.equal(client.rows.get('s1').updated_by, 'teacher1')
  await db.collection('sets').doc('s1').delete()
  await tick()
  assert.deepEqual(seen.at(-1), [])
  off()
})

test('without the Model Sets add/edit permission nothing is written and uploads are hidden', async () => {
  const client = fakeClient()
  const bridge = createModelSetsBridge({ client, canWrite: () => false })
  const db = await bridge.use('db')
  await assert.rejects(db.collection('sets').doc('s1').set({ title: 'x' }), { code: 'not_granted' })
  assert.equal(client.calls.length, 0)
  assert.equal(await bridge.use('assets'), null)
  assert.equal(await (await bridge.use('user')).canEdit(), false)
  assert.equal(await bridge.use('sample'), null)
})

test('a refused database write surfaces as not_granted', async () => {
  const bridge = createModelSetsBridge({ client: fakeClient({ failWrite: 'new row violates row-level security policy' }), canWrite: () => true })
  const db = await bridge.use('db')
  await assert.rejects(db.collection('sets').doc('s1').set({ title: 'x' }), { code: 'not_granted' })
})

test('pictures go to question-diagrams/model-sets and come back as a public link', async () => {
  const client = fakeClient()
  const assets = await createModelSetsBridge({ client, canWrite: () => true }).use('assets')
  const r = await assets.upload({ size: 1000, type: 'image/webp' })
  const [, bucket, path] = client.calls[0]
  assert.equal(bucket, 'question-diagrams')
  assert.match(path, /^model-sets\/ms_\d+_.+\.webp$/)
  assert.match(r.id, /^https:\/\/.+\/question-diagrams\/model-sets\//)
  await assert.rejects(assets.upload({ size: 1000, type: 'image/svg+xml' }), { code: 'unsupported_type' })
  await assert.rejects(assets.upload({ size: 6 * 1024 * 1024, type: 'image/png' }), { code: 'too_large' })
})
