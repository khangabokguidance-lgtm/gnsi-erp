// houseMarksReport.js — premium A4 report bodies for the Hostel → Marks tab.
//   • buildTestReport     one test: summary, subject analysis, mark bands, ranked result sheet, absentees
//   • buildProgressReport one student: trend chart + every test (needs the saved progress records)
// Pure string builders; the frame (letterhead, watermark, footer) comes from printPremium / premiumDocument.
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const f1 = n => (n == null || !Number.isFinite(n) ? '–' : String(Math.round(n * 10) / 10))
const tone = p => (p == null ? '#94a3b8' : p >= 75 ? '#15803d' : p >= 60 ? '#4d7c0f' : p >= 40 ? '#b45309' : '#b91c1c')
const fmtDate = d => { const x = new Date(d); return Number.isNaN(x.getTime()) ? String(d || '') : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const grade = p => (p >= 90 ? 'A+' : p >= 75 ? 'A' : p >= 60 ? 'B' : p >= 40 ? 'C' : 'D')

const EXTRA_CSS = `<style>
.hm-med{display:inline-block;min-width:16px;padding:1px 5px;border-radius:999px;font-weight:800;font-size:9px;color:#fff;background:#0f2d5e}
.hm-med.g1{background:#b8923a}.hm-med.g2{background:#7b8794}.hm-med.g3{background:#a0643a}
.hm-bar{display:flex;align-items:center;gap:6px;margin:3px 0;font-size:9.5px}
.hm-bar span.l{width:62px;color:#5b6678;font-weight:700}
.hm-bar i{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,#0f2d5e,#1e3a6e)}
.hm-bar b{min-width:20px}
.hm-sum{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 6px}
.hm-top li{margin:0 0 3px 16px}
.hm-low{background:#fff7ed!important}.hm-bad{background:#fef2f2!important}
.hm-leg{font-size:8.8px;color:#5b6678;margin:2px 0 8px}
</style>`

// rows: [{ rank, gcc, name, cls, marks:[...], total, n, pct, absent, low, bad }] already sorted for print
export function buildTestReport({ test, house, subjects, maxTotal, rows, groupName = '' }) {
  const appeared = rows.filter(r => r.n > 0)
  const ranked = rows.filter(r => r.rank)
  const pcts = ranked.map(r => r.pct)
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null
  const top = ranked.length ? ranked.reduce((a, b) => (b.total > a.total ? b : a)) : null
  const absent = rows.filter(r => r.absent)
  const below = rows.filter(r => r.low)
  const pass = ranked.filter(r => !r.low).length

  const kpi = (l, v, sub = '') => `<div class="kpi"><small>${esc(l)}</small><b>${esc(v)}</b>${sub ? `<small style="margin-top:2px;text-transform:none;letter-spacing:0">${esc(sub)}</small>` : ''}</div>`
  const kpis = `<div class="kpis">${kpi('Appeared', `${appeared.length}/${rows.length}`, absent.length ? `${absent.length} absent` : 'all present')}${kpi('Average', avg == null ? '–' : f1(avg) + '%', `of ${maxTotal} marks`)}${kpi('Highest', top ? `${top.total}/${maxTotal}` : '–', top ? top.name : '')}${kpi('Below minimum', String(below.length), subjects.some(s => s.min !== '' && s.min != null) ? 'in a subject' : 'no minimum set')}</div>`

  // subject-wise analysis
  const subRows = subjects.map((s, i) => {
    const vals = rows.map(r => r.marks[i]).filter(v => typeof v === 'number')
    const sum = vals.reduce((a, b) => a + b, 0)
    const a = vals.length ? sum / vals.length : null
    const lows = rows.filter(r => typeof r.marks[i] === 'number' && s.min !== '' && s.min != null && r.marks[i] < Number(s.min)).length
    return `<tr><td class="l"><b>${esc(s.n)}</b></td><td>${esc(s.max)}</td><td>${s.min === '' || s.min == null ? '–' : esc(s.min)}</td><td>${f1(a)}</td><td><b style="color:${tone(a == null ? null : a / Number(s.max) * 100)}">${a == null ? '–' : f1(a / Number(s.max) * 100) + '%'}</b></td><td>${vals.length ? Math.max(...vals) : '–'}</td><td>${vals.length ? Math.min(...vals) : '–'}</td><td>${s.min === '' || s.min == null ? '–' : lows}</td></tr>`
  }).join('')
  const subTable = `<h3>Subject analysis</h3><table><thead><tr><th class="l">Subject</th><th>Max</th><th>Min</th><th>Average</th><th>Avg %</th><th>Highest</th><th>Lowest</th><th>Below min</th></tr></thead><tbody>${subRows}</tbody></table>`

  // bands
  const bands = [['75 – 100%', p => p >= 75], ['60 – 74%', p => p >= 60 && p < 75], ['40 – 59%', p => p >= 40 && p < 60], ['Below 40%', p => p < 40]]
  const counts = bands.map(([, fn]) => ranked.filter(r => fn(r.pct)).length)
  const mx = Math.max(1, ...counts)
  const bandHtml = bands.map(([l], i) => `<div class="hm-bar"><span class="l">${l}</span><i style="width:${Math.round(counts[i] / mx * 100)}%;min-width:${counts[i] ? 4 : 0}px"></i><b>${counts[i]}</b></div>`).join('')
  const topHtml = ranked.filter(r => r.rank <= 3).map(r => `<li><b>#${r.rank}</b> ${esc(r.name)} — ${r.total}/${maxTotal} (${f1(r.pct)}%)</li>`).join('')
  const side = `<div class="hm-sum"><div class="cardbox"><h3 style="margin-top:0">Result bands</h3>${bandHtml || '<p>No marks yet.</p>'}</div><div class="cardbox"><h3 style="margin-top:0">Top performers</h3><ul class="hm-top" style="margin:0;padding:0;list-style:none">${topHtml || '<li>–</li>'}</ul></div></div>`

  // ranked sheet
  const head = `<tr><th>Rank</th><th>GCC</th><th class="l">Name</th><th>Class</th>${subjects.map(s => `<th>${esc(s.n)}<br><span style="opacity:.7;font-weight:400">/${esc(s.max)}</span></th>`).join('')}<th>Total<br><span style="opacity:.7;font-weight:400">/${maxTotal}</span></th><th>%</th><th>Grade</th></tr>`
  const body = rows.map(r => {
    const cls = r.bad ? 'hm-bad' : r.low ? 'hm-low' : ''
    const rk = r.rank ? `<span class="hm-med ${r.rank <= 3 ? 'g' + r.rank : ''}">${r.rank}</span>` : '–'
    const cells = subjects.map((s, i) => { const v = r.marks[i]; const lowCell = typeof v === 'number' && s.min !== '' && s.min != null && v < Number(s.min); return `<td${lowCell ? ' style="color:#b45309;font-weight:800"' : ''}>${v === null || v === undefined ? '–' : esc(v)}</td>` }).join('')
    return `<tr class="${cls}"><td>${rk}</td><td>${esc(r.gcc || '–')}</td><td class="l"><b>${esc(r.name)}</b></td><td>${esc(r.cls || '')}</td>${cells}<td><b>${r.absent ? 'ABSENT' : r.n ? r.total : '–'}</b></td><td><b style="color:${tone(r.n ? r.pct : null)}">${r.n ? f1(r.pct) : '–'}</b></td><td>${r.n ? grade(r.pct) : '–'}</td></tr>`
  }).join('')

  const absentLine = absent.length ? `<p class="note" style="text-align:left"><b>Absent:</b> ${absent.map(r => esc(r.name)).join(', ')}</p>` : ''
  const meta = [house && house !== 'All' ? esc(house) : 'All houses', groupName ? esc(groupName) : '', fmtDate(test.date), `out of ${maxTotal}`].filter(Boolean).join(' · ')
  return `${EXTRA_CSS}<div class="title">Test Result Sheet</div>
<div class="sub"><b>${esc(test.name || 'Untitled test')}</b><br>${meta}</div>
${kpis}${side}${subTable}
<h3>Ranked result <small>${rows.length} students · ties share a rank${pass ? ` · ${pass} cleared every minimum` : ''}</small></h3>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
<div class="hm-leg">Amber row = below the minimum in a subject · red row = marks need checking · grade: A+ ≥ 90, A ≥ 75, B ≥ 60, C ≥ 40, D below 40 (of total).</div>
${absentLine}
<div class="sig"><span>House Master / Mistress</span><span>Class Teacher</span><span>Principal</span></div>`
}

// rows: saved progress records (oldest → newest): { test_name, test_date, group_name, total, max_total, percent, rank, ranked_of, class_avg_pct, absent }
export function buildProgressReport({ student, rows, house = '' }) {
  const scored = rows.filter(r => r.percent != null)
  const avg = scored.length ? scored.reduce((a, r) => a + Number(r.percent), 0) / scored.length : null
  const last = scored[scored.length - 1], prev = scored[scored.length - 2]
  const delta = last && prev ? Number(last.percent) - Number(prev.percent) : null
  const best = scored.length ? scored.reduce((a, r) => (Number(r.percent) > Number(a.percent) ? r : a)) : null
  const kpi = (l, v, sub = '') => `<div class="kpi"><small>${esc(l)}</small><b>${esc(v)}</b>${sub ? `<small style="margin-top:2px;text-transform:none;letter-spacing:0">${esc(sub)}</small>` : ''}</div>`
  const kpis = `<div class="kpis">${kpi('Tests', String(rows.length), `${rows.filter(r => r.absent).length} absent`)}${kpi('Average', avg == null ? '–' : f1(avg) + '%')}${kpi('Latest', last ? f1(Number(last.percent)) + '%' : '–', last ? last.test_name : '')}${kpi('Trend', delta == null ? '–' : (delta >= 0 ? '▲ +' : '▼ ') + f1(delta), 'vs previous test')}</div>`

  const W = 640, H = 170, pl = 34, pr = 12, pt = 12, pb = 24
  const xs = i => pl + (scored.length < 2 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (scored.length - 1))
  const ys = v => pt + (H - pt - pb) * (1 - Math.max(0, Math.min(100, v)) / 100)
  const line = key => scored.map((r, i) => (r[key] == null ? null : `${xs(i)},${ys(Number(r[key]))}`)).filter(Boolean).join(' ')
  const grid = [0, 25, 50, 75, 100].map(g => `<line x1="${pl}" x2="${W - pr}" y1="${ys(g)}" y2="${ys(g)}" stroke="#d6dde8" stroke-width="1"/><text x="${pl - 5}" y="${ys(g) + 3}" font-size="9" text-anchor="end" fill="#5b6678">${g}</text>`).join('')
  const dots = scored.map((r, i) => `<circle cx="${xs(i)}" cy="${ys(Number(r.percent))}" r="4" fill="#b8923a" stroke="#0f2d5e" stroke-width="1.6"/><text x="${xs(i)}" y="${ys(Number(r.percent)) - 8}" font-size="8.5" text-anchor="middle" fill="#0f2d5e" font-weight="700">${f1(Number(r.percent))}</text>`).join('')
  const chart = scored.length ? `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin:4px 0 2px">${grid}<polyline points="${line('class_avg_pct')}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4"/><polyline points="${line('percent')}" fill="none" stroke="#0f2d5e" stroke-width="2.6"/>${dots}</svg><div class="hm-leg"><b style="color:#0f2d5e">━</b> ${esc(student.name)} (%) &nbsp; <b style="color:#94a3b8">╌</b> house average (%)</div>` : '<p>No scored tests yet.</p>'

  const body = rows.map(r => {
    const d = r.percent != null && r.class_avg_pct != null ? Number(r.percent) - Number(r.class_avg_pct) : null
    return `<tr><td>${esc(fmtDate(r.test_date))}</td><td class="l"><b>${esc(r.test_name)}</b></td><td class="l">${esc(r.group_name || '–')}</td><td>${r.absent ? 'ABSENT' : r.total == null ? '–' : `${esc(r.total)}/${esc(r.max_total)}`}</td><td><b style="color:${tone(r.percent == null ? null : Number(r.percent))}">${r.percent == null ? '–' : f1(Number(r.percent))}</b></td><td>${r.rank ? `${r.rank}${r.ranked_of ? ' / ' + r.ranked_of : ''}` : '–'}</td><td style="color:${d == null ? '#94a3b8' : d >= 0 ? '#15803d' : '#b91c1c'};font-weight:700">${d == null ? '–' : (d >= 0 ? '+' : '') + f1(d)}</td></tr>`
  }).join('')
  const insight = best ? `<p class="note" style="text-align:left"><b>Best result:</b> ${esc(best.test_name)} — ${f1(Number(best.percent))}% on ${esc(fmtDate(best.test_date))}.${delta != null ? ` Latest test is ${delta >= 0 ? 'up' : 'down'} ${f1(Math.abs(delta))} points on the previous one.` : ''}</p>` : ''
  return `${EXTRA_CSS}<div class="title">Student Progress Report</div>
<div class="sub"><b>${esc(student.name)}</b> · GCC ${esc(student.gcc_no || '–')}${student.class_name ? ' · ' + esc(student.class_name) : ''}${house && house !== 'All' ? ' · ' + esc(house) : ''}</div>
${kpis}<h3>Performance trend</h3>${chart}${insight}
<h3>Test-wise results</h3>
<table><thead><tr><th>Date</th><th class="l">Test</th><th class="l">Group</th><th>Total</th><th>%</th><th>Rank</th><th>vs house avg</th></tr></thead><tbody>${body}</tbody></table>
<div class="sig"><span>House Master / Mistress</span><span>Parent / Guardian</span><span>Principal</span></div>`
}
