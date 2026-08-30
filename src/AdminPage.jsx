import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import WebsiteTab from "./WebsiteTab";

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const ALL_MODULES = [
  { key: 'dashboard',        label: 'Dashboard',          icon: '⊞'   },
  { key: 'students',         label: 'Students',           icon: '🎓'  },
  { key: 'admissions',       label: 'Admissions',         icon: '📋'  },
  { key: 'bulkadmission',    label: 'Bulk Admission',     icon: '📥'  },
  { key: 'fees',             label: 'Fees',               icon: '💰'  },
  { key: 'accounts',         label: 'Accounts',           icon: '🧾'  },
  { key: 'salary',           label: 'Salary',             icon: '💵'  },
  { key: 'studentfeeledger', label: 'Student Fee Ledger', icon: '📒'  },
  { key: 'feesetup',         label: 'Fee Setup',          icon: '⚙️' },
  { key: 'attendance',       label: 'Attendance',         icon: '📅'  },
  { key: 'faceattendance',   label: 'Face Attendance',    icon: '🧑‍💼' },
  { key: 'exams',            label: 'Exams',              icon: '📝'  },
  { key: 'timetable',        label: 'Timetable',          icon: '🕐'  },
  { key: 'teaching',         label: 'Teaching',           icon: '📚'  },
  { key: 'teachingaids',     label: 'Teaching Aids',      icon: '🔒'  },
  { key: 'courses',          label: 'Courses',            icon: '🎓'  },
  { key: 'questionbank',     label: 'Question Bank',      icon: '❓'  },
  { key: 'questionbankviewer',label: 'Question Bank Viewer', icon: '📖' },
  { key: 'entrance',         label: 'Entrance Exam',      icon: '🏆'  },
  { key: 'studymaterial',    label: 'Study Materials',    icon: '📖'  },
  { key: 'studylockers',     label: 'Study Lockers',      icon: '🗃️' },
  { key: 'kitchen',          label: 'Kitchen',            icon: '🍽️' },
  { key: 'staff',            label: 'Staff',              icon: '👨‍🏫' },
  { key: 'hr',               label: 'HR',                 icon: '🗂️' },
  { key: 'leave',            label: 'Leave',              icon: '🏖️' },
  { key: 'hostel',           label: 'Hostel',             icon: '🏨'  },
  { key: 'awards',           label: 'Awards',             icon: '🏅'  },
  { key: 'reception',        label: 'Reception',          icon: '🛎️' },
  { key: 'notice',           label: 'Notice',             icon: '🔔'  },
  { key: 'social',           label: 'Social',             icon: '📣'  },
  { key: 'connect',          label: 'Connect',            icon: '🔗'  },
  { key: 'student360',       label: 'Student 360°',       icon: '🔍'  },
  { key: 'website',          label: 'Website Manager',    icon: '🌐'  },
  { key: 'reports',          label: 'Reports',            icon: '📊'  },
  { key: 'checklist',        label: 'Checklist',          icon: '✅'  },
  { key: 'invitation',       label: 'Invitation',         icon: '✉️' },
  { key: 'certificate',      label: 'Certificates',       icon: '📜'  },
  { key: 'system',           label: 'System',             icon: '⚙️' },
]

const CRUD_KEYS   = ['read', 'add', 'edit', 'delete']
const CRUD_LABELS = { read: '👁 Read', add: '➕ Add', edit: '✏️ Edit', delete: '🗑 Delete' }
const CRUD_COLORS = { read: '#0369A1', add: '#16A34A', edit: '#D97706', delete: '#DC2626' }
const CRUD_BG     = { read: '#F0F9FF', add: '#F0FDF4', edit: '#FFFBEB', delete: '#FEF2F2' }

const ALL_ROLES = [
  'Teacher','Staff','Faculty','House Master','Accountant',
  'Computer Staffs','Administrator','Hostel Supervisor',
  'Superintendent','Non Teaching Staffs','Receptionist','Staff Manager',
]

const NAV = [
  { id: 'users',       icon: '👥', label: 'Users'       },
  { id: 'permissions', icon: '🛡️', label: 'Permissions' },
  { id: 'overrides',   icon: '⚡', label: 'Overrides',   badge: 'NEW' },
  { id: 'analytics',   icon: '📊', label: 'Analytics',   badge: 'NEW' },
  { id: 'accesslogs',  icon: '🗂️', label: 'Access Logs', badge: 'NEW' },
  { id: 'password',    icon: '🔑', label: 'Password'    },
  { id: 'audit',       icon: '📋', label: 'Audit'       },
  { id: 'website',     icon: '🌐', label: 'Website'     },
]

// FIX: session idle timeout — 30 minutes
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function emptyCrud() { return { read: false, add: false, edit: false, delete: false } }
function fullCrud()  { return { read: true,  add: true,  edit: true,  delete: true  } }

async function hashPassword(plain) {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(plain))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function verifyPassword(plain, hash) { return (await hashPassword(plain)) === hash }

// FIX: audit log now surfaces errors to console instead of silently swallowing them
async function logAudit(action, currentUser) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_name: currentUser?.username ?? 'Admin',
      action, module: 'Admin', level: 'info', metadata: {},
    })
    if (error) console.error('[audit_log]', error.message)
  } catch (e) {
    console.error('[audit_log]', e)
  }
}

// ─────────────────────────────────────────────
//  HOOKS
// ─────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

// FIX: idle timeout hook — calls onIdle after IDLE_TIMEOUT_MS of inactivity
function useIdleTimeout(onIdle, timeoutMs = IDLE_TIMEOUT_MS) {
  const timerRef = useRef(null)
  const reset = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onIdle, timeoutMs)
  }, [onIdle, timeoutMs])
  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimeout(timerRef.current)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [reset])
}

// ─────────────────────────────────────────────
//  GLOBAL CSS
// ─────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #F1F5F9; }
  @keyframes adm-spin    { to { transform: rotate(360deg) } }
  @keyframes adm-fadein  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
  @keyframes adm-slidedown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:none } }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #F1F5F9; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
  .adm-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .adm-row:hover { background: #F8FAFC !important; }
  .adm-tab-btn:hover { background: rgba(255,255,255,0.12) !important; }
  input:focus, select:focus, textarea:focus {
    border-color: #3B82F6 !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important;
    outline: none !important;
  }
  .crud-chip { transition: all .12s; }
  .crud-chip:hover { opacity: .85; transform: scale(1.04); }
  .perm-matrix th, .perm-matrix td { padding: 9px 10px; white-space: nowrap; }
  .perm-matrix thead tr { background: #F8FAFC; }
  .perm-matrix tbody tr:hover td { background: #F0F9FF; }
  .perm-toggle { cursor: pointer; user-select: none; border-radius: 6px; transition: all .12s; }
  .perm-toggle:hover { transform: scale(1.1); }
  @media (max-width: 767px) {
    .adm-main-pad   { padding: 14px !important; }
    .adm-grid-3     { grid-template-columns: 1fr !important; }
    .adm-grid-4     { grid-template-columns: repeat(2,1fr) !important; }
    .adm-grid-2     { grid-template-columns: 1fr !important; }
    .adm-overrides-layout { flex-direction: column !important; }
    .adm-user-list-col { width: 100% !important; }
    .adm-chart-grid { grid-template-columns: 1fr !important; }
    .adm-filter-row { flex-wrap: wrap !important; }
    .adm-modal-box  { width: 95vw !important; padding: 20px !important; }
    .adm-perm-actions { flex-direction: column !important; gap: 6px !important; }
    .adm-perm-actions > * { width: 100% !important; }
    .adm-role-filter { gap: 4px !important; }
    .adm-role-filter button { font-size: 11px !important; padding: 4px 8px !important; }
    .adm-tab-scroll { overflow-x: auto !important; }
  }
`

// ─────────────────────────────────────────────
//  SHARED UI
// ─────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ display: 'inline-block', width: 26, height: 26, border: '3px solid #E5E7EB', borderTopColor: '#1e3a5f', borderRadius: '50%', animation: 'adm-spin .7s linear infinite' }} />
    </div>
  )
}
function ErrBox({ msg }) {
  return <div style={{ padding: '11px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 14 }}>🚨 {msg}</div>
}
function SuccessBox({ msg }) {
  return <div style={{ padding: '11px 14px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontSize: 13, marginBottom: 14 }}>✅ {msg}</div>
}
function Badge({ label, color = '#1D4ED8', bg = '#EFF6FF', border = '#BFDBFE' }) {
  return <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>{label}</span>
}
function RoleBadge({ role }) {
  const colors = {
    'Teacher':             { bg: '#F0FDF4', text: '#166534',  border: '#BBF7D0' },
    'Staff':               { bg: '#FFF7ED', text: '#9A3412',  border: '#FED7AA' },
    'Faculty':             { bg: '#EFF6FF', text: '#1D4ED8',  border: '#BFDBFE' },
    'House Master':        { bg: '#FDF4FF', text: '#7E22CE',  border: '#E9D5FF' },
    'Accountant':          { bg: '#ECFDF5', text: '#065F46',  border: '#A7F3D0' },
    'Computer Staffs':     { bg: '#F0F9FF', text: '#0369A1',  border: '#BAE6FD' },
    'Administrator':       { bg: '#FEF2F2', text: '#991B1B',  border: '#FECACA' },
    'Hostel Supervisor':   { bg: '#FFFBEB', text: '#92400E',  border: '#FDE68A' },
    'Superintendent':      { bg: '#F5F3FF', text: '#5B21B6',  border: '#DDD6FE' },
    'Non Teaching Staffs': { bg: '#F9FAFB', text: '#374151',  border: '#E5E7EB' },
    'Receptionist':        { bg: '#FFF1F2', text: '#9F1239',  border: '#FECDD3' },
    'admin':               { bg: '#1e3a5f', text: '#fff',     border: '#1e3a5f' },
  }
  const c = colors[role] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
  return <Badge label={role} color={c.text} bg={c.bg} border={c.border} />
}
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 20, background: '#0F172A', color: 'white', padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 1100, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', animation: 'adm-fadein .2s ease', maxWidth: '90vw' }}>
      {msg}
    </div>
  )
}
function ConfirmModal({ title, message, onConfirm, onCancel, danger }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 'min(420px,95vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'adm-slidedown .2s ease' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{danger ? '⚠️' : '❓'}</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: danger ? '#DC2626' : '#1D4ED8', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
            {danger ? 'Yes, Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  CRUD CHIP
// ─────────────────────────────────────────────
function CrudSummaryChips({ crud }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {CRUD_KEYS.map(k => (
        <span key={k} className="crud-chip" style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
          background: crud[k] ? CRUD_BG[k] : '#F1F5F9',
          color:      crud[k] ? CRUD_COLORS[k] : '#CBD5E1',
          border:    `1px solid ${crud[k] ? CRUD_COLORS[k] + '33' : '#E2E8F0'}`,
          textDecoration: crud[k] ? 'none' : 'line-through',
          opacity:        crud[k] ? 1 : 0.6,
        }}>{k.toUpperCase()}</span>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
//  CRUD TOGGLE CELL
// ─────────────────────────────────────────────
function CrudToggle({ active, type, onClick }) {
  return (
    <div
      className="perm-toggle"
      onClick={onClick}
      title={`${active ? 'Revoke' : 'Grant'} ${type}`}
      style={{
        width: 30, height: 30, borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
        background: active ? CRUD_BG[type] : '#F8FAFC',
        border: `1.5px solid ${active ? CRUD_COLORS[type] : '#E2E8F0'}`,
        color: active ? CRUD_COLORS[type] : '#CBD5E1',
        fontWeight: 800, margin: '0 auto',
      }}
    >
      {active ? '✓' : '·'}
    </div>
  )
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
    ;(async () => {
      const { data } = await supabase.from('admin_credentials').select('is_changed').eq('id', 1).single()
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
    const { data: creds } = await supabase.from('admin_credentials').select('password_hash,is_changed').eq('id', 1).single()
    let validCurrent = false
    if (creds.is_changed) {
      validCurrent = await verifyPassword(current, creds.password_hash)
    } else {
      // FIX: always hash before comparing — never compare plaintext
      const envHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH
      validCurrent = await verifyPassword(current, envHash)
      // fallback: if env hash not set, hash the env password and compare
      if (!validCurrent && import.meta.env.VITE_ADMIN_PASSWORD) {
        const fallbackHash = await hashPassword(import.meta.env.VITE_ADMIN_PASSWORD)
        validCurrent = await verifyPassword(current, fallbackHash)
      }
    }
    if (!validCurrent) { setError('Current password is incorrect.'); setSaving(false); return }
    const newHash = await hashPassword(newPass)
    const { error: updateErr } = await supabase.from('admin_credentials').update({ password_hash: newHash, is_changed: true, updated_at: new Date().toISOString() }).eq('id', 1)
    if (updateErr) { setError(updateErr.message); setSaving(false); return }
    await logAudit('Admin changed their password', currentUser)
    setIsChanged(true); setSuccess(true)
    setCurrent(''); setNewPass(''); setConfirm('')
    setSaving(false)
  }

  if (isChanged === null) return <Spinner />
  const inp = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1.5px solid #E2E8F0', marginBottom: 14, fontFamily: 'inherit', transition: 'border .2s, box-shadow .2s' }

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ padding: '13px 16px', borderRadius: 10, background: isChanged ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${isChanged ? '#BBF7D0' : '#FED7AA'}`, marginBottom: 22 }}>
        <p style={{ margin: 0, fontSize: 13, color: isChanged ? '#166534' : '#9A3412', fontWeight: 600 }}>
          {isChanged ? '🔐 Password has been changed. Default password is permanently disabled.' : '⚠️ You are using the default password. Change it now.'}
        </p>
      </div>
      {error   && <ErrBox msg={error} />}
      {success && <SuccessBox msg="Password changed successfully." />}
      {[
        { label: 'Current Password',     value: current, set: setCurrent, ph: 'Enter current password' },
        { label: 'New Password',         value: newPass, set: setNewPass, ph: 'Min. 8 characters'      },
        { label: 'Confirm New Password', value: confirm, set: setConfirm, ph: 'Repeat new password'    },
      ].map(f => (
        <div key={f.label}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
          <input type="password" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inp} />
        </div>
      ))}
      <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14 }}>Password hashed with SHA-256 — never stored as plain text.</p>
      <button onClick={handleChange} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#93C5FD' : '#1e3a5f', color: 'white', width: '100%', fontFamily: 'inherit' }}>
        {saving ? '⏳ Updating…' : '🔑 Change Password'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
//  USER MODAL
// ─────────────────────────────────────────────
function UserModal({ existing, onClose, onSaved, currentUser, allStaff = [] }) {
  const isEdit = !!existing
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    username: existing?.username ?? '',
    password: '',
    role: existing?.role ?? 'Teacher',
    // FIX: include staff_profile_id from existing record
    staff_profile_id: existing?.staff_profile_id ? String(existing.staff_profile_id) : '',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  const submit = async () => {
    if (!form.name.trim())     { setErr('Name is required.'); return }
    if (!form.username.trim()) { setErr('Username is required.'); return }
    if (!isEdit && !form.password)           { setErr('Password is required.'); return }
    if (!isEdit && form.password.length < 8) { setErr('Password must be at least 8 characters.'); return }
    setSaving(true); setErr(null)
    if (isEdit) {
      const update = {
        name: form.name.trim(),
        role: form.role,
        updated_at: new Date().toISOString(),
        staff_profile_id: form.staff_profile_id ? parseInt(form.staff_profile_id) : null,
      }
      if (form.password) update.password_hash = await hashPassword(form.password)
      const { error } = await supabase.from('portal_users').update(update).eq('id', existing.id)
      if (error) { setErr(error.message); setSaving(false); return }
      await logAudit(`Updated user: ${form.name}`, currentUser)
    } else {
      const cleanUsername = form.username.trim().toLowerCase()
      // FIX: rely on DB unique constraint; maybeSingle check kept as UX hint only
      const { data: dup } = await supabase.from('portal_users').select('id').eq('username', cleanUsername).maybeSingle()
      if (dup) { setErr('Username already taken.'); setSaving(false); return }
      const hashedPw = await hashPassword(form.password)
      const { error } = await supabase.from('portal_users').insert({
        name: form.name.trim(),
        username: cleanUsername,
        password_hash: hashedPw,
        role: form.role,
        active: true,
        staff_profile_id: form.staff_profile_id ? parseInt(form.staff_profile_id) : null,
      })
      if (error) {
        // FIX: surface DB unique constraint violation as friendly message
        if (error.code === '23505') { setErr('Username already taken.'); setSaving(false); return }
        setErr(error.message); setSaving(false); return
      }
      await logAudit(`Added user: ${form.name} (${form.role})`, currentUser)
    }
    onSaved(); onClose()
  }

  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14, border: '1px solid #E2E8F0', marginBottom: 14, fontFamily: 'inherit', transition: 'border .2s, box-shadow .2s' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16, backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div className="adm-modal-box" style={{ background: 'white', borderRadius: 14, padding: 28, width: 'min(440px,95vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto', animation: 'adm-slidedown .2s ease' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{isEdit ? 'Edit User' : 'Add New User'}</h3>
        {err && <ErrBox msg={err} />}
        {[
          { label: 'Full Name *',  k: 'name',     type: 'text',     ph: 'e.g. Priya Devi',   disabled: false  },
          { label: 'Username *',   k: 'username', type: 'text',     ph: 'priya_devi',         disabled: isEdit },
          { label: isEdit ? 'New Password (leave blank to keep)' : 'Password * (min 8 chars)', k: 'password', type: 'password', ph: '••••••••', disabled: false },
        ].map(f => (
          <div key={f.k}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{f.label}</label>
            <input style={{ ...inp, opacity: f.disabled ? .6 : 1 }} type={f.type} disabled={f.disabled} value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph} />
          </div>
        ))}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Role</label>
        <select style={{ ...inp, marginBottom: 14 }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Link Staff Profile <span style={{ color: '#94A3B8', fontWeight: 400 }}>(for Geo-Attendance)</span></label>
        <select style={{ ...inp, marginBottom: 22 }} value={form.staff_profile_id} onChange={e => setForm(p => ({ ...p, staff_profile_id: e.target.value }))}>
          <option value="">— Not linked —</option>
          {allStaff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving ? '#93C5FD' : '#1D4ED8', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
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
function UsersSection({ currentUser, allStaff = [] }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [modal,    setModal]    = useState(null)
  const [filter,   setFilter]   = useState('All')
  // FIX: search input for users
  const [search,   setSearch]   = useState('')
  const [deleting, setDeleting] = useState(null)
  const [confirm,  setConfirm]  = useState(null)
  const [toast,    setToast]    = useState(null)
  const isMobile = useIsMobile()

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  // FIX: select staff_profile_id so edit modal shows correct linked profile
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('portal_users')
      .select('id,name,username,role,active,created_at,staff_profile_id')
      .order('name')
    if (error) setError(error.message)
    else setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // FIX: optimistic toggle now reverts on error
  const toggleActive = async (user) => {
    const newVal = !user.active
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: newVal } : u))
    const { error } = await supabase.from('portal_users').update({ active: newVal }).eq('id', user.id)
    if (error) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !newVal } : u))
      showToast('❌ Failed to update status')
      return
    }
    await logAudit(`${newVal ? 'Enabled' : 'Disabled'} user: ${user.name}`, currentUser)
  }

  const deleteUser = async (user) => {
    setDeleting(user.id)
    const { error } = await supabase.from('portal_users').delete().eq('id', user.id)
    if (!error) {
      setUsers(prev => prev.filter(u => u.id !== user.id))
      await logAudit(`Deleted user: ${user.name}`, currentUser)
    } else {
      showToast('❌ Delete failed: ' + error.message)
    }
    setDeleting(null); setConfirm(null)
  }

  // FIX: filter by role AND search
  const filtered = users.filter(u => {
    const matchRole = filter === 'All' || u.role === filter
    const q = search.toLowerCase()
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  if (loading) return <Spinner />
  if (error)   return <ErrBox msg={error} />

  return (
    <div>
      <Toast msg={toast} />
      {modal && <UserModal existing={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={fetchUsers} currentUser={currentUser} allStaff={allStaff} />}
      {confirm && <ConfirmModal title={`Delete ${confirm.user.name}?`} message="This will permanently remove the user. This cannot be undone." danger onConfirm={() => deleteUser(confirm.user)} onCancel={() => setConfirm(null)} />}

      <div className="adm-role-filter" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', ...ALL_ROLES].map(r => (
          <button key={r} onClick={() => setFilter(r)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: filter === r ? '1.5px solid #1D4ED8' : '1px solid #E2E8F0', background: filter === r ? '#EFF6FF' : 'white', color: filter === r ? '#1D4ED8' : '#374151', fontWeight: filter === r ? 600 : 400, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{r}</button>
        ))}
        <button onClick={() => setModal('add')} style={{ marginLeft: 'auto', padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#1e3a5f', color: 'white', border: 'none', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>+ Add User</button>
      </div>

      {/* FIX: search bar */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search by name or username…"
          style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid #E2E8F0', width: '100%', maxWidth: 300, fontFamily: 'inherit' }}
        />
      </div>

      <div className="adm-table-wrap" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isMobile ? 600 : 'auto' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Name', 'Username', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', fontSize: 11, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} className="adm-row" style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', transition: 'background .1s' }}>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#1D4ED8', flexShrink: 0 }}>
                      {(u.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <span style={{ color: '#0F172A', whiteSpace: 'nowrap' }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', color: '#64748B', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, whiteSpace: 'nowrap' }}>{u.username}</td>
                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><RoleBadge role={u.role} /></td>
                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.active ? '#22C55E' : '#94A3B8', flexShrink: 0 }} />
                    <span style={{ color: u.active ? '#16A34A' : '#94A3B8' }}>{u.active ? 'Active' : 'Inactive'}</span>
                  </span>
                </td>
                <td style={{ padding: '12px 14px', color: '#94A3B8', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => setModal(u)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit', fontWeight: 500 }}>Edit</button>
                    <button onClick={() => toggleActive(u)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #E2E8F0', background: 'white', color: u.active ? '#b45309' : '#16a34a', fontFamily: 'inherit', fontWeight: 500 }}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                    {/* FIX: block self-delete */}
                    <button
                      onClick={() => setConfirm({ user: u })}
                      disabled={deleting === u.id || u.id === currentUser?.id}
                      title={u.id === currentUser?.id ? 'Cannot delete your own account' : ''}
                      style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', border: '1px solid #FECACA', background: u.id === currentUser?.id ? '#F9FAFB' : '#FEF2F2', color: u.id === currentUser?.id ? '#CBD5E1' : '#DC2626', fontFamily: 'inherit', fontWeight: 500 }}>
                      {deleting === u.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  ROLE PERMISSIONS — CRUD MATRIX
// ─────────────────────────────────────────────
function PermissionsSection({ currentUser }) {
  const [role,    setRole]    = useState('Teacher')
  const [perms,   setPerms]   = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(null)
  const [view,    setView]    = useState('matrix')
  // FIX: copy-from-role feature
  const [copyFrom, setCopyFrom] = useState('')
  const [copying,  setCopying]  = useState(false)

  const fetchPerms = useCallback(async (r) => {
    setLoading(true); setError(null)
    const { data, error } = await supabase
      .from('role_permissions')
      .select('module_key,can_read,can_add,can_edit,can_delete,allowed')
      .eq('role', r)
    if (error) { setError(error.message); setLoading(false); return }
    const map = {}
    ;(data || []).forEach(p => {
      map[p.module_key] = {
        read:   p.can_read   ?? p.allowed ?? false,
        add:    p.can_add    ?? false,
        edit:   p.can_edit   ?? false,
        delete: p.can_delete ?? false,
      }
    })
    setPerms(map); setLoading(false)
  }, [])

  useEffect(() => { fetchPerms(role) }, [role, fetchPerms])

  const toggle = (key, crud) => {
    setPerms(p => ({
      ...p,
      [key]: { ...(p[key] || emptyCrud()), [crud]: !(p[key]?.[crud] ?? false) }
    }))
  }

  const toggleRow = (key) => {
    const cur = perms[key] || emptyCrud()
    const allOn = CRUD_KEYS.every(c => cur[c])
    setPerms(p => ({ ...p, [key]: allOn ? emptyCrud() : fullCrud() }))
  }

  const toggleCol = (crud) => {
    const allOn = ALL_MODULES.every(m => perms[m.key]?.[crud])
    setPerms(p => {
      const next = { ...p }
      ALL_MODULES.forEach(m => {
        next[m.key] = { ...(p[m.key] || emptyCrud()), [crud]: !allOn }
      })
      return next
    })
  }

  const selectAll = () => {
    const map = {}
    ALL_MODULES.forEach(m => { map[m.key] = fullCrud() })
    setPerms(map)
  }
  const clearAll = () => {
    const map = {}
    ALL_MODULES.forEach(m => { map[m.key] = emptyCrud() })
    setPerms(map)
  }

  // FIX: copy permissions from another role
  const handleCopyFrom = async () => {
    if (!copyFrom || copyFrom === role) return
    setCopying(true)
    const { data } = await supabase
      .from('role_permissions')
      .select('module_key,can_read,can_add,can_edit,can_delete,allowed')
      .eq('role', copyFrom)
    const map = {}
    ;(data || []).forEach(p => {
      map[p.module_key] = {
        read:   p.can_read   ?? p.allowed ?? false,
        add:    p.can_add    ?? false,
        edit:   p.can_edit   ?? false,
        delete: p.can_delete ?? false,
      }
    })
    setPerms(map); setCopyFrom(''); setCopying(false)
  }

  const savePerms = async () => {
    setSaving(true); setError(null)
    try {
      const rows = ALL_MODULES.map(m => {
        const c = perms[m.key] || emptyCrud()
        return {
          role,
          module_key: m.key,
          allowed:    c.read,
          can_read:   c.read,
          can_add:    c.add,
          can_edit:   c.edit,
          can_delete: c.delete,
        }
      })
      const { error } = await supabase
        .from('role_permissions')
        .upsert(rows, { onConflict: 'role,module_key' })
      if (error) throw error
      await logAudit(`Updated CRUD permissions for role: ${role}`, currentUser)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const colStats = (crud) => {
    const on = ALL_MODULES.filter(m => perms[m.key]?.[crud]).length
    return `${on}/${ALL_MODULES.length}`
  }

  return (
    <div>
      {error && <ErrBox msg={error} />}

      <div className="adm-role-filter" style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {ALL_ROLES.map(r => (
          <button key={r} onClick={() => setRole(r)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: role === r ? '1.5px solid #1D4ED8' : '1px solid #E2E8F0', background: role === r ? '#EFF6FF' : 'white', color: role === r ? '#1D4ED8' : '#374151', fontWeight: role === r ? 700 : 400, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{r}</button>
        ))}
      </div>

      {/* FIX: copy-from-role row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E', whiteSpace: 'nowrap' }}>📋 Copy from role:</span>
        <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 13, border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit', flex: 1, maxWidth: 220 }}>
          <option value="">— Select role —</option>
          {ALL_ROLES.filter(r => r !== role).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={handleCopyFrom} disabled={!copyFrom || copying} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: copyFrom ? 'pointer' : 'not-allowed', border: 'none', background: copyFrom ? '#D97706' : '#E5E7EB', color: copyFrom ? 'white' : '#9CA3AF', fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {copying ? '⏳ Copying…' : 'Copy'}
        </button>
        <span style={{ fontSize: 11, color: '#92400E' }}>Overwrites current selection (not saved until you click Save)</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
          {[['matrix', '⊞ Matrix'], ['cards', '▦ Cards']].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none', background: view === k ? 'white' : 'transparent', color: view === k ? '#1D4ED8' : '#64748B', fontWeight: view === k ? 700 : 400, fontFamily: 'inherit', boxShadow: view === k ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button onClick={selectAll} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit' }}>✓ All</button>
          <button onClick={clearAll}  style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit' }}>✗ Clear</button>
          <button onClick={savePerms} disabled={saving} style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: 'none', background: saved ? '#16A34A' : saving ? '#93C5FD' : '#1D4ED8', color: 'white', fontWeight: 700, fontFamily: 'inherit' }}>
            {saved ? '✓ Saved!' : saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : view === 'matrix' ? (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div className="adm-table-wrap">
            <table className="perm-matrix" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', minWidth: 160 }}>Module</th>
                  {CRUD_KEYS.map(k => (
                    <th key={k} style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => toggleCol(k)} title={`Toggle all ${k}`} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${CRUD_COLORS[k]}33`, background: CRUD_BG[k], color: CRUD_COLORS[k], fontFamily: 'inherit' }}>
                          {CRUD_LABELS[k]}
                        </button>
                        <span style={{ fontSize: 10, color: '#94A3B8' }}>{colStats(k)}</span>
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', minWidth: 80, color: '#64748B', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>All</th>
                </tr>
              </thead>
              <tbody>
                {ALL_MODULES.map((m, i) => {
                  const cur = perms[m.key] || emptyCrud()
                  const allOn = CRUD_KEYS.every(c => cur[c])
                  const anyOn = CRUD_KEYS.some(c => cur[c])
                  return (
                    <tr key={m.key} style={{ borderBottom: i < ALL_MODULES.length - 1 ? '1px solid #F1F5F9' : 'none', background: anyOn ? '#FAFCFF' : 'white' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>{m.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{m.label}</div>
                            <CrudSummaryChips crud={cur} />
                          </div>
                        </div>
                      </td>
                      {CRUD_KEYS.map(k => (
                        <td key={k} style={{ textAlign: 'center', padding: '10px 8px' }}>
                          <CrudToggle active={cur[k]} type={k} onClick={() => toggle(m.key, k)} />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <button onClick={() => toggleRow(m.key)} title={allOn ? 'Clear all' : 'Grant all'} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', background: allOn ? '#1e3a5f' : '#F1F5F9', color: allOn ? 'white' : '#94A3B8', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {allOn ? '✓' : '·'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="adm-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {ALL_MODULES.map(m => {
            const cur = perms[m.key] || emptyCrud()
            const anyOn = CRUD_KEYS.some(c => cur[c])
            return (
              <div key={m.key} style={{ background: 'white', border: `1.5px solid ${anyOn ? '#BFDBFE' : '#E2E8F0'}`, borderRadius: 12, padding: '14px', transition: 'all .12s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{m.label}</span>
                  <button onClick={() => toggleRow(m.key)} style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', background: CRUD_KEYS.every(c => cur[c]) ? '#1e3a5f' : '#F1F5F9', color: CRUD_KEYS.every(c => cur[c]) ? 'white' : '#64748B', fontWeight: 700, fontFamily: 'inherit' }}>
                    {CRUD_KEYS.every(c => cur[c]) ? 'All ✓' : 'All'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {CRUD_KEYS.map(k => (
                    <button key={k} onClick={() => toggle(m.key, k)} style={{ padding: '6px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${cur[k] ? CRUD_COLORS[k] : '#E2E8F0'}`, background: cur[k] ? CRUD_BG[k] : 'white', color: cur[k] ? CRUD_COLORS[k] : '#94A3B8', textAlign: 'left' }}>
                      {CRUD_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 14px', background: 'white', borderRadius: 10, border: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Legend:</span>
        {CRUD_KEYS.map(k => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: CRUD_COLORS[k], fontWeight: 600 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: CRUD_BG[k], border: `1px solid ${CRUD_COLORS[k]}` }} />
            {CRUD_LABELS[k]}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>Click column headers to toggle entire column · Click row "All" to toggle entire row</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  USER OVERRIDES — CRUD
// ─────────────────────────────────────────────
function OverridesSection({ currentUser }) {
  const [users,     setUsers]     = useState([])
  const [selUser,   setSelUser]   = useState(null)
  const [rolePerms, setRolePerms] = useState({})
  const [overrides, setOverrides] = useState({})
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(null)
  const [reason,    setReason]    = useState('')
  const [reasonErr, setReasonErr] = useState(false)
  const [toast,     setToast]     = useState(null)
  // FIX: ref to clear previous toast timer before setting a new one
  const toastTimerRef = useRef(null)

  useEffect(() => {
    supabase.from('portal_users').select('id,name,username,role,active').order('name').then(({ data }) => setUsers(data || []))
  }, [])

  const loadUser = useCallback(async (user) => {
    setSelUser(user); setLoading(true); setReason(''); setReasonErr(false)
    const [{ data: rp }, { data: ov }] = await Promise.all([
      supabase.from('role_permissions').select('module_key,can_read,can_add,can_edit,can_delete,allowed').eq('role', user.role),
      supabase.from('user_module_overrides').select('module_key,can_read,can_add,can_edit,can_delete,allowed,reason,expires_at').eq('user_id', user.id),
    ])
    const rmap = {}
    ;(rp || []).forEach(p => {
      rmap[p.module_key] = {
        read:   p.can_read   ?? p.allowed ?? false,
        add:    p.can_add    ?? false,
        edit:   p.can_edit   ?? false,
        delete: p.can_delete ?? false,
      }
    })
    const omap = {}
    ;(ov || []).forEach(o => {
      omap[o.module_key] = {
        read:       o.can_read   ?? o.allowed ?? false,
        add:        o.can_add    ?? false,
        edit:       o.can_edit   ?? false,
        delete:     o.can_delete ?? false,
        reason:     o.reason,
        expires_at: o.expires_at,
      }
    })
    setRolePerms(rmap); setOverrides(omap); setLoading(false)
  }, [])

  // FIX: clear previous timer before showing new toast to avoid flicker
  const showToast = msg => {
    clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }

  const applyOverrideCrud = async (moduleKey, crud) => {
    if (!selUser) return
    // FIX: enforce reason is required
    if (!reason.trim()) {
      setReasonErr(true)
      showToast('⚠️ Reason is required before saving an override')
      return
    }
    setReasonErr(false)
    setSaving(moduleKey)
    const payload = {
      user_id:    selUser.id,
      module_key: moduleKey,
      can_read:   crud.read,
      can_add:    crud.add,
      can_edit:   crud.edit,
      can_delete: crud.delete,
      allowed:    crud.read,
      reason:     reason.trim(),
      set_by:     currentUser?.username ?? 'Admin',
    }
    const { error } = await supabase.from('user_module_overrides').upsert(payload, { onConflict: 'user_id,module_key' })
    if (error) { showToast('❌ Error: ' + error.message); setSaving(null); return }
    setOverrides(prev => ({ ...prev, [moduleKey]: { ...crud, reason: reason.trim() } }))
    await logAudit(`Override CRUD: ${selUser.name} → ${moduleKey}`, currentUser)
    showToast(`✅ Override saved for ${moduleKey}`)
    setSaving(null)
  }

  const removeOverride = async (moduleKey) => {
    if (!selUser) return
    setSaving(moduleKey)
    await supabase.from('user_module_overrides').delete().eq('user_id', selUser.id).eq('module_key', moduleKey)
    setOverrides(prev => { const n = { ...prev }; delete n[moduleKey]; return n })
    showToast(`↩️ Override removed for ${moduleKey}`)
    setSaving(null)
  }

  const toggleOverrideCrud = (moduleKey, crudKey) => {
    // FIX: validate reason before allowing toggle save
    if (!reason.trim()) {
      setReasonErr(true)
      showToast('⚠️ Enter a reason before changing overrides')
      return
    }
    const base = overrides[moduleKey] || rolePerms[moduleKey] || emptyCrud()
    const next = { ...base, [crudKey]: !base[crudKey] }
    applyOverrideCrud(moduleKey, next)
  }

  // FIX: cross-user overrides summary tab
  const activeCount = Object.keys(overrides).length

  return (
    <div className="adm-overrides-layout" style={{ display: 'flex', gap: 20, minHeight: 500 }}>
      <Toast msg={toast} />
      <div className="adm-user-list-col" style={{ width: 220, flexShrink: 0, border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start', background: 'white' }}>
        <div style={{ padding: '10px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '.08em', textTransform: 'uppercase' }}>SELECT USER</div>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {users.map(u => (
            <div key={u.id} onClick={() => loadUser(u)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', background: selUser?.id === u.id ? '#EFF6FF' : 'white', borderLeft: selUser?.id === u.id ? '3px solid #1D4ED8' : '3px solid transparent', transition: 'all .12s' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: selUser?.id === u.id ? '#1D4ED8' : '#0F172A' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{u.role}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!selUser ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', border: '2px dashed #E2E8F0', borderRadius: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚡</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#64748B' }}>Select a user to manage overrides</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>CRUD overrides bypass role permissions</div>
          </div>
        ) : loading ? <Spinner /> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '12px 16px', background: 'white', borderRadius: 10, border: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#1D4ED8', flexShrink: 0 }}>
                {selUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{selUser.name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{selUser.username} · <RoleBadge role={selUser.role} /></div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>{activeCount} override{activeCount !== 1 ? 's' : ''} active</div>
            </div>

            {/* FIX: reason field with validation highlight */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                Reason for override <span style={{ color: '#EF4444', fontSize: 11 }}>* required before any change</span>
              </label>
              <input
                value={reason}
                onChange={e => { setReason(e.target.value); if (e.target.value.trim()) setReasonErr(false) }}
                placeholder="e.g. Temporary access for audit period"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: `1.5px solid ${reasonErr ? '#EF4444' : '#E2E8F0'}`, fontFamily: 'inherit', boxShadow: reasonErr ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none' }}
              />
              {reasonErr && <p style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>Please enter a reason before changing overrides.</p>}
            </div>

            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
              <div className="adm-table-wrap">
                <table className="perm-matrix" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', minWidth: 160 }}>Module</th>
                      <th style={{ textAlign: 'center', color: '#64748B', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', minWidth: 80 }}>Role Default</th>
                      {CRUD_KEYS.map(k => (
                        <th key={k} style={{ textAlign: 'center', minWidth: 70, padding: '10px 6px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: CRUD_COLORS[k] }}>{k.toUpperCase()}</span>
                        </th>
                      ))}
                      <th style={{ textAlign: 'center', color: '#64748B', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', minWidth: 70 }}>Reset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MODULES.map((m, i) => {
                      const rp = rolePerms[m.key] || emptyCrud()
                      const ov = overrides[m.key]
                      const cur = ov ? { read: ov.read, add: ov.add, edit: ov.edit, delete: ov.delete } : rp
                      const hasOverride = !!ov
                      const isSaving = saving === m.key
                      return (
                        <tr key={m.key} style={{ borderBottom: i < ALL_MODULES.length - 1 ? '1px solid #F1F5F9' : 'none', background: hasOverride ? '#FFFBEB' : 'white' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{m.icon}</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 12, color: '#0F172A' }}>{m.label}</div>
                                {hasOverride && (
                                  <div>
                                    <span style={{ fontSize: 10, color: '#D97706', fontWeight: 700 }}>⚡ overridden</span>
                                    {ov.reason && <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4 }}>· {ov.reason}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                            <CrudSummaryChips crud={rp} />
                          </td>
                          {CRUD_KEYS.map(k => (
                            <td key={k} style={{ textAlign: 'center', padding: '10px 4px' }}>
                              <CrudToggle active={cur[k]} type={k} onClick={() => !isSaving && toggleOverrideCrud(m.key, k)} />
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                            {hasOverride ? (
                              <button onClick={() => !isSaving && removeOverride(m.key)} disabled={isSaving} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontFamily: 'inherit' }}>
                                {isSaving ? '…' : '↩️'}
                              </button>
                            ) : <span style={{ color: '#E2E8F0' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
  const [logs,     setLogs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [range,    setRange]    = useState('7d')
  const [viewMode, setViewMode] = useState('bar')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 1
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1))
      const { data } = await supabase.from('module_access_logs').select('module_key,role,username,accessed_at').gte('accessed_at', d.toISOString())
      setLogs(data || []); setLoading(false)
    })()
  }, [range])

  const byModule = ALL_MODULES.map(m => ({ key: m.key, label: m.label, icon: m.icon, count: logs.filter(l => l.module_key === m.key).length })).sort((a, b) => b.count - a.count)
  const byRole   = ALL_ROLES.map(r => ({ role: r, count: logs.filter(l => l.role === r).length })).filter(r => r.count > 0).sort((a, b) => b.count - a.count)
  const dead     = byModule.filter(m => m.count === 0)

  // FIX: sort daily map chronologically
  const dailyMap = {}
  logs.forEach(l => {
    const day = new Date(l.accessed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    dailyMap[day] = (dailyMap[day] || 0) + 1
  })
  const daily = Object.entries(dailyMap)
    .map(([day, count]) => ({ day, count, _ts: new Date(day) }))
    .sort((a, b) => a._ts - b._ts)
    .map(({ day, count }) => ({ day, count }))

  // FIX: top users breakdown
  const byUser = {}
  logs.forEach(l => { if (l.username) byUser[l.username] = (byUser[l.username] || 0) + 1 })
  const topUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const COLORS = ['#1e3a5f', '#1D4ED8', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE']

  if (loading) return <Spinner />

  return (
    <div>
      <div className="adm-filter-row" style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['7d', 'Last 7 Days'], ['30d', 'Last 30 Days'], ['1d', 'Today']].map(([k, l]) => (
          <button key={k} onClick={() => setRange(k)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: range === k ? '1.5px solid #1D4ED8' : '1px solid #E2E8F0', background: range === k ? '#EFF6FF' : 'white', color: range === k ? '#1D4ED8' : '#374151', fontWeight: range === k ? 600 : 400, fontFamily: 'inherit' }}>{l}</button>
        ))}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[['bar', '📊 Bar'], ['radar', '🕸️ Radar']].map(([k, l]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: viewMode === k ? '1.5px solid #1D4ED8' : '1px solid #E2E8F0', background: viewMode === k ? '#EFF6FF' : 'white', color: viewMode === k ? '#1D4ED8' : '#374151', fontFamily: 'inherit' }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="adm-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Events',      value: logs.length,                           icon: '📌', color: '#1D4ED8' },
          { label: 'Modules Used',      value: byModule.filter(m => m.count > 0).length, icon: '🗂️', color: '#7C3AED' },
          { label: 'Most Active Role',  value: byRole[0]?.role?.split(' ')[0] ?? '—',  icon: '👑', color: '#D97706' },
          { label: 'Unused Modules',    value: dead.length,                            icon: '💤', color: '#DC2626' },
        ].map(c => (
          <div key={c.label} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: "'JetBrains Mono',monospace" }}>{c.value}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div className="adm-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 18, border: '1px solid #E2E8F0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#0F172A' }}>Module Access Count</div>
          {logs.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No access data yet.</div>
            : viewMode === 'bar' ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byModule.slice(0, 12)} layout="vertical" margin={{ left: 60, right: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={v => [v, 'Accesses']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>{byModule.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={byModule.slice(0, 10).map(m => ({ subject: m.label, A: m.count }))}>
                  <PolarGrid /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <Radar dataKey="A" stroke="#1D4ED8" fill="#1D4ED8" fillOpacity={0.25} /><Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: 18, border: '1px solid #E2E8F0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#0F172A' }}>Daily Access Trend</div>
          {daily.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No data available.</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={daily}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} name="Accesses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* FIX: top users breakdown */}
      {topUsers.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 12 }}>👤 Top Users by Access</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topUsers.map(([uname, cnt], idx) => (
              <div key={uname} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#94A3B8', width: 16, textAlign: 'right' }}>#{idx + 1}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: '#0F172A', flex: 1 }}>{uname}</span>
                <div style={{ flex: 3, background: '#F1F5F9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((cnt / topUsers[0][1]) * 100)}%`, height: '100%', background: '#1D4ED8', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', minWidth: 28, textAlign: 'right' }}>{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dead.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400E', marginBottom: 10 }}>💤 Unused Modules ({dead.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dead.map(m => <span key={m.key} style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 12, padding: '3px 10px' }}>{m.icon} {m.label}</span>)}
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
  // FIX: track true server total separately from fetched rows
  const [serverTotal, setServerTotal] = useState(0)
  const PAGE = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('module_access_logs')
      .select('id,username,role,module_key,accessed_at', { count: 'exact' })
      .order('accessed_at', { ascending: false })
      .limit(500)
    if (module !== 'all') q = q.eq('module_key', module)
    if (role   !== 'all') q = q.eq('role', role)
    const { data, count } = await q
    setLogs(data || []); setServerTotal(count || 0); setPage(0); setLoading(false)
  }, [module, role])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered  = logs.filter(l => !search || l.username?.toLowerCase().includes(search.toLowerCase()) || l.module_key?.includes(search.toLowerCase()))
  const paginated = filtered.slice(page * PAGE, (page + 1) * PAGE)
  const totalPages = Math.ceil(filtered.length / PAGE)
  const modMeta   = key => ALL_MODULES.find(m => m.key === key) || { icon: '🔷', label: key }

  // FIX: export to CSV
  const exportCSV = () => {
    const rows = [['Module', 'Username', 'Role', 'Accessed At']]
    filtered.forEach(l => {
      const meta = modMeta(l.module_key)
      rows.push([meta.label, l.username || '', l.role || '', new Date(l.accessed_at).toLocaleString('en-IN')])
    })
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `access-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div>
      <div className="adm-filter-row" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="🔍 Search user or module…" style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid #E2E8F0', width: 200, fontFamily: 'inherit' }} />
        <select value={module} onChange={e => setModule(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit' }}>
          <option value="all">All Modules</option>
          {ALL_MODULES.map(m => <option key={m.key} value={m.key}>{m.icon} {m.label}</option>)}
        </select>
        <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit' }}>
          <option value="all">All Roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {/* FIX: clear caption of fetched vs total */}
        <span style={{ fontSize: 12, color: serverTotal > 500 ? '#D97706' : '#94A3B8' }}>
          {filtered.length} shown · {serverTotal} total{serverTotal > 500 ? ' (showing latest 500)' : ''}
        </span>
        <button onClick={exportCSV} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit', fontWeight: 600 }}>⬇️ Export CSV</button>
      </div>
      {loading ? <Spinner /> : (
        <>
          <div className="adm-table-wrap" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Module', 'User', 'Role', 'Accessed At'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((l, i) => {
                  const meta = modMeta(l.module_key)
                  return (
                    <tr key={l.id} className="adm-row" style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '2px 10px' }}>{meta.icon} {meta.label}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{l.username || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><RoleBadge role={l.role} /></td>
                      <td style={{ padding: '10px 14px', color: '#64748B', fontSize: 12 }}>{new Date(l.accessed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    </tr>
                  )
                })}
                {paginated.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No access events found.</td></tr>}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>← Prev</button>
              <span style={{ fontSize: 13, color: '#64748B' }}>Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  AUDIT LOGS
// ─────────────────────────────────────────────
function AuditSection() {
  const [logs,      setLogs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')
  // FIX: date range filter + user filter + export
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
      setLogs(data || []); setLoading(false)
    })()
  }, [])

  if (loading) return <Spinner />

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.level !== filter) return false
    if (userFilter && !l.user_name?.toLowerCase().includes(userFilter.toLowerCase())) return false
    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
      if (new Date(l.created_at) < from) return false
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      if (new Date(l.created_at) > to) return false
    }
    return true
  })

  const exportAuditCSV = () => {
    const rows = [['Time', 'User', 'Level', 'Action']]
    filtered.forEach(l => rows.push([new Date(l.created_at).toLocaleString('en-IN'), l.user_name || '', l.level || '', l.action || '']))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const levelStyle = {
    info:    { bg: '#EFF6FF', border: '#BFDBFE' },
    warning: { bg: '#FFFBEB', border: '#FDE68A' },
    danger:  { bg: '#FEF2F2', border: '#FECACA' },
  }

  const inp = { padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'info', 'warning', 'danger'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize', border: filter === f ? '1.5px solid #1D4ED8' : '1px solid #E2E8F0', background: filter === f ? '#EFF6FF' : 'white', color: filter === f ? '#1D4ED8' : '#374151', fontWeight: filter === f ? 600 : 400, fontFamily: 'inherit' }}>
            {f === 'all' ? 'All Events' : f}
          </button>
        ))}
      </div>
      {/* FIX: date range + user search row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="🔍 Filter by user…" style={{ ...inp, width: 180 }} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{filtered.length} events</span>
        <button onClick={exportAuditCSV} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #E2E8F0', background: 'white', fontFamily: 'inherit', fontWeight: 600 }}>⬇️ Export CSV</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(log => {
          const s = levelStyle[log.level] || levelStyle.info
          return (
            <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 10, border: `1px solid ${s.border}`, background: s.bg }}>
              <span style={{ flexShrink: 0 }}>{{ info: 'ℹ️', warning: '⚠️', danger: '🚨' }[log.level] || '•'}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#0F172A', wordBreak: 'break-word' }}>{log.action}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748B' }}>{log.user_name} · {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>No events found.</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────
export default function AdminPage({ currentUser, onLogout, allStaff = [] }) {
  const [activeTab,     setActiveTab]     = useState('users')
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [idleWarning,   setIdleWarning]   = useState(false)
  const isMobile = useIsMobile()

  // FIX: auto-logout on idle — warn at 25 min, logout at 30 min
  const handleIdle = useCallback(() => {
    setIdleWarning(true)
    setTimeout(() => { onLogout?.() }, 5 * 60 * 1000)
  }, [onLogout])
  useIdleTimeout(handleIdle, 25 * 60 * 1000)

  // FIX: admin role check — block non-admin users
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', fontFamily: "'Plus Jakarta Sans',sans-serif", padding: 16 }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', maxWidth: 360, width: '100%' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Access Denied</h2>
          <p style={{ color: '#64748B', fontSize: 14 }}>You must be logged in to access the admin panel.</p>
        </div>
      </div>
    )
  }

  const ADMIN_ROLES = ['Admin', 'Administrator']
  if (!ADMIN_ROLES.includes(currentUser.role)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', fontFamily: "'Plus Jakarta Sans',sans-serif", padding: 16 }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 16, border: '1px solid #FECACA', maxWidth: 400, width: '100%' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>Not Authorised</h2>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 20 }}>
            Your account (<strong>{currentUser.username}</strong>) does not have admin privileges.
          </p>
          <button onClick={onLogout} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>← Back to Portal</button>
        </div>
      </div>
    )
  }

  const activeNav = NAV.find(t => t.id === activeTab)

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>

      {logoutConfirm && (
        <ConfirmModal title="Log out?" message="Are you sure you want to log out?" onConfirm={() => { setLogoutConfirm(false); onLogout?.() }} onCancel={() => setLogoutConfirm(false)} />
      )}

      {/* FIX: idle session warning banner */}
      {idleWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1300, background: '#DC2626', color: 'white', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, gap: 10 }}>
          <span>⚠️ Your session is about to expire due to inactivity. You will be logged out in 5 minutes.</span>
          <button onClick={() => setIdleWarning(false)} style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', flexShrink: 0 }}>
            Stay Logged In
          </button>
        </div>
      )}

      <div style={{ background: 'linear-gradient(135deg, #0f2847 0%, #1e3a5f 60%, #1a3355 100%)', boxShadow: '0 2px 20px rgba(15,40,71,0.4)', marginTop: idleWarning ? 44 : 0 }}>
        <div style={{ padding: isMobile ? '14px 16px' : '16px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔐</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-.02em' }}>Admin Panel</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>GNSI Portal · Khangabok, Manipur</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 0 2px rgba(74,222,128,0.3)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{currentUser?.name ?? 'Admin'}</span>
            </div>
            <button
              onClick={() => setLogoutConfirm(true)}
              style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: 'inherit', fontWeight: 500 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}>
              🚪 {isMobile ? '' : 'Logout'}
            </button>
          </div>
        </div>

        <div className="adm-tab-scroll" style={{ paddingLeft: isMobile ? 8 : 20, display: 'flex', gap: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {NAV.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} className="adm-tab-btn" onClick={() => setActiveTab(tab.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: isMobile ? '10px 14px' : '11px 20px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: isMobile ? 12 : 13,
                fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', flexShrink: 0,
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                borderBottom: isActive ? '2.5px solid white' : '2.5px solid transparent',
                borderRadius: '0', transition: 'all .15s', position: 'relative',
              }}>
                <span style={{ fontSize: isMobile ? 14 : 15 }}>{tab.icon}</span>
                {!isMobile && <span>{tab.label}</span>}
                {isMobile && <span>{tab.label.split(' ')[0]}</span>}
                {tab.badge && <span style={{ fontSize: 9, fontWeight: 800, background: '#FBBF24', color: '#78350F', borderRadius: 4, padding: '1px 5px', letterSpacing: '.04em' }}>{tab.badge}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="adm-main-pad" style={{ padding: isMobile ? '16px' : '28px', maxWidth: 1300, margin: '0 auto' }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{activeNav?.icon}</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: '-.02em' }}>{activeNav?.label}</h2>
        </div>
        <div style={{ animation: 'adm-fadein .18s ease' }} key={activeTab}>
          {activeTab === 'users'       && <UsersSection       currentUser={currentUser} allStaff={allStaff} />}
          {activeTab === 'permissions' && <PermissionsSection currentUser={currentUser} />}
          {activeTab === 'overrides'   && <OverridesSection   currentUser={currentUser} />}
          {activeTab === 'analytics'   && <AnalyticsSection />}
          {activeTab === 'accesslogs'  && <AccessLogsSection />}
          {activeTab === 'password'    && <ChangePasswordSection currentUser={currentUser} />}
          {activeTab === 'audit'       && <AuditSection />}
          {activeTab === 'website'     && <WebsiteTab />} 
        </div>
      </div>
    </div>
  )
}