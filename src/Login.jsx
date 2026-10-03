import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { loadSystemSettings, useSystemSettings, getInstitute } from './systemSettings'
// Put both images next to Login.jsx (Vite bundles them)
import loginPoster from './login-poster.jpg'
import gnsiCrest from './gnsi-crest.png'

// ─────────────────────────────────────────────────────────────────────────
// Login — "Ledger & Crest" design (navy + brass gold, serif headings).
// Only the presentation changed; the sign-in logic (admin shortcut via
// admin_credentials, SHA-256 check against portal_users, staff_profiles
// lookup, set_staff_context RPC, Remember me) is unchanged.
// ─────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'gnsi-login-styles-v5'
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return
  // Remove the old login stylesheet if an earlier version injected it
  document.getElementById('gnsi-login-styles')?.remove()
  document.getElementById('gnsi-login-styles-v3')?.remove()
  document.getElementById('gnsi-login-styles-v4')?.remove()
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap');

    .gl-page, .gl-page *, .gl-page *::before, .gl-page *::after { box-sizing: border-box; }

    @keyframes gl-fade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes gl-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @keyframes gl-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 50%{transform:translateX(6px)} 75%{transform:translateX(-3px)} }
    @keyframes gl-spin { to { transform: rotate(360deg); } }
    @keyframes gl-sheen { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(260%) skewX(-18deg); } }
    @keyframes gl-glow { 0%,100% { opacity: .55; } 50% { opacity: .9; } }

    .gl-page {
      --navy: #0B1E3D; --navy2: #132B52; --navy3: #1B3A6B; --gold: #C9A24B; --goldL: #E8CF8E; --goldD: #A8832F;
      --ink: #0F172A; --muted: #5B6475; --line: #E1E5EC; --bg: #F4F1EA; --err: #B42318;
      min-height: 100vh; min-height: 100dvh;
      display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
      background: var(--bg);
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: var(--ink);
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Left: GNSI poster (panel navy matches the poster's #0E3266) ── */
    .gl-brand {
      position: relative;
      background: radial-gradient(120% 90% at 50% 0%, #17448a 0%, #0E3266 55%, #081f45 100%);
      display: flex; align-items: center; justify-content: center;
      padding: 40px; overflow: hidden;
    }
    .gl-brand::before {            /* brass hairline frame */
      content: ''; position: absolute; inset: 18px; border-radius: 14px; pointer-events: none;
      border: 1px solid rgba(226,197,126,.38);
      box-shadow: inset 0 0 0 4px rgba(8,31,69,.55), inset 0 0 0 5px rgba(226,197,126,.16);
    }
    .gl-brand::after {             /* vertical gold seam to the sign-in side */
      content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 3px;
      background: linear-gradient(180deg, transparent, var(--goldL) 18%, var(--gold) 50%, var(--goldL) 82%, transparent);
    }
    .gl-poster {
      position: relative; z-index: 1;
      display: block; width: auto; height: auto;
      max-width: 100%; max-height: calc(100dvh - 112px);
      object-fit: contain; border-radius: 6px;
      filter: drop-shadow(0 24px 40px rgba(2,10,28,.55));
      animation: gl-fade .7s cubic-bezier(.2,.7,.2,1) both;
    }

    /* ── Right: sign-in ── */
    .gl-main {
      position: relative; display: flex; align-items: center; justify-content: center; padding: 40px 24px;
      background:
        radial-gradient(60% 50% at 85% 8%, rgba(201,162,75,.20), transparent 70%),
        radial-gradient(55% 45% at 5% 95%, rgba(19,43,82,.12), transparent 70%),
        linear-gradient(180deg, #FAF8F3 0%, #F1EEE6 100%);
      overflow: hidden;
    }
    .gl-main::before {             /* faint engraved grid */
      content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
      background-image: linear-gradient(rgba(11,30,61,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,30,61,.035) 1px, transparent 1px);
      background-size: 36px 36px;
      -webkit-mask-image: radial-gradient(70% 70% at 50% 50%, #000 30%, transparent 100%);
      mask-image: radial-gradient(70% 70% at 50% 50%, #000 30%, transparent 100%);
    }
    .gl-wrap { position: relative; z-index: 1; width: 100%; max-width: 420px; }

    .gl-card {
      position: relative; width: 100%;
      background: linear-gradient(180deg, #FFFFFF 0%, #FCFCFD 100%);
      border: 1px solid rgba(225,229,236,.9); border-radius: 20px;
      padding: 40px 36px 30px;
      box-shadow:
        0 1px 0 rgba(255,255,255,.9) inset,
        0 2px 4px rgba(11,30,61,.04),
        0 16px 32px -8px rgba(11,30,61,.10),
        0 40px 80px -24px rgba(11,30,61,.20);
      animation: gl-fade .6s cubic-bezier(.2,.7,.2,1) both;
      overflow: hidden;
    }
    .gl-card::before {             /* brass accent edge */
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, var(--goldD), var(--goldL) 35%, var(--gold) 65%, var(--goldD));
    }
    .gl-card::after {              /* soft corner glow */
      content: ''; position: absolute; top: -90px; right: -90px; width: 220px; height: 220px; border-radius: 50%;
      background: radial-gradient(circle, rgba(201,162,75,.18), transparent 70%); pointer-events: none;
      animation: gl-glow 6s ease-in-out infinite;
    }
    .gl-card.shake { animation: gl-shake .35s ease; }
    .gl-card > * { position: relative; z-index: 1; }
    .gl-card > .gl-card-crest, .gl-eyebrow, .gl-title, .gl-sub, .gl-field, .gl-row, .gl-btn, .gl-card-foot { animation: gl-rise .55s cubic-bezier(.2,.7,.2,1) backwards; }
    .gl-card-crest { animation-delay: .05s !important; }
    .gl-eyebrow { animation-delay: .10s !important; }
    .gl-title { animation-delay: .14s !important; }
    .gl-sub { animation-delay: .18s !important; }
    .gl-sub + .gl-field { animation-delay: .24s !important; }
    .gl-field + .gl-field { animation-delay: .30s !important; }
    .gl-row { animation-delay: .36s !important; }
    .gl-btn { animation-delay: .42s !important; }
    .gl-card-foot { animation-delay: .48s !important; }

    .gl-mobile-brand { display: none; }

    .gl-card-crest { display: block; width: 72px; height: auto; margin: 0 0 20px; filter: drop-shadow(0 6px 10px rgba(11,30,61,.18)); }
    .gl-eyebrow { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--goldD); margin: 0 0 10px; }
    .gl-eyebrow::after { content: ''; flex: 0 0 36px; height: 1px; background: linear-gradient(90deg, var(--gold), transparent); }
    .gl-title { font-family: 'Source Serif 4', Georgia, serif; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -.015em; color: var(--navy); margin: 0 0 8px; }
    .gl-sub { font-size: 14.5px; line-height: 1.5; color: var(--muted); margin: 0 0 30px; }

    .gl-field { margin-bottom: 18px; }
    .gl-label { display: block; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #334155; margin-bottom: 8px; }
    .gl-input-wrap { position: relative; }
    .gl-ico { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #8A93A3; display: flex; pointer-events: none; transition: color .18s; }
    .gl-input-wrap:focus-within .gl-ico { color: var(--navy); }
    .gl-input {
      width: 100%; height: 52px; padding: 0 16px 0 44px;
      font: 500 15.5px 'Inter', system-ui, sans-serif; color: var(--ink);
      background: #F7F8FA; border: 1px solid var(--line); border-radius: 12px;
      outline: none; transition: border-color .18s, box-shadow .18s, background .18s;
      -webkit-appearance: none; appearance: none;
    }
    .gl-input::placeholder { color: #9AA3B2; font-weight: 400; }
    .gl-input:hover { border-color: #C6CDD9; background: #fff; }
    .gl-input:focus { background: #fff; border-color: var(--navy); box-shadow: 0 0 0 4px rgba(201,162,75,.22), 0 1px 2px rgba(11,30,61,.06); }
    .gl-input.has-toggle { padding-right: 84px; }
    .gl-input[aria-invalid="true"] { border-color: var(--err); background: #FFFBFA; }
    .gl-input:-webkit-autofill { -webkit-box-shadow: 0 0 0 40px #fff inset; -webkit-text-fill-color: var(--ink); }

    .gl-toggle {
      position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
      height: 36px; padding: 0 11px; border: 0; border-radius: 8px; background: transparent;
      font: 600 12px 'Inter', system-ui, sans-serif; color: var(--navy2); cursor: pointer;
      display: inline-flex; align-items: center; gap: 6px; transition: background .15s;
    }
    .gl-toggle:hover { background: #EAEEF5; }
    .gl-toggle:focus-visible { outline: 2px solid var(--navy); outline-offset: 1px; }

    .gl-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 6px 0 24px; flex-wrap: wrap; }
    .gl-remember { display: inline-flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 500; color: var(--ink); cursor: pointer; user-select: none; }
    .gl-remember input { width: 17px; height: 17px; accent-color: var(--navy); cursor: pointer; margin: 0; }
    .gl-help { font-size: 12.5px; color: var(--muted); }

    .gl-error {
      display: flex; gap: 10px; align-items: flex-start;
      background: #FEF3F2; border: 1px solid #FECDCA; border-left: 3px solid var(--err); color: var(--err);
      font-size: 13px; line-height: 1.45; border-radius: 10px; padding: 11px 13px; margin-bottom: 16px;
    }
    .gl-error svg { flex-shrink: 0; margin-top: 1px; }

    .gl-btn {
      position: relative; overflow: hidden;
      width: 100%; height: 54px; border: 0; border-radius: 12px;
      background: linear-gradient(180deg, var(--navy3) 0%, var(--navy) 100%); color: #fff;
      font: 600 15.5px 'Inter', system-ui, sans-serif; letter-spacing: .3px;
      display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      cursor: pointer; transition: transform .18s, box-shadow .18s, filter .18s;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.14), inset 0 -3px 0 var(--gold), 0 10px 22px -8px rgba(11,30,61,.55);
    }
    .gl-btn::after {               /* brass sheen sweep on hover */
      content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%;
      background: linear-gradient(90deg, transparent, rgba(232,207,142,.35), transparent);
      transform: translateX(-120%) skewX(-18deg); pointer-events: none;
    }
    .gl-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), inset 0 -3px 0 var(--goldL), 0 16px 28px -10px rgba(11,30,61,.6); }
    .gl-btn:hover:not(:disabled)::after { animation: gl-sheen .9s ease; }
    .gl-btn:active:not(:disabled) { transform: translateY(0); }
    .gl-btn:focus-visible { outline: 3px solid rgba(201,162,75,.6); outline-offset: 3px; }
    .gl-btn:disabled { opacity: .75; cursor: default; }
    .gl-btn-arrow { transition: transform .18s; }
    .gl-btn:hover:not(:disabled) .gl-btn-arrow { transform: translateX(3px); }
    .gl-spinner { width: 17px; height: 17px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: gl-spin .7s linear infinite; }

    .gl-card-foot { margin-top: 24px; padding-top: 18px; border-top: 1px solid #EEF0F4; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 500; color: var(--muted); }
    .gl-card-foot svg { color: var(--goldD); }

    .gl-legal { text-align: center; font-size: 12px; color: #8A93A3; margin-top: 20px; letter-spacing: .02em; }

    @media (max-width: 900px) {
      .gl-page { grid-template-columns: 1fr; }
      .gl-brand { display: none; }
      .gl-main { align-items: flex-start; padding: 32px 16px 24px; }
      .gl-mobile-brand { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 22px; }
      .gl-crest-img { width: 92px; height: auto; margin-bottom: 12px; filter: drop-shadow(0 8px 14px rgba(11,30,61,.2)); }
      .gl-card-crest { display: none; }
      .gl-mobile-name { font-family: 'Source Serif 4', Georgia, serif; font-weight: 700; font-size: 19px; color: var(--navy); }
      .gl-mobile-sub { font-size: 11px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--goldD); margin-top: 4px; }
      .gl-card { padding: 32px 22px 24px; border-radius: 18px; }
      .gl-title { font-size: 30px; }
    }

    /* ═════════ Design B — "Midnight Glass" (enable with ?design=b, reset with ?design=a) ═════════ */
    .gl-b { grid-template-columns: 1fr; background: #06142C; }
    .gl-b .gl-brand { display: block; position: fixed; inset: 0; padding: 0; z-index: 0; background: #06142C; }
    .gl-b .gl-brand::before {
      inset: 0; border: 0; border-radius: 0; box-shadow: none; z-index: 2;
      background:
        radial-gradient(70% 60% at 50% 38%, rgba(6,20,44,.15), rgba(6,20,44,.82) 100%),
        linear-gradient(180deg, rgba(6,20,44,.55), rgba(6,20,44,.85));
    }
    .gl-b .gl-brand::after { display: none; }
    .gl-b .gl-poster {
      position: absolute; inset: 0; width: 100%; height: 100%; max-height: none; max-width: none;
      object-fit: cover; border-radius: 0; animation: none;
      filter: blur(30px) saturate(1.2) brightness(.7); transform: scale(1.18);
    }
    .gl-b .gl-main { z-index: 1; background: none; }
    .gl-b .gl-main::before { display: none; }

    .gl-b .gl-card {
      text-align: center;
      background: linear-gradient(155deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.05) 100%);
      border: 1px solid rgba(232,207,142,.32);
      -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5);
      box-shadow: 0 1px 0 rgba(255,255,255,.22) inset, 0 30px 70px -20px rgba(0,0,0,.65), 0 0 0 1px rgba(6,20,44,.4);
    }
    .gl-b .gl-card::before { height: 3px; background: linear-gradient(90deg, transparent, var(--goldL), var(--gold), var(--goldL), transparent); }
    .gl-b .gl-card::after { background: radial-gradient(circle, rgba(232,207,142,.22), transparent 70%); }
    .gl-b .gl-card-crest, .gl-b .gl-crest-img {
      background: radial-gradient(circle at 35% 30%, #fff, #EEF1F7); border-radius: 50%; padding: 12px;
      box-shadow: 0 0 0 2px rgba(232,207,142,.9), 0 0 0 6px rgba(232,207,142,.18), 0 12px 26px -6px rgba(0,0,0,.55);
    }
    .gl-b .gl-card-crest { margin: 0 auto 20px; width: 88px; height: 88px; object-fit: contain; filter: none; }
    .gl-b .gl-eyebrow { justify-content: center; color: var(--goldL); }
    .gl-b .gl-eyebrow::before { content: ''; flex: 0 0 36px; height: 1px; background: linear-gradient(270deg, var(--gold), transparent); }
    .gl-b .gl-title { color: #fff; }
    .gl-b .gl-sub { color: rgba(255,255,255,.72); }
    .gl-b .gl-field, .gl-b .gl-row { text-align: left; }
    .gl-b .gl-label { color: rgba(255,255,255,.82); }
    .gl-b .gl-ico { color: rgba(255,255,255,.5); }
    .gl-b .gl-input-wrap:focus-within .gl-ico { color: var(--goldL); }
    .gl-b .gl-input { color: #fff; background: rgba(6,20,44,.45); border-color: rgba(255,255,255,.2); }
    .gl-b .gl-input::placeholder { color: rgba(255,255,255,.4); }
    .gl-b .gl-input:hover { background: rgba(6,20,44,.6); border-color: rgba(255,255,255,.35); }
    .gl-b .gl-input:focus { background: rgba(6,20,44,.7); border-color: var(--goldL); box-shadow: 0 0 0 4px rgba(232,207,142,.22); }
    .gl-b .gl-input[aria-invalid="true"] { border-color: #F97066; background: rgba(120,20,15,.25); }
    .gl-b .gl-input:-webkit-autofill { -webkit-box-shadow: 0 0 0 40px #0c2247 inset; -webkit-text-fill-color: #fff; caret-color: #fff; }
    .gl-b .gl-toggle { color: var(--goldL); }
    .gl-b .gl-toggle:hover { background: rgba(255,255,255,.1); }
    .gl-b .gl-remember { color: rgba(255,255,255,.88); }
    .gl-b .gl-remember input { accent-color: var(--gold); }
    .gl-b .gl-help { color: rgba(255,255,255,.6); }
    .gl-b .gl-error { background: rgba(180,35,24,.22); border-color: rgba(249,112,102,.5); border-left-color: #F97066; color: #FFD5D1; text-align: left; }
    .gl-b .gl-btn {
      background: linear-gradient(180deg, #F2DC96 0%, #D8B35A 55%, #C09333 100%); color: #0B1E3D;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 0 rgba(120,85,10,.35), 0 14px 30px -10px rgba(201,162,75,.6);
    }
    .gl-b .gl-btn::after { background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); }
    .gl-b .gl-btn:hover:not(:disabled) { filter: brightness(1.05); box-shadow: inset 0 1px 0 rgba(255,255,255,.65), inset 0 -2px 0 rgba(120,85,10,.35), 0 20px 36px -12px rgba(232,207,142,.75); }
    .gl-b .gl-btn:focus-visible { outline-color: rgba(255,255,255,.7); }
    .gl-b .gl-spinner { border-color: rgba(11,30,61,.25); border-top-color: #0B1E3D; }
    .gl-b .gl-card-foot { border-top-color: rgba(255,255,255,.14); color: rgba(255,255,255,.62); }
    .gl-b .gl-card-foot svg { color: var(--goldL); }
    .gl-b .gl-legal { color: rgba(255,255,255,.5); }
    .gl-b .gl-mobile-name { color: #fff; }
    .gl-b .gl-mobile-sub { color: var(--goldL); }
    @media (max-width: 900px) {
      .gl-b .gl-card-crest { display: none; }
      .gl-b .gl-crest-img { width: 100px; height: 100px; object-fit: contain; margin-bottom: 14px; filter: none; }
      .gl-b .gl-main { padding-top: 40px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .gl-card, .gl-card *, .gl-poster, .gl-card::after { animation: none !important; transition: none !important; }
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

// Design preview switch: ?design=b shows "Midnight Glass", ?design=a the
// original. The choice is remembered on this device so it can be tried on a
// phone. Remove once one design is chosen.
const readDesign = () => {
  try {
    const q = new URLSearchParams(window.location.search).get('design')
    if (q === 'a' || q === 'b') { localStorage.setItem('gnsi_login_design', q); return q }
    return localStorage.getItem('gnsi_login_design') === 'b' ? 'b' : 'a'
  } catch { return 'a' }
}

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
  const [design] = useState(readDesign)

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

  return (
    <div className={`gl-page${design === 'b' ? ' gl-b' : ''}`}>
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
        <div className="gl-wrap">
          <div className="gl-mobile-brand">
            <img className="gl-crest-img" src={gnsiCrest} alt="GNSI crest" />
            <div className="gl-mobile-name">{instName}</div>
            <div className="gl-mobile-sub">GNSI ERP · Staff Portal</div>
          </div>

          <form
            ref={cardRef}
            className={`gl-card${shakeCard ? ' shake' : ''}`}
            onSubmit={handleLogin}
            noValidate
          >
            <img className="gl-card-crest" src={gnsiCrest} alt="" aria-hidden="true" />
            <div className="gl-eyebrow">Staff Portal</div>
            <h1 className="gl-title">Sign in</h1>
            <p className="gl-sub">Use your GNSI staff account to continue.</p>

            <div className="gl-field">
              <label className="gl-label" htmlFor="gl-username">Username</label>
              <div className="gl-input-wrap">
                <span className="gl-ico"><UserIcon /></span>
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
            </div>

            <div className="gl-field">
              <label className="gl-label" htmlFor="gl-password">Password</label>
              <div className="gl-input-wrap">
                <span className="gl-ico"><LockIcon /></span>
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
              {loading ? <><span className="gl-spinner" aria-hidden="true" /> Signing in…</> : <>Sign in <ArrowIcon /></>}
            </button>

            <div className="gl-card-foot">
              <ShieldIcon /> For authorised GNSI staff only.
            </div>
          </form>

          <p className="gl-legal">© {year} {instName}</p>
        </div>
      </main>
    </div>
  )
}