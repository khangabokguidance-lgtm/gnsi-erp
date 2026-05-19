// Sessions.jsx — GNSI Portal v2.0
// ─────────────────────────────────────────────────────────────────────────────
//  Manages academic admission sessions stored in `admission_sessions` table.
//
//  Table schema expected:
//    admission_sessions (
//      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//      session_name  text NOT NULL UNIQUE,   -- e.g. "2025-26"
//      is_active     boolean DEFAULT false,
//      is_locked     boolean DEFAULT false,
//      start_date    date,
//      end_date      date,
//      notes         text,
//      created_at    timestamptz DEFAULT now(),
//      updated_at    timestamptz DEFAULT now()
//    )
//
//  Only ONE session can be active at a time. Activating one deactivates others.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'

// ─── Design Tokens (mirrors Admissions.jsx) ───────────────────────────────────
const T = {
  navy:    { 50:'#EEF2FF',100:'#C7D2FE',300:'#818CF8',500:'#3730A3',700:'#1E1B4B',900:'#0F0D26' },
  indigo:  { 50:'#EEF2FF',100:'#C7D2FE',400:'#6366F1',500:'#4F46E5',600:'#4338CA',700:'#3730A3' },
  emerald: { 50:'#ECFDF5',100:'#D1FAE5',300:'#6EE7B7',500:'#10B981',600:'#059669',700:'#047857' },
  amber:   { 50:'#FFFBEB',100:'#FEF3C7',300:'#FCD34D',500:'#F59E0B',600:'#D97706',700:'#B45309' },
  violet:  { 50:'#F5F3FF',100:'#EDE9FE',400:'#A78BFA',500:'#8B5CF6',600:'#7C3AED',700:'#6D28D9' },
  rose:    { 50:'#FFF1F2',100:'#FFE4E6',200:'#FECDD3',500:'#F43F5E',600:'#E11D48',700:'#BE123C' },
  slate:   { 50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A' },
  sky:     { 50:'#F0F9FF',100:'#E0F2FE',400:'#38BDF8',500:'#0EA5E9',600:'#0284C7',700:'#0369A1' },
  teal:    { 50:'#F0FDFA',100:'#CCFBF1',500:'#14B8A6',600:'#0D9488',700:'#0F766E' },
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1.5px solid ${T.slate[200]}`, fontSize: 13,
  outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
  color: T.slate[800], fontFamily: 'system-ui,sans-serif',
  transition: 'border-color .15s',
}
const label = {
  display: 'block', fontSize: 11, fontWeight: 700, color: T.slate[500],
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em',
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const dateFmt = iso => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const timeFmt = iso => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function FieldRow({ label: lbl, children }) {
  return (
    <div>
      <label style={label}>{lbl}</label>
      {children}
    </div>
  )
}

function SectionDivider({ label: lbl }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px', color: T.slate[400] }}>
      <div style={{ flex: 1, height: 1, background: T.slate[200] }} />
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{lbl}</span>
      <div style={{ flex: 1, height: 1, background: T.slate[200] }} />
    </div>
  )
}

function Toast({ msg, color = T.indigo[600] }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999999, background: '#fff', border: `1px solid ${T.slate[200]}`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 360, color: T.slate[800] }}>
      {msg}
    </div>
  )
}

// ─── Session Status Badge ─────────────────────────────────────────────────────
function SessionBadge({ session }) {
  if (session.is_active && session.is_locked) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: T.rose[50], color: T.rose[600], border: `1px solid ${T.rose[200]}` }}>
      🔒 Active · Locked
    </span>
  )
  if (session.is_active) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: T.emerald[50], color: T.emerald[700], border: `1px solid ${T.emerald[300]}` }}>
      ✅ Active
    </span>
  )
  if (session.is_locked) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: T.slate[100], color: T.slate[500], border: `1px solid ${T.slate[200]}` }}>
      🔒 Locked
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: T.slate[100], color: T.slate[400], border: `1px solid ${T.slate[200]}` }}>
      ◌ Inactive
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label: lbl, value, accent, subtitle }) {
  return (
    <div style={{ flex: 1, minWidth: 100, padding: '12px 16px', borderRadius: 10, background: '#fff', border: `1.5px solid ${T.slate[200]}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent || T.slate[800], lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.slate[500], marginTop: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{lbl}</div>
      {subtitle && <div style={{ fontSize: 11, color: T.slate[400], marginTop: 2 }}>{subtitle}</div>}
    </div>
  )
}

// ─── Create / Edit Form ───────────────────────────────────────────────────────
function SessionForm({ onSave, onCancel, editing }) {
  const def = (k, fb = '') => editing ? (editing[k] ?? fb) : fb
  const [form, setForm] = useState({
    session_name: def('session_name'),
    start_date:   def('start_date'),
    end_date:     def('end_date'),
    notes:        def('notes'),
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-suggest session name when start_date is picked
  const handleStartDate = v => {
    set('start_date', v)
    if (!form.session_name && v) {
      const yr = new Date(v).getFullYear()
      set('session_name', `${yr}-${String(yr + 1).slice(2)}`)
    }
  }

  const valid = form.session_name.trim().length > 0

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${T.violet[200]}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ background: T.violet[50], borderBottom: `1px solid ${T.violet[200]}`, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.violet[700] }}>
          {editing ? '✏️ Edit Session' : '➕ New Session'}
        </div>
        <button onClick={onCancel} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.violet[200]}`, background: '#fff', cursor: 'pointer', fontSize: 16, color: T.slate[500] }}>✕</button>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <FieldRow label="Session Name *">
              <input style={inp} value={form.session_name} onChange={e => set('session_name', e.target.value)}
                placeholder="e.g. 2025-26" />
              <div style={{ fontSize: 11, color: T.slate[400], marginTop: 4 }}>
                This name will appear on all admission records and fee collections.
              </div>
            </FieldRow>
          </div>
          <FieldRow label="Start Date">
            <input type="date" style={inp} value={form.start_date} onChange={e => handleStartDate(e.target.value)} />
          </FieldRow>
          <FieldRow label="End Date">
            <input type="date" style={inp} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </FieldRow>
          <div style={{ gridColumn: '1/-1' }}>
            <FieldRow label="Notes / Description">
              <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.notes}
                onChange={e => set('notes', e.target.value)} placeholder="Optional internal notes about this session…" />
            </FieldRow>
          </div>
        </div>

        {!editing && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 9, background: T.amber[50], border: `1px solid ${T.amber[200]}`, fontSize: 12, color: T.amber[700], fontWeight: 600 }}>
            ⚠ New sessions are created as <strong>Inactive</strong>. Use "Activate" to make it the current session. Only one session can be active at a time.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => valid && onSave(editing?.id || null, form)} disabled={!valid}
            style={{ padding: '10px 24px', borderRadius: 9, background: valid ? `linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})` : T.slate[200], color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: valid ? 'pointer' : 'not-allowed' }}>
            {editing ? 'Update Session' : 'Create Session'}
          </button>
          <button onClick={onCancel}
            style={{ padding: '10px 16px', borderRadius: 9, border: `1px solid ${T.slate[200]}`, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: T.slate[600] }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ s, admCount, onActivate, onDeactivate, onLock, onUnlock, onEdit, onDelete }) {
  const isActive  = s.is_active
  const isLocked  = s.is_locked

  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${isActive ? T.emerald[300] : T.slate[200]}`,
      borderRadius: 12,
      padding: '18px 20px',
      position: 'relative',
      boxShadow: isActive ? `0 0 0 3px ${T.emerald[100]}` : 'none',
      transition: 'box-shadow .2s',
    }}>
      {/* Active indicator strip */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: '12px 0 0 12px', background: isActive ? T.emerald[500] : T.slate[200] }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* Left: Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: T.slate[900], fontFamily: 'Georgia, serif', letterSpacing: '-.02em' }}>
              {s.session_name}
            </span>
            <SessionBadge session={s} />
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: T.slate[500], flexWrap: 'wrap' }}>
            {s.start_date && <span>📅 Start: <strong style={{ color: T.slate[700] }}>{dateFmt(s.start_date)}</strong></span>}
            {s.end_date   && <span>🏁 End: <strong style={{ color: T.slate[700] }}>{dateFmt(s.end_date)}</strong></span>}
            <span>📋 Applications: <strong style={{ color: admCount > 0 ? T.indigo[600] : T.slate[400] }}>{admCount}</strong></span>
            <span style={{ color: T.slate[400] }}>Created: {timeFmt(s.created_at)}</span>
          </div>

          {s.notes && (
            <div style={{ marginTop: 8, fontSize: 12, color: T.slate[500], padding: '6px 10px', background: T.slate[50], borderRadius: 7, border: `1px solid ${T.slate[100]}` }}>
              {s.notes}
            </div>
          )}
        </div>

        {/* Right: Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
          {/* Activate / Deactivate */}
          {!isActive ? (
            <button onClick={() => onActivate(s.id)}
              style={{ padding: '7px 16px', borderRadius: 8, background: `linear-gradient(135deg,${T.emerald[600]},${T.emerald[500]})`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✅ Activate
            </button>
          ) : (
            <button onClick={() => onDeactivate(s.id)}
              style={{ padding: '7px 16px', borderRadius: 8, background: T.slate[100], color: T.slate[600], border: `1px solid ${T.slate[200]}`, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Deactivate
            </button>
          )}

          {/* Lock / Unlock */}
          <div style={{ display: 'flex', gap: 6 }}>
            {!isLocked ? (
              <button onClick={() => onLock(s.id)}
                style={{ padding: '6px 13px', borderRadius: 7, background: T.rose[50], color: T.rose[600], border: `1px solid ${T.rose[200]}`, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                🔒 Lock
              </button>
            ) : (
              <button onClick={() => onUnlock(s.id)}
                style={{ padding: '6px 13px', borderRadius: 7, background: T.amber[50], color: T.amber[700], border: `1px solid ${T.amber[200]}`, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                🔓 Unlock
              </button>
            )}
            <button onClick={() => onEdit(s)}
              style={{ padding: '6px 13px', borderRadius: 7, background: T.slate[50], color: T.slate[600], border: `1px solid ${T.slate[200]}`, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Edit
            </button>
            <button onClick={() => onDelete(s.id)} disabled={isActive}
              style={{ padding: '6px 13px', borderRadius: 7, background: isActive ? T.slate[50] : T.rose[50], color: isActive ? T.slate[300] : T.rose[500], border: `1px solid ${isActive ? T.slate[100] : T.rose[200]}`, fontSize: 11, fontWeight: 700, cursor: isActive ? 'not-allowed' : 'pointer' }}
              title={isActive ? 'Cannot delete the active session' : 'Delete session'}>
              Del
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Sessions() {
  const [sessions,  setSessions]  = useState([])
  const [admCounts, setAdmCounts] = useState({})  // session_name → count
  const [loading,   setLoading]   = useState(true)
  const [formOpen,  setFormOpen]  = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [toast,     setToast]     = useState(null)

  const showToast = (msg, color) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('admission_sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) { console.error('Sessions fetch:', error); setLoading(false); return }
    setSessions(data || [])

    // Load admission counts per session
    if (data?.length) {
      const { data: adms } = await supabase
        .from('admissions')
        .select('session')
      if (adms) {
        const counts = {}
        adms.forEach(a => {
          if (a.session) counts[a.session] = (counts[a.session] || 0) + 1
        })
        setAdmCounts(counts)
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Create / Update ────────────────────────────────────────────────────────
  const handleSave = async (eid, form) => {
    const row = {
      session_name: form.session_name.trim(),
      start_date:   form.start_date  || null,
      end_date:     form.end_date    || null,
      notes:        form.notes       || null,
      updated_at:   new Date().toISOString(),
    }

    if (eid) {
      const { error } = await supabase.from('admission_sessions').update(row).eq('id', eid)
      if (error) { showToast('Update failed: ' + error.message, T.rose[600]); return }
      showToast('Session updated', T.amber[600])
    } else {
      const { error } = await supabase.from('admission_sessions').insert({ ...row, is_active: false, is_locked: false })
      if (error) {
        if (error.code === '23505') showToast(`Session "${form.session_name}" already exists`, T.rose[600])
        else showToast('Create failed: ' + error.message, T.rose[600])
        return
      }
      showToast(`Session "${form.session_name}" created`, T.emerald[600])
    }

    setFormOpen(false); setEditing(null)
    load()
  }

  // ─── Activate ───────────────────────────────────────────────────────────────
  const handleActivate = async id => {
    const target = sessions.find(s => s.id === id)
    if (!confirm(`Activate session "${target?.session_name}"?\n\nThis will deactivate the currently active session. New admissions will be tagged to this session.`)) return

    // Deactivate all, then activate this one
    const { error: deactErr } = await supabase
      .from('admission_sessions')
      .update({ is_active: false })
      .neq('id', id)  // update all others
    if (deactErr) { showToast('Failed to deactivate others: ' + deactErr.message, T.rose[600]); return }

    const { error } = await supabase
      .from('admission_sessions')
      .update({ is_active: true, is_locked: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { showToast('Activate failed: ' + error.message, T.rose[600]); return }

    showToast(`✅ "${target?.session_name}" is now the active session`, T.emerald[600])
    load()
  }

  // ─── Deactivate ─────────────────────────────────────────────────────────────
  const handleDeactivate = async id => {
    const target = sessions.find(s => s.id === id)
    if (!confirm(`Deactivate "${target?.session_name}"?\n\nNo session will be active until you activate another one.`)) return

    const { error } = await supabase
      .from('admission_sessions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { showToast('Deactivate failed: ' + error.message, T.rose[600]); return }

    showToast(`"${target?.session_name}" deactivated`, T.amber[600])
    load()
  }

  // ─── Lock ────────────────────────────────────────────────────────────────────
  const handleLock = async id => {
    const target = sessions.find(s => s.id === id)
    if (!confirm(`Lock session "${target?.session_name}"?\n\nNo new admission applications can be created once locked. Existing records remain editable.`)) return

    const { error } = await supabase
      .from('admission_sessions')
      .update({ is_locked: true, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { showToast('Lock failed: ' + error.message, T.rose[600]); return }

    showToast(`🔒 "${target?.session_name}" locked`, T.rose[500])
    load()
  }

  // ─── Unlock ──────────────────────────────────────────────────────────────────
  const handleUnlock = async id => {
    const target = sessions.find(s => s.id === id)
    const { error } = await supabase
      .from('admission_sessions')
      .update({ is_locked: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { showToast('Unlock failed: ' + error.message, T.rose[600]); return }

    showToast(`🔓 "${target?.session_name}" unlocked`, T.emerald[600])
    load()
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async id => {
    const target = sessions.find(s => s.id === id)
    if (target?.is_active) { showToast('Cannot delete the active session', T.rose[600]); return }
    const count = admCounts[target?.session_name] || 0
    if (!confirm(`Delete session "${target?.session_name}"?${count > 0 ? `\n\n⚠ This session has ${count} admission records. The records will NOT be deleted, but they will no longer be linked to a managed session.` : ''}\n\nThis cannot be undone.`)) return

    const { error } = await supabase.from('admission_sessions').delete().eq('id', id)
    if (error) { showToast('Delete failed: ' + error.message, T.rose[600]); return }

    showToast(`"${target?.session_name}" deleted`, T.rose[600])
    load()
  }

  // ─── Derived stats ───────────────────────────────────────────────────────────
  const activeSession  = sessions.find(s => s.is_active)
  const lockedSessions = sessions.filter(s => s.is_locked).length
  const totalAdms      = Object.values(admCounts).reduce((a, b) => a + b, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 14, color: T.slate[500], fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: 22, height: 22, border: `2.5px solid ${T.slate[200]}`, borderTopColor: T.indigo[600], borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <span style={{ fontWeight: 600 }}>Loading sessions…</span>
    </div>
  )

  return (
    <div style={{ padding: '0 24px 32px', fontFamily: 'system-ui,sans-serif', background: T.slate[50], minHeight: '100vh' }}>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } } select:focus,input:focus,textarea:focus { border-color:${T.indigo[400]} !important; box-shadow:0 0 0 3px ${T.indigo[100]}; }`}</style>

      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {/* Header */}
      <div style={{ padding: '28px 0 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: T.slate[400], marginBottom: 5 }}>GNSI Portal</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.slate[900], letterSpacing: '-.03em', lineHeight: 1.1 }}>Admission Sessions</div>
          <div style={{ fontSize: 13, color: T.slate[500], marginTop: 5 }}>
            Create and manage academic year sessions · Control which session is active for new admissions
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setFormOpen(true) }}
          style={{ padding: '10px 20px', borderRadius: 10, background: `linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(79,70,229,.3)' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New Session
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard label="Total Sessions"   value={sessions.length}      accent={T.indigo[600]} />
        <KpiCard label="Active Session"   value={activeSession?.session_name || '—'} accent={T.emerald[600]} subtitle={activeSession ? (activeSession.is_locked ? '🔒 Locked' : 'Open for admissions') : 'None active'} />
        <KpiCard label="Locked Sessions"  value={lockedSessions}        accent={T.rose[500]} />
        <KpiCard label="Total Admissions" value={totalAdms}             accent={T.violet[600]} subtitle="Across all sessions" />
      </div>

      {/* No active session warning */}
      {!activeSession && sessions.length > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 18px', borderRadius: 10, background: T.amber[50], border: `1px solid ${T.amber[300]}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.amber[700] }}>No active session</div>
            <div style={{ fontSize: 12, color: T.amber[600] }}>The Admissions page will not auto-assign a session. Activate a session below to resume admissions.</div>
          </div>
        </div>
      )}

      {/* Active session info banner */}
      {activeSession && (
        <div style={{ marginBottom: 16, padding: '12px 18px', borderRadius: 10, background: activeSession.is_locked ? T.rose[50] : T.emerald[50], border: `1px solid ${activeSession.is_locked ? T.rose[200] : T.emerald[300]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{activeSession.is_locked ? '🔒' : '✅'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: activeSession.is_locked ? T.rose[700] : T.emerald[700] }}>
                {activeSession.is_locked ? 'Session Locked' : 'Active Session'}: <strong>{activeSession.session_name}</strong>
              </div>
              <div style={{ fontSize: 12, color: activeSession.is_locked ? T.rose[500] : T.emerald[600] }}>
                {activeSession.is_locked
                  ? 'New applications are blocked in Admissions. Unlock to resume.'
                  : `New admissions will be tagged to "${activeSession.session_name}". ${admCounts[activeSession.session_name] || 0} applications so far.`}
              </div>
            </div>
          </div>
          {activeSession.is_locked
            ? <button onClick={() => handleUnlock(activeSession.id)} style={{ padding: '7px 16px', borderRadius: 8, background: T.amber[500], color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔓 Unlock Session</button>
            : <button onClick={() => handleLock(activeSession.id)}   style={{ padding: '7px 16px', borderRadius: 8, background: T.rose[600], color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔒 Lock Session</button>
          }
        </div>
      )}

      {/* Form */}
      {formOpen && (
        <SessionForm
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null) }}
          editing={editing}
        />
      )}

      {/* How it works — shown when no sessions exist */}
      {sessions.length === 0 && !formOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: T.slate[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 16 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.slate[700], marginBottom: 6 }}>No sessions yet</div>
          <p style={{ fontSize: 13, color: T.slate[400], maxWidth: '40ch', lineHeight: 1.6, margin: '0 0 20px' }}>
            Create your first academic session (e.g. "2025-26"), then activate it so the Admissions page can tag new records automatically.
          </p>
          <button onClick={() => setFormOpen(true)}
            style={{ padding: '10px 22px', borderRadius: 10, background: `linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            + Create First Session
          </button>
        </div>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <>
          <SectionDivider label={`All Sessions (${sessions.length})`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                s={s}
                admCount={admCounts[s.session_name] || 0}
                onActivate={handleActivate}
                onDeactivate={handleDeactivate}
                onLock={handleLock}
                onUnlock={handleUnlock}
                onEdit={sess => { setEditing(sess); setFormOpen(true) }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}

      {/* How it works explainer */}
      {sessions.length > 0 && (
        <div style={{ marginTop: 28, padding: '16px 20px', borderRadius: 12, background: '#fff', border: `1px solid ${T.slate[200]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.slate[400], marginBottom: 12 }}>How Sessions Work</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            {[
              { icon: '➕', title: 'Create', desc: 'Add a new academic year session (e.g. "2025-26"). Starts as inactive.' },
              { icon: '✅', title: 'Activate', desc: 'One session is active at a time. New admissions in Admissions.jsx are auto-tagged to it.' },
              { icon: '🔒', title: 'Lock', desc: 'Prevents new applications being created for this session. Existing records remain editable.' },
              { icon: '📤', title: 'Archive', desc: 'Deactivate old sessions to archive them. Their admission records are preserved.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.slate[700], marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 11, color: T.slate[400], lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}