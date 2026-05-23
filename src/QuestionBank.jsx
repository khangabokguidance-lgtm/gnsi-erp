// QuestionBank.jsx — GNSI Portal v2.0
// Examin8-style Question Bank for AISSEE / Sainik School preparation

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

const SUBJECTS = {
  Mathematics: [
    'Natural Numbers','LCM and HCF','Fractions','Decimal Numbers',
    'Ratio and Proportion','Percentage','Profit and Loss','Simple Interest',
    'Average','Unitary Method','Area and Perimeter','Volume of Cube and Cuboids',
    'Speed and Time','Lines and Angles','Types of Angles','Circle',
    'Prime and Composite Numbers','Roman Numerals','Simplification',
    'Conversion of Units','Operation on Numbers','Temperature',
    'Plane Figures','Arranging of Fractions','Complementary and Supplementary Angles',
  ],
  Intelligence: [
    'Analogies','Venn Diagram','Paper Folding','Embedded Figure',
    'Geometrical Figure Completion','Space Visualisation','Order and Ranking',
    'Coding Decoding','Mathematical Operations','Blood Relations',
    'Sitting Arrangement','Mirror Image','Figure Matching','Figure Series',
    'Odd Man Out','Pattern Completion','Classification','Word Formation',
    'Dictionary Word Order','Series Completion','Direction Test','Clock and Calendar',
  ],
  Language: [
    'Comprehension Passage','Preposition','Article','Vocabulary',
    'Verbs and Types','Confusing Words','Question Tags','Types of Sentence',
    'Tense Forms','Kinds of Nouns','Kinds of Pronouns','Correct Spelling',
    'Ordering of Words','Sentence Formation','Antonyms','Synonyms',
    'Adjectives','Interjection','Idiom and Phrases','Collective Nouns',
    'Number and Gender','Adverbs','Rhyming Words','Singular and Plural',
  ],
  'General Knowledge': [
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
}

const SUBJECT_LIST  = Object.keys(SUBJECTS)
const DIFFICULTIES  = ['Easy', 'Medium', 'Hard']
const MARKS_OPTIONS = [1, 2, 3]

const C = {
  navy:   '#1e3a5f',
  indigo: '#4f46e5',
  green:  '#16a34a',
  amber:  '#d97706',
  rose:   '#dc2626',
  violet: '#7c3aed',
  slate:  '#64748b',
  bg:     '#f8fafc',
  white:  '#ffffff',
  border: '#e2e8f0',
}

const SUBJECT_COLORS = {
  Mathematics:         { color: '#1e3a5f', bg: '#eff6ff', border: '#bfdbfe' },
  Intelligence:        { color: '#7c3aed', bg: '#f3e8ff', border: '#ddd6fe' },
  Language:            { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'General Knowledge': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
}

const inp  = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, boxSizing: 'border-box', background: C.white, fontFamily: 'system-ui,sans-serif', outline: 'none' }
const sel  = { ...inp }
const card = { background: C.white, borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: '20px 24px', marginBottom: 16 }
const btn  = (bg, disabled = false) => ({ padding: '9px 20px', borderRadius: 8, background: disabled ? C.slate : bg, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1 })
const btnSm= (bg) => ({ padding: '5px 12px', borderRadius: 6, background: bg, color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' })
const lbl  = { display: 'block', fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }

const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

function Badge({ text, color, bg, border }) {
  return <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, color, background: bg, border: `1px solid ${border || bg}` }}>{text}</span>
}

function Toast({ msg, color }) {
  return <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#fff', border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 360 }}>{msg}</div>
}

function QCard({ q, index, showAnswer = false, selectable, selected, onToggle, onDelete }) {
  const [reveal, setReveal] = useState(showAnswer)
  const sc = SUBJECT_COLORS[q.subject] || SUBJECT_COLORS.Mathematics
  return (
    <div style={{ ...card, marginBottom: 10, padding: '14px 18px', border: selected ? `2px solid ${C.navy}` : `1px solid ${C.border}`, background: selected ? '#f0f6ff' : '#fff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {selectable && <input type="checkbox" checked={!!selected} onChange={() => onToggle?.(q.id || q._id)} style={{ width: 16, height: 16, marginTop: 3, cursor: 'pointer', flexShrink: 0 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.slate, fontWeight: 700 }}>Q{index + 1}</span>
            <Badge text={q.subject} color={sc.color} bg={sc.bg} border={sc.border} />
            <Badge text={q.chapter} color={C.slate} bg="#f1f5f9" />
            <Badge text={q.difficulty || 'Medium'} color={q.difficulty==='Easy'?C.green:q.difficulty==='Hard'?C.rose:C.amber} bg={q.difficulty==='Easy'?'#dcfce7':q.difficulty==='Hard'?'#fee2e2':'#fef9c3'} />
            <Badge text={`${q.marks||1}M`} color={C.indigo} bg="#eff6ff" />
          </div>
          <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 500, lineHeight: 1.6, marginBottom: 10 }}>{q.question}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {['A','B','C','D'].map(l => (
              <div key={l} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, background: reveal && q.correct_option === l ? '#dcfce7' : '#f8fafc', border: `1px solid ${reveal && q.correct_option === l ? '#86efac' : C.border}`, color: reveal && q.correct_option === l ? '#15803d' : '#374151', fontWeight: reveal && q.correct_option === l ? 700 : 400 }}>
                <span style={{ fontWeight: 700, marginRight: 6, color: C.slate }}>{l}.</span>
                {q[`option_${l.toLowerCase()}`] || '—'}
                {reveal && q.correct_option === l && ' ✓'}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setReveal(r => !r)} style={btnSm(reveal ? C.slate : C.green)}>{reveal ? '🙈 Hide' : '👁 Answer'}</button>
            {onDelete && <button onClick={() => onDelete(q.id)} style={btnSm(C.rose)}>🗑 Delete</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddForm({ onSave, onCancel, saving }) {
  const [form, setForm] = useState({ subject: '', chapter: '', question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', difficulty: 'Medium', marks: 1 })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const chapters = SUBJECTS[form.subject] || []
  const valid = form.subject && form.chapter && form.question && form.option_a && form.option_b && form.option_c && form.option_d
  return (
    <div style={{ ...card, border: `1.5px solid ${C.indigo}44` }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 16 }}>➕ Add Question Manually</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div><label style={lbl}>Subject *</label><select style={sel} value={form.subject} onChange={e => set('subject', e.target.value)}><option value="">Select</option>{SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Chapter *</label><select style={{ ...sel, opacity: form.subject ? 1 : .5 }} value={form.chapter} onChange={e => set('chapter', e.target.value)} disabled={!form.subject}><option value="">Select</option>{chapters.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label style={lbl}>Difficulty</label><select style={sel} value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Question *</label><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={form.question} onChange={e => set('question', e.target.value)} placeholder="Type the question here…" /></div>
        {['A','B','C','D'].map(l => (
          <div key={l}><label style={{ ...lbl, color: form.correct_option === l ? C.green : C.slate }}>Option {l} {form.correct_option === l ? '✓' : ''}</label><input style={{ ...inp, borderColor: form.correct_option === l ? '#86efac' : C.border }} value={form[`option_${l.toLowerCase()}`]} onChange={e => set(`option_${l.toLowerCase()}`, e.target.value)} placeholder={`Option ${l}`} /></div>
        ))}
        <div><label style={lbl}>Correct Answer *</label><select style={sel} value={form.correct_option} onChange={e => set('correct_option', e.target.value)}>{['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}</select></div>
        <div><label style={lbl}>Marks</label><select style={sel} value={form.marks} onChange={e => set('marks', parseInt(e.target.value))}>{MARKS_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => valid && onSave(form)} disabled={!valid || saving} style={btn(C.navy, !valid || saving)}>{saving ? '⏳ Saving…' : '✅ Save Question'}</button>
        <button onClick={onCancel} style={btn(C.slate)}>Cancel</button>
      </div>
    </div>
  )
}

function TabBank({ questions, loading, refetch, showToast }) {
  const [filterSubject, setFilterSubject] = useState('All')
  const [filterChapter, setFilterChapter] = useState('All')
  const [filterDiff,    setFilterDiff]    = useState('All')
  const [search,        setSearch]        = useState('')
  const [showAdd,       setShowAdd]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [page,          setPage]          = useState(1)
  const PAGE = 20
  const chapters = filterSubject !== 'All' ? (SUBJECTS[filterSubject] || []) : []
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return questions.filter(item => {
      if (filterSubject !== 'All' && item.subject !== filterSubject) return false
      if (filterChapter !== 'All' && item.chapter !== filterChapter) return false
      if (filterDiff    !== 'All' && item.difficulty !== filterDiff)  return false
      if (q && !item.question?.toLowerCase().includes(q))             return false
      return true
    })
  }, [questions, filterSubject, filterChapter, filterDiff, search])
  const totalPages = Math.ceil(filtered.length / PAGE)
  const paginated  = filtered.slice((page-1)*PAGE, page*PAGE)
  const handleSave = async (form) => {
    setSaving(true)
    const { error } = await supabase.from('qbank_questions').insert({ ...form })
    if (error) showToast('Save failed: ' + error.message, C.rose)
    else { showToast('Question saved ✓', C.green); setShowAdd(false); refetch() }
    setSaving(false)
  }
  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return
    await supabase.from('qbank_questions').delete().eq('id', id)
    showToast('Deleted', C.rose); refetch()
  }
  const stats = useMemo(() => {
    const map = {}; SUBJECT_LIST.forEach(s => { map[s] = 0 })
    questions.forEach(q => { map[q.subject] = (map[q.subject] || 0) + 1 })
    return map
  }, [questions])
  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {SUBJECT_LIST.map(s => {
          const sc = SUBJECT_COLORS[s]
          return (
            <div key={s} onClick={() => { setFilterSubject(s); setFilterChapter('All'); setPage(1) }}
              style={{ flex: 1, minWidth: 130, padding: '14px 16px', borderRadius: 10, background: sc.bg, border: `1.5px solid ${sc.border}`, cursor: 'pointer' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: sc.color }}>{stats[s] || 0}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 3 }}>{s}</div>
            </div>
          )
        })}
        <div style={{ flex: 1, minWidth: 130, padding: '14px 16px', borderRadius: 10, background: '#f1f5f9', border: `1.5px solid ${C.border}` }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{questions.length}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 3 }}>Total</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setShowAdd(v => !v)} style={btn(showAdd ? C.slate : C.navy)}>{showAdd ? '✕ Cancel' : '➕ Add Question'}</button>
      </div>
      {showAdd && <AddForm onSave={handleSave} onCancel={() => setShowAdd(false)} saving={saving} />}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <input style={inp} placeholder="🔍 Search questions…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <select style={sel} value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterChapter('All'); setPage(1) }}><option value="All">All Subjects</option>{SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select style={{ ...sel, opacity: filterSubject !== 'All' ? 1 : .5 }} value={filterChapter} onChange={e => { setFilterChapter(e.target.value); setPage(1) }} disabled={filterSubject === 'All'}><option value="All">All Chapters</option>{chapters.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select style={sel} value={filterDiff} onChange={e => { setFilterDiff(e.target.value); setPage(1) }}><option value="All">All Difficulties</option>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select>
      </div>
      <div style={{ fontSize: 12, color: C.slate, marginBottom: 10 }}>Showing {filtered.length} questions</div>
      {loading ? <div style={{ textAlign: 'center', padding: 48, color: C.slate }}>⏳ Loading…</div>
        : paginated.length === 0 ? <div style={{ ...card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>No questions found. Add some or use AI Generator.</div>
        : paginated.map((q, i) => <QCard key={q.id} q={q} index={(page-1)*PAGE+i} onDelete={handleDelete} />)}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))}          disabled={page===1}          style={btn(C.slate, page===1)}>◀ Prev</button>
          <span style={{ padding: '9px 16px', fontWeight: 600, color: C.navy }}>Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} style={btn(C.slate, page===totalPages)}>Next ▶</button>
        </div>
      )}
    </>
  )
}

// ─── TAB 2: AI Generator — calls Gemini directly from browser ─────────────────
function TabGenerate({ refetch, showToast, questions }) {
  const [subject,    setSubject]    = useState('')
  const [chapter,    setChapter]    = useState('')
  const [count,      setCount]      = useState(10)
  const [difficulty, setDifficulty] = useState('Mixed')
  const [generating, setGenerating] = useState(false)
  const [generated,  setGenerated]  = useState([])
  const [selected,   setSelected]   = useState(new Set())
  const [saving,     setSaving]     = useState(false)
  const chapters      = SUBJECTS[subject] || []
  const existingCount = questions.filter(q => q.subject === subject && q.chapter === chapter).length

  const handleGenerate = async () => {
    if (!subject || !chapter) { alert('Select subject and chapter.'); return }
    setGenerating(true); setGenerated([]); setSelected(new Set())

    const existing = questions
      .filter(q => q.subject === subject && q.chapter === chapter)
      .map(q => q.question).slice(0, 10).join('\n')

    const prompt = `You are an expert question setter for AISSEE Class VI Sainik School entrance exam.
Generate exactly ${count} MCQ questions for:
Subject: ${subject}
Chapter: ${chapter}
Difficulty: ${difficulty === 'Mixed' ? 'mix of Easy, Medium and Hard' : difficulty}

Rules:
- Questions must be appropriate for Class VI students (age 10-12)
- Wrong options must be plausible common mistakes
- One wrong option should be a near-correct trap
- Questions must be unique
${existing ? `- Do NOT repeat these:\n${existing}` : ''}

Return ONLY a valid JSON array, no markdown, no explanation:
[{"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A","difficulty":"Medium"}]`

    try {
      const OR_KEY = import.meta.env.VITE_OPENROUTER_KEY
      if (!OR_KEY) throw new Error('VITE_OPENROUTER_KEY not set in Vercel environment variables')

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OR_KEY}`,
          'HTTP-Referer': 'https://gnsi-erp.vercel.app',
          'X-Title': 'GNSI Question Bank',
        },
        body: JSON.stringify({
          model: 'google/gemma-3-27b-it:free',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error.message)

      const text = data.choices?.[0]?.message?.content || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const match = clean.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No questions returned — try again')

      const arr    = JSON.parse(match[0])
      const tagged = arr.map((q, i) => ({
        ...q, _id: i, subject, chapter,
        marks: subject === 'Mathematics' ? 3 : 2,
      }))
      setGenerated(tagged)
      setSelected(new Set(tagged.map((_, i) => i)))
      showToast(`✨ ${tagged.length} questions generated`, C.green)
    } catch (e) {
      showToast('Generation failed: ' + e.message, C.rose)
    }
    setGenerating(false)
  }

  const handleSave = async () => {
    const toSave = generated.filter((_, i) => selected.has(i))
    if (!toSave.length) return
    setSaving(true)
    const rows = toSave.map(({ _id, ...rest }) => rest)
    const { error } = await supabase.from('qbank_questions').insert(rows)
    if (error) { showToast('Save failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ ${toSave.length} questions saved to bank`, C.green)
    setGenerated([]); setSelected(new Set()); refetch()
    setSaving(false)
  }

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 20 }}>🤖 AI Question Generator</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div><label style={lbl}>Subject *</label><select style={sel} value={subject} onChange={e => { setSubject(e.target.value); setChapter('') }}><option value="">Select</option>{SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label style={lbl}>Chapter *</label><select style={{ ...sel, opacity: subject ? 1 : .5 }} value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject}><option value="">Select</option>{chapters.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={lbl}>How Many</label><select style={sel} value={count} onChange={e => setCount(parseInt(e.target.value))}>{[5,10,15,20,25].map(n => <option key={n} value={n}>{n} questions</option>)}</select></div>
          <div><label style={lbl}>Difficulty</label><select style={sel} value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="Mixed">Mixed</option>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        </div>
        {subject && chapter && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', marginBottom: 14 }}>
            📊 Bank has <strong>{existingCount}</strong> questions for {subject} → {chapter}
            {existingCount < 20 && <span style={{ color: C.rose, marginLeft: 8 }}>⚠ Low — generate more</span>}
          </div>
        )}
        <button onClick={handleGenerate} disabled={generating || !subject || !chapter} style={btn(C.violet, generating || !subject || !chapter)}>
          {generating ? '⏳ Generating…' : '🤖 Generate Questions'}
        </button>
      </div>

      {generated.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>✨ {generated.length} questions ready — review before saving</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelected(new Set(generated.map((_, i) => i)))} style={btnSm(C.navy)}>All</button>
              <button onClick={() => setSelected(new Set())} style={btnSm(C.slate)}>None</button>
            </div>
          </div>
          {generated.map((q, i) => (
            <QCard key={i} q={q} index={i} showAnswer selectable selected={selected.has(i)}
              onToggle={() => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })} />
          ))}
          <button onClick={handleSave} disabled={saving || !selected.size} style={btn(C.green, saving || !selected.size)}>
            {saving ? '⏳ Saving…' : `✅ Save ${selected.size} to Bank`}
          </button>
        </div>
      )}
    </>
  )
}

async function generatePDF({ title, subject, chapter, questions, withAnswers, instituteName }) {
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
  }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, margin = 15
  let y = margin
  const checkPage = (need = 10) => { if (y + need > 285) { doc.addPage(); y = margin } }

  doc.setFillColor(30, 58, 95); doc.rect(0, 0, W, 28, 'F')
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
  doc.text(instituteName || 'Guidance Navodaya & Sainik Institute', margin, 12)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('Khangabok, Thoubal, Manipur', margin, 19)
  doc.text(`Date: ${today()}`, W - margin - 40, 19)
  y = 34

  doc.setDrawColor(30, 58, 95); doc.setLineWidth(.5)
  doc.line(margin, y, W - margin, y); y += 6
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 58, 95)
  doc.text(title, margin, y); y += 6
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
  doc.text(`Subject: ${subject}  |  Chapter: ${chapter}  |  Questions: ${questions.length}  |  Total Marks: ${questions.reduce((s,q)=>s+(q.marks||1),0)}`, margin, y)
  y += 6; doc.line(margin, y, W - margin, y); y += 8

  questions.forEach((q, i) => {
    checkPage(20)
    const qText = `Q${i+1}. ${q.question}`
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 58, 95)
    const lines = doc.splitTextToSize(qText, W - margin * 2 - 6)
    checkPage(lines.length * 5 + 20)
    doc.text(lines, margin, y); y += lines.length * 5.5 + 2
    ;['A','B','C','D'].forEach(l => {
      checkPage(7)
      const isCorrect = withAnswers && q.correct_option === l
      if (isCorrect) { doc.setFillColor(220, 252, 231); doc.roundedRect(margin+4, y-4, W-margin*2-8, 6.5, 1, 1, 'F') }
      doc.setFontSize(10); doc.setFont('helvetica', isCorrect ? 'bold' : 'normal')
      doc.setTextColor(isCorrect ? 21 : 55, isCorrect ? 128 : 65, isCorrect ? 61 : 81)
      const optLines = doc.splitTextToSize(`  ${l}. ${q[`option_${l.toLowerCase()}`] || '—'}${isCorrect ? '  ✓' : ''}`, W-margin*2-12)
      doc.text(optLines, margin+6, y); y += optLines.length * 5 + 1
    })
    y += 5; doc.setDrawColor(226, 232, 240); doc.setLineWidth(.2); doc.line(margin, y, W-margin, y); y += 5
  })

  if (!withAnswers) {
    doc.addPage(); y = margin
    doc.setFillColor(30, 58, 95); doc.rect(0, 0, W, 20, 'F')
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255)
    doc.text('ANSWER KEY', margin, 13); y = 26
    const colW = (W - margin * 2) / 5
    questions.forEach((q, i) => {
      const col = i % 5; if (col === 0 && i > 0) y += 8
      checkPage(10)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 58, 95)
      doc.text(`Q${i+1}: ${q.correct_option}`, margin + col * colW, y)
      if (i === questions.length - 1) y += 8
    })
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal')
    doc.text(`Page ${p} of ${pages}  |  GNSI Question Paper  |  Confidential`, margin, 292)
  }
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`)
}

function TabPaper({ questions, showToast }) {
  const [subject,     setSubject]     = useState('')
  const [chapter,     setChapter]     = useState('All Chapters')
  const [count,       setCount]       = useState(25)
  const [difficulty,  setDifficulty]  = useState('All')
  const [title,       setTitle]       = useState('')
  const [withAnswers, setWithAnswers] = useState(false)
  const [preview,     setPreview]     = useState(null)
  const [downloading, setDownloading] = useState(false)
  const chapters = subject ? ['All Chapters', ...SUBJECTS[subject]] : []

  const handlePreview = () => {
    if (!subject) { alert('Select a subject.'); return }
    let pool = questions.filter(q => {
      if (q.subject !== subject) return false
      if (chapter !== 'All Chapters' && q.chapter !== chapter) return false
      if (difficulty !== 'All' && q.difficulty !== difficulty) return false
      return true
    }).sort(() => Math.random() - .5).slice(0, count)
    if (pool.length === 0) { showToast('No questions in bank. Generate some first.', C.amber); return }
    setPreview(pool)
    if (!title) setTitle(`${subject}${chapter !== 'All Chapters' ? ' — ' + chapter : ''} Question Paper`)
  }

  const handleDownload = async () => {
    if (!preview?.length) return
    setDownloading(true)
    try {
      await generatePDF({ title: title || 'Question Paper', subject, chapter, questions: preview, withAnswers, instituteName: 'Guidance Navodaya & Sainik Institute' })
      showToast('📄 PDF downloaded!', C.green)
    } catch (e) { showToast('PDF failed: ' + e.message, C.rose) }
    setDownloading(false)
  }

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 20 }}>📄 Create Question Paper</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>Subject *</label><select style={sel} value={subject} onChange={e => { setSubject(e.target.value); setChapter('All Chapters') }}><option value="">Select</option>{SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label style={lbl}>Chapter</label><select style={{ ...sel, opacity: subject ? 1 : .5 }} value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject}>{chapters.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={lbl}>No. of Questions</label><select style={sel} value={count} onChange={e => setCount(parseInt(e.target.value))}>{[10,15,20,25,30,40,50].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          <div><label style={lbl}>Difficulty</label><select style={sel} value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="All">All</option>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Paper Title</label><input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mathematics — Fractions Test" /></div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.navy }}>
            <input type="checkbox" checked={withAnswers} onChange={e => setWithAnswers(e.target.checked)} />
            Include answers in PDF
          </label>
        </div>
        {subject && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', marginBottom: 14 }}>
            📊 Available: <strong>{questions.filter(q => q.subject===subject && (chapter==='All Chapters'||q.chapter===chapter)).length}</strong> questions
          </div>
        )}
        <button onClick={handlePreview} disabled={!subject} style={btn(C.navy, !subject)}>👁 Preview Paper</button>
      </div>
      {preview && (
        <div style={card}>
          <div style={{ border: `2px solid ${C.navy}`, borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ textAlign: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>Guidance Navodaya & Sainik Institute</div>
              <div style={{ fontSize: 12, color: C.slate }}>Khangabok, Thoubal, Manipur</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginTop: 8 }}>{title}</div>
              <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>Subject: {subject} | Questions: {preview.length} | Total Marks: {preview.reduce((s,q)=>s+(q.marks||1),0)} | Date: {today()}</div>
            </div>
            {preview.map((q, i) => (
              <div key={q.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}><span style={{ color: C.slate, marginRight: 6 }}>Q{i+1}.</span>{q.question}<span style={{ float: 'right', fontSize: 11, color: C.slate }}>[{q.marks||1}M]</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {['A','B','C','D'].map(l => (
                    <div key={l} style={{ fontSize: 12, padding: '4px 8px', color: '#374151' }}>
                      <span style={{ fontWeight: 700, color: C.slate, marginRight: 4 }}>{l}.</span>
                      {q[`option_${l.toLowerCase()}`] || '—'}
                      {withAnswers && q.correct_option === l && <span style={{ color: C.green, marginLeft: 6, fontWeight: 700 }}>✓</span>}
                    </div>
                  ))}
                </div>
                {i < preview.length - 1 && <div style={{ height: 1, background: C.border, marginTop: 10 }} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleDownload} disabled={downloading} style={btn(C.green, downloading)}>{downloading ? '⏳ Generating PDF…' : '⬇ Download PDF'}</button>
            <button onClick={() => setPreview(null)} style={btn(C.slate)}>✕ Close</button>
            <button onClick={handlePreview} style={btn(C.navy)}>🔀 Shuffle</button>
          </div>
        </div>
      )}
    </>
  )
}

function TabTest({ questions, showToast }) {
  const [subject,     setSubject]     = useState('')
  const [chapter,     setChapter]     = useState('All Chapters')
  const [count,       setCount]       = useState(20)
  const [studentName, setStudentName] = useState('')
  const [testQs,      setTestQs]      = useState(null)
  const [answers,     setAnswers]     = useState({})
  const [submitted,   setSubmitted]   = useState(false)
  const [result,      setResult]      = useState(null)
  const [timeLeft,    setTimeLeft]    = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const chapters = subject ? ['All Chapters', ...SUBJECTS[subject]] : []

  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [timerActive, timeLeft])

  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const handleStart = () => {
    if (!studentName.trim()) { alert('Enter student name.'); return }
    if (!subject) { alert('Select subject.'); return }
    let pool = questions.filter(q => {
      if (q.subject !== subject) return false
      if (chapter !== 'All Chapters' && q.chapter !== chapter) return false
      return true
    }).sort(() => Math.random() - .5).slice(0, count)
    if (pool.length === 0) { showToast('No questions available. Generate questions first.', C.amber); return }
    setTestQs(pool); setAnswers({}); setSubmitted(false); setResult(null)
    setTimeLeft(pool.length * 90); setTimerActive(true)
  }

  const handleSubmit = () => {
    if (!confirm('Submit the test?')) return
    setTimerActive(false)
    const qs = testQs
    const correct = qs.filter(q => answers[q.id] === q.correct_option).length
    const wrong   = qs.filter(q => answers[q.id] && answers[q.id] !== q.correct_option).length
    const skipped = qs.filter(q => !answers[q.id]).length
    const score   = qs.reduce((a,q) => answers[q.id]===q.correct_option ? a+(q.marks||1) : a, 0)
    const maxScore= qs.reduce((a,q) => a+(q.marks||1), 0)
    const pct     = maxScore ? Math.round((score/maxScore)*100) : 0
    setResult({ correct, wrong, skipped, score, maxScore, pct }); setSubmitted(true)
  }

  if (submitted && result) {
    const { correct, wrong, skipped, score, maxScore, pct } = result
    const color = pct >= 75 ? C.green : pct >= 50 ? C.amber : C.rose
    return (
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 52, fontWeight: 800, color }}>{pct}%</div>
          <div style={{ fontSize: 20, color: C.navy, fontWeight: 700 }}>{score} / {maxScore}</div>
          <div style={{ fontSize: 13, color: C.slate, marginTop: 4 }}>{studentName} · {subject} · {testQs?.length} questions</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <span style={{ padding: '6px 16px', borderRadius: 99, background: '#dcfce7', color: C.green, fontWeight: 700, fontSize: 13 }}>✅ {correct} correct</span>
            <span style={{ padding: '6px 16px', borderRadius: 99, background: '#fee2e2', color: C.rose, fontWeight: 700, fontSize: 13 }}>✗ {wrong} wrong</span>
            <span style={{ padding: '6px 16px', borderRadius: 99, background: '#f1f5f9', color: C.slate, fontWeight: 700, fontSize: 13 }}>— {skipped} skipped</span>
          </div>
        </div>
        {testQs?.map((q, i) => {
          const ua = answers[q.id]; const ok = ua === q.correct_option; const wr = ua && !ok
          return (
            <div key={q.id} style={{ marginBottom: 10, padding: '12px 16px', borderRadius: 9, border: `1px solid ${ok?'#86efac':wr?'#fca5a5':C.border}`, borderLeft: `4px solid ${ok?C.green:wr?C.rose:C.slate}`, background: ok?'#f0fdf4':wr?'#fff1f2':'#f8fafc' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', marginBottom: 6 }}><span style={{ color: C.slate, marginRight: 6 }}>Q{i+1}.</span>{q.question}</div>
              <div style={{ fontSize: 12 }}>Your answer: <strong style={{ color: ok?C.green:wr?C.rose:C.slate }}>{ua || '—'}</strong>{ok && ' ✅'}{wr && <span style={{ marginLeft: 12, color: C.green }}>Correct: <strong>{q.correct_option}. {q[`option_${q.correct_option?.toLowerCase()}`]}</strong></span>}</div>
            </div>
          )
        })}
        <button onClick={() => { setTestQs(null); setSubmitted(false); setResult(null) }} style={{ ...btn(C.navy), marginTop: 16 }}>← Back</button>
      </div>
    )
  }

  if (testQs) {
    return (
      <div>
        <div style={{ position: 'sticky', top: 0, zIndex: 99, background: C.navy, borderRadius: 10, padding: '12px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <div><div style={{ fontWeight: 700, fontSize: 14 }}>{studentName} · {subject}</div><div style={{ fontSize: 11, opacity: .7 }}>{Object.keys(answers).length}/{testQs.length} answered</div></div>
          <div style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 60 ? '#fca5a5' : '#fff' }}>⏱ {formatTime(timeLeft)}</div>
          <button onClick={handleSubmit} style={btn(C.green)}>✅ Submit</button>
        </div>
        {testQs.map((q, i) => (
          <div key={q.id} style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 12, lineHeight: 1.6 }}><span style={{ color: C.slate, marginRight: 8 }}>Q{i+1}.</span>{q.question}<span style={{ float: 'right', fontSize: 11, color: C.slate }}>[{q.marks||1}M]</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['A','B','C','D'].map(l => (
                <button key={l} onClick={() => setAnswers(a => ({ ...a, [q.id]: l }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: `2px solid ${answers[q.id]===l ? C.navy : C.border}`, borderRadius: 8, background: answers[q.id]===l ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${answers[q.id]===l ? C.navy : C.border}`, background: answers[q.id]===l ? C.navy : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: answers[q.id]===l ? '#fff' : C.slate }}>{l}</span>
                  </div>
                  {q[`option_${l.toLowerCase()}`] || '—'}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ textAlign: 'center', padding: 24 }}><button onClick={handleSubmit} style={btn(C.green)}>✅ Submit Test</button></div>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 20 }}>📝 Online Test</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div><label style={lbl}>Student Name *</label><input style={inp} value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Enter name" /></div>
        <div><label style={lbl}>Subject *</label><select style={sel} value={subject} onChange={e => { setSubject(e.target.value); setChapter('All Chapters') }}><option value="">Select</option>{SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Chapter</label><select style={{ ...sel, opacity: subject ? 1 : .5 }} value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject}>{chapters.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label style={lbl}>No. of Questions</label><select style={sel} value={count} onChange={e => setCount(parseInt(e.target.value))}>{[10,15,20,25,50].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
      </div>
      {subject && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', marginBottom: 14 }}>
          📊 <strong>{questions.filter(q => q.subject===subject && (chapter==='All Chapters'||q.chapter===chapter)).length}</strong> questions available · Timer: ~{Math.round(count*1.5)} minutes
        </div>
      )}
      <button onClick={handleStart} disabled={!subject || !studentName.trim()} style={btn(C.navy, !subject || !studentName.trim())}>▶ Start Test</button>
    </div>
  )
}

export default function QuestionBank({ currentUser }) {
  const [tab,       setTab]       = useState('bank')
  const [questions, setQuestions] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)

  const showToast = (msg, color = C.navy) => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('qbank_questions').select('*').order('created_at', { ascending: false })
    setQuestions(data || []); setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const TABS = [
    { key: 'bank',     icon: '📚', label: 'Question Bank' },
    { key: 'generate', icon: '🤖', label: 'AI Generator'  },
    { key: 'paper',    icon: '📄', label: 'Create Paper'  },
    { key: 'test',     icon: '📝', label: 'Online Test'   },
  ]

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui,sans-serif', background: C.bg, minHeight: '100vh' }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: C.slate, marginBottom: 4 }}>GNSI Portal</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.navy, letterSpacing: '-.02em' }}>Question Bank</div>
        <div style={{ fontSize: 13, color: C.slate, marginTop: 4 }}>AISSEE · Sainik School · Navodaya — generate, store, test, and print</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: tab===t.key ? `2px solid ${C.navy}` : `2px solid ${C.border}`, background: tab===t.key ? C.navy : '#fff', color: tab===t.key ? '#fff' : C.slate, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .12s' }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
            {t.key === 'bank' && questions.length > 0 && (
              <span style={{ padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: tab==='bank'?'rgba(255,255,255,.2)':C.navy, color: '#fff' }}>{questions.length}</span>
            )}
          </button>
        ))}
      </div>
      {tab === 'bank'     && <TabBank     questions={questions} loading={loading} refetch={refetch} showToast={showToast} />}
      {tab === 'generate' && <TabGenerate questions={questions} refetch={refetch} showToast={showToast} />}
      {tab === 'paper'    && <TabPaper    questions={questions} showToast={showToast} />}
      {tab === 'test'     && <TabTest     questions={questions} showToast={showToast} />}
    </div>
  )
}