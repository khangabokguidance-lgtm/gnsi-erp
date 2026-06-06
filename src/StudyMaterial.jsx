// StudyMaterial.jsx — GNSI Portal
// Multi-course study material manager
// Courses: Navodaya (JNVST), Sainik (AISSEE), Foundation
// Supabase tables: study_materials, study_material_files

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'

// ── COURSE & SUBJECT DATA ─────────────────────────────────────────────────────

const COURSES = {
  sainik: {
    label: 'Sainik School',
    short: 'AISSEE',
    exam: 'AISSEE · Class 6 & 9',
    color: '#16a34a',
    bg: '#dcfce7',
    border: '#86efac',
    text: '#15803d',
    FILE_BUCKET: 'study-materials-sainik',
    subjects: {
      Mathematics: {
        icon: '📐',
        chapters: [
          'Natural Numbers','LCM and HCF','Fractions','Decimal Numbers',
          'Ratio and Proportion','Percentage','Profit and Loss','Simple Interest',
          'Average','Unitary Method','Area and Perimeter','Volume of Cube and Cuboids',
          'Speed and Time','Lines and Angles','Types of Angles','Circle',
          'Prime and Composite Numbers','Roman Numerals','Simplification',
          'Conversion of Units','Operation on Numbers','Temperature',
          'Plane Figures','Arranging of Fractions','Complementary and Supplementary Angles',
        ],
      },
      Intelligence: {
        icon: '🧠',
        chapters: [
          'Analogies','Venn Diagram','Paper Folding','Embedded Figure',
          'Geometrical Figure Completion','Space Visualisation','Order and Ranking',
          'Coding Decoding','Mathematical Operations','Blood Relations',
          'Sitting Arrangement','Mirror Image','Figure Matching','Figure Series',
          'Odd Man Out','Pattern Completion','Classification','Word Formation',
          'Dictionary Word Order','Series Completion','Direction Test','Clock and Calendar',
        ],
      },
      'English Language': {
        icon: '📖',
        chapters: [
          'Comprehension Passage','Preposition','Article','Vocabulary',
          'Verbs and Types','Confusing Words','Question Tags','Types of Sentence',
          'Tense Forms','Kinds of Nouns','Kinds of Pronouns','Correct Spelling',
          'Ordering of Words','Sentence Formation','Antonyms','Synonyms',
          'Adjectives','Interjection','Idiom and Phrases','Collective Nouns',
          'Number and Gender','Adverbs','Rhyming Words','Singular and Plural',
        ],
      },
      'General Knowledge': {
        icon: '🌍',
        chapters: [
          'Scientific Devices','Icons and Symbols of India','Major Religions of India',
          'Art and Culture','Defence Awareness','Sports and Games',
          'Relationship Animals and Humans','Taste and Digestion',
          'Cooking and Preserving','Germination and Seed Dispersal',
          'Traditional Water Harvesting','Water Pollution','Mountain Terrain',
          'Historical Monuments','Shape of Earth','Non-Renewable Energy',
          'Food Culture and Habitat','Young Ones of Animals','Functions of Body Parts',
          'International Organizations','Indian Literary Awards','Natural Calamities',
          'Evaporation and Water Cycle','Life of Farmers','Tribal Communities',
        ],
      },
      'Social Studies': {
        icon: '🗺️',
        chapters: [
          'Ancient India','Medieval India','Modern India',
          'Indian Constitution','Physical Geography of India',
          'Resources and Industries','Economic Geography','Disaster Management',
        ],
      },
    },
  },
  navodaya: {
    label: 'Navodaya Vidyalaya',
    short: 'JNVST',
    exam: 'JNVST · Class 6 & 9',
    color: '#2563eb',
    bg: '#dbeafe',
    border: '#93c5fd',
    text: '#1d4ed8',
    FILE_BUCKET: 'study-materials-navodaya',
    subjects: {
      'Mental Ability': {
        icon: '🧩',
        chapters: [
          'Odd One Out','Figure Series','Pattern Completion','Analogy',
          'Geometrical Figure Completion','Mirror Image','Punched Hole Paper Folding',
          'Space Visualisation','Embedded Figures','Coding-Decoding',
          'Arithmetic Operations in Figures','Series','Direction Sense','Clock',
        ],
      },
      Arithmetic: {
        icon: '🔢',
        chapters: [
          'Natural Numbers','LCM and HCF','Fractions','Decimals',
          'Simplification','Percentage','Ratio and Proportion',
          'Average','Profit and Loss','Simple Interest',
          'Area and Perimeter','Volume','Speed and Distance',
          'Unitary Method','Roman Numerals','Number System',
          'Conversion of Units','Word Problems',
        ],
      },
      'English Language': {
        icon: '📗',
        chapters: [
          'Reading Comprehension','Fill in the Blanks','Sentence Arrangement',
          'Synonyms','Antonyms','One-word Substitution','Correct Spelling',
          'Phrase Meaning','Grammar Usage','Tenses','Articles',
        ],
      },
      'Hindi Language': {
        icon: '📕',
        chapters: [
          'Gadhyansh Bodh','Vakya Purti','Paryayvachi Shabd','Vilom Shabd',
          'Shuddh Vartani','Muhavare aur Lokokti','Sandhi','Samas',
          'Anekarthi Shabd','Vakya Nirman',
        ],
      },
    },
  },
  foundation: {
    label: 'Foundation Course',
    short: 'Class 5–8',
    exam: 'Board + Competitive base',
    color: '#d97706',
    bg: '#fef9c3',
    border: '#fde68a',
    text: '#b45309',
    FILE_BUCKET: 'study-materials-foundation',
    subjects: {
      Mathematics: {
        icon: '📐',
        chapters: [
          'Number Systems','Factors and Multiples','Fractions and Decimals',
          'Integers','Algebra — Expressions and Equations','Ratio and Proportion',
          'Percentage and Its Applications','Profit, Loss and Discount',
          'Simple and Compound Interest','Lines, Angles and Triangles',
          'Quadrilaterals and Polygons','Area and Perimeter',
          'Surface Area and Volume','Statistics and Data Handling',
          'Exponents and Powers','Symmetry and Transformations',
          'Coordinate Geometry Basics','Mensuration','Speed, Time, Distance',
          'Probability Basics',
        ],
      },
      Science: {
        icon: '🔬',
        chapters: [
          'Food and Nutrition','Materials and Their Properties',
          'The Living World — Plants','The Living World — Animals',
          'Force, Motion and Energy','Light and Sound',
          'Heat and Temperature','Electricity and Magnetism',
          'Acids, Bases and Salts','Chemical Reactions Basics',
          'Cell — The Unit of Life','Reproduction in Plants and Animals',
          'Human Body Systems','Soil and Water','Air and Atmosphere',
          'Environment and Ecology','Natural Resources','Disaster Management',
        ],
      },
      English: {
        icon: '📘',
        chapters: [
          'Parts of Speech','Tenses','Voice — Active and Passive',
          'Narration — Direct and Indirect','Articles and Prepositions',
          'Subject-Verb Agreement','Comprehension Passages',
          'Letter Writing','Essay Writing','Vocabulary Development',
          'Synonyms, Antonyms and Homophones','Idioms and Phrases',
          'One-word Substitution','Punctuation','Sentence Transformation',
        ],
      },
      'Social Science': {
        icon: '🗺️',
        chapters: [
          'Ancient Civilisations','Medieval India','Mughal Empire',
          'British Rule and Freedom Struggle','Post-Independence India',
          'Physical Features of India','Climate of India',
          'Natural Vegetation and Wildlife','Population and Urbanisation',
          'Resources — Land, Water, Minerals','Agriculture and Industries',
          'Indian Constitution','Panchayati Raj','Democracy and Elections',
          'Economic Concepts','Globalisation',
        ],
      },
      Hindi: {
        icon: '📙',
        chapters: [
          'Gadhya Bodh','Padhya Bodh','Vyakaran — Sangya, Sarvanam',
          'Visheshan and Kriya','Kal aur Vachya','Sandhi aur Samas',
          'Muhavare aur Lokokti','Patra Lekhan','Nibandh Lekhan',
          'Anuchhed Lekhan',
        ],
      },
    },
  },
}

const MATERIAL_TYPES = [
  { key: 'notes',    label: 'Notes PDF',      icon: '📄', color: '#1d4ed8', bg: '#dbeafe' },
  { key: 'formula',  label: 'Formula Sheet',   icon: '🔣', color: '#7c3aed', bg: '#ede9fe' },
  { key: 'practice', label: 'Practice Set',    icon: '✏️', color: '#15803d', bg: '#dcfce7' },
  { key: 'solved',   label: 'Solved Paper',    icon: '✅', color: '#0f766e', bg: '#ccfbf1' },
  { key: 'mindmap',  label: 'Mind Map',        icon: '🗂️', color: '#b45309', bg: '#fef9c3' },
  { key: 'video',    label: 'Video Link',      icon: '🎥', color: '#dc2626', bg: '#fee2e2' },
  { key: 'currentaffairs', label: 'Current Affairs', icon: '📰', color: '#64748b', bg: '#f1f5f9' },
]

const FILE_BUCKET = 'study-materials'

// ── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#1e3a5f', slate: '#64748b', border: '#e2e8f0',
  white: '#ffffff', bg: '#f8fafc', green: '#16a34a',
  rose: '#dc2626', amber: '#d97706', indigo: '#4f46e5',
}
const iS = {
  width: '100%', padding: '8px 11px', borderRadius: 7,
  border: `1px solid ${C.border}`, fontSize: 13,
  background: C.white, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
}
const lS = {
  display: 'block', fontSize: 11, fontWeight: 700, color: C.slate,
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em',
}
const cardS = {
  background: C.white, borderRadius: 12,
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: '18px 20px', marginBottom: 14,
}
const btn = (bg, dis = false) => ({
  padding: '8px 16px', borderRadius: 8, background: dis ? '#94a3b8' : bg,
  color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
  cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .7 : 1,
})
const btnSm = (bg, color = '#fff') => ({
  padding: '4px 10px', borderRadius: 6, background: bg,
  color, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
})

// ── HELPERS ───────────────────────────────────────────────────────────────────
function Toast({ msg, color }) {
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 99999,
      background: '#fff', border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${color}`, borderRadius: 10,
      padding: '11px 18px', fontSize: 13, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 360,
    }}>
      {msg}
    </div>
  )
}

function Badge({ text, color, bg }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      color, background: bg, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

function MaterialTypeBadge({ typeKey }) {
  const t = MATERIAL_TYPES.find(m => m.key === typeKey) || MATERIAL_TYPES[0]
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
      color: t.color, background: t.bg, display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {t.icon} {t.label}
    </span>
  )
}

// ── UPLOAD MODAL ──────────────────────────────────────────────────────────────
function UploadModal({ course, subject, chapter, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    title: '',
    material_type: 'notes',
    description: '',
    chapter: chapter || '',
    link_url: '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const courseData = COURSES[course]
  const chapters = courseData?.subjects[subject]?.chapters || []

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Enter a title', C.amber); return }
    if (!form.chapter) { showToast('Select a chapter', C.amber); return }
    if (!file && !form.link_url.trim()) { showToast('Upload a file or add a link', C.amber); return }
    setSaving(true)

    let file_url = form.link_url.trim()
    let file_name = ''
    let file_size = 0

    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${course}/${subject.replace(/\s+/g, '_')}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from(FILE_BUCKET)
        .upload(path, file, { upsert: true })
      if (upErr) { showToast('Upload failed: ' + upErr.message, C.rose); setSaving(false); return }
      const { data } = supabase.storage.from(FILE_BUCKET).getPublicUrl(path)
      file_url = data.publicUrl
      file_name = file.name
      file_size = file.size
    }

    const payload = {
      course,
      subject,
      chapter: form.chapter,
      title: form.title.trim(),
      material_type: form.material_type,
      description: form.description.trim(),
      file_url,
      file_name,
      file_size,
    }

    const { error } = await supabase.from('study_materials').insert(payload)
    if (error) { showToast('Save failed: ' + error.message, C.rose); setSaving(false); return }
    showToast('✅ Material saved!', C.green)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: C.white, borderRadius: 14, padding: '24px 26px',
        width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>
            📤 Upload Study Material
          </div>
          <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕ Close</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={lS}>Title *</label>
            <input style={iS} value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Fractions — Complete Notes" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lS}>Chapter *</label>
              <select style={iS} value={form.chapter} onChange={e => set('chapter', e.target.value)}>
                <option value="">Select chapter</option>
                {chapters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lS}>Material type *</label>
              <select style={iS} value={form.material_type} onChange={e => set('material_type', e.target.value)}>
                {MATERIAL_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={lS}>Description</label>
            <textarea style={{ ...iS, resize: 'vertical' }} rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional — brief description of this material" />
          </div>

          <div style={{
            padding: '14px 16px', borderRadius: 9,
            border: `2px dashed ${C.border}`, background: '#f8fafc',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: C.slate, marginBottom: 8 }}>
              {file ? `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)` : 'Upload a PDF, image, or doc'}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()}
              style={btn(C.navy)}>
              {file ? '🔄 Change File' : '📎 Choose File'}
            </button>
            <input ref={fileRef} type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])} />
            {file && (
              <button type="button" onClick={() => setFile(null)}
                style={{ ...btnSm('#fee2e2', C.rose), marginLeft: 8 }}>✕ Remove</button>
            )}
          </div>

          <div>
            <label style={lS}>Or paste a link (YouTube / Drive / URL)</label>
            <input style={iS} value={form.link_url}
              onChange={e => set('link_url', e.target.value)}
              placeholder="https://..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={handleSave} disabled={saving} style={btn(C.green, saving)}>
            {saving ? '⏳ Saving…' : '✅ Save Material'}
          </button>
          <button onClick={onClose} style={btn(C.slate)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── MATERIAL CARD ─────────────────────────────────────────────────────────────
function MaterialCard({ mat, onDelete, showToast }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Delete this material?')) return
    setDeleting(true)
    if (mat.file_name) {
      const path = `${mat.course}/${mat.subject.replace(/\s+/g, '_')}/${mat.file_name}`
      await supabase.storage.from(FILE_BUCKET).remove([path])
    }
    const { error } = await supabase.from('study_materials').delete().eq('id', mat.id)
    if (error) { showToast('Delete failed', C.rose); setDeleting(false); return }
    showToast('Deleted ✓', C.rose)
    onDelete()
  }

  const isLink = !mat.file_name && mat.file_url
  const isVideo = mat.material_type === 'video' || mat.file_url?.includes('youtube') || mat.file_url?.includes('youtu.be')

  return (
    <div style={{
      background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
      padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
        {MATERIAL_TYPES.find(t => t.key === mat.material_type)?.icon || '📄'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{mat.title}</span>
          <MaterialTypeBadge typeKey={mat.material_type} />
        </div>
        {mat.description && (
          <div style={{ fontSize: 12, color: C.slate, marginBottom: 5 }}>{mat.description}</div>
        )}
        <div style={{ fontSize: 11, color: C.slate }}>
          {mat.chapter}
          {mat.file_size > 0 && (
            <span style={{ marginLeft: 8 }}>· {(mat.file_size / 1024).toFixed(0)} KB</span>
          )}
          {mat.created_at && (
            <span style={{ marginLeft: 8 }}>
              · {new Date(mat.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {mat.file_url && (
            <a href={mat.file_url} target="_blank" rel="noreferrer"
              style={btnSm(isVideo ? '#fee2e2' : '#eff6ff', isVideo ? C.rose : C.navy)}>
              {isVideo ? '▶ Watch' : isLink ? '🔗 Open Link' : '📥 Download'}
            </a>
          )}
          <button onClick={handleDelete} disabled={deleting}
            style={btnSm('#fee2e2', C.rose)}>
            {deleting ? '…' : '🗑 Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SUBJECT PANEL ─────────────────────────────────────────────────────────────
function SubjectPanel({ course, subjectName, subjectData, materials, onRefetch, showToast }) {
  const [expandedChapter, setExpandedChapter] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadChapter, setUploadChapter] = useState('')
  const [filterType, setFilterType] = useState('all')

  const courseData = COURSES[course]

  const subjectMats = useMemo(() =>
    materials.filter(m => m.subject === subjectName),
    [materials, subjectName]
  )

  const countByChapter = useMemo(() => {
    const map = {}
    subjectMats.forEach(m => { map[m.chapter] = (map[m.chapter] || 0) + 1 })
    return map
  }, [subjectMats])

  const countByType = useMemo(() => {
    const map = {}
    subjectMats.forEach(m => { map[m.material_type] = (map[m.material_type] || 0) + 1 })
    return map
  }, [subjectMats])

  const handleUploadForChapter = (ch) => {
    setUploadChapter(ch)
    setShowUpload(true)
  }

  return (
    <div>
      {showUpload && (
        <UploadModal
          course={course}
          subject={subjectName}
          chapter={uploadChapter}
          onClose={() => setShowUpload(false)}
          onSaved={onRefetch}
          showToast={showToast}
        />
      )}

      {/* Subject header */}
      <div style={{ ...cardS, borderTop: `3px solid ${courseData.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>
              {subjectData.icon} {subjectName}
            </div>
            <div style={{ fontSize: 12, color: C.slate, marginTop: 2 }}>
              {subjectData.chapters.length} chapters · {subjectMats.length} materials uploaded
            </div>
          </div>
          <button onClick={() => { setUploadChapter(''); setShowUpload(true) }}
            style={btn(courseData.color)}>
            📤 Upload Material
          </button>
        </div>

        {/* Material type filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterType('all')}
            style={{
              padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              border: `1px solid ${filterType === 'all' ? courseData.color : C.border}`,
              background: filterType === 'all' ? courseData.bg : '#fff',
              color: filterType === 'all' ? courseData.text : C.slate,
              cursor: 'pointer',
            }}>
            All ({subjectMats.length})
          </button>
          {MATERIAL_TYPES.filter(t => countByType[t.key]).map(t => (
            <button key={t.key} onClick={() => setFilterType(t.key)}
              style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                border: `1px solid ${filterType === t.key ? t.color : C.border}`,
                background: filterType === t.key ? t.bg : '#fff',
                color: filterType === t.key ? t.color : C.slate,
                cursor: 'pointer',
              }}>
              {t.icon} {t.label} ({countByType[t.key]})
            </button>
          ))}
        </div>
      </div>

      {/* Chapters */}
      {subjectData.chapters.map(ch => {
        const chMats = subjectMats.filter(m =>
          m.chapter === ch && (filterType === 'all' || m.material_type === filterType)
        )
        const isExpanded = expandedChapter === ch
        const total = countByChapter[ch] || 0

        return (
          <div key={ch} style={{
            background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
            marginBottom: 6, overflow: 'hidden',
          }}>
            {/* Chapter row */}
            <div
              onClick={() => setExpandedChapter(isExpanded ? null : ch)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 16px', cursor: 'pointer',
                background: isExpanded ? courseData.bg : C.white,
                transition: 'background .12s',
              }}>
              <span style={{ fontSize: 13, color: isExpanded ? courseData.text : C.navy, fontWeight: isExpanded ? 700 : 500, flex: 1 }}>
                {ch}
              </span>
              {total > 0 ? (
                <Badge text={`${total} file${total > 1 ? 's' : ''}`}
                  color={courseData.text} bg={courseData.bg} />
              ) : (
                <Badge text="No files" color="#94a3b8" bg="#f1f5f9" />
              )}
              <button
                onClick={e => { e.stopPropagation(); handleUploadForChapter(ch) }}
                style={btnSm(courseData.bg, courseData.text)}>
                + Add
              </button>
              <span style={{ fontSize: 11, color: C.slate }}>{isExpanded ? '▲' : '▼'}</span>
            </div>

            {/* Expanded: files */}
            {isExpanded && (
              <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${C.border}` }}>
                {chMats.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
                    No materials yet for this chapter.
                    <button onClick={() => handleUploadForChapter(ch)}
                      style={{ ...btnSm(courseData.bg, courseData.text), marginLeft: 10 }}>
                      📤 Upload now
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {chMats.map(m => (
                      <MaterialCard key={m.id} mat={m} onDelete={onRefetch} showToast={showToast} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── STATS OVERVIEW ────────────────────────────────────────────────────────────
function CourseStats({ course, materials }) {
  const courseData = COURSES[course]
  const courseMats = materials.filter(m => m.course === course)

  const bySubject = useMemo(() => {
    const map = {}
    Object.keys(courseData.subjects).forEach(s => { map[s] = 0 })
    courseMats.forEach(m => { map[m.subject] = (map[m.subject] || 0) + 1 })
    return map
  }, [courseMats, courseData])

  const byType = useMemo(() => {
    const map = {}
    courseMats.forEach(m => { map[m.material_type] = (map[m.material_type] || 0) + 1 })
    return map
  }, [courseMats])

  const totalChapters = Object.values(courseData.subjects).reduce((a, s) => a + s.chapters.length, 0)
  const coveredChapters = useMemo(() => {
    const covered = new Set(courseMats.map(m => `${m.subject}::${m.chapter}`))
    return covered.size
  }, [courseMats])

  const pct = totalChapters > 0 ? Math.round((coveredChapters / totalChapters) * 100) : 0

  return (
    <div style={{ ...cardS, borderTop: `3px solid ${courseData.color}` }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 14 }}>
        📊 Coverage Overview — {courseData.label}
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Materials', val: courseMats.length, color: courseData.color },
          { label: 'Subjects', val: Object.keys(courseData.subjects).length, color: C.navy },
          { label: 'Chapters covered', val: `${coveredChapters}/${totalChapters}`, color: pct >= 70 ? C.green : pct >= 40 ? C.amber : C.rose },
          { label: 'Coverage', val: `${pct}%`, color: pct >= 70 ? C.green : pct >= 40 ? C.amber : C.rose },
        ].map(s => (
          <div key={s.label} style={{
            padding: '12px 14px', borderRadius: 9, background: '#f8fafc', border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.slate, marginBottom: 5 }}>
          <span>Chapter coverage</span><span>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${pct}%`,
            background: pct >= 70 ? C.green : pct >= 40 ? C.amber : C.rose,
            transition: 'width .4s',
          }} />
        </div>
      </div>

      {/* Per-subject count */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
        {Object.entries(bySubject).map(([sub, cnt]) => {
          const subData = courseData.subjects[sub]
          return (
            <div key={sub} style={{
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: '#fafafa',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: '#1e293b' }}>{subData?.icon} {sub}</span>
              <Badge text={`${cnt} files`}
                color={cnt > 0 ? courseData.text : '#94a3b8'}
                bg={cnt > 0 ? courseData.bg : '#f1f5f9'} />
            </div>
          )
        })}
      </div>

      {/* Material type breakdown */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        By material type
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MATERIAL_TYPES.filter(t => byType[t.key]).map(t => (
          <span key={t.key} style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            color: t.color, background: t.bg,
          }}>
            {t.icon} {t.label}: {byType[t.key]}
          </span>
        ))}
        {!courseMats.length && (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>No materials uploaded yet</span>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function StudyMaterial() {
  const [activeCourse,  setActiveCourse]  = useState('sainik')
  const [activeSubject, setActiveSubject] = useState(null)
  const [activeView,    setActiveView]    = useState('subjects') // 'subjects' | 'stats'
  const [materials,     setMaterials]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [toast,         setToast]         = useState(null)

  const showToast = (msg, color = C.navy) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('study_materials')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) showToast('Failed to load materials', C.rose)
    else setMaterials(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // When course changes reset subject
  useEffect(() => {
    const firstSubject = Object.keys(COURSES[activeCourse].subjects)[0]
    setActiveSubject(firstSubject)
    setActiveView('subjects')
  }, [activeCourse])

  const courseData  = COURSES[activeCourse]
  const subjects    = courseData.subjects
  const subjectList = Object.keys(subjects)

  const courseMaterials = useMemo(() =>
    materials.filter(m => m.course === activeCourse),
    [materials, activeCourse]
  )

  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return courseMaterials
    const q = search.toLowerCase()
    return courseMaterials.filter(m =>
      m.title?.toLowerCase().includes(q) ||
      m.chapter?.toLowerCase().includes(q) ||
      m.subject?.toLowerCase().includes(q)
    )
  }, [courseMaterials, search])

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui,sans-serif', background: C.bg, minHeight: '100vh' }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: C.slate, marginBottom: 4 }}>
          GNSI Portal
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.navy, letterSpacing: '-.02em' }}>
          Study Materials
        </div>
        <div style={{ fontSize: 13, color: C.slate, marginTop: 3 }}>
          Navodaya · Sainik · Foundation — upload notes, practice sets, solved papers & more
        </div>
      </div>

      {/* Course tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {Object.entries(COURSES).map(([key, c]) => (
          <button key={key} onClick={() => setActiveCourse(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: activeCourse === key ? `2px solid ${c.color}` : `2px solid ${C.border}`,
              background: activeCourse === key ? c.bg : C.white,
              color: activeCourse === key ? c.text : C.slate,
              cursor: 'pointer', transition: 'all .12s',
            }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%',
              background: c.color, display: 'inline-block',
            }} />
            {c.label}
            <span style={{
              padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700,
              background: activeCourse === key ? 'rgba(0,0,0,.08)' : '#f1f5f9',
              color: activeCourse === key ? c.text : C.slate,
            }}>
              {courseMaterials.length}
            </span>
          </button>
        ))}
      </div>

      {/* Course info banner */}
      <div style={{
        ...cardS, marginBottom: 18,
        display: 'flex', gap: 14, alignItems: 'center',
        borderLeft: `4px solid ${courseData.color}`, borderRadius: '0 12px 12px 0',
        padding: '14px 18px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{courseData.label}</div>
          <div style={{ fontSize: 12, color: C.slate, marginTop: 2 }}>
            {courseData.exam} · {subjectList.length} subjects ·{' '}
            {Object.values(subjects).reduce((a, s) => a + s.chapters.length, 0)} chapters
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveView(activeView === 'stats' ? 'subjects' : 'stats')}
            style={btn(activeView === 'stats' ? courseData.color : C.slate)}>
            {activeView === 'stats' ? '📚 Back to Subjects' : '📊 Coverage Stats'}
          </button>
        </div>
      </div>

      {activeView === 'stats' ? (
        <CourseStats course={activeCourse} materials={materials} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18, alignItems: 'start' }}>

          {/* Subject sidebar */}
          <div style={{ ...cardS, padding: 12, position: 'sticky', top: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, padding: '0 4px' }}>
              Subjects
            </div>
            <input style={{ ...iS, marginBottom: 10, fontSize: 12, padding: '7px 10px' }}
              placeholder="🔍 Search…" value={search}
              onChange={e => setSearch(e.target.value)} />
            {subjectList.map(s => {
              const cnt = courseMaterials.filter(m => m.subject === s).length
              const isActive = activeSubject === s
              return (
                <div key={s} onClick={() => { setActiveSubject(s); setSearch('') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                    background: isActive ? courseData.bg : 'transparent',
                    marginBottom: 3, transition: 'background .1s',
                  }}>
                  <span style={{ fontSize: 16 }}>{subjects[s].icon}</span>
                  <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? courseData.text : '#374151', flex: 1 }}>
                    {s}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                    background: cnt > 0 ? courseData.bg : '#f1f5f9',
                    color: cnt > 0 ? courseData.text : '#94a3b8',
                  }}>
                    {cnt}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Main content */}
          <div>
            {loading ? (
              <div style={{ ...cardS, textAlign: 'center', padding: 48, color: C.slate }}>
                ⏳ Loading materials…
              </div>
            ) : activeSubject ? (
              <SubjectPanel
                key={`${activeCourse}-${activeSubject}`}
                course={activeCourse}
                subjectName={activeSubject}
                subjectData={subjects[activeSubject]}
                materials={search.trim() ? filteredMaterials : courseMaterials}
                onRefetch={refetch}
                showToast={showToast}
              />
            ) : (
              <div style={{ ...cardS, textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                Select a subject from the sidebar
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
