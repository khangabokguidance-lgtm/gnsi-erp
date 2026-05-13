import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const tabs = ['Campaigns', 'Leads', 'Posts']

const campaignDefault = {
  campaign_name: '',
  platform: 'Facebook',
  budget: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  status: 'Active',
  remarks: '',
}

const leadDefault = {
  student_name: '',
  parent_name: '',
  phone: '',
  class_interest: '',
  source: 'Facebook',
  follow_up_date: '',
  status: 'New',
  remarks: '',
}

const postDefault = {
  title: '',
  platform: 'Facebook',
  content_type: 'Admission',
  post_date: new Date().toISOString().split('T')[0],
  status: 'Planned',
  remarks: '',
}

function Social() {
  const [activeTab, setActiveTab] = useState('Campaigns')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const [campaigns, setCampaigns] = useState([])
  const [leads, setLeads] = useState([])
  const [posts, setPosts] = useState([])

  const [campaignForm, setCampaignForm] = useState(campaignDefault)
  const [leadForm, setLeadForm] = useState(leadDefault)
  const [postForm, setPostForm] = useState(postDefault)

  const fetchAllData = async () => {
    setLoading(true)

    const [campaignRes, leadRes, postRes] = await Promise.all([
      supabase.from('social_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('social_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('social_posts').select('*').order('created_at', { ascending: false }),
    ])

    if (!campaignRes.error) setCampaigns(campaignRes.data || [])
    if (!leadRes.error) setLeads(leadRes.data || [])
    if (!postRes.error) setPosts(postRes.data || [])

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
    campaigns: campaigns.length,
    leads: leads.length,
    posts: posts.length,
    converted: leads.filter(item => item.status === 'Converted').length,
  }

  const currentRows = useMemo(() => {
    const q = search.toLowerCase()

    if (activeTab === 'Campaigns') {
      return campaigns.filter(item =>
        (item.campaign_name || '').toLowerCase().includes(q) ||
        (item.platform || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q) ||
        (item.remarks || '').toLowerCase().includes(q)
      )
    }

    if (activeTab === 'Leads') {
      return leads.filter(item =>
        (item.student_name || '').toLowerCase().includes(q) ||
        (item.parent_name || '').toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q) ||
        (item.class_interest || '').toLowerCase().includes(q) ||
        (item.source || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q)
      )
    }

    return posts.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.platform || '').toLowerCase().includes(q) ||
      (item.content_type || '').toLowerCase().includes(q) ||
      (item.status || '').toLowerCase().includes(q)
    )
  }, [activeTab, campaigns, leads, posts, search])

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
        <h1 style={{ fontSize: '28px', color: '#1e3a5f', marginBottom: '6px' }}>📣 Social Management</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Manage campaigns, admission leads, and social media post planning
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Campaigns</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.campaigns}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #0f766e' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Leads</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.leads}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Posts</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.posts}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #ca8a04' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Converted Leads</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.converted}</div>
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

      {activeTab === 'Campaigns' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Campaign</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('social_campaigns', campaignForm, () =>
                setCampaignForm({
                  ...campaignDefault,
                  start_date: new Date().toISOString().split('T')[0],
                })
              )
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Campaign Name</label>
                <input style={inputStyle} required value={campaignForm.campaign_name} onChange={(e) => setCampaignForm({ ...campaignForm, campaign_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Platform</label>
                <select style={inputStyle} value={campaignForm.platform} onChange={(e) => setCampaignForm({ ...campaignForm, platform: e.target.value })}>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Google">Google</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Budget</label>
                <input style={inputStyle} value={campaignForm.budget} onChange={(e) => setCampaignForm({ ...campaignForm, budget: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={campaignForm.status} onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" style={inputStyle} value={campaignForm.start_date} onChange={(e) => setCampaignForm({ ...campaignForm, start_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input type="date" style={inputStyle} value={campaignForm.end_date} onChange={(e) => setCampaignForm({ ...campaignForm, end_date: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={campaignForm.remarks} onChange={(e) => setCampaignForm({ ...campaignForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>
              {saving ? 'Saving...' : 'Save Campaign'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'Leads' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Lead</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('social_leads', leadForm, () => setLeadForm(leadDefault))
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Student Name</label>
                <input style={inputStyle} required value={leadForm.student_name} onChange={(e) => setLeadForm({ ...leadForm, student_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Parent Name</label>
                <input style={inputStyle} value={leadForm.parent_name} onChange={(e) => setLeadForm({ ...leadForm, parent_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Class Interest</label>
                <input style={inputStyle} value={leadForm.class_interest} onChange={(e) => setLeadForm({ ...leadForm, class_interest: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Source</label>
                <select style={inputStyle} value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Google">Google</option>
                  <option value="Referral">Referral</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Follow Up Date</label>
                <input type="date" style={inputStyle} value={leadForm.follow_up_date} onChange={(e) => setLeadForm({ ...leadForm, follow_up_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={leadForm.status} onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Follow Up">Follow Up</option>
                  <option value="Converted">Converted</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={leadForm.remarks} onChange={(e) => setLeadForm({ ...leadForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>
              {saving ? 'Saving...' : 'Save Lead'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'Posts' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Social Post</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('social_posts', postForm, () =>
                setPostForm({
                  ...postDefault,
                  post_date: new Date().toISOString().split('T')[0],
                })
              )
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input style={inputStyle} required value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Platform</label>
                <select style={inputStyle} value={postForm.platform} onChange={(e) => setPostForm({ ...postForm, platform: e.target.value })}>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="YouTube">YouTube</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Content Type</label>
                <select style={inputStyle} value={postForm.content_type} onChange={(e) => setPostForm({ ...postForm, content_type: e.target.value })}>
                  <option value="Admission">Admission</option>
                  <option value="Result">Result</option>
                  <option value="Event">Event</option>
                  <option value="Topper">Topper</option>
                  <option value="Announcement">Announcement</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Post Date</label>
                <input type="date" style={inputStyle} value={postForm.post_date} onChange={(e) => setPostForm({ ...postForm, post_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={postForm.status} onChange={(e) => setPostForm({ ...postForm, status: e.target.value })}>
                  <option value="Planned">Planned</option>
                  <option value="Posted">Posted</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={postForm.remarks} onChange={(e) => setPostForm({ ...postForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>
              {saving ? 'Saving...' : 'Save Post'}
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
                {activeTab === 'Campaigns' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Campaign</th>
                    <th style={thStyle}>Platform</th>
                    <th style={thStyle}>Budget</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}

                {activeTab === 'Leads' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Parent</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}

                {activeTab === 'Posts' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Platform</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}
              </thead>

              <tbody>
                {currentRows.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {activeTab === 'Campaigns' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.campaign_name}</td>
                        <td style={tdStyle}>{item.platform}</td>
                        <td style={tdStyle}>{item.budget || '-'}</td>
                        <td style={tdStyle}>{item.status}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('social_campaigns', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}

                    {activeTab === 'Leads' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.student_name}</td>
                        <td style={tdStyle}>{item.parent_name || '-'}</td>
                        <td style={tdStyle}>{item.phone || '-'}</td>
                        <td style={tdStyle}>{item.source}</td>
                        <td style={tdStyle}>{item.status}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('social_leads', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}

                    {activeTab === 'Posts' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.title}</td>
                        <td style={tdStyle}>{item.platform}</td>
                        <td style={tdStyle}>{item.content_type}</td>
                        <td style={tdStyle}>{item.post_date}</td>
                        <td style={tdStyle}>{item.status}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('social_posts', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {currentRows.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
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

export default Social