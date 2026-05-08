import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'
import { useAuth, sha256 } from '../core/auth'

const ROLES = ['admin', 'manager', 'accounts', 'staff', 'teacher']

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'staff', staff_role: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => { loadUsers() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase.from('portal_users').select('*').order('id')
    setUsers(data || [])
    setLoading(false)
  }

  const openNew = () => {
    setEditUser(null)
    setForm({ username: '', password: '', name: '', role: 'staff', staff_role: '' })
    setShowForm(true)
  }

  const openEdit = (u) => {
    setEditUser(u)
    setForm({ username: u.username, password: '', name: u.name, role: u.role, staff_role: u.staff_role || '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.username || !form.name) return showToast('❌ Username and name are required')
    if (!editUser && !form.password) return showToast('❌ Password is required for new users')
    setSaving(true)
    try {
      if (editUser) {
        // Update existing user
        const updates = { name: form.name, role: form.role, staff_role: form.staff_role, updated_at: new Date().toISOString() }
        if (form.password) updates.password_hash = await sha256(form.password)
        await supabase.from('portal_users').update(updates).eq('id', editUser.id)
        showToast('✅ User updated successfully!')
      } else {
        // Create new user
        const hash = await sha256(form.password)
        await supabase.from('portal_users').insert({
          username: form.username.toLowerCase().trim(),
          password_hash: hash,
          name: form.name,
          role: form.role,
          staff_role: form.staff_role,
        })
        showToast('✅ User created successfully!')
      }
      setShowForm(false)
      loadUsers()
    } catch(e) {
      showToast('❌ Error: ' + e.message)
    }
    setSaving(false)
  }

  const toggleActive = async (u) => {
    await supabase.from('portal_users').update({ active: !u.active }).eq('id', u.id)
    showToast(u.active ? '⛔ User deactivated' : '✅ User activated')
    loadUsers()
  }

  const deleteUser = async (u) => {
    if (u.id === currentUser.id) return showToast('❌ Cannot delete yourself')
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    await supabase.from('portal_users').delete().eq('id', u.id)
    showToast('🗑️ User deleted')
    loadUsers()
  }

  const roleColors = { admin: '#1433a8', manager: '#7c3aed', accounts: '#15803d', staff: '#d97706', teacher: '#0891b2' }

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', background: '#0f172a',
          color: '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '13px',
          fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>{toast}</div>
      )}

      <div className="page-header">
        <div className="page-header-eyebrow">GNSI · SETTINGS</div>
        <div className="page-header-title">👥 User Management</div>
        <div className="page-header-sub">Manage portal users, roles and passwords</div>
      </div>

      {/* Add User Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-head">
            <span className="card-title">{editUser ? '✏️ Edit User' : '➕ New User'}</span>
            <button onClick={() => setShowForm(false)} className="btn btn-outline" style={{ fontSize: '12px' }}>Cancel</button>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="form-grid g2">
              <div className="form-group">
                <label>Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Himan Singh" />
              </div>
              <div className="form-group">
                <label>Username *</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. himan" disabled={!!editUser} style={{ opacity: editUser ? 0.6 : 1 }} />
              </div>
              <div className="form-group">
                <label>{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editUser ? 'Leave blank to keep current' : 'Enter password'} />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: '9px', fontSize: '13px' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Staff Role / Designation</label>
                <input value={form.staff_role} onChange={e => setForm(f => ({ ...f, staff_role: e.target.value }))}
                  placeholder="e.g. Mathematics Teacher, Head of Institute" />
              </div>
            </div>
            <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
              {saving ? '⏳ Saving…' : '💾 Save User'}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">👥 Portal Users ({users.length})</span>
          {isAdmin && !showForm && (
            <button onClick={openNew} className="btn btn-primary" style={{ fontSize: '12px' }}>+ Add User</button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div className="loading-spinner">⏳ Loading users…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Designation</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--muted)', fontSize: '12px' }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>
                      {u.name}
                      {u.id === currentUser.id && (
                        <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1d4ed8', borderRadius: '20px', padding: '1px 8px', marginLeft: '8px', fontWeight: 700 }}>You</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--muted)' }}>{u.username}</td>
                    <td>
                      <span style={{
                        background: (roleColors[u.role] || '#64748b') + '15',
                        color: roleColors[u.role] || '#64748b',
                        border: `1px solid ${roleColors[u.role] || '#64748b'}33`,
                        borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{u.staff_role || '—'}</td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openEdit(u)}
                            style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                            ✏️ Edit
                          </button>
                          {u.id !== currentUser.id && (
                            <>
                              <button onClick={() => toggleActive(u)}
                                style={{ background: u.active ? '#fef3c7' : '#dcfce7', color: u.active ? '#d97706' : '#16a34a', border: 'none', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                                {u.active ? '⛔ Disable' : '✅ Enable'}
                              </button>
                              <button onClick={() => deleteUser(u)}
                                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
