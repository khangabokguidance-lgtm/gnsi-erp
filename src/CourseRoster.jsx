// CourseRoster.jsx — the Enrollments tab of the Courses module: which student is in which course
// and batch. Read-only and taken straight from the Students table, which Admissions fills and
// everything else (Attendance, Fees, Hostel) already uses. The old separate `course_enrollments`
// list was edited by hand here only and drifted out of step with the real students.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { courseOf, batchOf, COURSE_ORDER } from './courseMap'

const HOSTELS = ['Boarder', 'Day Boarder', 'Day Scholar']
const chip = on => ({ padding: '6px 13px', borderRadius: 999, border: `1px solid ${on ? '#1e3a6e' : '#d9d2c2'}`, background: on ? '#1e3a6e' : '#fff', color: on ? '#fff' : '#2e3b52', fontSize: 12, fontWeight: 700, cursor: 'pointer' })

export default function CourseRoster({ isMobile }) {
  const [students, setStudents] = useState(null)
  const [err, setErr] = useState('')
  const [course, setCourse] = useState('All')
  const [hostel, setHostel] = useState('All')
  const [q, setQ] = useState('')

  useEffect(() => {
    let live = true
    Promise.resolve(supabase.from('students').select('id, name, gcc_no, course, batch, class_name, hostel_type, session, status').order('name')).then(({ data, error }) => {
      if (!live) return
      if (error) { setErr(error.message); setStudents([]); return }
      setStudents((data || []).filter(s => !s.status || s.status === 'Active'))
    }).catch(e => { if (live) { setErr(e.message || 'Could not load students'); setStudents([]) } })
    return () => { live = false }
  }, [])

  const rows = useMemo(() => (students || []).map(s => ({ ...s, _course: courseOf(s), _batch: batchOf(s) })), [students])
  const courses = [...COURSE_ORDER, ...(rows.some(r => r._course === 'Unassigned') ? ['Unassigned'] : [])]
  const shown = rows.filter(r => (course === 'All' || r._course === course) && (hostel === 'All' || r.hostel_type === hostel)
    && (!q.trim() || `${r.name} ${r.gcc_no}`.toLowerCase().includes(q.trim().toLowerCase())))
  const countOf = c => rows.filter(r => r._course === c).length

  return (
    <div>
      <div style={{ fontSize: 12, color: '#5d6b82', marginBottom: 12 }}>Active students by course and batch, read from the Students module. To enrol, move or change a student, use Admissions or Students.</div>
      {err && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load students: {err}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button style={chip(course === 'All')} onClick={() => setCourse('All')}>All ({rows.length})</button>
        {courses.map(c => <button key={c} style={chip(course === c)} onClick={() => setCourse(c)}>{c} ({countOf(c)})</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {['All', ...HOSTELS].map(h => <button key={h} style={chip(hostel === h)} onClick={() => setHostel(h)}>{h}</button>)}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / GCC" style={{ marginLeft: isMobile ? 0 : 'auto', padding: '7px 11px', borderRadius: 8, border: '1px solid #d9d2c2', minWidth: 170 }} />
      </div>
      {students === null ? <div style={{ fontSize: 13 }}>Loading…</div> : (
        <div style={{ background: '#fff', border: '1px solid #e8e3d8', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: isMobile ? 520 : 0 }}>
              <thead><tr style={{ textAlign: 'left', color: '#5d6b82', background: '#faf8f3' }}>
                <th style={{ padding: '9px 12px' }}>Student</th><th>GCC</th><th>Course</th><th>Batch</th><th>Hostel type</th><th>Session</th></tr></thead>
              <tbody>
                {shown.slice(0, 500).map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f3f0e8' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{r.name}</td><td>{r.gcc_no}</td><td>{r._course}</td><td>{r._batch}</td><td>{r.hostel_type || '—'}</td><td>{r.session || '—'}</td>
                  </tr>))}
                {!shown.length && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8a93a6' }}>No students match.</td></tr>}
              </tbody>
            </table>
          </div>
          {shown.length > 500 && <div style={{ padding: 10, fontSize: 12, color: '#5d6b82' }}>Showing the first 500 of {shown.length} — narrow the filters to see the rest.</div>}
        </div>
      )}
    </div>
  )
}
