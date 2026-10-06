// collectorRole.js — which auth role a fee collector holds, so receipts can
// print "Collected by: Name (Role)". Looked up from portal_users by display
// name or username (case-insensitive) and cached for the session. Never
// throws and never blocks a receipt for long: no match → no role is printed.
import { supabase } from './supabase'

let cache = null
let inflight = null
const norm = v => String(v || '').trim().toLowerCase()

export function roleLabel(role) {
  const r = String(role || '').trim()
  if (!r) return ''
  if (/^hm$/i.test(r)) return 'House Master'
  return r.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function load() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = Promise.resolve(supabase.from('portal_users').select('name, username, role'))
      .then(({ data, error }) => {
        const m = new Map()
        if (error) return m                       // don't cache a failure
        for (const u of data || []) {
          if (!u.role) continue
          for (const k of [u.name, u.username]) if (norm(k) && !m.has(norm(k))) m.set(norm(k), u.role)
        }
        cache = m
        return m
      })
      .catch(() => new Map())
      .finally(() => { inflight = null })
  }
  return inflight
}

// Role label for a collector name/username, or '' when unknown.
export async function collectorRoleFor(name) {
  if (!norm(name)) return ''
  const m = await Promise.race([load(), new Promise(r => setTimeout(() => r(new Map()), 3000))])
  return roleLabel(m.get(norm(name)))
}
