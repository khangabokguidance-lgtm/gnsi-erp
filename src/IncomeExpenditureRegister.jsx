// IncomeExpenditureRegister.jsx — Income & Expenditure Register (cash book):
// receipts and payments side by side for each day, with the opening balance
// brought forward, the day's totals and the closing balance; plus an Income &
// Expenditure account by head showing the surplus or deficit. The balance can
// track all money, cash in hand only, or bank/UPI/card only.
import { useMemo, useState } from 'react'
import { fmt, fmtDate } from './feeLedgerModel'
import { presetRange } from './feeBooks'
import { BOOKS_CSS } from './feeBooksCss'
import { cashBook, printCashBook, exportCashBookExcel, MONEY_LABEL } from './accountBooks'
import { useAccountRows } from './useAccountRows'
import { BookPeriodBar } from './BookPeriodBar'

const GREEN = '#146c3a', RED = '#b42318', INK = '#1d3a78'
const bal = v => <span style={{ color: v < 0 ? RED : INK }}>{v < 0 ? `−₹${fmt(-v)}` : `₹${fmt(v)}`}</span>

const REG_CSS = `
.ier-day{border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:12px;background:#fff}
.ier-dayh{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 14px;align-items:center;padding:9px 14px;background:linear-gradient(90deg,#0b1e3d,#1d3a78);color:#fff;font-size:12.5px}
.ier-dayh b{font-family:'Playfair Display',Georgia,serif;font-size:15px}
.ier-dayh span{opacity:.9;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px}
.ier-two{display:grid;grid-template-columns:1fr 1fr}
.ier-two>div+div{border-left:2px solid #e7ebf3}
.ier-side h5{margin:0;padding:7px 12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}
.ier-row{display:flex;justify-content:space-between;gap:10px;padding:6px 12px;border-top:1px solid #f0f2f7;font-size:12.5px}
.ier-row small{display:block;color:var(--sub);font-size:11px}
.ier-tot{display:flex;justify-content:space-between;padding:7px 12px;font-weight:800;background:#fbf8ef;border-top:1px solid #efe4c6;font-size:12.5px}
.ier-ie{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:640px){.ier-two,.ier-ie{grid-template-columns:1fr}.ier-two>div+div{border-left:none;border-top:2px solid #e7ebf3}}
`

function Side({ title, rows, tone, total }) {
  return (
    <div className="ier-side">
      <h5 style={{ color: tone, background: tone === GREEN ? '#eef8f1' : '#fdf0ee' }}>{title}</h5>
      {rows.length === 0 ? <div className="ier-row muted">—</div> : rows.map(x => (
        <div key={x.id} className="ier-row">
          <div>{x.head}{x.party ? <span className="muted"> · {x.party}</span> : ''}<small>{[x.note, x.mode].filter(Boolean).join(' · ')}</small></div>
          <b className="num" style={{ color: tone }}>{fmt(x.amount)}</b>
        </div>
      ))}
      <div className="ier-tot"><span>Total</span><span className="num" style={{ color: tone }}>₹{fmt(total)}</span></div>
    </div>
  )
}

function HeadTable({ title, pairs, total, tone }) {
  return (
    <div className="fbk-card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
      <table>
        <thead><tr><th>{title}</th><th className="num">₹</th><th className="num">%</th></tr></thead>
        <tbody>
          {pairs.length === 0 && <tr><td colSpan={3} className="muted">—</td></tr>}
          {pairs.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num" style={{ color: tone }}>{fmt(v)}</td><td className="num muted">{total ? Math.round((v / total) * 100) : 0}%</td></tr>)}
        </tbody>
        <tfoot><tr><td>Total</td><td className="num" style={{ color: tone }}>{fmt(total)}</td><td /></tr></tfoot>
      </table>
    </div>
  )
}

export default function IncomeExpenditureRegister({ source }) {
  const { entries, error, refresh } = useAccountRows(source)
  const [period, setPeriod] = useState(() => { const [from, to] = presetRange('month'); return { preset: 'month', from, to } })
  const [money, setMoney] = useState('all')
  const [view, setView] = useState('days') // 'days' | 'table' | 'heads'
  const { from, to } = period
  const cb = useMemo(() => cashBook(entries || [], from, to, money), [entries, from, to, money])
  const net = cb.totalIn - cb.totalOut
  const label = from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`

  return (
    <div className="fbk">
      <style>{BOOKS_CSS + REG_CSS}</style>
      <div className="fbk-card">
        <BookPeriodBar {...period} onChange={setPeriod} label="Register">
          <label className="fbk-lbl">Balance of<select className="fbk-in" value={money} onChange={e => setMoney(e.target.value)} aria-label="Balance of">{Object.entries(MONEY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </BookPeriodBar>
        <div className="fbk-bar" style={{ marginTop: 12 }}>
          {[['days', '📖 Day-wise'], ['table', '📋 Daily summary'], ['heads', '⚖️ Income & Expenditure a/c']].map(([k, l]) => <button key={k} className={`fbk-chip${view === k ? ' on' : ''}`} onClick={() => setView(k)}>{l}</button>)}
          <span style={{ flex: 1 }} />
          <button className="fbk-chip gold" disabled={!entries} onClick={() => printCashBook(cb, from, to, money)}>🖨️ Print register</button>
          <button className="fbk-chip gold" disabled={!entries} onClick={() => exportCashBookExcel(cb, from, to, money)}>📊 Excel</button>
          {refresh && <button className="fbk-chip" onClick={refresh}>↻ Refresh</button>}
        </div>
      </div>

      {error && <div className="fbk-card" style={{ color: RED }}>{error}</div>}
      {!entries && !error && <div className="fbk-card fbk-empty">Loading accounts…</div>}
      {entries && (
        <>
          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Opening balance</b><span>{bal(cb.opening)}</span><small>brought forward to {fmtDate(from)}</small></div>
            <div className="fbk-kpi"><b>Income</b><span style={{ color: GREEN }}>₹{fmt(cb.totalIn)}</span><small>{label}</small></div>
            <div className="fbk-kpi"><b>Expenditure</b><span style={{ color: RED }}>₹{fmt(cb.totalOut)}</span><small>{label}</small></div>
            <div className="fbk-kpi"><b>{net >= 0 ? 'Surplus' : 'Deficit'}</b><span style={{ color: net >= 0 ? GREEN : RED }}>₹{fmt(Math.abs(net))}</span><small>income − expenditure</small></div>
            <div className="fbk-kpi"><b>Closing balance</b><span>{bal(cb.closing)}</span><small>{MONEY_LABEL[money]}</small></div>
          </div>

          {view === 'days' && (cb.days.length === 0 ? <div className="fbk-card fbk-empty">No income or expenditure for {label}.</div> : cb.days.map(d => (
            <div key={d.date} className="ier-day">
              <div className="ier-dayh"><b>{fmtDate(d.date)}</b><span>Opening ₹{fmt(d.open)} · +₹{fmt(d.in)} · −₹{fmt(d.out)} · Closing ₹{fmt(d.close)}</span></div>
              <div className="ier-two">
                <Side title="Receipts · Income" rows={d.receipts} tone={GREEN} total={d.in} />
                <Side title="Payments · Expenditure" rows={d.payments} tone={RED} total={d.out} />
              </div>
            </div>
          )))}

          {view === 'table' && (
            <div className="fbk-card" style={{ padding: 0 }}>
              <div className="fbk-scroll" style={{ border: 'none', maxHeight: '70vh' }}>
                <table aria-label="Daily summary">
                  <thead><tr><th>Date</th><th className="num">Opening</th><th className="num">Income</th><th className="num">Expenditure</th><th className="num">Net</th><th className="num">Closing</th></tr></thead>
                  <tbody>
                    {cb.days.length === 0 && <tr><td colSpan={6} className="fbk-empty">No entries for {label}.</td></tr>}
                    {cb.days.map(d => (
                      <tr key={d.date}><td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td><td className="num">{bal(d.open)}</td><td className="num" style={{ color: GREEN }}>{fmt(d.in)}</td><td className="num" style={{ color: RED }}>{fmt(d.out)}</td><td className="num" style={{ color: d.in - d.out >= 0 ? GREEN : RED }}>{d.in - d.out >= 0 ? '+' : '−'}{fmt(Math.abs(d.in - d.out))}</td><td className="num" style={{ fontWeight: 800 }}>{bal(d.close)}</td></tr>
                    ))}
                  </tbody>
                  {cb.days.length > 0 && <tfoot><tr><td>Total</td><td className="num">{bal(cb.opening)}</td><td className="num" style={{ color: GREEN }}>{fmt(cb.totalIn)}</td><td className="num" style={{ color: RED }}>{fmt(cb.totalOut)}</td><td className="num" style={{ color: net >= 0 ? GREEN : RED }}>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}</td><td className="num">{bal(cb.closing)}</td></tr></tfoot>}
                </table>
              </div>
            </div>
          )}

          {view === 'heads' && (
            <>
              <div className="ier-ie">
                <HeadTable title="Income head" pairs={cb.incomeByHead} total={cb.totalIn} tone={GREEN} />
                <HeadTable title="Expenditure head" pairs={cb.expenseByHead} total={cb.totalOut} tone={RED} />
              </div>
              <div className="fbk-card" style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: net >= 0 ? '#eef8f1' : '#fdf0ee' }}>
                <b style={{ color: net >= 0 ? GREEN : RED }}>{net >= 0 ? 'Surplus — income exceeds expenditure' : 'Deficit — expenditure exceeds income'}</b>
                <span className="num" style={{ fontSize: 20, fontWeight: 800, color: net >= 0 ? GREEN : RED }}>₹{fmt(Math.abs(net))}</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
