import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import CreateAuthUser from './CreateAuthUser'

export default function AdminLinkStaff() {
  const [staff, setStaff] = useState([])
  const [authUsers, setAuthUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [toast, setToast] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkResults, setBulkResults] = useState([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    
    const { data: staffData } = await supabase
      .from('staff_profiles')
      .select('id, name, department, designation, user_id, email')
      .order('name')
    
    const { data: authData, error: rpcError } = await supabase
      .rpc('get_auth_users')

    let users = []
    if (rpcError || !authData) {
      try {
        const { data } = await supabase.auth.admin.listUsers()
        users = data?.users || []
      } catch (e) {
        console.error('Failed to load auth users:', e)
      }
    } else {
      users = authData
    }

    setStaff(staffData || [])
    setAuthUsers(users)
    setLoading(false)
  }

  const linkStaff = async (staffId, userId) => {
    setSaving(staffId)
    const { error } = await supabase
      .from('staff_profiles')
      .update({ user_id: userId })
      .eq('id', staffId)

    if (error) {
      setToast(`❌ Error: ${error.message}`)
    } else {
      setToast(`✅ Linked successfully`)
      setStaff(prev => prev.map(s => s.id === staffId ? { ...s, user_id: userId } : s))
    }
    
    setTimeout(() => setToast(''), 3000)
    setSaving(null)
  }

  const unlinkStaff = async (staffId) => {
    if (!window.confirm('Unlink this staff?')) return
    setSaving(staffId)
    
    await supabase
      .from('staff_profiles')
      .update({ user_id: null })
      .eq('id', staffId)

    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, user_id: null } : s))
    setToast('🗑️ Unlinked')
    setTimeout(() => setToast(''), 3000)
    setSaving(null)
  }

  const createAllMissingUsers = async () => {
    const unlinked = staff.filter(s => !s.user_id)
    if (!window.confirm(`Create auth users for ${unlinked.length} unlinked staff?`)) return
    
    setBulkCreating(true)
    setBulkResults([])
    const results = []
    
    for (const s of unlinked) {
      const email = s.email || `${s.name.toLowerCase().replace(/[^a-z]/g, '')}${s.id}@gnsi.edu`
      const password = Math.random().toString(36).slice(2, 10)
      
      try {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: s.name, staff_id: s.id }
        })
        
        if (error) {
          results.push({ name: s.name, status: 'failed', error: error.message })
          continue
        }
        
        await supabase
          .from('staff_profiles')
          .update({ user_id: data.user.id, email })
          .eq('id', s.id)
        
        results.push({ name: s.name, status: 'created', email, password })
      } catch (e) {
        results.push({ name: s.name, status: 'error', error: e.message })
      }
    }
    
    setBulkResults(results)
    setBulkCreating(false)
    loadData()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading...</div>

  const linked = staff.filter(s => s.user_id)
  const unlinked = staff.filter(s => !s.user_id)

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ color: '#1e3a5f', marginBottom: 8 }}>🔗 Link Staff to Auth Users</h1>
          <p style={{ color: '#64748b' }}>
            {linked.length} linked · {unlinked.length} unlinked · {authUsers.length} auth users available
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            onClick={() => setShowCreate(true)}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >
            ➕ Create One User
          </button>
          <button 
            onClick={createAllMissingUsers}
            disabled={bulkCreating || unlinked.length === 0}
            style={{ 
              padding: '10px 18px', borderRadius: 8, border: 'none',
              background: bulkCreating ? '#94a3b8' : '#2563eb', color: 'white',
              fontWeight: 700, cursor: bulkCreating ? 'not-allowed' : 'pointer',
              fontSize: 13
            }}
          >
            {bulkCreating ? '⏳ Creating All...' : `⚡ Create All ${unlinked.length}`}
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ 
          position: 'fixed', top: 20, right: 20, 
          padding: '12px 20px', borderRadius: 8, 
          background: toast.includes('❌') ? '#fee2e2' : '#dcfce7',
          color: toast.includes('❌') ? '#dc2626' : '#16a34a',
          fontWeight: 600, zIndex: 9999
        }}>
          {toast}
        </div>
      )}

      {showCreate && (
        <div style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16
        }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#1e3a5f' }}>Create Auth User</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <CreateAuthUser onCreated={() => { loadData(); setShowCreate(false) }} />
          </div>
        </div>
      )}

      {bulkResults.length > 0 && (
        <div style={{ marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#1e3a5f' }}>Bulk Creation Results</h3>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Staff</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Password</th>
                </tr>
              </thead>
              <tbody>
                {bulkResults.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 10px' }}>{r.name}</td>
                    <td style={{ padding: '6px 10px', color: r.status === 'created' ? '#16a34a' : '#dc2626' }}>
                      {r.status === 'created' ? '✅' : '❌'} {r.status}
                    </td>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11 }}>{r.email || '—'}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                      {r.password ? (
                        <span style={{ background: '#fef9c3', padding: '2px 6px', borderRadius: 4 }}>{r.password}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 11, color: '#64748b' }}>
            ⚠️ Copy passwords now — they won't be shown again!
          </p>
        </div>
      )}

      <h2 style={{ color: '#dc2626', fontSize: 16, marginBottom: 12 }}>⚠️ Unlinked Staff ({unlinked.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {unlinked.map(s => (
          <div key={s.id} style={{ 
            display: 'flex', alignItems: 'center', gap: 12, 
            padding: 14, borderRadius: 10, 
            background: '#fff', border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)'
          }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: '50%', 
              background: '#1e3a5f', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, flexShrink: 0
            }}>
              {s.name?.[0]?.toUpperCase()}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>{s.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {s.designation} · {s.department} · ID: {s.id}
              </div>
              {!s.email && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>⚠️ No email set</div>}
            </div>

            <select
              value=""
              onChange={e => linkStaff(s.id, e.target.value)}
              disabled={saving === s.id || authUsers.length === 0}
              style={{ 
                padding: '8px 12px', borderRadius: 8, 
                border: '1px solid #d1d5db', fontSize: 13,
                minWidth: 200, background: 'white'
              }}
            >
              <option value="">-- Select Auth User --</option>
              {authUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.email || u.phone || u.id.slice(0, 8)} 
                  {u.user_metadata?.name ? ` (${u.user_metadata.name})` : ''}
                </option>
              ))}
            </select>
            
            {saving === s.id && <span style={{ color: '#94a3b8' }}>⏳</span>}
          </div>
        ))}
        {unlinked.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#16a34a', background: '#f0fdf4', borderRadius: 10 }}>
            ✅ All staff linked!
          </div>
        )}
      </div>

      <h2 style={{ color: '#16a34a', fontSize: 16, marginBottom: 12 }}>✅ Linked Staff ({linked.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {linked.map(s => {
          const linkedUser = authUsers.find(u => u.id === s.user_id)
          return (
            <div key={s.id} style={{ 
              display: 'flex', alignItems: 'center', gap: 12, 
              padding: 14, borderRadius: 10, 
              background: '#f8fafc', border: '1px solid #e2e8f0'
            }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: '50%', 
                background: '#16a34a', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, flexShrink: 0
              }}>
                {s.name?.[0]?.toUpperCase()}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#1e293b' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {s.designation} · {s.department}
                </div>
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                  Linked to: {linkedUser?.email || linkedUser?.phone || linkedUser?.id?.slice(0, 8) || 'Unknown'}
                </div>
              </div>

              <button
                onClick={() => unlinkStaff(s.id)}
                disabled={saving === s.id}
                style={{ 
                  padding: '6px 12px', borderRadius: 6, 
                  border: '1px solid #fecaca', background: '#fee2e2',
                  color: '#dc2626', fontSize: 12, cursor: 'pointer'
                }}
              >
                {saving === s.id ? '⏳' : 'Unlink'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}