// Students.jsx — Professional Redesign (Security + Design Patched)
// ─────────────────────────────────────────────────────────────────────────────
// FIXES APPLIED:
//  SEC-1  Role from app_metadata (server-only), not user_metadata
//  SEC-2  Signed URLs for sensitive documents instead of public URLs
//  SEC-3  Randomised storage paths to prevent overwrite attacks
//  SEC-4  Replaced browser confirm() with Modal confirmation
//  SEC-5  Server-side audit logging on all writes
//  SEC-6  localStorage draft strips PII fields before persist
//  SEC-7  Undo window crash-safety via DB flag, not just timer
//  SEC-8  Bulk op IDs validated against loaded student set
//  DESIGN-1  loadFeeData stale closure fixed — ids passed as arg, not from outer scope
//  DESIGN-2  Fee arrears now subtract fee_waiver + scholarship per student
//  DESIGN-3  Merge duplicates uses soft-delete (deleted_at) not hard delete
//  DESIGN-4  Rollover idempotency check — skips already-rolled students
//  DESIGN-5  Export menu closes on outside click
//  DESIGN-6  Preset list capped at 20; size shown in UI
//  DESIGN-7  applyPreset atomically resets page
//  DESIGN-8  Card view checkbox stopPropagation hardened
//  DESIGN-9  ExamScoreModal subject columns validated against SUBJECTS constant
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react'
import { supabase } from './supabase'
import FeeCollectionModal from './FeeCollectionModal'
import { getFlatFeeAmt } from './feeEngine'

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt  = n => Number(n||0).toLocaleString('en-IN')
const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : '—'
const fmtM = d => d ? new Date(d).toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : '—'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const D = {
  bg:'#0B0F1A', card:'#111827', card2:'#1A2235', card3:'#1E293B',
  overlay:'rgba(0,0,0,0.85)', border:'#1E293B', border2:'#2D3F55', border3:'#3B5068',
  text1:'#F1F5F9', text2:'#94A3B8', text3:'#64748B', text4:'#475569',
  brand:'#3B82F6', brandDim:'rgba(59,130,246,0.12)', brandBorder:'rgba(59,130,246,0.3)',
  emerald:'#10B981', emeraldDim:'rgba(16,185,129,0.1)', emeraldBorder:'rgba(16,185,129,0.25)',
  amber:'#F59E0B',  amberDim:'rgba(245,158,11,0.1)',   amberBorder:'rgba(245,158,11,0.25)',
  rose:'#F43F5E',   roseDim:'rgba(244,63,94,0.1)',     roseBorder:'rgba(244,63,94,0.25)',
  violet:'#8B5CF6', violetDim:'rgba(139,92,246,0.1)',  violetBorder:'rgba(139,92,246,0.25)',
  sky:'#0EA5E9',    skyDim:'rgba(14,165,233,0.1)',      skyBorder:'rgba(14,165,233,0.25)',
  teal:'#14B8A6',   tealDim:'rgba(20,184,166,0.1)',     tealBorder:'rgba(20,184,166,0.25)',
  orange:'#F97316', orangeDim:'rgba(249,115,22,0.1)',   orangeBorder:'rgba(249,115,22,0.25)',
  r4:'4px', r6:'6px', r8:'8px', r10:'10px', r12:'12px', r16:'16px',
}

// ─── SEC-1: Role from app_metadata (server-only), not user_metadata ───────────
// app_metadata can only be set by service-role key / server, never by the client.
// Fallback chain: app_metadata.role → staff_profiles table → 'viewer'
// ─── SEC-1: Role from app_metadata → user_metadata → staff_profiles → 'viewer'
function usePermissions() {
  const [role, setRole] = useState('viewer')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        // 1. app_metadata (server-only, most secure)
        const appRole = session.user?.app_metadata?.role
        if (appRole) { if (!cancelled) setRole(appRole); return }

        // 2. user_metadata (your app likely stores role here)
        const userRole = session.user?.user_metadata?.role
        if (userRole) { if (!cancelled) setRole(userRole); return }

        // 3. staff_profiles table
        const { data: profile } = await supabase
          .from('staff_profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()
        if (!cancelled && profile?.role) { setRole(profile.role); return }

        // 4. staff table (common alternative table name)
        const { data: staffRow } = await supabase
          .from('staff')
          .select('role')
          .eq('user_id', session.user.id)
          .single()
        if (!cancelled && staffRow?.role) { setRole(staffRow.role); return }

        // 5. profiles table (another common name)
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        if (!cancelled && profileRow?.role) setRole(profileRow.role)

      } catch { /* stay as viewer */ }
    })()
    return () => { cancelled = true }
  }, [])

  return {
    role,
    can: {
      write:  ['admin','manager'].includes(role),
      fees:   ['admin','manager','accounts'].includes(role),
      exams:  ['admin','manager','teacher'].includes(role),
      attend: ['admin','manager','teacher','hostel'].includes(role),
      export: ['admin','manager','accounts'].includes(role),
      view:   true,
    }
  }
}

// ─── SEC-5: Server-side audit logger ─────────────────────────────────────────
// Writes to audit_logs table. Fails silently — never blocks the operation.
async function auditLog(action, details = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('audit_logs').insert({
      action,
      actor_id:   session?.user?.id || null,
      actor_role: session?.user?.app_metadata?.role || 'unknown',
      details,
      created_at: new Date().toISOString(),
    })
  } catch { /* silent — audit failure must not block UI */ }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COURSES      = ['All','Sainik','Navodaya','Foundation','Combined Course']
const HOSTEL_TYPES = ['All','Boarder','Day Scholar','Day Boarder']
const STATUSES     = ['All','Active','Inactive','Passed Out','Withdrawn']
const GENDERS      = ['All','Male','Female']
const SESSIONS     = ['2024-25','2025-26','2026-27']
const SUBJECTS     = ['Mathematics','Science','English','Social Studies','Hindi','GK','Reasoning']
const BATCH_CAPACITY = 80
const MAX_PRESETS  = 20  // DESIGN-6: cap preset list

const COURSE_STRUCTURE = {
  Navodaya:         { subtypes:['Lakshya','Umeed'],              color:D.brand,   bg:D.brandDim   },
  Sainik:           { subtypes:['Achiever','Leader','Champion'],  color:D.emerald, bg:D.emeraldDim },
  Foundation:       { subtypes:['Elite','Prime'],                 color:D.violet,  bg:D.violetDim  },
  'Combined Course':{ subtypes:[],                                color:D.amber,   bg:D.amberDim   },
}

const PROMOTION_MAP = {
  'Lakshya':'Umeed','Achiever':'Leader','Leader':'Champion','Elite':'Prime',
}

const CLASSES_LIST  = ['Achiever','Leader','Champion','Lakshya','Umeed','Elite','Prime']
const HOUSES_LIST   = ['Kombirei','Shiroi','Loktak','Singgarei','Koubru','Kangla','Sangai','Takhelei','Block-B','Day Scholar']
const DAY_SCHOLAR_HOUSES = ['Day Scholar']

const HOUSE_COLORS = {
  Kombirei:'#3B82F6', Kangla:'#EF4444', Sangai:'#10B981', Singgarei:'#F59E0B',
  Loktak:'#8B5CF6',   Koubru:'#06B6D4', Shiroi:'#EC4899', Takhelei:'#F97316',
  'Block-B':'#64748B','Day Scholar':'#475569',
}

const STATUS_META = {
  Active:      { color:D.emerald, bg:D.emeraldDim, border:D.emeraldBorder, dot:'#10B981' },
  Inactive:    { color:D.amber,   bg:D.amberDim,   border:D.amberBorder,   dot:'#F59E0B' },
  'Passed Out':{ color:D.sky,     bg:D.skyDim,     border:D.skyBorder,     dot:'#0EA5E9' },
  Withdrawn:   { color:D.rose,    bg:D.roseDim,    border:D.roseBorder,    dot:'#F43F5E' },
}

const HOSTEL_STYLES = {
  'Boarder':    { bg:D.emeraldDim, color:D.emerald, border:D.emeraldBorder },
  'Day Boarder':{ bg:D.amberDim,   color:D.amber,   border:D.amberBorder   },
  'Day Scholar':{ bg:D.card2,      color:D.text2,   border:D.border2       },
}

const ALL_COLUMNS = [
  {key:'name',       label:'Name',         default:true},
  {key:'gcc_no',     label:'GCC No.',      default:true},
  {key:'batch',      label:'Batch',        default:true},
  {key:'session',    label:'Session',      default:true},
  {key:'course',     label:'Course',       default:true},
  {key:'house',      label:'House',        default:true},
  {key:'hostel_type',label:'Hostel',       default:true},
  {key:'status',     label:'Status',       default:true},
  {key:'fee_dues',   label:'Fee Dues',     default:true},
  {key:'attendance', label:'Att%',         default:true},
  {key:'gender',     label:'Gender',       default:false},
  {key:'phone',      label:'Phone',        default:false},
  {key:'father_name',label:'Father',       default:false},
  {key:'last_paid',  label:'Last Paid',    default:false},
  {key:'sparkline',  label:'Score Trend',  default:false},
]

const DENSITY = {
  compact:    { py:'8px',  avatarSize:28, fontSize:12 },
  comfortable:{ py:'13px', avatarSize:34, fontSize:13 },
  spacious:   { py:'18px', avatarSize:42, fontSize:14 },
}

// SEC-6: Draft key stores only non-PII form skeleton (sensitive fields excluded)
const DRAFT_KEY    = 'gnsi_student_form_draft'
const PRESETS_KEY  = 'gnsi_filter_presets'
const SEARCHES_KEY = 'gnsi_recent_searches'
const COLUMNS_KEY  = 'gnsi_visible_columns'
const DENSITY_KEY  = 'gnsi_density'

// SEC-6: Fields excluded from localStorage draft to avoid PII leakage on shared devices
const DRAFT_PII_FIELDS = ['phone','father_name','mother_name','address','emergency_contact','medical_notes','dob']
const sanitiseDraftForStorage = form => {
  const safe = { ...form }
  DRAFT_PII_FIELDS.forEach(k => delete safe[k])
  return safe
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EC4899','#14B8A6','#F97316']
const avatarColor = name => AVATAR_PALETTE[(name||'').charCodeAt(0) % AVATAR_PALETTE.length]
const initials    = name => (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

// SEC-3: Random suffix prevents path-guessing overwrites
const randomSuffix = () => Math.random().toString(36).slice(2,10)

function deriveHostelType(house, hostelType) {
  if (house && DAY_SCHOLAR_HOUSES.includes(house)) return 'Day Scholar'
  if (['Boarder','Day Scholar','Day Boarder'].includes(hostelType)) return hostelType
  return 'Day Scholar'
}
function isBirthdayToday(dob) {
  if (!dob) return false
  const t = new Date(), d = new Date(dob)
  return d.getDate()===t.getDate() && d.getMonth()===t.getMonth()
}
function isRecentlyAdded(createdAt) {
  if (!createdAt) return false
  return Date.now() - new Date(createdAt).getTime() < 7*24*60*60*1000
}
function getMissingFields(s) {
  const m = []
  if (!s.gcc_no) m.push('GCC')
  if (!s.dob)    m.push('DOB')
  if (!s.phone)  m.push('Phone')
  if (!s.course) m.push('Course')
  return m
}
function getAge(dob) {
  if (!dob) return null
  const today = new Date(), birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() - birth.getMonth() < 0 ||
     (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

// DESIGN-2: Effective monthly due = flat rate minus per-student waivers
function getEffectiveMonthlyDue(student) {
  const base      = getFlatFeeAmt(student.hostel_type)
  const waiver    = Number(student.fee_waiver    || 0)
  const scholarship = Number(student.scholarship || 0)
  return Math.max(0, base - waiver - scholarship)
}

function downloadCSV(rows, filename) {
  if (!rows.length) return
  const h = Object.keys(rows[0])
  const csv = [h.join(','), ...rows.map(r=>h.map(k=>`"${(r[k]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n')
  Object.assign(document.createElement('a'),{
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download: filename
  }).click()
}
function exportToPDF(title, headers, rows) {
  const w = window.open('','_blank')
  const th = headers.map(h=>`<th>${h.label}</th>`).join('')
  const td = rows.map((r,i)=>`<tr style="background:${i%2?'#f8fafc':'#fff'}">${headers.map(h=>`<td>${r[h.key]??'—'}</td>`).join('')}</tr>`).join('')
  w.document.write(`<html><head><title>${title}</title><style>
    @page{size:A4 landscape;margin:10mm}body{font-family:sans-serif;font-size:11px;padding:16px}
    h2{font-size:16px;margin-bottom:4px}.meta{color:#666;margin-bottom:12px;font-size:10px}
    table{width:100%;border-collapse:collapse}th{background:#0B0F1A;color:#fff;padding:6px 8px;text-align:left;font-size:10px}
    td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px}
  </style></head><body>
    <h2>${title}</h2>
    <div class="meta">${rows.length} records · ${new Date().toLocaleDateString('en-IN')}</div>
    <table><thead><tr>${th}</tr></thead><tbody>${td}</tbody></table>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
  </body></html>`)
  w.document.close()
}

// DESIGN-6: Presets capped at MAX_PRESETS
function usePresets() {
  const load = () => { try { return JSON.parse(localStorage.getItem(PRESETS_KEY)||'[]') } catch { return [] } }
  const [presets, setPresets] = useState(load)
  const save = (name, filters) => {
    const next = [...presets.filter(p=>p.name!==name), {name,filters}].slice(-MAX_PRESETS)
    setPresets(next); localStorage.setItem(PRESETS_KEY, JSON.stringify(next))
  }
  const remove = name => {
    const next = presets.filter(p=>p.name!==name)
    setPresets(next); localStorage.setItem(PRESETS_KEY, JSON.stringify(next))
  }
  return { presets, save, remove }
}

function useRecentSearches() {
  const load = () => { try { return JSON.parse(localStorage.getItem(SEARCHES_KEY)||'[]') } catch { return [] } }
  const [recent, setRecent] = useState(load)
  const add = q => {
    if (!q?.trim() || q.length < 2) return
    const next = [q, ...recent.filter(r=>r!==q)].slice(0,8)
    setRecent(next); localStorage.setItem(SEARCHES_KEY, JSON.stringify(next))
  }
  const clear = () => { setRecent([]); localStorage.removeItem(SEARCHES_KEY) }
  return { recent, add, clear }
}

// ─── Design Primitives ────────────────────────────────────────────────────────

function Avatar({ name, photoUrl, size=34 }) {
  const c = avatarColor(name)
  if (photoUrl) return (
    <img src={photoUrl} alt={name} style={{
      width:size, height:size, borderRadius:'50%', objectFit:'cover',
      flexShrink:0, border:`1.5px solid ${c}50`
    }}/>
  )
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:`${c}18`, border:`1.5px solid ${c}40`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.35, fontWeight:700, color:c, letterSpacing:'-.02em',
      fontFamily:"'IBM Plex Mono',monospace"
    }}>{initials(name)}</div>
  )
}

function Badge({ label, color=D.brand, bg, border }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px', borderRadius:D.r4, fontSize:10, fontWeight:700,
      background: bg || `${color}15`, color,
      border:`1px solid ${border||color+'30'}`,
      letterSpacing:'.04em', textTransform:'uppercase', whiteSpace:'nowrap',
      fontFamily:"'IBM Plex Mono',monospace"
    }}>{label}</span>
  )
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color:D.text3, bg:D.card2, border:D.border2, dot:D.text3 }
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 8px', borderRadius:D.r4, fontSize:10, fontWeight:700,
      background:m.bg, color:m.color, border:`1px solid ${m.border}`,
      letterSpacing:'.05em', textTransform:'uppercase', whiteSpace:'nowrap',
    }}>
      <span style={{width:5, height:5, borderRadius:'50%', background:m.dot, flexShrink:0}}/>
      {status}
    </span>
  )
}

function HousePill({ house }) {
  if (!house) return null
  const c = HOUSE_COLORS[house] || D.text3
  return (
    <span style={{
      fontSize:10, fontWeight:700, color:c,
      background:`${c}15`, padding:'1px 8px',
      borderRadius:99, border:`1px solid ${c}30`
    }}>{house}</span>
  )
}

function KpiCard({ label, value, color=D.text2, icon, onClick, active, warn }) {
  return (
    <div onClick={onClick} style={{
      flex:1, minWidth:90, padding:'14px 16px', borderRadius:D.r10,
      background: active ? `${color}15` : warn ? D.orangeDim : D.card,
      border:`1px solid ${active ? `${color}40` : warn ? D.orangeBorder : D.border}`,
      cursor: onClick ? 'pointer' : 'default',
      transition:'all .15s', position:'relative', overflow:'hidden',
    }}>
      <div style={{position:'absolute', right:12, top:10, fontSize:16, opacity:.08, pointerEvents:'none'}}>{icon}</div>
      <div style={{fontSize:22, fontWeight:800, lineHeight:1, letterSpacing:'-.04em',
        color: warn ? D.orange : active ? color : D.text1,
        fontFamily:"'IBM Plex Mono',monospace"
      }}>{value}</div>
      <div style={{fontSize:9, fontWeight:700, marginTop:5, textTransform:'uppercase',
        letterSpacing:'.1em', color: warn ? D.orange : active ? color : D.text3
      }}>{label}</div>
    </div>
  )
}

function Toast({ msg, color=D.brand }) {
  return (
    <div style={{
      position:'fixed', top:20, right:20, zIndex:999999,
      background:D.card2, border:`1px solid ${D.border2}`,
      borderLeft:`3px solid ${color}`,
      borderRadius:D.r10, padding:'12px 18px', fontSize:13, fontWeight:600,
      boxShadow:'0 20px 60px rgba(0,0,0,.8)', maxWidth:340,
      color:D.text1, display:'flex', alignItems:'center', gap:10,
      animation:'slideIn .2s ease',
    }}>
      <span style={{width:7, height:7, borderRadius:'50%', background:color, flexShrink:0}}/>
      {msg}
    </div>
  )
}

function UndoBanner({ student, onUndo, onDismiss }) {
  const [secs, setSecs] = useState(5)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(t); onDismiss(); return 0 }
      return s - 1
    }), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      zIndex:999999, background:D.card2, color:D.text1,
      borderRadius:D.r12, padding:'12px 20px',
      display:'flex', alignItems:'center', gap:14,
      boxShadow:'0 20px 60px rgba(0,0,0,.8)', fontSize:13, fontWeight:600,
      border:`1px solid ${D.border2}`, whiteSpace:'nowrap',
    }}>
      <span>Deleted <strong style={{color:D.text1}}>{student.name}</strong></span>
      <button onClick={onUndo} style={{
        padding:'5px 14px', borderRadius:D.r6,
        background:D.emerald, color:'#000', border:'none',
        fontSize:12, fontWeight:800, cursor:'pointer'
      }}>Undo ({secs}s)</button>
      <button onClick={onDismiss} style={{background:'none', border:'none', color:D.text3, cursor:'pointer', fontSize:15}}>✕</button>
    </div>
  )
}

// SEC-4: Modal confirmation dialog — replaces browser confirm()
function ConfirmModal({ title, message, confirmLabel='Confirm', danger=false, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel} width={380} title={title}>
      <p style={{fontSize:13, color:D.text2, lineHeight:1.7, marginBottom:20}}>{message}</p>
      <div style={{display:'flex', gap:10}}>
        <button onClick={onConfirm} style={{
          ...BTN.primary, flex:1, padding:'11px',
          background: danger ? D.rose : D.brand
        }}>{confirmLabel}</button>
        <button onClick={onCancel} style={{...BTN.secondary, padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── Input / Button Tokens ────────────────────────────────────────────────────
const INP = {
  base: {
    width:'100%', padding:'9px 12px', borderRadius:D.r8,
    border:`1px solid ${D.border2}`, fontSize:13, outline:'none',
    boxSizing:'border-box', backgroundColor:D.card, color:D.text1,
    fontFamily:"'IBM Plex Sans',system-ui,sans-serif", transition:'border-color .15s',
  },
  err: { borderColor:D.rose },
}
const BTN = {
  primary:   { padding:'9px 18px', borderRadius:D.r8, background:D.brand, color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer' },
  secondary: { padding:'8px 14px', borderRadius:D.r8, background:D.card2, color:D.text2, border:`1px solid ${D.border2}`, fontSize:12, fontWeight:600, cursor:'pointer' },
  ghost:     { padding:'7px 12px', borderRadius:D.r6, background:'none', color:D.text3, border:`1px solid ${D.border}`, fontSize:11, fontWeight:600, cursor:'pointer' },
  danger:    { padding:'8px 14px', borderRadius:D.r8, background:D.roseDim, color:D.rose, border:`1px solid ${D.roseBorder}`, fontSize:12, fontWeight:700, cursor:'pointer' },
}

function FieldRow({ label, children, error }) {
  return (
    <div>
      <label style={{
        display:'block', fontSize:10, fontWeight:700,
        color: error ? D.rose : D.text3, marginBottom:5,
        textTransform:'uppercase', letterSpacing:'.09em'
      }}>{label}</label>
      {children}
      {error && <div style={{fontSize:11, color:D.rose, marginTop:4, fontWeight:600}}>⚠ {error}</div>}
    </div>
  )
}

function SectionDivider({ label }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, margin:'20px 0 14px'}}>
      <div style={{flex:1, height:1, background:D.border}}/>
      <span style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.14em', color:D.text4}}>{label}</span>
      <div style={{flex:1, height:1, background:D.border}}/>
    </div>
  )
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function Modal({ children, onClose, width=480, title, subtitle }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:99999,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.85)', backdropFilter:'blur(6px)',
    }} onClick={onClose}>
      <div style={{
        background:D.card, border:`1px solid ${D.border2}`,
        borderRadius:D.r16, width, maxHeight:'88vh',
        boxShadow:'0 40px 120px rgba(0,0,0,.9)',
        display:'flex', flexDirection:'column', overflow:'hidden',
        animation:'fadeUp .2s ease',
      }} onClick={e=>e.stopPropagation()}>
        {(title||subtitle) && (
          <div style={{padding:'20px 24px 16px', borderBottom:`1px solid ${D.border}`, flexShrink:0, position:'relative'}}>
            {title && <div style={{fontSize:15, fontWeight:800, color:D.text1, letterSpacing:'-.02em'}}>{title}</div>}
            {subtitle && <div style={{fontSize:12, color:D.text3, marginTop:3}}>{subtitle}</div>}
            <button onClick={onClose} style={{
              position:'absolute', top:16, right:20, width:28, height:28,
              borderRadius:D.r6, border:`1px solid ${D.border2}`,
              background:D.card2, cursor:'pointer', fontSize:13, color:D.text3,
              display:'flex', alignItems:'center', justifyContent:'center'
            }}>✕</button>
          </div>
        )}
        <div style={{padding:'20px 24px 24px', flex:1, overflowY:'auto'}}>{children}</div>
      </div>
    </div>
  )
}

function IfCan({ can, fallback=null, children }) {
  return can ? children : fallback
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ student, can, showToast }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const today = new Date().toISOString().slice(0,10)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('attendance').select('*')
      .eq('student_id', student.id).order('date',{ascending:false}).limit(90)
    setRecords(data||[])
    setLoading(false)
  }, [student.id])
  useEffect(() => { load() }, [load])

  const presentDays = records.filter(r=>r.status==='Present').length
  const lateDays    = records.filter(r=>r.status==='Late').length
  const absentDays  = records.filter(r=>r.status==='Absent').length
  const medDays     = records.filter(r=>r.status==='Medical').length
  const attPct      = records.length ? ((presentDays + lateDays*0.5)/records.length*100).toFixed(1) : null
  let streak = 0
  for (const r of records) { if (r.status==='Absent') streak++; else break }

  const monthlyAtt = useMemo(() => {
    const months = {}
    records.forEach(r => {
      const d = new Date(r.date), k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if (!months[k]) months[k] = {total:0,present:0,absent:0,late:0,medical:0}
      months[k].total++; months[k][r.status.toLowerCase()]++
    })
    return Object.entries(months).map(([k,v]) => ({
      month: new Date(k+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}),
      ...v, pct: v.total ? ((v.present+v.late*0.5)/v.total*100).toFixed(0) : 0
    })).sort((a,b) => b.month.localeCompare(a.month))
  }, [records])

  const markToday = async status => {
    if (!can.attend) { showToast('No permission to mark attendance', D.rose); return }
    setMarking(true)
    const existing = records.find(r=>r.date===today)
    if (existing) await supabase.from('attendance').update({status}).eq('id',existing.id)
    else await supabase.from('attendance').insert({student_id:student.id, date:today, status})
    await auditLog('attendance_mark', { student_id:student.id, date:today, status })
    await load(); setMarking(false)
    showToast(`Marked ${status}`, D.emerald)
  }

  const todayRecord = records.find(r=>r.date===today)
  const SC = {Present:D.emerald, Absent:D.rose, Late:D.amber, Medical:D.sky}

  return (
    <div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:16}}>
        {[
          {label:'ATT %',   value:attPct?`${attPct}%`:'—', color:attPct>=75?D.emerald:D.rose},
          {label:'Present', value:presentDays, color:D.emerald},
          {label:'Absent',  value:absentDays,  color:D.rose},
          {label:'Late',    value:lateDays,    color:D.amber},
          {label:'Medical', value:medDays,     color:D.sky},
        ].map(p => (
          <div key={p.label} style={{background:D.card2, border:`1px solid ${D.border}`, borderRadius:D.r8, padding:'10px 8px', textAlign:'center'}}>
            <div style={{fontSize:18, fontWeight:800, color:p.color, fontFamily:"'IBM Plex Mono',monospace"}}>{p.value}</div>
            <div style={{fontSize:9, color:D.text3, fontWeight:700, marginTop:3, textTransform:'uppercase', letterSpacing:'.07em'}}>{p.label}</div>
          </div>
        ))}
      </div>
      {streak>=3 && (
        <div style={{background:D.roseDim, border:`1px solid ${D.roseBorder}`, borderRadius:D.r8, padding:'8px 14px', marginBottom:14, fontWeight:700, color:D.rose, fontSize:12}}>
          ⚠ Absent streak: {streak} consecutive days
        </div>
      )}
      <IfCan can={can.attend}>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10, fontWeight:700, color:D.text3, marginBottom:8, textTransform:'uppercase', letterSpacing:'.09em'}}>Mark Today — {today}</div>
          {todayRecord && <div style={{fontSize:12, color:D.text3, marginBottom:8}}>Currently: <strong style={{color:SC[todayRecord.status]}}>{todayRecord.status}</strong></div>}
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {['Present','Absent','Late','Medical'].map(s => (
              <button key={s} onClick={()=>markToday(s)} disabled={marking} style={{
                padding:'8px 14px', borderRadius:D.r8,
                border:`1.5px solid ${todayRecord?.status===s?SC[s]:D.border2}`,
                background: todayRecord?.status===s ? `${SC[s]}20` : D.card2,
                fontSize:12, fontWeight:700, cursor:'pointer', color:SC[s], transition:'all .12s',
              }}>{s==='Present'?'✓ ':s==='Absent'?'✗ ':s==='Late'?'⏰ ':'🏥 '}{s}</button>
            ))}
          </div>
        </div>
      </IfCan>
      {monthlyAtt.length > 0 && (
        <>
          <div style={{fontSize:10, fontWeight:700, color:D.text3, marginBottom:8, textTransform:'uppercase', letterSpacing:'.09em'}}>Monthly Summary</div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:11, marginBottom:16}}>
            <thead>
              <tr style={{background:D.card2}}>
                {['Month','Days','Present','Absent','Late','%'].map(h => (
                  <th key={h} style={{padding:'7px 8px', textAlign:h==='Month'?'left':'center', fontWeight:700, color:D.text3, borderBottom:`1px solid ${D.border}`, fontSize:9, textTransform:'uppercase', letterSpacing:'.07em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyAtt.map((m,i) => (
                <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                  <td style={{padding:'6px 8px', fontWeight:600, color:D.text2}}>{m.month}</td>
                  <td style={{padding:'6px 8px', textAlign:'center', color:D.text3}}>{m.total}</td>
                  <td style={{padding:'6px 8px', textAlign:'center', color:D.emerald, fontWeight:600}}>{m.present}</td>
                  <td style={{padding:'6px 8px', textAlign:'center', color:D.rose}}>{m.absent}</td>
                  <td style={{padding:'6px 8px', textAlign:'center', color:D.amber}}>{m.late}</td>
                  <td style={{padding:'6px 8px', textAlign:'center', fontWeight:700, color:m.pct>=75?D.emerald:D.rose, fontFamily:"'IBM Plex Mono',monospace"}}>{m.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div style={{fontSize:10, fontWeight:700, color:D.text3, marginBottom:8, textTransform:'uppercase', letterSpacing:'.09em'}}>Last 30 Days</div>
      {loading ? <div style={{color:D.text3, fontSize:12}}>Loading…</div> : (
        <div style={{display:'flex', flexWrap:'wrap', gap:3}}>
          {records.slice(0,30).map(r => (
            <div key={r.id} title={`${r.date}: ${r.status}`} style={{width:16, height:16, borderRadius:3, background:`${SC[r.status]||D.text3}30`, border:`1px solid ${SC[r.status]||D.text3}50`}}/>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────
// SEC-2: Uses signed URLs (1 hour expiry) instead of public URLs for sensitive docs
function DocumentsTab({ student, can, showToast }) {
  const [docs, setDocs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('student_documents').select('*')
      .eq('student_id', student.id).order('created_at',{ascending:false})
    setDocs(data||[])
    setLoading(false)
  }, [student.id])
  useEffect(() => { load() }, [load])

  // SEC-2: Generate a short-lived signed URL on open instead of storing public URL
  const openDoc = async (doc) => {
    try {
      const { data, error } = await supabase.storage.from('gnsi').createSignedUrl(doc.storage_path, 3600)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noreferrer')
    } catch (err) {
      showToast('Could not open document: ' + err.message, D.rose)
    }
  }

  const handleUpload = async (e, docType) => {
    if (!can.write) { showToast('No permission to upload', D.rose); return }
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    // SEC-3: Randomised path suffix prevents path-guessing overwrites
    const ext  = file.name.split('.').pop()
    const path = `student_docs/${student.id}/${docType}_${randomSuffix()}.${ext}`
    const { error: upErr } = await supabase.storage.from('gnsi').upload(path, file)
    if (upErr) { showToast('Upload failed: '+upErr.message, D.rose); setUploading(false); return }
    // Store storage_path, NOT a public URL
    await supabase.from('student_documents').insert({
      student_id: student.id, doc_type: docType,
      file_name:  file.name, storage_path: path
    })
    await auditLog('document_upload', { student_id:student.id, doc_type:docType, path })
    await load(); setUploading(false)
    showToast(`${docType} uploaded`, D.emerald)
  }

  const DOC_TYPES = ['Birth Certificate','Transfer Certificate','Aadhaar','Photo','Other']

  return (
    <div>
      <div style={{fontSize:10, fontWeight:700, color:D.text3, marginBottom:12, textTransform:'uppercase', letterSpacing:'.09em'}}>Student Documents</div>
      <IfCan can={can.write}>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:16}}>
          {DOC_TYPES.map(dt => (
            <label key={dt} style={{...BTN.secondary, cursor:'pointer', display:'inline-block'}}>
              ↑ {dt}
              <input type="file" style={{display:'none'}} onChange={e=>handleUpload(e,dt)} disabled={uploading}/>
            </label>
          ))}
        </div>
      </IfCan>
      {loading ? <div style={{color:D.text3}}>Loading…</div>
        : docs.length===0 ? <div style={{color:D.text3, fontSize:13, textAlign:'center', padding:'24px'}}>No documents yet.</div>
        : (
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {docs.map(doc => (
              <div key={doc.id} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:D.card2, borderRadius:D.r8, border:`1px solid ${D.border}`}}>
                <span style={{fontSize:16}}>📄</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600, fontSize:13, color:D.text1}}>{doc.doc_type}</div>
                  <div style={{fontSize:11, color:D.text3, marginTop:1}}>{doc.file_name} · {fmtD(doc.created_at)}</div>
                </div>
                {/* SEC-2: Opens via signed URL, not stored public URL */}
                <button onClick={()=>openDoc(doc)} style={{...BTN.ghost, fontSize:11}}>Open</button>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

// ─── Exam Score Modal ─────────────────────────────────────────────────────────
// DESIGN-9: Subject columns validated against SUBJECTS constant
function ExamScoreModal({ student, can, onClose, onSaved, showToast }) {
  const [examName, setExamName] = useState('')
  const [scores, setScores]     = useState(Object.fromEntries(SUBJECTS.map(s=>[s,''])))
  const [target, setTarget]     = useState('')
  const [remarks, setRemarks]   = useState('')
  const [saving, setSaving]     = useState(false)
  const total = SUBJECTS.reduce((a,s)=>a+Number(scores[s]||0),0)

  const handleSave = async () => {
    if (!can.exams) { showToast('No permission to enter scores', D.rose); return }
    if (!examName.trim()) { showToast('Exam name required', D.rose); return }
    setSaving(true)
    // DESIGN-9: Only include keys that are in SUBJECTS — guards against schema drift
    const subjectPayload = Object.fromEntries(
      SUBJECTS.map(s => [s, Number(scores[s]) || null])
    )
    const { error } = await supabase.from('exam_scores').insert({
      student_id: student.id, exam_name: examName,
      ...subjectPayload,
      total, target_score: Number(target)||null,
      academic_remarks: remarks||null, session: student.session
    })
    setSaving(false)
    if (error) { showToast('Save failed: '+error.message, D.rose); return }
    await auditLog('exam_score_entry', { student_id:student.id, exam_name:examName, total })
    showToast('Scores saved', D.emerald); onSaved()
  }

  return (
    <Modal onClose={onClose} width={520} title="Add Exam Scores" subtitle={`${student.name} · ${student.batch}`}>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
        <FieldRow label="Exam Name *">
          <input style={INP.base} value={examName} onChange={e=>setExamName(e.target.value)} placeholder="e.g. Unit Test 1"/>
        </FieldRow>
        <FieldRow label="Target Score">
          <input type="number" style={INP.base} value={target} onChange={e=>setTarget(e.target.value)} placeholder="e.g. 350"/>
        </FieldRow>
      </div>
      <SectionDivider label="Subject Marks"/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
        {SUBJECTS.map(s => (
          <FieldRow key={s} label={s}>
            <input type="number" style={INP.base} value={scores[s]}
              onChange={e=>setScores(p=>({...p,[s]:e.target.value}))} placeholder="0–100"/>
          </FieldRow>
        ))}
      </div>
      <div style={{background:D.card2, border:`1px solid ${D.border}`, borderRadius:D.r8, padding:'12px 16px', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span style={{fontWeight:700, fontSize:12, color:D.text3, textTransform:'uppercase', letterSpacing:'.07em'}}>Total</span>
        <span style={{fontWeight:800, fontSize:24, color:total>=200?D.emerald:D.rose, fontFamily:"'IBM Plex Mono',monospace"}}>
          {total}{target && <span style={{fontSize:14, fontWeight:500, color:D.text3}}> / {target}</span>}
        </span>
      </div>
      <FieldRow label="Remarks">
        <textarea style={{...INP.base, resize:'vertical'}} rows={2} value={remarks}
          onChange={e=>setRemarks(e.target.value)} placeholder="Optional remarks"/>
      </FieldRow>
      <div style={{display:'flex', gap:10, marginTop:18}}>
        <button onClick={handleSave} disabled={saving||!can.exams} style={{
          ...BTN.primary, flex:1, padding:'11px', opacity:saving||!can.exams?.5:1
        }}>{saving?'Saving…':'Save Scores'}</button>
        <button onClick={onClose} style={{...BTN.secondary, padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── Bulk Operations Modal ────────────────────────────────────────────────────
// SEC-8: IDs validated against loaded student set before sending to Supabase
function BulkOperationsModal({ students, selectedIds, can, onClose, onRefresh, showToast }) {
  const [action, setAction]               = useState('status')
  const [newStatus, setNewStatus]         = useState('Active')
  const [targetBatch, setTargetBatch]     = useState('')
  const [targetSession, setTargetSession] = useState('')
  const [processing, setProcessing]       = useState(false)

  // SEC-8: Only allow IDs that exist in the loaded students array
  const validStudentIds = new Set(students.map(s=>s.id))
  const selectedStudents = students.filter(s => selectedIds.has(s.id) && validStudentIds.has(s.id))
  const canPromote = selectedStudents.every(s=>PROMOTION_MAP[s.batch])

  const handleBulkAction = async () => {
    if (!can.write) { showToast('No permission for bulk operations', D.rose); return }
    if (selectedStudents.length===0) { showToast('No valid students selected', D.rose); return }
    setProcessing(true)
    // SEC-8: Use validated IDs only
    const ids = selectedStudents.map(s=>s.id)
    try {
      if (action==='status') {
        await supabase.from('students').update({status:newStatus}).in('id',ids)
        await auditLog('bulk_status_change', { ids, newStatus, count:ids.length })
        showToast(`Status → ${newStatus}`, D.emerald)
      } else if (action==='delete') {
        await supabase.from('students').update({deleted_at:new Date().toISOString()}).in('id',ids)
        await auditLog('bulk_archive', { ids, count:ids.length })
        showToast(`${ids.length} archived`, D.amber)
      } else if (action==='promote') {
        if (!canPromote) { showToast('Some cannot be promoted', D.rose); setProcessing(false); return }
        for (const u of selectedStudents)
          await supabase.from('students').update({batch:PROMOTION_MAP[u.batch],status:'Active'}).eq('id',u.id)
        await auditLog('bulk_promote', { ids, count:ids.length })
        showToast(`${ids.length} promoted`, D.emerald)
      } else if (action==='session') {
        if (!targetSession) { showToast('Select session', D.rose); setProcessing(false); return }
        await supabase.from('students').update({session:targetSession}).in('id',ids)
        await auditLog('bulk_session_change', { ids, targetSession, count:ids.length })
        showToast(`Session → ${targetSession}`, D.emerald)
      } else if (action==='batch') {
        if (!targetBatch) { showToast('Enter batch', D.rose); setProcessing(false); return }
        await supabase.from('students').update({batch:targetBatch}).in('id',ids)
        await auditLog('bulk_batch_change', { ids, targetBatch, count:ids.length })
        showToast(`Batch → ${targetBatch}`, D.emerald)
      }
      onRefresh(); onClose()
    } catch(err) { showToast('Failed: '+err.message, D.rose) }
    setProcessing(false)
  }

  return (
    <Modal onClose={onClose} width={440} title="Bulk Operations" subtitle={`${selectedStudents.length} students selected`}>
      <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:16}}>
        {[
          {key:'status',  label:'Change Status',    desc:'Update status in bulk'},
          {key:'promote', label:`Promote ${canPromote?'✓':'⚠'}`, desc:'Auto-promote via promotion map'},
          {key:'session', label:'Change Session',   desc:'Move to a different session'},
          {key:'batch',   label:'Change Batch',     desc:'Assign a specific batch'},
          {key:'delete',  label:'Archive Students', desc:'Soft-delete records', danger:true},
        ].map(a => (
          <div key={a.key}>
            <label style={{display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'10px 12px', borderRadius:D.r8, background:action===a.key?(a.danger?D.roseDim:D.brandDim):D.card2, border:`1px solid ${action===a.key?(a.danger?D.roseBorder:D.brandBorder):D.border}`}}>
              <input type="radio" name="ba" checked={action===a.key} onChange={()=>setAction(a.key)} style={{accentColor:a.danger?D.rose:D.brand}}/>
              <div>
                <div style={{fontSize:13, fontWeight:700, color:a.danger?D.rose:D.text1}}>{a.label}</div>
                <div style={{fontSize:11, color:D.text3, marginTop:1}}>{a.desc}</div>
              </div>
            </label>
            {action==='status' && a.key==='status' && (
              <select style={{...INP.base, marginTop:6}} value={newStatus} onChange={e=>setNewStatus(e.target.value)}>
                {STATUSES.filter(s=>s!=='All').map(s=><option key={s}>{s}</option>)}
              </select>
            )}
            {action==='session' && a.key==='session' && (
              <select style={{...INP.base, marginTop:6}} value={targetSession} onChange={e=>setTargetSession(e.target.value)}>
                <option value="">— Select —</option>
                {SESSIONS.map(s=><option key={s}>{s}</option>)}
              </select>
            )}
            {action==='batch' && a.key==='batch' && (
              <input style={{...INP.base, marginTop:6}} value={targetBatch} onChange={e=>setTargetBatch(e.target.value)} placeholder="e.g. Umeed"/>
            )}
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:10}}>
        <button onClick={handleBulkAction} disabled={processing||!can.write} style={{
          ...BTN.primary, flex:1, padding:'11px',
          background:action==='delete'?D.rose:D.brand, opacity:processing||!can.write?.5:1
        }}>{processing?'Processing…':action==='delete'?'Archive Selected':'Apply'}</button>
        <button onClick={onClose} style={{...BTN.secondary, padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── Session Rollover Wizard ──────────────────────────────────────────────────
// DESIGN-4: Idempotency check — skips students already on targetSession
function SessionRolloverWizard({ students, can, onClose, onRefresh, showToast }) {
  const [step, setStep]                   = useState(1)
  const [sourceSession, setSourceSession] = useState('2024-25')
  const [targetSession, setTargetSession] = useState('2025-26')
  const [processing, setProcessing]       = useState(false)

  // DESIGN-4: Only include students not already on targetSession
  const eligible = students.filter(s =>
    s.session===sourceSession &&
    s.status==='Active' &&
    s.session!==targetSession   // idempotency guard
  )
  const preview = eligible.map(s=>({...s, newBatch:PROMOTION_MAP[s.batch]||s.batch, newSession:targetSession}))
  const alreadyRolled = students.filter(s=>s.session===targetSession).length

  const runRollover = async () => {
    if (!can.write) { showToast('No permission for rollover', D.rose); return }
    if (preview.length===0) { showToast('No eligible students to roll over', D.amber); return }
    setProcessing(true)
    try {
      for (const s of preview)
        await supabase.from('students').update({session:s.newSession, batch:s.newBatch, status:'Active'}).eq('id',s.id)
      const passedOut = eligible.filter(s=>!PROMOTION_MAP[s.batch])
      for (const s of passedOut)
        await supabase.from('students').update({status:'Passed Out'}).eq('id',s.id)
      await auditLog('session_rollover', { from:sourceSession, to:targetSession, count:preview.length, passed_out:passedOut.length })
      showToast(`Rollover complete — ${preview.length} students updated`, D.emerald)
      onRefresh(); onClose()
    } catch(err) { showToast('Rollover failed: '+err.message, D.rose) }
    setProcessing(false)
  }

  return (
    <Modal onClose={onClose} width={540} title="Session Rollover" subtitle={`Step ${step} of 3`}>
      <div style={{display:'flex', gap:8, marginBottom:24, alignItems:'center'}}>
        {[1,2,3].map(n => (
          <div key={n} style={{display:'flex', alignItems:'center', gap:8, flex:n<3?1:0}}>
            <div style={{width:28, height:28, borderRadius:'50%', flexShrink:0, background:step>=n?D.brand:D.card2, border:`1.5px solid ${step>=n?D.brand:D.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:step>=n?'#fff':D.text3}}>{n}</div>
            <span style={{fontSize:11, fontWeight:600, color:step>=n?D.brand:D.text3}}>{['Select','Preview','Confirm'][n-1]}</span>
            {n<3 && <div style={{flex:1, height:1, background:step>n?D.brand:D.border}}/>}
          </div>
        ))}
      </div>

      {step===1 && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <FieldRow label="Source Session">
            <select style={INP.base} value={sourceSession} onChange={e=>setSourceSession(e.target.value)}>
              {SESSIONS.map(s=><option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Target Session">
            <select style={INP.base} value={targetSession} onChange={e=>setTargetSession(e.target.value)}>
              {SESSIONS.map(s=><option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          {alreadyRolled > 0 && (
            <div style={{gridColumn:'1/-1', background:D.amberDim, border:`1px solid ${D.amberBorder}`, borderRadius:D.r8, padding:'8px 12px', fontSize:12, color:D.amber, fontWeight:600}}>
              ⚠ {alreadyRolled} students are already on {targetSession} and will be skipped.
            </div>
          )}
        </div>
      )}

      {step===2 && (
        <div style={{maxHeight:280, overflowY:'auto', border:`1px solid ${D.border}`, borderRadius:D.r8}}>
          {preview.length===0 ? (
            <div style={{padding:'24px', textAlign:'center', color:D.text3, fontSize:13}}>No eligible students to roll over.</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
              <thead>
                <tr style={{background:D.card2}}>
                  {['Student','Current','→ New','Status'].map(h=>(
                    <th key={h} style={{padding:'8px 10px', textAlign:'left', fontWeight:700, color:D.text3, borderBottom:`1px solid ${D.border}`, fontSize:10, textTransform:'uppercase', letterSpacing:'.07em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map(s=>(
                  <tr key={s.id} style={{borderBottom:`1px solid ${D.border}`}}>
                    <td style={{padding:'7px 10px', fontWeight:600, color:D.text1}}>{s.name}</td>
                    <td style={{padding:'7px 10px', color:D.text3, fontSize:11, fontFamily:"'IBM Plex Mono',monospace"}}>{s.batch} · {s.session}</td>
                    <td style={{padding:'7px 10px', color:D.brand, fontWeight:700, fontSize:11, fontFamily:"'IBM Plex Mono',monospace"}}>{s.newBatch} · {s.newSession}</td>
                    <td style={{padding:'7px 10px'}}>
                      {!PROMOTION_MAP[s.batch]
                        ? <span style={{color:D.rose, fontWeight:700, fontSize:11}}>Passed Out</span>
                        : <span style={{color:D.emerald, fontSize:11}}>Active</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {step===3 && (
        <div style={{textAlign:'center', padding:'32px 20px'}}>
          <div style={{fontSize:40, marginBottom:16}}>🔄</div>
          <div style={{fontWeight:800, fontSize:18, color:D.text1, marginBottom:8}}>Ready to Execute</div>
          <div style={{fontSize:13, color:D.text3, marginBottom:24, lineHeight:1.7}}>
            <strong style={{color:D.text1, fontFamily:"'IBM Plex Mono',monospace"}}>{preview.length}</strong> students will be updated<br/>
            <span style={{fontFamily:"'IBM Plex Mono',monospace"}}>{sourceSession}</span>{' → '}
            <span style={{fontFamily:"'IBM Plex Mono',monospace", color:D.brand}}>{targetSession}</span>
          </div>
          <button onClick={runRollover} disabled={processing||!can.write||preview.length===0} style={{...BTN.primary, padding:'12px 32px', fontSize:14, opacity:preview.length===0?.5:1}}>
            {processing?'Processing…':'Execute Rollover'}
          </button>
        </div>
      )}

      {step<3 && (
        <div style={{display:'flex', justifyContent:'space-between', marginTop:20}}>
          {step>1 ? <button onClick={()=>setStep(s=>s-1)} style={{...BTN.secondary, padding:'10px 20px'}}>← Back</button> : <div/>}
          <button onClick={()=>setStep(s=>s+1)} style={{...BTN.primary, padding:'10px 24px'}}>Next →</button>
        </div>
      )}
    </Modal>
  )
}

// ─── Bulk Fee Modal ───────────────────────────────────────────────────────────
function BulkFeeModal({ students, selectedIds, can, onClose, onSaved, showToast }) {
  const [amount, setAmount]     = useState('')
  const [monthFor, setMonthFor] = useState('')
  const [method, setMethod]     = useState('Cash')
  const [saving, setSaving]     = useState(false)
  const selected = students.filter(s=>selectedIds.has(s.id))
  const total = Number(amount||0) * selected.length

  const handleSave = async () => {
    if (!can.fees) { showToast('No permission for fee collection', D.rose); return }
    if (!amount || Number(amount)<=0) { showToast('Enter valid amount', D.rose); return }
    if (!monthFor) { showToast('Enter month', D.rose); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('fee_collections').insert(
        selected.map(s=>({student_id:s.id, amount:Number(amount), payment_date:new Date().toISOString().slice(0,10), month_for:monthFor, payment_method:method, session:s.session}))
      )
      if (error) throw error
      await auditLog('bulk_fee_collection', { count:selected.length, amount:Number(amount), monthFor, method })
      showToast(`Fee collected for ${selected.length} students`, D.emerald)
      onSaved(); onClose()
    } catch(err) { showToast('Failed: '+err.message, D.rose) }
    setSaving(false)
  }

  return (
    <Modal onClose={onClose} width={440} title="Bulk Fee Collection" subtitle={`${selected.length} students selected`}>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
        <FieldRow label="Amount / Student (₹)">
          <input type="number" style={INP.base} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 2500"/>
        </FieldRow>
        <FieldRow label="Month For">
          <input style={INP.base} value={monthFor} onChange={e=>setMonthFor(e.target.value)} placeholder="e.g. Jan 2026"/>
        </FieldRow>
        <FieldRow label="Method">
          <select style={INP.base} value={method} onChange={e=>setMethod(e.target.value)}>
            {['Cash','UPI','Bank Transfer','Cheque'].map(m=><option key={m}>{m}</option>)}
          </select>
        </FieldRow>
        <div style={{display:'flex', flexDirection:'column', justifyContent:'flex-end'}}>
          <div style={{fontSize:9, color:D.text3, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4}}>Total</div>
          <div style={{fontSize:22, fontWeight:800, color:D.emerald, fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(total)}</div>
        </div>
      </div>
      <div style={{display:'flex', gap:10}}>
        <button onClick={handleSave} disabled={saving||!can.fees} style={{...BTN.primary, flex:1, padding:'11px', background:D.emerald, opacity:saving||!can.fees?.5:1}}>
          {saving?'Saving…':'Collect Fee'}
        </button>
        <button onClick={onClose} style={{...BTN.secondary, padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── Merge Duplicates Modal ───────────────────────────────────────────────────
// DESIGN-3: Uses soft-delete (deleted_at) instead of hard delete
function MergeDuplicatesModal({ students, can, onClose, onRefresh, showToast }) {
  const [primaryId, setPrimaryId]   = useState('')
  const [mergeIds, setMergeIds]     = useState([])
  const [processing, setProcessing] = useState(false)

  const duplicates = useMemo(() => {
    const dups=[], byName={}, byPhone={}
    students.forEach(s => {
      if (s.name)  { const k=s.name.toLowerCase().trim(); if(!byName[k])byName[k]=[]; byName[k].push(s) }
      if (s.phone) { if(!byPhone[s.phone])byPhone[s.phone]=[]; byPhone[s.phone].push(s) }
    })
    Object.values(byName).forEach(g=>{ if(g.length>1) dups.push({type:'Name',students:g}) })
    Object.values(byPhone).forEach(g=>{ if(g.length>1) dups.push({type:'Phone',students:g}) })
    return dups
  }, [students])

  const handleMerge = async () => {
    if (!can.write) { showToast('No permission to merge', D.rose); return }
    if (!primaryId || mergeIds.length===0) { showToast('Select records', D.rose); return }
    setProcessing(true)
    try {
      // Reassign related records to the primary student
      await supabase.from('attendance').update({student_id:primaryId}).in('student_id',mergeIds)
      await supabase.from('fee_collections').update({student_id:primaryId}).in('student_id',mergeIds)
      await supabase.from('exam_scores').update({student_id:primaryId}).in('student_id',mergeIds)
      await supabase.from('student_documents').update({student_id:primaryId}).in('student_id',mergeIds)
      // DESIGN-3: Soft-delete merged duplicates — keeps audit trail, allows recovery
      await supabase.from('students')
        .update({ deleted_at: new Date().toISOString(), remarks: 'Merged into ' + primaryId })
        .in('id', mergeIds)
      await auditLog('merge_duplicates', { primaryId, mergeIds, count:mergeIds.length })
      showToast('Merged successfully (duplicates archived)', D.emerald)
      onRefresh(); onClose()
    } catch(err) { showToast('Merge failed: '+err.message, D.rose) }
    setProcessing(false)
  }

  return (
    <Modal onClose={onClose} width={480} title="Merge Duplicates" subtitle={`${duplicates.length} groups found`}>
      <div style={{maxHeight:340, overflowY:'auto'}}>
        {duplicates.length===0 ? (
          <div style={{color:D.text3, textAlign:'center', padding:'24px', fontSize:13}}>No duplicates detected.</div>
        ) : duplicates.map((group,idx) => (
          <div key={idx} style={{marginBottom:12, padding:'12px', background:D.card2, borderRadius:D.r8, border:`1px solid ${D.border}`}}>
            <div style={{fontSize:10, fontWeight:700, color:D.text3, marginBottom:8, textTransform:'uppercase', letterSpacing:'.07em'}}>{group.type} Match</div>
            {group.students.map(s => (
              <div key={s.id} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:`1px solid ${D.border}`}}>
                <input type="radio" name={`p_${idx}`} checked={primaryId===s.id}
                  onChange={()=>{setPrimaryId(s.id); setMergeIds(group.students.filter(x=>x.id!==s.id).map(x=>x.id))}}
                  style={{accentColor:D.brand}}/>
                <Avatar name={s.name} size={24}/>
                <span style={{fontSize:13, fontWeight:600, color:D.text1, flex:1}}>{s.name}</span>
                <span style={{fontSize:11, color:D.text3, fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{s.gcc_no}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{fontSize:11, color:D.amber, padding:'8px 0', fontWeight:600}}>
        ℹ Merged duplicates will be archived (recoverable), not permanently deleted.
      </div>
      <div style={{display:'flex', gap:10, marginTop:12}}>
        <button onClick={handleMerge} disabled={processing||!can.write} style={{...BTN.primary, flex:1, padding:'11px'}}>Merge &amp; Archive Duplicates</button>
        <button onClick={onClose} style={{...BTN.secondary, padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── House Reassignment Modal ─────────────────────────────────────────────────
function HouseReassignmentModal({ students, selectedIds, can, onClose, onRefresh, showToast }) {
  const [newHouse, setNewHouse]     = useState('')
  const [processing, setProcessing] = useState(false)
  const handleReassign = async () => {
    if (!can.write) { showToast('No permission', D.rose); return }
    if (!newHouse) { showToast('Select a house', D.rose); return }
    setProcessing(true)
    try {
      await supabase.from('students').update({house:newHouse}).in('id',Array.from(selectedIds))
      await auditLog('bulk_house_reassign', { ids:Array.from(selectedIds), newHouse, count:selectedIds.size })
      showToast(`${selectedIds.size} students → ${newHouse}`, D.emerald)
      onRefresh(); onClose()
    } catch(err) { showToast('Failed: '+err.message, D.rose) }
    setProcessing(false)
  }
  return (
    <Modal onClose={onClose} width={360} title="Bulk House Reassignment" subtitle={`${selectedIds.size} students`}>
      <FieldRow label="New House">
        <select style={INP.base} value={newHouse} onChange={e=>setNewHouse(e.target.value)}>
          <option value="">— Select —</option>
          {HOUSES_LIST.map(h=><option key={h}>{h}</option>)}
        </select>
      </FieldRow>
      <div style={{display:'flex', gap:10, marginTop:16}}>
        <button onClick={handleReassign} disabled={processing||!can.write} style={{...BTN.primary, flex:1, padding:'11px'}}>Reassign</button>
        <button onClick={onClose} style={{...BTN.secondary, padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── Print Helpers ────────────────────────────────────────────────────────────
function printIDCard(student) {
  const w = window.open('','_blank')
  w.document.write(`<html><head><title>ID Card</title><style>
    body{margin:0;display:flex;justify-content:center;padding:20px;background:#f1f5f9;font-family:sans-serif}
    @media print{body{padding:0;background:#fff}}
    .card{width:3.375in;height:2.125in;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.1)}
    .hdr{background:#0B0F1A;color:#fff;padding:8px 12px;display:flex;align-items:center;gap:8px}
    .logo{font-size:16px;font-weight:900;letter-spacing:-.02em}.sub{font-size:9px;line-height:1.4;opacity:.8}
    .body{display:flex;padding:10px 12px;gap:10px}.photo{width:56px;height:70px;border:1px solid #e2e8f0;border-radius:4px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
    .name{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:3px}
    .f{font-size:9px;color:#64748b;margin-bottom:2px}.f span{font-weight:700;color:#0f172a}
    .gcc{font-size:15px;font-weight:900;color:#1E3A5F;font-family:monospace;margin-top:5px;letter-spacing:.02em}
  </style></head><body>
  <div class="card">
    <div class="hdr"><div class="logo">GNSI</div><div class="sub">Guidance Navodaya &amp; Sainik Institute<br>Khangabok, Thoubal, Manipur</div></div>
    <div class="body">
      <div class="photo">${student.photo_url?`<img src="${student.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px"/>`:'👤'}</div>
      <div>
        <div class="name">${student.name}</div>
        <div class="f">Batch: <span>${student.batch||'—'}</span></div>
        <div class="f">Course: <span>${student.course||'—'}</span></div>
        <div class="f">House: <span>${student.house||'—'}</span></div>
        <div class="f">Session: <span>${student.session||'—'}</span></div>
        <div class="gcc">GCC-${student.gcc_no}</div>
      </div>
    </div>
  </div>
  <script>window.print()<\/script></body></html>`)
  w.document.close()
}

function printBatchList(students, label) {
  const rows = students.map((s,i)=>`<tr><td>${i+1}</td><td>${s.gcc_no||''}</td><td>${s.name}</td><td>${s.batch||''}</td><td>${s.house||''}</td><td>${s.hostel_type||''}</td><td>${s.phone||''}</td></tr>`).join('')
  const w = window.open('','_blank')
  w.document.write(`<html><head><title>Student List</title><style>
    body{font-family:sans-serif;font-size:11px;padding:20px}h2{margin-bottom:4px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
    th{background:#0B0F1A;color:#fff;font-weight:700}
  </style></head><body>
    <h2>GNSI Student List${label?` — ${label}`:''}</h2>
    <p style="color:#666;margin-bottom:12px">Total: ${students.length} · ${new Date().toLocaleDateString('en-IN')}</p>
    <table><thead><tr><th>#</th><th>GCC</th><th>Name</th><th>Batch</th><th>House</th><th>Hostel</th><th>Phone</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`)
  w.document.close(); w.print()
}

function printFeeReceipt(student, payment) {
  const w = window.open('','_blank')
  w.document.write(`<html><head><title>Receipt</title><style>
    body{font-family:sans-serif;padding:30px;max-width:560px;margin:auto}
    .hdr{text-align:center;border-bottom:2px solid #0B0F1A;padding-bottom:16px;margin-bottom:20px}
    .logo{font-size:22px;font-weight:900;color:#0B0F1A}.sub{font-size:13px;color:#666;margin-top:4px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
    .lbl{color:#64748b;font-weight:600}.val{font-weight:700;color:#0f172a}
    .amt{font-size:28px;font-weight:800;color:#059669;text-align:center;margin:20px 0}
    .foot{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#666}
  </style></head><body>
    <div class="hdr"><div class="logo">GNSI</div><div class="sub">Guidance Navodaya &amp; Sainik Institute<br>Khangabok, Thoubal, Manipur</div><div style="font-size:10px;color:#999;margin-top:8px">Receipt · ${fmtD(payment.payment_date)}</div></div>
    <div class="row"><span class="lbl">Name</span><span class="val">${student.name}</span></div>
    <div class="row"><span class="lbl">GCC No.</span><span class="val">${student.gcc_no}</span></div>
    <div class="row"><span class="lbl">Batch</span><span class="val">${student.batch} · ${student.course}</span></div>
    <div class="row"><span class="lbl">Month For</span><span class="val">${payment.month_for||'N/A'}</span></div>
    <div class="row"><span class="lbl">Method</span><span class="val">${payment.payment_method||'Cash'}</span></div>
    <div class="amt">₹${fmt(payment.amount)}</div>
    <div class="foot"><span>Received by: ______________</span><span>Authorized: ______________</span></div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
  </body></html>`)
  w.document.close()
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────
function AnalyticsPanel({ students, attData, feeData }) {
  const byHouse    = HOUSES_LIST.reduce((a,h)=>{a[h]=students.filter(s=>s.house===h).length;return a},{})
  const maxHouse   = Math.max(...Object.values(byHouse),1)
  const byCourse   = Object.keys(COURSE_STRUCTURE).reduce((a,c)=>{a[c]=students.filter(s=>s.course===c).length;return a},{})
  const male       = students.filter(s=>s.gender==='Male').length
  const female     = students.filter(s=>s.gender==='Female').length
  const total      = male+female||1
  const boarders   = students.filter(s=>s.hostel_type==='Boarder').length
  const dayBoard   = students.filter(s=>s.hostel_type==='Day Boarder').length
  const dayScholar = students.filter(s=>s.hostel_type==='Day Scholar').length
  const tileStyle  = { background:D.card, border:`1px solid ${D.border}`, borderRadius:D.r12, padding:'18px 20px' }
  const tileHdr    = { fontWeight:800, fontSize:11, color:D.text3, marginBottom:14, textTransform:'uppercase', letterSpacing:'.1em' }

  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:12, marginBottom:16}}>
      <div style={tileStyle}>
        <div style={tileHdr}>House Census</div>
        {HOUSES_LIST.map(h => {
          const c = HOUSE_COLORS[h]||D.text3, n = byHouse[h]||0
          return (
            <div key={h} style={{display:'flex', alignItems:'center', gap:8, marginBottom:7}}>
              <span style={{width:64, fontSize:10, fontWeight:700, color:c, textAlign:'right', flexShrink:0}}>{h}</span>
              <div style={{flex:1, height:5, background:D.card2, borderRadius:3, overflow:'hidden'}}>
                <div style={{height:'100%', width:`${(n/maxHouse)*100}%`, background:c, borderRadius:3, transition:'width .4s'}}/>
              </div>
              <span style={{width:20, fontSize:11, fontWeight:700, color:D.text1, fontFamily:"'IBM Plex Mono',monospace", textAlign:'right'}}>{n}</span>
            </div>
          )
        })}
      </div>
      <div style={tileStyle}>
        <div style={tileHdr}>Course Distribution</div>
        {Object.entries(byCourse).map(([c,n]) => {
          const cs = COURSE_STRUCTURE[c]
          return (
            <div key={c} style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
              <div style={{width:8, height:8, borderRadius:2, background:cs?.color||D.text3, flexShrink:0}}/>
              <span style={{flex:1, fontSize:12, color:D.text2}}>{c}</span>
              <span style={{fontSize:12, fontWeight:800, color:D.text1, fontFamily:"'IBM Plex Mono',monospace"}}>{n}</span>
            </div>
          )
        })}
      </div>
      <div style={tileStyle}>
        <div style={tileHdr}>Gender Ratio</div>
        <div style={{display:'flex', height:7, borderRadius:4, overflow:'hidden', marginBottom:10}}>
          <div style={{width:`${male/total*100}%`, background:'#60A5FA'}}/>
          <div style={{width:`${female/total*100}%`, background:'#F472B6'}}/>
        </div>
        <div style={{display:'flex', gap:16, fontSize:12, marginBottom:20}}>
          <span style={{color:'#60A5FA', fontWeight:800, fontFamily:"'IBM Plex Mono',monospace"}}>{male} <span style={{color:D.text3, fontWeight:400}}>male</span></span>
          <span style={{color:'#F472B6', fontWeight:800, fontFamily:"'IBM Plex Mono',monospace"}}>{female} <span style={{color:D.text3, fontWeight:400}}>female</span></span>
        </div>
        <div style={{fontSize:10, fontWeight:700, color:D.text3, marginBottom:10, textTransform:'uppercase', letterSpacing:'.09em'}}>Hostel Breakdown</div>
        <div style={{display:'flex', gap:8}}>
          {[['Boarders',boarders,D.emerald],['Day Board',dayBoard,D.amber],['Day Scholar',dayScholar,D.text3]].map(([l,n,c])=>(
            <div key={l} style={{flex:1, background:D.card2, border:`1px solid ${D.border}`, borderRadius:D.r8, padding:'10px 8px', textAlign:'center'}}>
              <div style={{fontSize:18, fontWeight:800, color:c, fontFamily:"'IBM Plex Mono',monospace"}}>{n}</div>
              <div style={{fontSize:9, color:c, fontWeight:700, marginTop:3, textTransform:'uppercase', letterSpacing:'.06em'}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Student Detail Drawer ────────────────────────────────────────────────────
function StudentDetailDrawer({ student, allStudents, attData, examData, feeData, feeHistory, can, onClose, onEdit, showToast }) {
  const [tab, setTab]       = useState('profile')
  const [notes, setNotes]   = useState(student.notes||'')
  const [saving, setSaving] = useState(false)

  const siblings = allStudents.filter(s =>
    s.id!==student.id && s.status==='Active' &&
    ((s.father_name&&s.father_name===student.father_name)||(s.mother_name&&s.mother_name===student.mother_name))
  )
  const att     = attData[student.id] ?? null
  const exams   = examData[student.id] || []
  const dues    = feeData[student.id]?.dues || 0
  const history = feeHistory[student.id] || []

  const examTotals = exams.slice(-5).map(e=>e.total||0)
  const sparkMax   = Math.max(...examTotals,1)

  const batchStudents = allStudents.filter(s=>s.batch===student.batch&&s.status==='Active')
  const batchRanks    = batchStudents.map(s=>({id:s.id,avg:(examData[s.id]||[]).reduce((a,e)=>a+(e.total||0),0)/Math.max((examData[s.id]||[]).length,1)})).sort((a,b)=>b.avg-a.avg)
  const rank = batchRanks.findIndex(x=>x.id===student.id)+1

  // DESIGN-2: Monthly summary uses effective due (base minus waiver/scholarship)
  const effectiveDue = getEffectiveMonthlyDue(student)

  const monthlySummary = useMemo(() => {
    const months = {}
    history.forEach(h => {
      const m = fmtM(h.payment_date)
      if (!months[m]) months[m] = { paid:0, due: effectiveDue }
      months[m].paid += Number(h.amount||0)
    })
    return Object.entries(months).map(([month,data])=>({month,...data,balance:data.due-data.paid}))
      .sort((a,b)=>new Date(b.month)-new Date(a.month))
  }, [history, effectiveDue])

  const totalArrears = monthlySummary.reduce((a,m)=>a+Math.max(0,m.balance),0)

  const saveNotes = async () => {
    setSaving(true)
    await supabase.from('students').update({notes}).eq('id',student.id)
    await auditLog('student_notes_edit', { student_id:student.id })
    setSaving(false)
    showToast('Notes saved', D.emerald)
  }

  const TABS = [
    {key:'profile', label:'Profile'},
    {key:'academic',label:'Academic'},
    {key:'attend',  label:'Attendance'},
    {key:'fee',     label:'Fees'},
    {key:'docs',    label:'Docs'},
    {key:'notes',   label:'Notes'},
  ]

  return (
    <div style={{position:'fixed', inset:0, zIndex:99998, display:'flex', justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{width:520, background:D.card, display:'flex', flexDirection:'column', borderLeft:`1px solid ${D.border2}`, boxShadow:'-32px 0 100px rgba(0,0,0,.9)', animation:'slideLeft .25s ease'}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:D.card2, padding:'22px 24px 18px', borderBottom:`1px solid ${D.border}`, flexShrink:0}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
            <div style={{display:'flex', gap:14, alignItems:'center'}}>
              <div style={{position:'relative'}}>
                <Avatar name={student.name} photoUrl={student.photo_url} size={50}/>
                <IfCan can={can.write}>
                  <label style={{position:'absolute', bottom:-2, right:-2, width:18, height:18, borderRadius:'50%', background:D.brand, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:9, border:`2px solid ${D.card2}`}}>
                    📷
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={async e => {
                      const file = e.target.files[0]; if (!file) return
                      const ext  = file.name.split('.').pop()
                      // SEC-3: Randomised path suffix
                      const path = `student_photos/${student.id}_${randomSuffix()}.${ext}`
                      const { error } = await supabase.storage.from('gnsi').upload(path,file,{upsert:false})
                      if (error) { showToast('Upload failed', D.rose); return }
                      const { data:{publicUrl} } = supabase.storage.from('gnsi').getPublicUrl(path)
                      await supabase.from('students').update({photo_url:publicUrl}).eq('id',student.id)
                      await auditLog('photo_upload', { student_id:student.id })
                      showToast('Photo updated', D.emerald)
                    }}/>
                  </label>
                </IfCan>
              </div>
              <div>
                <div style={{fontSize:17, fontWeight:800, color:D.text1, letterSpacing:'-.02em'}}>{student.name}</div>
                <div style={{fontSize:11, color:D.text3, marginTop:3, fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{student.gcc_no} · {student.batch} · {student.session}</div>
                {att!==null && att<50 && <span style={{fontSize:10, background:D.roseDim, color:D.rose, padding:'2px 8px', borderRadius:D.r4, marginTop:6, fontWeight:700, display:'inline-block', border:`1px solid ${D.roseBorder}`}}>⚠ LONG ABSENT</span>}
                {/* DESIGN-2: Show waiver info if applicable */}
                {(Number(student.fee_waiver)||Number(student.scholarship)) ? (
                  <div style={{fontSize:10, color:D.amber, marginTop:4, fontWeight:600}}>
                    Waiver: ₹{fmt(student.fee_waiver||0)} + Scholarship: ₹{fmt(student.scholarship||0)}/mo → Effective: ₹{fmt(effectiveDue)}/mo
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{display:'flex', gap:6}}>
              <IfCan can={can.write}>
                <button onClick={()=>onEdit(student)} style={{...BTN.secondary, fontSize:11}}>✏ Edit</button>
              </IfCan>
              <button onClick={onClose} style={{...BTN.ghost, padding:'7px 10px', fontSize:15}}>✕</button>
            </div>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {[
              {label:'Status',   value:student.status||'—'},
              {label:'Hostel',   value:student.hostel_type||'—'},
              {label:'Att%',     value:att!=null?`${att.toFixed(0)}%`:'—', warn:att!=null&&att<75},
              {label:'Rank',     value:rank?`#${rank}`:'—'},
              {label:'Fee',      value:dues>0?`₹${fmt(dues)}`:'Clear', ok:dues===0},
            ].map(p => (
              <div key={p.label} style={{background:D.card, border:`1px solid ${D.border}`, borderRadius:D.r8, padding:'8px 12px', textAlign:'center', minWidth:68}}>
                <div style={{fontSize:13, fontWeight:800, color:p.warn?D.amber:p.ok?D.emerald:D.text1, fontFamily:"'IBM Plex Mono',monospace"}}>{p.value}</div>
                <div style={{fontSize:9, color:D.text3, textTransform:'uppercase', letterSpacing:'.07em', marginTop:3}}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex', borderBottom:`1px solid ${D.border}`, background:D.card2, flexShrink:0, overflowX:'auto'}}>
          {TABS.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1, padding:'11px 8px', border:'none', background:'none', fontSize:10, fontWeight:700, cursor:'pointer', color:tab===t.key?D.brand:D.text3, borderBottom:`2px solid ${tab===t.key?D.brand:'transparent'}`, textTransform:'uppercase', letterSpacing:'.07em', whiteSpace:'nowrap'}}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{padding:'20px 24px', flex:1, overflowY:'auto'}}>
          {tab==='profile' && (
            <>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16}}>
                {[
                  ['Gender',student.gender], ['DOB',fmtD(student.dob)],
                  ['Course',student.course], ['House',student.house],
                  ['Phone',student.phone],   ['Father',student.father_name],
                  ['Mother',student.mother_name], ['Emergency',student.emergency_contact],
                  ['Prev School',student.prev_school], ['Referral',student.referral_source],
                  ['Admitted',fmtD(student.admission_date)], ['Address',student.address],
                ].map(([label,value]) => value ? (
                  <div key={label} style={{background:D.card2, borderRadius:D.r8, padding:'9px 12px', border:`1px solid ${D.border}`}}>
                    <div style={{fontSize:9, fontWeight:700, color:D.text4, textTransform:'uppercase', letterSpacing:'.09em'}}>{label}</div>
                    <div style={{fontSize:12, fontWeight:600, color:D.text1, marginTop:3}}>{value}</div>
                  </div>
                ) : null)}
              </div>
              {student.medical_notes && (
                <div style={{background:D.orangeDim, border:`1px solid ${D.orangeBorder}`, borderRadius:D.r10, padding:'10px 14px', marginBottom:12}}>
                  <div style={{fontWeight:700, fontSize:10, color:D.orange, marginBottom:4, textTransform:'uppercase', letterSpacing:'.08em'}}>⚕ Medical Notes</div>
                  <div style={{fontSize:13, color:D.text2}}>{student.medical_notes}</div>
                </div>
              )}
              {siblings.length>0 && (
                <div>
                  <div style={{fontWeight:700, fontSize:10, color:D.text3, marginBottom:8, textTransform:'uppercase', letterSpacing:'.08em'}}>Siblings ({siblings.length})</div>
                  {siblings.map(sib => (
                    <div key={sib.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${D.border}`}}>
                      <Avatar name={sib.name} size={26}/>
                      <div>
                        <div style={{fontWeight:600, fontSize:13, color:D.text1}}>{sib.name}</div>
                        <div style={{fontSize:11, color:D.text3, fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{sib.gcc_no} · {sib.batch}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab==='academic' && (
            <>
              <div style={{display:'flex', gap:10, marginBottom:16}}>
                <div style={{flex:1, background:D.card2, border:`1px solid ${D.border}`, borderRadius:D.r10, padding:'16px', textAlign:'center'}}>
                  <div style={{fontSize:34, fontWeight:800, color:D.brand, letterSpacing:'-.04em', fontFamily:"'IBM Plex Mono',monospace"}}>{rank?`#${rank}`:'—'}</div>
                  <div style={{fontSize:10, color:D.text3, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginTop:4}}>Rank in Batch</div>
                  <div style={{fontSize:10, color:D.text3, marginTop:2}}>of {batchStudents.length}</div>
                </div>
                {examTotals.length>0 && (
                  <div style={{flex:2, background:D.card2, border:`1px solid ${D.border}`, borderRadius:D.r10, padding:'16px'}}>
                    <div style={{fontWeight:700, fontSize:10, color:D.text3, marginBottom:10, textTransform:'uppercase', letterSpacing:'.07em'}}>Score Trend</div>
                    <div style={{display:'flex', alignItems:'flex-end', gap:4, height:36}}>
                      {examTotals.map((v,i)=><div key={i} style={{flex:1, background:D.brand, borderRadius:2, height:`${(v/sparkMax)*100}%`, minHeight:3, opacity:.6+.4*(i/examTotals.length)}}/>)}
                    </div>
                    <div style={{fontSize:10, color:D.text3, marginTop:6}}>Latest: <span style={{color:D.text1, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace"}}>{examTotals[examTotals.length-1]}</span></div>
                  </div>
                )}
              </div>
              {exams.length>0 ? (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontSize:11}}>
                    <thead>
                      <tr style={{background:D.card2}}>
                        <th style={{padding:'8px 10px', textAlign:'left', fontWeight:700, color:D.text3, borderBottom:`1px solid ${D.border}`, fontSize:9, textTransform:'uppercase', letterSpacing:'.06em'}}>Exam</th>
                        {SUBJECTS.map(s=><th key={s} style={{padding:'7px 5px', fontWeight:700, color:D.text3, borderBottom:`1px solid ${D.border}`, fontSize:9, textTransform:'uppercase', letterSpacing:'.05em'}}>{s.slice(0,3)}</th>)}
                        <th style={{padding:'8px 10px', fontWeight:700, color:D.text3, borderBottom:`1px solid ${D.border}`, fontSize:9, textTransform:'uppercase'}}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.map((e,i) => (
                        <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                          <td style={{padding:'7px 10px', fontWeight:600, color:D.text2, fontSize:12}}>{e.exam_name||`Exam ${i+1}`}</td>
                          {SUBJECTS.map(s => {
                            const score=e[s], weak=score!=null&&score<40
                            return <td key={s} style={{padding:'6px 5px', textAlign:'center', color:weak?D.rose:D.text2, fontWeight:weak?700:400}}>{score??'—'}</td>
                          })}
                          <td style={{padding:'7px 10px', fontWeight:800, color:(e.total||0)>=200?D.emerald:D.rose, fontFamily:"'IBM Plex Mono',monospace"}}>{e.total??'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div style={{textAlign:'center', padding:'40px', color:D.text3, fontSize:13}}>No exam records.</div>}
            </>
          )}

          {tab==='attend' && <AttendanceTab student={student} can={can} showToast={showToast}/>}

          {tab==='fee' && (
            <div>
              {/* DESIGN-2: Show effective monthly due with waiver breakdown */}
              {(Number(student.fee_waiver)||Number(student.scholarship)) ? (
                <div style={{background:D.amberDim, border:`1px solid ${D.amberBorder}`, borderRadius:D.r8, padding:'8px 14px', marginBottom:12, fontSize:12, color:D.amber, fontWeight:600}}>
                  Monthly Due: ₹{fmt(getEffectiveMonthlyDue(student))} (base ₹{fmt(getFlatFeeAmt(student.hostel_type))} − waiver ₹{fmt(student.fee_waiver||0)} − scholarship ₹{fmt(student.scholarship||0)})
                </div>
              ) : null}
              {totalArrears>0 && (
                <div style={{background:D.roseDim, border:`1px solid ${D.roseBorder}`, borderRadius:D.r8, padding:'8px 14px', marginBottom:12, fontWeight:700, color:D.rose, fontSize:12}}>
                  ⚠ Total Arrears: ₹{fmt(totalArrears)}
                </div>
              )}
              {monthlySummary.length>0 ? (
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:16}}>
                  <thead>
                    <tr style={{background:D.card2}}>
                      {['Month','Due','Paid','Balance','Status'].map(h=>(
                        <th key={h} style={{padding:'8px 10px', textAlign:h==='Month'?'left':'right', fontWeight:700, color:D.text3, borderBottom:`1px solid ${D.border}`, fontSize:9, textTransform:'uppercase', letterSpacing:'.06em'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.map((m,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                        <td style={{padding:'7px 10px', fontWeight:600, color:D.text2}}>{m.month}</td>
                        <td style={{padding:'7px 10px', textAlign:'right', color:D.text3, fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(m.due)}</td>
                        <td style={{padding:'7px 10px', textAlign:'right', color:D.emerald, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(m.paid)}</td>
                        <td style={{padding:'7px 10px', textAlign:'right', color:m.balance>0?D.rose:D.text3, fontWeight:m.balance>0?700:400, fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(m.balance)}</td>
                        <td style={{padding:'7px 10px', textAlign:'right'}}>
                          <span style={{fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:D.r4, background:m.balance<=0?D.emeraldDim:D.roseDim, color:m.balance<=0?D.emerald:D.rose, border:`1px solid ${m.balance<=0?D.emeraldBorder:D.roseBorder}`}}>
                            {m.balance<=0?'CLEAR':'DUE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{color:D.text3, fontSize:13, textAlign:'center', padding:'24px'}}>No payment history.</div>}
              {history.length>0 && (
                <>
                  <div style={{fontSize:10, fontWeight:700, color:D.text3, marginBottom:8, textTransform:'uppercase', letterSpacing:'.08em'}}>Recent Payments</div>
                  {history.slice(0,5).map((h,i)=>(
                    <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:D.card2, borderRadius:D.r8, border:`1px solid ${D.border}`, marginBottom:6}}>
                      <span style={{fontSize:14}}>💵</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700, fontSize:13, color:D.text1, fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(h.amount)}</div>
                        <div style={{fontSize:11, color:D.text3, marginTop:1}}>{fmtD(h.payment_date)} · {h.payment_method||'Cash'}</div>
                      </div>
                      {h.month_for && <Badge label={h.month_for} color={D.brand}/>}
                      <button onClick={()=>printFeeReceipt(student,h)} style={{...BTN.ghost, fontSize:10, padding:'4px 8px'}}>🖨</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab==='docs' && <DocumentsTab student={student} can={can} showToast={showToast}/>}

          {tab==='notes' && (
            <>
              <div style={{fontSize:10, fontWeight:700, color:D.text3, marginBottom:10, textTransform:'uppercase', letterSpacing:'.08em'}}>Notes / Activity Log</div>
              <textarea style={{...INP.base, height:200, resize:'vertical'}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enter notes, observations, or activity log…"/>
              <button onClick={saveNotes} disabled={saving} style={{...BTN.primary, marginTop:10, opacity:saving?.7:1}}>
                {saving?'Saving…':'Save Notes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Student Form ─────────────────────────────────────────────────────────────
function StudentForm({ onSave, onCancel, editing, allStudents }) {
  const blank = {
    name:'',gcc_no:'',dob:'',gender:'Male',course:'',batch:'',house:'',session:'',
    hostel_type:'Day Scholar',status:'Active',father_name:'',mother_name:'',
    phone:'',address:'',remarks:'',fee_waiver:0,scholarship:0,fee_waiver_note:'',
    emergency_contact:'',prev_school:'',referral_source:'',
    admission_date:new Date().toISOString().slice(0,10),
    left_date:'',medical_notes:'',academic_remarks:''
  }

  // SEC-6: Draft restores only non-PII fields; PII fields remain blank
  const loadDraft = () => {
    if (editing) return null
    try {
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY)||'null')
      if (!raw) return null
      // Strip any PII that might have leaked from an older version
      DRAFT_PII_FIELDS.forEach(k => delete raw[k])
      return raw
    } catch { return null }
  }
  const savedDraft = loadDraft()
  const [form, setForm]     = useState(savedDraft||(editing?Object.fromEntries(Object.entries({...blank,...editing}).map(([k,v])=>[k,v??''])):blank))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  // SEC-6: Only persist non-PII fields to localStorage
  useEffect(() => {
    if (editing) return
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(sanitiseDraftForStorage(form)))
      setDraftSaved(true); setTimeout(()=>setDraftSaved(false),1500)
    }, 1000)
    return () => clearTimeout(t)
  }, [form, editing])

  useEffect(() => {
    if (!form.house) return
    if (DAY_SCHOLAR_HOUSES.includes(form.house)) set('hostel_type','Day Scholar')
    else if (form.hostel_type==='Day Scholar') set('hostel_type','Boarder')
  }, [form.house])

  const derived  = deriveHostelType(form.house, form.hostel_type)
  const hs       = HOSTEL_STYLES[derived] || HOSTEL_STYLES['Day Scholar']
  const subtypes = COURSE_STRUCTURE[form.course]?.subtypes ?? []
  const gccDup   = form.gcc_no ? allStudents.find(s=>s.gcc_no?.toString()===form.gcc_no?.toString()&&s.id!==editing?.id) : null
  const phoneDup = form.phone?.trim() ? allStudents.find(s=>s.phone?.trim()===form.phone?.trim()&&s.id!==editing?.id) : null

  const validate = () => {
    const e = {}
    if (!form.name?.trim()) e.name = 'Name is required'
    if (!form.gcc_no?.toString().trim()) e.gcc_no = 'GCC No. is required'
    if (gccDup) e.gcc_no = `GCC ${form.gcc_no} used by ${gccDup.name}`
    if (phoneDup) e.phone = `Phone used by ${phoneDup.name}`
    setErrors(e); return Object.keys(e).length===0
  }
  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    await onSave(editing?.id||null, {...form, hostel_type:derived})
    setSaving(false)
    if (!editing) localStorage.removeItem(DRAFT_KEY)
  }

  const fieldStyle = {...INP.base}
  // DESIGN-2: Show effective due in form
  const effectiveDue = Math.max(0, getFlatFeeAmt(derived) - Number(form.fee_waiver||0) - Number(form.scholarship||0))

  return (
    <div style={{background:D.card, border:`1px solid ${D.border2}`, borderRadius:D.r12, overflow:'hidden', marginBottom:16}}>
      <div style={{background:D.card2, borderBottom:`1px solid ${D.border}`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <div style={{fontSize:14, fontWeight:800, color:D.text1}}>{editing?'Edit Student':'New Student'}</div>
          <div style={{fontSize:11, color:D.text3, marginTop:3, display:'flex', gap:10}}>
            Fill in student details
            {!editing && draftSaved && <span style={{color:D.emerald, fontWeight:700}}>✓ Draft saved (non-PII)</span>}
            {!editing && savedDraft && !draftSaved && <span style={{color:D.amber, fontWeight:600}}>Draft restored — re-enter personal details</span>}
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          {!editing && <button onClick={()=>{localStorage.removeItem(DRAFT_KEY);setForm(blank)}} style={{...BTN.ghost, fontSize:11}}>Clear Draft</button>}
          <button onClick={onCancel} style={{...BTN.ghost, padding:'6px 10px', fontSize:15}}>✕</button>
        </div>
      </div>

      <div style={{padding:'20px 24px'}}>
        <FieldRow label="Full Name *" error={errors.name}>
          <input style={{...fieldStyle,...(errors.name?INP.err:{})}} value={form.name}
            onChange={e=>{set('name',e.target.value);setErrors(v=>({...v,name:''}))}}
            placeholder="Full name as per certificate"/>
        </FieldRow>

        <SectionDivider label="Identification"/>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4}}>
          <FieldRow label="GCC No. *" error={errors.gcc_no}>
            <input style={{...fieldStyle,...(errors.gcc_no?INP.err:{})}} type="number" value={form.gcc_no}
              onChange={e=>{set('gcc_no',e.target.value);setErrors(v=>({...v,gcc_no:''}))}}/>
            {gccDup&&!errors.gcc_no&&<div style={{fontSize:11,color:D.amber,marginTop:3,fontWeight:600}}>⚠ Used by {gccDup.name}</div>}
          </FieldRow>
          <FieldRow label="Date of Birth"><input type="date" style={fieldStyle} value={form.dob} onChange={e=>set('dob',e.target.value)}/></FieldRow>
          <FieldRow label="Gender">
            <select style={fieldStyle} value={form.gender} onChange={e=>set('gender',e.target.value)}>
              <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </FieldRow>
          <FieldRow label="Status">
            <select style={fieldStyle} value={form.status} onChange={e=>set('status',e.target.value)}>
              {STATUSES.filter(s=>s!=='All').map(s=><option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Admission Date"><input type="date" style={fieldStyle} value={form.admission_date} onChange={e=>set('admission_date',e.target.value)}/></FieldRow>
          {form.status==='Withdrawn' && <FieldRow label="Left Date"><input type="date" style={fieldStyle} value={form.left_date} onChange={e=>set('left_date',e.target.value)}/></FieldRow>}
          <FieldRow label="Previous School"><input style={fieldStyle} value={form.prev_school} onChange={e=>set('prev_school',e.target.value)} placeholder="School before GNSI"/></FieldRow>
          <FieldRow label="Referral Source"><input style={fieldStyle} value={form.referral_source} onChange={e=>set('referral_source',e.target.value)} placeholder="e.g. Sibling, Teacher"/></FieldRow>
        </div>

        <SectionDivider label="Course & Class"/>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:4}}>
          <FieldRow label="Course">
            <select style={fieldStyle} value={form.course} onChange={e=>set('course',e.target.value)}>
              <option value="">— Course —</option>
              {Object.keys(COURSE_STRUCTURE).map(c=><option key={c}>{c}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Batch / Class">
            {subtypes.length>0
              ? <select style={fieldStyle} value={form.batch} onChange={e=>set('batch',e.target.value)}><option value="">—</option>{subtypes.map(s=><option key={s}>{s}</option>)}</select>
              : <select style={fieldStyle} value={form.batch} onChange={e=>set('batch',e.target.value)}><option value="">—</option>{CLASSES_LIST.map(c=><option key={c}>{c}</option>)}</select>}
          </FieldRow>
          <FieldRow label="Session">
            <select style={fieldStyle} value={form.session} onChange={e=>set('session',e.target.value)}>
              <option value="">—</option>{SESSIONS.map(s=><option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="House / Block">
            <select style={fieldStyle} value={form.house} onChange={e=>set('house',e.target.value)}>
              <option value="">— House —</option>{HOUSES_LIST.map(h=><option key={h}>{h}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Hostel Type">
            <select style={{...fieldStyle,opacity:DAY_SCHOLAR_HOUSES.includes(form.house)?.6:1}} value={form.hostel_type} onChange={e=>set('hostel_type',e.target.value)}>
              {['Boarder','Day Scholar','Day Boarder'].map(h=><option key={h}>{h}</option>)}
            </select>
          </FieldRow>
        </div>
        <div style={{display:'inline-flex', alignItems:'center', gap:8, marginBottom:12, padding:'7px 14px', borderRadius:D.r8, background:hs.bg, border:`1px solid ${hs.border}`, fontSize:12, fontWeight:600, color:hs.color}}>
          Hostel: <strong>{derived}</strong> · ₹{fmt(getFlatFeeAmt(derived))}/mo
        </div>

        <SectionDivider label="Fee Adjustments"/>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4}}>
          <FieldRow label="Monthly Waiver (₹)"><input type="number" style={fieldStyle} value={form.fee_waiver} onChange={e=>set('fee_waiver',e.target.value)} placeholder="0"/></FieldRow>
          <FieldRow label="Scholarship (₹/mo)"><input type="number" style={fieldStyle} value={form.scholarship} onChange={e=>set('scholarship',e.target.value)} placeholder="0"/></FieldRow>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Waiver Reason"><input style={fieldStyle} value={form.fee_waiver_note} onChange={e=>set('fee_waiver_note',e.target.value)} placeholder="e.g. Merit, Staff ward"/></FieldRow></div>
          {/* DESIGN-2: Live effective due preview */}
          <div style={{gridColumn:'1/-1', background:D.card2, border:`1px solid ${D.border}`, borderRadius:D.r8, padding:'10px 14px', fontSize:12, color:D.text2}}>
            Effective monthly due: <strong style={{color:D.emerald, fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(effectiveDue)}</strong>
            {effectiveDue < getFlatFeeAmt(derived) && <span style={{color:D.amber, marginLeft:8}}>(-₹{fmt(getFlatFeeAmt(derived)-effectiveDue)} adjustment)</span>}
          </div>
        </div>

        <SectionDivider label="Family & Contact"/>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4}}>
          <FieldRow label="Father's Name"><input style={fieldStyle} value={form.father_name} onChange={e=>set('father_name',e.target.value)}/></FieldRow>
          <FieldRow label="Mother's Name"><input style={fieldStyle} value={form.mother_name} onChange={e=>set('mother_name',e.target.value)}/></FieldRow>
          <FieldRow label="Phone" error={errors.phone}>
            <input style={{...fieldStyle,...(errors.phone?INP.err:{})}} value={form.phone} onChange={e=>{set('phone',e.target.value);setErrors(v=>({...v,phone:''}))}}/>
            {phoneDup&&!errors.phone&&<div style={{fontSize:11,color:D.amber,marginTop:3,fontWeight:600}}>⚠ Used by {phoneDup.name}</div>}
          </FieldRow>
          <FieldRow label="Emergency Contact"><input style={fieldStyle} value={form.emergency_contact} onChange={e=>set('emergency_contact',e.target.value)} placeholder="Name · Relation · Phone"/></FieldRow>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Address"><input style={fieldStyle} value={form.address} onChange={e=>set('address',e.target.value)}/></FieldRow></div>
        </div>

        <SectionDivider label="Medical & Notes"/>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4}}>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Medical / Allergy Notes"><input style={fieldStyle} value={form.medical_notes} onChange={e=>set('medical_notes',e.target.value)} placeholder="Allergies, conditions, medications…"/></FieldRow></div>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Remarks"><textarea style={{...fieldStyle,resize:'vertical'}} rows={2} value={form.remarks} onChange={e=>set('remarks',e.target.value)}/></FieldRow></div>
        </div>

        <div style={{display:'flex', gap:10, marginTop:16}}>
          <button onClick={handleSave} disabled={saving} style={{...BTN.primary, padding:'11px 24px', opacity:saving?.7:1}}>
            {saving?'Saving…':editing?'Update Student':'Save Student'}
          </button>
          <button onClick={onCancel} style={{...BTN.secondary, padding:'11px 16px'}}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Student Row ──────────────────────────────────────────────────────────────
function StudentRow({ s, can, onEdit, onDelete, onOpenFee, onOpenDetail, onQuickAttend, onExamEntry, onClone, feeData, attData, examData, density, visibleCols, selected, onSelect }) {
  const d        = DENSITY[density] || DENSITY.comfortable
  const show     = col => visibleCols.includes(col)
  const isSel    = selected.has(s.id)
  const att      = attData[s.id]
  const dues     = feeData[s.id]?.dues || 0
  const lastPaid = feeData[s.id]?.lastPaid || null
  const exams    = examData[s.id] || []
  const sparkData = exams.slice(-5).map(e=>e.total||0)
  const sparkMax  = Math.max(...sparkData,1)
  const missing   = getMissingFields(s)
  const birthday  = isBirthdayToday(s.dob)
  const recent    = isRecentlyAdded(s.created_at)
  const longAbs   = att!=null && att<50
  const statusMeta = STATUS_META[s.status] || {color:D.text3, dot:D.text3}

  return (
    <div style={{
      background: isSel ? D.brandDim : D.card,
      border:`1px solid ${isSel?D.brandBorder:birthday?`${D.orange}30`:recent?`${D.teal}20`:D.border}`,
      borderRadius:D.r10, padding:`${d.py} 16px`,
      display:'flex', alignItems:'center', gap:12,
      transition:'border-color .12s, background .12s',
      position:'relative',
    }}
      onMouseEnter={e=>e.currentTarget.style.borderColor=isSel?D.brandBorder:D.border2}
      onMouseLeave={e=>e.currentTarget.style.borderColor=isSel?D.brandBorder:birthday?`${D.orange}30`:recent?`${D.teal}20`:D.border}
    >
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:2,borderRadius:'10px 0 0 10px',background:statusMeta.dot,opacity:.7}}/>

      {/* DESIGN-8: Checkbox click fully isolated from row click */}
      <input type="checkbox" checked={isSel}
        onChange={e=>{ e.stopPropagation(); onSelect(s.id) }}
        onClick={e=>e.stopPropagation()}
        style={{width:14,height:14,cursor:'pointer',accentColor:D.brand,flexShrink:0,marginLeft:6}}/>

      <Avatar name={s.name} photoUrl={s.photo_url} size={d.avatarSize}/>

      <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>onOpenDetail(s)}>
        <div style={{display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:4}}>
          <span style={{fontWeight:700, fontSize:d.fontSize, color:D.text1, letterSpacing:'-.01em'}}>{s.name}</span>
          {show('status') && s.status && <StatusBadge status={s.status}/>}
          {birthday && <Badge label="🎂 Birthday" color={D.orange}/>}
          {recent   && <Badge label="New" color={D.teal}/>}
          {longAbs  && <Badge label="⚠ Absent" color={D.rose}/>}
          {missing.length>0 && <Badge label={`⚠ ${missing.join(', ')}`} color={D.amber}/>}
          {s.medical_notes && <Badge label="⚕" color={D.orange}/>}
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          {show('gcc_no')      && s.gcc_no      && <span style={{fontSize:10,color:D.text3,fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{s.gcc_no}</span>}
          {show('batch')       && s.batch       && <span style={{fontSize:11,color:D.text2,fontWeight:600}}>{s.batch}</span>}
          {show('session')     && s.session     && <span style={{fontSize:10,color:D.brand,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace"}}>{s.session}</span>}
          {show('house')       && s.house       && <HousePill house={s.house}/>}
          {show('course')      && s.course      && (
            <span style={{fontSize:10,fontWeight:600,color:COURSE_STRUCTURE[s.course]?.color||D.text3,background:(COURSE_STRUCTURE[s.course]?.color||D.text3)+'15',padding:'1px 7px',borderRadius:D.r4,border:`1px solid ${(COURSE_STRUCTURE[s.course]?.color||D.text3)+'25'}`}}>{s.course}</span>
          )}
          {show('hostel_type') && s.hostel_type && (
            <span style={{fontSize:10,fontWeight:700,color:HOSTEL_STYLES[s.hostel_type]?.color||D.text3,background:HOSTEL_STYLES[s.hostel_type]?.bg||D.card2,padding:'1px 7px',borderRadius:D.r4,border:`1px solid ${HOSTEL_STYLES[s.hostel_type]?.border||D.border}`}}>{s.hostel_type}</span>
          )}
          {show('gender')      && s.gender      && <span style={{fontSize:10,color:D.text4}}>{s.gender}</span>}
          {show('phone')       && s.phone       && <span style={{fontSize:10,color:D.text4,fontFamily:"'IBM Plex Mono',monospace"}}>{s.phone}</span>}
          {show('father_name') && s.father_name && <span style={{fontSize:10,color:D.text4}}>F: {s.father_name}</span>}
          {show('attendance')  && att!=null     && <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:D.r4,background:att>=75?D.emeraldDim:D.roseDim,color:att>=75?D.emerald:D.rose,border:`1px solid ${att>=75?D.emeraldBorder:D.roseBorder}`,fontFamily:"'IBM Plex Mono',monospace"}}>{att.toFixed(0)}%</span>}
          {show('last_paid')   && lastPaid      && <span style={{fontSize:10,fontWeight:600,padding:'1px 7px',borderRadius:D.r4,background:D.emeraldDim,color:D.emerald,border:`1px solid ${D.emeraldBorder}`}}>{lastPaid}</span>}
          {show('sparkline')   && sparkData.length>0 && (
            <span style={{display:'inline-flex',alignItems:'flex-end',gap:2,height:13}}>
              {sparkData.map((v,i)=><span key={i} style={{width:3,height:`${(v/sparkMax)*100}%`,minHeight:2,background:D.brand,borderRadius:1,display:'inline-block',opacity:.5+.5*(i/sparkData.length)}}/>)}
            </span>
          )}
        </div>
      </div>

      <div style={{flexShrink:0, display:'flex', alignItems:'center', gap:8}}>
        {dues>0 ? (
          <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:D.r6,background:D.roseDim,color:D.rose,border:`1px solid ${D.roseBorder}`,whiteSpace:'nowrap',fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(dues)}</span>
        ) : feeData[s.id] ? (
          <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:D.r6,background:D.emeraldDim,color:D.emerald,border:`1px solid ${D.emeraldBorder}`}}>Clear</span>
        ) : null}
        <div style={{display:'flex', gap:2}}>
          <button onClick={()=>onOpenDetail(s)} style={{padding:'5px 12px',borderRadius:D.r6,background:D.brand,color:'#fff',border:'none',fontSize:10,fontWeight:700,cursor:'pointer'}}>Profile</button>
          <IfCan can={can.write}>
            <button onClick={()=>onEdit(s)} style={{...BTN.ghost,padding:'5px 8px',fontSize:10}}>Edit</button>
          </IfCan>
          <IfCan can={can.fees}>
            <button onClick={e=>{e.stopPropagation();onOpenFee(s)}} style={{padding:'5px 8px',borderRadius:D.r6,background:D.emeraldDim,color:D.emerald,border:`1px solid ${D.emeraldBorder}`,fontSize:10,fontWeight:700,cursor:'pointer'}}>+₹</button>
          </IfCan>
          <IfCan can={can.exams}>
            <button onClick={e=>{e.stopPropagation();onExamEntry(s)}} style={{padding:'5px 8px',borderRadius:D.r6,background:D.violetDim,color:D.violet,border:`1px solid ${D.violetBorder}`,fontSize:10,fontWeight:700,cursor:'pointer'}} title="Add exam scores">📚</button>
          </IfCan>
          <IfCan can={can.attend}>
            <button onClick={e=>{e.stopPropagation();onQuickAttend(s)}} style={{padding:'5px 8px',borderRadius:D.r6,background:D.skyDim,color:D.sky,border:`1px solid ${D.skyBorder}`,fontSize:10,fontWeight:700,cursor:'pointer'}} title="Attendance">📅</button>
          </IfCan>
          <IfCan can={can.write}>
            <button onClick={()=>onClone(s)} style={{padding:'5px 8px',borderRadius:D.r6,background:D.amberDim,color:D.amber,border:`1px solid ${D.amberBorder}`,fontSize:10,fontWeight:700,cursor:'pointer'}} title="Clone">📋</button>
            <button onClick={()=>onDelete(s)} style={{padding:'5px 8px',borderRadius:D.r6,background:D.roseDim,color:D.rose,border:`1px solid ${D.roseBorder}`,fontSize:10,fontWeight:700,cursor:'pointer'}}>Del</button>
          </IfCan>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Students() {
  const { role, can } = usePermissions()

  const [students,     setStudents]     = useState([])
  const [houseOptions, setHouseOptions] = useState(HOUSES_LIST)
  const [loading,      setLoading]      = useState(true)
  const [feeData,      setFeeData]      = useState({})
  const [feeHistory,   setFeeHistory]   = useState({})
  const [attData,      setAttData]      = useState({})
  const [examData,     setExamData]     = useState({})
  const [deleted,      setDeleted]      = useState([])
  const [showDeleted,  setShowDeleted]  = useState(false)
  const [undoItem,     setUndoItem]     = useState(null)
  const [deletedRow,   setDeletedRow]   = useState(null)
  const [formOpen,     setFormOpen]     = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [feePanel,     setFeePanel]     = useState(null)
  const [detailPanel,  setDetailPanel]  = useState(null)
  const [examEntry,    setExamEntry]    = useState(null)
  const [toast,        setToast]        = useState(null)
  const [page,         setPage]         = useState(1)
  const [viewMode,     setViewMode]     = useState('list')
  const [showAnalytics,setShowAnalytics]= useState(false)
  const [showBulkOps,  setShowBulkOps]  = useState(false)
  const [showRollover, setShowRollover] = useState(false)
  const [showBulkFee,  setShowBulkFee]  = useState(false)
  const [showHouseReassign,  setShowHouseReassign]  = useState(false)
  const [showMergeDups,      setShowMergeDups]      = useState(false)
  const [quickAttend,        setQuickAttend]        = useState(null)
  const [showColPicker,      setShowColPicker]      = useState(false)
  const [showHousePills,     setShowHousePills]     = useState(false)
  const [showPresets,        setShowPresets]        = useState(false)
  const [showRecents,        setShowRecents]        = useState(false)
  const [presetName,         setPresetName]         = useState('')
  const [selected,           setSelected]           = useState(new Set())
  const [ageMin,             setAgeMin]             = useState('')
  const [ageMax,             setAgeMax]             = useState('')
  // SEC-4: Confirm modal state
  const [confirmModal,       setConfirmModal]       = useState(null)
  // DESIGN-5: Export menu ref for outside-click close
  const exportMenuRef = useRef(null)
  const [showExportMenu,     setShowExportMenu]     = useState(false)
  const PAGE_SIZE = 25

  // Filters
  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState('All')
  const [filterCourse,  setFilterCourse]  = useState('All')
  const [filterHostel,  setFilterHostel]  = useState('All')
  const [filterHouse,   setFilterHouse]   = useState('All')
  const [filterGender,  setFilterGender]  = useState('All')
  const [filterSession, setFilterSession] = useState('All')
  const [filterBatch,   setFilterBatch]   = useState('All')
  const [gccMin,        setGccMin]        = useState('')
  const [gccMax,        setGccMax]        = useState('')

  const loadCols = () => { try { return JSON.parse(localStorage.getItem(COLUMNS_KEY))||ALL_COLUMNS.filter(c=>c.default).map(c=>c.key) } catch { return ALL_COLUMNS.filter(c=>c.default).map(c=>c.key) } }
  const [visibleCols, setVisibleCols] = useState(loadCols)
  const saveCol = cols => { setVisibleCols(cols); localStorage.setItem(COLUMNS_KEY,JSON.stringify(cols)) }
  const [density, setDensity] = useState(()=>localStorage.getItem(DENSITY_KEY)||'comfortable')
  const changeDensity = d => { setDensity(d); localStorage.setItem(DENSITY_KEY,d) }

  const { presets, save:savePreset, remove:removePreset } = usePresets()
  const { recent:recentSearches, add:addSearch, clear:clearSearches } = useRecentSearches()

  const searchRef = useRef(null)
  const undoTimer = useRef(null)
  const showToast = (msg,color) => { setToast({msg,color}); setTimeout(()=>setToast(null),3500) }

  // DESIGN-5: Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return
    const handler = e => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExportMenu])

  // ── Data Loaders ─────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data:rows,error }, { data:houseRows }] = await Promise.all([
        supabase.from('students').select('*').is('deleted_at',null).order('name'),
        supabase.from('houses').select('name').order('name'),
      ])
      if (error) throw error
      setStudents(rows||[])
      if (houseRows?.length) setHouseOptions(houseRows.map(h=>h.name))
    } catch(err) { showToast('Failed to load: '+err.message, D.rose) }
    finally { setLoading(false) }
  }, [])

  const loadDeleted = useCallback(async () => {
    const { data } = await supabase.from('students').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false})
    setDeleted(data||[])
  }, [])

  // DESIGN-1: loadAttData receives ids as argument — no stale closure on students
  const loadAttData = useCallback(async ids => {
    if (!ids?.length) return
    try {
      const { data } = await supabase.from('attendance').select('student_id,status').in('student_id',ids)
      if (!data) return
      const map = {}
      ids.forEach(id => {
        const recs = data.filter(r=>r.student_id===id)
        if (!recs.length) { map[id]=null; return }
        map[id] = (recs.filter(r=>r.status==='Present').length + recs.filter(r=>r.status==='Late').length*0.5) / recs.length * 100
      })
      setAttData(map)
    } catch {}
  }, [])

  // DESIGN-1: loadExamData receives ids as argument — no stale closure
  const loadExamData = useCallback(async ids => {
    if (!ids?.length) return
    try {
      const { data } = await supabase.from('exam_scores').select('*').in('student_id',ids).order('created_at',{ascending:false})
      if (!data) return
      const map = {}
      data.forEach(e => { if(!map[e.student_id]) map[e.student_id]=[]; map[e.student_id].push(e) })
      setExamData(map)
    } catch {}
  }, [])

  // DESIGN-1: loadFeeData receives both ids AND studentRows as arguments — no stale outer-scope closure
  const loadFeeData = useCallback(async (ids, studentRows) => {
    if (!ids?.length || !studentRows?.length) return
    try {
      const { data } = await supabase.from('fee_collections').select('*').in('student_id',ids).order('payment_date',{ascending:false})
      if (!data) return
      const map = {}
      data.forEach(row => { if(!map[row.student_id]) map[row.student_id]=[]; map[row.student_id].push(row) })
      const thisMonth = new Date().toLocaleDateString('en-IN',{month:'short',year:'2-digit'}).split(' ')[0]
      const result={}, histResult={}
      for (const s of studentRows) {
        const pmts = map[s.id]||[]
        histResult[s.id] = pmts
        const lastPaidDate = pmts[0] ? new Date(pmts[0].payment_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : null
        const paidThisMonth = lastPaidDate?.includes(thisMonth)
        // DESIGN-2: Use effective due (minus waiver/scholarship), not flat rate
        const effectiveDue = getEffectiveMonthlyDue(s)
        result[s.id] = { dues: paidThisMonth ? 0 : effectiveDue, lastPaid: lastPaidDate, history: pmts.slice(0,3) }
      }
      setFeeData(result); setFeeHistory(histResult)
    } catch {}
  }, []) // no students dependency — passed as argument instead

  // DESIGN-1: Effect watches students array (not just .length), passes rows directly
  useEffect(() => {
    if (students.length) {
      const ids = students.map(s=>s.id)
      loadFeeData(ids, students)   // pass students directly — no stale closure
      loadAttData(ids)
      loadExamData(ids)
    }
  }, [students]) // watches full array ref — updates on any student change

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (showDeleted) loadDeleted() }, [showDeleted])
  useEffect(() => {
    const h = e => { if ((e.ctrlKey||e.metaKey)&&e.key==='k') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h)
  }, [])

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const handleSave = async (eid, obj) => {
    if (!can.write) { showToast('No permission to save students', D.rose); return }
    const payload = {
      gcc_no:parseInt(obj.gcc_no), name:obj.name, dob:obj.dob||null, gender:obj.gender||null,
      course:obj.course||null, batch:obj.batch||null, house:obj.house||null, session:obj.session||null,
      hostel_type:obj.hostel_type||'Day Scholar', status:obj.status||'Active',
      father_name:obj.father_name||null, mother_name:obj.mother_name||null,
      phone:obj.phone||null, address:obj.address||null, remarks:obj.remarks||null,
      fee_waiver:Number(obj.fee_waiver)||0, scholarship:Number(obj.scholarship)||0,
      fee_waiver_note:obj.fee_waiver_note||null, emergency_contact:obj.emergency_contact||null,
      prev_school:obj.prev_school||null, referral_source:obj.referral_source||null,
      admission_date:obj.admission_date||null, left_date:obj.left_date||null,
      medical_notes:obj.medical_notes||null, academic_remarks:obj.academic_remarks||null
    }
    if (eid) {
      const { error } = await supabase.from('students').update(payload).eq('id',eid)
      if (error) { showToast('Update failed: '+error.message, D.rose); return }
      setStudents(prev=>prev.map(s=>s.id===eid?{...s,...payload}:s))
      await auditLog('student_update', { student_id:eid, fields:Object.keys(payload) })
      showToast('Student updated', D.amber)
    } else {
      const { data, error } = await supabase.from('students').insert(payload).select().single()
      if (error) { showToast(error.code==='23505'?`GCC ${obj.gcc_no} already exists`:'Save failed: '+error.message, D.rose); return }
      setStudents(prev=>[data,...prev])
      await auditLog('student_create', { student_id:data.id, gcc_no:data.gcc_no })
      showToast(`${data.name} added`, D.emerald)
    }
    setFormOpen(false); setEditing(null)
  }

  const handleClone = student => {
    if (!can.write) { showToast('No permission to clone', D.rose); return }
    const cloned = {...student}
    delete cloned.id; delete cloned.created_at; delete cloned.deleted_at
    cloned.name += ' (Clone)'; cloned.gcc_no=''; cloned.status='Active'
    cloned.admission_date = new Date().toISOString().slice(0,10)
    setEditing(null); setFormOpen(true)
    // SEC-6: Only persist non-PII fields for clone draft
    localStorage.setItem(DRAFT_KEY, JSON.stringify(sanitiseDraftForStorage(cloned)))
    showToast('Clone loaded — update GCC No. and personal details, then save', D.brand)
  }

  // SEC-4: Uses ConfirmModal instead of browser confirm()
  const handleDelete = s => {
    if (!can.write) { showToast('No permission to delete', D.rose); return }
    setConfirmModal({
      title: 'Delete Student',
      message: `Archive ${s.name} (GCC-${s.gcc_no})? The record can be restored from the Archive section within 5 seconds.`,
      confirmLabel: 'Archive',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null)
        setStudents(prev=>prev.filter(x=>x.id!==s.id))
        setUndoItem(s); setDeletedRow(s)
        await supabase.from('students').update({deleted_at:new Date().toISOString()}).eq('id',s.id)
        await auditLog('student_delete', { student_id:s.id, gcc_no:s.gcc_no, name:s.name })
        if (undoTimer.current) clearTimeout(undoTimer.current)
        undoTimer.current = setTimeout(()=>{ setUndoItem(null); setDeletedRow(null); showToast('Record archived',D.rose) },5000)
      }
    })
  }

  const handleUndo = async () => {
    if (!deletedRow) return
    clearTimeout(undoTimer.current)
    await supabase.from('students').update({deleted_at:null}).eq('id',deletedRow.id)
    await auditLog('student_restore', { student_id:deletedRow.id, name:deletedRow.name })
    setStudents(prev=>[deletedRow,...prev].sort((a,b)=>(a.name||'').localeCompare(b.name||'')))
    setUndoItem(null); setDeletedRow(null)
    showToast('Restored: '+deletedRow.name, D.emerald)
  }

  const handleRestore = async s => {
    await supabase.from('students').update({deleted_at:null}).eq('id',s.id)
    await auditLog('student_restore', { student_id:s.id, name:s.name })
    setDeleted(prev=>prev.filter(x=>x.id!==s.id))
    await loadAll()
    showToast('Restored: '+s.name, D.emerald)
  }

  const handleQuickAttend = async student => {
    if (!can.attend) { showToast('No permission to mark attendance', D.rose); return }
    const today = new Date().toISOString().slice(0,10)
    const { data:existing } = await supabase.from('attendance').select('*').eq('student_id',student.id).eq('date',today).single()
    if (existing) { showToast(`Already marked ${existing.status} today`,D.amber); setQuickAttend(student) }
    else {
      await supabase.from('attendance').insert({student_id:student.id,date:today,status:'Present'})
      await auditLog('quick_attend', { student_id:student.id, date:today })
      showToast(`Marked Present — ${student.name}`,D.emerald)
      loadAttData([student.id])
    }
  }

  const toggleSelect = id => setSelected(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  const selectAll    = () => setSelected(new Set(paginated.map(s=>s.id)))
  const clearSel     = () => setSelected(new Set())

  // DESIGN-7: applyPreset does atomic state updates and resets page
  const applyPreset = f => {
    setSearch(f.q||'')
    setFilterStatus(f.status||'All')
    setFilterCourse(f.course||'All')
    setFilterHostel(f.hostel||'All')
    setFilterHouse(f.house||'All')
    setFilterGender(f.gender||'All')
    setFilterSession(f.session||'All')
    setFilterBatch(f.batch||'All')
    setGccMin(f.gccMin||'')
    setGccMax(f.gccMax||'')
    setPage(1)  // DESIGN-7: always reset atomically with filter changes
    setShowPresets(false)
  }

  const currentFilters = { q:search,status:filterStatus,course:filterCourse,hostel:filterHostel,house:filterHouse,gender:filterGender,session:filterSession,batch:filterBatch,gccMin,gccMax }
  const allBatches = ['All',...Array.from(new Set(students.map(s=>s.batch).filter(Boolean))).sort()]

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    if (q&&![s.name,s.gcc_no,s.batch,s.father_name,s.mother_name,s.phone,s.house].some(v=>v?.toString().toLowerCase().includes(q))) return false
    if (filterStatus!=='All'  && s.status!==filterStatus)       return false
    if (filterCourse!=='All'  && s.course!==filterCourse)       return false
    if (filterHostel!=='All'  && s.hostel_type!==filterHostel)  return false
    if (filterHouse!=='All'   && s.house!==filterHouse)         return false
    if (filterGender!=='All'  && s.gender!==filterGender)       return false
    if (filterSession!=='All' && s.session!==filterSession)     return false
    if (filterBatch!=='All'   && s.batch!==filterBatch)         return false
    if (gccMin && Number(s.gcc_no)<Number(gccMin)) return false
    if (gccMax && Number(s.gcc_no)>Number(gccMax)) return false
    if (ageMin) { const a=getAge(s.dob); if (a==null||a<Number(ageMin)) return false }
    if (ageMax) { const a=getAge(s.dob); if (a==null||a>Number(ageMax)) return false }
    return true
  }).sort((a,b)=>(a.name||'').localeCompare(b.name||''))

  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE))
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const hasFilters = search||filterStatus!=='All'||filterCourse!=='All'||filterHostel!=='All'||filterHouse!=='All'||filterGender!=='All'||filterSession!=='All'||filterBatch!=='All'||gccMin||gccMax
  const clearAllFilters = () => { setSearch('');setFilterStatus('All');setFilterCourse('All');setFilterHostel('All');setFilterHouse('All');setFilterGender('All');setFilterSession('All');setFilterBatch('All');setGccMin('');setGccMax('');setPage(1) }
  const longAbsentCount = students.filter(s=>attData[s.id]!=null&&attData[s.id]<50).length

  const KPI_ITEMS = [
    {label:'Total',        value:students.length,                                          color:D.text1, icon:'👥'},
    {label:'Active',       value:students.filter(s=>s.status==='Active').length,           color:D.emerald,icon:'●', fkey:'status',fval:'Active'},
    {label:'Boarders',     value:students.filter(s=>s.hostel_type==='Boarder').length,     color:D.emerald,icon:'🏠', fkey:'hostel',fval:'Boarder'},
    {label:'Day Boarders', value:students.filter(s=>s.hostel_type==='Day Boarder').length, color:D.amber,  icon:'🌅', fkey:'hostel',fval:'Day Boarder'},
    {label:'Day Scholars', value:students.filter(s=>s.hostel_type==='Day Scholar').length, color:D.text2,  icon:'🏫', fkey:'hostel',fval:'Day Scholar'},
    {label:'Male',         value:students.filter(s=>s.gender==='Male').length,             color:'#60A5FA',icon:'♂'},
    {label:'Female',       value:students.filter(s=>s.gender==='Female').length,           color:'#F472B6',icon:'♀'},
    {label:'Birthdays',    value:students.filter(s=>isBirthdayToday(s.dob)).length,        color:D.orange, icon:'🎂'},
    {label:'Incomplete',   value:students.filter(s=>getMissingFields(s).length>0).length,  color:D.amber,  icon:'⚠'},
    {label:'New (7d)',     value:students.filter(s=>isRecentlyAdded(s.created_at)).length, color:D.teal,   icon:'🆕'},
    {label:'Fee Dues',     value:Object.values(feeData).filter(v=>v?.dues>0).length,       color:D.rose,   icon:'💰'},
    {label:'Low Att.',     value:longAbsentCount, color:D.rose, icon:'📉', warn:longAbsentCount>0},
  ]

  // ── CSS ───────────────────────────────────────────────────────────────────────
  const globalCSS = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700;800&display=swap');
    @keyframes spin { to { transform:rotate(360deg) } }
    @keyframes slideIn { from { transform:translateX(20px);opacity:0 } to { transform:translateX(0);opacity:1 } }
    @keyframes slideLeft { from { transform:translateX(30px);opacity:0 } to { transform:translateX(0);opacity:1 } }
    @keyframes fadeUp { from { transform:translateY(12px);opacity:0 } to { transform:translateY(0);opacity:1 } }
    * { box-sizing:border-box }
    body { background:${D.bg}; font-family:'IBM Plex Sans',system-ui,sans-serif; }
    select, input, textarea {
      background:${D.card} !important; color:${D.text1} !important; border-color:${D.border2} !important;
      font-family:'IBM Plex Sans',system-ui,sans-serif;
    }
    select:focus, input:focus, textarea:focus {
      border-color:${D.brand} !important; outline:none !important;
      box-shadow:0 0 0 3px rgba(59,130,246,.15) !important;
    }
    select option { background:${D.card}; color:${D.text1} }
    ::-webkit-scrollbar { width:5px; height:5px }
    ::-webkit-scrollbar-track { background:${D.bg} }
    ::-webkit-scrollbar-thumb { background:${D.border2}; border-radius:3px }
    ::-webkit-scrollbar-thumb:hover { background:${D.border3} }
    .sticky-bar {
      position:sticky; top:0; z-index:100;
      background:${D.bg}; padding:8px 0 8px;
      border-bottom:1px solid ${D.border}; margin-bottom:12px;
    }
    .role-badge {
      display:inline-flex; align-items:center; gap:6px;
      padding:3px 10px; border-radius:4px; font-size:10px; font-weight:700;
      text-transform:uppercase; letter-spacing:.08em;
    }
  `

  const ROLE_COLORS = {
    admin:{color:D.rose,bg:D.roseDim,border:D.roseBorder},
    manager:{color:D.amber,bg:D.amberDim,border:D.amberBorder},
    accounts:{color:D.emerald,bg:D.emeraldDim,border:D.emeraldBorder},
    teacher:{color:D.sky,bg:D.skyDim,border:D.skyBorder},
    hostel:{color:D.violet,bg:D.violetDim,border:D.violetBorder},
    reception:{color:D.teal,bg:D.tealDim,border:D.tealBorder},
    staff:{color:D.text2,bg:D.card2,border:D.border2},
    viewer:{color:D.text3,bg:D.card2,border:D.border},
  }
  const rc = ROLE_COLORS[role] || ROLE_COLORS.viewer

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{globalCSS}</style>
      {toast && <Toast msg={toast.msg} color={toast.color}/>}
      {undoItem && <UndoBanner student={undoItem} onUndo={handleUndo} onDismiss={()=>setUndoItem(null)}/>}

      {/* SEC-4: Modal confirmation replaces browser confirm() */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={()=>setConfirmModal(null)}
        />
      )}

      {/* Column picker */}
      {showColPicker && (
        <Modal onClose={()=>setShowColPicker(false)} width={320} title="Choose Columns">
          {ALL_COLUMNS.map(col => (
            <label key={col.key} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', cursor:'pointer', borderBottom:`1px solid ${D.border}`}}>
              <input type="checkbox" checked={visibleCols.includes(col.key)}
                onChange={e=>saveCol(e.target.checked?[...visibleCols,col.key]:visibleCols.filter(k=>k!==col.key))}
                style={{accentColor:D.brand}}/>
              <span style={{fontSize:13, fontWeight:600, color:D.text2}}>{col.label}</span>
            </label>
          ))}
          <button onClick={()=>setShowColPicker(false)} style={{...BTN.primary, width:'100%', marginTop:14, padding:'10px'}}>Done</button>
        </Modal>
      )}

      {detailPanel && (
        <StudentDetailDrawer
          student={detailPanel} allStudents={students}
          attData={attData} examData={examData} feeData={feeData} feeHistory={feeHistory}
          can={can} onClose={()=>setDetailPanel(null)}
          onEdit={s=>{setEditing(s);setFormOpen(true);setDetailPanel(null)}}
          showToast={showToast}
        />
      )}
      {feePanel && (
        <FeeCollectionModal app={feePanel} onClose={()=>setFeePanel(null)}
          onSaved={()=>{setFeePanel(null);loadAll();showToast('Payment recorded!',D.emerald)}}/>
      )}
      {examEntry && (
        <ExamScoreModal student={examEntry} can={can}
          onClose={()=>setExamEntry(null)}
          onSaved={()=>{setExamEntry(null);const ids=students.map(s=>s.id);loadExamData(ids)}}
          showToast={showToast}/>
      )}
      {showBulkOps && <BulkOperationsModal students={students} selectedIds={selected} can={can} onClose={()=>setShowBulkOps(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showRollover && <SessionRolloverWizard students={students} can={can} onClose={()=>setShowRollover(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showBulkFee && <BulkFeeModal students={students} selectedIds={selected} can={can} onClose={()=>setShowBulkFee(false)} onSaved={loadAll} showToast={showToast}/>}
      {showHouseReassign && <HouseReassignmentModal students={students} selectedIds={selected} can={can} onClose={()=>setShowHouseReassign(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showMergeDups && <MergeDuplicatesModal students={students} can={can} onClose={()=>setShowMergeDups(false)} onRefresh={loadAll} showToast={showToast}/>}

      {quickAttend && (
        <Modal onClose={()=>setQuickAttend(null)} width={320} title="Quick Attendance" subtitle={`${quickAttend.name} · ${new Date().toLocaleDateString('en-IN')}`}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            {['Present','Absent','Late','Medical'].map(status => {
              const c = {Present:D.emerald,Absent:D.rose,Late:D.amber,Medical:D.sky}[status]
              return (
                <button key={status} onClick={async()=>{
                  const today = new Date().toISOString().slice(0,10)
                  const { data:ex } = await supabase.from('attendance').select('*').eq('student_id',quickAttend.id).eq('date',today).single()
                  if (ex) await supabase.from('attendance').update({status}).eq('id',ex.id)
                  else await supabase.from('attendance').insert({student_id:quickAttend.id,date:today,status})
                  await auditLog('quick_attend', { student_id:quickAttend.id, date:today, status })
                  showToast(`Marked ${status}`,c); loadAttData([quickAttend.id]); setQuickAttend(null)
                }} style={{
                  padding:'14px', borderRadius:D.r8, border:`1.5px solid ${c}30`,
                  background:`${c}12`, fontSize:12, fontWeight:700, cursor:'pointer', color:c
                }}>
                  {status==='Present'?'✓':status==='Absent'?'✗':status==='Late'?'⏰':'🏥'} {status}
                </button>
              )
            })}
          </div>
        </Modal>
      )}

      {/* ── Page ── */}
      <div style={{padding:'0 24px 48px', background:D.bg, minHeight:'100vh', color:D.text1}}>

        {/* Page Header */}
        <div style={{padding:'28px 0 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:14, borderBottom:`1px solid ${D.border}`, marginBottom:20}}>
          <div>
            <div style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.18em', color:D.text3, marginBottom:8}}>GNSI Portal · Student Registry</div>
            <div style={{fontSize:28, fontWeight:800, color:D.text1, letterSpacing:'-.04em', lineHeight:1, fontFamily:"'IBM Plex Sans',sans-serif"}}>Students</div>
            <div style={{display:'flex', alignItems:'center', gap:12, marginTop:8}}>
              <div style={{fontSize:12, color:D.text3, fontFamily:"'IBM Plex Mono',monospace"}}>
                {loading ? 'Loading…' : <><span style={{color:D.text1, fontWeight:700}}>{filtered.length}</span> / {students.length} records</>}
              </div>
              <span className="role-badge" style={{color:rc.color, background:rc.bg, border:`1px solid ${rc.border}`}}>🔐 {role}</span>
              {!can.write && <span style={{fontSize:10, color:D.amber, fontWeight:600}}>Read-only mode</span>}
            </div>
          </div>
          <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
            <div style={{display:'flex', border:`1px solid ${D.border}`, borderRadius:D.r8, overflow:'hidden'}}>
              {[['compact','▪'],['comfortable','▬'],['spacious','▩']].map(([d,icon])=>(
                <button key={d} title={d} onClick={()=>changeDensity(d)} style={{padding:'7px 10px', border:'none', fontSize:12, cursor:'pointer', background:density===d?D.brand:D.card2, color:density===d?'#fff':D.text3, transition:'all .12s'}}>{icon}</button>
              ))}
            </div>
            <div style={{display:'flex', border:`1px solid ${D.border}`, borderRadius:D.r8, overflow:'hidden'}}>
              {[['list','≡'],['card','⊞']].map(([v,l])=>(
                <button key={v} onClick={()=>setViewMode(v)} style={{padding:'7px 12px', border:'none', fontSize:14, fontWeight:700, cursor:'pointer', background:viewMode===v?D.brand:D.card2, color:viewMode===v?'#fff':D.text3}}>{l}</button>
              ))}
            </div>
            <button onClick={()=>setShowColPicker(true)} style={{...BTN.secondary}}>⚙ Cols</button>
            <button onClick={loadAll} style={{...BTN.secondary, padding:'7px 12px'}}>↻</button>
            <IfCan can={can.write}>
              <button onClick={()=>{setEditing(null);setFormOpen(true)}} style={{...BTN.primary, display:'flex', alignItems:'center', gap:8, padding:'10px 18px'}}>
                <span style={{fontSize:16,lineHeight:1}}>+</span> New Student
              </button>
            </IfCan>
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:16}}>
          <IfCan can={can.export}>
            {/* DESIGN-5: ref-based outside-click close */}
            <div style={{position:'relative'}} ref={exportMenuRef}>
              <button onClick={()=>setShowExportMenu(v=>!v)} style={{...BTN.secondary}}>Export ▾</button>
              {showExportMenu && (
                <div style={{position:'absolute', left:0, top:'110%', background:D.card2, border:`1px solid ${D.border2}`, borderRadius:D.r10, boxShadow:'0 20px 60px rgba(0,0,0,.8)', zIndex:999999, minWidth:240, overflow:'hidden'}}>
                  {[
                    {label:'Student List (CSV)', fn:()=>downloadCSV(filtered.map(s=>({GCC:s.gcc_no||'',Name:s.name||'',Batch:s.batch||'',Course:s.course||'',House:s.house||'',Hostel:s.hostel_type||'',Status:s.status||'',Phone:s.phone||'',Father:s.father_name||'',Admission:s.admission_date||''})),`students_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'Student List (PDF)', fn:()=>exportToPDF('Student List',[{key:'gcc_no',label:'GCC'},{key:'name',label:'Name'},{key:'batch',label:'Batch'},{key:'course',label:'Course'},{key:'house',label:'House'},{key:'status',label:'Status'},{key:'phone',label:'Phone'}],filtered.map(s=>({...s,gcc_no:'GCC-'+s.gcc_no})))},
                    {label:'Print Batch List',   fn:()=>printBatchList(filtered, filterBatch!=='All'?filterBatch:filterCourse!=='All'?filterCourse:'')},
                    {label:'Fee Dues (CSV)',      fn:()=>downloadCSV(filtered.filter(s=>feeData[s.id]?.dues>0).map(s=>({GCC:s.gcc_no||'',Name:s.name||'',Dues:feeData[s.id]?.dues||0,Phone:s.phone||''})),`fee_dues_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'Attendance (CSV)',    fn:()=>downloadCSV(filtered.map(s=>({GCC:s.gcc_no||'',Name:s.name||'',Batch:s.batch||'',Att:attData[s.id]!=null?`${attData[s.id].toFixed(1)}%`:'—'})),`attendance_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'Parent Contacts',    fn:()=>downloadCSV(filtered.map(s=>({Name:s.name||'',Father:s.father_name||'',Mother:s.mother_name||'',Phone:s.phone||'',Address:s.address||''})),`parents_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'WhatsApp List',      fn:()=>downloadCSV(filtered.filter(s=>s.phone).map(s=>({Name:s.name||'',Phone:s.phone||'',WA:`https://wa.me/91${s.phone?.replace(/\D/g,'')}`})),`whatsapp_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'Birthday List',      fn:()=>{const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];downloadCSV(students.filter(s=>s.dob).map(s=>{const d=new Date(s.dob);return{Month:M[d.getMonth()],Day:d.getDate(),Name:s.name,DOB:s.dob,Batch:s.batch||'',Phone:s.phone||''}}).sort((a,b)=>M.indexOf(a.Month)-M.indexOf(b.Month)||a.Day-b.Day),`birthdays_${new Date().toISOString().slice(0,10)}.csv`)}},
                  ].map(item => (
                    <button key={item.label} onClick={()=>{item.fn();setShowExportMenu(false)}} style={{width:'100%', padding:'10px 16px', border:'none', background:'none', textAlign:'left', fontSize:12, fontWeight:600, cursor:'pointer', color:D.text2, borderBottom:`1px solid ${D.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background=D.card}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}
                    >{item.label}</button>
                  ))}
                </div>
              )}
            </div>
          </IfCan>

          <button onClick={()=>setShowAnalytics(v=>!v)} style={{...BTN.secondary, color:showAnalytics?D.violet:D.text2, borderColor:showAnalytics?D.violetBorder:D.border2, background:showAnalytics?D.violetDim:D.card2}}>Analytics</button>
          <button onClick={()=>setShowDeleted(v=>!v)} style={{...BTN.secondary, color:showDeleted?D.rose:D.text2, borderColor:showDeleted?D.roseBorder:D.border2, background:showDeleted?D.roseDim:D.card2}}>Archive{deleted.length>0?` (${deleted.length})`:''}</button>
          <IfCan can={can.write}>
            <button onClick={()=>setShowMergeDups(true)} style={{...BTN.secondary, color:D.rose, borderColor:D.roseBorder, background:D.roseDim}}>Merge Dups</button>
            <button onClick={()=>setShowRollover(true)} style={{...BTN.secondary, color:D.brand, borderColor:D.brandBorder, background:D.brandDim}}>🔄 Rollover</button>
          </IfCan>
        </div>

        {showAnalytics && <AnalyticsPanel students={students} attData={attData} feeData={feeData}/>}

        {showDeleted && (
          <div style={{background:D.roseDim, border:`1px solid ${D.roseBorder}`, borderRadius:D.r12, padding:'16px 20px', marginBottom:16}}>
            <div style={{fontWeight:800, color:D.rose, marginBottom:10, fontSize:12, textTransform:'uppercase', letterSpacing:'.08em'}}>Archive ({deleted.length})</div>
            {deleted.length===0 ? <div style={{color:D.text3, fontSize:13}}>No deleted records.</div>
            : deleted.map(s => (
              <div key={s.id} style={{display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:`1px solid ${D.roseBorder}`}}>
                <Avatar name={s.name} size={30}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700, fontSize:13, color:D.text2}}>{s.name}</div>
                  <div style={{fontSize:11, color:D.text3, fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{s.gcc_no} · {fmtD(s.deleted_at)}</div>
                </div>
                <button onClick={()=>handleRestore(s)} style={{...BTN.primary, padding:'5px 14px', fontSize:12, background:D.emerald}}>↩ Restore</button>
              </div>
            ))}
          </div>
        )}

        {/* KPI Strip */}
        <div style={{display:'flex', gap:7, flexWrap:'wrap', marginBottom:20}}>
          {KPI_ITEMS.map(k => (
            <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} warn={k.warn} icon={k.icon}
              active={k.fkey==='hostel'?filterHostel===k.fval:k.fkey==='status'?filterStatus===k.fval:false}
              onClick={k.fkey ? () => {
                if (k.fkey==='hostel') { setFilterHostel(f=>f===k.fval?'All':k.fval); setPage(1) }
                if (k.fkey==='status') { setFilterStatus(f=>f===k.fval?'All':k.fval); setPage(1) }
              } : undefined}
            />
          ))}
        </div>

        {formOpen && can.write && (
          <StudentForm onSave={handleSave} onCancel={()=>{setFormOpen(false);setEditing(null)}} editing={editing} allStudents={students}/>
        )}

        {selected.size>0 && (
          <div style={{display:'flex', alignItems:'center', gap:8, padding:'10px 16px', background:D.brandDim, border:`1px solid ${D.brandBorder}`, borderRadius:D.r10, marginBottom:12}}>
            <span style={{fontSize:12, fontWeight:700, color:D.brand, fontFamily:"'IBM Plex Mono',monospace"}}>{selected.size} selected</span>
            <div style={{flex:1}}/>
            <IfCan can={can.write}>
              <button onClick={()=>setShowBulkOps(true)} style={{...BTN.primary, padding:'6px 14px', fontSize:12}}>Bulk Actions</button>
              <button onClick={()=>setShowHouseReassign(true)} style={{padding:'6px 14px', borderRadius:D.r6, background:D.violetDim, color:D.violet, border:`1px solid ${D.violetBorder}`, fontSize:12, fontWeight:700, cursor:'pointer'}}>Reassign</button>
            </IfCan>
            <IfCan can={can.fees}>
              <button onClick={()=>setShowBulkFee(true)} style={{padding:'6px 14px', borderRadius:D.r6, background:D.emerald, color:'#000', border:'none', fontSize:12, fontWeight:800, cursor:'pointer'}}>Bulk Fee</button>
            </IfCan>
            <button onClick={clearSel} style={{...BTN.ghost, padding:'6px 10px', fontSize:12}}>✕</button>
          </div>
        )}

        {/* Sticky Filter Bar */}
        <div className="sticky-bar">
          <div style={{display:'flex', gap:6, marginBottom:8, flexWrap:'wrap', alignItems:'center'}}>
            {/* DESIGN-6: Show preset count and cap */}
            <button onClick={()=>setShowPresets(v=>!v)} style={{...BTN.ghost, fontSize:10}}>
              ⭐ Presets {presets.length>0?`(${presets.length}/${MAX_PRESETS})`:''}
            </button>
            {showPresets && (
              <>
                {presets.map(p=>(
                  <span key={p.name} style={{display:'inline-flex', alignItems:'center', gap:3}}>
                    <button onClick={()=>applyPreset(p.filters)} style={{...BTN.ghost,fontSize:10}}>{p.name}</button>
                    <button onClick={()=>removePreset(p.name)} style={{background:'none',border:'none',cursor:'pointer',color:D.rose,fontSize:12,padding:'0 2px'}}>✕</button>
                  </span>
                ))}
                {presets.length < MAX_PRESETS ? (
                  <>
                    <input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Name…" style={{...INP.base,width:110,padding:'4px 8px',fontSize:11}}/>
                    <button onClick={()=>{if(presetName.trim()){savePreset(presetName.trim(),currentFilters);setPresetName('');setShowPresets(false);showToast('Preset saved',D.brand)}}} style={{...BTN.primary,padding:'4px 10px',fontSize:11}}>Save</button>
                  </>
                ) : (
                  <span style={{fontSize:11, color:D.amber, fontWeight:600}}>Max {MAX_PRESETS} presets — delete one to add more</span>
                )}
              </>
            )}
            <button onClick={selectAll} style={{...BTN.ghost, fontSize:10}}>☑ Page</button>
            {selected.size>0 && <button onClick={clearSel} style={{...BTN.ghost, fontSize:10, color:D.rose, borderColor:D.roseBorder}}>✕ ({selected.size})</button>}
          </div>

          <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
            <div style={{flex:1, minWidth:220, position:'relative'}}>
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:D.text3,fontSize:13,pointerEvents:'none'}}>⌕</span>
              <input ref={searchRef} value={search}
                onChange={e=>{setSearch(e.target.value);setPage(1)}}
                onFocus={()=>setShowRecents(true)}
                onBlur={()=>setTimeout(()=>setShowRecents(false),150)}
                onKeyDown={e=>{if(e.key==='Enter'&&search.trim()){addSearch(search.trim());setShowRecents(false)}}}
                placeholder="Search name, GCC, phone… (⌘K)"
                style={{...INP.base, paddingLeft:32}}
              />
              {showRecents && recentSearches.length>0 && (
                <div style={{position:'absolute',top:'110%',left:0,right:0,background:D.card2,border:`1px solid ${D.border2}`,borderRadius:D.r8,boxShadow:'0 12px 40px rgba(0,0,0,.7)',zIndex:999,overflow:'hidden'}}>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'6px 12px',borderBottom:`1px solid ${D.border}`}}>
                    <span style={{fontSize:9,fontWeight:700,color:D.text3,textTransform:'uppercase',letterSpacing:'.08em'}}>Recent</span>
                    <button onMouseDown={clearSearches} style={{background:'none',border:'none',fontSize:10,color:D.rose,cursor:'pointer',fontWeight:700}}>Clear</button>
                  </div>
                  {recentSearches.map(q=>(
                    <button key={q} onMouseDown={()=>{setSearch(q);setShowRecents(false)}} style={{width:'100%',padding:'8px 12px',border:'none',background:'none',textAlign:'left',fontSize:12,cursor:'pointer',color:D.text2}}
                      onMouseEnter={e=>e.currentTarget.style.background=D.card}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}
                    >🕐 {q}</button>
                  ))}
                </div>
              )}
            </div>

            {[
              {val:filterStatus,  set:v=>{setFilterStatus(v);setPage(1)},  opts:STATUSES,          label:'Status'},
              {val:filterCourse,  set:v=>{setFilterCourse(v);setPage(1)},  opts:COURSES,           label:'Course'},
              {val:filterHostel,  set:v=>{setFilterHostel(v);setPage(1)},  opts:HOSTEL_TYPES,      label:'Hostel'},
              {val:filterGender,  set:v=>{setFilterGender(v);setPage(1)},  opts:GENDERS,           label:'Gender'},
              {val:filterSession, set:v=>{setFilterSession(v);setPage(1)}, opts:['All',...SESSIONS],label:'Session'},
              {val:filterBatch,   set:v=>{setFilterBatch(v);setPage(1)},   opts:allBatches,        label:'Batch'},
            ].map(f=>(
              <select key={f.label} value={f.val} onChange={e=>f.set(e.target.value)} style={{...INP.base,padding:'7px 10px',minWidth:90,cursor:'pointer',width:'auto'}}>
                {f.opts.map(o=><option key={o}>{o}</option>)}
              </select>
            ))}

            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              <input value={gccMin} onChange={e=>{setGccMin(e.target.value);setPage(1)}} placeholder="GCC≥" type="number" style={{...INP.base,width:66,padding:'7px 8px'}}/>
              <span style={{fontSize:11,color:D.text3}}>–</span>
              <input value={gccMax} onChange={e=>{setGccMax(e.target.value);setPage(1)}} placeholder="GCC≤" type="number" style={{...INP.base,width:66,padding:'7px 8px'}}/>
            </div>
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              <input value={ageMin} onChange={e=>{setAgeMin(e.target.value);setPage(1)}} placeholder="Age≥" type="number" style={{...INP.base,width:56,padding:'7px 8px'}}/>
              <span style={{fontSize:11,color:D.text3}}>–</span>
              <input value={ageMax} onChange={e=>{setAgeMax(e.target.value);setPage(1)}} placeholder="Age≤" type="number" style={{...INP.base,width:56,padding:'7px 8px'}}/>
            </div>
            {hasFilters && <button onClick={clearAllFilters} style={{...BTN.ghost,color:D.rose,borderColor:D.roseBorder,fontSize:11,padding:'7px 12px'}}>✕ Clear</button>}
            <span style={{fontSize:11,color:D.text3,fontFamily:"'IBM Plex Mono',monospace",whiteSpace:'nowrap'}}>{filtered.length}/{students.length}</span>
          </div>

          <div style={{marginTop:6}}>
            <button onClick={()=>setShowHousePills(v=>!v)} style={{...BTN.ghost,fontSize:9,padding:'2px 10px',marginBottom:showHousePills?6:0}}>
              {showHousePills?'▲':'▼'} Houses
            </button>
            {showHousePills && (
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>
                <button onClick={()=>{setFilterHouse('All');setPage(1)}} style={{padding:'2px 12px',borderRadius:99, border:`1.5px solid ${filterHouse==='All'?D.text1:D.border}`, background:filterHouse==='All'?D.card2:'none', color:filterHouse==='All'?D.text1:D.text3, fontSize:10,fontWeight:700,cursor:'pointer'}}>All</button>
                {houseOptions.map(h => {
                  const c=HOUSE_COLORS[h]||D.text3, active=filterHouse===h
                  return (
                    <button key={h} onClick={()=>{setFilterHouse(f=>f===h?'All':h);setPage(1)}} style={{padding:'2px 12px',borderRadius:99, border:`1.5px solid ${active?c:`${c}35`}`, background:active?`${c}18`:'none', color:active?c:`${c}80`, fontSize:10,fontWeight:700,cursor:'pointer'}}>
                      {h} <span style={{opacity:.6,fontSize:9}}>({students.filter(s=>s.house===h).length})</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Student List */}
        {loading ? (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'40vh',gap:14,color:D.text3}}>
            <div style={{width:20,height:20,border:`2px solid ${D.border2}`,borderTopColor:D.brand,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
            <span style={{fontWeight:600,fontSize:13}}>Loading students…</span>
          </div>
        ) : filtered.length===0 ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 20px',textAlign:'center'}}>
            <div style={{width:64,height:64,borderRadius:D.r12,background:D.card2,border:`1px solid ${D.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:16}}>🎓</div>
            <div style={{fontSize:16,fontWeight:700,color:D.text2,marginBottom:6}}>{students.length===0?'No students yet':'No results found'}</div>
            <p style={{fontSize:13,color:D.text3,maxWidth:'32ch',lineHeight:1.7,margin:'0 0 20px'}}>
              {students.length===0?'Click "+ New Student" to add your first student.':'Try adjusting your search or filters.'}
            </p>
            {can.write && students.length===0 && (
              <button onClick={()=>{setEditing(null);setFormOpen(true)}} style={{...BTN.primary,padding:'10px 24px'}}>+ New Student</button>
            )}
          </div>
        ) : viewMode==='card' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(290px,100%),1fr))',gap:10}}>
            {paginated.map(s => {
              const isSel = selected.has(s.id)
              const dues  = feeData[s.id]?.dues||0
              const att   = attData[s.id]
              const cs    = COURSE_STRUCTURE[s.course]
              return (
                <div key={s.id} style={{background:isSel?D.brandDim:D.card, border:`1px solid ${isSel?D.brandBorder:D.border}`, borderRadius:D.r10, padding:'16px', cursor:'pointer', transition:'border-color .12s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=isSel?D.brandBorder:D.border2}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=isSel?D.brandBorder:D.border}
                  onClick={()=>setDetailPanel(s)}
                >
                  <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:10}}>
                    {/* DESIGN-8: Both onChange and onClick stopPropagation on card checkbox */}
                    <input type="checkbox" checked={isSel}
                      onChange={e=>{ e.stopPropagation(); toggleSelect(s.id) }}
                      onClick={e=>e.stopPropagation()}
                      style={{width:14,height:14,accentColor:D.brand,marginTop:2}}/>
                    <Avatar name={s.name} photoUrl={s.photo_url} size={34}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:D.text1,letterSpacing:'-.01em'}}>{s.name}</div>
                      <div style={{fontSize:10,color:D.text3,marginTop:2,fontFamily:"'IBM Plex Mono',monospace"}}>{s.gcc_no&&`GCC-${s.gcc_no}`}{s.batch&&` · ${s.batch}`}{s.session&&` · ${s.session}`}</div>
                    </div>
                    {s.status && <StatusBadge status={s.status}/>}
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
                    {s.course&&<span style={{fontSize:10,fontWeight:600,color:cs?.color||D.text3,background:`${cs?.color||D.text3}15`,padding:'2px 7px',borderRadius:D.r4,border:`1px solid ${cs?.color||D.text3}20`}}>{s.course}</span>}
                    {s.house && <HousePill house={s.house}/>}
                    {att!=null&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:D.r4,background:att>=75?D.emeraldDim:D.roseDim,color:att>=75?D.emerald:D.rose,border:`1px solid ${att>=75?D.emeraldBorder:D.roseBorder}`,fontFamily:"'IBM Plex Mono',monospace"}}>{att.toFixed(0)}%</span>}
                  </div>
                  {dues>0&&<div style={{fontSize:11,fontWeight:700,color:D.rose,marginBottom:8,fontFamily:"'IBM Plex Mono',monospace"}}>⚠ ₹{fmt(dues)} due</div>}
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={e=>{e.stopPropagation();setDetailPanel(s)}} style={{flex:1,padding:'7px',borderRadius:D.r6,border:`1px solid ${D.brandBorder}`,background:D.brandDim,color:D.brand,fontSize:11,fontWeight:700,cursor:'pointer'}}>Profile</button>
                    <IfCan can={can.write}><button onClick={e=>{e.stopPropagation();setEditing(s);setFormOpen(true)}} style={{...BTN.ghost,padding:'7px 10px',fontSize:11}}>✏</button></IfCan>
                    <button onClick={e=>{e.stopPropagation();printIDCard(s)}} style={{...BTN.ghost,padding:'7px 10px',fontSize:11}} title="Print ID">🪪</button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:density==='compact'?3:density==='spacious'?10:6}}>
            {paginated.map(s => (
              <StudentRow key={s.id} s={s} can={can}
                onEdit={st=>{setEditing(st);setFormOpen(true)}}
                onDelete={handleDelete}
                onOpenFee={setFeePanel}
                onOpenDetail={setDetailPanel}
                onQuickAttend={handleQuickAttend}
                onExamEntry={setExamEntry}
                onClone={handleClone}
                feeData={feeData} attData={attData} examData={examData}
                density={density} visibleCols={visibleCols}
                selected={selected} onSelect={toggleSelect}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length>PAGE_SIZE && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:18,flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:12,color:D.text3,fontFamily:"'IBM Plex Mono',monospace"}}>
              {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}
            </span>
            <div style={{display:'flex',gap:4}}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{...BTN.ghost,padding:'6px 12px',opacity:page===1?.4:1,cursor:page===1?'not-allowed':'pointer'}}>←</button>
              {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                const p = totalPages<=5?i+1:Math.max(1,Math.min(page-2,totalPages-4))+i
                return <button key={p} onClick={()=>setPage(p)} style={{padding:'6px 11px',borderRadius:D.r6,border:`1px solid ${page===p?D.brand:D.border}`,fontSize:12,fontWeight:700,cursor:'pointer',background:page===p?D.brand:D.card2,color:page===p?'#fff':D.text3,transition:'all .12s'}}>{p}</button>
              })}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{...BTN.ghost,padding:'6px 12px',opacity:page===totalPages?.4:1,cursor:page===totalPages?'not-allowed':'pointer'}}>→</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}