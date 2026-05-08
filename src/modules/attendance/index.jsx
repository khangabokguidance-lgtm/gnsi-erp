import { useState, useEffect, useCallback, useRef } from 'react'
import './attendance.css'

// ── Constants ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://pwrldrngqxbvwfztxxrd.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cmxkcm5ncXhidndmenR4eHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTc5NTUsImV4cCI6MjA5MDA5Mzk1NX0.vQi6N4s5Y_iwU1eIi4g8q_T8bW4j8mBH7BFDamAhB0Y'

const STATUS_CYCLE = { '': 'P', P: 'L', L: 'ED', ED: 'A', A: '' }
const STATUS_LABEL = { P: 'Present', L: 'Late', ED: 'Early Dep.', A: 'Absent', '': '—' }
const STATUS_STYLE = {
  P:  { bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
  L:  { bg: '#fef9c3', color: '#ca8a04', border: '#fde047' },
  ED: { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
  A:  { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  '': { bg: 'var(--color-surface-2,#f3f4f6)', color: '#9ca3af', border: '#e5e7eb' },
}

const todayStr = () => new Date().toISOString().split('T')[0]
const ls  = (k, fb = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const getCurrentUser = () => { try { return JSON.parse(localStorage.getItem('gnsijwtuser')) } catch { return null } }
const getSchoolId = () => { try { const u = getCurrentUser(); return u?.schoolId || u?.schoolid || null } catch { return null } }

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function sbUpsert(table, rows, onConflict) {
  try {
    const sid = getSchoolId()
    const data = rows.map(r => sid ? { ...r, schoolid: sid } : r)
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: `resolution=merge-duplicates` },
      body: JSON.stringify(data),
    })
  } catch {}
}
async function sbDelete(table, idCol, ids, date) {
  try {
    const sid = getSchoolId()
    let url = `${SUPABASE_URL}/rest/v1/${table}?att_date=eq.${date}&${idCol}=in.(${ids.join(',')})`
    if (sid) url += `&schoolid=eq.${sid}`
    await fetch(url, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  } catch {}
}
async function sbLoad(table) {
  try {
    const sid = getSchoolId()
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`
    if (sid) url += `&schoolid=eq.${sid}`
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    return await res.json()
  } catch { return [] }
}

// ── Data helpers ──────────────────────────────────────────────────────────────
function loadAttendance() { return ls('ims_att') || {} }
function saveAttendance(att) {
  lsSet('ims_att', att)
  // KV push if legacy function exists
  if (typeof window.gnsiKVPush === 'function') window.gnsiKVPush('ims_att', att)
}
function loadStudents() {
  return ls('gnsistudents') || ls('gnsiStudents') || []
}
function loadStaff() {
  return ls('gnsistaffbiodata') || ls('gnsistaff') || []
}
function exportCSV(filename, headers, rows) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(','))].join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = filename; a.click()
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, bg = '#1433a8' }) {
  const letter = (name || '?')[0]?.toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, flexShrink: 0 }}>
      {letter}
    </div>
  )
}

// ── Status Button ─────────────────────────────────────────────────────────────
function StatusBtn({ status, onClick }) {
  const s = STATUS_STYLE[status || '']
  return (
    <button onClick={onClick} title="Click to cycle: — → Present → Late → Early Dep → Absent"
      style={{ minWidth: 82, padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${s.border}`, background: s.bg, color: s.color, fontWeight: 800, fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", cursor: 'pointer', transition: 'all .15s' }}>
      {STATUS_LABEL[status || ''] || '—'}
    </button>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, color, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: color || '#15803d', color: '#fff', padding: '12px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 24px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
      {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>×</button>
    </div>
  )
}

// ── Summary Pills ─────────────────────────────────────────────────────────────
function SummaryPills({ list, att, date, type }) {
  const counts = { P: 0, L: 0, ED: 0, A: 0 }
  list.forEach(s => {
    const v = att[`${date}-${type}-${s.id}`] || ''
    if (v === 'P') counts.P++
    else if (v === 'L') { counts.P++; counts.L++ }
    else if (v === 'ED') { counts.P++; counts.ED++ }
    else if (v === 'A') counts.A++
  })
  const pills = [
    { label: 'Present',    value: counts.P,    bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
    { label: 'Late',       value: counts.L,    bg: '#fef9c3', color: '#ca8a04', border: '#fde047' },
    { label: 'Early Dep.', value: counts.ED,   bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
    { label: 'Absent',     value: counts.A,    bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
    { label: 'Total',      value: list.length, bg: 'var(--color-surface-2,#f3f4f6)', color: 'var(--color-text,#1a2040)', border: 'var(--color-border,#e5e7eb)' },
  ]
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {pills.map(p => (
        <div key={p.label} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 90 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: p.color, fontFamily: "'JetBrains Mono',monospace" }}>{p.value}</div>
          <div style={{ fontSize: 10, color: p.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{p.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Attendance Row ────────────────────────────────────────────────────────────
function AttRow({ person, type, date, att, onCycle, onTime }) {
  const key    = `${date}-${type}-${person.id}`
  const status = att[key] || ''
  const arrKey = `${date}-${type}x-${person.id}`
  const depKey = `${date}-${type}d-${person.id}`
  const showArr = status === 'P' || status === 'L' || status === 'ED'
  const showDep = status === 'ED'
  const inp = { border: '1px solid var(--color-border,#e5e7eb)', borderRadius: 6, padding: '3px 6px', fontSize: 11, fontFamily: "'JetBrains Mono',monospace", background: 'var(--color-surface,#fff)', color: 'var(--color-text,#1a2040)', outline: 'none', width: 82 }

  return (
    <div className="att-row">
      <Avatar name={person.name || person.studentName} size={34} bg={status === 'A' ? '#dc2626' : status === 'L' ? '#ca8a04' : '#1433a8'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name || person.studentName || '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted,#6b7280)' }}>
          {person.role || person.cls || person.className || ''}
          {(person.roll || person.rollNo) ? ` · #${person.roll || person.rollNo}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {showArr && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted,#6b7280)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Arrival</div>
            <input type="time" defaultValue={att[arrKey] || ''} onChange={e => onTime(`${type}x`, person.id, e.target.value)} style={inp} />
          </div>
        )}
        {showDep && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Departed</div>
            <input type="time" defaultValue={att[depKey] || ''} onChange={e => onTime(`${type}d`, person.id, e.target.value)} style={{ ...inp, border: '1px solid #fdba74', background: '#fff7ed', color: '#ea580c' }} />
          </div>
        )}
      </div>
      <StatusBtn status={status} onClick={() => onCycle(type, person.id)} />
    </div>
  )
}

// ── Teacher Leaderboard ───────────────────────────────────────────────────────
function TeacherLeaderboard({ att }) {
  const staff = loadStaff()
  const teachers = staff.filter(s =>
    s.dept === 'Teaching' || (s.role || '').toLowerCase().includes('teacher') ||
    (s.role || '').toLowerCase().includes('sir') || (s.role || '').toLowerCase().includes('madam')
  )
  const list = teachers.length ? teachers : staff

  const allDates = [...new Set(Object.keys(att).filter(k => k.match(/^\d{4}-\d{2}-\d{2}-S-/)).map(k => k.slice(0, 10)))].sort()
  const totalDays = allDates.length || 1

  const stats = list.map(t => {
    let present = 0, late = 0, absent = 0, earlyDep = 0
    allDates.forEach(d => {
      const v = att[`${d}-S-${t.id}`] || ''
      if (v === 'P') present++
      else if (v === 'L') { present++; late++ }
      else if (v === 'ED') { present++; earlyDep++ }
      else if (v === 'A') absent++
    })
    const attRate = Math.round((present / totalDays) * 100)
    const score = attRate - (late * 3) - (earlyDep * 2) - (absent * 5)
    return { t, present, late, absent, earlyDep, attRate, score, totalDays }
  }).sort((a, b) => b.score - a.score)

  const medals = ['🥇', '🥈', '🥉']
  const concernList = stats.filter(s => s.attRate < 75 || s.absent > totalDays * 0.2 || s.late > 5)

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--color-text-muted,#6b7280)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 8 }}>📊 Performance Ranking</div>
      <div className="att-card">
        <div className="att-card-head" style={{ background: 'linear-gradient(135deg,#0b1e6e,#1433a8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <span style={{ fontSize: 28 }}>🏆</span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Teacher Leaderboard</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>Ranked by attendance · punctuality</div>
            </div>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{list.length} teacher(s)</span>
        </div>

        {concernList.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#fff8f0,#fef3dc)', border: '1.5px solid #fde68a', borderRadius: 8, padding: '12px 18px', margin: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4 }}>{concernList.length} teacher{concernList.length > 1 ? 's' : ''} flagged</div>
              <div style={{ fontSize: 12, color: '#a16207' }}>{concernList.map(s => `${s.t.name?.split(' ')[0]}: ${s.attRate}% att · ${s.absent} absent`).join(' · ')}</div>
            </div>
          </div>
        )}

        {allDates.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted,#6b7280)', fontSize: 13 }}>No attendance recorded yet — mark attendance above to see live rankings.</div>
        )}

        {allDates.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="att-table">
              <thead>
                <tr>
                  <th style={{ width: 54, textAlign: 'center' }}>#</th>
                  <th>Teacher</th>
                  <th style={{ textAlign: 'center' }}>Att. Rate</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'center' }}>Late</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => {
                  const attCol = s.attRate >= 90 ? '#16a34a' : s.attRate >= 75 ? '#d97706' : '#dc2626'
                  const attBg  = s.attRate >= 90 ? '#dcfce7' : s.attRate >= 75 ? '#fef9c3' : '#fee2e2'
                  const concern = s.attRate < 75 || s.absent > totalDays * 0.2 || s.late > 5
                  return (
                    <tr key={s.t.id} style={{ background: concern ? '#fff8f0' : i === 0 ? 'linear-gradient(90deg,#fffaed,var(--color-surface,#fff))' : undefined }}>
                      <td style={{ textAlign: 'center', fontSize: i < 3 ? 22 : 14, fontWeight: 800, color: ['#c9870a','#64748b','#a05a2c'][i] || 'var(--color-text-muted,#6b7280)', fontFamily: "'JetBrains Mono',monospace" }}>{i < 3 ? medals[i] : `#${i + 1}`}</td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={s.t.name} size={30} /><div><div style={{ fontWeight: 700, fontSize: 13 }}>{s.t.name}</div><div style={{ fontSize: 10.5, color: 'var(--color-text-muted,#6b7280)' }}>{s.t.role || s.t.dept || ''}</div></div></div></td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: attBg, color: attCol, fontFamily: "'JetBrains Mono',monospace" }}>{s.attRate}%</span>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#16a34a' }}>{s.present}</td>
                      <td style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#dc2626' }}>{s.absent}</td>
                      <td style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#ca8a04' }}>{s.late}</td>
                      <td style={{ textAlign: 'center' }}>
                        {concern
                          ? <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: '#fef3dc', color: '#c9870a', border: '1px solid #fde68a' }}>⚠ Concern</span>
                          : <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>✓ Good</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: s.score >= 80 ? '#16a34a' : s.score >= 50 ? '#d97706' : '#dc2626' }}>{Math.max(0, s.score)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '10px 16px', background: 'var(--color-surface-2,#f9f8f5)', borderTop: '1px solid var(--color-border,#e5e7eb)', fontSize: 11, color: 'var(--color-text-muted,#6b7280)', fontFamily: "'JetBrains Mono',monospace" }}>
          Score = AttRate − (Late×3) − (EarlyDep×2) − (Absent×5) &nbsp;·&nbsp; ⚠ Concern: Att. &lt;75% or &gt;20% absences or &gt;5 lates
        </div>
      </div>
    </div>
  )
}

// ── Main Attendance Page ──────────────────────────────────────────────────────
export default function AttendancePage() {
  const [tab,    setTab]    = useState('student')
  const [date,   setDate]   = useState(todayStr())
  const [att,    setAtt]    = useState(() => loadAttendance())
  const [batch,  setBatch]  = useState('All')
  const [sync,   setSync]   = useState('idle')   // idle | syncing | synced | error
  const [toast,  setToast]  = useState(null)
  const scrollRef = useRef(null)

  const students = loadStudents()
  const staff    = loadStaff()
  const type     = tab === 'staff' ? 'S' : 'T'
  const baseList = tab === 'staff' ? staff : students

  // Batch filter
  const classes = [...new Set(students.map(s => s.cls || s.className).filter(Boolean))].sort()
  const list = (tab === 'student' && batch !== 'All')
    ? baseList.filter(s => (s.cls || s.className) === batch)
    : baseList

  function showToast(msg, color = '#15803d') { setToast({ msg, color }) }

  // Update att state + localStorage + Supabase
  function updateAtt(newAtt) {
    setAtt(newAtt)
    saveAttendance(newAtt)
  }

  function handleCycle(t, id) {
    const key = `${date}-${t}-${id}`
    const cur  = att[key] || ''
    const next = STATUS_CYCLE[cur]
    const newAtt = { ...att }
    if (next) {
      newAtt[key] = next
    } else {
      delete newAtt[key]
      delete newAtt[`${date}-${t}x-${id}`]
      delete newAtt[`${date}-${t}d-${id}`]
    }
    updateAtt(newAtt)
    setSync('syncing')
    const table = t === 'S' ? 'attendance_staff' : 'student_attendance'
    const idCol = t === 'S' ? 'staff_id' : 'student_id'
    if (next) {
      sbUpsert(table, [{ [idCol]: id, att_date: date, status: next, marked_by: getCurrentUser()?.name || '' }])
        .then(() => setSync('synced')).catch(() => setSync('error'))
    } else {
      sbDelete(table, idCol, [id], date).then(() => setSync('synced')).catch(() => setSync('error'))
    }
  }

  function handleTime(typeKey, id, val) {
    const k = `${date}-${typeKey}-${id}`
    const newAtt = { ...att }
    if (val) newAtt[k] = val; else delete newAtt[k]
    updateAtt(newAtt)
    // Push time update to Supabase
    const table = typeKey.startsWith('S') ? 'attendance_staff' : 'student_attendance'
    const idCol = table === 'attendance_staff' ? 'staff_id' : 'student_id'
    const row = { att_date: date, [idCol]: id }
    if (typeKey.endsWith('x')) row.arr_time = val || null
    else if (typeKey.endsWith('d')) row.dep_time = val || null
    sbUpsert(table, [row]).catch(() => {})
  }

  function markAll(v) {
    const newAtt = { ...att }
    list.forEach(s => { newAtt[`${date}-${type}-${s.id}`] = v })
    updateAtt(newAtt)
    setSync('syncing')
    const table = type === 'S' ? 'attendance_staff' : 'student_attendance'
    const idCol = type === 'S' ? 'staff_id' : 'student_id'
    sbUpsert(table, list.map(s => ({ [idCol]: s.id, att_date: date, status: v })))
      .then(() => { setSync('synced'); showToast(`All marked ${STATUS_LABEL[v]}`) })
      .catch(() => setSync('error'))
  }

  function clearAll() {
    const newAtt = { ...att }
    list.forEach(s => {
      delete newAtt[`${date}-${type}-${s.id}`]
      delete newAtt[`${date}-${type}x-${s.id}`]
      delete newAtt[`${date}-${type}d-${s.id}`]
    })
    updateAtt(newAtt)
    setSync('syncing')
    const table = type === 'S' ? 'attendance_staff' : 'student_attendance'
    const idCol = type === 'S' ? 'staff_id' : 'student_id'
    sbDelete(table, idCol, list.map(s => s.id), date)
      .then(() => { setSync('synced'); showToast('Cleared', '#64748b') })
      .catch(() => setSync('error'))
  }

  function doExportCSV() {
    const headers = ['Name', 'Role/Class', 'Status', 'Arrival', 'Departure']
    const rows = list.map(s => [
      s.name || s.studentName || '',
      s.role || s.cls || s.className || '',
      STATUS_LABEL[att[`${date}-${type}-${s.id}`] || ''] || '—',
      att[`${date}-${type}x-${s.id}`] || '',
      att[`${date}-${type}d-${s.id}`] || '',
    ])
    exportCSV(`gnsi-attendance-${tab}-${date}.csv`, headers, rows)
    showToast('CSV downloaded')
  }

  const syncColors = { idle: '#9ca3af', syncing: '#d97706', synced: '#16a34a', error: '#dc2626' }
  const syncLabels = { idle: '', syncing: '⏳ Syncing…', synced: '✓ Synced', error: '✗ Sync failed' }

  const btnTab = (t) => ({
    padding: '9px 22px', borderRadius: 8, border: tab === t ? 'none' : '1.5px solid var(--color-border,#e5e7eb)',
    cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: tab === t ? '#1433a8' : 'var(--color-surface,#fff)',
    color: tab === t ? '#fff' : 'var(--color-text-muted,#6b7280)',
    transition: 'all .15s',
  })

  return (
    <div className="att-page">
      {toast && <Toast msg={toast.msg} color={toast.color} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="att-page-header">
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--color-text-muted,#6b7280)', textTransform: 'uppercase', marginBottom: 4 }}>GNSI PORTAL</div>
        <div style={{ fontSize: 'clamp(1.4rem,2.5vw,2rem)', fontWeight: 800, color: 'var(--color-text,#1a2040)' }}>✅ Attendance</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted,#6b7280)', marginTop: 4 }}>Staff · Students · Leaderboard</div>
      </div>

      {/* Date + legend row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted,#6b7280)', fontWeight: 600 }}>Date:</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ background: 'var(--color-surface,#fff)', border: '1.5px solid var(--color-border,#e5e7eb)', borderRadius: 9, padding: '8px 14px', fontSize: 13, color: 'var(--color-text,#1a2040)', outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted,#6b7280)', fontFamily: "'JetBrains Mono',monospace" }}>Cycle:</span>
          {['P','L','ED','A'].map((s, i, arr) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].color, border: `1px solid ${STATUS_STYLE[s].border}` }}>{STATUS_LABEL[s]}</span>
              {i < arr.length - 1 && <span style={{ fontSize: 10, color: 'var(--color-text-muted,#6b7280)' }}>→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={btnTab('staff')}   onClick={() => setTab('staff')}>👥 Staff ({staff.length})</button>
        <button style={btnTab('student')} onClick={() => setTab('student')}>🎓 Students ({students.length})</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {syncLabels[sync] && <span style={{ fontSize: 11, fontWeight: 700, color: syncColors[sync], fontFamily: "'JetBrains Mono',monospace" }}>{syncLabels[sync]}</span>}
          <button className="att-btn att-btn-outline" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => markAll('P')}>All Present</button>
          <button className="att-btn att-btn-outline" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => markAll('A')}>All Absent</button>
          <button className="att-btn att-btn-outline" style={{ fontSize: 11, padding: '5px 12px', color: '#dc2626', borderColor: '#fca5a5' }} onClick={clearAll}>Clear All</button>
        </div>
      </div>

      {/* Summary pills */}
      <SummaryPills list={list} att={att} date={date} type={type} />

      {/* Attendance card */}
      <div className="att-card">
        <div className="att-card-head" style={{ background: tab === 'staff' ? '#eff6ff' : '#f0fdf4' }}>
          <span className="att-card-title" style={{ color: tab === 'staff' ? '#1433a8' : '#15803d' }}>
            {tab === 'staff' ? 'Staff' : 'Student'} Attendance — {date}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--color-text-muted,#6b7280)' }}>{list.length} entries</span>
          <button className="att-btn att-btn-outline" style={{ padding: '4px 11px', fontSize: 11, fontWeight: 700 }} onClick={doExportCSV}>⬇ Export CSV</button>
        </div>

        {/* Batch filter (students only) */}
        {tab === 'student' && classes.length > 0 && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border,#e5e7eb)', background: 'var(--color-surface-2,#f9f8f5)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted,#6b7280)', textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 4 }}>Batch:</span>
            {['All', ...classes].map(b => (
              <button key={b} onClick={() => setBatch(b)}
                style={{ padding: '4px 13px', borderRadius: 20, border: `1.5px solid ${batch === b ? '#1433a8' : 'var(--color-border,#e5e7eb)'}`, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, background: batch === b ? '#1433a8' : 'var(--color-surface,#fff)', color: batch === b ? '#fff' : 'var(--color-text-muted,#6b7280)', transition: 'all .15s' }}>
                {b}
              </button>
            ))}
          </div>
        )}

        {/* Rows */}
        <div style={{ maxHeight: 560, overflowY: 'auto' }} ref={scrollRef}>
          {list.length === 0
            ? <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted,#6b7280)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>{tab === 'staff' ? '👥' : '🎓'}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>No {tab === 'staff' ? 'staff' : 'students'} found</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Add {tab === 'staff' ? 'staff in Staff module' : 'students in Students module'} first</div>
              </div>
            : list.map(person => (
                <AttRow key={person.id} person={person} type={type} date={date} att={att} onCycle={handleCycle} onTime={handleTime} />
              ))
          }
        </div>
      </div>

      {/* Teacher Leaderboard */}
      <TeacherLeaderboard att={att} />
    </div>
  )
}
