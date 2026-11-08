// CbtAnalysis.jsx — Results → deeper analysis (staff): how hard each question was, which options were chosen, how each
// section went, rank / percentile, a printable report per student, and re-evaluation after the answer key is corrected.
import { useMemo, useState } from 'react'
import { questionStats, sectionStats, standings, summary, groupStats } from './lib/cbtAnalytics'
import { rescorePlan } from './lib/cbtRescore'
import { fetchOnlineTest, applyRescore } from './cbtRemote'
import { cbtStore } from './cbtStore'
import { printReport } from './cbtReportPrint'

const LEVEL = { easy: ['Easy', '#e7f6ec', '#146c3a'], medium: ['Medium', '#fff4dc', '#9a5b00'], hard: ['Hard', '#fde8e6', '#b42318'], nokey: ['No key', '#f1f5f9', '#64748b'] }

export default function CbtAnalysis({ test, rows, attempts, canEdit, flash, onChanged }) {
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [groupBy, setGroupBy] = useState('district')
  const done = rows.filter(r => r.submitted)
  const qs = useMemo(() => (open ? questionStats(test, rows) : []), [open, test, rows])
  const secs = useMemo(() => sectionStats(test, rows), [test, rows])
  const stand = useMemo(() => standings(rows), [rows])
  const sum = summary(rows)
  const groups = useMemo(() => (open ? groupStats(rows, groupBy) : []), [open, rows, groupBy])
  const hasOnline = attempts.some(a => a.state === 'submitted')

  const preview = async () => {
    setBusy(true)
    try {
      // online attempts are re-scored against the key saved online; attempts taken on this computer against this computer's key
      const online = attempts.filter(a => a.source === 'online'), local = attempts.filter(a => a.source !== 'online')
      const t = online.length ? await fetchOnlineTest(test.id) : null
      if (online.length && !t) throw new Error('This test is not online, so there is no server key to re-score the online attempts against.')
      const po = t ? rescorePlan(t, online) : { changes: [], unchanged: 0 }
      const pl = rescorePlan(test, local)
      setPlan({ changes: [...po.changes, ...pl.changes].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)), unchanged: po.unchanged + pl.unchanged })
    } catch (e) { flash(e.message) }
    setBusy(false)
  }
  const apply = async () => {
    setBusy(true)
    try {
      const at = new Date().toISOString()
      const onl = plan.changes.filter(c => c.attempt.source === 'online'), loc = plan.changes.filter(c => c.attempt.source !== 'online')
      let n = onl.length ? await applyRescore(onl) : 0
      for (const c of loc) { await cbtStore.saveAttempt({ ...c.attempt, score: { ...c.now, rescored: { at, wasMarks: c.was?.marks ?? null, wasCorrect: c.was?.correct ?? null } } }); n++ }
      flash(`${n} score${n === 1 ? '' : 's'} updated.`); setPlan(null); onChanged?.()
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <b>📈 Analysis &amp; reports <span className="muted" style={{ fontWeight: 400 }}>— {done.length} submitted</span></b>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {canEdit && hasOnline && <button className="btn" disabled={busy} onClick={preview} title="After correcting the answer key, work out every online score again">🔄 Re-evaluate scores</button>}
          <button className="btn navy" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show'} analysis</button>
        </span>
      </div>
      {open && (done.length === 0 ? <p className="muted">Nothing submitted yet.</p> : <>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
          {[['Average', `${sum.avg} / ${sum.max}`], ['Median', sum.median], ['Highest', sum.high], ['Lowest', sum.low]].map(([l, v]) => <span key={l} className="tag" style={{ background: '#eef2f9', color: '#1e3a6e', fontSize: 13, padding: '5px 12px' }}>{l}: <b>{v}</b></span>)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
          <h4 style={{ margin: 0 }}>Results by</h4>
          {[['district', 'District'], ['gender', 'Gender'], ['caste', 'Category']].map(([k, l]) => <button key={k} className={'btn' + (groupBy === k ? ' navy' : '')} onClick={() => setGroupBy(k)}>{l}</button>)}
        </div>
        <div className="tbl"><table>
          <thead><tr><th>{{ district: 'District', gender: 'Gender', caste: 'Category' }[groupBy]}</th><th className="num">Candidates</th><th className="num">Share %</th><th className="num">Average</th><th>Average score</th><th className="num">Highest</th><th className="num">Lowest</th></tr></thead>
          <tbody>{groups.map(x => <tr key={x.group}><td><b>{x.group}</b></td><td className="num">{x.count}</td><td className="num">{x.share}</td><td className="num">{x.avg}</td>
            <td style={{ minWidth: 120 }}><div style={{ background: '#e8edf5', borderRadius: 6, height: 10 }}><div style={{ width: `${Math.min(100, x.avgPct)}%`, height: 10, borderRadius: 6, background: x.avgPct < 40 ? '#b42318' : x.avgPct < 60 ? '#d9a21c' : '#2f7d4f' }} /></div></td>
            <td className="num">{x.high}</td><td className="num">{x.low}</td></tr>)}</tbody>
        </table></div>
        <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>District, gender and category come from the student's ERP record (or the guest form). Candidates with no value are listed as “Not given” — fill them in Students to improve this table.</p>
        <h4 style={{ margin: '16px 0 8px' }}>Sections (topic-wise)</h4>
        <div className="tbl"><table>
          <thead><tr><th>Section</th><th className="num">Average</th><th className="num">Out of</th><th>Class average</th><th className="num">Accuracy %</th></tr></thead>
          <tbody>{secs.map(s => <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td className="num">{s.avg}</td><td className="num">{s.max}</td>
            <td style={{ minWidth: 140 }}><div style={{ background: '#e8edf5', borderRadius: 6, height: 10 }}><div style={{ width: `${Math.min(100, s.avgPct)}%`, height: 10, borderRadius: 6, background: s.avgPct < 40 ? '#b42318' : s.avgPct < 60 ? '#d9a21c' : '#2f7d4f' }} /></div></td>
            <td className="num">{s.accuracy}</td></tr>)}</tbody>
        </table></div>
        <h4 style={{ margin: '16px 0 8px' }}>Questions — difficulty and option choices</h4>
        <div className="tbl" style={{ maxHeight: 420, overflow: 'auto' }}><table>
          <thead><tr><th>Q</th><th>Key</th><th className="num">% correct</th><th>Level</th><th className="num">A</th><th className="num">B</th><th className="num">C</th><th className="num">D</th><th className="num">Skipped</th><th></th></tr></thead>
          <tbody>{qs.map(x => { const [l, bg, fg] = LEVEL[x.level]; return (
            <tr key={x.no}><td>{x.no}</td><td><b>{x.answer || '—'}</b></td><td className="num">{x.pCorrect}</td>
              <td><span className="tag" style={{ background: bg, color: fg }}>{l}</span></td>
              {['A', 'B', 'C', 'D'].map(k => <td key={k} className="num" style={{ fontWeight: k === x.answer ? 800 : 400, background: k === x.answer ? '#e7f6ec' : k === x.topWrong && x.suspect ? '#fde8e6' : undefined }}>{x.picks[k]}</td>)}
              <td className="num">{x.skipped}</td>
              <td style={{ fontSize: 12, color: '#b42318' }}>{x.suspect ? `⚠ Most chose ${x.topWrong}, key says ${x.answer} — check the key` : ''}</td></tr>) })}</tbody>
        </table></div>
        <h4 style={{ margin: '16px 0 8px' }}>Student reports</h4>
        <div className="tbl" style={{ maxHeight: 320, overflow: 'auto' }}><table>
          <thead><tr><th>Rank</th><th>Candidate</th><th className="num">Marks</th><th className="num">Percentile</th><th></th></tr></thead>
          <tbody>{done.map(r => { const st = stand.get(r.attempt.id); return (
            <tr key={r.attempt.id}><td>{st?.rank}</td><td><b>{r.attempt.candidate.name}</b></td><td className="num">{r.g.marks} / {r.g.max}</td><td className="num">{st?.percentile}</td>
              <td><button className="btn" onClick={() => { if (!printReport(test, r, st, secs)) flash('Allow pop-ups to print the report.') }}>🖨 Report</button></td></tr>) })}</tbody>
        </table></div>
      </>)}
      {plan && (
        <div className="cbt-modal" style={{ zIndex: 60 }} onClick={() => setPlan(null)}>
          <div className="box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3>Re-evaluate scores</h3>
            <p className="muted" style={{ fontSize: 13 }}>Scores are worked out again from the current answer key (online attempts: the key saved online; attempts on this computer: the key on this computer). {plan.changes.length ? `${plan.changes.length} score${plan.changes.length === 1 ? '' : 's'} would change; ${plan.unchanged} stay the same.` : `Nothing changes (${plan.unchanged} checked).`} The old marks are kept inside each score. If you corrected the key in the builder, publish the test again first.</p>
            {plan.changes.length > 0 && <div className="tbl" style={{ maxHeight: 280, overflow: 'auto' }}><table>
              <thead><tr><th>Candidate</th><th className="num">Was</th><th className="num">Now</th><th className="num">Change</th></tr></thead>
              <tbody>{plan.changes.map(c => <tr key={c.attempt.id}><td>{c.attempt.candidate.name}</td><td className="num">{c.was?.marks ?? '—'}</td><td className="num">{c.now.marks}</td><td className="num" style={{ color: c.delta >= 0 ? '#146c3a' : '#b42318', fontWeight: 700 }}>{c.delta > 0 ? '+' : ''}{c.delta}</td></tr>)}</tbody>
            </table></div>}
            <div style={{ textAlign: 'right', marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setPlan(null)}>Cancel</button>
              {plan.changes.length > 0 && <button className="btn gold" disabled={busy} onClick={apply}>{busy ? 'Updating…' : `Apply to ${plan.changes.length}`}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
