// PublicReceiptCheck.jsx — opens when someone scans the QR on a fee receipt
// (/?verifyReceipt=<no>&gcc=<gcc>&amt=<amount>) on the public site. Asks the
// database for a yes/no on that receipt + GCC pair and compares the amount
// printed on the paper. Shows no name or other student data.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { receiptCheckParams } from './lib/receiptCheckParams'

const inr = v => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function PublicReceiptCheck({ onClose }) {
  const [params] = useState(receiptCheckParams)
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    if (!params) return
    let live = true
    supabase.rpc('verify_public_receipt', { p_receipt: params.receipt, p_gcc: params.gcc })
      .then(({ data, error }) => { if (live) setState(error ? { error: true } : { row: Array.isArray(data) ? data[0] : data }) })
      .catch(() => { if (live) setState({ error: true }) })
    return () => { live = false }
  }, [params])

  if (!params) return null
  const row = state.row
  const paperAmt = Number(params.amt)
  const amountMatches = !params.amt || (Number.isFinite(paperAmt) && row && Math.abs(Number(row.total) - paperAmt) < 0.5)
  let verdict, color, bg
  if (state.loading) { verdict = 'Checking this receipt…'; color = '#475569'; bg = '#f1f5f9' }
  else if (state.error) { verdict = 'Could not check right now. Please try again, or contact the institute office.'; color = '#92400e'; bg = '#fffbeb' }
  else if (!row?.found) { verdict = '❌ No such receipt was found for this student ID. Please contact the institute office.'; color = '#991b1b'; bg = '#fef2f2' }
  else if (row.all_reverted) { verdict = '⚠️ This receipt was cancelled (reversed) by the institute. Please contact the office.'; color = '#92400e'; bg = '#fffbeb' }
  else if (!amountMatches) { verdict = `⚠️ The institute's records show ${inr(row.total)} for this receipt, which does not match the amount on your paper. Please contact the office.`; color = '#92400e'; bg = '#fffbeb' }
  else { verdict = `✅ Genuine receipt — ${inr(row.total)} received${row.pay_date ? ' on ' + new Date(row.pay_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}.`; color = '#166534'; bg = '#f0fdf4' }

  return (
    <div role="dialog" aria-modal="true" aria-label="Receipt check" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,27,46,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '22px 22px 18px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e3a6e', marginBottom: 4 }}>🔎 Receipt check</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Receipt <b>{params.receipt}</b> · Student ID <b>{params.gcc || '—'}</b></div>
        <div style={{ padding: 14, borderRadius: 10, background: bg, color, fontWeight: 700, fontSize: 13.5, lineHeight: 1.5 }}>{verdict}</div>
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 20px', borderRadius: 999, border: 'none', background: '#1e3a6e', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  )
}
