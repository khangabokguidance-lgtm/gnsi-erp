import { useState } from 'react'
import { supabase } from './supabase'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const ADMIN_USER = import.meta.env.VITE_ADMIN_USERNAME

  const handleLogin = async () => {
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Enter username and password.'); return
    }
    setLoading(true)

    // ── Admin login path ────────────────────────────────────
    if (username.trim() === ADMIN_USER) {
      const { data, error: dbErr } = await supabase
        .from('admin_credentials')
        .select('password_hash, is_changed')
        .eq('id', 1)
        .single()

      if (dbErr || !data) {
        setError('Admin credentials not found. Contact system administrator.')
        setLoading(false); return
      }

      const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD

      if (data.is_changed) {
        // .env password permanently blocked — only Supabase password works
        if (password !== data.password_hash) {
          setError('Invalid password.')
          setLoading(false); return
        }
      } else {
        // First time — accept .env password only
        if (password !== ADMIN_PASS) {
          setError('Invalid password.')
          setLoading(false); return
        }
      }

      onLogin({ id: 'admin', name: 'Administrator', username: ADMIN_USER, role: 'Admin' })
      setLoading(false); return
    }

    // ── Staff / Teacher via Supabase ────────────────────────
    const { data, error: dbErr } = await supabase
      .from('portal_users')
      .select('id, name, username, role, active')
      .eq('username', username.trim())
      .eq('password_hash', password.trim())
      .eq('active', true)
      .single()

    if (dbErr || !data) {
      setError('Invalid username or password.')
    } else {
      onLogin(data)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 36px',
        width: 360, boxShadow: '0 24px 60px rgba(0,0,0,.35)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏫</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>GNSI ERP</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>School Management System</p>
        </div>

        {[
          { label: 'Username', value: username, set: setUsername, type: 'text',     placeholder: 'Enter username' },
          { label: 'Password', value: password, set: setPassword, type: 'password', placeholder: 'Enter password' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              {f.label}
            </label>
            <input
              type={f.type}
              value={f.value}
              onChange={e => f.set(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder={f.placeholder}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
                border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#1e3a5f'}
              onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
        ))}

        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', fontSize: 12, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', background: '#1e3a5f', color: '#fff', border: 'none',
            borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1,
          }}
        >
          {loading ? '⏳ Signing in…' : '🔐 Sign In'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 20 }}>
          © {new Date().getFullYear()} GNSI School Management System
        </p>
      </div>
    </div>
  )
}