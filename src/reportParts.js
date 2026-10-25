// reportParts.js — the dependency-free pieces of the shared report design (reportKit.js):
// escaping, tables, summary cards and section headings. Kept apart so they are unit-tested
// without the portal's settings or database (tests/reportKit.test.js).
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
// text for a CSS content string (page footers)
export const cssStr = v => String(v ?? '').replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ')

// columns: [{ label, key, render(row, i), align: 'right'|'center', width }]; rows: objects.
// foot: optional array of cells (HTML) for a totals row.
export function reportTable(columns, rows, { foot, empty = 'No records' } = {}) {
  const cls = c => (c.align === 'right' ? ' class="rk-r"' : c.align === 'center' ? ' class="rk-c"' : '')
  const head = columns.map(c => `<th${cls(c)}${c.width ? ` style="width:${c.width}"` : ''}>${esc(c.label)}</th>`).join('')
  const body = rows.length
    ? rows.map((r, i) => `<tr>${columns.map(c => `<td${cls(c)}>${c.render ? c.render(r, i) : esc(r[c.key] ?? '—')}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}" class="rk-c" style="color:#64748B;padding:16px">${esc(empty)}</td></tr>`
  const tf = foot ? `<tfoot><tr>${foot.map((f, i) => `<td${cls(columns[i] || {})}>${f ?? ''}</td>`).join('')}</tr></tfoot>` : ''
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${tf}</table>`
}

// items: [[label, value, sub?, tone?]] → summary cards
export function reportCards(items) {
  return `<div class="rk-cards">${items.map(([l, v, s, tone]) => `<div class="rk-card"${tone ? ` style="--tone:${tone}"` : ''}><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}</div>`).join('')}</div>`
}
export const reportSection = (title, html) => `<div class="rk-h">${esc(title)}</div>${html}`
