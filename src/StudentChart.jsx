// StudentChart.jsx — hospital-style "patient chart" panel for Student 360:
// risk index, follow-up checklist (care plan) and one cross-module timeline.
// Presentational only; all logic lives in lib/studentChart.js.
import { useMemo } from 'react'
import { computeRiskIndex, buildActionItems, buildTimeline } from './lib/studentChart'

const LEVEL = {
  Low: { bg: '#dcfce7', fg: '#166534' },
  Moderate: { bg: '#fef3c7', fg: '#92400e' },
  High: { bg: '#fee2e2', fg: '#991b1b' },
}
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, minWidth: 0 }
const head = { fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }

export default function StudentChart({ profile, dues, student, onNavigate }) {
  const ctx = useMemo(() => ({ profile, dues, student }), [profile, dues, student])
  const risk = useMemo(() => computeRiskIndex(ctx), [ctx])
  const actions = useMemo(() => buildActionItems(ctx), [ctx])
  const timeline = useMemo(() => buildTimeline(ctx), [ctx])
  const lv = LEVEL[risk.level]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
      <div style={card}>
        <div style={head}>Risk index</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: lv.fg }}>{risk.score}</span>
          <span style={{ background: lv.bg, color: lv.fg, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{risk.level}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
          {risk.reasons.length === 0 ? 'No risk factors found.' : risk.reasons.map(r => <div key={r.text}>+{r.pts} · {r.text}</div>)}
        </div>
      </div>

      <div style={card}>
        <div style={head}>Follow-ups</div>
        {actions.length === 0 ? <div style={{ fontSize: 12, color: '#16a34a' }}>Nothing pending.</div> : actions.map(a => (
          <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span>☐ {a.text}</span>
            {onNavigate && <button onClick={() => onNavigate(a.target)} style={{ border: 'none', background: 'none', color: '#0e7490', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.module} →</button>}
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={head}>Timeline</div>
        {timeline.length === 0 ? <div style={{ fontSize: 12, color: '#94a3b8' }}>No dated activity yet.</div> : (
          <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: 4, paddingLeft: 12 }}>
            {timeline.map((e, i) => (
              <div key={i} style={{ marginBottom: 9, fontSize: 12.5 }}>
                <b>{e.title}</b>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>{e.date} · {e.module}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
