import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { loadSystemSettings, useSystemSettings, getInstitute } from './systemSettings'

// ─────────────────────────────────────────────────────────────────────────
// Login — "Ledger & Crest" design (navy + brass gold, serif headings).
// Only the presentation changed; the sign-in logic (admin shortcut via
// admin_credentials, SHA-256 check against portal_users, staff_profiles
// lookup, set_staff_context RPC, Remember me) is unchanged.
// ─────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'gnsi-login-styles-v6'
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return
  // Remove the old login stylesheet if an earlier version injected it
  document.getElementById('gnsi-login-styles')?.remove()
  document.getElementById('gnsi-login-styles-v3')?.remove()
  document.getElementById('gnsi-login-styles-v4')?.remove()
  document.getElementById('gnsi-login-styles-v5')?.remove()
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Inter:wght@400;500;600;700;800&display=swap');

    .gl-page, .gl-page *, .gl-page *::before, .gl-page *::after { box-sizing: border-box; }
    .gl-page {
      --gold: #C9A24B; --goldL: #E8CF8E; --goldLL: #F6E7B8; --navy: #0B1E3D; --ink: #050E1F;
      position: relative; min-height: 100vh; min-height: 100dvh; overflow: hidden; isolation: isolate;
      display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr);
      background: var(--ink); color: #fff; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased;
    }

    /* ── living background: aurora blobs, fine grid, drifting gold dust ── */
    .gl-aurora, .gl-grid, .gl-dust { position: absolute; inset: 0; pointer-events: none; z-index: -1; }
    .gl-aurora::before, .gl-aurora::after { content: ''; position: absolute; border-radius: 50%; filter: blur(70px); opacity: .75; }
    .gl-aurora::before { width: 62vmax; height: 62vmax; left: -16vmax; top: -22vmax; background: radial-gradient(circle, #1D4F91 0%, rgba(29,79,145,0) 68%); animation: gl-drift 22s ease-in-out infinite alternate; }
    .gl-aurora::after { width: 52vmax; height: 52vmax; right: -14vmax; bottom: -22vmax; background: radial-gradient(circle, rgba(201,162,75,.55) 0%, rgba(201,162,75,0) 66%); animation: gl-drift 28s ease-in-out infinite alternate-reverse; }
    .gl-grid { background-image: linear-gradient(rgba(232,207,142,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(232,207,142,.06) 1px, transparent 1px); background-size: 56px 56px;
      -webkit-mask-image: radial-gradient(70% 70% at 35% 45%, #000 20%, transparent 78%); mask-image: radial-gradient(70% 70% at 35% 45%, #000 20%, transparent 78%); }
    .gl-dust i { position: absolute; bottom: -12px; width: 3px; height: 3px; border-radius: 50%; background: var(--goldL); box-shadow: 0 0 10px 2px rgba(232,207,142,.55); opacity: 0; animation: gl-float linear infinite; }

    @keyframes gl-drift { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(7vmax, 5vmax, 0) scale(1.15); } }
    @keyframes gl-float { 0% { transform: translateY(0) translateX(0); opacity: 0; } 12% { opacity: .9; } 100% { transform: translateY(-105vh) translateX(26px); opacity: 0; } }
    @keyframes gl-spin { to { transform: rotate(360deg); } }
    @keyframes gl-spin-r { to { transform: rotate(-360deg); } }
    @keyframes gl-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
    @keyframes gl-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
    @keyframes gl-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(3px)} }
    @keyframes gl-shine { from { transform: translateX(-130%) skewX(-18deg); } to { transform: translateX(260%) skewX(-18deg); } }
    @keyframes gl-pulse { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }

    /* ── stage (left): emblem inside slowly turning gold rings ── */
    .gl-stage { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 40px; text-align: center; }
    .gl-emblem { --px: 0px; --py: 0px; position: relative; width: min(46vmin, 430px); height: min(46vmin, 430px); display: grid; place-items: center; transform: translate(var(--px), var(--py)); transition: transform .25s ease-out; }
    .gl-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(232,207,142,.35); }
    .gl-ring.r1 { inset: 0; border-style: dashed; border-color: rgba(232,207,142,.38); animation: gl-spin 60s linear infinite; }
    .gl-ring.r2 { inset: 7%; border-color: rgba(232,207,142,.22); animation: gl-spin-r 44s linear infinite; }
    .gl-ring.r2::before { content: ''; position: absolute; top: -5px; left: 50%; width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%; background: var(--goldL); box-shadow: 0 0 16px 4px rgba(232,207,142,.7); }
    .gl-ring.r3 { inset: 15%; border: 0; background: radial-gradient(circle, rgba(29,79,145,.55), rgba(11,30,61,.0) 70%); animation: gl-pulse 6s ease-in-out infinite; }
    .gl-logo { position: relative; height: 68%; width: auto; max-width: 78%; object-fit: contain; animation: gl-bob 7s ease-in-out infinite;
      filter: drop-shadow(0 18px 30px rgba(0,0,0,.55)) drop-shadow(0 0 34px rgba(232,207,142,.25)); }
    .gl-tag { margin-top: 44px; font-family: 'Source Serif 4', Georgia, serif; font-weight: 600; font-size: clamp(22px, 2.4vw, 34px); line-height: 1.25; letter-spacing: -.005em; color: #fff; animation: gl-rise .8s .2s both; }
    .gl-tag em { font-style: normal; background: linear-gradient(90deg, var(--goldLL), var(--gold)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .gl-where { margin-top: 10px; font-size: 12px; font-weight: 700; letter-spacing: .24em; text-transform: uppercase; color: rgba(232,207,142,.85); animation: gl-rise .8s .35s both; }
    .gl-chips { margin-top: 22px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; animation: gl-rise .8s .5s both; }
    .gl-chips span { padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,.88); background: rgba(255,255,255,.06); border: 1px solid rgba(232,207,142,.25); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }

    /* ── sign-in (right): glass card with a gold hairline border ── */
    .gl-main { position: relative; display: flex; align-items: center; justify-content: center; padding: 40px 36px; }
    .gl-wrap { width: min(440px, 100%); }
    .gl-card { position: relative; padding: 38px 36px 28px; border-radius: 30px; background: linear-gradient(160deg, rgba(255,255,255,.12), rgba(255,255,255,.04));
      border: 1px solid rgba(255,255,255,.14); backdrop-filter: blur(26px) saturate(1.5); -webkit-backdrop-filter: blur(26px) saturate(1.5);
      box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 40px 80px -30px rgba(0,0,0,.75), 0 0 0 1px rgba(5,14,31,.5); animation: gl-rise .7s cubic-bezier(.2,.7,.2,1) both; }
    .gl-card::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px; pointer-events: none;
      background: linear-gradient(140deg, rgba(246,231,184,.95), rgba(201,162,75,.15) 38%, rgba(201,162,75,.0) 60%, rgba(232,207,142,.7));
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
    .gl-card.shake { animation: gl-shake .5s both; }
    .gl-head { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
    .gl-mark { width: 64px; height: 64px; flex: 0 0 64px; display: grid; place-items: center; }
    .gl-mark img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 6px 14px rgba(0,0,0,.5)) drop-shadow(0 0 16px rgba(232,207,142,.3)); }
    .gl-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .24em; text-transform: uppercase; color: var(--goldL); }
    .gl-title { margin: 3px 0 0; font-family: 'Source Serif 4', Georgia, serif; font-weight: 700; font-size: 31px; line-height: 1.1; letter-spacing: -.01em; color: #fff; }
    .gl-sub { margin: 0 0 24px; font-size: 14px; line-height: 1.55; color: rgba(255,255,255,.7); }

    .gl-field { margin-bottom: 16px; }
    .gl-input-wrap { position: relative; }
    .gl-input { width: 100%; height: 58px; padding: 22px 16px 6px 48px; font: 500 16px 'Inter', sans-serif; color: #fff; caret-color: var(--goldL);
      background: rgba(5,14,31,.55); border: 1.5px solid rgba(255,255,255,.14); border-radius: 16px; outline: none; transition: border-color .2s, box-shadow .2s, background .2s; }
    .gl-input.has-toggle { padding-right: 84px; }
    .gl-input::placeholder { color: transparent; }
    .gl-input:hover { border-color: rgba(232,207,142,.4); }
    .gl-input:focus { border-color: var(--goldL); background: rgba(5,14,31,.75); box-shadow: 0 0 0 4px rgba(232,207,142,.16), 0 10px 26px -12px rgba(232,207,142,.5); }
    .gl-input:-webkit-autofill { -webkit-text-fill-color: #fff; -webkit-box-shadow: 0 0 0 40px #0B1E3D inset; }
    .gl-label { position: absolute; left: 48px; top: 19px; font-size: 15px; font-weight: 500; color: rgba(255,255,255,.55); pointer-events: none; transform-origin: left top; transition: transform .18s ease, color .18s ease; }
    .gl-input:focus + .gl-label, .gl-input:not(:placeholder-shown) + .gl-label { transform: translateY(-11px) scale(.76); color: var(--goldL); font-weight: 700; letter-spacing: .04em; }
    .gl-ico { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: rgba(232,207,142,.8); display: flex; pointer-events: none; transition: color .2s; }
    .gl-input:focus ~ .gl-ico { color: var(--goldLL); }
    .gl-toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 6px; padding: 7px 10px; border: 0; border-radius: 10px; background: rgba(255,255,255,.07); color: var(--goldL); font: 700 12px 'Inter', sans-serif; cursor: pointer; transition: background .2s; }
    .gl-toggle:hover { background: rgba(255,255,255,.14); }

    .gl-row { display: flex; align-items: center; justify-content: space-between; gap: 10px 14px; flex-wrap: wrap; margin: 2px 0 20px; }
    .gl-remember { display: inline-flex; align-items: center; gap: 9px; font-size: 13px; color: rgba(255,255,255,.85); cursor: pointer; user-select: none; }
    .gl-remember input { appearance: none; -webkit-appearance: none; width: 20px; height: 20px; margin: 0; border-radius: 7px; border: 1.5px solid rgba(255,255,255,.35); background: rgba(5,14,31,.5); display: grid; place-items: center; cursor: pointer; transition: .15s; }
    .gl-remember input:checked { background: linear-gradient(160deg, var(--goldLL), var(--gold)); border-color: var(--goldL); }
    .gl-remember input:checked::after { content: ''; width: 5px; height: 10px; margin-top: -2px; border: solid #2A1D05; border-width: 0 2.4px 2.4px 0; transform: rotate(45deg); }
    .gl-remember input:focus-visible { outline: 2px solid var(--goldL); outline-offset: 2px; }
    .gl-help { font-size: 12px; color: rgba(255,255,255,.55); }

    .gl-error { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 16px; padding: 12px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; font-weight: 600; color: #FFD3CE; background: rgba(180,35,24,.22); border: 1px solid rgba(255,140,128,.45); }
    .gl-error svg { flex: 0 0 auto; margin-top: 2px; }

    .gl-btn { position: relative; overflow: hidden; width: 100%; height: 58px; display: flex; align-items: center; justify-content: center; gap: 10px; border: 0; border-radius: 18px; cursor: pointer;
      font: 800 16px 'Inter', sans-serif; letter-spacing: .01em; color: #2A1D05; background: linear-gradient(180deg, #F6E1A0, #C9A24B 92%);
      box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 18px 34px -14px rgba(201,162,75,.85); transition: transform .18s, box-shadow .18s, filter .18s; }
    .gl-btn::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent); transform: translateX(-130%) skewX(-18deg); }
    .gl-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 24px 40px -14px rgba(201,162,75,1); }
    .gl-btn:hover:not(:disabled)::after { animation: gl-shine .9s ease; }
    .gl-btn:active:not(:disabled) { transform: translateY(0); }
    .gl-btn:disabled { cursor: default; filter: saturate(.7) brightness(.92); }
    .gl-btn:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
    .gl-btn-arrow { transition: transform .2s; }
    .gl-btn:hover:not(:disabled) .gl-btn-arrow { transform: translateX(5px); }
    .gl-spinner { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid rgba(42,29,5,.3); border-top-color: #2A1D05; animation: gl-spin .7s linear infinite; }

    .gl-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 22px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.12); font-size: 12px; color: rgba(255,255,255,.6); }
    .gl-card-foot span { display: inline-flex; align-items: center; gap: 7px; }
    .gl-card-foot a { color: var(--goldL); font-weight: 700; text-decoration: none; }
    .gl-card-foot a:hover { text-decoration: underline; text-underline-offset: 3px; }
    .gl-legal { margin: 18px 0 0; text-align: center; font-size: 11.5px; color: rgba(255,255,255,.4); }

    /* field entrance */
    .gl-head, .gl-sub, .gl-field, .gl-row, .gl-btn, .gl-card-foot { animation: gl-rise .6s cubic-bezier(.2,.7,.2,1) backwards; }
    .gl-sub { animation-delay: .08s; } .gl-field:nth-of-type(1) { animation-delay: .14s; } .gl-field:nth-of-type(2) { animation-delay: .2s; }
    .gl-row { animation-delay: .26s; } .gl-btn { animation-delay: .32s; } .gl-card-foot { animation-delay: .38s; }

    /* ── tablet / phone: stage collapses to a compact crest above the card ── */
    @media (max-width: 960px) {
      .gl-page { grid-template-columns: minmax(0, 1fr); align-content: start; }
      .gl-stage { padding: 30px 20px 4px; }
      .gl-emblem { width: 168px; height: 168px; }
      .gl-tag { margin-top: 14px; font-size: 22px; }
      .gl-where { margin-top: 6px; font-size: 10.5px; letter-spacing: .2em; }
      .gl-chips { display: none; }
      .gl-main { padding: 18px 16px 34px; align-items: flex-start; }
      .gl-card { padding: 28px 22px 22px; border-radius: 26px; }
      .gl-title { font-size: 27px; }
    }
    @media (max-width: 380px) { .gl-emblem { width: 140px; height: 140px; } .gl-card { padding: 24px 18px 20px; } }
    @media (prefers-reduced-motion: reduce) { .gl-page *, .gl-page *::before, .gl-page *::after { animation: none !important; transition: none !important; } }
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

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>
  </svg>
)
const ArrowIcon = () => (
  <svg className="gl-btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>
  </svg>
)

// Minutes (rounded up) until a lockout ends.
const minsLeft = until => Math.max(1, Math.ceil((until - Date.now()) / 60000))

export default function Login({ onLogin, onLoginFailed, checkLock }) {
  const [username,     setUsername]     = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe,   setRememberMe]   = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [shakeCard,    setShakeCard]    = useState(false)
  const cardRef = useRef(null)
  const emblemRef = useRef(null)

  const ADMIN_USER = import.meta.env.VITE_ADMIN_USERNAME

  useEffect(() => { injectStyles(); loadSystemSettings() }, [])
  useSystemSettings()
  const instName = getInstitute().name
  useEffect(() => {
    const saved = localStorage.getItem('gnsi_remembered_user')
    if (saved) { setUsername(saved); setRememberMe(true) }
  }, [])

  const failed = () => {
    const r = onLoginFailed?.()
    if (r?.locked) showError(`Too many failed attempts. Login is locked for ${minsLeft(r.until)} minute${minsLeft(r.until) === 1 ? '' : 's'}.`)
    else showError('Invalid username or password.')
  }

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
    // Too many wrong passwords → locked for a while (System Settings →
    // Security: Max Login Attempts / Lockout Duration).
    const lock = checkLock?.()
    if (lock?.locked) {
      showError(`Too many failed attempts. Try again in ${minsLeft(lock.until)} minute${minsLeft(lock.until) === 1 ? '' : 's'}.`); return
    }
    setLoading(true)

    if (rememberMe) localStorage.setItem('gnsi_remembered_user', username.trim())
    else            localStorage.removeItem('gnsi_remembered_user')

    if (username.trim() === ADMIN_USER) {
      // Password is checked ON THE SERVER (admin_login_check, bcrypt). There is no browser-side
      // fallback: the browser never reads password hashes.
      const { data: status, error: rpcErr } = await supabase.rpc('admin_login_check', { p_password: password })
      if (rpcErr) {
        showError('Login service is unavailable. Run admin_bcrypt.sql in Supabase or contact the system administrator.')
        setLoading(false); return
      }
      // No password is built into the website any more. If the admin password
      // was never set, it must be set once in Supabase (admin_set_password.sql).
      if (status === 'default') {
        showError('Admin password is not set up yet. Set it in Supabase (admin_set_password.sql).')
        setLoading(false); return
      }
      const ok = status === 'ok'

      if (!ok) { failed(); setLoading(false); return }

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

    // Password is checked inside the database (staff_verify_login) so the browser never reads
    // password hashes. There is no browser-side fallback.
    const rpc = await supabase.rpc('staff_verify_login', { p_username: username.trim(), p_password: password.trim() })
    if (rpc.error) {
      showError('Login service is unavailable. Please contact the system administrator.')
      setLoading(false); return
    }
    const data = rpc.data || null

    if (!data) {
      failed()
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

  // Gentle pointer parallax for the emblem (skipped when the user prefers reduced motion)
  const onMove = (e) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const el = emblemRef.current
    if (!el) return
    const x = (e.clientX / window.innerWidth - 0.5) * 22
    const y = (e.clientY / window.innerHeight - 0.5) * 22
    el.style.setProperty('--px', `${x.toFixed(1)}px`)
    el.style.setProperty('--py', `${y.toFixed(1)}px`)
  }
  const dust = [[8, 11], [17, 15], [26, 9], [35, 13], [47, 12], [58, 16], [67, 10], [76, 14], [86, 12], [93, 17]]

  return (
    <div className="gl-page" onMouseMove={onMove}>
      <div className="gl-aurora" aria-hidden="true" />
      <div className="gl-grid" aria-hidden="true" />
      <div className="gl-dust" aria-hidden="true">
        {dust.map(([left, dur], i) => <i key={i} style={{ left: `${left}%`, animationDuration: `${dur + 6}s`, animationDelay: `${-i * 1.7}s` }} />)}
      </div>

      {/* Stage: institute emblem inside turning gold rings */}
      <aside className="gl-stage">
        <div className="gl-emblem" ref={emblemRef}>
          <span className="gl-ring r1" /><span className="gl-ring r2" /><span className="gl-ring r3" />
          <img className="gl-logo" src="/gnsi-logo-10y.webp" alt="Guidance Navodaya & Sainik Institute — celebrating 10 years of success" />
        </div>
        <div className="gl-tag">Guiding every child to <em>Navodaya &amp; Sainik</em> success</div>
        <div className="gl-where">Khangabok · Thoubal · Manipur</div>
        <div className="gl-chips"><span>Est. 2016</span><span>10 years of success</span><span>GNSI ERP · Staff Portal</span></div>
      </aside>

      {/* Sign-in */}
      <main className="gl-main">
        <div className="gl-wrap">
          <form
            ref={cardRef}
            className={`gl-card${shakeCard ? ' shake' : ''}`}
            onSubmit={handleLogin}
            noValidate
          >
            <div className="gl-head">
              <div className="gl-mark"><img src="/gnsi-mark.webp" alt="" aria-hidden="true" /></div>
              <div>
                <div className="gl-eyebrow">Staff Portal</div>
                <h1 className="gl-title">Welcome back</h1>
              </div>
            </div>
            <p className="gl-sub">Sign in with your GNSI staff account to open your dashboard.</p>

            <div className="gl-field">
              <div className="gl-input-wrap">
                <input
                  id="gl-username"
                  className="gl-input"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder=" "
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-invalid={error ? 'true' : undefined}
                  autoFocus={!username}
                />
                <label className="gl-label" htmlFor="gl-username">Username</label>
                <span className="gl-ico"><UserIcon /></span>
              </div>
            </div>

            <div className="gl-field">
              <div className="gl-input-wrap">
                <input
                  id="gl-password"
                  className="gl-input has-toggle"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder=" "
                  autoComplete="current-password"
                  aria-invalid={error ? 'true' : undefined}
                  autoFocus={!!username}
                />
                <label className="gl-label" htmlFor="gl-password">Password</label>
                <span className="gl-ico"><LockIcon /></span>
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
              {loading ? <><span className="gl-spinner" aria-hidden="true" /> Signing in…</> : <>Sign in <ArrowIcon /></>}
            </button>

            <div className="gl-card-foot">
              <span><ShieldIcon /> Authorised GNSI staff only</span>
              <a href="/">← Back to website</a>
            </div>
          </form>

          <p className="gl-legal">© {year} {instName}</p>
        </div>
      </main>
    </div>
  )
}