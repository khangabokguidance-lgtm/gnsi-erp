import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const injectStyles = () => {
  if (document.getElementById('gnsi-login-styles')) return
  const style = document.createElement('style')
  style.id = 'gnsi-login-styles'
  style.textContent = `
    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%      { transform: translateX(-8px); }
      40%      { transform: translateX(8px); }
      60%      { transform: translateX(-5px); }
      80%      { transform: translateX(5px); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .gnsi-card       { animation: fadeInDown .5s cubic-bezier(.22,1,.36,1) both; }
    .gnsi-card.shake { animation: shake .4s ease; }
    .gnsi-btn:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
    .gnsi-btn   { transition: filter .2s, transform .2s, opacity .2s; }
    .gnsi-input:focus { border-color: #1e3a5f !important; box-shadow: 0 0 0 3px rgba(30,58,95,.15); }
    .gnsi-input { transition: border-color .2s, box-shadow .2s; }
  `
  document.head.appendChild(style)
}

const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const EyeClosed = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const Spinner = () => (
  <span style={{
    display: 'inline-block', width: 14, height: 14, marginRight: 8, verticalAlign: 'middle',
    border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff',
    borderRadius: '50%', animation: 'spin .7s linear infinite',
  }}/>
)

// ── SHA-256 helper ─────────────────────────────────────────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Login({ onLogin }) {
  const [username,     setUsername]     = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe,   setRememberMe]   = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [shakeCard,    setShakeCard]    = useState(false)

  const ADMIN_USER = import.meta.env.VITE_ADMIN_USERNAME

  useEffect(() => { injectStyles() }, [])

  useEffect(() => {
    const saved = localStorage.getItem('gnsi_remembered_user')
    if (saved) { setUsername(saved); setRememberMe(true) }
  }, [])

  const showError = (msg) => {
    setError(msg)
    setShakeCard(true)
    setTimeout(() => setShakeCard(false), 450)
  }

  // ── Main login ────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('')
    if (!username.trim() || !password.trim()) {
      showError('Please enter both username and password.'); return
    }
    setLoading(true)

    if (rememberMe) localStorage.setItem('gnsi_remembered_user', username.trim())
    else            localStorage.removeItem('gnsi_remembered_user')

    // ── Admin path ──────────────────────────────────────────────────────────
    if (username.trim() === ADMIN_USER) {
      const { data, error: dbErr } = await supabase
        .from('admin_credentials')
        .select('password_hash, is_changed')
        .eq('id', 1)
        .single()

      if (dbErr || !data) {
        showError('Admin credentials not found. Contact system administrator.')
        setLoading(false); return
      }

      const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD
      const ok = data.is_changed
        ? password === data.password_hash
        : password === ADMIN_PASS

      if (!ok) { showError('Invalid username or password.'); setLoading(false); return }

      onLogin({ id: 'admin', name: 'Administrator', username: ADMIN_USER, role: 'Admin' })
      setLoading(false); return
    }

    // ── Staff / Teacher path — SHA-256 hash before DB compare ───────────────
    const hashedPassword = await sha256(password.trim())

    const { data, error: dbErr } = await supabase
      .from('portal_users')
      .select('id, name, username, role, active')
      .eq('username', username.trim().toLowerCase())
      .eq('password_hash', hashedPassword)
      .eq('active', true)
      .single()

    if (dbErr || !data) showError('Invalid username or password.')
    else                 onLogin(data)

    setLoading(false)
  }  // ← end of handleLogin

  // ── Render ────────────────────────────────────────────────────────────────
  const cardClass = `gnsi-card${shakeCard ? ' shake' : ''}`

  return (
    <PageWrapper>
      <div className={cardClass} style={cardStyle}>
        <Header icon="🏫" title="GNSI ERP" subtitle="School Management System" />

        {/* Username */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Username</FieldLabel>
          <input
            className="gnsi-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter username"
            autoComplete="username"
            style={inputStyle}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 8 }}>
          <FieldLabel>Password</FieldLabel>
          <div style={{ position: 'relative' }}>
            <input
              className="gnsi-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter password"
              autoComplete="current-password"
              style={{ ...inputStyle, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center',
              }}
            >
              {showPassword ? <EyeClosed /> : <EyeOpen />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              style={{ accentColor: '#1e3a5f', width: 14, height: 14, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Remember me</span>
          </label>
        </div>

        <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: '0 0 14px' }}>
          🔒 Forgot your password? Contact your administrator.
        </p>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button
          className="gnsi-btn"
          onClick={handleLogin}
          disabled={loading}
          style={{ ...primaryBtnStyle, opacity: loading ? .7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? <><Spinner/>Signing in…</> : '🔐 Sign In'}
        </button>

        <Footer />
      </div>
    </PageWrapper>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────
const PageWrapper = ({ children }) => (
  <div style={{
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #164e8e 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 16,
  }}>
    {children}
  </div>
)

const Header = ({ icon, title, subtitle }) => (
  <div style={{ textAlign: 'center', marginBottom: 28 }}>
    <div style={{ fontSize: 44, marginBottom: 8, lineHeight: 1 }}>{icon}</div>
    <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f', margin: '0 0 4px' }}>{title}</h1>
    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{subtitle}</p>
  </div>
)

const FieldLabel = ({ children }) => (
  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
    {children}
  </label>
)

const ErrorBox = ({ children }) => (
  <div style={{
    background: '#fee2e2', color: '#dc2626', fontSize: 12, borderRadius: 8,
    padding: '9px 12px', marginBottom: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 6,
  }}>
    ⚠️ {children}
  </div>
)

const Footer = () => (
  <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 20, marginBottom: 0 }}>
    © {new Date().getFullYear()} GNSI School Management System
  </p>
)

// ── Styles ─────────────────────────────────────────────────────────────────────
const cardStyle = {
  background: '#fff', borderRadius: 20, padding: '36px 32px',
  width: '100%', maxWidth: 380, boxShadow: '0 28px 64px rgba(0,0,0,.4)',
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
  border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box',
  background: '#f8fafc', color: '#1e293b',
}

const primaryBtnStyle = {
  width: '100%', background: 'linear-gradient(135deg, #1e3a5f, #164e8e)',
  color: '#fff', border: 'none', borderRadius: 8, padding: '12px',
  fontSize: 14, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}