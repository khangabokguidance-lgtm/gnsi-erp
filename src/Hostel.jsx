import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { HousemasterActivitiesTab, AdminMonitorTab } from './HousemasterActivitiesEnhanced'
import { ClassTimetableTab, DoubtSessionTab } from './ClassTimetableTab'
import LeaveTab, { StudentSelfService, GatePassVerifyPage } from './LeaveTab'

// ══════════════════════════════════════════════════════════════
//  MOBILE-FIRST RESPONSIVE STYLES
// ══════════════════════════════════════════════════════════════
const isMobile = () => window.innerWidth < 768
const isTablet = () => window.innerWidth >= 768 && window.innerWidth < 1024

// ─── Shared styles ─────────────────────────────────────────────
const inp = {
  width: '100%', padding: '12px 14px', borderRadius: '10px',
  border: '1px solid #d1d5db', fontSize: '16px', // 16px prevents iOS zoom
  boxSizing: 'border-box', backgroundColor: 'white',
  minHeight: '44px', // Touch-friendly
}
const lbl = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#374151', marginBottom: '6px',
}
const btn = (bg = '#1e3a5f', c = 'white') => ({
  backgroundColor: bg, color: c, border: 'none', borderRadius: '10px',
  padding: '12px 20px', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
  minHeight: '44px', minWidth: '44px', // Touch targets
})
const card = {
  background: 'white', borderRadius: '14px', padding: '16px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
}
const mobileCard = {
  ...card,
  padding: '12px',
  borderRadius: '12px',
}

// ─── Responsive grid helpers ──────────────────────────────────
const grid2 = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '14px',
}
const mobileGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: '10px',
}
const statGrid = (min = 140) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
  gap: '12px',
  marginBottom: '20px',
})
const mobileStatGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  marginBottom: '16px',
}

// ─── Mobile table replacement ─────────────────────────────────
const MobileCardList = ({ children, style = {} }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', ...style }}>
    {children}
  </div>
)

const MobileRecordCard = ({ children, accentColor = '#1e3a5f', onClick }) => (
  <div 
    onClick={onClick}
    style={{
      background: 'white', borderRadius: '12px', padding: '14px',
      borderLeft: `4px solid ${accentColor}`,
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      cursor: onClick ? 'pointer' : 'default',
    }}
  >
    {children}
  </div>
)

const TABS = [
  { id: 'schedule',    label: '📅 Schedule' },
  { id: 'house',       label: '🏠 Houses' },
  { id: 'housemaster', label: '👨‍🏫 HM' },
  { id: 'hmactivities', label: '📌 Activities' },
  { id: 'adminmonitor', label: '🖥 Monitor' },
  { id: 'discipline',  label: '⚠️ Discipline' },
  { id: 'sickbay',     label: '🏥 Sickbay' },
  { id: 'kitchen',     label: '🍽️ Kitchen' },
  { id: 'nightduty',   label: '🍽️ Mess Duty' },
  { id: 'allotments',  label: '📋 Day Scholar' },
  // ─── NEW: House Master Daily Features ──────────────────
  { id: 'attendance',  label: '✓ Roll Call' },
  { id: 'leave',       label: '🚪 Leave' },
  { id: 'hmdashboard', label: '📊 HM Dash' },
  { id: 'maintenance',  label: '🔧 Repairs' },
  { id: 'journal',     label: '📝 Journal' },
  { id: 'doubtsession',   label: '🙋 Doubt'   },
  { id: 'classtimetable', label: '🗓️ Classes' },
]

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const today = () => new Date().toISOString().split('T')[0]
const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function getStudentClass(s) {
  if (!s) return ''
  const batch = (s.batch || '').trim()
  const cls   = (s.class_name || '').trim()
  if (batch && batch !== '???') return batch
  if (cls   && cls   !== '???') return cls
  return ''
}

// ══════════════════════════════════════════════════════════════
//  MOBILE-OPTIMIZED STAT CARD
// ══════════════════════════════════════════════════════════════
function StatCard({ icon, label, value, color, bg, compact = false }) {
  const [mobile, setMobile] = useState(isMobile())
  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (mobile || compact) {
    return (
      <div style={{
        backgroundColor: bg, borderRadius: '10px', padding: '10px 12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ fontSize: '18px' }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '11px', color, fontWeight: '600', margin: 0, lineHeight: 1.2 }}>{label}</p>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color, margin: '2px 0 0', lineHeight: 1.2 }}>{value}</h2>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: bg, borderRadius: '12px', padding: '18px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>
      <p style={{ fontSize: '13px', color, fontWeight: '600', margin: 0 }}>{label}</p>
      <h2 style={{ fontSize: '28px', fontWeight: 'bold', color, margin: '4px 0 0' }}>{value}</h2>
    </div>
  )
}

function statusStyle(status) {
  const map = {
    Occupied:      { bg: '#dcfce7', color: '#16a34a' },
    Vacant:        { bg: '#fee2e2', color: '#dc2626' },
    Shifted:       { bg: '#fef9c3', color: '#ca8a04' },
    Vacated:       { bg: '#e5e7eb', color: '#374151' },
    Resolved:      { bg: '#dcfce7', color: '#16a34a' },
    Open:          { bg: '#fee2e2', color: '#dc2626' },
    'In Progress': { bg: '#fef9c3', color: '#ca8a04' },
    Closed:        { bg: '#e5e7eb', color: '#374151' },
    Discharged:    { bg: '#dcfce7', color: '#16a34a' },
    Admitted:      { bg: '#dbeafe', color: '#1d4ed8' },
    Present:       { bg: '#dcfce7', color: '#16a34a' },
    Absent:        { bg: '#fee2e2', color: '#dc2626' },
    Late:          { bg: '#fef9c3', color: '#ca8a04' },
    'On Leave':    { bg: '#dbeafe', color: '#1d4ed8' },
    Sick:          { bg: '#f5f3ff', color: '#7c3aed' },
    Pending:       { bg: '#fef9c3', color: '#ca8a04' },
    Approved:      { bg: '#dcfce7', color: '#16a34a' },
    Rejected:      { bg: '#fee2e2', color: '#dc2626' },
    Overdue:       { bg: '#fee2e2', color: '#dc2626' },
  }
  const s = map[status] || { bg: '#e0f2fe', color: '#0891b2' }
  return {
    padding: '4px 10px', borderRadius: '999px', fontSize: '12px',
    fontWeight: '600', backgroundColor: s.bg, color: s.color,
    whiteSpace: 'nowrap', display: 'inline-block',
  }
}

// ══════════════════════════════════════════════════════════════
//  MOBILE-OPTIMIZED SEARCH INPUTS
// ══════════════════════════════════════════════════════════════
function StudentSearchInput({ students, onSelect, placeholder = 'Type name or GCC No...' }) {
  const [query, setQuery] = useState('')
  const [mobile, setMobile] = useState(isMobile())

  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return students
      .filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        String(s.gcc_no || '').includes(q) ||
        (s.batch || '').toLowerCase().includes(q) ||
        (s.course || '').toLowerCase().includes(q) ||
        String(s.admission_no || '').toLowerCase().includes(q)
      )
      .slice(0, mobile ? 5 : 8)
  }, [query, students, mobile])

  const select = s => { onSelect(s); setQuery('') }

  return (
    <div style={{ position: 'relative' }}>
      <input 
        value={query} 
        onChange={e => setQuery(e.target.value)} 
        placeholder={placeholder} 
        style={inp} 
        type="search"
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid #d1d5db', borderRadius: '10px',
          zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          maxHeight: mobile ? 180 : 220, overflowY: 'auto',
          marginTop: '4px',
        }}>
          {matches.map(s => (
            <div key={s.id} onClick={() => select(s)}
              style={{ 
                padding: mobile ? '12px 14px' : '10px 14px', 
                cursor: 'pointer', borderBottom: '1px solid #f1f5f9', 
                fontSize: '14px',
                minHeight: '44px',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: '#1e293b', fontSize: '14px' }}>{s.name}</strong>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                  {s.gcc_no ? `GCC-${s.gcc_no}` : '—'}{' · '}{getStudentClass(s) || '—'}
                  {s.house ? ` · 🏠 ${s.house}` : ''}{s.hostel_type ? ` · ${s.hostel_type}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StaffSearchInput({ staff, onSelect, placeholder = 'Search staff by name...' }) {
  const [query, setQuery] = useState('')
  const [mobile, setMobile] = useState(isMobile())

  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return staff
      .filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.designation || '').toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q)
      )
      .slice(0, mobile ? 5 : 8)
  }, [query, staff, mobile])

  const select = s => { onSelect(s); setQuery('') }

  return (
    <div style={{ position: 'relative' }}>
      <input 
        value={query} 
        onChange={e => setQuery(e.target.value)} 
        placeholder={placeholder} 
        style={inp} 
        type="search"
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid #d1d5db', borderRadius: '10px',
          zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          maxHeight: mobile ? 180 : 200, overflowY: 'auto',
          marginTop: '4px',
        }}>
          {matches.map(s => (
            <div key={s.id} onClick={() => select(s)}
              style={{ 
                padding: mobile ? '12px 14px' : '10px 14px', 
                cursor: 'pointer', borderBottom: '1px solid #f1f5f9', 
                fontSize: '14px',
                minHeight: '44px',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: '#1e293b' }}>{s.name}</strong>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                  {s.designation || s.department || '—'}
                  {s.status === 'Active' ? ' · ✅ Active' : ' · ⏸ Inactive'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MOBILE TABLE / CARD SWITCHER
// ══════════════════════════════════════════════════════════════
// ── Helpers ──
const normalizeHouse = (h) => (h || '').toString().trim().toLowerCase()
const isAssigned = (s) => {
  const h = s.house
  return h !== null && h !== undefined && String(h).trim() !== ''
}

function useMobileView() {
  const [mobile, setMobile] = useState(isMobile())
  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return mobile
}

function MobileActionButtons({ actions }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
      {actions.map((action, i) => (
        <button 
          key={i}
          onClick={action.onClick}
          style={{
            flex: action.fullWidth ? '1 1 100%' : '1 1 auto',
            padding: '8px 12px',
            borderRadius: '8px',
            border: 'none',
            background: action.bg || '#eff6ff',
            color: action.color || '#1e3a5f',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            minHeight: '36px',
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  ATTENDANCE TAB — House Dashboard + Quick Roll Call
//  Drop-in replacement for AttendanceTab in Hostel.jsx
// ══════════════════════════════════════════════════════════════

const ATTENDANCE_TYPES = ['Present', 'Absent', 'Late', 'On Leave', 'Sick']

const HOUSE_PALETTE = [
  { color: '#1d4ed8', bg: '#dbeafe', light: '#eff6ff', border: '#93c5fd', dark: '#1e40af' },
  { color: '#dc2626', bg: '#fee2e2', light: '#fff1f2', border: '#fca5a5', dark: '#b91c1c' },
  { color: '#16a34a', bg: '#dcfce7', light: '#f0fdf4', border: '#6ee7b7', dark: '#15803d' },
  { color: '#ca8a04', bg: '#fef9c3', light: '#fefce8', border: '#fde047', dark: '#a16207' },
  { color: '#7c3aed', bg: '#f5f3ff', light: '#faf5ff', border: '#c4b5fd', dark: '#6d28d9' },
  { color: '#0891b2', bg: '#e0f2fe', light: '#f0f9ff', border: '#7dd3fc', dark: '#0e7490' },
  { color: '#be185d', bg: '#fce7f3', light: '#fdf2f8', border: '#f9a8d4', dark: '#9d174d' },
  { color: '#047857', bg: '#d1fae5', light: '#ecfdf5', border: '#6ee7b7', dark: '#065f46' },
]

const statusConfig = {
  Present:    { bg: '#dcfce7', color: '#16a34a', icon: '✓' },
  Absent:     { bg: '#fee2e2', color: '#dc2626', icon: '✕' },
  Late:       { bg: '#fef9c3', color: '#ca8a04', icon: '⏰' },
  'On Leave': { bg: '#dbeafe', color: '#1d4ed8', icon: '🚪' },
  Sick:       { bg: '#f5f3ff', color: '#7c3aed', icon: '🏥' },
  Unmarked:   { bg: '#f1f5f9', color: '#94a3b8', icon: '?' },
}

function AttendanceTab({ students, currentHousemaster }) {
  // ── View state: 'houses' | 'dashboard' | 'rollcall'
  const [view, setView] = useState('houses')
  const [selectedHouse, setSelectedHouse] = useState(null)
  const [records, setRecords] = useState([])
  const [allRecords, setAllRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(today())
  const [session, setSession] = useState('morning')
  // Roll call state
  const [rollCallIndex, setRollCallIndex] = useState(0)
  const [rollCallStudents, setRollCallStudents] = useState([])
  const [justMarked, setJustMarked] = useState(null)
  const mobile = useMobileView()

  const activeStudents = useMemo(() =>
    students.filter(s => s.status !== 'Inactive'),
    [students]
  )

  const houses = useMemo(() =>
    [...new Set(activeStudents.map(s => normalizeHouse(s.house)).filter(h => h))].sort(),
    [activeStudents]
  )

  // ── House palette (computed once, used in all views) ──
  const houseIdx = selectedHouse ? houses.indexOf(selectedHouse) : -1
  const pal = houseIdx >= 0 ? HOUSE_PALETTE[houseIdx % HOUSE_PALETTE.length] : HOUSE_PALETTE[0]

  // Load ALL attendance records for the day
  const loadAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('date', date)
      .eq('session', session)
    setAllRecords(data || [])
    setLoading(false)
  }, [date, session])

  useEffect(() => { loadAll() }, [loadAll])

  // Filter records for selected house
  useEffect(() => {
    if (selectedHouse) {
      setRecords(allRecords.filter(r => normalizeHouse(r.house) === normalizeHouse(selectedHouse)))
    }
  }, [allRecords, selectedHouse])

  const getStatus = (studentId) =>
    allRecords.find(r => r.student_id === studentId)?.status || 'Unmarked'

  const handleMark = async (studentId, status) => {
    setSaving(true)
    const existing = allRecords.find(r => r.student_id === studentId)
    const student = activeStudents.find(s => s.id === studentId)
    const payload = {
      date, session,
      student_id: studentId,
      student_name: student?.name || '',
      gcc_no: student?.gcc_no || null,
      class_name: getStudentClass(student),
      house: student?.house || '',
      status,
      marked_by: currentHousemaster?.name || 'System',
      marked_at: new Date().toISOString(),
    }
    const { error } = existing
      ? await supabase.from('attendance_records').update({ status, marked_by: payload.marked_by, marked_at: payload.marked_at }).eq('id', existing.id)
      : await supabase.from('attendance_records').insert([payload])
    if (!error) {
      // Optimistic update
      setAllRecords(prev => {
        if (existing) return prev.map(r => r.student_id === studentId ? { ...r, status } : r)
        return [...prev, { ...payload, id: Date.now() }]
      })
      setJustMarked(studentId)
      setTimeout(() => setJustMarked(null), 600)
    }
    setSaving(false)
  }

  const handleBulkMark = async (studentIds, status) => {
    setSaving(true)
    const payloads = studentIds.map(id => {
      const student = activeStudents.find(s => s.id === id)
      return {
        date, session,
        student_id: id,
        student_name: student?.name || '',
        gcc_no: student?.gcc_no || null,
        class_name: getStudentClass(student),
        house: student?.house || '',
        status,
        marked_by: currentHousemaster?.name || 'System',
        marked_at: new Date().toISOString(),
      }
    })
    await supabase.from('attendance_records').delete()
      .eq('date', date).eq('session', session).in('student_id', studentIds)
    const { error } = await supabase.from('attendance_records').insert(payloads)
    if (!error) await loadAll()
    setSaving(false)
  }

  // ── Per-house stats
  const getHouseStats = (houseName) => {
    const hStudents = activeStudents.filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
    const hRecords = allRecords.filter(r => r.house === houseName)
    const present = hRecords.filter(r => r.status === 'Present').length
    const absent = hRecords.filter(r => r.status === 'Absent').length
    const sick = hRecords.filter(r => r.status === 'Sick').length
    const onLeave = hRecords.filter(r => r.status === 'On Leave').length
    const late = hRecords.filter(r => r.status === 'Late').length
    const marked = hRecords.length
    const total = hStudents.length
    const unmarked = total - marked
    const pct = total ? Math.round(marked / total * 100) : 0
    return { total, present, absent, sick, onLeave, late, marked, unmarked, pct }
  }

  // ── Start roll call for a house
  const startRollCall = (houseName) => {
    const hStudents = activeStudents
      .filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
      .sort((a, b) => {
        // Unmarked first
        const aMarked = allRecords.some(r => r.student_id === a.id)
        const bMarked = allRecords.some(r => r.student_id === b.id)
        if (!aMarked && bMarked) return -1
        if (aMarked && !bMarked) return 1
        return (a.name || '').localeCompare(b.name || '')
      })
    setRollCallStudents(hStudents)
    setRollCallIndex(0)
    setView('rollcall')
  }

  // ══════════════════════════════════════════════════
  //  VIEW 1: ALL HOUSES OVERVIEW
  // ══════════════════════════════════════════════════
  if (view === 'houses') {
    const totalStudents = activeStudents.length
    const totalMarked = allRecords.length
    const totalPresent = allRecords.filter(r => r.status === 'Present').length
    const totalAbsent = allRecords.filter(r => r.status === 'Absent').length
    const totalUnmarked = totalStudents - totalMarked

    return (
      <div>
        {/* Date & Session selector */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input
            type="date" value={date}
            onChange={e => setDate(e.target.value)}
            style={{ ...inp, flex: 1, minWidth: 140 }}
          />
          <select value={session} onChange={e => setSession(e.target.value)} style={{ ...inp, flex: 1 }}>
            <option value="morning">🌅 Morning Roll Call</option>
            <option value="night">🌙 Night Roll Call</option>
          </select>
        </div>

        {/* Overall stats bar */}
        <div style={{
          background: '#1e3a5f', borderRadius: '14px', padding: '16px 20px',
          marginBottom: '20px', color: 'white',
        }}>
          <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '10px', fontWeight: '600' }}>
            TODAY'S SUMMARY · {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total', value: totalStudents, color: 'rgba(255,255,255,0.9)' },
              { label: 'Present', value: totalPresent, color: '#4ade80' },
              { label: 'Absent', value: totalAbsent, color: '#f87171' },
              { label: 'Unmarked', value: totalUnmarked, color: '#fbbf24' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: mobile ? '22px' : '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Overall progress bar */}
          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.6, marginBottom: '5px' }}>
              <span>Roll Call Progress</span>
              <span>{totalMarked}/{totalStudents} marked</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${totalStudents ? Math.round(totalMarked / totalStudents * 100) : 0}%`,
                background: totalMarked === totalStudents ? '#4ade80' : '#60a5fa',
                borderRadius: '99px', transition: 'width 0.4s',
              }} />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        ) : (
          <>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Select a House
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
              {houses.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', gridColumn: '1/-1' }}>
                  No houses found. Assign students to houses first.
                </div>
              )}
              {houses.map((houseName, idx) => {
                const pal = HOUSE_PALETTE[idx % HOUSE_PALETTE.length]
                const stats = getHouseStats(houseName)
                const allDone = stats.unmarked === 0
                return (
                  <div
                    key={houseName}
                    onClick={() => { setSelectedHouse(houseName); setView('dashboard') }}
                    style={{
                      background: 'white', borderRadius: '14px', overflow: 'hidden',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      border: `1.5px solid ${allDone ? '#bbf7d0' : pal.border}`,
                      cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
                  >
                    {/* Color bar */}
                    <div style={{ height: '5px', background: allDone ? '#16a34a' : pal.color }} />
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: '800', color: pal.color }}>
                            🏠 {houseName}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {stats.total} students
                          </div>
                        </div>
                        {allDone
                          ? <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '99px', background: '#dcfce7', color: '#16a34a' }}>✓ Complete</span>
                          : <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '99px', background: '#fef9c3', color: '#ca8a04' }}>{stats.unmarked} pending</span>
                        }
                      </div>

                      {/* Mini stats row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '12px' }}>
                        {[
                          { label: 'P', value: stats.present, color: '#16a34a', bg: '#dcfce7' },
                          { label: 'A', value: stats.absent, color: '#dc2626', bg: '#fee2e2' },
                          { label: 'L', value: stats.late, color: '#ca8a04', bg: '#fef9c3' },
                          { label: '🚪', value: stats.onLeave, color: '#1d4ed8', bg: '#dbeafe' },
                          { label: '🏥', value: stats.sick, color: '#7c3aed', bg: '#f5f3ff' },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: 'center', padding: '6px 4px', background: s.bg, borderRadius: '8px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '10px', color: s.color, fontWeight: '600' }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${stats.pct}%`,
                            background: allDone ? '#16a34a' : pal.color,
                            borderRadius: '99px', transition: 'width 0.4s',
                          }} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                          {stats.marked}/{stats.total} marked · {stats.pct}%
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedHouse(houseName); setView('dashboard') }}
                          style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', background: pal.bg, color: pal.color, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          📊 Dashboard
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedHouse(houseName); startRollCall(houseName) }}
                          style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', background: pal.color, color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          ⚡ Roll Call
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── ALERT BANNER: Absent + Unmarked reminders ── */}
            {(() => {
              const absentCount   = allRecords.filter(r => r.status === 'Absent').length
              const unmarkedCount = totalStudents - totalMarked
              if (absentCount === 0 && unmarkedCount === 0) return null
              return (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {absentCount > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '13px 16px', background: '#fff1f2',
                      border: '1.5px solid #fca5a5', borderRadius: '12px',
                      fontSize: '13px', color: '#dc2626', fontWeight: '700',
                    }}>
                      <span style={{ fontSize: '20px' }}>🔴</span>
                      <div>
                        <div>{absentCount} student{absentCount > 1 ? 's' : ''} marked <strong>Absent</strong> today</div>
                        <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.85, marginTop: '2px' }}>
                          Verify with housemaster · Check if on approved leave
                        </div>
                      </div>
                    </div>
                  )}
                  {unmarkedCount > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '13px 16px', background: '#fffbeb',
                      border: '1.5px solid #fcd34d', borderRadius: '12px',
                      fontSize: '13px', color: '#92400e', fontWeight: '700',
                    }}>
                      <span style={{ fontSize: '20px' }}>⏳</span>
                      <div>
                        <div>{unmarkedCount} student{unmarkedCount > 1 ? 's' : ''} still <strong>unmarked</strong></div>
                        <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.85, marginTop: '2px' }}>
                          Tap a house below to open roll call
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Unassigned students warning */}
            {(() => {
              const unassigned = activeStudents.filter(s => !s.house)
              if (unassigned.length === 0) return null
              return (
                <div style={{ marginTop: '8px', padding: '12px 16px', background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', fontSize: '13px', color: '#9a3412', fontWeight: '600' }}>
                  ⚠️ {unassigned.length} students have no house assigned and won't appear in roll call.
                </div>
              )
            })()}
          </>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════
  //  VIEW 2: HOUSE DASHBOARD
  // ══════════════════════════════════════════════════
  if (view === 'dashboard' && selectedHouse) {
    const hStudents = activeStudents.filter(s => normalizeHouse(s.house) === normalizeHouse(selectedHouse))
      .sort((a, b) => {
        const aStatus = getStatus(a.id)
        const bStatus = getStatus(b.id)
        if (aStatus === 'Unmarked' && bStatus !== 'Unmarked') return -1
        if (aStatus !== 'Unmarked' && bStatus === 'Unmarked') return 1
        return (a.name || '').localeCompare(b.name || '')
      })
    const stats = getHouseStats(selectedHouse)
    const unmarkedStudents = hStudents.filter(s => getStatus(s.id) === 'Unmarked')

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setView('houses')} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: '13px' }}>
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: mobile ? '18px' : '22px', fontWeight: '800', color: pal.color }}>
              🏠 {selectedHouse} House
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {date} · {session === 'morning' ? '🌅 Morning' : '🌙 Night'} Roll Call
            </div>
          </div>
          <button
            onClick={() => startRollCall(selectedHouse)}
            style={{ ...btn(pal.color), padding: '10px 20px', fontSize: '14px' }}
          >
            ⚡ Quick Roll Call {stats.unmarked > 0 ? `(${stats.unmarked} left)` : '✓'}
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {[
            { icon: '👥', label: 'Total', value: stats.total, color: pal.color, bg: pal.bg },
            { icon: '✅', label: 'Present', value: stats.present, color: '#16a34a', bg: '#dcfce7' },
            { icon: '❌', label: 'Absent', value: stats.absent, color: '#dc2626', bg: '#fee2e2' },
            { icon: '⏰', label: 'Late', value: stats.late, color: '#ca8a04', bg: '#fef9c3' },
            { icon: '🏥', label: 'Sick', value: stats.sick, color: '#7c3aed', bg: '#f5f3ff' },
            { icon: '🚪', label: 'On Leave', value: stats.onLeave, color: '#1d4ed8', bg: '#dbeafe' },
            { icon: '⚪', label: 'Unmarked', value: stats.unmarked, color: '#94a3b8', bg: '#f1f5f9' },
          ].map(s => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} bg={s.bg} compact />
          ))}
        </div>

        {/* Progress */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
            <span style={{ color: '#1e293b' }}>Roll Call Progress</span>
            <span style={{ color: stats.pct === 100 ? '#16a34a' : pal.color }}>{stats.marked}/{stats.total} · {stats.pct}%</span>
          </div>
          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${stats.pct}%`,
              background: stats.pct === 100 ? '#16a34a' : pal.color,
              borderRadius: '99px', transition: 'width 0.4s',
            }} />
          </div>
          {stats.pct === 100 && (
            <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700', marginTop: '8px' }}>
              🎉 All {stats.total} students marked for {selectedHouse}!
            </div>
          )}
        </div>

        {/* Quick bulk actions */}
        {stats.unmarked > 0 && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', marginBottom: '10px' }}>
              ⚡ {stats.unmarked} students still unmarked — bulk mark:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Present', 'Absent', 'On Leave'].map(status => (
                <button
                  key={status}
                  disabled={saving}
                  onClick={async () => {
                    if (window.confirm(`Mark all ${unmarkedStudents.length} unmarked students in ${selectedHouse} as ${status}?`)) {
                      await handleBulkMark(unmarkedStudents.map(s => s.id), status)
                    }
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: statusConfig[status]?.bg || '#f1f5f9',
                    color: statusConfig[status]?.color || '#374151',
                    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  }}
                >
                  {statusConfig[status]?.icon} Mark Unmarked as {status}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Student list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hStudents.map((student, i) => {
            const status = getStatus(student.id)
            const sc = statusConfig[status] || statusConfig['Unmarked']
            const isJust = justMarked === student.id
            return (
              <div
                key={student.id}
                style={{
                  background: isJust ? '#f0fdf4' : 'white',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                  borderLeft: `4px solid ${sc.color}`,
                  transition: 'background 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: mobile ? 'wrap' : 'nowrap',
                }}
              >
                {/* Rank */}
                <div style={{ fontSize: '12px', color: '#94a3b8', minWidth: '20px', fontWeight: '600' }}>{i + 1}</div>

                {/* Student info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{student.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                    GCC-{student.gcc_no || '--'} · {getStudentClass(student) || '--'}
                  </div>
                </div>

                {/* Status badge */}
                <span style={{
                  padding: '4px 10px', borderRadius: '99px', fontSize: '12px',
                  fontWeight: '700', background: sc.bg, color: sc.color,
                  whiteSpace: 'nowrap',
                }}>
                  {sc.icon} {status}
                </span>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {ATTENDANCE_TYPES.map(s => {
                    const sConf = statusConfig[s]
                    const isActive = status === s
                    return (
                      <button
                        key={s}
                        onClick={() => handleMark(student.id, s)}
                        disabled={saving}
                        title={s}
                        style={{
                          width: '34px', height: '34px',
                          borderRadius: '8px', border: 'none',
                          background: isActive ? sConf.color : '#f1f5f9',
                          color: isActive ? 'white' : '#94a3b8',
                          fontSize: '14px', fontWeight: '700',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {sConf.icon}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════
  //  VIEW 3: QUICK ROLL CALL (Card-by-card)
  // ══════════════════════════════════════════════════
  if (view === 'rollcall' && selectedHouse) {
    const total = rollCallStudents.length
    const marked = rollCallStudents.filter(s => getStatus(s.id) !== 'Unmarked').length
    const pct = total ? Math.round(marked / total * 100) : 0
    const isDone = rollCallIndex >= total

    const currentStudent = rollCallStudents[rollCallIndex]
    const currentStatus = currentStudent ? getStatus(currentStudent.id) : null

    const markAndAdvance = async (studentId, status) => {
      await handleMark(studentId, status)
      setTimeout(() => setRollCallIndex(i => i + 1), 300)
    }

    return (
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => { setView('dashboard') }} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 12px', fontSize: '13px' }}>
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '800', color: pal.color, fontSize: '16px' }}>⚡ {selectedHouse} Roll Call</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{session === 'morning' ? '🌅 Morning' : '🌙 Night'} · {date}</div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: pal.color }}>
            {Math.min(rollCallIndex + 1, total)}/{total}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct === 100 ? '#16a34a' : pal.color,
              borderRadius: '99px', transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            <span>{marked} marked</span>
            <span>{total - marked} remaining</span>
          </div>
        </div>

        {isDone ? (
          /* ── Done screen */
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
              {selectedHouse} Roll Call Complete!
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              {marked} of {total} students marked
            </div>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {['Present', 'Absent', 'Sick', 'Late', 'On Leave', 'Unmarked'].map(s => {
                const count = s === 'Unmarked'
                  ? rollCallStudents.filter(st => getStatus(st.id) === 'Unmarked').length
                  : rollCallStudents.filter(st => getStatus(st.id) === s).length
                if (count === 0 && s !== 'Present' && s !== 'Absent') return null
                const sc = statusConfig[s]
                return (
                  <div key={s} style={{ background: sc.bg, borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: sc.color }}>{count}</div>
                    <div style={{ fontSize: '12px', color: sc.color, fontWeight: '600' }}>{s}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setView('dashboard')} style={{ ...btn(pal.color), padding: '12px 24px' }}>
                View {selectedHouse} Dashboard
              </button>
              <button onClick={() => setView('houses')} style={{ ...btn('#f1f5f9', '#374151'), padding: '12px 24px' }}>
                All Houses
              </button>
            </div>
          </div>
        ) : (
          /* ── Student card */
          <div>
            {/* Navigation dots (mini) */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '2px' }}>
              {rollCallStudents.map((s, i) => {
                const st = getStatus(s.id)
                const sc = statusConfig[st] || statusConfig['Unmarked']
                return (
                  <div
                    key={s.id}
                    onClick={() => setRollCallIndex(i)}
                    title={s.name}
                    style={{
                      width: i === rollCallIndex ? '20px' : '8px',
                      height: '8px',
                      borderRadius: '99px',
                      background: i === rollCallIndex ? pal.color : sc.color,
                      opacity: i === rollCallIndex ? 1 : 0.4,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>

            {/* Main student card */}
            <div style={{
              background: 'white', borderRadius: '20px',
              padding: '28px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              border: `2px solid ${currentStatus && currentStatus !== 'Unmarked' ? statusConfig[currentStatus]?.color + '40' : '#e2e8f0'}`,
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              {/* Avatar */}
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: pal.bg, border: `3px solid ${pal.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px', fontWeight: '800', color: pal.color,
                margin: '0 auto 16px',
              }}>
                {(currentStudent.name || '?')[0].toUpperCase()}
              </div>

              <div style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', marginBottom: '6px' }}>
                {currentStudent.name}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                GCC-{currentStudent.gcc_no || '--'} · {getStudentClass(currentStudent) || '--'}
              </div>

              {/* Current status */}
              {currentStatus && currentStatus !== 'Unmarked' && (
                <div style={{
                  display: 'inline-block',
                  padding: '6px 16px', borderRadius: '99px',
                  background: statusConfig[currentStatus]?.bg,
                  color: statusConfig[currentStatus]?.color,
                  fontSize: '13px', fontWeight: '700', marginBottom: '16px',
                }}>
                  {statusConfig[currentStatus]?.icon} Marked as {currentStatus}
                </div>
              )}
            </div>

            {/* Big status buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              {[
                { status: 'Present', bg: '#16a34a', label: '✓ Present' },
                { status: 'Absent', bg: '#dc2626', label: '✕ Absent' },
              ].map(({ status, bg, label }) => (
                <button
                  key={status}
                  onClick={() => markAndAdvance(currentStudent.id, status)}
                  disabled={saving}
                  style={{
                    padding: '18px', borderRadius: '14px', border: 'none',
                    background: currentStatus === status ? bg : bg + '15',
                    color: currentStatus === status ? 'white' : bg,
                    fontSize: '16px', fontWeight: '800',
                    cursor: 'pointer', transition: 'all 0.15s',
                    minHeight: '60px',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Secondary status buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {[
                { status: 'Late', bg: '#ca8a04', label: '⏰ Late' },
                { status: 'Sick', bg: '#7c3aed', label: '🏥 Sick' },
                { status: 'On Leave', bg: '#1d4ed8', label: '🚪 Leave' },
              ].map(({ status, bg, label }) => (
                <button
                  key={status}
                  onClick={() => markAndAdvance(currentStudent.id, status)}
                  disabled={saving}
                  style={{
                    padding: '12px 8px', borderRadius: '10px', border: 'none',
                    background: currentStatus === status ? bg : bg + '15',
                    color: currentStatus === status ? 'white' : bg,
                    fontSize: '13px', fontWeight: '700',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setRollCallIndex(i => Math.max(0, i - 1))}
                disabled={rollCallIndex === 0}
                style={{ ...btn('#f1f5f9', '#374151'), padding: '10px 16px', opacity: rollCallIndex === 0 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                tap status to mark & advance
              </span>
              <button
                onClick={() => setRollCallIndex(i => Math.min(total, i + 1))}
                style={{ ...btn('#f1f5f9', '#374151'), padding: '10px 16px' }}
              >
                Skip →
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  TAB: MAINTENANCE / REPAIRS
// ══════════════════════════════════════════════════════════════
const MAINTENANCE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const MAINTENANCE_STATUSES = ['Raised', 'Assigned', 'In Progress', 'Resolved', 'Closed']
const MAINTENANCE_CATEGORIES = ['Plumbing', 'Electrical', 'Furniture', 'Civil', 'Cleaning', 'IT', 'Other']

function MaintenanceTab({ currentHousemaster, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const isHM = (currentUser?.role || '').toLowerCase() === 'house master'

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')
  const [search, setSearch] = useState('')
  const mobile = useMobileView()
  const [form, setForm] = useState({ category: 'Plumbing', location: '', room_number: '', description: '', priority: 'Medium', status: 'Raised', reported_by: '', assigned_to: '', resolved_at: '', cost: '', remarks: '' })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('maintenance_records').select('*').order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
  ...form,
  reported_by: currentHousemaster?.name || form.reported_by,
  raised_at: new Date().toISOString(),
  cost: form.cost !== '' && form.cost !== null ? Number(form.cost) : null,
}
    const { error } = await supabase.from('maintenance_records').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm({ category: 'Plumbing', location: '', room_number: '', description: '', priority: 'Medium', status: 'Raised', reported_by: '', assigned_to: '', resolved_at: '', cost: '', remarks: '' }); setShowForm(false); load() }
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    const updates = { status }
    if (status === 'Resolved') updates.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_records').update(updates).eq('id', id)
    load()
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this maintenance record?')) return
    await supabase.from('maintenance_records').delete().eq('id', id)
    load()
  }

  const filtered = useMemo(() => {
    let f = records
    if (filterStatus !== 'All') f = f.filter(r => r.status === filterStatus)
    if (filterPriority !== 'All') f = f.filter(r => r.priority === filterPriority)
    if (search) { const q = search.toLowerCase(); f = f.filter(r => (r.description || '').toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q)) }
    return f
  }, [records, filterStatus, filterPriority, search])

  const stats = {
    raised: records.filter(r => r.status === 'Raised').length,
    inProgress: records.filter(r => ['Assigned', 'In Progress'].includes(r.status)).length,
    urgent: records.filter(r => r.priority === 'Urgent' && r.status !== 'Closed').length,
    resolved: records.filter(r => r.status === 'Resolved').length,
  }

  if (mobile) {
    return (
      <div>
        <div style={mobileStatGrid}>
          <StatCard icon="📋" label="Raised" value={stats.raised} color="#1e3a5f" bg="#eff6ff" compact />
          <StatCard icon="🔧" label="In Progress" value={stats.inProgress} color="#ca8a04" bg="#fef9c3" compact />
          <StatCard icon="🚨" label="Urgent" value={stats.urgent} color="#dc2626" bg="#fee2e2" compact />
          <StatCard icon="✅" label="Resolved" value={stats.resolved} color="#16a34a" bg="#dcfce7" compact />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} type="search" />
          <button onClick={() => setShowForm(!showForm)} style={{ ...btn(), padding: '10px 14px' }}>{showForm ? '✕' : '➕'}</button>
        </div>
        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', margin: '0 0 12px' }}>🔧 New Complaint</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, flex: 1 }}>{MAINTENANCE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ ...inp, flex: 1 }}>{MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Block/Area" style={{ ...inp, flex: 1 }} />
                  <input value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} placeholder="Room No" style={{ ...inp, flex: 1 }} />
                </div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the issue..." required style={{ ...inp, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#dc2626'), flex: 1 }}>{saving ? '⏳' : '✓ Raise'}</button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        )}
        <MobileCardList>
          {filtered.map(r => (
            <MobileRecordCard key={r.id} accentColor={r.priority === 'Urgent' ? '#dc2626' : r.priority === 'High' ? '#ca8a04' : '#1e3a5f'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div><span style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', background: '#eff6ff', padding: '2px 8px', borderRadius: '99px' }}>{r.category}</span><span style={{ marginLeft: '6px', ...statusStyle(r.priority) }}>{r.priority}</span></div>
                <span style={statusStyle(r.status)}>{r.status}</span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>📍 {r.location}{r.room_number ? ` · Room ${r.room_number}` : ''}</div>
              <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>{r.description}</div>
              {r.status !== 'Closed' && r.status !== 'Resolved' && (
                <MobileActionButtons actions={[
                  ...(r.status === 'Raised' ? [{ label: 'Assign', onClick: () => handleStatusChange(r.id, 'Assigned'), bg: '#dbeafe', color: '#1d4ed8' }] : []),
                  ...(r.status === 'Assigned' ? [{ label: 'Start Work', onClick: () => handleStatusChange(r.id, 'In Progress'), bg: '#fef9c3', color: '#ca8a04' }] : []),
                  ...(r.status === 'In Progress' ? [{ label: 'Resolve', onClick: () => handleStatusChange(r.id, 'Resolved'), bg: '#dcfce7', color: '#16a34a' }] : []),
                  { label: 'Close', onClick: () => handleStatusChange(r.id, 'Closed'), bg: '#e5e7eb', color: '#374151' },
                ]} />
              )}
            </MobileRecordCard>
          ))}
        </MobileCardList>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No maintenance records</div>}
      </div>
    )
  }

  return (
    <div>
      <div style={statGrid(130)}>
        <StatCard icon="📋" label="Raised" value={stats.raised} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="🔧" label="In Progress" value={stats.inProgress} color="#ca8a04" bg="#fef9c3" />
        <StatCard icon="🚨" label="Urgent Open" value={stats.urgent} color="#dc2626" bg="#fee2e2" />
        <StatCard icon="✅" label="Resolved" value={stats.resolved} color="#16a34a" bg="#dcfce7" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search location, issue..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 'auto' }}><option value="All">All Status</option>{MAINTENANCE_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...inp, width: 'auto' }}><option value="All">All Priority</option>{MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={btn()}>{showForm ? '✖ Cancel' : '➕ Raise Complaint'}</button>
      </div>
      {showForm && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>🔧 New Maintenance Request</h3>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div><label style={lbl}>Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>{MAINTENANCE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>Priority</label><select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inp}>{MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
              <div><label style={lbl}>Location/Block *</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required placeholder="e.g. Block A" style={inp} /></div>
              <div><label style={lbl}>Room Number</label><input value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} placeholder="101" style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Description *</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required rows={3} placeholder="Describe the issue in detail..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div><label style={lbl}>Assigned To</label><input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Staff name" style={inp} /></div>
              <div><label style={lbl}>Estimated Cost</label><input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#dc2626')}>{saving ? '⏳ Saving...' : '✅ Raise Ticket'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      {loading ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div> : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 900 }}>
            <thead><tr style={{ background: '#1e3a5f' }}>{['#', 'Category', 'Priority', 'Location', 'Room', 'Description', 'Status', 'Assigned', 'Raised', 'Actions'].map(h => <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '11px 14px', fontWeight: '600', color: '#1e3a5f' }}>{r.category}</td>
                  <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.priority)}>{r.priority}</span></td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.location}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontFamily: 'monospace' }}>{r.room_number || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>{r.description}</div></td>
                  <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.status)}>{r.status}</span></td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.assigned_to || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{r.raised_at ? new Date(r.raised_at).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {r.status === 'Raised' && <button onClick={() => handleStatusChange(r.id, 'Assigned')} style={{ ...btn('#1d4ed8'), fontSize: '11px', padding: '4px 8px' }}>Assign</button>}
                      {r.status === 'Assigned' && <button onClick={() => handleStatusChange(r.id, 'In Progress')} style={{ ...btn('#ca8a04'), fontSize: '11px', padding: '4px 8px' }}>Start</button>}
                      {r.status === 'In Progress' && <button onClick={() => handleStatusChange(r.id, 'Resolved')} style={{ ...btn('#16a34a'), fontSize: '11px', padding: '4px 8px' }}>Resolve</button>}
                      {r.status === 'Resolved' && <button onClick={() => handleStatusChange(r.id, 'Closed')} style={{ ...btn('#374151'), fontSize: '11px', padding: '4px 8px' }}>Close</button>}
                      {isAdmin && <button onClick={() => handleDelete(r.id)} style={{ ...btn('#fee2e2', '#dc2626'), fontSize: '11px', padding: '4px 8px' }}>🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: HOUSEMASTER DASHBOARD
// ══════════════════════════════════════════════════════════════
function HMDashboard({ students, staffProfiles, currentHousemaster }) {
  const [attendanceToday, setAttendanceToday] = useState([])
  const [leaveToday, setLeaveToday] = useState([])
  const [sickbayToday, setSickbayToday] = useState([])
  const [maintenanceOpen, setMaintenanceOpen] = useState([])
  const [disciplineOpen, setDisciplineOpen] = useState([])
  const [nightDutyTonight, setNightDutyTonight] = useState(null)
  const [loading, setLoading] = useState(true)
  const mobile = useMobileView()

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true)
      const todayStr = today()
      const [a, l, s, m, d, n] = await Promise.all([
        supabase.from('attendance_records').select('*').eq('date', todayStr).eq('session', 'morning'),
        supabase.from('leave_records').select('*').eq('from_date', todayStr).in('status', ['Approved', 'Pending']),
        supabase.from('sickbay_records').select('*').eq('status', 'Admitted'),
        supabase.from('maintenance_records').select('*').in('status', ['Raised', 'Assigned', 'In Progress']).eq('priority', 'Urgent'),
        supabase.from('discipline_records').select('*').in('status', ['Open', 'In Progress']),
        supabase.from('night_duty').select('*').eq('date', todayStr).single(),
      ])
      setAttendanceToday(a.data || [])
      setLeaveToday(l.data || [])
      setSickbayToday(s.data || [])
      setMaintenanceOpen(m.data || [])
      setDisciplineOpen(d.data || [])
      setNightDutyTonight(n.data)
      setLoading(false)
    }
    loadDashboard()
  }, [])

  const presentCount = attendanceToday.filter(r => r.status === 'Present').length
  const absentCount = attendanceToday.filter(r => r.status === 'Absent').length
  const unmarkedCount = students.filter(s => s.status !== 'Inactive').length - attendanceToday.length

  const quickActions = [
    { id: 'attendance', label: '✓ Roll Call', icon: '✓', color: '#16a34a', bg: '#dcfce7', desc: `${presentCount}/${students.length} marked` },
    { id: 'leave', label: '🚪 Leave', icon: '🚪', color: '#1d4ed8', bg: '#dbeafe', desc: `${leaveToday.length} requests` },
    { id: 'sickbay', label: '🏥 Sickbay', icon: '🏥', color: '#7c3aed', bg: '#f5f3ff', desc: `${sickbayToday.length} admitted` },
    { id: 'discipline', label: '⚠️ Discipline', icon: '⚠️', color: '#dc2626', bg: '#fee2e2', desc: `${disciplineOpen.length} open` },
    { id: 'maintenance', label: '🔧 Repairs', icon: '🔧', color: '#ca8a04', bg: '#fef9c3', desc: `${maintenanceOpen.length} urgent` },
    { id: 'journal', label: '📝 Journal', icon: '📝', color: '#1e3a5f', bg: '#eff6ff', desc: 'Daily notes' },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>⏳ Loading dashboard...</div>

  if (mobile) {
    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>👋 Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>{currentHousemaster?.name || 'House Master'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        {nightDutyTonight && (
          <div style={{ ...mobileCard, marginBottom: '16px', background: '#1e3a5f', color: 'white' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', opacity: 0.8 }}>🌙 TONIGHT'S DUTY</div>
            <div style={{ fontSize: '16px', fontWeight: '700' }}>{nightDutyTonight.staff1}{nightDutyTonight.staff2 ? ` & ${nightDutyTonight.staff2}` : ''}</div>
            <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.8 }}>{nightDutyTonight.shift} · {nightDutyTonight.post}</div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          {quickActions.map(action => (
            <button key={action.id} style={{ background: action.bg, border: `1.5px solid ${action.color}20`, borderRadius: '14px', padding: '16px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '90px' }}>
              <span style={{ fontSize: '24px' }}>{action.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: action.color }}>{action.label}</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{action.desc}</span>
            </button>
          ))}
        </div>
        <div style={{ ...mobileCard }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 12px' }}>📊 Today's Snapshot</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[{ label: 'Present', value: presentCount, color: '#16a34a', bg: '#dcfce7' }, { label: 'Absent', value: absentCount, color: '#dc2626', bg: '#fee2e2' }, { label: 'On Leave', value: leaveToday.length, color: '#1d4ed8', bg: '#dbeafe' }, { label: 'In Sickbay', value: sickbayToday.length, color: '#7c3aed', bg: '#f5f3ff' }].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '12px', background: s.bg, borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>👋 Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {currentHousemaster?.name || 'House Master'}</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        {nightDutyTonight && (
          <div style={{ background: '#1e3a5f', color: 'white', padding: '12px 20px', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>🌙 TONIGHT'S DUTY</div>
            <div style={{ fontSize: '16px', fontWeight: '700' }}>{nightDutyTonight.staff1}{nightDutyTonight.staff2 ? ` & ${nightDutyTonight.staff2}` : ''}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{nightDutyTonight.shift} · {nightDutyTonight.post}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {quickActions.map(action => (
          <div key={action.id} style={{ background: action.bg, borderRadius: '14px', padding: '20px', border: `1.5px solid ${action.color}20`, cursor: 'pointer' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{action.icon}</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: action.color, marginBottom: '4px' }}>{action.label}</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>{action.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 16px' }}>📊 Today's Snapshot</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[{ label: 'Present', value: presentCount, color: '#16a34a', bg: '#dcfce7' }, { label: 'Absent', value: absentCount, color: '#dc2626', bg: '#fee2e2' }, { label: 'On Leave', value: leaveToday.length, color: '#1d4ed8', bg: '#dbeafe' }, { label: 'In Sickbay', value: sickbayToday.length, color: '#7c3aed', bg: '#f5f3ff' }].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '16px', background: s.bg, borderRadius: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 16px' }}>🚨 Attention Required</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unmarkedCount > 0 && <div style={{ padding: '12px', background: '#fef9c3', borderRadius: '10px', borderLeft: '3px solid #ca8a04' }}><div style={{ fontWeight: '700', color: '#ca8a04' }}>⏳ {unmarkedCount} students unmarked</div><div style={{ fontSize: '13px', color: '#64748b' }}>Morning roll call pending</div></div>}
            {maintenanceOpen.map(m => <div key={m.id} style={{ padding: '12px', background: '#fee2e2', borderRadius: '10px', borderLeft: '3px solid #dc2626' }}><div style={{ fontWeight: '700', color: '#dc2626' }}>🔧 Urgent: {m.category}</div><div style={{ fontSize: '13px', color: '#374151' }}>{m.location} · {m.description}</div></div>)}
            {disciplineOpen.slice(0, 3).map(d => <div key={d.id} style={{ padding: '12px', background: '#fee2e2', borderRadius: '10px', borderLeft: '3px solid #dc2626' }}><div style={{ fontWeight: '700', color: '#dc2626' }}>⚠️ {d.student_name}</div><div style={{ fontSize: '13px', color: '#374151' }}>{d.incident}</div></div>)}
            {unmarkedCount === 0 && maintenanceOpen.length === 0 && disciplineOpen.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#16a34a', fontWeight: '600' }}>✅ All clear! No urgent items.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: HOUSEMASTER JOURNAL
// ══════════════════════════════════════════════════════════════
function JournalTab({ currentHousemaster }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(today())
  const [search, setSearch] = useState('')
  const mobile = useMobileView()
  const JOURNAL_CATEGORIES = ['General', 'Assembly', 'Discipline', 'Medical', 'Maintenance', 'Parent Call', 'Staff Handover', 'Inspection', 'Event']
  const [form, setForm] = useState({ entry_date: today(), entry_time: nowTime(), category: 'General', title: '', content: '', house: '', flagged: false })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('housemaster_journal').select('*').order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('housemaster_journal').insert([{ ...form, housemaster_name: currentHousemaster?.name || 'Unknown' }])
    if (error) alert('Error: ' + error.message)
    else { setForm({ entry_date: today(), entry_time: nowTime(), category: 'General', title: '', content: '', house: '', flagged: false }); setShowForm(false); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this journal entry?')) return
    await supabase.from('housemaster_journal').delete().eq('id', id)
    load()
  }

  const filtered = useMemo(() => {
    let f = entries
    if (date) f = f.filter(e => e.entry_date === date)
    if (search) { const q = search.toLowerCase(); f = f.filter(e => (e.title || '').toLowerCase().includes(q) || (e.content || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q)) }
    return f
  }, [entries, date, search])

  const categoryColors = { General: '#1e3a5f', Assembly: '#16a34a', Discipline: '#dc2626', Medical: '#7c3aed', Maintenance: '#ca8a04', 'Parent Call': '#1d4ed8', 'Staff Handover': '#0891b2', Inspection: '#374151', Event: '#059669' }

  if (mobile) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, flex: 1 }} />
          <button onClick={() => setShowForm(!showForm)} style={{ ...btn(), padding: '10px 14px' }}>{showForm ? '✕' : '📝'}</button>
        </div>
        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} required style={{ ...inp, flex: 1 }} />
                  <input type="time" value={form.entry_time} onChange={e => setForm(f => ({ ...f, entry_time: e.target.value }))} style={{ ...inp, flex: 1 }} />
                </div>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>{JOURNAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Entry title..." required style={inp} />
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} placeholder="Write your notes here..." required style={{ ...inp, resize: 'vertical' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151' }}><input type="checkbox" checked={form.flagged} onChange={e => setForm(f => ({ ...f, flagged: e.target.checked }))} style={{ width: '20px', height: '20px' }} />🚩 Flag as important</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#1e3a5f'), flex: 1 }}>{saving ? '⏳' : '✓ Save'}</button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        )}
        <MobileCardList>
          {filtered.map(e => (
            <MobileRecordCard key={e.id} accentColor={categoryColors[e.category] || '#1e3a5f'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', background: (categoryColors[e.category] || '#1e3a5f') + '15', color: categoryColors[e.category] || '#1e3a5f' }}>{e.category}</span>
                  {e.flagged && <span style={{ fontSize: '16px' }}>🚩</span>}
                </div>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{e.entry_time}</span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>{e.title}</div>
              <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{e.content}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📝 {e.housemaster_name}</span>
                <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>🗑 Delete</button>
              </div>
            </MobileRecordCard>
          ))}
        </MobileCardList>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}><div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>No journal entries for {date}</div>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <input placeholder="🔍 Search entries..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
        </div>
        <button onClick={() => setShowForm(!showForm)} style={btn()}>{showForm ? '✖ Cancel' : '📝 New Entry'}</button>
      </div>
      {showForm && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>📝 New Journal Entry</h3>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div><label style={lbl}>Date *</label><input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Time</label><input type="time" value={form.entry_time} onChange={e => setForm(f => ({ ...f, entry_time: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>{JOURNAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>House (if specific)</label><input value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} placeholder="Leave blank for general" style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Short summary..." style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Content *</label><textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required rows={5} placeholder="Detailed notes..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151', cursor: 'pointer' }}><input type="checkbox" checked={form.flagged} onChange={e => setForm(f => ({ ...f, flagged: e.target.checked }))} />🚩 Flag as important</label></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save Entry'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filtered.map(e => (
          <div key={e.id} style={{ background: 'white', borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${categoryColors[e.category] || '#1e3a5f'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '99px', background: (categoryColors[e.category] || '#1e3a5f') + '15', color: categoryColors[e.category] || '#1e3a5f' }}>{e.category}</span>
                {e.flagged && <span style={{ fontSize: '16px' }}>🚩</span>}
                <span style={{ fontSize: '13px', color: '#64748b' }}>{e.entry_date} · {e.entry_time}</span>
              </div>
              <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>🗑 Delete</button>
            </div>
            <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px' }}>{e.title}</h4>
            <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{e.content}</p>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px' }}>📝 {e.housemaster_name} {e.house && `· 🏠 ${e.house}`}</div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}><div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div><div style={{ fontSize: '16px', fontWeight: '600' }}>No journal entries found</div></div>}
      </div>
    </div>
  )
}
//  TAB 1 — Day Scholar Student Records
// ══════════════════════════════════════════════════════════════
const emptyDayScholar = {
  student_id: null, gcc_no: '', student_name: '', class_name: '',
  parent_name: '', parent_phone: '', address: '',
  transport_route: '', vehicle_number: '',
  pickup_point: '', drop_point: '',
  admission_date: today(), status: 'Active',
  remarks: '',
}

function DayScholarTab({ students }) {
  const [records,      setRecords]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editRec,      setEditRec]      = useState(null)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [routeFilter,  setRouteFilter]  = useState('All')
  const [form,         setForm]         = useState(emptyDayScholar)
  const mobile = useMobileView()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('day_scholar_records').select('*').order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleStudentSelect = s => {
    setForm(f => ({
      ...f,
      student_id: s.id,
      gcc_no: s.gcc_no || '',
      student_name: s.name || '',
      class_name: getStudentClass(s),
    }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      student_id: form.student_id || null,
      gcc_no: form.gcc_no || null,
      student_name: form.student_name,
      class_name: form.class_name,
      parent_name: form.parent_name,
      parent_phone: form.parent_phone,
      address: form.address,
      transport_route: form.transport_route,
      vehicle_number: form.vehicle_number,
      pickup_point: form.pickup_point,
      drop_point: form.drop_point,
      admission_date: form.admission_date,
      status: form.status,
      remarks: form.remarks,
    }
    const { error } = editRec
      ? await supabase.from('day_scholar_records').update(payload).eq('id', editRec.id)
      : await supabase.from('day_scholar_records').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyDayScholar); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this day scholar record?')) return
    await supabase.from('day_scholar_records').delete().eq('id', id)
    load()
  }

  const openEdit = rec => {
    setEditRec(rec)
    setForm({ ...emptyDayScholar, ...rec })
    setShowForm(true)
  }

  const uniqueRoutes = [...new Set(records.map(r => r.transport_route).filter(Boolean))]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r =>
      (statusFilter === 'All' || r.status === statusFilter) &&
      (routeFilter === 'All' || r.transport_route === routeFilter) &&
      [r.student_name, r.class_name, r.gcc_no, r.parent_name, r.parent_phone, r.transport_route, r.pickup_point, r.address]
        .some(v => (v || '').toLowerCase().includes(q))
    )
  }, [records, search, statusFilter, routeFilter])

  const active   = records.filter(r => r.status === 'Active').length
  const inactive = records.filter(r => r.status === 'Inactive').length
  const withTransport = records.filter(r => r.transport_route).length

  // ── Supabase migration helper (run once)
  const createTableSQL = `
create table if not exists day_scholar_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  gcc_no text,
  student_name text not null,
  class_name text,
  parent_name text,
  parent_phone text,
  address text,
  transport_route text,
  vehicle_number text,
  pickup_point text,
  drop_point text,
  admission_date date,
  status text default 'Active',
  remarks text,
  created_at timestamptz default now()
);`

  if (mobile) {
    return (
      <div>
        <div style={mobileStatGrid}>
          <StatCard icon="📋" label="Total" value={records.length} color="#1e3a5f" bg="#eff6ff" compact />
          <StatCard icon="✅" label="Active" value={active} color="#16a34a" bg="#dcfce7" compact />
          <StatCard icon="🚌" label="With Transport" value={withTransport} color="#7c3aed" bg="#f5f3ff" compact />
          <StatCard icon="⏸" label="Inactive" value={inactive} color="#dc2626" bg="#fee2e2" compact />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input placeholder="🔍 Search name, route..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} type="search" />
          <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyDayScholar) }} style={{ ...btn(), padding: '10px 14px' }}>{showForm ? '✕' : '➕'}</button>
        </div>
        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', margin: '0 0 12px' }}>{editRec ? '✏️ Edit Record' : '➕ New Day Scholar'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={lbl}>Search Student</label>
                  <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                  {form.student_id && <div style={{ marginTop: 6, padding: '6px 10px', background: '#dcfce7', borderRadius: 6, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✅ {form.student_name}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} placeholder="Student Name *" required style={{ ...inp, flex: 1 }} />
                  <input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} placeholder="Class/Batch" style={{ ...inp, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} placeholder="Parent Name" style={{ ...inp, flex: 1 }} />
                  <input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} placeholder="Phone" style={{ ...inp, flex: 1 }} />
                </div>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Home Address" style={inp} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.transport_route} onChange={e => setForm(f => ({ ...f, transport_route: e.target.value }))} placeholder="Route (e.g. Route 1)" style={{ ...inp, flex: 1 }} />
                  <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="Vehicle No." style={{ ...inp, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.pickup_point} onChange={e => setForm(f => ({ ...f, pickup_point: e.target.value }))} placeholder="Pickup Point" style={{ ...inp, flex: 1 }} />
                  <input value={form.drop_point} onChange={e => setForm(f => ({ ...f, drop_point: e.target.value }))} placeholder="Drop Point" style={{ ...inp, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="date" value={form.admission_date} onChange={e => setForm(f => ({ ...f, admission_date: e.target.value }))} style={{ ...inp, flex: 1 }} />
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...inp, flex: 1 }}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </div>
                <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Remarks..." rows={2} style={{ ...inp, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#1e3a5f'), flex: 1 }}>{saving ? '⏳' : '✓ Save'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        )}
        <MobileCardList>
          {filtered.map(r => (
            <MobileRecordCard key={r.id} accentColor={r.status === 'Active' ? '#16a34a' : '#94a3b8'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{r.student_name}</div>
                <span style={statusStyle(r.status)}>{r.status}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                {r.gcc_no ? `GCC-${r.gcc_no}` : '—'} · {r.class_name || '—'}
              </div>
              {r.parent_name && <div style={{ fontSize: '12px', color: '#374151' }}>👨‍👩‍👦 {r.parent_name} {r.parent_phone ? `· 📞 ${r.parent_phone}` : ''}</div>}
              {r.transport_route && <div style={{ fontSize: '12px', color: '#7c3aed', marginTop: '4px' }}>🚌 {r.transport_route} {r.pickup_point ? `· 📍 ${r.pickup_point}` : ''}</div>}
              <MobileActionButtons actions={[
                { label: '✏️ Edit', onClick: () => openEdit(r), bg: '#eff6ff', color: '#1e3a5f' },
                { label: '🗑 Delete', onClick: () => handleDelete(r.id), bg: '#fee2e2', color: '#dc2626' },
              ]} />
            </MobileRecordCard>
          ))}
        </MobileCardList>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No day scholar records found</div>}
      </div>
    )
  }

  return (
    <div>
      <div style={statGrid()}>
        <StatCard icon="📋" label="Total Day Scholars" value={records.length} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="✅" label="Active" value={active} color="#16a34a" bg="#dcfce7" />
        <StatCard icon="🚌" label="With Transport" value={withTransport} color="#7c3aed" bg="#f5f3ff" />
        <StatCard icon="⏸" label="Inactive" value={inactive} color="#dc2626" bg="#fee2e2" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search student, route, parent..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 180 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            <option>Active</option><option>Inactive</option>
          </select>
          <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Routes</option>
            {uniqueRoutes.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyDayScholar) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Add Day Scholar'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '4px' }}>
            {editRec ? '✏️ Edit Day Scholar Record' : '➕ New Day Scholar Record'}
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>🔗 Link to a student from the Students module or enter manually</p>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>🔍 Search & Link Student</label>
                <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                {form.student_id && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#dcfce7', borderRadius: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    ✅ Linked: {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                  </div>
                )}
              </div>
              <div><label style={lbl}>GCC No. <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Student Name *</label><input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Batch / Class</label><input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Admission Date</label><input type="date" value={form.admission_date} onChange={e => setForm(f => ({ ...f, admission_date: e.target.value }))} style={inp} /></div>

              <div style={{ gridColumn: '1/-1', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>👨‍👩‍👦 Parent / Guardian Details</div>
              </div>
              <div><label style={lbl}>Parent Name</label><input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} placeholder="Father/Mother/Guardian" style={inp} /></div>
              <div><label style={lbl}>Parent Phone</label><input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} placeholder="10-digit mobile" style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Home Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>

              <div style={{ gridColumn: '1/-1', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>🚌 Transport Details</div>
              </div>
              <div><label style={lbl}>Route</label><input value={form.transport_route} onChange={e => setForm(f => ({ ...f, transport_route: e.target.value }))} placeholder="Route 1 / Khangabok" style={inp} /></div>
              <div><label style={lbl}>Vehicle Number</label><input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="MN01 AB 1234" style={inp} /></div>
              <div><label style={lbl}>Pickup Point</label><input value={form.pickup_point} onChange={e => setForm(f => ({ ...f, pickup_point: e.target.value }))} placeholder="e.g. Market Junction" style={inp} /></div>
              <div><label style={lbl}>Drop Point</label><input value={form.drop_point} onChange={e => setForm(f => ({ ...f, drop_point: e.target.value }))} placeholder="e.g. Gate No. 2" style={inp} /></div>

              <div><label style={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}><option>Active</option><option>Inactive</option></select></div>
              <div><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save Record'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'GCC', 'Student', 'Class', 'Parent', 'Phone', 'Route', 'Pickup', 'Vehicle', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{r.gcc_no ? `GCC-${r.gcc_no}` : '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.student_name}</div>
                      {r.student_id && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.class_name || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#374151' }}>{r.parent_name || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{r.parent_phone || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {r.transport_route
                        ? <span style={{ padding: '2px 8px', borderRadius: 99, background: '#f5f3ff', color: '#7c3aed', fontSize: 11, fontWeight: 700 }}>🚌 {r.transport_route}</span>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{r.pickup_point || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>{r.vehicle_number || '—'}</td>
                    <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.status)}>{r.status}</span></td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(r)} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                        <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No day scholar records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }

      {/* SQL hint for first setup */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>🛠 First time? Show Supabase table SQL</summary>
        <pre style={{ marginTop: 8, background: '#1e293b', color: '#e2e8f0', padding: '14px', borderRadius: 10, fontSize: 11, overflow: 'auto' }}>{createTableSQL}</pre>
      </details>
    </div>
  )
}
// ─── Default activity templates ───────────────────────────────
const DEFAULT_HOSTEL_ACTIVITIES = {
  weekday: [
    { no: 1,  from: '5:30 AM',  to: '6:00 AM',  activity: 'Wake Up Bell & Morning PT',      category: 'Routine' },
    { no: 2,  from: '6:00 AM',  to: '6:45 AM',  activity: 'PT / Exercise / Sports',          category: 'Physical' },
    { no: 3,  from: '6:45 AM',  to: '7:30 AM',  activity: 'Bath & Morning Routine',           category: 'Routine' },
    { no: 4,  from: '7:30 AM',  to: '8:00 AM',  activity: 'Morning Assembly & Roll Call',    category: 'Assembly' },
    { no: 5,  from: '8:00 AM',  to: '8:45 AM',  activity: 'Breakfast',                       category: 'Meals' },
    { no: 6,  from: '9:00 AM',  to: '1:00 PM',  activity: 'Academic Classes',                category: 'Academic' },
    { no: 7,  from: '1:00 PM',  to: '2:00 PM',  activity: 'Lunch Break',                     category: 'Meals' },
    { no: 8,  from: '2:00 PM',  to: '5:00 PM',  activity: 'Academic Classes',                category: 'Academic' },
    { no: 9,  from: '5:00 PM',  to: '5:30 PM',  activity: 'Tea Break',                       category: 'Meals' },
    { no: 10, from: '5:30 PM',  to: '7:00 PM',  activity: 'Recreation / Sports',             category: 'Physical' },
    { no: 11, from: '7:00 PM',  to: '8:00 PM',  activity: 'Dinner',                          category: 'Meals' },
    { no: 12, from: '8:00 PM',  to: '10:00 PM', activity: 'Doubt Class / Assignment',        category: 'Academic' },
    { no: 13, from: '10:00 PM', to: '',         activity: 'Lights Out',                      category: 'Routine' },
  ],
  sunday: [
    { no: 1, from: '6:00 AM',  to: '7:00 AM',  activity: 'Wake Up & Morning Routine',        category: 'Routine' },
    { no: 2, from: '7:00 AM',  to: '8:00 AM',  activity: 'Breakfast',                        category: 'Meals' },
    { no: 3, from: '8:00 AM',  to: '12:00 PM', activity: 'Recreation / Free Time',           category: 'Physical' },
    { no: 4, from: '12:00 PM', to: '1:00 PM',  activity: 'Lunch',                            category: 'Meals' },
    { no: 5, from: '1:00 PM',  to: '5:00 PM',  activity: 'Rest / Recreation',                category: 'Physical' },
    { no: 6, from: '5:00 PM',  to: '5:30 PM',  activity: 'Tea Break',                        category: 'Meals' },
    { no: 7, from: '7:00 PM',  to: '8:00 PM',  activity: 'Dinner',                           category: 'Meals' },
    { no: 8, from: '8:00 PM',  to: '9:30 PM',  activity: 'Academic Review / Self Study',     category: 'Academic' },
    { no: 9, from: '10:00 PM', to: '',         activity: 'Lights Out',                       category: 'Routine' },
  ],
  holiday: [
    { no: 1, from: '6:30 AM',  to: '7:30 AM',  activity: 'Wake Up & Morning Routine',        category: 'Routine' },
    { no: 2, from: '7:30 AM',  to: '8:30 AM',  activity: 'Breakfast',                        category: 'Meals' },
    { no: 3, from: '8:30 AM',  to: '12:00 PM', activity: 'Holiday Activities / Excursion',   category: 'Special' },
    { no: 4, from: '12:00 PM', to: '1:00 PM',  activity: 'Lunch',                            category: 'Meals' },
    { no: 5, from: '1:00 PM',  to: '5:00 PM',  activity: 'Free Time / Cultural Activities',  category: 'Special' },
    { no: 6, from: '5:00 PM',  to: '5:30 PM',  activity: 'Tea Break',                        category: 'Meals' },
    { no: 7, from: '7:00 PM',  to: '8:00 PM',  activity: 'Dinner',                           category: 'Meals' },
    { no: 8, from: '8:00 PM',  to: '9:00 PM',  activity: 'Evening Study Hour',               category: 'Academic' },
    { no: 9, from: '10:00 PM', to: '',         activity: 'Lights Out',                       category: 'Routine' },
  ],
}

const ACTIVITY_CATEGORIES = ['Routine', 'Physical', 'Assembly', 'Meals', 'Academic', 'Special', 'Other']

const CATEGORY_STYLE = {
  Routine:  { color: '#0891b2', bg: '#e0f2fe' },
  Physical: { color: '#16a34a', bg: '#dcfce7' },
  Assembly: { color: '#7c3aed', bg: '#f5f3ff' },
  Meals:    { color: '#ca8a04', bg: '#fef9c3' },
  Academic: { color: '#1d4ed8', bg: '#dbeafe' },
  Special:  { color: '#be185d', bg: '#fce7f3' },
  Other:    { color: '#374151', bg: '#f1f5f9' },
}

const SCHED_STORAGE_KEY = 'gnsi_hostel_activities_v2'
const CHECK_KEY         = () => 'gnsi_sched_check_' + todayKey()

function loadActivities() {
  try {
    const saved = localStorage.getItem(SCHED_STORAGE_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_HOSTEL_ACTIVITIES
  } catch { return DEFAULT_HOSTEL_ACTIVITIES }
}
function saveActivities(obj) {
  try { localStorage.setItem(SCHED_STORAGE_KEY, JSON.stringify(obj)) } catch {}
}
function loadChecks() {
  try { return JSON.parse(localStorage.getItem(CHECK_KEY()) || '{}') } catch { return {} }
}
function saveChecks(obj) {
  try { localStorage.setItem(CHECK_KEY(), JSON.stringify(obj)) } catch {}
}

function ScheduleTab() {
  const TYPE_TABS = [
    { id: 'weekday', label: '📅 Mon–Sat' },
    { id: 'sunday',  label: '🌿 Sunday' },
    { id: 'holiday', label: '🎉 Holiday' },
  ]

  const [type,      setType]      = useState('weekday')
  const [schedule,  setSchedule]  = useState(loadActivities)
  const [checked,   setChecked]   = useState(loadChecks)
  const [adminMode, setAdminMode] = useState(false)
  const [addForm,   setAddForm]   = useState(false)
  const [editRow,   setEditRow]   = useState(null)
  const [catFilter, setCatFilter] = useState('All')
  const [newRow,    setNewRow]    = useState({ from: '', to: '', activity: '', category: 'Routine' })
  const mobile = useMobileView()

  // Persist on every schedule change
  useEffect(() => { saveActivities(schedule) }, [schedule])

  const rows    = schedule[type] || []
  const visible = catFilter === 'All' ? rows : rows.filter(r => r.category === catFilter)
  const done    = rows.filter(r => checked[`${type}_${r.no}`]).length
  const pct     = rows.length ? Math.round(done / rows.length * 100) : 0
  const todayDayType = (() => {
    const day = new Date().getDay()
    if (day === 0) return 'sunday'
    return 'weekday'
  })()

  const toggle = no => {
    const k    = `${type}_${no}`
    const next = { ...checked, [k]: !checked[k] }
    setChecked(next); saveChecks(next)
  }

  const saveEdit = no => {
    const fromEl = document.getElementById(`se-from-${no}`)
    const toEl   = document.getElementById(`se-to-${no}`)
    const actEl  = document.getElementById(`se-act-${no}`)
    const catEl  = document.getElementById(`se-cat-${no}`)
    setSchedule(s => ({
      ...s,
      [type]: s[type].map(r => r.no === no ? {
        ...r,
        from: fromEl?.value || r.from,
        to:   toEl?.value   || r.to,
        activity: actEl?.value || r.activity,
        category: catEl?.value || r.category,
      } : r),
    }))
    setEditRow(null)
  }

  const deleteRow = no => {
    if (!window.confirm('Remove this activity?')) return
    setSchedule(s => ({ ...s, [type]: s[type].filter(r => r.no !== no) }))
  }

  const addRow = () => {
    if (!newRow.from || !newRow.activity) { alert('From time and activity name are required'); return }
    const maxNo = rows.length ? Math.max(...rows.map(r => r.no)) : 0
    setSchedule(s => ({
      ...s,
      [type]: [...s[type], { no: maxNo + 1, ...newRow }],
    }))
    setNewRow({ from: '', to: '', activity: '', category: 'Routine' })
    setAddForm(false)
  }

  const resetToDefault = () => {
    if (!window.confirm(`Reset ${type} schedule to default? All custom activities will be lost.`)) return
    setSchedule(s => ({ ...s, [type]: DEFAULT_HOSTEL_ACTIVITIES[type] }))
  }

  const actIcon = a => {
    if (a.includes('PT') || a.includes('Exercise') || a.includes('Sports')) return '🏃'
    if (a.includes('Doubt') || a.includes('Assignment') || a.includes('Study')) return '📖'
    if (a.includes('Lunch') || a.includes('Dinner') || a.includes('Breakfast')) return '🍽️'
    if (a.includes('Academic') || a.includes('Class')) return '🏫'
    if (a.includes('Tea')) return '☕'
    if (a.includes('Recreation') || a.includes('Free')) return '⚽'
    if (a.includes('Wake') || a.includes('Bell')) return '🔔'
    if (a.includes('Assembly') || a.includes('Roll')) return '🎌'
    if (a.includes('Lights')) return '💡'
    if (a.includes('Bath') || a.includes('Routine')) return '🚿'
    if (a.includes('Rest')) return '😴'
    if (a.includes('Holiday') || a.includes('Excursion')) return '🎉'
    if (a.includes('Cultural')) return '🎭'
    return '•'
  }

  const catStyle = cat => CATEGORY_STYLE[cat] || CATEGORY_STYLE['Other']

  return (
    <div>
      {/* Header with mode indicator */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px', flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>🏠 Hostel Daily Activities</h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0' }}>
            Today is a <strong style={{ color: todayDayType === 'sunday' ? '#16a34a' : '#1d4ed8' }}>
              {todayDayType === 'sunday' ? 'Sunday / Rest Day' : 'Weekday'}
            </strong> · Tracking {rows.length} activities
          </p>
        </div>
        <button
          onClick={() => setAdminMode(m => !m)}
          style={{
            ...btn(adminMode ? '#dc2626' : '#f1f5f9', adminMode ? 'white' : '#374151'),
            fontSize: '12px', padding: '8px 14px',
          }}
        >
          {adminMode ? '🔓 Admin Mode ON' : '🔒 Admin Mode'}
        </button>
      </div>

      {/* Schedule type tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', padding: '6px', borderRadius: '12px' }}>
        {TYPE_TABS.map(t => (
          <button key={t.id} onClick={() => { setType(t.id); setCatFilter('All') }} style={{
            flex: 1, padding: '9px 10px', border: 'none', borderRadius: '8px',
            background: type === t.id ? '#1e3a5f' : 'transparent',
            color: type === t.id ? 'white' : '#64748b',
            cursor: 'pointer', fontSize: '13px',
            fontWeight: type === t.id ? 700 : 500,
            transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Progress tracker */}
      <div style={{
        background: '#1e3a5f', borderRadius: '14px', padding: '16px 20px',
        marginBottom: '16px', color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', opacity: 0.8 }}>TODAY'S ACTIVITY PROGRESS</div>
            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: pct === 100 ? '#4ade80' : '#60a5fa' }}>{pct}%</div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>{done} / {rows.length} done</div>
          </div>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: pct === 100 ? '#4ade80' : pct > 60 ? '#60a5fa' : '#fbbf24',
            borderRadius: '99px', transition: 'width 0.4s',
          }} />
        </div>
        {pct === 100 && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#4ade80', fontWeight: '700' }}>
            🎉 All activities completed for today!
          </div>
        )}
        {/* Category summary row */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
          {ACTIVITY_CATEGORIES.map(cat => {
            const catRows = rows.filter(r => r.category === cat)
            if (catRows.length === 0) return null
            const catDone = catRows.filter(r => checked[`${type}_${r.no}`]).length
            const cs = catStyle(cat)
            return (
              <button key={cat} onClick={() => setCatFilter(catFilter === cat ? 'All' : cat)} style={{
                padding: '3px 10px', borderRadius: '99px', border: 'none',
                background: catFilter === cat ? 'white' : 'rgba(255,255,255,0.15)',
                color: catFilter === cat ? cs.color : 'rgba(255,255,255,0.8)',
                fontSize: '11px', fontWeight: '700', cursor: 'pointer',
              }}>
                {cat} {catDone}/{catRows.length}
              </button>
            )
          })}
        </div>
      </div>

      {/* Admin controls */}
      {adminMode && (
        <div style={{
          background: '#fff7ed', border: '1.5px solid #fed7aa',
          borderRadius: '12px', padding: '14px', marginBottom: '14px',
          display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', flex: 1 }}>
            🔧 Admin Mode — Edit, add, or remove activities for the {type} schedule
          </div>
          <button onClick={() => setAddForm(f => !f)} style={{ ...btn(), fontSize: '12px', padding: '7px 14px' }}>
            {addForm ? '✕ Cancel' : '➕ Add Activity'}
          </button>
          <button onClick={resetToDefault} style={{ ...btn('#fee2e2', '#dc2626'), fontSize: '12px', padding: '7px 14px' }}>
            ↺ Reset to Default
          </button>
        </div>
      )}

      {/* Add form (admin only) */}
      {adminMode && addForm && (
        <div style={{
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '16px', marginBottom: '14px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', alignItems: 'end',
        }}>
          <div><label style={lbl}>From *</label><input value={newRow.from} onChange={e => setNewRow(n => ({ ...n, from: e.target.value }))} placeholder="6:00 AM" style={inp} /></div>
          <div><label style={lbl}>To</label><input value={newRow.to} onChange={e => setNewRow(n => ({ ...n, to: e.target.value }))} placeholder="7:00 AM" style={inp} /></div>
          <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Activity Name *</label><input value={newRow.activity} onChange={e => setNewRow(n => ({ ...n, activity: e.target.value }))} placeholder="e.g. Special Assembly" style={inp} /></div>
          <div><label style={lbl}>Category</label>
            <select value={newRow.category} onChange={e => setNewRow(n => ({ ...n, category: e.target.value }))} style={inp}>
              {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
            <button onClick={addRow} style={btn('#16a34a')}>✓ Add</button>
            <button onClick={() => setAddForm(false)} style={btn('#f1f5f9', '#374151')}>✕</button>
          </div>
        </div>
      )}

      {/* Activity list */}
      {mobile ? (
        /* ── Mobile card view ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visible.map(r => {
            const isDone  = !!checked[`${type}_${r.no}`]
            const cs      = catStyle(r.category || 'Other')
            const isEdit  = adminMode && editRow === r.no
            if (isEdit) return (
              <div key={r.no} style={{ background: '#eff6ff', borderRadius: '12px', padding: '14px', border: '2px solid #60a5fa' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input id={`se-from-${r.no}`} defaultValue={r.from} placeholder="From" style={{ ...inp, fontSize: '13px' }} />
                  <input id={`se-to-${r.no}`} defaultValue={r.to} placeholder="To" style={{ ...inp, fontSize: '13px' }} />
                  <input id={`se-act-${r.no}`} defaultValue={r.activity} placeholder="Activity" style={{ ...inp, fontSize: '13px', gridColumn: '1/-1' }} />
                  <select id={`se-cat-${r.no}`} defaultValue={r.category || 'Routine'} style={{ ...inp, fontSize: '13px', gridColumn: '1/-1' }}>
                    {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => saveEdit(r.no)} style={{ ...btn('#16a34a'), flex: 1, fontSize: '12px' }}>✓ Save</button>
                  <button onClick={() => setEditRow(null)} style={{ ...btn('#f1f5f9', '#374151'), flex: 1, fontSize: '12px' }}>Cancel</button>
                </div>
              </div>
            )
            return (
              <div key={r.no} style={{
                background: isDone ? '#f0fdf4' : 'white',
                borderRadius: '12px', padding: '13px 14px',
                boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                borderLeft: `4px solid ${isDone ? '#16a34a' : cs.color}`,
                display: 'flex', alignItems: 'center', gap: '12px',
                opacity: isDone ? 0.75 : 1, transition: 'opacity 0.2s',
              }}>
                <div style={{ fontSize: '20px' }}>{actIcon(r.activity)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', textDecoration: isDone ? 'line-through' : 'none' }}>{r.activity}</span>
                    <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '99px', background: cs.bg, color: cs.color, fontWeight: '700', whiteSpace: 'nowrap' }}>{r.category}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {r.from}{r.to ? ` → ${r.to}` : ''}
                  </div>
                </div>
                {adminMode && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setEditRow(r.no)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: '#eff6ff', color: '#1e3a5f', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    <button onClick={() => deleteRow(r.no)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                )}
                <button onClick={() => toggle(r.no)} style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  border: isDone ? '2px solid #16a34a' : '2px dashed #d1d5db',
                  background: isDone ? '#16a34a' : 'transparent',
                  color: isDone ? 'white' : '#94a3b8',
                  cursor: 'pointer', fontSize: '16px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>{isDone ? '✓' : ''}</button>
              </div>
            )
          })}
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No activities in this category</div>
          )}
        </div>
      ) : (
        /* ── Desktop table view ── */
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'From', 'To', 'Activity', 'Category', adminMode ? 'Actions' : '', '✓ Done'].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const isDone = !!checked[`${type}_${r.no}`]
                const cs     = catStyle(r.category || 'Other')
                const isEdit = adminMode && editRow === r.no
                if (isEdit) return (
                  <tr key={r.no} style={{ background: '#eff6ff' }}>
                    <td style={{ padding: '8px 14px', color: '#94a3b8', fontSize: 11 }}>{r.no}</td>
                    <td style={{ padding: '8px 14px' }}><input id={`se-from-${r.no}`} defaultValue={r.from} style={{ ...inp, width: 90, padding: '5px 8px', fontSize: 12 }} /></td>
                    <td style={{ padding: '8px 14px' }}><input id={`se-to-${r.no}`} defaultValue={r.to} style={{ ...inp, width: 90, padding: '5px 8px', fontSize: 12 }} /></td>
                    <td style={{ padding: '8px 14px' }}><input id={`se-act-${r.no}`} defaultValue={r.activity} style={{ ...inp, padding: '5px 8px', fontSize: 12 }} /></td>
                    <td style={{ padding: '8px 14px' }}>
                      <select id={`se-cat-${r.no}`} defaultValue={r.category || 'Routine'} style={{ ...inp, padding: '5px 8px', fontSize: 12 }}>
                        {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveEdit(r.no)} style={{ ...btn('#16a34a'), fontSize: 11, padding: '4px 10px' }}>✓ Save</button>
                        <button onClick={() => setEditRow(null)} style={{ ...btn('#f1f5f9', '#374151'), fontSize: 11, padding: '4px 10px' }}>Cancel</button>
                      </div>
                    </td>
                    <td />
                  </tr>
                )
                return (
                  <tr key={r.no} style={{ background: isDone ? '#f0fdf4' : 'white', borderBottom: '1px solid #f1f5f9', opacity: isDone ? 0.75 : 1, transition: 'opacity 0.2s' }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{r.no}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1e3a5f' }}>{r.from}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{r.to || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 15, marginRight: 8 }}>{actIcon(r.activity)}</span>
                      <span style={{ fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#94a3b8' : '#1e293b' }}>{r.activity}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: 11, fontWeight: 700, background: cs.bg, color: cs.color }}>{r.category || 'Other'}</span>
                    </td>
                    {adminMode ? (
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditRow(r.no)} style={{ background: '#eff6ff', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✏ Edit</button>
                          <button onClick={() => deleteRow(r.no)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✕</button>
                        </div>
                      </td>
                    ) : <td />}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button onClick={() => toggle(r.no)} title={isDone ? 'Mark pending' : 'Mark done'} style={{
                        width: 32, height: 32, borderRadius: '50%',
                        border: isDone ? '2px solid #16a34a' : '2px dashed #d1d5db',
                        background: isDone ? '#16a34a' : 'transparent',
                        color: isDone ? 'white' : '#94a3b8',
                        cursor: 'pointer', fontSize: 15, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                      }}>{isDone ? '✓' : ''}</button>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No activities match this filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  TAB 3 — Mess Duty Tracker
// ══════════════════════════════════════════════════════════════
const MESS_SHIFTS   = ['Breakfast', 'Lunch', 'Tea', 'Dinner', 'Full Day']
const MESS_ROLES    = ['Mess In-Charge', 'Server', 'Cleaner', 'Cook Assistant', 'Supervisor']
const MESS_STATUSES = ['Assigned', 'On Duty', 'Completed', 'Absent']

const emptyMD = {
  date: today(), shift: 'Full Day',
  staff1_id: null, staff1: '', staff1_role: 'Mess In-Charge',
  staff2_id: null, staff2: '', staff2_role: 'Server',
  staff3_id: null, staff3: '', staff3_role: 'Cleaner',
  status: 'Assigned', notes: '',
}

const SHIFT_STYLE = {
  'Breakfast':  { color: '#ca8a04', bg: '#fef9c3', icon: '🌅' },
  'Lunch':      { color: '#16a34a', bg: '#dcfce7', icon: '☀️' },
  'Tea':        { color: '#0891b2', bg: '#e0f2fe', icon: '☕' },
  'Dinner':     { color: '#7c3aed', bg: '#f5f3ff', icon: '🌙' },
  'Full Day':   { color: '#1e3a5f', bg: '#eff6ff', icon: '📋' },
}

function NightDutyTab({ staffProfiles }) {
  const [records,  setRecords]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec,  setEditRec]  = useState(null)
  const [form,     setForm]     = useState(emptyMD)
  const [month,    setMonth]    = useState(new Date().getMonth())
  const [year,     setYear]     = useState(new Date().getFullYear())
  const [shiftFilter, setShiftFilter] = useState('All')
  const mobile = useMobileView()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('mess_duty').select('*').order('date', { ascending: false }).order('shift')
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      date: form.date, shift: form.shift, status: form.status, notes: form.notes,
      staff1_id: form.staff1_id || null, staff1: form.staff1, staff1_role: form.staff1_role,
      staff2_id: form.staff2_id || null, staff2: form.staff2 || null, staff2_role: form.staff2 ? form.staff2_role : null,
      staff3_id: form.staff3_id || null, staff3: form.staff3 || null, staff3_role: form.staff3 ? form.staff3_role : null,
    }
    const { error } = editRec
      ? await supabase.from('mess_duty').update(payload).eq('id', editRec.id)
      : await supabase.from('mess_duty').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyMD); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    await supabase.from('mess_duty').update({ status }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this mess duty record?')) return
    await supabase.from('mess_duty').delete().eq('id', id); load()
  }

  const openEdit = r => {
    setEditRec(r)
    setForm({ ...emptyMD, ...r, staff2: r.staff2 || '', staff3: r.staff3 || '' })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Enrich staff names from profiles
  const enriched = useMemo(() => records.map(r => {
    const s1 = r.staff1_id ? staffProfiles.find(s => s.id === r.staff1_id) : null
    const s2 = r.staff2_id ? staffProfiles.find(s => s.id === r.staff2_id) : null
    const s3 = r.staff3_id ? staffProfiles.find(s => s.id === r.staff3_id) : null
    return {
      ...r,
      staff1: s1?.name || r.staff1,
      staff2: s2?.name || r.staff2,
      staff3: s3?.name || r.staff3,
      staff1_desig: s1?.designation || s1?.department || '',
      staff2_desig: s2?.designation || s2?.department || '',
      staff3_desig: s3?.designation || s3?.department || '',
    }
  }), [records, staffProfiles])

  const monthRoster = useMemo(() => enriched.filter(r => {
    if (!r.date) return false
    const d = new Date(r.date)
    return d.getMonth() === month && d.getFullYear() === year &&
      (shiftFilter === 'All' || r.shift === shiftFilter)
  }), [enriched, month, year, shiftFilter])

  // Today's duties
  const todayDuties = enriched.filter(r => r.date === today())

  // Uncovered days (only for Full Day shift check)
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const coveredDates = new Set(enriched.filter(r => r.date && new Date(r.date).getMonth() === month && new Date(r.date).getFullYear() === year).map(r => r.date))
  const uncovered    = Array.from({ length: daysInMonth }, (_, i) => {
    const d   = new Date(year, month, i + 1)
    const key = d.toISOString().split('T')[0]
    return coveredDates.has(key) ? null : key
  }).filter(Boolean)

  // Stats
  const stats = {
    total:     monthRoster.length,
    assigned:  monthRoster.filter(r => r.status === 'Assigned').length,
    onDuty:    monthRoster.filter(r => r.status === 'On Duty').length,
    completed: monthRoster.filter(r => r.status === 'Completed').length,
    absent:    monthRoster.filter(r => r.status === 'Absent').length,
  }

  // ── Staff search clear helper
  const clearStaff = (slot) => setForm(f => ({ ...f, [`staff${slot}_id`]: null, [`staff${slot}`]: '', [`staff${slot}_role`]: slot === 1 ? 'Mess In-Charge' : slot === 2 ? 'Server' : 'Cleaner' }))

  const StaffSlot = ({ slot, label, required = false }) => (
    <div>
      <label style={lbl}>{label}{required ? ' *' : ' '}<span style={{ color: '#94a3b8', fontWeight: 400 }}>(search staff)</span></label>
      <StaffSearchInput
        staff={staffProfiles}
        onSelect={s => setForm(f => ({ ...f, [`staff${slot}_id`]: s.id, [`staff${slot}`]: s.name }))}
        placeholder={`Search ${label.toLowerCase()}...`}
      />
      {form[`staff${slot}`] && (
        <div style={{ marginTop: 6, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 12, color: '#1e3a5f', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✅ {form[`staff${slot}`]}</span>
          <button type="button" onClick={() => clearStaff(slot)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>✕ Clear</button>
        </div>
      )}
      {form[`staff${slot}`] && (
        <select value={form[`staff${slot}_role`]} onChange={e => setForm(f => ({ ...f, [`staff${slot}_role`]: e.target.value }))} style={{ ...inp, marginTop: 6, fontSize: 12, padding: '6px 10px' }}>
          {MESS_ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
      )}
    </div>
  )

  return (
    <div>
      {/* ── Month navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, background: 'white', padding: '14px 20px',
        borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          style={{ ...btn('#f1f5f9', '#374151'), padding: '6px 14px', fontSize: 16 }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f' }}>{MONTHS[month]} {year}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {monthRoster.length} duties assigned ·{' '}
            {uncovered.length > 0
              ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{uncovered.length} days uncovered</span>
              : <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ all days covered</span>
            }
          </div>
        </div>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          style={{ ...btn('#f1f5f9', '#374151'), padding: '6px 14px', fontSize: 16 }}>›</button>
      </div>

      {/* ── Today's duties banner */}
      {todayDuties.length > 0 && (
        <div style={{
          background: '#1e3a5f', borderRadius: 12, padding: '14px 18px',
          marginBottom: 16, color: 'white',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            🍽️ Today's Mess Duties — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {todayDuties.map(d => {
              const ss = SHIFT_STYLE[d.shift] || SHIFT_STYLE['Full Day']
              return (
                <div key={d.id} style={{
                  background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                  padding: '10px 14px', minWidth: 160, flex: '1 1 160px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    {ss.icon} {d.shift}
                    <span style={{
                      marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 99,
                      background: d.status === 'Completed' ? '#dcfce7' : d.status === 'Absent' ? '#fee2e2' : 'rgba(255,255,255,0.2)',
                      color: d.status === 'Completed' ? '#16a34a' : d.status === 'Absent' ? '#dc2626' : 'white',
                      fontWeight: 700,
                    }}>{d.status}</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    {[
                      d.staff1 && `${d.staff1} (${d.staff1_role})`,
                      d.staff2 && `${d.staff2} (${d.staff2_role})`,
                      d.staff3 && `${d.staff3} (${d.staff3_role})`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Stats */}
      <div style={mobile ? mobileStatGrid : statGrid(130)}>
        <StatCard icon="📋" label="Total"     value={stats.total}     color="#1e3a5f" bg="#eff6ff" compact={mobile} />
        <StatCard icon="✅" label="Completed" value={stats.completed} color="#16a34a" bg="#dcfce7" compact={mobile} />
        <StatCard icon="🟡" label="On Duty"   value={stats.onDuty}   color="#ca8a04" bg="#fef9c3" compact={mobile} />
        <StatCard icon="❌" label="Absent"    value={stats.absent}    color="#dc2626" bg="#fee2e2" compact={mobile} />
      </div>

      {/* ── Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', ...MESS_SHIFTS].map(s => (
            <button key={s} onClick={() => setShiftFilter(s)} style={{
              padding: '6px 12px', borderRadius: 99, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: shiftFilter === s ? '#1e3a5f' : '#f1f5f9',
              color: shiftFilter === s ? 'white' : '#64748b',
            }}>{s === 'All' ? '📋 All' : `${SHIFT_STYLE[s]?.icon || ''} ${s}`}</button>
          ))}
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyMD) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Assign Duty'}
        </button>
      </div>

      {/* ── Form */}
      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>
            {editRec ? '✏️ Edit Mess Duty' : '➕ Assign Mess Duty'}
          </h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>🔗 Staff pulled live from Staff Profiles · Up to 3 staff per duty slot</p>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} />
              </div>
              <div>
                <label style={lbl}>Shift *</label>
                <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} style={inp}>
                  {MESS_SHIFTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  {MESS_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." style={inp} />
              </div>

              {/* Divider */}
              <div style={{ gridColumn: '1/-1', borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  👥 Staff Assignments
                </div>
              </div>

              <StaffSlot slot={1} label="Staff 1" required />
              <StaffSlot slot={2} label="Staff 2" />
              <StaffSlot slot={3} label="Staff 3" />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>
                {saving ? '⏳ Saving...' : '✅ Save Duty'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Records */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
      ) : mobile ? (
        /* Mobile cards */
        <MobileCardList>
          {monthRoster.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No mess duties for {MONTHS[month]} {year}
            </div>
          )}
          {monthRoster.map(r => {
            const ss = SHIFT_STYLE[r.shift] || SHIFT_STYLE['Full Day']
            return (
              <MobileRecordCard key={r.id} accentColor={ss.color}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ss.color }}>{ss.icon} {r.shift}</span>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.date}</div>
                  </div>
                  <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                    style={{ ...statusStyle(r.status), border: 'none', cursor: 'pointer', fontFamily: 'system-ui', fontSize: 11 }}>
                    {MESS_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {/* Staff list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {[
                    { name: r.staff1, role: r.staff1_role, desig: r.staff1_desig },
                    { name: r.staff2, role: r.staff2_role, desig: r.staff2_desig },
                    { name: r.staff3, role: r.staff3_role, desig: r.staff3_desig },
                  ].filter(s => s.name).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ padding: '1px 8px', borderRadius: 99, background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.role}</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{s.name}</span>
                      {s.desig && <span style={{ color: '#94a3b8', fontSize: 11 }}>· {s.desig}</span>}
                    </div>
                  ))}
                </div>
                {r.notes && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginBottom: 8 }}>📝 {r.notes}</div>}
                <MobileActionButtons actions={[
                  { label: '✏️ Edit', onClick: () => openEdit(r), bg: '#eff6ff', color: '#1e3a5f' },
                  { label: '🗑 Delete', onClick: () => handleDelete(r.id), bg: '#fee2e2', color: '#dc2626' },
                ]} />
              </MobileRecordCard>
            )
          })}
        </MobileCardList>
      ) : (
        /* Desktop table */
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 780 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'Date', 'Shift', 'Staff 1', 'Staff 2', 'Staff 3', 'Status', 'Notes', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthRoster.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No mess duties for {MONTHS[month]} {year}
                </td></tr>
              )}
              {monthRoster.map((r, i) => {
                const ss = SHIFT_STYLE[r.shift] || SHIFT_STYLE['Full Day']
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: ss.bg, color: ss.color, whiteSpace: 'nowrap' }}>
                        {ss.icon} {r.shift}
                      </span>
                    </td>
                    {/* Staff cells */}
                    {[
                      { name: r.staff1, role: r.staff1_role, desig: r.staff1_desig, linked: !!r.staff1_id },
                      { name: r.staff2, role: r.staff2_role, desig: r.staff2_desig, linked: !!r.staff2_id },
                      { name: r.staff3, role: r.staff3_role, desig: r.staff3_desig, linked: !!r.staff3_id },
                    ].map((s, si) => (
                      <td key={si} style={{ padding: '11px 14px' }}>
                        {s.name ? (
                          <>
                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: ss.color, fontWeight: 700 }}>{s.role}</div>
                            {s.desig && <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.desig}</div>}
                            {s.linked && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                          </>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    ))}
                    <td style={{ padding: '11px 14px' }}>
                      <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                        style={{ ...statusStyle(r.status), border: 'none', cursor: 'pointer', fontFamily: 'system-ui' }}>
                        {MESS_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12, maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes}>{r.notes || '—'}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(r)} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                        <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Uncovered days warning */}
      {uncovered.length > 0 && (
        <div style={{ marginTop: 16, background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13, marginBottom: 8 }}>
            ⚠ {uncovered.length} days with no mess duty assigned in {MONTHS[month]}:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {uncovered.map(d => (
              <button key={d} onClick={() => { setForm(f => ({ ...f, date: d })); setShowForm(true) }}
                style={{ padding: '3px 10px', borderRadius: 99, background: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                title="Click to assign duty for this date"
              >{d}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Click any date to quickly assign a duty</div>
        </div>
      )}

      {/* ── Supabase SQL */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>🛠 First time? Show Supabase table SQL</summary>
        <pre style={{ marginTop: 8, background: '#1e293b', color: '#e2e8f0', padding: '14px', borderRadius: 10, fontSize: 11, overflow: 'auto' }}>{`create table if not exists mess_duty (
  id          bigserial primary key,
  date        date not null,
  shift       text not null,
  status      text default 'Assigned',
  notes       text,
  staff1_id   bigint references staff_profiles(id) on delete set null,
  staff1      text,
  staff1_role text,
  staff2_id   bigint references staff_profiles(id) on delete set null,
  staff2      text,
  staff2_role text,
  staff3_id   bigint references staff_profiles(id) on delete set null,
  staff3      text,
  staff3_role text,
  created_at  timestamptz default now()
);
alter table mess_duty disable row level security;`}</pre>
      </details>
    </div>
  )
}
// ══════════════════════════════════════════════════════════════
//  TAB 4 — Discipline
// ══════════════════════════════════════════════════════════════
const emptyDisc = {
  date: today(), student_id: null, gcc_no: '', student_name: '', class_name: '',
  incident: '', action_taken: '', reported_by: '', status: 'Open', remarks: '',
}
const DISC_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']

function DisciplineTab({ students }) {
  const [records,  setRecords]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec,  setEditRec]  = useState(null)
  const [form,     setForm]     = useState(emptyDisc)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('All')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('discipline_records').select('*').order('date', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleStudentSelect = s => {
    setForm(f => ({ ...f, student_id: s.id, gcc_no: s.gcc_no || '', student_name: s.name || '', class_name: getStudentClass(s) }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      date: form.date, student_id: form.student_id || null, gcc_no: form.gcc_no || null,
      student_name: form.student_name, class_name: form.class_name,
      incident: form.incident, action_taken: form.action_taken,
      reported_by: form.reported_by, status: form.status, remarks: form.remarks,
    }
    const { error } = editRec
      ? await supabase.from('discipline_records').update(payload).eq('id', editRec.id)
      : await supabase.from('discipline_records').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyDisc); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    await supabase.from('discipline_records').update({ status }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this record?')) return
    await supabase.from('discipline_records').delete().eq('id', id); load()
  }

  const enriched = useMemo(() => records.map(r => {
    if (r.student_id) {
      const s = students.find(s => s.id === r.student_id)
      if (s) return { ...r, student_name: s.name, gcc_no: s.gcc_no, class_name: getStudentClass(s) || r.class_name, _house: s.house, _course: s.course }
    }
    return r
  }), [records, students])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return enriched.filter(r =>
      (filter === 'All' || r.status === filter) &&
      [r.student_name, r.class_name, r.incident, r.reported_by, r.gcc_no].some(v => (v || '').toLowerCase().includes(q))
    )
  }, [enriched, search, filter])

  const open       = records.filter(r => r.status === 'Open').length
  const inProgress = records.filter(r => r.status === 'In Progress').length
  const resolved   = records.filter(r => r.status === 'Resolved').length

  return (
    <div>
      {/* FIXED: was repeat(4,1fr) */}
      <div style={statGrid()}>
        <StatCard icon="📋" label="Total"       value={records.length} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="🔴" label="Open"        value={open}           color="#dc2626" bg="#fee2e2" />
        <StatCard icon="🟡" label="In Progress" value={inProgress}     color="#ca8a04" bg="#fef9c3" />
        <StatCard icon="🟢" label="Resolved"    value={resolved}       color="#16a34a" bg="#dcfce7" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search student, incident..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            {DISC_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyDisc) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Add Record'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>{editRec ? '✏️ Edit Record' : '➕ New Discipline Record'}</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>🔗 Student data pulled live from Students module</p>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>🔍 Search & Select Student</label>
                <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                {form.student_id && (
                  <div style={{ marginTop: 8, padding: '6px 12px', background: '#dcfce7', borderRadius: 6, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    ✅ Linked: {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                  </div>
                )}
              </div>
              <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>GCC No. <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} placeholder="e.g. 729" style={inp} /></div>
              <div><label style={lbl}>Student Name *</label><input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Batch / Class <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Incident Description *</label><textarea value={form.incident} onChange={e => setForm(f => ({ ...f, incident: e.target.value }))} required rows={3} placeholder="Describe the incident..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Action Taken</label><textarea value={form.action_taken} onChange={e => setForm(f => ({ ...f, action_taken: e.target.value }))} rows={2} placeholder="Action taken..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div><label style={lbl}>Reported By</label><input value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))} placeholder="Staff name" style={inp} /></div>
              <div><label style={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>{DISC_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'Date', 'GCC', 'Student', 'Batch', 'House', 'Incident', 'Action', 'Reported By', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r.date}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{r.gcc_no ? `GCC-${r.gcc_no}` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.student_name}</div>
                      {r.student_id && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.class_name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>{r._house || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.incident}>{r.incident}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', maxWidth: 140 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.action_taken}>{r.action_taken || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.reported_by || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                        style={{ ...statusStyle(r.status), border: 'none', cursor: 'pointer', fontFamily: 'system-ui' }}>
                        {DISC_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditRec(r); setForm({ ...r }); setShowForm(true) }} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                        <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No discipline records found</td></tr>
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
//  TAB 5 — Sickbay
// ══════════════════════════════════════════════════════════════
const emptySick = {
  date: today(), student_id: null, gcc_no: '', student_name: '', class_name: '',
  complaint: '', treatment: '', referred_to: '', admitted_date: today(),
  discharge_date: '', status: 'Admitted', attended_by: '',
}

function SickbayTab({ students }) {
  const [records,  setRecords]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec,  setEditRec]  = useState(null)
  const [form,     setForm]     = useState(emptySick)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('All')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('sickbay_records').select('*').order('date', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleStudentSelect = s => {
    setForm(f => ({ ...f, student_id: s.id, gcc_no: s.gcc_no || '', student_name: s.name || '', class_name: getStudentClass(s) }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      date: form.date, student_id: form.student_id || null, gcc_no: form.gcc_no || null,
      student_name: form.student_name, class_name: form.class_name,
      complaint: form.complaint, treatment: form.treatment,
      referred_to: form.referred_to, admitted_date: form.admitted_date,
      discharge_date: form.discharge_date || null, status: form.status, attended_by: form.attended_by,
    }
    const { error } = editRec
      ? await supabase.from('sickbay_records').update(payload).eq('id', editRec.id)
      : await supabase.from('sickbay_records').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptySick); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleDischarge = async id => {
    await supabase.from('sickbay_records').update({ status: 'Discharged', discharge_date: today() }).eq('id', id)
    load()
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this record?')) return
    await supabase.from('sickbay_records').delete().eq('id', id); load()
  }

  const enriched = useMemo(() => records.map(r => {
    if (r.student_id) {
      const s = students.find(s => s.id === r.student_id)
      if (s) return { ...r, student_name: s.name, gcc_no: s.gcc_no, class_name: getStudentClass(s) || r.class_name, _house: s.house, _hostel_type: s.hostel_type }
    }
    return r
  }), [records, students])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return enriched.filter(r =>
      (filter === 'All' || r.status === filter) &&
      [r.student_name, r.class_name, r.complaint, r.gcc_no].some(v => (v || '').toLowerCase().includes(q))
    )
  }, [enriched, search, filter])

  const admitted   = records.filter(r => r.status === 'Admitted').length
  const discharged = records.filter(r => r.status === 'Discharged').length

  return (
    <div>
      {/* FIXED: was repeat(3,1fr) */}
      <div style={statGrid(160)}>
        <StatCard icon="🏥" label="Total Records"      value={records.length} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="🛏️" label="Currently Admitted" value={admitted}       color="#1d4ed8" bg="#dbeafe" />
        <StatCard icon="✅" label="Discharged"         value={discharged}     color="#16a34a" bg="#dcfce7" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search student, complaint..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            <option>Admitted</option>
            <option>Discharged</option>
          </select>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptySick) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Add Record'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>{editRec ? '✏️ Edit Record' : '➕ New Sickbay Record'}</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>🔗 Student data pulled live from Students module</p>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>🔍 Search & Select Student</label>
                <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                {form.student_id && (
                  <div style={{ marginTop: 8, padding: '6px 12px', background: '#dcfce7', borderRadius: 6, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    ✅ Linked: {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                  </div>
                )}
              </div>
              <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>GCC No. <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} placeholder="e.g. 729" style={inp} /></div>
              <div><label style={lbl}>Student Name *</label><input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Batch / Class <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Complaint *</label><textarea value={form.complaint} onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))} required rows={2} placeholder="Describe the complaint..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Treatment Given</label><textarea value={form.treatment} onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))} rows={2} placeholder="Treatment / medication given..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div><label style={lbl}>Referred To</label><input value={form.referred_to} onChange={e => setForm(f => ({ ...f, referred_to: e.target.value }))} placeholder="Hospital / doctor name" style={inp} /></div>
              <div><label style={lbl}>Attended By</label><input value={form.attended_by} onChange={e => setForm(f => ({ ...f, attended_by: e.target.value }))} placeholder="Staff / nurse name" style={inp} /></div>
              <div><label style={lbl}>Admitted Date</label><input type="date" value={form.admitted_date} onChange={e => setForm(f => ({ ...f, admitted_date: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Discharge Date</label><input type="date" value={form.discharge_date} onChange={e => setForm(f => ({ ...f, discharge_date: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}><option>Admitted</option><option>Discharged</option></select></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'Date', 'GCC', 'Student', 'Batch', 'House', 'Hostel Type', 'Complaint', 'Treatment', 'Referred', 'Attended By', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: r.status === 'Admitted' ? '#eff6ff' : 'white' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = r.status === 'Admitted' ? '#eff6ff' : 'white'}
                  >
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r.date}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{r.gcc_no ? `GCC-${r.gcc_no}` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.student_name}</div>
                      {r.student_id && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.class_name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>{r._house || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r._hostel_type || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.complaint}>{r.complaint}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', maxWidth: 140 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.treatment}>{r.treatment || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.referred_to || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.attended_by || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span style={statusStyle(r.status)}>{r.status}</span></td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditRec(r); setForm({ ...r, discharge_date: r.discharge_date || '' }); setShowForm(true) }} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                          <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
                        </div>
                        {r.status === 'Admitted' && (
                          <button onClick={() => handleDischarge(r.id)} style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>✅ Discharge</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={13} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No sickbay records found</td></tr>
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
//  TAB 6 — House Management
// ══════════════════════════════════════════════════════════════
const HOUSE_COLORS = [
  { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  { color: '#16a34a', bg: '#dcfce7', border: '#6ee7b7' },
  { color: '#ca8a04', bg: '#fef9c3', border: '#fde047' },
  { color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  { color: '#0891b2', bg: '#e0f2fe', border: '#7dd3fc' },
]
const emptyHouse = {
  name: '', motto: '', color_index: 0, captain: '', vice_captain: '',
  established_year: new Date().getFullYear(), remarks: '',
}

function HouseTab({ students: propStudents, currentUser, houseColorMap }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [houses,       setHouses]       = useState([])
  const [students,     setStudents]     = useState(propStudents || [])
  const [masters,      setMasters]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editRec,      setEditRec]      = useState(null)
  const [form,         setForm]         = useState(emptyHouse)
  const [activeHouse,  setActiveHouse]  = useState(null)
  const [search,       setSearch]       = useState('')
  const [assignSearch, setAssignSearch] = useState('')
  const [assignFilter, setAssignFilter] = useState('All')
  const [toast,        setToast]        = useState(null)

  const showToast = (msg, color = '#16a34a') => {
    setToast({ msg, color }); setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    const [{ data: h }, { data: s }, { data: m }] = await Promise.all([
      supabase.from('houses').select('*').order('name'),
      supabase.from('students').select('id,name,gcc_no,class_name,batch,course,house,hostel_type,admission_no').order('name'),
      supabase.from('housemasters').select('*').order('house'),
    ])
    setHouses(h || []); setStudents(s || []); setMasters(m || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSaveHouse = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      name: form.name.trim(), motto: form.motto, color_index: Number(form.color_index),
      captain: form.captain, vice_captain: form.vice_captain,
      established_year: Number(form.established_year) || new Date().getFullYear(), remarks: form.remarks,
    }
    const { error } = editRec
      ? await supabase.from('houses').update(payload).eq('id', editRec.id)
      : await supabase.from('houses').insert([payload])
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setForm(emptyHouse); setShowForm(false); setEditRec(null)
    showToast(editRec ? '✅ House updated' : '✅ House created')
    load(); setSaving(false)
  }

  const handleDeleteHouse = async id => {
    if (!isAdmin) { alert('Only admins can delete houses.'); return }
    const count = students.filter(s => normalizeHouse(s.house) === normalizeHouse(houses.find(h => h.id === id)?.name)).length
    if (!window.confirm(`Delete this house?${count > 0 ? ` ${count} students will be unassigned.` : ''}`)) return
    await supabase.from('houses').delete().eq('id', id)
    showToast('🗑 House deleted', '#dc2626'); load()
  }

  const handleAssign = async (studentId, houseName) => {
    if (!isAdmin) { alert('Only admins can change house assignments.'); return }
    await supabase.from('students').update({ house: houseName || null }).eq('id', studentId)
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, house: houseName || null } : s))
    showToast(houseName ? `✅ Assigned to ${houseName}` : '✅ Removed from house')
  }

  const handleBulkAssign = async houseName => {
    const unassigned = students.filter(s => !isAssigned(s))
    if (!unassigned.length) { showToast('No unassigned students', '#ca8a04'); return }
    if (!window.confirm(`Assign ${unassigned.length} unassigned students to ${houseName}?`)) return
    await supabase.from('students').update({ house: houseName }).in('id', unassigned.map(s => s.id))
    setStudents(prev => prev.map(s => !s.house ? { ...s, house: houseName } : s))
    showToast(`✅ ${unassigned.length} students assigned to ${houseName}`)
  }

  const getHouseStyle = h => {
    const c = houseColorMap[h.name] || HOUSE_PALETTE[(Number(h.color_index) || 0) % HOUSE_PALETTE.length]
    return typeof c === 'string' ? {color: c, bg: `${c}10`, border: `${c}40`} : c
  }

  const activeHouseObj  = houses.find(h => h.id === activeHouse)
  const houseStudents   = activeHouseObj ? students.filter(s => normalizeHouse(s.house) === normalizeHouse(activeHouseObj.name)) : []
  const houseMasters    = activeHouseObj ? masters.filter(m => normalizeHouse(m.house) === normalizeHouse(activeHouseObj.name)) : []
  const unassignedCount = students.filter(s => !isAssigned(s)).length

  const assignHits = assignSearch.length > 0
    ? students.filter(s =>
        !s.house && (
          (s.name || '').toLowerCase().includes(assignSearch.toLowerCase()) ||
          String(s.gcc_no || '').includes(assignSearch) ||
          (s.batch || '').toLowerCase().includes(assignSearch.toLowerCase())
        )
      ).slice(0, 10)
    : []

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter(s => {
      const matchesSearch = [s.name, s.gcc_no, s.batch, s.course].some(v => (v || '').toString().toLowerCase().includes(q))
      const matchesFilter = assignFilter === 'All' ? true : assignFilter === 'Unassigned' ? !s.house : (s.house || '').toLowerCase() === assignFilter.toLowerCase()
      return matchesSearch && matchesFilter
    })
  }, [students, search, assignFilter])

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 99999,
          background: '#fff', border: `1px solid #e2e8f0`,
          borderLeft: `3px solid ${toast.color}`, borderRadius: 10,
          padding: '11px 16px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,.12)', color: '#1e293b',
        }}>{toast.msg}</div>
      )}

      {activeHouse && activeHouseObj && (() => {
        const hs = getHouseStyle(activeHouseObj)
        return (
          <div>
            {/* FIXED: added flexWrap:'wrap' */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              <button onClick={() => setActiveHouse(null)} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: 13 }}>← Back</button>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: hs.color }}>🏠 {activeHouseObj.name} House</div>
                {activeHouseObj.motto && <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>"{activeHouseObj.motto}"</div>}
              </div>
              {/* FIXED: added flexWrap:'wrap' */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => { setEditRec(activeHouseObj); setForm({ ...activeHouseObj }); setShowForm(true); setActiveHouse(null) }} style={{ ...btn('#eff6ff', '#1e3a5f'), fontSize: 12, padding: '7px 14px' }}>✏️ Edit House</button>
                {isAdmin && <button onClick={() => handleBulkAssign(activeHouseObj.name)} style={{ ...btn('#ecfdf5', '#059669'), fontSize: 12, padding: '7px 14px' }}>+ Assign Unassigned ({unassignedCount})</button>}
              </div>
            </div>

            {/* FIXED: was repeat(4,1fr) */}
            <div style={statGrid(130)}>
              <StatCard icon="👥"  label="Students"     value={houseStudents.length}               color={hs.color} bg={hs.bg} />
              <StatCard icon="👨‍🏫" label="Housemasters" value={houseMasters.length}                color={hs.color} bg={hs.bg} />
              <StatCard icon="🎖"  label="Captain"      value={activeHouseObj.captain || '—'}       color={hs.color} bg={hs.bg} />
              <StatCard icon="🎗"  label="Vice Captain" value={activeHouseObj.vice_captain || '—'}  color={hs.color} bg={hs.bg} />
            </div>

            {houseMasters.length > 0 && (
              <div style={{ background: 'white', border: `1.5px solid ${hs.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: hs.color, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>👨‍🏫 Housemasters</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {houseMasters.map(m => (
                    <div key={m.id} style={{ background: hs.bg, border: `1px solid ${hs.border}`, borderRadius: 8, padding: '8px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: hs.color }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{m.designation || 'Housemaster'}{m.phone ? ' · ' + m.phone : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: 'white', border: `1px solid ${hs.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: hs.color, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>➕ Assign Student to {activeHouseObj.name}</div>
              <div style={{ position: 'relative' }}>
                <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)} placeholder="Search unassigned student by name, GCC No or batch..." style={inp} />
                {assignHits.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxHeight: 200, overflowY: 'auto' }}>
                    {assignHits.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13, flexWrap: 'wrap', gap: 8 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <div>
                          <strong>{s.name}</strong>
                          <span style={{ color: '#64748b', marginLeft: 8 }}>GCC-{s.gcc_no || '--'} · {getStudentClass(s) || '--'}</span>
                        </div>
                        {isAdmin && <button onClick={() => { handleAssign(s.id, activeHouseObj.name); setAssignSearch('') }} style={{ ...btn(hs.color), fontSize: 11, padding: '4px 12px' }}>Assign</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
              <div style={{ background: hs.color, padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'white', fontSize: 13 }}>👥 {activeHouseObj.name} Roster — {houseStudents.length} students</span>
              </div>
              {houseStudents.length === 0
                ? <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No students assigned to this house yet</div>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['#', 'GCC', 'Student', 'Batch', 'Course', 'Hostel Type', 'Remove'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {houseStudents.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.batch || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.course || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.hostel_type || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {isAdmin && <button onClick={() => handleAssign(s.id, '')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✕ Remove</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        )
      })()}

      {!activeHouse && showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>{editRec ? '✏️ Edit House' : '🏠 Create New House'}</h3>
          <form onSubmit={handleSaveHouse}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div>
                <label style={lbl}>House Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Kombirei" style={inp} />
              </div>
              <div>
                <label style={lbl}>House Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {HOUSE_COLORS.map((c, i) => (
                    <button key={i} type="button" onClick={() => setForm(f => ({ ...f, color_index: i }))} style={{
                      width: 32, height: 32, borderRadius: '50%', background: c.color,
                      border: Number(form.color_index) === i ? `3px solid #0f172a` : `2px solid ${c.border}`,
                      cursor: 'pointer', transition: 'transform .1s',
                      transform: Number(form.color_index) === i ? 'scale(1.2)' : 'scale(1)',
                    }} />
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Motto</label>
                <input value={form.motto} onChange={e => setForm(f => ({ ...f, motto: e.target.value }))} placeholder="e.g. Unity in Strength" style={inp} />
              </div>
              <div><label style={lbl}>House Captain</label><input value={form.captain} onChange={e => setForm(f => ({ ...f, captain: e.target.value }))} placeholder="Student name" style={inp} /></div>
              <div><label style={lbl}>Vice Captain</label><input value={form.vice_captain} onChange={e => setForm(f => ({ ...f, vice_captain: e.target.value }))} placeholder="Student name" style={inp} /></div>
              <div><label style={lbl}>Established Year</label><input type="number" value={form.established_year} onChange={e => setForm(f => ({ ...f, established_year: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save House'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!activeHouse && (
        <>
          {/* FIXED: was repeat(4,1fr) */}
          <div style={statGrid(130)}>
            <StatCard icon="🏠"  label="Total Houses"  value={houses.length}                        color="#1e3a5f" bg="#eff6ff" />
            <StatCard icon="👥"  label="Assigned"      value={students.filter(s => s.house).length}  color="#16a34a" bg="#dcfce7" />
            <StatCard icon="⚠️"  label="Unassigned"    value={unassignedCount}                       color="#dc2626" bg="#fee2e2" />
            <StatCard icon="👨‍🏫" label="Housemasters"  value={masters.length}                        color="#7c3aed" bg="#f5f3ff" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
              <input placeholder="🔍 Search students..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, maxWidth: 260 }} />
              <select value={assignFilter} onChange={e => setAssignFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="All">All Students</option>
                <option value="Unassigned">Unassigned Only</option>
                {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
              </select>
            </div>
            <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyHouse) }} style={btn()}>
              {showForm ? '✖ Cancel' : '🏠 Create House'}
            </button>
          </div>

          {houses.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>No Houses Created Yet</div>
                <button onClick={() => setShowForm(true)} style={btn()}>🏠 Create First House</button>
              </div>
            )
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, marginBottom: 24 }}>
                {houses.map(h => {
                  const hs  = getHouseStyle(h)
                  const cnt = students.filter(s => normalizeHouse(s.house) === normalizeHouse(h.name)).length
                  const hms = masters.filter(m => normalizeHouse(m.house) === normalizeHouse(h.name))
                  return (
                    <div key={h.id}
                      style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: `1px solid ${hs.border}`, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.08)' }}
                      onClick={() => setActiveHouse(h.id)}
                    >
                      <div style={{ height: 6, background: hs.color }} />
                      <div style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: hs.color }}>🏠 {h.name}</div>
                            {h.motto && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>"{h.motto}"</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); setEditRec(h); setForm({ ...h }); setShowForm(true) }} style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                            {isAdmin && <button onClick={e => { e.stopPropagation(); handleDeleteHouse(h.id) }} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                          {[
                            { label: 'Students', value: cnt,              icon: '👥' },
                            { label: 'Masters',  value: hms.length,       icon: '👨‍🏫' },
                            { label: 'Est.',     value: h.established_year || '—', icon: '📅' },
                          ].map(s => (
                            <div key={s.label} style={{ background: hs.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 14 }}>{s.icon}</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: hs.color }}>{s.value}</div>
                              <div style={{ fontSize: 10, color: hs.color, opacity: .7 }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        {(h.captain || h.vice_captain) && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                            {h.captain && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: hs.bg, color: hs.color, fontWeight: 700 }}>🎖 {h.captain}</span>}
                            {h.vice_captain && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: hs.bg, color: hs.color, fontWeight: 600 }}>🎗 {h.vice_captain}</span>}
                          </div>
                        )}
                        {hms.length > 0 && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>👨‍🏫 {hms.map(m => m.name).join(', ')}</div>}
                        <div style={{ fontSize: 12, color: hs.color, fontWeight: 700, textAlign: 'center', padding: '7px', background: hs.bg, borderRadius: 8 }}>View Roster & Manage →</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }

          {houses.length > 0 && (
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
              <div style={{ background: '#1e3a5f', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'white', fontSize: 13 }}>📋 All Students — House Assignment</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{unassignedCount} unassigned</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#', 'GCC', 'Student', 'Batch', 'Course', 'Current House', 'Assign to House'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, i) => {
                    const h  = houses.find(h => normalizeHouse(h.name) === normalizeHouse(s.house))
                    const hs = h ? getHouseStyle(h) : null
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                        <td style={{ padding: '9px 14px', color: '#64748b' }}>{s.batch || '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#64748b' }}>{s.course || '—'}</td>
                        <td style={{ padding: '9px 14px' }}>
                          {s.house && hs
                            ? <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: hs.bg, color: hs.color }}>● {s.house}</span>
                            : <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>⚠ Not assigned</span>
                          }
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          {isAdmin ? (
                            <select value={s.house || ''} onChange={e => handleAssign(s.id, e.target.value)} style={{ ...inp, width: 150, padding: '6px 10px', fontSize: 12 }}>
                              <option value="">— Remove / None —</option>
                              {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.house || '—'}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredStudents.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No students found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB 7 — Housemasters
// ══════════════════════════════════════════════════════════════
const emptyHM = {
  name: '', house: '', phone: '', email: '', designation: '',
  assigned_date: today(), status: 'Active', remarks: '',
}

function HousemasterTab() {
  const [records,  setRecords]  = useState([])
  const [houses,   setHouses]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec,  setEditRec]  = useState(null)
  const [form,     setForm]     = useState(emptyHM)
  const [filter,   setFilter]   = useState('All')

  const load = async () => {
    setLoading(true)
    const [{ data: m }, { data: h }] = await Promise.all([
      supabase.from('housemasters').select('*').order('house'),
      supabase.from('houses').select('*').order('name'),
    ])
    setRecords(m || []); setHouses(h || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = editRec
      ? await supabase.from('housemasters').update(form).eq('id', editRec.id)
      : await supabase.from('housemasters').insert([form])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyHM); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!window.confirm('Remove this housemaster?')) return
    await supabase.from('housemasters').delete().eq('id', id); load()
  }

  const getHouseStyle = houseName => {
    const h = houses.find(h => normalizeHouse(h.name) === normalizeHouse(houseName))
    if (!h) return HOUSE_COLORS[0]
    return HOUSE_COLORS[(Number(h.color_index) || 0) % HOUSE_COLORS.length]
  }

  const houseNames = houses.map(h => h.name)
  const filtered   = filter === 'All' ? records : records.filter(r => r.house === filter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, color: '#64748b' }}>
            {records.length} housemasters across {[...new Set(records.map(r => r.house))].length} houses
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, width: 'auto', fontSize: 12, padding: '6px 10px' }}>
            <option value="All">All Houses</option>
            {houseNames.map(h => <option key={h}>{h}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyHM) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Add Housemaster'}
        </button>
      </div>

      {houses.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          ⚠️ No houses created yet. Go to the 🏠 Houses tab first.
        </div>
      )}

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>{editRec ? '✏️ Edit Housemaster' : '➕ Add Housemaster'}</h3>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div><label style={lbl}>Full Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={inp} /></div>
              <div>
                <label style={lbl}>Assigned House *</label>
                <select value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} required style={inp}>
                  <option value="">— Select House —</option>
                  {houseNames.map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Designation</label><input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Housemaster" style={inp} /></div>
              <div><label style={lbl}>Assigned Date</label><input type="date" value={form.assigned_date} onChange={e => setForm(f => ({ ...f, assigned_date: e.target.value }))} style={inp} /></div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
              <div><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16 }}>
            {filtered.map(r => {
              const hs = getHouseStyle(r.house)
              return (
                <div key={r.id} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)', border: `1px solid ${hs.border}` }}>
                  <div style={{ height: 4, background: hs.color }} />
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.designation || 'Housemaster'}</div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: hs.bg, color: hs.color }}>🏠 {r.house || '—'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 3 }}>
                      {r.phone && <div>📞 {r.phone}</div>}
                      {r.email && <div>✉️ {r.email}</div>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Since {r.assigned_date || '—'}</div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: r.status === 'Active' ? '#dcfce7' : '#fee2e2', color: r.status === 'Active' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{r.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => { setEditRec(r); setForm({ ...r }); setShowForm(true) }} style={{ flex: 1, ...btn('#eff6ff', '#1e3a5f'), fontSize: 12, padding: '7px' }}>✏️ Edit</button>
                      <button onClick={() => handleDelete(r.id)} style={{ flex: 1, ...btn('#fee2e2', '#dc2626'), fontSize: 12, padding: '7px' }}>🗑 Remove</button>
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                {records.length === 0 ? 'No housemasters assigned yet' : `No housemasters in ${filter}`}
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB 8 — Kitchen
// ══════════════════════════════════════════════════════════════
const emptyMeal  = { date: today(), meal_type: 'Breakfast', menu: '', prepared_by: '', served_count: 0, remarks: '' }
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Tea', 'Dinner']

function KitchenTab() {
  const [records,    setRecords]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(emptyMeal)
  const [search,     setSearch]     = useState('')
  const [mealFilter, setMealFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState(today())

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('kitchen_records').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('kitchen_records').insert([{ ...form, served_count: Number(form.served_count) || 0 }])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyMeal); setShowForm(false); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this kitchen record?')) return
    await supabase.from('kitchen_records').delete().eq('id', id); load()
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r =>
      (mealFilter === 'All' || r.meal_type === mealFilter) &&
      (!dateFilter || r.date === dateFilter) &&
      [r.menu, r.prepared_by, r.remarks].some(v => (v || '').toLowerCase().includes(q))
    )
  }, [records, search, mealFilter, dateFilter])

  const todayRecords = records.filter(r => r.date === today())

  return (
    <div>
      {/* FIXED: was repeat(5,1fr) — worst mobile offender */}
      <div style={statGrid(130)}>
        <StatCard icon="📋" label="Total Records" value={records.length} color="#1e3a5f" bg="#eff6ff" />
        {MEAL_TYPES.map((m, i) => {
          const colors = ['#ca8a04', '#16a34a', '#0891b2', '#7c3aed']
          const bgs    = ['#fef9c3', '#dcfce7', '#e0f2fe', '#f5f3ff']
          return (
            <StatCard key={m}
              icon={['🌅', '☀️', '☕', '🌙'][i]}
              label={`Today's ${m}`}
              value={todayRecords.filter(r => r.meal_type === m).length > 0 ? '✓' : '—'}
              color={colors[i]} bg={bgs[i]}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <select value={mealFilter} onChange={e => setMealFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Meals</option>
            {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
          </select>
          <input placeholder="🔍 Search menu, staff..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 120 }} />
        </div>
        <button onClick={() => setShowForm(!showForm)} style={btn()}>{showForm ? '✖ Cancel' : '➕ Log Meal'}</button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>➕ Log Kitchen Record</h3>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} />
              </div>
              <div>
                <label style={lbl}>Meal Type *</label>
                <select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))} required style={inp}>
                  {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Menu / Items *</label>
                <textarea value={form.menu} onChange={e => setForm(f => ({ ...f, menu: e.target.value }))} required rows={2} placeholder="e.g. Rice, Dal, Sabzi, Roti..." style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div>
                <label style={lbl}>Prepared By</label>
                <input value={form.prepared_by} onChange={e => setForm(f => ({ ...f, prepared_by: e.target.value }))} placeholder="Cook / staff name" style={inp} />
              </div>
              <div>
                <label style={lbl}>Students Served</label>
                <input type="number" min={0} value={form.served_count} onChange={e => setForm(f => ({ ...f, served_count: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Remarks</label>
                <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Any remarks..." style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Log Meal'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'Date', 'Meal', 'Menu', 'Prepared By', 'Served', 'Remarks', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r.date}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#eff6ff', color: '#1e3a5f' }}>{r.meal_type}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.menu}>{r.menu}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.prepared_by || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>{r.served_count || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.remarks || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No kitchen records found</td></tr>
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
//  ROOT — Hostel module (Updated with new House Master features)
// ══════════════════════════════════════════════════════════════
function Hostel() {
  const [activeTab,     setActiveTab]     = useState('hmdashboard')
  const [students,      setStudents]      = useState([])
  const [staffProfiles, setStaffProfiles] = useState([])
  const [dataLoading,   setDataLoading]   = useState(true)
  const [mobile,        setMobile]        = useState(isMobile())
  const [currentHousemaster, setCurrentHousemaster] = useState(null)
  const [houseColorMap, setHouseColorMap] = useState({})  // ← ADD THIS
  const currentUser = JSON.parse(localStorage.getItem('gnsi_user') || sessionStorage.getItem('gnsi_user') || '{}')
const userRole = (currentUser?.role || '').toLowerCase()
const isAdmin = userRole === 'admin'
const isHM = userRole === 'house master'

  // Track mobile state
  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const fetchShared = async () => {
      setDataLoading(true)
      const [{ data: s, error: e1 }, { data: st, error: e2 }, { data: hm, error: e3 }, { data: houses, error: e4 }] = await Promise.all([
        supabase.from('students').select('id,name,gcc_no,class_name,batch,course,house,hostel_type,status,admission_no,dob').order('name'),
        supabase.from('staff_profiles').select('id,name,designation,department,status').order('name'),
        supabase.from('housemasters').select('*').eq('status', 'Active').limit(1).maybeSingle(),
        supabase.from('houses').select('name, color_index'),
      ])
      if (e1) console.error('Students fetch error:', e1)
      if (e2) console.error('Staff fetch error:', e2)
      if (e3) console.error('Housemaster fetch error:', e3)
      if (e4) console.error('Houses fetch error:', e4)
      console.log('Loaded:', s?.length, 'students,', st?.length, 'staff | sample:', s?.[0])
      setStudents(s || [])
      setStaffProfiles(st || [])
      setCurrentHousemaster(hm || null)
      
      // Load house colors
      if (houses?.length) {
        const colorMap = {}
        const palette = ['#1d4ed8', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed', '#0891b2', '#be185d', '#047857']
        houses.forEach(h => {
          colorMap[h.name] = palette[Number(h.color_index) % palette.length]
        })
        setHouseColorMap(colorMap)
      }
      
      setDataLoading(false)
    }
    fetchShared()
  }, [])

  const standaloneTab = activeTab === 'schedule' || activeTab === 'kitchen' || activeTab === 'housemaster' || activeTab === 'adminmonitor'

  const tabContent = {
    allotments:   <DayScholarTab  students={students} />,
    schedule:     <ScheduleTab />,
    nightduty:    <NightDutyTab   staffProfiles={staffProfiles} />,
    discipline:   <DisciplineTab  students={students} />,
    sickbay:      <SickbayTab     students={students} />,
    house: <HouseTab students={students} currentUser={currentUser} houseColorMap={houseColorMap} />,
    housemaster:  <HousemasterTab />,
    kitchen:      <KitchenTab />,
    hmactivities: <HousemasterActivitiesTab staffProfiles={staffProfiles} currentUser={currentUser} />,
    adminmonitor: <AdminMonitorTab staffProfiles={staffProfiles} />,
    // ─── NEW TABS ──────────────────────────────────────
    attendance:   <AttendanceTab  students={students} currentHousemaster={currentHousemaster} />,
    leave:        <LeaveTab students={students} currentHousemaster={currentHousemaster} currentUser={currentUser} />,
    hmdashboard:  <HMDashboard    students={students} staffProfiles={staffProfiles} currentHousemaster={currentHousemaster} />,
    maintenance: <MaintenanceTab currentHousemaster={currentHousemaster} currentUser={currentUser} />,
    journal:      <JournalTab     currentHousemaster={currentHousemaster} />,
    classtimetable: <ClassTimetableTab />,
    doubtsession:   <DoubtSessionTab  />,
  }

  return (
    <div style={{ padding: mobile ? '12px' : '24px', fontFamily: 'system-ui,sans-serif', paddingBottom: mobile ? '80px' : '24px' }}>
      <div style={{ marginBottom: mobile ? '16px' : '24px' }}>
        <h1 style={{ fontSize: mobile ? '20px' : '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>
          🏠 Hostel Management
        </h1>
        <p style={{ color: '#64748b', fontSize: mobile ? '13px' : '14px', margin: '4px 0 0' }}>
          {mobile ? 'Allotments · Schedule · Duty · Discipline · Sickbay · House · Kitchen · Roll Call · Leave · Dashboard · Repairs · Journal' : 'Allotments · Schedule · Night Duty · Discipline · Sickbay · House · Kitchen'}
          {dataLoading
            ? <span style={{ marginLeft: 12, color: '#f59e0b', fontWeight: 600 }}>⏳ Loading...</span>
            : <span style={{ marginLeft: 12, color: '#16a34a', fontWeight: 600 }}>✅ {students.length} students · {staffProfiles.length} staff</span>
          }
        </p>
      </div>
      {/* Desktop/Tablet Tab Bar — GRID (no scroll, no missing tabs) */}
      {!mobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '6px',
          marginBottom: '24px',
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '9px 10px',
              border: 'none',
              borderRadius: '10px',
              background: activeTab === t.id ? '#1e3a5f' : '#f1f5f9',
              color: activeTab === t.id ? 'white' : '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === t.id ? 700 : 500,
              whiteSpace: 'nowrap',
              textAlign: 'center',
              transition: 'all .15s',
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Mobile Tab Grid — stat card style */}
      {mobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
        }}>
          {TABS.map(t => {
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '10px 6px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? '#1e3a5f' : 'white',
                  color: isActive ? 'white' : '#64748b',
                  fontSize: '11px',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(30,58,95,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  minHeight: '56px',
                  justifyContent: 'center',
                  lineHeight: 1.2,
                  textAlign: 'center',
                  borderLeft: isActive ? 'none' : '3px solid #e2e8f0',
                }}
              >
                <span style={{ fontSize: '18px' }}>{t.label.split(' ')[0]}</span>
                <span>{t.label.split(' ').slice(1).join(' ')}</span>
              </button>
            )
          })}
        </div>
      )}

      {dataLoading && !standaloneTab
        ? (
          <div style={{ textAlign: 'center', padding: mobile ? '40px' : '60px', color: '#64748b' }}>
            <div style={{ fontSize: mobile ? '24px' : '32px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontSize: mobile ? '14px' : '15px', fontWeight: 600 }}>Loading student & staff data...</div>
            <div style={{ fontSize: '13px', marginTop: '6px', color: '#94a3b8' }}>This only happens once on first load</div>
          </div>
        )
        : tabContent[activeTab]
      }
    </div>
  )
}
export default Hostel;
