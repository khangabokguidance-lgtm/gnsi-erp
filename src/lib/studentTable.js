// Sorting for the Students table view. Pure — unit-tested with `npm test`.
// Missing values (no attendance yet, no exam, blank course…) always sort LAST,
// whichever direction is chosen, so the empty rows never crowd the top.

export const COLUMNS = {
  name: s => s.name,
  gcc: s => (s.gcc_no === '' || s.gcc_no == null ? null : Number(s.gcc_no)),
  course: s => s.course,
  house: s => s.house,
  status: s => s.status,
  att: (s, c) => c?.attData?.[s.id],
  dues: (s, c) => c?.feeData?.[s.id]?.dues,
  score: (s, c) => c?.examData?.[s.id]?.[0]?.total,
}

const missing = v => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v))

export function sortStudents(list, key, dir = 'asc', ctx = {}) {
  const get = COLUMNS[key]
  if (!get) return list
  const sign = dir === 'desc' ? -1 : 1
  return list
    .map((s, i) => ({ s, i, v: get(s, ctx) }))
    .sort((a, b) => {
      const am = missing(a.v), bm = missing(b.v)
      if (am || bm) return am && bm ? a.i - b.i : am ? 1 : -1
      const c = typeof a.v === 'number' && typeof b.v === 'number'
        ? a.v - b.v
        : String(a.v).localeCompare(String(b.v), undefined, { sensitivity: 'base', numeric: true })
      return c ? c * sign : a.i - b.i
    })
    .map(x => x.s)
}

// 'asc' -> 'desc' -> back to default order (null) when the same column is clicked again.
export function nextSort(current, key) {
  if (current.key !== key) return { key, dir: 'asc' }
  if (current.dir === 'asc') return { key, dir: 'desc' }
  return { key: null, dir: 'asc' }
}
