// TabSyllabus.jsx — Enhanced Syllabus Tracker
// ─────────────────────────────────────────────────────────────────────────────
// NEW in this version:
//  ✅ Admin: Course Duration Setup (start/end date, teaching days, holidays)
//  ✅ Calendar-aware exact completion engine (excludes weekends, holidays)
//  ✅ Required pace vs actual pace per syllabus row
//  ✅ Exact "completes on" date at current pace vs course deadline
//  ✅ Staff read-only view — can only mark their own topics complete
//  ✅ Admin overview dashboard: on-track / behind / critical flags
//  ✅ SQL migration included at bottom as comment
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II','English Grammar',
  'General Knowledge','General Science','Reasoning','Mental Ability',
  'Hindi','Vocabulary','Meitei Mayek',
]
const TOPIC_TAGS = ['important','exam','revision','easy','hard']
const TAG_META = {
  important: { color:'#dc2626', bg:'#fee2e2', icon:'⭐' },
  exam:      { color:'#7c3aed', bg:'#f3e8ff', icon:'📝' },
  revision:  { color:'#0891b2', bg:'#e0f2fe', icon:'🔁' },
  easy:      { color:'#16a34a', bg:'#dcfce7', icon:'✅' },
  hard:      { color:'#d97706', bg:'#fef9c3', icon:'🔥' },
}
const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_MAP  = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 }

const today   = () => new Date().toISOString().split('T')[0]
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }) : '—'
const pct     = (s,m) => m > 0 ? Math.min(100,Math.round((s/m)*100)) : 0
const scoreColor = p => p >= 75 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626'
const scoreBg    = p => p >= 75 ? '#dcfce7' : p >= 50 ? '#fef9c3' : '#fee2e2'

// ─── Calendar Engine ──────────────────────────────────────────────────────────
// Count actual teaching days between two dates given allowed weekdays + holiday exclusions
function countTeachingDays(fromStr, toStr, teachingDays=ALL_DAYS, holidays=[]) {
  if (!fromStr || !toStr) return 0
  const holidaySet = new Set(holidays)
  const allowedDow = new Set(teachingDays.map(d => DAY_MAP[d]).filter(Boolean))
  let count = 0
  const cur = new Date(fromStr)
  const end = new Date(toStr)
  while (cur <= end) {
    const dow = cur.getDay()
    const ds  = cur.toISOString().split('T')[0]
    if (allowedDow.has(dow) && !holidaySet.has(ds)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// Given a start date, count forward N teaching days and return the landing date
function addTeachingDays(fromStr, n, teachingDays=ALL_DAYS, holidays=[]) {
  if (!fromStr || n <= 0) return fromStr
  const holidaySet = new Set(holidays)
  const allowedDow = new Set(teachingDays.map(d => DAY_MAP[d]).filter(Boolean))
  let count = 0
  const cur = new Date(fromStr)
  cur.setDate(cur.getDate() + 1) // start from next day
  while (count < n) {
    const dow = cur.getDay()
    const ds  = cur.toISOString().split('T')[0]
    if (allowedDow.has(dow) && !holidaySet.has(ds)) count++
    if (count < n) cur.setDate(cur.getDate() + 1)
  }
  return cur.toISOString().split('T')[0]
}

// ─── Exact Pace Engine ────────────────────────────────────────────────────────
// Returns rich completion data for a syllabus row given course duration settings
function computeExactPace(row, logs, durationSetting) {
  const rowLogs = logs
    .filter(l => l.course===row.course && l.subtype===row.subtype &&
      (!row.class_name || l.class_name===row.class_name) && l.subject_name===row.subject_name)
    .sort((a,b) => (a.teaching_date ?? '').localeCompare(b.teaching_date ?? ''))

  const done = rowLogs.length
  const remaining = Math.max(0, row.total_topics - done)

  // Actual pace from logs
  let actualRate = null
  let projectedEndDate = null
  if (rowLogs.length >= 2) {
    const first = new Date(rowLogs[0].teaching_date)
    const last  = new Date(rowLogs[rowLogs.length-1].teaching_date)
    const calDays = Math.max(1, (last - first) / 86400000)
    actualRate = rowLogs.length / calDays // topics per calendar day
  }

  if (!durationSetting) {
    // Fallback: simple calendar-day projection (original logic)
    if (actualRate && remaining > 0) {
      const projDays = Math.ceil(remaining / actualRate)
      const projDate = new Date()
      projDate.setDate(projDate.getDate() + projDays)
      projectedEndDate = projDate.toISOString().split('T')[0]
    }
    return {
      done, remaining, actualRate,
      projectedEndDate, requiredRate: null,
      availableTeachingDays: null, deadlineDate: null,
      onTrack: null, critical: false, daysLeft: null,
      hasSetting: false,
    }
  }

  const { start_date, end_date, teaching_days, holidays } = durationSetting
  const todayStr = today()

  // Teaching days remaining until course deadline
  const availableTeachingDays = countTeachingDays(todayStr, end_date, teaching_days||ALL_DAYS, holidays||[])

  // Required rate: topics remaining / available teaching days
  const requiredRate = availableTeachingDays > 0 ? (remaining / availableTeachingDays) : null

  // Total teaching days in course
  const totalTeachingDays = countTeachingDays(start_date, end_date, teaching_days||ALL_DAYS, holidays||[])

  // Days elapsed since course started
  const elapsedTeachingDays = countTeachingDays(start_date, todayStr, teaching_days||ALL_DAYS, holidays||[])

  // Time fraction used
  const timeFraction = totalTeachingDays > 0 ? elapsedTeachingDays / totalTeachingDays : 0
  const topicFraction = row.total_topics > 0 ? done / row.total_topics : 0

  // Project completion at actual pace (teaching days)
  if (actualRate && remaining > 0) {
    // actualRate is topics/calendar-day; convert to find calendar days needed
    const calDaysNeeded = Math.ceil(remaining / actualRate)
    const projDate = new Date()
    projDate.setDate(projDate.getDate() + calDaysNeeded)
    projectedEndDate = projDate.toISOString().split('T')[0]
  } else if (remaining === 0) {
    projectedEndDate = rowLogs[rowLogs.length-1]?.teaching_date || todayStr
  }

  // Determine on-track status
  const onTrack = projectedEndDate ? projectedEndDate <= end_date : (topicFraction >= timeFraction * 0.9)

  // Critical: < 20% time left but > 50% topics remaining
  const critical = (1 - timeFraction) < 0.20 && topicFraction < 0.50

  // Days remaining (calendar)
  const daysLeft = Math.max(0, Math.ceil((new Date(end_date) - new Date(todayStr)) / 86400000))

  return {
    done, remaining, actualRate,
    projectedEndDate,
    requiredRate,       // topics/teaching-day needed
    availableTeachingDays,
    totalTeachingDays,
    elapsedTeachingDays,
    timeFraction,
    topicFraction,
    deadlineDate: end_date,
    onTrack, critical,
    daysLeft,
    hasSetting: true,
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card:  { background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)', padding:20, marginBottom:16 },
  btn:   (color='#1e3a5f', disabled=false) => ({ backgroundColor:disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontSize:13, minHeight:44, fontFamily:'inherit' }),
  btnSm: (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:36, fontFamily:'inherit' }),
  input: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44, fontFamily:'inherit' },
  label: { display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' },
  select:{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44, fontFamily:'inherit' },
  badge: (color, bg) => ({ padding:'3px 9px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color, display:'inline-flex', alignItems:'center', gap:3 }),
}

// ─── useToast ─────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const show = useCallback((msg, color='#1e3a5f') => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ msg, color })
    timer.current = setTimeout(() => setToast(null), 3200)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const el = toast ? (
    <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:999999, background:'white', border:`1px solid ${toast.color}`, borderLeft:`4px solid ${toast.color}`, borderRadius:10, padding:'12px 20px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.18)', maxWidth:'90vw', color:'#1e293b', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:toast.color, flexShrink:0 }}/>
      {toast.msg}
    </div>
  ) : null
  return { show, el }
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel='Confirm', danger=false, onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onCancel}>
      <div style={{ background:'white', borderRadius:12, padding:24, width:380, maxWidth:'95vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:20, lineHeight:1.7 }}>{message}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onConfirm} style={{ flex:1, padding:12, borderRadius:8, border:'none', background:danger?'#dc2626':'#1e3a5f', color:'white', fontWeight:700, fontSize:14, cursor:'pointer', minHeight:44, fontFamily:'inherit' }}>{confirmLabel}</button>
          <button onClick={onCancel} style={{ padding:'12px 20px', borderRadius:8, border:'1px solid #e2e8f0', background:'white', color:'#64748b', fontWeight:600, fontSize:13, cursor:'pointer', minHeight:44, fontFamily:'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color, height=8, showPct=true }) {
  const p = pct(value, max)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', background:color||scoreColor(p), borderRadius:4, transition:'width .5s' }}/>
      </div>
      {showPct && <span style={{ fontSize:11, fontWeight:700, color:color||scoreColor(p), minWidth:32, textAlign:'right' }}>{p}%</span>}
    </div>
  )
}

// ─── TagPill ──────────────────────────────────────────────────────────────────
function TagPill({ tag, onRemove }) {
  const m = TAG_META[tag] || { color:'#64748b', bg:'#f1f5f9', icon:'🏷️' }
  return (
    <span style={{ ...S.badge(m.color, m.bg), padding:'2px 7px', fontSize:10 }}>
      {m.icon} {tag}
      {onRemove && <span onClick={onRemove} style={{ cursor:'pointer', marginLeft:2, opacity:.7 }}>✕</span>}
    </span>
  )
}

// ─── PaceCard — rich completion info block ────────────────────────────────────
function PaceCard({ pace, compact=false }) {
  if (!pace) return null
  const { done, remaining, actualRate, projectedEndDate, requiredRate,
    availableTeachingDays, deadlineDate, onTrack, critical, daysLeft, hasSetting } = pace

  if (compact) {
    // Used inside table rows
    if (!hasSetting) {
      return actualRate ? (
        <div style={{ fontSize:11, color:'#64748b' }}>
          {actualRate.toFixed(2)}/day · Est: {fmtDate(projectedEndDate)}
        </div>
      ) : <span style={{ fontSize:11, color:'#94a3b8' }}>No data</span>
    }
    return (
      <div style={{ fontSize:11, lineHeight:1.7 }}>
        <div style={{ color:onTrack?'#16a34a':'#dc2626', fontWeight:700 }}>
          {critical?'🔴 CRITICAL':onTrack?'✅ On track':'⚠️ Behind'}
        </div>
        {requiredRate != null && <div style={{ color:'#374151' }}>Need <b>{requiredRate.toFixed(2)}</b>/day · Have <b>{actualRate?.toFixed(2)||'—'}</b>/day</div>}
        <div style={{ color:'#64748b' }}>Deadline: {fmtDate(deadlineDate)} ({daysLeft}d left)</div>
        {projectedEndDate && <div style={{ color:onTrack?'#16a34a':'#dc2626' }}>At pace: {fmtDate(projectedEndDate)}</div>}
      </div>
    )
  }

  // Full card version
  const statusColor = critical?'#dc2626':onTrack?'#16a34a':'#d97706'
  const statusBg    = critical?'#fee2e2':onTrack?'#dcfce7':'#fef9c3'
  const statusLabel = critical?'🔴 Critical — Urgent action needed':onTrack?'✅ On track':'⚠️ Behind schedule'

  return (
    <div style={{ marginTop:10, padding:'12px 14px', borderRadius:10, background:statusBg, border:`1px solid ${statusColor}40` }}>
      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:8 }}>
        <span style={{ fontWeight:800, color:statusColor, fontSize:13 }}>{statusLabel}</span>
        {daysLeft != null && <span style={{ fontSize:12, color:'#64748b' }}>{daysLeft} calendar days until deadline</span>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
        {[
          { label:'Topics done', value:`${done} / ${done+remaining}`, color:'#1e3a5f' },
          { label:'Topics left', value:remaining, color:remaining>0?'#d97706':'#16a34a' },
          hasSetting && availableTeachingDays != null
            ? { label:'Teaching days left', value:availableTeachingDays, color:'#7c3aed' }
            : null,
          requiredRate != null
            ? { label:'Required pace', value:`${requiredRate.toFixed(2)}/day`, color:statusColor }
            : null,
          actualRate != null
            ? { label:'Actual pace', value:`${actualRate.toFixed(2)}/day`, color: (requiredRate && actualRate < requiredRate)?'#dc2626':'#16a34a' }
            : { label:'Actual pace', value:'Not enough data', color:'#94a3b8' },
          deadlineDate
            ? { label:'Course deadline', value:fmtDate(deadlineDate), color:'#1e3a5f' }
            : null,
          projectedEndDate && remaining > 0
            ? { label:'Projected finish', value:fmtDate(projectedEndDate), color:onTrack?'#16a34a':'#dc2626' }
            : remaining === 0
            ? { label:'Completed!', value:'All topics done', color:'#16a34a' }
            : null,
        ].filter(Boolean).map((item,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.7)', borderRadius:8, padding:'8px 12px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>{item.label}</div>
            <div style={{ fontSize:14, fontWeight:800, color:item.color, fontFamily:"'JetBrains Mono',monospace" }}>{item.value}</div>
          </div>
        ))}
      </div>
      {requiredRate != null && actualRate != null && (
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>
            Pace gap: {actualRate >= requiredRate
              ? <span style={{ color:'#16a34a', fontWeight:700 }}>+{(actualRate-requiredRate).toFixed(2)}/day ahead</span>
              : <span style={{ color:'#dc2626', fontWeight:700 }}>{(requiredRate-actualRate).toFixed(2)}/day behind required</span>}
          </div>
          {/* Visual gap bar */}
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <div style={{ flex:1, height:6, background:'#e2e8f0', borderRadius:3, overflow:'hidden', position:'relative' }}>
              <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${Math.min(100,(actualRate/Math.max(requiredRate,0.01))*100)}%`, background:actualRate>=requiredRate?'#16a34a':'#dc2626', borderRadius:3, transition:'width .5s' }}/>
            </div>
            <span style={{ fontSize:10, color:'#64748b', minWidth:60, textAlign:'right' }}>
              {((actualRate/Math.max(requiredRate,0.01))*100).toFixed(0)}% of required
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CourseDurationForm — Admin sets course duration ─────────────────────────
function CourseDurationForm({ courses, subtypesFor, settings, onSaved, showToast }) {
  const [form, setForm] = useState({
    course:'', subtype:'', start_date:'', end_date:'',
    teaching_days:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    holidays_text:'', topics_per_day_target:1,
  })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const subtypes = form.course ? subtypesFor(form.course) : []

  const toggleDay = day => {
    setForm(f => ({
      ...f,
      teaching_days: f.teaching_days.includes(day)
        ? f.teaching_days.filter(d => d !== day)
        : [...f.teaching_days, day]
    }))
  }

  const loadForEdit = s => {
    setEditingId(s.id)
    setForm({
      course: s.course, subtype: s.subtype||'',
      start_date: s.start_date, end_date: s.end_date,
      teaching_days: s.teaching_days||ALL_DAYS,
      holidays_text: (s.holidays||[]).join('\n'),
      topics_per_day_target: s.topics_per_day_target||1,
    })
  }

  const handleSave = async e => {
    e.preventDefault()
    if (!form.course || !form.start_date || !form.end_date) {
      showToast('Course, start date and end date are required', '#dc2626'); return
    }
    if (form.end_date <= form.start_date) {
      showToast('End date must be after start date', '#dc2626'); return
    }
    setSaving(true)
    const holidays = form.holidays_text.split('\n').map(d=>d.trim()).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d))
    const totalTeachingDays = countTeachingDays(form.start_date, form.end_date, form.teaching_days, holidays)
    const payload = {
      course: form.course,
      subtype: form.subtype||null,
      start_date: form.start_date,
      end_date: form.end_date,
      teaching_days: form.teaching_days,
      holidays,
      total_teaching_days: totalTeachingDays,
      topics_per_day_target: parseFloat(form.topics_per_day_target)||1,
    }
    let error
    if (editingId) {
      ({ error } = await supabase.from('course_duration_settings').update(payload).eq('id', editingId))
    } else {
      ({ error } = await supabase.from('course_duration_settings').upsert([payload], { onConflict:'course,subtype' }))
    }
    if (error) { showToast('Save failed: '+error.message, '#dc2626'); setSaving(false); return }
    showToast(`Duration saved — ${totalTeachingDays} teaching days`, '#16a34a')
    setEditingId(null)
    setForm({ course:'', subtype:'', start_date:'', end_date:'', teaching_days:ALL_DAYS, holidays_text:'', topics_per_day_target:1 })
    onSaved()
    setSaving(false)
  }

  return (
    <div>
      <form onSubmit={handleSave} style={{ ...S.card, border:'1px solid #1e3a5f33' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1e3a5f', marginBottom:14 }}>
          {editingId ? '✏️ Edit Course Duration' : '➕ Set Course Duration'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:14 }}>
          <div>
            <label style={S.label}>Course *</label>
            <select value={form.course} onChange={e=>setForm(f=>({...f,course:e.target.value,subtype:''}))} required style={S.select}>
              <option value="">Select</option>
              {courses.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Batch/Subtype</label>
            <select value={form.subtype} onChange={e=>setForm(f=>({...f,subtype:e.target.value}))} style={S.select}>
              <option value="">All batches</option>
              {subtypes.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Course Start *</label>
            <input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} required style={S.input}/>
          </div>
          <div>
            <label style={S.label}>Course End (Deadline) *</label>
            <input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} required style={S.input}/>
          </div>
          <div>
            <label style={S.label}>Target topics/teaching-day</label>
            <input type="number" min="0.1" max="10" step="0.1" value={form.topics_per_day_target} onChange={e=>setForm(f=>({...f,topics_per_day_target:e.target.value}))} style={S.input}/>
          </div>
        </div>

        {/* Teaching days selector */}
        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Teaching Days</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
            {ALL_DAYS.map(day => (
              <button key={day} type="button" onClick={()=>toggleDay(day)}
                style={{ padding:'6px 12px', borderRadius:8, border:`2px solid ${form.teaching_days.includes(day)?'#1e3a5f':'#e2e8f0'}`, background:form.teaching_days.includes(day)?'#1e3a5f':'white', color:form.teaching_days.includes(day)?'white':'#64748b', fontWeight:600, fontSize:12, cursor:'pointer', minHeight:36, fontFamily:'inherit' }}>
                {day.slice(0,3)}
              </button>
            ))}
          </div>
          {form.teaching_days.length > 0 && form.start_date && form.end_date && (
            <div style={{ marginTop:8, fontSize:12, color:'#16a34a', fontWeight:600 }}>
              📅 {countTeachingDays(form.start_date, form.end_date, form.teaching_days, [])} teaching days in this period
            </div>
          )}
        </div>

        {/* Holidays */}
        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Holidays to exclude (one YYYY-MM-DD per line)</label>
          <textarea value={form.holidays_text} onChange={e=>setForm(f=>({...f,holidays_text:e.target.value}))}
            rows={4} placeholder={'2026-08-15\n2026-10-02\n2026-11-01'}
            style={{ ...S.input, resize:'vertical', fontFamily:'monospace', fontSize:12 }}/>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button type="submit" disabled={saving} style={S.btn('#16a34a', saving)}>
            {saving ? '⏳ Saving...' : '✅ Save Duration'}
          </button>
          {editingId && <button type="button" onClick={()=>{ setEditingId(null); setForm({ course:'', subtype:'', start_date:'', end_date:'', teaching_days:ALL_DAYS, holidays_text:'', topics_per_day_target:1 }) }} style={S.btn('#64748b')}>✖ Cancel</button>}
        </div>
      </form>

      {/* Existing settings list */}
      {settings.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1e3a5f', marginBottom:12 }}>📋 Saved Course Durations</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {settings.map(s => {
              const td = countTeachingDays(s.start_date, s.end_date, s.teaching_days||ALL_DAYS, s.holidays||[])
              const tdLeft = countTeachingDays(today(), s.end_date, s.teaching_days||ALL_DAYS, s.holidays||[])
              const calLeft = Math.max(0, Math.ceil((new Date(s.end_date)-new Date())/86400000))
              return (
                <div key={s.id} style={{ padding:'12px 16px', border:'1px solid #e2e8f0', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                  <div>
                    <div style={{ fontWeight:800, color:'#1e293b', fontSize:13 }}>{s.course}{s.subtype?` · ${s.subtype}`:' (All batches)'}</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                      {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
                      <span style={S.badge('#1e3a5f','#eff6ff')}>{td} teaching days total</span>
                      <span style={S.badge(calLeft<30?'#dc2626':'#16a34a', calLeft<30?'#fee2e2':'#dcfce7')}>{tdLeft} days left</span>
                      <span style={S.badge('#7c3aed','#f3e8ff')}>{(s.teaching_days||ALL_DAYS).map(d=>d.slice(0,2)).join(' ')}</span>
                      {(s.holidays||[]).length > 0 && <span style={S.badge('#d97706','#fef9c3')}>{s.holidays.length} holidays</span>}
                    </div>
                  </div>
                  <button onClick={()=>loadForEdit(s)} style={S.btnSm('#0891b2')}>✏️ Edit</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main TabSyllabus ─────────────────────────────────────────────────────────
export default function TabSyllabus({ logs=[], courseData, monthlySyllabus=[], currentUser }) {
  const { show: showToast, el: toastEl } = useToast()
  const { courses=[], subtypesFor=()=>[], classesFor=()=>[], batchIdFor=()=>'' } = courseData || {}

  const _rawRole = (
  currentUser?.role ||
  currentUser?.user?.role ||
  currentUser?.profile?.role ||
  ''
).toLowerCase().trim()
const _name = (
  currentUser?.name ||
  currentUser?.user?.name ||
  currentUser?.profile?.name ||
  currentUser?.email ||
  ''
)
const isAdmin = !currentUser || ['admin','manager','administrator','principal'].includes(_rawRole)
const isStaff = _rawRole === 'teacher'
const staffName = _name

  // ── State ──
  const [syllabus,      setSyllabus]     = useState([])
  const [topics,        setTopics]       = useState({})
  const [durationSettings, setDurationSettings] = useState([])
  const [loading,       setLoading]      = useState(true)
  const [saving,        setSaving]       = useState(false)
  const [showForm,      setShowForm]     = useState(false)
  const [editingRow,    setEditingRow]   = useState(null)
  const [expandedId,    setExpandedId]   = useState(null)
  const [topicForm,     setTopicForm]    = useState({ name:'', expected_date:'', tags:[] })
  const [addingTopicTo, setAddingTopicTo]= useState(null)
  const [editingTopicId, setEditingTopicId] = useState(null)
  const [filterBatch,   setFilterBatch]  = useState('All')
  const [filterSubject, setFilterSubject]= useState('All')
  const [topicSearch,   setTopicSearch]  = useState('')
  const [viewMode,      setViewMode]     = useState('cards')
  const [confirmDel,    setConfirmDel]   = useState(null)
  const [dragIdx,       setDragIdx]      = useState(null)
  const [dragOver,      setDragOver]     = useState(null)
  const [activeSubView, setActiveSubView]= useState('overview')
  const [csvText,       setCsvText]      = useState('')
  const [csvSyllabusId, setCsvSyllabusId]= useState('')
  const [copyFrom,      setCopyFrom]     = useState('')
  const [copyTo,        setCopyTo]       = useState('')
  const [scheduleId,    setScheduleId]   = useState('')
  const [scheduleStart, setScheduleStart]= useState(today())
  const [schedule,      setSchedule]     = useState([])
  const [tagFilter,     setTagFilter]    = useState('All')
  const [weeklyDigest,  setWeeklyDigest] = useState(null)

  const blankForm = { course:'', subtype:'', class_name:'', subject_name:'', total_topics:'', expected_end_date:'' }
  const [form, setForm] = useState(blankForm)

  // ── Fetch ──
  const fetchDurationSettings = useCallback(async () => {
    const { data, error } = await supabase.from('course_duration_settings').select('*').order('course')
    if (error) showToast('Duration settings: '+error.message, '#d97706')
    if (data) setDurationSettings(data)
  }, [])

  const fetchSyllabus = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('teaching_syllabus').select('*').order('course')
    if (error) { showToast('Failed to load: '+error.message, '#dc2626'); setLoading(false); return }
    setSyllabus(data||[])
    try {
      const { data:td, error:te } = await supabase.from('syllabus_topics').select('*').order('order_num')
      if (te) showToast('Topics: '+te.message, '#d97706')
      if (td) {
        const map = {}
        td.forEach(t => { if (!map[t.syllabus_id]) map[t.syllabus_id]=[]; map[t.syllabus_id].push(t) })
        setTopics(map)
      }
    } catch(e) { showToast('syllabus_topics: '+e.message, '#d97706') }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSyllabus(); fetchDurationSettings() }, [fetchSyllabus, fetchDurationSettings])

  // ── Duration setting lookup per syllabus row ──
  const getDurationSetting = useCallback((row) => {
    // Try course+subtype first, then course only
    return durationSettings.find(s => s.course===row.course && s.subtype===row.subtype)
        || durationSettings.find(s => s.course===row.course && !s.subtype)
        || null
  }, [durationSettings])

  // ── Helpers ──
  const getLogsFor   = useCallback(row => logs.filter(l => l.course===row.course && l.subtype===row.subtype && (!row.class_name||l.class_name===row.class_name) && l.subject_name===row.subject_name), [logs])
  const getCompleted = useCallback(row => getLogsFor(row).length, [getLogsFor])

  // ── Computed ──
  const allBatches  = [...new Set(syllabus.map(s => s.subtype).filter(Boolean))]
  const allSubjects = [...new Set(syllabus.map(s => s.subject_name).filter(Boolean))]

  // For staff: only show rows matching their logged subjects
  const staffSubjects = useMemo(() => {
    if (!isStaff || !staffName) return new Set()
    return new Set(logs.filter(l => l.teacher_name===staffName).map(l => l.subject_name))
  }, [logs, isStaff, staffName])

  // Admin can add/edit topics on any row. Staff can add/edit topics only for
  // subjects they have actually taught (per their own logs). Delete stays admin-only.
  const canEditTopicsFor = row => isAdmin || (isStaff && staffSubjects.has(row?.subject_name))

  const filtered = useMemo(() => {
    let rows = syllabus.filter(r =>
      (filterBatch==='All'   || r.subtype===filterBatch) &&
      (filterSubject==='All' || r.subject_name===filterSubject)
    )
    if (isStaff && staffName) {
      rows = rows.filter(r => staffSubjects.has(r.subject_name))
    }
    if (topicSearch.trim()) {
      const q = topicSearch.toLowerCase()
      rows = rows.filter(r =>
        r.subject_name?.toLowerCase().includes(q) ||
        r.subtype?.toLowerCase().includes(q) ||
        (topics[r.id]||[]).some(t => t.topic_name?.toLowerCase().includes(q))
      )
    }
    if (tagFilter !== 'All') {
      rows = rows.filter(r => (topics[r.id]||[]).some(t => (t.tags||[]).includes(tagFilter)))
    }
    return rows
  }, [syllabus, filterBatch, filterSubject, topicSearch, tagFilter, topics, isStaff, staffName, staffSubjects])

  // ── Stats ──
  const stats = useMemo(() => {
    const paces    = syllabus.map(r => computeExactPace(r, logs, getDurationSetting(r)))
    const avgPct   = syllabus.length>0 ? Math.round(syllabus.reduce((a,r) => a+Math.min(100,pct(getCompleted(r),r.total_topics)),0)/syllabus.length) : 0
    const offTrack = paces.filter(p => p.hasSetting && !p.onTrack && !p.critical).length
    const critical = paces.filter(p => p.critical).length
    const complete = syllabus.filter(r => r.total_topics>0 && getCompleted(r)>=r.total_topics).length
    const noSetting= syllabus.filter(r => !getDurationSetting(r)).length
    return { avgPct, offTrack, critical, complete, noSetting }
  }, [syllabus, logs, getDurationSetting])

  // ── CRUD (admin only) ──
  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    if (editingRow) {
      const { error } = await supabase.from('teaching_syllabus').update({ total_topics:parseInt(form.total_topics), expected_end_date:form.expected_end_date||null }).eq('id', editingRow.id)
      if (error) showToast('Error: '+error.message, '#dc2626')
      else { setEditingRow(null); setShowForm(false); fetchSyllabus(); showToast('Updated ✅', '#16a34a') }
    } else {
      const { error } = await supabase.from('teaching_syllabus').upsert([{
        course:form.course, subtype:form.subtype||null, class_name:form.class_name||null,
        subject_name:form.subject_name, total_topics:parseInt(form.total_topics), expected_end_date:form.expected_end_date||null,
      }], { onConflict:'course,subtype,class_name,subject_name' })
      if (error) showToast('Error: '+error.message, '#dc2626')
      else { setForm(blankForm); setShowForm(false); fetchSyllabus(); showToast('Saved ✅', '#16a34a') }
    }
    setSaving(false)
  }

  const handleDelete = async id => {
    const { error } = await supabase.from('teaching_syllabus').delete().eq('id', id)
    if (error) showToast('Delete failed', '#dc2626')
    else { setConfirmDel(null); fetchSyllabus(); showToast('Deleted', '#dc2626') }
  }

  const handleAddTopic = async syllabusId => {
    if (!topicForm.name.trim()) return
    const existing = topics[syllabusId]||[]
    const { error } = await supabase.from('syllabus_topics').insert([{
      syllabus_id:syllabusId, topic_name:topicForm.name,
      expected_date:topicForm.expected_date||null,
      order_num:existing.length+1,
      tags:topicForm.tags||[],
    }])
    if (error) showToast('Topic add failed: '+error.message, '#dc2626')
    else { setTopicForm({ name:'', expected_date:'', tags:[] }); setAddingTopicTo(null); fetchSyllabus(); showToast('Topic added', '#16a34a') }
  }

  // Staff/admin: edit an existing topic's name, expected date, and tags.
  // Gated by canEditTopicsFor at the call site (own-subject check for staff).
  const handleEditTopic = async (topicId, updates) => {
    if (!updates.topic_name?.trim()) { showToast('Topic name cannot be empty', '#dc2626'); return }
    const { error } = await supabase.from('syllabus_topics').update({
      topic_name: updates.topic_name.trim(),
      expected_date: updates.expected_date || null,
      tags: updates.tags || [],
    }).eq('id', topicId)
    if (error) showToast('Update failed: '+error.message, '#dc2626')
    else { setEditingTopicId(null); fetchSyllabus(); showToast('Topic updated ✅', '#16a34a') }
  }

  const handleMarkTopic = async (topic, done) => {
    // Staff can only mark topics for their own subjects
    if (isStaff) {
      const row = syllabus.find(r => r.id===topic.syllabus_id)
      if (row && !staffSubjects.has(row.subject_name)) {
        showToast('You can only mark topics for your own subjects', '#dc2626'); return
      }
    }
    const { error } = await supabase.from('syllabus_topics').update({ completed:done, completed_at:done?new Date().toISOString():null }).eq('id', topic.id)
    if (error) showToast('Update failed', '#dc2626')
    else fetchSyllabus()
  }

  const handleDeleteTopic = async id => {
    await supabase.from('syllabus_topics').delete().eq('id', id)
    fetchSyllabus()
  }

  // ── Auto-mark ──
  const handleAutoMark = async syllabusId => {
    const row      = syllabus.find(r => r.id===syllabusId)
    if (!row) return
    const rowLogs  = getLogsFor(row)
    const rowTopics= topics[syllabusId]||[]
    if (!rowTopics.length) { showToast('No topics defined — add topics first', '#d97706'); return }
    let synced = 0
    for (const t of rowTopics) {
      if (t.completed) continue
      const match = rowLogs.find(l => l.topic_taught?.toLowerCase().includes(t.topic_name?.toLowerCase().slice(0,12)))
      if (match) {
        await supabase.from('syllabus_topics').update({ completed:true, completed_at:new Date().toISOString() }).eq('id', t.id)
        synced++
      }
    }
    if (synced) { fetchSyllabus(); showToast(`Auto-marked ${synced} topics ✅`, '#16a34a') }
    else showToast('No new matches found', '#d97706')
  }

  // ── Import from Monthly Syllabus ──
  const handleImportMonthly = async syllabusId => {
    const row = syllabus.find(r => r.id===syllabusId)
    if (!row) return
    const matching = monthlySyllabus.filter(m =>
      m.subject_name===row.subject_name && (!row.subtype||m.admit_type===row.subtype||!m.admit_type)
    )
    if (!matching.length) { showToast('No matching monthly syllabus topics found', '#d97706'); return }
    const existing = topics[syllabusId]||[]
    const existingNames = new Set(existing.map(t => t.topic_name?.toLowerCase()))
    const newTopics = matching.filter(m => !existingNames.has(m.topic?.toLowerCase()))
    if (!newTopics.length) { showToast('All monthly topics already added', '#d97706'); return }
    const payloads = newTopics.map((m, i) => ({
      syllabus_id:syllabusId, topic_name:m.topic, completed:m.completed||false,
      completed_at:m.completed_at||null, order_num:existing.length+i+1, tags:[],
    }))
    const { error } = await supabase.from('syllabus_topics').insert(payloads)
    if (error) showToast('Import failed: '+error.message, '#dc2626')
    else { fetchSyllabus(); showToast(`Imported ${payloads.length} topics ✅`, '#16a34a') }
  }

  // ── Drag-drop reorder ──
  const handleDrop = async (syllabusId, fromIdx, toIdx) => {
    if (fromIdx===toIdx) return
    const arr = [...(topics[syllabusId]||[])]
    const [moved] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, moved)
    setTopics(prev => ({ ...prev, [syllabusId]: arr }))
    setDragIdx(null); setDragOver(null)
    await Promise.all(arr.map((t,i) => supabase.from('syllabus_topics').update({ order_num:i+1 }).eq('id', t.id)))
  }

  // ── CSV Import ──
  const handleCSVImport = async () => {
    if (!csvSyllabusId || !csvText.trim()) { showToast('Select a syllabus and paste CSV', '#d97706'); return }
    const lines   = csvText.trim().split('\n').map(l => l.trim()).filter(Boolean)
    const existing= topics[csvSyllabusId]||[]
    const payloads= lines.map((line, i) => {
      const parts = line.split(',')
      return { syllabus_id:csvSyllabusId, topic_name:parts[0]?.trim()||line, expected_date:parts[1]?.trim()||null, tags:parts[2]?parts[2].split('|').map(t=>t.trim()):[], order_num:existing.length+i+1 }
    })
    const { error } = await supabase.from('syllabus_topics').insert(payloads)
    if (error) showToast('Import failed: '+error.message, '#dc2626')
    else { setCsvText(''); fetchSyllabus(); showToast(`Imported ${payloads.length} topics ✅`, '#16a34a') }
  }

  // ── Copy Batch ──
  const handleCopyBatch = async () => {
    if (!copyFrom || !copyTo) { showToast('Select source and destination', '#d97706'); return }
    const srcTopics = topics[copyFrom]||[]
    if (!srcTopics.length) { showToast('Source has no topics', '#d97706'); return }
    const destExisting = topics[copyTo]||[]
    const payloads = srcTopics.map((t, i) => ({ syllabus_id:copyTo, topic_name:t.topic_name, expected_date:t.expected_date||null, tags:t.tags||[], order_num:destExisting.length+i+1 }))
    const { error } = await supabase.from('syllabus_topics').insert(payloads)
    if (error) showToast('Copy failed: '+error.message, '#dc2626')
    else { fetchSyllabus(); showToast(`Copied ${payloads.length} topics ✅`, '#16a34a'); setCopyFrom(''); setCopyTo('') }
  }

  // ── Schedule generator ──
  const generateSchedule = () => {
    const row = syllabus.find(r => r.id===scheduleId)
    if (!row) return
    const rowTopics = topics[scheduleId]||[]
    if (!rowTopics.length) { showToast('Add topics first', '#d97706'); return }
    const ds = getDurationSetting(row)
    const teachingDays = ds?.teaching_days || ALL_DAYS
    const holidays     = ds?.holidays || []
    const pending = rowTopics.filter(t => !t.completed)
    const sched   = []
    let cur = new Date(scheduleStart)
    let ti  = 0
    while (ti < pending.length && sched.length < 90) {
      const dow = cur.getDay()
      const ds2 = cur.toISOString().split('T')[0]
      const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow]
      if (teachingDays.includes(dayName) && !holidays.includes(ds2)) {
        sched.push({ date:ds2, day:dayName, topic:pending[ti].topic_name })
        ti++
      }
      cur.setDate(cur.getDate()+1)
    }
    setSchedule(sched)
  }

  // ── Export CSV ──
  const exportCSV = () => {
    const rows = [['Batch','Subject','Course','Total','Done','Progress%','Required/day','Actual/day','Deadline','Projected Finish','Status']]
    syllabus.forEach(r => {
      const done  = getCompleted(r)
      const p     = pct(done, r.total_topics)
      const pace  = computeExactPace(r, logs, getDurationSetting(r))
      rows.push([
        r.subtype||'', r.subject_name, r.course, r.total_topics, done, p+'%',
        pace.requiredRate!=null?pace.requiredRate.toFixed(2)+'':'—',
        pace.actualRate!=null?pace.actualRate.toFixed(2)+'':'—',
        pace.deadlineDate||'—', pace.projectedEndDate||'—',
        p>=100?'Complete':pace.critical?'CRITICAL':pace.onTrack===false?'Behind':pace.onTrack?'On track':'No data',
      ])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    Object.assign(document.createElement('a'), { href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download:`syllabus_${today()}.csv` }).click()
    showToast('CSV exported ✅', '#16a34a')
  }

  // ── Weekly digest ──
  const generateDigest = () => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7)
    const weekStr = weekAgo.toISOString().split('T')[0]
    const weekLogs= logs.filter(l => l.teaching_date>=weekStr)
    const digest  = syllabus.map(r => {
      const wl   = weekLogs.filter(l => l.course===r.course && l.subtype===r.subtype && l.subject_name===r.subject_name)
      const done = getCompleted(r)
      const p    = pct(done, r.total_topics)
      const pace = computeExactPace(r, logs, getDurationSetting(r))
      return { ...r, weekLogs:wl.length, done, p, pace }
    }).sort((a,b) => a.p-b.p)
    setWeeklyDigest(digest)
    showToast('Digest generated ✅', '#16a34a')
  }

  // ── Heatmap ──
  const heatmapData = useMemo(() => {
    const months = [...new Set(logs.map(l => l.teaching_date?.slice(0,7)).filter(Boolean))].sort().slice(-6)
    return { months, rows: allSubjects.map(subj => ({
      subject: subj,
      counts: months.map(m => logs.filter(l => l.subject_name===subj && l.teaching_date?.startsWith(m)).length)
    }))}
  }, [logs, allSubjects])

  const subtypes = form.course ? subtypesFor(form.course) : []
  const classes  = (form.course&&form.subtype) ? classesFor(form.course, form.subtype) : []

  // ─── Render ───────────────────────────────────────────────────────────────────
  const subNavItems = [
    ['overview','📋 Overview'],
    ['heatmap','🌡️ Heatmap'],
    ['schedule','📅 Schedule'],
    ['digest','📧 Digest'],
    ...(isAdmin ? [['settings','⚙️ Course Duration'],['import','📥 Import'],['copy','📋 Copy']] : []),
  ]

  return (
    <>
      {toastEl}
      {confirmDel && <ConfirmModal title="Delete Syllabus" message="Delete this syllabus entry and all its topics?" confirmLabel="Delete" danger onConfirm={()=>handleDelete(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}

      {/* Role badge */}
      <div style={{ marginBottom:12, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        {isAdmin && <span style={{ ...S.badge('white','#1e3a5f'), padding:'4px 10px', fontSize:12 }}>🛡️ Admin — full access</span>}
        {isStaff && <span style={{ ...S.badge('white','#16a34a'), padding:'4px 10px', fontSize:12 }}>👨‍🏫 Staff — {staffName} — add/edit topics for your own subjects</span>}
       {durationSettings.length===0 && isAdmin && (
  <span style={{ ...S.badge('#dc2626','#fee2e2'), padding:'4px 10px', fontSize:12 }}>⚠️ No course durations set — go to ⚙️ Course Duration</span>
)}
{/* DEBUG — remove after confirming */}
<span style={{ ...S.badge('#64748b','#f1f5f9'), padding:'4px 10px', fontSize:11, fontFamily:'monospace' }}>
  🔍 {currentUser ? `role="${_rawRole||'(empty)'}" name="${_name||'(empty)'}"` : 'currentUser prop missing'}
</span>
</div>

Save, push, reload the page. The grey 🔍 banner will show exactly what role value the component is receiving, which tells us the final fix needed.

      {/* ── Stats ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Subjects',    value:syllabus.length,    color:'#1e3a5f', bg:'#eff6ff', icon:'📚' },
          { label:'Complete',    value:stats.complete,     color:'#16a34a', bg:'#dcfce7', icon:'✅' },
          { label:'Avg Coverage',value:`${stats.avgPct}%`, color:scoreColor(stats.avgPct), bg:scoreBg(stats.avgPct), icon:'📊' },
          { label:'Behind',      value:stats.offTrack,     color:'#d97706', bg:'#fef9c3', icon:'⚠️' },
          { label:'Critical',    value:stats.critical,     color:'#dc2626', bg:'#fee2e2', icon:'🔴' },
          ...(isAdmin ? [{ label:'No duration set', value:stats.noSetting, color:'#64748b', bg:'#f1f5f9', icon:'⚙️' }] : []),
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:12, padding:14, borderLeft:`4px solid ${c.color}` }}>
            <div style={{ fontSize:16, marginBottom:3 }}>{c.icon}</div>
            <p style={{ fontSize:10, color:c.color, fontWeight:700, margin:0, textTransform:'uppercase' }}>{c.label}</p>
            <h2 style={{ fontSize:22, fontWeight:800, color:c.color, margin:'2px 0 0', fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</h2>
          </div>
        ))}
      </div>

      {/* ── Sub-nav ── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {subNavItems.map(([key,label]) => (
          <button key={key} onClick={()=>setActiveSubView(key)}
            style={{ ...S.btnSm(activeSubView===key?'#1e3a5f':key==='settings'?'#7c3aed33':'#e2e8f0'), color:activeSubView===key?'white':key==='settings'?'#7c3aed':'#374151', fontSize:12, border:key==='settings'&&activeSubView!==key?'1px dashed #7c3aed':'none' }}>
            {label}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={exportCSV} style={S.btnSm('#16a34a')}>📥 CSV</button>
          <button onClick={()=>window.print()} style={S.btnSm('#7c3aed')}>🖨️ Print</button>
        </div>
      </div>

      {/* ════ SETTINGS (Admin only) ════ */}
      {activeSubView==='settings' && isAdmin && (
        <CourseDurationForm
          courses={courses}
          subtypesFor={subtypesFor}
          settings={durationSettings}
          onSaved={fetchDurationSettings}
          showToast={showToast}
        />
      )}
      {activeSubView==='settings' && !isAdmin && (
        <div style={{ ...S.card, textAlign:'center', padding:40, color:'#94a3b8' }}>🔒 Admin access required</div>
      )}

      {/* ════ OVERVIEW ════ */}
      {activeSubView==='overview' && (
        <>
          {/* Controls */}
          <div style={{ ...S.card, padding:'14px 16px', marginBottom:14 }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <input placeholder="🔍 Search subjects or topics..." value={topicSearch} onChange={e=>setTopicSearch(e.target.value)} style={{ ...S.input, flex:'1 1 180px', minWidth:150 }}/>
              {!isStaff && <select value={filterBatch} onChange={e=>setFilterBatch(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 120px' }}><option value="All">All Batches</option>{allBatches.map(b=><option key={b} value={b}>{b}</option>)}</select>}
              <select value={filterSubject} onChange={e=>setFilterSubject(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 140px' }}><option value="All">All Subjects</option>{allSubjects.map(s=><option key={s} value={s}>{s}</option>)}</select>
              <select value={tagFilter} onChange={e=>setTagFilter(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 110px' }}><option value="All">All Tags</option>{TOPIC_TAGS.map(t=><option key={t} value={t}>{t}</option>)}</select>
              <div style={{ display:'flex', gap:4 }}>
                {[['cards','📋'],['pace','📈']].map(([m,icon]) => (
                  <button key={m} onClick={()=>setViewMode(m)} style={{ ...S.btnSm(viewMode===m?'#1e3a5f':'#e2e8f0'), color:viewMode===m?'white':'#374151' }}>{icon}</button>
                ))}
              </div>
              {isAdmin && (
                <button onClick={()=>{ setShowForm(!showForm); setEditingRow(null); setForm(blankForm) }} style={S.btn(showForm?'#64748b':'#1e3a5f')}>
                  {showForm ? '✖ Cancel' : '➕ Add'}
                </button>
              )}
            </div>
          </div>

          {/* Add/Edit Form (admin only) */}
          {showForm && isAdmin && (
            <div style={{ ...S.card, border:'1px solid #1e3a5f33', marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1e3a5f', marginBottom:14 }}>{editingRow?'✏️ Edit Syllabus':'➕ New Syllabus Entry'}</div>
              <form onSubmit={handleSave}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:14 }}>
                  {!editingRow && (
                    <>
                      <div><label style={S.label}>Course</label><select value={form.course} onChange={e=>setForm(f=>({...f,course:e.target.value,subtype:'',class_name:''}))} required style={S.select}><option value="">Select</option>{courses.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                      <div><label style={S.label}>Batch/Subtype</label><select value={form.subtype} onChange={e=>setForm(f=>({...f,subtype:e.target.value,class_name:''}))} style={S.select}><option value="">All</option>{subtypes.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                      <div><label style={S.label}>Class</label>{classes.length>0?<select value={form.class_name} onChange={e=>setForm(f=>({...f,class_name:e.target.value}))} style={S.select}><option value="">All</option>{classes.map(c=><option key={c} value={c}>{c}</option>)}</select>:<input value={form.class_name} onChange={e=>setForm(f=>({...f,class_name:e.target.value}))} placeholder="Optional" style={S.input}/>}</div>
                      <div><label style={S.label}>Subject</label><select value={form.subject_name} onChange={e=>setForm(f=>({...f,subject_name:e.target.value}))} required style={S.select}><option value="">Select</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                    </>
                  )}
                  {editingRow && <div style={{ gridColumn:'1/-1', padding:'8px 12px', background:'#eff6ff', borderRadius:8, fontSize:13, color:'#1e3a5f', fontWeight:600 }}>✏️ Editing: {editingRow.subject_name} · {editingRow.subtype}</div>}
                  <div><label style={S.label}>Total Topics</label><input type="number" min="1" value={form.total_topics} onChange={e=>setForm(f=>({...f,total_topics:e.target.value}))} required placeholder="e.g. 40" style={S.input}/></div>
                  <div><label style={S.label}>Target End Date</label><input type="date" value={form.expected_end_date} onChange={e=>setForm(f=>({...f,expected_end_date:e.target.value}))} style={S.input}/></div>
                </div>
                <button type="submit" disabled={saving} style={S.btn('#16a34a',saving)}>{saving?'⏳ Saving...':'✅ Save'}</button>
              </form>
            </div>
          )}

          {loading && <div style={{ textAlign:'center', padding:32, color:'#64748b' }}>⏳ Loading...</div>}

          {/* ── Cards View ── */}
          {!loading && viewMode==='cards' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filtered.length===0 && (
                <div style={{ ...S.card, textAlign:'center', padding:32, color:'#94a3b8' }}>
                  {isStaff ? 'No syllabus entries found for your subjects.' : 'No syllabus entries found.'}
                </div>
              )}
              {filtered.map(row => {
                const done      = getCompleted(row)
                const p         = pct(done, row.total_topics)
                const color     = scoreColor(p)
                const pace      = computeExactPace(row, logs, getDurationSetting(row))
                const rowTopics = topics[row.id]||[]
                const isExpanded= expandedId===row.id
                const topicsDone= rowTopics.filter(t => t.completed).length
                const ds        = getDurationSetting(row)
                const borderColor = pace.critical?'#fecaca':pace.onTrack===false?'#fed7aa':p>=100?'#bbf7d0':'#e2e8f0'

                return (
                  <div key={row.id} style={{ ...S.card, marginBottom:0, border:`1px solid ${borderColor}` }}>
                    {/* Header */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10, flexWrap:'wrap', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                          <span style={{ fontWeight:800, color:'#1e293b', fontSize:14 }}>{row.subject_name}</span>
                          <span style={S.badge('#1e3a5f','#eff6ff')}>{row.subtype||'All'}</span>
                          {row.class_name && <span style={S.badge('#64748b','#f1f5f9')}>{row.class_name}</span>}
                          {p>=100 && <span style={S.badge('#16a34a','#dcfce7')}>✅ Complete</span>}
                          {pace.critical && <span style={S.badge('#dc2626','#fee2e2')}>🔴 Critical</span>}
                          {!pace.critical && pace.onTrack===false && <span style={S.badge('#d97706','#fef9c3')}>⚠️ Behind</span>}
                          {!pace.critical && pace.onTrack && p<100 && <span style={S.badge('#16a34a','#dcfce7')}>✅ On track</span>}
                          {!ds && <span style={S.badge('#64748b','#f1f5f9')}>⚙️ No duration set</span>}
                        </div>
                        <div style={{ fontSize:12, color:'#64748b' }}>
                          {row.course}
                          {ds && ` · Deadline: ${fmtDate(ds.end_date)} · ${pace.daysLeft}d left`}
                          {rowTopics.length>0 && ` · ${topicsDone}/${rowTopics.length} topics`}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ textAlign:'right' }}>
                          <span style={{ fontSize:22, fontWeight:800, color, fontFamily:"'JetBrains Mono',monospace" }}>{p}%</span>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{done}/{row.total_topics}</div>
                        </div>
                        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                          {isAdmin && <button onClick={()=>handleAutoMark(row.id)} title="Auto-mark from logs" style={S.btnSm('#0891b2')}>⚡</button>}
                          {isAdmin && <button onClick={()=>handleImportMonthly(row.id)} title="Import from Monthly" style={S.btnSm('#7c3aed')}>📆</button>}
                          {isAdmin && <button onClick={()=>{ setEditingRow(row); setForm({...row,total_topics:row.total_topics,expected_end_date:row.expected_end_date||''}); setShowForm(true) }} style={S.btnSm('#0891b2')}>✏️</button>}
                          <button onClick={()=>setExpandedId(isExpanded?null:row.id)} style={S.btnSm('#64748b')}>{isExpanded?'▲':'▼'}</button>
                          {isAdmin && <button onClick={()=>setConfirmDel(row.id)} style={S.btnSm('#dc2626')}>🗑</button>}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <ProgressBar value={done} max={row.total_topics} color={color} height={8}/>

                    {/* Dual progress: time elapsed vs topic coverage */}
                    {pace.hasSetting && pace.timeFraction != null && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#94a3b8', marginBottom:3 }}>
                          <span>Time elapsed</span>
                          <span>{Math.round(pace.timeFraction*100)}% of course used</span>
                        </div>
                        <div style={{ height:4, background:'#e2e8f0', borderRadius:3, overflow:'hidden', position:'relative' }}>
                          {/* Time bar */}
                          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${Math.round(pace.timeFraction*100)}%`, background:'#94a3b8', borderRadius:3, opacity:.5 }}/>
                          {/* Topic bar on top */}
                          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${p}%`, background:pace.topicFraction>=pace.timeFraction?'#16a34a':'#dc2626', borderRadius:3 }}/>
                        </div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>
                          {p >= Math.round(pace.timeFraction*100)
                            ? <span style={{ color:'#16a34a' }}>✅ Topic coverage ({p}%) ahead of time used ({Math.round(pace.timeFraction*100)}%)</span>
                            : <span style={{ color:'#dc2626' }}>⚠️ Topic coverage ({p}%) behind time used ({Math.round(pace.timeFraction*100)}%)</span>
                          }
                        </div>
                      </div>
                    )}

                    {/* Pace card */}
                    <PaceCard pace={pace}/>

                    {/* Required vs actual rate highlight */}
                    {pace.requiredRate != null && pace.actualRate != null && (
                      <div style={{ display:'flex', gap:12, marginTop:8, flexWrap:'wrap' }}>
                        <div style={{ padding:'6px 12px', borderRadius:8, background:pace.actualRate>=pace.requiredRate?'#dcfce7':'#fee2e2', fontSize:12 }}>
                          <span style={{ color:'#64748b' }}>Required: </span>
                          <span style={{ fontWeight:800, color:'#1e293b', fontFamily:"'JetBrains Mono',monospace" }}>{pace.requiredRate.toFixed(2)}</span>
                          <span style={{ color:'#64748b' }}> topics/teaching-day</span>
                        </div>
                        <div style={{ padding:'6px 12px', borderRadius:8, background:pace.actualRate>=pace.requiredRate?'#dcfce7':'#fee2e2', fontSize:12 }}>
                          <span style={{ color:'#64748b' }}>Actual: </span>
                          <span style={{ fontWeight:800, color:pace.actualRate>=pace.requiredRate?'#16a34a':'#dc2626', fontFamily:"'JetBrains Mono',monospace" }}>{pace.actualRate.toFixed(2)}</span>
                          <span style={{ color:'#64748b' }}> topics/day</span>
                        </div>
                      </div>
                    )}
                    {pace.requiredRate != null && !pace.actualRate && (
                      <div style={{ marginTop:8, padding:'6px 12px', borderRadius:8, background:'#fef9c3', fontSize:12, color:'#b45309' }}>
                        ⚡ Needs <b>{pace.requiredRate.toFixed(2)}</b> topics/teaching-day to finish on time — no pace data yet
                      </div>
                    )}

                    {/* Expanded Topics */}
                    {isExpanded && (
                      <div style={{ marginTop:14, borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:6 }}>
                          <div style={{ fontWeight:700, color:'#374151', fontSize:13 }}>📋 Topics ({topicsDone}/{rowTopics.length} done)</div>
                          {isAdmin && (
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={()=>handleAutoMark(row.id)} style={{ ...S.btnSm('#0891b2'), fontSize:11 }}>⚡ Auto-mark</button>
                              <button onClick={()=>handleImportMonthly(row.id)} style={{ ...S.btnSm('#7c3aed'), fontSize:11 }}>📆 Import Monthly</button>
                              <button onClick={()=>{ setScheduleId(row.id); setActiveSubView('schedule') }} style={{ ...S.btnSm('#16a34a'), fontSize:11 }}>📅 Schedule</button>
                            </div>
                          )}
                        </div>

                        {rowTopics.length===0 && (
                          <div style={{ marginBottom:8 }}>
                            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6 }}>No topics defined — showing from logs:</div>
                            {getLogsFor(row).slice(0,8).map(l => (
                              <div key={l.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 8px', background:'#f0fdf4', borderRadius:5, marginBottom:3, fontSize:12 }}>
                                <span style={{ color:'#16a34a' }}>✓</span>
                                <span style={{ flex:1, color:'#374151' }}>{l.topic_taught}</span>
                                <span style={{ color:'#94a3b8' }}>{fmtDate(l.teaching_date)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {rowTopics.map((t, idx) => {
                          const canMark = isAdmin || (isStaff && staffSubjects.has(row.subject_name))
                          const canEdit = canEditTopicsFor(row)
                          const isEditingThis = editingTopicId === t.id
                          if (isEditingThis) {
                            return (
                              <div key={t.id} style={{ padding:'10px 12px', background:'#eff6ff', borderRadius:8, border:'1px solid #bfdbfe', marginBottom:4 }}>
                                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
                                  <input value={topicForm.name} onChange={e=>setTopicForm(f=>({...f,name:e.target.value}))} placeholder="Topic name..." style={{ ...S.input, flex:2, minWidth:120 }}/>
                                  <input type="date" value={topicForm.expected_date} onChange={e=>setTopicForm(f=>({...f,expected_date:e.target.value}))} style={{ ...S.input, flex:1, minWidth:120 }}/>
                                </div>
                                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                                  {TOPIC_TAGS.map(tag => (
                                    <button key={tag} onClick={()=>setTopicForm(f=>({...f,tags:f.tags.includes(tag)?f.tags.filter(x=>x!==tag):[...f.tags,tag]}))}
                                      style={{ ...S.btnSm(topicForm.tags.includes(tag)?TAG_META[tag]?.color:'#e2e8f0'), color:topicForm.tags.includes(tag)?'white':'#374151', fontSize:11, padding:'4px 8px' }}>
                                      {TAG_META[tag]?.icon} {tag}
                                    </button>
                                  ))}
                                </div>
                                <div style={{ display:'flex', gap:6 }}>
                                  <button onClick={()=>handleEditTopic(t.id, { topic_name:topicForm.name, expected_date:topicForm.expected_date, tags:topicForm.tags })} style={S.btnSm('#16a34a')}>✓ Save</button>
                                  <button onClick={()=>setEditingTopicId(null)} style={S.btnSm('#94a3b8')}>✖ Cancel</button>
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div key={t.id}
                              draggable={isAdmin}
                              onDragStart={()=>isAdmin&&setDragIdx(idx)}
                              onDragOver={e=>{ e.preventDefault(); isAdmin&&setDragOver(idx) }}
                              onDrop={()=>isAdmin&&handleDrop(row.id, dragIdx, idx)}
                              style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', border:`1px solid ${dragOver===idx?'#1e3a5f':'#e2e8f0'}`, borderRadius:7, marginBottom:4, background:t.completed?'#f0fdf4':'white', cursor:isAdmin?'grab':'default', transition:'all .1s' }}>
                              {isAdmin && <span style={{ color:'#cbd5e1', fontSize:11 }}>⠿</span>}
                              <input type="checkbox" checked={!!t.completed} onChange={e=>canMark&&handleMarkTopic(t,e.target.checked)} disabled={!canMark} style={{ width:14, height:14, cursor:canMark?'pointer':'not-allowed', accentColor:'#16a34a' }}/>
                              <span style={{ flex:1, fontSize:13, color:t.completed?'#16a34a':'#374151', textDecoration:t.completed?'line-through':'none' }}>{t.topic_name}</span>
                              <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                                {(t.tags||[]).map(tag => <TagPill key={tag} tag={tag}/>)}
                              </div>
                              {t.expected_date && <span style={{ fontSize:11, color:'#94a3b8' }}>{fmtDate(t.expected_date)}</span>}
                              {canEdit && <button onClick={()=>{ setEditingTopicId(t.id); setTopicForm({ name:t.topic_name, expected_date:t.expected_date||'', tags:t.tags||[] }) }} style={{ background:'none', border:'none', color:'#60a5fa', cursor:'pointer', fontSize:13, padding:'0 2px' }} title="Edit topic">✏️</button>}
                              {isAdmin && <button onClick={()=>handleDeleteTopic(t.id)} style={{ background:'none', border:'none', color:'#fca5a5', cursor:'pointer', fontSize:13, padding:'0 2px' }} title="Delete topic (admin only)">✕</button>}
                            </div>
                          )
                        })}

                        {canEditTopicsFor(row) && (
                          addingTopicTo===row.id ? (
                            <div style={{ marginTop:8, padding:'10px 12px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
                              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
                                <input value={topicForm.name} onChange={e=>setTopicForm(f=>({...f,name:e.target.value}))} placeholder="Topic name..." style={{ ...S.input, flex:2, minWidth:120 }}/>
                                <input type="date" value={topicForm.expected_date} onChange={e=>setTopicForm(f=>({...f,expected_date:e.target.value}))} style={{ ...S.input, flex:1, minWidth:120 }}/>
                              </div>
                              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                                {TOPIC_TAGS.map(tag => (
                                  <button key={tag} onClick={()=>setTopicForm(f=>({...f,tags:f.tags.includes(tag)?f.tags.filter(x=>x!==tag):[...f.tags,tag]}))}
                                    style={{ ...S.btnSm(topicForm.tags.includes(tag)?TAG_META[tag]?.color:'#e2e8f0'), color:topicForm.tags.includes(tag)?'white':'#374151', fontSize:11, padding:'4px 8px' }}>
                                    {TAG_META[tag]?.icon} {tag}
                                  </button>
                                ))}
                              </div>
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={()=>handleAddTopic(row.id)} style={S.btnSm('#16a34a')}>✓ Add</button>
                                <button onClick={()=>setAddingTopicTo(null)} style={S.btnSm('#94a3b8')}>✖</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={()=>setAddingTopicTo(row.id)} style={{ ...S.btnSm('#7c3aed'), marginTop:8 }}>➕ Add Topic</button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Pace Table View ── */}
          {!loading && viewMode==='pace' && (
            <div style={{ borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.07)' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, background:'white', minWidth:900 }}>
                  <thead>
                    <tr style={{ background:'#1e3a5f', color:'white' }}>
                      {['Batch','Subject','Done','Total','%','Required/day','Actual/day','Gap','Deadline','Proj.Finish','Status'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(row => {
                      const done  = getCompleted(row)
                      const p     = pct(done, row.total_topics)
                      const pace  = computeExactPace(row, logs, getDurationSetting(row))
                      const cl    = scoreColor(p)
                      const gap   = pace.requiredRate != null && pace.actualRate != null ? pace.actualRate - pace.requiredRate : null
                      const rowBg = pace.critical?'#fff1f2':pace.onTrack===false?'#fffbeb':'white'
                      return (
                        <tr key={row.id} style={{ borderBottom:'1px solid #f1f5f9', background:rowBg }}>
                          <td style={{ padding:'10px 12px' }}><span style={S.badge('#1e3a5f','#eff6ff')}>{row.subtype||'All'}</span></td>
                          <td style={{ padding:'10px 12px', fontWeight:700, color:'#1e293b' }}>{row.subject_name}</td>
                          <td style={{ padding:'10px 12px', fontWeight:700, color:cl, fontFamily:"'JetBrains Mono',monospace" }}>{done}</td>
                          <td style={{ padding:'10px 12px', color:'#64748b', fontFamily:"'JetBrains Mono',monospace" }}>{row.total_topics}</td>
                          <td style={{ padding:'10px 12px', fontWeight:700, color:cl, fontFamily:"'JetBrains Mono',monospace" }}>{p}%</td>
                          <td style={{ padding:'10px 12px', color:'#374151', fontFamily:"'JetBrains Mono',monospace" }}>
                            {pace.requiredRate != null ? <b style={{ color:scoreColor(0) }}>{pace.requiredRate.toFixed(2)}</b> : '—'}
                          </td>
                          <td style={{ padding:'10px 12px', fontFamily:"'JetBrains Mono',monospace' " }}>
                            {pace.actualRate != null
                              ? <span style={{ color:pace.requiredRate!=null?(pace.actualRate>=pace.requiredRate?'#16a34a':'#dc2626'):'#374151', fontWeight:700 }}>{pace.actualRate.toFixed(2)}</span>
                              : <span style={{ color:'#94a3b8' }}>—</span>}
                          </td>
                          <td style={{ padding:'10px 12px', fontFamily:"'JetBrains Mono',monospace" }}>
                            {gap != null
                              ? <span style={{ color:gap>=0?'#16a34a':'#dc2626', fontWeight:700 }}>{gap>=0?'+':''}{gap.toFixed(2)}</span>
                              : <span style={{ color:'#94a3b8' }}>—</span>}
                          </td>
                          <td style={{ padding:'10px 12px', color:'#64748b', whiteSpace:'nowrap' }}>{pace.deadlineDate?fmtDate(pace.deadlineDate):'—'}</td>
                          <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                            {pace.projectedEndDate
                              ? <span style={{ color:pace.onTrack?'#16a34a':'#dc2626', fontWeight:600 }}>{fmtDate(pace.projectedEndDate)}</span>
                              : <span style={{ color:'#94a3b8' }}>—</span>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            {p>=100
                              ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Done</span>
                              : pace.critical
                              ? <span style={S.badge('#dc2626','#fee2e2')}>🔴 Critical</span>
                              : pace.onTrack===false
                              ? <span style={S.badge('#d97706','#fef9c3')}>⚠️ Behind</span>
                              : pace.onTrack
                              ? <span style={S.badge('#16a34a','#dcfce7')}>✅ On track</span>
                              : <span style={S.badge('#94a3b8','#f1f5f9')}>No data</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length===0 && <tr><td colSpan={11} style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No data.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════ HEATMAP ════ */}
      {activeSubView==='heatmap' && (
        <div style={S.card}>
          <div style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:16 }}>🌡️ Subject Activity Heatmap (Last 6 Months)</div>
          {heatmapData.rows.length===0
            ? <div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>No log data.</div>
            : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', fontSize:12, minWidth:400 }}>
                  <thead>
                    <tr>
                      <th style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontWeight:600 }}>Subject</th>
                      {heatmapData.months.map(m => (
                        <th key={m} style={{ padding:'8px 10px', textAlign:'center', color:'#64748b', fontWeight:600, minWidth:64 }}>
                          {new Date(m+'-01').toLocaleString('default',{month:'short',year:'2-digit'})}
                        </th>
                      ))}
                      <th style={{ padding:'8px 10px', textAlign:'center', color:'#64748b', fontWeight:600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.rows.map(row => {
                      const total = row.counts.reduce((a,b)=>a+b,0)
                      const max   = Math.max(...heatmapData.rows.map(r=>Math.max(...r.counts)), 1)
                      return (
                        <tr key={row.subject} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={{ padding:'8px 12px', fontWeight:600, color:'#1e293b', whiteSpace:'nowrap' }}>{row.subject}</td>
                          {row.counts.map((count, i) => {
                            const intensity = max>0?count/max:0
                            const bg = count===0?'#f1f5f9':`rgba(30,58,95,${0.1+intensity*0.85})`
                            const color = intensity>0.5?'white':'#1e3a5f'
                            return (
                              <td key={i} style={{ padding:'8px 10px', textAlign:'center' }}>
                                <div title={`${count} logs`} style={{ width:48, height:36, borderRadius:6, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color, fontSize:13, margin:'0 auto' }}>{count||''}</div>
                              </td>
                            )
                          })}
                          <td style={{ padding:'8px 10px', textAlign:'center', fontWeight:800, color:'#1e3a5f', fontFamily:"'JetBrains Mono',monospace" }}>{total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ════ SCHEDULE GENERATOR ════ */}
      {activeSubView==='schedule' && (
        <div style={S.card}>
          <div style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:16 }}>📅 Week-by-Week Schedule Generator</div>
          <p style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>Schedule respects teaching days and holidays from Course Duration settings.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:16 }}>
            <div>
              <label style={S.label}>Select Syllabus</label>
              <select value={scheduleId} onChange={e=>setScheduleId(e.target.value)} style={S.select}>
                <option value="">Select...</option>
                {syllabus.map(r=><option key={r.id} value={r.id}>{r.subject_name} · {r.subtype||'All'}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Start Date</label>
              <input type="date" value={scheduleStart} onChange={e=>setScheduleStart(e.target.value)} style={S.input}/>
            </div>
          </div>
          {scheduleId && getDurationSetting(syllabus.find(r=>r.id===scheduleId)||{}) && (
            <div style={{ padding:'8px 12px', background:'#eff6ff', borderRadius:8, fontSize:12, color:'#1e3a5f', marginBottom:12, fontWeight:600 }}>
              ✅ Using course teaching days: {(getDurationSetting(syllabus.find(r=>r.id===scheduleId)||{})?.teaching_days||ALL_DAYS).join(', ')}
            </div>
          )}
          <button onClick={generateSchedule} style={S.btn('#1e3a5f')}>⚡ Generate Schedule</button>

          {schedule.length>0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:10 }}>{schedule.length} sessions planned:</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:8 }}>
                {schedule.map((s,i) => (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8 }}>
                    <div style={{ minWidth:28, height:28, borderRadius:'50%', background:'#0891b2', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, fontWeight:700 }}>{i+1}</div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#0891b2' }}>{s.day} · {fmtDate(s.date)}</div>
                      <div style={{ fontSize:12, color:'#374151' }}>{s.topic}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={()=>{
                const csv=[['#','Day','Date','Topic'],...schedule.map((s,i)=>[i+1,s.day,s.date,s.topic])].map(r=>r.join(',')).join('\n')
                Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:`schedule_${today()}.csv`}).click()
              }} style={{ ...S.btnSm('#16a34a'), marginTop:12 }}>📥 Export Schedule CSV</button>
            </div>
          )}
        </div>
      )}

      {/* ════ CSV IMPORT (admin only) ════ */}
      {activeSubView==='import' && isAdmin && (
        <div style={S.card}>
          <div style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:6 }}>📥 Bulk Import Topics (CSV)</div>
          <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
            Paste one topic per line. Format: <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:4 }}>Topic Name, YYYY-MM-DD (optional), tag1|tag2 (optional)</code>
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:14 }}>
            <div>
              <label style={S.label}>Target Syllabus</label>
              <select value={csvSyllabusId} onChange={e=>setCsvSyllabusId(e.target.value)} style={S.select}>
                <option value="">Select...</option>
                {syllabus.map(r=><option key={r.id} value={r.id}>{r.subject_name} · {r.subtype||'All'} · {r.course}</option>)}
              </select>
            </div>
          </div>
          <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={10} placeholder={"Fractions, 2026-06-01, important|exam\nDecimals\nRatio and Proportion, 2026-06-08"} style={{ ...S.input, resize:'vertical', fontFamily:'monospace', fontSize:12, marginBottom:12 }}/>
          <button onClick={handleCSVImport} style={S.btn('#7c3aed')}>📥 Import Topics</button>
        </div>
      )}

      {/* ════ COPY BATCH (admin only) ════ */}
      {activeSubView==='copy' && isAdmin && (
        <div style={S.card}>
          <div style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:6 }}>📋 Copy Topics Between Batches</div>
          <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>Copy all topics from one syllabus entry to another.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:16 }}>
            <div>
              <label style={S.label}>Copy From</label>
              <select value={copyFrom} onChange={e=>setCopyFrom(e.target.value)} style={S.select}>
                <option value="">Source...</option>
                {syllabus.map(r=><option key={r.id} value={r.id}>{r.subject_name} · {r.subtype||'All'} ({(topics[r.id]||[]).length} topics)</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Copy To</label>
              <select value={copyTo} onChange={e=>setCopyTo(e.target.value)} style={S.select}>
                <option value="">Destination...</option>
                {syllabus.filter(r=>r.id!==copyFrom).map(r=><option key={r.id} value={r.id}>{r.subject_name} · {r.subtype||'All'}</option>)}
              </select>
            </div>
          </div>
          {copyFrom && copyTo && (
            <div style={{ padding:'10px 14px', background:'#eff6ff', borderRadius:8, fontSize:13, color:'#1e3a5f', marginBottom:14 }}>
              Will copy <strong>{(topics[copyFrom]||[]).length}</strong> topics from <strong>{syllabus.find(r=>r.id===copyFrom)?.subject_name} · {syllabus.find(r=>r.id===copyFrom)?.subtype}</strong> → <strong>{syllabus.find(r=>r.id===copyTo)?.subject_name} · {syllabus.find(r=>r.id===copyTo)?.subtype}</strong>
            </div>
          )}
          <button onClick={handleCopyBatch} disabled={!copyFrom||!copyTo} style={S.btn('#0891b2',!copyFrom||!copyTo)}>📋 Copy Topics</button>
        </div>
      )}

      {/* ════ WEEKLY DIGEST ════ */}
      {activeSubView==='digest' && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#1e3a5f' }}>📧 Weekly Syllabus Digest</div>
            <button onClick={generateDigest} style={S.btn('#1e3a5f')}>⚡ Generate Digest</button>
          </div>
          {!weeklyDigest && <div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Click "Generate Digest" to see last 7 days summary.</div>}
          {weeklyDigest && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:10, marginBottom:16 }}>
                {[
                  { label:'Critical',  value:weeklyDigest.filter(r=>r.pace?.critical).length,                color:'#dc2626', bg:'#fee2e2' },
                  { label:'Behind',    value:weeklyDigest.filter(r=>!r.pace?.critical&&r.pace?.onTrack===false).length, color:'#d97706', bg:'#fef9c3' },
                  { label:'On Track',  value:weeklyDigest.filter(r=>r.pace?.onTrack).length,                color:'#16a34a', bg:'#dcfce7' },
                  { label:'Complete',  value:weeklyDigest.filter(r=>r.p>=100).length,                       color:'#7c3aed', bg:'#f3e8ff' },
                ].map(c => (
                  <div key={c.label} style={{ background:c.bg, borderRadius:10, padding:12, borderLeft:`3px solid ${c.color}` }}>
                    <div style={{ fontSize:11, color:c.color, fontWeight:700 }}>{c.label}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {weeklyDigest.map((row,i) => (
                  <div key={row.id} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 14px', border:`1px solid ${row.pace?.critical?'#fecaca':row.pace?.onTrack===false?'#fde68a':'#e2e8f0'}`, borderRadius:8, background:row.p>=100?'#f0fdf4':row.pace?.critical?'#fff1f2':'white', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:150 }}>
                      <div style={{ fontWeight:700, color:'#1e293b', fontSize:13 }}>{row.subject_name}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{row.subtype||'All'} · {row.weekLogs} logs this week</div>
                      {row.pace?.deadlineDate && <div style={{ fontSize:11, color:'#64748b' }}>Deadline: {fmtDate(row.pace.deadlineDate)} · {row.pace.daysLeft}d left</div>}
                    </div>
                    <div style={{ minWidth:100 }}><ProgressBar value={row.done} max={row.total_topics} height={6}/></div>
                    <div style={{ minWidth:120, fontSize:11, textAlign:'right' }}>
                      {row.pace?.requiredRate != null && <div>Need: <b>{row.pace.requiredRate.toFixed(2)}/day</b></div>}
                      {row.pace?.actualRate != null && <div style={{ color:row.pace.actualRate>=(row.pace.requiredRate||0)?'#16a34a':'#dc2626' }}>Have: <b>{row.pace.actualRate.toFixed(2)}/day</b></div>}
                    </div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {row.p>=100 && <span style={S.badge('#16a34a','#dcfce7')}>✅ Done</span>}
                      {row.pace?.critical && <span style={S.badge('#dc2626','#fee2e2')}>🔴 Critical</span>}
                      {!row.pace?.critical && row.pace?.onTrack===false && <span style={S.badge('#d97706','#fef9c3')}>⚠️ Behind</span>}
                      {!row.pace?.critical && row.pace?.onTrack && row.p<100 && <span style={S.badge('#16a34a','#dcfce7')}>✅ On track</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Print-only report ── */}
      <div className="print-only" style={{ display:'none' }} id="syllabus-print">
        <style>{`@media print { .print-only { display:block!important } .no-print { display:none!important } }`}</style>
        <h2 style={{ color:'#1e3a5f' }}>Syllabus Progress Report — {new Date().toLocaleDateString('en-IN')}</h2>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'#1e3a5f', color:'white' }}>
              {['Batch','Subject','Done','Total','%','Req/day','Actual/day','Deadline','Proj.Finish','Status'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:'left' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {syllabus.map(row => {
              const done = getCompleted(row)
              const p    = pct(done, row.total_topics)
              const pace = computeExactPace(row, logs, getDurationSetting(row))
              return (
                <tr key={row.id} style={{ borderBottom:'1px solid #e2e8f0', background:pace.critical?'#fff1f2':pace.onTrack===false?'#fffbeb':'white' }}>
                  <td style={{ padding:'7px 10px' }}>{row.subtype||'All'}</td>
                  <td style={{ padding:'7px 10px', fontWeight:600 }}>{row.subject_name}</td>
                  <td style={{ padding:'7px 10px' }}>{done}</td>
                  <td style={{ padding:'7px 10px' }}>{row.total_topics}</td>
                  <td style={{ padding:'7px 10px', fontWeight:700 }}>{p}%</td>
                  <td style={{ padding:'7px 10px' }}>{pace.requiredRate!=null?pace.requiredRate.toFixed(2):'—'}</td>
                  <td style={{ padding:'7px 10px' }}>{pace.actualRate!=null?pace.actualRate.toFixed(2):'—'}</td>
                  <td style={{ padding:'7px 10px' }}>{fmtDate(pace.deadlineDate)}</td>
                  <td style={{ padding:'7px 10px' }}>{fmtDate(pace.projectedEndDate)}</td>
                  <td style={{ padding:'7px 10px', fontWeight:700, color:pace.critical?'#dc2626':pace.onTrack===false?'#d97706':'#16a34a' }}>
                    {p>=100?'Complete':pace.critical?'CRITICAL':pace.onTrack===false?'Behind':pace.onTrack?'On track':'No data'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/*
        ══════════════════════════════════════════════════════════════
        SQL MIGRATION — run once in Supabase SQL editor
        ══════════════════════════════════════════════════════════════

        CREATE TABLE IF NOT EXISTS course_duration_settings (
          id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          course               text NOT NULL,
          subtype              text,
          start_date           date NOT NULL,
          end_date             date NOT NULL,
          teaching_days        text[] DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
          holidays             date[] DEFAULT ARRAY[]::date[],
          total_teaching_days  integer,
          topics_per_day_target numeric DEFAULT 1,
          created_at           timestamptz DEFAULT now(),
          updated_at           timestamptz DEFAULT now(),
          UNIQUE(course, COALESCE(subtype, ''))
        );

        ALTER TABLE course_duration_settings ENABLE ROW LEVEL SECURITY;

        -- Admin/manager can read and write
        CREATE POLICY "admin_full" ON course_duration_settings
          FOR ALL USING (auth.jwt()->>'role' IN ('admin','manager'));

        -- Teachers can read (to see their deadlines)
        CREATE POLICY "teacher_read" ON course_duration_settings
          FOR SELECT USING (true);

        ══════════════════════════════════════════════════════════════
      */}
    </>
  )
}
