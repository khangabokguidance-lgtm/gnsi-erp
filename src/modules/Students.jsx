import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'
import { useAuth } from '../core/auth'

const COURSES = ['Combined', 'Sainik', 'Navodaya', 'Foundation']
const SUBTYPES = ['Boarder', 'Day Scholar', 'Day Boarder']

const emptyForm = {
  name: '', roll_no: '', phone: '', father_name: '', mother_name: '',
  dob: '', gender: 'Male', course: '', subtype: 'Boarder',
  cls: '', session: '', adm_no: '', address: '', is_boarder: false,
  category: 'General', religion: '', status: 'Active'
}

export default function Students() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCourse, setFilterCourse] = useState('All')
  const [filterStatus, setFilterStatus] = useState('Active')
  const [showForm, setShowForm] = useState(false)
  const [editStudent, setEditStudent] = useState(null)
  const [viewStudent, setViewStudent] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  useEffect(() => { loadStudents() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadStudents = async () => {
    setLoading(true)
    const { data } = await supabase.from('students').select('*').order('name')
    setStudents(data || [])
    setLoading(false)
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || (s.name||'').toLowerCase().includes(q) ||
      (s.roll_no||'').toLowerCase().includes(q) ||
      (s.adm_no||'').toLowerCase().includes(q) ||
      (s.phone||'').includes(q)
    const matchCourse = filterCourse === 'All' || (s.course||'') === filterCourse
    const matchStatus = filterStatus === 'All' || (s.status||'Active') === filterStatus
    return matchSearch && matchCourse && matchStatus
  })

  const openNew = () => {
    setEditStudent(null)
    setForm(emptyForm)
    setViewStudent(null)
    setShowForm(true)
  }

  const openEdit = (s) => {
    setEditStudent(s)
    setForm({
      name: s.name || '', roll_no: s.roll_no || '', phone: s.phone || '',
      father_name: s.father_name || '', mother_name: s.mother_name || '',
      dob: s.dob || '', gender: s.gender || 'Male', course: s.course || '',
      subtype: s.subtype || 'Boarder', cls: s.cls || s.class_name || '',
      session: s.session || '', adm_no: s.adm_no || '', address: s.address || '',
      is_boarder: s.is_boarder || false, category: s.category || 'General',
      religion: s.religion || '', status: s.status || 'Active'
    })
    setViewStudent(null)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return showToast('❌ Student name is required')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(), roll_no: form.roll_no || null,
        phone: form.phone || null, father_name: form.father_name || null,
        mother_name: form.mother_name || null, dob: form.dob || null,
        gender: form.gender, course: form.course || null,
        subtype: form.subtype || null, cls: form.cls || null,
        session: form.session || null, adm_no: form.adm_no || null,
        address: form.address || null, is_boarder: form.subtype === 'Boarder',
        category: form.category, religion: form.religion || null,
        status: form.status, updated_at: new Date().toISOString()
      }
      if (editStudent) {
        await supabase.from('students').update(payload).eq('id', editStudent.id)
        showToast('✅ Student updated!')
      } else {
        payload.created_at = new Date().toISOString()
        await supabase.from('students').insert(payload)
        showToast('✅ Student added!')
      }
      setShowForm(false)
      loadStudents()
    } catch(e) { showToast('❌ Error: ' + e.message) }
    setSaving(false)
  }

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return
    await supabase.from('students').delete().eq('id', s.id)
    showToast('🗑️ Student deleted')
    loadStudents()
  }

  const toggleStatus = async (s) => {
    const newStatus = s.status === 'Active' ? 'Inactive' : 'Active'
    await supabase.from('students').update({ status: newStatus }).eq('id', s.id)
    showToast(newStatus === 'Active' ? '✅ Student activated' : '⛔ Student deactivated')
    loadStudents()
  }

  const avatar = (name) => {
    const initials = (name || '?').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase()
    const colors = ['#1433a8','#7c3aed','#15803d','#d97706','#0891b2','#dc2626']
    const color = colors[(name||'').charCodeAt(0) % colors.length]
    return (
      <div style={{
        width: 36, height: 36, borderRadius: '50%', background: color + '20',
        color: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, flexShrink: 0, border: `1.5px solid ${color}33`
      }}>{initials}</div>
    )
  }

  // Student detail view
  if (viewStudent) {
    const s = viewStudent
    return (
      <div>
        <button onClick={() => setViewStudent(null)} className="btn btn-outline" style={{ marginBottom: 16, fontSize: 13 }}>← Back</button>
        <div className="card">
          <div className="card-head">
            <span className="card-title">👨‍🎓 Student Profile</span>
            {isAdmin && <button onClick={() => openEdit(s)} className="btn btn-primary" style={{ fontSize: 12 }}>✏️ Edit</button>}
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', background: '#1433a820',
                color: '#1433a8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 900, border: '2px solid #1433a833'
              }}>
                {(s.name || '?').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{s.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  {s.course} · {s.cls || '—'} · Adm# {s.adm_no || '—'}
                </div>
                <span className={`badge ${s.status === 'Active' ? 'badge-green' : 'badge-red'}`} style={{ marginTop: 6, display: 'inline-block' }}>
                  {s.status || 'Active'}
                </span>
              </div>
            </div>
            <div className="form-grid g2">
              {[
                ['Roll No', s.roll_no], ['Admission No', s.adm_no],
                ['Phone', s.phone], ['Gender', s.gender],
                ['Date of Birth', s.dob], ['Course', s.course],
                ['Sub-type', s.subtype], ['Class', s.cls],
                ['Session', s.session], ['Category', s.category],
                ['Religion', s.religion], ['Father Name', s.father_name],
                ['Mother Name', s.mother_name], ['Address', s.address],
              ].map(([label, value]) => (
                <div key={label} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{value || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, background: '#0f172a', color: '#fff',
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>{toast}</div>
      )}

      <div className="page-header">
        <div className="page-header-eyebrow">GNSI · STUDENTS</div>
        <div className="page-header-title">👨‍🎓 Students</div>
        <div className="page-header-sub">Manage all enrolled students</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <div className="stat-card" style={{ '--c': '#1433a8' }}>
          <div className="stat-label">Total Students</div>
          <div className="stat-val">{students.length}</div>
        </div>
        <div className="stat-card" style={{ '--c': '#15803d' }}>
          <div className="stat-label">Active</div>
          <div className="stat-val">{students.filter(s => s.status === 'Active').length}</div>
        </div>
        <div className="stat-card" style={{ '--c': '#7c3aed' }}>
          <div className="stat-label">Boarders</div>
          <div className="stat-val">{students.filter(s => s.is_boarder || s.subtype === 'Boarder').length}</div>
        </div>
        <div className="stat-card" style={{ '--c': '#d97706' }}>
          <div className="stat-label">Showing</div>
          <div className="stat-val">{filtered.length}</div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <span className="card-title">{editStudent ? '✏️ Edit Student' : '➕ Add Student'}</span>
            <button onClick={() => setShowForm(false)} className="btn btn-outline" style={{ fontSize: 12 }}>Cancel</button>
          </div>
          <div style={{ padding: 20 }}>
            <div className="form-grid g2">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Student full name" />
              </div>
              <div className="form-group">
                <label>Admission No</label>
                <input value={form.adm_no} onChange={e => setForm(f => ({ ...f, adm_no: e.target.value }))} placeholder="e.g. GNSI/2024/001" />
              </div>
              <div className="form-group">
                <label>Roll No</label>
                <input value={form.roll_no} onChange={e => setForm(f => ({ ...f, roll_no: e.target.value }))} placeholder="Roll number" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Parent phone number" />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13 }}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Course</label>
                <select value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))}
                  style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13 }}>
                  <option value="">Select course</option>
                  {COURSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sub-type</label>
                <select value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))}
                  style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13 }}>
                  {SUBTYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Class / Batch</label>
                <input value={form.cls} onChange={e => setForm(f => ({ ...f, cls: e.target.value }))} placeholder="e.g. Navodaya 2024" />
              </div>
              <div className="form-group">
                <label>Session</label>
                <input value={form.session} onChange={e => setForm(f => ({ ...f, session: e.target.value }))} placeholder="e.g. 2024-25" />
              </div>
              <div className="form-group">
                <label>Father's Name</label>
                <input value={form.father_name} onChange={e => setForm(f => ({ ...f, father_name: e.target.value }))} placeholder="Father's full name" />
              </div>
              <div className="form-group">
                <label>Mother's Name</label>
                <input value={form.mother_name} onChange={e => setForm(f => ({ ...f, mother_name: e.target.value }))} placeholder="Mother's full name" />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13 }}>
                  {['General','OBC','SC','ST','EWS'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Religion</label>
                <input value={form.religion} onChange={e => setForm(f => ({ ...f, religion: e.target.value }))} placeholder="e.g. Hindu" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Address</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13 }}>
                  <option>Active</option><option>Inactive</option><option>Passed Out</option><option>Left</option>
                </select>
              </div>
            </div>
            <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ marginTop: 8 }}>
              {saving ? '⏳ Saving…' : '💾 Save Student'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="card-head">
          <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search name, roll, phone, adm no…"
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13 }} />
            <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13 }}>
              <option value="All">All Courses</option>
              {COURSES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13 }}>
              <option value="All">All Status</option>
              <option>Active</option><option>Inactive</option><option>Passed Out</option><option>Left</option>
            </select>
          </div>
          {isAdmin && !showForm && (
            <button onClick={openNew} className="btn btn-primary" style={{ fontSize: 12, marginLeft: 10 }}>+ Add Student</button>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div className="loading-spinner">⏳ Loading students…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👨‍🎓</div>
              <div style={{ fontWeight: 700 }}>No students found</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Adm No</th>
                  <th>Course</th>
                  <th>Class</th>
                  <th>Phone</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }}>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                    <td onClick={() => setViewStudent(s)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {avatar(s.name)}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Roll: {s.roll_no || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--muted)' }}>{s.adm_no || '—'}</td>
                    <td>
                      {s.course ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1433a8' }}>
                          {s.course}
                          {s.subtype && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {s.subtype}</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{s.cls || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.phone || '—'}</td>
                    <td>
                      <span className={`badge ${s.status === 'Active' ? 'badge-green' : s.status === 'Inactive' ? 'badge-red' : 'badge-yellow'}`}>
                        {s.status || 'Active'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => openEdit(s)}
                            style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            ✏️
                          </button>
                          <button onClick={() => toggleStatus(s)}
                            style={{ background: s.status === 'Active' ? '#fef3c7' : '#dcfce7', color: s.status === 'Active' ? '#d97706' : '#16a34a', border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            {s.status === 'Active' ? '⛔' : '✅'}
                          </button>
                          <button onClick={() => handleDelete(s)}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
