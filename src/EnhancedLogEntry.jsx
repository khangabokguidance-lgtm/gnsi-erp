// EnhancedLogEntry.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Drop-in replacement for the Daily Logs tab form in Teaching.jsx
//
// NEW FEATURES:
//  STEP-1  Chapter selection (from syllabus_topics or free-text)
//  STEP-2  Sub-topic of chapter (filtered from DB or free-text)
//  STEP-3  Topic/Question range taught today (e.g. Q.1–Q.15 or page range)
//  STEP-4  Teaching technique (multi-select + detail field)
//  STEP-5  AI-generated chapter questions (Claude API, inline)
//  STEP-6  Bulk practice question upload (paste/type → saved to practice_questions)
//  STEP-7  HM assignment with structured doubt instructions
//  STEP-8  Instant Supabase notification insert on submit
//  STEP-9  HM doubt session shows subject teacher's instructions + weak students
//  STEP-10 Teacher can view/add quick doubt feedback per log
//
// DB TABLES USED:
//   teaching_logs         — existing
//   syllabus_topics       — { id, course, subject_name, chapter_name, subtopics[] }
//   practice_questions    — { id, log_id, batch_id, subject, chapter, subtopic, question_text, answer, difficulty, order_no }
//   hm_notifications      — { id, log_id, hm_staff_id, hm_name, message, instructions, status, created_at, read_at }
//   doubt_sessions        — existing (enhanced with teacher_instructions, weak_student_ids)
//   staff_profiles        — existing
//   students              — existing
//   student_scores        — existing
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useEffect, useMemo, useState, useCallback, useRef,
} from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II','English Grammar',
  'General Knowledge','General Science','Reasoning','Mental Ability',
  'Hindi','Vocabulary','Meitei Mayek',
]

const TEACHING_TECHNIQUES = [
  'Lecture / Direct Teaching',
  'Socratic Questioning',
  'Think-Pair-Share',
  'Problem-Solving on Board',
  'Visual / Diagram Method',
  'Group Discussion',
  'Quiz / Rapid Fire',
  'Story / Analogy Method',
  'Practice Drill',
  'Revision / Mind Map',
  'Activity Based Learning',
  'Audio-Visual / Video',
]

const DIFFICULTY = ['Easy','Medium','Hard']

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const PERIODS = [1,2,3,4,5,6,7]

const today = () => new Date().toISOString().split('T')[0]

const fmtDate = d => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' })
}

const pct = (s, m) => m > 0 ? Math.round((s / m) * 100) : 0
const scoreColor = p => p >= 75 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626'

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  navy:   '#1e3a5f',
  green:  '#16a34a',
  amber:  '#d97706',
  purple: '#7c3aed',
  red:    '#dc2626',
  sky:    '#0891b2',
}

const S = {
  card:   { background:'white', borderRadius:14, boxShadow:'0 2px 12px rgba(0,0,0,.08)', padding:22, marginBottom:16 },
  input:  { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44, fontFamily:'inherit' },
  select: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44, fontFamily:'inherit' },
  label:  { display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' },
  btn:    (color=C.navy, disabled=false) => ({ backgroundColor:disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontSize:13, minHeight:44, fontFamily:'inherit' }),
  btnSm:  (color=C.navy) => ({ backgroundColor:color, color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:36, fontFamily:'inherit' }),
  badge:  (c, bg) => ({ padding:'3px 9px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color:c, display:'inline-block' }),
  pill:   (c, bg) => ({ padding:'4px 10px', borderRadius:999, fontSize:12, fontWeight:600, background:bg, color:c, display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer', border:'none', fontFamily:'inherit' }),
  step:   (active, done) => ({
    display:'flex', flexDirection:'column', alignItems:'center', gap:3,
    flex:1, cursor:'pointer',
  }),
  stepDot: (active, done) => ({
    width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:13, fontWeight:800,
    background: done ? C.green : active ? C.navy : '#e2e8f0',
    color: done || active ? 'white' : '#94a3b8',
    transition:'all .2s',
  }),
  stepLine: (done) => ({ flex:1, height:2, background:done?C.green:'#e2e8f0', transition:'background .3s', marginTop:15 }),
  formGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 },
  tag: (active) => ({
    padding:'7px 13px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', fontFamily:'inherit',
    background: active ? C.navy : '#f1f5f9',
    color: active ? 'white' : '#374151',
    transition:'all .15s',
  }),
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.5} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes slideUp{ from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
  * { box-sizing:border-box }
  select,input,textarea { font-family:'Outfit',system-ui,sans-serif }
  select:focus,input:focus,textarea:focus { outline:2px solid #1e3a5f; outline-offset:1px }
  ::-webkit-scrollbar { width:4px; height:4px }
  ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px }
  .elog-fade { animation:fadeIn .25s ease both }
  .elog-spin { animation:spin 1s linear infinite }
  @media (max-width:640px) {
    .form-grid { grid-template-columns:1fr !important }
  }
  @media print { .no-print { display:none !important } }
`

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, color=C.navy, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      zIndex:999999, background:'white', border:`1px solid ${color}`,
      borderLeft:`4px solid ${color}`, borderRadius:10,
      padding:'12px 20px', fontSize:13, fontWeight:600,
      boxShadow:'0 8px 32px rgba(0,0,0,.18)', maxWidth:'92vw',
      color:'#1e293b', display:'flex', alignItems:'center', gap:10,
      animation:'slideUp .2s ease', whiteSpace:'pre-wrap',
    }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
      {msg}
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

function ConfirmModal({ title, msg, confirmLabel='Confirm', danger=false, onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onCancel}>
      <div style={{ background:'white', borderRadius:14, padding:28, width:380, maxWidth:'94vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:24, lineHeight:1.7 }}>{msg}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onConfirm} style={S.btn(danger ? C.red : C.navy)}>{confirmLabel}</button>
          <button onClick={onCancel}  style={{ ...S.btn('#64748b'), background:'white', color:'#64748b', border:'1px solid #e2e8f0' }}>Cancel</button>
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
          <div style={S.step(current===i, current>i)} onClick={() => current > i && onChange(i)}>
            <div style={S.stepDot(current===i, current>i)}>
              {current > i ? '✓' : i+1}
            </div>
            <span style={{ fontSize:10, fontWeight:700, color:current===i?C.navy:current>i?C.green:'#94a3b8', textAlign:'center', maxWidth:64, lineHeight:1.3 }}>{s.label}</span>
          </div>
          {i < steps.length-1 && <div style={S.stepLine(current>i)}/>}
        </React.Fragment>
      ))}
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
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      model:'claude-sonnet-4-20250514',
      max_tokens:1000,
      messages:[{ role:'user', content:prompt }],
    }),
  })
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  // Parse Q1./ANS: pairs
  const lines = text.split('\n').filter(l => l.trim())
  const questions = []
  let cur = null
  lines.forEach(l => {
    if (/^Q\d+\./i.test(l.trim())) {
      if (cur) questions.push(cur)
      cur = { q: l.replace(/^Q\d+\.\s*/i,'').trim(), ans:'' }
    } else if (/^ANS:/i.test(l.trim()) && cur) {
      cur.ans = l.replace(/^ANS:\s*/i,'').trim()
    }
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
    // Detect question start: Q1. / 1. / Q1) / 1) / (1)
    const qMatch = l.match(/^(?:Q\.?\s*)?(\d+)[.)]\s+(.+)/i)
      || l.match(/^\((\d+)\)\s+(.+)/)
    if (qMatch) {
      if (cur) qs.push(cur)
      cur = { order_no: parseInt(qMatch[1]), question_text: qMatch[2], answer:'', difficulty:'Medium', options:[] }
    } else if (cur) {
      // Option line: a) / (a) / A.
      const optMatch = l.match(/^[(\[]?([A-Da-d])[.):\]]\s+(.+)/)
      if (optMatch) {
        cur.options.push({ key: optMatch[1].toUpperCase(), text: optMatch[2] })
      } else if (/^Ans(?:wer)?[:.]?\s*/i.test(l)) {
        cur.answer = l.replace(/^Ans(?:wer)?[:.]?\s*/i,'').trim()
      } else if (cur.question_text) {
        // continuation of question
        cur.question_text += ' ' + l
      }
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
          <label style={S.label}>Course *</label>
          <select value={form.course} onChange={e => handleCourse(e.target.value)} required style={S.select}>
            <option value="">Select Course</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {/* Subtype */}
        <div>
          <label style={S.label}>Batch / Subtype *</label>
          <select value={form.subtype} onChange={e => handleSubtype(e.target.value)} disabled={!form.course} required style={{ ...S.select, opacity:form.course?1:.5 }}>
            <option value="">Select Subtype</option>
            {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Class */}
        <div>
          <label style={S.label}>Class {form.batch_id && <span style={{ color:C.green, marginLeft:4, fontSize:10 }}>✓ linked</span>}</label>
          {classes.length > 0
            ? <select value={form.class_name} onChange={e => handleClass(e.target.value)} disabled={!form.subtype} style={{ ...S.select, opacity:form.subtype?1:.5 }}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            : <input value={form.class_name} onChange={e => handleClass(e.target.value)} placeholder="e.g. Class 6" disabled={!form.subtype} style={{ ...S.input, opacity:form.subtype?1:.5 }}/>
          }
        </div>
        {/* Subject */}
        <div>
          <label style={S.label}>Subject *</label>
          <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name:e.target.value, chapter:'', subtopic:'' }))} required style={S.select}>
            <option value="">Select Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Date */}
        <div>
          <label style={S.label}>Teaching Date *</label>
          <input type="date" value={form.teaching_date} onChange={e => setForm(f => ({ ...f, teaching_date:e.target.value }))} required style={S.input}/>
        </div>
        {/* Period */}
        <div>
          <label style={S.label}>Period (optional)</label>
          <select value={form.period_number} onChange={e => setForm(f => ({ ...f, period_number:e.target.value }))} style={S.select}>
            <option value="">No Period</option>
            {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
          </select>
        </div>
      </div>

      {/* Chapter */}
      <div style={{ marginTop:16 }}>
        <label style={S.label}>Chapter *</label>
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
            placeholder="Type chapter name..." style={{ ...S.input, marginTop: filteredChapters.length?8:0 }}/>
        )}
      </div>

      {/* Sub-topic */}
      <div style={{ marginTop:14 }}>
        <label style={S.label}>Sub-topic / Lesson *</label>
        {subtopicsOfChapter.length > 0
          ? <select value={form.subtopic} onChange={e => setForm(f => ({ ...f, subtopic:e.target.value }))} style={S.select}>
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
            placeholder="e.g. Properties of triangles, Number system basics..." style={{ ...S.input, marginTop: subtopicsOfChapter.length?8:0 }}/>
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
          <label style={S.label}>Covered From (Q.No / Page / Topic)</label>
          <input value={form.range_from} onChange={e => setForm(f => ({ ...f, range_from:e.target.value }))} placeholder="e.g. Q.1, Page 23, Section 2.1" style={S.input}/>
        </div>
        <div>
          <label style={S.label}>Covered To</label>
          <input value={form.range_to} onChange={e => setForm(f => ({ ...f, range_to:e.target.value }))} placeholder="e.g. Q.15, Page 30, Section 2.4" style={S.input}/>
        </div>
      </div>

      {/* Topic taught */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Topic Taught (summary) *</label>
        <input value={form.topic_taught} onChange={e => setForm(f => ({ ...f, topic_taught:e.target.value }))} required placeholder="Brief description of what was covered today..." style={S.input}/>
      </div>

      {/* Classwork */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Classwork done</label>
        <textarea value={form.classwork} onChange={e => setForm(f => ({ ...f, classwork:e.target.value }))} rows={3} style={{ ...S.input, resize:'vertical' }} placeholder="What exercises or work was done in class?"/>
      </div>

      {/* Homework */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Homework assigned</label>
        <textarea value={form.homework} onChange={e => setForm(f => ({ ...f, homework:e.target.value }))} rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Questions/exercises assigned for home"/>
      </div>

      {/* Remarks */}
      <div>
        <label style={S.label}>Remarks / Observations</label>
        <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks:e.target.value }))} rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Student response, pace, anything notable"/>
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

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Technique Details *</label>
        <textarea
          value={form.technique_detail}
          onChange={e => setForm(f => ({ ...f, technique_detail:e.target.value }))}
          required
          rows={4}
          style={{ ...S.input, resize:'vertical' }}
          placeholder={`Describe in detail HOW you taught this topic.\n\nExample: "Used the number line to show negative integers. Drew diagram on board. Asked 5 rapid-fire questions. Worked Q.1–Q.8 together. Weaker students were asked to repeat steps aloud."`}
        />
        <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
          The HM will follow these exact instructions during the doubt session.
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Key Concepts to Emphasise (for HM)</label>
        <textarea
          value={form.key_concepts}
          onChange={e => setForm(f => ({ ...f, key_concepts:e.target.value }))}
          rows={2}
          style={{ ...S.input, resize:'vertical' }}
          placeholder="e.g. Always draw the diagram first. Common mistake: forgetting sign rules. Focus on Q.5 and Q.9 which students found hardest."
        />
      </div>

      <div>
        <label style={S.label}>Do NOT do this during doubt session</label>
        <textarea
          value={form.technique_avoid}
          onChange={e => setForm(f => ({ ...f, technique_avoid:e.target.value }))}
          rows={2}
          style={{ ...S.input, resize:'vertical' }}
          placeholder="e.g. Do NOT jump to answers directly. Make students attempt first. Don't skip the diagram step."
        />
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
    if (!chapterDisplay || !form.subject_name) {
      setError('Please fill Chapter and Subject in Step 1 first.')
      return
    }
    setLoading(true); setError('')
    try {
      const qs = await generateAIQuestions(chapterDisplay, subtopicDisplay, form.subject_name, count)
      if (!qs.length) { setError('No questions generated. Try again.'); setLoading(false); return }
      setQuestions(qs)
      setForm(f => ({ ...f, ai_questions: qs }))
    } catch(e) {
      setError('Generation failed: ' + e.message)
    }
    setLoading(false)
  }

  const toggleKeep = i => {
    const updated = questions.map((q, j) => j===i ? { ...q, kept: !q.kept } : q)
    setQuestions(updated)
    setForm(f => ({ ...f, ai_questions: updated }))
  }

  const editQ = (i, field, val) => {
    const updated = questions.map((q, j) => j===i ? { ...q, [field]: val } : q)
    setQuestions(updated)
    setForm(f => ({ ...f, ai_questions: updated }))
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'14px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:'#166534', fontSize:13, marginBottom:4 }}>🤖 AI Question Generator</div>
        <div style={{ fontSize:12, color:'#16a34a', lineHeight:1.6 }}>
          Generate genuine conceptual questions based on the chapter/subtopic taught. These will be shown to HMs so they can quiz students during doubt sessions.
        </div>
      </div>

      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <span style={{ fontSize:13, color:'#374151' }}>Generate</span>
        <select value={count} onChange={e => setCount(Number(e.target.value))} style={{ ...S.select, width:80 }}>
          {[3,5,8,10].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize:13, color:'#374151' }}>questions about</span>
        <span style={{ fontWeight:700, color:C.navy, fontSize:13 }}>
          {(form.chapter==='__other__' ? form.chapter_custom : form.chapter) || '(no chapter set)'} —{' '}
          {form.subject_name || '(no subject)'}
        </span>
        <button type="button" onClick={generate} disabled={loading} style={S.btn(C.purple, loading)}>
          {loading
            ? <><span className="elog-spin" style={{ display:'inline-block', marginRight:6 }}>⏳</span>Generating...</>
            : '✨ Generate Questions'}
        </button>
      </div>

      {error && <div style={{ color:C.red, fontSize:13, marginBottom:12, padding:'8px 12px', background:'#fee2e2', borderRadius:8 }}>{error}</div>}

      {questions.length > 0 && (
        <>
          <div style={{ fontSize:12, color:'#64748b', marginBottom:10 }}>
            Click questions to keep/discard for doubt session use. Edit text if needed.
          </div>
          {questions.map((q, i) => (
            <div key={i} style={{
              border:`2px solid ${q.kept ? C.green : '#e2e8f0'}`,
              borderRadius:10, padding:14, marginBottom:10,
              background: q.kept ? '#f0fdf4' : 'white',
              transition:'all .15s',
            }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <button type="button" onClick={() => toggleKeep(i)} style={{
                  ...S.btnSm(q.kept ? C.green : '#94a3b8'), flexShrink:0, padding:'4px 10px'
                }}>
                  {q.kept ? '✓ Keep' : '○ Keep'}
                </button>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:'#1e293b', fontSize:12, marginBottom:4 }}>Q{i+1}.</div>
                  <textarea value={q.q} onChange={e => editQ(i,'q',e.target.value)} style={{ ...S.input, fontSize:13, padding:'8px 10px', marginBottom:8, minHeight:60 }}/>
                  {q.ans && (
                    <div style={{ fontSize:12, color:'#64748b' }}>
                      <span style={{ fontWeight:700, color:'#374151' }}>Hint: </span>
                      <input value={q.ans} onChange={e => editQ(i,'ans',e.target.value)} style={{ ...S.input, display:'inline', width:'auto', fontSize:12, padding:'4px 8px', minHeight:32 }}/>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div style={{ fontSize:12, color:'#94a3b8' }}>
            {questions.filter(q=>q.kept).length} / {questions.length} questions marked for doubt session
          </div>
        </>
      )}

      {!questions.length && !loading && (
        <div style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✨</div>
          <div style={{ fontSize:13 }}>Click "Generate Questions" to create AI-powered questions for this chapter.</div>
        </div>
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
    setParseError('')
    setParsed(qs)
    setForm(f => ({ ...f, practice_questions: qs }))
  }

  const updateQ = (i, field, val) => {
    const updated = parsed.map((q, j) => j===i ? { ...q, [field]: val } : q)
    setParsed(updated)
    setForm(f => ({ ...f, practice_questions: updated }))
  }

  const removeQ = i => {
    const updated = parsed.filter((_,j) => j!==i)
    setParsed(updated)
    setForm(f => ({ ...f, practice_questions: updated }))
  }

  const addBlank = () => {
    const updated = [...parsed, { order_no: parsed.length+1, question_text:'', answer:'', difficulty:'Medium', options:[] }]
    setParsed(updated)
    setForm(f => ({ ...f, practice_questions: updated }))
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'12px 16px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:'#854d0e', fontSize:13, marginBottom:3 }}>📋 Practice Question Bank</div>
        <div style={{ fontSize:12, color:'#a16207', lineHeight:1.6 }}>
          Upload practice questions for <b>{chapterDisplay || 'this chapter'}</b>. Paste from PDF/textbook or type manually.
          They will be saved to the question bank and linked to this log.
        </div>
      </div>

      {/* Paste area */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Paste Questions Here (from PDF / book)</label>
        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          rows={8}
          style={{ ...S.input, fontFamily:"'JetBrains Mono',monospace", fontSize:12, resize:'vertical' }}
          placeholder={`Example format — paste any of these:\n\n1. What is the Pythagorean theorem?\nAns: a²+b²=c²\n\nQ2. If a right triangle has legs 3 and 4, find the hypotenuse.\nAns: 5\n   a) 5   b) 7   c) 6   d) 4`}
        />
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button type="button" onClick={handleParse} style={S.btn(C.amber)}>
            🔍 Parse Questions ({raw.split('\n').filter(l=>/^\s*(?:Q\.?\s*)?\d+[.)]/i.test(l)||/^\s*\(\d+\)/i.test(l)).length} detected)
          </button>
          {parseError && <span style={{ fontSize:12, color:C.red, alignSelf:'center' }}>{parseError}</span>}
        </div>
      </div>

      {/* Parsed questions */}
      {parsed.length > 0 && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontWeight:700, color:'#1e293b', fontSize:14 }}>
              {parsed.length} Question{parsed.length!==1?'s':''} Ready to Save
            </div>
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
                  {q.options.length > 0 && (
                    <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                      {q.options.map((o,j) => (
                        <span key={j} style={S.badge('#374151','#f1f5f9')}>{o.key}) {o.text}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => removeQ(i)} style={{ ...S.btnSm(C.red), padding:'4px 8px', flexShrink:0 }}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}

      {!parsed.length && !raw && (
        <button type="button" onClick={addBlank} style={S.btn(C.sky)}>+ Add Question Manually</button>
      )}
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

  const weakStudents = useMemo(() => {
    // We'll pre-identify from student_scores; for now use passed prop
    return form.weak_students || []
  }, [form.weak_students])

  const toggleWeak = id => {
    const cur = form.focus_student_ids || []
    const next = cur.includes(id) ? cur.filter(x => x!==id) : [...cur, id]
    setForm(f => ({ ...f, focus_student_ids: next }))
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'12px 16px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:C.navy, fontSize:13, marginBottom:3 }}>🏠 Housem aster Notification</div>
        <div style={{ fontSize:12, color:'#3b82f6', lineHeight:1.6 }}>
          Assign a HM for the doubt session. They will receive instant notification with your teaching instructions.
          HM must follow ONLY what you specify here.
        </div>
      </div>

      <div style={{ marginBottom:16 }}>
        <label style={S.label}>Needs Doubt Session?</label>
        <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'12px 14px', borderRadius:8, background:form.needs_doubt_session?'#fef9c3':'#f8fafc', border:`1px solid ${form.needs_doubt_session?'#fde68a':'#e2e8f0'}`, minHeight:48 }}>
          <input type="checkbox" checked={form.needs_doubt_session||false}
            onChange={e => setForm(f => ({ ...f, needs_doubt_session:e.target.checked }))}
            style={{ width:18, height:18, cursor:'pointer' }}/>
          <span style={{ fontWeight:700, fontSize:14, color:form.needs_doubt_session?'#b45309':'#374151' }}>
            🔁 Yes — Assign HM for Doubt Session
          </span>
        </label>
      </div>

      {form.needs_doubt_session && (
        <>
          {/* HM picker */}
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Assign Housemaster / Warden *</label>
            {hmStaff.length > 0
              ? <select value={form.assigned_hm_id||''} onChange={e => {
                  const s = hmStaff.find(x => x.id===e.target.value)
                  setForm(f => ({ ...f, assigned_hm_id:e.target.value, assigned_hm_name:s?.name||'' }))
                }} required style={S.select}>
                  <option value="">Select HM/Warden</option>
                  {hmStaff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.designation||'HM'})</option>)}
                </select>
              : <input value={form.assigned_hm_name||''}
                  onChange={e => setForm(f => ({ ...f, assigned_hm_name:e.target.value }))}
                  placeholder="Type HM name (no HM found in DB)..." style={S.input}/>
            }
          </div>

          {/* Doubt session timing */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={S.label}>Preferred Date for Doubt Session</label>
              <input type="date" value={form.doubt_date||''} onChange={e => setForm(f => ({ ...f, doubt_date:e.target.value }))} style={S.input}/>
            </div>
            <div>
              <label style={S.label}>Preferred Time Slot</label>
              <input value={form.doubt_time_slot||''} onChange={e => setForm(f => ({ ...f, doubt_time_slot:e.target.value }))} placeholder="e.g. 6:30–7:20 AM, After dinner" style={S.input}/>
            </div>
          </div>

          {/* HM instruction message */}
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Instruction Message to HM *</label>
            <textarea
              value={form.hm_instruction_message||''}
              onChange={e => setForm(f => ({ ...f, hm_instruction_message:e.target.value }))}
              required={form.needs_doubt_session}
              rows={4}
              style={{ ...S.input, resize:'vertical' }}
              placeholder={`Write specific instructions for the HM:\n\n"Focus on Q.5–Q.9 where students struggled. Make them draw the diagram first before attempting. Use the number line technique I showed. Do NOT give direct answers — make them think."`}
            />
          </div>

          {/* Weak students to focus on */}
          {batchStudents.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Focus Students (mark who needs extra attention)</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:12, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8 }}>
                {batchStudents.map(s => {
                  const focused = (form.focus_student_ids||[]).includes(s.id)
                  const isWeak = weakStudents.some(w => w.student_id===s.id)
                  return (
                    <button key={s.id} type="button" onClick={() => toggleWeak(s.id)} style={{
                      ...S.pill(focused?'white':isWeak?C.red:'#374151', focused?C.navy:isWeak?'#fee2e2':'#f1f5f9'),
                      border: focused?`2px solid ${C.navy}`:'2px solid transparent',
                      transition:'all .15s',
                    }}>
                      {focused ? '✓ ' : isWeak ? '⚠️ ' : ''}{s.name}
                      {isWeak && !focused && <span style={{ fontSize:10, marginLeft:2 }}>({weakStudents.find(w=>w.student_id===s.id)?.avg_score}%)</span>}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
                ⚠️ = Students with avg score below 60% in this subject. Click to mark for HM focus.
              </div>
            </div>
          )}

          {/* Summary preview */}
          {(form.assigned_hm_name || form.assigned_hm_id) && (
            <div style={{ padding:'14px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, marginTop:8 }}>
              <div style={{ fontWeight:700, color:'#166534', fontSize:13, marginBottom:8 }}>📨 Notification Preview</div>
              <div style={{ fontSize:13, color:'#374151', lineHeight:1.8 }}>
                <b>To:</b> {form.assigned_hm_name || 'HM'}<br/>
                <b>Subject:</b> Doubt session needed — {form.subject_name} | {form.chapter==='__other__'?form.chapter_custom:form.chapter}<br/>
                <b>Taught by:</b> {form.teacher_name || 'Subject Teacher'} on {form.teaching_date}<br/>
                {form.doubt_date && <><b>Session by:</b> {fmtDate(form.doubt_date)} {form.doubt_time_slot || ''}<br/></>}
                {form.hm_instruction_message && <><b>Instructions:</b> {form.hm_instruction_message.slice(0,120)}{form.hm_instruction_message.length>120?'...':''}</>}
              </div>
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
    ['Chapter', chapterDisplay||'—'],
    ['Sub-topic', subtopicDisplay||'—'],
    ['Range', form.range_from ? `${form.range_from} → ${form.range_to||'end'}` : '—'],
    ['Topic Taught', form.topic_taught||'—'],
    ['Techniques', (form.techniques||[]).join(', ')||'—'],
    ['AI Questions', (form.ai_questions||[]).filter(q=>q.kept).length + ' kept'],
    ['Practice Qs', (form.practice_questions||[]).length + ' questions'],
    ['HM Assigned', form.needs_doubt_session ? (form.assigned_hm_name||'Not set') : 'No doubt session'],
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
      {form.hm_instruction_message && form.needs_doubt_session && (
        <div style={{ marginTop:16, padding:'12px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#b45309', marginBottom:4 }}>HM INSTRUCTIONS:</div>
          <div style={{ fontSize:13, color:'#374151', lineHeight:1.7 }}>{form.hm_instruction_message}</div>
        </div>
      )}
    </div>
  )
}

// ─── HM Doubt Session Panel ───────────────────────────────────────────────────
// Used inside the HM Dashboard tab to show structured instructions

export function HMDoubtSessionPanel({ session, onFeedback, currentUser }) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [showStudents, setShowStudents] = useState(false)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const { show: showToast, el: toastEl } = useToast()

  const fetchStudents = async () => {
    if (!session.batch_id && !session.subtype) return
    setLoadingStudents(true)
    const q = supabase.from('students').select('id,name,roll_number').eq('status','Active')
    if (session.batch_id) q.eq('batch_id', session.batch_id)
    const { data } = await q.order('name')
    if (data) setStudents(data)
    setLoadingStudents(false)
  }

  const handleFeedback = async () => {
    if (!note.trim()) { showToast('Enter feedback/resolution note', C.amber); return }
    setSending(true)
    const { error } = await supabase.from('doubt_sessions').update({
      status:'resolved',
      resolved_by: currentUser?.name || 'HM',
      resolved_at: new Date().toISOString(),
      resolution_note: note,
    }).eq('id', session.id)
    if (error) showToast('Error: ' + error.message, C.red)
    else { showToast('Doubt session resolved ✓', C.green); onFeedback?.() }
    setSending(false)
  }

  // Notify teacher of student doubts
  const notifyTeacher = async (studentName, doubtDetail) => {
    const msg = `🏠 HM Update from ${currentUser?.name||'HM'}: Student "${studentName}" — ${doubtDetail}`
    await supabase.from('hm_notifications').insert([{
      log_id: session.log_id,
      hm_staff_id: currentUser?.id || null,
      hm_name: currentUser?.name || 'HM',
      message: msg,
      status: 'teacher_alert',
      created_at: new Date().toISOString(),
    }])
    showToast('Teacher notified ✓', C.green)
  }

  return (
    <>
      {toastEl}
      <div style={{ border:'2px solid #fde68a', borderRadius:14, padding:20, background:'#fffbeb', marginBottom:12 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#1e293b' }}>
              🏠 {session.house_name||session.batch_name||'—'} · {session.subject_name}
            </div>
            <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>
              📖 {session.topic} · {fmtDate(session.teaching_date)}
            </div>
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:1 }}>
              Teacher: {session.teacher_name||'—'}
            </div>
          </div>
          <span style={S.badge('#b45309','#fef9c3')}>⏳ Open</span>
        </div>

        {/* Teacher instructions */}
        {session.teacher_instructions && (
          <div style={{ padding:'12px 14px', background:'#1e3a5f', borderRadius:10, marginBottom:14, color:'white' }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#93c5fd', marginBottom:6, letterSpacing:'.08em' }}>📋 SUBJECT TEACHER'S INSTRUCTIONS</div>
            <div style={{ fontSize:13, lineHeight:1.8, color:'#e2e8f0' }}>{session.teacher_instructions}</div>
          </div>
        )}

        {/* Key concepts */}
        {session.key_concepts && (
          <div style={{ padding:'10px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#166534', marginBottom:4 }}>✅ KEY CONCEPTS TO EMPHASISE</div>
            <div style={{ fontSize:13, color:'#374151', lineHeight:1.7 }}>{session.key_concepts}</div>
          </div>
        )}

        {/* Avoid */}
        {session.technique_avoid && (
          <div style={{ padding:'10px 14px', background:'#fff1f2', border:'1px solid #fecaca', borderRadius:8, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', marginBottom:4 }}>🚫 DO NOT DO THIS</div>
            <div style={{ fontSize:13, color:'#374151', lineHeight:1.7 }}>{session.technique_avoid}</div>
          </div>
        )}

        {/* AI questions for HM to use */}
        {session.ai_questions_for_hm && (() => {
          try {
            const qs = JSON.parse(session.ai_questions_for_hm).filter(q => q.kept)
            if (!qs.length) return null
            return (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>❓ QUESTIONS TO ASK STUDENTS</div>
                {qs.map((q,i) => (
                  <div key={i} style={{ padding:'8px 12px', background:'white', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:5 }}>
                    <div style={{ fontSize:13, color:'#1e293b' }}>Q{i+1}. {q.q}</div>
                    {q.ans && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Hint: {q.ans}</div>}
                  </div>
                ))}
              </div>
            )
          } catch { return null }
        })()}

        {/* Focus students */}
        {session.focus_student_names && (() => {
          try {
            const names = JSON.parse(session.focus_student_names)
            if (!names.length) return null
            return (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#b45309', marginBottom:6 }}>⚠️ FOCUS ON THESE STUDENTS</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {names.map((n,i) => <span key={i} style={S.badge('#b45309','#fef9c3')}>{n}</span>)}
                </div>
              </div>
            )
          } catch { return null }
        })()}

        {/* Notify teacher button */}
        <div style={{ marginBottom:12 }}>
          <button type="button" onClick={() => {
            const detail = window.prompt('Enter student doubt to notify teacher:')
            if (detail) notifyTeacher('(student)', detail)
          }} style={{ ...S.btnSm(C.sky), marginRight:8 }}>
            📨 Notify Teacher of Doubt
          </button>
          <button type="button" onClick={() => { setShowStudents(!showStudents); if (!students.length) fetchStudents() }} style={S.btnSm('#94a3b8')}>
            👥 {showStudents ? 'Hide' : 'View'} Batch Students
          </button>
        </div>

        {showStudents && (
          <div style={{ marginBottom:12, padding:10, background:'white', borderRadius:8, border:'1px solid #e2e8f0' }}>
            {loadingStudents ? <div style={{ fontSize:12, color:'#94a3b8' }}>Loading...</div> :
              students.length === 0 ? <div style={{ fontSize:12, color:'#94a3b8' }}>No students found for this batch.</div> :
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {students.map(s => (
                  <button key={s.id} type="button" onClick={() => notifyTeacher(s.name, window.prompt(`Enter doubt/issue for ${s.name}:`) || '')}
                    style={S.pill('#1e293b','#f1f5f9')}>
                    {s.name}
                  </button>
                ))}
              </div>
            }
          </div>
        )}

        {/* Resolution form */}
        <div style={{ borderTop:'1px solid #fde68a', paddingTop:14 }}>
          <label style={S.label}>Resolution Note (what was done in the doubt session)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            style={{ ...S.input, marginBottom:10, resize:'vertical' }}
            placeholder="Describe what you covered in the doubt session, which students were helped, what methods you used..."/>
          <button type="button" onClick={handleFeedback} disabled={sending} style={S.btn(C.green, sending)}>
            {sending ? '⏳ Saving...' : '✅ Mark Resolved & Notify Teacher'}
          </button>
        </div>
      </div>
    </>
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
  // Course
  course:'', subtype:'', class_name:'', batch_id:'',
  // Chapter
  subject_name:'', chapter:'', chapter_custom:'', subtopic:'', subtopic_custom:'',
  // Taught
  teaching_date: today(), period_number:'', teacher_name:'', staff_id:'',
  range_from:'', range_to:'', topic_taught:'', classwork:'', homework:'', remarks:'',
  // Technique
  techniques:[], technique_detail:'', key_concepts:'', technique_avoid:'',
  // AI
  ai_questions:[],
  // Practice Qs
  practice_questions:[],
  // HM
  needs_doubt_session:false, assigned_hm_id:'', assigned_hm_name:'',
  doubt_date:'', doubt_time_slot:'',
  hm_instruction_message:'', focus_student_ids:[], weak_students:[],
}

export function EnhancedLogForm({ onSaved, courseData, staff, currentUser, logs }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ ...emptyForm, teaching_date: today() })
  const [saving, setSaving] = useState(false)
  const [chapters, setChapters] = useState([])
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [dupWarn, setDupWarn] = useState('')
  const { show: showToast, el: toastEl } = useToast()

  // Set teacher from currentUser
  useEffect(() => {
    if (currentUser?.name && !form.teacher_name) {
      const s = staff.find(x => x.name === currentUser.name)
      setForm(f => ({ ...f, teacher_name: currentUser.name, staff_id: s?.id || '' }))
    }
  }, [currentUser, staff])

  // Load chapters when subject changes
  useEffect(() => {
    if (!form.subject_name) return
    setLoadingChapters(true)
    supabase.from('syllabus_topics').select('*').eq('subject_name', form.subject_name)
      .order('chapter_name')
      .then(({ data }) => { setChapters(data || []); setLoadingChapters(false) })
  }, [form.subject_name])

  // Load students when batch changes
  useEffect(() => {
    if (!form.batch_id) return
    setLoadingStudents(true)
    supabase.from('students').select('id,name,roll_number,house').eq('batch_id', form.batch_id).eq('status','Active').order('name')
      .then(async ({ data: studs }) => {
        if (!studs?.length) { setStudents([]); setLoadingStudents(false); return }
        // Get their scores for weak detection
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

  // Duplicate check
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

  const canNext = () => {
    if (step === 0) return form.course && form.subtype && form.subject_name && (form.chapter || form.chapter_custom)
    if (step === 1) return form.topic_taught
    if (step === 2) return form.technique_detail
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

      // 1. Save teaching log
      const logPayload = {
        course: form.course, subtype: form.subtype || null, class_name: form.class_name || null,
        batch_id: form.batch_id || null, subject_name: form.subject_name,
        teacher_name: form.teacher_name || null, staff_id: form.staff_id || null,
        teaching_date: form.teaching_date, topic_taught: form.topic_taught,
        classwork: form.classwork || null, homework: form.homework || null,
        remarks: form.remarks || null, period_number: form.period_number || null,
        needs_doubt_session: form.needs_doubt_session || false,
        // Extended fields
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

      // 2. Save practice questions
      if ((form.practice_questions || []).length) {
        const pqs = form.practice_questions.map((q, i) => ({
          log_id: logId, batch_id: form.batch_id || null,
          course: form.course, subject_name: form.subject_name,
          chapter: chapterFinal || null, subtopic: subtopicFinal || null,
          question_text: q.question_text, answer: q.answer || null,
          difficulty: q.difficulty || 'Medium', order_no: q.order_no || i+1,
          options: q.options?.length ? JSON.stringify(q.options) : null,
        }))
        const { error: pqErr } = await supabase.from('practice_questions').insert(pqs)
        if (pqErr) showToast('Practice questions partial save: ' + pqErr.message, C.amber)
      }

      // 3. Save HM notification + doubt session
      if (form.needs_doubt_session && (form.assigned_hm_id || form.assigned_hm_name)) {
        const aiQsForHm = (form.ai_questions || []).filter(q => q.kept)
        const focusNames = students.filter(s => (form.focus_student_ids||[]).includes(s.id)).map(s => s.name)

        // doubt_sessions row (enhanced)
        // Column mapping against confirmed schema:
        //   subject_name  ✓ exists   | batch_name ✓ exists  | staff_name ✓ exists
        //   teacher_name  ✓ exists   | teacher_staff_id ✓ bigint
        //   batch_id      → added by migration (uuid)
        //   is_read       → added by migration
        //   teacher_instructions / key_concepts / technique_avoid / ai_questions_for_hm
        //   focus_student_ids / focus_student_names / doubt_date / doubt_time_slot
        //   → all added by migration
        const buildDsRow = (house) => ({
          // ── original columns ──────────────────────────────────────────
          log_id:           logId,
          course:           form.course,
          subtype:          form.subtype          || null,
          class_name:       form.class_name       || null,
          subject_name:     form.subject_name,
          topic:            form.topic_taught,
          teaching_date:    form.teaching_date,
          teacher_name:     form.teacher_name     || null,
          // teacher_staff_id is bigint in doubt_sessions — cast only if numeric
          teacher_staff_id: form.staff_id && /^\d+$/.test(String(form.staff_id))
            ? Number(form.staff_id)
            : null,
          house_name:       house                 || null,
          hm_id:            form.assigned_hm_id   || null,
          hm_name:          form.assigned_hm_name || null,
          status:           'open',
          // original legacy columns still present in the table
          batch_name:       form.subtype          || null,
          staff_name:       form.teacher_name     || null,
          student_name:     null,   // filled by student-raised flows, not teacher
          // ── new columns added by migration ───────────────────────────
          is_read:               false,
          batch_id:              form.batch_id             || null,
          teacher_instructions:  form.hm_instruction_message || null,
          key_concepts:          form.key_concepts          || null,
          technique_avoid:       form.technique_avoid       || null,
          ai_questions_for_hm:   aiQsForHm.length ? JSON.stringify(aiQsForHm) : null,
          focus_student_ids:     form.focus_student_ids?.length ? JSON.stringify(form.focus_student_ids) : null,
          focus_student_names:   focusNames.length ? JSON.stringify(focusNames) : null,
          doubt_date:            form.doubt_date            || null,
          doubt_time_slot:       form.doubt_time_slot       || null,
        })

        const houses = [...new Set(students.map(s => s.house).filter(Boolean))]
        const dsRows = houses.length
          ? houses.map(house => buildDsRow(house))
          : [buildDsRow(null)]

        const { error: dsErr } = await supabase.from('doubt_sessions').insert(dsRows)
        if (dsErr) showToast('Doubt sessions: ' + dsErr.message, C.amber)

        // hm_notifications row (instant notify)
        const notifPayload = {
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
        }
        const { error: notifErr } = await supabase.from('hm_notifications').insert([notifPayload])
        if (notifErr) showToast('HM notification: ' + notifErr.message, C.amber)

        // Also insert into admin_alerts
        await supabase.from('admin_alerts').insert([{
          alert_type: 'doubt_needed',
          course: form.course, subtype: form.subtype || '',
          subject_name: form.subject_name,
          teacher_name: form.teacher_name || '',
          message: `Doubt session assigned to ${form.assigned_hm_name} for ${form.subject_name} (${form.subtype||form.course}) — ${chapterFinal}`,
          severity: 'medium', is_read: false,
        }]).then(()=>{}).catch(()=>{})
      }

      showToast('Log saved successfully ✓', C.green)
      setForm({ ...emptyForm, teaching_date: today() })
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
        <ConfirmModal
          title="Save Teaching Log"
          msg={`Save log for ${form.subject_name} on ${form.teaching_date}?${form.needs_doubt_session ? ' HM will be notified instantly.' : ''}`}
          confirmLabel="Save Log"
          onConfirm={handleSave}
          onCancel={() => setConfirm(false)}
        />
      )}

      <div style={S.card}>
        <StepBar current={step} steps={STEPS} onChange={setStep}/>

        {dupWarn && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, color:C.red, fontSize:13, marginBottom:14, fontWeight:600 }}>
            {dupWarn}
          </div>
        )}

        {/* Step content */}
        {step === 0 && <Step1CourseChapter form={form} setForm={setForm} courseData={courseData} chapters={chapters} loadingChapters={loadingChapters}/>}
        {step === 1 && <Step2WhatTaught form={form} setForm={setForm}/>}
        {step === 2 && <Step3Technique form={form} setForm={setForm}/>}
        {step === 3 && <Step4AIQuestions form={form} setForm={setForm}/>}
        {step === 4 && <Step5BulkQuestions form={form} setForm={setForm}/>}
        {step === 5 && <Step6HMAssign form={form} setForm={setForm} staff={staff} students={students} loadingStudents={loadingStudents}/>}
        {step === 6 && <StepReview form={form}/>}

        {/* Navigation */}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:16, borderTop:'1px solid #f1f5f9', flexWrap:'wrap', gap:10 }}>
          <button type="button" onClick={() => setStep(s => Math.max(0, s-1))} disabled={step === 0} style={{ ...S.btn('#94a3b8', step===0), background:'white', color: step===0?'#cbd5e1':'#374151', border:'1px solid #e2e8f0' }}>
            ← Back
          </button>
          <div style={{ display:'flex', gap:8 }}>
            {/* Skip AI / Practice Qs steps */}
            {(step === 3 || step === 4) && (
              <button type="button" onClick={() => setStep(s => s+1)} style={{ ...S.btn('#64748b'), background:'white', color:'#64748b', border:'1px solid #e2e8f0' }}>
                Skip →
              </button>
            )}
            {step < STEPS.length - 1
              ? <button type="button" onClick={handleNext} disabled={!canNext()} style={S.btn(C.navy, !canNext())}>
                  Next →
                </button>
              : <button type="button" onClick={() => setConfirm(true)} disabled={saving} style={S.btn(C.green, saving)}>
                  {saving ? '⏳ Saving...' : '✅ Save Log'}
                </button>
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ─── SQL Migration Helper ─────────────────────────────────────────────────────
// Run this in Supabase SQL editor to add the new columns + tables

export const SQL_MIGRATION = `
-- 1. Extend teaching_logs with new fields
ALTER TABLE teaching_logs
  ADD COLUMN IF NOT EXISTS chapter          text,
  ADD COLUMN IF NOT EXISTS subtopic         text,
  ADD COLUMN IF NOT EXISTS range_from       text,
  ADD COLUMN IF NOT EXISTS range_to         text,
  ADD COLUMN IF NOT EXISTS techniques       text,
  ADD COLUMN IF NOT EXISTS technique_detail text,
  ADD COLUMN IF NOT EXISTS key_concepts     text,
  ADD COLUMN IF NOT EXISTS technique_avoid  text;

-- 2. Syllabus topics table (chapters per subject)
CREATE TABLE IF NOT EXISTS syllabus_topics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course        text,
  subject_name  text NOT NULL,
  chapter_name  text NOT NULL,
  subtopics     text[] DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- 3. Practice questions table
CREATE TABLE IF NOT EXISTS practice_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id        uuid REFERENCES teaching_logs(id) ON DELETE CASCADE,
  batch_id      uuid,
  course        text,
  subject_name  text,
  chapter       text,
  subtopic      text,
  question_text text NOT NULL,
  answer        text,
  options       text,          -- JSON array [{key, text}]
  difficulty    text DEFAULT 'Medium',
  order_no      int  DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- 4. HM notifications table
CREATE TABLE IF NOT EXISTS hm_notifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id               uuid REFERENCES teaching_logs(id) ON DELETE CASCADE,
  hm_staff_id          uuid,
  hm_name              text,
  message              text,
  instructions         text,
  key_concepts         text,
  technique_avoid      text,
  focus_student_names  text,  -- JSON array
  status               text DEFAULT 'unread',  -- unread | read | actioned
  created_at           timestamptz DEFAULT now(),
  read_at              timestamptz

-- 5. Extend doubt_sessions with teacher instruction fields
ALTER TABLE doubt_sessions
  ADD COLUMN IF NOT EXISTS teacher_instructions  text,
  ADD COLUMN IF NOT EXISTS key_concepts          text,
  ADD COLUMN IF NOT EXISTS technique_avoid       text,
  ADD COLUMN IF NOT EXISTS ai_questions_for_hm   text,  -- JSON
  ADD COLUMN IF NOT EXISTS focus_student_ids     text,  -- JSON
  ADD COLUMN IF NOT EXISTS focus_student_names   text,  -- JSON
  ADD COLUMN IF NOT EXISTS doubt_date            date,
  ADD COLUMN IF NOT EXISTS doubt_time_slot       text;

-- 6. Enable RLS (adjust policies as needed)
ALTER TABLE practice_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_topics      ENABLE ROW LEVEL SECURITY;

-- Sample data: Insert chapters for Math (edit per your curriculum)
INSERT INTO syllabus_topics (subject_name, chapter_name, subtopics) VALUES
  ('Mathematics', 'Number System',         ARRAY['Natural numbers','Whole numbers','Integers','Rational numbers','Real numbers']),
  ('Mathematics', 'Fractions & Decimals',  ARRAY['Types of fractions','Operations on fractions','Decimal fractions','Conversion']),
  ('Mathematics', 'Geometry',              ARRAY['Lines and angles','Triangles','Quadrilaterals','Circles','Area & perimeter']),
  ('Mathematics', 'Algebra',               ARRAY['Variables & expressions','Linear equations','Word problems']),
  ('Mathematics', 'Arithmetic',            ARRAY['Ratio & proportion','Percentage','Profit & loss','Simple interest']),
  ('Mathematics', 'Data Handling',         ARRAY['Mean median mode','Bar graphs','Pie charts']),
  ('General Science', 'Living World',      ARRAY['Cell structure','Plant kingdom','Animal kingdom']),
  ('General Science', 'Matter',            ARRAY['States of matter','Elements & compounds','Mixtures']),
  ('General Science', 'Motion & Force',    ARRAY['Speed & velocity','Laws of motion','Gravity']),
  ('Reasoning', 'Series',                  ARRAY['Number series','Letter series','Mixed series']),
  ('Reasoning', 'Analogy',                 ARRAY['Number analogy','Word analogy','Figure analogy'])
ON CONFLICT DO NOTHING;
`

export default EnhancedLogForm