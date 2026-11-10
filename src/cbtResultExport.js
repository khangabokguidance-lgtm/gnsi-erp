// cbtResultExport.js — writes the result board out: CSV, Excel (one sheet per class), PDF rank list, print and WhatsApp text.
// The heavy libraries (xlsx, jspdf) are loaded only when a button is pressed.
import { getInstitute } from './systemSettings'
import { tableOf, csvOf, workbookSheets, sortEntries, classCounts } from './lib/cbtResultBoard'

const fileSafe = s => String(s || 'result').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 60)
function save(name, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const stampName = () => new Date().toISOString().slice(0, 10)

export function downloadCsv(test, entries, label = 'results') {
  save(`${fileSafe(test.name)}-${fileSafe(label)}-${stampName()}.csv`, new Blob([csvOf(tableOf(entries))], { type: 'text/csv;charset=utf-8' }))
}

export async function downloadExcel({ test, entries, summary, cutoff }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const sh of workbookSheets({ test, entries, summary, cutoff })) {
    const ws = XLSX.utils.aoa_to_sheet(sh.aoa)
    ws['!cols'] = (sh.aoa[sh.aoa.length > 8 ? 7 : 0] || []).map((_, i) => ({ wch: i === 2 ? 26 : 14 }))
    XLSX.utils.book_append_sheet(wb, ws, sh.name)
  }
  XLSX.writeFile(wb, `${fileSafe(test.name)}-result-${stampName()}.xlsx`)
}

/** A4 landscape rank list; with byClass each class starts on its own page. */
export async function downloadPdf({ test, entries, summary, cutoff, byClass = true }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const inst = getInstitute({ name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok, Thoubal, Manipur' })
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const header = (title, sub) => {
    doc.setFillColor(11, 30, 61); doc.rect(0, 0, W, 22, 'F')
    doc.setTextColor(226, 197, 126); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(String(inst.name || '').toUpperCase(), 10, 9)
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`${title}`, 10, 16)
    doc.setFontSize(8.5); doc.text(sub, W - 10, 16, { align: 'right' })
  }
  const s = summary.overall
  header(`${test.name} — Result`, `${s.submitted} appeared · average ${s.avgPercent ?? '—'}% · highest ${s.highest ?? '—'} · pass mark ${cutoff}% · pass rate ${s.passRate ?? '—'}%`)
  // summary by class
  autoTable(doc, {
    startY: 27, head: [['Class', 'Appeared', 'Average %', 'Median %', 'Highest', 'Lowest', 'Pass', 'Pass rate %', 'Accuracy %', 'Topper']],
    body: summary.byClass.map(c => [c.label, c.submitted, c.avgPercent ?? '—', c.medianPercent ?? '—', c.highest ?? '—', c.lowest ?? '—', c.pass, c.passRate ?? '—', c.avgAccuracy ?? '—', c.topName ? `${c.topName} (${c.topMarks})` : '—']),
    styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: [11, 30, 61], textColor: [226, 197, 126] }, alternateRowStyles: { fillColor: [245, 247, 251] },
  })
  const cols = ['Rank', 'Class rank', 'Name', 'GCC no.', 'Class', 'Marks', 'Out of', '%']
  const body = list => list.map(e => [e.rank ?? '—', e.classRank ?? '—', e.name, e.gcc, e.classLabel, e.marks, e.max, e.percent ?? '—'])
  const table = (list, title) => {
    doc.addPage(); header(`${test.name} — ${title}`, `${list.filter(e => e.submitted).length} appeared`)
    autoTable(doc, {
      startY: 27, head: [cols], body: body(list), styles: { fontSize: 8.5, cellPadding: 1.6 }, headStyles: { fillColor: [11, 30, 61], textColor: [226, 197, 126] }, alternateRowStyles: { fillColor: [245, 247, 251] },
      didParseCell: d => { if (d.section === 'body' && d.row.index < 3 && list[d.row.index]?.submitted) d.cell.styles.fontStyle = 'bold' },
    })
  }
  table(sortEntries(entries, 'rank'), 'Overall rank list')
  if (byClass) for (const c of classCounts(entries)) table(sortEntries(entries.filter(e => e.classKey === c.key), 'classRank'), c.label)
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(120); doc.text(`Page ${i} of ${pages} · generated ${new Date().toLocaleString('en-IN')}`, W / 2, 205, { align: 'center' }) }
  doc.save(`${fileSafe(test.name)}-result-${stampName()}.pdf`)
}

const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
/** A print-ready page (the browser's Print → Save as PDF also works). */
export function printBoard({ test, entries, summary, cutoff }) {
  const inst = getInstitute({ name: 'Guidance Navodaya & Sainik Institute', address: '' })
  const t = tableOf(sortEntries(entries, 'rank'), { detailed: false })
  const s = summary.overall
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(test.name)} — Result</title><style>
    body{font:12px/1.4 Arial,sans-serif;margin:18px;color:#111}h1{margin:0;font-size:18px;color:#0b1e3d}h2{margin:14px 0 6px;font-size:13px}
    .sub{color:#555;margin:2px 0 10px}table{border-collapse:collapse;width:100%;margin-bottom:10px}th{background:#0b1e3d;color:#e2c57e;text-align:left;padding:5px 6px}
    td{border-bottom:1px solid #ddd;padding:4px 6px}tr:nth-child(even) td{background:#f5f7fb}@media print{.no{display:none}}
  </style></head><body><button class="no" onclick="print()">🖨 Print</button>
  <h1>${esc(inst.name)}</h1><div class="sub">${esc(test.name)} — Result · ${s.submitted} appeared · average ${s.avgPercent ?? '—'}% · highest ${s.highest ?? '—'} · pass mark ${cutoff}% (${s.passRate ?? '—'}% passed)</div>
  <h2>By class</h2><table><tr><th>Class</th><th>Appeared</th><th>Average %</th><th>Highest</th><th>Pass rate %</th><th>Topper</th></tr>
  ${summary.byClass.map(c => `<tr><td>${esc(c.label)}</td><td>${c.submitted}</td><td>${c.avgPercent ?? '—'}</td><td>${c.highest ?? '—'}</td><td>${c.passRate ?? '—'}</td><td>${esc(c.topName)}</td></tr>`).join('')}</table>
  <h2>Rank list</h2><table><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>
  </body></html>`)
  w.document.close()
  return true
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
