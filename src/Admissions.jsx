// ============================================================
//  GNSI Portal — Admissions Module
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import FeeCollectionModal from './FeeCollectionModal'

// ─── Design Tokens ────────────────────────────────────────────
const T = {
  navy:    { 50:'#EEF2FF', 100:'#C7D2FE', 300:'#818CF8', 500:'#3730A3', 700:'#1E1B4B', 900:'#0F0D26' },
  indigo:  { 50:'#EEF2FF', 100:'#C7D2FE', 400:'#6366F1', 500:'#4F46E5', 600:'#4338CA', 700:'#3730A3' },
  emerald: { 50:'#ECFDF5', 100:'#D1FAE5', 300:'#6EE7B7', 500:'#10B981', 600:'#059669', 700:'#047857' },
  amber:   { 50:'#FFFBEB', 100:'#FEF3C7', 300:'#FCD34D', 500:'#F59E0B', 600:'#D97706', 700:'#B45309' },
  violet:  { 50:'#F5F3FF', 100:'#EDE9FE', 400:'#A78BFA', 500:'#8B5CF6', 600:'#7C3AED', 700:'#6D28D9' },
  rose:    { 50:'#FFF1F2', 100:'#FFE4E6', 500:'#F43F5E', 600:'#E11D48' },
  slate:   { 50:'#F8FAFC', 100:'#F1F5F9', 200:'#E2E8F0', 300:'#CBD5E1', 400:'#94A3B8', 500:'#64748B', 600:'#475569', 700:'#334155', 800:'#1E293B', 900:'#0F172A' },
}

// ─── Constants ────────────────────────────────────────────────
const ADM_STATUSES  = ['Applied','Under Review','Admitted','Enrolled','Rejected','Waitlisted']
const STAT_META     = {
  'Applied':      { color: T.indigo[600], bg: T.indigo[50],  icon: '◎' },
  'Under Review': { color: T.amber[600],  bg: T.amber[50],   icon: '◐' },
  'Admitted':     { color: T.violet[600], bg: T.violet[50],  icon: '◈' },
  'Enrolled':     { color: T.emerald[600],bg: T.emerald[50], icon: '◉' },
  'Rejected':     { color: T.rose[600],   bg: T.rose[50],    icon: '◌' },
  'Waitlisted':   { color: T.slate[500],  bg: T.slate[100],  icon: '◷' },
}
const ADM_DOCS      = ['Birth Certificate','Aadhaar Card','Passport Photo','Mark Sheet','Transfer Certificate','Medical Certificate','Caste Certificate','Address Proof']
const SESSIONS      = ['2024-25','2025-26','2026-27']
const CATEGORIES    = ['--','General','OBC','SC','ST','EWS','Other']
const COURSE_STRUCTURE = {
  Navodaya:          { subtypes:['Lakshya','Umeed'],             color:T.indigo[600], bg:T.indigo[50] },
  Sainik:            { subtypes:['Achiever','Leader','Champion'],color:T.emerald[600],bg:T.emerald[50] },
  Foundation:        { subtypes:['Elite','Prime'],               color:T.violet[600], bg:T.violet[50] },
  'Combined Course': { subtypes:[],                              color:T.amber[600],  bg:T.amber[50] },
}
const CLASSES_LIST  = ['Achiever','Leader','Champion','Lakshya','Umeed','Elite','Prime','Class 6','Class 7','Class 8','Class 9','Class 10']
const HOUSES_LIST   = ['Kombirei','Shiroi','Loktak','Singgarei','Koubru','Kangla','Sangai','Takhelei','Block-B','Day Scholar']

// ─── Utilities ────────────────────────────────────────────────
const fmt    = n  => Number(n||0).toLocaleString('en-IN')
const today  = () => new Date().toISOString().split('T')[0]
const avatarColor = name => {
  const hues = [T.indigo[600], T.violet[600], T.emerald[600], T.amber[600], '#0EA5E9', '#EC4899']
  return hues[(name||'').charCodeAt(0) % hues.length]
}

// ─── Field Mappers ────────────────────────────────────────────
function mapToDB(app) {
  return {
    gcc_no:         app.gcc ? parseInt(app.gcc) : undefined,
    applicant_name: app.name      || '',
    dob:            app.dob       || null,
    gender:         app.gender    || null,
    blood_group:    app.blood     || null,
    category:       (!app.category || app.category === '--') ? null : app.category,
    course:         app.course    || null,
    subtype:        app.subtype   || null,
    batch:          app.cls       || null,
    house:          app.house     || null,
    session:        app.session   || null,
    hostel_type:    app.hostel === 'Yes' ? 'Boarder' : 'Day Scholar',
    status:         app.status    || 'Applied',
    father_name:    app.father    || null,
    mother_name:    app.mother    || null,
    phone:          app.phone     || null,
    whatsapp:       app.whatsapp  || null,
    prev_school:    app.prevSchool|| null,
    address:        app.address   || null,
    remarks:        app.remarks   || null,
  }
}

function mapFromDB(row) {
  return {
    id:         row.gcc_no,
    gcc:        String(row.gcc_no),
    admNo:      row.adm_no,
    name:       row.applicant_name,
    dob:        row.dob,
    gender:     row.gender,
    blood:      row.blood_group,
    category:   row.category || '--',
    course:     row.course,
    subtype:    row.subtype,
    cls:        row.batch,
    house:      row.house,
    session:    row.session,
    hostel:     row.hostel_type === 'Boarder' ? 'Yes' : 'No',
    status:     row.status,
    father:     row.father_name,
    mother:     row.mother_name,
    phone:      row.phone,
    whatsapp:   row.whatsapp,
    prevSchool: row.prev_school,
    address:    row.address,
    remarks:    row.remarks,
    docs:       [],
    created_at: row.created_at,
  }
}

// ─── Supabase helpers ─────────────────────────────────────────
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

// ─── Design System Components ─────────────────────────────────
const styles = {
  inp: {
    width:'100%', padding:'9px 12px', borderRadius:8,
    border:`1.5px solid ${T.slate[200]}`, fontSize:13,
    outline:'none', boxSizing:'border-box', backgroundColor:'#fff',
    color: T.slate[800], fontFamily:"'DM Sans',system-ui,sans-serif",
    transition:'border-color .15s',
  },
  label: {
    display:'block', fontSize:11, fontWeight:700, color:T.slate[500],
    marginBottom:5, textTransform:'uppercase', letterSpacing:'.07em',
  },
}

function Avatar({ name, size=36 }) {
  const bg = avatarColor(name)
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

function KpiCard({ label, value, accent, onClick, active }) {
  return (
    <div onClick={onClick} style={{ flex:1, minWidth:80, padding:'12px 14px', borderRadius:10, background:active ? accent+'18' : '#fff', border:`1.5px solid ${active ? accent : T.slate[200]}`, cursor:'pointer', transition:'all .15s' }}>
      <div style={{ fontSize:22, fontWeight:800, color:active ? accent : T.slate[800], lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:10, fontWeight:700, color:active ? accent : T.slate[500], marginTop:4, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
    </div>
  )
}

function Toast({ msg, color='#4F46E5' }) {
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:999999, background:'#fff', border:`1px solid ${T.slate[200]}`, borderLeft:`3px solid ${color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.12)', maxWidth:320, color:T.slate[800] }}>
      {msg}
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div>
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

// ─── Application Form ─────────────────────────────────────────
function AdmForm({ onSave, onCancel, editing }) {
  const def = (k, fb='') => editing ? (editing[k] || fb) : fb
  const [form, setForm] = useState({
    name:      def('name'),
    gcc:       def('gcc'),
    dob:       def('dob'),
    gender:    def('gender'),
    blood:     def('blood'),
    category:  def('category', '--'),
    course:    def('course'),
    subtype:   def('subtype'),
    cls:       def('cls'),
    house:     def('house'),
    session:   def('session'),
    hostel:    def('hostel', 'No'),
    status:    def('status', 'Applied'),
    father:    def('father'),
    mother:    def('mother'),
    phone:     def('phone'),
    whatsapp:  def('whatsapp'),
    prevSchool:def('prevSchool'),
    address:   def('address'),
    remarks:   def('remarks'),
    docs:      editing?.docs || [],
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleDoc = d => set('docs', form.docs.includes(d) ? form.docs.filter(x=>x!==d) : [...form.docs, d])
  const subtypes = COURSE_STRUCTURE[form.course]?.subtypes ?? []

  return (
    <div style={{ background:'#fff', border:`1.5px solid ${T.violet[200]}`, borderRadius:14, overflow:'hidden', marginBottom:16 }}>
      <div style={{ background:T.violet[50], borderBottom:`1px solid ${T.violet[200]}`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:T.violet[700] }}>{editing ? '✏️ Edit Application' : '➕ New Application'}</div>
          <div style={{ fontSize:12, color:T.violet[500], marginTop:2 }}>Fill in the applicant details below</div>
        </div>
        <button onClick={onCancel} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${T.violet[200]}`, background:'#fff', cursor:'pointer', fontSize:16, color:T.slate[500] }}>✕</button>
      </div>

      <div style={{ padding:'20px' }}>
        <FieldRow label="Applicant Name *">
          <input style={styles.inp} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Full name as per certificate" />
        </FieldRow>

        <SectionDivider label="Identification" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4 }}>
          <FieldRow label="GCC No. *">
            <input style={styles.inp} value={form.gcc} onChange={e=>set('gcc',e.target.value)} placeholder="e.g. 729" type="number" />
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
          <FieldRow label="Session">
            <select style={styles.inp} value={form.session} onChange={e=>set('session',e.target.value)}>
              <option value="">—</option>
              {SESSIONS.map(s=><option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="House">
            <select style={styles.inp} value={form.house} onChange={e=>set('house',e.target.value)}>
              <option value="">— House —</option>
              {HOUSES_LIST.map(h=><option key={h}>{h}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Hostel">
            <select style={styles.inp} value={form.hostel} onChange={e=>set('hostel',e.target.value)}>
              <option value="No">Day Scholar</option>
              <option value="Yes">Boarder</option>
            </select>
          </FieldRow>
          <FieldRow label="Status">
            <select style={styles.inp} value={form.status} onChange={e=>set('status',e.target.value)}>
              {ADM_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </FieldRow>
        </div>

        <SectionDivider label="Family & Contact" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4 }}>
          <FieldRow label="Father's Name"><input style={styles.inp} value={form.father} onChange={e=>set('father',e.target.value)} placeholder="Father's full name" /></FieldRow>
          <FieldRow label="Mother's Name"><input style={styles.inp} value={form.mother} onChange={e=>set('mother',e.target.value)} placeholder="Mother's full name" /></FieldRow>
          <FieldRow label="Phone"><input style={styles.inp} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="Primary contact" /></FieldRow>
          <FieldRow label="WhatsApp"><input style={styles.inp} value={form.whatsapp} onChange={e=>set('whatsapp',e.target.value)} placeholder="WhatsApp number" /></FieldRow>
          <FieldRow label="Previous School"><input style={styles.inp} value={form.prevSchool} onChange={e=>set('prevSchool',e.target.value)} placeholder="Last attended school" /></FieldRow>
          <div style={{ gridColumn:'1/-1' }}>
            <FieldRow label="Address">
              <input style={styles.inp} value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Full residential address" />
            </FieldRow>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <FieldRow label="Remarks">
              <textarea style={{ ...styles.inp, resize:'vertical' }} rows={2} value={form.remarks} onChange={e=>set('remarks',e.target.value)} placeholder="Any notes or remarks…" />
            </FieldRow>
          </div>
        </div>

        <SectionDivider label={`Documents (${form.docs.length}/${ADM_DOCS.length})`} />
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:20 }}>
          {ADM_DOCS.map(d=>(
            <button key={d} onClick={()=>toggleDoc(d)} style={{ padding:'5px 12px', borderRadius:7, border:`1.5px solid ${form.docs.includes(d)?T.emerald[500]:T.slate[200]}`, background:form.docs.includes(d)?T.emerald[50]:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color:form.docs.includes(d)?T.emerald[700]:T.slate[600], display:'flex', alignItems:'center', gap:5 }}>
              {form.docs.includes(d)&&<span style={{ fontSize:10, color:T.emerald[600] }}>✓</span>}
              {d}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>onSave(editing?.id || null, form)} style={{ padding:'10px 24px', borderRadius:9, background:`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer' }}>
            {editing ? 'Update Application' : 'Save Application'}
          </button>
          <button onClick={onCancel} style={{ padding:'10px 16px', borderRadius:9, border:`1px solid ${T.slate[200]}`, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:T.slate[600] }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Application Card ─────────────────────────────────────────
function AppCard({ a, cols, onEdit, onDelete, onAdmit, onEnroll, onOpenFee }) {
  const appId   = String(a.gcc || a.id)
  const admPaid = cols.some(col => col.adm_app_id === appId && col.fee_type === 'admission')
  const cs      = COURSE_STRUCTURE[a.course]

  let actionBtn = null
  if (a.status==='Applied'||a.status==='Under Review') {
    actionBtn = <button onClick={e=>{e.stopPropagation();onAdmit(a.id)}} style={{ padding:'6px 14px', borderRadius:7, background:T.violet[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Admit</button>
  } else if (a.status==='Admitted'&&!admPaid) {
    actionBtn = <button onClick={e=>{e.stopPropagation();onOpenFee(a)}} style={{ padding:'6px 14px', borderRadius:7, background:T.amber[500], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Collect Fee</button>
  } else if (a.status==='Admitted'&&admPaid) {
    actionBtn = (
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <button onClick={e=>{e.stopPropagation();onOpenFee(a)}} style={{ padding:'5px 12px', borderRadius:7, background:T.amber[500], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Fee Account</button>
        <button onClick={e=>{e.stopPropagation();onEnroll(a.id)}} style={{ padding:'5px 12px', borderRadius:7, background:T.emerald[600], color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer' }}>Enroll</button>
      </div>
    )
  } else if (a.status==='Enrolled') {
    actionBtn = <span style={{ fontSize:11, color:T.emerald[600], fontWeight:700 }}>✓ Enrolled</span>
  }

  return (
    <div style={{ background:'#fff', border:`1px solid ${T.slate[200]}`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:14, transition:'box-shadow .15s', position:'relative' }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.07)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
    >
      <div style={{ position:'absolute', left:0, top:8, bottom:8, width:3, borderRadius:99, background:STAT_META[a.status]?.color||T.slate[300] }} />
      <Avatar name={a.name} size={40} />
      <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={()=>onOpenFee(a)}>
        <div style={{ fontWeight:800, fontSize:14, color:T.slate[900] }}>{a.name}</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:3, fontSize:11.5, color:T.slate[500] }}>
          {a.gcc&&<span style={{ fontFamily:'monospace' }}>#{a.gcc}</span>}
          {a.admNo&&<span style={{ fontFamily:'monospace', color:T.indigo[500] }}>{a.admNo}</span>}
          {a.cls&&<span>{a.cls}</span>}
          {a.house&&<span style={{ color:T.slate[400] }}>{a.house}</span>}
          {a.course&&(
            <span style={{ color:cs?.color??T.slate[600], fontWeight:600, background:cs?.bg??T.slate[100], borderRadius:4, padding:'1px 6px', fontSize:11 }}>
              {a.course}{a.subtype?` · ${a.subtype}`:''}
            </span>
          )}
          {a.phone&&<span>{a.phone}</span>}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
        <StatusBadge status={a.status} />
        {(a.status==='Admitted'||a.status==='Enrolled')&&(
          admPaid
            ? <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:T.emerald[50], color:T.emerald[700], border:`1px solid ${T.emerald[300]}`, fontWeight:700 }}>✓ Fee Paid</span>
            : <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:T.amber[50], color:T.amber[700], border:`1px solid ${T.amber[300]}`, fontWeight:700 }}>⚠ Fee Due</span>
        )}
        {a.docs?.length>0&&<span style={{ fontSize:10, color:T.slate[400] }}>{a.docs.length}/{ADM_DOCS.length} docs</span>}
      </div>
      <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
        {actionBtn}
        <div style={{ display:'flex', gap:4, marginTop:2 }}>
          <button onClick={()=>onEdit(a)} style={{ padding:'4px 10px', borderRadius:6, background:T.slate[50], color:T.slate[600], border:`1px solid ${T.slate[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>Edit</button>
          <button onClick={()=>onDelete(a.id)} style={{ padding:'4px 10px', borderRadius:6, background:'#FFF1F2', color:T.rose[600], border:`1px solid #FFE4E6`, fontSize:11, fontWeight:700, cursor:'pointer' }}>Del</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Admissions Page ─────────────────────────────────────
export default function Admissions() {
  const [apps, setApps]           = useState([])
  const [cols, setCols]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilter] = useState('All')
  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [feePanel, setFeePanel]   = useState(null)
  const [toast, setToast]         = useState(null)

  const showToast = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }

  const loadAll = useCallback(async () => {
  setLoading(true)
  const [appsData, colsData] = await Promise.all([
    sbApps.fetch(),
    supabase.from('adm_fee_collections').select('*').order('created_at', { ascending: false }),
  ])
  console.log('COLS SAMPLE:', colsData.data?.[0])  // ← add this
  if (appsData) setApps(appsData)
  if (!colsData.error) setCols(colsData.data)
  setLoading(false)
}, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleSave = async (eid, obj) => {
    if (!obj.name?.trim()) { showToast('Name is required', T.rose[600]); return }
    if (!obj.gcc?.toString().trim()) { showToast('GCC No. is required', T.rose[600]); return }
    if (eid) {
      const { error } = await supabase.from('admissions').update(mapToDB(obj)).eq('gcc_no', parseInt(eid))
      if (error) { showToast('Update failed: ' + error.message, T.rose[600]); return }
      setApps(prev => prev.map(a => String(a.id) === String(eid) ? { ...a, ...obj, id: parseInt(eid) } : a))
      showToast('Application updated', T.amber[600])
    } else {
      const row = mapToDB(obj)
      const { data, error } = await supabase.from('admissions').insert(row).select().single()
      if (error) {
        if (error.code === '23505') { showToast(`GCC No. ${obj.gcc} already exists`, T.rose[600]) }
        else { showToast('Save failed: ' + error.message, T.rose[600]) }
        return
      }
      const newApp = mapFromDB(data)
      setApps(prev => [newApp, ...prev])
      showToast(`Saved! Adm. No: ${newApp.admNo}`, T.violet[600])
    }
    setFormOpen(false)
    setEditing(null)
  }

  const handleAdmit = async (id) => {
    if (!confirm('Mark as Admitted?')) return
    const { error } = await supabase.from('admissions').update({ status: 'Admitted' }).eq('gcc_no', parseInt(id))
    if (error) { showToast('Update failed: ' + error.message, T.rose[600]); return }
    setApps(prev => prev.map(a => String(a.id) === String(id) ? { ...a, status: 'Admitted' } : a))
    showToast('Marked as Admitted', T.violet[600])
  }

  const handleEnroll = async (id) => {
    const a = apps.find(x => String(x.id) === String(id))
    if (!a) return
    const admPaid = cols.some(c => c.adm_app_id === String(a.gcc || a.id) && c.fee_type === 'admission')
    if (!admPaid) { showToast('⚠ Collect admission fee first', T.rose[600]); setFeePanel(a); return }
    if (!confirm(`Enroll ${a.name} as a student?`)) return
    const { error } = await supabase.from('admissions').update({ status: 'Enrolled' }).eq('gcc_no', parseInt(id))
    if (error) { showToast('Enroll failed: ' + error.message, T.rose[600]); return }
    setApps(prev => prev.map(x => String(x.id) === String(id) ? { ...x, status: 'Enrolled' } : x))
    showToast(`${a.name} enrolled! Student record created automatically.`, T.emerald[600])
  }

  const handleDelete = async (id) => {
    const a = apps.find(x => String(x.id) === String(id))
    if (!confirm(`Delete admission for ${a?.name}? This cannot be undone.`)) return
    const { error } = await supabase.from('admissions').delete().eq('gcc_no', parseInt(id))
    if (error) { showToast('Delete failed: ' + error.message, T.rose[600]); return }
    setApps(prev => prev.filter(x => String(x.id) !== String(id)))
    showToast('Record deleted', T.rose[600])
  }

  const byStatus = {}
  ADM_STATUSES.forEach(s => byStatus[s] = 0)
  apps.forEach(a => byStatus[a.status] = (byStatus[a.status] || 0) + 1)

  const filtered = apps.filter(a => {
    const sm = filterStatus === 'All' || a.status === filterStatus
    const q  = search.toLowerCase()
    const tm = !q || [a.name, a.phone, a.admNo, a.gcc, a.cls, a.house, a.father, a.course].some(f => f?.toString().toLowerCase().includes(q))
    return sm && tm
  })

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:14, color:T.slate[500], fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <div style={{ width:22, height:22, border:`2.5px solid ${T.slate[200]}`, borderTopColor:T.indigo[600], borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <span style={{ fontWeight:600 }}>Loading admissions…</span>
    </div>
  )

  return (
    <>
      {/* FeeCollectionModal — only modal, no FeePanel conflict */}
      {feePanel && (
        <FeeCollectionModal
          app={feePanel}
          onClose={() => setFeePanel(null)}
          onSaved={() => { setFeePanel(null); loadAll(); showToast('Payment recorded!', '#059669') }}
        />
      )}

      <div style={{ padding:'0 24px 32px', fontFamily:"'DM Sans',system-ui,sans-serif", background:T.slate[50], minHeight:'100vh' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
          @keyframes spin { to { transform: rotate(360deg) } }
          select:focus, input:focus, textarea:focus { border-color: ${T.indigo[400]} !important; box-shadow: 0 0 0 3px ${T.indigo[100]}; }
        `}</style>

        {toast && <Toast msg={toast.msg} color={toast.color} />}

        {/* Header */}
        <div style={{ padding:'28px 0 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.12em', color:T.slate[400], marginBottom:5 }}>GNSI Portal</div>
            <div style={{ fontSize:26, fontWeight:800, color:T.slate[900], letterSpacing:'-.03em', lineHeight:1.1 }}>Admissions</div>
            <div style={{ fontSize:13, color:T.slate[500], marginTop:5, display:'flex', gap:6, alignItems:'center' }}>
              {['Applied','Under Review','Admitted','Fee Collection','Enrolled'].map((s,i,arr)=>(
                <span key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontWeight:600, color:[T.indigo[600],T.amber[600],T.violet[600],T.amber[500],T.emerald[600]][i] }}>{s}</span>
                  {i<arr.length-1&&<span style={{ color:T.slate[300] }}>›</span>}
                </span>
              ))}
            </div>
          </div>
          <button onClick={()=>{setEditing(null);setFormOpen(true)}} style={{ padding:'10px 20px', borderRadius:10, background:`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 12px rgba(79,70,229,.3)' }}>
            <span style={{ fontSize:18, lineHeight:1 }}>+</span> New Application
          </button>
        </div>

        {/* KPI Strip */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          <KpiCard label="Total" value={apps.length} active={filterStatus==='All'} accent={T.indigo[600]} onClick={()=>setFilter('All')} />
          {ADM_STATUSES.map(s=>(
            <KpiCard key={s} label={s} value={byStatus[s]||0} active={filterStatus===s} accent={STAT_META[s]?.color} onClick={()=>setFilter(filterStatus===s?'All':s)} />
          ))}
        </div>

        {/* Form */}
        {formOpen && (
          <AdmForm
            onSave={handleSave}
            onCancel={()=>{setFormOpen(false);setEditing(null)}}
            editing={editing}
          />
        )}

        {/* Toolbar */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:14 }}>
          <div style={{ flex:1, minWidth:220, position:'relative' }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.slate[400], fontSize:14 }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, GCC no., house, class…" style={{ ...styles.inp, paddingLeft:36 }} />
          </div>
          <select value={filterStatus} onChange={e=>setFilter(e.target.value)} style={{ ...styles.inp, width:'auto', minWidth:140 }}>
            <option value="All">All Status</option>
            {ADM_STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
          <span style={{ fontSize:12, color:T.slate[400], fontWeight:500, whiteSpace:'nowrap' }}>
            {filtered.length} of {apps.length} applicants
          </span>
        </div>

        {/* Cards */}
        {filtered.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(a=>(
              <AppCard
                key={a.id} a={a} cols={cols}
                onEdit={app => { setEditing(app); setFormOpen(true) }}
                onDelete={handleDelete}
                onAdmit={handleAdmit}
                onEnroll={handleEnroll}
                onOpenFee={setFeePanel}
              />
            ))}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:16, background:T.slate[100], display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, marginBottom:16 }}>📭</div>
            <div style={{ fontSize:16, fontWeight:700, color:T.slate[700], marginBottom:6 }}>
              {apps.length === 0 ? 'No applications yet' : 'No results found'}
            </div>
            <p style={{ fontSize:13, color:T.slate[400], maxWidth:'36ch', lineHeight:1.6, margin:'0 0 20px' }}>
              {apps.length === 0 ? 'Click "+ New Application" to add your first applicant.' : 'Try adjusting your search or clearing the filter.'}
            </p>
            {apps.length === 0 && (
              <button onClick={()=>setFormOpen(true)} style={{ padding:'10px 22px', borderRadius:10, background:`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`, color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer' }}>
                + New Application
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
