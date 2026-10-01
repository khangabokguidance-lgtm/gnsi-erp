// FeeDayBook.jsx — institute-wide Day Book: every fee receipt taken in a day
// or date range, grouped by date with subtotals, plus totals by payment mode,
// fee head and collector (for the cash closing). Receipt numbers reprint;
// student names open that student's ledger.
import { useEffect, useMemo, useState } from 'react'
import { loadAllFeeRows } from './feeLedgerBulk'
import { fmt, fmtDate } from './feeLedgerModel'
import { allEntries, dayBook, presetRange, shiftDay, localISO, printDayBook, exportDayBookExcel, reprintBookReceipt } from './feeBooks'
import { BOOKS_CSS } from './feeBooksCss'
import { LedgerLink } from './LedgerLinks'

const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'], ['lastmonth', 'Last month']]

function Bars({ title, pairs, total }) {
  return (
    <div className="fbk-card fbk-bars" style={{ margin: 0 }}>
      <h4>{title}</h4>
      {pairs.length === 0 ? <p className="muted">—</p> : pairs.map(([k, v]) => (
        <p key={k}><span><span>{k}</span><b className="num">₹{fmt(v)}</b></span><i><em style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></i></p>
      ))}
    </div>
  )
}

export default function FeeDayBook({ students }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [preset, setPreset] = useState('today')
  const [[from, to], setRange] = useState(() => presetRange('today'))
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('All')

  useEffect(() => {
    let live = true
    loadAllFeeRows().then(r => { if (live) { setRows(r); setError('') } }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [reload])

  const entries = useMemo(() => rows ? allEntries(students || [], rows) : [], [rows, students])
  const modes = useMemo(() => [...new Set(entries.map(e => e.mode).filter(Boolean))].sort(), [entries])
  const book = useMemo(() => {
    const t = q.trim().toLowerCase()
    const pool = entries.filter(e => (mode === 'All' || e.mode === mode) && (!t || [e.student.name, e.gcc, e.receipt, e.ref, e.by, e.particulars].some(v => String(v || '').toLowerCase().includes(t))))
    return dayBook(pool, from <= to ? from : to, from <= to ? to : from)
  }, [entries, from, to, q, mode])

  const pick = key => { setPreset(key); setRange(presetRange(key)) }
  const step = n => { setPreset('custom'); setRange(from === to ? [shiftDay(from, n), shiftDay(from, n)] : [shiftDay(from, n * (1 + (new Date(to) - new Date(from)) / 864e5)), shiftDay(to, n * (1 + (new Date(to) - new Date(from)) / 864e5))]) }
  const today = localISO(new Date())
  const label = from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`

  return (
    <div className="fbk">
      <style>{BOOKS_CSS}</style>
      <div className="fbk-card">
        <div className="fbk-bar" role="group" aria-label="Day book period">
          {PRESETS.map(([k, l]) => <button key={k} className={`fbk-chip${preset === k ? ' on' : ''}`} onClick={() => pick(k)}>{l}</button>)}
        </div>
        <div className="fbk-bar" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <button className="fbk-chip" aria-label="Previous period" onClick={() => step(-1)}>‹</button>
          <label className="fbk-lbl">From<input type="date" className="fbk-in" aria-label="Day book from" value={from} max={today} onChange={e => { setPreset('custom'); setRange([e.target.value || from, to]) }} /></label>
          <label className="fbk-lbl">To<input type="date" className="fbk-in" aria-label="Day book to" value={to} onChange={e => { setPreset('custom'); setRange([from, e.target.value || to]) }} /></label>
          <button className="fbk-chip" aria-label="Next period" onClick={() => step(1)} disabled={to >= today}>›</button>
          <label className="fbk-lbl">Mode<select className="fbk-in" value={mode} onChange={e => setMode(e.target.value)}><option>All</option>{modes.map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="fbk-lbl" style={{ flex: '1 1 180px' }}>Search<input className="fbk-in" placeholder="Name, GCC, receipt, ref, collector…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search receipts" /></label>
        </div>
        <div className="fbk-bar" style={{ marginTop: 12 }}>
          <button className="fbk-chip gold" disabled={!rows} onClick={() => printDayBook(book, from, to)}>🖨️ Print day book</button>
          <button className="fbk-chip gold" disabled={!rows} onClick={() => exportDayBookExcel(book, from, to)}>📊 Excel</button>
          <button className="fbk-chip" onClick={() => { setRows(null); setReload(n => n + 1) }}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="fbk-card" style={{ color: '#b42318' }}>{error}</div>}
      {!rows && !error && <div className="fbk-card fbk-empty">Loading receipts…</div>}
      {rows && (
        <>
          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Collected</b><span style={{ color: '#146c3a' }}>₹{fmt(book.total)}</span><small>{label}</small></div>
            <div className="fbk-kpi"><b>Receipts</b><span>{book.receipts}</span><small>{book.rows.length} line{book.rows.length === 1 ? '' : 's'}</small></div>
            <div className="fbk-kpi"><b>Students</b><span>{book.students}</span><small>paid in this period</small></div>
            <div className="fbk-kpi"><b>Average receipt</b><span>₹{fmt(book.receipts ? Math.round(book.total / book.receipts) : 0)}</span><small>{book.days.length} day{book.days.length === 1 ? '' : 's'} with collections</small></div>
          </div>
          <div className="fbk-split">
            <Bars title="By payment mode" pairs={book.byMode} total={book.total} />
            <Bars title="By fee head" pairs={book.byHead} total={book.total} />
            <Bars title="By collector (cash closing)" pairs={book.byCollector} total={book.total} />
          </div>
          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll" style={{ border: 'none', maxHeight: '70vh' }}>
              <table aria-label="Day book">
                <thead><tr><th>Date</th><th>Receipt</th><th>Student</th><th>Particulars</th><th>For</th><th>Mode</th><th>Collected by</th><th className="num">Amount ₹</th></tr></thead>
                <tbody>
                  {book.days.length === 0 && <tr><td colSpan={8} className="fbk-empty">No receipts for {label}.</td></tr>}
                  {book.days.map(d => [
                    ...d.rows.map((x, i) => (
                      <tr key={`${d.date}-${i}`}>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.date)}</td>
                        <td>{x.receipt ? <button className="fbk-rcpt" title="Reprint receipt" onClick={() => reprintBookReceipt(entries, x.receipt)}>{x.receipt}</button> : <span className="muted">—</span>}</td>
                        <td><LedgerLink gcc={x.student.gcc_no}>{x.student.name}</LedgerLink><div className="muted" style={{ fontSize: 11 }}>GCC-{x.gcc}{x.student.course ? ` · ${x.student.course}` : ''}</div></td>
                        <td>{x.particulars}</td>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>{x.period}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{x.mode || '—'}{x.ref && <div className="muted" style={{ fontSize: 11 }}>{x.ref}</div>}</td>
                        <td>{x.by || <span className="muted">—</span>}</td>
                        <td className="num">{fmt(x.amount)}</td>
                      </tr>
                    )),
                    <tr key={`${d.date}-sub`} className="fbk-day"><td colSpan={7}>{fmtDate(d.date)} · {d.receipts} receipt{d.receipts === 1 ? '' : 's'}</td><td className="num">₹{fmt(d.total)}</td></tr>,
                  ])}
                </tbody>
                {book.days.length > 0 && <tfoot><tr><td colSpan={7}>Total — {label}</td><td className="num">₹{fmt(book.total)}</td></tr></tfoot>}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
