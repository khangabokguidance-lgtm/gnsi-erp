import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

const tabs = ['Daily', 'Campaigns', 'Leads', 'Posts']

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

// ─── Styles ──────────────────────────────────────────────────────────────────

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

// ─── Daily Dashboard Sub-component ───────────────────────────────────────────

function DailyDashboard({ leads, campaigns, posts, fetchAllData }) {
  const [dailyTab, setDailyTab] = useState('followups')
  const [quickLead, setQuickLead] = useState('')
  const [quickNote, setQuickNote] = useState('')
  const [quickStatus, setQuickStatus] = useState('Contacted')
  const [savingNote, setSavingNote] = useState(false)
  const [postUpdating, setPostUpdating] = useState(null)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [walkInForm, setWalkInForm] = useState({ student_name: '', phone: '', class_interest: '', source: 'Walk-in' })
  const [savingWalkIn, setSavingWalkIn] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const formatDate = () => {
    const now = new Date()
    return now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Categorise leads by follow_up_date
  const overdueLeads = useMemo(() =>
    leads.filter(l => l.follow_up_date && l.follow_up_date < today && !['Converted', 'Closed'].includes(l.status)),
    [leads, today])

  const todayLeads = useMemo(() =>
    leads.filter(l => l.follow_up_date === today && !['Converted', 'Closed'].includes(l.status)),
    [leads, today])

  const upcomingLeads = useMemo(() =>
    leads.filter(l => l.follow_up_date > today && !['Converted', 'Closed'].includes(l.status)).slice(0, 5),
    [leads, today])

  const newLeads = useMemo(() =>
    leads.filter(l => l.status === 'New'), [leads])

  // Posts for today
  const todayPosts = useMemo(() =>
    posts.filter(p => p.post_date === today), [posts, today])

  const plannedPosts = todayPosts.filter(p => p.status === 'Planned')
  const postedCount = todayPosts.filter(p => p.status === 'Posted').length

  // Campaigns ending soon (within 3 days)
  const soonCampaigns = useMemo(() => {
    const in3 = new Date(); in3.setDate(in3.getDate() + 3)
    const in3str = in3.toISOString().split('T')[0]
    return campaigns.filter(c => c.end_date && c.end_date <= in3str && c.end_date >= today && c.status === 'Active')
  }, [campaigns, today])

  const stats = {
    overdue: overdueLeads.length,
    today: todayLeads.length,
    newLeads: newLeads.length,
    postsToday: todayPosts.length,
    converted: leads.filter(l => l.status === 'Converted').length,
  }

  // Log a quick note + status update
  const handleQuickLog = async () => {
    if (!quickLead || !quickNote.trim()) return
    setSavingNote(true)
    const lead = leads.find(l => l.id === quickLead)
    if (!lead) { setSavingNote(false); return }
    const updatedRemarks = `${lead.remarks || ''}\n[${new Date().toLocaleString('en-IN')}] ${quickNote.trim()}`
    const { error } = await supabase
      .from('social_leads')
      .update({ remarks: updatedRemarks.trim(), status: quickStatus })
      .eq('id', quickLead)
    if (error) alert(error.message)
    else { setQuickNote(''); fetchAllData() }
    setSavingNote(false)
  }

  // Toggle post status between Planned <-> Posted
  const handleTogglePost = async (post) => {
    setPostUpdating(post.id)
    const newStatus = post.status === 'Posted' ? 'Planned' : 'Posted'
    const { error } = await supabase
      .from('social_posts')
      .update({ status: newStatus })
      .eq('id', post.id)
    if (error) alert(error.message)
    else fetchAllData()
    setPostUpdating(null)
  }

  // Walk-in quick capture
  const handleWalkIn = async (e) => {
    e.preventDefault()
    if (!walkInForm.student_name.trim()) return
    setSavingWalkIn(true)
    const payload = {
      ...walkInForm,
      follow_up_date: today,
      status: 'New',
      remarks: 'Walk-in inquiry',
    }
    const { error } = await supabase.from('social_leads').insert([payload])
    if (error) alert(error.message)
    else { setWalkInOpen(false); setWalkInForm({ student_name: '', phone: '', class_interest: '', source: 'Walk-in' }); fetchAllData() }
    setSavingWalkIn(false)
  }

  const overdueDays = (dateStr) => {
    const diff = Math.floor((new Date(today) - new Date(dateStr)) / 86400000)
    return diff
  }

  const platformColor = { Facebook: '#1877F2', Instagram: '#E1306C', WhatsApp: '#25D366', YouTube: '#FF0000', Google: '#EA4335' }

  const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??'

  const avatarColor = (urgency) => {
    if (urgency === 'overdue') return { background: '#fee2e2', color: '#dc2626' }
    if (urgency === 'today') return { background: '#fef3c7', color: '#d97706' }
    return { background: '#dbeafe', color: '#2563eb' }
  }

  const badgeStyle = (type) => {
    const map = {
      overdue: { background: '#fee2e2', color: '#dc2626' },
      today: { background: '#fef3c7', color: '#d97706' },
      upcoming: { background: '#f1f5f9', color: '#64748b' },
      new: { background: '#dbeafe', color: '#2563eb' },
      green: { background: '#d1fae5', color: '#065f46' },
      gray: { background: '#f1f5f9', color: '#475569' },
    }
    return { ...map[type] || map.gray, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', display: 'inline-block' }
  }

  const LeadRow = ({ lead, urgency }) => (
    <div style={{
      padding: '12px 14px',
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      borderLeft: urgency === 'overdue' ? '3px solid #dc2626' : urgency === 'today' ? '3px solid #d97706' : '3px solid #e2e8f0',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, ...avatarColor(urgency) }}>
        {initials(lead.student_name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{lead.student_name}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{lead.class_interest || '—'}</span>
          <span>·</span>
          <span>{lead.source}</span>
          <span>·</span>
          {urgency === 'overdue' && <span style={badgeStyle('overdue')}>Overdue {overdueDays(lead.follow_up_date)}d</span>}
          {urgency === 'today' && <span style={badgeStyle('today')}>Due today</span>}
          {urgency === 'upcoming' && <span style={badgeStyle('upcoming')}>Upcoming</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #bbf7d0', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 13, color: '#16a34a' }} title="Call">📞</a>
        )}
        {lead.phone && (
          <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #bfdbfe', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 13, color: '#2563eb' }} title="WhatsApp">💬</a>
        )}
      </div>
    </div>
  )

  const dailyTabBtn = (key, label) => ({
    padding: '6px 14px',
    borderRadius: '8px',
    border: dailyTab === key ? 'none' : '1px solid #e2e8f0',
    background: dailyTab === key ? '#1e3a5f' : 'transparent',
    color: dailyTab === key ? '#fff' : '#64748b',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  })

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, color: '#1e3a5f', fontWeight: 700 }}>{greeting()} 👋</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{formatDate()} — Here's your daily briefing</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Overdue', val: stats.overdue, color: '#dc2626', bg: '#fee2e2' },
          { label: 'Due today', val: stats.today, color: '#d97706', bg: '#fef3c7' },
          { label: 'New leads', val: stats.newLeads, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Posts today', val: stats.postsToday, color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Converted', val: stats.converted, color: '#059669', bg: '#d1fae5' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: '14px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Campaign ending soon alert */}
      {soonCampaigns.map(c => (
        <div key={c.id} style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚠️ <strong>{c.campaign_name}</strong> ends on {c.end_date} — review or extend this campaign.
        </div>
      ))}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['followups', '📞 Follow-ups'], ['posts', '📢 Post checklist'], ['score', '📊 My scorecard'], ['alerts', '🔔 Alerts']].map(([key, label]) => (
          <button key={key} style={dailyTabBtn(key, label)} onClick={() => setDailyTab(key)}>{label}</button>
        ))}
      </div>

      {/* ── Follow-ups tab ── */}
      {dailyTab === 'followups' && (
        <div>
          {overdueLeads.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>🔴 Overdue ({overdueLeads.length})</div>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                {overdueLeads.map(l => <LeadRow key={l.id} lead={l} urgency="overdue" />)}
              </div>
            </div>
          )}
          {todayLeads.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706', marginBottom: 8 }}>🟡 Due today ({todayLeads.length})</div>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                {todayLeads.map(l => <LeadRow key={l.id} lead={l} urgency="today" />)}
              </div>
            </div>
          )}
          {upcomingLeads.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', marginBottom: 8 }}>🔵 Upcoming ({upcomingLeads.length})</div>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                {upcomingLeads.map(l => <LeadRow key={l.id} lead={l} urgency="upcoming" />)}
              </div>
            </div>
          )}
          {overdueLeads.length === 0 && todayLeads.length === 0 && upcomingLeads.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', padding: 32 }}>✅ No follow-ups scheduled. You're all caught up!</div>
          )}

          {/* Walk-in quick capture */}
          <button
            onClick={() => setWalkInOpen(v => !v)}
            style={{ width: '100%', marginTop: 4, padding: '14px', borderRadius: '10px', border: '2px dashed #cbd5e1', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            👤 {walkInOpen ? 'Close walk-in form' : 'Log a walk-in inquiry'}
          </button>

          {walkInOpen && (
            <div style={{ ...cardStyle, marginTop: 12 }}>
              <h3 style={{ marginBottom: 14, color: '#1e3a5f', fontSize: 15 }}>Quick Walk-in Capture</h3>
              <form onSubmit={handleWalkIn}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Student Name *</label>
                    <input style={inputStyle} required value={walkInForm.student_name} onChange={e => setWalkInForm({ ...walkInForm, student_name: e.target.value })} placeholder="Full name" />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input style={inputStyle} value={walkInForm.phone} onChange={e => setWalkInForm({ ...walkInForm, phone: e.target.value })} placeholder="Mobile number" />
                  </div>
                  <div>
                    <label style={labelStyle}>Class interest</label>
                    <input style={inputStyle} value={walkInForm.class_interest} onChange={e => setWalkInForm({ ...walkInForm, class_interest: e.target.value })} placeholder="e.g. Class 10" />
                  </div>
                  <div>
                    <label style={labelStyle}>Source</label>
                    <select style={inputStyle} value={walkInForm.source} onChange={e => setWalkInForm({ ...walkInForm, source: e.target.value })}>
                      <option>Walk-in</option>
                      <option>Facebook</option>
                      <option>Instagram</option>
                      <option>WhatsApp</option>
                      <option>Google</option>
                      <option>Referral</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={savingWalkIn} style={{ ...saveBtnStyle, marginTop: 12 }}>
                  {savingWalkIn ? 'Saving...' : '⚡ Save walk-in'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Post checklist tab ── */}
      {dailyTab === 'posts' && (
        <div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            Posts for today — {postedCount} of {todayPosts.length} marked as posted
          </div>
          {todayPosts.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', padding: 32 }}>No posts scheduled for today.</div>
          ) : (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {todayPosts.map(p => (
                <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: platformColor[p.platform] || '#888', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: p.status === 'Posted' ? 'line-through' : 'none', opacity: p.status === 'Posted' ? 0.6 : 1 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.platform} · {p.content_type}</div>
                  </div>
                  <span style={{ ...badgeStyle(p.status === 'Posted' ? 'green' : 'gray'), marginRight: 8 }}>{p.status}</span>
                  <button
                    disabled={postUpdating === p.id}
                    onClick={() => handleTogglePost(p)}
                    style={{ width: 26, height: 26, borderRadius: '50%', border: p.status === 'Posted' ? '1px solid #bbf7d0' : '1px solid #e2e8f0', background: p.status === 'Posted' ? '#d1fae5' : 'transparent', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {postUpdating === p.id ? '…' : p.status === 'Posted' ? '✓' : '○'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Scorecard tab ── */}
      {dailyTab === 'score' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total leads assigned', val: leads.length, color: '#2563eb' },
              { label: 'Converted', val: leads.filter(l => l.status === 'Converted').length, color: '#059669' },
              { label: 'Pending follow-ups', val: overdueLeads.length + todayLeads.length, color: '#d97706' },
              { label: 'New (uncontacted)', val: leads.filter(l => l.status === 'New').length, color: '#7c3aed' },
            ].map(s => (
              <div key={s.label} style={{ ...cardStyle, padding: '16px' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: s.color, width: `${Math.min(100, leads.length > 0 ? (s.val / leads.length) * 100 : 0)}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>Lead status breakdown</div>
            {['New', 'Contacted', 'Follow Up', 'Converted', 'Closed'].map(status => {
              const count = leads.filter(l => l.status === status).length
              const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0
              const colors = { New: '#2563eb', Contacted: '#7c3aed', 'Follow Up': '#d97706', Converted: '#059669', Closed: '#64748b' }
              return (
                <div key={status} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>{status}</span>
                    <span style={{ color: '#64748b' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: colors[status], width: `${pct}%`, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Alerts tab ── */}
      {dailyTab === 'alerts' && (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          {overdueLeads.map(l => (
            <div key={l.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🔴</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#334155' }}><strong>{l.student_name}</strong> — follow-up overdue by {overdueDays(l.follow_up_date)} day(s). Last status: {l.status}.</div>
              </div>
            </div>
          ))}
          {soonCampaigns.map(c => (
            <div key={c.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#334155' }}><strong>Campaign ending:</strong> "{c.campaign_name}" on {c.platform} ends {c.end_date}.</div>
              </div>
            </div>
          ))}
          {plannedPosts.map(p => (
            <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>📢</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#334155' }}><strong>Post reminder:</strong> "{p.title}" on {p.platform} is planned for today. Mark it posted when done.</div>
              </div>
            </div>
          ))}
          {newLeads.slice(0, 5).map(l => (
            <div key={l.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🆕</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#334155' }}><strong>New lead:</strong> {l.student_name} via {l.source}{l.class_interest ? ` — interested in ${l.class_interest}` : ''}.</div>
              </div>
            </div>
          ))}
          {overdueLeads.length === 0 && soonCampaigns.length === 0 && plannedPosts.length === 0 && newLeads.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>✅ No alerts right now. Everything is on track!</div>
          )}
        </div>
      )}

      {/* Quick note panel */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>⚡ Quick note on lead</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            style={{ ...inputStyle, maxWidth: 180 }}
            value={quickLead}
            onChange={e => setQuickLead(e.target.value)}
          >
            <option value="">Select lead…</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.student_name}</option>)}
          </select>
          <select style={{ ...inputStyle, maxWidth: 150 }} value={quickStatus} onChange={e => setQuickStatus(e.target.value)}>
            <option>New</option>
            <option>Contacted</option>
            <option>Follow Up</option>
            <option>Converted</option>
            <option>Closed</option>
          </select>
          <input
            style={{ ...inputStyle, flex: 1, minWidth: 180 }}
            placeholder="Add a note…"
            value={quickNote}
            onChange={e => setQuickNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickLog()}
          />
          <button
            disabled={savingNote || !quickLead || !quickNote.trim()}
            onClick={handleQuickLog}
            style={{ ...saveBtnStyle, marginTop: 0, opacity: (!quickLead || !quickNote.trim()) ? 0.5 : 1 }}
          >
            {savingNote ? 'Saving…' : 'Log note'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Social Component ────────────────────────────────────────────────────

function Social() {
  const [activeTab, setActiveTab] = useState('Daily')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const [campaigns, setCampaigns] = useState([])
  const [leads, setLeads] = useState([])
  const [posts, setPosts] = useState([])

  const [campaignForm, setCampaignForm] = useState(campaignDefault)
  const [leadForm, setLeadForm] = useState(leadDefault)
  const [postForm, setPostForm] = useState(postDefault)

  const fetchAllData = useCallback(async () => {
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
  }, [])

  useEffect(() => { fetchAllData() }, [fetchAllData])

  const handleInsert = async (table, payload, resetForm) => {
    setSaving(true)
    const { error } = await supabase.from(table).insert([payload])
    if (error) alert(error.message)
    else { resetForm(); fetchAllData() }
    setSaving(false)
  }

  const handleDelete = async (table, id) => {
    if (!window.confirm('Delete this record?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) alert(error.message)
    else fetchAllData()
  }

  const stats = {
    campaigns: campaigns.length,
    leads: leads.length,
    posts: posts.length,
    converted: leads.filter(l => l.status === 'Converted').length,
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

  const tabButtonStyle = (tab) => ({
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    backgroundColor: activeTab === tab ? '#1e3a5f' : '#e2e8f0',
    color: activeTab === tab ? '#fff' : '#334155',
    position: 'relative',
  })

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', color: '#1e3a5f', marginBottom: '6px' }}>📣 Social Management</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Manage campaigns, admission leads, and social media post planning
        </p>
      </div>

      {/* Global stats */}
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

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabButtonStyle(tab)}>
            {tab === 'Daily' && '🌅 '}
            {tab}
            {tab === 'Daily' && leads.filter(l => l.follow_up_date && l.follow_up_date <= new Date().toISOString().split('T')[0] && !['Converted','Closed'].includes(l.status)).length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {leads.filter(l => l.follow_up_date && l.follow_up_date <= new Date().toISOString().split('T')[0] && !['Converted','Closed'].includes(l.status)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Daily tab ── */}
      {activeTab === 'Daily' && !loading && (
        <DailyDashboard leads={leads} campaigns={campaigns} posts={posts} fetchAllData={fetchAllData} />
      )}

      {loading && activeTab === 'Daily' && (
        <div style={{ color: '#64748b', padding: 32, textAlign: 'center' }}>Loading data…</div>
      )}

      {/* ── Search bar (non-daily tabs) ── */}
      {activeTab !== 'Daily' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <input
            style={inputStyle}
            placeholder={`Search ${activeTab.toLowerCase()}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* ── Campaign form ── */}
      {activeTab === 'Campaigns' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Campaign</h2>
          <form onSubmit={e => { e.preventDefault(); handleInsert('social_campaigns', campaignForm, () => setCampaignForm({ ...campaignDefault, start_date: new Date().toISOString().split('T')[0] })) }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Campaign Name</label>
                <input style={inputStyle} required value={campaignForm.campaign_name} onChange={e => setCampaignForm({ ...campaignForm, campaign_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Platform</label>
                <select style={inputStyle} value={campaignForm.platform} onChange={e => setCampaignForm({ ...campaignForm, platform: e.target.value })}>
                  <option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>YouTube</option><option>Google</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Budget</label>
                <input style={inputStyle} value={campaignForm.budget} onChange={e => setCampaignForm({ ...campaignForm, budget: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={campaignForm.status} onChange={e => setCampaignForm({ ...campaignForm, status: e.target.value })}>
                  <option>Active</option><option>Paused</option><option>Completed</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" style={inputStyle} value={campaignForm.start_date} onChange={e => setCampaignForm({ ...campaignForm, start_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input type="date" style={inputStyle} value={campaignForm.end_date} onChange={e => setCampaignForm({ ...campaignForm, end_date: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={campaignForm.remarks} onChange={e => setCampaignForm({ ...campaignForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save Campaign'}</button>
          </form>
        </div>
      )}

      {/* ── Lead form ── */}
      {activeTab === 'Leads' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Lead</h2>
          <form onSubmit={e => { e.preventDefault(); handleInsert('social_leads', leadForm, () => setLeadForm(leadDefault)) }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Student Name</label>
                <input style={inputStyle} required value={leadForm.student_name} onChange={e => setLeadForm({ ...leadForm, student_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Parent Name</label>
                <input style={inputStyle} value={leadForm.parent_name} onChange={e => setLeadForm({ ...leadForm, parent_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Class Interest</label>
                <input style={inputStyle} value={leadForm.class_interest} onChange={e => setLeadForm({ ...leadForm, class_interest: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Source</label>
                <select style={inputStyle} value={leadForm.source} onChange={e => setLeadForm({ ...leadForm, source: e.target.value })}>
                  <option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>Google</option><option>Referral</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Follow Up Date</label>
                <input type="date" style={inputStyle} value={leadForm.follow_up_date} onChange={e => setLeadForm({ ...leadForm, follow_up_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={leadForm.status} onChange={e => setLeadForm({ ...leadForm, status: e.target.value })}>
                  <option>New</option><option>Contacted</option><option>Follow Up</option><option>Converted</option><option>Closed</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={leadForm.remarks} onChange={e => setLeadForm({ ...leadForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save Lead'}</button>
          </form>
        </div>
      )}

      {/* ── Post form ── */}
      {activeTab === 'Posts' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Social Post</h2>
          <form onSubmit={e => { e.preventDefault(); handleInsert('social_posts', postForm, () => setPostForm({ ...postDefault, post_date: new Date().toISOString().split('T')[0] })) }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input style={inputStyle} required value={postForm.title} onChange={e => setPostForm({ ...postForm, title: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Platform</label>
                <select style={inputStyle} value={postForm.platform} onChange={e => setPostForm({ ...postForm, platform: e.target.value })}>
                  <option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>YouTube</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Content Type</label>
                <select style={inputStyle} value={postForm.content_type} onChange={e => setPostForm({ ...postForm, content_type: e.target.value })}>
                  <option>Admission</option><option>Result</option><option>Event</option><option>Topper</option><option>Announcement</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Post Date</label>
                <input type="date" style={inputStyle} value={postForm.post_date} onChange={e => setPostForm({ ...postForm, post_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={postForm.status} onChange={e => setPostForm({ ...postForm, status: e.target.value })}>
                  <option>Planned</option><option>Posted</option><option>Cancelled</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={postForm.remarks} onChange={e => setPostForm({ ...postForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save Post'}</button>
          </form>
        </div>
      )}

      {/* ── Records table (non-daily tabs) ── */}
      {activeTab !== 'Daily' && (
        <div style={cardStyle}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>{activeTab} Records</h2>
          {loading ? (
            <div style={{ color: '#64748b' }}>Loading…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  {activeTab === 'Campaigns' && (
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>#</th><th style={thStyle}>Campaign</th><th style={thStyle}>Platform</th><th style={thStyle}>Budget</th><th style={thStyle}>Status</th><th style={thStyle}>Action</th>
                    </tr>
                  )}
                  {activeTab === 'Leads' && (
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>#</th><th style={thStyle}>Student</th><th style={thStyle}>Parent</th><th style={thStyle}>Phone</th><th style={thStyle}>Source</th><th style={thStyle}>Follow Up</th><th style={thStyle}>Status</th><th style={thStyle}>Action</th>
                    </tr>
                  )}
                  {activeTab === 'Posts' && (
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>#</th><th style={thStyle}>Title</th><th style={thStyle}>Platform</th><th style={thStyle}>Type</th><th style={thStyle}>Date</th><th style={thStyle}>Status</th><th style={thStyle}>Action</th>
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
                          <td style={tdStyle}>{item.budget || '—'}</td>
                          <td style={tdStyle}>{item.status}</td>
                          <td style={tdStyle}><button onClick={() => handleDelete('social_campaigns', item.id)} style={deleteBtnStyle}>Delete</button></td>
                        </>
                      )}
                      {activeTab === 'Leads' && (
                        <>
                          <td style={tdStyle}>{index + 1}</td>
                          <td style={tdStyle}>{item.student_name}</td>
                          <td style={tdStyle}>{item.parent_name || '—'}</td>
                          <td style={tdStyle}>{item.phone || '—'}</td>
                          <td style={tdStyle}>{item.source}</td>
                          <td style={tdStyle}>{item.follow_up_date || '—'}</td>
                          <td style={tdStyle}>{item.status}</td>
                          <td style={tdStyle}><button onClick={() => handleDelete('social_leads', item.id)} style={deleteBtnStyle}>Delete</button></td>
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
                          <td style={tdStyle}><button onClick={() => handleDelete('social_posts', item.id)} style={deleteBtnStyle}>Delete</button></td>
                        </>
                      )}
                    </tr>
                  ))}
                  {currentRows.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No records found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Social