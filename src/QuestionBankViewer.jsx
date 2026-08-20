// QuestionBankViewer.jsx — GNSI Portal
// ─────────────────────────────────────────────────────────────────────────────
// Read-only Question Bank browser, built as a "view module" on top of
// StudyMaterial.jsx's course → subject → chapter drill-down UI — same
// BASE_COURSES structure, same color tokens (C), same custom-subject/
// chapter merge pattern (mergedCourses from study_course_structure) — but
// instead of listing uploaded files, this queries qbank_questions directly
// and renders the actual questions for the selected subject+chapter.
//
// Deliberately NOT the same file as QuestionBank.jsx: that file is the
// full CRUD workspace (add/edit/delete/bulk-paste/create paper/online
// test) gated to admin + Computer Staffs. This is a lighter, read-only
// lens for browsing what's already in the bank via the course/subject/
// chapter mental model teachers already use in Study Material — no
// selection checkboxes, no edit/delete, no test builder. Column names
// (subject, chapter, subsection, question, question_mayek, option_a..d,
// option_a_mayek..d_mayek, correct_option, difficulty, marks, diagram_url)
// confirmed directly from QuestionBank.jsx's own QCard renderer rather
// than assumed, so this reads the same real schema that file writes.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import { normalizeToQBank } from './StudyMaterialBridge'

// ── Same base course/subject/chapter taxonomy as StudyMaterial.jsx and
// QuestionBank.jsx (kept in sync manually — all three files currently
// define this independently; a shared import would be the next cleanup
// if these ever drift). ──
const BASE_COURSES = {
  sainik: {
    label: 'Sainik School', short: 'AISSEE', exam: 'AISSEE · Class 6 & 9',
    color: '#16a34a', bg: '#dcfce7', border: '#86efac', text: '#15803d',
    subjects: {
      Mathematics: { icon: '📐', chapters: ['Natural Numbers','LCM and HCF','Fractions','Decimal Numbers','Ratio and Proportion','Percentage','Profit and Loss','Simple Interest','Average','Unitary Method','Area and Perimeter','Volume of Cube and Cuboids','Speed and Time','Lines and Angles','Types of Angles','Circle','Prime and Composite Numbers','Roman Numerals','Simplification','Conversion of Units','Operation on Numbers','Temperature','Plane Figures','Arranging of Fractions','Complementary and Supplementary Angles','Rounding Off Numbers','Measurement','Squares, Cubes and Roots','Data Handling','Time and Work'] },
      Intelligence: { icon: '🧠', chapters: ['Analogies','Venn Diagram','Paper Folding','Embedded Figure','Geometrical Figure Completion','Space Visualisation','Order and Ranking','Coding Decoding','Mathematical Operations','Blood Relations','Sitting Arrangement','Mirror Image','Figure Matching','Figure Series','Odd Man Out','Pattern Completion','Classification','Word Formation','Dictionary Word Order','Series Completion','Direction Test','Clock and Calendar'] },
      'English Language': { icon: '📖', chapters: ['Comprehension Passage','Preposition','Article','Vocabulary','Verbs and Type','Confusing Words','Question Tags','Types of Sentences','Tense Forms','Kinds of Nouns','Kinds of Pronouns','Correct Spelling','Ordering of Words in Sentence','Sentence Formation','Antonyms','Synonyms','Adjectives','Interjection','Idioms and Phrases','Collective Nouns','Number','Gender','Adverbs','Rhyming Words'] },
      'General Knowledge': { icon: '🌍', chapters: ['Scientific Devices','Icons and Symbols of India','Major Religions of India','Art and Culture','Defence Awareness','Sports and Games','Relationship Animals and Humans','Taste and Digestion','Cooking and Preserving','Germination and Seed Dispersal','Traditional Water Harvesting','Water Pollution','Mountain Terrain','Historical Monuments','Shape of Earth','Non-Renewable Energy','Food Culture and Habitat','Young Ones of Animals','Functions of Body Parts','International Organizations','Indian Literary Awards','Natural Calamities','Evaporation and Water Cycle','Life of Farmers','Tribal Communities'] },
      'Social Studies': { icon: '🗺️', chapters: ['Ancient India','Medieval India','Modern India','Indian Constitution','Physical Geography of India','Resources and Industries','Economic Geography','Disaster Management'] },
    },
  },
  navodaya: {
    label: 'Navodaya Vidyalaya', short: 'JNVST', exam: 'JNVST · Class 6 & 9',
    color: '#2563eb', bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8',
    // Updated to JNVST 2027 pattern (NVS Final Prospectus): Section 1 is now
    // MAT (20Q) + Environmental Studies (20Q, new subject) — see EVS entry
    // below. Language Test is comprehension-only (4 passages x 5 questions),
    // no standalone grammar items. Kept in sync with QuestionBank.jsx COURSES.navodaya.
    subjects: {
      'Mental Ability': { icon: '🧩', chapters: ['Pattern Completion','Figure Series Completion','Geometrical Figure Completion','Mirror Image','Water Image','Embedded Figures'] },
      'Environmental Studies (EVS)': { icon: '🌱', chapters: ['Transportation','Rivers and Mountains','Plants and Animals — Land and Water','Natural Disasters','Types of Houses and Shelters','Water Cycle','Food and Nutrients','Hygiene and Cleanliness','Super Senses of Animals','Digestive System','Circulatory System','Respiratory System','Food Preservation Methods','Water and Air Pollution','Conservation of Water and Soil','Environmental Protection','Superlatives of India','States and Capitals','National Symbols of India','Landscapes of India','Festivals of India','Seasons','Forests','Crops and Agriculture','Clothes and Fibres'] },
      Arithmetic: { icon: '🔢', chapters: ['Number System — Place Value and Face Value','Ascending and Descending Order','Four Fundamental Operations','Factors and Multiples','LCM and HCF','Prime Factorization','Fractions — Addition and Subtraction of Like Fractions','Multiplication of Fractions','Measurement — Length, Mass, Capacity, Time, Money','Conversion of Units','Simplification (BODMAS)','Perimeter of Polygon','Area of Square, Rectangle and Triangle','Types of Angles','Directions and Basic Mapping','Data Handling — Bar Diagrams, Tables and Pictographs','Averages'] },
      'English Language': { icon: '📗', chapters: ['Reading Comprehension — Direct Questions','Synonyms in Context','Antonyms in Context','Inference from Passage','Cause and Effect in Passage'] },
      'Hindi Language': { icon: '📕', chapters: ['Gadhyansh Bodh','Paryayvachi Shabd','Vilom Shabd','Bhavarth aur Nishkarsh','Karan aur Prabhav'] },
    },
  },
  foundation: {
    label: 'Foundation Course', short: 'Class 5–8', exam: 'Board + Competitive base',
    color: '#d97706', bg: '#fef9c3', border: '#fde68a', text: '#b45309',
    subjects: {
      Mathematics: { icon: '📐', chapters: ['Number Systems','Factors and Multiples','Fractions and Decimals','Integers','Algebra — Expressions and Equations','Ratio and Proportion','Percentage and Its Applications','Profit, Loss and Discount','Simple and Compound Interest','Lines, Angles and Triangles','Quadrilaterals and Polygons','Area and Perimeter','Surface Area and Volume','Statistics and Data Handling','Exponents and Powers','Symmetry and Transformations','Coordinate Geometry Basics','Mensuration','Speed, Time, Distance','Probability Basics'] },
      Science: { icon: '🔬', chapters: ['Food and Nutrition','Materials and Their Properties','The Living World — Plants','The Living World — Animals','Force, Motion and Energy','Light and Sound','Heat and Temperature','Electricity and Magnetism','Acids, Bases and Salts','Chemical Reactions Basics','Cell — The Unit of Life','Reproduction in Plants and Animals','Human Body Systems','Soil and Water','Air and Atmosphere','Environment and Ecology','Natural Resources','Disaster Management'] },
      English: { icon: '📘', chapters: ['Parts of Speech','Tenses','Voice — Active and Passive','Narration — Direct and Indirect','Articles and Prepositions','Subject-Verb Agreement','Comprehension Passages','Letter Writing','Essay Writing','Vocabulary Development','Synonyms, Antonyms and Homophones','Idioms and Phrases','One-word Substitution','Punctuation','Sentence Transformation'] },
      'Social Science': { icon: '🗺️', chapters: ['Ancient Civilisations','Medieval India','Mughal Empire','British Rule and Freedom Struggle','Post-Independence India','Physical Features of India','Climate of India','Natural Vegetation and Wildlife','Population and Urbanisation','Resources — Land, Water, Minerals','Agriculture and Industries','Indian Constitution','Panchayati Raj','Democracy and Elections','Economic Concepts','Globalisation'] },
      Hindi: { icon: '📙', chapters: ['Gadhya Bodh','Padhya Bodh','Vyakaran — Sangya, Sarvanam','Visheshan and Kriya','Kal aur Vachya','Sandhi aur Samas','Muhavare aur Lokokti','Patra Lekhan','Nibandh Lekhan','Anuchhed Lekhan'] },
    },
  },
}

const C = {
  navy: '#1e3a5f', slate: '#64748b', border: '#e2e8f0',
  white: '#ffffff', bg: '#f8fafc', green: '#16a34a',
  rose: '#dc2626', amber: '#d97706', indigo: '#4f46e5',
}
const iS = { width: '100%', padding: '8px 11px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, background: C.white, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const cardS = { background: C.white, borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: '18px 20px', marginBottom: 14 }
const btnSm = (bg, color = '#fff') => ({ padding: '4px 10px', borderRadius: 6, background: bg, color, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' })

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return mobile
}

function Badge({ text, color, bg, border }) {
  return (
    <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      color, background: bg, border: `1px solid ${border || bg}`, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

// Read-only question card — same visual language as QuestionBank.jsx's
// QCard (badges, options grid, reveal-answer toggle) but with no
// selection checkbox and no edit/delete actions, since this view has no
// write access to qbank_questions at all.
function ViewOnlyQCard({ q, index, subjectColor }) {
  const [reveal, setReveal] = useState(false)
  return (
    <div style={{ ...cardS, marginBottom: 8, padding: '12px 16px' }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.slate, fontWeight: 700 }}>Q{index + 1}</span>
        {q.subsection && <Badge text={q.subsection} color="#0369a1" bg="#e0f2fe" />}
        <Badge text={q.difficulty || 'Medium'}
          color={q.difficulty === 'Easy' ? C.green : q.difficulty === 'Hard' ? C.rose : C.amber}
          bg={q.difficulty === 'Easy' ? '#dcfce7' : q.difficulty === 'Hard' ? '#fee2e2' : '#fef9c3'} />
        <Badge text={`${q.marks || 1}M`} color={C.indigo} bg="#eff6ff" />
        {q.diagram_url && <Badge text="🖼 Diagram" color="#065f46" bg="#d1fae5" />}
      </div>
      <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 500, lineHeight: 1.6, marginBottom: q.question_mayek ? 4 : 8 }}>
        {q.question}
      </div>
      {q.question_mayek && (
        <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 8, fontFamily: "'Noto Sans Meetei Mayek', sans-serif" }}>
          {q.question_mayek}
        </div>
      )}
      {q.diagram_url && (
        <img src={q.diagram_url} alt="Question diagram"
          style={{ maxWidth: 280, maxHeight: 180, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8, display: 'block' }} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
        {['A', 'B', 'C', 'D'].map(l => (
          <div key={l} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12,
            background: reveal && q.correct_option === l ? '#dcfce7' : '#f8fafc',
            border: `1px solid ${reveal && q.correct_option === l ? '#86efac' : C.border}`,
            color: reveal && q.correct_option === l ? '#15803d' : '#374151',
            fontWeight: reveal && q.correct_option === l ? 700 : 400 }}>
            <span style={{ fontWeight: 700, marginRight: 5, color: C.slate }}>{l}.</span>
            {q[`option_${l.toLowerCase()}`] || '—'}
            {reveal && q.correct_option === l && ' ✓'}
            {q[`option_${l.toLowerCase()}_mayek`] && (
              <div style={{ fontFamily: "'Noto Sans Meetei Mayek', sans-serif", fontWeight: 400, marginTop: 2 }}>
                {q[`option_${l.toLowerCase()}_mayek`]}
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => setReveal(r => !r)} style={btnSm(reveal ? C.slate : subjectColor)}>
        {reveal ? '🙈 Hide Answer' : '👁 Show Answer'}
      </button>
    </div>
  )
}

// Chapter picker row — mirrors StudyMaterial's SubjectPanel chapter list
// visually, but each row shows a live question count for that chapter
// (from the same qbankData already fetched for the whole subject) and
// selecting one loads that chapter's questions below.
function ChapterList({ chapters, activeChapter, onSelect, countsByChapter }) {
  if (chapters.length === 0) {
    return <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>No chapters defined for this subject.</div>
  }
  return (
    <div style={{ ...cardS, padding: 10 }}>
      {chapters.map(ch => {
        const count = countsByChapter?.[ch] || 0
        const active = ch === activeChapter
        return (
          <div key={ch} onClick={() => onSelect(ch)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
              background: active ? '#eff6ff' : 'transparent',
              border: `1px solid ${active ? '#bfdbfe' : 'transparent'}`,
              marginBottom: 3,
            }}>
            <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.indigo : '#374151' }}>{ch}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              color: count > 0 ? '#4338ca' : '#94a3b8', background: count > 0 ? '#eef2ff' : '#f1f5f9',
            }}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function QuestionBankViewer({ currentUser, onNavigate }) {
  const [activeCourse, setActiveCourse] = useState('sainik')
  const [activeSubject, setActiveSubject] = useState(null)
  const [activeChapter, setActiveChapter] = useState(null)
  const [subjectQuestions, setSubjectQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const isMobile = useIsMobile()

  const courseData = BASE_COURSES[activeCourse]
  const subjectList = Object.keys(courseData.subjects)

  useEffect(() => {
    if (!subjectList.includes(activeSubject)) {
      setActiveSubject(subjectList[0] || null)
      setActiveChapter(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourse])

  // Fetches every question for the ACTIVE SUBJECT (not chapter) in one
  // query, so chapter switching within the same subject is instant and
  // the chapter-list counts (ChapterList's countsByChapter) come from
  // data already in hand rather than a second round-trip per click.
  //
  // normalizeToQBank(subject) before querying: this viewer uses
  // StudyMaterial's rich subject names (English Language, Hindi Language,
  // Arithmetic, Mental Ability, Science, Social Science, etc.) for its
  // course/subject picker, but qbank_questions itself is keyed by
  // QuestionBank.jsx's flat canonical buckets (Mathematics, Intelligence,
  // Language, General Knowledge) — see StudyMaterialBridge.js's own
  // header comment for why these are deliberately different vocabularies.
  // Querying with the raw StudyMaterial subject name would silently
  // return zero rows for every subject except the two whose names
  // happen to already match (Mathematics, Intelligence).
  const loadSubjectQuestions = useCallback(async subject => {
    if (!subject) { setSubjectQuestions([]); return }
    setLoading(true)
    const qbankSubject = normalizeToQBank(subject)
    const { data, error } = await supabase
      .from('qbank_questions')
      .select('id, subject, chapter, subsection, question, question_mayek, option_a, option_a_mayek, option_b, option_b_mayek, option_c, option_c_mayek, option_d, option_d_mayek, correct_option, difficulty, marks, diagram_url, created_at')
      .eq('subject', qbankSubject)
      .order('created_at', { ascending: false })
    if (error) { console.error('QuestionBankViewer: load failed —', error.message); setSubjectQuestions([]) }
    else setSubjectQuestions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadSubjectQuestions(activeSubject) }, [activeSubject, loadSubjectQuestions])

  const knownChapters = courseData.subjects[activeSubject]?.chapters || []

  const countsByChapter = useMemo(() => {
    const map = {}
    subjectQuestions.forEach(q => {
      // Questions with no chapter tagged at all are real rows too — bucket
      // them under "Uncategorized" instead of dropping them, so the
      // chapter list's total always equals subjectQuestions.length.
      const key = q.chapter || 'Uncategorized'
      map[key] = (map[key] || 0) + 1
    })
    return map
  }, [subjectQuestions])

  // Full chapter list = this course's known/curated chapters (in their
  // defined order) PLUS any chapter name that actually exists in the
  // fetched data but isn't in that list. Necessary because the "Language"
  // QBank bucket pools questions tagged under every course's own chapter
  // names (Sainik's, Navodaya's, Foundation's — see StudyMaterialBridge's
  // many-to-one SUBJECT_TO_QBANK map), so a chapter list built only from
  // the CURRENT course's own curated list would silently hide whichever
  // fraction of the 10,220 questions were tagged under a different
  // course's chapter names. Extra chapters are appended after the known
  // ones, sorted by count descending, so the visible total always equals
  // subjectQuestions.length exactly.
  const chapters = useMemo(() => {
    const extra = Object.keys(countsByChapter)
      .filter(ch => !knownChapters.includes(ch))
      .sort((a, b) => (countsByChapter[b] || 0) - (countsByChapter[a] || 0))
    return [...knownChapters, ...extra]
  }, [knownChapters, countsByChapter])

  // Auto-select the first chapter that actually has questions when the
  // subject changes and nothing's picked yet — otherwise a subject whose
  // chapters are all in a different order than the questions land on an
  // empty first chapter for no reason.
  useEffect(() => {
    if (activeChapter && chapters.includes(activeChapter)) return
    const firstWithQuestions = chapters.find(ch => countsByChapter[ch] > 0)
    setActiveChapter(firstWithQuestions || chapters[0] || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubject, chapters, countsByChapter])

  const chapterQuestions = useMemo(() => {
    // "Uncategorized" is a synthetic bucket (see countsByChapter) for rows
    // where q.chapter is null/empty — match those, not the literal string.
    let list = activeChapter === 'Uncategorized'
      ? subjectQuestions.filter(q => !q.chapter)
      : subjectQuestions.filter(q => q.chapter === activeChapter)
    if (difficultyFilter !== 'All') list = list.filter(q => q.difficulty === difficultyFilter)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter(q => (q.question || '').toLowerCase().includes(s) || (q.subsection || '').toLowerCase().includes(s))
    }
    return list
  }, [subjectQuestions, activeChapter, difficultyFilter, search])

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Course tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {Object.entries(BASE_COURSES).map(([key, c]) => (
          <button key={key} onClick={() => setActiveCourse(key)}
            style={{
              padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${activeCourse === key ? c.color : C.border}`,
              background: activeCourse === key ? c.bg : C.white, color: activeCourse === key ? c.text : C.slate,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
            {c.label} <span style={{ opacity: .7, fontWeight: 500 }}>· {c.short}</span>
          </button>
        ))}
      </div>

      {/* Subject tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {subjectList.map(s => {
          const sd = courseData.subjects[s]
          const active = s === activeSubject
          return (
            <button key={s} onClick={() => { setActiveSubject(s); setActiveChapter(null) }}
              style={{
                padding: '7px 13px', borderRadius: 8, border: `1px solid ${active ? courseData.color : C.border}`,
                background: active ? courseData.bg : C.white, color: active ? courseData.text : '#374151',
                fontWeight: active ? 700 : 500, fontSize: 12.5, cursor: 'pointer',
              }}>
              {sd.icon} {s}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Chapters {loading ? '· loading…' : `· ${subjectQuestions.length} total`}
          </div>
          <ChapterList chapters={chapters} activeChapter={activeChapter} onSelect={setActiveChapter} countsByChapter={countsByChapter} />
        </div>

        <div>
          <div style={{ ...cardS, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...iS, flex: 1, minWidth: 180 }} placeholder="Search this chapter's questions…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ ...iS, width: 'auto' }} value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}>
              <option value="All">All difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {!activeChapter ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>Select a chapter to view its questions.</div>
          ) : loading ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>Loading…</div>
          ) : chapterQuestions.length === 0 ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>
              {search.trim() || difficultyFilter !== 'All' ? 'No questions match this filter.' : 'No questions in the bank for this chapter yet.'}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.slate, marginBottom: 8, fontWeight: 600 }}>
                {chapterQuestions.length} question{chapterQuestions.length !== 1 ? 's' : ''} — {activeSubject} › {activeChapter}
              </div>
              {chapterQuestions.map((q, i) => (
                <ViewOnlyQCard key={q.id} q={q} index={i} subjectColor={courseData.color} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}