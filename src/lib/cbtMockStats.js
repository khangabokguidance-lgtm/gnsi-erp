// cbtMockStats.js — the "👁 views · students appeared" counters of the static mock tests. Pure helpers.
// A mock runs in the browser and saves nothing; only two tiny counters are sent: one view per device per day,
// one "appeared" per device per mock (so a refresh or a second attempt does not count again).
export const DAY_MS = 24 * 60 * 60 * 1000
export const YEAR_MS = 365 * DAY_MS

/** True the first time (or after `ttl` ms); remembers it in `store` (a localStorage-like object). Fails open: no storage → count. */
export function countOnce(store, key, now = Date.now(), ttl = DAY_MS) {
  try {
    const last = Number(store.getItem(key))
    if (last && now - last < ttl) return false
    store.setItem(key, String(now))
  } catch { /* storage blocked: count it */ }
  return true
}

export const fmtCount = n => Number(n || 0).toLocaleString('en-IN')

/** → { views, starts } for a slug from the { slug: { views, starts } } map, or null when there is nothing to show yet. */
export function statsOf(map, slug) {
  const s = map && map[slug]
  if (!s) return null
  const views = Math.max(0, Number(s.views) || 0), starts = Math.max(0, Number(s.starts) || 0)
  return views || starts ? { views, starts } : null
}

/** "1,234 views" / "56 students appeared" with correct singular forms. */
export const viewsText = n => `${fmtCount(n)} view${n === 1 ? '' : 's'}`
export const appearedText = n => `${fmtCount(n)} student${n === 1 ? '' : 's'} appeared`

// ── GCC practice limit ──
/** The key a practice is counted under: the mock's slug, or practice-<exam id> for a past exam. */
export const practiceKey = (kind, id) => (kind === 'exam' ? `practice-${String(id || '').toLowerCase().replace(/[^a-z0-9-]/g, '')}` : String(id || ''))
/** Digits only, no leading zeros — how the database compares GCC numbers. */
export const gccDigits = v => String(v || '').replace(/\D/g, '').replace(/^0+/, '')
export const gccValid = v => { const g = gccDigits(v); return g.length > 0 && g.length <= 12 }
/** "2 tries left" / "last try" for the line under the GCC box. */
export const triesText = left => (left <= 0 ? 'That was your last try for this test.' : left === 1 ? '1 try left for this test.' : `${left} tries left for this test.`)
/** Staff list: one row per GCC + test with the number of tries and the latest time. rows = [{ gcc, slug, started_at }] */
export function summarisePractice(rows) {
  const by = new Map()
  for (const r of rows || []) {
    const k = `${r.gcc}\u0001${r.slug}`
    const cur = by.get(k) || { gcc: r.gcc, slug: r.slug, tries: 0, last: '' }
    cur.tries += 1
    if (!cur.last || r.started_at > cur.last) cur.last = r.started_at
    by.set(k, cur)
  }
  return [...by.values()].sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
}
