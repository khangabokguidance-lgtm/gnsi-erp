// Students.jsx — GNSI Portal · Redesigned UI
// Premium institute management software design
// Preserves all logic, security fixes, and mobile patches from original
// Only the visual layer is replaced.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import FeeCollectionModal from './FeeCollectionModal'
import { getFlatFeeAmtSync, collectFee, rcptNo, gccStr as gccStrFee } from './feeEngine'
import { useAuth } from './AuthContext'

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt  = n => Number(n||0).toLocaleString('en-IN')
const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : '—'
const fmtM = d => d ? new Date(d).toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : '—'

// ─── Design System ─────────────────────────────────────────────────────────────
// Premium light-first design with dark mode support
// Inspired by Veeva, Salesforce Education Cloud, Classter
const T = {
  // Surfaces
  bg:           'var(--bg)',
  surface:      'var(--surface)',
  surface2:     'var(--surface2)',
  surfaceHover: 'var(--surface-hover)',
  // Text
  text1:  'var(--text1)',
  text2:  'var(--text2)',
  text3:  'var(--text3)',
  text4:  'var(--text4)',
  // Borders
  border:  'var(--border)',
  border2: 'var(--border2)',
  // Brand
  brand:      '#2563EB',
  brandLight: '#EFF6FF',
  brandBorder:'#BFDBFE',
  brandText:  '#1D4ED8',
  // Semantic
  green:        '#059669', greenLight:'#ECFDF5', greenBorder:'#A7F3D0', greenText:'#065F46',
  amber:        '#D97706', amberLight:'#FFFBEB', amberBorder:'#FDE68A', amberText:'#92400E',
  red:          '#DC2626', redLight:'#FEF2F2',   redBorder:'#FECACA',   redText:'#991B1B',
  violet:       '#7C3AED', violetLight:'#F5F3FF', violetBorder:'#DDD6FE', violetText:'#5B21B6',
  sky:          '#0284C7', skyLight:'#F0F9FF',   skyBorder:'#BAE6FD',   skyText:'#0C4A6E',
  teal:         '#0D9488', tealLight:'#F0FDFA',  tealBorder:'#99F6E4',  tealText:'#134E4A',
  rose:         '#E11D48', roseLight:'#FFF1F2',  roseBorder:'#FECDD3',  roseText:'#9F1239',
  orange:       '#EA580C', orangeLight:'#FFF7ED',orangeBorder:'#FED7AA',orangeText:'#9A3412',
  // Shadows
  shadow:  'var(--shadow)',
  shadow2: 'var(--shadow2)',
  // Radii
  r4:'4px', r6:'6px', r8:'8px', r10:'10px', r12:'12px', r16:'16px', r20:'20px', r24:'24px',
}

// Minimal inline icon set — used in page chrome (header, tabs, toolbar) to
// replace emoji with a consistent, professional stroke-icon look. Emoji stay
// inside student-facing cards/badges where they read as friendly, not chrome.
const SIcon = {
  home:     (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>,
  users:    (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15 14.3c2.7.4 4.6 2.3 5 5.7"/></svg>,
  check:    (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 11.5l2.4 2.5L16 8.5"/></svg>,
  refresh:  (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4v5h5M20 20v-5h-5"/><path d="M5.5 15A8 8 0 0 0 20 12M18.5 9A8 8 0 0 0 4 12"/></svg>,
  plus:     (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  download: (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>,
  fileText: (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3.5h7L18 8v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4M9 12h6M9 15.5h6"/></svg>,
  archive:  (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="4" width="17" height="4.2" rx="1"/><path d="M5 8.2V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.2"/><path d="M10 12.5h4"/></svg>,
  merge:    (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 4v6a4 4 0 0 0 4 4h4"/><path d="M8 20v-6"/><path d="m13 6 3-2 3 2M13 16l3 2 3-2"/></svg>,
  rotate:   (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4v5h5"/><path d="M4.6 15A8 8 0 1 0 6 6.3L4 9"/></svg>,
  x:        (p={}) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18"/></svg>,
}

// CSS Variables injected once
const CSS_VARS = `
  :root {
    --bg: #F8FAFC;
    --surface: #FFFFFF;
    --surface2: #F1F5F9;
    --surface-hover: #F8FAFC;
    --text1: #0F172A;
    --text2: #334155;
    --text3: #64748B;
    --text4: #94A3B8;
    --border: #E2E8F0;
    --border2: #CBD5E1;
    --shadow: 0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04);
    --shadow2: 0 4px 16px rgba(15,23,42,.08), 0 2px 6px rgba(15,23,42,.05);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0F172A;
      --surface: #1E293B;
      --surface2: #0F172A;
      --surface-hover: #1E293B;
      --text1: #F1F5F9;
      --text2: #CBD5E1;
      --text3: #94A3B8;
      --text4: #64748B;
      --border: #1E293B;
      --border2: #334155;
      --shadow: 0 1px 3px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2);
      --shadow2: 0 4px 16px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.2);
    }
  }
`

// ─── Constants (unchanged) ────────────────────────────────────────────────────
const COURSES      = ['All','Sainik','Navodaya','Foundation','Combined Course']
const HOSTEL_TYPES = ['All','Boarder','Day Scholar','Day Boarder']
const STATUSES     = ['All','Active','Inactive','Passed Out','Withdrawn']
const GENDERS      = ['All','Male','Female']
const SESSIONS     = ['2024-25','2025-26','2026-27']
const SUBJECTS     = ['Mathematics','Science','English','Social Studies','Hindi','GK','Reasoning']
const BATCH_CAPACITY = 80
const MAX_PRESETS  = 20

const ALLOWED_MIME_TYPES = ['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const ALLOWED_EXTENSIONS = ['.pdf','.jpg','.jpeg','.png','.doc','.docx']
const ALLOWED_IMAGE_MIMES = ['image/jpeg','image/png','image/webp','image/gif']
const ALLOWED_IMAGE_EXTS  = ['.jpg','.jpeg','.png','.webp','.gif']
const MAX_DOC_SIZE_MB = 10
const MAX_IMG_SIZE_MB = 5

const validateFile = (file, { mimes=ALLOWED_MIME_TYPES, exts=ALLOWED_EXTENSIONS, maxMB=MAX_DOC_SIZE_MB }={}) => {
  if (!file) return 'No file selected.'
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  if (!exts.includes(ext)) return `File type not allowed. Use: ${exts.join(', ')}`
  if (!mimes.includes(file.type)) return 'Invalid file type detected.'
  if (file.size > maxMB*1024*1024) return `File too large. Max ${maxMB}MB.`
  return null
}

const getSignedUrl = async (path, ttl=3600) => {
  const { data, error } = await supabase.storage.from('gnsi').createSignedUrl(path, ttl)
  if (error) throw error
  return data.signedUrl
}

const randomSuffix = () => Math.random().toString(36).slice(2,10)

const COURSE_STRUCTURE = {
  Navodaya:         { subtypes:['Lakshya','Umeed'],             color:'#2563EB', bg:'#EFF6FF' },
  Sainik:           { subtypes:['Achiever','Leader','Champion'], color:'#059669', bg:'#ECFDF5' },
  Foundation:       { subtypes:['Elite','Prime'],                color:'#7C3AED', bg:'#F5F3FF' },
  'Combined Course':{ subtypes:[],                               color:'#D97706', bg:'#FFFBEB' },
}

const PROMOTION_MAP = { 'Lakshya':'Umeed','Achiever':'Leader','Leader':'Champion','Elite':'Prime' }
const CLASSES_LIST = ['Achiever','Leader','Champion','Lakshya','Umeed','Elite','Prime']
const DAY_SCHOLAR_HOUSES = ['Day Scholar']

// Houses will be loaded dynamically from DB
let HOUSES_LIST  = ['Kombirei','Shiroi','Loktak','Singgarei','Koubru','Kangla','Sangai','Takhelei','Block-B','Day Scholar']
let HOUSE_COLORS = {
  Kombirei:'#2563EB', Kangla:'#DC2626',  Sangai:'#059669',   Singgarei:'#D97706',
  Loktak:'#7C3AED',   Koubru:'#0284C7',  Shiroi:'#DB2777',   Takhelei:'#EA580C',
  'Block-B':'#64748B','Day Scholar':'#94A3B8',
}

const STATUS_CFG = {
  Active:      { color:'#059669', bg:'#ECFDF5', border:'#A7F3D0', dot:'#10B981', label:'Active' },
  Inactive:    { color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', dot:'#F59E0B', label:'Inactive' },
  'Passed Out':{ color:'#0284C7', bg:'#F0F9FF', border:'#BAE6FD', dot:'#38BDF8', label:'Passed Out' },
  Withdrawn:   { color:'#DC2626', bg:'#FEF2F2', border:'#FECACA', dot:'#F87171', label:'Withdrawn' },
}

const HOSTEL_CFG = {
  Boarder:      { color:'#059669', bg:'#ECFDF5', border:'#A7F3D0' },
  'Day Boarder':{ color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' },
  'Day Scholar':{ color:'#64748B', bg:'#F8FAFC', border:'#E2E8F0' },
}

const ALL_COLUMNS = [
  {key:'name',        label:'Name',        default:true,  pii:false},
  {key:'gcc_no',      label:'GCC No.',     default:true,  pii:false},
  {key:'batch',       label:'Batch',       default:true,  pii:false},
  {key:'session',     label:'Session',     default:true,  pii:false},
  {key:'course',      label:'Course',      default:true,  pii:false},
  {key:'house',       label:'House',       default:true,  pii:false},
  {key:'hostel_type', label:'Hostel',      default:true,  pii:false},
  {key:'status',      label:'Status',      default:true,  pii:false},
  {key:'fee_dues',    label:'Fee Dues',    default:true,  pii:false},
  {key:'attendance',  label:'Att%',        default:true,  pii:false},
  {key:'gender',      label:'Gender',      default:false, pii:false},
  {key:'phone',       label:'Phone',       default:false, pii:true},   // ← PII
  {key:'father_name', label:'Father',      default:false, pii:true},   // ← PII
  {key:'last_paid',   label:'Last Paid',   default:false, pii:true},   // ← PII
]

// ─── Report Generator: field & report-type registry ──────────────────────────
const REPORT_FIELDS = [
  { key:'gcc_no',         label:'GCC No.',           group:'Identity',    pii:false },
  { key:'name',           label:'Name',              group:'Identity',    pii:false },
  { key:'gender',         label:'Gender',            group:'Identity',    pii:false },
  { key:'dob',            label:'Date of Birth',     group:'Identity',    pii:true  },
  { key:'age',            label:'Age',               group:'Identity',    pii:false },
  { key:'course',         label:'Course',            group:'Academic',    pii:false },
  { key:'batch',          label:'Batch',             group:'Academic',    pii:false },
  { key:'session',        label:'Session',           group:'Academic',    pii:false },
  { key:'status',         label:'Status',            group:'Academic',    pii:false },
  { key:'admission_date', label:'Admission Date',    group:'Academic',    pii:false },
  { key:'house',          label:'House',             group:'Residence',   pii:false },
  { key:'hostel_type',    label:'Hostel Type',       group:'Residence',   pii:false },
  { key:'attendance',     label:'Attendance %',      group:'Performance', pii:false },
  { key:'latest_score',   label:'Latest Exam Score', group:'Performance', pii:false },
  { key:'avg_score',      label:'Average Exam Score',group:'Performance', pii:false },
  { key:'best_score',     label:'Best Exam Score',   group:'Performance', pii:false },
  { key:'exam_count',     label:'Exams Recorded',    group:'Performance', pii:false },
  { key:'fee_dues',       label:'Fee Dues (₹)',      group:'Finance',     pii:false },
  { key:'last_paid',      label:'Last Paid',         group:'Finance',     pii:true  },
  { key:'phone',          label:'Phone',             group:'Contact',     pii:true  },
  { key:'father_name',    label:"Father's Name",     group:'Contact',     pii:true  },
  { key:'mother_name',    label:"Mother's Name",     group:'Contact',     pii:true  },
  { key:'address',        label:'Address',           group:'Contact',     pii:true  },
  { key:'remarks',        label:'Remarks',           group:'Other',       pii:false },
]

const REPORT_TYPES = [
  { key:'directory',  icon:'📋', label:'Student Directory',    desc:'Full roster with academic & residence info',
    cols:['gcc_no','name','course','batch','house','hostel_type','status'], groupBy:'none',   duesOnly:false },
  { key:'fees',       icon:'💰', label:'Fee Dues Report',      desc:'Outstanding dues & last payment — dues-only by default',
    cols:['gcc_no','name','batch','course','fee_dues','last_paid'],          groupBy:'course', duesOnly:true  },
  { key:'attendance', icon:'📊', label:'Attendance Report',    desc:'Attendance percentage by student',
    cols:['gcc_no','name','batch','attendance','status'],                    groupBy:'batch',  duesOnly:false },
  { key:'academic',   icon:'🎯', label:'Academic Performance', desc:'Latest, average & best exam scores by student',
    cols:['gcc_no','name','batch','course','latest_score','avg_score','best_score'],  groupBy:'course', duesOnly:false },
  { key:'house',      icon:'🏠', label:'House / Hostel Census',desc:'Distribution across houses & hostel types',
    cols:['gcc_no','name','house','hostel_type','course'],                   groupBy:'house',  duesOnly:false },
  { key:'custom',     icon:'⚙️', label:'Custom Report',        desc:'Build your own column & filter combination',
    cols:['gcc_no','name','batch','course','status'],                        groupBy:'none',   duesOnly:false },
]

const REPORT_PRESETS_KEY  = 'gnsi_report_presets'
const MAX_REPORT_PRESETS  = 15

const DENSITY = {
  compact:    { py:'6px',  avatarSize:28, fontSize:13 },
  comfortable:{ py:'12px', avatarSize:34, fontSize:14 },
  spacious:   { py:'18px', avatarSize:42, fontSize:14 },
}

const DRAFT_KEY    = 'gnsi_student_form_draft'
const PRESETS_KEY  = 'gnsi_filter_presets'
const SEARCHES_KEY = 'gnsi_recent_searches'
const COLUMNS_KEY  = 'gnsi_visible_columns'
const DENSITY_KEY  = 'gnsi_density'
const DRAFT_PII_FIELDS = ['phone','father_name','mother_name','address','emergency_contact','medical_notes','dob']

const sanitiseDraftForStorage = form => {
  const safe = {...form}
  DRAFT_PII_FIELDS.forEach(k=>delete safe[k])
  return safe
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#2563EB','#7C3AED','#059669','#D97706','#DB2777','#0D9488','#EA580C']
const avatarColor = name => AVATAR_PALETTE[(name||'').charCodeAt(0)%AVATAR_PALETTE.length]
const initials = name => (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

function deriveHostelType(house, hostelType) {
  if (house && DAY_SCHOLAR_HOUSES.includes(house)) return 'Day Scholar'
  if (['Boarder','Day Scholar','Day Boarder'].includes(hostelType)) return hostelType
  return 'Day Scholar'
}
function isBirthdayToday(dob) {
  if (!dob) return false
  const t=new Date(), d=new Date(dob)
  return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()
}
function isRecentlyAdded(createdAt) {
  if (!createdAt) return false
  return Date.now()-new Date(createdAt).getTime() < 7*24*60*60*1000
}
 // Comprehensive field completeness model — used by the card badge, the Data
 // Quality tab, and the dashboard summary card. Fields are weighted so core
 // identity/contact data counts more than optional notes; the total gives a
 // 0–100% completeness score per student.
 const COMPLETENESS_FIELDS = [
   { key:'gcc_no',            label:'GCC No.',          weight:3, pii:false },
   { key:'dob',                label:'DOB',              weight:3, pii:false },
   { key:'gender',             label:'Gender',           weight:1, pii:false },
   { key:'course',             label:'Course',           weight:3, pii:false },
   { key:'batch',              label:'Batch',            weight:2, pii:false },
   { key:'house',              label:'House',            weight:1, pii:false },
   { key:'admission_date',     label:'Admission Date',   weight:2, pii:false },
   { key:'phone',              label:'Phone',            weight:2, pii:true  },
   { key:'father_name',        label:'Father\'s Name',   weight:2, pii:true  },
   { key:'mother_name',        label:'Mother\'s Name',   weight:1, pii:true  },
   { key:'emergency_contact',  label:'Emergency Contact',weight:2, pii:true  },
   { key:'address',            label:'Address',          weight:1, pii:true  },
   { key:'prev_school',        label:'Previous School',  weight:1, pii:false },
 ]
 function getMissingFields(s, viewPII = false) {
   return COMPLETENESS_FIELDS
     .filter(f => (!f.pii || viewPII) && !s[f.key])
     .map(f => f.label)
 }
 function getCompletenessScore(s, viewPII = true) {
   const applicable = COMPLETENESS_FIELDS.filter(f => !f.pii || viewPII)
   const totalWeight = applicable.reduce((a,f)=>a+f.weight,0)
   const filledWeight = applicable.filter(f=>!!s[f.key]).reduce((a,f)=>a+f.weight,0)
   return totalWeight ? Math.round((filledWeight/totalWeight)*100) : 100
 }
 function getMissingFieldKeys(s, viewPII = true) {
   return COMPLETENESS_FIELDS.filter(f => (!f.pii || viewPII) && !s[f.key])
 }

function getAge(dob) {
  if (!dob) return null
  const today=new Date(), birth=new Date(dob)
  let age=today.getFullYear()-birth.getFullYear()
  if (today.getMonth()-birth.getMonth()<0||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate())) age--
  return age
}
function getEffectiveMonthlyDue(student) {
  const base=getFlatFeeAmtSync(student.hostel_type, student.course)
  const waiver=Number(student.fee_waiver||0)
  const scholarship=Number(student.scholarship||0)
  return Math.max(0, base-waiver-scholarship)
}
function downloadCSV(rows, filename) {
  if (!rows.length) return
  const h=Object.keys(rows[0])
  const csv=[h.join(','),...rows.map(r=>h.map(k=>`"${(r[k]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n')
  Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:filename}).click()
}
function exportToPDF(title, headers, rows) {
  const w=window.open('','_blank')
  const th=headers.map(h=>`<th>${h.label}</th>`).join('')
  const td=rows.map((r,i)=>`<tr style="background:${i%2?'#f8fafc':'#fff'}">${headers.map(h=>`<td>${r[h.key]??'—'}</td>`).join('')}</tr>`).join('')
  w.document.write(`<html><head><title>${title}</title><style>
    @page{size:A4 landscape;margin:10mm}body{font-family:'Inter',sans-serif;font-size:11px;padding:16px}
    h2{font-size:16px;margin-bottom:4px;color:#0F172A}.meta{color:#64748B;margin-bottom:12px;font-size:10px}
    table{width:100%;border-collapse:collapse}th{background:#0F172A;color:#fff;padding:6px 10px;text-align:left;font-size:10px;font-weight:600}
    td{padding:5px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#334155}
  </style></head><body>
    <h2>${title}</h2><div class="meta">${rows.length} records · ${new Date().toLocaleDateString('en-IN')}</div>
    <table><thead><tr>${th}</tr></thead><tbody>${td}</tbody></table>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
  </body></html>`)
  w.document.close()
}

// ─── Hooks (unchanged logic) ──────────────────────────────────────────────────
function usePermissions() {
  const { user } = useAuth()
  const role = user?.role || user?.app_metadata?.role || user?.user_metadata?.role || 'viewer'
  return {
    role,
    user,
    can: {
      write:   ['admin','manager','Admin','Manager'].includes(role),
      fees:    ['admin','manager','accounts','Admin','Manager','Accounts'].includes(role),
      exams:   ['admin','manager','teacher','Admin','Manager','Teacher'].includes(role),
      attend:  ['admin','manager','teacher','hostel','Admin','Manager','Teacher','Hostel'].includes(role),
      export:  ['admin','manager','accounts','Admin','Manager','Accounts'].includes(role),
      viewPII: ['admin','manager','Admin','Manager'].includes(role), // ← phone, father, address
      view:    true,
    }
  }
}

async function auditLog(action, details={}) {
  try {
    // This portal uses custom auth (gnsi_session in localStorage), not Supabase Auth —
    // supabase.auth.getSession() always returned an empty session here, which is part of
    // why this was broken. user_id is left NULL (uuid column) since the app's user id is
    // very likely not a real UUID (e.g. staff_profiles.id is bigint); the raw id/role are
    // captured in metadata instead, where any type is valid.
    const raw = localStorage.getItem('gnsi_session')
    const session = raw ? JSON.parse(raw) : null
    const user = session?.user || session || null
    const userName = user?.name || user?.username || user?.full_name || user?.role || 'Unknown'
    const { error } = await supabase.from('audit_logs').insert({
      action,
      module: 'Students',
      level: 'info',
      user_id: null,
      user_name: userName,
      metadata: { ...details, raw_user_id: user?.id ?? null, role: user?.role ?? null },
      created_at: new Date().toISOString(),
    })
    if (error) console.error('audit log insert failed:', error.message)
  } catch (err) { console.error('audit log failed:', err) }
}

function usePresets() {
  const load=()=>{try{return JSON.parse(localStorage.getItem(PRESETS_KEY)||'[]')}catch{return[]}}
  const [presets,setPresets]=useState(load)
  const save=(name,filters)=>{const next=[...presets.filter(p=>p.name!==name),{name,filters}].slice(-MAX_PRESETS);setPresets(next);localStorage.setItem(PRESETS_KEY,JSON.stringify(next))}
  const remove=name=>{const next=presets.filter(p=>p.name!==name);setPresets(next);localStorage.setItem(PRESETS_KEY,JSON.stringify(next))}
  return {presets,save,remove}
}

function useRecentSearches() {
  const load=()=>{try{return JSON.parse(localStorage.getItem(SEARCHES_KEY)||'[]')}catch{return[]}}
  const [recent,setRecent]=useState(load)
  const add=q=>{if(!q?.trim()||q.length<2)return;const next=[q,...recent.filter(r=>r!==q)].slice(0,8);setRecent(next);localStorage.setItem(SEARCHES_KEY,JSON.stringify(next))}
  const clear=()=>{setRecent([]);localStorage.removeItem(SEARCHES_KEY)}
  return {recent,add,clear}
}

function useIsMobile() {
  const [isMobile,setIsMobile]=useState(()=>window.innerWidth<768)
  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<768)
    window.addEventListener('resize',h)
    return ()=>window.removeEventListener('resize',h)
  },[])
  return isMobile
}

// ─── Design Primitives ────────────────────────────────────────────────────────

function Avatar({ name, photoUrl, size=36 }) {
  const c=avatarColor(name)
  if (photoUrl) return (
    <img src={photoUrl} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`2px solid ${c}20`}}/>
  )
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:`linear-gradient(135deg,${c}18,${c}30)`,
      border:`1.5px solid ${c}30`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:Math.round(size*0.36), fontWeight:700, color:c,
      letterSpacing:'-.01em', userSelect:'none',
    }}>{initials(name)}</div>
  )
}

function StatusPill({ status }) {
  const cfg=STATUS_CFG[status]||{color:T.text3,bg:T.surface2,border:T.border,dot:T.text3,label:status}
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 9px', borderRadius:T.r24, fontSize:11, fontWeight:600,
      background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
      letterSpacing:'.02em', whiteSpace:'nowrap', flexShrink:0,
    }}>
      <span style={{width:5,height:5,borderRadius:'50%',background:cfg.dot,flexShrink:0}}/>
      {cfg.label}
    </span>
  )
}

function CoursePill({ course }) {
  if (!course) return null
  const cs=COURSE_STRUCTURE[course]
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px', borderRadius:T.r4, fontSize:11, fontWeight:600,
      background:cs?.bg||T.surface2, color:cs?.color||T.text3,
      border:`1px solid ${cs?.color||T.text3}20`,
      whiteSpace:'nowrap', flexShrink:0,
    }}>{course}</span>
  )
}

function HousePill({ house, colorMap = {} }) {
  if (!house) return null
  const c = colorMap[house] || HOUSE_COLORS[house] || T.text3
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px', borderRadius:T.r4, fontSize:11, fontWeight:600,
      background:`${c}10`, color:c, border:`1px solid ${c}20`,
      whiteSpace:'nowrap', flexShrink:0,
    }}>
      <span style={{width:5,height:5,borderRadius:'50%',background:c,flexShrink:0}}/>
      {house}
    </span>
  )
}

function AttBar({ pct }) {
  if (pct==null) return <span style={{fontSize:12,color:T.text4}}>—</span>
  const good=pct>=75
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,minWidth:80}}>
      <div style={{flex:1,height:4,background:T.border,borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:good?T.green:T.red,borderRadius:2,transition:'width .3s'}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color:good?T.green:T.red,minWidth:32,textAlign:'right'}}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function FeeBadge({ dues }) {
  if (dues==null) return null
  if (dues===0) return <span style={{fontSize:11,fontWeight:600,color:T.green,display:'flex',alignItems:'center',gap:3}}><span style={{fontSize:14}}>✓</span>Clear</span>
  return <span style={{fontSize:11,fontWeight:700,color:T.red}}>₹{fmt(dues)}</span>
}

// ─── Card / Layout Primitives ─────────────────────────────────────────────────

const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{
    background:T.surface, borderRadius:T.r12, border:`1px solid ${T.border}`,
    boxShadow:T.shadow, overflow:'hidden', ...style,
    cursor:onClick?'pointer':undefined,
    transition:onClick?'box-shadow .15s,transform .15s':undefined,
  }}
  onMouseEnter={onClick?e=>{e.currentTarget.style.boxShadow=T.shadow2;e.currentTarget.style.transform='translateY(-1px)'}:undefined}
  onMouseLeave={onClick?e=>{e.currentTarget.style.boxShadow=T.shadow;e.currentTarget.style.transform=''}:undefined}
  >{children}</div>
)

function Btn({ children, onClick, variant='secondary', size='md', disabled, style={}, title }) {
  const sizes={sm:{padding:'5px 12px',fontSize:12,height:30},md:{padding:'8px 16px',fontSize:13,height:36},lg:{padding:'10px 20px',fontSize:14,height:40}}
  const variants={
    primary:{background:T.brand,color:'#fff',border:`1px solid ${T.brand}`,':hover':{background:T.brandText}},
    secondary:{background:T.surface,color:T.text2,border:`1px solid ${T.border2}`},
    ghost:{background:'transparent',color:T.text3,border:`1px solid transparent`},
    danger:{background:T.redLight,color:T.red,border:`1px solid ${T.redBorder}`},
    success:{background:T.greenLight,color:T.green,border:`1px solid ${T.greenBorder}`},
  }
  const v=variants[variant]||variants.secondary
  const s=sizes[size]||sizes.md
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      ...s, borderRadius:T.r8, fontWeight:600, cursor:disabled?'not-allowed':'pointer',
      opacity:disabled ? .5 : 1, display:'inline-flex', alignItems:'center', gap:6,
      transition:'all .12s', whiteSpace:'nowrap', flexShrink:0,
      fontFamily:'inherit', ...v, ...style,
    }}
    onMouseEnter={!disabled?e=>{e.currentTarget.style.filter='brightness(.95)'}:undefined}
    onMouseLeave={!disabled?e=>{e.currentTarget.style.filter=''}:undefined}
    >{children}</button>
  )
}

function Input({ value, onChange, placeholder, type='text', style={}, inputRef, onFocus, onBlur, onKeyDown }) {
  return (
    <input
      ref={inputRef} type={type} value={value} onChange={onChange}
      placeholder={placeholder} onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown}
      style={{
        width:'100%', padding:'8px 12px', borderRadius:T.r8, border:`1px solid ${T.border2}`,
        fontSize:14, background:T.surface, color:T.text1, outline:'none',
        fontFamily:'inherit', transition:'border-color .12s', boxSizing:'border-box',
        height:36, ...style,
      }}
      onFocus2={e=>e.target.style.borderColor=T.brand}
    />
  )
}

function Select({ value, onChange, children, style={} }) {
  return (
    <select value={value} onChange={onChange} style={{
      padding:'7px 10px', borderRadius:T.r8, border:`1px solid ${T.border2}`,
      fontSize:13, background:T.surface, color:T.text1, cursor:'pointer',
      outline:'none', fontFamily:'inherit', height:36, ...style,
    }}>{children}</select>
  )
}

function Divider({ label }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:12,margin:'20px 0 14px'}}>
      <div style={{flex:1,height:1,background:T.border}}/>
      <span style={{fontSize:10,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:T.text4}}>{label}</span>
      <div style={{flex:1,height:1,background:T.border}}/>
    </div>
  )
}

function Label({ children, error }) {
  return <div style={{fontSize:11,fontWeight:600,color:error?T.red:T.text3,marginBottom:4,letterSpacing:'.04em',textTransform:'uppercase'}}>{children}</div>
}

function FieldErr({ msg }) {
  return msg ? <div style={{fontSize:11,color:T.red,marginTop:3,display:'flex',alignItems:'center',gap:4}}>⚠ {msg}</div> : null
}

function FieldRow({ label, children, error }) {
  return (
    <div>
      <Label error={error}>{label}</Label>
      {children}
      <FieldErr msg={error}/>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, color=T.brand }) {
  return (
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      zIndex:999999, background:T.surface, borderRadius:T.r12,
      border:`1px solid ${T.border}`, boxShadow:T.shadow2,
      padding:'12px 20px', fontSize:13, fontWeight:600, color:T.text1,
      display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap',
      maxWidth:'90vw', animation:'toastIn .2s cubic-bezier(.34,1.56,.64,1)',
      borderLeft:`3px solid ${color}`,
    }}>
      <span style={{width:6,height:6,borderRadius:'50%',background:color,flexShrink:0}}/>
      {msg}
    </div>
  )
}

function UndoBanner({ student, onUndo, onDismiss }) {
  const [secs,setSecs]=useState(7)
  useEffect(()=>{
    const t=setInterval(()=>setSecs(s=>{if(s<=1){clearInterval(t);onDismiss();return 0}return s-1}),1000)
    return()=>clearInterval(t)
  },[])
  return (
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      zIndex:999999, background:T.surface, borderRadius:T.r12,
      border:`1px solid ${T.border}`, boxShadow:T.shadow2,
      padding:'14px 20px', display:'flex', alignItems:'center', gap:14,
      fontSize:13, fontWeight:600, color:T.text1, whiteSpace:'nowrap', maxWidth:'90vw',
    }}>
      <span>Archived <strong>{student.name}</strong></span>
      <Btn onClick={onUndo} variant='success' size='sm'>↩ Undo ({secs}s)</Btn>
      <button onClick={onDismiss} style={{background:'none',border:'none',color:T.text3,cursor:'pointer',fontSize:18,padding:'0 4px',lineHeight:1}}>×</button>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ children, onClose, width=480, title, subtitle }) {
  const isMobile=useIsMobile()
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:99999,
      display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center',
      background:'rgba(15,23,42,.5)', backdropFilter:'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background:T.surface, borderRadius:isMobile?`${T.r20} ${T.r20} 0 0`:T.r16,
        width:isMobile?'100%':Math.min(width,window.innerWidth-32),
        maxHeight:isMobile?'90vh':'85vh', boxShadow:T.shadow2,
        border:`1px solid ${T.border}`, display:'flex', flexDirection:'column',
        animation:isMobile?'slideUp .25s cubic-bezier(.34,1.2,.64,1)':'fadeUp .2s ease',
        overflow:'hidden',
      }} onClick={e=>e.stopPropagation()}>
        {(title||subtitle) && (
          <div style={{padding:'18px 20px 14px', borderBottom:`1px solid ${T.border}`, flexShrink:0, position:'relative'}}>
            {isMobile && <div style={{width:32,height:3,background:T.border2,borderRadius:2,margin:'0 auto 12px',opacity:.7}}/>}
            {title && <div style={{fontSize:16,fontWeight:700,color:T.text1,letterSpacing:'-.01em'}}>{title}</div>}
            {subtitle && <div style={{fontSize:12,color:T.text3,marginTop:2}}>{subtitle}</div>}
            <button onClick={onClose} style={{
              position:'absolute', top:14, right:16, width:28, height:28,
              borderRadius:T.r6, border:`1px solid ${T.border}`,
              background:T.surface2, cursor:'pointer', fontSize:14, color:T.text3,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>×</button>
          </div>
        )}
        <div style={{padding:'20px', flex:1, overflowY:'auto'}}>{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({ title, message, confirmLabel='Confirm', danger=false, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel} width={400} title={title}>
      <p style={{fontSize:14,color:T.text2,lineHeight:1.7,marginBottom:20}}>{message}</p>
      <div style={{display:'flex',gap:10}}>
        <Btn onClick={onConfirm} variant={danger?'danger':'primary'} style={{flex:1,justifyContent:'center'}}>{confirmLabel}</Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
      </div>
    </Modal>
  )
}

function IfCan({ can, fallback=null, children }) {
  return can ? children : fallback
}

// ─── Read-only Report Viewers ────────────────────────────────────────────────
// These replace the old data-entry shortcuts on the student card (which used
// to insert attendance/marks/payments directly). They only READ from the real
// module tables — no writes happen here. Use the Attendance/Exams/Fees modules
// themselves to record new data.

function AttendanceViewerModal({ student, onClose }) {
  const [loading,setLoading]=useState(true)
  const [records,setRecords]=useState([])
  useEffect(()=>{
    let cancelled=false
    const load=async()=>{
      // Attendance.jsx writes student_id when available, but falls back to
      // gcc_no/student_name matching for older records saved before that
      // field existed. Match on all three here too, or students with
      // legacy rows show "no records" even though they have history.
      const gcc=student.gcc_no?String(student.gcc_no):null
      const queries=[supabase.from('attendance_records').select('status,session_id').eq('student_id',student.id).limit(300)]
      if(gcc)queries.push(supabase.from('attendance_records').select('status,session_id').eq('gcc_no',gcc).limit(300))
      queries.push(supabase.from('attendance_records').select('status,session_id').eq('student_name',student.name).limit(300))
      const results=await Promise.all(queries)
      if(cancelled)return
      const seen=new Set()
      const recs=[]
      results.forEach(({data})=>{
        (data||[]).forEach(r=>{
          const key=`${r.session_id}|${r.status}`
          if(seen.has(key))return
          seen.add(key);recs.push(r)
        })
      })
      if(!recs.length){setLoading(false);return}
      const sessionIds=[...new Set(recs.map(r=>r.session_id))]
      const{data:sessions}=await supabase.from('attendance_sessions').select('id,session_date,subject_name,course').in('id',sessionIds)
      if(cancelled)return
      const sessMap={}
      ;(sessions||[]).forEach(s=>{sessMap[s.id]=s})
      const rows=recs.map(r=>{
        const sess=sessMap[r.session_id]
        return{status:r.status,date:sess?.session_date||null,subject:sess?.subject_name,course:sess?.course,orphaned:!sess}
      }).sort((a,b)=>{
        if(!a.date&&!b.date)return 0
        if(!a.date)return 1
        if(!b.date)return -1
        return new Date(b.date)-new Date(a.date)
      })
      setRecords(rows);setLoading(false)
    }
    load()
    return()=>{cancelled=true}
  },[student.id,student.gcc_no,student.name])

  const present=records.filter(r=>r.status==='Present').length
  const absent=records.filter(r=>r.status==='Absent').length
  const late=records.filter(r=>r.status==='Late').length
  const leave=records.filter(r=>r.status==='Leave').length
  const pct=records.length?((present+late*.5)/records.length*100).toFixed(1):null
  const orphanedCount=records.filter(r=>r.orphaned).length

  return (
    <Modal onClose={onClose} width={480} title={`Attendance — ${student.name}`} subtitle={pct!=null?`${pct}% overall · ${records.length} sessions on record`:'No records found'}>
      {!loading&&records.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
          {[{l:'Present',v:present,c:T.green},{l:'Absent',v:absent,c:T.red},{l:'Late',v:late,c:T.amber},{l:'Leave',v:leave,c:T.violet}].map(s=>(
            <div key={s.l} style={{background:T.surface2,borderRadius:T.r8,padding:'8px 10px',textAlign:'center',border:`1px solid ${T.border}`}}>
              <div style={{fontSize:16,fontWeight:800,color:s.c}}>{s.v}</div>
              <div style={{fontSize:9,color:T.text4,textTransform:'uppercase',letterSpacing:'.05em',fontWeight:600}}>{s.l}</div>
            </div>
          ))}
        </div>
      )}
      {loading?(
        <div style={{textAlign:'center',padding:'30px 0',color:T.text4,fontSize:13}}>Loading…</div>
      ):records.length===0?(
        <div style={{textAlign:'center',padding:'30px 0',color:T.text4,fontSize:13}}>No attendance records found for this student.</div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {orphanedCount>0&&(
            <div style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:11.5,color:T.amber,background:T.amberLight,border:`1px solid ${T.amberBorder}`,borderRadius:T.r8,padding:'8px 12px',marginBottom:4}}>
              <span style={{flexShrink:0,marginTop:1}}>⚠</span>
              <span>{orphanedCount} record{orphanedCount===1?'':'s'} reference a session that no longer exists (likely deleted from Attendance → Sessions). Status is shown below without a date.</span>
            </div>
          )}
          {records.slice(0,60).map((r,i)=>{
            const cfg=STATUS_CFG_ATT[r.status]||{color:T.text3,bg:T.surface2}
            return (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:T.r8,background:T.surface2,border:`1px solid ${T.border}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:r.orphaned?T.text4:T.text1}}>{r.orphaned?'Session deleted':fmtD(r.date)}</div>
                  {r.subject&&<div style={{fontSize:11,color:T.text4}}>{r.subject}{r.course?` · ${r.course}`:''}</div>}
                </div>
                <span style={{fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:T.r24,background:cfg.bg,color:cfg.color}}>{r.status}</span>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
const STATUS_CFG_ATT={Present:{color:T.green,bg:T.greenLight},Absent:{color:T.red,bg:T.redLight},Late:{color:T.amber,bg:T.amberLight},Leave:{color:T.violet,bg:T.violetLight}}

function ExamViewerModal({ student, onClose }) {
  const [loading,setLoading]=useState(true)
  const [sittings,setSittings]=useState([])
  useEffect(()=>{
    let cancelled=false
    supabase.from('exam_marks').select('exam_type_id,exam_date,subject,marks_obtained').eq('student_id',student.id).order('exam_date',{ascending:false})
      .then(({data,error})=>{
        if(cancelled)return
        if(error||!data){setLoading(false);return}
        const bySitting={}
        data.forEach(r=>{
          const key=`${r.exam_type_id}|${r.exam_date}`
          if(!bySitting[key])bySitting[key]={exam_date:r.exam_date,exam_type_id:r.exam_type_id,subjects:[],total:0}
          bySitting[key].subjects.push({subject:r.subject,marks:Number(r.marks_obtained)||0})
          bySitting[key].total+=Number(r.marks_obtained)||0
        })
        setSittings(Object.values(bySitting).sort((a,b)=>new Date(b.exam_date)-new Date(a.exam_date)));setLoading(false)
      })
    return()=>{cancelled=true}
  },[student.id])

  return (
    <Modal onClose={onClose} width={520} title={`Exam record — ${student.name}`} subtitle={sittings.length?`${sittings.length} exam sitting${sittings.length===1?'':'s'} on record`:'No records found'}>
      {loading?(
        <div style={{textAlign:'center',padding:'30px 0',color:T.text4,fontSize:13}}>Loading…</div>
      ):sittings.length===0?(
        <div style={{textAlign:'center',padding:'30px 0',color:T.text4,fontSize:13}}>No exam marks found for this student.</div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {sittings.map((s,i)=>(
            <div key={i} style={{border:`1px solid ${T.border}`,borderRadius:T.r10,overflow:'hidden'}}>
              <div style={{padding:'8px 12px',background:T.surface2,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12.5,fontWeight:700,color:T.text1}}>{fmtD(s.exam_date)}</span>
                <span style={{fontSize:13,fontWeight:800,color:s.total>=200?T.green:T.red}}>{s.total} total</span>
              </div>
              <div style={{padding:'8px 12px',display:'flex',flexDirection:'column',gap:4}}>
                {s.subjects.map((sub,j)=>(
                  <div key={j} style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                    <span style={{color:T.text3}}>{sub.subject}</span>
                    <span style={{fontWeight:600,color:T.text1}}>{sub.marks}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function FeeViewerModal({ student, feeData, feeHistory, onClose }) {
  const dues=feeData[student.id]?.dues||0
  const lastPaid=feeData[student.id]?.lastPaid
  const history=feeHistory[student.id]||[]
  const totalPaid=history.reduce((s,h)=>s+(h.amount||0),0)

  return (
    <Modal onClose={onClose} width={480} title={`Fee record — ${student.name}`} subtitle={`GCC-${student.gcc_no}`}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
        <div style={{background:T.surface2,borderRadius:T.r8,padding:'10px 12px',border:`1px solid ${T.border}`}}>
          <div style={{fontSize:9,fontWeight:600,color:T.text4,textTransform:'uppercase',letterSpacing:'.06em'}}>Total Paid</div>
          <div style={{fontSize:15,fontWeight:800,color:T.green,marginTop:3}}>₹{fmt(totalPaid)}</div>
        </div>
        <div style={{background:T.surface2,borderRadius:T.r8,padding:'10px 12px',border:`1px solid ${T.border}`}}>
          <div style={{fontSize:9,fontWeight:600,color:T.text4,textTransform:'uppercase',letterSpacing:'.06em'}}>Arrears</div>
          <div style={{fontSize:15,fontWeight:800,color:dues>0?T.red:T.green,marginTop:3}}>{dues>0?`₹${fmt(dues)}`:'Clear'}</div>
        </div>
      </div>
      {lastPaid&&<div style={{fontSize:11.5,color:T.text3,marginBottom:12}}>Last payment: {lastPaid}</div>}
      {history.length===0?(
        <div style={{textAlign:'center',padding:'20px 0',color:T.text4,fontSize:13}}>No payment history found for this student.</div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {history.map((h,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:T.r8,background:T.surface2,border:`1px solid ${T.border}`}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:600,color:T.text1}}>{h.type}{h.desc?` · ${h.desc}`:''}</div>
                <div style={{fontSize:11,color:T.text4}}>{fmtD(h.payment_date)}{h.mode?` · ${h.mode}`:''}</div>
              </div>
              <span style={{fontSize:13,fontWeight:800,color:T.green}}>₹{fmt(h.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}


// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color=T.text2, icon, onClick, active, warn, sub }) {
  return (
    <div onClick={onClick} style={{
      background: active?`${color}08`:warn?T.redLight:T.surface,
      borderRadius:T.r12, border:`1px solid ${active?color+'25':warn?T.redBorder:T.border}`,
      padding:'14px 16px', cursor:onClick?'pointer':undefined,
      transition:'all .15s', flex:'1 1 90px', minWidth:80,
      boxShadow:active?`0 0 0 3px ${color}15`:T.shadow,
    }}
    onMouseEnter={onClick?e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=T.shadow2}:undefined}
    onMouseLeave={onClick?e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=active?`0 0 0 3px ${color}15`:T.shadow}:undefined}
    >
      <div style={{fontSize:10,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:active?color:warn?T.red:T.text4,marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
        {icon&&<span style={{fontSize:13}}>{icon}</span>}{label}
      </div>
      <div style={{fontSize:22,fontWeight:700,color:active?color:warn?T.red:T.text1,letterSpacing:'-.03em',lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:10,color:T.text4,marginTop:3}}>{sub}</div>}
    </div>
  )
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ student, can, showToast }) {
  const [records,setRecords]=useState([])
  const [loading,setLoading]=useState(true)

  const load=useCallback(async()=>{
    setLoading(true)
    // Wired to the real Attendance module (attendance_records + attendance_sessions).
    // student_id may be missing on legacy rows — fall back to gcc_no/name match,
    // same as the card's AttendanceViewerModal.
    const gcc=student.gcc_no?String(student.gcc_no):null
    const queries=[supabase.from('attendance_records').select('status,session_id').eq('student_id',student.id).limit(400)]
    if(gcc)queries.push(supabase.from('attendance_records').select('status,session_id').eq('gcc_no',gcc).limit(400))
    queries.push(supabase.from('attendance_records').select('status,session_id').eq('student_name',student.name).limit(400))
    const results=await Promise.all(queries)
    const seen=new Set(),recs=[]
    results.forEach(({data})=>{(data||[]).forEach(r=>{const key=`${r.session_id}|${r.status}`;if(seen.has(key))return;seen.add(key);recs.push(r)})})
    if(!recs.length){setRecords([]);setLoading(false);return}
    const sessionIds=[...new Set(recs.map(r=>r.session_id))]
    const{data:sessions}=await supabase.from('attendance_sessions').select('id,session_date').in('id',sessionIds)
    const sessMap={};(sessions||[]).forEach(s=>{sessMap[s.id]=s})
    const rows=recs.map(r=>{const sess=sessMap[r.session_id];return{id:`${r.session_id}-${r.status}`,status:r.status,date:sess?.session_date||null}})
      .filter(r=>r.date).sort((a,b)=>new Date(b.date)-new Date(a.date))
    setRecords(rows)
    setLoading(false)
  },[student.id,student.gcc_no,student.name])
  useEffect(()=>{load()},[load])

  const presentDays=records.filter(r=>r.status==='Present').length
  const lateDays=records.filter(r=>r.status==='Late').length
  const absentDays=records.filter(r=>r.status==='Absent').length
  const leaveDays=records.filter(r=>r.status==='Leave').length
  const attPct=records.length?((presentDays+lateDays*.5)/records.length*100).toFixed(1):null
  let streak=0
  for(const r of records){if(r.status==='Absent')streak++;else break}

  const monthlyAtt=useMemo(()=>{
    const months={}
    records.forEach(r=>{
      const d=new Date(r.date),k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if(!months[k])months[k]={total:0,present:0,absent:0,late:0,leave:0}
      months[k].total++;months[k][r.status.toLowerCase()]=(months[k][r.status.toLowerCase()]||0)+1
    })
    return Object.entries(months).map(([k,v])=>({month:new Date(k+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}),...v,pct:v.total?((v.present+v.late*.5)/v.total*100).toFixed(0):0})).sort((a,b)=>b.month.localeCompare(a.month))
  },[records])

  const SC={Present:T.green,Absent:T.red,Late:T.amber,Leave:T.violet}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))',gap:10}}>
        {[{l:'Att %',v:attPct?`${attPct}%`:'—',c:attPct>=75?T.green:T.red},{l:'Present',v:presentDays,c:T.green},{l:'Absent',v:absentDays,c:T.red},{l:'Late',v:lateDays,c:T.amber},{l:'Leave',v:leaveDays,c:T.violet}].map(p=>(
          <div key={p.l} style={{background:T.surface2,borderRadius:T.r8,padding:'12px',textAlign:'center',border:`1px solid ${T.border}`}}>
            <div style={{fontSize:20,fontWeight:700,color:p.c}}>{p.v}</div>
            <div style={{fontSize:10,color:T.text4,marginTop:2,textTransform:'uppercase',letterSpacing:'.07em',fontWeight:600}}>{p.l}</div>
          </div>
        ))}
      </div>
      {streak>=3&&<div style={{background:T.redLight,border:`1px solid ${T.redBorder}`,borderRadius:T.r8,padding:'10px 14px',color:T.red,fontSize:12,fontWeight:600}}>⚠ {streak} consecutive absences</div>}
      {monthlyAtt.length>0&&(
        <div style={{overflowX:'auto'}}>
          <div style={{fontSize:11,fontWeight:600,color:T.text3,marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>Monthly Summary</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:300}}>
            <thead>
              <tr style={{background:T.surface2}}>
                {['Month','Days','Present','Absent','Late','%'].map(h=>(
                  <th key={h} style={{padding:'7px 10px',textAlign:h==='Month'?'left':'center',fontWeight:600,color:T.text3,borderBottom:`1px solid ${T.border}`,fontSize:10,textTransform:'uppercase',letterSpacing:'.06em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyAtt.map((m,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600,color:T.text2}}>{m.month}</td>
                  <td style={{padding:'7px 10px',textAlign:'center',color:T.text3}}>{m.total}</td>
                  <td style={{padding:'7px 10px',textAlign:'center',color:T.green,fontWeight:600}}>{m.present}</td>
                  <td style={{padding:'7px 10px',textAlign:'center',color:T.red}}>{m.absent}</td>
                  <td style={{padding:'7px 10px',textAlign:'center',color:T.amber}}>{m.late}</td>
                  <td style={{padding:'7px 10px',textAlign:'center',fontWeight:700,color:m.pct>=75?T.green:T.red}}>{m.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <div style={{fontSize:11,fontWeight:600,color:T.text3,marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>Last 30 Sessions</div>
        {loading?<div style={{color:T.text4,fontSize:12}}>Loading…</div>:records.length===0?<div style={{color:T.text4,fontSize:12}}>No attendance records found.</div>:(
          <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
            {records.slice(0,30).map(r=>{
              const c=SC[r.status]||T.text4
              return <div key={r.id} title={`${r.date}: ${r.status}`} style={{width:18,height:18,borderRadius:3,background:`${c}20`,border:`1px solid ${c}40`}}/>
            })}
          </div>
        )}
      </div>
      <div style={{fontSize:11,color:T.text4,fontStyle:'italic'}}>To mark attendance, use the Attendance module.</div>
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────
function DocumentsTab({ student, can, showToast }) {
  const [docs,setDocs]=useState([])
  const [loading,setLoading]=useState(true)
  const [uploading,setUploading]=useState(false)
  const [confirmDel,setConfirmDel]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true)
    const {data}=await supabase.from('student_documents').select('*').eq('student_id',student.id).order('created_at',{ascending:false})
    setDocs(data||[]);setLoading(false)
  },[student.id])
  useEffect(()=>{load()},[load])

  const openDoc=async doc=>{
    try{const url=await getSignedUrl(doc.storage_path,3600);window.open(url,'_blank','noreferrer')}
    catch(err){showToast('Could not open: '+err.message,T.red)}
  }

  const handleUpload=async(e,docType)=>{
    if(!can.write){showToast('No permission',T.red);return}
    const file=e.target.files[0];if(!file)return
    const err=validateFile(file);if(err){showToast(err,T.red);return}
    setUploading(true)
    const ext=file.name.split('.').pop().toLowerCase()
    const path=`student_docs/${student.id}/${docType}_${randomSuffix()}.${ext}`
    const{error:upErr}=await supabase.storage.from('gnsi').upload(path,file,{contentType:file.type})
    if(upErr){showToast('Upload failed: '+upErr.message,T.red);setUploading(false);return}
    const{error:dbErr}=await supabase.from('student_documents').insert({student_id:student.id,doc_type:docType,file_name:file.name,storage_path:path})
    if(dbErr){await supabase.storage.from('gnsi').remove([path]);showToast('Save failed: '+dbErr.message,T.red);setUploading(false);return}
    await auditLog('document_upload',{student_id:student.id,doc_type:docType,path})
    await load();setUploading(false);showToast(`${docType} uploaded`,T.green)
  }

  const handleDelete=async doc=>{
    const{error:sErr}=await supabase.storage.from('gnsi').remove([doc.storage_path])
    if(sErr){showToast('Storage error: '+sErr.message,T.red);return}
    const{error:dErr}=await supabase.from('student_documents').delete().eq('id',doc.id)
    if(dErr)showToast('Delete failed: '+dErr.message,T.red)
    else{await load();showToast('Deleted',T.green)}
    setConfirmDel(null)
  }

  const DOC_TYPES=['Birth Certificate','Transfer Certificate','Aadhaar','Photo','Other']

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {confirmDel&&<ConfirmModal title="Delete Document" message={`Delete "${confirmDel.file_name}"?`} confirmLabel="Delete" danger onConfirm={()=>handleDelete(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
      <IfCan can={can.write}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {DOC_TYPES.map(dt=>(
            <label key={dt} style={{cursor:'pointer'}}>
              <Btn as="span" variant='secondary' size='sm' style={{pointerEvents:'none'}}>↑ {dt}</Btn>
              <input type="file" style={{display:'none'}} onChange={e=>handleUpload(e,dt)} disabled={uploading} accept={ALLOWED_EXTENSIONS.join(',')}/>
            </label>
          ))}
        </div>
      </IfCan>
      {loading?<div style={{color:T.text4}}>Loading…</div>:docs.length===0?(
        <div style={{textAlign:'center',padding:'32px',color:T.text4,fontSize:13}}>No documents uploaded yet.</div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {docs.map(doc=>(
            <div key={doc.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px',background:T.surface2,borderRadius:T.r8,border:`1px solid ${T.border}`}}>
              <span style={{fontSize:18,flexShrink:0}}>📄</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:T.text1}}>{doc.doc_type}</div>
                <div style={{fontSize:11,color:T.text3,marginTop:1}}>{doc.file_name} · {fmtD(doc.created_at)}</div>
              </div>
              <Btn onClick={()=>openDoc(doc)} size='sm'>Open</Btn>
              <IfCan can={can.write}>
                <Btn onClick={()=>setConfirmDel(doc)} variant='danger' size='sm'>Delete</Btn>
              </IfCan>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Exam Score Modal ─────────────────────────────────────────────────────────
function ExamScoreModal({ student, can, onClose, onSaved, showToast }) {
  const [examTypes,setExamTypes]=useState([])
  const [examType,setExamType]=useState('')
  const [scheduleRows,setScheduleRows]=useState([]) // [{id, subject, total_marks, exam_date}]
  const [examDate,setExamDate]=useState('')
  const [marks,setMarks]=useState({}) // {subject: value}
  const [remark,setRemark]=useState('')
  const [loadingSchedule,setLoadingSchedule]=useState(false)
  const [saving,setSaving]=useState(false)

  useEffect(()=>{
    supabase.from('exam_types').select('id,name').order('name').then(({data})=>setExamTypes(data||[]))
  },[])

  useEffect(()=>{
    if(!examType){setScheduleRows([]);setExamDate('');return}
    setLoadingSchedule(true)
    supabase.from('exam_schedule').select('id,subject,total_marks,exam_date').eq('exam_type_id',examType).eq('course',student.course).order('exam_date')
      .then(({data})=>{
        setScheduleRows(data||[])
        const dates=[...new Set((data||[]).map(r=>r.exam_date))]
        setExamDate(dates[0]||'')
        setMarks({})
        setLoadingSchedule(false)
      })
  },[examType,student.course])

  // Existing marks for this student/exam/date, so re-opening shows what's already saved
  useEffect(()=>{
    if(!examType||!examDate)return
    supabase.from('exam_marks').select('subject,marks_obtained').eq('student_id',student.id).eq('exam_type_id',examType).eq('exam_date',examDate)
      .then(({data})=>{
        const m={}
        ;(data||[]).forEach(r=>{m[r.subject]=String(r.marks_obtained)})
        setMarks(m)
      })
  },[examType,examDate,student.id])

  const subjectsForDate=scheduleRows.filter(r=>r.exam_date===examDate)
  const total=subjectsForDate.reduce((a,r)=>a+(Number(marks[r.subject])||0),0)
  const maxTotal=subjectsForDate.reduce((a,r)=>a+(Number(r.total_marks)||0),0)

  const handleSave=async()=>{
    if(!can.exams){showToast('No permission',T.red);return}
    if(!examType||!examDate){showToast('Select an exam type and date',T.red);return}
    if(!subjectsForDate.length){showToast('No scheduled subjects found for this exam/date/course',T.red);return}
    setSaving(true)
    const rows=subjectsForDate.map(r=>({
      student_id:student.id, exam_id:r.id, exam_type_id:examType, exam_date:examDate,
      subject:r.subject, marks_obtained:Number(marks[r.subject])||0,
    }))
    const{error}=await supabase.from('exam_marks').upsert(rows,{onConflict:'student_id,exam_id'})
    if(remark.trim()){
      await supabase.from('exam_remarks').upsert(
        {student_id:student.id,exam_type_id:examType,exam_date:examDate,remark:remark.trim()},
        {onConflict:'student_id,exam_type_id,exam_date'}
      )
    }
    setSaving(false)
    if(error){showToast('Save failed: '+error.message,T.red);return}
    await auditLog('exam_marks_entry',{student_id:student.id,exam_type_id:examType,exam_date:examDate,total})
    showToast('Marks saved',T.green);onSaved()
  }

  return (
    <Modal onClose={onClose} width={540} title="Enter exam marks" subtitle={`${student.name} · ${student.batch}`}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:16}}>
        <FieldRow label="Exam type *">
          <select value={examType} onChange={e=>setExamType(e.target.value)} style={{width:'100%',padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:14,background:T.surface,color:T.text1,height:36,fontFamily:'inherit',boxSizing:'border-box'}}>
            <option value="">Select…</option>
            {examTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Exam date *">
          <select value={examDate} onChange={e=>setExamDate(e.target.value)} disabled={!examType} style={{width:'100%',padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:14,background:T.surface,color:T.text1,height:36,fontFamily:'inherit',boxSizing:'border-box'}}>
            <option value="">Select…</option>
            {[...new Set(scheduleRows.map(r=>r.exam_date))].map(d=><option key={d} value={d}>{fmtD(d)}</option>)}
          </select>
        </FieldRow>
      </div>

      {!examType?(
        <div style={{textAlign:'center',padding:'20px 0',color:T.text4,fontSize:13}}>Select an exam type to see scheduled subjects.</div>
      ):loadingSchedule?(
        <div style={{textAlign:'center',padding:'20px 0',color:T.text4,fontSize:13}}>Loading schedule…</div>
      ):subjectsForDate.length===0?(
        <div style={{textAlign:'center',padding:'20px 0',color:T.amber,fontSize:13}}>No subjects scheduled for {student.course} on this date. Set up the schedule in the Exams module first.</div>
      ):(
        <>
          <Divider label="Subject marks"/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,marginBottom:16}}>
            {subjectsForDate.map(r=>(
              <FieldRow key={r.id} label={`${r.subject} (/${r.total_marks})`}>
                <input type="number" value={marks[r.subject]||''} onChange={e=>setMarks(p=>({...p,[r.subject]:e.target.value}))}
                  placeholder={`0–${r.total_marks}`} style={{width:'100%',padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:14,background:T.surface,color:T.text1,height:36,fontFamily:'inherit',boxSizing:'border-box'}}/>
              </FieldRow>
            ))}
          </div>
          <div style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:T.r8,padding:'14px 16px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:600,fontSize:13,color:T.text3}}>Total</span>
            <span style={{fontWeight:700,fontSize:24,color:total>=maxTotal*0.4?T.green:T.red}}>{total}<span style={{fontSize:14,fontWeight:400,color:T.text3}}> / {maxTotal}</span></span>
          </div>
        </>
      )}

      <FieldRow label="Remarks">
        <textarea value={remark} onChange={e=>setRemark(e.target.value)} placeholder="Optional remarks" rows={2} style={{width:'100%',padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:14,background:T.surface,color:T.text1,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}}/>
      </FieldRow>
      <div style={{display:'flex',gap:10,marginTop:18}}>
        <Btn onClick={handleSave} disabled={saving||!can.exams||!subjectsForDate.length} variant='primary' style={{flex:1,justifyContent:'center'}}>{saving?'Saving…':'Save marks'}</Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  )
}

// ─── Bulk Operations Modal ────────────────────────────────────────────────────
function BulkOperationsModal({ students, selectedIds, can, onClose, onRefresh, showToast }) {
  const [action,setAction]=useState('status')
  const [newStatus,setNewStatus]=useState('Active')
  const [targetBatch,setTargetBatch]=useState('')
  const [targetSession,setTargetSession]=useState('')
  const [processing,setProcessing]=useState(false)
  const selected=students.filter(s=>selectedIds.has(s.id))
  const canPromote=selected.every(s=>PROMOTION_MAP[s.batch])

  const handleBulkAction=async()=>{
    if(!can.write){showToast('No permission',T.red);return}
    if(!selected.length){showToast('No students selected',T.red);return}
    setProcessing(true)
    const ids=selected.map(s=>s.id)
    try{
      if(action==='status'){await supabase.from('students').update({status:newStatus}).in('id',ids);await auditLog('bulk_status_change',{ids,newStatus});showToast(`Status → ${newStatus}`,T.green)}
      else if(action==='delete'){await supabase.from('students').update({deleted_at:new Date().toISOString()}).in('id',ids);await auditLog('bulk_archive',{ids});showToast(`${ids.length} archived`,T.amber)}
      else if(action==='promote'){if(!canPromote){showToast('Some cannot be promoted',T.red);setProcessing(false);return}for(const u of selected)await supabase.from('students').update({batch:PROMOTION_MAP[u.batch],status:'Active'}).eq('id',u.id);showToast(`${ids.length} promoted`,T.green)}
      else if(action==='session'){if(!targetSession){showToast('Select session',T.red);setProcessing(false);return}await supabase.from('students').update({session:targetSession}).in('id',ids);showToast(`Session → ${targetSession}`,T.green)}
      else if(action==='batch'){if(!targetBatch){showToast('Enter batch',T.red);setProcessing(false);return}await supabase.from('students').update({batch:targetBatch}).in('id',ids);showToast(`Batch → ${targetBatch}`,T.green)}
      onRefresh();onClose()
    }catch(err){showToast('Failed: '+err.message,T.red)}
    setProcessing(false)
  }

  const actions=[
    {key:'status',label:'Change Status',desc:'Update enrollment status'},
    {key:'promote',label:`Promote ${canPromote?'✓':'⚠'}`,desc:'Auto-promote via promotion map'},
    {key:'session',label:'Change Session',desc:'Move to different academic session'},
    {key:'batch',label:'Change Batch',desc:'Assign a new batch'},
    {key:'delete',label:'Archive',desc:'Soft-archive selected students',danger:true},
  ]

  return (
    <Modal onClose={onClose} width={440} title="Bulk Operations" subtitle={`${selected.length} students selected`}>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
        {actions.map(a=>(
          <label key={a.key} style={{display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer',padding:'11px 14px',borderRadius:T.r8,background:action===a.key?(a.danger?T.redLight:T.brandLight):'transparent',border:`1px solid ${action===a.key?(a.danger?T.redBorder:T.brandBorder):T.border}`,transition:'all .12s'}}>
            <input type="radio" name="ba" checked={action===a.key} onChange={()=>setAction(a.key)} style={{marginTop:2,accentColor:a.danger?T.red:T.brand}}/>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:a.danger?T.red:T.text1}}>{a.label}</div>
              <div style={{fontSize:11,color:T.text3,marginTop:1}}>{a.desc}</div>
            </div>
            {action==='status'&&a.key==='status'&&(
              <Select value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{marginLeft:'auto',width:'auto'}}>
                {STATUSES.filter(s=>s!=='All').map(s=><option key={s}>{s}</option>)}
              </Select>
            )}
          </label>
        ))}
        {action==='session'&&<Select value={targetSession} onChange={e=>setTargetSession(e.target.value)}><option value="">— Select —</option>{SESSIONS.map(s=><option key={s}>{s}</option>)}</Select>}
        {action==='batch'&&<input value={targetBatch} onChange={e=>setTargetBatch(e.target.value)} placeholder="e.g. Umeed" style={{padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:13,background:T.surface,color:T.text1,fontFamily:'inherit',height:36}}/>}
      </div>
      <div style={{display:'flex',gap:10}}>
        <Btn onClick={handleBulkAction} disabled={processing||!can.write} variant={action==='delete'?'danger':'primary'} style={{flex:1,justifyContent:'center'}}>{processing?'Processing…':action==='delete'?'Archive Selected':'Apply'}</Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  )
}

// ─── Session Rollover Wizard ──────────────────────────────────────────────────
function SessionRolloverWizard({ students, can, onClose, onRefresh, showToast }) {
  const [step,setStep]=useState(1)
  const [sourceSession,setSourceSession]=useState('2024-25')
  const [targetSession,setTargetSession]=useState('2025-26')
  const [processing,setProcessing]=useState(false)
  const eligible=students.filter(s=>s.session===sourceSession&&s.status==='Active'&&s.session!==targetSession)
  const preview=eligible.map(s=>({...s,newBatch:PROMOTION_MAP[s.batch]||s.batch,newSession:targetSession}))
  const alreadyRolled=students.filter(s=>s.session===targetSession).length

  const runRollover=async()=>{
    if(!can.write){showToast('No permission',T.red);return}
    if(!preview.length){showToast('No eligible students',T.amber);return}
    setProcessing(true)
    try{
      for(const s of preview)await supabase.from('students').update({session:s.newSession,batch:s.newBatch,status:'Active'}).eq('id',s.id)
      const passedOut=eligible.filter(s=>!PROMOTION_MAP[s.batch])
      for(const s of passedOut)await supabase.from('students').update({status:'Passed Out'}).eq('id',s.id)
      await auditLog('session_rollover',{from:sourceSession,to:targetSession,count:preview.length})
      showToast(`Rollover complete — ${preview.length} updated`,T.green);onRefresh();onClose()
    }catch(err){showToast('Failed: '+err.message,T.red)}
    setProcessing(false)
  }

  return (
    <Modal onClose={onClose} width={560} title="Session Rollover" subtitle={`Step ${step} of 3`}>
      <div style={{display:'flex',gap:8,marginBottom:24,alignItems:'center'}}>
        {[1,2,3].map(n=>(
          <div key={n} style={{display:'flex',alignItems:'center',gap:8,flex:n<3?1:0}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:step>=n?T.brand:T.surface2,border:`1.5px solid ${step>=n?T.brand:T.border2}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:step>=n?'#fff':T.text3,flexShrink:0}}>{n}</div>
            <span style={{fontSize:11,fontWeight:600,color:step>=n?T.brand:T.text4,whiteSpace:'nowrap'}}>{['Select','Preview','Confirm'][n-1]}</span>
            {n<3&&<div style={{flex:1,height:1,background:step>n?T.brand:T.border,minWidth:12}}/>}
          </div>
        ))}
      </div>
      {step===1&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <FieldRow label="Source Session"><Select value={sourceSession} onChange={e=>setSourceSession(e.target.value)} style={{width:'100%'}}>{SESSIONS.map(s=><option key={s}>{s}</option>)}</Select></FieldRow>
          <FieldRow label="Target Session"><Select value={targetSession} onChange={e=>setTargetSession(e.target.value)} style={{width:'100%'}}>{SESSIONS.map(s=><option key={s}>{s}</option>)}</Select></FieldRow>
          {alreadyRolled>0&&<div style={{gridColumn:'1/-1',background:T.amberLight,border:`1px solid ${T.amberBorder}`,borderRadius:T.r8,padding:'10px 14px',fontSize:12,color:T.amber,fontWeight:600}}>⚠ {alreadyRolled} students already on {targetSession} — will be skipped.</div>}
        </div>
      )}
      {step===2&&(
        <div style={{maxHeight:280,overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:T.r8}}>
          {preview.length===0?<div style={{padding:'24px',textAlign:'center',color:T.text4,fontSize:13}}>No eligible students.</div>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:T.surface2}}>{['Student','Current','→ New','Status'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:T.text3,borderBottom:`1px solid ${T.border}`,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
              <tbody>{preview.map(s=>(
                <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`}}>
                  <td style={{padding:'8px 12px',fontWeight:600,color:T.text1}}>{s.name}</td>
                  <td style={{padding:'8px 12px',color:T.text3,fontSize:11}}>{s.batch} · {s.session}</td>
                  <td style={{padding:'8px 12px',color:T.brand,fontWeight:600,fontSize:11}}>{s.newBatch} · {s.newSession}</td>
                  <td style={{padding:'8px 12px'}}><span style={{fontSize:11,fontWeight:600,color:PROMOTION_MAP[s.batch]?T.green:T.red}}>{PROMOTION_MAP[s.batch]?'Active':'Passed Out'}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
      {step===3&&(
        <div style={{textAlign:'center',padding:'32px 20px'}}>
          <div style={{fontSize:40,marginBottom:12}}>🔄</div>
          <div style={{fontWeight:700,fontSize:18,color:T.text1,marginBottom:8}}>Ready to Execute</div>
          <div style={{fontSize:13,color:T.text3,marginBottom:24}}><strong style={{color:T.text1}}>{preview.length}</strong> students will be updated</div>
          <Btn onClick={runRollover} disabled={processing||!can.write||!preview.length} variant='primary' size='lg' style={{justifyContent:'center'}}>{processing?'Processing…':'Execute Rollover'}</Btn>
        </div>
      )}
      {step<3&&(
        <div style={{display:'flex',justifyContent:'space-between',marginTop:20}}>
          {step>1?<Btn onClick={()=>setStep(s=>s-1)}>← Back</Btn>:<div/>}
          <Btn onClick={()=>setStep(s=>s+1)} variant='primary'>Next →</Btn>
        </div>
      )}
    </Modal>
  )
}

// ─── Bulk Fee Modal ───────────────────────────────────────────────────────────
function BulkFeeModal({ students, selectedIds, can, onClose, onSaved, showToast }) {
  const [amount,setAmount]=useState('')
  const [monthFor,setMonthFor]=useState('')
  const [method,setMethod]=useState('Cash')
  const [saving,setSaving]=useState(false)
  const selected=students.filter(s=>selectedIds.has(s.id))
  const total=Number(amount||0)*selected.length

  const handleSave=async()=>{
    if(!can.fees){showToast('No permission',T.red);return}
    if(!amount||Number(amount)<=0){showToast('Enter valid amount',T.red);return}
    if(!monthFor){showToast('Enter month/description',T.red);return}
    setSaving(true)
    try{
      // Parse month for course fee — expects format like "January" or "Jan 2026"
      const monthName=monthFor.trim().split(' ')[0]
      const yr=Number(monthFor.trim().split(' ')[1])||new Date().getFullYear()
      let errors=0
      for(const s of selected){
        const gcc=gccStrFee(s.gcc_no)
        if(!gcc||gcc==='0'){errors++;continue}
        try{
          await collectFee({
            gcc,
            studentName:s.name,
            admNo:s.admission_no||'--',
            className:s.batch||s.class_name||'',
            course:s.course||'',
            hostelType:s.hostel_type||'Day Scholar',
            payDate:new Date().toISOString().slice(0,10),
            payMode:method,
            collectedBy:'Admin',
            receiptNo:rcptNo('BULK'),
            items:[{kind:'course',course:s.course||'',subtype:s.batch||'',month:monthName,year:yr,amount:Number(amount)}],
          })
        }catch(e){console.error('collectFee failed for',s.name,e);errors++}
      }
      await auditLog('bulk_fee_collection',{count:selected.length,errors,amount:Number(amount),monthFor,method})
      const msg=errors>0?`Collected for ${selected.length-errors}/${selected.length} students (${errors} failed)`:
        `Fee collected for ${selected.length} students`
      showToast(msg,errors>0?T.amber:T.green);onSaved();onClose()
    }catch(err){showToast('Failed: '+err.message,T.red)}
    setSaving(false)
  }

  return (
    <Modal onClose={onClose} width={440} title="Bulk Fee Collection" subtitle={`${selected.length} students`}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:16}}>
        <FieldRow label="Amount / Student (₹)"><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 2500" style={{width:'100%',padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:14,background:T.surface,color:T.text1,height:36,fontFamily:'inherit',boxSizing:'border-box'}}/></FieldRow>
        <FieldRow label="Month For"><input value={monthFor} onChange={e=>setMonthFor(e.target.value)} placeholder="e.g. Jan 2026" style={{width:'100%',padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:14,background:T.surface,color:T.text1,height:36,fontFamily:'inherit',boxSizing:'border-box'}}/></FieldRow>
        <FieldRow label="Method"><Select value={method} onChange={e=>setMethod(e.target.value)} style={{width:'100%'}}>{['Cash','UPI','Bank Transfer','Cheque'].map(m=><option key={m}>{m}</option>)}</Select></FieldRow>
        <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
          <div style={{fontSize:10,color:T.text4,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>Total</div>
          <div style={{fontSize:22,fontWeight:700,color:T.green}}>₹{fmt(total)}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:10}}>
        <Btn onClick={handleSave} disabled={saving||!can.fees} variant='success' style={{flex:1,justifyContent:'center'}}>{saving?'Saving…':'Collect Fee'}</Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  )
}

// ─── Merge Duplicates Modal ───────────────────────────────────────────────────
function MergeDuplicatesModal({ students, can, onClose, onRefresh, showToast }) {
  const [primaryId,setPrimaryId]=useState('')
  const [mergeIds,setMergeIds]=useState([])
  const [processing,setProcessing]=useState(false)
  const duplicates=useMemo(()=>{
    const dups=[],byName={},byPhone={}
    students.forEach(s=>{
      if(s.name){const k=s.name.toLowerCase().trim();if(!byName[k])byName[k]=[];byName[k].push(s)}
      if(s.phone){if(!byPhone[s.phone])byPhone[s.phone]=[];byPhone[s.phone].push(s)}
    })
    Object.values(byName).forEach(g=>{if(g.length>1)dups.push({type:'Name',students:g})})
    Object.values(byPhone).forEach(g=>{if(g.length>1)dups.push({type:'Phone',students:g})})
    return dups
  },[students])

  const handleMerge=async()=>{
    if(!can.write){showToast('No permission',T.red);return}
    if(!primaryId||!mergeIds.length){showToast('Select records',T.red);return}
    setProcessing(true)
    try{
      for(const tbl of['attendance','fee_collections','exam_scores','student_documents'])
        await supabase.from(tbl).update({student_id:primaryId}).in('student_id',mergeIds)
      await supabase.from('students').update({deleted_at:new Date().toISOString(),remarks:'Merged into '+primaryId}).in('id',mergeIds)
      await auditLog('merge_duplicates',{primaryId,mergeIds})
      showToast('Merged successfully',T.green);onRefresh();onClose()
    }catch(err){showToast('Merge failed: '+err.message,T.red)}
    setProcessing(false)
  }

  return (
    <Modal onClose={onClose} width={480} title="Merge Duplicates" subtitle={`${duplicates.length} groups found`}>
      <div style={{maxHeight:320,overflowY:'auto',marginBottom:12}}>
        {duplicates.length===0?<div style={{textAlign:'center',padding:'32px',color:T.text4,fontSize:13}}>No duplicates detected.</div>
        :duplicates.map((group,idx)=>(
          <div key={idx} style={{marginBottom:10,padding:'12px',background:T.surface2,borderRadius:T.r8,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:10,fontWeight:600,color:T.text4,marginBottom:8,textTransform:'uppercase',letterSpacing:'.07em'}}>{group.type} Match</div>
            {group.students.map(s=>(
              <label key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${T.border}`,cursor:'pointer'}}>
                <input type="radio" name={`p_${idx}`} checked={primaryId===s.id} onChange={()=>{setPrimaryId(s.id);setMergeIds(group.students.filter(x=>x.id!==s.id).map(x=>x.id))}} style={{accentColor:T.brand}}/>
                <Avatar name={s.name} size={24}/>
                <span style={{fontSize:13,fontWeight:600,color:T.text1,flex:1}}>{s.name}</span>
                <span style={{fontSize:11,color:T.text3}}>GCC-{s.gcc_no}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:T.amber,padding:'8px 0',fontWeight:600}}>ℹ Duplicates will be archived, not deleted.</div>
      <div style={{display:'flex',gap:10,marginTop:10}}>
        <Btn onClick={handleMerge} disabled={processing||!can.write} variant='danger' style={{flex:1,justifyContent:'center'}}>Merge & Archive</Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  )
}

// ─── House Reassignment Modal ─────────────────────────────────────────────────
function HouseReassignmentModal({ students, selectedIds, can, onClose, onRefresh, showToast }) {
  const [newHouse,setNewHouse]=useState('')
  const [processing,setProcessing]=useState(false)
  const handleReassign=async()=>{
    if(!can.write){showToast('No permission',T.red);return}
    if(!newHouse){showToast('Select a house',T.red);return}
    setProcessing(true)
    try{await supabase.from('students').update({house:newHouse}).in('id',Array.from(selectedIds));await auditLog('bulk_house_reassign',{ids:Array.from(selectedIds),newHouse});showToast(`${selectedIds.size} → ${newHouse}`,T.green);onRefresh();onClose()}
    catch(err){showToast('Failed: '+err.message,T.red)}
    setProcessing(false)
  }
  return (
    <Modal onClose={onClose} width={360} title="Bulk House Reassignment" subtitle={`${selectedIds.size} students`}>
      <FieldRow label="New House" style={{marginBottom:16}}>
        <Select value={newHouse} onChange={e=>setNewHouse(e.target.value)} style={{width:'100%'}}><option value="">— Select House —</option>{HOUSES_LIST.map(h=><option key={h}>{h}</option>)}</Select>
      </FieldRow>
      <div style={{display:'flex',gap:10,marginTop:16}}>
        <Btn onClick={handleReassign} disabled={processing||!can.write} variant='primary' style={{flex:1,justifyContent:'center'}}>Reassign</Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  )
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────
function AnalyticsPanel({ students }) {
  const byHouse=HOUSES_LIST.reduce((a,h)=>{a[h]=students.filter(s=>s.house===h).length;return a},{})
  const maxHouse=Math.max(...Object.values(byHouse),1)
  const byCourse=Object.keys(COURSE_STRUCTURE).reduce((a,c)=>{a[c]=students.filter(s=>s.course===c).length;return a},{})
  const male=students.filter(s=>s.gender==='Male').length
  const female=students.filter(s=>s.gender==='Female').length
  const total=male+female||1
  const boarders=students.filter(s=>s.hostel_type==='Boarder').length
  const dayBoard=students.filter(s=>s.hostel_type==='Day Boarder').length
  const dayScholar=students.filter(s=>s.hostel_type==='Day Scholar').length

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12,marginBottom:16}}>
      <Card>
        <div style={{padding:'16px'}}>
          <div style={{fontSize:11,fontWeight:600,color:T.text4,marginBottom:14,textTransform:'uppercase',letterSpacing:'.08em'}}>House Census</div>
          {HOUSES_LIST.map(h=>{
            const c=HOUSE_COLORS[h]||T.text3,n=byHouse[h]||0
            return (
              <div key={h} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{width:60,fontSize:10,fontWeight:600,color:c,textAlign:'right',flexShrink:0}}>{h}</span>
                <div style={{flex:1,height:4,background:T.surface2,borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(n/maxHouse)*100}%`,background:c,borderRadius:2}}/>
                </div>
                <span style={{width:18,fontSize:11,fontWeight:700,color:T.text1,textAlign:'right'}}>{n}</span>
              </div>
            )
          })}
        </div>
      </Card>
      <Card>
        <div style={{padding:'16px'}}>
          <div style={{fontSize:11,fontWeight:600,color:T.text4,marginBottom:14,textTransform:'uppercase',letterSpacing:'.08em'}}>Course Distribution</div>
          {Object.entries(byCourse).map(([c,n])=>{
            const cs=COURSE_STRUCTURE[c]
            return (
              <div key={c} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <div style={{width:10,height:10,borderRadius:2,background:cs?.color||T.text3,flexShrink:0}}/>
                <span style={{flex:1,fontSize:13,color:T.text2}}>{c}</span>
                <span style={{fontSize:13,fontWeight:700,color:T.text1}}>{n}</span>
                <div style={{width:60,height:4,background:T.surface2,borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(n/students.length||0)*100}%`,background:cs?.color||T.text3,borderRadius:2}}/>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      <Card>
        <div style={{padding:'16px'}}>
          <div style={{fontSize:11,fontWeight:600,color:T.text4,marginBottom:14,textTransform:'uppercase',letterSpacing:'.08em'}}>Gender & Hostel</div>
          <div style={{display:'flex',height:6,borderRadius:T.r4,overflow:'hidden',marginBottom:10,border:`1px solid ${T.border}`}}>
            <div style={{width:`${(male/total)*100}%`,background:'#3B82F6'}}/>
            <div style={{width:`${(female/total)*100}%`,background:'#EC4899'}}/>
          </div>
          <div style={{display:'flex',gap:16,fontSize:12,marginBottom:16}}>
            <span style={{color:'#3B82F6',fontWeight:700}}>{male} <span style={{color:T.text3,fontWeight:400}}>male</span></span>
            <span style={{color:'#EC4899',fontWeight:700}}>{female} <span style={{color:T.text3,fontWeight:400}}>female</span></span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[['Boarders',boarders,T.green],['Day Board',dayBoard,T.amber],['Day Scholar',dayScholar,T.text3]].map(([l,n,c])=>(
              <div key={l} style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:T.r8,padding:'10px 8px',textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:700,color:c}}>{n}</div>
                <div style={{fontSize:9,color:T.text4,marginTop:2,textTransform:'uppercase',letterSpacing:'.07em',fontWeight:600}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Print Helpers ────────────────────────────────────────────────────────────
function printIDCard(student) {
  const w=window.open('','_blank')
  w.document.write(`<html><head><title>ID Card</title><style>
    body{margin:0;display:flex;justify-content:center;padding:20px;background:#f1f5f9;font-family:system-ui,sans-serif}
    @media print{body{padding:0;background:#fff}}
    .card{width:3.375in;height:2.125in;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.12)}
    .hdr{background:#2563EB;color:#fff;padding:8px 12px;display:flex;align-items:center;gap:8px}
    .logo{font-size:16px;font-weight:800;letter-spacing:-.02em}.sub{font-size:9px;line-height:1.5;opacity:.85}
    .body{display:flex;padding:10px 12px;gap:10px}.photo{width:56px;height:70px;border:1px solid #e2e8f0;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
    .name{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:4px}
    .f{font-size:9px;color:#64748b;margin-bottom:2px}.f span{font-weight:700;color:#0f172a}
    .gcc{font-size:15px;font-weight:800;color:#2563EB;margin-top:6px;letter-spacing:.02em}
  </style></head><body>
  <div class="card">
    <div class="hdr"><div class="logo">GNSI</div><div class="sub">Guidance Navodaya & Sainik Institute<br>Khangabok, Thoubal, Manipur</div></div>
    <div class="body">
      <div class="photo">${student.photo_url?`<img src="${student.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px"/>`:'👤'}</div>
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

function printBatchList(students, label, canViewPII = false) {
  const rows = students.map((s, i) => `
    <tr style="background:${i%2?'#f8fafc':'#fff'}">
      <td>${i+1}</td><td>${s.gcc_no||''}</td><td>${s.name}</td>
      <td>${s.batch||''}</td><td>${s.house||''}</td><td>${s.hostel_type||''}</td>
      <td>${canViewPII ? (s.phone||'') : '🔒'}</td>
    </tr>`).join('')
  const w = window.open('', '_blank')
  w.document.write(`<html><head><title>Student List</title><style>
    body{font-family:system-ui,sans-serif;font-size:11px;padding:20px;color:#334155}
    h2{color:#0f172a;margin-bottom:4px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}
    th{background:#2563EB;color:#fff;font-weight:600}
  </style></head><body>
    <h2>GNSI Student List${label ? ` — ${label}` : ''}</h2>
    <p style="color:#64748b;margin-bottom:12px">Total: ${students.length} · ${new Date().toLocaleDateString('en-IN')}</p>
    <table><thead><tr>
      <th>#</th><th>GCC</th><th>Name</th><th>Batch</th><th>House</th><th>Hostel</th>
      <th>${canViewPII ? 'Phone' : 'Phone'}</th>
    </tr></thead><tbody>${rows}</tbody></table>
  </body></html>`)
  w.document.close()
  w.print()
}

function printFeeReceipt(student, payment) {
  const w=window.open('','_blank')
  w.document.write(`<html><head><title>Receipt</title><style>
    body{font-family:system-ui,sans-serif;padding:30px;max-width:560px;margin:auto;color:#334155}
    .hdr{text-align:center;border-bottom:2px solid #2563EB;padding-bottom:16px;margin-bottom:20px}
    .logo{font-size:22px;font-weight:800;color:#2563EB}.sub{font-size:13px;color:#64748b;margin-top:4px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9}
    .lbl{color:#64748b;font-weight:600}.val{font-weight:700;color:#0f172a}
    .amt{font-size:28px;font-weight:800;color:#059669;text-align:center;margin:20px 0;padding:16px;background:#ecfdf5;border-radius:8px}
    .foot{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#64748b}
  </style></head><body>
    <div class="hdr"><div class="logo">GNSI</div><div class="sub">Guidance Navodaya & Sainik Institute<br>Khangabok, Thoubal, Manipur</div><div style="font-size:10px;color:#94a3b8;margin-top:8px">Receipt · ${fmtD(payment.payment_date)}</div></div>
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

// ─── Report Generator: data + print helpers ──────────────────────────────────
function getReportFieldValue(s, key, feeData, attData, examData) {
  switch (key) {
    case 'age':            return getAge(s.dob) ?? '—'
    case 'dob':            return fmtD(s.dob)
    case 'admission_date': return fmtD(s.admission_date)
    case 'fee_dues':       return feeData[s.id]?.dues || 0
    case 'last_paid':      return feeData[s.id]?.lastPaid || '—'
    case 'attendance':     return attData[s.id] != null ? `${attData[s.id].toFixed(1)}%` : '—'
    case 'latest_score':   return examData[s.id]?.[0]?.total ?? '—'
    case 'avg_score': {
      const exams = examData[s.id]
      if (!exams?.length) return '—'
      return Math.round(exams.reduce((a,e)=>a+(e.total||0),0)/exams.length)
    }
    case 'best_score': {
      const exams = examData[s.id]
      if (!exams?.length) return '—'
      return Math.max(...exams.map(e=>e.total||0))
    }
    case 'exam_count':     return examData[s.id]?.length || 0
    default:                return s[key] ?? '—'
  }
}

function printProfessionalReport(cfg) {
  const { title, subtitle, reportTypeLabel, rows, fields, groupBy, includeSummary, includeSignature, filterSummary, generatedBy, watermark, summaryStats } = cfg

  const groups = groupBy && groupBy !== 'none'
    ? rows.reduce((acc, r) => { const k = r.__group || 'Unassigned'; (acc[k] = acc[k] || []).push(r); return acc }, {})
    : { '': rows }

  const sumCols = ['fee_dues']
  const avgCols = ['latest_score','avg_score','best_score']
  const theadHTML = `<tr>${fields.map(f => `<th>${f.label}</th>`).join('')}</tr>`

  const sectionHTML = Object.entries(groups).map(([gName, gRows]) => {
    const body = gRows.map((r, i) => `
      <tr style="background:${i % 2 ? '#F8FAFC' : '#fff'}">
        ${fields.map(f => `<td>${r[f.key] ?? '—'}</td>`).join('')}
      </tr>`).join('')
    const subtotalCells = fields.map((f, i) => {
      if (sumCols.includes(f.key)) {
        const sum = gRows.reduce((a, r) => a + (Number(r[f.key]) || 0), 0)
        return `<td><strong>${fmt(sum)}</strong></td>`
      }
      if (avgCols.includes(f.key)) {
        const vals = gRows.map(r => Number(r[f.key])).filter(v => !isNaN(v))
        const avg = vals.length ? vals.reduce((a,v)=>a+v,0)/vals.length : null
        return `<td><strong>${avg!=null ? `avg ${avg.toFixed(0)}` : '—'}</strong></td>`
      }
      return i === 0 ? `<td><strong>Subtotal (${gRows.length})</strong></td>` : `<td></td>`
    }).join('')
    return `
      ${gName ? `<tr class="grouphead"><td colspan="${fields.length}">${gName} <span>(${gRows.length})</span></td></tr>` : ''}
      ${body}
      ${gName ? `<tr class="subtotal">${subtotalCells}</tr>` : ''}
    `
  }).join('')

  const w = window.open('', '_blank')
  w.document.write(`<html><head><title>${title}</title><style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,sans-serif;color:#1E293B;padding:0;margin:0;font-size:11px}
    .letterhead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2563EB;padding-bottom:12px;margin-bottom:14px}
    .brand{font-size:20px;font-weight:800;color:#2563EB;letter-spacing:-.02em}
    .brand-sub{font-size:10px;color:#64748B;margin-top:2px;line-height:1.5}
    .meta-box{text-align:right;font-size:10px;color:#64748B}
    .meta-box b{color:#0F172A}
    .report-title{font-size:16px;font-weight:800;color:#0F172A;margin:6px 0 2px}
    .report-sub{font-size:11px;color:#64748B;margin-bottom:4px}
    .filter-line{font-size:9.5px;color:#94A3B8;margin-bottom:14px;font-style:italic}
    .summary{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
    .stat{flex:1;min-width:100px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px}
    .stat .n{font-size:18px;font-weight:800;color:#0F172A}
    .stat .l{font-size:9px;color:#64748B;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-bottom:6px}
    thead{display:table-header-group}
    tr{page-break-inside:avoid}
    th{background:#0F172A;color:#fff;padding:7px 9px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    td{padding:6px 9px;border-bottom:1px solid #E2E8F0;font-size:10.5px}
    tr.grouphead td{background:#EFF6FF;color:#1D4ED8;font-weight:800;font-size:11px;padding:8px 9px;border-top:2px solid #BFDBFE}
    tr.grouphead span{color:#64748B;font-weight:500;font-size:9.5px}
    tr.subtotal td{background:#F1F5F9;font-weight:700;border-bottom:2px solid #CBD5E1}
    .signatures{display:flex;justify-content:space-between;margin-top:36px;font-size:10px;color:#475569}
    .sig-line{border-top:1px solid #94A3B8;padding-top:4px;width:150px;text-align:center}
    .footnote{margin-top:18px;font-size:8.5px;color:#94A3B8;text-align:center;border-top:1px solid #E2E8F0;padding-top:8px}
    .watermark{position:fixed;top:45%;left:10%;font-size:64px;color:rgba(220,38,38,.07);font-weight:800;transform:rotate(-30deg);z-index:-1}
  </style></head><body>
    ${watermark ? `<div class="watermark">CONFIDENTIAL</div>` : ''}
    <div class="letterhead">
      <div>
        <div class="brand">GNSI</div>
        <div class="brand-sub">Guidance Navodaya & Sainik Institute<br>Khangabok, Thoubal, Manipur · Est. 2016</div>
      </div>
      <div class="meta-box">
        <div>Generated: <b>${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</b></div>
        <div>By: <b>${generatedBy || '—'}</b></div>
        <div>Records: <b>${rows.length}</b></div>
      </div>
    </div>
    <div class="report-title">${title}</div>
    ${subtitle ? `<div class="report-sub">${subtitle}</div>` : ''}
    ${filterSummary ? `<div class="filter-line">Filters: ${filterSummary}</div>` : ''}
    ${includeSummary && summaryStats?.length ? `
      <div class="summary">
        ${summaryStats.map(s => `<div class="stat"><div class="n">${s.value}</div><div class="l">${s.label}</div></div>`).join('')}
      </div>` : ''}
    <table><thead>${theadHTML}</thead><tbody>${sectionHTML}</tbody></table>
    ${includeSignature ? `
      <div class="signatures">
        <div class="sig-line">Prepared By</div>
        <div class="sig-line">Checked By</div>
        <div class="sig-line">Principal / Director</div>
      </div>` : ''}
    <div class="footnote">GNSI Portal · ${reportTypeLabel} · Generated automatically — verify figures before official use</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script>
  </body></html>`)
  w.document.close()
}

// ─── Report Generator: UI primitives ─────────────────────────────────────────
function ReportPill({ label, active, onClick, color = T.brand }) {
  return (
    <button onClick={onClick} style={{
      padding:'5px 12px', borderRadius:T.r24, fontSize:12, fontWeight:600,
      border:`1.5px solid ${active?color:T.border}`,
      background:active?`${color}12`:T.surface, color:active?color:T.text2,
      cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
    }}>{label}</button>
  )
}

function MultiPicker({ label, options, selected, onChange, color = T.brand }) {
  const toggle = v => onChange(selected.includes(v) ? selected.filter(x=>x!==v) : [...selected, v])
  return (
    <div style={{marginBottom:12}}>
      <Label>{label}{selected.length>0 && <span style={{color}}> · {selected.length} selected</span>}</Label>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {options.map(o=><ReportPill key={o} label={o} active={selected.includes(o)} onClick={()=>toggle(o)} color={color}/>)}
        {options.length===0 && <span style={{fontSize:12,color:T.text4}}>No options available</span>}
      </div>
    </div>
  )
}

// ─── Report Generator: main modal ────────────────────────────────────────────
function ReportGeneratorModal({ students, feeData, attData, examData, houseOptions, can, role, onClose, showToast }) {
  const isMobile = useIsMobile()
  const [reportType, setReportType] = useState('directory')
  const [rf, setRf] = useState({
    course:[], batch:[], house:[], hostel:[], status:[], gender:[], session:[],
    gccMin:'', gccMax:'', ageMin:'', ageMax:'', admFrom:'', admTo:'',
    duesOnly:false, lowAttendance:false, attBelowPct:'50',
  })
  const [columns, setColumns]   = useState(REPORT_TYPES[0].cols)
  const [groupBy, setGroupBy]   = useState('none')
  const [sortBy, setSortBy]     = useState('name')
  const [reportTitle, setReportTitle] = useState('Student Directory Report')
  const [includeSummary, setIncludeSummary]     = useState(true)
  const [includeSignature, setIncludeSignature] = useState(true)
  const [presets, setPresets]   = useState(() => { try { return JSON.parse(localStorage.getItem(REPORT_PRESETS_KEY)||'[]') } catch { return [] } })
  const [presetName, setPresetName] = useState('')

  const allBatches = Array.from(new Set(students.map(s=>s.batch).filter(Boolean))).sort()
  const availableFields = REPORT_FIELDS.filter(f => can.viewPII || !f.pii)
  const fieldGroups = Array.from(new Set(availableFields.map(f=>f.group)))

  const applyReportType = key => {
    const rt = REPORT_TYPES.find(r=>r.key===key)
    setReportType(key)
    setColumns(rt.cols.filter(c => availableFields.some(f=>f.key===c)))
    setGroupBy(rt.groupBy)
    setReportTitle(rt.label + ' — ' + new Date().toLocaleDateString('en-IN', {month:'long', year:'numeric'}))
    setRf(prev => ({ ...prev, duesOnly: rt.duesOnly }))
  }

  const setField = (k,v) => setRf(prev => ({ ...prev, [k]: v }))

  const matched = useMemo(() => students.filter(s => {
    if (rf.course.length  && !rf.course.includes(s.course))      return false
    if (rf.batch.length   && !rf.batch.includes(s.batch))        return false
    if (rf.house.length   && !rf.house.includes(s.house))        return false
    if (rf.hostel.length  && !rf.hostel.includes(s.hostel_type)) return false
    if (rf.status.length  && !rf.status.includes(s.status))      return false
    if (rf.gender.length  && !rf.gender.includes(s.gender))       return false
    if (rf.session.length && !rf.session.includes(s.session))     return false
    if (rf.gccMin && Number(s.gcc_no) < Number(rf.gccMin)) return false
    if (rf.gccMax && Number(s.gcc_no) > Number(rf.gccMax)) return false
    if (rf.ageMin) { const a=getAge(s.dob); if (a==null||a<Number(rf.ageMin)) return false }
    if (rf.ageMax) { const a=getAge(s.dob); if (a==null||a>Number(rf.ageMax)) return false }
    if (rf.admFrom && (!s.admission_date || s.admission_date < rf.admFrom)) return false
    if (rf.admTo   && (!s.admission_date || s.admission_date > rf.admTo))   return false
    if (rf.duesOnly && !(feeData[s.id]?.dues > 0)) return false
    if (rf.lowAttendance) { const a=attData[s.id]; if (a==null || a >= Number(rf.attBelowPct||50)) return false }
    return true
  }), [students, rf, feeData, attData])

  const sorted = useMemo(() => {
    const arr = [...matched]
    arr.sort((a,b) => {
      if (sortBy==='gcc_no')     return Number(a.gcc_no||0)-Number(b.gcc_no||0)
      if (sortBy==='fee_dues')   return (feeData[b.id]?.dues||0)-(feeData[a.id]?.dues||0)
      if (sortBy==='attendance') return (attData[a.id]??999)-(attData[b.id]??999)
      if (sortBy==='batch')      return (a.batch||'').localeCompare(b.batch||'')
      return (a.name||'').localeCompare(b.name||'')
    })
    return arr
  }, [matched, sortBy, feeData, attData])

  const hasAdvancedFilters = rf.course.length||rf.batch.length||rf.house.length||rf.hostel.length||rf.status.length||rf.gender.length||rf.session.length||rf.gccMin||rf.gccMax||rf.ageMin||rf.ageMax||rf.admFrom||rf.admTo||rf.duesOnly||rf.lowAttendance

  const clearFilters = () => setRf({course:[],batch:[],house:[],hostel:[],status:[],gender:[],session:[],gccMin:'',gccMax:'',ageMin:'',ageMax:'',admFrom:'',admTo:'',duesOnly:false,lowAttendance:false,attBelowPct:'50'})

  const toggleColumn = key => setColumns(prev => prev.includes(key) ? prev.filter(c=>c!==key) : [...prev, key])

  const buildRows = () => sorted.map(s => {
    const row = { id:s.id }
    columns.forEach(c => { row[c] = getReportFieldValue(s, c, feeData, attData, examData) })
    if (groupBy !== 'none') row.__group = getReportFieldValue(s, groupBy==='hostel'?'hostel_type':groupBy, feeData, attData, examData) || 'Unassigned'
    return row
  })

  const filterSummaryText = () => {
    const parts = []
    if (rf.course.length)  parts.push(`Course: ${rf.course.join(', ')}`)
    if (rf.batch.length)   parts.push(`Batch: ${rf.batch.join(', ')}`)
    if (rf.house.length)   parts.push(`House: ${rf.house.join(', ')}`)
    if (rf.hostel.length)  parts.push(`Hostel: ${rf.hostel.join(', ')}`)
    if (rf.status.length)  parts.push(`Status: ${rf.status.join(', ')}`)
    if (rf.gender.length)  parts.push(`Gender: ${rf.gender.join(', ')}`)
    if (rf.session.length) parts.push(`Session: ${rf.session.join(', ')}`)
    if (rf.gccMin||rf.gccMax) parts.push(`GCC ${rf.gccMin||'…'}–${rf.gccMax||'…'}`)
    if (rf.ageMin||rf.ageMax) parts.push(`Age ${rf.ageMin||'…'}–${rf.ageMax||'…'}`)
    if (rf.admFrom||rf.admTo) parts.push(`Admitted ${rf.admFrom||'…'} to ${rf.admTo||'…'}`)
    if (rf.duesOnly)       parts.push('Fee dues only')
    if (rf.lowAttendance)  parts.push(`Attendance below ${rf.attBelowPct}%`)
    return parts.length ? parts.join(' · ') : 'No filters applied — all students included'
  }

  const buildSummaryStats = () => {
    const stats = [{ label:'Total Records', value: sorted.length }]
    if (reportType==='fees') {
      const totalDues = sorted.reduce((a,s)=>a+(feeData[s.id]?.dues||0),0)
      stats.push({ label:'Total Outstanding', value:`₹${fmt(totalDues)}` })
      stats.push({ label:'With Dues', value: sorted.filter(s=>feeData[s.id]?.dues>0).length })
    } else if (reportType==='attendance') {
      const withAtt = sorted.filter(s=>attData[s.id]!=null)
      const avg = withAtt.length ? withAtt.reduce((a,s)=>a+attData[s.id],0)/withAtt.length : 0
      stats.push({ label:'Average Attendance', value:`${avg.toFixed(1)}%` })
      stats.push({ label:'Below 75%', value: withAtt.filter(s=>attData[s.id]<75).length })
    } else if (reportType==='academic') {
      const withScore = sorted.filter(s=>examData[s.id]?.[0]?.total!=null)
      const avg = withScore.length ? withScore.reduce((a,s)=>a+(examData[s.id][0].total||0),0)/withScore.length : 0
      stats.push({ label:'Average Score', value: avg.toFixed(0) })
      const withExams = sorted.filter(s=>examData[s.id]?.length>0)
      const highest = withExams.length ? Math.max(...withExams.map(s=>Math.max(...examData[s.id].map(e=>e.total||0)))) : 0
      stats.push({ label:'Highest Score', value: highest })
    } else {
      stats.push({ label:'Active', value: sorted.filter(s=>s.status==='Active').length })
      stats.push({ label:'Boarders', value: sorted.filter(s=>s.hostel_type==='Boarder').length })
    }
    return stats
  }

  const handleGeneratePDF = () => {
    if (!sorted.length) { showToast('No students match these filters', T.red); return }
    const rt = REPORT_TYPES.find(r=>r.key===reportType)
    const fields = columns.map(c => REPORT_FIELDS.find(f=>f.key===c)).filter(Boolean)
    if (!fields.length) { showToast('Select at least one column', T.red); return }
    printProfessionalReport({
      title: reportTitle || rt.label,
      subtitle: rt.desc,
      reportTypeLabel: rt.label,
      rows: buildRows(),
      fields,
      groupBy,
      includeSummary, includeSignature,
      filterSummary: filterSummaryText(),
      generatedBy: role ? role.charAt(0).toUpperCase()+role.slice(1) : 'Staff',
      watermark: fields.some(f=>f.pii),
      summaryStats: buildSummaryStats(),
    })
    showToast('Report opened — use Print → Save as PDF', T.brand)
  }

  const handleExportCSV = () => {
    if (!sorted.length) { showToast('No students match these filters', T.red); return }
    const fields = columns.map(c => REPORT_FIELDS.find(f=>f.key===c)).filter(Boolean)
    const rows = buildRows().map(r => {
      const out = {}
      fields.forEach(f => { out[f.label] = r[f.key] })
      return out
    })
    downloadCSV(rows, `${(reportTitle||'report').replace(/\s+/g,'_').toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`)
    showToast('CSV exported', T.green)
  }

  const savePresetFn = () => {
    if (!presetName.trim()) return
    const next = [...presets.filter(p=>p.name!==presetName.trim()), { name:presetName.trim(), reportType, rf, columns, groupBy, sortBy }].slice(-MAX_REPORT_PRESETS)
    setPresets(next); localStorage.setItem(REPORT_PRESETS_KEY, JSON.stringify(next))
    setPresetName(''); showToast('Report preset saved', T.brand)
  }
  const loadPresetFn = p => {
    setReportType(p.reportType); setRf(p.rf); setColumns(p.columns); setGroupBy(p.groupBy); setSortBy(p.sortBy||'name')
    showToast(`Loaded preset "${p.name}"`, T.brand)
  }
  const removePresetFn = name => {
    const next = presets.filter(p=>p.name!==name); setPresets(next); localStorage.setItem(REPORT_PRESETS_KEY, JSON.stringify(next))
  }

  return (
    <Modal onClose={onClose} width={820} title="Report Generator" subtitle="Build a filtered, professional report — print to PDF or export to CSV">
      <Label>Report Type</Label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:8,marginBottom:18}}>
        {REPORT_TYPES.map(rt => (
          <div key={rt.key} onClick={()=>applyReportType(rt.key)} style={{
            padding:'12px 14px', borderRadius:T.r10, cursor:'pointer',
            border:`1.5px solid ${reportType===rt.key?T.brand:T.border}`,
            background:reportType===rt.key?T.brandLight:T.surface,
          }}>
            <div style={{fontSize:13,fontWeight:700,color:reportType===rt.key?T.brandText:T.text1,marginBottom:2}}>{rt.icon} {rt.label}</div>
            <div style={{fontSize:11,color:T.text3,lineHeight:1.4}}>{rt.desc}</div>
          </div>
        ))}
      </div>

      <Divider label="Advanced Filters"/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
        <span style={{fontSize:12,color:T.text3}}><strong style={{color:T.text1}}>{sorted.length}</strong> of {students.length} students match</span>
        {hasAdvancedFilters && <Btn onClick={clearFilters} size='sm' style={{color:T.red,borderColor:T.redBorder}}><SIcon.x size={12}/> Clear Filters</Btn>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:16,marginBottom:6}}>
        <MultiPicker label="Course"      options={COURSES.filter(c=>c!=='All')}       selected={rf.course}  onChange={v=>setField('course',v)}/>
        <MultiPicker label="Batch"       options={allBatches}                          selected={rf.batch}   onChange={v=>setField('batch',v)}/>
        <MultiPicker label="House"       options={houseOptions}                        selected={rf.house}   onChange={v=>setField('house',v)}  color={T.violet}/>
        <MultiPicker label="Hostel Type" options={HOSTEL_TYPES.filter(h=>h!=='All')}   selected={rf.hostel}  onChange={v=>setField('hostel',v)} color={T.amber}/>
        <MultiPicker label="Status"      options={STATUSES.filter(s=>s!=='All')}       selected={rf.status}  onChange={v=>setField('status',v)} color={T.green}/>
        <MultiPicker label="Gender"      options={GENDERS.filter(g=>g!=='All')}        selected={rf.gender}  onChange={v=>setField('gender',v)} color={T.sky}/>
        <MultiPicker label="Session"     options={SESSIONS}                            selected={rf.session} onChange={v=>setField('session',v)} color={T.teal}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:14}}>
        <FieldRow label="GCC No. Min"><Input value={rf.gccMin} onChange={e=>setField('gccMin',e.target.value)} type="number" placeholder="e.g. 100"/></FieldRow>
        <FieldRow label="GCC No. Max"><Input value={rf.gccMax} onChange={e=>setField('gccMax',e.target.value)} type="number" placeholder="e.g. 900"/></FieldRow>
        <FieldRow label="Age Min"><Input value={rf.ageMin} onChange={e=>setField('ageMin',e.target.value)} type="number" placeholder="e.g. 10"/></FieldRow>
        <FieldRow label="Age Max"><Input value={rf.ageMax} onChange={e=>setField('ageMax',e.target.value)} type="number" placeholder="e.g. 16"/></FieldRow>
        <FieldRow label="Admitted From"><Input value={rf.admFrom} onChange={e=>setField('admFrom',e.target.value)} type="date"/></FieldRow>
        <FieldRow label="Admitted To"><Input value={rf.admTo} onChange={e=>setField('admTo',e.target.value)} type="date"/></FieldRow>
      </div>

      <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:18,alignItems:'center'}}>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:T.text2,cursor:'pointer'}}>
          <input type="checkbox" checked={rf.duesOnly} onChange={e=>setField('duesOnly',e.target.checked)} style={{accentColor:T.red,width:16,height:16}}/>
          Fee dues only
        </label>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:T.text2,cursor:'pointer'}}>
          <input type="checkbox" checked={rf.lowAttendance} onChange={e=>setField('lowAttendance',e.target.checked)} style={{accentColor:T.amber,width:16,height:16}}/>
          Attendance below
          <input value={rf.attBelowPct} onChange={e=>setField('attBelowPct',e.target.value)} type="number" style={{width:50,padding:'4px 6px',borderRadius:T.r6,border:`1px solid ${T.border2}`,fontSize:12,fontFamily:'inherit'}}/>%
        </label>
      </div>

      <Divider label="Columns & Layout"/>
      {fieldGroups.map(grp => (
        <div key={grp} style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text4,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>{grp}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {availableFields.filter(f=>f.group===grp).map(f => (
              <ReportPill key={f.key} label={f.label} active={columns.includes(f.key)} onClick={()=>toggleColumn(f.key)}/>
            ))}
          </div>
        </div>
      ))}

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12,marginTop:14,marginBottom:14}}>
        <FieldRow label="Group Rows By">
          <Select value={groupBy} onChange={e=>setGroupBy(e.target.value)} style={{width:'100%'}}>
            <option value="none">No Grouping</option>
            <option value="course">Course</option>
            <option value="batch">Batch</option>
            <option value="house">House</option>
            <option value="status">Status</option>
            <option value="hostel">Hostel Type</option>
          </Select>
        </FieldRow>
        <FieldRow label="Sort By">
          <Select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{width:'100%'}}>
            <option value="name">Name (A–Z)</option>
            <option value="gcc_no">GCC No.</option>
            <option value="batch">Batch</option>
            <option value="fee_dues">Fee Dues (High–Low)</option>
            <option value="attendance">Attendance (Low–High)</option>
          </Select>
        </FieldRow>
      </div>

      <FieldRow label="Report Title"><Input value={reportTitle} onChange={e=>setReportTitle(e.target.value)} placeholder="Report title shown on the printout"/></FieldRow>

      <div style={{display:'flex',gap:16,flexWrap:'wrap',margin:'14px 0 4px'}}>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:T.text2,cursor:'pointer'}}>
          <input type="checkbox" checked={includeSummary} onChange={e=>setIncludeSummary(e.target.checked)} style={{accentColor:T.brand,width:16,height:16}}/>
          Include summary statistics
        </label>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:T.text2,cursor:'pointer'}}>
          <input type="checkbox" checked={includeSignature} onChange={e=>setIncludeSignature(e.target.checked)} style={{accentColor:T.brand,width:16,height:16}}/>
          Include signature block
        </label>
      </div>

      <Divider label="Saved Filter Presets"/>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
        {presets.length===0 && <span style={{fontSize:12,color:T.text4}}>No saved presets yet</span>}
        {presets.map(p => (
          <div key={p.name} style={{display:'flex',alignItems:'center',gap:4,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:T.r24,padding:'3px 4px 3px 12px'}}>
            <button onClick={()=>loadPresetFn(p)} style={{background:'none',border:'none',fontSize:12,fontWeight:600,color:T.text2,cursor:'pointer',fontFamily:'inherit'}}>{p.name}</button>
            <button onClick={()=>removePresetFn(p.name)} style={{background:'none',border:'none',cursor:'pointer',color:T.red,fontSize:14,padding:'0 6px',lineHeight:1}}>×</button>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <Input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Save current setup as…" style={{flex:1}}/>
        <Btn onClick={savePresetFn} size='sm'>⭐ Save Preset</Btn>
      </div>

      <div style={{display:'flex',gap:10,position:'sticky',bottom:0,background:T.surface,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={handleExportCSV} style={{flex:1,justifyContent:'center'}}>⬇ Export CSV</Btn>
        <Btn onClick={handleGeneratePDF} variant='primary' style={{flex:2,justifyContent:'center'}}>🖨 Generate Professional Report ({sorted.length})</Btn>
      </div>
    </Modal>
  )
}

// ─── Student Detail Drawer ────────────────────────────────────────────────────
function StudentDetailDrawer({ student, allStudents, attData, examData, feeData, feeHistory, can, onClose, onEdit, showToast }) {
  const [tab,setTab]=useState('profile')
  const [notes,setNotes]=useState(student.notes||'')
  const [saving,setSaving]=useState(false)
  const isMobile=useIsMobile()
  const now=useMemo(()=>new Date(),[])

  const siblings=allStudents.filter(s=>s.id!==student.id&&s.status==='Active'&&((s.father_name&&s.father_name===student.father_name)||(s.mother_name&&s.mother_name===student.mother_name)))
  const att=attData[student.id]??null
  const exams=examData[student.id]||[]
  const dues=feeData[student.id]?.dues||0
  const history=feeHistory[student.id]||[]

  const examTotals=exams.slice(-5).map(e=>e.total||0)
  const sparkMax=Math.max(...examTotals,1)
  const batchStudents=allStudents.filter(s=>s.batch===student.batch&&s.status==='Active')
  const batchRanks=batchStudents.map(s=>({id:s.id,avg:(examData[s.id]||[]).reduce((a,e)=>a+(e.total||0),0)/Math.max((examData[s.id]||[]).length,1)})).sort((a,b)=>b.avg-a.avg)
  const rank=batchRanks.findIndex(x=>x.id===student.id)+1
  const effectiveDue=getEffectiveMonthlyDue(student)

  const monthlySummary=useMemo(()=>{
    const months={}
    history.forEach(h=>{const m=fmtM(h.payment_date);if(!months[m])months[m]={paid:0,due:effectiveDue};months[m].paid+=Number(h.amount||0)})
    return Object.entries(months).map(([month,data])=>({month,...data,balance:data.due-data.paid})).sort((a,b)=>new Date(b.month)-new Date(a.month))
  },[history,effectiveDue])
  const totalArrears=monthlySummary.reduce((a,m)=>a+Math.max(0,m.balance),0)

  const saveNotes=async()=>{setSaving(true);await supabase.from('students').update({notes}).eq('id',student.id);await auditLog('student_notes_edit',{student_id:student.id});setSaving(false);showToast('Notes saved',T.green)}

  const handlePhotoUpload=async e=>{
    const file=e.target.files[0];if(!file)return
    const err=validateFile(file,{mimes:ALLOWED_IMAGE_MIMES,exts:ALLOWED_IMAGE_EXTS,maxMB:MAX_IMG_SIZE_MB})
    if(err){showToast(err,T.red);return}
    const ext=file.name.split('.').pop().toLowerCase()
    const path=`student_photos/${student.id}_${randomSuffix()}.${ext}`
    const{error:upErr}=await supabase.storage.from('gnsi').upload(path,file,{upsert:false,contentType:file.type})
    if(upErr){showToast('Upload failed',T.red);return}
    const{error:dbErr}=await supabase.from('students').update({photo_path:path,photo_url:null}).eq('id',student.id)
    if(dbErr){await supabase.storage.from('gnsi').remove([path]);showToast('Save failed',T.red);return}
    await auditLog('photo_upload',{student_id:student.id});showToast('Photo updated',T.green)
  }

  const TABS=[{key:'profile',label:'Profile'},{key:'academic',label:'Academic'},{key:'attend',label:'Attendance'},{key:'fee',label:'Fees'},{key:'docs',label:'Documents'},{key:'notes',label:'Notes'}]

  const STAT_ITEMS=[
    {label:'Status',value:<StatusPill status={student.status}/>},
    {label:'Hostel',value:student.hostel_type||'—'},
    {label:'Att %',value:att!=null?<span style={{color:att>=75?T.green:T.red,fontWeight:700}}>{att.toFixed(0)}%</span>:'—'},
    {label:'Batch Rank',value:rank?`#${rank}`:'—'},
    {label:'Fee',value:dues>0?<span style={{color:T.red,fontWeight:700}}>₹{fmt(dues)}</span>:<span style={{color:T.green,fontWeight:600}}>Clear ✓</span>},
  ]

  return (
    <div style={{position:'fixed',inset:0,zIndex:99998,display:'flex',justifyContent:isMobile?'stretch':'flex-end'}} onClick={onClose}>
      <div style={{
        width:isMobile?'100%':540, background:T.surface,
        borderLeft:isMobile?'none':`1px solid ${T.border}`,
        boxShadow:'-8px 0 32px rgba(15,23,42,.12)',
        display:'flex',flexDirection:'column',
        animation:isMobile?'slideUp .25s ease':'slideLeft .25s cubic-bezier(.34,1.2,.64,1)',
      }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'16px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:14}}>
            <div style={{position:'relative',flexShrink:0}}>
              <Avatar name={student.name} photoUrl={student.photo_url} size={48}/>
              <IfCan can={can.write}>
                <label style={{position:'absolute',bottom:-2,right:-2,width:20,height:20,borderRadius:'50%',background:T.brand,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:10,border:`2px solid ${T.surface}`,color:'#fff'}}>
                  📷<input type="file" accept={ALLOWED_IMAGE_EXTS.join(',')} style={{display:'none'}} onChange={handlePhotoUpload}/>
                </label>
              </IfCan>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:17,fontWeight:700,color:T.text1,letterSpacing:'-.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{student.name}</div>
              <div style={{fontSize:12,color:T.text3,marginTop:2}}>GCC-{student.gcc_no} · {student.batch} · {student.session}</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
                {student.course&&<CoursePill course={student.course}/>}
                {student.house&&<HousePill house={student.house}/>}
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <IfCan can={can.write}>
                <Btn onClick={()=>onEdit(student)} size='sm'>✏ Edit</Btn>
              </IfCan>
              <button onClick={onClose} style={{width:32,height:32,borderRadius:T.r8,border:`1px solid ${T.border}`,background:T.surface2,cursor:'pointer',color:T.text3,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><SIcon.x size={14}/></button>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{display:'grid',gridTemplateColumns:`repeat(${STAT_ITEMS.length},1fr)`,gap:6,overflowX:'auto'}}>
            {STAT_ITEMS.map(p=>(
              <div key={p.label} style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:T.r8,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,color:T.text4,marginBottom:3,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em'}}>{p.label}</div>
                <div style={{fontSize:12,fontWeight:600,color:T.text1}}>{p.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:`1px solid ${T.border}`,background:T.surface,flexShrink:0,overflowX:'auto'}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{
              flex:1,minWidth:64,padding:'10px 8px',border:'none',background:'none',
              fontSize:11,fontWeight:600,cursor:'pointer',transition:'all .12s',
              color:tab===t.key?T.brand:T.text3,
              borderBottom:`2px solid ${tab===t.key?T.brand:'transparent'}`,
              textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap',fontFamily:'inherit',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
          {tab==='profile'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
                {[
  ['Gender',    student.gender],
  ['DOB',       fmtD(student.dob)],
  ...(can.viewPII ? [
    ['Phone',     student.phone],
    ['Father',    student.father_name],
    ['Mother',    student.mother_name],
    ['Emergency', student.emergency_contact],
    ['Address',   student.address],
  ] : []),
  ['Prev School', student.prev_school],
  ['Referral',    student.referral_source],
  ['Admitted',    fmtD(student.admission_date)],
].filter(([, v]) => v).map(([label, value]) => (
  <div key={label} style={{background:T.surface2,borderRadius:T.r8,padding:'10px 12px',border:`1px solid ${T.border}`}}>
    <div style={{fontSize:9,fontWeight:600,color:T.text4,textTransform:'uppercase',letterSpacing:'.08em'}}>{label}</div>
    <div style={{fontSize:12,fontWeight:600,color:T.text1,marginTop:3}}>{value}</div>
  </div>
))}
              </div>
              {student.medical_notes&&(
                <div style={{background:T.orangeLight,border:`1px solid ${T.orangeBorder}`,borderRadius:T.r10,padding:'12px 14px'}}>
                  <div style={{fontWeight:700,fontSize:10,color:T.orange,marginBottom:4,textTransform:'uppercase',letterSpacing:'.07em'}}>⚕ Medical Notes</div>
                  <div style={{fontSize:13,color:T.text2}}>{student.medical_notes}</div>
                </div>
              )}
              {siblings.length>0&&(
                <div>
                  <div style={{fontWeight:600,fontSize:11,color:T.text3,marginBottom:8,textTransform:'uppercase',letterSpacing:'.07em'}}>Siblings ({siblings.length})</div>
                  {siblings.map(sib=>(
                    <div key={sib.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${T.border}`}}>
                      <Avatar name={sib.name} size={28}/>
                      <div><div style={{fontWeight:600,fontSize:13,color:T.text1}}>{sib.name}</div><div style={{fontSize:11,color:T.text3}}>GCC-{sib.gcc_no} · {sib.batch}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab==='academic'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10}}>
                <div style={{background:T.brandLight,border:`1px solid ${T.brandBorder}`,borderRadius:T.r10,padding:'14px',textAlign:'center'}}>
                  <div style={{fontSize:30,fontWeight:700,color:T.brand}}>{rank?`#${rank}`:'—'}</div>
                  <div style={{fontSize:10,color:T.brandText,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginTop:4}}>Batch Rank</div>
                </div>
                {examTotals.length>0&&(
                  <div style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:T.r10,padding:'14px'}}>
                    <div style={{fontSize:10,fontWeight:600,color:T.text4,marginBottom:8,textTransform:'uppercase',letterSpacing:'.07em'}}>Score Trend</div>
                    <div style={{display:'flex',alignItems:'flex-end',gap:3,height:36}}>
                      {examTotals.map((v,i)=><div key={i} style={{flex:1,background:T.brand,borderRadius:3,height:`${(v/sparkMax)*100}%`,minHeight:3,opacity:.5+.5*(i/examTotals.length)}}/>)}
                    </div>
                    <div style={{fontSize:10,color:T.text4,marginTop:5}}>Latest: <span style={{color:T.text1,fontWeight:600}}>{examTotals[examTotals.length-1]}</span></div>
                  </div>
                )}
              </div>
              {exams.length>0?(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:400}}>
                    <thead>
                      <tr style={{background:T.surface2}}>
                        <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:T.text3,borderBottom:`1px solid ${T.border}`,fontSize:10,textTransform:'uppercase'}}>Exam</th>
                        {SUBJECTS.map(s=><th key={s} style={{padding:'7px 5px',fontWeight:600,color:T.text3,borderBottom:`1px solid ${T.border}`,fontSize:9,textTransform:'uppercase'}}>{s.slice(0,3)}</th>)}
                        <th style={{padding:'8px 10px',fontWeight:600,color:T.text3,borderBottom:`1px solid ${T.border}`,fontSize:10,textTransform:'uppercase'}}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.map((e,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                          <td style={{padding:'7px 10px',fontWeight:600,color:T.text2,fontSize:12}}>{e.exam_name||`Exam ${i+1}`}</td>
                          {SUBJECTS.map(s=>{const score=e[s],weak=score!=null&&score<40;return<td key={s} style={{padding:'6px 5px',textAlign:'center',color:weak?T.red:T.text2,fontWeight:weak?700:400}}>{score??'—'}</td>})}
                          <td style={{padding:'7px 10px',fontWeight:700,color:(e.total||0)>=200?T.green:T.red}}>{e.total??'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ):<div style={{textAlign:'center',padding:'40px',color:T.text4,fontSize:13}}>No exam records.</div>}
            </div>
          )}

          {tab==='attend'&&<AttendanceTab student={student} can={can} showToast={showToast}/>}

          {tab==='fee'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {(Number(student.fee_waiver)||Number(student.scholarship))?(
                <div style={{background:T.amberLight,border:`1px solid ${T.amberBorder}`,borderRadius:T.r8,padding:'10px 14px',fontSize:12,color:T.amber,fontWeight:600}}>
                  Effective due: ₹{fmt(effectiveDue)}/mo (base ₹{fmt(getFlatFeeAmtSync(student.hostel_type, student.course))} − waiver ₹{fmt(student.fee_waiver||0)} − scholarship ₹{fmt(student.scholarship||0)})
                </div>
              ):null}
              {totalArrears>0&&<div style={{background:T.redLight,border:`1px solid ${T.redBorder}`,borderRadius:T.r8,padding:'10px 14px',fontWeight:700,color:T.red,fontSize:12}}>⚠ Total Arrears: ₹{fmt(totalArrears)}</div>}
              {monthlySummary.length>0?(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:280}}>
                    <thead><tr style={{background:T.surface2}}>{['Month','Due','Paid','Balance',''].map(h=><th key={h} style={{padding:'8px 10px',textAlign:h==='Month'?'left':'right',fontWeight:600,color:T.text3,borderBottom:`1px solid ${T.border}`,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {monthlySummary.map((m,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                          <td style={{padding:'7px 10px',fontWeight:600,color:T.text2}}>{m.month}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',color:T.text3}}>₹{fmt(m.due)}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',color:T.green,fontWeight:700}}>₹{fmt(m.paid)}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',color:m.balance>0?T.red:T.text3,fontWeight:m.balance>0?700:400}}>₹{fmt(m.balance)}</td>
                          <td style={{padding:'7px 10px',textAlign:'right'}}>
                            <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:T.r4,background:m.balance<=0?T.greenLight:T.redLight,color:m.balance<=0?T.green:T.red,border:`1px solid ${m.balance<=0?T.greenBorder:T.redBorder}`}}>{m.balance<=0?'CLEAR':'DUE'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ):<div style={{textAlign:'center',padding:'24px',color:T.text4,fontSize:13}}>No payment history.</div>}
              {history.slice(0,5).map((h,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'12px',background:T.surface2,borderRadius:T.r8,border:`1px solid ${T.border}`}}>
                  <span style={{fontSize:16}}>💵</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:T.text1}}>₹{fmt(h.amount)}</div>
                    <div style={{fontSize:11,color:T.text3,marginTop:1}}>{fmtD(h.payment_date)} · {h.payment_method||'Cash'}{h.month_for&&` · ${h.month_for}`}</div>
                  </div>
                  <Btn onClick={()=>printFeeReceipt(student,h)} size='sm'>🖨 Receipt</Btn>
                </div>
              ))}
            </div>
          )}

          {tab==='docs'&&<DocumentsTab student={student} can={can} showToast={showToast}/>}

          {tab==='notes'&&(
            <div>
              <div style={{fontSize:11,fontWeight:600,color:T.text3,marginBottom:8,textTransform:'uppercase',letterSpacing:'.07em'}}>Notes / Activity Log</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enter notes…" rows={8} style={{width:'100%',padding:'10px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:14,background:T.surface,color:T.text1,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}}/>
              <Btn onClick={saveNotes} disabled={saving} variant='primary' size='md' style={{marginTop:10}}>{saving?'Saving…':'Save Notes'}</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Student Form ─────────────────────────────────────────────────────────────
function StudentForm({ onSave, onCancel, editing, allStudents }) {
  const blank={name:'',gcc_no:'',dob:'',gender:'Male',course:'',batch:'',house:'',session:'',hostel_type:'Day Scholar',status:'Active',father_name:'',mother_name:'',phone:'',address:'',remarks:'',fee_waiver:0,scholarship:0,fee_waiver_note:'',emergency_contact:'',prev_school:'',referral_source:'',admission_date:new Date().toISOString().slice(0,10),left_date:'',medical_notes:'',academic_remarks:''}
  const loadDraft=()=>{if(editing)return null;try{const r=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(!r)return null;DRAFT_PII_FIELDS.forEach(k=>delete r[k]);return r}catch{return null}}
  const savedDraft=loadDraft()
  const [form,setForm]=useState(savedDraft||(editing?Object.fromEntries(Object.entries({...blank,...editing}).map(([k,v])=>[k,v??''])):blank))
  const [errors,setErrors]=useState({})
  const [saving,setSaving]=useState(false)
  const [draftSaved,setDraftSaved]=useState(false)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))

  useEffect(()=>{if(editing)return;const t=setTimeout(()=>{localStorage.setItem(DRAFT_KEY,JSON.stringify(sanitiseDraftForStorage(form)));setDraftSaved(true);setTimeout(()=>setDraftSaved(false),1500)},1000);return()=>clearTimeout(t)},[form,editing])
  useEffect(()=>{if(!form.house)return;if(DAY_SCHOLAR_HOUSES.includes(form.house))set('hostel_type','Day Scholar');else if(form.hostel_type==='Day Scholar')set('hostel_type','Boarder')},[form.house])

  const derived=deriveHostelType(form.house,form.hostel_type)
  const subtypes=COURSE_STRUCTURE[form.course]?.subtypes??[]
  const gccDup=form.gcc_no?allStudents.find(s=>s.gcc_no?.toString()===form.gcc_no?.toString()&&s.id!==editing?.id):null
  const phoneDup=form.phone?.trim()?allStudents.find(s=>s.phone?.trim()===form.phone?.trim()&&s.id!==editing?.id):null
  const effectiveDue=Math.max(0,getFlatFeeAmtSync(derived, form.course)-Number(form.fee_waiver||0)-Number(form.scholarship||0))
  const hostelCfg=HOSTEL_CFG[derived]||HOSTEL_CFG['Day Scholar']

  const validate=()=>{const e={};if(!form.name?.trim())e.name='Name is required';if(!form.gcc_no?.toString().trim())e.gcc_no='GCC No. required';if(gccDup)e.gcc_no=`GCC ${form.gcc_no} used by ${gccDup.name}`;if(phoneDup)e.phone=`Phone used by ${phoneDup.name}`;setErrors(e);return!Object.keys(e).length}
  const handleSave=async()=>{if(!validate())return;setSaving(true);await onSave(editing?.id||null,{...form,hostel_type:derived});setSaving(false);if(!editing)localStorage.removeItem(DRAFT_KEY)}

  const INP={width:'100%',padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:14,background:T.surface,color:T.text1,height:36,fontFamily:'inherit',boxSizing:'border-box',outline:'none'}
  const INP_ERR={...INP,borderColor:T.red}
  const SEL={...INP,cursor:'pointer',height:36}

  return (
    <Card style={{marginBottom:20}}>
      {/* Form header */}
      <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:T.text1}}>{editing?'Edit Student':'New Student'}</div>
          <div style={{fontSize:12,color:T.text3,marginTop:2,display:'flex',gap:12,flexWrap:'wrap'}}>
            {!editing&&draftSaved&&<span style={{color:T.green,fontWeight:600}}>✓ Draft saved</span>}
            {!editing&&savedDraft&&!draftSaved&&<span style={{color:T.amber,fontWeight:600}}>Draft restored — PII fields must be re-entered</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {!editing&&<Btn onClick={()=>{localStorage.removeItem(DRAFT_KEY);setForm(blank)}} size='sm'>Clear</Btn>}
          <button onClick={onCancel} style={{width:32,height:32,borderRadius:T.r8,border:`1px solid ${T.border}`,background:T.surface2,cursor:'pointer',color:T.text3,display:'flex',alignItems:'center',justifyContent:'center'}}><SIcon.x size={14}/></button>
        </div>
      </div>

      <div style={{padding:'20px'}}>
        <FieldRow label="Full Name *" error={errors.name}>
          <input style={errors.name?INP_ERR:INP} value={form.name} onChange={e=>{set('name',e.target.value);setErrors(v=>({...v,name:''}))}} placeholder="Full name as per certificate"/>
        </FieldRow>

        <Divider label="Identification"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:4}}>
          <FieldRow label="GCC No. *" error={errors.gcc_no}>
            <input style={errors.gcc_no?INP_ERR:INP} type="number" value={form.gcc_no} onChange={e=>{set('gcc_no',e.target.value);setErrors(v=>({...v,gcc_no:''}))}}/>
            {gccDup&&!errors.gcc_no&&<div style={{fontSize:11,color:T.amber,marginTop:3,fontWeight:600}}>⚠ Used by {gccDup.name}</div>}
          </FieldRow>
          <FieldRow label="Date of Birth"><input type="date" style={INP} value={form.dob} onChange={e=>set('dob',e.target.value)}/></FieldRow>
          <FieldRow label="Gender"><select style={SEL} value={form.gender} onChange={e=>set('gender',e.target.value)}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></FieldRow>
          <FieldRow label="Status"><select style={SEL} value={form.status} onChange={e=>set('status',e.target.value)}>{STATUSES.filter(s=>s!=='All').map(s=><option key={s}>{s}</option>)}</select></FieldRow>
          <FieldRow label="Admission Date"><input type="date" style={INP} value={form.admission_date} onChange={e=>set('admission_date',e.target.value)}/></FieldRow>
          {form.status==='Withdrawn'&&<FieldRow label="Left Date"><input type="date" style={INP} value={form.left_date} onChange={e=>set('left_date',e.target.value)}/></FieldRow>}
        </div>

        <Divider label="Course & Class"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:4}}>
          <FieldRow label="Course"><select style={SEL} value={form.course} onChange={e=>set('course',e.target.value)}><option value="">— Course —</option>{Object.keys(COURSE_STRUCTURE).map(c=><option key={c}>{c}</option>)}</select></FieldRow>
          <FieldRow label="Batch / Class">
            {subtypes.length>0?<select style={SEL} value={form.batch} onChange={e=>set('batch',e.target.value)}><option value="">—</option>{subtypes.map(s=><option key={s}>{s}</option>)}</select>:<select style={SEL} value={form.batch} onChange={e=>set('batch',e.target.value)}><option value="">—</option>{CLASSES_LIST.map(c=><option key={c}>{c}</option>)}</select>}
          </FieldRow>
          <FieldRow label="Session"><select style={SEL} value={form.session} onChange={e=>set('session',e.target.value)}><option value="">—</option>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></FieldRow>
          <FieldRow label="House / Block"><select style={SEL} value={form.house} onChange={e=>set('house',e.target.value)}><option value="">— House —</option>{HOUSES_LIST.map(h=><option key={h}>{h}</option>)}</select></FieldRow>
          <FieldRow label="Hostel Type"><select style={{...SEL,opacity:DAY_SCHOLAR_HOUSES.includes(form.house) ? .6 : 1}} value={form.hostel_type} onChange={e=>set('hostel_type',e.target.value)}>{['Boarder','Day Scholar','Day Boarder'].map(h=><option key={h}>{h}</option>)}</select></FieldRow>
        </div>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 14px',borderRadius:T.r8,background:hostelCfg.bg,border:`1px solid ${hostelCfg.border}`,fontSize:12,fontWeight:600,color:hostelCfg.color}}>
          {derived} · ₹{fmt(getFlatFeeAmtSync(derived, form.course))}/month
        </div>

        <Divider label="Fee Adjustments"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:14}}>
          <FieldRow label="Monthly Waiver (₹)"><input type="number" style={INP} value={form.fee_waiver} onChange={e=>set('fee_waiver',e.target.value)} placeholder="0"/></FieldRow>
          <FieldRow label="Scholarship (₹/mo)"><input type="number" style={INP} value={form.scholarship} onChange={e=>set('scholarship',e.target.value)} placeholder="0"/></FieldRow>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Waiver Reason"><input style={INP} value={form.fee_waiver_note} onChange={e=>set('fee_waiver_note',e.target.value)} placeholder="e.g. Merit, Staff ward"/></FieldRow></div>
          <div style={{gridColumn:'1/-1',background:T.greenLight,border:`1px solid ${T.greenBorder}`,borderRadius:T.r8,padding:'10px 14px',fontSize:13,color:T.text2,fontWeight:500}}>
            Effective monthly due: <strong style={{color:T.green}}>₹{fmt(effectiveDue)}</strong>
          </div>
        </div>

        <Divider label="Family & Contact"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:14}}>
          <FieldRow label="Father's Name"><input style={INP} value={form.father_name} onChange={e=>set('father_name',e.target.value)}/></FieldRow>
          <FieldRow label="Mother's Name"><input style={INP} value={form.mother_name} onChange={e=>set('mother_name',e.target.value)}/></FieldRow>
          <FieldRow label="Phone" error={errors.phone}>
            <input style={errors.phone?INP_ERR:INP} value={form.phone} onChange={e=>{set('phone',e.target.value);setErrors(v=>({...v,phone:''}))}}/>
            {phoneDup&&!errors.phone&&<div style={{fontSize:11,color:T.amber,marginTop:3,fontWeight:600}}>⚠ Used by {phoneDup.name}</div>}
          </FieldRow>
          <FieldRow label="Emergency Contact"><input style={INP} value={form.emergency_contact} onChange={e=>set('emergency_contact',e.target.value)} placeholder="Name · Relation · Phone"/></FieldRow>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Address"><input style={INP} value={form.address} onChange={e=>set('address',e.target.value)}/></FieldRow></div>
        </div>

        <Divider label="Medical & Notes"/>
        <div style={{display:'grid',gap:12,marginBottom:16}}>
          <FieldRow label="Medical / Allergy Notes"><input style={INP} value={form.medical_notes} onChange={e=>set('medical_notes',e.target.value)} placeholder="Allergies, conditions…"/></FieldRow>
          <FieldRow label="Remarks"><textarea style={{...INP,height:'auto',resize:'vertical'}} rows={2} value={form.remarks} onChange={e=>set('remarks',e.target.value)}/></FieldRow>
        </div>

        <div style={{display:'flex',gap:10,paddingTop:4}}>
          <Btn onClick={handleSave} disabled={saving} variant='primary' size='lg' style={{flex:1,justifyContent:'center'}}>{saving?'Saving…':editing?'Update Student':'Add Student'}</Btn>
          <Btn onClick={onCancel} size='lg'>Cancel</Btn>
        </div>
      </div>
    </Card>
  )
}

// ─── Student Row (list view) ──────────────────────────────────────────────────
// ─── Facebook-style Student Card ────────────────────────────────────────────
// Replaces the dense table row with a profile-card feed item: cover strip,
// centered avatar overlapping it, name/meta below, and an action bar along
// the bottom — mirrors a Facebook profile card's visual rhythm while keeping
// every original action (Profile/Edit/Fee/Exam/Attendance/Clone/Delete).

function courseAccent(course) {
  const cs = COURSE_STRUCTURE[course]
  return cs?.color || T.brand
}

function StudentCard({ s, can, onEdit, onDelete, onOpenFee, onOpenDetail, onQuickAttend, onExamEntry, onClone, feeData, attData, examData, selected, onSelect }) {
  const isMobile=useIsMobile()
  const [overflow,setOverflow]=useState(false)
  const att=attData[s.id]
  const dues=feeData[s.id]?.dues||0
  const missing=getMissingFields(s, can.viewPII)
  const birthday=isBirthdayToday(s.dob)
  const recent=isRecentlyAdded(s.created_at)
  const isSel=selected.has(s.id)
  const accent=courseAccent(s.course)

  const ACTIONS=[
    {l:'Profile',icon:'👤',fn:()=>onOpenDetail(s),show:true,primary:true},
    {l:'Edit',icon:'✏️',fn:()=>onEdit(s),show:can.write},
    {l:'Fee',icon:'💰',fn:()=>onOpenFee(s),show:can.fees},
    {l:'Exams',icon:'📚',fn:()=>onExamEntry(s),show:can.exams},
    {l:'Attendance',icon:'📅',fn:()=>onQuickAttend(s),show:can.attend},
    {l:'Clone',icon:'📋',fn:()=>onClone(s),show:can.write},
    {l:'Delete',icon:'🗑️',fn:()=>onDelete(s),show:can.write,danger:true},
  ].filter(a=>a.show)

  return (
    <div style={{
      background:T.surface, borderRadius:T.r12,
      border:`1px solid ${isSel?T.brandBorder:T.border}`,
      boxShadow:isSel?`0 0 0 2px ${T.brandLight}`:T.shadow,
      overflow:'hidden', position:'relative', transition:'box-shadow .15s',
    }}>
      {/* Cover strip — course-colored gradient, stands in for a "cover photo" */}
      <div style={{
        height:52, background:`linear-gradient(135deg,${accent}cc,${accent}55)`,
        position:'relative',
      }}>
        <input type="checkbox" checked={isSel} onChange={e=>{e.stopPropagation();onSelect(s.id)}} onClick={e=>e.stopPropagation()}
          style={{position:'absolute',top:8,left:8,width:15,height:15,cursor:'pointer',accentColor:'#fff'}}/>
        <div style={{position:'absolute',top:8,right:8}}>
          <StatusPill status={s.status}/>
        </div>
      </div>

      {/* Avatar overlapping the cover, centered like a profile header */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'0 16px 14px',marginTop:-30}}>
        <div style={{position:'relative'}}>
          <div style={{padding:3,background:T.surface,borderRadius:'50%'}}>
            <Avatar name={s.name} photoUrl={s.photo_url} size={64}/>
          </div>
          {birthday&&<span style={{position:'absolute',bottom:-2,right:-2,fontSize:16}}>🎂</span>}
        </div>

        <div style={{textAlign:'center',marginTop:8,cursor:'pointer'}} onClick={()=>onOpenDetail(s)}>
          <div style={{display:'flex',alignItems:'center',gap:5,justifyContent:'center',flexWrap:'wrap'}}>
            <span style={{fontWeight:700,fontSize:15,color:T.text1,letterSpacing:'-.01em'}}>{s.name}</span>
            {recent&&<span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:T.r4,background:T.tealLight,color:T.teal,border:`1px solid ${T.tealBorder}`}}>NEW</span>}
          </div>
          <div style={{fontSize:11.5,color:T.text3,marginTop:2}}>
            {s.gcc_no&&`GCC-${s.gcc_no} · `}{s.batch}
          </div>
          <div style={{display:'flex',gap:5,justifyContent:'center',flexWrap:'wrap',marginTop:6}}>
            {s.course&&<CoursePill course={s.course}/>}
            {s.house&&<HousePill house={s.house}/>}
          </div>
          {missing.length>0&&(
            <div style={{marginTop:6,fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:T.r4,background:T.amberLight,color:T.amber,border:`1px solid ${T.amberBorder}`,display:'inline-block'}}>
              ⚠ Missing: {missing.join(', ')}
            </div>
          )}
        </div>

        {/* Mini stat row — attendance + fee, like FB's friend-count/mutuals line */}
        <div style={{display:'flex',gap:14,marginTop:10,alignItems:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:9.5,color:T.text4,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em'}}>Attendance</div>
            <div style={{marginTop:2}}>{att!=null?<span style={{fontSize:13,fontWeight:700,color:att>=75?T.green:T.red}}>{att.toFixed(0)}%</span>:<span style={{fontSize:12,color:T.text4}}>—</span>}</div>
          </div>
          <div style={{width:1,height:24,background:T.border}}/>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:9.5,color:T.text4,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em'}}>Fee</div>
            <div style={{marginTop:2}}><FeeBadge dues={feeData[s.id]?dues:null}/></div>
          </div>
        </div>
      </div>

      {/* Action bar — Facebook-style Like/Comment/Share row */}
      <div style={{borderTop:`1px solid ${T.border}`, display:'flex'}}>
        {isMobile ? (
          <>
            <button onClick={()=>onOpenDetail(s)} style={{flex:1,padding:'10px 6px',border:'none',borderRight:`1px solid ${T.border}`,background:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:T.brand,fontFamily:'inherit'}}>👤 Profile</button>
            <button onClick={e=>{e.stopPropagation();setOverflow(v=>!v)}} style={{flex:1,padding:'10px 6px',border:'none',background:'none',cursor:'pointer',fontSize:16,color:T.text3,fontFamily:'inherit'}}>⋯ More</button>
          </>
        ) : (
          ACTIONS.map((a,i)=>(
            <button key={a.l} onClick={a.fn} title={a.l} style={{
              flex:1, padding:'10px 4px', border:'none',
              borderRight:i<ACTIONS.length-1?`1px solid ${T.border}`:'none',
              background:'none', cursor:'pointer', fontSize:11.5, fontWeight:600,
              color:a.danger?T.red:a.primary?T.brand:T.text2,
              display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              fontFamily:'inherit', transition:'background .12s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background=T.surface2}
            onMouseLeave={e=>e.currentTarget.style.background='none'}
            >
              <span style={{fontSize:14}}>{a.icon}</span>
              {a.l}
            </button>
          ))
        )}
      </div>

      {isMobile&&overflow&&(
        <>
          <div style={{position:'fixed',inset:0,zIndex:99997,background:'rgba(15,23,42,.4)'}} onClick={()=>setOverflow(false)}/>
          <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:99998,background:T.surface,borderTop:`1px solid ${T.border}`,borderRadius:`${T.r20} ${T.r20} 0 0`,padding:'16px 16px 32px',animation:'slideUp .2s ease'}} onClick={e=>e.stopPropagation()}>
            <div style={{width:32,height:3,background:T.border2,borderRadius:2,margin:'0 auto 14px',opacity:.6}}/>
            <div style={{fontWeight:700,fontSize:14,color:T.text1,marginBottom:14}}>{s.name}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {ACTIONS.filter(a=>!a.primary).map((item,i)=>(
                <button key={i} onClick={()=>{item.fn();setOverflow(false)}} style={{padding:'13px',borderRadius:T.r8,border:`1px solid ${item.danger?T.redBorder:T.border}`,background:item.danger?T.redLight:T.surface2,color:item.danger?T.red:T.text1,fontSize:13,fontWeight:600,cursor:'pointer',minHeight:48,fontFamily:'inherit'}}>
                  {item.icon} {item.l}
                </button>
              ))}
            </div>
            <Btn onClick={()=>setOverflow(false)} style={{width:'100%',justifyContent:'center',marginTop:10}}>Close</Btn>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Student Dashboard Tab ────────────────────────────────────────────────────
function StudentDashboard({ students, attData, examData, feeData, onOpenDetail, onOpenFee, onNavigate }) {
  const isMobile = useIsMobile()
  const col2 = isMobile ? '1fr' : '1fr 1fr'
  const n = v => Number(v || 0).toLocaleString('en-IN')

  // ── Derived counts ──────────────────────────────────────────────────────────
  const active      = students.filter(s => s.status === 'Active')
  const boarders    = students.filter(s => s.hostel_type === 'Boarder')
  const dayBoard    = students.filter(s => s.hostel_type === 'Day Boarder')
  const dayScholar  = students.filter(s => s.hostel_type === 'Day Scholar')
  const male        = students.filter(s => s.gender === 'Male')
  const female      = students.filter(s => s.gender === 'Female')
  const repeaters   = students.filter(s => s.is_repeater)
  const missingInfo = students.filter(s => getMissingFields(s).length > 0)
  const avgCompleteness = students.length ? Math.round(students.reduce((a,s)=>a+getCompletenessScore(s),0)/students.length) : 100

  // ── Attendance buckets ──────────────────────────────────────────────────────
  const withAtt = students.filter(s => attData[s.id] != null)
  const att90p  = withAtt.filter(s => attData[s.id] >= 90)
  const att75   = withAtt.filter(s => attData[s.id] >= 75 && attData[s.id] < 90)
  const att50   = withAtt.filter(s => attData[s.id] >= 50 && attData[s.id] < 75)
  const attLow  = withAtt.filter(s => attData[s.id] < 50)
  const avgAtt  = withAtt.length
    ? (withAtt.reduce((a, s) => a + attData[s.id], 0) / withAtt.length).toFixed(1)
    : null
  const criticalAtt = withAtt.filter(s => attData[s.id] < 60)

  // ── Fee summary ─────────────────────────────────────────────────────────────
  const withFee   = students.filter(s => feeData[s.id] != null)
  const feeDue    = withFee.filter(s => feeData[s.id].dues > 0)
  const feeClear  = withFee.filter(s => feeData[s.id].dues === 0)
  const totalDues = feeDue.reduce((a, s) => a + (feeData[s.id].dues || 0), 0)
  const highDue   = feeDue.filter(s => feeData[s.id].dues > 10000)

  // ── Exam summary ───────────────────────────────────────────────────────────
  const withExams = students.filter(s => (examData[s.id]?.length || 0) > 0)
  const allScores = withExams.map(s => {
    const exams = examData[s.id]
    return exams.reduce((a, e) => a + (e.total || 0), 0) / exams.length
  })
  const avgScore = allScores.length
    ? (allScores.reduce((a, v) => a + v, 0) / allScores.length).toFixed(0)
    : null

  // Subject-wise average across all students
  const subjectAvg = {}
  SUBJECTS.forEach(sub => {
    const vals = withExams.flatMap(s =>
      examData[s.id].map(e => e[sub]).filter(v => v != null)
    )
    if (vals.length)
      subjectAvg[sub] = (vals.reduce((a, v) => a + Number(v), 0) / vals.length).toFixed(1)
  })
  const weakSubjects = Object.entries(subjectAvg)
    .filter(([, v]) => Number(v) < 50)
    .sort((a, b) => Number(a[1]) - Number(b[1]))

  // ── Course distribution ────────────────────────────────────────────────────
  const courseData = Object.keys(COURSE_STRUCTURE).map(c => ({
    course: c,
    count:  students.filter(s => s.course === c).length,
    color:  COURSE_STRUCTURE[c].color,
  })).filter(c => c.count > 0)
  const maxCourse = Math.max(...courseData.map(c => c.count), 1)

  // ── House census ───────────────────────────────────────────────────────────
  const houseData = HOUSES_LIST
    .map(h => ({ house: h, count: students.filter(s => s.house === h).length, color: HOUSE_COLORS[h] || T.text3 }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
  const maxHouse = Math.max(...houseData.map(h => h.count), 1)

  // ── Batch distribution ─────────────────────────────────────────────────────
  const batchMap = {}
  students.forEach(s => { if (s.batch) batchMap[s.batch] = (batchMap[s.batch] || 0) + 1 })
  const batchData = Object.entries(batchMap).sort((a, b) => b[1] - a[1])
  const maxBatch  = Math.max(...batchData.map(b => b[1]), 1)

  // ── Status distribution ────────────────────────────────────────────────────
  const statusData = Object.entries(
    students.reduce((a, s) => { a[s.status || 'Unknown'] = (a[s.status || 'Unknown'] || 0) + 1; return a }, {})
  ).sort((a, b) => b[1] - a[1])

  // ── Sub-components ─────────────────────────────────────────────────────────
  const DashCard = ({ title, sub, children, accent }) => (
    <div style={{
      background: T.surface, borderRadius: T.r12,
      border: `1px solid ${T.border}`, boxShadow: T.shadow, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: `1px solid ${T.border}`,
        borderLeft: accent ? `3px solid ${accent}` : 'none',
        background: T.surface2,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text1, letterSpacing:'-.005em' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: T.text4, marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )

  const StatRow = ({ label, value, pct, color }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: color || T.text1 }}>{value}</span>
      </div>
      <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color || T.brand, borderRadius: 3, transition: 'width .4s' }} />
      </div>
    </div>
  )

  const AlertList = ({ items, color, border, emptyMsg, keyFn, nameFn, subFn, btnLabel, onBtn }) => (
    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
      {items.length === 0
        ? <div style={{ padding: '14px 16px', fontSize: 12, color: T.text4, textAlign: 'center' }}>{emptyMsg}</div>
        : items.map(s => (
            <div key={keyFn(s)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', borderBottom: `1px solid ${border}20`,
            }}>
              <Avatar name={nameFn(s)} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameFn(s)}</div>
                <div style={{ fontSize: 10, color: T.text3 }}>{subFn(s)}</div>
              </div>
              {onBtn && (
                <button onClick={() => onBtn(s)} style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 9px',
                  borderRadius: T.r6, border: 'none', background: color,
                  color: 'white', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}>{btnLabel}</button>
              )}
            </div>
          ))
      }
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>

      {/* ── KPI Row 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10 }}>
        {[
          { icon: SIcon.users, label: 'Total Students', value: students.length,  color: T.brand,   sub: `${active.length} active` },
          { icon: SIcon.home,  label: 'Boarders',        value: boarders.length,  color: T.green,   sub: `${dayBoard.length} day boarders · ${dayScholar.length} day scholars` },
          { icon: SIcon.fileText, label: 'Fee Dues',     value: feeDue.length,    color: T.red,     sub: `₹${n(totalDues)} outstanding`, warn: feeDue.length > 0 },
          { icon: SIcon.check, label: 'Low Attendance',  value: attLow.length,    color: T.red,     sub: '< 50% attendance', warn: attLow.length > 0 },
        ].map(c => (
          <div key={c.label} style={{
            background: c.warn ? T.redLight : T.surface,
            borderRadius: T.r12, padding: '16px 18px',
            border: `1px solid ${c.warn ? T.redBorder : T.border}`,
            borderLeft: `3px solid ${c.color}`, boxShadow: T.shadow,
          }}>
            <div style={{ width:28, height:28, borderRadius:T.r8, background:`${c.color}14`, color:c.color, display:'flex', alignItems:'center', justifyContent:'center', marginBottom: 10 }}>
              <c.icon size={15}/>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: c.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.text1 }}>{c.value}</div>
            <div style={{ fontSize: 10.5, color: T.text4, marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── KPI Row 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10 }}>
        {[
          { icon: SIcon.users,    label: 'Gender Split',   value: `${male.length}M / ${female.length}F`,   color: '#3B82F6' },
          { icon: SIcon.fileText, label: 'Avg Exam Score', value: avgScore ? `${avgScore}/700` : '—',        color: T.violet },
          { icon: SIcon.check,    label: 'Avg Attendance', value: avgAtt ? `${avgAtt}%` : '—',               color: Number(avgAtt) >= 75 ? T.green : T.red },
          { icon: SIcon.refresh,  label: 'Repeaters',       value: repeaters.length,                          color: '#92400e' },
        ].map(c => (
          <div key={c.label} style={{
            background: T.surface, borderRadius: T.r12, padding: '14px 16px',
            border: `1px solid ${T.border}`, boxShadow: T.shadow,
            display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{ width:32, height:32, borderRadius:T.r8, background:`${c.color}14`, color:c.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <c.icon size={16}/>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.text4, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Attendance + Fee ── */}
      <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 16 }}>

        <DashCard title="📅 Attendance Distribution" sub={`${withAtt.length} students tracked · Institute avg ${avgAtt ?? '—'}%`} accent={T.green}>
          <StatRow label="Excellent ≥90%"   value={att90p.length} pct={(att90p.length / Math.max(students.length,1)) * 100} color={T.green} />
          <StatRow label="Good 75–90%"      value={att75.length}  pct={(att75.length  / Math.max(students.length,1)) * 100} color={T.brand} />
          <StatRow label="Average 50–75%"   value={att50.length}  pct={(att50.length  / Math.max(students.length,1)) * 100} color={T.amber} />
          <StatRow label="Critical <50%"    value={attLow.length} pct={(attLow.length / Math.max(students.length,1)) * 100} color={T.red} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div style={{ background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: T.r8, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>{avgAtt ? `${avgAtt}%` : '—'}</div>
              <div style={{ fontSize: 9, color: T.green, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Institute Avg</div>
            </div>
            <div style={{ background: T.redLight, border: `1px solid ${T.redBorder}`, borderRadius: T.r8, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.red }}>{criticalAtt.length}</div>
              <div style={{ fontSize: 9, color: T.red, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Need Action</div>
            </div>
          </div>
        </DashCard>

        <DashCard title="💰 Fee Status Overview" sub={`${withFee.length} students with records`} accent={T.green}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: T.r8, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{feeClear.length}</div>
              <div style={{ fontSize: 9, color: T.green, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Fee Clear ✓</div>
            </div>
            <div style={{ background: T.redLight, border: `1px solid ${T.redBorder}`, borderRadius: T.r8, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.red }}>{feeDue.length}</div>
              <div style={{ fontSize: 9, color: T.red, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Dues Pending</div>
            </div>
          </div>
          <div style={{ background: T.surface2, borderRadius: T.r8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: T.text3, fontWeight: 600 }}>Total Outstanding</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: T.red }}>₹{n(totalDues)}</span>
          </div>
          <StatRow label={`High dues >₹10k (${highDue.length})`}  value={highDue.length}   pct={(highDue.length  / Math.max(feeDue.length,1)) * 100}   color={T.red} />
          <StatRow label={`Fee clear (${feeClear.length})`}        value={feeClear.length}  pct={(feeClear.length / Math.max(withFee.length,1)) * 100}  color={T.green} />
        </DashCard>
      </div>

      {/* ── Course + House + Batch ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16 }}>

        <DashCard title="📚 Course Distribution" accent={T.violet}>
          {courseData.map(c => (
            <div key={c.course} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.course}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: c.color }}>{c.count}</span>
              </div>
              <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c.count / maxCourse) * 100}%`, background: c.color, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </DashCard>

        <DashCard title="🏠 House Census" accent={T.sky}>
          {houseData.slice(0, 10).map(h => (
            <div key={h.house} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.text2, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.house}</span>
              <div style={{ width: 60, height: 5, background: T.surface2, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(h.count / maxHouse) * 100}%`, background: h.color, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: T.text1, minWidth: 18, textAlign: 'right' }}>{h.count}</span>
            </div>
          ))}
        </DashCard>

        <DashCard title="🎓 Batch & Status" accent={T.brand}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.text4, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Batch</div>
          {batchData.slice(0, 6).map(([b, cnt]) => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.brand, width: 72, flexShrink: 0 }}>{b}</span>
              <div style={{ flex: 1, height: 5, background: T.surface2, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(cnt / maxBatch) * 100}%`, background: T.brand, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: T.text1, minWidth: 18, textAlign: 'right' }}>{cnt}</span>
            </div>
          ))}
          <div style={{ height: 1, background: T.border, margin: '10px 0 8px' }} />
          <div style={{ fontSize: 10, fontWeight: 600, color: T.text4, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Status</div>
          {statusData.map(([st, cnt]) => {
            const cfg = STATUS_CFG[st] || { color: T.text3, dot: T.text3 }
            return (
              <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, flex: 1 }}>{st}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: T.text1 }}>{cnt}</span>
              </div>
            )
          })}
        </DashCard>
      </div>

      {/* ── Exam performance ── */}
      {withExams.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 16 }}>
          <DashCard title="📝 Subject-wise Performance" sub="Average marks across all exams" accent={T.violet}>
            {Object.entries(subjectAvg).sort((a, b) => Number(a[1]) - Number(b[1])).map(([sub, avg]) => {
              const v = Number(avg)
              const color = v >= 60 ? T.green : v >= 40 ? T.amber : T.red
              return (
                <div key={sub} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.text2 }}>{sub}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color }}>{avg}/100</span>
                  </div>
                  <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${v}%`, background: color, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
            {weakSubjects.length > 0 && (
              <div style={{ marginTop: 10, background: T.redLight, border: `1px solid ${T.redBorder}`, borderRadius: T.r8, padding: '8px 12px', fontSize: 11, color: T.red, fontWeight: 600 }}>
                ⚠ Weak areas: {weakSubjects.map(([s]) => s).join(', ')}
              </div>
            )}
          </DashCard>

          <DashCard title="🏆 Score Distribution" sub={`${withExams.length} students · avg ${avgScore ?? '—'}/700`} accent={T.amber}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: T.violetLight, border: `1px solid ${T.violetBorder}`, borderRadius: T.r8, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.violet }}>{avgScore ?? '—'}</div>
                <div style={{ fontSize: 9, color: T.violet, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Avg / 700</div>
              </div>
              <div style={{ background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: T.r8, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.amber }}>{withExams.length}</div>
                <div style={{ fontSize: 9, color: T.amber, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Appeared</div>
              </div>
            </div>
            {[
              { label: 'Excellent ≥500',  count: withExams.filter(s => (examData[s.id]?.[0]?.total || 0) >= 500).length, color: T.green },
              { label: 'Good 350–499',    count: withExams.filter(s => { const t = examData[s.id]?.[0]?.total || 0; return t >= 350 && t < 500 }).length, color: T.brand },
              { label: 'Average 200–349', count: withExams.filter(s => { const t = examData[s.id]?.[0]?.total || 0; return t >= 200 && t < 350 }).length, color: T.amber },
              { label: 'Needs work <200', count: withExams.filter(s => (examData[s.id]?.[0]?.total || 0) < 200).length, color: T.red },
            ].map(row => (
              <StatRow key={row.label} label={row.label} value={row.count} pct={(row.count / Math.max(withExams.length, 1)) * 100} color={row.color} />
            ))}
          </DashCard>
        </div>
      )}

      {/* ── Smart Alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 16 }}>

        <div style={{ background: T.surface, borderRadius: T.r12, border: `1px solid ${T.redBorder}`, overflow: 'hidden', boxShadow: T.shadow }}>
          <div style={{ background: T.redLight, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.redBorder}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.red }}>📉 Critical Attendance</div>
            <span style={{ fontSize: 10, fontWeight: 800, background: T.red, color: 'white', padding: '2px 8px', borderRadius: 99 }}>{criticalAtt.length}</span>
          </div>
          <AlertList
            items={criticalAtt.slice(0, 8)}
            color={T.red} border={T.redBorder}
            emptyMsg="🎉 All students above 60% attendance"
            keyFn={s => s.id}
            nameFn={s => s.name}
            subFn={s => `GCC-${s.gcc_no} · ${attData[s.id]?.toFixed(0) ?? '—'}% · ${s.course || '—'}`}
            btnLabel="Profile"
            onBtn={onOpenDetail}
          />
        </div>

        <div style={{ background: T.surface, borderRadius: T.r12, border: `1px solid ${T.amberBorder}`, overflow: 'hidden', boxShadow: T.shadow }}>
          <div style={{ background: T.amberLight, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.amberBorder}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.amber }}>💰 Fee Defaulters</div>
            <span style={{ fontSize: 10, fontWeight: 800, background: T.amber, color: 'white', padding: '2px 8px', borderRadius: 99 }}>{feeDue.length}</span>
          </div>
          <AlertList
            items={feeDue.sort((a, b) => (feeData[b.id]?.dues || 0) - (feeData[a.id]?.dues || 0)).slice(0, 8)}
            color={T.amber} border={T.amberBorder}
            emptyMsg="✅ All students are fee-clear"
            keyFn={s => s.id}
            nameFn={s => s.name}
            subFn={s => `GCC-${s.gcc_no} · ₹${n(feeData[s.id]?.dues)} due · ${s.hostel_type || '—'}`}
            btnLabel="Collect"
            onBtn={onOpenFee}
          />
        </div>

        <div style={{ background: T.surface, borderRadius: T.r12, border: `1px solid ${T.violetBorder}`, overflow: 'hidden', boxShadow: T.shadow }}>
          <div style={{ background: T.violetLight, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.violetBorder}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.violet }}>⚠ Incomplete Profiles</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.violet }}>Avg {avgCompleteness}%</span>
              <span style={{ fontSize: 10, fontWeight: 800, background: T.violet, color: 'white', padding: '2px 8px', borderRadius: 99 }}>{missingInfo.length}</span>
            </div>
          </div>
          <AlertList
            items={missingInfo.slice(0, 8)}
            color={T.violet} border={T.violetBorder}
            emptyMsg="✅ All profiles complete"
            keyFn={s => s.id}
            nameFn={s => s.name}
            subFn={s => `${getCompletenessScore(s)}% complete · Missing: ${getMissingFields(s).join(', ')}`}
            btnLabel="Edit"
            onBtn={onOpenDetail}
          />
          {onNavigate&&missingInfo.length>0&&(
            <div style={{padding:'10px 16px',borderTop:`1px solid ${T.violetBorder}`}}>
              <Btn onClick={()=>onNavigate('dataQuality')} size='sm' style={{width:'100%',justifyContent:'center',color:T.violet,borderColor:T.violetBorder}}>
                View all {missingInfo.length} in Data Quality →
              </Btn>
            </div>
          )}
        </div>

        <div style={{ background: T.surface, borderRadius: T.r12, border: '1px solid #fcd34d', overflow: 'hidden', boxShadow: T.shadow }}>
          <div style={{ background: '#fef3c7', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fcd34d' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>🔁 Repeater Students</div>
            <span style={{ fontSize: 10, fontWeight: 800, background: '#92400e', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{repeaters.length}</span>
          </div>
          <AlertList
            items={repeaters.slice(0, 8)}
            color="#92400e" border="#fcd34d"
            emptyMsg="No repeater students tagged yet"
            keyFn={s => s.id}
            nameFn={s => s.name}
            subFn={s => `GCC-${s.gcc_no} · ${s.course || '—'} · ${s.batch || '—'}`}
            btnLabel="Profile"
            onBtn={onOpenDetail}
          />
        </div>
      </div>

      {/* ── Data completeness ── */}
      <div style={{ background: T.surface, borderRadius: T.r12, border: `1px solid ${T.border}`, boxShadow: T.shadow, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${T.brand}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>📊 Data Completeness</div>
          <div style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>Profile quality across {students.length} students</div>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: 'Have GCC No.',   count: students.filter(s => s.gcc_no).length,       color: T.brand },
              { label: 'Have DOB',       count: students.filter(s => s.dob).length,           color: T.sky },
              { label: 'Have Exam Data', count: withExams.length,                             color: T.violet },
              { label: 'Att. Tracked',   count: withAtt.length,                               color: T.green },
            ].map(p => {
              const pct = students.length ? Math.round((p.count / students.length) * 100) : 0
              return (
                <div key={p.label} style={{ background: `${p.color}08`, borderRadius: T.r10, padding: '12px 14px', border: `1px solid ${p.color}20` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: p.color, marginBottom: 6 }}>
                    <span>{p.label}</span><span>{p.count}/{students.length}</span>
                  </div>
                  <div style={{ height: 8, background: 'white', borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: p.color }}>{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}
// ─── Data Quality Tab ─────────────────────────────────────────────────────────
// Comprehensive, database-wide completeness worklist. Every student gets a
// weighted completeness score (see COMPLETENESS_FIELDS above); this tab lists
// them worst-first so staff can systematically fill in what's missing.

function CompletenessBar({ pct }) {
  const color = pct>=90?T.green:pct>=60?T.amber:T.red
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,minWidth:100}}>
      <div style={{flex:1,height:6,background:T.border,borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3,transition:'width .3s'}}/>
      </div>
      <span style={{fontSize:12,fontWeight:700,color,minWidth:34,textAlign:'right'}}>{pct}%</span>
    </div>
  )
}

function DataQualityRow({ student, can, onQuickSave, viewPII }) {
  const [expanded,setExpanded]=useState(false)
  const [form,setForm]=useState({})
  const [saving,setSaving]=useState(false)
  const missing=getMissingFieldKeys(student,viewPII)
  const pct=getCompletenessScore(student,viewPII)

  const startEdit=()=>{
    const init={}
    missing.forEach(f=>init[f.key]=student[f.key]||(f.key==='gender'?'Male':''))
    setForm(init);setExpanded(true)
  }

  const save=async()=>{
    setSaving(true)
    await onQuickSave(student.id,form)
    setSaving(false);setExpanded(false)
  }

  const INP={width:'100%',padding:'7px 10px',borderRadius:T.r6,border:`1px solid ${T.border2}`,fontSize:13,background:T.surface,color:T.text1,height:32,fontFamily:'inherit',boxSizing:'border-box'}

  return (
    <div style={{border:`1px solid ${T.border}`,borderRadius:T.r10,overflow:'hidden',marginBottom:8}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',flexWrap:'wrap'}}>
        <Avatar name={student.name} photoUrl={student.photo_url} size={30}/>
        <div style={{flex:1,minWidth:140}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text1}}>{student.name}</div>
          <div style={{fontSize:11,color:T.text4}}>{student.gcc_no?`GCC-${student.gcc_no}`:'No GCC'}{student.batch?` · ${student.batch}`:''}</div>
        </div>
        <div style={{width:120}}><CompletenessBar pct={pct}/></div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {missing.slice(0,3).map(f=>(
            <span key={f.key} style={{fontSize:9.5,fontWeight:700,padding:'2px 7px',borderRadius:T.r4,background:T.amberLight,color:T.amber}}>{f.label}</span>
          ))}
          {missing.length>3&&<span style={{fontSize:9.5,color:T.text4}}>+{missing.length-3} more</span>}
        </div>
        <IfCan can={can.write}>
          <Btn size='sm' variant='primary' onClick={expanded?()=>setExpanded(false):startEdit}>{expanded?'Close':'Complete'}</Btn>
        </IfCan>
      </div>
      {expanded&&(
        <div style={{padding:'12px 14px',borderTop:`1px solid ${T.border}`,background:T.surface2}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:12}}>
            {missing.map(f=>(
              <FieldRow key={f.key} label={f.label}>
                {f.key==='gender'?(
                  <select value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={INP}>
                    <option>Male</option><option>Female</option>
                  </select>
                ):f.key==='dob'||f.key==='admission_date'?(
                  <input type="date" value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={INP}/>
                ):f.key==='course'?(
                  <select value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={INP}>
                    <option value="">Select…</option>
                    {COURSES.map(c=><option key={c}>{c}</option>)}
                  </select>
                ):(
                  <input value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={INP}/>
                )}
              </FieldRow>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn variant='primary' size='sm' disabled={saving} onClick={save}>{saving?'Saving…':'Save'}</Btn>
            <Btn size='sm' onClick={()=>setExpanded(false)}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

function DataQualityTab({ students, can, onQuickSave }) {
  const isMobile=useIsMobile()
  const [search,setSearch]=useState('')
  const [filterField,setFilterField]=useState('All')
  const viewPII=can.viewPII

  const scored=students.map(s=>({s,pct:getCompletenessScore(s,viewPII),missing:getMissingFieldKeys(s,viewPII)}))
    .filter(x=>x.missing.length>0)
    .sort((a,b)=>a.pct-b.pct)

  const filtered=scored.filter(({s,missing})=>{
    if(search&&!s.name.toLowerCase().includes(search.toLowerCase())&&!(s.gcc_no||'').includes(search))return false
    if(filterField!=='All'&&!missing.some(f=>f.label===filterField))return false
    return true
  })

  const avgPct=students.length?Math.round(students.reduce((a,s)=>a+getCompletenessScore(s,viewPII),0)/students.length):100
  const fullyComplete=students.length-scored.length
  const fieldCounts={}
  scored.forEach(({missing})=>missing.forEach(f=>{fieldCounts[f.label]=(fieldCounts[f.label]||0)+1}))
  const topGaps=Object.entries(fieldCounts).sort((a,b)=>b[1]-a[1]).slice(0,6)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div>
        <div style={{fontSize:isMobile?18:22,fontWeight:800,color:T.text1,letterSpacing:'-.02em'}}>Data Quality</div>
        <div style={{fontSize:12.5,color:T.text3,marginTop:2}}>Complete student records systematically — worst first</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10}}>
        <div style={{background:T.surface2,borderRadius:T.r10,padding:'14px 16px',border:`1px solid ${T.border}`}}>
          <div style={{fontSize:10,fontWeight:600,color:T.text4,textTransform:'uppercase',letterSpacing:'.06em'}}>Avg Completeness</div>
          <div style={{fontSize:24,fontWeight:800,color:avgPct>=90?T.green:avgPct>=60?T.amber:T.red,marginTop:4}}>{avgPct}%</div>
        </div>
        <div style={{background:T.surface2,borderRadius:T.r10,padding:'14px 16px',border:`1px solid ${T.border}`}}>
          <div style={{fontSize:10,fontWeight:600,color:T.text4,textTransform:'uppercase',letterSpacing:'.06em'}}>Fully Complete</div>
          <div style={{fontSize:24,fontWeight:800,color:T.green,marginTop:4}}>{fullyComplete}</div>
        </div>
        <div style={{background:T.surface2,borderRadius:T.r10,padding:'14px 16px',border:`1px solid ${T.border}`}}>
          <div style={{fontSize:10,fontWeight:600,color:T.text4,textTransform:'uppercase',letterSpacing:'.06em'}}>Needs Attention</div>
          <div style={{fontSize:24,fontWeight:800,color:T.red,marginTop:4}}>{scored.length}</div>
        </div>
        <div style={{background:T.surface2,borderRadius:T.r10,padding:'14px 16px',border:`1px solid ${T.border}`}}>
          <div style={{fontSize:10,fontWeight:600,color:T.text4,textTransform:'uppercase',letterSpacing:'.06em'}}>Total Students</div>
          <div style={{fontSize:24,fontWeight:800,color:T.text1,marginTop:4}}>{students.length}</div>
        </div>
      </div>

      {topGaps.length>0&&(
        <div>
          <div style={{fontSize:11,fontWeight:600,color:T.text3,marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>Most common gaps</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {topGaps.map(([label,count])=>(
              <button key={label} onClick={()=>setFilterField(f=>f===label?'All':label)} style={{
                padding:'5px 12px',borderRadius:T.r24,border:`1.5px solid ${filterField===label?T.amber:T.border}`,
                background:filterField===label?T.amberLight:T.surface,color:filterField===label?T.amber:T.text2,
                fontSize:11.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
              }}>{label} ({count})</button>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or GCC…" style={{flex:1,minWidth:200,padding:'8px 12px',borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:13,background:T.surface,color:T.text1,fontFamily:'inherit'}}/>
        {filterField!=='All'&&<Btn size='sm' onClick={()=>setFilterField('All')}><SIcon.x size={12}/> {filterField}</Btn>}
      </div>

      <div>
        {filtered.length===0?(
          <div style={{textAlign:'center',padding:'40px 0',color:T.text4,fontSize:13}}>
            {scored.length===0?'🎉 Every student record is complete.':'No students match this filter.'}
          </div>
        ):(
          filtered.map(({s})=><DataQualityRow key={s.id} student={s} can={can} onQuickSave={onQuickSave} viewPII={viewPII}/>)
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Students() {
  const { role, can, user }=usePermissions()
  const isMobile=useIsMobile()

  const [students,setStudents]=useState([])
  const [houseOptions,setHouseOptions]=useState([])
  const [houseColorMap,setHouseColorMap]=useState({})
  const [loading,setLoading]=useState(true)
  const [feeData,setFeeData]=useState({})
  const [feeHistory,setFeeHistory]=useState({})
  const [attData,setAttData]=useState({})
  const [examData,setExamData]=useState({})
  const [deleted,setDeleted]=useState([])
  const [showDeleted,setShowDeleted]=useState(false)
  const [undoItem,setUndoItem]=useState(null)
  const [deletedRow,setDeletedRow]=useState(null)
  const [formOpen,setFormOpen]=useState(false)
  const [editing,setEditing]=useState(null)
  const [feePanel,setFeePanel]=useState(null)
  const [detailPanel,setDetailPanel]=useState(null)
  const [examEntry,setExamEntry]=useState(null)
  const [attViewer,setAttViewer]=useState(null)
  const [examViewer,setExamViewer]=useState(null)
  const [feeViewer,setFeeViewer]=useState(null)
  const [toast,setToast]=useState(null)
  const [page,setPage]=useState(1)
  const [viewMode,setViewMode]=useState('list')
  const [pageTab,setPageTab]=useState('students')
  const [showBulkOps,setShowBulkOps]=useState(false)
  const [showRollover,setShowRollover]=useState(false)
  const [showBulkFee,setShowBulkFee]=useState(false)
  const [showHouseReassign,setShowHouseReassign]=useState(false)
  const [showMergeDups,setShowMergeDups]=useState(false)
  const [showReportGen,setShowReportGen]=useState(false)
  // quickAttend state removed with the legacy modal above
  const [showColPicker,setShowColPicker]=useState(false)
  const [showHousePills,setShowHousePills]=useState(false)
  const [showPresets,setShowPresets]=useState(false)
  const [showRecents,setShowRecents]=useState(false)
  const [presetName,setPresetName]=useState('')
  const [selected,setSelected]=useState(new Set())
  const [ageMin,setAgeMin]=useState('')
  const [ageMax,setAgeMax]=useState('')
  const [confirmModal,setConfirmModal]=useState(null)
  const [showExportMenu,setShowExportMenu]=useState(false)
  const exportMenuRef=useRef(null)
  const PAGE_SIZE=25

  const [search,setSearch]=useState('')
  const [filterStatus,setFilterStatus]=useState('All')
  const [filterCourse,setFilterCourse]=useState('All')
  const [filterHostel,setFilterHostel]=useState('All')
  const [filterHouse,setFilterHouse]=useState('All')
  const [filterGender,setFilterGender]=useState('All')
  const [filterSession,setFilterSession]=useState('All')
  const [filterBatch,setFilterBatch]=useState('All')
  const [gccMin,setGccMin]=useState('')
  const [gccMax,setGccMax]=useState('')

  const loadCols = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) || 'null')
    const defaults = ALL_COLUMNS.filter(c => c.default).map(c => c.key)
    return saved || defaults
  } catch { 
    return ALL_COLUMNS.filter(c => c.default).map(c => c.key) 
  }
}
  const [visibleCols, setVisibleCols] = useState(loadCols)
// Filter out PII columns if user cannot view PII
const effectiveCols = visibleCols.filter(col => {
  const colDef = ALL_COLUMNS.find(c => c.key === col)
  if (colDef?.pii && !can.viewPII) return false
  return true
})
  const saveCol=cols=>{setVisibleCols(cols);localStorage.setItem(COLUMNS_KEY,JSON.stringify(cols))}
  const [density,setDensity]=useState(()=>localStorage.getItem(DENSITY_KEY)||'comfortable')
  const changeDensity=d=>{setDensity(d);localStorage.setItem(DENSITY_KEY,d)}

  const{presets,save:savePreset,remove:removePreset}=usePresets()
  const{recent:recentSearches,add:addSearch,clear:clearSearches}=useRecentSearches()

  const searchRef=useRef(null)
  const undoTimer=useRef(null)
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),3500)}

  useEffect(()=>{
    if(!showExportMenu)return
    const close=e=>{if(exportMenuRef.current&&!exportMenuRef.current.contains(e.target))setShowExportMenu(false)}
    document.addEventListener('mousedown',close);document.addEventListener('touchend',close)
    return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('touchend',close)}
  },[showExportMenu])

  // ── Data loaders (logic unchanged) ───────────────────────────────────────────
  const loadAll=useCallback(async()=>{
    setLoading(true)
    try{
      const[{data:rows,error},{data:houseRows}]=await Promise.all([supabase.from('students').select('*').is('deleted_at',null).order('name'),supabase.from('houses').select('name').order('name')])
      if(error)throw error
      setStudents(rows||[])
      if(houseRows?.length)setHouseOptions(houseRows.map(h=>h.name))
    }catch(err){showToast('Failed to load: '+err.message,T.red)}
    finally{setLoading(false)}
  },[])

  const loadDeleted=useCallback(async()=>{const{data}=await supabase.from('students').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false});setDeleted(data||[])},[])

  const loadAttData=useCallback(async(ids,studentRows=[])=>{
    if(!ids?.length)return
    try{
      // Wired to the real Attendance module's table: attendance_records
      // (not a separate "attendance" table). Present=1, Late=0.5, Absent/Leave=0.
      // Attendance.jsx falls back to gcc_no/student_name matching for records
      // saved before student_id existed on a row — match all three here too,
      // or students with older records show an artificially low/blank %.
      const gccByStudentId={},nameByStudentId={}
      studentRows.forEach(s=>{if(s.gcc_no)gccByStudentId[s.id]=String(s.gcc_no);nameByStudentId[s.id]=s.name})
      const gccList=Object.values(gccByStudentId)
      const nameList=Object.values(nameByStudentId)
      const[byId,byGcc,byName]=await Promise.all([
        supabase.from('attendance_records').select('student_id,gcc_no,student_name,status').in('student_id',ids),
        gccList.length?supabase.from('attendance_records').select('student_id,gcc_no,student_name,status').in('gcc_no',gccList):Promise.resolve({data:[]}),
        supabase.from('attendance_records').select('student_id,gcc_no,student_name,status').in('student_name',nameList),
      ])
      const allRecs=[...(byId.data||[]),...(byGcc.data||[]),...(byName.data||[])]
      if(!allRecs.length){const map={};ids.forEach(id=>map[id]=null);setAttData(map);return}
      const map={}
      ids.forEach(id=>{
        const gcc=gccByStudentId[id],name=nameByStudentId[id]
        const seen=new Set()
        const recs=allRecs.filter(r=>{
          const matches=r.student_id===id||(gcc&&r.gcc_no===gcc)||(name&&r.student_name===name)
          if(!matches)return false
          const key=`${r.student_id}|${r.gcc_no}|${r.student_name}|${r.status}`
          if(seen.has(key))return false
          seen.add(key);return true
        })
        if(!recs.length){map[id]=null;return}
        map[id]=(recs.filter(r=>r.status==='Present').length+recs.filter(r=>r.status==='Late').length*.5)/recs.length*100
      })
      setAttData(map)
    }catch{}
  },[])

  const loadExamData=useCallback(async ids=>{
    if(!ids?.length)return
    try{
      // Wired to the real Exams module's table: exam_marks (per-subject rows,
      // not a pre-computed total) — not "exam_scores", which doesn't exist.
      // Sum marks_obtained per student per (exam_type_id, exam_date) sitting to
      // get a per-exam total, matching how Exams.jsx computes totals itself.
      const{data}=await supabase.from('exam_marks').select('student_id,exam_type_id,exam_date,marks_obtained,created_at').in('student_id',ids).order('exam_date',{ascending:false})
      if(!data)return
      const bySitting={}
      data.forEach(r=>{
        const key=`${r.student_id}|${r.exam_type_id}|${r.exam_date}`
        if(!bySitting[key])bySitting[key]={student_id:r.student_id,exam_type_id:r.exam_type_id,exam_date:r.exam_date,total:0,created_at:r.created_at}
        bySitting[key].total+=Number(r.marks_obtained)||0
      })
      const map={}
      Object.values(bySitting).forEach(s=>{
        if(!map[s.student_id])map[s.student_id]=[]
        map[s.student_id].push({total:s.total,exam_date:s.exam_date,exam_type_id:s.exam_type_id,created_at:s.created_at})
      })
      Object.keys(map).forEach(id=>map[id].sort((a,b)=>new Date(b.exam_date)-new Date(a.exam_date)))
      setExamData(map)
    }catch{}
  },[])


  const loadFeeData=useCallback(async(ids,studentRows)=>{
    if(!ids?.length||!studentRows?.length)return
    try{
      // Build gcc list from student rows (adm_ tables key on gcc, not student UUID)
      const gccList=studentRows.map(s=>gccStrFee(s.gcc_no)).filter(Boolean)
      const [admRes,flatRes,crsfRes]=await Promise.all([
        supabase.from('adm_fee_collections').select('adm_app_id,amount_paid,pay_date,fee_type,description,pay_mode').in('adm_app_id',gccList).eq('reverted',false),
        supabase.from('adm_flat_fees').select('adm_app_id,amount,pay_date,month,year,pay_mode').in('adm_app_id',gccList).eq('paid',true).eq('reverted',false),
        supabase.from('adm_course_fees').select('adm_app_id,amount_paid,pay_date,course,for_month,year,pay_mode').in('adm_app_id',gccList).eq('reverted',false),
      ])
      // Build per-gcc totals, last-paid date, AND full itemized history for the viewer
      const totals={},lastPaid={},history={}
      const pushHist=(gcc,row)=>{if(!history[gcc])history[gcc]=[];history[gcc].push(row)}
      ;(admRes.data||[]).forEach(r=>{totals[r.adm_app_id]=(totals[r.adm_app_id]||0)+Number(r.amount_paid||0);if(!lastPaid[r.adm_app_id]||r.pay_date>lastPaid[r.adm_app_id])lastPaid[r.adm_app_id]=r.pay_date;pushHist(r.adm_app_id,{amount:Number(r.amount_paid||0),payment_date:r.pay_date,type:r.fee_type||'Admission Fee',desc:r.description||'',mode:r.pay_mode||''})})
      ;(flatRes.data||[]).forEach(r=>{totals[r.adm_app_id]=(totals[r.adm_app_id]||0)+Number(r.amount||0);if(!lastPaid[r.adm_app_id]||r.pay_date>lastPaid[r.adm_app_id])lastPaid[r.adm_app_id]=r.pay_date;pushHist(r.adm_app_id,{amount:Number(r.amount||0),payment_date:r.pay_date,type:'Flat Fee',desc:`${r.month||''} ${r.year||''}`.trim(),mode:r.pay_mode||''})})
      ;(crsfRes.data||[]).forEach(r=>{totals[r.adm_app_id]=(totals[r.adm_app_id]||0)+Number(r.amount_paid||0);if(!lastPaid[r.adm_app_id]||r.pay_date>lastPaid[r.adm_app_id])lastPaid[r.adm_app_id]=r.pay_date;pushHist(r.adm_app_id,{amount:Number(r.amount_paid||0),payment_date:r.pay_date,type:'Course Fee',desc:`${r.course||''} ${r.for_month||''} ${r.year||''}`.trim(),mode:r.pay_mode||''})})
      const result={},histResult={}
      for(const s of studentRows){
        const gcc=gccStrFee(s.gcc_no)
        const totalPaid=totals[gcc]||0
        const effectiveDue=getEffectiveMonthlyDue(s)
        const admitDate=s.admission_date?new Date(s.admission_date):new Date()
        const now=new Date()
        const monthsEnrolled=Math.max(0,(now.getFullYear()-admitDate.getFullYear())*12+(now.getMonth()-admitDate.getMonth()))
        const arrears=Math.max(0,monthsEnrolled*effectiveDue-totalPaid)
        const lp=lastPaid[gcc]
        result[s.id]={dues:arrears,lastPaid:lp?new Date(lp).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}):null}
        histResult[s.id]=(history[gcc]||[]).sort((a,b)=>new Date(b.payment_date)-new Date(a.payment_date))
      }
      setFeeData(result);setFeeHistory(histResult)
    }catch(e){console.error('loadFeeData error',e)}
  },[])

  useEffect(()=>{if(students.length){const ids=students.map(s=>s.id);loadFeeData(ids,students);loadAttData(ids,students);loadExamData(ids)}},[students])
  useEffect(()=>{loadAll()},[loadAll])
  useEffect(()=>{if(showDeleted)loadDeleted()},[showDeleted])
  useEffect(()=>{const h=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();searchRef.current?.focus()}};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[])

  // ── Mutations (logic unchanged) ───────────────────────────────────────────────
  const handleSave=async(eid,obj)=>{
    if(!can.write){showToast('No permission',T.red);return}
    const payload={gcc_no:parseInt(obj.gcc_no),name:obj.name,dob:obj.dob||null,gender:obj.gender||null,course:obj.course||null,batch:obj.batch||null,house:obj.house||null,session:obj.session||null,hostel_type:obj.hostel_type||'Day Scholar',status:obj.status||'Active',father_name:obj.father_name||null,mother_name:obj.mother_name||null,phone:obj.phone||null,address:obj.address||null,remarks:obj.remarks||null,fee_waiver:Number(obj.fee_waiver)||0,scholarship:Number(obj.scholarship)||0,fee_waiver_note:obj.fee_waiver_note||null,emergency_contact:obj.emergency_contact||null,prev_school:obj.prev_school||null,referral_source:obj.referral_source||null,admission_date:obj.admission_date||null,left_date:obj.left_date||null,medical_notes:obj.medical_notes||null,academic_remarks:obj.academic_remarks||null}
    if(eid){
      const{error}=await supabase.from('students').update(payload).eq('id',eid)
      if(error){showToast('Update failed: '+error.message,T.red);return}
      setStudents(prev=>prev.map(s=>s.id===eid?{...s,...payload}:s))
      await auditLog('student_update',{student_id:eid});showToast('Student updated',T.amber)
    }else{
      const{data,error}=await supabase.from('students').insert(payload).select().single()
      if(error){showToast(error.code==='23505'?`GCC ${obj.gcc_no} already exists`:'Save failed: '+error.message,T.red);return}
      setStudents(prev=>[data,...prev])
      await auditLog('student_create',{student_id:data.id,gcc_no:data.gcc_no});showToast(`${data.name} added`,T.green)
    }
    setFormOpen(false);setEditing(null)
  }

  // Partial update used by the Data Quality tab — patches only the specific
  // fields being completed, unlike handleSave which expects a full form payload.
  const handleQuickSave=async(studentId,fields)=>{
    if(!can.write){showToast('No permission',T.red);return}
    const payload={...fields}
    if(payload.gcc_no!==undefined)payload.gcc_no=parseInt(payload.gcc_no)||null
    const{error}=await supabase.from('students').update(payload).eq('id',studentId)
    if(error){showToast('Update failed: '+error.message,T.red);return}
    setStudents(prev=>prev.map(s=>s.id===studentId?{...s,...payload}:s))
    await auditLog('student_quick_complete',{student_id:studentId,fields:Object.keys(fields)})
    showToast('Details saved',T.green)
  }

  const handleClone=student=>{
    if(!can.write){showToast('No permission',T.red);return}
    const cloned={...student};delete cloned.id;delete cloned.created_at;delete cloned.deleted_at
    cloned.name+=' (Clone)';cloned.gcc_no='';cloned.status='Active';cloned.admission_date=new Date().toISOString().slice(0,10)
    setEditing(null);setFormOpen(true);localStorage.setItem(DRAFT_KEY,JSON.stringify(sanitiseDraftForStorage(cloned)))
    showToast('Clone ready — GCC No. and personal details must be re-entered',T.brand)
  }

  const handleDelete=s=>{
    if(!can.write){showToast('No permission',T.red);return}
    setConfirmModal({title:'Archive Student',message:`Archive ${s.name} (GCC-${s.gcc_no})? You have 7 seconds to undo.`,confirmLabel:'Archive',danger:true,onConfirm:async()=>{
      setConfirmModal(null);setStudents(prev=>prev.filter(x=>x.id!==s.id));setUndoItem(s);setDeletedRow(s)
      await supabase.from('students').update({deleted_at:new Date().toISOString(),undo_pending:true}).eq('id',s.id)
      await auditLog('student_delete',{student_id:s.id,gcc_no:s.gcc_no,name:s.name})
      if(undoTimer.current)clearTimeout(undoTimer.current)
      undoTimer.current=setTimeout(async()=>{await supabase.from('students').update({undo_pending:false}).eq('id',s.id);setUndoItem(null);setDeletedRow(null);showToast('Record archived',T.amber)},7000)
    }})
  }

  const handleUndo=async()=>{
    if(!deletedRow)return;clearTimeout(undoTimer.current)
    await supabase.from('students').update({deleted_at:null,undo_pending:false}).eq('id',deletedRow.id)
    await auditLog('student_restore',{student_id:deletedRow.id,name:deletedRow.name})
    setStudents(prev=>[deletedRow,...prev].sort((a,b)=>(a.name||'').localeCompare(b.name||'')))
    setUndoItem(null);setDeletedRow(null);showToast('Restored: '+deletedRow.name,T.green)
  }

  const handleRestore=async s=>{
    await supabase.from('students').update({deleted_at:null,undo_pending:false}).eq('id',s.id)
    await auditLog('student_restore',{student_id:s.id,name:s.name})
    setDeleted(prev=>prev.filter(x=>x.id!==s.id));await loadAll();showToast('Restored: '+s.name,T.green)
  }

  // NOTE: handleQuickAttend (inserted into a non-existent "attendance" table)
  // was removed — the card's Attendance button now opens a read-only viewer
  // (AttendanceViewerModal) against the real attendance_records table.
  // Mark actual attendance from the Attendance module itself.

  const toggleSelect=id=>setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const selectAll=()=>setSelected(new Set(paginated.map(s=>s.id)))
  const clearSel=()=>setSelected(new Set())
  const applyPreset=f=>{setSearch(f.q||'');setFilterStatus(f.status||'All');setFilterCourse(f.course||'All');setFilterHostel(f.hostel||'All');setFilterHouse(f.house||'All');setFilterGender(f.gender||'All');setFilterSession(f.session||'All');setFilterBatch(f.batch||'All');setGccMin(f.gccMin||'');setGccMax(f.gccMax||'');setPage(1);setShowPresets(false)}
  const currentFilters={q:search,status:filterStatus,course:filterCourse,hostel:filterHostel,house:filterHouse,gender:filterGender,session:filterSession,batch:filterBatch,gccMin,gccMax}
  const allBatches=['All',...Array.from(new Set(students.map(s=>s.batch).filter(Boolean))).sort()]

  const filtered=students.filter(s=>{
    const q=search.toLowerCase()
    if(q&&![s.name,s.gcc_no,s.batch,s.father_name,s.mother_name,s.phone,s.house].some(v=>v?.toString().toLowerCase().includes(q)))return false
    if(filterStatus!=='All'&&s.status!==filterStatus)return false
    if(filterCourse!=='All'&&s.course!==filterCourse)return false
    if(filterHostel!=='All'&&s.hostel_type!==filterHostel)return false
    if(filterHouse!=='All'&&s.house!==filterHouse)return false
    if(filterGender!=='All'&&s.gender!==filterGender)return false
    if(filterSession!=='All'&&s.session!==filterSession)return false
    if(filterBatch!=='All'&&s.batch!==filterBatch)return false
    if(gccMin&&Number(s.gcc_no)<Number(gccMin))return false
    if(gccMax&&Number(s.gcc_no)>Number(gccMax))return false
    if(ageMin){const a=getAge(s.dob);if(a==null||a<Number(ageMin))return false}
    if(ageMax){const a=getAge(s.dob);if(a==null||a>Number(ageMax))return false}
    return true
  }).sort((a,b)=>(a.name||'').localeCompare(b.name||''))

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))
  const paginated=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)
  const hasFilters=search||filterStatus!=='All'||filterCourse!=='All'||filterHostel!=='All'||filterHouse!=='All'||filterGender!=='All'||filterSession!=='All'||filterBatch!=='All'||gccMin||gccMax
  const clearAllFilters=()=>{setSearch('');setFilterStatus('All');setFilterCourse('All');setFilterHostel('All');setFilterHouse('All');setFilterGender('All');setFilterSession('All');setFilterBatch('All');setGccMin('');setGccMax('');setPage(1)}
  const feeDueCount=Object.values(feeData).filter(v=>v?.dues>0).length
  const longAbsentCount=students.filter(s=>attData[s.id]!=null&&attData[s.id]<50).length

  const KPI_ITEMS=[
    {label:'Total',value:students.length,color:T.text2,icon:'👥'},
    {label:'Active',value:students.filter(s=>s.status==='Active').length,color:T.green,icon:'●',fkey:'status',fval:'Active'},
    {label:'Boarders',value:students.filter(s=>s.hostel_type==='Boarder').length,color:T.green,icon:'🏠',fkey:'hostel',fval:'Boarder'},
    {label:'Day Boarders',value:students.filter(s=>s.hostel_type==='Day Boarder').length,color:T.amber,icon:'🌅',fkey:'hostel',fval:'Day Boarder'},
    {label:'Day Scholars',value:students.filter(s=>s.hostel_type==='Day Scholar').length,color:T.text3,icon:'🏫',fkey:'hostel',fval:'Day Scholar'},
    {label:'Male',value:students.filter(s=>s.gender==='Male').length,color:'#3B82F6',icon:'♂'},
    {label:'Female',value:students.filter(s=>s.gender==='Female').length,color:'#EC4899',icon:'♀'},
    {label:'Birthdays',value:students.filter(s=>isBirthdayToday(s.dob)).length,color:T.orange,icon:'🎂'},
    {label:'Fee Dues',value:feeDueCount,color:T.red,icon:'💰',warn:feeDueCount>0},
    {label:'Low Att.',value:longAbsentCount,color:T.red,icon:'📉',warn:longAbsentCount>0},
  ]

  const EXPORT_ITEMS = [
  {
    label: 'Student List (CSV)',
    fn: () => downloadCSV(filtered.map(s => ({
      GCC: s.gcc_no || '',
      Name: s.name || '',
      Batch: s.batch || '',
      Course: s.course || '',
      House: s.house || '',
      Hostel: s.hostel_type || '',
      Status: s.status || '',
      // PII — only for admin/manager
      ...(can.viewPII ? { Phone: s.phone || '', Father: s.father_name || '' } : {}),
      Admission: s.admission_date || '',
    })), `students_${new Date().toISOString().slice(0,10)}.csv`)
  },
  {
    label: 'Student List (PDF)',
    fn: () => exportToPDF('Student List', [
      {key:'gcc_no', label:'GCC'},
      {key:'name',   label:'Name'},
      {key:'batch',  label:'Batch'},
      {key:'course', label:'Course'},
      {key:'house',  label:'House'},
      {key:'status', label:'Status'},
      // Only show phone column to admin/manager
      ...(can.viewPII ? [{key:'phone', label:'Phone'}] : []),
    ], filtered.map(s => ({...s, gcc_no: 'GCC-' + s.gcc_no})))
  },
  {label:'Print Batch List', fn:()=>printBatchList(
  filtered,
  filterBatch!=='All'?filterBatch:filterCourse!=='All'?filterCourse:'',
  can.viewPII  // ← pass permission
)},
  {label:'Fee Dues (CSV)',   fn:()=>downloadCSV(filtered.filter(s=>feeData[s.id]?.dues>0).map(s=>({GCC:s.gcc_no||'',Name:s.name||'',Dues:feeData[s.id]?.dues||0,...(can.viewPII?{Phone:s.phone||''}:{})})),`fee_dues_${new Date().toISOString().slice(0,10)}.csv`)},
  {label:'Attendance (CSV)', fn:()=>downloadCSV(filtered.map(s=>({GCC:s.gcc_no||'',Name:s.name||'',Batch:s.batch||'',Att:attData[s.id]!=null?`${attData[s.id].toFixed(1)}%`:'—'})),`attendance_${new Date().toISOString().slice(0,10)}.csv`)},
  // Parent contacts — admin/manager only
  ...(can.viewPII ? [{
    label: 'Parent Contacts',
    fn: () => downloadCSV(filtered.map(s=>({Name:s.name||'',Father:s.father_name||'',Mother:s.mother_name||'',Phone:s.phone||'',Address:s.address||''})),`parents_${new Date().toISOString().slice(0,10)}.csv`)
  }] : []),
]

  const ROLE_CFG={admin:{color:T.red,bg:T.redLight,border:T.redBorder},manager:{color:T.amber,bg:T.amberLight,border:T.amberBorder},accounts:{color:T.green,bg:T.greenLight,border:T.greenBorder},teacher:{color:T.sky,bg:T.skyLight,border:T.skyBorder},hostel:{color:T.violet,bg:T.violetLight,border:T.violetBorder},viewer:{color:T.text3,bg:T.surface2,border:T.border}}
  const rc=ROLE_CFG[role]||ROLE_CFG.viewer

  const globalCSS=`
    ${CSS_VARS}
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    @keyframes toastIn{from{transform:translateX(-50%) translateY(12px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
    @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes slideLeft{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes fadeUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes spin{to{transform:rotate(360deg)}}
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    body{background:var(--bg);font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:var(--text1)}
    select,input,textarea{background:var(--surface)!important;color:var(--text1)!important;border-color:var(--border2)!important;font-family:inherit}
    select:focus,input:focus,textarea:focus{border-color:#2563EB!important;outline:none!important;box-shadow:0 0 0 3px rgba(37,99,235,.12)!important}
    select option{background:var(--surface);color:var(--text1)}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}
    ::-webkit-scrollbar-thumb:hover{background:var(--text4)}
  `

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{globalCSS}</style>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {undoItem&&<UndoBanner student={undoItem} onUndo={handleUndo} onDismiss={()=>setUndoItem(null)}/>}
      {confirmModal&&<ConfirmModal title={confirmModal.title} message={confirmModal.message} confirmLabel={confirmModal.confirmLabel} danger={confirmModal.danger} onConfirm={confirmModal.onConfirm} onCancel={()=>setConfirmModal(null)}/>}

      {/* Column picker */}
      {showColPicker&&(
        <Modal onClose={()=>setShowColPicker(false)} width={320} title="Visible Columns">
          {ALL_COLUMNS.map(col=>(
            <label key={col.key} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',cursor:'pointer',borderBottom:`1px solid ${T.border}`,minHeight:44}}>
              <input type="checkbox" checked={effectiveCols.includes(col.key)} onChange={e=>saveCol(e.target.checked?[...visibleCols,col.key]:visibleCols.filter(k=>k!==col.key))} style={{accentColor:T.brand,width:16,height:16}}/>
              <span style={{fontSize:13,fontWeight:600,color:T.text2}}>{col.label}</span>
            </label>
          ))}
          <Btn onClick={()=>setShowColPicker(false)} variant='primary' style={{width:'100%',justifyContent:'center',marginTop:14}}>Done</Btn>
        </Modal>
      )}

      {/* Modals */}
      {detailPanel&&<StudentDetailDrawer student={detailPanel} allStudents={students} attData={attData} examData={examData} feeData={feeData} feeHistory={feeHistory} can={can} onClose={()=>setDetailPanel(null)} onEdit={s=>{setEditing(s);setFormOpen(true);setDetailPanel(null)}} showToast={showToast}/>}
      {feePanel&&<FeeCollectionModal app={feePanel} isAdmin={can.write} currentUser={user} onClose={()=>setFeePanel(null)} onSaved={()=>{setFeePanel(null);loadAll();showToast('Payment recorded!',T.green)}}/>}
      {examEntry&&<ExamScoreModal student={examEntry} can={can} onClose={()=>setExamEntry(null)} onSaved={()=>{setExamEntry(null);loadExamData(students.map(s=>s.id))}} showToast={showToast}/>}
      {attViewer&&<AttendanceViewerModal student={attViewer} onClose={()=>setAttViewer(null)}/>}
      {examViewer&&<ExamViewerModal student={examViewer} onClose={()=>setExamViewer(null)}/>}
      {feeViewer&&<FeeViewerModal student={feeViewer} feeData={feeData} feeHistory={feeHistory} onClose={()=>setFeeViewer(null)}/>}
      {showBulkOps&&<BulkOperationsModal students={students} selectedIds={selected} can={can} onClose={()=>setShowBulkOps(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showRollover&&<SessionRolloverWizard students={students} can={can} onClose={()=>setShowRollover(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showBulkFee&&<BulkFeeModal students={students} selectedIds={selected} can={can} onClose={()=>setShowBulkFee(false)} onSaved={loadAll} showToast={showToast}/>}
      {showHouseReassign&&<HouseReassignmentModal students={students} selectedIds={selected} can={can} onClose={()=>setShowHouseReassign(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showMergeDups&&<MergeDuplicatesModal students={students} can={can} onClose={()=>setShowMergeDups(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showReportGen&&<ReportGeneratorModal students={students} feeData={feeData} attData={attData} examData={examData} houseOptions={houseOptions} can={can} role={role} onClose={()=>setShowReportGen(false)} showToast={showToast}/>}

      {/* NOTE: legacy "Quick Attendance" modal removed — it wrote to a
          non-existent "attendance" table and was no longer reachable from
          any button. Mark attendance from the Attendance module itself;
          the card's Attendance button now opens a read-only viewer. */}

      {/* Mobile export bottom sheet */}
      {showExportMenu&&isMobile&&(
        <>
          <div style={{position:'fixed',inset:0,zIndex:99996,background:'rgba(15,23,42,.4)'}} onClick={()=>setShowExportMenu(false)}/>
          <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:99997,background:T.surface,borderTop:`1px solid ${T.border}`,borderRadius:`${T.r20} ${T.r20} 0 0`,padding:'16px 16px 32px',animation:'slideUp .2s ease'}}>
            <div style={{width:32,height:3,background:T.border2,borderRadius:2,margin:'0 auto 14px',opacity:.6}}/>
            <div style={{fontWeight:700,fontSize:14,color:T.text1,marginBottom:12}}>Export</div>
            {EXPORT_ITEMS.map(item=>(
              <button key={item.label} onClick={()=>{item.fn();setShowExportMenu(false)}} style={{width:'100%',padding:'13px 16px',border:'none',borderBottom:`1px solid ${T.border}`,background:'none',textAlign:'left',fontSize:13,fontWeight:500,cursor:'pointer',color:T.text2,fontFamily:'inherit'}}>
                {item.label}
              </button>
            ))}
            <Btn onClick={()=>setShowExportMenu(false)} style={{width:'100%',justifyContent:'center',marginTop:12}}>Close</Btn>
          </div>
        </>
      )}

      {/* ─── Main Page ─── */}
      <div style={{
        padding:isMobile?'0 12px 80px':'0 24px 48px',
        background:T.bg, minHeight:'100vh', color:T.text1,
        fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",
      }}>

        {/* Page header */}
        <div style={{
          padding:isMobile?'16px 0 14px':'28px 0 20px',
          borderBottom:`1px solid ${T.border}`, marginBottom:16,
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          flexWrap:'wrap', gap:12,
        }}>
          <div>
            <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.16em',color:T.text4,marginBottom:6}}>GNSI · Student Registry</div>
            <h1 style={{fontSize:isMobile?22:28,fontWeight:800,color:T.text1,letterSpacing:'-.04em',lineHeight:1,margin:0}}>Students</h1>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:8,flexWrap:'wrap'}}>
              <span style={{fontSize:13,color:T.text3}}>
                {loading?'Loading…':<><strong style={{color:T.text1}}>{filtered.length}</strong> / {students.length} students</>}
              </span>
              <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:T.r24,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:rc.color,background:rc.bg,border:`1px solid ${rc.border}`}}>
                {role}
              </span>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <Btn onClick={loadAll} size='sm'><SIcon.refresh size={14}/> Refresh</Btn>
            <IfCan can={can.write}>
              <Btn onClick={()=>{setEditing(null);setFormOpen(true)}} variant='primary'><SIcon.plus size={14}/> {isMobile?'Add':'New Student'}</Btn>
            </IfCan>
          </div>
        </div>

        {/* Page-level tabs — Dashboard / Students / Data Quality */}
        <div style={{display:'flex',gap:2,marginBottom:22,borderBottom:`1px solid ${T.border}`}}>
          {[{key:'dashboard',label:'Dashboard',icon:SIcon.home},{key:'students',label:'Students',icon:SIcon.users},{key:'dataQuality',label:'Data Quality',icon:SIcon.check}].map(t=>{
            const active=pageTab===t.key
            return (
              <button key={t.key} onClick={()=>setPageTab(t.key)} style={{
                display:'flex', alignItems:'center', gap:7,
                padding:'11px 16px', border:'none', background:'none', cursor:'pointer',
                fontSize:13.5, fontWeight:600, fontFamily:'inherit',
                color:active?T.brand:T.text3,
                borderBottom:`2px solid ${active?T.brand:'transparent'}`,
                marginBottom:-1, transition:'color .12s, border-color .12s',
              }}>
                <t.icon size={15}/>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Action Toolbar */}
        {pageTab==='students'&&(
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16,overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:isMobile?4:0}}>
          <IfCan can={can.export}>
            <div style={{position:'relative'}} ref={exportMenuRef}>
              <Btn onClick={()=>setShowExportMenu(v=>!v)} size='sm'><SIcon.download size={14}/> Export</Btn>
              {showExportMenu&&!isMobile&&(
                <div style={{position:'absolute',left:0,top:'110%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.r10,boxShadow:T.shadow2,zIndex:9999,minWidth:210,overflow:'hidden'}}>
                  {EXPORT_ITEMS.map(item=>(
                    <button key={item.label} onClick={()=>{item.fn();setShowExportMenu(false)}} style={{width:'100%',padding:'10px 16px',border:'none',background:'none',textAlign:'left',fontSize:13,fontWeight:500,cursor:'pointer',color:T.text2,borderBottom:`1px solid ${T.border}`,fontFamily:'inherit'}} onMouseEnter={e=>e.currentTarget.style.background=T.surface2} onMouseLeave={e=>e.currentTarget.style.background='none'}>{item.label}</button>
                  ))}
                </div>
              )}
            </div>
          </IfCan>
          <IfCan can={can.export}>
            <Btn onClick={()=>setShowReportGen(true)} size='sm' style={{color:T.violet,borderColor:T.violetBorder}}><SIcon.fileText size={14}/> Reports</Btn>
          </IfCan>
          <Btn onClick={()=>setShowDeleted(v=>!v)} size='sm' style={{color:showDeleted?T.red:T.text2,background:showDeleted?T.redLight:'transparent',borderColor:showDeleted?T.redBorder:T.border}}><SIcon.archive size={14}/> Archive{deleted.length>0?` (${deleted.length})`:''}</Btn>
          <IfCan can={can.write}>
            <Btn onClick={()=>setShowMergeDups(true)} size='sm' style={{color:T.red,borderColor:T.redBorder}}><SIcon.merge size={14}/> Merge</Btn>
            <Btn onClick={()=>setShowRollover(true)} size='sm' style={{color:T.brand,borderColor:T.brandBorder}}><SIcon.rotate size={14}/> Rollover</Btn>
          </IfCan>
        </div>
        )}

        {pageTab==='dashboard'&&(
          <StudentDashboard
            students={students}
            attData={attData}
            examData={examData}
            feeData={feeData}
            onOpenDetail={setDetailPanel}
            onOpenFee={setFeePanel}
            onNavigate={setPageTab}
          />
        )}

        {pageTab==='dataQuality'&&(
          <DataQualityTab students={students} can={can} onQuickSave={handleQuickSave}/>
        )}

        {pageTab==='students'&&(<>
        {/* Archive panel */}
        {showDeleted&&(
          <Card style={{marginBottom:16,border:`1px solid ${T.redBorder}`}}>
            <div style={{padding:'14px 16px',borderBottom:`1px solid ${T.redBorder}`,background:T.redLight}}>
              <div style={{fontWeight:700,color:T.red,fontSize:13,textTransform:'uppercase',letterSpacing:'.08em'}}>Archive ({deleted.length})</div>
            </div>
            <div style={{padding:'12px 16px'}}>
              {deleted.length===0?<div style={{color:T.text4,fontSize:13}}>No archived records.</div>
              :deleted.map(s=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${T.border}`,flexWrap:'wrap'}}>
                  <Avatar name={s.name} size={30}/>
                  <div style={{flex:1,minWidth:100}}>
                    <div style={{fontWeight:600,fontSize:13,color:T.text2}}>{s.name}</div>
                    <div style={{fontSize:11,color:T.text4}}>GCC-{s.gcc_no} · Archived {fmtD(s.deleted_at)}</div>
                  </div>
                  <Btn onClick={()=>handleRestore(s)} variant='success' size='sm'>↩ Restore</Btn>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* KPI Strip */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
          {KPI_ITEMS.map(k=>(
            <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} warn={k.warn} icon={k.icon}
              active={k.fkey==='hostel'?filterHostel===k.fval:k.fkey==='status'?filterStatus===k.fval:false}
              onClick={k.fkey?()=>{if(k.fkey==='hostel'){setFilterHostel(f=>f===k.fval?'All':k.fval);setPage(1)}if(k.fkey==='status'){setFilterStatus(f=>f===k.fval?'All':k.fval);setPage(1)}}:undefined}
            />
          ))}
        </div>

        {/* Form */}
        {formOpen&&can.write&&<StudentForm onSave={handleSave} onCancel={()=>{setFormOpen(false);setEditing(null)}} editing={editing} allStudents={students}/>}

        {/* Selection bar */}
        {selected.size>0&&(
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:T.brandLight,border:`1px solid ${T.brandBorder}`,borderRadius:T.r10,marginBottom:12,flexWrap:'wrap'}}>
            <span style={{fontSize:13,fontWeight:700,color:T.brand}}>{selected.size} selected</span>
            <div style={{flex:1}}/>
            <IfCan can={can.write}>
              <Btn onClick={()=>setShowBulkOps(true)} variant='primary' size='sm'>Bulk Actions</Btn>
              <Btn onClick={()=>setShowHouseReassign(true)} size='sm' style={{color:T.violet,borderColor:T.violetBorder}}>Reassign House</Btn>
            </IfCan>
            <IfCan can={can.fees}>
              <Btn onClick={()=>setShowBulkFee(true)} variant='success' size='sm'>Bulk Fee</Btn>
            </IfCan>
            <button onClick={clearSel} style={{width:28,height:28,borderRadius:T.r6,border:`1px solid ${T.border}`,background:T.surface,cursor:'pointer',fontSize:14,color:T.text3,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
          </div>
        )}

        {/* Sticky filter bar */}
        <div style={{position:'sticky',top:0,zIndex:100,background:T.bg,paddingTop:8,paddingBottom:8,borderBottom:`1px solid ${T.border}`,marginBottom:12}}>
          {/* Presets row */}
          <div style={{display:'flex',gap:6,marginBottom:8,overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:2,alignItems:'center'}}>
            <Btn onClick={()=>setShowPresets(v=>!v)} size='sm' style={{flexShrink:0,fontSize:11}}>⭐ Presets{presets.length?` (${presets.length})`:''}</Btn>
            {showPresets&&(
              <>
                {presets.map(p=>(
                  <span key={p.name} style={{display:'inline-flex',alignItems:'center',gap:2,flexShrink:0}}>
                    <Btn onClick={()=>applyPreset(p.filters)} size='sm' style={{fontSize:11}}>{p.name}</Btn>
                    <button onClick={()=>removePreset(p.name)} style={{background:'none',border:'none',cursor:'pointer',color:T.red,fontSize:14,padding:'0 3px',lineHeight:1}}>×</button>
                  </span>
                ))}
                {presets.length<MAX_PRESETS&&(
                  <>
                    <input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Name…" style={{width:90,padding:'4px 8px',borderRadius:T.r6,border:`1px solid ${T.border2}`,fontSize:12,background:T.surface,color:T.text1,fontFamily:'inherit',height:28,flexShrink:0}}/>
                    <Btn onClick={()=>{if(presetName.trim()){savePreset(presetName.trim(),currentFilters);setPresetName('');setShowPresets(false);showToast('Preset saved',T.brand)}}} size='sm' variant='primary' style={{fontSize:11,flexShrink:0}}>Save</Btn>
                  </>
                )}
              </>
            )}
            <Btn onClick={selectAll} size='sm' style={{flexShrink:0,fontSize:11}}>☑ Select Page</Btn>
            {selected.size>0&&<Btn onClick={clearSel} size='sm' style={{flexShrink:0,fontSize:11,color:T.red,borderColor:T.redBorder}}>✕ ({selected.size})</Btn>}
          </div>

          {/* Filters */}
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
            <div style={{display:'flex',gap:6,alignItems:'center',minWidth:isMobile?'max-content':'auto'}}>
              {/* Search */}
              <div style={{position:'relative',minWidth:180,flex:isMobile?'0 0 180px':1}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:T.text4,fontSize:14,pointerEvents:'none'}}>⌕</span>
                <input ref={searchRef} value={search}
                  onChange={e=>{setSearch(e.target.value);setPage(1)}}
                  onFocus={()=>setShowRecents(true)}
                  onBlur={()=>setTimeout(()=>setShowRecents(false),150)}
                  onKeyDown={e=>{if(e.key==='Enter'&&search.trim()){addSearch(search.trim());setShowRecents(false)}}}
                  placeholder={isMobile?'Search…':'Name, GCC, phone… (⌘K)'}
                  style={{width:'100%',paddingLeft:30,paddingRight:10,height:36,borderRadius:T.r8,border:`1px solid ${T.border2}`,fontSize:13,background:T.surface,color:T.text1,fontFamily:'inherit',outline:'none'}}
                />
                {showRecents&&recentSearches.length>0&&(
                  <div style={{position:'absolute',top:'110%',left:0,right:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.r8,boxShadow:T.shadow2,zIndex:999,overflow:'hidden',minWidth:200}}>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'6px 12px',borderBottom:`1px solid ${T.border}`}}>
                      <span style={{fontSize:10,fontWeight:600,color:T.text4,textTransform:'uppercase',letterSpacing:'.08em'}}>Recent</span>
                      <button onMouseDown={clearSearches} style={{background:'none',border:'none',fontSize:11,color:T.red,cursor:'pointer',fontWeight:600}}>Clear</button>
                    </div>
                    {recentSearches.map(q=>(
                      <button key={q} onMouseDown={()=>{setSearch(q);setShowRecents(false)}} style={{width:'100%',padding:'9px 12px',border:'none',background:'none',textAlign:'left',fontSize:13,cursor:'pointer',color:T.text2,fontFamily:'inherit'}} onMouseEnter={e=>e.currentTarget.style.background=T.surface2} onMouseLeave={e=>e.currentTarget.style.background='none'}>🕐 {q}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter dropdowns */}
              {[
                {val:filterStatus,set:v=>{setFilterStatus(v);setPage(1)},opts:STATUSES,label:'Status'},
                {val:filterCourse,set:v=>{setFilterCourse(v);setPage(1)},opts:COURSES,label:'Course'},
                {val:filterHostel,set:v=>{setFilterHostel(v);setPage(1)},opts:HOSTEL_TYPES,label:'Hostel'},
                {val:filterGender,set:v=>{setFilterGender(v);setPage(1)},opts:GENDERS,label:'Gender'},
                {val:filterSession,set:v=>{setFilterSession(v);setPage(1)},opts:['All',...SESSIONS],label:'Session'},
                {val:filterBatch,set:v=>{setFilterBatch(v);setPage(1)},opts:allBatches,label:'Batch'},
              ].map(f=>(
                <select key={f.label} value={f.val} onChange={e=>f.set(e.target.value)} style={{padding:'7px 8px',borderRadius:T.r8,border:`1px solid ${f.val!=='All'?T.brand:T.border2}`,fontSize:12,background:f.val!=='All'?T.brandLight:T.surface,color:f.val!=='All'?T.brand:T.text1,cursor:'pointer',height:36,fontFamily:'inherit',flexShrink:0}}>
                  {f.opts.map(o=><option key={o}>{o}</option>)}
                </select>
              ))}

              {hasFilters&&<Btn onClick={clearAllFilters} size='sm' style={{color:T.red,borderColor:T.redBorder,flexShrink:0}}>✕ Clear</Btn>}
              <span style={{fontSize:12,color:T.text4,whiteSpace:'nowrap',flexShrink:0}}>{filtered.length}/{students.length}</span>
            </div>
          </div>

          {/* House pills */}
          <div style={{marginTop:6}}>
            <button onClick={()=>setShowHousePills(v=>!v)} style={{fontSize:10,fontWeight:600,color:T.text4,background:'none',border:'none',cursor:'pointer',padding:'2px 0',letterSpacing:'.05em',marginBottom:showHousePills?6:0}}>
              {showHousePills?'▲':'▼'} Filter by House
            </button>
            {showHousePills&&(
              <div style={{display:'flex',gap:5,flexWrap:'nowrap',overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:4}}>
                <button onClick={()=>{setFilterHouse('All');setPage(1)}} style={{padding:'4px 12px',borderRadius:T.r24,border:`1.5px solid ${filterHouse==='All'?T.text1:T.border}`,background:filterHouse==='All'?T.surface2:'transparent',color:filterHouse==='All'?T.text1:T.text3,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontFamily:'inherit'}}>All</button>
                {houseOptions.map(h=>{const c=HOUSE_COLORS[h]||T.text3,active=filterHouse===h;return(
                  <button key={h} onClick={()=>{setFilterHouse(f=>f===h?'All':h);setPage(1)}} style={{padding:'4px 12px',borderRadius:T.r24,border:`1.5px solid ${active?c:`${c}40`}`,background:active?`${c}12`:'transparent',color:active?c:`${c}80`,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontFamily:'inherit'}}>
                    {h} <span style={{opacity:.6,fontSize:10}}>({students.filter(s=>s.house===h).length})</span>
                  </button>
                )})}
              </div>
            )}
          </div>
        </div>

        {/* Student List */}
        {loading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'40vh',gap:14,color:T.text3}}>
            <div style={{width:20,height:20,border:`2.5px solid ${T.border2}`,borderTopColor:T.brand,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
            <span style={{fontWeight:600,fontSize:14}}>Loading students…</span>
          </div>
        ):filtered.length===0?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',textAlign:'center'}}>
            <div style={{width:64,height:64,borderRadius:T.r16,background:T.surface2,border:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,marginBottom:14}}>🎓</div>
            <div style={{fontSize:16,fontWeight:700,color:T.text2,marginBottom:6}}>{students.length===0?'No students yet':'No results'}</div>
            <p style={{fontSize:13,color:T.text3,maxWidth:'30ch',lineHeight:1.7,margin:'0 0 20px'}}>{students.length===0?'Click "+ New Student" to add the first student.':'Try adjusting your search or filters.'}</p>
            {can.write&&students.length===0&&<Btn onClick={()=>{setEditing(null);setFormOpen(true)}} variant='primary'>+ New Student</Btn>}
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
            {paginated.map(s=>(
              <StudentCard key={s.id} s={s} can={can}
                onEdit={st=>{setEditing(st);setFormOpen(true)}}
                onDelete={handleDelete} onOpenFee={setFeeViewer}
                onOpenDetail={setDetailPanel} onQuickAttend={setAttViewer}
                onExamEntry={setExamViewer} onClone={handleClone}
                feeData={feeData} attData={attData} examData={examData}
                selected={selected} onSelect={toggleSelect}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading&&filtered.length>PAGE_SIZE&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:20,flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:12,color:T.text4}}>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
            <div style={{display:'flex',gap:4}}>
              <Btn onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} size='sm'>←</Btn>
              {Array.from({length:Math.min(isMobile?3:5,totalPages)},(_,i)=>{
                const p=totalPages<=5?i+1:Math.max(1,Math.min(page-2,totalPages-4))+i
                return <button key={p} onClick={()=>setPage(p)} style={{width:32,height:32,borderRadius:T.r8,border:`1px solid ${page===p?T.brand:T.border}`,fontSize:12,fontWeight:600,cursor:'pointer',background:page===p?T.brand:T.surface,color:page===p?'#fff':T.text3,transition:'all .12s',fontFamily:'inherit'}}>{p}</button>
              })}
              <Btn onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} size='sm'>→</Btn>
            </div>
          </div>
        )}
        </>)}
      </div>
    </>
  )
}