// TodayIncomeBreakdown.jsx — "Where does today's income come from?"
// Opened from the Today's Total Income card (Fees) and Today's Income card
// (Accounts). Splits the Accounts figure into fee payments, store sales and
// manual entries, and cross-checks the fee entries against the fee records.
import { useEffect, useState } from 'react'
import { loadTodayIncome } from './incomeReconcile'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const time = t => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''

export default function TodayIncomeBreakdown({ onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState({})
  useEffect(() => {
    let live = true
    loadTodayIncome().then(d => { if (live) setData(d) }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [])

  // What the two screens show: Accounts' recorded income minus Fees' fee payments.
  const other = data ? data.recordedTotal - data.feeTableTotal : 0
  return (
    <div role="region" aria-label="Today's income breakdown" style={{ background: 'white', borderRadius: 14, border: '1px solid #a5f3fc', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
      <div style={{ background: '#ecfeff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #a5f3fc' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0e7490' }}>📊 Where today's income comes from{data ? ` — ${fmtD(data.date)}` : ''}</div>
        {onClose && <button onClick={onClose} aria-label="Close breakdown" style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer', color: '#0e7490' }}>✕</button>}
      </div>
      {error && <div style={{ padding: 16, color: '#b42318', fontSize: 13 }}>Could not load the breakdown: {error}</div>}
      {!data && !error && <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>Loading…</div>}
      {data && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: '#1f2a44' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
            {[
              ['Recorded in Accounts today', inr(data.recordedTotal), `${data.recordedCount} entries · what Accounts shows`, '#0e7490'],
              ['Fee payments paid today', inr(data.feeTableTotal), `${data.feeTableCount} fee lines · what Fees shows`, '#a7771f'],
              ['Difference', inr(other), 'Accounts minus Fees — explained below', other ? '#b42318' : '#047857'],
              ['Money actually received today', inr(data.receivedTotal), 'by payment date, all income', '#1d3a78'],
            ].map(([l, v, s, c]) => (
              <div key={l} style={{ border: '1px solid #e8e3d8', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5d6b82' }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c, marginTop: 3 }}>{v}</div>
                <div style={{ fontSize: 11, color: '#98a2b3', marginTop: 2 }}>{s}</div>
              </div>
            ))}
          </div>

          <div style={{ border: '1px solid #e8e3d8', borderRadius: 12, overflow: 'hidden' }}>
            {data.groups.length === 0 && <div style={{ padding: 14, color: '#64748b' }}>No income recorded today.</div>}
            {data.groups.map(g => (
              <div key={g.key} style={{ borderTop: '1px solid #f1f5f9' }}>
                <button onClick={() => setOpen(o => ({ ...o, [g.key]: !o[g.key] }))} aria-expanded={!!open[g.key]}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: open[g.key] ? '#f8fafc' : 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontWeight: 700, color: g.tone }}>{open[g.key] ? '▾' : '▸'} {g.label} <span style={{ color: '#98a2b3', fontWeight: 600 }}>· {g.rows.length}</span></span>
                  <b style={{ color: g.tone, fontVariantNumeric: 'tabular-nums' }}>{inr(g.total)}</b>
                </button>
                {open[g.key] && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr style={{ background: '#f8fafc', color: '#5d6b82', textAlign: 'left' }}>{['Entered', 'Head', 'Details', 'Paid on', 'Mode', 'By', 'Amount'].map(h => <th key={h} style={{ padding: '6px 10px', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                      <tbody>{g.rows.map(r => (
                        <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>{time(r.created_at) || fmtD(r.entry_date)}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700 }}>{r.category || '—'}</td>
                          <td style={{ padding: '6px 10px' }}>{r.note || r.description || '—'}</td>
                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: r.paidOn !== data.date ? '#b42318' : '#64748b', fontWeight: r.paidOn !== data.date ? 700 : 400 }}>{fmtD(r.paidOn)}</td>
                          <td style={{ padding: '6px 10px' }}>{r.payment_mode || '—'}</td>
                          <td style={{ padding: '6px 10px' }}>{r.added_by || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{inr(r.amount)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          {data.acctFeeTotal !== data.feeTableTotal && (
            <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12, padding: '10px 14px', color: '#9a3412' }}>
              <b>Fee records and Accounts disagree for today:</b> fee tables {inr(data.feeTableTotal)} vs fee entries in Accounts {inr(data.acctFeeTotal)}.
              {data.inAccountsNotFees.length > 0 && <div style={{ marginTop: 6 }}>In Accounts but no matching fee payment (possibly reversed): {data.inAccountsNotFees.map(r => `${r.receipt} ${inr(r.amount)}`).join(', ')}</div>}
              {data.inFeesNotAccounts.length > 0 && <div style={{ marginTop: 6 }}>Fee paid but missing from Accounts: {data.inFeesNotAccounts.map(p => `${p.receipt} ${p.name || ''} ${inr(p.amount)}`).join(', ')}</div>}
            </div>
          )}
          {data.pending.length > 0 && <div style={{ fontSize: 12, color: '#64748b' }}>{data.pending.length} pending income entr{data.pending.length === 1 ? 'y' : 'ies'} ({inr(data.pendingTotal)}) {data.pending.length === 1 ? 'is' : 'are'} waiting for approval and not counted.</div>}
        </div>
      )}
    </div>
  )
}
