import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Mobile hook ──────────────────────────────────────────────────────────────
function useMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const h = e => setM(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

const emptyForm = { staff_id: '', leave_type: 'Casual Leave', from_date: '', to_date: '', reason: '' }

const iStyle = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }
const lStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }

const statusStyle = (status) => {
  const map = { Pending: { bg: '#fef9c3', color: '#ca8a04' }, Approved: { bg: '#dcfce7', color: '#16a34a' }, Rejected: { bg: '#fee2e2', color: '#dc2626' } }
  const s = map[status] || { bg: '#e5e7eb', color: '#374151' }
  return { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: s.bg, color: s.color, display: 'inline-block' }
}

function Leave() {
  const mobile = useMobile()
  const [staff, setStaff] = useState([])
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [form, setForm] = useState(emptyForm)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: staffData }, { data: leaveData }] = await Promise.all([
      supabase.from('staff_profiles').select('id, name, department, designation').order('name'),
      supabase.from('leave_requests').select('*, staff_profiles(name, department, designation)').order('created_at', { ascending: false }),
    ])
    setStaff(staffData || [])
    setLeaves(leaveData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('leave_requests').insert([{ staff_id: Number(form.staff_id), leave_type: form.leave_type, from_date: form.from_date, to_date: form.to_date, reason: form.reason, status: 'Pending' }])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyForm); setShowForm(false); fetchAll() }
    setSaving(false)
  }

  const handleStatus = async (id, status) => {
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchAll()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchAll()
  }

  const filteredLeaves = useMemo(() => {
    const q = search.toLowerCase()
    return leaves.filter(item => {
      const matchSearch = (item.staff_profiles?.name + item.staff_profiles?.department + item.staff_profiles?.designation + item.leave_type + item.reason).toLowerCase().includes(q)
      return matchSearch && (statusFilter === 'All' || item.status === statusFilter)
    })
  }, [leaves, search, statusFilter])

  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'Pending').length,
    approved: leaves.filter(l => l.status === 'Approved').length,
    rejected: leaves.filter(l => l.status === 'Rejected').length,
  }

  return (
    <div style={{ padding: mobile ? '14px 12px' : '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: mobile ? '20px' : '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>🏖️ Leave</h1>
          {!mobile && <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>Manage staff leave applications</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: mobile ? '9px 14px' : '10px 20px', fontWeight: '600', cursor: 'pointer', fontSize: mobile ? '13px' : '14px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {showForm ? '✖ Cancel' : '➕ Apply'}
        </button>
      </div>

      {/* Stats — 2-col on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: mobile ? '10px' : '16px', marginBottom: '20px' }}>
        {[
          { label: 'Total', value: stats.total, color: '#1e3a5f', bg: '#eff6ff', icon: '📋' },
          { label: 'Pending', value: stats.pending, color: '#ca8a04', bg: '#fef9c3', icon: '⏳' },
          { label: 'Approved', value: stats.approved, color: '#16a34a', bg: '#dcfce7', icon: '✅' },
          { label: 'Rejected', value: stats.rejected, color: '#dc2626', bg: '#fee2e2', icon: '❌' },
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: card.bg, borderRadius: '12px', padding: mobile ? '12px' : '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${card.color}` }}>
            <div style={{ fontSize: mobile ? '18px' : '22px', marginBottom: '4px' }}>{card.icon}</div>
            <p style={{ fontSize: '12px', color: card.color, fontWeight: '600', margin: 0 }}>{card.label}</p>
            <h2 style={{ fontSize: mobile ? '22px' : '28px', fontWeight: 'bold', color: card.color, margin: '2px 0 0' }}>{card.value}</h2>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: mobile ? '16px' : '24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>Apply Leave</h2>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={lStyle}>Select Staff</label>
                <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })} required style={iStyle}>
                  <option value="">Choose Staff</option>
                  {staff.map(item => <option key={item.id} value={item.id}>{item.name} - {item.designation || 'Staff'}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle}>Leave Type</label>
                <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })} required style={iStyle}>
                  {['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity/Paternity', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle}>From Date</label>
                <input type="date" value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value })} required style={iStyle} />
              </div>
              <div>
                <label style={lStyle}>To Date</label>
                <input type="date" value={form.to_date} onChange={e => setForm({ ...form, to_date: e.target.value })} required style={iStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lStyle}>Reason</label>
                <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows="3" style={{ ...iStyle, resize: 'vertical' }} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={{ marginTop: '14px', backgroundColor: saving ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 22px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
              {saving ? '⏳ Saving...' : '✅ Submit Leave'}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexDirection: mobile ? 'column' : 'row' }}>
        <input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...iStyle, flex: 1 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...iStyle, width: mobile ? '100%' : 160 }}>
          <option value="All">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* Records */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading…</div>
      ) : mobile ? (
        /* Mobile card list */
        <div>
          {filteredLeaves.map((item, i) => (
            <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '14px', marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid ' + (item.status === 'Approved' ? '#16a34a' : item.status === 'Rejected' ? '#dc2626' : '#ca8a04') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{item.staff_profiles?.name || '—'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{item.staff_profiles?.department || '—'} · {item.leave_type}</div>
                </div>
                <span style={statusStyle(item.status)}>{item.status}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 10 }}>
                📅 {item.from_date} → {item.to_date}
                {item.reason && <div style={{ marginTop: 4, color: '#475569' }}>{item.reason}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {item.status === 'Pending' && (
                  <>
                    <button onClick={() => handleStatus(item.id, 'Approved')} style={{ flex: 1, backgroundColor: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '7px', padding: '7px', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>✅ Approve</button>
                    <button onClick={() => handleStatus(item.id, 'Rejected')} style={{ flex: 1, backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '7px', padding: '7px', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>❌ Reject</button>
                  </>
                )}
                <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '7px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          ))}
          {filteredLeaves.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>No leave requests found</div>}
        </div>
      ) : (
        /* Desktop table */
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
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>{item.staff_profiles?.name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.staff_profiles?.department || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.leave_type}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.from_date}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.to_date}</td>
                  <td style={{ padding: '12px 16px' }}><span style={statusStyle(item.status)}>{item.status}</span></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {item.status === 'Pending' && (
                        <>
                          <button onClick={() => handleStatus(item.id, 'Approved')} style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>✅</button>
                          <button onClick={() => handleStatus(item.id, 'Rejected')} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>❌</button>
                        </>
                      )}
                      <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeaves.length === 0 && <tr><td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No leave requests found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Leave