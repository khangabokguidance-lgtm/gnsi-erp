// TodayExpenseBreakdown.jsx — "Where did today's expense go?"
// Opened from the Today's Expense card in Accounts. Splits the figure shown on
// the card (confirmed expense entries dated today) by category, then by
// payment mode, and lists every entry with who took it and who was paid.
import { useMemo, useState } from 'react'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const time = t => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''
const SERIF = "'Fraunces',Georgia,serif"

export default function TodayExpenseBreakdown({ rows = [], vendors = [], date, onClose }) {
  const [open, setOpen] = useState({})
  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows])
  const groups = useMemo(() => {
    const m = new Map()
    rows.forEach(r => {
      const k = r.category || 'Uncategorized'
      if (!m.has(k)) m.set(k, { key: k, rows: [], total: 0 })
      const g = m.get(k)
      g.rows.push(r)
      g.total += Number(r.amount) || 0
    })
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [rows])
  const byMode = useMemo(() => {
    const m = new Map()
    rows.forEach(r => { const k = r.payment_mode || 'Unknown'; m.set(k, (m.get(k) || 0) + (Number(r.amount) || 0)) })
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])
  const vendorName = id => vendors.find(v => String(v.id) === String(id))?.name || ''

  return (
    <div role="region" aria-label="Today's expense breakdown" style={{ background: 'white', borderRadius: 18, border: '1px solid #fecaca', overflow: 'hidden', boxShadow: '0 1px 2px rgba(19,42,79,.05), 0 18px 40px -22px rgba(127,29,29,.35)' }}>
      <div style={{ background: 'linear-gradient(135deg,#fff5f5,#fdecec)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #fecaca' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: '#b8923a' }}>Breakdown</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#7f1d1d', fontFamily: SERIF, marginTop: 2 }}>Where today's expense went{date ? ` — ${new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}</div>
        </div>
        {onClose && <button onClick={onClose} aria-label="Close breakdown" style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#7f1d1d' }}>✕</button>}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: '#1f2a44' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          {[
            ['Total expense today', inr(total), `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} · matches the card`, '#b91c1c'],
            ...byMode.map(([m, v]) => [`Paid by ${m}`, inr(v), `${total ? ((v / total) * 100).toFixed(1) : 0}% of today`, '#1e3a6e']),
          ].map(([l, v, s, c]) => (
            <div key={l} style={{ border: '1px solid #e8e3d8', borderRadius: 14, padding: '12px 14px', borderTop: `2px solid ${c}55` }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#5d6b82' }}>{l}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: c, marginTop: 4, fontFamily: SERIF, fontVariantNumeric: 'lining-nums tabular-nums' }}>{v}</div>
              <div style={{ fontSize: 11, color: '#98a2b3', marginTop: 2 }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid #e8e3d8', borderRadius: 14, overflow: 'hidden' }}>
          {groups.length === 0 && <div style={{ padding: 16, color: '#64748b' }}>No confirmed expense recorded today.</div>}
          {groups.map((g, i) => {
            const pct = total ? (g.total / total) * 100 : 0
            return (
              <div key={g.key} style={{ borderTop: i ? '1px solid #f1ede2' : 'none' }}>
                <button onClick={() => setOpen(o => ({ ...o, [g.key]: !o[g.key] }))} aria-expanded={!!open[g.key]}
                  style={{ width: '100%', display: 'block', padding: '12px 16px', border: 'none', background: open[g.key] ? '#fdfbf6' : 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: '#132a4f' }}>{open[g.key] ? '▾' : '▸'} {g.key} <span style={{ color: '#98a2b3', fontWeight: 600 }}>· {g.rows.length}</span></span>
                    <b style={{ color: '#b91c1c', fontFamily: SERIF, fontSize: 16, fontVariantNumeric: 'lining-nums tabular-nums' }}>{inr(g.total)}</b>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: '#f3f0e8', marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, background: 'linear-gradient(90deg,#b91c1c,#e08a8a)', borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#98a2b3', marginTop: 4 }}>{pct.toFixed(1)}% of today's expense</div>
                </button>
                {open[g.key] && (
                  <div style={{ padding: '0 16px 12px' }}>
                    {g.rows.map(r => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderTop: '1px solid #f1ede2' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#0f1b2e', wordBreak: 'break-word' }}>{r.note || r.category}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', marginTop: 6 }}>
                            {[['Time', time(r.created_at)], ['Sub', r.sub_category], ['Paid to', vendorName(r.vendor_id)], ['Voucher head', r.voucher_head], ['Mode', r.payment_mode], ['Account', r.account_type || 'Cash A/c'], ['Ref', r.txn_ref], ['By', r.added_by], ['Receipt', r.receipt_url ? 'Attached' : '']].filter(([, v]) => v).map(([k, v]) => (
                              <span key={k} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: '#f5f3ec', border: '1px solid #ece7d8', color: '#4b4f58' }}>
                                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c9ea6', marginRight: 5 }}>{k}</span>{v}
                              </span>
                            ))}
                          </div>
                        </div>
                        <b style={{ color: '#b91c1c', flexShrink: 0, fontFamily: SERIF, fontSize: 15, fontVariantNumeric: 'lining-nums tabular-nums' }}>{inr(r.amount)}</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
