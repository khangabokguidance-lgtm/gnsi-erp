// Combined subject report for one Mission Foundation test: every subject's marks side by side with total, % and rank.
// Two printouts: the mark sheet (all students on landscape A4) and report cards (one per student, two per page).
import { maxMarks, subjectStats, ordinal } from '../missionFoundationData.js'

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const INSTITUTE = 'Guidance Navodaya & Sainik Institute'
const cell = v => (v === 'AB' ? '<span class="ab">AB</span>' : v == null || v === '' ? '—' : esc(v))
const grade = pct => (pct == null ? '—' : pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 45 ? 'C' : pct >= 33 ? 'D' : 'E')

// o: { mission, title, date, batch, papers, ranked (from rankResults), rows (raw marks rows), short: subject → short label }
export function testReportHtml(o, autoPrint = false) {
  const { papers, ranked } = o
  const label = p => esc(o.short?.(p.subject) || p.subject)
  const stats = subjectStats(o.rows || [], papers)
  const sat = ranked.filter(r => r.pct != null)
  const avg = sat.length ? Math.round(sat.reduce((a, r) => a + r.pct, 0) / sat.length * 10) / 10 : null
  const fullMax = papers.reduce((a, p) => a + maxMarks(p), 0)
  const head = `<div class="hd"><h1>${esc(o.institute || INSTITUTE)}</h1><h2>${esc(o.mission || '')} · ${esc(o.title || '')} · Combined subject report</h2>
    <div class="mt"><span>Date: ${esc(o.date || '')}</span><span>Batch: ${esc(o.batch === 'All' ? 'Udaan & Pragati' : o.batch)}</span><span>Students: ${ranked.length} (${sat.length} sat)</span><span>Full marks: ${fullMax}</span><span>Class average: ${avg == null ? '—' : avg + '%'}</span></div></div>`
  const table = `<table><thead><tr><th>Rank</th><th class="l">Student</th><th>GCC</th><th>Batch</th>${papers.map(p => `<th>${label(p)}<small>/${maxMarks(p)}</small></th>`).join('')}<th>Total<small>of papers sat</small></th><th>%</th><th>Grade</th></tr></thead><tbody>
    ${ranked.map(r => `<tr${r.rank && r.rank <= 3 ? ' class="top"' : ''}><td><b>${r.rank ?? '—'}</b></td><td class="l">${esc(r.student_name)}</td><td>${esc(r.gcc_no || '')}</td><td>${esc(r.batch || '')}</td>${papers.map(p => `<td>${cell(r.subjects[p.subject])}</td>`).join('')}<td><b>${r.total}</b>${r.max !== fullMax ? `<small class="of">/${r.max}</small>` : ''}</td><td>${r.pct == null ? 'AB' : r.pct}</td><td>${grade(r.pct)}</td></tr>`).join('')}
    </tbody><tfoot>
    <tr><td colspan="4" class="l">Subject average</td>${stats.map(s => `<td>${s.avg ?? '—'}</td>`).join('')}<td colspan="3"></td></tr>
    <tr><td colspan="4" class="l">Highest</td>${stats.map(s => `<td>${s.high ?? '—'}</td>`).join('')}<td colspan="3"></td></tr>
    <tr><td colspan="4" class="l">Sat / absent</td>${stats.map(s => `<td>${s.sat} / ${s.absent}</td>`).join('')}<td colspan="3"></td></tr></tfoot></table>`
  const sign = '<div class="sg"><span>Class teacher</span><span>Exam in-charge</span><span>Principal</span></div>'
  return page(`Combined report · ${o.title || ''}`, 'landscape', `${head}${table}${sign}`, autoPrint)
}

export function reportCardsHtml(o, autoPrint = false) {
  const { papers, ranked } = o
  const fullMax = papers.reduce((a, p) => a + maxMarks(p), 0)
  const stats = Object.fromEntries(subjectStats(o.rows || [], papers).map(s => [s.subject, s]))
  const cards = ranked.map(r => `<div class="card">
    <div class="ch"><b>${esc(o.institute || INSTITUTE)}</b><span>${esc(o.mission || '')} · ${esc(o.title || '')} · ${esc(o.date || '')}</span></div>
    <div class="who"><div><small>Student</small><b>${esc(r.student_name)}</b></div><div><small>GCC</small><b>${esc(r.gcc_no || '—')}</b></div><div><small>Batch</small><b>${esc(r.batch || '')}</b></div><div><small>Rank</small><b>${r.rank ? ordinal(r.rank) + ' of ' + ranked.filter(x => x.rank).length : '—'}</b></div></div>
    <table><thead><tr><th class="l">Subject</th><th>Marks</th><th>Out of</th><th>Class average</th><th>Highest</th></tr></thead><tbody>
    ${papers.map(p => { const s = stats[p.subject] || {}; return `<tr><td class="l">${esc(p.subject)}</td><td><b>${cell(r.subjects[p.subject])}</b></td><td>${maxMarks(p)}</td><td>${s.avg ?? '—'}</td><td>${s.high ?? '—'}</td></tr>` }).join('')}
    </tbody><tfoot><tr><td class="l">Total</td><td><b>${r.total}</b></td><td>${r.max || fullMax}</td><td colspan="2">${r.pct == null ? 'Absent' : `${r.pct}% · Grade ${grade(r.pct)}`}</td></tr></tfoot></table>
    <div class="sg"><span>Class teacher</span><span>Parent</span><span>Principal</span></div></div>`).join('')
  return page(`Report cards · ${o.title || ''}`, 'portrait', cards, autoPrint)
}

function page(title, orientation, body, autoPrint) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4 ${orientation};margin:10mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:12px}@media screen{body{padding:16px}}
.hd{text-align:center;border-bottom:2px solid #132a4f;margin-bottom:8px;padding-bottom:4px}h1{margin:0;font-size:18px;color:#132a4f}h2{margin:2px 0 4px;font-size:13.5px;font-weight:600}
.mt{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:11.5px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:4px 5px;text-align:center}th{background:#e8ecf4;font-size:11px}th small{display:block;font-weight:400;color:#444}
.l{text-align:left}.of{color:#555;font-size:10px}tr.top td{background:#fdf6e3}tfoot td{background:#f3f4f6;font-weight:600}.ab{color:#b42318;font-weight:700}
thead{display:table-header-group}tr{break-inside:avoid}
.sg{display:flex;justify-content:space-between;margin-top:34px;font-size:11.5px}.sg span{border-top:1px solid #333;padding-top:3px;min-width:150px;text-align:center}
.card{border:1.5px solid #132a4f;border-radius:8px;padding:12px 14px;margin-bottom:10mm;break-inside:avoid;height:132mm;display:flex;flex-direction:column}
.card .ch{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #132a4f;padding-bottom:4px;margin-bottom:8px}.card .ch b{color:#132a4f;font-size:14px}
.who{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:6px;margin-bottom:8px}.who div{border:1px solid #ccc;border-radius:6px;padding:4px 6px}.who small{display:block;color:#555;font-size:10px}
.card .sg{margin-top:auto}
</style></head><body>${body}${autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)<' + '/script>' : ''}</body></html>`
}
