import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const emptyForm = {
  staff_id: '',
  employment_status: 'Probation',
  document_type: '',
  document_number: '',
  remarks: '',
}

function HR() {
  const [staff, setStaff] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [form, setForm] = useState(emptyForm)

  const fetchAll = async () => {
    setLoading(true)

    const { data: staffData, error: staffError } = await supabase
      .from('staff_profiles')
      .select('id, name, department, designation')
      .order('name')

    const { data: hrData, error: hrError } = await supabase
      .from('hr_records')
      .select('*, staff_profiles(name, department, designation)')
      .order('created_at', { ascending: false })

    if (staffError) console.error('Error fetching staff:', staffError)
    if (hrError) console.error('Error fetching HR records:', hrError)

    setStaff(staffData || [])
    setRecords(hrData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      staff_id: Number(form.staff_id),
      employment_status: form.employment_status,
      document_type: form.document_type,
      document_number: form.document_number,
      remarks: form.remarks,
    }

    const { error } = await supabase.from('hr_records').insert([payload])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setForm(emptyForm)
      setShowForm(false)
      fetchAll()
    }

    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this HR record?')) {
      const { error } = await supabase.from('hr_records').delete().eq('id', id)
      if (error) alert('Error: ' + error.message)
      else fetchAll()
    }
  }

  const filteredRecords = useMemo(() => {
    const q = search.toLowerCase()

    return records.filter((item) => {
      const matchesSearch =
        (item.staff_profiles?.name || '').toLowerCase().includes(q) ||
        (item.staff_profiles?.department || '').toLowerCase().includes(q) ||
        (item.staff_profiles?.designation || '').toLowerCase().includes(q) ||
        (item.document_type || '').toLowerCase().includes(q) ||
        (item.document_number || '').toLowerCase().includes(q) ||
        (item.remarks || '').toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'All' || item.employment_status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [records, search, statusFilter])

  const totalRecords = records.length
  const probationCount = records.filter(r => r.employment_status === 'Probation').length
  const confirmedCount = records.filter(r => r.employment_status === 'Confirmed').length
  const resignedCount = records.filter(r => r.employment_status === 'Resigned').length

  const statusStyle = (status) => {
    const map = {
      Probation: { bg: '#fef9c3', color: '#ca8a04' },
      Confirmed: { bg: '#dcfce7', color: '#16a34a' },
      Resigned: { bg: '#fee2e2', color: '#dc2626' },
      Terminated: { bg: '#e5e7eb', color: '#374151' },
    }

    const style = map[status] || { bg: '#e0f2fe', color: '#0891b2' }

    return {
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: style.bg,
      color: style.color,
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f' }}>🗂️ HR Management</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Manage employment status, staff documents, and HR remarks</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        >
          {showForm ? '✖ Cancel' : '➕ Add HR Record'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Records', value: totalRecords, color: '#1e3a5f', bg: '#eff6ff', icon: '🗂️' },
          { label: 'Probation', value: probationCount, color: '#ca8a04', bg: '#fef9c3', icon: '⏳' },
          { label: 'Confirmed', value: confirmedCount, color: '#16a34a', bg: '#dcfce7', icon: '✅' },
          { label: 'Resigned', value: resignedCount, color: '#dc2626', bg: '#fee2e2', icon: '🚪' },
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: card.bg, borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${card.color}` }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{card.icon}</div>
            <p style={{ fontSize: '13px', color: card.color, fontWeight: '600' }}>{card.label}</p>
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: card.color, marginTop: '4px' }}>{card.value}</h2>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1e3a5f', marginBottom: '16px' }}>Add HR Record</h2>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Select Staff</label>
                <select
                  value={form.staff_id}
                  onChange={e => setForm({ ...form, staff_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
                >
                  <option value="">Choose Staff</option>
                  {staff.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {item.designation || 'Staff'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Employment Status</label>
                <select
                  value={form.employment_status}
                  onChange={e => setForm({ ...form, employment_status: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
                >
                  <option value="Probation">Probation</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Resigned">Resigned</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Document Type</label>
                <select
                  value={form.document_type}
                  onChange={e => setForm({ ...form, document_type: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
                >
                  <option value="">Select Document</option>
                  <option value="Aadhaar">Aadhaar</option>
                  <option value="PAN">PAN</option>
                  <option value="Resume">Resume</option>
                  <option value="Appointment Letter">Appointment Letter</option>
                  <option value="Certificate">Certificate</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Document Number</label>
                <input
                  value={form.document_number}
                  onChange={e => setForm({ ...form, document_number: e.target.value })}
                  placeholder="Enter document number"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                  rows="4"
                  placeholder="Add HR remarks or employment notes"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{ marginTop: '16px', backgroundColor: saving ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px' }}
            >
              {saving ? '⏳ Saving...' : '✅ Save HR Record'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <input
          placeholder="🔍 Search by staff, department, designation, document, remarks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
        >
          <option value="All">All Status</option>
          <option value="Probation">Probation</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Resigned">Resigned</option>
          <option value="Terminated">Terminated</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading HR records...</div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['#', 'Staff Name', 'Department', 'Designation', 'Status', 'Document', 'Remarks', 'Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '13px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{i + 1}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>
                    {item.staff_profiles?.name || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {item.staff_profiles?.department || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {item.staff_profiles?.designation || '-'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={statusStyle(item.employment_status)}>{item.employment_status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {item.document_type ? `${item.document_type}${item.document_number ? ` - ${item.document_number}` : ''}` : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: '260px' }}>
                    {item.remarks || '-'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    No HR records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default HR
