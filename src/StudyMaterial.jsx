// StudyMaterial.jsx — GNSI Portal
// Multi-course study material manager
// Supabase tables: study_materials, study_course_structure

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import { useQBankCountsByChapter } from './StudyMaterialBridge'
import { EventBus, GNSI_EVENTS } from './EventBus'

// ── HARDCODED BASE COURSE DATA ────────────────────────────────────────────────
// Custom subjects/chapters from Supabase are merged in at runtime.

const BASE_COURSES = {
  sainik: {
    label: 'Sainik School', short: 'AISSEE', exam: 'AISSEE · Class 6 & 9',
    color: '#16a34a', bg: '#dcfce7', border: '#86efac', text: '#15803d',
    FILE_BUCKET: 'study-materials-sainik',
    subjects: {
      Mathematics: { icon: '📐', chapters: ['Natural Numbers','LCM and HCF','Fractions','Decimal Numbers','Ratio and Proportion','Percentage','Profit and Loss','Simple Interest','Average','Unitary Method','Area and Perimeter','Volume of Cube and Cuboids','Speed and Time','Lines and Angles','Types of Angles','Circle','Prime and Composite Numbers','Roman Numerals','Simplification','Conversion of Units','Operation on Numbers','Temperature','Plane Figures','Arranging of Fractions','Complementary and Supplementary Angles'] },
      Intelligence: { icon: '🧠', chapters: ['Analogies','Venn Diagram','Paper Folding','Embedded Figure','Geometrical Figure Completion','Space Visualisation','Order and Ranking','Coding Decoding','Mathematical Operations','Blood Relations','Sitting Arrangement','Mirror Image','Figure Matching','Figure Series','Odd Man Out','Pattern Completion','Classification','Word Formation','Dictionary Word Order','Series Completion','Direction Test','Clock and Calendar'] },
      'English Language': { icon: '📖', chapters: ['Comprehension Passage','Preposition','Article','Vocabulary','Verbs and Types','Confusing Words','Question Tags','Types of Sentence','Tense Forms','Kinds of Nouns','Kinds of Pronouns','Correct Spelling','Ordering of Words','Sentence Formation','Antonyms','Synonyms','Adjectives','Interjection','Idiom and Phrases','Collective Nouns','Number and Gender','Adverbs','Rhyming Words','Singular and Plural'] },
      'General Knowledge': { icon: '🌍', chapters: ['Scientific Devices','Icons and Symbols of India','Major Religions of India','Art and Culture','Defence Awareness','Sports and Games','Relationship Animals and Humans','Taste and Digestion','Cooking and Preserving','Germination and Seed Dispersal','Traditional Water Harvesting','Water Pollution','Mountain Terrain','Historical Monuments','Shape of Earth','Non-Renewable Energy','Food Culture and Habitat','Young Ones of Animals','Functions of Body Parts','International Organizations','Indian Literary Awards','Natural Calamities','Evaporation and Water Cycle','Life of Farmers','Tribal Communities'] },
      'Social Studies': { icon: '🗺️', chapters: ['Ancient India','Medieval India','Modern India','Indian Constitution','Physical Geography of India','Resources and Industries','Economic Geography','Disaster Management'] },
    },
  },
  navodaya: {
    label: 'Navodaya Vidyalaya', short: 'JNVST', exam: 'JNVST · Class 6 & 9',
    color: '#2563eb', bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8',
    FILE_BUCKET: 'study-materials-navodaya',
    subjects: {
      'Mental Ability': { icon: '🧩', chapters: ['Odd One Out','Figure Series','Pattern Completion','Analogy','Geometrical Figure Completion','Mirror Image','Punched Hole Paper Folding','Space Visualisation','Embedded Figures','Coding-Decoding','Arithmetic Operations in Figures','Series','Direction Sense','Clock'] },
      Arithmetic: { icon: '🔢', chapters: ['Natural Numbers','LCM and HCF','Fractions','Decimals','Simplification','Percentage','Ratio and Proportion','Average','Profit and Loss','Simple Interest','Area and Perimeter','Volume','Speed and Distance','Unitary Method','Roman Numerals','Number System','Conversion of Units','Word Problems'] },
      'English Language': { icon: '📗', chapters: ['Reading Comprehension','Fill in the Blanks','Sentence Arrangement','Synonyms','Antonyms','One-word Substitution','Correct Spelling','Phrase Meaning','Grammar Usage','Tenses','Articles'] },
      'Hindi Language': { icon: '📕', chapters: ['Gadhyansh Bodh','Vakya Purti','Paryayvachi Shabd','Vilom Shabd','Shuddh Vartani','Muhavare aur Lokokti','Sandhi','Samas','Anekarthi Shabd','Vakya Nirman'] },
    },
  },
  foundation: {
    label: 'Foundation Course', short: 'Class 5–8', exam: 'Board + Competitive base',
    color: '#d97706', bg: '#fef9c3', border: '#fde68a', text: '#b45309',
    FILE_BUCKET: 'study-materials-foundation',
    subjects: {
      Mathematics: { icon: '📐', chapters: ['Number Systems','Factors and Multiples','Fractions and Decimals','Integers','Algebra — Expressions and Equations','Ratio and Proportion','Percentage and Its Applications','Profit, Loss and Discount','Simple and Compound Interest','Lines, Angles and Triangles','Quadrilaterals and Polygons','Area and Perimeter','Surface Area and Volume','Statistics and Data Handling','Exponents and Powers','Symmetry and Transformations','Coordinate Geometry Basics','Mensuration','Speed, Time, Distance','Probability Basics'] },
      Science: { icon: '🔬', chapters: ['Food and Nutrition','Materials and Their Properties','The Living World — Plants','The Living World — Animals','Force, Motion and Energy','Light and Sound','Heat and Temperature','Electricity and Magnetism','Acids, Bases and Salts','Chemical Reactions Basics','Cell — The Unit of Life','Reproduction in Plants and Animals','Human Body Systems','Soil and Water','Air and Atmosphere','Environment and Ecology','Natural Resources','Disaster Management'] },
      English: { icon: '📘', chapters: ['Parts of Speech','Tenses','Voice — Active and Passive','Narration — Direct and Indirect','Articles and Prepositions','Subject-Verb Agreement','Comprehension Passages','Letter Writing','Essay Writing','Vocabulary Development','Synonyms, Antonyms and Homophones','Idioms and Phrases','One-word Substitution','Punctuation','Sentence Transformation'] },
      'Social Science': { icon: '🗺️', chapters: ['Ancient Civilisations','Medieval India','Mughal Empire','British Rule and Freedom Struggle','Post-Independence India','Physical Features of India','Climate of India','Natural Vegetation and Wildlife','Population and Urbanisation','Resources — Land, Water, Minerals','Agriculture and Industries','Indian Constitution','Panchayati Raj','Democracy and Elections','Economic Concepts','Globalisation'] },
      Hindi: { icon: '📙', chapters: ['Gadhya Bodh','Padhya Bodh','Vyakaran — Sangya, Sarvanam','Visheshan and Kriya','Kal aur Vachya','Sandhi aur Samas','Muhavare aur Lokokti','Patra Lekhan','Nibandh Lekhan','Anuchhed Lekhan'] },
    },
  },
}

const MATERIAL_TYPES = [
  { key: 'notes',          label: 'Notes PDF',      icon: '📄', color: '#1d4ed8', bg: '#dbeafe' },
  { key: 'formula',        label: 'Formula Sheet',  icon: '🔣', color: '#7c3aed', bg: '#ede9fe' },
  { key: 'practice',       label: 'Practice Set',   icon: '✏️', color: '#15803d', bg: '#dcfce7' },
  { key: 'solved',         label: 'Solved Paper',   icon: '✅', color: '#0f766e', bg: '#ccfbf1' },
  { key: 'mindmap',        label: 'Mind Map',       icon: '🗂️', color: '#b45309', bg: '#fef9c3' },
  { key: 'video',          label: 'Video Link',     icon: '🎥', color: '#dc2626', bg: '#fee2e2' },
  { key: 'currentaffairs', label: 'Current Affairs',icon: '📰', color: '#64748b', bg: '#f1f5f9' },
]

const ICON_OPTIONS = ['📁','📐','🧠','📖','🌍','🗺️','🧩','🔢','📗','📕','📘','📙','🔬','⚗️','🏛️','🎨','🎵','💻','🏃','🌱','🔭','📊','🗣️','✍️']

// ── COLORS & STYLES ───────────────────────────────────────────────────────────
const C = {
  navy: '#1e3a5f', slate: '#64748b', border: '#e2e8f0',
  white: '#ffffff', bg: '#f8fafc', green: '#16a34a',
  rose: '#dc2626', amber: '#d97706', indigo: '#4f46e5',
}
const iS = { width: '100%', padding: '8px 11px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, background: C.white, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const lS = { display: 'block', fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }
const cardS = { background: C.white, borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: '18px 20px', marginBottom: 14 }
const btn = (bg, dis = false) => ({ padding: '8px 16px', borderRadius: 8, background: dis ? '#94a3b8' : bg, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .7 : 1 })
const btnSm = (bg, color = '#fff') => ({ padding: '4px 10px', borderRadius: 6, background: bg, color, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' })

// ── HELPERS ───────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return mobile
}

function Toast({ msg, color }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#fff', border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 320 }}>
      {msg}
    </div>
  )
}

function Badge({ text, color, bg }) {
  return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, color, background: bg, whiteSpace: 'nowrap' }}>{text}</span>
}

function MaterialTypeBadge({ typeKey }) {
  const t = MATERIAL_TYPES.find(m => m.key === typeKey) || MATERIAL_TYPES[0]
  return <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: t.color, background: t.bg, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t.icon} {t.label}</span>
}

// ── ADD SUBJECT MODAL ─────────────────────────────────────────────────────────
function AddSubjectModal({ course, courseData, existingSubjects, onClose, onSaved, showToast }) {
  const [name, setName]   = useState('')
  const [icon, setIcon]   = useState('📁')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) { showToast('Enter a subject name', C.amber); return }
    if (existingSubjects.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      showToast('Subject already exists', C.amber); return
    }
    setSaving(true)
    const { error } = await supabase.from('study_course_structure').insert({
      course, subject: trimmed, icon, chapter: null,
    })
    if (error) { showToast('Failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ Subject "${trimmed}" added!`, C.green)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.white, borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,.18)', padding: '24px 20px 32px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>➕ Add New Subject</div>
          <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕</button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={lS}>Subject name *</label>
            <input style={iS} value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Computer Science, Current Affairs…" autoFocus />
          </div>

          <div>
            <label style={lS}>Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {ICON_OPTIONS.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, fontSize: 18,
                    border: `2px solid ${icon === ic ? courseData.color : C.border}`,
                    background: icon === ic ? courseData.bg : C.white,
                    cursor: 'pointer',
                  }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={handleSave} disabled={saving || !name.trim()}
              style={{ ...btn(courseData.color, saving || !name.trim()), flex: 1 }}>
              {saving ? '⏳ Saving…' : '✅ Add Subject'}
            </button>
            <button onClick={onClose} style={btn(C.slate)}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ADD CHAPTER INLINE ────────────────────────────────────────────────────────
function AddChapterInline({ course, subject, courseData, existingChapters, onSaved, showToast }) {
  const [open,   setOpen]   = useState(false)
  const [name,   setName]   = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef()

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (existingChapters.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      showToast('Chapter already exists', C.amber); return
    }
    setSaving(true)
    const { error } = await supabase.from('study_course_structure').insert({
      course, subject, icon: '', chapter: trimmed,
    })
    if (error) { showToast('Failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ Chapter "${trimmed}" added!`, C.green)
    setName('')
    setOpen(false)
    setSaving(false)
    onSaved()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, width: '100%',
          border: `1.5px dashed ${courseData.border}`,
          background: 'transparent', color: courseData.text,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          marginTop: 6,
        }}>
        ＋ Add chapter to {subject}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
      <input
        ref={inputRef}
        style={{ ...iS, fontSize: 13 }}
        placeholder="New chapter name…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setOpen(false) }}
      />
      <button onClick={handleSave} disabled={saving || !name.trim()}
        style={btn(courseData.color, saving || !name.trim())}>
        {saving ? '…' : 'Add'}
      </button>
      <button onClick={() => { setOpen(false); setName('') }} style={btn(C.slate)}>✕</button>
    </div>
  )
}

// ── DELETE CUSTOM SUBJECT/CHAPTER ─────────────────────────────────────────────
async function deleteCustomSubject(course, subject, showToast, onSaved) {
  if (!confirm(`Delete custom subject "${subject}" and all its chapters? Materials are kept.`)) return
  const { error } = await supabase.from('study_course_structure')
    .delete().eq('course', course).eq('subject', subject)
  if (error) { showToast('Delete failed: ' + error.message, C.rose); return }
  showToast(`Deleted subject "${subject}"`, C.rose)
  onSaved()
}

async function deleteCustomChapter(course, subject, chapter, showToast, onSaved) {
  if (!confirm(`Delete chapter "${chapter}"? Materials are kept.`)) return
  const { error } = await supabase.from('study_course_structure')
    .delete().eq('course', course).eq('subject', subject).eq('chapter', chapter)
  if (error) { showToast('Delete failed: ' + error.message, C.rose); return }
  showToast(`Deleted chapter "${chapter}"`, C.rose)
  onSaved()
}

// ── BULK PASTE MODAL ──────────────────────────────────────────────────────────
function BulkPasteModal({ course, subject, chapter, onClose, onSaved, showToast }) {
  const [step,    setStep]    = useState('paste')
  const [rawText, setRawText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [items,   setItems]   = useState([])
  const [checked, setChecked] = useState([])
  const [saving,  setSaving]  = useState(false)

  // courseData fetched fresh from parent via prop isn't available here —
  // we read BASE_COURSES since this modal only needs color/chapter info
  const courseData = BASE_COURSES[course]
  const chapters   = courseData?.subjects[subject]?.chapters || []

  const handleParse = async () => {
    if (!rawText.trim()) { showToast('Paste something first', C.amber); return }
    setParsing(true)
    const systemPrompt = `You are a study-material parser for a coaching institute.
Extract every distinct study material item from the user's pasted text.
For each item output a JSON object:
  title, material_type (notes|formula|practice|solved|mindmap|video|currentaffairs),
  chapter (best match from: ${chapters.join(', ')} — or empty string),
  subject ("${subject}"), file_url (url or ""), description (or "")
Rules: YouTube→video, no invented URLs.
Return ONLY a valid JSON array, no fences.`
    try {
      const res  = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: systemPrompt, messages: [{ role: 'user', content: rawText.trim() }] }),
      })
      const data   = await res.json()
      const text   = (data.content || []).map(b => b.text || '').join('')
      const parsed = JSON.parse(text.replace(/```json|```/gi, '').trim())
      if (!Array.isArray(parsed) || !parsed.length) { showToast('No items detected', C.amber); setParsing(false); return }
      setItems(parsed); setChecked(parsed.map((_, i) => i)); setStep('preview')
    } catch (err) { showToast('Parse error: ' + err.message, C.rose) }
    setParsing(false)
  }

  const handleSave = async () => {
    const toSave = items.filter((_, i) => checked.includes(i))
    if (!toSave.length) { showToast('Select at least one item', C.amber); return }
    setSaving(true)
    const rows = toSave.map(it => ({ course, subject: it.subject || subject, chapter: it.chapter || chapter || '', title: it.title, material_type: it.material_type || 'notes', description: it.description || '', file_url: it.file_url || '', file_name: '', file_size: 0 }))
    const { error } = await supabase.from('study_materials').insert(rows)
    if (error) { showToast('Save failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ ${rows.length} material${rows.length > 1 ? 's' : ''} saved!`, C.green)
    setSaving(false); onSaved(); onClose()
  }

  const toggle = i => setChecked(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])
  const typeColor = { notes:{color:'#1d4ed8',bg:'#dbeafe'}, formula:{color:'#7c3aed',bg:'#ede9fe'}, practice:{color:'#15803d',bg:'#dcfce7'}, solved:{color:'#0f766e',bg:'#ccfbf1'}, mindmap:{color:'#b45309',bg:'#fef9c3'}, video:{color:'#dc2626',bg:'#fee2e2'}, currentaffairs:{color:'#64748b',bg:'#f1f5f9'} }
  const typeLabel = { notes:'Notes PDF', formula:'Formula Sheet', practice:'Practice Set', solved:'Solved Paper', mindmap:'Mind Map', video:'Video Link', currentaffairs:'Current Affairs' }
  const typeIcon  = { notes:'📄', formula:'🔣', practice:'✏️', solved:'✅', mindmap:'🗂️', video:'🎥', currentaffairs:'📰' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.white, borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 600, boxShadow: '0 -8px 40px rgba(0,0,0,.18)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '14px auto 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>📋 Bulk Paste Materials</div>
          <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          {step === 'paste' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 12, color: C.slate, background: '#f8fafc', padding: '10px 13px', borderRadius: 8, border: `1px solid ${C.border}`, lineHeight: 1.7 }}>
                Paste anything — Drive links, YouTube links, titles, or a mix. AI detects each item.
              </div>
              <div>
                <label style={lS}>Paste your content *</label>
                <textarea style={{ ...iS, resize: 'vertical', minHeight: 160, fontSize: 13, lineHeight: 1.7 }}
                  placeholder={'Fractions Notes https://drive.google.com/...\nMirror Image tricks https://youtu.be/...'}
                  value={rawText} onChange={e => setRawText(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleParse} disabled={parsing || !rawText.trim()}
                  style={{ ...btn(courseData?.color || C.navy, parsing || !rawText.trim()), flex: 1 }}>
                  {parsing ? '⏳ Detecting…' : '🔍 Detect Items with AI'}
                </button>
                <button onClick={onClose} style={btn(C.slate)}>Cancel</button>
              </div>
            </div>
          )}
          {step === 'preview' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.slate }}>{items.length} items detected</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{checked.length} selected</span>
              </div>
              {items.map((it, i) => {
                const isChecked = checked.includes(i)
                const tc = typeColor[it.material_type] || typeColor.notes
                const isVideo = it.material_type === 'video' || it.file_url?.includes('youtube') || it.file_url?.includes('youtu.be')
                return (
                  <div key={i} onClick={() => toggle(i)} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 10, border: `1px solid ${isChecked ? (courseData?.border || C.border) : C.border}`, background: isChecked ? (courseData?.bg || '#f8fafc') : C.white, cursor: 'pointer', opacity: isChecked ? 1 : 0.5 }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(i)} onClick={e => e.stopPropagation()} style={{ marginTop: 3, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{typeIcon[it.material_type] || '📄'} {it.title}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: tc.color, background: tc.bg }}>{typeLabel[it.material_type] || it.material_type}</span>
                        {it.chapter && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: courseData?.text || C.navy, background: courseData?.bg || '#f0f4ff' }}>{it.chapter}</span>}
                        {!it.chapter && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: C.amber, background: '#fef9c3' }}>⚠ chapter unknown</span>}
                      </div>
                      {it.file_url
                        ? <a href={it.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: isVideo ? C.rose : C.indigo, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isVideo ? '▶ ' : '🔗 '}{it.file_url}</a>
                        : <span style={{ fontSize: 11, color: '#94a3b8' }}>No URL</span>
                      }
                    </div>
                  </div>
                )
              })}
              <button onClick={() => { setStep('paste'); setItems([]); setChecked([]) }} style={{ ...btnSm('#f1f5f9', C.slate), alignSelf: 'flex-start', marginTop: 4 }}>← Edit paste</button>
            </div>
          )}
        </div>
        {step === 'preview' && (
          <div style={{ padding: '12px 20px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving || !checked.length} style={{ ...btn(C.green, saving || !checked.length), flex: 1 }}>
              {saving ? '⏳ Saving…' : `✅ Save ${checked.length} material${checked.length !== 1 ? 's' : ''}`}
            </button>
            <button onClick={onClose} style={btn(C.slate)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MATERIAL CARD ─────────────────────────────────────────────────────────────
function MaterialCard({ mat, onDelete, showToast }) {
  const [deleting, setDeleting] = useState(false)
  const courseData = BASE_COURSES[mat.course]
  const bucket = courseData?.FILE_BUCKET || 'study-materials'

  const handleDelete = async () => {
    if (!confirm('Delete this material?')) return
    setDeleting(true)
    if (mat.file_name) await supabase.storage.from(bucket).remove([mat.file_name])
    const { error } = await supabase.from('study_materials').delete().eq('id', mat.id)
    if (error) { showToast('Delete failed', C.rose); setDeleting(false); return }
    showToast('Deleted ✓', C.rose); onDelete()
  }

  const isLink  = !mat.file_name && mat.file_url
  const isVideo = mat.material_type === 'video' || mat.file_url?.includes('youtube') || mat.file_url?.includes('youtu.be')

  return (
    <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{MATERIAL_TYPES.find(t => t.key === mat.material_type)?.icon || '📄'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{mat.title}</span>
          <MaterialTypeBadge typeKey={mat.material_type} />
        </div>
        {mat.description && <div style={{ fontSize: 12, color: C.slate, marginBottom: 5 }}>{mat.description}</div>}
        <div style={{ fontSize: 11, color: C.slate }}>
          {mat.chapter}
          {mat.file_size > 0 && <span style={{ marginLeft: 8 }}>· {(mat.file_size / 1024).toFixed(0)} KB</span>}
          {mat.created_at && <span style={{ marginLeft: 8 }}>· {new Date(mat.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {mat.file_url && (
            <a href={mat.file_url} target="_blank" rel="noreferrer" style={btnSm(isVideo ? '#fee2e2' : '#eff6ff', isVideo ? C.rose : C.navy)}>
              {isVideo ? '▶ Watch' : isLink ? '🔗 Open Link' : '📥 Download'}
            </a>
          )}
          <button onClick={handleDelete} disabled={deleting} style={btnSm('#fee2e2', C.rose)}>
            {deleting ? '…' : '🗑 Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SUBJECT PANEL ─────────────────────────────────────────────────────────────
function SubjectPanel({ course, subjectName, subjectData, isCustomSubject, materials, onRefetch, showToast, customChapters, onStructureChange, onNavigate }) {
  const [expandedChapter, setExpandedChapter] = useState(null)
  const [showUpload,      setShowUpload]      = useState(false)
  const [uploadChapter,   setUploadChapter]   = useState('')
  const [filterType,      setFilterType]      = useState('all')
  const { counts: qCounts } = useQBankCountsByChapter(subjectName)

  const courseData = BASE_COURSES[course]

  // Merge base chapters + custom chapters (deduped)
  const allChapters = useMemo(() => {
    const base    = subjectData?.chapters || []
    const custom  = customChapters || []
    const seen    = new Set(base.map(c => c.toLowerCase()))
    const extras  = custom.filter(c => !seen.has(c.toLowerCase()))
    return [...base, ...extras]
  }, [subjectData, customChapters])

  const baseChapterSet = useMemo(() => new Set((subjectData?.chapters || []).map(c => c.toLowerCase())), [subjectData])

  const subjectMats = useMemo(() => materials.filter(m => m.subject === subjectName), [materials, subjectName])
  const countByChapter = useMemo(() => { const map = {}; subjectMats.forEach(m => { map[m.chapter] = (map[m.chapter] || 0) + 1 }); return map }, [subjectMats])
  const countByType    = useMemo(() => { const map = {}; subjectMats.forEach(m => { map[m.material_type] = (map[m.material_type] || 0) + 1 }); return map }, [subjectMats])

  const handleUploadForChapter = (ch) => { setUploadChapter(ch); setShowUpload(true) }

  return (
    <div>
      {showUpload && (
        <BulkPasteModal course={course} subject={subjectName} chapter={uploadChapter}
          onClose={() => setShowUpload(false)} onSaved={onRefetch} showToast={showToast} />
      )}

      {/* Subject header */}
      <div style={{ ...cardS, borderTop: `3px solid ${courseData.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{subjectData?.icon} {subjectName}</span>
              {isCustomSubject && (
                <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#fef9c3', color: '#b45309' }}>custom</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.slate, marginTop: 2 }}>
              {allChapters.length} chapters · {subjectMats.length} materials
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isCustomSubject && (
              <button onClick={() => deleteCustomSubject(course, subjectName, showToast, onStructureChange)}
                style={btnSm('#fee2e2', C.rose)}>🗑 Delete subject</button>
            )}
            <button onClick={() => { setUploadChapter(''); setShowUpload(true) }} style={btn(courseData.color)}>
              📋 Bulk Paste
            </button>
          </div>
        </div>

        {/* Type filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterType('all')} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1px solid ${filterType === 'all' ? courseData.color : C.border}`, background: filterType === 'all' ? courseData.bg : '#fff', color: filterType === 'all' ? courseData.text : C.slate, cursor: 'pointer' }}>
            All ({subjectMats.length})
          </button>
          {MATERIAL_TYPES.filter(t => countByType[t.key]).map(t => (
            <button key={t.key} onClick={() => setFilterType(t.key)} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1px solid ${filterType === t.key ? t.color : C.border}`, background: filterType === t.key ? t.bg : '#fff', color: filterType === t.key ? t.color : C.slate, cursor: 'pointer' }}>
              {t.icon} {t.label} ({countByType[t.key]})
            </button>
          ))}
        </div>
      </div>

      {/* Chapter list */}
      {allChapters.map((ch) => {
        const chMats     = subjectMats.filter(m => m.chapter === ch && (filterType === 'all' || m.material_type === filterType))
        const isExpanded = expandedChapter === ch
        const total      = countByChapter[ch] || 0
        const isCustomCh = !baseChapterSet.has(ch.toLowerCase())

        return (
          <div key={ch} style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 6, overflow: 'hidden' }}>
            <div onClick={() => setExpandedChapter(isExpanded ? null : ch)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', cursor: 'pointer', background: isExpanded ? courseData.bg : C.white, transition: 'background .12s' }}>
              <span style={{ fontSize: 13, color: isExpanded ? courseData.text : C.navy, fontWeight: isExpanded ? 700 : 500, flex: 1 }}>
                {ch}
                {isCustomCh && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: '#fef9c3', color: '#b45309' }}>custom</span>}
              </span>
              {total > 0
  ? <Badge text={`${total}`} color={courseData.text} bg={courseData.bg} />
  : <Badge text="—" color="#94a3b8" bg="#f1f5f9" />
}
{qCounts[ch] > 0 && (
  <span
    onClick={e => {
      e.stopPropagation()
      onNavigate?.('questionbank')
      EventBus.emit(GNSI_EVENTS.NAVIGATE_TO, { module: 'questionbank', params: { subject: subjectName, chapter: ch } })
    }}
    title={`${qCounts[ch]} questions in QBank — click to open`}
    style={{ padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', cursor: 'pointer', whiteSpace: 'nowrap' }}
  >
    📚 {qCounts[ch]} Q
  </span>
)}
              <button onClick={e => { e.stopPropagation(); handleUploadForChapter(ch) }} style={btnSm(courseData.bg, courseData.text)}>+ Add</button>
              {isCustomCh && (
                <button onClick={e => { e.stopPropagation(); deleteCustomChapter(course, subjectName, ch, showToast, onStructureChange) }}
                  style={btnSm('#fee2e2', C.rose)}>🗑</button>
              )}
              <span style={{ fontSize: 11, color: C.slate }}>{isExpanded ? '▲' : '▼'}</span>
            </div>
            {isExpanded && (
              <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${C.border}` }}>
                {chMats.length === 0
                  ? <div style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
                      No materials yet.
                      <button onClick={() => handleUploadForChapter(ch)} style={{ ...btnSm(courseData.bg, courseData.text), marginLeft: 10 }}>📋 Paste now</button>
                    </div>
                  : <div style={{ display: 'grid', gap: 8 }}>{chMats.map(m => <MaterialCard key={m.id} mat={m} onDelete={onRefetch} showToast={showToast} />)}</div>
                }
              </div>
            )}
          </div>
        )
      })}

      {/* Add chapter inline */}
      <AddChapterInline
        course={course} subject={subjectName} courseData={courseData}
        existingChapters={allChapters} onSaved={onStructureChange} showToast={showToast}
      />
    </div>
  )
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function CourseStats({ course, materials, mergedCourses }) {
  const courseData = mergedCourses[course]
  const courseMats = materials.filter(m => m.course === course)
  const isMobile   = useIsMobile()

  const bySubject = useMemo(() => {
    const map = {}
    Object.keys(courseData.subjects).forEach(s => { map[s] = 0 })
    courseMats.forEach(m => { map[m.subject] = (map[m.subject] || 0) + 1 })
    return map
  }, [courseMats, courseData])

  const byType = useMemo(() => {
    const map = {}; courseMats.forEach(m => { map[m.material_type] = (map[m.material_type] || 0) + 1 }); return map
  }, [courseMats])

  const totalChapters   = Object.values(courseData.subjects).reduce((a, s) => a + s.chapters.length, 0)
  const coveredChapters = useMemo(() => new Set(courseMats.map(m => `${m.subject}::${m.chapter}`)).size, [courseMats])
  const pct = totalChapters > 0 ? Math.round((coveredChapters / totalChapters) * 100) : 0

  return (
    <div style={{ ...cardS, borderTop: `3px solid ${courseData.color}` }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 14 }}>📊 Coverage Overview — {courseData.label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Materials', val: courseMats.length, color: courseData.color },
          { label: 'Subjects', val: Object.keys(courseData.subjects).length, color: C.navy },
          { label: 'Chapters covered', val: `${coveredChapters}/${totalChapters}`, color: pct >= 70 ? C.green : pct >= 40 ? C.amber : C.rose },
          { label: 'Coverage', val: `${pct}%`, color: pct >= 70 ? C.green : pct >= 40 ? C.amber : C.rose },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 14px', borderRadius: 9, background: '#f8fafc', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.slate, marginBottom: 5 }}><span>Chapter coverage</span><span>{pct}%</span></div>
        <div style={{ height: 8, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct >= 70 ? C.green : pct >= 40 ? C.amber : C.rose, transition: 'width .4s' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 8, marginBottom: 14 }}>
        {Object.entries(bySubject).map(([sub, cnt]) => (
          <div key={sub} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#1e293b' }}>{courseData.subjects[sub]?.icon} {sub}</span>
            <Badge text={`${cnt} files`} color={cnt > 0 ? courseData.text : '#94a3b8'} bg={cnt > 0 ? courseData.bg : '#f1f5f9'} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>By material type</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MATERIAL_TYPES.filter(t => byType[t.key]).map(t => (
          <span key={t.key} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: t.color, background: t.bg }}>{t.icon} {t.label}: {byType[t.key]}</span>
        ))}
        {!courseMats.length && <span style={{ fontSize: 12, color: '#94a3b8' }}>No materials yet</span>}
      </div>
    </div>
  )
}

// ── MOBILE SUBJECT DRAWER ─────────────────────────────────────────────────────
function SubjectDrawer({ open, onClose, course, subjects, customSubjectSet, courseMaterials, activeSubject, onSelect }) {
  const courseData = BASE_COURSES[course]
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, background: 'rgba(0,0,0,.40)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: C.white, borderRadius: '16px 16px 0 0', padding: '12px 16px 32px', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 14px' }} />
        <div style={{ fontSize: 12, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Select Subject</div>
        {Object.keys(subjects).map(s => {
          const cnt      = courseMaterials.filter(m => m.subject === s).length
          const isActive = activeSubject === s
          const isCustom = customSubjectSet.has(s)
          return (
            <div key={s} onClick={() => { onSelect(s); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderRadius: 9, cursor: 'pointer', background: isActive ? courseData.bg : 'transparent', marginBottom: 3 }}>
              <span style={{ fontSize: 20 }}>{subjects[s].icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? courseData.text : '#374151', flex: 1 }}>
                {s}
                {isCustom && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: '#fef9c3', color: '#b45309', padding: '1px 5px', borderRadius: 4 }}>custom</span>}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: cnt > 0 ? courseData.bg : '#f1f5f9', color: cnt > 0 ? courseData.text : '#94a3b8' }}>{cnt}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function StudyMaterial({ currentUser, perms, onNavigate }) {
  const [activeCourse,   setActiveCourse]   = useState('sainik')
  const [activeSubject,  setActiveSubject]  = useState(null)
  const [activeView,     setActiveView]     = useState('subjects')
  const [materials,      setMaterials]      = useState([])
  const [structure,      setStructure]      = useState([])   // rows from study_course_structure
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [toast,          setToast]          = useState(null)
  const [drawerOpen,     setDrawerOpen]     = useState(false)
  const [showAddSubject, setShowAddSubject] = useState(false)
  const isMobile = useIsMobile()

  const showToast = (msg, color = C.navy) => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }

  // ── FETCH ─────────────────────────────────────────────────────────────────
  const refetchMaterials = useCallback(async () => {
    const { data, error } = await supabase.from('study_materials').select('*').order('created_at', { ascending: false })
    if (error) showToast('Failed to load materials', C.rose)
    else setMaterials(data || [])
  }, [])

  const refetchStructure = useCallback(async () => {
    const { data, error } = await supabase.from('study_course_structure').select('*').order('created_at', { ascending: true })
    if (error) showToast('Failed to load structure', C.rose)
    else setStructure(data || [])
  }, [])

  const refetch = useCallback(async () => {
    setLoading(true)
    await Promise.all([refetchMaterials(), refetchStructure()])
    setLoading(false)
  }, [refetchMaterials, refetchStructure])

  useEffect(() => { refetch() }, [refetch])

  // ── MERGE BASE + CUSTOM STRUCTURE ─────────────────────────────────────────
  // mergedCourses mirrors the shape of BASE_COURSES but with custom subjects/chapters injected
  const mergedCourses = useMemo(() => {
    const result = {}
    Object.entries(BASE_COURSES).forEach(([courseKey, courseVal]) => {
      // Deep-clone subjects
      const subjects = {}
      Object.entries(courseVal.subjects).forEach(([subName, subVal]) => {
        subjects[subName] = { ...subVal, chapters: [...subVal.chapters] }
      })

      // Inject custom subjects (rows where chapter is null)
      const customSubjects = structure.filter(r => r.course === courseKey && !r.chapter)
      customSubjects.forEach(r => {
        if (!subjects[r.subject]) subjects[r.subject] = { icon: r.icon || '📁', chapters: [] }
      })

      // Inject custom chapters
      const customChapters = structure.filter(r => r.course === courseKey && r.chapter)
      customChapters.forEach(r => {
        if (!subjects[r.subject]) subjects[r.subject] = { icon: '📁', chapters: [] }
        if (!subjects[r.subject].chapters.includes(r.chapter)) {
          subjects[r.subject].chapters.push(r.chapter)
        }
      })

      result[courseKey] = { ...courseVal, subjects }
    })
    return result
  }, [structure])

  // Set of custom subject names per course (for badge display)
  const customSubjectSet = useMemo(() => {
    return new Set(structure.filter(r => r.course === activeCourse && !r.chapter).map(r => r.subject))
  }, [structure, activeCourse])

  // Custom chapters per subject
  const customChaptersBySubject = useMemo(() => {
    const map = {}
    structure.filter(r => r.course === activeCourse && r.chapter).forEach(r => {
      if (!map[r.subject]) map[r.subject] = []
      map[r.subject].push(r.chapter)
    })
    return map
  }, [structure, activeCourse])

  useEffect(() => {
    const firstSubject = Object.keys(mergedCourses[activeCourse].subjects)[0]
    setActiveSubject(firstSubject)
    setActiveView('subjects')
    setSearch('')
  }, [activeCourse])

  const courseData  = mergedCourses[activeCourse]
  const subjects    = courseData.subjects
  const subjectList = Object.keys(subjects)

  const materialCountByCourse = useMemo(() => {
    const map = {}; Object.keys(BASE_COURSES).forEach(k => { map[k] = 0 })
    materials.forEach(m => { if (map[m.course] !== undefined) map[m.course]++ })
    return map
  }, [materials])

  const courseMaterials = useMemo(() => materials.filter(m => m.course === activeCourse), [materials, activeCourse])

  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return courseMaterials
    const q = search.toLowerCase()
    return courseMaterials.filter(m => m.title?.toLowerCase().includes(q) || m.chapter?.toLowerCase().includes(q) || m.subject?.toLowerCase().includes(q))
  }, [courseMaterials, search])

  const existingSubjectNames = subjectList

  return (
    <div style={{ padding: isMobile ? '16px 12px' : 24, fontFamily: 'system-ui,sans-serif', background: C.bg, minHeight: '100vh' }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {showAddSubject && (
        <AddSubjectModal
          course={activeCourse}
          courseData={BASE_COURSES[activeCourse]}
          existingSubjects={existingSubjectNames}
          onClose={() => setShowAddSubject(false)}
          onSaved={refetchStructure}
          showToast={showToast}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: C.slate, marginBottom: 4 }}>GNSI Portal</div>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: C.navy, letterSpacing: '-.02em' }}>Study Materials</div>
        <div style={{ fontSize: 12, color: C.slate, marginTop: 3 }}>Navodaya · Sainik · Foundation</div>
      </div>

      {/* Course tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {Object.entries(BASE_COURSES).map(([key, c]) => (
          <button key={key} onClick={() => setActiveCourse(key)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: isMobile ? '8px 14px' : '10px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: activeCourse === key ? `2px solid ${c.color}` : `2px solid ${C.border}`, background: activeCourse === key ? c.bg : C.white, color: activeCourse === key ? c.text : C.slate, cursor: 'pointer', transition: 'all .12s', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
            {isMobile ? c.short : c.label}
            <span style={{ padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: activeCourse === key ? 'rgba(0,0,0,.08)' : '#f1f5f9', color: activeCourse === key ? c.text : C.slate }}>
              {materialCountByCourse[key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Course banner */}
      <div style={{ ...cardS, marginBottom: 16, display: 'flex', gap: 14, alignItems: 'center', borderLeft: `4px solid ${courseData.color}`, borderRadius: '0 12px 12px 0', padding: '12px 16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{courseData.label}</div>
          <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>{courseData.exam} · {subjectList.length} subjects</div>
        </div>
        <button onClick={() => setShowAddSubject(true)} style={btn(courseData.color)}>
          ➕ Add Subject
        </button>
        <button onClick={() => setActiveView(activeView === 'stats' ? 'subjects' : 'stats')} style={btn(activeView === 'stats' ? courseData.color : C.slate)}>
          {activeView === 'stats' ? '📚 Subjects' : '📊 Stats'}
        </button>
      </div>

      {activeView === 'stats' ? (
        <CourseStats course={activeCourse} materials={materials} mergedCourses={mergedCourses} />
      ) : isMobile ? (
        <div>
          <div style={{ ...cardS, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setDrawerOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 9, border: `1.5px solid ${courseData.color}`, background: courseData.bg, color: courseData.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 1 }}>
              <span style={{ fontSize: 18 }}>{subjects[activeSubject]?.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{activeSubject}</span>
              <span>▾</span>
            </button>
            <div style={{ position: 'relative', flex: 1 }}>
              <input style={{ ...iS, fontSize: 12, padding: '8px 10px' }} placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.slate }}>✕</button>}
            </div>
          </div>

          <SubjectDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} course={activeCourse} subjects={subjects} customSubjectSet={customSubjectSet} courseMaterials={courseMaterials} activeSubject={activeSubject} onSelect={s => { setActiveSubject(s); setSearch('') }} />

          {loading ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 40, color: C.slate }}>⏳ Loading…</div>
          ) : activeSubject ? (
            <SubjectPanel
              key={`${activeCourse}-${activeSubject}`}
              course={activeCourse} subjectName={activeSubject}
              subjectData={subjects[activeSubject] || { icon: '📁', chapters: [] }}
              isCustomSubject={customSubjectSet.has(activeSubject)}
              materials={search.trim() ? filteredMaterials : courseMaterials}
              customChapters={customChaptersBySubject[activeSubject] || []}
              onRefetch={refetchMaterials} onStructureChange={refetchStructure} showToast={showToast}
              onNavigate={onNavigate}
            />
          ) : (
            <div style={{ ...cardS, textAlign: 'center', padding: 40, color: '#94a3b8' }}>Select a subject above</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18, alignItems: 'start' }}>
          {/* Sidebar */}
          <div style={{ ...cardS, padding: 12, position: 'sticky', top: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, padding: '0 4px' }}>Subjects</div>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input style={{ ...iS, fontSize: 12, padding: '7px 10px 7px 28px' }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.slate }}>🔍</span>
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.slate }}>✕</button>}
            </div>
            {subjectList.map(s => {
              const cnt      = courseMaterials.filter(m => m.subject === s).length
              const isActive = activeSubject === s
              const isCustom = customSubjectSet.has(s)
              return (
                <div key={s} onClick={() => { setActiveSubject(s); setSearch('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', background: isActive ? courseData.bg : 'transparent', marginBottom: 3, transition: 'background .1s' }}>
                  <span style={{ fontSize: 16 }}>{subjects[s].icon}</span>
                  <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? courseData.text : '#374151', flex: 1 }}>
                    {s}
                    {isCustom && <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, background: '#fef9c3', color: '#b45309', padding: '1px 5px', borderRadius: 4 }}>custom</span>}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: cnt > 0 ? courseData.bg : '#f1f5f9', color: cnt > 0 ? courseData.text : '#94a3b8' }}>{cnt}</span>
                </div>
              )
            })}
          </div>

          {/* Main */}
          <div>
            {loading ? (
              <div style={{ ...cardS, textAlign: 'center', padding: 48, color: C.slate }}>⏳ Loading materials…</div>
            ) : activeSubject ? (
              <SubjectPanel
                key={`${activeCourse}-${activeSubject}`}
                course={activeCourse} subjectName={activeSubject}
                subjectData={subjects[activeSubject] || { icon: '📁', chapters: [] }}
                isCustomSubject={customSubjectSet.has(activeSubject)}
                materials={search.trim() ? filteredMaterials : courseMaterials}
                customChapters={customChaptersBySubject[activeSubject] || []}
                onRefetch={refetchMaterials} onStructureChange={refetchStructure} showToast={showToast}
                onNavigate={onNavigate}
              />
            ) : (
              <div style={{ ...cardS, textAlign: 'center', padding: 48, color: '#94a3b8' }}>Select a subject from the sidebar</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}