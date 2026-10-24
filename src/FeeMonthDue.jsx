// FeeMonthDue.jsx — Month-wise Due Ledger: pick a session and a month; every
// student who owes fee for that month (unpaid or short-paid) is listed with
// the amount due. The strip on top shows each month's outstanding for the
// current filters so the worst months stand out.
import { useEffect, useMemo, useState } from 'react'
import { getSessionYear } from './feeEngine'
import { loadAllFeeRows, buildAllLedgers } from './feeLedgerBulk'
import { fmt, shortSession } from './feeLedgerModel'
import { monthTotals, monthDueList, printMonthDue, exportMonthDueExcel } from './feeBooks'
import { BOOKS_CSS } from './feeBooksCss'
import { LedgerLink } from './LedgerLinks'
import { canonicalBatch, courseOf } from './courseMap'

const crs = s => { const c = courseOf(s); return c === 'Unassigned' ? (s.course || '') : c }
const uniq = xs => [...new Set(xs.filter(Boolean))].sort()
const isActive = s => !s.deleted_at && (!s.status || s.status === 'Active')
// April is index 0; default to the current calendar month.
const thisMonth = () => (new Date().getMonth() + 9) % 12

export default function FeeMonthDue({ students }) {
  const current = getSessionYear()
  const sessions = useMemo(() => { const y = Number(current.slice(0, 4)); return [0, 1, 2].map(k => `${y - k}-${y - k + 1}`) }, [current])
  const [session, setSession] = useState(current)
  const [month, setMonth] = useState(thisMonth)
  const [rows, setRows] = useState(null)
  const [built, setBuilt] = useState({ key: null, items: [] })
  const [progress, setProgress] = useState('Loading fee records…')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [course, setCourse] = useState('All')
  const [batch, setBatch] = useState('All')
  const [hostel, setHostel] = useState('All')
  const [who, setWho] = useState('active')
  const [q, setQ] = useState('')

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

  const courses = useMemo(() => uniq(pool.map(crs)), [pool])
  const batches = useMemo(() => uniq(pool.filter(s => course === 'All' || crs(s) === course).map(s => canonicalBatch(s.batch))), [pool, course])
  const hostels = useMemo(() => uniq(pool.map(s => s.hostel_type)), [pool])

  const items = useMemo(() => (ready ? built.items : []).filter(x => (who === 'all' || isActive(x.student)) &&
    (course === 'All' || crs(x.student) === course) && (batch === 'All' || canonicalBatch(x.student.batch) === batch) && (hostel === 'All' || x.student.hostel_type === hostel)),
  [built, ready, who, course, batch, hostel])

  const totals = useMemo(() => monthTotals(items), [items])
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return monthDueList(items, month).filter(({ x: { student: s } }) => !t || [s.name, s.gcc_no, s.admission_no, s.father_name].some(v => String(v || '').toLowerCase().includes(t)))
  }, [items, month, q])

  const mt = totals[month]
  const label = mt ? `${mt.month} ${mt.year}` : ''
  const listTotal = list.reduce((s, { r }) => s + r.due, 0)
  const sessionDue = totals.reduce((s, t) => s + t.outstanding, 0)
  const shortCount = list.filter(({ r }) => r.status === 'short').length
  const scope = [course !== 'All' && course, batch !== 'All' && batch, hostel !== 'All' && hostel, who === 'all' && 'incl. inactive'].filter(Boolean).join(' · ')
  const sel = (lbl, value, set, opts, extra) => (
    <label className="fbk-lbl">{lbl}<select className="fbk-in" value={value} onChange={e => { set(e.target.value); extra?.() }}>{opts.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>)}</select></label>
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
          <label className="fbk-lbl" style={{ flex: '1 1 170px' }}>Search<input className="fbk-in" placeholder="Name, GCC, adm. no…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search month dues" /></label>
        </div>
        <div className="fbk-bar" style={{ marginTop: 12 }}>
          <button className="fbk-chip gold" disabled={!ready} onClick={() => printMonthDue(list, session, label, scope)}>🖨️ Print month</button>
          <button className="fbk-chip gold" disabled={!ready} onClick={() => exportMonthDueExcel(list, session, label)}>📊 Excel</button>
          <button className="fbk-chip" onClick={() => { setRows(null); setReload(n => n + 1) }}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="fbk-card" style={{ color: '#b42318' }}>{error}</div>}
      {!ready && !error && <div className="fbk-card fbk-empty">{progress}</div>}
      {ready && mt && (
        <>
          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll" style={{ border: 'none' }}>
              <table aria-label="Dues by month">
                <thead><tr><th>Month</th><th className="num">Students owing</th><th className="num">Outstanding ₹</th></tr></thead>
                <tbody>
                  {totals.map((t, i) => {
                    const n = t.dueCount
                    return (
                      <tr key={t.month} onClick={() => setMonth(i)} style={{ cursor: 'pointer', background: i === month ? '#f3f6fd' : undefined, fontWeight: i === month ? 800 : 400 }}>
                        <td>{t.month} {t.year}</td><td className="num">{n || '—'}</td><td className="num" style={{ color: t.outstanding ? '#b42318' : undefined }}>{t.outstanding ? fmt(t.outstanding) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot><tr><td colSpan={2}>Session {shortSession(session)} (monthly fees)</td><td className="num">₹{fmt(sessionDue)}</td></tr></tfoot>
              </table>
            </div>
          </div>

          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Due in {mt.month}</b><span style={{ color: listTotal ? '#b42318' : '#146c3a' }}>₹{fmt(listTotal)}</span><small>{label}</small></div>
            <div className="fbk-kpi"><b>Students owing</b><span>{list.length}</span><small>of {items.length} in scope</small></div>
            <div className="fbk-kpi"><b>Unpaid / Short</b><span>{list.length - shortCount} / {shortCount}</span><small>nothing paid / part-paid</small></div>
            <div className="fbk-kpi"><b>Share of session dues</b><span>{sessionDue ? Math.round((mt.outstanding / sessionDue) * 100) : 0}%</span><small>{scope || 'all courses'}</small></div>
          </div>

          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll" style={{ border: 'none', maxHeight: '70vh' }}>
              <table aria-label="Month-wise due ledger">
                <thead><tr><th>#</th><th>Student</th><th>Course · Batch</th><th>Hostel</th><th className="num">Fee ₹</th><th className="num">Paid ₹</th><th>Status</th><th className="num">Due ₹</th></tr></thead>
                <tbody>
                  {list.length === 0 && <tr><td colSpan={8} className="fbk-empty">No dues for {label}.</td></tr>}
                  {list.map(({ x, r }, i) => (
                    <tr key={x.student.gcc_no}>
                      <td className="muted">{i + 1}</td>
                      <td><LedgerLink gcc={x.student.gcc_no} style={{ fontWeight: 700 }}>{x.student.name}</LedgerLink><div className="muted" style={{ fontSize: 11 }}>GCC-{x.student.gcc_no}</div></td>
                      <td>{[crs(x.student), x.student.batch].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{x.student.hostel_type || '—'}</td>
                      <td className="num">{fmt(r.expected)}</td>
                      <td className="num">{r.paidAmt ? fmt(r.paidAmt) : '—'}</td>
                      <td><span className={`fbk-cell ${r.status}`}>{r.status === 'short' ? 'Short-paid' : 'Unpaid'}</span></td>
                      <td className="num" style={{ color: '#b42318', fontWeight: 800 }}>{fmt(r.due)}</td>
                    </tr>
                  ))}
                </tbody>
                {list.length > 0 && <tfoot><tr><td colSpan={7}>Total — {label}</td><td className="num">₹{fmt(listTotal)}</td></tr></tfoot>}
              </table>
            </div>
          </div>
          <div className="fbk-legend"><span>Monthly fees only — admission fee and dues brought forward from earlier sessions are in the Monthly Fee Ledger. Click a name to open the ledger.</span></div>
        </>
      )}
    </div>
  )
}
