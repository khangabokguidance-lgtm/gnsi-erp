import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from './supabase'

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  forest:  '#1a3c2e',
  green:   '#2A5C45',
  teal:    '#0d9488',
  gold:    '#b45309',
  goldLt:  '#fef3c7',
  slate:   '#0f172a',
  ink:     '#1e293b',
  muted:   '#64748b',
  border:  '#e2e8f0',
  surface: '#f8fafc',
  white:   '#ffffff',
  red:     '#dc2626',
  redLt:   '#fef2f2',
  amber:   '#f59e0b',
  amberLt: '#fffbeb',
  purple:  '#8b5cf6',
  purpleLt:'#f5f3ff',
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const BATCH_COLORS = {
  Achiever:  { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
  Leader:    { bg:'#f0fdf4', border:'#22c55e', text:'#15803d' },
  Champion:  { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
  Lakshya:   { bg:'#fff7ed', border:'#f97316', text:'#c2410c' },
  Umeed:     { bg:'#fdf2f8', border:'#ec4899', text:'#be185d' },
  Elite:     { bg:'#f0fdfa', border:'#14b8a6', text:'#0f766e' },
  Prime:     { bg:'#fefce8', border:'#eab308', text:'#854d0e' },
}

const BREAK_TYPES = ['LUNCH','TEA BREAK','DINNER','CLASS OFF','Recreation','DOUBT SESSION']

const getBatchStyle = (name) => {
  if (!name) return { bg:'#f8fafc', border:'#94a3b8', text:'#475569' }
  const base = name.split(' ')[0]
  return BATCH_COLORS[base] || { bg:'#f8fafc', border:'#94a3b8', text:'#475569' }
}

const emptyForm = {
  class_name:'', section:'', day_name:'Monday',
  period_name:'', subject_name:'', teacher_name:'', room_name:'',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const css = (obj) => Object.entries(obj).map(([k,v])=>`${k.replace(/([A-Z])/g,'-$1').toLowerCase()}:${v}`).join(';')

function Badge({ label, style={} }) {
  const bs = getBatchStyle(label)
  return (
    <span style={{
      display:'inline-block', padding:'2px 9px', borderRadius:999,
      fontSize:11, fontWeight:700, letterSpacing:'.04em',
      background:bs.bg, color:bs.text, border:`1px solid ${bs.border}`,
      ...style
    }}>{label}</span>
  )
}

function Pill({ children, color='#1a3c2e', bg='#e2e8f0' }) {
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:4,
      fontSize:11, fontWeight:600, background:bg, color,
    }}>{children}</span>
  )
}

function Input({ value, onChange, placeholder, style={}, type='text' }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{
        width:'100%', padding:'7px 10px', borderRadius:6,
        border:`1.5px solid ${T.border}`, fontSize:13, outline:'none',
        fontFamily:'inherit', color:T.ink, background:T.white,
        boxSizing:'border-box', transition:'border .15s',
        ...style
      }}
      onFocus={e=>e.target.style.borderColor=T.green}
      onBlur={e=>e.target.style.borderColor=T.border}
    />
  )
}

function Select({ value, onChange, children, style={} }) {
  return (
    <select value={value} onChange={onChange}
      style={{
        width:'100%', padding:'7px 10px', borderRadius:6,
        border:`1.5px solid ${T.border}`, fontSize:13, outline:'none',
        fontFamily:'inherit', color:T.ink, background:T.white,
        boxSizing:'border-box', cursor:'pointer',
        ...style
      }}
    >{children}</select>
  )
}

// ── Inline editable cell with auto-save ────────────────────────────────────────
function EditCell({ value, onSave, type='text', options=[], autoSave=false, delay=800 }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value)
  const [saving, setSaving]   = useState(false)
  const ref = useRef(null)
  const autoSaveRef = useRef(null)

  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])
  useEffect(() => { setVal(value) }, [value])

  const commit = async () => {
    setEditing(false)
    if (val !== value) {
      setSaving(true)
      await onSave(val)
      setSaving(false)
    }
  }
  const cancel = () => { setEditing(false); setVal(value) }

  useEffect(() => {
    if (!autoSave || !editing) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      if (val !== value) {
        setSaving(true)
        onSave(val).then(() => setSaving(false))
      }
    }, delay)
    return () => clearTimeout(autoSaveRef.current)
  }, [val, autoSave, editing, delay, value, onSave])

  if (!editing) return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{
        cursor:'text', display:'block', minHeight:22, padding:'2px 4px',
        borderRadius:4, color: value ? T.ink : T.muted,
        fontSize:13, lineHeight:1.4,
        border:'1px solid transparent',
        transition:'all .12s', position:'relative',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.background='#f1f5f9' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='transparent' }}
    >
      {value || <span style={{color:T.muted,fontSize:11,fontStyle:'italic'}}>—</span>}
      {saving && <span style={{position:'absolute',right:2,top:2,fontSize:9,color:T.teal}}>●</span>}
    </span>
  )

  if (type === 'select') return (
    <select ref={ref} value={val}
      onChange={e=>setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') cancel() }}
      style={{
        width:'100%', padding:'4px 6px', borderRadius:5,
        border:`1.5px solid ${T.green}`, fontSize:13,
        outline:'none', fontFamily:'inherit', background:T.white,
        boxShadow:`0 0 0 3px ${T.green}22`,
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <input ref={ref} value={val}
      onChange={e=>setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') cancel() }}
      style={{
        width:'100%', padding:'4px 6px', borderRadius:5,
        border:`1.5px solid ${T.green}`, fontSize:13,
        outline:'none', fontFamily:'inherit',
        boxShadow:`0 0 0 3px ${T.green}22`,
        boxSizing:'border-box',
      }}
    />
  )
}

// ── Edit Entry Modal ─────────────────────────────────────────────────────────
function EditEntryModal({ entry, onClose, onSaved }) {
  const [form, setForm] = useState({
    class_name: entry.class_name || '',
    section: entry.section || '',
    day_name: entry.day_name || 'Monday',
    period_name: entry.period_name || '',
    subject_name: entry.subject_name || '',
    teacher_name: entry.teacher_name || '',
    room_name: entry.room_name || '',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('timetable_entries')
        .update({
          class_name: form.class_name,
          section: form.section || null,
          day_name: form.day_name,
          period_name: form.period_name,
          subject_name: form.subject_name || null,
          teacher_name: form.teacher_name || null,
          room_name: form.room_name || null,
        })
        .eq('id', entry.id)

      if (error) throw error
      onSaved()
      onClose()
    } catch (err) {
      alert('Error updating entry: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
    }}>
      <div style={{
        background:T.white, borderRadius:'16px', width:'100%', maxWidth:'520px',
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{
          background:`linear-gradient(135deg, ${T.forest} 0%, ${T.green} 100%)`,
          padding:'20px 24px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <div style={{ fontSize:'11px', color:'#93c5fd', fontWeight:'600', letterSpacing:'1px', textTransform:'uppercase' }}>
              ✏️ Edit Timetable Entry
            </div>
            <div style={{ fontSize:'18px', fontWeight:'700', color:'white', marginTop:'4px' }}>
              {entry.class_name} {entry.section ? `· ${entry.section}` : ''}
            </div>
            <div style={{ fontSize:'12px', color:'#93c5fd', marginTop:'2px' }}>
              {entry.day_name} · {entry.period_name}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', width:'32px', height:'32px', borderRadius:'8px', cursor:'pointer', fontSize:'16px' }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{ padding:'24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            <div>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.06em' }}>Batch / Class *</label>
              <Input value={form.class_name} onChange={e => handleChange('class_name', e.target.value)} placeholder="e.g. Achiever" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.06em' }}>Section</label>
              <Input value={form.section} onChange={e => handleChange('section', e.target.value)} placeholder="A / B / Combined" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.06em' }}>Day *</label>
              <Select value={form.day_name} onChange={e => handleChange('day_name', e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.06em' }}>Period / Time *</label>
              <Input value={form.period_name} onChange={e => handleChange('period_name', e.target.value)} placeholder="7:00–7:45 AM" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.06em' }}>Subject *</label>
              <Input value={form.subject_name} onChange={e => handleChange('subject_name', e.target.value)} placeholder="Mathematics" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.06em' }}>Teacher</label>
              <Input value={form.teacher_name} onChange={e => handleChange('teacher_name', e.target.value)} placeholder="Sir Himan" />
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.06em' }}>Room</label>
              <Input value={form.room_name} onChange={e => handleChange('room_name', e.target.value)} placeholder="Room 101" />
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
            <button type="button" onClick={onClose} style={{
              flex:1, padding:'10px', borderRadius:'8px', border:`1px solid ${T.border}`,
              background:T.surface, fontWeight:'600', cursor:'pointer', fontSize:'13px', color:T.ink
            }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{
              flex:2, padding:'10px', borderRadius:'8px', border:'none',
              background:saving ? '#93c5fd' : T.forest, color:'white',
              fontWeight:'700', cursor:saving ? 'not-allowed' : 'pointer', fontSize:'14px'
            }}>
              {saving ? '⏳ Saving...' : '💾 Update Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Conflict Detector ──────────────────────────────────────────────────────────
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
      if (tItems.length > 1) {
        conflicts.push({ type:'teacher', teacher:t, entries:tItems, message:`${t} double-booked at ${key.replace('|',' ')}` })
      }
    })
    const rooms = {}
    items.forEach(e => {
      if (!e.room_name) return
      if (!rooms[e.room_name]) rooms[e.room_name] = []
      rooms[e.room_name].push(e)
    })
    Object.entries(rooms).forEach(([r, rItems]) => {
      if (rItems.length > 1) {
        conflicts.push({ type:'room', room:r, entries:rItems, message:`Room ${r} overbooked at ${key.replace('|',' ')}` })
      }
    })
  })
  return conflicts
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Timetable() {
  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [search,     setSearch]     = useState('')
  const [dayFilter,  setDayFilter]  = useState('All')
  const [classFilter,setClassFilter]= useState('All')
  const [viewMode,   setViewMode]   = useState('table')
  const [form,       setForm]       = useState(emptyForm)
  const [editingId,  setEditingId]  = useState(null)
  const [deleteId,   setDeleteId]   = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [toast,      setToast]      = useState(null)
  const [conflicts,  setConflicts]  = useState([])
  const [showConflicts, setShowConflicts] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkMode,    setBulkMode]   = useState(false)
  const [dragItem,    setDragItem]   = useState(null)
  const [dragOver,    setDragOver]   = useState(null)
  const [teacherFilter, setTeacherFilter] = useState('All')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const searchRef = useRef(null)

  // ── Edit Entry State ──
  const [editingEntry, setEditingEntry] = useState(null)

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  const fetch = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('timetable_entries').select('*').order('created_at', { ascending: false })
    if (!error) {
      setEntries(data || [])
      setConflicts(findConflicts(data || []))
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') { e.preventDefault(); setShowForm(true) }
        if (e.key === 'f') { e.preventDefault(); searchRef.current?.focus() }
        if (e.key === 'g') { e.preventDefault(); setViewMode('grid') }
        if (e.key === 't') { e.preventDefault(); setViewMode('table') }
        if (e.key === 'd') { e.preventDefault(); setViewMode('daily') }
        if (e.key === 'p') { e.preventDefault(); handlePrint() }
        if (e.key === 'k') { e.preventDefault(); setShowShortcuts(true) }
      }
      if (e.key === 'Escape') {
        setShowForm(false)
        setDeleteId(null)
        setShowShortcuts(false)
        setBulkMode(false)
        setSelectedIds(new Set())
        setEditingEntry(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('timetable_entries').insert([form])
    if (error) { showToast('Error: ' + error.message, 'error') }
    else { setForm(emptyForm); setShowForm(false); fetch(); showToast('Entry added successfully') }
    setSaving(false)
  }

  // ── Inline field update ───────────────────────────────────────────────────────
  const handleFieldSave = async (id, field, value) => {
    setSavingEdit(true)
    const { error } = await supabase.from('timetable_entries').update({ [field]: value }).eq('id', id)
    if (error) { showToast('Update failed: ' + error.message, 'error') }
    else {
      const updated = entries.map(e => e.id === id ? { ...e, [field]: value } : e)
      setEntries(updated)
      setConflicts(findConflicts(updated))
      showToast('Saved')
    }
    setSavingEdit(false)
  }

  // ── Edit Entry ──
  const handleOpenEdit = (entry) => {
    setEditingEntry(entry)
  }

  const handleEditSaved = () => {
    fetch()
    setEditingEntry(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id)
    if (error) { showToast('Delete failed', 'error') }
    else { setEntries(prev => prev.filter(e => e.id !== id)); showToast('Entry deleted'); setDeleteId(null) }
  }

  // ── Bulk Delete ───────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    const { error } = await supabase.from('timetable_entries').delete().in('id', ids)
    if (error) { showToast('Bulk delete failed', 'error') }
    else {
      setEntries(prev => prev.filter(e => !selectedIds.has(e.id)))
      setSelectedIds(new Set())
      setBulkMode(false)
      showToast(`${ids.length} entries deleted`)
    }
  }

  // ── Bulk Edit ─────────────────────────────────────────────────────────────────
  const handleBulkUpdate = async (field, value) => {
    const ids = Array.from(selectedIds)
    if (!ids.length || !value) return
    const { error } = await supabase.from('timetable_entries').update({ [field]: value }).in('id', ids)
    if (error) { showToast('Bulk update failed', 'error') }
    else {
      setEntries(prev => prev.map(e => selectedIds.has(e.id) ? { ...e, [field]: value } : e))
      setSelectedIds(new Set())
      setBulkMode(false)
      showToast(`${ids.length} entries updated`)
    }
  }

  // ── Drag & Drop Reorder ───────────────────────────────────────────────────────
  const handleDragStart = (e, item) => {
    setDragItem(item)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, item) => {
    e.preventDefault()
    setDragOver(item.id)
  }
  const handleDrop = async (e, targetItem) => {
    e.preventDefault()
    setDragOver(null)
    if (!dragItem || dragItem.id === targetItem.id) return
    const { error } = await supabase.from('timetable_entries')
      .update({ period_name: targetItem.period_name })
      .eq('id', dragItem.id)
    if (!error) {
      await supabase.from('timetable_entries')
        .update({ period_name: dragItem.period_name })
        .eq('id', targetItem.id)
      fetch()
      showToast('Periods swapped')
    }
    setDragItem(null)
  }

  // ── Export / Print ────────────────────────────────────────────────────────────
  const handlePrint = () => { window.print() }

  const handleExportCSV = () => {
    const headers = ['Batch','Section','Day','Period','Subject','Teacher','Room']
    const rows = filtered.map(e => [
      e.class_name, e.section||'', e.day_name, e.period_name,
      e.subject_name||'', e.teacher_name||'', e.room_name||''
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timetable_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV exported')
  }

  // ── Filters ───────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const dayOrder = { Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6,Sunday:7 }
    return entries
      .filter(item => {
        const s = [item.class_name,item.section,item.day_name,item.period_name,item.subject_name,item.teacher_name,item.room_name]
          .map(v=>(v||'').toLowerCase()).some(v=>v.includes(q))
        const d = dayFilter  === 'All' || item.day_name   === dayFilter
        const c = classFilter=== 'All' || item.class_name === classFilter
        const t = teacherFilter=== 'All' || item.teacher_name === teacherFilter
        return s && d && c && t
      })
      .sort((a,b) => {
        const dd = (dayOrder[a.day_name]||9) - (dayOrder[b.day_name]||9)
        return dd !== 0 ? dd : (a.period_name||'').localeCompare(b.period_name||'')
      })
  }, [entries, search, dayFilter, classFilter, teacherFilter])

  const uniqueClasses = [...new Set(entries.map(e=>e.class_name).filter(Boolean))].sort()
  const uniqueTeachers = [...new Set(entries.map(e=>e.teacher_name).filter(Boolean))].sort()

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const todayName = new Date().toLocaleDateString('en-US',{weekday:'long'})
  const stats = [
    { label:'Total Entries',  val:entries.length,                                              icon:'📋', color:T.forest },
    { label:'Batches',        val:uniqueClasses.length,                                         icon:'🏫', color:'#16a34a' },
    { label:'Teachers',       val:uniqueTeachers.length,                                        icon:'👨‍🏫', color:'#7c3aed' },
    { label:"Today's Classes",val:entries.filter(e=>e.day_name===todayName).length,             icon:'📅', color:'#b45309' },
    { label:'Conflicts',      val:conflicts.length, icon:'⚠️', color: conflicts.length ? T.red : '#16a34a' },
  ]

  // ── Teacher Workload Data ─────────────────────────────────────────────────────
  const teacherWorkload = useMemo(() => {
    const data = {}
    entries.forEach(e => {
      if (!e.teacher_name) return
      if (!data[e.teacher_name]) data[e.teacher_name] = { count:0, subjects:new Set(), days:new Set(), hours:0 }
      data[e.teacher_name].count++
      data[e.teacher_name].subjects.add(e.subject_name)
      data[e.teacher_name].days.add(e.day_name)
      data[e.teacher_name].hours += 0.75
    })
    return Object.entries(data)
      .map(([name, d]) => ({ name, ...d, subjects: [...d.subjects], days: [...d.days] }))
      .sort((a,b) => b.count - a.count)
  }, [entries])

  // ── Grid view (day × period pivot) ────────────────────────────────────────────
  const gridData = useMemo(() => {
    const days   = dayFilter === 'All' ? DAYS : [dayFilter]
    const periods = [...new Set(filtered.map(e=>e.period_name).filter(Boolean))].sort()
    return { days, periods }
  }, [filtered, dayFilter])

  // ── Daily Consolidated View Data ──────────────────────────────────────────────
  const dailyViewData = useMemo(() => {
    const days = dayFilter === 'All' ? DAYS : [dayFilter]
    const allBatches = ['Achiever','Leader','Champion','Lakshya','Umeed','Elite','Prime']
    return days.map(day => {
      const dayEntries = entries.filter(e => e.day_name === day)
      const periods = [...new Set(dayEntries.map(e=>e.period_name).filter(Boolean))].sort()
      return { day, periods, dayEntries, allBatches }
    })
  }, [entries, dayFilter])

  // ── Toggle selection ──────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }
  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(e => e.id)))
  }

  return (
    <div style={{
      padding:'28px', fontFamily:"'DM Sans','Segoe UI',sans-serif",
      background: darkMode ? '#0f172a' : '#f0f4f8',
      minHeight:'100vh', color: darkMode ? '#e2e8f0' : T.ink,
      transition:'background .3s, color .3s'
    }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position:'fixed', top:24, right:24, zIndex:9999,
          padding:'12px 22px', borderRadius:10,
          background: toast.type==='error' ? T.red : T.forest,
          color:'white', fontWeight:600, fontSize:13,
          boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
          animation:'fadeIn .2s ease',
        }}>
          {toast.type==='error' ? '⚠️' : '✓'} {toast.msg}
        </div>
      )}

      {/* ── Shortcuts Modal ── */}
      {showShortcuts && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
          zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center'
        }} onClick={()=>setShowShortcuts(false)}>
          <div style={{ background:T.white, borderRadius:16, padding:32, maxWidth:420, width:'90%' }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:16, color:T.forest }}>⌨️ Keyboard Shortcuts</div>
            <div style={{ display:'grid', gap:8 }}>
              {[
                ['Ctrl + N', 'Add new entry'],
                ['Ctrl + F', 'Focus search'],
                ['Ctrl + G', 'Switch to Grid view'],
                ['Ctrl + T', 'Switch to Table view'],
                ['Ctrl + D', 'Switch to Daily view'],
                ['Ctrl + P', 'Print timetable'],
                ['Ctrl + K', 'Show this help'],
                ['Esc', 'Close modals / Cancel'],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontFamily:'monospace', background:T.surface, padding:'2px 8px', borderRadius:4, fontSize:12 }}>{k}</span>
                  <span style={{ color:T.muted, fontSize:13 }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowShortcuts(false)} style={{ marginTop:16, width:'100%', padding:10, borderRadius:8, border:'none', background:T.forest, color:'white', fontWeight:700, cursor:'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {deleteId && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
          zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'
        }}>
          <div style={{ background:T.white, borderRadius:16, padding:32, maxWidth:360, width:'90%', boxShadow:'0 16px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize:36, textAlign:'center', marginBottom:12 }}>🗑️</div>
            <div style={{ fontWeight:700, fontSize:18, textAlign:'center', color:T.ink, marginBottom:8 }}>Delete Entry?</div>
            <div style={{ fontSize:13, color:T.muted, textAlign:'center', marginBottom:24 }}>
              This will permanently remove this timetable entry.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setDeleteId(null)}
                style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, fontWeight:600, cursor:'pointer', fontSize:13 }}>
                Cancel
              </button>
              <button onClick={()=>handleDelete(deleteId)}
                style={{ flex:1, padding:'10px', borderRadius:8, border:'none', background:T.red, color:'white', fontWeight:700, cursor:'pointer', fontSize:13 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Entry Modal ── */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* ── Bulk Action Bar ── */}
      {bulkMode && selectedIds.size > 0 && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          zIndex:100, background:T.ink, color:'white', padding:'12px 24px',
          borderRadius:12, display:'flex', alignItems:'center', gap:16,
          boxShadow:'0 8px 32px rgba(0,0,0,.3)'
        }}>
          <span style={{ fontWeight:700, fontSize:13 }}>{selectedIds.size} selected</span>
          <Select value="" onChange={e => e.target.value && handleBulkUpdate('day_name', e.target.value)} style={{ width:130, color:T.ink }}>
            <option value="">Move to Day…</option>
            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select value="" onChange={e => e.target.value && handleBulkUpdate('class_name', e.target.value)} style={{ width:130, color:T.ink }}>
            <option value="">Move to Batch…</option>
            {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <button onClick={handleBulkDelete} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:T.red, color:'white', fontWeight:700, cursor:'pointer', fontSize:12 }}>
            🗑 Delete
          </button>
          <button onClick={() => { setBulkMode(false); setSelectedIds(new Set()) }} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid rgba(255,255,255,.3)', background:'transparent', color:'white', fontWeight:600, cursor:'pointer', fontSize:12 }}>
            Done
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        background:`linear-gradient(135deg, ${T.forest} 0%, ${T.green} 60%, #3a7a5c 100%)`,
        borderRadius:16, padding:'24px 32px', marginBottom:24, color:'white',
        boxShadow:'0 4px 24px rgba(26,60,46,.25)', position:'relative', overflow:'hidden'
      }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,.04)' }} />
        <div style={{ position:'absolute', bottom:-50, left:100, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,.03)' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14, position:'relative' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <span style={{ fontSize:28 }}>🕒</span>
              <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:24, fontWeight:600, letterSpacing:'.3px' }}>
                Timetable Manager
              </span>
            </div>
            <div style={{ fontSize:13, opacity:.75, marginLeft:38 }}>
              GNSI · Course Induction Schedule · {entries.length} entries loaded
              {conflicts.length > 0 && (
                <span style={{ marginLeft:12, background:T.red, padding:'2px 10px', borderRadius:999, fontSize:11, fontWeight:700, cursor:'pointer' }}
                  onClick={()=>setShowConflicts(!showConflicts)}>
                  ⚠️ {conflicts.length} conflict{conflicts.length>1?'s':''}
                </span>
              )}
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={()=>setDarkMode(!darkMode)}
              style={{ padding:'9px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.12)', color:'white', fontWeight:600, cursor:'pointer', fontSize:13 }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={()=>setShowShortcuts(true)}
              style={{ padding:'9px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.12)', color:'white', fontWeight:600, cursor:'pointer', fontSize:13 }}>
              ⌨️
            </button>
            <button onClick={handleExportCSV}
              style={{ padding:'9px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.12)', color:'white', fontWeight:600, cursor:'pointer', fontSize:13 }}>
              📥 CSV
            </button>
            <button onClick={handlePrint}
              style={{ padding:'9px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.12)', color:'white', fontWeight:600, cursor:'pointer', fontSize:13 }}>
              🖨️ Print
            </button>
            <button
              onClick={() => setViewMode(v => v==='table'?'grid':v==='grid'?'daily':v==='daily'?'teacher':'table')}
              style={{ padding:'9px 18px', borderRadius:8, border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.12)', color:'white', fontWeight:600, cursor:'pointer', fontSize:13 }}>
              {viewMode==='table' ? '⊞ Grid' : viewMode==='grid' ? '📅 Daily' : viewMode==='daily' ? '👨‍🏫 Teachers' : '☰ Table'}
            </button>
            <button
              onClick={() => setShowForm(f=>!f)}
              style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'white', color:T.forest, fontWeight:700, cursor:'pointer', fontSize:13 }}>
              {showForm ? '✕ Cancel' : '＋ Add Entry'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Conflict Panel ── */}
      {showConflicts && conflicts.length > 0 && (
        <div style={{ background:T.redLt, border:`1px solid ${T.red}44`, borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ fontWeight:700, color:T.red, fontSize:14, marginBottom:8 }}>⚠️ Scheduling Conflicts Detected</div>
          <div style={{ display:'grid', gap:6 }}>
            {conflicts.map((c, i) => (
              <div key={i} style={{ fontSize:12, color:T.ink, padding:'6px 10px', background:'white', borderRadius:6, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, background:c.type==='teacher'?T.amber:T.purple, color:'white', fontWeight:700 }}>
                  {c.type.toUpperCase()}
                </span>
                {c.message}
                <span style={{ marginLeft:'auto', color:T.muted, fontSize:11 }}>
                  {c.entries.map(e => e.class_name).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:14, marginBottom:24 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: darkMode ? '#1e293b' : T.white, borderRadius:12, padding:'18px 20px',
            boxShadow:'0 2px 8px rgba(0,0,0,.06)', borderLeft:`4px solid ${s.color}`,
            transition:'transform .15s', cursor:'pointer',
          }} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
             onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
            <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:11, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:32, fontWeight:700, color:s.color, lineHeight:1 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div style={{ background: darkMode ? '#1e293b' : T.white, borderRadius:14, padding:28, marginBottom:24, boxShadow:'0 4px 20px rgba(0,0,0,.08)', border:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, color: darkMode ? '#e2e8f0' : T.ink, marginBottom:20 }}>
            ➕ New Timetable Entry
          </div>
          <form onSubmit={handleAdd}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:14 }}>
              {[
                { label:'Batch / Class *', key:'class_name', ph:'e.g. Achiever' },
                { label:'Section',         key:'section',    ph:'A / B / Combined' },
                { label:'Subject *',       key:'subject_name',ph:'Mathematics' },
                { label:'Teacher',         key:'teacher_name',ph:'Sir Himan' },
                { label:'Room',            key:'room_name',   ph:'Room 101' },
                { label:'Period / Time *', key:'period_name', ph:'7:00–7:45 AM' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:T.muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>{f.label}</label>
                  <Input value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} placeholder={f.ph} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:T.muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>Day *</label>
                <Select value={form.day_name} onChange={e=>setForm({...form,day_name:e.target.value})}>
                  {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
            </div>
            <div style={{ marginTop:18, display:'flex', gap:10 }}>
              <button type="submit" disabled={saving}
                style={{ padding:'10px 28px', borderRadius:8, border:'none', background:saving?'#93c5fd':T.forest, color:'white', fontWeight:700, cursor:saving?'not-allowed':'pointer', fontSize:14 }}>
                {saving ? '⏳ Saving…' : '✅ Save Entry'}
              </button>
              <button type="button" onClick={()=>setShowForm(false)}
                style={{ padding:'10px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, fontWeight:600, cursor:'pointer', fontSize:13, color:T.ink }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:15, color:T.muted, pointerEvents:'none' }}>🔍</span>
          <input ref={searchRef}
            placeholder="Search by batch, teacher, subject, period, room… (Ctrl+F)"
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{ width:'100%', padding:'11px 14px 11px 38px', borderRadius:9, border:`1.5px solid ${T.border}`, fontSize:13, outline:'none', fontFamily:'inherit', background: darkMode ? '#1e293b' : T.white, boxSizing:'border-box', color: darkMode ? '#e2e8f0' : T.ink }}
            onFocus={e=>e.target.style.borderColor=T.green}
            onBlur={e=>e.target.style.borderColor=T.border}
          />
        </div>
        <Select value={dayFilter} onChange={e=>setDayFilter(e.target.value)} style={{ width:150 }}>
          <option value="All">All Days</option>
          {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
        </Select>
        <Select value={classFilter} onChange={e=>setClassFilter(e.target.value)} style={{ width:160 }}>
          <option value="All">All Batches</option>
          {uniqueClasses.map(c=><option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={teacherFilter} onChange={e=>setTeacherFilter(e.target.value)} style={{ width:160 }}>
          <option value="All">All Teachers</option>
          {uniqueTeachers.map(t=><option key={t} value={t}>{t}</option>)}
        </Select>
      </div>

      {/* ── Bulk Toggle ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:12, color:T.muted, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontWeight:600, color: darkMode ? '#e2e8f0' : T.ink }}>{filtered.length}</span> entries
          {savingEdit && <span style={{ color:T.teal, marginLeft:8 }}>● Saving…</span>}
          <span style={{ marginLeft:16, fontSize:11, color:T.muted, fontStyle:'italic' }}>
            💡 Click any cell to edit inline · Press Enter to save · Esc to cancel
          </span>
        </div>
        <button onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()) }}
          style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${bulkMode ? T.green : T.border}`, background: bulkMode ? '#f0fdf4' : T.surface, color: bulkMode ? T.green : T.muted, fontWeight:600, cursor:'pointer', fontSize:12 }}>
          {bulkMode ? '✓ Done Selecting' : '☑️ Bulk Select'}
        </button>
      </div>

      {/* ── Table / Grid / Daily / Teacher Views ── */}
      {loading ? (
        <div style={{ background: darkMode ? '#1e293b' : T.white, borderRadius:12, padding:60, textAlign:'center', color:T.muted }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⏳</div>
          <div style={{ fontWeight:600 }}>Loading timetable…</div>
        </div>
      ) : viewMode === 'table' ? (

        /* ━━ TABLE VIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        <div style={{ background: darkMode ? '#1e293b' : T.white, borderRadius:14, boxShadow:'0 2px 12px rgba(0,0,0,.07)', overflow:'hidden', border:`1px solid ${T.border}` }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:T.forest }}>
                  {bulkMode && <th style={{ padding:'12px 10px', textAlign:'center' }}>
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={selectAll} />
                  </th>}
                  {['#','Batch','Section','Day','Period','Subject','Teacher','Room','Action'].map((h,i) => (
                    <th key={h+i} style={{
                      padding:'12px 14px', textAlign: i===0||i===8 ? 'center':'left',
                      color:'white', fontWeight:700, fontSize:11, letterSpacing:'.06em',
                      textTransform:'uppercase', whiteSpace:'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const hasConflict = conflicts.some(c => c.entries.some(e => e.id === item.id))
                  return (
                  <tr key={item.id}
                    draggable={true}
                    onDragStart={e => handleDragStart(e, item)}
                    onDragOver={e => handleDragOver(e, item)}
                    onDrop={e => handleDrop(e, item)}
                    style={{
                      background: dragOver === item.id ? '#dcfce7' : hasConflict ? T.redLt : (i%2===0 ? (darkMode?'#1e293b':T.white) : (darkMode?'#0f172a':T.surface)),
                      borderBottom:`1px solid ${T.border}`, transition:'background .1s',
                      cursor: 'grab',
                    }}
                    onMouseEnter={e=>{ if(!dragOver) e.currentTarget.style.background='#f0fdf4' }}
                    onMouseLeave={e=>{ if(!dragOver) e.currentTarget.style.background= i%2===0 ? (darkMode?'#1e293b':T.white) : (darkMode?'#0f172a':T.surface) }}
                  >
                    {bulkMode && <td style={{ padding:'10px', textAlign:'center' }}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={()=>toggleSelect(item.id)} />
                    </td>}
                    <td style={{ padding:'10px 14px', textAlign:'center', color:T.muted, fontSize:12 }}>{i+1}</td>

                    <td style={{ padding:'8px 12px' }}>
                      <EditCell value={item.class_name} onSave={v=>handleFieldSave(item.id,'class_name',v)} autoSave />
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      <EditCell value={item.section||''} onSave={v=>handleFieldSave(item.id,'section',v)} autoSave />
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      <EditCell value={item.day_name} type="select" options={DAYS} onSave={v=>handleFieldSave(item.id,'day_name',v)} />
                    </td>
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                      <EditCell value={item.period_name||''} onSave={v=>handleFieldSave(item.id,'period_name',v)} autoSave />
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      <EditCell value={item.subject_name||''} onSave={v=>handleFieldSave(item.id,'subject_name',v)} autoSave />
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      <EditCell value={item.teacher_name||''} onSave={v=>handleFieldSave(item.id,'teacher_name',v)} autoSave />
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      <EditCell value={item.room_name||''} onSave={v=>handleFieldSave(item.id,'room_name',v)} autoSave />
                    </td>
                    {/* Action column with Edit and Delete buttons */}
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>
                      <div style={{ display:'flex', gap:'6px', justifyContent:'center' }}>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          style={{ padding:'5px 10px', borderRadius:6, border:'none', background:T.teal, color:'white', cursor:'pointer', fontSize:12, fontWeight:600 }}
                          title="Edit Entry"
                        >
                          ✏️
                        </button>
                        <button onClick={()=>setDeleteId(item.id)}
                          style={{ padding:'5px 10px', borderRadius:6, border:`1px solid #fecaca`, background:T.redLt, color:T.red, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
                {!filtered.length && (
                  <tr>
                    <td colSpan={bulkMode?10:9} style={{ padding:48, textAlign:'center', color:T.muted }}>
                      <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
                      <div style={{ fontWeight:600 }}>No entries match your filters</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      ) : viewMode === 'grid' ? (

        /* ━━ GRID VIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        <div>
          {(dayFilter === 'All' ? DAYS : [dayFilter]).map(day => {
            const dayEntries = filtered.filter(e=>e.day_name===day)
            if (!dayEntries.length) return null
            const periods = [...new Set(dayEntries.map(e=>e.period_name))].sort()
            const batches = [...new Set(dayEntries.map(e=>e.class_name).filter(Boolean))].sort()

            return (
              <div key={day} style={{ marginBottom:28 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                  <div style={{ width:3, height:28, background:T.forest, borderRadius:2 }} />
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:T.forest }}>{day}</span>
                  <span style={{ fontSize:12, color:T.muted }}>{dayEntries.length} entries</span>
                </div>
                <div style={{ background: darkMode ? '#1e293b' : T.white, borderRadius:12, overflow:'hidden', border:`1px solid ${T.border}`, boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ background:T.forest }}>
                          <th style={{ padding:'10px 14px', color:'white', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', minWidth:130 }}>Period</th>
                          {batches.map(b => {
                            const bs = getBatchStyle(b)
                            return (
                              <th key={b} style={{ padding:'10px 12px', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.04em', minWidth:140 }}>
                                <span style={{ background:bs.bg, color:bs.text, padding:'3px 10px', borderRadius:999, border:`1px solid ${bs.border}` }}>{b}</span>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((period, pi) => (
                          <tr key={period} style={{ background:pi%2===0?(darkMode?'#1e293b':T.white):(darkMode?'#0f172a':T.surface), borderBottom:`1px solid ${T.border}` }}>
                            <td style={{ padding:'10px 14px', fontWeight:700, color: darkMode ? '#e2e8f0' : T.ink, fontSize:12, whiteSpace:'nowrap', borderRight:`1px solid ${T.border}` }}>
                              {period}
                            </td>
                            {batches.map(batch => {
                              const cell = dayEntries.filter(e=>e.class_name===batch && e.period_name===period)
                              const bs = getBatchStyle(batch)
                              return (
                                <td key={batch} style={{ padding:'8px 10px', verticalAlign:'top', borderRight:`1px solid ${T.border}` }}>
                                  {cell.length ? cell.map(e=>{
                                    const hasConflict = conflicts.some(c => c.entries.some(en => en.id === e.id))
                                    return (
                                    <div key={e.id} style={{
                                      background: hasConflict ? T.redLt : bs.bg,
                                      border: hasConflict ? `2px solid ${T.red}` : `1px solid ${bs.border}`,
                                      borderRadius:6, padding:'6px 9px', marginBottom:4, fontSize:12,
                                      cursor:'pointer', transition:'transform .1s',
                                    }}
                                    onClick={() => { if(bulkMode) toggleSelect(e.id) }}
                                    title={hasConflict ? 'Conflict detected!' : ''}
                                    >
                                      <div style={{ fontWeight:700, color: hasConflict ? T.red : bs.text }}>{e.subject_name}</div>
                                      {e.teacher_name && <div style={{ color:T.muted, fontSize:11 }}>👤 {e.teacher_name}</div>}
                                      {e.section && <div style={{ color:T.muted, fontSize:11 }}>§ {e.section}</div>}
                                      {bulkMode && <input type="checkbox" checked={selectedIds.has(e.id)} readOnly style={{ marginTop:4 }} />}
                                    </div>
                                  )}) : (
                                    <span style={{ color:'#cbd5e1', fontSize:11 }}>—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      ) : viewMode === 'daily' ? (

        /* ━━ DAILY CONSOLIDATED VIEW (matches image(1).png) ━━━━━━━━━━━━━━━━━━ */
        <div>
          {dailyViewData.map(({ day, periods, dayEntries, allBatches }) => (
            <div key={day} style={{ marginBottom:32 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div style={{ width:4, height:32, background:`linear-gradient(180deg,${T.forest},${T.green})`, borderRadius:2 }} />
                <span style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:T.forest }}>{day}</span>
                <span style={{ fontSize:12, color:T.muted, background:T.surface, padding:'4px 12px', borderRadius:999 }}>{dayEntries.length} classes</span>
              </div>

              <div style={{ background: darkMode ? '#1e293b' : T.white, borderRadius:14, overflow:'hidden', border:`1px solid ${T.border}`, boxShadow:'0 2px 12px rgba(0,0,0,.06)' }}>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:T.forest }}>
                        <th style={{ padding:'12px 16px', color:'white', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', minWidth:100, textAlign:'center' }}>Time</th>
                        {allBatches.map(b => {
                          const bs = getBatchStyle(b)
                          return (
                            <th key={b} style={{ padding:'12px 10px', color:'white', fontWeight:700, fontSize:11, textTransform:'uppercase', minWidth:130, textAlign:'center' }}>
                              <span style={{ background:bs.bg, color:bs.text, padding:'4px 14px', borderRadius:999, border:`1px solid ${bs.border}` }}>{b} Batch</span>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period, pi) => {
                        const pEntries = dayEntries.filter(e => e.period_name === period)
                        const isBreak = pEntries.some(e => BREAK_TYPES.includes(e.subject_name?.toUpperCase())) || pEntries.length === 0
                        const breakType = pEntries.find(e => BREAK_TYPES.includes(e.subject_name?.toUpperCase()))?.subject_name

                        if (isBreak && breakType) {
                          return (
                            <tr key={period} style={{ background:'#fefce8', borderBottom:`2px solid ${T.border}` }}>
                              <td style={{ padding:'14px 16px', fontWeight:700, color:T.gold, fontSize:12, textAlign:'center', borderRight:`1px solid ${T.border}` }}>
                                {period}
                              </td>
                              <td colSpan={allBatches.length} style={{ padding:'14px', textAlign:'center' }}>
                                <span style={{ fontSize:14, fontWeight:800, color:T.gold, letterSpacing:'.15em', textTransform:'uppercase' }}>
                                  ☕ {breakType}
                                </span>
                              </td>
                            </tr>
                          )
                        }

                        return (
                          <tr key={period} style={{
                            background: pi%2===0 ? (darkMode?'#1e293b':T.white) : (darkMode?'#0f172a':T.surface),
                            borderBottom:`1px solid ${T.border}`
                          }}>
                            <td style={{ padding:'12px 16px', fontWeight:700, color: darkMode ? '#e2e8f0' : T.ink, fontSize:12, textAlign:'center', borderRight:`1px solid ${T.border}`, whiteSpace:'nowrap' }}>
                              {period}
                            </td>
                            {allBatches.map(batch => {
                              const cell = pEntries.filter(e => {
                                const base = e.class_name?.split(' ')[0]
                                return base === batch
                              })
                              const bs = getBatchStyle(batch)
                              return (
                                <td key={batch} style={{ padding:'10px 12px', verticalAlign:'top', borderRight:`1px solid ${T.border}`, minWidth:130 }}>
                                  {cell.length ? cell.map(e => {
                                    const hasConflict = conflicts.some(c => c.entries.some(en => en.id === e.id))
                                    return (
                                      <div key={e.id} style={{
                                        background: hasConflict ? T.redLt : bs.bg,
                                        border: hasConflict ? `2px solid ${T.red}` : `1px solid ${bs.border}`,
                                        borderRadius:8, padding:'8px 10px', fontSize:12,
                                      }}>
                                        <div style={{ fontWeight:700, color: hasConflict ? T.red : bs.text, fontSize:13, marginBottom:2 }}>
                                          {e.subject_name}
                                        </div>
                                        {e.teacher_name && (
                                          <div style={{ color:T.muted, fontSize:11 }}>👤 {e.teacher_name}</div>
                                        )}
                                        {e.section && (
                                          <div style={{ color:T.muted, fontSize:11 }}>§ {e.section}</div>
                                        )}
                                        {e.room_name && (
                                          <div style={{ color:T.muted, fontSize:11 }}>📍 {e.room_name}</div>
                                        )}
                                      </div>
                                    )
                                  }) : (
                                    <span style={{ color:'#cbd5e1', fontSize:11 }}>—</span>
                                  )}
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
          ))}
        </div>

      ) : (

        /* ━━ TEACHER WORKLOAD VIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        <div>
          <div style={{ background: darkMode ? '#1e293b' : T.white, borderRadius:14, padding:28, marginBottom:24, boxShadow:'0 2px 12px rgba(0,0,0,.06)', border:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:T.forest, marginBottom:20 }}>
              👨‍🏫 Teacher Workload Dashboard
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px,1fr))', gap:16 }}>
              {teacherWorkload.map(t => (
                <div key={t.name} style={{
                  background:T.surface, borderRadius:12, padding:18,
                  border:`1px solid ${T.border}`, transition:'transform .15s',
                  cursor:'pointer',
                }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <span style={{ fontWeight:700, fontSize:15, color:T.ink }}>{t.name}</span>
                    <span style={{ background:T.forest, color:'white', padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700 }}>
                      {t.count} classes
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:12, marginBottom:10 }}>
                    <div style={{ textAlign:'center', flex:1, padding:'8px', background:T.white, borderRadius:8 }}>
                      <div style={{ fontSize:20, fontWeight:700, color:T.green }}>{t.hours.toFixed(1)}h</div>
                      <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'.06em' }}>Weekly</div>
                    </div>
                    <div style={{ textAlign:'center', flex:1, padding:'8px', background:T.white, borderRadius:8 }}>
                      <div style={{ fontSize:20, fontWeight:700, color:T.teal }}>{t.days.length}</div>
                      <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'.06em' }}>Days</div>
                    </div>
                    <div style={{ textAlign:'center', flex:1, padding:'8px', background:T.white, borderRadius:8 }}>
                      <div style={{ fontSize:20, fontWeight:700, color:T.purple }}>{t.subjects.length}</div>
                      <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'.06em' }}>Subjects</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {t.subjects.map(s => (
                      <span key={s} style={{ fontSize:10, padding:'2px 8px', borderRadius:4, background:T.purpleLt, color:T.purple, fontWeight:600 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop:8, fontSize:11, color:T.muted }}>
                    Days: {t.days.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Teacher Schedule Detail */}
          {teacherFilter !== 'All' && (
            <div style={{ background: darkMode ? '#1e293b' : T.white, borderRadius:14, padding:28, boxShadow:'0 2px 12px rgba(0,0,0,.06)', border:`1px solid ${T.border}` }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:T.forest, marginBottom:16 }}>
                📅 {teacherFilter}'s Schedule
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px,1fr))', gap:16 }}>
                {DAYS.map(day => {
                  const dayClasses = entries.filter(e => e.teacher_name === teacherFilter && e.day_name === day)
                  if (!dayClasses.length) return null
                  return (
                    <div key={day} style={{ background:T.surface, borderRadius:10, padding:14, border:`1px solid ${T.border}` }}>
                      <div style={{ fontWeight:700, color:T.forest, fontSize:13, marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>{day}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {dayClasses.sort((a,b) => (a.period_name||'').localeCompare(b.period_name||'')).map(c => (
                          <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:T.white, borderRadius:6, fontSize:12 }}>
                            <div>
                              <span style={{ fontWeight:700, color:T.ink }}>{c.period_name}</span>
                              <span style={{ marginLeft:8, color:T.muted }}>{c.subject_name}</span>
                            </div>
                            <Badge label={c.class_name} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @media print {
          body { background: white !important; }
          button { display: none !important; }
          input, select { border: 1px solid #ccc !important; }
        }
      `}</style>
    </div>
  )
}
