// cbtFinder.js — the filter on the public exam page: All · Open now · Upcoming · Practice.
export const FINDER_FILTERS = [['all', 'All'], ['open', 'Open now'], ['upcoming', 'Upcoming'], ['practice', 'Practice']]

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
})
