// AdminIntelligence.jsx — GNSI Portal
// ─────────────────────────────────────────────────────────────────────────────
// UI shell for adminIntelligence.js's 20 functions. Renders the weekly
// digest by default (the "read this in 60 seconds" view), with each
// section expandable to its full underlying list. Kept as a single
// component in the same "Ledger & Crest" style as the rest of
// Student360.jsx — this file owns NO business logic, only presentation;
// every number here comes straight from adminIntelligence.js.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import {
  getWeeklyAdminDigest, getAtRiskStudents, getAttritionRisk, getFeeDefaultTrend,
  getAttendanceDecliners, getDataHealthReport, getStaleRecordsReport,
  getModuleActivityLog, getDuplicateStudentCandidates, getRevenueForecast,
  getCourseProfitability, getPaymentModeBreakdown, getTopDefaultersByAmount,
  getTopperTrends, getSubjectWeaknessReport, getExamParticipationGaps,
  getDisciplineRepeatOffenders, getHouseHealthScore, getSickbayPatternAlert,
  getAnomalyAlerts,
} from './adminIntelligence'

const NAVY = '#0B1E3D', NAVY_LIGHT = '#16305c', GOLD = '#C9A24B'
const SLATE = { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155' }
const RED = '#dc2626', GREEN = '#16a34a', AMBER = '#d97706', SKY = '#0284c7'
const fmt = n => Number(n || 0).toLocaleString('en-IN')
const fmtDate = d => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) } catch { return d } }

function Panel({ icon, title, accent = NAVY, children, right }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${SLATE[200]}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${SLATE[100]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(180deg, ${SLATE[50]}, #fbfcfd)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={{ fontWeight: 750, fontSize: 12.5, color: accent, letterSpacing: '.01em' }}>{title}</span>
        </div>
        {right}
      </div>
      <div style={{ padding: '13px 16px' }}>{children}</div>
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${SLATE[100]}`, fontSize: 12.5 }}>
      <span style={{ color: SLATE[500] }}>{label}</span>
      <span style={{ fontWeight: 750, color: color || SLATE[700] }}>{value}</span>
    </div>
  )
}

function LoadButton({ loading, onClick, label = 'Load' }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, background: loading ? SLATE[100] : '#fff', fontSize: 11, fontWeight: 700, color: NAVY, cursor: loading ? 'default' : 'pointer' }}>
      {loading ? '⏳ Loading…' : label}
    </button>
  )
}

// Generic "load on demand, show a list" section — most of the 20
// functions share this exact shape, so one wrapper avoids twenty
// near-identical useState/useCallback blocks.
function LazySection({ icon, title, accent, fetcher, renderEmpty = 'No data.', renderList, autoload = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await fetcher()) } catch (e) { console.error(`${title} load failed:`, e.message); setData(null) }
    setLoading(false)
  }, [fetcher, title])

  useEffect(() => { if (autoload) load() }, [autoload, load])

  return (
    <Panel icon={icon} title={title} accent={accent} right={<LoadButton loading={loading} onClick={load} label={data ? '↻ Refresh' : 'Load'} />}>
      {data == null && !loading && <div style={{ fontSize: 12, color: SLATE[400], textAlign: 'center', padding: '10px 0' }}>Not loaded yet.</div>}
      {loading && <div style={{ fontSize: 12, color: SLATE[400], textAlign: 'center', padding: '10px 0' }}>⏳ Computing…</div>}
      {data != null && !loading && (Array.isArray(data) && data.length === 0
        ? <div style={{ fontSize: 12, color: GREEN, textAlign: 'center', padding: '10px 0' }}>{renderEmpty}</div>
        : renderList(data))}
    </Panel>
  )
}

export default function AdminIntelligence({ onOpenStudent }) {
  const [digest, setDigest] = useState(null)
  const [digestLoading, setDigestLoading] = useState(false)

  const loadDigest = useCallback(async () => {
    setDigestLoading(true)
    try { setDigest(await getWeeklyAdminDigest()) } catch (e) { console.error('Digest load failed:', e.message) }
    setDigestLoading(false)
  }, [])

  useEffect(() => { loadDigest() }, [loadDigest])

  const openStudentBtn = s => s && onOpenStudent && (
    <button onClick={() => onOpenStudent(s)}
      style={{ padding: '3px 9px', borderRadius: 6, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 10.5, fontWeight: 700, color: NAVY, cursor: 'pointer' }}>
      View →
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Weekly digest — the 60-second read ─────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`, borderRadius: 16, padding: '18px 22px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>📊 Weekly Admin Digest</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
              {digest ? `Generated ${fmtDate(digest.generatedAt)}` : 'Loading…'}
            </div>
          </div>
          <button onClick={loadDigest} disabled={digestLoading}
            style={{ padding: '6px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: digestLoading ? 'default' : 'pointer' }}>
            {digestLoading ? '⏳' : '↻ Refresh'}
          </button>
        </div>

        {digest && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginTop: 16 }}>
            {[
              ['🎓', 'Active Students', fmt(digest.activeStudentCount)],
              ['🔴', 'Open Mismatches', fmt(digest.openMismatchCount)],
              ['⚠️', 'Students At Risk', fmt(digest.topAtRisk.length)],
              ['💰', 'Projected This Month', `₹${fmt(digest.revenueForecast.projectedTotal)}`],
              ['⏳', 'Stale Records', fmt(digest.staleRecordsTotal)],
              ['🏠', 'Weakest House', digest.weakestHouse ? `${digest.weakestHouse.house} (${digest.weakestHouse.score})` : '—'],
            ].map(([icon, label, value]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '9px 11px' }}>
                <div style={{ fontSize: 13 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 900, marginTop: 3 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {digest && digest.topAtRisk.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Top At-Risk Students</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {digest.topAtRisk.slice(0, 5).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: '6px 10px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{r.student.name}</span>
                  <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.65)' }}>{r.reasons.join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 1–4 Risk & early warning ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>

        <LazySection icon="🚨" title="At-Risk Students (Compound Score)" accent={RED}
          fetcher={() => getAtRiskStudents({ limit: 20 })}
          renderEmpty="No students currently flagged as at-risk."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {data.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${SLATE[100]}` }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{r.student.name} <span style={{ color: SLATE[400], fontWeight: 500 }}>· score {r.score}</span></div>
                    <div style={{ fontSize: 10.5, color: SLATE[500] }}>{r.reasons.join(' · ')}</div>
                  </div>
                  {openStudentBtn(r.student)}
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="📉" title="Attrition Risk" accent={AMBER}
          fetcher={() => getAttritionRisk()}
          renderEmpty="No students showing attrition warning signs."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {data.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${SLATE[100]}` }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{r.student.name}</div>
                    <div style={{ fontSize: 10.5, color: SLATE[500] }}>Attendance {r.attPct}% · {r.monthsOverdue} month(s) overdue · ₹{fmt(r.totalDue)} due</div>
                  </div>
                  {openStudentBtn(r.student)}
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="📈" title="Fee Default Trend by Course" accent={RED}
          fetcher={getFeeDefaultTrend}
          renderList={data => (
            <div>
              <StatRow label="Total outstanding" value={`₹${fmt(data.totalDue)}`} color={RED} />
              <StatRow label="Students with dues" value={fmt(data.studentsWithDues)} />
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.byCourse.map(c => (
                  <div key={c.course} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: SLATE[600] }}>{c.course}</span>
                    <span style={{ fontWeight: 700 }}>₹{fmt(c.totalDue)} <span style={{ color: SLATE[400], fontWeight: 500 }}>({c.studentCount})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )} />

        <LazySection icon="📊" title="Attendance Decliners" accent={AMBER}
          fetcher={() => getAttendanceDecliners()}
          renderEmpty="No students showing a meaningful attendance decline."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {data.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${SLATE[100]}` }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{r.student.name}</div>
                    <div style={{ fontSize: 10.5, color: SLATE[500] }}>{r.earlyPct}% → {r.recentPct}% (−{r.drop}pts)</div>
                  </div>
                  {openStudentBtn(r.student)}
                </div>
              ))}
            </div>
          )} />
      </div>

      {/* ── 5–8 Operational / data health ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>

        <LazySection icon="🩺" title="Data Health — Orphaned Records" accent={RED}
          fetcher={getDataHealthReport}
          renderList={data => (
            data.issues.length === 0
              ? <div style={{ fontSize: 12, color: GREEN, textAlign: 'center', padding: '10px 0' }}>No orphaned records found.</div>
              : <div>
                  <StatRow label="Total orphaned rows" value={fmt(data.totalOrphaned)} color={RED} />
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {data.issues.map(i => (
                      <div key={i.table} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>{i.icon} {i.label}</span>
                        <span style={{ fontWeight: 700, color: RED }}>{i.orphanedCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
          )} />

        <LazySection icon="⏳" title="Stale Records" accent={AMBER}
          fetcher={getStaleRecordsReport}
          renderList={data => (
            <div>
              <StatRow label="Pending leave >3 days" value={data.stalePendingLeave.length} color={data.stalePendingLeave.length ? AMBER : GREEN} />
              <StatRow label="Open complaints >7 days" value={data.staleComplaints.length} color={data.staleComplaints.length ? AMBER : GREEN} />
              <StatRow label="Gate passes still 'Issued' >24h" value={data.staleGatePasses.length} color={data.staleGatePasses.length ? AMBER : GREEN} />
            </div>
          )} />

        <LazySection icon="📡" title="Module Activity (Last 30 Days)" accent={SKY}
          fetcher={() => getModuleActivityLog({ days: 30 })}
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
              {data.map(m => (
                <div key={m.table} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{m.icon} {m.label}</span>
                  <span style={{ fontWeight: 700, color: m.recentCount === 0 ? SLATE[400] : m.recentCount == null ? SLATE[300] : NAVY }}>
                    {m.recentCount == null ? 'n/a' : m.recentCount}
                  </span>
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="👥" title="Possible Duplicate Students" accent={AMBER}
          fetcher={getDuplicateStudentCandidates}
          renderEmpty="No duplicate name/phone candidates found."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {data.map((c, i) => (
                <div key={i} style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: AMBER, fontSize: 10.5, textTransform: 'uppercase' }}>{c.reason === 'same_phone' ? `Same phone: ${c.phone}` : `Same name: ${c.name}`}</div>
                  {c.students.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span>{s.name} · {s.course || '—'}</span>
                      <span style={{ color: SLATE[400] }}>{s.status}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )} />
      </div>

      {/* ── 9–12 Financial intelligence ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>

        <LazySection icon="🔮" title="Revenue Forecast (This Month)" accent={GREEN}
          fetcher={getRevenueForecast}
          renderList={data => (
            <div>
              <StatRow label="Collected so far" value={`₹${fmt(data.collectedSoFar)}`} />
              <StatRow label="Daily rate" value={`₹${fmt(data.dailyRate)}`} />
              <StatRow label="Days elapsed / in month" value={`${data.daysElapsed} / ${data.daysInMonth}`} />
              <StatRow label="Projected total" value={`₹${fmt(data.projectedTotal)}`} color={GREEN} />
            </div>
          )} />

        <LazySection icon="📚" title="Course Profitability" accent={SKY}
          fetcher={getCourseProfitability}
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.map(c => (
                <div key={c.course}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: SLATE[600] }}>{c.course}</span>
                    <span style={{ fontWeight: 700, color: c.collectionRate < 70 ? RED : GREEN }}>{c.collectionRate ?? '—'}%</span>
                  </div>
                  <div style={{ height: 5, background: SLATE[100], borderRadius: 99, marginTop: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.collectionRate ?? 0}%`, background: c.collectionRate < 70 ? RED : GREEN, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="💳" title="Payment Mode Breakdown (30d)" accent={NAVY}
          fetcher={() => getPaymentModeBreakdown({ days: 30 })}
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.map(m => (
                <div key={m.mode} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: SLATE[600] }}>{m.mode}</span>
                  <span style={{ fontWeight: 700 }}>₹{fmt(m.amount)} <span style={{ color: SLATE[400], fontWeight: 500 }}>({m.pct}%)</span></span>
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="🎯" title="Top Defaulters by Amount" accent={RED}
          fetcher={() => getTopDefaultersByAmount({ limit: 15 })}
          renderEmpty="No outstanding dues."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
              {data.map(({ student, dues }, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${SLATE[100]}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{student.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: RED }}>₹{fmt(dues.totalDue)}</span>
                    {openStudentBtn(student)}
                  </div>
                </div>
              ))}
            </div>
          )} />
      </div>

      {/* ── 13–15 Academic intelligence ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>

        <LazySection icon="🏆" title="Topper Trends by Subject" accent={GOLD}
          fetcher={() => getTopperTrends({ topN: 3 })}
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {data.map(s => (
                <div key={s.subject}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase' }}>{s.subject}</div>
                  {s.top.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                      <span>{t.student?.name || 'Unknown'}</span>
                      <span style={{ fontWeight: 700 }}>{t.marks}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="⚠️" title="Subject Weakness Report" accent={RED}
          fetcher={() => getSubjectWeaknessReport()}
          renderEmpty="No subject/batch averages below the weak threshold."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
              {data.weak.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{r.batch} · {r.subject}</span>
                  <span style={{ fontWeight: 700, color: RED }}>{r.average}</span>
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="🕳️" title="Exam Participation Gaps" accent={AMBER}
          fetcher={getExamParticipationGaps}
          renderEmpty="Every active student with attendance has at least one exam mark."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
              {data.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span>{s.name} · {s.course || '—'}</span>
                  {openStudentBtn(s)}
                </div>
              ))}
            </div>
          )} />
      </div>

      {/* ── 16–18 Hostel / discipline intelligence ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>

        <LazySection icon="🚩" title="Discipline Repeat Offenders (90d)" accent={RED}
          fetcher={() => getDisciplineRepeatOffenders()}
          renderEmpty="No repeat discipline patterns in the last 90 days."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {data.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${SLATE[100]}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{r.student?.name || 'Unknown'} <span style={{ color: SLATE[400], fontWeight: 500 }}>· {r.count}×</span></span>
                  {openStudentBtn(r.student)}
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="🏠" title="House Health Score" accent={SKY}
          fetcher={getHouseHealthScore}
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.map(h => (
                <div key={h.house}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: SLATE[600] }}>{h.house}</span>
                    <span style={{ fontWeight: 700, color: h.score < 60 ? RED : h.score < 80 ? AMBER : GREEN }}>{h.score}</span>
                  </div>
                  <div style={{ fontSize: 10, color: SLATE[400] }}>{h.occupancy} students · {h.openDiscipline} discipline · {h.attendancePct ?? '—'}% attendance</div>
                </div>
              ))}
            </div>
          )} />

        <LazySection icon="🏥" title="Sickbay Pattern Alerts (60d)" accent={AMBER}
          fetcher={() => getSickbayPatternAlert()}
          renderEmpty="No repeat sickbay patterns in the last 60 days."
          renderList={data => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {data.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${SLATE[100]}` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{r.student?.name || 'Unknown'} <span style={{ color: SLATE[400], fontWeight: 500 }}>· {r.visitCount}×</span></div>
                    {r.conditions.length > 0 && <div style={{ fontSize: 10, color: SLATE[500] }}>{r.conditions.join(', ')}</div>}
                  </div>
                  {openStudentBtn(r.student)}
                </div>
              ))}
            </div>
          )} />
      </div>

      {/* ── 20 Anomaly alerts ─────────────────────────────────────────────── */}
      <LazySection icon="🧭" title="Anomaly Alerts" accent={RED}
        fetcher={getAnomalyAlerts}
        renderEmpty="No statistical anomalies detected."
        renderList={data => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
            {data.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>
                  {a.type === 'fee_outlier'
                    ? `${a.label} — GCC ${a.gcc}`
                    : `Attendance for unknown GCC ${a.gcc}`}
                </span>
                <span style={{ fontWeight: 700, color: RED }}>
                  {a.type === 'fee_outlier' ? `₹${fmt(a.amount)} (avg ₹${fmt(a.mean)})` : '⚠'}
                </span>
              </div>
            ))}
          </div>
        )} />

    </div>
  )
}