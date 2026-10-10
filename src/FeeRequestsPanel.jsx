// FeeRequestsPanel.jsx — the collector's view of low-fee payments waiting for an admin.
// Nothing is recorded until an admin approves; then the collector presses Collect, which
// records the payment and prints the receipt.
import { useCallback, useEffect, useState } from 'react'
import { loadFeeRequests, lowFeeWaUrl } from './feeRequests'
import { printRequestReceipt } from './feeRequestRecord'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const TONE = { pending: ['#9a5b00', '#fff4dc', '⏳ Waiting for admin'], approved: ['#146c3a', '#e7f6ec', '✅ Approved — admin is recording it'], collected: ['#146c3a', '#e7f6ec', '✅ Recorded — receipt ready'], rejected: ['#b42318', '#fde8e6', '✕ Rejected'] }
const sameWho = (a, b) => !!String(a || '').trim() && String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

export default function FeeRequestsPanel({ currentUser, isAdmin, onDone }) {
  const [rows, setRows] = useState([])
  const me = currentUser?.userName || currentUser?.username || currentUser?.name || ''
  const meName = currentUser?.name || ''

  const reload = useCallback(() => {
    loadFeeRequests().then(d => {
      const weekAgo = Date.now() - 7 * 86400000
      setRows((d.rows || []).filter(r => ['pending', 'approved', 'collected', 'rejected'].includes(r.status)
        && new Date(r.decided_at || r.created_at).getTime() >= weekAgo
        && (isAdmin ? !['rejected', 'collected'].includes(r.status) : (sameWho(r.requested_by, me) || sameWho(r.requested_by, meName)))))
    })
  }, [isAdmin, me, meName])
  useEffect(() => { reload(); const t = setInterval(() => { if (document.visibilityState === 'visible') reload() }, 60000); return () => clearInterval(t) }, [reload])

  if (!rows.length) return null
  return (
    <div style={{ margin: '0 0 16px', borderRadius: 20, padding: 1.5, background: 'linear-gradient(150deg,#e9d9b0,#c9a24b 50%,#e9d9b0)', boxShadow: '0 18px 30px -22px rgba(19,42,79,.55)' }}>
      <div style={{ background: 'linear-gradient(180deg,#fff,#f7f4ea)', borderRadius: 19, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', color: '#fff', background: 'linear-gradient(135deg,#0e203f,#1f4e8c)', fontWeight: 800, fontSize: 14 }}>
          🧾 {isAdmin ? 'Low-fee requests' : 'My low-fee requests'} <span style={{ fontWeight: 600, opacity: .75, fontSize: 12 }}>· nothing is recorded until an admin approves</span>
        </div>
        {rows.map(r => {
          const t = TONE[r.status] || TONE.pending, s = r.summary || {}
          return (
            <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', padding: '12px 16px', borderTop: '1px solid #f1ede0' }}>
              <div style={{ flex: '2 1 240px', minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: '#0e203f' }}>{r.student_name || `GCC-${r.gcc}`} <span style={{ color: '#98a2b3', fontWeight: 600, fontSize: 12 }}>GCC-{r.gcc}</span></div>
                <div style={{ fontSize: 12, color: '#5d6b82', marginTop: 2 }}>{(s.months || []).join(', ')} · {(s.reasons || []).join(', ') || '—'}{isAdmin ? ` · by ${r.requested_by || '—'}` : ''}</div>
                {r.status === 'rejected' && <div style={{ fontSize: 12, color: '#b42318', marginTop: 2 }}>Rejected{r.decided_by ? ` by ${r.decided_by}` : ''}{r.decision_note ? ` — “${r.decision_note}”` : ''}. The parent can pay the full standard fee instead.</div>}
              </div>
              <div style={{ fontSize: 12.5, textAlign: 'right' }}>
                <div>Standard {inr(s.standard)} · Pay {inr(s.collected)}</div>
                <div style={{ fontWeight: 800, color: '#b42318' }}>Short {inr(s.shortfall)}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, color: t[0], background: t[1] }}>{t[2]}</span>
              {r.status === 'pending' && (
                <a href={lowFeeWaUrl(r.payload, r.summary, r.requested_by)} target="_blank" rel="noopener noreferrer" style={{ padding: '7px 12px', borderRadius: 10, fontWeight: 800, fontSize: 12.5, textDecoration: 'none', color: '#fff', background: 'linear-gradient(160deg,#25d366,#128c7e)' }}>📲 WhatsApp admin</a>
              )}
              {r.status === 'collected' && (
                <button onClick={() => printRequestReceipt(r)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', color: '#1a1406', background: 'linear-gradient(160deg,#d4ae58,#b8923a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45), 0 8px 14px -8px rgba(184,146,58,.9)' }}>🖨 Print receipt</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
