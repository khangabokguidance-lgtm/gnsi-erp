// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSetMakerBridge } from '../src/setMakerBridge.js'

// A tiny in-memory stand-in for the parts of the Supabase client the bridge uses.
function fakeClient({ failWrite, failUpload } = {}) {
  const rows = []
  const files = new Map()
  const calls = []
  const client = {
    rows, calls, files,
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
    storage: {
      from: (bucket) => ({
        upload: async (path, blob, opts) => { calls.push(['upload', bucket, path, opts.contentType]); if (failUpload) return { error: { message: failUpload } }; files.set(path, blob); return { error: null } },
        download: async (path) => (files.has(path) ? { data: files.get(path), error: null } : { data: null, error: { message: 'Object not found' } }),
        remove: async (paths) => { calls.push(['remove', bucket, ...paths]); paths.forEach((x) => files.delete(x)); return { error: null } },
      }),
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

test('papers: a PDF is uploaded, listed, downloaded and deleted', async () => {
  const client = fakeClient()
  const saved = []
  const bridge = createSetMakerBridge({ client, canWrite: () => true, actor: () => 'teacher1', saveFile: async (name, blob) => saved.push([name, blob.size]) })
  const db = await bridge.use('db')
  const papers = await bridge.use('papers')
  let list = []
  db.collection('papers').onSnapshot((s) => { list = s.docs.map((d) => ({ id: d.id, ...d.data() })) })
  await papers.save({ filename: 'Set-01-A.pdf', data: new Blob(['%PDF-1.4 x']), meta: { kind: 'paper', setno: 1, code: 'A' } })
  await tick()
  assert.equal(list.length, 1)
  assert.match(list[0].path, /^papers\/[\w-]+\.pdf$/)
  assert.equal(list[0].kind, 'paper')
  assert.equal(list[0].by, 'teacher1')
  assert.equal(client.calls.find((c) => c[0] === 'upload')[1], 'set-maker-papers')
  await papers.open(list[0])
  assert.deepEqual(saved, [['Set-01-A.pdf', 10]])
  await papers.remove(list[0])
  await tick()
  assert.equal(list.length, 0)
  assert.equal(client.files.size, 0)
})

test('papers: refused without permission, and a failed upload leaves no row', async () => {
  const ro = createSetMakerBridge({ client: fakeClient(), canWrite: () => false, saveFile: async () => {} })
  await assert.rejects((await ro.use('papers')).save({ filename: 'x.pdf', data: new Blob(['x']) }), (e) => e.code === 'not_granted')
  const client = fakeClient({ failUpload: 'new row violates row-level security policy' })
  const bridge = createSetMakerBridge({ client, canWrite: () => true, saveFile: async () => {} })
  await assert.rejects((await bridge.use('papers')).save({ filename: 'x.pdf', data: new Blob(['x']) }), (e) => e.code === 'not_granted')
  assert.equal(client.rows.length, 0)
  await assert.rejects((await bridge.use('papers')).open({ path: '../secret.pdf' }), (e) => e.code === 'invalid_argument')
})

test('visionJSON is only lent to users who may add questions', async () => {
  const vision = async (prompt, images) => `read ${images.length}`
  const yes = createSetMakerBridge({ client: fakeClient(), canWrite: () => true, vision })
  assert.equal(await yes.visionJSON('p', [{}]), 'read 1')
  const no = createSetMakerBridge({ client: fakeClient(), canWrite: () => false, vision })
  await assert.rejects(no.visionJSON('p', [{}]), (e) => e.code === 'not_granted')
  assert.equal(createSetMakerBridge({ client: fakeClient() }).visionJSON, undefined)
})
