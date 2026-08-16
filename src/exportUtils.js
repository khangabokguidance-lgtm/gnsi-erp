// exportUtils.js — turn any row array into a downloadable CSV.
// ─────────────────────────────────────────────────────────────────────────────
// Used by every card's export button (Search tab), the raw table browser,
// and the Mismatch Dashboard / defaulters list. One function, reused
// everywhere, so export behavior (quoting, column ordering, filename
// format) can't drift between features.
// ─────────────────────────────────────────────────────────────────────────────

function csvEscape(val) {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// rows: array of flat objects. columns: optional explicit column order
// (array of keys); defaults to the keys of the first row.
export function toCSV(rows, columns = null) {
  if (!rows?.length) return ''
  const cols = columns || Object.keys(rows[0])
  const header = cols.join(',')
  const lines = rows.map(r => cols.map(c => csvEscape(r[c])).join(','))
  return [header, ...lines].join('\n')
}

// Triggers a browser download of the given rows as a CSV file. Safe to
// call directly from an onClick — no async, no return value needed.
export function downloadCSV(rows, filename, columns = null) {
  const csv = toCSV(rows, columns)
  if (!csv) return
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Convenience — same idea but the caller supplies a summary object rather
// than a row array (e.g. exporting a single student's full profile as one
// flat sheet-friendly file with one row).
export function downloadSingleRecordCSV(record, filename) {
  downloadCSV([record], filename, Object.keys(record))
}