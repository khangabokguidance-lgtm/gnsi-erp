import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── App-wide read cache ───────────────────────────────────────────────────
// Modules often ask the database for exactly the same thing within seconds of
// each other (opening a tab, switching modules, a parent component and its
// child both loading the same list). Identical GET reads to the database API
// now share one download for CACHE_MS, including requests already in flight.
// Any write (insert / update / delete / rpc) through this client clears the
// whole cache first and again once it finishes, so a user always sees their
// own changes at once; changes made by other users show within CACHE_MS.
// Live screens that poll a row must always hit the network: see LIVE_TABLES.
const CACHE_MS = 30 * 1000
const MAX_ENTRIES = 150
const MAX_BODY_BYTES = 3 * 1024 * 1024
const LIVE_TABLES = /\/rest\/v1\/(cast_sessions|store_orders|hm_notifications|push_subscriptions|hm_rollcall_unlock)\b/
const readCache = new Map() // key → { at, promise }

const clearReadCache = () => readCache.clear()

function cacheKeyFor(url, init) {
  const h = new Headers(init?.headers || {})
  return [url, h.get('authorization') || '', h.get('accept') || '', h.get('accept-profile') || '', h.get('prefer') || '', h.get('range') || '', h.get('range-unit') || ''].join('|')
}

const toResponse = snap => new Response(snap.body.slice(0), { status: snap.status, statusText: snap.statusText, headers: snap.headers })

function cachingFetch(input, init) {
  const url = typeof input === 'string' ? input : (input?.url || String(input))
  if (!url.includes('/rest/v1/') || typeof Response === 'undefined') return fetch(input, init)
  const method = String(init?.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()

  if (method !== 'GET') {
    clearReadCache()
    return fetch(input, init).then(res => { clearReadCache(); return res }, err => { clearReadCache(); throw err })
  }
  if (init?.signal || LIVE_TABLES.test(url)) return fetch(input, init)

  const key = cacheKeyFor(url, init)
  const hit = readCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return hit.promise.then(snap => (snap ? toResponse(snap) : fetch(input, init)))
  }
  const promise = fetch(input, init).then(async res => {
    const body = await res.arrayBuffer()
    const snap = { status: res.status, statusText: res.statusText, headers: [...res.headers.entries()], body }
    if (!res.ok || body.byteLength > MAX_BODY_BYTES) { readCache.delete(key); }
    return snap
  }, err => { readCache.delete(key); throw err })
  if (readCache.size >= MAX_ENTRIES) readCache.delete(readCache.keys().next().value)
  readCache.set(key, { at: Date.now(), promise })
  return promise.then(toResponse)
}

const client = createClient(supabaseUrl, supabaseKey, { global: { fetch: cachingFetch } })

// Anything that writes to `students` through this client tells the shared
// roster cache (studentQueries.js) to drop its copy, so the next read is fresh.
const studentWriteListeners = new Set()
export const onStudentsWrite = fn => { studentWriteListeners.add(fn); return () => studentWriteListeners.delete(fn) }
const notifyStudentsWrite = () => studentWriteListeners.forEach(fn => { try { fn() } catch { /* listener errors never block a write */ } })

const baseFrom = client.from.bind(client)
client.from = table => {
  const builder = baseFrom(table)
  if (table !== 'students') return builder
  for (const method of ['insert', 'update', 'upsert', 'delete']) {
    const original = builder[method]?.bind(builder)
    if (!original) continue
    builder[method] = (...args) => {
      const query = original(...args)
      notifyStudentsWrite()
      const then = query.then.bind(query)
      query.then = (onOk, onErr) => then(value => { notifyStudentsWrite(); return onOk ? onOk(value) : value }, onErr)
      return query
    }
  }
  return builder
}

export const supabase = client
