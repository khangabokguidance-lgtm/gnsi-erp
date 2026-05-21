import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useCourseData, CoursePicker } from './Courses'
import GeoAttendance from './GeoAttendance'
import { staffDB, useStaffDB } from './staffDB'

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_PIN = '1950'

const LEVELS = [
  { min: 90, max: 100, label: 'Elite',       emoji: '💎', color: '#7c3aed', bg: '#f3e8ff', border: '#7c3aed' },
  { min: 75, max: 89,  label: 'Outstanding', emoji: '🥇', color: '#b45309', bg: '#fef3c7', border: '#f59e0b' },
  { min: 60, max: 74,  label: 'Excellent',   emoji: '🥈', color: '#374151', bg: '#f1f5f9', border: '#94a3b8' },
  { min: 45, max: 59,  label: 'Good',        emoji: '🥉', color: '#92400e', bg: '#fde68a', border: '#d97706' },
  { min: 0,  max: 44,  label: 'Probation',   emoji: '🔰', color: '#dc2626', bg: '#fee2e2', border: '#f87171' },
]

const TASK_PRIORITIES  = ['High', 'Medium', 'Low']
const TASK_STATUSES    = ['Pending', 'In Progress', 'Done', 'Overdue']
const DEPARTMENTS_LIST = ['Administration','Academic','Accounts','Hostel','Reception','Transport','Maintenance']
const ROLE_OPTIONS     = ['Teaching', 'Non-Teaching', 'Admin', 'Teaching + Admin']

const ROLE_META = {
  'Teaching':          { color: '#0891b2', bg: '#e0f2fe', label: '🎓 Teaching' },
  'Non-Teaching':      { color: '#6366f1', bg: '#eef2ff', label: '🏢 Non-Teaching' },
  'Admin':             { color: '#7c3aed', bg: '#f3e8ff', label: '⚙️ Admin' },
  'Teaching + Admin':  { color: '#d97706', bg: '#fef3c7', label: '🎓⚙️ Teaching + Admin' },
}

const PRIORITY_META = {
  High:   { color: '#ef4444', bg: '#fef2f2', icon: '🔴' },
  Medium: { color: '#f59e0b', bg: '#fffbeb', icon: '🟡' },
  Low:    { color: '#22c55e', bg: '#f0fdf4', icon: '🟢' },
}
const STATUS_META = {
  Pending:       { color: '#6366f1', bg: '#eef2ff', icon: '⏳' },
  'In Progress': { color: '#0ea5e9', bg: '#f0f9ff', icon: '🔄' },
  Done:          { color: '#16a34a', bg: '#dcfce7', icon: '✅' },
  Overdue:       { color: '#dc2626', bg: '#fee2e2', icon: '🚨' },
}

const getLevel   = score => { if (score === null || score === undefined) return null; return LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[4] }
const calcScores = row => {
  const p1 = row.working_days > 0 ? Math.min(30, (row.days_present / row.working_days) * 30) : 0
  const p2 = Math.max(0, 20 - (row.late_count || 0) * 1 - (row.early_leave_count || 0) * 0.5)
  const p3 = row.tasks_assigned > 0 ? Math.min(20, (row.tasks_completed_on_time / row.tasks_assigned) * 20) : 0
  const p4 = row.feedback_avg > 0 ? Math.min(15, (row.feedback_avg / 5) * 15) : 0
  const p5 = row.initiative_score > 0 ? Math.min(15, (row.initiative_score / 5) * 15) : 0
  const total = parseFloat((p1 + p2 + p3 + p4 + p5).toFixed(1))
  return { p1: parseFloat(p1.toFixed(1)), p2: parseFloat(p2.toFixed(1)), p3: parseFloat(p3.toFixed(1)), p4: parseFloat(p4.toFixed(1)), p5: parseFloat(p5.toFixed(1)), total }
}

const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const formatMonth  = m => { if (!m) return ''; const [y,mo] = m.split('-'); return new Date(y, parseInt(mo)-1).toLocaleString('default', { month:'long', year:'numeric' }) }
const fmt          = n => `₹${Math.round(Number(n)||0).toLocaleString('en-IN')}`
const fmtDate      = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const daysDiff     = d => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000) }

const emptyForm  = { name:'', phone:'', email:'', department:'', designation:'', role:'Teaching', joining_date:'', qualification:'', status:'Active' }
const emptyScore = { working_days:26, days_present:0, late_count:0, early_leave_count:0, tasks_assigned:0, tasks_completed_on_time:0, feedback_avg:0, initiative_score:0 }

// ─── Shared Styles ────────────────────────────────────────────────────────────
const S = {
  page:  { padding:'24px', fontFamily:"'Segoe UI', sans-serif", background:'#f8fafc', minHeight:'100vh' },
  card:  { background:'white', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', padding:'24px', marginBottom:'20px' },
  btn:   (color='#1e3a5f', disabled=false) => ({ backgroundColor: disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'600', cursor: disabled?'not-allowed':'pointer', fontSize:'14px', fontFamily:'inherit' }),
  btnSm: (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:'6px', padding:'6px 12px', fontWeight:'600', cursor:'pointer', fontSize:'12px', fontFamily:'inherit' }),
  input: { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box', fontFamily:'inherit' },
  label: { display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' },
  tab:   active => ({ padding:'10px 20px', fontWeight:'600', fontSize:'14px', cursor:'pointer', background:'none', border:'none', borderBottomWidth:'3px', borderBottomStyle:'solid', borderBottomColor: active?'#1e3a5f':'transparent', color: active?'#1e3a5f':'#64748b', fontFamily:'inherit' }),
}
const th = { padding:'12px 16px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'13px' }
const td = { padding:'12px 16px', verticalAlign:'middle', color:'#334155' }

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  if (!role) return null
  const m = ROLE_META[role] || { color:'#64748b', bg:'#f1f5f9', label: role }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:m.bg, color:m.color, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  )
}

// ─── Level Badge ──────────────────────────────────────────────────────────────
function LevelBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ color:'#94a3b8', fontSize:'12px' }}>—</span>
  const lvl = getLevel(score)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:99, fontSize:12, fontWeight:700, background:lvl.bg, color:lvl.color, border:`1px solid ${lvl.border}` }}>
      {lvl.emoji} {lvl.label}
    </span>
  )
}

function ScoreBar({ value, max, color='#1e3a5f' }) {
  const pct = Math.min(100, (value/max)*100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:8, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:4, transition:'width 0.4s' }} />
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, minWidth:36, textAlign:'right' }}>{value}/{max}</span>
    </div>
  )
}

function TaskBadge({ value, type }) {
  const meta = type==='priority' ? PRIORITY_META[value] : STATUS_META[value]
  if (!meta) return <span>{value}</span>
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:700, background:meta.bg, color:meta.color, whiteSpace:'nowrap' }}>
      {meta.icon} {value}
    </span>
  )
}

function MiniBar({ done, total, overdue }) {
  const pct   = total>0 ? Math.round((done/total)*100) : 0
  const color = overdue>0?'#ef4444':pct>=80?'#22c55e':pct>=50?'#f59e0b':'#6366f1'
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:11, color:'#64748b' }}>{done}/{total} done</span>
        <span style={{ fontSize:11, fontWeight:700, color }}>{pct}%</span>
      </div>
      <div style={{ height:5, borderRadius:99, background:'#e2e8f0', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, borderRadius:99, background:color, transition:'width 0.5s' }} />
      </div>
      {overdue>0 && <div style={{ fontSize:10, color:'#ef4444', fontWeight:700, marginTop:2 }}>🚨 {overdue} overdue</div>}
    </div>
  )
}

// ─── Admin PIN Modal ──────────────────────────────────────────────────────────
function AdminPinModal({ onSuccess, onClose }) {
  const [pin, setPin]     = useState('')
  const [error, setError] = useState('')
  const verify = () => { if (pin===ADMIN_PIN) onSuccess(); else { setError('Incorrect PIN.'); setPin('') } }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:16, padding:36, width:'100%', maxWidth:360, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
        <h2 style={{ fontSize:18, fontWeight:700, color:'#1e3a5f', margin:'0 0 6px' }}>Admin Access Required</h2>
        <p style={{ fontSize:13, color:'#64748b', margin:'0 0 24px' }}>Salary configuration is restricted to administrators only.</p>
        <input type="password" placeholder="Enter Admin PIN" value={pin}
          onChange={e => { setPin(e.target.value); setError('') }}
          onKeyDown={e => e.key==='Enter' && verify()}
          style={{ ...S.input, textAlign:'center', fontSize:20, letterSpacing:8, marginBottom:12 }} autoFocus />
        {error && <div style={{ background:'#fee2e2', color:'#dc2626', borderRadius:8, padding:'8px 12px', fontSize:13, fontWeight:600, marginBottom:12 }}>{error}</div>}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ ...S.btn('#64748b'), flex:1 }}>Cancel</button>
          <button onClick={verify}  style={{ ...S.btn('#1e3a5f'), flex:1 }}>🔓 Verify</button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────
function EditStaffModal({ staffMember, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:staffMember.name||'', phone:staffMember.phone||'', email:staffMember.email||'',
    department:staffMember.department||'', designation:staffMember.designation||'',
    role:staffMember.role||'Teaching', joining_date:staffMember.joining_date||'',
    qualification:staffMember.qualification||'', status:staffMember.status||'Active',
  })
  const [saving, setSaving] = useState(false)
  const handleSave = async e => {
  e.preventDefault(); setSaving(true)
  try {
    await staffDB.update(staffMember.id, { ...form, joining_date:form.joining_date||null })
    onSaved(); onClose()
  } catch (err) { alert('Error: ' + err.message) }
  finally { setSaving(false) }
}
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:560, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#254e91)', padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, color:'#93c5fd', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>✏️ Edit Staff Profile</div>
            <div style={{ fontSize:18, fontWeight:700, color:'white', marginTop:4 }}>{staffMember.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ padding:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[
              { key:'name', label:'Full Name', required:true },
              { key:'phone', label:'Phone' },
              { key:'email', label:'Email', type:'email' },
              { key:'designation', label:'Designation', placeholder:'Teacher / Accountant / Clerk', required:true },
              { key:'joining_date', label:'Joining Date', type:'date' },
              { key:'qualification', label:'Qualification', placeholder:'B.Ed / M.A / B.Com' },
            ].map(f => (
              <div key={f.key}>
                <label style={S.label}>{f.label}</label>
                <input type={f.type||'text'} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]:e.target.value })} required={f.required} placeholder={f.placeholder||''} style={S.input} />
              </div>
            ))}
            <div>
              <label style={S.label}>Department</label>
              <select value={form.department} onChange={e => setForm({ ...form, department:e.target.value })} required style={{ ...S.input, backgroundColor:'white' }}>
                <option value="">Select Department</option>
                {DEPARTMENTS_LIST.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role:e.target.value })} style={{ ...S.input, backgroundColor:'white' }}>
                {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status:e.target.value })} style={{ ...S.input, backgroundColor:'white' }}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
          {/* Role info panel */}
          {form.role === 'Teaching + Admin' && (
            <div style={{ marginTop:14, padding:'10px 14px', background:'#fef3c7', borderRadius:8, fontSize:12, color:'#92400e', border:'1px solid #fde68a' }}>
              🎓⚙️ <strong>Teaching + Admin</strong> — this staff member appears in both teaching reports and administrative records. Their performance scoring will include both teaching load and administrative tasks.
            </div>
          )}
          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            <button type="button" onClick={onClose} style={{ ...S.btn('#64748b'), flex:1 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...S.btn('#16a34a', saving), flex:2 }}>{saving?'⏳ Saving...':'💾 Update Staff'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Salary Setup Modal ───────────────────────────────────────────────────────
function SalarySetupModal({ staffMember, onClose, onSaved }) {
  const [salaryForm, setSalaryForm] = useState({ basic_salary:staffMember.basic_salary||0, seniority_allowance:staffMember.seniority_allowance||0, loyalty_bonus:staffMember.loyalty_bonus||0, role_bonus:staffMember.role_bonus||0 })
  const [saving, setSaving] = useState(false)
  const gross = Object.values(salaryForm).reduce((a,b) => a+Number(b), 0)
  const handleSave = async () => {
    setSaving(true)
    try {
      await staffDB.updateSalary(staffMember.id, salaryForm)
      onSaved(); onClose()
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }
  const fields = [
    { key:'basic_salary',        label:'Basic Salary',        icon:'💰', color:'#0C447C', desc:'Fixed monthly base pay' },
    { key:'seniority_allowance', label:'Seniority Allowance', icon:'⭐', color:'#7c3aed', desc:'Based on years of service' },
    { key:'loyalty_bonus',       label:'Loyalty Bonus',       icon:'🎖️', color:'#b45309', desc:'Long-term retention reward' },
    { key:'role_bonus',          label:'Role Bonus',          icon:'🏅', color:'#16a34a', desc:'Position-specific incentive' },
  ]
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#254e91)', padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, color:'#93c5fd', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>🔐 Admin · Salary Configuration</div>
            <div style={{ fontSize:18, fontWeight:700, color:'white', marginTop:4 }}>{staffMember.name}</div>
            <RoleBadge role={staffMember.role} />
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
            {fields.map(f => (
              <div key={f.key} style={{ display:'flex', alignItems:'center', gap:12, background:'#f8fafc', borderRadius:10, padding:'12px 14px', border:'1px solid #e2e8f0' }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{f.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#374151' }}>{f.label}</div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>{f.desc}</div>
                </div>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:13, fontWeight:700, color:f.color }}>₹</span>
                  <input type="number" min="0" value={salaryForm[f.key]} onChange={e => setSalaryForm({ ...salaryForm, [f.key]:e.target.value })} style={{ width:110, padding:'8px 8px 8px 24px', borderRadius:8, border:`1.5px solid ${f.color}44`, fontSize:14, fontWeight:700, color:f.color, background:'white', textAlign:'right', fontFamily:'inherit' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'linear-gradient(135deg,#E6F1FB,#EAF3DE)', borderRadius:10, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>Gross Monthly Salary</div>
            <div style={{ fontSize:26, fontWeight:800, color:'#0C447C' }}>{fmt(gross)}</div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ ...S.btn('#64748b'), flex:1 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...S.btn('#1e3a5f', saving), flex:2 }}>{saving?'⏳ Saving...':'💾 Save Salary Setup'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Scorecard Modal ──────────────────────────────────────────────────────────
function ScorecardModal({ record, staffName, onClose }) {
  if (!record) return null
  const { p1, p2, p3, p4, p5, total } = calcScores(record)
  const lvl = getLevel(total)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:16, padding:32, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:700, color:'#1e293b', margin:0 }}>{staffName}</h2>
            <p style={{ color:'#64748b', fontSize:14, margin:'4px 0 0' }}>{formatMonth(record.month)}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#64748b', fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ textAlign:'center', padding:20, background:lvl.bg, borderRadius:12, marginBottom:24, border:`2px solid ${lvl.border}` }}>
          <div style={{ fontSize:36 }}>{lvl.emoji}</div>
          <div style={{ fontSize:28, fontWeight:800, color:lvl.color }}>{total}</div>
          <div style={{ fontSize:16, fontWeight:700, color:lvl.color }}>{lvl.label}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            { label:'Attendance',      score:p1, max:30, color:'#0ea5e9', detail:`${record.days_present}/${record.working_days} days` },
            { label:'Punctuality',     score:p2, max:20, color:'#10b981', detail:`${record.late_count} late, ${record.early_leave_count} early` },
            { label:'Task Completion', score:p3, max:20, color:'#f59e0b', detail:`${record.tasks_completed_on_time}/${record.tasks_assigned} tasks` },
            { label:'Feedback',        score:p4, max:15, color:'#8b5cf6', detail:`Avg: ${record.feedback_avg}/5` },
            { label:'Initiative',      score:p5, max:15, color:'#ec4899', detail:`Rating: ${record.initiative_score}/5` },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{item.label}</span>
                <span style={{ fontSize:12, color:'#94a3b8' }}>{item.detail}</span>
              </div>
              <ScoreBar value={item.score} max={item.max} color={item.color} />
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
  const [form, setForm] = useState({
    title:'', description:'',
    assigned_to: preselectedStaff?.name || (staffList[0]?.name||''),
    assigned_by: 'Admin',
    department:  preselectedStaff?.department||'Administration',
    priority:'Medium', status:'Pending', due_date:'',
    course:'', subtype:'', class_name:'', batch_id:'',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.title || !form.assigned_to) { alert('Title and Assigned To are required'); return }
    setSaving(true)
    const { data, error } = await supabase.from('staff_tasks').insert([{
      title:form.title, description:form.description||null, assigned_to:form.assigned_to,
      assigned_by:form.assigned_by, department:form.department, priority:form.priority,
      status:form.status, due_date:form.due_date||null, course:form.course||null,
      subtype:form.subtype||null, class_name:form.class_name||null, batch_id:form.batch_id||null,
      created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    }]).select()
    setSaving(false)
    if (error) { alert('Error: '+error.message); return }
    onSaved(data?.[0]); onClose()
  }

  // Teaching-only staff for course-linked tasks
  const teachingStaff = staffList.filter(s => s.role==='Teaching' || s.role==='Teaching + Admin')

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.65)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:640, boxShadow:'0 24px 64px rgba(0,0,0,0.22)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#6366f1)', padding:'22px 28px', color:'white', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:11, opacity:.7, letterSpacing:1, textTransform:'uppercase' }}>GNSI · Staff Tasks</div>
            <div style={{ fontSize:20, fontWeight:800 }}>Assign New Task</div>
            {preselectedStaff && <div style={{ fontSize:13, opacity:.8, marginTop:2, display:'flex', alignItems:'center', gap:6 }}>→ {preselectedStaff.name} <RoleBadge role={preselectedStaff.role} /></div>}
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.18)', border:'none', color:'white', borderRadius:8, width:34, height:34, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ padding:'24px 28px', overflowY:'auto', display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={S.label}>Task Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title:e.target.value })} placeholder="e.g. Submit lesson plan" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Description / Instructions</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description:e.target.value })} rows={2} style={{ ...S.input, resize:'vertical', height:70 }} placeholder="Detailed instructions..." />
          </div>
          {/* Course context — only shown when teaching staff selected */}
          {(form.course !== undefined) && (
            <div style={{ padding:'14px 16px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#0284c7', marginBottom:12 }}>
                📚 Course Context <span style={{ fontWeight:400, color:'#64748b' }}>(optional — Academic tasks only)</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <CoursePicker form={form} setForm={setForm} courseData={courseData} />
              </div>
              {form.batch_id && <div style={{ marginTop:10, fontSize:12, color:'#16a34a', fontWeight:600 }}>✅ Task linked to batch</div>}
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <label style={S.label}>Assign To *</label>
              <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to:e.target.value })} style={{ ...S.input, backgroundColor:'white' }}>
                {staffList.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} — {s.designation} {s.role==='Teaching + Admin'?'[T+A]':s.role==='Teaching'?'[T]':''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Assigned By</label>
              <input value={form.assigned_by} onChange={e => setForm({ ...form, assigned_by:e.target.value })} style={S.input} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
            <div>
              <label style={S.label}>Department</label>
              <select value={form.department} onChange={e => setForm({ ...form, department:e.target.value })} style={{ ...S.input, backgroundColor:'white' }}>
                {DEPARTMENTS_LIST.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority:e.target.value })} style={{ ...S.input, backgroundColor:'white' }}>
                {TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date:e.target.value })} style={S.input} />
            </div>
          </div>
        </div>
        <div style={{ padding:'16px 28px 24px', display:'flex', gap:12 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, background:'linear-gradient(135deg,#1e3a5f,#6366f1)', color:'white', border:'none', borderRadius:12, padding:14, cursor:'pointer', fontWeight:800, fontSize:15, fontFamily:'inherit' }}>
            {saving?'⏳ Assigning…':'✅ Assign Task'}
          </button>
          <button onClick={onClose} style={{ padding:'14px 24px', background:'#f1f5f9', border:'none', borderRadius:12, cursor:'pointer', fontWeight:600, color:'#64748b', fontFamily:'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────
function TaskDetailModal({ task, onClose, onStatusChange }) {
  const [note, setNote]     = useState(task.completion_note||'')
  const [saving, setSaving] = useState(false)
  const diff      = daysDiff(task.due_date)
  const isOverdue = diff!==null && diff<0 && task.status!=='Done'
  const sm = STATUS_META[isOverdue?'Overdue':task.status]||STATUS_META.Pending
  const pm = PRIORITY_META[task.priority]||PRIORITY_META.Medium
  const saveNote = async () => {
    setSaving(true)
    await supabase.from('staff_tasks').update({ completion_note:note, updated_at:new Date().toISOString() }).eq('id', task.id)
    setSaving(false); alert('Note saved!')
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', backdropFilter:'blur(4px)', zIndex:1001, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:540, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#0ea5e9)', padding:'22px 24px', color:'white', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:11, opacity:.7, textTransform:'uppercase', letterSpacing:1 }}>Task Detail</div>
            <div style={{ fontSize:18, fontWeight:700, marginTop:4, lineHeight:1.3 }}>{task.title}</div>
            {task.course && <div style={{ fontSize:12, opacity:.8, marginTop:4 }}>📚 {task.course}{task.subtype?` / ${task.subtype}`:''}{task.class_name?` / ${task.class_name}`:''}</div>}
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', borderRadius:8, width:32, height:32, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ padding:'22px 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            {[['Assigned To',task.assigned_to],['Assigned By',task.assigned_by||'Admin'],['Department',task.department||'General'],['Due Date',fmtDate(task.due_date)]].map(([l,v]) => (
              <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:13, color:'#1e293b', fontWeight:600 }}>{v||'—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, background:pm.bg, color:pm.color }}>{pm.icon} {task.priority}</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, background:sm.bg, color:sm.color }}>{sm.icon} {isOverdue?'Overdue':task.status}</span>
          </div>
          {task.description && <div style={{ marginBottom:14, background:'#f8fafc', borderRadius:10, padding:12, fontSize:13, color:'#475569', lineHeight:1.6 }}>{task.description}</div>}
          <div style={{ marginBottom:16 }}>
            <label style={{ ...S.label, marginBottom:6 }}>Completion Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} style={{ ...S.input, resize:'vertical', fontFamily:'inherit' }} placeholder="Add progress note..." />
            <button onClick={saveNote} disabled={saving} style={{ ...S.btn('#1e3a5f', saving), marginTop:8, padding:'8px 16px', fontSize:13 }}>{saving?'Saving…':'Save Note'}</button>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {task.status!=='Done' && <button onClick={() => { onStatusChange(task, task.status==='Pending'?'In Progress':'Done'); onClose() }} style={{ flex:1, background:'linear-gradient(135deg,#6366f1,#0ea5e9)', color:'white', border:'none', borderRadius:10, padding:12, cursor:'pointer', fontWeight:700, fontSize:14, fontFamily:'inherit' }}>{task.status==='Pending'?'▶ Start Task':'✅ Mark Done'}</button>}
            {task.status==='Done' && <button onClick={() => { onStatusChange(task,'Pending'); onClose() }} style={{ flex:1, background:'#64748b', color:'white', border:'none', borderRadius:10, padding:12, cursor:'pointer', fontWeight:700, fontFamily:'inherit' }}>↩ Reopen</button>}
            <button onClick={onClose} style={{ padding:'12px 20px', background:'#f1f5f9', border:'none', borderRadius:10, cursor:'pointer', fontWeight:600, color:'#64748b', fontFamily:'inherit' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Score Entry Row ──────────────────────────────────────────────────────────
function ScoreEntryRow({ staff, score, onChange }) {
  const computed = score ? calcScores(score) : null
  return (
    <tr style={{ borderBottom:'1px solid #f1f5f9' }}>
      <td style={{ padding:'12px 16px', minWidth:160 }}>
        <div style={{ fontWeight:600, color:'#1e293b' }}>{staff.name}</div>
        <div style={{ fontSize:11, color:'#94a3b8' }}>{staff.designation}</div>
        <RoleBadge role={staff.role} />
      </td>
      {[
        { key:'days_present',            max:score?.working_days||26 },
        { key:'late_count' },
        { key:'early_leave_count' },
        { key:'tasks_assigned' },
        { key:'tasks_completed_on_time' },
        { key:'feedback_avg',    step:.1, max:5 },
        { key:'initiative_score', max:5 },
      ].map(field => (
        <td key={field.key} style={{ padding:8 }}>
          <input type="number" min="0" max={field.max||99} step={field.step||1}
            value={score?.[field.key]??0}
            onChange={e => onChange(staff.id, field.key, parseFloat(e.target.value)||0)}
            style={{ width:70, padding:'6px 8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, textAlign:'center', fontFamily:'inherit' }} />
        </td>
      ))}
      <td style={{ padding:'12px 16px', textAlign:'center' }}>
        {computed ? <div><div style={{ fontSize:16, fontWeight:800, color:'#1e293b' }}>{computed.total}</div><LevelBadge score={computed.total} /></div> : '—'}
      </td>
    </tr>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
function Staff({ currentUser }) {
  const [staff,             setStaff]             = useState([])
  const [loading,           setLoading]           = useState(true)
  const [saving,            setSaving]            = useState(false)
  const [showForm,          setShowForm]          = useState(false)
  const [search,            setSearch]            = useState('')
  const [statusFilter,      setStatusFilter]      = useState('All')
  const [roleFilter,        setRoleFilter]        = useState('All')
  const [form,              setForm]              = useState(emptyForm)
  const [activeTab,         setActiveTab]         = useState('staff')
  const [editingStaff,      setEditingStaff]      = useState(null)
  const [scoreMonth,        setScoreMonth]        = useState(currentMonth())
  const [scores,            setScores]            = useState({})
  const [scoreSaving,       setScoreSaving]       = useState(false)
  const [allMonthlyScores,  setAllMonthlyScores]  = useState([])
  const [selectedScorecard, setSelectedScorecard] = useState(null)
  const [historyStaffId,    setHistoryStaffId]    = useState('')
  const [workingDays,       setWorkingDays]       = useState(26)
  const [salaryTarget,      setSalaryTarget]      = useState(null)
  const [showPinModal,      setShowPinModal]      = useState(false)
  const [adminUnlocked,     setAdminUnlocked]     = useState(false)
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
  const [toast,             setToast]             = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const isAdmin       = currentUser?.role === 'Admin'
  const loggedInStaff = staff.find(s => s.id===currentUser?.staff_id) || staff.find(s => s.name===currentUser?.name) || null

  const fetchStaff = async () => {
  setLoading(true)
  try {
    const data = await staffDB.forStaffPage()
    setStaff(data)
  } catch (err) { showToast('⚠️ Could not load staff.') }
  finally { setLoading(false) }
}

  const fetchTasks = async () => {
    setTasksLoading(true)
    const { data, error } = await supabase.from('staff_tasks').select('*').order('created_at', { ascending:false })
    if (!error) setTasks(data||[])
    else showToast('⚠️ Could not load tasks.')
    setTasksLoading(false)
  }// MAIN COMPONENT


  const fetchScoresForMonth = async month => {
    const { data } = await supabase.from('staff_monthly_scores').select('*').eq('month', month)
    if (data) { const map={}; data.forEach(r => { map[r.staff_id]=r }); setScores(map); setWorkingDays(data[0]?.working_days||26) }
    else setScores({})
  }

  const fetchAllScores = async () => {
    const { data } = await supabase.from('staff_monthly_scores').select('*').order('month', { ascending:false })
    if (data) setAllMonthlyScores(data)
  }

  useEffect(() => { fetchStaff() }, [])
  useEffect(() => { if (activeTab==='tasks')       fetchTasks() },                           [activeTab])
  useEffect(() => { if (activeTab==='scoring')     fetchScoresForMonth(scoreMonth) },        [activeTab, scoreMonth])
  useEffect(() => { if (activeTab==='leaderboard') { fetchScoresForMonth(scoreMonth); fetchAllScores() } }, [activeTab, scoreMonth])
  useEffect(() => { if (activeTab==='history')     fetchAllScores() },                       [activeTab])

  const tasksWithOverdue = useMemo(() => tasks.map(t => {
    const diff = daysDiff(t.due_date)
    return { ...t, _overdue: diff!==null && diff<0 && t.status!=='Done' }
  }), [tasks])

  const filteredTasks = useMemo(() => {
    // Enrich tasks with staff role
    const staffRoleMap = {}
    staff.forEach(s => { staffRoleMap[s.name] = s.role })
    return tasksWithOverdue.filter(t => {
      const q = taskSearch.toLowerCase()
      const matchSearch   = !q || (t.title||'').toLowerCase().includes(q) || (t.assigned_to||'').toLowerCase().includes(q)
      const effectiveStatus = t._overdue ? 'Overdue' : t.status
      const matchStatus   = taskStatusFilter==='All'   || effectiveStatus===taskStatusFilter
      const matchPriority = taskPriorityFilter==='All' || t.priority===taskPriorityFilter
      const matchStaff    = taskStaffFilter==='All'    || t.assigned_to===taskStaffFilter
      const staffRole     = staffRoleMap[t.assigned_to] || ''
      const matchRole     = taskRoleFilter==='All'     || staffRole===taskRoleFilter || (taskRoleFilter==='Teaching' && staffRole==='Teaching + Admin')
      return matchSearch && matchStatus && matchPriority && matchStaff && matchRole
    })
  }, [tasksWithOverdue, taskSearch, taskStatusFilter, taskPriorityFilter, taskStaffFilter, taskRoleFilter, staff])

  const taskStats = useMemo(() => ({
    total:      tasksWithOverdue.length,
    done:       tasksWithOverdue.filter(t => t.status==='Done').length,
    inProgress: tasksWithOverdue.filter(t => t.status==='In Progress').length,
    pending:    tasksWithOverdue.filter(t => t.status==='Pending').length,
    overdue:    tasksWithOverdue.filter(t => t._overdue).length,
    high:       tasksWithOverdue.filter(t => t.priority==='High').length,
  }), [tasksWithOverdue])

  const staffTaskMap = useMemo(() => {
    const map = {}
    tasksWithOverdue.forEach(t => {
      if (!map[t.assigned_to]) map[t.assigned_to] = { total:0, done:0, overdue:0 }
      map[t.assigned_to].total++
      if (t.status==='Done') map[t.assigned_to].done++
      if (t._overdue) map[t.assigned_to].overdue++
    })
    return map
  }, [tasksWithOverdue])

  const staffTaskMonitor = useMemo(() =>
    staff.map(s => {
      const tm = staffTaskMap[s.name]||{ total:0, done:0, overdue:0 }
      return { ...s, taskTotal:tm.total, taskDone:tm.done, taskOverdue:tm.overdue, taskPending:tm.total-tm.done }
    }).filter(s => s.taskTotal>0).sort((a,b) => b.taskTotal-a.taskTotal),
  [staff, staffTaskMap])

  const handleTaskStatusChange = async (task, newStatus) => {
    const update = { status:newStatus, updated_at:new Date().toISOString() }
    if (newStatus==='Done') update.completed_at = new Date().toISOString()
    const { data, error } = await supabase.from('staff_tasks').update(update).eq('id', task.id).select()
    if (error) { showToast('❌ Update failed'); return }
    setTasks(prev => prev.map(t => t.id===task.id ? (data?.[0]||t) : t))
    showToast(`✅ Marked as ${newStatus}`)
  }

  const handleTaskDelete = async id => {
    if (!window.confirm('Delete this task?')) return
    const { error } = await supabase.from('staff_tasks').delete().eq('id', id)
    if (error) { showToast('❌ Delete failed'); return }
    setTasks(prev => prev.filter(t => t.id!==id))
    showToast('🗑️ Task deleted')
  }

  const handleNewTask = task => {
    if (task) setTasks(prev => [task, ...prev])
    showToast('✅ Task assigned!')
  }

  const handleAdd = async e => {
  e.preventDefault(); setSaving(true)
  try {
    await staffDB.insert({ ...form, joining_date: form.joining_date || null })
    setForm(emptyForm); setShowForm(false); fetchStaff()
  } catch (err) { alert('Error: ' + err.message) }
  finally { setSaving(false) }
}

 const handleDelete = async id => {
  if (window.confirm('Delete this staff record?')) {
    try {
      await staffDB.delete(id)
      fetchStaff()
    } catch (err) { alert('Error: ' + err.message) }
  }
}
  const handleOpenSalarySetup = staffMember => {
    setSalaryTarget(staffMember)
    if (adminUnlocked) setShowSalaryModal(true); else setShowPinModal(true)
  }

  const handleSaveScores = async () => {
    setScoreSaving(true)
    const rows = staff.map(s => {
      const row     = scores[s.id]||{ ...emptyScore, working_days:workingDays }
      const computed = calcScores({ ...row, working_days:workingDays })
      return { staff_id:s.id, month:scoreMonth, working_days:workingDays, days_present:row.days_present||0, late_count:row.late_count||0, early_leave_count:row.early_leave_count||0, tasks_assigned:row.tasks_assigned||0, tasks_completed_on_time:row.tasks_completed_on_time||0, feedback_avg:row.feedback_avg||0, initiative_score:row.initiative_score||0, p1_attendance:computed.p1, p2_punctuality:computed.p2, p3_tasks:computed.p3, p4_feedback:computed.p4, p5_initiative:computed.p5, total_score:computed.total, level:getLevel(computed.total)?.label||'Probation' }
    })
    const { error } = await supabase.from('staff_monthly_scores').upsert(rows, { onConflict:'staff_id,month' })
    if (error) alert('Error: '+error.message)
    else { alert('✅ Scores saved for '+formatMonth(scoreMonth)); fetchScoresForMonth(scoreMonth) }
    setScoreSaving(false)
  }

  const handleConfirmScores = async () => {
    if (!window.confirm(`Confirm and lock scores for ${formatMonth(scoreMonth)}?`)) return
    const { error } = await supabase.from('staff_monthly_scores').update({ is_confirmed:true, confirmed_by:'Authority', confirmed_at:new Date().toISOString() }).eq('month', scoreMonth)
    if (error) alert('Error: '+error.message)
    else { alert('✅ Scores confirmed!'); fetchScoresForMonth(scoreMonth) }
  }

  const handleScoreChange = (staffId, field, value) => {
    setScores(prev => ({ ...prev, [staffId]: { ...(prev[staffId]||{ ...emptyScore, working_days:workingDays, staff_id:staffId, month:scoreMonth }), [field]:value } }))
  }

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase()
    return staff.filter(item => {
      const matchSearch = ['name','phone','email','department','designation','qualification','role'].some(k => (item[k]||'').toLowerCase().includes(q))
      const matchStatus = statusFilter==='All' || item.status===statusFilter
      const matchRole   = roleFilter==='All'   || item.role===roleFilter
      return matchSearch && matchStatus && matchRole
    })
  }, [staff, search, statusFilter, roleFilter])

  const leaderboard = useMemo(() =>
    staff.map(s => { const sc=scores[s.id]; return { ...s, score: sc?calcScores(sc).total:null } })
      .filter(s => s.score!==null).sort((a,b) => b.score-a.score),
  [staff, scores])

  const historyData = useMemo(() => {
    if (!historyStaffId) return []
    return allMonthlyScores.filter(r => r.staff_id===historyStaffId).sort((a,b) => b.month.localeCompare(a.month))
  }, [allMonthlyScores, historyStaffId])

  const activeStaffNames = useMemo(() => [...new Set(tasksWithOverdue.map(t => t.assigned_to))], [tasksWithOverdue])

  // Role summary counts
  const roleCounts = useMemo(() => {
    const counts = { Teaching:0, 'Non-Teaching':0, Admin:0, 'Teaching + Admin':0 }
    staff.filter(s => s.status==='Active').forEach(s => { if (counts[s.role]!==undefined) counts[s.role]++ })
    return counts
  }, [staff])

  const statsCards = [
    { label:'Total Staff',       value:staff.length,                                        color:'#1e3a5f', bg:'#eff6ff', icon:'👨‍🏫' },
    { label:'Active',            value:staff.filter(s => s.status==='Active').length,       color:'#16a34a', bg:'#dcfce7', icon:'✅' },
    { label:'Teaching',          value:roleCounts['Teaching'] + roleCounts['Teaching + Admin'], color:'#0891b2', bg:'#e0f2fe', icon:'🎓' },
    { label:'Non-Teaching',      value:roleCounts['Non-Teaching'],                          color:'#6366f1', bg:'#eef2ff', icon:'🏢' },
    { label:'Admin / Dual Role', value:roleCounts['Admin'] + roleCounts['Teaching + Admin'],color:'#d97706', bg:'#fef3c7', icon:'⚙️' },
    { label:'Salary Set',        value:staff.filter(s => Number(s.basic_salary)>0).length,  color:'#7c3aed', bg:'#f3e8ff', icon:'💰' },
  ]

  return (
    <div style={S.page}>
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:2000, background:'#1e293b', color:'white', padding:'13px 20px', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.25)', fontSize:14, fontWeight:600 }}>
          {toast}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:'bold', color:'#1e3a5f', margin:0 }}>👨‍🏫 Staff Management</h1>
          <p style={{ color:'#64748b', fontSize:14, margin:'4px 0 0' }}>Profiles · Roles · Performance · Scoring · Tasks</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {activeTab==='staff' && <button onClick={() => setShowForm(!showForm)} style={S.btn()}>{showForm?'✖ Cancel':'➕ Add Staff'}</button>}
          {activeTab==='tasks' && (
            <button onClick={() => { setAssignPreselected(null); setShowAssignModal(true) }} style={{ ...S.btn('#6366f1'), background:'linear-gradient(135deg,#6366f1,#0ea5e9)' }}>
              ＋ Assign Task
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:24, gap:4, flexWrap:'wrap' }}>
        {[
          { key:'staff',       label:'👥 Staff List' },
          { key:'tasks',       label:'📋 Task Monitor' },
          { key:'scoring',     label:'📊 Monthly Scoring' },
          { key:'leaderboard', label:'🏆 Leaderboard' },
          { key:'history',     label:'📅 History' },
          { key:'geo',         label:'📍 Geo-Attendance' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab===t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ── STAFF LIST ── */}
      {activeTab==='staff' && (
        <>
          {/* Stats — now 6 cards including role breakdown */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:14, marginBottom:24 }}>
            {statsCards.map(card => (
              <div key={card.label} style={{ backgroundColor:card.bg, borderRadius:12, padding:'16px 18px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', borderLeft:`4px solid ${card.color}` }}>
                <div style={{ fontSize:20, marginBottom:6 }}>{card.icon}</div>
                <p style={{ fontSize:12, color:card.color, fontWeight:700, margin:0, textTransform:'uppercase', letterSpacing:.04 }}>{card.label}</p>
                <h2 style={{ fontSize:26, fontWeight:'bold', color:card.color, margin:'4px 0 0' }}>{card.value}</h2>
              </div>
            ))}
          </div>

          {/* Add form */}
          {showForm && (
            <div style={S.card}>
              <h2 style={{ fontSize:18, fontWeight:600, color:'#1e3a5f', marginTop:0 }}>Add Staff Profile</h2>
              <p style={{ fontSize:13, color:'#94a3b8', marginTop:-8, marginBottom:16 }}>💡 Salary configured separately by admin after adding.</p>
              <form onSubmit={handleAdd}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {[{ key:'name', label:'Full Name', required:true },{ key:'phone', label:'Phone' },{ key:'email', label:'Email', type:'email' },{ key:'designation', label:'Designation', placeholder:'Teacher / Accountant / Clerk', required:true },{ key:'joining_date', label:'Joining Date', type:'date' },{ key:'qualification', label:'Qualification', placeholder:'B.Ed / M.A / B.Com' }].map(f => (
                    <div key={f.key}>
                      <label style={S.label}>{f.label}</label>
                      <input type={f.type||'text'} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]:e.target.value })} required={f.required} placeholder={f.placeholder||''} style={S.input} />
                    </div>
                  ))}
                  <div>
                    <label style={S.label}>Department</label>
                    <select value={form.department} onChange={e => setForm({ ...form, department:e.target.value })} required style={{ ...S.input, backgroundColor:'white' }}>
                      <option value="">Select Department</option>
                      {DEPARTMENTS_LIST.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Role</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role:e.target.value })} style={{ ...S.input, backgroundColor:'white' }}>
                      {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status:e.target.value })} style={{ ...S.input, backgroundColor:'white' }}>
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </div>
                </div>
                {form.role==='Teaching + Admin' && (
                  <div style={{ marginTop:12, padding:'10px 14px', background:'#fef3c7', borderRadius:8, fontSize:12, color:'#92400e', border:'1px solid #fde68a' }}>
                    🎓⚙️ This staff will appear in both teaching and administrative reports.
                  </div>
                )}
                <button type="submit" disabled={saving} style={{ ...S.btn('#1e3a5f', saving), marginTop:16 }}>{saving?'⏳ Saving...':'✅ Save Staff'}</button>
              </form>
            </div>
          )}

          {/* Filters */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:14 }}>
            <input placeholder="🔍 Search name, phone, email, department, role..." value={search} onChange={e => setSearch(e.target.value)} style={S.input} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...S.input, backgroundColor:'white' }}>
              <option value="All">All Status</option>
              <option>Active</option><option>Inactive</option>
            </select>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...S.input, backgroundColor:'white' }}>
              <option value="All">All Roles</option>
              {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ fontSize:13, color:'#64748b', marginBottom:10 }}>Showing {filteredStaff.length} of {staff.length} staff</div>

          {loading ? (
            <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading staff...</div>
          ) : (
            <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                  <thead>
                    <tr style={{ backgroundColor:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                      {['#','Name','Dept','Designation','Role','Phone','Joining','Status','Gross Salary','Tasks','Level','Action'].map(h => (
                        <th key={h} style={{ ...th, fontSize:12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((item, i) => {
                      const sc      = scores[item.id]
                      const computed = sc ? calcScores(sc) : null
                      const gross   = (Number(item.basic_salary)||0)+(Number(item.seniority_allowance)||0)+(Number(item.loyalty_bonus)||0)+(Number(item.role_bonus)||0)
                      const tm      = staffTaskMap[item.name]||{ total:0, done:0, overdue:0 }
                      return (
                        <tr key={item.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={{ ...td, color:'#94a3b8', fontSize:12 }}>{i+1}</td>
                          <td style={td}>
                            <div style={{ fontWeight:600, color:'#1e293b' }}>{item.name}</div>
                            <div style={{ fontSize:11, color:'#94a3b8' }}>{item.email||'-'}</div>
                          </td>
                          <td style={{ ...td, color:'#64748b', fontSize:13 }}>{item.department||'-'}</td>
                          <td style={{ ...td, color:'#64748b', fontSize:13 }}>{item.designation||'-'}</td>
                          <td style={td}><RoleBadge role={item.role} /></td>
                          <td style={{ ...td, color:'#64748b', fontSize:13 }}>{item.phone||'-'}</td>
                          <td style={{ ...td, color:'#64748b', fontSize:13 }}>{item.joining_date||'-'}</td>
                          <td style={td}>
                            <span style={{ padding:'4px 10px', borderRadius:99, fontSize:12, fontWeight:600, backgroundColor:item.status==='Active'?'#dcfce7':'#fee2e2', color:item.status==='Active'?'#16a34a':'#dc2626' }}>{item.status}</span>
                          </td>
                          <td style={td}>
                            {gross>0
                              ? <div><div style={{ fontWeight:700, color:'#0C447C', fontSize:13 }}>{fmt(gross)}</div><div style={{ fontSize:10, color:'#94a3b8' }}>Basic {fmt(item.basic_salary)}</div></div>
                              : <span style={{ fontSize:11, fontWeight:600, color:'#dc2626', background:'#fee2e2', padding:'3px 8px', borderRadius:6 }}>⚠ Not Set</span>
                            }
                          </td>
                          <td style={{ ...td, minWidth:120 }}>
                            {tm.total>0
                              ? <div><MiniBar done={tm.done} total={tm.total} overdue={tm.overdue} /><button onClick={() => { setTaskStaffFilter(item.name); setActiveTab('tasks') }} style={{ ...S.btnSm('#6366f1'), marginTop:5, fontSize:10, padding:'3px 8px' }}>View Tasks</button></div>
                              : <div><span style={{ fontSize:11, color:'#94a3b8' }}>No tasks</span><br/><button onClick={() => { setAssignPreselected(item); setShowAssignModal(true) }} style={{ ...S.btnSm('#0ea5e9'), marginTop:4, fontSize:10, padding:'3px 8px' }}>+ Assign</button></div>
                            }
                          </td>
                          <td style={td}><LevelBadge score={computed?.total} /></td>
                          <td style={td}>
                            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                              <button onClick={() => setEditingStaff(item)} style={S.btnSm('#0891b2')}>✏️</button>
                              <button onClick={() => handleOpenSalarySetup(item)} style={S.btnSm(gross>0?'#0C447C':'#dc2626')}>🔐</button>
                              {computed && <button onClick={() => setSelectedScorecard({ record:{ ...sc, ...computed }, staffName:item.name })} style={S.btnSm('#7c3aed')}>📊</button>}
                              <button onClick={() => handleDelete(item.id)} style={S.btnSm('#dc2626')}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredStaff.length===0 && <tr><td colSpan="12" style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No staff records found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div style={{ marginTop:12, padding:'10px 16px', background:adminUnlocked?'#dcfce7':'#f1f5f9', borderRadius:8, fontSize:12, color:adminUnlocked?'#16a34a':'#94a3b8', fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}>
            {adminUnlocked?'🔓 Admin session active — salary edits unlocked':'🔒 Salary setup requires admin PIN'}
          </div>
        </>
      )}

      {/* ── TASK MONITOR ── */}
      {activeTab==='tasks' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14, marginBottom:22 }}>
            {[
              { label:'Total',       value:taskStats.total,      accent:'#6366f1', icon:'📋' },
              { label:'Done',        value:taskStats.done,       accent:'#22c55e', icon:'✅' },
              { label:'In Progress', value:taskStats.inProgress, accent:'#0ea5e9', icon:'🔄' },
              { label:'Pending',     value:taskStats.pending,    accent:'#f59e0b', icon:'⏳' },
              { label:'Overdue',     value:taskStats.overdue,    accent:'#ef4444', icon:'🚨' },
              { label:'High Pri.',   value:taskStats.high,       accent:'#f97316', icon:'🔴' },
            ].map(({ label, value, accent, icon }) => (
              <div key={label} style={{ background:'white', borderRadius:12, padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', borderLeft:`4px solid ${accent}` }}>
                <div style={{ fontSize:18, marginBottom:3 }}>{icon}</div>
                <div style={{ fontSize:24, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:12, color:'#64748b', fontWeight:500, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>

          {staffTaskMonitor.length>0 && (
            <div style={{ ...S.card, marginBottom:20 }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#1e3a5f' }}>👥 Staff Task Overview</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {staffTaskMonitor.map(s => {
                  const rate  = s.taskTotal>0 ? Math.round((s.taskDone/s.taskTotal)*100) : 0
                  const color = s.taskOverdue>0?'#ef4444':rate>=80?'#22c55e':rate>=50?'#f59e0b':'#6366f1'
                  return (
                    <div key={s.id} style={{ background:'#f8fafc', borderRadius:10, padding:14, border:`1px solid ${color}33`, cursor:'pointer' }} onClick={() => setTaskStaffFilter(s.name)}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div>
                          <div style={{ fontWeight:700, color:'#1e293b', fontSize:13 }}>{s.name}</div>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{s.designation}</div>
                          <RoleBadge role={s.role} />
                        </div>
                        <span style={{ fontSize:18, fontWeight:800, color }}>{rate}%</span>
                      </div>
                      <MiniBar done={s.taskDone} total={s.taskTotal} overdue={s.taskOverdue} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ ...S.card, padding:'16px 18px', marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12 }}>
              <div>
                <label style={{ ...S.label, fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'#94a3b8' }}>🔍 Search</label>
                <input style={S.input} value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Title or staff..." />
              </div>
              <div>
                <label style={{ ...S.label, fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'#94a3b8' }}>Status</label>
                <select style={{ ...S.input, backgroundColor:'white' }} value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)}>
                  <option value="All">All</option>
                  {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...S.label, fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'#94a3b8' }}>Priority</label>
                <select style={{ ...S.input, backgroundColor:'white' }} value={taskPriorityFilter} onChange={e => setTaskPriorityFilter(e.target.value)}>
                  <option value="All">All</option>
                  {TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...S.label, fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'#94a3b8' }}>Role</label>
                <select style={{ ...S.input, backgroundColor:'white' }} value={taskRoleFilter} onChange={e => setTaskRoleFilter(e.target.value)}>
                  <option value="All">All Roles</option>
                  {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...S.label, fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'#94a3b8' }}>Staff Member</label>
                <select style={{ ...S.input, backgroundColor:'white' }} value={taskStaffFilter} onChange={e => setTaskStaffFilter(e.target.value)}>
                  <option value="All">All Staff</option>
                  {activeStaffNames.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              {taskStaffFilter!=='All' && (
                <div style={{ display:'flex', alignItems:'flex-end' }}>
                  <button onClick={() => setTaskStaffFilter('All')} style={{ ...S.btn('#64748b'), width:'100%', padding:10 }}>✕ Clear</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0f172a' }}>
                Task Assignments {taskStaffFilter!=='All' && <span style={{ fontWeight:400, color:'#6366f1' }}>— {taskStaffFilter}</span>}
              </h3>
              <span style={{ fontSize:12, color:'#94a3b8' }}>{filteredTasks.length} task{filteredTasks.length!==1?'s':''}</span>
            </div>
            {tasksLoading ? <div style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>⏳ Loading tasks…</div> : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {['Task','Assigned To','Role','Course Context','Priority','Status','Due Date','Actions'].map(h => (
                        <th key={h} style={{ ...th, fontSize:12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => {
                      const diff      = daysDiff(task.due_date)
                      const isOverdue = task._overdue
                      const sm = STATUS_META[isOverdue?'Overdue':task.status]||STATUS_META.Pending
                      const pm = PRIORITY_META[task.priority]||PRIORITY_META.Medium
                      const assignedStaff = staff.find(s => s.name===task.assigned_to)
                      return (
                        <tr key={task.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={td}>
                            <div style={{ fontWeight:600, color:'#1e293b', fontSize:13 }}>{task.title}</div>
                            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{task.department||'General'}</div>
                          </td>
                          <td style={td}>
                            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                              <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#0ea5e9)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:10, fontWeight:700, flexShrink:0 }}>
                                {task.assigned_to?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                              </div>
                              <span style={{ fontSize:13, fontWeight:500, color:'#334155' }}>{task.assigned_to}</span>
                            </div>
                          </td>
                          <td style={td}><RoleBadge role={assignedStaff?.role} /></td>
                          <td style={{ ...td, fontSize:12, color:'#64748b' }}>
                            {task.course
                              ? <span style={{ padding:'2px 8px', borderRadius:6, background:'#eff6ff', color:'#1e3a5f', fontWeight:600, fontSize:11 }}>
                                  {task.course}{task.subtype?` / ${task.subtype}`:''}{task.class_name?` / ${task.class_name}`:''}
                                </span>
                              : <span style={{ color:'#e2e8f0' }}>—</span>
                            }
                          </td>
                          <td style={td}><TaskBadge value={task.priority} type="priority" /></td>
                          <td style={td}><TaskBadge value={isOverdue?'Overdue':task.status} type="status" /></td>
                          <td style={td}>
                            {task.due_date ? <div>
                              <div style={{ fontSize:12, color:isOverdue?'#ef4444':'#334155', fontWeight:isOverdue?700:400 }}>{fmtDate(task.due_date)}</div>
                              {diff!==null && task.status!=='Done' && <div style={{ fontSize:10, color:isOverdue?'#ef4444':diff<=2?'#f59e0b':'#94a3b8' }}>{isOverdue?`${Math.abs(diff)}d overdue`:diff===0?'Due today!':`${diff}d left`}</div>}
                            </div> : '—'}
                          </td>
                          <td style={td}>
                            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                              <button onClick={() => setDetailTask(task)} style={S.btnSm('#6366f1')}>View</button>
                              {task.status!=='Done' && <button onClick={() => handleTaskStatusChange(task, task.status==='Pending'?'In Progress':'Done')} style={S.btnSm(task.status==='Pending'?'#0ea5e9':'#16a34a')}>{task.status==='Pending'?'Start':'✅ Done'}</button>}
                              {task.status==='Done' && <button onClick={() => handleTaskStatusChange(task,'Pending')} style={S.btnSm('#64748b')}>Reopen</button>}
                              <button onClick={() => handleTaskDelete(task.id)} style={S.btnSm('#ef4444')}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredTasks.length===0 && <tr><td colSpan="8" style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>{tasksWithOverdue.length===0?'No tasks yet. Click "+ Assign Task" to get started.':'No tasks match the current filters.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MONTHLY SCORING ── */}
      {activeTab==='scoring' && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, marginBottom:20 }}>
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:'#1e3a5f', margin:0 }}>📊 Monthly Performance Entry</h2>
              <p style={{ color:'#64748b', fontSize:13, margin:'4px 0 0' }}>Fill scores for all staff. System auto-calculates totals.</p>
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <div>
                <label style={{ ...S.label, display:'inline', marginRight:8 }}>Working Days:</label>
                <input type="number" min="1" max="31" value={workingDays} onChange={e => setWorkingDays(parseInt(e.target.value)||26)} style={{ width:60, padding:8, borderRadius:6, border:'1px solid #d1d5db', fontSize:14, textAlign:'center', fontFamily:'inherit' }} />
              </div>
              <div>
                <label style={{ ...S.label, display:'inline', marginRight:8 }}>Month:</label>
                <input type="month" value={scoreMonth} onChange={e => setScoreMonth(e.target.value)} style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #d1d5db', fontSize:14, fontFamily:'inherit' }} />
              </div>
              <button onClick={handleSaveScores} disabled={scoreSaving} style={S.btn('#16a34a', scoreSaving)}>{scoreSaving?'⏳ Saving...':'💾 Save Scores'}</button>
              <button onClick={handleConfirmScores} style={S.btn('#7c3aed')}>✅ Confirm & Lock</button>
            </div>
          </div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16, padding:12, background:'#f8fafc', borderRadius:8 }}>
            {LEVELS.map(l => <span key={l.label} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:l.color }}>{l.emoji} {l.label}: {l.min}–{l.max}</span>)}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#1e3a5f', color:'white' }}>
                  <th style={{ padding:'10px 16px', textAlign:'left' }}>Staff</th>
                  <th style={{ padding:'10px 8px', textAlign:'center' }}>Present<br/><span style={{ fontWeight:400, fontSize:10 }}>Max {workingDays} (30pts)</span></th>
                  <th style={{ padding:'10px 8px', textAlign:'center' }}>Late<br/><span style={{ fontWeight:400, fontSize:10 }}>Count (20pts)</span></th>
                  <th style={{ padding:'10px 8px', textAlign:'center' }}>Early Out</th>
                  <th style={{ padding:'10px 8px', textAlign:'center' }}>Tasks<br/><span style={{ fontWeight:400, fontSize:10 }}>Assigned (20pts)</span></th>
                  <th style={{ padding:'10px 8px', textAlign:'center' }}>Done</th>
                  <th style={{ padding:'10px 8px', textAlign:'center' }}>Feedback<br/><span style={{ fontWeight:400, fontSize:10 }}>1-5 (15pts)</span></th>
                  <th style={{ padding:'10px 8px', textAlign:'center' }}>Initiative<br/><span style={{ fontWeight:400, fontSize:10 }}>1-5 (15pts)</span></th>
                  <th style={{ padding:'10px 16px', textAlign:'center' }}>Score / Level</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <ScoreEntryRow key={s.id} staff={s}
                    score={scores[s.id] ? { ...scores[s.id], working_days:workingDays } : { ...emptyScore, working_days:workingDays }}
                    onChange={handleScoreChange} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      {activeTab==='leaderboard' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:'#1e3a5f', margin:0 }}>🏆 Performance Leaderboard</h2>
            <input type="month" value={scoreMonth} onChange={e => setScoreMonth(e.target.value)} style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #d1d5db', fontSize:14, fontFamily:'inherit' }} />
          </div>
          {leaderboard.length>=3 && (
            <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-end', gap:16, marginBottom:32 }}>
              {[leaderboard[1],leaderboard[0],leaderboard[2]].map((s,i) => {
                const heights=[160,200,140], rank=i===1?1:i===0?2:3
                const medals=['🥇','🥈','🥉'], colors=['#f59e0b','#94a3b8','#b45309']
                return (
                  <div key={s.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                    <div style={{ fontSize:24 }}>{medals[rank-1]}</div>
                    <div style={{ fontWeight:700, color:'#1e293b', fontSize:14, textAlign:'center', maxWidth:100 }}>{s.name}</div>
                    <RoleBadge role={s.role} />
                    <div style={{ fontSize:20, fontWeight:800, color:colors[rank-1] }}>{s.score}</div>
                    <LevelBadge score={s.score} />
                    <div style={{ width:100, height:`${heights[rank-1]}px`, background:`linear-gradient(to top,${colors[rank-1]},${colors[rank-1]}88)`, borderRadius:'8px 8px 0 0', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:8, color:'white', fontWeight:800, fontSize:20 }}>#{rank}</div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Rank','Staff','Role','Department','Attendance','Punctuality','Tasks','Feedback','Initiative','Total','Level'].map(h => (
                    <th key={h} style={{ ...th, fontSize:12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((s,i) => {
                  const sc      = scores[s.id]
                  const computed = sc ? calcScores({ ...sc, working_days:workingDays }) : null
                  return (
                    <tr key={s.id} style={{ borderBottom:'1px solid #f1f5f9', background:i<3?'#fffbeb':'white' }}>
                      <td style={{ ...td, fontWeight:700, color:i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#b45309':'#64748b', fontSize:16 }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                      <td style={td}><div style={{ fontWeight:600, color:'#1e293b' }}>{s.name}</div><div style={{ fontSize:11, color:'#94a3b8' }}>{s.designation}</div></td>
                      <td style={td}><RoleBadge role={s.role} /></td>
                      <td style={{ ...td, color:'#64748b', fontSize:12 }}>{s.department}</td>
                      {computed ? (
                        <>
                          <td style={{ ...td, fontWeight:600, color:'#0ea5e9' }}>{computed.p1}</td>
                          <td style={{ ...td, fontWeight:600, color:'#10b981' }}>{computed.p2}</td>
                          <td style={{ ...td, fontWeight:600, color:'#f59e0b' }}>{computed.p3}</td>
                          <td style={{ ...td, fontWeight:600, color:'#8b5cf6' }}>{computed.p4}</td>
                          <td style={{ ...td, fontWeight:600, color:'#ec4899' }}>{computed.p5}</td>
                          <td style={{ ...td, fontWeight:800, color:'#1e293b', fontSize:16 }}>{computed.total}</td>
                        </>
                      ) : <td colSpan="5" style={{ ...td, color:'#94a3b8' }}>No data</td>}
                      <td style={td}><LevelBadge score={s.score} /></td>
                    </tr>
                  )
                })}
                {leaderboard.length===0 && <tr><td colSpan="11" style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No scores for this month yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── HISTORY ── */}
      {activeTab==='history' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:'#1e3a5f', margin:0 }}>📅 Score History</h2>
            <select value={historyStaffId} onChange={e => setHistoryStaffId(e.target.value)} style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #d1d5db', fontSize:14, backgroundColor:'white', minWidth:220, fontFamily:'inherit' }}>
              <option value="">-- Select Staff --</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.designation}) [{s.role}]</option>)}
            </select>
          </div>
          {historyStaffId && historyData.length>0 && (
            <>
              <div style={S.card}>
                <h3 style={{ fontSize:15, fontWeight:600, color:'#1e3a5f', marginTop:0 }}>Score Trend</h3>
                <div style={{ display:'flex', alignItems:'flex-end', gap:12, height:120 }}>
                  {[...historyData].reverse().map(r => {
                    const lvl    = getLevel(r.total_score)
                    const height = Math.max(20, (r.total_score/100)*100)
                    return (
                      <div key={r.month} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:lvl?.color }}>{r.total_score}</div>
                        <div style={{ width:'100%', height:`${height}px`, background:lvl?.border, borderRadius:'4px 4px 0 0' }} />
                        <div style={{ fontSize:10, color:'#94a3b8' }}>{formatMonth(r.month).split(' ')[0]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                      {['Month','Attendance','Punctuality','Tasks','Feedback','Initiative','Total','Level','Details'].map(h => (
                        <th key={h} style={{ ...th, fontSize:12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(r => (
                      <tr key={r.month} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ ...td, fontWeight:600, color:'#1e293b' }}>{formatMonth(r.month)}</td>
                        <td style={{ ...td, color:'#0ea5e9', fontWeight:600 }}>{r.p1_attendance}</td>
                        <td style={{ ...td, color:'#10b981', fontWeight:600 }}>{r.p2_punctuality}</td>
                        <td style={{ ...td, color:'#f59e0b', fontWeight:600 }}>{r.p3_tasks}</td>
                        <td style={{ ...td, color:'#8b5cf6', fontWeight:600 }}>{r.p4_feedback}</td>
                        <td style={{ ...td, color:'#ec4899', fontWeight:600 }}>{r.p5_initiative}</td>
                        <td style={{ ...td, fontWeight:800, color:'#1e293b', fontSize:16 }}>{r.total_score}</td>
                        <td style={td}><LevelBadge score={r.total_score} /></td>
                        <td style={td}>
                          <button onClick={() => setSelectedScorecard({ record:r, staffName:staff.find(s => s.id===historyStaffId)?.name })} style={S.btnSm('#7c3aed')}>📊 View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {historyStaffId && historyData.length===0 && <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>No score history found.</div>}
          {!historyStaffId && <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>Select a staff member above to view their score history.</div>}
        </>
      )}

      {/* ── GEO ATTENDANCE ── */}
      {activeTab==='geo' && (
        <GeoAttendance currentStaff={loggedInStaff} isAdmin={isAdmin} allStaff={staff} />
      )}

      {/* ── MODALS ── */}
      {editingStaff    && <EditStaffModal staffMember={editingStaff} onClose={() => setEditingStaff(null)} onSaved={() => { fetchStaff(); setEditingStaff(null) }} />}
      {showPinModal    && <AdminPinModal onSuccess={() => { setAdminUnlocked(true); setShowPinModal(false); setShowSalaryModal(true) }} onClose={() => { setShowPinModal(false); setSalaryTarget(null) }} />}
      {showSalaryModal && salaryTarget && <SalarySetupModal staffMember={salaryTarget} onClose={() => { setShowSalaryModal(false); setSalaryTarget(null) }} onSaved={fetchStaff} />}
      {selectedScorecard && <ScorecardModal record={selectedScorecard.record} staffName={selectedScorecard.staffName} onClose={() => setSelectedScorecard(null)} />}
      {showAssignModal && <AssignTaskModal staffList={staff} preselectedStaff={assignPreselected} onClose={() => { setShowAssignModal(false); setAssignPreselected(null) }} onSaved={handleNewTask} />}
      {detailTask      && <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} onStatusChange={handleTaskStatusChange} />}
    </div>
  )
}

export default Staff