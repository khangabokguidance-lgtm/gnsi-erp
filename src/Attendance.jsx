import { useState, useEffect, useContext, useCallback } from 'react'
import { supabase } from './supabase'

import { AuthContext } from './AuthContext'

// ─── Constants ────────────────────────────────────────────────
const CLASSES = ['Lakshya', 'Umeed', 'Leader', 'Champion', 'Achiever', 'Elite', 'Prime']
const COURSES = ['Sainik', 'Navodaya', 'Foundation', 'Combined Course']
const STATUSES = ['Present', 'Absent', 'Late', 'Half Day']
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const STATUS_CFG = {
  Present:    { bg: '#dcfce7', color: '#16a34a', icon: '✅' },
  Absent:     { bg: '#fee2e2', color: '#dc2626', icon: '❌' },
  Late:       { bg: '#fef9c3', color: '#ca8a04', icon: '🕐' },
  'Half Day': { bg: '#ede9fe', color: '#7c3aed', icon: '🌓' },
  'Not Marked':{ bg: '#f1f5f9', color: '#94a3b8', icon: '—' },
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ name, size = 36 }) {
  const colors = ['#1e3a5f','#2563eb','#7c3aed','#0891b2','#059669','#dc2626','#d97706']
  const color = colors[(name || '').charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: color, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: '700', fontSize: size * 0.35 + 'px', flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG['Not Marked']
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '999px', fontSize: '12px',
      fontWeight: '600', backgroundColor: cfg.bg, color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {status || 'Not Marked'}
    </span>
  )
}

// ─── Export helpers ───────────────────────────────────────────
function exportCSV(rows, filename) {
  const headers = ['Name', 'Class', 'Course', 'Status', 'Note', 'Date']
  const csv = [headers, ...rows.map(r => [
    r.student_name, r.class_name, r.course, r.status, r.note || '', r.date
  ])].map(r => r.map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

function exportPDF(title, tableId) {
  const table = document.getElementById(tableId)
  if (!table) return
  const win = window.open('', '_blank')
  win.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: system-ui; padding: 24px; font-size: 13px; }
      h2 { color: #1e3a5f; }
      table { border-collapse: collapse; width: 100%; }
      th { background: #1e3a5f; color: white; padding: 8px 12px; text-align: left; font-size: 12px; }
      td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) td { background: #f8fafc; }
    </style></head><body>
    <h2>${title}</h2>
    ${table.outerHTML}
    </body></html>`)
  win.document.close()
  win.print()
}

// ─── Monthly Summary Modal ────────────────────────────────────
function MonthlySummaryModal({ students, onClose }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year,  setYear]  = useState(now.getFullYear())
  const [data,  setData]  = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to   = new Date(year, month + 1, 0).toISOString().slice(0, 10)
    const { data: recs } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', from)
      .lte('date', to)
    setData(recs || [])
    setLoading(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  const summary = students.map(s => {
    const recs = data.filter(r => r.student_id === s.id)
    const count = status => recs.filter(r => r.status === status).length
    const total = recs.length
    const pct = total ? Math.round((count('Present') + count('Half Day') * 0.5) / total * 100) : 0
    return { ...s, present: count('Present'), absent: count('Absent'), late: count('Late'), halfDay: count('Half Day'), total, pct }
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,26,.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'white', borderRadius: 16, width: 'min(900px,96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>📊 Monthly Summary</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Attendance breakdown by student</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={month} onChange={e => setMonth(+e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <input type="number" value={year} onChange={e => setYear(+e.target.value)}
              style={{ width: 80, padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
            <button onClick={load}
              style={{ padding: '7px 16px', borderRadius: 8, backgroundColor: '#1e3a5f', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              Load
            </button>
            <button onClick={() => exportCSV(data, `attendance-${MONTHS[month]}-${year}.csv`)}
              style={{ padding: '7px 14px', borderRadius: 8, backgroundColor: '#059669', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              📥 CSV
            </button>
            <button onClick={() => exportPDF(`Attendance — ${MONTHS[month]} ${year}`, 'monthly-table')}
              style={{ padding: '7px 14px', borderRadius: 8, backgroundColor: '#7c3aed', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              🖨 PDF
            </button>
            <button onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 16, color: '#64748b' }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading...</div>
          ) : (
            <table id="monthly-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#1e3a5f' }}>
                  {['Student', 'Class', 'Course', 'Present', 'Absent', 'Late', 'Half Day', 'Total Days', '% Attendance'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.batch || s.class_name || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.course}</td>
                    <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: 700 }}>{s.present}</td>
                    <td style={{ padding: '10px 12px', color: '#dc2626', fontWeight: 700 }}>{s.absent}</td>
                    <td style={{ padding: '10px 12px', color: '#ca8a04', fontWeight: 700 }}>{s.late}</td>
                    <td style={{ padding: '10px 12px', color: '#7c3aed', fontWeight: 700 }}>{s.halfDay}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.total}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: s.pct + '%', borderRadius: 3,
                            backgroundColor: s.pct >= 75 ? '#16a34a' : s.pct >= 50 ? '#f59e0b' : '#dc2626' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700,
                          color: s.pct >= 75 ? '#16a34a' : s.pct >= 50 ? '#f59e0b' : '#dc2626' }}>
                          {s.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {summary.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No data for this period</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Attendance Component ────────────────────────────────
export default function Attendance() {
  const { user } = useContext(AuthContext)
  const role = user?.role
  const assignedClass = user?.assignedClass

  const canTakeAttendance = role === 'admin' || role === 'class_teacher'

  const getLocalDate = () => new Date().toLocaleDateString('en-CA')
  const [date,         setDate]         = useState(getLocalDate())
  const [students,     setStudents]     = useState([])
  const [attendance,   setAttendance]   = useState({})
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [activeClass,  setActiveClass]  = useState(role === 'class_teacher' ? assignedClass : 'All')
  const [activeCourse, setActiveCourse] = useState('All')
  const [showSummary,  setShowSummary]  = useState(false)
  const [noteFor,      setNoteFor]      = useState(null)

  // ── Fetch ──────────────────────────────────────────────
  const fetchStudents = async () => {
    setLoading(true)
    let q = supabase.from('students').select('*').order('name')
    if (role === 'class_teacher' && assignedClass)
      q = q.or(`batch.eq.${assignedClass},class_name.eq.${assignedClass}`)
    const { data, error } = await q
    if (error) console.error(error)
    else setStudents(data || [])
    setLoading(false)
  }

  const fetchAttendance = async (d) => {
    const { data, error } = await supabase.from('attendance').select('*').eq('date', d)
    if (error) { console.error(error); return }
    const mapped = {}
    ;(data || []).forEach(a => { mapped[a.student_id] = { status: a.status, note: a.note || '' } })
    setAttendance(mapped)
  }

  useEffect(() => { fetchStudents() }, [])
  useEffect(() => { fetchAttendance(date); setSaved(false) }, [date])

  // ── Derive unique classes from actual student data ─────
  const uniqueClasses = [...new Set(
    students.map(s => s.batch || s.class_name).filter(Boolean)
  )].sort()

  // ── Filtered view ──────────────────────────────────────
  const visible = students.filter(s => {
    const studentClass = s.batch || s.class_name
    const classMatch   = activeClass  === 'All' || studentClass === activeClass
    const courseMatch  = activeCourse === 'All' || s.course === activeCourse
    return classMatch && courseMatch
  })

  // ── Stat helpers ───────────────────────────────────────
  const countStatus = (list, st) => list.filter(s => attendance[s.id]?.status === st).length

  const classStat = cls => {
    const m = students.filter(s => (s.batch || s.class_name) === cls)
    return { total: m.length, present: countStatus(m, 'Present') }
  }

  // ── Mark ───────────────────────────────────────────────
  const mark = (id, status) => {
    if (!canTakeAttendance) return
    setAttendance(prev => ({ ...prev, [id]: { ...prev[id], status } }))
    setSaved(false)
  }

  const setNote = (id, note) => {
    setAttendance(prev => ({ ...prev, [id]: { ...prev[id], note } }))
    setSaved(false)
  }

  const markAll = (status) => {
    if (!canTakeAttendance) return
    setAttendance(prev => {
      const next = { ...prev }
      visible.forEach(s => { next[s.id] = { ...next[s.id], status } })
      return next
    })
    setSaved(false)
  }

  // ── Save ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!canTakeAttendance) return
    setSaving(true)
    for (const student of students) {
      const rec    = attendance[student.id]
      const status = rec?.status || 'Not Marked'
      const note   = rec?.note   || ''
      const { data: existing } = await supabase
        .from('attendance').select('id')
        .eq('student_id', student.id).eq('date', date).maybeSingle()
      if (existing) {
        await supabase.from('attendance')
          .update({ status, note, student_name: student.name, class_name: student.batch || student.class_name, course: student.course })
          .eq('id', existing.id)
      } else {
        await supabase.from('attendance').insert([{
          student_id: student.id, student_name: student.name,
          class_name: student.batch || student.class_name,
          course: student.course, date, status, note,
        }])
      }
    }
    setSaving(false)
    setSaved(true)
  }

  // ── Totals ─────────────────────────────────────────────
  const totals = STATUSES.reduce((acc, st) => {
    acc[st] = countStatus(visible, st); return acc
  }, {})
  const notMarked = visible.length - Object.values(totals).reduce((a, b) => a + b, 0)

  if (!canTakeAttendance) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>Access Restricted</div>
        <div style={{ color: '#64748b', marginTop: 8 }}>Only Admins and assigned Class Teachers can take attendance.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      {showSummary && <MonthlySummaryModal students={students} onClose={() => setShowSummary(false)} />}

      {/* Note editor */}
      {noteFor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.3)' }}
          onClick={() => setNoteFor(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 8px 40px rgba(0,0,0,.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>
              📝 Note for {students.find(s => s.id === noteFor)?.name}
            </div>
            <textarea
              autoFocus
              value={attendance[noteFor]?.note || ''}
              onChange={e => setNote(noteFor, e.target.value)}
              placeholder="e.g. Medical leave, informed by parent..."
              rows={3}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setNoteFor(null)}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>📅 Student Attendance</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>
            {role === 'class_teacher' ? `Class Teacher · ${assignedClass}` : 'Admin · All Classes'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowSummary(true)}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #7c3aed', color: '#7c3aed', background: '#f5f3ff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            📊 Monthly Summary
          </button>
          <button onClick={() => exportPDF(`Attendance — ${date}`, 'att-table')}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #1e3a5f', color: '#1e3a5f', background: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', minWidth: 170 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>📆 Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: '100%', padding: '7px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {[
          { label: 'Showing', val: visible.length, bg: '#eff6ff', col: '#1e3a5f' },
          { label: '✅ Present', val: totals.Present || 0, bg: '#dcfce7', col: '#16a34a' },
          { label: '❌ Absent',  val: totals.Absent  || 0, bg: '#fee2e2', col: '#dc2626' },
          { label: '🕐 Late',    val: totals.Late    || 0, bg: '#fef9c3', col: '#ca8a04' },
          { label: '🌓 Half Day',val: totals['Half Day'] || 0, bg: '#ede9fe', col: '#7c3aed' },
        ].map(t => (
          <div key={t.label} style={{ backgroundColor: t.bg, borderRadius: 12, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <p style={{ fontSize: 12, color: t.col, fontWeight: 600, margin: '0 0 4px' }}>{t.label}</p>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: t.col, margin: 0 }}>{t.val}</h2>
          </div>
        ))}
      </div>

      {/* ── Class filter (both admin and class_teacher) ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
          Filter by Class / Batch
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', ...uniqueClasses].map(cls => {
            const active = activeClass === cls
            const stat   = cls === 'All' ? null : classStat(cls)
            return (
              <button key={cls} onClick={() => setActiveClass(cls)} style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: active ? 'none' : '1px solid #d1d5db',
                backgroundColor: active ? '#1e3a5f' : 'white',
                color: active ? 'white' : '#374151',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {cls}
                {stat && (
                  <span style={{ fontSize: 11, borderRadius: '999px', padding: '1px 7px', fontWeight: 700,
                    backgroundColor: active ? 'rgba(255,255,255,.2)' : '#f1f5f9',
                    color: active ? 'white' : '#64748b' }}>
                    {stat.present}/{stat.total}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Course filter */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
          Filter by Course
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', ...COURSES].map(c => (
            <button key={c} onClick={() => setActiveCourse(c)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: activeCourse === c ? 'none' : '1px solid #e2e8f0',
              backgroundColor: activeCourse === c ? '#7c3aed' : 'white',
              color: activeCourse === c ? 'white' : '#64748b',
            }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUSES.map(st => {
          const cfg = STATUS_CFG[st]
          return (
            <button key={st} onClick={() => markAll(st)} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              backgroundColor: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: 13,
            }}>
              {cfg.icon} Mark All {st}
            </button>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#94a3b8' }}>
          Showing {visible.length} of {students.length} students
          {activeClass !== 'All' && <strong style={{ color: '#1e3a5f' }}> · {activeClass}</strong>}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading students...</div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
          <table id="att-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 780 }}>
            <thead>
              <tr style={{ backgroundColor: '#1e3a5f' }}>
                {['#', 'Student', 'Class', 'Course', 'Status', 'Mark Attendance', 'Note'].map(h => (
                  <th key={h} style={{ padding: '13px 14px', textAlign: 'left', color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((s, i) => {
                const rec    = attendance[s.id]
                const status = rec?.status
                const note   = rec?.note
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                    <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={s.name} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{s.name}</div>
                          {s.gcc_no && <div style={{ fontSize: 11, color: '#94a3b8' }}>GCC-{s.gcc_no}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: 12, fontWeight: 600, backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                        {s.batch || s.class_name || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 13 }}>{s.course || '—'}</td>
                    <td style={{ padding: '11px 14px' }}><StatusBadge status={status} /></td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {STATUSES.map(st => {
                          const cfg    = STATUS_CFG[st]
                          const active = status === st
                          return (
                            <button key={st} onClick={() => mark(s.id, st)} style={{
                              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              border: `1px solid ${cfg.color}`,
                              backgroundColor: active ? cfg.color : cfg.bg,
                              color: active ? 'white' : cfg.color,
                              transition: 'all .15s',
                            }}>
                              {cfg.icon} {st}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <button onClick={() => setNoteFor(s.id)} style={{
                        padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                        background: note ? '#fef9c3' : 'white', cursor: 'pointer', fontSize: 12,
                        color: note ? '#ca8a04' : '#94a3b8', fontWeight: 500,
                        maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        display: 'block',
                      }} title={note || 'Add note'}>
                        {note ? `📝 ${note}` : '+ Note'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                  {students.length === 0 ? 'No students found. Add students first!' : 'No students match current filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Save bar */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {notMarked > 0 && !saved && (
          <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 500 }}>
            ⚠ {notMarked} student{notMarked > 1 ? 's' : ''} not marked
          </span>
        )}
        {saved && <span style={{ color: '#16a34a', fontWeight: 600 }}>✅ Saved to database!</span>}
        <button onClick={() => exportCSV(
          students.map(s => ({ ...s, ...attendance[s.id], date })),
          `attendance-${date}.csv`
        )}
          style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #059669', color: '#059669', background: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          📥 Export CSV
        </button>
        <button onClick={handleSave} disabled={saving} style={{
          backgroundColor: saving ? '#94a3b8' : '#1e3a5f', color: 'white',
          border: 'none', borderRadius: 8, padding: '11px 32px',
          fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15,
        }}>
          {saving ? '⏳ Saving...' : '💾 Save Attendance'}
        </button>
      </div>
    </div>
  )
}
