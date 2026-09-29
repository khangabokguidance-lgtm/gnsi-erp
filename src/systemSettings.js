// systemSettings.js — the values an admin saves in System Settings, shared
// with the whole portal.
//
// SystemSettings.jsx writes key/value rows to the `system_settings` table.
// This module reads the ones the rest of the app uses (never the API
// secrets), keeps them in memory and in localStorage (so the login screen and
// public pages have them even before a staff session exists), and tells every
// subscriber when they change — saving in System Settings applies at once,
// no reload needed.
//
// Every getter falls back to the value the portal used before this existed,
// so nothing changes until an admin actually saves a setting.
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// Keys safe to hold in the browser. Secrets (sms_api_key, whatsapp_token,
// razorpay_secret, api_key_portal, smtp credentials) are deliberately absent.
export const PUBLIC_SETTING_KEYS = [
  // Basic info
  'school_name', 'school_address', 'school_phone', 'school_email', 'session_year',
  'institute_type', 'affiliation', 'principal_name', 'established_year',
  // Security
  'session_timeout_minutes', 'max_login_attempts', 'lockout_duration_minutes',
  // Appearance
  'primary_color', 'sidebar_color', 'accent_color', 'font_family', 'logo_url', 'favicon_url', 'portal_title',
  // Notifications (on/off only)
  'whatsapp_enabled', 'sms_alerts', 'email_alerts', 'whatsapp_alerts',
  // Academic
  'academic_year_start', 'academic_year_end', 'exam_grading', 'attendance_threshold', 'fee_due_day',
  'classes_list', 'courses_list',
  // Integrations (on/off + the public key id only)
  'razorpay_enabled', 'razorpay_key', 'google_enabled',
]

export const SETTINGS_EVENT = 'gnsi:system-settings'
const CACHE_KEY = 'gnsi_system_settings_v1'
const SAFE = new Set(PUBLIC_SETTING_KEYS)

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    return raw && typeof raw === 'object' ? pick(raw) : {}
  } catch { return {} }
}
function pick(map) {
  const out = {}
  for (const [k, v] of Object.entries(map || {})) if (SAFE.has(k) && v != null) out[k] = String(v)
  return out
}

let values = readCache()
const listeners = new Set()

function commit(next) {
  values = next
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(values)) } catch { /* private mode */ }
  applyBranding()
  listeners.forEach(fn => fn())
  try { window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: values })) } catch { /* no window */ }
}

// ── Reading ─────────────────────────────────────────────────────────────────
// Trimmed value, or '' when unset.
export function sysValue(key) {
  const v = values[key]
  return v == null ? '' : String(v).trim()
}
// Value, or `fallback` when the admin hasn't set one.
export const sysOr = (key, fallback) => sysValue(key) || fallback
export function sysNumber(key, fallback, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(sysValue(key))
  return sysValue(key) !== '' && Number.isFinite(n) && n >= min && n <= max ? n : fallback
}
// Toggles are saved as the strings "true" / "false"; unset → fallback.
export function sysFlag(key, fallback = false) {
  const v = sysValue(key)
  return v === '' ? fallback : v === 'true'
}
export function sysList(key, fallback) {
  try { const v = JSON.parse(sysValue(key)); return Array.isArray(v) && v.length ? v : fallback } catch { return fallback }
}
export const allSettings = () => values

// ── Derived, used across modules ────────────────────────────────────────────
export const DEFAULT_INSTITUTE = {
  name: 'Guidance Navodaya & Sainik Institute',
  short: 'GNSI',
  address: 'Khangabok, Thoubal, Manipur',
  phone: '+91 89742 98074',
  email: '',
  website: 'guidancekhangabok.in',
  established: '2016',
}

// Institute details for letterheads, receipts and contact links. `defaults`
// lets a module keep its own wording (e.g. a longer address) when unset.
export function getInstitute(defaults = {}) {
  const d = { ...DEFAULT_INSTITUTE, ...defaults }
  return {
    ...d,
    name: sysOr('school_name', d.name),
    address: sysOr('school_address', d.address),
    phone: sysOr('school_phone', d.phone),
    email: sysOr('school_email', d.email),
    principal: sysOr('principal_name', d.principal || ''),
    affiliation: sysOr('affiliation', d.affiliation || ''),
    established: sysOr('established_year', d.established),
    logoUrl: sysOr('logo_url', d.logoUrl || ''),
  }
}

// HTML-escaped name / address for printed letterheads.
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const instNameHTML = () => escHtml(getInstitute().name)
export const instAddressHTML = () => escHtml(getInstitute().address)

// Digits for tel: / wa.me links (adds India's 91 to a 10-digit number).
export function phoneDigits(phone = getInstitute().phone) {
  let d = String(phone || '').replace(/\D/g, '')
  if (d.length === 10) d = '91' + d
  if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1)
  return d
}

// Day of the month a monthly fee falls due (1–28). Default 10.
export const feeDueDay = () => sysNumber('fee_due_day', 10, { min: 1, max: 28 })
// "10th" etc. for messages.
export const ordinal = n => { const v = n % 100; return n + (v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th') }
// Pay-by date for a dues notice: the next fee due day at least 3 days away
// when an admin has set one, otherwise one week from today.
export function nextPayByDate(now = new Date()) {
  if (!sysValue('fee_due_day')) return new Date(now.getTime() + 7 * 86400000)
  const day = feeDueDay()
  const d = new Date(now.getFullYear(), now.getMonth(), day)
  const soon = new Date(now.getTime() + 3 * 86400000)
  while (d < soon) d.setMonth(d.getMonth() + 1)
  return d
}
// Minimum attendance % before a student is flagged. Default 75.
export const attendanceThreshold = () => sysNumber('attendance_threshold', 75, { min: 1, max: 100 })
// Current academic session label, e.g. "2026-2027" ('' when unset).
export const sessionYear = () => sysValue('session_year')

export function loginPolicy() {
  return {
    maxAttempts: sysNumber('max_login_attempts', 5, { min: 1, max: 50 }),
    lockoutMs: sysNumber('lockout_duration_minutes', 5, { min: 1, max: 1440 }) * 60 * 1000,
    // Idle logout; 0 = off (the 24-hour hard limit always applies).
    idleMs: sysNumber('session_timeout_minutes', 0, { min: 0, max: 1440 }) * 60 * 1000,
  }
}

// Online payment (Razorpay) — on unless an admin switched it off. The public
// key id from settings is used only when the build has none.
export const razorpayEnabled = () => sysFlag('razorpay_enabled', true)
export const razorpayKeyId = envKey => envKey || sysValue('razorpay_key')
// WhatsApp share buttons for receipts/reminders — on unless switched off.
export const whatsappEnabled = () => sysFlag('whatsapp_enabled', true) && sysFlag('whatsapp_alerts', true)

// ── Loading / saving ────────────────────────────────────────────────────────
let inflight = null
// Fetch the latest values. Staff read the table; without a staff session the
// public_system_settings() function (migration 20261001) returns the same
// non-secret keys. Never throws; keeps the cached values on failure.
export function loadSystemSettings() {
  if (inflight) return inflight
  inflight = (async () => {
    let map = null
    try {
      const { data, error } = await supabase.from('system_settings').select('key,value').in('key', PUBLIC_SETTING_KEYS)
      if (!error && data?.length) map = Object.fromEntries(data.map(r => [r.key, r.value]))
    } catch { /* fall through */ }
    if (!map) {
      try {
        const { data, error } = await supabase.rpc('public_system_settings')
        if (!error && Array.isArray(data)) map = Object.fromEntries(data.map(r => [r.key, r.value]))
      } catch { /* keep cache */ }
    }
    if (map) commit(pick(map))
    return values
  })().finally(() => { inflight = null })
  return inflight
}

// Called by System Settings after a successful save.
export function settingsSaved(map) {
  const changed = pick(map)
  if (Object.keys(changed).length) commit({ ...values, ...changed })
}

// ── React ───────────────────────────────────────────────────────────────────
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
const snapshot = () => values
// Re-renders the caller whenever any setting changes.
export function useSystemSettings() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

// ── Branding on the page itself ─────────────────────────────────────────────
// Favicon, font and CSS variables apply everywhere; the tab title is set by
// App for the staff portal only (public pages keep their own titles).
const FONT_STACK = f => `'${f}','Inter','Segoe UI',system-ui,sans-serif`
export function applyBranding() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const setVar = (name, v) => (v ? root.style.setProperty(name, v) : root.style.removeProperty(name))
  setVar('--gnsi-primary', sysValue('primary_color'))
  setVar('--gnsi-sidebar', sysValue('sidebar_color'))
  setVar('--gnsi-accent', sysValue('accent_color'))
  const font = sysValue('font_family')
  setVar('--gnsi-font', font ? FONT_STACK(font) : '')
  if (font && /^[A-Za-z ]{2,40}$/.test(font)) {
    const href = `https://fonts.googleapis.com/css2?family=${font.trim().replace(/ /g, '+')}:wght@400;500;600;700;800&display=swap`
    let link = document.getElementById('gnsi-sys-font')
    if (!link) {
      link = document.createElement('link')
      link.id = 'gnsi-sys-font'; link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
  }
  if (document.body) document.body.style.fontFamily = font ? FONT_STACK(font) : ''
  // Primary colour tints the phone browser's toolbar.
  const primary = sysValue('primary_color')
  let meta = document.querySelector('meta[name="theme-color"]')
  if (primary) {
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta) }
    meta.dataset.sys = '1'; meta.content = primary
  } else if (meta?.dataset.sys) meta.remove()
  const fav = sysValue('favicon_url')
  if (/^https:\/\//.test(fav)) {
    let link = document.getElementById('gnsi-sys-favicon')
    if (!link) {
      link = document.createElement('link')
      link.id = 'gnsi-sys-favicon'; link.rel = 'icon'
      document.head.appendChild(link)
    }
    if (link.href !== fav) link.href = fav
  } else document.getElementById('gnsi-sys-favicon')?.remove()
}

export const fontFamily = fallback => (sysValue('font_family') ? FONT_STACK(sysValue('font_family')) : fallback)

applyBranding()
