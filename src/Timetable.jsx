import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { staffDB } from './staffDB'

const T = {
  navy:'#0a1628', navyMid:'#112240', navyLt:'#1d3461',
  gold:'#f0a500', goldLt:'#fef3c7', goldDim:'#92600a',
  white:'#ffffff', ink:'#0f172a', muted:'#64748b',
  border:'#e2e8f0', surface:'#f8fafc',
  red:'#ef4444', redLt:'#fef2f2',
  green:'#10b981', greenLt:'#f0fdf4',
  purple:'#8b5cf6', purpleLt:'#f5f3ff',
  amber:'#f59e0b', amberLt:'#fffbeb',
  cyan:'#06b6d4', cyanLt:'#ecfeff',
  blue:'#3b82f6', blueLt:'#eff6ff',
}

const ADMIN_PIN = '1950'
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const BATCH_COLORS = {
  Achiever: { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
  Leader:   { bg:'#f0fdf4', border:'#22c55e', text:'#15803d' },
  Champion: { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
  Lakshya:  { bg:'#fff7ed', border:'#f97316', text:'#c2410c' },
  Umeed:    { bg:'#fdf2f8', border:'#ec4899', text:'#be185d' },
  Elite:    { bg:'#f0fdfa', border:'#14b8a6', text:'#0f766e' },
  Prime:    { bg:'#fefce8', border:'#eab308', text:'#854d0e' },
}
const BREAK_TYPES = ['LUNCH','TEA BREAK','DINNER','CLASS OFF','RECREATION','DOUBT SESSION','BREAK']
const getBatchStyle = n => {
  if (!n) return { bg:'#f8fafc', border:'#94a3b8', text:'#475569' }
  return BATCH_COLORS[n.split(' ')[0]] || { bg:'#f8fafc', border:'#94a3b8', text:'#475569' }
}

// ── Date helpers ──────────────────────────────────────────────
function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d
}
function formatDate(d) {
  return d.toISOString().split('T')[0]
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function getWeekDates(weekStart) {
  return DAYS.map((day, i) => ({ day, date: formatDate(addDays(weekStart, i)) }))
}
function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short' })
}

const emptyForm = { class_name:'', section:'', day_name:'Monday', period_name:'', subject_name:'', teacher_name:'', room_name:'' }

const S = {
  inp: { width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${T.border}`, fontSize:13, outline:'none', fontFamily:'inherit', color:T.ink, background:T.white, boxSizing:'border-box' },
  lbl: { display:'block', fontSize:11, fontWeight:700, color:T.muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'.07em' },
  btn: (bg=T.navy, c='white', dis=false) => ({ backgroundColor:dis?T.muted:bg, color:c, border:'none', borderRadius:8, padding:'10px 20px', fontWeight:700, cursor:dis?'not-allowed':'pointer', fontSize:13, opacity:dis?0.7:1 }),
  btnSm: (bg=T.navy, c='white') => ({ backgroundColor:bg, color:c, border:'none', borderRadius:6, padding:'5px 10px', fontWeight:700, cursor:'pointer', fontSize:11 }),
}

function Inp({ value, onChange, placeholder, style={}, type='text' }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ ...S.inp, ...style }}
      onFocus={e=>{ e.target.style.borderColor=T.navy; e.target.style.boxShadow=`0 0 0 3px rgba(10,22,40,0.08)` }}
      onBlur={e=>{ e.target.style.borderColor=T.border; e.target.style.boxShadow='none' }}
    />
  )
}
function Sel({ value, onChange, children, style={} }) {
  return <select value={value} onChange={onChange} style={{ ...S.inp, ...style }}>{children}</select>
}

function findConflicts(entries) {
  const conflicts = []
  const bySlot = {}
  entries.forEach(e => {
    const key = `${e.day_name}|${e.period_name}`
    if (!bySlot[key]) bySlot[key] = []
    bySlot[key].push(e)
  })
  Object.entries(bySlot).forEach(([key, items]) => {
    const teachers = {}
    items.forEach(e => {
      if (!e.teacher_name) return
      if (!teachers[e.teacher_name]) teachers[e.teacher_name] = []
      teachers[e.teacher_name].push(e)
    })
    Object.entries(teachers).forEach(([t, tItems]) => {
      if (tItems.length > 1)
        conflicts.push({ type:'teacher', entries:tItems, message:`${t} double-booked at ${key.replace('|',' — ')}` })
    })
  })
  return conflicts
}

// ══════════════════════════════════════════════════════════════
//  SUBSTITUTE MODAL
// ══════════════════════════════════════════════════════════════
function SubstituteModal({ entry, date, staffList, allEntries, onClose, onSaved, showToast }) {
  const [substituteTeacher, setSubstituteTeacher] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  // Find free teachers at this period on this date/day
  const busyTeachers = new Set(
    allEntries
      .filter(e => e.day_name === entry.day_name && e.period_name === entry.period_name && e.class_name !== entry.class_name)
      .map(e => e.teacher_name)
      .filter(Boolean)
  )
  const freeTeachers = staffList.filter(s => s.name !== entry.teacher_name && !busyTeachers.has(s.name))
  const busyList = staffList.filter(s => busyTeachers.has(s.name))

  const handleSave = async () => {
    if (!substituteTeacher) { showToast('Select a substitute teacher', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('timetable_substitutions').upsert([{
      sub_date: date,
      class_name: entry.class_name,
      period_name: entry.period_name,
      original_teacher: entry.teacher_name,
      substitute_teacher: substituteTeacher,
      reason,
      status: 'Covered',
    }], { onConflict: 'sub_date,class_name,period_name' })
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    showToast(`✅ ${substituteTeacher} assigned as substitute`)
    onSaved()
    onClose()
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,22,40,0.8)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:520, boxShadow:'0 24px 80px rgba(0,0,0,0.4)', overflow:'hidden' }}>
        <div style={{ background:`linear-gradient(135deg,${T.navy},${T.navyLt})`, padding:'20px 24px' }}>
          <div style={{ fontSize:11, color:T.gold, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase' }}>🔄 Assign Substitute</div>
          <div style={{ fontSize:18, fontWeight:700, color:'white', marginTop:4 }}>{entry.subject_name} — {entry.class_name}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:2 }}>{entry.day_name} · {entry.period_name} · {fmt(date)}</div>
          <div style={{ marginTop:8, background:'rgba(239,68,68,0.2)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#fca5a5' }}>
            ⚠️ Original teacher: <strong>{entry.teacher_name || 'Unassigned'}</strong> is absent
          </div>
        </div>
        <div style={{ padding:24 }}>
          {/* Free teachers */}
          <div style={{ marginBottom:16 }}>
            <label style={S.lbl}>Available Teachers ({freeTeachers.length} free at this period)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {freeTeachers.map(s => (
                <button key={s.id} onClick={() => setSubstituteTeacher(s.name)}
                  style={{ padding:'7px 14px', borderRadius:8, border:`2px solid ${substituteTeacher===s.name?T.green:T.border}`, background:substituteTeacher===s.name?T.greenLt:'white', color:substituteTeacher===s.name?T.green:T.ink, fontWeight:substituteTeacher===s.name?700:500, cursor:'pointer', fontSize:12, transition:'all .15s' }}>
                  {substituteTeacher===s.name?'✓ ':''}{s.name}
                  {s.designation&&<span style={{ fontSize:10, color:T.muted, marginLeft:4 }}>({s.designation})</span>}
                </button>
              ))}
              {!freeTeachers.length && <div style={{ color:T.muted, fontSize:13, padding:'8px 0' }}>⚠️ No free teachers at this period</div>}
            </div>
            {busyList.length > 0 && (
              <div style={{ fontSize:11, color:T.muted, padding:'6px 10px', background:T.surface, borderRadius:6 }}>
                🔴 Busy at this period: {busyList.map(s=>s.name).join(', ')}
              </div>
            )}
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={S.lbl}>Or select manually</label>
            <Sel value={substituteTeacher} onChange={e=>setSubstituteTeacher(e.target.value)}>
              <option value="">— Select Teacher —</option>
              {staffList.filter(s=>s.name!==entry.teacher_name).map(s=>(
                <option key={s.id} value={s.name}>{s.name}{busyTeachers.has(s.name)?' (busy)':' (free)'}</option>
              ))}
            </Sel>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={S.lbl}>Reason (optional)</label>
            <Inp value={reason} onChange={e=>setReason(e.target.value)} placeholder="Sick leave / Personal / Training..." />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, fontWeight:600, cursor:'pointer', fontSize:13 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving||!substituteTeacher} style={{ flex:2, ...S.btn(saving?T.muted:T.green,'white',saving||!substituteTeacher) }}>
              {saving?'⏳ Saving...':'✅ Confirm Substitute'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ADMIN PIN MODAL
// ══════════════════════════════════════════════════════════════
function AdminPinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const verify = () => {
    if (pin === ADMIN_PIN) onSuccess()
    else { setError('Incorrect PIN. Try again.'); setPin('') }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,22,40,0.75)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:16, padding:36, width:'100%', maxWidth:360, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
        <h2 style={{ fontSize:18, fontWeight:800, color:T.navy, margin:'0 0 6px' }}>Admin Access Required</h2>
        <p style={{ fontSize:13, color:T.muted, margin:'0 0 24px' }}>Timetable setup is restricted to administrators.</p>
        <input type="password" placeholder="Enter Admin PIN" value={pin}
          onChange={e=>{ setPin(e.target.value); setError('') }}
          onKeyDown={e=>e.key==='Enter'&&verify()}
          style={{ ...S.inp, textAlign:'center', fontSize:20, letterSpacing:8, marginBottom:12 }} autoFocus />
        {error && <div style={{ background:T.redLt, color:T.red, borderRadius:8, padding:'8px 12px', fontSize:13, fontWeight:600, marginBottom:12 }}>{error}</div>}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ ...S.btn(T.muted), flex:1 }}>Cancel</button>
          <button onClick={verify} style={{ ...S.btn(T.navy), flex:1 }}>🔓 Verify</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  EDIT ENTRY MODAL
// ══════════════════════════════════════════════════════════════
function EditEntryModal({ entry, staffList=[], onClose, onSaved }) {
  const [localStaff, setLocalStaff] = useState(staffList)
  const [form, setForm] = useState({
    class_name: entry.class_name||'', section: entry.section||'',
    day_name: entry.day_name||'Monday', period_name: entry.period_name||'',
    subject_name: entry.subject_name||'', teacher_name: entry.teacher_name||'', room_name: entry.room_name||'',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (staffList.length > 0) setLocalStaff(staffList)
    else staffDB.forTimetable().then(setLocalStaff)
  }, [staffList])

  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('timetable_entries').update({
        class_name:form.class_name, section:form.section||null, day_name:form.day_name,
        period_name:form.period_name, subject_name:form.subject_name||null,
        teacher_name:form.teacher_name||null, room_name:form.room_name||null,
      }).eq('id', entry.id)
      if (error) throw error
      onSaved(); onClose()
    } catch(err) { alert('Error: '+err.message) }
    finally { setSaving(false) }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,22,40,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:540, boxShadow:'0 24px 80px rgba(0,0,0,0.4)', overflow:'hidden' }}>
        <div style={{ background:`linear-gradient(135deg,${T.navy},${T.navyLt})`, padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, color:T.gold, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase' }}>Edit Entry</div>
            <div style={{ fontSize:18, fontWeight:700, color:'white', marginTop:4 }}>{entry.class_name} {entry.section?`· ${entry.section}`:''}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:2 }}>{entry.day_name} · {entry.period_name}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'white', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ padding:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div><label style={S.lbl}>Batch / Class *</label><Inp value={form.class_name} onChange={e=>set('class_name',e.target.value)} placeholder="Achiever" /></div>
            <div><label style={S.lbl}>Section</label><Inp value={form.section} onChange={e=>set('section',e.target.value)} placeholder="A / B / Combined" /></div>
            <div><label style={S.lbl}>Day *</label><Sel value={form.day_name} onChange={e=>set('day_name',e.target.value)}>{DAYS.map(d=><option key={d} value={d}>{d}</option>)}</Sel></div>
            <div><label style={S.lbl}>Period / Time *</label><Inp value={form.period_name} onChange={e=>set('period_name',e.target.value)} placeholder="7:00–7:45 AM" /></div>
            <div><label style={S.lbl}>Subject *</label><Inp value={form.subject_name} onChange={e=>set('subject_name',e.target.value)} placeholder="Mathematics" /></div>
            <div>
              <label style={S.lbl}>Teacher</label>
              <select value={form.teacher_name} onChange={e=>set('teacher_name',e.target.value)} style={S.inp}>
                <option value="">— Select Teacher —</option>
                {localStaff.map(s=><option key={s.id} value={s.name}>{s.name}{s.designation?` — ${s.designation}`:''}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:'1/-1' }}><label style={S.lbl}>Room</label><Inp value={form.room_name} onChange={e=>set('room_name',e.target.value)} placeholder="Room 101" /></div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            <button type="button" onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, fontWeight:600, cursor:'pointer', fontSize:13, color:T.ink }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex:2, ...S.btn(saving?T.muted:T.navy,'white',saving) }}>{saving?'⏳ Saving...':'💾 Update Entry'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  INLINE EDIT CELL
// ══════════════════════════════════════════════════════════════
function EditCell({ value, onSave, type='text', options=[] }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)
  useEffect(()=>{ if(editing&&ref.current) ref.current.focus() },[editing])
  useEffect(()=>{ setVal(value) },[value])
  const commit = async () => { setEditing(false); if(val!==value){ setSaving(true); await onSave(val); setSaving(false) } }
  const cancel = () => { setEditing(false); setVal(value) }
  if (!editing) return (
    <span onClick={()=>setEditing(true)} style={{ cursor:'text', display:'block', minHeight:22, padding:'3px 6px', borderRadius:5, color:value?T.ink:T.muted, fontSize:13, border:'1px solid transparent', position:'relative' }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.background='#f1f5f9' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='transparent' }}>
      {value||<span style={{color:T.muted,fontSize:11,fontStyle:'italic'}}>—</span>}
      {saving&&<span style={{position:'absolute',right:2,top:2,fontSize:9,color:T.cyan}}>●</span>}
    </span>
  )
  if (type==='select') return (
    <select ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit}
      onKeyDown={e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') cancel() }}
      style={{ width:'100%', padding:'4px 6px', borderRadius:5, border:`1.5px solid ${T.navy}`, fontSize:13, outline:'none', fontFamily:'inherit', background:T.white }}>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit}
      onKeyDown={e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') cancel() }}
      style={{ width:'100%', padding:'4px 6px', borderRadius:5, border:`1.5px solid ${T.navy}`, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}
    />
  )
}

// ══════════════════════════════════════════════════════════════
//  MONITOR TAB
// ══════════════════════════════════════════════════════════════
function MonitorPanel({ staffList, entries }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [attendanceData, setAttendanceData] = useState([])
  const [substitutionData, setSubstitutionData] = useState([])
  const [loading, setLoading] = useState(false)

  const loadMonitorData = useCallback(async () => {
    setLoading(true)
    const from = `${month}-01`
    const to   = `${month}-31`

    const [{ data: att }, { data: subs }] = await Promise.all([
      supabase.from('staff_attendance')
        .select('staff_id, status, date')
        .gte('date', from).lte('date', to),
      supabase.from('timetable_substitutions')
        .select('*')
        .gte('sub_date', from).lte('sub_date', to),
    ])
    setAttendanceData(att || [])
    setSubstitutionData(subs || [])
    setLoading(false)
  }, [month])

  useEffect(() => { loadMonitorData() }, [loadMonitorData])

  // Build teacher stats
  const teacherStats = useMemo(() => {
    const teachingStaff = staffList.filter(s => s.role === 'Teaching' || s.role === 'Teaching + Admin')
    return teachingStaff.map(s => {
      const records = attendanceData.filter(a => String(a.staff_id) === String(s.id))
      const total   = records.length
      const absent  = records.filter(a => a.status === 'Absent').length
      const present = records.filter(a => a.status === 'Present').length
      const late    = records.filter(a => a.status === 'Late').length
      const leave   = records.filter(a => a.status === 'Leave' || a.status === 'Half Day').length
      const pct     = total > 0 ? Math.round((present / total) * 100) : null
      const timesOriginal  = substitutionData.filter(sub => sub.original_teacher === s.name).length
      const timesSubstitute = substitutionData.filter(sub => sub.substitute_teacher === s.name).length
      const assignedPeriods = entries.filter(e => e.teacher_name === s.name).length
      return { ...s, total, absent, present, late, leave, pct, timesOriginal, timesSubstitute, assignedPeriods }
    })
  }, [staffList, attendanceData, substitutionData, entries])

  const mostAbsent      = [...teacherStats].sort((a,b) => b.absent - a.absent).slice(0,5)
  const mostSubstituted = [...teacherStats].sort((a,b) => b.timesOriginal - a.timesOriginal).slice(0,5)
  const leaderboard     = [...teacherStats].filter(t => t.total > 0).sort((a,b) => (b.pct||0) - (a.pct||0))
  const uncoveredSubs   = substitutionData.filter(s => s.status === 'Uncovered' || !s.substitute_teacher)

  const totalAbsences   = attendanceData.filter(a => a.status === 'Absent').length
  const coverageRate    = substitutionData.length > 0
    ? Math.round((substitutionData.filter(s=>s.status==='Covered').length / substitutionData.length) * 100)
    : 100

  return (
    <div>
      {/* Month selector */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <label style={S.lbl}>Monitor Month</label>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
            style={{ ...S.inp, width:180 }} />
        </div>
        <div style={{ paddingTop:18 }}>
          <button onClick={loadMonitorData} style={{ ...S.btn(T.navy), padding:'9px 20px' }}>🔄 Refresh</button>
        </div>
        {loading && <div style={{ paddingTop:18, color:T.muted, fontSize:13 }}>⏳ Loading…</div>}
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Absences',  val:totalAbsences,              icon:'🔴', color:T.red },
          { label:'Substitutions',   val:substitutionData.length,    icon:'🔄', color:T.amber },
          { label:'Uncovered Gaps',  val:uncoveredSubs.length,       icon:'⚠️', color:uncoveredSubs.length?T.red:T.green },
          { label:'Coverage Rate',   val:coverageRate+'%',           icon:'✅', color:coverageRate>80?T.green:T.amber },
          { label:'Teachers Tracked',val:teacherStats.filter(t=>t.total>0).length+'/'+teacherStats.length, icon:'👨‍🏫', color:T.navy },
        ].map(k => (
          <div key={k.label} style={{ background:'white', borderRadius:12, padding:'16px 18px', borderLeft:`4px solid ${k.color}`, boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{k.icon}</div>
            <div style={{ fontSize:10, fontWeight:700, color:k.color, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>{k.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:k.color, lineHeight:1 }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Most Absent */}
        <div style={{ background:'white', borderRadius:14, padding:20, border:`1px solid ${T.border}`, boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.red, marginBottom:4 }}>🔴 Most Absent Teachers</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:16 }}>This month · sorted by absence days</div>
          {mostAbsent.filter(t=>t.total>0).length === 0
            ? <div style={{ color:T.muted, fontSize:13, padding:'20px 0', textAlign:'center' }}>No attendance data for {month}</div>
            : mostAbsent.filter(t=>t.total>0).map((t,i) => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:i<4?`1px solid ${T.border}`:'none' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:i===0?T.red:i===1?T.amber:'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:i<2?'white':T.muted, flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:T.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                <div style={{ fontSize:11, color:T.muted }}>{t.absent} absent · {t.present} present · {t.late} late</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:18, fontWeight:800, color:t.absent>5?T.red:t.absent>2?T.amber:T.green }}>{t.absent}</div>
                <div style={{ fontSize:10, color:T.muted }}>days</div>
              </div>
            </div>
          ))}
        </div>

        {/* Most Substituted */}
        <div style={{ background:'white', borderRadius:14, padding:20, border:`1px solid ${T.border}`, boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.amber, marginBottom:4 }}>🔄 Most Substituted</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:16 }}>Teachers who needed replacement most</div>
          {mostSubstituted.filter(t=>t.timesOriginal>0).length === 0
            ? <div style={{ color:T.muted, fontSize:13, padding:'20px 0', textAlign:'center' }}>No substitutions recorded for {month}</div>
            : mostSubstituted.filter(t=>t.timesOriginal>0).map((t,i) => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:i<4?`1px solid ${T.border}`:'none' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:i===0?T.amber:'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:i===0?'white':T.muted, flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:T.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                <div style={{ fontSize:11, color:T.muted }}>{t.assignedPeriods} periods/week assigned</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:18, fontWeight:800, color:T.amber }}>{t.timesOriginal}</div>
                <div style={{ fontSize:10, color:T.muted }}>times</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ background:'white', borderRadius:14, padding:20, border:`1px solid ${T.border}`, boxShadow:'0 2px 8px rgba(0,0,0,.05)', marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:800, color:T.navy, marginBottom:4 }}>🏆 Attendance Leaderboard</div>
        <div style={{ fontSize:12, color:T.muted, marginBottom:16 }}>All teaching staff · ranked by attendance % this month</div>
        {leaderboard.length === 0
          ? <div style={{ color:T.muted, fontSize:13, padding:'20px 0', textAlign:'center' }}>No attendance data yet for {month}. Data will appear once HR module marks attendance.</div>
          : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:T.navy }}>
                  {['Rank','Teacher','Present','Absent','Late','Leave','Total','Attendance %','Subs Covered'].map(h=>(
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', color:'white', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((t,i) => {
                  const pctColor = t.pct>=90?T.green:t.pct>=75?T.amber:T.red
                  return (
                    <tr key={t.id} style={{ background:i%2===0?'white':T.surface, borderBottom:`1px solid ${T.border}` }}>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ width:26, height:26, borderRadius:'50%', background:i===0?T.gold:i===1?'#94a3b8':i===2?'#cd7f32':'#f1f5f9', color:i<3?'white':T.muted, display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12 }}>{i+1}</span>
                      </td>
                      <td style={{ padding:'10px 12px', fontWeight:600, color:T.ink }}>{t.name}</td>
                      <td style={{ padding:'10px 12px', color:T.green, fontWeight:600 }}>{t.present}</td>
                      <td style={{ padding:'10px 12px', color:t.absent>0?T.red:T.muted, fontWeight:t.absent>0?700:400 }}>{t.absent}</td>
                      <td style={{ padding:'10px 12px', color:t.late>0?T.amber:T.muted }}>{t.late}</td>
                      <td style={{ padding:'10px 12px', color:T.muted }}>{t.leave}</td>
                      <td style={{ padding:'10px 12px', color:T.muted }}>{t.total}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ flex:1, height:6, background:'#e2e8f0', borderRadius:3, minWidth:60 }}>
                            <div style={{ width:`${t.pct}%`, height:'100%', background:pctColor, borderRadius:3, transition:'width .3s' }}/>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:pctColor, minWidth:36 }}>{t.pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px', color:T.cyan, fontWeight:600 }}>{t.timesSubstitute}x</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Uncovered gaps */}
      {uncoveredSubs.length > 0 && (
        <div style={{ background:T.redLt, borderRadius:14, padding:20, border:`1px solid ${T.red}44` }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.red, marginBottom:12 }}>⚠️ Uncovered Periods ({uncoveredSubs.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {uncoveredSubs.map(s => (
              <div key={s.id} style={{ background:'white', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:12, fontSize:13 }}>
                <span style={{ color:T.red, fontWeight:700 }}>{fmt(s.sub_date)}</span>
                <span style={{ color:T.ink }}>{s.class_name}</span>
                <span style={{ color:T.muted }}>·</span>
                <span style={{ color:T.muted }}>{s.period_name}</span>
                <span style={{ color:T.muted }}>·</span>
                <span style={{ color:T.ink }}>Original: {s.original_teacher}</span>
                <span style={{ marginLeft:'auto', background:T.red, color:'white', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700 }}>NO SUB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  WEEKLY VIEW
// ══════════════════════════════════════════════════════════════
function WeeklyView({ entries, staffList, weekStart, showToast, onSubstituteSaved }) {
  const [substitutions, setSubstitutions] = useState([])
  const [subModal, setSubModal] = useState(null) // { entry, date }
  const weekDates = getWeekDates(weekStart)
  const today = formatDate(new Date())

  const loadSubs = useCallback(async () => {
    const from = formatDate(weekStart)
    const to   = formatDate(addDays(weekStart, 5))
    const { data } = await supabase.from('timetable_substitutions')
      .select('*').gte('sub_date', from).lte('sub_date', to)
    setSubstitutions(data || [])
  }, [weekStart])

  useEffect(() => { loadSubs() }, [loadSubs])

  const allPeriods = [...new Set(entries.map(e => e.period_name).filter(Boolean))].sort()
  const allBatches = [...new Set(entries.map(e => e.class_name).filter(Boolean))].sort()

  const getSub = (date, className, periodName) =>
    substitutions.find(s => s.sub_date === date && s.class_name === className && s.period_name === periodName)

  return (
    <div>
      {subModal && (
        <SubstituteModal
          entry={subModal.entry}
          date={subModal.date}
          staffList={staffList}
          allEntries={entries}
          onClose={() => setSubModal(null)}
          onSaved={() => { loadSubs(); onSubstituteSaved() }}
          showToast={showToast}
        />
      )}

      {weekDates.map(({ day, date }) => {
        const dayEntries = entries.filter(e => e.day_name === day)
        const isToday = date === today
        const periods = [...new Set(dayEntries.map(e => e.period_name).filter(Boolean))].sort()

        return (
          <div key={day} style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:4, height:28, background:isToday?T.gold:T.navy, borderRadius:2 }}/>
              <span style={{ fontSize:16, fontWeight:800, color:isToday?T.goldDim:T.navy }}>{day}</span>
              <span style={{ fontSize:12, color:T.muted, background:T.surface, padding:'2px 10px', borderRadius:999 }}>{fmt(date)}</span>
              {isToday && <span style={{ background:T.gold, color:T.navy, padding:'2px 8px', borderRadius:999, fontSize:11, fontWeight:800 }}>TODAY</span>}
              <span style={{ fontSize:11, color:T.muted }}>{dayEntries.length} classes</span>
            </div>
            <div style={{ background:'white', borderRadius:12, overflow:'hidden', border:`1px solid ${isToday?T.gold+'55':T.border}`, boxShadow:isToday?`0 4px 20px rgba(240,165,0,0.12)`:'0 2px 8px rgba(0,0,0,.05)' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:isToday?T.navy:T.navyMid }}>
                      <th style={{ padding:'10px 16px', color:isToday?T.gold:'rgba(255,255,255,0.8)', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.07em', minWidth:110, textAlign:'left', borderRight:`1px solid rgba(255,255,255,0.08)` }}>Time</th>
                      {allBatches.map(b => { const bs = getBatchStyle(b); return (
                        <th key={b} style={{ padding:'10px 12px', minWidth:130, textAlign:'center' }}>
                          <span style={{ background:bs.bg, color:bs.text, padding:'3px 10px', borderRadius:999, border:`1px solid ${bs.border}`, fontSize:11, fontWeight:700 }}>{b}</span>
                        </th>
                      )})}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.length === 0 && (
                      <tr><td colSpan={allBatches.length+1} style={{ padding:24, textAlign:'center', color:T.muted, fontSize:13 }}>No classes for {day}</td></tr>
                    )}
                    {periods.map((period, pi) => {
                      const pEntries = dayEntries.filter(e => e.period_name === period)
                      const breakEntry = pEntries.find(e => BREAK_TYPES.includes((e.subject_name||'').toUpperCase().trim()))
                      if (breakEntry) return (
                        <tr key={period} style={{ background:'#fffbeb', borderBottom:`1px solid ${T.border}` }}>
                          <td style={{ padding:'10px 16px', fontWeight:700, color:T.goldDim, fontSize:12, borderRight:`1px solid ${T.border}` }}>{period}</td>
                          <td colSpan={allBatches.length} style={{ padding:'10px', textAlign:'center' }}>
                            <span style={{ fontSize:12, fontWeight:800, color:T.goldDim, letterSpacing:'.1em', textTransform:'uppercase' }}>☕ {breakEntry.subject_name}</span>
                          </td>
                        </tr>
                      )
                      return (
                        <tr key={period} style={{ background:pi%2===0?'white':T.surface, borderBottom:`1px solid ${T.border}` }}>
                          <td style={{ padding:'8px 16px', fontWeight:700, color:T.ink, fontSize:12, borderRight:`1px solid ${T.border}`, whiteSpace:'nowrap' }}>{period}</td>
                          {allBatches.map(batch => {
                            const cell = pEntries.filter(e => e.class_name === batch || (e.class_name||'').split(' ')[0] === batch)
                            const bs = getBatchStyle(batch)
                            return (
                              <td key={batch} style={{ padding:'6px 8px', verticalAlign:'top', borderRight:`1px solid ${T.border}` }}>
                                {cell.map(e => {
                                  const sub = getSub(date, e.class_name, e.period_name)
                                  return (
                                    <div key={e.id} style={{ background:sub?T.greenLt:bs.bg, border:`1px solid ${sub?T.green:bs.border}`, borderRadius:8, padding:'7px 9px', cursor:'pointer', marginBottom:2 }}
                                      onClick={() => setSubModal({ entry:e, date })}>
                                      <div style={{ fontWeight:700, color:sub?T.green:bs.text, fontSize:12, marginBottom:2 }}>{e.subject_name}</div>
                                      {sub ? (
                                        <div style={{ fontSize:11 }}>
                                          <span style={{ color:T.muted, textDecoration:'line-through' }}>{e.teacher_name}</span>
                                          <span style={{ color:T.green, fontWeight:700, marginLeft:4 }}>→ {sub.substitute_teacher}</span>
                                          <span style={{ marginLeft:4, background:T.green, color:'white', padding:'1px 5px', borderRadius:3, fontSize:9, fontWeight:700 }}>SUB</span>
                                        </div>
                                      ) : (
                                        e.teacher_name && <div style={{ color:T.muted, fontSize:11 }}>👤 {e.teacher_name}</div>
                                      )}
                                      {e.room_name && <div style={{ color:T.muted, fontSize:10 }}>📍 {e.room_name}</div>}
                                      <div style={{ fontSize:9, color:T.cyan, marginTop:3, opacity:.7 }}>click to substitute</div>
                                    </div>
                                  )
                                })}
                                {!cell.length && <span style={{ color:'#cbd5e1', fontSize:11 }}>—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ADMIN SETUP PANEL
// ══════════════════════════════════════════════════════════════
function AdminSetupPanel({ staffList, entries, onRefresh, showToast }) {
  const [tab, setTab] = useState('batch')
  const [batchForm, setBatchForm] = useState({ class_name:'', section:'', day_name:'Monday' })
  const [slots, setSlots] = useState([{ period_name:'', subject_name:'', teacher_name:'', room_name:'' }])
  const [saving, setSaving] = useState(false)
  const [copyFrom, setCopyFrom] = useState('Monday')
  const [copyTo, setCopyTo] = useState([])
  const [copying, setCopying] = useState(false)
  const [delDay, setDelDay] = useState('')
  const [delBatch, setDelBatch] = useState('')
  const [swapA, setSwapA] = useState('')
  const [swapB, setSwapB] = useState('')
  const [swapping, setSwapping] = useState(false)

  const uniqueClasses  = [...new Set(entries.map(e=>e.class_name).filter(Boolean))].sort()
  const uniquePeriods  = [...new Set(entries.map(e=>e.period_name).filter(Boolean))].sort()

  const addSlot    = () => setSlots(s=>[...s,{ period_name:'', subject_name:'', teacher_name:'', room_name:'' }])
  const removeSlot = i  => setSlots(s=>s.filter((_,idx)=>idx!==i))
  const updateSlot = (i,k,v) => setSlots(s=>s.map((sl,idx)=>idx===i?{...sl,[k]:v}:sl))

  const handleBatchSave = async () => {
    if (!batchForm.class_name||!batchForm.day_name) { alert('Batch name and day required'); return }
    const valid = slots.filter(s=>s.period_name&&s.subject_name)
    if (!valid.length) { alert('At least one slot with period and subject required'); return }
    setSaving(true)
    const rows = valid.map(sl=>({ class_name:batchForm.class_name, section:batchForm.section||null, day_name:batchForm.day_name, period_name:sl.period_name, subject_name:sl.subject_name, teacher_name:sl.teacher_name||null, room_name:sl.room_name||null }))
    const { error } = await supabase.from('timetable_entries').insert(rows)
    if (error) showToast('❌ Error: '+error.message,'error')
    else { showToast(`✅ ${rows.length} entries added for ${batchForm.class_name} — ${batchForm.day_name}`); onRefresh(); setSlots([{ period_name:'', subject_name:'', teacher_name:'', room_name:'' }]) }
    setSaving(false)
  }

  const handleCopyDay = async () => {
    if (!copyTo.length) { alert('Select at least one target day'); return }
    const source = entries.filter(e=>e.day_name===copyFrom)
    if (!source.length) { alert('No entries found for '+copyFrom); return }
    setCopying(true)
    let total = 0
    for (const day of copyTo) {
      const { error: delErr } = await supabase.from('timetable_entries').delete().eq('day_name', day)
      if (delErr) { showToast(`❌ Failed to clear ${day}: ${delErr.message}`, 'error'); continue }
      const rows = source.map(e=>({ class_name:e.class_name, section:e.section, day_name:day, period_name:e.period_name, subject_name:e.subject_name, teacher_name:e.teacher_name, room_name:e.room_name }))
      const { error: insErr } = await supabase.from('timetable_entries').insert(rows)
      if (insErr) showToast(`❌ Insert failed for ${day}: ${insErr.message}`, 'error')
      else total += rows.length
    }
    showToast(`✅ Copied ${total} entries to ${copyTo.join(', ')}`)
    onRefresh(); setCopying(false)
  }

  const handleSwap = async () => {
    if (!swapA||!swapB||swapA===swapB) { alert('Select two different periods'); return }
    setSwapping(true)
    const TEMP = `__SWAP_${Date.now()}__`
    const { error: e1 } = await supabase.from('timetable_entries').update({ period_name:TEMP }).eq('period_name', swapA)
    if (e1) { showToast('❌ Swap step 1 failed: '+e1.message, 'error'); setSwapping(false); return }
    const { error: e2 } = await supabase.from('timetable_entries').update({ period_name:swapA }).eq('period_name', swapB)
    if (e2) { showToast(`❌ Swap partially applied — fix "${TEMP}" manually`, 'error'); setSwapping(false); return }
    const { error: e3 } = await supabase.from('timetable_entries').update({ period_name:swapB }).eq('period_name', TEMP)
    if (e3) { showToast(`❌ Swap step 3 failed — fix "${TEMP}" manually`, 'error'); setSwapping(false); return }
    showToast(`✅ Swapped ${swapA} ↔ ${swapB}`)
    onRefresh(); setSwapping(false)
  }

  const handleBulkDelete = async () => {
    if (!delDay&&!delBatch) { alert('Select day or batch'); return }
    const count = entries.filter(e=>(!delDay||e.day_name===delDay)&&(!delBatch||e.class_name===delBatch)).length
    if (!window.confirm(`Delete ${count} entries?`)) return
    let query = supabase.from('timetable_entries').delete()
    if (delDay)   query = query.eq('day_name', delDay)
    if (delBatch) query = query.eq('class_name', delBatch)
    const { error } = await query
    if (error) showToast('❌ '+error.message,'error')
    else { showToast('🗑 Deleted'); onRefresh() }
  }

  const tabs = [
    { id:'batch',   label:'📝 Batch Entry' },
    { id:'copy',    label:'📋 Copy Day' },
    { id:'swap',    label:'🔄 Swap Periods' },
    { id:'delete',  label:'🗑 Bulk Delete' },
  ]

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'10px 16px', background:'linear-gradient(135deg,#fef3c7,#fef9c3)', borderRadius:10, border:`1px solid ${T.gold}`, width:'fit-content' }}>
        <span style={{ fontSize:18 }}>🔓</span>
        <span style={{ fontSize:13, fontWeight:700, color:T.goldDim }}>Admin Timetable Setup — Full Access Granted</span>
      </div>

      <div style={{ display:'flex', gap:4, borderBottom:`2px solid ${T.border}`, marginBottom:22, flexWrap:'wrap' }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'8px 16px', border:'none', borderBottom:tab===t.id?`3px solid ${T.navy}`:'3px solid transparent', background:'none', cursor:'pointer', fontSize:12, fontWeight:tab===t.id?700:500, color:tab===t.id?T.navy:T.muted, marginBottom:-2, whiteSpace:'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {tab==='batch' && (
        <div style={{ background:'white', borderRadius:14, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,.07)', border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.navy, marginBottom:4 }}>📝 Add Multiple Slots for a Batch</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:20 }}>Set batch + day once, then add all periods at once.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20, padding:16, background:T.surface, borderRadius:10, border:`1px solid ${T.border}` }}>
            <div>
              <label style={S.lbl}>Batch / Class *</label>
              <input value={batchForm.class_name} onChange={e=>setBatchForm(f=>({...f,class_name:e.target.value}))} placeholder="Achiever / Leader..." style={S.inp} list="bl" />
              <datalist id="bl">{uniqueClasses.map(c=><option key={c} value={c}/>)}</datalist>
            </div>
            <div><label style={S.lbl}>Section</label><Inp value={batchForm.section} onChange={e=>setBatchForm(f=>({...f,section:e.target.value}))} placeholder="A / B / Combined" /></div>
            <div><label style={S.lbl}>Day *</label><Sel value={batchForm.day_name} onChange={e=>setBatchForm(f=>({...f,day_name:e.target.value}))}>{DAYS.map(d=><option key={d} value={d}>{d}</option>)}</Sel></div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.navy }}>⏰ Time Slots ({slots.length})</div>
              <button onClick={addSlot} style={{ ...S.btnSm('#16a34a') }}>＋ Add Slot</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {slots.map((sl,i)=>(
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr 1.8fr 0.7fr auto', gap:10, padding:12, background:T.surface, borderRadius:8, border:`1px solid ${T.border}`, alignItems:'end' }}>
                  <div>{i===0&&<label style={S.lbl}>Period / Time *</label>}<Inp value={sl.period_name} onChange={e=>updateSlot(i,'period_name',e.target.value)} placeholder="7:00–7:45 AM" /></div>
                  <div>{i===0&&<label style={S.lbl}>Subject *</label>}<Inp value={sl.subject_name} onChange={e=>updateSlot(i,'subject_name',e.target.value)} placeholder="Mathematics" /></div>
                  <div>
                    {i===0&&<label style={S.lbl}>Teacher <span style={{ fontWeight:400, color:T.cyan }}>({staffList.length} staff)</span></label>}
                    <select value={sl.teacher_name} onChange={e=>updateSlot(i,'teacher_name',e.target.value)} style={S.inp}>
                      <option value="">— Select Teacher —</option>
                      {staffList.map(s=><option key={s.id} value={s.name}>{s.name}{s.designation?` (${s.designation})`:''}</option>)}
                    </select>
                  </div>
                  <div>{i===0&&<label style={S.lbl}>Room</label>}<Inp value={sl.room_name} onChange={e=>updateSlot(i,'room_name',e.target.value)} placeholder="101" /></div>
                  <div style={{ paddingTop:i===0?20:0 }}><button onClick={()=>removeSlot(i)} style={{ ...S.btnSm(T.red), padding:'8px 10px' }}>✕</button></div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleBatchSave} disabled={saving} style={{ ...S.btn(saving?T.muted:T.navy,'white',saving), padding:'11px 28px' }}>{saving?'⏳ Saving…':'✅ Save All Slots'}</button>
            <button onClick={addSlot} style={{ padding:'11px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, fontWeight:600, cursor:'pointer', fontSize:13, color:T.navy }}>＋ Add Another Slot</button>
          </div>
        </div>
      )}

      {tab==='copy' && (
        <div style={{ background:'white', borderRadius:14, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,.07)', border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.navy, marginBottom:4 }}>📋 Copy Day Schedule</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:20 }}>Duplicate an entire day to other days. Target day entries will be replaced.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:24, alignItems:'start' }}>
            <div>
              <label style={S.lbl}>Copy From *</label>
              <Sel value={copyFrom} onChange={e=>setCopyFrom(e.target.value)}>
                {DAYS.map(d=><option key={d} value={d}>{d} ({entries.filter(e=>e.day_name===d).length} entries)</option>)}
              </Sel>
              <div style={{ marginTop:8, padding:'10px 12px', background:'#f0f9ff', borderRadius:8, fontSize:12, color:'#0369a1' }}>
                {entries.filter(e=>e.day_name===copyFrom).length} entries will be copied
              </div>
            </div>
            <div>
              <label style={S.lbl}>Copy To (select multiple) *</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {DAYS.filter(d=>d!==copyFrom).map(d=>(
                  <label key={d} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:`1.5px solid ${copyTo.includes(d)?T.navy:T.border}`, background:copyTo.includes(d)?'#eff6ff':T.white, cursor:'pointer', fontSize:13, fontWeight:copyTo.includes(d)?700:400, color:copyTo.includes(d)?T.navy:T.muted }}>
                    <input type="checkbox" checked={copyTo.includes(d)} onChange={e=>setCopyTo(prev=>e.target.checked?[...prev,d]:prev.filter(x=>x!==d))} style={{ display:'none' }} />
                    {copyTo.includes(d)?'✓ ':''}{d}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop:20, padding:'12px 16px', background:'#fffbeb', borderRadius:8, border:`1px solid ${T.gold}`, fontSize:12, color:T.goldDim, fontWeight:600, marginBottom:20 }}>
            ⚠️ Warning: All existing entries for selected target days will be deleted and replaced.
          </div>
          <button onClick={handleCopyDay} disabled={copying||!copyTo.length} style={{ ...S.btn(copying?T.muted:T.navy,'white',copying||!copyTo.length), padding:'11px 28px' }}>
            {copying?'⏳ Copying…':`📋 Copy to ${copyTo.length} day${copyTo.length!==1?'s':''}`}
          </button>
        </div>
      )}

      {tab==='swap' && (
        <div style={{ background:'white', borderRadius:14, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,.07)', border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.navy, marginBottom:4 }}>🔄 Swap Two Periods</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:20 }}>Swaps all entries across all batches between two time slots globally.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:16, alignItems:'end', maxWidth:600 }}>
            <div><label style={S.lbl}>Period A *</label><Sel value={swapA} onChange={e=>setSwapA(e.target.value)}><option value="">— Select Period —</option>{uniquePeriods.map(p=><option key={p} value={p}>{p}</option>)}</Sel></div>
            <div style={{ textAlign:'center', paddingBottom:10, fontSize:22, color:T.muted }}>⇄</div>
            <div><label style={S.lbl}>Period B *</label><Sel value={swapB} onChange={e=>setSwapB(e.target.value)}><option value="">— Select Period —</option>{uniquePeriods.map(p=><option key={p} value={p}>{p}</option>)}</Sel></div>
          </div>
          {swapA&&swapB&&swapA!==swapB&&(
            <div style={{ marginTop:16, padding:'12px 16px', background:T.surface, borderRadius:8, border:`1px solid ${T.border}`, fontSize:12, color:T.muted }}>
              Will swap <strong>{entries.filter(e=>e.period_name===swapA).length}</strong> entries at <strong>{swapA}</strong> ↔ <strong>{entries.filter(e=>e.period_name===swapB).length}</strong> entries at <strong>{swapB}</strong>
            </div>
          )}
          <button onClick={handleSwap} disabled={swapping||!swapA||!swapB||swapA===swapB} style={{ ...S.btn(swapping?T.muted:T.navy,'white',swapping||!swapA||!swapB||swapA===swapB), padding:'11px 28px', marginTop:20 }}>
            {swapping?'⏳ Swapping…':'🔄 Swap Periods'}
          </button>
        </div>
      )}

      {tab==='delete' && (
        <div style={{ background:'white', borderRadius:14, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,.07)', border:`1.5px solid ${T.red}44` }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.red, marginBottom:4 }}>🗑 Bulk Delete Entries</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:20 }}>Delete all entries for a specific day or batch. Cannot be undone.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:500, marginBottom:16 }}>
            <div><label style={S.lbl}>Delete by Day</label><Sel value={delDay} onChange={e=>setDelDay(e.target.value)}><option value="">All Days</option>{DAYS.map(d=><option key={d} value={d}>{d} ({entries.filter(e=>e.day_name===d).length})</option>)}</Sel></div>
            <div><label style={S.lbl}>Filter by Batch (optional)</label><Sel value={delBatch} onChange={e=>setDelBatch(e.target.value)}><option value="">All Batches</option>{uniqueClasses.map(c=><option key={c} value={c}>{c}</option>)}</Sel></div>
          </div>
          {(delDay||delBatch)&&(
            <div style={{ padding:'12px 16px', background:T.redLt, borderRadius:8, fontSize:12, color:T.red, fontWeight:600, marginBottom:16 }}>
              Will delete: {entries.filter(e=>(!delDay||e.day_name===delDay)&&(!delBatch||e.class_name===delBatch)).length} entries
            </div>
          )}
          <button onClick={handleBulkDelete} style={{ ...S.btn(T.red), padding:'11px 24px' }}>🗑 Delete Selected Entries</button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function Timetable() {
  const [entries,       setEntries]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [showForm,      setShowForm]      = useState(false)
  const [search,        setSearch]        = useState('')
  const [dayFilter,     setDayFilter]     = useState('All')
  const [classFilter,   setClassFilter]   = useState('All')
  const [teacherFilter, setTeacherFilter] = useState('All')
  const [viewMode,      setViewMode]      = useState('week')
  const [form,          setForm]          = useState(emptyForm)
  const [deleteId,      setDeleteId]      = useState(null)
  const [savingEdit,    setSavingEdit]    = useState(false)
  const [toast,         setToast]         = useState(null)
  const [conflicts,     setConflicts]     = useState([])
  const [showConflicts, setShowConflicts] = useState(false)
  const [selectedIds,   setSelectedIds]   = useState(new Set())
  const [bulkMode,      setBulkMode]      = useState(false)
  const [staffList,     setStaffList]     = useState([])
  const [editingEntry,  setEditingEntry]  = useState(null)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showPinModal,  setShowPinModal]  = useState(false)
  const [weekStart,     setWeekStart]     = useState(getWeekStart())
  const searchRef = useRef(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }

  const loadData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('timetable_entries').select('*').order('created_at',{ascending:false})
    if (!error) { setEntries(data||[]); setConflicts(findConflicts(data||[])) }
    else console.error('Timetable error:', error)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    staffDB.forTimetable().then(data => setStaffList(data))
  }, [])

  useEffect(()=>{
    const h = e => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
      if ((e.ctrlKey||e.metaKey)&&e.key==='f') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.ctrlKey||e.metaKey)&&e.key==='n') { e.preventDefault(); setShowForm(true) }
      if (e.key==='Escape') { setShowForm(false); setDeleteId(null); setEditingEntry(null) }
    }
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h)
  },[])

  const handleAdd = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('timetable_entries').insert([form])
    if (error) showToast('Error: '+error.message,'error')
    else { setForm(emptyForm); setShowForm(false); loadData(); showToast('Entry added ✓') }
    setSaving(false)
  }

  const handleFieldSave = async (id,field,value) => {
    setSavingEdit(true)
    const { error } = await supabase.from('timetable_entries').update({[field]:value}).eq('id',id)
    if (error) showToast('Update failed','error')
    else { const u=entries.map(e=>e.id===id?{...e,[field]:value}:e); setEntries(u); setConflicts(findConflicts(u)); showToast('Saved ✓') }
    setSavingEdit(false)
  }

  const handleDelete = async id => {
    const { error } = await supabase.from('timetable_entries').delete().eq('id',id)
    if (error) showToast('Delete failed','error')
    else { setEntries(prev=>prev.filter(e=>e.id!==id)); showToast('Deleted'); setDeleteId(null) }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    const { error } = await supabase.from('timetable_entries').delete().in('id',ids)
    if (error) showToast('Bulk delete failed','error')
    else { setEntries(prev=>prev.filter(e=>!selectedIds.has(e.id))); setSelectedIds(new Set()); setBulkMode(false); showToast(`${ids.length} deleted`) }
  }

  const handleExportCSV = () => {
    const h=['Batch','Section','Day','Period','Subject','Teacher','Room']
    const rows=filtered.map(e=>[e.class_name,e.section||'',e.day_name,e.period_name,e.subject_name||'',e.teacher_name||'',e.room_name||''])
    const csv=[h,...rows].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`timetable_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url); showToast('CSV exported')
  }

  const dayOrder = {Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6,Sunday:7}

  const filtered = useMemo(()=>entries.filter(item=>{
    const q=search.toLowerCase()
    const s=[item.class_name,item.section,item.day_name,item.period_name,item.subject_name,item.teacher_name,item.room_name].map(v=>(v||'').toLowerCase()).some(v=>v.includes(q))
    return s&&(dayFilter==='All'||item.day_name===dayFilter)&&(classFilter==='All'||item.class_name===classFilter)&&(teacherFilter==='All'||item.teacher_name===teacherFilter)
  }).sort((a,b)=>{ const dd=(dayOrder[a.day_name]||9)-(dayOrder[b.day_name]||9); return dd!==0?dd:(a.period_name||'').localeCompare(b.period_name||'') })
  ,[entries,search,dayFilter,classFilter,teacherFilter])

  const uniqueClasses  = [...new Set(entries.map(e=>e.class_name).filter(Boolean))].sort()
  const uniqueTeachers = [...new Set(entries.map(e=>e.teacher_name).filter(Boolean))].sort()
  const todayName      = new Date().toLocaleDateString('en-US',{weekday:'long'})
  const todayEntries   = entries.filter(e=>e.day_name===todayName)

  const toggleSelect = id => { const n=new Set(selectedIds); if(n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n) }

  const teacherWorkload = useMemo(()=>{
    const d={}
    entries.forEach(e=>{ if(!e.teacher_name) return; if(!d[e.teacher_name]) d[e.teacher_name]={count:0,subjects:new Set(),days:new Set()}; d[e.teacher_name].count++; d[e.teacher_name].subjects.add(e.subject_name); d[e.teacher_name].days.add(e.day_name) })
    return Object.entries(d).map(([name,v])=>({name,...v,subjects:[...v.subjects],days:[...v.days]})).sort((a,b)=>b.count-a.count)
  },[entries])

  const weekLabel = `${fmt(formatDate(weekStart))} – ${fmt(formatDate(addDays(weekStart,5)))}`

  const viewTabs = [
    { id:'week',    label:'📅 Weekly' },
    { id:'table',   label:'☰ Table' },
    { id:'teacher', label:'👨‍🏫 Teachers' },
    { id:'monitor', label:'📊 Monitor' },
    { id:'admin',   label:'⚙️ Admin' },
  ]

  return (
    <div style={{ padding:'24px 28px', fontFamily:"'DM Sans','Segoe UI',sans-serif", background:'#f0f4f8', minHeight:'100vh', color:T.ink }}>

      {toast&&(
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, padding:'12px 20px', borderRadius:10, background:toast.type==='error'?T.red:T.navy, color:'white', fontWeight:600, fontSize:13, boxShadow:'0 8px 32px rgba(0,0,0,0.2)', maxWidth:360 }}>
          {toast.type==='error'?'⚠️':'✓'} {toast.msg}
        </div>
      )}

      {deleteId&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(10,22,40,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'white', borderRadius:16, padding:32, maxWidth:360, width:'90%', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize:36, textAlign:'center', marginBottom:12 }}>🗑️</div>
            <div style={{ fontWeight:700, fontSize:18, textAlign:'center', color:T.ink, marginBottom:8 }}>Delete Entry?</div>
            <div style={{ fontSize:13, color:T.muted, textAlign:'center', marginBottom:24 }}>This will permanently remove this timetable entry.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setDeleteId(null)} style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, fontWeight:600, cursor:'pointer', fontSize:13 }}>Cancel</button>
              <button onClick={()=>handleDelete(deleteId)} style={{ flex:1, ...S.btn(T.red) }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showPinModal&&<AdminPinModal onSuccess={()=>{ setAdminUnlocked(true); setShowPinModal(false); setViewMode('admin') }} onClose={()=>setShowPinModal(false)} />}
      {editingEntry&&<EditEntryModal entry={editingEntry} staffList={staffList} onClose={()=>setEditingEntry(null)} onSaved={()=>{ loadData(); setEditingEntry(null) }} />}

      {bulkMode&&selectedIds.size>0&&(
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:100, background:T.navy, color:'white', padding:'12px 24px', borderRadius:12, display:'flex', alignItems:'center', gap:16, boxShadow:'0 8px 32px rgba(0,0,0,.3)' }}>
          <span style={{ fontWeight:700, fontSize:13 }}>{selectedIds.size} selected</span>
          <button onClick={handleBulkDelete} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:T.red, color:'white', fontWeight:700, cursor:'pointer', fontSize:12 }}>🗑 Delete</button>
          <button onClick={()=>{ setBulkMode(false); setSelectedIds(new Set()) }} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid rgba(255,255,255,.3)', background:'transparent', color:'white', fontWeight:600, cursor:'pointer', fontSize:12 }}>Done</button>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background:`linear-gradient(135deg,${T.navy} 0%,${T.navyLt} 100%)`, borderRadius:16, padding:'22px 28px', marginBottom:22, color:'white', boxShadow:'0 4px 24px rgba(10,22,40,0.22)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:220, height:220, borderRadius:'50%', background:'rgba(240,165,0,0.07)' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14, position:'relative' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${T.gold},${T.amber})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🕒</div>
              <div>
                <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-.3px' }}>Timetable Manager</div>
                <div style={{ fontSize:12, opacity:.6, marginTop:1 }}>GNSI · {entries.length} master entries · {staffList.length} teachers</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
              <span style={{ background:'rgba(240,165,0,0.2)', color:T.gold, padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700 }}>📅 Today: {todayName}</span>
              <span style={{ background:'rgba(255,255,255,0.1)', color:'white', padding:'3px 10px', borderRadius:999, fontSize:11 }}>{todayEntries.length} classes today</span>
              <span style={{ background:'rgba(6,182,212,0.2)', color:'#67e8f9', padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600 }}>🔁 Recurring Mon–Sat</span>
              {conflicts.length>0&&<span style={{ background:T.red, color:'white', padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700, cursor:'pointer' }} onClick={()=>setShowConflicts(!showConflicts)}>⚠️ {conflicts.length} conflict{conflicts.length>1?'s':''}</span>}
              {savingEdit&&<span style={{ background:'rgba(6,182,212,0.2)', color:'#67e8f9', padding:'3px 10px', borderRadius:999, fontSize:11 }}>● Saving…</span>}
              {adminUnlocked&&<span style={{ background:'rgba(240,165,0,0.3)', color:T.gold, padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700 }}>🔓 Admin</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={handleExportCSV} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.1)', color:'white', fontWeight:600, cursor:'pointer', fontSize:12 }}>📥 CSV</button>
            <button onClick={()=>window.print()} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.1)', color:'white', fontWeight:600, cursor:'pointer', fontSize:12 }}>🖨️ Print</button>
            <button onClick={()=>setShowForm(f=>!f)} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:T.gold, color:T.navy, fontWeight:800, cursor:'pointer', fontSize:13 }}>
              {showForm?'✕ Cancel':'＋ Add Entry'}
            </button>
          </div>
        </div>
      </div>

      {showConflicts&&conflicts.length>0&&(
        <div style={{ background:T.redLt, border:`1px solid ${T.red}44`, borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ fontWeight:700, color:T.red, fontSize:14, marginBottom:8 }}>⚠️ Scheduling Conflicts</div>
          {conflicts.map((c,i)=>(
            <div key={i} style={{ fontSize:12, padding:'6px 10px', background:'white', borderRadius:6, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, background:T.amber, color:'white', fontWeight:700 }}>TEACHER</span>
              {c.message}
            </div>
          ))}
        </div>
      )}

      {/* STAT CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Master Entries', val:entries.length,        icon:'📋', color:T.navy },
          { label:'Batches',        val:uniqueClasses.length,  icon:'🏫', color:'#16a34a' },
          { label:'Teachers',       val:uniqueTeachers.length, icon:'👨‍🏫', color:T.purple },
          { label:'Today Classes',  val:todayEntries.length,   icon:'📅', color:T.goldDim },
          { label:'Conflicts',      val:conflicts.length,      icon:'⚠️', color:conflicts.length?T.red:'#16a34a' },
        ].map(s=>(
          <div key={s.label} style={{ background:'white', borderRadius:12, padding:'16px 18px', boxShadow:'0 2px 8px rgba(0,0,0,.05)', borderLeft:`4px solid ${s.color}` }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
            <div style={{ fontSize:10, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ADD FORM */}
      {showForm&&(
        <div style={{ background:'white', borderRadius:14, padding:24, marginBottom:20, boxShadow:'0 4px 20px rgba(0,0,0,.08)', border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:16, fontWeight:700, color:T.navy, marginBottom:18 }}>➕ New Timetable Entry</div>
          <form onSubmit={handleAdd}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
              {[{label:'Batch / Class *',key:'class_name',ph:'Achiever'},{label:'Section',key:'section',ph:'A / B / Combined'},{label:'Subject *',key:'subject_name',ph:'Mathematics'},{label:'Period / Time *',key:'period_name',ph:'7:00–7:45 AM'},{label:'Room',key:'room_name',ph:'Room 101'}].map(f=>(
                <div key={f.key}><label style={S.lbl}>{f.label}</label><Inp value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} placeholder={f.ph} /></div>
              ))}
              <div><label style={S.lbl}>Day *</label><Sel value={form.day_name} onChange={e=>setForm({...form,day_name:e.target.value})}>{DAYS.map(d=><option key={d} value={d}>{d}</option>)}</Sel></div>
              <div>
                <label style={S.lbl}>Teacher <span style={{ fontWeight:400, color:T.cyan }}>({staffList.length} staff)</span></label>
                <select value={form.teacher_name} onChange={e=>setForm(f=>({...f,teacher_name:e.target.value}))} style={S.inp}>
                  <option value="">— Select Teacher —</option>
                  {staffList.map(s=><option key={s.id} value={s.name}>{s.name}{s.designation?` (${s.designation})`:''}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop:16, display:'flex', gap:10 }}>
              <button type="submit" disabled={saving} style={{ ...S.btn(saving?T.muted:T.navy,'white',saving), padding:'10px 28px' }}>{saving?'⏳ Saving…':'✅ Save Entry'}</button>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'10px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, fontWeight:600, cursor:'pointer', fontSize:13, color:T.ink }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW TABS + FILTERS */}
      <div style={{ background:'white', borderRadius:12, padding:'14px 16px', marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
            {viewTabs.map(v=>(
              <button key={v.id} onClick={()=>{
                if (v.id==='admin') { if(adminUnlocked) setViewMode('admin'); else setShowPinModal(true) }
                else setViewMode(v.id)
              }} style={{
                padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
                background:viewMode===v.id?T.navy:v.id==='admin'?(adminUnlocked?'#f0fdf4':'#fef3c7'):T.surface,
                color:viewMode===v.id?'white':v.id==='admin'?(adminUnlocked?'#15803d':T.goldDim):T.muted,
                transition:'all .15s',
              }}>{v.label}{v.id==='admin'&&!adminUnlocked?' 🔐':''}</button>
            ))}
            {/* Week navigation — only for weekly view */}
            {viewMode==='week'&&(
              <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:8, padding:'4px 8px', background:T.surface, borderRadius:8, border:`1px solid ${T.border}` }}>
                <button onClick={()=>setWeekStart(w=>addDays(w,-7))} style={{ border:'none', background:'none', cursor:'pointer', fontSize:14, color:T.navy, padding:'2px 6px' }}>‹</button>
                <span style={{ fontSize:12, fontWeight:600, color:T.navy, whiteSpace:'nowrap' }}>{weekLabel}</span>
                <button onClick={()=>setWeekStart(w=>addDays(w,7))} style={{ border:'none', background:'none', cursor:'pointer', fontSize:14, color:T.navy, padding:'2px 6px' }}>›</button>
                <button onClick={()=>setWeekStart(getWeekStart())} style={{ ...S.btnSm(T.navy), fontSize:10, padding:'3px 8px' }}>Today</button>
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:14, color:T.muted, pointerEvents:'none' }}>🔍</span>
              <input ref={searchRef} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ ...S.inp, padding:'8px 12px 8px 32px', width:180 }}
                onFocus={e=>e.target.style.borderColor=T.navy} onBlur={e=>e.target.style.borderColor=T.border}
              />
            </div>
            <Sel value={dayFilter} onChange={e=>setDayFilter(e.target.value)} style={{ width:130 }}><option value="All">All Days</option>{DAYS.map(d=><option key={d} value={d}>{d}</option>)}</Sel>
            <Sel value={classFilter} onChange={e=>setClassFilter(e.target.value)} style={{ width:140 }}><option value="All">All Batches</option>{uniqueClasses.map(c=><option key={c} value={c}>{c}</option>)}</Sel>
            <Sel value={teacherFilter} onChange={e=>setTeacherFilter(e.target.value)} style={{ width:150 }}><option value="All">All Teachers</option>{uniqueTeachers.map(t=><option key={t} value={t}>{t}</option>)}</Sel>
            {viewMode==='table'&&<button onClick={()=>{ setBulkMode(!bulkMode); setSelectedIds(new Set()) }}
              style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${bulkMode?T.navy:T.border}`, background:bulkMode?T.navy:T.surface, color:bulkMode?'white':T.muted, fontWeight:600, cursor:'pointer', fontSize:12 }}>
              {bulkMode?'✓ Done':'☑ Bulk'}
            </button>}
          </div>
        </div>
      </div>

      {/* VIEWS */}
      {loading ? (
        <div style={{ background:'white', borderRadius:12, padding:60, textAlign:'center', color:T.muted }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⏳</div>
          <div style={{ fontWeight:600 }}>Loading timetable…</div>
        </div>

      ) : viewMode==='week' ? (
        <WeeklyView
          entries={entries}
          staffList={staffList}
          weekStart={weekStart}
          showToast={showToast}
          onSubstituteSaved={loadData}
        />

      ) : viewMode==='monitor' ? (
        <MonitorPanel staffList={staffList} entries={entries} />

      ) : viewMode==='admin' ? (
        <AdminSetupPanel staffList={staffList} entries={entries} onRefresh={loadData} showToast={showToast} />

      ) : viewMode==='table' ? (
        <div style={{ background:'white', borderRadius:14, boxShadow:'0 2px 12px rgba(0,0,0,.07)', overflow:'hidden', border:`1px solid ${T.border}` }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:T.navy }}>
                  {bulkMode&&<th style={{ padding:'12px 10px', textAlign:'center' }}><input type="checkbox" checked={selectedIds.size===filtered.length&&filtered.length>0} onChange={()=>{ if(selectedIds.size===filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(e=>e.id))) }} /></th>}
                  {['#','Batch','Section','Day','Period','Subject','Teacher','Room','Actions'].map((h,i)=>(
                    <th key={h+i} style={{ padding:'12px 14px', textAlign:i===0||i===8?'center':'left', color:'white', fontWeight:700, fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item,i)=>{
                  const hasConflict=conflicts.some(c=>c.entries.some(e=>e.id===item.id))
                  return (
                    <tr key={item.id} style={{ background:hasConflict?T.redLt:i%2===0?'white':T.surface, borderBottom:`1px solid ${T.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background='#f0f9ff'}
                      onMouseLeave={e=>e.currentTarget.style.background=hasConflict?T.redLt:i%2===0?'white':T.surface}>
                      {bulkMode&&<td style={{ padding:'10px', textAlign:'center' }}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={()=>toggleSelect(item.id)} /></td>}
                      <td style={{ padding:'10px 14px', textAlign:'center', color:T.muted, fontSize:12 }}>{i+1}</td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.class_name} onSave={v=>handleFieldSave(item.id,'class_name',v)} /></td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.section||''} onSave={v=>handleFieldSave(item.id,'section',v)} /></td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.day_name} type="select" options={DAYS} onSave={v=>handleFieldSave(item.id,'day_name',v)} /></td>
                      <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}><EditCell value={item.period_name||''} onSave={v=>handleFieldSave(item.id,'period_name',v)} /></td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.subject_name||''} onSave={v=>handleFieldSave(item.id,'subject_name',v)} /></td>
                      <td style={{ padding:'8px 12px' }}>
                        <EditCell value={item.teacher_name||''} type="select" options={['', ...staffList.map(s=>s.name)]} onSave={v=>handleFieldSave(item.id,'teacher_name',v)} />
                      </td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.room_name||''} onSave={v=>handleFieldSave(item.id,'room_name',v)} /></td>
                      <td style={{ padding:'8px 12px', textAlign:'center' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                          <button onClick={()=>setEditingEntry(item)} style={{ ...S.btnSm('#eff6ff','#1d4ed8') }}>✏️</button>
                          <button onClick={()=>setDeleteId(item.id)} style={{ ...S.btnSm(T.redLt,T.red) }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!filtered.length&&<tr><td colSpan={bulkMode?10:9} style={{ padding:48, textAlign:'center', color:T.muted }}><div style={{ fontSize:32, marginBottom:10 }}>🔍</div>No entries match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

      ) : (
        /* TEACHER WORKLOAD */
        <div>
          <div style={{ background:'white', borderRadius:14, padding:24, marginBottom:20, boxShadow:'0 2px 12px rgba(0,0,0,.06)', border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:18, fontWeight:800, color:T.navy, marginBottom:18 }}>👨‍🏫 Teacher Workload Dashboard</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:14 }}>
              {teacherWorkload.map(t=>(
                <div key={t.name} style={{ background:T.surface, borderRadius:12, padding:16, border:`1px solid ${T.border}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:T.ink }}>{t.name}</span>
                    <span style={{ background:T.navy, color:'white', padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700 }}>{t.count} classes</span>
                  </div>
                  <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                    {[{val:(t.count*0.75).toFixed(1)+'h',label:'Weekly',color:T.navy},{val:t.days.length,label:'Days',color:'#16a34a'},{val:t.subjects.length,label:'Subjects',color:T.purple}].map(s=>(
                      <div key={s.label} style={{ flex:1, textAlign:'center', padding:'8px', background:'white', borderRadius:8, border:`1px solid ${T.border}` }}>
                        <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.val}</div>
                        <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'.06em' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                    {t.subjects.filter(Boolean).map(s=><span key={s} style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:T.purpleLt, color:T.purple, fontWeight:600 }}>{s}</span>)}
                  </div>
                  <div style={{ fontSize:11, color:T.muted }}>📅 {t.days.join(', ')}</div>
                </div>
              ))}
              {teacherWorkload.length===0&&<div style={{ color:T.muted, padding:32, textAlign:'center' }}>No teacher data yet</div>}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize:11, color:T.muted, textAlign:'center', marginTop:24 }}>
        💡 Weekly view: click any class cell to assign a substitute · 📊 Monitor tab shows live data from HR attendance · ⚙️ Admin PIN required for setup
      </div>
      <style>{`@media print { button { display:none!important; } }`}</style>
    </div>
  )
}