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
import { promoteToStudent, getFlatFeeAmt } from './feeEngine'
import { useActiveSession } from './shared/useActiveSession'

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
// Feature 79: House capacities
const HOUSE_CAPACITIES = {
  'Kombirei':40,'Shiroi':40,'Loktak':40,'Singgarei':40,'Koubru':40,
  'Kangla':40,'Sangai':40,'Takhelei':40,'Block-B':30,'Day Scholar':999,
}
const WARDEN_CONTACTS = {
  'Kombirei':  { name:'Mr. Tomba Singh',    phone:'9876500001' },
  'Shiroi':    { name:'Mr. Ranjit Sharma',  phone:'9876500002' },
  'Loktak':    { name:'Mr. Ibomcha Meitei', phone:'9876500003' },
  'Singgarei': { name:'Mrs. Sushila Devi',  phone:'9876500004' },
  'Koubru':    { name:'Mr. Somorjit Singh', phone:'9876500005' },
  'Kangla':    { name:'Mr. Praveen Kumar',  phone:'9876500006' },
  'Sangai':    { name:'Mrs. Bimola Devi',   phone:'9876500007' },
  'Takhelei':  { name:'Mr. Hemanta Singh',  phone:'9876500008' },
  'Block-B':   { name:'Mr. James Haokip',   phone:'9876500009' },
}

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

// Feature 95: auto-save draft key
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

// Feature 41: WhatsApp message builder
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
    // audit log, notes, house_log stored in parallel tables, loaded separately
    notes:            [],
    auditLog:         [],
    houseLog:         [],
  }
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────
const sbApps = {
  fetch: async () => {
    const { data, error } = await supabase
      .from('admissions')
      .select('*')
      .order('gcc_no', { ascending: false })
    if (error) { console.error('fetch admissions:', error); return null }
    return data.map(mapFromDB)
  },
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  inp: {
    width:'100%', padding:'9px 12px', borderRadius:8,
    border:`1.5px solid ${T.slate[200]}`, fontSize:13,
    outline:'none', boxSizing:'border-box', backgroundColor:'#fff',
    color:T.slate[800], fontFamily:'system-ui,sans-serif',
    transition:'border-color .15s',
  },
  label: {
    display:'block', fontSize:11, fontWeight:700, color:T.slate[500],
    marginBottom:5, textTransform:'uppercase', letterSpacing:'.07em',
  },
}

// ─── FEATURE 93: Keyboard Shortcuts Hook ──────────────────────────────────────
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

// ─── FEATURE 97: Virtual Scroll (simple windowing) ────────────────────────────
function useVirtualList(items, rowHeight = 110, overscan = 5) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerH, setContainerH] = useState(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setContainerH(e.contentRect.height))
    ro.observe(el)
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive:true })
    return () => { ro.disconnect(); el.removeEventListener('scroll', onScroll) }
  }, [])

  const totalH  = items.length * rowHeight
  const startIdx= Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const endIdx  = Math.min(items.length - 1, Math.ceil((scrollTop + containerH) / rowHeight) + overscan)
  const visible  = items.slice(startIdx, endIdx + 1)
  const offsetY  = startIdx * rowHeight

  return { containerRef, visible, totalH, offsetY, startIdx }
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
    <div onClick={onClick} style={{ flex:1, minWidth:80, padding:'12px 14px', borderRadius:10, background:active?accent+'18':'#fff', border:`1.5px solid ${active?accent:T.slate[200]}`, cursor:'pointer', transition:'all .15s' }}>
      <div style={{ fontSize:22, fontWeight:800, color:active?accent:T.slate[800], lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:10, fontWeight:700, color:active?accent:T.slate[500], marginTop:4, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
      {subtitle && <div style={{ fontSize:10, color:T.slate[400], marginTop:2 }}>{subtitle}</div>}
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
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
      <span style={{ fontSize:11, fontWeight:700, color:T.slate[400], textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{label}</span>
      {['All', ...options].map(opt => {
        const active = value === opt
        const accent = colorFn ? colorFn(opt) : T.indigo[600]
        const count  = countFn ? countFn(opt) : null
        return (
          <button key={opt} onClick={() => onChange(active ? 'All' : opt)}
            style={{ padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', border:`1.5px solid ${active?accent:T.slate[200]}`, background:active?accent+'18':'#fff', color:active?accent:T.slate[500], transition:'all .12s', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
            {opt}
            {count !== null && opt !== 'All' && <span style={{ fontSize:10, background:active?accent+'30':T.slate[100], color:active?accent:T.slate[400], borderRadius:99, padding:'0 5px', fontWeight:700 }}>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── FEATURE 23-34: Mini Analytics Dashboard ──────────────────────────────────
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

  // Feature 23: Funnel
  const total   = apps.length
  const byStatus = {}
  ADM_STATUSES.forEach(s => byStatus[s] = apps.filter(a=>a.status===s).length)

  // Feature 24: Course bar
  const byCourse = {}
  Object.keys(COURSE_STRUCTURE).forEach(c => byCourse[c] = apps.filter(a=>a.course===c).length)

  // Feature 26: Hostel pie (simplified bar)
  const byHostel = {}
  HOSTEL_TYPES.forEach(h => byHostel[h] = apps.filter(a=>a.hostel_type===h).length)

  // Feature 27: Gender
  const byGender = { Male:0, Female:0, Other:0 }
  apps.forEach(a => { if (a.gender && byGender[a.gender] !== undefined) byGender[a.gender]++ })

  // Feature 28: Category
  const byCat = {}
  CATEGORIES.filter(c=>c!=='--').forEach(c => byCat[c] = apps.filter(a=>a.category===c).length)

  // Feature 30: Conversion rates
  const admittedRate = byStatus['Applied'] > 0
    ? Math.round((byStatus['Admitted']+byStatus['Enrolled']) / total * 100) : 0
  const enrollRate = (byStatus['Admitted']+byStatus['Enrolled']) > 0
    ? Math.round(byStatus['Enrolled'] / (byStatus['Admitted']+byStatus['Enrolled']) * 100) : 0

  // Feature 31: Revenue forecast
  const monthsLeft = 8
  const revenueMonthly = apps.filter(a=>a.status==='Enrolled').reduce((s,a) => s + getFlatFeeAmt(a.hostel_type), 0)
  const revForecast = revenueMonthly * monthsLeft

  // Feature 29: Daily intake (last 7 days)
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
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap:14, marginBottom:16 }}>     {card('Admission Funnel', <>
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

// ─── FEATURE 71: Expandable Detail Panel ──────────────────────────────────────
function DetailPanel({ a, onClose, onAddNote, darkMode }) {
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

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
        {/* Personal */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:T.slate[400], textTransform:'uppercase', marginBottom:8 }}>Personal</div>
          {[['Religion', a.religion],['Mother Tongue',a.motherTongue],['DOB',dateFmt(a.dob)],['Blood',a.blood],['Gender',a.gender],['Category',a.category],['Quota',a.quota],['Disability',a.disabilityFlag?'Yes':'No']].map(([k,v])=>v&&v!=='--'&&(
            <div key={k} style={{ fontSize:12, color:T.slate[600], marginBottom:4 }}><span style={{ fontWeight:700, color:T.slate[500] }}>{k}:</span> {v}</div>
          ))}
        </div>

        {/* Academic */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:T.slate[400], textTransform:'uppercase', marginBottom:8 }}>Academic & Hostel</div>
          {[['Entrance Score',a.entranceScore],['Interview Score',a.interviewScore],['Interview Date',dateFmt(a.interviewDate)],['House',a.house],['Bed No.',a.bedNumber],['Hostel Type',a.hostel_type],['Instalment',a.instalmentPlan],['Sibling GCC',a.siblingGcc]].map(([k,v])=>v&&(
            <div key={k} style={{ fontSize:12, color:T.slate[600], marginBottom:4 }}><span style={{ fontWeight:700, color:T.slate[500] }}>{k}:</span> {v}</div>
          ))}
        </div>

        {/* Financial */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:T.slate[400], textTransform:'uppercase', marginBottom:8 }}>Financial</div>
          {[['Scholarship',a.scholarshipPct?`${a.scholarshipPct}%`:'—'],['Concession',a.concessionAmt?`₹${fmt(a.concessionAmt)}`:'—'],['Security Dep.',a.securityDeposit?`₹${fmt(a.securityDeposit)}`:'—'],['Transport Fee',a.transportFee?`₹${fmt(a.transportFee)}/mo`:'—'],['Base Fee',`₹${fmt(getFlatFeeAmt(a.hostel_type))}/mo`]].map(([k,v])=>(
            <div key={k} style={{ fontSize:12, color:T.slate[600], marginBottom:4 }}><span style={{ fontWeight:700, color:T.slate[500] }}>{k}:</span> {v}</div>
          ))}
          {a.scholarshipPct > 0 && (
            <div style={{ marginTop:6, padding:'6px 10px', borderRadius:7, background:T.emerald[50], border:`1px solid ${T.emerald[200]}`, fontSize:11, fontWeight:700, color:T.emerald[700] }}>
              Effective fee: ₹{fmt(Math.round(getFlatFeeAmt(a.hostel_type) * (1 - a.scholarshipPct/100)))}/mo
            </div>
          )}
        </div>
      </div>

      {/* Feature 73: Activity Timeline */}
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

      {/* Feature 74: Document status dots */}
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

      {/* Feature 51: Notes log */}
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

      {/* Feature 82: Warden contact */}
      {a.house && WARDEN_CONTACTS[a.house] && (
        <>
          <SectionDivider label="Warden Contact" />
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:T.sky[50], border:`1px solid ${T.sky[100]}`, borderRadius:8 }}>
            <span style={{ fontSize:20 }}>👤</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.sky[700] }}>{WARDEN_CONTACTS[a.house].name}</div>
              <div style={{ fontSize:11, color:T.sky[600] }}>{a.house} House Warden · {WARDEN_CONTACTS[a.house].phone}</div>
            </div>
            <a href={`tel:${WARDEN_CONTACTS[a.house].phone}`} style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:7, background:T.sky[500], color:'#fff', fontSize:11, fontWeight:700, textDecoration:'none' }}>Call</a>
          </div>
        </>
      )}

      {/* Feature 50: Emergency contact */}
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

// ─── FEATURE 72: Quick-Edit Inline ────────────────────────────────────────────
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

// ─── FEATURE 63: Advanced Search Drawer ───────────────────────────────────────
function AdvancedSearch({ filters, onChange, onClose, apps }) {
  const [f, setF] = useState(filters)
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  return (
    <div style={{ background:'#fff', border:`1.5px solid ${T.indigo[200]}`, borderRadius:12, padding:'18px 20px', marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.indigo[700] }}>🔎 Advanced Search</div>
        <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${T.slate[200]}`, background:'#fff', cursor:'pointer', fontSize:14 }}>✕</button>
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
      <div style={{ display:'flex', gap:10, marginTop:14 }}>
        <button onClick={() => onChange(f)}
          style={{ padding:'9px 20px', borderRadius:9, background:`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer' }}>Apply Filters</button>
        <button onClick={() => { const empty={}; setF(empty); onChange(empty) }}
          style={{ padding:'9px 16px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:T.slate[600] }}>Reset</button>
      </div>
    </div>
  )
}

// ─── FEATURE 45: WhatsApp Blast Modal ─────────────────────────────────────────
function WABlastModal({ apps, onClose }) {
  const [template, setTemplate] = useState('admission')
  const [preview,  setPreview]  = useState(null)

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
          Will open {apps.length} WhatsApp chat(s). Browsers may block popups after the first.
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

// ─── FEATURE 38-40: Print/PDF helpers (browser print) ─────────────────────────
function printAdmitCard(a) {
  const win = window.open('','_blank','width=600,height=700')
  const fee = getFlatFeeAmt(a.hostel_type)
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
function AdmForm({ onSave, onCancel, editing, activeSession, role }) {
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
      // Feature 94: auto-save draft
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

  // Feature 3: duplicate GCC check
  const [gccDup, setGccDup] = useState(false)
  useEffect(() => {
    if (!form.gcc || editing) { setGccDup(false); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('admissions').select('gcc_no').eq('gcc_no', parseInt(form.gcc))
      setGccDup(!!(data && data.length > 0))
    }, 500)
    return () => clearTimeout(timer)
  }, [form.gcc, editing])

  const derivedHostelType = deriveHostelType(form.house, form.hostel_type)
  const hs       = HOSTEL_STYLES[derivedHostelType] || HOSTEL_STYLES['Day Scholar']
  const baseRate = getFlatFeeAmt(derivedHostelType)
  const discRate = form.scholarshipPct > 0 ? Math.round(baseRate*(1-form.scholarshipPct/100)) : baseRate
  const warden   = WARDEN_CONTACTS[form.house]

  // Feature 93: unsaved warning
  const [dirty, setDirty] = useState(false)
  useEffect(() => setDirty(true), [form])

  const handleCancel = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    try { localStorage.removeItem(DRAFT_KEY) } catch(_) {}
    onCancel()
  }

  return (
    <div style={{ background:'#fff', border:`1.5px solid ${T.violet[200]}`, borderRadius:14, overflow:'hidden', marginBottom:16 }}>
      <div style={{ background:T.violet[50], borderBottom:`1px solid ${T.violet[200]}`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:T.violet[700] }}>{editing ? '✏️ Edit Application' : '➕ New Application'}</div>
          {activeSession && !editing && (
            <div style={{ fontSize:12, fontWeight:700, marginTop:3, color:activeSession.is_locked?T.rose[600]:T.emerald[600] }}>
              📅 Session: {activeSession.session_name}{activeSession.is_locked && ' · 🔒 Locked'}
            </div>
          )}
        </div>
        <button onClick={handleCancel} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${T.violet[200]}`, background:'#fff', cursor:'pointer', fontSize:16, color:T.slate[500] }}>✕</button>
      </div>

      <div style={{ padding:'20px' }}>
        {/* Feature 1: Photo upload */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, padding:'12px 14px', background:T.slate[50], borderRadius:10, border:`1px solid ${T.slate[200]}` }}>
          <Avatar name={form.name} size={56} photoUrl={form.photoUrl} />
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:T.slate[600], marginBottom:4 }}>Passport Photo URL</div>
            <input style={{ ...styles.inp, width:280 }} value={form.photoUrl} onChange={e=>set('photoUrl',e.target.value)} placeholder="https://… or Supabase Storage URL" />
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
          {/* Feature 5: Religion */}
          <FieldRow label="Religion">
            <select style={styles.inp} value={form.religion} onChange={e=>set('religion',e.target.value)}>
              {RELIGIONS.map(r=><option key={r}>{r}</option>)}
            </select>
          </FieldRow>
          {/* Feature 6: Mother tongue */}
          <FieldRow label="Mother Tongue">
            <select style={styles.inp} value={form.motherTongue} onChange={e=>set('motherTongue',e.target.value)}>
              {MOTHER_TONGUES.map(m=><option key={m}>{m}</option>)}
            </select>
          </FieldRow>
          {/* Feature 11: Quota */}
          <FieldRow label="Quota Type">
            <select style={styles.inp} value={form.quota} onChange={e=>set('quota',e.target.value)}>
              {QUOTA_TYPES.map(q=><option key={q}>{q}</option>)}
            </select>
          </FieldRow>
          {/* Feature 10: Referral */}
          <FieldRow label="Referral Source">
            <select style={styles.inp} value={form.referral} onChange={e=>set('referral',e.target.value)}>
              {REFERRAL_SOURCES.map(r=><option key={r}>{r}</option>)}
            </select>
          </FieldRow>
          {/* Feature 7: Disability */}
          <FieldRow label="Disability / Special Needs">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4 }}>
              <input type="checkbox" checked={form.disabilityFlag} onChange={e=>set('disabilityFlag',e.target.checked)} id="disCheck" style={{ width:16, height:16, cursor:'pointer' }} />
              <label htmlFor="disCheck" style={{ fontSize:13, color:T.slate[700], cursor:'pointer' }}>Yes</label>
              {form.disabilityFlag && <input style={{ ...styles.inp, flex:1 }} value={form.disabilityNotes} onChange={e=>set('disabilityNotes',e.target.value)} placeholder="Describe…" />}
            </div>
          </FieldRow>
          {/* Feature 2: Sibling GCC */}
          <FieldRow label="Sibling GCC No.">
            <input style={styles.inp} value={form.siblingGcc} onChange={e=>set('siblingGcc',e.target.value)} placeholder="If sibling enrolled at GNSI" type="number" />
          </FieldRow>
        </div>

        <SectionDivider label="Course & Class" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:4 }}>
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
          </FieldRow>
          <FieldRow label={`Hostel Type${form.house?'':''}`}>
            <select style={{ ...styles.inp, background:form.house&&DAY_SCHOLAR_HOUSES.includes(form.house)?T.slate[50]:'#fff', color:form.house&&DAY_SCHOLAR_HOUSES.includes(form.house)?T.slate[400]:T.slate[800] }}
              value={form.hostel_type} onChange={e=>set('hostel_type',e.target.value)}>
              {HOSTEL_TYPES.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </FieldRow>
          {/* Feature 84: Bed number */}
          <FieldRow label="Bed / Room No.">
            <input style={styles.inp} value={form.bedNumber} onChange={e=>set('bedNumber',e.target.value)} placeholder="e.g. K-12" />
          </FieldRow>
          <FieldRow label="Status">
            <select style={styles.inp} value={form.status} onChange={e=>set('status',e.target.value)}>
              {ADM_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          {/* Feature 52: Follow-up date */}
          <FieldRow label="Follow-up Date">
            <input type="date" style={styles.inp} value={form.followupDate} onChange={e=>set('followupDate',e.target.value)} />
          </FieldRow>
        </div>

        {warden && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, marginBottom:12, padding:'6px 14px', borderRadius:8, background:T.sky[50], border:`1px solid ${T.sky[100]}`, fontSize:12, color:T.sky[700] }}>
            👤 Warden: <strong>{warden.name}</strong> · {warden.phone}
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
          {/* Feature 8: Entrance score */}
          <FieldRow label="Entrance Score">
            <input style={styles.inp} type="number" value={form.entranceScore} onChange={e=>set('entranceScore',e.target.value)} placeholder="Out of 100" />
          </FieldRow>
          {/* Feature 9: Interview */}
          <FieldRow label="Interview Score">
            <input style={styles.inp} type="number" value={form.interviewScore} onChange={e=>set('interviewScore',e.target.value)} placeholder="Out of 50" />
          </FieldRow>
          <FieldRow label="Interview Date">
            <input type="date" style={styles.inp} value={form.interviewDate} onChange={e=>set('interviewDate',e.target.value)} />
          </FieldRow>
        </div>

        <SectionDivider label="Financial" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:4 }}>
          {/* Feature 13: Scholarship */}
          <FieldRow label="Scholarship %">
            <input style={styles.inp} type="number" min="0" max="100" value={form.scholarshipPct} onChange={e=>set('scholarshipPct',e.target.value)} placeholder="e.g. 25" />
          </FieldRow>
          {/* Feature 16: Concession */}
          <FieldRow label="Concession Amount ₹">
            <input style={styles.inp} type="number" value={form.concessionAmt} onChange={e=>set('concessionAmt',e.target.value)} placeholder="Fixed ₹ off/mo" />
          </FieldRow>
          {/* Feature 17: Security deposit */}
          <FieldRow label="Security Deposit ₹">
            <input style={styles.inp} type="number" value={form.securityDeposit} onChange={e=>set('securityDeposit',e.target.value)} placeholder="Refundable" />
          </FieldRow>
          {/* Feature 18: Transport fee */}
          <FieldRow label="Transport Fee ₹/mo">
            <input style={styles.inp} type="number" value={form.transportFee} onChange={e=>set('transportFee',e.target.value)} placeholder="Day scholars" />
          </FieldRow>
          {/* Feature 15: Instalment plan */}
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

        {/* Feature 12: Emergency contact */}
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
            style={{ padding:'10px 24px', borderRadius:9, background:gccDup?T.slate[300]:`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:gccDup?'not-allowed':'pointer' }}>
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
function AppCard({ a, cols, selected, onSelect, onEdit, onDelete, onAdmit, onEnroll, onOpenFee, onQuickEdit, onDetail, onWAMsg, tableMode, darkMode }) {
  const gcc     = String(a.gcc || a.id)
  const admPaid = cols.some(col => String(parseInt(col.adm_app_id)) === String(parseInt(gcc)) && col.fee_type === 'admission')
  const cs      = COURSE_STRUCTURE[a.course]
  const today   = new Date().toISOString().slice(0,10)
  const followupOverdue = a.followupDate && a.followupDate < today
  const followupToday   = a.followupDate && a.followupDate === today

  // Feature 78: duplicate check (same name shown as warning in parent)
  const bg = darkMode ? T.slate[800] : '#fff'
  const bd = darkMode ? T.slate[700] : T.slate[200]

  // Feature 77: Waitlist position handled by parent
  let actionBtn = null
  if (a.status === 'Applied' || a.status === 'Under Review') {
    actionBtn = <button onClick={e=>{e.stopPropagation();onAdmit(a.id)}} style={{ padding:'6px 14px', borderRadius:7, background:T.violet[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Admit</button>
  } else if (a.status === 'Admitted' && !admPaid) {
    actionBtn = <button onClick={e=>{e.stopPropagation();onOpenFee(a)}} style={{ padding:'6px 14px', borderRadius:7, background:T.amber[500], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Collect Fee</button>
  } else if (a.status === 'Admitted' && admPaid) {
    actionBtn = (
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <button onClick={e=>{e.stopPropagation();onOpenFee(a)}} style={{ padding:'5px 12px', borderRadius:7, background:T.amber[500], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Fee Account</button>
        <button onClick={e=>{e.stopPropagation();onEnroll(a.id)}} style={{ padding:'5px 12px', borderRadius:7, background:T.emerald[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Enroll → Student</button>
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

  return (
    <div style={{ background:bg, border:`1px solid ${selected?T.indigo[400]:bd}`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:14, transition:'box-shadow .15s', position:'relative', outline:selected?`2px solid ${T.indigo[300]}`:'none' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.07)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
    >
      <div style={{ position:'absolute', left:0, top:8, bottom:8, width:3, borderRadius:99, background:STAT_META[a.status]?.color||T.slate[300] }} />
      {/* Feature 53: checkbox */}
      <input type="checkbox" checked={!!selected} onChange={()=>onSelect(a.id)} style={{ cursor:'pointer', flexShrink:0 }} onClick={e=>e.stopPropagation()} />
      <Avatar name={a.name} size={40} photoUrl={a.photoUrl} />
      <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => onDetail(a)}>
        <div style={{ fontWeight:800, fontSize:14, color:T.slate[900] }}>
          {a.name}
          {a.scholarshipPct>0 && <span style={{ marginLeft:6, fontSize:10, padding:'1px 6px', borderRadius:4, background:T.emerald[50], color:T.emerald[700], fontWeight:700 }}>🎓 {a.scholarshipPct}% schol.</span>}
          {a.disabilityFlag && <span style={{ marginLeft:6, fontSize:10, padding:'1px 6px', borderRadius:4, background:T.amber[50], color:T.amber[700], fontWeight:700 }}>♿ Special</span>}
          {a.siblingGcc && <span style={{ marginLeft:6, fontSize:10, padding:'1px 6px', borderRadius:4, background:T.violet[50], color:T.violet[700], fontWeight:700 }}>👫 Sibling</span>}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:3, fontSize:11.5, color:T.slate[500], alignItems:'center' }}>
          {a.gcc    && <span style={{ fontFamily:'monospace' }}>#{a.gcc}</span>}
          {a.admNo  && <span style={{ fontFamily:'monospace', color:T.indigo[500] }}>{a.admNo}</span>}
          {a.session && <span style={{ padding:'1px 6px', borderRadius:4, background:T.slate[100], color:T.slate[500], fontSize:11, fontWeight:600 }}>{a.session}</span>}
          {a.cls    && <span>{a.cls}</span>}
          {a.house  && <span style={{ color:T.slate[400] }}>{a.house}{a.bedNumber?` · ${a.bedNumber}`:''}</span>}
          {a.course && (
            <span style={{ color:cs?.color??T.slate[600], fontWeight:600, background:cs?.bg??T.slate[100], borderRadius:4, padding:'1px 6px', fontSize:11 }}>
              {a.course}{a.subtype?` · ${a.subtype}`:''}
            </span>
          )}
          {a.hostel_type && <HostelTypeBadge type={a.hostel_type} />}
          {a.entranceScore && <span style={{ fontSize:10, color:T.sky[600], fontWeight:700 }}>📝 {a.entranceScore}</span>}
          {a.phone && <span>{a.phone}</span>}
          {/* Feature 52: follow-up badge */}
          {followupOverdue && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:T.rose[50], color:T.rose[600], fontWeight:700, border:`1px solid ${T.rose[200]}` }}>⚠ Follow-up overdue</span>}
          {followupToday   && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:T.amber[50], color:T.amber[600], fontWeight:700, border:`1px solid ${T.amber[200]}` }}>📅 Follow-up today</span>}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
        <StatusBadge status={a.status} />
        {(a.status==='Admitted'||a.status==='Enrolled') && (
          admPaid
            ? <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:T.emerald[50], color:T.emerald[700], border:`1px solid ${T.emerald[300]}`, fontWeight:700 }}>✓ Fee Paid</span>
            : <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:T.amber[50], color:T.amber[700], border:`1px solid ${T.amber[300]}`, fontWeight:700 }}>⚠ Fee Due</span>
        )}
        {a.docs?.length > 0 && <span style={{ fontSize:10, color:T.slate[400] }}>{a.docs.length}/{ADM_DOCS.length} docs</span>}
      </div>
      <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
        {actionBtn}
        <div style={{ display:'flex', gap:4, marginTop:2, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button onClick={e=>{e.stopPropagation();onDetail(a)}} style={{ padding:'4px 10px', borderRadius:6, background:T.sky[50], color:T.sky[600], border:`1px solid ${T.sky[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>View</button>
          <button onClick={e=>{e.stopPropagation();onQuickEdit(a)}} style={{ padding:'4px 10px', borderRadius:6, background:T.amber[50], color:T.amber[700], border:`1px solid ${T.amber[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>QEdit</button>
          <button onClick={e=>{e.stopPropagation();onEdit(a)}} style={{ padding:'4px 10px', borderRadius:6, background:T.slate[50], color:T.slate[600], border:`1px solid ${T.slate[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>Edit</button>
          <button onClick={e=>{e.stopPropagation();onWAMsg(a)}} title="WhatsApp" style={{ padding:'4px 8px', borderRadius:6, background:'#E7FBE9', color:'#128C7E', border:'1px solid #A7F0BA', fontSize:11, fontWeight:700, cursor:'pointer' }}>WA</button>
          <button onClick={e=>{e.stopPropagation();onDelete(a.id)}} style={{ padding:'4px 10px', borderRadius:6, background:'#FFF1F2', color:T.rose[600], border:'1px solid #FFE4E6', fontSize:11, fontWeight:700, cursor:'pointer' }}>Del</button>
        </div>
      </div>
    </div>
  )
}

// ─── Bulk Action Bar ───────────────────────────────────────────────────────────
function BulkBar({ selected, total, onClear, onBulkStatus, onBulkHouse, onBulkDelete, onBulkEnroll, onBulkExport, onBulkPrint, onBulkWA }) {
  const [statusVal, setStatusVal] = useState('Under Review')
  const [houseVal,  setHouseVal]  = useState('')

  if (selected.length === 0) return null
  return (
  <div style={{
    background: bg,
    border: `1px solid ${selected ? T.indigo[400] : bd}`,
    borderRadius: 14,
    overflow: 'hidden',
    outline: selected ? `2px solid ${T.indigo[300]}` : 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    transition: 'box-shadow .15s, transform .15s',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.10)'; e.currentTarget.style.transform='translateY(-2px)' }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)'; e.currentTarget.style.transform='translateY(0)' }}
  >
    {/* Status accent bar */}
    <div style={{ height: 4, background: STAT_META[a.status]?.color || T.slate[300], borderRadius: '14px 14px 0 0' }} />

    {/* Card body */}
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>

      {/* Row 1: checkbox + avatar + name + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input type="checkbox" checked={!!selected} onChange={() => onSelect(a.id)}
          style={{ cursor: 'pointer', flexShrink: 0, marginTop: 4 }} onClick={e => e.stopPropagation()} />
        <Avatar name={a.name} size={42} photoUrl={a.photoUrl} />
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onDetail(a)}>
          <div style={{ fontWeight: 800, fontSize: 14, color: T.slate[900], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      {/* Row 2: info grid 2x2 */}
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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: `1px solid ${T.slate[100]}`, paddingTop: 10 }}>
        {actionBtn && <div style={{ marginRight: 'auto' }}>{actionBtn}</div>}
        <button onClick={e=>{e.stopPropagation();onDetail(a)}}    style={{ padding:'5px 10px', borderRadius:6, background:T.sky[50],    color:T.sky[600],    border:`1px solid ${T.sky[200]}`,    fontSize:11, fontWeight:700, cursor:'pointer' }}>View</button>
        <button onClick={e=>{e.stopPropagation();onQuickEdit(a)}} style={{ padding:'5px 10px', borderRadius:6, background:T.amber[50],  color:T.amber[700],  border:`1px solid ${T.amber[200]}`,  fontSize:11, fontWeight:700, cursor:'pointer' }}>QEdit</button>
        <button onClick={e=>{e.stopPropagation();onEdit(a)}}      style={{ padding:'5px 10px', borderRadius:6, background:T.slate[50],  color:T.slate[600],  border:`1px solid ${T.slate[200]}`,  fontSize:11, fontWeight:700, cursor:'pointer' }}>Edit</button>
        <button onClick={e=>{e.stopPropagation();onWAMsg(a)}}     style={{ padding:'5px 10px', borderRadius:6, background:'#E7FBE9',    color:'#128C7E',     border:'1px solid #A7F0BA',         fontSize:11, fontWeight:700, cursor:'pointer' }}>WA</button>
        <button onClick={e=>{e.stopPropagation();onDelete(a.id)}} style={{ padding:'5px 10px', borderRadius:6, background:T.rose[50],   color:T.rose[600],   border:`1px solid ${T.rose[200]}`,   fontSize:11, fontWeight:700, cursor:'pointer' }}>Del</button>
      </div>
    </div>
  </div>
)
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

// ─── FEATURE 64: Saved Filter Presets ─────────────────────────────────────────
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

// ─── FEATURE 70: Sort Control ─────────────────────────────────────────────────
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Admissions() {
  const [apps,           setApps]          = useState([])
  const [cols,           setCols]          = useState([])
  const [loading,        setLoading]       = useState(true)
  const [search,         setSearch]        = useState('')
  const [filterStatus,   setFilter]        = useState('All')
  const [filterSession,  setSession]       = useState('All')
  const [filterCourse,   setCourse]        = useState('All')
  const [filterSubtype,  setSubtype]       = useState('All')
  const [filterHostel,   setHostel]        = useState('All')
  const [filterHouse,    setFilterHouse]   = useState('All')  // Feature 67
  const [advFilters,     setAdvFilters]    = useState({})     // Feature 63
  const [sortBy,         setSortBy]        = useState('gcc')
  const [sortDir,        setSortDir]       = useState('desc')
  const [formOpen,       setFormOpen]      = useState(false)
  const [editing,        setEditing]       = useState(null)
  const [feePanel,       setFeePanel]      = useState(null)
  const [toast,          setToast]         = useState(null)
  const [selectedIds,    setSelectedIds]   = useState(new Set()) // Feature 53
  const [showAnalytics,  setShowAnalytics] = useState(false)    // Feature 23
  const [showAdvSearch,  setShowAdvSearch] = useState(false)    // Feature 63
  const [detailApp,      setDetailApp]     = useState(null)     // Feature 71
  const [quickEditApp,   setQuickEditApp]  = useState(null)     // Feature 72
  const [waBlastApps,    setWABlastApps]   = useState(null)     // Feature 45
  const [showCSVImport,  setShowCSVImport] = useState(false)    // Feature 58
  const [tableMode,      setTableMode]     = useState(false)    // Feature 98
  const [darkMode,       setDarkMode]      = useState(false)    // Feature 99
  const [undoQueue,      setUndoQueue]     = useState([])       // Feature 96
  const [showPresets,    setShowPresets]   = useState(false)    // Feature 64
  const searchRef = useRef(null)

  const { session: activeSession } = useActiveSession()
  const { presets, save: savePreset, remove: removePreset } = useFilterPresets()

  const showToast = (msg, color, undoFn) => {
    setToast({ msg, color, undoFn })
    setTimeout(() => setToast(null), 4000)
  }

  // Feature 99: Dark mode body sync
  useEffect(() => {
    document.body.style.background = darkMode ? T.slate[900] : T.slate[50]
    return () => { document.body.style.background = '' }
  }, [darkMode])

  // Feature 93: Keyboard shortcuts
  useKeyboardShortcuts({
    onNew:        () => { setEditing(null); setFormOpen(true) },
    onSearch:     () => searchRef.current?.focus(),
    onEscape:     () => { setFormOpen(false); setEditing(null); setDetailApp(null); setQuickEditApp(null); setShowAdvSearch(false) },
    onToggleView: () => setTableMode(v => !v),
    onToggleDark: () => setDarkMode(v => !v),
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [appsData, colsData] = await Promise.all([
      sbApps.fetch(),
      supabase.from('adm_fee_collections').select('*').order('created_at', { ascending:false }),
    ])
    if (appsData) setApps(appsData)
    if (!colsData.error) setCols(colsData.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Feature 95: restore draft
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

  // Feature 78: find duplicates by name+DOB+phone
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

  // Feature 77: waitlist positions
  const waitlistPositions = useMemo(() => {
    const wl = apps.filter(a=>a.status==='Waitlisted')
    const pos = {}; wl.forEach((a,i) => pos[a.gcc] = i+1)
    return pos
  }, [apps])

  // Feature 85: house counts
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

      // Advanced filters (Feature 63)
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

    // Feature 70: sort
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

  // Selection helpers (Feature 53-62)
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
    if (!obj.name?.trim())          { showToast('Name is required', T.rose[600]); return }
    if (!obj.gcc?.toString().trim()) { showToast('GCC No. is required', T.rose[600]); return }
    if (!eid && activeSession?.is_locked) { showToast('🔒 Session locked. No new applications.', T.rose[600]); return }

    const sessionName = (!eid && activeSession) ? activeSession.session_name : obj.session
    const dbRow = mapToDB({ ...obj, session: sessionName })

    if (eid) {
      const { error } = await supabase.from('admissions').update(dbRow).eq('gcc_no', parseInt(eid))
      if (error) { showToast('Update failed: '+error.message, T.rose[600]); return }

      // Feature 89: audit log (localStorage-based fallback)
      try {
        const log = JSON.parse(localStorage.getItem('gnsi_audit_'+eid)||'[]')
        log.unshift({ ts:now(), action:'edit', by:'Staff', changes: JSON.stringify(dbRow).slice(0,200) })
        localStorage.setItem('gnsi_audit_'+eid, JSON.stringify(log.slice(0,50)))
      } catch(_) {}

      setApps(prev => prev.map(a => String(a.id)===String(eid) ? { ...a, ...obj, id:parseInt(eid), hostel_type:dbRow.hostel_type } : a))
      showToast('Application updated', T.amber[600])
    } else {
      const { data, error } = await supabase.from('admissions').insert(dbRow).select().single()
      if (error) {
        if (error.code==='23505') showToast(`GCC No. ${obj.gcc} already exists`, T.rose[600])
        else showToast('Save failed: '+error.message, T.rose[600])
        return
      }
      const newApp = mapFromDB(data)
      setApps(prev => [newApp, ...prev])
      showToast(`Saved! Adm. No: ${newApp.admNo} · ${newApp.hostel_type} · ₹${fmt(getFlatFeeAmt(newApp.hostel_type))}/mo`, T.violet[600])
    }
    try { localStorage.removeItem(DRAFT_KEY) } catch(_) {}
    setFormOpen(false); setEditing(null)
  }

  const handleAdmit = async id => {
    if (!confirm('Mark as Admitted?')) return
    // Feature 92: manager role check (placeholder — wire to your role system)
    const { error } = await supabase.from('admissions').update({ status:'Admitted' }).eq('gcc_no', parseInt(id))
    if (error) { showToast('Update failed: '+error.message, T.rose[600]); return }
    setApps(prev => prev.map(a => String(a.id)===String(id) ? { ...a, status:'Admitted' } : a))
    showToast('Marked as Admitted', T.violet[600])
  }

  const handleEnroll = async id => {
    const a = apps.find(x => String(x.id)===String(id))
    if (!a) return
    const admPaid = cols.some(c=>String(parseInt(c.adm_app_id))===String(parseInt(a.gcc||a.id))&&c.fee_type==='admission')
    if (!admPaid) { showToast('⚠ Collect admission fee first', T.rose[600]); setFeePanel(a); return }
    if (!confirm(`Enroll ${a.name} as a student?`)) return
    try {
      const { error: admErr } = await supabase.from('admissions').update({ status:'Enrolled' }).eq('gcc_no', parseInt(id))
      if (admErr) throw admErr
      const { created } = await promoteToStudent(a)
      setApps(prev => prev.map(x => String(x.id)===String(id) ? { ...x, status:'Enrolled' } : x))
      showToast(created ? `✅ ${a.name} enrolled & student record created!` : `✅ ${a.name} enrolled (student already existed)`, T.emerald[600])
    } catch(err) { showToast('Enroll failed: '+err.message, T.rose[600]) }
  }

  // Feature 96: Undo delete
  const handleDelete = async id => {
    const a = apps.find(x => String(x.id)===String(id))
    if (!confirm(`Delete admission for ${a?.name}?`)) return
    const snapshot = { ...a }
    setApps(prev => prev.filter(x => String(x.id)!==String(id)))

    const doDelete = async () => {
      const { error } = await supabase.from('admissions').delete().eq('gcc_no', parseInt(id))
      if (error) { setApps(prev => [snapshot, ...prev]); showToast('Delete failed: '+error.message, T.rose[600]) }
    }

    // Feature 90: soft delete — move to trash in 5s
    let deleted = false
    showToast(`Deleted ${a?.name}`, T.rose[600], () => {
      deleted = true
      setApps(prev => [snapshot, ...prev])
    })
    setTimeout(() => { if (!deleted) doDelete() }, 5000)
  }

  // Feature 72: Quick edit save
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

  // Feature 51: Add note (localStorage-based)
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

  // Bulk operations (Feature 54-61)
  const handleBulkStatus = async status => {
    if (!confirm(`Set ${selectedIds.size} applicants to "${status}"?`)) return
    const ids = [...selectedIds]
    const { error } = await supabase.from('admissions').update({ status }).in('gcc_no', ids.map(Number))
    if (error) { showToast('Bulk update failed', T.rose[600]); return }
    setApps(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, status } : a))
    showToast(`${ids.length} applicants set to ${status}`, T.violet[600])
    clearSelection()
  }

  const handleBulkHouse = async house => {
    if (!confirm(`Set house "${house}" for ${selectedIds.size} applicants?`)) return
    const ids = [...selectedIds]; const ht = DAY_SCHOLAR_HOUSES.includes(house)?'Day Scholar':'Boarder'
    const { error } = await supabase.from('admissions').update({ house, hostel_type:ht }).in('gcc_no', ids.map(Number))
    if (error) { showToast('Bulk house update failed', T.rose[600]); return }
    setApps(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, house, hostel_type:ht } : a))
    showToast(`${ids.length} applicants assigned to ${house}`, T.emerald[600])
    clearSelection()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected applicants? Cannot be undone.`)) return
    const ids = [...selectedIds]
    const { error } = await supabase.from('admissions').delete().in('gcc_no', ids.map(Number))
    if (error) { showToast('Bulk delete failed', T.rose[600]); return }
    setApps(prev => prev.filter(a => !selectedIds.has(a.id)))
    showToast(`${ids.length} records deleted`, T.rose[600])
    clearSelection()
  }

  // Feature 58: CSV import
  const handleCSVImport = async rows => {
    setShowCSVImport(false)
    let ok=0, fail=0
    for (const r of rows) {
      const dbRow = mapToDB(r)
      const { error } = await supabase.from('admissions').insert(dbRow)
      if (error) fail++; else ok++
    }
    await loadAll()
    showToast(`Imported ${ok} rows${fail>0?`, ${fail} failed`:''}`, ok>0?T.emerald[600]:T.rose[600])
  }

  // Feature 80: Auto-assign house
  const handleAutoAssignHouse = () => {
    const unassigned = filtered.filter(a=>!a.house||a.house==='Day Scholar')
    if (!unassigned.length) { showToast('No unassigned boarder records', T.amber[600]); return }
    const boarderHouses = HOUSES_LIST.filter(h=>!DAY_SCHOLAR_HOUSES.includes(h))
    unassigned.forEach(async (a,i) => {
      const house = boarderHouses[i % boarderHouses.length]
      await supabase.from('admissions').update({ house, hostel_type:'Boarder' }).eq('gcc_no', parseInt(a.id))
    })
    loadAll()
    showToast(`Auto-assigned houses for ${unassigned.length} students`, T.emerald[600])
  }

  const byStatus = {}
  ADM_STATUSES.forEach(s => byStatus[s]=0)
  apps.forEach(a => byStatus[a.status] = (byStatus[a.status]||0)+1)

  // Feature 31: Revenue forecast
  const monthlyRevenue = apps.filter(a=>a.status==='Enrolled').reduce((s,a)=>s+getFlatFeeAmt(a.hostel_type),0)

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
        <FeeCollectionModal app={feePanel} onClose={()=>setFeePanel(null)} onSaved={()=>{ setFeePanel(null); loadAll(); showToast('Payment recorded!','#059669') }} />
      )}
      {waBlastApps && <WABlastModal apps={waBlastApps} onClose={()=>setWABlastApps(null)} />}
      {showCSVImport && <CSVImportModal onClose={()=>setShowCSVImport(false)} onImport={handleCSVImport} />}

      <div style={{ padding:'0 24px 32px', fontFamily:'system-ui,sans-serif', background:bg, minHeight:'100vh', color:tx, transition:'background .2s' }}>
        <style>{`
          @keyframes spin { to { transform:rotate(360deg) } }
          select:focus, input:focus, textarea:focus { border-color:${T.indigo[400]} !important; box-shadow:0 0 0 3px ${T.indigo[100]}; }
        `}</style>

        {toast && <Toast msg={toast.msg} color={toast.color} onUndo={toast.undoFn} />}

        {/* Header */}
        <div style={{ padding:'28px 0 16px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.12em', color:T.slate[400], marginBottom:5 }}>GNSI Portal</div>
            <div style={{ fontSize:26, fontWeight:800, color:tx, letterSpacing:'-.03em', lineHeight:1.1 }}>Admissions</div>
            <div style={{ fontSize:13, color:T.slate[500], marginTop:5, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
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
              {monthlyRevenue > 0 && <span style={{ color:T.emerald[600] }}>💰 Enrolled revenue: <strong>₹{fmt(monthlyRevenue)}/mo</strong></span>}
            </div>
            {/* Feature 93: Shortcut hints */}
            <div style={{ marginTop:4, fontSize:10, color:T.slate[300] }}>
              Shortcuts: <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>N</kbd> New &nbsp;
              <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>/</kbd> Search &nbsp;
              <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>V</kbd> Toggle view &nbsp;
              <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>D</kbd> Dark mode &nbsp;
              <kbd style={{ background:T.slate[100], padding:'1px 4px', borderRadius:3, fontSize:10 }}>Esc</kbd> Close
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start' }}>
            {/* Feature 99: Dark mode */}
            <button onClick={()=>setDarkMode(v=>!v)} title="Toggle dark mode (D)" style={{ padding:'9px 14px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:card, fontSize:14, cursor:'pointer' }}>{darkMode?'☀️':'🌙'}</button>
            {/* Feature 98: View toggle */}
            <button onClick={()=>setTableMode(v=>!v)} title="Toggle view (V)" style={{ padding:'9px 14px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:card, fontSize:14, cursor:'pointer' }}>{tableMode?'🃏':'📋'}</button>
            {/* Feature 23: Analytics */}
            <button onClick={()=>setShowAnalytics(v=>!v)} style={{ padding:'9px 14px', borderRadius:9, border:`1.5px solid ${showAnalytics?T.indigo[400]:T.slate[200]}`, background:showAnalytics?T.indigo[50]:card, color:showAnalytics?T.indigo[700]:T.slate[600], fontSize:12, fontWeight:700, cursor:'pointer' }}>📊 Analytics</button>
            {/* Feature 58: CSV import */}
            <button onClick={()=>setShowCSVImport(true)} style={{ padding:'9px 14px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:card, color:T.slate[600], fontSize:12, fontWeight:700, cursor:'pointer' }}>📥 Import</button>
            {/* Feature 35: CSV export all */}
            <button onClick={()=>downloadCSV(toCSV(filtered), `GNSI_Admissions_${new Date().toISOString().slice(0,10)}.csv`)} style={{ padding:'9px 14px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:card, color:T.slate[600], fontSize:12, fontWeight:700, cursor:'pointer' }}>📤 Export CSV</button>
            {/* Feature 80: Auto-assign house */}
            <button onClick={handleAutoAssignHouse} style={{ padding:'9px 14px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:card, color:T.slate[600], fontSize:12, fontWeight:700, cursor:'pointer' }} title="Auto-assign houses to unassigned boarders">🏠 Auto-Assign</button>
            <button onClick={()=>{ setEditing(null); setFormOpen(true) }}
              style={{ padding:'10px 20px', borderRadius:10, background:`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 12px rgba(79,70,229,.3)' }}>
              <span style={{ fontSize:18, lineHeight:1 }}>+</span> New Application
            </button>
          </div>
        </div>

        {/* Active session banner */}
        {activeSession && (
          <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:10, background:activeSession.is_locked?T.rose[50]:T.emerald[50], border:`1px solid ${activeSession.is_locked?T.rose[200]:T.emerald[300]}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:16 }}>{activeSession.is_locked?'🔒':'✅'}</span>
              <span style={{ fontSize:13, fontWeight:700, color:activeSession.is_locked?T.rose[600]:T.emerald[700] }}>
                {activeSession.is_locked?'Session Locked':'Active Session'}: <strong>{activeSession.session_name}</strong>
              </span>
            </div>
            {activeSession.is_locked && <span style={{ fontSize:12, color:T.rose[600], fontWeight:600 }}>New applications are blocked. Go to Sessions to unlock.</span>}
          </div>
        )}

        {/* Analytics Dashboard (Feature 23-34) */}
        {showAnalytics && <AnalyticsDashboard apps={apps} cols={cols} darkMode={darkMode} />}

        {/* KPI Strip */}
        {/* KPI Strip */}
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  gap: 10,
  marginBottom: 16,
}}>
  <KpiCard label="Total" value={apps.length} active={filterStatus==='All'} accent={T.indigo[600]} onClick={()=>setFilter('All')} subtitle={`₹${fmt(monthlyRevenue)}/mo`} />
  {ADM_STATUSES.map(s => (
    <KpiCard key={s} label={s} value={byStatus[s]||0} active={filterStatus===s} accent={STAT_META[s]?.color} onClick={()=>setFilter(filterStatus===s?'All':s)} />
  ))}
</div>

        {/* Form */}
        {formOpen && (
          <AdmForm onSave={handleSave} onCancel={()=>{ setFormOpen(false); setEditing(null) }} editing={editing} activeSession={activeSession} />
        )}

        {/* Detail panel (Feature 71) */}
        {detailApp && (
          <DetailPanel a={detailApp} onClose={()=>setDetailApp(null)} onAddNote={handleAddNote} darkMode={darkMode} />
        )}

        {/* Quick-edit row (Feature 72) */}
        {quickEditApp && (
          <QuickEditRow a={quickEditApp} onSave={handleQuickEdit} onCancel={()=>setQuickEditApp(null)} />
        )}

        {/* Advanced Search (Feature 63) */}
        {showAdvSearch && (
          <AdvancedSearch filters={advFilters} onChange={f=>{setAdvFilters(f);setShowAdvSearch(false)}} onClose={()=>setShowAdvSearch(false)} apps={apps} />
        )}

        {/* Filter Panel */}
        <div style={{ background:card, border:`1px solid ${darkMode?T.slate[700]:T.slate[200]}`, borderRadius:12, padding:'14px 18px', marginBottom:14, display:'flex', flexDirection:'column', gap:10 }}>
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
          {/* Feature 67: House filter */}
          <PillStrip label="House" options={HOUSES_LIST} value={filterHouse} onChange={setFilterHouse} colorFn={()=>T.sky[600]}
            countFn={h => houseCounts[h]||0} />

          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:220, position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.slate[400], fontSize:14 }}>🔍</span>
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search name, phone, GCC, house… (/ to focus)"
                style={{ ...styles.inp, paddingLeft:36 }} />
            </div>
            {/* Feature 63: Advanced search */}
            <button onClick={()=>setShowAdvSearch(v=>!v)}
              style={{ padding:'8px 14px', borderRadius:8, border:`1.5px solid ${Object.keys(advFilters).filter(k=>advFilters[k]).length>0?T.violet[400]:T.slate[200]}`, background:Object.keys(advFilters).filter(k=>advFilters[k]).length>0?T.violet[50]:card, color:T.violet[600], fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              🔎 Advanced{Object.keys(advFilters).filter(k=>advFilters[k]).length>0?` (${Object.keys(advFilters).filter(k=>advFilters[k]).length})`:''}</button>

            {/* Feature 70: Sort */}
            <SortControl sortBy={sortBy} sortDir={sortDir} onChange={(k,d)=>{setSortBy(k);setSortDir(d)}} />

            {/* Feature 64: Presets */}
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
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, fontSize:12, color:T.slate[500] }}>
            <input type="checkbox" checked={selectedIds.size===filtered.length&&filtered.length>0} onChange={toggleSelectAll} style={{ cursor:'pointer' }} />
            <span onClick={toggleSelectAll} style={{ cursor:'pointer' }}>Select all {filtered.length}</span>
            {selectedIds.size>0 && <span style={{ color:T.indigo[600], fontWeight:700 }}>{selectedIds.size} selected</span>}
            {selectedIds.size>0 && (
              <>
                <button onClick={()=>{ downloadCSV(toCSV(selectedApps), `GNSI_Selected_${new Date().toISOString().slice(0,10)}.csv`) }}
                  style={{ padding:'4px 10px', borderRadius:6, background:T.sky[50], color:T.sky[600], border:`1px solid ${T.sky[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>Export Selected</button>
                <button onClick={()=>printBulkList(selectedApps)}
                  style={{ padding:'4px 10px', borderRadius:6, background:T.indigo[50], color:T.indigo[600], border:`1px solid ${T.indigo[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>Print Selected</button>
                <button onClick={()=>setWABlastApps(selectedApps)}
                  style={{ padding:'4px 10px', borderRadius:6, background:'#E7FBE9', color:'#128C7E', border:'1px solid #A7F0BA', fontSize:11, fontWeight:700, cursor:'pointer' }}>WA Blast</button>
              </>
            )}
          </div>
        )}

        {/* Bulk Action Bar (Feature 53-62) */}
        <BulkBar
          selected={[...selectedIds]} total={filtered.length}
          onClear={clearSelection}
          onBulkStatus={handleBulkStatus}
          onBulkHouse={handleBulkHouse}
          onBulkDelete={handleBulkDelete}
          onBulkEnroll={()=>showToast('Select enrolled-ready applicants first',T.amber[600])}
          onBulkExport={()=>downloadCSV(toCSV(selectedApps),`GNSI_Bulk_${Date.now()}.csv`)}
          onBulkPrint={()=>printBulkList(selectedApps)}
          onBulkWA={()=>setWABlastApps(selectedApps)}
        />

        {/* List / Table */}
        {filtered.length > 0 ? (
          tableMode ? (
            /* Feature 98: Table view */
            <div style={{ background:card, border:`1px solid ${darkMode?T.slate[700]:T.slate[200]}`, borderRadius:12, overflow:'hidden' }}>
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
                      onDetail={setDetailApp} onWAMsg={a=>setWABlastApps([a])} tableMode darkMode={darkMode} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Card view */
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(380px, 100%), 1fr))',
  gap: 16,
  alignItems: 'start',
}}>
  {filtered.map(a => (
                <div key={a.id}>
                  {/* Feature 78: duplicate warning */}
                  {duplicateGCCs.has(a.gcc) && (
                    <div style={{ fontSize:11, color:T.rose[600], fontWeight:700, padding:'3px 10px', background:T.rose[50], borderRadius:6, marginBottom:3, display:'inline-block' }}>
                      ⚠ Possible duplicate detected
                    </div>
                  )}
                  {/* Feature 77: waitlist position */}
                  {a.status==='Waitlisted' && waitlistPositions[a.gcc] && (
                    <div style={{ fontSize:11, color:T.slate[500], fontWeight:700, marginBottom:2 }}>Waitlist #{waitlistPositions[a.gcc]}</div>
                  )}
                  <AppCard a={a} cols={cols} selected={selectedIds.has(a.id)} onSelect={toggleSelect}
                    onEdit={app=>{setEditing(app);setFormOpen(true)}} onDelete={handleDelete} onAdmit={handleAdmit}
                    onEnroll={handleEnroll} onOpenFee={setFeePanel} onQuickEdit={setQuickEditApp}
                    onDetail={setDetailApp} onWAMsg={a=>setWABlastApps([a])} tableMode={false} darkMode={darkMode} />
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:16, background:T.slate[100], display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, marginBottom:16 }}>📭</div>
            <div style={{ fontSize:16, fontWeight:700, color:T.slate[700], marginBottom:6 }}>{apps.length===0?'No applications yet':'No results found'}</div>
            <p style={{ fontSize:13, color:T.slate[400], maxWidth:'36ch', lineHeight:1.6, margin:'0 0 20px' }}>
              {apps.length===0?'Click "+ New Application" to add your first applicant.':'Try adjusting your search or clearing the filters.'}
            </p>
            {activeFilters>0 && <button onClick={clearAll} style={{ padding:'10px 22px', borderRadius:10, background:T.slate[800], color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer' }}>✕ Clear all filters</button>}
            {apps.length===0 && <button onClick={()=>setFormOpen(true)} style={{ padding:'10px 22px', borderRadius:10, background:`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer' }}>+ New Application</button>}
          </div>
        )}

        {/* Feature 97: Pagination note for large lists */}
        {filtered.length > 200 && (
          <div style={{ marginTop:12, textAlign:'center', fontSize:12, color:T.slate[400] }}>
            Showing all {filtered.length} records · Switch to Table View for better performance with large lists
          </div>
        )}
      </div>
    </>
  )
}