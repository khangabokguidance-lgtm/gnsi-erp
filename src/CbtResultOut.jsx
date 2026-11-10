// CbtResultOut.jsx — the admin "Result out" platform: pick a test and see every candidate with their class detected from
// the ERP (Lakshya A / B, Umeed, Combined Manipuri / English …), ranks overall and inside the class, class-wise numbers,
// toppers, filters and sorting, and every way to get the result out: CSV, Excel (a sheet per class), PDF, print, WhatsApp text,
// and the formal certificate for a candidate.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { loadStudents } from './cbtCertPrint'
import { buildBoard, classCounts, filterEntries, sortEntries, summarize, toppers, whatsappText } from './lib/cbtResultBoard'
import { downloadCsv, downloadExcel, downloadPdf, printBoard, copyText } from './cbtResultExport'
import { downloadCbtFormalCertificate } from './cbtFormalCert'

const num = v => (v === null || v === undefined || v === '' ? '—' : v)
const COLS = [['rank', 'Rank'], ['classRank', 'Class rank'], ['name', 'Candidate'], ['gcc', 'GCC'], ['class', 'Class'], ['marks', 'Marks'], ['percent', '%'], ['accuracy', 'Accuracy'], ['time', 'Min'], ['flags', 'Flags']]

export default function CbtResultOut({ test, rows, tests, online, resTest, setResTest, onView, flash }) {
  const [students, setStudents] = useState(null)
  const [secondary, setSecondary] = useState({})
  const [loadErr, setLoadErr] = useState('')
  const [classKeys, setClassKeys] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [minPercent, setMinPercent] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [passOnly, setPassOnly] = useState(false)
  const [cutoff, setCutoff] = useState(() => { try { const v = Number(localStorage.getItem('gnsi-cbt-cutoff')); return v >= 0 && v <= 100 && localStorage.getItem('gnsi-cbt-cutoff') !== null ? v : 40 } catch { return 40 } })
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' })
  const [limit, setLimit] = useState(50)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    let live = true
    loadStudents().then(s => { if (live) setStudents(s) }).catch(e => { if (live) { setStudents([]); setLoadErr(e.message) } })
    supabase.from('student_secondary_batches').select('student_id,batch').then(({ data }) => {
      if (!live) return
      const m = {}; for (const r of data || []) (m[r.student_id] ||= []).push(r.batch)
      setSecondary(m)
    })
    return () => { live = false }
  }, [])
  useEffect(() => { try { localStorage.setItem('gnsi-cbt-cutoff', String(cutoff)) } catch { /* storage blocked */ } }, [cutoff])

  const entries = useMemo(() => (test && students ? buildBoard({ test, rows, students, secondaryMap: secondary }) : []), [test, rows, students, secondary])
  const summary = useMemo(() => summarize(entries, cutoff), [entries, cutoff])
  const classes = useMemo(() => classCounts(entries), [entries])
  const tops = useMemo(() => toppers(entries, 3), [entries])
  const view = useMemo(() => {
    const f = filterEntries(entries, { classKeys, q, status, minPercent, flaggedOnly, passOnly, cutoff })
    return sortEntries(f, sort.key, sort.dir)
  }, [entries, classKeys, q, status, minPercent, flaggedOnly, passOnly, cutoff, sort])

  const toggleClass = k => setClassKeys(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const setSortKey = k => setSort(s => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }))
  const filtered = classKeys.size || q || status !== 'all' || minPercent !== '' || flaggedOnly || passOnly
  const unmatched = entries.filter(e => !e.student).length
  const noMedium = entries.filter(e => e.classKey === 'combined').length
  const unclassified = entries.filter(e => e.classKey === 'unclassified').length
  const s = summary.overall

  const run = async (name, fn) => { setBusy(name); try { await fn() } catch (e) { flash?.(`Could not make the ${name}: ${e.message}`) } setBusy('') }
  const scope = filtered ? view : entries            // what an export contains: what you are looking at, or everything
  const scopeLabel = filtered ? `${view.length} shown` : 'all'

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ flex: '1 1 260px' }}><span className="lbl">Test</span>
            <select className="in" value={resTest} onChange={e => { setResTest(e.target.value); setClassKeys(new Set()); setLimit(50) }}>
              <option value="">— choose a test —</option>
              {tests?.map(t => <option key={t.id} value={t.id}>{t.name}{online?.some(o => o.id === t.id) ? ' (online)' : ''}</option>)}
              {online?.filter(o => !tests?.some(t => t.id === o.id)).map(o => <option key={o.id} value={o.id}>{o.name} (online only)</option>)}
            </select></label>
          <label style={{ width: 130 }}><span className="lbl">Pass mark %</span><input className="in" type="number" min="0" max="100" value={cutoff} onChange={e => setCutoff(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></label>
        </div>
        {!test && <p className="muted" style={{ margin: '10px 0 0' }}>Choose a test to see its result board: classes, ranks, toppers and every export.</p>}
        {loadErr && <p style={{ color: '#9a5b00', fontWeight: 700 }}>Could not read the student list ({loadErr}). Classes cannot be detected until it loads.</p>}
        {test && !students && <p className="muted">Reading the student list…</p>}
      </div>

      {test && students && <>
        <div className="cbt-kpis">
          {[['Appeared', s.count], ['Submitted', s.submitted], ['Average', s.avgPercent == null ? '—' : `${s.avgPercent}%`], ['Median', s.medianPercent == null ? '—' : `${s.medianPercent}%`], ['Highest', s.highest == null ? '—' : `${s.highest}`], ['Lowest', s.lowest == null ? '—' : `${s.lowest}`], [`Passed (≥${cutoff}%)`, s.passRate == null ? '—' : `${s.pass} · ${s.passRate}%`], ['Accuracy', s.avgAccuracy == null ? '—' : `${s.avgAccuracy}%`], ['Avg time', s.avgTime == null ? '—' : `${s.avgTime} min`]].map(([l, v]) => <div key={l}><small>{l}</small><b>{v}</b></div>)}
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 8px' }}>📤 Get the result out</h3>
          <div className="cbt-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn gold" disabled={!scope.length || !!busy} onClick={() => { downloadCsv(test, sortEntries(scope, 'rank'), filtered ? 'filtered' : 'all'); flash?.(`CSV saved (${scopeLabel}).`) }}>📊 CSV <small>({scopeLabel})</small></button>
            <button className="btn gold" disabled={!entries.length || !!busy} onClick={() => run('Excel file', async () => { await downloadExcel({ test, entries, summary, cutoff }); flash?.('Excel saved — one sheet per class.') })}>{busy === 'Excel file' ? 'Making…' : '📗 Excel (sheet per class)'}</button>
            <button className="btn gold" disabled={!entries.length || !!busy} onClick={() => run('PDF', async () => { await downloadPdf({ test, entries, summary, cutoff }); flash?.('PDF saved — overall list, then one page per class.') })}>{busy === 'PDF' ? 'Making…' : '📕 PDF rank list'}</button>
            <button className="btn" disabled={!entries.length} onClick={() => { if (!printBoard({ test, entries, summary, cutoff })) flash?.('Allow pop-ups to print.') }}>🖨 Print</button>
            <button className="btn" disabled={!tops.length} onClick={async () => { const ok = await copyText(whatsappText({ test, summary, tops })); flash?.(ok ? 'Result message copied — paste it into WhatsApp.' : 'Could not copy. Select the text manually.') }}>💬 Copy for WhatsApp</button>
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>CSV follows your filters; Excel, PDF and Print always contain everyone, by class.</p>
        </div>

        {(unmatched > 0 || noMedium > 0 || unclassified > 0) && <div className="card" style={{ background: '#fff9ea', borderColor: '#f3d38a' }}>
          <b>Check the classes</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
            {unmatched > 0 && <li>{unmatched} candidate{unmatched === 1 ? '' : 's'} could not be matched to the ERP (guests, or a wrong GCC no.) — shown as “Guest / not in ERP”.</li>}
            {noMedium > 0 && <li>{noMedium} Combined Course student{noMedium === 1 ? ' has' : 's have'} no medium — add the English or Manipuri batch in Exams → Students to split them.</li>}
            {unclassified > 0 && <li>{unclassified} student{unclassified === 1 ? ' has' : 's have'} no recognised batch — set it in Students.</li>}
          </ul>
        </div>}

        <div className="card">
          <h3 style={{ margin: '0 0 8px' }}>🏫 By class</h3>
          <div className="tbl"><table>
            <thead><tr><th>Class</th><th className="num">Appeared</th><th className="num">Avg %</th><th className="num">Median %</th><th className="num">Highest</th><th className="num">Lowest</th><th className="num">Pass rate</th><th className="num">Accuracy</th><th>Topper</th></tr></thead>
            <tbody>
              {summary.byClass.map(c => <tr key={c.key} style={{ cursor: 'pointer', background: classKeys.has(c.key) ? '#eef3fc' : undefined }} onClick={() => toggleClass(c.key)} title="Click to filter the list to this class">
                <td><b>{c.label}</b></td><td className="num">{c.submitted}{c.inProgress ? <small className="muted"> +{c.inProgress}</small> : null}</td><td className="num">{num(c.avgPercent)}</td><td className="num">{num(c.medianPercent)}</td><td className="num">{num(c.highest)}</td><td className="num">{num(c.lowest)}</td><td className="num">{c.passRate == null ? '—' : `${c.passRate}%`}</td><td className="num">{c.avgAccuracy == null ? '—' : `${c.avgAccuracy}%`}</td><td>{c.topName ? `${c.topName} (${c.topMarks})` : '—'}</td>
              </tr>)}
            </tbody>
          </table></div>
        </div>

        {tops.length > 0 && <div className="card">
          <h3 style={{ margin: '0 0 8px' }}>🥇 Toppers</h3>
          <div className="cbt-tops">
            {tops.map(t => <div key={t.key}><b>{t.label}</b>{t.list.map((e, i) => <div key={e.id} className="row"><span>{['🥇', '🥈', '🥉'][i]}</span><span className="nm">{e.name}</span><span className="mk">{e.marks}/{e.max}</span></div>)}</div>)}
          </div>
          {summary.sectionBest.length > 1 && <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}><b>Best in each section:</b> {summary.sectionBest.map(x => `${x.label ? `${x.label} ` : ''}${x.title || ''}: ${x.name || '—'} (${num(x.marks)}/${x.max})`).join(' · ')}</p>}
        </div>}

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 12 }}>
            <div className="cbt-filters" role="group" aria-label="Class filter">
              <button type="button" className={`cbt-fchip${!classKeys.size ? ' on' : ''}`} aria-pressed={!classKeys.size} onClick={() => setClassKeys(new Set())}>All classes<i>{entries.length}</i></button>
              {classes.map(c => <button key={c.key} type="button" className={`cbt-fchip${classKeys.has(c.key) ? ' on' : ''}`} aria-pressed={classKeys.has(c.key)} onClick={() => toggleClass(c.key)}>{c.label}<i>{c.count}</i></button>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={{ flex: '1 1 200px' }}><span className="lbl">Search</span><input className="in" placeholder="Name, GCC no. or class" value={q} onChange={e => setQ(e.target.value)} /></label>
              <label><span className="lbl">Status</span><select className="in" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All</option><option value="submitted">Submitted</option><option value="inprogress">In progress</option></select></label>
              <label style={{ width: 110 }}><span className="lbl">Min %</span><input className="in" type="number" min="0" max="100" value={minPercent} onChange={e => setMinPercent(e.target.value)} /></label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}><input type="checkbox" checked={passOnly} onChange={e => setPassOnly(e.target.checked)} />Passed only</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}><input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />Flagged only</label>
              {filtered && <button className="btn" onClick={() => { setClassKeys(new Set()); setQ(''); setStatus('all'); setMinPercent(''); setPassOnly(false); setFlaggedOnly(false) }}>Clear filters</button>}
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>Showing {Math.min(limit, view.length)} of {view.length}{filtered ? ` (filtered from ${entries.length})` : ''}</div>
          </div>
          <div className="tbl" style={{ overflowX: 'auto' }}><table>
            <thead><tr>{COLS.map(([k, l]) => <th key={k} className={['marks', 'percent', 'accuracy', 'time', 'flags'].includes(k) ? 'num' : ''} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setSortKey(k)} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>{l}{sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>)}<th /></tr></thead>
            <tbody>
              {view.length === 0 && <tr><td colSpan={COLS.length + 1} className="muted">{entries.length ? 'No one matches these filters.' : 'No attempts yet.'}</td></tr>}
              {view.slice(0, limit).map(e => (
                <tr key={e.id}>
                  <td>{e.rank ?? '—'}</td><td>{e.classRank ?? '—'}</td>
                  <td><b>{e.name}</b>{!e.submitted && <span className="tag" style={{ background: '#fff4dc', color: '#9a5b00', marginLeft: 6 }}>In progress</span>}</td>
                  <td>{e.gcc || '—'}</td>
                  <td><span className="tag" style={{ background: e.classKey === 'guest' || e.classKey === 'unclassified' || e.classKey === 'combined' ? '#fff4dc' : '#eef2f9', color: e.classKey === 'guest' || e.classKey === 'unclassified' || e.classKey === 'combined' ? '#9a5b00' : '#1e3a6e' }}>{e.classLabel}</span></td>
                  <td className="num"><b>{e.marks}</b> / {e.max}</td><td className="num">{e.percent == null ? '—' : `${e.percent}%`}</td><td className="num">{e.accuracy}%</td><td className="num">{e.took ?? '—'}</td>
                  <td className="num" title={e.flagText} style={{ color: e.flags ? '#b42318' : undefined, fontWeight: e.flags ? 700 : 400 }}>{e.flags || 0}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {e.submitted && <button className="btn" onClick={() => onView(e.attempt)}>View</button>}{' '}
                    {e.submitted && e.student && <button className="btn" title="Formal certificate (PDF)" onClick={() => downloadCbtFormalCertificate({ student: e.student, row: { attempt: e.attempt, g: e.g, rank: e.rank }, test, total: s.submitted }).catch(err => flash?.(`Could not make the certificate: ${err.message}`))}>🏅</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {view.length > limit && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn" onClick={() => setLimit(l => l + 100)}>Show 100 more ({view.length - limit} left)</button></div>}
        </div>
      </>}
    </>
  )
}
