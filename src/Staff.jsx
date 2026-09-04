import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { useCourseData, CoursePicker } from './Courses'
import GeoAttendance from './GeoAttendance'
import FaceEnroll, { FaceApprovalQueue } from './FaceEnroll'
import { staffDB } from './staffDB'
import { useCurrentUser } from './useCurrentUser'
import { EventBus, GNSI_EVENTS } from './EventBus'

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_UNLOCK_DURATION_MS = 15 * 60 * 1000
const ADMIN_UNLOCK_KEY = 'gnsi_admin_unlock_ts'

const LEVELS = [
  { min:90, max:100, label:'Elite',       emoji:'💎', color:'#7c3aed', bg:'#f3e8ff', border:'#7c3aed' },
  { min:75, max:89,  label:'Outstanding', emoji:'🥇', color:'#b45309', bg:'#fef3c7', border:'#f59e0b' },
  { min:60, max:74,  label:'Excellent',   emoji:'🥈', color:'#374151', bg:'#f1f5f9', border:'#94a3b8' },
  { min:45, max:59,  label:'Good',        emoji:'🥉', color:'#92400e', bg:'#fde68a', border:'#d97706' },
  { min:0,  max:44,  label:'Probation',   emoji:'🔰', color:'#dc2626', bg:'#fee2e2', border:'#f87171' },
]

const TASK_PRIORITIES  = ['High','Medium','Low']
const TASK_STATUSES    = ['Pending','In Progress','Done','Overdue']
const DEPARTMENTS_LIST = ['Administration','Academic','Accounts','Hostel','Reception','Transport','Maintenance']
const ROLE_OPTIONS     = ['Teaching','Non-Teaching','Admin','Teaching + Admin']
const PAGE_SIZE        = 25

const ROLE_META = {
  'Teaching':         { color:'#0891b2', bg:'#e0f2fe', label:'🎓 Teaching' },
  'Non-Teaching':     { color:'#6366f1', bg:'#eef2ff', label:'🏢 Non-Teaching' },
  'Admin':            { color:'#7c3aed', bg:'#f3e8ff', label:'⚙️ Admin' },
  'Teaching + Admin': { color:'#d97706', bg:'#fef3c7', label:'🎓⚙️ T+Admin' },
}
const PRIORITY_META = {
  High:   { color:'#ef4444', bg:'#fef2f2', icon:'🔴' },
  Medium: { color:'#f59e0b', bg:'#fffbeb', icon:'🟡' },
  Low:    { color:'#22c55e', bg:'#f0fdf4', icon:'🟢' },
}
const STATUS_META = {
  Pending:       { color:'#6366f1', bg:'#eef2ff', icon:'⏳' },
  'In Progress': { color:'#0ea5e9', bg:'#f0f9ff', icon:'🔄' },
  Done:          { color:'#16a34a', bg:'#dcfce7', icon:'✅' },
  Overdue:       { color:'#dc2626', bg:'#fee2e2', icon:'🚨' },
}

const getLevel = score => {
  if (score === null || score === undefined) return null
  return LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[4]
}

export const calcScores = row => {
  const wd       = row.working_days || 26
  const attRatio = wd > 0 ? Math.min(1, (row.days_present || 0) / wd) : 0
  const p1 = wd > 0 ? Math.min(30, attRatio * 30) : 0
  const p2 = attRatio * Math.max(0, 20 - (row.late_count || 0) * 1 - (row.early_leave_count || 0) * 0.5)
  const p3 = row.tasks_assigned > 0 ? Math.min(20, ((row.tasks_completed_on_time || 0) / row.tasks_assigned) * 20) : 0
  const p4 = row.feedback_avg > 0 ? Math.min(15, (row.feedback_avg / 5) * 15) : 0
  const p5 = row.initiative_score > 0 ? Math.min(15, (row.initiative_score / 5) * 15) : 0
  const total = parseFloat((p1 + p2 + p3 + p4 + p5).toFixed(1))
  return {
    p1: parseFloat(p1.toFixed(1)), p2: parseFloat(p2.toFixed(1)),
    p3: parseFloat(p3.toFixed(1)), p4: parseFloat(p4.toFixed(1)),
    p5: parseFloat(p5.toFixed(1)), total
  }
}

const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const formatMonth  = m => { if (!m) return ''; const [y,mo] = m.split('-'); return new Date(y, parseInt(mo)-1).toLocaleString('default', {month:'long', year:'numeric'}) }
const fmt          = n => `₹${Math.round(Number(n)||0).toLocaleString('en-IN')}`
const fmtDate      = d => d ? new Date(d).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : '—'
const daysDiff     = d => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000) }
const validatePhone = p => /^\d{10}$/.test((p||'').replace(/\s/g,''))
const sanitizeEmail = e => (e||'').trim().toLowerCase()

const emptyForm  = { name:'', phone:'', email:'', department:'', designation:'', role:'Teaching', joining_date:'', qualification:'', status:'Active' }
const emptyScore = { working_days:26, days_present:0, late_count:0, early_leave_count:0, tasks_assigned:0, tasks_completed_on_time:0, feedback_avg:0, initiative_score:0 }

// ─── Mobile Hook ──────────────────────────────────────────────────────────────

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

// ─── Global CSS ───────────────────────────────────────────────────────────────

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
  * { box-sizing:border-box }
  body { font-family:'Outfit',system-ui,sans-serif; background:#f1f5f9 }
  select,input,textarea { font-family:'Outfit',system-ui,sans-serif }
  select:focus,input:focus,textarea:focus { outline:2px solid #1e3a5f; outline-offset:1px; border-color:#1e3a5f !important }
  ::-webkit-scrollbar { width:4px; height:4px }
  ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px }
  @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  .table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch }
  @media(max-width:640px){
    .stat-grid { grid-template-columns:repeat(2,1fr) !important }
    .form-grid  { grid-template-columns:1fr !important }
    .tab-bar    { grid-template-columns:repeat(2,1fr) !important }
    .hide-mob   { display:none !important }
    .task-grid  { grid-template-columns:repeat(2,1fr) !important }
  }
  @media(max-width:400px){ .stat-grid { grid-template-columns:1fr !important } }
`

// ─── Shared Styles ────────────────────────────────────────────────────────────

const S = {
  page:  { padding:20, fontFamily:"'Outfit',system-ui,sans-serif", background:'#f1f5f9', minHeight:'100vh' },
  card:  { background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,.07)', padding:20, marginBottom:16 },
  btn:   (color='#1e3a5f', disabled=false) => ({ backgroundColor:disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontSize:13, fontFamily:'inherit', minHeight:44 }),
  btnSm: (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'inherit', minHeight:36 }),
  input: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', fontFamily:'inherit', minHeight:44 },
  label: { display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' },
}
const TH = { padding:'11px 14px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12, whiteSpace:'nowrap' }
const TD = { padding:'11px 14px', verticalAlign:'middle', color:'#334155' }

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg]   = useState('')
  const [col, setCol]   = useState('#1e3a5f')
  const timerRef        = useRef(null)
  const show = useCallback((message, color='#1e3a5f') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMsg(message); setCol(color)
    timerRef.current = setTimeout(() => setMsg(''), 3200)
  }, [])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  const el = msg ? (
    <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:9999, background:'white', border:`1px solid ${col}`, borderLeft:`4px solid ${col}`, borderRadius:10, padding:'12px 20px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.18)', maxWidth:'90vw', color:'#1e293b', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap', animation:'slideUp .2s ease' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:col, flexShrink:0 }}/>
      {msg}
    </div>
  ) : null
  return { show, el }
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel='Confirm', danger=false, onConfirm, onCancel }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,.6)', display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center' }} onClick={onCancel}>
      <div style={{ background:'white', borderRadius:isMobile?'16px 16px 0 0':12, padding:24, width:isMobile?'100%':380, maxWidth:'95vw', animation:'slideUp .2s ease' }} onClick={e => e.stopPropagation()}>
        {isMobile && <div style={{ width:36, height:4, background:'#e2e8f0', borderRadius:2, margin:'0 auto 16px', opacity:.6 }}/>}
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:20, lineHeight:1.7 }}>{message}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onConfirm} style={{ flex:1, padding:12, borderRadius:8, border:'none', background:danger?'#dc2626':'#1e3a5f', color:'white', fontWeight:700, fontSize:14, cursor:'pointer', minHeight:44 }}>{confirmLabel}</button>
          <button onClick={onCancel}  style={{ padding:'12px 20px', borderRadius:8, border:'1px solid #e2e8f0', background:'white', color:'#64748b', fontWeight:600, fontSize:13, cursor:'pointer', minHeight:44 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Badge Components ─────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  if (!role) return null
  const m = ROLE_META[role] || { color:'#64748b', bg:'#f1f5f9', label:role }
  return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:700, background:m.bg, color:m.color, whiteSpace:'nowrap' }}>{m.label}</span>
}

function LevelBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>
  const lvl = getLevel(score)
  return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'4px 9px', borderRadius:99, fontSize:12, fontWeight:700, background:lvl.bg, color:lvl.color, border:`1px solid ${lvl.border}` }}>{lvl.emoji} {lvl.label}</span>
}

function ScoreBar({ value, max, color='#1e3a5f' }) {
  const p = Math.min(100, (value / max) * 100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:7, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', background:color, borderRadius:4, transition:'width .4s' }}/>
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, minWidth:36, textAlign:'right', fontFamily:"'JetBrains Mono',monospace" }}>{value}/{max}</span>
    </div>
  )
}

function TaskBadge({ value, type }) {
  const meta = type === 'priority' ? PRIORITY_META[value] : STATUS_META[value]
  if (!meta) return <span>{value}</span>
  return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius:99, fontSize:11, fontWeight:700, background:meta.bg, color:meta.color, whiteSpace:'nowrap' }}>{meta.icon} {value}</span>
}

function MiniBar({ done, total, overdue }) {
  const p     = total > 0 ? Math.round((done / total) * 100) : 0
  const color = overdue > 0 ? '#ef4444' : p >= 80 ? '#22c55e' : p >= 50 ? '#f59e0b' : '#6366f1'
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
        <span style={{ fontSize:11, color:'#64748b' }}>{done}/{total} done</span>
        <span style={{ fontSize:11, fontWeight:700, color, fontFamily:"'JetBrains Mono',monospace" }}>{p}%</span>
      </div>
      <div style={{ height:5, borderRadius:99, background:'#e2e8f0', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${p}%`, borderRadius:99, background:color, transition:'width .5s' }}/>
      </div>
      {overdue > 0 && <div style={{ fontSize:10, color:'#ef4444', fontWeight:700, marginTop:2 }}>🚨 {overdue} overdue</div>}
    </div>
  )
}

// ─── Admin PIN helpers ────────────────────────────────────────────────────────

async function verifyAdminPin(pin) {
  const { data, error } = await supabase.rpc('verify_admin_pin', { pin })
  if (error) throw new Error(error.message)
  return !!data
}
function isAdminUnlocked() {
  try { const ts = parseInt(sessionStorage.getItem(ADMIN_UNLOCK_KEY)||'0'); return ts > 0 && Date.now()-ts < ADMIN_UNLOCK_DURATION_MS } catch { return false }
}
function setAdminUnlocked() {
  try { sessionStorage.setItem(ADMIN_UNLOCK_KEY, String(Date.now())) } catch {}
}

// ─── Admin PIN Modal ──────────────────────────────────────────────────────────

function AdminPinModal({ onSuccess, onClose }) {
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const isMobile = useIsMobile()
  const verify = async () => {
    if (!pin.trim()) { setError('Enter PIN.'); return }
    setLoading(true); setError('')
    try {
      const ok = await verifyAdminPin(pin)
      if (ok) { setAdminUnlocked(); onSuccess() }
      else { setError('Incorrect PIN. Try again.'); setPin('') }
    } catch (err) { setError('Verification failed: ' + err.message) }
    finally { setLoading(false) }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:10000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:isMobile?'20px 20px 0 0':16, padding:32, width:'100%', maxWidth:360, boxShadow:'0 20px 60px rgba(0,0,0,.3)', textAlign:'center', animation:'slideUp .25s ease' }}>
        {isMobile && <div style={{ width:36, height:4, background:'#e2e8f0', borderRadius:2, margin:'0 auto 20px', opacity:.6 }}/>}
        <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
        <h2 style={{ fontSize:18, fontWeight:800, color:'#1e3a5f', margin:'0 0 6px' }}>Admin Access Required</h2>
        <p style={{ fontSize:13, color:'#64748b', margin:'0 0 24px' }}>Salary configuration is restricted. Session expires in 15 minutes.</p>
        <input type="password" placeholder="Enter Admin PIN" value={pin}
          onChange={e => { setPin(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && verify()}
          style={{ ...S.input, textAlign:'center', fontSize:22, letterSpacing:10, marginBottom:12 }} autoFocus/>
        {error && <div style={{ background:'#fee2e2', color:'#dc2626', borderRadius:8, padding:'8px 12px', fontSize:13, fontWeight:600, marginBottom:12 }}>{error}</div>}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ ...S.btn('#64748b'), flex:1 }}>Cancel</button>
          <button onClick={verify} disabled={loading} style={{ ...S.btn('#1e3a5f', loading), flex:1 }}>{loading ? '⏳ Verifying…' : '🔓 Verify'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────

function EditStaffModal({ staffMember, onClose, onSaved, showToast }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({
    name:staffMember.name||'', phone:staffMember.phone||'', email:staffMember.email||'',
    department:staffMember.department||'', designation:staffMember.designation||'',
    role:staffMember.role||'Teaching', joining_date:staffMember.joining_date||'',
    qualification:staffMember.qualification||'', status:staffMember.status||'Active',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [resettingAttendance, setResettingAttendance] = useState(false)

  const handleResetAttendance = async () => {
    if (!window.confirm(`Reset today's attendance record for ${staffMember.name}?\n\nThis clears today's check-in so they can check in again, and resolves any fraud alerts tied to it. This cannot be undone.`)) return
    setResettingAttendance(true)
    try {
      const { data, error } = await supabase.rpc('admin_reset_today_attendance', {
        p_staff_id: staffMember.id, p_admin_name: 'Admin'
      })
      if (error) { showToast('❌ ' + error.message, '#dc2626'); return }
      if (!data?.ok) { showToast('❌ Reset failed — ' + (data?.error || 'unknown'), '#dc2626'); return }
      showToast(data.deleted_count > 0 ? `✅ ${data.message}` : 'ℹ️ ' + data.message, data.deleted_count > 0 ? '#16a34a' : '#64748b')
    } catch (err) {
      showToast('❌ Error: ' + err.message, '#dc2626')
    } finally {
      setResettingAttendance(false)
    }
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.designation.trim()) e.designation = 'Designation is required'
    if (form.phone && !validatePhone(form.phone)) e.phone = 'Enter valid 10-digit phone'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    setErrors(e); return Object.keys(e).length === 0
  }
  const handleSave = async e => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await staffDB.update(staffMember.id, { ...form, email:sanitizeEmail(form.email), joining_date:form.joining_date||null })
      showToast('✅ Staff updated', '#16a34a'); onSaved(); onClose()
    } catch (err) { showToast('❌ Error: ' + err.message, '#dc2626') }
    finally { setSaving(false) }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:10000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:16 }}>
      <div style={{ background:'white', borderRadius:isMobile?'20px 20px 0 0':16, width:'100%', maxWidth:580, maxHeight:isMobile?'92vh':'88vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)', animation:'slideUp .25s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#254e91)', padding:'18px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:11, color:'#93c5fd', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>✏️ Edit Staff Profile</div>
            <div style={{ fontSize:17, fontWeight:800, color:'white', marginTop:4 }}>{staffMember.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.15)', border:'none', color:'white', width:34, height:34, borderRadius:8, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ padding:20, overflowY:'auto', flex:1 }}>
          <div className="form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[
              { key:'name',         label:'Full Name *',   required:true },
              { key:'phone',        label:'Phone (10-digit)' },
              { key:'email',        label:'Email',         type:'email' },
              { key:'designation',  label:'Designation *', required:true, placeholder:'Teacher / Accountant' },
              { key:'joining_date', label:'Joining Date',  type:'date' },
              { key:'qualification',label:'Qualification', placeholder:'B.Ed / M.A / B.Com' },
            ].map(f => (
              <div key={f.key}>
                <label style={S.label}>{f.label}</label>
                <input type={f.type||'text'} value={form[f.key]} onChange={e => setForm({...form, [f.key]:e.target.value})} required={f.required} placeholder={f.placeholder||''} style={{ ...S.input, borderColor:errors[f.key]?'#dc2626':'#d1d5db' }}/>
                {errors[f.key] && <div style={{ fontSize:11, color:'#dc2626', marginTop:3, fontWeight:600 }}>⚠ {errors[f.key]}</div>}
              </div>
            ))}
            <div><label style={S.label}>Department</label><select value={form.department} onChange={e => setForm({...form, department:e.target.value})} required style={{ ...S.input, backgroundColor:'white' }}><option value="">Select Department</option>{DEPARTMENTS_LIST.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label style={S.label}>Role</label><select value={form.role} onChange={e => setForm({...form, role:e.target.value})} style={{ ...S.input, backgroundColor:'white' }}>{ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label style={S.label}>Status</label><select value={form.status} onChange={e => setForm({...form, status:e.target.value})} style={{ ...S.input, backgroundColor:'white' }}><option>Active</option><option>Inactive</option></select></div>
          </div>

          <div style={{ marginTop:20, padding:14, borderRadius:10, background:'#fff7ed', border:'1px solid #fed7aa' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#9a3412', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>📍 Attendance Reset</div>
            <div style={{ fontSize:12, color:'#7c2d12', marginBottom:10 }}>
              Clears {staffMember.name}'s check-in record for today only — use this if they're stuck behind a "device clash" flag, duplicate check-in error, or GPS issue and need to check in again.
            </div>
            <button type="button" onClick={handleResetAttendance} disabled={resettingAttendance}
              style={{ ...S.btnSm(resettingAttendance ? '#94a3b8' : '#ea580c'), width:'100%', padding:'10px 12px', fontSize:12 }}>
              {resettingAttendance ? '⏳ Resetting…' : '🔄 Reset Today\'s Attendance'}
            </button>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:18, flexWrap:'wrap' }}>
            <button type="button" onClick={onClose} style={{ ...S.btn('#64748b'), flex:1 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...S.btn('#16a34a', saving), flex:2 }}>{saving ? '⏳ Saving…' : '💾 Update Staff'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Salary Setup Modal ───────────────────────────────────────────────────────

function SalarySetupModal({ staffMember, onClose, onSaved, showToast }) {
  const isMobile = useIsMobile()
  const [salaryForm, setSalaryForm] = useState({
    basic_salary:staffMember.basic_salary||0,
    seniority_allowance:staffMember.seniority_allowance||0,
    loyalty_bonus:staffMember.loyalty_bonus||0,
    role_bonus:staffMember.role_bonus||0,
    hra:staffMember.hra||0,
  })
  const [saving, setSaving] = useState(false)
  const [activeAdvances, setActiveAdvances] = useState(null) // null = loading, [] = none, else rows
  const gross = Object.values(salaryForm).reduce((a, b) => a + Number(b), 0)

  // Read-only view of this staff member's current active advances — the real
  // "Advance" deduction is calculated monthly from staff_advances (in
  // Salary.jsx's pendingAdvance), not a fixed number set here, so this modal
  // only shows it and links to the actual Advances screen rather than
  // duplicating a second, disconnected advance value.
  useEffect(() => {
    let cancelled = false
    supabase.from('staff_advances').select('amount, repaid_amount, repay_months')
      .eq('staff_id', staffMember.id).eq('status', 'Active')
      .then(({ data }) => { if (!cancelled) setActiveAdvances(data || []) })
    return () => { cancelled = true }
  }, [staffMember.id])

  const advanceOutstanding = (activeAdvances || []).reduce((sum, a) => sum + (Number(a.amount) - Number(a.repaid_amount)), 0)

  if (!isAdminUnlocked()) { onClose(); return null }
  const handleSave = async () => {
    setSaving(true)
    try { await staffDB.updateSalary(staffMember.id, salaryForm); showToast('✅ Salary saved', '#16a34a'); onSaved(); onClose() }
    catch (err) { showToast('❌ Error: ' + err.message, '#dc2626') }
    finally { setSaving(false) }
  }
  const fields = [
    { key:'basic_salary',        label:'Basic Salary',        icon:'💰', color:'#0C447C', desc:'Fixed monthly base pay' },
    { key:'hra',                 label:'HRA',                 icon:'🏠', color:'#0891b2', desc:'House rent allowance' },
    { key:'seniority_allowance', label:'Seniority Allowance', icon:'⭐', color:'#7c3aed', desc:'Based on years of service' },
    { key:'loyalty_bonus',       label:'Loyalty Bonus',       icon:'🎖️', color:'#b45309', desc:'Long-term retention reward' },
    { key:'role_bonus',          label:'Role Bonus',          icon:'🏅', color:'#16a34a', desc:'Position-specific incentive' },
  ]
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:10000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:16 }}>
      <div style={{ background:'white', borderRadius:isMobile?'20px 20px 0 0':16, width:'100%', maxWidth:500, maxHeight:isMobile?'92vh':'88vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)', animation:'slideUp .25s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#254e91)', padding:'18px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:11, color:'#93c5fd', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>🔐 Admin · Salary Config</div>
            <div style={{ fontSize:17, fontWeight:800, color:'white', marginTop:4 }}>{staffMember.name}</div>
            <RoleBadge role={staffMember.role}/>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.15)', border:'none', color:'white', width:34, height:34, borderRadius:8, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ padding:20, overflowY:'auto', flex:1 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
            {fields.map(f => (
              <div key={f.key} style={{ display:'flex', alignItems:'center', gap:12, background:'#f8fafc', borderRadius:10, padding:'12px 14px', border:'1px solid #e2e8f0' }}>
                <div style={{ width:34, height:34, borderRadius:8, background:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{f.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#374151' }}>{f.label}</div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>{f.desc}</div>
                </div>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:13, fontWeight:700, color:f.color }}>₹</span>
                  <input type="number" min="0" value={salaryForm[f.key]} onChange={e => setSalaryForm({...salaryForm, [f.key]:e.target.value})} style={{ width:100, padding:'8px 8px 8px 22px', borderRadius:8, border:`1.5px solid ${f.color}44`, fontSize:14, fontWeight:700, color:f.color, background:'white', textAlign:'right', fontFamily:'inherit', minHeight:40 }}/>
                </div>
              </div>
            ))}
          </div>

          {/* Advance is calculated monthly from active loans, not a fixed
              number — shown read-only here with a link to the real screen. */}
          <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:'12px 14px', marginBottom:18, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>💵</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#374151' }}>Advance</div>
              <div style={{ fontSize:11, color:'#94a3b8' }}>
                {activeAdvances === null
                  ? 'Loading…'
                  : advanceOutstanding > 0
                    ? `₹${advanceOutstanding.toLocaleString('en-IN')} outstanding — deducted automatically each month`
                    : 'No active advance for this staff member'}
              </div>
            </div>
            <button
              onClick={() => { onClose(); showToast?.('Open Salary → Advances to manage advances', '#b45309') }}
              style={{ background:'#b45309', color:'white', border:'none', borderRadius:8, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}
            >
              💰 Manage in Salary
            </button>
          </div>

          <div style={{ background:'linear-gradient(135deg,#E6F1FB,#EAF3DE)', borderRadius:10, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>Gross Monthly</div>
            <div style={{ fontSize:24, fontWeight:800, color:'#0C447C', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(gross)}</div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ ...S.btn('#64748b'), flex:1 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...S.btn('#1e3a5f', saving), flex:2 }}>{saving ? '⏳ Saving…' : '💾 Save Salary'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Scorecard Modal ──────────────────────────────────────────────────────────

function ScorecardModal({ record, staffName, onClose }) {
  const isMobile = useIsMobile()
  if (!record) return null
  const scoreRecord = { ...record, working_days: record.working_days || 26 }
  const { p1, p2, p3, p4, p5, total } = calcScores(scoreRecord)
  const lvl = getLevel(total)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:10000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:20 }}>
      <div style={{ background:'white', borderRadius:isMobile?'20px 20px 0 0':16, padding:28, width:'100%', maxWidth:500, maxHeight:isMobile?'92vh':'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)', animation:'slideUp .25s ease' }}>
        {isMobile && <div style={{ width:36, height:4, background:'#e2e8f0', borderRadius:2, margin:'0 auto 20px', opacity:.6 }}/>}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:19, fontWeight:800, color:'#1e293b', margin:0 }}>{staffName}</h2>
            <p style={{ color:'#64748b', fontSize:13, margin:'4px 0 0' }}>{formatMonth(record.month)}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#64748b', fontFamily:'inherit', minWidth:36, minHeight:36 }}>✕</button>
        </div>
        <div style={{ textAlign:'center', padding:20, background:lvl.bg, borderRadius:12, marginBottom:20, border:`2px solid ${lvl.border}` }}>
          <div style={{ fontSize:36 }}>{lvl.emoji}</div>
          <div style={{ fontSize:28, fontWeight:800, color:lvl.color, fontFamily:"'JetBrains Mono',monospace" }}>{total}</div>
          <div style={{ fontSize:16, fontWeight:700, color:lvl.color }}>{lvl.label}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            { label:'Attendance',      score:p1, max:30, color:'#0ea5e9', detail:`${record.days_present||0}/${record.working_days||26} days` },
            { label:'Punctuality',     score:p2, max:20, color:'#10b981', detail:`${record.late_count||0} late, ${record.early_leave_count||0} early` },
            { label:'Task Completion', score:p3, max:20, color:'#f59e0b', detail:`${record.tasks_completed_on_time||0}/${record.tasks_assigned||0} tasks` },
            { label:'Feedback',        score:p4, max:15, color:'#8b5cf6', detail:`Avg: ${record.feedback_avg||0}/5` },
            { label:'Initiative',      score:p5, max:15, color:'#ec4899', detail:`Rating: ${record.initiative_score||0}/5` },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{item.label}</span>
                <span style={{ fontSize:12, color:'#94a3b8' }}>{item.detail}</span>
              </div>
              <ScoreBar value={item.score} max={item.max} color={item.color}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Assign Task Modal ────────────────────────────────────────────────────────

function AssignTaskModal({ staffList, preselectedStaff, onClose, onSaved }) {
  const courseData = useCourseData()
  const isMobile   = useIsMobile()
  const [form, setForm] = useState({
    title:'', description:'',
    assigned_to: preselectedStaff?.name || (staffList[0]?.name || ''),
    assigned_by: 'Admin',
    department: preselectedStaff?.department || 'Administration',
    priority:'Medium', status:'Pending', due_date:'',
    course:'', subtype:'', class_name:'', batch_id:'',
  })
  const [saving, setSaving] = useState(false)
  const selectedStaffObj = staffList.find(s => s.name === form.assigned_to)
  const isTeaching = selectedStaffObj?.role === 'Teaching' || selectedStaffObj?.role === 'Teaching + Admin'
  const handleSave = async () => {
    if (!form.title || !form.assigned_to) { alert('Title and Assigned To are required'); return }
    setSaving(true)
    const { data, error } = await supabase.from('staff_tasks').insert([{
      title:form.title, description:form.description||null, assigned_to:form.assigned_to,
      assigned_by:form.assigned_by, department:form.department, priority:form.priority,
      status:form.status, due_date:form.due_date||null,
      course:isTeaching?(form.course||null):null, subtype:isTeaching?(form.subtype||null):null,
      class_name:isTeaching?(form.class_name||null):null, batch_id:isTeaching?(form.batch_id||null):null,
      created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    }]).select()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSaved(data?.[0]); onClose()
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.65)', backdropFilter:'blur(4px)', zIndex:10000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:20 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:isMobile?'20px 20px 0 0':20, width:'100%', maxWidth:640, maxHeight:isMobile?'94vh':'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,.22)', animation:'slideUp .25s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#6366f1)', padding:'20px 24px', color:'white', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:11, opacity:.7, letterSpacing:1, textTransform:'uppercase' }}>GNSI · Staff Tasks</div>
            <div style={{ fontSize:19, fontWeight:800 }}>Assign New Task</div>
            {preselectedStaff && <div style={{ fontSize:13, opacity:.8, marginTop:2 }}>→ {preselectedStaff.name}</div>}
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.18)', border:'none', color:'white', borderRadius:8, width:34, height:34, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
          <div><label style={S.label}>Task Title *</label><input value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="e.g. Submit lesson plan" style={S.input}/></div>
          <div><label style={S.label}>Description / Instructions</label><textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} rows={2} style={{ ...S.input, resize:'vertical', height:70 }} placeholder="Detailed instructions..."/></div>
          <div className="form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div><label style={S.label}>Assign To *</label><select value={form.assigned_to} onChange={e => { const sel = staffList.find(s => s.name === e.target.value); setForm({...form, assigned_to:e.target.value, department:sel?.department||form.department}) }} style={{ ...S.input, backgroundColor:'white' }}>{staffList.map(s => <option key={s.id} value={s.name}>{s.name} — {s.designation}</option>)}</select></div>
            <div><label style={S.label}>Assigned By</label><input value={form.assigned_by} onChange={e => setForm({...form, assigned_by:e.target.value})} style={S.input}/></div>
            <div><label style={S.label}>Department</label><select value={form.department} onChange={e => setForm({...form, department:e.target.value})} style={{ ...S.input, backgroundColor:'white' }}>{DEPARTMENTS_LIST.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label style={S.label}>Priority</label><select value={form.priority} onChange={e => setForm({...form, priority:e.target.value})} style={{ ...S.input, backgroundColor:'white' }}>{TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label style={S.label}>Due Date</label><input type="date" value={form.due_date} onChange={e => setForm({...form, due_date:e.target.value})} style={S.input}/></div>
          </div>
          {isTeaching && (
            <div style={{ padding:'14px 16px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#0284c7', marginBottom:12 }}>📚 Course Context <span style={{ fontWeight:400, color:'#64748b' }}>(optional)</span></div>
              <div className="form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <CoursePicker form={form} setForm={setForm} courseData={courseData}/>
              </div>
              {form.batch_id && <div style={{ marginTop:8, fontSize:12, color:'#16a34a', fontWeight:600 }}>✅ Linked to batch</div>}
            </div>
          )}
        </div>
        <div style={{ padding:'16px 20px 20px', display:'flex', gap:12, flexShrink:0 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, background:'linear-gradient(135deg,#1e3a5f,#6366f1)', color:'white', border:'none', borderRadius:12, padding:14, cursor:'pointer', fontWeight:800, fontSize:15, fontFamily:'inherit', minHeight:48, opacity:saving?.7:1 }}>
            {saving ? '⏳ Assigning…' : '✅ Assign Task'}
          </button>
          <button onClick={onClose} style={{ padding:'14px 22px', background:'#f1f5f9', border:'none', borderRadius:12, cursor:'pointer', fontWeight:600, color:'#64748b', fontFamily:'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────

function TaskDetailModal({ task, onClose, onStatusChange }) {
  const isMobile  = useIsMobile()
  const [note, setNote]     = useState(task.completion_note || '')
  const [saving, setSaving] = useState(false)
  const diff      = daysDiff(task.due_date)
  const isOverdue = diff !== null && diff < 0 && task.status !== 'Done'
  const sm = STATUS_META[isOverdue ? 'Overdue' : task.status] || STATUS_META.Pending
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.Medium
  const saveNote = async () => {
    setSaving(true)
    await supabase.from('staff_tasks').update({ completion_note:note, updated_at:new Date().toISOString() }).eq('id', task.id)
    setSaving(false)
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', backdropFilter:'blur(4px)', zIndex:10001, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:20 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:isMobile?'20px 20px 0 0':20, width:'100%', maxWidth:540, maxHeight:isMobile?'92vh':'88vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.2)', animation:'slideUp .25s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#0ea5e9)', padding:'20px 22px', color:'white', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:11, opacity:.7, textTransform:'uppercase', letterSpacing:1 }}>Task Detail</div>
            <div style={{ fontSize:17, fontWeight:800, marginTop:4, lineHeight:1.3 }}>{task.title}</div>
            {task.course && <div style={{ fontSize:12, opacity:.8, marginTop:4 }}>📚 {task.course}{task.subtype ? ` / ${task.subtype}` : ''}{task.class_name ? ` / ${task.class_name}` : ''}</div>}
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'white', borderRadius:8, width:34, height:34, cursor:'pointer', fontFamily:'inherit', minWidth:34, minHeight:34 }}>✕</button>
        </div>
        <div style={{ padding:20, overflowY:'auto', flex:1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {[['Assigned To',task.assigned_to],['Assigned By',task.assigned_by||'Admin'],['Department',task.department||'General'],['Due Date',fmtDate(task.due_date)]].map(([l,v]) => (
              <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:13, color:'#1e293b', fontWeight:600 }}>{v || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, background:pm.bg, color:pm.color }}>{pm.icon} {task.priority}</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, background:sm.bg, color:sm.color }}>{sm.icon} {isOverdue ? 'Overdue' : task.status}</span>
          </div>
          {task.description && <div style={{ marginBottom:14, background:'#f8fafc', borderRadius:10, padding:12, fontSize:13, color:'#475569', lineHeight:1.6 }}>{task.description}</div>}
          <div style={{ marginBottom:14 }}>
            <label style={{ ...S.label, marginBottom:6 }}>Completion Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} style={{ ...S.input, resize:'vertical', fontFamily:'inherit' }} placeholder="Add progress note..."/>
            <button onClick={saveNote} disabled={saving} style={{ ...S.btn('#1e3a5f', saving), marginTop:8, padding:'8px 16px', fontSize:13 }}>{saving ? 'Saving…' : 'Save Note'}</button>
          </div>
        </div>
        <div style={{ padding:'14px 20px 20px', display:'flex', gap:10, flexShrink:0 }}>
          {task.status !== 'Done' && <button onClick={() => { onStatusChange(task, task.status === 'Pending' ? 'In Progress' : 'Done'); onClose() }} style={{ flex:1, background:'linear-gradient(135deg,#6366f1,#0ea5e9)', color:'white', border:'none', borderRadius:10, padding:13, cursor:'pointer', fontWeight:700, fontSize:14, fontFamily:'inherit', minHeight:48 }}>{task.status === 'Pending' ? '▶ Start Task' : '✅ Mark Done'}</button>}
          {task.status === 'Done' && <button onClick={() => { onStatusChange(task, 'Pending'); onClose() }} style={{ flex:1, background:'#64748b', color:'white', border:'none', borderRadius:10, padding:13, cursor:'pointer', fontWeight:700, fontFamily:'inherit', minHeight:48 }}>↩ Reopen</button>}
          <button onClick={onClose} style={{ padding:'13px 20px', background:'#f1f5f9', border:'none', borderRadius:10, cursor:'pointer', fontWeight:600, color:'#64748b', fontFamily:'inherit' }}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Score Entry Row — NEW: color inputs + dirty badge + mini bars ─────────────

const ScoreEntryRow = React.memo(function ScoreEntryRow({ staff, score, onChange, isDirty }) {
  const computed = score ? calcScores(score) : null
  const lvl      = computed ? getLevel(computed.total) : null
  return (
    <tr style={{ borderBottom:'1px solid #f1f5f9', background:isDirty ? '#fffbeb' : 'white' }}>
      <td style={{ padding:'10px 14px', minWidth:160, position:'sticky', left:0, background:isDirty?'#fffbeb':'white', zIndex:1, borderRight:'2px solid #f1f5f9' }}>
        <div style={{ fontWeight:700, color:'#1e293b', fontSize:13 }}>{staff.name}</div>
        <div style={{ fontSize:10, color:'#94a3b8' }}>{staff.designation}</div>
        <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap', alignItems:'center' }}>
          <RoleBadge role={staff.role}/>
          {isDirty && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:99, background:'#fef3c7', color:'#b45309', fontWeight:700 }}>✎ edited</span>}
        </div>
      </td>
      {[
        { key:'days_present',             max:score?.working_days||26, color:'#0ea5e9' },
        { key:'late_count',                                            color:'#ef4444' },
        { key:'early_leave_count',                                     color:'#f97316' },
        { key:'tasks_assigned',                                        color:'#f59e0b' },
        { key:'tasks_completed_on_time',                               color:'#16a34a' },
        { key:'feedback_avg',    step:.1, max:5,                       color:'#8b5cf6' },
        { key:'initiative_score',          max:5,                      color:'#ec4899' },
      ].map(field => (
        <td key={field.key} style={{ padding:6, textAlign:'center' }}>
          <input type="number" min="0" max={field.max||999} step={field.step||1}
            value={score?.[field.key] ?? 0}
            onChange={e => onChange(staff.id, field.key, parseFloat(e.target.value)||0)}
            style={{ width:62, padding:'7px 4px', borderRadius:6, border:`1.5px solid ${field.color}44`, fontSize:13, textAlign:'center', fontFamily:'inherit', color:field.color, fontWeight:700, background:'white' }}/>
        </td>
      ))}
      <td style={{ padding:'10px 14px', textAlign:'center' }}>
        {computed ? (
          <>
            <div style={{ fontSize:20, fontWeight:800, color:lvl?.color, fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{computed.total}</div>
            <div style={{ marginTop:4 }}><LevelBadge score={computed.total}/></div>
            <div style={{ display:'flex', gap:2, justifyContent:'center', alignItems:'flex-end', marginTop:5, height:18 }}>
              {[{v:computed.p1,m:30,c:'#0ea5e9'},{v:computed.p2,m:20,c:'#10b981'},{v:computed.p3,m:20,c:'#f59e0b'},{v:computed.p4,m:15,c:'#8b5cf6'},{v:computed.p5,m:15,c:'#ec4899'}]
                .map((b,i) => <div key={i} title={`${b.v}/${b.m}`} style={{ width:8, borderRadius:2, height:Math.max(2, Math.round((b.v/b.m)*16)), background:b.c }}/>)}
            </div>
          </>
        ) : '—'}
      </td>
    </tr>
  )
})

function Staff({ currentUser: currentUserProp, perms, staff: staffProp, onStaffChange }) {
  const isMobile = useIsMobile()
  const { show: showToast, el: toastEl } = useToast()
  const { currentUser, userLoading, isAdmin, canManage } = useCurrentUser(currentUserProp)
  const canEdit = isAdmin || canManage
  const staff = staffProp || []
  const fetchStaff = onStaffChange

  const ALL_TABS = [
    { key:'staff',       label:'👥 Staff',   show:true },
    { key:'tasks',       label:'📋 Tasks',   show:true },
    { key:'scoring',     label:'📊 Scoring', show:isAdmin },
    { key:'leaderboard', label:'🏆 Leaders', show:true },
    { key:'history',     label:'📅 History', show:true },
    { key:'geo',         label:'📍 Geo',     show:true },
  ].filter(t => t.show)

  // ── State ─────────────────────────────────────────────────────────────────
  const [saving,            setSaving]            = useState(false)
  const [showForm,          setShowForm]          = useState(false)
  const [search,            setSearch]            = useState('')
  const [statusFilter,      setStatusFilter]      = useState('All')
  const [roleFilter,        setRoleFilter]        = useState('All')
  const [form,              setForm]              = useState(emptyForm)
  const [formErrors,        setFormErrors]        = useState({})
  const [activeTab,         setActiveTab]         = useState('staff')
  const [editingStaff,      setEditingStaff]      = useState(null)
  const [enrollFaceTarget,  setEnrollFaceTarget]  = useState(null)
  const [faceEnrolledIds,   setFaceEnrolledIds]   = useState(new Set())
  const [page,              setPage]              = useState(1)
  const [scoreMonth,        setScoreMonth]        = useState(currentMonth())
  const [scores,            setScores]            = useState({})
  const [dirtyIds,          setDirtyIds]          = useState(new Set())
  const [scoreSaving,       setScoreSaving]       = useState(false)
  const [allMonthlyScores,  setAllMonthlyScores]  = useState([])
  const [selectedScorecard, setSelectedScorecard] = useState(null)
  const [historyStaffId,    setHistoryStaffId]    = useState('')
  const [workingDays,       setWorkingDays]       = useState(26)
  const [salaryTarget,      setSalaryTarget]      = useState(null)
  const [showPinModal,      setShowPinModal]      = useState(false)
  const [showSalaryModal,   setShowSalaryModal]   = useState(false)
  const [tasks,             setTasks]             = useState([])
  const [tasksLoading,      setTasksLoading]      = useState(false)
  const [showAssignModal,   setShowAssignModal]   = useState(false)
  const [assignPreselected, setAssignPreselected] = useState(null)
  const [detailTask,        setDetailTask]        = useState(null)
  const [taskSearch,        setTaskSearch]        = useState('')
  const [taskStatusFilter,  setTaskStatusFilter]  = useState('All')
  const [taskPriorityFilter,setTaskPriorityFilter]= useState('All')
  const [taskStaffFilter,   setTaskStaffFilter]   = useState('All')
  const [taskRoleFilter,    setTaskRoleFilter]    = useState('All')
  const [confirmModal,      setConfirmModal]      = useState(null)
  const [autoMarking,       setAutoMarking]       = useState(false)
  const [autoMarkResults,   setAutoMarkResults]   = useState(null)

  const taskStatusInFlight = useRef(new Set())

  // Track which staff have an approved face enrollment, for the row badge
  const fetchFaceEnrolledIds = useCallback(async () => {
    const { data, error } = await supabase
      .from('staff_face_descriptors')
      .select('staff_id')
      .eq('status', 'approved')
    if (!error) setFaceEnrolledIds(new Set((data || []).map(r => r.staff_id)))
  }, [])
  useEffect(() => { fetchFaceEnrolledIds() }, [fetchFaceEnrolledIds, staff.length])

  const loggedInStaff = useMemo(() => {
  if (currentUser?.role === 'Admin') return null
  if (currentUser?.staff_profile_id)
    return staff.find(s => s.id === currentUser.staff_profile_id) || null
  return null
}, [staff, currentUser])

  // ── Data Loaders ──────────────────────────────────────────────────────────

  const fetchSalaryData = useCallback(async () => {
    if (onStaffChange) onStaffChange()
  }, [onStaffChange])

  const fetchTasks = async () => {
    setTasksLoading(true)
    const { data, error } = await supabase.from('staff_tasks').select('*').order('created_at', { ascending:false })
    if (!error && data) {
      const now = new Date()
      const toMark = data.filter(t => t.status !== 'Done' && t.due_date && new Date(t.due_date) < now && t.status !== 'Overdue')
      if (toMark.length) {
        supabase.from('staff_tasks').update({ status:'Overdue', updated_at:now.toISOString() }).in('id', toMark.map(t => t.id)).then(() => {})
        setTasks(data.map(t => toMark.find(x => x.id === t.id) ? {...t, status:'Overdue'} : t))
      } else {
        setTasks(data)
      }
    } else if (error) showToast('⚠️ Could not load tasks: ' + error.message, '#dc2626')
    setTasksLoading(false)
  }

  const fetchScoresForMonth = async month => {
    const { data } = await supabase.from('staff_monthly_scores').select('*').eq('month', month)
    if (data) {
      const map = {}
      data.forEach(r => { map[r.staff_id] = r })
      setScores(map)
      setWorkingDays(data[0]?.working_days || 26)
    } else {
      setScores({})
    }
    setDirtyIds(new Set())
  }

  const fetchAllScores = async () => {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 24)
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}`
    const { data } = await supabase.from('staff_monthly_scores').select('*').gte('month', cutoffStr).order('month', { ascending:false })
    if (data) setAllMonthlyScores(data)
  }

  // ── Cross-module signal: Teaching.jsx (via EnhancedLogEntry) emits these
  // when a teacher submits a log late, or when a log is auto-flagged
  // excellent. Rather than a separate deduction table, this nudges the same
  // manually-entered `initiative_score` (p5) field the admin already fills
  // in on the Scoring tab — auto-adjustment + manual override, same pattern
  // as days_present/late_count. Only touches the CURRENT month, and only if
  // that teacher's row isn't already confirmed & locked for payroll.
  const INITIATIVE_STEP = 0.25 // small nudge per event; admin can still override manually
  const nudgeInitiativeScore = useCallback(async ({ staffId, delta }) => {
    if (!staffId) return
    const month = currentMonth()
    try {
      const { data: existing } = await supabase
        .from('staff_monthly_scores')
        .select('*')
        .eq('staff_id', staffId)
        .eq('month', month)
        .maybeSingle()

      if (existing?.is_confirmed) return // locked month — never touch confirmed payroll-linked scores

      const base = existing || { ...emptyScore, staff_id: staffId, month, working_days: workingDays }
      const nextInitiative = Math.max(0, Math.min(5, (Number(base.initiative_score) || 0) + delta))
      const merged = { ...base, initiative_score: nextInitiative, working_days: base.working_days || workingDays }
      const computed = calcScores(merged)
      const row = {
        staff_id: staffId, month, working_days: merged.working_days,
        days_present: merged.days_present || 0, late_count: merged.late_count || 0,
        early_leave_count: merged.early_leave_count || 0, tasks_assigned: merged.tasks_assigned || 0,
        tasks_completed_on_time: merged.tasks_completed_on_time || 0,
        feedback_avg: merged.feedback_avg || 0, initiative_score: nextInitiative,
        p1_attendance: computed.p1, p2_punctuality: computed.p2, p3_tasks: computed.p3,
        p4_feedback: computed.p4, p5_initiative: computed.p5,
        total_score: computed.total, level: getLevel(computed.total)?.label || 'Probation',
      }
      const { error } = await supabase.from('staff_monthly_scores').upsert([row], { onConflict: 'staff_id,month' })
      if (!error) {
        setScores(prev => ({ ...prev, [staffId]: { ...prev[staffId], ...row } }))
        if (scoreMonth === month) fetchScoresForMonth(month)
      }
    } catch (e) { console.error('Teaching-signal score nudge failed:', e.message) }
  }, [workingDays, scoreMonth])

  useEffect(() => {
    const offLate = EventBus.on(GNSI_EVENTS.TEACHING_LOG_LATE, ({ staffId }) => {
      nudgeInitiativeScore({ staffId, delta: -INITIATIVE_STEP })
    })
    const offExcellent = EventBus.on(GNSI_EVENTS.TEACHING_LOG_EXCELLENT, ({ staffId }) => {
      nudgeInitiativeScore({ staffId, delta: +INITIATIVE_STEP })
    })
    return () => { offLate(); offExcellent() }
  }, [nudgeInitiativeScore])

  useEffect(() => { if (activeTab === 'tasks')       fetchTasks() },                             [activeTab])
  useEffect(() => { if (activeTab === 'scoring')     fetchScoresForMonth(scoreMonth) },          [activeTab, scoreMonth])
  useEffect(() => { if (activeTab === 'leaderboard') { fetchScoresForMonth(scoreMonth); fetchAllScores() } }, [activeTab, scoreMonth])
  useEffect(() => { if (activeTab === 'history')     fetchAllScores() },                         [activeTab])

  // ── AUTO-MARK — calculates ALL 7 fields from live data ────────────────────

  const handleAutoMark = async () => {
    setAutoMarking(true)
    setAutoMarkResults(null)

    const [y, mo] = scoreMonth.split('-')
    const monthStart = `${y}-${mo}-01`
    const monthEnd   = `${y}-${mo}-${new Date(y, mo, 0).getDate()}T23:59:59`

    // 1. GeoAttendance for the month
    const { data: geoData } = await supabase
      .from('geo_attendance')
      .select('staff_id, check_in_time, check_out_time, status')
      .gte('check_in_time', monthStart)
      .lte('check_in_time', monthEnd)

    // 2. Tasks created this month
    const { data: taskData } = await supabase
      .from('staff_tasks')
      .select('assigned_to, status, completed_at, due_date, created_at')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)

    // 3. Student exam scores (Teaching staff feedback)
    // Needs: student_scores table with columns: teacher_name, marks_obtained, max_marks, exam_date
    const { data: examData } = await supabase
      .from('student_scores')
      .select('teacher_name, marks_obtained, max_marks')
      .gte('exam_date', monthStart.slice(0, 10))
      .lte('exam_date', monthEnd.slice(0, 10))

    // ── Build attendance map (keyed by staff_id) ──────────────────────────
    const attMap = {}
    ;(geoData || []).forEach(row => {
      if (!attMap[row.staff_id]) attMap[row.staff_id] = { present:0, late:0, earlyLeave:0 }
      if (row.check_in_time) {
        attMap[row.staff_id].present++
        // Late = check-in after 09:15
        const ci  = new Date(row.check_in_time)
        const cut = new Date(row.check_in_time); cut.setHours(9, 15, 0)
        if (ci > cut) attMap[row.staff_id].late++
        // Early leave = check-out before 17:00
        if (row.check_out_time) {
          const co  = new Date(row.check_out_time)
          const eco = new Date(row.check_out_time); eco.setHours(17, 0, 0)
          if (co < eco) attMap[row.staff_id].earlyLeave++
        }
      }
    })

    // ── Build task map (keyed by staff_id via name lookup) ────────────────
    const nameToId = {}
    staff.forEach(s => { nameToId[s.name] = s.id })

    const taskMap = {}
    ;(taskData || []).forEach(t => {
      const sid = nameToId[t.assigned_to]
      if (!sid) return
      if (!taskMap[sid]) taskMap[sid] = { assigned:0, onTime:0, earlyDone:0 }
      taskMap[sid].assigned++
      if (t.status === 'Done' && t.completed_at && t.due_date) {
        const completedAt = new Date(t.completed_at)
        const dueDate     = new Date(t.due_date)
        if (completedAt <= dueDate) {
          taskMap[sid].onTime++
          // Early done = completed more than 1 day before due
          if ((dueDate - completedAt) / 86400000 > 1) taskMap[sid].earlyDone++
        }
      }
    })

    // ── Build exam map (keyed by teacher name) ────────────────────────────
    const examMap = {}
    ;(examData || []).forEach(row => {
      if (!row.teacher_name || !row.max_marks) return
      const pct = (row.marks_obtained / row.max_marks) * 100
      if (!examMap[row.teacher_name]) examMap[row.teacher_name] = { totalPct:0, count:0 }
      examMap[row.teacher_name].totalPct += pct
      examMap[row.teacher_name].count++
    })

    // ── Auto-calculate Feedback (0–5) ─────────────────────────────────────
    // Teaching staff → student exam average mapped to 1–5
    // Non-teaching   → task quality ratio mapped to 0–5
    const calcFeedback = (staffObj, sid) => {
      const isTeaching = staffObj.role === 'Teaching' || staffObj.role === 'Teaching + Admin'
      if (isTeaching && examMap[staffObj.name]) {
        const avgPct = examMap[staffObj.name].totalPct / examMap[staffObj.name].count
        if (avgPct >= 90) return 5.0
        if (avgPct >= 75) return 4.0
        if (avgPct >= 60) return 3.0
        if (avgPct >= 45) return 2.0
        return 1.0
      }
      // Fallback for teaching staff with no exam data + all non-teaching
      const tm = taskMap[sid] || {}
      if (!tm.assigned) return 3.0 // neutral default
      return parseFloat(Math.min(5, (tm.onTime / tm.assigned) * 5).toFixed(1))
    }

    // ── Auto-calculate Initiative (0–5) ──────────────────────────────────
    // Points system — capped at 5:
    //   +1.0  zero late days this month
    //   +1.0  perfect attendance (present >= working_days)
    //   +1.5  50%+ tasks completed EARLY (before due date)
    //   +1.0  any tasks completed early
    //   +0.5  all assigned tasks completed on time (100% rate)
    //   +0.25 80%+ tasks on time
    const calcInitiative = sid => {
      const att  = attMap[sid]  || {}
      const task = taskMap[sid] || {}
      let pts = 1.0 // base

      if (att.late === 0 && att.present > 0) pts += 1.0   // zero late
      if (att.present >= workingDays)         pts += 1.0   // perfect attendance

      if (task.assigned > 0) {
        const onTimeRate = task.onTime   / task.assigned
        const earlyRate  = task.earlyDone / task.assigned
        if (earlyRate >= 0.5)      pts += 1.5
        else if (earlyRate > 0)    pts += 1.0
        if (onTimeRate >= 1.0)     pts += 0.5
        else if (onTimeRate >= 0.8) pts += 0.25
      }

      return parseFloat(Math.min(5, pts).toFixed(1))
    }

    // ── Merge everything into scores state ────────────────────────────────
    const next  = { ...scores }
    const dirty = new Set(dirtyIds)
    let filled  = 0

    staff.forEach(s => {
      const att  = attMap[s.id]  || {}
      const task = taskMap[s.id] || {}

      next[s.id] = {
        ...emptyScore,
        working_days:            workingDays,
        staff_id:                s.id,
        month:                   scoreMonth,
        days_present:            att.present   || 0,
        late_count:              att.late       || 0,
        early_leave_count:       att.earlyLeave || 0,
        tasks_assigned:          task.assigned  || 0,
        tasks_completed_on_time: task.onTime    || 0,
        feedback_avg:            calcFeedback(s, s.id),
        initiative_score:        calcInitiative(s.id),
      }
      dirty.add(s.id)
      if (att.present || task.assigned) filled++
    })

    setScores(next)
    setDirtyIds(dirty)
    setAutoMarkResults({
      filled,
      geoRows:  (geoData  || []).length,
      taskRows: (taskData || []).length,
      examRows: (examData || []).length,
    })
    setAutoMarking(false)
  }

  // ── Task derived data ─────────────────────────────────────────────────────

  const tasksWithOverdue = useMemo(() => tasks.map(t => ({
    ...t,
    _overdue: t.status === 'Overdue' || (daysDiff(t.due_date) !== null && daysDiff(t.due_date) < 0 && t.status !== 'Done')
  })), [tasks])

  const filteredTasks = useMemo(() => {
    const staffRoleMap = {}
    staff.forEach(s => { staffRoleMap[s.name] = s.role })
    return tasksWithOverdue.filter(t => {
      const q   = taskSearch.toLowerCase()
      const ms  = !q || (t.title||'').toLowerCase().includes(q) || (t.assigned_to||'').toLowerCase().includes(q)
      const effectiveStatus = t._overdue ? 'Overdue' : t.status
      const mst = taskStatusFilter   === 'All' || effectiveStatus === taskStatusFilter
      const mp  = taskPriorityFilter === 'All' || t.priority === taskPriorityFilter
      const msf = taskStaffFilter    === 'All' || t.assigned_to === taskStaffFilter
      const sr  = staffRoleMap[t.assigned_to] || ''
      const mr  = taskRoleFilter === 'All' || sr === taskRoleFilter || (taskRoleFilter === 'Teaching' && sr === 'Teaching + Admin')
      return ms && mst && mp && msf && mr
    })
  }, [tasksWithOverdue, taskSearch, taskStatusFilter, taskPriorityFilter, taskStaffFilter, taskRoleFilter, staff])

  const taskStats = useMemo(() => ({
    total:      tasksWithOverdue.length,
    done:       tasksWithOverdue.filter(t => t.status === 'Done').length,
    inProgress: tasksWithOverdue.filter(t => t.status === 'In Progress').length,
    pending:    tasksWithOverdue.filter(t => t.status === 'Pending').length,
    overdue:    tasksWithOverdue.filter(t => t._overdue).length,
    high:       tasksWithOverdue.filter(t => t.priority === 'High').length,
  }), [tasksWithOverdue])

  const staffTaskMap = useMemo(() => {
    const map = {}
    tasksWithOverdue.forEach(t => {
      if (!map[t.assigned_to]) map[t.assigned_to] = { total:0, done:0, overdue:0 }
      map[t.assigned_to].total++
      if (t.status === 'Done')  map[t.assigned_to].done++
      if (t._overdue)           map[t.assigned_to].overdue++
    })
    return map
  }, [tasksWithOverdue])

  const staffTaskMonitor = useMemo(() =>
    staff.map(s => {
      const tm = staffTaskMap[s.name] || { total:0, done:0, overdue:0 }
      return { ...s, taskTotal:tm.total, taskDone:tm.done, taskOverdue:tm.overdue }
    }).filter(s => s.taskTotal > 0).sort((a, b) => b.taskTotal - a.taskTotal),
  [staff, staffTaskMap])

  const activeStaffNames = useMemo(() => [...new Set(tasksWithOverdue.map(t => t.assigned_to))], [tasksWithOverdue])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTaskStatusChange = async (task, newStatus) => {
    if (taskStatusInFlight.current.has(task.id)) return
    taskStatusInFlight.current.add(task.id)
    const update = { status:newStatus, updated_at:new Date().toISOString() }
    if (newStatus === 'Done') update.completed_at = new Date().toISOString()
    const { data, error } = await supabase.from('staff_tasks').update(update).eq('id', task.id).select()
    taskStatusInFlight.current.delete(task.id)
    if (error) { showToast('❌ Update failed', '#dc2626'); return }
    setTasks(prev => prev.map(t => t.id === task.id ? (data?.[0] || t) : t))
    showToast(`✅ Marked as ${newStatus}`, '#16a34a')
    if (newStatus === 'Done') {
      EventBus.emit(GNSI_EVENTS.TASK_COMPLETED, {
        staffId: staff.find(s => s.name === task.assigned_to)?.id,
        taskId: task.id
      })
    }
  }

  const handleTaskDelete = id => {
    setConfirmModal({
      title:'Delete Task', message:'Delete this task permanently?', confirmLabel:'Delete', danger:true,
      onConfirm: async () => {
        setConfirmModal(null)
        const { error } = await supabase.from('staff_tasks').delete().eq('id', id)
        if (error) { showToast('❌ Delete failed', '#dc2626'); return }
        setTasks(prev => prev.filter(t => t.id !== id))
        showToast('🗑️ Task deleted', '#dc2626')
      }
    })
  }

  const handleScoreChange = useCallback((staffId, field, value) => {
    setDirtyIds(prev => new Set(prev).add(staffId))
    setScores(prev => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || { ...emptyScore, working_days:workingDays, staff_id:staffId, month:scoreMonth }),
        [field]: value
      }
    }))
  }, [workingDays, scoreMonth])

  const validateAddForm = () => {
    const e = {}
    if (!form.name.trim())       e.name        = 'Name is required'
    if (!form.designation.trim()) e.designation = 'Designation is required'
    if (form.phone && !validatePhone(form.phone)) e.phone = 'Enter valid 10-digit phone'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = async e => {
    e.preventDefault()
    if (!validateAddForm()) return
    setSaving(true)
    try {
      await staffDB.insert({ ...form, email:sanitizeEmail(form.email), joining_date:form.joining_date||null })
      setForm(emptyForm); setFormErrors({}); setShowForm(false); fetchStaff()
      showToast('✅ Staff added', '#16a34a')
      EventBus.emit(GNSI_EVENTS.STAFF_CREATED, {
        staffId: staff.find(s => s.name === form.name)?.id,
        name: form.name, department: form.department
      })
    } catch (err) { showToast('❌ Error: ' + err.message, '#dc2626') }
    finally { setSaving(false) }
  }

  const handleDelete = id => {
    setConfirmModal({
      title:'Delete Staff', message:'Delete this staff record permanently? This cannot be undone.', confirmLabel:'Delete', danger:true,
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await staffDB.delete(id); fetchStaff()
          showToast('🗑️ Staff deleted', '#dc2626')
          EventBus.emit(GNSI_EVENTS.STAFF_DELETED, { staffId: id })
        } catch (err) { showToast('❌ Error: ' + err.message, '#dc2626') }
      }
    })
  }

  const handleOpenSalarySetup = staffMember => {
    setSalaryTarget(staffMember)
    if (isAdminUnlocked()) { fetchSalaryData(); setShowSalaryModal(true) }
    else setShowPinModal(true)
  }

  const handleSaveScores = async () => {
    if (dirtyIds.size === 0) { showToast('No changes to save', '#d97706'); return }
    setScoreSaving(true)
    const rows = [...dirtyIds].map(id => {
      const s = staff.find(x => x.id === id); if (!s) return null
      const row = scores[id] || { ...emptyScore, working_days:workingDays }
      const computed = calcScores({ ...row, working_days:workingDays })
      return {
        staff_id:id, month:scoreMonth, working_days:workingDays,
        days_present:row.days_present||0, late_count:row.late_count||0,
        early_leave_count:row.early_leave_count||0, tasks_assigned:row.tasks_assigned||0,
        tasks_completed_on_time:row.tasks_completed_on_time||0,
        feedback_avg:row.feedback_avg||0, initiative_score:row.initiative_score||0,
        p1_attendance:computed.p1, p2_punctuality:computed.p2, p3_tasks:computed.p3,
        p4_feedback:computed.p4, p5_initiative:computed.p5,
        total_score:computed.total, level:getLevel(computed.total)?.label||'Probation'
      }
    }).filter(Boolean)
    const { error } = await supabase.from('staff_monthly_scores').upsert(rows, { onConflict:'staff_id,month' })
    if (error) showToast('❌ Error: ' + error.message, '#dc2626')
    else {
      showToast(`✅ Saved ${rows.length} score records`, '#16a34a')
      setDirtyIds(new Set())
      fetchScoresForMonth(scoreMonth)
      EventBus.emit(GNSI_EVENTS.SCORE_UPDATED, { month:scoreMonth, staffCount:rows.length })
    }
    setScoreSaving(false)
  }

  const handleConfirmScores = () => {
    setConfirmModal({
      title:'Confirm & Lock Scores', message:`Lock performance scores for ${formatMonth(scoreMonth)}? This cannot be reversed.`, confirmLabel:'Confirm & Lock', danger:false,
      onConfirm: async () => {
        setConfirmModal(null)
        const { error } = await supabase.from('staff_monthly_scores')
          .update({ is_confirmed:true, confirmed_by:'Authority', confirmed_at:new Date().toISOString() })
          .eq('month', scoreMonth)
        if (error) showToast('❌ Error: ' + error.message, '#dc2626')
        else {
          showToast('✅ Scores confirmed & locked', '#16a34a')
          fetchScoresForMonth(scoreMonth)
          EventBus.emit(GNSI_EVENTS.SCORE_CONFIRMED, { month:scoreMonth, confirmedBy:currentUser?.name||'Authority' })
        }
      }
    })
  }

  // ── Filtered / Paginated Staff ─────────────────────────────────────────────

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase()
    return staff.filter(item => {
      const ms  = ['name','phone','email','department','designation','qualification','role'].some(k => (item[k]||'').toLowerCase().includes(q))
      const mst = statusFilter === 'All' || item.status === statusFilter
      const mr  = roleFilter   === 'All' || item.role   === roleFilter
      return ms && mst && mr
    })
  }, [staff, search, statusFilter, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE))
  const paginated  = filteredStaff.slice((page-1) * PAGE_SIZE, page * PAGE_SIZE)

  const leaderboard = useMemo(() =>
    staff.map(s => {
      const sc    = scores[s.id]
      const total = sc ? calcScores(sc).total : null
      return { ...s, score:total }
    }).filter(s => s.score !== null).sort((a, b) => b.score - a.score),
  [staff, scores])

  const historyData = useMemo(() => {
    if (!historyStaffId) return []
    return allMonthlyScores
      .filter(r => r.staff_id === historyStaffId)
      .sort((a, b) => b.month.localeCompare(a.month))
  }, [allMonthlyScores, historyStaffId])

  const roleCounts = useMemo(() => {
    const c = { Teaching:0, 'Non-Teaching':0, Admin:0, 'Teaching + Admin':0 }
    staff.filter(s => s.status === 'Active').forEach(s => { if (c[s.role] !== undefined) c[s.role]++ })
    return c
  }, [staff])

  const statsCards = [
    { label:'Total Staff',  value:staff.length,                                          color:'#1e3a5f', bg:'#eff6ff', icon:'👨‍🏫' },
    { label:'Active',       value:staff.filter(s => s.status === 'Active').length,       color:'#16a34a', bg:'#dcfce7', icon:'✅' },
    { label:'Teaching',     value:roleCounts['Teaching']+roleCounts['Teaching + Admin'],  color:'#0891b2', bg:'#e0f2fe', icon:'🎓' },
    { label:'Non-Teaching', value:roleCounts['Non-Teaching'],                            color:'#6366f1', bg:'#eef2ff', icon:'🏢' },
    { label:'Admin / Dual', value:roleCounts['Admin']+roleCounts['Teaching + Admin'],    color:'#d97706', bg:'#fef3c7', icon:'⚙️' },
    { label:'Salary Set',   value:staff.filter(s => Number(s.basic_salary) > 0).length, color:'#7c3aed', bg:'#f3e8ff', icon:'💰' },
  ]

  return (
    <div style={S.page}>
      <style>{globalCSS}</style>
      {toastEl}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title} message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel} danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)}/>
      )}

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:isMobile?22:26, fontWeight:800, color:'#1e3a5f', margin:0, letterSpacing:'-.02em' }}>👨‍🏫 Staff Management</h1>
          <p style={{ color:'#64748b', fontSize:13, margin:'4px 0 0' }}>Profiles · Roles · Performance · Tasks</p>
          {isAdminUnlocked() && <span style={{ display:'inline-block', marginTop:6, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:'#dcfce7', color:'#16a34a' }}>🔓 Admin session active</span>}
          {!canEdit && <span style={{ display:'inline-block', marginTop:6, marginLeft:8, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:'#f1f5f9', color:'#64748b' }}>👁 View only</span>}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {activeTab === 'staff' && canEdit && (
            <button onClick={() => setShowForm(!showForm)} style={S.btn()}>{showForm ? '✖ Cancel' : '➕ Add Staff'}</button>
          )}
          {activeTab === 'tasks' && canEdit && (
            <button onClick={() => { setAssignPreselected(null); setShowAssignModal(true) }} style={{ ...S.btn('#6366f1'), background:'linear-gradient(135deg,#6366f1,#0ea5e9)' }}>＋ Assign Task</button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ overflowX:'auto', marginBottom:20, WebkitOverflowScrolling:'touch' }}>
        <div className="tab-bar" style={{ display:'grid', gridTemplateColumns:`repeat(${ALL_TABS.length},1fr)`, gap:6 }}>
          {ALL_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding:'10px 8px', fontWeight:700, fontSize:isMobile?11:12, cursor:'pointer',
              background:activeTab===t.key ? '#1e3a5f' : 'white',
              color:activeTab===t.key ? 'white' : '#64748b',
              border:activeTab===t.key ? '2px solid #1e3a5f' : '2px solid #e2e8f0',
              borderRadius:10, fontFamily:'inherit', minHeight:44, whiteSpace:'nowrap',
              boxShadow:activeTab===t.key ? '0 2px 8px rgba(30,58,95,.25)' : 'none',
              transition:'all .15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ══ STAFF LIST ══ */}
      {activeTab === 'staff' && (
        <>
          {/* Stat cards */}
          <div className="stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:12, marginBottom:20 }}>
            {statsCards.map(card => (
              <div key={card.label} style={{ backgroundColor:card.bg, borderRadius:12, padding:'14px 16px', boxShadow:'0 2px 8px rgba(0,0,0,.06)', borderLeft:`4px solid ${card.color}` }}>
                <div style={{ fontSize:18, marginBottom:5 }}>{card.icon}</div>
                <p style={{ fontSize:11, color:card.color, fontWeight:700, margin:0, textTransform:'uppercase', letterSpacing:.04 }}>{card.label}</p>
                <h2 style={{ fontSize:24, fontWeight:800, color:card.color, margin:'3px 0 0', fontFamily:"'JetBrains Mono',monospace" }}>{card.value}</h2>
              </div>
            ))}
          </div>

          {/* Add form */}
          {showForm && canEdit && (
            <div style={S.card}>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>Add Staff Profile</h2>
              <p style={{ fontSize:12, color:'#94a3b8', marginTop:-6, marginBottom:14 }}>💡 Salary configured separately by admin after adding.</p>
              <form onSubmit={handleAdd}>
                <div className="form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  {[
                    { key:'name',         label:'Full Name *',    required:true },
                    { key:'phone',        label:'Phone (10-digit)' },
                    { key:'email',        label:'Email',          type:'email' },
                    { key:'designation',  label:'Designation *',  required:true, placeholder:'Teacher / Accountant / Clerk' },
                    { key:'joining_date', label:'Joining Date',   type:'date' },
                    { key:'qualification',label:'Qualification',  placeholder:'B.Ed / M.A / B.Com' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={S.label}>{f.label}</label>
                      <input type={f.type||'text'} value={form[f.key]}
                        onChange={e => { setForm({...form, [f.key]:e.target.value}); setFormErrors(p => ({...p, [f.key]:''})) }}
                        required={f.required} placeholder={f.placeholder||''}
                        style={{ ...S.input, borderColor:formErrors[f.key]?'#dc2626':'#d1d5db' }}/>
                      {formErrors[f.key] && <div style={{ fontSize:11, color:'#dc2626', marginTop:3 }}>⚠ {formErrors[f.key]}</div>}
                    </div>
                  ))}
                  <div>
                    <label style={S.label}>Department</label>
                    <select value={form.department} onChange={e => setForm({...form, department:e.target.value})} required style={{ ...S.input, backgroundColor:'white' }}>
                      <option value="">Select Department</option>
                      {DEPARTMENTS_LIST.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Role</label>
                    <select value={form.role} onChange={e => setForm({...form, role:e.target.value})} style={{ ...S.input, backgroundColor:'white' }}>
                      {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Status</label>
                    <select value={form.status} onChange={e => setForm({...form, status:e.target.value})} style={{ ...S.input, backgroundColor:'white' }}>
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={saving} style={{ ...S.btn('#1e3a5f', saving), marginTop:16 }}>
                  {saving ? '⏳ Saving…' : '✅ Save Staff'}
                </button>
              </form>
            </div>
          )}

          {/* Filters */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12 }}>
            <input placeholder="🔍 Search name, phone, role…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ ...S.input, flex:'1 1 180px', minWidth:140 }}/>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} style={{ ...S.input, width:'auto', flex:'0 1 110px', backgroundColor:'white' }}>
              <option value="All">All Status</option><option>Active</option><option>Inactive</option>
            </select>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }} style={{ ...S.input, width:'auto', flex:'0 1 130px', backgroundColor:'white' }}>
              <option value="All">All Roles</option>
              {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ fontSize:12, color:'#64748b', marginBottom:10 }}>
            Showing {filteredStaff.length} of {staff.length} staff · Page {page}/{totalPages}
          </div>

          {/* Staff cards grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap:20 }}>
            {paginated.map(item => {
              const sc         = scores[item.id]
              const computed   = sc ? calcScores(sc) : null
              const totalScore = computed ? computed.total : null
              const gross      = (Number(item.basic_salary)||0) + (Number(item.seniority_allowance)||0) + (Number(item.loyalty_bonus)||0) + (Number(item.role_bonus)||0) + (Number(item.hra)||0)
              const tm         = staffTaskMap[item.name] || { total:0, done:0, overdue:0 }
              const initials   = item.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '??'
              const hue        = (item.name?.charCodeAt(0) || 0) % 360
              return (
                <div key={item.id} style={{
                  background:'white', borderRadius:16, padding:20,
                  boxShadow:'0 2px 12px rgba(0,0,0,.06)', border:'1px solid #f1f5f9',
                  transition:'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  position:'relative', overflow:'hidden',
                  display:'flex', flexDirection:'column', gap:14, cursor:'pointer'
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow='0 12px 40px rgba(0,0,0,.12)'; e.currentTarget.style.transform='translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,.06)'; e.currentTarget.style.transform='translateY(0)' }}
                >
                  {/* Status bar */}
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:item.status==='Active'?'linear-gradient(90deg,#16a34a,#22c55e)':'linear-gradient(90deg,#dc2626,#f87171)', borderRadius:'16px 16px 0 0' }}/>

                  {/* Avatar + Name + Score ring */}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginTop:2 }}>
                    <div style={{ width:52, height:52, borderRadius:'50%', background:`linear-gradient(135deg,hsl(${hue},70%,55%),hsl(${hue+40},70%,45%))`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:16, flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,.12)' }}>{initials}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:15, color:'#1e293b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{item.designation}</div>
                      <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                        <RoleBadge role={item.role}/>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:600, backgroundColor:item.status==='Active'?'#dcfce7':'#fee2e2', color:item.status==='Active'?'#16a34a':'#dc2626' }}>
                          {item.status==='Active'?'●':'○'} {item.status}
                        </span>
                      </div>
                    </div>
                    {/* Score ring */}
                    {totalScore !== null ? (() => {
                      const lvl = getLevel(totalScore)
                      const size = 56, pct = Math.min(100, totalScore)
                      const circumference = 2 * Math.PI * ((size-8)/2)
                      const dashOffset    = circumference - (pct/100) * circumference
                      return (
                        <div style={{ width:size, height:size, position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <svg width={size} height={size} style={{ position:'absolute', transform:'rotate(-90deg)' }}>
                            <circle cx={size/2} cy={size/2} r={(size-8)/2} fill="none" stroke="#e2e8f0" strokeWidth="4"/>
                            <circle cx={size/2} cy={size/2} r={(size-8)/2} fill="none" stroke={lvl.color} strokeWidth="4"
                              strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
                              style={{ transition:'stroke-dashoffset 0.6s ease' }}/>
                          </svg>
                          <div style={{ textAlign:'center', zIndex:1 }}>
                            <div style={{ fontSize:14, fontWeight:800, color:'#1e293b', fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{totalScore}</div>
                            <div style={{ fontSize:9, color:'#94a3b8', fontWeight:600 }}>{lvl.emoji}</div>
                          </div>
                        </div>
                      )
                    })() : (
                      <div style={{ width:56, height:56, borderRadius:'50%', border:'3px dashed #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:10, fontWeight:600 }}>N/A</div>
                    )}
                  </div>

                  {/* Info grid */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12 }}>
                    {[['Department',item.department],['Phone',item.phone],['Joining',item.joining_date],['Qualification',item.qualification]].map(([lbl,val]) => (
                      <div key={lbl}>
                        <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 }}>{lbl}</div>
                        <div style={{ fontSize:12, color:'#374151', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{val||'—'}</div>
                      </div>
                    ))}
                  </div>

                  {/* Salary + Tasks */}
                  <div style={{ display:'flex', gap:10, alignItems:'stretch', flexWrap:'wrap' }}>
                    {canEdit && (
                      <div style={{ flex:1, minWidth:120, background:gross>0?'#eff6ff':'#fef2f2', borderRadius:10, padding:'10px 12px', border:`1.5px solid ${gross>0?'#bfdbfe':'#fecaca'}` }}>
                        <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Gross Salary</div>
                        {gross > 0
                          ? <div style={{ fontSize:16, fontWeight:800, color:'#0C447C', fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>{fmt(gross)}</div>
                          : <div style={{ fontSize:12, fontWeight:600, color:'#dc2626', marginTop:2 }}>⚠ Not Set</div>}
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:120, background:'#f8fafc', borderRadius:10, padding:'10px 12px', border:'1.5px solid #e2e8f0' }}>
                      {tm.total > 0 ? (
                        <>
                          <MiniBar done={tm.done} total={tm.total} overdue={tm.overdue}/>
                          <button onClick={() => { setTaskStaffFilter(item.name); setActiveTab('tasks') }}
                            style={{ marginTop:6, padding:'4px 10px', borderRadius:6, border:'none', background:'#6366f1', color:'white', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                            View Tasks
                          </button>
                        </>
                      ) : (
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:11, color:'#94a3b8' }}>No tasks</span>
                          {canEdit && (
                            <button onClick={() => { setAssignPreselected(item); setShowAssignModal(true) }}
                              style={{ padding:'4px 10px', borderRadius:6, border:'none', background:'#0ea5e9', color:'white', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                              + Assign
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Level badge */}
                  {totalScore !== null && (
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <LevelBadge score={totalScore}/>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', borderTop:'1px solid #f1f5f9', paddingTop:12 }}>
                    {canEdit && (
                      <>
                        <button onClick={() => setEditingStaff(item)} style={{ flex:1, minWidth:60, padding:'8px 10px', borderRadius:8, border:'none', background:'#0891b211', color:'#0891b2', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:4, minHeight:36 }}
                          onMouseEnter={e => { e.currentTarget.style.background='#0891b2'; e.currentTarget.style.color='white' }}
                          onMouseLeave={e => { e.currentTarget.style.background='#0891b211'; e.currentTarget.style.color='#0891b2' }}>✏️ Edit</button>
                        <button onClick={() => handleOpenSalarySetup(item)} style={{ flex:1, minWidth:60, padding:'8px 10px', borderRadius:8, border:'none', background:`${gross>0?'#0C447C':'#dc2626'}11`, color:gross>0?'#0C447C':'#dc2626', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:4, minHeight:36 }}
                          onMouseEnter={e => { e.currentTarget.style.background=gross>0?'#0C447C':'#dc2626'; e.currentTarget.style.color='white' }}
                          onMouseLeave={e => { e.currentTarget.style.background=`${gross>0?'#0C447C':'#dc2626'}11`; e.currentTarget.style.color=gross>0?'#0C447C':'#dc2626' }}>🔐 Salary</button>
                        <button onClick={() => handleDelete(item.id)} style={{ flex:1, minWidth:60, padding:'8px 10px', borderRadius:8, border:'none', background:'#dc262611', color:'#dc2626', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:4, minHeight:36 }}
                          onMouseEnter={e => { e.currentTarget.style.background='#dc2626'; e.currentTarget.style.color='white' }}
                          onMouseLeave={e => { e.currentTarget.style.background='#dc262611'; e.currentTarget.style.color='#dc2626' }}>🗑 Delete</button>
                        <button onClick={() => setEnrollFaceTarget(item)} style={{ flex:1, minWidth:60, padding:'8px 10px', borderRadius:8, border:'none', background: faceEnrolledIds.has(item.id) ? '#16a34a11' : '#C9A24B22', color: faceEnrolledIds.has(item.id) ? '#16a34a' : '#8a6d1f', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:4, minHeight:36 }}
                          onMouseEnter={e => { e.currentTarget.style.background = faceEnrolledIds.has(item.id) ? '#16a34a' : '#C9A24B'; e.currentTarget.style.color='white' }}
                          onMouseLeave={e => { e.currentTarget.style.background = faceEnrolledIds.has(item.id) ? '#16a34a11' : '#C9A24B22'; e.currentTarget.style.color = faceEnrolledIds.has(item.id) ? '#16a34a' : '#8a6d1f' }}>
                          {faceEnrolledIds.has(item.id) ? '🧑‍💼 Face ✓' : '🧑‍💼 Enroll Face'}
                        </button>
                      </>
                    )}
                    {totalScore !== null && (
                      <button onClick={() => setSelectedScorecard({ record:sc, staffName:item.name })} style={{ flex:1, minWidth:60, padding:'8px 10px', borderRadius:8, border:'none', background:'#7c3aed11', color:'#7c3aed', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:4, minHeight:36 }}
                        onMouseEnter={e => { e.currentTarget.style.background='#7c3aed'; e.currentTarget.style.color='white' }}
                        onMouseLeave={e => { e.currentTarget.style.background='#7c3aed11'; e.currentTarget.style.color='#7c3aed' }}>📊 Score</button>
                    )}
                  </div>
                </div>
              )
            })}

            {paginated.length === 0 && (
              <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:64, color:'#94a3b8', background:'white', borderRadius:16, boxShadow:'0 2px 12px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>👥</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#64748b' }}>No staff records found</div>
                <div style={{ fontSize:13, marginTop:4 }}>Try adjusting your search or filters</div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:14, flexWrap:'wrap' }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} style={{ ...S.btnSm('#64748b'), opacity:page===1?.4:1 }}>←</button>
              {Array.from({ length:Math.min(5, totalPages) }, (_, i) => {
                const p = totalPages <= 5 ? i+1 : Math.max(1, Math.min(page-2, totalPages-4)) + i
                return <button key={p} onClick={() => setPage(p)} style={{ ...S.btnSm(page===p?'#1e3a5f':'#e2e8f0'), color:page===p?'white':'#374151', minWidth:36 }}>{p}</button>
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} style={{ ...S.btnSm('#64748b'), opacity:page===totalPages?.4:1 }}>→</button>
            </div>
          )}

          <div style={{ marginTop:12, padding:'8px 14px', background:isAdminUnlocked()?'#dcfce7':'#f1f5f9', borderRadius:8, fontSize:12, color:isAdminUnlocked()?'#16a34a':'#94a3b8', fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}>
            {canEdit
              ? isAdminUnlocked() ? '🔓 Admin session active — salary edits unlocked (15 min)' : '🔒 Salary setup requires admin PIN'
              : '👁 You have read-only access to staff records'}
          </div>
        </>
      )}

      {/* ══ TASK MONITOR ══ */}
      {activeTab === 'tasks' && (
        <>
          {/* Task stat cards */}
          <div className="task-grid" style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Total',       value:taskStats.total,      accent:'#6366f1', icon:'📋' },
              { label:'Done',        value:taskStats.done,       accent:'#22c55e', icon:'✅' },
              { label:'In Progress', value:taskStats.inProgress, accent:'#0ea5e9', icon:'🔄' },
              { label:'Pending',     value:taskStats.pending,    accent:'#f59e0b', icon:'⏳' },
              { label:'Overdue',     value:taskStats.overdue,    accent:'#ef4444', icon:'🚨' },
              { label:'High Pri.',   value:taskStats.high,       accent:'#f97316', icon:'🔴' },
            ].map(({ label, value, accent, icon }) => (
              <div key={label} style={{ background:'white', borderRadius:12, padding:14, boxShadow:'0 1px 3px rgba(0,0,0,.07)', borderLeft:`4px solid ${accent}` }}>
                <div style={{ fontSize:18, marginBottom:3 }}>{icon}</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#0f172a', lineHeight:1, fontFamily:"'JetBrains Mono',monospace" }}>{value}</div>
                <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Staff task overview */}
          {staffTaskMonitor.length > 0 && (
            <div style={{ ...S.card, marginBottom:16 }}>
              <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#1e3a5f' }}>👥 Staff Task Overview</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
                {staffTaskMonitor.map(s => {
                  const rate  = s.taskTotal > 0 ? Math.round((s.taskDone / s.taskTotal) * 100) : 0
                  const color = s.taskOverdue > 0 ? '#ef4444' : rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#6366f1'
                  return (
                    <div key={s.id} style={{ background:'#f8fafc', borderRadius:10, padding:12, border:`1px solid ${color}33`, cursor:'pointer' }} onClick={() => setTaskStaffFilter(s.name)}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:7 }}>
                        <div>
                          <div style={{ fontWeight:700, color:'#1e293b', fontSize:13 }}>{s.name}</div>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{s.designation}</div>
                          <RoleBadge role={s.role}/>
                        </div>
                        <span style={{ fontSize:18, fontWeight:800, color, fontFamily:"'JetBrains Mono',monospace" }}>{rate}%</span>
                      </div>
                      <MiniBar done={s.taskDone} total={s.taskTotal} overdue={s.taskOverdue}/>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Task filters */}
          <div style={{ ...S.card, padding:'14px 16px', marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
              {[
                { label:'🔍 Search',    el:<input style={S.input} value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Title or staff…"/> },
                { label:'Status',       el:<select style={{ ...S.input, backgroundColor:'white' }} value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)}><option value="All">All</option>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select> },
                { label:'Priority',     el:<select style={{ ...S.input, backgroundColor:'white' }} value={taskPriorityFilter} onChange={e => setTaskPriorityFilter(e.target.value)}><option value="All">All</option>{TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select> },
                { label:'Role',         el:<select style={{ ...S.input, backgroundColor:'white' }} value={taskRoleFilter} onChange={e => setTaskRoleFilter(e.target.value)}><option value="All">All Roles</option>{ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}</select> },
                { label:'Staff Member', el:<select style={{ ...S.input, backgroundColor:'white' }} value={taskStaffFilter} onChange={e => setTaskStaffFilter(e.target.value)}><option value="All">All Staff</option>{activeStaffNames.map(n => <option key={n}>{n}</option>)}</select> },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ ...S.label, fontSize:10, color:'#94a3b8' }}>{f.label}</label>
                  {f.el}
                </div>
              ))}
              {taskStaffFilter !== 'All' && (
                <div style={{ display:'flex', alignItems:'flex-end' }}>
                  <button onClick={() => setTaskStaffFilter('All')} style={{ ...S.btn('#64748b'), width:'100%', padding:10 }}>✕ Clear</button>
                </div>
              )}
            </div>
          </div>

          {/* Tasks table */}
          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:800, color:'#0f172a' }}>
                Task Assignments {taskStaffFilter !== 'All' && <span style={{ fontWeight:400, color:'#6366f1' }}>— {taskStaffFilter}</span>}
              </h3>
              <span style={{ fontSize:12, color:'#94a3b8' }}>{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
            </div>
            {tasksLoading ? (
              <div style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>⏳ Loading tasks…</div>
            ) : (
              <div className="table-wrap">
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:700 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {['Task','Assigned To','Role','Course','Priority','Status','Due','Actions'].map(h => (
                        <th key={h} style={{ ...TH, fontSize:12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => {
                      const diff         = daysDiff(task.due_date)
                      const isOverdue    = task._overdue
                      const sm           = STATUS_META[isOverdue ? 'Overdue' : task.status] || STATUS_META.Pending
                      const pm           = PRIORITY_META[task.priority] || PRIORITY_META.Medium
                      const assignedStaff = staff.find(s => s.name === task.assigned_to)
                      return (
                        <tr key={task.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={TD}>
                            <div style={{ fontWeight:700, color:'#1e293b', fontSize:13 }}>{task.title}</div>
                            <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{task.department || 'General'}</div>
                          </td>
                          <td style={TD}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#0ea5e9)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:9, fontWeight:700, flexShrink:0 }}>
                                {task.assigned_to?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                              </div>
                              <span style={{ fontSize:13, fontWeight:500, color:'#334155' }}>{task.assigned_to}</span>
                            </div>
                          </td>
                          <td style={TD}><RoleBadge role={assignedStaff?.role}/></td>
                          <td style={{ ...TD, fontSize:12, color:'#64748b' }}>
                            {task.course
                              ? <span style={{ padding:'2px 8px', borderRadius:6, background:'#eff6ff', color:'#1e3a5f', fontWeight:600, fontSize:11 }}>{task.course}{task.subtype ? ` / ${task.subtype}` : ''}</span>
                              : <span style={{ color:'#e2e8f0' }}>—</span>}
                          </td>
                          <td style={TD}><TaskBadge value={task.priority} type="priority"/></td>
                          <td style={TD}><TaskBadge value={isOverdue ? 'Overdue' : task.status} type="status"/></td>
                          <td style={TD}>
                            {task.due_date ? (
                              <div>
                                <div style={{ fontSize:12, color:isOverdue?'#ef4444':'#334155', fontWeight:isOverdue?700:400 }}>{fmtDate(task.due_date)}</div>
                                {diff !== null && task.status !== 'Done' && (
                                  <div style={{ fontSize:10, color:isOverdue?'#ef4444':diff<=2?'#f59e0b':'#94a3b8' }}>
                                    {isOverdue ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today!' : `${diff}d left`}
                                  </div>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                          <td style={TD}>
                            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                              <button onClick={() => setDetailTask(task)} style={S.btnSm('#6366f1')}>View</button>
                              {task.status !== 'Done' && (
                                <button onClick={() => handleTaskStatusChange(task, task.status==='Pending'?'In Progress':'Done')} style={S.btnSm(task.status==='Pending'?'#0ea5e9':'#16a34a')}>
                                  {task.status === 'Pending' ? 'Start' : '✅'}
                                </button>
                              )}
                              {task.status === 'Done' && (
                                <button onClick={() => handleTaskStatusChange(task, 'Pending')} style={S.btnSm('#64748b')}>↩</button>
                              )}
                              {canEdit && <button onClick={() => handleTaskDelete(task.id)} style={S.btnSm('#ef4444')}>✕</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredTasks.length === 0 && (
                      <tr><td colSpan={8} style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>
                        {tasksWithOverdue.length === 0 ? 'No tasks yet.' : 'No tasks match filters.'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ SCORING — FULL AUTO-MARK ══ */}
      {activeTab === 'scoring' && (
        <div style={S.card}>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:18 }}>
            <div>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#1e3a5f', margin:0 }}>📊 Monthly Performance Scoring</h2>
              <p style={{ color:'#64748b', fontSize:12, margin:'4px 0 0' }}>
                ⚡ Auto-Mark calculates ALL 7 fields — attendance, tasks, feedback & initiative
              </p>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#374151' }}>Days:</label>
                <input type="number" min="1" max="31" value={workingDays}
                  onChange={e => setWorkingDays(parseInt(e.target.value)||26)}
                  style={{ width:52, padding:'7px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, textAlign:'center', fontFamily:'inherit' }}/>
              </div>
              <input type="month" value={scoreMonth} onChange={e => setScoreMonth(e.target.value)}
                style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, fontFamily:'inherit' }}/>
              <button onClick={handleAutoMark} disabled={autoMarking} style={{
                padding:'10px 18px', borderRadius:8, border:'none', fontWeight:700, fontSize:13,
                cursor:autoMarking?'not-allowed':'pointer', fontFamily:'inherit', minHeight:44,
                background:autoMarking?'#94a3b8':'linear-gradient(135deg,#0891b2,#0284c7)',
                color:'white', display:'flex', alignItems:'center', gap:6,
              }}>
                {autoMarking ? '⏳ Calculating…' : '⚡ Auto-Mark All'}
              </button>
              <button onClick={handleSaveScores} disabled={scoreSaving} style={S.btn('#16a34a', scoreSaving)}>
                {scoreSaving ? '⏳ Saving…' : `💾 Save (${dirtyIds.size})`}
              </button>
              <button onClick={handleConfirmScores} style={S.btn('#7c3aed')}>✅ Lock</button>
            </div>
          </div>

          {/* Auto-mark result banner */}
          {autoMarkResults && (
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'linear-gradient(135deg,#e0f2fe,#eff6ff)', borderRadius:10, border:'1px solid #bae6fd', marginBottom:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:20 }}>⚡</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, color:'#0891b2', fontSize:13 }}>All scores calculated automatically</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:2, display:'flex', gap:12, flexWrap:'wrap' }}>
                  <span>📍 {autoMarkResults.geoRows} geo records</span>
                  <span>✅ {autoMarkResults.taskRows} tasks</span>
                  <span>📝 {autoMarkResults.examRows} exam scores</span>
                  <strong style={{ color:'#0891b2' }}>→ {autoMarkResults.filled} staff scored</strong>
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                  You can still override any value manually before saving
                </div>
              </div>
              <button onClick={() => setAutoMarkResults(null)}
                style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
          )}

          {/* How scores are calculated */}
          <div style={{ marginBottom:14, padding:'12px 14px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#1e3a5f', marginBottom:8 }}>HOW SCORES ARE CALCULATED AUTOMATICALLY</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
              {[
                { icon:'📍', label:'Attendance /30',  color:'#0ea5e9', desc:'Days present ÷ working days × 30',          src:'GeoAttendance' },
                { icon:'⏰', label:'Punctuality /20',  color:'#10b981', desc:'Reduced by late & early leave count',        src:'GeoAttendance' },
                { icon:'✅', label:'Tasks /20',        color:'#f59e0b', desc:'On-time completions ÷ assigned × 20',        src:'staff_tasks' },
                { icon:'⭐', label:'Feedback /15',     color:'#8b5cf6', desc:'Teachers: exam avg · Others: task quality',   src:'student_scores' },
                { icon:'💡', label:'Initiative /15',   color:'#ec4899', desc:'Zero late + perfect att + early completions', src:'Auto-formula' },
              ].map(f => (
                <div key={f.label} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                  <span style={{ fontSize:15 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:f.color }}>{f.label}</div>
                    <div style={{ fontSize:10, color:'#64748b' }}>{f.desc}</div>
                    <div style={{ fontSize:9, color:'#94a3b8', fontWeight:600, marginTop:1 }}>Source: {f.src}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Score table */}
          <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:800 }}>
              <thead>
                <tr style={{ background:'#1e3a5f', color:'white' }}>
                  <th style={{ padding:'10px 14px', textAlign:'left', position:'sticky', left:0, background:'#1e3a5f', zIndex:2, minWidth:160, fontSize:11 }}>Staff</th>
                  {[
                    { label:'Present',    sub:`/${workingDays}`, color:'#7dd3fc', tip:'GeoAttendance ⚡' },
                    { label:'Late',       sub:'',                color:'#fda4af', tip:'GeoAttendance ⚡' },
                    { label:'Early Out',  sub:'',                color:'#fda4af', tip:'GeoAttendance ⚡' },
                    { label:'Tasks',      sub:'',                color:'#fcd34d', tip:'staff_tasks ⚡' },
                    { label:'Done✓',      sub:'',                color:'#6ee7b7', tip:'staff_tasks ⚡' },
                    { label:'Feedback',   sub:'/5',              color:'#c4b5fd', tip:'exam avg / task quality ⚡' },
                    { label:'Initiative', sub:'/5',              color:'#f9a8d4', tip:'attendance + early tasks ⚡' },
                  ].map(h => (
                    <th key={h.label} title={h.tip} style={{ padding:'10px 8px', textAlign:'center', color:h.color, fontSize:11, fontWeight:700, cursor:'help', whiteSpace:'nowrap' }}>
                      {h.label}{h.sub && <span style={{ opacity:.6, fontWeight:400, fontSize:10 }}>{h.sub}</span>}
                      <div style={{ fontSize:8, opacity:.5, fontWeight:400 }}>⚡ auto</div>
                    </th>
                  ))}
                  <th style={{ padding:'10px 14px', textAlign:'center', color:'#fde68a', fontSize:11, fontWeight:700 }}>Score / Level</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <ScoreEntryRow key={s.id} staff={s}
                    score={scores[s.id] ? { ...scores[s.id], working_days:workingDays } : { ...emptyScore, working_days:workingDays }}
                    isDirty={dirtyIds.has(s.id)}
                    onChange={handleScoreChange}/>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unsaved warning */}
          {dirtyIds.size > 0 && (
            <div style={{ marginTop:14, padding:'10px 14px', background:'#fef9c3', borderRadius:8, fontSize:12, color:'#b45309', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
              ⚠️ {dirtyIds.size} unsaved row{dirtyIds.size > 1 ? 's' : ''} — click 💾 Save to commit
            </div>
          )}
        </div>
      )}

      {/* ══ LEADERBOARD ══ */}
      {activeTab === 'leaderboard' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:10 }}>
            <div>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#1e3a5f', margin:0 }}>🏆 Performance Leaderboard</h2>
              <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>Rankings update when scores are saved · {leaderboard.length} scored staff</p>
            </div>
            <input type="month" value={scoreMonth} onChange={e => setScoreMonth(e.target.value)}
              style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, fontFamily:'inherit' }}/>
          </div>

          {leaderboard.length === 0 ? (
            <div style={{ textAlign:'center', padding:64, color:'#94a3b8', background:'white', borderRadius:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏆</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#64748b' }}>No scores for {formatMonth(scoreMonth)}</div>
              <div style={{ fontSize:13, marginTop:4 }}>Go to 📊 Scoring → ⚡ Auto-Mark All → 💾 Save</div>
            </div>
          ) : (
            <>
              {/* Podium top 3 */}
              {leaderboard.length >= 3 && !isMobile && (
                <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-end', gap:20, marginBottom:28, padding:'20px 0' }}>
                  {[leaderboard[1], leaderboard[0], leaderboard[2]].map((s, i) => {
                    const rank   = [2,1,3][i]
                    const height = [150,200,120][i]
                    const medal  = ['🥈','🥇','🥉'][i]
                    const color  = ['#94a3b8','#f59e0b','#b45309'][i]
                    const sc     = scores[s.id]
                    const comp   = sc ? calcScores(sc) : null
                    const initials = s.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
                    return (
                      <div key={s.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, minWidth:130 }}>
                        <div style={{ fontSize:30 }}>{medal}</div>
                        <div style={{ width:52, height:52, borderRadius:'50%', background:`linear-gradient(135deg,${color},${color}88)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:17, boxShadow:`0 4px 16px ${color}55`, border:`3px solid ${color}` }}>{initials}</div>
                        <div style={{ fontWeight:800, color:'#1e293b', fontSize:13, textAlign:'center', maxWidth:120 }}>{s.name}</div>
                        <RoleBadge role={s.role}/>
                        <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"'JetBrains Mono',monospace" }}>{s.score}</div>
                        <LevelBadge score={s.score}/>
                        {comp && (
                          <div style={{ display:'flex', gap:2, alignItems:'flex-end', height:20 }}>
                            {[{v:comp.p1,m:30,c:'#0ea5e9'},{v:comp.p2,m:20,c:'#10b981'},{v:comp.p3,m:20,c:'#f59e0b'},{v:comp.p4,m:15,c:'#8b5cf6'},{v:comp.p5,m:15,c:'#ec4899'}]
                              .map((b,j) => <div key={j} style={{ width:9, borderRadius:2, height:Math.max(3, Math.round((b.v/b.m)*18)), background:b.c }}/>)}
                          </div>
                        )}
                        <div style={{ width:110, height, background:`linear-gradient(to top,${color},${color}66)`, borderRadius:'10px 10px 0 0', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:10, color:'white', fontWeight:800, fontSize:22, boxShadow:`0 -4px 20px ${color}44` }}>#{rank}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Department averages */}
              {(() => {
                const deptMap = {}
                leaderboard.forEach(s => {
                  const d = s.department || 'Other'
                  if (!deptMap[d]) deptMap[d] = { total:0, count:0, top:s }
                  deptMap[d].total += s.score; deptMap[d].count++
                })
                const depts = Object.entries(deptMap)
                  .map(([dept, v]) => ({ dept, avg:Math.round(v.total/v.count), count:v.count, top:v.top }))
                  .sort((a, b) => b.avg - a.avg)
                if (depts.length < 2) return null
                return (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#64748b', marginBottom:10 }}>📂 Department Average Scores</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:10 }}>
                      {depts.map((d, i) => {
                        const lvl = getLevel(d.avg)
                        return (
                          <div key={d.dept} style={{ background:'white', borderRadius:10, padding:'12px 14px', border:`1.5px solid ${lvl?.border||'#e2e8f0'}`, display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:32, height:32, borderRadius:8, background:lvl?.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:lvl?.color }}>
                              {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:12, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.dept}</div>
                              <div style={{ fontSize:10, color:'#94a3b8' }}>{d.count} staff · Top: {d.top.name?.split(' ')[0]}</div>
                            </div>
                            <div style={{ fontSize:18, fontWeight:800, color:lvl?.color, fontFamily:"'JetBrains Mono',monospace" }}>{d.avg}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Full rankings table */}
              <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
                <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:660 }}>
                    <thead>
                      <tr style={{ background:'#1e3a5f', color:'white' }}>
                        {['#','Staff','Role','Dept','Att','Punct','Tasks','Fdbk','Init','Total','Level'].map(h => (
                          <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((s, i) => {
                        const sc   = scores[s.id]
                        const comp = sc ? calcScores(sc) : null
                        return (
                          <tr key={s.id} style={{ borderBottom:'1px solid #f1f5f9', background:i<3?'#fffbeb':'white' }}>
                            <td style={{ padding:'10px 12px', fontWeight:800, fontSize:15, color:['#f59e0b','#94a3b8','#b45309'][i]||'#64748b' }}>
                              {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                            </td>
                            <td style={{ padding:'10px 12px' }}>
                              <div style={{ fontWeight:700, color:'#1e293b' }}>{s.name}</div>
                              <div style={{ fontSize:11, color:'#94a3b8' }}>{s.designation}</div>
                            </td>
                            <td style={{ padding:'10px 12px' }}><RoleBadge role={s.role}/></td>
                            <td style={{ padding:'10px 12px', color:'#64748b', fontSize:12 }}>{s.department||'—'}</td>
                            {comp ? (
                              <>
                                {[{v:comp.p1,c:'#0ea5e9'},{v:comp.p2,c:'#10b981'},{v:comp.p3,c:'#f59e0b'},{v:comp.p4,c:'#8b5cf6'},{v:comp.p5,c:'#ec4899'}].map((b, j) => (
                                  <td key={j} style={{ padding:'10px 12px', fontWeight:700, color:b.c, fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>{b.v}</td>
                                ))}
                                <td style={{ padding:'10px 12px', fontWeight:800, color:'#1e293b', fontSize:16, fontFamily:"'JetBrains Mono',monospace" }}>{comp.total}</td>
                              </>
                            ) : (
                              <td colSpan={6} style={{ padding:'10px 12px', color:'#94a3b8', fontSize:12 }}>No data</td>
                            )}
                            <td style={{ padding:'10px 12px' }}><LevelBadge score={s.score}/></td>
                          </tr>
                        )
                      })}
                      {leaderboard.length === 0 && (
                        <tr><td colSpan={11} style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No scores for this month yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ HISTORY ══ */}
      {activeTab === 'history' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:10 }}>
            <div>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#1e3a5f', margin:0 }}>📅 Score History & Trends</h2>
              <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>Per-staff performance over time · spot trends · identify growth</p>
            </div>
            <select value={historyStaffId} onChange={e => setHistoryStaffId(e.target.value)}
              style={{ ...S.input, width:'auto', minWidth:220, backgroundColor:'white' }}>
              <option value="">— Select Staff Member —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} · {s.designation} [{s.role}]</option>)}
            </select>
          </div>

          {!historyStaffId && (
            <div style={{ textAlign:'center', padding:64, color:'#94a3b8', background:'white', borderRadius:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#64748b' }}>Select a staff member above</div>
              <div style={{ fontSize:13, marginTop:4 }}>View monthly scores, trends and improvement stats</div>
            </div>
          )}

          {historyStaffId && historyData.length === 0 && (
            <div style={{ textAlign:'center', padding:48, color:'#94a3b8', background:'white', borderRadius:16 }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
              <div style={{ fontWeight:600 }}>No score history found</div>
              <div style={{ fontSize:12, marginTop:4 }}>Save scores in 📊 Scoring tab first</div>
            </div>
          )}

          {historyStaffId && historyData.length > 0 && (() => {
            const staffInfo  = staff.find(s => s.id === historyStaffId)
            const scores_asc = [...historyData].reverse()
            const latest     = historyData[0]
            const prev       = historyData[1]
            const best       = historyData.reduce((b, r) => r.total_score > b.total_score ? r : b, historyData[0])
            const worst      = historyData.reduce((b, r) => r.total_score < b.total_score ? r : b, historyData[0])
            const avg        = Math.round(historyData.reduce((s, r) => s + r.total_score, 0) / historyData.length * 10) / 10
            const trend      = historyData.length >= 2 ? latest.total_score - prev.total_score : null
            const improving  = scores_asc.length >= 3
              ? scores_asc.slice(-3).every((r, i, a) => i === 0 || r.total_score >= a[i-1].total_score)
              : null
            return (
              <>
                {/* Staff summary card */}
                <div style={{ background:'white', borderRadius:14, padding:20, marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
                  <div style={{ width:54, height:54, borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg,hsl(${(staffInfo?.name?.charCodeAt(0)||0)%360},70%,55%),hsl(${(staffInfo?.name?.charCodeAt(0)||0)%360+40},70%,45%))`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:19 }}>
                    {staffInfo?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontWeight:800, fontSize:16, color:'#1e293b' }}>{staffInfo?.name}</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{staffInfo?.designation} · {staffInfo?.department}</div>
                    <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                      <RoleBadge role={staffInfo?.role}/>
                      {improving !== null && (
                        <span style={{ padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:700, background:improving?'#dcfce7':'#fee2e2', color:improving?'#16a34a':'#dc2626' }}>
                          {improving ? '📈 Improving' : '📉 Declining'}
                        </span>
                      )}
                      <span style={{ fontSize:11, color:'#94a3b8' }}>{historyData.length} month{historyData.length > 1 ? 's' : ''} of data</span>
                    </div>
                  </div>
                  {/* Stat boxes */}
                  {[
                    { label:'Latest',  value:latest.total_score, color:getLevel(latest.total_score)?.color||'#1e3a5f', emoji:getLevel(latest.total_score)?.emoji },
                    { label:'Average', value:avg,                color:'#0891b2' },
                    { label:'Best',    value:best.total_score,   color:'#16a34a', sub:formatMonth(best.month).split(' ')[0] },
                    { label:'Worst',   value:worst.total_score,  color:'#dc2626', sub:formatMonth(worst.month).split(' ')[0] },
                  ].map(stat => (
                    <div key={stat.label} style={{ textAlign:'center', padding:'10px 14px', background:'#f8fafc', borderRadius:10, minWidth:68 }}>
                      <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:.5 }}>{stat.label}</div>
                      <div style={{ fontSize:21, fontWeight:800, color:stat.color, fontFamily:"'JetBrains Mono',monospace", lineHeight:1.1, marginTop:3 }}>
                        {stat.emoji && <span style={{ fontSize:13, marginRight:2 }}>{stat.emoji}</span>}{stat.value}
                      </div>
                      {stat.sub && <div style={{ fontSize:9, color:'#94a3b8', marginTop:1 }}>{stat.sub}</div>}
                    </div>
                  ))}
                  {/* Trend box */}
                  {trend !== null && (
                    <div style={{ textAlign:'center', padding:'10px 14px', borderRadius:10, minWidth:68, background:trend>0?'#dcfce7':trend<0?'#fee2e2':'#f1f5f9' }}>
                      <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:.5 }}>vs Last</div>
                      <div style={{ fontSize:21, fontWeight:800, color:trend>0?'#16a34a':trend<0?'#dc2626':'#64748b', fontFamily:"'JetBrains Mono',monospace", lineHeight:1.1, marginTop:3 }}>
                        {trend > 0 ? '+' : ''}{trend}
                      </div>
                      <div style={{ fontSize:16 }}>{trend>5?'🚀':trend>0?'📈':trend===0?'➡️':trend>-5?'📉':'⬇️'}</div>
                    </div>
                  )}
                </div>

                {/* Bar chart trend */}
                <div style={{ ...S.card, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1e3a5f', marginBottom:14 }}>📊 Monthly Score Trend</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:150, overflowX:'auto', paddingBottom:6 }}>
                    {scores_asc.map((r, i) => {
                      const lvl    = getLevel(r.total_score)
                      const height = Math.max(10, Math.round((r.total_score / 100) * 130))
                      const isLast = i === scores_asc.length - 1
                      return (
                        <div key={r.month} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flex:'0 0 auto', minWidth:54 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:lvl?.color, fontFamily:"'JetBrains Mono',monospace" }}>{r.total_score}</div>
                          <div style={{ width:'100%', height, background:isLast?lvl?.border:`${lvl?.border}77`, borderRadius:'4px 4px 0 0', border:isLast?`2px solid ${lvl?.border}`:'none', boxShadow:isLast?`0 0 12px ${lvl?.border}55`:'none', position:'relative' }}>
                            {isLast && <div style={{ position:'absolute', top:-16, left:'50%', transform:'translateX(-50%)', fontSize:8, fontWeight:700, color:lvl?.color, whiteSpace:'nowrap' }}>Latest</div>}
                          </div>
                          <div style={{ fontSize:9, color:'#94a3b8', textAlign:'center', lineHeight:1.3 }}>
                            {formatMonth(r.month).split(' ').map((w, j) => <div key={j}>{w}</div>)}
                          </div>
                          <LevelBadge score={r.total_score}/>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Component breakdown */}
                <div style={{ ...S.card, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1e3a5f', marginBottom:14 }}>🔍 Component Breakdown — {formatMonth(latest.month)}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {[
                      { label:'Attendance',     score:latest.p1_attendance,  max:30, color:'#0ea5e9', icon:'📍', src:'GeoAttendance' },
                      { label:'Punctuality',    score:latest.p2_punctuality, max:20, color:'#10b981', icon:'⏰', src:'Late / Early leave' },
                      { label:'Task Completion',score:latest.p3_tasks,       max:20, color:'#f59e0b', icon:'✅', src:'Tasks done on time' },
                      { label:'Feedback',       score:latest.p4_feedback,    max:15, color:'#8b5cf6', icon:'⭐', src:'Exam avg / task quality' },
                      { label:'Initiative',     score:latest.p5_initiative,  max:15, color:'#ec4899', icon:'💡', src:'Zero late + early completions' },
                    ].map(item => (
                      <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ fontSize:16, flexShrink:0 }}>{item.icon}</div>
                        <div style={{ width:130, flexShrink:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{item.label}</div>
                          <div style={{ fontSize:10, color:'#94a3b8' }}>{item.src}</div>
                        </div>
                        <div style={{ flex:1, height:10, background:'#e2e8f0', borderRadius:5, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(100, Math.round((item.score/item.max)*100))}%`, background:item.color, borderRadius:5, transition:'width .5s' }}/>
                        </div>
                        <span style={{ fontSize:13, fontWeight:800, color:item.color, fontFamily:"'JetBrains Mono',monospace", minWidth:48, textAlign:'right' }}>
                          {item.score}/{item.max}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* History table */}
                <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
                  <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:620 }}>
                      <thead>
                        <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                          {['Month','Att','Punct','Tasks','Fdbk','Init','Total','Level','±Change',''].map(h => (
                            <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:11, whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((r, i) => {
                          const next   = historyData[i+1]
                          const change = next ? r.total_score - next.total_score : null
                          return (
                            <tr key={r.month} style={{ borderBottom:'1px solid #f1f5f9', background:i===0?'#fffbeb':'white' }}>
                              <td style={{ padding:'10px 12px', fontWeight:700, color:'#1e293b', whiteSpace:'nowrap' }}>
                                {i === 0 && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:99, background:'#fef3c7', color:'#b45309', fontWeight:700, marginRight:5 }}>LATEST</span>}
                                {formatMonth(r.month)}
                                {r.is_confirmed && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:99, background:'#dcfce7', color:'#16a34a', fontWeight:700, marginLeft:4 }}>🔒</span>}
                              </td>
                              <td style={{ padding:'10px 12px', color:'#0ea5e9', fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{r.p1_attendance}</td>
                              <td style={{ padding:'10px 12px', color:'#10b981', fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{r.p2_punctuality}</td>
                              <td style={{ padding:'10px 12px', color:'#f59e0b', fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{r.p3_tasks}</td>
                              <td style={{ padding:'10px 12px', color:'#8b5cf6', fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{r.p4_feedback}</td>
                              <td style={{ padding:'10px 12px', color:'#ec4899', fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{r.p5_initiative}</td>
                              <td style={{ padding:'10px 12px', fontWeight:800, color:'#1e293b', fontSize:16, fontFamily:"'JetBrains Mono',monospace" }}>{r.total_score}</td>
                              <td style={{ padding:'10px 12px' }}><LevelBadge score={r.total_score}/></td>
                              <td style={{ padding:'10px 12px' }}>
                                {change !== null ? (
                                  <span style={{ fontWeight:700, fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:change>0?'#16a34a':change<0?'#dc2626':'#94a3b8' }}>
                                    {change > 0 ? '▲' : change < 0 ? '▼' : '—'}{change !== 0 ? Math.abs(change) : ''}
                                  </span>
                                ) : <span style={{ color:'#e2e8f0' }}>—</span>}
                              </td>
                              <td style={{ padding:'10px 12px' }}>
                                <button onClick={() => setSelectedScorecard({ record:r, staffName:staffInfo?.name })}
                                  style={{ padding:'5px 11px', borderRadius:6, border:'none', background:'#7c3aed', color:'white', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                                  📊 View
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          })()}
        </>
      )}

      {/* ══ GEO ATTENDANCE ══ */}
      {activeTab === 'geo' && (
        <>
          {isAdmin && (
            <div style={{ ...S.card }}>
              <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:800, color:'#1e3a5f' }}>🧑‍💼 Pending Face Enrollments</h3>
              <FaceApprovalQueue currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />
            </div>
          )}
          {!canEdit && (
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>📍</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#1e3a5f' }}>Self Attendance</div>
                <div style={{ fontSize:12, color:'#64748b' }}>Mark your own attendance using your device location.</div>
              </div>
            </div>
          )}
          <GeoAttendance
            currentStaff={loggedInStaff}
            isAdmin={isAdmin}
            allStaff={isAdmin ? staff : [loggedInStaff].filter(Boolean)}
          />
        </>
      )}

      {/* ── Modals ── */}
      {editingStaff && canEdit && (
        <EditStaffModal staffMember={editingStaff} onClose={() => setEditingStaff(null)}
          onSaved={() => { fetchStaff(); setEditingStaff(null) }} showToast={showToast}/>
      )}
      {enrollFaceTarget && canEdit && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:9997, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ position:'relative' }}>
            <button onClick={() => setEnrollFaceTarget(null)} style={{ position:'absolute', top:-14, right:-14, width:32, height:32, borderRadius:'50%', border:'none', background:'white', color:'#374151', fontWeight:700, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,.2)', zIndex:1 }}>✕</button>
            <FaceEnroll
              staffMember={enrollFaceTarget}
              mode="admin"
              currentAdminId={currentUser?.staff_profile_id || null}
              onDone={() => { setEnrollFaceTarget(null); fetchFaceEnrolledIds() }}
              showToast={showToast}
            />
          </div>
        </div>
      )}
      {showPinModal && (
        <AdminPinModal
          onSuccess={() => { setShowPinModal(false); fetchSalaryData(); setShowSalaryModal(true) }}
          onClose={() => { setShowPinModal(false); setSalaryTarget(null) }}/>
      )}
      {showSalaryModal && salaryTarget && canEdit && (
        <SalarySetupModal staffMember={salaryTarget}
          onClose={() => { setShowSalaryModal(false); setSalaryTarget(null) }}
          onSaved={() => { fetchStaff(); fetchSalaryData() }} showToast={showToast}/>
      )}
      {selectedScorecard && (
        <ScorecardModal record={selectedScorecard.record} staffName={selectedScorecard.staffName}
          onClose={() => setSelectedScorecard(null)}/>
      )}
      {showAssignModal && canEdit && (
        <AssignTaskModal staffList={staff} preselectedStaff={assignPreselected}
          onClose={() => { setShowAssignModal(false); setAssignPreselected(null) }}
          onSaved={task => { if (task) setTasks(prev => [task, ...prev]); showToast('✅ Task assigned!', '#16a34a') }}/>
      )}
      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)}
          onStatusChange={handleTaskStatusChange}/>
      )}

    </div>
  )
}
export default Staff