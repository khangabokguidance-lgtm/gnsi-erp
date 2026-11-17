// Find a staff member's designation from the portal's staff list, given the name a material was saved under
// (usually "Sir Sumanta" or a full name). Matches the full name first, then the first name.
const TITLES = new Set(['sir', 'miss', 'mr', 'mrs', 'ms', 'dr', 'madam', 'mam'])
const tokens = n => String(n || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t && !TITLES.has(t))

export function findStaff(directory, name) {
  const want = tokens(name)
  if (!want.length || !Array.isArray(directory)) return null
  const rows = directory.map(s => ({ s, t: tokens(s.name) })).filter(x => x.t.length)
  const exact = rows.filter(x => x.t.join(' ') === want.join(' '))
  if (exact.length === 1) return exact[0].s
  const first = rows.filter(x => x.t.includes(want[0]) || want.some(w => x.t[0] === w))
  return first.length === 1 ? first[0].s : (exact[0]?.s || null)     // an ambiguous first name returns nothing rather than a wrong person
}

export const creatorOf = (directory, name) => {
  const s = findStaff(directory, name)
  return { name: name || '', designation: s?.designation || s?.department || '' }
}

export const initials = name => tokens(name).slice(0, 2).map(t => t[0].toUpperCase()).join('') || '?'
