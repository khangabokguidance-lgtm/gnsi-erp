// ══════════════════════════════════════════════════════════════
//  ENHANCED: Housemaster Activities + Admin Monitor Dashboard
//  Drop-in replacement for HousemasterActivitiesTab
//  Also exports: AdminMonitorTab (add to TABS as 'adminmonitor')
// ══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { isAdminRole } from './App'

// ─── Shared style tokens (kept consistent with parent file) ───
const inp = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '14px',
  boxSizing: 'border-box', backgroundColor: 'white',
}
const lbl = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#374151', marginBottom: '6px',
}
const btn = (bg = '#1e3a5f', c = 'white') => ({
  backgroundColor: bg, color: c, border: 'none', borderRadius: '8px',
  padding: '10px 20px', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
})

function StatCard({ icon, label, value, color, bg, sub }) {
  return (
    <div style={{
      backgroundColor: bg, borderRadius: '12px', padding: '18px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>
      <p style={{ fontSize: '13px', color, fontWeight: '600', margin: 0 }}>{label}</p>
      <h2 style={{ fontSize: '28px', fontWeight: 'bold', color, margin: '4px 0 0' }}>{value}</h2>
      {sub && <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

function StaffSearchInput({ staff, onSelect, placeholder = 'Search staff...' }) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return staff.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.designation || '').toLowerCase().includes(q)
    ).slice(0, 8)
  }, [query, staff])
  const select = s => { onSelect(s); setQuery('') }
  return (
    <div style={{ position: 'relative' }}>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} style={inp} />
      {matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
          {matches.map(s => (
            <div key={s.id} onClick={() => select(s)}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}>
              <strong>{s.name}</strong>
              <span style={{ color: '#64748b', marginLeft: 8 }}>{s.designation || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  DAILY TASK DEFINITIONS — with Doubt Session integration
// ══════════════════════════════════════════════════════════════

// These map to the DEFAULT_WEEKDAY schedule slots from ScheduleTab
const DAILY_TASKS = [
  // Morning Block
  { id: 'wake_roll',    time: '5:30 AM',  label: 'Wake-Up Bell & Morning Roll Call',        icon: '🔔', block: 'morning',   mandatory: true,  linkedSchedule: 'Wake Up Bell & Morning PT' },
  { id: 'pt_supervise', time: '6:00 AM',  label: 'PT / Exercise Supervision',                icon: '🏃', block: 'morning',   mandatory: true,  linkedSchedule: 'PT / Exercise / Sports' },
  { id: 'bath_check',   time: '6:45 AM',  label: 'Bath & Morning Routine Check',             icon: '🚿', block: 'morning',   mandatory: false, linkedSchedule: 'Bath & Morning Routine' },
  { id: 'assembly',     time: '7:30 AM',  label: 'Morning Assembly & House Roll Call',       icon: '🎌', block: 'morning',   mandatory: true,  linkedSchedule: 'Morning Assembly & Roll Call' },
  { id: 'breakfast',    time: '8:00 AM',  label: 'Breakfast Supervision',                    icon: '🍳', block: 'morning',   mandatory: true,  linkedSchedule: 'Breakfast' },
  // Academic Block
  { id: 'class_check',  time: '9:00 AM',  label: 'Academic Class Attendance Verification',  icon: '🏫', block: 'academic',  mandatory: true,  linkedSchedule: 'Academic Classes' },
  // Afternoon
  { id: 'lunch',        time: '1:00 PM',  label: 'Lunch Supervision & Headcount',            icon: '🍽️', block: 'afternoon', mandatory: true,  linkedSchedule: 'Lunch Break' },
  { id: 'afternoon_cls',time: '2:00 PM',  label: 'Afternoon Class Check',                    icon: '📚', block: 'afternoon', mandatory: false, linkedSchedule: 'Academic Classes' },
  // Evening
  { id: 'tea',          time: '5:00 PM',  label: 'Tea Break Supervision',                    icon: '☕', block: 'evening',   mandatory: false, linkedSchedule: 'Tea Break' },
  { id: 'recreation',   time: '5:30 PM',  label: 'Recreation / Sports Supervision',          icon: '⚽', block: 'evening',   mandatory: false, linkedSchedule: 'Recreation / Sports' },
  { id: 'dinner',       time: '7:00 PM',  label: 'Dinner Supervision & Headcount',           icon: '🍽️', block: 'evening',   mandatory: true,  linkedSchedule: 'Dinner' },
  // Night Block — Doubt Session is KEY here
  { id: 'doubt_session',time: '8:00 PM',  label: 'Doubt Session / Study Hall Supervision',  icon: '📖', block: 'night',     mandatory: true,  linkedSchedule: 'Doubt Class / Assignment', isDoubtSession: true },
  { id: 'night_roll',   time: '10:00 PM', label: 'Night Roll Call & Room Check',             icon: '🌙', block: 'night',     mandatory: true,  linkedSchedule: 'Lights Out' },
  { id: 'lights_out',   time: '10:00 PM', label: 'Lights Out Confirmation',                  icon: '💡', block: 'night',     mandatory: true,  linkedSchedule: 'Lights Out' },
  // Admin
  { id: 'logbook',      time: 'Daily',    label: 'House Logbook / Diary Entry',              icon: '📓', block: 'admin',     mandatory: true,  linkedSchedule: null },
  { id: 'welfare_check',time: 'Daily',    label: 'Student Welfare Spot Check',               icon: '💬', block: 'admin',     mandatory: false, linkedSchedule: null },
]

const BLOCK_CONFIG = {
  morning:   { label: 'Morning Block',  color: '#f59e0b', bg: '#fffbeb', icon: '🌅' },
  academic:  { label: 'Academic Block', color: '#1d4ed8', bg: '#dbeafe', icon: '🏫' },
  afternoon: { label: 'Afternoon',      color: '#0891b2', bg: '#e0f2fe', icon: '☀️' },
  evening:   { label: 'Evening Block',  color: '#7c3aed', bg: '#f5f3ff', icon: '🌆' },
  night:     { label: 'Night Block',    color: '#1e3a5f', bg: '#eff6ff', icon: '🌙' },
  admin:     { label: 'Administration', color: '#374151', bg: '#f9fafb', icon: '📋' },
}

// ══════════════════════════════════════════════════════════════
//  DOUBT SESSION PANEL — pulled from timetable data
// ══════════════════════════════════════════════════════════════

function DoubtSessionPanel({ houses }) {
  const todayKey = new Date().toISOString().split('T')[0]

  // Load doubt session logs from DB
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [form, setForm] = useState({ house: '', subject: '', teacher: '', students_present: '', absentees: '', notes: '', date: todayKey })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // The timetable slot for doubt class (from DEFAULT_WEEKDAY)
  const timetableSlot = { from: '8:00 PM', to: '10:00 PM', activity: 'Doubt Class / Assignment' }

  const load = async () => {
    setLoadingLogs(true)
    const { data } = await supabase.from('doubt_session_logs').select('*').order('date', { ascending: false }).limit(50)
    setLogs(data || [])
    setLoadingLogs(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('doubt_session_logs').insert([{
      ...form,
      students_present: Number(form.students_present) || 0,
    }])
    if (error) alert('Error: ' + error.message)
    else { setForm({ house: '', subject: '', teacher: '', students_present: '', absentees: '', notes: '', date: todayKey }); setShowForm(false); load() }
    setSaving(false)
  }

  const todayLogs = logs.filter(l => l.date === todayKey)
  const housesLogged = new Set(todayLogs.map(l => l.house))
  const housesNotLogged = houses.filter(h => !housesLogged.has(h.name))

  return (
    <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 24 }}>
      {/* Header — links to timetable */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>📖 Doubt Session Tracker</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
            🕐 Timetable Slot: <strong style={{ color: '#fbbf24' }}>{timetableSlot.from} – {timetableSlot.to}</strong> · {timetableSlot.activity}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'white', fontWeight: 600 }}>
            {todayLogs.length} / {houses.length} houses logged today
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{ ...btn('#fbbf24', '#1e3a5f'), fontSize: 12, padding: '8px 14px' }}>
            {showForm ? '✖ Cancel' : '➕ Log Session'}
          </button>
        </div>
      </div>

      {/* Today's house status strip */}
      {houses.length > 0 && (
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {houses.map(h => {
            const logged = housesLogged.has(h.name)
            return (
              <span key={h.id} style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: logged ? '#dcfce7' : '#fee2e2',
                color: logged ? '#16a34a' : '#dc2626',
                border: `1px solid ${logged ? '#86efac' : '#fca5a5'}`,
              }}>
                {logged ? '✓' : '⚠'} {h.name}
              </span>
            )
          })}
        </div>
      )}

      {/* Log form */}
      {showForm && (
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
            📝 Log Doubt Session — {timetableSlot.from} to {timetableSlot.to}
          </div>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} />
              </div>
              <div>
                <label style={lbl}>House *</label>
                <select value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} required style={inp}>
                  <option value="">— Select House —</option>
                  {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Subject</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" style={inp} />
              </div>
              <div>
                <label style={lbl}>Teacher / Supervisor</label>
                <input value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} placeholder="Name" style={inp} />
              </div>
              <div>
                <label style={lbl}>Students Present</label>
                <input type="number" min={0} value={form.students_present} onChange={e => setForm(f => ({ ...f, students_present: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Absentees (names/count)</label>
                <input value={form.absentees} onChange={e => setForm(f => ({ ...f, absentees: e.target.value }))} placeholder="e.g. 2 — John, Mary" style={inp} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Notes / Observations</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Noisy group, good participation..." style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳...' : '✅ Save Log'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Recent logs table */}
      {loadingLogs
        ? <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading...</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['Date', 'House', 'Subject', 'Teacher', 'Present', 'Absentees', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = r.date === todayKey ? '#fffbeb' : 'white'}>
                    <td style={{ padding: '10px 14px', color: r.date === todayKey ? '#92400e' : '#64748b', fontWeight: r.date === todayKey ? 700 : 400, fontSize: 12 }}>
                      {r.date === todayKey ? '📅 Today' : r.date}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#7c3aed' }}>{r.house || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{r.subject || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.teacher || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#16a34a' }}>{r.students_present ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: r.absentees ? '#dc2626' : '#94a3b8' }}>{r.absentees || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || '—'}</div>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No doubt session logs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  DAILY TASK CHECKLIST — for housemaster
// ══════════════════════════════════════════════════════════════
//  Each checkbox toggle now writes LIVE to Supabase (table:
//  hm_daily_task_checks) in addition to a localStorage cache. Admin's
//  AdminMonitorTab can therefore see in-progress completion for any
//  house today, instead of only seeing something once a housemaster
//  clicks "Submit Day Report" at the end of the day. localStorage is
//  kept purely as an instant-paint cache so the UI doesn't flash empty
//  while the Supabase fetch is in flight — it is never the source of
//  truth once the network call resolves.
//
//  REQUIRED SQL (run once in Supabase):
//    create table if not exists hm_daily_task_checks (
//      id bigserial primary key,
//      housemaster_id text not null,
//      housemaster_name text,
//      house text,
//      date date not null,
//      task_id text not null,
//      checked boolean not null default true,
//      updated_at timestamptz default now(),
//      unique (housemaster_id, date, task_id)
//    );
//    alter table hm_daily_task_checks disable row level security;
// ══════════════════════════════════════════════════════════════

const todayKey = () => new Date().toISOString().split('T')[0]
const loadDailyChecks = hmId => {
  try { return JSON.parse(localStorage.getItem(`hm_daily_${hmId}_${todayKey()}`) || '{}') } catch { return {} }
}
const saveDailyChecksCache = (hmId, obj) => localStorage.setItem(`hm_daily_${hmId}_${todayKey()}`, JSON.stringify(obj))

// ─── House Students — lets a housemaster pick their house (or an admin
// pick any house) and see/select the students assigned to it ───────────
// Follows the same "select who you are" pattern as DailyTaskChecklist
// (a housemaster picker, not an auto-detected identity) since that's the
// existing convention in this file rather than assuming currentUser maps
// cleanly onto the housemasters table.
function HouseStudentsPanel({ houses, isAdmin, currentUser }) {
  const [housemasters, setHousemasters] = useState([])
  const [selectedHM, setSelectedHM] = useState(null)
  const [selectedHouse, setSelectedHouse] = useState('')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => {
    supabase
      .from('housemasters')
      .select('*')
      .eq('status', 'Active')
      .order('name')
      .then(({ data }) => {
        setHousemasters(data || [])
        // Non-admin housemaster: auto-select themselves by matching on
        // name against the housemasters table (no direct FK to currentUser
        // is assumed, matching the lookup style already used elsewhere in
        // this file) so their own house pre-fills without needing the
        // admin-only picker dropdown at all.
        if (!isAdmin && currentUser?.name) {
          const self = (data || []).find(h => h.name === currentUser.name)
          if (self) setSelectedHM(self)
        }
      })
  }, [isAdmin, currentUser?.name])

  // Picking a housemaster defaults the house dropdown to their assigned
  // house, same convention as DailyTaskChecklist — but the house dropdown
  // itself stays independently editable, since a housemaster can cover
  // more than one house, or an admin may want to browse any house without
  // picking a specific housemaster at all.
  useEffect(() => {
    if (selectedHM?.house) setSelectedHouse(selectedHM.house)
  }, [selectedHM])

  const effectiveHouse = selectedHouse

  useEffect(() => {
    if (!effectiveHouse) { setStudents([]); return }
    setLoading(true)
    setSelectedIds(new Set())
    supabase
      .from('students')
      .select('id, name, house, hostel_type, class_name, roll_number')
      .eq('house', effectiveHouse)
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('HouseStudentsPanel students fetch error:', error)
        setStudents(data || [])
        setLoading(false)
      })
  }, [effectiveHouse])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.roll_number || '').toString().toLowerCase().includes(q) ||
      (s.class_name || '').toLowerCase().includes(q)
    )
  }, [students, search])

  const toggleStudent = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleSelectAll = () => setSelectedIds(prev =>
    prev.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id))
  )

  return (
    <div>
      {!isAdmin && selectedHM && (
        <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#1e3a5f', fontWeight: 600 }}>
          👤 Signed in as {selectedHM.name} — house pre-filled below. You can still switch to a different house if you cover more than one.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
        {isAdmin && (
          <div>
            <label style={lbl}>Housemaster (optional — sets house below)</label>
            <select value={selectedHM?.id || ''} onChange={e => setSelectedHM(housemasters.find(h => String(h.id) === e.target.value) || null)} style={inp}>
              <option value="">— Select Housemaster —</option>
              {housemasters.map(h => <option key={h.id} value={h.id}>{h.name} · {h.house || '—'}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={lbl}>House</label>
          <select value={selectedHouse} onChange={e => setSelectedHouse(e.target.value)} style={inp}>
            <option value="">— Select House —</option>
            {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
          </select>
        </div>
      </div>

      {!effectiveHouse ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>Select a house to see its students.</p>
      ) : loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>
              🏠 {effectiveHouse} — {filtered.length} student{filtered.length === 1 ? '' : 's'}
              {selectedIds.size > 0 && <span style={{ color: '#7c3aed', marginLeft: 8 }}>({selectedIds.size} selected)</span>}
            </div>
            <input placeholder="🔍 Search name, roll no, class..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 220 }} />
          </div>

          {filtered.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>No students found for this house.</p>
          ) : (
            <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleSelectAll} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>Select all</span>
              </div>
              {filtered.map(s => (
                <div key={s.id} onClick={() => toggleStudent(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                  borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                  background: selectedIds.has(s.id) ? '#eff6ff' : 'white',
                }}>
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleStudent(s.id)} onClick={e => e.stopPropagation()} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {s.class_name || '—'}{s.roll_number ? ` · Roll ${s.roll_number}` : ''}{s.hostel_type ? ` · ${s.hostel_type}` : ''}
                    </div>
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

function DailyTaskChecklist({ staffProfiles, houses }) {
  const [housemasters, setHousemasters] = useState([])
  const [selectedHM, setSelectedHM] = useState(null)
  const [selectedHouse, setSelectedHouse] = useState('')
  const [checks, setChecks] = useState({})
  const [noteFor, setNoteFor] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState({})
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false) // true while a checkbox toggle is being written to Supabase

  useEffect(() => {
    supabase
      .from('housemasters')
      .select('*')
      .eq('status', 'Active')
      .order('name')
      .then(({ data }) => setHousemasters(data || []))
  }, [])

  // Load checks when HM selected — paint instantly from the localStorage
  // cache, then reconcile against Supabase (the real source of truth,
  // since it's shared across devices/sessions and read by admin).
  useEffect(() => {
    if (!selectedHM) return
    setChecks(loadDailyChecks(selectedHM.id)) // instant paint from cache
    supabase
      .from('hm_daily_task_checks')
      .select('task_id, checked')
      .eq('housemaster_id', selectedHM.id)
      .eq('date', todayKey())
      .then(({ data, error }) => {
        if (error) { console.error('hm_daily_task_checks fetch error (has the table been created?):', error); return }
        const fromDb = {}
        ;(data || []).forEach(row => { fromDb[row.task_id] = row.checked })
        setChecks(fromDb)
        saveDailyChecksCache(selectedHM.id, fromDb)
      })
  }, [selectedHM])

  const toggle = async taskId => {
    const nextVal = !checks[taskId]
    const next = { ...checks, [taskId]: nextVal }
    setChecks(next) // optimistic UI update
    if (selectedHM) saveDailyChecksCache(selectedHM.id, next)
    if (!selectedHM) return
    setSyncing(true)
    const { error } = await supabase.from('hm_daily_task_checks').upsert([{
      housemaster_id: selectedHM.id,
      housemaster_name: selectedHM.name,
      house: selectedHouse || selectedHM.house || null,
      date: todayKey(),
      task_id: taskId,
      checked: nextVal,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'housemaster_id,date,task_id' })
    setSyncing(false)
    if (error) {
      console.error('Failed to sync checklist tick to Supabase:', error)
      // Roll back the optimistic tick so the housemaster isn't shown a
      // false "done" state that admin can never actually see.
      setChecks(checks)
      if (selectedHM) saveDailyChecksCache(selectedHM.id, checks)
      alert('Could not save this tick — check your connection and try again.')
    }
  }

  const saveNote = taskId => {
    setNotes(n => ({ ...n, [taskId]: noteText }))
    setNoteFor(null)
    setNoteText('')
  }

  // Group tasks by block
  const tasksByBlock = useMemo(() => {
    const groups = {}
    DAILY_TASKS.forEach(t => {
      if (!groups[t.block]) groups[t.block] = []
      groups[t.block].push(t)
    })
    return groups
  }, [])

  const totalTasks = DAILY_TASKS.length
  const mandatoryTasks = DAILY_TASKS.filter(t => t.mandatory)
  const completedTotal = DAILY_TASKS.filter(t => checks[t.id]).length
  const completedMandatory = mandatoryTasks.filter(t => checks[t.id]).length
  const pct = Math.round(completedTotal / totalTasks * 100)
  const mandatoryPct = Math.round(completedMandatory / mandatoryTasks.length * 100)

  const submitDayReport = async () => {
    if (!selectedHM) return
    setSaving(true)
    const payload = {
      date: todayKey(),
      housemaster_id: null,
      housemaster_name: selectedHM.name,
      house: selectedHouse,
      activity_type: 'Daily Task Summary Report',
      category: 'Daily Supervision',
      freq: 'Daily',
      description: `Completed ${completedTotal}/${totalTasks} tasks (${pct}%). Mandatory: ${completedMandatory}/${mandatoryTasks.length}. Tasks: ${DAILY_TASKS.filter(t => checks[t.id]).map(t => t.label).join('; ')}`,
      outcome: pct === 100 ? 'All tasks completed' : `${totalTasks - completedTotal} tasks pending`,
      status: pct === 100 ? 'Completed' : 'Pending',
    }
    const { error } = await supabase.from('housemaster_activities').insert([payload])
    if (error) alert('Error: ' + error.message)
    else alert(`✅ Day report submitted for ${selectedHM.name}!`)
    setSaving(false)
  }

  return (
    <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 24 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f2744 0%, #1e3a5f 100%)', padding: '16px 20px' }}>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>✅ Daily Housemaster Task Checklist</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Track all daily duties — resets every midnight</div>
      </div>

      {/* HM Selector */}
      <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label style={lbl}>Select Housemaster</label>
          <select
            value={selectedHM?.id || ''}
            onChange={e => {
              const hm = housemasters.find(s => s.id === e.target.value)
              setSelectedHM(hm || null)
            }}
            style={inp}
          >
            <option value="">— Choose housemaster —</option>
            {housemasters.map(s => (
  <option key={s.id} value={s.id}>{s.name} · {s.designation || s.house || '—'}</option>
))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={lbl}>House</label>
          <select value={selectedHouse} onChange={e => setSelectedHouse(e.target.value)} style={inp}>
            <option value="">— Select House —</option>
            {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
          </select>
        </div>
        {selectedHM && (
          <button onClick={submitDayReport} disabled={saving} style={{ ...btn('#16a34a'), fontSize: 12, padding: '10px 16px', whiteSpace: 'nowrap' }}>
            {saving ? '⏳...' : '📤 Submit Day Report'}
          </button>
        )}
      </div>

      {!selectedHM ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍🏫</div>
          <div>Select a housemaster to begin daily checklist</div>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div style={{ padding: '14px 20px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                Progress — {selectedHM.name} {selectedHouse ? `· ${selectedHouse}` : ''}
                {syncing && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>saving…</span>}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: pct === 100 ? '#16a34a' : '#0369a1', fontWeight: 700 }}>
                {completedTotal}/{totalTasks} total · {completedMandatory}/{mandatoryTasks.length} mandatory
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Overall {pct}%</div>
                <div style={{ height: 8, background: '#e0f2fe', borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#16a34a' : '#0ea5e9', borderRadius: 20, transition: 'width .4s' }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Mandatory {mandatoryPct}%</div>
                <div style={{ height: 8, background: '#fde68a', borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${mandatoryPct}%`, background: mandatoryPct === 100 ? '#16a34a' : '#f59e0b', borderRadius: 20, transition: 'width .4s' }} />
                </div>
              </div>
            </div>
            {pct === 100 && <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>🎉 All tasks done for today!</div>}
          </div>

          {/* Task blocks */}
          <div style={{ padding: '16px 20px' }}>
            {Object.entries(tasksByBlock).map(([blockId, tasks]) => {
              const blk = BLOCK_CONFIG[blockId]
              const blockDone = tasks.filter(t => checks[t.id]).length
              return (
                <div key={blockId} style={{ marginBottom: 16 }}>
                  {/* Block header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: blk.bg, borderRadius: 8, borderLeft: `3px solid ${blk.color}` }}>
                    <span style={{ fontSize: 16 }}>{blk.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: blk.color }}>{blk.label}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{blockDone}/{tasks.length} done</span>
                  </div>
                  {/* Tasks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {tasks.map(task => {
                      const isDone = !!checks[task.id]
                      const hasNote = !!notes[task.id]
                      return (
                        <div key={task.id}>
                          <div
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 14px', borderRadius: 8,
                              background: isDone ? '#f0fdf4' : task.isDoubtSession ? '#fffbeb' : '#fafafa',
                              border: `1px solid ${isDone ? '#86efac' : task.isDoubtSession ? '#fcd34d' : '#e5e7eb'}`,
                              cursor: 'pointer', transition: 'all .15s',
                            }}
                            onClick={() => toggle(task.id)}
                          >
                            {/* Checkbox */}
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              border: isDone ? '2px solid #16a34a' : '2px dashed #d1d5db',
                              background: isDone ? '#16a34a' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontSize: 12, fontWeight: 700, transition: 'all .15s',
                            }}>{isDone ? '✓' : ''}</div>

                            {/* Icon + label */}
                            <span style={{ fontSize: 16 }}>{task.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: task.mandatory ? 700 : 500, color: isDone ? '#94a3b8' : '#1e293b', textDecoration: isDone ? 'line-through' : 'none' }}>
                                {task.label}
                                {task.mandatory && !isDone && <span style={{ marginLeft: 6, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>●MANDATORY</span>}
                                {task.isDoubtSession && <span style={{ marginLeft: 6, fontSize: 10, color: '#92400e', fontWeight: 700, background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>📖 TIMETABLE</span>}
                              </div>
                              {task.linkedSchedule && (
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>🕐 {task.time} · Linked: {task.linkedSchedule}</div>
                              )}
                              {hasNote && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>📝 {notes[task.id]}</div>}
                            </div>

                            {/* Note button */}
                            <button
                              onClick={e => { e.stopPropagation(); setNoteFor(noteFor === task.id ? null : task.id); setNoteText(notes[task.id] || '') }}
                              style={{ background: hasNote ? '#f5f3ff' : '#f1f5f9', color: hasNote ? '#7c3aed' : '#64748b', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                            >
                              {hasNote ? '📝' : '+ Note'}
                            </button>
                          </div>

                          {/* Note input */}
                          {noteFor === task.id && (
                            <div style={{ display: 'flex', gap: 8, padding: '8px 14px 8px 46px', background: '#fafafa', borderLeft: '2px solid #7c3aed' }}>
                              <input
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                placeholder="Add a note for this task..."
                                style={{ ...inp, fontSize: 12, padding: '7px 10px' }}
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && saveNote(task.id)}
                              />
                              <button onClick={() => saveNote(task.id)} style={{ ...btn('#7c3aed'), fontSize: 11, padding: '7px 12px', whiteSpace: 'nowrap' }}>Save</button>
                              <button onClick={() => setNoteFor(null)} style={{ ...btn('#f1f5f9', '#374151'), fontSize: 11, padding: '7px 10px' }}>✕</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ADMIN MONITOR DASHBOARD
// ══════════════════════════════════════════════════════════════

export function AdminMonitorTab({ staffProfiles }) {
  const [houses, setHouses] = useState([])
  const [allActivities, setAllActivities] = useState([])
  const [allDoubtLogs, setAllDoubtLogs] = useState([])
  const [students, setStudents] = useState([])
  const [todayChecks, setTodayChecks] = useState([]) // live per-task ticks from hm_daily_task_checks, today only
  const [loading, setLoading] = useState(true)
  const [selectedHouse, setSelectedHouse] = useState('All')
  const [dateRange, setDateRange] = useState(7) // days
  const today = new Date().toISOString().split('T')[0]

  const load = async () => {
    setLoading(true)
    const [{ data: h }, { data: a }, { data: d }, { data: s }, { data: tc, error: tcErr }] = await Promise.all([
      supabase.from('houses').select('*').order('name'),
      supabase.from('housemaster_activities').select('*').order('date', { ascending: false }).limit(200),
      supabase.from('doubt_session_logs').select('*').order('date', { ascending: false }).limit(100),
      supabase.from('students').select('id,name,house,hostel_type').order('name'),
      supabase.from('hm_daily_task_checks').select('housemaster_name, house, task_id, checked').eq('date', today).eq('checked', true),
    ])
    if (tcErr) console.error('hm_daily_task_checks fetch error (has the table been created?):', tcErr)
    setHouses(h || [])
    setAllActivities(a || [])
    setAllDoubtLogs(d || [])
    setStudents(s || [])
    setTodayChecks(tc || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const rangeStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - dateRange)
    return d.toISOString().split('T')[0]
  }, [dateRange])

  // Filter activities by date range & house
  const activities = useMemo(() => allActivities.filter(a =>
    a.date >= rangeStart &&
    (selectedHouse === 'All' || a.house === selectedHouse)
  ), [allActivities, rangeStart, selectedHouse])

  const doubtLogs = useMemo(() => allDoubtLogs.filter(d =>
    d.date >= rangeStart &&
    (selectedHouse === 'All' || d.house === selectedHouse)
  ), [allDoubtLogs, rangeStart, selectedHouse])

  // Per-house summary
  const houseSummary = useMemo(() => houses.map(h => {
    const hActs = allActivities.filter(a => a.house === h.name && a.date >= rangeStart)
    const hDoubt = allDoubtLogs.filter(d => d.house === h.name && d.date >= rangeStart)
    const todayActs = allActivities.filter(a => a.house === h.name && a.date === today)
    const hStudents = students.filter(s => s.house === h.name)

    // Today's mandatory tasks completion — read LIVE from
    // hm_daily_task_checks (per-checkbox ticks), not from
    // housemaster_activities, which only ever gets a single end-of-day
    // summary row and never the individual task labels. This means
    // admin now sees in-progress completion through the day, not just
    // after a housemaster clicks "Submit Day Report".
    // Matched by house — the tick-write fallback above guarantees every
    // row carries a house (selectedHouse, or the housemaster's own
    // assigned house if the dropdown wasn't touched), so this direct
    // match is reliable without needing to guess at staffProfiles' shape.
    const hChecksToday = todayChecks.filter(c => c.house === h.name)
    const checkedTaskIds = new Set(hChecksToday.map(c => c.task_id))
    const mandatoryDone = DAILY_TASKS.filter(t => t.mandatory && checkedTaskIds.has(t.id)).length
    const mandatoryPct = Math.round(mandatoryDone / DAILY_TASKS.filter(t => t.mandatory).length * 100)

    const lastActivity = hActs[0]?.date || null
    const daysSinceActivity = lastActivity
      ? Math.floor((new Date(today) - new Date(lastActivity)) / 86400000)
      : 999

    return {
      house: h,
      activityCount: hActs.length,
      todayCount: todayActs.length,
      mandatoryPct,
      studentCount: hStudents.length,
      lastActivity,
      daysSinceActivity,
      doubtLogged: allDoubtLogs.some(d => d.house === h.name && d.date === today),
      alert: daysSinceActivity > 2 || mandatoryPct < 50,
    }
  }), [houses, allActivities, allDoubtLogs, students, todayChecks, rangeStart, today])

  // Activity by category breakdown
  const catBreakdown = useMemo(() => {
    const map = {}
    activities.forEach(a => {
      map[a.category] = (map[a.category] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [activities])

  // Compliance: mandatory tasks logged today
  const todayActivities = allActivities.filter(a => a.date === today)
  const housesActiveToday = new Set(todayActivities.map(a => a.house)).size
  const doubtLoggedToday = new Set(allDoubtLogs.filter(d => d.date === today).map(d => d.house)).size

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>⏳ Loading admin monitor...</div>

  return (
    <div>
      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard icon="🏠" label="Total Houses"       value={houses.length}         color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="✅" label="Active Today"        value={housesActiveToday}     color="#16a34a" bg="#dcfce7" sub={`of ${houses.length} houses`} />
        <StatCard icon="⚠️" label="Needs Attention"    value={houseSummary.filter(h => h.alert).length} color="#dc2626" bg="#fee2e2" />
        <StatCard icon="📖" label="Doubt Logged Today" value={doubtLoggedToday}       color="#7c3aed" bg="#f5f3ff" sub={`of ${houses.length} houses`} />
        <StatCard icon="📋" label={`Activities (${dateRange}d)`} value={activities.length} color="#0891b2" bg="#e0f2fe" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedHouse} onChange={e => setSelectedHouse(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="All">All Houses</option>
          {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
        </select>
        <select value={dateRange} onChange={e => setDateRange(Number(e.target.value))} style={{ ...inp, width: 'auto' }}>
          <option value={1}>Today</option>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <button onClick={load} style={{ ...btn('#f1f5f9', '#374151'), fontSize: 12, padding: '8px 14px' }}>🔄 Refresh</button>
      </div>

      {/* House compliance grid */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 12 }}>🏠 House Compliance Monitor — Today</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {houseSummary.map(({ house: h, activityCount, todayCount, mandatoryPct, studentCount, lastActivity, daysSinceActivity, doubtLogged, alert }) => (
            <div key={h.id} style={{
              background: 'white', borderRadius: 12, overflow: 'hidden',
              boxShadow: alert ? '0 0 0 2px #fca5a5' : '0 2px 8px rgba(0,0,0,0.08)',
              border: alert ? '1px solid #fca5a5' : '1px solid #e2e8f0',
            }}>
              <div style={{ background: alert ? '#fef2f2' : '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: alert ? '#dc2626' : '#1e293b', fontSize: 14 }}>🏠 {h.name}</span>
                {alert && <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 999 }}>⚠ ATTENTION</span>}
              </div>
              <div style={{ padding: '12px 16px' }}>
                {/* Mandatory task bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: '#64748b' }}>
                    <span>Mandatory tasks today</span>
                    <span style={{ fontWeight: 700, color: mandatoryPct === 100 ? '#16a34a' : mandatoryPct > 50 ? '#ca8a04' : '#dc2626' }}>{mandatoryPct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${mandatoryPct}%`, background: mandatoryPct === 100 ? '#16a34a' : mandatoryPct > 50 ? '#f59e0b' : '#ef4444', borderRadius: 10 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 10 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ color: '#94a3b8' }}>Today's logs</div>
                    <div style={{ fontWeight: 800, color: '#1e3a5f', fontSize: 18 }}>{todayCount}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ color: '#94a3b8' }}>Students</div>
                    <div style={{ fontWeight: 800, color: '#1e3a5f', fontSize: 18 }}>{studentCount}</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div>
                    📖 Doubt session: {doubtLogged
                      ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Logged</span>
                      : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗ Not logged</span>}
                  </div>
                  <div>
                    📅 Last activity: {lastActivity
                      ? <span style={{ color: daysSinceActivity > 2 ? '#dc2626' : '#374151', fontWeight: 600 }}>
                          {daysSinceActivity === 0 ? 'Today' : daysSinceActivity === 1 ? 'Yesterday' : `${daysSinceActivity}d ago`}
                        </span>
                      : <span style={{ color: '#dc2626' }}>Never</span>}
                  </div>
                  <div>📊 {dateRange}d total: <strong>{activityCount}</strong> activities</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdown + Recent activity feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Category breakdown */}
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ background: '#1e3a5f', padding: '12px 16px', color: 'white', fontWeight: 700, fontSize: 13 }}>📊 Activity Breakdown</div>
          <div style={{ padding: '14px 16px' }}>
            {catBreakdown.length === 0
              ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No data</div>
              : catBreakdown.map(([cat, count]) => {
                const maxCount = catBreakdown[0][1]
                const pct = Math.round(count / maxCount * 100)
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: '#374151', fontWeight: 600 }}>{cat}</span>
                      <span style={{ color: '#1e3a5f', fontWeight: 700 }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#1e3a5f', borderRadius: 10 }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Recent activity feed */}
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ background: '#1e3a5f', padding: '12px 16px', color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>📋 Recent Activity Feed</span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>{activities.length} records</span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 380 }}>
            {activities.slice(0, 30).map(r => {
              const isDoubt = r.activity_type?.includes('Doubt')
              return (
                <div key={r.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                    {isDoubt ? '📖' : r.category === 'Daily Supervision' ? '👁' : r.category === 'Student Welfare' ? '💬' : r.category === 'House Activities' ? '🏆' : '📋'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{r.activity_type}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {r.date === today ? <strong style={{ color: '#0369a1' }}>Today</strong> : r.date} · 🏠 {r.house || '—'} · {r.housemaster_name || '—'}
                    </div>
                    {r.outcome && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>→ {r.outcome}</div>}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, flexShrink: 0,
                    background: r.status === 'Completed' ? '#dcfce7' : r.status === 'Missed' ? '#fee2e2' : '#fef9c3',
                    color: r.status === 'Completed' ? '#16a34a' : r.status === 'Missed' ? '#dc2626' : '#ca8a04',
                  }}>{r.status}</span>
                </div>
              )
            })}
            {activities.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No activities in selected range</div>
            )}
          </div>
        </div>
      </div>

      {/* Doubt session summary */}
      <div style={{ marginTop: 20, background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', padding: '12px 16px', color: 'white', fontWeight: 700, fontSize: 13 }}>
          📖 Doubt Session Log — {dateRange === 1 ? 'Today' : `Last ${dateRange} days`}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['Date', 'House', 'Subject', 'Teacher', 'Present', 'Absentees', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doubtLogs.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '10px 14px', color: r.date === today ? '#0369a1' : '#64748b', fontWeight: r.date === today ? 700 : 400, fontSize: 12 }}>
                    {r.date === today ? '📅 Today' : r.date}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#7c3aed' }}>{r.house || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{r.subject || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.teacher || '—'}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#16a34a' }}>{r.students_present ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: r.absentees ? '#dc2626' : '#94a3b8' }}>{r.absentees || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.notes || '—'}</td>
                </tr>
              ))}
              {doubtLogs.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No doubt session logs in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ENHANCED: HousemasterActivitiesTab (replaces original)
// ══════════════════════════════════════════════════════════════

const HM_ACTIVITY_TYPES = [
  { label: 'Morning roll call & wake-up check',        category: 'Daily Supervision',  freq: 'Daily'    },
  { label: 'Night roll call & lights-out check',       category: 'Daily Supervision',  freq: 'Daily'    },
  { label: 'Dormitory inspection',                     category: 'Daily Supervision',  freq: 'Daily'    },
  { label: 'Meal supervision (dining hall duty)',      category: 'Daily Supervision',  freq: 'Daily'    },
  { label: 'Study hall / doubt class supervision',     category: 'Daily Supervision',  freq: 'Daily'    },
  { label: 'PT / Exercise Supervision',                category: 'Daily Supervision',  freq: 'Daily'    },
  { label: 'Daily house diary / logbook entry',        category: 'Administration',     freq: 'Daily'    },
  { label: 'One-on-one student counselling session',  category: 'Student Welfare',     freq: 'Weekly'   },
  { label: 'Parent/guardian communication log',       category: 'Student Welfare',     freq: 'Weekly'   },
  { label: 'House points tally & leaderboard update', category: 'House Activities',    freq: 'Weekly'   },
  { label: 'House assembly / motivational talk',      category: 'House Activities',    freq: 'Weekly'   },
  { label: 'Inter-house sports event coordination',   category: 'House Activities',    freq: 'Monthly'  },
  { label: 'Cultural & art activity organisation',    category: 'House Activities',    freq: 'Monthly'  },
  { label: 'Student-of-the-month recognition',        category: 'House Activities',    freq: 'Monthly'  },
  { label: 'Monthly house report to principal',       category: 'Administration',      freq: 'Monthly'  },
  { label: 'Emotional / behavioural concern report',  category: 'Student Welfare',     freq: 'As Needed'},
  { label: 'Sickbay referral & follow-up',            category: 'Student Welfare',     freq: 'As Needed'},
  { label: 'Leave & absence tracking',                category: 'Administration',      freq: 'As Needed'},
  { label: 'Maintenance / facility defect reporting', category: 'Administration',      freq: 'As Needed'},
]

const FREQ_COLORS = {
  'Daily':     { bg: '#dcfce7', color: '#16a34a' },
  'Weekly':    { bg: '#dbeafe', color: '#1d4ed8' },
  'Monthly':   { bg: '#fef9c3', color: '#ca8a04' },
  'As Needed': { bg: '#e5e7eb', color: '#374151' },
}

const today_str = () => new Date().toISOString().split('T')[0]

const emptyHMA = {
  date: today_str(), housemaster_id: null, housemaster_name: '', house: '',
  activity_type: HM_ACTIVITY_TYPES[0].label, category: HM_ACTIVITY_TYPES[0].category,
  freq: HM_ACTIVITY_TYPES[0].freq, description: '', outcome: '', status: 'Completed',
}


// ══════════════════════════════════════════════════════════════
//  Daily Duty Roster — dated staff duty assignments (Lunch,
//  Toilet Cleanliness, Tea Break, Assembly, Dinner, etc.), distinct
//  from DailyTaskChecklist (a housemaster's own fixed self-check
//  list) and from Hostel.jsx's ScheduleTab (a recurring weekly
//  routine template). This is a specific date, named staff assigned
//  to time slots, plus a shared instructions block — closer to a
//  printed daily duty notice than a checklist.
// ══════════════════════════════════════════════════════════════
const emptyDutyRow = { time: '', duty: '', assigned_to: '' }
const emptyDutyRoster = {
  date: today_str(),
  duties: [{ ...emptyDutyRow }],
  instructions: '',
}

function DutyRosterPanel({ currentUser }) {
  const isAdmin = isAdminRole(currentUser?.role)
  const [viewDate, setViewDate] = useState(today_str())
  const [roster, setRoster] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyDutyRoster)

  const load = async (date) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('hostel_duty_rosters')
      .select('*')
      .eq('date', date)
      .maybeSingle()
    if (error) console.error('hostel_duty_rosters fetch error (has the table been created?):', error)
    setRoster(data || null)
    setLoading(false)
    setEditing(false)
  }
  useEffect(() => { load(viewDate) }, [viewDate])

  const startEdit = () => {
    setForm(roster
      ? { date: roster.date, duties: roster.duties?.length ? roster.duties : [{ ...emptyDutyRow }], instructions: roster.instructions || '' }
      : { ...emptyDutyRoster, date: viewDate }
    )
    setEditing(true)
  }

  const updateDutyRow = (i, field, val) => {
    setForm(f => {
      const duties = [...f.duties]
      duties[i] = { ...duties[i], [field]: val }
      return { ...f, duties }
    })
  }
  const addDutyRow = () => setForm(f => ({ ...f, duties: [...f.duties, { ...emptyDutyRow }] }))
  const removeDutyRow = (i) => setForm(f => ({ ...f, duties: f.duties.filter((_, idx) => idx !== i) }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!isAdmin) { alert('Only admins can create or edit the duty roster.'); return }
    setSaving(true)
    const cleanDuties = form.duties
      .map(d => ({ time: d.time.trim(), duty: d.duty.trim(), assigned_to: d.assigned_to.trim() }))
      .filter(d => d.duty || d.assigned_to)
    const payload = {
      date: form.date,
      duties: cleanDuties,
      instructions: form.instructions,
      updated_by: currentUser?.name || null,
    }
    const { error } = await supabase
      .from('hostel_duty_rosters')
      .upsert([payload], { onConflict: 'date' })
    if (error) alert('Error: ' + error.message)
    else { setEditing(false); load(form.date); if (form.date !== viewDate) setViewDate(form.date) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!isAdmin || !roster) return
    if (!window.confirm(`Delete the duty roster for ${roster.date}?`)) return
    await supabase.from('hostel_duty_rosters').delete().eq('date', roster.date)
    load(viewDate)
  }

  const dateLabel = (dstr) => {
    try {
      return new Date(dstr + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
    } catch { return dstr }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ ...lbl, marginBottom: 0 }}>Date</label>
          <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} style={{ ...inp, width: 'auto' }} />
        </div>
        {isAdmin && !editing && (
          <button onClick={startEdit} style={btn()}>
            {roster ? '✏️ Edit Roster' : '➕ Create Roster'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading...</div>
      ) : editing ? (
        <form onSubmit={handleSave} style={{ background: 'white', borderRadius: 12, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Date *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={{ ...inp, maxWidth: 220 }} />
          </div>

          <label style={lbl}>Duty / Responsibility Rows</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {form.duties.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <input value={d.time} onChange={e => updateDutyRow(i, 'time', e.target.value)} placeholder="Time (e.g. 6:00 pm, Lunch, Dinner)" style={{ ...inp, flex: '1 1 160px' }} />
                <input value={d.duty} onChange={e => updateDutyRow(i, 'duty', e.target.value)} placeholder="Duty / Responsibility" style={{ ...inp, flex: '2 1 220px' }} />
                <input value={d.assigned_to} onChange={e => updateDutyRow(i, 'assigned_to', e.target.value)} placeholder="Assigned To" style={{ ...inp, flex: '2 1 220px' }} />
                <button type="button" onClick={() => removeDutyRow(i)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addDutyRow} style={{ ...btn('#eff6ff', '#1e3a5f'), marginBottom: 20 }}>➕ Add Row</button>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Important Instructions</label>
            <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={4} placeholder="One instruction per line..." style={{ ...inp, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save Roster'}</button>
            <button type="button" onClick={() => setEditing(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
          </div>
        </form>
      ) : !roster ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          No duty roster has been published for {dateLabel(viewDate)}.
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
          <div style={{ background: '#1e3a5f', padding: '16px 22px' }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>📋 Daily Duty List</div>
            <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, marginTop: 2 }}>{dateLabel(roster.date)}</div>
          </div>

          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Time', 'Duty / Responsibility', 'Assigned To'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(roster.duties || []).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 700, color: '#1e3a5f' }}>{d.time || '—'}</td>
                    <td style={{ padding: '11px 16px', color: '#1e293b' }}>{d.duty || '—'}</td>
                    <td style={{ padding: '11px 16px', color: '#374151' }}>{d.assigned_to || '—'}</td>
                  </tr>
                ))}
                {(!roster.duties || roster.duties.length === 0) && (
                  <tr><td colSpan={3} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No duty rows added</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {roster.instructions && (
            <div style={{ padding: '18px 22px', borderTop: '1px solid #f1f5f9', background: '#fffbeb' }}>
              <div style={{ fontWeight: 700, color: '#92400e', fontSize: 13, marginBottom: 8 }}>⚠️ IMPORTANT INSTRUCTIONS</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#78350f', fontSize: 13, lineHeight: 1.7 }}>
                {roster.instructions.split('\n').filter(l => l.trim()).map((line, i) => (
                  <li key={i}>{line.replace(/^\*\s*/, '').trim()}</li>
                ))}
              </ul>
            </div>
          )}

          {isAdmin && (
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
              <button onClick={handleDelete} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🗑 Delete Roster</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function HousemasterActivitiesTab({ staffProfiles, currentUser }) {
  const isAdmin = isAdminRole(currentUser?.role)
  const isHM = (currentUser?.role || '').toLowerCase() === 'house master'
  const [activeView, setActiveView] = useState('checklist') // 'checklist' | 'log' | 'doubt'
  const [records,    setRecords]    = useState([])
  const [houses,     setHouses]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [editRec,    setEditRec]    = useState(null)
  const [form,       setForm]       = useState(emptyHMA)
  const [catFilter,  setCatFilter]  = useState('All')
  const [houseFilter,setHouseFilter]= useState('All')
  const [search,     setSearch]     = useState('')

  const load = async () => {
    setLoading(true)
    const [{ data: r }, { data: h }] = await Promise.all([
      supabase.from('housemaster_activities').select('*').order('date', { ascending: false }),
      supabase.from('houses').select('*').order('name'),
    ])
    setRecords(r || [])
    setHouses(h || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleActivityTypeChange = val => {
    const found = HM_ACTIVITY_TYPES.find(a => a.label === val)
    setForm(f => ({ ...f, activity_type: val, category: found?.category || '', freq: found?.freq || '' }))
  }

  const handleSave = async e => {
    e.preventDefault()
    if (editRec && !isAdmin && editRec.housemaster_name !== currentUser?.name) {
      alert('You can only edit your own activity logs.'); return
    }
    setSaving(true)
    const payload = {
      date: form.date,
      housemaster_id: isAdmin ? (form.housemaster_id || null) : (currentUser?.id || null),
      house: form.house,
      housemaster_name: isAdmin ? form.housemaster_name : (currentUser?.name || form.housemaster_name),
      activity_type: form.activity_type, category: form.category, freq: form.freq,
      description: form.description, outcome: form.outcome, status: form.status,
    }
    const { error } = editRec
      ? await supabase.from('housemaster_activities').update(payload).eq('id', editRec.id)
      : await supabase.from('housemaster_activities').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyHMA); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!isAdmin) { alert('Only admins can delete activity logs.'); return }
    if (!window.confirm('Delete this activity log?')) return
    await supabase.from('housemaster_activities').delete().eq('id', id)
    load()
  }

  const categories    = [...new Set(HM_ACTIVITY_TYPES.map(a => a.category))]
  const uniqueHouses  = [...new Set(records.map(r => r.house).filter(Boolean))]
  const todayLogs     = records.filter(r => r.date === today_str())
  const completed     = records.filter(r => r.status === 'Completed').length

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r =>
      (catFilter   === 'All' || r.category === catFilter) &&
      (houseFilter === 'All' || r.house    === houseFilter) &&
      [r.housemaster_name, r.activity_type, r.description, r.house].some(v => (v || '').toLowerCase().includes(q))
    )
  }, [records, catFilter, houseFilter, search])

  const VIEW_TABS = [
    { id: 'checklist', label: '✅ Daily Checklist' },
    { id: 'duty',      label: '📋 Duty Roster' },
    { id: 'students',  label: '🏠 House Students' },
    { id: 'log',       label: '📋 Activity Log' },
  ]

  return (
    <div>
      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 22 }}>
        {VIEW_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveView(t.id)} style={{
            padding: '9px 20px', border: 'none',
            borderBottom: activeView === t.id ? '3px solid #1e3a5f' : '3px solid transparent',
            background: 'none', cursor: 'pointer', fontSize: 13,
            fontWeight: activeView === t.id ? 700 : 500,
            color: activeView === t.id ? '#1e3a5f' : '#64748b',
            marginBottom: -2, whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Daily Checklist View ── */}
      {activeView === 'checklist' && (
        <DailyTaskChecklist staffProfiles={staffProfiles} houses={houses} />
      )}

      {/* ── Duty Roster View ── */}
      {activeView === 'duty' && (
        <DutyRosterPanel currentUser={currentUser} />
      )}

      {/* ── House Students View ── */}
      {activeView === 'students' && (
        <HouseStudentsPanel houses={houses} isAdmin={isAdmin} currentUser={currentUser} />
      )}

      {/* ── Doubt Session View ── */}

      {/* ── Activity Log View ── */}
      {activeView === 'log' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard icon="📋" label="Total Logged"     value={records.length}     color="#1e3a5f" bg="#eff6ff" />
            <StatCard icon="📅" label="Logged Today"     value={todayLogs.length}   color="#1d4ed8" bg="#dbeafe" />
            <StatCard icon="✅" label="Completed"        value={completed}           color="#16a34a" bg="#dcfce7" />
            <StatCard icon="🏠" label="Houses Reporting" value={uniqueHouses.length} color="#7c3aed" bg="#f5f3ff" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
              <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 180 }} />
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="All">All Houses</option>
                {uniqueHouses.map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
            <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyHMA) }} style={btn()}>
              {showForm ? '✖ Cancel' : '➕ Log Activity'}
            </button>
          </div>

          {showForm && (
            <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>
                {editRec ? '✏️ Edit Activity Log' : '➕ Log Housemaster Activity'}
              </h3>
              <form onSubmit={handleSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} /></div>
                  <div>
                    <label style={lbl}>House</label>
                    <select value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} style={inp}>
                      <option value="">— Select House —</option>
                      {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>Housemaster{!isAdmin ? ' (yourself)' : ''}</label>
                    {isAdmin ? (
                      <>
                        <StaffSearchInput staff={staffProfiles} onSelect={s => setForm(f => ({ ...f, housemaster_id: s.id, housemaster_name: s.name }))} placeholder="Search housemaster..." />
                        {form.housemaster_name && (
                          <div style={{ marginTop: 6, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 12, color: '#1e3a5f', fontWeight: 600 }}>
                            ✅ {form.housemaster_name}
                            <button type="button" onClick={() => setForm(f => ({ ...f, housemaster_name: '', housemaster_id: null }))} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>✕</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <input value={form.housemaster_name || currentUser?.name || ''} disabled readOnly style={{ ...inp, backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
                    )}
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>Activity Type *</label>
                    <select value={form.activity_type} onChange={e => handleActivityTypeChange(e.target.value)} required style={inp}>
                      {categories.map(cat => (
                        <optgroup key={cat} label={cat}>
                          {HM_ACTIVITY_TYPES.filter(a => a.category === cat).map(a => (
                            <option key={a.label} value={a.label}>{a.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div><label style={lbl}>Category</label><input value={form.category} readOnly style={{ ...inp, background: '#f8fafc', color: '#64748b' }} /></div>
                  <div><label style={lbl}>Frequency</label><input value={form.freq} readOnly style={{ ...inp, background: '#f8fafc', color: '#64748b' }} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
                  <div><label style={lbl}>Outcome</label><input value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} style={inp} /></div>
                  <div>
                    <label style={lbl}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                      {['Completed', 'Pending', 'Missed', 'Rescheduled'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳...' : '✅ Save'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {loading
            ? <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading...</div>
            : (
              <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#1e3a5f' }}>
                      {['#','Date','House','Housemaster','Activity','Category','Freq','Outcome','Status','Actions'].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const fc = FREQ_COLORS[r.freq] || FREQ_COLORS['As Needed']
                      const sc = r.status === 'Completed' ? { bg:'#dcfce7', color:'#16a34a' }
                               : r.status === 'Missed'    ? { bg:'#fee2e2', color:'#dc2626' }
                               : r.status === 'Pending'   ? { bg:'#fef9c3', color:'#ca8a04' }
                               :                            { bg:'#e5e7eb', color:'#374151' }
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i+1}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r.date}</td>
                          <td style={{ padding: '10px 14px', color: '#7c3aed', fontWeight: 600, fontSize: 12 }}>{r.house || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.housemaster_name || '—'}</div>
                            {r.housemaster_id && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 180 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }} title={r.activity_type}>{r.activity_type}</div>
                            {r.description && <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{r.category}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: fc.bg, color: fc.color }}>{r.freq}</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12, maxWidth: 140 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.outcome || '—'}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{r.status}</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {(isAdmin || r.housemaster_name === currentUser?.name) && (
                                <button onClick={() => { setEditRec(r); setForm({ ...r }); setShowForm(true) }} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                              )}
                              {isAdmin && <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No activity logs found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}
    </div>
  )
}

export default HousemasterActivitiesTab