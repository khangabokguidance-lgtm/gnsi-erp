// Student360.jsx — GNSI Portal
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY cross-module student audit view.
//
// Reception.jsx already has a "Student 360°" tab, but it's scoped to
// Reception's own concerns — fees totals, hostel room, gate passes,
// enquiries, parent items. It does NOT show attendance history, exam
// marks, admission record, discipline/sickbay involvement, or the raw
// Students.jsx profile fields (course/batch/status/notes).
//
// This is a SEPARATE, standalone module: pick a student, see everything
// every module has ever recorded about them, in one screen — so a
// mismatch (a student "active" in one module but "dropout" in another,
// fees paid but attendance shows they never attended, exam marks with
// no matching admission record, etc.) is visible at a glance instead of
// requiring seven separate tab visits.
//
// Reads only — this module writes nothing. It routes every roster/lookup
// through studentQueries.js so it can never show a stale or
// differently-filtered student list than any other module.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import { getActiveStudents, getStudentById } from './studentQueries'
import { loadFullProfile } from './studentProfileLoader'
import { detectMismatches } from './mismatchDetector'
import { logAndNotify, getOpenMismatches, acknowledgeMismatch, resolveMismatch } from './mismatchLog'
import { getStudentDues, getDuesForStudents } from './feeDues'
import { globalSearch } from './globalSearch'
import { downloadCSV, downloadSingleRecordCSV } from './exportUtils'
import TableBrowser from './TableBrowser'

// ── Access control ──────────────────────────────────────────────────────────
// Admin-only, per Himan's decision. Access is gated by App.jsx BEFORE this
// component ever renders (moduleMap['student360'] only mounts this when
// App.jsx's own isAdmin check passes — see ADMIN_ROLES/isAdminRole there),
// the same pattern used for AdminPage, FeeSetup, Sessions, etc. This
// component does NOT import AuthContext or re-derive role itself, so
// there's exactly one admin definition in the app, not two that could
// disagree.

// ── Design tokens (kept consistent with the portal's "Ledger & Crest") ─────
const NAVY = '#0B1E3D'
const NAVY_LIGHT = '#16305c'
const GOLD = '#C9A24B'
const SLATE = { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155' }
const RED = '#dc2626', GREEN = '#16a34a', AMBER = '#d97706', SKY = '#0284c7'

const fmt = n => Number(n || 0).toLocaleString('en-IN')
const fmtDate = d => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) } catch { return d } }

// ── Autocomplete search box ─────────────────────────────────────────────────
function StudentSearch({ students, onSelect }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(term) ||
      String(s.gcc_no || '').includes(term) ||
      (s.admission_no || '').toLowerCase().includes(term) ||
      (s.batch || '').toLowerCase().includes(term)
    ).slice(0, 12)
  }, [q, students])

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name, GCC No, admission no, or batch…"
        style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: `1px solid ${SLATE[200]}`, fontSize: 14, boxSizing: 'border-box' }}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: `1px solid ${SLATE[200]}`, maxHeight: 320, overflowY: 'auto', zIndex: 30 }}>
          {results.map(s => (
            <div key={s.id}
              onClick={() => { onSelect(s); setQ(''); setOpen(false) }}
              style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: `1px solid ${SLATE[100]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = SLATE[50]}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: NAVY }}>{s.name}</div>
                <div style={{ fontSize: 12, color: SLATE[500] }}>{s.course || '—'} · {s.batch || '—'} · {s.class_name || '—'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                {s.gcc_no && <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: GOLD }}>GCC-{s.gcc_no}</span>}
                <StatusPill status={s.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const s = status || 'Unknown'
  const color = s === 'Active' ? GREEN : s === 'Dropout' ? RED : s === 'Inactive' ? SLATE[500] : AMBER
  return <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: color, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.03em' }}>{s}</span>
}

// ── Section shell ───────────────────────────────────────────────────────────
// exportRows (optional): raw row array for this card's data — when
// present, an export button appears in the header that downloads exactly
// those rows as CSV. exportName sets the filename prefix.
function Section({ icon, title, count, children, full, accent = NAVY, empty, defaultOpen = false, exportRows = null, exportName = null, moduleLink = null }) {
  const [open, setOpen] = useState(defaultOpen)
  const hasMore = !!full
  const canExport = exportRows && exportRows.length > 0
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}`, overflow: 'hidden' }}>
      <div
        onClick={() => hasMore && setOpen(o => !o)}
        style={{ padding: '12px 18px', borderBottom: `1px solid ${SLATE[100]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: SLATE[50], cursor: hasMore ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: NAVY, letterSpacing: '.01em' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {count != null && <span style={{ fontSize: 11.5, fontWeight: 700, color: accent, background: `${accent}18`, padding: '2px 10px', borderRadius: 99 }}>{count}</span>}
          {moduleLink && (
            <button
              onClick={e => { e.stopPropagation(); moduleLink.onClick() }}
              title={`Open ${moduleLink.label} module`}
              style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, background: '#fff', border: `1px solid ${SLATE[200]}`, borderRadius: 7, padding: '3px 8px', cursor: 'pointer' }}
            >{moduleLink.label} →</button>
          )}
          {canExport && (
            <button
              onClick={e => { e.stopPropagation(); downloadCSV(exportRows, exportName || title.toLowerCase().replace(/\s+/g, '_')) }}
              title="Export this data as CSV"
              style={{ fontSize: 10.5, fontWeight: 700, color: SLATE[500], background: '#fff', border: `1px solid ${SLATE[200]}`, borderRadius: 7, padding: '3px 8px', cursor: 'pointer' }}
            >⬇ CSV</button>
          )}
          {hasMore && <span style={{ fontSize: 11, color: SLATE[400], transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>}
        </div>
      </div>
      <div style={{ padding: '14px 18px' }}>
        {empty ? <div style={{ fontSize: 12.5, color: SLATE[400], textAlign: 'center', padding: '18px 0' }}>{empty}</div> : (open && hasMore ? full : children)}
      </div>
    </div>
  )
}

// Renders a full list of raw rows inside an expanded Section — used by the
// `full` prop so every card can drill from "top 5" down to "every record
// this module has," instead of losing data to a hardcoded slice().
function FullList({ rows, renderRow, emptyText = 'No records.' }) {
  if (!rows || rows.length === 0) return <div style={{ fontSize: 12.5, color: SLATE[400], textAlign: 'center', padding: '10px 0' }}>{emptyText}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 360, overflowY: 'auto' }}>
      {rows.map(renderRow)}
    </div>
  )
}

const Row = ({ label, value, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${SLATE[100]}`, fontSize: 13 }}>
    <span style={{ color: SLATE[500] }}>{label}</span>
    <span style={{ fontWeight: 600, color: SLATE[700], fontFamily: mono ? 'monospace' : 'inherit' }}>{value ?? '—'}</span>
  </div>
)

// ── Main component ──────────────────────────────────────────────────────────
// App.jsx passes isAdmin (from its own ADMIN_ROLES check) — see the wiring
// note above. Defaults to false so this component fails closed if it's
// ever mounted without that prop.
export default function Student360({ currentUser, isAdmin = false, onNavigate }) {
  const [view, setView] = useState('search') // 'search' | 'dashboard'
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  const [profile, setProfile] = useState(null)
  const [dues, setDues] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notifyState, setNotifyState] = useState('idle') // 'idle' | 'sending' | 'sent' | 'none' | 'error'

  useEffect(() => {
    if (!isAdmin) return
    // Full active roster — the exact same list Students.jsx shows, via
    // the shared source of truth, so this search can't offer a student
    // who's actually been filtered out everywhere else (or vice versa).
    getActiveStudents('id,name,gcc_no,course,batch,class_name,status,phone,house,admission_no').then(setStudents)
  }, [isAdmin])

  const select = useCallback(async s => {
    setSelected(s)
    setProfile(null)
    setDues(null)
    setNotifyState('idle')
    setLoading(true)
    // Re-fetch the FULL row (getActiveStudents above only pulled a lean
    // column set for the search dropdown) so every field this view shows
    // — notes, dob, parent info, admission_date, etc. — is current.
    const full = await getStudentById(s.id, '*')
    const [data, duesData] = await Promise.all([
      loadFullProfile(full || s),
      // Dues needs course/batch/hostel_type/admission_date, all only on
      // the full row — feeDues.js fails safe (no exclusions) if
      // admission_date is missing rather than throwing.
      getStudentDues(full || s).catch(e => { console.error('getStudentDues failed:', e.message); return null }),
    ])
    setProfile(data)
    setDues(duesData)
    setLoading(false)
  }, [])

  // Manual "Notify Admin" — computes the same flags shown on screen via
  // mismatchDetector.js, then routes through mismatchLog.js's dedupe: if
  // every flag here is already open from a previous scan/notify, this
  // reports "nothing new" instead of re-pushing a duplicate alert.
  const notifyAdmin = useCallback(async () => {
    if (!selected || !profile) return
    setNotifyState('sending')
    try {
      const flags = detectMismatches(selected, profile)
      if (flags.length === 0) { setNotifyState('none'); return }
      const { newCount } = await logAndNotify(selected, flags)
      setNotifyState(newCount > 0 ? 'sent' : 'none')
    } catch (e) {
      console.error('notifyAdmin failed:', e.message)
      setNotifyState('error')
    }
  }, [selected, profile])

  if (!isAdmin) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 800, fontSize: 15, color: SLATE[600] }}>Admin access only</div>
        <p style={{ fontSize: 13, color: SLATE[400], maxWidth: 340, margin: '8px auto 0' }}>
          Student 360° cross-module view is restricted to admin accounts.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 20, color: NAVY, fontFamily: 'Georgia, serif' }}>Student 360°</div>
        <div style={{ fontSize: 12.5, color: SLATE[500], marginTop: 2 }}>Cross-module record — everything every module has recorded for one student, in one place.</div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${SLATE[200]}`, flexWrap: 'wrap' }}>
        {[
          { id: 'search', label: '🔍 Search Student' },
          { id: 'globalsearch', label: '🌐 Global Search' },
          { id: 'dashboard', label: '📊 Mismatch Dashboard' },
          { id: 'overview', label: '🏫 School Overview' },
          { id: 'browser', label: '🗄️ Table Browser' },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, color: view === t.id ? NAVY : SLATE[400],
            borderBottom: view === t.id ? `2px solid ${GOLD}` : '2px solid transparent',
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {view === 'overview' && <SchoolOverview onOpenStudent={s => { setView('search'); select(s) }} />}
      {view === 'dashboard' && <MismatchDashboard currentUser={currentUser} onOpenStudent={s => { setView('search'); select(s) }} />}
      {view === 'globalsearch' && <GlobalSearchPanel onOpenStudent={s => { setView('search'); select(s) }} onOpenModule={onNavigate} />}
      {view === 'browser' && <TableBrowser onOpenStudent={s => { setView('search'); select(s) }} onOpenModule={onNavigate} />}

      {view === 'search' && <>
      <StudentSearch students={students} onSelect={select} />

      {loading && <div style={{ textAlign: 'center', padding: 60, color: SLATE[400] }}>⏳ Pulling records from every module…</div>}

      {selected && profile && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header card */}
          <div style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_LIGHT})`, borderRadius: 18, padding: '18px 22px', color: '#fff', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: NAVY }}>
                {(selected.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {selected.gcc_no && <span style={{ fontFamily: 'monospace', fontWeight: 700, color: GOLD, fontSize: 12 }}>GCC-{selected.gcc_no}</span>}
                  {selected.admission_no && <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>Adm# {selected.admission_no}</span>}
                  <StatusPill status={selected.status} />
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{selected.course || '—'} · {selected.batch || '—'} · {selected.class_name || '—'}</div>
              {selected.house && <div style={{ fontSize: 11, color: '#a5b4fc', marginTop: 3 }}>🏠 {selected.house}</div>}
            </div>
          </div>

          {/* Quick mismatch flags — the whole point of this view */}
          <MismatchFlags student={selected} profile={profile} onNotify={notifyAdmin} notifyState={notifyState} />

          {/* Grid of module sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>

            <Section icon="📝" title="Admission Record" accent={SKY} empty={!profile.admission && 'No admissions record found for this GCC number.'}
              moduleLink={onNavigate ? { label: "Admissions", onClick: () => onNavigate("admissions") } : null}
              full={profile.admission && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(profile.admission).filter(([k]) => !['id'].includes(k)).map(([k, v]) => (
                    <Row key={k} label={k.replace(/_/g, ' ')} value={v == null || v === '' ? '—' : String(v)} />
                  ))}
                </div>
              )}>
              {profile.admission && <>
                <Row label="Status" value={profile.admission.status} />
                <Row label="Applied" value={fmtDate(profile.admission.created_at)} />
                <Row label="Course" value={profile.admission.course} />
              </>}
            </Section>

            <Section icon="💰" title="Fees" accent={dues?.totalDue > 0 ? RED : GREEN} count={profile.fees.admFeeCols.length + profile.fees.admFlatFees.length + profile.fees.admCourseFees.length}
              exportRows={[
                ...profile.fees.admFeeCols.map(r => ({ type: 'Admission', ...r })),
                ...profile.fees.admFlatFees.map(r => ({ type: 'Flat', ...r })),
                ...profile.fees.admCourseFees.map(r => ({ type: 'Course', ...r })),
              ]} exportName={`${selected.name}_fee_payments`}
              moduleLink={onNavigate ? { label: "Fees", onClick: () => onNavigate("fees") } : null}
              full={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dues && <>
                    <Row label="Total Due" value={`₹${fmt(dues.totalDue)}`} />
                    <Row label="Admission fee" value={dues.admission.due > 0 ? `₹${fmt(dues.admission.due)} due` : 'Paid'} />
                    <Row label="Flat fee (Feb/Mar)" value={dues.flatFee.due > 0
                      ? `₹${fmt(dues.flatFee.due)} — ${dues.flatFee.items.filter(i => !i.paid).map(i => `${i.month.slice(0, 3)} ${i.year}`).join(', ')}`
                      : 'Up to date'} />
                    <Row label="Course fee" value={dues.courseFee.due > 0
                      ? `₹${fmt(dues.courseFee.due)} — ${dues.courseFee.items.filter(i => !i.paid).length} month(s)`
                      : 'Up to date'} />
                  </>}
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 4 }}>Admission Fee Payments</div>
                  <FullList rows={profile.fees.admFeeCols} emptyText="No admission fee payments." renderRow={(r, i) => (
                    <Row key={i} label={`${fmtDate(r.pay_date)} · ${r.pay_mode || '—'}`} value={`₹${fmt(r.amount_paid)}`} />
                  )} />
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 4 }}>Flat Fee Payments</div>
                  <FullList rows={profile.fees.admFlatFees} emptyText="No flat fee payments." renderRow={(r, i) => (
                    <Row key={i} label={`${r.month} ${r.year} · ${fmtDate(r.pay_date)}`} value={`₹${fmt(r.amount)}`} />
                  )} />
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 4 }}>Course Fee Payments</div>
                  <FullList rows={profile.fees.admCourseFees} emptyText="No course fee payments." renderRow={(r, i) => (
                    <Row key={i} label={`${r.for_month} ${r.year} · ${fmtDate(r.pay_date)}`} value={`₹${fmt(r.amount_paid)}`} />
                  )} />
                </div>
              }>
              <Row label="Total Paid" value={`₹${fmt(profile.fees.total)}`} />
              {dues && <>
                <Row label="Total Due" value={`₹${fmt(dues.totalDue)}`} />
                {dues.totalDue > 0 && <>
                  <Row label="Admission fee" value={dues.admission.due > 0 ? `₹${fmt(dues.admission.due)} due` : 'Paid'} />
                  <Row label="Flat fee (Feb/Mar)" value={dues.flatFee.due > 0
                    ? `₹${fmt(dues.flatFee.due)} — ${dues.flatFee.items.filter(i => !i.paid).map(i => `${i.month.slice(0, 3)} ${i.year}`).join(', ')}`
                    : 'Up to date'} />
                  <Row label="Course fee" value={dues.courseFee.due > 0
                    ? `₹${fmt(dues.courseFee.due)} — ${dues.courseFee.items.filter(i => !i.paid).length} month(s)`
                    : 'Up to date'} />
                </>}
              </>}
              <Row label="Admission fee payments" value={profile.fees.admFeeCols.length} />
              <Row label="Flat fee payments" value={profile.fees.admFlatFees.length} />
              <Row label="Course fee payments" value={profile.fees.admCourseFees.length} />
            </Section>

            <Section icon="📋" title="Attendance" accent={profile.attendance.pct == null ? SLATE[500] : profile.attendance.pct < 75 ? RED : GREEN}
              empty={profile.attendance.totalMarked === 0 && 'No attendance records found for this student.'}
              moduleLink={onNavigate ? { label: "Attendance", onClick: () => onNavigate("attendance") } : null}
              full={
                <div>
                  <Row label="Sessions marked" value={profile.attendance.totalMarked} />
                  <Row label="Present" value={profile.attendance.presentCount} />
                  <Row label="Absent/Other" value={profile.attendance.totalMarked - profile.attendance.presentCount} />
                  <Row label="Attendance %" value={`${profile.attendance.pct}%`} />
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', margin: '10px 0 4px' }}>All Marked Sessions</div>
                  <FullList rows={profile.attendance.records} emptyText="No sessions." renderRow={(r, i) => (
                    <Row key={i} label={`Session #${r.session_id}`} value={r.status} />
                  )} />
                </div>
              }>
              {profile.attendance.totalMarked > 0 && <>
                <Row label="Sessions marked" value={profile.attendance.totalMarked} />
                <Row label="Present" value={profile.attendance.presentCount} />
                <Row label="Attendance %" value={`${profile.attendance.pct}%`} />
              </>}
            </Section>

            <Section icon="✏️" title="Exam Marks" accent={SKY} count={profile.exams.length} empty={profile.exams.length === 0 && 'No exam marks recorded for this student.'}
              exportRows={profile.exams} exportName={`${selected.name}_exam_marks`}
              moduleLink={onNavigate ? { label: "Exams", onClick: () => onNavigate("exams") } : null}
              full={<FullList rows={profile.exams} emptyText="No exam marks." renderRow={(m, i) => (
                <Row key={i} label={`${m.subject} · ${fmtDate(m.exam_date)}`} value={m.marks_obtained} />
              )} />}>
              {profile.exams.slice(0, 5).map((m, i) => (
                <Row key={i} label={`${m.subject} · ${fmtDate(m.exam_date)}`} value={m.marks_obtained} />
              ))}
              {profile.exams.length > 5 && <div style={{ fontSize: 11.5, color: SLATE[400], marginTop: 6 }}>+{profile.exams.length - 5} more</div>}
            </Section>

            <Section icon="🏠" title="Hostel" accent={profile.hostel ? GREEN : SLATE[500]} empty={!profile.hostel && 'Day scholar — no hostel allocation.'}
              moduleLink={onNavigate ? { label: "Hostel", onClick: () => onNavigate("hostel") } : null}
              full={profile.hostel && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(profile.hostel).filter(([k]) => !['id', 'hostel_rooms'].includes(k)).map(([k, v]) => (
                    <Row key={k} label={k.replace(/_/g, ' ')} value={v == null || v === '' ? '—' : String(v)} />
                  ))}
                  {profile.hostel.hostel_rooms && Object.entries(profile.hostel.hostel_rooms).map(([k, v]) => (
                    <Row key={'room_' + k} label={`Room ${k.replace(/_/g, ' ')}`} value={v == null || v === '' ? '—' : String(v)} />
                  ))}
                </div>
              )}>
              {profile.hostel && <>
                <Row label="Room" value={profile.hostel.hostel_rooms?.room_no} />
                <Row label="Floor" value={profile.hostel.hostel_rooms?.floor} />
                <Row label="Allotted" value={fmtDate(profile.hostel.created_at)} />
              </>}
            </Section>

            <Section icon="🚩" title="Discipline" accent={profile.discipline.length ? AMBER : GREEN} count={profile.discipline.length} empty={profile.discipline.length === 0 && 'No discipline records.'}
              exportRows={profile.discipline} exportName={`${selected.name}_discipline`}
              moduleLink={onNavigate ? { label: "Hostel", onClick: () => onNavigate("hostel") } : null}
              full={<FullList rows={profile.discipline} emptyText="No discipline records." renderRow={(d, i) => (
                <Row key={i} label={`${fmtDate(d.date)} · ${d.category || 'General'}`} value={d.status} />
              )} />}>
              {profile.discipline.slice(0, 5).map((d, i) => <Row key={i} label={fmtDate(d.date)} value={d.status} />)}
            </Section>

            <Section icon="🏥" title="Sickbay" accent={profile.sickbay.some(s => s.status === 'Admitted') ? RED : SLATE[500]} count={profile.sickbay.length} empty={profile.sickbay.length === 0 && 'No sickbay records.'}
              exportRows={profile.sickbay} exportName={`${selected.name}_sickbay`}
              moduleLink={onNavigate ? { label: "Hostel", onClick: () => onNavigate("hostel") } : null}
              full={<FullList rows={profile.sickbay} emptyText="No sickbay records." renderRow={(s, i) => (
                <Row key={i} label={`${fmtDate(s.date)} · ${s.condition || s.reason || '—'}`} value={s.status} />
              )} />}>
              {profile.sickbay.slice(0, 5).map((s, i) => <Row key={i} label={fmtDate(s.date)} value={s.status} />)}
            </Section>

            <Section icon="🎫" title="Leave Records" accent={SKY} count={profile.leave.length} empty={profile.leave.length === 0 && 'No leave records.'}
              exportRows={profile.leave} exportName={`${selected.name}_leave`}
              moduleLink={onNavigate ? { label: "Hostel", onClick: () => onNavigate("hostel") } : null}
              full={<FullList rows={profile.leave} emptyText="No leave records." renderRow={(l, i) => (
                <Row key={i} label={`${l.leave_type || 'Leave'} · ${fmtDate(l.from_date)} → ${fmtDate(l.to_date)}`} value={l.status} />
              )} />}>
              {profile.leave.slice(0, 5).map((l, i) => <Row key={i} label={fmtDate(l.from_date)} value={l.status} />)}
            </Section>

            <Section icon="🪪" title="Gate Passes" accent={profile.gatePasses.some(g => g.status === 'Issued') ? AMBER : SLATE[500]} count={profile.gatePasses.length} empty={profile.gatePasses.length === 0 && 'No gate passes.'}
              exportRows={profile.gatePasses} exportName={`${selected.name}_gate_passes`}
              moduleLink={onNavigate ? { label: "Reception", onClick: () => onNavigate("reception") } : null}
              full={<FullList rows={profile.gatePasses} emptyText="No gate passes." renderRow={(g, i) => (
                <Row key={i} label={`${fmtDate(g.created_at)} · ${g.reason || '—'}`} value={g.status} />
              )} />}>
              {profile.gatePasses.slice(0, 5).map((g, i) => <Row key={i} label={fmtDate(g.created_at)} value={g.status} />)}
            </Section>

            <Section icon="📞" title="Enquiries & Parent Items" accent={SKY} count={profile.enquiries.length + profile.parentItems.length}
              empty={profile.enquiries.length === 0 && profile.parentItems.length === 0 && 'No enquiries or parent items.'}
              moduleLink={onNavigate ? { label: "Reception", onClick: () => onNavigate("reception") } : null}
              full={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em' }}>Enquiries</div>
                  <FullList rows={profile.enquiries} emptyText="No enquiries." renderRow={(e, i) => (
                    <Row key={i} label={`${fmtDate(e.created_at)} · ${e.subject || e.category || '—'}`} value={e.status} />
                  )} />
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 4 }}>Parent Items</div>
                  <FullList rows={profile.parentItems} emptyText="No parent items." renderRow={(p, i) => (
                    <Row key={i} label={`${fmtDate(p.created_at)} · ${p.item_type || p.description || '—'}`} value={p.status} />
                  )} />
                </div>
              }>
              {profile.enquiries.slice(0, 3).map((e, i) => <Row key={'e'+i} label={`Enquiry · ${fmtDate(e.created_at)}`} value={e.status} />)}
              {profile.parentItems.slice(0, 3).map((p, i) => <Row key={'p'+i} label={`Item · ${fmtDate(p.created_at)}`} value={p.status} />)}
            </Section>

            <Section icon="⚠️" title="Complaints" accent={profile.complaints.length ? RED : GREEN} count={profile.complaints.length} empty={profile.complaints.length === 0 && 'No complaints on record.'}
              exportRows={profile.complaints} exportName={`${selected.name}_complaints`}
              moduleLink={onNavigate ? { label: "Reception", onClick: () => onNavigate("reception") } : null}
              full={<FullList rows={profile.complaints} emptyText="No complaints." renderRow={(c, i) => (
                <Row key={i} label={`${fmtDate(c.created_at)} · ${c.category || '—'}`} value={c.status} />
              )} />}>
              {profile.complaints.slice(0, 5).map((c, i) => <Row key={i} label={fmtDate(c.created_at)} value={c.status} />)}
            </Section>

          </div>
        </div>
      )}
      </>}
    </div>
  )
}

// ── Cross-module mismatch panel ─────────────────────────────────────────────
// This is the actual point of the module: surface disagreements between
// what different tables say about the same student, instead of making
// Himan notice them by cross-referencing tabs manually. Detection logic
// itself lives in mismatchDetector.js so the background auto-scanner
// (mismatchScanner.js) can never disagree with what's shown here.
function MismatchFlags({ student, profile, onNotify, notifyState }) {
  const flags = useMemo(() => detectMismatches(student, profile), [student, profile])

  if (flags.length === 0) return null

  const btnLabel = {
    idle: '🔔 Notify Admin',
    sending: 'Sending…',
    sent: '✓ Admin notified',
    none: 'Already flagged — no new alert sent',
    error: 'Failed — try again',
  }[notifyState] || '🔔 Notify Admin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {flags.map((f, i) => (
        <div key={f.key || i} style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12,
          background: f.level === 'red' ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${f.level === 'red' ? '#fecaca' : '#fde68a'}`,
        }}>
          <span style={{ fontSize: 14 }}>{f.level === 'red' ? '🔴' : '🟡'}</span>
          <span style={{ fontSize: 12.5, color: f.level === 'red' ? '#991b1b' : '#92400e', lineHeight: 1.5 }}>{f.text}</span>
        </div>
      ))}
      <button
        onClick={onNotify}
        disabled={notifyState === 'sending' || notifyState === 'sent'}
        style={{
          alignSelf: 'flex-start', marginTop: 2, padding: '8px 16px', borderRadius: 10, border: 'none',
          background: notifyState === 'sent' ? '#16a34a' : notifyState === 'error' ? '#dc2626' : NAVY,
          color: '#fff', fontSize: 12.5, fontWeight: 700,
          cursor: (notifyState === 'sending' || notifyState === 'sent') ? 'default' : 'pointer',
          opacity: notifyState === 'sending' ? 0.7 : 1,
        }}
      >
        {btnLabel}
      </button>
    </div>
  )
}

// ── Mismatch Dashboard ──────────────────────────────────────────────────────
// School-wide view of everything mismatchScanner.js (hourly auto-scan) and
// the manual "Notify Admin" button have logged. This is the answer to
// "what's currently wrong across the whole roster," as opposed to the
// Search tab which answers "what's wrong with THIS student."
// ── Global Search ────────────────────────────────────────────────────────
// Searches every table in tableRegistry.js — not just student names — so
// a receipt number, gate pass reason, or discipline note surfaces the
// student it belongs to. This is the "find anything" half of the data
// centre; TableBrowser is the "browse everything" half.
function GlobalSearchPanel({ onOpenStudent, onOpenModule }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tableFilter, setTableFilter] = useState('all')

  const runSearch = useCallback(async () => {
    if (term.trim().length < 2) return
    setLoading(true)
    const hits = await globalSearch(term)
    setResults(hits)
    setLoading(false)
  }, [term])

  const filtered = useMemo(() => {
    if (!results) return []
    if (tableFilter === 'all') return results
    return results.filter(h => h.table.key === tableFilter)
  }, [results, tableFilter])

  const tablesInResults = useMemo(() => {
    if (!results) return []
    return [...new Set(results.map(h => h.table.key))]
  }, [results])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={term} onChange={e => setTerm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runSearch()}
          placeholder="Search a receipt number, gate pass reason, discipline note, phone number, anything…"
          style={{ flex: '1 1 320px', minWidth: 220, padding: '10px 14px', borderRadius: 12, border: `1px solid ${SLATE[200]}`, fontSize: 13.5 }}
        />
        <button onClick={runSearch} disabled={term.trim().length < 2}
          style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: term.trim().length < 2 ? SLATE[300] : NAVY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: term.trim().length < 2 ? 'default' : 'pointer' }}>
          Search
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: SLATE[400] }}>⏳ Searching every module…</div>}

      {results !== null && !loading && (
        <>
          {tablesInResults.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setTableFilter('all')} style={{
                padding: '5px 12px', borderRadius: 99, border: `1px solid ${tableFilter === 'all' ? NAVY : SLATE[200]}`,
                background: tableFilter === 'all' ? NAVY : '#fff', color: tableFilter === 'all' ? '#fff' : SLATE[600],
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              }}>All ({results.length})</button>
              {tablesInResults.map(key => {
                const t = results.find(h => h.table.key === key).table
                const count = results.filter(h => h.table.key === key).length
                return (
                  <button key={key} onClick={() => setTableFilter(key)} style={{
                    padding: '5px 12px', borderRadius: 99, border: `1px solid ${tableFilter === key ? NAVY : SLATE[200]}`,
                    background: tableFilter === key ? NAVY : '#fff', color: tableFilter === key ? '#fff' : SLATE[600],
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  }}>{t.icon} {t.label} ({count})</button>
                )
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: SLATE[400], background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}` }}>
              No matches for "{term}".
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}`, overflow: 'hidden' }}>
              {filtered.map((hit, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < filtered.length - 1 ? `1px solid ${SLATE[100]}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 15 }}>{hit.table.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: SLATE[700] }}>{hit.summary}</div>
                      <div style={{ fontSize: 10.5, color: SLATE[400], marginTop: 1 }}>
                        {hit.table.label}{hit.student ? ` · ${hit.student.name}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {hit.student && (
                      <button onClick={() => onOpenStudent(hit.student)}
                        style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11, fontWeight: 700, color: NAVY, cursor: 'pointer' }}>
                        View Student
                      </button>
                    )}
                    {onOpenModule && (
                      <button onClick={() => onOpenModule(hit.table.module)}
                        style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: SLATE[100], fontSize: 11, fontWeight: 700, color: SLATE[600], cursor: 'pointer' }}>
                        Open in {hit.table.label} →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MismatchDashboard({ currentUser, onOpenStudent }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('all')   // 'all' | 'red' | 'amber'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'open' | 'acknowledged'
  const [flagFilter, setFlagFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getOpenMismatches(500)
    setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const flagKeys = useMemo(() => [...new Set(rows.map(r => r.flag_key))].sort(), [rows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(r => {
      if (levelFilter !== 'all' && r.level !== levelFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (flagFilter !== 'all' && r.flag_key !== flagFilter) return false
      if (term && !(r.student_name || '').toLowerCase().includes(term) && !String(r.gcc_no || '').includes(term)) return false
      return true
    })
  }, [rows, levelFilter, statusFilter, flagFilter, search])

  const stats = useMemo(() => ({
    total: rows.length,
    red: rows.filter(r => r.level === 'red').length,
    amber: rows.filter(r => r.level === 'amber').length,
    students: new Set(rows.map(r => r.student_id)).size,
    unacknowledged: rows.filter(r => r.status === 'open').length,
  }), [rows])

  const doAck = async id => {
    setBusyId(id)
    await acknowledgeMismatch(id, currentUser?.name || currentUser?.username || null)
    await refresh()
    setBusyId(null)
  }
  const doResolve = async id => {
    setBusyId(id)
    await resolveMismatch(id, currentUser?.name || currentUser?.username || null)
    await refresh()
    setBusyId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        {[
          { label: 'Total open', value: stats.total, color: NAVY },
          { label: 'Critical', value: stats.red, color: RED },
          { label: 'Warning', value: stats.amber, color: AMBER },
          { label: 'Students affected', value: stats.students, color: SKY },
          { label: 'Unacknowledged', value: stats.unacknowledged, color: stats.unacknowledged > 0 ? RED : GREEN },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${SLATE[200]}`, padding: '12px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11.5, color: SLATE[500], marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter by student name or GCC…"
          style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${SLATE[200]}`, fontSize: 12.5, flex: '1 1 220px', minWidth: 180 }}
        />
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${SLATE[200]}`, fontSize: 12.5 }}>
          <option value="all">All severities</option>
          <option value="red">🔴 Critical only</option>
          <option value="amber">🟡 Warning only</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${SLATE[200]}`, fontSize: 12.5 }}>
          <option value="all">All statuses</option>
          <option value="open">Open (unacknowledged)</option>
          <option value="acknowledged">Acknowledged</option>
        </select>
        <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${SLATE[200]}`, fontSize: 12.5 }}>
          <option value="all">All issue types</option>
          {flagKeys.map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={refresh} style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 12.5, fontWeight: 700, color: NAVY, cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: SLATE[400] }}>⏳ Loading mismatch log…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: SLATE[400], background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}` }}>
          {rows.length === 0 ? '✅ No open mismatches — everything checks out.' : 'No rows match the current filters.'}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}`, overflow: 'hidden' }}>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: SLATE[50], position: 'sticky', top: 0 }}>
                  {['', 'Student', 'Issue', 'Detected', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: SLATE[500], fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: `1px solid ${SLATE[200]}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${SLATE[100]}` }}>
                    <td style={{ padding: '9px 12px' }}>{r.level === 'red' ? '🔴' : '🟡'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <button onClick={() => onOpenStudent({ id: r.student_id, name: r.student_name, gcc_no: r.gcc_no })}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: NAVY, fontWeight: 700 }}>
                        {r.student_name || '—'}
                      </button>
                      {r.gcc_no && <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: SLATE[400] }}>GCC-{r.gcc_no}</div>}
                    </td>
                    <td style={{ padding: '9px 12px', color: SLATE[600], maxWidth: 380 }}>{r.message}</td>
                    <td style={{ padding: '9px 12px', color: SLATE[500], whiteSpace: 'nowrap' }}>{fmtDate(r.detected_at)}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', color: '#fff', background: r.status === 'open' ? AMBER : SKY }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      {r.status === 'open' && (
                        <button disabled={busyId === r.id} onClick={() => doAck(r.id)}
                          style={{ marginRight: 6, padding: '5px 10px', borderRadius: 7, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11, fontWeight: 700, color: SLATE[600], cursor: 'pointer' }}>
                          Acknowledge
                        </button>
                      )}
                      <button disabled={busyId === r.id} onClick={() => doResolve(r.id)}
                        style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: GREEN, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── School Overview ─────────────────────────────────────────────────────────
// The all-school view: enrollment, fees, attendance, hostel — one screen.
// Every number here is pulled live from the same tables/columns each
// module already writes to (adm_fee_collections.amount_paid,
// adm_flat_fees.amount, adm_course_fees.amount_paid, attendance_records,
// hostel_allocations) — nothing is estimated or derived from a cache, so
// this can't silently disagree with what Fees.jsx/Attendance.jsx/
// Hostel.jsx show on their own tabs.
function SchoolOverview({ onOpenStudent }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [defaulters, setDefaulters] = useState(null) // null = not yet computed
  const [computingDefaulters, setComputingDefaulters] = useState(false)
  const [defaultersProgress, setDefaultersProgress] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)

      // Active roster — source of truth via studentQueries.js, same list
      // every other module now uses. admission_date included because
      // feeDues.js needs it to exclude pre-admission months.
      const students = await getActiveStudents('id,name,gcc_no,course,batch,class_name,house,hostel_type,status,admission_date')

      const idList = students.map(s => s.id)

      // Fee collections THIS MONTH across all three payment tables, plus
      // running totals — same three tables/columns Student360's own
      // profile loader and Fees.jsx use.
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

      const [admFees, flatFees, courseFees, attSessions, houses, hostelAllocs] = await Promise.all([
        supabase.from('adm_fee_collections').select('amount_paid,pay_date,adm_app_id').eq('reverted', false),
        supabase.from('adm_flat_fees').select('amount,pay_date,adm_app_id').eq('paid', true).eq('reverted', false),
        supabase.from('adm_course_fees').select('amount_paid,pay_date,adm_app_id').eq('reverted', false),
        // Last 30 days of attendance sessions, for a school-wide rate —
        // capped range so this stays a quick dashboard query, not a
        // full-year scan.
        supabase.from('attendance_sessions').select('id,session_date').gte('session_date', new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)),
        supabase.from('houses').select('name').order('name'),
        idList.length ? supabase.from('hostel_allocations').select('student_id,house').in('student_id', idList) : Promise.resolve({ data: [] }),
      ])

      let attRecords = { data: [] }
      const sessionIds = (attSessions.data || []).map(s => s.id)
      if (sessionIds.length) {
        attRecords = await supabase.from('attendance_records').select('status,session_id').in('session_id', sessionIds).not('session_id', 'is', null)
      }

      if (cancelled) return

      // ── Enrollment breakdown ──
      const byCourse = {}
      const byHouse = {}
      students.forEach(s => {
        const c = s.course || 'Unassigned'
        byCourse[c] = (byCourse[c] || 0) + 1
        const h = s.house || 'No House'
        byHouse[h] = (byHouse[h] || 0) + 1
      })

      // ── Fees ──
      const sumBy = (rows, field, dateFromMonth) => (rows || [])
        .filter(r => !dateFromMonth || (r.pay_date && r.pay_date >= monthStart))
        .reduce((s, r) => s + Number(r[field] || 0), 0)

      const totalCollected = sumBy(admFees.data, 'amount_paid') + sumBy(flatFees.data, 'amount') + sumBy(courseFees.data, 'amount_paid')
      const thisMonthCollected = sumBy(admFees.data, 'amount_paid', true) + sumBy(flatFees.data, 'amount', true) + sumBy(courseFees.data, 'amount_paid', true)

      // Students with zero payments recorded at all — quick defaulter signal.
      const paidGccSet = new Set([
        ...(admFees.data || []).map(r => String(r.adm_app_id)),
        ...(flatFees.data || []).map(r => String(r.adm_app_id)),
        ...(courseFees.data || []).map(r => String(r.adm_app_id)),
      ])
      const noPaymentStudents = students.filter(s => s.gcc_no && !paidGccSet.has(String(s.gcc_no)))

      // ── Attendance ──
      const attRows = attRecords.data || []
      const presentCount = attRows.filter(r => r.status === 'Present').length
      const attendanceRate = attRows.length ? Math.round((presentCount / attRows.length) * 100) : null

      // ── Hostel occupancy ──
      const allocByHouse = {}
      const allocatedStudentIds = new Set()
      ;(hostelAllocs.data || []).forEach(a => {
        const h = a.house || 'Unassigned'
        allocByHouse[h] = (allocByHouse[h] || 0) + 1
        allocatedStudentIds.add(a.student_id)
      })
      const boarders = (hostelAllocs.data || []).length
      const dayScholars = students.length - boarders
      // house -> array of student objects, built from the ACTUAL allocation
      // rows (hostel_allocations.house), not student.house — those two can
      // disagree (that disagreement is literally one of the mismatch flags
      // in mismatchDetector.js), so the drill-down here must match what
      // allocByHouse counted, not a different field.
      const studentsById = {}
      students.forEach(s => { studentsById[s.id] = s })
      const allocStudentsByHouse = {}
      ;(hostelAllocs.data || []).forEach(a => {
        const h = a.house || 'Unassigned'
        const s = studentsById[a.student_id]
        if (!s) return
        if (!allocStudentsByHouse[h]) allocStudentsByHouse[h] = []
        allocStudentsByHouse[h].push(s)
      })

      setData({
        totalStudents: students.length,
        students,
        byCourse, byHouse,
        totalCollected, thisMonthCollected,
        noPaymentStudents,
        attendanceRate, attendanceSessions: sessionIds.length,
        houses: (houses.data || []).map(h => h.name),
        allocByHouse, allocStudentsByHouse, boarders, dayScholars,
      })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Real dues (expected vs paid, via feeEngine.js's rate logic) across the
  // WHOLE active roster is expensive — several queries per student, times
  // hundreds of students. Rather than run it automatically every time this
  // tab opens, it's opt-in: the KPI cards above show a cheap heuristic
  // (zero payments at all), and this button computes the real figure on
  // demand, in small batches, with a progress readout.
  const computeDefaulters = useCallback(async () => {
    if (!data?.students) return
    setComputingDefaulters(true)
    setDefaultersProgress({ done: 0, total: data.students.length })
    try {
      const results = await getDuesForStudents(data.students, undefined, {
        batchSize: 8,
        onProgress: p => setDefaultersProgress(p),
      })
      const withDues = results.filter(r => r.dues.totalDue > 0).sort((a, b) => b.dues.totalDue - a.dues.totalDue)
      setDefaulters(withDues)
    } catch (e) {
      console.error('computeDefaulters failed:', e.message)
    } finally {
      setComputingDefaulters(false)
    }
  }, [data])

  if (loading || !data) {
    return <div style={{ textAlign: 'center', padding: 60, color: SLATE[400] }}>⏳ Compiling school-wide figures…</div>
  }

  const maxCourseCount = Math.max(1, ...Object.values(data.byCourse))
  const maxHouseCount = Math.max(1, ...Object.values(data.byHouse))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Top KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <KpiCard icon="🎓" label="Active students" value={data.totalStudents} color={NAVY} />
        <KpiCard icon="💰" label="Collected this month" value={`₹${fmt(data.thisMonthCollected)}`} color={GREEN} />
        <KpiCard icon="📈" label="Total collected (all-time)" value={`₹${fmt(data.totalCollected)}`} color={SKY} />
        <KpiCard icon="📋" label="Attendance rate (30d)" value={data.attendanceRate == null ? '—' : `${data.attendanceRate}%`}
          color={data.attendanceRate == null ? SLATE[500] : data.attendanceRate < 75 ? RED : GREEN} />
        <KpiCard icon="🏠" label="Boarders / Day scholars" value={`${data.boarders} / ${data.dayScholars}`} color={AMBER} />
        <KpiCard icon="⚠️" label="No fee payment on record" value={data.noPaymentStudents.length} color={data.noPaymentStudents.length > 0 ? RED : GREEN} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>

        {/* Enrollment by course */}
        <Section icon="🎓" title="Enrollment by Course" accent={NAVY}
          full={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(data.byCourse).sort((a, b) => b[1] - a[1]).map(([course, count]) => (
                <div key={course}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{course} ({count})</div>
                  <FullList rows={data.students.filter(s => (s.course || 'Unassigned') === course)} renderRow={s => (
                    <Row key={s.id} label={s.name} value={s.batch || '—'} />
                  )} />
                </div>
              ))}
            </div>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(data.byCourse).sort((a, b) => b[1] - a[1]).map(([course, count]) => (
              <div key={course}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: SLATE[600], fontWeight: 600 }}>{course}</span>
                  <span style={{ color: SLATE[500] }}>{count}</span>
                </div>
                <div style={{ height: 6, background: SLATE[100], borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / maxCourseCount) * 100}%`, background: NAVY, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Enrollment by house */}
        <Section icon="🏠" title="Students by House" accent={AMBER}
          full={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(data.byHouse).sort((a, b) => b[1] - a[1]).map(([house, count]) => (
                <div key={house}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: AMBER, marginBottom: 4 }}>{house} ({count})</div>
                  <FullList rows={data.students.filter(s => (s.house || 'No House') === house)} renderRow={s => (
                    <Row key={s.id} label={s.name} value={s.course || '—'} />
                  )} />
                </div>
              ))}
            </div>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(data.byHouse).sort((a, b) => b[1] - a[1]).map(([house, count]) => (
              <div key={house}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: SLATE[600], fontWeight: 600 }}>{house}</span>
                  <span style={{ color: SLATE[500] }}>{count}</span>
                </div>
                <div style={{ height: 6, background: SLATE[100], borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / maxHouseCount) * 100}%`, background: AMBER, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Fee summary */}
        <Section icon="💰" title="Fee Collection Summary" accent={GREEN}>
          <Row label="Collected this month" value={`₹${fmt(data.thisMonthCollected)}`} />
          <Row label="Collected all-time" value={`₹${fmt(data.totalCollected)}`} />
          <Row label="Students with zero payments" value={data.noPaymentStudents.length} />
        </Section>

        {/* Hostel occupancy */}
        <Section icon="🏨" title="Hostel Occupancy by House" accent={SKY}
          full={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.houses.map(h => (
                <div key={h}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: SKY, marginBottom: 4 }}>{h} ({data.allocByHouse[h] || 0})</div>
                  <FullList rows={data.allocStudentsByHouse[h] || []} emptyText="No students allocated to this house." renderRow={s => (
                    <Row key={s.id} label={s.name} value={s.course || '—'} />
                  )} />
                </div>
              ))}
            </div>
          }>
          {data.houses.length === 0 ? (
            <div style={{ fontSize: 12.5, color: SLATE[400], textAlign: 'center', padding: '10px 0' }}>No houses configured.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.houses.map(h => (
                <Row key={h} label={h} value={data.allocByHouse[h] || 0} />
              ))}
              <Row label="Day scholars (no allocation)" value={data.dayScholars} />
            </div>
          )}
        </Section>

      </div>

      {/* Students with zero fee payments — actionable list */}
      {data.noPaymentStudents.length > 0 && (
        <Section icon="🚩" title="Students With No Fee Payment On Record" accent={RED} count={data.noPaymentStudents.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
            {data.noPaymentStudents.slice(0, 50).map(s => (
              <button key={s.id} onClick={() => onOpenStudent(s)}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5 }}
                onMouseEnter={e => e.currentTarget.style.background = SLATE[50]}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontWeight: 700, color: NAVY }}>{s.name}</span>
                <span style={{ color: SLATE[500] }}>{s.course || '—'} · {s.batch || '—'}</span>
              </button>
            ))}
            {data.noPaymentStudents.length > 50 && (
              <div style={{ fontSize: 11.5, color: SLATE[400], padding: '4px 8px' }}>+{data.noPaymentStudents.length - 50} more</div>
            )}
          </div>
        </Section>
      )}

      {/* Real fee dues — opt-in, computed on demand via feeEngine.js's
          actual rate/override/admission-date logic, not a heuristic. */}
      <Section icon="📐" title="Fee Defaulters (Exact Amounts Owed)" accent={RED}
        empty={defaulters === null && !computingDefaulters && 'Not computed yet — this checks real rates, overrides, and month-by-month payment history for every active student, so it runs on demand rather than automatically.'}>
        {defaulters === null && !computingDefaulters && (
          <button onClick={computeDefaulters} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Compute Exact Dues
          </button>
        )}
        {computingDefaulters && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SLATE[500], fontSize: 12.5 }}>
            ⏳ Checking {defaultersProgress?.done ?? 0} / {defaultersProgress?.total ?? '…'} students…
          </div>
        )}
        {defaulters !== null && !computingDefaulters && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: SLATE[500] }}>{defaulters.length} student(s) with dues, totalling ₹{fmt(defaulters.reduce((s, r) => s + r.dues.totalDue, 0))}</span>
              <button onClick={computeDefaulters} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11, fontWeight: 700, color: NAVY, cursor: 'pointer' }}>↻ Recompute</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              {defaulters.slice(0, 100).map(({ student, dues: d }) => (
                <button key={student.id} onClick={() => onOpenStudent(student)}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 8px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5 }}
                  onMouseEnter={e => e.currentTarget.style.background = SLATE[50]}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 700, color: NAVY }}>{student.name} <span style={{ fontWeight: 500, color: SLATE[400] }}>· {student.course || '—'}</span></span>
                  <span style={{ fontWeight: 800, color: RED }}>₹{fmt(d.totalDue)}</span>
                </button>
              ))}
              {defaulters.length === 0 && <div style={{ fontSize: 12.5, color: GREEN, textAlign: 'center', padding: '14px 0' }}>✅ No students have outstanding dues.</div>}
              {defaulters.length > 100 && <div style={{ fontSize: 11.5, color: SLATE[400], padding: '4px 8px' }}>+{defaulters.length - 100} more</div>}
            </div>
          </>
        )}
      </Section>
    </div>
  )
}

function KpiCard({ icon, label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${SLATE[200]}`, padding: '12px 14px' }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: SLATE[500], marginTop: 2 }}>{label}</div>
    </div>
  )
}