// StudentChart.jsx — hospital-style "patient chart" panel for Student 360:
// risk index, attendance heat-map, follow-up checklist (care plan) and one
// cross-module timeline. Presentational only; logic lives in lib/studentChart.js.
import { useMemo } from 'react'
import { computeRiskIndex, buildActionItems, buildTimeline, attendanceHeat } from './lib/studentChart'

const TEAL = '#0e7490', TEAL_DK = '#164e63'
const LEVEL = {
  Low: { bg: '#dcfce7', fg: '#166534', ring: '#16a34a' },
  Moderate: { bg: '#fef3c7', fg: '#92400e', ring: '#d97706' },
  High: { bg: '#fee2e2', fg: '#991b1b', ring: '#dc2626' },
}
const HEAT = { p: '#16a34a', a: '#dc2626', l: '#fbbf24' }
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, minWidth: 0 }
const col = { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }
const head = { fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }

function RiskGauge({ score, level }) {
  const lv = LEVEL[level]
  const R = 38, C = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label={`Risk index ${score} of 100, ${level}`}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="9" />
      <circle cx="50" cy="50" r={R} fill="none" stroke={lv.ring === '#16a34a' ? '#86efac' : lv.ring === '#d97706' ? '#fde68a' : '#fca5a5'} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * C} ${C}`} transform="rotate(-90 50 50)" />
      <text x="50" y="55" textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff">{score}</text>
    </svg>
  )
}

export default function StudentChart({ profile, dues, student, onNavigate }) {
  const ctx = useMemo(() => ({ profile, dues, student }), [profile, dues, student])
  const risk = useMemo(() => computeRiskIndex(ctx), [ctx])
  const actions = useMemo(() => buildActionItems(ctx), [ctx])
  const timeline = useMemo(() => buildTimeline(ctx), [ctx])
  const heat = useMemo(() => attendanceHeat(profile?.attendance?.records), [profile])
  const lv = LEVEL[risk.level]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12, alignItems: 'start' }}>
      <div style={col}>
      {/* Risk index — teal banner like the chart header */}
      <div style={{ ...card, background: `linear-gradient(120deg, ${TEAL_DK}, ${TEAL})`, border: 'none', color: '#fff' }}>
        <div style={{ ...head, color: 'rgba(255,255,255,.75)' }}>Risk index</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <RiskGauge score={risk.score} level={risk.level} />
          <div>
            <span style={{ background: lv.bg, color: lv.fg, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{risk.level}</span>
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, opacity: .92 }}>
              {risk.reasons.length === 0 ? 'No risk factors found.' : risk.reasons.map(r => <div key={r.text}>+{r.pts} · {r.text}</div>)}
            </div>
          </div>
        </div>
      </div>

      {/* Attendance heat-map */}
      <div style={card}>
        <div style={head}>Attendance heat-map · last {heat.length || 0} marks</div>
        {heat.length === 0 ? <div style={{ fontSize: 12, color: '#94a3b8' }}>No attendance marked yet.</div> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14,1fr)', gap: 4 }}>
              {heat.map((h, i) => <div key={i} style={{ aspectRatio: '1', borderRadius: 4, background: HEAT[h] }} />)}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
              <span style={{ color: HEAT.p }}>■</span> present &nbsp;<span style={{ color: HEAT.l }}>■</span> late / other &nbsp;<span style={{ color: HEAT.a }}>■</span> absent
            </div>
          </>
        )}
      </div>

      </div>
      <div style={col}>
      {/* Care plan */}
      <div style={card}>
        <div style={head}>Alerts &amp; follow-ups</div>
        {actions.length === 0 ? <div style={{ fontSize: 12, color: '#16a34a' }}>Nothing pending.</div> : actions.map(a => (
          <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '8px 10px', marginBottom: 6, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
            <span>☐ {a.text}</span>
            {onNavigate && <button onClick={() => onNavigate(a.target)} style={{ border: 'none', background: 'none', color: TEAL, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.module} →</button>}
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div style={card}>
        <div style={head}>Timeline</div>
        {timeline.length === 0 ? <div style={{ fontSize: 12, color: '#94a3b8' }}>No dated activity yet.</div> : (
          <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: 6, paddingLeft: 16 }}>
            {timeline.map((e, i) => (
              <div key={i} style={{ position: 'relative', marginBottom: 12, fontSize: 12.5 }}>
                <span style={{ position: 'absolute', left: -23, top: 5, width: 9, height: 9, borderRadius: '50%', background: TEAL }} />
                <b>{e.title}</b>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>{e.date} · {e.module}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
