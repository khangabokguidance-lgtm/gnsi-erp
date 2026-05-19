import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── SQL migration hint (run once in Supabase SQL editor) ────────────────────
// create table if not exists staff_tasks (
//   id bigint generated always as identity primary key,
//   title text not null,
//   description text,
//   assigned_to text not null,
//   assigned_by text not null default 'Admin',
//   department text,
//   priority text default 'Medium',
//   status text default 'Pending',
//   due_date date,
//   completion_note text,
//   completed_at timestamptz,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );
// ─────────────────────────────────────────────────────────────────────────────

const STAFF_LIST = [
  'Principal','Vice Principal','Head Teacher','Accounts Manager',
  'Receptionist','Hostel Warden','Science Teacher','Maths Teacher',
  'English Teacher','Hindi Teacher','Librarian','Lab Assistant',
  'Sports Coach','Admin Staff','Peon / Helper',
]

const DEPARTMENTS = ['All','Administration','Academics','Accounts','Hostel','Library','Sports','Support']
const PRIORITIES = ['High','Medium','Low']
const STATUSES = ['Pending','In Progress','Done','Overdue']

const PRIORITY_META = {
  High:   { color: '#ef4444', bg: '#fef2f2', ring: '#fca5a5', icon: '🔴' },
  Medium: { color: '#f59e0b', bg: '#fffbeb', ring: '#fcd34d', icon: '🟡' },
  Low:    { color: '#22c55e', bg: '#f0fdf4', ring: '#86efac', icon: '🟢' },
}

const STATUS_META = {
  Pending:     { color: '#6366f1', bg: '#eef2ff', label: 'Pending',     icon: '⏳' },
  'In Progress': { color: '#0ea5e9', bg: '#f0f9ff', label: 'In Progress', icon: '🔄' },
  Done:        { color: '#16a34a', bg: '#dcfce7', label: 'Done',        icon: '✅' },
  Overdue:     { color: '#dc2626', bg: '#fee2e2', label: 'Overdue',     icon: '🚨' },
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysDiff(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  return diff
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent, sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '20px 22px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${accent}`,
      display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ fontSize: '22px', marginBottom: '2px' }}>{icon}</div>
      <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: accent, fontWeight: '600', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

// ─── Staff Performance Bar ────────────────────────────────────────────────────
function StaffBar({ name, tasks, done, overdue }) {
  const pct = tasks > 0 ? Math.round((done / tasks) * 100) : 0
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{name}</span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{done}/{tasks} done {overdue > 0 && <span style={{ color: '#ef4444', fontWeight: '700' }}>· {overdue} overdue</span>}</span>
      </div>
      <div style={{ height: '8px', borderRadius: '99px', background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '99px', background: overdue > 0 ? 'linear-gradient(90deg,#ef4444,#f97316)' : 'linear-gradient(90deg,#6366f1,#0ea5e9)', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onStatusChange, onDelete, onViewDetail }) {
  const diff = daysDiff(task.due_date)
  const isOverdue = diff !== null && diff < 0 && task.status !== 'Done'
  const sm = STATUS_META[isOverdue ? 'Overdue' : task.status] || STATUS_META.Pending
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.Medium

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <td style={td}>
        <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px', marginBottom: '2px' }}>{task.title}</div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{task.department || 'General'}</div>
      </td>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
            {task.assigned_to?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>{task.assigned_to}</span>
        </div>
      </td>
      <td style={td}>
        <span style={{ ...badge, background: pm.bg, color: pm.color }}>
          {pm.icon} {task.priority}
        </span>
      </td>
      <td style={td}>
        <span style={{ ...badge, background: sm.bg, color: sm.color }}>
          {sm.icon} {isOverdue ? 'Overdue' : task.status}
        </span>
      </td>
      <td style={td}>
        {task.due_date ? (
          <div>
            <div style={{ fontSize: '13px', color: isOverdue ? '#ef4444' : '#334155', fontWeight: isOverdue ? '700' : '400' }}>{formatDate(task.due_date)}</div>
            {diff !== null && task.status !== 'Done' && (
              <div style={{ fontSize: '11px', color: isOverdue ? '#ef4444' : diff <= 2 ? '#f59e0b' : '#94a3b8' }}>
                {isOverdue ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today!' : `${diff}d left`}
              </div>
            )}
          </div>
        ) : '—'}
      </td>
      <td style={td}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => onViewDetail(task)} style={{ ...actionBtn, background: '#6366f1' }}>View</button>
          {task.status !== 'Done' && (
            <button onClick={() => onStatusChange(task, task.status === 'Pending' ? 'In Progress' : 'Done')}
              style={{ ...actionBtn, background: task.status === 'Pending' ? '#0ea5e9' : '#16a34a' }}>
              {task.status === 'Pending' ? 'Start' : 'Done'}
            </button>
          )}
          {task.status === 'Done' && (
            <button onClick={() => onStatusChange(task, 'Pending')} style={{ ...actionBtn, background: '#64748b' }}>Reopen</button>
          )}
          <button onClick={() => onDelete(task.id)} style={{ ...actionBtn, background: '#ef4444' }}>✕</button>
        </div>
      </td>
    </tr>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────
function TaskDetailModal({ task, onClose, onStatusChange }) {
  const [note, setNote] = useState(task.completion_note || '')
  const [saving, setSaving] = useState(false)
  const diff = daysDiff(task.due_date)
  const isOverdue = diff !== null && diff < 0 && task.status !== 'Done'
  const sm = STATUS_META[isOverdue ? 'Overdue' : task.status] || STATUS_META.Pending
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.Medium

  async function saveNote() {
    setSaving(true)
    await supabase.from('staff_tasks').update({ completion_note: note, updated_at: new Date().toISOString() }).eq('id', task.id)
    setSaving(false)
    alert('Note saved!')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#0ea5e9)', padding: '24px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '1px', opacity: 0.7, marginBottom: '6px', textTransform: 'uppercase' }}>Task Detail</div>
              <div style={{ fontSize: '20px', fontWeight: '700', lineHeight: 1.3 }}>{task.title}</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {[
              { label: 'Assigned To', value: task.assigned_to },
              { label: 'Assigned By', value: task.assigned_by || 'Admin' },
              { label: 'Department', value: task.department || 'General' },
              { label: 'Due Date', value: formatDate(task.due_date) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>{value || '—'}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <span style={{ ...badge, background: pm.bg, color: pm.color, fontSize: '13px', padding: '6px 14px' }}>{pm.icon} {task.priority} Priority</span>
            <span style={{ ...badge, background: sm.bg, color: sm.color, fontSize: '13px', padding: '6px 14px' }}>{sm.icon} {isOverdue ? 'Overdue' : task.status}</span>
          </div>

          {task.description && (
            <div style={{ marginBottom: '16px', background: '#f8fafc', borderRadius: '10px', padding: '14px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
              {task.description}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Completion Note / Remarks</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Add progress note or remarks..."
              style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <button onClick={saveNote} disabled={saving} style={{ marginTop: '8px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              {saving ? 'Saving…' : 'Save Note'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {task.status !== 'Done' && (
              <button onClick={() => { onStatusChange(task, task.status === 'Pending' ? 'In Progress' : 'Done'); onClose() }}
                style={{ flex: 1, background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>
                {task.status === 'Pending' ? '▶ Start Task' : '✅ Mark as Done'}
              </button>
            )}
            {task.status === 'Done' && (
              <button onClick={() => { onStatusChange(task, 'Pending'); onClose() }}
                style={{ flex: 1, background: '#64748b', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>
                ↩ Reopen Task
              </button>
            )}
            <button onClick={onClose} style={{ padding: '12px 20px', background: '#f1f5f9', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#64748b' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Task Modal ────────────────────────────────────────────────────────
function AssignModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', description: '', assigned_to: STAFF_LIST[0], assigned_by: 'Admin', department: 'Administration', priority: 'Medium', status: 'Pending', due_date: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.title || !form.assigned_to) { alert('Title and Assigned To are required'); return }
    setSaving(true)
    const { data, error } = await supabase.from('staff_tasks').insert([{ ...form, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]).select()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSave(data?.[0])
    onClose()
  }

  const f = (label, children) => (
    <div key={label}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '620px', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#6366f1)', padding: '22px 28px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.7, letterSpacing: '1px', textTransform: 'uppercase' }}>GNSI Portal</div>
            <div style={{ fontSize: '20px', fontWeight: '800' }}>Assign New Task</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '8px', width: '34px', height: '34px', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        <div style={{ padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {f('Task Title', <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Update student fee records" style={inp} />)}
          {f('Description / Instructions', <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Detailed instructions..." style={{ ...inp, resize: 'vertical', height: '70px' }} />)}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {f('Assign To', (
              <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} style={inp}>
                {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
            ))}
            {f('Assigned By', <input value={form.assigned_by} onChange={e => setForm({ ...form, assigned_by: e.target.value })} style={inp} />)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {f('Department', (
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={inp}>
                {DEPARTMENTS.filter(d => d !== 'All').map(d => <option key={d}>{d}</option>)}
              </select>
            ))}
            {f('Priority', (
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inp}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            ))}
            {f('Due Date', <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={inp} />)}
          </div>
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '12px' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, background: 'linear-gradient(135deg,#1e3a5f,#6366f1)', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', cursor: 'pointer', fontWeight: '800', fontSize: '15px', letterSpacing: '0.3px' }}>
            {saving ? '⏳ Assigning…' : '✅ Assign Task'}
          </button>
          <button onClick={onClose} style={{ padding: '14px 24px', background: '#f1f5f9', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', color: '#64748b' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StaffTaskMonitor() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [view, setView] = useState('tasks') // 'tasks' | 'monitoring'
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [detailTask, setDetailTask] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')
  const [filterStaff, setFilterStaff] = useState('All')
  const [filterDept, setFilterDept] = useState('All')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    setLoading(true)
    const { data, error } = await supabase.from('staff_tasks').select('*').order('created_at', { ascending: false })
    if (!error) setTasks(data || [])
    else showToast('⚠️ Could not load tasks. Check if staff_tasks table exists.')
    setLoading(false)
  }

  async function handleStatusChange(task, newStatus) {
    const update = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'Done') update.completed_at = new Date().toISOString()
    const { data, error } = await supabase.from('staff_tasks').update(update).eq('id', task.id).select()
    if (error) { showToast('❌ Update failed'); return }
    setTasks(prev => prev.map(t => t.id === task.id ? (data?.[0] || t) : t))
    showToast(`✅ Task marked as ${newStatus}`)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this task?')) return
    const { error } = await supabase.from('staff_tasks').delete().eq('id', id)
    if (error) { showToast('❌ Delete failed'); return }
    setTasks(prev => prev.filter(t => t.id !== id))
    showToast('🗑️ Task deleted')
  }

  function handleNewTask(task) {
    if (task) setTasks(prev => [task, ...prev])
    showToast('✅ Task assigned successfully!')
  }

  // Auto-detect overdue
  const tasksWithOverdue = useMemo(() => tasks.map(t => {
    const diff = daysDiff(t.due_date)
    if (diff !== null && diff < 0 && t.status !== 'Done') return { ...t, _overdue: true }
    return { ...t, _overdue: false }
  }), [tasks])

  const filteredTasks = useMemo(() => tasksWithOverdue.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || (t.title || '').toLowerCase().includes(q) || (t.assigned_to || '').toLowerCase().includes(q) || (t.department || '').toLowerCase().includes(q)
    const effectiveStatus = t._overdue ? 'Overdue' : t.status
    const matchStatus = filterStatus === 'All' || effectiveStatus === filterStatus
    const matchPriority = filterPriority === 'All' || t.priority === filterPriority
    const matchStaff = filterStaff === 'All' || t.assigned_to === filterStaff
    const matchDept = filterDept === 'All' || t.department === filterDept
    return matchSearch && matchStatus && matchPriority && matchStaff && matchDept
  }), [tasksWithOverdue, search, filterStatus, filterPriority, filterStaff, filterDept])

  // Stats
  const stats = useMemo(() => {
    const all = tasksWithOverdue
    return {
      total: all.length,
      done: all.filter(t => t.status === 'Done').length,
      inProgress: all.filter(t => t.status === 'In Progress').length,
      pending: all.filter(t => t.status === 'Pending').length,
      overdue: all.filter(t => t._overdue).length,
      high: all.filter(t => t.priority === 'High').length,
      completionRate: all.length > 0 ? Math.round((all.filter(t => t.status === 'Done').length / all.length) * 100) : 0,
    }
  }, [tasksWithOverdue])

  // Staff monitoring data
  const staffMonitor = useMemo(() => {
    const map = {}
    tasksWithOverdue.forEach(t => {
      if (!map[t.assigned_to]) map[t.assigned_to] = { name: t.assigned_to, total: 0, done: 0, inProgress: 0, pending: 0, overdue: 0 }
      map[t.assigned_to].total++
      if (t.status === 'Done') map[t.assigned_to].done++
      else if (t.status === 'In Progress') map[t.assigned_to].inProgress++
      else map[t.assigned_to].pending++
      if (t._overdue) map[t.assigned_to].overdue++
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [tasksWithOverdue])

  const activeStaff = STAFF_LIST.filter(s => tasksWithOverdue.some(t => t.assigned_to === s))

  const tabBtn = (id, label, icon) => (
    <button onClick={() => setView(id)} style={{
      padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
      fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px',
      background: view === id ? 'linear-gradient(135deg,#1e3a5f,#6366f1)' : '#f1f5f9',
      color: view === id ? '#fff' : '#64748b', transition: 'all 0.2s'
    }}>{icon} {label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0f1e3c,#1e3a5f)', padding: '24px 28px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '2px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '4px' }}>GNSI — Guidance Navodaya & Sainik Institute</div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>📋 Staff Task Monitor</h1>
            <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>Advanced Task Assignment & Monitoring System</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={fetchTasks} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>🔄 Refresh</button>
            <button onClick={() => setShowAssignModal(true)} style={{ background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
              ＋ Assign Task
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 2000, background: '#1e293b', color: '#fff', padding: '14px 20px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontSize: '14px', fontWeight: '600', animation: 'fadeIn 0.2s ease' }}>
          {toast}
        </div>
      )}

      <div style={{ padding: '24px 28px' }}>
        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Total Tasks" value={stats.total} icon="📋" accent="#6366f1" />
          <StatCard label="Completed" value={stats.done} icon="✅" accent="#22c55e" sub={`${stats.completionRate}% rate`} />
          <StatCard label="In Progress" value={stats.inProgress} icon="🔄" accent="#0ea5e9" />
          <StatCard label="Pending" value={stats.pending} icon="⏳" accent="#f59e0b" />
          <StatCard label="Overdue" value={stats.overdue} icon="🚨" accent="#ef4444" sub={stats.overdue > 0 ? 'Needs attention' : 'All on track'} />
          <StatCard label="High Priority" value={stats.high} icon="🔴" accent="#f97316" />
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {tabBtn('tasks', 'Task List', '📝')}
          {tabBtn('monitoring', 'Staff Monitor', '📊')}
        </div>

        {/* ─── TASK LIST VIEW ─── */}
        {view === 'tasks' && (
          <>
            {/* Filters */}
            <div style={{ background: '#fff', borderRadius: '14px', padding: '18px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '14px' }}>
                <div>
                  <label style={lbl}>🔍 Search</label>
                  <input style={inp} value={search} onChange={e => setSearch(e.target.value)} placeholder="Title, staff, dept..." />
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option>All</option>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select style={inp} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                    <option>All</option>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Staff Member</label>
                  <select style={inp} value={filterStaff} onChange={e => setFilterStaff(e.target.value)}>
                    <option>All</option>
                    {activeStaff.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Department</label>
                  <select style={inp} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Task Assignments</h2>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
              </div>
              {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
                  Loading tasks...
                  <div style={{ fontSize: '12px', marginTop: '8px', color: '#cbd5e1' }}>
                    Make sure the <code>staff_tasks</code> table exists in Supabase
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Task', 'Assigned To', 'Priority', 'Status', 'Due Date', 'Actions'].map(h => (
                          <th key={h} style={{ ...th }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(task => (
                        <TaskRow key={task.id} task={task}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                          onViewDetail={setDetailTask}
                        />
                      ))}
                      {filteredTasks.length === 0 && (
                        <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                          No tasks found. Assign a new task to get started.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── MONITORING VIEW ─── */}
        {view === 'monitoring' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Staff Performance */}
            <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', gridColumn: '1 / -1' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>👥 Staff Performance Overview</h2>
              {staffMonitor.length === 0
                ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>No data yet. Assign tasks to staff members.</div>
                : staffMonitor.map(s => <StaffBar key={s.name} name={s.name} tasks={s.total} done={s.done} overdue={s.overdue} />)
              }
            </div>

            {/* Staff Cards */}
            {staffMonitor.map(s => {
              const rate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
              const color = rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444'
              return (
                <div key={s.name} style={{ background: '#fff', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderTop: `4px solid ${color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>{s.name}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{s.total} tasks assigned</div>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color }}>
                      {rate}%
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                    {[
                      { label: 'Done', value: s.done, color: '#22c55e' },
                      { label: 'In Prog', value: s.inProgress, color: '#0ea5e9' },
                      { label: 'Pending', value: s.pending, color: '#f59e0b' },
                      { label: 'Overdue', value: s.overdue, color: '#ef4444' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: '800', color }}>{value}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {s.overdue > 0 && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
                      🚨 {s.overdue} overdue task{s.overdue > 1 ? 's' : ''} — immediate attention required
                    </div>
                  )}
                </div>
              )
            })}

            {/* Department Summary */}
            <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', gridColumn: '1 / -1' }}>
              <h2 style={{ margin: '0 0 18px', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>🏢 Department-wise Summary</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Department', 'Total', 'Done', 'In Progress', 'Pending', 'Overdue', 'Completion %'].map(h => (
                        <th key={h} style={{ ...th, fontSize: '12px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const deptMap = {}
                      tasksWithOverdue.forEach(t => {
                        const d = t.department || 'General'
                        if (!deptMap[d]) deptMap[d] = { total: 0, done: 0, inProgress: 0, pending: 0, overdue: 0 }
                        deptMap[d].total++
                        if (t.status === 'Done') deptMap[d].done++
                        else if (t.status === 'In Progress') deptMap[d].inProgress++
                        else deptMap[d].pending++
                        if (t._overdue) deptMap[d].overdue++
                      })
                      return Object.entries(deptMap).map(([dept, d]) => {
                        const rate = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0
                        return (
                          <tr key={dept} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={td}><strong>{dept}</strong></td>
                            <td style={{ ...td, textAlign: 'center' }}>{d.total}</td>
                            <td style={{ ...td, textAlign: 'center', color: '#22c55e', fontWeight: '700' }}>{d.done}</td>
                            <td style={{ ...td, textAlign: 'center', color: '#0ea5e9', fontWeight: '700' }}>{d.inProgress}</td>
                            <td style={{ ...td, textAlign: 'center', color: '#f59e0b', fontWeight: '700' }}>{d.pending}</td>
                            <td style={{ ...td, textAlign: 'center', color: d.overdue > 0 ? '#ef4444' : '#94a3b8', fontWeight: d.overdue > 0 ? '700' : '400' }}>{d.overdue}</td>
                            <td style={td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '6px', borderRadius: '99px', background: '#e2e8f0' }}>
                                  <div style={{ height: '100%', width: `${rate}%`, borderRadius: '99px', background: rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span style={{ fontWeight: '700', color: '#334155', minWidth: '32px' }}>{rate}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                    {tasksWithOverdue.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAssignModal && <AssignModal onClose={() => setShowAssignModal(false)} onSave={handleNewTask} />}
      {detailTask && <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} onStatusChange={handleStatusChange} />}

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#fff', boxSizing: 'border-box', color: '#1e293b', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }
const th  = { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: '700', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }
const td  = { padding: '14px 16px', verticalAlign: 'middle', color: '#334155' }
const badge = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' }
const actionBtn = { color: '#fff', border: 'none', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' }