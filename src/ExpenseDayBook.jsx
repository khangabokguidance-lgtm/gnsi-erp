// ExpenseDayBook.jsx — Expenditure Day Book: every confirmed expense in a day
// or date range, grouped by date with subtotals and totals by head, payment
// mode, payee and who entered it. Print and Excel.
import { useMemo, useState } from 'react'
import { fmt, fmtDate } from './feeLedgerModel'
import { presetRange } from './feeBooks'
import { BOOKS_CSS } from './feeBooksCss'
import { expenseBook, printExpenseBook, exportExpenseExcel } from './accountBooks'
import { useAccountRows } from './useAccountRows'
import { BookPeriodBar, Bars } from './BookPeriodBar'

const RED = '#b42318'

export default function ExpenseDayBook({ source }) {
  const { entries, error, refresh } = useAccountRows(source)
  const [period, setPeriod] = useState(() => { const [from, to] = presetRange('today'); return { preset: 'today', from, to } })
  const [q, setQ] = useState('')
  const [head, setHead] = useState('All')
  const [mode, setMode] = useState('All')
  const { from, to } = period

  const expenses = useMemo(() => (entries || []).filter(e => e.type === 'Expense'), [entries])
  const heads = useMemo(() => [...new Set(expenses.map(e => e.head))].sort(), [expenses])
  const modes = useMemo(() => [...new Set(expenses.map(e => e.mode).filter(Boolean))].sort(), [expenses])
  const book = useMemo(() => {
    const t = q.trim().toLowerCase()
    return expenseBook(expenses.filter(e => (head === 'All' || e.head === head) && (mode === 'All' || e.mode === mode) &&
      (!t || [e.head, e.sub, e.party, e.note, e.by, e.account, e.amount].some(v => String(v || '').toLowerCase().includes(t)))), from, to)
  }, [expenses, from, to, q, head, mode])
  const label = from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`
  const biggest = book.rows.reduce((m, x) => x.amount > (m?.amount || 0) ? x : m, null)

  return (
    <div className="fbk">
      <style>{BOOKS_CSS}</style>
      <div className="fbk-card">
        <BookPeriodBar {...period} onChange={setPeriod} label="Expenditure">
          <label className="fbk-lbl">Head<select className="fbk-in" value={head} onChange={e => setHead(e.target.value)}><option>All</option>{heads.map(h => <option key={h}>{h}</option>)}</select></label>
          <label className="fbk-lbl">Mode<select className="fbk-in" value={mode} onChange={e => setMode(e.target.value)}><option>All</option>{modes.map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="fbk-lbl" style={{ flex: '1 1 180px' }}>Search<input className="fbk-in" placeholder="Head, payee, note, entered by…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search expenditure" /></label>
        </BookPeriodBar>
        <div className="fbk-bar" style={{ marginTop: 12 }}>
          <button className="fbk-chip gold" disabled={!entries} onClick={() => printExpenseBook(book, from, to)}>🖨️ Print day book</button>
          <button className="fbk-chip gold" disabled={!entries} onClick={() => exportExpenseExcel(book, from, to)}>📊 Excel</button>
          {refresh && <button className="fbk-chip" onClick={refresh}>↻ Refresh</button>}
        </div>
      </div>

      {error && <div className="fbk-card" style={{ color: RED }}>{error}</div>}
      {!entries && !error && <div className="fbk-card fbk-empty">Loading expenditure…</div>}
      {entries && (
        <>
          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Spent</b><span style={{ color: RED }}>₹{fmt(book.total)}</span><small>{label}</small></div>
            <div className="fbk-kpi"><b>Entries</b><span>{book.count}</span><small>{book.days.length} day{book.days.length === 1 ? '' : 's'} with spending</small></div>
            <div className="fbk-kpi"><b>Daily average</b><span>₹{fmt(book.days.length ? Math.round(book.total / book.days.length) : 0)}</span><small>per spending day</small></div>
            <div className="fbk-kpi"><b>Largest</b><span>₹{fmt(biggest?.amount || 0)}</span><small>{biggest ? `${biggest.head}${biggest.party ? ' · ' + biggest.party : ''}` : '—'}</small></div>
          </div>
          <div className="fbk-split">
            <Bars title="By head" pairs={book.byHead} total={book.total} tone="linear-gradient(90deg,#b42318,#e0584b)" />
            <Bars title="By payment mode" pairs={book.byMode} total={book.total} tone="linear-gradient(90deg,#b42318,#e0584b)" />
            <Bars title="By paid to" pairs={book.byParty.slice(0, 8)} total={book.total} tone="linear-gradient(90deg,#b42318,#e0584b)" />
          </div>
          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll" style={{ border: 'none', maxHeight: '70vh' }}>
              <table aria-label="Expenditure day book">
                <thead><tr><th>Date</th><th>Head</th><th className="num">Amount ₹</th><th>Paid to</th><th>Particulars</th><th>Mode</th><th>Account</th><th>Entered by</th></tr></thead>
                <tbody>
                  {book.days.length === 0 && <tr><td colSpan={8} className="fbk-empty">No expenditure for {label}.</td></tr>}
                  {book.days.map(d => [
                    ...d.rows.map(x => (
                      <tr key={x.id}>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.date)}</td>
                        <td style={{ fontWeight: 700 }}>{x.head}{x.sub && <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>{x.sub}</div>}</td>
                        <td className="num" style={{ color: RED, fontWeight: 700 }}>{fmt(x.amount)}</td>
                        <td>{x.party || <span className="muted">—</span>}</td>
                        <td>{x.note || <span className="muted">—</span>}{x.receipt && <> · <a href={x.receipt} target="_blank" rel="noreferrer" style={{ color: '#1a56db', fontWeight: 700 }}>bill</a></>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{x.mode || '—'}</td>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>{x.account || '—'}</td>
                        <td>{x.by || <span className="muted">—</span>}</td>
                      </tr>
                    )),
                    <tr key={`${d.date}-sub`} className="fbk-day"><td colSpan={2}>{fmtDate(d.date)} · {d.rows.length} entr{d.rows.length === 1 ? 'y' : 'ies'}</td><td className="num" style={{ color: RED }}>₹{fmt(d.total)}</td><td colSpan={5} /></tr>,
                  ])}
                </tbody>
                {book.days.length > 0 && <tfoot><tr><td colSpan={2}>Total — {label}</td><td className="num" style={{ color: RED }}>₹{fmt(book.total)}</td><td colSpan={5} /></tr></tfoot>}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
