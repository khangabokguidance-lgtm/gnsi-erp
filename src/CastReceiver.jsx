// CastReceiver.jsx — GNSI Portal
// Standalone route opened BY a real wireless display (TV / Miracast dongle /
// Chromecast) via the browser Presentation API. This is a genuinely separate
// device running its own browser instance — it has no access to the
// presenter's tab, localStorage, or React state, so it must fetch everything
// itself from Supabase using only the URL query params it was handed.
//
// Route contract (wire this up in your router):
//   /cast-receiver?course=<key>&subject=<name>&chapter=<name>&mode=slides&source=qbank|studymaterial
//
// The presenter's tab builds this URL and hands it to `new PresentationRequest([url])`.
// Once the receiving screen opens it, this component polls Supabase for the
// live slide index (written by the presenter via `castSessionUpdate`) so
// slide navigation on the presenter's device advances the cast screen too.

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'

const C = {
  navy: '#1e3a5f', slate: '#64748b', green: '#16a34a',
  amber: '#d97706', rose: '#dc2626', border: '#e2e8f0',
}

// ── SLIDE CONTENT FETCHERS ─────────────────────────────────────────────────
// Mirrors the slide-building logic in QuestionBank.jsx / StudyMaterial.jsx.
// Kept intentionally simple/duplicated here since this route has no import
// access to those files' internal helpers — it only needs read access to
// the same Supabase tables.

async function fetchQuestionSlides(subject, chapter) {
  const { data, error } = await supabase
    .from('qbank_questions')
    .select('*')
    .eq('subject', subject)
    .eq('chapter', chapter)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map(q => ({
    kind: 'question',
    title: q.question,
    title_mayek: q.question_mayek || '',
    options: ['A','B','C','D'].map(l => ({
      letter: l,
      text: q[`option_${l.toLowerCase()}`] || '',
    })),
    correct_option: q.correct_option,
    diagram_url: q.diagram_url || '',
  }))
}

async function fetchMaterialSlides(subject, chapter) {
  const { data, error } = await supabase
    .from('study_materials')
    .select('*')
    .eq('subject', subject)
    .eq('chapter', chapter)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map(m => ({
    kind: 'material',
    title: m.title,
    material_type: m.material_type,
    description: m.description || '',
    file_url: m.file_url || '',
  }))
}

// ── LIVE SESSION SYNC ──────────────────────────────────────────────────────
// The presenter writes the current slide index to this table on every
// navigation; the receiver polls it. A dedicated table (rather than trying
// to push over the Presentation API's own connection) keeps this robust
// across reconnects — if the TV's browser reloads, it just resumes polling.
async function fetchCastSession(sessionId) {
  if (!sessionId) return null
  const { data } = await supabase
    .from('qbank_cast_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()
  return data
}

function getQueryParams() {
  const p = new URLSearchParams(window.location.search)
  return {
    course: p.get('course') || '',
    subject: p.get('subject') || '',
    chapter: p.get('chapter') || '',
    source: p.get('source') || 'qbank', // 'qbank' | 'studymaterial'
    session: p.get('session') || '',
    showAnswers: p.get('showAnswers') === '1',
  }
}

export default function CastReceiver() {
  const { course, subject, chapter, source, session, showAnswers } = useMemo(getQueryParams, [])
  const [slides, setSlides] = useState(null)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!subject || !chapter) { setError('Missing subject/chapter in cast URL'); return }
      const fetcher = source === 'studymaterial' ? fetchMaterialSlides : fetchQuestionSlides
      const result = await fetcher(subject, chapter)
      if (!cancelled) {
        if (!result.length) setError('No content found for this chapter')
        setSlides(result)
      }
    })()
    return () => { cancelled = true }
  }, [subject, chapter, source])

  // Poll the shared session row for slide-index changes from the presenter.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    const poll = async () => {
      const row = await fetchCastSession(session)
      if (!cancelled && row && typeof row.slide_index === 'number') {
        setIndex(row.slide_index)
      }
    }
    poll()
    const interval = setInterval(poll, 1200)
    return () => { cancelled = true; clearInterval(interval) }
  }, [session])

  if (error) {
    return (
      <div style={{ minHeight:'100vh', background:C.navy, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'system-ui,sans-serif' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>⚠️ {error}</div>
          <div style={{ fontSize:13, opacity:.7 }}>Check the cast link and try again from the presenter's device.</div>
        </div>
      </div>
    )
  }

  if (!slides) {
    return (
      <div style={{ minHeight:'100vh', background:C.navy, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'system-ui,sans-serif', fontSize:18 }}>
        📡 Connecting to GNSI cast session…
      </div>
    )
  }

  const slide = slides[Math.min(index, slides.length - 1)]

  return (
    <div style={{ minHeight:'100vh', background:C.navy, display:'flex', flexDirection:'column', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ padding:'10px 24px', background:'rgba(0,0,0,.2)', color:'#fff', fontSize:12, fontWeight:700, opacity:.8, display:'flex', justifyContent:'space-between' }}>
        <span>GNSI Portal — {subject} · {chapter}</span>
        <span>Slide {index+1} of {slides.length}</span>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 60px', textAlign:'center' }}>
        {slide.kind === 'question' ? (
          <>
            <div style={{ fontSize:'clamp(24px,3vw,42px)', fontWeight:700, color:'#fff', maxWidth:1100, lineHeight:1.5 }}>
              {slide.title}
            </div>
            {slide.title_mayek && (
              <div style={{ fontSize:'clamp(18px,2.2vw,28px)', color:'#cbd5e1', maxWidth:1100, marginTop:18, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
                {slide.title_mayek}
              </div>
            )}
            {slide.diagram_url && (
              <img src={slide.diagram_url} alt="diagram" style={{ maxWidth:'55%', maxHeight:280, marginTop:24, borderRadius:10 }} />
            )}
            {showAnswers && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:32, maxWidth:800, width:'100%' }}>
                {slide.options.map(o => (
                  <div key={o.letter} style={{
                    padding:'12px 18px', borderRadius:10, fontSize:16, textAlign:'left',
                    background: o.letter===slide.correct_option ? 'rgba(34,197,94,.25)' : 'rgba(255,255,255,.08)',
                    border: `1px solid ${o.letter===slide.correct_option ? '#4ade80' : 'rgba(255,255,255,.15)'}`,
                    color:'#fff', fontWeight: o.letter===slide.correct_option ? 700 : 400,
                  }}>
                    <strong style={{ marginRight:8 }}>{o.letter}.</strong>{o.text}
                    {o.letter===slide.correct_option && ' ✓'}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize:'clamp(24px,3vw,42px)', fontWeight:700, color:'#fff', maxWidth:1100 }}>
              {slide.title}
            </div>
            {slide.description && (
              <div style={{ fontSize:'clamp(16px,1.8vw,22px)', color:'#cbd5e1', maxWidth:900, marginTop:18 }}>
                {slide.description}
              </div>
            )}
            <div style={{ marginTop:24, padding:'8px 20px', borderRadius:99, background:'rgba(255,255,255,.1)', color:'#fff', fontSize:14 }}>
              {slide.material_type}
            </div>
          </>
        )}
      </div>
    </div>
  )
}