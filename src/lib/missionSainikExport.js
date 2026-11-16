// Export helpers for the Mission Sainik module: CSV (formula-injection safe), calendar (.ics) and text parsing for imports.
const cell = v => { const t = String(v ?? ''); return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replace(/"/g, '""') + '"' }
export const toCsv = matrix => '\ufeff' + matrix.map(r => r.map(cell).join(',')).join('\r\n')
export function downloadFile(name, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a')
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
export const downloadCsv = (name, matrix) => downloadFile(name, toCsv(matrix))

// All-day events → iCalendar text. events: [{uid, date:'YYYY-MM-DD', title, description}]
const ics = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const ymd = iso => iso.replace(/-/g, '')
const nextDay = iso => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
export function buildIcs(events, name = 'Mission Sainik 2027', stamp = new Date()) {
  const dt = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const fold = l => (l.length <= 74 ? l : l.match(/.{1,73}/g).join('\r\n '))
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GNSI//Mission Sainik//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${ics(name)}`]
  events.forEach(e => lines.push('BEGIN:VEVENT', `UID:${ics(e.uid)}@gnsi-mission-sainik`, `DTSTAMP:${dt}`, `DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(e.date))}`, `SUMMARY:${ics(e.title)}`, ...(e.description ? [`DESCRIPTION:${ics(e.description)}`] : []), 'END:VEVENT'))
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// "test, subject, chapter" lines (comma or tab separated, header optional) → [{test_no, subject, chapter}]
export function parseSyllabusText(text, subjects) {
  const out = [], errors = []
  const byName = new Map(subjects.flatMap(s => [[s.label.toLowerCase(), s.label], [s.short.toLowerCase(), s.label], [s.key.toLowerCase(), s.label]]))
  String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((ln, i) => {
    const c = ln.split(/\t|,/).map(x => x.trim().replace(/^"|"$/g, ''))
    if (i === 0 && /^test/i.test(c[0])) return
    const no = Number(String(c[0]).replace(/\D/g, '')); const subject = byName.get(String(c[1] || '').toLowerCase())
    if (!no || no < 1 || no > 20) return errors.push(`Line ${i + 1}: test must be 1–20`)
    if (!subject) return errors.push(`Line ${i + 1}: unknown subject “${c[1] || ''}”`)
    out.push({ test_no: no, subject, chapter: c.slice(2).join(', ').trim() })
  })
  return { rows: out, errors }
}
// "test, batch, maths, reasoning, grammar, gk" lines → marks rows (validated against the maxima)
export function parseMarksText(text, maxima) {
  const out = [], errors = []
  String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((ln, i) => {
    const c = ln.split(/\t|,/).map(x => x.trim().replace(/^"|"$/g, ''))
    if (i === 0 && /^test/i.test(c[0])) return
    const no = Number(String(c[0]).replace(/\D/g, '')); if (!no || no < 1 || no > 20) return errors.push(`Line ${i + 1}: test must be 1–20`)
    const row = { test_no: no, batch: c[1] || '' }
    for (let k = 0; k < maxima.length; k++) {
      const [key, , max] = maxima[k]; const raw = c[2 + k]
      if (raw === undefined || raw === '') { row[key] = null; continue }
      const v = Number(raw); if (Number.isNaN(v) || v < 0 || v > max) { errors.push(`Line ${i + 1}: ${key} must be 0–${max}`); return }
      row[key] = v
    }
    out.push(row)
  })
  return { rows: out, errors }
}
