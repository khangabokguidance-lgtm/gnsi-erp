import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const defaultForm = {
  title: '',
  description: '',
  category: 'General',
  audience: 'All',
  class_target: '',
  publish_date: new Date().toISOString().split('T')[0],
  expiry_date: '',
  priority: 'Normal',
  status: 'Published',
  attachment_url: '',
  created_by: '',
}

function Notice() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [audienceFilter, setAudienceFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)

  const fetchNotices = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notices:', error)
    } else {
      setNotices(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchNotices()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase.from('notices').insert([form])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setForm({
        ...defaultForm,
        publish_date: new Date().toISOString().split('T')[0],
      })
      setShowForm(false)
      fetchNotices()
    }

    setSaving(false)
  }

  const handleDelete = async (id) => {
    const ok = window.confirm('Delete this notice?')
    if (!ok) return

    const { error } = await supabase.from('notices').delete().eq('id', id)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      fetchNotices()
    }
  }

  const filteredNotices = useMemo(() => {
    const q = search.toLowerCase()

    return notices.filter((item) => {
      const matchesSearch =
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.audience || '').toLowerCase().includes(q) ||
        (item.class_target || '').toLowerCase().includes(q) ||
        (item.priority || '').toLowerCase().includes(q)

      const matchesAudience =
        audienceFilter === 'All' || item.audience === audienceFilter

      const matchesStatus =
        statusFilter === 'All' || item.status === statusFilter

      return matchesSearch && matchesAudience && matchesStatus
    })
  }, [notices, search, audienceFilter, statusFilter])

  const totalNotices = notices.length
  const publishedCount = notices.filter(n => n.status === 'Published').length
  const draftCount = notices.filter(n => n.status === 'Draft').length
  const urgentCount = notices.filter(n => n.priority === 'Urgent').length

  const badgeStyle = (value) => {
    const styles = {
      Published: { bg: '#dcfce7', color: '#166534' },
      Draft: { bg: '#e5e7eb', color: '#374151' },
      Expired: { bg: '#fee2e2', color: '#b91c1c' },
      Normal: { bg: '#e0f2fe', color: '#0369a1' },
      Important: { bg: '#fef3c7', color: '#b45309' },
      Urgent: { bg: '#fee2e2', color: '#dc2626' },
    }

    const style = styles[value] || { bg: '#f1f5f9', color: '#475569' }

    return {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: style.bg,
      color: style.color,
    }
  }

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: 'white',
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>📢 Notice Management</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Publish notices, circulars, and announcements for students, parents, and staff
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            backgroundColor: '#1e3a5f',
            color: 'white',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {showForm ? '✖ Cancel' : '➕ Add Notice'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Total Notices</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{totalNotices}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Published</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{publishedCount}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #6b7280' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Draft</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{draftCount}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Urgent</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{urgentCount}</div>
        </div>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1e3a5f' }}>Add Notice</h2>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Title</label>
                <input
                  style={inputStyle}
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Enter notice title"
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  rows="4"
                  style={inputStyle}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Write notice details"
                />
              </div>

              <div>
                <label style={labelStyle}>Category</label>
                <select
                  style={inputStyle}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="General">General</option>
                  <option value="Exam">Exam</option>
                  <option value="Holiday">Holiday</option>
                  <option value="Fee">Fee</option>
                  <option value="Event">Event</option>
                  <option value="Academic">Academic</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Audience</label>
                <select
                  style={inputStyle}
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                >
                  <option value="All">All</option>
                  <option value="Students">Students</option>
                  <option value="Parents">Parents</option>
                  <option value="Staff">Staff</option>
                  <option value="Teachers">Teachers</option>
                  <option value="Class Specific">Class Specific</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Class Target</label>
                <input
                  style={inputStyle}
                  value={form.class_target}
                  onChange={(e) => setForm({ ...form, class_target: e.target.value })}
                  placeholder="Example: Class 6 A"
                />
              </div>

              <div>
                <label style={labelStyle}>Publish Date</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.publish_date}
                  onChange={(e) => setForm({ ...form, publish_date: e.target.value })}
                />
              </div>

              <div>
                <label style={labelStyle}>Expiry Date</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                />
              </div>

              <div>
                <label style={labelStyle}>Priority</label>
                <select
                  style={inputStyle}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="Normal">Normal</option>
                  <option value="Important">Important</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select
                  style={inputStyle}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Published">Published</option>
                  <option value="Draft">Draft</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Attachment URL</label>
                <input
                  style={inputStyle}
                  value={form.attachment_url}
                  onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
                  placeholder="Paste file URL if any"
                />
              </div>

              <div>
                <label style={labelStyle}>Created By</label>
                <input
                  style={inputStyle}
                  value={form.created_by}
                  onChange={(e) => setForm({ ...form, created_by: e.target.value })}
                  placeholder="Admin / Office"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: '16px',
                backgroundColor: saving ? '#94a3b8' : '#1e3a5f',
                color: 'white',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Notice'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <input
          style={inputStyle}
          placeholder="Search title, category, audience, priority..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={inputStyle}
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value)}
        >
          <option value="All">All Audience</option>
          <option value="Students">Students</option>
          <option value="Parents">Parents</option>
          <option value="Staff">Staff</option>
          <option value="Teachers">Teachers</option>
          <option value="Class Specific">Class Specific</option>
        </select>
        <select
          style={inputStyle}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Published">Published</option>
          <option value="Draft">Draft</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1e3a5f' }}>Notice Records</h2>

        {loading ? (
          <div style={{ padding: '24px', color: '#64748b' }}>Loading notices...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Audience</th>
                  <th style={thStyle}>Publish Date</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotices.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>{index + 1}</td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        {item.class_target || (item.description ? item.description.slice(0, 60) : '')}
                      </div>
                    </td>
                    <td style={tdStyle}>{item.category || '-'}</td>
                    <td style={tdStyle}>{item.audience || '-'}</td>
                    <td style={tdStyle}>{item.publish_date || '-'}</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(item.priority)}>{item.priority}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(item.status)}>{item.status}</span>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: 'none',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredNotices.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      No notices found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '13px',
  fontWeight: '600',
  color: '#374151',
}

const thStyle = {
  textAlign: 'left',
  padding: '12px',
  fontSize: '13px',
  color: '#475569',
  borderBottom: '1px solid #e5e7eb',
}

const tdStyle = {
  padding: '12px',
  color: '#334155',
  verticalAlign: 'top',
}

export default Notice
