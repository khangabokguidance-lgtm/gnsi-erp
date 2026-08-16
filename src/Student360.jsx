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
function Section({ icon, title, count, children, accent = NAVY, empty }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${SLATE[100]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: SLATE[50] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: NAVY, letterSpacing: '.01em' }}>{title}</span>
        </div>
        {count != null && <span style={{ fontSize: 11.5, fontWeight: 700, color: accent, background: `${accent}18`, padding: '2px 10px', borderRadius: 99 }}>{count}</span>}
      </div>
      <div style={{ padding: '14px 18px' }}>
        {empty ? <div style={{ fontSize: 12.5, color: SLATE[400], textAlign: 'center', padding: '18px 0' }}>{empty}</div> : children}
      </div>
    </div>
  )
}

const Row = ({ label, value, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${SLATE[100]}`, fontSize: 13 }}>
    <span style={{ color: SLATE[500] }}>{label}</span>
    <span style={{ fontWeight: 600, color: SLATE[700], fontFamily: mono ? 'monospace' : 'inherit' }}>{value ?? '—'}</span>
  </div>
)

// ── Data loader ──────────────────────────────────────────────────────────────
// Every query here is scoped to ONE student (by id or gcc_no), pulling
// directly from each module's own tables — the same tables Admissions,
// Attendance, Exams, Fees, Hostel, and Reception each already use. Nothing
// here re-derives or guesses at data; it reads exactly what those modules
// wrote, so a mismatch between what a module SHOWS and what's actually IN
// the table becomes visible here.
async function loadFullProfile(student) {
  const gcc = String(student.gcc_no || '')
  const id = student.id

  // Attendance — attendance_records is NOT consistently keyed by
  // student_id alone (confirmed in Students.jsx's own profile loader);
  // some rows only have gcc_no or student_name populated. Query all three
  // and dedupe by session_id+status, same fallback Students.jsx uses, or
  // this view would UNDERCOUNT attendance for exactly the students this
  // tool exists to catch mismatches for.
  const attQueries = [supabase.from('attendance_records').select('status,session_id').eq('student_id', id).not('session_id', 'is', null).limit(300)]
  if (gcc) attQueries.push(supabase.from('attendance_records').select('status,session_id').eq('gcc_no', gcc).not('session_id', 'is', null).limit(300))
  attQueries.push(supabase.from('attendance_records').select('status,session_id').eq('student_name', student.name).not('session_id', 'is', null).limit(300))

  const [
    admission,
    admFeeCols, admFlatFees, admCourseFees,
    ...attResults
  ] = await Promise.all([
    // Admissions — original application record, by GCC no
    gcc ? supabase.from('admissions').select('*').eq('gcc_no', gcc).maybeSingle() : Promise.resolve({ data: null }),

    // Fees — three payment tables Fees.jsx/Admissions.jsx write to
    gcc ? supabase.from('adm_fee_collections').select('*').eq('adm_app_id', gcc).eq('reverted', false).order('pay_date', { ascending: false }) : Promise.resolve({ data: [] }),
    gcc ? supabase.from('adm_flat_fees').select('*').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false).order('pay_date', { ascending: false }) : Promise.resolve({ data: [] }),
    gcc ? supabase.from('adm_course_fees').select('*').eq('adm_app_id', gcc).eq('reverted', false).order('pay_date', { ascending: false }) : Promise.resolve({ data: [] }),

    ...attQueries,
  ])

  const [
    hostelAlloc, disciplineRecs, sickbayRecs, leaveRecs,
    gatePasses, enquiries, parentItems, complaints,
  ] = await Promise.all([
    // Hostel — current allocation, discipline, sickbay, leave history
    supabase.from('hostel_allocations').select('*,hostel_rooms(room_no,floor,capacity,room_type)').eq('student_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('discipline_records').select('*').eq('student_id', id).order('date', { ascending: false }),
    supabase.from('sickbay_records').select('*').eq('student_id', id).order('date', { ascending: false }),
    supabase.from('leave_records').select('*').eq('student_id', id).order('from_date', { ascending: false }).limit(20),

    // Reception — gate passes, enquiries, parent items, complaints
    supabase.from('reception_gatepasses').select('*').eq('student_name', student.name).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('reception_enquiries').select('*').or(`student_name.eq.${student.name},phone.eq.${student.phone || '__'}`).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('reception_parent_items').select('*').eq('student_name', student.name).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('reception_complaints').select('*').eq('student_name', student.name).is('deleted_at', null).order('created_at', { ascending: false }),
  ])

  // Dedupe attendance across the three lookup keys by session_id+status,
  // same as Students.jsx.
  const seen = new Set()
  const attRows = []
  attResults.forEach(({ data }) => {
    (data || []).forEach(r => {
      const key = `${r.session_id}|${r.status}`
      if (seen.has(key)) return
      seen.add(key); attRows.push(r)
    })
  })

  // Exam marks — queried separately since it wasn't part of either
  // Promise.all batch above.
  const examMarks = await supabase.from('exam_marks').select('exam_type_id,exam_date,subject,marks_obtained').eq('student_id', id).order('exam_date', { ascending: false })

  const presentCount = attRows.filter(r => r.status === 'Present').length
  const attendancePct = attRows.length ? Math.round((presentCount / attRows.length) * 100) : null

  const admFeeTotal = (admFeeCols.data || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0)
  const flatFeeTotal = (admFlatFees.data || []).reduce((s, r) => s + Number(r.amount || 0), 0)
  const courseFeeTotal = (admCourseFees.data || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0)

  return {
    admission: admission.data || null,
    fees: { admFeeCols: admFeeCols.data || [], admFlatFees: admFlatFees.data || [], admCourseFees: admCourseFees.data || [], total: admFeeTotal + flatFeeTotal + courseFeeTotal },
    attendance: { records: attRows, presentCount, totalMarked: attRows.length, pct: attendancePct },
    exams: examMarks.data || [],
    hostel: hostelAlloc.data?.[0] || null,
    discipline: disciplineRecs.data || [],
    sickbay: sickbayRecs.data || [],
    leave: leaveRecs.data || [],
    gatePasses: gatePasses.data || [],
    enquiries: enquiries.data || [],
    parentItems: parentItems.data || [],
    complaints: complaints.data || [],
  }
}

// ── Main component ──────────────────────────────────────────────────────────
// App.jsx passes isAdmin (from its own ADMIN_ROLES check) — see the wiring
// note above. Defaults to false so this component fails closed if it's
// ever mounted without that prop.
export default function Student360({ currentUser, isAdmin = false }) {
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)

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
    setLoading(true)
    // Re-fetch the FULL row (getActiveStudents above only pulled a lean
    // column set for the search dropdown) so every field this view shows
    // — notes, dob, parent info, admission_date, etc. — is current.
    const full = await getStudentById(s.id, '*')
    const data = await loadFullProfile(full || s)
    setProfile(data)
    setLoading(false)
  }, [])

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
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 20, color: NAVY, fontFamily: 'Georgia, serif' }}>Student 360°</div>
        <div style={{ fontSize: 12.5, color: SLATE[500], marginTop: 2 }}>Cross-module record — everything every module has recorded for one student, in one place.</div>
      </div>

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
          <MismatchFlags student={selected} profile={profile} />

          {/* Grid of module sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>

            <Section icon="📝" title="Admission Record" accent={SKY} empty={!profile.admission && 'No admissions record found for this GCC number.'}>
              {profile.admission && <>
                <Row label="Status" value={profile.admission.status} />
                <Row label="Applied" value={fmtDate(profile.admission.created_at)} />
                <Row label="Course" value={profile.admission.course} />
              </>}
            </Section>

            <Section icon="💰" title="Fees" accent={GREEN} count={profile.fees.admFeeCols.length + profile.fees.admFlatFees.length + profile.fees.admCourseFees.length}>
              <Row label="Total Paid" value={`₹${fmt(profile.fees.total)}`} />
              <Row label="Admission fee payments" value={profile.fees.admFeeCols.length} />
              <Row label="Flat fee payments" value={profile.fees.admFlatFees.length} />
              <Row label="Course fee payments" value={profile.fees.admCourseFees.length} />
            </Section>

            <Section icon="📋" title="Attendance" accent={profile.attendance.pct == null ? SLATE[500] : profile.attendance.pct < 75 ? RED : GREEN}
              empty={profile.attendance.totalMarked === 0 && 'No attendance records found for this student.'}>
              {profile.attendance.totalMarked > 0 && <>
                <Row label="Sessions marked" value={profile.attendance.totalMarked} />
                <Row label="Present" value={profile.attendance.presentCount} />
                <Row label="Attendance %" value={`${profile.attendance.pct}%`} />
              </>}
            </Section>

            <Section icon="✏️" title="Exam Marks" accent={SKY} count={profile.exams.length} empty={profile.exams.length === 0 && 'No exam marks recorded for this student.'}>
              {profile.exams.slice(0, 5).map((m, i) => (
                <Row key={i} label={`${m.subject} · ${fmtDate(m.exam_date)}`} value={m.marks_obtained} />
              ))}
              {profile.exams.length > 5 && <div style={{ fontSize: 11.5, color: SLATE[400], marginTop: 6 }}>+{profile.exams.length - 5} more</div>}
            </Section>

            <Section icon="🏠" title="Hostel" accent={profile.hostel ? GREEN : SLATE[500]} empty={!profile.hostel && 'Day scholar — no hostel allocation.'}>
              {profile.hostel && <>
                <Row label="Room" value={profile.hostel.hostel_rooms?.room_no} />
                <Row label="Floor" value={profile.hostel.hostel_rooms?.floor} />
                <Row label="Allotted" value={fmtDate(profile.hostel.created_at)} />
              </>}
            </Section>

            <Section icon="🚩" title="Discipline" accent={profile.discipline.length ? AMBER : GREEN} count={profile.discipline.length} empty={profile.discipline.length === 0 && 'No discipline records.'}>
              {profile.discipline.slice(0, 5).map((d, i) => <Row key={i} label={fmtDate(d.date)} value={d.status} />)}
            </Section>

            <Section icon="🏥" title="Sickbay" accent={profile.sickbay.some(s => s.status === 'Admitted') ? RED : SLATE[500]} count={profile.sickbay.length} empty={profile.sickbay.length === 0 && 'No sickbay records.'}>
              {profile.sickbay.slice(0, 5).map((s, i) => <Row key={i} label={fmtDate(s.date)} value={s.status} />)}
            </Section>

            <Section icon="🎫" title="Leave Records" accent={SKY} count={profile.leave.length} empty={profile.leave.length === 0 && 'No leave records.'}>
              {profile.leave.slice(0, 5).map((l, i) => <Row key={i} label={fmtDate(l.from_date)} value={l.status} />)}
            </Section>

            <Section icon="🪪" title="Gate Passes" accent={profile.gatePasses.some(g => g.status === 'Issued') ? AMBER : SLATE[500]} count={profile.gatePasses.length} empty={profile.gatePasses.length === 0 && 'No gate passes.'}>
              {profile.gatePasses.slice(0, 5).map((g, i) => <Row key={i} label={fmtDate(g.created_at)} value={g.status} />)}
            </Section>

            <Section icon="📞" title="Enquiries & Parent Items" accent={SKY} count={profile.enquiries.length + profile.parentItems.length}
              empty={profile.enquiries.length === 0 && profile.parentItems.length === 0 && 'No enquiries or parent items.'}>
              {profile.enquiries.slice(0, 3).map((e, i) => <Row key={'e'+i} label={`Enquiry · ${fmtDate(e.created_at)}`} value={e.status} />)}
              {profile.parentItems.slice(0, 3).map((p, i) => <Row key={'p'+i} label={`Item · ${fmtDate(p.created_at)}`} value={p.status} />)}
            </Section>

            <Section icon="⚠️" title="Complaints" accent={profile.complaints.length ? RED : GREEN} count={profile.complaints.length} empty={profile.complaints.length === 0 && 'No complaints on record.'}>
              {profile.complaints.slice(0, 5).map((c, i) => <Row key={i} label={fmtDate(c.created_at)} value={c.status} />)}
            </Section>

          </div>
        </div>
      )}
    </div>
  )
}

// ── Cross-module mismatch detector ──────────────────────────────────────────
// This is the actual point of the module: surface disagreements between
// what different tables say about the same student, instead of making
// Himan notice them by cross-referencing tabs manually.
function MismatchFlags({ student, profile }) {
  const flags = []

  if (student.status !== 'Dropout' && student.status !== 'Inactive' && profile.attendance.totalMarked === 0) {
    flags.push({ level: 'amber', text: 'Marked active but has zero attendance records — new admission not yet rostered, or a data entry gap.' })
  }
  if ((student.status === 'Dropout' || student.status === 'Inactive') && profile.attendance.records.some(r => r.status === 'Present')) {
    flags.push({ level: 'amber', text: 'Marked dropout/inactive but has present attendance records — check if status change date is correct.' })
  }
  if (!profile.admission) {
    flags.push({ level: 'red', text: 'No matching admissions record for this GCC number — this student may have been added directly to the roster.' })
  }
  if (profile.fees.total === 0 && student.status !== 'Dropout') {
    flags.push({ level: 'amber', text: 'No fee payments on record for an active/inactive student.' })
  }
  if (student.house && !profile.hostel) {
    flags.push({ level: 'red', text: `Student record shows house "${student.house}" but no matching hostel allocation record exists.` })
  }
  if (!student.house && profile.hostel) {
    flags.push({ level: 'red', text: 'Has a hostel allocation record but no house assigned on the student profile.' })
  }

  if (flags.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {flags.map((f, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12,
          background: f.level === 'red' ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${f.level === 'red' ? '#fecaca' : '#fde68a'}`,
        }}>
          <span style={{ fontSize: 14 }}>{f.level === 'red' ? '🔴' : '🟡'}</span>
          <span style={{ fontSize: 12.5, color: f.level === 'red' ? '#991b1b' : '#92400e', lineHeight: 1.5 }}>{f.text}</span>
        </div>
      ))}
    </div>
  )
}