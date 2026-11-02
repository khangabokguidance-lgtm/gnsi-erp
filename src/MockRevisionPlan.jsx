// MockRevisionPlan.jsx — "Revision Plan" tab of the Mock Test Analyzer: the academic time table joined to the
// results, so every class's revision periods can be pointed at what the class is weakest in before the Mega Mock.
import { useMemo, useState } from 'react'
import { printPremium } from './lib/printPremium'
import {
  TT_CLASSES, TT_PERIODS, TT_BREAKS, TT_TITLE, TIMETABLE, PERIOD_MINUTES, revisionPlan, checkTimetable, teacherLoad,
} from './lib/revisionPlan'

const NAVY = '#132a4f'
const COL = { Navodaya: '#dbeafe', Sainik: '#dcfce7', Foundation: '#f3e8ff' }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const pct = (v) => (v === null || v === undefined ? '—' : Math.round(v) + '%')
const VERDICT = {
  more: ['Needs more time', '#b91c1c', '#fee2e2'], less: ['Can give time to others', '#047857', '#dcfce7'], ok: ['Balanced', '#4b5870', '#eef1f6'],
  missing: ['No period!', '#fff', '#b91c1c'], none: ['—', '#8a93a6', '#fff'], 'no-data': ['No marks yet', '#8a93a6', '#fff'],
}
const tone = (v, pass) => (v === null || v === undefined ? '#8a93a6' : v < pass ? '#b91c1c' : v < 60 ? '#b45309' : '#047857')

const css = `
.rp{font-family:inherit;color:#0f1b2e}.rp *{box-sizing:border-box}
.rp .chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.rp .chip{border:1px solid #d9d2c2;background:#fff;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:38px}
.rp .chip.on{background:${NAVY};color:#fff;border-color:${NAVY}}
.rp .card{background:#fff;border:1px solid #e8e3d8;border-radius:14px;padding:14px;margin-bottom:12px}
.rp h3{margin:0 0 8px;font-size:16px}.rp .meta{font-size:12px;color:#64748b}
.rp .tw{overflow-x:auto;border:1px solid #e8e3d8;border-radius:12px}
.rp table{border-collapse:collapse;width:100%}
.rp th{background:${NAVY};color:#fff;padding:7px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;text-align:center}
.rp td{padding:7px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;vertical-align:middle}
.rp td.l,.rp th.l{text-align:left}
.rp .tag{display:inline-block;border-radius:10px;padding:1px 9px;font-size:11px;font-weight:700;white-space:nowrap}
.rp .adv{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:13px;margin:6px 0}
.rp .ok{background:#ecfdf5;border-color:#a7f3d0}
.rp .btn{border:1px solid #d9d2c2;background:#fff;border-radius:12px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:40px}
.rp .brk td{background:#b91c1c;color:#fff;font-weight:700}
.rp .p{display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:center;padding:9px 0;border-top:1px solid #f1f5f9}
.rp .p b.n{font-size:20px;color:${NAVY};text-align:center}
@media(max-width:640px){.rp td,.rp th{padding:6px 5px;font-size:12px}}
`

export default function MockRevisionPlan({ rows, series, passPct = 40, institute }) {
  const withData = useMemo(() => TT_CLASSES.filter((c) => revisionPlan(rows, c.id, { passPct })?.hasResults).map((c) => c.id), [rows, passPct])
  const [classId, setClassId] = useState(null)
  const [view, setView] = useState('plan')
  const id = classId || withData[0] || 'LA'
  const plan = useMemo(() => revisionPlan(rows, id, { passPct }), [rows, id, passPct])
  const issues = useMemo(() => checkTimetable(), [])
  const load = useMemo(() => teacherLoad(), [])
  const weakest = plan.subjects.find((s) => s.avg !== null)?.key

  const printPlan = () => {
    const rowsHtml = plan.subjects.map((s) => `<tr><td style="text-align:left"><b>${esc(s.name)}</b></td><td>${pct(s.avg)}</td><td>${s.below || '—'}</td><td>${s.count} × ${PERIOD_MINUTES} min</td><td>${esc(s.teachers.map((t) => 'Sir/Madam ' + t).join(', ') || '—')}</td><td>${esc(VERDICT[s.verdict][0])}</td></tr>`).join('')
    const dayHtml = plan.periods.map((p) => { const s = plan.subjects.find((x) => x.key === p.key); return `<tr><td>${p.period}</td><td>${esc(p.time)}</td><td style="text-align:left"><b>${esc(p.subject)}</b>${p.shared ? ' <small>(shared class)</small>' : ''}</td><td>${esc(p.teacher)}</td><td>${s && s.avg !== null ? pct(s.avg) : '—'}</td><td>${p.key === weakest ? '★ weakest' : ''}</td></tr>` }).join('')
    printPremium(`<div class="title">Mega Mock Revision Plan — ${esc(plan.cls.name)}</div><div class="sub">${esc(series)} · ${plan.students} students · pass mark ${passPct}%</div>
      ${plan.hasResults ? `<table class="t"><tr><th>Subject</th><th>Class avg</th><th>Below pass</th><th>Revision / day</th><th>Teacher</th><th>Time vs need</th></tr>${rowsHtml}</table>` : ''}
      <p style="margin:12px 0 4px"><b>Daily time table</b> (8:00 AM – 2:00 PM; Assembly 7:40 AM, Lunch 10:30–11:30 AM)</p>
      <table class="t"><tr><th>P</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Avg</th><th></th></tr>${dayHtml}</table>
      ${plan.advice.length ? `<div class="box"><b>What to do</b><ul>${plan.advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}`,
    { title: 'Revision Plan', institute: institute || undefined, docLabel: 'Mega Mock Revision Plan' })
  }

  const printGrid = () => {
    const head = `<tr><th>Time</th><th>P</th>${TT_CLASSES.map((c) => `<th>${esc(c.name)}<br><small>${esc(c.course)}</small></th>`).join('')}</tr>`
    const body = TT_BREAKS.filter((b) => b.after === 0).map((b) => `<tr><td>${esc(b.time)}</td><td></td><td colspan="${TT_CLASSES.length}"><b>${esc(b.text)}</b></td></tr>`).join('')
      + TT_PERIODS.map((p) => {
        const cells = []; let skip = 0
        TT_CLASSES.forEach((c, i) => {
          if (skip) { skip -= 1; return }
          const cell = TIMETABLE.find((t) => t.period === p.n && t.classes.includes(c.id))
          const span = cell ? cell.classes.length : 1
          if (span > 1) skip = span - 1
          cells.push(`<td colspan="${span}" style="background:${COL[c.course]}"><b>${esc(cell?.subject)}</b><br>${esc(cell?.teacher)}</td>`)
          void i
        })
        const brk = TT_BREAKS.filter((b) => b.after === p.n).map((b) => `<tr><td>${esc(b.time)}</td><td></td><td colspan="${TT_CLASSES.length}"><b>${esc(b.text)}</b></td></tr>`).join('')
        return `<tr><td>${esc(p.time)}</td><td>${p.n}</td>${cells.join('')}</tr>${brk}`
      }).join('')
    printPremium(`<div class="title">Academic Time Table</div><div class="sub">${esc(TT_TITLE)}</div><table class="t">${head}${body}</table>`, { title: 'Academic Time Table', institute: institute || undefined, docLabel: 'Academic Time Table' })
  }

  return (
    <div className="rp">
      <style>{css}</style>
      <div className="card" style={{ background: '#f8fafc' }}>
        <h3>🗓️ Revision plan for the Mega Mock Test</h3>
        <div className="meta">Your time table ({TT_TITLE.replace('Final (Correction) ', '')}) matched with {series} results: which subject each class revises in every period, how weak the class is in it, and where time should move.</div>
      </div>
      <div className="chips" role="tablist">
        {[['plan', 'Revision plan'], ['grid', 'Full time table'], ['check', 'Time table check']].map(([k, l]) => <button key={k} className={'chip' + (view === k ? ' on' : '')} onClick={() => setView(k)}>{l}</button>)}
      </div>

      {view === 'plan' && (<>
        <div className="chips">{TT_CLASSES.map((c) => <button key={c.id} className={'chip' + (id === c.id ? ' on' : '')} onClick={() => setClassId(c.id)}>{c.name}{withData.includes(c.id) ? '' : ' ·'}</button>)}</div>
        {!plan.hasResults && <div className="adv">No {series} results for {plan.cls.name} yet — the time table is shown below; subject strength appears once results are uploaded in Upload &amp; Data.</div>}
        {plan.hasResults && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><h3>{plan.cls.name} — subject strength vs revision time</h3><button className="btn" onClick={printPlan}>🖨️ Print plan</button></div>
            <div className="tw"><table>
              <thead><tr><th className="l">Subject</th><th>Class avg</th><th>Students below {passPct}%</th><th>Periods / day</th><th>Teacher</th><th>Time vs need</th></tr></thead>
              <tbody>{plan.subjects.map((s) => { const v = VERDICT[s.verdict]; return (
                <tr key={s.key}><td className="l"><b>{s.name}</b></td><td style={{ color: tone(s.avg, passPct), fontWeight: 700 }}>{pct(s.avg)}</td><td>{s.avg === null ? '—' : `${s.below} / ${s.students}`}</td>
                  <td>{s.count} <span className="meta">({s.minutes} min)</span></td><td>{s.teachers.join(', ') || '—'}</td><td><span className="tag" style={{ color: v[1], background: v[2] }}>{v[0]}</span></td></tr>) })}</tbody>
            </table></div>
            <div style={{ marginTop: 10 }}>
              {plan.advice.length ? plan.advice.map((a, i) => <div className="adv" key={i}>💡 {a}</div>) : <div className="adv ok">✅ Revision time is well matched to the results.</div>}
            </div>
          </div>
        )}
        <div className="card">
          <h3>{plan.cls.name} — one day, period by period</h3>
          <div className="meta" style={{ marginBottom: 4 }}>{TT_BREAKS[0].time}: {TT_BREAKS[0].text}</div>
          {plan.periods.map((p) => { const s = plan.subjects.find((x) => x.key === p.key); return (
            <div key={p.period}>
              {TT_BREAKS.filter((b) => b.after === p.period - 1 && b.after > 0).map((b) => <div key={b.time} className="adv" style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b', fontWeight: 600 }}>🍽 {b.time} — {b.text}</div>)}
              <div className="p">
                <div style={{ textAlign: 'center' }}><b className="n">{p.period}</b><div className="meta">{p.time.replace(/ (AM|PM)/g, '').replace(' – ', '–')}</div></div>
                <div>
                  <b>{p.subject}</b> {p.shared && <span className="tag" style={{ background: '#eef1f6', color: '#4b5870' }}>shared class</span>} {p.key === weakest && <span className="tag" style={{ background: '#fee2e2', color: '#b91c1c' }}>★ weakest subject</span>}
                  <div className="meta">Sir/Madam {p.teacher}{s && s.avg !== null ? <> · class average <b style={{ color: tone(s.avg, passPct) }}>{pct(s.avg)}</b> · {s.below} student{s.below === 1 ? '' : 's'} below pass</> : ''}</div>
                </div>
              </div>
            </div>) })}
        </div>
      </>)}

      {view === 'grid' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><h3>{TT_TITLE}</h3><button className="btn" onClick={printGrid}>🖨️ Print time table</button></div>
          <div className="tw"><table style={{ minWidth: 820 }}>
            <thead><tr><th>Time</th><th>P</th>{TT_CLASSES.map((c) => <th key={c.id}>{c.name}<div style={{ fontWeight: 400, fontSize: 10 }}>{c.course}</div></th>)}</tr></thead>
            <tbody>
              <tr className="brk"><td>{TT_BREAKS[0].time}</td><td /><td colSpan={TT_CLASSES.length}>{TT_BREAKS[0].text}</td></tr>
              {TT_PERIODS.map((p) => {
                const tds = []; let skip = 0
                TT_CLASSES.forEach((c) => {
                  if (skip) { skip -= 1; return }
                  const cell = TIMETABLE.find((t) => t.period === p.n && t.classes.includes(c.id)); const span = cell.classes.length; if (span > 1) skip = span - 1
                  tds.push(<td key={c.id} colSpan={span} style={{ background: COL[c.course] }}><b>{cell.subject}</b><div className="meta">{cell.teacher}</div></td>)
                })
                return [<tr key={p.n}><td><b>{p.time}</b></td><td><b>{p.n}</b></td>{tds}</tr>,
                  ...TT_BREAKS.filter((b) => b.after === p.n).map((b) => <tr className="brk" key={b.time}><td>{b.time}</td><td /><td colSpan={TT_CLASSES.length}>{b.text}</td></tr>)]
              })}
            </tbody>
          </table></div>
        </div>
      )}

      {view === 'check' && (<>
        <div className="card">
          <h3>Time table check</h3>
          {issues.length ? issues.map((i, k) => <div className="adv" key={k}>⚠️ {i.text}</div>) : <div className="adv ok">✅ No clashes: no teacher is in two classes in the same period, and every class has exactly one subject in each of the 6 periods ({TIMETABLE.length} period slots checked).</div>}
          <div className="adv">ℹ️ Lakshya B and Umeed share one Maths revision in period 2 with Sir/Madam Himan; Morning Assembly (7:40 AM) is for the 1st-period teacher.</div>
        </div>
        <div className="card">
          <h3>Teacher load (periods per day)</h3>
          <div className="tw"><table><thead><tr><th className="l">Teacher</th><th>Periods</th><th className="l">Classes</th><th className="l">Subjects</th></tr></thead>
            <tbody>{load.map((t) => <tr key={t.teacher}><td className="l"><b>{t.teacher}</b></td><td>{t.periods}</td><td className="l">{t.classes.join(', ')}</td><td className="l">{t.subjects.join(', ')}</td></tr>)}</tbody></table></div>
        </div>
      </>)}
    </div>
  )
}
