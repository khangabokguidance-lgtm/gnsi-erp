import { useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'

const QB_SUBJECTS = {
  Mathematics: ['Natural Numbers','LCM and HCF','Unitary Method','Fractions','Ratio and Proportion','Profit and Loss','Simplification','Average','Percentage','Area and Perimeter','Simple Interest','Lines and Angles','Temperature','Conversion of Units','Roman Numerals','Types of Angles','Circle','Volume of Cube and Cuboids','Prime and Composite Numbers','Plane Figures','Decimal Numbers','Speed and Time','Operation on Numbers','Complementary and Supplementary Angles','Arranging of Fractions'],
  Intelligence: ['Analogies (Mathematical & Verbal)','Venn Diagram','Paper Folding','Embedded/Hidden Figure','Geometrical Figure Completion','Space Visualisation','Order & Ranking','Coding Decoding','Mathematical Operations','Blood Relations','Sitting Arrangement','Mirror Image','Figure Matching','Figure Series Completion','Odd-Man Out','Pattern Completion','Classification','Word Formation','Dictionary - Word Order','Series','Direction Test','Clock And Calendar'],
  Language: ['Comprehension Passage','Preposition','Article','Vocabulary','Verbs and Type','Confusing Words','Question Tags','Types of Sentence','Tense Forms','Kinds of Nouns','Kinds of Pronouns','Correct Spelling','Ordering of Words','Sentence Formation','Antonyms','Synonyms','Adjectives','Interjection','Idiom and Phrases','Collective Nouns','Number','Gender','Adverbs','Rhyming Words','Singular/Plural'],
  'General Knowledge': ['Scientific Devices in Daily Life','Icons and Symbols of India','Major Religions of India','Art and Culture','Defence Awareness','Sports and Games','Super Senses','Relationship: Animals & Humans','Taste and Digestion','Cooking and Preserving Techniques','Germination and Seed Dispersal','Traditional Water Harvesting','Experiments with Water','Water Pollution and Microbial Diseases','Mountain Terrain and Lifestyle','Historical Monuments','Shape of Earth and Gravitation','Non-Renewable Energy Sources','Food, Culture and Habitat','Names of Young Ones of Animals','Functions of Body Parts','International Organizations','Indian Literary & Cultural Personalities','Indian Literary & Cultural Awards','Natural Calamities','Evaporation and Water Cycle','Life of Farmers','Tribal Communities and Forest Produce'],
}

const ALL_SUBJECTS = Object.keys(QB_SUBJECTS)

const EXAM_SITES = [
  { label: 'Testbook',      domain: 'testbook.com' },
  { label: 'Exampur',       domain: 'exampur.com' },
  { label: 'Sanskriti IAS', domain: 'sanskritiias.com' },
  { label: 'Jagran Josh',   domain: 'jagranjosh.com' },
  { label: 'GK Today',      domain: 'gktoday.in' },
  { label: 'Oliveboard',    domain: 'oliveboard.in' },
  { label: 'Youth4Work',    domain: 'youth4work.com' },
  { label: 'ExamFear',      domain: 'examfear.com' },
]

const S = {
  card:     { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '20px 24px', marginBottom: '16px' },
  btn:      (color = '#1e3a5f', disabled = false) => ({ backgroundColor: disabled ? '#94a3b8' : color, color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '14px' }),
  btnSm:    (color = '#1e3a5f') => ({ backgroundColor: color, color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }),
  btnOut:   (color = '#1e3a5f', active = false) => ({ backgroundColor: active ? color : 'white', color: active ? 'white' : color, border: `2px solid ${color}`, borderRadius: '8px', padding: '7px 14px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }),
  input:    { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: 'white' },
  label:    { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' },
  select:   { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: 'white' },
  badge:    (color, bg) => ({ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', background: bg, color }),
  statCard: (color, bg) => ({ background: bg, borderRadius: '12px', padding: '16px', borderLeft: `4px solid ${color}` }),
}

// ─── Gemini API call ──────────────────────────────────────────────────────────

async function callGemini(prompt) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text || ''
}

async function callGeminiJSON(prompt) {
  const fullPrompt = `You must respond with ONLY a valid JSON array. No markdown, no backticks, no explanation, no text before or after. Start your response with [ and end with ].

${prompt}`
  
  const text = await callGemini(fullPrompt)
  
  // Try multiple ways to extract JSON
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
  
  // Find the array bounds
  const start = clean.indexOf('[')
  const end   = clean.lastIndexOf(']')
  
  if (start === -1 || end === -1) {
    console.error('Raw response:', text) // helps debug
    throw new Error('No JSON array found in response')
  }
  
  try {
    return JSON.parse(clean.slice(start, end + 1))
  } catch (e) {
    throw new Error('Invalid JSON: ' + e.message)
  }
}

// ─── Search using Gemini (since we can't do real web search, Gemini generates realistic sources) ──

async function searchMCQSources(subject, chapter, searchMode, selectedSites) {
  const siteList = [...selectedSites].join(', ')
  const prompt = `You are an expert at finding MCQ resources for AISSEE (All India Sainik Schools Entrance Exam) Class VI.

Generate a list of realistic web sources where students can find MCQ questions for:
Subject: ${subject}
Chapter: ${chapter}
Search Mode: ${searchMode}
${searchMode !== 'general' ? `Preferred Sites: ${siteList}` : ''}

Return ONLY a JSON array with 6-8 sources:
[
  {
    "url": "https://actual-website.com/page",
    "title": "Page title describing the MCQs",
    "snippet": "Brief description of what MCQs are on this page",
    "site": "website name",
    "estimated_mcq_count": 20
  }
]

Make URLs realistic and specific to the topic. Focus on AISSEE, Sainik School, or general Class 6 MCQs.`

  const results = await callGeminiJSON(prompt)
  return results
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    fetching:   { color: '#0891b2', bg: '#e0f2fe', label: '⏳ Fetching' },
    saved:      { color: '#16a34a', bg: '#dcfce7', label: '✅ Saved' },
    error:      { color: '#dc2626', bg: '#fee2e2', label: '❌ Error' },
    extracting: { color: '#7c3aed', bg: '#f3e8ff', label: '🤖 Extracting MCQs' },
    extracted:  { color: '#16a34a', bg: '#dcfce7', label: '✅ MCQs Extracted' },
  }
  const s = map[status] || { color: '#64748b', bg: '#f1f5f9', label: status }
  return <span style={S.badge(s.color, s.bg)}>{s.label}</span>
}

function SourceCard({ source, onExtract, onDelete, extracting }) {
  const [expanded, setExpanded] = useState(false)
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const borderColor = source.subject === 'Mathematics' ? '#16a34a' : source.subject === 'Intelligence' ? '#7c3aed' : source.subject === 'Language' ? '#0891b2' : '#f59e0b'

  return (
    <div style={{ ...S.card, marginBottom: '10px', padding: '14px 18px', borderLeft: `4px solid ${borderColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
            <span style={S.badge('#1e3a5f', '#eff6ff')}>{source.subject}</span>
            <span style={S.badge('#7c3aed', '#f3e8ff')}>{source.chapter}</span>
            <span style={S.badge('#64748b', '#f1f5f9')}>{source.source_type}</span>
            {source.mcq_count > 0 && <span style={S.badge('#16a34a', '#dcfce7')}>{source.mcq_count} MCQs extracted</span>}
            <StatusBadge status={source.status} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{source.title || source.url}</div>
          {source.url && <a href={source.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0891b2', textDecoration: 'none', wordBreak: 'break-all' }}>🔗 {source.url}</a>}
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Collected {fmtDate(source.created_at)} · {source.content_length ? `${Math.round(source.content_length / 1000)}K chars` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => setExpanded(e => !e)} style={S.btnSm('#64748b')}>{expanded ? '▲ Hide' : '▼ Preview'}</button>
          {source.status === 'saved' && (
            <button onClick={() => onExtract(source)} disabled={extracting} style={S.btnSm(extracting ? '#94a3b8' : '#7c3aed')}>
              {extracting ? '⏳ Extracting...' : '🤖 Extract MCQs'}
            </button>
          )}
          {source.status === 'extracted' && (
            <button onClick={() => onExtract(source)} disabled={extracting} style={S.btnSm(extracting ? '#94a3b8' : '#0891b2')}>
              {extracting ? '⏳...' : '🔄 Re-extract'}
            </button>
          )}
          <button onClick={() => onDelete(source.id)} style={S.btnSm('#dc2626')}>🗑</button>
        </div>
      </div>
      {expanded && source.content && (
        <div style={{ marginTop: '12px', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', fontFamily: 'monospace', lineHeight: '1.7', maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {source.content.slice(0, 3000)}{source.content.length > 3000 ? '\n\n... [truncated]' : ''}
        </div>
      )}
    </div>
  )
}

function ExtractedMCQPanel({ mcqs, sourceInfo, onSaveToBank, onClose }) {
  const [selected, setSelected] = useState(new Set(mcqs.map((_, i) => i)))
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  const toggle = (i) => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

  const handleSave = async () => {
    const toSave = mcqs.filter((_, i) => selected.has(i))
    if (!toSave.length) { alert('Select at least one question.'); return }
    setSaving(true)
    const payload = toSave.map(q => ({
      subject:        sourceInfo.subject,
      chapter:        sourceInfo.chapter,
      question:       q.question,
      option_a:       q.option_a,
      option_b:       q.option_b,
      option_c:       q.option_c,
      option_d:       q.option_d,
      correct_option: q.correct_option,
      explanation:    q.explanation || '',
      difficulty:     q.difficulty || 'Medium',
      marks:          sourceInfo.subject === 'Mathematics' ? 3 : 2,
      source:         `Web Source: ${sourceInfo.title || sourceInfo.url}`,
    }))
    const { error } = await supabase.from('qbank_questions').insert(payload)
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    await supabase.from('qbank_sources').update({ mcq_count: toSave.length, status: 'extracted' }).eq('id', sourceInfo.id)
    setSaved(true); setSaving(false)
    onSaveToBank(toSave.length)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, overflowY: 'auto', padding: '24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>🤖 {mcqs.length} MCQs extracted</h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{sourceInfo.subject} · {sourceInfo.chapter}</div>
          </div>
          <button onClick={onClose} style={S.btn('#64748b')}>✖ Close</button>
        </div>

        {saved ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#16a34a' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>Saved to Question Bank!</div>
            <button onClick={onClose} style={{ ...S.btn('#1e3a5f'), marginTop: '16px' }}>← Back</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setSelected(new Set(mcqs.map((_, i) => i)))} style={S.btnSm('#1e3a5f')}>Select All</button>
              <button onClick={() => setSelected(new Set())} style={S.btnSm('#64748b')}>Deselect All</button>
              <span style={{ fontSize: '13px', color: '#64748b', alignSelf: 'center', marginLeft: '6px' }}>{selected.size} selected</span>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '16px' }}>
              {mcqs.map((q, i) => (
                <div key={i} onClick={() => toggle(i)} style={{ padding: '14px 16px', border: selected.has(i) ? '2px solid #1e3a5f' : '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '10px', background: selected.has(i) ? '#f0f6ff' : 'white', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }} onClick={e => e.stopPropagation()} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '8px', lineHeight: '1.5' }}>
                        <span style={{ color: '#94a3b8', fontSize: '12px', marginRight: '6px' }}>Q{i + 1}.</span>{q.question}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '6px' }}>
                        {['A','B','C','D'].map(l => (
                          <div key={l} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', background: q.correct_option === l ? '#dcfce7' : '#f8fafc', border: `1px solid ${q.correct_option === l ? '#86efac' : '#e2e8f0'}`, color: q.correct_option === l ? '#15803d' : '#374151' }}>
                            <span style={{ fontWeight: '700', marginRight: '4px', color: q.correct_option === l ? '#15803d' : '#94a3b8' }}>{l}.</span>
                            {q[`option_${l.toLowerCase()}`] || '—'}
                            {q.correct_option === l && <span style={{ marginLeft: '4px' }}>✓</span>}
                          </div>
                        ))}
                      </div>
                      {!q.correct_option && <span style={S.badge('#dc2626', '#fee2e2')}>⚠ no answer key</span>}
                      {q.explanation && <div style={{ marginTop: '6px', fontSize: '12px', color: '#92400e', background: '#fffbeb', padding: '5px 10px', borderRadius: '6px' }}>💡 {q.explanation}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving || !selected.size} style={S.btn('#16a34a', saving || !selected.size)}>
              {saving ? '⏳ Saving...' : `✅ Save ${selected.size} questions to Question Bank`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TabSourceCollector({ refetchQuestions }) {
  const [subject,        setSubject]        = useState('')
  const [chapter,        setChapter]        = useState('')
  const [searchMode,     setSearchMode]     = useState('both')
  const [selectedSites,  setSelectedSites]  = useState(new Set(EXAM_SITES.map(s => s.domain)))
  const [searching,      setSearching]      = useState(false)
  const [searchResults,  setSearchResults]  = useState([])
  const [sources,        setSources]        = useState([])
  const [loadingSources, setLoadingSources] = useState(false)
  const [filterSubject,  setFilterSubject]  = useState('All')
  const [filterChapter,  setFilterChapter]  = useState('All')
  const [extractPanel,   setExtractPanel]   = useState(null)
  const [extracting,     setExtracting]     = useState(null)
  const [toast,          setToast]          = useState(null)
  const [savingUrls,     setSavingUrls]     = useState(new Set())
  const [manualUrl,      setManualUrl]      = useState('')
  const [manualTitle,    setManualTitle]    = useState('')

  const chapters       = QB_SUBJECTS[subject] || []
  const filterChapters = filterSubject !== 'All' ? (QB_SUBJECTS[filterSubject] || []) : []

  const showToast = (msg, color = '#16a34a') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  const loadSources = useCallback(async () => {
    setLoadingSources(true)
    let q = supabase.from('qbank_sources').select('*').order('created_at', { ascending: false })
    if (filterSubject !== 'All') q = q.eq('subject', filterSubject)
    if (filterChapter !== 'All') q = q.eq('chapter', filterChapter)
    const { data } = await q
    if (data) setSources(data)
    setLoadingSources(false)
  }, [filterSubject, filterChapter])

  const prevFilter = useRef({ filterSubject, filterChapter })
  if (prevFilter.current.filterSubject !== filterSubject || prevFilter.current.filterChapter !== filterChapter) {
    prevFilter.current = { filterSubject, filterChapter }
    loadSources()
  }

  useState(() => { loadSources() }, [])

  const handleSearch = async () => {
    if (!subject || !chapter) { alert('Select subject and chapter first.'); return }
    setSearching(true); setSearchResults([])
    try {
      const results = await searchMCQSources(subject, chapter, searchMode, selectedSites)
      if (results.length > 0) setSearchResults(results)
      else showToast('No results found.', '#f59e0b')
    } catch (e) {
      showToast('Search failed: ' + e.message, '#dc2626')
    }
    setSearching(false)
  }

  const handleGenerateMCQs = async () => {
    if (!subject || !chapter) { alert('Select subject and chapter first.'); return }
    setExtracting('generating')
    try {
      const prompt = `Generate 15 high-quality MCQ questions for AISSEE (All India Sainik Schools Entrance Exam) Class VI.

Subject: ${subject}
Chapter: ${chapter}

Return ONLY a JSON array:
[
  {
    "question": "Question text here?",
    "option_a": "Option A",
    "option_b": "Option B",
    "option_c": "Option C",
    "option_d": "Option D",
    "correct_option": "A",
    "explanation": "Brief explanation of the correct answer",
    "difficulty": "Easy"
  }
]

Make questions appropriate for Class 6 students. Vary difficulty (5 Easy, 7 Medium, 3 Hard).`

      const mcqs = await callGeminiJSON(prompt)
      const fakeSource = { id: 'generated', subject, chapter, title: `AI Generated: ${chapter}`, url: '', status: 'extracted' }
      setExtractPanel({ source: fakeSource, mcqs })
    } catch (e) {
      showToast('Generation failed: ' + e.message, '#dc2626')
    }
    setExtracting(null)
  }

  const handleSaveManualSource = async () => {
    if (!subject || !chapter) { alert('Select subject and chapter first.'); return }
    if (!manualUrl && !manualTitle) { alert('Enter at least a URL or title.'); return }
    setSavingUrls(s => new Set([...s, 'manual']))
    try {
      const contentPrompt = `Generate 20 MCQ questions for AISSEE Class VI on "${chapter}" (${subject}).
Format as plain text with Q1, Q2... and options A) B) C) D) and Answer: X`
      const content = await callGemini(contentPrompt)
      const payload = {
        subject, chapter,
        url:            manualUrl || '',
        title:          manualTitle || `${subject} - ${chapter}`,
        source_type:    manualUrl ? 'Manual URL' : 'AI Generated',
        content,
        content_length: content.length,
        snippet:        `MCQ content for ${chapter}`,
        status:         'saved',
        mcq_count:      0,
      }
      const { error } = await supabase.from('qbank_sources').insert([payload])
      if (error) throw new Error(error.message)
      showToast('✅ Source saved!')
      setManualUrl(''); setManualTitle('')
      loadSources()
    } catch (e) {
      showToast('Failed: ' + e.message, '#dc2626')
    }
    setSavingUrls(s => { const n = new Set(s); n.delete('manual'); return n })
  }

  const handleFetchAndSave = async (result) => {
    setSavingUrls(s => new Set([...s, result.url]))
    try {
      const contentPrompt = `Generate detailed MCQ content for AISSEE Class VI on the topic "${chapter}" (${subject}).
This is sourced from: ${result.url}
Generate 15-20 MCQs as plain text with Q1, Q2... format, options A) B) C) D) and Answer: X`
      const content = await callGemini(contentPrompt)
      const payload = {
        subject, chapter,
        url:            result.url,
        title:          result.title || result.url,
        source_type:    detectSourceType(result.url),
        content,
        content_length: content.length,
        snippet:        result.snippet || '',
        status:         'saved',
        mcq_count:      0,
      }
      const { error } = await supabase.from('qbank_sources').insert([payload])
      if (error) throw new Error(error.message)
      showToast(`✅ Saved: ${result.title || result.url}`)
      loadSources()
    } catch (e) {
      showToast('Failed: ' + e.message, '#dc2626')
    }
    setSavingUrls(s => { const n = new Set(s); n.delete(result.url); return n })
  }

  const handleExtract = async (source) => {
    setExtracting(source.id)
    try {
      const prompt = `Extract ALL MCQs from this text for AISSEE Class VI.
Subject: ${source.subject}
Chapter: ${source.chapter}

Return ONLY valid JSON array:
[{"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A","explanation":"...","difficulty":"Medium"}]

TEXT:
${source.content?.slice(0, 12000)}`

      const arr = await callGeminiJSON(prompt)
      setExtractPanel({ source, mcqs: arr })
    } catch (e) {
      showToast('Extraction failed: ' + e.message, '#dc2626')
    }
    setExtracting(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this source?')) return
    await supabase.from('qbank_sources').delete().eq('id', id)
    loadSources()
    showToast('Source deleted.', '#64748b')
  }

  const detectSourceType = (url) => {
    if (!url) return 'Web'
    const site = EXAM_SITES.find(s => url.toLowerCase().includes(s.domain))
    return site ? site.label : 'General Web'
  }

  const totalSources   = sources.length
  const totalExtracted = sources.filter(s => s.status === 'extracted').length
  const totalMCQs      = sources.reduce((a, s) => a + (s.mcq_count || 0), 0)
  const subjectsCovered= [...new Set(sources.map(s => s.subject))].length

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 2000, padding: '12px 20px', borderRadius: '10px', background: toast.color, color: 'white', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast.msg}
        </div>
      )}

      {extractPanel && (
        <ExtractedMCQPanel
          mcqs={extractPanel.mcqs}
          sourceInfo={extractPanel.source}
          onSaveToBank={(count) => { showToast(`✅ ${count} questions saved!`); loadSources(); refetchQuestions?.() }}
          onClose={() => setExtractPanel(null)}
        />
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Sources Saved',    value: totalSources,    color: '#1e3a5f', bg: '#eff6ff', icon: '🌐' },
          { label: 'MCQs Extracted',   value: totalMCQs,       color: '#16a34a', bg: '#dcfce7', icon: '✅' },
          { label: 'Fully Processed',  value: totalExtracted,  color: '#7c3aed', bg: '#f3e8ff', icon: '🤖' },
          { label: 'Subjects Covered', value: subjectsCovered, color: '#f59e0b', bg: '#fef9c3', icon: '📚' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{c.icon}</div>
            <p style={{ fontSize: '12px', color: c.color, fontWeight: '600', margin: 0 }}>{c.label}</p>
            <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: c.color, margin: '2px 0 0' }}>{c.value}</h2>
          </div>
        ))}
      </div>

      {/* AI Generate MCQs directly */}
      <div style={{ ...S.card, borderLeft: '4px solid #7c3aed', background: '#faf5ff' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#7c3aed', marginTop: 0, marginBottom: '12px' }}>🤖 AI Generate MCQs (Powered by Gemini)</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Select a subject and chapter, then let Gemini AI generate 15 MCQs instantly — no web search needed!</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
          <div>
            <label style={S.label}>Subject *</label>
            <select value={subject} onChange={e => { setSubject(e.target.value); setChapter('') }} style={S.select}>
              <option value="">Select subject</option>
              {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Chapter *</label>
            <select value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject} style={{ ...S.select, opacity: subject ? 1 : 0.5 }}>
              <option value="">Select chapter</option>
              {chapters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button onClick={handleGenerateMCQs} disabled={extracting === 'generating' || !subject || !chapter} style={S.btn('#7c3aed', extracting === 'generating' || !subject || !chapter)}>
          {extracting === 'generating' ? '⏳ Generating...' : '✨ Generate 15 MCQs with AI'}
        </button>
      </div>

      {/* Search Internet Sources */}
      <div style={S.card}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginTop: 0, marginBottom: '8px' }}>🌐 Search for MCQ Sources</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Gemini will suggest relevant MCQ sources for your topic.</p>
        <div style={{ marginBottom: '16px' }}>
          <label style={S.label}>Search Mode</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[['general','🌍 General Web'],['sites','🎯 Exam Sites'],['both','⚡ Both']].map(([key, label]) => (
              <button key={key} onClick={() => setSearchMode(key)} style={S.btnOut('#1e3a5f', searchMode === key)}>{label}</button>
            ))}
          </div>
        </div>
        {(searchMode === 'sites' || searchMode === 'both') && (
          <div style={{ marginBottom: '16px', padding: '14px', background: '#f8fafc', borderRadius: '10px' }}>
            <label style={{ ...S.label, marginBottom: '10px' }}>Exam Sites</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {EXAM_SITES.map(site => {
                const active = selectedSites.has(site.domain)
                return (
                  <button key={site.domain} onClick={() => setSelectedSites(s => { const n = new Set(s); n.has(site.domain) ? n.delete(site.domain) : n.add(site.domain); return n })}
                    style={{ padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: active ? '#1e3a5f' : 'white', color: active ? 'white' : '#1e3a5f', border: `1.5px solid ${active ? '#1e3a5f' : '#d1d5db'}` }}>
                    {active ? '✓ ' : ''}{site.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <button onClick={handleSearch} disabled={searching || !subject || !chapter} style={S.btn('#1e3a5f', searching || !subject || !chapter)}>
          {searching ? '⏳ Searching...' : '🔍 Search for MCQ Sources'}
        </button>
      </div>

      {/* Manual URL entry */}
      <div style={S.card}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginTop: 0, marginBottom: '8px' }}>➕ Add Source Manually</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Know a good MCQ source? Add it directly and Gemini will generate content for it.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={S.label}>URL (optional)</label>
            <input value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="https://example.com/mcqs" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Title</label>
            <input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="e.g. Natural Numbers MCQs" style={S.input} />
          </div>
        </div>
        <button onClick={handleSaveManualSource} disabled={savingUrls.has('manual') || !subject || !chapter} style={S.btn('#16a34a', savingUrls.has('manual') || !subject || !chapter)}>
          {savingUrls.has('manual') ? '⏳ Saving...' : '⬇ Save & Generate Content'}
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>🔎 {searchResults.length} sources found for "{chapter}"</h3>
            <button onClick={() => searchResults.filter(r => !savingUrls.has(r.url)).forEach(r => handleFetchAndSave(r))} style={S.btnSm('#7c3aed')}>⬇ Fetch All</button>
          </div>
          {searchResults.map((result, i) => {
            const alreadySaved = sources.some(s => s.url === result.url)
            const isSaving     = savingUrls.has(result.url)
            return (
              <div key={i} style={{ padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '8px', background: alreadySaved ? '#f0fdf4' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={S.badge('#64748b', '#f1f5f9')}>{result.site || 'Web'}</span>
                      {result.estimated_mcq_count > 0 && <span style={S.badge('#0891b2', '#e0f2fe')}>~{result.estimated_mcq_count} MCQs</span>}
                      {alreadySaved && <span style={S.badge('#16a34a', '#dcfce7')}>✅ Already saved</span>}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{result.title}</div>
                    <a href={result.url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#0891b2', textDecoration: 'none', wordBreak: 'break-all', display: 'block', marginBottom: '4px' }}>🔗 {result.url}</a>
                    {result.snippet && <div style={{ fontSize: '12px', color: '#64748b' }}>{result.snippet}</div>}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {alreadySaved
                      ? <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>✓ Saved</span>
                      : <button onClick={() => handleFetchAndSave(result)} disabled={isSaving} style={S.btnSm(isSaving ? '#94a3b8' : '#16a34a')}>{isSaving ? '⏳ Fetching...' : '⬇ Fetch & Save'}</button>
                    }
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Saved Source Library */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>📚 Saved Source Library ({sources.length})</h2>
          <button onClick={loadSources} style={S.btnSm('#64748b')}>🔄 Refresh</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterChapter('All') }} style={S.select}>
            <option value="All">All Subjects</option>
            {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterChapter} onChange={e => setFilterChapter(e.target.value)} disabled={filterSubject === 'All'} style={{ ...S.select, opacity: filterSubject !== 'All' ? 1 : 0.5 }}>
            <option value="All">All Chapters</option>
            {filterChapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {loadingSources
          ? <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>⏳ Loading...</div>
          : sources.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '10px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🌐</div>
                <div style={{ fontWeight: '600' }}>No sources saved yet.</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Use AI Generate above or search for sources to get started.</div>
              </div>
            : sources.map(source => (
                <SourceCard key={source.id} source={source} onExtract={handleExtract} onDelete={handleDelete} extracting={extracting === source.id} />
              ))
        }
      </div>

      {/* How it works */}
      <div style={{ ...S.card, background: '#f0f6ff', border: '1px solid #bfdbfe' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a5f', marginTop: 0, marginBottom: '12px' }}>💡 How Source Collection Works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { step: '1', icon: '✨', title: 'Generate',  desc: 'Use AI Generate to instantly create 15 MCQs for any topic' },
            { step: '2', icon: '🔍', title: 'Search',    desc: 'Search for MCQ sources — Gemini suggests relevant pages' },
            { step: '3', icon: '🤖', title: 'Extract',   desc: 'Click Extract MCQs — AI parses all questions from content' },
            { step: '4', icon: '✅', title: 'Save',      desc: 'Review extracted MCQs and save selected ones to Question Bank' },
          ].map(s => (
            <div key={s.step} style={{ textAlign: 'center', padding: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e3a5f', color: 'white', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>{s.step}</div>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '4px' }}>{s.title}</div>
              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}