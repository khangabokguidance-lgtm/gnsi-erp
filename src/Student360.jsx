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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import { getActiveStudents, getStudentById } from './studentQueries'
import { loadFullProfile } from './studentProfileLoader'
import { detectMismatches } from './mismatchDetector'
import { logAndNotify, getOpenMismatches, acknowledgeMismatch, resolveMismatch, resolveStaleFlags } from './mismatchLog'
import { getStudentDues, getDuesForStudents } from './feeDues'
import { globalSearch, browseTable } from './globalSearch'
import { downloadCSV, downloadSingleRecordCSV } from './exportUtils'
import TableBrowser, { useIsMobile } from './TableBrowser'
import { editField, getEditableFields } from './editEngine'
import RegistrationCard from './RegistrationCard'
import { allocateStudent, vacateStudent, backfillMissingAllocations, cleanupNonBoardingAllocations } from './hostelAllocation'
import { TABLE_REGISTRY } from './tableRegistry'
import AdminIntelligence from './AdminIntelligence'

// ── Pagination-safe fetch — same helper as Fees.jsx's fetchAllRows() ───────
// Supabase/PostgREST caps any query with no .range() at 1000 rows, silently
// — no error, just a truncated result. adm_course_fees alone has 1500+
// rows, so a plain unbounded .select() on it (or adm_fee_collections /
// adm_flat_fees, which will cross that line too as the school grows) was
// missing whatever fell past row 1000, undercounting every fee total this
// dashboard computes (both "this month" and the all-time total). Fees.jsx
// hit and fixed this exact bug already — porting its proven fix here
// rather than inventing a second implementation.
async function fetchAllRows(table, { select = '*', filters = [], orderCol = null, ascending = true } = {}) {
  const PAGE = 1000
  let from = 0
  let all = []
  while (true) {
    let q = supabase.from(table).select(select)
    for (const [col, op, val] of filters) q = q[op](col, val)
    if (orderCol) q = q.order(orderCol, { ascending })
    q = q.range(from, from + PAGE - 1)
    const { data, error } = await q
    if (error) { console.error(`fetchAllRows(${table}) error:`, error.message); break }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

// ── Live-refresh listeners for cross-module writes ──────────────────────────
// Same self-contained-copy pattern used in Students.jsx and Hostel.jsx (see
// their own comments on this): no import relationship to the other modules,
// the event name string is the actual contract. Without these, this module
// — whose entire purpose is showing an accurate cross-module picture — would
// itself go stale the moment someone edited a student in Students.jsx,
// reassigned a house in Hostel.jsx, or updated an application in
// Admissions.jsx, until the admin manually reselected the student or hit
// Refresh on the dashboard.
//
// 'gnsi:students-updated' — dispatched by Students.jsx and (as of this
// change) Hostel.jsx whenever the `students` table changes.
// 'gnsi:admissions-updated' — dispatched by Admissions.jsx (as of this
// change) whenever the `admissions` table changes; relevant here because
// loadFullProfile() reads admissions directly for the "no admission
// record" mismatch check.
function useCrossModuleUpdatedListener(callback) {
  useEffect(() => {
    const h1 = e => callback(e.detail, 'students')
    const h2 = e => callback(e.detail, 'admissions')
    window.addEventListener('gnsi:students-updated', h1)
    window.addEventListener('gnsi:admissions-updated', h2)
    return () => {
      window.removeEventListener('gnsi:students-updated', h1)
      window.removeEventListener('gnsi:admissions-updated', h2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback])
}

// The other half of the loop: edits made HERE (via EditableRow / the
// dashboard's InlineMismatchFix) need to notify Students.jsx/Hostel.jsx
// the same way their own edits notify each other, or a fix made in
// Student 360° would only be visible in Student 360° until someone else
// happened to refresh those modules.
function broadcastCrossModuleWrite(tableKey, detail) {
  const eventName = tableKey === 'students' ? 'gnsi:students-updated'
    : tableKey === 'admissions' ? 'gnsi:admissions-updated'
    : null
  if (!eventName) return
  try { window.dispatchEvent(new CustomEvent(eventName, { detail })) } catch (e) {
    console.error('broadcastCrossModuleWrite failed:', e)
  }
}

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
function Section({ icon, title, count, children, full, accent = NAVY, empty, defaultOpen = false, exportRows = null, exportName = null, moduleLink = null, forceOpen = null }) {
  const [open, setOpen] = useState(defaultOpen)
  const [hover, setHover] = useState(false)
  const hasMore = !!full
  const canExport = exportRows && exportRows.length > 0
  // forceOpen is a { value, token } pair from an "Expand All / Collapse
  // All" control above this card. token changes every time the button is
  // pressed (even if value repeats, e.g. two "Expand All" clicks in a
  // row) so this effect fires on every press, not just on value change —
  // otherwise a card manually collapsed by the user after "Expand All"
  // wouldn't re-open on a second "Expand All" press.
  useEffect(() => {
    if (forceOpen && hasMore) setOpen(forceOpen.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen?.token])
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', borderRadius: 14, border: `1px solid ${SLATE[200]}`, overflow: 'hidden',
        boxShadow: hover ? '0 4px 16px rgba(11,30,61,.08)' : '0 1px 3px rgba(11,30,61,.04)',
        transition: 'box-shadow .18s ease',
      }}>
      <div
        onClick={() => hasMore && setOpen(o => !o)}
        style={{ padding: '13px 18px', borderBottom: `1px solid ${SLATE[100]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(180deg, ${SLATE[50]}, #fbfcfd)`, cursor: hasMore ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 15.5, opacity: 0.9 }}>{icon}</span>
          <span style={{ fontWeight: 750, fontSize: 13, color: NAVY, letterSpacing: '.015em' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {count != null && <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: `${accent}15`, padding: '2.5px 10px', borderRadius: 99, letterSpacing: '.01em' }}>{count}</span>}
          {moduleLink && (
            <button
              onClick={e => { e.stopPropagation(); moduleLink.onClick() }}
              title={`Open ${moduleLink.label} module`}
              style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, background: '#fff', border: `1px solid ${SLATE[200]}`, borderRadius: 7, padding: '3.5px 9px', cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => e.currentTarget.style.background = SLATE[50]} onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >{moduleLink.label} →</button>
          )}
          {canExport && (
            <button
              onClick={e => { e.stopPropagation(); downloadCSV(exportRows, exportName || title.toLowerCase().replace(/\s+/g, '_')) }}
              title="Export this data as CSV"
              style={{ fontSize: 10.5, fontWeight: 700, color: SLATE[500], background: '#fff', border: `1px solid ${SLATE[200]}`, borderRadius: 7, padding: '3.5px 9px', cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => e.currentTarget.style.background = SLATE[50]} onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >⬇ CSV</button>
          )}
          {hasMore && <span style={{ fontSize: 10, color: SLATE[400], transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}>▾</span>}
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
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${SLATE[100]}`, fontSize: 13 }}>
    <span style={{ color: SLATE[500], fontWeight: 500 }}>{label}</span>
    <span style={{ fontWeight: 650, color: SLATE[700], fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right' }}>{value ?? '—'}</span>
  </div>
)

// A Row with an inline pencil icon that opens a small popover to change
// the value in place — used everywhere a field is in editEngine.js's
// whitelist for that table. Writes go straight through editField(), which
// enforces the whitelist and writes the audit_logs row; onSaved lets the
// caller refresh whatever local state depends on this value.
function EditableRow({ label, value, mono, tableKey, rowId, field, studentContext, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const fieldDef = getEditableFields(tableKey)?.[field]
  if (!fieldDef) return <Row label={label} value={value} mono={mono} />

  const startEdit = () => { setDraft(value ?? ''); setErr(null); setEditing(true) }

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      await editField({ tableKey, rowId, field, oldValue: value, newValue: draft, studentContext })
      broadcastCrossModuleWrite(tableKey, { type: 'update', student_id: studentContext?.id, field })
      setEditing(false)
      onSaved?.(draft)
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '7px 0', borderBottom: `1px solid ${SLATE[100]}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: SLATE[500], fontWeight: 500, fontSize: 13 }}>{label}</span>
        {!editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 650, color: SLATE[700], fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit' }}>{value ?? '—'}</span>
            <button onClick={startEdit} title={`Edit ${label}`}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: SLATE[300], padding: 2, lineHeight: 1 }}
              onMouseEnter={e => e.currentTarget.style.color = NAVY} onMouseLeave={e => e.currentTarget.style.color = SLATE[300]}>✎</button>
          </div>
        )}
      </div>
      {editing && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fieldDef.type === 'select' ? (
            <select value={draft} onChange={e => setDraft(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, fontSize: 12.5 }}>
              {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : fieldDef.type === 'textarea' ? (
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical' }} />
          ) : (
            <input value={draft} onChange={e => setDraft(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, fontSize: 12.5 }} />
          )}
          {err && <div style={{ fontSize: 11, color: RED }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={save} disabled={saving}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: NAVY, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}
              style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${SLATE[200]}`, background: '#fff', color: SLATE[600], fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
// App.jsx passes isAdmin (from its own ADMIN_ROLES check) — see the wiring
// note above. Defaults to false so this component fails closed if it's
// ever mounted without that prop.
export default function Student360({ currentUser, isAdmin = false, onNavigate }) {
  const [view, setView] = useState('globalsearch') // 'search' | 'globalsearch' | 'intel' | 'dashboard' | 'overview' | 'browser'
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  const [profile, setProfile] = useState(null)
  const [dues, setDues] = useState(null)
  // Holds the FULL raw `students` row ('*') for the selected student — the
  // fields Students.jsx's own StudentForm edits (name, dob, gender, course,
  // batch, session, father_name, mother_name, phone, address, remarks,
  // medical_notes, academic_remarks, prev_school, referral_source,
  // admission_date, left_date, status) but that this view previously fetched
  // and then never actually displayed. Feeds the "Student Profile" section
  // below, which is the edit-from-Student-360 interconnection point.
  const [rawStudent, setRawStudent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notifyState, setNotifyState] = useState('idle') // 'idle' | 'sending' | 'sent' | 'none' | 'error'
  // Expand All / Collapse All for the section-card grid in the search
  // view — { value: true|false, token } passed down to every Section as
  // forceOpen; token bumps on each press so repeated same-value presses
  // still re-sync any card a user manually toggled in between.
  const [expandAll, setExpandAll] = useState(null)
  const toggleExpandAll = useCallback(value => {
    setExpandAll(prev => ({ value, token: (prev?.token || 0) + 1 }))
  }, [])

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
    setRawStudent(null)
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
    setRawStudent(full || s)
    setLoading(false)
  }, [])

  // Single callback every EditableRow in the Student Profile section uses:
  // keeps rawStudent (the full row backing this section) AND selected (the
  // lean object the header banner / StatusPill / detectMismatches() read)
  // in sync after a save, so an edit made here is reflected everywhere else
  // in this same screen immediately — not just after the next reselect.
  const onProfileFieldSaved = useCallback((field, value) => {
    setRawStudent(prev => prev ? { ...prev, [field]: value } : prev)
    setSelected(prev => prev ? { ...prev, [field]: value } : prev)
  }, [])

  // Live refresh — if Students.jsx, Hostel.jsx, or Admissions.jsx changes
  // data for the student currently open in this view, re-run select() so
  // the profile (and its mismatch flags) don't go stale until the admin
  // manually reselects. Cheap to over-trigger: a cross-module write is
  // infrequent, and re-running select() just re-fetches this one student.
  const handleCrossModuleUpdate = useCallback(() => {
    if (selected) select(selected)
  }, [selected, select])
  useCrossModuleUpdatedListener(handleCrossModuleUpdate)

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
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto', padding: '22px 16px 40px', display: 'flex', flexDirection: 'column', gap: 18, background: '#f7f8fa', minHeight: '100%', minWidth: 0, overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 22, color: NAVY, fontFamily: 'Georgia, serif', letterSpacing: '-.01em' }}>Student 360°</div>
        <div style={{ fontSize: 12.5, color: SLATE[500], marginTop: 3, fontWeight: 500 }}>Cross-module record — everything every module has recorded for one student, in one place.</div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${SLATE[200]}`, flexWrap: 'wrap' }}>
        {[
          { id: 'search', label: '🔍 Search Student' },
          { id: 'globalsearch', label: '🌐 Global Search' },
          { id: 'intel', label: '🧠 Admin Intelligence' },
          { id: 'dashboard', label: '📊 Mismatch Dashboard' },
          { id: 'overview', label: '🏫 School Overview' },
          { id: 'browser', label: '🗄️ Table Browser' },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
            fontSize: 12.5, fontWeight: view === t.id ? 750 : 600, color: view === t.id ? NAVY : SLATE[400],
            borderBottom: view === t.id ? `2.5px solid ${GOLD}` : '2.5px solid transparent',
            marginBottom: -1, transition: 'color .15s, background .15s',
          }}
            onMouseEnter={e => { if (view !== t.id) e.currentTarget.style.color = SLATE[600] }}
            onMouseLeave={e => { if (view !== t.id) e.currentTarget.style.color = SLATE[400] }}
          >{t.label}</button>
        ))}
      </div>

      {view === 'overview' && <SchoolOverview onOpenStudent={s => { setView('search'); select(s) }} />}
      {view === 'dashboard' && <MismatchDashboard currentUser={currentUser} onOpenStudent={s => { setView('search'); select(s) }} />}
      {view === 'globalsearch' && <GlobalSearchPanel onOpenStudent={s => { setView('search'); select(s) }} onOpenModule={onNavigate} onOpenMismatches={() => setView('dashboard')} />}
      {view === 'intel' && <AdminIntelligence onOpenStudent={s => { setView('search'); select(s) }} />}
      {view === 'browser' && <TableBrowser onOpenStudent={s => { setView('search'); select(s) }} onOpenModule={onNavigate} />}

      {view === 'search' && <>
      <StudentSearch students={students} onSelect={select} />

      {loading && <div style={{ textAlign: 'center', padding: 60, color: SLATE[400] }}>⏳ Pulling records from every module…</div>}

      {selected && profile && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header card */}
          <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`, borderRadius: 16, padding: '20px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, boxShadow: '0 6px 20px rgba(11,30,61,.18)' }}>
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

          {/* At-a-glance dashboard for THIS student — every module's numbers
              in one strip, before drilling into the section cards below. */}
          <StudentDashboardStrip profile={profile} dues={dues} selected={selected} />

          {/* Visual charts — attendance trend, exam marks, fee breakdown */}
          <StudentCharts profile={profile} />

          {/* Quick mismatch flags — the whole point of this view */}
          <MismatchFlags student={selected} profile={profile} onNotify={notifyAdmin} notifyState={notifyState} />

          {/* Expand All / Collapse All — every section below is
              collapsed by default so the page loads compact; this lets
              admin see every field/record in every card at once without
              clicking through all ten individually. */}
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
            <button onClick={() => toggleExpandAll(true)}
              style={{ padding: '6px 14px', borderRadius: 9, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11.5, fontWeight: 700, color: NAVY, cursor: 'pointer' }}>
              ⬇ Expand All
            </button>
            <button onClick={() => toggleExpandAll(false)}
              style={{ padding: '6px 14px', borderRadius: 9, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11.5, fontWeight: 700, color: SLATE[600], cursor: 'pointer' }}>
              ⬆ Collapse All
            </button>
          </div>

          {/* Grid of module sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>

            {/* Student Profile — the raw Students.jsx row (name, status,
                course/batch, DOB, parents, contact, medical/notes, etc.).
                Edits go through the same EditableRow → editField() →
                broadcastCrossModuleWrite('students', …) pipeline already
                used below for House/Hostel Type, so a fix made here shows
                up in Students.jsx (and anywhere else listening for
                'gnsi:students-updated') without a manual refresh. Fields
                that aren't yet in editEngine.js's whitelist for the
                `students` table will render read-only via EditableRow's
                own fallback (see its `if (!fieldDef) return <Row …/>`) —
                nothing here breaks if the whitelist hasn't caught up yet. */}
            <Section forceOpen={expandAll} icon="🧑‍🎓" title="Student Profile" accent={NAVY}
              moduleLink={onNavigate ? { label: "Students", onClick: () => onNavigate("students") } : null}
              full={rawStudent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <EditableRow label="Name" value={rawStudent.name} tableKey="students" rowId={selected.id} field="name"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('name', v)} />
                  <EditableRow label="Status" value={rawStudent.status} tableKey="students" rowId={selected.id} field="status"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('status', v)} />
                  <EditableRow label="Gender" value={rawStudent.gender} tableKey="students" rowId={selected.id} field="gender"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('gender', v)} />
                  <EditableRow label="Date of Birth" value={rawStudent.dob} tableKey="students" rowId={selected.id} field="dob"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('dob', v)} />
                  <EditableRow label="Admission Date" value={rawStudent.admission_date} tableKey="students" rowId={selected.id} field="admission_date"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('admission_date', v)} />
                  {rawStudent.status === 'Withdrawn' && (
                    <EditableRow label="Left Date" value={rawStudent.left_date} tableKey="students" rowId={selected.id} field="left_date"
                      studentContext={selected} onSaved={v => onProfileFieldSaved('left_date', v)} />
                  )}

                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', margin: '10px 0 4px' }}>Course & Class</div>
                  <EditableRow label="Course" value={rawStudent.course} tableKey="students" rowId={selected.id} field="course"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('course', v)} />
                  <EditableRow label="Batch / Class" value={rawStudent.batch} tableKey="students" rowId={selected.id} field="batch"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('batch', v)} />
                  <EditableRow label="Session" value={rawStudent.session} tableKey="students" rowId={selected.id} field="session"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('session', v)} />
                  <Row label="GCC No." value={rawStudent.gcc_no} mono />
                  <Row label="Admission No." value={rawStudent.admission_no} mono />

                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', margin: '10px 0 4px' }}>Family & Contact</div>
                  <EditableRow label="Father's Name" value={rawStudent.father_name} tableKey="students" rowId={selected.id} field="father_name"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('father_name', v)} />
                  <EditableRow label="Mother's Name" value={rawStudent.mother_name} tableKey="students" rowId={selected.id} field="mother_name"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('mother_name', v)} />
                  <EditableRow label="Phone" value={rawStudent.phone} mono tableKey="students" rowId={selected.id} field="phone"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('phone', v)} />
                  <EditableRow label="Emergency Contact" value={rawStudent.emergency_contact} tableKey="students" rowId={selected.id} field="emergency_contact"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('emergency_contact', v)} />
                  <EditableRow label="Address" value={rawStudent.address} tableKey="students" rowId={selected.id} field="address"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('address', v)} />

                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', margin: '10px 0 4px' }}>Medical & Notes</div>
                  <EditableRow label="Medical / Allergy Notes" value={rawStudent.medical_notes} tableKey="students" rowId={selected.id} field="medical_notes"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('medical_notes', v)} />
                  <EditableRow label="Remarks" value={rawStudent.remarks} tableKey="students" rowId={selected.id} field="remarks"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('remarks', v)} />
                  <EditableRow label="Academic Remarks" value={rawStudent.academic_remarks} tableKey="students" rowId={selected.id} field="academic_remarks"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('academic_remarks', v)} />
                  <EditableRow label="Previous School" value={rawStudent.prev_school} tableKey="students" rowId={selected.id} field="prev_school"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('prev_school', v)} />
                  <EditableRow label="Referral Source" value={rawStudent.referral_source} tableKey="students" rowId={selected.id} field="referral_source"
                    studentContext={selected} onSaved={v => onProfileFieldSaved('referral_source', v)} />
                </div>
              )}>
              <Row label="Status" value={rawStudent?.status} />
              <Row label="Course" value={rawStudent?.course} />
              <Row label="Batch / Class" value={rawStudent?.batch} />
              <Row label="Date of Birth" value={fmtDate(rawStudent?.dob)} />
              <Row label="Phone" value={rawStudent?.phone} mono />
              <Row label="Father's Name" value={rawStudent?.father_name} />
            </Section>

            <Section forceOpen={expandAll} icon="📝" title="Admission Record" accent={SKY} empty={!profile.admission && 'No admissions record found for this GCC number.'}
              moduleLink={onNavigate ? { label: "Admissions", onClick: () => onNavigate("admissions") } : null}
              full={profile.admission && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <EditableRow label="status" value={profile.admission.status} tableKey="admissions" rowId={profile.admission.id} field="status"
                    studentContext={selected} onSaved={v => setProfile(prev => ({ ...prev, admission: { ...prev.admission, status: v } }))} />
                  {Object.entries(profile.admission).filter(([k]) => !['id', 'status'].includes(k)).map(([k, v]) => (
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

            <Section forceOpen={expandAll} icon="💰" title="Fees" accent={dues?.totalDue > 0 ? RED : GREEN} count={profile.fees.admFeeCols.length + profile.fees.admFlatFees.length + profile.fees.admCourseFees.length}
              exportRows={[
                ...profile.fees.admFeeCols.map(r => ({ type: 'Admission', ...r })),
                ...profile.fees.admFlatFees.map(r => ({ type: 'Flat', ...r })),
                ...profile.fees.admCourseFees.map(r => ({ type: 'Course', ...r })),
              ]} exportName={`${selected.name}_fee_payments`}
              moduleLink={onNavigate ? { label: "Fees", onClick: () => onNavigate("fees") } : null}
              full={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dues?.failedSources?.length > 0 && (
                    <div style={{ fontSize: 11, color: AMBER, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 10px' }}>
                      ⚠ Dues figures may be incomplete — {dues.failedSources.join(', ')} couldn't be fetched (connection issue). Refresh to retry.
                    </div>
                  )}
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
              {dues?.failedSources?.length > 0 && (
                <div style={{ fontSize: 10.5, color: AMBER, marginTop: 2 }}>⚠ Dues may be incomplete (fetch issue)</div>
              )}
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

            <Section forceOpen={expandAll} icon="📋" title="Attendance" accent={profile.attendance.pct == null ? SLATE[500] : profile.attendance.pct < 75 ? RED : GREEN}
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

            <Section forceOpen={expandAll} icon="✏️" title="Exam Marks" accent={SKY} count={profile.exams.length} empty={profile.exams.length === 0 && 'No exam marks recorded for this student.'}
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

            <Section forceOpen={expandAll} icon="🏠" title="Hostel" accent={!selected.house ? SLATE[500] : (profile.validHouses?.includes(selected.house) ? GREEN : RED)}
              moduleLink={onNavigate ? { label: "Hostel", onClick: () => onNavigate("hostel") } : null}
              full={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <EditableRow label="House" value={selected.house} tableKey="students" rowId={selected.id} field="house"
                    studentContext={selected} onSaved={v => setSelected(prev => ({ ...prev, house: v }))} />
                  <EditableRow label="Hostel Type" value={selected.hostel_type} tableKey="students" rowId={selected.id} field="hostel_type"
                    studentContext={selected} onSaved={v => setSelected(prev => ({ ...prev, hostel_type: v }))} />
                  {selected.house && profile.validHouses?.length > 0 && !profile.validHouses.includes(selected.house) && (
                    <div style={{ fontSize: 11.5, color: RED, fontWeight: 700, marginTop: 6 }}>⚠ "{selected.house}" is not a currently configured house in Hostel — it may have been renamed or removed.</div>
                  )}
                  {profile.housemaster && <>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', margin: '10px 0 4px' }}>Housemaster</div>
                    <Row label="Name" value={profile.housemaster.name} />
                    <Row label="Phone" value={profile.housemaster.phone} mono />
                  </>}
                  {profile.houseOccupancy != null && <Row label="Students in this house" value={profile.houseOccupancy} />}
                </div>
              }>
              <Row label="House" value={selected.house || 'Day scholar'} />
              <Row label="Hostel Type" value={selected.hostel_type || '—'} />
              {profile.housemaster && <Row label="Housemaster" value={`${profile.housemaster.name} · ${profile.housemaster.phone || '—'}`} />}
              {profile.houseOccupancy != null && <Row label="Students in this house" value={profile.houseOccupancy} />}
            </Section>

            <Section forceOpen={expandAll} icon="🚩" title="Discipline" accent={profile.discipline.length ? AMBER : GREEN} count={profile.discipline.length} empty={profile.discipline.length === 0 && 'No discipline records.'}
              exportRows={profile.discipline} exportName={`${selected.name}_discipline`}
              moduleLink={onNavigate ? { label: "Hostel", onClick: () => onNavigate("hostel") } : null}
              full={<FullList rows={profile.discipline} emptyText="No discipline records." renderRow={(d, i) => (
                <EditableRow key={i} label={`${fmtDate(d.date)} · ${d.category || 'General'}`} value={d.status}
                  tableKey="discipline_records" rowId={d.id} field="status" studentContext={selected}
                  onSaved={v => setProfile(prev => ({ ...prev, discipline: prev.discipline.map(r => r.id === d.id ? { ...r, status: v } : r) }))} />
              )} />}>
              {profile.discipline.slice(0, 5).map((d, i) => <Row key={i} label={fmtDate(d.date)} value={d.status} />)}
            </Section>

            <Section forceOpen={expandAll} icon="🏥" title="Sickbay" accent={profile.sickbay.some(s => s.status === 'Admitted') ? RED : SLATE[500]} count={profile.sickbay.length} empty={profile.sickbay.length === 0 && 'No sickbay records.'}
              exportRows={profile.sickbay} exportName={`${selected.name}_sickbay`}
              moduleLink={onNavigate ? { label: "Hostel", onClick: () => onNavigate("hostel") } : null}
              full={<FullList rows={profile.sickbay} emptyText="No sickbay records." renderRow={(s, i) => (
                <EditableRow key={i} label={`${fmtDate(s.date)} · ${s.condition || s.reason || '—'}`} value={s.status}
                  tableKey="sickbay_records" rowId={s.id} field="status" studentContext={selected}
                  onSaved={v => setProfile(prev => ({ ...prev, sickbay: prev.sickbay.map(r => r.id === s.id ? { ...r, status: v } : r) }))} />
              )} />}>
              {profile.sickbay.slice(0, 5).map((s, i) => <Row key={i} label={fmtDate(s.date)} value={s.status} />)}
            </Section>

            <Section forceOpen={expandAll} icon="🎫" title="Leave Records" accent={SKY} count={profile.leave.length} empty={profile.leave.length === 0 && 'No leave records.'}
              exportRows={profile.leave} exportName={`${selected.name}_leave`}
              moduleLink={onNavigate ? { label: "Hostel", onClick: () => onNavigate("hostel") } : null}
              full={<FullList rows={profile.leave} emptyText="No leave records." renderRow={(l, i) => (
                <EditableRow key={i} label={`${l.leave_type || 'Leave'} · ${fmtDate(l.from_date)} → ${fmtDate(l.to_date)}`} value={l.status}
                  tableKey="leave_records" rowId={l.id} field="status" studentContext={selected}
                  onSaved={v => setProfile(prev => ({ ...prev, leave: prev.leave.map(r => r.id === l.id ? { ...r, status: v } : r) }))} />
              )} />}>
              {profile.leave.slice(0, 5).map((l, i) => <Row key={i} label={fmtDate(l.from_date)} value={l.status} />)}
            </Section>

            <Section forceOpen={expandAll} icon="🪪" title="Gate Passes" accent={profile.gatePasses.some(g => g.status === 'Issued') ? AMBER : SLATE[500]} count={profile.gatePasses.length} empty={profile.gatePasses.length === 0 && 'No gate passes.'}
              exportRows={profile.gatePasses} exportName={`${selected.name}_gate_passes`}
              moduleLink={onNavigate ? { label: "Reception", onClick: () => onNavigate("reception") } : null}
              full={<FullList rows={profile.gatePasses} emptyText="No gate passes." renderRow={(g, i) => (
                <EditableRow key={i} label={`${fmtDate(g.created_at)} · ${g.reason || '—'}`} value={g.status}
                  tableKey="reception_gatepasses" rowId={g.id} field="status" studentContext={selected}
                  onSaved={v => setProfile(prev => ({ ...prev, gatePasses: prev.gatePasses.map(r => r.id === g.id ? { ...r, status: v } : r) }))} />
              )} />}>
              {profile.gatePasses.slice(0, 5).map((g, i) => <Row key={i} label={fmtDate(g.created_at)} value={g.status} />)}
            </Section>

            <Section forceOpen={expandAll} icon="📞" title="Enquiries & Parent Items" accent={SKY} count={profile.enquiries.length + profile.parentItems.length}
              empty={profile.enquiries.length === 0 && profile.parentItems.length === 0 && 'No enquiries or parent items.'}
              moduleLink={onNavigate ? { label: "Reception", onClick: () => onNavigate("reception") } : null}
              full={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em' }}>Enquiries</div>
                  <FullList rows={profile.enquiries} emptyText="No enquiries." renderRow={(e, i) => (
                    <EditableRow key={i} label={`${fmtDate(e.created_at)} · ${e.subject || e.category || '—'}`} value={e.status}
                      tableKey="reception_enquiries" rowId={e.id} field="status" studentContext={selected}
                      onSaved={v => setProfile(prev => ({ ...prev, enquiries: prev.enquiries.map(r => r.id === e.id ? { ...r, status: v } : r) }))} />
                  )} />
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 4 }}>Parent Items</div>
                  <FullList rows={profile.parentItems} emptyText="No parent items." renderRow={(p, i) => (
                    <EditableRow key={i} label={`${fmtDate(p.created_at)} · ${p.item_type || p.description || '—'}`} value={p.status}
                      tableKey="reception_parent_items" rowId={p.id} field="status" studentContext={selected}
                      onSaved={v => setProfile(prev => ({ ...prev, parentItems: prev.parentItems.map(r => r.id === p.id ? { ...r, status: v } : r) }))} />
                  )} />
                </div>
              }>
              {profile.enquiries.slice(0, 3).map((e, i) => <Row key={'e'+i} label={`Enquiry · ${fmtDate(e.created_at)}`} value={e.status} />)}
              {profile.parentItems.slice(0, 3).map((p, i) => <Row key={'p'+i} label={`Item · ${fmtDate(p.created_at)}`} value={p.status} />)}
            </Section>

            <Section forceOpen={expandAll} icon="⚠️" title="Complaints" accent={profile.complaints.length ? RED : GREEN} count={profile.complaints.length} empty={profile.complaints.length === 0 && 'No complaints on record.'}
              exportRows={profile.complaints} exportName={`${selected.name}_complaints`}
              moduleLink={onNavigate ? { label: "Reception", onClick: () => onNavigate("reception") } : null}
              full={<FullList rows={profile.complaints} emptyText="No complaints." renderRow={(c, i) => (
                <EditableRow key={i} label={`${fmtDate(c.created_at)} · ${c.category || '—'}`} value={c.status}
                  tableKey="reception_complaints" rowId={c.id} field="status" studentContext={selected}
                  onSaved={v => setProfile(prev => ({ ...prev, complaints: prev.complaints.map(r => r.id === c.id ? { ...r, status: v } : r) }))} />
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
// ── Per-student dashboard strip ─────────────────────────────────────────────
// Reads only from `profile`/`dues`/`selected` — everything already fetched
// by select() — so it costs zero extra queries. Answers "what's the current
// situation with THIS student" in one glance: fees, attendance, exams,
// hostel, discipline/sickbay, and open items across reception, without
// opening a single Section card.
// ── Lightweight inline SVG charts ───────────────────────────────────────────
// Deliberately hand-rolled SVG rather than a charting library — no new
// dependency to vet/bundle, and it matches the same hand-styled bar
// pattern already used for Enrollment/House distributions in
// SchoolOverview below. Each chart degrades to a "not enough data" message
// instead of rendering an empty/broken axis.

// Simple bar chart: array of {label, value}, horizontal bars, value shown
// inline. Used for Exam Marks and Fee Payments breakdown.
function BarChart({ data, color = NAVY, maxValue = null, valueFmt = v => v, height = 22 }) {
  if (!data || data.length === 0) return null
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span style={{ color: SLATE[600], fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{d.label}</span>
            <span style={{ color: SLATE[500], fontWeight: 700 }}>{valueFmt(d.value)}</span>
          </div>
          <div style={{ height, background: SLATE[100], borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${max > 0 ? (d.value / max) * 100 : 0}%`, background: d.color || color, borderRadius: 6, transition: 'width .3s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Attendance trend as an SVG line/area chart — sessions in chronological
// order (by session_id) on X, running present-rate % on Y, so a dip or
// recovery over time is visible at a glance instead of only the single
// all-time % number shown elsewhere. Plots a rolling percentage rather
// than raw present/absent dots so short runs of absence don't look like
// noise.
function AttendanceLineChart({ records }) {
  if (!records || records.length < 2) return null
  const sorted = [...records].sort((a, b) => (a.session_id ?? 0) - (b.session_id ?? 0))

  // Running present-rate at each point (cumulative present / cumulative marked).
  let present = 0
  const points = sorted.map((r, i) => {
    if (String(r.status).toLowerCase() === 'present') present++
    return { x: i, pct: Math.round((present / (i + 1)) * 100) }
  })

  const W = 560, H = 130, PAD = 26
  const xScale = i => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const yScale = pct => H - PAD - (pct / 100) * (H - PAD * 2)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(p.pct).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${xScale(points.length - 1).toFixed(1)} ${H - PAD} L ${xScale(0).toFixed(1)} ${H - PAD} Z`

  const finalPct = points[points.length - 1].pct
  const lineColor = finalPct < 75 ? RED : GREEN

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Gridlines at 0/25/50/75/100% */}
      {[0, 25, 50, 75, 100].map(g => (
        <g key={g}>
          <line x1={PAD} x2={W - PAD} y1={yScale(g)} y2={yScale(g)} stroke={SLATE[100]} strokeWidth="1" />
          <text x={2} y={yScale(g) + 3} fontSize="9" fill={SLATE[400]}>{g}%</text>
        </g>
      ))}
      {/* 75% reference line — the usual attendance-health threshold used elsewhere in this file */}
      <line x1={PAD} x2={W - PAD} y1={yScale(75)} y2={yScale(75)} stroke={AMBER} strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
      <path d={areaPath} fill={lineColor} opacity="0.08" />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xScale(points.length - 1)} cy={yScale(finalPct)} r="3.5" fill={lineColor} />
    </svg>
  )
}

function StudentCharts({ profile }) {
  if (!profile) return null

  const examChartData = (profile.exams || [])
    .slice(0, 8)
    .map(m => ({ label: m.subject || '—', value: Number(m.marks_obtained) || 0 }))

  const feeChartData = [
    { label: 'Admission Fee', value: (profile.fees?.admFeeCols || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0), color: NAVY },
    { label: 'Flat Fee', value: (profile.fees?.admFlatFees || []).reduce((s, r) => s + Number(r.amount || 0), 0), color: SKY },
    { label: 'Course Fee', value: (profile.fees?.admCourseFees || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0), color: GOLD },
  ].filter(d => d.value > 0)

  const hasAttendance = (profile.attendance?.records || []).length >= 2
  const hasExams = examChartData.length > 0
  const hasFees = feeChartData.length > 0

  if (!hasAttendance && !hasExams && !hasFees) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
      {hasAttendance && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${SLATE[200]}`, padding: '14px 16px', gridColumn: hasExams || hasFees ? 'span 2' : 'span 1' }}>
          <div style={{ fontSize: 12.5, fontWeight: 750, color: NAVY, marginBottom: 10 }}>📋 Attendance Trend (running %)</div>
          <AttendanceLineChart records={profile.attendance.records} />
        </div>
      )}

      {hasExams && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${SLATE[200]}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 750, color: NAVY, marginBottom: 10 }}>✏️ Marks by Subject{profile.exams.length > 8 ? ' (latest 8)' : ''}</div>
          <BarChart data={examChartData} color={SKY} />
        </div>
      )}

      {hasFees && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${SLATE[200]}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 750, color: NAVY, marginBottom: 10 }}>💰 Fees Paid by Type</div>
          <BarChart data={feeChartData} valueFmt={v => `₹${fmt(v)}`} />
        </div>
      )}
    </div>
  )
}

function DashCard({ icon, label, value, sub, color = NAVY }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${SLATE[200]}`, padding: '11px 13px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: SLATE[500], fontWeight: 700 }}>
        <span style={{ fontSize: 13 }}>{icon}</span><span>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub != null && <div style={{ fontSize: 10.5, color: SLATE[400], marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function StudentDashboardStrip({ profile, dues, selected }) {
  if (!profile) return null

  const attPct = profile.attendance?.pct
  const openDiscipline = (profile.discipline || []).filter(d => (d.status || '').toLowerCase() !== 'resolved' && (d.status || '').toLowerCase() !== 'closed').length
  const inSickbay = (profile.sickbay || []).some(s => s.status === 'Admitted')
  const pendingLeave = (profile.leave || []).filter(l => (l.status || '').toLowerCase() === 'pending').length
  const openGatePass = (profile.gatePasses || []).filter(g => g.status === 'Issued').length
  const openComplaints = (profile.complaints || []).filter(c => (c.status || '').toLowerCase() !== 'resolved' && (c.status || '').toLowerCase() !== 'closed').length
  const totalPaid = profile.fees?.total ?? 0
  const totalDue = dues?.totalDue ?? 0
  const examCount = (profile.exams || []).length
  const lastExam = examCount ? profile.exams[0] : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
      <DashCard icon="🎓" label="Status" value={selected.status || 'Unknown'} sub={selected.course || '—'}
        color={selected.status === 'Active' ? GREEN : selected.status === 'Dropout' ? RED : selected.status === 'Inactive' ? SLATE[600] : AMBER} />

      <DashCard icon="📋" label="Attendance" value={attPct == null ? '—' : `${attPct}%`}
        sub={profile.attendance?.totalMarked ? `${profile.attendance.presentCount}/${profile.attendance.totalMarked} present` : 'No sessions'}
        color={attPct == null ? SLATE[500] : attPct < 75 ? RED : GREEN} />

      <DashCard icon="💰" label="Fees Paid" value={`₹${fmt(totalPaid)}`}
        sub={dues ? (dues.failedSources?.length > 0 ? '⚠ partial data' : totalDue > 0 ? `₹${fmt(totalDue)} due` : 'Up to date') : 'Dues not computed'}
        color={dues ? (totalDue > 0 ? RED : GREEN) : SLATE[500]} />

      <DashCard icon="✏️" label="Exams" value={examCount}
        sub={lastExam ? `${lastExam.subject} · ${lastExam.marks_obtained ?? '—'}` : 'No marks yet'}
        color={SKY} />

      <DashCard icon="🏠" label="Hostel" value={selected.house || 'Day scholar'}
        sub={selected.hostel_type || '—'}
        color={!selected.house ? SLATE[500] : (profile.validHouses?.includes(selected.house) ? GREEN : RED)} />

      <DashCard icon="🚩" label="Discipline" value={openDiscipline}
        sub={`${(profile.discipline || []).length} total`}
        color={openDiscipline > 0 ? AMBER : GREEN} />

      <DashCard icon="🏥" label="Sickbay" value={inSickbay ? 'Admitted' : 'Clear'}
        sub={`${(profile.sickbay || []).length} record(s)`}
        color={inSickbay ? RED : GREEN} />

      <DashCard icon="🎫" label="Leave" value={pendingLeave}
        sub={`${(profile.leave || []).length} total · pending`}
        color={pendingLeave > 0 ? AMBER : SLATE[500]} />

      <DashCard icon="🪪" label="Gate Pass" value={openGatePass > 0 ? 'Out' : 'In'}
        sub={`${(profile.gatePasses || []).length} record(s)`}
        color={openGatePass > 0 ? AMBER : SLATE[500]} />

      <DashCard icon="⚠️" label="Complaints" value={openComplaints}
        sub={`${(profile.complaints || []).length} total`}
        color={openComplaints > 0 ? RED : GREEN} />
    </div>
  )
}

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
// Row-count KPI strip for Global Search — a fast head:true/count:'exact'
// query per registered table (cheap: no rows transferred, just a count),
// plus open mismatches from mismatchLog.js, so admin sees the current
// size/shape of every data source before searching it. Loads once on
// mount; the ↻ button lets admin refresh after data changes elsewhere.
function GlobalSearchDashboard({ onSelectTable }) {
  const [counts, setCounts] = useState(null)
  const [openMismatches, setOpenMismatches] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        TABLE_REGISTRY.map(async t => {
          const { count, error } = await supabase.from(t.key).select('*', { count: 'exact', head: true })
          if (error) { console.error(`count(${t.key}) failed:`, error.message); return { ...t, count: null } }
          return { ...t, count: count ?? 0 }
        })
      )
      setCounts(results)
      const mismatches = await getOpenMismatches(500).catch(e => { console.error('getOpenMismatches failed:', e.message); return [] })
      setOpenMismatches(Array.isArray(mismatches) ? mismatches.length : (mismatches?.length ?? 0))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalRows = counts ? counts.reduce((s, t) => s + (t.count || 0), 0) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: SLATE[600], textTransform: 'uppercase', letterSpacing: '.03em' }}>Data Centre Overview</div>
        <button onClick={load} disabled={loading}
          style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11, fontWeight: 700, color: NAVY, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? '⏳ Loading…' : '↻ Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        <KpiCard icon="🗄️" label="Total Records" value={totalRows == null ? '…' : fmt(totalRows)} color={NAVY} />
        <KpiCard icon="🔴" label="Open Mismatches" value={openMismatches == null ? '…' : fmt(openMismatches)} color={openMismatches > 0 ? RED : GREEN}
          onClick={onSelectTable ? () => onSelectTable('__mismatches__') : null} />
        {counts && counts.map(t => (
          <KpiCard key={t.key} icon={t.icon} label={t.label} value={t.count == null ? '—' : fmt(t.count)} color={SLATE[700]}
            onClick={onSelectTable ? () => onSelectTable(t.key) : null} />
        ))}
      </div>
    </div>
  )
}

function GlobalSearchPanel({ onOpenStudent, onOpenModule, onOpenMismatches }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tableFilter, setTableFilter] = useState('all')
  const [browsing, setBrowsing] = useState(null) // table label being browsed via a KPI click, or null when showing search results
  const inputRef = useRef(null)

  const runSearch = useCallback(async () => {
    if (term.trim().length < 2) return
    setLoading(true)
    setBrowsing(null)
    const hits = await globalSearch(term)
    setResults(hits)
    setTableFilter('all')
    setLoading(false)
  }, [term])

  // KPI card click — either jumps to the Mismatch Dashboard (for the
  // "Open Mismatches" card, which isn't a browsable table), or fetches a
  // preview of that table's own recent rows via browseTable() and shows
  // it in the same results list search uses, pre-filtered to that table.
  // The term box is left empty and focused so the admin can immediately
  // narrow the preview into a real search without an extra click.
  const handleSelectTable = useCallback(async tableKey => {
    if (tableKey === '__mismatches__') { onOpenMismatches?.(); return }
    setLoading(true)
    setTerm('')
    const { table, hits } = await browseTable(tableKey)
    setResults(hits)
    setTableFilter(tableKey)
    setBrowsing(table)
    setLoading(false)
    inputRef.current?.focus()
  }, [onOpenMismatches])

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
      <GlobalSearchDashboard onSelectTable={handleSelectTable} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          value={term} onChange={e => { setTerm(e.target.value); if (browsing) setBrowsing(null) }}
          onKeyDown={e => e.key === 'Enter' && runSearch()}
          placeholder={browsing ? `Type to search within ${browsing.label}, or Search to look everywhere…` : "Search a receipt number, gate pass reason, discipline note, phone number, anything…"}
          style={{ flex: '1 1 320px', minWidth: 220, padding: '10px 14px', borderRadius: 12, border: `1px solid ${browsing ? NAVY : SLATE[200]}`, fontSize: 13.5 }}
        />
        <button onClick={runSearch} disabled={term.trim().length < 2}
          style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: term.trim().length < 2 ? SLATE[300] : NAVY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: term.trim().length < 2 ? 'default' : 'pointer' }}>
          Search
        </button>
      </div>

      {browsing && !loading && (
        <div style={{ fontSize: 12, color: SLATE[500], display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{browsing.icon} Browsing most recent {filtered.length} row(s) in <strong style={{ color: NAVY }}>{browsing.label}</strong> — not a search result.</span>
          <button onClick={() => { setBrowsing(null); setResults(null); setTableFilter('all') }}
            style={{ padding: '2px 9px', borderRadius: 7, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 10.5, fontWeight: 700, color: SLATE[600], cursor: 'pointer' }}>
            ✕ Clear
          </button>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: SLATE[400] }}>⏳ {browsing === null && term ? 'Searching every module…' : 'Loading…'}</div>}

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
              {browsing ? `No rows found in ${browsing.label}.` : `No matches for "${term}".`}
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

// Flags that map to a single editable field on `students` get an inline
// "Fix" control directly in the dashboard row. Flags that require creating
// a record in another module entirely (no_admission_record,
// no_fees_recorded) aren't single-field fixes, so those rows keep only
// the existing "open student profile" link via the name button — and now
// also the "Open full record" button, which opens the same RegistrationCard
// used in Table Browser, so any flag can be worked from there even without
// a quick-fix mapping.
const FLAG_FIX_MAP = {
  invalid_house: { tableKey: 'students', field: 'house', label: 'House' },
  active_no_attendance: { tableKey: 'students', field: 'status', label: 'Status' },
  dropout_has_attendance: { tableKey: 'students', field: 'status', label: 'Status' },
  // These two aren't a single-field edit — they're a students.house value
  // with no matching hostel_allocations row (or vice versa). mode:
  // 'allocation' tells InlineMismatchFix to write both sides: set/clear
  // students.house AND create/remove the hostel_allocations row so the two
  // tables agree, instead of editing one field and leaving the mismatch
  // half-fixed.
  house_no_allocation: { tableKey: 'students', field: 'house', label: 'House', mode: 'allocation' },
  allocation_no_house: { tableKey: 'students', field: 'house', label: 'House', mode: 'allocation' },
}

// Inline fix control for a mismatch row — lets staff correct the
// underlying field without leaving the dashboard, plus an "Open full
// record" button (works for every flag, not just ones in FLAG_FIX_MAP)
// that opens the same RegistrationCard used in Table Browser for deeper
// or multi-field fixes.
//
// mode: 'allocation' (house_no_allocation / allocation_no_house) isn't a
// single-field edit — it's students.house vs hostel_allocations being out
// of sync. Saving here writes both sides: sets/clears students.house via
// editField (so the audit log + admissions cascade still apply) AND
// creates or removes the matching hostel_allocations row directly, so the
// two tables actually agree afterward instead of the mismatch just moving
// from "no allocation" to "house says X, allocation still missing".
function InlineMismatchFix({ row, currentUser, onDone, onOpenForm }) {
  const cfg = FLAG_FIX_MAP[row.flag_key]
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const openFullRecordButton = onOpenForm && (
    <button onClick={() => onOpenForm(row)}
      style={{ marginRight: 6, padding: '5px 10px', borderRadius: 7, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11, fontWeight: 700, color: NAVY, cursor: 'pointer' }}>
      Open full record →
    </button>
  )

  if (!cfg) return openFullRecordButton || null

  const startFix = async () => {
    setLoading(true); setErr(null)
    const { data, error } = await supabase.from(cfg.tableKey).select(`${cfg.field}${cfg.mode === 'allocation' ? ',gcc_no' : ''}`).eq('id', row.student_id).maybeSingle()
    if (error) { setErr(error.message); setLoading(false); return }
    setDraft(data?.[cfg.field] ?? '')
    setLoading(false)
    setOpen(true)
  }

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      if (cfg.mode === 'allocation') {
        // allocateStudent/vacateStudent own the students.house write (and
        // mirror it correctly) — no separate editField call here, since
        // that would be a second, potentially racing write to the same
        // column with no room/allotment-date detail attached.
        if (draft) {
          await allocateStudent(
            { id: row.student_id, name: row.student_name, gcc_no: row.gcc_no },
            { hostelName: draft, roomNumber: 'TBD' }
          )
        } else {
          await vacateStudent(row.student_id)
        }
        broadcastCrossModuleWrite('students', { type: 'update', student_id: row.student_id, field: 'house' })
        broadcastCrossModuleWrite('hostel_allocations', { type: 'update', student_id: row.student_id, field: 'house' })
      } else {
        await editField({
          tableKey: cfg.tableKey, rowId: row.student_id, field: cfg.field,
          oldValue: null, newValue: draft,
          studentContext: { id: row.student_id, name: row.student_name },
        })
        broadcastCrossModuleWrite(cfg.tableKey, { type: 'update', student_id: row.student_id, field: cfg.field })
      }

      await resolveMismatch(row.id, currentUser?.name || currentUser?.username || null)
      setOpen(false)
      onDone?.()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <>
        <button onClick={startFix} disabled={loading}
          style={{ marginRight: 6, padding: '5px 10px', borderRadius: 7, border: `1px solid ${SKY}`, background: '#fff', fontSize: 11, fontWeight: 700, color: SKY, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Loading…' : `✎ Fix ${cfg.label}`}
        </button>
        {openFullRecordButton}
      </>
    )
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 6, flexWrap: 'wrap' }}>
      <FixFieldInput cfg={cfg} draft={draft} setDraft={setDraft} row={row} />
      <button onClick={save} disabled={saving}
        style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: NAVY, color: '#fff', fontSize: 11, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
        {saving ? '…' : 'Save'}
      </button>
      <button onClick={() => setOpen(false)} disabled={saving}
        style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${SLATE[200]}`, background: '#fff', color: SLATE[600], fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        ✕
      </button>
      {err && <span style={{ fontSize: 10.5, color: RED, width: '100%' }}>{err}</span>}
      {openFullRecordButton}
    </div>
  )
}

// Separate so InlineMismatchFix doesn't call getEditableFields with a
// fake/empty row — needs a real sample row's shape to know field type
// (select vs text) under the new all-fields-editable policy. Falls back
// to a plain text input if no field definition can be resolved at all.
function FixFieldInput({ cfg, draft, setDraft, row }) {
  const [fieldDef, setFieldDef] = useState(null)
  useEffect(() => {
    let cancelled = false
    supabase.from(cfg.tableKey).select('*').eq('id', row.student_id).maybeSingle().then(({ data }) => {
      if (!cancelled) setFieldDef(getEditableFields(cfg.tableKey, data)?.[cfg.field] || { type: 'text' })
    })
    return () => { cancelled = true }
  }, [cfg.tableKey, cfg.field, row.student_id])

  if (!fieldDef) return <span style={{ fontSize: 11, color: SLATE[400] }}>Loading&hellip;</span>

  if (fieldDef.type === 'select') {
    return (
      <select value={draft} onChange={e => setDraft(e.target.value)}
        style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${SLATE[200]}`, fontSize: 11 }}>
        <option value="">—</option>
        {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  return (
    <input value={draft} onChange={e => setDraft(e.target.value)}
      style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${SLATE[200]}`, fontSize: 11, width: 100 }} />
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

  // "Open full record" opens the same RegistrationCard Table Browser uses,
  // scoped to this mismatch row's student in the `students` table — the
  // one table every flag traces back to, regardless of flag type. Holds
  // the mismatch row (not just an id) since it already carries
  // student_id/student_name/gcc_no, and RegistrationCard itself fetches
  // the actual students row content.
  const [openRecordRow, setOpenRecordRow] = useState(null)   // full students row, once loaded
  const [openRecordLoading, setOpenRecordLoading] = useState(false)
  const isMobileForm = useIsMobile()

  // ── One-time backfill: hostel_allocations was never written by any
  // module until the sync fix in Hostel.jsx/Students.jsx, so every
  // student with students.house set already produced a house_no_allocation
  // mismatch. students.house is the real, actively-maintained data (the
  // Houses tab in Hostel.jsx has always read from it) — hostel_allocations
  // was simply never populated, not a second independent data source that
  // disagrees with it. This backfill makes hostel_allocations catch up to
  // what students.house already says, once, so existing mismatches clear
  // without touching the actual house assignments.
  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillResult, setBackfillResult] = useState(null)   // { synced, total, errors }
  const [backfillConfirming, setBackfillConfirming] = useState(false)

  // One-time cleanup for the Dayscholar-phantom-row bug: an earlier
  // version of the backfill (before hostelAllocation.js excluded
  // non-boarding houses) created hostel_allocations rows for Dayscholar
  // students too, which corrupted the boarders/day-scholars count on
  // School Overview. Safe to run more than once (no-ops once clean).
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState(null)   // { removed }

  const houseNoAllocationCount = useMemo(
    () => rows.filter(r => r.flag_key === 'house_no_allocation').length,
    [rows]
  )

  const runBackfill = async () => {
    setBackfillRunning(true)
    setBackfillResult(null)
    try {
      const students = await getActiveStudents('id,name,gcc_no,class_name,house')
      const result = await backfillMissingAllocations(students)
      setBackfillResult({ synced: result.synced, total: result.total, errors: [] })
      // Re-resolve any mismatches that are now fixed — same bookkeeping
      // path the auto-scanner uses, just triggered immediately instead of
      // waiting for the next hourly scan.
      const withHouse = students.filter(s => s.house)
      await Promise.all(withHouse.map(s => resolveStaleFlags(s.id, [])))
      await refresh()
    } catch (e) {
      setBackfillResult({ synced: 0, total: 0, errors: [e.message || 'Backfill failed'] })
    } finally {
      setBackfillRunning(false)
      setBackfillConfirming(false)
    }
  }

  const runCleanup = async () => {
    setCleanupRunning(true)
    setCleanupResult(null)
    try {
      const result = await cleanupNonBoardingAllocations()
      setCleanupResult({ removed: result.removed })
      await refresh()
    } catch (e) {
      setCleanupResult({ removed: 0, error: e.message || 'Cleanup failed' })
    } finally {
      setCleanupRunning(false)
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getOpenMismatches(500)
    setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useCrossModuleUpdatedListener(useCallback(() => { refresh() }, [refresh]))

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

  // Fetches the full students row for a mismatch row's student_id and
  // opens RegistrationCard for it — same component Table Browser uses, so
  // any flag (even ones with no quick-fix mapping) can be worked from a
  // full editable form instead of just the message text.
  const openFullRecord = async (mismatchRow) => {
    setOpenRecordLoading(true)
    const { data, error } = await supabase.from('students').select('*').eq('id', mismatchRow.student_id).maybeSingle()
    setOpenRecordLoading(false)
    if (error || !data) {
      console.error('MismatchDashboard: failed to load student for full record:', error?.message)
      return
    }
    setOpenRecordRow(data)
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
        {houseNoAllocationCount > 0 && (
          <button onClick={() => setBackfillConfirming(true)} disabled={backfillRunning}
            style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: backfillRunning ? SLATE[300] : SKY, fontSize: 12.5, fontWeight: 700, color: '#fff', cursor: backfillRunning ? 'default' : 'pointer' }}>
            {backfillRunning ? 'Backfilling…' : `⚡ Backfill house allocations (${houseNoAllocationCount})`}
          </button>
        )}
      </div>

      {backfillConfirming && (
        <div style={{ padding: '12px 14px', background: '#eff6ff', border: `1px solid ${SKY}`, borderRadius: 12, fontSize: 12.5, color: '#1e3a5f' }}>
          <div style={{ marginBottom: 8 }}>
            This copies every active student's current <strong>house</strong> value into <strong>hostel_allocations</strong> (one row per student, matched by student_id). It does not change any student's house — it only makes hostel_allocations catch up to what students.house already says, which should clear most or all of the {houseNoAllocationCount} "no matching hostel allocation" mismatches. Safe to run more than once.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={runBackfill} disabled={backfillRunning}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: SKY, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: backfillRunning ? 'default' : 'pointer' }}>
              {backfillRunning ? 'Running…' : 'Yes, backfill now'}
            </button>
            <button onClick={() => setBackfillConfirming(false)} disabled={backfillRunning}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, background: '#fff', color: SLATE[600], fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {backfillResult && (
        <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 12.5, background: backfillResult.errors.length ? '#fef2f2' : '#f0fdf4', color: backfillResult.errors.length ? '#991b1b' : '#166534' }}>
          Synced {backfillResult.synced} of {backfillResult.total} student{backfillResult.total === 1 ? '' : 's'} to hostel_allocations.
          {backfillResult.errors.length > 0 && <span> {backfillResult.errors.length} error(s): {backfillResult.errors.join('; ')}</span>}
        </div>
      )}

      {/* One-time cleanup: an earlier backfill run created hostel_allocations
          rows for Dayscholar students too, which corrupted the School
          Overview boarders/day-scholars count. This removes those phantom
          rows without touching any actual boarding-house allocations. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={runCleanup} disabled={cleanupRunning}
          style={{ padding: '7px 12px', borderRadius: 9, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11.5, fontWeight: 700, color: cleanupRunning ? SLATE[400] : AMBER, cursor: cleanupRunning ? 'default' : 'pointer' }}>
          {cleanupRunning ? 'Cleaning up…' : '🧹 Remove Dayscholar allocation rows'}
        </button>
        {cleanupResult && (
          <span style={{ fontSize: 11.5, color: cleanupResult.error ? RED : SLATE[500] }}>
            {cleanupResult.error ? `Failed: ${cleanupResult.error}` : `Removed ${cleanupResult.removed} phantom row${cleanupResult.removed === 1 ? '' : 's'}.`}
          </span>
        )}
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
                      <InlineMismatchFix row={r} currentUser={currentUser} onDone={refresh} onOpenForm={openFullRecord} />
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

      {openRecordLoading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.15)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
          Loading record&hellip;
        </div>
      )}

      {openRecordRow && (
        <RegistrationCard
          row={openRecordRow}
          tableKey="students"
          tableLabel="Students"
          isMobile={isMobileForm}
          studentContext={{ id: openRecordRow.id, name: openRecordRow.name, gcc_no: openRecordRow.gcc_no }}
          onClose={() => setOpenRecordRow(null)}
          onSaved={(field, value) => {
            setOpenRecordRow(prev => prev ? { ...prev, [field]: value } : prev)
            broadcastCrossModuleWrite('students', { type: 'update', student_id: openRecordRow.id, field })
            refresh()
          }}
        />
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
      // en-CA gives local-timezone YYYY-MM-DD, matching every other date
      // computation in the codebase (feeEngine.js's payDate, Fees.jsx's
      // todayStr). toISOString().slice(0,10) — the previous version here —
      // converts to UTC first, which under IST (UTC+5:30) shifted this a
      // day early for the first ~5.5 hours of every day. That made the
      // cutoff MORE permissive, not less, so it wasn't the sole cause of
      // an entire month reading ₹0, but it was still wrong and is fixed
      // here regardless.
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA')

      const [attSessions, houses, hostelAllocs, admFeesData, flatFeesData, courseFeesData] = await Promise.all([
        // Last 30 days of attendance sessions, for a school-wide rate —
        // capped range so this stays a quick dashboard query, not a
        // full-year scan.
        supabase.from('attendance_sessions').select('id,session_date').gte('session_date', new Date(now.getTime() - 30 * 86400000).toLocaleDateString('en-CA')),
        supabase.from('houses').select('name').order('name'),
        idList.length ? supabase.from('hostel_allocations').select('student_id,hostel_name').in('student_id', idList) : Promise.resolve({ data: [] }),
        // Paginated — see fetchAllRows comment above. adm_course_fees alone
        // has 1500+ rows, well past the unbounded-query 1000-row cap.
        fetchAllRows('adm_fee_collections', { select: 'amount_paid,pay_date,adm_app_id', filters: [['reverted', 'eq', false]] }),
        fetchAllRows('adm_flat_fees', { select: 'amount,pay_date,adm_app_id,month,year', filters: [['paid', 'eq', true], ['reverted', 'eq', false]] }),
        fetchAllRows('adm_course_fees', { select: 'amount_paid,pay_date,adm_app_id,for_month,year', filters: [['reverted', 'eq', false]] }),
      ])
      const admFees = { data: admFeesData }
      const flatFees = { data: flatFeesData }
      const courseFees = { data: courseFeesData }

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
      // "This month" matches Fees.jsx's own FeeDashboardTab convention
      // (thisMonthFlat/thisMonthCrsf/thisMonthAdm), not a simple pay_date
      // filter: flat and course fees are counted by the fee PERIOD they're
      // for (month/for_month + year), not the calendar date they were
      // paid on. A parent can pay August's flat fee in May (an advance);
      // Fees.jsx counts that toward August, so this must too, or the two
      // dashboards disagree on the same number — which is exactly what
      // produced the ₹0 here while Fees.jsx showed real August revenue.
      // Admission fees have no period-month field at all (a one-time fee,
      // not tied to a specific month), so those stay pay_date-based,
      // matching Fees.jsx's own thisMonthAdm.
      const thisMonthName = now.toLocaleString('default', { month: 'long' })
      const thisYearStr = String(now.getFullYear())

      const sumBy = (rows, field) => (rows || []).reduce((s, r) => s + Number(r[field] || 0), 0)

      const totalCollected = sumBy(admFees.data, 'amount_paid') + sumBy(flatFees.data, 'amount') + sumBy(courseFees.data, 'amount_paid')
      const thisMonthAdm = sumBy((admFees.data || []).filter(r => r.pay_date && r.pay_date >= monthStart), 'amount_paid')
      const thisMonthFlat = sumBy((flatFees.data || []).filter(r => r.month === thisMonthName && String(r.year) === thisYearStr), 'amount')
      const thisMonthCrsf = sumBy((courseFees.data || []).filter(r => r.for_month === thisMonthName && String(r.year) === thisYearStr), 'amount_paid')
      const thisMonthCollected = thisMonthAdm + thisMonthFlat + thisMonthCrsf

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
      // NON_BOARDING_HOUSES excluded defensively — hostel_allocations
      // should never contain a row for a Dayscholar student (see
      // hostelAllocation.js), but this stat shouldn't silently trust
      // row count alone if that ever slips, since it's exactly what
      // produced the "383 boarders / 0 day scholars" bug.
      const NON_BOARDING_HOUSES = ['Dayscholar']
      const allocByHouse = {}
      const allocatedStudentIds = new Set()
      ;(hostelAllocs.data || []).forEach(a => {
        if (NON_BOARDING_HOUSES.includes(a.hostel_name)) return
        const h = a.hostel_name || 'Unassigned'
        allocByHouse[h] = (allocByHouse[h] || 0) + 1
        allocatedStudentIds.add(a.student_id)
      })
      const boarders = allocatedStudentIds.size
      const dayScholars = students.length - boarders
      // house -> array of student objects, built from the ACTUAL allocation
      // rows (hostel_allocations.hostel_name), not student.house — those two
      // can disagree (that disagreement is literally one of the mismatch
      // flags in mismatchDetector.js), so the drill-down here must match
      // what allocByHouse counted, not a different field.
      const studentsById = {}
      students.forEach(s => { studentsById[s.id] = s })
      const allocStudentsByHouse = {}
      ;(hostelAllocs.data || []).forEach(a => {
        if (NON_BOARDING_HOUSES.includes(a.hostel_name)) return
        const h = a.hostel_name || 'Unassigned'
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

function KpiCard({ icon, label, value, color, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', borderRadius: 14, border: `1px solid ${hover ? NAVY : SLATE[200]}`, padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: hover ? '0 4px 14px rgba(11,30,61,.10)' : 'none',
        transition: 'box-shadow .15s ease, border-color .15s ease',
      }}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: SLATE[500], marginTop: 2 }}>{label}</div>
      {onClick && <div style={{ fontSize: 9.5, color: NAVY, marginTop: 4, fontWeight: 700, opacity: hover ? 1 : 0, transition: 'opacity .15s ease' }}>Browse →</div>}
    </div>
  )
}