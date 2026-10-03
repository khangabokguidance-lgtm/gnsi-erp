// ReceiptVerify.jsx — staff tool: confirm a printed receipt is genuine.
// The QR on every fee receipt opens /?verifyReceipt=<no>; staff can also type a
// receipt number here. It looks the number up in the three fee tables and shows
// what the books say (amount, date, student, reverted or not) so an edited or
// forged paper receipt can be spotted.
import { useState } from 'react'
import { supabase } from './supabase'

const TABLES = [
  { table: 'adm_fee_collections', amt: 'amount_paid', label: r => r.description || r.fee_type || 'Admission / item' },
  { table: 'adm_flat_fees',       amt: 'amount',      label: r => `Flat fee ${r.month || ''} ${r.year || ''}`.trim() },
  { table: 'adm_course_fees',     amt: 'amount_paid', label: r => `Course fee ${r.for_month || ''} ${r.year || ''}`.trim() },
]
const inr = v => '₹' + Number(v || 0).toLocaleString('en-IN')

const initialQuery = () => { try { return new URLSearchParams(window.location.search) } catch { return new URLSearchParams() } }

export default function ReceiptVerify() {
  const q0 = initialQuery()
  const [no, setNo] = useState(q0.get('verifyReceipt') || '')
  const [claimAmt, setClaimAmt] = useState(q0.get('amt') || '')
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const check = async () => {
    const key = no.trim()
    if (!key) { setErr('Type or scan a receipt number.'); return }
    setBusy(true); setErr(''); setRows(null)
    try {
      const found = []
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t.table).select('*').eq('receipt_no', key)
        if (error) throw new Error(error.message)
        for (const r of data || []) found.push({ ...r, _amt: Number(r[t.amt]) || 0, _what: t.label(r), _table: t.table })
      }
      setRows(found)
    } catch (e) { setErr(e.message || 'Could not check the receipt.') }
    setBusy(false)
  }

  const live = (rows || []).filter(r => !r.reverted)
  const total = live.reduce((s, r) => s + r._amt, 0)
  const claimed = Number(claimAmt)
  const amountOk = !claimAmt || (Number.isFinite(claimed) && Math.abs(claimed - total) < 0.5)

  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e8e3d8', padding: '18px 20px', maxWidth: 760 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a6e' }}>🔎 Verify Receipt</div>
      <div style={{ fontSize: 12, color: '#8a93a6', margin: '4px 0 14px' }}>Scan the QR on a printed receipt, or type its number, to confirm it matches the books.</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={no} onChange={e => setNo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') check() }} placeholder="Receipt number e.g. INV-20260619122536" aria-label="Receipt number"
          style={{ flex: '1 1 260px', padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e3d8', fontSize: 13 }} />
        <input value={claimAmt} onChange={e => setClaimAmt(e.target.value)} placeholder="Amount on paper (optional)" aria-label="Amount printed on the receipt"
          style={{ flex: '0 1 180px', padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e3d8', fontSize: 13 }} />
        <button type="button" onClick={check} disabled={busy} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#1e3a6e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Checking…' : 'Verify'}</button>
      </div>
      {err && <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 12.5, fontWeight: 600 }}>{err}</div>}
      {rows && rows.length === 0 && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontWeight: 700, fontSize: 13 }}>
          ❌ No record of receipt “{no.trim()}”. It may be forged, mistyped, or from before the system.
        </div>
      )}
      {rows && rows.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ padding: 14, borderRadius: 10, fontWeight: 700, fontSize: 13,
            background: live.length && amountOk ? '#f0fdf4' : '#fffbeb', border: `1px solid ${live.length && amountOk ? '#86efac' : '#fcd34d'}`, color: live.length && amountOk ? '#166534' : '#92400e' }}>
            {live.length === 0 ? '⚠️ This receipt exists but every line has been REVERTED.'
              : !amountOk ? `⚠️ Receipt found, but the books say ${inr(total)} — the paper says ${inr(claimed)}. Possible alteration.`
              : `✅ Genuine — ${live.length} line${live.length > 1 ? 's' : ''}, total ${inr(total)}.`}
          </div>
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: 'left', color: '#5d6b82' }}><th style={{ padding: 6 }}>Student</th><th>GCC</th><th>For</th><th>Date</th><th>Mode</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r._table + r.id} style={{ borderTop: '1px solid #f0ece0' }}>
                  <td style={{ padding: 6, fontWeight: 700 }}>{r.student_name || '—'}</td><td>GCC-{r.adm_app_id}</td><td>{r._what}</td><td>{r.pay_date || '—'}</td><td>{r.pay_mode || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{inr(r._amt)}</td>
                  <td style={{ color: r.reverted ? '#b91c1c' : '#166534', fontWeight: 700 }}>{r.reverted ? 'Reverted' : 'Valid'}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
