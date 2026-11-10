// cbtFinder.js — the filter on the public exam page: All · Open now · Upcoming · Practice · Top 5.
export const FINDER_FILTERS = [['all', 'All'], ['open', 'Open now'], ['upcoming', 'Upcoming'], ['practice', 'Practice'], ['top', 'Top 5']]

/** Splits what cbt_public_tests() returned: open tests (closing soonest first) and upcoming ones (opening soonest first). */
export function splitPublicTests(tests) {
  const t = Array.isArray(tests) ? tests.filter(Boolean) : []
  const at = v => { const x = Date.parse(v); return Number.isFinite(x) ? x : Infinity }
  return {
    open: t.filter(x => x.state !== 'not_open').sort((a, b) => at(a.closesAt) - at(b.closesAt)),
    upcoming: t.filter(x => x.state === 'not_open').sort((a, b) => at(a.opensAt) - at(b.opensAt)),
  }
}

/** Which blocks a filter shows. */
export const showBlocks = filter => ({
  open: filter === 'all' || filter === 'open',
  upcoming: filter === 'all' || filter === 'upcoming',
  practice: filter === 'all' || filter === 'practice',
  top: filter === 'all' || filter === 'top',
})

/** "closed 3 hours ago" — how long ago an exam closed (null when the time is unknown or in the future). */
export function agoText(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t) || t > now + 60000) return null
  const m = Math.max(0, Math.round((now - t) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return d < 14 ? `${d} day${d === 1 ? '' : 's'} ago` : null
}

/** Past exams to practise, newest closed first, with a LATEST tag on the newest and a NEW tag for ones that closed within 24 h. */
export function rankPractice(list, now = Date.now()) {
  const at = v => { const x = Date.parse(v); return Number.isFinite(x) ? x : 0 }
  const sorted = (Array.isArray(list) ? list.filter(Boolean) : []).slice().sort((a, b) => at(b.closedAt) - at(a.closedAt))
  return sorted.map((t, i) => ({ ...t, latest: i === 0 && at(t.closedAt) > 0, isNew: at(t.closedAt) > 0 && now - at(t.closedAt) < 86400000, ago: agoText(t.closedAt, now) }))
}
