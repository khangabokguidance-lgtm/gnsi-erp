import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const COURSES   = ['Sainik School', 'Navodaya', 'Foundation', 'Combined', 'Achiever']
const CLASSES   = ['Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9']
const HOUSES    = ['Kombirei', 'Kangla', 'Shagolsem', 'Ibudhou']
const PAGE_SIZE = 50

const fmt = n => Number(n || 0).toLocaleString('en-IN')

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ name }) {
  const colors = ['#1e3a5f', '#2563eb', '#7c3aed', '#0891b2', '#059669']
  const color = colors[(name || '').charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      backgroundColor: color, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: '700', fontSize: '13px', flexShrink: 0
    }}>
      {getInitials(name)}
    </div>
  )
}

// ─── Fee Panel (slide-in) ──────────────────────────────────────
function StudentFeePanel({ student, admApp, cols, flatRecs, crsfRecs, onClose }) {
  const appId    = admApp ? String(admApp.id) : null
  const admCols  = appId ? cols.filter(c => c.admAppId === appId && (c.feeType === 'admission' || c.feeType === 'item')) : []
  const advCols  = appId ? cols.filter(c => c.admAppId === appId && c.feeType === 'advance') : []
  const flatPaid = appId ? flatRecs.filter(r => r.appId === appId && r.paid) : []
  const crsfPaid = appId ? crsfRecs.filter(r => r.appId === appId) : []

  const admTotal   = admCols.reduce((s, c)  => s + (Number(c.amountPaid) || 0), 0)
  const flatTotal  = flatPaid.reduce((s, r)  => s + (r.amount || 0), 0)
  const crsfTotal  = crsfPaid.reduce((s, r)  => s + (Number(r.amountPaid) || 0), 0)
  const advTotal   = advCols.reduce((s, c)   => s + (Number(c.amountPaid) || 0), 0)
  const grandTotal = admTotal + flatTotal + crsfTotal + advTotal

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,26,.7)', zIndex: 9999, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: 'min(680px,100vw)', height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 60px rgba(0,0,0,.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,#1e3a5f,#7c3aed,#059669)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <Avatar name={student.name} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{student.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {student.gcc_no && <span style={{ fontWeight: 700, color: '#1e3a5f' }}>GCC-{student.gcc_no}</span>}
              {student.class_name && <span>{student.class_name}</span>}
              {student.course && <span>{student.course}</span>}
              {admApp?.admNo && <span style={{ color: '#4f46e5', fontWeight: 600 }}>{admApp.admNo}</span>}
              {grandTotal > 0 && <span style={{ color: '#059669', fontWeight: 700 }}>₹{fmt(grandTotal)} paid</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 16, color: '#64748b' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {/* No admission record */}
          {!admApp ? (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '24px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e', marginBottom: 8 }}>No Admission Record Found</div>
              <div style={{ fontSize: 13, color: '#b45309', marginBottom: 16, lineHeight: 1.7 }}>
                {student.gcc_no
                  ? <>GCC No: <strong>GCC-{student.gcc_no}</strong> — create an admission record using this GCC No in the Admissions module.</>
                  : <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠ No GCC No. assigned. Edit this student to add one first.</span>
                }
              </div>
            </div>
          ) : (
            <>
              {/* KPI tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 20 }}>
                {[
                  { icon: '🎓', label: 'Admission',  amt: admTotal,   color: '#4f46e5' },
                  { icon: '📅', label: 'Flat Fees',  amt: flatTotal,  color: '#059669' },
                  { icon: '📚', label: 'Course Fee', amt: crsfTotal,  color: '#7c3aed' },
                  { icon: '💰', label: 'Total',      amt: grandTotal, color: '#d97706' },
                ].map(t => (
                  <div key={t.label} style={{ background: t.color + '10', border: `1px solid ${t.color}30`, borderRadius: 10, padding: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: t.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: t.color, marginTop: 3 }}>₹{fmt(t.amt)}</div>
                  </div>
                ))}
              </div>

              {/* Admission info bar */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                {[
                  ['Adm. No',    admApp.admNo    || '—'],
                  ['Session',    admApp.session   || '—'],
                  ['Adm Status', admApp.status    || '—'],
                  ['GCC No',     student.gcc_no ? `GCC-${student.gcc_no}` : '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Transaction log */}
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Transaction Log</div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Stage', 'Description', 'Date', 'Mode', 'Amount'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admCols.length === 0 && flatPaid.length === 0 && crsfPaid.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No transactions yet</td></tr>
                    )}
                    {admCols.map((c, i) => (
                      <tr key={'a' + i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: '#eef2ff', color: '#4f46e5' }}>Adm</span></td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{c.description || 'Admission Fee'}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{c.payDate || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{c.payMode || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>₹{fmt(c.amountPaid)}</td>
                      </tr>
                    ))}
                    {flatPaid.map((r, i) => (
                      <tr key={'f' + i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: '#ecfdf5', color: '#059669' }}>Flat</span></td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{r.month} {r.year}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.date || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.mode || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>₹{fmt(r.amount)}</td>
                      </tr>
                    ))}
                    {crsfPaid.map((r, i) => (
                      <tr key={'c' + i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed' }}>Course</span></td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{r.course} · {r.forMonth}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.date || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.payMode || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>₹{fmt(r.amountPaid)}</td>
                      </tr>
                    ))}
                    {grandTotal > 0 && (
                      <tr style={{ background: '#0f172a' }}>
                        <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 800, fontSize: 13, color: '#fff' }}>Grand Total</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 15, fontWeight: 900, color: '#fcd34d' }}>₹{fmt(grandTotal)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 22px', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#64748b' }}>✕ Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Students Page ────────────────────────────────────────
export default function Students() {
  const [students,  setStudents]  = useState([])
  const [admApps,   setAdmApps]   = useState([])   // adm_applications
  const [cols,      setCols]      = useState([])   // adm_fee_collections
  const [flatRecs,  setFlatRecs]  = useState([])   // adm_flat_fees
  const [crsfRecs,  setCrsfRecs]  = useState([])   // adm_course_fees
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [page,      setPage]      = useState(1)
  const [editStudent,  setEditStudent]  = useState(null)
  const [viewStudent,  setViewStudent]  = useState(null)
  const [feeStudent,   setFeeStudent]   = useState(null)  // ← fee panel target
  const [showForm,  setShowForm]  = useState(false)
  const [form, setForm] = useState({
    name: '', class_name: '', course: '', phone: '',
    parent_phone: '', gcc_no: '', house: '', hostel_type: 'Day Scholar',
    fees_status: 'Pending', session: '', status: 'Active'
  })

  // ── Load everything ──────────────────────────────────────
  const loadAll = async () => {
    setLoading(true)
    const [sRes, aRes, cRes, fRes, crRes] = await Promise.all([
      supabase.from('students').select('*').order('created_at', { ascending: false }),
      supabase.from('adm_applications').select('*'),
      supabase.from('adm_fee_collections').select('*'),
      supabase.from('adm_flat_fees').select('*'),
      supabase.from('adm_course_fees').select('*'),
    ])
    setStudents(sRes.data  || [])
    setAdmApps(aRes.data   || [])
    setCols(cRes.data      || [])
    setFlatRecs(fRes.data  || [])
    setCrsfRecs(crRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // ── Link helpers ─────────────────────────────────────────
  const getAdmApp = s => {
    if (!s.gcc_no) return null
    return admApps.find(a => String(a.gcc_no) === String(s.gcc_no)) || null
  }

  const getLiveFeeSummary = s => {
    const app = getAdmApp(s)
    if (!app) return { total: 0, hasFees: false, status: s.fees_status || 'Pending' }
    const appId    = String(app.id)
    const admTotal = cols.filter(c => c.admAppId === appId).reduce((acc, c) => acc + (Number(c.amountPaid) || 0), 0)
    const flatTotal= flatRecs.filter(r => r.appId === appId && r.paid).reduce((acc, r) => acc + (r.amount || 0), 0)
    const crsfTotal= crsfRecs.filter(r => r.appId === appId).reduce((acc, r) => acc + (Number(r.amountPaid) || 0), 0)
    const total    = admTotal + flatTotal + crsfTotal
    const status   = total > 0 ? 'Paid' : 'Pending'
    return { total, hasFees: total > 0, status }
  }

  // ── Filter + paginate ────────────────────────────────────
  const filtered = students.filter(s =>
    (s.name       || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.class_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.course     || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.gcc_no     || '').toString().includes(search)
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── CRUD ─────────────────────────────────────────────────
  const resetForm = () => setForm({
    name: '', class_name: '', course: '', phone: '',
    parent_phone: '', gcc_no: '', house: '', hostel_type: 'Day Scholar',
    fees_status: 'Pending', session: '', status: 'Active'
  })

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('students').insert([form])
    if (error) alert('Error adding student: ' + error.message)
    else { resetForm(); setShowForm(false); loadAll() }
    setSaving(false)
  }

  const handleEdit = async (e) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('students').update(editStudent).eq('id', editStudent.id)
    if (error) alert('Error updating: ' + error.message)
    else { setEditStudent(null); loadAll() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student?')) return
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) alert('Error deleting: ' + error.message)
    else loadAll()
  }

  // ── House assignment — fixed: updates `house` column ────
  const handleHouseChange = async (id, house) => {
    await supabase.from('students').update({ house }).eq('id', id)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, house } : s))
  }

  // ── Hostel type — updates `hostel_type` column ──────────
  const handleHostelChange = async (id, hostel_type) => {
    await supabase.from('students').update({ hostel_type }).eq('id', id)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, hostel_type } : s))
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', backgroundColor: 'white'
  }
  const labelStyle = {
    display: 'block', fontSize: '13px', fontWeight: '600',
    color: '#374151', marginBottom: '6px'
  }

  const FormFields = ({ data, setData }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {[
        { label: 'Full Name',     key: 'name',         placeholder: 'Enter full name' },
        { label: 'GCC No.',       key: 'gcc_no',        placeholder: 'Enter GCC number' },
        { label: 'Phone Number',  key: 'phone',         placeholder: 'Student phone' },
        { label: 'Parent Phone',  key: 'parent_phone',  placeholder: 'Parent / Guardian phone' },
        { label: 'Session',       key: 'session',       placeholder: 'e.g. 2024-25' },
      ].map(field => (
        <div key={field.key}>
          <label style={labelStyle}>{field.label}</label>
          <input
            placeholder={field.placeholder}
            value={data[field.key] || ''}
            onChange={e => setData({ ...data, [field.key]: e.target.value })}
            style={inputStyle}
          />
        </div>
      ))}
      {[
        { label: 'Class',        key: 'class_name',  options: CLASSES },
        { label: 'Course',       key: 'course',      options: COURSES },
        { label: 'House',        key: 'house',       options: HOUSES },
        { label: 'Hostel Type',  key: 'hostel_type', options: ['Hostel', 'Day Scholar'] },
        { label: 'Fees Status',  key: 'fees_status', options: ['Pending', 'Paid', 'Partial'] },
        { label: 'Status',       key: 'status',      options: ['Active', 'Inactive'] },
      ].map(field => (
        <div key={field.key}>
          <label style={labelStyle}>{field.label}</label>
          <select
            value={data[field.key] || ''}
            onChange={e => setData({ ...data, [field.key]: e.target.value })}
            style={inputStyle}
          >
            <option value="">Select {field.label}</option>
            {field.options.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      ))}
    </div>
  )

  const feeStatusStyle = status => ({
    padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
    backgroundColor: status === 'Paid' ? '#dcfce7' : status === 'Partial' ? '#fef9c3' : '#fee2e2',
    color:           status === 'Paid' ? '#16a34a' : status === 'Partial' ? '#ca8a04' : '#dc2626',
  })

  // House badge colours
  const houseBg = { Kombirei: '#dbeafe', Kangla: '#fee2e2', Shagolsem: '#dcfce7', Ibudhou: '#fef9c3' }
  const houseColor = { Kombirei: '#1d4ed8', Kangla: '#dc2626', Shagolsem: '#16a34a', Ibudhou: '#ca8a04' }

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Fee Panel */}
      {feeStudent && (
        <StudentFeePanel
          student={feeStudent}
          admApp={getAdmApp(feeStudent)}
          cols={cols}
          flatRecs={flatRecs}
          crsfRecs={crsfRecs}
          onClose={() => setFeeStudent(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>👨‍🎓 Students</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>Total: {students.length} students</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditStudent(null) }}
          style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        >
          {showForm ? '✖ Cancel' : '➕ Add Student'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1e3a5f', marginBottom: '16px' }}>Add New Student</h2>
          <form onSubmit={handleAdd}>
            <FormFields data={form} setData={setForm} />
            <button type="submit" disabled={saving}
              style={{ marginTop: '16px', backgroundColor: saving ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
              {saving ? '⏳ Saving...' : '✅ Save Student'}
            </button>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editStudent && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '700px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>✏️ Edit Student</h2>
              <button onClick={() => setEditStudent(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <FormFields data={editStudent} setData={setEditStudent} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" disabled={saving}
                  style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                  {saving ? '⏳ Saving...' : '✅ Update Student'}
                </button>
                <button type="button" onClick={() => setEditStudent(null)}
                  style={{ backgroundColor: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewStudent && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '480px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>👁 Student Details</h2>
              <button onClick={() => setViewStudent(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <Avatar name={viewStudent.name} />
              <div>
                <div style={{ fontWeight: '700', fontSize: '18px', color: '#1e293b' }}>{viewStudent.name}</div>
                <div style={{ color: '#64748b', fontSize: '13px' }}>GCC No: {viewStudent.gcc_no || '--'}</div>
              </div>
            </div>
            {(() => {
              const fee = getLiveFeeSummary(viewStudent)
              return [
                ['Class',        viewStudent.class_name],
                ['Course',       viewStudent.course],
                ['Phone',        viewStudent.phone],
                ['Parent Phone', viewStudent.parent_phone],
                ['House',        viewStudent.house],
                ['Hostel Type',  viewStudent.hostel_type],
                ['Fees Paid',    fee.hasFees ? `₹${fmt(fee.total)}` : 'None'],
                ['Fee Status',   fee.status],
                ['Session',      viewStudent.session],
                ['Status',       viewStudent.status],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{label}</span>
                  <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600' }}>{val || '--'}</span>
                </div>
              ))
            })()}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setViewStudent(null); setFeeStudent(viewStudent) }}
                style={{ flex: 1, backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
              >
                💰 Fee Account
              </button>
              <button onClick={() => setViewStudent(null)}
                style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          placeholder="🔍 Search by name, class, course or GCC no..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#94a3b8' : '#374151', fontWeight: '500', fontSize: '14px' }}>
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              style={{ padding: '6px 12px', borderRadius: '8px', border: p === page ? 'none' : '1px solid #d1d5db', backgroundColor: p === page ? '#1e3a5f' : 'white', color: p === page ? 'white' : '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#94a3b8' : '#374151', fontWeight: '500', fontSize: '14px' }}>
            Next →
          </button>
          <span style={{ color: '#64748b', fontSize: '14px', marginLeft: '8px' }}>
            Page {page} / {totalPages} · {filtered.length} students
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b', fontSize: '16px' }}>⏳ Loading students...</div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '900px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e3a5f' }}>
                {['STUDENT', 'GCC NO.', 'CLASS', 'COURSE', 'PARENT / PHONE', 'HOUSE ASSIGNED', 'FEES', 'SESSION', 'ACTIONS'].map(h => (
                  <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: 'white', fontSize: '12px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(s => {
                const feeSummary = getLiveFeeSummary(s)
                const admApp     = getAdmApp(s)
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    {/* Student */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={s.name} />
                        <div>
                          <div
                            style={{ fontWeight: '600', color: '#1e3a5f', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
                            onClick={() => setViewStudent(s)}
                          >
                            {s.name ? (s.name.length > 12 ? s.name.slice(0, 12) + '...' : s.name) : '--'}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '12px' }}>{s.gcc_no || '--'}</div>
                        </div>
                      </div>
                    </td>

                    {/* GCC No */}
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>{s.gcc_no || '--'}</td>

                    {/* Class */}
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b' }}>{s.class_name || '--'}</td>

                    {/* Course */}
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>{s.course || '--'}</td>

                    {/* Parent / Phone */}
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{s.parent_phone || '--'}</div>
                      <div>{s.phone || '--'}</div>
                    </td>

                    {/* House Assigned — fixed: two separate dropdowns */}
                    <td style={{ padding: '14px 16px' }}>
                      {s.house ? (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', backgroundColor: houseBg[s.house] || '#f1f5f9', color: houseColor[s.house] || '#374151', fontWeight: '600', fontSize: '12px', marginBottom: '4px' }}>
                          ● {s.house.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', backgroundColor: '#fef9c3', color: '#ca8a04', fontWeight: '600', fontSize: '12px', marginBottom: '4px' }}>
                          ⚠ Not Assigned
                        </span>
                      )}
                      {/* House select */}
                      <select
                        value={s.house || ''}
                        onChange={e => handleHouseChange(s.id, e.target.value)}
                        style={{ display: 'block', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', marginTop: 4, width: '100%' }}
                      >
                        <option value="">Assign House</option>
                        {HOUSES.map(h => <option key={h}>{h}</option>)}
                      </select>
                      {/* Hostel type select */}
                      <select
                        value={s.hostel_type || 'Day Scholar'}
                        onChange={e => handleHostelChange(s.id, e.target.value)}
                        style={{ display: 'block', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', marginTop: 4, width: '100%' }}
                      >
                        <option>Day Scholar</option>
                        <option>Hostel</option>
                        <option>Day Boarder</option>
                      </select>
                    </td>

                    {/* Fees — live from adm_fee_collections */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={feeStatusStyle(feeSummary.status)}>{feeSummary.status}</span>
                      {feeSummary.hasFees && (
                        <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px', fontWeight: 700 }}>₹{fmt(feeSummary.total)}</div>
                      )}
                      {!admApp && (
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 2 }}>no adm record</div>
                      )}
                    </td>

                    {/* Session */}
                    <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px' }}>{s.session || '--'}</td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setViewStudent(s)}
                            style={{ backgroundColor: 'white', color: '#1e3a5f', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap' }}>
                            👁 View
                          </button>
                          <button onClick={() => { setEditStudent({ ...s }); setShowForm(false) }}
                            style={{ backgroundColor: 'white', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => handleDelete(s.id)}
                            style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>
                            🗑
                          </button>
                        </div>
                        {/* Fee Account — now wired up */}
                        <button
                          onClick={() => setFeeStudent(s)}
                          style={{
                            backgroundColor: admApp ? '#1e3a5f' : '#fef3c7',
                            color:           admApp ? 'white'   : '#d97706',
                            border: 'none', borderRadius: '6px', padding: '6px 10px',
                            fontSize: '12px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap'
                          }}
                          title={admApp ? `Fee Account · ${admApp.admNo}` : 'No admission record linked'}
                        >
                          {admApp ? '💰 Fee Account' : '⚠ Fee Account'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No students found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}