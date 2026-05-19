import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const ALL_MODULES = [
  { key: 'students',      label: 'Students',       icon: '🎓' },
  { key: 'admissions',    label: 'Admissions',      icon: '📋' },
  { key: 'bulkadmission', label: 'Bulk Admission',  icon: '📦' },
  { key: 'fees',          label: 'Fees',            icon: '💰' },
  { key: 'accounts',      label: 'Accounts',        icon: '📊' },
  { key: 'salary',        label: 'Salary',          icon: '💵' },
  { key: 'attendance',    label: 'Attendance',      icon: '✅' },
  { key: 'exams',         label: 'Exams',           icon: '📝' },
  { key: 'timetable',     label: 'Timetable',       icon: '🗓️' },
  { key: 'teaching',      label: 'Teaching',        icon: '📖' },
  { key: 'staff',         label: 'Staff',           icon: '👤' },
  { key: 'hr',            label: 'HR',              icon: '🏢' },
  { key: 'leave',         label: 'Leave',           icon: '🌿' },
  { key: 'hostel',        label: 'Hostel',          icon: '🏠' },
  { key: 'reception',     label: 'Reception',       icon: '🔔' },
  { key: 'notice',        label: 'Notice',          icon: '📢' },
  { key: 'social',        label: 'Social',          icon: '💬' },
  { key: 'connect',       label: 'Connect',         icon: '🔗' },
  { key: 'courses',       label: 'Courses',         icon: '📚' },
  { key: 'reports',       label: 'Reports',         icon: '📈' },
  { key: 'checklist',     label: 'Checklist',       icon: '☑️' },
  { key: 'system',        label: 'System',          icon: '⚙️' },
]

const ALL_ROLES = [
  'Teacher','Staff','Faculty','House Master','Accountant',
  'Computer Staffs','Administrator','Hostel Supervisor',
  'Superintendent','Non Teaching Staffs','Receptionist',
]

const NAV = [
  { id: 'users',       icon: '👥', label: 'User Management'   },
  { id: 'permissions', icon: '🛡️', label: 'Role Permissions'  },
  { id: 'overrides',   icon: '⚡', label: 'User Overrides'    },
  { id: 'analytics',   icon: '📊', label: 'Module Analytics'  },
  { id: 'accesslogs',  icon: '🗂️', label: 'Access Logs'       },
  { id: 'password',    icon: '🔑', label: 'Change Password'   },
  { id: 'audit',       icon: '📋', label: 'Audit Logs'        },
]

// ─────────────────────────────────────────────
//  SHARED UI
// ─────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{
        display: 'inline-block', width: 28, height: 28,
        border: '3px solid #E5E7EB', borderTopColor: '#1e3a5f',
        borderRadius: '50%', animation: 'adm-spin .7s linear infinite',
      }} />
      <style>{`@keyframes adm-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ErrBox({ msg }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 16 }}>
      🚨 {msg}
    </div>
  )
}

function SuccessBox({ msg }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontSize: 13, marginBottom: 16 }}>
      ✅ {msg}
    </div>
  )
}

function Badge({ label, color = '#1D4ED8', bg = '#EFF6FF', border = '#BFDBFE' }) {
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function RoleBadge({ role }) {
  const colors = {
    'Teacher':             { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
    'Staff':               { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
    'Faculty':             { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    'House Master':        { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
    'Accountant':          { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
    'Computer Staffs':     { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
    'Administrator':       { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
    'Hostel Supervisor':   { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
    'Superintendent':      { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
    'Non Teaching Staffs': { bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' },
    'Receptionist':        { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3' },
  }
  const c = colors[role] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
  return <Badge label={role} color={c.text} bg={c.bg} border={c.border} />
}

async function logAudit(action, currentUser) {
  await supabase.from('audit_logs').insert({
    user_name: currentUser?.username ?? 'Admin',
    action, module: 'Admin', level: 'info', metadata: {},
  })
}

// ─────────────────────────────────────────────
//  CHANGE PASSWORD
// ─────────────────────────────────────────────
function ChangePasswordSection({ currentUser }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(false)
  const [isChanged, setIsChanged] = useState(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('admin_credentials').select('is_changed').eq('id', 1).single()
      setIsChanged(data?.is_changed ?? false)
    })()
  }, [])

  const handleChange = async () => {
    setError(null); setSuccess(false)
    if (!current || !newPass || !confirm) { setError('All fields are required.'); return }
    if (newPass.length < 6) { setError('New password must be at least 6 characters.'); return }
    if (newPass !== confirm) { setError('New passwords do not match.'); return }
    setSaving(true)
    const { data: creds } = await supabase.from('admin_credentials').select('password_hash,is_changed').eq('id', 1).single()
    const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD
    const validCurrent = creds.is_changed ? current === creds.password_hash : current === ADMIN_PASS
    if (!validCurrent) { setError('Current password is incorrect.'); setSaving(false); return }
    if (newPass === ADMIN_PASS) { setError('New password cannot be the default password.'); setSaving(false); return }
    const { error: updateErr } = await supabase.from('admin_credentials').update({ password_hash: newPass, is_changed: true, updated_at: new Date().toISOString() }).eq('id', 1)
    if (updateErr) { setError(updateErr.message); setSaving(false); return }
    await logAudit('Admin changed their password', currentUser)
    setIsChanged(true); setSuccess(true)
    setCurrent(''); setNewPass(''); setConfirm('')
    setSaving(false)
  }

  if (isChanged === null) return <Spinner />
  const inp = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1.5px solid #E2E8F0', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ padding: '14px 18px', borderRadius: 10, background: isChanged ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${isChanged ? '#BBF7D0' : '#FED7AA'}`, marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 13, color: isChanged ? '#166534' : '#9A3412', fontWeight: 600 }}>
          {isChanged ? '🔐 Password has been changed. The default .env password is permanently disabled.' : '⚠️ You are using the default password. Change it now to secure your account.'}
        </p>
      </div>
      {error && <ErrBox msg={error} />}
      {success && <SuccessBox msg="Password changed successfully." />}
      {[
        { label: 'Current Password', value: current, set: setCurrent, ph: 'Enter current password' },
        { label: 'New Password', value: newPass, set: setNewPass, ph: 'Min. 6 characters' },
        { label: 'Confirm New Password', value: confirm, set: setConfirm, ph: 'Repeat new password' },
      ].map(f => (
        <div key={f.label}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{f.label}</label>
          <input type="password" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inp} />
        </div>
      ))}
      <button onClick={handleChange} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#93C5FD' : '#1e3a5f', color: 'white' }}>
        {saving ? '⏳ Updating…' : '🔑 Change Password'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
//  USER MODAL
// ─────────────────────────────────────────────
function UserModal({ existing, onClose, onSaved, currentUser }) {
  const isEdit = !!existing
  const [form, setForm] = useState({ name: existing?.name ?? '', username: existing?.username ?? '', password: '', role: existing?.role ?? 'Teacher' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async () => {
    if (!form.name || !form.username) { setErr('Name and username are required.'); return }
    if (!isEdit && !form.password) { setErr('Password is required.'); return }
    setSaving(true); setErr(null)
    if (isEdit) {
      const update = { name: form.name, role: form.role, updated_at: new Date().toISOString() }
      if (form.password) update.password_hash = form.password
      const { error } = await supabase.from('portal_users').update(update).eq('id', existing.id)
      if (error) { setErr(error.message); setSaving(false); return }
      await logAudit(`Updated user: ${form.name}`, currentUser)
    } else {
      const { error } = await supabase.from('portal_users').insert({ name: form.name, username: form.username, password_hash: form.password, role: form.role, active: true })
      if (error) { setErr(error.message); setSaving(false); return }
      await logAudit(`Added user: ${form.name} (${form.role})`, currentUser)
    }
    onSaved(); onClose()
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }
  const box = { background: 'white', borderRadius: 14, padding: 28, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }
  const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14, border: '1px solid #D1D5DB', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{isEdit ? 'Edit User' : 'Add New User'}</h3>
        {err && <ErrBox msg={err} />}
        {[
          { label: 'Full Name *', k: 'name', type: 'text', ph: 'e.g. Priya Devi', disabled: false },
          { label: 'Username *', k: 'username', type: 'text', ph: 'priya_devi', disabled: isEdit },
          { label: isEdit ? 'New Password (leave blank to keep)' : 'Password *', k: 'password', type: 'password', ph: '••••••••', disabled: false },
        ].map(f => (
          <div key={f.k}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>{f.label}</label>
            <input style={{ ...inp, opacity: f.disabled ? .6 : 1 }} type={f.type} disabled={f.disabled} value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph} />
          </div>
        ))}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Role</label>
        <select style={{ ...inp, marginBottom: 20 }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: saving ? '#93C5FD' : '#1D4ED8', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  USERS SECTION
// ─────────────────────────────────────────────
function UsersSection({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('All')
  const [deleting, setDeleting] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('portal_users').select('id,name,username,role,active,created_at').order('name')
    if (error) setError(error.message)
    else setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const toggleActive = async (user) => {
    const newVal = !user.active
    await supabase.from('portal_users').update({ active: newVal }).eq('id', user.id)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: newVal } : u))
    await logAudit(`${newVal ? 'Enabled' : 'Disabled'} user: ${user.name}`, currentUser)
  }

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) return
    setDeleting(user.id)
    await supabase.from('portal_users').delete().eq('id', user.id)
    setUsers(prev => prev.filter(u => u.id !== user.id))
    await logAudit(`Deleted user: ${user.name}`, currentUser)
    setDeleting(null)
  }

  const filtered = filter === 'All' ? users : users.filter(u => u.role === filter)
  if (loading) return <Spinner />
  if (error) return <ErrBox msg={error} />

  return (
    <div>
      {modal && <UserModal existing={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={fetchUsers} currentUser={currentUser} />}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', ...ALL_ROLES].map(r => (
          <button key={r} onClick={() => setFilter(r)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: filter === r ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: filter === r ? '#EFF6FF' : 'white', color: filter === r ? '#1D4ED8' : '#374151', fontWeight: filter === r ? 600 : 400, whiteSpace: 'nowrap' }}>{r}</button>
        ))}
        <button onClick={() => setModal('add')} style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#1D4ED8', color: 'white', border: 'none', fontWeight: 600 }}>+ Add User</button>
      </div>
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Name','Username','Role','Status','Created','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1D4ED8', flexShrink: 0 }}>
                      {(u.name || '?').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    {u.name}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#6B7280' }}>{u.username}</td>
                <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.active ? '#22C55E' : '#9CA3AF', display: 'inline-block' }} />
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#9CA3AF', fontSize: 12 }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setModal(u)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #E5E7EB', background: 'white' }}>Edit</button>
                    <button onClick={() => toggleActive(u)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #E5E7EB', background: 'white', color: u.active ? '#b45309' : '#16a34a' }}>{u.active ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => deleteUser(u)} disabled={deleting === u.id} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626' }}>{deleting === u.id ? '…' : 'Delete'}</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No users found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  ROLE PERMISSIONS
// ─────────────────────────────────────────────
function PermissionsSection({ currentUser }) {
  const [role, setRole] = useState('Teacher')
  const [perms, setPerms] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchPerms = useCallback(async (r) => {
    setLoading(true)
    const { data } = await supabase.from('role_permissions').select('module_key,allowed').eq('role', r)
    const map = {}
    ;(data || []).forEach(p => { map[p.module_key] = p.allowed })
    setPerms(map)
    setLoading(false)
  }, [])

  useEffect(() => { fetchPerms(role) }, [role, fetchPerms])

  const toggle = (key) => setPerms(p => ({ ...p, [key]: !p[key] }))
  const selectAll = () => setPerms(Object.fromEntries(ALL_MODULES.map(m => [m.key, true])))
  const clearAll = () => setPerms(Object.fromEntries(ALL_MODULES.map(m => [m.key, false])))

  const savePerms = async () => {
    setSaving(true)
    await Promise.all(ALL_MODULES.map(m => supabase.from('role_permissions').update({ allowed: perms[m.key] ?? false }).eq('role', role).eq('module_key', m.key)))
    await logAudit(`Updated permissions for role: ${role}`, currentUser)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {ALL_ROLES.map(r => (
          <button key={r} onClick={() => setRole(r)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: role === r ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: role === r ? '#EFF6FF' : 'white', color: role === r ? '#1D4ED8' : '#374151', fontWeight: role === r ? 700 : 400, whiteSpace: 'nowrap' }}>{r}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={selectAll} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #E5E7EB', background: 'white' }}>Select All</button>
          <button onClick={clearAll} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #E5E7EB', background: 'white' }}>Clear All</button>
          <button onClick={savePerms} disabled={saving} style={{ padding: '6px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: 'none', background: saved ? '#16A34A' : saving ? '#93C5FD' : '#1D4ED8', color: 'white', fontWeight: 600 }}>
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {loading ? <Spinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {ALL_MODULES.map(m => (
            <div key={m.key} onClick={() => toggle(m.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', border: perms[m.key] ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: perms[m.key] ? '#EFF6FF' : 'white', transition: 'all .15s' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: perms[m.key] ? '#1D4ED8' : 'white', border: perms[m.key] ? 'none' : '1.5px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {perms[m.key] && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: perms[m.key] ? 600 : 400, color: perms[m.key] ? '#1D4ED8' : '#374151' }}>
                {m.icon} {m.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  ⚡ PER-USER MODULE OVERRIDES  (NEW)
// ─────────────────────────────────────────────
// SQL to run once:
// CREATE TABLE IF NOT EXISTS user_module_overrides (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id    uuid REFERENCES portal_users(id) ON DELETE CASCADE,
//   module_key text NOT NULL,
//   allowed    boolean NOT NULL,
//   reason     text,
//   set_by     text,
//   created_at timestamptz DEFAULT now(),
//   UNIQUE(user_id, module_key)
// );
function OverridesSection({ currentUser }) {
  const [users,     setUsers]     = useState([])
  const [selUser,   setSelUser]   = useState(null)
  const [rolePerms, setRolePerms] = useState({})
  const [overrides, setOverrides] = useState({})
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(null)
  const [reason,    setReason]    = useState('')
  const [toast,     setToast]     = useState(null)

  useEffect(() => {
    supabase.from('portal_users').select('id,name,username,role,active').order('name').then(({ data }) => setUsers(data || []))
  }, [])

  const loadUser = useCallback(async (user) => {
    setSelUser(user); setLoading(true)
    const [{ data: rp }, { data: ov }] = await Promise.all([
      supabase.from('role_permissions').select('module_key,allowed').eq('role', user.role),
      supabase.from('user_module_overrides').select('module_key,allowed,reason').eq('user_id', user.id),
    ])
    const rmap = {}; (rp || []).forEach(p => { rmap[p.module_key] = p.allowed })
    const omap = {}; (ov || []).forEach(o => { omap[o.module_key] = { allowed: o.allowed, reason: o.reason } })
    setRolePerms(rmap); setOverrides(omap); setLoading(false)
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const applyOverride = async (moduleKey, allowed) => {
    if (!selUser) return
    setSaving(moduleKey)
    const payload = { user_id: selUser.id, module_key: moduleKey, allowed, reason: reason || null, set_by: currentUser?.username ?? 'Admin' }
    await supabase.from('user_module_overrides').upsert(payload, { onConflict: 'user_id,module_key' })
    setOverrides(prev => ({ ...prev, [moduleKey]: { allowed, reason } }))
    await logAudit(`Override: ${selUser.name} → ${moduleKey} = ${allowed ? 'GRANTED' : 'DENIED'}`, currentUser)
    showToast(`${allowed ? '🔓 Granted' : '🔒 Denied'} ${moduleKey} for ${selUser.name}`)
    setSaving(null)
  }

  const removeOverride = async (moduleKey) => {
    if (!selUser) return
    setSaving(moduleKey)
    await supabase.from('user_module_overrides').delete().eq('user_id', selUser.id).eq('module_key', moduleKey)
    setOverrides(prev => { const n = { ...prev }; delete n[moduleKey]; return n })
    await logAudit(`Removed override: ${selUser.name} → ${moduleKey}`, currentUser)
    showToast(`↩️ Override removed for ${moduleKey}`)
    setSaving(null)
  }

  const effectiveAccess = (key) => {
    if (key in overrides) return { source: 'override', allowed: overrides[key].allowed }
    return { source: 'role', allowed: rolePerms[key] ?? false }
  }

  return (
    <div style={{ display: 'flex', gap: 24, minHeight: 600 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 32, right: 32, background: '#1e3a5f', color: 'white', padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', animation: 'adm-fadein .2s ease' }}>
          {toast}
        </div>
      )}
      <style>{`@keyframes adm-fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      {/* User list */}
      <div style={{ width: 260, flexShrink: 0, border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start' }}>
        <div style={{ padding: '10px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '.04em' }}>SELECT USER</div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {users.map(u => (
            <div key={u.id} onClick={() => loadUser(u)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', background: selUser?.id === u.id ? '#EFF6FF' : 'white', borderLeft: selUser?.id === u.id ? '3px solid #1D4ED8' : '3px solid transparent', transition: 'all .12s' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: selUser?.id === u.id ? '#1D4ED8' : '#111827' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{u.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Override editor */}
      <div style={{ flex: 1 }}>
        {!selUser ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', border: '2px dashed #E5E7EB', borderRadius: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚡</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Select a user to manage their module overrides</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Overrides take effect immediately and bypass role permissions</div>
          </div>
        ) : loading ? <Spinner /> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E5E7EB' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#1D4ED8' }}>
                {selUser.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selUser.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{selUser.username} · <RoleBadge role={selUser.role} /></div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' }}>
                {Object.keys(overrides).length} override{Object.keys(overrides).length !== 1 ? 's' : ''} active
              </div>
            </div>

            {/* Reason field */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Reason for override (optional)</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Temporary access for audit" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid #D1D5DB', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {ALL_MODULES.map(m => {
                const eff = effectiveAccess(m.key)
                const hasOverride = m.key in overrides
                const isSaving = saving === m.key
                return (
                  <div key={m.key} style={{ padding: '12px 14px', borderRadius: 10, border: hasOverride ? `2px solid ${overrides[m.key].allowed ? '#16A34A' : '#DC2626'}` : '1px solid #E5E7EB', background: hasOverride ? (overrides[m.key].allowed ? '#F0FDF4' : '#FEF2F2') : 'white', position: 'relative', transition: 'all .15s' }}>
                    {hasOverride && (
                      <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, fontWeight: 700, color: overrides[m.key].allowed ? '#16A34A' : '#DC2626' }}>
                        {overrides[m.key].allowed ? '🔓 OVERRIDE GRANT' : '🔒 OVERRIDE DENY'}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>{m.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                          Role default: <span style={{ color: rolePerms[m.key] ? '#16A34A' : '#9CA3AF', fontWeight: 600 }}>{rolePerms[m.key] ? 'Allowed' : 'Denied'}</span>
                          {hasOverride && overrides[m.key].reason && <span> · "{overrides[m.key].reason}"</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => applyOverride(m.key, true)} disabled={isSaving} style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: eff.source === 'override' && eff.allowed ? '#16A34A' : '#E5E7EB', color: eff.source === 'override' && eff.allowed ? 'white' : '#374151' }}>
                        {isSaving ? '…' : '🔓 Grant'}
                      </button>
                      <button onClick={() => applyOverride(m.key, false)} disabled={isSaving} style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: eff.source === 'override' && !eff.allowed ? '#DC2626' : '#E5E7EB', color: eff.source === 'override' && !eff.allowed ? 'white' : '#374151' }}>
                        {isSaving ? '…' : '🔒 Deny'}
                      </button>
                      {hasOverride && (
                        <button onClick={() => removeOverride(m.key)} disabled={isSaving} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280' }} title="Remove override, revert to role default">↩️</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  📊 MODULE USAGE ANALYTICS  (NEW)
// ─────────────────────────────────────────────
// SQL to run once:
// CREATE TABLE IF NOT EXISTS module_access_logs (
//   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id     uuid REFERENCES portal_users(id) ON DELETE SET NULL,
//   username    text,
//   role        text,
//   module_key  text NOT NULL,
//   accessed_at timestamptz DEFAULT now()
// );
// CREATE INDEX ON module_access_logs (accessed_at);
// CREATE INDEX ON module_access_logs (module_key);
function AnalyticsSection() {
  const [logs,     setLogs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [range,    setRange]    = useState('7d')
  const [viewMode, setViewMode] = useState('bar')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 1
      const since = new Date(Date.now() - days * 864e5).toISOString()
      const { data } = await supabase.from('module_access_logs').select('module_key,role,accessed_at').gte('accessed_at', since)
      setLogs(data || [])
      setLoading(false)
    })()
  }, [range])

  // Aggregate by module
  const byModule = ALL_MODULES.map(m => ({
    key: m.key, label: m.label, icon: m.icon,
    count: logs.filter(l => l.module_key === m.key).length,
  })).sort((a, b) => b.count - a.count)

  // Aggregate by role
  const byRole = ALL_ROLES.map(r => ({
    role: r, count: logs.filter(l => l.role === r).length,
  })).filter(r => r.count > 0).sort((a, b) => b.count - a.count)

  // Dead modules (zero usage)
  const dead = byModule.filter(m => m.count === 0)

  // Daily breakdown (last 7 days)
  const dailyMap = {}
  logs.forEach(l => {
    const day = new Date(l.accessed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    dailyMap[day] = (dailyMap[day] || 0) + 1
  })
  const daily = Object.entries(dailyMap).map(([day, count]) => ({ day, count })).slice(-7)

  const COLORS = ['#1e3a5f','#1D4ED8','#3B82F6','#60A5FA','#93C5FD','#BFDBFE','#DBEAFE']

  if (loading) return <Spinner />

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['7d','Last 7 Days'],['30d','Last 30 Days'],['1d','Today']].map(([k,l]) => (
          <button key={k} onClick={() => setRange(k)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: range === k ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: range === k ? '#EFF6FF' : 'white', color: range === k ? '#1D4ED8' : '#374151', fontWeight: range === k ? 600 : 400 }}>{l}</button>
        ))}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[['bar','📊 Bar'],['radar','🕸️ Radar']].map(([k,l]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: viewMode === k ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: viewMode === k ? '#EFF6FF' : 'white', color: viewMode === k ? '#1D4ED8' : '#374151' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Access Events', value: logs.length, icon: '📌', color: '#1D4ED8' },
          { label: 'Unique Modules Used', value: byModule.filter(m => m.count > 0).length, icon: '🗂️', color: '#7C3AED' },
          { label: 'Most Active Role', value: byRole[0]?.role?.split(' ')[0] ?? '—', icon: '👑', color: '#D97706' },
          { label: 'Unused Modules', value: dead.length, icon: '💤', color: '#DC2626' },
        ].map(c => (
          <div key={c.label} style={{ background: 'white', borderRadius: 12, padding: '16px 18px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Module access bar / radar chart */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: '#111827' }}>Module Access Count</div>
          {logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No access data in this period.<br />Integrate <code>logModuleAccess()</code> in your portals.</div>
          ) : viewMode === 'bar' ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byModule.slice(0, 12)} layout="vertical" margin={{ left: 60, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => [v, 'Accesses']} />
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {byModule.slice(0,12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={byModule.slice(0,10).map(m => ({ subject: m.label, A: m.count }))}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <Radar dataKey="A" stroke="#1D4ED8" fill="#1D4ED8" fillOpacity={0.25} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily trend */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: '#111827' }}>Daily Access Trend</div>
          {daily.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#1e3a5f" radius={[4,4,0,0]} name="Accesses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Role breakdown */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#111827' }}>Access by Role</div>
        {byRole.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>No role data available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byRole.map((r, i) => {
              const pct = Math.round((r.count / logs.length) * 100)
              return (
                <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 130, fontSize: 12, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{r.role}</div>
                  <div style={{ flex: 1, height: 10, background: '#F3F4F6', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 6, transition: 'width .4s ease' }} />
                  </div>
                  <div style={{ width: 48, fontSize: 12, color: '#6B7280', textAlign: 'right' }}>{r.count}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Dead modules warning */}
      {dead.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400E', marginBottom: 10 }}>💤 Unused Modules ({dead.length}) — consider reviewing permissions</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dead.map(m => <span key={m.key} style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 12, padding: '3px 10px' }}>{m.icon} {m.label}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  🗂️ MODULE ACCESS LOGS  (NEW)
// ─────────────────────────────────────────────
function AccessLogsSection() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [module,  setModule]  = useState('all')
  const [role,    setRole]    = useState('all')
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(0)
  const PAGE = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('module_access_logs').select('id,username,role,module_key,accessed_at').order('accessed_at', { ascending: false }).limit(500)
    if (module !== 'all') q = q.eq('module_key', module)
    if (role   !== 'all') q = q.eq('role', role)
    const { data } = await q
    setLogs(data || [])
    setPage(0)
    setLoading(false)
  }, [module, role])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered = logs.filter(l =>
    !search || l.username?.toLowerCase().includes(search.toLowerCase()) || l.module_key?.includes(search.toLowerCase())
  )
  const paginated = filtered.slice(page * PAGE, (page + 1) * PAGE)
  const totalPages = Math.ceil(filtered.length / PAGE)

  const modMeta = (key) => ALL_MODULES.find(m => m.key === key) || { icon: '🔷', label: key }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="🔍 Search user or module…" style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid #D1D5DB', outline: 'none', width: 220 }} />
        <select value={module} onChange={e => setModule(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid #D1D5DB', outline: 'none', background: 'white' }}>
          <option value="all">All Modules</option>
          {ALL_MODULES.map(m => <option key={m.key} value={m.key}>{m.icon} {m.label}</option>)}
        </select>
        <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid #D1D5DB', outline: 'none', background: 'white' }}>
          <option value="all">All Roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' }}>{filtered.length} events</span>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Module','User','Role','Accessed At'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((l, i) => {
                  const meta = modMeta(l.module_key)
                  return (
                    <tr key={l.id} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F3F4F6' : 'none', background: 'white' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '2px 10px' }}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 500, color: '#111827' }}>{l.username || '—'}</td>
                      <td style={{ padding: '10px 16px' }}><RoleBadge role={l.role} /></td>
                      <td style={{ padding: '10px 16px', color: '#6B7280', fontSize: 12 }}>
                        {new Date(l.accessed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                    </tr>
                  )
                })}
                {paginated.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No access events found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13 }}>← Prev</button>
              <span style={{ fontSize: 13, color: '#6B7280' }}>Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13 }}>Next →</button>
            </div>
          )}

          {/* Integration hint */}
          <div style={{ marginTop: 20, padding: '14px 18px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12, color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>📡 Integration:</strong> Call this from your portal modules when a user navigates to them:
            <code style={{ display: 'block', marginTop: 6, padding: '8px 12px', background: '#1e293b', color: '#93C5FD', borderRadius: 6, fontSize: 11 }}>
              {`await supabase.from('module_access_logs').insert({ user_id, username, role, module_key: 'fees' })`}
            </code>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  AUDIT LOGS
// ─────────────────────────────────────────────
function AuditSection() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
      setLogs(data || [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <Spinner />
  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)
  const levelStyle = { info: { bg: '#EFF6FF', border: '#BFDBFE' }, warning: { bg: '#FFFBEB', border: '#FDE68A' }, danger: { bg: '#FEF2F2', border: '#FECACA' } }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all','info','warning','danger'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize', border: filter === f ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: filter === f ? '#EFF6FF' : 'white', color: filter === f ? '#1D4ED8' : '#374151', fontWeight: filter === f ? 600 : 400 }}>
            {f === 'all' ? 'All Events' : f}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF', alignSelf: 'center' }}>{filtered.length} events</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(log => {
          const s = levelStyle[log.level] || levelStyle.info
          return (
            <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 10, border: `1px solid ${s.border}`, background: s.bg }}>
              <span>{{ info: 'ℹ️', warning: '⚠️', danger: '🚨' }[log.level] || '•'}</span>
              <div>
                <p style={{ margin: 0, fontSize: 14, color: '#111827' }}>{log.action}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280' }}>{log.user_name} · {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No events found.</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────
export default function AdminPage({ currentUser }) {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔐</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Admin Panel</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>GNSI Portal · Khangabok, Manipur</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 3px #DCF7E9' }} />
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{currentUser?.name ?? 'Admin'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 81px)' }}>
        {/* Sidebar */}
        <div style={{ width: 230, background: 'white', borderRight: '1px solid #E5E7EB', padding: '16px 0', flexShrink: 0 }}>
          {NAV.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ width: '100%', textAlign: 'left', padding: '10px 20px', border: 'none', cursor: 'pointer', background: activeTab === tab.id ? '#EFF6FF' : 'transparent', borderRight: activeTab === tab.id ? '3px solid #1D4ED8' : '3px solid transparent', color: activeTab === tab.id ? '#1D4ED8' : '#374151', fontWeight: activeTab === tab.id ? 600 : 400, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{tab.icon}</span>{tab.label}
              {tab.id === 'overrides' && <span style={{ marginLeft: 'auto', background: '#FEF3C7', color: '#92400E', borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>NEW</span>}
              {tab.id === 'analytics' && <span style={{ marginLeft: 'auto', background: '#FEF3C7', color: '#92400E', borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>NEW</span>}
              {tab.id === 'accesslogs' && <span style={{ marginLeft: 'auto', background: '#FEF3C7', color: '#92400E', borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>NEW</span>}
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: 32, overflow: 'auto' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
            {NAV.find(t => t.id === activeTab)?.icon} {NAV.find(t => t.id === activeTab)?.label}
          </h2>
          {activeTab === 'users'       && <UsersSection         currentUser={currentUser} />}
          {activeTab === 'permissions' && <PermissionsSection    currentUser={currentUser} />}
          {activeTab === 'overrides'   && <OverridesSection      currentUser={currentUser} />}
          {activeTab === 'analytics'   && <AnalyticsSection />}
          {activeTab === 'accesslogs'  && <AccessLogsSection />}
          {activeTab === 'password'    && <ChangePasswordSection currentUser={currentUser} />}
          {activeTab === 'audit'       && <AuditSection />}
        </div>
      </div>
    </div>
  )
}