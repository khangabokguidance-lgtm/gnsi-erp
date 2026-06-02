import { useState } from 'react'
import { supabase } from './supabase'

export default function CreateAuthUser({ onCreated }) {
  const [form, setForm] = useState({ email: '', phone: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.name) {
      setToast('❌ Email, password and name are required')
      return
    }

    setLoading(true)
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: form.email,
      phone: form.phone || undefined,
      password: form.password,
      email_confirm: true,
      user_metadata: { name: form.name }
    })

    if (authError) {
      setToast(`❌ ${authError.message}`)
      setLoading(false)
      return
    }

    // Link to staff profile if email matches
    const { error: linkError } = await supabase
      .from('staff_profiles')
      .update({ user_id: authData.user.id })
      .eq('email', form.email)

    setToast(`✅ User created: ${form.email}`)
    setForm({ email: '', phone: '', password: '', name: '' })
    setLoading(false)
    onCreated?.()
  }

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto' }}>
      <h2 style={{ color: '#1e3a5f', marginBottom: 16 }}>➕ Create Auth User</h2>
      
      {toast && (
        <div style={{ 
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: toast.includes('❌') ? '#fee2e2' : '#dcfce7',
          color: toast.includes('❌') ? '#dc2626' : '#16a34a',
          fontWeight: 600
        }}>
          {toast}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Name *</label>
          <input 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})}
            placeholder="Full name"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', fontSize: 14 }}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Email *</label>
          <input 
            type="email"
            value={form.email} 
            onChange={e => setForm({...form, email: e.target.value})}
            placeholder="user@gnsi.edu"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', fontSize: 14 }}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Phone</label>
          <input 
            type="tel"
            value={form.phone} 
            onChange={e => setForm({...form, phone: e.target.value})}
            placeholder="+91 9876543210"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Password *</label>
          <input 
            type="text"
            value={form.password} 
            onChange={e => setForm({...form, password: e.target.value})}
            placeholder="Temporary password"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', fontSize: 14 }}
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '12px 20px', borderRadius: 8, border: 'none',
            background: loading ? '#94a3b8' : '#1e3a5f', color: 'white',
            fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14
          }}
        >
          {loading ? '⏳ Creating...' : '✅ Create User'}
        </button>
      </form>
    </div>
  )
}