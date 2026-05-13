import { useState, useEffect } from 'react'
import { supabase } from './lib/Supabase'

const ALL_MODULES = [
  { group: 'CORE',        items: [
    { id: 'dashboard',          label: 'Dashboard' },
    { id: 'students',           label: 'Students' },
    { id: 'admissions',         label: 'Admissions' },
    { id: 'bulk-admission-fee', label: 'Bulk Admission' },
  ]},
  { group: 'FINANCE',     items: [
    { id: 'fees',     label: 'Fees' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'salary',   label: 'Salary' },
  ]},
  { group: 'ACADEMIC',    items: [
    { id: 'attendance', label: 'Attendance' },
    { id: 'exams',      label: 'Exams' },
    { id: 'timetable',  label: 'Timetable' },
    { id: 'teaching',   label: 'Teaching' },
    { id: 'courses',    label: 'Courses' },
  ]},
  { group: 'PEOPLE',      items: [
    { id: 'staff',  label: 'Staff' },
    { id: 'hr',     label: 'HR' },
    { id: 'leave',  label: 'Leave' },
    { id: 'hostel', label: 'Hostel' },
  ]},
  { group: 'OPERATIONS',  items: [
    { id: 'reception', label: 'Reception' },
    { id: 'notice',    label: 'Notice' },
    { id: 'social',    label: 'Social' },
    { id: 'connect',   label: 'Connect' },
  ]},
  { group: 'MANAGEMENT',  items: [
    { id: 'reports',              label: 'Reports' },
    { id: 'management-checklist', label: 'Checklist' },
    { id: 'admin',                label: 'Admin' },
    { id: 'system',               label: 'System' },
  ]},
]

const ROLES = ['manager', 'accountant', 'teacher', 'hostel', 'reception']

const S = {
  bg:         '#f8fafc',
  card:       '#ffffff',
  border:     '#e2e8f0',
  accent:     '#3b82f6',
  accentBg:   '#eff6ff',
  text:       '#1e293b',
  textMuted:  '#64748b',
  success:    '#22c55e',
  successBg:  '#f0fdf4',
  danger:     '#ef4444',
  dangerBg:   '#fef2f2',
}

export default function RolePermissions() {
  const [permissions, setPermissions] = useState({})
  const [activeRole, setActiveRole] = useState('manager')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data, error } = await supabase
      .from('role_permissions')
      .select('role, module_key, allowed')
      .neq('role', 'admin')

    if (!error && data) {
      const map = {}
      data.forEach(({ role, module_key, allowed }) => {
        if (!map[role]) map[role] = {}
        map[role][module_key] = allowed
      })
      setPermissions(map)
    }
    setLoading(false)
  }

  async function toggle(moduleId) {
    const current = permissions[activeRole]?.[moduleId] ?? false
    const newVal = !current

    setPermissions(prev => ({
      ...prev,
      [activeRole]: { ...prev[activeRole], [moduleId]: newVal }
    }))

    setSaving(true)
    const { error } = await supabase
      .from('role_permissions')
      .upsert({ role: activeRole, module_key: moduleId, allowed: newVal },
               { onConflict: 'role,module_key' })

    setSaving(false)
    if (error) {
      showToast('Failed to save', 'error')
      // revert
      setPermissions(prev => ({
        ...prev,
        [activeRole]: { ...prev[activeRole], [moduleId]: current }
      }))
    } else {
      showToast('Saved!', 'success')
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2000)
  }

  function enableAll() {
    const updates = {}
    ALL_MODULES.forEach(g => g.items.forEach(i => { updates[i.id] = true }))
    setPermissions(prev => ({ ...prev, [activeRole]: updates }))
    saveAll(updates)
  }

  function disableAll() {
    const updates = {}
    ALL_MODULES.forEach(g => g.items.forEach(i => { updates[i.id] = false }))
    setPermissions(prev => ({ ...prev, [activeRole]: updates }))
    saveAll(updates)
  }

  async function saveAll(updates) {
    setSaving(true)
    const rows = Object.entries(updates).map(([module_key, allowed]) => ({
      role: activeRole, module_key, allowed
    }))
    await supabase.from('role_permissions')
      .upsert(rows, { onConflict: 'role,module_key' })
    setSaving(false)
    showToast('All saved!', 'success')
  }

  const rolePerms = permissions[activeRole] || {}
  const enabledCount = Object.values(rolePerms).filter(Boolean).length

  return (
    <div style={{ padding: '24px', fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 900 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>
          🔐 Role Permissions
        </h2>
        <p style={{ color: S.textMuted, fontSize: 14, margin: '4px 0 0' }}>
          Control which modules each role can access
        </p>
      </div>

      {/* Role tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {ROLES.map(role => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: `1.5px solid ${activeRole === role ? S.accent : S.border}`,
              background: activeRole === role ? S.accentBg : S.card,
              color: activeRole === role ? S.accent : S.textMuted,
              fontWeight: activeRole === role ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {role}
          </button>
        ))}
      </div>

      {/* Actions bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 13, color: S.textMuted }}>
          <b style={{ color: S.text }}>{enabledCount}</b> modules enabled for <b style={{ color: S.accent, textTransform: 'capitalize' }}>{activeRole}</b>
          {saving && <span style={{ marginLeft: 10, color: S.accent }}>Saving…</span>}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={enableAll} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${S.success}`, background: S.successBg, color: '#166534',
          }}>Enable All</button>
          <button onClick={disableAll} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${S.danger}`, background: S.dangerBg, color: '#991b1b',
          }}>Disable All</button>
        </div>
      </div>

      {/* Module groups */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: S.textMuted }}>Loading permissions…</div>
      ) : (
        ALL_MODULES.map(group => (
          <div key={group.group} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em',
              color: S.textMuted, textTransform: 'uppercase', marginBottom: 8,
            }}>{group.group}</div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8,
            }}>
              {group.items.map(item => {
                const enabled = rolePerms[item.id] ?? false
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1.5px solid ${enabled ? '#86efac' : S.border}`,
                      background: enabled ? S.successBg : S.card,
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    <span style={{
                      fontSize: 13, fontWeight: 500,
                      color: enabled ? '#166534' : S.textMuted,
                    }}>{item.label}</span>
                    <div style={{
                      width: 36, height: 20, borderRadius: 99,
                      background: enabled ? S.success : '#cbd5e1',
                      position: 'relative', transition: 'background .2s', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: 2,
                        left: enabled ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff', transition: 'left .2s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          padding: '10px 20px', borderRadius: 8,
          background: toast.type === 'success' ? '#166534' : '#991b1b',
          color: '#fff', fontSize: 13, fontWeight: 500,
          zIndex: 999,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}