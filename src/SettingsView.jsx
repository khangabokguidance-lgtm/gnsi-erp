// SettingsView.jsx — Settings tab for FaceAttendance.jsx.
//
// Deliberately NOT a rebuild of things that already work elsewhere:
//   - Roles & Permissions        -> links to RolePermissions.jsx (existing)
//   - Shifts / Geofence          -> links to GeoAttendance's admin Geo tab (existing)
//   - Cash book                  -> already a tab in FaceAttendance.jsx
// New, genuinely missing pieces built here:
//   - Manage Users (portal_users list, read + role display)
//   - Admin Setting (who currently has admin role)
//   - Weekly Holiday, Departments (org_settings table)
//   - Profile info, Language, Logout (local/simple)

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const S = {
  card: { background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.07)', padding: 16, marginBottom: 12 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 44 },
  sectionTitle: { fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, margin: '18px 0 8px 4px' },
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function SettingsRow({ label, sub, onClick, right, danger }) {
  return (
    <div onClick={onClick} style={{ ...S.row, cursor: onClick ? 'pointer' : 'default' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: danger ? '#dc2626' : '#1e293b' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
      {right !== undefined ? right : (onClick && <span style={{ color: '#cbd5e1', fontSize: 18 }}>›</span>)}
    </div>
  )
}

// ─── Manage Users ───────────────────────────────────────────────────────────

function ManageUsersPanel({ onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('portal_users')
        .select('id, username, role, staff_profile_id, staff_profiles(name, designation)')
        .order('username')
      if (!cancelled && !error) setUsers(data || [])
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <BackHeader title="Manage users" onBack={onBack} />
      <div style={S.card}>
        {loading ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p> : (
          <div>
            {users.map(u => (
              <div key={u.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{u.username}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {u.staff_profiles?.name ? `${u.staff_profiles.name} · ${u.staff_profiles.designation || ''}` : 'No linked staff profile'}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', textTransform: 'capitalize' }}>
                    {u.role}
                  </span>
                </div>
              </div>
            ))}
            {!users.length && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No user accounts found.</p>}
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', padding: '0 4px' }}>
        To change a user's role, use Roles & Permissions or your admin account tools directly in the database — this is a read-only view.
      </p>
    </div>
  )
}

// ─── Admin Setting — who currently has admin role ──────────────────────────

function AdminSettingPanel({ onBack }) {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('portal_users')
        .select('id, username, staff_profiles(name)')
        .eq('role', 'admin')
      if (!cancelled && !error) setAdmins(data || [])
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <BackHeader title="Admin setting" onBack={onBack} />
      <div style={S.card}>
        {loading ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p> : (
          <>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{admins.length} admin{admins.length !== 1 ? 's' : ''}</div>
            {admins.map(a => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                {a.staff_profiles?.name || a.username}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Weekly Holiday + Departments (org_settings) ───────────────────────────

function OrgSettingsPanel({ onBack, showToast }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newDept, setNewDept] = useState('')

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('org_settings').select('*').limit(1).maybeSingle()
    if (!error) setSettings(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const save = async (patch) => {
    if (!settings) return
    setSaving(true)
    const { error } = await supabase.from('org_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', settings.id)
    if (error) showToast?.('Could not save: ' + error.message, 'err')
    else { setSettings(s => ({ ...s, ...patch })); showToast?.('Saved', 'ok') }
    setSaving(false)
  }

  const toggleHoliday = (day) => {
    const current = settings.weekly_holiday || []
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day]
    save({ weekly_holiday: next })
  }

  const addDept = () => {
    const name = newDept.trim()
    if (!name) return
    const current = settings.departments || []
    if (current.includes(name)) { showToast?.('Department already exists', 'warn'); return }
    save({ departments: [...current, name] })
    setNewDept('')
  }

  const removeDept = (name) => {
    save({ departments: (settings.departments || []).filter(d => d !== name) })
  }

  if (loading || !settings) return <div><BackHeader title="Attendance settings" onBack={onBack} /><p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p></div>

  return (
    <div>
      <BackHeader title="Attendance settings" onBack={onBack} />

      <div style={S.card}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#0B1E3D', marginBottom: 10 }}>Weekly holiday</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAYS.map(day => {
            const active = (settings.weekly_holiday || []).includes(day)
            return (
              <button key={day} onClick={() => toggleHoliday(day)} disabled={saving} style={{
                padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${active ? '#0B1E3D' : '#d1d5db'}`,
                background: active ? '#0B1E3D' : 'white', color: active ? 'white' : '#374151',
              }}>
                {day.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#0B1E3D', marginBottom: 10 }}>Departments</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {(settings.departments || []).map(d => (
            <div key={d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: '#1e293b' }}>{d}</span>
              <button onClick={() => removeDept(d)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...S.input, minHeight: 38 }} placeholder="New department name" value={newDept} onChange={e => setNewDept(e.target.value)} />
          <button onClick={addDept} style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: '#0B1E3D', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Add</button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#94a3b8', padding: '0 4px' }}>
        Shift timings and campus geofence are managed from the Geo tab in Staff → Geo Attendance.
      </p>
    </div>
  )
}

// ─── Profile / Personal Info ────────────────────────────────────────────────

function ProfilePanel({ onBack, currentUser, currentAdminId, showToast }) {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({ org_name: '', org_phone: '', org_email: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('org_settings').select('*').limit(1).maybeSingle()
      if (!cancelled && data) {
        setSettings(data)
        setForm({ org_name: data.org_name || '', org_phone: data.org_phone || '', org_email: data.org_email || '' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    const { error } = await supabase.from('org_settings').update({ ...form, updated_by: currentAdminId, updated_at: new Date().toISOString() }).eq('id', settings.id)
    if (error) showToast?.('Could not save: ' + error.message, 'err')
    else showToast?.('Profile saved', 'ok')
    setSaving(false)
  }

  return (
    <div>
      <BackHeader title="Profile / personal info" onBack={onBack} />
      <div style={S.card}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Organisation name</label>
        <input style={{ ...S.input, marginBottom: 14 }} value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} placeholder="GNSI Khangabok" />
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Phone number</label>
        <input style={{ ...S.input, marginBottom: 14 }} value={form.org_phone} onChange={e => setForm(f => ({ ...f, org_phone: e.target.value }))} placeholder="9XXXXXXXXX" />
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Email</label>
        <input style={{ ...S.input, marginBottom: 16 }} value={form.org_email} onChange={e => setForm(f => ({ ...f, org_email: e.target.value }))} placeholder="office@guidancekhangabok.in" />
        <button onClick={save} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#0B1E3D', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function BackHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#0B1E3D', padding: 4 }}>←</button>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0B1E3D' }}>{title}</h2>
    </div>
  )
}

// ─── Main Settings hub ──────────────────────────────────────────────────────

export default function SettingsView({ isAdmin, currentUser, onNavigate, showToast }) {
  const [panel, setPanel] = useState(null) // null = hub, or a panel key

  if (panel === 'users')    return <ManageUsersPanel onBack={() => setPanel(null)} />
  if (panel === 'admin')    return <AdminSettingPanel onBack={() => setPanel(null)} />
  if (panel === 'org')      return <OrgSettingsPanel onBack={() => setPanel(null)} showToast={showToast} />
  if (panel === 'profile')  return <ProfilePanel onBack={() => setPanel(null)} currentUser={currentUser} currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />

  return (
    <div>
      {isAdmin && (
        <>
          <div style={S.sectionTitle}>Organisation settings</div>
          <div style={S.card}>
            <SettingsRow label="Roles & permissions" sub="Manage which roles can access which modules" onClick={() => onNavigate?.('admin')} />
            <SettingsRow label="Manage users" sub="View portal user accounts and roles" onClick={() => setPanel('users')} />
            <SettingsRow label="Admin setting" sub="Who currently has admin access" onClick={() => setPanel('admin')} />
          </div>

          <div style={S.sectionTitle}>Attendance settings</div>
          <div style={S.card}>
            <SettingsRow label="Weekly holiday & departments" sub="Configure weekly off days and department list" onClick={() => setPanel('org')} />
            <SettingsRow label="Shifts & geofence" sub="Manage shift timings and campus zones" onClick={() => onNavigate?.('staff')} />
          </div>
        </>
      )}

      <div style={S.sectionTitle}>Profile</div>
      <div style={S.card}>
        <SettingsRow label="Profile / personal info" sub="Organisation name, phone, email" onClick={() => setPanel('profile')} />
      </div>

      <div style={S.sectionTitle}>Other</div>
      <div style={S.card}>
        <SettingsRow label="Language" sub="English" onClick={() => showToast?.('Only English is available right now', 'warn')} />
        <SettingsRow label="App lock" sub="Disabled" onClick={() => showToast?.('App lock isn\'t set up yet', 'warn')} />
      </div>
    </div>
  )
}