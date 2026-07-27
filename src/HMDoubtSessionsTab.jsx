import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { HMDoubtSessionPanel } from './EnhancedLogEntry'

// ══════════════════════════════════════════════════════════════
//  HM DOUBT SESSIONS TAB
//  Replaces the previous DoubtSessionTab (ClassTimetableTab.jsx) as
//  the content of the 🙋 Doubt tab. Lists doubt_sessions assigned to
//  the logged-in housemaster (matched by hm_name, same convention used
//  throughout the app) and renders EnhancedLogEntry.jsx's own
//  HMDoubtSessionPanel for whichever session is selected — that panel
//  already contains the full detail card, communication thread, and
//  resolution controls, so this wrapper is deliberately just a list +
//  selector shell around it.
// ══════════════════════════════════════════════════════════════

const inp = {
  width: '100%', padding: '12px 14px', borderRadius: '10px',
  border: '1px solid #d1d5db', fontSize: '14px',
  boxSizing: 'border-box', backgroundColor: 'white', minHeight: '44px',
}

const STATUS_FILTERS = [
  { key: 'open', label: '⏳ Open' },
  { key: 'resolved', label: '✅ Resolved' },
  { key: 'not_conducted', label: '❌ Not Conducted' },
  { key: 'all', label: '📋 All' },
]

export default function HMDoubtSessionsTab({ currentHousemaster, currentUser }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('open')
  const [search, setSearch] = useState('')

  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'

  // Cross-app deep link support: Teaching.jsx's HM Dashboard links here as
  // /hostel?tab=doubtsession&hm=<name> so an admin clicking a specific HM's
  // card/row lands on that HM's queue instead of their own. Only admins get
  // this override — a non-admin's own name always wins, so one housemaster
  // can't view another's doubt sessions just by editing the URL.
  const hmParam = (() => {
    try { return new URLSearchParams(window.location.search).get('hm') || '' } catch { return '' }
  })()

  const ownName = (currentHousemaster?.name || '').trim()
  const hmName = (isAdmin && hmParam.trim()) ? hmParam.trim() : ownName
  const viewingOther = isAdmin && hmParam.trim() && hmParam.trim() !== ownName

  const load = async () => {
    setLoading(true)
    if (!hmName) { setSessions([]); setLoading(false); return }
    const { data, error } = await supabase.from('doubt_sessions').select('*').ilike('hm_name', hmName).order('created_at', { ascending: false })
    if (error) console.error('doubt_sessions load error:', error)
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [hmName])

  const filtered = sessions.filter(s => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    if (!matchesStatus) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [s.subject_name, s.topic, s.teacher_name, s.class_name, s.batch_name]
      .some(v => (v || '').toLowerCase().includes(q))
  })

  const selected = sessions.find(s => s.id === selectedId) || null

  const counts = {
    open: sessions.filter(s => s.status === 'open').length,
    resolved: sessions.filter(s => s.status === 'resolved').length,
    not_conducted: sessions.filter(s => s.status === 'not_conducted').length,
  }

  if (!hmName) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🙋</div>
        <div style={{ fontSize: '14px', fontWeight: '600' }}>No housemaster profile linked to this login — doubt sessions can't be matched.</div>
      </div>
    )
  }

  if (selected) {
    return (
      <div>
        {viewingOther && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', fontWeight: '700', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <span>👁️ Viewing {hmName}'s doubt sessions (admin view)</span>
            <a href="/hostel?tab=doubtsession" style={{ color: '#92400e', textDecoration: 'underline' }}>← Back to my own</a>
          </div>
        )}
        <button
          onClick={() => setSelectedId(null)}
          style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', marginBottom: '16px' }}
        >
          ← Back to all doubt sessions
        </button>
        <HMDoubtSessionPanel
          session={selected}
          currentUser={currentUser}
          onFeedback={() => { setSelectedId(null); load() }}
        />
      </div>
    )
  }

  return (
    <div>
      {viewingOther && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', fontWeight: '700', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <span>👁️ Viewing {hmName}'s doubt sessions (admin view)</span>
          <a href="/hostel?tab=doubtsession" style={{ color: '#92400e', textDecoration: 'underline' }}>← Back to my own</a>
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '8px 14px', borderRadius: '99px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
              background: statusFilter === f.key ? '#1e3a5f' : '#f1f5f9',
              color: statusFilter === f.key ? 'white' : '#64748b',
            }}
          >
            {f.label}{f.key !== 'all' && counts[f.key] != null ? ` (${counts[f.key]})` : ''}
          </button>
        ))}
      </div>

      <input
        placeholder="🔍 Search subject, topic, teacher, class..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...inp, marginBottom: '16px' }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🙋</div>
          No {statusFilter === 'all' ? '' : statusFilter.replace('_', ' ') + ' '}doubt sessions found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(s => {
            const statusColor = s.status === 'open' ? '#d97706' : s.status === 'resolved' ? '#16a34a' : '#dc2626'
            const statusBg = s.status === 'open' ? '#fffbeb' : s.status === 'resolved' ? '#f0fdf4' : '#fef2f2'
            return (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  background: statusBg, border: `1.5px solid ${statusColor}40`, borderRadius: '12px',
                  padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>
                    {s.subject_name} {s.class_name ? `· ${s.class_name}` : s.batch_name ? `· ${s.batch_name}` : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    📖 {s.topic || '—'} · Teacher: {s.teacher_name || '—'}
                  </div>
                  {(s.doubt_date || s.doubt_time_slot) && (
                    <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '4px', fontWeight: '700' }}>
                      📅 {s.doubt_date || ''} {s.doubt_time_slot ? `🕐 ${s.doubt_time_slot}` : ''}
                    </div>
                  )}
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: '700',
                  background: statusColor, color: 'white', whiteSpace: 'nowrap',
                }}>
                  {s.status === 'open' ? '⏳ Open' : s.status === 'resolved' ? '✅ Resolved' : '❌ Not Conducted'}
                </span>
                <span style={{ fontSize: '16px', color: '#94a3b8' }}>→</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}