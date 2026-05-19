// Students.jsx — COMPLETE REDESIGN: Modern Dashboard
// Design system: dark navy base, sharp white cards, bold IBM Plex type, crisp data rows
// All original functionality preserved — only visual layer changed
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import FeeCollectionModal from './FeeCollectionModal'
import { getFlatFeeAmt } from './shared/feeHelpers'

const fmt  = n => Number(n||0).toLocaleString('en-IN')
const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : '—'
const fmtM = d => d ? new Date(d).toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : '—'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const D = {
  // Base surfaces — professional slate hierarchy
  bg:       '#F8FAFC',    // Slate 50 — page background
  surface:  '#FFFFFF',     // Pure white — primary cards
  surface2: '#F1F5F9',    // Slate 100 — elevated surfaces
  surface3: '#E2E8F0',    // Slate 200 — tertiary surfaces

  // Borders — subtle gray scale
  border:   '#E2E8F0',    // Slate 200 — standard borders
  border2:  '#CBD5E1',    // Slate 300 — hover/focus
  border3:  '#94A3B8',    // Slate 400 — emphasis

  // Text — slate hierarchy
  textPrimary:   '#0F172A',   // Slate 900 — headings
  textSecondary: '#334155',   // Slate 700 — body
  textMuted:     '#64748B',   // Slate 500 — captions
  textDisabled:  '#94A3B8',   // Slate 400 — disabled

  // Brand — Deep Navy
  brand:    '#1E3A5F',   // Primary
  brandLight:'#3B5998',   // Hover
  brandDim: '#EFF6FF',    // Light bg
  brandHov: '#1E40AF',    // Active
  brandText:'#1D4ED8',    // Links

  // Status — refined with borders
  emerald:     '#059669', emeraldLight:'#10B981', emeraldDim:'#ECFDF5', emeraldBorder:'#A7F3D0',
  amber:       '#D97706', amberLight:'#F59E0B',   amberDim:'#FFFBEB',   amberBorder:'#FDE68A',
  rose:        '#E11D48', roseLight:'#FB7185',    roseDim:'#FFF1F2',    roseBorder:'#FECDD3',
  violet:      '#7C3AED', violetLight:'#8B5CF6',   violetDim:'#F5F3FF',   violetBorder:'#DDD6FE',
  sky:         '#0284C7', skyLight:'#38BDF8',      skyDim:'#F0F9FF',     skyBorder:'#BAE6FD',
  teal:        '#0D9488', tealLight:'#14B8A6',     tealDim:'#F0FDFA',    tealBorder:'#99F6E4',
  orange:      '#EA580C', orangeLight:'#F97316',   orangeDim:'#FFF7ED',   orangeBorder:'#FED7AA',

  // Semantic aliases
  success:'#059669', successLight:'#10B981', successDim:'#ECFDF5',
  warning:'#D97706', warningLight:'#F59E0B', warningDim:'#FFFBEB',
  danger: '#E11D48', dangerLight:'#FB7185', dangerDim:'#FFF1F2',
  info:   '#0284C7', infoLight:'#38BDF8',   infoDim:'#F0F9FF',

  // Extra accents
  indigo:'#4F46E5', indigoDim:'#EEF2FF', indigoBorder:'#C7D2FE',
  cyan:   '#0891B2', cyanDim:'#ECFEFF',
  pink:   '#DB2777', pinkDim:'#FDF2F8',

  // Radius
  r4:'4px', r6:'6px', r8:'8px', r10:'10px', r12:'12px', r16:'16px', r20:'20px',
}

// Legacy T alias — updated to professional palette
const T = {
  indigo:  {50:D.indigoDim, 100:'#E0E7FF', 200:'#C7D2FE', 400:'#818CF8', 500:D.indigo, 600:D.indigo, 700:'#4338CA'},
  emerald: {50:D.emeraldDim, 100:'#D1FAE5', 200:D.emeraldBorder, 300:'#6EE7B7', 400:'#34D399', 500:D.emerald, 600:D.emerald, 700:'#047857'},
  amber:   {50:D.amberDim, 100:'#FEF3C7', 200:D.amberBorder, 300:'#FCD34D', 400:'#FBBF24', 500:D.amber, 600:D.amber, 700:'#B45309'},
  violet:  {50:D.violetDim, 100:'#EDE9FE', 200:D.violetBorder, 400:'#A78BFA', 500:D.violet, 600:D.violet, 700:'#6D28D9'},
  rose:    {50:D.roseDim, 100:'#FFE4E6', 200:D.roseBorder, 300:'#FDA4AF', 400:D.roseLight, 500:D.rose, 600:D.rose, 700:'#BE123C'},
  slate:   {50:D.bg, 100:D.surface2, 200:D.border, 300:D.border2, 400:D.textDisabled, 500:D.textMuted, 600:D.textSecondary, 700:D.textSecondary, 800:D.textPrimary, 900:D.textPrimary},
  teal:    {50:D.tealDim, 100:'#CCFBF1', 200:D.tealBorder, 300:'#5EEAD4', 400:'#2DD4BF', 500:D.teal, 600:D.teal, 700:'#0F766E'},
  sky:     {50:D.skyDim, 100:'#E0F2FE', 200:D.skyBorder, 300:'#7DD3FC', 400:D.skyLight, 500:D.sky, 600:D.sky, 700:'#0369A1'},
  orange:  {50:D.orangeDim, 100:'#FFEDD5', 200:D.orangeBorder, 300:'#FDBA74', 400:D.orangeLight, 500:D.orange, 600:D.orange, 700:'#C2410C'},
  pink:    {50:D.pinkDim, 100:'#FCE7F3', 200:'#FBCFE8', 300:'#F9A8D4', 400:'#F472B6', 500:D.pink, 600:D.pink, 700:'#BE185D'},
  blue:    {50:D.brandDim, 100:'#DBEAFE', 200:'#BFDBFE', 300:'#93C5FD', 400:'#60A5FA', 500:D.brandText, 600:D.brandLight, 700:D.brand, 800:D.brandHov, 900:'#1E3A5F'},
}

const COURSES      = ['All','Sainik','Navodaya','Foundation','Combined Course']
const HOSTEL_TYPES = ['All','Boarder','Day Scholar','Day Boarder']
const STATUSES     = ['All','Active','Inactive','Passed Out','Withdrawn']
const GENDERS      = ['All','Male','Female']
const SESSIONS     = ['2024-25','2025-26','2026-27']
const SUBJECTS     = ['Mathematics','Science','English','Social Studies','Hindi','GK','Reasoning']
const BATCH_CAPACITY = 80

const COURSE_STRUCTURE = {
  Navodaya:         {subtypes:['Lakshya','Umeed'],             color:'#3B82F6',bg:D.brandDim},
  Sainik:           {subtypes:['Achiever','Leader','Champion'],color:'#059669',bg:D.emeraldDim},
  Foundation:       {subtypes:['Elite','Prime'],               color:'#7C3AED',bg:D.violetDim},
  'Combined Course':{subtypes:[],                              color:'#D97706',bg:D.amberDim},
}

const PROMOTION_MAP = {
  'Lakshya':'Umeed','Achiever':'Leader','Leader':'Champion','Elite':'Prime',
  'Class 6':'Class 7','Class 7':'Class 8','Class 8':'Class 9','Class 9':'Class 10',
}

const CLASSES_LIST       = ['Achiever','Leader','Champion','Lakshya','Umeed','Elite','Prime','Class 6','Class 7','Class 8','Class 9','Class 10']
const HOUSES_LIST        = ['Kombirei','Shiroi','Loktak','Singgarei','Koubru','Kangla','Sangai','Takhelei','Block-B','Day Scholar']
const DAY_SCHOLAR_HOUSES = ['Day Scholar']

const HOSTEL_STYLES = {
  'Boarder':    {bg:D.emeraldDim,color:D.emerald,border:'#A7F3D0',icon:'🏠'},
  'Day Boarder':{bg:D.amberDim,  color:D.amber,  border:'#FDE68A',icon:'🌅'},
  'Day Scholar':{bg:D.surface2,  color:D.textSecondary,border:D.border,icon:'🏫'},
}

const STATUS_META = {
  Active:      {color:D.emerald,bg:D.emeraldDim,border:'#A7F3D0',icon:'●'},
  Inactive:    {color:D.amber,  bg:D.amberDim,  border:'#FDE68A',icon:'◐'},
  'Passed Out':{color:D.brand,  bg:D.brandDim,  border:'#BFDBFE',icon:'◈'},
  Withdrawn:   {color:D.rose,   bg:D.roseDim,   border:'#FECDD3',icon:'◌'},
}

const HOUSE_COLORS = {
  Kombirei:'#3B82F6',Kangla:'#EF4444',Sangai:'#10B981',Singgarei:'#F59E0B',
  Loktak:'#8B5CF6',Koubru:'#06B6D4',Shiroi:'#EC4899',Takhelei:'#F97316',
  'Block-B':D.textSecondary,'Day Scholar':D.textMuted,
}

const ALL_COLUMNS = [
  {key:'name',       label:'Name',         default:true},
  {key:'gcc_no',     label:'GCC No.',      default:true},
  {key:'batch',      label:'Batch',        default:true},
  {key:'session',    label:'Session',      default:true},
  {key:'course',     label:'Course',       default:true},
  {key:'house',      label:'House',        default:true},
  {key:'hostel_type',label:'Hostel Type',  default:true},
  {key:'status',     label:'Status',       default:true},
  {key:'fee_dues',   label:'Fee Dues',     default:true},
  {key:'attendance', label:'Attendance %', default:true},
  {key:'rank',       label:'Rank',         default:false},
  {key:'gender',     label:'Gender',       default:false},
  {key:'phone',      label:'Phone',        default:false},
  {key:'father_name',label:"Father",       default:false},
  {key:'last_paid',  label:'Last Paid',    default:false},
  {key:'fee_history',label:'Fee History',  default:false},
  {key:'sparkline',  label:'Score Trend',  default:false},
]

const DENSITY = {
  compact:    {padding:'8px 16px',  avatarSize:28,gap:4,  fontSize:12},
  comfortable:{padding:'13px 16px', avatarSize:36,gap:6,  fontSize:13},
  spacious:   {padding:'18px 20px', avatarSize:44,gap:10, fontSize:14},
}

const DRAFT_KEY    = 'gnsi_student_form_draft'
const PRESETS_KEY  = 'gnsi_filter_presets'
const SEARCHES_KEY = 'gnsi_recent_searches'
const COLUMNS_KEY  = 'gnsi_visible_columns'
const DENSITY_KEY  = 'gnsi_density'

const AVATAR_COLORS=[D.brand,'#8B5CF6',D.emerald,D.amber,'#EC4899',D.teal]
const avatarColor=name=>AVATAR_COLORS[(name||'').charCodeAt(0)%AVATAR_COLORS.length]
const initials=name=>(name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
function deriveHostelType(house,hostelType){if(house&&DAY_SCHOLAR_HOUSES.includes(house))return'Day Scholar';if(HOSTEL_TYPES.filter(h=>h!=='All').includes(hostelType))return hostelType;return'Day Scholar'}
function isBirthdayToday(dob){if(!dob)return false;const today=new Date();const d=new Date(dob);return d.getDate()===today.getDate()&&d.getMonth()===today.getMonth()}
function isRecentlyAdded(createdAt){if(!createdAt)return false;return Date.now()-new Date(createdAt).getTime()<7*24*60*60*1000}
function getMissingFields(s){const m=[];if(!s.gcc_no)m.push('GCC');if(!s.dob)m.push('DOB');if(!s.phone)m.push('Phone');if(!s.course)m.push('Course');return m}
function filtersToParams(f){const p=new URLSearchParams();Object.entries(f).forEach(([k,v])=>{if(v&&v!=='All'&&v!=='')p.set(k,v)});return p.toString()}
function paramsToFilters(search){const p=new URLSearchParams(search);return{status:p.get('status')||'All',course:p.get('course')||'All',hostel:p.get('hostel')||'All',house:p.get('house')||'All',gender:p.get('gender')||'All',session:p.get('session')||'All',batch:p.get('batch')||'All',q:p.get('q')||'',gccMin:p.get('gccMin')||'',gccMax:p.get('gccMax')||''}}
function downloadCSV(rows,filename){if(!rows.length)return;const headers=Object.keys(rows[0]);const csv=[headers.join(','),...rows.map(r=>headers.map(h=>`"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:filename});a.click()}

function exportToPDF(title, headers, rows, filename) {
  const w = window.open('', '_blank')
  const headerHTML = headers.map(h => `<th style="padding:8px 10px;border:1px solid #ccc;background:#f1f5f9;font-weight:700;font-size:11px;text-align:left">${h.label}</th>`).join('')
  const rowsHTML = rows.map((r, i) => {
    const cells = headers.map(h => `<td style="padding:6px 10px;border:1px solid #ccc;font-size:11px">${r[h.key] ?? '—'}</td>`).join('')
    return `<tr style="background:${i%2===0?'#fff':'#fafafa'}">${cells}</tr>`
  }).join('')
  w.document.write(`<html><head><title>${title}</title>
    <style>@page{size:A4 landscape;margin:10mm}body{font-family:system-ui,sans-serif;padding:20px;font-size:12px}h2{margin-bottom:4px;font-size:18px}.meta{color:#666;margin-bottom:16px;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc}</style></head><body>
    <h2>${title}</h2>
    <div class="meta">Total: ${rows.length} records · Generated: ${new Date().toLocaleDateString('en-IN')}</div>
    <table><thead><tr>${headerHTML}</tr></thead><tbody>${rowsHTML}</tbody></table>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
  </body></html>`)
  w.document.close()
}

function usePresets(){const load=()=>{try{return JSON.parse(localStorage.getItem(PRESETS_KEY)||'[]')}catch{return[]}};const[presets,setPresets]=useState(load);const save=(name,filters)=>{const next=[...presets.filter(p=>p.name!==name),{name,filters}];setPresets(next);localStorage.setItem(PRESETS_KEY,JSON.stringify(next))};const remove=name=>{const next=presets.filter(p=>p.name!==name);setPresets(next);localStorage.setItem(PRESETS_KEY,JSON.stringify(next))};return{presets,save,remove}}
function useRecentSearches(){const load=()=>{try{return JSON.parse(localStorage.getItem(SEARCHES_KEY)||'[]')}catch{return[]}};const[recent,setRecent]=useState(load);const add=q=>{if(!q?.trim()||q.length<2)return;const next=[q,...recent.filter(r=>r!==q)].slice(0,8);setRecent(next);localStorage.setItem(SEARCHES_KEY,JSON.stringify(next))};const clear=()=>{setRecent([]);localStorage.removeItem(SEARCHES_KEY)};return{recent,add,clear}}

// ─── Design Primitives ────────────────────────────────────────────────────────
function Avatar({name,photoUrl,size=36}){
  if(photoUrl)return<img src={photoUrl} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`2px solid ${D.border2}`}}/>
  return<div style={{width:size,height:size,borderRadius:'50%',background:avatarColor(name)+'22',border:`1.5px solid ${avatarColor(name)}60`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.36,fontWeight:700,color:avatarColor(name),flexShrink:0,letterSpacing:'-.02em'}}>{initials(name)}</div>
}

function StatusBadge({status}){
  const m=STATUS_META[status]||{color:D.textMuted,bg:D.surface2,border:D.border,icon:'◌'}
  return<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:D.r4,fontSize:10,fontWeight:700,background:m.bg,color:m.color,border:`1px solid ${m.border}`,letterSpacing:'.04em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
    <span style={{fontSize:7,lineHeight:1}}>{m.icon}</span>{status}
  </span>
}

function HostelTypeBadge({type,showRate=false}){
  if(!type)return<span style={{color:D.textMuted,fontSize:11}}>—</span>
  const s=HOSTEL_STYLES[type]||HOSTEL_STYLES['Day Scholar']
  return<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:D.r4,background:s.bg,color:s.color,border:`1px solid ${s.border}`,letterSpacing:'.03em',whiteSpace:'nowrap'}}>{s.icon} {type}{showRate&&<span style={{fontWeight:500,opacity:.7}}>· ₹{fmt(getFlatFeeAmt(type))}</span>}</span>
}

function KpiCard({label,value,accent,onClick,active,warn,icon}){
  return<div onClick={onClick} style={{
    flex:1,minWidth:100,padding:'16px 18px',borderRadius:D.r10,
    background:active?accent+'18':warn?D.orangeDim:D.surface,
    border:`1px solid ${active?accent+'50':warn?D.orange+'30':D.border}`,
    cursor:onClick?'pointer':'default',
    transition:'all .15s',position:'relative',overflow:'hidden',
  }}>
    <div style={{position:'absolute',right:14,top:12,fontSize:18,opacity:.15}}>{icon}</div>
    <div style={{fontSize:24,fontWeight:800,color:warn?D.orange:active?accent:D.textPrimary,lineHeight:1,letterSpacing:'-.03em',fontFamily:"'IBM Plex Mono',monospace"}}>{value}</div>
    <div style={{fontSize:10,fontWeight:600,color:warn?D.orange:active?accent:D.textMuted,marginTop:6,textTransform:'uppercase',letterSpacing:'.08em'}}>{label}</div>
  </div>
}

function Toast({msg,color=D.brand}){
  return<div style={{position:'fixed',top:20,right:20,zIndex:999999,background:D.surface2,border:`1px solid ${D.border2}`,borderLeft:`3px solid ${color}`,borderRadius:D.r10,padding:'12px 18px',fontSize:13,fontWeight:600,boxShadow:'0 16px 48px rgba(0,0,0,.5)',maxWidth:340,color:D.textPrimary,display:'flex',alignItems:'center',gap:10}}>
    <span style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/>
    {msg}
  </div>
}

function UndoBanner({student,onUndo,onDismiss}){
  const[secs,setSecs]=useState(5)
  useEffect(()=>{const t=setInterval(()=>setSecs(s=>{if(s<=1){clearInterval(t);onDismiss();return 0}return s-1}),1000);return()=>clearInterval(t)},[])
  return<div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:999999,background:D.surface2,color:D.textPrimary,borderRadius:D.r12,padding:'12px 20px',display:'flex',alignItems:'center',gap:14,boxShadow:'0 16px 48px rgba(0,0,0,.6)',fontSize:13,fontWeight:600,border:`1px solid ${D.border2}`}}>
    <span>Deleted <strong>{student.name}</strong></span>
    <button onClick={onUndo} style={{padding:'5px 14px',borderRadius:D.r6,background:D.emerald,color:'#fff',border:'none',fontSize:12,fontWeight:700,cursor:'pointer'}}>Undo ({secs}s)</button>
    <button onClick={onDismiss} style={{background:'none',border:'none',color:D.textMuted,cursor:'pointer',fontSize:16,lineHeight:1}}>✕</button>
  </div>
}

function FieldRow({label,children,error}){
  return<div>
    <label style={{display:'block',fontSize:10,fontWeight:700,color:error?D.rose:D.textMuted,marginBottom:5,textTransform:'uppercase',letterSpacing:'.08em'}}>{label}</label>
    {children}
    {error&&<div style={{fontSize:11,color:D.rose,marginTop:4,fontWeight:600,display:'flex',alignItems:'center',gap:4}}>⚠ {error}</div>}
  </div>
}

function SectionDivider({label}){
  return<div style={{display:'flex',alignItems:'center',gap:10,margin:'20px 0 12px',color:D.textMuted}}>
    <div style={{flex:1,height:1,background:D.border}}/>
    <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.12em',color:D.textMuted}}>{label}</span>
    <div style={{flex:1,height:1,background:D.border}}/>
  </div>
}

// Input styles
const INP={
  base:{width:'100%',padding:'9px 12px',borderRadius:D.r8,border:`1px solid ${D.border2}`,fontSize:13,outline:'none',boxSizing:'border-box',backgroundColor:D.surface,color:D.textPrimary,fontFamily:'system-ui,sans-serif',transition:'border-color .15s'},
  err:{border:`1px solid ${D.rose}`}
}

// Button styles
const BTN={
  primary:{padding:'9px 18px',borderRadius:D.r8,background:D.brand,color:'#fff',border:'none',fontSize:13,fontWeight:700,cursor:'pointer',letterSpacing:'.01em'},
  secondary:{padding:'8px 14px',borderRadius:D.r8,background:D.surface2,color:D.textSecondary,border:`1px solid ${D.border2}`,fontSize:12,fontWeight:600,cursor:'pointer'},
  ghost:{padding:'7px 12px',borderRadius:D.r6,background:'none',color:D.textMuted,border:`1px solid ${D.border}`,fontSize:11,fontWeight:600,cursor:'pointer'},
  danger:{padding:'8px 14px',borderRadius:D.r8,background:D.roseDim,color:D.rose,border:`1px solid #3A1020`,fontSize:12,fontWeight:700,cursor:'pointer'},
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function Modal({children,onClose,width=480,title,subtitle}){
  return<div style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.75)',backdropFilter:'blur(4px)'}} onClick={onClose}>
    <div style={{background:D.surface,border:`1px solid ${D.border2}`,borderRadius:D.r16,width,maxHeight:'88vh',overflowY:'auto',boxShadow:'0 32px 96px rgba(0,0,0,.6)',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
      {(title||subtitle)&&<div style={{padding:'22px 24px 0',borderBottom:`1px solid ${D.border}`,paddingBottom:16,flexShrink:0}}>
        {title&&<div style={{fontSize:16,fontWeight:800,color:D.textPrimary,letterSpacing:'-.02em'}}>{title}</div>}
        {subtitle&&<div style={{fontSize:12,color:D.textMuted,marginTop:3}}>{subtitle}</div>}
        <button onClick={onClose} style={{position:'absolute',top:18,right:20,width:28,height:28,borderRadius:D.r6,border:`1px solid ${D.border}`,background:D.surface2,cursor:'pointer',fontSize:14,color:D.textMuted,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>}
      <div style={{padding:'20px 24px 24px',flex:1,overflowY:'auto'}}>{children}</div>
    </div>
  </div>
}

// ─── Student Detail Drawer ────────────────────────────────────────────────────
function StudentDetailDrawer({ student, allStudents, attData, examData, feeData, feeHistory, onClose, onEdit, showToast }) {
  const [tab,    setTab]   = useState('profile')
  const [notes,  setNotes] = useState(student.notes || '')
  const [saving, setSaving]= useState(false)

  const siblings = allStudents.filter(s=>s.id!==student.id&&s.status==='Active'&&((s.father_name&&s.father_name===student.father_name)||(s.mother_name&&s.mother_name===student.mother_name)))
  const att      = attData[student.id]   || null
  const exams    = examData[student.id]  || []
  const dues     = feeData[student.id]?.dues || 0
  const history  = feeHistory[student.id] || []

  const examTotals = exams.slice(-5).map(e=>e.total||0)
  const sparkMax   = Math.max(...examTotals,1)

  const batchStudents = allStudents.filter(s=>s.batch===student.batch&&s.status==='Active')
  const batchExamAvgs = batchStudents.map(s=>({id:s.id,avg:(examData[s.id]||[]).reduce((a,e)=>a+(e.total||0),0)/Math.max((examData[s.id]||[]).length,1)})).sort((a,b)=>b.avg-a.avg)
  const rank = batchExamAvgs.findIndex(x=>x.id===student.id)+1

  const subjectTotals={}
  exams.forEach(e=>{SUBJECTS.forEach(sub=>{if(e[sub]!=null){if(!subjectTotals[sub])subjectTotals[sub]=[];subjectTotals[sub].push(Number(e[sub]))}})})
  const weakSubjects=Object.entries(subjectTotals).filter(([,scores])=>scores.reduce((a,b)=>a+b,0)/scores.length<40).map(([sub])=>sub)

  const longAbsent = att!==null&&att<50

  const monthlySummary = useMemo(()=>{
    const months={}
    history.forEach(h=>{const m=fmtM(h.payment_date);if(!months[m])months[m]={paid:0,due:getFlatFeeAmt(student.hostel_type)};months[m].paid+=Number(h.amount||0)})
    return Object.entries(months).map(([month,data])=>({month,...data,balance:data.due-data.paid})).sort((a,b)=>new Date(b.month)-new Date(a.month))
  },[history,student.hostel_type])

  const totalArrears = monthlySummary.reduce((a,m)=>a+Math.max(0,m.balance),0)

  const saveNotes=async()=>{setSaving(true);await supabase.from('students').update({notes}).eq('id',student.id);setSaving(false);showToast('Notes saved',D.emerald)}

  const TABS=[
    {key:'profile', label:'Profile'},
    {key:'academic',label:'Academic'},
    {key:'attend',  label:'Attendance'},
    {key:'fee',     label:'Fees'},
    {key:'docs',    label:'Documents'},
    {key:'history', label:'History'},
    {key:'notes',   label:'Notes'},
  ]

  return(
    <div style={{position:'fixed',inset:0,zIndex:99998,display:'flex',justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{width:520,background:D.surface,display:'flex',flexDirection:'column',overflowY:'auto',borderLeft:`1px solid ${D.border2}`,boxShadow:'-24px 0 80px rgba(0,0,0,.6)'}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{background:D.surface2,padding:'24px',borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div style={{display:'flex',gap:14,alignItems:'center'}}>
              <div style={{position:'relative'}}>
                <Avatar name={student.name} photoUrl={student.photo_url} size={52}/>
                <label style={{position:'absolute',bottom:-2,right:-2,width:18,height:18,borderRadius:'50%',background:D.brand,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:9,border:`2px solid ${D.surface2}`}}>
                  📷
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
                    const file=e.target.files[0];if(!file)return
                    const ext=file.name.split('.').pop()
                    const path=`student_photos/${student.id}.${ext}`
                    const{error:upErr}=await supabase.storage.from('gnsi').upload(path,file,{upsert:true})
                    if(upErr){showToast('Upload failed',D.rose);return}
                    const{data:{publicUrl}}=supabase.storage.from('gnsi').getPublicUrl(path)
                    await supabase.from('students').update({photo_url:publicUrl}).eq('id',student.id)
                    showToast('Photo updated',D.emerald)
                  }}/>
                </label>
              </div>
              <div>
                <div style={{fontSize:18,fontWeight:800,color:D.textPrimary,letterSpacing:'-.02em'}}>{student.name}</div>
                <div style={{fontSize:11,color:D.textMuted,marginTop:2,fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{student.gcc_no} · {student.batch} · {student.session}</div>
                {longAbsent&&<div style={{fontSize:10,background:D.roseDim,color:D.rose,padding:'2px 8px',borderRadius:D.r4,marginTop:6,fontWeight:700,display:'inline-block',border:`1px solid #3A1020`}}>⚠ LONG ABSENT</div>}
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>onEdit(student)} style={{...BTN.secondary,fontSize:11}}>✏ Edit</button>
              <button onClick={onClose} style={{...BTN.ghost,padding:'7px 10px',fontSize:16}}>✕</button>
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[
              {label:'Status',   value:student.status||'—'},
              {label:'Hostel',   value:student.hostel_type||'—'},
              {label:'Att%',     value:att!=null?`${att.toFixed(0)}%`:'—',warn:att!=null&&att<75},
              {label:'Rank',     value:rank?`#${rank}`:'—'},
              {label:'Fee Dues', value:dues>0?`₹${fmt(dues)}`:'Clear',ok:dues===0},
              {label:'Arrears',  value:totalArrears>0?`₹${fmt(totalArrears)}`:'Clear',ok:totalArrears===0},
            ].map(p=>(
              <div key={p.label} style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r8,padding:'8px 12px',textAlign:'center',minWidth:72}}>
                <div style={{fontSize:13,fontWeight:800,color:p.warn?D.amber:p.ok?D.emerald:D.textPrimary,letterSpacing:'-.01em'}}>{p.value}</div>
                <div style={{fontSize:9,color:D.textMuted,textTransform:'uppercase',letterSpacing:'.07em',marginTop:3}}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:`1px solid ${D.border}`,background:D.surface2,flexShrink:0,overflowX:'auto'}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{
              flex:1,padding:'11px 8px',border:'none',background:'none',fontSize:11,fontWeight:700,cursor:'pointer',
              color:tab===t.key?D.brand:D.textMuted,
              borderBottom:`2px solid ${tab===t.key?D.brand:'transparent'}`,
              textTransform:'uppercase',letterSpacing:'.06em',whiteSpace:'nowrap',transition:'all .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{padding:'20px 24px',flex:1}}>

          {tab==='profile'&&(
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                {[
                  ['Gender',student.gender],['DOB',fmtD(student.dob)],['Course',student.course],
                  ['House',student.house],['Phone',student.phone],['Father',student.father_name],
                  ['Mother',student.mother_name],['Emergency',student.emergency_contact],
                  ['Prev School',student.prev_school],['Referred by',student.referral_source],
                  ['Admitted',fmtD(student.admission_date)],['Left On',student.left_date?fmtD(student.left_date):null],
                  ['Medical',student.medical_notes],['Address',student.address],
                ].map(([label,value])=>value?(
                  <div key={label} style={{background:D.surface2,borderRadius:D.r8,padding:'10px 12px',border:`1px solid ${D.border}`}}>
                    <div style={{fontSize:9,fontWeight:700,color:D.textMuted,textTransform:'uppercase',letterSpacing:'.08em'}}>{label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:D.textPrimary,marginTop:3}}>{value}</div>
                  </div>
                ):null)}
              </div>
              {siblings.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:12,color:D.textSecondary,marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>Siblings ({siblings.length})</div>
                  {siblings.map(sib=>(
                    <div key={sib.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${D.border}`}}>
                      <Avatar name={sib.name} size={28}/>
                      <div>
                        <div style={{fontWeight:600,fontSize:13,color:D.textPrimary}}>{sib.name}</div>
                        <div style={{fontSize:11,color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{sib.gcc_no} · {sib.batch}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {student.medical_notes&&(
                <div style={{background:D.orangeDim,border:`1px solid ${D.orange}30`,borderRadius:D.r10,padding:'10px 14px',marginBottom:12}}>
                  <div style={{fontWeight:700,fontSize:11,color:D.orange,marginBottom:4,textTransform:'uppercase',letterSpacing:'.07em'}}>⚕ Medical Notes</div>
                  <div style={{fontSize:13,color:D.textSecondary}}>{student.medical_notes}</div>
                </div>
              )}
              {student.remarks&&(
                <div style={{background:D.surface2,borderRadius:D.r10,padding:'10px 14px',border:`1px solid ${D.border}`}}>
                  <div style={{fontWeight:700,fontSize:11,color:D.textMuted,marginBottom:4,textTransform:'uppercase',letterSpacing:'.07em'}}>Remarks</div>
                  <div style={{fontSize:13,color:D.textSecondary}}>{student.remarks}</div>
                </div>
              )}
            </>
          )}

          {tab==='academic'&&(
            <>
              <div style={{display:'flex',gap:10,marginBottom:16}}>
                <div style={{flex:1,background:D.surface2,border:`1px solid ${D.border}`,borderRadius:D.r10,padding:'16px',textAlign:'center'}}>
                  <div style={{fontSize:36,fontWeight:800,color:D.brand,letterSpacing:'-.04em',fontFamily:"'IBM Plex Mono',monospace"}}>{rank?`#${rank}`:'—'}</div>
                  <div style={{fontSize:10,color:D.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginTop:4}}>Rank in Batch</div>
                  <div style={{fontSize:10,color:D.textMuted,marginTop:2}}>of {batchStudents.length} students</div>
                </div>
                {examTotals.length>0&&(
                  <div style={{flex:2,background:D.surface2,border:`1px solid ${D.border}`,borderRadius:D.r10,padding:'16px'}}>
                    <div style={{fontWeight:700,fontSize:11,color:D.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:'.07em'}}>Score Trend</div>
                    <div style={{display:'flex',alignItems:'flex-end',gap:4,height:36}}>
                      {examTotals.map((v,i)=>(
                        <div key={i} style={{flex:1,background:D.brand,borderRadius:2,height:`${(v/sparkMax)*100}%`,minHeight:3,opacity:.7+.3*(i/examTotals.length)}}/>
                      ))}
                    </div>
                    <div style={{fontSize:10,color:D.textMuted,marginTop:6}}>Last {examTotals.length} exams · Latest: <span style={{color:D.textPrimary,fontWeight:700}}>{examTotals[examTotals.length-1]}</span></div>
                  </div>
                )}
              </div>

              {weakSubjects.length>0&&(
                <div style={{background:D.roseDim,border:`1px solid #3A1020`,borderRadius:D.r10,padding:'10px 14px',marginBottom:14}}>
                  <div style={{fontWeight:700,fontSize:11,color:D.rose,marginBottom:8,textTransform:'uppercase',letterSpacing:'.07em'}}>⚠ Weak Subjects</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {weakSubjects.map(s=><span key={s} style={{fontSize:11,padding:'3px 8px',borderRadius:D.r4,background:'#3A1020',color:D.rose,fontWeight:600}}>{s}</span>)}
                  </div>
                </div>
              )}

              {exams.length>0?(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                    <thead>
                      <tr style={{background:D.surface2}}>
                        <th style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:D.textMuted,borderBottom:`1px solid ${D.border}`,textTransform:'uppercase',letterSpacing:'.06em',fontSize:10}}>Exam</th>
                        {SUBJECTS.map(s=><th key={s} style={{padding:'8px 6px',fontWeight:700,color:D.textMuted,borderBottom:`1px solid ${D.border}`,whiteSpace:'nowrap',fontSize:10,textTransform:'uppercase',letterSpacing:'.05em'}}>{s.slice(0,4)}</th>)}
                        <th style={{padding:'8px 10px',fontWeight:700,color:D.textMuted,borderBottom:`1px solid ${D.border}`,textTransform:'uppercase',letterSpacing:'.06em',fontSize:10}}>Total</th>
                        <th style={{padding:'8px 6px',fontWeight:700,color:D.textMuted,borderBottom:`1px solid ${D.border}`,fontSize:10}}>—</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.map((e,i)=>{
                        const pass=(e.total||0)>=200
                        return(
                          <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                            <td style={{padding:'7px 10px',fontWeight:600,color:D.textSecondary,fontSize:12}}>{e.exam_name||`Exam ${i+1}`}</td>
                            {SUBJECTS.map(s=>{
                              const score=e[s];const weak=score!=null&&score<40
                              return<td key={s} style={{padding:'7px 6px',textAlign:'center',color:weak?D.rose:D.textSecondary,fontWeight:weak?700:400,fontSize:11}}>{score??'—'}</td>
                            })}
                            <td style={{padding:'7px 10px',fontWeight:800,color:D.textPrimary,fontFamily:"'IBM Plex Mono',monospace"}}>{e.total??'—'}</td>
                            <td style={{padding:'7px 6px',textAlign:'center'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:D.r4,background:pass?D.emeraldDim:D.roseDim,color:pass?D.emerald:D.rose,border:`1px solid ${pass?'#064E3B':'#3A1020'}`}}>{pass?'PASS':'FAIL'}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ):<div style={{textAlign:'center',padding:'40px',color:D.textMuted,fontSize:13}}>No exam records yet.</div>}
            </>
          )}

          {tab==='attend'&&<AttendanceTab student={student} showToast={showToast}/>}

          {tab==='fee'&&(
            <div>
              <div style={{fontWeight:700,fontSize:12,color:D.textMuted,marginBottom:12,textTransform:'uppercase',letterSpacing:'.08em'}}>Monthly Fee Summary</div>
              {totalArrears>0&&(
                <div style={{background:D.roseDim,border:`1px solid #3A1020`,borderRadius:D.r8,padding:'8px 14px',marginBottom:12,fontWeight:700,color:D.rose,fontSize:12}}>⚠ Total Arrears: ₹{fmt(totalArrears)}</div>
              )}
              {monthlySummary.length>0?(
                <div style={{overflowX:'auto',marginBottom:16}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr style={{background:D.surface2}}>
                        {['Month','Due','Paid','Balance','Status'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:h==='Month'?'left':'right',fontWeight:700,color:D.textMuted,borderBottom:`1px solid ${D.border}`,fontSize:10,textTransform:'uppercase',letterSpacing:'.06em'}}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.map((m,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                          <td style={{padding:'7px 10px',fontWeight:600,color:D.textSecondary}}>{m.month}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(m.due)}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',color:D.emerald,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(m.paid)}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',color:m.balance>0?D.rose:D.textMuted,fontWeight:m.balance>0?700:400,fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(m.balance)}</td>
                          <td style={{padding:'7px 10px',textAlign:'right'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:D.r4,background:m.balance<=0?D.emeraldDim:D.roseDim,color:m.balance<=0?D.emerald:D.rose,border:`1px solid ${m.balance<=0?'#064E3B':'#3A1020'}`}}>{m.balance<=0?'CLEAR':'DUE'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ):<div style={{color:D.textMuted,fontSize:13,textAlign:'center',padding:'24px'}}>No payment history yet.</div>}

              {history.length>0&&(
                <>
                  <div style={{fontWeight:700,fontSize:12,color:D.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:'.08em'}}>Recent Payments</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {history.slice(0,5).map((h,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:D.surface2,borderRadius:D.r8,border:`1px solid ${D.border}`}}>
                        <span style={{fontSize:14}}>💵</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:13,color:D.textPrimary,fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(h.amount)}</div>
                          <div style={{fontSize:11,color:D.textMuted,marginTop:1}}>{fmtD(h.payment_date)} · {h.payment_method||'Cash'}</div>
                        </div>
                        {h.month_for&&<span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:D.r4,background:D.brandDim,color:D.brand,border:`1px solid #1E3A5F`}}>{h.month_for}</span>}
                        <button onClick={()=>printFeeReceipt(student,h)} style={{...BTN.ghost,fontSize:10,padding:'4px 8px'}}>🖨 Receipt</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab==='docs'&&<DocumentsTab student={student} showToast={showToast}/>}

          {tab==='history'&&<><SessionHistoryTab student={student} showToast={showToast}/><div style={{marginTop:20}}><HistoricalExamScores student={student} showToast={showToast}/></div></>}

          {tab==='notes'&&(
            <>
              <div style={{fontWeight:700,fontSize:12,color:D.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:'.08em'}}>Student Notes / Activity Log</div>
              <textarea style={{...INP.base,height:200,resize:'vertical'}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enter notes, observations, or activity log…"/>
              <button onClick={saveNotes} disabled={saving} style={{...BTN.primary,marginTop:10}}>{saving?'Saving…':'Save Notes'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ student, showToast }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const today = new Date().toISOString().slice(0,10)

  const load = useCallback(async()=>{
    setLoading(true)
    const{data}=await supabase.from('attendance').select('*').eq('student_id',student.id).order('date',{ascending:false}).limit(90)
    setRecords(data||[]);setLoading(false)
  },[student.id])
  useEffect(()=>{load()},[load])

  const totalDays=records.length
  const presentDays=records.filter(r=>r.status==='Present').length
  const lateDays=records.filter(r=>r.status==='Late').length
  const medicalDays=records.filter(r=>r.status==='Medical').length
  const absentDays=records.filter(r=>r.status==='Absent').length
  const attPct=totalDays?((presentDays+lateDays*0.5)/totalDays*100).toFixed(1):null

  let streak=0
  for(const r of records){if(r.status==='Absent')streak++;else break}

  const monthlyAtt=useMemo(()=>{
    const months={}
    records.forEach(r=>{const d=new Date(r.date);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;if(!months[key])months[key]={total:0,present:0,absent:0,late:0,medical:0};months[key].total++;months[key][r.status.toLowerCase()]++})
    return Object.entries(months).map(([k,v])=>({month:new Date(k+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}),...v,pct:v.total?((v.present+v.late*0.5)/v.total*100).toFixed(0):0})).sort((a,b)=>b.month.localeCompare(a.month))
  },[records])

  const markToday=async(status)=>{
    setMarking(true)
    const existing=records.find(r=>r.date===today)
    if(existing)await supabase.from('attendance').update({status}).eq('id',existing.id)
    else await supabase.from('attendance').insert({student_id:student.id,date:today,status})
    await load();setMarking(false);showToast(`Marked ${status}`,D.emerald)
  }

  const todayRecord=records.find(r=>r.date===today)
  const ATT_STATUS_COLORS={Present:D.emerald,Absent:D.rose,Late:D.amber,Medical:D.sky}

  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:16}}>
        {[{label:'ATT %',value:attPct?`${attPct}%`:'—',color:attPct>=75?D.emerald:D.rose},{label:'Present',value:presentDays,color:D.emerald},{label:'Absent',value:absentDays,color:D.rose},{label:'Late',value:lateDays,color:D.amber},{label:'Medical',value:medicalDays,color:D.sky}].map(p=>(
          <div key={p.label} style={{background:D.surface2,border:`1px solid ${D.border}`,borderRadius:D.r8,padding:'10px 8px',textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:800,color:p.color,letterSpacing:'-.02em',fontFamily:"'IBM Plex Mono',monospace"}}>{p.value}</div>
            <div style={{fontSize:9,color:D.textMuted,fontWeight:700,marginTop:3,textTransform:'uppercase',letterSpacing:'.07em'}}>{p.label}</div>
          </div>
        ))}
      </div>

      {streak>=3&&<div style={{background:D.roseDim,border:`1px solid #3A1020`,borderRadius:D.r8,padding:'8px 14px',marginBottom:14,fontWeight:700,color:D.rose,fontSize:12}}>⚠ Absent streak: {streak} consecutive days</div>}

      <div style={{marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:11,color:D.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:'.08em'}}>Mark Today — {today}</div>
        {todayRecord&&<div style={{fontSize:12,color:D.textMuted,marginBottom:8}}>Currently: <strong style={{color:ATT_STATUS_COLORS[todayRecord.status]||D.textPrimary}}>{todayRecord.status}</strong></div>}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {['Present','Absent','Late','Medical'].map(s=>(
            <button key={s} onClick={()=>markToday(s)} disabled={marking} style={{
              padding:'8px 14px',borderRadius:D.r8,border:`1.5px solid ${todayRecord?.status===s?ATT_STATUS_COLORS[s]:D.border}`,
              background:todayRecord?.status===s?ATT_STATUS_COLORS[s]+'22':D.surface2,
              fontSize:12,fontWeight:700,cursor:'pointer',color:ATT_STATUS_COLORS[s],transition:'all .12s',
            }}>
              {s==='Present'?'✓':s==='Absent'?'✗':s==='Late'?'⏰':'🏥'} {s}
            </button>
          ))}
        </div>
      </div>

      {monthlyAtt.length>0&&(
        <>
          <div style={{fontWeight:700,fontSize:11,color:D.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:'.08em'}}>Monthly Summary</div>
          <div style={{overflowX:'auto',marginBottom:16}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:D.surface2}}>
                  {['Month','Days','Present','Absent','Late','%'].map(h=><th key={h} style={{padding:'7px 8px',textAlign:h==='Month'?'left':'center',fontWeight:700,color:D.textMuted,borderBottom:`1px solid ${D.border}`,fontSize:9,textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {monthlyAtt.map((m,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                    <td style={{padding:'6px 8px',fontWeight:600,color:D.textSecondary}}>{m.month}</td>
                    <td style={{padding:'6px 8px',textAlign:'center',color:D.textMuted}}>{m.total}</td>
                    <td style={{padding:'6px 8px',textAlign:'center',color:D.emerald,fontWeight:600}}>{m.present}</td>
                    <td style={{padding:'6px 8px',textAlign:'center',color:D.rose}}>{m.absent}</td>
                    <td style={{padding:'6px 8px',textAlign:'center',color:D.amber}}>{m.late}</td>
                    <td style={{padding:'6px 8px',textAlign:'center',fontWeight:700,color:m.pct>=75?D.emerald:D.rose,fontFamily:"'IBM Plex Mono',monospace"}}>{m.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{fontWeight:700,fontSize:11,color:D.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:'.08em'}}>Recent Attendance</div>
      {loading?<div style={{color:D.textMuted}}>Loading…</div>:(
        <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
          {records.slice(0,30).map(r=>(
            <div key={r.id} title={`${r.date}: ${r.status}`}
              style={{width:18,height:18,borderRadius:3,background:ATT_STATUS_COLORS[r.status]+'40',border:`1px solid ${ATT_STATUS_COLORS[r.status]}60`,cursor:'default'}}/>
          ))}
        </div>
      )}
      <div style={{display:'flex',gap:12,marginTop:8,fontSize:10,color:D.textMuted}}>
        {[['Present',D.emerald],['Late',D.amber],['Medical',D.sky],['Absent',D.rose]].map(([l,c])=><span key={l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:c+'40',border:`1px solid ${c}60`}}/>{l}</span>)}
      </div>
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────
function DocumentsTab({ student, showToast }) {
  const [docs,setDocs]=useState([])
  const [loading,setLoading]=useState(true)
  const [uploading,setUploading]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true)
    const{data}=await supabase.from('student_documents').select('*').eq('student_id',student.id).order('created_at',{ascending:false})
    setDocs(data||[]);setLoading(false)
  },[student.id])
  useEffect(()=>{load()},[load])

  const handleUpload=async(e,docType)=>{
    const file=e.target.files[0];if(!file)return
    setUploading(true)
    const path=`student_docs/${student.id}/${docType}_${Date.now()}.${file.name.split('.').pop()}`
    const{error:upErr}=await supabase.storage.from('gnsi').upload(path,file)
    if(upErr){showToast('Upload failed: '+upErr.message,D.rose);setUploading(false);return}
    const{data:{publicUrl}}=supabase.storage.from('gnsi').getPublicUrl(path)
    await supabase.from('student_documents').insert({student_id:student.id,doc_type:docType,file_name:file.name,file_url:publicUrl})
    await load();setUploading(false);showToast(`${docType} uploaded`,D.emerald)
  }

  const DOC_TYPES=['Birth Certificate','Transfer Certificate','Aadhaar','Photo','Other']

  return(
    <div>
      <div style={{fontWeight:700,fontSize:12,color:D.textMuted,marginBottom:12,textTransform:'uppercase',letterSpacing:'.08em'}}>Student Documents</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
        {DOC_TYPES.map(dt=>(
          <label key={dt} style={{...BTN.secondary,cursor:'pointer',display:'inline-block'}}>
            ↑ {dt}
            <input type="file" style={{display:'none'}} onChange={e=>handleUpload(e,dt)} disabled={uploading}/>
          </label>
        ))}
      </div>
      {loading?<div style={{color:D.textMuted}}>Loading…</div>:docs.length===0?<div style={{color:D.textMuted,fontSize:13,textAlign:'center',padding:'24px'}}>No documents uploaded yet.</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {docs.map(doc=>(
            <div key={doc.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:D.surface2,borderRadius:D.r8,border:`1px solid ${D.border}`}}>
              <span style={{fontSize:16}}>📄</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:D.textPrimary}}>{doc.doc_type}</div>
                <div style={{fontSize:11,color:D.textMuted,marginTop:1}}>{doc.file_name} · {fmtD(doc.created_at)}</div>
              </div>
              <a href={doc.file_url} target="_blank" rel="noreferrer" style={{...BTN.ghost,textDecoration:'none',fontSize:11}}>Open</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Exam Score Modal ─────────────────────────────────────────────────────────
function ExamScoreModal({ student, onClose, onSaved, showToast }) {
  const [examName,setExamName]=useState('')
  const [scores,setScores]=useState(Object.fromEntries(SUBJECTS.map(s=>[s,''])))
  const [target,setTarget]=useState('')
  const [remarks,setRemarks]=useState('')
  const [saving,setSaving]=useState(false)

  const total=SUBJECTS.reduce((a,s)=>a+Number(scores[s]||0),0)

  const handleSave=async()=>{
    if(!examName.trim()){showToast('Exam name required',D.rose);return}
    setSaving(true)
    const payload={student_id:student.id,exam_name:examName,...Object.fromEntries(SUBJECTS.map(s=>[s,Number(scores[s])||null])),total,target_score:Number(target)||null,academic_remarks:remarks||null,session:student.session}
    const{error}=await supabase.from('exam_scores').insert(payload)
    setSaving(false)
    if(error){showToast('Save failed: '+error.message,D.rose);return}
    showToast('Scores saved',D.emerald);onSaved()
  }

  return(
    <Modal onClose={onClose} width={520} title="Add Exam Scores" subtitle={`${student.name} · ${student.batch}`}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
        <FieldRow label="Exam Name *"><input style={INP.base} value={examName} onChange={e=>setExamName(e.target.value)} placeholder="e.g. Unit Test 1"/></FieldRow>
        <FieldRow label="Target Score"><input type="number" style={INP.base} value={target} onChange={e=>setTarget(e.target.value)} placeholder="e.g. 350"/></FieldRow>
      </div>
      <SectionDivider label="Subject Marks"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        {SUBJECTS.map(s=>(
          <FieldRow key={s} label={s}><input type="number" style={INP.base} value={scores[s]} onChange={e=>setScores(prev=>({...prev,[s]:e.target.value}))} placeholder="0–100"/></FieldRow>
        ))}
      </div>
      <div style={{background:D.surface2,border:`1px solid ${D.border}`,borderRadius:D.r8,padding:'12px 16px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontWeight:700,fontSize:12,color:D.textMuted,textTransform:'uppercase',letterSpacing:'.07em'}}>Total Score</span>
        <span style={{fontWeight:800,fontSize:24,color:total>=200?D.emerald:D.rose,fontFamily:"'IBM Plex Mono',monospace"}}>{total} {target&&<span style={{fontSize:14,fontWeight:500,color:D.textMuted}}>/ {target}</span>}</span>
      </div>
      <FieldRow label="Academic Remarks"><textarea style={{...INP.base,resize:'vertical'}} rows={2} value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Optional remarks"/></FieldRow>
      <div style={{display:'flex',gap:10,marginTop:18}}>
        <button onClick={handleSave} disabled={saving} style={{...BTN.primary,flex:1,padding:'11px',opacity:saving?.7:1}}>{saving?'Saving…':'Save Scores'}</button>
        <button onClick={onClose} style={{...BTN.secondary,padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── Bulk Operations Modal ────────────────────────────────────────────────────
function BulkOperationsModal({ students, selectedIds, onClose, onRefresh, showToast }) {
  const [action,setAction]=useState('status')
  const [newStatus,setNewStatus]=useState('Active')
  const [targetBatch,setTargetBatch]=useState('')
  const [targetSession,setTargetSession]=useState('')
  const [processing,setProcessing]=useState(false)

  const selectedStudents=students.filter(s=>selectedIds.has(s.id))
  const canPromote=selectedStudents.every(s=>PROMOTION_MAP[s.batch])

  const ACTIONS=[
    {key:'status',  label:'Change Status',       desc:'Update student status in bulk'},
    {key:'promote', label:`Promote to Next Batch ${canPromote?'✓':'⚠'}`, desc:'Auto-promote using promotion map'},
    {key:'session', label:'Change Session',       desc:'Move to a different session'},
    {key:'batch',   label:'Change Batch',         desc:'Assign a specific batch'},
    {key:'delete',  label:'Archive Students',     desc:'Soft-delete selected records',danger:true},
  ]

  const handleBulkAction=async()=>{
    if(selectedIds.size===0){showToast('No students selected',D.rose);return}
    setProcessing(true);const ids=Array.from(selectedIds)
    try{
      if(action==='status'){const{error}=await supabase.from('students').update({status:newStatus}).in('id',ids);if(error)throw error;showToast(`Status → ${newStatus} for ${ids.length} students`,D.emerald)}
      else if(action==='delete'){const{error}=await supabase.from('students').update({deleted_at:new Date().toISOString()}).in('id',ids);if(error)throw error;showToast(`${ids.length} students archived`,D.amber)}
      else if(action==='promote'){if(!canPromote){showToast('Some students cannot be promoted',D.rose);setProcessing(false);return};for(const u of selectedStudents)await supabase.from('students').update({batch:PROMOTION_MAP[u.batch],status:'Active'}).eq('id',u.id);showToast(`${ids.length} students promoted`,D.emerald)}
      else if(action==='session'){if(!targetSession){showToast('Select target session',D.rose);setProcessing(false);return};const{error}=await supabase.from('students').update({session:targetSession}).in('id',ids);if(error)throw error;showToast(`Session → ${targetSession}`,D.emerald)}
      else if(action==='batch'){if(!targetBatch){showToast('Enter target batch',D.rose);setProcessing(false);return};const{error}=await supabase.from('students').update({batch:targetBatch}).in('id',ids);if(error)throw error;showToast(`Batch → ${targetBatch}`,D.emerald)}
      onRefresh();onClose()
    }catch(err){showToast('Action failed: '+err.message,D.rose)}
    setProcessing(false)
  }

  return(
    <Modal onClose={onClose} width={440} title="Bulk Operations" subtitle={`${selectedIds.size} students selected`}>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
        {ACTIONS.map(a=>(
          <div key={a.key}>
            <label style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer',padding:'10px 12px',borderRadius:D.r8,background:action===a.key?(a.danger?D.roseDim:D.brandDim):D.surface2,border:`1px solid ${action===a.key?(a.danger?'#3A1020':D.border2):D.border}`,transition:'all .12s'}}>
              <input type="radio" name="bulkAction" checked={action===a.key} onChange={()=>setAction(a.key)} style={{accentColor:a.danger?D.rose:D.brand}}/>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:a.danger?D.rose:D.textPrimary}}>{a.label}</div>
                <div style={{fontSize:11,color:D.textMuted,marginTop:1}}>{a.desc}</div>
              </div>
            </label>
            {action==='status'&&a.key==='status'&&<select style={{...INP.base,marginTop:6}} value={newStatus} onChange={e=>setNewStatus(e.target.value)}>{STATUSES.filter(s=>s!=='All').map(s=><option key={s}>{s}</option>)}</select>}
            {action==='session'&&a.key==='session'&&<select style={{...INP.base,marginTop:6}} value={targetSession} onChange={e=>setTargetSession(e.target.value)}><option value="">— Select —</option>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select>}
            {action==='batch'&&a.key==='batch'&&<input style={{...INP.base,marginTop:6}} value={targetBatch} onChange={e=>setTargetBatch(e.target.value)} placeholder="e.g. Umeed, Leader"/>}
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10}}>
        <button onClick={handleBulkAction} disabled={processing} style={{...BTN.primary,flex:1,padding:'11px',background:action==='delete'?D.rose:D.brand,opacity:processing?.7:1}}>{processing?'Processing…':action==='delete'?'Archive Selected':'Apply Changes'}</button>
        <button onClick={onClose} style={{...BTN.secondary,padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── Session Rollover Wizard ──────────────────────────────────────────────────
function SessionRolloverWizard({ students, onClose, onRefresh, showToast }) {
  const [step,setStep]=useState(1)
  const [sourceSession,setSourceSession]=useState('2024-25')
  const [targetSession,setTargetSession]=useState('2025-26')
  const [processing,setProcessing]=useState(false)

  const eligibleStudents=students.filter(s=>s.session===sourceSession&&s.status==='Active')
  const promotionPreview=eligibleStudents.map(s=>({...s,newBatch:PROMOTION_MAP[s.batch]||s.batch,newSession:targetSession}))

  const runRollover=async()=>{
    setProcessing(true)
    try{
      for(const s of promotionPreview)await supabase.from('students').update({session:s.newSession,batch:s.newBatch,status:'Active'}).eq('id',s.id)
      const passedOut=eligibleStudents.filter(s=>!PROMOTION_MAP[s.batch])
      for(const s of passedOut)await supabase.from('students').update({status:'Passed Out'}).eq('id',s.id)
      showToast(`Rollover complete! ${promotionPreview.length} students updated.`,D.emerald);onRefresh();onClose()
    }catch(err){showToast('Rollover failed: '+err.message,D.rose)}
    setProcessing(false)
  }

  return(
    <Modal onClose={onClose} width={540} title="Session Rollover Wizard" subtitle={`Step ${step} of 3`}>
      {/* Step indicator */}
      <div style={{display:'flex',gap:8,marginBottom:24,alignItems:'center'}}>
        {[1,2,3].map(n=>(
          <div key={n} style={{display:'flex',alignItems:'center',gap:8,flex:n<3?1:0}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:step>=n?D.brand:D.surface2,border:`1.5px solid ${step>=n?D.brand:D.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:step>=n?'#fff':D.textMuted,flexShrink:0}}>{n}</div>
            <span style={{fontSize:11,fontWeight:600,color:step>=n?D.brand:D.textMuted}}>{['Select','Preview','Confirm'][n-1]}</span>
            {n<3&&<div style={{flex:1,height:1,background:step>n?D.brand:D.border,marginLeft:4}}/>}
          </div>
        ))}
      </div>

      {step===1&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            <FieldRow label="Source Session"><select style={INP.base} value={sourceSession} onChange={e=>setSourceSession(e.target.value)}>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></FieldRow>
            <FieldRow label="Target Session"><select style={INP.base} value={targetSession} onChange={e=>setTargetSession(e.target.value)}>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></FieldRow>
          </div>
          <div style={{background:D.skyDim,border:`1px solid #071E2E`,borderRadius:D.r8,padding:'10px 14px',fontSize:12,color:D.sky}}>
            ℹ Promotes all Active students from {sourceSession} → {targetSession} using the promotion map.
          </div>
        </>
      )}

      {step===2&&(
        <>
          <div style={{marginBottom:16,maxHeight:280,overflowY:'auto',border:`1px solid ${D.border}`,borderRadius:D.r8,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead style={{position:'sticky',top:0}}>
                <tr style={{background:D.surface2}}>
                  {['Student','Current','→ New','Status'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:D.textMuted,borderBottom:`1px solid ${D.border}`,fontSize:10,textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {promotionPreview.map(s=>(
                  <tr key={s.id} style={{borderBottom:`1px solid ${D.border}`}}>
                    <td style={{padding:'7px 10px',fontWeight:600,color:D.textPrimary}}>{s.name}</td>
                    <td style={{padding:'7px 10px',color:D.textMuted,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}>{s.batch} · {s.session}</td>
                    <td style={{padding:'7px 10px',color:D.brand,fontWeight:700,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}>{s.newBatch} · {s.newSession}</td>
                    <td style={{padding:'7px 10px'}}>{!PROMOTION_MAP[s.batch]?<span style={{color:D.rose,fontWeight:700,fontSize:11}}>Passed Out</span>:<span style={{color:D.emerald,fontSize:11}}>Active</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{background:D.amberDim,border:`1px solid #1C1400`,borderRadius:D.r8,padding:'10px 14px',fontSize:12,color:D.amber}}>
            ⚠ {promotionPreview.filter(s=>!PROMOTION_MAP[s.batch]).length} students will be marked as Passed Out.
          </div>
        </>
      )}

      {step===3&&(
        <div style={{textAlign:'center',padding:'32px 20px'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:D.emeraldDim,border:`2px solid ${D.emerald}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 16px'}}>✅</div>
          <div style={{fontWeight:800,fontSize:18,color:D.textPrimary,marginBottom:8,letterSpacing:'-.02em'}}>Ready to Roll Over</div>
          <div style={{fontSize:13,color:D.textMuted,marginBottom:24,lineHeight:1.6}}>
            <strong style={{color:D.textPrimary,fontFamily:"'IBM Plex Mono',monospace"}}>{promotionPreview.length}</strong> students will be updated<br/>
            <span style={{fontFamily:"'IBM Plex Mono',monospace"}}>{sourceSession}</span> → <span style={{fontFamily:"'IBM Plex Mono',monospace",color:D.brand}}>{targetSession}</span>
          </div>
          <button onClick={runRollover} disabled={processing} style={{...BTN.primary,padding:'12px 32px',fontSize:14,opacity:processing?.7:1}}>
            {processing?'Processing…':'Execute Rollover'}
          </button>
        </div>
      )}

      {step<3&&(
        <div style={{display:'flex',justifyContent:'space-between',marginTop:20}}>
          {step>1?<button onClick={()=>setStep(s=>s-1)} style={{...BTN.secondary,padding:'10px 20px'}}>← Back</button>:<div/>}
          <button onClick={()=>setStep(s=>s+1)} style={{...BTN.primary,padding:'10px 24px'}}>Next →</button>
        </div>
      )}
    </Modal>
  )
}

// ─── Bulk Fee Modal ───────────────────────────────────────────────────────────
function BulkFeeModal({ students, selectedIds, onClose, onSaved, showToast }) {
  const [amount,setAmount]=useState('')
  const [monthFor,setMonthFor]=useState('')
  const [method,setMethod]=useState('Cash')
  const [saving,setSaving]=useState(false)
  const selectedStudents=students.filter(s=>selectedIds.has(s.id))
  const totalAmount=Number(amount||0)*selectedStudents.length

  const handleSave=async()=>{
    if(!amount||Number(amount)<=0){showToast('Enter valid amount',D.rose);return}
    if(!monthFor){showToast('Enter month',D.rose);return}
    setSaving(true)
    try{
      const payments=selectedStudents.map(s=>({student_id:s.id,amount:Number(amount),payment_date:new Date().toISOString().slice(0,10),month_for:monthFor,payment_method:method,session:s.session}))
      const{error}=await supabase.from('fee_collections').insert(payments)
      if(error)throw error
      showToast(`Fee collected for ${selectedStudents.length} students`,D.emerald);onSaved();onClose()
    }catch(err){showToast('Bulk fee failed: '+err.message,D.rose)}
    setSaving(false)
  }

  return(
    <Modal onClose={onClose} width={440} title="Bulk Fee Collection" subtitle={`${selectedStudents.length} students selected`}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
        <FieldRow label="Amount per student (₹)"><input type="number" style={INP.base} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 2500"/></FieldRow>
        <FieldRow label="Month For"><input style={INP.base} value={monthFor} onChange={e=>setMonthFor(e.target.value)} placeholder="e.g. Jan 2026"/></FieldRow>
        <FieldRow label="Method"><select style={INP.base} value={method} onChange={e=>setMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option></select></FieldRow>
        <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',gap:2}}>
          <div style={{fontSize:10,color:D.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>Total Collection</div>
          <div style={{fontSize:22,fontWeight:800,color:D.emerald,fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(totalAmount)}</div>
        </div>
      </div>
      <div style={{background:D.surface2,borderRadius:D.r8,padding:'10px 14px',marginBottom:16,border:`1px solid ${D.border}`,maxHeight:100,overflowY:'auto'}}>
        <div style={{fontSize:10,fontWeight:700,color:D.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:'.07em'}}>Selected Students</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
          {selectedStudents.map(s=><span key={s.id} style={{fontSize:11,padding:'2px 8px',borderRadius:D.r4,background:D.brandDim,color:D.brand,fontWeight:600,border:`1px solid #1E3A5F`}}>{s.name}</span>)}
        </div>
      </div>
      <div style={{display:'flex',gap:10}}>
        <button onClick={handleSave} disabled={saving} style={{...BTN.primary,flex:1,padding:'11px',background:D.emerald,opacity:saving?.7:1}}>{saving?'Saving…':'Collect Fee'}</button>
        <button onClick={onClose} style={{...BTN.secondary,padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

// ─── Print helpers (unchanged logic, dark-print CSS added) ───────────────────
function printReportCard(student, exams) {
  const rows=exams.map(e=>`<tr><td>${e.exam_name||'—'}</td>${SUBJECTS.map(s=>`<td style="text-align:center;${e[s]<40?'color:#dc2626;font-weight:700':''}">${e[s]??'—'}</td>`).join('')}<td style="font-weight:800">${e.total??'—'}</td><td>${(e.total||0)>=200?'<span style="color:#059669">Pass</span>':'<span style="color:#dc2626">Fail</span>'}</td></tr>`).join('')
  const w=window.open('','_blank')
  w.document.write(`<html><head><title>Report Card — ${student.name}</title><style>body{font-family:sans-serif;padding:30px;max-width:800px;margin:auto}h2{margin-bottom:2px}h3{color:#666;font-weight:400;margin-bottom:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}th{background:#f1f5f9;font-weight:700}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #3730a3;padding-bottom:10px;margin-bottom:16px}</style></head><body>
    <div class="header"><div><h2>${student.name}</h2><h3>GCC-${student.gcc_no} · ${student.batch} · ${student.course} · ${student.session}</h3></div><div style="text-align:right;font-size:12px;color:#666">GNSI Portal<br>Report Card<br>${new Date().toLocaleDateString('en-IN')}</div></div>
    <table><thead><tr><th>Exam</th>${SUBJECTS.map(s=>`<th>${s.slice(0,4)}</th>`).join('')}<th>Total</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>
    ${student.academic_remarks?`<p style="margin-top:16px;font-size:12px"><strong>Remarks:</strong> ${student.academic_remarks}</p>`:''}
  </body></html>`)
  w.document.close();w.print()
}

function printIDCard(student) {
  const w=window.open('','_blank')
  w.document.write(`<html><head><title>ID Card</title><style>body{margin:0;display:flex;justify-content:center;padding:20px;background:#f1f5f9}@media print{body{padding:0;background:#fff}}.card{width:3.375in;height:2.125in;border:1px solid #ccc;border-radius:8px;overflow:hidden;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.1)}.header{background:#3730a3;color:#fff;padding:8px 12px;display:flex;align-items:center;gap:8px}.header .logo{font-size:18px;font-weight:900}.header .title{font-size:10px;font-weight:700;line-height:1.3}.body{display:flex;padding:10px 12px;gap:10px;align-items:flex-start}.photo{width:56px;height:70px;border:1px solid #ccc;border-radius:4px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}.info{flex:1}.name{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:3px}.field{font-size:9px;color:#475569;margin-bottom:2px}.field span{font-weight:700;color:#0f172a}.gcc{font-size:16px;font-weight:900;color:#3730a3;font-family:monospace;margin-top:4px}</style></head><body>
  <div class="card">
    <div class="header"><div class="logo">GNSI</div><div class="title">Guidance Navodaya &amp; Sainik Institute<br>Khangabok, Thoubal, Manipur</div></div>
    <div class="body">
      <div class="photo">${student.photo_url?`<img src="${student.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px"/>`:'👤'}</div>
      <div class="info">
        <div class="name">${student.name}</div>
        <div class="field">Batch: <span>${student.batch||'—'}</span></div>
        <div class="field">Course: <span>${student.course||'—'}</span></div>
        <div class="field">House: <span>${student.house||'—'}</span></div>
        <div class="field">Session: <span>${student.session||'—'}</span></div>
        <div class="gcc">GCC-${student.gcc_no}</div>
      </div>
    </div>
  </div>
  <script>window.print()<\/script></body></html>`)
  w.document.close()
}

function printBatchList(students, filterLabel) {
  const rows=students.map((s,i)=>`<tr><td>${i+1}</td><td>${s.gcc_no||''}</td><td>${s.name}</td><td>${s.batch||''}</td><td>${s.house||''}</td><td>${s.hostel_type||''}</td><td>${s.phone||''}</td></tr>`).join('')
  const w=window.open('','_blank')
  w.document.write(`<html><head><title>Batch List</title><style>body{font-family:sans-serif;font-size:11px;padding:20px}h2{margin-bottom:4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f1f5f9;font-weight:700}</style></head><body><h2>Student List — GNSI ${filterLabel?`(${filterLabel})`:''}</h2><p style="color:#666;margin-bottom:12px">Total: ${students.length} · Printed: ${new Date().toLocaleDateString('en-IN')}</p><table><thead><tr><th>#</th><th>GCC</th><th>Name</th><th>Batch</th><th>House</th><th>Hostel</th><th>Phone</th></tr></thead><tbody>${rows}</tbody></table></body></html>`)
  w.document.close();w.print()
}

function printAdmissionForm(student) {
  const field=(label,value)=>`<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em">${label}</div><div style="border-bottom:1px solid #000;min-height:22px;padding:2px 4px;font-size:13px">${value||''}</div></div>`
  const w=window.open('','_blank')
  w.document.write(`<html><head><title>Admission Form</title><style>body{font-family:sans-serif;padding:30px;max-width:720px;margin:auto}h2{text-align:center;font-size:18px}h3{text-align:center;color:#666;font-weight:400;margin-bottom:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}</style></head><body>
    <h2>Guidance Navodaya &amp; Sainik Institute</h2>
    <h3>Khangabok, Thoubal, Manipur — Admission Form</h3>
    <div class="grid">
      ${field('Full Name',student.name)}${field('GCC No.',student.gcc_no)}${field('Date of Birth',student.dob)}${field('Gender',student.gender)}
      ${field('Course',student.course)}${field('Batch',student.batch)}${field('Session',student.session)}${field('House',student.house)}
      ${field('Hostel Type',student.hostel_type)}${field('Admission Date',student.admission_date)}
      ${field("Father's Name",student.father_name)}${field("Mother's Name",student.mother_name)}
      ${field('Contact Phone',student.phone)}${field('Referral Source',student.referral_source)}
      <div style="grid-column:1/-1">${field('Address',student.address)}</div>
      ${field('Previous School',student.prev_school)}${field('Emergency Contact',student.emergency_contact)}
      ${field('Medical Notes',student.medical_notes)}${field('Remarks',student.remarks)}
    </div>
    <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:12px">
      <div>Student Signature: _________________</div>
      <div>Parent Signature: _________________</div>
      <div>Authorized By: _________________</div>
    </div>
  </body></html>`)
  w.document.close();w.print()
}

function printFeeReceipt(student, payment) {
  const w=window.open('','_blank')
  w.document.write(`<html><head><title>Fee Receipt — ${student.name}</title>
    <style>body{font-family:sans-serif;padding:30px;max-width:600px;margin:auto}.header{text-align:center;border-bottom:2px solid #3730a3;padding-bottom:16px;margin-bottom:20px}.logo{font-size:24px;font-weight:900;color:#3730a3}.title{font-size:14px;color:#666;margin-top:4px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.label{font-weight:600;color:#475569}.value{font-weight:700;color:#0f172a}.amount{font-size:28px;font-weight:800;color:#059669;text-align:center;margin:20px 0}.footer{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#666}.stamp{width:80px;height:80px;border:2px dashed #ccc;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;margin:20px auto}</style>
  </head><body>
    <div class="header"><div class="logo">GNSI</div><div class="title">Guidance Navodaya &amp; Sainik Institute<br>Khangabok, Thoubal, Manipur</div><div style="font-size:11px;color:#666;margin-top:8px">Receipt #: ${payment.id||'N/A'} · Date: ${fmtD(payment.payment_date)}</div></div>
    <div><div class="row"><span class="label">Student Name</span><span class="value">${student.name}</span></div><div class="row"><span class="label">GCC No.</span><span class="value">${student.gcc_no}</span></div><div class="row"><span class="label">Batch / Course</span><span class="value">${student.batch} · ${student.course}</span></div><div class="row"><span class="label">Session</span><span class="value">${student.session}</span></div><div class="row"><span class="label">Month For</span><span class="value">${payment.month_for||'N/A'}</span></div><div class="row"><span class="label">Payment Method</span><span class="value">${payment.payment_method||'Cash'}</span></div></div>
    <div class="amount">₹${fmt(payment.amount)}</div>
    <div class="stamp">OFFICE STAMP</div>
    <div class="footer"><div>Received by: _________________</div><div>Authorized by: _________________</div></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
  </body></html>`)
  w.document.close()
}

// ─── Analytics Components ─────────────────────────────────────────────────────
function HouseCensus({ students }) {
  const byHouse=HOUSES_LIST.reduce((acc,h)=>{acc[h]=students.filter(s=>s.house===h).length;return acc},{})
  const maxCount=Math.max(...Object.values(byHouse),1)
  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r12,padding:'20px'}}>
      <div style={{fontWeight:800,fontSize:13,color:D.textPrimary,marginBottom:16,textTransform:'uppercase',letterSpacing:'.07em'}}>House Census</div>
      {HOUSES_LIST.map(h=>{
        const count=byHouse[h]||0;const color=HOUSE_COLORS[h]||D.textMuted
        return(
          <div key={h} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <span style={{width:72,fontSize:11,fontWeight:600,color,textAlign:'right',flexShrink:0}}>{h}</span>
            <div style={{flex:1,height:6,background:D.surface2,borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${(count/maxCount)*100}%`,background:color,borderRadius:3,transition:'width .4s'}}/>
            </div>
            <span style={{width:20,fontSize:12,fontWeight:700,color:D.textPrimary,fontFamily:"'IBM Plex Mono',monospace",textAlign:'right'}}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function CourseDonut({ students }) {
  const counts=Object.keys(COURSE_STRUCTURE).reduce((acc,c)=>{acc[c]=students.filter(s=>s.course===c).length;return acc},{})
  const total=Object.values(counts).reduce((a,b)=>a+b,0)||1
  const colors=[D.brand,D.emerald,D.violet,D.amber]
  const keys=Object.keys(COURSE_STRUCTURE)
  let offset=0
  const slices=keys.map((k,i)=>{const pct=counts[k]/total*100;const slice={key:k,pct,offset,color:colors[i]};offset+=pct;return slice})

  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r12,padding:'20px'}}>
      <div style={{fontWeight:800,fontSize:13,color:D.textPrimary,marginBottom:16,textTransform:'uppercase',letterSpacing:'.07em'}}>Course Distribution</div>
      <div style={{display:'flex',gap:20,alignItems:'center'}}>
        <svg width={90} height={90} viewBox="0 0 36 36">
          {slices.map(s=>{
            const r=15.9;const circ=2*Math.PI*r
            const dash=s.pct/100*circ;const gap=circ-dash
            const rotate=-90+(s.offset/100*360)
            return<circle key={s.key} cx="18" cy="18" r={r} fill="none" stroke={s.color} strokeWidth="4" strokeDasharray={`${dash} ${gap}`} transform={`rotate(${rotate} 18 18)`}/>
          })}
          <circle cx="18" cy="18" r="12" fill={D.surface}/>
          <text x="18" y="21" textAnchor="middle" fontSize="6" fontWeight="800" fill={D.textPrimary}>{students.length}</text>
        </svg>
        <div style={{flex:1}}>
          {slices.map(s=>(
            <div key={s.key} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <div style={{width:8,height:8,borderRadius:2,background:s.color,flexShrink:0}}/>
              <span style={{fontSize:12,color:D.textSecondary,flex:1}}>{s.key}</span>
              <span style={{fontSize:12,fontWeight:700,color:D.textPrimary,fontFamily:"'IBM Plex Mono',monospace"}}>{counts[s.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GenderRatio({ students }) {
  const male=students.filter(s=>s.gender==='Male').length
  const female=students.filter(s=>s.gender==='Female').length
  const total=male+female||1
  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r12,padding:'20px'}}>
      <div style={{fontWeight:800,fontSize:13,color:D.textPrimary,marginBottom:14,textTransform:'uppercase',letterSpacing:'.07em'}}>Gender Ratio</div>
      <div style={{display:'flex',height:8,borderRadius:4,overflow:'hidden',marginBottom:12}}>
        <div style={{width:`${male/total*100}%`,background:'#60A5FA',transition:'width .4s'}}/>
        <div style={{width:`${female/total*100}%`,background:'#F472B6',transition:'width .4s'}}/>
      </div>
      <div style={{display:'flex',gap:20,fontSize:12}}>
        <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:8,height:8,borderRadius:2,background:'#60A5FA',display:'inline-block'}}/><span style={{fontWeight:800,color:'#60A5FA',fontFamily:"'IBM Plex Mono',monospace"}}>{male}</span><span style={{color:D.textMuted}}> Male</span></span>
        <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:8,height:8,borderRadius:2,background:'#F472B6',display:'inline-block'}}/><span style={{fontWeight:800,color:'#F472B6',fontFamily:"'IBM Plex Mono',monospace"}}>{female}</span><span style={{color:D.textMuted}}> Female</span></span>
      </div>
    </div>
  )
}

function HostelBreakdown({ students }) {
  const types=['Boarder','Day Boarder','Day Scholar']
  const counts=types.reduce((acc,t)=>{acc[t]=students.filter(s=>s.hostel_type===t).length;return acc},{})
  const total=Object.values(counts).reduce((a,b)=>a+b,0)||1
  const colors={Boarder:D.emerald,'Day Boarder':D.amber,'Day Scholar':D.textMuted}
  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r12,padding:'20px'}}>
      <div style={{fontWeight:800,fontSize:13,color:D.textPrimary,marginBottom:14,textTransform:'uppercase',letterSpacing:'.07em'}}>Hostel Breakdown</div>
      <div style={{display:'flex',gap:8}}>
        {types.map(t=>(
          <div key={t} style={{flex:1,background:D.surface2,border:`1px solid ${D.border}`,borderRadius:D.r8,padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:22,fontWeight:800,color:colors[t],fontFamily:"'IBM Plex Mono',monospace"}}>{counts[t]}</div>
            <div style={{fontSize:10,fontWeight:700,color:colors[t],marginTop:4,textTransform:'uppercase',letterSpacing:'.06em'}}>{t}</div>
            <div style={{fontSize:10,color:D.textMuted,marginTop:2}}>{(counts[t]/total*100).toFixed(0)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AttendanceHostelBreakdown({ students, attData }) {
  const types=['Boarder','Day Boarder','Day Scholar']
  const data=types.map(t=>{const group=students.filter(s=>s.hostel_type===t&&attData[s.id]!=null);const avg=group.length?group.reduce((a,s)=>a+attData[s.id],0)/group.length:0;return{type:t,count:group.length,avg:avg.toFixed(1)}})
  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r12,padding:'20px'}}>
      <div style={{fontWeight:800,fontSize:13,color:D.textPrimary,marginBottom:14,textTransform:'uppercase',letterSpacing:'.07em'}}>Attendance by Hostel</div>
      <div style={{display:'flex',gap:8}}>
        {data.map(d=>(
          <div key={d.type} style={{flex:1,background:D.surface2,border:`1px solid ${D.border}`,borderRadius:D.r8,padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:22,fontWeight:800,color:d.avg>=75?D.emerald:D.rose,fontFamily:"'IBM Plex Mono',monospace"}}>{d.avg}%</div>
            <div style={{fontSize:10,fontWeight:700,color:D.textMuted,marginTop:4,textTransform:'uppercase',letterSpacing:'.06em'}}>{d.type}</div>
            <div style={{fontSize:10,color:D.textMuted,marginTop:2}}>{d.count} students</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AttendanceFeeCorrelation({ students, attData, feeData }) {
  const data=useMemo(()=>{
    const groups={'High Att · Clear':[],'High Att · Due':[],'Low Att · Clear':[],'Low Att · Due':[]}
    students.forEach(s=>{const att=attData[s.id];const dues=feeData[s.id]?.dues||0;if(att==null)return;const highAtt=att>=75;const clear=dues===0;if(highAtt&&clear)groups['High Att · Clear'].push(s);else if(highAtt&&!clear)groups['High Att · Due'].push(s);else if(!highAtt&&clear)groups['Low Att · Clear'].push(s);else groups['Low Att · Due'].push(s)})
    return groups
  },[students,attData,feeData])
  const colors={'High Att · Clear':D.emerald,'High Att · Due':D.amber,'Low Att · Clear':D.sky,'Low Att · Due':D.rose}
  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r12,padding:'20px'}}>
      <div style={{fontWeight:800,fontSize:13,color:D.textPrimary,marginBottom:14,textTransform:'uppercase',letterSpacing:'.07em'}}>Att. vs Fee Correlation</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {Object.entries(data).map(([label,group])=>(
          <div key={label} style={{padding:'12px',borderRadius:D.r8,background:D.surface2,border:`1px solid ${D.border}`}}>
            <div style={{fontSize:24,fontWeight:800,color:colors[label],fontFamily:"'IBM Plex Mono',monospace"}}>{group.length}</div>
            <div style={{fontSize:10,fontWeight:700,color:D.textMuted,marginTop:4,textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SessionAttendanceTrend({ students, attData }) {
  const sessionData=useMemo(()=>{
    const bySession={}
    students.forEach(s=>{if(!s.session||attData[s.id]==null)return;if(!bySession[s.session])bySession[s.session]={total:0,count:0};bySession[s.session].total+=attData[s.id];bySession[s.session].count++})
    return Object.entries(bySession).map(([session,data])=>({session,avg:(data.total/data.count).toFixed(1)})).sort((a,b)=>a.session.localeCompare(b.session))
  },[students,attData])
  const maxVal=Math.max(...sessionData.map(d=>Number(d.avg)),1)
  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r12,padding:'20px'}}>
      <div style={{fontWeight:800,fontSize:13,color:D.textPrimary,marginBottom:14,textTransform:'uppercase',letterSpacing:'.07em'}}>Session-wise Attendance</div>
      <div style={{display:'flex',gap:12,alignItems:'flex-end',height:56}}>
        {sessionData.map(d=>(
          <div key={d.session} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
            <div style={{fontSize:10,fontWeight:700,color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace"}}>{d.avg}%</div>
            <div style={{width:'100%',height:`${(Number(d.avg)/maxVal)*40}px`,minHeight:4,background:Number(d.avg)>=75?D.emerald:D.rose,borderRadius:3,transition:'height .3s'}}/>
            <div style={{fontSize:9,fontWeight:600,color:D.textMuted}}>{d.session}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
function AlertsPanel({ students }) {
  const batchCounts=students.filter(s=>s.status==='Active').reduce((acc,s)=>{if(s.batch){acc[s.batch]=(acc[s.batch]||0)+1}return acc},{})
  const overCapacity=Object.entries(batchCounts).filter(([,c])=>c>BATCH_CAPACITY).map(([b,c])=>({batch:b,count:c}))
  const inactive=students.filter(s=>s.status==='Inactive').length
  const nearSessionEnd=new Date().getMonth()>=1

  const alerts=[
    ...overCapacity.map(b=>({type:'warn',msg:`Batch "${b.batch}" has ${b.count} students (capacity: ${BATCH_CAPACITY})`})),
    nearSessionEnd?{type:'info',msg:'Session end approaching — consider running Session Rollover Wizard'}:null,
    inactive>0?{type:'info',msg:`${inactive} students are marked Inactive — review their status`}:null,
  ].filter(Boolean)

  if(!alerts.length)return null

  return(
    <div style={{marginBottom:12}}>
      {alerts.map((a,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 14px',borderRadius:D.r8,background:a.type==='warn'?D.orangeDim:D.skyDim,border:`1px solid ${a.type==='warn'?D.orange+'30':'#071E2E'}`,marginBottom:4}}>
          <span style={{fontSize:13}}>{a.type==='warn'?'⚠':'ℹ'}</span>
          <span style={{flex:1,fontSize:12,fontWeight:600,color:a.type==='warn'?D.orange:D.sky}}>{a.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Fee Banners ──────────────────────────────────────────────────────────────
function FeeOverdueBanner({ students, feeData }) {
  const overdueStudents=students.filter(s=>{const dues=feeData[s.id]?.dues||0;const lastPaid=feeData[s.id]?.lastPaid;if(dues<=0)return false;if(!lastPaid)return true;return(Date.now()-new Date(lastPaid).getTime())/(1000*60*60*24)>30})
  if(overdueStudents.length===0)return null
  return(
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderRadius:D.r8,background:D.roseDim,border:`1px solid #3A1020`,marginBottom:10}}>
      <span style={{fontSize:14}}>💰</span>
      <span style={{flex:1,fontSize:12,fontWeight:700,color:D.rose}}>{overdueStudents.length} students have fee dues overdue by 30+ days</span>
      <button onClick={()=>downloadCSV(overdueStudents.map(s=>({GCC:s.gcc_no,Name:s.name,Dues:feeData[s.id]?.dues,Phone:s.phone||''})),`overdue_fees_${new Date().toISOString().slice(0,10)}.csv`)} style={{...BTN.danger,fontSize:11,padding:'4px 10px'}}>Export</button>
    </div>
  )
}

function UpcomingDueReminder({ students, feeData }) {
  const dayOfMonth=new Date().getDate()
  const daysUntilDue=10-dayOfMonth
  if(daysUntilDue<0||daysUntilDue>5)return null
  const pendingCount=students.filter(s=>s.status==='Active'&&(feeData[s.id]?.dues||0)>0).length
  if(pendingCount===0)return null
  return(
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderRadius:D.r8,background:D.amberDim,border:`1px solid #1C1400`,marginBottom:10}}>
      <span style={{fontSize:14}}>⏰</span>
      <span style={{flex:1,fontSize:12,fontWeight:700,color:D.amber}}>Fee due date in {daysUntilDue} days — {pendingCount} students have pending dues</span>
    </div>
  )
}

// ─── Session History / Historical Exams (drawer tabs) ────────────────────────
function SessionHistoryTab({ student, showToast }) {
  const [history,setHistory]=useState([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    const load=async()=>{
      const{data}=await supabase.from('students').select('session,batch,status,created_at,updated_at').eq('id',student.id).order('created_at',{ascending:false})
      const{data:exams}=await supabase.from('exam_scores').select('session,exam_name,total,created_at').eq('student_id',student.id).order('created_at',{ascending:false})
      const{data:fees}=await supabase.from('fee_collections').select('session,amount,month_for,payment_date').eq('student_id',student.id).order('payment_date',{ascending:false})
      const combined=[]
      if(data?.[0]){
        const sessions=[...new Set([data[0].session,...(exams||[]).map(e=>e.session),...(fees||[]).map(f=>f.session)])].filter(Boolean)
        sessions.forEach(sess=>{const sessExams=(exams||[]).filter(e=>e.session===sess);const sessFees=(fees||[]).filter(f=>f.session===sess);const totalPaid=sessFees.reduce((a,f)=>a+Number(f.amount),0);combined.push({session:sess,batch:data[0].batch,status:data[0].status,exams:sessExams.length,avgScore:sessExams.length?(sessExams.reduce((a,e)=>a+(e.total||0),0)/sessExams.length).toFixed(0):'—',feesPaid:totalPaid,feeRecords:sessFees.length})})
      }
      setHistory(combined);setLoading(false)
    }
    load()
  },[student.id])

  return(
    <div>
      <div style={{fontWeight:700,fontSize:12,color:D.textMuted,marginBottom:12,textTransform:'uppercase',letterSpacing:'.08em'}}>Session History</div>
      {loading?<div style={{color:D.textMuted}}>Loading…</div>:history.length===0?<div style={{color:D.textMuted,fontSize:13,textAlign:'center',padding:'20px'}}>No historical data.</div>:(
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{background:D.surface2}}>
              {['Session','Batch','Exams','Avg Score','Fees Paid'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:h==='Session'||h==='Batch'?'left':'center',fontWeight:700,color:D.textMuted,borderBottom:`1px solid ${D.border}`,fontSize:10,textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {history.map((h,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                <td style={{padding:'7px 10px',fontWeight:600,color:D.textPrimary,fontFamily:"'IBM Plex Mono',monospace"}}>{h.session}</td>
                <td style={{padding:'7px 10px',color:D.textSecondary}}>{h.batch}</td>
                <td style={{padding:'7px 10px',textAlign:'center',color:D.textMuted}}>{h.exams}</td>
                <td style={{padding:'7px 10px',textAlign:'center',fontWeight:700,color:D.brand,fontFamily:"'IBM Plex Mono',monospace"}}>{h.avgScore}</td>
                <td style={{padding:'7px 10px',textAlign:'right',color:D.emerald,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(h.feesPaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function HistoricalExamScores({ student, showToast }) {
  const [scores,setScores]=useState([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    const load=async()=>{
      const{data}=await supabase.from('exam_scores').select('*').eq('student_id',student.id).order('created_at',{ascending:false})
      const bySession={}
      ;(data||[]).forEach(e=>{const sess=e.session||'Unknown';if(!bySession[sess])bySession[sess]=[];bySession[sess].push(e)})
      setScores(Object.entries(bySession).map(([session,exams])=>({session,exams:exams.slice(0,5),avg:exams.length?(exams.reduce((a,e)=>a+(e.total||0),0)/exams.length).toFixed(0):0,best:Math.max(...exams.map(e=>e.total||0),0)})))
      setLoading(false)
    }
    load()
  },[student.id])

  return(
    <div>
      <div style={{fontWeight:700,fontSize:12,color:D.textMuted,marginBottom:12,textTransform:'uppercase',letterSpacing:'.08em'}}>Historical Exam Performance</div>
      {loading?<div style={{color:D.textMuted}}>Loading…</div>:scores.length===0?<div style={{color:D.textMuted,fontSize:13,textAlign:'center',padding:'20px'}}>No exam records across sessions.</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {scores.map((sess,idx)=>(
            <div key={idx} style={{background:D.surface2,borderRadius:D.r8,padding:'12px 16px',border:`1px solid ${D.border}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:13,color:D.textPrimary,fontFamily:"'IBM Plex Mono',monospace"}}>{sess.session}</span>
                <span style={{fontSize:11,color:D.textMuted}}>Avg <span style={{color:D.brand,fontWeight:700}}>{sess.avg}</span> · Best <span style={{color:D.emerald,fontWeight:700}}>{sess.best}</span></span>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {sess.exams.map((e,i)=>(
                  <span key={i} style={{fontSize:11,padding:'3px 9px',borderRadius:D.r4,background:(e.total||0)>=200?D.emeraldDim:D.roseDim,color:(e.total||0)>=200?D.emerald:D.rose,fontWeight:600,border:`1px solid ${(e.total||0)>=200?'#064E3B':'#3A1020'}`,fontFamily:"'IBM Plex Mono',monospace"}}>
                    {e.exam_name||`E${i+1}`}: {e.total}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── House Census / Other Modals ──────────────────────────────────────────────
function HouseReassignmentModal({ students, selectedIds, onClose, onRefresh, showToast }) {
  const [newHouse,setNewHouse]=useState('')
  const [processing,setProcessing]=useState(false)
  const handleReassign=async()=>{
    if(!newHouse){showToast('Select a house',D.rose);return}
    setProcessing(true)
    try{const{error}=await supabase.from('students').update({house:newHouse}).in('id',Array.from(selectedIds));if(error)throw error;showToast(`${selectedIds.size} students moved to ${newHouse}`,D.emerald);onRefresh();onClose()}
    catch(err){showToast('Failed: '+err.message,D.rose)}
    setProcessing(false)
  }
  return(
    <Modal onClose={onClose} width={380} title="Bulk House Reassignment" subtitle={`${selectedIds.size} students selected`}>
      <FieldRow label="New House"><select style={INP.base} value={newHouse} onChange={e=>setNewHouse(e.target.value)}><option value="">— Select House —</option>{HOUSES_LIST.map(h=><option key={h}>{h}</option>)}</select></FieldRow>
      <div style={{display:'flex',gap:10,marginTop:16}}>
        <button onClick={handleReassign} disabled={processing} style={{...BTN.primary,flex:1,padding:'11px'}}>Reassign Houses</button>
        <button onClick={onClose} style={{...BTN.secondary,padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

function CarryForwardModal({ students, selectedIds, feeData, onClose, onRefresh, showToast }) {
  const [targetSession,setTargetSession]=useState('')
  const [processing,setProcessing]=useState(false)
  const selectedStudents=students.filter(s=>selectedIds.has(s.id))
  const totalDues=selectedStudents.reduce((a,s)=>a+(feeData[s.id]?.dues||0),0)

  const handleCarryForward=async()=>{
    if(!targetSession){showToast('Select target session',D.rose);return}
    setProcessing(true)
    try{
      const entries=selectedStudents.filter(s=>feeData[s.id]?.dues>0).map(s=>({student_id:s.id,amount:0,payment_date:new Date().toISOString().slice(0,10),month_for:`Opening Balance ${targetSession}`,payment_method:'Carry Forward',session:targetSession,notes:`Brought forward. Dues: ₹${feeData[s.id].dues}`}))
      if(entries.length>0){const{error}=await supabase.from('fee_collections').insert(entries);if(error)throw error}
      showToast(`${entries.length} carry-forward entries created`,D.emerald);onRefresh();onClose()
    }catch(err){showToast('Failed: '+err.message,D.rose)}
    setProcessing(false)
  }

  return(
    <Modal onClose={onClose} width={420} title="Carry-Forward Dues" subtitle={`${selectedStudents.length} students · Total dues: ₹${fmt(totalDues)}`}>
      <FieldRow label="Target Session"><select style={INP.base} value={targetSession} onChange={e=>setTargetSession(e.target.value)}><option value="">— Select —</option>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></FieldRow>
      <div style={{background:D.amberDim,border:`1px solid #1C1400`,borderRadius:D.r8,padding:'10px 14px',marginTop:12,fontSize:12,color:D.amber}}>⚠ Creates opening balance entries in fee_collections for the new session.</div>
      <div style={{display:'flex',gap:10,marginTop:16}}>
        <button onClick={handleCarryForward} disabled={processing} style={{...BTN.primary,flex:1,padding:'11px'}}>Carry Forward</button>
        <button onClick={onClose} style={{...BTN.secondary,padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

function MergeDuplicatesModal({ students, onClose, onRefresh, showToast }) {
  const [primaryId,setPrimaryId]=useState('')
  const [mergeIds,setMergeIds]=useState([])
  const [processing,setProcessing]=useState(false)

  const duplicates=useMemo(()=>{
    const dups=[];const byName={};const byPhone={}
    students.forEach(s=>{if(s.name){const key=s.name.toLowerCase().trim();if(!byName[key])byName[key]=[];byName[key].push(s)};if(s.phone){if(!byPhone[s.phone])byPhone[s.phone]=[];byPhone[s.phone].push(s)}})
    Object.values(byName).forEach(group=>{if(group.length>1)dups.push({type:'Name',students:group})})
    Object.values(byPhone).forEach(group=>{if(group.length>1)dups.push({type:'Phone',students:group})})
    return dups
  },[students])

  const handleMerge=async()=>{
    if(!primaryId||mergeIds.length===0){showToast('Select records to merge',D.rose);return}
    setProcessing(true)
    try{
      await supabase.from('attendance').update({student_id:primaryId}).in('student_id',mergeIds)
      await supabase.from('fee_collections').update({student_id:primaryId}).in('student_id',mergeIds)
      await supabase.from('exam_scores').update({student_id:primaryId}).in('student_id',mergeIds)
      await supabase.from('student_documents').update({student_id:primaryId}).in('student_id',mergeIds)
      await supabase.from('students').delete().in('id',mergeIds)
      showToast('Records merged successfully',D.emerald);onRefresh();onClose()
    }catch(err){showToast('Merge failed: '+err.message,D.rose)}
    setProcessing(false)
  }

  return(
    <Modal onClose={onClose} width={480} title="Merge Duplicate Records" subtitle={`${duplicates.length} duplicate groups found`}>
      <div style={{maxHeight:340,overflowY:'auto'}}>
        {duplicates.map((group,idx)=>(
          <div key={idx} style={{marginBottom:12,padding:'12px',background:D.surface2,borderRadius:D.r8,border:`1px solid ${D.border}`}}>
            <div style={{fontWeight:700,fontSize:11,color:D.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:'.07em'}}>{group.type} Match</div>
            {group.students.map(s=>(
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:`1px solid ${D.border}`}}>
                <input type="radio" name={`primary_${idx}`} checked={primaryId===s.id} onChange={()=>{setPrimaryId(s.id);setMergeIds(group.students.filter(x=>x.id!==s.id).map(x=>x.id))}} style={{accentColor:D.brand}}/>
                <Avatar name={s.name} size={24}/>
                <span style={{fontSize:13,fontWeight:600,color:D.textPrimary}}>{s.name}</span>
                <span style={{fontSize:11,color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{s.gcc_no}</span>
                <span style={{fontSize:11,color:D.textMuted}}>{s.phone}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10,marginTop:16}}>
        <button onClick={handleMerge} disabled={processing} style={{...BTN.primary,flex:1,padding:'11px'}}>Merge Selected</button>
        <button onClick={onClose} style={{...BTN.secondary,padding:'11px 18px'}}>Cancel</button>
      </div>
    </Modal>
  )
}

function SessionComparison({ students, sessionA, sessionB }) {
  const inA=students.filter(s=>s.session===sessionA).length
  const inB=students.filter(s=>s.session===sessionB).length
  const delta=inB-inA
  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.r12,padding:'16px 20px',marginBottom:12}}>
      <div style={{fontWeight:800,fontSize:13,color:D.textPrimary,marginBottom:12,textTransform:'uppercase',letterSpacing:'.07em'}}>Session Comparison</div>
      <div style={{display:'flex',gap:16,alignItems:'center'}}>
        <div style={{textAlign:'center',flex:1}}>
          <div style={{fontSize:32,fontWeight:800,color:D.brand,fontFamily:"'IBM Plex Mono',monospace"}}>{inA}</div>
          <div style={{fontSize:11,color:D.textMuted,fontWeight:700,marginTop:3}}>{sessionA}</div>
        </div>
        <div style={{fontSize:20,color:D.textMuted}}>→</div>
        <div style={{textAlign:'center',flex:1}}>
          <div style={{fontSize:32,fontWeight:800,color:D.emerald,fontFamily:"'IBM Plex Mono',monospace"}}>{inB}</div>
          <div style={{fontSize:11,color:D.textMuted,fontWeight:700,marginTop:3}}>{sessionB}</div>
        </div>
        <div style={{textAlign:'center',minWidth:80,background:D.surface2,borderRadius:D.r8,padding:'10px',border:`1px solid ${D.border}`}}>
          <div style={{fontSize:22,fontWeight:800,color:delta>=0?D.emerald:D.rose,fontFamily:"'IBM Plex Mono',monospace"}}>{delta>0?'+':''}{delta}</div>
          <div style={{fontSize:10,color:D.textMuted,marginTop:2}}>Delta</div>
        </div>
      </div>
    </div>
  )
}

// ─── Misc Export Helpers ──────────────────────────────────────────────────────
function exportNewAdmissions(students) {
  const thirtyDaysAgo=new Date();thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30)
  const newAdmissions=students.filter(s=>s.admission_date&&new Date(s.admission_date)>=thirtyDaysAgo)
  downloadCSV(newAdmissions.map(s=>({Admission_Date:s.admission_date||'',GCC_No:s.gcc_no||'',Name:s.name||'',Course:s.course||'',Batch:s.batch||'',Session:s.session||'',Hostel_Type:s.hostel_type||'',Father:s.father_name||'',Phone:s.phone||'',Referral:s.referral_source||''})),`new_admissions_${new Date().toISOString().slice(0,10)}.csv`)
}

function exportAttendanceSheet(students, attData) {
  downloadCSV(students.map(s=>({GCC_No:s.gcc_no||'',Name:s.name||'',Batch:s.batch||'',House:s.house||'',Hostel:s.hostel_type||'',Att_Pct:attData[s.id]!=null?`${attData[s.id].toFixed(1)}%`:'—',Status:s.status||''})),`attendance_${new Date().toISOString().slice(0,10)}.csv`)
}

function getAge(dob) {
  if(!dob)return null
  const today=new Date();const birth=new Date(dob)
  let age=today.getFullYear()-birth.getFullYear()
  const m=today.getMonth()-birth.getMonth()
  if(m<0||(m===0&&today.getDate()<birth.getDate()))age--
  return age
}

// ─── Student Form ─────────────────────────────────────────────────────────────
function StudentForm({ onSave, onCancel, editing, allStudents }) {
  const blank={name:'',gcc_no:'',dob:'',gender:'Male',course:'',batch:'',house:'',session:'',hostel_type:'Day Scholar',status:'Active',father_name:'',mother_name:'',phone:'',address:'',remarks:'',fee_waiver:0,scholarship:0,fee_waiver_note:'',emergency_contact:'',prev_school:'',referral_source:'',admission_date:new Date().toISOString().slice(0,10),left_date:'',medical_notes:'',academic_remarks:''}
  const savedDraft=!editing?(()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'null')}catch{return null}})():null
  const[form,setForm]=useState(savedDraft||(editing?Object.fromEntries(Object.entries({...blank,...editing}).map(([k,v])=>[k,v??''])):blank))
  const[errors,setErrors]=useState({})
  const[saving,setSaving]=useState(false)
  const[draftSaved,setDraftSaved]=useState(false)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))

  useEffect(()=>{if(editing)return;const t=setTimeout(()=>{localStorage.setItem(DRAFT_KEY,JSON.stringify(form));setDraftSaved(true);setTimeout(()=>setDraftSaved(false),1500)},1000);return()=>clearTimeout(t)},[form,editing])
  useEffect(()=>{if(!form.house)return;if(DAY_SCHOLAR_HOUSES.includes(form.house))set('hostel_type','Day Scholar');else if(form.hostel_type==='Day Scholar')set('hostel_type','Boarder')},[form.house])

  const derived=deriveHostelType(form.house,form.hostel_type)
  const hs=HOSTEL_STYLES[derived]||HOSTEL_STYLES['Day Scholar']
  const subtypes=COURSE_STRUCTURE[form.course]?.subtypes??[]
  const gccDup=form.gcc_no?allStudents.find(s=>s.gcc_no?.toString()===form.gcc_no?.toString()&&s.id!==editing?.id):null
  const phoneDup=form.phone?.trim()?allStudents.find(s=>s.phone?.trim()===form.phone?.trim()&&s.id!==editing?.id):null
  const validate=()=>{const e={};if(!form.name?.trim())e.name='Name is required';if(!form.gcc_no?.toString().trim())e.gcc_no='GCC No. is required';if(gccDup)e.gcc_no=`GCC ${form.gcc_no} already used by ${gccDup.name}`;if(phoneDup)e.phone=`Phone used by ${phoneDup.name}`;setErrors(e);return Object.keys(e).length===0}
  const handleSave=async()=>{if(!validate())return;setSaving(true);await onSave(editing?.id||null,{...form,hostel_type:derived});setSaving(false);if(!editing)localStorage.removeItem(DRAFT_KEY)}

  return(
    <div style={{background:D.surface,border:`1px solid ${D.border2}`,borderRadius:D.r12,overflow:'hidden',marginBottom:16}}>
      {/* Form header */}
      <div style={{background:D.surface2,borderBottom:`1px solid ${D.border}`,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:14,fontWeight:800,color:D.textPrimary,letterSpacing:'-.01em'}}>{editing?'Edit Student':'New Student'}</div>
          <div style={{fontSize:11,color:D.textMuted,marginTop:3,display:'flex',gap:10,alignItems:'center'}}>
            Fill in student details
            {!editing&&draftSaved&&<span style={{color:D.emerald,fontWeight:700}}>✓ Draft saved</span>}
            {!editing&&savedDraft&&!draftSaved&&<span style={{color:D.amber,fontWeight:600}}>Restored from draft</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {!editing&&<button onClick={()=>{localStorage.removeItem(DRAFT_KEY);setForm(blank)}} style={{...BTN.ghost,fontSize:11}}>Clear Draft</button>}
          <button onClick={onCancel} style={{...BTN.ghost,padding:'6px 10px',fontSize:16}}>✕</button>
        </div>
      </div>

      <div style={{padding:'20px 24px'}}>
        <FieldRow label="Full Name *" error={errors.name}>
          <input style={{...INP.base,...(errors.name?INP.err:{})}} value={form.name} onChange={e=>{set('name',e.target.value);setErrors(v=>({...v,name:''}))}} placeholder="Full name as per certificate"/>
        </FieldRow>

        <SectionDivider label="Identification"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
          <FieldRow label="GCC No. *" error={errors.gcc_no}>
            <input style={{...INP.base,...(errors.gcc_no?INP.err:{})}} value={form.gcc_no} onChange={e=>{set('gcc_no',e.target.value);setErrors(v=>({...v,gcc_no:''}))}} type="number"/>
            {gccDup&&!errors.gcc_no&&<div style={{fontSize:11,color:D.amber,marginTop:3,fontWeight:600}}>⚠ Already assigned to {gccDup.name}</div>}
          </FieldRow>
          <FieldRow label="Date of Birth"><input type="date" style={INP.base} value={form.dob} onChange={e=>set('dob',e.target.value)}/></FieldRow>
          <FieldRow label="Gender"><select style={INP.base} value={form.gender} onChange={e=>set('gender',e.target.value)}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></FieldRow>
          <FieldRow label="Status"><select style={INP.base} value={form.status} onChange={e=>set('status',e.target.value)}>{STATUSES.filter(s=>s!=='All').map(s=><option key={s}>{s}</option>)}</select></FieldRow>
          <FieldRow label="Admission Date"><input type="date" style={INP.base} value={form.admission_date} onChange={e=>set('admission_date',e.target.value)}/></FieldRow>
          {form.status==='Withdrawn'&&<FieldRow label="Left Date"><input type="date" style={INP.base} value={form.left_date} onChange={e=>set('left_date',e.target.value)}/></FieldRow>}
          <FieldRow label="Previous School"><input style={INP.base} value={form.prev_school} onChange={e=>set('prev_school',e.target.value)} placeholder="School before GNSI"/></FieldRow>
          <FieldRow label="Referral Source"><input style={INP.base} value={form.referral_source} onChange={e=>set('referral_source',e.target.value)} placeholder="e.g. Sibling, Teacher, Ad"/></FieldRow>
        </div>

        <SectionDivider label="Course & Class"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:4}}>
          <FieldRow label="Course"><select style={INP.base} value={form.course} onChange={e=>set('course',e.target.value)}><option value="">— Course —</option>{Object.keys(COURSE_STRUCTURE).map(c=><option key={c}>{c}</option>)}</select></FieldRow>
          <FieldRow label="Batch / Class">
            {subtypes.length>0
              ?<select style={INP.base} value={form.batch} onChange={e=>set('batch',e.target.value)}><option value="">—</option>{subtypes.map(s=><option key={s}>{s}</option>)}</select>
              :<select style={INP.base} value={form.batch} onChange={e=>set('batch',e.target.value)}><option value="">— Class —</option>{CLASSES_LIST.map(c=><option key={c}>{c}</option>)}</select>}
          </FieldRow>
          <FieldRow label="Session"><select style={INP.base} value={form.session} onChange={e=>set('session',e.target.value)}><option value="">—</option>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></FieldRow>
          <FieldRow label="House / Block"><select style={INP.base} value={form.house} onChange={e=>set('house',e.target.value)}><option value="">— House —</option>{HOUSES_LIST.map(h=><option key={h}>{h}</option>)}</select></FieldRow>
          <FieldRow label="Hostel Type">
            <select style={{...INP.base,opacity:DAY_SCHOLAR_HOUSES.includes(form.house)?.6:1}} value={form.hostel_type} onChange={e=>set('hostel_type',e.target.value)}>
              {HOSTEL_TYPES.filter(h=>h!=='All').map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </FieldRow>
        </div>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:12,padding:'7px 14px',borderRadius:D.r8,background:hs.bg,border:`1px solid ${hs.border}`,fontSize:12,fontWeight:600,color:hs.color}}>
          {hs.icon} Hostel: <strong>{derived}</strong> · ₹{fmt(getFlatFeeAmt(derived))}/mo
        </div>

        <SectionDivider label="Fee Adjustments"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
          <FieldRow label="Monthly Waiver (₹)"><input type="number" style={INP.base} value={form.fee_waiver} onChange={e=>set('fee_waiver',e.target.value)} placeholder="0"/></FieldRow>
          <FieldRow label="Scholarship (₹/mo)"><input type="number" style={INP.base} value={form.scholarship} onChange={e=>set('scholarship',e.target.value)} placeholder="0"/></FieldRow>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Waiver Reason"><input style={INP.base} value={form.fee_waiver_note} onChange={e=>set('fee_waiver_note',e.target.value)} placeholder="e.g. Merit, Staff ward"/></FieldRow></div>
        </div>

        <SectionDivider label="Family & Contact"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
          <FieldRow label="Father's Name"><input style={INP.base} value={form.father_name} onChange={e=>set('father_name',e.target.value)}/></FieldRow>
          <FieldRow label="Mother's Name"><input style={INP.base} value={form.mother_name} onChange={e=>set('mother_name',e.target.value)}/></FieldRow>
          <FieldRow label="Phone" error={errors.phone}>
            <input style={{...INP.base,...(errors.phone?INP.err:{})}} value={form.phone} onChange={e=>{set('phone',e.target.value);setErrors(v=>({...v,phone:''}))}}/>
            {phoneDup&&!errors.phone&&<div style={{fontSize:11,color:D.amber,marginTop:3,fontWeight:600}}>⚠ Phone used by {phoneDup.name}</div>}
          </FieldRow>
          <FieldRow label="Emergency Contact"><input style={INP.base} value={form.emergency_contact} onChange={e=>set('emergency_contact',e.target.value)} placeholder="Name · Relation · Phone"/></FieldRow>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Address"><input style={INP.base} value={form.address} onChange={e=>set('address',e.target.value)}/></FieldRow></div>
        </div>

        <SectionDivider label="Medical & Notes"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Medical / Allergy Notes"><input style={INP.base} value={form.medical_notes} onChange={e=>set('medical_notes',e.target.value)} placeholder="Allergies, conditions, medications…"/></FieldRow></div>
          <div style={{gridColumn:'1/-1'}}><FieldRow label="Remarks"><textarea style={{...INP.base,resize:'vertical'}} rows={2} value={form.remarks} onChange={e=>set('remarks',e.target.value)}/></FieldRow></div>
        </div>

        <div style={{display:'flex',gap:10,marginTop:16}}>
          <button onClick={handleSave} disabled={saving} style={{...BTN.primary,padding:'11px 24px',opacity:saving?.7:1}}>{saving?'Saving…':editing?'Update Student':'Save Student'}</button>
          <button onClick={onCancel} style={{...BTN.secondary,padding:'11px 16px'}}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Student Row (list view) ──────────────────────────────────────────────────
function StudentCard({ s, onEdit, onDelete, onOpenFee, onOpenDetail, onQuickAttend, feeData, attData, examData, density, visibleCols, selected, onSelect, onExamEntry, onClone }) {
  const cs=COURSE_STRUCTURE[s.course]
  const birthday=isBirthdayToday(s.dob)
  const recent=isRecentlyAdded(s.created_at)
  const d=DENSITY[density]||DENSITY.comfortable
  const show=col=>visibleCols.includes(col)
  const isSelected=selected.has(s.id)
  const att=attData[s.id]
  const dues=feeData[s.id]?.dues||0
  const lastPaid=feeData[s.id]?.lastPaid||null
  const exams=examData[s.id]||[]
  const avgScore=exams.length?exams.reduce((a,e)=>a+(e.total||0),0)/exams.length:null
  const longAbsent=att!=null&&att<50
  const sparkData=exams.slice(-5).map(e=>e.total||0)
  const sparkMax=Math.max(...sparkData,1)
  const missing=getMissingFields(s)

  const houseColor=HOUSE_COLORS[s.house]||D.textMuted
  const statusMeta=STATUS_META[s.status]||{color:D.textMuted,bg:D.surface2}

  return(
    <div style={{
      background:isSelected?D.brandDim:D.surface,
      border:`1px solid ${isSelected?D.brand+'60':birthday?D.orange+'40':recent?D.teal+'30':D.border}`,
      borderRadius:D.r10,padding:d.padding,
      display:'flex',alignItems:'center',gap:12,
      transition:'border-color .12s,background .12s',
      position:'relative',
    }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=isSelected?D.brand+'80':D.border2}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=isSelected?D.brand+'60':birthday?D.orange+'40':recent?D.teal+'30':D.border}}
    >
      {/* Status stripe */}
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:2,borderRadius:'10px 0 0 10px',background:statusMeta.color,opacity:.8}}/>

      <input type="checkbox" checked={isSelected} onChange={()=>onSelect(s.id)} style={{width:15,height:15,cursor:'pointer',accentColor:D.brand,flexShrink:0,marginLeft:6}}/>

      <Avatar name={s.name} photoUrl={s.photo_url} size={d.avatarSize}/>

      {/* Main info */}
      <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>onOpenDetail(s)}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontWeight:700,fontSize:d.fontSize,color:D.textPrimary,letterSpacing:'-.01em'}}>{s.name}</span>
          {show('status')&&s.status&&<StatusBadge status={s.status}/>}
          {birthday&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:D.r4,background:D.orangeDim,color:D.orange,border:`1px solid ${D.orange}30`}}>🎂 Birthday</span>}
          {recent&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:D.r4,background:D.tealDim,color:D.teal,border:`1px solid ${D.teal}30`}}>New</span>}
          {longAbsent&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:D.r4,background:D.roseDim,color:D.rose,border:`1px solid #3A1020`}}>⚠ Absent</span>}
          {missing.length>0&&<span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:D.r4,background:D.amberDim,color:D.amber,border:`1px solid #1C1400`}}>⚠ {missing.join(', ')}</span>}
          {s.medical_notes&&<span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:D.r4,background:D.orangeDim,color:D.orange,border:`1px solid ${D.orange}20`}}>⚕</span>}
        </div>

        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:5,alignItems:'center'}}>
          {show('gcc_no')&&s.gcc_no&&<span style={{fontSize:11,color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{s.gcc_no}</span>}
          {show('batch')&&s.batch&&<span style={{fontSize:11,color:D.textSecondary,fontWeight:600}}>{s.batch}</span>}
          {show('session')&&s.session&&<span style={{fontSize:11,color:D.brand,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace"}}>{s.session}</span>}
          {show('house')&&s.house&&<span style={{fontSize:10,fontWeight:700,color:houseColor,background:houseColor+'15',padding:'1px 7px',borderRadius:99,border:`1px solid ${houseColor}30`}}>{s.house}</span>}
          {show('course')&&s.course&&<span style={{color:cs?.color??D.textSecondary,fontWeight:600,background:cs?.bg??D.surface2,borderRadius:D.r4,padding:'1px 7px',fontSize:10,border:`1px solid ${cs?.color??D.textMuted}20`}}>{s.course}</span>}
          {show('hostel_type')&&s.hostel_type&&<HostelTypeBadge type={s.hostel_type}/>}
          {show('gender')&&s.gender&&<span style={{fontSize:11,color:D.textMuted}}>{s.gender}</span>}
          {show('phone')&&s.phone&&<span style={{fontSize:11,color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace"}}>{s.phone}</span>}
          {show('father_name')&&s.father_name&&<span style={{fontSize:11,color:D.textMuted}}>F: {s.father_name}</span>}
          {show('attendance')&&att!=null&&<span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:D.r4,background:att>=75?D.emeraldDim:D.roseDim,color:att>=75?D.emerald:D.rose,border:`1px solid ${att>=75?'#064E3B':'#3A1020'}`,fontFamily:"'IBM Plex Mono',monospace"}}>{att.toFixed(0)}%</span>}
          {show('last_paid')&&lastPaid&&<span style={{fontSize:10,fontWeight:600,padding:'1px 7px',borderRadius:D.r4,background:D.emeraldDim,color:D.emerald,border:`1px solid #064E3B`}}>{lastPaid}</span>}
          {show('sparkline')&&sparkData.length>0&&(
            <span style={{display:'inline-flex',alignItems:'flex-end',gap:2,height:14}}>
              {sparkData.map((v,i)=><span key={i} style={{width:3,height:`${(v/sparkMax)*100}%`,minHeight:2,background:D.brand,borderRadius:1,display:'inline-block',opacity:.5+.5*(i/sparkData.length)}}/>)}
            </span>
          )}
          {show('fee_history')&&feeData[s.id]?.history?.length>0&&(
            <div style={{display:'flex',gap:3,alignItems:'center'}}>
              {feeData[s.id].history.slice(0,3).map((h,i)=>(
                <span key={i} style={{fontSize:9,padding:'1px 5px',borderRadius:D.r4,background:D.emeraldDim,color:D.emerald,border:`1px solid #064E3B`,fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(h.amount)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: dues + actions */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:10}}>
        {dues>0?(
          <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:D.r6,background:D.roseDim,color:D.rose,border:`1px solid #3A1020`,whiteSpace:'nowrap',fontFamily:"'IBM Plex Mono',monospace"}}>₹{fmt(dues)}</span>
        ):feeData[s.id]?(
          <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:D.r6,background:D.emeraldDim,color:D.emerald,border:`1px solid #064E3B`}}>Clear</span>
        ):null}

        <div style={{display:'flex',gap:3}}>
          <button onClick={()=>onOpenDetail(s)} style={{padding:'6px 12px',borderRadius:D.r6,background:D.brand,color:'#fff',border:'none',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>Profile</button>
          <button onClick={()=>onEdit(s)} style={{...BTN.ghost,padding:'5px 8px',fontSize:11}}>Edit</button>
          <button onClick={e=>{e.stopPropagation();onOpenFee(s)}} style={{padding:'5px 8px',borderRadius:D.r6,background:D.emeraldDim,color:D.emerald,border:`1px solid #064E3B`,fontSize:11,fontWeight:700,cursor:'pointer'}}>+₹</button>
          <button onClick={e=>{e.stopPropagation();onExamEntry(s)}} style={{padding:'5px 8px',borderRadius:D.r6,background:D.violetDim,color:D.violet,border:`1px solid #1A0938`,fontSize:11,fontWeight:700,cursor:'pointer'}} title="Add exam scores">📚</button>
          <button onClick={e=>{e.stopPropagation();onQuickAttend(s)}} style={{padding:'5px 8px',borderRadius:D.r6,background:D.skyDim,color:D.sky,border:`1px solid #071E2E`,fontSize:11,fontWeight:700,cursor:'pointer'}} title="Quick attendance">📅</button>
          <button onClick={()=>onClone(s)} style={{padding:'5px 8px',borderRadius:D.r6,background:D.amberDim,color:D.amber,border:`1px solid #1C1400`,fontSize:11,fontWeight:700,cursor:'pointer'}} title="Clone">📋</button>
          <button onClick={()=>onDelete(s)} style={{padding:'5px 8px',borderRadius:D.r6,background:D.roseDim,color:D.rose,border:`1px solid #3A1020`,fontSize:11,fontWeight:700,cursor:'pointer'}}>Del</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Students() {
  const [students,    setStudents]    = useState([])
  const [houseOptions,setHouseOptions]= useState(HOUSES_LIST)
  const [loading,     setLoading]     = useState(true)
  const [feeData,     setFeeData]     = useState({})
  const [feeHistory,  setFeeHistory]  = useState({})
  const [attData,     setAttData]     = useState({})
  const [examData,    setExamData]    = useState({})
  const [deleted,     setDeleted]     = useState([])
  const [showDeleted, setShowDeleted] = useState(false)
  const [undoItem,    setUndoItem]    = useState(null)
  const [deletedRow,  setDeletedRow]  = useState(null)
  const [formOpen,    setFormOpen]    = useState(false)
  const [editing,     setEditing]     = useState(null)
  const [feePanel,    setFeePanel]    = useState(null)
  const [detailPanel, setDetailPanel] = useState(null)
  const [examEntry,   setExamEntry]   = useState(null)
  const [toast,       setToast]       = useState(null)
  const [page,        setPage]        = useState(1)
  const [viewMode,    setViewMode]    = useState('list')
  const [showAnalytics,setShowAnalytics]=useState(false)
  const [showBulkOps,  setShowBulkOps] = useState(false)
  const [showRollover, setShowRollover] = useState(false)
  const [showBulkFee,  setShowBulkFee] = useState(false)
  const [showHouseReassign, setShowHouseReassign] = useState(false)
  const [showCarryForward, setShowCarryForward] = useState(false)
  const [showMergeDups, setShowMergeDups] = useState(false)
  const [showSessionComp, setShowSessionComp] = useState(false)
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [quickAttend, setQuickAttend] = useState(null)
  const PAGE_SIZE = 25

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showColPicker,  setShowColPicker]  = useState(false)
  const [showHousePills, setShowHousePills] = useState(false)
  const [showPresets,    setShowPresets]    = useState(false)
  const [showRecents,    setShowRecents]    = useState(false)
  const [presetName,     setPresetName]     = useState('')
  const [selected,       setSelected]       = useState(new Set())

  const initF=paramsToFilters(window.location.search)
  const[search,        setSearch]       =useState(initF.q)
  const[filterStatus,  setFilterStatus] =useState(initF.status)
  const[filterCourse,  setFilterCourse] =useState(initF.course)
  const[filterHostel,  setFilterHostel] =useState(initF.hostel)
  const[filterHouse,   setFilterHouse]  =useState(initF.house)
  const[filterGender,  setFilterGender] =useState(initF.gender)
  const[filterSession, setFilterSession]=useState(initF.session)
  const[filterBatch,   setFilterBatch]  =useState(initF.batch)
  const[gccMin,        setGccMin]       =useState(initF.gccMin)
  const[gccMax,        setGccMax]       =useState(initF.gccMax)

  const loadCols=()=>{try{return JSON.parse(localStorage.getItem(COLUMNS_KEY))||ALL_COLUMNS.filter(c=>c.default).map(c=>c.key)}catch{return ALL_COLUMNS.filter(c=>c.default).map(c=>c.key)}}
  const[visibleCols,setVisibleCols]=useState(loadCols)
  const saveCol=cols=>{setVisibleCols(cols);localStorage.setItem(COLUMNS_KEY,JSON.stringify(cols))}
  const[density,setDensity]=useState(()=>localStorage.getItem(DENSITY_KEY)||'comfortable')
  const changeDensity=d=>{setDensity(d);localStorage.setItem(DENSITY_KEY,d)}

  const{presets,save:savePreset,remove:removePreset}=usePresets()
  const{recent:recentSearches,add:addSearch,clear:clearSearches}=useRecentSearches()

  const searchRef=useRef(null);const undoTimer=useRef(null)
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),3500)}

  useEffect(()=>{const params=filtersToParams({status:filterStatus,course:filterCourse,hostel:filterHostel,house:filterHouse,gender:filterGender,session:filterSession,batch:filterBatch,q:search,gccMin,gccMax});window.history.replaceState(null,'',params?`${window.location.pathname}?${params}`:window.location.pathname)},[search,filterStatus,filterCourse,filterHostel,filterHouse,filterGender,filterSession,filterBatch,gccMin,gccMax])

  const loadAll=useCallback(async()=>{
    setLoading(true)
    try{
      const[{data:rows,error:e},{data:houseRows}]=await Promise.all([
        supabase.from('students').select('*').is('deleted_at',null).order('name'),
        supabase.from('houses').select('name').order('name'),
      ])
      if(e)throw e
      setStudents(rows||[])
      if(houseRows?.length)setHouseOptions(houseRows.map(h=>h.name))
    }catch(err){showToast('Failed to load: '+err.message,D.rose)}
    finally{setLoading(false)}
  },[])

  const loadDeleted=useCallback(async()=>{const{data}=await supabase.from('students').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false});setDeleted(data||[])},[])

  useEffect(()=>{loadAll()},[loadAll])
  useEffect(()=>{if(showDeleted)loadDeleted()},[showDeleted,loadDeleted])

  const loadAttData=useCallback(async ids=>{
    if(!ids.length)return
    try{
      const{data}=await supabase.from('attendance').select('student_id,status').in('student_id',ids)
      if(!data)return
      const map={}
      ids.forEach(id=>{const recs=data.filter(r=>r.student_id===id);const total=recs.length;if(!total){map[id]=null;return};const present=recs.filter(r=>r.status==='Present').length+recs.filter(r=>r.status==='Late').length*0.5;map[id]=present/total*100})
      setAttData(map)
    }catch{}
  },[])

  const loadExamData=useCallback(async ids=>{
    if(!ids.length)return
    try{
      const{data}=await supabase.from('exam_scores').select('*').in('student_id',ids).order('created_at',{ascending:false})
      if(!data)return
      const map={}
      data.forEach(e=>{if(!map[e.student_id])map[e.student_id]=[];map[e.student_id].push(e)})
      setExamData(map)
    }catch{}
  },[])

  const loadFeeData=useCallback(async ids=>{
    if(!ids.length)return
    try{
      const{data}=await supabase.from('fee_collections').select('*').in('student_id',ids).order('payment_date',{ascending:false})
      if(!data)return
      const map={}
      for(const row of data){if(!map[row.student_id])map[row.student_id]=[];map[row.student_id].push(row)}
      const thisMonth=new Date().toLocaleDateString('en-IN',{month:'short',year:'2-digit'}).split(' ')[0]
      const result={};const historyResult={}
      for(const s of students){const pmts=map[s.id]||[];historyResult[s.id]=pmts;const lastPaid=pmts[0]?new Date(pmts[0].payment_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}):null;const paidThisMonth=lastPaid?.includes(thisMonth);result[s.id]={dues:paidThisMonth?0:getFlatFeeAmt(s.hostel_type),lastPaid,history:pmts.slice(0,3)}}
      setFeeData(result);setFeeHistory(historyResult)
    }catch{}
  },[students])

  useEffect(()=>{if(students.length){const ids=students.map(s=>s.id);loadFeeData(ids);loadAttData(ids);loadExamData(ids)}},[students.length])
  useEffect(()=>{const h=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();searchRef.current?.focus()}};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[])

  const handleSave=async(eid,obj)=>{
    const payload={gcc_no:parseInt(obj.gcc_no),name:obj.name,dob:obj.dob||null,gender:obj.gender||null,course:obj.course||null,batch:obj.batch||null,house:obj.house||null,session:obj.session||null,hostel_type:obj.hostel_type||'Day Scholar',status:obj.status||'Active',father_name:obj.father_name||null,mother_name:obj.mother_name||null,phone:obj.phone||null,address:obj.address||null,remarks:obj.remarks||null,fee_waiver:Number(obj.fee_waiver)||0,scholarship:Number(obj.scholarship)||0,fee_waiver_note:obj.fee_waiver_note||null,emergency_contact:obj.emergency_contact||null,prev_school:obj.prev_school||null,referral_source:obj.referral_source||null,admission_date:obj.admission_date||null,left_date:obj.left_date||null,medical_notes:obj.medical_notes||null,academic_remarks:obj.academic_remarks||null}
    if(eid){const{error}=await supabase.from('students').update(payload).eq('id',eid);if(error){showToast('Update failed: '+error.message,D.rose);return};setStudents(prev=>prev.map(s=>s.id===eid?{...s,...payload}:s));showToast('Student updated',D.amber)}
    else{const{data,error}=await supabase.from('students').insert(payload).select().single();if(error){showToast(error.code==='23505'?`GCC ${obj.gcc_no} already exists`:'Save failed: '+error.message,D.rose);return};setStudents(prev=>[data,...prev]);showToast(`${data.name} added`,D.emerald)}
    setFormOpen(false);setEditing(null)
  }

  const handleClone=async(student)=>{
    const cloned={...student};delete cloned.id;delete cloned.created_at;delete cloned.deleted_at
    cloned.name=cloned.name+' (Clone)';cloned.gcc_no='';cloned.status='Active';cloned.admission_date=new Date().toISOString().slice(0,10)
    setEditing(null);setFormOpen(true);localStorage.setItem(DRAFT_KEY,JSON.stringify(cloned))
    showToast('Clone draft loaded — update GCC No. and save',D.brand)
  }

  const handleDelete=async s=>{if(!confirm(`Delete ${s.name}?`))return;setStudents(prev=>prev.filter(x=>x.id!==s.id));setUndoItem(s);setDeletedRow(s);await supabase.from('students').update({deleted_at:new Date().toISOString()}).eq('id',s.id);if(undoTimer.current)clearTimeout(undoTimer.current);undoTimer.current=setTimeout(()=>{setUndoItem(null);setDeletedRow(null);showToast('Record deleted',D.rose)},5000)}
  const handleUndo=async()=>{if(!deletedRow)return;clearTimeout(undoTimer.current);await supabase.from('students').update({deleted_at:null}).eq('id',deletedRow.id);setStudents(prev=>[deletedRow,...prev].sort((a,b)=>(a.name||'').localeCompare(b.name||'')));setUndoItem(null);setDeletedRow(null);showToast('Restored: '+deletedRow.name,D.emerald)}
  const handleRestore=async s=>{await supabase.from('students').update({deleted_at:null}).eq('id',s.id);setDeleted(prev=>prev.filter(x=>x.id!==s.id));await loadAll();showToast('Restored: '+s.name,D.emerald)}

  const handleQuickAttend=async(student)=>{
    const today=new Date().toISOString().slice(0,10)
    const{data:existing}=await supabase.from('attendance').select('*').eq('student_id',student.id).eq('date',today).single()
    if(existing){showToast(`Already marked ${existing.status} today`,D.amber);setQuickAttend(student)}
    else{await supabase.from('attendance').insert({student_id:student.id,date:today,status:'Present'});showToast(`Marked Present — ${student.name}`,D.emerald);loadAttData([student.id])}
  }

  const toggleSelect=id=>setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const selectAll=()=>setSelected(new Set(paginated.map(s=>s.id)))
  const clearSel=()=>setSelected(new Set())

  const applyPreset=f=>{setSearch(f.q||'');setFilterStatus(f.status||'All');setFilterCourse(f.course||'All');setFilterHostel(f.hostel||'All');setFilterHouse(f.house||'All');setFilterGender(f.gender||'All');setFilterSession(f.session||'All');setFilterBatch(f.batch||'All');setGccMin(f.gccMin||'');setGccMax(f.gccMax||'');setShowPresets(false);setPage(1)}
  const currentFilters={q:search,status:filterStatus,course:filterCourse,hostel:filterHostel,house:filterHouse,gender:filterGender,session:filterSession,batch:filterBatch,gccMin,gccMax}
  const allBatches=['All',...Array.from(new Set(students.map(s=>s.batch).filter(Boolean))).sort()]

  const filtered=students.filter(s=>{
    const q=search.toLowerCase()
    if(q&&![s.name,s.gcc_no,s.batch,s.father_name,s.mother_name,s.phone,s.house,s.hostel_type].some(v=>v?.toString().toLowerCase().includes(q)))return false
    if(filterStatus!=='All'&&s.status!==filterStatus)return false
    if(filterCourse!=='All'&&s.course!==filterCourse)return false
    if(filterHostel!=='All'&&s.hostel_type!==filterHostel)return false
    if(filterHouse!=='All'&&s.house!==filterHouse)return false
    if(filterGender!=='All'&&s.gender!==filterGender)return false
    if(filterSession!=='All'&&s.session!==filterSession)return false
    if(filterBatch!=='All'&&s.batch!==filterBatch)return false
    if(gccMin&&Number(s.gcc_no)<Number(gccMin))return false
    if(gccMax&&Number(s.gcc_no)>Number(gccMax))return false
    if(ageMin){const age=getAge(s.dob);if(age==null||age<Number(ageMin))return false}
    if(ageMax){const age=getAge(s.dob);if(age==null||age>Number(ageMax))return false}
    return true
  }).sort((a,b)=>(a.name||'').localeCompare(b.name||''))

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))
  const paginated=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)
  const hasFilters=search||filterStatus!=='All'||filterCourse!=='All'||filterHostel!=='All'||filterHouse!=='All'||filterGender!=='All'||filterSession!=='All'||filterBatch!=='All'||gccMin||gccMax
  const clearAll=()=>{setSearch('');setFilterStatus('All');setFilterCourse('All');setFilterHostel('All');setFilterHouse('All');setFilterGender('All');setFilterSession('All');setFilterBatch('All');setGccMin('');setGccMax('');setPage(1)}

  const longAbsentCount=students.filter(s=>attData[s.id]!=null&&attData[s.id]<50).length

  const KPI_ITEMS=[
    {label:'Total',       value:students.length,              accent:D.textPrimary, icon:'👥'},
    {label:'Active',      value:students.filter(s=>s.status==='Active').length, accent:D.emerald, icon:'●', fkey:'status',fval:'Active'},
    {label:'Boarders',    value:students.filter(s=>s.hostel_type==='Boarder').length,     accent:D.emerald,icon:'🏠',fkey:'hostel',fval:'Boarder'},
    {label:'Day Boarders',value:students.filter(s=>s.hostel_type==='Day Boarder').length, accent:D.amber,  icon:'🌅',fkey:'hostel',fval:'Day Boarder'},
    {label:'Day Scholars',value:students.filter(s=>s.hostel_type==='Day Scholar').length, accent:D.textSecondary,icon:'🏫',fkey:'hostel',fval:'Day Scholar'},
    {label:'Male',        value:students.filter(s=>s.gender==='Male').length,   accent:'#60A5FA',icon:'♂'},
    {label:'Female',      value:students.filter(s=>s.gender==='Female').length, accent:'#F472B6',icon:'♀'},
    {label:'Birthdays',   value:students.filter(s=>isBirthdayToday(s.dob)).length,       accent:D.orange,icon:'🎂'},
    {label:'Incomplete',  value:students.filter(s=>getMissingFields(s).length>0).length, accent:D.amber,icon:'⚠'},
    {label:'New (7d)',    value:students.filter(s=>isRecentlyAdded(s.created_at)).length, accent:D.teal,  icon:'🆕'},
    {label:'Fee Dues',    value:Object.values(feeData).filter(v=>v?.dues>0).length,       accent:D.rose,  icon:'💰'},
    {label:'Low Att.',    value:longAbsentCount, accent:D.rose, icon:'📉', warn:longAbsentCount>0},
  ]

  // Input & select shared dark style (injected via <style> tag)
  const globalCSS = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
    @keyframes spin{to{transform:rotate(360deg)}}
    *{box-sizing:border-box}
    body{background:${D.bg};}
    select,input,textarea{
      background:${D.surface}!important;
      color:${D.textPrimary}!important;
      border-color:${D.border}!important;
    }
    select:focus,input:focus,textarea:focus{
      border-color:${D.brand}!important;
      outline:none!important;
      box-shadow:0 0 0 3px ${D.brand}18!important;
    }
    select option{background:${D.surface};color:${D.textPrimary}}
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-track{background:${D.bg}}
    ::-webkit-scrollbar-thumb{background:${D.border};border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:${D.textMuted}}
    .sticky-bar{
      position:sticky;top:0;z-index:100;
      background:${D.bg};
      padding:10px 0 8px;
      border-bottom:1px solid ${D.border};
      margin-bottom:12px;
    }
  `

  return(
    <>
      <style>{globalCSS}</style>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {undoItem&&<UndoBanner student={undoItem} onUndo={handleUndo} onDismiss={()=>setUndoItem(null)}/>}

      {/* Column Picker Modal */}
      {showColPicker&&(
        <Modal onClose={()=>setShowColPicker(false)} width={320} title="Choose Columns">
          {ALL_COLUMNS.map(col=>(
            <label key={col.key} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',cursor:'pointer',borderBottom:`1px solid ${D.border}`}}>
              <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={e=>{const nc=e.target.checked?[...visibleCols,col.key]:visibleCols.filter(k=>k!==col.key);saveCol(nc)}} style={{accentColor:D.brand}}/>
              <span style={{fontSize:13,fontWeight:600,color:D.textSecondary}}>{col.label}</span>
            </label>
          ))}
          <button onClick={()=>setShowColPicker(false)} style={{...BTN.primary,width:'100%',marginTop:14,padding:'10px'}}>Done</button>
        </Modal>
      )}

      {detailPanel&&<StudentDetailDrawer student={detailPanel} allStudents={students} attData={attData} examData={examData} feeData={feeData} feeHistory={feeHistory} onClose={()=>setDetailPanel(null)} onEdit={s=>{setEditing(s);setFormOpen(true);setDetailPanel(null)}} showToast={showToast}/>}
      {feePanel&&<FeeCollectionModal app={feePanel} onClose={()=>setFeePanel(null)} onSaved={()=>{setFeePanel(null);loadAll();showToast('Payment recorded!',D.emerald)}}/>}
      {examEntry&&<ExamScoreModal student={examEntry} onClose={()=>setExamEntry(null)} onSaved={()=>{setExamEntry(null);loadExamData(students.map(s=>s.id))}} showToast={showToast}/>}
      {showBulkOps&&<BulkOperationsModal students={students} selectedIds={selected} onClose={()=>setShowBulkOps(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showRollover&&<SessionRolloverWizard students={students} onClose={()=>setShowRollover(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showBulkFee&&<BulkFeeModal students={students} selectedIds={selected} onClose={()=>setShowBulkFee(false)} onSaved={loadAll} showToast={showToast}/>}
      {showHouseReassign&&<HouseReassignmentModal students={students} selectedIds={selected} onClose={()=>setShowHouseReassign(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showCarryForward&&<CarryForwardModal students={students} selectedIds={selected} feeData={feeData} onClose={()=>setShowCarryForward(false)} onRefresh={loadAll} showToast={showToast}/>}
      {showMergeDups&&<MergeDuplicatesModal students={students} onClose={()=>setShowMergeDups(false)} onRefresh={loadAll} showToast={showToast}/>}

      {/* Quick Attendance */}
      {quickAttend&&(
        <Modal onClose={()=>setQuickAttend(null)} width={320} title="Mark Attendance" subtitle={`${quickAttend.name} · ${new Date().toLocaleDateString('en-IN')}`}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {['Present','Absent','Late','Medical'].map(status=>{
              const c={Present:D.emerald,Absent:D.rose,Late:D.amber,Medical:D.sky}[status]
              return<button key={status} onClick={async()=>{
                const today=new Date().toISOString().slice(0,10)
                const{data:existing}=await supabase.from('attendance').select('*').eq('student_id',quickAttend.id).eq('date',today).single()
                if(existing)await supabase.from('attendance').update({status}).eq('id',existing.id)
                else await supabase.from('attendance').insert({student_id:quickAttend.id,date:today,status})
                showToast(`Marked ${status}`,c);loadAttData([quickAttend.id]);setQuickAttend(null)
              }} style={{padding:'14px',borderRadius:D.r8,border:`1.5px solid ${c}40`,background:c+'12',fontSize:12,fontWeight:700,cursor:'pointer',color:c,transition:'all .12s'}}>
                {status==='Present'?'✓':status==='Absent'?'✗':status==='Late'?'⏰':'🏥'} {status}
              </button>
            })}
          </div>
        </Modal>
      )}

      <div style={{padding:'0 24px 40px',fontFamily:'system-ui,-apple-system,sans-serif',background:D.bg,minHeight:'100vh',color:D.textPrimary}}>

        {/* ── Page Header ── */}
        <div style={{padding:'28px 0 20px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:14}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.16em',color:D.textMuted,marginBottom:8}}>GNSI Portal · Student Registry</div>
            <div style={{fontSize:28,fontWeight:800,color:D.textPrimary,letterSpacing:'-.04em',lineHeight:1}}>Students</div>
            <div style={{fontSize:13,color:D.textMuted,marginTop:8,fontFamily:"'IBM Plex Mono',monospace"}}>
              {loading?'Loading…':<><span style={{color:D.textPrimary,fontWeight:700}}>{filtered.length}</span> / {students.length} records</>}
            </div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            {/* Export */}
            <div style={{position:'relative'}}>
              <button onClick={()=>setShowExportMenu(v=>!v)} style={{...BTN.secondary}}>Export ▾</button>
              {showExportMenu&&(
                <div style={{position:'absolute',right:0,top:'110%',background:D.surface2,border:`1px solid ${D.border2}`,borderRadius:D.r10,boxShadow:'0 16px 48px rgba(0,0,0,.5)',zIndex:999,minWidth:240,overflow:'hidden'}}>
                  {[
                    {label:'Student List (CSV)', fn:()=>downloadCSV(filtered.map(s=>({GCC:s.gcc_no||'',Name:s.name||'',Batch:s.batch||'',Course:s.course||'',House:s.house||'',Hostel:s.hostel_type||'',Status:s.status||'',Phone:s.phone||'',Father:s.father_name||'',Admission:s.admission_date||''})),`students_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'Student List (PDF)', fn:()=>exportToPDF('Student List',[{key:'gcc_no',label:'GCC'},{key:'name',label:'Name'},{key:'batch',label:'Batch'},{key:'course',label:'Course'},{key:'house',label:'House'},{key:'hostel_type',label:'Hostel'},{key:'status',label:'Status'},{key:'phone',label:'Phone'}],filtered.map(s=>({...s,gcc_no:'GCC-'+s.gcc_no})),`students_${new Date().toISOString().slice(0,10)}.pdf`)},
                    {label:'Print List',         fn:()=>printBatchList(filtered,filterBatch!=='All'?filterBatch:filterCourse!=='All'?filterCourse:'')},
                    {label:'Fee Dues (CSV)',      fn:()=>downloadCSV(filtered.filter(s=>feeData[s.id]?.dues>0).map(s=>({GCC:s.gcc_no||'',Name:s.name||'',Dues:feeData[s.id]?.dues||0,Phone:s.phone||''})),`fee_dues_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'Attendance (CSV)',    fn:()=>exportAttendanceSheet(filtered,attData)},
                    {label:'New Admissions (CSV)',fn:()=>exportNewAdmissions(students)},
                    {label:'WhatsApp List (CSV)', fn:()=>downloadCSV(filtered.filter(s=>s.phone).map(s=>({Name:s.name||'',GCC:s.gcc_no||'',Phone:s.phone||'',WA:`https://wa.me/91${s.phone?.replace(/\D/g,'')}`})),`whatsapp_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'Parent Contacts (CSV)',fn:()=>downloadCSV(filtered.map(s=>({Name:s.name||'',Father:s.father_name||'',Mother:s.mother_name||'',Phone:s.phone||'',Address:s.address||''})),`parents_${new Date().toISOString().slice(0,10)}.csv`)},
                    {label:'Birthday List (CSV)', fn:()=>{const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];downloadCSV(students.filter(s=>s.dob).map(s=>{const d=new Date(s.dob);return{Month:MO[d.getMonth()],Day:d.getDate(),Name:s.name,DOB:s.dob,Batch:s.batch||'',Phone:s.phone||''}}).sort((a,b)=>MO.indexOf(a.Month)-MO.indexOf(b.Month)||a.Day-b.Day),`birthdays_${new Date().toISOString().slice(0,10)}.csv`)}},
                  ].map(item=>(
                    <button key={item.label} onClick={()=>{item.fn();setShowExportMenu(false)}} style={{width:'100%',padding:'10px 16px',border:'none',background:'none',textAlign:'left',fontSize:12,fontWeight:600,cursor:'pointer',color:D.textSecondary,borderBottom:`1px solid ${D.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background=D.surface}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}
                    >{item.label}</button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={()=>setShowAnalytics(v=>!v)} style={{...BTN.secondary,borderColor:showAnalytics?D.violet+'60':D.border2,color:showAnalytics?D.violet:D.textSecondary,background:showAnalytics?D.violetDim:D.surface2}}>Analytics</button>
            <button onClick={()=>setShowDeleted(v=>!v)} style={{...BTN.secondary,borderColor:showDeleted?D.rose+'60':D.border2,color:showDeleted?D.rose:D.textSecondary,background:showDeleted?D.roseDim:D.surface2}}>Archive{deleted.length>0?` (${deleted.length})`:''}</button>
            <button onClick={()=>setShowMergeDups(true)} style={{...BTN.secondary,color:D.rose,borderColor:D.rose+'30',background:D.roseDim}}>Merge Dups</button>
            <button onClick={()=>setShowSessionComp(v=>!v)} style={{...BTN.secondary,borderColor:showSessionComp?D.violet+'60':D.border2,color:showSessionComp?D.violet:D.textSecondary}}>Compare</button>
            <button onClick={()=>setShowRollover(true)} style={{...BTN.secondary,color:D.brand,borderColor:D.brand+'30',background:D.brandDim}}>🔄 Rollover</button>

            {/* Density */}
            <div style={{display:'flex',border:`1px solid ${D.border}`,borderRadius:D.r8,overflow:'hidden'}}>
              {[['compact','▪'],['comfortable','▬'],['spacious','▩']].map(([d,icon])=>(
                <button key={d} title={d} onClick={()=>changeDensity(d)} style={{padding:'7px 10px',border:'none',fontSize:12,cursor:'pointer',background:density===d?D.brand:D.surface2,color:density===d?'#fff':D.textMuted,transition:'all .12s'}}>{icon}</button>
              ))}
            </div>
            {/* View mode */}
            <div style={{display:'flex',border:`1px solid ${D.border}`,borderRadius:D.r8,overflow:'hidden'}}>
              {[['list','≡'],['card','⊞']].map(([v,l])=>(
                <button key={v} onClick={()=>setViewMode(v)} style={{padding:'7px 12px',border:'none',fontSize:14,fontWeight:700,cursor:'pointer',background:viewMode===v?D.brand:D.surface2,color:viewMode===v?'#fff':D.textMuted,transition:'all .12s'}}>{l}</button>
              ))}
            </div>
            <button onClick={()=>setShowColPicker(true)} style={{...BTN.secondary}}>⚙ Cols</button>
            <button onClick={loadAll} style={{...BTN.secondary,padding:'7px 12px'}}>↻</button>
            <button onClick={()=>{setEditing(null);setFormOpen(true)}} style={{...BTN.primary,display:'flex',alignItems:'center',gap:8,padding:'10px 18px'}}>
              <span style={{fontSize:16,lineHeight:1}}>+</span> New Student
            </button>
          </div>
        </div>

        {/* Fee banners & alerts */}
        <FeeOverdueBanner students={students} feeData={feeData}/>
        <UpcomingDueReminder students={students} feeData={feeData}/>
        <AlertsPanel students={students}/>

        {/* Session comparison */}
        {showSessionComp&&<SessionComparison students={students} sessionA={SESSIONS[0]||'2024-25'} sessionB={SESSIONS[1]||'2025-26'}/>}

        {/* Analytics */}
        {showAnalytics&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginBottom:16}}>
            <HouseCensus students={students}/>
            <CourseDonut students={students}/>
            <GenderRatio students={students}/>
            <HostelBreakdown students={students}/>
            <AttendanceHostelBreakdown students={students} attData={attData}/>
            <AttendanceFeeCorrelation students={students} attData={attData} feeData={feeData}/>
            <SessionAttendanceTrend students={students} attData={attData}/>
          </div>
        )}

        {/* Archive panel */}
        {showDeleted&&(
          <div style={{background:D.roseDim,border:`1px solid #3A1020`,borderRadius:D.r12,padding:'16px 20px',marginBottom:20}}>
            <div style={{fontWeight:800,color:D.rose,marginBottom:10,fontSize:13,textTransform:'uppercase',letterSpacing:'.07em'}}>Archive ({deleted.length})</div>
            {deleted.length===0?<div style={{color:D.textMuted,fontSize:13}}>No deleted students.</div>:deleted.map(s=>(
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:`1px solid #3A1020`}}>
                <Avatar name={s.name} size={32}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:D.textSecondary}}>{s.name}</div>
                  <div style={{fontSize:11,color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace"}}>GCC-{s.gcc_no} · {fmtD(s.deleted_at)}</div>
                </div>
                <button onClick={()=>handleRestore(s)} style={{...BTN.primary,padding:'5px 14px',fontSize:12,background:D.emerald}}>↩ Restore</button>
              </div>
            ))}
          </div>
        )}

        {/* ── KPI Strip ── */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
          {KPI_ITEMS.map(k=>(
            <KpiCard key={k.label} label={k.label} value={k.value} accent={k.accent} warn={k.warn} icon={k.icon}
              active={k.fkey==='hostel'?filterHostel===k.fval:k.fkey==='status'?filterStatus===k.fval:false}
              onClick={k.fkey?()=>{if(k.fkey==='hostel'){setFilterHostel(f=>f===k.fval?'All':k.fval);setPage(1)}if(k.fkey==='status'){setFilterStatus(f=>f===k.fval?'All':k.fval);setPage(1)}}:undefined}
            />
          ))}
        </div>

        {formOpen&&<StudentForm onSave={handleSave} onCancel={()=>{setFormOpen(false);setEditing(null)}} editing={editing} allStudents={students}/>}

        {/* Bulk toolbar */}
        {selected.size>0&&(
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:D.brandDim,border:`1px solid ${D.brand}30`,borderRadius:D.r10,marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:D.brand,fontFamily:"'IBM Plex Mono',monospace"}}>{selected.size} selected</span>
            <div style={{flex:1}}/>
            <button onClick={()=>setShowBulkOps(true)} style={{...BTN.primary,padding:'6px 14px',fontSize:12}}>Bulk Actions</button>
            <button onClick={()=>setShowBulkFee(true)} style={{padding:'6px 14px',borderRadius:D.r6,background:D.emerald,color:'#fff',border:'none',fontSize:12,fontWeight:700,cursor:'pointer'}}>Bulk Fee</button>
            <button onClick={()=>setShowHouseReassign(true)} style={{padding:'6px 14px',borderRadius:D.r6,background:D.violetDim,color:D.violet,border:`1px solid #1A0938`,fontSize:12,fontWeight:700,cursor:'pointer'}}>Reassign</button>
            <button onClick={()=>setShowCarryForward(true)} style={{padding:'6px 14px',borderRadius:D.r6,background:D.skyDim,color:D.sky,border:`1px solid #071E2E`,fontSize:12,fontWeight:700,cursor:'pointer'}}>Carry Fwd</button>
            <button onClick={clearSel} style={{...BTN.ghost,padding:'6px 12px',fontSize:12}}>✕ Clear</button>
          </div>
        )}

        {/* ── Sticky Filter Bar ── */}
        <div className="sticky-bar">
          {/* Presets & quick controls */}
          <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
            <button onClick={()=>setShowPresets(v=>!v)} style={{...BTN.ghost,fontSize:11}}>⭐ Presets{presets.length>0?` (${presets.length})`:''}</button>
            {showPresets&&(
              <>
                {presets.map(p=>(
                  <span key={p.name} style={{display:'inline-flex',alignItems:'center',gap:3}}>
                    <button onClick={()=>applyPreset(p.filters)} style={{...BTN.ghost,fontSize:11}}>{p.name}</button>
                    <button onClick={()=>removePreset(p.name)} style={{background:'none',border:'none',cursor:'pointer',color:D.rose,fontSize:12,padding:'0 2px'}}>✕</button>
                  </span>
                ))}
                <input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Preset name…" style={{...INP.base,width:120,padding:'5px 8px',fontSize:11}}/>
                <button onClick={()=>{if(presetName.trim()){savePreset(presetName.trim(),currentFilters);setPresetName('');setShowPresets(false);showToast('Preset saved',D.brand)}}} style={{...BTN.primary,padding:'5px 10px',fontSize:11}}>Save</button>
              </>
            )}
            <button onClick={selectAll} style={{...BTN.ghost,fontSize:11}}>☑ Select Page</button>
            {selected.size>0&&<button onClick={clearSel} style={{...BTN.ghost,fontSize:11,color:D.rose,borderColor:D.rose+'30'}}>✕ Clear ({selected.size})</button>}
          </div>

          {/* Filters */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            {/* Search */}
            <div style={{flex:1,minWidth:220,position:'relative'}}>
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:D.textMuted,fontSize:13,pointerEvents:'none'}}>⌕</span>
              <input ref={searchRef} value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}
                onFocus={()=>setShowRecents(true)} onBlur={()=>setTimeout(()=>setShowRecents(false),150)}
                onKeyDown={e=>{if(e.key==='Enter'&&search.trim()){addSearch(search.trim());setShowRecents(false)}}}
                placeholder="Search name, GCC, phone… (⌘K)" style={{...INP.base,paddingLeft:32}}/>
              {showRecents&&recentSearches.length>0&&(
                <div style={{position:'absolute',top:'110%',left:0,right:0,background:D.surface2,border:`1px solid ${D.border2}`,borderRadius:D.r8,boxShadow:'0 8px 32px rgba(0,0,0,.4)',zIndex:999,overflow:'hidden'}}>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'6px 12px',borderBottom:`1px solid ${D.border}`}}>
                    <span style={{fontSize:10,fontWeight:700,color:D.textMuted,textTransform:'uppercase',letterSpacing:'.07em'}}>Recent</span>
                    <button onMouseDown={clearSearches} style={{background:'none',border:'none',fontSize:10,color:D.rose,cursor:'pointer',fontWeight:700}}>Clear</button>
                  </div>
                  {recentSearches.map(q=>(
                    <button key={q} onMouseDown={()=>{setSearch(q);setShowRecents(false)}} style={{width:'100%',padding:'8px 12px',border:'none',background:'none',textAlign:'left',fontSize:12,cursor:'pointer',color:D.textSecondary}}
                      onMouseEnter={e=>e.currentTarget.style.background=D.surface}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}
                    >🕐 {q}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Dropdowns */}
            {[
              {val:filterStatus, set:v=>{setFilterStatus(v);setPage(1)}, opts:STATUSES,      label:'Status'},
              {val:filterCourse, set:v=>{setFilterCourse(v);setPage(1)}, opts:COURSES,       label:'Course'},
              {val:filterHostel, set:v=>{setFilterHostel(v);setPage(1)}, opts:HOSTEL_TYPES,  label:'Hostel'},
              {val:filterGender, set:v=>{setFilterGender(v);setPage(1)}, opts:GENDERS,       label:'Gender'},
              {val:filterSession,set:v=>{setFilterSession(v);setPage(1)},opts:['All',...SESSIONS],label:'Session'},
              {val:filterBatch,  set:v=>{setFilterBatch(v);setPage(1)},  opts:allBatches,    label:'Batch'},
            ].map(f=>(
              <select key={f.label} value={f.val} onChange={e=>f.set(e.target.value)} style={{...INP.base,padding:'7px 10px',minWidth:96,cursor:'pointer',width:'auto'}}>
                {f.opts.map(o=><option key={o}>{o}</option>)}
              </select>
            ))}

            {/* GCC range */}
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              <input value={gccMin} onChange={e=>{setGccMin(e.target.value);setPage(1)}} placeholder="GCC≥" type="number" style={{...INP.base,width:68,padding:'7px 8px'}}/>
              <span style={{fontSize:11,color:D.textMuted}}>–</span>
              <input value={gccMax} onChange={e=>{setGccMax(e.target.value);setPage(1)}} placeholder="GCC≤" type="number" style={{...INP.base,width:68,padding:'7px 8px'}}/>
            </div>
            {/* Age range */}
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              <input value={ageMin} onChange={e=>{setAgeMin(e.target.value);setPage(1)}} placeholder="Age≥" type="number" style={{...INP.base,width:58,padding:'7px 8px'}}/>
              <span style={{fontSize:11,color:D.textMuted}}>–</span>
              <input value={ageMax} onChange={e=>{setAgeMax(e.target.value);setPage(1)}} placeholder="Age≤" type="number" style={{...INP.base,width:58,padding:'7px 8px'}}/>
            </div>

            {hasFilters&&<button onClick={clearAll} style={{...BTN.ghost,color:D.rose,borderColor:D.rose+'30',fontSize:12,padding:'7px 12px'}}>✕ Clear</button>}
            <span style={{fontSize:11,color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace",whiteSpace:'nowrap'}}>{filtered.length}/{students.length}</span>
          </div>

          {/* House pills */}
          <div style={{marginTop:8}}>
            <button onClick={()=>setShowHousePills(v=>!v)} style={{...BTN.ghost,fontSize:10,padding:'3px 10px',marginBottom:showHousePills?6:0}}>{showHousePills?'▲':'▼'} Houses</button>
            {showHousePills&&(
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>
                <button onClick={()=>{setFilterHouse('All');setPage(1)}} style={{padding:'3px 12px',borderRadius:99,border:`1.5px solid ${filterHouse==='All'?D.textPrimary:D.border}`,background:filterHouse==='All'?D.surface2:'none',color:filterHouse==='All'?D.textPrimary:D.textMuted,fontSize:11,fontWeight:700,cursor:'pointer'}}>All</button>
                {houseOptions.map(h=>{
                  const color=HOUSE_COLORS[h]||D.textMuted;const active=filterHouse===h
                  return<button key={h} onClick={()=>{setFilterHouse(f=>f===h?'All':h);setPage(1)}} style={{padding:'3px 12px',borderRadius:99,border:`1.5px solid ${active?color:color+'40'}`,background:active?color+'20':'none',color:active?color:color+'90',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .12s'}}>
                    {h} <span style={{opacity:.7,fontSize:10}}>({students.filter(s=>s.house===h).length})</span>
                  </button>
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Student List ── */}
        {loading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'40vh',gap:14,color:D.textMuted}}>
            <div style={{width:20,height:20,border:`2px solid ${D.border2}`,borderTopColor:D.brand,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
            <span style={{fontWeight:600,fontSize:13}}>Loading students…</span>
          </div>
        ):filtered.length===0?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 20px',textAlign:'center'}}>
            <div style={{width:64,height:64,borderRadius:D.r12,background:D.surface2,border:`1px solid ${D.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:16}}>🎓</div>
            <div style={{fontSize:16,fontWeight:700,color:D.textSecondary,marginBottom:6}}>{students.length===0?'No students yet':'No results found'}</div>
            <p style={{fontSize:13,color:D.textMuted,maxWidth:'36ch',lineHeight:1.6,margin:'0 0 20px'}}>{students.length===0?'Click "+ New Student" to add your first student.':'Try adjusting your filters.'}</p>
          </div>
        ):viewMode==='card'?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(300px,100%),1fr))',gap:10}}>
            {paginated.map(s=>{
              const isSelected=selected.has(s.id)
              const dues=feeData[s.id]?.dues||0
              const att=attData[s.id]
              const cs=COURSE_STRUCTURE[s.course]
              return(
                <div key={s.id} style={{background:isSelected?D.brandDim:D.surface,border:`1px solid ${isSelected?D.brand+'50':D.border}`,borderRadius:D.r10,padding:'16px',cursor:'pointer',transition:'border-color .12s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=isSelected?D.brand+'80':D.border2}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=isSelected?D.brand+'50':D.border}
                  onClick={()=>setDetailPanel(s)}>
                  <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:10}}>
                    <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(s.id)} onClick={e=>e.stopPropagation()} style={{width:14,height:14,accentColor:D.brand,marginTop:2}}/>
                    <Avatar name={s.name} photoUrl={s.photo_url} size={36}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:D.textPrimary,letterSpacing:'-.01em'}}>{s.name}</div>
                      <div style={{fontSize:11,color:D.textMuted,marginTop:2,fontFamily:"'IBM Plex Mono',monospace"}}>{s.gcc_no&&`GCC-${s.gcc_no}`}{s.batch&&` · ${s.batch}`}{s.session&&` · ${s.session}`}</div>
                    </div>
                    {s.status&&<StatusBadge status={s.status}/>}
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
                    {s.course&&<span style={{fontSize:10,fontWeight:600,color:cs?.color||D.textSecondary,background:cs?.bg||D.surface2,padding:'2px 7px',borderRadius:D.r4,border:`1px solid ${cs?.color||D.textMuted}20`}}>{s.course}</span>}
                    {s.house&&<span style={{fontSize:10,fontWeight:700,color:HOUSE_COLORS[s.house]||D.textMuted,background:(HOUSE_COLORS[s.house]||D.textMuted)+'15',padding:'2px 8px',borderRadius:99,border:`1px solid ${(HOUSE_COLORS[s.house]||D.textMuted)+'40'}`}}>{s.house}</span>}
                    {s.hostel_type&&<HostelTypeBadge type={s.hostel_type} showRate/>}
                    {att!=null&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:D.r4,background:att>=75?D.emeraldDim:D.roseDim,color:att>=75?D.emerald:D.rose,border:`1px solid ${att>=75?'#064E3B':'#3A1020'}`,fontFamily:"'IBM Plex Mono',monospace"}}>{att.toFixed(0)}%</span>}
                  </div>
                  {dues>0&&<div style={{fontSize:11,fontWeight:700,color:D.rose,marginBottom:8,fontFamily:"'IBM Plex Mono',monospace"}}>⚠ ₹{fmt(dues)} fee due</div>}
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={e=>{e.stopPropagation();setDetailPanel(s)}} style={{flex:1,padding:'7px',borderRadius:D.r6,border:'none',background:D.brandDim,color:D.brand,fontSize:12,fontWeight:700,cursor:'pointer',border:`1px solid ${D.brand}30`}}>Profile</button>
                    <button onClick={e=>{e.stopPropagation();setEditing(s);setFormOpen(true)}} style={{...BTN.ghost,padding:'7px 10px',fontSize:12}}>✏</button>
                    <button onClick={e=>{e.stopPropagation();printIDCard(s)}} style={{...BTN.ghost,padding:'7px 10px',fontSize:12}} title="Print ID">🪪</button>
                  </div>
                </div>
              )
            })}
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:density==='compact'?3:density==='spacious'?10:6}}>
            {paginated.map(s=>(
              <StudentCard key={s.id} s={s}
                onEdit={st=>{setEditing(st);setFormOpen(true)}}
                onDelete={handleDelete}
                onOpenFee={setFeePanel}
                onOpenDetail={setDetailPanel}
                onQuickAttend={handleQuickAttend}
                feeData={feeData} attData={attData} examData={examData}
                density={density} visibleCols={visibleCols}
                selected={selected} onSelect={toggleSelect}
                onExamEntry={setExamEntry}
                onClone={handleClone}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading&&filtered.length>PAGE_SIZE&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:12,color:D.textMuted,fontFamily:"'IBM Plex Mono',monospace"}}>
              {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}
            </span>
            <div style={{display:'flex',gap:4}}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{...BTN.ghost,padding:'6px 12px',opacity:page===1?.4:1,cursor:page===1?'not-allowed':'pointer'}}>←</button>
              {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                const p=totalPages<=5?i+1:Math.max(1,Math.min(page-2,totalPages-4))+i
                return<button key={p} onClick={()=>setPage(p)} style={{padding:'6px 11px',borderRadius:D.r6,border:`1px solid ${page===p?D.brand:D.border}`,fontSize:12,fontWeight:700,cursor:'pointer',background:page===p?D.brand:D.surface2,color:page===p?'#fff':D.textMuted,transition:'all .12s'}}>{p}</button>
              })}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{...BTN.ghost,padding:'6px 12px',opacity:page===totalPages?.4:1,cursor:page===totalPages?'not-allowed':'pointer'}}>→</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
