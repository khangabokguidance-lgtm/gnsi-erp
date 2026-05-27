import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const injectStyles = () => {
  if (document.getElementById('gnsi-login-styles')) return
  const style = document.createElement('style')
  style.id = 'gnsi-login-styles'
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-7px); }
      40%     { transform: translateX(7px); }
      60%     { transform: translateX(-4px); }
      80%     { transform: translateX(4px); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse {
      0%,100% { opacity: 1; }
      50%     { opacity: .5; }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes floatA {
      0%,100% { transform: translateY(0px) rotate(0deg); }
      50%     { transform: translateY(-18px) rotate(3deg); }
    }
    @keyframes floatB {
      0%,100% { transform: translateY(0px) rotate(0deg); }
      50%     { transform: translateY(-12px) rotate(-2deg); }
    }

    .gnsi-page {
      min-height: 100vh;
      min-height: 100dvh;
      background: #060d1a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Outfit', sans-serif;
      padding: 20px 16px;
      position: relative;
      overflow: hidden;
    }

    .gnsi-bg-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(14,165,233,.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(14,165,233,.06) 1px, transparent 1px);
      background-size: 48px 48px;
      pointer-events: none;
    }

    .gnsi-bg-orb1 {
      position: absolute;
      width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(14,165,233,.12) 0%, transparent 70%);
      border-radius: 50%;
      top: -150px; left: -150px;
      pointer-events: none;
    }
    .gnsi-bg-orb2 {
      position: absolute;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(99,102,241,.1) 0%, transparent 70%);
      border-radius: 50%;
      bottom: -100px; right: -100px;
      pointer-events: none;
    }

    .gnsi-float-card1 {
      position: absolute;
      top: 12%;
      right: 8%;
      width: 64px; height: 64px;
      background: rgba(14,165,233,.08);
      border: 1px solid rgba(14,165,233,.15);
      border-radius: 16px;
      animation: floatA 6s ease-in-out infinite;
      pointer-events: none;
    }
    .gnsi-float-card2 {
      position: absolute;
      bottom: 18%;
      left: 6%;
      width: 44px; height: 44px;
      background: rgba(99,102,241,.08);
      border: 1px solid rgba(99,102,241,.15);
      border-radius: 12px;
      animation: floatB 8s ease-in-out infinite;
      pointer-events: none;
    }
    .gnsi-float-card3 {
      position: absolute;
      top: 60%;
      right: 5%;
      width: 32px; height: 32px;
      background: rgba(14,165,233,.06);
      border: 1px solid rgba(14,165,233,.12);
      border-radius: 8px;
      animation: floatA 7s ease-in-out infinite 1s;
      pointer-events: none;
    }

    .gnsi-wrap {
      width: 100%;
      max-width: 420px;
      animation: fadeUp .6s cubic-bezier(.22,1,.36,1) both;
      position: relative;
      z-index: 1;
    }

    .gnsi-brand {
      text-align: center;
      margin-bottom: 32px;
    }
    .gnsi-logo-ring {
      width: 72px; height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
      box-shadow: 0 0 0 1px rgba(14,165,233,.3), 0 16px 40px rgba(14,165,233,.25);
      position: relative;
    }
    .gnsi-logo-ring::after {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 24px;
      border: 1px solid rgba(14,165,233,.2);
    }
    .gnsi-logo-icon {
      font-size: 32px;
      line-height: 1;
    }
    .gnsi-title {
      font-size: clamp(22px, 5vw, 26px);
      font-weight: 800;
      color: #f0f9ff;
      letter-spacing: -.5px;
      margin-bottom: 4px;
    }
    .gnsi-subtitle {
      font-size: 13px;
      color: #64748b;
      font-weight: 400;
      letter-spacing: .3px;
    }

    .gnsi-card {
      background: rgba(15,23,42,.85);
      border: 1px solid rgba(14,165,233,.15);
      border-radius: 24px;
      padding: clamp(24px, 6vw, 36px) clamp(20px, 6vw, 32px);
      backdrop-filter: blur(24px);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.03),
        0 32px 80px rgba(0,0,0,.5),
        inset 0 1px 0 rgba(255,255,255,.05);
    }
    .gnsi-card.shake {
      animation: shake .4s ease;
    }

    .gnsi-section-label {
      font-size: 10px;
      font-weight: 600;
      color: #0ea5e9;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .gnsi-section-label::before,
    .gnsi-section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(14,165,233,.3), transparent);
    }

    .gnsi-field {
      margin-bottom: 16px;
    }
    .gnsi-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: .8px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .gnsi-input-wrap {
      position: relative;
    }
    .gnsi-input-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #475569;
      display: flex;
      align-items: center;
      pointer-events: none;
      transition: color .2s;
    }
    .gnsi-input {
      width: 100%;
      padding: 13px 44px 13px 44px;
      background: rgba(2,6,23,.6);
      border: 1.5px solid rgba(51,65,85,.8);
      border-radius: 12px;
      font-size: 14px;
      font-family: 'Outfit', sans-serif;
      font-weight: 400;
      color: #e2e8f0;
      outline: none;
      transition: border-color .2s, box-shadow .2s, background .2s;
      -webkit-appearance: none;
    }
    .gnsi-input::placeholder { color: #334155; }
    .gnsi-input:focus {
      border-color: #0ea5e9;
      background: rgba(2,6,23,.8);
      box-shadow: 0 0 0 3px rgba(14,165,233,.12);
    }
    .gnsi-input:focus ~ .gnsi-input-icon,
    .gnsi-input-wrap:focus-within .gnsi-input-icon { color: #0ea5e9; }

    .gnsi-eye-btn {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: #475569;
      padding: 4px;
      display: flex;
      align-items: center;
      border-radius: 6px;
      transition: color .2s, background .2s;
    }
    .gnsi-eye-btn:hover { color: #94a3b8; background: rgba(255,255,255,.05); }

    .gnsi-remember-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      margin-top: 4px;
    }
    .gnsi-remember {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }
    .gnsi-checkbox {
      width: 16px; height: 16px;
      accent-color: #0ea5e9;
      cursor: pointer;
      border-radius: 4px;
    }
    .gnsi-remember-text {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .gnsi-forgot {
      font-size: 11px;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .gnsi-error {
      background: rgba(220,38,38,.1);
      border: 1px solid rgba(220,38,38,.25);
      color: #fca5a5;
      font-size: 12px;
      font-weight: 500;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideIn .25s ease;
    }

    .gnsi-btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      letter-spacing: .3px;
      transition: opacity .2s, transform .15s, box-shadow .2s;
      box-shadow: 0 4px 24px rgba(14,165,233,.25);
      position: relative;
      overflow: hidden;
    }
    .gnsi-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,.15), transparent);
      opacity: 0;
      transition: opacity .2s;
    }
    .gnsi-btn:hover:not(:disabled)::before { opacity: 1; }
    .gnsi-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 32px rgba(14,165,233,.35);
    }
    .gnsi-btn:active:not(:disabled) { transform: translateY(0); }
    .gnsi-btn:disabled { opacity: .6; cursor: not-allowed; }

    .gnsi-spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .7s linear infinite;
      flex-shrink: 0;
    }

    .gnsi-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 20px 0 0;
    }
    .gnsi-divider-line {
      flex: 1;
      height: 1px;
      background: rgba(51,65,85,.5);
    }

    .gnsi-footer {
      text-align: center;
      margin-top: 24px;
    }
    .gnsi-footer-text {
      font-size: 11px;
      color: #1e293b;
      letter-spacing: .3px;
    }
    .gnsi-badges {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .gnsi-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 99px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: .4px;
      border: 1px solid;
    }
    .gnsi-badge-blue {
      background: rgba(14,165,233,.08);
      border-color: rgba(14,165,233,.2);
      color: #38bdf8;
    }
    .gnsi-badge-purple {
      background: rgba(99,102,241,.08);
      border-color: rgba(99,102,241,.2);
      color: #a5b4fc;
    }
    .gnsi-badge-green {
      background: rgba(16,185,129,.08);
      border-color: rgba(16,185,129,.2);
      color: #6ee7b7;
    }

    .gnsi-version {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #1e293b;
      margin-top: 10px;
      letter-spacing: .5px;
    }

    @media (max-width: 480px) {
      .gnsi-page { padding: 16px 12px; align-items: flex-start; padding-top: 40px; }
      .gnsi-card { border-radius: 20px; }
      .gnsi-float-card1, .gnsi-float-card2, .gnsi-float-card3 { display: none; }
    }
    @media (max-height: 700px) {
      .gnsi-brand { margin-bottom: 20px; }
      .gnsi-logo-ring { width: 56px; height: 56px; border-radius: 16px; }
      .gnsi-logo-icon { font-size: 26px; }
    }
  `
  document.head.appendChild(style)
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const EyeOpen = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const EyeClosed = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

export default function Login({ onLogin }) {
  const [username,     setUsername]     = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe,   setRememberMe]   = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [shakeCard,    setShakeCard]    = useState(false)
  const cardRef = useRef(null)

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

  const handleLogin = async () => {
    setError('')
    if (!username.trim() || !password.trim()) {
      showError('Please enter both username and password.'); return
    }
    setLoading(true)

    if (rememberMe) localStorage.setItem('gnsi_remembered_user', username.trim())
    else            localStorage.removeItem('gnsi_remembered_user')

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
      const ok = data.is_changed ? password === data.password_hash : password === ADMIN_PASS

      if (!ok) { showError('Invalid username or password.'); setLoading(false); return }

      onLogin({ id: 'admin', name: 'Administrator', username: ADMIN_USER, role: 'Admin' })
      setLoading(false); return
    }

    const hashedPassword = await sha256(password.trim())

    const { data, error: dbErr } = await supabase
      .from('portal_users')
      .select('id, name, username, role, active')
      .eq('username', username.trim().toLowerCase())
      .eq('password_hash', hashedPassword)
      .eq('active', true)
      .single()

    if (dbErr || !data) {
      showError('Invalid username or password.')
      setLoading(false); return
    }

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id, department, designation, email')
      .eq('name', data.name)
      .maybeSingle()

    onLogin({
      ...data,
      staff_profile_id: profile?.id         ?? null,
      department:       profile?.department  ?? null,
      designation:      profile?.designation ?? null,
      email:            profile?.email       ?? null,
    })

    setLoading(false)
  }

  return (
    <div className="gnsi-page">
      <div className="gnsi-bg-grid" />
      <div className="gnsi-bg-orb1" />
      <div className="gnsi-bg-orb2" />
      <div className="gnsi-float-card1" />
      <div className="gnsi-float-card2" />
      <div className="gnsi-float-card3" />

      <div className="gnsi-wrap">
        <div className="gnsi-brand">
          <div className="gnsi-logo-ring">
            <span className="gnsi-logo-icon">🏫</span>
          </div>
          <h1 className="gnsi-title">GNSI ERP</h1>
          <p className="gnsi-subtitle">School Management System</p>
        </div>

        <div ref={cardRef} className={`gnsi-card${shakeCard ? ' shake' : ''}`}>
          <div className="gnsi-section-label">Secure Sign In</div>

          {/* Username */}
          <div className="gnsi-field">
            <label className="gnsi-label">Username</label>
            <div className="gnsi-input-wrap">
              <span className="gnsi-input-icon"><UserIcon /></span>
              <input
                className="gnsi-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
              />
            </div>
          </div>

          {/* Password */}
          <div className="gnsi-field">
            <label className="gnsi-label">Password</label>
            <div className="gnsi-input-wrap">
              <span className="gnsi-input-icon"><LockIcon /></span>
              <input
                className="gnsi-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="gnsi-eye-btn"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className="gnsi-remember-row">
            <label className="gnsi-remember">
              <input
                type="checkbox"
                className="gnsi-checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span className="gnsi-remember-text">Remember me</span>
            </label>
            <span className="gnsi-forgot">🔒 Contact admin</span>
          </div>

          {/* Error */}
          {error && (
            <div className="gnsi-error">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="gnsi-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading
              ? <><div className="gnsi-spinner" /> Signing in…</>
              : '🔐 Sign In'
            }
          </button>

          <div className="gnsi-divider">
            <div className="gnsi-divider-line" />
          </div>
        </div>

        {/* Footer */}
        <div className="gnsi-footer">
          <div className="gnsi-badges">
            <span className="gnsi-badge gnsi-badge-blue">⚡ React + Vite</span>
            <span className="gnsi-badge gnsi-badge-purple">🛡 Supabase</span>
            <span className="gnsi-badge gnsi-badge-green">✓ SHA-256</span>
          </div>
          <p className="gnsi-version">v2.1 · © {new Date().getFullYear()} GNSI</p>
        </div>
      </div>
    </div>
  )
}