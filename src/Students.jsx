// Students.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import FeeCollectionModal from './FeeCollectionModal'

// ─── Constants ──────────────────────────────────────────────────────────────

const COURSES      = ['All', 'Sainik', 'Navodaya', 'Foundation', 'Combined Course']
const HOSTEL_TYPES = ['All', 'Boarder', 'Day Scholar', 'Day Boarder']
const STATUSES     = ['All', 'Active', 'Inactive', 'Passed Out', 'Withdrawn']
const GENDERS      = ['All', 'Male', 'Female']

// House colors keyed by actual house names from DB
const HOUSE_COLORS = {
  KOMBIREI:  '#1d4ed8',
  KANGLA:    '#dc2626',
  SANGAI:    '#16a34a',
  SINGGAREI: '#ca8a04',
  LOKTAK:    '#7c3aed',
  KOUBRU:    '#0891b2',
  SHIROI:    '#db2777',
  TAKHELEI:  '#ea580c',
}

const STATUS_COLORS = {
  Active:       { bg: '#ecfdf5', text: '#065f46', border: '#6ee7b7' },
  Inactive:     { bg: '#fef9c3', text: '#713f12', border: '#fde047' },
  'Passed Out': { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
  Withdrawn:    { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
}

const fmt      = n    => Number(n || 0).toLocaleString('en-IN')
const AVATAR_BG = ['#1e3a5f','#4f46e5','#059669','#7c3aed','#0891b2','#d97706','#dc2626']
const avatarBg  = name => AVATAR_BG[(name?.charCodeAt(0) || 0) % AVATAR_BG.length]
const initials  = name => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = {
  page:      { minHeight: '100vh', background: '#f7f6f2', fontFamily: "'Satoshi','Inter',sans-serif", padding: 0 },
  topBar:    { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, position: 'sticky', top: 0, zIndex: 100 },
  content:   { padding: '20px 24px', maxWidth: 1400, margin: '0 auto' },
  statsRow:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 },
  statCard:  { background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.04)' },
  filtersRow:{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' },
  filterSelect: { padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', background: 'white', outline: 'none', cursor: 'pointer', minWidth: 130 },
  searchBox: { padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', background: 'white', outline: 'none', width: 240, flexShrink: 0 },
  tableWrap: { background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.05)', overflow: 'hidden' },
  th:        { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' },
  td:        { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  btnPrimary:{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  btnGhost:  { padding: '7px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748b' },
  btnFee:    { padding: '5px 11px', borderRadius: 6, border: 'none', background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  badge: type => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: STATUS_COLORS[type]?.bg || '#f1f5f9',
    color:      STATUS_COLORS[type]?.text || '#334155',
    border:     `1px solid ${STATUS_COLORS[type]?.border || '#e2e8f0'}`,
  }),
  drawerOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 200, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(3px)' },
  drawer:        { width: 'min(480px,96vw)', height: '100%', background: 'white', boxShadow: '-8px 0 40px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr>
    {[1,2,3,4,5,6,7].map(i => (
      <td key={i} style={S.td}>
        <div style={{ height: i===1?32:14, borderRadius: 6, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite', width: i===1?32:`${60+Math.random()*30}%` }} />
      </td>
    ))}
  </tr>
)

// ─── Profile Drawer ──────────────────────────────────────────────────────────

function ProfileDrawer({ student, onClose, onCollectFee }) {
  if (!student) return null
  const field = (label, value) => (
    <div style={{ display:'flex', flexDirection:'column', gap:2, marginBottom:14 }}>
      <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</span>
      <span style={{ fontSize:14, color:'#1e293b', fontWeight:500 }}>{value||'—'}</span>
    </div>
  )
  return createPortal(
    <div style={S.drawerOverlay} onClick={onClose}>
      <div style={S.drawer} onClick={e=>e.stopPropagation()}>
        <div style={{ height:4, background:'linear-gradient(90deg,#1e3a5f,#4f46e5,#7c3aed)' }} />
        <div style={{ padding:'20px 22px 16px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div style={{ width:56, height:56, borderRadius:14, background:avatarBg(student.name), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:20, fontWeight:800 }}>
              {initials(student.name)}
            </div>
            <button type="button" onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:4 }}>{student.name||'—'}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {student.gcc_no && <span style={{ fontSize:12, fontWeight:700, color:'#1e3a5f', background:'#eff6ff', padding:'2px 9px', borderRadius:999, border:'1px solid #bfdbfe' }}>GCC-{student.gcc_no}</span>}
            {student.admission_no && <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>{student.admission_no}</span>}
            {student.status && <span style={S.badge(student.status)}>{student.status}</span>}
          </div>
          <button type="button" onClick={()=>onCollectFee(student)} style={{ marginTop:14, width:'100%', padding:'10px', borderRadius:9, border:'none', background:'#1e3a5f', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            💰 Collect Fee
          </button>
        </div>
        <div style={{ padding:'18px 22px', overflowY:'auto', flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12, paddingBottom:6, borderBottom:'1px solid #f1f5f9' }}>Academic Info</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
            {field('Course', student.course)}
            {field('Batch / Class', student.batch)}
            {field('Session', student.session)}
            {field('House', student.house)}
            {field('Hostel Type', student.hostel_type)}
            {field('Gender', student.gender)}
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12, paddingBottom:6, borderBottom:'1px solid #f1f5f9', marginTop:4 }}>Personal Info</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
            {field("Father's Name", student.father_name)}
            {field("Mother's Name", student.mother_name)}
            {field('Date of Birth', student.dob)}
            {field('Phone', student.phone)}
          </div>
          {field('Address', student.address)}
          {(student.total_fee != null || student.fee_paid != null) && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12, paddingBottom:6, borderBottom:'1px solid #f1f5f9', marginTop:4 }}>Fee Summary</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
                {[
                  { label:'Total Fee', value:`₹${fmt(student.total_fee)}`,  color:'#1e3a5f' },
                  { label:'Paid',      value:`₹${fmt(student.fee_paid)}`,   color:'#059669' },
                  { label:'Due',       value:`₹${fmt((student.total_fee||0)-(student.fee_paid||0))}`, color:'#dc2626' },
                ].map(item=>(
                  <div key={item.label} style={{ background:'#f8fafc', borderRadius:9, padding:'10px 12px', border:'1px solid #e2e8f0' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:3 }}>{item.label}</div>
                    <div style={{ fontSize:15, fontWeight:800, color:item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {student.remarks && (
            <div style={{ background:'#fefce8', border:'1px solid #fde68a', borderRadius:9, padding:'10px 14px', fontSize:13, color:'#78350f' }}>
              <strong>Remarks:</strong> {student.remarks}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Add / Edit Student Modal ────────────────────────────────────────────────

function StudentFormModal({ student, onClose, onSaved, houseOptions = [] }) {
  const isEdit = !!student?.id
  const [form, setForm] = useState({
    gcc_no:'', student_code:'', name:'', gender:'Male',
    course:'', batch:'', house:'', session:'',
    father_name:'', mother_name:'', dob:'', phone:'',
    address:'', hostel_type:'Day Scholar',
    status:'Active', remarks:'',
    ...student,
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.name?.trim())   return setErr('Student name is required.')
    if (!form.course?.trim()) return setErr('Course is required.')
    setSaving(true); setErr(null)
    try {
      const payload = { ...form }
      let error
      if (isEdit) { ;({ error } = await supabase.from('students').update(payload).eq('id', student.id)) }
      else        { ;({ error } = await supabase.from('students').insert(payload)) }
      if (error) throw error
      onSaved?.(); onClose()
    } catch(e) {
      setErr(e.message || 'Failed to save. Please try again.')
    } finally { setSaving(false) }
  }

  const inp = { padding:'8px 11px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit', background:'white' }
  const lbl = { fontSize:12, fontWeight:600, color:'#64748b', display:'block', marginBottom:4 }
  const grp = { marginBottom:14 }

  return createPortal(
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div style={{ width:'min(620px,96vw)', background:'white', borderRadius:18, boxShadow:'0 32px 80px rgba(0,0,0,.25)', overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'90vh' }} onClick={e=>e.stopPropagation()}>
        <div style={{ height:4, background:'linear-gradient(90deg,#1e3a5f,#4f46e5)' }} />

        {/* Header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.1em' }}>{isEdit?'Edit Student':'Add New Student'}</div>
            <div style={{ fontSize:17, fontWeight:800, color:'#0f172a', marginTop:2 }}>{isEdit?form.name:'New Student Record'}</div>
          </div>
          <button type="button" onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>
          {err && <div style={{ background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#b91c1c', fontWeight:600 }}>❌ {err}</div>}

          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Identity</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
            <div style={grp}><label style={lbl}>GCC No.</label><input value={form.gcc_no} onChange={e=>set('gcc_no',e.target.value)} placeholder="e.g. 715" style={inp} /></div>
            <div style={grp}><label style={lbl}>Student Code</label><input value={form.student_code} onChange={e=>set('student_code',e.target.value)} placeholder="e.g. GNSI-001" style={inp} /></div>
          </div>
          <div style={grp}><label style={lbl}>Full Name *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Student full name" style={inp} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
            <div style={grp}>
              <label style={lbl}>Gender</label>
              <select value={form.gender} onChange={e=>set('gender',e.target.value)} style={inp}>
                {GENDERS.filter(g=>g!=='All').map(g=><option key={g}>{g}</option>)}
              </select>
            </div>
            <div style={grp}><label style={lbl}>Date of Birth</label><input type="date" value={form.dob} onChange={e=>set('dob',e.target.value)} style={inp} /></div>
          </div>

          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12, marginTop:6 }}>Academic</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
            <div style={grp}>
              <label style={lbl}>Course *</label>
              <select value={form.course} onChange={e=>set('course',e.target.value)} style={inp}>
                <option value="">— Select —</option>
                {COURSES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={grp}><label style={lbl}>Batch / Class</label><input value={form.batch} onChange={e=>set('batch',e.target.value)} placeholder="e.g. Class 6" style={inp} /></div>
            <div style={grp}><label style={lbl}>Session</label><input value={form.session} onChange={e=>set('session',e.target.value)} placeholder="e.g. 2026-27" style={inp} /></div>
            <div style={grp}>
              <label style={lbl}>House</label>
              <select value={form.house} onChange={e=>set('house',e.target.value)} style={inp}>
                <option value="">— Select —</option>
                {houseOptions.filter(h=>h!=='All').map(h=><option key={h}>{h}</option>)}
              </select>
            </div>
            <div style={grp}>
              <label style={lbl}>Hostel Type</label>
              <select value={form.hostel_type} onChange={e=>set('hostel_type',e.target.value)} style={inp}>
                {HOSTEL_TYPES.filter(h=>h!=='All').map(h=><option key={h}>{h}</option>)}
              </select>
            </div>
            <div style={grp}>
              <label style={lbl}>Status</label>
              <select value={form.status} onChange={e=>set('status',e.target.value)} style={inp}>
                {STATUSES.filter(s=>s!=='All').map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12, marginTop:6 }}>Family & Contact</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
            <div style={grp}><label style={lbl}>Father's Name</label><input value={form.father_name} onChange={e=>set('father_name',e.target.value)} style={inp} /></div>
            <div style={grp}><label style={lbl}>Mother's Name</label><input value={form.mother_name} onChange={e=>set('mother_name',e.target.value)} style={inp} /></div>
          </div>
          <div style={grp}><label style={lbl}>Phone</label><input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="Parent contact number" style={inp} /></div>
          <div style={grp}><label style={lbl}>Address</label><textarea value={form.address} onChange={e=>set('address',e.target.value)} rows={2} placeholder="Full address" style={{ ...inp, resize:'vertical' }} /></div>
          <div style={grp}><label style={lbl}>Remarks</label><textarea value={form.remarks} onChange={e=>set('remarks',e.target.value)} rows={2} placeholder="Any special notes" style={{ ...inp, resize:'vertical' }} /></div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 22px', borderTop:'1px solid #f1f5f9', background:'#f8fafc', display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button type="button" onClick={onClose} style={S.btnGhost}>Cancel</button>
          <button type="button" onClick={save} disabled={saving} style={{ ...S.btnPrimary, opacity:saving?.7:1, cursor:saving?'not-allowed':'pointer' }}>
            {saving?'⏳ Saving…':isEdit?'✏️ Update Student':'➕ Add Student'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Students() {

  const [students,     setStudents]     = useState([])
  const [houseOptions, setHouseOptions] = useState(['All'])   // ← loaded from DB
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const [search,       setSearch]       = useState('')
  const [filterCourse, setFilterCourse] = useState('All')
  const [filterHouse,  setFilterHouse]  = useState('All')
  const [filterHostel, setFilterHostel] = useState('All')
  const [filterStatus, setFilterStatus] = useState('Active')
  const [filterGender, setFilterGender] = useState('All')
  const [sortBy,       setSortBy]       = useState('name')
  const [sortDir,      setSortDir]      = useState('asc')
  const [viewMode,     setViewMode]     = useState('table')
  const [page,         setPage]         = useState(1)
  const PAGE_SIZE = 25

  const [drawer,    setDrawer]    = useState(null)
  const [feeModal,  setFeeModal]  = useState(null)
  const [formModal, setFormModal] = useState(null)
  const searchRef = useRef(null)

  // ── Load ────────────────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [{ data: rows, error: e }, { data: houseRows }] = await Promise.all([
        supabase.from('students').select('*').order('name', { ascending: true }),
        supabase.from('houses').select('name').order('name'),
      ])
      if (e) throw e
      setStudents(rows || [])
      setHouseOptions(['All', ...(houseRows?.map(h => h.name) || [])])
    } catch (err) {
      setError(err.message || 'Failed to load students.')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStudents() }, [loadStudents])

  useEffect(() => {
    const handler = e => { if ((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Filter + sort ────────────────────────────────────────────────────────
  const filtered = students
    .filter(s => {
      const q = search.toLowerCase()
      if (q && ![s.name,s.gcc_no,s.student_code,s.admission_no,s.father_name,s.batch].some(v=>v?.toLowerCase().includes(q))) return false
      if (filterCourse!=='All' && s.course!==filterCourse) return false
      if (filterHouse !=='All' && s.house !==filterHouse)  return false
      if (filterHostel!=='All' && s.hostel_type!==filterHostel) return false
      if (filterStatus!=='All' && s.status!==filterStatus) return false
      if (filterGender!=='All' && s.gender!==filterGender) return false
      return true
    })
    .sort((a,b) => {
      let va=a[sortBy]||'', vb=b[sortBy]||''
      if (typeof va==='string') va=va.toLowerCase()
      if (typeof vb==='string') vb=vb.toLowerCase()
      return sortDir==='asc'?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0)
    })

  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE))
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const toggleSort = col => { if(sortBy===col) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(col);setSortDir('asc')} }

  const stats = {
    total:       students.length,
    active:      students.filter(s=>s.status==='Active').length,
    boarders:    students.filter(s=>s.hostel_type==='Boarder').length,
    dayScholars: students.filter(s=>s.hostel_type==='Day Scholar').length,
    male:        students.filter(s=>s.gender==='Male').length,
    female:      students.filter(s=>s.gender==='Female').length,
  }

  const SortTh = ({ col, label }) => (
    <th style={{ ...S.th, cursor:'pointer', userSelect:'none' }} onClick={()=>toggleSort(col)}>
      {label}
      <span style={{ marginLeft:4, opacity:sortBy===col?1:.3 }}>{sortBy===col?(sortDir==='asc'?'↑':'↓'):'↕'}</span>
    </th>
  )

  const CardView = () => (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(280px,100%),1fr))', gap:14 }}>
      {paginated.map(s=>(
        <div key={s.id||s.gcc_no} onClick={()=>setDrawer(s)}
          style={{ background:'white', borderRadius:12, padding:'16px', border:'1px solid #e2e8f0', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,.04)', transition:'box-shadow .15s,transform .15s' }}
          onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,.1)';e.currentTarget.style.transform='translateY(-1px)'}}
          onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.04)';e.currentTarget.style.transform='none'}}
        >
          <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:avatarBg(s.name), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, fontWeight:800, flexShrink:0 }}>{initials(s.name)}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>
                {s.gcc_no && <span style={{ fontWeight:700, color:'#1e3a5f' }}>GCC-{s.gcc_no}</span>}
                {s.batch  && <span> · {s.batch}</span>}
              </div>
            </div>
            {s.status && <span style={S.badge(s.status)}>{s.status}</span>}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            {s.course && <span style={{ fontSize:11, fontWeight:600, color:'#475569', background:'#f1f5f9', padding:'2px 8px', borderRadius:6 }}>{s.course}</span>}
            {s.house  && <span style={{ fontSize:11, fontWeight:600, color:HOUSE_COLORS[s.house]||'#475569', background:'#f8fafc', padding:'2px 8px', borderRadius:6, border:`1px solid ${HOUSE_COLORS[s.house]||'#e2e8f0'}` }}>{s.house}</span>}
            {s.hostel_type && <span style={{ fontSize:11, color:'#64748b', background:'#f8fafc', padding:'2px 8px', borderRadius:6, border:'1px solid #e2e8f0' }}>{s.hostel_type}</span>}
          </div>
          <button type="button" onClick={e=>{e.stopPropagation();setFeeModal(s)}} style={{ ...S.btnFee, width:'100%', justifyContent:'center', display:'flex', gap:5 }}>💰 Collect Fee</button>
        </div>
      ))}
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .row-hover:hover { background: #f8fafc !important; }
        .page-btn:hover  { background: #1e3a5f !important; color: white !important; }
      `}</style>

      {/* Top Bar */}
      <div style={S.topBar}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:'#0f172a' }}>Students</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginTop:1 }}>{loading?'Loading…':`${filtered.length} of ${stats.total} students`}</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden' }}>
            {[['table','≡ Table'],['card','⊞ Cards']].map(([v,l])=>(
              <button key={v} type="button" onClick={()=>setViewMode(v)} style={{ padding:'6px 13px', border:'none', fontSize:12, fontWeight:600, cursor:'pointer', background:viewMode===v?'#1e3a5f':'white', color:viewMode===v?'white':'#64748b' }}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={loadStudents} style={S.btnGhost}>↻ Refresh</button>
          <button type="button" onClick={()=>setFormModal('add')} style={S.btnPrimary}>＋ Add Student</button>
        </div>
      </div>

      <div style={S.content}>

        {/* Stats */}
        <div style={S.statsRow}>
          {[
            { label:'Total Students', value:stats.total,       color:'#1e3a5f' },
            { label:'Active',         value:stats.active,      color:'#059669' },
            { label:'Boarders',       value:stats.boarders,    color:'#7c3aed' },
            { label:'Day Scholars',   value:stats.dayScholars, color:'#0891b2' },
            { label:'Male',           value:stats.male,        color:'#1d4ed8' },
            { label:'Female',         value:stats.female,      color:'#be185d' },
          ].map(s=>(
            <div key={s.label} style={S.statCard}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:800, color:s.color, fontVariantNumeric:'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'#b91c1c', fontWeight:600 }}>❌ {error}</span>
            <button type="button" onClick={loadStudents} style={{ ...S.btnGhost, fontSize:12 }}>Retry</button>
          </div>
        )}

        {/* Filters */}
        <div style={S.filtersRow}>
          <div style={{ position:'relative', flexShrink:0 }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'#94a3b8', pointerEvents:'none' }}>⌕</span>
            <input ref={searchRef} value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search name, GCC, batch… (Ctrl+K)" style={S.searchBox} />
          </div>
          {[
            { val:filterCourse, set:v=>{setFilterCourse(v);setPage(1)}, opts:COURSES,      label:'Course' },
            { val:filterHouse,  set:v=>{setFilterHouse(v);setPage(1)},  opts:houseOptions, label:'House'  },
            { val:filterHostel, set:v=>{setFilterHostel(v);setPage(1)}, opts:HOSTEL_TYPES, label:'Hostel' },
            { val:filterStatus, set:v=>{setFilterStatus(v);setPage(1)}, opts:STATUSES,     label:'Status' },
            { val:filterGender, set:v=>{setFilterGender(v);setPage(1)}, opts:GENDERS,      label:'Gender' },
          ].map(f=>(
            <select key={f.label} value={f.val} onChange={e=>f.set(e.target.value)} style={S.filterSelect}>
              {f.opts.map(o=><option key={o}>{o}</option>)}
            </select>
          ))}
          {(search||filterCourse!=='All'||filterHouse!=='All'||filterHostel!=='All'||filterStatus!=='Active'||filterGender!=='All') && (
            <button type="button" onClick={()=>{setSearch('');setFilterCourse('All');setFilterHouse('All');setFilterHostel('All');setFilterStatus('Active');setFilterGender('All');setPage(1)}} style={{ ...S.btnGhost, color:'#dc2626', borderColor:'#fca5a5' }}>✕ Clear</button>
          )}
        </div>

        {/* Table / Card */}
        {viewMode==='card' ? (
          <>
            {loading
              ? <div style={{ textAlign:'center', padding:60, color:'#94a3b8', fontSize:14 }}>Loading students…</div>
              : !paginated.length
              ? <div style={{ textAlign:'center', padding:'60px 20px' }}><div style={{ fontSize:40, marginBottom:12 }}>🎓</div><div style={{ fontWeight:700, fontSize:16, color:'#334155', marginBottom:6 }}>No students found</div><div style={{ fontSize:13, color:'#94a3b8' }}>Try adjusting your filters.</div></div>
              : <CardView />
            }
          </>
        ) : (
          <div style={S.tableWrap}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>#</th>
                    <SortTh col="name"        label="Student" />
                    <SortTh col="course"      label="Course" />
                    <SortTh col="batch"       label="Batch" />
                    <SortTh col="house"       label="House" />
                    <SortTh col="hostel_type" label="Type" />
                    <SortTh col="status"      label="Status" />
                    <th style={S.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({length:8},(_,i)=><SkeletonRow key={i} />)
                    : !paginated.length
                    ? <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}><div style={{ fontSize:36, marginBottom:8 }}>🎓</div><div style={{ fontWeight:700, fontSize:15, color:'#334155', marginBottom:4 }}>No students found</div><div style={{ fontSize:13 }}>Try adjusting your filters or search.</div></td></tr>
                    : paginated.map((s,idx)=>(
                      <tr key={s.id||s.gcc_no||idx} className="row-hover" style={{ background:'white', transition:'background .12s' }}>
                        <td style={{ ...S.td, color:'#94a3b8', fontWeight:600, fontSize:12 }}>{(page-1)*PAGE_SIZE+idx+1}</td>
                        <td style={S.td}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={()=>setDrawer(s)}>
                            <div style={{ width:32, height:32, borderRadius:8, background:avatarBg(s.name), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:800, flexShrink:0 }}>{initials(s.name)}</div>
                            <div>
                              <div style={{ fontWeight:700, color:'#0f172a', fontSize:13 }}>{s.name}</div>
                              <div style={{ fontSize:11, color:'#94a3b8' }}>{s.gcc_no?`GCC-${s.gcc_no}`:s.student_code||s.admission_no||'—'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={S.td}><span style={{ fontSize:12 }}>{s.course||'—'}</span></td>
                        <td style={S.td}><span style={{ fontSize:12 }}>{s.batch||'—'}</span></td>
                        <td style={S.td}>
                          {s.house
                            ? <span style={{ fontSize:12, fontWeight:600, color:HOUSE_COLORS[s.house]||'#475569' }}>{s.house}</span>
                            : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}
                        </td>
                        <td style={S.td}><span style={{ fontSize:12 }}>{s.hostel_type||'—'}</span></td>
                        <td style={S.td}>{s.status?<span style={S.badge(s.status)}>{s.status}</span>:<span style={{ color:'#94a3b8' }}>—</span>}</td>
                        <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button type="button" onClick={()=>setDrawer(s)}    style={S.btnGhost} title="View profile">👁</button>
                            <button type="button" onClick={()=>setFeeModal(s)}  style={S.btnFee}   title="Collect fee">💰 Fee</button>
                            <button type="button" onClick={()=>setFormModal(s)} style={{ ...S.btnGhost, fontSize:12 }} title="Edit">✏️</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filtered.length>PAGE_SIZE && (
              <div style={{ padding:'12px 16px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <span style={{ fontSize:12, color:'#64748b' }}>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
                <div style={{ display:'flex', gap:5 }}>
                  <button type="button" className="page-btn" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #e2e8f0', background:'white', fontSize:12, fontWeight:600, cursor:page===1?'not-allowed':'pointer', opacity:page===1?.4:1 }}>← Prev</button>
                  {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                    const p = totalPages<=5?i+1:Math.max(1,Math.min(page-2,totalPages-4))+i
                    return <button key={p} type="button" onClick={()=>setPage(p)} style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #e2e8f0', fontSize:12, fontWeight:700, cursor:'pointer', background:page===p?'#1e3a5f':'white', color:page===p?'white':'#334155' }}>{p}</button>
                  })}
                  <button type="button" className="page-btn" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #e2e8f0', background:'white', fontSize:12, fontWeight:600, cursor:page===totalPages?'not-allowed':'pointer', opacity:page===totalPages?.4:1 }}>Next →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Drawer */}
      {drawer && <ProfileDrawer student={drawer} onClose={()=>setDrawer(null)} onCollectFee={s=>{setDrawer(null);setFeeModal(s)}} />}

      {/* Fee Modal */}
      {feeModal && <FeeCollectionModal student={feeModal} onClose={()=>setFeeModal(null)} onSaved={()=>{setFeeModal(null);loadStudents()}} />}

      {/* Add / Edit Modal */}
      {formModal && (
        <StudentFormModal
          student={formModal==='add'?null:formModal}
          onClose={()=>setFormModal(null)}
          onSaved={()=>{setFormModal(null);loadStudents()}}
          houseOptions={houseOptions}
        />
      )}

    </div>
  )
}