// cbtReportPrint.js — a one-page progress report for a student / parent: marks, rank, percentile, section-wise bars,
// weak areas and how the question types went. Opens a print window (save as PDF from the print dialog).
import { getInstitute } from './systemSettings'
import { weakSections } from './lib/cbtAnalytics'

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

export function reportHTML(test, row, standing, avgBySection = []) {
  const inst = getInstitute(), a = row.attempt, g = row.g
  const weak = weakSections(row).filter(s => s.max > 0)
  const bars = g.sections.map((s, i) => {
    const pct = s.max ? Math.max(0, Math.round((s.marks / s.max) * 100)) : 0
    const avg = avgBySection[i]?.avgPct
    return `<tr><td>${esc(s.label ? `${s.label} — ${s.title || ''}` : s.title)}</td><td class="n">${s.marks} / ${s.max}</td><td class="n">${s.correct}/${s.attempted}</td>
      <td style="width:38%"><div class="bar"><i style="width:${pct}%"></i>${avg != null ? `<b style="left:${Math.min(100, avg)}%" title="batch average"></b>` : ''}</div></td></tr>`
  }).join('')
  const focus = weak.slice(0, 2).filter(s => s.pct < 60).map(s => esc(s.title)).join(' and ')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.candidate.name)} — ${esc(test.name)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#14213d;font-size:12.5px;margin:0}
    h1{font-size:19px;margin:0}h2{font-size:13px;margin:16px 0 6px;color:#1e3a6e;text-transform:uppercase;letter-spacing:.06em}
    .top{display:flex;justify-content:space-between;border-bottom:3px solid #c9a24b;padding-bottom:8px}.muted{color:#5d6b82}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.k{border:1px solid #d8dfec;border-radius:8px;padding:8px 10px}.k b{display:block;font-size:20px}
    table{width:100%;border-collapse:collapse}th{background:#0b1e3d;color:#fff;text-align:left;padding:5px 8px;font-size:11px}td{border-bottom:1px solid #e6e0d0;padding:5px 8px}.n{text-align:right}
    .bar{position:relative;height:10px;background:#e8edf5;border-radius:6px}.bar i{position:absolute;left:0;top:0;bottom:0;background:#2f7d4f;border-radius:6px}.bar b{position:absolute;top:-3px;width:2px;height:16px;background:#b42318}
    .note{margin-top:12px;border-left:4px solid #c9a24b;background:#fbf6e8;padding:8px 12px}.foot{margin-top:18px;font-size:10.5px;color:#5d6b82}
  </style></head><body>
  <div class="top"><div><h1>${esc(inst.name || 'GNSI')}</h1><div class="muted">Test progress report</div></div><div style="text-align:right"><b>${esc(test.name)}</b><div class="muted">${when(a.submittedAt || a.startedAt)}</div></div></div>
  <h2>Student</h2>
  <div><b style="font-size:15px">${esc(a.candidate.name)}</b> &nbsp; <span class="muted">GCC ${esc(a.gcc || a.candidate.roll || '—')}</span></div>
  <div class="kpis">
    <div class="k"><span class="muted">Marks</span><b>${g.marks} / ${g.max}</b>${g.percent != null ? `${g.percent}%` : ''}</div>
    <div class="k"><span class="muted">Rank</span><b>${standing ? `${standing.rank} of ${standing.of}` : '—'}</b>${standing ? `Percentile ${standing.percentile}` : ''}</div>
    <div class="k"><span class="muted">Correct / wrong</span><b>${g.correct} / ${g.wrong}</b>Not answered ${g.skipped}</div>
    <div class="k"><span class="muted">Accuracy</span><b>${g.accuracy}%</b>of attempted</div>
  </div>
  <h2>Section-wise</h2>
  <table><thead><tr><th>Section</th><th class="n">Marks</th><th class="n">Correct</th><th>Score <span style="font-weight:400">(red line = batch average)</span></th></tr></thead><tbody>${bars}</tbody></table>
  ${focus ? `<div class="note"><b>Focus areas:</b> ${focus}. Extra practice here will lift the total the most.</div>` : '<div class="note"><b>Good all-round performance.</b> Keep revising every section regularly.</div>'}
  <div class="foot">Generated from the online test results. Percentile = share of other candidates who scored lower.</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`
}

export function printReport(test, row, standing, avgBySection) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open(); w.document.write(reportHTML(test, row, standing, avgBySection)); w.document.close()
  return true
}
