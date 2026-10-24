// modelSetsBridge.js — connects the Model Sets page (public/model-papers/
// jnv-practice-set-1.html, shown in an iframe by ModelSets.jsx) to Supabase.
//
// The page was built to run as a stand-alone paper that keeps its sets in a
// small document store reached through `claude.use(name)`. When it runs inside
// the portal it looks for `window.parent.__gnsiModelSets` instead, and this
// module provides that object with the same three pieces the page uses:
//   use('db')     → collection('sets'): onSnapshot / doc(id).set / doc(id).delete
//                   backed by the model_sets table (one JSON document per set)
//   use('user')   → canEdit(): the portal's Model Sets permission
//   use('assets') → upload(blob): pictures into the question-diagrams bucket
//   use('downloads') → save({filename, data}): the PDF / Word file the page made
//   exportLibs()  → { jsPDF, docx, html2canvasUrl } from the portal's own bundle,
//                   so Download PDF / Word works without the CDN
//   visionJSON(prompt, images) → the text Gemini returns for page images
//                   (api/gemini.js with page images), used by "Import paper"
//   translateMM(texts, onProgress) → the same texts in Manipuri (Unicode Meetei
//                   Mayek), from mayekTranslate.js; the page draws them in BMEI04
// Anything else resolves null, so the page hides that feature.
// No import of ./supabase here: the client is passed in, which keeps this
// testable under `node --test` (tests/modelSetsBridge.test.js).

export const MODEL_SETS_TABLE = 'model_sets'
export const MODEL_SETS_BUCKET = 'question-diagrams'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // the bucket's own limit (20260925_qbank_rls.sql)
const IMAGE_EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }

// Supabase rows → the snapshot shape the page reads: docs[].id and docs[].data()
export function rowsToSnapshot(rows) {
  const docs = (rows || [])
    .filter((r) => r && r.id && r.data && typeof r.data === 'object' && !Array.isArray(r.data))
    .map((r) => ({ id: String(r.id), exists: true, data: () => r.data }))
  return { docs, size: docs.length, empty: docs.length === 0 }
}

// Supabase error → the error codes the page branches on
export function toBridgeError(error) {
  const msg = String(error?.message || error || '')
  if (/row-level security|permission denied|not allowed|jwt/i.test(msg)) return { code: 'not_granted', message: msg }
  if (/model_sets_data_size|too large|payload/i.test(msg)) return { code: 'invalid_argument', message: msg }
  return { code: 'unavailable', message: msg }
}

export function createModelSetsBridge({ client, canWrite = () => false, actor = () => null, storeLabel = 'Shared with GNSI staff', exportLibs = null, saveFile = null, vision = null, translate = null }) {
  const listeners = new Set()
  let channel = null

  const load = async () => {
    const { data, error } = await client.from(MODEL_SETS_TABLE).select('id, data').order('updated_at', { ascending: false })
    if (error) {
      const e = toBridgeError(error)
      listeners.forEach((l) => l.error && l.error(e))
      return
    }
    const snap = rowsToSnapshot(data)
    listeners.forEach((l) => l.next(snap))
  }
  const openChannel = () => {
    if (channel || typeof client.channel !== 'function') return
    try {
      channel = client.channel('model-sets-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: MODEL_SETS_TABLE }, () => { load() })
        .subscribe()
    } catch { channel = null }
  }
  const closeChannel = () => {
    if (!channel || listeners.size) return
    try { client.removeChannel(channel) } catch { /* already closed */ }
    channel = null
  }

  const denied = () => ({ code: 'not_granted', message: 'Your login is not allowed to change model sets.' })

  const db = {
    collection(path) {
      if (path !== 'sets') throw new TypeError(`Unknown collection "${path}"`)
      return {
        path,
        onSnapshot(next, error) {
          const l = { next, error }
          listeners.add(l)
          openChannel()
          load()
          return () => { listeners.delete(l); closeChannel() }
        },
        doc(id) {
          const key = String(id)
          return {
            id: key,
            path: `sets/${key}`,
            async set(body) {
              if (!canWrite()) throw denied()
              const { error } = await client.from(MODEL_SETS_TABLE).upsert({
                id: key, data: body, updated_by: actor() || null, updated_at: new Date().toISOString(),
              })
              if (error) throw toBridgeError(error)
              load()
            },
            async delete() {
              if (!canWrite()) throw denied()
              const { error } = await client.from(MODEL_SETS_TABLE).delete().eq('id', key)
              if (error) throw toBridgeError(error)
              load()
            },
          }
        },
      }
    },
  }

  const assets = {
    async upload(blob, options = {}) {
      if (!canWrite()) throw denied()
      const type = options.type || blob?.type || ''
      const ext = IMAGE_EXT[type]
      if (!ext) throw { code: 'unsupported_type', message: 'Use a PNG, JPEG, WebP or GIF picture.' }
      if (blob.size > MAX_IMAGE_BYTES) throw { code: 'too_large', message: 'Pictures must be under 5 MB.' }
      const rand = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2)
      const path = `model-sets/ms_${Date.now()}_${rand}.${ext}`
      const { error } = await client.storage.from(MODEL_SETS_BUCKET).upload(path, blob, { upsert: false, contentType: type })
      if (error) throw { code: 'upstream_error', message: error.message }
      const { data } = client.storage.from(MODEL_SETS_BUCKET).getPublicUrl(path)
      return { id: data.publicUrl, url: data.publicUrl, sizeBytes: blob.size, contentType: type }
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
    storeLabel,
    theme: 'light',
    exportLibs: exportLibs || undefined,
    visionJSON: vision ? (prompt, images) => {
      if (!canWrite()) return Promise.reject({ code: 'not_granted', message: 'Your login is not allowed to change model sets.' })
      return vision(prompt, images)
    } : undefined,
    translateMM: translate ? (texts, onProgress) => {
      if (!canWrite()) return Promise.reject({ code: 'not_granted', message: 'Your login is not allowed to change model sets.' })
      return translate(texts, onProgress)
    } : undefined,
    use: async (name) => (name === 'assets' ? (canWrite() ? assets : null) : caps[name] || null),
  }
}
