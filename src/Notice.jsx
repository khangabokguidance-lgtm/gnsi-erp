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

const TODAY = new Date().toISOString().split('T')[0]

const defaultForm = {
  title: '', description: '', category: 'General', audience: 'All',
  class_target: '', publish_date: TODAY, expiry_date: '', priority: 'Normal',
  status: 'Published', attachment_url: '', created_by: '', pinned: false,
  template_name: '', is_public: false,
}

const TEMPLATES = {
  'Exam Schedule': { title: 'Upcoming Examination Schedule', description: 'This is to inform all students and parents that the examination schedule has been announced. Students are advised to prepare accordingly and report to the examination hall 30 minutes before the scheduled time.', category: 'Exam', audience: 'Students', priority: 'Important', status: 'Published' },
  'Holiday Notice': { title: 'School Holiday Announcement', description: 'This is to inform all students, parents, and staff that the school will remain closed on the following dates. Classes will resume as per the academic calendar.', category: 'Holiday', audience: 'All', priority: 'Normal', status: 'Published' },
  'Fee Reminder': { title: 'Fee Payment Reminder', description: 'This is a reminder to all parents that the last date for fee payment is approaching. Kindly ensure timely payment to avoid late fees. For any queries, contact the accounts office.', category: 'Fee', audience: 'Parents', priority: 'Important', status: 'Published' },
  'Event Announcement': { title: 'Upcoming School Event', description: 'We are pleased to announce an upcoming event at our institution. All students, parents, and staff are cordially invited to attend.', category: 'Event', audience: 'All', priority: 'Normal', status: 'Published' },
  'Urgent Circular': { title: 'Urgent Notice — Immediate Attention Required', description: 'This is an urgent notice that requires immediate attention from all concerned. Please read carefully and take necessary action at the earliest.', category: 'General', audience: 'All', priority: 'Urgent', status: 'Published' },
  'Admission Open': { title: 'Admissions Open for New Batch', description: 'Applications are now open for the upcoming batch. Interested candidates may contact the admin office for registration and fee details. Limited seats available.', category: 'General', audience: 'All', priority: 'Important', status: 'Published', is_public: true },
  'Result Announced': { title: 'Entrance Exam Results Declared', description: 'We are proud to announce that our students have achieved outstanding results in the entrance examinations. Congratulations to all selected students and their parents.', category: 'Academic', audience: 'All', priority: 'Important', status: 'Published', is_public: true },
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff', outline: 'none', fontFamily: 'inherit' }
const lbl = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }
const btnBase = { border: 'none', borderRadius: '7px', fontWeight: '600', cursor: 'pointer', fontSize: '12px', padding: '6px 10px', fontFamily: 'inherit' }

function Badge({ value }) {
  const map = {
    Published: ['#dcfce7','#166534'], Draft: ['#e5e7eb','#374151'], Expired: ['#fee2e2','#b91c1c'],
    Normal: ['#e0f2fe','#0369a1'], Important: ['#fef3c7','#b45309'], Urgent: ['#fee2e2','#dc2626'],
    General: ['#f1f5f9','#475569'], Exam: ['#ede9fe','#6d28d9'], Holiday: ['#fce7f3','#9d174d'],
    Fee: ['#fef3c7','#92400e'], Event: ['#d1fae5','#065f46'], Academic: ['#dbeafe','#1e40af'],
  }
  const [bg, color] = map[value] || ['#f1f5f9','#475569']
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', backgroundColor: bg, color }}>{value}</span>
}

function PreviewModal({ notice, onClose }) {
  if (!notice) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            {notice.pinned && <div style={{ fontSize: 11, color: '#d97706', fontWeight: 700, marginBottom: 4 }}>📌 PINNED</div>}
            {notice.is_public && <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, marginBottom: 4 }}>🌐 VISIBLE ON PUBLIC WEBSITE</div>}
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', marginBottom: 8 }}>{notice.title}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge value={notice.priority} /><Badge value={notice.status} /><Badge value={notice.category} />
            </div>
          </div>
          <button onClick={onClose} style={{ ...btnBase, background: '#fee2e2', color: '#dc2626', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12 }}>
          {[['👥 Audience', notice.audience],['📅 Publish', notice.publish_date||'—'],['⏳ Expiry', notice.expiry_date||'None'],['✍️ By', notice.created_by||'—'],['🌐 Public', notice.is_public ? 'Yes — shown on website' : 'No — internal only']].map(([k,v]) => (
            <div key={k}><div style={{ color: '#64748b' }}>{k}</div><div style={{ fontWeight: 700, color: '#1e293b' }}>{v}</div></div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12 }}>{notice.description}</div>
        {notice.attachment_url && (
          <a href={notice.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', fontSize: 13, fontWeight: 700, textDecoration: 'none', background: '#eff6ff', padding: '8px 14px', borderRadius: 8 }}>📎 Open Attachment</a>
        )}
      </div>
    </div>
  )
}

function NoticeForm({ initial, onSave, onCancel, saving, mobile }) {
  const [form, setForm] = useState(initial || { ...defaultForm, publish_date: TODAY })
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const applyTemplate = name => { if (!name) return; setForm(f => ({ ...f, ...TEMPLATES[name] })); setSelectedTemplate(name) }

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: mobile ? '16px' : '20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: mobile ? 'flex-start' : 'center', gap: 10, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e3a5f' }}>{initial?.id ? '✏️ Edit Notice' : '➕ Add Notice'}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: mobile ? '100%' : 'auto' }}>
          <select style={{ ...inp, flex: 1 }} value={selectedTemplate} onChange={e => applyTemplate(e.target.value)}>
            <option value="">— Use template —</option>
            {Object.keys(TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Title *</label><input style={inp} required value={form.title} onChange={e => set('title', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Description *</label><textarea rows={4} style={inp} required value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div><label style={lbl}>Category</label><select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>{['General','Exam','Holiday','Fee','Event','Academic'].map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label style={lbl}>Audience</label><select style={inp} value={form.audience} onChange={e => set('audience', e.target.value)}>{['All','Students','Parents','Staff','Teachers','Class Specific'].map(a => <option key={a}>{a}</option>)}</select></div>
          <div><label style={lbl}>Class Target</label><input style={inp} value={form.class_target} onChange={e => set('class_target', e.target.value)} placeholder="e.g. Class 10 A" /></div>
          <div><label style={lbl}>Created By</label><input style={inp} value={form.created_by} onChange={e => set('created_by', e.target.value)} /></div>
          <div><label style={lbl}>Publish Date</label><input type="date" style={inp} value={form.publish_date} onChange={e => set('publish_date', e.target.value)} /></div>
          <div><label style={lbl}>Expiry Date</label><input type="date" style={inp} value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} /></div>
          <div><label style={lbl}>Priority</label><select style={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>{['Normal','Important','Urgent'].map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label style={lbl}>Status</label><select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>{['Published','Draft','Expired'].map(s => <option key={s}>{s}</option>)}</select></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Attachment URL</label><input style={inp} value={form.attachment_url} onChange={e => set('attachment_url', e.target.value)} placeholder="Paste URL (optional)" /></div>

          {/* Pinned toggle */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="pinned-chk" checked={!!form.pinned} onChange={e => set('pinned', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="pinned-chk" style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>📌 Pin this notice</label>
          </div>

          {/* Public toggle */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: form.is_public ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${form.is_public ? '#86efac' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 16px', transition: 'all 0.2s' }}>
              <input type="checkbox" id="public-chk" checked={!!form.is_public} onChange={e => set('is_public', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#16a34a' }} />
              <div>
                <label htmlFor="public-chk" style={{ fontSize: 13, fontWeight: 700, color: form.is_public ? '#166534' : '#374151', cursor: 'pointer', display: 'block' }}>
                  🌐 Show on public website (landing page)
                </label>
                <span style={{ fontSize: 11, color: form.is_public ? '#4ade80' : '#94a3b8' }}>
                  {form.is_public ? 'This notice will be visible to all visitors on guidancekhangabok.in' : 'Only visible to logged-in staff members'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving} style={{ ...btnBase, background: saving ? '#94a3b8' : '#1e3a5f', color: '#fff', padding: '10px 20px', fontSize: 14 }}>{saving ? 'Saving…' : initial?.id ? 'Update' : 'Save Notice'}</button>
          <button type="button" onClick={onCancel} style={{ ...btnBase, background: '#f1f5f9', color: '#475569', padding: '10px 16px', fontSize: 14 }}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Notice ──────────────────────────────────────────────────────────────
function Notice() {
  const mobile = useMobile()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [audienceFilter, setAudienceFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [publicFilter, setPublicFilter] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [showForm, setShowForm] = useState(false)
  const [editNotice, setEditNotice] = useState(null)
  const [previewNotice, setPreviewNotice] = useState(null)
  const [viewMode, setViewMode] = useState('cards')
  const [showFilters, setShowFilters] = useState(false)

  const fetchNotices = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
    if (!error) setNotices(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotices() }, [fetchNotices])

  useEffect(() => {
    const expiredIds = notices.filter(n => n.expiry_date && n.expiry_date < TODAY && n.status === 'Published').map(n => n.id)
    if (!expiredIds.length) return
    supabase.from('notices').update({ status: 'Expired' }).in('id', expiredIds).then(() => fetchNotices())
  }, [notices, fetchNotices])

  const handleSave = async (form) => {
    setSaving(true)
    let error
    if (form.id) { const { id, created_at, ...payload } = form; ;({ error } = await supabase.from('notices').update(payload).eq('id', form.id)) }
    else { ;({ error } = await supabase.from('notices').insert([form])) }
    if (error) alert('Error: ' + error.message)
    else { setShowForm(false); setEditNotice(null); fetchNotices() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notice?')) return
    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchNotices()
  }

  const handleTogglePin = async (notice) => {
    const { error } = await supabase.from('notices').update({ pinned: !notice.pinned }).eq('id', notice.id)
    if (!error) fetchNotices()
  }

  const handleTogglePublic = async (notice) => {
    const { error } = await supabase.from('notices').update({ is_public: !notice.is_public }).eq('id', notice.id)
    if (!error) fetchNotices()
  }

  const handleToggleStatus = async (notice) => {
    const { error } = await supabase.from('notices').update({ status: notice.status === 'Published' ? 'Draft' : 'Published' }).eq('id', notice.id)
    if (!error) fetchNotices()
  }

  const handleDuplicate = async (notice) => {
    const { id, created_at, ...payload } = notice
    const { error } = await supabase.from('notices').insert([{ ...payload, title: `Copy of ${notice.title}`, status: 'Draft', publish_date: TODAY, pinned: false, is_public: false }])
    if (error) alert(error.message)
    else fetchNotices()
  }

  const filteredNotices = useMemo(() => {
    const q = search.toLowerCase()
    let list = notices.filter(item => {
      const matchSearch = (item.title+item.description+item.category+item.audience+item.class_target+item.created_by).toLowerCase().includes(q)
      const matchPublic = publicFilter === 'All' || (publicFilter === 'Public' ? item.is_public : !item.is_public)
      return matchSearch &&
        (audienceFilter === 'All' || item.audience === audienceFilter) &&
        (statusFilter === 'All' || item.status === statusFilter) &&
        (categoryFilter === 'All' || item.category === categoryFilter) &&
        (priorityFilter === 'All' || item.priority === priorityFilter) &&
        matchPublic
    })
    list = [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'priority') return ({ Urgent: 0, Important: 1, Normal: 2 }[a.priority] ?? 2) - ({ Urgent: 0, Important: 1, Normal: 2 }[b.priority] ?? 2)
      return 0
    })
    return list
  }, [notices, search, audienceFilter, statusFilter, categoryFilter, priorityFilter, publicFilter, sortBy])

  const stats = useMemo(() => ({
    total: notices.length,
    published: notices.filter(n => n.status === 'Published').length,
    draft: notices.filter(n => n.status === 'Draft').length,
    urgent: notices.filter(n => n.priority === 'Urgent').length,
    expiringSoon: notices.filter(n => { if (!n.expiry_date || n.status !== 'Published') return false; const d = Math.ceil((new Date(n.expiry_date) - new Date(TODAY)) / 86400000); return d >= 0 && d <= 3 }).length,
    pinned: notices.filter(n => n.pinned).length,
    public: notices.filter(n => n.is_public && n.status === 'Published').length,
  }), [notices])

  const expiryWarning = d => {
    if (!d) return null
    const days = Math.ceil((new Date(d) - new Date(TODAY)) / 86400000)
    if (days < 0) return { label: 'Expired', color: '#dc2626', bg: '#fee2e2' }
    if (days === 0) return { label: 'Expires today', color: '#d97706', bg: '#fef3c7' }
    if (days <= 3) return { label: `Expires in ${days}d`, color: '#d97706', bg: '#fef3c7' }
    return null
  }

  return (
    <div style={{ padding: mobile ? '14px 12px' : '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: mobile ? 20 : 28, fontWeight: 800, color: '#1e3a5f' }}>📢 Notices</h1>
          {!mobile && <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Publish circulars and announcements · 🌐 Public notices appear on the website</p>}
        </div>
        <button onClick={() => { setEditNotice(null); setShowForm(v => !v) }} style={{ ...btnBase, background: '#1e3a5f', color: '#fff', padding: '9px 16px', fontSize: 13 }}>
          {showForm ? '✖ Cancel' : '➕ Add Notice'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3, 1fr)' : 'repeat(7, 1fr)', gap: mobile ? 8 : 12, marginBottom: 16 }}>
        {[
          { label: 'Total', val: stats.total, color: '#2563eb' },
          { label: 'Live', val: stats.published, color: '#059669' },
          { label: 'Draft', val: stats.draft, color: '#6b7280' },
          { label: 'Urgent', val: stats.urgent, color: '#dc2626' },
          { label: 'Expiring', val: stats.expiringSoon, color: '#d97706' },
          { label: 'Pinned', val: stats.pinned, color: '#7c3aed' },
          { label: '🌐 Public', val: stats.public, color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '10px', padding: mobile ? '10px' : '14px 16px', borderLeft: `3px solid ${s.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: mobile ? 10 : 12, color: '#64748b' }}>{s.label}</div>
            <div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Public notices info banner */}
      {stats.public > 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#166534', display: 'flex', gap: 8, alignItems: 'center' }}>
          🌐 <strong>{stats.public}</strong> notice{stats.public > 1 ? 's are' : ' is'} currently visible on <strong>guidancekhangabok.in</strong>
        </div>
      )}

      {stats.expiringSoon > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e', display: 'flex', gap: 8 }}>
          ⚠️ <strong>{stats.expiringSoon}</strong> notice{stats.expiringSoon > 1 ? 's' : ''} expiring in 3 days.
        </div>
      )}

      {(showForm || editNotice) && (
        <NoticeForm initial={editNotice} onSave={handleSave} onCancel={() => { setShowForm(false); setEditNotice(null) }} saving={saving} mobile={mobile} />
      )}

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: mobile ? '12px' : '14px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: showFilters || !mobile ? 10 : 0 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          {mobile && (
            <button onClick={() => setShowFilters(v => !v)} style={{ ...btnBase, background: showFilters ? '#1e3a5f' : '#f1f5f9', color: showFilters ? '#fff' : '#475569', padding: '10px 12px', whiteSpace: 'nowrap' }}>
              {showFilters ? '✕ Filters' : '⚙ Filters'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setViewMode('table')} style={{ ...btnBase, background: viewMode === 'table' ? '#1e3a5f' : '#f1f5f9', color: viewMode === 'table' ? '#fff' : '#475569', padding: '8px 10px' }}>☰</button>
            <button onClick={() => setViewMode('cards')} style={{ ...btnBase, background: viewMode === 'cards' ? '#1e3a5f' : '#f1f5f9', color: viewMode === 'cards' ? '#fff' : '#475569', padding: '8px 10px' }}>⊞</button>
          </div>
        </div>

        {(!mobile || showFilters) && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: 8 }}>
            <select style={{ ...inp, fontSize: 12 }} value={audienceFilter} onChange={e => setAudienceFilter(e.target.value)}><option value="All">Audience: All</option>{['Students','Parents','Staff','Teachers','Class Specific'].map(a => <option key={a}>{a}</option>)}</select>
            <select style={{ ...inp, fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="All">Status: All</option>{['Published','Draft','Expired'].map(s => <option key={s}>{s}</option>)}</select>
            <select style={{ ...inp, fontSize: 12 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="All">Category: All</option>{['General','Exam','Holiday','Fee','Event','Academic'].map(c => <option key={c}>{c}</option>)}</select>
            <select style={{ ...inp, fontSize: 12 }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="All">Priority: All</option>{['Normal','Important','Urgent'].map(p => <option key={p}>{p}</option>)}</select>
            <select style={{ ...inp, fontSize: 12 }} value={publicFilter} onChange={e => setPublicFilter(e.target.value)}>
              <option value="All">Visibility: All</option>
              <option value="Public">🌐 Public only</option>
              <option value="Internal">🔒 Internal only</option>
            </select>
            <select style={{ ...inp, fontSize: 12 }} value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">By priority</option></select>
          </div>
        )}
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{filteredNotices.length} of {notices.length} notices</div>
      </div>

      {/* Card view */}
      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {loading && <div style={{ color: '#64748b', padding: 24 }}>Loading…</div>}
          {filteredNotices.map(item => {
            const warn = expiryWarning(item.expiry_date)
            const priorityBorder = item.priority === 'Urgent' ? '#dc2626' : item.priority === 'Important' ? '#d97706' : '#e2e8f0'
            return (
              <div key={item.id} style={{ background: item.pinned ? '#fffbeb' : '#fff', borderRadius: 12, padding: 16, borderLeft: `4px solid ${priorityBorder}`, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', position: 'relative' }}>
                {/* Badges top-right */}
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
                  {item.is_public && (
                    <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>🌐</span>
                  )}
                  {item.pinned && <span style={{ fontSize: 14 }}>📌</span>}
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', paddingRight: 50 }}>
                  <Badge value={item.priority} /><Badge value={item.status} /><Badge value={item.category} />
                </div>
                <h3 onClick={() => setPreviewNotice(item)} style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{item.title}</h3>
                <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>👥 {item.audience}</span>
                  <span>📅 {item.publish_date || '—'}</span>
                  {item.is_public && <span style={{ color: '#166534', fontWeight: 700 }}>🌐 On website</span>}
                  {warn && <span style={{ color: warn.color, fontWeight: 700 }}>{warn.label}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, paddingTop: 10, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <button onClick={() => setPreviewNotice(item)} style={{ ...btnBase, background: '#eff6ff', color: '#2563eb', flex: 1 }}>👁 View</button>
                  <button onClick={() => { setEditNotice(item); setShowForm(false) }} style={{ ...btnBase, background: '#f0fdf4', color: '#166534', flex: 1 }}>✏️ Edit</button>
                  <button onClick={() => handleTogglePublic(item)} title={item.is_public ? 'Remove from website' : 'Show on website'} style={{ ...btnBase, background: item.is_public ? '#dcfce7' : '#f8fafc', color: item.is_public ? '#166534' : '#94a3b8' }}>🌐</button>
                  <button onClick={() => handleTogglePin(item)} style={{ ...btnBase, background: item.pinned ? '#fef3c7' : '#f8fafc', color: '#d97706' }}>📌</button>
                  <button onClick={() => handleDuplicate(item)} style={{ ...btnBase, background: '#faf5ff', color: '#7c3aed' }}>⧉</button>
                  <button onClick={() => handleDelete(item.id)} style={{ ...btnBase, background: '#fee2e2', color: '#dc2626' }}>🗑</button>
                </div>
              </div>
            )
          })}
          {!loading && filteredNotices.length === 0 && <div style={{ color: '#94a3b8', padding: 32, textAlign: 'center' }}>No notices found</div>}
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Loading…</div> : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 780 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#','Title','Category','Audience','Priority','Status','Public','Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '2px solid #e5e7eb', fontWeight: '700', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredNotices.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', background: item.pinned ? '#fffbeb' : 'transparent' }}>
                      <td style={{ padding: '10px 12px' }}>{idx+1}</td>
                      <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                          {item.pinned && <span style={{ fontSize: 12 }}>📌</span>}
                          <div>
                            <div onClick={() => setPreviewNotice(item)} style={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', fontSize: 13 }}>{item.title}</div>
                            {item.expiry_date && (() => { const w = expiryWarning(item.expiry_date); return w ? <span style={{ fontSize: 10, fontWeight: 700, color: w.color, background: w.bg, padding: '1px 6px', borderRadius: 99 }}>{w.label}</span> : null })()}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}><Badge value={item.category} /></td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{item.audience}</td>
                      <td style={{ padding: '10px 12px' }}><Badge value={item.priority} /></td>
                      <td style={{ padding: '10px 12px' }}><Badge value={item.status} /></td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, background: item.is_public ? '#dcfce7' : '#f1f5f9', color: item.is_public ? '#166534' : '#94a3b8', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                          {item.is_public ? '🌐 Public' : '🔒 Internal'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setPreviewNotice(item)} style={{ ...btnBase, background: '#eff6ff', color: '#2563eb' }}>👁</button>
                          <button onClick={() => { setEditNotice(item); setShowForm(false) }} style={{ ...btnBase, background: '#f0fdf4', color: '#166534' }}>✏️</button>
                          <button onClick={() => handleTogglePublic(item)} title={item.is_public ? 'Remove from website' : 'Show on website'} style={{ ...btnBase, background: item.is_public ? '#dcfce7' : '#f8fafc', color: item.is_public ? '#166534' : '#94a3b8' }}>🌐</button>
                          <button onClick={() => handleTogglePin(item)} style={{ ...btnBase, background: item.pinned ? '#fef3c7' : '#f8fafc', color: '#d97706' }}>📌</button>
                          <button onClick={() => handleToggleStatus(item)} style={{ ...btnBase, background: '#f8fafc', color: '#475569' }}>{item.status === 'Published' ? '⏸' : '▶'}</button>
                          <button onClick={() => handleDelete(item.id)} style={{ ...btnBase, background: '#fee2e2', color: '#dc2626' }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredNotices.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No notices found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {previewNotice && <PreviewModal notice={previewNotice} onClose={() => setPreviewNotice(null)} />}
    </div>
  )
}

export default Notice