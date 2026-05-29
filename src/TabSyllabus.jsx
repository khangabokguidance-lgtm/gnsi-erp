// TabSyllabus.jsx — Enhanced Syllabus Tab
// Features:
//  ✅ Fetch syllabus from monthly_syllabus table
//  ✅ Auto-mark topics from teaching logs
//  ✅ Subject-wise heatmap
//  ✅ Week-by-week schedule generator
//  ✅ Bulk CSV import
//  ✅ Copy syllabus batch-to-batch
//  ✅ Auto pace alerts
//  ✅ 7-day no-log highlights
//  ✅ Export PDF/CSV report
//  ✅ Per-teacher coverage breakdown
//  ✅ Topic search/filter
//  ✅ Drag-and-drop reorder
//  ✅ Mobile card view
//  ✅ Topic tags (important, exam, revision)
//  ✅ Print-friendly report

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II','English Grammar',
  'General Knowledge','General Science','Reasoning','Mental Ability',
  'Hindi','Vocabulary','Meitei Mayek',
]
const TOPIC_TAGS  = ['important','exam','revision','easy','hard']
const TAG_META    = {
  important: { color:'#dc2626', bg:'#fee2e2', icon:'⭐' },
  exam:      { color:'#7c3aed', bg:'#f3e8ff', icon:'📝' },
  revision:  { color:'#0891b2', bg:'#e0f2fe', icon:'🔁' },
  easy:      { color:'#16a34a', bg:'#dcfce7', icon:'✅' },
  hard:      { color:'#d97706', bg:'#fef9c3', icon:'🔥' },
}
const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const today   = () => new Date().toISOString().split('T')[0]
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }) : '—'
const pct     = (s,m) => m > 0 ? Math.min(100,Math.round((s/m)*100)) : 0
const scoreColor = p => p >= 75 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626'
const scoreBg    = p => p >= 75 ? '#dcfce7' : p >= 50 ? '#fef9c3' : '#fee2e2'

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card:   { background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)', padding:20, marginBottom:16 },
  btn:    (color='#1e3a5f', disabled=false) => ({ backgroundColor:disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontSize:13, minHeight:44, fontFamily:'inherit' }),
  btnSm:  (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:36, fontFamily:'inherit' }),
  input:  { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44, fontFamily:'inherit' },
  label:  { display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' },
  select: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44, fontFamily:'inherit' },
  badge:  (color, bg) => ({ padding:'3px 9px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color, display:'inline-flex', alignItems:'center', gap:3 }),
}

// ─── Toast ────────────────────────────────────────────────────────────────────
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

// ─── Confirm Modal ────────────────────────────────────────────────────────────
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

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color, height=8 }) {
  const p = pct(value, max)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', background:color||scoreColor(p), borderRadius:4, transition:'width .5s' }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:color||scoreColor(p), minWidth:32, textAlign:'right' }}>{p}%</span>
    </div>
  )
}

// ─── Tag Pill ─────────────────────────────────────────────────────────────────
function TagPill({ tag, onRemove }) {
  const m = TAG_META[tag] || { color:'#64748b', bg:'#f1f5f9', icon:'🏷️' }
  return (
    <span style={{ ...S.badge(m.color, m.bg), padding:'2px 7px', fontSize:10 }}>
      {m.icon} {tag}
      {onRemove && <span onClick={onRemove} style={{ cursor:'pointer', marginLeft:2, opacity:.7 }}>✕</span>}
    </span>
  )
}

// ─── Main TabSyllabus ─────────────────────────────────────────────────────────
export default function TabSyllabus({ logs=[], courseData, monthlySyllabus=[] }) {
  const { show: showToast, el: toastEl } = useToast()
  const { courses=[], subtypesFor=()=>[], classesFor=()=>[], batchIdFor=()=>'' } = courseData || {}

  // ── State ──
  const [syllabus,     setSyllabus]     = useState([])
  const [topics,       setTopics]       = useState({})   // { syllabusId: [...topics] }
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editingRow,   setEditingRow]   = useState(null)
  const [expandedId,   setExpandedId]   = useState(null)
  const [topicForm,    setTopicForm]    = useState({ name:'', expected_date:'', tags:[] })
  const [addingTopicTo,setAddingTopicTo]= useState(null)
  const [filterBatch,  setFilterBatch]  = useState('All')
  const [filterSubject,setFilterSubject]= useState('All')
  const [topicSearch,  setTopicSearch]  = useState('')
  const [viewMode,     setViewMode]     = useState('cards')
  const [confirmDel,   setConfirmDel]   = useState(null)
  const [dragIdx,      setDragIdx]      = useState(null)
  const [dragOver,     setDragOver]     = useState(null)
  const [activeSubView,setActiveSubView]= useState('overview') // overview|heatmap|schedule|teacher|import|copy
  const [csvText,      setCsvText]      = useState('')
  const [csvSyllabusId,setCsvSyllabusId]= useState('')
  const [copyFrom,     setCopyFrom]     = useState('')
  const [copyTo,       setCopyTo]       = useState('')
  const [scheduleId,   setScheduleId]   = useState('')
  const [scheduleStart,setScheduleStart]= useState(today())
  const [schedule,     setSchedule]     = useState([])
  const [tagFilter,    setTagFilter]    = useState('All')
  const [showImportMonthly, setShowImportMonthly] = useState(false)
  const [monthlyImportId,   setMonthlyImportId]   = useState('')
  const [weeklyDigest, setWeeklyDigest] = useState(null)
  const [printMode,    setPrintMode]    = useState(false)

  const blankForm = { course:'', subtype:'', class_name:'', subject_name:'', total_topics:'', expected_end_date:'' }
  const [form, setForm] = useState(blankForm)

  // ── Fetch ──
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

  useEffect(() => { fetchSyllabus() }, [fetchSyllabus])

  // ── Helpers ──
  const getLogsFor   = row => logs.filter(l => l.course===row.course && l.subtype===row.subtype && (!row.class_name||l.class_name===row.class_name) && l.subject_name===row.subject_name)
  const getCompleted = row => getLogsFor(row).length
  const getPace      = row => {
    const bl = getLogsFor(row).sort((a,b) => a.teaching_date?.localeCompare(b.teaching_date))
    if (bl.length < 2) return null
    const first = new Date(bl[0].teaching_date), last = new Date(bl[bl.length-1].teaching_date)
    const days  = Math.max(1, (last-first)/(86400000))
    const rate  = bl.length / days
    const rem   = row.total_topics - bl.length
    if (rem <= 0) return { daysLeft:0, onTrack:true, projectedEnd:last.toISOString().split('T')[0], rate:rate.toFixed(2) }
    const projDays = Math.ceil(rem/rate)
    const projDate = new Date(); projDate.setDate(projDate.getDate()+projDays)
    const projEnd  = projDate.toISOString().split('T')[0]
    return { daysLeft:projDays, onTrack:!row.expected_end_date||projEnd<=row.expected_end_date, projectedEnd:projEnd, rate:rate.toFixed(2) }
  }

  // 7-day no-log check
  const isStale = row => {
    const bl = getLogsFor(row)
    if (!bl.length) return true
    const last = bl.sort((a,b) => b.teaching_date?.localeCompare(a.teaching_date))[0]
    const diff = (new Date()-new Date(last.teaching_date))/(86400000)
    return diff >= 7
  }

  // ── Computed ──
  const allBatches   = [...new Set(syllabus.map(s => s.subtype).filter(Boolean))]
  const allSubjects  = [...new Set(syllabus.map(s => s.subject_name).filter(Boolean))]

  const filtered = useMemo(() => {
    let rows = syllabus.filter(r =>
      (filterBatch==='All'   || r.subtype===filterBatch) &&
      (filterSubject==='All' || r.subject_name===filterSubject)
    )
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
  }, [syllabus, filterBatch, filterSubject, topicSearch, tagFilter, topics])

  const stats = useMemo(() => {
    const avgPct   = syllabus.length>0 ? Math.round(syllabus.reduce((a,r) => a+Math.min(100,pct(getCompleted(r),r.total_topics)),0)/syllabus.length) : 0
    const offTrack = syllabus.filter(r => { const p=getPace(r); return p&&!p.onTrack }).length
    const complete = syllabus.filter(r => r.total_topics>0 && getCompleted(r)>=r.total_topics).length
    const staleCount = syllabus.filter(r => isStale(r) && getCompleted(r)<r.total_topics).length
    return { avgPct, offTrack, complete, staleCount }
  }, [syllabus, logs])

  // ── CRUD ──
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

  const handleMarkTopic = async (topic, done) => {
    const { error } = await supabase.from('syllabus_topics').update({ completed:done, completed_at:done?new Date().toISOString():null }).eq('id', topic.id)
    if (error) showToast('Update failed', '#dc2626')
    else fetchSyllabus()
  }

  const handleDeleteTopic = async id => {
    await supabase.from('syllabus_topics').delete().eq('id', id)
    fetchSyllabus()
  }

  // ── Auto-mark from logs ──
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

  // ── Drag-and-drop reorder ──
  const handleDrop = async (syllabusId, fromIdx, toIdx) => {
    if (fromIdx===toIdx) return
    const arr = [...(topics[syllabusId]||[])]
    const [moved] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, moved)
    setTopics(prev => ({ ...prev, [syllabusId]: arr }))
    setDragIdx(null); setDragOver(null)
    await Promise.all(arr.map((t,i) => supabase.from('syllabus_topics').update({ order_num:i+1 }).eq('id', t.id)))
  }

  // ── CSV Bulk Import ──
  const handleCSVImport = async () => {
    if (!csvSyllabusId || !csvText.trim()) { showToast('Select a syllabus and paste CSV', '#d97706'); return }
    const lines   = csvText.trim().split('\n').map(l => l.trim()).filter(Boolean)
    const existing= topics[csvSyllabusId]||[]
    const payloads= lines.map((line, i) => {
      const parts = line.split(',')
      return {
        syllabus_id: csvSyllabusId,
        topic_name:  parts[0]?.trim() || line,
        expected_date: parts[1]?.trim() || null,
        tags: parts[2] ? parts[2].split('|').map(t=>t.trim()) : [],
        order_num: existing.length + i + 1,
      }
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
    const payloads = srcTopics.map((t, i) => ({
      syllabus_id:  copyTo,
      topic_name:   t.topic_name,
      expected_date:t.expected_date||null,
      tags:         t.tags||[],
      order_num:    destExisting.length + i + 1,
    }))
    const { error } = await supabase.from('syllabus_topics').insert(payloads)
    if (error) showToast('Copy failed: '+error.message, '#dc2626')
    else { fetchSyllabus(); showToast(`Copied ${payloads.length} topics ✅`, '#16a34a'); setCopyFrom(''); setCopyTo('') }
  }

  // ── Import from Monthly Syllabus ──
  const handleImportMonthly = async syllabusId => {
    const row = syllabus.find(r => r.id===syllabusId)
    if (!row) return
    const matching = monthlySyllabus.filter(m =>
      m.subject_name===row.subject_name &&
      (!row.subtype || m.admit_type===row.subtype || !m.admit_type)
    )
    if (!matching.length) { showToast('No matching monthly syllabus topics found', '#d97706'); return }
    const existing = topics[syllabusId]||[]
    const existingNames = new Set(existing.map(t => t.topic_name?.toLowerCase()))
    const newTopics = matching.filter(m => !existingNames.has(m.topic?.toLowerCase()))
    if (!newTopics.length) { showToast('All monthly topics already added', '#d97706'); return }
    const payloads = newTopics.map((m, i) => ({
      syllabus_id: syllabusId,
      topic_name:  m.topic,
      completed:   m.completed||false,
      completed_at:m.completed_at||null,
      order_num:   existing.length + i + 1,
      tags:        [],
    }))
    const { error } = await supabase.from('syllabus_topics').insert(payloads)
    if (error) showToast('Import failed: '+error.message, '#dc2626')
    else { fetchSyllabus(); showToast(`Imported ${payloads.length} topics from Monthly Syllabus ✅`, '#16a34a') }
  }

  // ── Schedule Generator ──
  const generateSchedule = () => {
    const row = syllabus.find(r => r.id===scheduleId)
    if (!row) return
    const rowTopics = topics[scheduleId]||[]
    if (!rowTopics.length) { showToast('Add topics first', '#d97706'); return }
    const pending = rowTopics.filter(t => !t.completed)
    const start   = new Date(scheduleStart)
    const sched   = []
    let d = new Date(start)
    let ti = 0
    while (ti < pending.length && sched.length < 60) {
      const dow = d.getDay()
      if (dow !== 0) { // skip Sunday
        sched.push({ date: d.toISOString().split('T')[0], day: DAYS[dow===0?6:dow-1], topic: pending[ti].topic_name })
        ti++
      }
      d.setDate(d.getDate()+1)
    }
    setSchedule(sched)
  }

  // ── Export CSV ──
  const exportCSV = () => {
    const rows = [['Batch','Subject','Course','Total','Done','Progress%','Pace','Projected End','Status']]
    syllabus.forEach(r => {
      const done = getCompleted(r)
      const p    = pct(done, r.total_topics)
      const pace = getPace(r)
      rows.push([r.subtype||'', r.subject_name, r.course, r.total_topics, done, p+'%', pace?pace.rate+'/d':'—', pace?pace.projectedEnd:'—', p>=100?'Complete':pace?pace.onTrack?'On track':'Off track':'No data'])
    })
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const link = Object.assign(document.createElement('a'), { href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download:`syllabus_${today()}.csv` })
    link.click()
    showToast('CSV exported ✅', '#16a34a')
  }

  // ── Print Report ──
  const handlePrint = () => {
    setPrintMode(true)
    setTimeout(() => { window.print(); setPrintMode(false) }, 300)
  }

  // ── Heatmap Data ──
  const heatmapData = useMemo(() => {
    const months = [...new Set(logs.map(l => l.teaching_date?.slice(0,7)).filter(Boolean))].sort().slice(-6)
    return { months, rows: allSubjects.map(subj => ({
      subject: subj,
      counts: months.map(m => logs.filter(l => l.subject_name===subj && l.teaching_date?.startsWith(m)).length)
    }))}
  }, [logs, allSubjects])

  // ── Per-Teacher Coverage ──
  const teacherCoverage = useMemo(() => {
    const map = {}
    logs.forEach(l => {
      if (!l.teacher_name) return
      const key = l.teacher_name
      if (!map[key]) map[key] = { name:key, subjects:new Set(), logs:0, topics:new Set() }
      map[key].subjects.add(l.subject_name)
      map[key].logs++
      if (l.topic_taught) map[key].topics.add(l.topic_taught)
    })
    return Object.values(map).sort((a,b) => b.logs-a.logs)
  }, [logs])

  // ── Weekly Digest ──
  const generateDigest = () => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7)
    const weekStr = weekAgo.toISOString().split('T')[0]
    const weekLogs= logs.filter(l => l.teaching_date>=weekStr)
    const digest  = syllabus.map(r => {
      const wl    = weekLogs.filter(l => l.course===r.course && l.subtype===r.subtype && l.subject_name===r.subject_name)
      const done  = getCompleted(r)
      const p     = pct(done, r.total_topics)
      const pace  = getPace(r)
      return { ...r, weekLogs:wl.length, done, p, pace, stale:isStale(r) }
    }).sort((a,b) => a.p-b.p)
    setWeeklyDigest(digest)
    showToast('Weekly digest generated ✅', '#16a34a')
  }

  const subtypes  = form.course ? subtypesFor(form.course) : []
  const classes   = (form.course&&form.subtype) ? classesFor(form.course, form.subtype) : []

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {toastEl}
      {confirmDel && <ConfirmModal title="Delete Syllabus" message="Delete this syllabus entry and all its topics?" confirmLabel="Delete" danger onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)}/>}

      {/* ── Stats ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Subjects',    value:syllabus.length,   color:'#1e3a5f', bg:'#eff6ff', icon:'📚' },
          { label:'Complete',    value:stats.complete,    color:'#16a34a', bg:'#dcfce7', icon:'✅' },
          { label:'Avg Coverage',value:`${stats.avgPct}%`,color:scoreColor(stats.avgPct), bg:scoreBg(stats.avgPct), icon:'📊' },
          { label:'Off Track',   value:stats.offTrack,    color:'#dc2626', bg:'#fee2e2', icon:'⚠️' },
          { label:'Stale (7d)',  value:stats.staleCount,  color:'#d97706', bg:'#fef9c3', icon:'🕰️' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:12, padding:16, borderLeft:`4px solid ${c.color}` }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{c.icon}</div>
            <p style={{ fontSize:11, color:c.color, fontWeight:700, margin:0, textTransform:'uppercase' }}>{c.label}</p>
            <h2 style={{ fontSize:24, fontWeight:800, color:c.color, margin:'2px 0 0', fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</h2>
          </div>
        ))}
      </div>

      {/* ── Sub-nav ── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {[
          ['overview','📋 Overview'],['heatmap','🌡️ Heatmap'],['schedule','📅 Schedule'],
          ['teacher','👨‍🏫 Teachers'],['import','📥 Import'],['copy','📋 Copy'],['digest','📧 Digest'],
        ].map(([key,label]) => (
          <button key={key} onClick={() => setActiveSubView(key)} style={{ ...S.btnSm(activeSubView===key?'#1e3a5f':'#e2e8f0'), color:activeSubView===key?'white':'#374151', fontSize:12 }}>{label}</button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={exportCSV} style={S.btnSm('#16a34a')}>📥 CSV</button>
          <button onClick={handlePrint} style={S.btnSm('#7c3aed')}>🖨️ Print</button>
        </div>
      </div>

      {/* ════ OVERVIEW ════ */}
      {activeSubView==='overview' && (
        <>
          {/* Controls */}
          <div style={{ ...S.card, padding:'14px 16px', marginBottom:14 }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <input placeholder="🔍 Search subjects or topics..." value={topicSearch} onChange={e=>setTopicSearch(e.target.value)} style={{ ...S.input, flex:'1 1 180px', minWidth:150 }}/>
              <select value={filterBatch}   onChange={e=>setFilterBatch(e.target.value)}   style={{ ...S.select, width:'auto', flex:'0 1 120px' }}><option value="All">All Batches</option>{allBatches.map(b=><option key={b} value={b}>{b}</option>)}</select>
              <select value={filterSubject} onChange={e=>setFilterSubject(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 140px' }}><option value="All">All Subjects</option>{allSubjects.map(s=><option key={s} value={s}>{s}</option>)}</select>
              <select value={tagFilter}     onChange={e=>setTagFilter(e.target.value)}     style={{ ...S.select, width:'auto', flex:'0 1 110px' }}><option value="All">All Tags</option>{TOPIC_TAGS.map(t=><option key={t} value={t}>{t}</option>)}</select>
              <div style={{ display:'flex', gap:4 }}>
                {[['cards','📋'],['pace','📈']].map(([m,icon]) => (
                  <button key={m} onClick={()=>setViewMode(m)} style={{ ...S.btnSm(viewMode===m?'#1e3a5f':'#e2e8f0'), color:viewMode===m?'white':'#374151' }}>{icon}</button>
                ))}
              </div>
              <button onClick={() => { setShowForm(!showForm); setEditingRow(null); setForm(blankForm) }} style={S.btn(showForm?'#64748b':'#1e3a5f')}>
                {showForm ? '✖ Cancel' : '➕ Add'}
              </button>
            </div>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <div style={{ ...S.card, border:'1px solid #1e3a5f33', marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1e3a5f', marginBottom:14 }}>{editingRow?'✏️ Edit Syllabus':'➕ New Syllabus Entry'}</div>
              <form onSubmit={handleSave}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:14 }}>
                  {!editingRow && (
                    <>
                      <div>
                        <label style={S.label}>Course</label>
                        <select value={form.course} onChange={e=>setForm(f=>({...f,course:e.target.value,subtype:'',class_name:''}))} required style={S.select}>
                          <option value="">Select</option>{courses.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={S.label}>Batch/Subtype</label>
                        <select value={form.subtype} onChange={e=>setForm(f=>({...f,subtype:e.target.value,class_name:''}))} style={S.select}>
                          <option value="">All</option>{subtypes.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={S.label}>Class</label>
                        {classes.length>0
                          ? <select value={form.class_name} onChange={e=>setForm(f=>({...f,class_name:e.target.value}))} style={S.select}><option value="">All</option>{classes.map(c=><option key={c} value={c}>{c}</option>)}</select>
                          : <input value={form.class_name} onChange={e=>setForm(f=>({...f,class_name:e.target.value}))} placeholder="Optional" style={S.input}/>
                        }
                      </div>
                      <div>
                        <label style={S.label}>Subject</label>
                        <select value={form.subject_name} onChange={e=>setForm(f=>({...f,subject_name:e.target.value}))} required style={S.select}>
                          <option value="">Select</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  {editingRow && <div style={{ gridColumn:'1/-1', padding:'8px 12px', background:'#eff6ff', borderRadius:8, fontSize:13, color:'#1e3a5f', fontWeight:600 }}>✏️ Editing: {editingRow.subject_name} · {editingRow.subtype}</div>}
                  <div>
                    <label style={S.label}>Total Topics</label>
                    <input type="number" min="1" value={form.total_topics} onChange={e=>setForm(f=>({...f,total_topics:e.target.value}))} required placeholder="e.g. 40" style={S.input}/>
                  </div>
                  <div>
                    <label style={S.label}>Target End Date</label>
                    <input type="date" value={form.expected_end_date} onChange={e=>setForm(f=>({...f,expected_end_date:e.target.value}))} style={S.input}/>
                  </div>
                </div>
                <button type="submit" disabled={saving} style={S.btn('#16a34a',saving)}>{saving?'⏳ Saving...':'✅ Save'}</button>
              </form>
            </div>
          )}

          {/* Loading */}
          {loading && <div style={{ textAlign:'center', padding:32, color:'#64748b' }}>⏳ Loading...</div>}

          {/* Cards View */}
          {!loading && viewMode==='cards' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filtered.length===0 && <div style={{ ...S.card, textAlign:'center', padding:32, color:'#94a3b8' }}>No syllabus entries found.</div>}
              {filtered.map(row => {
                const done       = getCompleted(row)
                const p          = pct(done, row.total_topics)
                const color      = scoreColor(p)
                const pace       = getPace(row)
                const stale      = isStale(row) && done < row.total_topics
                const rowTopics  = topics[row.id]||[]
                const isExpanded = expandedId===row.id
                const topicsDone = rowTopics.filter(t => t.completed).length

                return (
                  <div key={row.id} style={{ ...S.card, marginBottom:0, border:`1px solid ${p>=100?'#bbf7d0':stale?'#fed7aa':pace&&!pace.onTrack?'#fecaca':'#e2e8f0'}` }}>
                    {/* Row Header */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10, flexWrap:'wrap', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                          <span style={{ fontWeight:800, color:'#1e293b', fontSize:14 }}>{row.subject_name}</span>
                          <span style={S.badge('#1e3a5f','#eff6ff')}>{row.subtype||'All'}</span>
                          {row.class_name && <span style={S.badge('#64748b','#f1f5f9')}>{row.class_name}</span>}
                          {p>=100 && <span style={S.badge('#16a34a','#dcfce7')}>✅ Complete</span>}
                          {stale && <span style={S.badge('#d97706','#fef9c3')}>🕰️ Stale 7d+</span>}
                          {pace&&!pace.onTrack && <span style={S.badge('#dc2626','#fee2e2')}>⚠️ Off Track</span>}
                        </div>
                        <div style={{ fontSize:12, color:'#64748b' }}>
                          {row.course}{row.expected_end_date ? ` · Target: ${fmtDate(row.expected_end_date)}` : ''}
                          {rowTopics.length>0 && ` · ${topicsDone}/${rowTopics.length} topics`}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ textAlign:'right' }}>
                          <span style={{ fontSize:22, fontWeight:800, color, fontFamily:"'JetBrains Mono',monospace" }}>{p}%</span>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{done}/{row.total_topics}</div>
                        </div>
                        {/* Action buttons */}
                        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                          <button onClick={()=>handleAutoMark(row.id)}  title="Auto-mark from logs"   style={S.btnSm('#0891b2')}>⚡</button>
                          <button onClick={()=>handleImportMonthly(row.id)} title="Import from Monthly Syllabus" style={S.btnSm('#7c3aed')}>📆</button>
                          <button onClick={()=>{ setEditingRow(row); setForm({...row,total_topics:row.total_topics,expected_end_date:row.expected_end_date||''}); setShowForm(true) }} style={S.btnSm('#0891b2')}>✏️</button>
                          <button onClick={()=>setExpandedId(isExpanded?null:row.id)} style={S.btnSm('#64748b')}>{isExpanded?'▲':'▼'}</button>
                          <button onClick={()=>setConfirmDel(row.id)} style={S.btnSm('#dc2626')}>🗑</button>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <ProgressBar value={done} max={row.total_topics} color={color} height={8}/>

                    {/* Pace info */}
                    {pace && (
                      <div style={{ display:'flex', gap:14, fontSize:12, color:'#64748b', marginTop:6, flexWrap:'wrap' }}>
                        <span>📈 {pace.rate} topics/day</span>
                        {pace.daysLeft>0 && <span>⏱ ~{pace.daysLeft} days left</span>}
                        <span style={{ color:pace.onTrack?'#16a34a':'#dc2626', fontWeight:600 }}>
                          {pace.onTrack?'✅ On track':'⚠️ Behind'} · Est: {fmtDate(pace.projectedEnd)}
                        </span>
                      </div>
                    )}

                    {/* Expanded Topics */}
                    {isExpanded && (
                      <div style={{ marginTop:14, borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                          <div style={{ fontWeight:700, color:'#374151', fontSize:13 }}>📋 Topics</div>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={()=>handleAutoMark(row.id)} style={{ ...S.btnSm('#0891b2'), fontSize:11 }}>⚡ Auto-mark</button>
                            <button onClick={()=>handleImportMonthly(row.id)} style={{ ...S.btnSm('#7c3aed'), fontSize:11 }}>📆 Import Monthly</button>
                            <button onClick={()=>{ setScheduleId(row.id); setActiveSubView('schedule') }} style={{ ...S.btnSm('#16a34a'), fontSize:11 }}>📅 Schedule</button>
                          </div>
                        </div>

                        {/* From logs if no topics */}
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

                        {/* Defined topics with drag-drop */}
                        {rowTopics.map((t, idx) => (
                          <div key={t.id}
                            draggable
                            onDragStart={() => setDragIdx(idx)}
                            onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
                            onDrop={() => handleDrop(row.id, dragIdx, idx)}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', border:`1px solid ${dragOver===idx?'#1e3a5f':'#e2e8f0'}`, borderRadius:7, marginBottom:4, background:t.completed?'#f0fdf4':'white', cursor:'grab', transition:'all .1s' }}>
                            <span style={{ color:'#cbd5e1', fontSize:11, cursor:'grab' }}>⠿</span>
                            <input type="checkbox" checked={!!t.completed} onChange={e=>handleMarkTopic(t,e.target.checked)} style={{ width:14, height:14, cursor:'pointer', accentColor:'#16a34a' }}/>
                            <span style={{ flex:1, fontSize:13, color:t.completed?'#16a34a':'#374151', textDecoration:t.completed?'line-through':'none' }}>{t.topic_name}</span>
                            {/* Tags */}
                            <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                              {(t.tags||[]).map(tag => <TagPill key={tag} tag={tag}/>)}
                            </div>
                            {t.expected_date && <span style={{ fontSize:11, color:'#94a3b8' }}>{fmtDate(t.expected_date)}</span>}
                            <button onClick={()=>handleDeleteTopic(t.id)} style={{ background:'none', border:'none', color:'#fca5a5', cursor:'pointer', fontSize:13, padding:'0 2px' }}>✕</button>
                          </div>
                        ))}

                        {/* Add Topic Form */}
                        {addingTopicTo===row.id ? (
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
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Pace Table View */}
          {!loading && viewMode==='pace' && (
            <div style={{ borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.07)' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, background:'white', minWidth:700 }}>
                  <thead>
                    <tr style={{ background:'#1e3a5f', color:'white' }}>
                      {['Batch','Subject','Done','Total','Progress','Pace','Projected','Target','Status','Actions'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(row => {
                      const done  = getCompleted(row)
                      const p     = pct(done, row.total_topics)
                      const pace  = getPace(row)
                      const stale = isStale(row) && done < row.total_topics
                      const cl    = scoreColor(p)
                      return (
                        <tr key={row.id} style={{ borderBottom:'1px solid #f1f5f9', background:stale?'#fffbeb':pace&&!pace.onTrack?'#fff1f2':'white' }}>
                          <td style={{ padding:'10px 12px' }}><span style={S.badge('#1e3a5f','#eff6ff')}>{row.subtype||'All'}</span></td>
                          <td style={{ padding:'10px 12px', fontWeight:700, color:'#1e293b' }}>{row.subject_name}</td>
                          <td style={{ padding:'10px 12px', fontWeight:700, color:cl, fontFamily:"'JetBrains Mono',monospace" }}>{done}</td>
                          <td style={{ padding:'10px 12px', color:'#64748b', fontFamily:"'JetBrains Mono',monospace" }}>{row.total_topics}</td>
                          <td style={{ padding:'10px 12px', minWidth:110 }}><ProgressBar value={done} max={row.total_topics} height={6}/></td>
                          <td style={{ padding:'10px 12px', color:'#64748b' }}>{pace?`${pace.rate}/d`:'—'}</td>
                          <td style={{ padding:'10px 12px', color:'#374151' }}>{pace?fmtDate(pace.projectedEnd):'—'}</td>
                          <td style={{ padding:'10px 12px', color:'#64748b' }}>{row.expected_end_date?fmtDate(row.expected_end_date):'—'}</td>
                          <td style={{ padding:'10px 12px' }}>
                            {p>=100?<span style={S.badge('#16a34a','#dcfce7')}>✅ Done</span>
                              :stale?<span style={S.badge('#d97706','#fef9c3')}>🕰️ Stale</span>
                              :pace?<span style={S.badge(pace.onTrack?'#16a34a':'#dc2626',pace.onTrack?'#dcfce7':'#fee2e2')}>{pace.onTrack?'On track':'Off track'}</span>
                              :<span style={S.badge('#94a3b8','#f1f5f9')}>No data</span>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={()=>handleAutoMark(row.id)} style={S.btnSm('#0891b2')} title="Auto-mark">⚡</button>
                              <button onClick={()=>handleImportMonthly(row.id)} style={S.btnSm('#7c3aed')} title="Import Monthly">📆</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length===0 && <tr><td colSpan={10} style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No data.</td></tr>}
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
          {heatmapData.rows.length===0 ? (
            <div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>No log data for heatmap.</div>
          ) : (
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
                          const intensity = max>0 ? count/max : 0
                          const bg = count===0 ? '#f1f5f9' : `rgba(30,58,95,${0.1+intensity*0.85})`
                          const color = intensity>0.5 ? 'white' : '#1e3a5f'
                          return (
                            <td key={i} style={{ padding:'8px 10px', textAlign:'center' }}>
                              <div title={`${count} logs`} style={{ width:48, height:36, borderRadius:6, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color, fontSize:13, margin:'0 auto' }}>
                                {count||''}
                              </div>
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
              <button onClick={()=>{ const csv=[['#','Day','Date','Topic'],...schedule.map((s,i)=>[i+1,s.day,s.date,s.topic])].map(r=>r.join(',')).join('\n'); const link=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:`schedule_${today()}.csv`}); link.click() }} style={{ ...S.btnSm('#16a34a'), marginTop:12 }}>📥 Export Schedule CSV</button>
            </div>
          )}
        </div>
      )}

      {/* ════ TEACHER COVERAGE ════ */}
      {activeSubView==='teacher' && (
        <div style={S.card}>
          <div style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:16 }}>👨‍🏫 Per-Teacher Syllabus Coverage</div>
          {teacherCoverage.length===0 ? (
            <div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>No teacher log data.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {teacherCoverage.map((t,i) => (
                <div key={t.name} style={{ padding:'14px 16px', border:'1px solid #e2e8f0', borderRadius:10, background:i<3?'#f0fdf4':'white' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:8 }}>
                    <div>
                      <span style={{ fontWeight:800, color:'#1e293b', fontSize:14 }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'👨‍🏫'} {t.name}</span>
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span style={S.badge('#1e3a5f','#eff6ff')}>{t.logs} logs</span>
                      <span style={S.badge('#7c3aed','#f3e8ff')}>{t.subjects.size} subjects</span>
                      <span style={S.badge('#0891b2','#e0f2fe')}>{t.topics.size} unique topics</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {[...t.subjects].map(s => (
                      <span key={s} style={{ padding:'3px 10px', background:'#f1f5f9', borderRadius:999, fontSize:11, color:'#374151', fontWeight:600 }}>{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════ CSV IMPORT ════ */}
      {activeSubView==='import' && (
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

      {/* ════ COPY BATCH ════ */}
      {activeSubView==='copy' && (
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
                  { label:'Behind',    value:weeklyDigest.filter(r=>r.pace&&!r.pace.onTrack).length, color:'#dc2626', bg:'#fee2e2' },
                  { label:'On Track',  value:weeklyDigest.filter(r=>r.pace&&r.pace.onTrack).length,  color:'#16a34a', bg:'#dcfce7' },
                  { label:'Stale',     value:weeklyDigest.filter(r=>r.stale).length,                 color:'#d97706', bg:'#fef9c3' },
                  { label:'Complete',  value:weeklyDigest.filter(r=>r.p>=100).length,                color:'#7c3aed', bg:'#f3e8ff' },
                ].map(c => (
                  <div key={c.label} style={{ background:c.bg, borderRadius:10, padding:12, borderLeft:`3px solid ${c.color}` }}>
                    <div style={{ fontSize:11, color:c.color, fontWeight:700 }}>{c.label}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {weeklyDigest.map((row,i) => (
                  <div key={row.id} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:row.p>=100?'#f0fdf4':row.stale?'#fffbeb':'white', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:150 }}>
                      <div style={{ fontWeight:700, color:'#1e293b', fontSize:13 }}>{row.subject_name}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{row.subtype||'All'} · {row.weekLogs} logs this week</div>
                    </div>
                    <div style={{ minWidth:100 }}><ProgressBar value={row.done} max={row.total_topics} height={6}/></div>
                    <div style={{ display:'flex', gap:5 }}>
                      {row.p>=100 && <span style={S.badge('#16a34a','#dcfce7')}>✅ Done</span>}
                      {row.stale && <span style={S.badge('#d97706','#fef9c3')}>🕰️ Stale</span>}
                      {row.pace&&!row.pace.onTrack && <span style={S.badge('#dc2626','#fee2e2')}>⚠️ Behind</span>}
                      {row.pace&&row.pace.onTrack&&row.p<100 && <span style={S.badge('#16a34a','#dcfce7')}>✅ On track</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Print-only section ── */}
      <div className="print-only" style={{ display:'none' }} id="syllabus-print">
        <h2 style={{ color:'#1e3a5f' }}>Syllabus Progress Report — {new Date().toLocaleDateString('en-IN')}</h2>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:'#1e3a5f', color:'white' }}>{['Batch','Subject','Done','Total','Progress','Status'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {syllabus.map(row => {
              const done=getCompleted(row), p=pct(done,row.total_topics), pace=getPace(row)
              return <tr key={row.id} style={{ borderBottom:'1px solid #e2e8f0' }}>
                <td style={{ padding:'7px 10px' }}>{row.subtype||'All'}</td>
                <td style={{ padding:'7px 10px', fontWeight:600 }}>{row.subject_name}</td>
                <td style={{ padding:'7px 10px' }}>{done}</td>
                <td style={{ padding:'7px 10px' }}>{row.total_topics}</td>
                <td style={{ padding:'7px 10px', fontWeight:700 }}>{p}%</td>
                <td style={{ padding:'7px 10px' }}>{p>=100?'Complete':pace?pace.onTrack?'On track':'Behind':'No data'}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}