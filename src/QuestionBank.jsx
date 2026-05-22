import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import TabSourceCollector from './TabSourceCollector'

// ─── Constants ────────────────────────────────────────────────────────────────

const QB_SUBJECTS = {
  Mathematics: [
    'Natural Numbers','LCM and HCF','Unitary Method','Fractions','Ratio and Proportion',
    'Profit and Loss','Simplification','Average','Percentage','Area and Perimeter',
    'Simple Interest','Lines and Angles','Temperature','Conversion of Units','Roman Numerals',
    'Types of Angles','Circle','Volume of Cube and Cuboids','Prime and Composite Numbers',
    'Plane Figures','Decimal Numbers','Speed and Time','Operation on Numbers',
    'Complementary and Supplementary Angles','Arranging of Fractions',
  ],
  Intelligence: [
    'Analogies (Mathematical & Verbal)','Venn Diagram','Paper Folding','Embedded/Hidden Figure',
    'Geometrical Figure Completion','Space Visualisation','Order & Ranking','Coding Decoding',
    'Mathematical Operations','Blood Relations','Sitting Arrangement','Mirror Image',
    'Figure Matching','Figure Series Completion','Odd-Man Out','Pattern Completion',
    'Classification','Word Formation','Dictionary - Word Order','Series','Direction Test',
    'Clock And Calendar',
  ],
  Language: [
    'Comprehension Passage','Preposition','Article','Vocabulary','Verbs and Type',
    'Confusing Words','Question Tags','Types of Sentence','Tense Forms','Kinds of Nouns',
    'Kinds of Pronouns','Correct Spelling','Ordering of Words','Sentence Formation',
    'Antonyms','Synonyms','Adjectives','Interjection','Idiom and Phrases','Collective Nouns',
    'Number','Gender','Adverbs','Rhyming Words','Singular/Plural',
  ],
  'General Knowledge': [
    'Scientific Devices in Daily Life','Icons and Symbols of India','Major Religions of India',
    'Art and Culture','Defence Awareness','Sports and Games','Super Senses',
    'Relationship: Animals & Humans','Taste and Digestion','Cooking and Preserving Techniques',
    'Germination and Seed Dispersal','Traditional Water Harvesting','Experiments with Water',
    'Water Pollution and Microbial Diseases','Mountain Terrain and Lifestyle',
    'Historical Monuments','Shape of Earth and Gravitation','Non-Renewable Energy Sources',
    'Food, Culture and Habitat','Names of Young Ones of Animals','Functions of Body Parts',
    'International Organizations','Indian Literary & Cultural Personalities',
    'Indian Literary & Cultural Awards','Natural Calamities','Evaporation and Water Cycle',
    'Life of Farmers','Tribal Communities and Forest Produce',
  ],
}

const ALL_SUBJECTS   = Object.keys(QB_SUBJECTS)
const DIFFICULTY     = ['Easy', 'Medium', 'Hard']
const EXAM_TYPES     = ['AISSEE', 'JNVST', 'Weekly Test', 'Monthly Test', 'Unit Test', 'Mock Test', 'Custom']

const AISSEE_PATTERN = {
  Mathematics: { count: 50, marks: 3 },
  Intelligence: { count: 25, marks: 2 },
  Language:     { count: 25, marks: 2 },
  'General Knowledge': { count: 25, marks: 2 },
}

const today = () => new Date().toISOString().split('T')[0]
const fmtDate = (d) => { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const pct = (s, m) => m > 0 ? Math.round((s / m) * 100) : 0
const scoreColor = (p) => p >= 75 ? '#16a34a' : p >= 50 ? '#f59e0b' : '#dc2626'
const scoreBg    = (p) => p >= 75 ? '#dcfce7' : p >= 50 ? '#fef9c3' : '#fee2e2'

// ─── Styles (mirrors Teaching.jsx) ───────────────────────────────────────────

const S = {
  page:   { padding: '24px', fontFamily: "'Segoe UI', sans-serif", background: '#f8fafc', minHeight: '100vh' },
  card:   { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '20px' },
  btn:    (color = '#1e3a5f', disabled = false) => ({ backgroundColor: disabled ? '#94a3b8' : color, color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '14px' }),
  btnSm:  (color = '#1e3a5f') => ({ backgroundColor: color, color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }),
  btnOut: (color = '#1e3a5f', active = false) => ({ backgroundColor: active ? color : 'white', color: active ? 'white' : color, border: `2px solid ${color}`, borderRadius: '8px', padding: '8px 16px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }),
  input:  { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: 'white' },
  label:  { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' },
  select: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: 'white' },
  statCard: (color, bg) => ({ background: bg, borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}` }),
  badge:  (color, bg) => ({ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', background: bg, color }),
  pill:   (color, bg) => ({ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', background: bg, color, display: 'inline-block' }),
  optBtn: (selected) => ({
    display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px',
    border: `2px solid ${selected ? '#1e3a5f' : '#e2e8f0'}`,
    borderRadius: '8px', background: selected ? '#eff6ff' : 'white',
    cursor: 'pointer', textAlign: 'left', width: '100%',
  }),
}

const TABS = [
  { key: 'bank',      label: 'Question Bank',   icon: '🗂️' },
  { key: 'upload',    label: 'Upload / Add',    icon: '📤' },
  { key: 'ai',        label: 'AI Generator',    icon: '🤖' },
    { key: 'sources',   label: 'Source Collector',icon: '🌐' }, 
  { key: 'builder',   label: 'Test Builder',    icon: '📝' },
  { key: 'tests',     label: 'Saved Tests',     icon: '📋' },
  { key: 'results',   label: 'Results',         icon: '📊' },
]

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchQuestions(filters = {}) {
  let q = supabase.from('qbank_questions').select('*').order('created_at', { ascending: false })
  if (filters.subject)    q = q.eq('subject', filters.subject)
  if (filters.chapter)    q = q.eq('chapter', filters.chapter)
  if (filters.difficulty) q = q.eq('difficulty', filters.difficulty)
  if (filters.source)     q = q.eq('source', filters.source)
  const { data, error } = await q
  return { data: data || [], error }
}

async function upsertQuestion(payload) {
  if (payload.id) {
    const { id, created_at, ...rest } = payload
    return supabase.from('qbank_questions').update(rest).eq('id', id)
  }
  const { id, ...rest } = payload
  return supabase.from('qbank_questions').insert([rest])
}

async function saveTest(testPayload) {
  return supabase.from('qbank_tests').insert([testPayload]).select().single()
}

async function saveTestResult(resultPayload) {
  return supabase.from('qbank_test_results').insert([resultPayload]).select().single()
}

// ─── Sub-component: Question Card (view mode) ─────────────────────────────────

function QuestionCard({ q, index, selectable, selected, onToggle, onEdit, onDelete, showAnswer = false }) {
  const [revealed, setRevealed] = useState(showAnswer)

  return (
    <div style={{
      ...S.card, marginBottom: '12px', padding: '16px 20px',
      border: selected ? '2px solid #1e3a5f' : '1px solid #e2e8f0',
      background: selected ? '#f0f6ff' : 'white',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {selectable && (
          <input type="checkbox" checked={!!selected} onChange={() => onToggle?.(q.id)}
            style={{ width: '16px', height: '16px', marginTop: '3px', cursor: 'pointer', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          {/* Meta row */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>Q{index + 1}</span>
            <span style={S.badge('#1e3a5f', '#eff6ff')}>{q.subject}</span>
            <span style={S.badge('#7c3aed', '#f3e8ff')}>{q.chapter}</span>
            <span style={S.badge(
              q.difficulty === 'Easy' ? '#16a34a' : q.difficulty === 'Hard' ? '#dc2626' : '#f59e0b',
              q.difficulty === 'Easy' ? '#dcfce7' : q.difficulty === 'Hard' ? '#fee2e2' : '#fef9c3',
            )}>{q.difficulty || 'Medium'}</span>
            {q.marks && <span style={S.badge('#0891b2', '#e0f2fe')}>{q.marks} mark{q.marks > 1 ? 's' : ''}</span>}
            {q.source && <span style={{ fontSize: '10px', color: '#94a3b8' }}>via {q.source}</span>}
          </div>

          {/* Question text */}
          <div style={{ fontSize: '15px', color: '#1e293b', fontWeight: '500', lineHeight: '1.6', marginBottom: '12px' }}>
            {q.question}
          </div>

          {/* Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
            {['A', 'B', 'C', 'D'].map(l => (
              <div key={l} style={{
                padding: '7px 12px', borderRadius: '7px', fontSize: '13px',
                background: revealed && q.correct_option === l ? '#dcfce7' : '#f8fafc',
                border: `1px solid ${revealed && q.correct_option === l ? '#86efac' : '#e2e8f0'}`,
                color: revealed && q.correct_option === l ? '#15803d' : '#374151',
                fontWeight: revealed && q.correct_option === l ? '700' : '400',
              }}>
                <span style={{ fontWeight: '700', marginRight: '6px', color: '#94a3b8' }}>{l}.</span>
                {q[`option_${l.toLowerCase()}`] || '—'}
                {revealed && q.correct_option === l && <span style={{ marginLeft: '6px' }}>✓</span>}
              </div>
            ))}
          </div>

          {/* Reveal / explanation */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setRevealed(r => !r)} style={S.btnSm(revealed ? '#64748b' : '#16a34a')}>
              {revealed ? '🙈 Hide Answer' : '👁 Show Answer'}
            </button>
            {onEdit   && <button onClick={() => onEdit(q)}   style={S.btnSm('#7c3aed')}>✏️ Edit</button>}
            {onDelete && <button onClick={() => onDelete(q.id)} style={S.btnSm('#dc2626')}>🗑 Delete</button>}
          </div>

          {revealed && q.explanation && (
            <div style={{ marginTop: '10px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
              💡 <strong>Explanation:</strong> {q.explanation}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-component: Question Form (add / edit) ────────────────────────────────

function QuestionForm({ initial, onSave, onCancel, saving }) {
  const blank = {
    subject: '', chapter: '', question: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_option: 'A', difficulty: 'Medium', marks: 3, explanation: '', source: 'Manual',
  }
  const [form, setForm] = useState(initial || blank)
  const chapters = QB_SUBJECTS[form.subject] || []

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.subject || !form.chapter || !form.question || !form.option_a || !form.option_b || !form.option_c || !form.option_d) {
      alert('Please fill in all required fields.')
      return
    }
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
        <div>
          <label style={S.label}>Subject *</label>
          <select value={form.subject} onChange={e => set('subject', e.target.value)} required style={S.select}>
            <option value="">Select</option>
            {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Chapter / Topic *</label>
          <select value={form.chapter} onChange={e => set('chapter', e.target.value)} required style={{ ...S.select, opacity: form.subject ? 1 : 0.5 }} disabled={!form.subject}>
            <option value="">Select</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Difficulty</label>
          <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)} style={S.select}>
            {DIFFICULTY.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Question *</label>
          <textarea value={form.question} onChange={e => set('question', e.target.value)} required rows={3}
            style={{ ...S.input, resize: 'vertical' }} placeholder="Enter the full question text here..." />
        </div>
        {['A', 'B', 'C', 'D'].map(l => (
          <div key={l}>
            <label style={{ ...S.label, color: form.correct_option === l ? '#16a34a' : '#374151' }}>
              Option {l} {form.correct_option === l ? '✓ (correct)' : ''}
            </label>
            <input value={form[`option_${l.toLowerCase()}`]} onChange={e => set(`option_${l.toLowerCase()}`, e.target.value)}
              required placeholder={`Option ${l}`}
              style={{ ...S.input, borderColor: form.correct_option === l ? '#86efac' : '#d1d5db', background: form.correct_option === l ? '#f0fdf4' : 'white' }} />
          </div>
        ))}
        <div>
          <label style={S.label}>Correct Answer *</label>
          <select value={form.correct_option} onChange={e => set('correct_option', e.target.value)} required style={S.select}>
            {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l} — {form[`option_${l.toLowerCase()}`] || '...'}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Marks</label>
          <select value={form.marks} onChange={e => set('marks', parseInt(e.target.value))} style={S.select}>
            {[1, 2, 3, 4, 5].map(m => <option key={m} value={m}>{m} mark{m > 1 ? 's' : ''}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Explanation (optional)</label>
          <textarea value={form.explanation} onChange={e => set('explanation', e.target.value)} rows={2}
            style={{ ...S.input, resize: 'vertical' }} placeholder="Brief explanation for the correct answer..." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button type="submit" disabled={saving} style={S.btn(initial?.id ? '#7c3aed' : '#1e3a5f', saving)}>
          {saving ? '⏳ Saving...' : initial?.id ? '✏️ Update Question' : '✅ Save Question'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={S.btn('#64748b')}>✖ Cancel</button>}
      </div>
    </form>
  )
}

// ─── Tab: Question Bank ───────────────────────────────────────────────────────

function TabBank({ questions, loading, refetch, selectable, selectedIds, onToggle }) {
  const [filterSubject,    setFilterSubject]    = useState('All')
  const [filterChapter,    setFilterChapter]    = useState('All')
  const [filterDifficulty, setFilterDifficulty] = useState('All')
  const [search,           setSearch]           = useState('')
  const [editQ,            setEditQ]            = useState(null)
  const [saving,           setSaving]           = useState(false)
  const [showAddForm,      setShowAddForm]       = useState(false)
  const [addSaving,        setAddSaving]         = useState(false)
  const [page,             setPage]             = useState(1)
  const PAGE_SIZE = 20

  const chapters = filterSubject !== 'All' ? (QB_SUBJECTS[filterSubject] || []) : []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return questions.filter(item => {
      if (filterSubject !== 'All' && item.subject !== filterSubject) return false
      if (filterChapter !== 'All' && item.chapter !== filterChapter) return false
      if (filterDifficulty !== 'All' && item.difficulty !== filterDifficulty) return false
      if (q && !item.question?.toLowerCase().includes(q) && !item.chapter?.toLowerCase().includes(q)) return false
      return true
    })
  }, [questions, filterSubject, filterChapter, filterDifficulty, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question permanently?')) return
    await supabase.from('qbank_questions').delete().eq('id', id)
    refetch()
  }

  const handleSaveEdit = async (form) => {
    setSaving(true)
    const { error } = await upsertQuestion({ ...form, id: editQ.id })
    if (error) alert('Error: ' + error.message)
    else { setEditQ(null); refetch() }
    setSaving(false)
  }

  const handleAdd = async (form) => {
    setAddSaving(true)
    const { error } = await upsertQuestion({ ...form, source: 'Manual' })
    if (error) alert('Error: ' + error.message)
    else { setShowAddForm(false); refetch() }
    setAddSaving(false)
  }

  // Stats for current filter
  const subjectCounts = useMemo(() => {
    const map = {}
    questions.forEach(q => { map[q.subject] = (map[q.subject] || 0) + 1 })
    return map
  }, [questions])

  return (
    <>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total Questions', value: questions.length,                                  color: '#1e3a5f', bg: '#eff6ff', icon: '🗂️' },
          { label: 'Mathematics',     value: subjectCounts['Mathematics'] || 0,                 color: '#16a34a', bg: '#dcfce7', icon: '📐' },
          { label: 'Intelligence',    value: subjectCounts['Intelligence'] || 0,                color: '#7c3aed', bg: '#f3e8ff', icon: '🧠' },
          { label: 'GK + Language',   value: (subjectCounts['General Knowledge'] || 0) + (subjectCounts['Language'] || 0), color: '#ca8a04', bg: '#fef9c3', icon: '📚' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{c.icon}</div>
            <p style={{ fontSize: '12px', color: c.color, fontWeight: '600', margin: 0 }}>{c.label}</p>
            <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: c.color, margin: '2px 0 0' }}>{c.value}</h2>
          </div>
        ))}
      </div>

      {/* Add form toggle */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showAddForm ? '20px' : 0 }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>➕ Add Question Manually</h2>
          <button onClick={() => setShowAddForm(f => !f)} style={S.btn(showAddForm ? '#64748b' : '#1e3a5f')}>
            {showAddForm ? '✖ Cancel' : '➕ Add Question'}
          </button>
        </div>
        {showAddForm && <QuestionForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} saving={addSaving} />}
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <input placeholder="🔍 Search questions or chapters..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={S.input} />
        <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterChapter('All'); setPage(1) }} style={S.select}>
          <option value="All">All Subjects</option>
          {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterChapter} onChange={e => { setFilterChapter(e.target.value); setPage(1) }} style={{ ...S.select, opacity: filterSubject !== 'All' ? 1 : 0.5 }} disabled={filterSubject === 'All'}>
          <option value="All">All Chapters</option>
          {chapters.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterDifficulty} onChange={e => { setFilterDifficulty(e.target.value); setPage(1) }} style={S.select}>
          <option value="All">All Difficulties</option>
          {DIFFICULTY.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
        Showing {filtered.length} questions
        {selectable && selectedIds?.size > 0 && <span style={{ marginLeft: '12px', color: '#1e3a5f', fontWeight: '700' }}>· {selectedIds.size} selected for test</span>}
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading questions...</div>
        : paginated.length === 0
          ? <div style={{ ...S.card, textAlign: 'center', padding: '48px', color: '#94a3b8' }}>No questions found. Add via Upload, AI Generator, or manually above.</div>
          : paginated.map((q, i) => (
            editQ?.id === q.id
              ? (
                <div key={q.id} style={{ ...S.card, border: '2px solid #7c3aed' }}>
                  <div style={{ fontWeight: '700', color: '#7c3aed', marginBottom: '16px' }}>✏️ Edit Question</div>
                  <QuestionForm initial={editQ} onSave={handleSaveEdit} onCancel={() => setEditQ(null)} saving={saving} />
                </div>
              )
              : (
                <QuestionCard
                  key={q.id} q={q} index={(page - 1) * PAGE_SIZE + i}
                  selectable={selectable}
                  selected={selectable && selectedIds?.has(q.id)}
                  onToggle={onToggle}
                  onEdit={q => setEditQ(q)}
                  onDelete={handleDelete}
                />
              )
          ))
      }

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.btn('#64748b', page === 1)}>◀ Prev</button>
          <span style={{ padding: '10px 16px', fontWeight: '600', color: '#374151' }}>Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={S.btn('#64748b', page === totalPages)}>Next ▶</button>
        </div>
      )}
    </>
  )
}

// ─── Tab: Upload ──────────────────────────────────────────────────────────────

function TabUpload({ refetch }) {
  const [mode,         setMode]         = useState('paste')   // 'paste' | 'csv' | 'json'
  const [rawText,      setRawText]      = useState('')
  const [detected,     setDetected]     = useState([])
  const [selectedSet,  setSelectedSet]  = useState(new Set())
  const [bulkSubject,  setBulkSubject]  = useState('')
  const [bulkChapter,  setBulkChapter]  = useState('')
  const [bulkDifficulty, setBulkDifficulty] = useState('Medium')
  const [detecting,    setDetecting]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveResult,   setSaveResult]   = useState(null)
  const fileRef = useRef()

  const handleDetect = async () => {
    if (!rawText.trim()) { alert('Please paste text first.'); return }
    setDetecting(true); setDetected([]); setSelectedSet(new Set())
    const prompt = `You are an expert MCQ parser. Extract ALL multiple choice questions from this text.
Return ONLY a valid JSON array, no markdown, no backticks, no explanation.
Each item: {"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A","explanation":""}
Rules:
- Normalise all option labels to A/B/C/D
- correct_option must be A, B, C, or D only (empty string if not given)
- Include all questions, even if answer is missing
TEXT:
${rawText.substring(0, 9000)}`
    try {
      const res  = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const text = data.content?.map(b => b.type === 'text' ? b.text : '').join('').replace(/```json|```/g, '').trim()
      const arr  = JSON.parse(text)
      const tagged = arr.map((q, i) => ({ ...q, _id: i, subject: '', chapter: '', difficulty: 'Medium', marks: 3, source: 'Upload' }))
      setDetected(tagged)
      setSelectedSet(new Set(tagged.map(q => q._id)))
    } catch (e) {
      alert('Detection failed: ' + e.message)
    }
    setDetecting(false)
  }

  const handleCsvFile = (f) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const lines   = e.target.result.trim().split(/\r?\n/)
      const headers = lines[0].split(',').map(h => h.replace(/["']/g, '').trim().toLowerCase())
      const idx = (aliases) => headers.findIndex(h => aliases.includes(h))
      const qIdx = idx(['question', 'q', 'ques'])
      const aIdx = idx(['option_a', 'a', 'opt_a', 'answer_a'])
      const bIdx = idx(['option_b', 'b', 'opt_b', 'answer_b'])
      const cIdx = idx(['option_c', 'c', 'opt_c', 'answer_c'])
      const dIdx = idx(['option_d', 'd', 'opt_d', 'answer_d'])
      const ansIdx = idx(['answer', 'correct', 'correct_option', 'ans', 'key'])
      const expIdx = idx(['explanation', 'explain', 'solution'])
      const sIdx   = idx(['subject'])
      const chIdx  = idx(['chapter', 'topic'])

      const csv = (row, i) => i >= 0 ? (row[i] || '').replace(/^["']|["']$/g, '').trim() : ''
      const norm = (a) => { a = a.toUpperCase().trim(); return ['A','B','C','D'].includes(a) ? a : '' }

      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i])
        if (!cols[qIdx]) continue
        rows.push({
          _id: i, question: csv(cols, qIdx),
          option_a: csv(cols, aIdx), option_b: csv(cols, bIdx),
          option_c: csv(cols, cIdx), option_d: csv(cols, dIdx),
          correct_option: norm(csv(cols, ansIdx)),
          explanation: csv(cols, expIdx),
          subject: csv(cols, sIdx), chapter: csv(cols, chIdx),
          difficulty: 'Medium', marks: 3, source: 'CSV Upload',
        })
      }
      setDetected(rows)
      setSelectedSet(new Set(rows.map(r => r._id)))
    }
    reader.readAsText(f)
  }

  const handleJsonFile = (f) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const arr    = JSON.parse(e.target.result)
        const tagged = (Array.isArray(arr) ? arr : []).map((q, i) => ({
          _id: i, question: q.question || '', option_a: q.option_a || q.options?.A || '',
          option_b: q.option_b || q.options?.B || '', option_c: q.option_c || q.options?.C || '',
          option_d: q.option_d || q.options?.D || '',
          correct_option: (q.correct_option || q.correct || '').toUpperCase(),
          explanation: q.explanation || '', subject: q.subject || '', chapter: q.chapter || '',
          difficulty: q.difficulty || 'Medium', marks: q.marks || 3, source: 'JSON Import',
        }))
        setDetected(tagged)
        setSelectedSet(new Set(tagged.map(q => q._id)))
      } catch (e) { alert('Invalid JSON: ' + e.message) }
    }
    reader.readAsText(f)
  }

  const applyBulk = () => {
    setDetected(prev => prev.map(q =>
      selectedSet.has(q._id)
        ? { ...q, subject: bulkSubject || q.subject, chapter: bulkChapter || q.chapter, difficulty: bulkDifficulty || q.difficulty }
        : q
    ))
  }

  const handleSaveAll = async () => {
    const toSave = detected.filter(q => selectedSet.has(q._id))
    if (!toSave.length) { alert('Select at least one question.'); return }
    setSaving(true); setSaveResult(null)
    const payload = toSave.map(({ _id, ...rest }) => ({ ...rest }))
    const { error } = await supabase.from('qbank_questions').insert(payload)
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setSaveResult({ count: toSave.length })
    setDetected([]); setSelectedSet(new Set()); setRawText(''); refetch()
    setSaving(false)
  }

  return (
    <>
      {/* Mode selector */}
      <div style={S.card}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginTop: 0, marginBottom: '16px' }}>📤 Upload Questions to Bank</h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[['paste', '📋 Paste Text'], ['csv', '📊 CSV File'], ['json', '{ } JSON File']].map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)} style={S.btnOut('#1e3a5f', mode === key)}>{label}</button>
          ))}
        </div>

        {mode === 'paste' && (
          <>
            <div style={{ fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', lineHeight: '1.6' }}>
              Paste questions in any standard MCQ format — numbered, bulleted, or plain text.
              AI will detect all questions, options, and answers automatically.
            </div>
            <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={10}
              style={{ ...S.input, fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }}
              placeholder={`1. What is the LCM of 12 and 18?\nA) 36   B) 72   C) 24   D) 18\nAnswer: A\n\n2. An obtuse angle is between:\na) 0° and 90°   b) 90° and 180°   c) Exactly 90°   d) 180°\nAns: b`} />
            <button onClick={handleDetect} disabled={detecting} style={{ ...S.btn('#7c3aed', detecting), marginTop: '12px' }}>
              {detecting ? '⏳ Detecting...' : '🤖 Detect MCQs with AI'}
            </button>
          </>
        )}

        {mode === 'csv' && (
          <>
            <div style={{ fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', lineHeight: '1.6' }}>
              Required columns: <code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>question</code>,
              {' '}<code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>option_a</code>,
              {' '}<code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>option_b</code>,
              {' '}<code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>option_c</code>,
              {' '}<code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>option_d</code>,
              {' '}<code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>answer</code>.
              Optional: <code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>subject</code>,
              {' '}<code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>chapter</code>,
              {' '}<code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>explanation</code>
            </div>
            <div onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '2rem', textAlign: 'center', cursor: 'pointer' }}>
              <input type="file" accept=".csv" ref={fileRef} style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleCsvFile(e.target.files[0]) }} />
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>Drop CSV here or click to browse</div>
            </div>
          </>
        )}

        {mode === 'json' && (
          <>
            <div style={{ fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', lineHeight: '1.6' }}>
              JSON array format: <code style={{ fontFamily: 'monospace', fontSize: '11px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '3px' }}>
                {'[{"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A","explanation":"","subject":"","chapter":""}]'}
              </code>
            </div>
            <div onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '2rem', textAlign: 'center', cursor: 'pointer' }}>
              <input type="file" accept=".json" ref={fileRef} style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleJsonFile(e.target.files[0]) }} />
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{ '{ }' }</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>Drop JSON file here or click to browse</div>
            </div>
          </>
        )}
      </div>

      {/* Detected questions review */}
      {detected.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>
              ✅ {detected.length} questions detected — review &amp; assign
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setSelectedSet(new Set(detected.map(q => q._id)))} style={S.btnSm('#1e3a5f')}>Select All</button>
              <button onClick={() => setSelectedSet(new Set())} style={S.btnSm('#64748b')}>Deselect All</button>
            </div>
          </div>

          {/* Bulk assign */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Bulk assign to selected:</span>
            <select value={bulkSubject} onChange={e => { setBulkSubject(e.target.value); setBulkChapter('') }} style={{ ...S.select, width: 'auto', fontSize: '12px', padding: '6px 10px' }}>
              <option value="">— subject —</option>
              {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={bulkChapter} onChange={e => setBulkChapter(e.target.value)} style={{ ...S.select, width: 'auto', fontSize: '12px', padding: '6px 10px' }} disabled={!bulkSubject}>
              <option value="">— chapter —</option>
              {(QB_SUBJECTS[bulkSubject] || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={bulkDifficulty} onChange={e => setBulkDifficulty(e.target.value)} style={{ ...S.select, width: 'auto', fontSize: '12px', padding: '6px 10px' }}>
              {DIFFICULTY.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={applyBulk} style={S.btnSm('#16a34a')}>✓ Apply</button>
          </div>

          {/* Individual cards */}
          {detected.map((q, i) => (
            <div key={q._id} style={{ ...S.card, marginBottom: '10px', padding: '14px 16px', border: selectedSet.has(q._id) ? '2px solid #1e3a5f' : '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={selectedSet.has(q._id)} onChange={() => setSelectedSet(s => { const n = new Set(s); n.has(q._id) ? n.delete(q._id) : n.add(q._id); return n })}
                  style={{ width: '16px', height: '16px', marginTop: '3px', cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', color: '#1e293b', fontSize: '14px', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', marginRight: '6px', fontSize: '12px' }}>Q{i + 1}</span>
                    {q.question}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                    {['A', 'B', 'C', 'D'].map(l => (
                      <div key={l} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', background: q.correct_option === l ? '#dcfce7' : '#f8fafc', border: `1px solid ${q.correct_option === l ? '#86efac' : '#e2e8f0'}`, color: q.correct_option === l ? '#15803d' : '#374151' }}>
                        {l}. {q[`option_${l.toLowerCase()}`] || '—'}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={q.subject} onChange={e => setDetected(prev => prev.map(x => x._id === q._id ? { ...x, subject: e.target.value, chapter: '' } : x))}
                      style={{ ...S.select, width: 'auto', fontSize: '12px', padding: '4px 8px', margin: 0 }}>
                      <option value="">— subject —</option>
                      {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={q.chapter} onChange={e => setDetected(prev => prev.map(x => x._id === q._id ? { ...x, chapter: e.target.value } : x))}
                      style={{ ...S.select, width: 'auto', fontSize: '12px', padding: '4px 8px', margin: 0 }} disabled={!q.subject}>
                      <option value="">— chapter —</option>
                      {(QB_SUBJECTS[q.subject] || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={q.correct_option || ''} onChange={e => setDetected(prev => prev.map(x => x._id === q._id ? { ...x, correct_option: e.target.value } : x))}
                      style={{ ...S.select, width: 'auto', fontSize: '12px', padding: '4px 8px', margin: 0 }}>
                      <option value="">Ans?</option>
                      {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    {!q.correct_option && <span style={S.badge('#dc2626', '#fee2e2')}>⚠ no answer</span>}
                    {!q.subject && <span style={S.badge('#f59e0b', '#fef9c3')}>⚠ no subject</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={handleSaveAll} disabled={saving} style={S.btn('#16a34a', saving)}>
              {saving ? '⏳ Saving...' : `✅ Save ${selectedSet.size} selected to Bank`}
            </button>
          </div>
        </div>
      )}

      {saveResult && (
        <div style={{ padding: '14px 18px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '10px', color: '#15803d', fontWeight: '700', fontSize: '14px' }}>
          ✅ {saveResult.count} questions saved to the Question Bank!
        </div>
      )}
    </>
  )
}

// ─── Tab: AI Generator ────────────────────────────────────────────────────────

function TabAI({ refetch }) {
  const [subject,     setSubject]     = useState('')
  const [chapter,     setChapter]     = useState('')
  const [count,       setCount]       = useState(5)
  const [difficulty,  setDifficulty]  = useState('Medium')
  const [generating,  setGenerating]  = useState(false)
  const [generated,   setGenerated]   = useState([])
  const [selectedSet, setSelectedSet] = useState(new Set())
  const [saving,      setSaving]      = useState(false)
  const [saveResult,  setSaveResult]  = useState(null)
  const [batchMode,   setBatchMode]   = useState(false)
  const [batchQueue,  setBatchQueue]  = useState([])   // [{ subject, chapter, count, difficulty }]
  const [batchRunning,setBatchRunning]= useState(false)
  const [batchLog,    setBatchLog]    = useState([])

  const chapters = QB_SUBJECTS[subject] || []

  const generateOne = async (subj, chap, cnt, diff) => {
    const prompt = `You are an expert question setter for AISSEE (All India Sainik Schools Entrance Examination) Class VI.
Generate exactly ${cnt} multiple choice questions for:
Subject: ${subj}
Chapter/Topic: ${chap}
Difficulty: ${diff}
Age level: 10–12 years

Return ONLY a valid JSON array, no markdown, no backticks.
Format: [{"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A","explanation":"Brief explanation"}]

Rules:
- All four options must be plausible but only one correct
- For Mathematics: include actual numbers and calculations
- For Intelligence: use patterns, sequences, analogies
- For Language: test grammar and vocabulary
- No duplicate questions`

    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    const text = data.content?.map(b => b.type === 'text' ? b.text : '').join('').replace(/```json|```/g, '').trim()
    return JSON.parse(text)
  }

  const handleGenerate = async () => {
    if (!subject || !chapter) { alert('Select subject and chapter.'); return }
    setGenerating(true); setGenerated([]); setSelectedSet(new Set()); setSaveResult(null)
    try {
      const arr    = await generateOne(subject, chapter, count, difficulty)
      const tagged = arr.map((q, i) => ({ ...q, _id: i, subject, chapter, difficulty, marks: subject === 'Mathematics' ? 3 : 2, source: 'AI Generated' }))
      setGenerated(tagged)
      setSelectedSet(new Set(tagged.map(q => q._id)))
    } catch (e) { alert('Generation failed: ' + e.message) }
    setGenerating(false)
  }

  const handleBatchRun = async () => {
    if (!batchQueue.length) return
    setBatchRunning(true); setBatchLog([]); setGenerated([]); setSelectedSet(new Set())
    const all = []
    for (const item of batchQueue) {
      setBatchLog(l => [...l, { item, status: 'running' }])
      try {
        const arr = await generateOne(item.subject, item.chapter, item.count, item.difficulty)
        const tagged = arr.map((q, i) => ({ ...q, _id: `${item.subject}-${item.chapter}-${i}`, subject: item.subject, chapter: item.chapter, difficulty: item.difficulty, marks: item.subject === 'Mathematics' ? 3 : 2, source: 'AI Generated' }))
        all.push(...tagged)
        setBatchLog(l => l.map(x => x.item === item ? { ...x, status: 'done', count: arr.length } : x))
      } catch (e) {
        setBatchLog(l => l.map(x => x.item === item ? { ...x, status: 'error', err: e.message } : x))
      }
    }
    setGenerated(all)
    setSelectedSet(new Set(all.map(q => q._id)))
    setBatchRunning(false)
  }

  const handleSave = async () => {
    const toSave = generated.filter(q => selectedSet.has(q._id))
    if (!toSave.length) return
    setSaving(true)
    const payload = toSave.map(({ _id, ...rest }) => rest)
    const { error } = await supabase.from('qbank_questions').insert(payload)
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setSaveResult({ count: toSave.length })
    setGenerated([]); setSelectedSet(new Set()); refetch()
    setSaving(false)
  }

  return (
    <>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>🤖 AI Question Generator</h2>
          <button onClick={() => setBatchMode(m => !m)} style={S.btnOut('#7c3aed', batchMode)}>
            {batchMode ? '✖ Single Mode' : '⚡ Batch Mode'}
          </button>
        </div>

        {!batchMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={S.label}>Subject</label>
              <select value={subject} onChange={e => { setSubject(e.target.value); setChapter('') }} style={S.select}>
                <option value="">Select</option>
                {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Chapter / Topic</label>
              <select value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject} style={{ ...S.select, opacity: subject ? 1 : 0.5 }}>
                <option value="">Select</option>
                {chapters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Count</label>
              <select value={count} onChange={e => setCount(parseInt(e.target.value))} style={S.select}>
                {[3, 5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={S.select}>
                {[...DIFFICULTY, 'Mixed'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <button onClick={handleGenerate} disabled={generating || !subject || !chapter} style={S.btn('#7c3aed', generating || !subject || !chapter)}>
                {generating ? '⏳ Generating...' : '🤖 Generate Questions'}
              </button>
            </div>
          </div>
        )}

        {batchMode && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
              Add multiple subject–chapter combinations to generate in one go. All generated questions are auto-saved to the bank.
            </div>
            {/* Batch queue builder */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px auto', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
              <div>
                <label style={S.label}>Subject</label>
                <select id="bs" style={S.select}><option value="">Select</option>{ALL_SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}</select>
              </div>
              <div>
                <label style={S.label}>Chapter</label>
                <select id="bc" style={S.select}><option value="">Select</option></select>
              </div>
              <div>
                <label style={S.label}>Count</label>
                <select id="bn" style={S.select}>{[5,10,15,20].map(n=><option key={n} value={n}>{n}</option>)}</select>
              </div>
              <div>
                <label style={S.label}>Difficulty</label>
                <select id="bd" style={S.select}>{[...DIFFICULTY,'Mixed'].map(d=><option key={d} value={d}>{d}</option>)}</select>
              </div>
              <div>
                <button onClick={() => {
                  const bs = document.getElementById('bs').value
                  const bc = document.getElementById('bc').value
                  const bn = parseInt(document.getElementById('bn').value)
                  const bd = document.getElementById('bd').value
                  if (!bs || !bc) { alert('Select subject and chapter'); return }
                  setBatchQueue(q => [...q, { subject: bs, chapter: bc, count: bn, difficulty: bd }])
                }} style={S.btn('#16a34a')}>➕ Add</button>
              </div>
            </div>

            {/* Update chapter dropdown on subject change (via event delegation) */}
            <script dangerouslySetInnerHTML={{ __html: `
              document.getElementById('bs')?.addEventListener('change', function() {
                const chapters = ${JSON.stringify(QB_SUBJECTS)};
                const sel = document.getElementById('bc');
                sel.innerHTML = '<option value="">Select</option>';
                (chapters[this.value]||[]).forEach(c => { const o = document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
              });
            ` }} />

            {batchQueue.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                {batchQueue.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '7px', marginBottom: '5px', fontSize: '13px' }}>
                    <span style={S.badge('#1e3a5f', '#eff6ff')}>{item.subject}</span>
                    <span style={{ flex: 1, color: '#374151' }}>{item.chapter}</span>
                    <span style={{ color: '#64748b' }}>{item.count} Qs · {item.difficulty}</span>
                    <button onClick={() => setBatchQueue(q => q.filter((_, j) => j !== i))} style={S.btnSm('#dc2626')}>✖</button>
                  </div>
                ))}
                <button onClick={handleBatchRun} disabled={batchRunning} style={{ ...S.btn('#7c3aed', batchRunning), marginTop: '10px' }}>
                  {batchRunning ? '⏳ Generating batch...' : `⚡ Run Batch (${batchQueue.length} topics)`}
                </button>
              </div>
            )}

            {batchLog.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                {batchLog.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span>{entry.status === 'running' ? '⏳' : entry.status === 'done' ? '✅' : '❌'}</span>
                    <span style={{ flex: 1, color: '#374151' }}>{entry.item.subject} — {entry.item.chapter}</span>
                    {entry.status === 'done'  && <span style={{ color: '#16a34a', fontWeight: '700' }}>{entry.count} generated</span>}
                    {entry.status === 'error' && <span style={{ color: '#dc2626' }}>{entry.err}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generated questions preview */}
      {generated.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>
              ✨ {generated.length} questions generated — review before saving
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setSelectedSet(new Set(generated.map(q => q._id)))} style={S.btnSm('#1e3a5f')}>Select All</button>
              <button onClick={() => setSelectedSet(new Set())} style={S.btnSm('#64748b')}>Deselect All</button>
            </div>
          </div>
          {generated.map((q, i) => (
            <QuestionCard key={q._id} q={q} index={i}
              selectable selected={selectedSet.has(q._id)}
              onToggle={id => setSelectedSet(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })}
              showAnswer />
          ))}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={handleSave} disabled={saving} style={S.btn('#16a34a', saving)}>
              {saving ? '⏳ Saving...' : `✅ Save ${selectedSet.size} to Question Bank`}
            </button>
          </div>
        </div>
      )}

      {saveResult && (
        <div style={{ padding: '14px 18px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '10px', color: '#15803d', fontWeight: '700', fontSize: '14px' }}>
          ✅ {saveResult.count} questions saved to the Question Bank!
        </div>
      )}
    </>
  )
}

// ─── Tab: Test Builder ────────────────────────────────────────────────────────

function TabBuilder({ questions, refetch: refetchTests }) {
  const [step,           setStep]           = useState(1)   // 1=config 2=pick 3=preview 4=saved
  const [testMeta, setTestMeta]             = useState({
    title: '', exam_type: 'AISSEE', date: today(), duration_minutes: 150,
    total_marks: 0, instructions: '', batch_name: '', admit_type: '',
  })
  const [pattern,        setPattern]        = useState('aissee') // 'aissee' | 'custom'
  const [selectedIds,    setSelectedIds]    = useState(new Set())
  const [filterSubject,  setFilterSubject]  = useState('All')
  const [filterChapter,  setFilterChapter]  = useState('All')
  const [filterDifficulty,setFilterDifficulty] = useState('All')
  const [qSearch,        setQSearch]        = useState('')
  const [saving,         setSaving]         = useState(false)

  const chapters = filterSubject !== 'All' ? (QB_SUBJECTS[filterSubject] || []) : []

  const toggleQ = (id) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const filteredQ = useMemo(() => {
    const q = qSearch.toLowerCase()
    return questions.filter(item => {
      if (filterSubject !== 'All' && item.subject !== filterSubject) return false
      if (filterChapter !== 'All' && item.chapter !== filterChapter) return false
      if (filterDifficulty !== 'All' && item.difficulty !== filterDifficulty) return false
      if (q && !item.question?.toLowerCase().includes(q) && !item.chapter?.toLowerCase().includes(q)) return false
      return true
    })
  }, [questions, filterSubject, filterChapter, filterDifficulty, qSearch])

  const selectedQs = useMemo(() => questions.filter(q => selectedIds.has(q.id)), [questions, selectedIds])
  const totalMarks  = useMemo(() => selectedQs.reduce((a, q) => a + (q.marks || 1), 0), [selectedQs])

  const autoPickAISSEE = () => {
    const newIds = new Set()
    Object.entries(AISSEE_PATTERN).forEach(([subj, { count }]) => {
      const pool = questions.filter(q => q.subject === subj).sort(() => Math.random() - 0.5).slice(0, count)
      pool.forEach(q => newIds.add(q.id))
    })
    setSelectedIds(newIds)
  }

  const handleSaveTest = async () => {
    if (!testMeta.title.trim()) { alert('Enter a test title.'); return }
    if (!selectedIds.size)       { alert('Select at least one question.'); return }
    setSaving(true)
    const questionsPayload = selectedQs.map((q, i) => ({ question_id: q.id, order_num: i + 1, marks: q.marks || 1 }))
    const payload = {
      title:            testMeta.title,
      exam_type:        testMeta.exam_type,
      test_date:        testMeta.date,
      duration_minutes: parseInt(testMeta.duration_minutes),
      total_marks:      totalMarks,
      total_questions:  selectedIds.size,
      instructions:     testMeta.instructions || null,
      batch_name:       testMeta.batch_name || null,
      admit_type:       testMeta.admit_type || null,
      questions:        questionsPayload,
    }
    const { data, error } = await saveTest(payload)
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setSaving(false); setStep(4); refetchTests()
  }

  // Subject distribution of selected questions
  const distrib = useMemo(() => {
    const map = {}
    selectedQs.forEach(q => { map[q.subject] = (map[q.subject] || 0) + 1 })
    return map
  }, [selectedQs])

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '24px' }}>
        {['Test Setup', 'Pick Questions', 'Preview', 'Done'].map((label, i) => {
          const s = i + 1
          const done = step > s; const active = step === s
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: s < 4 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: s < step ? 'pointer' : 'default' }} onClick={() => s < step && setStep(s)}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', background: done ? '#16a34a' : active ? '#1e3a5f' : '#e2e8f0', color: done || active ? 'white' : '#94a3b8', flexShrink: 0 }}>
                  {done ? '✓' : s}
                </div>
                <span style={{ fontSize: '13px', fontWeight: active ? '700' : '400', color: active ? '#1e3a5f' : done ? '#16a34a' : '#94a3b8', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {s < 4 && <div style={{ flex: 1, height: '2px', background: done ? '#16a34a' : '#e2e8f0', borderRadius: '1px', margin: '0 6px' }} />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Test Meta */}
      {step === 1 && (
        <div style={S.card}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginTop: 0, marginBottom: '20px' }}>📝 Test Setup</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.label}>Test Title *</label>
              <input value={testMeta.title} onChange={e => setTestMeta(m => ({ ...m, title: e.target.value }))} required placeholder="e.g. AISSEE Full Mock Test — June 2025" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Exam Type</label>
              <select value={testMeta.exam_type} onChange={e => setTestMeta(m => ({ ...m, exam_type: e.target.value }))} style={S.select}>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Test Date</label>
              <input type="date" value={testMeta.date} onChange={e => setTestMeta(m => ({ ...m, date: e.target.value }))} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Duration (minutes)</label>
              <input type="number" min="15" value={testMeta.duration_minutes} onChange={e => setTestMeta(m => ({ ...m, duration_minutes: e.target.value }))} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Batch / Class</label>
              <input value={testMeta.batch_name} onChange={e => setTestMeta(m => ({ ...m, batch_name: e.target.value }))} placeholder="e.g. Achiever, All batches" style={S.input} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.label}>Instructions (optional)</label>
              <textarea value={testMeta.instructions} onChange={e => setTestMeta(m => ({ ...m, instructions: e.target.value }))} rows={3}
                style={{ ...S.input, resize: 'vertical' }}
                placeholder="1. This test has 125 questions.&#10;2. No negative marking.&#10;3. Duration: 150 minutes." />
            </div>
          </div>

          {/* Pattern picker */}
          <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '10px' }}>
            <div style={{ fontWeight: '700', color: '#374151', marginBottom: '12px', fontSize: '13px' }}>Question Selection Pattern</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setPattern('aissee')} style={S.btnOut('#1e3a5f', pattern === 'aissee')}>
                📋 AISSEE Pattern (Math 50 × 3 · GK/Intel/Lang 25 × 2)
              </button>
              <button onClick={() => setPattern('custom')} style={S.btnOut('#7c3aed', pattern === 'custom')}>
                ✏️ Manual Selection
              </button>
            </div>
          </div>

          <button onClick={() => { if (pattern === 'aissee') autoPickAISSEE(); setStep(2) }} style={{ ...S.btn('#1e3a5f'), marginTop: '16px' }}>
            Next: Pick Questions →
          </button>
        </div>
      )}

      {/* Step 2: Pick Questions */}
      {step === 2 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '16px' }}>
                🗂️ Select Questions — {selectedIds.size} selected · {totalMarks} marks
              </span>
              {pattern === 'aissee' && (
                <button onClick={autoPickAISSEE} style={{ ...S.btnSm('#7c3aed'), marginLeft: '12px' }}>⚡ Auto-pick AISSEE pattern</button>
              )}
            </div>
            <button onClick={() => setStep(3)} style={S.btn('#1e3a5f')}>Preview Test →</button>
          </div>

          {/* Distribution bar */}
          {Object.keys(distrib).length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {Object.entries(distrib).map(([subj, cnt]) => (
                <span key={subj} style={{ ...S.pill('#1e3a5f', '#eff6ff'), fontSize: '12px' }}>
                  {subj}: {cnt}
                  {AISSEE_PATTERN[subj] && <span style={{ color: '#94a3b8', marginLeft: '4px' }}>/ {AISSEE_PATTERN[subj].count}</span>}
                </span>
              ))}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <input placeholder="🔍 Search questions..." value={qSearch} onChange={e => setQSearch(e.target.value)} style={S.input} />
            <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterChapter('All') }} style={S.select}>
              <option value="All">All Subjects</option>
              {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterChapter} onChange={e => setFilterChapter(e.target.value)} style={{ ...S.select, opacity: filterSubject !== 'All' ? 1 : 0.5 }} disabled={filterSubject === 'All'}>
              <option value="All">All Chapters</option>
              {chapters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} style={S.select}>
              <option value="All">All Levels</option>
              {DIFFICULTY.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button onClick={() => filteredQ.forEach(q => setSelectedIds(s => new Set([...s, q.id])))} style={S.btnSm('#1e3a5f')}>Select filtered</button>
            <button onClick={() => filteredQ.forEach(q => setSelectedIds(s => { const n = new Set(s); n.delete(q.id); return n }))} style={S.btnSm('#64748b')}>Deselect filtered</button>
            <span style={{ fontSize: '13px', color: '#64748b', alignSelf: 'center', marginLeft: '6px' }}>Showing {filteredQ.length} questions</span>
          </div>

          {filteredQ.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i} selectable selected={selectedIds.has(q.id)} onToggle={toggleQ} />
          ))}
          <button onClick={() => setStep(3)} style={{ ...S.btn('#1e3a5f'), marginTop: '16px' }}>Preview Test →</button>
        </>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>📋 Test Preview</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep(2)} style={S.btn('#64748b')}>◀ Edit</button>
              <button onClick={() => window.print()} style={S.btn('#7c3aed')}>🖨️ Print</button>
              <button onClick={handleSaveTest} disabled={saving} style={S.btn('#16a34a', saving)}>
                {saving ? '⏳ Saving...' : '✅ Save & Publish Test'}
              </button>
            </div>
          </div>

          {/* Test header (printable) */}
          <div style={{ border: '2px solid #1e3a5f', borderRadius: '10px', padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '2px', marginBottom: '4px' }}>GUIDANCE NAVODAYA & SAINIK INSTITUTE</div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#1e3a5f', margin: '0 0 4px' }}>{testMeta.title}</h1>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {testMeta.exam_type} · {fmtDate(testMeta.date)} · {testMeta.duration_minutes} minutes · {totalMarks} marks · {selectedIds.size} questions
                {testMeta.batch_name && ` · ${testMeta.batch_name}`}
              </div>
            </div>
            {/* Subject distribution */}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
              {Object.entries(distrib).map(([subj, cnt]) => (
                <span key={subj} style={{ padding: '4px 12px', border: '1px solid #1e3a5f', borderRadius: '999px', fontSize: '12px', color: '#1e3a5f', fontWeight: '700' }}>
                  {subj}: {cnt} Qs
                </span>
              ))}
            </div>
            {testMeta.instructions && (
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#374151' }}>
                <strong>Instructions:</strong><br />
                <div style={{ whiteSpace: 'pre-line', marginTop: '4px' }}>{testMeta.instructions}</div>
              </div>
            )}
          </div>

          {/* Questions (answer-hidden for print) */}
          {selectedQs.map((q, i) => (
            <div key={q.id} style={{ marginBottom: '16px', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px', marginBottom: '10px' }}>
                <span style={{ color: '#94a3b8', marginRight: '6px' }}>Q{i + 1}.</span>{q.question}
                <span style={{ float: 'right', fontSize: '12px', color: '#64748b' }}>[{q.marks || 1} mark{q.marks > 1 ? 's' : ''}]</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {['A', 'B', 'C', 'D'].map(l => (
                  <div key={l} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '700', marginRight: '6px', color: '#94a3b8' }}>{l}.</span>
                    {q[`option_${l.toLowerCase()}`] || '—'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 4: Saved confirmation */}
      {step === 4 && (
        <div style={{ ...S.card, textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontWeight: '700', color: '#16a34a', fontSize: '20px' }}>Test saved successfully!</h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>{testMeta.title} · {selectedIds.size} questions · {totalMarks} marks</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={() => { setStep(1); setSelectedIds(new Set()); setTestMeta({ title: '', exam_type: 'AISSEE', date: today(), duration_minutes: 150, total_marks: 0, instructions: '', batch_name: '', admit_type: '' }) }} style={S.btn('#1e3a5f')}>
              ➕ Create Another Test
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Saved Tests ─────────────────────────────────────────────────────────

function TabTests({ currentUser }) {
  const [tests,    setTests]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [activeTest, setActiveTest] = useState(null)    // test being taken
  const [answers,  setAnswers]  = useState({})
  const [submitted,setSubmitted]= useState(false)
  const [submitting,setSubmitting]=useState(false)
  const [resultData,setResultData]=useState(null)
  const [studentName,setStudentName]=useState('')
  const [rollNo,   setRollNo]   = useState('')

  const fetchTests = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('qbank_tests').select('*').order('created_at', { ascending: false })
    if (data) setTests(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTests() }, [fetchTests])

  const startTest = async (test) => {
    if (!studentName.trim()) { alert('Enter student name to start the test.'); return }
    // Load full question objects
    const ids = (test.questions || []).map(q => q.question_id)
    if (!ids.length) { alert('This test has no questions.'); return }
    const { data: qs } = await supabase.from('qbank_questions').select('*').in('id', ids)
    const ordered = (test.questions || []).map(tq => ({
      ...qs.find(q => q.id === tq.question_id),
      order_num: tq.order_num, marks: tq.marks,
    })).filter(Boolean)
    setActiveTest({ ...test, loadedQuestions: ordered })
    setAnswers({}); setSubmitted(false); setResultData(null)
  }

  const handleSubmit = async () => {
    if (!window.confirm('Submit the test? You cannot change answers after this.')) return
    setSubmitting(true)
    const qs      = activeTest.loadedQuestions
    const correct = qs.filter(q => answers[q.id] === q.correct_option).length
    const wrong   = qs.filter(q => answers[q.id] && answers[q.id] !== q.correct_option).length
    const skipped = qs.filter(q => !answers[q.id]).length
    const score   = qs.reduce((a, q) => answers[q.id] === q.correct_option ? a + (q.marks || 1) : a, 0)
    const maxScore= qs.reduce((a, q) => a + (q.marks || 1), 0)
    const pcnt    = pct(score, maxScore)

    const payload = {
      test_id: activeTest.id, test_title: activeTest.title,
      student_name: studentName, roll_number: rollNo || null,
      score, max_score: maxScore, percentage: pcnt,
      correct_count: correct, wrong_count: wrong, skipped_count: skipped,
      answers: Object.entries(answers).map(([qid, ans]) => ({ question_id: qid, answer: ans })),
      submitted_at: new Date().toISOString(),
    }
    const { error } = await saveTestResult(payload)
    if (error) { alert('Error saving result: ' + error.message) }
    setResultData({ correct, wrong, skipped, score, maxScore, pcnt, qs })
    setSubmitted(true); setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this test?')) return
    await supabase.from('qbank_tests').delete().eq('id', id)
    fetchTests()
  }

  // ── Render active test ──
  if (activeTest && !submitted) {
    const qs = activeTest.loadedQuestions || []
    const answered = Object.keys(answers).length
    return (
      <div>
        {/* Test header */}
        <div style={{ ...S.card, padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f' }}>{activeTest.title}</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>{studentName}{rollNo ? ` · ${rollNo}` : ''} · {qs.length} questions · {activeTest.total_marks} marks</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={S.badge('#1e3a5f', '#eff6ff')}>{answered}/{qs.length} answered</span>
            <button onClick={() => setActiveTest(null)} style={S.btn('#64748b')}>✖ Exit</button>
            <button onClick={handleSubmit} disabled={submitting} style={S.btn('#16a34a', submitting)}>
              {submitting ? '⏳ Submitting...' : '✅ Submit Test'}
            </button>
          </div>
        </div>

        {qs.map((q, i) => (
          <div key={q.id} style={{ ...S.card, marginBottom: '12px', padding: '16px 20px' }}>
            <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '15px', marginBottom: '12px', lineHeight: '1.6' }}>
              <span style={{ color: '#94a3b8', marginRight: '8px' }}>Q{i + 1}.</span>{q.question}
              <span style={{ float: 'right', fontSize: '12px', color: '#64748b' }}>[{q.marks || 1}M]</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {['A', 'B', 'C', 'D'].map(l => (
                <button key={l} onClick={() => setAnswers(a => ({ ...a, [q.id]: l }))}
                  style={S.optBtn(answers[q.id] === l)}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${answers[q.id] === l ? '#1e3a5f' : '#e2e8f0'}`, background: answers[q.id] === l ? '#1e3a5f' : 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: answers[q.id] === l ? 'white' : '#94a3b8' }}>{l}</span>
                  </div>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{q[`option_${l.toLowerCase()}`] || '—'}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: '24px' }}>
          <button onClick={handleSubmit} disabled={submitting} style={S.btn('#16a34a', submitting)}>
            {submitting ? '⏳ Submitting...' : '✅ Submit Test'}
          </button>
        </div>
      </div>
    )
  }

  // ── Result screen ──
  if (activeTest && submitted && resultData) {
    const { correct, wrong, skipped, score, maxScore, pcnt, qs } = resultData
    return (
      <div>
        {/* Score card */}
        <div style={{ ...S.card, textAlign: 'center', padding: '32px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Result — {activeTest.title}</div>
          <div style={{ fontSize: '48px', fontWeight: '800', color: scoreColor(pcnt) }}>{pcnt}%</div>
          <div style={{ fontSize: '18px', color: '#374151', marginTop: '4px' }}>{score} / {maxScore}</div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px' }}>
            <span style={S.pill('#16a34a', '#dcfce7')}>✅ {correct} correct</span>
            <span style={S.pill('#dc2626', '#fee2e2')}>✗ {wrong} wrong</span>
            <span style={S.pill('#94a3b8', '#f1f5f9')}>— {skipped} skipped</span>
          </div>
          <div style={{ marginTop: '20px', fontSize: '16px', fontWeight: '700', color: scoreColor(pcnt) }}>
            {pcnt >= 75 ? '🎉 Excellent work! Keep it up.' : pcnt >= 50 ? '👍 Good effort. Review weak areas.' : '📚 Needs more practice. Don\'t give up!'}
          </div>
        </div>

        {/* Answer review */}
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>Answer Review</h3>
        {qs.map((q, i) => {
          const userAns  = answers[q.id]
          const isCorrect= userAns === q.correct_option
          const isWrong  = userAns && !isCorrect
          return (
            <div key={q.id} style={{ ...S.card, marginBottom: '10px', padding: '14px 16px', borderLeft: `4px solid ${isCorrect ? '#16a34a' : isWrong ? '#dc2626' : '#94a3b8'}` }}>
              <div style={{ fontWeight: '500', color: '#1e293b', fontSize: '14px', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8', marginRight: '6px' }}>Q{i + 1}.</span>{q.question}
              </div>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                Your answer: <strong style={{ color: isCorrect ? '#16a34a' : isWrong ? '#dc2626' : '#94a3b8' }}>{userAns || '—'}</strong>
                {isCorrect && ' ✅'}{isWrong && ' ✗'}
              </div>
              <div style={{ fontSize: '13px', color: '#16a34a' }}>
                Correct: <strong>{q.correct_option}. {q[`option_${q.correct_option?.toLowerCase()}`]}</strong>
              </div>
              {q.explanation && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#92400e', background: '#fffbeb', padding: '6px 10px', borderRadius: '6px' }}>
                  💡 {q.explanation}
                </div>
              )}
            </div>
          )
        })}
        <button onClick={() => { setActiveTest(null); setSubmitted(false); setResultData(null) }} style={S.btn('#1e3a5f')}>
          ← Back to Tests
        </button>
      </div>
    )
  }

  // ── Tests list ──
  return (
    <>
      <div style={{ ...S.card, padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ fontWeight: '700', color: '#374151', marginBottom: '12px', fontSize: '14px' }}>Student details to start a test</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={S.label}>Student Name *</label>
            <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Enter student name" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Roll No (optional)</label>
            <input value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="e.g. 2025-001" style={S.input} />
          </div>
        </div>
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading tests...</div>
        : tests.length === 0
          ? <div style={{ ...S.card, textAlign: 'center', padding: '48px', color: '#94a3b8' }}>No tests created yet. Go to Test Builder to create one.</div>
          : tests.map(test => (
            <div key={test.id} style={{ ...S.card, padding: '16px 20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>{test.title}</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={S.badge('#1e3a5f', '#eff6ff')}>{test.exam_type}</span>
                    <span style={S.badge('#7c3aed', '#f3e8ff')}>{test.total_questions} questions</span>
                    <span style={S.badge('#16a34a', '#dcfce7')}>{test.total_marks} marks</span>
                    <span style={S.badge('#64748b', '#f1f5f9')}>{test.duration_minutes} min</span>
                    {test.batch_name && <span style={S.badge('#0891b2', '#e0f2fe')}>{test.batch_name}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Created {fmtDate(test.created_at?.split('T')[0])} · Test date: {fmtDate(test.test_date)}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => window.print()} style={S.btnSm('#7c3aed')}>🖨️ Print</button>
                  <button onClick={() => startTest(test)} style={S.btnSm('#16a34a')}>▶ Start Test</button>
                  <button onClick={() => handleDelete(test.id)} style={S.btnSm('#dc2626')}>🗑</button>
                </div>
              </div>
              {test.instructions && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                  {test.instructions.slice(0, 120)}{test.instructions.length > 120 ? '…' : ''}
                </div>
              )}
            </div>
          ))
      }
    </>
  )
}

// ─── Tab: Results ─────────────────────────────────────────────────────────────

function TabResults() {
  const [results,        setResults]        = useState([])
  const [loading,        setLoading]        = useState(true)
  const [filterTest,     setFilterTest]     = useState('All')
  const [filterStudent,  setFilterStudent]  = useState('All')

  useEffect(() => {
    supabase.from('qbank_test_results').select('*').order('submitted_at', { ascending: false })
      .then(({ data }) => { if (data) setResults(data); setLoading(false) })
  }, [])

  const allTests    = [...new Set(results.map(r => r.test_title).filter(Boolean))]
  const allStudents = [...new Set(results.map(r => r.student_name).filter(Boolean))]

  const filtered = results.filter(r =>
    (filterTest === 'All' || r.test_title === filterTest) &&
    (filterStudent === 'All' || r.student_name === filterStudent)
  )

  const avgPcnt   = filtered.length > 0 ? Math.round(filtered.reduce((a, r) => a + (r.percentage || 0), 0) / filtered.length) : 0
  const topResult = filtered.length > 0 ? filtered.reduce((best, r) => r.percentage > best.percentage ? r : best, filtered[0]) : null
  const weakStudents = filtered.filter(r => r.percentage < 50)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total Attempts', value: filtered.length,                          color: '#1e3a5f', bg: '#eff6ff', icon: '📝' },
          { label: 'Avg Score',      value: `${avgPcnt}%`,                            color: scoreColor(avgPcnt), bg: scoreBg(avgPcnt), icon: '📊' },
          { label: 'Top Score',      value: topResult ? `${topResult.percentage}%` : '—', color: '#16a34a', bg: '#dcfce7', icon: '🏆' },
          { label: 'Below 50%',      value: weakStudents.length,                      color: '#dc2626', bg: '#fee2e2', icon: '⚠️' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{c.icon}</div>
            <p style={{ fontSize: '12px', color: c.color, fontWeight: '600', margin: 0 }}>{c.label}</p>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: c.color, margin: '2px 0 0' }}>{c.value}</h2>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={filterTest} onChange={e => setFilterTest(e.target.value)} style={{ ...S.select, width: 'auto' }}>
          <option value="All">All Tests</option>
          {allTests.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} style={{ ...S.select, width: 'auto' }}>
          <option value="All">All Students</option>
          {allStudents.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => window.print()} style={S.btn('#7c3aed')}>🖨️ Print Results</button>
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading results...</div>
        : (
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1e3a5f', color: 'white' }}>
                  {['#', 'Student', 'Roll No', 'Test', 'Score', '%', 'Correct', 'Wrong', 'Skipped', 'Grade', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>{r.student_name}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.roll_number || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#374151', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.test_title}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: '#1e293b' }}>{r.score}/{r.max_score}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '40px', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${r.percentage}%`, height: '100%', background: scoreColor(r.percentage), borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontWeight: '700', color: scoreColor(r.percentage) }}>{r.percentage}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: '600' }}>{r.correct_count}</td>
                    <td style={{ padding: '10px 12px', color: '#dc2626', fontWeight: '600' }}>{r.wrong_count}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{r.skipped_count}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ ...S.badge(scoreColor(r.percentage), scoreBg(r.percentage)) }}>
                        {r.percentage >= 75 ? 'Good' : r.percentage >= 50 ? 'Avg' : 'Weak'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(r.submitted_at?.split('T')[0])}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No results yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }
    </>
  )
}

// ─── CSV split helper ─────────────────────────────────────────────────────────

function splitCsvLine(line) {
  const result = []; let cur = ''; let inQ = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ }
    else if (line[i] === ',' && !inQ) { result.push(cur); cur = '' }
    else { cur += line[i] }
  }
  result.push(cur)
  return result
}

// ─── Main Component ───────────────────────────────────────────────────────────

function QuestionBank({ currentUser }) {
  const [activeTab,  setActiveTab]  = useState(() => {
    try { return localStorage.getItem('gnsi_qbank_tab') || 'bank' } catch { return 'bank' }
  })
  const [questions,  setQuestions]  = useState([])
  const [loadingQ,   setLoadingQ]   = useState(true)
  const [testCount,  setTestCount]  = useState(0)
  const [resultCount,setResultCount]= useState(0)

  const refetchQuestions = useCallback(async () => {
    setLoadingQ(true)
    const { data } = await fetchQuestions()
    if (data) setQuestions(data)
    setLoadingQ(false)
  }, [])

  const refetchCounts = useCallback(async () => {
    const [t, r] = await Promise.all([
      supabase.from('qbank_tests').select('id', { count: 'exact', head: true }),
      supabase.from('qbank_test_results').select('id', { count: 'exact', head: true }),
    ])
    setTestCount(t.count || 0)
    setResultCount(r.count || 0)
  }, [])

  useEffect(() => { refetchQuestions(); refetchCounts() }, [])

  const handleTabChange = (key) => {
    setActiveTab(key)
    try { localStorage.setItem('gnsi_qbank_tab', key) } catch {}
  }

  const badges = {
    bank:    questions.length > 0 ? `${questions.length}` : null,
    upload:  null,
    ai:      null,
    builder: null,
    tests:   testCount > 0 ? `${testCount}` : null,
    results: resultCount > 0 ? `${resultCount}` : null,
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>📚 Question Bank &amp; Test Generator</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
          AISSEE Class VI · Manage questions · AI generation · Test builder · Results tracker
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px', marginBottom: '24px' }}>
        {TABS.map(t => {
          const active = activeTab === t.key
          const badge  = badges[t.key]
          return (
            <button key={t.key} onClick={() => handleTabChange(t.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '4px', padding: '10px 6px', fontWeight: '600', fontSize: '11px', cursor: 'pointer',
                background: active ? '#1e3a5f' : 'white',
                color: active ? 'white' : '#64748b',
                border: active ? '2px solid #1e3a5f' : '2px solid #e2e8f0',
                borderRadius: '10px', transition: 'all 0.15s ease',
                boxShadow: active ? '0 2px 10px rgba(30,58,95,0.25)' : 'none',
                position: 'relative', minHeight: '58px',
              }}>
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{t.icon}</span>
              <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
              {badge && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', padding: '1px 5px', borderRadius: '999px', fontSize: '9px', fontWeight: '700', background: active ? 'rgba(255,255,255,0.3)' : '#1e3a5f', color: 'white' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'bank'    && <TabBank questions={questions} loading={loadingQ} refetch={refetchQuestions} />}
      {activeTab === 'upload'  && <TabUpload refetch={refetchQuestions} />}
      {activeTab === 'ai'      && <TabAI refetch={refetchQuestions} />}
      {activeTab === 'sources' && (
  <TabSourceCollector refetchQuestions={refetchQuestions} />
)}
      {activeTab === 'builder' && <TabBuilder questions={questions} refetch={refetchCounts} />}
      {activeTab === 'tests'   && <TabTests currentUser={currentUser} />}
      {activeTab === 'results' && <TabResults />}
    </div>
  )
}

export default QuestionBank