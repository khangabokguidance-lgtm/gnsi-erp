// setMakerBridge.js — connects the Model Set Maker page (public/model-papers/
// navodaya-model-set-maker.html, shown in an iframe by SetMaker.jsx) to Supabase.
//
// The page was built to run on its own and keep the questions staff add in a
// small document store reached through `claude.use(name)`. Inside the portal it
// looks for `window.parent.__gnsiSetMaker` instead, and this module provides it:
//   use('db')        → collection('questions' | 'passages' | 'papers'):
//                      onSnapshot / add / doc(id).delete, backed by the
//                      set_maker_items table (one JSON document per row,
//                      `collection` says which list)
//   use('papers')    → save / open / remove: PDFs kept in the set-maker-papers
//                      bucket, each listed by a row in collection 'papers'
//   use('user')      → canEdit(): the portal's Model Set Maker permission
//   use('downloads') → save({filename, data}): the PDF the page made
//   exportLibs()     → { jsPDF, JSZip, html2canvasUrl } from the portal's own bundle,
//                      used when the CDN copies did not load
//   visionJSON(prompt, images) → the text the AI returns for a page image
//                      (api/gemini.js), used by "Import questions"
// Anything else resolves null.
// No import of ./supabase here: the client is passed in, which keeps this
// testable under `node --test` (tests/setMakerBridge.test.js).
import { rowsToSnapshot, toBridgeError } from './modelSetsBridge.js'

export const SET_MAKER_TABLE = 'set_maker_items'
export const SET_MAKER_COLLECTIONS = ['questions', 'passages', 'papers']
export const SET_MAKER_BUCKET = 'set-maker-papers'
export const MAX_PAPER_BYTES = 20 * 1024 * 1024 // the bucket's own limit (20261045_set_maker_papers.sql)
const PAPER_PATH = /^papers\/[\w-]+\.pdf$/

export function createSetMakerBridge({ client, canWrite = () => false, actor = () => null, exportLibs = null, saveFile = null, vision = null }) {
  const listeners = new Map(SET_MAKER_COLLECTIONS.map((c) => [c, new Set()]))
  let channel = null

  const load = async (path) => {
    const subs = listeners.get(path)
    if (!subs.size) return
    const { data, error } = await client.from(SET_MAKER_TABLE).select('id, data').eq('collection', path).order('created_at', { ascending: true })
    if (error) {
      const e = toBridgeError(error)
      subs.forEach((l) => l.error && l.error(e))
      return
    }
    const snap = rowsToSnapshot(data)
    subs.forEach((l) => l.next(snap))
  }
  const loadAll = () => SET_MAKER_COLLECTIONS.forEach(load)
  const watching = () => [...listeners.values()].some((s) => s.size)
  const openChannel = () => {
    if (channel || typeof client.channel !== 'function') return
    try {
      channel = client.channel('set-maker-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: SET_MAKER_TABLE }, () => { loadAll() })
        .subscribe()
    } catch { channel = null }
  }
  const closeChannel = () => {
    if (!channel || watching()) return
    try { client.removeChannel(channel) } catch { /* already closed */ }
    channel = null
  }

  const denied = () => ({ code: 'not_granted', message: 'Your login is not allowed to change the Model Set Maker questions.' })
  const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`)

  const db = {
    collection(path) {
      if (!listeners.has(path)) throw new TypeError(`Unknown collection "${path}"`)
      return {
        path,
        onSnapshot(next, error) {
          const l = { next, error }
          listeners.get(path).add(l)
          openChannel()
          load(path)
          return () => { listeners.get(path).delete(l); closeChannel() }
        },
        async add(body) {
          if (!canWrite()) throw denied()
          const id = newId()
          const { error } = await client.from(SET_MAKER_TABLE).insert({ id, collection: path, data: body, created_by: actor() || null })
          if (error) throw toBridgeError(error)
          load(path)
          return { id, path: `${path}/${id}` }
        },
        doc(id) {
          const key = String(id)
          return {
            id: key,
            path: `${path}/${key}`,
            async delete() {
              if (!canWrite()) throw denied()
              const { error } = await client.from(SET_MAKER_TABLE).delete().eq('id', key).eq('collection', path)
              if (error) throw toBridgeError(error)
              load(path)
            },
          }
        },
      }
    },
  }

  const user = { canEdit: async () => !!canWrite(), isOwner: async () => false }

  const papers = saveFile ? {
    async save({ filename, data, meta = {} }) {
      if (!canWrite()) throw denied()
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' })
      if (blob.size > MAX_PAPER_BYTES) throw { code: 'too_large', message: 'PDFs must be under 20 MB.' }
      const id = newId()
      const path = `papers/${id}.pdf`
      const { error: upErr } = await client.storage.from(SET_MAKER_BUCKET).upload(path, blob, { upsert: false, contentType: 'application/pdf' })
      if (upErr) throw toBridgeError(upErr)
      const kind = ['paper', 'key', 'omr', 'upload'].includes(meta.kind) ? meta.kind : 'upload'
      const row = {
        filename: String(filename).slice(0, 160), path, size: blob.size, kind, at: Date.now(), by: actor() || null,
        ...(Number.isInteger(meta.setno) ? { setno: meta.setno } : {}), ...(typeof meta.code === 'string' ? { code: meta.code.slice(0, 2) } : {}),
      }
      const { error } = await client.from(SET_MAKER_TABLE).insert({ id, collection: 'papers', data: row, created_by: actor() || null })
      if (error) {
        await client.storage.from(SET_MAKER_BUCKET).remove([path]).catch(() => {})
        throw toBridgeError(error)
      }
      load('papers')
      return { id }
    },
    async open({ path, filename }) {
      if (!PAPER_PATH.test(String(path))) throw { code: 'invalid_argument', message: 'Not a saved paper.' }
      const { data, error } = await client.storage.from(SET_MAKER_BUCKET).download(path)
      if (error || !data) throw { code: 'unavailable', message: error?.message || 'File not found' }
      await saveFile(String(filename || 'paper.pdf'), data)
    },
    async remove({ id, path }) {
      if (!canWrite()) throw denied()
      if (PAPER_PATH.test(String(path))) {
        const { error } = await client.storage.from(SET_MAKER_BUCKET).remove([path])
        if (error) throw toBridgeError(error)
      }
      const { error } = await client.from(SET_MAKER_TABLE).delete().eq('id', String(id)).eq('collection', 'papers')
      if (error) throw toBridgeError(error)
      load('papers')
    },
  } : null

  const downloads = saveFile ? {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data])
      await saveFile(String(filename), blob)
    },
  } : null

  const caps = { db, user, downloads, papers }
  return {
    exportLibs: exportLibs || undefined,
    visionJSON: vision ? (prompt, images) => {
      if (!canWrite()) return Promise.reject(denied())
      return vision(prompt, images)
    } : undefined,
    use: async (name) => caps[name] || null,
  }
}
