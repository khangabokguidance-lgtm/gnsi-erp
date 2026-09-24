// ════════════════════════════════════════════════════════════════════════
//  GNSI · Private file links (works everywhere, no per-screen changes)
//  Files in the private buckets below are stored in the database as normal
//  ".../object/public/<bucket>/<path>" links. Once the buckets are private
//  those links stop working, so this module watches the page and swaps
//  every such <img src> / <a href> for a short-lived SIGNED link, using
//  whoever is signed in (staff session first, then parent session).
//  Import once:  import './privateFiles'   (App.jsx and ParentsPortal.jsx)
// ════════════════════════════════════════════════════════════════════════
import { supabase } from './supabase'
import { parentSupabase } from './parentSupabase'

export const PRIVATE_BUCKETS = ['hr-attachments', 'kitchen-receipts', 'staff-locker-files', 'student-photos', 'teaching-evidence']

const RX = new RegExp('/storage/v1/object/(?:public|sign)/(' + PRIVATE_BUCKETS.map(b => b.replace(/[-]/g, '\\-')).join('|') + ')/([^?#]+)')
const TTL = 60 * 60            // seconds a signed link stays valid
const cache = new Map()        // "bucket/path" -> { url, exp }
const pending = new Map()

export function parsePrivateUrl(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(RX)
  if (!m) return null
  if (url.includes('/object/sign/') && /[?&]token=/.test(url)) return null   // already signed
  return { bucket: m[1], path: decodeURIComponent(m[2]) }
}

async function clientWithSession() {
  try { const { data } = await supabase.auth.getSession(); if (data?.session) return supabase } catch (_) {}
  try { const { data } = await parentSupabase.auth.getSession(); if (data?.session) return parentSupabase } catch (_) {}
  return supabase
}

// Public API: turn any stored file link into one that works. Non-private links pass through.
export async function signedUrl(url) {
  const p = parsePrivateUrl(url)
  if (!p) return url
  const key = p.bucket + '/' + p.path
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now() + 60_000) return hit.url
  if (pending.has(key)) return pending.get(key)
  const job = (async () => {
    try {
      const c = await clientWithSession()
      const { data, error } = await c.storage.from(p.bucket).createSignedUrl(p.path, TTL)
      if (error || !data?.signedUrl) return url
      cache.set(key, { url: data.signedUrl, exp: Date.now() + TTL * 1000 })
      return data.signedUrl
    } catch (_) { return url } finally { pending.delete(key) }
  })()
  pending.set(key, job)
  return job
}

// ── automatic swapping on the page ──────────────────────────────────────
function fixImg(img) {
  const src = img.getAttribute('src')
  if (!parsePrivateUrl(src) || img.dataset.gnsiSigning === src) return
  img.dataset.gnsiSigning = src
  signedUrl(src).then(u => { if (u && u !== src && img.getAttribute('src') === src) { img.dataset.gnsiOrig = src; img.setAttribute('src', u) } })
}
function scan(root) {
  if (!root || root.nodeType !== 1) return
  if (root.tagName === 'IMG') fixImg(root)
  root.querySelectorAll?.('img[src*="/storage/v1/object/"]').forEach(fixImg)
}

if (typeof window !== 'undefined' && !window.__gnsiPrivateFiles) {
  window.__gnsiPrivateFiles = true
  const start = () => {
    scan(document.body)
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'attributes') { if (m.target.tagName === 'IMG') fixImg(m.target) }
        else m.addedNodes.forEach(scan)
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })

    // Links (View / Download buttons): sign on click
    document.addEventListener('click', e => {
      const a = e.target?.closest?.('a[href]')
      if (!a || !parsePrivateUrl(a.href)) return
      e.preventDefault(); e.stopPropagation()
      const w = window.open('', a.target === '_self' ? '_self' : '_blank')
      signedUrl(a.href).then(u => { if (w) w.location.href = u; else window.location.href = u })
    }, true)

    // window.open(fileUrl) calls
    const origOpen = window.open.bind(window)
    window.open = (url, ...rest) => {
      if (parsePrivateUrl(String(url || ''))) {
        const w = origOpen('', ...rest)
        signedUrl(String(url)).then(u => { if (w) w.location.href = u })
        return w
      }
      return origOpen(url, ...rest)
    }
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start)
}
