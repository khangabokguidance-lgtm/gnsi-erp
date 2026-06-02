import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function AdminLinkStaff() {
  const [staff, setStaff] = useState([])
  const [authUsers, setAuthUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    // Get unlinked staff
    const { data: staffData } = await supabase
      .from('staff_profiles')
      .select('id, name, department, designation, user_id')
      .order('name')
    
    // Get auth users (using RPC since auth.users is restricted)
    const { data: authData, error: authError } = await supabase
      .rpc('get_auth_users')  // We'll create this function

    // Fallback: query auth.users directly if RPC fails
    let users = authData || []
    if (authError || !authData) {
      const { data } = await supabase.auth.admin.listUsers()
      users = data?.users || []
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>⏳ Loading...</div>

  const linked = staff.filter(s => s.user_id)
  const unlinked = staff.filter(s => !s.user_id)

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#1e3a5f', marginBottom: 8 }}>🔗 Link Staff to Auth Users</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        {linked.length} linked · {unlinked.length} unlinked · {authUsers.length} auth users available
      </p>

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

      {/* Unlinked Staff */}
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
            </div>

            <select
              value=""
              onChange={e => linkStaff(s.id, e.target.value)}
              disabled={saving === s.id}
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

      {/* Linked Staff */}
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
                  Linked to: {linkedUser?.email || linkedUser?.id?.slice(0, 8) || 'Unknown'}
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