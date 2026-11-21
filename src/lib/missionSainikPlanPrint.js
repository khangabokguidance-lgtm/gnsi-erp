// missionSainikPlanPrint.js — body HTML for the printed Mission Sainik syllabus plan (premium A4 frame, see printPremium.js).
// Built to fit ONE portrait A4 page for 20 tests × 6 subjects: compact type, fixed column widths, no row splitting.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const splitChapters = v => String(v || '').split(';').map(s => s.trim()).filter(Boolean)
const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']

// Height (mm) the content may use on one A4 page: 297 − top spacer 13 − footer space 17 − a small safety margin.
const FIT_MM = 262
export const PLAN_CSS = `<style>
.pp .title{padding:6px;font-size:11px;letter-spacing:2.2px}
.pp .sub{margin:4px 0 7px;font-size:9.5px}
.pp .kpis{gap:5px;margin:0 0 7px}
.pp .kpi{padding:4px 4px 5px;border-top-width:3px}
.pp .kpi small{font-size:7.4px;letter-spacing:.6px}
.pp .kpi b{font-size:12.5px;margin-top:1px}
.pp table.t{font-size:7.7px;line-height:1.22;margin:0}
.pp table.t th{padding:4px 4px;font-size:7.4px;text-align:left;letter-spacing:.35px}
.pp table.t td{padding:2.5px 4px;height:auto;vertical-align:top;text-align:left;border-bottom:1px solid var(--line);border-left:1px solid #e6ebf2}
.pp table.t td:first-child{border-left:0;background:#f1f4fa;white-space:nowrap}
.pp table.t td.tn b{color:var(--navy);font-size:8.2px}
.pp table.t td.tn small{display:block;color:var(--mut);font-size:6.8px}
.pp table.t td i{display:block;font-style:normal;padding-left:5px;position:relative}
.pp table.t td i+i{margin-top:1px}
.pp table.t td i:before{content:"";position:absolute;left:0;top:.45em;width:2.5px;height:2.5px;border-radius:50%;background:var(--c,#64748b)}
.pp table.t td.gap{color:#b42318;text-align:center}
.pp .sig{margin:16px 0 0}
</style>`

// syl: { 'testNo|Subject label': 'Chapter A; Chapter B' }
export function buildPlanBody({ tests, subjects, syl, fmtDate = x => x, year = 2027 }) {
  const val = (t, x) => syl[t.no + '|' + x.label] || ''
  const total = tests.length * subjects.length
  const filled = tests.reduce((n, t) => n + subjects.filter(x => val(t, x)).length, 0)
  const pct = total ? Math.round((filled / total) * 100) : 0
  const kpis = subjects.map((x, i) => `<div class="kpi" style="border-top-color:${TONES[i % TONES.length]}"><small>${esc(x.short)}</small><b>${tests.filter(t => val(t, x)).length}/${tests.length}</b></div>`).join('')
  const rows = tests.map(t => `<tr><td class="tn"><b>${esc(t.id)}</b><small>${esc(fmtDate(t.date))}</small></td>${subjects.map((x, i) => {
    const cs = splitChapters(val(t, x))
    return cs.length ? `<td style="--c:${TONES[i % TONES.length]}">${cs.map(c => `<i>${esc(c)}</i>`).join('')}</td>` : '<td class="gap">—</td>'
  }).join('')}</tr>`).join('')
  const w = (89 / subjects.length).toFixed(2)
  return `${PLAN_CSS}<div class="pp"><div class="title">Mission Sainik ${year} · Syllabus Plan</div>
    <div class="sub">Chapter for each section of each Pre Mock Test · ${filled} of ${total} chapters planned (${pct}%)</div>
    <div class="kpis" style="grid-template-columns:repeat(${subjects.length},1fr)">${kpis}</div>
    <table class="t"><colgroup><col style="width:11%">${subjects.map(() => `<col style="width:${w}%">`).join('')}</colgroup>
    <thead><tr><th>Test</th>${subjects.map((x, i) => `<th style="border-bottom:2px solid ${TONES[i % TONES.length]}">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    <div class="sig"><span>Prepared by</span><span>Academic Head</span><span>Principal</span></div></div>
    <script>(function(){var f=function(){var td=document.querySelector('.frame>tbody>tr>td'),t=document.querySelector('.pp table.t');if(!td||!t)return;var max=${FIT_MM}*96/25.4,z=1;t.style.zoom=1;while(td.getBoundingClientRect().height>max&&z>.55){z-=.02;t.style.zoom=z}};(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(f)})()</script>`
}
