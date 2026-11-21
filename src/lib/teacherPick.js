// teacherPick.js — helpers for picking teachers from the staff list in the Mission admin setups (pure, unit-tested).
// The Missions store a teacher by ONE name token (e.g. "Sumanta"): tasks are matched to the logged-in person with nameMatches().
const HONORIFIC = /^(sir|madam|miss|mr|mrs|ms|dr|smt|shri)\.?\s+/i

// "Sir Sumanta Singh" → "Sumanta"
export const firstName = full => String(full || '').replace(/\s+/g, ' ').trim().replace(HONORIFIC, '').split(' ')[0] || ''

// staff: [{ name, designation, department }] → unique people, sorted, each with the token the Mission would store.
export function staffOptions(staff) {
  const seen = new Set(), out = []
  ;(staff || []).forEach(s => {
    const name = String(s?.name || '').replace(/\s+/g, ' ').trim()
    if (!name || seen.has(name.toLowerCase())) return
    seen.add(name.toLowerCase())
    out.push({ name, pick: firstName(name), designation: s.designation || '', department: s.department || '' })
  })
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
