// FeeMonthCollection.jsx — Month-wise Collection Ledger: pick a session and a
// month; every receipt taken that month is listed by day with subtotals, plus
// totals by payment mode and fee head. The strip on top shows each month's
// collection for the session so any month is one click away.
import { useEffect, useMemo, useState } from 'react'
import { getSessionYear } from './feeEngine'
import { loadAllFeeRows } from './feeLedgerBulk'
import { fmt, fmtDate, shortSession } from './feeLedgerModel'
import { allEntries, dayBook, localISO, printDayBook, exportDayBookExcel, reprintBookReceipt } from './feeBooks'
import { BOOKS_CSS } from './feeBooksCss'
import { LedgerLink } from './LedgerLinks'

const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']

// Session "2025-2026" + month index 0..11 (April first) → [first day, last day, year].
function monthSpan(session, i) {
  const y0 = Number(session.slice(0, 4))
  const year = i < 9 ? y0 : y0 + 1
  const m = (i + 3) % 12
  return [localISO(new Date(year, m, 1)), localISO(new Date(year, m + 1, 0)), year]
}

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

export default function FeeMonthCollection({ students }) {
  const current = getSessionYear()
  const sessions = useMemo(() => { const y = Number(current.slice(0, 4)); return [0, 1, 2].map(k => `${y - k}-${y - k + 1}`) }, [current])
  const [session, setSession] = useState(current)
  const [month, setMonth] = useState(() => { const m = new Date().getMonth(); return (m + 9) % 12 })
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [q, setQ] = useState('')

  useEffect(() => {
    let live = true
    loadAllFeeRows().then(r => { if (live) { setRows(r); setError('') } }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [reload])

  const entries = useMemo(() => rows ? allEntries(students || [], rows) : [], [rows, students])
  const strip = useMemo(() => MONTHS.map((name, i) => {
    const [from, to, year] = monthSpan(session, i)
    const b = dayBook(entries, from, to)
    return { name, year, total: b.total, receipts: b.receipts }
  }), [entries, session])
  const sessionTotal = strip.reduce((s, m) => s + m.total, 0)

  const [from, to, year] = monthSpan(session, month)
  const book = useMemo(() => {
    const t = q.trim().toLowerCase()
    const pool = t ? entries.filter(e => [e.student.name, e.gcc, e.receipt, e.ref, e.by, e.particulars].some(v => String(v || '').toLowerCase().includes(t))) : entries
    return dayBook(pool, from, to)
  }, [entries, from, to, q])
  const label = `${MONTHS[month]} ${year}`

  return (
    <div className="fbk">
      <style>{BOOKS_CSS}</style>
      <div className="fbk-card">
        <div className="fbk-bar" style={{ alignItems: 'flex-end' }}>
          <label className="fbk-lbl">Session<select className="fbk-in" value={session} onChange={e => setSession(e.target.value)}>{sessions.map(s => <option key={s} value={s}>{shortSession(s)}</option>)}</select></label>
          <label className="fbk-lbl" style={{ flex: '1 1 180px' }}>Search<input className="fbk-in" placeholder="Name, GCC, receipt, ref, collector…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search month ledger" /></label>
          <button className="fbk-chip gold" disabled={!rows} onClick={() => printDayBook(book, from, to)}>🖨️ Print month</button>
          <button className="fbk-chip gold" disabled={!rows} onClick={() => exportDayBookExcel(book, from, to)}>📊 Excel</button>
          <button className="fbk-chip" onClick={() => { setRows(null); setReload(n => n + 1) }}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="fbk-card" style={{ color: '#b42318' }}>{error}</div>}
      {!rows && !error && <div className="fbk-card fbk-empty">Loading receipts…</div>}
      {rows && (
        <>
          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll" style={{ border: 'none' }}>
              <table aria-label="Collection by month">
                <thead><tr><th>Month</th><th className="num">Receipts</th><th className="num">Collected ₹</th></tr></thead>
                <tbody>
                  {strip.map((m, i) => (
                    <tr key={m.name} onClick={() => setMonth(i)} style={{ cursor: 'pointer', background: i === month ? '#f3f6fd' : undefined, fontWeight: i === month ? 800 : 400 }}>
                      <td>{m.name} {m.year}</td><td className="num">{m.receipts || '—'}</td><td className="num">{m.total ? fmt(m.total) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={2}>Session {shortSession(session)}</td><td className="num">₹{fmt(sessionTotal)}</td></tr></tfoot>
              </table>
            </div>
          </div>

          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Collected</b><span style={{ color: '#146c3a' }}>₹{fmt(book.total)}</span><small>{label}</small></div>
            <div className="fbk-kpi"><b>Receipts</b><span>{book.receipts}</span><small>{book.rows.length} line{book.rows.length === 1 ? '' : 's'}</small></div>
            <div className="fbk-kpi"><b>Students</b><span>{book.students}</span><small>paid in {MONTHS[month]}</small></div>
            <div className="fbk-kpi"><b>Share of session</b><span>{sessionTotal ? Math.round((book.total / sessionTotal) * 100) : 0}%</span><small>{book.days.length} day{book.days.length === 1 ? '' : 's'} with collections</small></div>
          </div>
          <div className="fbk-split">
            <Bars title="By payment mode" pairs={book.byMode} total={book.total} />
            <Bars title="By fee head" pairs={book.byHead} total={book.total} />
            <Bars title="By collector" pairs={book.byCollector} total={book.total} />
          </div>
          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll" style={{ border: 'none', maxHeight: '70vh' }}>
              <table aria-label="Month-wise collection ledger">
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
