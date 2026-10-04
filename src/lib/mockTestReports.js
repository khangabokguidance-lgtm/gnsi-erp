// ─── mockTestReports.js ──────────────────────────────────────────────────────
// Print-ready (A4) HTML for the Mock Test Analyzer: individual student report,
// batch/test report and subject report.  Opened in a new window with a
// "Print / Save as PDF" button.
import { strengthLabel } from './mockTestEngine';
import { lineChart, barChart, radarChart, hBars, subjColor } from './mockTestCharts';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fx = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toString());
const sgn = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${fx(n, d)}`);
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const tone = (v, good = 0) => (v > good ? '#047857' : v < -good ? '#b91c1c' : '#475569');
const pctColor = (p) => strengthLabel(p).color;

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0f172a;--mut:#475569;--line:#cbd5e1;--soft:#f1f5f9;--navy:#0f2d5e;--gold:#b8860b}
body{font-family:Inter,'Segoe UI',Arial,sans-serif;color:var(--ink);background:#e2e8f0;font-size:11.5px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar{position:sticky;top:0;z-index:5;background:#0f2d5e;color:#fff;padding:10px 16px;display:flex;gap:10px;align-items:center;justify-content:center}
.bar button{padding:8px 20px;border:0;border-radius:6px;background:#fff;color:#0f2d5e;font-weight:700;cursor:pointer;font-size:13px}
.page{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:12mm 12mm 14mm;box-shadow:0 2px 14px rgba(0,0,0,.18);position:relative}
.lh{display:flex;align-items:center;gap:14px;border-bottom:3px double var(--navy);padding-bottom:10px;margin-bottom:10px}
.lh img{height:58px;width:58px;object-fit:contain}
.lh .t{flex:1;text-align:center}
.lh .n{font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:700;color:var(--navy);letter-spacing:.3px}
.lh .a{font-size:10.5px;color:var(--mut)}
.lh .g{font-size:10px;color:var(--gold);font-style:italic}
.title{background:var(--navy);color:#fff;text-align:center;padding:7px;border-radius:4px;font-weight:700;letter-spacing:2px;font-size:12.5px;text-transform:uppercase}
.sub{text-align:center;color:var(--mut);margin:5px 0 10px;font-size:11px}
.info{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:5px;margin-bottom:10px}
.info div{padding:6px 9px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.info div:nth-child(4n){border-right:0}.info div:nth-last-child(-n+4){border-bottom:0}
.info small{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:1.2px;color:var(--mut);font-weight:700}
.info b{font-size:12px}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-bottom:11px}
.kpi{border:1px solid var(--line);border-top:3px solid var(--navy);border-radius:5px;padding:7px 8px;text-align:center}
.kpi small{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:1px;color:var(--mut);font-weight:700}
.kpi b{display:block;font-size:17px;margin-top:2px;line-height:1.15}
.kpi i{display:block;font-style:normal;font-size:9.5px;color:var(--mut)}
h3{font-size:11.5px;text-transform:uppercase;letter-spacing:1.4px;color:var(--navy);border-bottom:1.5px solid var(--navy);padding-bottom:3px;margin:12px 0 7px}
table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:6px}
th{background:var(--navy);color:#fff;padding:5px 5px;font-size:9px;text-transform:uppercase;letter-spacing:.6px;text-align:center}
td{padding:4px 5px;border-bottom:1px solid var(--line);text-align:center}
td.l,th.l{text-align:left}
tbody tr:nth-child(even){background:#f8fafc}
tr.tot td{background:#e0e7ff;font-weight:700}
.pill{display:inline-block;padding:1px 7px;border-radius:9px;font-size:9.5px;font-weight:700;color:#fff}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{border:1px solid var(--line);border-radius:5px;padding:7px 9px}
.ins li{margin:0 0 4px 16px}
.avoid{break-inside:avoid;page-break-inside:avoid}
.sig{display:flex;justify-content:space-between;margin-top:34px}
.sig div{width:30%;text-align:center;border-top:1.3px solid var(--ink);padding-top:4px;font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;font-weight:600}
.foot{margin-top:10px;font-size:9px;color:var(--mut);text-align:center;border-top:1px dashed var(--line);padding-top:5px}
.heat td{font-weight:700}
@media print{body{background:#fff}.bar{display:none}.page{margin:0;box-shadow:none;width:auto;min-height:auto;padding:0}@page{size:A4;margin:11mm}.page+.page{break-before:page}}
`;

export function printDocument(bodyHTML, title = 'Report') {
  const w = window.open('', '_blank');
  if (!w) { alert('Pop-up blocked — allow pop-ups for this site to print the report.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
  <div class="bar"><button onclick="window.print()">🖨️ Print / Save as PDF</button><span>${esc(title)}</span></div>${bodyHTML}</body></html>`);
  w.document.close();
}

function letterhead(inst = {}) {
  const logo = inst.logoUrl ? `<img src="${esc(inst.logoUrl)}" alt="" onerror="this.style.display='none'"/>` : '';
  return `<div class="lh">${logo}<div class="t"><div class="n">${esc(inst.name || 'Guidance Navodaya & Sainik Institute')}</div>
  <div class="a">${esc(inst.address || '')}</div>${inst.tagline ? `<div class="g">${esc(inst.tagline)}</div>` : ''}</div>${logo ? '<div style="width:58px"></div>' : ''}</div>`;
}
const stamp = (inst) => `<div class="foot">Generated on ${new Date().toLocaleString('en-IN')} · ${esc(inst?.name || 'GNSI')} · This analysis is computer generated from recorded mock-test results.</div>`;
const sigs = (inst) => `<div class="sig"><div>${esc(inst?.teacher || 'Class Teacher')}</div><div>Parent / Guardian</div><div>${esc(inst?.principal || 'Principal')}</div></div>`;
const pill = (txt, color) => `<span class="pill" style="background:${color}">${esc(txt)}</span>`;
const kpi = (label, value, note = '', color = '#0f172a') => `<div class="kpi"><small>${esc(label)}</small><b style="color:${color}">${value}</b><i>${note}</i></div>`;

// ─── STUDENT ─────────────────────────────────────────────────────────────────
// a: studentAnalysis(); ctx: {institute, series, batchAnalysis (for the student's batch)}
export function studentReportHTML(a, ctx = {}) {
  const { institute: inst, series } = ctx;
  const S = a.summary, subs = a.subjects;
  const labels = a.tests.map((t) => `T${t.test_no}`);
  const cohortLine = a.tests.map((t) => (t.cohortAvg / t.max) * 100);

  const scoreChart = lineChart({
    labels, yMax: 100, unit: '%', title: 'Overall score % vs batch average',
    series: [
      { name: a.name.slice(0, 22), color: '#0f2d5e', values: a.tests.map((t) => t.pct), thick: true },
      { name: 'Batch average', color: '#94a3b8', values: cohortLine, dashed: true },
    ],
  });
  const subjChart = lineChart({
    labels, yMax: 100, unit: '%', title: 'Subject-wise trend (%)',
    series: subs.map((s) => ({ name: s, color: subjColor(subs, s), values: a.tests.map((t) => t.subj[s]?.pct ?? null) })),
  });
  const radar = radarChart({
    title: 'Subject profile (avg %)', axes: a.subjSummary.map((s) => ({ label: s.subject })),
    series: [
      { name: 'Student', color: '#0f2d5e', values: a.subjSummary.map((s) => s.avgPct), fill: 0.22 },
      { name: 'Batch avg', color: '#d97706', values: a.subjSummary.map((s) => s.cohortAvgPct), fill: 0.05, dashed: true },
    ],
  });
  const rankChart = lineChart({
    labels, yMin: 0, yMax: Math.max(5, ...a.tests.map((t) => t.n)), title: 'Class rank by test (lower is better)',
    series: [{ name: 'Rank', color: '#be123c', values: a.tests.map((t) => t.rank), thick: true }],
  });

  const testRows = a.tests.map((t) => `<tr><td><b>T${t.test_no}</b></td><td class="l">${esc(t.batch)}</td>
    ${subs.map((s) => `<td>${t.subj[s] ? fx(t.subj[s].marks, 2) : '—'}</td>`).join('')}
    <td><b>${fx(t.total, 2)}</b>/${t.max}</td><td style="color:${pctColor(t.pct)};font-weight:700">${fx(t.pct)}%</td>
    <td><b>${t.rank}</b>/${t.n}</td><td>${fx(t.percentile, 0)}</td><td>${fx(t.cohortAvg)}</td>
    <td style="color:${tone(t.diff)};font-weight:700">${sgn(t.diff)}</td></tr>`).join('');
  const avgRow = `<tr class="tot"><td colspan="2" class="l">Average</td>${a.subjSummary.map((s) => `<td>${fx(s.avg, 2)}</td>`).join('')}
    <td>${fx(S.avgTotal, 2)}</td><td>${fx(S.avgPct)}%</td><td>${fx(S.avgRank)}</td><td>${fx(S.avgPercentile, 0)}</td><td colspan="2"></td></tr>`;

  const subjRows = a.subjSummary.map((s) => `<tr><td class="l"><b style="color:${subjColor(subs, s.subject)}">■</b> <b>${esc(s.subject)}</b> <small>(/${s.max})</small></td>
    <td>${fx(s.avg, 2)}</td><td style="font-weight:700;color:${s.label.color}">${fx(s.avgPct)}%</td>
    <td>${fx(s.best.marks, 2)} <small>T${s.best.test_no}</small></td><td>${fx(s.worst.marks, 2)} <small>T${s.worst.test_no}</small></td>
    <td>${fx(s.latest.marks, 2)}</td><td>${fx(s.cohortAvgPct)}%</td>
    <td style="color:${tone(s.gapPct, 1)};font-weight:700">${sgn(s.gapPct)}</td>
    <td style="color:${tone(s.trend, 1.5)}">${s.trendLabel} <small>(${sgn(s.trend, 2)})</small></td>
    <td>${fx(s.consistency)}</td><td>${s.batchRank ?? '—'}/${s.batchSize}</td><td>${pill(s.label.label, s.label.color)}</td></tr>`).join('');

  const focusRows = a.focus.map((s, i) => `<tr><td>${i + 1}</td><td class="l"><b>${esc(s.subject)}</b></td><td>${fx(s.avg, 2)} / ${s.max}</td>
    <td>${fx(s.lost, 2)}</td><td>${fx(s.max - s.best.marks, 2)}</td><td>${i === 0 ? pill('Priority', '#b91c1c') : i === 1 ? pill('Next', '#b45309') : pill('Maintain', '#047857')}</td></tr>`).join('');

  return `<div class="page">${letterhead(inst)}
  <div class="title">Student Performance Analysis</div>
  <div class="sub">${esc(series || '')} · Tests T${a.tests[0].test_no}–T${a.tests[a.tests.length - 1].test_no}</div>
  <div class="info"><div><small>Student</small><b>${esc(a.name)}</b></div><div><small>GCC No.</small><b>${esc(a.gcc || '—')}</b></div>
  <div><small>Batch</small><b>${esc(a.batch)}${a.batches.length > 1 ? ` <small>(also ${esc(a.batches.filter((b) => b !== a.batch).join(', '))})</small>` : ''}</b></div>
  <div><small>Tests Attended</small><b>${S.testsAttended} of ${S.testsHeld}</b></div></div>
  <div class="kpis">
    ${kpi('Average Score', `${fx(S.avgTotal)}<small>/${a.maxTotal}</small>`, `${fx(S.avgPct)}%`, S.band.color)}
    ${kpi('Overall Band', `<span style="font-size:12px">${esc(S.band.label)}</span>`, `Percentile ${fx(S.avgPercentile, 0)}`, S.band.color)}
    ${kpi('Pass Mark', `${S.passPct}%`, `Passed ${S.testsPassed} of ${S.testsAttended} tests`, S.avgPct >= S.passPct ? '#047857' : '#b91c1c')}
    ${kpi('Best Rank', ord(S.bestRank), `Latest ${ord(S.latest.rank)} of ${S.latest.n}`)}
    ${kpi('Best Score', fx(S.best.total, 2), `Test ${S.best.test_no}`, '#047857')}
    ${kpi('Trend', `<span style="font-size:13px">${S.trendLabel}</span>`, `${sgn(S.trend, 2)} pts / test`, tone(S.trend, 1.5))}
    ${kpi('Next Test (proj.)', S.predictedTotal === null ? '—' : fx(S.predictedTotal), S.predictedPct === null ? '' : `${fx(S.predictedPct)}%`)}
  </div>
  <h3>1 · Test-wise performance</h3>
  <table><thead><tr><th>Test</th><th class="l">Batch</th>${subs.map((s) => `<th>${esc(s)}</th>`).join('')}<th>Total</th><th>%</th><th>Rank</th><th>Pctile</th><th>Batch Avg</th><th>± Avg</th></tr></thead>
  <tbody>${testRows}${avgRow}</tbody></table>
  <div class="grid2 avoid"><div class="box">${scoreChart}</div><div class="box">${rankChart}</div></div>
  <h3>2 · Where the marks are being lost</h3>
  <table><thead><tr><th>#</th><th class="l">Subject</th><th>Average</th><th>Marks lost / test</th><th>Gap to own best</th><th>Action</th></tr></thead><tbody>${focusRows}</tbody></table>
  </div>

  <div class="page">${letterhead(inst)}
  <h3 style="margin-top:0">3 · Subject-wise analysis</h3>
  <table><thead><tr><th class="l">Subject</th><th>Avg</th><th>Avg %</th><th>Best</th><th>Lowest</th><th>Latest</th><th>Batch %</th><th>± Batch</th><th>Trend</th><th>SD</th><th>Batch Rank</th><th>Status</th></tr></thead><tbody>${subjRows}</tbody></table>
  <div class="grid2 avoid" style="margin-top:8px"><div class="box">${subjChart}</div><div class="box" style="display:flex;justify-content:center">${radar}</div></div>
  <h3>4 · Insights &amp; recommendations</h3>
  <div class="box ins avoid"><ul>${a.insights.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
  <div class="box avoid" style="margin-top:8px"><b>Consistency:</b> ${esc(S.consistencyLabel)} (SD ${fx(S.consistency)} points) ·
    <b>Strongest:</b> ${esc(a.strongest?.subject || '—')} ·
    <b>Weakest:</b> ${esc(a.weakest?.subject || '—')} ·
    <b>Attendance in tests:</b> ${fx(S.attendancePct, 0)}%</div>
  ${sigs(inst)}${stamp(inst)}</div>`;
}

// ─── BATCH / TEST ────────────────────────────────────────────────────────────
// b: batchAnalysis().  ctx: {institute, series}
export function batchReportHTML(b, ctx = {}) {
  const { institute: inst, series } = ctx;
  const subs = b.meta.subjects;
  const scope = `${b.batch || 'All batches'} · ${b.testNo ? `Test ${b.testNo}` : `All tests (${b.meta.tests.map((t) => 'T' + t).join(', ')})`}`;
  const trendChart = b.perTest.length > 1 ? lineChart({
    labels: b.perTest.map((t) => `T${t.test_no}`), yMax: 100, unit: '%', title: 'Average % by test',
    series: [{ name: 'Overall', color: '#0f2d5e', values: b.perTest.map((t) => t.avgPct), thick: true },
      ...subs.map((s) => ({ name: s, color: subjColor(subs, s), values: b.perTest.map((t) => t.subj[s]?.avgPct ?? null) }))],
  }) : '';
  const subjBars = barChart({
    title: 'Subject averages (%)', yMax: 100, unit: '%',
    groups: b.perSubject.map((s) => ({ label: s.subject, bars: [{ name: 'Average %', value: s.avgPct, color: subjColor(subs, s.subject) }] })),
  });

  const testRows = b.perTest.map((t) => `<tr><td><b>T${t.test_no}</b></td><td>${t.n}</td><td>${fx(t.avg, 2)}</td><td style="font-weight:700">${fx(t.avgPct)}%</td><td>${fx(t.median, 2)}</td>
    <td>${fx(t.high, 2)}</td><td>${fx(t.low, 2)}</td><td>${fx(t.sd)}</td><td>${fx(t.pass, 0)}%</td>
    ${subs.map((s) => `<td>${t.subj[s] ? fx(t.subj[s].avgPct) + '%' : '—'}</td>`).join('')}<td class="l">${esc(t.topper.student_name)}</td></tr>`).join('');

  const subjRows = b.perSubject.map((s) => `<tr><td class="l"><b style="color:${subjColor(subs, s.subject)}">■</b> <b>${esc(s.subject)}</b> <small>(/${s.max})</small></td><td>${fx(s.avg, 2)}</td>
    <td style="font-weight:700;color:${s.label.color}">${fx(s.avgPct)}%</td><td>${fx(s.median, 2)}</td><td>${fx(s.high, 2)}<br/><small>${esc(s.highWho)}</small></td><td>${fx(s.low, 2)}<br/><small>${esc(s.lowWho)}</small></td>
    <td>${fx(s.sd)}</td><td>${fx(s.pass, 0)}%</td><td>${s.full}</td><td style="color:${tone(s.trend, 1)}">${sgn(s.trend, 2)}</td><td>${pill(s.label.label, s.label.color)}</td></tr>`).join('');

  const heatColor = (p) => (p === null ? '#fff' : p >= 75 ? '#bbf7d0' : p >= 60 ? '#dbeafe' : p >= 45 ? '#fef3c7' : '#fecaca');
  const heat = `<table class="heat"><thead><tr><th class="l">Subject \\ Test</th>${b.meta.tests.map((t) => `<th>T${t}</th>`).join('')}</tr></thead><tbody>
    ${b.heat.map((h) => `<tr><td class="l">${esc(h.subject)}</td>${h.cells.map((c) => `<td style="background:${heatColor(c.avgPct)}">${c.avgPct === null ? '—' : fx(c.avgPct) + '%'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  const stuRows = b.students.map((s) => `<tr><td><b>${s.rank}</b></td><td class="l">${esc(s.name)}</td><td>${esc(s.gcc || '—')}</td>${b.batch ? '' : `<td class="l">${esc(s.batch)}</td>`}<td>${s.tests}</td>
    <td>${fx(s.avgTotal, 2)}</td><td style="font-weight:700;color:${pctColor(s.avgPct)}">${fx(s.avgPct)}%</td><td>${fx(s.best, 2)}</td>
    ${subs.map((x) => `<td>${s.sub[x] === undefined ? '—' : fx(s.sub[x], 0) + '%'}</td>`).join('')}
    <td style="color:${tone(s.trend, 1.5)}">${s.tests >= 3 ? sgn(s.trend, 1) : '—'}</td></tr>`).join('');

  const miniList = (arr, f) => arr.length ? `<table><tbody>${arr.map((s) => `<tr><td class="l">${esc(s.name)}</td><td>${f(s)}</td></tr>`).join('')}</tbody></table>` : '<i>None</i>';
  const subjTop = b.perSubject.map((s) => `<div class="box avoid"><b style="color:${subjColor(subs, s.subject)}">${esc(s.subject)}</b> — toppers
    ${miniList(s.toppers.slice(0, 3), (x) => fx(x.pct) + '%')}<b style="color:#b91c1c">Needs support</b>${miniList(s.weakest.slice(0, 3), (x) => fx(x.pct) + '%')}</div>`).join('');

  return `<div class="page">${letterhead(inst)}
  <div class="title">${b.testNo ? 'Test Result Analysis' : 'Batch Performance Analysis'}</div>
  <div class="sub">${esc(series || '')} · ${esc(scope)}</div>
  <div class="kpis">
    ${kpi('Students', b.studentCount, `${b.rowsCount} results`)}
    ${kpi('Average %', fx(b.avgPct) + '%', '', pctColor(b.avgPct))}
    ${kpi((b.passMixed ? 'Pass (per-batch mark)' : `Pass ≥ ${b.passPct}%`), fx(b.pass, 0) + '%', '', b.pass >= 75 ? '#047857' : '#b45309')}
    ${kpi('Top Performer', `<span style="font-size:11px">${esc(b.topper?.name || '—')}</span>`, b.topper ? fx(b.topper.avgPct) + '%' : '')}
    ${kpi('Strongest', `<span style="font-size:12px">${esc(b.easiest?.subject || '—')}</span>`, b.easiest ? fx(b.easiest.avgPct) + '%' : '', '#047857')}
    ${kpi('Weakest', `<span style="font-size:12px">${esc(b.toughest?.subject || '—')}</span>`, b.toughest ? fx(b.toughest.avgPct) + '%' : '', '#b91c1c')}
  </div>
  <h3>1 · Test-wise summary</h3>
  <table><thead><tr><th>Test</th><th>N</th><th>Avg</th><th>Avg %</th><th>Median</th><th>High</th><th>Low</th><th>SD</th><th>Pass</th>${subs.map((s) => `<th>${esc(s)}</th>`).join('')}<th class="l">Topper</th></tr></thead><tbody>${testRows}</tbody></table>
  <div class="grid2 avoid">${trendChart ? `<div class="box">${trendChart}</div>` : ''}<div class="box">${subjBars}</div></div>
  <h3>2 · Subject-wise analysis</h3>
  <table><thead><tr><th class="l">Subject</th><th>Avg</th><th>Avg %</th><th>Median</th><th>Highest</th><th>Lowest</th><th>SD</th><th>Pass</th><th>Full</th><th>Trend</th><th>Status</th></tr></thead><tbody>${subjRows}</tbody></table>
  <h3>3 · Subject × test heat-map (average %)</h3>${heat}
  ${stamp(inst)}</div>

  <div class="page">${letterhead(inst)}
  <h3 style="margin-top:0">4 · Student ranking (by average ${b.testNo ? 'in this test' : 'across tests'})</h3>
  <table><thead><tr><th>Rank</th><th class="l">Student</th><th>GCC</th>${b.batch ? '' : '<th class="l">Batch</th>'}<th>Tests</th><th>Avg</th><th>Avg %</th><th>Best</th>${subs.map((s) => `<th>${esc(s)}</th>`).join('')}<th>Trend</th></tr></thead><tbody>${stuRows}</tbody></table>
  ${stamp(inst)}</div>

  <div class="page">${letterhead(inst)}
  <h3 style="margin-top:0">5 · Subject toppers &amp; students needing support</h3><div class="grid2">${subjTop}</div>
  <div class="grid2" style="margin-top:6px">
    <div><h3>Most improved</h3>${miniList(b.improvers, (s) => `${sgn(s.trend, 2)} pts/test · now ${fx(s.latestPct)}%`)}</div>
    <div><h3>Needs attention (declining)</h3>${miniList(b.decliners, (s) => `${sgn(s.trend, 2)} pts/test · now ${fx(s.latestPct)}%`)}</div>
    <div><h3>Most consistent</h3>${miniList(b.consistent, (s) => `SD ${fx(s.consistency)} · avg ${fx(s.avgPct)}%`)}</div>
    <div><h3>At risk (&lt; ${b.passMixed ? 'batch pass mark' : b.passPct + '%'} avg or sharp decline)</h3>${miniList(b.atRisk.slice(0, 8), (s) => `avg ${fx(s.avgPct)}% · latest ${fx(s.latestPct)}%`)}</div>
  </div>
  ${sigs(inst)}${stamp(inst)}</div>`;
}

// ─── SUBJECT ─────────────────────────────────────────────────────────────────
export function subjectReportHTML(b, subject, ctx = {}) {
  const { institute: inst, series } = ctx;
  const ps = b.perSubject.find((s) => s.subject === subject);
  if (!ps) return '';
  const subs = b.meta.subjects;
  const col = subjColor(subs, subject);
  const tests = b.meta.tests;
  const ranked = b.students.filter((s) => s.sub[subject] !== undefined).sort((a, c) => c.sub[subject] - a.sub[subject]);
  const trendChart = tests.length > 1 ? lineChart({
    labels: tests.map((t) => `T${t}`), yMax: 100, unit: '%', title: `${subject} — batch average % by test`,
    series: [{ name: subject, color: col, values: ps.byTest.map((x) => x.avgPct), thick: true }],
  }) : '';
  const dist = hBars({ items: ps.dist.map((d) => ({ label: `${d.label}%`, value: d.count, color: col })), max: Math.max(1, ...ps.dist.map((d) => d.count)), unit: '', labelW: 70, width: 340 });
  const rows = ranked.map((s, i) => `<tr><td><b>${i + 1}</b></td><td class="l">${esc(s.name)}</td><td>${esc(s.gcc || '—')}</td>
    ${tests.map((t) => `<td>${s.subTests?.[subject]?.[t] === undefined || s.subTests[subject][t] === null ? '—' : fx(s.subTests[subject][t], 2)}</td>`).join('')}
    <td style="font-weight:700;color:${pctColor(s.sub[subject])}">${fx(s.sub[subject])}%</td><td>${pill(strengthLabel(s.sub[subject]).label, strengthLabel(s.sub[subject]).color)}</td></tr>`).join('');
  return `<div class="page">${letterhead(inst)}
  <div class="title">Subject Analysis — ${esc(subject)}</div>
  <div class="sub">${esc(series || '')} · ${esc(b.batch || 'All batches')} · ${b.testNo ? `Test ${b.testNo}` : 'All tests'}</div>
  <div class="kpis">
    ${kpi('Average', `${fx(ps.avg, 2)}<small>/${ps.max}</small>`, fx(ps.avgPct) + '%', ps.label.color)}
    ${kpi('Highest', fx(ps.high, 2), esc(ps.highWho), '#047857')}
    ${kpi('Lowest', fx(ps.low, 2), esc(ps.lowWho), '#b91c1c')}
    ${kpi('Median', fx(ps.median, 2), `SD ${fx(ps.sd)}`)}
    ${kpi((b.passMixed ? 'Pass (per-batch mark)' : `Pass ≥ ${b.passPct}%`), fx(ps.pass, 0) + '%')}
    ${kpi('Full marks', ps.full, 'scores')}
  </div>
  <div class="grid2 avoid"><div class="box">${trendChart || '<i>Only one test — no trend yet.</i>'}</div><div class="box"><b>Score distribution</b> (no. of results)${dist}</div></div>
  <h3>Student-wise marks in ${esc(subject)}</h3>
  <table><thead><tr><th>#</th><th class="l">Student</th><th>GCC</th>${tests.map((t) => `<th>T${t}</th>`).join('')}<th>Avg %</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
  ${stamp(inst)}</div>`;
}

