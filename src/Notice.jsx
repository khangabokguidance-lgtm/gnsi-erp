import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]

const defaultForm = {
  title: '',
  description: '',
  category: 'General',
  audience: 'All',
  class_target: '',
  publish_date: TODAY,
  expiry_date: '',
  priority: 'Normal',
  status: 'Published',
  attachment_url: '',
  created_by: '',
  pinned: false,
  template_name: '',
}

const TEMPLATES = {
  'Exam Schedule': {
    title: 'Upcoming Examination Schedule',
    description: 'This is to inform all students and parents that the examination schedule has been announced. Students are advised to prepare accordingly and report to the examination hall 30 minutes before the scheduled time.',
    category: 'Exam',
    audience: 'Students',
    priority: 'Important',
    status: 'Published',
  },
  'Holiday Notice': {
    title: 'School Holiday Announcement',
    description: 'This is to inform all students, parents, and staff that the school will remain closed on the following dates. Classes will resume as per the academic calendar.',
    category: 'Holiday',
    audience: 'All',
    priority: 'Normal',
    status: 'Published',
  },
  'Fee Reminder': {
    title: 'Fee Payment Reminder',
    description: 'This is a reminder to all parents that the last date for fee payment is approaching. Kindly ensure timely payment to avoid late fees. For any queries, contact the accounts office.',
    category: 'Fee',
    audience: 'Parents',
    priority: 'Important',
    status: 'Published',
  },
  'Event Announcement': {
    title: 'Upcoming School Event',
    description: 'We are pleased to announce an upcoming event at our institution. All students, parents, and staff are cordially invited to attend and make this event a grand success.',
    category: 'Event',
    audience: 'All',
    priority: 'Normal',
    status: 'Published',
  },
  'Urgent Circular': {
    title: 'Urgent Notice — Immediate Attention Required',
    description: 'This is an urgent notice that requires immediate attention from all concerned. Please read carefully and take necessary action at the earliest.',
    category: 'General',
    audience: 'All',
    priority: 'Urgent',
    status: 'Published',
  },
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle = {
  backgroundColor: '#fff',
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
  backgroundColor: '#fff',
  outline: 'none',
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
  whiteSpace: 'nowrap',
}

const tdStyle = {
  padding: '10px 12px',
  color: '#334155',
  verticalAlign: 'top',
}

const btnBase = {
  border: 'none',
  borderRadius: '7px',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px',
}

// ─── Badge helper ─────────────────────────────────────────────────────────────

function Badge({ value }) {
  const map = {
    Published: { bg: '#dcfce7', color: '#166534' },
    Draft:     { bg: '#e5e7eb', color: '#374151' },
    Expired:   { bg: '#fee2e2', color: '#b91c1c' },
    Normal:    { bg: '#e0f2fe', color: '#0369a1' },
    Important: { bg: '#fef3c7', color: '#b45309' },
    Urgent:    { bg: '#fee2e2', color: '#dc2626' },
    General:   { bg: '#f1f5f9', color: '#475569' },
    Exam:      { bg: '#ede9fe', color: '#6d28d9' },
    Holiday:   { bg: '#fce7f3', color: '#9d174d' },
    Fee:       { bg: '#fef3c7', color: '#92400e' },
    Event:     { bg: '#d1fae5', color: '#065f46' },
    Academic:  { bg: '#dbeafe', color: '#1e40af' },
  }
  const s = map[value] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: s.bg, color: s.color }}>
      {value}
    </span>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ notice, onClose }) {
  if (!notice) return null
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 600, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            {notice.pinned && <div style={{ fontSize: 12, color: '#d97706', fontWeight: 700, marginBottom: 4 }}>📌 PINNED</div>}
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f', marginBottom: 8 }}>{notice.title}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge value={notice.priority} />
              <Badge value={notice.status} />
              <Badge value={notice.category} />
            </div>
          </div>
          <button onClick={onClose} style={{ ...btnBase, background: '#fee2e2', color: '#dc2626', marginLeft: 12, flexShrink: 0 }}>✕ Close</button>
        </div>

        {/* Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13 }}>
          {[
            ['👥 Audience', notice.audience],
            ['🎯 Class Target', notice.class_target || '—'],
            ['📅 Publish Date', notice.publish_date || '—'],
            ['⏳ Expiry Date', notice.expiry_date || 'No expiry'],
            ['✍️ Created By', notice.created_by || '—'],
            ['🕐 Created At', notice.created_at ? new Date(notice.created_at).toLocaleString('en-IN') : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ color: '#64748b', fontSize: 12 }}>{k}</div>
              <div style={{ color: '#1e293b', fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Description</div>
          <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 8, padding: 14 }}>
            {notice.description}
          </div>
        </div>

        {/* Attachment */}
        {notice.attachment_url && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Attachment</div>
            <a
              href={notice.attachment_url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', fontSize: 14, fontWeight: 600, textDecoration: 'none', background: '#eff6ff', padding: '8px 14px', borderRadius: 8 }}
            >
              📎 Open Attachment
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Notice Form ──────────────────────────────────────────────────────────────

function NoticeForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || { ...defaultForm, publish_date: TODAY })
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const applyTemplate = (name) => {
    if (!name) return
    const t = TEMPLATES[name]
    setForm(f => ({ ...f, ...t }))
    setSelectedTemplate(name)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e3a5f' }}>{initial?.id ? '✏️ Edit Notice' : '➕ Add Notice'}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Use template:</label>
          <select
            style={{ ...inputStyle, width: 180 }}
            value={selectedTemplate}
            onChange={e => applyTemplate(e.target.value)}
          >
            <option value="">— Select template —</option>
            {Object.keys(TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Enter notice title" />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description *</label>
            <textarea rows={4} style={inputStyle} required value={form.description} onChange={e => set('description', e.target.value)} placeholder="Write notice details..." />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              {['General','Exam','Holiday','Fee','Event','Academic'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Audience</label>
            <select style={inputStyle} value={form.audience} onChange={e => set('audience', e.target.value)}>
              {['All','Students','Parents','Staff','Teachers','Class Specific'].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Class Target</label>
            <input style={inputStyle} value={form.class_target} onChange={e => set('class_target', e.target.value)} placeholder="e.g. Class 10 A" />
          </div>

          <div>
            <label style={labelStyle}>Created By</label>
            <input style={inputStyle} value={form.created_by} onChange={e => set('created_by', e.target.value)} placeholder="Admin / Office" />
          </div>

          <div>
            <label style={labelStyle}>Publish Date</label>
            <input type="date" style={inputStyle} value={form.publish_date} onChange={e => set('publish_date', e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Expiry Date</label>
            <input type="date" style={inputStyle} value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Priority</label>
            <select style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
              {['Normal','Important','Urgent'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              {['Published','Draft','Expired'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Attachment URL</label>
            <input style={inputStyle} value={form.attachment_url} onChange={e => set('attachment_url', e.target.value)} placeholder="Paste file/PDF URL (optional)" />
          </div>

          {/* Pin toggle */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="pinned-check"
              checked={!!form.pinned}
              onChange={e => set('pinned', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="pinned-check" style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
              📌 Pin this notice (appears at the top for all users)
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" disabled={saving} style={{ ...btnBase, background: saving ? '#94a3b8' : '#1e3a5f', color: '#fff', padding: '10px 20px', fontSize: 14 }}>
            {saving ? 'Saving…' : initial?.id ? 'Update Notice' : 'Save Notice'}
          </button>
          <button type="button" onClick={onCancel} style={{ ...btnBase, background: '#f1f5f9', color: '#475569', padding: '10px 16px', fontSize: 14 }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Notice() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [audienceFilter, setAudienceFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [showForm, setShowForm] = useState(false)
  const [editNotice, setEditNotice] = useState(null)
  const [previewNotice, setPreviewNotice] = useState(null)
  const [viewMode, setViewMode] = useState('table') // 'table' | 'cards'

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotices = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error) setNotices(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotices() }, [fetchNotices])

  // ── Auto-expire notices whose expiry_date has passed ──────────────────────

  useEffect(() => {
    const expiredIds = notices
      .filter(n => n.expiry_date && n.expiry_date < TODAY && n.status === 'Published')
      .map(n => n.id)

    if (expiredIds.length === 0) return

    const autoExpire = async () => {
      await supabase.from('notices').update({ status: 'Expired' }).in('id', expiredIds)
      fetchNotices()
    }
    autoExpire()
  }, [notices, fetchNotices])

  // ── Save (insert or update) ───────────────────────────────────────────────

  const handleSave = async (form) => {
    setSaving(true)
    let error
    if (form.id) {
      // update
      const { id, created_at, ...payload } = form
      ;({ error } = await supabase.from('notices').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('notices').insert([form]))
    }
    if (error) alert('Error: ' + error.message)
    else {
      setShowForm(false)
      setEditNotice(null)
      fetchNotices()
    }
    setSaving(false)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notice?')) return
    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchNotices()
  }

  // ── Toggle pin ────────────────────────────────────────────────────────────

  const handleTogglePin = async (notice) => {
    const { error } = await supabase.from('notices').update({ pinned: !notice.pinned }).eq('id', notice.id)
    if (!error) fetchNotices()
  }

  // ── Toggle status Published <-> Draft ─────────────────────────────────────

  const handleToggleStatus = async (notice) => {
    const newStatus = notice.status === 'Published' ? 'Draft' : 'Published'
    const { error } = await supabase.from('notices').update({ status: newStatus }).eq('id', notice.id)
    if (!error) fetchNotices()
  }

  // ── Duplicate ─────────────────────────────────────────────────────────────

  const handleDuplicate = async (notice) => {
    const { id, created_at, ...payload } = notice
    const copy = { ...payload, title: `Copy of ${notice.title}`, status: 'Draft', publish_date: TODAY, pinned: false }
    const { error } = await supabase.from('notices').insert([copy])
    if (error) alert('Error: ' + error.message)
    else fetchNotices()
  }

  // ── CSV Export ────────────────────────────────────────────────────────────

  const handleExport = () => {
    const headers = ['Title','Category','Audience','Class Target','Publish Date','Expiry Date','Priority','Status','Created By','Description']
    const rows = filteredNotices.map(n => [
      `"${(n.title || '').replace(/"/g, '""')}"`,
      n.category, n.audience, n.class_target || '',
      n.publish_date || '', n.expiry_date || '',
      n.priority, n.status, n.created_by || '',
      `"${(n.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notices_${TODAY}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filtered & sorted notices ─────────────────────────────────────────────

  const filteredNotices = useMemo(() => {
    const q = search.toLowerCase()
    let list = notices.filter(item => {
      const matchSearch =
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.audience || '').toLowerCase().includes(q) ||
        (item.class_target || '').toLowerCase().includes(q) ||
        (item.created_by || '').toLowerCase().includes(q)

      const matchAudience = audienceFilter === 'All' || item.audience === audienceFilter
      const matchStatus = statusFilter === 'All' || item.status === statusFilter
      const matchCategory = categoryFilter === 'All' || item.category === categoryFilter
      const matchPriority = priorityFilter === 'All' || item.priority === priorityFilter

      return matchSearch && matchAudience && matchStatus && matchCategory && matchPriority
    })

    // Sort
    list = [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'priority') {
        const p = { Urgent: 0, Important: 1, Normal: 2 }
        return (p[a.priority] ?? 2) - (p[b.priority] ?? 2)
      }
      if (sortBy === 'expiry') return (a.expiry_date || '9999') < (b.expiry_date || '9999') ? -1 : 1
      return 0
    })

    return list
  }, [notices, search, audienceFilter, statusFilter, categoryFilter, priorityFilter, sortBy])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: notices.length,
    published: notices.filter(n => n.status === 'Published').length,
    draft: notices.filter(n => n.status === 'Draft').length,
    urgent: notices.filter(n => n.priority === 'Urgent').length,
    expiringSoon: notices.filter(n => {
      if (!n.expiry_date || n.status !== 'Published') return false
      const days = Math.ceil((new Date(n.expiry_date) - new Date(TODAY)) / 86400000)
      return days >= 0 && days <= 3
    }).length,
    pinned: notices.filter(n => n.pinned).length,
  }), [notices])

  // ── Render ────────────────────────────────────────────────────────────────

  const expiryWarning = (dateStr) => {
    if (!dateStr) return null
    const days = Math.ceil((new Date(dateStr) - new Date(TODAY)) / 86400000)
    if (days < 0) return { label: 'Expired', color: '#dc2626', bg: '#fee2e2' }
    if (days === 0) return { label: 'Expires today', color: '#d97706', bg: '#fef3c7' }
    if (days <= 3) return { label: `Expires in ${days}d`, color: '#d97706', bg: '#fef3c7' }
    return null
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1e3a5f' }}>📢 Notice Management</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            Publish notices, circulars, and announcements for students, parents, and staff
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleExport}
            style={{ ...btnBase, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '9px 16px', fontSize: 13 }}
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={() => { setEditNotice(null); setShowForm(v => !v) }}
            style={{ ...btnBase, background: '#1e3a5f', color: '#fff', padding: '9px 18px', fontSize: 14 }}
          >
            {showForm ? '✖ Cancel' : '➕ Add Notice'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total', val: stats.total, color: '#2563eb', border: '#2563eb' },
          { label: 'Published', val: stats.published, color: '#059669', border: '#059669' },
          { label: 'Draft', val: stats.draft, color: '#6b7280', border: '#6b7280' },
          { label: 'Urgent', val: stats.urgent, color: '#dc2626', border: '#dc2626' },
          { label: 'Expiring soon', val: stats.expiringSoon, color: '#d97706', border: '#d97706' },
          { label: 'Pinned', val: stats.pinned, color: '#7c3aed', border: '#7c3aed' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: '14px 16px', borderLeft: `4px solid ${s.border}` }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Expiring soon alert banner */}
      {stats.expiringSoon > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ <strong>{stats.expiringSoon} notice{stats.expiringSoon > 1 ? 's' : ''}</strong> expiring within 3 days — review and extend if needed.
        </div>
      )}

      {/* Form */}
      {(showForm || editNotice) && (
        <NoticeForm
          initial={editNotice}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditNotice(null) }}
          saving={saving}
        />
      )}

      {/* Filters */}
      <div style={{ ...cardStyle, marginBottom: 20, padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ ...labelStyle, marginBottom: 4 }}>Search</label>
            <input style={inputStyle} placeholder="Search title, description, audience…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {[
            ['Audience', audienceFilter, setAudienceFilter, ['All','Students','Parents','Staff','Teachers','Class Specific']],
            ['Status', statusFilter, setStatusFilter, ['All','Published','Draft','Expired']],
            ['Category', categoryFilter, setCategoryFilter, ['All','General','Exam','Holiday','Fee','Event','Academic']],
            ['Priority', priorityFilter, setPriorityFilter, ['All','Normal','Important','Urgent']],
            ['Sort', sortBy, setSortBy, [['newest','Newest first'],['oldest','Oldest first'],['priority','By priority'],['expiry','By expiry']]],
          ].map(([lbl, val, setter, opts]) => (
            <div key={lbl}>
              <label style={{ ...labelStyle, marginBottom: 4 }}>{lbl}</label>
              <select style={inputStyle} value={val} onChange={e => setter(e.target.value)}>
                {opts.map(o => Array.isArray(o)
                  ? <option key={o[0]} value={o[0]}>{o[1]}</option>
                  : <option key={o} value={o}>{o}</option>
                )}
              </select>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Showing {filteredNotices.length} of {notices.length} notices</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setViewMode('table')} style={{ ...btnBase, background: viewMode === 'table' ? '#1e3a5f' : '#f1f5f9', color: viewMode === 'table' ? '#fff' : '#475569', padding: '6px 12px' }}>☰ Table</button>
            <button onClick={() => setViewMode('cards')} style={{ ...btnBase, background: viewMode === 'cards' ? '#1e3a5f' : '#f1f5f9', color: viewMode === 'cards' ? '#fff' : '#475569', padding: '6px 12px' }}>⊞ Cards</button>
          </div>
        </div>
      </div>

      {/* ── Table view ── */}
      {viewMode === 'table' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>Notice Records</h2>
          {loading ? (
            <div style={{ padding: 32, color: '#64748b', textAlign: 'center' }}>Loading notices…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#','Title','Category','Audience','Date','Expiry','Priority','Status','Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredNotices.map((item, idx) => {
                    const warn = expiryWarning(item.expiry_date)
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', background: item.pinned ? '#fffbeb' : 'transparent' }}>
                        <td style={tdStyle}>{idx + 1}</td>
                        <td style={{ ...tdStyle, maxWidth: 220 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            {item.pinned && <span title="Pinned" style={{ fontSize: 14, flexShrink: 0 }}>📌</span>}
                            <div>
                              <div
                                style={{ fontWeight: 600, color: '#1e293b', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                onClick={() => setPreviewNotice(item)}
                              >
                                {item.title}
                              </div>
                              {item.class_target && (
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.class_target}</div>
                              )}
                              {item.attachment_url && (
                                <a href={item.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2563eb' }}>📎 Attachment</a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}><Badge value={item.category} /></td>
                        <td style={tdStyle}>{item.audience}</td>
                        <td style={tdStyle}>{item.publish_date || '—'}</td>
                        <td style={tdStyle}>
                          {item.expiry_date
                            ? warn
                              ? <span style={{ fontSize: 12, fontWeight: 600, color: warn.color, background: warn.bg, padding: '2px 8px', borderRadius: 999 }}>{warn.label}</span>
                              : <span style={{ fontSize: 13 }}>{item.expiry_date}</span>
                            : <span style={{ color: '#94a3b8', fontSize: 12 }}>None</span>
                          }
                        </td>
                        <td style={tdStyle}><Badge value={item.priority} /></td>
                        <td style={tdStyle}><Badge value={item.status} /></td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button onClick={() => setPreviewNotice(item)} style={{ ...btnBase, background: '#eff6ff', color: '#2563eb' }} title="Preview">👁</button>
                            <button onClick={() => { setEditNotice(item); setShowForm(false) }} style={{ ...btnBase, background: '#f0fdf4', color: '#166534' }} title="Edit">✏️</button>
                            <button onClick={() => handleTogglePin(item)} style={{ ...btnBase, background: item.pinned ? '#fef3c7' : '#f8fafc', color: item.pinned ? '#d97706' : '#64748b' }} title={item.pinned ? 'Unpin' : 'Pin'}>📌</button>
                            <button onClick={() => handleToggleStatus(item)} style={{ ...btnBase, background: '#f8fafc', color: '#475569' }} title="Toggle publish">
                              {item.status === 'Published' ? '⏸' : '▶'}
                            </button>
                            <button onClick={() => handleDuplicate(item)} style={{ ...btnBase, background: '#faf5ff', color: '#7c3aed' }} title="Duplicate">⧉</button>
                            <button onClick={() => handleDelete(item.id)} style={{ ...btnBase, background: '#fee2e2', color: '#dc2626' }} title="Delete">🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredNotices.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No notices found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Card view ── */}
      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {loading && <div style={{ color: '#64748b', padding: 24 }}>Loading…</div>}
          {filteredNotices.map(item => {
            const warn = expiryWarning(item.expiry_date)
            return (
              <div
                key={item.id}
                style={{
                  ...cardStyle,
                  borderLeft: item.priority === 'Urgent' ? '4px solid #dc2626' : item.priority === 'Important' ? '4px solid #d97706' : '4px solid #e2e8f0',
                  background: item.pinned ? '#fffbeb' : '#fff',
                  position: 'relative',
                }}
              >
                {item.pinned && (
                  <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 16 }}>📌</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  <Badge value={item.priority} />
                  <Badge value={item.status} />
                  <Badge value={item.category} />
                </div>
                <h3
                  style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                  onClick={() => setPreviewNotice(item)}
                >
                  {item.title}
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.description}
                </p>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>👥 {item.audience}</span>
                  {item.class_target && <span>🎯 {item.class_target}</span>}
                  <span>📅 {item.publish_date || '—'}</span>
                  {warn && <span style={{ color: warn.color, fontWeight: 600 }}>{warn.label}</span>}
                </div>
                {item.attachment_url && (
                  <a href={item.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', display: 'block', marginBottom: 10 }}>📎 View attachment</a>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  <button onClick={() => setPreviewNotice(item)} style={{ ...btnBase, background: '#eff6ff', color: '#2563eb', flex: 1 }}>👁 View</button>
                  <button onClick={() => { setEditNotice(item); setShowForm(false) }} style={{ ...btnBase, background: '#f0fdf4', color: '#166534', flex: 1 }}>✏️ Edit</button>
                  <button onClick={() => handleDuplicate(item)} style={{ ...btnBase, background: '#faf5ff', color: '#7c3aed' }}>⧉</button>
                  <button onClick={() => handleTogglePin(item)} style={{ ...btnBase, background: item.pinned ? '#fef3c7' : '#f8fafc', color: '#d97706' }}>📌</button>
                  <button onClick={() => handleDelete(item.id)} style={{ ...btnBase, background: '#fee2e2', color: '#dc2626' }}>🗑</button>
                </div>
              </div>
            )
          })}
          {!loading && filteredNotices.length === 0 && (
            <div style={{ color: '#94a3b8', padding: 32, gridColumn: '1/-1', textAlign: 'center' }}>No notices found</div>
          )}
        </div>
      )}

      {/* Preview modal */}
      {previewNotice && <PreviewModal notice={previewNotice} onClose={() => setPreviewNotice(null)} />}
    </div>
  )
}

export default Notice