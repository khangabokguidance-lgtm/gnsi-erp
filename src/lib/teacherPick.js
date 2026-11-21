// teacherPick.js — helpers for picking teachers from the staff list in the Mission admin setups (pure, unit-tested).
// The Missions store a teacher by ONE name token (e.g. "Sumanta"): tasks are matched to the logged-in person with nameMatches().
const HONORIFIC = /^(sir|madam|miss|mr|mrs|ms|dr|smt|shri)\.?\s+/i

// "Sir Sumanta Singh" → "Sumanta"
export const firstName = full => String(full || '').replace(/\s+/g, ' ').trim().replace(HONORIFIC, '').split(' ')[0] || ''

// Words that follow a given name and are not a name themselves ("Sunder Singh", "Ibemhal Devi").
const NAME_SUFFIX = new Set(['singh', 'devi', 'kumar', 'kumari', 'sharma', 'das', 'chanu', 'begum', 'khan', 'meitei'])
const words = full => String(full || '').replace(/\s+/g, ' ').trim().replace(HONORIFIC, '').split(' ').filter(Boolean)

// The one-word name the Missions store for a person. Many staff write the FAMILY name first ("Khundrakpam Sunder Singh", "Laishram Bronson Singh"),
// so the first word is not who they are called. Rules:
//   1. "<family> <given> Singh/Devi/…"  → the word just before the Singh / Devi / Kumar … ending (Sunder, Bronson);
//   2. otherwise, if the first word starts several staff names it is a family name → the second word;
//   3. otherwise the first word (Kabiraj, Sandhya).
// firstCounts: lower-case first word → how many staff start with it.
export function givenName(full, firstCounts = {}) {
  const w = words(full)
  if (!w.length) return ''
  const core = w.filter(x => !NAME_SUFFIX.has(x.toLowerCase().replace(/\./g, '')))
  if (core.length <= 1) return core[0] || w[0]
  if (w.length > core.length) return core[core.length - 1]                       // rule 1
  return (firstCounts[core[0].toLowerCase()] || 0) > 1 ? core[1] : core[0]       // rules 2 and 3
}

// staff: [{ name, designation, department }] → unique people, sorted, each with the token the Mission would store.
export function staffOptions(staff) {
  const seen = new Set(), list = []
  ;(staff || []).forEach(s => {
    const name = String(s?.name || '').replace(/\s+/g, ' ').trim()
    if (!name || seen.has(name.toLowerCase())) return
    seen.add(name.toLowerCase())
    list.push({ name, designation: s.designation || '', department: s.department || '' })
  })
  const firstCounts = {}
  list.forEach(o => { const f = (words(o.name)[0] || '').toLowerCase(); if (f) firstCounts[f] = (firstCounts[f] || 0) + 1 })
  const out = list.map(o => ({ ...o, pick: givenName(o.name, firstCounts) }))
  out.sort((a, b) => a.pick.localeCompare(b.pick) || a.name.localeCompare(b.name))   // by first name, ignoring "Sir" / "Madam"
  // Two people with the same first name cannot be told apart by the stored token: flag them so the screen can warn.
  const count = {}
  out.forEach(o => { count[o.pick.toLowerCase()] = (count[o.pick.toLowerCase()] || 0) + 1 })
  return out.map(o => ({ ...o, shared: count[o.pick.toLowerCase()] > 1 }))
}

// Search by any part of the name, designation or department. `taken` = tokens already on the panel (shown, but not pickable).
export function filterStaff(options, query, taken = []) {
  const q = String(query || '').trim().toLowerCase()
  const t = new Set((taken || []).map(x => String(x).toLowerCase()))
  return options
    .filter(o => !q || [o.name, o.designation, o.department].join(' ').toLowerCase().includes(q))
    .map(o => ({ ...o, taken: t.has(o.pick.toLowerCase()) }))
}

// The full staff name behind a stored one-word name ("Sunder" → "Khundrakpam Sunder Singh"), used to find the right photo.
// Only when exactly one staff member matches; otherwise the stored name is returned unchanged.
export function staffNameFor(token, options) {
  const t = String(token || '').trim().toLowerCase()
  if (!t) return String(token || '')
  const hits = (options || []).filter(o => o.pick.toLowerCase() === t)
  return hits.length === 1 ? hits[0].name : String(token)
}
