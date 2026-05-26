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

const tabs = ['Daily', 'Campaigns', 'Leads', 'Posts']

const campaignDefault = {
  campaign_name: '', platform: 'Facebook', budget: '',
  start_date: new Date().toISOString().split('T')[0], end_date: '',
  status: 'Active', remarks: '',
}
const leadDefault = {
  student_name: '', parent_name: '', phone: '', class_interest: '',
  source: 'Facebook', follow_up_date: '', status: 'New', remarks: '',
}
const postDefault = {
  title: '', platform: 'Facebook', content_type: 'Admission',
  post_date: new Date().toISOString().split('T')[0], status: 'Planned', remarks: '',
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card = (extra = {}) => ({
  background: '#fff', borderRadius: '12px', padding: '16px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)', ...extra,
})
const inp = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff', fontFamily: 'inherit' }
const lbl = { display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em' }
const th = { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '2px solid #e5e7eb', fontWeight: '700', whiteSpace: 'nowrap' }
const td = { padding: '10px 12px', color: '#334155', fontSize: '13px', verticalAlign: 'top' }
const delBtn = { background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }
const saveBtn = { background: '#1e3a5f', color: '#fff', padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px', fontFamily: 'inherit' }

function badge(type) {
  const map = {
    overdue: ['#fee2e2','#dc2626'], today: ['#fef3c7','#d97706'],
    upcoming: ['#f1f5f9','#64748b'], new: ['#dbeafe','#2563eb'],
    green: ['#d1fae5','#065f46'], gray: ['#f1f5f9','#475569'],
  }
  const [bg, color] = map[type] || map.gray
  return { background: bg, color, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', display: 'inline-block' }
}

// ─── DailyDashboard ───────────────────────────────────────────────────────────
function DailyDashboard({ leads, campaigns, posts, fetchAllData }) {
  const mobile = useMobile()
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
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
  const formatDate = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const overdueLeads = useMemo(() => leads.filter(l => l.follow_up_date && l.follow_up_date < today && !['Converted','Closed'].includes(l.status)), [leads, today])
  const todayLeads   = useMemo(() => leads.filter(l => l.follow_up_date === today && !['Converted','Closed'].includes(l.status)), [leads, today])
  const upcomingLeads = useMemo(() => leads.filter(l => l.follow_up_date > today && !['Converted','Closed'].includes(l.status)).slice(0, 5), [leads, today])
  const newLeads     = useMemo(() => leads.filter(l => l.status === 'New'), [leads])
  const todayPosts   = useMemo(() => posts.filter(p => p.post_date === today), [posts, today])
  const plannedPosts = todayPosts.filter(p => p.status === 'Planned')
  const postedCount  = todayPosts.filter(p => p.status === 'Posted').length
  const soonCampaigns = useMemo(() => {
    const in3 = new Date(); in3.setDate(in3.getDate() + 3)
    const in3str = in3.toISOString().split('T')[0]
    return campaigns.filter(c => c.end_date && c.end_date <= in3str && c.end_date >= today && c.status === 'Active')
  }, [campaigns, today])

  const stats = { overdue: overdueLeads.length, today: todayLeads.length, newLeads: newLeads.length, postsToday: todayPosts.length, converted: leads.filter(l => l.status === 'Converted').length }

  const handleQuickLog = async () => {
    if (!quickLead || !quickNote.trim()) return
    setSavingNote(true)
    const lead = leads.find(l => l.id === quickLead)
    if (!lead) { setSavingNote(false); return }
    const updatedRemarks = `${lead.remarks || ''}\n[${new Date().toLocaleString('en-IN')}] ${quickNote.trim()}`
    const { error } = await supabase.from('social_leads').update({ remarks: updatedRemarks.trim(), status: quickStatus }).eq('id', quickLead)
    if (error) alert(error.message)
    else { setQuickNote(''); fetchAllData() }
    setSavingNote(false)
  }

  const handleTogglePost = async (post) => {
    setPostUpdating(post.id)
    const { error } = await supabase.from('social_posts').update({ status: post.status === 'Posted' ? 'Planned' : 'Posted' }).eq('id', post.id)
    if (error) alert(error.message)
    else fetchAllData()
    setPostUpdating(null)
  }

  const handleWalkIn = async (e) => {
    e.preventDefault()
    if (!walkInForm.student_name.trim()) return
    setSavingWalkIn(true)
    const { error } = await supabase.from('social_leads').insert([{ ...walkInForm, follow_up_date: today, status: 'New', remarks: 'Walk-in inquiry' }])
    if (error) alert(error.message)
    else { setWalkInOpen(false); setWalkInForm({ student_name: '', phone: '', class_interest: '', source: 'Walk-in' }); fetchAllData() }
    setSavingWalkIn(false)
  }

  const overdueDays = d => Math.floor((new Date(today) - new Date(d)) / 86400000)
  const initials = n => n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??'
  const avatarColor = u => u === 'overdue' ? { background: '#fee2e2', color: '#dc2626' } : u === 'today' ? { background: '#fef3c7', color: '#d97706' } : { background: '#dbeafe', color: '#2563eb' }
  const platformColor = { Facebook: '#1877F2', Instagram: '#E1306C', WhatsApp: '#25D366', YouTube: '#FF0000', Google: '#EA4335' }

  const LeadRow = ({ lead, urgency }) => (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: urgency === 'overdue' ? '3px solid #dc2626' : urgency === 'today' ? '3px solid #d97706' : '3px solid #e2e8f0' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, ...avatarColor(urgency) }}>{initials(lead.student_name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.student_name}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{lead.class_interest || '—'}</span><span>·</span><span>{lead.source}</span><span>·</span>
          {urgency === 'overdue' && <span style={badge('overdue')}>Overdue {overdueDays(lead.follow_up_date)}d</span>}
          {urgency === 'today'   && <span style={badge('today')}>Due today</span>}
          {urgency === 'upcoming'&& <span style={badge('upcoming')}>Upcoming</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {lead.phone && <a href={`tel:${lead.phone}`} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #bbf7d0', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 13 }}>📞</a>}
        {lead.phone && <a href={`https://wa.me/91${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #bfdbfe', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 13 }}>💬</a>}
      </div>
    </div>
  )

  const tabBtn = (key, label) => ({
    padding: mobile ? '7px 11px' : '6px 14px', borderRadius: '8px',
    border: dailyTab === key ? 'none' : '1px solid #e2e8f0',
    background: dailyTab === key ? '#1e3a5f' : 'transparent',
    color: dailyTab === key ? '#fff' : '#64748b',
    fontSize: mobile ? '11px' : '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  })

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: mobile ? 18 : 22, color: '#1e3a5f', fontWeight: 800 }}>{greeting()} 👋</h2>
        <p style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{formatDate()}</p>
      </div>

      {/* Stat cards — 2-col on mobile, 5-col on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Overdue', val: stats.overdue, color: '#dc2626', bg: '#fee2e2' },
          { label: 'Due today', val: stats.today, color: '#d97706', bg: '#fef3c7' },
          { label: 'New leads', val: stats.newLeads, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Posts', val: stats.postsToday, color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Converted', val: stats.converted, color: '#059669', bg: '#d1fae5' },
        ].map(s => (
          <div key={s.label} style={{ ...card(), padding: '12px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            <div style={{ fontSize: mobile ? 22 : 26, fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Campaign alerts */}
      {soonCampaigns.map(c => (
        <div key={c.id} style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          ⚠️ <span><strong>{c.campaign_name}</strong> ends {c.end_date}</span>
        </div>
      ))}

      {/* Sub-tabs — scrollable row on mobile */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {[['followups','📞 Follow-ups'],['posts','📢 Posts'],['score','📊 Score'],['alerts','🔔 Alerts']].map(([key, label]) => (
          <button key={key} style={tabBtn(key, label)} onClick={() => setDailyTab(key)}>{label}</button>
        ))}
      </div>

      {/* Follow-ups */}
      {dailyTab === 'followups' && (
        <div>
          {overdueLeads.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>🔴 Overdue ({overdueLeads.length})</div>
              <div style={{ ...card(), padding: 0, overflow: 'hidden' }}>{overdueLeads.map(l => <LeadRow key={l.id} lead={l} urgency="overdue" />)}</div>
            </div>
          )}
          {todayLeads.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 6 }}>🟡 Due today ({todayLeads.length})</div>
              <div style={{ ...card(), padding: 0, overflow: 'hidden' }}>{todayLeads.map(l => <LeadRow key={l.id} lead={l} urgency="today" />)}</div>
            </div>
          )}
          {upcomingLeads.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginBottom: 6 }}>🔵 Upcoming ({upcomingLeads.length})</div>
              <div style={{ ...card(), padding: 0, overflow: 'hidden' }}>{upcomingLeads.map(l => <LeadRow key={l.id} lead={l} urgency="upcoming" />)}</div>
            </div>
          )}
          {overdueLeads.length === 0 && todayLeads.length === 0 && upcomingLeads.length === 0 && (
            <div style={{ ...card(), textAlign: 'center', color: '#94a3b8', padding: 28, fontSize: 13 }}>✅ All caught up!</div>
          )}
          <button onClick={() => setWalkInOpen(v => !v)} style={{ width: '100%', marginTop: 4, padding: '14px', borderRadius: '10px', border: '2px dashed #cbd5e1', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
            👤 {walkInOpen ? 'Close walk-in form' : 'Log a walk-in'}
          </button>
          {walkInOpen && (
            <div style={{ ...card(), marginTop: 12 }}>
              <h3 style={{ marginBottom: 12, color: '#1e3a5f', fontSize: 14, fontWeight: 700 }}>Quick Walk-in</h3>
              <form onSubmit={handleWalkIn}>
                <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Student Name *</label><input style={inp} required value={walkInForm.student_name} onChange={e => setWalkInForm({ ...walkInForm, student_name: e.target.value })} /></div>
                  <div><label style={lbl}>Phone</label><input style={inp} value={walkInForm.phone} onChange={e => setWalkInForm({ ...walkInForm, phone: e.target.value })} /></div>
                  <div><label style={lbl}>Class interest</label><input style={inp} value={walkInForm.class_interest} onChange={e => setWalkInForm({ ...walkInForm, class_interest: e.target.value })} /></div>
                  <div><label style={lbl}>Source</label><select style={inp} value={walkInForm.source} onChange={e => setWalkInForm({ ...walkInForm, source: e.target.value })}><option>Walk-in</option><option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>Google</option><option>Referral</option></select></div>
                </div>
                <button type="submit" disabled={savingWalkIn} style={{ ...saveBtn, marginTop: 12 }}>{savingWalkIn ? 'Saving...' : '⚡ Save walk-in'}</button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Posts checklist */}
      {dailyTab === 'posts' && (
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{postedCount} of {todayPosts.length} posted today</div>
          {todayPosts.length === 0
            ? <div style={{ ...card(), textAlign: 'center', color: '#94a3b8', padding: 28 }}>No posts today.</div>
            : <div style={{ ...card(), padding: 0, overflow: 'hidden' }}>
                {todayPosts.map(p => (
                  <div key={p.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: platformColor[p.platform] || '#888', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: p.status === 'Posted' ? 'line-through' : 'none', opacity: p.status === 'Posted' ? 0.5 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{p.platform} · {p.content_type}</div>
                    </div>
                    <button disabled={postUpdating === p.id} onClick={() => handleTogglePost(p)} style={{ width: 26, height: 26, borderRadius: '50%', border: p.status === 'Posted' ? '1px solid #bbf7d0' : '1px solid #e2e8f0', background: p.status === 'Posted' ? '#d1fae5' : 'transparent', cursor: 'pointer', fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {postUpdating === p.id ? '…' : p.status === 'Posted' ? '✓' : '○'}
                    </button>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* Scorecard */}
      {dailyTab === 'score' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Total leads', val: leads.length, color: '#2563eb' },
              { label: 'Converted', val: leads.filter(l => l.status === 'Converted').length, color: '#059669' },
              { label: 'Pending', val: overdueLeads.length + todayLeads.length, color: '#d97706' },
              { label: 'New', val: leads.filter(l => l.status === 'New').length, color: '#7c3aed' },
            ].map(s => (
              <div key={s.label} style={{ ...card(), padding: '14px' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: '#f1f5f9' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: s.color, width: `${Math.min(100, leads.length > 0 ? (s.val / leads.length) * 100 : 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div style={card()}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>Status breakdown</div>
            {['New','Contacted','Follow Up','Converted','Closed'].map(status => {
              const count = leads.filter(l => l.status === status).length
              const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0
              const colors = { New: '#2563eb', Contacted: '#7c3aed', 'Follow Up': '#d97706', Converted: '#059669', Closed: '#64748b' }
              return (
                <div key={status} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{status}</span><span style={{ color: '#64748b' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: '#f1f5f9' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: colors[status], width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      {dailyTab === 'alerts' && (
        <div style={{ ...card(), padding: 0, overflow: 'hidden' }}>
          {overdueLeads.map(l => (
            <div key={l.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>🔴</div>
              <div style={{ flex: 1, fontSize: 12, color: '#334155' }}><strong>{l.student_name}</strong> — overdue {overdueDays(l.follow_up_date)}d. Status: {l.status}</div>
            </div>
          ))}
          {soonCampaigns.map(c => (
            <div key={c.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>⚠️</div>
              <div style={{ flex: 1, fontSize: 12, color: '#334155' }}><strong>{c.campaign_name}</strong> ends {c.end_date}</div>
            </div>
          ))}
          {plannedPosts.map(p => (
            <div key={p.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>📢</div>
              <div style={{ flex: 1, fontSize: 12, color: '#334155' }}><strong>{p.title}</strong> on {p.platform} planned today</div>
            </div>
          ))}
          {newLeads.slice(0, 5).map(l => (
            <div key={l.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>🆕</div>
              <div style={{ flex: 1, fontSize: 12, color: '#334155' }}><strong>{l.student_name}</strong> via {l.source}</div>
            </div>
          ))}
          {overdueLeads.length === 0 && soonCampaigns.length === 0 && plannedPosts.length === 0 && newLeads.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 28, fontSize: 13 }}>✅ No alerts right now!</div>
          )}
        </div>
      )}

      {/* Quick note */}
      <div style={{ ...card(), marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>⚡ Quick note on lead</div>
        <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ ...inp, maxWidth: mobile ? '100%' : 180 }} value={quickLead} onChange={e => setQuickLead(e.target.value)}>
            <option value="">Select lead…</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.student_name}</option>)}
          </select>
          <select style={{ ...inp, maxWidth: mobile ? '100%' : 150 }} value={quickStatus} onChange={e => setQuickStatus(e.target.value)}>
            <option>New</option><option>Contacted</option><option>Follow Up</option><option>Converted</option><option>Closed</option>
          </select>
          <input style={{ ...inp, flex: 1, minWidth: mobile ? '100%' : 160 }} placeholder="Add a note…" value={quickNote} onChange={e => setQuickNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleQuickLog()} />
          <button disabled={savingNote || !quickLead || !quickNote.trim()} onClick={handleQuickLog} style={{ ...saveBtn, opacity: (!quickLead || !quickNote.trim()) ? 0.5 : 1 }}>
            {savingNote ? 'Saving…' : 'Log note'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Social ──────────────────────────────────────────────────────────────
function Social() {
  const mobile = useMobile()
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
  const [showForm, setShowForm] = useState(false)

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    const [cr, lr, pr] = await Promise.all([
      supabase.from('social_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('social_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('social_posts').select('*').order('created_at', { ascending: false }),
    ])
    if (!cr.error) setCampaigns(cr.data || [])
    if (!lr.error) setLeads(lr.data || [])
    if (!pr.error) setPosts(pr.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAllData() }, [fetchAllData])

  const handleInsert = async (table, payload, resetForm) => {
    setSaving(true)
    const { error } = await supabase.from(table).insert([payload])
    if (error) alert(error.message)
    else { resetForm(); setShowForm(false); fetchAllData() }
    setSaving(false)
  }

  const handleDelete = async (table, id) => {
    if (!window.confirm('Delete?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) alert(error.message)
    else fetchAllData()
  }

  const stats = { campaigns: campaigns.length, leads: leads.length, posts: posts.length, converted: leads.filter(l => l.status === 'Converted').length }

  const currentRows = useMemo(() => {
    const q = search.toLowerCase()
    if (activeTab === 'Campaigns') return campaigns.filter(i => (i.campaign_name+i.platform+i.status+i.remarks).toLowerCase().includes(q))
    if (activeTab === 'Leads') return leads.filter(i => (i.student_name+i.parent_name+i.phone+i.class_interest+i.source+i.status).toLowerCase().includes(q))
    return posts.filter(i => (i.title+i.platform+i.content_type+i.status).toLowerCase().includes(q))
  }, [activeTab, campaigns, leads, posts, search])

  const tabStyle = (tab) => ({
    padding: mobile ? '8px 12px' : '10px 16px', borderRadius: '8px', border: 'none',
    cursor: 'pointer', fontWeight: '700', fontSize: mobile ? '12px' : '14px',
    backgroundColor: activeTab === tab ? '#1e3a5f' : '#e2e8f0',
    color: activeTab === tab ? '#fff' : '#334155',
    position: 'relative', whiteSpace: 'nowrap', fontFamily: 'inherit',
  })

  const grid2 = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '14px' }
  const grid3 = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr 1fr', gap: '14px' }

  return (
    <div style={{ padding: mobile ? '16px 14px' : '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: mobile ? '22px' : '28px', color: '#1e3a5f', marginBottom: '4px', fontWeight: 800 }}>📣 Social</h1>
        <p style={{ color: '#64748b', fontSize: '13px' }}>Campaigns · Leads · Posts</p>
      </div>

      {/* Stats — 2-col on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Campaigns', val: stats.campaigns, color: '#2563eb' },
          { label: 'Leads', val: stats.leads, color: '#0f766e' },
          { label: 'Posts', val: stats.posts, color: '#7c3aed' },
          { label: 'Converted', val: stats.converted, color: '#ca8a04' },
        ].map(s => (
          <div key={s.label} style={{ ...card(), borderLeft: `4px solid ${s.color}`, padding: '12px 14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{s.label}</div>
            <div style={{ fontSize: mobile ? '22px' : '26px', fontWeight: '800', color: '#1e3a5f' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs — horizontal scroll on mobile */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setShowForm(false) }} style={tabStyle(tab)}>
            {tab === 'Daily' && '🌅 '}{tab}
            {tab === 'Daily' && leads.filter(l => l.follow_up_date && l.follow_up_date <= new Date().toISOString().split('T')[0] && !['Converted','Closed'].includes(l.status)).length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 15, height: 15, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {leads.filter(l => l.follow_up_date && l.follow_up_date <= new Date().toISOString().split('T')[0] && !['Converted','Closed'].includes(l.status)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Daily tab */}
      {activeTab === 'Daily' && !loading && <DailyDashboard leads={leads} campaigns={campaigns} posts={posts} fetchAllData={fetchAllData} />}
      {activeTab === 'Daily' && loading && <div style={{ color: '#64748b', padding: 28, textAlign: 'center' }}>Loading…</div>}

      {/* Search + Add button for non-daily */}
      {activeTab !== 'Daily' && (
        <div style={{ ...card(), marginBottom: '16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: 1, minWidth: 120 }} placeholder={`Search ${activeTab.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={() => setShowForm(v => !v)} style={{ ...saveBtn, whiteSpace: 'nowrap' }}>{showForm ? '✕ Close' : `+ Add`}</button>
        </div>
      )}

      {/* Campaign form */}
      {activeTab === 'Campaigns' && showForm && (
        <div style={{ ...card(), marginBottom: '16px' }}>
          <h2 style={{ marginBottom: '14px', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>Add Campaign</h2>
          <form onSubmit={e => { e.preventDefault(); handleInsert('social_campaigns', campaignForm, () => setCampaignForm({ ...campaignDefault, start_date: new Date().toISOString().split('T')[0] })) }}>
            <div style={{ ...grid2, marginBottom: 12 }}>
              <div><label style={lbl}>Campaign Name</label><input style={inp} required value={campaignForm.campaign_name} onChange={e => setCampaignForm({ ...campaignForm, campaign_name: e.target.value })} /></div>
              <div><label style={lbl}>Platform</label><select style={inp} value={campaignForm.platform} onChange={e => setCampaignForm({ ...campaignForm, platform: e.target.value })}><option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>YouTube</option><option>Google</option></select></div>
              <div><label style={lbl}>Budget</label><input style={inp} value={campaignForm.budget} onChange={e => setCampaignForm({ ...campaignForm, budget: e.target.value })} /></div>
              <div><label style={lbl}>Status</label><select style={inp} value={campaignForm.status} onChange={e => setCampaignForm({ ...campaignForm, status: e.target.value })}><option>Active</option><option>Paused</option><option>Completed</option></select></div>
              <div><label style={lbl}>Start Date</label><input type="date" style={inp} value={campaignForm.start_date} onChange={e => setCampaignForm({ ...campaignForm, start_date: e.target.value })} /></div>
              <div><label style={lbl}>End Date</label><input type="date" style={inp} value={campaignForm.end_date} onChange={e => setCampaignForm({ ...campaignForm, end_date: e.target.value })} /></div>
              <div style={{ gridColumn: mobile ? '1' : '1 / -1' }}><label style={lbl}>Remarks</label><textarea rows="2" style={inp} value={campaignForm.remarks} onChange={e => setCampaignForm({ ...campaignForm, remarks: e.target.value })} /></div>
            </div>
            <button type="submit" disabled={saving} style={saveBtn}>{saving ? 'Saving…' : 'Save Campaign'}</button>
          </form>
        </div>
      )}

      {/* Lead form */}
      {activeTab === 'Leads' && showForm && (
        <div style={{ ...card(), marginBottom: '16px' }}>
          <h2 style={{ marginBottom: '14px', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>Add Lead</h2>
          <form onSubmit={e => { e.preventDefault(); handleInsert('social_leads', leadForm, () => setLeadForm(leadDefault)) }}>
            <div style={{ ...grid2, marginBottom: 12 }}>
              <div><label style={lbl}>Student Name</label><input style={inp} required value={leadForm.student_name} onChange={e => setLeadForm({ ...leadForm, student_name: e.target.value })} /></div>
              <div><label style={lbl}>Parent Name</label><input style={inp} value={leadForm.parent_name} onChange={e => setLeadForm({ ...leadForm, parent_name: e.target.value })} /></div>
              <div><label style={lbl}>Phone</label><input style={inp} value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} /></div>
              <div><label style={lbl}>Class Interest</label><input style={inp} value={leadForm.class_interest} onChange={e => setLeadForm({ ...leadForm, class_interest: e.target.value })} /></div>
              <div><label style={lbl}>Source</label><select style={inp} value={leadForm.source} onChange={e => setLeadForm({ ...leadForm, source: e.target.value })}><option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>Google</option><option>Referral</option></select></div>
              <div><label style={lbl}>Follow Up Date</label><input type="date" style={inp} value={leadForm.follow_up_date} onChange={e => setLeadForm({ ...leadForm, follow_up_date: e.target.value })} /></div>
              <div><label style={lbl}>Status</label><select style={inp} value={leadForm.status} onChange={e => setLeadForm({ ...leadForm, status: e.target.value })}><option>New</option><option>Contacted</option><option>Follow Up</option><option>Converted</option><option>Closed</option></select></div>
              <div style={{ gridColumn: mobile ? '1' : '1 / -1' }}><label style={lbl}>Remarks</label><textarea rows="2" style={inp} value={leadForm.remarks} onChange={e => setLeadForm({ ...leadForm, remarks: e.target.value })} /></div>
            </div>
            <button type="submit" disabled={saving} style={saveBtn}>{saving ? 'Saving…' : 'Save Lead'}</button>
          </form>
        </div>
      )}

      {/* Post form */}
      {activeTab === 'Posts' && showForm && (
        <div style={{ ...card(), marginBottom: '16px' }}>
          <h2 style={{ marginBottom: '14px', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>Add Post</h2>
          <form onSubmit={e => { e.preventDefault(); handleInsert('social_posts', postForm, () => setPostForm({ ...postDefault, post_date: new Date().toISOString().split('T')[0] })) }}>
            <div style={{ ...grid2, marginBottom: 12 }}>
              <div><label style={lbl}>Title</label><input style={inp} required value={postForm.title} onChange={e => setPostForm({ ...postForm, title: e.target.value })} /></div>
              <div><label style={lbl}>Platform</label><select style={inp} value={postForm.platform} onChange={e => setPostForm({ ...postForm, platform: e.target.value })}><option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>YouTube</option></select></div>
              <div><label style={lbl}>Content Type</label><select style={inp} value={postForm.content_type} onChange={e => setPostForm({ ...postForm, content_type: e.target.value })}><option>Admission</option><option>Result</option><option>Event</option><option>Topper</option><option>Announcement</option></select></div>
              <div><label style={lbl}>Post Date</label><input type="date" style={inp} value={postForm.post_date} onChange={e => setPostForm({ ...postForm, post_date: e.target.value })} /></div>
              <div><label style={lbl}>Status</label><select style={inp} value={postForm.status} onChange={e => setPostForm({ ...postForm, status: e.target.value })}><option>Planned</option><option>Posted</option><option>Cancelled</option></select></div>
              <div style={{ gridColumn: mobile ? '1' : '1 / -1' }}><label style={lbl}>Remarks</label><textarea rows="2" style={inp} value={postForm.remarks} onChange={e => setPostForm({ ...postForm, remarks: e.target.value })} /></div>
            </div>
            <button type="submit" disabled={saving} style={saveBtn}>{saving ? 'Saving…' : 'Save Post'}</button>
          </form>
        </div>
      )}

      {/* Records — card list on mobile, table on desktop */}
      {activeTab !== 'Daily' && (
        <div style={card()}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 14 }}>{activeTab} ({currentRows.length})</div>
          {loading ? <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Loading…</div> : (
            mobile ? (
              /* Mobile card list */
              <div>
                {currentRows.map((item, i) => (
                  <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                    {activeTab === 'Campaigns' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{item.campaign_name}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.platform} · {item.status} {item.budget ? `· ₹${item.budget}` : ''}</div>
                        </div>
                        <button onClick={() => handleDelete('social_campaigns', item.id)} style={delBtn}>✕</button>
                      </div>
                    )}
                    {activeTab === 'Leads' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{item.student_name}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.source} · {item.status} · {item.follow_up_date || 'No date'}</div>
                          {item.phone && <a href={`tel:${item.phone}`} style={{ fontSize: 11, color: '#2563eb' }}>{item.phone}</a>}
                        </div>
                        <button onClick={() => handleDelete('social_leads', item.id)} style={delBtn}>✕</button>
                      </div>
                    )}
                    {activeTab === 'Posts' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.platform} · {item.content_type} · {item.post_date}</div>
                          <span style={badge(item.status === 'Posted' ? 'green' : 'gray')}>{item.status}</span>
                        </div>
                        <button onClick={() => handleDelete('social_posts', item.id)} style={delBtn}>✕</button>
                      </div>
                    )}
                  </div>
                ))}
                {currentRows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No records found</div>}
              </div>
            ) : (
              /* Desktop table */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    {activeTab === 'Campaigns' && <tr style={{ background: '#f8fafc' }}><th style={th}>#</th><th style={th}>Campaign</th><th style={th}>Platform</th><th style={th}>Budget</th><th style={th}>Status</th><th style={th}>Action</th></tr>}
                    {activeTab === 'Leads' && <tr style={{ background: '#f8fafc' }}><th style={th}>#</th><th style={th}>Student</th><th style={th}>Parent</th><th style={th}>Phone</th><th style={th}>Source</th><th style={th}>Follow Up</th><th style={th}>Status</th><th style={th}>Action</th></tr>}
                    {activeTab === 'Posts' && <tr style={{ background: '#f8fafc' }}><th style={th}>#</th><th style={th}>Title</th><th style={th}>Platform</th><th style={th}>Type</th><th style={th}>Date</th><th style={th}>Status</th><th style={th}>Action</th></tr>}
                  </thead>
                  <tbody>
                    {currentRows.map((item, index) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        {activeTab === 'Campaigns' && (<><td style={td}>{index+1}</td><td style={td}>{item.campaign_name}</td><td style={td}>{item.platform}</td><td style={td}>{item.budget||'—'}</td><td style={td}>{item.status}</td><td style={td}><button onClick={() => handleDelete('social_campaigns', item.id)} style={delBtn}>Delete</button></td></>)}
                        {activeTab === 'Leads' && (<><td style={td}>{index+1}</td><td style={td}>{item.student_name}</td><td style={td}>{item.parent_name||'—'}</td><td style={td}>{item.phone||'—'}</td><td style={td}>{item.source}</td><td style={td}>{item.follow_up_date||'—'}</td><td style={td}>{item.status}</td><td style={td}><button onClick={() => handleDelete('social_leads', item.id)} style={delBtn}>Delete</button></td></>)}
                        {activeTab === 'Posts' && (<><td style={td}>{index+1}</td><td style={td}>{item.title}</td><td style={td}>{item.platform}</td><td style={td}>{item.content_type}</td><td style={td}>{item.post_date}</td><td style={td}>{item.status}</td><td style={td}><button onClick={() => handleDelete('social_posts', item.id)} style={delBtn}>Delete</button></td></>)}
                      </tr>
                    ))}
                    {currentRows.length === 0 && <tr><td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No records found</td></tr>}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default Social