// SyllabusManager.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin panel for managing syllabus_topics table
// Features:
//   • View all courses → subjects → chapters → subtopics
//   • Add new chapter (course + subject + chapter name + subtopics)
//   • Edit chapter name, subject, course
//   • Add/edit/delete individual subtopics inline
//   • Delete entire chapter
//   • Search/filter by course and subject
//   • Bulk paste subtopics (one per line)
//   • Display order management
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  card:   { background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,.07)', padding:20, marginBottom:16 },
  input:  { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, boxSizing:'border-box', background:'white', minHeight:40, fontFamily:'inherit' },
  select: { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, boxSizing:'border-box', background:'white', minHeight:40, fontFamily:'inherit' },
  label:  { display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:4, textTransform:'uppercase', letterSpacing:'.06em' },
  btn:    (color='#1e3a5f', disabled=false) => ({ backgroundColor:disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:8, padding:'9px 16px', fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontSize:13, minHeight:40, fontFamily:'inherit' }),
  btnSm:  (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:6, padding:'5px 11px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:32, fontFamily:'inherit' }),
  btnGhost: { background:'white', color:'#374151', border:'1px solid #e2e8f0', borderRadius:6, padding:'5px 11px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:32, fontFamily:'inherit' },
  badge:  (c, bg) => ({ padding:'2px 8px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color:c, display:'inline-block' }),
  tag:    (active) => ({ padding:'5px 12px', borderRadius:999, fontSize:12, fontWeight:600, cursor:'pointer', border:'none', fontFamily:'inherit', background:active?'#1e3a5f':'#f1f5f9', color:active?'white':'#374151', transition:'all .12s' }),
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
  * { box-sizing:border-box }
  .sm-root { font-family:'Outfit',system-ui,sans-serif; background:#f1f5f9; min-height:100vh; padding:20px }
  select,input,textarea { font-family:'Outfit',system-ui,sans-serif }
  select:focus,input:focus,textarea:focus { outline:2px solid #1e3a5f; outline-offset:1px }
  ::-webkit-scrollbar { width:4px; height:4px }
  ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px }
  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .sm-fade { animation:fadeIn .2s ease both }
  @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
`

const COURSES  = ['Navodaya','Sainik','Foundation']
const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II',
  'Mental Ability','Reasoning','General Knowledge',
  'English Grammar','Hindi','General Science',
  'Vocabulary','Meitei Mayek','Other',
]

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, color, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [])
  return (
    <div style={{
      position:'fixed', bottom:22, left:'50%', transform:'translateX(-50%)',
      zIndex:999999, background:'white', border:`1px solid ${color}`,
      borderLeft:`4px solid ${color}`, borderRadius:10, padding:'11px 18px',
      fontSize:13, fontWeight:600, boxShadow:'0 8px 28px rgba(0,0,0,.15)',
      maxWidth:'90vw', color:'#1e293b', display:'flex', alignItems:'center', gap:9,
      animation:'slideUp .2s ease',
    }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
      {msg}
    </div>
  )
}

function useToast() {
  const [t, setT] = useState(null)
  const show = useCallback((msg, color='#1e3a5f') => setT({ msg, color, k:Date.now() }), [])
  const el = t ? <Toast key={t.k} msg={t.msg} color={t.color} onDone={() => setT(null)}/> : null
  return { show, el }
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────

function ConfirmModal({ title, msg, onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onCancel}>
      <div style={{ background:'white', borderRadius:12, padding:24, width:360, maxWidth:'94vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:20, lineHeight:1.7 }}>{msg}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onConfirm} style={S.btn('#dc2626')}>Delete</button>
          <button onClick={onCancel} style={S.btnGhost}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Subtopic Tag Editor ───────────────────────────────────────────────────

function SubtopicEditor({ subtopics, onChange }) {
  const [newTag, setNewTag]       = useState('')
  const [editIdx, setEditIdx]     = useState(null)
  const [editVal, setEditVal]     = useState('')
  const [bulkMode, setBulkMode]   = useState(false)
  const [bulkText, setBulkText]   = useState('')

  const add = () => {
    const v = newTag.trim()
    if (!v || subtopics.includes(v)) return
    onChange([...subtopics, v])
    setNewTag('')
  }

  const remove = i => onChange(subtopics.filter((_, j) => j !== i))

  const startEdit = (i) => { setEditIdx(i); setEditVal(subtopics[i]) }
  const saveEdit  = () => {
    const v = editVal.trim()
    if (!v) return
    const updated = [...subtopics]
    updated[editIdx] = v
    onChange(updated)
    setEditIdx(null)
  }

  const moveUp   = i => { if (i === 0) return; const a = [...subtopics]; [a[i-1],a[i]]=[a[i],a[i-1]]; onChange(a) }
  const moveDown = i => { if (i === subtopics.length-1) return; const a = [...subtopics]; [a[i],a[i+1]]=[a[i+1],a[i]]; onChange(a) }

  const applyBulk = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return
    const merged = [...subtopics, ...lines.filter(l => !subtopics.includes(l))]
    onChange(merged)
    setBulkMode(false)
    setBulkText('')
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'.06em' }}>
          Subtopics ({subtopics.length})
        </span>
        <button type="button" onClick={() => setBulkMode(!bulkMode)} style={{ ...S.btnSm('#7c3aed'), fontSize:11, padding:'3px 9px' }}>
          {bulkMode ? '✖ Close Bulk' : '📋 Bulk Paste'}
        </button>
      </div>

      {bulkMode && (
        <div style={{ marginBottom:10, padding:12, background:'#f8f4ff', borderRadius:8, border:'1px solid #ddd6fe' }}>
          <label style={{ ...S.label, color:'#7c3aed' }}>Paste subtopics — one per line</label>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={5}
            style={{ ...S.input, fontFamily:"'Courier New',monospace", fontSize:12, resize:'vertical', marginBottom:8 }}
            placeholder={'Addition of fractions\nSubtraction of fractions\nMultiplication of fractions\nWord problems'}
            autoFocus
          />
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={applyBulk} style={S.btn('#7c3aed')}>✅ Add All</button>
            <button type="button" onClick={() => { setBulkMode(false); setBulkText('') }} style={S.btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Existing subtopics list */}
      <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:8 }}>
        {subtopics.map((s, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', background:'#f8fafc', borderRadius:6, border:'1px solid #e2e8f0' }}>
            {editIdx === i
              ? <>
                  <input value={editVal} onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') saveEdit(); if (e.key==='Escape') setEditIdx(null) }}
                    style={{ ...S.input, flex:1, fontSize:12, padding:'4px 8px', minHeight:30 }} autoFocus/>
                  <button type="button" onClick={saveEdit} style={{ ...S.btnSm('#16a34a'), padding:'3px 8px' }}>✓</button>
                  <button type="button" onClick={() => setEditIdx(null)} style={{ ...S.btnSm('#94a3b8'), padding:'3px 8px' }}>✖</button>
                </>
              : <>
                  <span style={{ fontSize:11, color:'#94a3b8', minWidth:20, textAlign:'right' }}>{i+1}.</span>
                  <span style={{ flex:1, fontSize:13, color:'#374151' }}>{s}</span>
                  <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                    <button type="button" onClick={() => moveUp(i)}   style={{ ...S.btnSm('#e2e8f0'), color:'#374151', padding:'2px 6px', fontSize:11 }}>↑</button>
                    <button type="button" onClick={() => moveDown(i)} style={{ ...S.btnSm('#e2e8f0'), color:'#374151', padding:'2px 6px', fontSize:11 }}>↓</button>
                    <button type="button" onClick={() => startEdit(i)} style={{ ...S.btnSm('#7c3aed'), padding:'2px 6px', fontSize:11 }}>✏️</button>
                    <button type="button" onClick={() => remove(i)}    style={{ ...S.btnSm('#dc2626'), padding:'2px 6px', fontSize:11 }}>✕</button>
                  </div>
                </>
            }
          </div>
        ))}
        {subtopics.length === 0 && (
          <div style={{ fontSize:12, color:'#94a3b8', padding:'8px 0', textAlign:'center' }}>No subtopics yet — add below</div>
        )}
      </div>

      {/* Add single subtopic */}
      <div style={{ display:'flex', gap:6 }}>
        <input
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Type subtopic and press Enter..."
          style={{ ...S.input, flex:1, fontSize:12 }}
        />
        <button type="button" onClick={add} style={S.btn('#16a34a')}>+ Add</button>
      </div>
    </div>
  )
}

// ─── Chapter Row (view + inline edit) ────────────────────────────────────────

function ChapterRow({ row, onSaved, onDeleted, showToast }) {
  const [editing, setEditing]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [form,    setForm]      = useState({
    course:        row.course || '',
    subject_name:  row.subject_name,
    chapter_name:  row.chapter_name,
    display_order: row.display_order || 0,
    subtopics:     row.subtopics || [],
  })
  const [open, setOpen] = useState(false)

  const handleSave = async () => {
    if (!form.chapter_name.trim() || !form.subject_name || !form.course) {
      showToast('Course, Subject and Chapter name are required', '#dc2626'); return
    }
    setSaving(true)
    const { error } = await supabase.from('syllabus_topics').update({
      course:        form.course,
      subject_name:  form.subject_name,
      chapter_name:  form.chapter_name.trim(),
      display_order: Number(form.display_order) || 0,
      subtopics:     form.subtopics,
    }).eq('id', row.id)
    if (error) showToast('Save failed: ' + error.message, '#dc2626')
    else { showToast('Chapter updated ✓', '#16a34a'); setEditing(false); onSaved() }
    setSaving(false)
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('syllabus_topics').delete().eq('id', row.id)
    if (error) showToast('Delete failed: ' + error.message, '#dc2626')
    else { showToast('Chapter deleted', '#dc2626'); onDeleted() }
    setConfirm(false)
  }

  return (
    <>
      {confirm && (
        <ConfirmModal
          title="Delete Chapter"
          msg={`Delete "${row.chapter_name}" and all its ${row.subtopics?.length||0} subtopics? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
      <div className="sm-fade" style={{ border:'1px solid #e2e8f0', borderRadius:10, marginBottom:8, overflow:'hidden' }}>
        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background: editing?'#f8f4ff':'white', cursor:'pointer' }}
          onClick={() => !editing && setOpen(o => !o)}>
          <span style={{ fontSize:13, color:'#94a3b8', minWidth:28, fontWeight:700 }}>{row.display_order||'—'}</span>
          <div style={{ flex:1 }}>
            <span style={{ fontWeight:700, color:'#1e293b', fontSize:14 }}>{row.chapter_name}</span>
            <span style={{ marginLeft:8, fontSize:11, color:'#94a3b8' }}>
              {row.subtopics?.length || 0} subtopics
            </span>
          </div>
          <span style={S.badge('#1e3a5f','#eff6ff')}>{row.course}</span>
          <span style={S.badge('#7c3aed','#f3e8ff')}>{row.subject_name}</span>
          <div style={{ display:'flex', gap:5 }} onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setEditing(!editing)} style={{ ...S.btnSm(editing?'#64748b':'#7c3aed'), padding:'4px 10px' }}>
              {editing ? '✖' : '✏️ Edit'}
            </button>
            <button type="button" onClick={() => setConfirm(true)} style={{ ...S.btnSm('#dc2626'), padding:'4px 10px' }}>🗑</button>
          </div>
          {!editing && <span style={{ fontSize:14, color:'#94a3b8' }}>{open?'▲':'▼'}</span>}
        </div>

        {/* View mode — subtopics list */}
        {open && !editing && row.subtopics?.length > 0 && (
          <div style={{ padding:'8px 14px 12px 42px', borderTop:'1px solid #f1f5f9', background:'#fafafa' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {row.subtopics.map((s, i) => (
                <span key={i} style={{ padding:'3px 10px', borderRadius:999, fontSize:12, background:'#f1f5f9', color:'#374151', border:'1px solid #e2e8f0' }}>
                  {i+1}. {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div style={{ padding:16, borderTop:'1px solid #ddd6fe', background:'#f8f4ff' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:14 }}>
              <div>
                <label style={S.label}>Course *</label>
                <select value={form.course} onChange={e => setForm(f=>({...f,course:e.target.value}))} style={S.select}>
                  <option value="">Select Course</option>
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Subject *</label>
                <select value={form.subject_name} onChange={e => setForm(f=>({...f,subject_name:e.target.value}))} style={S.select}>
                  <option value="">Select Subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Chapter Name *</label>
                <input value={form.chapter_name} onChange={e => setForm(f=>({...f,chapter_name:e.target.value}))} style={S.input} placeholder="Chapter name"/>
              </div>
              <div>
                <label style={S.label}>Display Order</label>
                <input type="number" value={form.display_order} onChange={e => setForm(f=>({...f,display_order:e.target.value}))} style={S.input} placeholder="1"/>
              </div>
            </div>
            <SubtopicEditor subtopics={form.subtopics} onChange={subs => setForm(f=>({...f,subtopics:subs}))}/>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button type="button" onClick={handleSave} disabled={saving} style={S.btn('#7c3aed', saving)}>
                {saving ? '⏳ Saving...' : '✅ Save Changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} style={S.btnGhost}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Add Chapter Form ─────────────────────────────────────────────────────────

function AddChapterForm({ onSaved, showToast, defaultCourse='' }) {
  const blank = { course:defaultCourse, subject_name:'', chapter_name:'', display_order:'', subtopics:[] }
  const [form,    setForm]    = useState(blank)
  const [saving,  setSaving]  = useState(false)
  const [open,    setOpen]    = useState(false)

  const handleSave = async e => {
    e.preventDefault()
    if (!form.chapter_name.trim() || !form.subject_name || !form.course) {
      showToast('Course, Subject and Chapter name are required', '#dc2626'); return
    }
    setSaving(true)
    const { error } = await supabase.from('syllabus_topics').insert([{
      course:        form.course,
      subject_name:  form.subject_name,
      chapter_name:  form.chapter_name.trim(),
      display_order: Number(form.display_order) || 0,
      subtopics:     form.subtopics,
    }])
    if (error) showToast('Save failed: ' + error.message, '#dc2626')
    else {
      showToast('Chapter added ✓', '#16a34a')
      setForm(blank)
      setOpen(false)
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div style={{ ...S.card, border:'2px dashed #1e3a5f20', background: open?'white':'#f8fafc' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ fontSize:14, fontWeight:800, color:'#1e3a5f', margin:0 }}>➕ Add New Chapter</h3>
        <button type="button" onClick={() => setOpen(!open)} style={S.btn(open?'#64748b':'#1e3a5f')}>
          {open ? '✖ Cancel' : '➕ Add Chapter'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSave} className="sm-fade">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginTop:16, marginBottom:16 }}>
            <div>
              <label style={S.label}>Course *</label>
              <select value={form.course} onChange={e => setForm(f=>({...f,course:e.target.value}))} required style={S.select}>
                <option value="">Select Course</option>
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Subject *</label>
              <select value={form.subject_name} onChange={e => setForm(f=>({...f,subject_name:e.target.value}))} required style={S.select}>
                <option value="">Select Subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Chapter Name *</label>
              <input value={form.chapter_name} onChange={e => setForm(f=>({...f,chapter_name:e.target.value}))} required placeholder="e.g. Fractions and Decimals" style={S.input}/>
            </div>
            <div>
              <label style={S.label}>Display Order</label>
              <input type="number" value={form.display_order} onChange={e => setForm(f=>({...f,display_order:e.target.value}))} placeholder="e.g. 5" style={S.input}/>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>Controls chapter sort order</div>
            </div>
          </div>

          <SubtopicEditor subtopics={form.subtopics} onChange={subs => setForm(f=>({...f,subtopics:subs}))}/>

          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <button type="submit" disabled={saving} style={S.btn('#1e3a5f', saving)}>
              {saving ? '⏳ Saving...' : '✅ Save Chapter'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setForm(blank) }} style={S.btnGhost}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ rows }) {
  const stats = useMemo(() => {
    const courses  = new Set(rows.map(r => r.course).filter(Boolean)).size
    const subjects = new Set(rows.map(r => r.subject_name).filter(Boolean)).size
    const chapters = rows.length
    const subtopics = rows.reduce((a, r) => a + (r.subtopics?.length || 0), 0)
    return { courses, subjects, chapters, subtopics }
  }, [rows])

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
      {[
        { label:'Courses',   value:stats.courses,   color:'#1e3a5f', bg:'#eff6ff', icon:'🏫' },
        { label:'Subjects',  value:stats.subjects,  color:'#7c3aed', bg:'#f3e8ff', icon:'📚' },
        { label:'Chapters',  value:stats.chapters,  color:'#0891b2', bg:'#e0f2fe', icon:'📖' },
        { label:'Subtopics', value:stats.subtopics, color:'#16a34a', bg:'#dcfce7', icon:'📌' },
      ].map(c => (
        <div key={c.label} style={{ background:c.bg, borderRadius:10, padding:14, borderLeft:`4px solid ${c.color}` }}>
          <div style={{ fontSize:18, marginBottom:3 }}>{c.icon}</div>
          <div style={{ fontSize:11, color:c.color, fontWeight:700 }}>{c.label}</div>
          <div style={{ fontSize:22, fontWeight:800, color:c.color, fontFamily:"'Courier New',monospace" }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main SyllabusManager ────────────────────────────────────────────────────

function SyllabusManager() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterCourse,  setFilterCourse]  = useState('All')
  const [filterSubject, setFilterSubject] = useState('All')
  const { show: showToast, el: toastEl }  = useToast()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('syllabus_topics')
      .select('*')
      .order('course')
      .order('subject_name')
      .order('display_order')
      .order('chapter_name')
    if (error) showToast('Load failed: ' + error.message, '#dc2626')
    if (data) setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const allSubjects = useMemo(() => {
    const set = new Set(rows.map(r => r.subject_name).filter(Boolean))
    return [...set].sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      const mc = filterCourse  === 'All' || r.course       === filterCourse
      const ms = filterSubject === 'All' || r.subject_name === filterSubject
      const mq = !q || r.chapter_name?.toLowerCase().includes(q)
               || r.subject_name?.toLowerCase().includes(q)
               || r.subtopics?.some(s => s.toLowerCase().includes(q))
      return mc && ms && mq
    })
  }, [rows, search, filterCourse, filterSubject])

  // Group by course → subject for display
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const key = `${r.course}||${r.subject_name}`
      if (!map[key]) map[key] = { course:r.course, subject:r.subject_name, chapters:[] }
      map[key].chapters.push(r)
    })
    return Object.values(map).sort((a,b) => a.course.localeCompare(b.course) || a.subject.localeCompare(b.subject))
  }, [filtered])

  const courseColors = { Navodaya:'#1e3a5f', Sainik:'#16a34a', Foundation:'#7c3aed' }
  const courseBg     = { Navodaya:'#eff6ff', Sainik:'#dcfce7', Foundation:'#f3e8ff' }

  return (
    <div className="sm-root">
      <style>{css}</style>
      {toastEl}

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:24, fontWeight:800, color:'#1e3a5f', margin:0, letterSpacing:'-.02em' }}>
          📚 Syllabus Manager
        </h1>
        <p style={{ color:'#64748b', fontSize:13, margin:'4px 0 0' }}>
          Add · Edit · Delete chapters and subtopics for Navodaya, Sainik, Foundation
        </p>
      </div>

      <StatsBar rows={rows}/>

      {/* Add Chapter Form */}
      <AddChapterForm onSaved={fetchAll} showToast={showToast}/>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, alignItems:'center' }}>
        <input
          placeholder="🔍 Search chapters or subtopics..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...S.input, flex:'1 1 200px', minWidth:160 }}
        />
        <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterSubject('All') }} style={{ ...S.select, width:'auto', flex:'0 1 140px' }}>
          <option value="All">All Courses</option>
          {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 160px' }}>
          <option value="All">All Subjects</option>
          {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || filterCourse !== 'All' || filterSubject !== 'All') && (
          <button onClick={() => { setSearch(''); setFilterCourse('All'); setFilterSubject('All') }} style={S.btnSm('#dc2626')}>✕ Clear</button>
        )}
        <button onClick={fetchAll} style={S.btnSm('#64748b')}>🔄 Refresh</button>
      </div>

      <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>
        Showing {filtered.length} of {rows.length} chapters
        {search && <span style={{ marginLeft:8, color:'#7c3aed', fontWeight:700 }}>matching "{search}"</span>}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading syllabus...</div>
      )}

      {/* Grouped chapters */}
      {!loading && grouped.length === 0 && (
        <div style={{ ...S.card, textAlign:'center', padding:48, color:'#94a3b8' }}>
          {rows.length === 0
            ? 'No chapters yet. Add your first chapter above.'
            : 'No chapters match your filters.'}
        </div>
      )}

      {!loading && grouped.map(group => (
        <div key={`${group.course}||${group.subject}`} style={{ marginBottom:20 }}>
          {/* Group header */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ ...S.badge(courseColors[group.course]||'#1e3a5f', courseBg[group.course]||'#eff6ff'), fontSize:12, padding:'4px 12px' }}>
              {group.course}
            </span>
            <h3 style={{ fontSize:15, fontWeight:800, color:'#1e293b', margin:0 }}>{group.subject}</h3>
            <span style={{ fontSize:12, color:'#94a3b8' }}>{group.chapters.length} chapter{group.chapters.length!==1?'s':''}</span>
            <div style={{ flex:1, height:1, background:'#e2e8f0' }}/>
          </div>

          {/* Chapter rows */}
          {group.chapters.map(row => (
            <ChapterRow
              key={row.id}
              row={row}
              onSaved={fetchAll}
              onDeleted={fetchAll}
              showToast={showToast}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default SyllabusManager