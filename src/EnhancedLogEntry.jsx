// EnhancedLogEntry.jsx — ALL FIELDS MANDATORY VERSION
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II','English Grammar',
  'General Knowledge','General Science','Reasoning','Mental Ability',
  'Hindi','Vocabulary','Meitei Mayek',
]

const TEACHING_TECHNIQUES = [
  'Lecture / Direct Teaching','Socratic Questioning','Think-Pair-Share',
  'Problem-Solving on Board','Visual / Diagram Method','Group Discussion',
  'Quiz / Rapid Fire','Story / Analogy Method','Practice Drill',
  'Revision / Mind Map','Activity Based Learning','Audio-Visual / Video',
]

const DIFFICULTY = ['Easy','Medium','Hard']
const PERIODS = [1,2,3,4,5,6,7]

const today = () => new Date().toISOString().split('T')[0]
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-'
const pct = (s, m) => m > 0 ? Math.round((s/m)*100) : 0

const C = { navy:'#1e3a5f', green:'#16a34a', amber:'#d97706', purple:'#7c3aed', red:'#dc2626', sky:'#0891b2' }

const S = {
  card: { background:'white', borderRadius:14, boxShadow:'0 2px 12px rgba(0,0,0,.08)', padding:22, marginBottom:16 },
  input: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44 },
  select: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44 },
  label: { display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' },
  required: { color: '#dc2626', marginLeft: 2 },
  btn: (color=C.navy, disabled=false) => ({ backgroundColor:disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontSize:13, minHeight:44 }),
  btnSm: (color=C.navy) => ({ backgroundColor:color, color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:36 }),
  badge: (c, bg) => ({ padding:'3px 9px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color:c, display:'inline-block' }),
  pill: (c, bg) => ({ padding:'4px 10px', borderRadius:999, fontSize:12, fontWeight:600, background:bg, color:c, display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer', border:'none' }),
  tag: (active) => ({ padding:'7px 13px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', background: active?C.navy:'#f1f5f9', color: active?'white':'#374151' }),
  stepDot: (active, done) => ({ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, background: done?C.green:active?C.navy:'#e2e8f0', color: done||active?'white':'#94a3b8' }),
  stepLine: (done) => ({ flex:1, height:2, background:done?C.green:'#e2e8f0', marginTop:15 }),
}

const css = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideUp{ from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
.elog-fade { animation:fadeIn .25s ease both }
@media (max-width:640px) { .form-grid { grid-template-columns:1fr !important } }`

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, color=C.navy, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:999999, background:'white', border:`1px solid ${color}`, borderLeft:`4px solid ${color}`, borderRadius:10, padding:'12px 20px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.18)', maxWidth:'92vw', color:'#1e293b', display:'flex', alignItems:'center', gap:10, animation:'slideUp .2s ease' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>{msg}
    </div>
  )
}

function useToast() {
  const [t, setT] = useState(null)
  const show = useCallback((msg, color=C.navy) => setT({ msg, color, k:Date.now() }), [])
  const el = t ? <Toast key={t.k} msg={t.msg} color={t.color} onDone={() => setT(null)}/> : null
  return { show, el }
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, msg, confirmLabel='Confirm', onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onCancel}>
      <div style={{ background:'white', borderRadius:14, padding:28, width:380, maxWidth:'94vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:24, lineHeight:1.7 }}>{msg}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onConfirm} style={S.btn(C.navy)}>{confirmLabel}</button>
          <button onClick={onCancel} style={{ ...S.btn('#64748b'), background:'white', color:'#64748b', border:'1px solid #e2e8f0' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepBar({ current, steps, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', marginBottom:28 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flex:1, cursor:'pointer' }} onClick={() => current > i && onChange(i)}>
            <div style={S.stepDot(current===i, current>i)}>{current > i ? '✓' : i+1}</div>
            <span style={{ fontSize:10, fontWeight:700, color:current===i?C.navy:current>i?C.green:'#94a3b8', textAlign:'center', maxWidth:64, lineHeight:1.3 }}>{s.label}</span>
          </div>
          {i < steps.length-1 && <div style={S.stepLine(current>i)}/>}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Validation Message ───────────────────────────────────────────────────────

function ValidationMessage({ form, step }) {
  const errors = []
  if (step === 0) {
    if (!form.course) errors.push('Course is required')
    if (!form.subtype) errors.push('Batch/Subtype is required')
    if (!form.class_name) errors.push('Class is required')
    if (!form.subject_name) errors.push('Subject is required')
    if (!form.teaching_date) errors.push('Teaching Date is required')
    if (!form.period_number) errors.push('Period is required')
    if (!form.chapter && !form.chapter_custom) errors.push('Chapter is required')
    if (!form.subtopic && !form.subtopic_custom) errors.push('Sub-topic is required')
  }
  if (step === 1) {
    if (!form.range_from) errors.push('Range From is required')
    if (!form.range_to) errors.push('Range To is required')
    if (!form.topic_taught) errors.push('Topic Taught is required')
    if (!form.classwork) errors.push('Classwork is required')
    if (!form.homework) errors.push('Homework is required')
    if (!form.remarks) errors.push('Remarks are required')
  }
  if (step === 2) {
    if (!(form.techniques || []).length) errors.push('Select at least one Teaching Technique')
    if (!form.technique_detail) errors.push('Technique Details are required')
    if (!form.key_concepts) errors.push('Key Concepts are required')
    if (!form.technique_avoid) errors.push('Avoid Instructions are required')
  }
  if (step === 5 && form.needs_doubt_session) {
    if (!form.assigned_hm_id && !form.assigned_hm_name) errors.push('HM is required')
    if (!form.doubt_date) errors.push('Doubt Date is required')
    if (!form.doubt_time_slot) errors.push('Time Slot is required')
    if (!form.hm_instruction_message) errors.push('HM Instructions are required')
    if (!(form.focus_student_ids || []).length) errors.push('Select at least one Focus Student')
  }
  if (!errors.length) return null
  return (
    <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, marginBottom:14 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:4 }}>⚠️ Required Fields Missing:</div>
      <ul style={{ margin:0, paddingLeft:16, fontSize:12, color:C.red, lineHeight:1.8 }}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </div>
  )
}

// ─── AI Question Generator ────────────────────────────────────────────────────

async function generateAIQuestions(chapter, subtopic, subject, count=5) {
  const prompt = `You are a teacher for Navodaya/Sainik school entrance exam preparation.
Generate ${count} genuine, thought-provoking questions for students about:
Subject: ${subject}
Chapter: ${chapter}
Subtopic: ${subtopic || chapter}

Requirements:
- Questions must test deep understanding, not just recall
- Mix of types: conceptual, application, "why/how", comparison
- Appropriate difficulty for classes 6-9
- Each question on a new line starting with Q1., Q2., etc.
- After each question, on the next line write ANS: (brief answer hint)

Output ONLY the questions and answers, no preamble.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{ role:'user', content:prompt }] }),
  })
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  const lines = text.split('\n').filter(l => l.trim())
  const questions = []
  let cur = null
  lines.forEach(l => {
    if (/^Q\d+\./i.test(l.trim())) { if (cur) questions.push(cur); cur = { q: l.replace(/^Q\d+\.\s*/i,'').trim(), ans:'' } }
    else if (/^ANS:/i.test(l.trim()) && cur) { cur.ans = l.replace(/^ANS:\s*/i,'').trim() }
  })
  if (cur) questions.push(cur)
  return questions
}

// ─── Bulk Question Parser ─────────────────────────────────────────────────────

function parseBulkQuestions(raw) {
  if (!raw.trim()) return []
  const lines = raw.split('\n')
  const qs = []
  let cur = null
  lines.forEach(line => {
    const l = line.trim()
    if (!l) return
    const qMatch = l.match(/^(?:Q\.?\s*)?(\d+)[.)]\s+(.+)/i) || l.match(/^\((\d+)\)\s+(.+)/)
    if (qMatch) {
      if (cur) qs.push(cur)
      cur = { order_no: parseInt(qMatch[1]), question_text: qMatch[2], answer:'', difficulty:'Medium', options:[] }
    } else if (cur) {
      const optMatch = l.match(/^[([\[]?([A-Da-d])[.):\]]\s+(.+)/)
      if (optMatch) { cur.options.push({ key: optMatch[1].toUpperCase(), text: optMatch[2] }) }
      else if (/^Ans(?:wer)?[:.]?\s*/i.test(l)) { cur.answer = l.replace(/^Ans(?:wer)?[:.]?\s*/i,'').trim() }
      else if (cur.question_text) { cur.question_text += ' ' + l }
    }
  })
  if (cur) qs.push(cur)
  return qs
}

// ─── Step 1: Course + Chapter ─────────────────────────────────────────────────

function Step1CourseChapter({ form, setForm, courseData, chapters, loadingChapters }) {
  const { courses, subtypesFor, classesFor, batchIdFor } = courseData

  const subtypes = form.course ? subtypesFor(form.course) : []
  const classes  = (form.course && form.subtype) ? classesFor(form.course, form.subtype) : []

  const handleCourse = c => setForm(f => ({ ...f, course:c, subtype:'', class_name:'', batch_id:'', chapter:'', subtopic:'' }))
  const handleSubtype = st => {
    const cls = classesFor(form.course, st)
    const cn  = cls.length === 1 ? cls[0] : ''
    const bid = cn ? batchIdFor(form.course, st, cn) : ''
    setForm(f => ({ ...f, subtype:st, class_name:cn, batch_id:bid, chapter:'', subtopic:'' }))
  }
  const handleClass = cn => setForm(f => ({ ...f, class_name:cn, batch_id: batchIdFor(form.course, form.subtype, cn) }))

  const filteredChapters = useMemo(() => {
    if (!form.subject_name || !chapters.length) return []
    return chapters.filter(c => c.subject_name===form.subject_name)
  }, [chapters, form.subject_name])

  const subtopicsOfChapter = useMemo(() => {
    if (!form.chapter) return []
    const ch = chapters.find(c => c.chapter_name===form.chapter && c.subject_name===form.subject_name)
    return ch?.subtopics || []
  }, [chapters, form.chapter, form.subject_name])

  return (
    <div className="elog-fade">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
        {/* Course */}
        <div>
          <label style={S.label}>Course <span style={S.required}>*</span></label>
          <select value={form.course} onChange={e => handleCourse(e.target.value)} required style={S.select}>
            <option value="">Select Course</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {/* Subtype */}
        <div>
          <label style={S.label}>Batch / Subtype <span style={S.required}>*</span></label>
          <select value={form.subtype} onChange={e => handleSubtype(e.target.value)} disabled={!form.course} required style={{ ...S.select, opacity:form.course?1:.5 }}>
            <option value="">Select Subtype</option>
            {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Class */}
        <div>
          <label style={S.label}>Class <span style={S.required}>*</span> {form.batch_id && <span style={{ color:C.green, marginLeft:4, fontSize:10 }}>✓ linked</span>}</label>
          {classes.length > 0
            ? <select value={form.class_name} onChange={e => handleClass(e.target.value)} disabled={!form.subtype} required style={{ ...S.select, opacity:form.subtype?1:.5 }}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            : <input value={form.class_name} onChange={e => handleClass(e.target.value)} placeholder="e.g. Class 6" disabled={!form.subtype} required style={{ ...S.input, opacity:form.subtype?1:.5 }}/>
          }
        </div>
        {/* Subject */}
        <div>
          <label style={S.label}>Subject <span style={S.required}>*</span></label>
          <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name:e.target.value, chapter:'', subtopic:'' }))} required style={S.select}>
            <option value="">Select Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Date */}
        <div>
          <label style={S.label}>Teaching Date <span style={S.required}>*</span></label>
          <input type="date" value={form.teaching_date} onChange={e => setForm(f => ({ ...f, teaching_date:e.target.value }))} required style={S.input}/>
        </div>
        {/* Period */}
        <div>
          <label style={S.label}>Period <span style={S.required}>*</span></label>
          <select value={form.period_number} onChange={e => setForm(f => ({ ...f, period_number:e.target.value }))} required style={S.select}>
            <option value="">Select Period</option>
            {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
          </select>
        </div>
      </div>

      {/* Chapter */}
      <div style={{ marginTop:16 }}>
        <label style={S.label}>Chapter <span style={S.required}>*</span></label>
        {loadingChapters
          ? <div style={{ fontSize:13, color:'#64748b', padding:'10px 0' }}>⏳ Loading chapters...</div>
          : filteredChapters.length > 0
            ? <select value={form.chapter} onChange={e => setForm(f => ({ ...f, chapter:e.target.value, subtopic:'' }))} required style={S.select}>
                <option value="">Select Chapter</option>
                {filteredChapters.map(c => <option key={c.id} value={c.chapter_name}>{c.chapter_name}</option>)}
                <option value="__other__">Other (type below)</option>
              </select>
            : null
        }
        {(form.chapter === '__other__' || !filteredChapters.length) && (
          <input value={form.chapter==='__other__' ? form.chapter_custom||'' : form.chapter}
            onChange={e => {
              if (filteredChapters.length) setForm(f => ({ ...f, chapter_custom:e.target.value }))
              else setForm(f => ({ ...f, chapter:e.target.value }))
            }}
            placeholder="Type chapter name..." required style={{ ...S.input, marginTop: filteredChapters.length?8:0 }}/>
        )}
      </div>

      {/* Sub-topic */}
      <div style={{ marginTop:14 }}>
        <label style={S.label}>Sub-topic / Lesson <span style={S.required}>*</span></label>
        {subtopicsOfChapter.length > 0
          ? <select value={form.subtopic} onChange={e => setForm(f => ({ ...f, subtopic:e.target.value }))} required style={S.select}>
              <option value="">Select Sub-topic</option>
              {subtopicsOfChapter.map((s,i) => <option key={i} value={s}>{s}</option>)}
              <option value="__other__">Other (type below)</option>
            </select>
          : null
        }
        {(form.subtopic === '__other__' || !subtopicsOfChapter.length) && (
          <input value={form.subtopic==='__other__' ? form.subtopic_custom||'' : form.subtopic}
            onChange={e => {
              if (subtopicsOfChapter.length) setForm(f => ({ ...f, subtopic_custom:e.target.value }))
              else setForm(f => ({ ...f, subtopic:e.target.value }))
            }}
            placeholder="e.g. Properties of triangles, Number system basics..." required style={{ ...S.input, marginTop: subtopicsOfChapter.length?8:0 }}/>
        )}
      </div>
    </div>
  )
}

// ─── Step 2: What Was Taught ──────────────────────────────────────────────────

function Step2WhatTaught({ form, setForm }) {
  const chapterDisplay = form.chapter === '__other__' ? form.chapter_custom : form.chapter
  const subtopicDisplay = form.subtopic === '__other__' ? form.subtopic_custom : form.subtopic

  return (
    <div className="elog-fade">
      {(chapterDisplay || subtopicDisplay) && (
        <div style={{ padding:'10px 14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, marginBottom:18, fontSize:13 }}>
          <span style={{ fontWeight:700, color:C.navy }}>📖 {chapterDisplay}</span>
          {subtopicDisplay && <span style={{ color:'#3b82f6', marginLeft:8 }}>→ {subtopicDisplay}</span>}
        </div>
      )}

      {/* Topic range */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <div>
          <label style={S.label}>Covered From (Q.No / Page / Topic) <span style={S.required}>*</span></label>
          <input value={form.range_from} onChange={e => setForm(f => ({ ...f, range_from:e.target.value }))} required placeholder="e.g. Q.1, Page 23, Section 2.1" style={S.input}/>
        </div>
        <div>
          <label style={S.label}>Covered To <span style={S.required}>*</span></label>
          <input value={form.range_to} onChange={e => setForm(f => ({ ...f, range_to:e.target.value }))} required placeholder="e.g. Q.15, Page 30, Section 2.4" style={S.input}/>
        </div>
      </div>

      {/* Topic taught */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Topic Taught (summary) <span style={S.required}>*</span></label>
        <input value={form.topic_taught} onChange={e => setForm(f => ({ ...f, topic_taught:e.target.value }))} required placeholder="Brief description of what was covered today..." style={S.input}/>
      </div>

      {/* Classwork */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Classwork done <span style={S.required}>*</span></label>
        <textarea value={form.classwork} onChange={e => setForm(f => ({ ...f, classwork:e.target.value }))} required rows={3} style={{ ...S.input, resize:'vertical' }} placeholder="What exercises or work was done in class?"/>
      </div>

      {/* Homework */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Homework assigned <span style={S.required}>*</span></label>
        <textarea value={form.homework} onChange={e => setForm(f => ({ ...f, homework:e.target.value }))} required rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Questions/exercises assigned for home"/>
      </div>

      {/* Remarks */}
      <div>
        <label style={S.label}>Remarks / Observations <span style={S.required}>*</span></label>
        <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks:e.target.value }))} required rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Student response, pace, anything notable"/>
      </div>
    </div>
  )
}

// ─── Step 3: Teaching Technique ───────────────────────────────────────────────

function Step3Technique({ form, setForm }) {
  const toggleTechnique = t => {
    const cur = form.techniques || []
    const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]
    setForm(f => ({ ...f, techniques: next }))
  }

  return (
    <div className="elog-fade">
      <p style={{ color:'#64748b', fontSize:13, marginBottom:16, lineHeight:1.7 }}>
        Select all teaching methods used in this session. Be specific — this helps HMs conduct doubt sessions effectively.
      </p>

      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
        {TEACHING_TECHNIQUES.map(t => (
          <button key={t} type="button" onClick={() => toggleTechnique(t)} style={S.tag((form.techniques||[]).includes(t))}>
            {(form.techniques||[]).includes(t) ? '✓ ' : ''}{t}
          </button>
        ))}
      </div>
      {(form.techniques || []).length === 0 && (
        <div style={{ color:C.red, fontSize:12, marginBottom:10, fontWeight:600 }}>⚠️ Select at least one technique</div>
      )}

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Technique Details <span style={S.required}>*</span></label>
        <textarea value={form.technique_detail} onChange={e => setForm(f => ({ ...f, technique_detail:e.target.value }))} required rows={4} style={{ ...S.input, resize:'vertical' }} placeholder={`Describe in detail HOW you taught this topic.

Example: "Used the number line to show negative integers. Drew diagram on board. Asked 5 rapid-fire questions. Worked Q.1–Q.8 together. Weaker students were asked to repeat steps aloud."`}/>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Key Concepts to Emphasise (for HM) <span style={S.required}>*</span></label>
        <textarea value={form.key_concepts} onChange={e => setForm(f => ({ ...f, key_concepts:e.target.value }))} required rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="e.g. Always draw the diagram first. Common mistake: forgetting sign rules. Focus on Q.5 and Q.9 which students found hardest."/>
      </div>

      <div>
        <label style={S.label}>Do NOT do this during doubt session <span style={S.required}>*</span></label>
        <textarea value={form.technique_avoid} onChange={e => setForm(f => ({ ...f, technique_avoid:e.target.value }))} required rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="e.g. Do NOT jump to answers directly. Make students attempt first. Don't skip the diagram step."/>
      </div>
    </div>
  )
}

// ─── Step 4: AI Questions ─────────────────────────────────────────────────────

function Step4AIQuestions({ form, setForm }) {
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState(form.ai_questions || [])
  const [error, setError] = useState('')
  const [count, setCount] = useState(5)

  const chapterDisplay = form.chapter === '__other__' ? form.chapter_custom : form.chapter
  const subtopicDisplay = form.subtopic === '__other__' ? form.subtopic_custom : form.subtopic

  const generate = async () => {
    if (!chapterDisplay || !form.subject_name) { setError('Please fill Chapter and Subject in Step 1 first.'); return }
    setLoading(true); setError('')
    try {
      const qs = await generateAIQuestions(chapterDisplay, subtopicDisplay, form.subject_name, count)
      if (!qs.length) { setError('No questions generated. Try again.'); setLoading(false); return }
      setQuestions(qs); setForm(f => ({ ...f, ai_questions: qs }))
    } catch(e) { setError('Generation failed: ' + e.message) }
    setLoading(false)
  }

  const toggleKeep = i => {
    const updated = questions.map((q, j) => j===i ? { ...q, kept: !q.kept } : q)
    setQuestions(updated); setForm(f => ({ ...f, ai_questions: updated }))
  }

  const editQ = (i, field, val) => {
    const updated = questions.map((q, j) => j===i ? { ...q, [field]: val } : q)
    setQuestions(updated); setForm(f => ({ ...f, ai_questions: updated }))
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'14px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:'#166534', fontSize:13, marginBottom:4 }}>🤖 AI Question Generator</div>
        <div style={{ fontSize:12, color:'#16a34a', lineHeight:1.6 }}>Generate genuine conceptual questions based on the chapter/subtopic taught.</div>
      </div>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <span style={{ fontSize:13, color:'#374151' }}>Generate</span>
        <select value={count} onChange={e => setCount(Number(e.target.value))} style={{ ...S.select, width:80 }}>
          {[3,5,8,10].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize:13, color:'#374151' }}>questions about</span>
        <span style={{ fontWeight:700, color:C.navy, fontSize:13 }}>{chapterDisplay || '(no chapter)'} — {form.subject_name || '(no subject)'}</span>
        <button type="button" onClick={generate} disabled={loading} style={S.btn(C.purple, loading)}>
          {loading ? '⏳ Generating...' : '✨ Generate Questions'}
        </button>
      </div>
      {error && <div style={{ color:C.red, fontSize:13, marginBottom:12, padding:'8px 12px', background:'#fee2e2', borderRadius:8 }}>{error}</div>}
      {questions.length > 0 && (
        <>
          <div style={{ fontSize:12, color:'#64748b', marginBottom:10 }}>Click questions to keep/discard for doubt session use.</div>
          {questions.map((q, i) => (
            <div key={i} style={{ border:`2px solid ${q.kept ? C.green : '#e2e8f0'}`, borderRadius:10, padding:14, marginBottom:10, background: q.kept ? '#f0fdf4' : 'white' }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <button type="button" onClick={() => toggleKeep(i)} style={{ ...S.btnSm(q.kept ? C.green : '#94a3b8'), flexShrink:0, padding:'4px 10px' }}>{q.kept ? '✓ Keep' : '○ Keep'}</button>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:'#1e293b', fontSize:12, marginBottom:4 }}>Q{i+1}.</div>
                  <textarea value={q.q} onChange={e => editQ(i,'q',e.target.value)} style={{ ...S.input, fontSize:13, padding:'8px 10px', marginBottom:8, minHeight:60 }}/>
                  {q.ans && <div style={{ fontSize:12, color:'#64748b' }}><span style={{ fontWeight:700, color:'#374151' }}>Hint: </span><input value={q.ans} onChange={e => editQ(i,'ans',e.target.value)} style={{ ...S.input, display:'inline', width:'auto', fontSize:12, padding:'4px 8px', minHeight:32 }}/></div>}
                </div>
              </div>
            </div>
          ))}
          <div style={{ fontSize:12, color:'#94a3b8' }}>{questions.filter(q=>q.kept).length} / {questions.length} questions marked for doubt session</div>
        </>
      )}
    </div>
  )
}

// ─── Step 5: Bulk Practice Questions ─────────────────────────────────────────

function Step5BulkQuestions({ form, setForm }) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState(form.practice_questions || [])
  const [parseError, setParseError] = useState('')
  const chapterDisplay = form.chapter === '__other__' ? form.chapter_custom : form.chapter

  const handleParse = () => {
    if (!raw.trim()) { setParseError('Paste some questions first.'); return }
    const qs = parseBulkQuestions(raw)
    if (!qs.length) { setParseError('Could not detect any questions. Use format: "1. Question text" or "Q1. Question text"'); return }
    setParseError(''); setParsed(qs); setForm(f => ({ ...f, practice_questions: qs }))
  }

  const updateQ = (i, field, val) => {
    const updated = parsed.map((q, j) => j===i ? { ...q, [field]: val } : q)
    setParsed(updated); setForm(f => ({ ...f, practice_questions: updated }))
  }

  const removeQ = i => {
    const updated = parsed.filter((_,j) => j!==i)
    setParsed(updated); setForm(f => ({ ...f, practice_questions: updated }))
  }

  const addBlank = () => {
    const updated = [...parsed, { order_no: parsed.length+1, question_text:'', answer:'', difficulty:'Medium', options:[] }]
    setParsed(updated); setForm(f => ({ ...f, practice_questions: updated }))
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'12px 16px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:'#854d0e', fontSize:13, marginBottom:3 }}>📋 Practice Question Bank</div>
        <div style={{ fontSize:12, color:'#a16207', lineHeight:1.6 }}>Upload practice questions for <b>{chapterDisplay || 'this chapter'}</b>.</div>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Paste Questions Here (from PDF / book)</label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8} style={{ ...S.input, fontFamily:"'JetBrains Mono',monospace", fontSize:12, resize:'vertical' }} placeholder={`Example format:

1. What is the Pythagorean theorem?
Ans: a²+b²=c²

Q2. If a right triangle has legs 3 and 4, find the hypotenuse.
Ans: 5
   a) 5   b) 7   c) 6   d) 4`}/>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button type="button" onClick={handleParse} style={S.btn(C.amber)}>🔍 Parse Questions</button>
          {parseError && <span style={{ fontSize:12, color:C.red, alignSelf:'center' }}>{parseError}</span>}
        </div>
      </div>
      {parsed.length > 0 && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontWeight:700, color:'#1e293b', fontSize:14 }}>{parsed.length} Question{parsed.length!==1?'s':''} Ready to Save</div>
            <button type="button" onClick={addBlank} style={S.btnSm(C.sky)}>+ Add Question</button>
          </div>
          {parsed.map((q, i) => (
            <div key={i} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:14, marginBottom:10, background:'#f8fafc' }}>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ ...S.badge(C.navy,'#eff6ff'), flexShrink:0, marginTop:2 }}>Q{q.order_no}</span>
                <div style={{ flex:1 }}>
                  <textarea value={q.question_text} onChange={e => updateQ(i,'question_text',e.target.value)} rows={2} style={{ ...S.input, fontSize:13, marginBottom:8, resize:'vertical' }} placeholder="Question text..."/>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <div style={{ flex:'1 1 200px' }}>
                      <label style={{ ...S.label, fontSize:10 }}>Answer / Key</label>
                      <input value={q.answer} onChange={e => updateQ(i,'answer',e.target.value)} style={{ ...S.input, fontSize:12 }} placeholder="Answer..."/>
                    </div>
                    <div style={{ flex:'0 0 120px' }}>
                      <label style={{ ...S.label, fontSize:10 }}>Difficulty</label>
                      <select value={q.difficulty} onChange={e => updateQ(i,'difficulty',e.target.value)} style={{ ...S.select, fontSize:12 }}>
                        {DIFFICULTY.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => removeQ(i)} style={{ ...S.btnSm(C.red), padding:'4px 8px', flexShrink:0 }}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}
      {!parsed.length && !raw && <button type="button" onClick={addBlank} style={S.btn(C.sky)}>+ Add Question Manually</button>}
    </div>
  )
}

// ─── Step 6: HM Assignment + Notification ────────────────────────────────────

function Step6HMAssign({ form, setForm, staff, students, loadingStudents }) {
  const hmStaff = useMemo(() =>
    staff.filter(s => ['housemaster','hm','housemistress','warden'].some(r =>
      (s.designation||s.role||'').toLowerCase().includes(r)
    )),
  [staff])

  const batchStudents = useMemo(() => students || [], [students])
  const weakStudents = useMemo(() => form.weak_students || [], [form.weak_students])

  const toggleWeak = id => {
    const cur = form.focus_student_ids || []
    const next = cur.includes(id) ? cur.filter(x => x!==id) : [...cur, id]
    setForm(f => ({ ...f, focus_student_ids: next }))
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'12px 16px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:C.navy, fontSize:13, marginBottom:3 }}>🏠 Housemaster Notification</div>
        <div style={{ fontSize:12, color:'#3b82f6', lineHeight:1.6 }}>Assign a HM for the doubt session. They will receive instant notification with your teaching instructions.</div>
      </div>

      <div style={{ marginBottom:16 }}>
        <label style={S.label}>Needs Doubt Session? <span style={S.required}>*</span></label>
        <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'12px 14px', borderRadius:8, background:form.needs_doubt_session?'#fef9c3':'#f8fafc', border:`1px solid ${form.needs_doubt_session?'#fde68a':'#e2e8f0'}`, minHeight:48 }}>
          <input type="checkbox" checked={form.needs_doubt_session||false} onChange={e => setForm(f => ({ ...f, needs_doubt_session:e.target.checked }))} style={{ width:18, height:18, cursor:'pointer'}}/>
          <span style={{ fontWeight:700, fontSize:14, color:form.needs_doubt_session?'#b45309':'#374151' }}>🔁 Yes — Assign HM for Doubt Session</span>
        </label>
      </div>

      {form.needs_doubt_session && (
        <>
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Assign Housemaster / Warden <span style={S.required}>*</span></label>
            {hmStaff.length > 0
              ? <select value={form.assigned_hm_id||''} onChange={e => {
                  const s = hmStaff.find(x => x.id===e.target.value)
                  setForm(f => ({ ...f, assigned_hm_id:e.target.value, assigned_hm_name:s?.name||'' }))
                }} required style={S.select}>
                  <option value="">Select HM/Warden</option>
                  {hmStaff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.designation||'HM'})</option>)}
                </select>
              : <input value={form.assigned_hm_name||''} onChange={e => setForm(f => ({ ...f, assigned_hm_name:e.target.value }))} placeholder="Type HM name..." required style={S.input}/>
            }
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={S.label}>Preferred Date for Doubt Session <span style={S.required}>*</span></label>
              <input type="date" value={form.doubt_date||''} onChange={e => setForm(f => ({ ...f, doubt_date:e.target.value }))} required style={S.input}/>
            </div>
            <div>
              <label style={S.label}>Preferred Time Slot <span style={S.required}>*</span></label>
              <input value={form.doubt_time_slot||''} onChange={e => setForm(f => ({ ...f, doubt_time_slot:e.target.value }))} required placeholder="e.g. 6:30–7:20 AM, After dinner" style={S.input}/>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Instruction Message to HM <span style={S.required}>*</span></label>
            <textarea value={form.hm_instruction_message||''} onChange={e => setForm(f => ({ ...f, hm_instruction_message:e.target.value }))} required rows={4} style={{ ...S.input, resize:'vertical' }} placeholder={`Write specific instructions for the HM:

"Focus on Q.5–Q.9 where students struggled. Make them draw the diagram first before attempting. Use the number line technique I showed. Do NOT give direct answers — make them think."`}/>
          </div>

          {batchStudents.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Focus Students <span style={S.required}>*</span> (mark who needs extra attention)</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:12, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8 }}>
                {batchStudents.map(s => {
                  const focused = (form.focus_student_ids||[]).includes(s.id)
                  const isWeak = weakStudents.some(w => w.student_id===s.id)
                  return (
                    <button key={s.id} type="button" onClick={() => toggleWeak(s.id)} style={{ ...S.pill(focused?'white':isWeak?C.red:'#374151', focused?C.navy:isWeak?'#fee2e2':'#f1f5f9'), border: focused?`2px solid ${C.navy}`:'2px solid transparent' }}>
                      {focused ? '✓ ' : isWeak ? '⚠️ ' : ''}{s.name}
                    </button>
                  )
                })}
              </div>
              {(form.focus_student_ids || []).length === 0 && (
                <div style={{ color:C.red, fontSize:12, marginTop:6, fontWeight:600 }}>⚠️ Select at least one focus student</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Review Step ──────────────────────────────────────────────────────────────

function StepReview({ form }) {
  const chapterDisplay = form.chapter === '__other__' ? form.chapter_custom : form.chapter
  const subtopicDisplay = form.subtopic === '__other__' ? form.subtopic_custom : form.subtopic

  const rows = [
    ['Course', `${form.course||'—'} / ${form.subtype||'—'} / ${form.class_name||'—'}`],
    ['Subject', form.subject_name||'—'],
    ['Date', form.teaching_date ? fmtDate(form.teaching_date) : '—'],
    ['Period', form.period_number || '—'],
    ['Chapter', chapterDisplay||'—'],
    ['Sub-topic', subtopicDisplay||'—'],
    ['Range', form.range_from ? `${form.range_from} → ${form.range_to||'end'}` : '—'],
    ['Topic Taught', form.topic_taught||'—'],
    ['Classwork', form.classwork||'—'],
    ['Homework', form.homework||'—'],
    ['Remarks', form.remarks||'—'],
    ['Techniques', (form.techniques||[]).join(', ')||'—'],
    ['Technique Detail', form.technique_detail||'—'],
    ['Key Concepts', form.key_concepts||'—'],
    ['Avoid', form.technique_avoid||'—'],
    ['AI Questions', (form.ai_questions||[]).filter(q=>q.kept).length + ' kept'],
    ['Practice Qs', (form.practice_questions||[]).length + ' questions'],
    ['HM Assigned', form.needs_doubt_session ? (form.assigned_hm_name||'Not set') : 'No doubt session'],
    ['Doubt Date', form.doubt_date ? fmtDate(form.doubt_date) : '—'],
    ['Time Slot', form.doubt_time_slot || '—'],
    ['Focus Students', (form.focus_student_ids||[]).length + ' marked'],
  ]

  return (
    <div className="elog-fade">
      <div style={{ padding:'12px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:'#166534', fontSize:13 }}>✅ Review & Save</div>
        <div style={{ fontSize:12, color:'#16a34a' }}>Check everything below, then click Save Log.</div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <tbody>
          {rows.map(([k,v]) => (
            <tr key={k} style={{ borderBottom:'1px solid #f1f5f9' }}>
              <td style={{ padding:'8px 12px', fontWeight:700, color:'#374151', width:'38%', background:'#f8fafc' }}>{k}</td>
              <td style={{ padding:'8px 12px', color:'#1e293b' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main: Enhanced Log Form ──────────────────────────────────────────────────

const STEPS = [
  { key:'course',     label:'Course & Chapter' },
  { key:'taught',     label:'What Was Taught' },
  { key:'technique',  label:'Teaching Method' },
  { key:'ai',         label:'AI Questions' },
  { key:'questions',  label:'Practice Qs' },
  { key:'hm',         label:'HM & Notify' },
  { key:'review',     label:'Review & Save' },
]

const emptyForm = {
  course:'', subtype:'', class_name:'', batch_id:'',
  subject_name:'', chapter:'', chapter_custom:'', subtopic:'', subtopic_custom:'',
  teaching_date: '', period_number:'', teacher_name:'', staff_id:'',
  range_from:'', range_to:'', topic_taught:'', classwork:'', homework:'', remarks:'',
  techniques:[], technique_detail:'', key_concepts:'', technique_avoid:'',
  ai_questions:[], practice_questions:[],
  needs_doubt_session:false, assigned_hm_id:'', assigned_hm_name:'',
  doubt_date:'', doubt_time_slot:'',
  hm_instruction_message:'', focus_student_ids:[], weak_students:[],
}

export function EnhancedLogForm({ onSaved, courseData, staff, currentUser, logs }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [chapters, setChapters] = useState([])
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [dupWarn, setDupWarn] = useState('')
  const { show: showToast, el: toastEl } = useToast()

  useEffect(() => {
    if (currentUser?.name && !form.teacher_name) {
      const s = staff.find(x => x.name === currentUser.name)
      setForm(f => ({ ...f, teacher_name: currentUser.name, staff_id: s?.id || '' }))
    }
  }, [currentUser, staff])

  useEffect(() => {
    if (!form.subject_name) return
    setLoadingChapters(true)
    supabase.from('syllabus_topics').select('*').eq('subject_name', form.subject_name)
      .order('chapter_name')
      .then(({ data }) => { setChapters(data || []); setLoadingChapters(false) })
  }, [form.subject_name])

  useEffect(() => {
    if (!form.batch_id) return
    setLoadingStudents(true)
    supabase.from('students').select('id,name,roll_number,house').eq('batch_id', form.batch_id).eq('status','Active').order('name')
      .then(async ({ data: studs }) => {
        if (!studs?.length) { setStudents([]); setLoadingStudents(false); return }
        const { data: scores } = await supabase.from('student_scores').select('student_id,score,max_score,subject_name').in('student_id', studs.map(s=>s.id))
        const weakMap = {}
        if (scores) {
          scores.forEach(sc => {
            if (!weakMap[sc.student_id]) weakMap[sc.student_id] = { totals:[], subject:sc.subject_name }
            weakMap[sc.student_id].totals.push(pct(sc.score, sc.max_score))
          })
        }
        const enriched = studs.map(s => ({
          ...s,
          avg_score: weakMap[s.id] ? Math.round(weakMap[s.id].totals.reduce((a,b)=>a+b,0)/weakMap[s.id].totals.length) : null,
        }))
        const weak = enriched.filter(s => s.avg_score !== null && s.avg_score < 60).map(s => ({ student_id:s.id, avg_score:s.avg_score }))
        setStudents(enriched)
        setForm(f => ({ ...f, weak_students: weak }))
        setLoadingStudents(false)
      })
  }, [form.batch_id])

  const isDuplicate = useCallback(() => {
    if (!form.course || !form.subtype || !form.subject_name || !form.teaching_date) return false
    return logs.some(l =>
      l.course === form.course &&
      l.subtype === form.subtype &&
      l.class_name === form.class_name &&
      l.subject_name === form.subject_name &&
      l.teaching_date === form.teaching_date
    )
  }, [form, logs])

  // ALL FIELDS MANDATORY
  const canNext = () => {
    if (step === 0) {
      return form.course && form.subtype && form.class_name && form.subject_name && 
             form.teaching_date && form.period_number && 
             (form.chapter || form.chapter_custom) && 
             (form.subtopic || form.subtopic_custom)
    }
    if (step === 1) {
      return form.range_from && form.range_to && form.topic_taught && 
             form.classwork && form.homework && form.remarks
    }
    if (step === 2) {
      return (form.techniques || []).length > 0 && form.technique_detail && 
             form.key_concepts && form.technique_avoid
    }
    if (step === 3) return true
    if (step === 4) return true
    if (step === 5) {
      if (form.needs_doubt_session) {
        return (form.assigned_hm_id || form.assigned_hm_name) && form.doubt_date && 
               form.doubt_time_slot && form.hm_instruction_message && 
               (form.focus_student_ids || []).length > 0
      }
      return true
    }
    return true
  }

  const handleNext = () => {
    if (step === 0 && isDuplicate()) {
      setDupWarn(`⚠️ A log for ${form.subject_name} on ${form.teaching_date} already exists for this batch.`)
      return
    }
    setDupWarn('')
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const chapterFinal = form.chapter === '__other__' ? form.chapter_custom : form.chapter
      const subtopicFinal = form.subtopic === '__other__' ? form.subtopic_custom : form.subtopic

      const logPayload = {
        course: form.course, subtype: form.subtype || null, class_name: form.class_name || null,
        batch_id: form.batch_id || null, subject_name: form.subject_name,
        teacher_name: form.teacher_name || null, staff_id: form.staff_id || null,
        teaching_date: form.teaching_date, topic_taught: form.topic_taught,
        classwork: form.classwork || null, homework: form.homework || null,
        remarks: form.remarks || null, period_number: form.period_number || null,
        needs_doubt_session: form.needs_doubt_session || false,
        chapter: chapterFinal || null, subtopic: subtopicFinal || null,
        range_from: form.range_from || null, range_to: form.range_to || null,
        techniques: form.techniques?.length ? form.techniques.join(', ') : null,
        technique_detail: form.technique_detail || null,
        key_concepts: form.key_concepts || null,
        technique_avoid: form.technique_avoid || null,
      }
      const { data: logData, error: logError } = await supabase.from('teaching_logs').insert([logPayload]).select().single()
      if (logError) { showToast('Error saving log: ' + logError.message, C.red); setSaving(false); return }

      const logId = logData.id

      if ((form.practice_questions || []).length) {
        const pqs = form.practice_questions.map((q, i) => ({
          log_id: logId, batch_id: form.batch_id || null,
          course: form.course, subject_name: form.subject_name,
          chapter: chapterFinal || null, subtopic: subtopicFinal || null,
          question_text: q.question_text, answer: q.answer || null,
          difficulty: q.difficulty || 'Medium', order_no: q.order_no || i+1,
          options: q.options?.length ? JSON.stringify(q.options) : null,
        }))
        await supabase.from('practice_questions').insert(pqs)
      }

      if (form.needs_doubt_session && (form.assigned_hm_id || form.assigned_hm_name)) {
        const aiQsForHm = (form.ai_questions || []).filter(q => q.kept)
        const focusNames = students.filter(s => (form.focus_student_ids||[]).includes(s.id)).map(s => s.name)

        const buildDsRow = (house) => ({
          log_id: logId,
          course: form.course,
          subtype: form.subtype || null,
          class_name: form.class_name || null,
          subject_name: form.subject_name,
          topic: form.topic_taught,
          teaching_date: form.teaching_date,
          teacher_name: form.teacher_name || null,
          teacher_staff_id: form.staff_id && /^\d+$/.test(String(form.staff_id)) ? Number(form.staff_id) : null,
          house_name: house || null,
          hm_id: form.assigned_hm_id || null,
          hm_name: form.assigned_hm_name || null,
          status: 'open',
          batch_name: form.subtype || null,
          staff_name: form.teacher_name || null,
          student_name: null,
          is_read: false,
          batch_id: form.batch_id || null,
          teacher_instructions: form.hm_instruction_message || null,
          key_concepts: form.key_concepts || null,
          technique_avoid: form.technique_avoid || null,
          ai_questions_for_hm: aiQsForHm.length ? JSON.stringify(aiQsForHm) : null,
          focus_student_ids: form.focus_student_ids?.length ? JSON.stringify(form.focus_student_ids) : null,
          focus_student_names: focusNames.length ? JSON.stringify(focusNames) : null,
          doubt_date: form.doubt_date || null,
          doubt_time_slot: form.doubt_time_slot || null,
        })

        const houses = [...new Set(students.map(s => s.house).filter(Boolean))]
        const dsRows = houses.length ? houses.map(house => buildDsRow(house)) : [buildDsRow(null)]
        await supabase.from('doubt_sessions').insert(dsRows)

        await supabase.from('hm_notifications').insert([{
          log_id: logId,
          hm_staff_id: form.assigned_hm_id || null,
          hm_name: form.assigned_hm_name || null,
          message: `📚 Doubt session needed: ${form.subject_name} — ${chapterFinal} (${form.subtype||form.course})`,
          instructions: form.hm_instruction_message || null,
          key_concepts: form.key_concepts || null,
          technique_avoid: form.technique_avoid || null,
          focus_student_names: focusNames.length ? JSON.stringify(focusNames) : null,
          status: 'unread',
          created_at: new Date().toISOString(),
        }])
      }

      showToast('Log saved successfully ✓', C.green)
      setForm({ ...emptyForm })
      setStep(0)
      onSaved?.()
    } catch (e) {
      showToast('Unexpected error: ' + e.message, C.red)
    }
    setSaving(false)
    setConfirm(false)
  }

  return (
    <>
      <style>{css}</style>
      {toastEl}
      {confirm && (
        <ConfirmModal title="Save Teaching Log" msg={`Save log for ${form.subject_name} on ${form.teaching_date}?${form.needs_doubt_session ? ' HM will be notified instantly.' : ''}`} confirmLabel="Save Log" onConfirm={handleSave} onCancel={() => setConfirm(false)}/>
      )}

      <div style={S.card}>
        <StepBar current={step} steps={STEPS} onChange={setStep}/>

        {dupWarn && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, color:C.red, fontSize:13, marginBottom:14, fontWeight:600 }}>{dupWarn}</div>
        )}

        <ValidationMessage form={form} step={step}/>

        {step === 0 && <Step1CourseChapter form={form} setForm={setForm} courseData={courseData} chapters={chapters} loadingChapters={loadingChapters}/>}
        {step === 1 && <Step2WhatTaught form={form} setForm={setForm}/>}
        {step === 2 && <Step3Technique form={form} setForm={setForm}/>}
        {step === 3 && <Step4AIQuestions form={form} setForm={setForm}/>}
        {step === 4 && <Step5BulkQuestions form={form} setForm={setForm}/>}
        {step === 5 && <Step6HMAssign form={form} setForm={setForm} staff={staff} students={students} loadingStudents={loadingStudents}/>}
        {step === 6 && <StepReview form={form}/>}

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:16, borderTop:'1px solid #f1f5f9', flexWrap:'wrap', gap:10 }}>
          <button type="button" onClick={() => setStep(s => Math.max(0, s-1))} disabled={step === 0} style={{ ...S.btn('#94a3b8', step===0), background:'white', color: step===0?'#cbd5e1':'#374151', border:'1px solid #e2e8f0' }}>← Back</button>
          <div style={{ display:'flex', gap:8 }}>
            {(step === 3 || step === 4) && (
              <button type="button" onClick={() => setStep(s => s+1)} style={{ ...S.btn('#64748b'), background:'white', color:'#64748b', border:'1px solid #e2e8f0' }}>Skip →</button>
            )}
            {step < STEPS.length - 1
              ? <button type="button" onClick={handleNext} disabled={!canNext()} style={S.btn(C.navy, !canNext())}>Next →</button>
              : <button type="button" onClick={() => setConfirm(true)} disabled={saving} style={S.btn(C.green, saving)}>{saving ? '⏳ Saving...' : '✅ Save Log'}</button>
            }
          </div>
        </div>
      </div>
    </>
  )
}

export default EnhancedLogForm