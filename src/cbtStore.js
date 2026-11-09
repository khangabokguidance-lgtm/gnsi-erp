// cbtStore.js — where CBT tests and attempts are kept: this browser's IndexedDB (a test with its figure
// pictures is a few MB, more than localStorage allows). Falls back to memory if IndexedDB is unavailable.
// Tests and results stay on the computer used; move a test with Export / Import file.
const DB = 'gnsi-cbt'
const mem = { tests: new Map(), attempts: new Map() }
let dbp = null

const open = () => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  dbp ||= new Promise(resolve => {
    try {
      const r = indexedDB.open(DB, 1)
      r.onupgradeneeded = () => {
        r.result.createObjectStore('tests', { keyPath: 'id' })
        r.result.createObjectStore('attempts', { keyPath: 'id' }).createIndex('testId', 'testId')
      }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
  return dbp
}

const run = async (store, mode, fn) => {
  const db = await open()
  if (!db) return null
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(req?.result ?? null)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

const all = async store => (await run(store, 'readonly', s => s.getAll())) ?? [...mem[store].values()]
const put = async (store, v) => { if ((await run(store, 'readwrite', s => s.put(v))) === null && !(await open())) mem[store].set(v.id, v) }
const del = async (store, id) => { if ((await run(store, 'readwrite', s => s.delete(id))) === null && !(await open())) mem[store].delete(id) }

export const cbtStore = {
  listTests: async () => (await all('tests')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  getTest: async id => (await all('tests')).find(t => t.id === id) || null,
  saveTest: t => put('tests', t),
  deleteTest: async id => { await del('tests', id); for (const a of await cbtStore.listAttempts(id)) await del('attempts', a.id) },
  listAttempts: async testId => (await all('attempts')).filter(a => !testId || a.testId === testId).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)),
  saveAttempt: a => put('attempts', a),
  deleteAttempt: id => del('attempts', id),
}

export const newTestId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
