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
