// setMakerBridge.js — connects the Model Set Maker page (public/model-papers/
// navodaya-model-set-maker.html, shown in an iframe by SetMaker.jsx) to Supabase.
//
// The page was built to run on its own and keep the questions staff add in a
// small document store reached through `claude.use(name)`. Inside the portal it
// looks for `window.parent.__gnsiSetMaker` instead, and this module provides it:
//   use('db')        → collection('questions' | 'passages'): onSnapshot / add /
//                      doc(id).delete, backed by the set_maker_items table
//                      (one JSON document per row, `collection` says which list)
//   use('user')      → canEdit(): the portal's Model Set Maker permission
//   use('downloads') → save({filename, data}): the PDF the page made
//   exportLibs()     → { jsPDF, html2canvasUrl } from the portal's own bundle,
//                      used when the CDN copies did not load
// Anything else resolves null.
// No import of ./supabase here: the client is passed in, which keeps this
// testable under `node --test` (tests/setMakerBridge.test.js).
import { rowsToSnapshot, toBridgeError } from './modelSetsBridge.js'

export const SET_MAKER_TABLE = 'set_maker_items'
export const SET_MAKER_COLLECTIONS = ['questions', 'passages']

export function createSetMakerBridge({ client, canWrite = () => false, actor = () => null, exportLibs = null, saveFile = null }) {
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

  const downloads = saveFile ? {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data])
      await saveFile(String(filename), blob)
    },
  } : null

  const caps = { db, user, downloads }
  return {
    exportLibs: exportLibs || undefined,
    use: async (name) => caps[name] || null,
  }
}
