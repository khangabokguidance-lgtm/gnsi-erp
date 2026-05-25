import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { HousemasterActivitiesTab, AdminMonitorTab } from './HousemasterActivitiesEnhanced'

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
  { id: 'nightduty',   label: '🌙 Night' },
  { id: 'allotments',  label: '🛏️ Rooms' },
  // ─── NEW: House Master Daily Features ──────────────────
  { id: 'attendance',  label: '✓ Roll Call' },
  { id: 'leave',       label: '🚪 Leave' },
  { id: 'hmdashboard', label: '📊 HM Dash' },
  { id: 'maintenance',  label: '🔧 Repairs' },
  { id: 'journal',     label: '📝 Journal' },
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
//  TAB: ATTENDANCE / ROLL CALL (Feature #1 - NEW)
// ══════════════════════════════════════════════════════════════
const ATTENDANCE_TYPES = ['Present', 'Absent', 'Late', 'On Leave', 'Sick']

function AttendanceTab({ students, currentHousemaster }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(today())
  const [session, setSession] = useState('morning') // morning, night
  const [filterHouse, setFilterHouse] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [bulkStatus, setBulkStatus] = useState('Present')
  const [showBulk, setShowBulk] = useState(false)
  const mobile = useMobileView()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('date', date)
      .eq('session', session)
      .order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [date, session])

  const handleMark = async (studentId, status, remarks = '') => {
    setSaving(true)
    const existing = records.find(r => r.student_id === studentId)
    const student = students.find(s => s.id === studentId)

    const payload = {
      date,
      session,
      student_id: studentId,
      student_name: student?.name || '',
      gcc_no: student?.gcc_no || null,
      class_name: getStudentClass(student),
      house: student?.house || '',
      status,
      remarks,
      marked_by: currentHousemaster?.name || 'System',
      marked_at: new Date().toISOString(),
    }

    const { error } = existing
      ? await supabase.from('attendance_records').update({ status, remarks, marked_by: payload.marked_by, marked_at: payload.marked_at }).eq('id', existing.id)
      : await supabase.from('attendance_records').insert([payload])

    if (error) alert('Error: ' + error.message)
    else load()
    setSaving(false)
  }

  const handleBulkMark = async (studentIds) => {
    if (!window.confirm(`Mark ${studentIds.length} students as ${bulkStatus}?`)) return
    setSaving(true)
    const payloads = studentIds.map(id => {
      const student = students.find(s => s.id === id)
      return {
        date, session,
        student_id: id,
        student_name: student?.name || '',
        gcc_no: student?.gcc_no || null,
        class_name: getStudentClass(student),
        house: student?.house || '',
        status: bulkStatus,
        marked_by: currentHousemaster?.name || 'System',
        marked_at: new Date().toISOString(),
      }
    })

    // Delete existing for these students first
    await supabase.from('attendance_records').delete().eq('date', date).eq('session', session).in('student_id', studentIds)
    const { error } = await supabase.from('attendance_records').insert(payloads)

    if (error) alert('Error: ' + error.message)
    else { setShowBulk(false); load() }
    setSaving(false)
  }

  const houses = [...new Set(students.map(s => s.house).filter(Boolean))]

  const filteredStudents = useMemo(() => {
    let filtered = students.filter(s => s.status !== 'Inactive')
    if (filterHouse !== 'All') filtered = filtered.filter(s => s.house === filterHouse)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(s => 
        (s.name || '').toLowerCase().includes(q) ||
        String(s.gcc_no || '').includes(q)
      )
    }
    return filtered.sort((a, b) => (a.house || '').localeCompare(b.house || '') || (a.name || '').localeCompare(b.name || ''))
  }, [students, filterHouse, search])

  const stats = useMemo(() => {
    const byStatus = {}
    ATTENDANCE_TYPES.forEach(t => byStatus[t] = records.filter(r => r.status === t).length)
    const unmarked = filteredStudents.length - records.length
    return { ...byStatus, Unmarked: Math.max(0, unmarked), Total: filteredStudents.length }
  }, [records, filteredStudents])

  const getStudentStatus = (studentId) => {
    const rec = records.find(r => r.student_id === studentId)
    return rec?.status || 'Unmarked'
  }

  // Mobile card view
  if (mobile) {
    return (
      <div>
        {/* Mobile Stats */}
        <div style={mobileStatGrid}>
          <StatCard icon="👥" label="Total" value={stats.Total} color="#1e3a5f" bg="#eff6ff" compact />
          <StatCard icon="✅" label="Present" value={stats.Present} color="#16a34a" bg="#dcfce7" compact />
          <StatCard icon="❌" label="Absent" value={stats.Absent} color="#dc2626" bg="#fee2e2" compact />
          <StatCard icon="⏰" label="Late" value={stats.Late} color="#ca8a04" bg="#fef9c3" compact />
        </div>

        {/* Mobile Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, flex: 1 }} />
            <select value={session} onChange={e => setSession(e.target.value)} style={{ ...inp, width: 'auto', flex: 1 }}>
              <option value="morning">🌅 Morning</option>
              <option value="night">🌙 Night</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={filterHouse} onChange={e => setFilterHouse(e.target.value)} style={{ ...inp, flex: 1 }}>
              <option value="All">All Houses</option>
              {houses.map(h => <option key={h}>{h}</option>)}
            </select>
            <input 
              placeholder="🔍 Search..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ ...inp, flex: 1 }} 
              type="search"
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ ...inp, flex: 1 }}>
              {ATTENDANCE_TYPES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button 
              onClick={() => setShowBulk(!showBulk)} 
              style={{ ...btn(showBulk ? '#dc2626' : '#1e3a5f'), flex: 1, fontSize: '13px' }}
            >
              {showBulk ? '✕ Cancel' : '⚡ Bulk'}
            </button>
          </div>
        </div>

        {showBulk && (
          <div style={{ ...mobileCard, marginBottom: '12px', background: '#eff6ff' }}>
            <p style={{ fontSize: '13px', margin: '0 0 10px', color: '#1e3a5f', fontWeight: '600' }}>
              Select students to mark as <span style={{ color: bulkStatus === 'Absent' ? '#dc2626' : '#16a34a' }}>{bulkStatus}</span>
            </p>
            <button 
              onClick={() => handleBulkMark(filteredStudents.map(s => s.id))}
              disabled={saving}
              style={{ ...btn(saving ? '#94a3b8' : bulkStatus === 'Absent' ? '#dc2626' : '#16a34a'), width: '100%' }}
            >
              {saving ? '⏳ Saving...' : `✓ Mark All ${filteredStudents.length} as ${bulkStatus}`}
            </button>
          </div>
        )}

        {/* Mobile Student Cards */}
        <MobileCardList>
          {filteredStudents.map(student => {
            const status = getStudentStatus(student.id)
            const rec = records.find(r => r.student_id === student.id)
            return (
              <MobileRecordCard key={student.id} accentColor={status === 'Present' ? '#16a34a' : status === 'Absent' ? '#dc2626' : status === 'Late' ? '#ca8a04' : status === 'Sick' ? '#7c3aed' : '#94a3b8'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{student.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      GCC-{student.gcc_no || '--'} · {getStudentClass(student) || '--'}
                      {student.house && <span> · 🏠 {student.house}</span>}
                    </div>
                  </div>
                  <span style={statusStyle(status)}>{status}</span>
                </div>
                {rec?.remarks && (
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontStyle: 'italic' }}>
                    "{rec.remarks}"
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  {ATTENDANCE_TYPES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleMark(student.id, s)}
                      disabled={saving}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: 'none',
                        background: status === s ? (s === 'Present' ? '#16a34a' : s === 'Absent' ? '#dc2626' : s === 'Late' ? '#ca8a04' : s === 'Sick' ? '#7c3aed' : '#1e3a5f') : '#f1f5f9',
                        color: status === s ? 'white' : '#64748b',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        minHeight: '40px',
                      }}
                    >
                      {s === 'Present' ? '✓' : s === 'Absent' ? '✕' : s === 'Late' ? '⏰' : s === 'Sick' ? '🏥' : '🚪'} {s}
                    </button>
                  ))}
                </div>
                <input
                  placeholder="Add remark..."
                  defaultValue={rec?.remarks || ''}
                  onBlur={e => { if (e.target.value && rec) handleMark(student.id, rec.status, e.target.value) }}
                  style={{ ...inp, marginTop: '8px', fontSize: '13px', padding: '8px 10px' }}
                />
              </MobileRecordCard>
            )
          })}
        </MobileCardList>

        {filteredStudents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No students found</div>
        )}
      </div>
    )
  }

  // Desktop table view
  return (
    <div>
      <div style={statGrid(120)}>
        <StatCard icon="👥" label="Total" value={stats.Total} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="✅" label="Present" value={stats.Present} color="#16a34a" bg="#dcfce7" />
        <StatCard icon="❌" label="Absent" value={stats.Absent} color="#dc2626" bg="#fee2e2" />
        <StatCard icon="⏰" label="Late" value={stats.Late} color="#ca8a04" bg="#fef9c3" />
        <StatCard icon="🏥" label="Sick" value={stats.Sick} color="#7c3aed" bg="#f5f3ff" />
        <StatCard icon="🚪" label="On Leave" value={stats['On Leave']} color="#1d4ed8" bg="#dbeafe" />
        <StatCard icon="⚪" label="Unmarked" value={stats.Unmarked} color="#94a3b8" bg="#f1f5f9" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <select value={session} onChange={e => setSession(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="morning">🌅 Morning Roll Call</option>
            <option value="night">🌙 Night Roll Call</option>
          </select>
          <select value={filterHouse} onChange={e => setFilterHouse(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Houses</option>
            {houses.map(h => <option key={h}>{h}</option>)}
          </select>
          <input placeholder="🔍 Search student..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ ...inp, width: 'auto' }}>
            {ATTENDANCE_TYPES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => handleBulkMark(filteredStudents.map(s => s.id))} disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>
            {saving ? '⏳...' : `⚡ All ${bulkStatus}`}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'GCC', 'Student', 'Batch', 'House', 'Status', 'Remark', 'Marked By', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, i) => {
                const status = getStudentStatus(s.id)
                const rec = records.find(r => r.student_id === s.id)
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#1e3a5f', fontWeight: 700 }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{getStudentClass(s) || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#7c3aed', fontSize: '12px', fontWeight: 600 }}>{s.house || '—'}</td>
                    <td style={{ padding: '11px 14px' }}><span style={statusStyle(status)}>{status}</span></td>
                    <td style={{ padding: '11px 14px' }}>
                      <input 
                        defaultValue={rec?.remarks || ''}
                        placeholder="Remark..."
                        onBlur={e => { if (rec && e.target.value !== rec.remarks) handleMark(s.id, rec.status, e.target.value) }}
                        style={{ ...inp, padding: '5px 8px', fontSize: '12px', width: 140 }}
                      />
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{rec?.marked_by || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {ATTENDANCE_TYPES.map(st => (
                          <button 
                            key={st}
                            onClick={() => handleMark(s.id, st, rec?.remarks || '')}
                            disabled={saving}
                            style={{
                              padding: '4px 8px', borderRadius: '6px', border: 'none',
                              background: status === st ? (st === 'Present' ? '#16a34a' : st === 'Absent' ? '#dc2626' : '#1e3a5f') : '#f1f5f9',
                              color: status === st ? 'white' : '#64748b',
                              fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                            }}
                          >
                            {st[0]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  TAB: LEAVE / OUTING MANAGEMENT (Feature #2 - NEW)
// ══════════════════════════════════════════════════════════════
const LEAVE_TYPES = ['Home Leave', 'Day Outing', 'Night Out', 'Weekend Leave', 'Emergency']
const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Overdue', 'Returned']

function LeaveTab({ students, currentHousemaster }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [filterStatus, setFilterStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('requests') // requests, history
  const mobile = useMobileView()

  const [form, setForm] = useState({
    student_id: null, student_name: '', gcc_no: '', class_name: '', house: '',
    leave_type: 'Home Leave', from_date: today(), to_date: today(),
    expected_return: '', actual_return: '', purpose: '',
    parent_contact: '', parent_approved: false,
    status: 'Pending', remarks: '',
  })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('leave_records').select('*').order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Auto-flag overdue
  useEffect(() => {
    const now = new Date()
    const overdueIds = records
      .filter(r => r.status === 'Approved' && r.expected_return && new Date(r.expected_return) < now && !r.actual_return)
      .map(r => r.id)
    if (overdueIds.length > 0) {
      overdueIds.forEach(async id => {
        await supabase.from('leave_records').update({ status: 'Overdue' }).eq('id', id)
      })
      if (overdueIds.length > 0) load()
    }
  }, [records])

  const handleStudentSelect = s => {
    setForm(f => ({
      ...f, student_id: s.id, student_name: s.name || '',
      gcc_no: s.gcc_no || '', class_name: getStudentClass(s),
      house: s.house || '',
    }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      requested_by: currentHousemaster?.name || 'Student',
      requested_at: editRec ? form.requested_at : new Date().toISOString(),
    }
    const { error } = editRec
      ? await supabase.from('leave_records').update(payload).eq('id', editRec.id)
      : await supabase.from('leave_records').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm({ ...form, student_id: null, student_name: '', gcc_no: '', purpose: '', parent_contact: '', remarks: '' }); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    const updates = { status, approved_by: currentHousemaster?.name || 'Admin', approved_at: new Date().toISOString() }
    if (status === 'Returned') updates.actual_return = today()
    await supabase.from('leave_records').update(updates).eq('id', id)
    load()
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this leave record?')) return
    await supabase.from('leave_records').delete().eq('id', id)
    load()
  }

  const filtered = useMemo(() => {
    let filtered = records
    if (activeTab === 'requests') filtered = filtered.filter(r => ['Pending', 'Approved', 'Overdue'].includes(r.status))
    if (filterStatus !== 'All') filtered = filtered.filter(r => r.status === filterStatus)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(r =>
        (r.student_name || '').toLowerCase().includes(q) ||
        String(r.gcc_no || '').includes(q) ||
        (r.house || '').toLowerCase().includes(q)
      )
    }
    return filtered
  }, [records, filterStatus, search, activeTab])

  const stats = {
    pending: records.filter(r => r.status === 'Pending').length,
    approved: records.filter(r => r.status === 'Approved').length,
    overdue: records.filter(r => r.status === 'Overdue').length,
    returned: records.filter(r => r.status === 'Returned').length,
  }

  if (mobile) {
    return (
      <div>
        <div style={mobileStatGrid}>
          <StatCard icon="⏳" label="Pending" value={stats.pending} color="#ca8a04" bg="#fef9c3" compact />
          <StatCard icon="✅" label="Approved" value={stats.approved} color="#16a34a" bg="#dcfce7" compact />
          <StatCard icon="⚠️" label="Overdue" value={stats.overdue} color="#dc2626" bg="#fee2e2" compact />
          <StatCard icon="🏠" label="Returned" value={stats.returned} color="#1e3a5f" bg="#eff6ff" compact />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {['requests', 'history'].map(t => (
            <button 
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === t ? '#1e3a5f' : '#f1f5f9',
                color: activeTab === t ? 'white' : '#64748b',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {t === 'requests' ? '📋 Active' : '📜 History'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} type="search" />
          <button onClick={() => { setShowForm(!showForm); setEditRec(null) }} style={{ ...btn(), padding: '10px 14px' }}>
            {showForm ? '✕' : '➕'}
          </button>
        </div>

        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', margin: '0 0 12px' }}>
              {editRec ? '✏️ Edit Leave' : '🚪 New Leave Request'}
            </h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={lbl}>Student</label>
                  <StudentSearchInput students={students} onSelect={handleStudentSelect} placeholder="Search student..." />
                  {form.student_name && (
                    <div style={{ marginTop: '6px', padding: '6px 10px', background: '#dcfce7', borderRadius: '6px', fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>
                      ✅ {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>From *</label>
                    <input type="date" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} required style={inp} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>To *</label>
                    <input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} required style={inp} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Expected Return</label>
                  <input type="datetime-local" value={form.expected_return} onChange={e => setForm(f => ({ ...f, expected_return: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Leave Type</label>
                  <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))} style={inp}>
                    {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Purpose</label>
                  <textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} rows={2} placeholder="Reason for leave..." style={{ ...inp, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={lbl}>Parent Contact</label>
                  <input value={form.parent_contact} onChange={e => setForm(f => ({ ...f, parent_contact: e.target.value }))} placeholder="Phone number" style={inp} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#16a34a'), flex: 1 }}>{saving ? '⏳' : '✓ Save'}</button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        )}

        <MobileCardList>
          {filtered.map(r => (
            <MobileRecordCard key={r.id} accentColor={
              r.status === 'Pending' ? '#ca8a04' : 
              r.status === 'Approved' ? '#16a34a' : 
              r.status === 'Overdue' ? '#dc2626' : 
              r.status === 'Rejected' ? '#dc2626' : '#1e3a5f'
            }>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{r.student_name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    GCC-{r.gcc_no || '--'} · {r.house || '—'}
                  </div>
                </div>
                <span style={statusStyle(r.status)}>{r.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                <div>📅 {r.from_date} → {r.to_date}</div>
                <div>🚪 {r.leave_type}</div>
                {r.expected_return && <div>⏰ Return: {r.expected_return}</div>}
                {r.actual_return && <div>🏠 Returned: {r.actual_return}</div>}
                {r.parent_contact && <div>📞 {r.parent_contact}</div>}
              </div>
              {r.purpose && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>{r.purpose}</div>}
              {r.status === 'Pending' && (
                <MobileActionButtons actions={[
                  { label: '✓ Approve', onClick: () => handleStatusChange(r.id, 'Approved'), bg: '#dcfce7', color: '#16a34a' },
                  { label: '✕ Reject', onClick: () => handleStatusChange(r.id, 'Rejected'), bg: '#fee2e2', color: '#dc2626' },
                ]} />
              )}
              {r.status === 'Approved' && (
                <MobileActionButtons actions={[
                  { label: '🏠 Mark Returned', onClick: () => handleStatusChange(r.id, 'Returned'), bg: '#dbeafe', color: '#1d4ed8', fullWidth: true },
                ]} />
              )}
              {r.status === 'Overdue' && (
                <div style={{ background: '#fee2e2', padding: '8px', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: '600', marginTop: '8px' }}>
                  ⚠️ Student is overdue! Contact parent: {r.parent_contact || 'N/A'}
                </div>
              )}
            </MobileRecordCard>
          ))}
        </MobileCardList>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No leave records found</div>
        )}
      </div>
    )
  }

  // Desktop view
  return (
    <div>
      <div style={statGrid(130)}>
        <StatCard icon="⏳" label="Pending Approval" value={stats.pending} color="#ca8a04" bg="#fef9c3" />
        <StatCard icon="✅" label="Currently Out" value={stats.approved} color="#16a34a" bg="#dcfce7" />
        <StatCard icon="⚠️" label="Overdue Returns" value={stats.overdue} color="#dc2626" bg="#fee2e2" />
        <StatCard icon="🏠" label="Returned" value={stats.returned} color="#1e3a5f" bg="#eff6ff" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search student..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            {LEAVE_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Request Leave'}
        </button>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>
            {editRec ? '✏️ Edit Leave' : '🚪 New Leave Request'}
          </h3>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Search Student</label>
                <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                {form.student_name && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#dcfce7', borderRadius: '8px', fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>
                    ✅ {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                  </div>
                )}
              </div>
              <div><label style={lbl}>From Date *</label><input type="date" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>To Date *</label><input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Expected Return</label><input type="datetime-local" value={form.expected_return} onChange={e => setForm(f => ({ ...f, expected_return: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Leave Type</label><select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))} style={inp}>{LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Purpose</label><textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} rows={2} placeholder="Reason..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div><label style={lbl}>Parent Contact</label><input value={form.parent_contact} onChange={e => setForm(f => ({ ...f, parent_contact: e.target.value }))} placeholder="Phone" style={inp} /></div>
              <div><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 1000 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'Student', 'GCC', 'Type', 'From', 'To', 'Return By', 'Status', 'Parent', 'Actions'].map(h => (
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
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '11px 14px', fontWeight: '600', color: '#1e293b' }}>{r.student_name}</td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '12px' }}>{r.gcc_no ? `GCC-${r.gcc_no}` : '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.leave_type}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{r.from_date}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{r.to_date}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{r.expected_return ? new Date(r.expected_return).toLocaleString() : '—'}</td>
                  <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.status)}>{r.status}</span></td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{r.parent_contact || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {r.status === 'Pending' && (
                        <>
                          <button onClick={() => handleStatusChange(r.id, 'Approved')} style={{ ...btn('#16a34a'), fontSize: '11px', padding: '4px 8px' }}>✓</button>
                          <button onClick={() => handleStatusChange(r.id, 'Rejected')} style={{ ...btn('#dc2626'), fontSize: '11px', padding: '4px 8px' }}>✕</button>
                        </>
                      )}
                      {r.status === 'Approved' && (
                        <button onClick={() => handleStatusChange(r.id, 'Returned')} style={{ ...btn('#1d4ed8'), fontSize: '11px', padding: '4px 8px' }}>🏠</button>
                      )}
                      <button onClick={() => handleDelete(r.id)} style={{ ...btn('#fee2e2', '#dc2626'), fontSize: '11px', padding: '4px 8px' }}>🗑</button>
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
//  TAB: MAINTENANCE / REPAIRS (Feature #3 - NEW)
// ══════════════════════════════════════════════════════════════
const MAINTENANCE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const MAINTENANCE_STATUSES = ['Raised', 'Assigned', 'In Progress', 'Resolved', 'Closed']
const MAINTENANCE_CATEGORIES = ['Plumbing', 'Electrical', 'Furniture', 'Civil', 'Cleaning', 'IT', 'Other']

function MaintenanceTab({ currentHousemaster }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')
  const [search, setSearch] = useState('')
  const mobile = useMobileView()

  const [form, setForm] = useState({
    category: 'Plumbing', location: '', room_number: '',
    description: '', priority: 'Medium', status: 'Raised',
    reported_by: '', assigned_to: '', resolved_at: '',
    cost: '', remarks: '',
  })

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
      raised_at: editRec ? form.raised_at : new Date().toISOString(),
    }
    const { error } = editRec
      ? await supabase.from('maintenance_records').update(payload).eq('id', editRec.id)
      : await supabase.from('maintenance_records').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm({ category: 'Plumbing', location: '', room_number: '', description: '', priority: 'Medium', status: 'Raised', reported_by: '', assigned_to: '', resolved_at: '', cost: '', remarks: '' }); setShowForm(false); setEditRec(null); load() }
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
    let filtered = records
    if (filterStatus !== 'All') filtered = filtered.filter(r => r.status === filterStatus)
    if (filterPriority !== 'All') filtered = filtered.filter(r => r.priority === filterPriority)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(r =>
        (r.description || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q) ||
        (r.room_number || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q)
      )
    }
    return filtered
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
          <button onClick={() => { setShowForm(!showForm); setEditRec(null) }} style={{ ...btn(), padding: '10px 14px' }}>
            {showForm ? '✕' : '➕'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, flex: 1 }}>
            <option value="All">All Status</option>
            {MAINTENANCE_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...inp, flex: 1 }}>
            <option value="All">All Priority</option>
            {MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', margin: '0 0 12px' }}>🔧 New Complaint</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, flex: 1 }}>
                    {MAINTENANCE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ ...inp, flex: 1 }}>
                    {MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
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
            <MobileRecordCard key={r.id} accentColor={
              r.priority === 'Urgent' ? '#dc2626' : r.priority === 'High' ? '#ca8a04' : '#1e3a5f'
            }>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', background: '#eff6ff', padding: '2px 8px', borderRadius: '99px' }}>{r.category}</span>
                  <span style={{ marginLeft: '6px', ...statusStyle(r.priority) }}>{r.priority}</span>
                </div>
                <span style={statusStyle(r.status)}>{r.status}</span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>
                📍 {r.location}{r.room_number ? ` · Room ${r.room_number}` : ''}
              </div>
              <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>{r.description}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                Raised by {r.reported_by || '—'} · {new Date(r.raised_at).toLocaleDateString()}
              </div>
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

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No maintenance records</div>
        )}
      </div>
    )
  }

  // Desktop
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
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            {MAINTENANCE_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Priority</option>
            {MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Raise Complaint'}
        </button>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>🔧 New Maintenance Request</h3>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div>
                <label style={lbl}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>{MAINTENANCE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div>
                <label style={lbl}>Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inp}>{MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
              </div>
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'Category', 'Priority', 'Location', 'Room', 'Description', 'Status', 'Assigned', 'Raised', 'Actions'].map(h => (
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
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '11px 14px', fontWeight: '600', color: '#1e3a5f' }}>{r.category}</td>
                  <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.priority)}>{r.priority}</span></td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.location}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontFamily: 'monospace' }}>{r.room_number || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>{r.description}</div>
                  </td>
                  <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.status)}>{r.status}</span></td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.assigned_to || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{new Date(r.raised_at).toLocaleDateString()}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {r.status === 'Raised' && <button onClick={() => handleStatusChange(r.id, 'Assigned')} style={{ ...btn('#1d4ed8'), fontSize: '11px', padding: '4px 8px' }}>Assign</button>}
                      {r.status === 'Assigned' && <button onClick={() => handleStatusChange(r.id, 'In Progress')} style={{ ...btn('#ca8a04'), fontSize: '11px', padding: '4px 8px' }}>Start</button>}
                      {r.status === 'In Progress' && <button onClick={() => handleStatusChange(r.id, 'Resolved')} style={{ ...btn('#16a34a'), fontSize: '11px', padding: '4px 8px' }}>Resolve</button>}
                      {r.status === 'Resolved' && <button onClick={() => handleStatusChange(r.id, 'Closed')} style={{ ...btn('#374151'), fontSize: '11px', padding: '4px 8px' }}>Close</button>}
                      <button onClick={() => handleDelete(r.id)} style={{ ...btn('#fee2e2', '#dc2626'), fontSize: '11px', padding: '4px 8px' }}>🗑</button>
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
//  TAB: HOUSEMASTER DASHBOARD (Feature #4 - NEW)
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
        {/* Greeting */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>
            👋 Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
            {currentHousemaster?.name || 'House Master'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Night Duty Card */}
        {nightDutyTonight && (
          <div style={{ ...mobileCard, marginBottom: '16px', background: '#1e3a5f', color: 'white' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', opacity: 0.8 }}>🌙 TONIGHT'S DUTY</div>
            <div style={{ fontSize: '16px', fontWeight: '700' }}>{nightDutyTonight.staff1}{nightDutyTonight.staff2 ? ` & ${nightDutyTonight.staff2}` : ''}</div>
            <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.8 }}>{nightDutyTonight.shift} · {nightDutyTonight.post}</div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          {quickActions.map(action => (
            <button
              key={action.id}
              style={{
                background: action.bg,
                border: `1.5px solid ${action.color}20`,
                borderRadius: '14px',
                padding: '16px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minHeight: '90px',
              }}
            >
              <span style={{ fontSize: '24px' }}>{action.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: action.color }}>{action.label}</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{action.desc}</span>
            </button>
          ))}
        </div>

        {/* Alerts Section */}
        {(unmarkedCount > 0 || maintenanceOpen.length > 0 || sickbayToday.length > 0) && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 12px' }}>🚨 Requires Attention</h3>
            <MobileCardList>
              {unmarkedCount > 0 && (
                <MobileRecordCard accentColor="#ca8a04">
                  <div style={{ fontWeight: '700', color: '#ca8a04', fontSize: '14px' }}>⏳ {unmarkedCount} students unmarked for roll call</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Morning attendance pending</div>
                </MobileRecordCard>
              )}
              {maintenanceOpen.map(m => (
                <MobileRecordCard key={m.id} accentColor="#dc2626">
                  <div style={{ fontWeight: '700', color: '#dc2626', fontSize: '14px' }}>🔧 Urgent: {m.category} · {m.location}</div>
                  <div style={{ fontSize: '13px', color: '#374151', marginTop: '4px' }}>{m.description}</div>
                </MobileRecordCard>
              ))}
              {sickbayToday.map(s => (
                <MobileRecordCard key={s.id} accentColor="#7c3aed">
                  <div style={{ fontWeight: '700', color: '#7c3aed', fontSize: '14px' }}>🏥 {s.student_name} admitted</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{s.complaint}</div>
                </MobileRecordCard>
              ))}
            </MobileCardList>
          </div>
        )}

        {/* Today's Summary */}
        <div style={{ ...mobileCard }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 12px' }}>📊 Today's Snapshot</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: '#dcfce7', borderRadius: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a' }}>{presentCount}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Present</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#fee2e2', borderRadius: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626' }}>{absentCount}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Absent</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#dbeafe', borderRadius: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8' }}>{leaveToday.length}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>On Leave</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f5f3ff', borderRadius: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#7c3aed' }}>{sickbayToday.length}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>In Sickbay</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Desktop Dashboard
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>
            👋 Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {currentHousemaster?.name || 'House Master'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
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
            <div style={{ textAlign: 'center', padding: '16px', background: '#dcfce7', borderRadius: '10px' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>{presentCount}</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Present</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: '#fee2e2', borderRadius: '10px' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#dc2626' }}>{absentCount}</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Absent</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: '#dbeafe', borderRadius: '10px' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#1d4ed8' }}>{leaveToday.length}</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>On Leave</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: '#f5f3ff', borderRadius: '10px' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#7c3aed' }}>{sickbayToday.length}</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>In Sickbay</div>
            </div>
          </div>
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 16px' }}>🚨 Attention Required</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unmarkedCount > 0 && (
              <div style={{ padding: '12px', background: '#fef9c3', borderRadius: '10px', borderLeft: '3px solid #ca8a04' }}>
                <div style={{ fontWeight: '700', color: '#ca8a04' }}>⏳ {unmarkedCount} students unmarked</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Morning roll call pending</div>
              </div>
            )}
            {maintenanceOpen.map(m => (
              <div key={m.id} style={{ padding: '12px', background: '#fee2e2', borderRadius: '10px', borderLeft: '3px solid #dc2626' }}>
                <div style={{ fontWeight: '700', color: '#dc2626' }}>🔧 Urgent: {m.category}</div>
                <div style={{ fontSize: '13px', color: '#374151' }}>{m.location} · {m.description}</div>
              </div>
            ))}
            {disciplineOpen.slice(0, 3).map(d => (
              <div key={d.id} style={{ padding: '12px', background: '#fee2e2', borderRadius: '10px', borderLeft: '3px solid #dc2626' }}>
                <div style={{ fontWeight: '700', color: '#dc2626' }}>⚠️ {d.student_name}</div>
                <div style={{ fontSize: '13px', color: '#374151' }}>{d.incident}</div>
              </div>
            ))}
            {unmarkedCount === 0 && maintenanceOpen.length === 0 && disciplineOpen.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#16a34a', fontWeight: '600' }}>✅ All clear! No urgent items.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: HOUSEMASTER JOURNAL (Feature #5 - NEW)
// ══════════════════════════════════════════════════════════════
function JournalTab({ currentHousemaster }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(today())
  const [search, setSearch] = useState('')
  const mobile = useMobileView()

  const [form, setForm] = useState({
    entry_date: today(), entry_time: nowTime(),
    category: 'General', title: '', content: '',
    house: '', flagged: false,
  })

  const JOURNAL_CATEGORIES = ['General', 'Assembly', 'Discipline', 'Medical', 'Maintenance', 'Parent Call', 'Staff Handover', 'Inspection', 'Event']

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('housemaster_journal').select('*').order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      housemaster_name: currentHousemaster?.name || 'Unknown',
    }
    const { error } = await supabase.from('housemaster_journal').insert([payload])
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
    let filtered = entries
    if (date) filtered = filtered.filter(e => e.entry_date === date)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.content || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q)
      )
    }
    return filtered
  }, [entries, date, search])

  const categoryColors = {
    General: '#1e3a5f', Assembly: '#16a34a', Discipline: '#dc2626', Medical: '#7c3aed',
    Maintenance: '#ca8a04', 'Parent Call': '#1d4ed8', 'Staff Handover': '#0891b2',
    Inspection: '#374151', Event: '#059669',
  }

  if (mobile) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, flex: 1 }} />
          <button onClick={() => setShowForm(!showForm)} style={{ ...btn(), padding: '10px 14px' }}>
            {showForm ? '✕' : '📝'}
          </button>
        </div>

        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} required style={{ ...inp, flex: 1 }} />
                  <input type="time" value={form.entry_time} onChange={e => setForm(f => ({ ...f, entry_time: e.target.value }))} style={{ ...inp, flex: 1 }} />
                </div>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
                  {JOURNAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Entry title..." required style={inp} />
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} placeholder="Write your notes here..." required style={{ ...inp, resize: 'vertical' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151' }}>
                  <input type="checkbox" checked={form.flagged} onChange={e => setForm(f => ({ ...f, flagged: e.target.checked }))} style={{ width: '20px', height: '20px' }} />
                  🚩 Flag as important
                </label>
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
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', background: (categoryColors[e.category] || '#1e3a5f') + '15', color: categoryColors[e.category] || '#1e3a5f' }}>
                    {e.category}
                  </span>
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

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
            No journal entries for {date}
          </div>
        )}
      </div>
    )
  }

  // Desktop
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <input placeholder="🔍 Search entries..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
        </div>
        <button onClick={() => setShowForm(!showForm)} style={btn()}>
          {showForm ? '✖ Cancel' : '📝 New Entry'}
        </button>
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
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.flagged} onChange={e => setForm(f => ({ ...f, flagged: e.target.checked }))} />
                  🚩 Flag as important (visible to all housemasters)
                </label>
              </div>
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
                <span style={{ fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '99px', background: (categoryColors[e.category] || '#1e3a5f') + '15', color: categoryColors[e.category] || '#1e3a5f' }}>
                  {e.category}
                </span>
                {e.flagged && <span style={{ fontSize: '16px' }} title="Flagged">🚩</span>}
                <span style={{ fontSize: '13px', color: '#64748b' }}>{e.entry_date} · {e.entry_time}</span>
              </div>
              <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>🗑 Delete</button>
            </div>
            <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px' }}>{e.title}</h4>
            <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{e.content}</p>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px' }}>📝 {e.housemaster_name} {e.house && `· 🏠 ${e.house}`}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>No journal entries found</div>
          </div>
        )}
      </div>
    </div>
  )
}
// ══════════════════════════════════════════════════════════════
//  TAB 1 — Hostel Allotments
// ══════════════════════════════════════════════════════════════
const emptyAllot = {
  student_id: null, gcc_no: '', student_name: '', class_name: '',
  hostel_name: '', room_number: '', bed_number: '',
  allotment_date: today(), status: 'Occupied', remarks: '',
}

function AllotmentsTab({ students }) {
  const [records,      setRecords]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editRec,      setEditRec]      = useState(null)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [hostelFilter, setHostelFilter] = useState('All')
  const [form,         setForm]         = useState(emptyAllot)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('hostel_allotments').select('*').order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleStudentSelect = s => {
    setForm(f => ({
      ...f, student_id: s.id, gcc_no: s.gcc_no || '',
      student_name: s.name || '', class_name: getStudentClass(s),
      hostel_name: s.hostel_type || f.hostel_name,
    }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      student_id: form.student_id || null, gcc_no: form.gcc_no || null,
      student_name: form.student_name, class_name: form.class_name,
      hostel_name: form.hostel_name, room_number: form.room_number,
      bed_number: form.bed_number, allotment_date: form.allotment_date,
      status: form.status, remarks: form.remarks,
    }
    const { error } = editRec
      ? await supabase.from('hostel_allotments').update(payload).eq('id', editRec.id)
      : await supabase.from('hostel_allotments').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyAllot); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    await supabase.from('hostel_allotments').update({ status }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this allotment?')) return
    await supabase.from('hostel_allotments').delete().eq('id', id)
    load()
  }

  const openEdit = rec => {
    setEditRec(rec)
    setForm({
      ...rec,
      housemaster_name: rec.housemaster_name || '',
      house: rec.house || '',
      description: rec.description || '',
      outcome: rec.outcome || '',
      status: rec.status || 'Completed',
    })
    setShowForm(true)
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
      (statusFilter === 'All' || r.status === statusFilter) &&
      (hostelFilter === 'All' || r.hostel_name === hostelFilter) &&
      [r.student_name, r.class_name, r.hostel_name, r.room_number, r.bed_number, r.gcc_no, r.remarks]
        .some(v => (v || '').toLowerCase().includes(q))
    )
  }, [enriched, search, statusFilter, hostelFilter])

  const uniqueHostels = [...new Set(records.map(r => r.hostel_name).filter(Boolean))]
  const occupied = records.filter(r => r.status === 'Occupied').length
  const vacant   = records.filter(r => r.status === 'Vacant').length
  const shifted  = records.filter(r => r.status === 'Shifted').length

  return (
    <div>
      {/* FIXED: was repeat(4,1fr) */}
      <div style={statGrid()}>
        <StatCard icon="📋" label="Total"    value={records.length} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="🛏️" label="Occupied" value={occupied}       color="#16a34a" bg="#dcfce7" />
        <StatCard icon="🚪" label="Vacant"   value={vacant}         color="#dc2626" bg="#fee2e2" />
        <StatCard icon="🔄" label="Shifted"  value={shifted}        color="#ca8a04" bg="#fef9c3" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search student, room, hostel..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 200 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            {['Occupied', 'Vacant', 'Shifted', 'Vacated'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={hostelFilter} onChange={e => setHostelFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Hostels</option>
            {uniqueHostels.map(h => <option key={h}>{h}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyAllot) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Add Allotment'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '4px' }}>
            {editRec ? '✏️ Edit Allotment' : '➕ Add Hostel Allotment'}
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>🔗 Student data is pulled live from the Students module</p>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>🔍 Search & Select Student (live from Students module)</label>
                <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                {form.student_id && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#dcfce7', borderRadius: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    ✅ Linked: {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>GCC No. <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label>
                <input value={form.gcc_no || ''} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} placeholder="e.g. 729" style={inp} />
              </div>
              <div>
                <label style={lbl}>Student Name *</label>
                <input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} required placeholder="Auto-filled from search" style={inp} />
              </div>
              <div>
                <label style={lbl}>Batch / Class <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label>
                <input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} placeholder="Auto-filled from student" style={inp} />
              </div>
              <div>
                <label style={lbl}>Hostel Name *</label>
                <input value={form.hostel_name} onChange={e => setForm(f => ({ ...f, hostel_name: e.target.value }))} required placeholder="Boarder / Day Scholar" style={inp} />
              </div>
              <div>
                <label style={lbl}>Room Number *</label>
                <input value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} required placeholder="101 / A-12" style={inp} />
              </div>
              <div>
                <label style={lbl}>Bed Number</label>
                <input value={form.bed_number} onChange={e => setForm(f => ({ ...f, bed_number: e.target.value }))} placeholder="Bed 1 / Bed A" style={inp} />
              </div>
              <div>
                <label style={lbl}>Allotment Date *</label>
                <input type="date" value={form.allotment_date} onChange={e => setForm(f => ({ ...f, allotment_date: e.target.value }))} required style={inp} />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  {['Occupied', 'Vacant', 'Shifted', 'Vacated'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Remarks</label>
                <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Any extra remarks" style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save Allotment'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'GCC', 'Student', 'Batch', 'House', 'Course', 'Hostel', 'Room', 'Bed', 'Date', 'Status', 'Actions'].map(h => (
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
                      {r.student_id && <div style={{ fontSize: 10, color: '#94a3b8' }}>🔗 linked</div>}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.class_name || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>{r._house || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{r._course || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#1e3a5f', fontWeight: 600 }}>{r.hostel_name}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.room_number}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.bed_number || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{r.allotment_date}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                        style={{ ...statusStyle(r.status), border: 'none', cursor: 'pointer', fontFamily: 'system-ui' }}>
                        {['Occupied', 'Vacant', 'Shifted', 'Vacated'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(r)} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                        <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No hostel allotments found</td></tr>
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
//  TAB 2 — Daily Schedule
// ══════════════════════════════════════════════════════════════
const DEFAULT_WEEKDAY = [
  { no: 1,  from: '5:30 AM',  to: '6:00 AM',  activity: 'Wake Up Bell & Morning PT' },
  { no: 2,  from: '6:00 AM',  to: '6:45 AM',  activity: 'PT / Exercise / Sports' },
  { no: 3,  from: '6:45 AM',  to: '7:30 AM',  activity: 'Bath & Morning Routine' },
  { no: 4,  from: '7:30 AM',  to: '8:00 AM',  activity: 'Morning Assembly & Roll Call' },
  { no: 5,  from: '8:00 AM',  to: '8:45 AM',  activity: 'Breakfast' },
  { no: 6,  from: '9:00 AM',  to: '1:00 PM',  activity: 'Academic Classes' },
  { no: 7,  from: '1:00 PM',  to: '2:00 PM',  activity: 'Lunch Break' },
  { no: 8,  from: '2:00 PM',  to: '5:00 PM',  activity: 'Academic Classes' },
  { no: 9,  from: '5:00 PM',  to: '5:30 PM',  activity: 'Tea Break' },
  { no: 10, from: '5:30 PM',  to: '7:00 PM',  activity: 'Recreation / Sports' },
  { no: 11, from: '7:00 PM',  to: '8:00 PM',  activity: 'Dinner' },
  { no: 12, from: '8:00 PM',  to: '10:00 PM', activity: 'Doubt Class / Assignment' },
  { no: 13, from: '10:00 PM', to: '',         activity: 'Lights Out' },
]
const DEFAULT_SUNDAY = [
  { no: 1, from: '6:00 AM',  to: '7:00 AM',  activity: 'Wake Up & Morning Routine' },
  { no: 2, from: '7:00 AM',  to: '8:00 AM',  activity: 'Breakfast' },
  { no: 3, from: '8:00 AM',  to: '12:00 PM', activity: 'Recreation / Free Time' },
  { no: 4, from: '12:00 PM', to: '1:00 PM',  activity: 'Lunch' },
  { no: 5, from: '1:00 PM',  to: '5:00 PM',  activity: 'Rest / Recreation' },
  { no: 6, from: '5:00 PM',  to: '5:30 PM',  activity: 'Tea Break' },
  { no: 7, from: '7:00 PM',  to: '8:00 PM',  activity: 'Dinner' },
  { no: 8, from: '8:00 PM',  to: '9:30 PM',  activity: 'Academic Review / Self Study' },
  { no: 9, from: '10:00 PM', to: '',         activity: 'Lights Out' },
]

const todayKey  = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const loadCheck = () => {
  try { return JSON.parse(localStorage.getItem('gnsi_sched_' + todayKey()) || '{}') }
  catch { return {} }
}
const saveCheck = obj => localStorage.setItem('gnsi_sched_' + todayKey(), JSON.stringify(obj))

function ScheduleTab() {
  const [type,     setType]     = useState('weekday')
  const [schedule, setSchedule] = useState({ weekday: DEFAULT_WEEKDAY, sunday: DEFAULT_SUNDAY })
  const [checked,  setChecked]  = useState(loadCheck)
  const [addForm,  setAddForm]  = useState(false)
  const [editRow,  setEditRow]  = useState(null)
  const [newRow,   setNewRow]   = useState({ from: '', to: '', activity: '' })

  const rows = schedule[type]
  const done = rows.filter(r => checked[`${type}_${r.no}`]).length
  const pct  = rows.length ? Math.round(done / rows.length * 100) : 0

  const toggle = no => {
    const k    = `${type}_${no}`
    const next = { ...checked, [k]: !checked[k] }
    setChecked(next); saveCheck(next)
  }

  const saveEdit = no => {
    const from = document.getElementById(`se-from-${no}`)?.value || ''
    const to   = document.getElementById(`se-to-${no}`)?.value || ''
    const act  = document.getElementById(`se-act-${no}`)?.value || ''
    setSchedule(s => ({ ...s, [type]: s[type].map(r => r.no === no ? { ...r, from, to, activity: act } : r) }))
    setEditRow(null)
  }

  const deleteRow = no => {
    if (!window.confirm('Delete this row?')) return
    setSchedule(s => ({ ...s, [type]: s[type].filter(r => r.no !== no) }))
  }

  const addRow = () => {
    if (!newRow.from || !newRow.activity) { alert('From time and activity are required'); return }
    const maxNo = rows.length ? Math.max(...rows.map(r => r.no)) : 0
    setSchedule(s => ({ ...s, [type]: [...s[type], { no: maxNo + 1, ...newRow }] }))
    setNewRow({ from: '', to: '', activity: '' }); setAddForm(false)
  }

  const highlight = a => ['Doubt', 'Academic', 'Lunch', 'Dinner', 'Tea', 'Recreation'].some(k => a.includes(k))
  const actIcon   = a => {
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
    return '•'
  }

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {[['weekday', '📅 Mon–Sat Schedule'], ['sunday', '🌿 Sunday / Holiday']].map(([id, label]) => (
          <button key={id} onClick={() => setType(id)} style={{
            flex: 1, padding: '9px 18px', border: 'none',
            borderBottom: type === id ? '3px solid #1e3a5f' : '3px solid transparent',
            background: 'none', cursor: 'pointer', fontSize: 13,
            fontWeight: type === id ? 700 : 500,
            color: type === id ? '#1e3a5f' : '#64748b',
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>📋 Today's Schedule Progress</span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: pct === 100 ? '#16a34a' : pct > 50 ? '#ca8a04' : '#64748b' }}>
            {done} / {rows.length} done · {pct}%
          </span>
        </div>
        <div style={{ height: 8, background: '#e2e8f0', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#16a34a' : pct > 50 ? '#ca8a04' : '#1e3a5f', borderRadius: 20, transition: 'width .4s' }} />
        </div>
        {pct === 100 && <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, marginTop: 6 }}>🎉 All activities completed for today!</div>}
      </div>

      {addForm && (
        /* FIXED: was '1fr 1fr 2fr auto' — breaks on mobile */
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={lbl}>From *</label>
            <input value={newRow.from} onChange={e => setNewRow(n => ({ ...n, from: e.target.value }))} placeholder="6:00 AM" style={inp} />
          </div>
          <div>
            <label style={lbl}>To</label>
            <input value={newRow.to} onChange={e => setNewRow(n => ({ ...n, to: e.target.value }))} placeholder="7:00 AM" style={inp} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={lbl}>Activity *</label>
            <input value={newRow.activity} onChange={e => setNewRow(n => ({ ...n, activity: e.target.value }))} placeholder="e.g. Morning PT" style={inp} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button onClick={addRow} style={btn('#16a34a')}>✓ Add</button>
            <button onClick={() => setAddForm(false)} style={btn('#f1f5f9', '#374151')}>✕</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setAddForm(true)} style={{ ...btn(), fontSize: 13, padding: '8px 16px' }}>➕ Add Row</button>
      </div>

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
          <thead>
            <tr style={{ background: '#1e3a5f' }}>
              {['#', 'From', 'To', 'Activity', '', '✓'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isDone = !!checked[`${type}_${r.no}`]
              const isEdit = editRow === r.no
              if (isEdit) return (
                <tr key={r.no} style={{ background: '#eff6ff' }}>
                  <td style={{ padding: '8px 14px', color: '#94a3b8', fontSize: 11 }}>{r.no}</td>
                  <td style={{ padding: '8px 14px' }}><input id={`se-from-${r.no}`} defaultValue={r.from} style={{ ...inp, width: 90, padding: '5px 8px', fontSize: 12 }} /></td>
                  <td style={{ padding: '8px 14px' }}><input id={`se-to-${r.no}`} defaultValue={r.to} style={{ ...inp, width: 90, padding: '5px 8px', fontSize: 12 }} /></td>
                  <td style={{ padding: '8px 14px' }}><input id={`se-act-${r.no}`} defaultValue={r.activity} style={{ ...inp, padding: '5px 8px', fontSize: 12 }} /></td>
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
                <tr key={r.no} style={{ background: isDone ? '#f0fdf4' : highlight(r.activity) ? '#eff6ff' : 'white', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{r.no}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1e3a5f' }}>{r.from}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{r.to || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 15, marginRight: 8 }}>{actIcon(r.activity)}</span>
                    <span style={{ fontWeight: highlight(r.activity) ? 700 : 500, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#94a3b8' : '#1e293b' }}>{r.activity}</span>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditRow(r.no)} style={{ background: '#eff6ff', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✏ Edit</button>
                      <button onClick={() => deleteRow(r.no)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✕</button>
                    </div>
                  </td>
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
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB 3 — Night Duty
// ══════════════════════════════════════════════════════════════
const emptyND = {
  date: '', shift: 'Full Night',
  staff1_id: null, staff1: '', staff2_id: null, staff2: '',
  post: 'Main Gate', notes: '',
}
const SHIFTS = ['Full Night', 'First Half', 'Second Half']
const POSTS  = ['Main Gate', 'Hostel Block A', 'Hostel Block B', 'Kitchen', 'Common Area']

function NightDutyTab({ staffProfiles }) {
  const [records,  setRecords]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec,  setEditRec]  = useState(null)
  const [form,     setForm]     = useState(emptyND)
  const [month,    setMonth]    = useState(new Date().getMonth())
  const [year,     setYear]     = useState(new Date().getFullYear())

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('night_duty').select('*').order('date')
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      date: form.date, shift: form.shift,
      staff1_id: form.staff1_id || null, staff1: form.staff1,
      staff2_id: form.staff2_id || null, staff2: form.staff2,
      post: form.post, notes: form.notes,
    }
    const { error } = editRec
      ? await supabase.from('night_duty').update(payload).eq('id', editRec.id)
      : await supabase.from('night_duty').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyND); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this duty assignment?')) return
    await supabase.from('night_duty').delete().eq('id', id); load()
  }

  const enriched = useMemo(() => records.map(r => {
    const s1 = r.staff1_id ? staffProfiles.find(s => s.id === r.staff1_id) : null
    const s2 = r.staff2_id ? staffProfiles.find(s => s.id === r.staff2_id) : null
    return {
      ...r,
      staff1: s1 ? s1.name : r.staff1, staff2: s2 ? s2.name : r.staff2,
      staff1_designation: s1?.designation || s1?.department || '',
      staff2_designation: s2?.designation || s2?.department || '',
    }
  }), [records, staffProfiles])

  const monthRoster = enriched.filter(r => {
    if (!r.date) return false
    const d = new Date(r.date)
    return d.getMonth() === month && d.getFullYear() === year
  })

  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const coveredDates = new Set(monthRoster.map(r => r.date))
  const uncovered    = Array.from({ length: daysInMonth }, (_, i) => {
    const d   = new Date(year, month, i + 1)
    const key = d.toISOString().split('T')[0]
    return coveredDates.has(key) ? null : key
  }).filter(Boolean)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, background: 'white', padding: '14px 20px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }} style={{ ...btn('#f1f5f9', '#374151'), padding: '6px 14px', fontSize: 16 }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f' }}>{MONTHS[month]} {year}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {monthRoster.length} assigned ·{' '}
            {uncovered.length > 0
              ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{uncovered.length} nights uncovered</span>
              : <span style={{ color: '#16a34a', fontWeight: 700 }}>all covered ✓</span>
            }
          </div>
        </div>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }} style={{ ...btn('#f1f5f9', '#374151'), padding: '6px 14px', fontSize: 16 }}>›</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyND) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Assign Duty'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>{editRec ? '✏️ Edit Duty' : '➕ Assign Night Duty'}</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>🔗 Staff pulled live from Staff Profiles module</p>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} />
              </div>
              <div>
                <label style={lbl}>Shift</label>
                <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} style={inp}>
                  {SHIFTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Staff 1 * <span style={{ color: '#94a3b8', fontWeight: 400 }}>(search from staff profiles)</span></label>
                <StaffSearchInput staff={staffProfiles} onSelect={s => setForm(f => ({ ...f, staff1_id: s.id, staff1: s.name }))} placeholder="Search staff 1..." />
                {form.staff1 && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 12, color: '#1e3a5f', fontWeight: 600 }}>
                    ✅ {form.staff1}
                    <button type="button" onClick={() => setForm(f => ({ ...f, staff1: '', staff1_id: null }))} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>✕ Clear</button>
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Staff 2 <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <StaffSearchInput staff={staffProfiles} onSelect={s => setForm(f => ({ ...f, staff2_id: s.id, staff2: s.name }))} placeholder="Search staff 2..." />
                {form.staff2 && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 12, color: '#1e3a5f', fontWeight: 600 }}>
                    ✅ {form.staff2}
                    <button type="button" onClick={() => setForm(f => ({ ...f, staff2: '', staff2_id: null }))} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>✕ Clear</button>
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Post / Location</label>
                <select value={form.post} onChange={e => setForm(f => ({ ...f, post: e.target.value }))} style={inp}>
                  {POSTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes" style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#1e3a5f' }}>
              {['#', 'Date', 'Shift', 'Staff 1', 'Staff 2', 'Post', 'Notes', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthRoster.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No duties assigned for {MONTHS[month]} {year}</td></tr>
            )}
            {monthRoster.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1e293b' }}>{r.date}</td>
                <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.shift}</td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.staff1}</div>
                  {r.staff1_designation && <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.staff1_designation}</div>}
                  {r.staff1_id && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  {r.staff2 ? <>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.staff2}</div>
                    {r.staff2_designation && <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.staff2_designation}</div>}
                  </> : '—'}
                </td>
                <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.post}</td>
                <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.notes || '—'}</td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEditRec(r); setForm({ ...r }); setShowForm(true) }} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                    <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {uncovered.length > 0 && (
        <div style={{ marginTop: 16, background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {uncovered.length} uncovered nights in {MONTHS[month]}:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {uncovered.map(d => (
              <span key={d} style={{ padding: '3px 10px', borderRadius: 99, background: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>{d}</span>
            ))}
          </div>
        </div>
      )}
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

function HouseTab({ students: propStudents }) {
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
    const count = students.filter(s => s.house === houses.find(h => h.id === id)?.name).length
    if (!window.confirm(`Delete this house?${count > 0 ? ` ${count} students will be unassigned.` : ''}`)) return
    await supabase.from('houses').delete().eq('id', id)
    showToast('🗑 House deleted', '#dc2626'); load()
  }

  const handleAssign = async (studentId, houseName) => {
    await supabase.from('students').update({ house: houseName || null }).eq('id', studentId)
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, house: houseName || null } : s))
    showToast(houseName ? `✅ Assigned to ${houseName}` : '✅ Removed from house')
  }

  const handleBulkAssign = async houseName => {
    const unassigned = students.filter(s => !s.house)
    if (!unassigned.length) { showToast('No unassigned students', '#ca8a04'); return }
    if (!window.confirm(`Assign ${unassigned.length} unassigned students to ${houseName}?`)) return
    await supabase.from('students').update({ house: houseName }).in('id', unassigned.map(s => s.id))
    setStudents(prev => prev.map(s => !s.house ? { ...s, house: houseName } : s))
    showToast(`✅ ${unassigned.length} students assigned to ${houseName}`)
  }

  const getHouseStyle = h => HOUSE_COLORS[(Number(h.color_index) || 0) % HOUSE_COLORS.length]

  const activeHouseObj  = houses.find(h => h.id === activeHouse)
  const houseStudents   = activeHouseObj ? students.filter(s => s.house === activeHouseObj.name) : []
  const houseMasters    = activeHouseObj ? masters.filter(m => m.house === activeHouseObj.name) : []
  const unassignedCount = students.filter(s => !s.house).length

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
                <button onClick={() => handleBulkAssign(activeHouseObj.name)} style={{ ...btn('#ecfdf5', '#059669'), fontSize: 12, padding: '7px 14px' }}>+ Assign Unassigned ({unassignedCount})</button>
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
                        <button onClick={() => { handleAssign(s.id, activeHouseObj.name); setAssignSearch('') }} style={{ ...btn(hs.color), fontSize: 11, padding: '4px 12px' }}>Assign</button>
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
                            <button onClick={() => handleAssign(s.id, '')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✕ Remove</button>
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
                  const cnt = students.filter(s => s.house === h.name).length
                  const hms = masters.filter(m => m.house === h.name)
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
                            <button onClick={e => { e.stopPropagation(); handleDeleteHouse(h.id) }} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
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
                    const h  = houses.find(h => h.name === s.house)
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
                          <select value={s.house || ''} onChange={e => handleAssign(s.id, e.target.value)} style={{ ...inp, width: 150, padding: '6px 10px', fontSize: 12 }}>
                            <option value="">— Remove / None —</option>
                            {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                          </select>
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
    const h = houses.find(h => h.name === houseName)
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

  // Track mobile state
  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const fetchShared = async () => {
      setDataLoading(true)
      const [{ data: s, error: e1 }, { data: st, error: e2 }, { data: hm, error: e3 }] = await Promise.all([
        supabase.from('students').select('id,name,gcc_no,class_name,batch,course,house,hostel_type,status,admission_no').order('name'),
        supabase.from('staff_profiles').select('id,name,designation,department,status').order('name'),
        supabase.from('housemasters').select('*').eq('status', 'Active').single(),
      ])
      if (e1) console.error('Students fetch error:', e1)
      if (e2) console.error('Staff fetch error:', e2)
      if (e3) console.error('Housemaster fetch error:', e3)
      console.log('Loaded:', s?.length, 'students,', st?.length, 'staff | sample:', s?.[0])
      setStudents(s || [])
      setStaffProfiles(st || [])
      setCurrentHousemaster(hm || null)
      setDataLoading(false)
    }
    fetchShared()
  }, [])

  const standaloneTab = activeTab === 'schedule' || activeTab === 'kitchen' || activeTab === 'housemaster' || activeTab === 'adminmonitor'

  const tabContent = {
    allotments:   <AllotmentsTab  students={students} />,
    schedule:     <ScheduleTab />,
    nightduty:    <NightDutyTab   staffProfiles={staffProfiles} />,
    discipline:   <DisciplineTab  students={students} />,
    sickbay:      <SickbayTab     students={students} />,
    house:        <HouseTab       students={students} />,
    housemaster:  <HousemasterTab />,
    kitchen:      <KitchenTab />,
    hmactivities: <HousemasterActivitiesTab staffProfiles={staffProfiles} />,
    adminmonitor: <AdminMonitorTab staffProfiles={staffProfiles} />,
    // ─── NEW TABS ──────────────────────────────────────
    attendance:   <AttendanceTab  students={students} currentHousemaster={currentHousemaster} />,
    leave:        <LeaveTab       students={students} currentHousemaster={currentHousemaster} />,
    hmdashboard:  <HMDashboard    students={students} staffProfiles={staffProfiles} currentHousemaster={currentHousemaster} />,
    maintenance:  <MaintenanceTab currentHousemaster={currentHousemaster} />,
    journal:      <JournalTab     currentHousemaster={currentHousemaster} />,
  }

  // Mobile bottom navigation
  const primaryTabs = ['hmdashboard', 'attendance', 'leave', 'sickbay', 'discipline', 'maintenance', 'journal']
  const secondaryTabs = ['allotments', 'schedule', 'nightduty', 'house', 'housemaster', 'kitchen', 'hmactivities', 'adminmonitor']

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

      {/* Desktop/Tablet Tab Bar */}
      {!mobile && (
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 24, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '9px 16px', border: 'none',
              borderBottom: activeTab === t.id ? '3px solid #1e3a5f' : '3px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? '#1e3a5f' : '#64748b',
              marginBottom: -2, whiteSpace: 'nowrap', transition: 'color .15s',
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Mobile Top Tabs (scrollable) */}
      {mobile && (
        <div style={{ 
          display: 'flex', 
          gap: '6px', 
          marginBottom: '16px', 
          overflowX: 'auto',
          paddingBottom: '4px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {primaryTabs.map(tid => {
            const t = TABS.find(tab => tab.id === tid)
            if (!t) return null
            return (
              <button 
                key={t.id} 
                onClick={() => setActiveTab(t.id)} 
                style={{
                  padding: '8px 14px',
                  borderRadius: '99px',
                  border: 'none',
                  background: activeTab === t.id ? '#1e3a5f' : '#f1f5f9',
                  color: activeTab === t.id ? 'white' : '#64748b',
                  fontSize: '12px',
                  fontWeight: activeTab === t.id ? 700 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Mobile Secondary Tabs (smaller, collapsible) */}
      {mobile && (
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          marginBottom: '12px', 
          overflowX: 'auto',
          paddingBottom: '4px',
        }}>
          {secondaryTabs.map(tid => {
            const t = TABS.find(tab => tab.id === tid)
            if (!t) return null
            return (
              <button 
                key={t.id} 
                onClick={() => setActiveTab(t.id)} 
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: activeTab === t.id ? '#eff6ff' : 'white',
                  color: activeTab === t.id ? '#1e3a5f' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: activeTab === t.id ? 600 : 400,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {t.label}
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