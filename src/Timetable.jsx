import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { staffDB } from './staffDB'

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  ink900: '#0c0f1a',
  ink700: '#1e2235',
  ink500: '#4a5068',
  ink300: '#8b91a8',
  ink100: '#d4d8e8',
  ink50:  '#f0f2f8',
  ink20:  '#f8f9fc',
  indigo:    '#3d4dff',
  indigoDim: '#2433cc',
  indigoLt:  '#eef0ff',
  indigoMid: '#c7cbff',
  emerald:    '#059669',
  emeraldLt:  '#d1fae5',
  amber:      '#d97706',
  amberLt:    '#fef3c7',
  rose:       '#e11d48',
  roseLt:     '#ffe4e6',
  violet:     '#7c3aed',
  violetLt:   '#ede9fe',
  sky:        '#0284c7',
  skyLt:      '#e0f2fe',
  teal:       '#0d9488',
  tealLt:     '#ccfbf1',
  orange:     '#ea580c',
  orangeLt:   '#fff7ed',
  pink:       '#db2777',
  pinkLt:     '#fce7f3',
}

const FONT = `'DM Sans', 'Outfit', system-ui, sans-serif`
const ADMIN_PIN = '1950'
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const BATCH_PALETTE = {
  Achiever: { bg: C.indigoLt,  border: C.indigoMid,  text: C.indigoDim, dot: C.indigo  },
  Leader:   { bg: C.emeraldLt, border: '#6ee7b7',     text: '#065f46',   dot: C.emerald },
  Champion: { bg: C.violetLt,  border: '#c4b5fd',     text: '#5b21b6',   dot: C.violet  },
  Lakshya:  { bg: C.orangeLt,  border: '#fdba74',     text: '#9a3412',   dot: C.orange  },
  Umeed:    { bg: C.pinkLt,    border: '#f9a8d4',     text: '#9d174d',   dot: C.pink    },
  Elite:    { bg: C.tealLt,    border: '#5eead4',     text: '#134e4a',   dot: C.teal    },
  Prime:    { bg: C.amberLt,   border: '#fcd34d',     text: '#92400e',   dot: C.amber   },
}
const BREAK_TYPES = ['LUNCH','TEA BREAK','DINNER','CLASS OFF','RECREATION','DOUBT SESSION','BREAK']

const getBatchStyle = n => {
  if (!n) return { bg: C.ink50, border: C.ink100, text: C.ink500, dot: C.ink300 }
  return BATCH_PALETTE[n.split(' ')[0]] || { bg: C.ink50, border: C.ink100, text: C.ink500, dot: C.ink300 }
}

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d
}
function formatDate(d) { return d.toISOString().split('T')[0] }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function getWeekDates(weekStart) {
  return DAYS.map((day, i) => ({ day, date: formatDate(addDays(weekStart, i)) }))
}
function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short' })
}

const emptyForm = { class_name:'', section:'', day_name:'Monday', period_name:'', subject_name:'', teacher_name:'', room_name:'' }

const baseInput = {
  width:'100%', padding:'9px 13px', borderRadius:8, border:`1px solid ${C.ink100}`,
  fontSize:13, outline:'none', fontFamily:FONT, color:C.ink900, background:'white',
  boxSizing:'border-box', transition:'border-color .15s, box-shadow .15s',
}
const S = {
  inp: baseInput,
  lbl: { display:'block', fontSize:11, fontWeight:600, color:C.ink300, marginBottom:5, textTransform:'uppercase', letterSpacing:'.08em' },
  pill: (bg, text) => ({ background:bg, color:text, padding:'2px 9px', borderRadius:999, fontSize:11, fontWeight:600 }),
  btn: {
    primary:    { background:C.indigo,  color:'white',  border:'none',                   borderRadius:8, padding:'9px 20px', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:FONT, transition:'background .15s' },
    ghost:      { background:'transparent', color:C.ink500, border:`1px solid ${C.ink100}`, borderRadius:8, padding:'9px 16px', fontWeight:500, cursor:'pointer', fontSize:13, fontFamily:FONT, transition:'all .15s' },
    danger:     { background:C.rose,    color:'white',  border:'none',                   borderRadius:8, padding:'9px 20px', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:FONT },
    icon:       { background:C.ink50,   color:C.ink500, border:`1px solid ${C.ink100}`,  borderRadius:7, padding:'5px 9px',  fontWeight:500, cursor:'pointer', fontSize:12, fontFamily:FONT },
    iconDanger: { background:C.roseLt,  color:C.rose,   border:`1px solid #fecdd3`,      borderRadius:7, padding:'5px 9px',  fontWeight:500, cursor:'pointer', fontSize:12, fontFamily:FONT },
  },
}

function Input({ value, onChange, placeholder, style={}, type='text', list }) {
  const [focused, setFocused] = useState(false)
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} list={list}
      style={{ ...S.inp, ...(focused ? { borderColor:C.indigo, boxShadow:`0 0 0 3px ${C.indigoLt}` } : {}), ...style }}
      onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    />
  )
}
function Select({ value, onChange, children, style={} }) {
  return (
    <select value={value} onChange={onChange}
      style={{ ...S.inp, appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b91a8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 12px center', paddingRight:32, ...style }}>
      {children}
    </select>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:9999, display:'flex', alignItems:'center', gap:10, padding:'12px 18px', borderRadius:10, background:isErr?C.rose:C.ink900, color:'white', fontWeight:500, fontSize:13, fontFamily:FONT, boxShadow:'0 8px 40px rgba(0,0,0,.2)', minWidth:280, maxWidth:380, animation:'slideIn .2s ease' }}>
      <span style={{ fontSize:16 }}>{isErr ? '⚠' : '✓'}</span>
      {toast.msg}
      <style>{`@keyframes slideIn{from{transform:translateY(-6px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = C.indigo, sub }) {
  return (
    <div style={{ background:'white', borderRadius:12, padding:'18px 20px', border:`1px solid ${C.ink50}`, boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ width:36, height:36, borderRadius:9, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>{icon}</div>
        {sub && <span style={{ fontSize:11, color:C.ink300, fontWeight:500 }}>{sub}</span>}
      </div>
      <div style={{ fontSize:28, fontWeight:700, color:C.ink900, letterSpacing:'-1px', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:12, color:C.ink400, marginTop:5, fontWeight:500 }}>{label}</div>
    </div>
  )
}

// ── Conflicts ─────────────────────────────────────────────────────────────────
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
    items.forEach(e => { if (!e.teacher_name) return; if (!teachers[e.teacher_name]) teachers[e.teacher_name] = []; teachers[e.teacher_name].push(e) })
    Object.entries(teachers).forEach(([t, tItems]) => {
      if (tItems.length > 1) conflicts.push({ type:'teacher', entries:tItems, message:`${t} double-booked at ${key.replace('|',' · ')}` })
    })
  })
  return conflicts
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PIN MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AdminPinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const verify = () => {
    if (pin === ADMIN_PIN) { onSuccess() }
    else { setError('Incorrect PIN'); setPin(''); setShake(true); setTimeout(()=>setShake(false),500) }
  }
  return (
    <Overlay>
      <div style={{ background:'white', borderRadius:16, padding:'36px 32px', width:'100%', maxWidth:360, textAlign:'center', fontFamily:FONT }}>
        <div style={{ width:56, height:56, borderRadius:16, background:C.indigoLt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:24 }}>🔐</div>
        <div style={{ fontSize:18, fontWeight:700, color:C.ink900, marginBottom:6 }}>Admin Access</div>
        <div style={{ fontSize:13, color:C.ink400, marginBottom:24 }}>Enter your PIN to unlock timetable setup</div>
        <input type="password" placeholder="••••" value={pin}
          onChange={e=>{ setPin(e.target.value); setError('') }}
          onKeyDown={e=>e.key==='Enter'&&verify()}
          style={{ ...S.inp, textAlign:'center', fontSize:22, letterSpacing:10, marginBottom:error?10:16, borderColor:error?C.rose:C.ink100 }}
          autoFocus
        />
        {error && <div style={{ color:C.rose, fontSize:12, fontWeight:500, marginBottom:12, animation:shake?'shake .4s':undefined }}>{error}</div>}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, ...S.btn.ghost }}>Cancel</button>
          <button onClick={verify} style={{ flex:1, ...S.btn.primary }}>Verify</button>
        </div>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}`}</style>
      </div>
    </Overlay>
  )
}

function Overlay({ children, zIndex=1000 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(12,15,26,.55)', zIndex, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(2px)' }}>
      {children}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EDIT ENTRY MODAL
// ══════════════════════════════════════════════════════════════════════════════
function EditEntryModal({ entry, staffList=[], onClose, onSaved }) {
  const [localStaff, setLocalStaff] = useState(staffList)
  const [form, setForm] = useState({
    class_name: entry.class_name||'', section: entry.section||'',
    day_name: entry.day_name||'Monday', period_name: entry.period_name||'',
    subject_name: entry.subject_name||'', teacher_name: entry.teacher_name||'', room_name: entry.room_name||'',
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  useEffect(() => {
    if (staffList.length > 0) setLocalStaff(staffList)
    else staffDB.forTimetable().then(setLocalStaff)
  }, [staffList])

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
    <Overlay>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:540, boxShadow:'0 24px 80px rgba(0,0,0,.2)', overflow:'hidden', fontFamily:FONT }}>
        <div style={{ padding:'22px 28px', borderBottom:`1px solid ${C.ink50}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:C.indigo, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Edit Entry</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.ink900 }}>{entry.class_name} {entry.section ? `· ${entry.section}` : ''}</div>
            <div style={{ fontSize:12, color:C.ink400, marginTop:2 }}>{entry.day_name} · {entry.period_name}</div>
          </div>
          <button onClick={onClose} style={{ background:C.ink50, border:'none', color:C.ink500, width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ padding:28 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[
              { label:'Batch / Class *', key:'class_name', ph:'Achiever' },
              { label:'Section',         key:'section',    ph:'A / B / Combined' },
              { label:'Period / Time *', key:'period_name',ph:'7:00–7:45 AM' },
              { label:'Subject',         key:'subject_name',ph:'Mathematics' },
            ].map(f=>(
              <div key={f.key}><label style={S.lbl}>{f.label}</label><Input value={form[f.key]} onChange={e=>set(f.key,e.target.value)} placeholder={f.ph} /></div>
            ))}
            <div>
              <label style={S.lbl}>Day</label>
              <Select value={form.day_name} onChange={e=>set('day_name',e.target.value)}>
                {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <label style={S.lbl}>Teacher</label>
              <Select value={form.teacher_name} onChange={e=>set('teacher_name',e.target.value)}>
                <option value="">— Select Teacher —</option>
                {localStaff.map(s=><option key={s.id} value={s.name}>{s.name}{s.designation?` — ${s.designation}`:''}</option>)}
              </Select>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={S.lbl}>Room</label>
              <Input value={form.room_name} onChange={e=>set('room_name',e.target.value)} placeholder="Room 101" />
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:22 }}>
            <button type="button" onClick={onClose} style={{ flex:1, ...S.btn.ghost }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex:2, ...S.btn.primary, opacity:saving?.7:1 }}>{saving?'Saving…':'Save Changes'}</button>
          </div>
        </form>
      </div>
    </Overlay>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBSTITUTE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SubstituteModal({ entry, date, staffList, allEntries, onClose, onSaved, showToast }) {
  const [substituteTeacher, setSubstituteTeacher] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const busyTeachers = new Set(
    allEntries
      .filter(e => e.day_name === entry.day_name && e.period_name === entry.period_name && e.class_name !== entry.class_name)
      .map(e => e.teacher_name).filter(Boolean)
  )
  const freeTeachers = staffList.filter(s => s.name !== entry.teacher_name && !busyTeachers.has(s.name))
  const busyList = staffList.filter(s => busyTeachers.has(s.name))

  const handleSave = async () => {
    if (!substituteTeacher) { showToast('Select a substitute teacher', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('timetable_substitutions').upsert([{
      sub_date: date, class_name: entry.class_name, period_name: entry.period_name,
      original_teacher: entry.teacher_name, substitute_teacher: substituteTeacher, reason, status:'Covered',
    }], { onConflict:'sub_date,class_name,period_name' })
    if (error) { showToast('Error: '+error.message,'error'); setSaving(false); return }
    showToast(`${substituteTeacher} assigned as substitute`)
    onSaved(); onClose(); setSaving(false)
  }

  return (
    <Overlay zIndex={2000}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:520, boxShadow:'0 32px 80px rgba(0,0,0,.25)', overflow:'hidden', fontFamily:FONT }}>
        <div style={{ padding:'22px 28px', background:C.indigoLt, borderBottom:`1px solid ${C.indigoMid}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:C.indigo, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Assign Substitute</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.ink900 }}>{entry.subject_name} — {entry.class_name}</div>
          <div style={{ fontSize:12, color:C.ink400, marginTop:3 }}>{entry.day_name} · {entry.period_name} · {fmt(date)}</div>
          <div style={{ marginTop:12, background:'#fff1f2', border:`1px solid #fecdd3`, borderRadius:8, padding:'9px 13px', fontSize:12, color:C.rose, fontWeight:500 }}>
            {entry.teacher_name || 'Unassigned'} is marked absent for this period
          </div>
        </div>
        <div style={{ padding:'24px 28px', maxHeight:'58vh', overflowY:'auto' }}>
          <div style={{ marginBottom:18 }}>
            <label style={S.lbl}>Available Teachers ({freeTeachers.length} free this period)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, maxHeight:200, overflowY:'auto', padding:'2px 0' }}>
              {freeTeachers.map(s => (
                <button key={s.id} onClick={()=>setSubstituteTeacher(s.name)}
                  style={{ padding:'7px 14px', borderRadius:8, border:`1px solid ${substituteTeacher===s.name?C.emerald:C.ink100}`, background:substituteTeacher===s.name?C.emeraldLt:'white', color:substituteTeacher===s.name?C.emerald:C.ink700, fontWeight:substituteTeacher===s.name?600:400, cursor:'pointer', fontSize:12, fontFamily:FONT, transition:'all .12s' }}>
                  {substituteTeacher===s.name ? '✓ ' : ''}{s.name}
                  {s.designation && <span style={{ color:C.ink300, marginLeft:5, fontSize:10 }}>({s.designation})</span>}
                </button>
              ))}
              {!freeTeachers.length && <p style={{ color:C.ink300, fontSize:13, margin:'8px 0' }}>No free teachers at this period</p>}
            </div>
            {busyList.length > 0 && (
              <div style={{ marginTop:8, fontSize:11, color:C.ink400, background:C.ink20, borderRadius:6, padding:'6px 10px' }}>
                Busy: {busyList.map(s=>s.name).join(', ')}
              </div>
            )}
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={S.lbl}>Or select manually</label>
            <Select value={substituteTeacher} onChange={e=>setSubstituteTeacher(e.target.value)}>
              <option value="">— Select Teacher —</option>
              {staffList.filter(s=>s.name!==entry.teacher_name).map(s=>(
                <option key={s.id} value={s.name}>{s.name}{busyTeachers.has(s.name)?' (busy)':' (free)'}</option>
              ))}
            </Select>
          </div>
          <div style={{ marginBottom:22 }}>
            <label style={S.lbl}>Reason (optional)</label>
            <Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Sick leave / Personal / Training..." />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, ...S.btn.ghost }}>Cancel</button>
            <button onClick={handleSave} disabled={saving||!substituteTeacher}
              style={{ flex:2, ...S.btn.primary, background:saving||!substituteTeacher?C.ink300:C.emerald, cursor:saving||!substituteTeacher?'not-allowed':'pointer' }}>
              {saving ? 'Saving…' : 'Confirm Substitute'}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// INLINE EDIT CELL
// ══════════════════════════════════════════════════════════════════════════════
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
    <span onClick={()=>setEditing(true)}
      style={{ cursor:'text', display:'block', minHeight:24, padding:'4px 7px', borderRadius:6, fontSize:13, color:value?C.ink700:C.ink300, border:'1px solid transparent', transition:'all .12s', position:'relative', fontFamily:FONT }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.ink100; e.currentTarget.style.background=C.ink20 }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='transparent' }}>
      {value || <span style={{ fontStyle:'italic', fontSize:11 }}>—</span>}
      {saving && <span style={{ position:'absolute', right:2, top:2, width:5, height:5, borderRadius:'50%', background:C.indigo, display:'inline-block' }}/>}
    </span>
  )
  if (type==='select') return (
    <select ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit}
      onKeyDown={e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') cancel() }}
      style={{ width:'100%', padding:'4px 7px', borderRadius:6, border:`1.5px solid ${C.indigo}`, fontSize:13, outline:'none', fontFamily:FONT }}>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit}
      onKeyDown={e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') cancel() }}
      style={{ width:'100%', padding:'4px 7px', borderRadius:6, border:`1.5px solid ${C.indigo}`, fontSize:13, outline:'none', fontFamily:FONT, boxSizing:'border-box', boxShadow:`0 0 0 3px ${C.indigoLt}` }}
    />
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD VIEW
// ══════════════════════════════════════════════════════════════════════════════
function CardView({ entries, staffList, isAdmin, onEdit, onDelete, onSubstitute }) {
  const [substitutions, setSubstitutions] = useState([])
  const [subModal, setSubModal] = useState(null)
  const todayName = new Date().toLocaleDateString('en-US', { weekday:'long' })
  const todayDate = formatDate(new Date())

  const loadSubs = useCallback(async () => {
    const from = formatDate(addDays(new Date(), -1))
    const to   = formatDate(addDays(new Date(), 6))
    const { data } = await supabase.from('timetable_substitutions').select('*').gte('sub_date', from).lte('sub_date', to)
    setSubstitutions(data || [])
  }, [])

  useEffect(() => { loadSubs() }, [loadSubs])

  const getSub = (className, dayName, periodName) => {
    const dateMap = { Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4, Saturday:5 }
    const weekMon = getWeekStart()
    const entryDate = formatDate(addDays(weekMon, dateMap[dayName] || 0))
    return substitutions.find(s =>
      s.class_name === className && s.period_name === periodName && s.sub_date === entryDate
    )
  }

  const isBreak = subj => BREAK_TYPES.includes((subj || '').toUpperCase().trim())

  return (
    <div style={{ fontFamily:FONT }}>
      {subModal && (
        <SubstituteModal
          entry={subModal.entry} date={subModal.date} staffList={staffList}
          allEntries={entries} onClose={()=>setSubModal(null)}
          onSaved={loadSubs} showToast={()=>{}}
        />
      )}

      {DAYS.map(day => {
        const dayEntries = entries.filter(e => e.day_name === day)
        const isToday = day === todayName
        const periods = [...new Set(dayEntries.map(e => e.period_name).filter(Boolean))].sort()

        // Compute this day's date for substitution lookup
        const dateMap = { Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4, Saturday:5 }
        const weekMon = getWeekStart()
        const dayDate = formatDate(addDays(weekMon, dateMap[day] || 0))

        return (
          <div key={day} style={{ marginBottom:32 }}>
            {/* Day header */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:3, height:22, background:isToday?C.indigo:C.ink100, borderRadius:2, flexShrink:0 }}/>
              <span style={{ fontSize:15, fontWeight:700, color:isToday?C.indigo:C.ink900 }}>{day}</span>
              <span style={{ fontSize:12, color:C.ink400, background:C.ink50, padding:'2px 9px', borderRadius:999, border:`1px solid ${C.ink100}` }}>
                {fmt(dayDate)}
              </span>
              {isToday && <span style={{ ...S.pill(C.indigoLt, C.indigo) }}>Today</span>}
              <span style={{ fontSize:11, color:C.ink300 }}>{dayEntries.length} classes</span>
            </div>

            {!dayEntries.length && (
              <div style={{ padding:'24px', textAlign:'center', color:C.ink300, fontSize:13,
                background:'white', borderRadius:12, border:`1px solid ${C.ink50}` }}>
                No classes scheduled
              </div>
            )}

            {periods.map(period => {
              const pEntries = dayEntries.filter(e => e.period_name === period)
              const breakEntry = pEntries.find(e => isBreak(e.subject_name))

              // Shared break row spanning all batches
              if (breakEntry) return (
                <div key={period} style={{ display:'flex', alignItems:'center', gap:10,
                  padding:'9px 16px', background:'#fffbf0',
                  border:`1px solid #fcd34d`, borderRadius:10, marginBottom:10 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:C.amber, minWidth:90 }}>{period}</span>
                  <span style={{ ...S.pill(C.amberLt, C.amber), textTransform:'uppercase', letterSpacing:'.06em' }}>
                    {breakEntry.subject_name}
                  </span>
                </div>
              )

              return (
                <div key={period} style={{ marginBottom:10 }}>
                  {/* Period label row */}
                  <div style={{ fontSize:11, fontWeight:600, color:C.ink300, letterSpacing:'.06em',
                    textTransform:'uppercase', marginBottom:6, paddingLeft:2 }}>
                    {period}
                  </div>
                  {/* Cards grid */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
                    {pEntries.map(e => {
                      const bs  = getBatchStyle(e.class_name)
                      const sub = substitutions.find(s =>
                        s.class_name === e.class_name &&
                        s.period_name === e.period_name &&
                        s.sub_date === dayDate
                      )
                      const cardBg     = sub ? C.emeraldLt : 'white'
                      const cardBorder = sub ? '#6ee7b7'   : C.ink50

                      return (
                        <div key={e.id} style={{
                          background: cardBg,
                          border: `1px solid ${cardBorder}`,
                          borderRadius: 12,
                          padding: '14px 16px',
                          transition: 'box-shadow .15s, transform .15s',
                          cursor: isAdmin ? 'default' : 'default',
                        }}
                          onMouseEnter={el => { el.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.07)'; el.currentTarget.style.transform = 'translateY(-1px)' }}
                          onMouseLeave={el => { el.currentTarget.style.boxShadow = ''; el.currentTarget.style.transform = '' }}
                        >
                          {/* Batch pill */}
                          <div style={{ marginBottom:8 }}>
                            <span style={{
                              display:'inline-flex', alignItems:'center', gap:5,
                              background:bs.bg, color:bs.text, border:`1px solid ${bs.border}`,
                              padding:'2px 9px', borderRadius:999, fontSize:11, fontWeight:600,
                            }}>
                              <span style={{ width:5, height:5, borderRadius:'50%', background:bs.dot, flexShrink:0 }}/>
                              {e.class_name}
                              {e.section ? ` · ${e.section}` : ''}
                            </span>
                          </div>

                          {/* Subject */}
                          <div style={{ fontSize:14, fontWeight:700, color:C.ink900, marginBottom:6, lineHeight:1.3 }}>
                            {e.subject_name || '—'}
                          </div>

                          {/* Teacher */}
                          <div style={{ fontSize:12, color:C.ink400, marginBottom: e.room_name ? 3 : 0 }}>
                            {sub ? (
                              <>
                                <span style={{ textDecoration:'line-through', marginRight:4 }}>{e.teacher_name}</span>
                                <span style={{ color:C.emerald, fontWeight:600 }}>→ {sub.substitute_teacher}</span>
                                <span style={{ marginLeft:6, ...S.pill(C.emerald,'white'), fontSize:9, letterSpacing:'.04em' }}>SUB</span>
                              </>
                            ) : (
                              e.teacher_name || <span style={{ fontStyle:'italic', color:C.ink200 }}>No teacher</span>
                            )}
                          </div>

                          {/* Room */}
                          {e.room_name && (
                            <div style={{ fontSize:11, color:C.ink300 }}>{e.room_name}</div>
                          )}

                          {/* Admin actions */}
                          {isAdmin && (
                            <div style={{ display:'flex', gap:5, marginTop:12, paddingTop:10, borderTop:`1px solid ${C.ink50}` }}>
                              <button
                                onClick={() => onEdit(e)}
                                style={{ ...S.btn.icon, flex:1, textAlign:'center', fontSize:11 }}>
                                ✏ Edit
                              </button>
                              {!sub && (
                                <button
                                  onClick={() => setSubModal({ entry:e, date:dayDate })}
                                  style={{ ...S.btn.icon, flex:1, textAlign:'center', fontSize:11, color:C.amber, borderColor:'#fcd34d', background:C.amberLt }}>
                                  ⇄ Sub
                                </button>
                              )}
                              <button
                                onClick={() => onDelete(e.id)}
                                style={{ ...S.btn.iconDanger, fontSize:11 }}>
                                🗑
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// WEEKLY VIEW
// ══════════════════════════════════════════════════════════════════════════════
function WeeklyView({ entries, staffList, weekStart, showToast, onSubstituteSaved, isAdmin }) {
  const [substitutions, setSubstitutions] = useState([])
  const [subModal, setSubModal] = useState(null)
  const weekDates = getWeekDates(weekStart)
  const today = formatDate(new Date())

  const loadSubs = useCallback(async () => {
    const from = formatDate(weekStart)
    const to   = formatDate(addDays(weekStart, 5))
    const { data } = await supabase.from('timetable_substitutions').select('*').gte('sub_date',from).lte('sub_date',to)
    setSubstitutions(data || [])
  }, [weekStart])
  useEffect(()=>{ loadSubs() },[loadSubs])

  const allBatches = [...new Set(entries.map(e=>e.class_name).filter(Boolean))].sort()
  const getSub = (date, className, periodName) =>
    substitutions.find(s=>s.sub_date===date&&s.class_name===className&&s.period_name===periodName)

  return (
    <div style={{ fontFamily:FONT }}>
      {subModal && (
        <SubstituteModal entry={subModal.entry} date={subModal.date} staffList={staffList}
          allEntries={entries} onClose={()=>setSubModal(null)}
          onSaved={()=>{ loadSubs(); onSubstituteSaved() }} showToast={showToast} />
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {weekDates.map(({ day, date }) => {
          const dayEntries = entries.filter(e=>e.day_name===day)
          const isToday = date === today
          const periods = [...new Set(dayEntries.map(e=>e.period_name).filter(Boolean))].sort()

          return (
            <div key={day}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:3, height:20, background:isToday?C.indigo:C.ink200, borderRadius:2 }}/>
                  <span style={{ fontSize:15, fontWeight:700, color:isToday?C.indigo:C.ink900 }}>{day}</span>
                </div>
                <span style={{ fontSize:12, color:C.ink400, background:C.ink50, padding:'2px 9px', borderRadius:999 }}>{fmt(date)}</span>
                {isToday && <span style={{ ...S.pill(C.indigoLt, C.indigo) }}>Today</span>}
                <span style={{ fontSize:11, color:C.ink300 }}>{dayEntries.length} classes</span>
              </div>

              <div style={{ background:'white', borderRadius:12, border:`1px solid ${isToday?C.indigoMid:C.ink50}`, overflow:'hidden', boxShadow:isToday?`0 0 0 1px ${C.indigoLt}, 0 4px 16px rgba(61,77,255,.06)`:'0 1px 4px rgba(0,0,0,.04)' }}>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FONT }}>
                    <thead>
                      <tr style={{ background:C.ink20, borderBottom:`1px solid ${C.ink100}` }}>
                        <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:C.ink300, textTransform:'uppercase', letterSpacing:'.08em', minWidth:120, borderRight:`1px solid ${C.ink50}` }}>Period</th>
                        {allBatches.map(b => {
                          const bs = getBatchStyle(b)
                          return (
                            <th key={b} style={{ padding:'10px 14px', minWidth:140, textAlign:'center' }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:bs.bg, color:bs.text, padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600, border:`1px solid ${bs.border}` }}>
                                <span style={{ width:5, height:5, borderRadius:'50%', background:bs.dot, flexShrink:0 }}/>
                                {b}
                              </span>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.length === 0 && (
                        <tr><td colSpan={allBatches.length+1} style={{ padding:32, textAlign:'center', color:C.ink300, fontSize:13 }}>No classes scheduled</td></tr>
                      )}
                      {periods.map((period, pi) => {
                        const pEntries = dayEntries.filter(e=>e.period_name===period)
                        const breakEntry = pEntries.find(e=>BREAK_TYPES.includes((e.subject_name||'').toUpperCase().trim()))
                        if (breakEntry) return (
                          <tr key={period} style={{ background:'#fffbf0', borderBottom:`1px solid ${C.ink50}` }}>
                            <td style={{ padding:'10px 16px', fontSize:11, fontWeight:600, color:C.amber, letterSpacing:'.04em', borderRight:`1px solid ${C.ink50}`, whiteSpace:'nowrap' }}>{period}</td>
                            <td colSpan={allBatches.length} style={{ padding:'10px 16px', textAlign:'center' }}>
                              <span style={{ ...S.pill(C.amberLt, C.amber), letterSpacing:'.06em', textTransform:'uppercase' }}>{breakEntry.subject_name}</span>
                            </td>
                          </tr>
                        )
                        return (
                          <tr key={period} style={{ background:pi%2===0?'white':C.ink20, borderBottom:`1px solid ${C.ink50}` }}>
                            <td style={{ padding:'8px 16px', fontSize:12, fontWeight:600, color:C.ink500, borderRight:`1px solid ${C.ink50}`, whiteSpace:'nowrap' }}>{period}</td>
                            {allBatches.map(batch => {
                              const cell = pEntries.filter(e=>e.class_name===batch||(e.class_name||'').split(' ')[0]===batch)
                              const bs = getBatchStyle(batch)
                              return (
                                <td key={batch} style={{ padding:'6px 8px', verticalAlign:'top', borderRight:`1px solid ${C.ink50}` }}>
                                  {cell.map(e => {
                                    const sub = getSub(date, e.class_name, e.period_name)
                                    return (
                                      <div key={e.id}
                                        onClick={()=>isAdmin&&setSubModal({ entry:e, date })}
                                        style={{ background:sub?C.emeraldLt:bs.bg, border:`1px solid ${sub?'#6ee7b7':bs.border}`, borderRadius:8, padding:'8px 10px', cursor:isAdmin?'pointer':'default', marginBottom:3, transition:'transform .1s, box-shadow .1s' }}
                                        onMouseEnter={e=>{ if(isAdmin){ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.08)' } }}
                                        onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                                        <div style={{ fontWeight:600, fontSize:12, color:sub?C.emerald:bs.text, marginBottom:2 }}>{e.subject_name}</div>
                                        {sub ? (
                                          <div style={{ fontSize:11 }}>
                                            <span style={{ color:C.ink300, textDecoration:'line-through', marginRight:4 }}>{e.teacher_name}</span>
                                            <span style={{ color:C.emerald, fontWeight:600 }}>→ {sub.substitute_teacher}</span>
                                            <span style={{ marginLeft:5, ...S.pill(C.emerald, 'white'), fontSize:9 }}>SUB</span>
                                          </div>
                                        ) : (
                                          e.teacher_name && <div style={{ color:C.ink400, fontSize:11 }}>{e.teacher_name}</div>
                                        )}
                                        {e.room_name && <div style={{ color:C.ink300, fontSize:10, marginTop:1 }}>{e.room_name}</div>}
                                        {isAdmin && !sub && <div style={{ fontSize:9, color:C.ink200, marginTop:3, letterSpacing:'.04em' }}>CLICK TO SUBSTITUTE</div>}
                                      </div>
                                    )
                                  })}
                                  {!cell.length && <span style={{ color:C.ink200, fontSize:13 }}>—</span>}
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
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MONITOR PANEL
// ══════════════════════════════════════════════════════════════════════════════
function MonitorPanel({ staffList, entries }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [attendanceData, setAttendanceData] = useState([])
  const [substitutionData, setSubstitutionData] = useState([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const from = `${month}-01`, to = `${month}-31`
    const [{ data: att }, { data: subs }] = await Promise.all([
      supabase.from('staff_attendance').select('staff_id,status,date').gte('date',from).lte('date',to),
      supabase.from('timetable_substitutions').select('*').gte('sub_date',from).lte('sub_date',to),
    ])
    setAttendanceData(att||[]); setSubstitutionData(subs||[]); setLoading(false)
  }, [month])
  useEffect(()=>{ loadData() },[loadData])

  const teacherStats = useMemo(()=>{
    const teachingStaff = staffList.filter(s=>s.role==='Teaching'||s.role==='Teaching + Admin')
    return teachingStaff.map(s=>{
      const records = attendanceData.filter(a=>String(a.staff_id)===String(s.id))
      const total=records.length, absent=records.filter(a=>a.status==='Absent').length
      const present=records.filter(a=>a.status==='Present').length, late=records.filter(a=>a.status==='Late').length
      const leave=records.filter(a=>a.status==='Leave'||a.status==='Half Day').length
      const pct=total>0?Math.round((present/total)*100):null
      const timesOriginal=substitutionData.filter(sub=>sub.original_teacher===s.name).length
      const timesSubstitute=substitutionData.filter(sub=>sub.substitute_teacher===s.name).length
      const assignedPeriods=entries.filter(e=>e.teacher_name===s.name).length
      return { ...s, total, absent, present, late, leave, pct, timesOriginal, timesSubstitute, assignedPeriods }
    })
  },[staffList,attendanceData,substitutionData,entries])

  const mostAbsent      = [...teacherStats].sort((a,b)=>b.absent-a.absent).slice(0,5)
  const mostSubstituted = [...teacherStats].sort((a,b)=>b.timesOriginal-a.timesOriginal).slice(0,5)
  const leaderboard     = [...teacherStats].filter(t=>t.total>0).sort((a,b)=>(b.pct||0)-(a.pct||0))
  const uncoveredSubs   = substitutionData.filter(s=>s.status==='Uncovered'||!s.substitute_teacher)
  const totalAbsences   = attendanceData.filter(a=>a.status==='Absent').length
  const coverageRate    = substitutionData.length>0?Math.round((substitutionData.filter(s=>s.status==='Covered').length/substitutionData.length)*100):100

  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <div>
          <label style={S.lbl}>Month</label>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{ ...S.inp, width:180 }}/>
        </div>
        <button onClick={loadData} style={{ ...S.btn.ghost, marginBottom:1 }}>{loading?'Loading…':'Refresh'}</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Absences',   val:totalAbsences,           icon:'🔴', color:C.rose },
          { label:'Substitutions',    val:substitutionData.length, icon:'🔄', color:C.amber },
          { label:'Uncovered Gaps',   val:uncoveredSubs.length,    icon:'⚠', color:uncoveredSubs.length?C.rose:C.emerald },
          { label:'Coverage Rate',    val:coverageRate+'%',        icon:'✓', color:coverageRate>80?C.emerald:C.amber },
          { label:'Teachers Tracked', val:`${teacherStats.filter(t=>t.total>0).length}/${teacherStats.length}`, icon:'👥', color:C.indigo },
        ].map(k=>(
          <StatCard key={k.label} icon={k.icon} label={k.label} value={k.val} color={k.color} />
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={{ background:'white', borderRadius:12, padding:20, border:`1px solid ${C.ink50}`, boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.rose, marginBottom:3 }}>Most Absent</div>
          <div style={{ fontSize:11, color:C.ink300, marginBottom:16 }}>Sorted by absence days this month</div>
          {mostAbsent.filter(t=>t.total>0).length===0
            ? <p style={{ color:C.ink300, fontSize:13, textAlign:'center', padding:'20px 0' }}>No data for {month}</p>
            : mostAbsent.filter(t=>t.total>0).map((t,i)=>(
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:i<4?`1px solid ${C.ink50}`:'none' }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:i===0?C.rose:i===1?C.amberLt:C.ink50, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:i===0?'white':i===1?C.amber:C.ink400, flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:C.ink800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize:11, color:C.ink300 }}>{t.present} present · {t.late} late</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:20, fontWeight:700, color:t.absent>5?C.rose:t.absent>2?C.amber:C.emerald }}>{t.absent}</div>
                  <div style={{ fontSize:10, color:C.ink300 }}>days</div>
                </div>
              </div>
            ))
          }
        </div>

        <div style={{ background:'white', borderRadius:12, padding:20, border:`1px solid ${C.ink50}`, boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.amber, marginBottom:3 }}>Most Substituted</div>
          <div style={{ fontSize:11, color:C.ink300, marginBottom:16 }}>Teachers who needed replacement most</div>
          {mostSubstituted.filter(t=>t.timesOriginal>0).length===0
            ? <p style={{ color:C.ink300, fontSize:13, textAlign:'center', padding:'20px 0' }}>No substitutions for {month}</p>
            : mostSubstituted.filter(t=>t.timesOriginal>0).map((t,i)=>(
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:i<4?`1px solid ${C.ink50}`:'none' }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:i===0?C.amberLt:C.ink50, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:i===0?C.amber:C.ink400, flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:C.ink800 }}>{t.name}</div>
                  <div style={{ fontSize:11, color:C.ink300 }}>{t.assignedPeriods} periods/week</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:20, fontWeight:700, color:C.amber }}>{t.timesOriginal}</div>
                  <div style={{ fontSize:10, color:C.ink300 }}>times</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      <div style={{ background:'white', borderRadius:12, border:`1px solid ${C.ink50}`, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.04)', marginBottom:16 }}>
        <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.ink50}` }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.ink900 }}>Attendance Leaderboard</div>
          <div style={{ fontSize:11, color:C.ink300, marginTop:2 }}>All teaching staff · ranked by attendance % this month</div>
        </div>
        {leaderboard.length === 0
          ? <p style={{ color:C.ink300, fontSize:13, textAlign:'center', padding:40 }}>No attendance data yet for {month}</p>
          : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FONT }}>
              <thead>
                <tr style={{ background:C.ink20, borderBottom:`1px solid ${C.ink100}` }}>
                  {['#','Teacher','Present','Absent','Late','Leave','Total','Attendance','Subs'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:h==='#'?'center':'left', fontWeight:600, fontSize:11, color:C.ink400, textTransform:'uppercase', letterSpacing:'.07em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((t,i)=>{
                  const pctColor = t.pct>=90?C.emerald:t.pct>=75?C.amber:C.rose
                  const rankBg = i===0?'#fef3c7':i===1?'#f1f5f9':i===2?'#fff7ed':C.ink50
                  const rankColor = i===0?C.amber:i===1?C.ink400:i===2?C.orange:C.ink300
                  return (
                    <tr key={t.id} style={{ borderBottom:`1px solid ${C.ink50}`, background:'white' }}
                      onMouseEnter={e=>e.currentTarget.style.background=C.ink20}
                      onMouseLeave={e=>e.currentTarget.style.background='white'}>
                      <td style={{ padding:'10px 14px', textAlign:'center' }}>
                        <span style={{ width:24, height:24, borderRadius:'50%', background:rankBg, color:rankColor, display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11 }}>{i+1}</span>
                      </td>
                      <td style={{ padding:'10px 14px', fontWeight:600, color:C.ink900 }}>{t.name}</td>
                      <td style={{ padding:'10px 14px', color:C.emerald, fontWeight:600 }}>{t.present}</td>
                      <td style={{ padding:'10px 14px', color:t.absent>0?C.rose:C.ink300, fontWeight:t.absent>0?600:400 }}>{t.absent}</td>
                      <td style={{ padding:'10px 14px', color:t.late>0?C.amber:C.ink300 }}>{t.late}</td>
                      <td style={{ padding:'10px 14px', color:C.ink300 }}>{t.leave}</td>
                      <td style={{ padding:'10px 14px', color:C.ink400 }}>{t.total}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ flex:1, height:5, background:C.ink100, borderRadius:3, minWidth:60, overflow:'hidden' }}>
                            <div style={{ width:`${t.pct}%`, height:'100%', background:pctColor, borderRadius:3, transition:'width .4s' }}/>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:pctColor, minWidth:34 }}>{t.pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 14px', color:C.sky, fontWeight:600 }}>{t.timesSubstitute}×</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {uncoveredSubs.length > 0 && (
        <div style={{ background:C.roseLt, borderRadius:12, padding:20, border:`1px solid #fecdd3` }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.rose, marginBottom:12 }}>Uncovered Periods ({uncoveredSubs.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {uncoveredSubs.map(s=>(
              <div key={s.id} style={{ background:'white', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:12, fontSize:13 }}>
                <span style={{ color:C.rose, fontWeight:600 }}>{fmt(s.sub_date)}</span>
                <span style={{ color:C.ink700 }}>{s.class_name}</span>
                <span style={{ color:C.ink200 }}>·</span>
                <span style={{ color:C.ink400 }}>{s.period_name}</span>
                <span style={{ color:C.ink200 }}>·</span>
                <span style={{ color:C.ink700 }}>Original: {s.original_teacher}</span>
                <span style={{ marginLeft:'auto', ...S.pill(C.rose, 'white'), letterSpacing:'.04em' }}>NO SUB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN SETUP PANEL
// ══════════════════════════════════════════════════════════════════════════════
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

  const uniqueClasses = [...new Set(entries.map(e=>e.class_name).filter(Boolean))].sort()
  const uniquePeriods = [...new Set(entries.map(e=>e.period_name).filter(Boolean))].sort()
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
    if (error) showToast('Error: '+error.message,'error')
    else { showToast(`${rows.length} entries added`); onRefresh(); setSlots([{ period_name:'', subject_name:'', teacher_name:'', room_name:'' }]) }
    setSaving(false)
  }

  const handleCopyDay = async () => {
    if (!copyTo.length) { alert('Select at least one target day'); return }
    const source = entries.filter(e=>e.day_name===copyFrom)
    if (!source.length) { alert('No entries found for '+copyFrom); return }
    setCopying(true); let total=0
    for (const day of copyTo) {
      const { error:delErr } = await supabase.from('timetable_entries').delete().eq('day_name',day)
      if (delErr) { showToast(`Failed to clear ${day}`, 'error'); continue }
      const rows = source.map(e=>({ class_name:e.class_name, section:e.section, day_name:day, period_name:e.period_name, subject_name:e.subject_name, teacher_name:e.teacher_name, room_name:e.room_name }))
      const { error:insErr } = await supabase.from('timetable_entries').insert(rows)
      if (insErr) showToast(`Insert failed for ${day}`, 'error')
      else total+=rows.length
    }
    showToast(`Copied ${total} entries to ${copyTo.join(', ')}`); onRefresh(); setCopying(false)
  }

  const handleSwap = async () => {
    if (!swapA||!swapB||swapA===swapB) { alert('Select two different periods'); return }
    setSwapping(true)
    const TEMP = `__SWAP_${Date.now()}__`
    const { error:e1 } = await supabase.from('timetable_entries').update({ period_name:TEMP }).eq('period_name',swapA)
    if (e1) { showToast('Swap step 1 failed','error'); setSwapping(false); return }
    const { error:e2 } = await supabase.from('timetable_entries').update({ period_name:swapA }).eq('period_name',swapB)
    if (e2) { showToast('Swap partially applied','error'); setSwapping(false); return }
    const { error:e3 } = await supabase.from('timetable_entries').update({ period_name:swapB }).eq('period_name',TEMP)
    if (e3) { showToast('Swap step 3 failed','error'); setSwapping(false); return }
    showToast(`Swapped ${swapA} ↔ ${swapB}`); onRefresh(); setSwapping(false)
  }

  const handleBulkDelete = async () => {
    if (!delDay&&!delBatch) { alert('Select day or batch'); return }
    const count = entries.filter(e=>(!delDay||e.day_name===delDay)&&(!delBatch||e.class_name===delBatch)).length
    if (!window.confirm(`Delete ${count} entries?`)) return
    let query = supabase.from('timetable_entries').delete()
    if (delDay)   query = query.eq('day_name',delDay)
    if (delBatch) query = query.eq('class_name',delBatch)
    const { error } = await query
    if (error) showToast('Delete failed','error')
    else { showToast('Deleted'); onRefresh() }
  }

  const adminTabs = [
    { id:'batch', label:'Batch Entry' },
    { id:'copy',  label:'Copy Day' },
    { id:'swap',  label:'Swap Periods' },
    { id:'delete',label:'Bulk Delete' },
  ]
  const sectionCard = { background:'white', borderRadius:12, padding:24, border:`1px solid ${C.ink50}`, boxShadow:'0 1px 4px rgba(0,0,0,.04)' }

  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 14px', background:C.amberLt, borderRadius:8, border:`1px solid #fcd34d`, marginBottom:20 }}>
        <span style={{ fontSize:13 }}>🔓</span>
        <span style={{ fontSize:12, fontWeight:600, color:C.amber }}>Admin access granted — full timetable setup</span>
      </div>

      <div style={{ display:'flex', gap:0, marginBottom:22, borderBottom:`1px solid ${C.ink100}` }}>
        {adminTabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'9px 18px', border:'none', borderBottom:`2px solid ${tab===t.id?C.indigo:'transparent'}`, background:'none', cursor:'pointer', fontSize:13, fontWeight:tab===t.id?600:400, color:tab===t.id?C.indigo:C.ink400, marginBottom:-1, transition:'color .15s', fontFamily:FONT }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='batch' && (
        <div style={sectionCard}>
          <div style={{ fontSize:15, fontWeight:700, color:C.ink900, marginBottom:3 }}>Add Multiple Slots</div>
          <div style={{ fontSize:12, color:C.ink400, marginBottom:20 }}>Set batch and day once, then define all time slots together.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20, padding:16, background:C.ink20, borderRadius:10 }}>
            <div>
              <label style={S.lbl}>Batch / Class *</label>
              <input value={batchForm.class_name} onChange={e=>setBatchForm(f=>({...f,class_name:e.target.value}))} placeholder="Achiever..." style={S.inp} list="bl" />
              <datalist id="bl">{uniqueClasses.map(c=><option key={c} value={c}/>)}</datalist>
            </div>
            <div><label style={S.lbl}>Section</label><Input value={batchForm.section} onChange={e=>setBatchForm(f=>({...f,section:e.target.value}))} placeholder="A / B / Combined" /></div>
            <div><label style={S.lbl}>Day *</label><Select value={batchForm.day_name} onChange={e=>setBatchForm(f=>({...f,day_name:e.target.value}))}>{DAYS.map(d=><option key={d} value={d}>{d}</option>)}</Select></div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.ink700 }}>Time Slots ({slots.length})</div>
              <button onClick={addSlot} style={{ ...S.btn.ghost, padding:'6px 14px', fontSize:12 }}>+ Add Slot</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {slots.map((sl,i)=>(
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr 1.8fr 0.7fr auto', gap:10, padding:12, background:C.ink20, borderRadius:8, alignItems:'end' }}>
                  <div>{i===0&&<label style={S.lbl}>Period / Time *</label>}<Input value={sl.period_name} onChange={e=>updateSlot(i,'period_name',e.target.value)} placeholder="7:00–7:45 AM" /></div>
                  <div>{i===0&&<label style={S.lbl}>Subject *</label>}<Input value={sl.subject_name} onChange={e=>updateSlot(i,'subject_name',e.target.value)} placeholder="Mathematics" /></div>
                  <div>
                    {i===0&&<label style={S.lbl}>Teacher <span style={{ fontWeight:400, color:C.sky }}>({staffList.length})</span></label>}
                    <Select value={sl.teacher_name} onChange={e=>updateSlot(i,'teacher_name',e.target.value)}>
                      <option value="">— Select —</option>
                      {staffList.map(s=><option key={s.id} value={s.name}>{s.name}{s.designation?` (${s.designation})`:''}</option>)}
                    </Select>
                  </div>
                  <div>{i===0&&<label style={S.lbl}>Room</label>}<Input value={sl.room_name} onChange={e=>updateSlot(i,'room_name',e.target.value)} placeholder="101" /></div>
                  <div style={{ paddingTop:i===0?20:0 }}>
                    <button onClick={()=>removeSlot(i)} style={{ ...S.btn.iconDanger }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleBatchSave} disabled={saving} style={{ ...S.btn.primary, opacity:saving?.7:1 }}>{saving?'Saving…':'Save All Slots'}</button>
            <button onClick={addSlot} style={S.btn.ghost}>+ Add Slot</button>
          </div>
        </div>
      )}

      {tab==='copy' && (
        <div style={sectionCard}>
          <div style={{ fontSize:15, fontWeight:700, color:C.ink900, marginBottom:3 }}>Copy Day Schedule</div>
          <div style={{ fontSize:12, color:C.ink400, marginBottom:22 }}>Duplicate an entire day's schedule to other days. Target day entries will be replaced.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:24, alignItems:'start' }}>
            <div>
              <label style={S.lbl}>Copy From *</label>
              <Select value={copyFrom} onChange={e=>setCopyFrom(e.target.value)}>
                {DAYS.map(d=><option key={d} value={d}>{d} ({entries.filter(e=>e.day_name===d).length} entries)</option>)}
              </Select>
              <div style={{ marginTop:8, padding:'9px 12px', background:C.skyLt, borderRadius:8, fontSize:12, color:C.sky }}>
                {entries.filter(e=>e.day_name===copyFrom).length} entries will be copied
              </div>
            </div>
            <div>
              <label style={S.lbl}>Copy To *</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {DAYS.filter(d=>d!==copyFrom).map(d=>(
                  <label key={d} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:`1px solid ${copyTo.includes(d)?C.indigo:C.ink100}`, background:copyTo.includes(d)?C.indigoLt:'white', cursor:'pointer', fontSize:13, fontWeight:copyTo.includes(d)?600:400, color:copyTo.includes(d)?C.indigo:C.ink500, transition:'all .12s', fontFamily:FONT }}>
                    <input type="checkbox" checked={copyTo.includes(d)} onChange={e=>setCopyTo(prev=>e.target.checked?[...prev,d]:prev.filter(x=>x!==d))} style={{ display:'none' }} />
                    {copyTo.includes(d)?'✓ ':''}{d}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop:20, padding:'10px 14px', background:C.amberLt, borderRadius:8, fontSize:12, color:C.amber, fontWeight:500, marginBottom:18 }}>
            ⚠ Warning: All existing entries for selected target days will be replaced.
          </div>
          <button onClick={handleCopyDay} disabled={copying||!copyTo.length}
            style={{ ...S.btn.primary, opacity:copying||!copyTo.length?.5:1, cursor:copying||!copyTo.length?'not-allowed':'pointer' }}>
            {copying?'Copying…':`Copy to ${copyTo.length} day${copyTo.length!==1?'s':''}`}
          </button>
        </div>
      )}

      {tab==='swap' && (
        <div style={sectionCard}>
          <div style={{ fontSize:15, fontWeight:700, color:C.ink900, marginBottom:3 }}>Swap Two Periods</div>
          <div style={{ fontSize:12, color:C.ink400, marginBottom:22 }}>Swaps all entries between two time slots globally across all batches.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:16, alignItems:'end', maxWidth:560 }}>
            <div><label style={S.lbl}>Period A</label><Select value={swapA} onChange={e=>setSwapA(e.target.value)}><option value="">— Select —</option>{uniquePeriods.map(p=><option key={p} value={p}>{p}</option>)}</Select></div>
            <div style={{ textAlign:'center', paddingBottom:10, fontSize:18, color:C.ink300 }}>⇄</div>
            <div><label style={S.lbl}>Period B</label><Select value={swapB} onChange={e=>setSwapB(e.target.value)}><option value="">— Select —</option>{uniquePeriods.map(p=><option key={p} value={p}>{p}</option>)}</Select></div>
          </div>
          {swapA&&swapB&&swapA!==swapB&&(
            <div style={{ marginTop:14, padding:'10px 14px', background:C.ink20, borderRadius:8, fontSize:12, color:C.ink400 }}>
              Will swap <strong style={{ color:C.ink700 }}>{entries.filter(e=>e.period_name===swapA).length}</strong> entries at <strong style={{ color:C.ink700 }}>{swapA}</strong> ↔ <strong style={{ color:C.ink700 }}>{entries.filter(e=>e.period_name===swapB).length}</strong> entries at <strong style={{ color:C.ink700 }}>{swapB}</strong>
            </div>
          )}
          <button onClick={handleSwap} disabled={swapping||!swapA||!swapB||swapA===swapB}
            style={{ ...S.btn.primary, marginTop:18, opacity:swapping||!swapA||!swapB||swapA===swapB?.5:1, cursor:swapping||!swapA||!swapB||swapA===swapB?'not-allowed':'pointer' }}>
            {swapping?'Swapping…':'Swap Periods'}
          </button>
        </div>
      )}

      {tab==='delete' && (
        <div style={{ ...sectionCard, border:`1px solid #fecdd3` }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.rose, marginBottom:3 }}>Bulk Delete</div>
          <div style={{ fontSize:12, color:C.ink400, marginBottom:20 }}>Delete all entries for a day or batch. This action cannot be undone.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:500, marginBottom:14 }}>
            <div><label style={S.lbl}>Delete by Day</label><Select value={delDay} onChange={e=>setDelDay(e.target.value)}><option value="">All Days</option>{DAYS.map(d=><option key={d} value={d}>{d} ({entries.filter(e=>e.day_name===d).length})</option>)}</Select></div>
            <div><label style={S.lbl}>Filter by Batch</label><Select value={delBatch} onChange={e=>setDelBatch(e.target.value)}><option value="">All Batches</option>{uniqueClasses.map(c=><option key={c} value={c}>{c}</option>)}</Select></div>
          </div>
          {(delDay||delBatch)&&(
            <div style={{ padding:'10px 14px', background:C.roseLt, borderRadius:8, fontSize:12, color:C.rose, fontWeight:600, marginBottom:14 }}>
              Will delete {entries.filter(e=>(!delDay||e.day_name===delDay)&&(!delBatch||e.class_name===delBatch)).length} entries
            </div>
          )}
          <button onClick={handleBulkDelete} style={{ ...S.btn.danger }}>Delete Selected Entries</button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Timetable({ currentUser }) {
  const isAdmin = currentUser?.role === 'Admin'
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
    setLoading(false)
  }

  useEffect(()=>{
    loadData()
    staffDB.forTimetable().then(data=>setStaffList(data))
  },[])

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
    else { setForm(emptyForm); setShowForm(false); loadData(); showToast('Entry added') }
    setSaving(false)
  }

  const handleFieldSave = async (id,field,value) => {
    setSavingEdit(true)
    const { error } = await supabase.from('timetable_entries').update({[field]:value}).eq('id',id)
    if (error) showToast('Update failed','error')
    else { const u=entries.map(e=>e.id===id?{...e,[field]:value}:e); setEntries(u); setConflicts(findConflicts(u)); showToast('Saved') }
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
  const toggleSelect   = id => { const n=new Set(selectedIds); if(n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n) }

  const teacherWorkload = useMemo(()=>{
    const d={}
    entries.forEach(e=>{ if(!e.teacher_name) return; if(!d[e.teacher_name]) d[e.teacher_name]={count:0,subjects:new Set(),days:new Set()}; d[e.teacher_name].count++; d[e.teacher_name].subjects.add(e.subject_name); d[e.teacher_name].days.add(e.day_name) })
    return Object.entries(d).map(([name,v])=>({name,...v,subjects:[...v.subjects],days:[...v.days]})).sort((a,b)=>b.count-a.count)
  },[entries])

  const weekLabel = `${fmt(formatDate(weekStart))} – ${fmt(formatDate(addDays(weekStart,5)))}`

  const navTabs = [
    { id:'week',    label:'Weekly' },
    { id:'cards',   label:'Cards' },
    { id:'table',   label:'Table' },
    { id:'teacher', label:'Teachers' },
    { id:'monitor', label:'Monitor' },
    ...(isAdmin ? [{ id:'admin', label:'Admin Setup' }] : []),
  ]

  return (
    <div style={{ padding:'24px 28px', fontFamily:FONT, background:'#f5f6fa', minHeight:'100vh', color:C.ink900 }}>
      <Toast toast={toast} />

      {deleteId && (
        <Overlay>
          <div style={{ background:'white', borderRadius:14, padding:'32px 28px', maxWidth:340, width:'90%', textAlign:'center', fontFamily:FONT }}>
            <div style={{ width:48, height:48, borderRadius:12, background:C.roseLt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:20 }}>🗑</div>
            <div style={{ fontWeight:700, fontSize:17, color:C.ink900, marginBottom:6 }}>Delete Entry?</div>
            <div style={{ fontSize:13, color:C.ink400, marginBottom:24 }}>This will permanently remove this timetable entry.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setDeleteId(null)} style={{ flex:1, ...S.btn.ghost }}>Cancel</button>
              <button onClick={()=>handleDelete(deleteId)} style={{ flex:1, ...S.btn.danger }}>Delete</button>
            </div>
          </div>
        </Overlay>
      )}

      {showPinModal && <AdminPinModal onSuccess={()=>{ setAdminUnlocked(true); setShowPinModal(false); setViewMode('admin') }} onClose={()=>setShowPinModal(false)} />}
      {editingEntry && <EditEntryModal entry={editingEntry} staffList={staffList} onClose={()=>setEditingEntry(null)} onSaved={()=>{ loadData(); setEditingEntry(null) }} />}

      {bulkMode && selectedIds.size > 0 && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:100, background:C.ink900, color:'white', padding:'12px 22px', borderRadius:12, display:'flex', alignItems:'center', gap:14, boxShadow:'0 8px 40px rgba(0,0,0,.3)', fontFamily:FONT }}>
          <span style={{ fontWeight:600, fontSize:13 }}>{selectedIds.size} selected</span>
          <button onClick={handleBulkDelete} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:C.rose, color:'white', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:FONT }}>Delete</button>
          <button onClick={()=>{ setBulkMode(false); setSelectedIds(new Set()) }} style={{ padding:'6px 14px', borderRadius:6, border:`1px solid rgba(255,255,255,.2)`, background:'transparent', color:'rgba(255,255,255,.7)', cursor:'pointer', fontSize:12, fontFamily:FONT }}>Done</button>
        </div>
      )}

      {/* PAGE HEADER */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ width:40, height:40, borderRadius:11, background:C.indigo, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>🕒</div>
              <div>
                <h1 style={{ fontSize:22, fontWeight:700, color:C.ink900, margin:0, letterSpacing:'-.4px' }}>Timetable</h1>
                <div style={{ fontSize:12, color:C.ink400, marginTop:1 }}>GNSI · Mon–Sat recurring schedule</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
              <span style={{ ...S.pill(C.indigoLt, C.indigo) }}>{todayName}</span>
              <span style={{ ...S.pill(C.ink50, C.ink400) }}>{todayEntries.length} classes today</span>
              {conflicts.length > 0 && (
                <button onClick={()=>setShowConflicts(!showConflicts)}
                  style={{ ...S.pill(C.roseLt, C.rose), border:'none', cursor:'pointer', fontFamily:FONT }}>
                  ⚠ {conflicts.length} conflict{conflicts.length>1?'s':''}
                </button>
              )}
              {savingEdit && <span style={{ ...S.pill(C.skyLt, C.sky) }}>Saving…</span>}
              {adminUnlocked && <span style={{ ...S.pill(C.amberLt, C.amber) }}>🔓 Admin</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <button onClick={handleExportCSV} style={S.btn.ghost}>↓ CSV</button>
            <button onClick={()=>window.print()} style={S.btn.ghost}>Print</button>
            {isAdmin && (
              <button onClick={()=>setShowForm(f=>!f)}
                style={{ ...S.btn.primary, background:showForm?C.ink500:C.indigo }}>
                {showForm ? '✕ Cancel' : '+ Add Entry'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showConflicts && conflicts.length > 0 && (
        <div style={{ background:C.roseLt, borderRadius:10, padding:16, marginBottom:20, border:`1px solid #fecdd3` }}>
          <div style={{ fontWeight:700, color:C.rose, fontSize:13, marginBottom:8 }}>Scheduling Conflicts</div>
          {conflicts.map((c,i)=>(
            <div key={i} style={{ fontSize:12, padding:'6px 10px', background:'white', borderRadius:6, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ ...S.pill(C.amberLt, C.amber), textTransform:'uppercase', fontSize:10, letterSpacing:'.04em' }}>Teacher</span>
              <span style={{ color:C.ink600 }}>{c.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* STAT CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        <StatCard icon="📋" label="Total Entries"  value={entries.length}        color={C.indigo} />
        <StatCard icon="🏫" label="Batches"         value={uniqueClasses.length}  color={C.emerald} />
        <StatCard icon="👥" label="Teachers"        value={uniqueTeachers.length} color={C.violet} />
        <StatCard icon="📅" label="Classes Today"   value={todayEntries.length}   color={C.amber} />
        <StatCard icon="⚠" label="Conflicts"       value={conflicts.length}      color={conflicts.length?C.rose:C.emerald} />
      </div>

      {/* ADD FORM */}
      {showForm && isAdmin && (
        <div style={{ background:'white', borderRadius:12, padding:24, marginBottom:20, border:`1px solid ${C.ink50}`, boxShadow:'0 2px 12px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.ink900, marginBottom:18 }}>New Timetable Entry</div>
          <form onSubmit={handleAdd}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
              {[
                { label:'Batch / Class *', key:'class_name',   ph:'Achiever' },
                { label:'Section',         key:'section',       ph:'A / B / Combined' },
                { label:'Subject *',       key:'subject_name',  ph:'Mathematics' },
                { label:'Period / Time *', key:'period_name',   ph:'7:00–7:45 AM' },
                { label:'Room',            key:'room_name',     ph:'Room 101' },
              ].map(f=>(
                <div key={f.key}><label style={S.lbl}>{f.label}</label><Input value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} placeholder={f.ph} /></div>
              ))}
              <div>
                <label style={S.lbl}>Day *</label>
                <Select value={form.day_name} onChange={e=>setForm({...form,day_name:e.target.value})}>
                  {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <div>
                <label style={S.lbl}>Teacher ({staffList.length})</label>
                <Select value={form.teacher_name} onChange={e=>setForm(f=>({...f,teacher_name:e.target.value}))}>
                  <option value="">— Select Teacher —</option>
                  {staffList.map(s=><option key={s.id} value={s.name}>{s.name}{s.designation?` (${s.designation})`:''}</option>)}
                </Select>
              </div>
            </div>
            <div style={{ marginTop:16, display:'flex', gap:10 }}>
              <button type="submit" disabled={saving} style={{ ...S.btn.primary, opacity:saving?.7:1 }}>{saving?'Saving…':'Save Entry'}</button>
              <button type="button" onClick={()=>setShowForm(false)} style={S.btn.ghost}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* NAV + FILTERS */}
      <div style={{ background:'white', borderRadius:12, padding:'12px 16px', marginBottom:16, border:`1px solid ${C.ink50}`, boxShadow:'0 1px 4px rgba(0,0,0,.03)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:2, flexWrap:'wrap' }}>
            {navTabs.map(v=>(
              <button key={v.id} onClick={()=>{
                if (v.id==='admin') { if(adminUnlocked) setViewMode('admin'); else setShowPinModal(true) }
                else setViewMode(v.id)
              }} style={{
                padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13,
                fontWeight:viewMode===v.id?600:400, fontFamily:FONT,
                background:viewMode===v.id?C.indigoLt:'transparent',
                color:viewMode===v.id?C.indigo:v.id==='admin'&&!adminUnlocked?C.amber:C.ink500,
                transition:'all .12s',
              }}>
                {v.label}{v.id==='admin'&&!adminUnlocked?' 🔐':''}
              </button>
            ))}

            {viewMode==='week' && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:8, padding:'5px 10px', background:C.ink50, borderRadius:8, border:`1px solid ${C.ink100}` }}>
                <button onClick={()=>setWeekStart(w=>addDays(w,-7))} style={{ border:'none', background:'none', cursor:'pointer', fontSize:14, color:C.ink700, padding:'0 4px', lineHeight:1 }}>‹</button>
                <span style={{ fontSize:12, fontWeight:500, color:C.ink700, whiteSpace:'nowrap' }}>{weekLabel}</span>
                <button onClick={()=>setWeekStart(w=>addDays(w,7))} style={{ border:'none', background:'none', cursor:'pointer', fontSize:14, color:C.ink700, padding:'0 4px', lineHeight:1 }}>›</button>
                <button onClick={()=>setWeekStart(getWeekStart())} style={{ ...S.btn.icon, padding:'3px 8px', fontSize:10 }}>Today</button>
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:14, color:C.ink300, pointerEvents:'none' }}>🔍</span>
              <input ref={searchRef} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ ...S.inp, paddingLeft:32, width:170 }} />
            </div>
            <Select value={dayFilter} onChange={e=>setDayFilter(e.target.value)} style={{ width:120 }}>
              <option value="All">All Days</option>{DAYS.map(d=><option key={d} value={d}>{d}</option>)}
            </Select>
            <Select value={classFilter} onChange={e=>setClassFilter(e.target.value)} style={{ width:130 }}>
              <option value="All">All Batches</option>{uniqueClasses.map(c=><option key={c} value={c}>{c}</option>)}
            </Select>
            <Select value={teacherFilter} onChange={e=>setTeacherFilter(e.target.value)} style={{ width:140 }}>
              <option value="All">All Teachers</option>{uniqueTeachers.map(t=><option key={t} value={t}>{t}</option>)}
            </Select>
            {viewMode==='table' && isAdmin && (
              <button onClick={()=>{ setBulkMode(!bulkMode); setSelectedIds(new Set()) }}
                style={{ ...S.btn.ghost, background:bulkMode?C.indigoLt:'transparent', color:bulkMode?C.indigo:C.ink500 }}>
                {bulkMode?'✓ Done':'☑ Bulk'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEWS */}
      {loading ? (
        <div style={{ background:'white', borderRadius:12, padding:60, textAlign:'center', color:C.ink400 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
          <div style={{ fontWeight:500, fontSize:15 }}>Loading timetable…</div>
        </div>

      ) : viewMode==='week' ? (
        <WeeklyView entries={entries} staffList={staffList} weekStart={weekStart} showToast={showToast} onSubstituteSaved={loadData} isAdmin={isAdmin} />

      ) : viewMode==='cards' ? (
        <CardView
          entries={filtered}
          staffList={staffList}
          isAdmin={isAdmin}
          onEdit={setEditingEntry}
          onDelete={setDeleteId}
          onSubstitute={null}
        />

      ) : viewMode==='monitor' ? (
        <MonitorPanel staffList={staffList} entries={entries} />

      ) : viewMode==='admin' ? (
        <AdminSetupPanel staffList={staffList} entries={entries} onRefresh={loadData} showToast={showToast} />

      ) : viewMode==='table' ? (
        <div style={{ background:'white', borderRadius:12, border:`1px solid ${C.ink50}`, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FONT }}>
              <thead>
                <tr style={{ background:C.ink900, position:'sticky', top:0 }}>
                  {bulkMode && <th style={{ padding:'11px 10px', textAlign:'center', color:'white' }}><input type="checkbox" checked={selectedIds.size===filtered.length&&filtered.length>0} onChange={()=>{ if(selectedIds.size===filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(e=>e.id))) }} /></th>}
                  {['#','Batch','Section','Day','Period','Subject','Teacher','Room',''].map((h,i)=>(
                    <th key={h+i} style={{ padding:'11px 14px', textAlign:i===0?'center':'left', color:'rgba(255,255,255,.6)', fontWeight:600, fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item,i)=>{
                  const hasConflict = conflicts.some(c=>c.entries.some(e=>e.id===item.id))
                  return (
                    <tr key={item.id}
                      style={{ background:hasConflict?C.roseLt:i%2===0?'white':C.ink20, borderBottom:`1px solid ${C.ink50}`, transition:'background .1s' }}
                      onMouseEnter={e=>e.currentTarget.style.background=hasConflict?'#fecdd3':C.indigoLt}
                      onMouseLeave={e=>e.currentTarget.style.background=hasConflict?C.roseLt:i%2===0?'white':C.ink20}>
                      {bulkMode && <td style={{ padding:'10px', textAlign:'center' }}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={()=>toggleSelect(item.id)} /></td>}
                      <td style={{ padding:'10px 14px', textAlign:'center', color:C.ink300, fontSize:12 }}>{i+1}</td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.class_name} onSave={v=>handleFieldSave(item.id,'class_name',v)} /></td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.section||''} onSave={v=>handleFieldSave(item.id,'section',v)} /></td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.day_name} type="select" options={DAYS} onSave={v=>handleFieldSave(item.id,'day_name',v)} /></td>
                      <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}><EditCell value={item.period_name||''} onSave={v=>handleFieldSave(item.id,'period_name',v)} /></td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.subject_name||''} onSave={v=>handleFieldSave(item.id,'subject_name',v)} /></td>
                      <td style={{ padding:'8px 12px' }}>
                        <EditCell value={item.teacher_name||''} type="select" options={['',...staffList.map(s=>s.name)]} onSave={v=>handleFieldSave(item.id,'teacher_name',v)} />
                      </td>
                      <td style={{ padding:'8px 12px' }}><EditCell value={item.room_name||''} onSave={v=>handleFieldSave(item.id,'room_name',v)} /></td>
                      <td style={{ padding:'8px 12px' }}>
                        {isAdmin && (
                          <div style={{ display:'flex', gap:5, justifyContent:'center' }}>
                            <button onClick={()=>setEditingEntry(item)} style={S.btn.icon}>✏</button>
                            <button onClick={()=>setDeleteId(item.id)} style={S.btn.iconDanger}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!filtered.length && (
                  <tr><td colSpan={bulkMode?10:9} style={{ padding:48, textAlign:'center', color:C.ink300 }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
                    No entries match your filters
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.ink50}`, fontSize:12, color:C.ink400 }}>
              {filtered.length} entries{search||dayFilter!=='All'||classFilter!=='All'||teacherFilter!=='All'?' (filtered)':''}
            </div>
          )}
        </div>

      ) : (
        /* TEACHER WORKLOAD */
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))', gap:14 }}>
            {teacherWorkload.map(t=>(
              <div key={t.name} style={{ background:'white', borderRadius:12, padding:18, border:`1px solid ${C.ink50}`, boxShadow:'0 1px 4px rgba(0,0,0,.04)', fontFamily:FONT }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:C.indigoLt, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:C.indigo }}>
                      {t.name.split(' ').map(w=>w[0]).slice(0,2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color:C.ink900 }}>{t.name}</div>
                      <div style={{ fontSize:11, color:C.ink400 }}>{t.days.length} days/week</div>
                    </div>
                  </div>
                  <span style={{ ...S.pill(C.ink900, 'white'), fontWeight:700 }}>{t.count}</span>
                </div>
                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  {[
                    { val:(t.count*0.75).toFixed(1)+'h', label:'Weekly', color:C.indigo },
                    { val:t.days.length, label:'Days', color:C.emerald },
                    { val:t.subjects.length, label:'Subjects', color:C.violet },
                  ].map(s=>(
                    <div key={s.label} style={{ flex:1, textAlign:'center', padding:'8px 6px', background:C.ink20, borderRadius:8 }}>
                      <div style={{ fontSize:17, fontWeight:700, color:s.color }}>{s.val}</div>
                      <div style={{ fontSize:10, color:C.ink400, textTransform:'uppercase', letterSpacing:'.05em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                  {t.subjects.filter(Boolean).map(s=>(
                    <span key={s} style={{ ...S.pill(C.violetLt, C.violet), fontSize:10 }}>{s}</span>
                  ))}
                </div>
                <div style={{ fontSize:11, color:C.ink400 }}>📅 {t.days.join(' · ')}</div>
              </div>
            ))}
            {teacherWorkload.length===0 && (
              <div style={{ color:C.ink300, padding:40, textAlign:'center', fontSize:13 }}>No teacher data yet</div>
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize:11, color:C.ink300, textAlign:'center', marginTop:28, paddingBottom:8 }}>
        Weekly view · Cards view with substitute support · Monitor tab shows live HR data · Admin PIN required for setup
      </div>
      <style>{`@media print { button { display:none!important; } }`}</style>
    </div>
  )
}
