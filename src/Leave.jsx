import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const emptyForm = {
  staff_id: '',
  leave_type: 'Casual Leave',
  from_date: '',
  to_date: '',
  reason: '',
}

function Leave() {
  const [staff, setStaff] = useState([])
  const [leaves, setLeaves] = useState([])
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

    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*, staff_profiles(name, department, designation)')
      .order('created_at', { ascending: false })

    if (staffError) console.error('Error fetching staff:', staffError)
    if (leaveError) console.error('Error fetching leave requests:', leaveError)

    setStaff(staffData || [])
    setLeaves(leaveData || [])
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
      leave_type: form.leave_type,
      from_date: form.from_date,
      to_date: form.to_date,
      reason: form.reason,
      status: 'Pending',
    }

    const { error } = await supabase.from('leave_requests').insert([payload])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setForm(emptyForm)
      setShowForm(false)
      fetchAll()
    }

    setSaving(false)
  }

  const handleStatus = async (id, status) => {
    const { error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', id)

    if (error) alert('Error: ' + error.message)
    else fetchAll()
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this leave request?')) {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', id)

      if (error) alert('Error: ' + error.message)
      else fetchAll()
    }
  }

  const filteredLeaves = useMemo(() => {
    const q = search.toLowerCase()

    return leaves.filter((item) => {
      const matchesSearch =
        (item.staff_profiles?.name || '').toLowerCase().includes(q) ||
        (item.staff_profiles?.department || '').toLowerCase().includes(q) ||
        (item.staff_profiles?.designation || '').toLowerCase().includes(q) ||
        (item.leave_type || '').toLowerCase().includes(q) ||
        (item.reason || '').toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'All' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [leaves, search, statusFilter])

  const totalLeaves = leaves.length
  const pendingLeaves = leaves.filter(l => l.status === 'Pending').length
  const approvedLeaves = leaves.filter(l => l.status === 'Approved').length
  const rejectedLeaves = leaves.filter(l => l.status === 'Rejected').length

  const statusStyle = (status) => {
    const map = {
      Pending: { bg: '#fef9c3', color: '#ca8a04' },
      Approved: { bg: '#dcfce7', color: '#16a34a' },
      Rejected: { bg: '#fee2e2', color: '#dc2626' },
    }

    const style = map[status] || { bg: '#e5e7eb', color: '#374151' }

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
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f' }}>🏖️ Leave Management</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Manage staff leave applications, approvals, and history</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        >
          {showForm ? '✖ Cancel' : '➕ Apply Leave'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Requests', value: totalLeaves, color: '#1e3a5f', bg: '#eff6ff', icon: '📋' },
          { label: 'Pending', value: pendingLeaves, color: '#ca8a04', bg: '#fef9c3', icon: '⏳' },
          { label: 'Approved', value: approvedLeaves, color: '#16a34a', bg: '#dcfce7', icon: '✅' },
          { label: 'Rejected', value: rejectedLeaves, color: '#dc2626', bg: '#fee2e2', icon: '❌' },
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
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1e3a5f', marginBottom: '16px' }}>Apply Leave</h2>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={e => setForm({ ...form, leave_type: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Earned Leave">Earned Leave</option>
                  <option value="Maternity/Paternity">Maternity/Paternity</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>From Date</label>
                <input
                  type="date"
                  value={form.from_date}
                  onChange={e => setForm({ ...form, from_date: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>To Date</label>
                <input
                  type="date"
                  value={form.to_date}
                  onChange={e => setForm({ ...form, to_date: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Reason</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  rows="4"
                  placeholder="Write reason for leave"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{ marginTop: '16px', backgroundColor: saving ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px' }}
            >
              {saving ? '⏳ Saving...' : '✅ Submit Leave'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <input
          placeholder="🔍 Search by staff, department, designation, leave type, reason..."
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
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading leave requests...</div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['#', 'Staff Name', 'Department', 'Leave Type', 'From', 'To', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '13px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{i + 1}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>
                    {item.staff_profiles?.name || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {item.staff_profiles?.department || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.leave_type}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.from_date}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.to_date}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={statusStyle(item.status)}>{item.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {item.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleStatus(item.id, 'Approved')}
                            style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                          >
                            ✅
                          </button>
                          <button
                            onClick={() => handleStatus(item.id, 'Rejected')}
                            style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                          >
                            ❌
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeaves.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    No leave requests found
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

export default Leave
