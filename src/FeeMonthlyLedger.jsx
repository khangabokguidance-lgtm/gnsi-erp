// FeeMonthlyLedger.jsx — the Monthly Fee Ledger: a modern register grid with
// every student as a row and April → March as columns. Each cell shows the
// month's status (paid / advance / short / due / upcoming / before admission)
// from the same model as the student's own register; the footer totals what
// was collected and what is outstanding per month.
import { useEffect, useMemo, useState } from 'react'
import { getSessionYear } from './feeEngine'
import { loadAllFeeRows, buildAllLedgers } from './feeLedgerBulk'
import { fmt, shortSession } from './feeLedgerModel'
import { monthTotals, printMonthlyLedger, exportMonthlyExcel } from './feeBooks'
import { BOOKS_CSS } from './feeBooksCss'
import { LedgerLink } from './LedgerLink'

const uniq = xs => [...new Set(xs.filter(Boolean))].sort()
const isActive = s => !s.deleted_at && (!s.status || s.status === 'Active')
const CELL_TITLE = { paid: 'Paid', advance: 'Paid in advance', short: 'Short-paid', due: 'Due', upcoming: 'Upcoming', before: 'Before admission' }

function Cell({ r }) {
  const txt = r.status === 'due' ? fmt(r.due) : ['paid', 'advance', 'short'].includes(r.status) ? fmt(r.paidAmt) : r.status === 'upcoming' ? '·' : '—'
  const tip = `${r.month} ${r.year} · ${CELL_TITLE[r.status]}${r.expected ? ` · fee ₹${fmt(r.expected)}` : ''}${r.shortBy ? ` · short by ₹${fmt(r.shortBy)}` : ''}${r.paid.length ? ` · ${r.paid.map(p => p.receipt).filter(Boolean).join(', ')}` : ''}`
  return <span className={`fbk-cell ${r.status}`} title={tip}>{r.status === 'due' ? '⚠ ' : r.status === 'advance' ? '↑ ' : ''}{txt}</span>
}

export default function FeeMonthlyLedger({ students }) {
  const current = getSessionYear()
  const sessions = useMemo(() => { const y = Number(current.slice(0, 4)); return [0, 1, 2].map(k => `${y - k}-${y - k + 1}`) }, [current])
  const [session, setSession] = useState(current)
  const [rows, setRows] = useState(null)
  const [built, setBuilt] = useState({ key: null, items: [] })
  const [progress, setProgress] = useState('Loading fee records…')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [course, setCourse] = useState('All')
  const [batch, setBatch] = useState('All')
  const [hostel, setHostel] = useState('All')
  const [who, setWho] = useState('active')
  const [show, setShow] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')

  const pool = useMemo(() => (students || []).filter(s => !s.deleted_at && s.gcc_no), [students])

  useEffect(() => {
    let live = true
    loadAllFeeRows().then(r => { if (live) { setRows(r); setError('') } }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [reload])

  const key = rows ? `${session}|${reload}|${pool.length}` : null
  useEffect(() => {
    if (!rows) return
    let live = true
    buildAllLedgers(pool, session, { rows, onProgress: m => live && setProgress(m) })
      .then(items => { if (live) setBuilt({ key: `${session}|${reload}|${pool.length}`, items }) })
      .catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [rows, pool, session, reload])
  const ready = built.key === key

  const courses = useMemo(() => uniq(pool.map(s => s.course)), [pool])
  const batches = useMemo(() => uniq(pool.filter(s => course === 'All' || s.course === course).map(s => s.batch)), [pool, course])
  const hostels = useMemo(() => uniq(pool.map(s => s.hostel_type)), [pool])

  const items = useMemo(() => {
    const t = q.trim().toLowerCase()
    const xs = (ready ? built.items : []).filter(({ student: s, reg }) =>
      (who === 'all' || isActive(s)) &&
      (course === 'All' || s.course === course) && (batch === 'All' || s.batch === batch) && (hostel === 'All' || s.hostel_type === hostel) &&
      (show === 'all' || (show === 'dues' ? reg.totalDue > 0 : reg.totalDue === 0)) &&
      (!t || [s.name, s.gcc_no, s.admission_no, s.father_name].some(v => String(v || '').toLowerCase().includes(t))))
    const by = { name: (a, b) => String(a.student.name || '').localeCompare(String(b.student.name || '')), gcc: (a, b) => (Number(a.student.gcc_no) || 0) - (Number(b.student.gcc_no) || 0), due: (a, b) => b.reg.totalDue - a.reg.totalDue, paid: (a, b) => b.reg.totalPaid - a.reg.totalPaid }
    return [...xs].sort(by[sort])
  }, [built, ready, who, course, batch, hostel, show, q, sort])

  const totals = useMemo(() => monthTotals(items), [items])
  const paid = items.reduce((s, x) => s + x.reg.totalPaid, 0)
  const due = items.reduce((s, x) => s + x.reg.totalDue, 0)
  const withDues = items.filter(x => x.reg.totalDue > 0).length
  const scope = [course !== 'All' && course, batch !== 'All' && batch, hostel !== 'All' && hostel, who === 'all' && 'incl. inactive'].filter(Boolean).join(' · ')
  const sel = (label, value, set, opts, extra) => (
    <label className="fbk-lbl">{label}<select className="fbk-in" value={value} onChange={e => { set(e.target.value); extra?.() }}>{opts.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>)}</select></label>
  )

  return (
    <div className="fbk">
      <style>{BOOKS_CSS}</style>
      <div className="fbk-card">
        <div className="fbk-bar" style={{ alignItems: 'flex-end' }}>
          {sel('Session', session, setSession, sessions.map(s => [s, shortSession(s)]))}
          {sel('Course', course, setCourse, ['All', ...courses], () => setBatch('All'))}
          {sel('Batch', batch, setBatch, ['All', ...batches])}
          {sel('Hostel', hostel, setHostel, ['All', ...hostels])}
          {sel('Students', who, setWho, [['active', 'Active only'], ['all', 'All (incl. inactive)']])}
          {sel('Show', show, setShow, [['all', 'Everyone'], ['dues', 'With dues'], ['clear', 'Fully paid']])}
          {sel('Sort', sort, setSort, [['name', 'Name'], ['gcc', 'GCC no.'], ['due', 'Highest due'], ['paid', 'Highest paid']])}
          <label className="fbk-lbl" style={{ flex: '1 1 170px' }}>Search<input className="fbk-in" placeholder="Name, GCC, adm. no…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search monthly ledger" /></label>
        </div>
        <div className="fbk-bar" style={{ marginTop: 12 }}>
          <button className="fbk-chip gold" disabled={!ready || !items.length} onClick={() => printMonthlyLedger(items, session, scope)}>🖨️ Print register</button>
          <button className="fbk-chip gold" disabled={!ready || !items.length} onClick={() => exportMonthlyExcel(items, session)}>📊 Excel</button>
          <button className="fbk-chip" onClick={() => { setRows(null); setReload(n => n + 1) }}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="fbk-card" style={{ color: '#b42318' }}>{error}</div>}
      {!ready && !error && <div className="fbk-card fbk-empty">{progress}</div>}
      {ready && (
        <>
          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Students</b><span>{items.length}</span><small>{scope || 'all courses'} · {shortSession(session)}</small></div>
            <div className="fbk-kpi"><b>Collected</b><span style={{ color: '#146c3a' }}>₹{fmt(paid)}</span><small>this session</small></div>
            <div className="fbk-kpi"><b>Outstanding</b><span style={{ color: due ? '#b42318' : '#146c3a' }}>₹{fmt(due)}</span><small>{withDues} student{withDues === 1 ? '' : 's'} with dues</small></div>
            <div className="fbk-kpi"><b>Collection rate</b><span>{paid + due ? Math.round((paid / (paid + due)) * 100) : 100}%</span><small>of fees due to date</small></div>
          </div>
          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll fbk-grid" style={{ border: 'none' }}>
              <table aria-label="Monthly fee ledger">
                <thead><tr>
                  <th className="stk">Student</th><th>Adm.</th>
                  {totals.map(t => <th key={t.month}>{t.month.slice(0, 3)} <span style={{ opacity: .6 }}>{String(t.year).slice(2)}</span></th>)}
                  <th className="num">Paid</th><th className="num">Due</th>
                </tr></thead>
                <tbody>
                  {items.length === 0 && <tr><td className="fbk-empty" colSpan={16} style={{ textAlign: 'left' }}>No students match these filters.</td></tr>}
                  {items.map(({ student: s, reg }) => (
                    <tr key={s.gcc_no}>
                      <td className="stk"><LedgerLink gcc={s.gcc_no} style={{ fontWeight: 700 }}>{s.name}</LedgerLink><div className="muted" style={{ fontSize: 11 }}>GCC-{s.gcc_no}{s.batch ? ` · ${s.batch}` : ''}{s.hostel_type ? ` · ${s.hostel_type}` : ''}</div></td>
                      <td>{reg.admission ? <span className={`fbk-cell ${reg.admission.due ? 'due' : 'paid'}`} title={`Admission fee ₹${fmt(reg.admission.expected)}`}>{reg.admission.due ? `⚠ ${fmt(reg.admission.due)}` : fmt(reg.admission.paidAmt)}</span> : <span className="fbk-cell before">—</span>}</td>
                      {reg.rows.map(r => <td key={r.month}><Cell r={r} /></td>)}
                      <td className="num" style={{ color: '#146c3a', fontWeight: 700 }}>{fmt(reg.totalPaid)}</td>
                      <td className="num" style={{ color: reg.totalDue ? '#b42318' : '#146c3a', fontWeight: 800 }}>{fmt(reg.totalDue)}</td>
                    </tr>
                  ))}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr><td className="stk">Collected</td><td className="num">{fmt(items.reduce((s, x) => s + (x.reg.admission?.paidAmt || 0), 0))}</td>{totals.map(t => <td key={t.month} className="num" style={{ color: '#146c3a' }} title={`${t.paidCount} paid`}>{fmt(t.collected)}</td>)}<td className="num">{fmt(paid)}</td><td /></tr>
                    <tr><td className="stk">Outstanding</td><td className="num" style={{ color: '#b42318' }}>{fmt(items.reduce((s, x) => s + (x.reg.admission?.due || 0), 0))}</td>{totals.map(t => <td key={t.month} className="num" style={{ color: t.outstanding ? '#b42318' : '#a0a8b8' }} title={`${t.dueCount} due`}>{t.outstanding ? fmt(t.outstanding) : '—'}</td>)}<td /><td className="num" style={{ color: '#b42318' }}>{fmt(due)}</td></tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <div className="fbk-legend">
            {['paid', 'advance', 'short', 'due', 'upcoming', 'before'].map(k => <span key={k} className={`fbk-cell ${k}`}>{CELL_TITLE[k]}</span>)}
            <span>· Paid collected includes kit/advance lines. Click a name to open the ledger.</span>
          </div>
        </>
      )}
    </div>
  )
}
