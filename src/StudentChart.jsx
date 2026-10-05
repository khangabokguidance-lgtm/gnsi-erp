// StudentChart.jsx — clinical-style "patient chart" panel for Student 360:
// risk index, attendance heat-map, follow-up worklist and one cross-module
// timeline. Presentational only; logic lives in lib/studentChart.js.
import { useMemo } from 'react'
import { computeRiskIndex, buildActionItems, buildTimeline, attendanceHeat } from './lib/studentChart'

const INK = '#0f172a', MUTE = '#64748b', FAINT = '#94a3b8', LINE = '#e2e8f0'
const TEAL = '#0e7490', TEAL_DK = '#164e63'
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

const LEVEL = {
  Low: { bg: '#dcfce7', fg: '#166534', arc: '#86efac' },
  Moderate: { bg: '#fef3c7', fg: '#92400e', arc: '#fde68a' },
  High: { bg: '#fee2e2', fg: '#991b1b', arc: '#fca5a5' },
}
const ALERT = {
  red: { bg: '#fef2f2', bd: '#fecaca', fg: '#991b1b', dot: '#dc2626' },
  amber: { bg: '#fffbeb', bd: '#fde68a', fg: '#92400e', dot: '#d97706' },
}
const HEAT = { p: { c: '#16a34a', t: 'Present' }, a: { c: '#dc2626', t: 'Absent' }, l: { c: '#fbbf24', t: 'Late / other' } }
const MODULE_TONE = {
  Fees: '#0e7490', Exams: '#6d28d9', Admission: '#166534', Discipline: '#b91c1c', Sickbay: '#be185d',
  Leave: '#b45309', 'Gate Pass': '#475569', Complaints: '#9a3412', Hostel: '#1d4ed8',
}

const card = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '16px 18px', minWidth: 0, boxShadow: '0 1px 2px rgba(15,23,42,.04)', fontFamily: FONT, color: INK }
const col = { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }
const titleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }
const title = { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }
const sub = { fontSize: 11, color: FAINT }

function RiskGauge({ score, level }) {
  const R = 38, C = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 100 100" width="108" height="108" role="img" aria-label={`Risk index ${score} out of 100, ${level}`}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="8" />
      <circle cx="50" cy="50" r={R} fill="none" stroke={LEVEL[level].arc} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * C} ${C}`} transform="rotate(-90 50 50)" />
      <text x="50" y="53" textAnchor="middle" fontSize="26" fontWeight="700" fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>{score}</text>
      <text x="50" y="68" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.7)" letterSpacing=".1em">OF 100</text>
    </svg>
  )
}

function Empty({ icon, text, tone = FAINT }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: tone, padding: '6px 0' }}><span aria-hidden="true">{icon}</span>{text}</div>
}

export default function StudentChart({ profile, dues, student, onNavigate }) {
  const ctx = useMemo(() => ({ profile, dues, student }), [profile, dues, student])
  const risk = useMemo(() => computeRiskIndex(ctx), [ctx])
  const actions = useMemo(() => buildActionItems(ctx), [ctx])
  const timeline = useMemo(() => buildTimeline(ctx), [ctx])
  const heat = useMemo(() => attendanceHeat(profile?.attendance?.records), [profile])
  const lv = LEVEL[risk.level]
  const counts = heat.reduce((m, h) => ({ ...m, [h]: (m[h] || 0) + 1 }), {})

  return (
    <section aria-label="Student chart" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px,100%),1fr))', gap: 14, alignItems: 'start' }}>
      <div style={col}>
        <div style={{ ...card, background: `linear-gradient(120deg, ${TEAL_DK}, ${TEAL})`, border: 'none', color: '#fff' }}>
          <div style={titleRow}><h3 style={{ ...title, color: 'rgba(255,255,255,.7)' }}>Risk index</h3>
            <span style={{ background: lv.bg, color: lv.fg, borderRadius: 99, padding: '2px 11px', fontSize: 11, fontWeight: 700 }}>{risk.level}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <RiskGauge score={risk.score} level={risk.level} />
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12.5, lineHeight: 1.7, color: 'rgba(255,255,255,.92)' }}>
              {risk.reasons.length === 0
                ? <li>No risk factors found.</li>
                : risk.reasons.map(r => <li key={r.text}><b style={{ fontVariantNumeric: 'tabular-nums', color: '#fde68a' }}>+{r.pts}</b> &nbsp;{r.text}</li>)}
            </ul>
          </div>
        </div>

        <div style={card}>
          <div style={titleRow}><h3 style={title}>Attendance</h3><span style={sub}>last {heat.length} marks</span></div>
          {heat.length === 0 ? <Empty icon="—" text="No attendance marked yet." /> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14,1fr)', gap: 4 }}>
                {heat.map((h, i) => <div key={i} title={HEAT[h].t} style={{ aspectRatio: '1', borderRadius: 4, background: HEAT[h].c }} />)}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11.5, color: MUTE, flexWrap: 'wrap' }}>
                {['p', 'l', 'a'].map(k => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 9, height: 9, borderRadius: 2, background: HEAT[k].c, display: 'inline-block' }} />
                    {HEAT[k].t} <b style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{counts[k] || 0}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={col}>
        <div style={card}>
          <div style={titleRow}><h3 style={title}>Follow-ups</h3><span style={sub}>{actions.length ? `${actions.length} open` : 'all clear'}</span></div>
          {actions.length === 0 ? <Empty icon="✓" text="Nothing pending." tone="#16a34a" /> : actions.map(a => {
            const t = ALERT[a.level] || ALERT.amber
            return (
              <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', marginBottom: 7, borderRadius: 10, background: t.bg, border: `1px solid ${t.bd}` }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: t.dot, flex: 'none' }} />
                <span style={{ flex: 1, fontSize: 12.5, color: t.fg, lineHeight: 1.4 }}>{a.text}</span>
                {onNavigate && (
                  <button type="button" onClick={() => onNavigate(a.target)} aria-label={`Open ${a.module}`}
                    style={{ border: `1px solid ${t.bd}`, background: '#fff', color: TEAL, fontWeight: 600, fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT }}>
                    {a.module} →
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div style={card}>
          <div style={titleRow}><h3 style={title}>Timeline</h3><span style={sub}>latest {timeline.length}</span></div>
          {timeline.length === 0 ? <Empty icon="—" text="No dated activity yet." /> : (
            <ol style={{ listStyle: 'none', margin: '0 0 0 5px', padding: '0 0 0 18px', borderLeft: `2px solid ${LINE}` }}>
              {timeline.map((e, i) => (
                <li key={i} style={{ position: 'relative', paddingBottom: i === timeline.length - 1 ? 0 : 14 }}>
                  <span aria-hidden="true" style={{ position: 'absolute', left: -25, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#fff', border: `2px solid ${MODULE_TONE[e.module] || TEAL}` }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: FAINT, marginTop: 1 }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{e.date}</span> · <span style={{ color: MODULE_TONE[e.module] || MUTE, fontWeight: 600 }}>{e.module}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
