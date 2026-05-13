import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const ALL_MODULES = [
  { key: 'students',      label: 'Students'       },
  { key: 'admissions',    label: 'Admissions'     },
  { key: 'bulkadmission', label: 'Bulk Admission' },
  { key: 'fees',          label: 'Fees'           },
  { key: 'accounts',      label: 'Accounts'       },
  { key: 'salary',        label: 'Salary'         },
  { key: 'attendance',    label: 'Attendance'     },
  { key: 'exams',         label: 'Exams'          },
  { key: 'timetable',     label: 'Timetable'      },
  { key: 'teaching',      label: 'Teaching'       },
  { key: 'staff',         label: 'Staff'          },
  { key: 'hr',            label: 'HR'             },
  { key: 'leave',         label: 'Leave'          },
  { key: 'hostel',        label: 'Hostel'         },
  { key: 'reception',     label: 'Reception'      },
  { key: 'notice',        label: 'Notice'         },
  { key: 'social',        label: 'Social'         },
  { key: 'connect',       label: 'Connect'        },
  { key: 'courses',       label: 'Courses'        },
  { key: 'reports',       label: 'Reports'        },
  { key: 'checklist',     label: 'Checklist'      },
  { key: 'system',        label: 'System'         },
]

const ALL_ROLES = [
  'Teacher',
  'Staff',
  'Faculty',
  'House Master',
  'Accountant',
  'Computer Staffs',
  'Administrator',
  'Hostel Supervisor',
  'Superintendent',
  'Non Teaching Staffs',
  'Receptionist',
]

const NAV = [
  { id: 'users',       icon: '👥', label: 'User Management'  },
  { id: 'permissions', icon: '🛡️', label: 'Role Permissions' },
  { id: 'password',    icon: '🔑', label: 'Change Password'  },
  { id: 'audit',       icon: '📋', label: 'Audit Logs'       },
]

// ── Helpers ────────────────────────────────────────────────────
function Spinner() {
  return <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>⏳ Loading…</div>
}
function ErrBox({ msg }) {
  return <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 16 }}>🚨 {msg}</div>
}
function SuccessBox({ msg }) {
  return <div style={{ padding: '12px 16px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontSize: 13, marginBottom: 16 }}>✅ {msg}</div>
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
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {role}
    </span>
  )
}

// ── Audit logger ───────────────────────────────────────────────
async function logAudit(action, currentUser) {
  await supabase.from('audit_logs').insert({
    user_name: currentUser?.username ?? 'Admin',
    action, module: 'Admin', level: 'info', metadata: {},
  })
}

// ── Section: Change Password ───────────────────────────────────
function ChangePasswordSection({ currentUser }) {
  const [current,   setCurrent]   = useState('')
  const [newPass,   setNewPass]   = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)
  const [success,   setSuccess]   = useState(false)
  const [isChanged, setIsChanged] = useState(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admin_credentials')
        .select('is_changed')
        .eq('id', 1)
        .single()
      setIsChanged(data?.is_changed ?? false)
    })()
  }, [])

  const handleChange = async () => {
    setError(null); setSuccess(false)
    if (!current || !newPass || !confirm) { setError('All fields are required.'); return }
    if (newPass.length < 6)               { setError('New password must be at least 6 characters.'); return }
    if (newPass !== confirm)              { setError('New passwords do not match.'); return }

    setSaving(true)

    const { data: creds } = await supabase
      .from('admin_credentials')
      .select('password_hash, is_changed')
      .eq('id', 1)
      .single()

    const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD

    const validCurrent = creds.is_changed
      ? current === creds.password_hash
      : current === ADMIN_PASS

    if (!validCurrent) {
      setError('Current password is incorrect.')
      setSaving(false); return
    }

    if (newPass === ADMIN_PASS) {
      setError('New password cannot be the same as the original default password.')
      setSaving(false); return
    }

    const { error: updateErr } = await supabase
      .from('admin_credentials')
      .update({ password_hash: newPass, is_changed: true, updated_at: new Date().toISOString() })
      .eq('id', 1)

    if (updateErr) { setError(updateErr.message); setSaving(false); return }

    await logAudit('Admin changed their password', currentUser)
    setIsChanged(true)
    setSuccess(true)
    setCurrent(''); setNewPass(''); setConfirm('')
    setSaving(false)
  }

  if (isChanged === null) return <Spinner />

  const inp = {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
    border: '1.5px solid #E2E8F0', outline: 'none', boxSizing: 'border-box', marginBottom: 16,
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ padding: '14px 18px', borderRadius: 10, background: isChanged ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${isChanged ? '#BBF7D0' : '#FED7AA'}`, marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 13, color: isChanged ? '#166534' : '#9A3412', fontWeight: 600 }}>
          {isChanged
            ? '🔐 Password has been changed. The default .env password is permanently disabled.'
            : '⚠️ You are using the default password. Change it now to secure your account.'}
        </p>
      </div>

      {error   && <ErrBox    msg={error} />}
      {success && <SuccessBox msg="Password changed successfully. Default password is now permanently blocked." />}

      {[
        { label: 'Current Password',     value: current, set: setCurrent, ph: 'Enter current password' },
        { label: 'New Password',         value: newPass, set: setNewPass, ph: 'Min. 6 characters'      },
        { label: 'Confirm New Password', value: confirm, set: setConfirm, ph: 'Repeat new password'    },
      ].map(f => (
        <div key={f.label}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{f.label}</label>
          <input
            type="password"
            value={f.value}
            onChange={e => f.set(e.target.value)}
            placeholder={f.ph}
            style={inp}
            onFocus={e => e.target.style.borderColor = '#1e3a5f'}
            onBlur={e  => e.target.style.borderColor = '#E2E8F0'}
          />
        </div>
      ))}

      <button onClick={handleChange} disabled={saving} style={{
        padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14,
        fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
        background: saving ? '#93C5FD' : '#1e3a5f', color: 'white',
      }}>
        {saving ? '⏳ Updating…' : '🔑 Change Password'}
      </button>
    </div>
  )
}

// ── Add / Edit User Modal ──────────────────────────────────────
function UserModal({ existing, onClose, onSaved, currentUser }) {
  const isEdit = !!existing
  const [form, setForm] = useState({
    name:     existing?.name     ?? '',
    username: existing?.username ?? '',
    password: '',
    role:     existing?.role     ?? 'Teacher',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  const submit = async () => {
    if (!form.name || !form.username) { setErr('Name and username are required.'); return }
    if (!isEdit && !form.password)    { setErr('Password is required.'); return }
    setSaving(true); setErr(null)

    if (isEdit) {
      const update = { name: form.name, role: form.role, updated_at: new Date().toISOString() }
      if (form.password) update.password_hash = form.password
      const { error } = await supabase.from('portal_users').update(update).eq('id', existing.id)
      if (error) { setErr(error.message); setSaving(false); return }
      await logAudit(`Updated user: ${form.name}`, currentUser)
    } else {
      const { error } = await supabase.from('portal_users').insert({
        name: form.name, username: form.username,
        password_hash: form.password, role: form.role, active: true,
      })
      if (error) { setErr(error.message); setSaving(false); return }
      await logAudit(`Added user: ${form.name} (${form.role})`, currentUser)
    }
    onSaved(); onClose()
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }
  const box     = { background: 'white', borderRadius: 14, padding: 28, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }
  const inp     = { width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14, border: '1px solid #D1D5DB', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{isEdit ? 'Edit User' : 'Add New User'}</h3>
        {err && <ErrBox msg={err} />}

        {[
          { label: 'Full Name *',  k: 'name',     type: 'text',     ph: 'e.g. Priya Devi', disabled: false  },
          { label: 'Username *',   k: 'username', type: 'text',     ph: 'priya_devi',       disabled: isEdit },
          { label: isEdit ? 'New Password (leave blank to keep)' : 'Password *', k: 'password', type: 'password', ph: '••••••••', disabled: false },
        ].map(f => (
          <div key={f.k}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>{f.label}</label>
            <input style={{ ...inp, opacity: f.disabled ? .6 : 1 }} type={f.type} disabled={f.disabled}
              value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph} />
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

// ── Section: User Management ───────────────────────────────────
function UsersSection({ currentUser }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [modal,    setModal]    = useState(null)
  const [filter,   setFilter]   = useState('All')
  const [deleting, setDeleting] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('portal_users')
      .select('id,name,username,role,active,created_at')
      .order('name')
    if (error) setError(error.message)
    else       setUsers(data)
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
  if (error)   return <ErrBox msg={error} />

  return (
    <div>
      {modal && (
        <UserModal
          existing={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={fetchUsers}
          currentUser={currentUser}
        />
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', ...ALL_ROLES].map(r => (
          <button key={r} onClick={() => setFilter(r)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            border: filter === r ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB',
            background: filter === r ? '#EFF6FF' : 'white',
            color: filter === r ? '#1D4ED8' : '#374151',
            fontWeight: filter === r ? 600 : 400,
            whiteSpace: 'nowrap',
          }}>{r}</button>
        ))}
        <button onClick={() => setModal('add')} style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#1D4ED8', color: 'white', border: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
          + Add User
        </button>
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
              <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none', background: 'white' }}>
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
                    <button onClick={() => toggleActive(u)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #E5E7EB', background: 'white', color: u.active ? '#b45309' : '#16a34a' }}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => deleteUser(u)} disabled={deleting === u.id} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626' }}>
                      {deleting === u.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section: Role Permissions ──────────────────────────────────
function PermissionsSection({ currentUser }) {
  const [role,    setRole]    = useState('Teacher')
  const [perms,   setPerms]   = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const fetchPerms = useCallback(async (r) => {
    setLoading(true)
    const { data } = await supabase.from('role_permissions').select('module_key,allowed').eq('role', r)
    const map = {}
    ;(data || []).forEach(p => { map[p.module_key] = p.allowed })
    setPerms(map)
    setLoading(false)
  }, [])

  useEffect(() => { fetchPerms(role) }, [role, fetchPerms])

  const toggle    = (key) => setPerms(p => ({ ...p, [key]: !p[key] }))
  const selectAll = () => setPerms(Object.fromEntries(ALL_MODULES.map(m => [m.key, true])))
  const clearAll  = () => setPerms(Object.fromEntries(ALL_MODULES.map(m => [m.key, false])))

  const savePerms = async () => {
    setSaving(true)
    await Promise.all(
      ALL_MODULES.map(m =>
        supabase.from('role_permissions')
          .update({ allowed: perms[m.key] ?? false })
          .eq('role', role)
          .eq('module_key', m.key)
      )
    )
    await logAudit(`Updated permissions for role: ${role}`, currentUser)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {ALL_ROLES.map(r => (
          <button key={r} onClick={() => setRole(r)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            border: role === r ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB',
            background: role === r ? '#EFF6FF' : 'white',
            color: role === r ? '#1D4ED8' : '#374151',
            fontWeight: role === r ? 700 : 400,
            whiteSpace: 'nowrap',
          }}>{r}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={selectAll} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #E5E7EB', background: 'white', whiteSpace: 'nowrap' }}>Select All</button>
          <button onClick={clearAll}  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #E5E7EB', background: 'white', whiteSpace: 'nowrap' }}>Clear All</button>
          <button onClick={savePerms} disabled={saving} style={{ padding: '6px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: 'none', background: saved ? '#16A34A' : saving ? '#93C5FD' : '#1D4ED8', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {ALL_MODULES.map(m => (
            <div key={m.key} onClick={() => toggle(m.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              border: perms[m.key] ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB',
              background: perms[m.key] ? '#EFF6FF' : 'white',
              transition: 'all .15s',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                background: perms[m.key] ? '#1D4ED8' : 'white',
                border: perms[m.key] ? 'none' : '1.5px solid #D1D5DB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {perms[m.key] && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: perms[m.key] ? 600 : 400, color: perms[m.key] ? '#1D4ED8' : '#374151' }}>
                {m.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section: Audit Logs ────────────────────────────────────────
function AuditSection() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
      setLogs(data || [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <Spinner />

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)
  const levelStyle = {
    info:    { bg: '#EFF6FF', border: '#BFDBFE' },
    warning: { bg: '#FFFBEB', border: '#FDE68A' },
    danger:  { bg: '#FEF2F2', border: '#FECACA' },
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all','info','warning','danger'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize',
            border: filter === f ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB',
            background: filter === f ? '#EFF6FF' : 'white',
            color: filter === f ? '#1D4ED8' : '#374151',
            fontWeight: filter === f ? 600 : 400,
          }}>{f === 'all' ? 'All Events' : f}</button>
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
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280' }}>
                  {log.user_name} · {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No events found.</div>}
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────
export default function AdminPage({ currentUser }) {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔐</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Admin Panel</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>GNSI Portal · Khangabok, Manipur</p>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 81px)' }}>
        <div style={{ width: 220, background: 'white', borderRight: '1px solid #E5E7EB', padding: '16px 0', flexShrink: 0 }}>
          {NAV.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              width: '100%', textAlign: 'left', padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? '#EFF6FF' : 'transparent',
              borderRight: activeTab === tab.id ? '3px solid #1D4ED8' : '3px solid transparent',
              color: activeTab === tab.id ? '#1D4ED8' : '#374151',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: 32, overflow: 'auto' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
            {NAV.find(t => t.id === activeTab)?.icon} {NAV.find(t => t.id === activeTab)?.label}
          </h2>
          {activeTab === 'users'       && <UsersSection         currentUser={currentUser} />}
          {activeTab === 'permissions' && <PermissionsSection    currentUser={currentUser} />}
          {activeTab === 'password'    && <ChangePasswordSection currentUser={currentUser} />}
          {activeTab === 'audit'       && <AuditSection />}
        </div>
      </div>
    </div>
  )
}