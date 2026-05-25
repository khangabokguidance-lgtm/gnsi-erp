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
  { key: 'attendance',    label: 'Attendance',       icon: '✅' },
  { key: 'exams',         label: 'Exams',            icon: '📝' },
  { key: 'timetable',     label: 'Timetable',        icon: '🗓️' },
  { key: 'teaching',      label: 'Teaching',         icon: '📖' },
  { key: 'staff',         label: 'Staff',            icon: '👤' },
  { key: 'hr',            label: 'HR',               icon: '🏢' },
  { key: 'leave',         label: 'Leave',            icon: '🌿' },
  { key: 'hostel',        label: 'Hostel',           icon: '🏠' },
  { key: 'reception',     label: 'Reception',        icon: '🔔' },
  { key: 'notice',        label: 'Notice',           icon: '📢' },
  { key: 'social',        label: 'Social',           icon: '💬' },
  { key: 'connect',       label: 'Connect',          icon: '🔗' },
  { key: 'courses',       label: 'Courses',          icon: '📚' },
  { key: 'reports',       label: 'Reports',          icon: '📈' },
  { key: 'checklist',     label: 'Checklist',        icon: '☑️' },
  { key: 'system',        label: 'System',           icon: '⚙️' },
]

const ALL_ROLES = [
  'Teacher','Staff','Faculty','House Master','Accountant',
  'Computer Staffs','Administrator','Hostel Supervisor',
  'Superintendent','Non Teaching Staffs','Receptionist',
]

const NAV = [
  { id: 'users',       icon: '👥', label: 'User Management'  },
  { id: 'permissions', icon: '🛡️', label: 'Role Permissions' },
  { id: 'overrides',   icon: '⚡', label: 'User Overrides'   },
  { id: 'analytics',   icon: '📊', label: 'Module Analytics' },
  { id: 'accesslogs',  icon: '🗂️', label: 'Access Logs'      },
  { id: 'password',    icon: '🔑', label: 'Change Password'  },
  { id: 'audit',       icon: '📋', label: 'Audit Logs'       },
]

// ─────────────────────────────────────────────
//  SIMPLE HASH UTILITY (SHA-256 via Web Crypto)
//  Replaces plaintext password storage
// ─────────────────────────────────────────────
async function hashPassword(plain) {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(plain))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

async function verifyPassword(plain, hash) {
  const h = await hashPassword(plain)
  return h === hash
}

// ─────────────────────────────────────────────
//  AUDIT LOGGER — with error handling
// ─────────────────────────────────────────────
async function logAudit(action, currentUser) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_name: currentUser?.username ?? 'Admin',
      action,
      module: 'Admin',
      level: 'info',
      metadata: {},
    })
    if (error) console.warn('Audit log failed:', error.message)
  } catch (e) {
    console.warn('Audit log exception:', e)
  }
}

// ─────────────────────────────────────────────
//  RESPONSIVE HOOK
// ─────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ─────────────────────────────────────────────
//  GLOBAL STYLES
// ─────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; }
  @keyframes adm-spin { to { transform: rotate(360deg) } }
  @keyframes adm-fadein { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
  @keyframes adm-slidedown { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:none } }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #F1F5F9; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
  .adm-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .adm-nav-btn:hover { background: #EFF6FF !important; }
  .adm-row:hover { background: #F8FAFC !important; }
  input:focus, select:focus, textarea:focus { border-color: #3B82F6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important; outline: none !important; }
  @media (max-width: 767px) {
    .adm-sidebar { display: none !important; }
    .adm-main-pad { padding: 16px !important; }
    .adm-header-pad { padding: 14px 16px !important; }
    .adm-grid-3 { grid-template-columns: 1fr !important; }
    .adm-grid-4 { grid-template-columns: repeat(2,1fr) !important; }
    .adm-grid-2 { grid-template-columns: 1fr !important; }
    .adm-overrides-layout { flex-direction: column !important; }
    .adm-user-list-col { width: 100% !important; }
    .adm-chart-grid { grid-template-columns: 1fr !important; }
    .adm-filter-row { flex-wrap: wrap !important; }
    .adm-modal-box { width: 95vw !important; padding: 20px !important; }
    .adm-bottom-nav { display: flex !important; }
    .adm-title-row { flex-direction: column !important; gap: 10px !important; align-items: flex-start !important; }
    .adm-perm-actions { flex-direction: column !important; gap: 6px !important; }
    .adm-perm-actions > * { width: 100% !important; }
    .adm-header-user { display: none !important; }
    .adm-role-filter { gap: 4px !important; }
    .adm-role-filter button { font-size: 11px !important; padding: 4px 8px !important; }
  }
  @media (min-width: 768px) {
    .adm-bottom-nav { display: none !important; }
  }
`

// ─────────────────────────────────────────────
//  SHARED UI
// ─────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #E5E7EB', borderTopColor:'#1e3a5f', borderRadius:'50%', animation:'adm-spin .7s linear infinite' }} />
    </div>
  )
}

function ErrBox({ msg }) {
  return <div style={{ padding:'12px 16px', borderRadius:10, background:'#FEF2F2', border:'1px solid #FECACA', color:'#991B1B', fontSize:13, marginBottom:16 }}>🚨 {msg}</div>
}

function SuccessBox({ msg }) {
  return <div style={{ padding:'12px 16px', borderRadius:10, background:'#F0FDF4', border:'1px solid #BBF7D0', color:'#166534', fontSize:13, marginBottom:16 }}>✅ {msg}</div>
}

function Badge({ label, color='#1D4ED8', bg='#EFF6FF', border='#BFDBFE' }) {
  return <span style={{ background:bg, color, border:`1px solid ${border}`, borderRadius:6, fontSize:11, fontWeight:700, padding:'2px 8px', whiteSpace:'nowrap' }}>{label}</span>
}

function RoleBadge({ role }) {
  const colors = {
    'Teacher':             { bg:'#F0FDF4', text:'#166534',  border:'#BBF7D0' },
    'Staff':               { bg:'#FFF7ED', text:'#9A3412',  border:'#FED7AA' },
    'Faculty':             { bg:'#EFF6FF', text:'#1D4ED8',  border:'#BFDBFE' },
    'House Master':        { bg:'#FDF4FF', text:'#7E22CE',  border:'#E9D5FF' },
    'Accountant':          { bg:'#ECFDF5', text:'#065F46',  border:'#A7F3D0' },
    'Computer Staffs':     { bg:'#F0F9FF', text:'#0369A1',  border:'#BAE6FD' },
    'Administrator':       { bg:'#FEF2F2', text:'#991B1B',  border:'#FECACA' },
    'Hostel Supervisor':   { bg:'#FFFBEB', text:'#92400E',  border:'#FDE68A' },
    'Superintendent':      { bg:'#F5F3FF', text:'#5B21B6',  border:'#DDD6FE' },
    'Non Teaching Staffs': { bg:'#F9FAFB', text:'#374151',  border:'#E5E7EB' },
    'Receptionist':        { bg:'#FFF1F2', text:'#9F1239',  border:'#FECDD3' },
  }
  const c = colors[role] || { bg:'#F3F4F6', text:'#374151', border:'#E5E7EB' }
  return <Badge label={role} color={c.text} bg={c.bg} border={c.border} />
}

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position:'fixed', bottom:32, right:16, background:'#1e3a5f', color:'white', padding:'12px 20px', borderRadius:10, fontWeight:600, fontSize:13, zIndex:1100, boxShadow:'0 4px 20px rgba(0,0,0,0.2)', animation:'adm-fadein .2s ease', maxWidth:'90vw' }}>
      {msg}
    </div>
  )
}

// ─────────────────────────────────────────────
//  CONFIRM MODAL — replaces window.confirm
// ─────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel, danger }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:16 }}>
      <div style={{ background:'white', borderRadius:14, padding:28, width:'min(420px,95vw)', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', animation:'adm-slidedown .2s ease' }}>
        <div style={{ fontSize:28, marginBottom:12 }}>{danger ? '⚠️' : '❓'}</div>
        <h3 style={{ fontSize:16, fontWeight:700, color:'#111827', marginBottom:8 }}>{title}</h3>
        <p style={{ fontSize:14, color:'#6B7280', marginBottom:24, lineHeight:1.5 }}>{message}</p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ padding:'9px 20px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', fontSize:14, fontWeight:500 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding:'9px 20px', borderRadius:8, border:'none', background: danger ? '#DC2626' : '#1D4ED8', color:'white', cursor:'pointer', fontSize:14, fontWeight:700 }}>
            {danger ? 'Yes, Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  CHANGE PASSWORD
// ─────────────────────────────────────────────
function ChangePasswordSection({ currentUser }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass]  = useState('')
  const [confirm, setConfirm]  = useState('')
  const [saving,  setSaving]   = useState(false)
  const [error,   setError]    = useState(null)
  const [success, setSuccess]  = useState(false)
  const [isChanged, setIsChanged] = useState(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('admin_credentials').select('is_changed').eq('id',1).single()
      setIsChanged(data?.is_changed ?? false)
    })()
  }, [])

  const handleChange = async () => {
    setError(null); setSuccess(false)
    if (!current || !newPass || !confirm) { setError('All fields are required.'); return }
    if (newPass.length < 8)              { setError('New password must be at least 8 characters.'); return }
    if (newPass !== confirm)             { setError('New passwords do not match.'); return }
    if (/^(.)\1+$/.test(newPass))        { setError('Password is too simple.'); return }
    setSaving(true)

    // FIX: fetch stored hash and compare using SHA-256
    const { data: creds } = await supabase.from('admin_credentials').select('password_hash,is_changed').eq('id',1).single()

    let validCurrent = false
    if (creds.is_changed) {
      // compare against stored hash
      validCurrent = await verifyPassword(current, creds.password_hash)
    } else {
      // first-time: compare against env variable hash
      // NOTE: Store hashed default password in DB, not plaintext env var
      const envHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH // store hash not plaintext
      validCurrent = await verifyPassword(current, envHash) || current === import.meta.env.VITE_ADMIN_PASSWORD
    }

    if (!validCurrent) { setError('Current password is incorrect.'); setSaving(false); return }

    const newHash = await hashPassword(newPass)
    const { error: updateErr } = await supabase.from('admin_credentials').update({ password_hash: newHash, is_changed: true, updated_at: new Date().toISOString() }).eq('id',1)
    if (updateErr) { setError(updateErr.message); setSaving(false); return }

    await logAudit('Admin changed their password', currentUser)
    setIsChanged(true); setSuccess(true)
    setCurrent(''); setNewPass(''); setConfirm('')
    setSaving(false)
  }

  if (isChanged === null) return <Spinner />

  const inp = { width:'100%', padding:'10px 14px', borderRadius:8, fontSize:14, border:'1.5px solid #E2E8F0', marginBottom:16, fontFamily:'inherit', transition:'border .2s, box-shadow .2s' }

  return (
    <div style={{ maxWidth:480 }}>
      <div style={{ padding:'14px 18px', borderRadius:10, background: isChanged ? '#F0FDF4' : '#FFF7ED', border:`1px solid ${isChanged ? '#BBF7D0' : '#FED7AA'}`, marginBottom:24 }}>
        <p style={{ margin:0, fontSize:13, color: isChanged ? '#166534' : '#9A3412', fontWeight:600 }}>
          {isChanged ? '🔐 Password has been changed. Default password is permanently disabled.' : '⚠️ You are using the default password. Change it now to secure your account.'}
        </p>
      </div>
      {error   && <ErrBox msg={error} />}
      {success && <SuccessBox msg="Password changed successfully." />}
      {[
        { label:'Current Password',       value:current, set:setCurrent, ph:'Enter current password' },
        { label:'New Password',           value:newPass,  set:setNewPass,  ph:'Min. 8 characters'     },
        { label:'Confirm New Password',   value:confirm,  set:setConfirm,  ph:'Repeat new password'   },
      ].map(f => (
        <div key={f.label}>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>{f.label}</label>
          <input type="password" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inp} />
        </div>
      ))}
      <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:16 }}>
        Password is hashed (SHA-256) before storage — never stored as plain text.
      </div>
      <button onClick={handleChange} disabled={saving} style={{ padding:'10px 24px', borderRadius:8, border:'none', fontSize:14, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#93C5FD' : '#1e3a5f', color:'white', width:'100%', transition:'background .2s' }}>
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
  const [form,   setForm]   = useState({ name: existing?.name ?? '', username: existing?.username ?? '', password: '', role: existing?.role ?? 'Teacher' })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  const submit = async () => {
    if (!form.name.trim())     { setErr('Name is required.'); return }
    if (!form.username.trim()) { setErr('Username is required.'); return }
    if (!isEdit && !form.password) { setErr('Password is required.'); return }
    if (!isEdit && form.password.length < 8) { setErr('Password must be at least 8 characters.'); return }

    setSaving(true); setErr(null)

    if (isEdit) {
      const update = { name: form.name.trim(), role: form.role, updated_at: new Date().toISOString() }
      // FIX: hash password before saving
      if (form.password) update.password_hash = await hashPassword(form.password)
      const { error } = await supabase.from('portal_users').update(update).eq('id', existing.id)
      if (error) { setErr(error.message); setSaving(false); return }
      await logAudit(`Updated user: ${form.name}`, currentUser)
    } else {
      // FIX: check for duplicate username before insert
      const { data: existing_user } = await supabase.from('portal_users').select('id').eq('username', form.username.trim()).maybeSingle()
      if (existing_user) { setErr('Username already taken. Choose a different one.'); setSaving(false); return }

      const hashedPw = await hashPassword(form.password)
      const { error } = await supabase.from('portal_users').insert({ name: form.name.trim(), username: form.username.trim(), password_hash: hashedPw, role: form.role, active: true })
      if (error) { setErr(error.message); setSaving(false); return }
      await logAudit(`Added user: ${form.name} (${form.role})`, currentUser)
    }
    onSaved(); onClose()
  }

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:16 }
  const inp = { width:'100%', padding:'9px 12px', borderRadius:8, fontSize:14, border:'1px solid #D1D5DB', marginBottom:14, fontFamily:'inherit', transition:'border .2s, box-shadow .2s' }

  return (
    <div style={overlay} onClick={onClose}>
      <div className="adm-modal-box" style={{ background:'white', borderRadius:14, padding:28, width:'min(440px,95vw)', boxShadow:'0 8px 32px rgba(0,0,0,0.15)', maxHeight:'90vh', overflowY:'auto', animation:'adm-slidedown .2s ease' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 20px', fontSize:16, fontWeight:700 }}>{isEdit ? 'Edit User' : 'Add New User'}</h3>
        {err && <ErrBox msg={err} />}
        {[
          { label:'Full Name *',  k:'name',     type:'text',     ph:'e.g. Priya Devi',  disabled:false  },
          { label:'Username *',   k:'username', type:'text',     ph:'priya_devi',        disabled:isEdit },
          { label: isEdit ? 'New Password (leave blank to keep)' : 'Password * (min 8 chars)', k:'password', type:'password', ph:'••••••••', disabled:false },
        ].map(f => (
          <div key={f.k}>
            <label style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:4 }}>{f.label}</label>
            <input style={{ ...inp, opacity: f.disabled ? .6 : 1 }} type={f.type} disabled={f.disabled} value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph} />
          </div>
        ))}
        <label style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:4 }}>Role</label>
        <select style={{ ...inp, marginBottom:20 }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', fontSize:13 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding:'9px 18px', borderRadius:8, border:'none', background: saving ? '#93C5FD' : '#1D4ED8', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
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
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [modal,    setModal]    = useState(null)
  const [filter,   setFilter]   = useState('All')
  const [deleting, setDeleting] = useState(null)
  const [confirm,  setConfirm]  = useState(null) // { user } for delete confirm
  const isMobile = useIsMobile()

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
    const { error } = await supabase.from('portal_users').update({ active: newVal }).eq('id', user.id)
    if (error) { alert('Failed to update status: ' + error.message); return }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: newVal } : u))
    await logAudit(`${newVal ? 'Enabled' : 'Disabled'} user: ${user.name}`, currentUser)
  }

  // FIX: use ConfirmModal instead of window.confirm
  const deleteUser = async (user) => {
    setDeleting(user.id)
    const { error } = await supabase.from('portal_users').delete().eq('id', user.id)
    if (error) { alert('Delete failed: ' + error.message); setDeleting(null); setConfirm(null); return }
    setUsers(prev => prev.filter(u => u.id !== user.id))
    await logAudit(`Deleted user: ${user.name}`, currentUser)
    setDeleting(null); setConfirm(null)
  }

  const filtered = filter === 'All' ? users : users.filter(u => u.role === filter)
  if (loading) return <Spinner />
  if (error)   return <ErrBox msg={error} />

  return (
    <div>
      {modal && <UserModal existing={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={fetchUsers} currentUser={currentUser} />}
      {confirm && (
        <ConfirmModal
          title={`Delete ${confirm.user.name}?`}
          message="This will permanently remove the user and all their data. This cannot be undone."
          danger
          onConfirm={() => deleteUser(confirm.user)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Filters */}
      <div className="adm-role-filter" style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {['All', ...ALL_ROLES].map(r => (
          <button key={r} onClick={() => setFilter(r)} style={{ padding:'5px 12px', borderRadius:8, fontSize:12, cursor:'pointer', border: filter===r ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: filter===r ? '#EFF6FF' : 'white', color: filter===r ? '#1D4ED8' : '#374151', fontWeight: filter===r ? 600 : 400, whiteSpace:'nowrap' }}>{r}</button>
        ))}
        <button onClick={() => setModal('add')} style={{ marginLeft:'auto', padding:'7px 16px', borderRadius:8, fontSize:13, cursor:'pointer', background:'#1D4ED8', color:'white', border:'none', fontWeight:600, whiteSpace:'nowrap' }}>+ Add User</button>
      </div>

      {/* Table — wrapped for horizontal scroll on mobile */}
      <div className="adm-table-wrap" style={{ border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth: isMobile ? 600 : 'auto' }}>
          <thead>
            <tr style={{ background:'#F9FAFB', borderBottom:'1px solid #E5E7EB' }}>
              {['Name','Username','Role','Status','Created','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#6B7280', fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} className="adm-row" style={{ borderBottom: i < filtered.length-1 ? '1px solid #F3F4F6' : 'none', transition:'background .1s' }}>
                <td style={{ padding:'11px 14px', fontWeight:500 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#1D4ED8', flexShrink:0 }}>
                      {(u.name||'?').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <span style={{ whiteSpace:'nowrap' }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding:'11px 14px', color:'#6B7280', whiteSpace:'nowrap' }}>{u.username}</td>
                <td style={{ padding:'11px 14px', whiteSpace:'nowrap' }}><RoleBadge role={u.role} /></td>
                <td style={{ padding:'11px 14px', whiteSpace:'nowrap' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background: u.active ? '#22C55E' : '#9CA3AF', display:'inline-block', flexShrink:0 }} />
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding:'11px 14px', color:'#9CA3AF', fontSize:12, whiteSpace:'nowrap' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—'}
                </td>
                <td style={{ padding:'11px 14px' }}>
                  <div style={{ display:'flex', gap:5, flexWrap:'nowrap' }}>
                    <button onClick={() => setModal(u)} style={{ padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer', border:'1px solid #E5E7EB', background:'white', whiteSpace:'nowrap' }}>Edit</button>
                    <button onClick={() => toggleActive(u)} style={{ padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer', border:'1px solid #E5E7EB', background:'white', color: u.active ? '#b45309' : '#16a34a', whiteSpace:'nowrap' }}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => setConfirm({ user: u })} disabled={deleting===u.id} style={{ padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer', border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', whiteSpace:'nowrap' }}>
                      {deleting===u.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'#9CA3AF' }}>No users found.</td></tr>
            )}
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
  const [role,   setRole]   = useState('Teacher')
  const [perms,  setPerms]  = useState({})
  const [loading,setLoading]= useState(true)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(null)

  const fetchPerms = useCallback(async (r) => {
    setLoading(true); setError(null)
    const { data, error } = await supabase.from('role_permissions').select('module_key,allowed').eq('role', r)
    if (error) { setError(error.message); setLoading(false); return }
    const map = {}
    ;(data || []).forEach(p => { map[p.module_key] = p.allowed })
    setPerms(map)
    setLoading(false)
  }, [])

  useEffect(() => { fetchPerms(role) }, [role, fetchPerms])

  const toggle   = (key) => setPerms(p => ({ ...p, [key]: !p[key] }))
  const selectAll = () => setPerms(Object.fromEntries(ALL_MODULES.map(m => [m.key, true])))
  const clearAll  = () => setPerms(Object.fromEntries(ALL_MODULES.map(m => [m.key, false])))

  // FIX: use upsert so it works even if row doesn't exist yet
  const savePerms = async () => {
    setSaving(true); setError(null)
    try {
      const rows = ALL_MODULES.map(m => ({ role, module_key: m.key, allowed: perms[m.key] ?? false }))
      const { error } = await supabase.from('role_permissions').upsert(rows, { onConflict: 'role,module_key' })
      if (error) throw error
      await logAudit(`Updated permissions for role: ${role}`, currentUser)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div>
      {error && <ErrBox msg={error} />}
      <div className="adm-role-filter" style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {ALL_ROLES.map(r => (
          <button key={r} onClick={() => setRole(r)} style={{ padding:'5px 12px', borderRadius:8, fontSize:12, cursor:'pointer', border: role===r ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: role===r ? '#EFF6FF' : 'white', color: role===r ? '#1D4ED8' : '#374151', fontWeight: role===r ? 700 : 400, whiteSpace:'nowrap' }}>{r}</button>
        ))}
        <div className="adm-perm-actions" style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={selectAll} style={{ padding:'7px 12px', borderRadius:8, fontSize:12, cursor:'pointer', border:'1px solid #E5E7EB', background:'white' }}>Select All</button>
          <button onClick={clearAll}  style={{ padding:'7px 12px', borderRadius:8, fontSize:12, cursor:'pointer', border:'1px solid #E5E7EB', background:'white' }}>Clear All</button>
          <button onClick={savePerms} disabled={saving} style={{ padding:'7px 18px', borderRadius:8, fontSize:13, cursor:'pointer', border:'none', background: saved ? '#16A34A' : saving ? '#93C5FD' : '#1D4ED8', color:'white', fontWeight:600 }}>
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {loading ? <Spinner /> : (
        <div className="adm-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {ALL_MODULES.map(m => (
            <div key={m.key} onClick={() => toggle(m.key)} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:10, cursor:'pointer', border: perms[m.key] ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: perms[m.key] ? '#EFF6FF' : 'white', transition:'all .15s' }}>
              <div style={{ width:18, height:18, borderRadius:4, flexShrink:0, background: perms[m.key] ? '#1D4ED8' : 'white', border: perms[m.key] ? 'none' : '1.5px solid #D1D5DB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {perms[m.key] && <span style={{ color:'white', fontSize:12, fontWeight:700 }}>✓</span>}
              </div>
              <span style={{ fontSize:13, fontWeight: perms[m.key] ? 600 : 400, color: perms[m.key] ? '#1D4ED8' : '#374151' }}>
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
//  USER OVERRIDES
// ─────────────────────────────────────────────
function OverridesSection({ currentUser }) {
  const [users,     setUsers]     = useState([])
  const [selUser,   setSelUser]   = useState(null)
  const [rolePerms, setRolePerms] = useState({})
  const [overrides, setOverrides] = useState({})
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(null)
  const [reason,    setReason]    = useState('')
  const [toast,     setToast]     = useState(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    supabase.from('portal_users').select('id,name,username,role,active').order('name').then(({ data }) => setUsers(data || []))
  }, [])

  const loadUser = useCallback(async (user) => {
    setSelUser(user); setLoading(true)
    const [{ data: rp }, { data: ov }] = await Promise.all([
      supabase.from('role_permissions').select('module_key,allowed').eq('role', user.role),
      supabase.from('user_module_overrides').select('module_key,allowed,reason').eq('user_id', user.id),
    ])
    const rmap = {}; (rp  || []).forEach(p => { rmap[p.module_key] = p.allowed })
    const omap = {}; (ov  || []).forEach(o => { omap[o.module_key] = { allowed: o.allowed, reason: o.reason } })
    setRolePerms(rmap); setOverrides(omap); setLoading(false)
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const applyOverride = async (moduleKey, allowed) => {
    if (!selUser) return
    setSaving(moduleKey)
    const payload = { user_id: selUser.id, module_key: moduleKey, allowed, reason: reason.trim() || null, set_by: currentUser?.username ?? 'Admin' }
    const { error } = await supabase.from('user_module_overrides').upsert(payload, { onConflict: 'user_id,module_key' })
    if (error) { showToast('❌ Error: ' + error.message); setSaving(null); return }
    setOverrides(prev => ({ ...prev, [moduleKey]: { allowed, reason: reason.trim() || null } }))
    await logAudit(`Override: ${selUser.name} → ${moduleKey} = ${allowed ? 'GRANTED' : 'DENIED'}`, currentUser)
    showToast(`${allowed ? '🔓 Granted' : '🔒 Denied'} ${moduleKey} for ${selUser.name}`)
    setSaving(null)
  }

  const removeOverride = async (moduleKey) => {
    if (!selUser) return
    setSaving(moduleKey)
    const { error } = await supabase.from('user_module_overrides').delete().eq('user_id', selUser.id).eq('module_key', moduleKey)
    if (error) { showToast('❌ Error: ' + error.message); setSaving(null); return }
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
    <div className="adm-overrides-layout" style={{ display:'flex', gap:20, minHeight:500 }}>
      <Toast msg={toast} />

      {/* User list */}
      <div className="adm-user-list-col" style={{ width:240, flexShrink:0, border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', alignSelf:'flex-start' }}>
        <div style={{ padding:'10px 14px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB', fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'.06em' }}>SELECT USER</div>
        <div style={{ maxHeight:480, overflowY:'auto' }}>
          {users.map(u => (
            <div key={u.id} onClick={() => loadUser(u)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #F3F4F6', background: selUser?.id===u.id ? '#EFF6FF' : 'white', borderLeft: selUser?.id===u.id ? '3px solid #1D4ED8' : '3px solid transparent', transition:'all .12s' }}>
              <div style={{ fontWeight:600, fontSize:13, color: selUser?.id===u.id ? '#1D4ED8' : '#111827' }}>{u.name}</div>
              <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{u.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex:1, minWidth:0 }}>
        {!selUser ? (
          <div style={{ padding:40, textAlign:'center', color:'#9CA3AF', border:'2px dashed #E5E7EB', borderRadius:14 }}>
            <div style={{ fontSize:36, marginBottom:10 }}>⚡</div>
            <div style={{ fontWeight:600, fontSize:15 }}>Select a user to manage overrides</div>
            <div style={{ fontSize:13, marginTop:6 }}>Overrides bypass role permissions immediately</div>
          </div>
        ) : loading ? <Spinner /> : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'12px 16px', background:'#F8FAFC', borderRadius:10, border:'1px solid #E5E7EB', flexWrap:'wrap' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#1D4ED8', flexShrink:0 }}>
                {selUser.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{selUser.name}</div>
                <div style={{ fontSize:12, color:'#6B7280' }}>{selUser.username} · <RoleBadge role={selUser.role} /></div>
              </div>
              <div style={{ marginLeft:'auto', fontSize:12, color:'#9CA3AF' }}>
                {Object.keys(overrides).length} override{Object.keys(overrides).length!==1?'s':''} active
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>
                Reason for override <span style={{ color:'#EF4444', fontSize:11 }}>* required for accountability</span>
              </label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Temporary access for audit period" style={{ width:'100%', padding:'8px 12px', borderRadius:8, fontSize:13, border:'1px solid #D1D5DB', fontFamily:'inherit', transition:'border .2s, box-shadow .2s' }} />
            </div>

            <div className="adm-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {ALL_MODULES.map(m => {
                const eff = effectiveAccess(m.key)
                const hasOverride = m.key in overrides
                const isSaving = saving === m.key
                return (
                  <div key={m.key} style={{ padding:'12px 14px', borderRadius:10, border: hasOverride ? `2px solid ${overrides[m.key].allowed ? '#16A34A' : '#DC2626'}` : '1px solid #E5E7EB', background: hasOverride ? (overrides[m.key].allowed ? '#F0FDF4' : '#FEF2F2') : 'white', position:'relative', transition:'all .15s' }}>
                    {hasOverride && (
                      <span style={{ position:'absolute', top:6, right:8, fontSize:10, fontWeight:700, color: overrides[m.key].allowed ? '#16A34A' : '#DC2626' }}>
                        {overrides[m.key].allowed ? '🔓 GRANT' : '🔒 DENY'}
                      </span>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, paddingRight: hasOverride ? 60 : 0 }}>
                      <span style={{ fontSize:18 }}>{m.icon}</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{m.label}</div>
                        <div style={{ fontSize:11, color:'#9CA3AF' }}>
                          Role default: <span style={{ color: rolePerms[m.key] ? '#16A34A' : '#9CA3AF', fontWeight:600 }}>{rolePerms[m.key] ? 'Allowed' : 'Denied'}</span>
                        </div>
                        {hasOverride && overrides[m.key].reason && (
                          <div style={{ fontSize:11, color:'#9CA3AF', fontStyle:'italic', marginTop:1 }}>"{overrides[m.key].reason}"</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={() => applyOverride(m.key, true)} disabled={isSaving} style={{ flex:1, padding:'5px 0', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:'none', background: eff.source==='override' && eff.allowed ? '#16A34A' : '#E5E7EB', color: eff.source==='override' && eff.allowed ? 'white' : '#374151' }}>
                        {isSaving ? '…' : '🔓 Grant'}
                      </button>
                      <button onClick={() => applyOverride(m.key, false)} disabled={isSaving} style={{ flex:1, padding:'5px 0', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:'none', background: eff.source==='override' && !eff.allowed ? '#DC2626' : '#E5E7EB', color: eff.source==='override' && !eff.allowed ? 'white' : '#374151' }}>
                        {isSaving ? '…' : '🔒 Deny'}
                      </button>
                      {hasOverride && (
                        <button onClick={() => removeOverride(m.key)} disabled={isSaving} style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid #E5E7EB', background:'white', color:'#6B7280' }} title="Remove override">↩️</button>
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
//  ANALYTICS
// ─────────────────────────────────────────────
function AnalyticsSection() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [range,   setRange]   = useState('7d')
  const [viewMode,setViewMode]= useState('bar')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      // FIX: use start-of-day for correct date range
      const days = range==='7d' ? 7 : range==='30d' ? 30 : 1
      const d = new Date(); d.setHours(0,0,0,0)
      d.setDate(d.getDate() - (days - 1))
      const since = d.toISOString()
      const { data } = await supabase.from('module_access_logs').select('module_key,role,accessed_at').gte('accessed_at', since)
      setLogs(data || [])
      setLoading(false)
    })()
  }, [range])

  const byModule = ALL_MODULES.map(m => ({
    key: m.key, label: m.label, icon: m.icon,
    count: logs.filter(l => l.module_key===m.key).length,
  })).sort((a,b) => b.count - a.count)

  const byRole = ALL_ROLES.map(r => ({
    role: r, count: logs.filter(l => l.role===r).length,
  })).filter(r => r.count > 0).sort((a,b) => b.count - a.count)

  const dead = byModule.filter(m => m.count === 0)

  // FIX: use proper date ranges
  const dailyMap = {}
  logs.forEach(l => {
    const day = new Date(l.accessed_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
    dailyMap[day] = (dailyMap[day] || 0) + 1
  })
  const daily = Object.entries(dailyMap).map(([day,count]) => ({ day, count }))

  const COLORS = ['#1e3a5f','#1D4ED8','#3B82F6','#60A5FA','#93C5FD','#BFDBFE','#DBEAFE']

  if (loading) return <Spinner />

  return (
    <div>
      <div className="adm-filter-row" style={{ display:'flex', gap:8, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        {[['7d','Last 7 Days'],['30d','Last 30 Days'],['1d','Today']].map(([k,l]) => (
          <button key={k} onClick={() => setRange(k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border: range===k ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: range===k ? '#EFF6FF' : 'white', color: range===k ? '#1D4ED8' : '#374151', fontWeight: range===k ? 600 : 400 }}>{l}</button>
        ))}
        <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
          {[['bar','📊 Bar'],['radar','🕸️ Radar']].map(([k,l]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{ padding:'6px 12px', borderRadius:8, fontSize:12, cursor:'pointer', border: viewMode===k ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: viewMode===k ? '#EFF6FF' : 'white', color: viewMode===k ? '#1D4ED8' : '#374151' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="adm-grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Access Events',  value:logs.length,                                     icon:'📌', color:'#1D4ED8' },
          { label:'Unique Modules Used',  value:byModule.filter(m=>m.count>0).length,            icon:'🗂️', color:'#7C3AED' },
          { label:'Most Active Role',     value:byRole[0]?.role?.split(' ')[0] ?? '—',            icon:'👑', color:'#D97706' },
          { label:'Unused Modules',       value:dead.length,                                      icon:'💤', color:'#DC2626' },
        ].map(c => (
          <div key={c.label} style={{ background:'white', borderRadius:12, padding:'14px 16px', border:'1px solid #E5E7EB' }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{c.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div className="adm-chart-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={{ background:'white', borderRadius:12, padding:18, border:'1px solid #E5E7EB' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Module Access Count</div>
          {logs.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No access data yet.<br />Integrate <code style={{ fontFamily:'DM Mono,monospace' }}>logModuleAccess()</code> in your portals.</div>
          ) : viewMode === 'bar' ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byModule.slice(0,12)} layout="vertical" margin={{ left:60, right:10 }}>
                <XAxis type="number" tick={{ fontSize:11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize:11 }} width={60} />
                <Tooltip formatter={v => [v,'Accesses']} />
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {byModule.slice(0,12).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={byModule.slice(0,10).map(m=>({ subject:m.label, A:m.count }))}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize:10 }} />
                <Radar dataKey="A" stroke="#1D4ED8" fill="#1D4ED8" fillOpacity={0.25} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background:'white', borderRadius:12, padding:18, border:'1px solid #E5E7EB' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Daily Access Trend</div>
          {daily.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={daily}>
                <XAxis dataKey="day" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#1e3a5f" radius={[4,4,0,0]} name="Accesses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Role breakdown */}
      <div style={{ background:'white', borderRadius:12, padding:18, border:'1px solid #E5E7EB', marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Access by Role</div>
        {byRole.length === 0 ? <div style={{ color:'#9CA3AF', fontSize:13 }}>No role data available.</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {byRole.map((r,i) => {
              const pct = Math.round((r.count / logs.length) * 100)
              return (
                <div key={r.role} style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <div style={{ width:130, fontSize:12, fontWeight:600, color:'#374151', flexShrink:0 }}>{r.role}</div>
                  <div style={{ flex:1, minWidth:80, height:10, background:'#F3F4F6', borderRadius:6, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:COLORS[i%COLORS.length], borderRadius:6, transition:'width .4s ease' }} />
                  </div>
                  <div style={{ width:40, fontSize:12, color:'#6B7280', textAlign:'right' }}>{r.count}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {dead.length > 0 && (
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'14px 18px' }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#92400E', marginBottom:10 }}>💤 Unused Modules ({dead.length}) — consider reviewing permissions</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {dead.map(m => <span key={m.key} style={{ background:'#FEF3C7', color:'#92400E', border:'1px solid #FDE68A', borderRadius:6, fontSize:12, padding:'3px 10px' }}>{m.icon} {m.label}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  ACCESS LOGS
// ─────────────────────────────────────────────
function AccessLogsSection() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [module,  setModule]  = useState('all')
  const [role,    setRole]    = useState('all')
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(0)
  const [total,   setTotal]   = useState(0)
  const PAGE = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    // FIX: use count query so user knows total even if capped
    let q = supabase.from('module_access_logs').select('id,username,role,module_key,accessed_at', { count: 'exact' })
      .order('accessed_at', { ascending: false }).limit(500)
    if (module !== 'all') q = q.eq('module_key', module)
    if (role   !== 'all') q = q.eq('role', role)
    const { data, count } = await q
    setLogs(data || [])
    setTotal(count || 0)
    setPage(0)
    setLoading(false)
  }, [module, role])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered = logs.filter(l =>
    !search || l.username?.toLowerCase().includes(search.toLowerCase()) || l.module_key?.includes(search.toLowerCase())
  )
  const paginated  = filtered.slice(page*PAGE, (page+1)*PAGE)
  const totalPages = Math.ceil(filtered.length / PAGE)
  const modMeta    = (key) => ALL_MODULES.find(m => m.key===key) || { icon:'🔷', label:key }

  return (
    <div>
      <div className="adm-filter-row" style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="🔍 Search user or module…" style={{ padding:'8px 12px', borderRadius:8, fontSize:13, border:'1px solid #D1D5DB', width:200, fontFamily:'inherit', transition:'border .2s, box-shadow .2s' }} />
        <select value={module} onChange={e => setModule(e.target.value)} style={{ padding:'8px 10px', borderRadius:8, fontSize:13, border:'1px solid #D1D5DB', background:'white' }}>
          <option value="all">All Modules</option>
          {ALL_MODULES.map(m => <option key={m.key} value={m.key}>{m.icon} {m.label}</option>)}
        </select>
        <select value={role} onChange={e => setRole(e.target.value)} style={{ padding:'8px 10px', borderRadius:8, fontSize:13, border:'1px solid #D1D5DB', background:'white' }}>
          <option value="all">All Roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {/* FIX: Show warning if results are truncated */}
        <span style={{ marginLeft:'auto', fontSize:12, color: total > 500 ? '#D97706' : '#9CA3AF' }}>
          {filtered.length} shown{total > 500 ? ` (of ${total} total — showing latest 500)` : ''}
        </span>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="adm-table-wrap" style={{ border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:480 }}>
              <thead>
                <tr style={{ background:'#F9FAFB', borderBottom:'1px solid #E5E7EB' }}>
                  {['Module','User','Role','Accessed At'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#6B7280', fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((l,i) => {
                  const meta = modMeta(l.module_key)
                  return (
                    <tr key={l.id} className="adm-row" style={{ borderBottom: i < paginated.length-1 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#F0F9FF', color:'#0369A1', border:'1px solid #BAE6FD', borderRadius:6, fontSize:12, fontWeight:600, padding:'2px 10px', whiteSpace:'nowrap' }}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontWeight:500, whiteSpace:'nowrap' }}>{l.username || '—'}</td>
                      <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}><RoleBadge role={l.role} /></td>
                      <td style={{ padding:'10px 14px', color:'#6B7280', fontSize:12, whiteSpace:'nowrap' }}>
                        {new Date(l.accessed_at).toLocaleString('en-IN',{ dateStyle:'medium', timeStyle:'short' })}
                      </td>
                    </tr>
                  )
                })}
                {paginated.length === 0 && <tr><td colSpan={4} style={{ padding:40, textAlign:'center', color:'#9CA3AF' }}>No access events found.</td></tr>}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'center', alignItems:'center' }}>
              <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', fontSize:13 }}>← Prev</button>
              <span style={{ fontSize:13, color:'#6B7280' }}>Page {page+1} of {totalPages}</span>
              <button onClick={() => setPage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', fontSize:13 }}>Next →</button>
            </div>
          )}

          <div style={{ marginTop:16, padding:'12px 16px', background:'#F8FAFC', borderRadius:10, border:'1px solid #E5E7EB', fontSize:12, color:'#6B7280' }}>
            <strong style={{ color:'#374151' }}>📡 Integration:</strong> Call from portal modules on navigation:
            <code style={{ display:'block', marginTop:6, padding:'8px 12px', background:'#1e293b', color:'#93C5FD', borderRadius:6, fontSize:11, fontFamily:'DM Mono,monospace', overflowX:'auto' }}>
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
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at',{ ascending:false }).limit(200)
      setLogs(data || [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <Spinner />
  const filtered = filter==='all' ? logs : logs.filter(l => l.level===filter)
  const levelStyle = { info:{ bg:'#EFF6FF', border:'#BFDBFE' }, warning:{ bg:'#FFFBEB', border:'#FDE68A' }, danger:{ bg:'#FEF2F2', border:'#FECACA' } }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {['all','info','warning','danger'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', textTransform:'capitalize', border: filter===f ? '1.5px solid #1D4ED8' : '1px solid #E5E7EB', background: filter===f ? '#EFF6FF' : 'white', color: filter===f ? '#1D4ED8' : '#374151', fontWeight: filter===f ? 600 : 400 }}>
            {f==='all' ? 'All Events' : f}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:12, color:'#9CA3AF', alignSelf:'center' }}>{filtered.length} events</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(log => {
          const s = levelStyle[log.level] || levelStyle.info
          return (
            <div key={log.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px', borderRadius:10, border:`1px solid ${s.border}`, background:s.bg }}>
              <span style={{ flexShrink:0 }}>{{ info:'ℹ️', warning:'⚠️', danger:'🚨' }[log.level] || '•'}</span>
              <div style={{ minWidth:0 }}>
                <p style={{ margin:0, fontSize:14, color:'#111827', wordBreak:'break-word' }}>{log.action}</p>
                <p style={{ margin:'3px 0 0', fontSize:12, color:'#6B7280' }}>{log.user_name} · {new Date(log.created_at).toLocaleString('en-IN',{ dateStyle:'medium', timeStyle:'short' })}</p>
              </div>
            </div>
          )
        })}
        {filtered.length===0 && <div style={{ padding:32, textAlign:'center', color:'#9CA3AF' }}>No events found.</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────
export default function AdminPage({ currentUser, onLogout }) {
  const [activeTab,    setActiveTab]    = useState('users')
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [logoutConfirm,setLogoutConfirm]= useState(false)
  const isMobile = useIsMobile()

  // FIX: internal auth gate — if no currentUser, show access denied
  if (!currentUser) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8FAFC', fontFamily:'DM Sans,sans-serif', padding:16 }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ textAlign:'center', padding:40, background:'white', borderRadius:16, border:'1px solid #E5E7EB', maxWidth:360, width:'100%' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'#111827', marginBottom:8 }}>Access Denied</h2>
          <p style={{ color:'#6B7280', fontSize:14 }}>You must be logged in to access the admin panel.</p>
        </div>
      </div>
    )
  }

  const activeNav = NAV.find(t => t.id===activeTab)

  const NavItems = () => (
    <>
      {NAV.map(tab => (
        <button key={tab.id} className="adm-nav-btn" onClick={() => { setActiveTab(tab.id); setSidebarOpen(false) }} style={{ width:'100%', textAlign:'left', padding:'10px 18px', border:'none', cursor:'pointer', background: activeTab===tab.id ? '#EFF6FF' : 'transparent', borderRight: activeTab===tab.id ? '3px solid #1D4ED8' : '3px solid transparent', color: activeTab===tab.id ? '#1D4ED8' : '#374151', fontWeight: activeTab===tab.id ? 600 : 400, fontSize:13, display:'flex', alignItems:'center', gap:10, fontFamily:'inherit', transition:'background .15s' }}>
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
          {['overrides','analytics','accesslogs'].includes(tab.id) && <span style={{ marginLeft:'auto', background:'#FEF3C7', color:'#92400E', borderRadius:4, fontSize:10, fontWeight:700, padding:'1px 5px' }}>NEW</span>}
        </button>
      ))}
    </>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'DM Sans,sans-serif' }}>
      <style>{GLOBAL_CSS}</style>

      {/* Logout confirm */}
      {logoutConfirm && (
        <ConfirmModal
          title="Log out?"
          message="Are you sure you want to log out of the admin panel?"
          onConfirm={() => { setLogoutConfirm(false); onLogout?.() }}
          onCancel={() => setLogoutConfirm(false)}
        />
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:500 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position:'absolute', left:0, top:0, bottom:0, width:240, background:'white', borderRight:'1px solid #E5E7EB', paddingTop:60, animation:'adm-fadein .2s ease', zIndex:1 }}>
            <NavItems />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="adm-header-pad" style={{ background:'white', borderBottom:'1px solid #E5E7EB', padding:'18px 28px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:100 }}>
        {isMobile && (
          <button onClick={() => setSidebarOpen(o=>!o)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', fontSize:18, marginRight:4 }}>☰</button>
        )}
        <div style={{ width:38, height:38, borderRadius:10, background:'#1e3a5f', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🔐</div>
        <div>
          <h1 style={{ margin:0, fontSize:18, fontWeight:800, color:'#111827', letterSpacing:'-.02em' }}>Admin Panel</h1>
          <p style={{ margin:0, fontSize:12, color:'#9CA3AF' }}>GNSI Portal · Khangabok, Manipur</p>
        </div>
        <div className="adm-header-user" style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 0 3px #DCF7E9' }} />
          <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>{currentUser?.name ?? 'Admin'}</span>
          {/* FIX: Logout button */}
          <button onClick={() => setLogoutConfirm(true)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', fontSize:13, color:'#6B7280', fontFamily:'inherit', marginLeft:6 }}>
            🚪 Logout
          </button>
        </div>
        {/* Mobile logout */}
        {isMobile && (
          <button onClick={() => setLogoutConfirm(true)} style={{ marginLeft:'auto', padding:'6px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', fontSize:13, color:'#6B7280', fontFamily:'inherit' }}>
            🚪
          </button>
        )}
      </div>

      <div style={{ display:'flex', minHeight:'calc(100vh - 73px)' }}>
        {/* Desktop Sidebar */}
        <div className="adm-sidebar" style={{ width:220, background:'white', borderRight:'1px solid #E5E7EB', padding:'12px 0', flexShrink:0 }}>
          <NavItems />
        </div>

        {/* Main content */}
        <div className="adm-main-pad" style={{ flex:1, padding:28, overflow:'auto', paddingBottom: isMobile ? 80 : 28 }}>
          <div className="adm-title-row" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:22 }}>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>
              {activeNav?.icon} {activeNav?.label}
            </h2>
          </div>
          {activeTab==='users'       && <UsersSection         currentUser={currentUser} />}
          {activeTab==='permissions' && <PermissionsSection    currentUser={currentUser} />}
          {activeTab==='overrides'   && <OverridesSection      currentUser={currentUser} />}
          {activeTab==='analytics'   && <AnalyticsSection />}
          {activeTab==='accesslogs'  && <AccessLogsSection />}
          {activeTab==='password'    && <ChangePasswordSection currentUser={currentUser} />}
          {activeTab==='audit'       && <AuditSection />}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="adm-bottom-nav" style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderTop:'1px solid #E5E7EB', padding:'8px 0 env(safe-area-inset-bottom)', zIndex:200, justifyContent:'space-around', alignItems:'center' }}>
        {NAV.slice(0,5).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 8px', border:'none', background:'none', cursor:'pointer', opacity: activeTab===tab.id ? 1 : 0.5, fontFamily:'inherit' }}>
            <span style={{ fontSize:18 }}>{tab.icon}</span>
            <span style={{ fontSize:10, color: activeTab===tab.id ? '#1D4ED8' : '#6B7280', fontWeight: activeTab===tab.id ? 700 : 400, whiteSpace:'nowrap' }}>{tab.label.split(' ')[0]}</span>
          </button>
        ))}
        <button onClick={() => setSidebarOpen(true)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 8px', border:'none', background:'none', cursor:'pointer', opacity:0.5, fontFamily:'inherit' }}>
          <span style={{ fontSize:18 }}>•••</span>
          <span style={{ fontSize:10, color:'#6B7280' }}>More</span>
        </button>
      </div>
    </div>
  )
}