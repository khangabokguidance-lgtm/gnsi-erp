import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITIES  = ['High', 'Medium', 'Low']
const STATUSES    = ['Pending', 'In Progress', 'Done']
const DEPARTMENTS = ['Administration','Academic','Accounts','Hostel','Reception','Transport','Maintenance']

const PRIORITY_META = {
  High:   { color: '#dc2626', bg: '#fee2e2', icon: '🔴' },
  Medium: { color: '#d97706', bg: '#fef3c7', icon: '🟡' },
  Low:    { color: '#16a34a', bg: '#dcfce7', icon: '🟢' },
}
const STATUS_META = {
  Pending:       { color: '#6366f1', bg: '#eef2ff', icon: '⏳' },
  'In Progress': { color: '#0ea5e9', bg: '#f0f9ff', icon: '🔄' },
  Done:          { color: '#16a34a', bg: '#dcfce7', icon: '✅' },
  Overdue:       { color: '#dc2626', bg: '#fee2e2', icon: '🚨' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today     = () => new Date().toISOString().split('T')[0]
const fmtDate   = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const daysDiff  = d => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000) }
const initials  = name => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
const isOverdue = t => t.status !== 'Done' && t.due_date && daysDiff(t.due_date) < 0

// ─── Shared Styles ────────────────────────────────────────────────────────────
const S = {
  page:  { padding: '24px', fontFamily: "'Segoe UI', sans-serif", background: '#f0f4f8', minHeight: '100vh' },
  card:  { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: '16px', overflow: 'hidden' },
  btn:   (color = '#1e3a5f', disabled = false) => ({ backgroundColor: disabled ? '#94a3b8' : color, color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: 'inherit' }),
  btnSm: (color = '#1e3a5f') => ({ backgroundColor: color, color: 'white', border: 'none', borderRadius: '6px', padding: '5px 11px', fontWeight: '600', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', whiteSpace: 'nowrap' }),
  inp:   { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white' },
  lbl:   { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' },
  th:    { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', whiteSpace: 'nowrap' },
  td:    { padding: '11px 14px', fontSize: '13px', color: '#334155', verticalAlign: 'middle' },
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, type = 'status' }) {
  const meta = type === 'priority' ? PRIORITY_META[label] : STATUS_META[label]
  if (!meta) return <span style={{ fontSize: 11, color: '#94a3b8' }}>{label || '—'}</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
      {meta.icon} {label}
    </span>
  )
}

// ─── Mini progress bar ────────────────────────────────────────────────────────
function MiniBar({ done, total, overdue }) {
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const color = overdue > 0 ? '#ef4444' : pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#6366f1'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>{done}/{total}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
      </div>
      {overdue > 0 && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginTop: 2 }}>🚨 {overdue} overdue</div>}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 3000, background: '#1e293b', color: 'white', padding: '13px 20px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)', fontSize: 14, fontWeight: 600 }}>
      {msg}
    </div>
  )
}

// ─── Admin Alert Banner ───────────────────────────────────────────────────────
function AlertBanner({ staff, tasks, onDismiss }) {
  const warnings = useMemo(() => {
    const out = []
    staff.forEach(s => {
      const st = tasks.filter(t => t.assigned_to === s.name)
      const overdue = st.filter(t => isOverdue(t))
      const dueSoon = st.filter(t => !isOverdue(t) && t.status !== 'Done' && daysDiff(t.due_date) !== null && daysDiff(t.due_date) <= 1)
      const pending = st.filter(t => t.status === 'Pending' && !isOverdue(t))
      if (overdue.length >= 2) out.push({ id: `ov_${s.id}`, type: 'danger',  staff: s.name, msg: `${overdue.length} overdue tasks — immediate action needed`, tasks: overdue })
      if (dueSoon.length > 0)  out.push({ id: `ds_${s.id}`, type: 'warning', staff: s.name, msg: `${dueSoon.length} task${dueSoon.length > 1 ? 's' : ''} due within 24h`, tasks: dueSoon })
      if (pending.length >= 4) out.push({ id: `pl_${s.id}`, type: 'info',    staff: s.name, msg: `${pending.length} pending tasks — workload review suggested`, tasks: pending })
    })
    return out
  }, [staff, tasks])

  const [dismissed, setDismissed] = useState([])
  const visible = warnings.filter(w => !dismissed.includes(w.id))
  if (!visible.length) return null

  const typeStyle = {
    danger:  { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: '🔴' },
    warning: { bg: '#fffbeb', border: '#fde68a', color: '#d97706', icon: '⚠️' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', icon: 'ℹ️' },
  }

  return (
    <div style={{ ...S.card, padding: '14px 18px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        🔔 Admin Alerts
        <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 99, fontSize: 11, padding: '2px 8px', fontWeight: 800 }}>{visible.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(w => {
          const ts = typeStyle[w.type]
          return (
            <div key={w.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: ts.bg, border: `1px solid ${ts.border}`, borderRadius: 10 }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{ts.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: ts.color, fontSize: 13 }}>{w.staff}</div>
                <div style={{ fontSize: 12, color: ts.color, opacity: .85 }}>{w.msg}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                  {w.tasks.map(t => (
                    <span key={t.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(0,0,0,.06)', color: ts.color, fontWeight: 600 }}>{t.title}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setDismissed(d => [...d, w.id])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ts.color, fontSize: 16, lineHeight: 1, flexShrink: 0, opacity: .6, fontFamily: 'inherit' }}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Assign Task Modal ────────────────────────────────────────────────────────
function AssignModal({ staffList, preselected, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'Medium', status: 'Pending',
    due_date: '', department: preselected?.department || 'Administration',
    assigned_to: preselected?.name || (staffList[0]?.name || ''),
    assigned_by: 'Admin',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim() || !form.assigned_to) { alert('Title and Assigned To are required'); return }
    setSaving(true)
    const { data, error } = await supabase.from('staff_tasks').insert([{
      ...form, due_date: form.due_date || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }]).select()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSave(data?.[0])
    onClose()
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
  const modal   = { background: 'white', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,.22)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#6366f1)', padding: '20px 24px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, opacity: .7, textTransform: 'uppercase', letterSpacing: 1 }}>GNSI · Staff Tasks</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Assign New Task</div>
            {preselected && <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>→ {preselected.name}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.18)', border: 'none', color: 'white', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={S.lbl}>Task Title *</label>
            <input style={S.inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Submit lesson plan for June" />
          </div>
          <div>
            <label style={S.lbl}>Description / Instructions</label>
            <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 60 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detailed instructions..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={S.lbl}>Assign To *</label>
              <select style={{ ...S.inp, backgroundColor: 'white' }} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                {staffList.map(s => <option key={s.id} value={s.name}>{s.name} — {s.designation}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Assigned By</label>
              <input style={S.inp} value={form.assigned_by} onChange={e => set('assigned_by', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={S.lbl}>Department</label>
              <select style={{ ...S.inp, backgroundColor: 'white' }} value={form.department} onChange={e => set('department', e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Priority</label>
              <select style={{ ...S.inp, backgroundColor: 'white' }} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Due Date</label>
              <input type="date" style={S.inp} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px 20px', display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,#1e3a5f,#6366f1)', color: 'white', border: 'none', borderRadius: 10, padding: 13, cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'inherit' }}>
            {saving ? '⏳ Assigning…' : '✅ Assign Task'}
          </button>
          <button onClick={onClose} style={{ padding: '13px 20px', background: '#f1f5f9', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: '#64748b', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────
function TaskDetailModal({ task, onClose, onStatusChange }) {
  const [note, setNote] = useState(task.completion_note || '')
  const [saving, setSaving] = useState(false)
  const overdue = isOverdue(task)
  const sm = STATUS_META[overdue ? 'Overdue' : task.status] || STATUS_META.Pending
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.Medium
  const diff = daysDiff(task.due_date)

  const saveNote = async () => {
    setSaving(true)
    await supabase.from('staff_tasks').update({ completion_note: note, updated_at: new Date().toISOString() }).eq('id', task.id)
    setSaving(false)
    alert('Note saved!')
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(4px)', zIndex: 2001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#0ea5e9)', padding: '20px 22px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, opacity: .7, textTransform: 'uppercase', letterSpacing: 1 }}>Task Detail</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, lineHeight: 1.3 }}>{task.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: 'white', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[['Assigned To', task.assigned_to], ['Assigned By', task.assigned_by || 'Admin'], ['Department', task.department || 'General'], ['Due Date', fmtDate(task.due_date)]].map(([l, v]) => (
              <div key={l} style={{ background: '#f8fafc', borderRadius: 8, padding: '9px 12px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{v || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Badge label={task.priority} type="priority" />
            <Badge label={overdue ? 'Overdue' : task.status} />
            {diff !== null && task.status !== 'Done' && (
              <span style={{ fontSize: 11, color: overdue ? '#ef4444' : diff <= 2 ? '#f59e0b' : '#94a3b8', fontWeight: 700 }}>
                {overdue ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today!' : `${diff}d left`}
              </span>
            )}
          </div>
          {task.description && <div style={{ marginBottom: 14, background: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{task.description}</div>}
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...S.lbl, marginBottom: 5 }}>Completion Note</label>
            <textarea style={{ ...S.inp, minHeight: 70, resize: 'vertical' }} value={note} onChange={e => setNote(e.target.value)} placeholder="Add progress note..." />
            <button onClick={saveNote} disabled={saving} style={{ ...S.btn('#1e3a5f', saving), marginTop: 7, padding: '7px 14px', fontSize: 12 }}>{saving ? 'Saving…' : 'Save Note'}</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {task.status !== 'Done' && (
              <button onClick={() => { onStatusChange(task, task.status === 'Pending' ? 'In Progress' : 'Done'); onClose() }}
                style={{ flex: 1, background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', color: 'white', border: 'none', borderRadius: 10, padding: 11, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                {task.status === 'Pending' ? '▶ Start Task' : '✅ Mark Done'}
              </button>
            )}
            {task.status === 'Done' && (
              <button onClick={() => { onStatusChange(task, 'Pending'); onClose() }}
                style={{ flex: 1, background: '#64748b', color: 'white', border: 'none', borderRadius: 10, padding: 11, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>↩ Reopen</button>
            )}
            <button onClick={onClose} style={{ padding: '11px 18px', background: '#f1f5f9', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: '#64748b', fontFamily: 'inherit' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Staff Checklist Row ──────────────────────────────────────────────────────
function StaffChecklistRow({ staffMember, tasks, onAssign, onStatusChange, onDelete, onDetail, onWarn }) {
  const [expanded, setExpanded] = useState(false)
  const overdueTasks = tasks.filter(t => isOverdue(t))
  const done         = tasks.filter(t => t.status === 'Done').length
  const inprog       = tasks.filter(t => t.status === 'In Progress' && !isOverdue(t)).length
  const pending      = tasks.filter(t => t.status === 'Pending' && !isOverdue(t)).length
  const total        = tasks.length
  const hasWarning   = overdueTasks.length > 0

  return (
    <div style={{ borderBottom: '1px solid #f1f5f9' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: expanded ? '#fafbff' : 'white', transition: 'background .1s' }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: hasWarning ? '#fee2e2' : 'linear-gradient(135deg,#1e3a5f,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: hasWarning ? '#dc2626' : '#c9a84c', flexShrink: 0 }}>
          {initials(staffMember.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            {staffMember.name}
            {hasWarning && <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', padding: '2px 7px', borderRadius: 99, fontWeight: 800 }}>🚨 {overdueTasks.length} overdue</span>}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{staffMember.designation} · {staffMember.department}</div>
        </div>
        <div style={{ minWidth: 120 }}>
          <MiniBar done={done} total={total} overdue={overdueTasks.length} />
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#64748b', minWidth: 110, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {done > 0     && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>✅ {done}</span>}
          {inprog > 0   && <span style={{ background: '#f0f9ff', color: '#0369a1', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>🔄 {inprog}</span>}
          {pending > 0  && <span style={{ background: '#eef2ff', color: '#4338ca', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>⏳ {pending}</span>}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onAssign(staffMember)} style={S.btnSm('#6366f1')} title="Assign task">+ Task</button>
          <button onClick={() => onWarn(staffMember)} style={S.btnSm(hasWarning ? '#dc2626' : '#64748b')} title="Send warning">🔔</button>
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded task list */}
      {expanded && (
        <div style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
          {tasks.length === 0
            ? <div style={{ padding: '14px 20px', fontSize: 13, color: '#94a3b8' }}>No tasks assigned. <button onClick={() => onAssign(staffMember)} style={{ ...S.btnSm('#6366f1'), marginLeft: 8 }}>+ Assign now</button></div>
            : tasks.map(t => {
              const ov   = isOverdue(t)
              const diff = daysDiff(t.due_date)
              const sm   = STATUS_META[ov ? 'Overdue' : t.status] || STATUS_META.Pending
              const pm   = PRIORITY_META[t.priority] || PRIORITY_META.Medium
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: '1px solid #f1f5f9', background: ov ? '#fff8f8' : 'white' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: ov ? '#dc2626' : '#1e293b' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {t.department && <span>{t.department}</span>}
                      {t.due_date   && <span style={{ color: ov ? '#dc2626' : diff !== null && diff <= 2 ? '#f59e0b' : '#94a3b8', fontWeight: ov ? 700 : 400 }}>
                        {ov ? `${Math.abs(diff)}d overdue` : diff === 0 ? '⚠ Due today' : diff !== null && diff <= 2 ? `${diff}d left` : fmtDate(t.due_date)}
                      </span>}
                    </div>
                  </div>
                  <Badge label={t.priority} type="priority" />
                  <Badge label={ov ? 'Overdue' : t.status} />
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => onDetail(t)} style={S.btnSm('#6366f1')}>View</button>
                    {t.status !== 'Done' && <button onClick={() => onStatusChange(t, t.status === 'Pending' ? 'In Progress' : 'Done')} style={S.btnSm(t.status === 'Pending' ? '#0ea5e9' : '#16a34a')}>{t.status === 'Pending' ? 'Start' : '✅'}</button>}
                    {t.status === 'Done'  && <button onClick={() => onStatusChange(t, 'Pending')} style={S.btnSm('#64748b')}>↩</button>}
                    <button onClick={() => onDelete(t.id)} style={S.btnSm('#ef4444')}>✕</button>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}
    </div>
  )
}

// ─── Monitoring View ──────────────────────────────────────────────────────────
function MonitoringView({ staff, tasks, onAssign, onWarn }) {
  const tasksWithOverdue = tasks.map(t => ({ ...t, _overdue: isOverdue(t) }))

  const staffMonitor = staff.map(s => {
    const st = tasksWithOverdue.filter(t => t.assigned_to === s.name)
    return { ...s, total: st.length, done: st.filter(t => t.status === 'Done').length, inprog: st.filter(t => t.status === 'In Progress' && !t._overdue).length, pending: st.filter(t => t.status === 'Pending' && !t._overdue).length, overdue: st.filter(t => t._overdue).length }
  }).sort((a, b) => b.overdue - a.overdue || b.total - a.total)

  const deptMap = {}
  tasksWithOverdue.forEach(t => {
    const d = t.department || 'General'
    if (!deptMap[d]) deptMap[d] = { total: 0, done: 0, inprog: 0, pending: 0, overdue: 0 }
    deptMap[d].total++
    if (t.status === 'Done') deptMap[d].done++
    else if (t._overdue) deptMap[d].overdue++
    else if (t.status === 'In Progress') deptMap[d].inprog++
    else deptMap[d].pending++
  })

  const highRisk = staffMonitor.filter(s => s.overdue >= 1)

  return (
    <div>
      {/* High risk panel */}
      {highRisk.length > 0 && (
        <div style={S.card}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 14, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
            🚨 High-Risk Staff
            <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 99, fontSize: 11, padding: '2px 8px' }}>{highRisk.length}</span>
          </div>
          {highRisk.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#dc2626', flexShrink: 0 }}>{initials(s.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#dc2626' }}>{s.overdue} overdue · {s.pending} pending</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onWarn(s)} style={S.btnSm('#dc2626')}>🔔 Warn</button>
                <button onClick={() => onAssign(s)} style={S.btnSm('#6366f1')}>+ Task</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Staff cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14, marginBottom: 16 }}>
        {staffMonitor.map(s => {
          const pct   = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
          const color = s.overdue > 0 ? '#ef4444' : pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#6366f1'
          return (
            <div key={s.id} style={{ background: 'white', borderRadius: 12, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', borderTop: `4px solid ${color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: s.overdue > 0 ? '#fee2e2' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{initials(s.name)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.designation}</div>
                  </div>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color }}>{pct}%</span>
              </div>
              <MiniBar done={s.done} total={s.total} overdue={s.overdue} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 12 }}>
                {[['Done', s.done, '#22c55e'], ['Active', s.inprog, '#0ea5e9'], ['Pending', s.pending, '#f59e0b'], ['Overdue', s.overdue, '#ef4444']].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 8, padding: '8px 4px' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: c }}>{v}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{l}</div>
                  </div>
                ))}
              </div>
              {s.overdue > 0 && <div style={{ marginTop: 10, padding: '7px 10px', background: '#fef2f2', borderRadius: 7, fontSize: 11, color: '#dc2626', fontWeight: 700 }}>🚨 {s.overdue} overdue — follow up required</div>}
            </div>
          )
        })}
      </div>

      {/* Department table */}
      <div style={S.card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>🏢 Department Summary</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>{['Department', 'Total', 'Done', 'In Progress', 'Pending', 'Overdue', 'Rate'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {Object.entries(deptMap).map(([dept, d]) => {
                const rate = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0
                return (
                  <tr key={dept} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{dept}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{d.total}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#22c55e', fontWeight: 700 }}>{d.done}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#0ea5e9', fontWeight: 700 }}>{d.inprog}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>{d.pending}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: d.overdue > 0 ? '#ef4444' : '#94a3b8', fontWeight: d.overdue > 0 ? 700 : 400 }}>{d.overdue}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 99 }}>
                          <div style={{ height: '100%', width: `${rate}%`, background: rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: '#334155', fontSize: 12, minWidth: 32 }}>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {Object.keys(deptMap).length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: 28 }}>No task data available</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function StaffTaskMonitor() {
  const [staff,           setStaff]           = useState([])
  const [tasks,           setTasks]           = useState([])
  const [loading,         setLoading]         = useState(true)
  const [toast,           setToast]           = useState('')
  const [activeView,      setActiveView]      = useState('checklist')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignTarget,    setAssignTarget]    = useState(null)
  const [detailTask,      setDetailTask]      = useState(null)
  const [filterDept,      setFilterDept]      = useState('All')
  const [filterStatus,    setFilterStatus]    = useState('All')
  const [search,          setSearch]          = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase.from('staff_profiles').select('id,name,designation,department,status').eq('status', 'Active').order('name')
    setStaff(data || [])
  }, [])

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('staff_tasks').select('*').order('created_at', { ascending: false })
    if (!error) setTasks(data || [])
    else showToast('⚠️ Could not load tasks. Check staff_tasks table.')
    setLoading(false)
  }, [])

  useEffect(() => { fetchStaff(); fetchTasks() }, [fetchStaff, fetchTasks])

  const handleStatusChange = useCallback(async (task, newStatus) => {
    const update = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'Done') update.completed_at = new Date().toISOString()
    const { data, error } = await supabase.from('staff_tasks').update(update).eq('id', task.id).select()
    if (error) { showToast('❌ Update failed'); return }
    setTasks(prev => prev.map(t => t.id === task.id ? (data?.[0] || t) : t))
    showToast(`✅ Marked as ${newStatus}`)
  }, [])

  const handleDelete = useCallback(async id => {
    if (!window.confirm('Delete this task?')) return
    const { error } = await supabase.from('staff_tasks').delete().eq('id', id)
    if (error) { showToast('❌ Delete failed'); return }
    setTasks(prev => prev.filter(t => t.id !== id))
    showToast('🗑️ Task deleted')
  }, [])

  const handleNewTask = useCallback(task => {
    if (task) setTasks(prev => [task, ...prev])
    showToast('✅ Task assigned!')
  }, [])

  const handleWarn = useCallback(s => {
    const overdueTasks = tasks.filter(t => t.assigned_to === s.name && isOverdue(t))
    if (overdueTasks.length > 0) alert(`⚠️ Warning sent to ${s.name}\n\nOverdue tasks:\n${overdueTasks.map(t => `• ${t.title}`).join('\n')}\n\n(In production, connect to your notification system)`)
    else alert(`🔔 Reminder sent to ${s.name} about pending tasks.\n\n(In production, connect to your notification system)`)
  }, [tasks])

  const tasksWithOverdue = useMemo(() => tasks.map(t => ({ ...t, _overdue: isOverdue(t) })), [tasks])

  const stats = useMemo(() => ({
    total:   tasksWithOverdue.length,
    done:    tasksWithOverdue.filter(t => t.status === 'Done').length,
    inprog:  tasksWithOverdue.filter(t => t.status === 'In Progress' && !t._overdue).length,
    pending: tasksWithOverdue.filter(t => t.status === 'Pending' && !t._overdue).length,
    overdue: tasksWithOverdue.filter(t => t._overdue).length,
    high:    tasksWithOverdue.filter(t => t.priority === 'High' && t.status !== 'Done').length,
  }), [tasksWithOverdue])

  const depts = useMemo(() => ['All', ...new Set(staff.map(s => s.department).filter(Boolean))], [staff])

  const filteredStaff = useMemo(() => {
    let list = staff
    if (filterDept !== 'All') list = list.filter(s => s.department === filterDept)
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.designation || '').toLowerCase().includes(search.toLowerCase()))
    return list
  }, [staff, filterDept, search])

  const getStaffTasks = useCallback(staffName => {
    let list = tasksWithOverdue.filter(t => t.assigned_to === staffName)
    if (filterStatus !== 'All') {
      if (filterStatus === 'Overdue') list = list.filter(t => t._overdue)
      else list = list.filter(t => t.status === filterStatus && !t._overdue)
    }
    return list
  }, [tasksWithOverdue, filterStatus])

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setActiveView(id)} style={{
      padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: 'none', border: 'none',
      borderBottom: `3px solid ${activeView === id ? '#1e3a5f' : 'transparent'}`,
      color: activeView === id ? '#1e3a5f' : '#64748b', fontFamily: 'inherit',
    }}>{label}</button>
  )

  return (
    <div style={S.page}>
      <Toast msg={toast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>📋 Staff Task Monitor</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Checklist · Monitoring · Admin Warnings · GNSI Portal</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { fetchStaff(); fetchTasks() }} style={{ ...S.btn('#64748b'), padding: '9px 16px' }}>🔄 Refresh</button>
          <button onClick={() => { setAssignTarget(null); setShowAssignModal(true) }} style={{ ...S.btn(), background: 'linear-gradient(135deg,#1e3a5f,#6366f1)' }}>＋ Assign Task</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Tasks',   value: stats.total,   color: '#6366f1', icon: '📋' },
          { label: 'Done',          value: stats.done,    color: '#22c55e', icon: '✅' },
          { label: 'In Progress',   value: stats.inprog,  color: '#0ea5e9', icon: '🔄' },
          { label: 'Pending',       value: stats.pending, color: '#f59e0b', icon: '⏳' },
          { label: 'Overdue',       value: stats.overdue, color: '#ef4444', icon: '🚨' },
          { label: 'High Priority', value: stats.high,    color: '#f97316', icon: '🔴' },
        ].map(c => (
          <div key={c.label} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 6px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Admin Alerts */}
      <AlertBanner staff={staff} tasks={tasks} />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 16 }}>
        {tabBtn('checklist',  '✅ Checklist')}
        {tabBtn('monitoring', '📊 Monitoring')}
      </div>

      {/* Checklist View */}
      {activeView === 'checklist' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input style={{ ...S.inp, maxWidth: 260 }} placeholder="🔍 Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ ...S.inp, maxWidth: 180, backgroundColor: 'white' }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              {depts.map(d => <option key={d}>{d}</option>)}
            </select>
            <select style={{ ...S.inp, maxWidth: 180, backgroundColor: 'white' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              {['All', 'Pending', 'In Progress', 'Done', 'Overdue'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={S.card}>
            {loading
              ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading…</div>
              : filteredStaff.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No staff match current filters</div>
              : filteredStaff.map(s => (
                <StaffChecklistRow
                  key={s.id}
                  staffMember={s}
                  tasks={getStaffTasks(s.name)}
                  onAssign={sm => { setAssignTarget(sm); setShowAssignModal(true) }}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onDetail={setDetailTask}
                  onWarn={handleWarn}
                />
              ))
            }
          </div>
        </>
      )}

      {/* Monitoring View */}
      {activeView === 'monitoring' && (
        <MonitoringView
          staff={staff}
          tasks={tasks}
          onAssign={sm => { setAssignTarget(sm); setShowAssignModal(true) }}
          onWarn={handleWarn}
        />
      )}

      {/* Modals */}
      {showAssignModal && (
        <AssignModal
          staffList={staff}
          preselected={assignTarget}
          onClose={() => { setShowAssignModal(false); setAssignTarget(null) }}
          onSave={handleNewTask}
        />
      )}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}