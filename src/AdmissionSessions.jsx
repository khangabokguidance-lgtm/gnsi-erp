// AdmissionSessions.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Manages admission sessions (academic years).
//  - Create / edit sessions
//  - Activate a session (only one active at a time)
//  - Lock a session (prevents new admissions)
//  - Shows admission count per session
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  indigo:  { 50:'#EEF2FF', 100:'#C7D2FE', 400:'#6366F1', 500:'#4F46E5', 600:'#4338CA', 700:'#3730A3' },
  emerald: { 50:'#ECFDF5', 100:'#D1FAE5', 300:'#6EE7B7', 500:'#10B981', 600:'#059669', 700:'#047857' },
  amber:   { 50:'#FFFBEB', 100:'#FEF3C7', 300:'#FCD34D', 500:'#F59E0B', 600:'#D97706', 700:'#B45309' },
  violet:  { 50:'#F5F3FF', 100:'#EDE9FE', 500:'#8B5CF6', 600:'#7C3AED', 700:'#6D28D9' },
  rose:    { 50:'#FFF1F2', 100:'#FFE4E6', 500:'#F43F5E', 600:'#E11D48' },
  slate:   { 50:'#F8FAFC', 100:'#F1F5F9', 200:'#E2E8F0', 300:'#CBD5E1', 400:'#94A3B8', 500:'#64748B', 600:'#475569', 700:'#334155', 800:'#1E293B', 900:'#0F172A' },
}

const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:`1.5px solid ${T.slate[200]}`, fontSize:13,
  outline:'none', boxSizing:'border-box', backgroundColor:'#fff',
  color:T.slate[800], fontFamily:'system-ui,sans-serif',
}
const lbl = {
  display:'block', fontSize:11, fontWeight:700, color:T.slate[500],
  marginBottom:5, textTransform:'uppercase', letterSpacing:'.07em',
}
const btn = (bg, c='white', extra={}) => ({
  padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
  fontSize:13, fontWeight:700, background:bg, color:c,
  fontFamily:'system-ui,sans-serif', ...extra,
})

function Toast({ msg, color }) {
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:999999, background:'#fff', border:`1px solid ${T.slate[200]}`, borderLeft:`3px solid ${color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.12)', maxWidth:320, color:T.slate[800] }}>
      {msg}
    </div>
  )
}

// ─── Session Form ─────────────────────────────────────────────────────────────
function SessionForm({ editing, onSave, onCancel }) {
  const def = (k, fb='') => editing ? (editing[k] ?? fb) : fb
  const [form, setForm] = useState({
    session_name: def('session_name'),
    label:        def('label'),
    start_date:   def('start_date'),
    end_date:     def('end_date'),
    total_seats:  def('total_seats', ''),
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-fill label from session_name
  useEffect(() => {
    if (form.session_name && !editing) {
      set('label', `Academic Year ${form.session_name}`)
    }
  }, [form.session_name])

  return (
    <div style={{ background:'#fff', border:`1.5px solid ${T.violet[200]}`, borderRadius:12, padding:20, marginBottom:20 }}>
      <div style={{ fontSize:15, fontWeight:800, color:T.violet[700], marginBottom:16 }}>
        {editing ? '✏️ Edit Session' : '➕ New Admission Session'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <label style={lbl}>Session Name * (e.g. 2025-26)</label>
          <input style={inp} value={form.session_name} onChange={e => set('session_name', e.target.value)} placeholder="2025-26" />
        </div>
        <div>
          <label style={lbl}>Label</label>
          <input style={inp} value={form.label} onChange={e => set('label', e.target.value)} placeholder="Academic Year 2025-26" />
        </div>
        <div>
          <label style={lbl}>Start Date</label>
          <input type="date" style={inp} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label style={lbl}>End Date</label>
          <input type="date" style={inp} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Total Seats</label>
          <input type="number" style={inp} value={form.total_seats} onChange={e => set('total_seats', e.target.value)} placeholder="e.g. 100" />
        </div>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:16 }}>
        <button onClick={() => onSave(form)} style={btn(`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`)}>
          {editing ? 'Update Session' : 'Create Session'}
        </button>
        <button onClick={onCancel} style={btn('#fff', T.slate[600], { border:`1px solid ${T.slate[200]}` })}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ s, admCount, onActivate, onLock, onEdit, onDelete }) {
  const pct = s.total_seats > 0 ? Math.min(100, Math.round((admCount / s.total_seats) * 100)) : null
  const barColor = pct === null ? T.slate[300] : pct >= 90 ? T.rose[500] : pct >= 70 ? T.amber[500] : T.emerald[500]

  return (
    <div style={{ background:'#fff', border:`1.5px solid ${s.is_active ? T.emerald[300] : s.is_locked ? T.rose[200] : T.slate[200]}`, borderRadius:14, padding:20, position:'relative', overflow:'hidden' }}>

      {/* Active glow strip */}
      {s.is_active && (
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${T.emerald[500]},${T.emerald[300]})` }} />
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:20, fontWeight:900, color:T.slate[900] }}>{s.session_name}</span>
            {s.is_active && (
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99, background:T.emerald[50], color:T.emerald[700], border:`1px solid ${T.emerald[300]}` }}>
                ✅ Active
              </span>
            )}
            {s.is_locked && (
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99, background:T.rose[50], color:T.rose[600], border:`1px solid ${T.rose[200]}` }}>
                🔒 Locked
              </span>
            )}
          </div>
          {s.label && <div style={{ fontSize:13, color:T.slate[500] }}>{s.label}</div>}
          {(s.start_date || s.end_date) && (
            <div style={{ fontSize:12, color:T.slate[400], marginTop:4 }}>
              {s.start_date && new Date(s.start_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
              {s.start_date && s.end_date && ' → '}
              {s.end_date && new Date(s.end_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
            </div>
          )}
        </div>

        {/* Admission count */}
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:28, fontWeight:900, color:s.is_active ? T.emerald[600] : T.slate[700], lineHeight:1 }}>{admCount}</div>
          <div style={{ fontSize:11, color:T.slate[400], fontWeight:600 }}>
            {s.total_seats ? `of ${s.total_seats} seats` : 'admissions'}
          </div>
        </div>
      </div>

      {/* Seat bar */}
      {s.total_seats > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11, color:T.slate[400] }}>
            <span>Seat utilisation</span>
            <span style={{ fontWeight:700, color:barColor }}>{pct}%</span>
          </div>
          <div style={{ height:7, background:T.slate[100], borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:barColor, borderRadius:99, transition:'width .5s' }} />
          </div>
          <div style={{ fontSize:11, color:T.slate[400], marginTop:4 }}>{s.total_seats - admCount} seats remaining</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {!s.is_active && !s.is_locked && (
          <button onClick={() => onActivate(s.id)}
            style={btn(T.emerald[600], 'white', { fontSize:12, padding:'6px 14px' })}>
            ▶ Activate
          </button>
        )}
        {s.is_active && !s.is_locked && (
          <button onClick={() => onLock(s.id)}
            style={btn(T.amber[500], 'white', { fontSize:12, padding:'6px 14px' })}>
            🔒 Lock Session
          </button>
        )}
        {s.is_locked && (
          <button onClick={() => onLock(s.id, true)}
            style={btn(T.slate[500], 'white', { fontSize:12, padding:'6px 14px' })}>
            🔓 Unlock
          </button>
        )}
        <button onClick={() => onEdit(s)}
          style={btn('#fff', T.slate[600], { border:`1px solid ${T.slate[200]}`, fontSize:12, padding:'6px 14px' })}>
          ✏️ Edit
        </button>
        {!s.is_active && admCount === 0 && (
          <button onClick={() => onDelete(s.id)}
            style={btn(T.rose[50], T.rose[600], { border:`1px solid ${T.rose[200]}`, fontSize:12, padding:'6px 14px' })}>
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdmissionSessions() {
  const [sessions,   setSessions]  = useState([])
  const [admCounts,  setAdmCounts] = useState({})  // { session_name: count }
  const [loading,    setLoading]   = useState(true)
  const [showForm,   setShowForm]  = useState(false)
  const [editing,    setEditing]   = useState(null)
  const [toast,      setToast]     = useState(null)

  const showToast = (msg, color=T.emerald[600]) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: sess } = await supabase
      .from('admission_sessions')
      .select('*')
      .order('session_name', { ascending: false })

    if (sess) {
      setSessions(sess)
      // Count admissions per session_name
      const counts = {}
      await Promise.all(sess.map(async s => {
        const { count } = await supabase
          .from('admissions')
          .select('*', { count:'exact', head:true })
          .eq('session', s.session_name)
        counts[s.session_name] = count ?? 0
      }))
      setAdmCounts(counts)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (form) => {
    if (!form.session_name?.trim()) { showToast('Session name required', T.rose[600]); return }
    const payload = {
      session_name: form.session_name.trim(),
      label:        form.label || null,
      start_date:   form.start_date || null,
      end_date:     form.end_date   || null,
      total_seats:  form.total_seats ? parseInt(form.total_seats) : null,
    }
    if (editing) {
      const { error } = await supabase.from('admission_sessions').update(payload).eq('id', editing.id)
      if (error) { showToast('Update failed: ' + error.message, T.rose[600]); return }
      showToast('Session updated', T.amber[600])
    } else {
      const { error } = await supabase.from('admission_sessions').insert(payload)
      if (error) {
        if (error.code === '23505') showToast(`Session "${form.session_name}" already exists`, T.rose[600])
        else showToast('Create failed: ' + error.message, T.rose[600])
        return
      }
      showToast(`Session "${form.session_name}" created!`, T.emerald[600])
    }
    setShowForm(false); setEditing(null); load()
  }

  const handleActivate = async (id) => {
    const s = sessions.find(x => x.id === id)
    if (!confirm(`Activate session "${s?.session_name}"? The current active session will be deactivated.`)) return

    // Deactivate all first, then activate selected
    await supabase.from('admission_sessions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    const { error } = await supabase.from('admission_sessions').update({ is_active: true, is_locked: false }).eq('id', id)
    if (error) { showToast('Activate failed: ' + error.message, T.rose[600]); return }
    showToast(`"${s?.session_name}" is now the active session`, T.emerald[600])
    load()
  }

  const handleLock = async (id, unlock=false) => {
    const s = sessions.find(x => x.id === id)
    const msg = unlock
      ? `Unlock session "${s?.session_name}"? New admissions will be allowed again.`
      : `Lock session "${s?.session_name}"? No new admissions will be accepted.`
    if (!confirm(msg)) return
    const { error } = await supabase.from('admission_sessions').update({ is_locked: !unlock }).eq('id', id)
    if (error) { showToast('Failed: ' + error.message, T.rose[600]); return }
    showToast(unlock ? 'Session unlocked' : 'Session locked 🔒', T.amber[600])
    load()
  }

  const handleDelete = async (id) => {
    const s = sessions.find(x => x.id === id)
    if (!confirm(`Delete session "${s?.session_name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('admission_sessions').delete().eq('id', id)
    if (error) { showToast('Delete failed: ' + error.message, T.rose[600]); return }
    showToast('Session deleted', T.rose[600])
    load()
  }

  const activeSession = sessions.find(s => s.is_active)
  const totalAdmissions = Object.values(admCounts).reduce((a, b) => a + b, 0)

  return (
    <div style={{ padding:'24px', fontFamily:'system-ui,sans-serif', background:T.slate[50], minHeight:'100vh' }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.12em', color:T.slate[400], marginBottom:5 }}>GNSI Portal</div>
          <h1 style={{ fontSize:24, fontWeight:900, color:T.slate[900], margin:0 }}>📅 Admission Sessions</h1>
          <p style={{ fontSize:13, color:T.slate[500], margin:'6px 0 0' }}>
            Create and manage academic year sessions. Only one session can be active at a time.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(!showForm) }}
          style={btn(`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, 'white', { fontSize:13, padding:'10px 20px', boxShadow:'0 4px 12px rgba(79,70,229,.3)' })}>
          {showForm ? '✕ Cancel' : '➕ New Session'}
        </button>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div style={{ background:`linear-gradient(135deg,${T.emerald[600]},${T.emerald[500]})`, borderRadius:12, padding:'14px 20px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ color:'white' }}>
            <div style={{ fontSize:11, fontWeight:700, opacity:0.8, textTransform:'uppercase', letterSpacing:'.06em' }}>Currently Active Session</div>
            <div style={{ fontSize:20, fontWeight:900, marginTop:2 }}>{activeSession.session_name}</div>
            {activeSession.label && <div style={{ fontSize:12, opacity:0.85, marginTop:2 }}>{activeSession.label}</div>}
          </div>
          <div style={{ color:'white', textAlign:'right' }}>
            <div style={{ fontSize:28, fontWeight:900, lineHeight:1 }}>{admCounts[activeSession.session_name] ?? 0}</div>
            <div style={{ fontSize:11, opacity:0.8 }}>
              {activeSession.total_seats ? `of ${activeSession.total_seats} seats` : 'admissions this session'}
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Sessions', value:sessions.length,                         color:T.indigo[600],  bg:T.indigo[50] },
          { label:'Total Admissions', value:totalAdmissions,                       color:T.violet[600],  bg:T.violet[50] },
          { label:'Active Session',   value:activeSession?.session_name || 'None', color:T.emerald[600], bg:T.emerald[50] },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:12, padding:'16px 20px', border:`1px solid ${c.color}20` }}>
            <div style={{ fontSize:12, fontWeight:700, color:c.color, textTransform:'uppercase', letterSpacing:'.05em' }}>{c.label}</div>
            <div style={{ fontSize:24, fontWeight:900, color:c.color, marginTop:4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <SessionForm
          editing={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {/* Session cards */}
      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:T.slate[400] }}>⏳ Loading sessions…</div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign:'center', padding:64, color:T.slate[400] }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
          <div style={{ fontSize:16, fontWeight:700, color:T.slate[600], marginBottom:8 }}>No sessions yet</div>
          <p style={{ fontSize:13, color:T.slate[400], maxWidth:'32ch', margin:'0 auto 20px' }}>
            Create your first admission session to get started.
          </p>
          <button onClick={() => setShowForm(true)} style={btn(`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`)}>
            ➕ Create First Session
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
          {sessions.map(s => (
            <SessionCard
              key={s.id}
              s={s}
              admCount={admCounts[s.session_name] ?? 0}
              onActivate={handleActivate}
              onLock={handleLock}
              onEdit={sess => { setEditing(sess); setShowForm(true) }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}