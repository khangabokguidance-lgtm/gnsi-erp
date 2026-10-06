// FeeClashBanner.jsx — shows who else has this student's fee form open right now.
export default function FeeClashBanner({ others = [] }) {
  if (!others.length) return null
  const names = [...new Set(others.map(o => o.who + (o.role ? ` (${o.role})` : '')))].join(', ')
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px', padding: '11px 14px', borderRadius: 14, fontSize: 13, fontWeight: 700, color: '#7a2e0e',
      background: 'linear-gradient(180deg,#fff7ed,#ffedd5)', border: '1.5px solid #fdba74', boxShadow: '0 10px 20px -14px rgba(154,52,18,.6)' }}>
      <span style={{ fontSize: 18 }}>👥</span>
      <span>Also open right now: <b>{names}</b>. Check the ledger before saving so this student isn't charged twice.</span>
    </div>
  )
}
