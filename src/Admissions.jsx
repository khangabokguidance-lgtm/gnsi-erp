// Admissions.jsx — GNSI Portal v2.0
// ─────────────────────────────────────────────────────────────────────────────
// 100-FEATURE COMPLETE REWRITE
// ─────────────────────────────────────────────────────────────────────────────
// FEATURES 1-12   · Data & Form Enhancements
// FEATURES 13-22  · Fee & Financial
// FEATURES 23-34  · Analytics & Dashboard
// FEATURES 35-44  · Export & Print
// FEATURES 45-52  · Communication
// FEATURES 53-62  · Bulk Operations
// FEATURES 63-70  · Search & Filter Upgrades
// FEATURES 71-78  · Card & Detail View
// FEATURES 79-86  · Hostel & House Management
// FEATURES 87-92  · Access Control & Audit
// FEATURES 93-100 · System & Quality of Life
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import FeeCollectionModal from './FeeCollectionModal'
import ReportGenerator from './ReportGenerator'
import { promoteToStudent, getFlatFeeAmtSync, checkHouseCapacity } from './feeEngine'
import { useActiveSession } from './shared/useActiveSession'
import { staffDB } from './staffDB'

// Pagination-safe fetch — Supabase/PostgREST caps a single .select() at
// 1000 rows. Both `admissions` and `adm_fee_collections` can cross that
// with 400+ students' worth of applications/payments, silently dropping
// the newest rows (new applications, latest fee collections) from this
// module — same bug already fixed in Fees.jsx/Students.jsx.
async function fetchAllRows(table, { select = '*', orderCol = null, ascending = true } = {}) {
  const PAGE = 1000
  let from = 0, all = []
  while (true) {
    let q = supabase.from(table).select(select)
    if (orderCol) q = q.order(orderCol, { ascending })
    q = q.range(from, from + PAGE - 1)
    const { data, error } = await q
    if (error) { console.error(`fetchAllRows(${table}) error:`, error.message); break }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

// ═════════════════════════════════════════════════════════════════════════════
// SECURITY LAYER — Validation · Authorization · Rate Limiting · Sanitization
// ═════════════════════════════════════════════════════════════════════════════

// ─── Role-Based Permissions ─────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  admin:             ['create','read','update','delete','bulk','export','wa','viewContacts'],
  admission_officer: ['create','read','update','export','wa','viewContacts'],
  reception:         ['create','read'],
  staff:             ['read'],
}

function checkPermission(role, action) {
  return (ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff).includes(action)
}

// Staff listed here are elevated to the role on the right — verified against
// a real, ACTIVE staffDB record (by id first, falling back to name), not
// just trusted from whatever's in localStorage — regardless of their stored
// session role. Keys are lowercase full names as they appear in
// staff_profiles.name. 'admission_officer' grants create/read/update/export/
// wa/viewContacts but NOT delete/bulk (still admin-only). Add more entries
// here as needed.
const NAMED_ROLE_OVERRIDES = {
  'ningthoujam johnson singh': 'admission_officer',
}

// Reads identity from the existing gnsi_session localStorage entry (set by
// login) so this integrates with the portal's existing custom-auth system
// without requiring a separate auth context.
function getSessionInfo() {
  try {
    const raw = localStorage.getItem('gnsi_session')
    if (raw) {
      const parsed = JSON.parse(raw)
      const role = parsed?.role || parsed?.user?.role || 'staff'
      const userId = parsed?.id || parsed?.user_id || parsed?.user?.id || null
      const userName = parsed?.name || parsed?.username || parsed?.user?.name || role
      return { role, userId, userName }
    }
  } catch (_) { /* default to least-privilege */ }
  return { role: 'staff', userId: null, userName: 'staff' }
}

function useUserRole() {
  const [role, setRole] = useState('staff')
  useEffect(() => {
    let cancelled = false
    const { role: sessionRole, userId, userName } = getSessionInfo()
    setRole(sessionRole) // set immediately — don't stay stuck on 'staff' while the staffDB check below resolves

    const nameKey = (userName || '').trim().toLowerCase()
    // Nothing to check unless there's an id to look up, or the session name
    // is even on the override list — skip the staffDB round-trip otherwise.
    if (!userId && !NAMED_ROLE_OVERRIDES[nameKey]) return

    ;(async () => {
      try {
        // Prefer resolving by id (in case the session's userId lines up with
        // the staff_profiles id) — more trustworthy than trusting whatever
        // display name happens to be sitting in localStorage.
        let staff = userId ? await staffDB.getById(userId) : null
        if (!staff && nameKey) staff = await staffDB.getByName(nameKey)
        if (cancelled || !staff) return

        const staffNameKey  = (staff.name || '').trim().toLowerCase()
        const overrideRole  = NAMED_ROLE_OVERRIDES[staffNameKey]
        const isActive      = !staff.status || staff.status === 'Active'
        if (overrideRole && isActive) setRole(overrideRole)
      } catch (err) {
        console.error('useUserRole: staffDB override lookup failed:', err.message)
      }
    })()

    return () => { cancelled = true }
  }, [])
  return role
}

// ─── Input Validation ────────────────────────────────────────────────────────
const ValidationRules = {
  phone: { test: v => !v || /^[0-9]{10}$/.test(String(v).replace(/\D/g,'')), msg: 'Phone must be 10 digits' },
  gcc:   { test: v => !v || /^[0-9]{1,10}$/.test(String(v).trim()),          msg: 'GCC No. must be numeric' },
  name:  { test: v => v && v.trim().length >= 2 && v.trim().length <= 100,   msg: 'Name must be 2–100 characters' },
}

function validateApplicationData(obj) {
  const errors = {}
  if (!ValidationRules.name.test(obj.name))               errors.name = ValidationRules.name.msg
  if (!ValidationRules.gcc.test(obj.gcc))                 errors.gcc = ValidationRules.gcc.msg
  if (obj.phone     && !ValidationRules.phone.test(obj.phone))     errors.phone = ValidationRules.phone.msg
  if (obj.whatsapp  && !ValidationRules.phone.test(obj.whatsapp))  errors.whatsapp = ValidationRules.phone.msg
  if (obj.emergencyPhone && !ValidationRules.phone.test(obj.emergencyPhone)) errors.emergencyPhone = ValidationRules.phone.msg
  return Object.keys(errors).length ? errors : null
}

// ─── Sanitization (defense-in-depth against stored XSS) ─────────────────────
function sanitizeStr(v) {
  if (typeof v !== 'string') return v
  return v.trim().replace(/[<>]/g, '').slice(0, 500)
}

function sanitizeApplicationData(obj) {
  const safe = { ...obj }
  ;['name','father','mother','address','remarks','prevSchool','emergencyName','emergencyRel','disabilityNotes'].forEach(k => {
    if (safe[k] != null) safe[k] = sanitizeStr(safe[k])
  })
  return safe
}

// ─── Rate Limiter (client-side guard against bulk-action abuse) ────────────
class RateLimiter {
  static _hits = {}
  static check(key, limit = 5, windowMs = 60000) {
    const now = Date.now()
    const hits = (this._hits[key] || []).filter(t => now - t < windowMs)
    if (hits.length >= limit) {
      const waitSec = Math.ceil((hits[0] + windowMs - now) / 1000)
      throw new Error(`Too many bulk actions — wait ${waitSec}s and try again`)
    }
    hits.push(now)
    this._hits[key] = hits
    return true
  }
}

const MAX_BULK_OPERATION_SIZE = 100

// ─── Audit Logging (best-effort; never blocks the primary action) ──────────
// Writes into the portal's EXISTING shared audit_logs table
// (columns: id uuid, user_id uuid, user_name text, action text, module text,
//  level text, metadata jsonb, created_at timestamptz) — no schema changes
// needed, and no risk of colliding with other modules that already use it.
async function logAudit(action, recordId, details, role) {
  try {
    const { userId, userName } = getSessionInfo()
    await supabase.from('audit_logs').insert([{
      user_id: userId,                 // null if portal_users id isn't a uuid — safe, column is nullable
      user_name: userName || role,
      action: `admissions.${action}`,  // e.g. 'admissions.CREATE', 'admissions.BULK_DELETE'
      module: 'admissions',
      level: action.includes('DELETE') ? 'warning' : 'info',
      metadata: { recordId, role, ...details },
    }])
  } catch (_) {
    // Never block the user's action if logging fails for any reason.
  }
}

function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

function useMobile() { return useWindowWidth() < 768 }

// 🔗 Live housemaster lookup — reads the same `housemasters` table that
// Hostel.jsx's HousemasterTab manages (columns: name, house, phone, email,
// designation, status). Filters to status:'Active' and keys by house name,
// mirroring exactly how Hostel.jsx's notifyHousemasterByHouse() already
// resolves "who is the current housemaster of house X" — so both modules
// agree on the same answer instead of Admissions showing stale fake data.
function useActiveHousemasters() {
  const [byHouse, setByHouse] = useState({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('housemasters')
        .select('name, house, phone, email, designation')
        .eq('status', 'Active')
      if (cancelled) return
      if (error) { console.error('useActiveHousemasters fetch error:', error); setLoading(false); return }
      const map = {}
      ;(data || []).forEach(hm => {
        const key = (hm.house || '').trim()
        if (key) map[key] = hm   // one active housemaster per house, matching Hostel.jsx's .maybeSingle() assumption
      })
      setByHouse(map)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])
  return { housemastersByHouse: byHouse, housemastersLoading: loading }
}
function useTablet() { return useWindowWidth() < 1024 }

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  navy:    { 50:'#EEF2FF',100:'#C7D2FE',300:'#818CF8',500:'#3730A3',700:'#1E1B4B',900:'#0F0D26' },
  indigo:  { 50:'#EEF2FF',100:'#C7D2FE',400:'#6366F1',500:'#4F46E5',600:'#4338CA',700:'#3730A3' },
  emerald: { 50:'#ECFDF5',100:'#D1FAE5',300:'#6EE7B7',500:'#10B981',600:'#059669',700:'#047857' },
  amber:   { 50:'#FFFBEB',100:'#FEF3C7',300:'#FCD34D',500:'#F59E0B',600:'#D97706',700:'#B45309' },
  violet:  { 50:'#F5F3FF',100:'#EDE9FE',400:'#A78BFA',500:'#8B5CF6',600:'#7C3AED',700:'#6D28D9' },
  rose:    { 50:'#FFF1F2',100:'#FFE4E6',200:'#FECDD3',500:'#F43F5E',600:'#E11D48',700:'#BE123C' },
  slate:   { 50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A' },
  sky:     { 50:'#F0F9FF',100:'#E0F2FE',400:'#38BDF8',500:'#0EA5E9',600:'#0284C7',700:'#0369A1' },
  teal:    { 50:'#F0FDFA',100:'#CCFBF1',400:'#2DD4BF',500:'#14B8A6',600:'#0D9488',700:'#0F766E' },
  orange:  { 50:'#FFF7ED',100:'#FFEDD5',400:'#FB923C',500:'#F97316',600:'#EA580C',700:'#C2410C' },
}

// ─── Page background (kept separate from N.bg so cards read as white
// surfaces sitting on a light page, instead of blending into it) ───────────
const PAGE_BG = '#FBFBFD'

// ─── Design System — flat, Accounts-style banking UI ───────────────────────
// (Same visual language as AccountsDashboardBanking: white cards, hairline
// borders simulated via box-shadow, navy/gold accents, soft elevation
// instead of dual-direction neumorphic shadows.)
const N = {
  bg:       '#FFFFFF',   // card surface (was page-matching neumorphic bg)
  bg2:      '#F5F5F7',   // secondary surface / hover tint
  bg3:      '#E5E5EA',   // tertiary surface / divider tint
  surface:  '#FFFFFF',
  shLight:  'rgba(255,255,255,1)',
  shDark:   'rgba(0,0,0,0.08)',
  text:     '#1D1D1F',
  text2:    '#3A3A3C',
  muted:    '#86868B',
  muted2:   '#6E6E73',
  navy:     '#1D1D1F',
  navyLight:'#3A3A3C',
  gold:     '#D4AF6A',
  goldDark: '#B8915A',
  indigo:   '#4f46e5',
  violet:   '#7c3aed',
  emerald:  '#0A8042',
  amber:    '#d97706',
  rose:     '#D70015',
  sky:      '#0284c7',
  border:   'rgba(0,0,0,0.07)',
  // Soft flat elevation + hairline border baked into one box-shadow string,
  // so every component that already does `boxShadow:N.shadow('md')`
  // automatically gets a clean bordered card with zero code changes.
  shadow:   (size='md') => {
    const m = {
      sm: '0 0 0 1px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
      md: '0 0 0 1px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04), 0 8px 20px rgba(0,0,0,.06)',
      lg: '0 0 0 1px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.05), 0 16px 36px rgba(0,0,0,.10)',
    }
    return m[size] || m.md
  },
  // "Active / selected / pressed" state — a colored ring instead of an
  // inverted neumorphic dent. Reads clearly as "selected" on a flat card.
  inset:    (size='md') => {
    const m = {
      sm: '0 0 0 1.5px rgba(29,29,31,.18), inset 0 0 0 1px rgba(0,0,0,.03)',
      md: '0 0 0 2px rgba(29,29,31,.18), inset 0 0 0 1px rgba(0,0,0,.03)',
      lg: '0 0 0 2.5px rgba(29,29,31,.20), inset 0 0 0 1px rgba(0,0,0,.03)',
    }
    return m[size] || m.md
  },
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ADM_STATUSES = ['Applied','Under Review','Admitted','Enrolled','Rejected','Waitlisted']
const STAT_META = {
  'Applied':      { color:T.indigo[600], bg:T.indigo[50],  icon:'◎' },
  'Under Review': { color:T.amber[600],  bg:T.amber[50],   icon:'◐' },
  'Admitted':     { color:T.violet[600], bg:T.violet[50],  icon:'◈' },
  'Enrolled':     { color:T.emerald[600],bg:T.emerald[50], icon:'◉' },
  'Rejected':     { color:T.rose[600],   bg:T.rose[50],    icon:'◌' },
  'Waitlisted':   { color:T.slate[500],  bg:T.slate[100],  icon:'◷' },
}
const ADM_DOCS = ['Birth Certificate','Aadhaar Card','Passport Photo','Mark Sheet','Transfer Certificate','Medical Certificate','Caste Certificate','Address Proof']
const CATEGORIES = ['--','General','OBC','SC','ST','EWS','Other']
const RELIGIONS = ['--','Hindu','Muslim','Christian','Meitei Sanamahism','Buddhist','Other']
const MOTHER_TONGUES = ['--','Meitei','Bengali','Nepali','Hindi','Tangkul','Thadou','Other']
const QUOTA_TYPES = ['--','Open','Sports','Defence Ward','Staff Ward','NRI','Other']
const REFERRAL_SOURCES = ['--','Social Media','Newspaper Ad','Alumni','Walk-in','Teacher Referral','Parent Referral','Other']
const COURSE_STRUCTURE = {
  Navodaya:          { subtypes:['Lakshya','Umeed'],              color:T.indigo[600], bg:T.indigo[50]  },
  Sainik:            { subtypes:['Achiever','Leader','Champion'],  color:T.emerald[600],bg:T.emerald[50] },
  Foundation:        { subtypes:['Elite','Prime'],                 color:T.violet[600], bg:T.violet[50]  },
  'Combined Course': { subtypes:[],                               color:T.amber[600],  bg:T.amber[50]   },
}
const CLASSES_LIST = ['Achiever','Leader','Champion','Lakshya','Umeed','Elite','Prime','Class 6','Class 7','Class 8','Class 9','Class 10']
const HOSTEL_TYPES = ['Day Scholar','Boarder','Day Boarder']
const HOSTEL_STYLES = {
  'Boarder':     { bg:T.emerald[50], color:T.emerald[700], border:T.emerald[300], icon:'🏠' },
  'Day Boarder': { bg:T.amber[50],   color:T.amber[700],   border:T.amber[300],   icon:'🌅' },
  'Day Scholar': { bg:T.slate[100],  color:T.slate[500],   border:T.slate[200],   icon:'🏫' },
}
const HOUSES_LIST        = ['Kombirei','Shiroi','Loktak','Singgarei','Koubru','Kangla','Sangai','Takhelei','Block-B','Day Scholar']
const DAY_SCHOLAR_HOUSES = ['Day Scholar']
const HOUSE_CAPACITIES = {
  'Kombirei':40,'Shiroi':40,'Loktak':40,'Singgarei':40,'Koubru':40,
  'Kangla':40,'Sangai':40,'Takhelei':40,'Block-B':30,'Day Scholar':999,
}
// 🔗 WARDEN_CONTACTS hardcoded object removed — warden/housemaster info now
// comes from the real `housemasters` table (the same one Hostel.jsx's
// HousemasterTab manages) via the useActiveHousemasters() hook below.
// This closes the same kind of drift gap as the house-capacity fix: before,
// this list was fake placeholder data that could never reflect a real
// staffing change made in Hostel.jsx.

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = n => Number(n||0).toLocaleString('en-IN')
const avatarColor = name => {
  const hues = [T.indigo[600],T.violet[600],T.emerald[600],T.amber[600],T.sky[500],T.rose[500],T.teal[500]]
  return hues[(name||'').charCodeAt(0) % hues.length]
}
const now = () => new Date().toISOString()
const dateFmt = iso => iso ? new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const timeFmt = iso => iso ? new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'

function deriveHostelType(house, hostelType) {
  if (house && DAY_SCHOLAR_HOUSES.includes(house)) return 'Day Scholar'
  if (HOSTEL_TYPES.includes(hostelType)) return hostelType
  return 'Day Scholar'
}

const DRAFT_KEY = 'gnsi_adm_draft'

// ─── CSV / Export Helpers ──────────────────────────────────────────────────────
function toCSV(rows) {
  const headers = ['GCC No','Adm No','Name','DOB','Gender','Blood','Category','Religion','Mother Tongue','Course','Subtype','Class','House','Hostel Type','Session','Status','Father','Mother','Phone','WhatsApp','Prev School','Address','Quota','Referral','Scholarship %','Entrance Score','Interview Score','Remarks']
  const escape = v => `"${String(v||'').replace(/"/g,'""')}"`
  const lines = [headers.map(escape).join(',')]
  rows.forEach(a => lines.push([
    a.gcc,a.admNo,a.name,a.dob,a.gender,a.blood,a.category,a.religion,a.motherTongue,
    a.course,a.subtype,a.cls,a.house,a.hostel_type,a.session,a.status,
    a.father,a.mother,a.phone,a.whatsapp,a.prevSchool,a.address,
    a.quota,a.referral,a.scholarshipPct,a.entranceScore,a.interviewScore,a.remarks,
  ].map(escape).join(',')))
  return lines.join('\n')
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type:'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function buildWAMsg(a, template='admission') {
  const templates = {
    admission: `Dear Parent of *${a.name}*,\n\nWe are pleased to inform you that your ward has been *Admitted* to GNSI for session *${a.session||''}*.\n\nGCC No: *${a.gcc}*\nAdm No: *${a.admNo||'Pending'}*\nCourse: *${a.course||''}${a.subtype?' – '+a.subtype:''}*\nHouse: *${a.house||'TBD'}*\nHostel Type: *${a.hostel_type}*\n\nPlease report to the office at the earliest to complete formalities.\n\n– GNSI, Khangabok`,
    interview: `Dear Parent of *${a.name}* (GCC: ${a.gcc}),\n\nKindly note that the *Interview / Entrance Test* for your ward has been scheduled.\n\nPlease bring all original documents and report to GNSI campus by 8:00 AM on the scheduled date.\n\n– GNSI, Khangabok`,
    fee_due: `Dear Parent of *${a.name}* (GCC: ${a.gcc}),\n\nThis is a gentle reminder that the *admission fee* for your ward is still pending.\n\nPlease visit the accounts office at the earliest to avoid cancellation of the seat.\n\n– GNSI, Khangabok`,
  }
  return templates[template] || templates.admission
}

// ─── Field Mappers ─────────────────────────────────────────────────────────────
function mapToDB(app) {
  const hostelType = deriveHostelType(app.house, app.hostel_type)
  return {
    gcc_no:          app.gcc ? parseInt(app.gcc) : undefined,
    applicant_name:  app.name        || '',
    dob:             app.dob         || null,
    gender:          app.gender      || null,
    blood_group:     app.blood       || null,
    category:        (!app.category||app.category==='--') ? null : app.category,
    religion:        (!app.religion||app.religion==='--') ? null : app.religion,
    mother_tongue:   (!app.motherTongue||app.motherTongue==='--') ? null : app.motherTongue,
    quota_type:      (!app.quota||app.quota==='--') ? null : app.quota,
    referral_source: (!app.referral||app.referral==='--') ? null : app.referral,
    disability_flag: app.disabilityFlag || false,
    disability_notes:app.disabilityNotes|| null,
    scholarship_pct: app.scholarshipPct ? parseFloat(app.scholarshipPct) : null,
    concession_amt:  app.concessionAmt  ? parseFloat(app.concessionAmt)  : null,
    security_deposit:app.securityDeposit? parseFloat(app.securityDeposit): null,
    transport_fee:   app.transportFee   ? parseFloat(app.transportFee)   : null,
    entrance_score:  app.entranceScore  ? parseFloat(app.entranceScore)  : null,
    interview_score: app.interviewScore ? parseFloat(app.interviewScore) : null,
    interview_date:  app.interviewDate  || null,
    followup_date:   app.followupDate   || null,
    bed_number:      app.bedNumber      || null,
    emergency_contact_name: app.emergencyName  || null,
    emergency_contact_phone:app.emergencyPhone || null,
    emergency_contact_rel:  app.emergencyRel   || null,
    sibling_gcc:     app.siblingGcc    ? parseInt(app.siblingGcc) : null,
    course:          app.course        || null,
    subtype:         app.subtype       || null,
    batch:           app.cls           || null,
    house:           app.house         || null,
    session:         app.session       || null,
    hostel_type:     hostelType,
    status:          app.status        || 'Applied',
    father_name:     app.father        || null,
    mother_name:     app.mother        || null,
    phone:           app.phone         || null,
    whatsapp:        app.whatsapp      || null,
    prev_school:     app.prevSchool    || null,
    address:         app.address       || null,
    remarks:         app.remarks       || null,
    photo_url:       app.photoUrl      || null,
    instalment_plan: app.instalmentPlan|| 'monthly',
  }
}

function mapFromDB(row) {
  return {
    id:               row.gcc_no,
    gcc:              String(row.gcc_no),
    admNo:            row.adm_no,
    name:             row.applicant_name,
    dob:              row.dob,
    gender:           row.gender,
    blood:            row.blood_group,
    category:         row.category       || '--',
    religion:         row.religion       || '--',
    motherTongue:     row.mother_tongue  || '--',
    quota:            row.quota_type     || '--',
    referral:         row.referral_source|| '--',
    disabilityFlag:   row.disability_flag|| false,
    disabilityNotes:  row.disability_notes||'',
    scholarshipPct:   row.scholarship_pct||'',
    concessionAmt:    row.concession_amt  ||'',
    securityDeposit:  row.security_deposit||'',
    transportFee:     row.transport_fee   ||'',
    entranceScore:    row.entrance_score  ||'',
    interviewScore:   row.interview_score ||'',
    interviewDate:    row.interview_date  ||'',
    followupDate:     row.followup_date   ||'',
    bedNumber:        row.bed_number      ||'',
    emergencyName:    row.emergency_contact_name ||'',
    emergencyPhone:   row.emergency_contact_phone||'',
    emergencyRel:     row.emergency_contact_rel  ||'',
    siblingGcc:       row.sibling_gcc ? String(row.sibling_gcc) : '',
    course:           row.course,
    subtype:          row.subtype,
    cls:              row.batch,
    house:            row.house,
    session:          row.session,
    hostel_type:      row.hostel_type      || 'Day Scholar',
    status:           row.status,
    father:           row.father_name,
    mother:           row.mother_name,
    phone:            row.phone,
    whatsapp:         row.whatsapp,
    prevSchool:       row.prev_school,
    address:          row.address,
    remarks:          row.remarks,
    photoUrl:         row.photo_url        || '',
    instalmentPlan:   row.instalment_plan  || 'monthly',
    docs:             [],
    created_at:       row.created_at,
    updated_at:       row.updated_at,
    notes:            [],
    auditLog:         [],
    houseLog:         [],
  }
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────
const sbApps = {
  fetch: async () => {
    const data = await fetchAllRows('admissions', { orderCol: 'gcc_no', ascending: false })
    return data.map(mapFromDB)
  },
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  inp: {
    width:'100%', padding:'10px 14px', borderRadius:10,
    border:`1px solid ${N.border}`, fontSize:13,
    outline:'none', boxSizing:'border-box',
    backgroundColor:'#FFFFFF',
    color:N.text, fontFamily:'system-ui,sans-serif',
    boxShadow:'none',
    transition:'box-shadow .15s, border-color .15s',
  },
  label: {
    display:'block', fontSize:10, fontWeight:700, color:N.muted,
    marginBottom:5, textTransform:'uppercase', letterSpacing:'.09em',
  },
}

// ─── Keyboard Shortcuts Hook ───────────────────────────────────────────────────
function useKeyboardShortcuts({ onNew, onSearch, onEscape, onToggleView, onToggleDark }) {
  useEffect(() => {
    const handler = e => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      const inInput = ['input','textarea','select'].includes(tag)
      if (e.key === 'Escape') { onEscape?.(); return }
      if (inInput) return
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); onNew?.() }
      if (e.key === '/')                  { e.preventDefault(); onSearch?.() }
      if (e.key === 'v' || e.key === 'V') { e.preventDefault(); onToggleView?.() }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); onToggleDark?.() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNew, onSearch, onEscape, onToggleView, onToggleDark])
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────
function Avatar({ name, size=36, photoUrl }) {
  const bg = avatarColor(name)
  if (photoUrl) return (
    <img src={photoUrl} alt={name}
      style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:`2px solid ${T.slate[200]}` }} />
  )
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:700, color:'#fff', flexShrink:0 }}>
      {(name||'?').charAt(0).toUpperCase()}
    </div>
  )
}

function StatusBadge({ status }) {
  const m = STAT_META[status] || { color:T.slate[500], bg:T.slate[100], icon:'◌' }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:700, background:m.bg, color:m.color, border:`1px solid ${m.color}30`, whiteSpace:'nowrap' }}>
      <span style={{ fontSize:9 }}>{m.icon}</span>{status}
    </span>
  )
}

function HostelTypeBadge({ type }) {
  const s = HOSTEL_STYLES[type] || HOSTEL_STYLES['Day Scholar']
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:4, background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:'nowrap' }}>
      {s.icon} {type}
    </span>
  )
}

function KpiCard({ label, value, accent, onClick, active, subtitle }) {
  return (
    <div onClick={onClick} style={{ flex:1, minWidth:80, padding:'13px 14px', borderRadius:16, background:N.bg, boxShadow:active?N.inset('md'):N.shadow('md'), cursor:'pointer', transition:'all .2s' }}>
      <div style={{ fontSize:22, fontWeight:900, color:active?(accent||N.indigo):N.text, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:9, fontWeight:700, color:active?(accent||N.indigo):N.muted, marginTop:4, textTransform:'uppercase', letterSpacing:'.1em' }}>{label}</div>
      {subtitle && <div style={{ fontSize:10, color:N.muted2, marginTop:2 }}>{subtitle}</div>}
    </div>
  )
}

function Toast({ msg, color='#4F46E5', onUndo }) {
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:999999, background:'#fff', border:`1px solid ${T.slate[200]}`, borderLeft:`3px solid ${color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.12)', maxWidth:360, color:T.slate[800], display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ flex:1 }}>{msg}</span>
      {onUndo && (
        <button onClick={onUndo} style={{ padding:'3px 10px', borderRadius:6, background:color+'18', color, border:`1px solid ${color}40`, fontSize:12, fontWeight:800, cursor:'pointer' }}>Undo</button>
      )}
    </div>
  )
}

function FieldRow({ label, children, col='1' }) {
  return (
    <div style={{ gridColumn: col !== '1' ? col : undefined }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  )
}

function SectionDivider({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0 10px', color:T.slate[400] }}>
      <div style={{ flex:1, height:1, background:T.slate[200] }} />
      <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>{label}</span>
      <div style={{ flex:1, height:1, background:T.slate[200] }} />
    </div>
  )
}

function PillStrip({ label, options, value, onChange, colorFn, countFn }) {
  const isMobile = useMobile()
  return (
    <div style={{ display:'flex', alignItems:'center', gap:isMobile?6:8, flexWrap:'wrap' }}>
      <span style={{ fontSize:9, fontWeight:800, color:N.muted, textTransform:'uppercase', letterSpacing:'.12em', whiteSpace:'nowrap', minWidth:isMobile?40:52 }}>{label}</span>
      {['All', ...options].map(opt => {
        const active = value === opt
        const accent = colorFn ? colorFn(opt) : N.indigo
        const count  = countFn ? countFn(opt) : null
        return (
          <button key={opt} onClick={() => onChange(active ? 'All' : opt)} className="neo-pill"
            style={{ padding:'5px 13px', borderRadius:99, fontSize:11, fontWeight:600, cursor:'pointer', border:'none', background:N.bg, boxShadow:active?N.inset('sm'):N.shadow('sm'), color:active?accent:N.muted2, transition:'all .15s', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
            {opt}
            {count !== null && opt !== 'All' && (
              <span style={{ fontSize:9, background:active?accent+'20':N.bg2, color:active?accent:N.muted, borderRadius:99, padding:'0 5px', fontWeight:800, boxShadow:active?'none':N.shadow('sm') }}>{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Analytics Dashboard ───────────────────────────────────────────────────────
function MiniChart({ data, max, color, height=32 }) {
  if (!data.length) return null
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${data.length*20} ${height}`} preserveAspectRatio="none">
      {data.map((v,i) => {
        const barH = max > 0 ? (v/max)*height : 0
        return <rect key={i} x={i*20} y={height-barH} width={18} height={barH} rx={2} fill={color+'99'} />
      })}
    </svg>
  )
}

function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value/total)*100) : 0
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:600, color:T.slate[600], marginBottom:3 }}>
        <span>{label}</span><span>{value} <span style={{ color:T.slate[400] }}>({pct}%)</span></span>
      </div>
      <div style={{ height:8, borderRadius:99, background:T.slate[100], overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, borderRadius:99, background:color, transition:'width .4s' }} />
      </div>
    </div>
  )
}

function AnalyticsDashboard({ apps, cols, darkMode }) {
  const bg = darkMode ? T.slate[800] : '#fff'
  const bd = darkMode ? T.slate[700] : T.slate[200]
  const tx = darkMode ? T.slate[100] : T.slate[800]

  const total   = apps.length
  const byStatus = {}
  ADM_STATUSES.forEach(s => byStatus[s] = apps.filter(a=>a.status===s).length)

  const byCourse = {}
  Object.keys(COURSE_STRUCTURE).forEach(c => byCourse[c] = apps.filter(a=>a.course===c).length)

  const byHostel = {}
  HOSTEL_TYPES.forEach(h => byHostel[h] = apps.filter(a=>a.hostel_type===h).length)

  const byGender = { Male:0, Female:0, Other:0 }
  apps.forEach(a => { if (a.gender && byGender[a.gender] !== undefined) byGender[a.gender]++ })

  const byCat = {}
  CATEGORIES.filter(c=>c!=='--').forEach(c => byCat[c] = apps.filter(a=>a.category===c).length)

  const admittedRate = byStatus['Applied'] > 0
    ? Math.round((byStatus['Admitted']+byStatus['Enrolled']) / total * 100) : 0
  const enrollRate = (byStatus['Admitted']+byStatus['Enrolled']) > 0
    ? Math.round(byStatus['Enrolled'] / (byStatus['Admitted']+byStatus['Enrolled']) * 100) : 0

  const monthsLeft = 8
  const revenueMonthly = apps.filter(a=>a.status==='Enrolled').reduce((s,a) => s + getFlatFeeAmtSync(a.hostel_type, a.course), 0)
  const revForecast = revenueMonthly * monthsLeft

  const dailyCounts = Array.from({length:7},(_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i)
    const ds = d.toISOString().slice(0,10)
    return apps.filter(a=>a.created_at?.slice(0,10)===ds).length
  })

  const card = (title, children) => (
    <div style={{ background:bg, border:`1px solid ${bd}`, borderRadius:12, padding:'14px 16px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.slate[400], textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap:14, marginBottom:16 }}>
      {card('Admission Funnel', <>
        <FunnelBar label="Applied"      value={byStatus['Applied']}      total={total} color={T.indigo[500]} />
        <FunnelBar label="Under Review" value={byStatus['Under Review']} total={total} color={T.amber[500]} />
        <FunnelBar label="Admitted"     value={byStatus['Admitted']}     total={total} color={T.violet[500]} />
        <FunnelBar label="Enrolled"     value={byStatus['Enrolled']}     total={total} color={T.emerald[500]} />
        <FunnelBar label="Rejected"     value={byStatus['Rejected']}     total={total} color={T.rose[500]} />
        <div style={{ marginTop:10, fontSize:12, color:T.slate[500] }}>
          Admit rate: <strong style={{ color:T.violet[600] }}>{admittedRate}%</strong> &nbsp;·&nbsp;
          Enroll rate: <strong style={{ color:T.emerald[600] }}>{enrollRate}%</strong>
        </div>
      </>)}

      {card('Course Breakdown', <>
        {Object.entries(byCourse).map(([c,v]) => (
          <FunnelBar key={c} label={c} value={v} total={total} color={COURSE_STRUCTURE[c]?.color||T.slate[400]} />
        ))}
      </>)}

      {card('Hostel Distribution', <>
        {Object.entries(byHostel).map(([h,v]) => (
          <FunnelBar key={h} label={h} value={v} total={total} color={HOSTEL_STYLES[h]?.color||T.slate[400]} />
        ))}
        <div style={{ marginTop:10, fontSize:12, color:T.slate[500] }}>
          Revenue/mo (Enrolled): <strong style={{ color:T.emerald[600] }}>₹{fmt(revenueMonthly)}</strong>
          <br />Forecast ({monthsLeft}mo): <strong style={{ color:T.emerald[700] }}>₹{fmt(revForecast)}</strong>
        </div>
      </>)}

      {card('Gender & Category', <>
        <div style={{ display:'flex', gap:12, marginBottom:10 }}>
          {Object.entries(byGender).map(([g,v]) => (
            <div key={g} style={{ textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:800, color:tx }}>{v}</div>
              <div style={{ fontSize:10, color:T.slate[400] }}>{g}</div>
            </div>
          ))}
        </div>
        {Object.entries(byCat).filter(([,v])=>v>0).map(([c,v]) => (
          <FunnelBar key={c} label={c} value={v} total={total} color={T.sky[500]} />
        ))}
      </>)}

      {card('Daily Applications (7d)', <>
        <MiniChart data={dailyCounts} max={Math.max(...dailyCounts,1)} color={T.indigo[600]} height={48} />
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
          {['6d','5d','4d','3d','2d','1d','Today'].map((d,i) => (
            <div key={d} style={{ textAlign:'center', width:20 }}>
              <div style={{ fontSize:9, color:T.slate[400] }}>{dailyCounts[i]}</div>
              <div style={{ fontSize:8, color:T.slate[300] }}>{d}</div>
            </div>
          ))}
        </div>
      </>)}

      {card('House Fill Rate', <>
        {HOUSES_LIST.filter(h=>h!=='Day Scholar').map(h => {
          const count = apps.filter(a=>a.house===h).length
          const cap   = HOUSE_CAPACITIES[h] || 40
          const pct   = Math.round((count/cap)*100)
          return (
            <div key={h} style={{ marginBottom:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:600, color:T.slate[600], marginBottom:2 }}>
                <span>{h}</span><span style={{ color:pct>=90?T.rose[600]:pct>=70?T.amber[600]:T.emerald[600] }}>{count}/{cap}</span>
              </div>
              <div style={{ height:6, borderRadius:99, background:T.slate[100], overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, borderRadius:99, background:pct>=90?T.rose[500]:pct>=70?T.amber[500]:T.emerald[500], transition:'width .4s' }} />
              </div>
            </div>
          )
        })}
      </>)}
    </div>
  )
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ a, onClose, onAddNote, darkMode, role, housemastersByHouse={} }) {
  const [noteText, setNoteText] = useState('')
  const bg = darkMode ? T.slate[800] : '#fff'
  const bd = darkMode ? T.slate[600] : T.slate[200]

  const timelineItems = [
    { label:'Application Received', date:a.created_at, color:T.indigo[500] },
    a.status !== 'Applied' && { label:'Status: '+a.status, date:a.updated_at, color:STAT_META[a.status]?.color||T.slate[400] },
    a.interviewDate && { label:'Interview Scheduled', date:a.interviewDate, color:T.amber[500] },
    a.followupDate  && { label:'Follow-up Due',       date:a.followupDate,  color:T.rose[500]  },
  ].filter(Boolean)

  return (
    <div style={{ background:bg, border:`1.5px solid ${bd}`, borderRadius:12, padding:'18px 20px', marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.slate[800] }}>📋 {a.name} — Full Detail</div>
        <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${T.slate[200]}`, background:'#fff', cursor:'pointer', fontSize:14 }}>✕</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap:16 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:T.slate[400], textTransform:'uppercase', marginBottom:8 }}>Personal</div>
          {[['Religion', a.religion],['Mother Tongue',a.motherTongue],['DOB',dateFmt(a.dob)],['Blood',a.blood],['Gender',a.gender],['Category',a.category],['Quota',a.quota],['Disability',a.disabilityFlag?'Yes':'No']].map(([k,v])=>v&&v!=='--'&&(
            <div key={k} style={{ fontSize:12, color:T.slate[600], marginBottom:4 }}><span style={{ fontWeight:700, color:T.slate[500] }}>{k}:</span> {v}</div>
          ))}
        </div>

        <div>
          <div style={{ fontSize:10, fontWeight:700, color:T.slate[400], textTransform:'uppercase', marginBottom:8 }}>Academic & Hostel</div>
          {[['Entrance Score',a.entranceScore],['Interview Score',a.interviewScore],['Interview Date',dateFmt(a.interviewDate)],['House',a.house],['Bed No.',a.bedNumber],['Hostel Type',a.hostel_type],['Instalment',a.instalmentPlan],['Sibling GCC',a.siblingGcc]].map(([k,v])=>v&&(
            <div key={k} style={{ fontSize:12, color:T.slate[600], marginBottom:4 }}><span style={{ fontWeight:700, color:T.slate[500] }}>{k}:</span> {v}</div>
          ))}
        </div>

        <div>
          <div style={{ fontSize:10, fontWeight:700, color:T.slate[400], textTransform:'uppercase', marginBottom:8 }}>Financial</div>
          {[['Scholarship',a.scholarshipPct?`${a.scholarshipPct}%`:'—'],['Concession',a.concessionAmt?`₹${fmt(a.concessionAmt)}`:'—'],['Security Dep.',a.securityDeposit?`₹${fmt(a.securityDeposit)}`:'—'],['Transport Fee',a.transportFee?`₹${fmt(a.transportFee)}/mo`:'—'],['Base Fee',`₹${fmt(getFlatFeeAmtSync(a.hostel_type, a.course))}/mo`]].map(([k,v])=>(
            <div key={k} style={{ fontSize:12, color:T.slate[600], marginBottom:4 }}><span style={{ fontWeight:700, color:T.slate[500] }}>{k}:</span> {v}</div>
          ))}
          {a.scholarshipPct > 0 && (
            <div style={{ marginTop:6, padding:'6px 10px', borderRadius:7, background:T.emerald[50], border:`1px solid ${T.emerald[200]}`, fontSize:11, fontWeight:700, color:T.emerald[700] }}>
              Effective fee: ₹{fmt(Math.round(getFlatFeeAmtSync(a.hostel_type, a.course) * (1 - a.scholarshipPct/100)))}/mo
            </div>
          )}
        </div>
      </div>

      <SectionDivider label="Activity Timeline" />
      <div style={{ display:'flex', gap:0, overflowX:'auto', paddingBottom:4 }}>
        {timelineItems.map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', minWidth:160 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginRight:10 }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:item.color, flexShrink:0, marginTop:2 }} />
              {i < timelineItems.length-1 && <div style={{ width:2, flex:1, background:T.slate[200], minHeight:24 }} />}
            </div>
            <div style={{ paddingBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.slate[700] }}>{item.label}</div>
              <div style={{ fontSize:10, color:T.slate[400] }}>{timeFmt(item.date)}</div>
            </div>
          </div>
        ))}
      </div>

      <SectionDivider label="Document Checklist" />
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
        {ADM_DOCS.map(d => {
          const have = a.docs?.includes(d)
          return (
            <span key={d} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, background:have?T.emerald[50]:T.rose[50], color:have?T.emerald[700]:T.rose[600], border:`1px solid ${have?T.emerald[200]:T.rose[200]}`, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              <span>{have ? '✓' : '○'}</span>{d}
            </span>
          )
        })}
      </div>

      <SectionDivider label={`Staff Notes (${a.notes?.length||0})`} />
      <div style={{ marginBottom:8 }}>
        {(a.notes||[]).map((n,i) => (
          <div key={i} style={{ fontSize:12, color:T.slate[600], padding:'6px 10px', background:T.slate[50], borderRadius:6, marginBottom:4 }}>
            <span style={{ fontWeight:700, color:T.slate[400], fontSize:10 }}>{timeFmt(n.ts)} · {n.by || 'Staff'}</span><br/>{n.text}
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add internal note…" style={{ ...styles.inp, flex:1 }} />
        <button onClick={() => { if (noteText.trim()) { onAddNote(a.id, noteText); setNoteText('') } }}
          style={{ padding:'9px 16px', borderRadius:8, background:T.slate[800], color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>Add</button>
      </div>

      {a.house && housemastersByHouse[a.house] && checkPermission(role, 'viewContacts') && (
        <>
          <SectionDivider label="Warden Contact" />
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:T.sky[50], border:`1px solid ${T.sky[100]}`, borderRadius:8 }}>
            <span style={{ fontSize:20 }}>👤</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.sky[700] }}>{housemastersByHouse[a.house].name}</div>
              <div style={{ fontSize:11, color:T.sky[600] }}>
                {a.house} {housemastersByHouse[a.house].designation || 'House Warden'} · {housemastersByHouse[a.house].phone || 'No phone on file'}
              </div>
            </div>
            {housemastersByHouse[a.house].phone && (
              <a href={`tel:${housemastersByHouse[a.house].phone}`} style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:7, background:T.sky[500], color:'#fff', fontSize:11, fontWeight:700, textDecoration:'none' }}>Call</a>
            )}
          </div>
        </>
      )}
      {a.house && !housemastersByHouse[a.house] && checkPermission(role, 'viewContacts') && (
        <>
          <SectionDivider label="Warden Contact" />
          <div style={{ fontSize:12, color:T.amber[600], padding:'8px 12px', background:T.amber[50], borderRadius:8, fontWeight:600 }}>
            ⚠ No active housemaster assigned to {a.house} — add one in Hostel → Housemasters
          </div>
        </>
      )}
      {a.house && housemastersByHouse[a.house] && !checkPermission(role, 'viewContacts') && (
        <>
          <SectionDivider label="Warden Contact" />
          <div style={{ fontSize:12, color:T.slate[500], padding:'8px 12px', background:T.slate[50], borderRadius:8 }}>
            🔒 {a.house} House Warden — contact restricted to admission staff
          </div>
        </>
      )}

      {a.emergencyName && (
        <>
          <SectionDivider label="Emergency Contact" />
          <div style={{ fontSize:12, color:T.slate[600], padding:'6px 12px', background:T.rose[50], border:`1px solid ${T.rose[100]}`, borderRadius:8 }}>
            <strong>{a.emergencyName}</strong> ({a.emergencyRel}) — {a.emergencyPhone}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Quick-Edit Row ────────────────────────────────────────────────────────────
function QuickEditRow({ a, onSave, onCancel }) {
  const [status,    setStatus]    = useState(a.status)
  const [house,     setHouse]     = useState(a.house||'')
  const [hostel,    setHostel]    = useState(a.hostel_type)
  const [followup,  setFollowup]  = useState(a.followupDate||'')
  const [bedNum,    setBedNum]    = useState(a.bedNumber||'')

  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', padding:'10px 16px', background:T.amber[50], border:`1px solid ${T.amber[200]}`, borderRadius:10, marginBottom:4 }}>
      <span style={{ fontSize:11, fontWeight:700, color:T.amber[700], marginRight:4 }}>Quick Edit: {a.name}</span>
      <select value={status}   onChange={e=>setStatus(e.target.value)}   style={{ ...styles.inp, width:'auto', fontSize:11, padding:'5px 8px' }}>{ADM_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
      <select value={house}    onChange={e=>setHouse(e.target.value)}    style={{ ...styles.inp, width:'auto', fontSize:11, padding:'5px 8px' }}><option value="">— House —</option>{HOUSES_LIST.map(h=><option key={h}>{h}</option>)}</select>
      <select value={hostel}   onChange={e=>setHostel(e.target.value)}   style={{ ...styles.inp, width:'auto', fontSize:11, padding:'5px 8px' }}>{HOSTEL_TYPES.map(h=><option key={h}>{h}</option>)}</select>
      <input  value={followup} onChange={e=>setFollowup(e.target.value)} type="date" style={{ ...styles.inp, width:'auto', fontSize:11, padding:'5px 8px' }} placeholder="Follow-up date" />
      <input  value={bedNum}   onChange={e=>setBedNum(e.target.value)}   style={{ ...styles.inp, width:90, fontSize:11, padding:'5px 8px' }} placeholder="Bed No." />
      <button onClick={() => onSave(a.id,{status,house,hostel_type:hostel,followupDate:followup,bedNumber:bedNum})}
        style={{ padding:'5px 14px', borderRadius:7, background:T.emerald[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Save</button>
      <button onClick={onCancel}
        style={{ padding:'5px 10px', borderRadius:7, background:'#fff', color:T.slate[600], border:`1px solid ${T.slate[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>✕</button>
    </div>
  )
}

// ─── Advanced Search ───────────────────────────────────────────────────────────
function AdvancedSearch({ filters, onChange, onClose, apps }) {
  const [f, setF] = useState(filters)
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  return (
    <div style={{ background:'#fff', boxShadow:N.shadow('md'), borderRadius:16, padding:'18px 20px', marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:700, color:N.text, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:`linear-gradient(135deg,${N.gold},${N.goldDark})` }} />
          Advanced Search
        </div>
        <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${N.border}`, background:'#fff', cursor:'pointer', fontSize:14, color:N.text2 }}>✕</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
        <FieldRow label="Gender">
          <select style={styles.inp} value={f.gender||''} onChange={e=>set('gender',e.target.value)}>
            <option value="">Any</option><option>Male</option><option>Female</option><option>Other</option>
          </select>
        </FieldRow>
        <FieldRow label="Category">
          <select style={styles.inp} value={f.category||''} onChange={e=>set('category',e.target.value)}>
            <option value="">Any</option>{CATEGORIES.filter(c=>c!=='--').map(c=><option key={c}>{c}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Religion">
          <select style={styles.inp} value={f.religion||''} onChange={e=>set('religion',e.target.value)}>
            <option value="">Any</option>{RELIGIONS.filter(r=>r!=='--').map(r=><option key={r}>{r}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Quota">
          <select style={styles.inp} value={f.quota||''} onChange={e=>set('quota',e.target.value)}>
            <option value="">Any</option>{QUOTA_TYPES.filter(q=>q!=='--').map(q=><option key={q}>{q}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="DOB From">
          <input type="date" style={styles.inp} value={f.dobFrom||''} onChange={e=>set('dobFrom',e.target.value)} />
        </FieldRow>
        <FieldRow label="DOB To">
          <input type="date" style={styles.inp} value={f.dobTo||''} onChange={e=>set('dobTo',e.target.value)} />
        </FieldRow>
        <FieldRow label="House">
          <select style={styles.inp} value={f.house||''} onChange={e=>set('house',e.target.value)}>
            <option value="">Any</option>{HOUSES_LIST.map(h=><option key={h}>{h}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Doc Status">
          <select style={styles.inp} value={f.docStatus||''} onChange={e=>set('docStatus',e.target.value)}>
            <option value="">Any</option>
            <option value="complete">All Docs Received</option>
            <option value="missing_tc">Missing TC</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </FieldRow>
        <FieldRow label="Fee Status">
          <select style={styles.inp} value={f.feeStatus||''} onChange={e=>set('feeStatus',e.target.value)}>
            <option value="">Any</option>
            <option value="paid">Fee Paid</option>
            <option value="unpaid">Fee Unpaid</option>
          </select>
        </FieldRow>
        <FieldRow label="Follow-up">
          <select style={styles.inp} value={f.followupStatus||''} onChange={e=>set('followupStatus',e.target.value)}>
            <option value="">Any</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </FieldRow>
        <FieldRow label="Disability">
          <select style={styles.inp} value={f.disability||''} onChange={e=>set('disability',e.target.value)}>
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </FieldRow>
        <FieldRow label="Scholarship">
          <select style={styles.inp} value={f.scholarship||''} onChange={e=>set('scholarship',e.target.value)}>
            <option value="">Any</option>
            <option value="yes">Has Scholarship</option>
            <option value="no">No Scholarship</option>
          </select>
        </FieldRow>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
        <button onClick={() => onChange(f)}
          style={{ padding:'9px 20px', borderRadius:9, background:`linear-gradient(135deg,${N.navy},${N.navyLight})`, color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer' }}>Apply Filters</button>
        <button onClick={() => { const empty={}; setF(empty); onChange(empty) }}
          style={{ padding:'9px 16px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:T.slate[600] }}>Reset</button>
      </div>
    </div>
  )
}

// ─── WhatsApp Blast Modal ──────────────────────────────────────────────────────
function WABlastModal({ apps, onClose }) {
  const [template, setTemplate] = useState('admission')
  const previewApp = apps[0]
  const previewMsg = previewApp ? buildWAMsg(previewApp, template) : ''

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:24, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800, color:T.slate[800] }}>📲 WhatsApp Blast</div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, border:`1px solid ${T.slate[200]}`, background:'#fff', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={styles.label}>Message Template</label>
          <select style={styles.inp} value={template} onChange={e=>setTemplate(e.target.value)}>
            <option value="admission">Admission Confirmation</option>
            <option value="interview">Interview Call Letter</option>
            <option value="fee_due">Fee Due Reminder</option>
          </select>
        </div>
        <div style={{ padding:'12px 14px', background:'#DCF8C6', borderRadius:10, fontSize:12, color:'#128C7E', fontFamily:'monospace', whiteSpace:'pre-wrap', marginBottom:14, maxHeight:180, overflowY:'auto' }}>
          {previewMsg}
        </div>
        <div style={{ fontSize:12, color:T.slate[500], marginBottom:12 }}>
          Will open {Math.min(apps.length,5)} WhatsApp chat(s).
          {apps.length>5 && <span style={{ color:T.rose[600], fontWeight:700 }}> ⚠ Only first 5 of {apps.length} will open — browsers block bulk popups.</span>}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => {
            apps.slice(0,5).forEach((a,i) => {
              setTimeout(() => {
                const msg = encodeURIComponent(buildWAMsg(a, template))
                const phone = (a.whatsapp||a.phone||'').replace(/\D/g,'')
                if (phone) window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank')
              }, i*400)
            })
          }} style={{ padding:'10px 20px', borderRadius:9, background:'#25D366', color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer' }}>
            Open WhatsApp ({Math.min(apps.length,5)})
          </button>
          <button onClick={onClose} style={{ padding:'10px 16px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:T.slate[600] }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Print helpers ─────────────────────────────────────────────────────────────
function printAdmitCard(a) {
  const win = window.open('','_blank','width=600,height=700')
  const fee = getFlatFeeAmtSync(a.hostel_type, a.course)
  win.document.write(`<!DOCTYPE html><html><head><title>Admit Card – ${a.name}</title>
  <style>body{font-family:Georgia,serif;padding:32px;max-width:540px;margin:auto}
  .header{text-align:center;border-bottom:2px solid #1E1B4B;padding-bottom:12px;margin-bottom:16px}
  .logo{font-size:20px;font-weight:900;color:#1E1B4B}
  .sub{font-size:12px;color:#475569;margin-top:4px}
  .title{font-size:16px;font-weight:700;background:#EEF2FF;padding:8px 16px;border-radius:6px;text-align:center;margin-bottom:16px;color:#3730A3}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:7px 10px;border-bottom:1px solid #E2E8F0}
  td:first-child{font-weight:700;color:#475569;width:160px}
  .footer{margin-top:20px;text-align:center;font-size:11px;color:#94A3B8;border-top:1px solid #E2E8F0;padding-top:12px}
  .badge{display:inline-block;padding:3px 10px;background:#ECFDF5;color:#047857;border-radius:99px;font-size:11px;font-weight:700;border:1px solid #6EE7B7}
  @media print{body{padding:16px}}</style></head><body>
  <div class="header"><div class="logo">GNSI – Guidance Navodaya & Sainik Institute</div><div class="sub">Khangabok, Thoubal District, Manipur</div></div>
  <div class="title">ADMISSION CARD</div>
  <table>
    <tr><td>GCC No.</td><td><strong>${a.gcc}</strong></td></tr>
    <tr><td>Adm. No.</td><td><strong>${a.admNo||'—'}</strong></td></tr>
    <tr><td>Name</td><td>${a.name}</td></tr>
    <tr><td>DOB</td><td>${dateFmt(a.dob)}</td></tr>
    <tr><td>Gender</td><td>${a.gender||'—'}</td></tr>
    <tr><td>Course</td><td>${a.course||'—'}${a.subtype?' – '+a.subtype:''}</td></tr>
    <tr><td>Class / Batch</td><td>${a.cls||'—'}</td></tr>
    <tr><td>House</td><td>${a.house||'TBD'}</td></tr>
    <tr><td>Hostel Type</td><td><span class="badge">${a.hostel_type}</span></td></tr>
    <tr><td>Session</td><td>${a.session||'—'}</td></tr>
    <tr><td>Monthly Fee</td><td>₹${fmt(fee)}/month</td></tr>
    <tr><td>Father</td><td>${a.father||'—'}</td></tr>
    <tr><td>Phone</td><td>${a.phone||'—'}</td></tr>
    <tr><td>Status</td><td>${a.status}</td></tr>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} · GNSI Portal v2.0</div>
  <script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}

function printBulkList(apps) {
  const win = window.open('','_blank','width=900,height=700')
  const rows = apps.map(a =>
    `<tr><td>${a.gcc}</td><td>${a.admNo||'—'}</td><td>${a.name}</td><td>${a.course||'—'}</td><td>${a.cls||'—'}</td><td>${a.house||'—'}</td><td>${a.hostel_type}</td><td>${a.status}</td><td>${a.phone||'—'}</td></tr>`
  ).join('')
  win.document.write(`<!DOCTYPE html><html><head><title>GNSI Admissions List</title>
  <style>body{font-family:system-ui;padding:24px;font-size:12px}h2{color:#1E1B4B;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}th{background:#EEF2FF;color:#3730A3;font-size:11px;padding:7px 8px;text-align:left;border-bottom:2px solid #C7D2FE}
  td{padding:6px 8px;border-bottom:1px solid #E2E8F0}tr:nth-child(even){background:#F8FAFC}
  @media print{body{padding:8px}}</style></head><body>
  <h2>GNSI – Admissions List (${apps.length} records) · ${new Date().toLocaleDateString('en-IN')}</h2>
  <table><thead><tr><th>GCC</th><th>Adm No</th><th>Name</th><th>Course</th><th>Class</th><th>House</th><th>Hostel</th><th>Status</th><th>Phone</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}

// ─── Application Form ──────────────────────────────────────────────────────────
function AdmForm({ onSave, onCancel, editing, activeSession, role, housemastersByHouse={} }) {
  const def = (k, fb='') => editing ? (editing[k] ?? fb) : fb
  const defaultSession = editing ? def('session') : (activeSession?.session_name || '')

  const [form, setForm] = useState({
    name:           def('name'),
    gcc:            def('gcc'),
    dob:            def('dob'),
    gender:         def('gender'),
    blood:          def('blood'),
    category:       def('category','--'),
    religion:       def('religion','--'),
    motherTongue:   def('motherTongue','--'),
    quota:          def('quota','--'),
    referral:       def('referral','--'),
    disabilityFlag: def('disabilityFlag',false),
    disabilityNotes:def('disabilityNotes'),
    scholarshipPct: def('scholarshipPct'),
    concessionAmt:  def('concessionAmt'),
    securityDeposit:def('securityDeposit'),
    transportFee:   def('transportFee'),
    instalmentPlan: def('instalmentPlan','monthly'),
    entranceScore:  def('entranceScore'),
    interviewScore: def('interviewScore'),
    interviewDate:  def('interviewDate'),
    followupDate:   def('followupDate'),
    bedNumber:      def('bedNumber'),
    emergencyName:  def('emergencyName'),
    emergencyPhone: def('emergencyPhone'),
    emergencyRel:   def('emergencyRel'),
    siblingGcc:     def('siblingGcc'),
    course:         def('course'),
    subtype:        def('subtype'),
    cls:            def('cls'),
    house:          def('house'),
    session:        defaultSession,
    hostel_type:    def('hostel_type','Day Scholar'),
    status:         def('status','Applied'),
    father:         def('father'),
    mother:         def('mother'),
    phone:          def('phone'),
    whatsapp:       def('whatsapp'),
    prevSchool:     def('prevSchool'),
    address:        def('address'),
    remarks:        def('remarks'),
    photoUrl:       def('photoUrl'),
    docs:           editing?.docs || [],
  })

  const set = (k,v) => {
    setForm(f => {
      const nf = { ...f, [k]:v }
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(nf)) } catch(_) {}
      return nf
    })
  }
  const toggleDoc = d => set('docs', form.docs.includes(d) ? form.docs.filter(x=>x!==d) : [...form.docs,d])
  const subtypes = COURSE_STRUCTURE[form.course]?.subtypes ?? []

  useEffect(() => {
    if (!form.house) return
    if (DAY_SCHOLAR_HOUSES.includes(form.house)) set('hostel_type','Day Scholar')
    else if (form.hostel_type === 'Day Scholar') set('hostel_type','Boarder')
  }, [form.house])

  const [gccDup, setGccDup] = useState(false)
  useEffect(() => {
    if (!form.gcc || editing) { setGccDup(false); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('admissions').select('gcc_no').eq('gcc_no', parseInt(form.gcc))
      setGccDup(!!(data && data.length > 0))
    }, 500)
    return () => clearTimeout(timer)
  }, [form.gcc, editing])

  // 🔗 Live house capacity check — sourced from the real `houses` table +
  // actual student/admission counts (feeEngine.js's getHouseOccupancy),
  // not the old hardcoded HOUSE_CAPACITIES guess. This is a WARNING, not a
  // hard block: staff can still proceed (e.g. a house may legitimately get
  // an extra bed added), but they'll never be silently unaware of it the
  // way the old hardcoded-only check allowed. The real enforcement point
  // is promoteToStudent() at actual enrollment time, which does block.
  const [houseCapacityWarning, setHouseCapacityWarning] = useState('')
  useEffect(() => {
    if (!form.house) { setHouseCapacityWarning(''); return }
    const timer = setTimeout(async () => {
      const check = await checkHouseCapacity(form.house, editing ? parseInt(form.gcc) : null)
      setHouseCapacityWarning(check.ok ? (check.warning || '') : check.reason)
    }, 400)
    return () => clearTimeout(timer)
  }, [form.house, form.gcc, editing])

  const derivedHostelType = deriveHostelType(form.house, form.hostel_type)
  const hs       = HOSTEL_STYLES[derivedHostelType] || HOSTEL_STYLES['Day Scholar']
  const baseRate = getFlatFeeAmtSync(derivedHostelType, form.course)
  const discRate = form.scholarshipPct > 0 ? Math.round(baseRate*(1-form.scholarshipPct/100)) : baseRate
  const warden   = housemastersByHouse[form.house]

  const [dirty, setDirty] = useState(false)
  useEffect(() => setDirty(true), [form])

  const handleCancel = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    try { localStorage.removeItem(DRAFT_KEY) } catch(_) {}
    onCancel()
  }

  return (
    <div style={{ background:'#fff', boxShadow:N.shadow('lg'), borderRadius:16, overflow:'hidden', marginBottom:16 }}>
      <div style={{ background:`linear-gradient(135deg, ${N.navy} 0%, ${N.navyLight} 100%)`, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{editing ? '✏️ Edit Application' : '➕ New Application'}</div>
          {activeSession && !editing && (
            <div style={{ fontSize:12, fontWeight:600, marginTop:3, color:activeSession.is_locked?'#FF8A8A':'#6FDB9A' }}>
              📅 Session: {activeSession.session_name}{activeSession.is_locked && ' · 🔒 Locked'}
            </div>
          )}
        </div>
        <button onClick={handleCancel} style={{ width:30, height:30, borderRadius:8, border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.08)', cursor:'pointer', fontSize:16, color:'#fff' }}>✕</button>
      </div>

      <div style={{ padding:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, padding:'12px 14px', background:T.slate[50], borderRadius:10, border:`1px solid ${T.slate[200]}` }}>
          <Avatar name={form.name} size={56} photoUrl={form.photoUrl} />
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:T.slate[600], marginBottom:4 }}>Passport Photo URL</div>
            <input style={{ ...styles.inp, width:'100%', maxWidth:280 }} value={form.photoUrl} onChange={e=>set('photoUrl',e.target.value)} placeholder="https://… or Supabase Storage URL" />
          </div>
        </div>

        <FieldRow label="Applicant Name *">
          <input style={styles.inp} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Full name as per certificate" />
        </FieldRow>

        <SectionDivider label="Identification" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4 }}>
          <FieldRow label="GCC No. *">
            <input style={{ ...styles.inp, borderColor:gccDup?T.rose[500]:undefined }} value={form.gcc} onChange={e=>set('gcc',e.target.value)} placeholder="e.g. 729" type="number" />
            {gccDup && <div style={{ fontSize:11, color:T.rose[600], marginTop:3, fontWeight:700 }}>⚠ GCC {form.gcc} already exists!</div>}
          </FieldRow>
          <FieldRow label="Adm. No.">
            <input style={{ ...styles.inp, background:T.slate[50], color:T.slate[400] }} value="Auto-generated on save" readOnly />
          </FieldRow>
          <FieldRow label="Date of Birth">
            <input type="date" style={styles.inp} value={form.dob} onChange={e=>set('dob',e.target.value)} />
          </FieldRow>
          <FieldRow label="Gender">
            <select style={styles.inp} value={form.gender} onChange={e=>set('gender',e.target.value)}>
              <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </FieldRow>
          <FieldRow label="Blood Group">
            <input style={styles.inp} value={form.blood} onChange={e=>set('blood',e.target.value)} placeholder="e.g. O+" />
          </FieldRow>
          <FieldRow label="Category">
            <select style={styles.inp} value={form.category} onChange={e=>set('category',e.target.value)}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Religion">
            <select style={styles.inp} value={form.religion} onChange={e=>set('religion',e.target.value)}>
              {RELIGIONS.map(r=><option key={r}>{r}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Mother Tongue">
            <select style={styles.inp} value={form.motherTongue} onChange={e=>set('motherTongue',e.target.value)}>
              {MOTHER_TONGUES.map(m=><option key={m}>{m}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Quota Type">
            <select style={styles.inp} value={form.quota} onChange={e=>set('quota',e.target.value)}>
              {QUOTA_TYPES.map(q=><option key={q}>{q}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Referral Source">
            <select style={styles.inp} value={form.referral} onChange={e=>set('referral',e.target.value)}>
              {REFERRAL_SOURCES.map(r=><option key={r}>{r}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Disability / Special Needs">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4 }}>
              <input type="checkbox" checked={form.disabilityFlag} onChange={e=>set('disabilityFlag',e.target.checked)} id="disCheck" style={{ width:16, height:16, cursor:'pointer' }} />
              <label htmlFor="disCheck" style={{ fontSize:13, color:T.slate[700], cursor:'pointer' }}>Yes</label>
              {form.disabilityFlag && <input style={{ ...styles.inp, flex:1 }} value={form.disabilityNotes} onChange={e=>set('disabilityNotes',e.target.value)} placeholder="Describe…" />}
            </div>
          </FieldRow>
          <FieldRow label="Sibling GCC No.">
            <input style={styles.inp} value={form.siblingGcc} onChange={e=>set('siblingGcc',e.target.value)} placeholder="If sibling enrolled at GNSI" type="number" />
          </FieldRow>
        </div>

        <SectionDivider label="Course & Class" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap:12, marginBottom:4 }}>
          <FieldRow label="Course">
            <select style={styles.inp} value={form.course} onChange={e=>set('course',e.target.value)}>
              <option value="">— Course —</option>
              {Object.keys(COURSE_STRUCTURE).map(c=><option key={c}>{c}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Subtype / Batch">
            {subtypes.length > 0
              ? <select style={styles.inp} value={form.subtype} onChange={e=>set('subtype',e.target.value)}><option value="">—</option>{subtypes.map(s=><option key={s}>{s}</option>)}</select>
              : <input style={styles.inp} value={form.subtype} onChange={e=>set('subtype',e.target.value)} placeholder="Subtype" />
            }
          </FieldRow>
          <FieldRow label="Class / Batch">
            <select style={styles.inp} value={form.cls} onChange={e=>set('cls',e.target.value)}>
              <option value="">— Class —</option>
              {CLASSES_LIST.map(c=><option key={c}>{c}</option>)}
            </select>
          </FieldRow>
          <FieldRow label={activeSession && !editing ? 'Session (auto)' : 'Session'}>
            {activeSession && !editing
              ? <input style={{ ...styles.inp, background:T.emerald[50], color:T.emerald[700], fontWeight:700, border:`1.5px solid ${T.emerald[300]}` }} value={activeSession.session_name} readOnly />
              : <input style={styles.inp} value={form.session} onChange={e=>set('session',e.target.value)} placeholder="e.g. 2025-26" />
            }
          </FieldRow>
          <FieldRow label="House / Block">
            <select style={styles.inp} value={form.house} onChange={e=>set('house',e.target.value)}>
              <option value="">— House —</option>
              {HOUSES_LIST.map(h=><option key={h}>{h}</option>)}
            </select>
            {houseCapacityWarning && (
              <div style={{ fontSize:11, color:T.amber[600], marginTop:3, fontWeight:700 }}>⚠ {houseCapacityWarning}</div>
            )}
          </FieldRow>
          <FieldRow label="Hostel Type">
            <select style={{ ...styles.inp, background:form.house&&DAY_SCHOLAR_HOUSES.includes(form.house)?T.slate[50]:'#fff', color:form.house&&DAY_SCHOLAR_HOUSES.includes(form.house)?T.slate[400]:T.slate[800] }}
              value={form.hostel_type} onChange={e=>set('hostel_type',e.target.value)}>
              {HOSTEL_TYPES.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Bed / Room No.">
            <input style={styles.inp} value={form.bedNumber} onChange={e=>set('bedNumber',e.target.value)} placeholder="e.g. K-12" />
          </FieldRow>
          <FieldRow label="Status">
            <select style={styles.inp} value={form.status} onChange={e=>set('status',e.target.value)}>
              {ADM_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Follow-up Date">
            <input type="date" style={styles.inp} value={form.followupDate} onChange={e=>set('followupDate',e.target.value)} />
          </FieldRow>
        </div>

        {form.house && !warden && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, marginBottom:12, padding:'6px 14px', borderRadius:8, background:T.amber[50], border:`1px solid ${T.amber[200]}`, fontSize:12, color:T.amber[700], fontWeight:600 }}>
            ⚠ No active housemaster on file for {form.house}
          </div>
        )}
        {warden && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, marginBottom:12, padding:'6px 14px', borderRadius:8, background:T.sky[50], border:`1px solid ${T.sky[100]}`, fontSize:12, color:T.sky[700] }}>
            👤 {warden.designation || 'Warden'}: <strong>{warden.name}</strong>{warden.phone ? ` · ${warden.phone}` : ''}
          </div>
        )}

        <div style={{ display:'inline-flex', alignItems:'center', gap:7, marginBottom:12, marginLeft:8, padding:'6px 14px', borderRadius:8, background:hs.bg, border:`1px solid ${hs.border}`, fontSize:12, fontWeight:700, color:hs.color }}>
          {hs.icon} <strong>{derivedHostelType}</strong>
          <span style={{ fontWeight:400, color:T.slate[400] }}>·</span>
          Base: <strong>₹{fmt(baseRate)}/mo</strong>
          {form.scholarshipPct > 0 && <><span style={{ color:T.slate[400] }}>·</span> After scholarship: <strong style={{ color:T.emerald[600] }}>₹{fmt(discRate)}/mo</strong></>}
        </div>

        <SectionDivider label="Entrance & Interview" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:4 }}>
          <FieldRow label="Entrance Score">
            <input style={styles.inp} type="number" value={form.entranceScore} onChange={e=>set('entranceScore',e.target.value)} placeholder="Out of 100" />
          </FieldRow>
          <FieldRow label="Interview Score">
            <input style={styles.inp} type="number" value={form.interviewScore} onChange={e=>set('interviewScore',e.target.value)} placeholder="Out of 50" />
          </FieldRow>
          <FieldRow label="Interview Date">
            <input type="date" style={styles.inp} value={form.interviewDate} onChange={e=>set('interviewDate',e.target.value)} />
          </FieldRow>
        </div>

        <SectionDivider label="Financial" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:4 }}>
          <FieldRow label="Scholarship %">
            <input style={styles.inp} type="number" min="0" max="100" value={form.scholarshipPct} onChange={e=>set('scholarshipPct',e.target.value)} placeholder="e.g. 25" />
          </FieldRow>
          <FieldRow label="Concession Amount ₹">
            <input style={styles.inp} type="number" value={form.concessionAmt} onChange={e=>set('concessionAmt',e.target.value)} placeholder="Fixed ₹ off/mo" />
          </FieldRow>
          <FieldRow label="Security Deposit ₹">
            <input style={styles.inp} type="number" value={form.securityDeposit} onChange={e=>set('securityDeposit',e.target.value)} placeholder="Refundable" />
          </FieldRow>
          <FieldRow label="Transport Fee ₹/mo">
            <input style={styles.inp} type="number" value={form.transportFee} onChange={e=>set('transportFee',e.target.value)} placeholder="Day scholars" />
          </FieldRow>
          <FieldRow label="Instalment Plan">
            <select style={styles.inp} value={form.instalmentPlan} onChange={e=>set('instalmentPlan',e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </FieldRow>
        </div>

        <SectionDivider label="Family & Contact" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4 }}>
          <FieldRow label="Father's Name"><input style={styles.inp} value={form.father} onChange={e=>set('father',e.target.value)} /></FieldRow>
          <FieldRow label="Mother's Name"><input style={styles.inp} value={form.mother} onChange={e=>set('mother',e.target.value)} /></FieldRow>
          <FieldRow label="Phone"><input style={styles.inp} value={form.phone} onChange={e=>set('phone',e.target.value)} /></FieldRow>
          <FieldRow label="WhatsApp"><input style={styles.inp} value={form.whatsapp} onChange={e=>set('whatsapp',e.target.value)} /></FieldRow>
          <FieldRow label="Previous School"><input style={styles.inp} value={form.prevSchool} onChange={e=>set('prevSchool',e.target.value)} /></FieldRow>
          <div style={{ gridColumn:'1/-1' }}>
            <FieldRow label="Address"><input style={styles.inp} value={form.address} onChange={e=>set('address',e.target.value)} /></FieldRow>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <FieldRow label="Remarks"><textarea style={{ ...styles.inp, resize:'vertical' }} rows={2} value={form.remarks} onChange={e=>set('remarks',e.target.value)} /></FieldRow>
          </div>
        </div>

        <SectionDivider label="Emergency Contact" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:4 }}>
          <FieldRow label="Name"><input style={styles.inp} value={form.emergencyName} onChange={e=>set('emergencyName',e.target.value)} placeholder="Contact name" /></FieldRow>
          <FieldRow label="Phone"><input style={styles.inp} value={form.emergencyPhone} onChange={e=>set('emergencyPhone',e.target.value)} /></FieldRow>
          <FieldRow label="Relationship"><input style={styles.inp} value={form.emergencyRel} onChange={e=>set('emergencyRel',e.target.value)} placeholder="e.g. Uncle" /></FieldRow>
        </div>

        <SectionDivider label={`Documents (${form.docs.length}/${ADM_DOCS.length})`} />
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:20 }}>
          {ADM_DOCS.map(d => (
            <button key={d} onClick={() => toggleDoc(d)}
              style={{ padding:'5px 12px', borderRadius:7, border:`1.5px solid ${form.docs.includes(d)?T.emerald[500]:T.slate[200]}`, background:form.docs.includes(d)?T.emerald[50]:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color:form.docs.includes(d)?T.emerald[700]:T.slate[600], display:'flex', alignItems:'center', gap:5 }}>
              {form.docs.includes(d) && <span style={{ fontSize:10, color:T.emerald[600] }}>✓</span>}
              {d}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={() => onSave(editing?.id||null, form)} disabled={gccDup}
            style={{ padding:'10px 24px', borderRadius:9, background:gccDup?T.slate[300]:`linear-gradient(135deg,${N.navy},${N.navyLight})`, color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:gccDup?'not-allowed':'pointer' }}>
            {editing ? 'Update Application' : 'Save Application'}
          </button>
          <button onClick={handleCancel} style={{ padding:'10px 16px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:T.slate[600] }}>Cancel</button>
          {editing && (
            <button onClick={() => printAdmitCard(editing)}
              style={{ padding:'10px 16px', borderRadius:9, border:`1px solid ${T.indigo[200]}`, background:T.indigo[50], color:T.indigo[700], fontSize:13, fontWeight:700, cursor:'pointer' }}>🖨 Admit Card</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Application Card ──────────────────────────────────────────────────────────
function AppCard({ a, cols, selected, onSelect, onEdit, onDelete, onAdmit, onEnroll, onOpenFee, onQuickEdit, onDetail, onWAMsg, tableMode, darkMode, canDelete=true }) {
  const gcc     = String(a.gcc || a.id)
  const admPaid = cols.some(col => String(parseInt(col.adm_app_id)) === String(parseInt(a.gcc)) && col.fee_type === 'admission')
  const cs      = COURSE_STRUCTURE[a.course]
  const today   = new Date().toISOString().slice(0,10)
  const followupOverdue = a.followupDate && a.followupDate < today
  const followupToday   = a.followupDate && a.followupDate === today

  const bg = darkMode ? T.slate[800] : '#fff'
  const bd = darkMode ? T.slate[700] : T.slate[200]

  let actionBtn = null
  if (a.status === 'Applied' || a.status === 'Under Review') {
    actionBtn = <button onClick={e=>{e.stopPropagation();onAdmit(a.id)}} style={{ padding:'6px 14px', borderRadius:7, background:T.violet[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Admit</button>
  } else if (a.status === 'Admitted' && !admPaid) {
    actionBtn = <button onClick={e=>{e.stopPropagation();onOpenFee(a)}} style={{ padding:'6px 14px', borderRadius:7, background:T.amber[500], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Collect Fee</button>
  } else if (a.status === 'Admitted' && admPaid) {
    actionBtn = (
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <button onClick={e=>{e.stopPropagation();onOpenFee(a)}} style={{ padding:'5px 12px', borderRadius:7, background:T.amber[500], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Fee Account</button>
        <button onClick={e=>{e.stopPropagation();onEnroll(a.id)}} style={{ padding:'5px 8px', borderRadius:7, background:T.emerald[600], color:'#fff', border:'none', fontSize:10, fontWeight:700, cursor:'pointer', width:'100%' }}>Enroll →</button>
      </div>
    )
  } else if (a.status === 'Enrolled') {
    actionBtn = (
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <span style={{ fontSize:11, color:T.emerald[600], fontWeight:700 }}>✓ Enrolled</span>
        <button onClick={e=>{e.stopPropagation();onOpenFee(a)}} style={{ padding:'4px 10px', borderRadius:6, background:T.emerald[50], color:T.emerald[700], border:`1px solid ${T.emerald[300]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Fee</button>
      </div>
    )
  }

  // ── Table row mode ──────────────────────────────────────────────────────────
  if (tableMode) {
    return (
      <tr style={{ background:selected?T.indigo[50]:bg, borderBottom:`1px solid ${bd}`, fontSize:12 }}>
        <td style={{ padding:'8px 10px' }}><input type="checkbox" checked={!!selected} onChange={()=>onSelect(a.id)} style={{ cursor:'pointer' }} /></td>
        <td style={{ padding:'8px 10px', fontFamily:'monospace', color:T.indigo[600] }}>{a.gcc}</td>
        <td style={{ padding:'8px 10px', fontFamily:'monospace', color:T.slate[400] }}>{a.admNo||'—'}</td>
        <td style={{ padding:'8px 10px', fontWeight:700, color:T.slate[800] }}>{a.name}</td>
        <td style={{ padding:'8px 10px' }}>{a.course||'—'}{a.subtype?` · ${a.subtype}`:''}</td>
        <td style={{ padding:'8px 10px' }}>{a.cls||'—'}</td>
        <td style={{ padding:'8px 10px' }}>{a.house||'—'}</td>
        <td style={{ padding:'8px 10px' }}><HostelTypeBadge type={a.hostel_type} /></td>
        <td style={{ padding:'8px 10px' }}>{a.session||'—'}</td>
        <td style={{ padding:'8px 10px' }}><StatusBadge status={a.status} /></td>
        <td style={{ padding:'8px 10px' }}>{a.phone||'—'}</td>
        <td style={{ padding:'8px 6px' }}>
          <div style={{ display:'flex', gap:'4px' }}>
            <button onClick={()=>onDetail(a)} style={{ padding:'3px 8px', borderRadius:5, background:T.sky[50], color:T.sky[600], border:`1px solid ${T.sky[200]}`, fontSize:10, fontWeight:700, cursor:'pointer' }}>View</button>
            <button onClick={()=>onEdit(a)}   style={{ padding:'3px 8px', borderRadius:5, background:T.slate[50], color:T.slate[600], border:`1px solid ${T.slate[200]}`, fontSize:10, fontWeight:700, cursor:'pointer' }}>Edit</button>
          </div>
        </td>
      </tr>
    )
  }

  // ── Grid card mode ──────────────────────────────────────────────────────────
  return (
    <div style={{
      background: N.bg,
      borderRadius: 22,
      overflow: 'hidden',
      boxShadow: selected ? N.inset('md') : N.shadow('lg'),
      transition: 'box-shadow .2s, transform .2s',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      minWidth: 0,
      width: '100%',
    }}
      onMouseEnter={e => { if(!selected){ e.currentTarget.style.boxShadow='8px 8px 20px rgba(174,179,208,0.7), -8px -8px 20px rgba(255,255,255,0.95)'; e.currentTarget.style.transform='translateY(-4px)' } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow=selected?N.inset('md'):N.shadow('lg'); e.currentTarget.style.transform='translateY(0)' }}
    >
      <div style={{ height:4, background: STAT_META[a.status]?.color || N.muted, borderRadius:'22px 22px 0 0' }} />

      {/* Card body */}
      <div style={{ padding:'14px 14px', display:'flex', flexDirection:'column', gap:10, flex:1, minWidth:0 }}>

        {/* Row 1: checkbox + avatar + name + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth:0 }}>
          <input type="checkbox" checked={!!selected} onChange={() => onSelect(a.id)}
            style={{ cursor: 'pointer', flexShrink: 0, marginTop: 4 }} onClick={e => e.stopPropagation()} />
          <Avatar name={a.name} size={42} photoUrl={a.photoUrl} />
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer', overflow:'hidden' }} onClick={() => onDetail(a)}>
  <div style={{ fontWeight: 800, fontSize: 13, color: T.slate[900], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {a.name}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
              {a.gcc   && <span style={{ fontFamily: 'monospace', fontSize: 11, color: T.indigo[500], fontWeight: 700 }}>#{a.gcc}</span>}
              {a.admNo && <span style={{ fontFamily: 'monospace', fontSize: 11, color: T.slate[400] }}>{a.admNo}</span>}
              {a.scholarshipPct > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: T.emerald[50], color: T.emerald[700], fontWeight: 700 }}>🎓 {a.scholarshipPct}%</span>}
              {a.disabilityFlag   && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: T.amber[50],   color: T.amber[700],   fontWeight: 700 }}>♿</span>}
              {a.siblingGcc       && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: T.violet[50],  color: T.violet[700],  fontWeight: 700 }}>👫</span>}
            </div>
          </div>
          <StatusBadge status={a.status} />
        </div>

        {/* Row 2: info grid 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12, color: T.slate[600] }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Course</div>
            <div style={{ fontWeight: 600, color: COURSE_STRUCTURE[a.course]?.color || T.slate[700], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.course || '—'}{a.subtype ? ` · ${a.subtype}` : ''}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Class</div>
            <div style={{ fontWeight: 600 }}>{a.cls || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>House</div>
            <div style={{ fontWeight: 600 }}>{a.house || '—'}{a.bedNumber ? ` · ${a.bedNumber}` : ''}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Session</div>
            <div style={{ fontWeight: 600 }}>{a.session || '—'}</div>
          </div>
        </div>

        {/* Row 3: hostel + fee badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <HostelTypeBadge type={a.hostel_type} />
          {(a.status === 'Admitted' || a.status === 'Enrolled') && (
            admPaid
              ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: T.emerald[50], color: T.emerald[700], border: `1px solid ${T.emerald[300]}`, fontWeight: 700 }}>✓ Fee Paid</span>
              : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: T.amber[50],   color: T.amber[700],   border: `1px solid ${T.amber[300]}`,   fontWeight: 700 }}>⚠ Fee Due</span>
          )}
          {a.docs?.length > 0 && <span style={{ fontSize: 10, color: T.slate[400] }}>{a.docs.length}/{ADM_DOCS.length} docs</span>}
          {followupOverdue && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: T.rose[50], color: T.rose[600], fontWeight: 700, border: `1px solid ${T.rose[200]}` }}>⚠ Follow-up overdue</span>}
          {followupToday   && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: T.amber[50], color: T.amber[600], fontWeight: 700, border: `1px solid ${T.amber[200]}` }}>📅 Today</span>}
          {a.phone && <span style={{ fontSize: 11, color: T.slate[400], marginLeft: 'auto' }}>{a.phone}</span>}
        </div>

        {/* Row 4: action row */}
    
<div style={{ borderTop:`2px solid ${N.bg2}`, paddingTop:8 }}>
  {actionBtn && (
    <div style={{ marginBottom:6 }}>{actionBtn}</div>
  )}
  <div style={{ display:'grid', gridTemplateColumns:canDelete?'repeat(5,1fr)':'repeat(4,1fr)', gap:5 }}>
    {[
      { label:'View',  color:N.sky,    fn:e=>{e.stopPropagation();onDetail(a)} },
      { label:'QEdit', color:N.amber,  fn:e=>{e.stopPropagation();onQuickEdit(a)} },
      { label:'Edit',  color:N.text2,  fn:e=>{e.stopPropagation();onEdit(a)} },
      { label:'WA',    color:'#059669',fn:e=>{e.stopPropagation();onWAMsg(a)} },
      ...(canDelete ? [{ label:'Del', color:N.rose, fn:e=>{e.stopPropagation();onDelete(a.id)} }] : []),
    ].map(b=>(
      <button key={b.label} onClick={b.fn}
        style={{ padding:'6px 4px', borderRadius:8, border:'none', background:N.bg, boxShadow:N.shadow('sm'), color:b.color, fontSize:10, fontWeight:700, cursor:'pointer', textAlign:'center', transition:'box-shadow .12s', width:'100%' }}
        onMouseEnter={e=>e.currentTarget.style.boxShadow=N.inset('sm')}
        onMouseLeave={e=>e.currentTarget.style.boxShadow=N.shadow('sm')}
      >{b.label}</button>
    ))}
  </div>
</div>
      </div>
    </div>
  )
}

// ─── Bulk Action Bar ───────────────────────────────────────────────────────────
function BulkBar({ selected, total, onClear, onBulkStatus, onBulkHouse, onBulkDelete, onBulkEnroll, onBulkExport, onBulkPrint, onBulkWA }) {
  const isMobile = useMobile()
  const [statusVal, setStatusVal] = useState('Under Review')
  const [houseVal,  setHouseVal]  = useState('')

  if (selected.length === 0) return null
  return (
    <div style={{ position:'sticky', bottom:isMobile?6:16, zIndex:100, background:N.text, color:'#fff', borderRadius:isMobile?12:16, padding:isMobile?'10px 12px':'12px 18px', display:'flex', flexDirection:isMobile?'column':'row', alignItems:isMobile?'stretch':'center', gap:isMobile?8:10, flexWrap:'wrap', boxShadow:'0 12px 40px rgba(29,29,31,.35)', margin:isMobile?'8px 0':'14px 0' }}>
      <span style={{ fontSize:12, fontWeight:700 }}>{selected.length} selected</span>
      <button onClick={onClear} style={{ padding:'4px 10px', borderRadius:6, background:'transparent', color:T.slate[300], border:`1px solid ${T.slate[600]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>✕ Clear</button>
      <div style={{ width:1, height:24, background:T.slate[600] }} />
      <select value={statusVal} onChange={e=>setStatusVal(e.target.value)} style={{ ...styles.inp, width:'auto', fontSize:11, padding:'4px 8px', background:T.slate[800], color:'#fff', border:`1px solid ${T.slate[600]}` }}>
        {ADM_STATUSES.map(s=><option key={s}>{s}</option>)}
      </select>
      <button onClick={()=>onBulkStatus(statusVal)} style={{ padding:'5px 12px', borderRadius:7, background:T.violet[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Set Status</button>
      <select value={houseVal} onChange={e=>setHouseVal(e.target.value)} style={{ ...styles.inp, width:'auto', fontSize:11, padding:'4px 8px', background:T.slate[800], color:'#fff', border:`1px solid ${T.slate[600]}` }}>
        <option value="">— House —</option>{HOUSES_LIST.map(h=><option key={h}>{h}</option>)}
      </select>
      <button onClick={()=>houseVal&&onBulkHouse(houseVal)} style={{ padding:'5px 12px', borderRadius:7, background:T.emerald[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Set House</button>
      <div style={{ width:1, height:24, background:T.slate[600] }} />
      <button onClick={onBulkExport} style={{ padding:'5px 12px', borderRadius:7, background:T.sky[600],    color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>📥 CSV</button>
      <button onClick={onBulkPrint}  style={{ padding:'5px 12px', borderRadius:7, background:T.indigo[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>🖨 Print</button>
      <button onClick={onBulkWA}     style={{ padding:'5px 12px', borderRadius:7, background:'#25D366',     color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>📲 WA Blast</button>
      <button onClick={onBulkDelete} style={{ padding:'5px 12px', borderRadius:7, background:T.rose[600],   color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>🗑 Delete</button>
    </div>
  )
}

// ─── CSV Import Modal ──────────────────────────────────────────────────────────
function CSVImportModal({ onClose, onImport }) {
  const [raw,     setRaw]     = useState('')
  const [parsed,  setParsed]  = useState([])
  const [error,   setError]   = useState('')

  const parseCSV = text => {
    try {
      const lines = text.trim().split('\n').filter(Boolean)
      if (lines.length < 2) { setError('Need header + at least 1 row'); return }
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,'').toLowerCase().replace(/\s+/g,'_'))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''))
        const obj = {}
        headers.forEach((h,i) => obj[h] = vals[i] || '')
        return {
          name:       obj.name || obj.applicant_name || '',
          gcc:        obj.gcc_no || obj.gcc || '',
          gender:     obj.gender || '',
          dob:        obj.dob || '',
          course:     obj.course || '',
          cls:        obj.batch || obj.class || '',
          house:      obj.house || '',
          hostel_type:obj.hostel_type || 'Day Scholar',
          session:    obj.session || '',
          phone:      obj.phone || '',
          father:     obj.father_name || obj.father || '',
          status:     obj.status || 'Applied',
        }
      }).filter(r => r.name && r.gcc)
      setParsed(rows)
      setError('')
    } catch(e) { setError('Parse error: ' + e.message) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:24, width:'100%', maxWidth:640, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>📥 CSV Import</div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, border:`1px solid ${T.slate[200]}`, background:'#fff', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ fontSize:12, color:T.slate[500], marginBottom:8 }}>
          Paste CSV with headers: name, gcc_no, gender, dob, course, batch, house, hostel_type, session, phone, father_name, status
        </div>
        <textarea value={raw} onChange={e=>setRaw(e.target.value)} rows={8} style={{ ...styles.inp, fontFamily:'monospace', fontSize:11 }} placeholder="Paste CSV here…" />
        {error && <div style={{ color:T.rose[600], fontSize:12, marginTop:4 }}>{error}</div>}
        <div style={{ display:'flex', gap:10, marginTop:10 }}>
          <button onClick={()=>parseCSV(raw)} style={{ padding:'9px 18px', borderRadius:9, background:T.indigo[600], color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer' }}>Parse</button>
          {parsed.length > 0 && (
            <button onClick={()=>onImport(parsed)} style={{ padding:'9px 18px', borderRadius:9, background:T.emerald[600], color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer' }}>Import {parsed.length} rows</button>
          )}
          <button onClick={onClose} style={{ padding:'9px 16px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:T.slate[600] }}>Cancel</button>
        </div>
        {parsed.length > 0 && (
          <div style={{ marginTop:12, maxHeight:160, overflowY:'auto', border:`1px solid ${T.slate[200]}`, borderRadius:8, fontSize:11 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:T.slate[50] }}>{['GCC','Name','Course','House','Status'].map(h=><th key={h} style={{ padding:'6px 8px', textAlign:'left', color:T.slate[500] }}>{h}</th>)}</tr></thead>
              <tbody>{parsed.map((r,i)=><tr key={i} style={{ borderTop:`1px solid ${T.slate[100]}` }}><td style={{ padding:'5px 8px' }}>{r.gcc}</td><td style={{ padding:'5px 8px' }}>{r.name}</td><td style={{ padding:'5px 8px' }}>{r.course}</td><td style={{ padding:'5px 8px' }}>{r.house}</td><td style={{ padding:'5px 8px' }}>{r.status}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Saved Filter Presets ──────────────────────────────────────────────────────
const PRESET_KEY = 'gnsi_adm_presets'
function useFilterPresets() {
  const [presets, setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY)||'{}') } catch { return {} }
  })
  const save = (name, filters) => {
    const next = { ...presets, [name]: filters }
    setPresets(next)
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(next)) } catch(_) {}
  }
  const remove = name => {
    const next = { ...presets }; delete next[name]
    setPresets(next)
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(next)) } catch(_) {}
  }
  return { presets, save, remove }
}

// ─── Sort Control ──────────────────────────────────────────────────────────────
function SortControl({ sortBy, sortDir, onChange }) {
  const options = [
    { label:'GCC No.',  key:'gcc'        },
    { label:'Name',     key:'name'       },
    { label:'Date',     key:'created_at' },
    { label:'Status',   key:'status'     },
    { label:'Session',  key:'session'    },
  ]
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:11, fontWeight:700, color:T.slate[400], textTransform:'uppercase' }}>Sort</span>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key, sortBy===o.key&&sortDir==='asc'?'desc':'asc')}
          style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:600, cursor:'pointer', border:`1.5px solid ${sortBy===o.key?T.indigo[400]:T.slate[200]}`, background:sortBy===o.key?T.indigo[50]:'#fff', color:sortBy===o.key?T.indigo[600]:T.slate[500] }}>
          {o.label}{sortBy===o.key?(sortDir==='asc'?' ↑':' ↓'):''}
        </button>
      ))}
    </div>
  )
}
// ─── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ apps, cols, darkMode }) {
  const [activeTab, setActiveTab] = useState('overview')
  const bg   = darkMode ? T.slate[800] : '#fff'
  const bd   = darkMode ? T.slate[700] : T.slate[200]
  const tx   = darkMode ? T.slate[100] : T.slate[800]
  const today = new Date().toISOString().slice(0,10)

  const byStatus = s => apps.filter(a => a.status === s).length
  const total    = apps.length
  const enrolled = byStatus('Enrolled')
  const admitted = byStatus('Admitted')
  const revenue  = apps.filter(a => a.status === 'Enrolled')
                       .reduce((s, a) => s + getFlatFeeAmtSync(a.hostel_type, a.course), 0)

  const admitRate  = total > 0 ? Math.round((admitted + enrolled) / total * 100) : 0
  const enrollRate = (admitted + enrolled) > 0
    ? Math.round(enrolled / (admitted + enrolled) * 100) : 0

  const days      = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i); return d
  })
  const dayCounts = days.map(d =>
    apps.filter(a => a.created_at?.slice(0, 10) === d.toISOString().slice(0, 10)).length
  )

  const houseFill = HOUSES_LIST.filter(h => h !== 'Day Scholar').map(h => ({
    name: h,
    count: apps.filter(a => a.house === h).length,
    cap: HOUSE_CAPACITIES[h] || 40,
  }))

  const overdue  = apps.filter(a => a.followupDate && a.followupDate < today)
  const dueToday = apps.filter(a => a.followupDate === today)
  const upcoming = apps.filter(a => a.followupDate && a.followupDate > today)

  const metric = (label, value, accent, sub) => (
    <div style={{ background: darkMode ? T.slate[700] : T.slate[50], borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || tx, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.slate[400], marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const funnelBar = (label, count, color) => {
    const pct = total > 0 ? Math.round(count / total * 100) : 0
    return (
      <div key={label} style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: T.slate[500], marginBottom: 3 }}>
          <span>{label}</span><span>{count} ({pct}%)</span>
        </div>
        <div style={{ height: 7, borderRadius: 99, background: T.slate[100], overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width .4s' }} />
        </div>
      </div>
    )
  }

  const tabs = ['Overview', 'Funnel', 'Hostel & House', 'Follow-ups']

  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: T.slate[100], borderRadius: 9, padding: 3, width: 'fit-content', maxWidth:'100%', overflowX:'auto' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t.toLowerCase().replace(/[^a-z]/g, ''))}
            style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: activeTab === t.toLowerCase().replace(/[^a-z]/g,'') ? '#fff' : 'transparent',
              color: activeTab === t.toLowerCase().replace(/[^a-z]/g,'') ? T.slate[800] : T.slate[400],
              boxShadow: activeTab === t.toLowerCase().replace(/[^a-z]/g,'') ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
          {metric('Total', total, undefined, `₹${fmt(revenue)}/mo`)}
          {metric('Enrolled', enrolled, T.emerald[600])}
          {metric('Admitted', admitted, T.violet[600])}
          {metric('Under Review', byStatus('Under Review'), T.amber[600])}
          {metric('Rejected', byStatus('Rejected'), T.rose[600])}
          {metric('Waitlisted', byStatus('Waitlisted'), T.slate[400])}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(260px,100%),1fr))', gap: 12 }}>
          <div style={{ padding: 14, border: `1px solid ${bd}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', marginBottom: 10 }}>By Course</div>
            {Object.keys(COURSE_STRUCTURE).map(c =>
              funnelBar(c, apps.filter(a => a.course === c).length, COURSE_STRUCTURE[c].color)
            )}
          </div>
          <div style={{ padding: 14, border: `1px solid ${bd}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', marginBottom: 10 }}>Daily (7 days)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
              {dayCounts.map((v, i) => {
                const max = Math.max(...dayCounts, 1)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: '100%', background: T.indigo[400], borderRadius: 3, height: `${(v / max) * 64}px`, minHeight: v > 0 ? 4 : 0, transition: 'height .4s' }} />
                    <span style={{ fontSize: 9, color: T.slate[300] }}>{days[i]?.toLocaleDateString('en-IN',{weekday:'short'})}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </>}

      {/* ── Funnel ── */}
      {activeTab === 'funnel' && <div style={{ padding: 4 }}>
        {[['Applied',byStatus('Applied'),T.indigo[500]],['Under Review',byStatus('Under Review'),T.amber[500]],['Admitted',admitted,T.violet[500]],['Enrolled',enrolled,T.emerald[500]],['Rejected',byStatus('Rejected'),T.rose[500]]].map(([l,v,c]) => funnelBar(l,v,c))}
        <div style={{ marginTop: 14, fontSize: 12, color: T.slate[500] }}>
          Admit rate: <strong style={{ color: T.violet[600] }}>{admitRate}%</strong> &nbsp;·&nbsp;
          Enroll rate: <strong style={{ color: T.emerald[600] }}>{enrollRate}%</strong>
        </div>
      </div>}

      {/* ── Hostel & House ── */}
      {activeTab === 'hostelhouseandhouse' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap: 12, marginBottom: 14 }}>
          {HOSTEL_TYPES.map(h => {
            const count = apps.filter(a => a.hostel_type === h).length
            const rev   = apps.filter(a => a.status === 'Enrolled' && a.hostel_type === h).reduce((s, a) => s + getFlatFeeAmtSync(h, a.course), 0)
            const s = HOSTEL_STYLES[h]
            return (
              <div key={h} style={{ padding: 14, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10 }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon} {h}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{count}</div>
                <div style={{ fontSize: 11, color: s.color, marginTop: 2 }}>₹{fmt(rev)}/mo revenue</div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', marginBottom: 8 }}>House Fill Rate</div>
        {houseFill.map(({ name, count, cap }) => {
          const pct = Math.round(count / cap * 100)
          const col = pct >= 90 ? T.rose[500] : pct >= 70 ? T.amber[500] : T.emerald[500]
          return (
            <div key={name} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: T.slate[500], marginBottom: 2 }}>
                <span>{name}</span><span style={{ color: col }}>{count}/{cap}</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: T.slate[100], overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col, borderRadius: 99 }} />
              </div>
            </div>
          )
        })}
      </>}

      {/* ── Follow-ups ── */}
      {activeTab === 'followups' && <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[[`${overdue.length} Overdue`, T.rose[600], T.rose[50]], [`${dueToday.length} Today`, T.amber[600], T.amber[50]], [`${upcoming.length} Upcoming`, T.sky[600], T.sky[50]]].map(([l, c, bg]) => (
            <span key={l} style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, color: c, background: bg }}>{l}</span>
          ))}
        </div>
        {[['Overdue', overdue, T.rose[600]], ['Due Today', dueToday, T.amber[600]], ['Upcoming (7 days)', upcoming.slice(0,7), T.sky[600]]].map(([heading, list, accent]) => (
          <div key={heading} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.slate[400], textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>{heading}</div>
            {list.length === 0
              ? <div style={{ fontSize: 12, color: T.slate[300] }}>None</div>
              : list.map(a => (
                <div key={a.gcc} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: T.slate[50], borderRadius: 7, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, flex: 1, color: tx }}>{a.name}</span>
                  <StatusBadge status={a.status} />
                  <span style={{ color: accent, fontWeight: 700 }}>{dateFmt(a.followupDate)}</span>
                </div>
              ))
            }
          </div>
        ))}
      </>}
    </div>
  )
}
// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Admissions() {
  const isMobile = useMobile()
  const isTablet = useTablet()
  const [apps,           setApps]          = useState([])
  const [cols,           setCols]          = useState([])
  const [loading,        setLoading]       = useState(true)
  const [search,         setSearch]        = useState('')
  const [filterStatus,   setFilter]        = useState('All')
  const [filterSession,  setSession]       = useState('All')
  const [filterCourse,   setCourse]        = useState('All')
  const [filterSubtype,  setSubtype]       = useState('All')
  const [filterHostel,   setHostel]        = useState('All')
  const [filterHouse,    setFilterHouse]   = useState('All')
  const [advFilters,     setAdvFilters]    = useState({})
  const [sortBy,         setSortBy]        = useState('gcc')
  const [sortDir,        setSortDir]       = useState('desc')
  const [formOpen,       setFormOpen]      = useState(false)
  const [editing,        setEditing]       = useState(null)
  const [feePanel,       setFeePanel]      = useState(null)
  const [toast,          setToast]         = useState(null)
  const [selectedIds,    setSelectedIds]   = useState(new Set())
  const [showAnalytics,  setShowAnalytics] = useState(false)
  const [showReports,    setShowReports]   = useState(false)
  const [showAdvSearch,  setShowAdvSearch] = useState(false)
  const [detailApp,      setDetailApp]     = useState(null)
  const [quickEditApp,   setQuickEditApp]  = useState(null)
  const [waBlastApps,    setWABlastApps]   = useState(null)
  const [showCSVImport,  setShowCSVImport] = useState(false)
  const [tableMode,      setTableMode]     = useState(false)
  const [darkMode,       setDarkMode]      = useState(false)
  const [showPresets,    setShowPresets]   = useState(false)
  const searchRef = useRef(null)

  const { session: activeSession } = useActiveSession()
  const { housemastersByHouse } = useActiveHousemasters()
  const { presets, save: savePreset, remove: removePreset } = useFilterPresets()
  const userRole = useUserRole()

  const showToast = (msg, color, undoFn) => {
    setToast({ msg, color, undoFn })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    document.body.style.background = darkMode ? T.slate[900] : PAGE_BG
    return () => { document.body.style.background = '' }
  }, [darkMode])

  useKeyboardShortcuts({
    onNew:        () => { setEditing(null); setFormOpen(true) },
    onSearch:     () => searchRef.current?.focus(),
    onEscape:     () => { setFormOpen(false); setEditing(null); setDetailApp(null); setQuickEditApp(null); setShowAdvSearch(false) },
    onToggleView: () => setTableMode(v => !v),
    onToggleDark: () => setDarkMode(v => !v),
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [appsData, colsRows] = await Promise.all([
      sbApps.fetch(),
      fetchAllRows('adm_fee_collections', { orderCol: 'created_at', ascending: false }),
    ])
    if (appsData) setApps(appsData)
    setCols(colsRows)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft && !editing) {
        const parsed = JSON.parse(draft)
        if (parsed.name) showToast(`Draft restored: ${parsed.name}`, T.amber[600])
      }
    } catch(_) {}
  }, [])

  const sessionOptions = useMemo(() => [...new Set(apps.map(a=>a.session).filter(Boolean))].sort().reverse(), [apps])
  const courseOptions  = useMemo(() => [...new Set(apps.map(a=>a.course).filter(Boolean))].sort(), [apps])
  const subtypeOptions = useMemo(() => {
    const src = filterCourse !== 'All' ? apps.filter(a=>a.course===filterCourse) : apps
    return [...new Set(src.map(a=>a.subtype).filter(Boolean))].sort()
  }, [apps, filterCourse])

  useEffect(() => { setSubtype('All') }, [filterCourse])

  const duplicateGCCs = useMemo(() => {
    const seen = {}; const dups = new Set()
    apps.forEach(a => {
      const key = [a.name?.toLowerCase(), a.dob, a.phone].filter(Boolean).join('|')
      if (key.length > 2) {
        if (seen[key]) dups.add(a.gcc).add(seen[key])
        else seen[key] = a.gcc
      }
    })
    return dups
  }, [apps])

  const waitlistPositions = useMemo(() => {
    const wl = apps.filter(a=>a.status==='Waitlisted')
    const pos = {}; wl.forEach((a,i) => pos[a.gcc] = i+1)
    return pos
  }, [apps])

  const houseCounts = useMemo(() => {
    const c = {}; HOUSES_LIST.forEach(h => c[h] = 0)
    apps.forEach(a => { if (a.house) c[a.house] = (c[a.house]||0)+1 })
    return c
  }, [apps])

  const today = new Date().toISOString().slice(0,10)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = apps.filter(a => {
      const matchStatus  = filterStatus  === 'All' || a.status      === filterStatus
      const matchSession = filterSession === 'All' || a.session     === filterSession
      const matchCourse  = filterCourse  === 'All' || a.course      === filterCourse
      const matchSubtype = filterSubtype === 'All' || a.subtype     === filterSubtype
      const matchHostel  = filterHostel  === 'All' || a.hostel_type === filterHostel
      const matchHouse   = filterHouse   === 'All' || a.house       === filterHouse
      const matchSearch  = !q || [a.name,a.phone,a.admNo,a.gcc,a.cls,a.house,a.father,a.course,a.subtype,a.session,a.hostel_type,a.whatsapp,a.mother,a.prevSchool]
        .some(f => f?.toString().toLowerCase().includes(q))

      const af = advFilters
      const matchGender   = !af.gender  || a.gender   === af.gender
      const matchCategory = !af.category|| a.category === af.category
      const matchReligion = !af.religion|| a.religion === af.religion
      const matchQuota    = !af.quota   || a.quota    === af.quota
      const matchHouseAdv = !af.house   || a.house    === af.house
      const matchDobFrom  = !af.dobFrom || (a.dob && a.dob >= af.dobFrom)
      const matchDobTo    = !af.dobTo   || (a.dob && a.dob <= af.dobTo)
      const matchDis      = !af.disability || (af.disability==='yes'?a.disabilityFlag:!a.disabilityFlag)
      const matchSchol    = !af.scholarship|| (af.scholarship==='yes'?a.scholarshipPct>0:!a.scholarshipPct)
      const matchFollowup = !af.followupStatus || (() => {
        if (!a.followupDate) return false
        if (af.followupStatus === 'overdue')  return a.followupDate < today
        if (af.followupStatus === 'today')    return a.followupDate === today
        if (af.followupStatus === 'upcoming') return a.followupDate > today
        return true
      })()
      const matchDocStatus= !af.docStatus || (() => {
        if (af.docStatus==='complete')   return a.docs?.length === ADM_DOCS.length
        if (af.docStatus==='missing_tc') return !a.docs?.includes('Transfer Certificate')
        if (af.docStatus==='incomplete') return a.docs?.length < ADM_DOCS.length
        return true
      })()
      const matchFeeStatus= !af.feeStatus || (() => {
        const paid = cols.some(c=>String(parseInt(c.adm_app_id))===String(parseInt(a.gcc))&&c.fee_type==='admission')
        return af.feeStatus==='paid' ? paid : !paid
      })()

      return matchStatus&&matchSession&&matchCourse&&matchSubtype&&matchHostel&&matchHouse&&matchSearch&&matchGender&&matchCategory&&matchReligion&&matchQuota&&matchHouseAdv&&matchDobFrom&&matchDobTo&&matchDis&&matchSchol&&matchFollowup&&matchDocStatus&&matchFeeStatus
    })

    list = [...list].sort((a,b) => {
      let va = a[sortBy], vb = b[sortBy]
      if (sortBy==='gcc') { va=parseInt(va)||0; vb=parseInt(vb)||0 }
      if (va < vb) return sortDir==='asc'?-1:1
      if (va > vb) return sortDir==='asc'?1:-1
      return 0
    })
    return list
  }, [apps, search, filterStatus, filterSession, filterCourse, filterSubtype, filterHostel, filterHouse, advFilters, sortBy, sortDir, cols, today])

  const activeFilters = [filterStatus,filterSession,filterCourse,filterSubtype,filterHostel,filterHouse].filter(f=>f!=='All').length + Object.keys(advFilters).filter(k=>advFilters[k]).length
  const clearAll = () => { setFilter('All');setSession('All');setCourse('All');setSubtype('All');setHostel('All');setFilterHouse('All');setAdvFilters({});setSearch('') }

  const toggleSelect = id => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(a=>a.id)))
  }
  const clearSelection = () => setSelectedIds(new Set())
  const selectedApps = filtered.filter(a=>selectedIds.has(a.id))

  const handleSave = async (eid, obj) => {
    // 🔒 Authorization
    if (!checkPermission(userRole, eid ? 'update' : 'create')) {
      showToast('🚫 You do not have permission to '+(eid?'edit':'create')+' applications', T.rose[600]); return
    }
    // 🔒 Validation
    if (!obj.name?.trim())           { showToast('Name is required', T.rose[600]); return }
    if (!obj.gcc?.toString().trim()) { showToast('GCC No. is required', T.rose[600]); return }
    const valErrors = validateApplicationData(obj)
    if (valErrors) { showToast(Object.values(valErrors)[0], T.rose[600]); return }
    if (activeSession?.is_locked) { showToast('🔒 Session locked. No changes allowed.', T.rose[600]); return }

    // 🔒 Sanitization (defense-in-depth — strips HTML brackets, caps length)
    const cleanObj = sanitizeApplicationData(obj)

    const sessionName = (!eid && activeSession) ? activeSession.session_name : cleanObj.session
    const dbRow = mapToDB({ ...cleanObj, session: sessionName })

    if (eid) {
      const { error } = await supabase.from('admissions').update(dbRow).eq('gcc_no', parseInt(eid))
      if (error) { showToast('Update failed: '+error.message, T.rose[600]); return }
      logAudit('UPDATE', eid, dbRow, userRole)
      try {
        const log = JSON.parse(localStorage.getItem('gnsi_audit_'+eid)||'[]')
        log.unshift({ ts:now(), action:'edit', by:userRole, changes: JSON.stringify(dbRow).slice(0,200) })
        localStorage.setItem('gnsi_audit_'+eid, JSON.stringify(log.slice(0,50)))
      } catch(_) {}
      setApps(prev => prev.map(a => String(a.id)===String(eid) ? { ...a, ...cleanObj, id:parseInt(eid), hostel_type:dbRow.hostel_type } : a))
      showToast('Application updated', T.amber[600])
    } else {
      const { data, error } = await supabase.from('admissions').insert(dbRow).select().single()
      if (error) {
        if (error.code==='23505') showToast(`GCC No. ${cleanObj.gcc} already exists`, T.rose[600])
        else showToast('Save failed: '+error.message, T.rose[600])
        return
      }
      const newApp = mapFromDB(data)
      logAudit('CREATE', newApp.id, dbRow, userRole)
      setApps(prev => [newApp, ...prev])
      showToast(`Saved! Adm. No: ${newApp.admNo} · ${newApp.hostel_type} · ₹${fmt(getFlatFeeAmtSync(newApp.hostel_type, newApp.course))}/mo`, T.violet[600])
    }
    try { localStorage.removeItem(DRAFT_KEY) } catch(_) {}
    setFormOpen(false); setEditing(null)
  }

  const handleAdmit = async id => {
    if (!confirm('Mark as Admitted?')) return
    const { error } = await supabase.from('admissions').update({ status:'Admitted' }).eq('gcc_no', parseInt(id))
    if (error) { showToast('Update failed: '+error.message, T.rose[600]); return }
    setApps(prev => prev.map(a => String(a.id)===String(id) ? { ...a, status:'Admitted' } : a))
    showToast('Marked as Admitted', T.violet[600])
  }

  const handleEnroll = async id => {
    const a = apps.find(x => String(x.id)===String(id))
    if (!a) return
    const admPaid = cols.some(c=>String(parseInt(c.adm_app_id))===String(parseInt(a.gcc))&&c.fee_type==='admission')
    if (!admPaid) { showToast('⚠ Collect admission fee first', T.rose[600]); setFeePanel(a); return }
    if (!confirm(`Enroll ${a.name} as a student?`)) return
    try {
      // 🔗 House capacity is checked INSIDE promoteToStudent (feeEngine.js),
      // sourced live from the real `houses` table + Hostel.jsx's student
      // data — not from a hardcoded constant. We deliberately call this
      // BEFORE flipping admissions.status to 'Enrolled' below: if the house
      // is full, promoteToStudent throws and we bail out here with the
      // admission still sitting at its previous status, untouched. Doing
      // the status flip first (the old order) would have left a record
      // marked "Enrolled" with no student row and no seat — a worse,
      // harder-to-spot inconsistency than just stopping early.
      const { created, houseWarning } = await promoteToStudent(a)

      const { error: admErr } = await supabase.from('admissions').update({ status:'Enrolled' }).eq('gcc_no', parseInt(id))
      if (admErr) throw admErr

      setApps(prev => prev.map(x => String(x.id)===String(id) ? { ...x, status:'Enrolled' } : x))
      showToast(created ? `✅ ${a.name} enrolled & student record created!` : `✅ ${a.name} enrolled (student already existed)`, T.emerald[600])
      if (houseWarning) showToast(`⚠ ${houseWarning}`, T.amber[600])
    } catch(err) { showToast('Enroll failed: '+err.message, T.rose[600]) }
  }


  const handleDelete = async id => {
    // 🔒 Authorization
    if (!checkPermission(userRole, 'delete')) {
      showToast('🚫 You do not have permission to delete applications', T.rose[600]); return
    }
    const a = apps.find(x => String(x.id)===String(id))
    if (!confirm(`Delete admission for ${a?.name}?`)) return
    const snapshot = { ...a }
    setApps(prev => prev.filter(x => String(x.id)!==String(id)))

    let deleted = false
    showToast(`Deleted ${a?.name}`, T.rose[600], () => {
      deleted = true
      setApps(prev => [snapshot, ...prev])
    })
    setTimeout(async () => {
      if (!deleted) {
        const { error } = await supabase.from('admissions').delete().eq('gcc_no', parseInt(id))
        if (error) { setApps(prev => [snapshot, ...prev]); showToast('Delete failed: '+error.message, T.rose[600]) }
        else logAudit('DELETE', id, { name: snapshot.name, gcc: snapshot.gcc }, userRole)
      }
    }, 5000)
  }

  const handleQuickEdit = async (id, changes) => {
    const hostelType = deriveHostelType(changes.house, changes.hostel_type)
    const { error } = await supabase.from('admissions').update({
      status: changes.status,
      house:  changes.house,
      hostel_type: hostelType,
      followup_date: changes.followupDate || null,
      bed_number:    changes.bedNumber || null,
    }).eq('gcc_no', parseInt(id))
    if (error) { showToast('Quick edit failed', T.rose[600]); return }
    setApps(prev => prev.map(a => String(a.id)===String(id) ? { ...a, ...changes, hostel_type:hostelType } : a))
    setQuickEditApp(null)
    showToast('Updated', T.emerald[600])
  }

  const handleAddNote = (id, text) => {
    const key = 'gnsi_notes_'+id
    try {
      const notes = JSON.parse(localStorage.getItem(key)||'[]')
      notes.unshift({ ts:now(), by:'Staff', text })
      localStorage.setItem(key, JSON.stringify(notes.slice(0,100)))
      setApps(prev => prev.map(a => String(a.id)===String(id) ? { ...a, notes } : a))
      showToast('Note added', T.emerald[600])
    } catch(_) {}
  }

  const handleBulkStatus = async status => {
    if (!checkPermission(userRole, 'bulk')) { showToast('🚫 You do not have permission for bulk actions', T.rose[600]); return }
    try { RateLimiter.check('bulk_status', 8, 60000) } catch(e) { showToast(e.message, T.rose[600]); return }
    if (selectedIds.size > MAX_BULK_OPERATION_SIZE) { showToast(`Max ${MAX_BULK_OPERATION_SIZE} records per bulk action`, T.rose[600]); return }
    if (!confirm(`Set ${selectedIds.size} applicants to "${status}"?`)) return
    const ids = [...selectedIds]
    const { error } = await supabase.from('admissions').update({ status }).in('gcc_no', ids.map(Number))
    if (error) { showToast('Bulk update failed', T.rose[600]); return }
    logAudit('BULK_STATUS', null, { ids, status }, userRole)
    setApps(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, status } : a))
    showToast(`${ids.length} applicants set to ${status}`, T.violet[600])
    clearSelection()
  }

  const handleBulkHouse = async house => {
    if (!checkPermission(userRole, 'bulk')) { showToast('🚫 You do not have permission for bulk actions', T.rose[600]); return }
    try { RateLimiter.check('bulk_house', 8, 60000) } catch(e) { showToast(e.message, T.rose[600]); return }
    if (selectedIds.size > MAX_BULK_OPERATION_SIZE) { showToast(`Max ${MAX_BULK_OPERATION_SIZE} records per bulk action`, T.rose[600]); return }
    if (!confirm(`Set house "${house}" for ${selectedIds.size} applicants?`)) return
    const ids = [...selectedIds]; const ht = DAY_SCHOLAR_HOUSES.includes(house)?'Day Scholar':'Boarder'
    const { error } = await supabase.from('admissions').update({ house, hostel_type:ht }).in('gcc_no', ids.map(Number))
    if (error) { showToast('Bulk house update failed', T.rose[600]); return }
    logAudit('BULK_HOUSE', null, { ids, house }, userRole)
    setApps(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, house, hostel_type:ht } : a))
    showToast(`${ids.length} applicants assigned to ${house}`, T.emerald[600])
    clearSelection()
  }

  const handleBulkDelete = async () => {
    if (!checkPermission(userRole, 'bulk') && !checkPermission(userRole, 'delete')) {
      showToast('🚫 You do not have permission for bulk delete', T.rose[600]); return
    }
    try { RateLimiter.check('bulk_delete', 5, 60000) } catch(e) { showToast(e.message, T.rose[600]); return }
    if (selectedIds.size > MAX_BULK_OPERATION_SIZE) { showToast(`Max ${MAX_BULK_OPERATION_SIZE} records per bulk delete`, T.rose[600]); return }
    if (!confirm(`Delete ${selectedIds.size} selected applicants? You will have 5 seconds to undo.`)) return
    const ids = [...selectedIds]
    const snapshots = apps.filter(a => selectedIds.has(a.id))
    setApps(prev => prev.filter(a => !selectedIds.has(a.id)))
    clearSelection()
    let cancelled = false
    showToast(`${ids.length} records deleted`, T.rose[600], () => {
      cancelled = true
      setApps(prev => [...snapshots, ...prev])
    })
    setTimeout(async () => {
      if (cancelled) return
      const { error } = await supabase.from('admissions').delete().in('gcc_no', ids.map(Number))
      if (error) { setApps(prev => [...snapshots, ...prev]); showToast('Bulk delete failed: '+error.message, T.rose[600]) }
      else logAudit('BULK_DELETE', null, { ids, names: snapshots.map(s=>s.name) }, userRole)
    }, 5000)
  }

  const handleCSVImport = async rows => {
    setShowCSVImport(false)
    let ok=0, fail=0, skipped=0
    const existingGCCs = new Set(apps.map(a=>String(a.gcc)))
    for (const r of rows) {
      if (existingGCCs.has(String(r.gcc))) { skipped++; continue }
      const dbRow = mapToDB(r)
      const { error } = await supabase.from('admissions').insert(dbRow)
      if (error) fail++; else ok++
    }
    await loadAll()
    showToast(`Imported ${ok}${skipped>0?`, ${skipped} skipped (duplicate GCC)`:''}${fail>0?`, ${fail} failed`:''}`, ok>0?T.emerald[600]:T.rose[600])
  }

  const handleAutoAssignHouse = async () => {
    if (!checkPermission(userRole, 'bulk')) { showToast('🚫 You do not have permission for this action', T.rose[600]); return }
    const unassigned = filtered.filter(a=>!a.house||a.house==='Day Scholar')
    if (!unassigned.length) { showToast('No unassigned boarder records', T.amber[600]); return }
    const boarderHouses = HOUSES_LIST.filter(h=>!DAY_SCHOLAR_HOUSES.includes(h))
    let ok=0, fail=0
    for (let i=0; i<unassigned.length; i++) {
      const house = boarderHouses[i % boarderHouses.length]
      const { error } = await supabase.from('admissions').update({ house, hostel_type:'Boarder' }).eq('gcc_no', parseInt(unassigned[i].id))
      if (error) fail++; else ok++
    }
    await loadAll()
    showToast(fail>0 ? `Auto-assigned ${ok}, failed ${fail}` : `Auto-assigned houses for ${ok} students`, fail>0?T.rose[600]:T.emerald[600])
  }

  // 🔒 Secure export wrapper — requires permission + explicit consent before
  // any CSV containing phone numbers leaves the browser.
  const secureExport = (rows, filename) => {
    if (!checkPermission(userRole, 'export')) { showToast('🚫 You do not have permission to export data', T.rose[600]); return }
    const ok = window.confirm(
      `Export ${rows.length} record(s) to CSV?\n\nThis file will contain phone numbers and addresses unencrypted on your device. Keep it secure.`
    )
    if (!ok) return
    logAudit('EXPORT', null, { count: rows.length, filename }, userRole)
    downloadCSV(toCSV(rows), filename)
  }

  // 🔒 Secure WhatsApp blast wrapper — requires permission + consent.
  const secureWABlast = (appsToSend) => {
    if (!checkPermission(userRole, 'wa')) { showToast('🚫 You do not have permission to send WhatsApp messages', T.rose[600]); return }
    const ok = window.confirm(
      `Send WhatsApp message to ${appsToSend.length} recipient(s)?\n\nMake sure you have consent to contact them.`
    )
    if (!ok) return
    logAudit('WA_BLAST', null, { count: appsToSend.length, gccs: appsToSend.map(a=>a.gcc) }, userRole)
    setWABlastApps(appsToSend)
  }

  // 🔒 Secure print wrapper — printing exposes the same data as export, so it
  // shares the export permission gate (no extra consent needed — it's a
  // physical document under staff control, but still logged for audit).
  const securePrint = (appsToPrint) => {
    if (!checkPermission(userRole, 'export')) { showToast('🚫 You do not have permission to print lists', T.rose[600]); return }
    logAudit('PRINT', null, { count: appsToPrint.length }, userRole)
    printBulkList(appsToPrint)
  }

  const byStatus = {}
  ADM_STATUSES.forEach(s => byStatus[s]=0)
  apps.forEach(a => byStatus[a.status] = (byStatus[a.status]||0)+1)

  const monthlyRevenue = apps.filter(a=>a.status==='Enrolled').reduce((s,a)=>s+getFlatFeeAmtSync(a.hostel_type, a.course),0)

  const bg   = darkMode ? T.slate[900] : T.slate[50]
  const card = darkMode ? T.slate[800] : '#fff'
  const tx   = darkMode ? T.slate[100] : T.slate[900]

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:14, color:T.slate[500], fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:22, height:22, border:`2.5px solid ${T.slate[200]}`, borderTopColor:T.indigo[600], borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <span style={{ fontWeight:600 }}>Loading admissions…</span>
    </div>
  )

  return (
    <>
      {feePanel && (
        <FeeCollectionModal app={feePanel} isAdmin={checkPermission(userRole,'delete')} currentUser={getSessionInfo()} onClose={()=>setFeePanel(null)} onSaved={()=>{ setFeePanel(null); loadAll(); showToast('Payment recorded!','#059669') }} />
      )}
      {waBlastApps && <WABlastModal apps={waBlastApps} onClose={()=>setWABlastApps(null)} />}
      {showCSVImport && <CSVImportModal onClose={()=>setShowCSVImport(false)} onImport={handleCSVImport} />}

      <div style={{ padding:'0 12px 40px', fontFamily:"'Inter',system-ui,sans-serif", background: darkMode ? T.slate[900] : PAGE_BG, minHeight:'100vh', color:N.text, transition:'background .2s', overflowX:'hidden', maxWidth:'100vw' }}>
        <style>{`
  @keyframes spin { to { transform:rotate(360deg) } }
  @keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(10,128,66,.18)} 50%{box-shadow:0 0 0 7px rgba(10,128,66,.06)} }
  * { box-sizing:border-box; }
  select:focus, input:focus, textarea:focus {
    box-shadow: 0 0 0 3px rgba(29,29,31,.12) !important;
    border-color: rgba(29,29,31,.3) !important;
    outline:none;
  }
  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:${N.bg2}; }
  ::-webkit-scrollbar-thumb { background:rgba(29,29,31,.25); border-radius:99px; }
`}</style>

        {toast && <Toast msg={toast.msg} color={toast.color} onUndo={toast.undoFn} />}

        {/* ── Identity header (matches Accounts module banking style) ── */}
        <div style={{ paddingTop: isMobile?'14px':'20px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{
            width:40, height:40, borderRadius:'10px',
            background:'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ width:20, height:20 }}>
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize:16, fontWeight:600, lineHeight:1.3, margin:0, color:tx }}>GNSI Admissions</p>
            <p style={{ fontSize:13, color:T.slate[400], lineHeight:1.3, margin:0 }}>Application management &amp; enrollment</p>
          </div>
        </div>

        {/* ── Dark gradient stats card (Accounts-style treasury card) ── */}
        <div style={{
          position:'relative', borderRadius:16, padding:isMobile?'16px':'20px 24px', marginBottom:18,
          color:'#fff', overflow:'hidden',
          background:'linear-gradient(135deg, #1D1D1F 0%, #2C2C2E 50%, #1D1D1F 100%)',
          boxShadow:'0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.10)',
        }}>
          <div style={{ position:'absolute', top:'-60%', right:'-20%', width:'60%', height:'220%', pointerEvents:'none',
            background:'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)', transform:'rotate(8deg)' }} />
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <p style={{ fontSize:10, fontWeight:500, textTransform:'uppercase', letterSpacing:'.4px', color:'rgba(255,255,255,.5)', margin:0, marginBottom:2 }}>Total Applications</p>
                <p style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.8)', margin:0 }}>
                  {activeSession ? `Session ${activeSession.session_name}` : 'All sessions'}
                </p>
              </div>
              <div style={{ width:32, height:20, borderRadius:4, background:'linear-gradient(135deg,#D4AF6A 0%,#B8915A 100%)', boxShadow:'0 2px 8px rgba(212,175,106,.25)', flexShrink:0 }} />
            </div>

            <p style={{ fontSize:isMobile?24:32, fontWeight:600, margin:'8px 0 12px 0', fontFamily:"'Courier New',monospace", lineHeight:1.1 }}>
              {apps.length}
            </p>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:isMobile?10:16 }}>
              <div>
                <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.4px', color:'rgba(255,255,255,.5)', margin:'0 0 4px 0', fontWeight:500 }}>Admitted</p>
                <p style={{ fontSize:13, fontWeight:600, margin:0, fontFamily:"'Courier New',monospace", color:'#6FDB9A' }}>{byStatus['Admitted']||0}</p>
              </div>
              <div>
                <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.4px', color:'rgba(255,255,255,.5)', margin:'0 0 4px 0', fontWeight:500 }}>Enrolled</p>
                <p style={{ fontSize:13, fontWeight:600, margin:0, fontFamily:"'Courier New',monospace", color:'#6FDB9A' }}>{byStatus['Enrolled']||0}</p>
              </div>
              <div>
                <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.4px', color:'rgba(255,255,255,.5)', margin:'0 0 4px 0', fontWeight:500 }}>Pending</p>
                <p style={{ fontSize:13, fontWeight:600, margin:0, fontFamily:"'Courier New',monospace", color:'#FF8A8A' }}>{(byStatus['Applied']||0)+(byStatus['Under Review']||0)}</p>
              </div>
              <div>
                <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.4px', color:'rgba(255,255,255,.5)', margin:'0 0 4px 0', fontWeight:500 }}>Revenue/mo</p>
                <p style={{ fontSize:13, fontWeight:600, margin:0, fontFamily:"'Courier New',monospace", color:'rgba(255,255,255,.9)' }}>₹{fmt(monthlyRevenue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div style={{ padding: isMobile?'0 0 12px':'0 0 18px', display:'flex', flexDirection:isMobile?'column':'row', alignItems:isMobile?'stretch':'flex-start', justifyContent:'space-between', gap:isMobile?12:14 }}>
          <div>
            <div style={{ fontSize:13, color:T.slate[500], display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              {['Applied','Under Review','Admitted','Fee Collection','Enrolled → Student'].map((s,i,arr) => (
                <span key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontWeight:600, color:[T.indigo[600],T.amber[600],T.violet[600],T.amber[500],T.emerald[600]][i] }}>{s}</span>
                  {i < arr.length-1 && <span style={{ color:T.slate[300] }}>›</span>}
                </span>
              ))}
            </div>
            <div style={{ marginTop:6, display:'flex', gap:12, fontSize:11, color:T.slate[400], flexWrap:'wrap' }}>
              <span>🏠 Boarder: <strong style={{ color:T.emerald[600] }}>₹5,500/mo</strong></span>
              <span>🌅 Day Boarder: <strong style={{ color:T.amber[600] }}>₹4,000/mo</strong></span>
              <span>🏫 Day Scholar: <strong style={{ color:T.slate[500] }}>₹2,000/mo</strong></span>
              <span style={{ padding:'1px 8px', borderRadius:6, background:T.slate[100], color:T.slate[500], fontWeight:700, fontSize:10 }}>Role: {userRole}</span>
            </div>
            <div style={{ marginTop:4, fontSize:10, color:T.slate[300] }}>
              Shortcuts: <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>N</kbd> New &nbsp;
              <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>/</kbd> Search &nbsp;
              <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>V</kbd> Toggle view &nbsp;
              <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>D</kbd> Dark mode &nbsp;
              <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>Esc</kbd> Close
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(7,auto)', gap:8, alignItems:'center' }}>
           <button onClick={()=>setDarkMode(v=>!v)} title="Toggle dark mode (D)"
  style={{ padding:'9px 14px', borderRadius:12, border:'none', background:N.bg, boxShadow:N.shadow('sm'), fontSize:14, cursor:'pointer', color:N.text2, transition:'box-shadow .15s' }}
  onMouseEnter={e=>e.currentTarget.style.boxShadow=N.inset('sm')}
  onMouseLeave={e=>e.currentTarget.style.boxShadow=N.shadow('sm')}
>{darkMode?'☀️':'🌙'}</button>

<button onClick={()=>setTableMode(v=>!v)} title="Toggle view (V)"
  style={{ padding:'9px 14px', borderRadius:12, border:'none', background:N.bg, boxShadow:tableMode?N.inset('sm'):N.shadow('sm'), fontSize:14, cursor:'pointer', color:N.text2, transition:'box-shadow .15s' }}
>{tableMode?'🃏':'📋'}</button>


<button onClick={()=>setShowAnalytics(v=>!v)}
  style={{ padding:'9px 14px', borderRadius:12, border:'none', background:N.bg, boxShadow:showAnalytics?N.inset('sm'):N.shadow('sm'), color:showAnalytics?N.indigo:N.text2, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .15s' }}>
  📊 Analytics
</button>

<button onClick={()=>setShowReports(v=>!v)}
  style={{ padding:'9px 14px', borderRadius:12, border:'none', background:N.bg, boxShadow:showReports?N.inset('sm'):N.shadow('sm'), color:showReports?N.indigo:N.text2, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .15s' }}>
  📑 Reports
</button>

{checkPermission(userRole,'create') && (
<button onClick={()=>setShowCSVImport(true)}
  style={{ padding:'9px 14px', borderRadius:12, border:'none', background:N.bg, boxShadow:N.shadow('sm'), color:N.text2, fontSize:12, fontWeight:700, cursor:'pointer', transition:'box-shadow .15s' }}
  onMouseEnter={e=>e.currentTarget.style.boxShadow=N.inset('sm')}
  onMouseLeave={e=>e.currentTarget.style.boxShadow=N.shadow('sm')}
>📥 Import</button>
)}

{checkPermission(userRole,'export') && (
<button onClick={()=>secureExport(filtered, `GNSI_Admissions_${new Date().toISOString().slice(0,10)}.csv`)}
  style={{ padding:'9px 14px', borderRadius:12, border:'none', background:N.bg, boxShadow:N.shadow('sm'), color:N.text2, fontSize:12, fontWeight:700, cursor:'pointer', transition:'box-shadow .15s' }}
  onMouseEnter={e=>e.currentTarget.style.boxShadow=N.inset('sm')}
  onMouseLeave={e=>e.currentTarget.style.boxShadow=N.shadow('sm')}
>📤 Export</button>
)}

{checkPermission(userRole,'bulk') && (
<button onClick={handleAutoAssignHouse}
  style={{ padding:'9px 14px', borderRadius:12, border:'none', background:N.bg, boxShadow:N.shadow('sm'), color:N.text2, fontSize:12, fontWeight:700, cursor:'pointer', transition:'box-shadow .15s' }}
  onMouseEnter={e=>e.currentTarget.style.boxShadow=N.inset('sm')}
  onMouseLeave={e=>e.currentTarget.style.boxShadow=N.shadow('sm')}
>🏠 Auto-Assign</button>
)}

{checkPermission(userRole,'create') && (
<button onClick={()=>{ setEditing(null); setFormOpen(true) }}
  style={{ padding:'10px 22px', borderRadius:13, background:`linear-gradient(135deg,${N.navy},${N.navyLight})`, color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 14px rgba(29,29,31,.25)', transition:'all .2s' }}
  onMouseEnter={e=>{ e.currentTarget.style.boxShadow='0 6px 20px rgba(29,29,31,.32)'; e.currentTarget.style.transform='translateY(-2px)' }}
  onMouseLeave={e=>{ e.currentTarget.style.boxShadow='0 4px 14px rgba(29,29,31,.25)'; e.currentTarget.style.transform='translateY(0)' }}
>
  <span style={{ fontSize:18, lineHeight:1 }}>+</span> New Application
</button>
)}
          </div>
        </div>

        {/* Active session banner */}
       {activeSession && (
  <div style={{ marginBottom:18, padding:'12px 20px', borderRadius:16, background:N.bg, boxShadow:N.shadow('sm'), display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:9, height:9, borderRadius:'50%', background:activeSession.is_locked?N.rose:N.emerald, boxShadow:`0 0 0 3px ${activeSession.is_locked?'rgba(225,29,72,.18)':'rgba(5,150,105,.18)'}`, animation:'pulse 2s ease-in-out infinite', flexShrink:0 }} />
      <span style={{ fontSize:13, fontWeight:700, color:activeSession.is_locked?N.rose:N.emerald }}>
        {activeSession.is_locked?'Session Locked':'Active Session'}: <strong>{activeSession.session_name}</strong>
      </span>
    </div>
    {activeSession.is_locked
      ? <span style={{ fontSize:12, color:N.rose, fontWeight:600 }}>New applications are blocked. Go to Sessions to unlock.</span>
      : <span style={{ fontSize:12, color:N.muted }}>Revenue (enrolled): <strong style={{ color:N.emerald }}>₹{fmt(monthlyRevenue)}/mo</strong></span>
    }
  </div>
)}

        {/* Analytics Dashboard */}
        {showAnalytics && <AnalyticsDashboard apps={apps} cols={cols} darkMode={darkMode} />}

        {/* Report Generator — Phase A */}
        {showReports && <ReportGenerator apps={apps} cols={cols} sessionOptions={sessionOptions} courseOptions={courseOptions} />}

        {/* Dashboard — default view */}
        <Dashboard apps={apps} cols={cols} darkMode={darkMode} />

        {/* KPI Strip */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2,1fr)':isTablet?'repeat(4,1fr)':'repeat(7,1fr)', gap:isMobile?10:12, marginBottom:18 }}>
  {[
    { label:'Total', value:apps.length, color:N.text, accent:`linear-gradient(90deg,${N.gold},${N.goldDark})`, filter:'All', sub:`₹${fmt(monthlyRevenue)}/mo` },
    { label:'Applied',      value:byStatus['Applied']||0,      color:'#6366f1', accent:'#6366f1', filter:'Applied' },
    { label:'Under Review', value:byStatus['Under Review']||0, color:N.amber,   accent:N.amber,   filter:'Under Review' },
    { label:'Admitted',     value:byStatus['Admitted']||0,     color:N.violet,  accent:N.violet,  filter:'Admitted' },
    { label:'Enrolled',     value:byStatus['Enrolled']||0,     color:N.emerald, accent:N.emerald, filter:'Enrolled' },
    { label:'Rejected',     value:byStatus['Rejected']||0,     color:N.rose,    accent:N.rose,    filter:'Rejected' },
    { label:'Waitlisted',   value:byStatus['Waitlisted']||0,   color:N.muted2,  accent:N.muted2,  filter:'Waitlisted' },
  ].map(k => {
    const isActive = filterStatus === k.filter
    return (
      <div key={k.label} onClick={()=>setFilter(isActive?'All':k.filter)}
        style={{ borderRadius:18, padding:'14px 14px 12px', background:N.bg, boxShadow:isActive?N.inset('md'):N.shadow('md'), cursor:'pointer', transition:'all .2s', position:'relative', overflow:'hidden' }}
        onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.boxShadow=N.shadow('lg') }}
        onMouseLeave={e=>{ e.currentTarget.style.boxShadow=isActive?N.inset('md'):N.shadow('md') }}
      >
        <div style={{ position:'absolute', top:0, left:'14px', right:'14px', height:'3px', borderRadius:'0 0 3px 3px', background:k.accent }} />
        <div style={{ fontSize:24, fontWeight:900, color:k.color, lineHeight:1, marginTop:4, marginBottom:4 }}>{k.value}</div>
        <div style={{ fontSize:9, fontWeight:700, color:N.muted, textTransform:'uppercase', letterSpacing:'.1em' }}>{k.label}</div>
        {k.sub && <div style={{ fontSize:10, color:N.muted2, marginTop:3 }}>{k.sub}</div>}
      </div>
    )
  })}
</div>

        {/* Form */}
        {formOpen && (
          <AdmForm onSave={handleSave} onCancel={()=>{ setFormOpen(false); setEditing(null) }} editing={editing} activeSession={activeSession} housemastersByHouse={housemastersByHouse} />
        )}

        {/* Detail panel */}
        {detailApp && (
          <DetailPanel a={detailApp} onClose={()=>setDetailApp(null)} onAddNote={handleAddNote} darkMode={darkMode} role={userRole} housemastersByHouse={housemastersByHouse} />
        )}

        {/* Quick-edit row */}
        {quickEditApp && (
          <QuickEditRow a={quickEditApp} onSave={handleQuickEdit} onCancel={()=>setQuickEditApp(null)} />
        )}

        {/* Advanced Search */}
        {showAdvSearch && (
          <AdvancedSearch filters={advFilters} onChange={f=>{setAdvFilters(f);setShowAdvSearch(false)}} onClose={()=>setShowAdvSearch(false)} apps={apps} />
        )}

        {/* Filter Panel */}
        <div style={{ background:N.bg, borderRadius:isMobile?14:20, boxShadow:N.shadow('md'), padding:isMobile?'12px 14px':'16px 20px', marginBottom:16, display:'flex', flexDirection:'column', gap:isMobile?8:12 }}>
          {sessionOptions.length > 0 && (
            <PillStrip label="Session" options={sessionOptions} value={filterSession} onChange={setSession} colorFn={()=>T.indigo[600]} />
          )}
          {courseOptions.length > 0 && (
            <PillStrip label="Course" options={courseOptions} value={filterCourse} onChange={setCourse} colorFn={c=>COURSE_STRUCTURE[c]?.color||T.slate[500]} />
          )}
          {subtypeOptions.length > 0 && (
            <PillStrip label="Batch" options={subtypeOptions} value={filterSubtype} onChange={setSubtype} colorFn={()=>T.violet[600]} />
          )}
          <PillStrip label="Hostel" options={HOSTEL_TYPES} value={filterHostel} onChange={setHostel} colorFn={h=>HOSTEL_STYLES[h]?.color||T.slate[500]} />
          <PillStrip label="House" options={HOUSES_LIST} value={filterHouse} onChange={setFilterHouse} colorFn={()=>T.sky[600]}
            countFn={h => houseCounts[h]||0} />

          <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:isMobile?8:10, alignItems:isMobile?'stretch':'center', flexWrap:isMobile?'nowrap':'wrap' }}>
            <div style={{ flex:1, minWidth:200, position:'relative' }}>
  <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:N.muted, fontSize:13, pointerEvents:'none' }}>🔍</span>
  <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
    placeholder="Search name, GCC, phone, house…"
    style={{ ...styles.inp, paddingLeft:38 }} />
</div>
<button onClick={()=>setShowAdvSearch(v=>!v)}
  style={{ padding:'9px 14px', borderRadius:12, border:'none', background:N.bg, boxShadow:Object.keys(advFilters).filter(k=>advFilters[k]).length>0?N.inset('sm'):N.shadow('sm'), color:Object.keys(advFilters).filter(k=>advFilters[k]).length>0?N.violet:N.muted2, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', transition:'all .15s' }}>
  🔎 Advanced{Object.keys(advFilters).filter(k=>advFilters[k]).length>0?` (${Object.keys(advFilters).filter(k=>advFilters[k]).length})`:''}</button>

            {isMobile ? (
  <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...styles.inp, fontSize:12 }}>
    <option value="gcc">Sort: GCC No.</option>
    <option value="name">Sort: Name</option>
    <option value="created_at">Sort: Date</option>
    <option value="status">Sort: Status</option>
  </select>
) : (
  <SortControl sortBy={sortBy} sortDir={sortDir} onChange={(k,d)=>{setSortBy(k);setSortDir(d)}} />
)}

            <div style={{ position:'relative' }}>
              <button onClick={()=>setShowPresets(v=>!v)}
                style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${T.slate[200]}`, background:card, color:T.slate[600], fontSize:12, fontWeight:700, cursor:'pointer' }}>
                💾 Presets
              </button>
              {showPresets && (
                <div style={{ position:'absolute', top:'100%', right:0, zIndex:200, background:'#fff', border:`1px solid ${T.slate[200]}`, borderRadius:10, padding:12, width:220, boxShadow:'0 8px 24px rgba(0,0,0,.12)', marginTop:4 }}>
                  {Object.keys(presets).length === 0 && <div style={{ fontSize:12, color:T.slate[400], marginBottom:8 }}>No saved presets</div>}
                  {Object.entries(presets).map(([name,f]) => (
                    <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <button onClick={()=>{setAdvFilters(f);setSession(f._session||'All');setCourse(f._course||'All');setFilter(f._status||'All');setShowPresets(false)}}
                        style={{ fontSize:12, color:T.indigo[600], fontWeight:700, background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>{name}</button>
                      <button onClick={()=>removePreset(name)} style={{ fontSize:11, color:T.rose[500], background:'none', border:'none', cursor:'pointer' }}>✕</button>
                    </div>
                  ))}
                  <div style={{ borderTop:`1px solid ${T.slate[100]}`, marginTop:8, paddingTop:8 }}>
                    <div style={{ fontSize:11, color:T.slate[400], marginBottom:4 }}>Save current filters as:</div>
                    <input placeholder="Preset name…" style={{ ...styles.inp, fontSize:11, marginBottom:6 }} id="preset-name-inp" />
                    <button onClick={()=>{
                      const name = document.getElementById('preset-name-inp').value.trim()
                      if (name) { savePreset(name, { ...advFilters, _status:filterStatus, _session:filterSession, _course:filterCourse }); setShowPresets(false) }
                    }} style={{ width:'100%', padding:'6px', borderRadius:7, background:T.indigo[600], color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>Save Preset</button>
                  </div>
                </div>
              )}
            </div>

            {activeFilters > 0 && (
              <button onClick={clearAll} style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${T.rose[200]}`, background:T.rose[50], color:T.rose[600], fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                ✕ Clear {activeFilters} filter{activeFilters>1?'s':''}
              </button>
            )}
            <span style={{ fontSize:12, color:T.slate[400], fontWeight:500, whiteSpace:'nowrap' }}>{filtered.length} of {apps.length} applicants</span>
          </div>
        </div>

        {/* Select-all bar */}
        {filtered.length > 0 && (
  <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:isMobile?6:10, marginBottom:10, fontSize:12, color:N.muted2 }}>
            <input type="checkbox" checked={selectedIds.size===filtered.length&&filtered.length>0} onChange={toggleSelectAll} style={{ cursor:'pointer' }} />
            <span onClick={toggleSelectAll} style={{ cursor:'pointer' }}>Select all {filtered.length}</span>
            {selectedIds.size>0 && <span style={{ color:T.indigo[600], fontWeight:700 }}>{selectedIds.size} selected</span>}
            {selectedIds.size>0 && (
              <>
                <button onClick={()=>{ secureExport(selectedApps, `GNSI_Selected_${new Date().toISOString().slice(0,10)}.csv`) }}
                  style={{ padding:'4px 10px', borderRadius:6, background:T.sky[50], color:T.sky[600], border:`1px solid ${T.sky[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>Export Selected</button>
                <button onClick={()=>securePrint(selectedApps)}
                  style={{ padding:'4px 10px', borderRadius:6, background:T.indigo[50], color:T.indigo[600], border:`1px solid ${T.indigo[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>Print Selected</button>
                <button onClick={()=>secureWABlast(selectedApps)}
                  style={{ padding:'4px 10px', borderRadius:6, background:'#E7FBE9', color:'#128C7E', border:'1px solid #A7F0BA', fontSize:11, fontWeight:700, cursor:'pointer' }}>WA Blast</button>
              </>
            )}
          </div>
        )}

        {/* Bulk Action Bar */}
        <BulkBar
          selected={[...selectedIds]} total={filtered.length}
          onClear={clearSelection}
          onBulkStatus={handleBulkStatus}
          onBulkHouse={handleBulkHouse}
          onBulkDelete={handleBulkDelete}
          onBulkEnroll={()=>showToast('Select enrolled-ready applicants first',T.amber[600])}
          onBulkExport={()=>secureExport(selectedApps, `GNSI_Bulk_${Date.now()}.csv`)}
          onBulkPrint={()=>securePrint(selectedApps)}
          onBulkWA={()=>secureWABlast(selectedApps)}
        />

        {/* List / Table */}
        {filtered.length > 0 ? (
          tableMode ? (
            <div style={{ background:N.bg, borderRadius:16, boxShadow:N.shadow('md'), overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:darkMode?T.slate[700]:T.slate[50] }}>
                    <th style={{ padding:'10px 10px', textAlign:'left', color:T.slate[400], fontSize:11 }}>
                      <input type="checkbox" checked={selectedIds.size===filtered.length} onChange={toggleSelectAll} style={{ cursor:'pointer' }} />
                    </th>
                    {['GCC','Adm No','Name','Course','Class','House','Hostel','Session','Status','Phone','Actions'].map(h=>(
                      <th key={h} style={{ padding:'10px 10px', textAlign:'left', fontWeight:700, color:T.slate[500], fontSize:11, textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <AppCard key={a.id} a={a} cols={cols} selected={selectedIds.has(a.id)} onSelect={toggleSelect}
                      onEdit={app=>{setEditing(app);setFormOpen(true)}} onDelete={handleDelete} onAdmit={handleAdmit}
                      onEnroll={handleEnroll} onOpenFee={setFeePanel} onQuickEdit={setQuickEditApp}
                      onDetail={setDetailApp} onWAMsg={a=>secureWABlast([a])} tableMode darkMode={darkMode} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':isTablet?'repeat(2,1fr)':'repeat(auto-fill,minmax(340px,1fr))', gap:isMobile?12:14, alignItems:'start', minWidth:0, width:'100%' }}>
              {filtered.map(a => (
                <div key={a.id}>
                  {duplicateGCCs.has(a.gcc) && (
                    <div style={{ fontSize:11, color:T.rose[600], fontWeight:700, padding:'3px 10px', background:T.rose[50], borderRadius:6, marginBottom:3, display:'inline-block' }}>
                      ⚠ Possible duplicate detected
                    </div>
                  )}
                  {a.status==='Waitlisted' && waitlistPositions[a.gcc] && (
                    <div style={{ fontSize:11, color:T.slate[500], fontWeight:700, marginBottom:2 }}>Waitlist #{waitlistPositions[a.gcc]}</div>
                  )}
                  <AppCard a={a} cols={cols} selected={selectedIds.has(a.id)} onSelect={toggleSelect}
                    onEdit={app=>{setEditing(app);setFormOpen(true)}} onDelete={handleDelete} onAdmit={handleAdmit}
                    onEnroll={handleEnroll} onOpenFee={setFeePanel} onQuickEdit={setQuickEditApp}
                    onDetail={setDetailApp} onWAMsg={a=>secureWABlast([a])} tableMode={false} darkMode={darkMode} canDelete={checkPermission(userRole,'delete')} />
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
  <div style={{ width:72, height:72, borderRadius:20, background:N.bg, boxShadow:N.shadow('lg'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, marginBottom:18 }}>📭</div>
  <div style={{ fontSize:16, fontWeight:800, color:N.text, marginBottom:6 }}>{apps.length===0?'No applications yet':'No results found'}</div>
  <p style={{ fontSize:13, color:N.muted2, maxWidth:'36ch', lineHeight:1.6, margin:'0 0 20px' }}>
              {apps.length===0?'Click "+ New Application" to add your first applicant.':'Try adjusting your search or clearing the filters.'}
            </p>
            {activeFilters>0 && <button onClick={clearAll} style={{ padding:'11px 24px', borderRadius:13, background:N.bg, boxShadow:N.shadow('md'), color:N.rose, border:'none', fontSize:13, fontWeight:800, cursor:'pointer', transition:'box-shadow .15s' }} onMouseEnter={e=>e.currentTarget.style.boxShadow=N.inset('md')} onMouseLeave={e=>e.currentTarget.style.boxShadow=N.shadow('md')}>✕ Clear all filters</button>}
{apps.length===0 && <button onClick={()=>setFormOpen(true)} style={{ padding:'11px 24px', borderRadius:13, background:`linear-gradient(135deg,${N.navy},${N.navyLight})`, color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(29,29,31,.25)' }}>+ New Application</button>}
          </div>
        )}

        {filtered.length > 200 && (
          <div style={{ marginTop:12, textAlign:'center', fontSize:12, color:T.slate[400] }}>
            Showing all {filtered.length} records · Switch to Table View for better performance with large lists
          </div>
        )}
      </div>
    </>
  )
}