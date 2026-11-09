// rosterColumns.js — lets a smaller student-list request reuse a bigger one.
// ─────────────────────────────────────────────────────────────────────────────
// The app asks for the student list with ~25 different column lists. A request
// whose columns are all contained in a list already downloaded (or in '*') can
// be answered from those rows, so only the first one hits the database.
// Only plain column names are handled; anything else (aliases, joins) is not
// treated as covered and is fetched normally.

const PLAIN = /^[A-Za-z_][A-Za-z0-9_]*$/

// 'id, name,gcc_no' → ['id','name','gcc_no'], '*' → ['*'], null if not plain.
export function parseColumns(select) {
  const text = String(select ?? '*').trim()
  if (text === '*') return ['*']
  const cols = text.split(',').map(c => c.trim())
  return cols.length && cols.every(c => PLAIN.test(c)) ? cols : null
}

// Does a list with columns `have` contain everything in `want`?
export function covers(have, want) {
  if (!have || !want) return false
  if (have.includes('*')) return !want.includes('*') || have.includes('*')
  if (want.includes('*')) return false
  return want.every(c => have.includes(c))
}

// The rows reduced to the wanted columns ('*' keeps every column).
export function pickColumns(rows, want) {
  if (want.includes('*')) return rows
  return rows.map(r => {
    const out = {}
    for (const c of want) out[c] = r[c] === undefined ? null : r[c]
    return out
  })
}
