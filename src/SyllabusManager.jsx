// SyllabusManager.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin panel for the chapter catalogue in syllabus_topics
// Features:
//   • View all courses → subjects → chapters → subtopics
//   • Add new chapter (course + subject + chapter name + subtopics)
//   • Edit chapter name, subject, course
//   • Add/edit/delete individual subtopics inline
//   • Delete entire chapter
//   • Search/filter by course and subject
//   • Bulk paste subtopics (one per line)
//   • Display order management
//   • "🎯 Hub" per chapter → Teaching's Chapter Hub for that chapter
//
// Course / subject / chapter names come from qbankTaxonomy.js — the shared
// list the Teaching hub, Question Bank and Study Material link on — so a
// chapter here lines up with its questions and materials. Custom subjects and
// chapters are still allowed.
//
// syllabus_topics is shared with Teaching's Syllabus tab (TabSyllabus.jsx),
// which stores per-batch progress rows there (syllabus_id / order_num). Those
// are not catalogue chapters and are skipped here.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import { COURSES as TAXONOMY, COURSE_LIST } from './qbankTaxonomy'
import { openChapterIn } from './StudyMaterialBridge'
import { PremiumStyles, PremiumHero, PIcon, PX } from './premiumUI'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  card:   { background:'#fff', borderRadius:18, border:`1px solid ${PX.line}`, boxShadow:'0 1px 2px rgba(19,42,79,.05), 0 12px 32px -22px rgba(19,42,79,.35)', padding:20, marginBottom:16 },
  input:  { width:'100%', padding:'10px 13px', borderRadius:11, border:`1px solid ${PX.line}`, fontSize:13.5, boxSizing:'border-box', background:'#fff', color:PX.ink, minHeight:42, fontFamily:'inherit' },
  select: { width:'100%', padding:'10px 13px', borderRadius:11, border:`1px solid ${PX.line}`, fontSize:13.5, boxSizing:'border-box', background:'#fff', color:PX.ink, minHeight:42, fontFamily:'inherit' },
  label:  { display:'block', fontSize:10.5, fontWeight:700, color:PX.sub, marginBottom:6, textTransform:'uppercase', letterSpacing:'.08em' },
  btn:    (color=PX.navy, disabled=false) => ({ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, background: disabled ? PX.line2 : color===PX.navy ? `linear-gradient(180deg,${PX.navy2},${PX.navy})` : color, color:'#fff', border:'none', borderRadius:11, padding:'10px 16px', fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontSize:13, minHeight:42, fontFamily:'inherit', whiteSpace:'nowrap', boxShadow: disabled ? 'none' : '0 6px 14px -8px rgba(19,42,79,.6)' }),
  btnSm:  (color=PX.navy) => ({ display:'inline-flex', alignItems:'center', gap:5, backgroundColor:color, color:'#fff', border:'none', borderRadius:8, padding:'5px 11px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:32, fontFamily:'inherit', whiteSpace:'nowrap' }),
  btnGhost: { display:'inline-flex', alignItems:'center', gap:5, background:'#fff', color:PX.ink2, border:`1px solid ${PX.line2}`, borderRadius:8, padding:'5px 11px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:32, fontFamily:'inherit', whiteSpace:'nowrap' },
  badge:  (c, bg) => ({ padding:'3px 9px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color:c, display:'inline-block', whiteSpace:'nowrap' }),
}

const css = `
  .sm-scope ::-webkit-scrollbar { width:6px; height:6px }
  .sm-scope ::-webkit-scrollbar-thumb { background:${PX.line2}; border-radius:99px }
  @keyframes smFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .sm-fade { animation:smFadeIn .2s ease both }
  @keyframes smToastIn { from{transform:translate(-50%,16px);opacity:0} to{transform:translate(-50%,0);opacity:1} }
  .sm-row { transition: box-shadow .15s, border-color .15s }
  .sm-row:hover { border-color:${PX.line2} !important; box-shadow:0 8px 20px -16px rgba(19,42,79,.45) }
  @media (max-width:640px) { .sm-stats { grid-template-columns: repeat(2,1fr) !important } }
`

// ── Course keys ───────────────────────────────────────────────────────────────
// Stored as the taxonomy keys (sainik / navodaya / foundation / rms). Older
// rows saved 'Navodaya' / 'Sainik' / 'Foundation'; they're read as the same
// course and rewritten with the key when edited.
const courseKey   = c => String(c || '').trim().toLowerCase()
const courseLabel = c => TAXONOMY[courseKey(c)]?.label || c || '—'
const COURSE_TONE = {
  sainik:     { c:'#15803d', bg:'#e8f5ee' },
  navodaya:   { c:PX.navy2,  bg:'#e4ebf6' },
  foundation: { c:'#9a5b00', bg:'#fff5e0' },
  rms:        { c:'#9f1239', bg:'#fdecea' },
}
const tone = c => COURSE_TONE[courseKey(c)] || { c:PX.navy, bg:'#eef2f9' }

// Subjects for a course: the taxonomy's, plus any already used in the data.
const subjectsFor = (course, rows) => {
  const k = courseKey(course)
  const base = Object.keys(TAXONOMY[k]?.subjects || {})
  const used = rows.filter(r => courseKey(r.course) === k).map(r => r.subject_name).filter(Boolean)
  return [...new Set([...base, ...used])]
}
const chaptersFor = (course, subject) => TAXONOMY[courseKey(course)]?.subjects?.[subject] || []

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, color, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="status" aria-live="polite" style={{
      position:'fixed', bottom:22, left:'50%', transform:'translateX(-50%)',
      zIndex:999999, background:'#fff', border:`1px solid ${PX.line}`, borderRadius:14,
      padding:'12px 18px 12px 14px', fontSize:13.5, fontWeight:600, fontFamily:PX.sans,
      boxShadow:'0 18px 40px -18px rgba(19,42,79,.45)', maxWidth:'92vw', color:PX.ink,
      display:'flex', alignItems:'center', gap:10, animation:'smToastIn .2s ease',
    }}>
      <span style={{ width:9, height:9, borderRadius:'50%', background:color, flexShrink:0, boxShadow:`0 0 0 4px ${color}22` }}/>
      {msg}
    </div>
  )
}

function useToast() {
  const [t, setT] = useState(null)
  const show = useCallback((msg, color=PX.navy) => setT({ msg, color, k:Date.now() }), [])
  const el = t ? <Toast key={t.k} msg={t.msg} color={t.color} onDone={() => setT(null)}/> : null
  return { show, el }
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────

function ConfirmModal({ title, msg, onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(14,32,63,.55)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{ background:'#fff', borderRadius:18, padding:24, width:380, maxWidth:'94vw', border:`1px solid ${PX.line}`, boxShadow:'0 30px 60px -20px rgba(19,42,79,.5)', fontFamily:PX.sans }} onClick={e => e.stopPropagation()}>
        <div style={{ width:40, height:40, borderRadius:12, marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', background:PX.badBg, color:PX.bad }}>
          <PIcon.alert size={20}/>
        </div>
        <div style={{ fontFamily:PX.serif, fontSize:19, fontWeight:600, color:PX.ink, marginBottom:6 }}>{title}</div>
        <p style={{ fontSize:13.5, color:PX.sub, marginBottom:20, lineHeight:1.65 }}>{msg}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onConfirm} style={{ ...S.btn(PX.bad), flex:1 }}>Delete</button>
          <button onClick={onCancel} style={{ ...S.btnGhost, minHeight:42, padding:'10px 16px' }}>Cancel</button>
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

  const iconBtn = { ...S.btnGhost, padding:'2px 8px', minHeight:28, fontSize:11 }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ ...S.label, marginBottom:0 }}>Subtopics ({subtopics.length})</span>
        <button type="button" onClick={() => setBulkMode(!bulkMode)} style={S.btnGhost}>
          {bulkMode ? '✖ Close bulk paste' : <><PIcon.list size={13}/> Bulk paste</>}
        </button>
      </div>

      {bulkMode && (
        <div style={{ marginBottom:10, padding:12, background:PX.goldBg, borderRadius:12, border:`1px solid ${PX.goldLine}` }}>
          <label style={S.label}>Paste subtopics — one per line</label>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={5}
            style={{ ...S.input, fontSize:12.5, resize:'vertical', marginBottom:8 }}
            placeholder={'Addition of fractions\nSubtraction of fractions\nMultiplication of fractions\nWord problems'}
            autoFocus
          />
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={applyBulk} style={S.btn()}>Add all</button>
            <button type="button" onClick={() => { setBulkMode(false); setBulkText('') }} style={{ ...S.btnGhost, minHeight:42, padding:'10px 16px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Existing subtopics list */}
      <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:8 }}>
        {subtopics.map((s, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', background:PX.tint, borderRadius:9, border:`1px solid ${PX.line}` }}>
            {editIdx === i
              ? <>
                  <input value={editVal} onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') saveEdit(); if (e.key==='Escape') setEditIdx(null) }}
                    style={{ ...S.input, flex:1, fontSize:12.5, padding:'5px 9px', minHeight:32 }} autoFocus/>
                  <button type="button" onClick={saveEdit} style={{ ...S.btnSm(PX.ok), padding:'3px 9px' }} aria-label="Save subtopic">✓</button>
                  <button type="button" onClick={() => setEditIdx(null)} style={iconBtn} aria-label="Cancel">✖</button>
                </>
              : <>
                  <span style={{ fontSize:11, color:PX.faint, minWidth:20, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{i+1}.</span>
                  <span style={{ flex:1, fontSize:13, color:PX.ink2 }}>{s}</span>
                  <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                    <button type="button" onClick={() => moveUp(i)}   style={iconBtn} aria-label="Move up">↑</button>
                    <button type="button" onClick={() => moveDown(i)} style={iconBtn} aria-label="Move down">↓</button>
                    <button type="button" onClick={() => startEdit(i)} style={iconBtn} aria-label="Edit"><PIcon.pen size={12}/></button>
                    <button type="button" onClick={() => remove(i)}    style={{ ...iconBtn, color:PX.bad }} aria-label="Remove">✕</button>
                  </div>
                </>
            }
          </div>
        ))}
        {subtopics.length === 0 && (
          <div style={{ fontSize:12.5, color:PX.faint, padding:'8px 0', textAlign:'center' }}>No subtopics yet — add below</div>
        )}
      </div>

      {/* Add single subtopic */}
      <div style={{ display:'flex', gap:6 }}>
        <input
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Type a subtopic and press Enter…"
          style={{ ...S.input, flex:1, fontSize:12.5 }}
        />
        <button type="button" onClick={add} style={S.btn()}><PIcon.plus size={14}/> Add</button>
      </div>
    </div>
  )
}

// ─── Course / subject / chapter fields (shared by add + edit) ─────────────────

function ChapterFields({ form, setForm, rows }) {
  const subjects = subjectsFor(form.course, rows)
  const chapterSuggestions = chaptersFor(form.course, form.subject_name)
  const listId = `sm-ch-${form.course}-${form.subject_name}`.replace(/[^a-z0-9-]/gi, '_')
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12, marginBottom:14 }}>
      <div>
        <label style={S.label}>Course *</label>
        <select value={courseKey(form.course)} onChange={e => setForm(f => ({ ...f, course:e.target.value, subject_name:'' }))} style={S.select}>
          <option value="">Select course</option>
          {COURSE_LIST.map(c => <option key={c} value={c}>{TAXONOMY[c].label}</option>)}
        </select>
      </div>
      <div>
        <label style={S.label}>Subject *</label>
        <input list={`sm-subj-${courseKey(form.course)}`} value={form.subject_name}
          onChange={e => setForm(f => ({ ...f, subject_name:e.target.value }))}
          disabled={!form.course} placeholder={form.course ? 'Pick or type a subject' : 'Pick a course first'} style={S.input}/>
        <datalist id={`sm-subj-${courseKey(form.course)}`}>
          {subjects.map(s => <option key={s} value={s}/>)}
        </datalist>
      </div>
      <div>
        <label style={S.label}>Chapter name *</label>
        <input list={listId} value={form.chapter_name} onChange={e => setForm(f => ({ ...f, chapter_name:e.target.value }))}
          placeholder={chapterSuggestions.length ? 'Pick from the course list or type' : 'e.g. Fractions and Decimals'} style={S.input}/>
        <datalist id={listId}>
          {chapterSuggestions.map(c => <option key={c} value={c}/>)}
        </datalist>
      </div>
      <div>
        <label style={S.label}>Display order</label>
        <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order:e.target.value }))} placeholder="e.g. 5" style={S.input}/>
      </div>
    </div>
  )
}

// ─── Chapter Row (view + inline edit) ────────────────────────────────────────

function ChapterRow({ row, rows, onSaved, onDeleted, showToast, onNavigate }) {
  const [editing, setEditing]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [form,    setForm]      = useState({
    course:        courseKey(row.course),
    subject_name:  row.subject_name || '',
    chapter_name:  row.chapter_name || '',
    display_order: row.display_order || 0,
    subtopics:     row.subtopics || [],
  })
  const [open, setOpen] = useState(false)

  const handleSave = async () => {
    if (!form.chapter_name.trim() || !form.subject_name.trim() || !form.course) {
      showToast('Course, subject and chapter name are required', PX.bad); return
    }
    setSaving(true)
    const { error } = await supabase.from('syllabus_topics').update({
      course:        courseKey(form.course),
      subject_name:  form.subject_name.trim(),
      chapter_name:  form.chapter_name.trim(),
      display_order: Number(form.display_order) || 0,
      subtopics:     form.subtopics,
    }).eq('id', row.id)
    if (error) showToast('Save failed: ' + error.message, PX.bad)
    else { showToast('Chapter updated ✓', PX.ok); setEditing(false); onSaved() }
    setSaving(false)
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('syllabus_topics').delete().eq('id', row.id)
    if (error) showToast('Delete failed: ' + error.message, PX.bad)
    else { showToast('Chapter deleted', PX.bad); onDeleted() }
    setConfirm(false)
  }

  const t = tone(row.course)
  return (
    <>
      {confirm && (
        <ConfirmModal
          title="Delete chapter"
          msg={`Delete "${row.chapter_name}" and all its ${row.subtopics?.length||0} subtopics? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
      <div className="sm-fade sm-row" style={{ border:`1px solid ${editing ? PX.gold : PX.line}`, borderRadius:14, marginBottom:8, overflow:'hidden', background:'#fff' }}>
        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', background: editing ? PX.goldBg : '#fff', cursor: editing ? 'default' : 'pointer', flexWrap:'wrap' }}
          onClick={() => !editing && setOpen(o => !o)}>
          <span style={{ fontSize:12, color:PX.faint, minWidth:24, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{row.display_order||'—'}</span>
          <div style={{ flex:'1 1 200px', minWidth:0 }}>
            <span style={{ fontWeight:700, color:PX.ink, fontSize:14 }}>{row.chapter_name}</span>
            <span style={{ marginLeft:8, fontSize:11.5, color:PX.faint }}>
              {row.subtopics?.length || 0} subtopic{(row.subtopics?.length || 0) === 1 ? '' : 's'}
            </span>
          </div>
          <span style={S.badge(t.c, t.bg)}>{courseLabel(row.course)}</span>
          <span style={S.badge(PX.gold, PX.goldBg)}>{row.subject_name}</span>
          <div style={{ display:'flex', gap:5 }} onClick={e => e.stopPropagation()}>
            <button type="button" title="Open this chapter in the Teaching hub"
              onClick={() => openChapterIn('hub', { course: courseKey(row.course), subject: row.subject_name, chapter: row.chapter_name }, onNavigate)}
              style={S.btnGhost}>🎯 Hub</button>
            <button type="button" onClick={() => setEditing(!editing)} style={S.btnGhost}>
              {editing ? '✖ Close' : <><PIcon.pen size={12}/> Edit</>}
            </button>
            <button type="button" onClick={() => setConfirm(true)} style={{ ...S.btnGhost, color:PX.bad }} aria-label={`Delete ${row.chapter_name}`}>🗑</button>
          </div>
          {!editing && <span style={{ fontSize:12, color:PX.faint }}>{open?'▲':'▼'}</span>}
        </div>

        {/* View mode — subtopics list */}
        {open && !editing && (
          <div style={{ padding:'10px 14px 14px 48px', borderTop:`1px solid ${PX.line}`, background:PX.tint }}>
            {row.subtopics?.length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {row.subtopics.map((s, i) => (
                  <span key={i} style={{ padding:'4px 11px', borderRadius:999, fontSize:12, background:'#fff', color:PX.ink2, border:`1px solid ${PX.line}` }}>
                    {i+1}. {s}
                  </span>
                ))}
              </div>
            ) : <span style={{ fontSize:12.5, color:PX.faint }}>No subtopics yet — use Edit to add some.</span>}
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div style={{ padding:16, borderTop:`1px solid ${PX.goldLine}`, background:'#fffdf8' }}>
            <ChapterFields form={form} setForm={setForm} rows={rows}/>
            <SubtopicEditor subtopics={form.subtopics} onChange={subs => setForm(f=>({...f,subtopics:subs}))}/>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button type="button" onClick={handleSave} disabled={saving} style={S.btn(PX.navy, saving)}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} style={{ ...S.btnGhost, minHeight:42, padding:'10px 16px' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Add Chapter Form ─────────────────────────────────────────────────────────

function AddChapterForm({ onSaved, showToast, rows, defaultCourse='' }) {
  const blank = { course:defaultCourse, subject_name:'', chapter_name:'', display_order:'', subtopics:[] }
  const [form,    setForm]    = useState(blank)
  const [saving,  setSaving]  = useState(false)
  const [open,    setOpen]    = useState(false)

  const handleSave = async e => {
    e.preventDefault()
    if (!form.chapter_name.trim() || !form.subject_name.trim() || !form.course) {
      showToast('Course, subject and chapter name are required', PX.bad); return
    }
    const dupe = rows.some(r => courseKey(r.course) === courseKey(form.course) && r.subject_name === form.subject_name.trim()
      && (r.chapter_name || '').toLowerCase() === form.chapter_name.trim().toLowerCase())
    if (dupe) { showToast('That chapter already exists for this course and subject', PX.warn); return }
    setSaving(true)
    const { error } = await supabase.from('syllabus_topics').insert([{
      course:        courseKey(form.course),
      subject_name:  form.subject_name.trim(),
      chapter_name:  form.chapter_name.trim(),
      display_order: Number(form.display_order) || 0,
      subtopics:     form.subtopics,
    }])
    if (error) showToast('Save failed: ' + error.message, PX.bad)
    else {
      showToast('Chapter added ✓', PX.ok)
      setForm(blank)
      setOpen(false)
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div style={{ ...S.card, border: open ? `1px solid ${PX.gold}` : `1px dashed ${PX.line2}`, background: open ? '#fff' : PX.tint }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:PX.serif, fontSize:17, fontWeight:600, color:PX.ink }}>Add a chapter</div>
          <div style={{ fontSize:12, color:PX.sub, marginTop:2 }}>Chapter names come from the shared course list, so questions and materials line up.</div>
        </div>
        <button type="button" onClick={() => setOpen(!open)} style={open ? { ...S.btnGhost, minHeight:42, padding:'10px 16px' } : S.btn()}>
          {open ? 'Cancel' : <><PIcon.plus size={14}/> Add chapter</>}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSave} className="sm-fade" style={{ marginTop:16 }}>
          <ChapterFields form={form} setForm={setForm} rows={rows}/>
          <SubtopicEditor subtopics={form.subtopics} onChange={subs => setForm(f=>({...f,subtopics:subs}))}/>
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <button type="submit" disabled={saving} style={S.btn(PX.navy, saving)}>
              {saving ? 'Saving…' : 'Save chapter'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setForm(blank) }} style={{ ...S.btnGhost, minHeight:42, padding:'10px 16px' }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Main SyllabusManager ────────────────────────────────────────────────────

function SyllabusManager({ embedded = false, onNavigate, focus }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterCourse,  setFilterCourse]  = useState('All')
  const [filterSubject, setFilterSubject] = useState('All')
  const { show: showToast, el: toastEl }  = useToast()

  // Chapter focus from the Teaching hub: narrow to that course/subject and
  // search for the chapter (render-time adjustment, no extra effect pass).
  const [seenFocus, setSeenFocus] = useState(null)
  if (focus && focus !== seenFocus) {
    setSeenFocus(focus)
    setFilterCourse(TAXONOMY[focus.course] ? focus.course : 'All')
    setFilterSubject(focus.subject || 'All')
    setSearch(focus.chapter || '')
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('syllabus_topics')
      .select('*')
      .order('course')
      .order('subject_name')
      .order('display_order')
      .order('chapter_name')
    if (error) showToast('Load failed: ' + error.message, PX.bad)
    // Catalogue chapters only — Teaching's Syllabus tab keeps per-batch
    // progress rows (syllabus_id, no course/subject) in the same table.
    if (data) setRows(data.filter(r => !r.syllabus_id && (r.course || r.subject_name)))
    setLoading(false)
  }, [showToast])

  useEffect(() => { fetchAll() }, [fetchAll])

  const allSubjects = useMemo(() => {
    const pool = filterCourse === 'All' ? rows : rows.filter(r => courseKey(r.course) === filterCourse)
    return [...new Set(pool.map(r => r.subject_name).filter(Boolean))].sort()
  }, [rows, filterCourse])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      const mc = filterCourse  === 'All' || courseKey(r.course) === filterCourse
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
      const key = `${courseKey(r.course)}||${r.subject_name}`
      if (!map[key]) map[key] = { course:courseKey(r.course), subject:r.subject_name, chapters:[] }
      map[key].chapters.push(r)
    })
    const order = c => { const i = COURSE_LIST.indexOf(c); return i === -1 ? 99 : i }
    return Object.values(map).sort((a,b) => order(a.course) - order(b.course) || (a.subject ?? '').localeCompare(b.subject ?? ''))
  }, [filtered])

  const stats = useMemo(() => ({
    courses:   new Set(rows.map(r => courseKey(r.course)).filter(Boolean)).size,
    subjects:  new Set(rows.map(r => `${courseKey(r.course)}|${r.subject_name}`)).size,
    chapters:  rows.length,
    subtopics: rows.reduce((a, r) => a + (r.subtopics?.length || 0), 0),
  }), [rows])

  const body = (
    <>
      {embedded && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }} className="sm-stats">
          {[
            ['Courses', stats.courses], ['Subjects', stats.subjects], ['Chapters', stats.chapters], ['Subtopics', stats.subtopics],
          ].map(([l, v]) => (
            <div key={l} style={{ ...S.card, marginBottom:0, padding:'14px 16px', borderTop:`3px solid ${PX.gold}` }}>
              <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:PX.sub }}>{l}</div>
              <div style={{ fontFamily:PX.serif, fontSize:26, fontWeight:600, color:PX.ink, marginTop:4 }}>{loading ? '—' : v}</div>
            </div>
          ))}
        </div>
      )}

      <AddChapterForm onSaved={fetchAll} showToast={showToast} rows={rows} defaultCourse={filterCourse !== 'All' ? filterCourse : ''}/>

      {/* Filters */}
      <div style={{ ...S.card, padding:12, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <input
          placeholder="Search chapters or subtopics…"
          aria-label="Search chapters or subtopics"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...S.input, flex:'1 1 220px', minWidth:160 }}
        />
        <select aria-label="Course" value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterSubject('All') }} style={{ ...S.select, width:'auto', flex:'0 1 190px' }}>
          <option value="All">All courses</option>
          {COURSE_LIST.map(c => <option key={c} value={c}>{TAXONOMY[c].label}</option>)}
        </select>
        <select aria-label="Subject" value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 190px' }}>
          <option value="All">All subjects</option>
          {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || filterCourse !== 'All' || filterSubject !== 'All') && (
          <button onClick={() => { setSearch(''); setFilterCourse('All'); setFilterSubject('All') }} style={S.btnGhost}>✕ Clear</button>
        )}
        <button onClick={fetchAll} style={S.btnGhost}>↻ Refresh</button>
      </div>

      <div style={{ fontSize:12.5, color:PX.sub, margin:'0 2px 12px' }}>
        Showing <strong style={{ color:PX.ink }}>{filtered.length}</strong> of {rows.length} chapters
        {search && <span style={{ marginLeft:8, color:PX.gold, fontWeight:700 }}>matching "{search}"</span>}
      </div>

      {loading && (
        <div style={{ ...S.card, textAlign:'center', padding:48, color:PX.sub }}>Loading syllabus…</div>
      )}

      {!loading && grouped.length === 0 && (
        <div style={{ ...S.card, textAlign:'center', padding:'44px 24px' }}>
          <div style={{ fontFamily:PX.serif, fontSize:18, fontWeight:600, color:PX.ink }}>
            {rows.length === 0 ? 'No chapters yet' : 'No chapters match your filters'}
          </div>
          <div style={{ fontSize:13, color:PX.sub, marginTop:4 }}>
            {rows.length === 0 ? 'Add the first chapter above.' : 'Try a different course, subject or search.'}
          </div>
        </div>
      )}

      {!loading && grouped.map(group => {
        const t = tone(group.course)
        return (
          <div key={`${group.course}||${group.subject}`} style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
              <span style={{ ...S.badge(t.c, t.bg), fontSize:12, padding:'4px 12px' }}>{courseLabel(group.course)}</span>
              <h3 style={{ fontFamily:PX.serif, fontSize:18, fontWeight:600, color:PX.ink, margin:0 }}>{group.subject}</h3>
              <span style={{ fontSize:12, color:PX.faint }}>{group.chapters.length} chapter{group.chapters.length!==1?'s':''}</span>
              <div style={{ flex:1, height:1, background:PX.line, minWidth:40 }}/>
            </div>
            {group.chapters.map(row => (
              <ChapterRow key={row.id} row={row} rows={rows} onSaved={fetchAll} onDeleted={fetchAll}
                showToast={showToast} onNavigate={onNavigate}/>
            ))}
          </div>
        )
      })}
    </>
  )

  return (
    <div className="sm-scope">
      <style>{css}</style>
      {toastEl}
      {embedded ? body : (
        <div className="px-root">
          <PremiumStyles />
          <div className="px-wrap">
            <PremiumHero
              icon={<PIcon.layers size={24}/>}
              eyebrow="GNSI · Academics"
              title="Syllabus Manager"
              subtitle="Chapters and subtopics for Sainik, Navodaya, Foundation and RMS"
              stats={[
                { label:'Courses', value: loading ? '—' : stats.courses },
                { label:'Subjects', value: loading ? '—' : stats.subjects },
                { label:'Chapters', value: loading ? '—' : stats.chapters },
                { label:'Subtopics', value: loading ? '—' : stats.subtopics },
              ]}
            />
            {body}
          </div>
        </div>
      )}
    </div>
  )
}

export default SyllabusManager
