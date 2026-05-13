import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const tabs = ['Messages', 'Broadcasts', 'Templates']

const messageDefault = {
  recipient_type: 'Parent',
  recipient_name: '',
  subject: '',
  message_body: '',
  channel: 'SMS',
  status: 'Sent',
  sent_date: new Date().toISOString().split('T')[0],
}

const broadcastDefault = {
  title: '',
  audience: 'All',
  channel: 'SMS',
  scheduled_date: new Date().toISOString().split('T')[0],
  status: 'Scheduled',
  remarks: '',
}

const templateDefault = {
  template_name: '',
  category: 'Fee Reminder',
  channel: 'SMS',
  template_text: '',
  status: 'Active',
}

function Connect() {
  const [activeTab, setActiveTab] = useState('Messages')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const [messages, setMessages] = useState([])
  const [broadcasts, setBroadcasts] = useState([])
  const [templates, setTemplates] = useState([])

  const [messageForm, setMessageForm] = useState(messageDefault)
  const [broadcastForm, setBroadcastForm] = useState(broadcastDefault)
  const [templateForm, setTemplateForm] = useState(templateDefault)

  const fetchAllData = async () => {
    setLoading(true)

    const [msgRes, broadRes, tempRes] = await Promise.all([
      supabase.from('connect_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('connect_broadcasts').select('*').order('created_at', { ascending: false }),
      supabase.from('connect_templates').select('*').order('created_at', { ascending: false }),
    ])

    if (!msgRes.error) setMessages(msgRes.data || [])
    if (!broadRes.error) setBroadcasts(broadRes.data || [])
    if (!tempRes.error) setTemplates(tempRes.data || [])

    setLoading(false)
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const handleInsert = async (table, payload, resetForm) => {
    setSaving(true)

    const { error } = await supabase.from(table).insert([payload])

    if (error) {
      alert(error.message)
    } else {
      resetForm()
      fetchAllData()
    }

    setSaving(false)
  }

  const handleDelete = async (table, id) => {
    const ok = window.confirm('Delete this record?')
    if (!ok) return

    const { error } = await supabase.from(table).delete().eq('id', id)

    if (error) {
      alert(error.message)
    } else {
      fetchAllData()
    }
  }

  const stats = {
    messages: messages.length,
    broadcasts: broadcasts.length,
    templates: templates.length,
    sent: messages.filter(item => item.status === 'Sent').length,
  }

  const currentRows = useMemo(() => {
    const q = search.toLowerCase()

    if (activeTab === 'Messages') {
      return messages.filter(item =>
        (item.recipient_type || '').toLowerCase().includes(q) ||
        (item.recipient_name || '').toLowerCase().includes(q) ||
        (item.subject || '').toLowerCase().includes(q) ||
        (item.channel || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q)
      )
    }

    if (activeTab === 'Broadcasts') {
      return broadcasts.filter(item =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.audience || '').toLowerCase().includes(q) ||
        (item.channel || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q)
      )
    }

    return templates.filter(item =>
      (item.template_name || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.channel || '').toLowerCase().includes(q) ||
      (item.status || '').toLowerCase().includes(q)
    )
  }, [activeTab, messages, broadcasts, templates, search])

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
  }

  const tabButtonStyle = (tab) => ({
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    backgroundColor: activeTab === tab ? '#1e3a5f' : '#e2e8f0',
    color: activeTab === tab ? '#fff' : '#334155',
  })

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', color: '#1e3a5f', marginBottom: '6px' }}>🔗 Connect Management</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Manage communication messages, broadcasts, and reusable templates
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Messages</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.messages}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #0f766e' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Broadcasts</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.broadcasts}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Templates</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.templates}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #ca8a04' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Sent Messages</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.sent}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabButtonStyle(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <input
          style={inputStyle}
          placeholder={`Search ${activeTab.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {activeTab === 'Messages' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Message</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('connect_messages', messageForm, () =>
                setMessageForm({
                  ...messageDefault,
                  sent_date: new Date().toISOString().split('T')[0],
                })
              )
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Recipient Type</label>
                <select style={inputStyle} value={messageForm.recipient_type} onChange={(e) => setMessageForm({ ...messageForm, recipient_type: e.target.value })}>
                  <option value="Parent">Parent</option>
                  <option value="Student">Student</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Recipient Name</label>
                <input style={inputStyle} required value={messageForm.recipient_name} onChange={(e) => setMessageForm({ ...messageForm, recipient_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Subject</label>
                <input style={inputStyle} required value={messageForm.subject} onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Channel</label>
                <select style={inputStyle} value={messageForm.channel} onChange={(e) => setMessageForm({ ...messageForm, channel: e.target.value })}>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Portal">Portal</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={messageForm.status} onChange={(e) => setMessageForm({ ...messageForm, status: e.target.value })}>
                  <option value="Sent">Sent</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Sent Date</label>
                <input type="date" style={inputStyle} value={messageForm.sent_date} onChange={(e) => setMessageForm({ ...messageForm, sent_date: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Message Body</label>
                <textarea rows="4" style={inputStyle} required value={messageForm.message_body} onChange={(e) => setMessageForm({ ...messageForm, message_body: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>
              {saving ? 'Saving...' : 'Save Message'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'Broadcasts' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Broadcast</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('connect_broadcasts', broadcastForm, () =>
                setBroadcastForm({
                  ...broadcastDefault,
                  scheduled_date: new Date().toISOString().split('T')[0],
                })
              )
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input style={inputStyle} required value={broadcastForm.title} onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Audience</label>
                <select style={inputStyle} value={broadcastForm.audience} onChange={(e) => setBroadcastForm({ ...broadcastForm, audience: e.target.value })}>
                  <option value="All">All</option>
                  <option value="Students">Students</option>
                  <option value="Parents">Parents</option>
                  <option value="Staff">Staff</option>
                  <option value="Teachers">Teachers</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Channel</label>
                <select style={inputStyle} value={broadcastForm.channel} onChange={(e) => setBroadcastForm({ ...broadcastForm, channel: e.target.value })}>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Portal">Portal</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Scheduled Date</label>
                <input type="date" style={inputStyle} value={broadcastForm.scheduled_date} onChange={(e) => setBroadcastForm({ ...broadcastForm, scheduled_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={broadcastForm.status} onChange={(e) => setBroadcastForm({ ...broadcastForm, status: e.target.value })}>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Sent">Sent</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={broadcastForm.remarks} onChange={(e) => setBroadcastForm({ ...broadcastForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>
              {saving ? 'Saving...' : 'Save Broadcast'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'Templates' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Template</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('connect_templates', templateForm, () => setTemplateForm(templateDefault))
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Template Name</label>
                <input style={inputStyle} required value={templateForm.template_name} onChange={(e) => setTemplateForm({ ...templateForm, template_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={templateForm.category} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}>
                  <option value="Fee Reminder">Fee Reminder</option>
                  <option value="Absence Alert">Absence Alert</option>
                  <option value="Exam Notice">Exam Notice</option>
                  <option value="Holiday Notice">Holiday Notice</option>
                  <option value="PTM Invitation">PTM Invitation</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Channel</label>
                <select style={inputStyle} value={templateForm.channel} onChange={(e) => setTemplateForm({ ...templateForm, channel: e.target.value })}>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Portal">Portal</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={templateForm.status} onChange={(e) => setTemplateForm({ ...templateForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Template Text</label>
                <textarea rows="4" style={inputStyle} required value={templateForm.template_text} onChange={(e) => setTemplateForm({ ...templateForm, template_text: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </form>
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>{activeTab} Records</h2>

        {loading ? (
          <div style={{ color: '#64748b' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                {activeTab === 'Messages' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Recipient</th>
                    <th style={thStyle}>Subject</th>
                    <th style={thStyle}>Channel</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}

                {activeTab === 'Broadcasts' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Audience</th>
                    <th style={thStyle}>Channel</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}

                {activeTab === 'Templates' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Template</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Channel</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}
              </thead>

              <tbody>
                {currentRows.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {activeTab === 'Messages' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.recipient_name} ({item.recipient_type})</td>
                        <td style={tdStyle}>{item.subject}</td>
                        <td style={tdStyle}>{item.channel}</td>
                        <td style={tdStyle}>{item.status}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('connect_messages', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}

                    {activeTab === 'Broadcasts' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.title}</td>
                        <td style={tdStyle}>{item.audience}</td>
                        <td style={tdStyle}>{item.channel}</td>
                        <td style={tdStyle}>{item.status}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('connect_broadcasts', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}

                    {activeTab === 'Templates' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.template_name}</td>
                        <td style={tdStyle}>{item.category}</td>
                        <td style={tdStyle}>{item.channel}</td>
                        <td style={tdStyle}>{item.status}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('connect_templates', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {currentRows.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      No records found
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
}

const deleteBtnStyle = {
  background: '#fee2e2',
  color: '#dc2626',
  border: 'none',
  padding: '6px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '600',
}

const saveBtnStyle = {
  marginTop: '16px',
  background: '#1e3a5f',
  color: '#fff',
  padding: '10px 18px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '600',
}

export default Connect
