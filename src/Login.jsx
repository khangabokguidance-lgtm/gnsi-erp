import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
// Put both images next to Login.jsx (Vite bundles them)
import loginPoster from './login-poster.jpg'
import gnsiCrest from './gnsi-crest.png'

// ─────────────────────────────────────────────────────────────────────────
// Login — "Ledger & Crest" design (navy + brass gold, serif headings).
// Only the presentation changed; the sign-in logic (admin shortcut via
// admin_credentials, SHA-256 check against portal_users, staff_profiles
// lookup, set_staff_context RPC, Remember me) is unchanged.
// ─────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'gnsi-login-styles-v3'
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return
  // Remove the old login stylesheet if an earlier version injected it
  document.getElementById('gnsi-login-styles')?.remove()
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap');

    .gl-page, .gl-page *, .gl-page *::before, .gl-page *::after { box-sizing: border-box; }

    @keyframes gl-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @keyframes gl-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 50%{transform:translateX(6px)} 75%{transform:translateX(-3px)} }
    @keyframes gl-spin { to { transform: rotate(360deg); } }

    .gl-page {
      --navy: #0B1E3D; --navy2: #132B52; --gold: #C9A24B; --goldL: #E2C57E;
      --ink: #0F172A; --muted: #5B6475; --line: #D9DEE7; --bg: #F5F6F8; --err: #B42318;
      min-height: 100vh; min-height: 100dvh;
      display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
      background: var(--bg);
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: var(--ink);
      margin: 0;
    }

    /* ── Left: GNSI poster (panel navy matches the poster's #0E3266) ── */
    .gl-brand {
      background: #0E3266;
      display: flex; align-items: center; justify-content: center;
      padding: 32px; overflow: hidden;
      border-right: 3px solid var(--gold);
    }
    .gl-poster {
      display: block; width: auto; height: auto;
      max-width: 100%; max-height: calc(100dvh - 64px);
      object-fit: contain;
      animation: gl-fade .5s ease both;
    }

    /* ── Right: sign-in ── */
    .gl-main { display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
    .gl-card {
      width: 100%; max-width: 400px;
      background: #fff; border: 1px solid var(--line); border-radius: 12px;
      padding: 36px 32px 28px;
      box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 12px 32px rgba(15,23,42,.06);
      animation: gl-fade .45s ease both;
    }
    .gl-card.shake { animation: gl-shake .35s ease; }

    .gl-mobile-brand { display: none; }

    .gl-card-crest { display: block; width: 64px; height: auto; margin: 0 0 18px; }
    .gl-title { font-family: 'Source Serif 4', Georgia, serif; font-size: 26px; font-weight: 700; color: var(--navy); margin: 0 0 6px; }
    .gl-sub { font-size: 14px; color: var(--muted); margin: 0 0 28px; }

    .gl-field { margin-bottom: 18px; }
    .gl-label { display: block; font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 7px; }
    .gl-input-wrap { position: relative; }
    .gl-input {
      width: 100%; height: 46px; padding: 0 14px;
      font: 400 15px 'Inter', system-ui, sans-serif; color: var(--ink);
      background: #fff; border: 1px solid var(--line); border-radius: 8px;
      outline: none; transition: border-color .15s, box-shadow .15s;
      -webkit-appearance: none; appearance: none;
    }
    .gl-input::placeholder { color: #9AA3B2; }
    .gl-input:hover { border-color: #BFC6D2; }
    .gl-input:focus { border-color: var(--navy); box-shadow: 0 0 0 3px rgba(11,30,61,.12); }
    .gl-input.has-toggle { padding-right: 72px; }
    .gl-input[aria-invalid="true"] { border-color: var(--err); }

    .gl-toggle {
      position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
      height: 34px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent;
      font: 600 12px 'Inter', system-ui, sans-serif; color: var(--navy2); cursor: pointer;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .gl-toggle:hover { background: #EEF1F6; }
    .gl-toggle:focus-visible { outline: 2px solid var(--navy); outline-offset: 1px; }

    .gl-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 4px 0 22px; flex-wrap: wrap; }
    .gl-remember { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink); cursor: pointer; user-select: none; }
    .gl-remember input { width: 16px; height: 16px; accent-color: var(--navy); cursor: pointer; margin: 0; }
    .gl-help { font-size: 13px; color: var(--muted); }

    .gl-error {
      display: flex; gap: 10px; align-items: flex-start;
      background: #FEF3F2; border: 1px solid #FECDCA; color: var(--err);
      font-size: 13px; line-height: 1.45; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px;
    }
    .gl-error svg { flex-shrink: 0; margin-top: 1px; }

    .gl-btn {
      width: 100%; height: 48px; border: 0; border-radius: 8px;
      background: var(--navy); color: #fff;
      font: 600 15px 'Inter', system-ui, sans-serif; letter-spacing: .2px;
      display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      cursor: pointer; transition: background .15s, box-shadow .15s;
      box-shadow: inset 0 -2px 0 var(--gold);
    }
    .gl-btn:hover:not(:disabled) { background: var(--navy2); }
    .gl-btn:focus-visible { outline: 3px solid rgba(201,162,75,.6); outline-offset: 2px; }
    .gl-btn:disabled { opacity: .7; cursor: default; }
    .gl-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: gl-spin .7s linear infinite; }

    .gl-card-foot { margin-top: 22px; padding-top: 18px; border-top: 1px solid #EEF0F4; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }

    .gl-legal { text-align: center; font-size: 12px; color: #8A93A3; margin-top: 18px; }

    @media (max-width: 900px) {
      .gl-page { grid-template-columns: 1fr; background: var(--bg); }
      .gl-brand { display: none; }
      .gl-main { align-items: flex-start; padding: 32px 16px 24px; }
      .gl-mobile-brand { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 20px; }
      .gl-crest-img { width: 88px; height: auto; margin-bottom: 10px; }
      .gl-card-crest { display: none; }
      .gl-mobile-name { font-family: 'Source Serif 4', Georgia, serif; font-weight: 700; font-size: 18px; color: var(--navy); }
      .gl-mobile-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
      .gl-card { padding: 28px 22px 22px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .gl-card, .gl-poster { animation: none !important; }
    }
`
  document.head.appendChild(style)
}

// ── Supabase Auth link (Security Phase 1) ─────────────────────────────────
// After the normal GNSI password check succeeds, the same username/password
// also signs the staff member into Supabase Auth, and staff_link_auth()
// (runs inside the database, re-checks the GNSI password) records which
// staff account it is. From then on the database can tell staff apart from
// the public website. Never blocks login: if anything here fails, the
// staff member still gets in exactly as before.
const staffEmail = (u) => `${String(u).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_')}.staff@guidancekhangabok.in`

async function linkSupabaseAuth(username, password, isAdminShortcut = false) {
  try {
    const email = staffEmail(username)
    let { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const r = await supabase.auth.signUp({ email, password })
      if (r.error || !r.data?.session) {
        // Account exists but still has an OLD password (password was changed
        // in the Admin Panel / dashboard). Verify the real password on the
        // server, copy it to the secure login, then sign in again.
        const { data: synced } = await supabase.rpc('staff_sync_auth_password', {
          p_username: username.trim(), p_password: password, p_admin: isAdminShortcut,
        })
        const retry = synced ? await supabase.auth.signInWithPassword({ email, password }) : { error: true }
        if (retry.error) {
          console.warn('Supabase Auth link skipped:', r.error?.message || 'no session (is "Confirm email" turned off?)')
          return false
        }
      }
    }
    const { data, error: linkErr } = await supabase.rpc('staff_link_auth', {
      p_username: username.trim(), p_password: password, p_admin: isAdminShortcut,
    })
    if (linkErr || !data) {
      console.warn('staff_link_auth failed:', linkErr?.message || 'not verified')
      await supabase.auth.signOut()
      return false
    }
    return true
  } catch (e) {
    console.warn('Supabase Auth link error:', e)
    return false
  }
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

const EyeOpen = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const EyeClosed = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)
const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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

  const doLogin = async () => {
    setError('')
    if (!username.trim() || !password.trim()) {
      showError('Please enter both username and password.'); return
    }
    setLoading(true)

    if (rememberMe) localStorage.setItem('gnsi_remembered_user', username.trim())
    else            localStorage.removeItem('gnsi_remembered_user')

    if (username.trim() === ADMIN_USER) {
      // Password is checked ON THE SERVER (admin_login_check, bcrypt).
      // Falls back to the old table read only until admin_bcrypt.sql is run.
      let status = null
      const { data: st, error: rpcErr } = await supabase.rpc('admin_login_check', { p_password: password })
      if (!rpcErr) status = st
      else {
        const { data, error: dbErr } = await supabase
          .from('admin_credentials').select('password_hash, is_changed').eq('id', 1).single()
        if (dbErr || !data) {
          showError('Admin credentials not found. Contact system administrator.')
          setLoading(false); return
        }
        status = !data.is_changed ? 'default' : (password === data.password_hash ? 'ok' : 'bad')
      }
      // No password is built into the website any more. If the admin password
      // was never set, it must be set once in Supabase (admin_set_password.sql).
      if (status === 'default') {
        showError('Admin password is not set up yet. Set it in Supabase (admin_set_password.sql).')
        setLoading(false); return
      }
      const ok = status === 'ok'

      if (!ok) { showError('Invalid username or password.'); setLoading(false); return }

      // This hardcoded admin login is separate from portal_users, so it
      // has no row to join against staff_profiles automatically the way
      // the normal login path below does. staff_profile_id is set here
      // directly to Moirangthem Himan Singh's staff_profiles row (id 37)
      // so admin-only RPCs (Control Center, Premium toggle, automation
      // rules) — which check is_staff_admin(p_admin_id) against a real
      // staff_profiles id — can verify this session. If this admin login
      // is ever handed to a different person, update this id to match.
      // set_staff_context now runs AFTER linkSupabaseAuth (below) — the
      // server only grants admin to a signed-in, linked admin session.

      // Look up the REAL portal_users row for this username (if one
      // exists) so the session carries the actual stored role/name/id
      // rather than the hardcoded placeholders below. This matters
      // because server-side RPCs like set_attendance_mark look the
      // acting user up by username in portal_users directly — a session
      // built from placeholders alone (role: 'Admin', a fake id) would
      // silently fail those lookups even though the login itself
      // succeeded. Falls back to the placeholder object only if no
      // matching portal_users row exists (e.g. VITE_ADMIN_USERNAME set
      // to a value with no corresponding row).
      const { data: realUser } = await supabase
        .from('portal_users')
        .select('id, name, username, role, staff_profile_id')
        .eq('username', ADMIN_USER)
        .maybeSingle()

      await linkSupabaseAuth(username, password, true)
      await supabase.rpc('set_staff_context', { p_staff_id: 37, p_is_admin: true })
      onLogin(realUser
        ? { ...realUser, staff_profile_id: realUser.staff_profile_id ?? 37 }
        : { id: 'admin', name: 'Administrator', username: ADMIN_USER, role: 'Admin', staff_profile_id: 37 }
      )
      setLoading(false); return
    }

    // Password is checked inside the database (staff_verify_login) so the
    // browser never reads password hashes. Falls back to the old direct
    // check only if the Phase 1 SQL hasn't been run yet.
    let data = null, dbErr = null
    const rpc = await supabase.rpc('staff_verify_login', { p_username: username.trim(), p_password: password.trim() })
    if (!rpc.error) {
      data = rpc.data || null
    } else {
      const hashedPassword = await sha256(password.trim())
      ;({ data, error: dbErr } = await supabase
        .from('portal_users')
        .select('id, name, username, role, active, staff_profile_id')
        .eq('username', username.trim().toLowerCase())
        .eq('password_hash', hashedPassword)
        .eq('active', true)
        .single())
    }

    if (dbErr || !data) {
      showError('Invalid username or password.')
      setLoading(false); return
    }

    // Link the secure session FIRST so the staff_profiles lookup below works
    // once that table is private (private_lockdown.sql).
    await linkSupabaseAuth(username.trim().toLowerCase(), password.trim())

    // Trust the existing portal_users.staff_profile_id link when it's set —
    // matching on name is fragile (duplicate/near-duplicate names, casing,
    // whitespace) and can silently attach the wrong profile or none at all.
    // Only fall back to a name lookup for legacy accounts that were never
    // linked in the database.
    let profile = null
    if (data.staff_profile_id != null) {
      const { data: p } = await supabase
        .from('staff_profiles')
        .select('id, department, designation, email')
        .eq('id', data.staff_profile_id)
        .maybeSingle()
      profile = p
    } else {
      const { data: p } = await supabase
        .from('staff_profiles')
        .select('id, department, designation, email')
        .eq('name', data.name)
        .maybeSingle()
      profile = p
    }


    await supabase.rpc('set_staff_context', {
  p_staff_id: profile?.id ?? 0,
  // Matches App.jsx's ADMIN_ROLES set. Previously checked only
  // 'Admin' || 'HM', which never matched 'Administrator' or 'Co-Admin'
  // — meaning every real admin login (not the hardcoded shortcut path
  // above) silently got p_is_admin: false, breaking every RLS policy
  // and RPC that gates on app.is_admin for real admin accounts.
  p_is_admin: ['Admin', 'Administrator', 'Co-Admin', 'admin', 'HM'].includes(data.role),
})
onLogin({
  ...data,
  staff_profile_id: profile?.id         ?? data.staff_profile_id ?? null,
  department:       profile?.department  ?? null,
  designation:      profile?.designation ?? null,
  email:            profile?.email       ?? null,
})

    setLoading(false)
  }

  // Wrapper: any unexpected failure (network drop, Supabase outage) shows a
  // message and re-enables the button instead of leaving it stuck.
  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (loading) return
    try {
      await doLogin()
    } catch (err) {
      console.error('Login failed:', err)
      showError('Could not reach the server. Check your connection and try again.')
      setLoading(false)
    }
  }

  const year = new Date().getFullYear()

  return (
    <div className="gl-page">
      {/* Institute panel (hidden on phones) */}
      <aside className="gl-brand">
        <img
          className="gl-poster"
          src={loginPoster}
          alt="Guidance Navodaya & Sainik Institute — Celebrating 10 Years of Success"
        />
      </aside>

      {/* Sign-in */}
      <main className="gl-main">
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="gl-mobile-brand">
            <img className="gl-crest-img" src={gnsiCrest} alt="GNSI crest" />
            <div className="gl-mobile-name">Guidance Navodaya &amp; Sainik Institute</div>
            <div className="gl-mobile-sub">GNSI ERP · Staff Portal</div>
          </div>

          <form
            ref={cardRef}
            className={`gl-card${shakeCard ? ' shake' : ''}`}
            onSubmit={handleLogin}
            noValidate
          >
            <img className="gl-card-crest" src={gnsiCrest} alt="" aria-hidden="true" />
            <h1 className="gl-title">Sign in</h1>
            <p className="gl-sub">Use your GNSI staff account to continue.</p>

            <div className="gl-field">
              <label className="gl-label" htmlFor="gl-username">Username</label>
              <input
                id="gl-username"
                className="gl-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Your username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                aria-invalid={error ? 'true' : undefined}
                autoFocus={!username}
              />
            </div>

            <div className="gl-field">
              <label className="gl-label" htmlFor="gl-password">Password</label>
              <div className="gl-input-wrap">
                <input
                  id="gl-password"
                  className="gl-input has-toggle"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={error ? 'true' : undefined}
                  autoFocus={!!username}
                />
                <button
                  type="button"
                  className="gl-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeClosed /> : <EyeOpen />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="gl-row">
              <label className="gl-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                Remember my username
              </label>
              <span className="gl-help">Forgot password? Contact the admin.</span>
            </div>

            {error && (
              <div className="gl-error" role="alert">
                <AlertIcon /> <span>{error}</span>
              </div>
            )}

            <button type="submit" className="gl-btn" disabled={loading}>
              {loading ? <><span className="gl-spinner" aria-hidden="true" /> Signing in…</> : 'Sign in'}
            </button>

            <div className="gl-card-foot">
              <ShieldIcon /> For authorised GNSI staff only.
            </div>
          </form>

          <p className="gl-legal">© {year} Guidance Navodaya &amp; Sainik Institute</p>
        </div>
      </main>
    </div>
  )
}