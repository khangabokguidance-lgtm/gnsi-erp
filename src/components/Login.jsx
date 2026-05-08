import { useState } from 'react'
import { useAuth } from '../core/auth'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await login(username, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg, #0b1e6e 0%, #1433a8 100%)'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '48px 40px',
        width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎓</div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#1433a8', letterSpacing: '2px' }}>GNSI</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Guidance Navodaya & Sainik Institute
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text" value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username" required autoFocus
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
            />
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
              borderRadius: '8px', fontSize: '13px', marginBottom: '14px'
            }}>
              ❌ {error}
            </div>
          )}

          <button
            type="submit" className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? '⏳ Signing in…' : '🔐 Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#94a3b8' }}>
          GNSI Portal v2.0 · Powered by React + Supabase
        </div>
      </div>
    </div>
  )
}
