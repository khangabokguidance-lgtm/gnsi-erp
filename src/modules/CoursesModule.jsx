/**
 * GNSI PORTAL — CoursesModule.jsx
 * Pages: Course Management (CRUD, subjects, student count, print/export)
 * Converted from: renderCourseManagement() in index.html
 * Storage: course_fees table (Supabase) + gnsi_keyvalue fallback
 */

import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

/* ── Default courses (matches original portal defaults) ── */
const DEFAULT_COURSES = [
  { id: 1, name: 'Sainik',     code: 'SAI', desc: 'Sainik School Entrance Preparation',            duration: '1 Year',   subjects: ['Mathematics','English','GK','Reasoning'],                    fee: 0, active: true },
  { id: 2, name: 'Navodaya',   code: 'NAV', desc: 'Jawahar Navodaya Vidyalaya Entrance Preparation',duration: '1 Year',   subjects: ['Mathematics','English','Hindi','Mental Ability'],            fee: 0, active: true },
  { id: 3, name: 'Foundation', code: 'FND', desc: 'Foundation Course for younger students',         duration: '6 Months', subjects: ['Mathematics','English','General Studies'],                   fee: 0, active: true },
]

const ACCENT = '#1433a8'

const inp = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e2e8f0', borderRadius: 9,
  fontSize: 14, fontFamily: "'DM Sans',sans-serif",
  background: '#f8faff', boxSizing: 'border-box',
}

const btn = (bg, color, border) => ({
  padding: '8px 18px', borderRadius: 9, border: border || 'none',
  background: bg, color, fontWeight: 700, fontSize: 13,
  cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
})

/* ── Course Form ── */
function CourseForm({ course, onSave, onCancel }) {
  const isEdit = !!course
  const [form, setForm] = useState({
    name:     course?.name     || '',
    code:     course?.code     || '',
    desc:     course?.desc     || '',
    duration: course?.duration || '',
    fee:      course?.fee      || 0,
    subjects: Array.isArray(course?.subjects) ? course.subjects.join(', ') : (course?.subjects || ''),
    active:   course?.active !== false,
  })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = () => {
    if (!form.name.trim()) { alert('Course name is required'); return }
    const subjs = form.subjects.split(',').map(s => s.trim()).filter(Boolean)
    onSave({
      ...form,
      id: course?.id,
      fee: parseFloat(form.fee) || 0,
      subjects: subjs,
      active: form.active === true || form.active === 'true' || form.active === '1',
    })
  }

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${ACCENT}`, borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, marginBottom: 16 }}>
        {isEdit ? '✏️ Edit Course' : '📖 New Course'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Course Name *</label>
          <input style={inp} value={form.name} onChange={set('name')} placeholder="e.g. Sainik, Navodaya" />
        </div>
        <div>
          <label style={lbl}>Short Code</label>
          <input style={inp} value={form.code} onChange={set('code')} placeholder="e.g. SAI, NAV" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>Description</label>
          <input style={inp} value={form.desc} onChange={set('desc')} placeholder="Course description" />
        </div>
        <div>
          <label style={lbl}>Duration</label>
          <input style={inp} value={form.duration} onChange={set('duration')} placeholder="e.g. 1 Year, 6 Months" />
        </div>
        <div>
          <label style={lbl}>Annual Fee (₹)</label>
          <input style={inp} type="number" value={form.fee} onChange={set('fee')} placeholder="0" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>Subjects (comma-separated)</label>
          <input style={inp} value={form.subjects} onChange={set('subjects')} placeholder="Mathematics, English, GK..." />
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select style={{ ...inp }} value={form.active ? '1' : '0'} onChange={e => setForm(f => ({ ...f, active: e.target.value === '1' }))}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={btn(`linear-gradient(135deg,${ACCENT},#1b44cc)`, '#fff')} onClick={handleSave}>
          💾 {isEdit ? 'Save Changes' : 'Create Course'}
        </button>
        <button style={btn('transparent', '#64748b', '1.5px solid #e2e8f0')} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }

/* ── Course Card ── */
function CourseCard({ course, studentCount, canEdit, onEdit, onDelete }) {
  const COLORS = { SAI: '#1d4ed8', NAV: '#15803d', FND: '#7c3aed', CMB: '#b45309' }
  const color = COLORS[course.code] || ACCENT

  return (
    <div style={{ background: '#fff', border: `1.5px solid #e2e8f0`, borderTop: `4px solid ${color}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: color, color: '#fff', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{course.code}</span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{course.name}</span>
        </div>
        <span style={{ background: course.active ? '#f0fdf4' : '#fef2f2', color: course.active ? '#16a34a' : '#dc2626', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
          {course.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {course.desc && <div style={{ fontSize: 13, color: '#64748b' }}>{course.desc}</div>}

      <div style={{ display: 'flex', gap: 16, fontSize: 12.5, flexWrap: 'wrap', color: '#475569' }}>
        <span>⏱ {course.duration || '—'}</span>
        <span>💰 ₹{Number(course.fee || 0).toLocaleString('en-IN')}/yr</span>
        <span>👨‍🎓 {studentCount} students</span>
      </div>

      {course.subjects?.length > 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          📚 {Array.isArray(course.subjects) ? course.subjects.join(' · ') : course.subjects}
        </div>
      )}

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={() => onEdit(course)} style={{ background: '#e8ecff', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            ✏️ Edit
          </button>
          <button onClick={() => onDelete(course.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Main CoursesModule ── */
export default function CoursesModule({ currentUser, students = [], courses: propCourses, onCoursesChange, showToast }) {
  const [courses, setCourses] = useState([])
  const [editing, setEditing] = useState(null)   // null | 'new' | course object
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')    // 'all' | 'active' | 'inactive'

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager'

  /* ── Load from Supabase gnsi_keyvalue, fall back to defaults ── */
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('gnsi_keyvalue')
          .select('value')
          .eq('key', 'gnsi_course_defs')
          .single()
        if (data?.value) {
          setCourses(JSON.parse(data.value))
        } else {
          setCourses(DEFAULT_COURSES)
        }
      } catch {
        setCourses(DEFAULT_COURSES)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveToDB(updated) {
    await supabase.from('gnsi_keyvalue').upsert(
      { key: 'gnsi_course_defs', value: JSON.stringify(updated) },
      { onConflict: 'key' }
    )
    onCoursesChange?.(updated)
  }

  const handleSave = async (data) => {
    let updated
    if (data.id && editing !== 'new') {
      updated = courses.map(c => c.id === data.id ? { ...c, ...data, savedAt: new Date().toISOString() } : c)
      showToast?.('✅ Course updated', '#16a34a')
    } else {
      const newCourse = { ...data, id: Date.now(), savedAt: new Date().toISOString() }
      updated = [...courses, newCourse]
      showToast?.('✅ Course created', '#16a34a')
    }
    setCourses(updated)
    await saveToDB(updated)
    setEditing(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this course?')) return
    const updated = courses.filter(c => c.id !== id)
    setCourses(updated)
    await saveToDB(updated)
    showToast?.('🗑️ Course deleted', '#64748b')
  }

  /* ── Filter ── */
  const filtered = courses.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.code || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'active' ? c.active : !c.active)
    return matchSearch && matchFilter
  })

  const getStudentCount = (course) =>
    students.filter(s => (s.course || '').toLowerCase() === (course.name || '').toLowerCase()).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>
      ⏳ Loading courses…
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Form ── */}
      {editing && (
        <CourseForm
          course={editing === 'new' ? null : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* ── Header ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>📖 Course Management</span>
        <div style={{ flex: 1 }} />

        {/* Stats */}
        <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
          {courses.filter(c => c.active).length} Active
        </span>
        <span style={{ background: '#f8faff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
          {courses.length} Total
        </span>

        {isAdmin && !editing && (
          <button
            onClick={() => setEditing('new')}
            style={btn(`linear-gradient(135deg,${ACCENT},#1b44cc)`, '#fff')}
          >
            + New Course
          </button>
        )}
      </div>

      {/* ── Search + Filter ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          style={{ ...inp, flex: 1, minWidth: 200 }}
          placeholder="🔍 Search course name or code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${filter === f ? ACCENT : '#e2e8f0'}`,
            background: filter === f ? ACCENT : '#fff', color: filter === f ? '#fff' : '#64748b',
            fontWeight: filter === f ? 700 : 500, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize',
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* ── Cards grid ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          {search ? 'No courses match your search.' : 'No courses defined yet.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {filtered.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              studentCount={getStudentCount(course)}
              canEdit={isAdmin}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Summary footer ── */}
      {courses.length > 0 && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: '#f8faff', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span>📊 Total courses: <b>{courses.length}</b></span>
          <span>👨‍🎓 Total enrolled students: <b>{students.length}</b></span>
          <span>✅ Active: <b>{courses.filter(c => c.active).length}</b></span>
          <span>⏸ Inactive: <b>{courses.filter(c => !c.active).length}</b></span>
        </div>
      )}
    </div>
  )
}
