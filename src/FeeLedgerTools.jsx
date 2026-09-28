// FeeLedgerTools.jsx — advanced views for the Student Fee Ledger: the Dr/Cr
// account statement and payment insights (print/WhatsApp/Excel actions live in
// feeLedgerActions.js). Numbers come from feeLedgerModel.js, like the register.
import { useMemo, useState } from 'react'
import { fmt, fmtDate, shortSession, buildStatement, computeInsights } from './feeLedgerModel'
import { printStatement } from './feeLedgerActions'

const INK = '#1d3a78', RED = '#b42318', GREEN = '#146c3a', SUB = '#6b7690'

// ── Account statement ────────────────────────────────────────────────────────
export function StatementView({ student, entries, reg, session, openingBalance, rates }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const st = useMemo(() => buildStatement(student, entries, session, reg, { openingBalance, from: from || null, to: to || null }), [student, entries, session, reg, openingBalance, from, to])
  const bal = v => <span style={{ color: v > 0 ? RED : v < 0 ? GREEN : INK }}>{v < 0 ? `${fmt(-v)} Cr` : `${fmt(v)}${v > 0 ? ' Dr' : ''}`}</span>
  return (
    <div className="frb-sec">
      <div className="frb-sech">
        <h3>Statement of account — {shortSession(session)}</h3>
        <div className="frb-tabs" style={{ fontSize: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: SUB, fontWeight: 700 }}>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="Statement from" className="frb-date" /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: SUB, fontWeight: 700 }}>To <input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="Statement to" className="frb-date" /></label>
          {(from || to) && <button className="frb-chip" onClick={() => { setFrom(''); setTo('') }}>Whole session</button>}
          <button className="frb-chip" onClick={() => printStatement(student, st, session, from, to)}>🖨️ Print statement</button>
        </div>
      </div>
      {!rates && <div style={{ color: SUB, fontSize: 12.5, margin: '0 0 8px' }}>Loading fee rates…</div>}
      <div className="frb-scroll">
        <table>
          <thead><tr><th>Date</th><th>Particulars</th><th>Receipt</th><th style={{ textAlign: 'right' }}>Debit (₹)</th><th style={{ textAlign: 'right' }}>Credit (₹)</th><th style={{ textAlign: 'right' }}>Balance (₹)</th></tr></thead>
          <tbody>
            <tr><td className="hand">{from ? fmtDate(from) : `01 Apr ${session.slice(0, 4)}`}</td><td style={{ fontWeight: 700 }}>{from ? 'Opening balance' : openingBalance ? `Brought forward from ${shortSession(`${Number(session.slice(0, 4)) - 1}-${session.slice(0, 4)}`)} (unpaid dues)` : 'Opening balance'}</td><td /><td /><td /><td className="num">{bal(st.opening)}</td></tr>
            {st.lines.map((l, i) => (
              <tr key={i}>
                <td>{fmtDate(l.date)}</td>
                <td style={{ fontWeight: l.kind === 'payment' ? 600 : 400, color: l.kind === 'payment' ? GREEN : '#1f2a44' }}>{l.particulars}{l.note && <span className="muted" title={l.note}> · {l.note}</span>}</td>
                <td>{l.receipt ? <span className="frb-rcpt" style={{ textDecoration: 'none', cursor: 'default' }}>{l.receipt}</span> : <span className="muted">—</span>}</td>
                <td className="num">{l.debit ? fmt(l.debit) : ''}</td>
                <td className="num" style={{ color: GREEN }}>{l.credit ? fmt(l.credit) : ''}</td>
                <td className="num">{bal(l.balance)}</td>
              </tr>
            ))}
            {st.lines.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center' }}>No entries in this period.</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={3}>Closing balance {st.closing > 0 ? '(payable)' : st.closing < 0 ? '(in credit)' : '(settled)'}</td><td className="num">{fmt(st.debits)}</td><td className="num">{fmt(st.credits)}</td><td className="num">{bal(st.closing)}</td></tr></tfoot>
        </table>
      </div>
      {st.shortPaid > 0 && <div style={{ fontSize: 12, color: '#9a5b00', marginTop: 8 }}>Includes ₹{fmt(st.shortPaid)} short-paid on month(s) marked SHORT in the register — check the payment note for an approved discount.</div>}
    </div>
  )
}

function InsightCard({ label, value, sub, tone }) {
  return <div className="frb-sumc"><b>{label}</b><span style={{ color: tone || INK }}>{value}</span>{sub && <div style={{ fontSize: 11.5, color: SUB, marginTop: 3 }}>{sub}</div>}</div>
}

// ── Insights ─────────────────────────────────────────────────────────────────
export function InsightsView({ student, entries, reg, session, rates, onJump }) {
  const ins = useMemo(() => computeInsights(student, entries, reg), [student, entries, reg])
  const modeTotal = ins.modes.reduce((s, [, v]) => s + v, 0) || 1
  const TILE = { paid: '#1f9d57', advance: '#1a73e8', short: '#e0a100', due: '#d93025', upcoming: '#dfe3ea', before: '#f1f1f1' }
  return (
    <div className="frb-sec">
      <div className="frb-sech"><h3>Payment insights — {shortSession(session)}</h3></div>
      <div role="list" aria-label="Month status strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 4, marginBottom: 6 }}>
        {reg.rows.map(r => (
          <button key={r.month} role="listitem" title={`${r.month} ${r.year}: ${r.status}`} onClick={() => onJump?.()} style={{ height: 34, borderRadius: 7, border: 'none', cursor: 'pointer', background: TILE[r.status], color: ['upcoming', 'before'].includes(r.status) ? '#6b7690' : '#fff', fontSize: 10.5, fontWeight: 800 }}>
            {r.month.slice(0, 1)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: SUB, marginBottom: 14 }}>
        {[['paid', 'Paid'], ['advance', 'Advance'], ['short', 'Short'], ['due', 'Due'], ['upcoming', 'Upcoming']].map(([k, l]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: TILE[k], display: 'inline-block' }} />{l}</span>)}
      </div>
      <div className="frb-sum" style={{ margin: 0 }}>
        <InsightCard label="Collected so far" value={ins.collectionPct == null ? '—' : `${ins.collectionPct}%`} sub="of fees due to date" tone={ins.collectionPct >= 100 ? GREEN : ins.collectionPct >= 75 ? INK : RED} />
        <InsightCard label="On-time payments" value={ins.onTimePct == null ? '—' : `${ins.onTimePct}%`} sub="paid within 10 days of the month" tone={ins.onTimePct >= 80 ? GREEN : ins.onTimePct >= 50 ? INK : RED} />
        <InsightCard label="Average delay" value={ins.avgDelay == null ? '—' : `${ins.avgDelay} days`} sub={ins.maxDelay != null ? `longest ${ins.maxDelay} days` : 'no monthly payments yet'} />
        <InsightCard label="Last payment" value={ins.last ? `₹${fmt(ins.last.amount)}` : '—'} sub={ins.last ? `${fmtDate(ins.last.date)} · ${ins.daysSinceLast} day${ins.daysSinceLast === 1 ? '' : 's'} ago` : 'none recorded'} />
        <InsightCard label="Session total" value={rates ? `₹${fmt(ins.sessionTotal)}` : '…'} sub={rates ? `₹${fmt(ins.stillToCome)} still to come · ${ins.upcomingCount} month${ins.upcomingCount === 1 ? '' : 's'}` : ''} />
        <InsightCard label="Next fee" value={ins.nextDue || '—'} sub={ins.advanceMonths ? `${ins.advanceMonths} month${ins.advanceMonths === 1 ? '' : 's'} paid in advance` : ins.shortMonths ? `${ins.shortMonths} month${ins.shortMonths === 1 ? '' : 's'} short-paid` : ''} />
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: SUB, marginBottom: 6 }}>Payment modes (all time)</div>
        {ins.modes.length === 0 ? <div className="muted" style={{ fontSize: 12.5 }}>No payments yet.</div> : (
          <>
            <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: '#eef1f6' }}>
              {ins.modes.map(([m, v], i) => <div key={m} title={`${m}: ₹${fmt(v)}`} style={{ width: `${(v / modeTotal) * 100}%`, background: ['#1d3a78', '#b8923a', '#1f9d57', '#7c3aed', '#0891b2', '#94a3b8'][i % 6] }} />)}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: '#2e3b52' }}>
              {ins.modes.map(([m, v], i) => <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, display: 'inline-block', background: ['#1d3a78', '#b8923a', '#1f9d57', '#7c3aed', '#0891b2', '#94a3b8'][i % 6] }} />{m} · ₹{fmt(v)} ({Math.round((v / modeTotal) * 100)}%)</span>)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

