// QuestionBank.jsx — GNSI Portal
// Built per full discussion:
// Structure: Subject → Chapter → Subsection → Questions
// 6 Tabs: Bank, Manual Add, Bulk Paste, Create Paper, Online Test, Stats
// No AI — fully free, zero API cost
//
// ── INTERCONNECT PATCHES APPLIED ─────────────────────────────────────────────
// 1. Import: useStudyMaterialsByChapter, normalizeToQBank from StudyMaterialBridge
// 2. Import: EventBus, GNSI_EVENTS from EventBus
// 3. Export signature: { currentUser, perms, onNavigate, initialFilter }
// 4. TabBank: applies initialFilter on mount, listens for NAVIGATE_TO event
// 5. TabManualAdd / TabBulkPaste: StudyMaterialsRefPanel + emit QUESTION_SAVED
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import { useStudyMaterialsByChapter, useMaterialCountsByChapter, normalizeToQBank, openChapterIn, useChapterFocus } from './StudyMaterialBridge'
import { EventBus, GNSI_EVENTS } from './EventBus'
import { isAdminRole } from './roles'
// Course → subject → chapter taxonomy (shared with QuestionBankViewer.jsx).
import { COURSES, COURSE_LIST } from './qbankTaxonomy'
import { T, heroStyle, optionStyle } from './qbankTheme'
import { HeroStat, QBThemeStyles, OptionLetter } from './QBTheme'

// ── BMEI04 font (base64, embedded once per file load) — needed because
// browsers can't render this legacy encoding without the font that maps
// its custom glyph codepoints to actual Meetei Mayek shapes. See
// bmei04_font_base64.js's own header for why this is embedded rather than
// loaded from an external file/CDN. Injected via a <style> tag the first
// time any component in this file mounts (see BmeiFontFace below) —
// declaring @font-face more than once is harmless in CSS, so no
// singleton guard is needed the way the jsPDF font registration below
// required.
import { BMEI04_BASE64 } from './bmei04_font_base64'
import {
  PAPER_OPTIONS_DEFAULT, marksOf, groupSections, sectionLetter, blueprint, blueprint as paperBlueprint, isComplete as isCompleteQ, pickPaper, swapCandidate, sortPaper, buildSets,
  normalizeAnswer, tidyText, loadTemplates, saveTemplates, loadPaperHistory, pushPaperHistory, recentlyUsedIds, answerKeyText, paperText, paperWordHtml,
} from './paperTools'

// BMEI04 keystroke <-> Unicode Meetei Mayek conversion table, verified
// against real GNSI documents (see Eeyek converter tool / QuestionBank
// Additions README for how each key was confirmed). Used by the Mayek
// Tool tab below — separate from the auto-detect-on-paste system above,
// which stores raw BMEI04 text as-is and renders it with the embedded
// BMEI04 font rather than converting it.
import { romanToMeetei, meeteiToRoman, getAllCharacters } from './meetei_mayek'
import { bmeiToUnicode } from './mayekSegments'
import { LANGS, langLabel, ENGINE_LABELS, offlineEnabled, setOfflineEnabled, offlineRunning, translate as aiTranslate, correctionPairs, saveCorrections, aiDraftEntries, approveEntries, AI_DRAFT_SOURCE, OFFLINE_DRAFT_SOURCE, reviewedSource, offlineToMayek, QB_SOURCE, REVIEWABLE_SOURCES, scanSentences, addSentences } from './mayekTranslate'
import MayekText from './MayekText'
import {
  translateText, saveDictionaryEntry, deleteDictionaryEntry, bulkImportEntries, searchDictionary,
  seedWordlist, getUnfilledEntries, getNeedsReviewEntries, findCoverageGaps,
  getPhraseTemplateStatus,
} from './mayekDictionary'

function BmeiFontFace() {
  return (
    <style>{`
      @font-face {
        font-family: 'BMEI04';
        src: url(data:font/ttf;base64,${BMEI04_BASE64}) format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    `}</style>
  )
}

// Resolves which font-family a question_mayek string should render with.
// Existing rows (and any new Unicode Meetei Mayek text) have no
// question_mayek_font value or 'unicode' — those keep using Noto Sans
// Meetei Mayek, unchanged from before this feature existed. Rows tagged
// 'bmei04' (set by parseQuestions() when the transliteration detector
// fires on a Bulk Paste — see isLikelyMayekTransliteration) use the BMEI04
// font instead, since that's a different glyph encoding, not real Unicode
// Meetei Mayek, and rendering it with the Noto font would show garbled
// Latin-looking characters instead of Meetei script.
function mayekFontFamily(fontTag) {
  return fontTag === 'bmei04' ? "'BMEI04', sans-serif" : "'Noto Sans Meetei Mayek', sans-serif"
}


// Backward-compat aliases: SUBJECTS/SUBJECT_LIST used to be the flat,
// course-less structure every tab in this file read from directly. They
// now point at Sainik's subject list specifically — Sainik is the course
// whose data is identical to what SUBJECTS held before this course
// dimension existed, so anything still reading these two names keeps
// working exactly as before for Sainik data, while newly course-aware
// code should read from COURSES[course].subjects instead. Existing
// questions in the database have no `course` value set (this migration
// intentionally does not backfill one — see the discussion this was
// built from), so they won't be excluded from any course-scoped view
// that also matches on course, but they ALSO won't automatically show up
// as "Sainik" data just because these aliases point there; course
// filtering in the UI checks the actual `course` column on each row.
const SUBJECTS = COURSES.sainik.subjects
const SUBJECT_LIST = Object.keys(SUBJECTS)
const DIFFICULTIES  = ['Easy', 'Medium', 'Hard']
const MARKS_OPTIONS = [1, 2, 3, 4, 5]
const DIAGRAM_BUCKET = 'question-diagrams'

// ── AUTO SUBSECTION KEYWORD MAP ───────────────────────────────────────────────
const SUBSECTION_KEYWORDS = {
  Mathematics: {
    'Roman Numerals':         ['roman numeral','roman number','arabic numeral','xcix','xliv','cdxlix'],
    'Place Value & Face Value':['place value','face value','ten thousand','hundred place','thousand place'],
    'Types of Numbers':       ['prime','composite','twin prime','co-prime','coprime','even number','odd number','natural number','whole number','integer'],
    'Digits of Numbers':      ['largest number','smallest number','greatest number','digit','formed by','rearrang','descending order','ascending order'],
    'Comparison of Numbers':  ['compare','ascending','descending','arrange','largest','smallest','greater than','less than'],
    'Approximate Value':      ['round','nearest hundred','nearest thousand','nearest ten','estimate','approximate'],
    'Predecessor & Successor':['predecessor','successor','before','after','million'],
    'Divisibility':           ['divisib','divisible by','multiple of','factor','remainder'],
    'LCM & HCF':              ['lcm','hcf','least common','highest common','common factor','common multiple'],
    'Fractions':              ['fraction','numerator','denominator','proper fraction','improper fraction','mixed','equivalent fraction','like fraction','unlike fraction','simplest form','vulgar'],
    'Decimals':               ['decimal','0.','tenth','hundredth','thousandth'],
    'Percentage':             ['percent','%','per cent'],
    'Profit & Loss':          ['profit','loss','cost price','selling price','cp','sp'],
    'Simple Interest':        ['interest','principal','rate','time','si'],
    'Average':                ['average','mean','sum of'],
    'Ratio & Proportion':     ['ratio','proportion','direct','inverse'],
    'Speed & Distance':       ['speed','distance','time','km/h','m/s'],
    'Area & Perimeter':       ['area','perimeter','length','breadth','rectangle','square','triangle'],
    'Volume':                 ['volume','cube','cuboid','capacity'],
    'Lines & Angles':         ['angle','line','parallel','perpendicular','transversal'],
    'Circle':                 ['circle','radius','diameter','circumference','chord'],
    'Simplification':         ['simplif','bodmas','bracket','order of operation'],
    'Word Problems':          ['bought','sold','total','remaining','left','how many','how much','find the'],
    'Shaded Portion':         ['shaded','shading','portion','figure','diagram','represent'],
  },
  Intelligence: {
    'Coding and Decoding':     ['code','coding','decoding','cipher','encoded','written as'],
    'Alphabet Test':          ['alphabet','dictionary order','word formation','meaningful word','prefix'],
    'Logical Order of Words':  ['logical order','meaningful order','sequence of words','chronological'],
    'Missing Characters':      ['missing character','missing number','insert the missing','grid','matrix number'],
    'Symbols and Notations':   ['symbols','notations','replace symbol','interchange','bodmas'],
    'Series':                  ['series','next term','missing term','wrong term','number series','letter series'],
    'Analogy':                 ['analogy','analogies','is to','relates','related pair'],
    'Classification':          ['odd one out','classify','different from','does not belong'],
    'Direction and Distance':  ['direction','distance','north','south','east','west','left turn','right turn','km away'],
    'Blood Relations':         ['blood relation','father','mother','son','daughter','brother','sister','uncle','aunt','grandfather'],
    'Order and Ranking':       ['rank','ranking','position','tallest','shortest','heavier','top','bottom','extreme end'],
    'Sitting Arrangement':     ['sitting arrangement','seated','row','circle','facing north','facing center'],
    'Grouping and Selection':  ['team selection','boat ride','grouping','committee','conditions'],
    'Logical Venn Diagram':    ['venn','diagram','circle','overlapping','represented by'],
    'Assertion and Reason':    ['assertion','reason','claim','statement A','reason R'],
    'Cube and Dice':           ['cube','dice','opposite face','painted face','folded net'],
    'Embedded Figure':         ['embedded','hidden figure','contains the question figure'],
    'Figure Analogy':          ['figure analogy','similar relation','answer figure'],
    'Figure Classification':   ['figure classification','odd figure','different figure'],
    'Figure Counting':         ['count triangles','count squares','count rectangles','how many triangles','how many squares'],
    'Figure Matching':         ['figure matching','identical figure','exact same'],
    'Figure Matrix':           ['figure matrix','3x3 grid','complete the matrix'],
    'Figure Series':           ['figure series','next missing figure','sequence of figures'],
    'Joining of Figures':      ['joining of figures','geometrical figure','assemble pieces','cut pieces'],
    'Mirror and Water Images': ['mirror image','water image','reflection','reflected'],
    'Paper Cutting':           ['paper cutting','folded and cut','unfolded form','punch hole'],
    'Paper Folding':           ['paper folding','transparent sheet','dotted line'],
    'Pattern Completion':      ['pattern completion','complete the pattern','missing quadrant'],
    'Statement and Conclusions':['statement','conclusion','logically follows','deduction'],
    'Clock and Calendar':      ['clock','time','calendar','day of the week','leap year','date'],
  },
  Language: {
    'Comprehension':          ['passage','comprehension','read','author','paragraph'],
    'Preposition':            ['preposition','in','on','at','by','with','from','to','into'],
    'Articles':               ['article','a ','an ','the '],
    'Tense Forms':            ['tense','past','present','future','has','have','had','was','were'],
    'Kinds of Nouns':         ['noun','proper','common','collective','abstract','material'],
    'Kinds of Pronouns':      ['pronoun','he','she','they','it','who','which'],
    'Verbs':                  ['verb','action','transitive','intransitive','auxiliary'],
    'Adjectives':             ['adjective','describe','quality','comparative','superlative'],
    'Adverbs':                ['adverb','manner','time','place','frequency'],
    'Synonyms':               ['synonym','similar meaning','same meaning'],
    'Antonyms':               ['antonym','opposite','contrary'],
    'Correct Spelling':       ['spelling','spell','correct form','incorrect'],
    'Idioms & Phrases':       ['idiom','phrase','expression','meaning of'],
    'Types of Sentences':     ['sentence','declarative','interrogative','exclamatory','imperative'],
    'Singular & Plural':      ['singular','plural','one','many'],
    'Number & Gender':        ['gender','masculine','feminine','neuter','common'],
    'Conjunction':            ['conjunction','although','because','unless','whether','so that'],
  },
  'General Knowledge': {
    'Defence Awareness':      ['defence','army','navy','air force','military','sainik','soldier','weapon','rank'],
    'Sports & Games':         ['sport','game','cricket','football','hockey','olympics','trophy','tournament','player'],
    'Historical Monuments':   ['monument','fort','temple','heritage','ancient','built','architecture'],
    'International Organizations':['united nations','un ','who','unesco','unicef','nato','organization'],
    'Natural Calamities':     ['earthquake','flood','cyclone','tsunami','drought','disaster','calamity'],
    'Art & Culture':          ['culture','dance','music','festival','tradition','classical','folk'],
    'Science & Devices':      ['device','instrument','science','technology','invention','discovered'],
    'Indian Symbols':         ['symbol','emblem','flag','national','official','logo'],
    'Religions':              ['religion','hindu','muslim','christian','sikh','buddhist','jain'],
    'Awards & Honours':       ['award','prize','honour','medal','trophy','winner','recipient'],
    'Environment':            ['pollution','environment','eco','water','air','soil','conservation'],
    'Energy':                 ['energy','renewable','solar','wind','nuclear','fossil','fuel'],
    'Animals':                ['animal','young one','offspring','mammal','bird','reptile'],
    'Human Body':             ['body','organ','function','blood','heart','brain','lung','digestion'],
    'Geography':              ['mountain','river','state','capital','country','continent','ocean'],
  },
}

// ── DIAGRAM DETECTION KEYWORDS ────────────────────────────────────────────────
const DIAGRAM_KEYWORDS = [
  'shaded portion','shaded part','shading','figure shows','figure below',
  'diagram','following figure','from the figure','look at the figure',
  'shape shown','represented in','given figure','observe the figure',
]

// ── COLORS ───────────────────────────────────────────────────────────────────
// Palette comes from the shared Question Bank theme (qbankTheme.jsx) so the
// workspace and the read-only viewer look like one product.
const C = {
  navy: T.navy, green: '#16a34a', rose: T.rose,
  amber: '#d97706', violet: T.violet, slate: T.muted,
  indigo: T.indigo, teal: T.teal, bg: T.canvas,
  border: T.border, white: T.surface,
}
const SC = {
  Mathematics:         { color: '#1e3a5f', bg: '#eff6ff', border: '#bfdbfe' },
  Intelligence:        { color: '#7c3aed', bg: '#f3e8ff', border: '#ddd6fe' },
  Language:            { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'General Knowledge': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  // Course-specific subjects introduced by the Navodaya/Foundation/RMS
  // course structure — Sainik's four canonical subjects above still take
  // priority since they're the original QBank taxonomy; these extend
  // coverage so subjects unique to the other three courses get their own
  // distinct color instead of all falling back to Mathematics's navy.
  'Mental Ability':     { color: '#7c3aed', bg: '#f3e8ff', border: '#ddd6fe' },
  Arithmetic:           { color: '#1e3a5f', bg: '#eff6ff', border: '#bfdbfe' },
  'English Language':   { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'Hindi Language':     { color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
  Science:              { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  English:              { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'Social Science':     { color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  Hindi:                { color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
}

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
// Hover/focus states, select chevrons and responsive collapse for these
// come from QB_CSS (qbankTheme.jsx), scoped to the .qbx root.
const iS = {
  width:'100%', padding:'9px 12px', borderRadius:T.radiusSm,
  border:`1px solid ${T.border}`, fontSize:13.5, lineHeight:1.35,
  background:T.surface, boxSizing:'border-box', fontFamily:'inherit', outline:'none',
  boxShadow:'0 1px 1px rgba(16,24,40,.03)',
}
const lS = { display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, color:T.muted, marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }
const cardS = { background:T.surface, borderRadius:T.radius, border:`1px solid ${T.border}`, boxShadow:T.shadow, padding:'20px 22px', marginBottom:16 }
const btn = (bg, dis=false) => ({
  display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
  padding:'9px 16px', borderRadius:T.radiusSm, background: dis ? '#cbd5e1' : bg,
  color:'#fff', border:'none', fontSize:13, fontWeight:600, letterSpacing:'.005em',
  cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .85 : 1,
  boxShadow: dis ? 'none' : '0 1px 2px rgba(16,24,40,.12), inset 0 1px 0 rgba(255,255,255,.08)',
  whiteSpace:'nowrap',
})
const btnSm = (bg, color='#fff') => ({
  display:'inline-flex', alignItems:'center', gap:4,
  padding:'5px 11px', borderRadius:7, background:bg,
  color, border: color === '#fff' ? 'none' : `1px solid ${T.border}`,
  fontSize:11.5, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
})

// ── HELPERS ───────────────────────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })

// Fisher–Yates shuffle (returns a new array). `arr.sort(() => Math.random()-.5)`
// is NOT a uniform shuffle — some orderings come up far more often than
// others — which skews which questions land in papers and tests.
function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// jsPDF's built-in Helvetica only covers WinAnsi (Latin-1 + a few extras).
// Characters outside it (√, π, ≤, ₹, …) come out as garbage in the PDF,
// so common math/currency symbols are spelled out and anything else
// outside the set is replaced with '?' instead of silently corrupting.
const PDF_SYMBOL_MAP = {
  '√':'sqrt', '∛':'cbrt', 'π':'pi', '≤':'<=', '≥':'>=', '≠':'!=', '≈':'~=',
  '₹':'Rs.', '∠':'angle ', '△':'triangle ', '∆':'triangle ', 'Δ':'Delta', '∞':'infinity',
  '−':'-', '–':'-', '—':'-', '‘':"'", '’':"'", '“':'"', '”':'"', '…':'...',
  '⁴':'^4', '⁵':'^5', '⁶':'^6', '⁷':'^7', '⁸':'^8', '⁹':'^9', '⁰':'^0', 'ⁿ':'^n',
  '₀':'0', '₁':'1', '₂':'2', '₃':'3', '₄':'4', '₅':'5', '₆':'6', '₇':'7', '₈':'8', '₉':'9',
  '⅓':'1/3', '⅔':'2/3', '⅛':'1/8', '⅜':'3/8', '⅝':'5/8', '⅞':'7/8', '⅕':'1/5',
  'θ':'theta', 'α':'alpha', 'β':'beta', '∴':'therefore', '∵':'because', '∶':':', '→':'->',
}
// Chars jsPDF's WinAnsi encoding can render beyond plain ASCII/Latin-1.
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
function pdfSafe(text) {
  let out = ''
  for (const ch of String(text ?? '')) {
    const code = ch.codePointAt(0)
    if (code < 0x100 || WINANSI_EXTRA.has(ch)) out += ch
    else if (PDF_SYMBOL_MAP[ch] !== undefined) out += PDF_SYMBOL_MAP[ch]
    else out += '?'
  }
  return out
}

// ── DIAGRAM UPLOAD VALIDATION ────────────────────────────────────────────────
// `accept="image/*"` is only a hint to the file picker. Validate type and
// size before upload, and derive the extension from the MIME type rather
// than the user-supplied filename. SVG is deliberately excluded: it can
// carry script and is served from a public URL.
const DIAGRAM_MIME_EXT = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif' }
const DIAGRAM_MAX_BYTES = 5 * 1024 * 1024

// Returns the storage object path for a public URL in DIAGRAM_BUCKET, or
// null if the URL isn't one of ours (never try to delete a foreign file).
function diagramPathFromUrl(url) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${DIAGRAM_BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0])
}

// Best-effort cleanup so replaced/deleted diagrams don't pile up in storage.
async function removeDiagrams(urls) {
  const paths = urls.map(diagramPathFromUrl).filter(Boolean)
  if (!paths.length) return
  const { error } = await supabase.storage.from(DIAGRAM_BUCKET).remove(paths)
  if (error) console.warn('Diagram cleanup failed:', error.message)
}

// ── CSV PARSING ──────────────────────────────────────────────────────────────
// Quote-aware CSV → array of rows (array of trimmed cells). Unlike splitting
// on newlines first, this keeps line breaks and commas that sit inside a
// quoted cell as part of that cell.
function parseCSV(text) {
  const rows = []
  let row = [], cur = '', inQuotes = false
  const src = String(text || '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"' && src[i+1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i+1] === '\n') i++
      row.push(cur); cur = ''
      rows.push(row); row = []
    } else cur += ch
  }
  row.push(cur)
  rows.push(row)
  return rows
    .map(r => r.map(c => c.trim()))
    .filter(r => r.some(c => c !== ''))
}

function Badge({ text, color, bg, border }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:99,
      fontSize:10.5, fontWeight:600, letterSpacing:'.01em', lineHeight:1.4,
      color, background:bg, border:`1px solid ${border||bg}`, whiteSpace:'nowrap' }}>
      {text}
    </span>
  )
}

// Icon + tone chosen from the toast's color, so every existing
// showToast(msg, color) call gets a matching icon without changes.
const TOAST_ICON = { [T.rose]: '!', '#d97706': '!', '#16a34a': '✓' }
function Toast({ msg, color }) {
  return (
    <div role="status" aria-live="polite" style={{ position:'fixed', top:20, right:20, zIndex:99999,
      display:'flex', alignItems:'flex-start', gap:10,
      background:'#fff', border:`1px solid ${T.border}`, borderRadius:12,
      padding:'12px 16px 12px 12px', fontSize:13, fontWeight:500, color:T.text, lineHeight:1.45,
      boxShadow:T.shadowLg, maxWidth:380, animation:'qbToastIn .22s ease both' }}>
      <span style={{ flexShrink:0, width:22, height:22, borderRadius:'50%', background:color, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800 }}>
        {TOAST_ICON[color] || 'i'}
      </span>
      <span style={{ paddingTop:1 }}>{msg}</span>
    </div>
  )
}

// ── SMART PPT / SLIDE CAST ENGINE ───────────────────────────────────────────
// Builds an in-app slide deck from a chapter's questions, presents it full
// screen locally, and offers two real casting paths:
//   1. LOCAL DUAL-SCREEN — BroadcastChannel. Only works between two tabs on
//      the SAME machine/browser profile (e.g. a second tab dragged to a
//      projector-connected monitor). Cannot reach a separate wireless TV.
//   2. WIRELESS CAST — Presentation API + a real /cast-receiver route. The
//      receiver is a genuinely separate device; it fetches its own slide
//      content from Supabase and polls a `qbank_cast_sessions` row for the
//      live slide index, which this hook writes on every navigation.
// Both are offered together since they solve different physical setups.
const CAST_CHANNEL_NAME = 'gnsi-cast-v1'

function buildQuestionSlides(questions) {
  return questions.map(q => ({
    kind: 'question',
    id: q.id,
    title: q.question,
    title_mayek: q.question_mayek || '',
    // Carried through from the source question row so SlideViewer (and any
    // other consumer of this slide shape) can pick the right font via
    // mayekFontFamily — without this, BMEI04-transliterated text always
    // fell back to the Noto Sans Meetei Mayek font, which shows the raw
    // Latin transliteration instead of Meetei Mayek script.
    title_mayek_font: q.question_mayek_font || '',
    options: ['A','B','C','D'].map(l => ({ letter: l, text: q[`option_${l.toLowerCase()}`] || '' })),
    correct_option: q.correct_option,
    diagram_url: q.diagram_url || '',
  }))
}

function useSlideCast({ subject, chapter, source = 'qbank' }) {
  const [localCasting, setLocalCasting] = useState(false)
  const [wirelessCasting, setWirelessCasting] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const channelRef = useRef(null)
  const connectionRef = useRef(null)
  const wirelessAvailable = typeof window !== 'undefined' && 'PresentationRequest' in window
  const localAvailable = typeof window !== 'undefined' && 'BroadcastChannel' in window

  useEffect(() => {
    if (localAvailable) channelRef.current = new BroadcastChannel(CAST_CHANNEL_NAME)
    return () => channelRef.current?.close()
  }, [localAvailable])

  const postLocal = useCallback((index, showAnswers) => {
    channelRef.current?.postMessage({ subject, chapter, source, index, showAnswers, ts: Date.now() })
  }, [subject, chapter, source])

  const postWireless = useCallback(async (index) => {
    if (!sessionId) return
    await supabase.from('qbank_cast_sessions').update({ slide_index: index }).eq('id', sessionId)
  }, [sessionId])

  const startLocalCast = useCallback((showToast) => {
    if (!localAvailable) { showToast?.('This browser does not support same-machine casting', C.amber); return }
    setLocalCasting(true)
    showToast?.('Open a second tab on this display and it will follow along', C.navy)
  }, [localAvailable])

  const stopLocalCast = useCallback(() => setLocalCasting(false), [])

  const startWirelessCast = useCallback(async (showToast) => {
    if (!wirelessAvailable) { showToast?.('This browser does not support wireless casting', C.amber); return }
    try {
      const newSession = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const { error: insertErr } = await supabase.from('qbank_cast_sessions').insert({ id: newSession, slide_index: 0 })
      if (insertErr) { showToast?.('Could not start cast session — see console', C.rose); console.error(insertErr); return }
      const url = `${window.location.origin}/cast-receiver?course=&subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}&source=${source}&session=${newSession}`
      const request = new window.PresentationRequest([url])
      const connection = await request.start()
      connectionRef.current = connection
      setSessionId(newSession)
      setWirelessCasting(true)
      connection.addEventListener('close', () => setWirelessCasting(false))
      connection.addEventListener('terminate', () => setWirelessCasting(false))
    } catch (err) {
      if (err?.name !== 'NotFoundError' && err?.name !== 'AbortError') {
        showToast?.('Cast failed to start', C.rose)
      }
    }
  }, [subject, chapter, source, wirelessAvailable])

  const stopWirelessCast = useCallback(() => {
    connectionRef.current?.terminate?.()
    setWirelessCasting(false)
    setSessionId(null)
  }, [])

  const broadcastIndex = useCallback((index, showAnswers) => {
    if (localCasting) postLocal(index, showAnswers)
    if (wirelessCasting) postWireless(index)
  }, [localCasting, wirelessCasting, postLocal, postWireless])

  return {
    localAvailable, wirelessAvailable, localCasting, wirelessCasting,
    startLocalCast, stopLocalCast, startWirelessCast, stopWirelessCast,
    broadcastIndex,
  }
}


// The simpler single-URL cast helper below (useCast/CastButton) still backs
// the paper-preview and full-screen-fallback buttons elsewhere in this file.
// ROUTE CONTRACT for real casting: PresentationRequest needs a real,
// independently-navigable URL — it hands that URL to the receiving screen,
// it does not stream the current tab. QBank's paper preview and live test
// are React state, not URLs, so casting them for real requires a small
// receiver route (e.g. /cast-receiver?type=paper&id=... or ?type=test&id=...)
// that server-renders (or Supabase-fetches) the same content standalone —
// mirroring the pattern TeachingAids.jsx already uses with its
// CastReceiver.jsx route. Once that route exists, pass its URL as `url` below
// and real wireless casting works immediately; until then, CastButton uses
// the full-screen fallback, which works today with no new route required.
function useCast() {
  const [available] = useState(() => typeof window !== 'undefined' && 'PresentationRequest' in window)
  const [casting, setCasting] = useState(false)
  const connectionRef = useRef(null)

  const startCast = useCallback(async (url, { onFallback, showToast } = {}) => {
    if (available && url) {
      try {
        const request = new window.PresentationRequest([url])
        const connection = await request.start()
        connectionRef.current = connection
        setCasting(true)
        connection.addEventListener('close', () => setCasting(false))
        connection.addEventListener('terminate', () => setCasting(false))
        return
      } catch (err) {
        if (err?.name !== 'NotFoundError' && err?.name !== 'AbortError') {
          showToast?.('Cast failed — opening full-screen instead', C.amber)
        }
      }
    }
    onFallback?.()
  }, [available])

  const stopCast = useCallback(() => {
    connectionRef.current?.terminate?.()
    setCasting(false)
  }, [])

  return { castAvailable: available, casting, startCast, stopCast }
}

// Puts a DOM element into true full-screen presentation mode — the practical
// fallback for a teacher on a physically mirrored/HDMI-connected display.
function presentElementFullscreen(elementId, showToast) {
  const el = document.getElementById(elementId)
  if (!el) { showToast?.('Nothing to present yet', C.amber); return }
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen
  if (!req) { showToast?.('Full-screen not supported on this browser', C.amber); return }
  req.call(el).catch(() => showToast?.('Could not enter full-screen — check browser permissions', C.amber))
}

// `url`: pass the /cast-receiver URL once that route exists, for real wireless
// casting via the Presentation API. `presentTargetId`: DOM id of the element
// to full-screen as the fallback (works today with no new route).
function CastButton({ url, presentTargetId, showToast, small }) {
  const { castAvailable, casting, startCast, stopCast } = useCast()

  const handleClick = () => {
    if (casting) { stopCast(); return }
    startCast(url, {
      showToast,
      onFallback: () => presentElementFullscreen(presentTargetId, showToast),
    })
  }

  const style = small
    ? btnSm(casting ? '#dcfce7' : '#eff6ff', casting ? '#15803d' : C.navy)
    : btn(casting ? C.green : C.navy)

  return (
    <button onClick={handleClick} style={style} title={url ? 'Cast to a TV or wireless display' : 'Present full-screen'}>
      {casting ? '📡 Casting — tap to stop' : (castAvailable && url) ? '📡 Cast to Screen' : '🖥 Present Full-Screen'}
    </button>
  )
}

// ── SMART PPT: .pptx EXPORT ─────────────────────────────────────────────────
// Uses PptxGenJS (bundled npm dependency, code-split via dynamic import —
// no runtime CDN script, so it works offline in the app and can't be
// swapped out by a compromised CDN) to generate a real, downloadable .pptx
// that opens in PowerPoint/Keynote/Google Slides/LibreOffice.
//
// A .pptx can't embed the BMEI04 font, so BMEI04-encoded Mayek text is
// converted to real Unicode Meetei Mayek here and set in Noto Sans Meetei
// Mayek (which the viewer's machine needs installed to display it).
function slideMayekUnicode(text, fontTag) {
  if (!text) return ''
  return fontTag === 'bmei04' ? bmeiToUnicode(text) : text
}


async function generateQuestionPPTX({ title, subject, chapter, slides, withAnswers }) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'GNSI16x9', width: 10, height: 5.63 })
  pres.layout = 'GNSI16x9'

  const NAVY = '1E3A5F', GOLD = 'C9A24B', GREEN = '15803D', GREEN_BG = 'DCFCE7'

  // Title slide
  const titleSlide = pres.addSlide()
  titleSlide.background = { color: NAVY }
  titleSlide.addText('Guidance Navodaya & Sainik Institute', { x:0.5, y:1.6, w:9, h:0.6, fontSize:24, bold:true, color:'FFFFFF', align:'center' })
  titleSlide.addText(title, { x:0.5, y:2.4, w:9, h:0.8, fontSize:32, bold:true, color:GOLD, align:'center' })
  titleSlide.addText(`${subject}  ·  ${chapter}`, { x:0.5, y:3.2, w:9, h:0.5, fontSize:16, color:'CBD5E1', align:'center' })

  slides.forEach((q, i) => {
    const slide = pres.addSlide()
    slide.background = { color: 'FFFFFF' }
    slide.addText(`Q${i+1}`, { x:0.4, y:0.3, w:1.2, h:0.5, fontSize:14, bold:true, color:GOLD })
    slide.addText(q.title, { x:0.4, y:0.75, w:9.2, h:1.6, fontSize:20, bold:true, color:NAVY, valign:'top' })

    if (q.title_mayek) {
      slide.addText(slideMayekUnicode(q.title_mayek, q.title_mayek_font), {
        x:0.4, y:2.15, w:9.2, h:0.6, fontSize:14, color:'374151', fontFace:'Noto Sans Meetei Mayek',
      })
    }

    const optY = q.title_mayek ? 2.85 : 2.35
    const optionRows = [['A','B'], ['C','D']]
    optionRows.forEach((pair, rowIdx) => {
      pair.forEach((letter, colIdx) => {
        const opt = q.options.find(o => o.letter === letter)
        const isCorrect = withAnswers && q.correct_option === letter
        slide.addText(`${letter}.  ${opt?.text || '—'}`, {
          x: 0.4 + colIdx * 4.7, y: optY + rowIdx * 0.75, w: 4.4, h: 0.65,
          fontSize: 13, color: isCorrect ? GREEN : '374151', bold: isCorrect,
          fill: isCorrect ? { color: GREEN_BG } : undefined,
          align:'left', valign:'middle',
        })
      })
    })
  })

  // Answer key slide, only when answers weren't shown inline
  if (!withAnswers) {
    const keySlide = pres.addSlide()
    keySlide.background = { color: NAVY }
    keySlide.addText('Answer Key', { x:0.5, y:0.4, w:9, h:0.6, fontSize:22, bold:true, color:'FFFFFF', align:'center' })
    const cols = 5
    slides.forEach((q, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      keySlide.addText(`Q${i+1}: ${q.correct_option || '—'}`, {
        x: 0.5 + col*1.85, y: 1.3 + row*0.5, w:1.75, h:0.4,
        fontSize:12, color:'FFFFFF', align:'left',
      })
    })
  }

  await pres.writeFile({ fileName: `${title.replace(/\s+/g,'_')}.pptx` })
}

// ── SMART PPT: IN-APP SLIDE VIEWER ──────────────────────────────────────────
// Click-through presenter view, full-screen capable, drives both cast paths
// (local BroadcastChannel + wireless session) as the presenter navigates.
function SlideViewer({ slides, title, subject, chapter, onClose, showToast }) {
  const [index, setIndex] = useState(0)
  const [showAnswers, setShowAnswers] = useState(false)
  const containerRef = useRef(null)
  const cast = useSlideCast({ subject, chapter, source: 'qbank' })

  const slide = slides[index]
  const go = (delta) => setIndex(i => Math.max(0, Math.min(slides.length - 1, i + delta)))

  useEffect(() => {
    cast.broadcastIndex(index, showAnswers)
  }, [index, showAnswers]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === ' ') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key.toLowerCase() === 'a') setShowAnswers(s => !s)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  const enterFullscreen = () => {
    const el = containerRef.current
    const req = el?.requestFullscreen || el?.webkitRequestFullscreen
    req?.call(el).catch(() => showToast?.('Full-screen blocked by browser', C.amber))
  }

  if (!slide) return null

  return (
    <div ref={containerRef} style={{ position:'fixed', inset:0, zIndex:100000, background:C.navy, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', background:'rgba(0,0,0,.25)', flexWrap:'wrap' }}>
        <span style={{ color:'#fff', fontSize:12, fontWeight:700, flex:1 }}>
          🎬 {title} — Slide {index+1} of {slides.length}
        </span>
        <button onClick={() => setShowAnswers(s => !s)} style={btnSm(showAnswers ? '#dcfce7' : 'rgba(255,255,255,.15)', showAnswers ? '#15803d' : '#fff')}>
          {showAnswers ? '🙈 Hide Answers' : '👁 Show Answers'}
        </button>
        <button onClick={enterFullscreen} style={btnSm('rgba(255,255,255,.15)', '#fff')}>⛶ Full-Screen</button>
        {cast.localAvailable && (
          <button onClick={() => cast.localCasting ? cast.stopLocalCast() : cast.startLocalCast(showToast)}
            style={btnSm(cast.localCasting ? '#dcfce7' : 'rgba(255,255,255,.15)', cast.localCasting ? '#15803d' : '#fff')}>
            {cast.localCasting ? '🖥 Local Cast ON' : '🖥 Cast (Same Machine)'}
          </button>
        )}
        {cast.wirelessAvailable && (
          <button onClick={() => cast.wirelessCasting ? cast.stopWirelessCast() : cast.startWirelessCast(showToast)}
            style={btnSm(cast.wirelessCasting ? '#dcfce7' : 'rgba(255,255,255,.15)', cast.wirelessCasting ? '#15803d' : '#fff')}>
            {cast.wirelessCasting ? '📡 Wireless Cast ON' : '📡 Cast Wirelessly'}
          </button>
        )}
        <button onClick={onClose} style={{ ...btnSm('rgba(255,255,255,.15)', '#fff'), padding:'6px 14px' }}>✕ Close</button>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 60px', textAlign:'center', overflow:'auto' }}>
        <div style={{ fontSize:'clamp(20px,2.6vw,36px)', fontWeight:700, color:'#fff', maxWidth:1000, lineHeight:1.5 }}>
          {slide.title}
        </div>
        {slide.title_mayek && (
          <div style={{ fontSize:'clamp(16px,1.9vw,24px)', color:'#cbd5e1', maxWidth:1000, marginTop:16, fontFamily:mayekFontFamily(slide.title_mayek_font) }}>
            <MayekText text={slide.title_mayek} font={slide.title_mayek_font} />
          </div>
        )}
        {slide.diagram_url && (
          <img src={slide.diagram_url} alt="diagram" style={{ maxWidth:'50%', maxHeight:260, marginTop:20, borderRadius:10 }} />
        )}
        {showAnswers && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:28, maxWidth:760, width:'100%' }}>
            {slide.options.map(o => (
              <div key={o.letter} style={{
                padding:'11px 16px', borderRadius:10, fontSize:15, textAlign:'left',
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
      </div>

      <div style={{ display:'flex', justifyContent:'center', gap:16, padding:'18px 0 26px' }}>
        <button onClick={() => go(-1)} disabled={index===0} style={btn('#334155', index===0)}>← Previous</button>
        <span style={{ color:'#fff', alignSelf:'center', fontSize:13, opacity:.7 }}>Space/→ next · A toggle answers · Esc close</span>
        <button onClick={() => go(1)} disabled={index===slides.length-1} style={btn(C.green, index===slides.length-1)}>Next →</button>
      </div>
    </div>
  )
}


function detectSubsection(questionText, subject) {
  const q = questionText.toLowerCase()
  const map = SUBSECTION_KEYWORDS[subject] || {}
  for (const [subsection, keywords] of Object.entries(map)) {
    if (keywords.some(kw => q.includes(kw.toLowerCase()))) return subsection
  }
  return 'General'
}

// ── SMART CHAPTER DETECTOR ───────────────────────────────────────────────────
// Suggests which chapter a question belongs to by scoring the question text
// against the actual chapter names already curated in COURSES for the
// selected course+subject — no second keyword map to maintain in parallel
// with SUBSECTION_KEYWORDS (which is subsection-level and doesn't map 1:1
// onto chapter names across courses — Sainik's "LCM and HCF" chapter vs.
// Navodaya's differently-worded chapter lists under the same canonical
// subject). Chapter names are themselves fairly descriptive phrases
// ("Profit and Loss", "Blood Relations"), so scoring by how many of a
// chapter's significant words appear in the question text is a reasonable
// signal without needing curated keyword lists per chapter.
const STOPWORDS = new Set(['and','or','of','the','a','an','in','on','for','to','with','&'])

function chapterWords(chapterName) {
  return chapterName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

function detectChapter(questionText, course, subject) {
  if (!questionText || !course || !subject) return null
  const chapters = COURSES[course]?.subjects[subject] || []
  if (!chapters.length) return null
  const q = ' ' + questionText.toLowerCase() + ' '

  let best = null
  let bestScore = 0
  for (const chapter of chapters) {
    const words = chapterWords(chapter)
    if (!words.length) continue
    const hits = words.filter(w => q.includes(w)).length
    // Score = fraction of the chapter's significant words present in the
    // question text. Require at least half the words to match (and at
    // least one word for single-word chapter names) to avoid one-word
    // coincidental overlaps ("area" matching "Area and Perimeter" off a
    // single stray mention) from winning over genuinely unrelated chapters.
    const score = hits / words.length
    if (score >= 0.5 && score > bestScore) { bestScore = score; best = chapter }
  }
  return best
}

function needsDiagram(questionText) {
  const q = questionText.toLowerCase()
  return DIAGRAM_KEYWORDS.some(kw => q.includes(kw))
}

// ── SMART BULK PASTE PARSER ───────────────────────────────────────────────────
function extractOptionsFromLine(line) {
  const norm = line.replace(/\t+/g, ' ').replace(/  +/g, ' ').trim()
  const result = {}
  // A marker must start the line or follow whitespace — otherwise the last
  // letter of a word ("Kolkata. (d) …" → "a. ") was read as a marker and
  // truncated the option. Markers must also appear in A→D order, so a
  // stray standalone letter inside an option ("(a) Vitamin A. (b) …")
  // can't restart the sequence.
  // The trailing whitespace is a lookahead, not consumed, so it can still
  // serve as the leading whitespace of the next marker.
  // "D)3946400" (no space after the bracket) is a marker too — papers are
  // often typed that way, and requiring a space there merged option D into
  // option C ("3996400 D)3946400"). The "D." form still needs a following
  // space, so abbreviations like "c.f." are not read as markers.
  const markerRe = /(^|\s)(?:\(([a-dA-D])\)|([a-dA-D])(?:\.(?=\s)|\)))/g
  const positions = []
  let lastLetter = ''
  let mm
  while ((mm = markerRe.exec(norm)) !== null) {
    const letter = (mm[2] || mm[3]).toUpperCase()
    if (lastLetter && letter <= lastLetter) continue
    lastLetter = letter
    const start = mm.index + mm[1].length
    positions.push({ letter, start, end: mm.index + mm[0].length })
  }
  positions.forEach((pos, idx) => {
    const valueStart = pos.end
    const valueEnd   = idx + 1 < positions.length ? positions[idx + 1].start : norm.length
    const value      = norm.slice(valueStart, valueEnd).trim()
    if (value) result[pos.letter] = value
  })
  return result
}

// Questions saved before the "D)3946400" fix can hold two options in one
// field ("3996400 D)3946400" in option C, option D empty). Returns the
// update that splits them, or null. Never overwrites an option that
// already has a value.
function splitMergedOptions(q) {
  const patch = {}
  for (const L of ['A', 'B', 'C']) {
    const key = `option_${L.toLowerCase()}`
    const v = (patch[key] ?? q[key] ?? '').trim()
    if (!v) continue
    const parsed = extractOptionsFromLine(`${L}) ${v}`)
    const extra = Object.keys(parsed).filter(k => k > L)
    if (!extra.length || !parsed[L]) continue
    const blank = k => { const cur = (patch[`option_${k.toLowerCase()}`] ?? q[`option_${k.toLowerCase()}`] ?? '').trim(); return !cur || cur === '—' || cur === '-' }
    if (!extra.every(blank)) continue
    patch[key] = parsed[L]
    for (const k of extra) patch[`option_${k.toLowerCase()}`] = parsed[k]
  }
  return Object.keys(patch).length ? patch : null
}

// Detects whether a line is romanized Meetei Mayek transliteration (the
// bilingual paper format used by GNSI's Sainik/Navodaya papers — Latin
// letters spelling Meetei phonetics, e.g. "43861 d 4 gi fes velu Asi:")
// as opposed to English prose, by scoring the ratio of common English
// function/stop words to total words on the line. Transliterated lines
// consistently score near 0 (they're phonetic Meetei, not English, so
// they almost never contain "the", "of", "number", "difference", etc.)
// while genuine English lines — even short ones — consistently score
// well above the threshold, since English sentences are dense with these
// exact words. Verified against a real 136-question paste (Q1–Q136,
// Number System paper): every transliterated line scored ≤0.12, every
// English line scored ≥0.50 — the 0.25 threshold below has comfortable
// margin on both sides.
const ENGLISH_SIGNAL_WORDS = new Set([
  'the','of','in','is','are','was','were','a','an','and','or','to','for',
  'with','by','from','as','at','on','if','then','number','numbers','digit',
  'digits','following','greatest','smallest','sum','difference','product',
  'value','values','face','place','successor','predecessor','which','what',
  'how','many','written','formed','using','each','used','least','once',
  'system','numeral','write','find','that','this','can','divisible',
  'remainder','symbol','symbols','correct','incorrect','always','never',
  'not','less','more','equal','before','after','there','only',
  // Instruction verbs / common exam vocabulary — short English prompts
  // like "Simplify: 3/4 + 1/2" or "Evaluate 15 × 4" have none of the
  // function words above and were being misread as transliteration.
  'simplify','evaluate','solve','calculate','compute','convert','express',
  'arrange','complete','choose','select','identify','fill','blank','given',
  'below','above','answer','question','statement','statements','true','false',
  'option','options','word','words','meaning','opposite','similar','sentence',
  'figure','series','next','missing','odd','out','largest','total','average',
  'ratio','percent','percentage','profit','loss','area','perimeter','speed',
  'distance','price','cost','its','his','her','their','be','has','have','will',
  // Number words, pronouns and common verbs — measured against the
  // English/BMEI04 line pairs in question_bank.json + extracted_mayek.json,
  // these almost never occur as tokens in BMEI04 lines. Units (km, cm, kg,
  // Rs) are deliberately NOT here: BMEI04 lines keep them in Latin too.
  'one','two','three','four','five','six','seven','eight','nine','ten',
  'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety',
  'hundred','thousand','lakh','crore','million','tenths','hundredths',
  'thousandths','ones','into','he','she','they','we','you','him','them',
  'our','your','these','those','did','does','do','had','get','add','every',
  'than','much','some','all','any','other','between','same','different',
  'still','left','but','so','because','about','made','make','would',
  'should','could','must','may','none','when','where','who','whom','whose',
  'why','name','having','rate','month','gain','money','amount','long',
  'wide','high','greater','negative','respectively','start','numerals',
])
function englishWordScore(line) {
  const words = (line.match(/[A-Za-z']+/g) || []).map(w => w.toLowerCase())
  if (!words.length) return 0
  const hits = words.filter(w => ENGLISH_SIGNAL_WORDS.has(w)).length
  return hits / words.length
}
function isLikelyMayekTransliteration(line) {
  // A blank or option/answer-marker line is never a question-text line at
  // all — this function is only meaningful for actual continuation text,
  // callers already filter those out before reaching here.
  if (!line.trim()) return false
  // Lines with fewer than two words ("3/4 + 1/2 = ?", "x = 5") carry too
  // little signal to call either way — treat them as English so they stay
  // in the question text instead of being rendered in the BMEI04 font.
  const wordCount = (line.match(/[A-Za-z']+/g) || []).length
  if (wordCount < 2) return false
  return englishWordScore(line) < 0.25
}

function parseQuestions(rawText) {
  const lines = rawText.split('\n').map(l => l.replace(/\r/g, '').trimEnd()).filter(l => l.trim())
  const questions = []
  let currentSubsectionHeading = ''
  let i = 0

  const isAnswerLine = (line) => {
    const t = line.trim()
    return /^ans(wer)?\s*[:.-]?\s*[a-d]/i.test(t) ||
           /^\([a-d]\)\s*$/i.test(t) ||
           /^[a-d]\s*$/i.test(t)
  }

  const isHeading = (line) => {
    const t = line.trim()
    return /^\d+\.\s+[A-Z]/.test(t) &&
           t.length < 70 &&
           !t.match(/^\d+\.\s+(which|what|find|how|if |the |a |an |select|choose|write|fill|solve|express|by |in |from |simplif)/i)
  }

  const isQuestionStart = (line) => /^(Q?\s*\d+[.)]\s+|Q\s*\d+\s+)/i.test(line.trim())
  // Anchored to the start of the line: an unanchored match fired on any
  // sentence containing a word ending in a–d followed by "." (e.g. "He
  // walked. Then …"), which ended the question early and dropped text.
  const hasOptionMarker = (line) => /^\(?\s*[a-dA-D]\s*[.)]\s*\S/.test(line.trim())

  while (i < lines.length) {
    const line = lines[i].trim()

    if (isHeading(line) && !isQuestionStart(line)) {
      currentSubsectionHeading = line.replace(/^\d+\.\s*/, '').trim()
      i++; continue
    }

    if (isQuestionStart(line)) {
      const qNum   = line.match(/^Q?\s*(\d+)/i)?.[1]
      let qText    = line.replace(/^Q?\s*\d+[.)]\s*/i, '').trim()

      // First line of a question block is classified too — the GNSI
      // bilingual papers put the transliteration BEFORE the English line
      // (see e.g. "Q1. 43861 d 4 gi fes velu Asi:" followed by "The face
      // value of 4 in the number 43861 is"), so the very first line after
      // the Q-number marker is transliteration, not English, more often
      // than not for this format. qTextMayek collects those lines
      // separately from qText (English) instead of concatenating
      // everything into one garbled string.
      let qTextMayek = isLikelyMayekTransliteration(qText) ? qText : ''
      if (qTextMayek) qText = ''

      let j = i + 1
      while (j < lines.length) {
        const next = lines[j].trim()
        if (hasOptionMarker(next) || isQuestionStart(next) || isHeading(next) || isAnswerLine(next)) break
        if (next) {
          if (isLikelyMayekTransliteration(next)) {
            qTextMayek = qTextMayek ? qTextMayek + ' ' + next : next
          } else {
            qText = qText ? qText + ' ' + next : next
          }
        }
        j++
      }
      i = j

      const options = { A:'', B:'', C:'', D:'' }
      let correctOption = ''
      let linesConsumed = 0

      const optionLines = []
      let k = i
      while (k < lines.length && optionLines.length < 4) {
        const ol = lines[k].trim()
        if (!ol) { k++; continue }
        if (isAnswerLine(ol))   break
        if (isQuestionStart(ol) && linesConsumed > 0) break
        if (isHeading(ol))      break
        if (hasOptionMarker(ol)) { optionLines.push(ol); k++ } else break
      }

      optionLines.forEach(ol => {
        const extracted = extractOptionsFromLine(ol)
        Object.assign(options, extracted)
      })
      i = k

      if (i < lines.length && isAnswerLine(lines[i].trim())) {
        // Take the letter AFTER the "Ans"/"Answer" label — matching the
        // first a–d anywhere picked up the "A" of "Answer", so every
        // "Answer: B" line was saved as A.
        const ans = lines[i].trim().match(/^(?:ans(?:wer)?\s*[:.-]?\s*)?\(?([a-d])\)?/i)
        if (ans) correctOption = ans[1].toUpperCase()
        i++
      }

      // Fallback: if EVERY line in this question's body scored as
      // transliteration (no English line ever showed up — e.g. a
      // Mayek-only paper with no bilingual pairing), qText would be
      // empty here even though real question content was captured. Use
      // qTextMayek as the question itself in that case rather than
      // silently dropping the row for having a blank "question" field.
      if (!qText.trim() && qTextMayek.trim()) {
        qText = qTextMayek
        qTextMayek = ''
      }

      if (qText && (options.A || options.B || options.C || options.D)) {
        questions.push({
          _id: questions.length,
          _qNum: parseInt(qNum) || questions.length + 1,
          question: qText.trim(),
          question_mayek: qTextMayek.trim(),
          // Tagged 'bmei04' whenever this row's Mayek line came through
          // the transliteration detector (isLikelyMayekTransliteration) —
          // that heuristic is specifically catching BMEI-encoded text
          // (garbled-Latin glyphs from this legacy font, not real Unicode
          // Meetei Mayek), so anything it flags needs the BMEI04 font at
          // render time, not Noto Sans Meetei Mayek. Left unset ('') for
          // rows with no Mayek line at all.
          question_mayek_font: qTextMayek.trim() ? 'bmei04' : '',
          option_a: options.A, option_b: options.B,
          option_c: options.C, option_d: options.D,
          correct_option: correctOption,
          _subsectionHint: currentSubsectionHeading,
          _needsDiagram: needsDiagram(qText),
          subject: '', chapter: '', subsection: '',
          difficulty: 'Medium', marks: 1, diagram_url: '',
        })
      }
      continue
    }
    i++
  }
  return questions
}

function parseAnswerKey(keyText) {
  const map = {}
  // Optional "Ans"/"Answer" label and optional brackets around the letter;
  // the letter must stand alone (not the "A" of "Ans", not the start of a
  // word), which is what made "Q12 : Ans c" parse as A.
  const re = /Q?\s*(\d+)\s*[.)\s:-]*\s*(?:ans(?:wer)?\s*[:.-]?\s*)?\(?([a-dA-D])\)?(?![A-Za-z])/gi
  for (const m of keyText.matchAll(re)) { map[parseInt(m[1])] = m[2].toUpperCase() }
  return map
}

// ── DUPLICATE DETECTION ───────────────────────────────────────────────────────
// Normalizes question text for comparison: lowercase, strip punctuation/whitespace
// differences so near-identical pastes (extra spaces, different casing) still match.
// Strips punctuation that's noise for comparing question WORDING, but
// keeps '.', '/', and '-' inside number-like tokens (fractions,
// decimals, ranges) since collapsing those erases real distinctions —
// "1/2" and "1 2" or "3.5" and "35" should never normalize to the same
// string. Everything else (commas, quotes, question marks, etc.) is
// still stripped, since those genuinely don't change question meaning.
function normalizeQuestionText(text) {
  return (text || '')
    .toLowerCase()
    // Protect '.', '/', '-' that sit between two digits by temporarily
    // swapping them for placeholder tokens the punctuation-strip regex
    // won't touch, then restore them after.
    .replace(/(\d)\.(\d)/g, '$1§DOT§$2')
    .replace(/(\d)\/(\d)/g, '$1§SLASH§$2')
    .replace(/(\d)-(\d)/g, '$1§DASH§$2')
    .replace(/[^\w\s§]/g, '')
    .replace(/§DOT§/g, '.')
    .replace(/§SLASH§/g, '/')
    .replace(/§DASH§/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

// Duplicate check scoped to the SAME subject + chapter as the candidate
// row, not the whole bank — comparing across unrelated chapters was the
// main source of false positives (shared instruction phrasing like
// "choose the correct spelling" collides across chapters that have
// nothing else in common). A row with no subject/chapter set yet (bulk
// paste before tagging) falls back to matching within the bank at large,
// same as before, since there's no narrower scope available for it.
//
// Returns the matched existing row's id alongside isDuplicate (not just
// a boolean) — the Replace-on-duplicate flow needs to know which
// existing row to update, and normalized text alone doesn't carry that.
//
// Also flags repeats WITHIN the candidate batch (the same question pasted
// twice): those carry batchDupOf (index of the first copy) and no
// existingId, so they can only be skipped or saved as new, not "replaced".
function findDuplicates(candidateRows, existingQuestions) {
  const byScope = new Map() // "subject|chapter" -> Map<normalizedText, existingId>
  const untaggedMap = new Map()
  for (const q of existingQuestions) {
    const norm = normalizeQuestionText(q.question)
    if (q.subject && q.chapter) {
      const key = `${q.subject}|${q.chapter}`
      if (!byScope.has(key)) byScope.set(key, new Map())
      byScope.get(key).set(norm, q.id)
    } else {
      untaggedMap.set(norm, q.id)
    }
  }

  const seenInBatch = new Map() // "scope|norm" -> first index
  return candidateRows.map((r, i) => {
    const norm = normalizeQuestionText(r.question)
    const scopeKey = r.subject && r.chapter ? `${r.subject}|${r.chapter}` : null
    const scopeMap = scopeKey ? byScope.get(scopeKey) : null
    const matchMap = scopeMap || untaggedMap
    const existingId = matchMap.get(norm)
    const batchKey = `${scopeKey || ''}|${norm}`
    const batchDupOf = seenInBatch.get(batchKey)
    if (batchDupOf === undefined) seenInBatch.set(batchKey, i)
    return {
      index: i,
      isDuplicate: existingId !== undefined || batchDupOf !== undefined,
      existingId,
      batchDupOf: existingId === undefined ? batchDupOf : undefined,
    }
  }).filter(r => r.isDuplicate)
}

// Fetches the CURRENT bank rows (id/question/subject/chapter only) for the
// chapters a batch is about to be saved into. The in-memory question list
// can be up to QBANK_CACHE_TTL_MS stale and never includes other users'
// recent inserts, so saves re-check duplicates against this live slice.
// Returns null if the lookup fails (caller falls back to the cached list).
async function fetchLiveDupPool(rows) {
  const chapters = [...new Set(rows.map(r => r.chapter).filter(Boolean))]
  if (!chapters.length) return []
  const PAGE = 1000
  let all = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('qbank_questions')
      .select('id, question, subject, chapter')
      .in('chapter', chapters)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return null
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
  }
  return all
}

// ── SHARED: auto-download a JSON backup before a destructive delete ────────
// Used by both handleBulkDelete (TabBank) and handleDeleteAll (TabStats) —
// the two delete paths that can destroy more than one question at once.
// Downloads the FULL row content (every field, not just question text) as
// pretty-printed JSON, so it's restorable via a straightforward re-insert
// if the delete turns out to be a mistake. Runs synchronously, in-browser,
// before the delete call fires — no server round-trip, no way for the
// delete to proceed without the file already being handed to the browser's
// download mechanism first.
function downloadQuestionsBackup(rows, label) {
  const filename = `qbank_backup_${label}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const json = JSON.stringify(rows, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── CSV IMPORT ─────────────────────────────────────────────────────────────
// Expected header row (case-insensitive, order-independent):
// question, option_a, option_b, option_c, option_d, correct_option, subject, chapter, subsection, difficulty, marks
// Parsed with parseCSV (quote-aware across line breaks) — see helpers above.
function parseCSVQuestions(csvText, defaultCourse, defaultSubject, defaultChapter) {
  const rows = parseCSV(csvText)
  if (rows.length < 2) return []
  const header = rows[0].map(h => h.toLowerCase().replace(/\s+/g,'_'))
  const colIdx = (name) => header.indexOf(name)
  const qi = colIdx('question')
  if (qi === -1) return []

  return rows.slice(1).map((cells, i) => {
    const get = (name) => { const idx = colIdx(name); return idx>=0 ? (cells[idx]||'').trim() : '' }
    const question = get('question')
    if (!question) return null
    const correctRaw = get('correct_option').toUpperCase()
    return {
      _id: i,
      _qNum: i + 1,
      question,
      option_a: get('option_a'), option_b: get('option_b'),
      option_c: get('option_c'), option_d: get('option_d'),
      correct_option: ['A','B','C','D'].includes(correctRaw) ? correctRaw : '',
      course: get('course') || defaultCourse || '',
      subject: get('subject') || defaultSubject || '',
      chapter: get('chapter') || defaultChapter || '',
      subsection: get('subsection') || '',
      difficulty: ['Easy','Medium','Hard'].includes(get('difficulty')) ? get('difficulty') : 'Medium',
      marks: MARKS_OPTIONS.includes(parseInt(get('marks'))) ? parseInt(get('marks')) : 1,
      diagram_url: '',
      _subsectionHint: '',
      _needsDiagram: needsDiagram(question),
    }
  }).filter(Boolean)
}

// ── QUESTION CARD ─────────────────────────────────────────────────────────────
function QCard({ q, index, showAnswer=false, selectable, selected, onToggle, onDelete, onEdit, onFixOptions }) {
  const [reveal, setReveal] = useState(showAnswer)
  const merged = onFixOptions ? splitMergedOptions(q) : null
  const sc = SC[q.subject] || SC.Mathematics
  const diffTone = q.difficulty==='Easy' ? [T.green, T.greenSoft] : q.difficulty==='Hard' ? [T.rose, T.roseSoft] : [T.amber, T.amberSoft]
  return (
    <div className="qb-lift" style={{ ...cardS, marginBottom:10, padding:'16px 18px',
      border: selected ? `1.5px solid ${T.navy}` : `1px solid ${T.border}`,
      borderLeft: q._needsDiagram && !selected ? `3px solid ${T.accent}` : undefined,
      background: selected ? '#f5f9ff' : T.surface }}>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
        {selectable && (
          <input type="checkbox" checked={!!selected} aria-label={`Select question ${index+1}`}
            onChange={() => onToggle?.(q.id || q._id)}
            style={{ width:16, height:16, marginTop:4, flexShrink:0 }} />
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10, alignItems:'center' }}>
            <span style={{ fontSize:11.5, fontWeight:700, color:T.navy, background:T.navySoft, padding:'3px 8px',
              borderRadius:7, fontVariantNumeric:'tabular-nums' }}>Q{index+1}</span>
            {q.subject && <Badge text={q.subject} color={sc.color} bg={sc.bg} border={sc.border} />}
            {q.chapter && <Badge text={q.chapter} color={T.muted} bg={T.surfaceAlt} border={T.border} />}
            {q.subsection && <Badge text={q.subsection} color={T.teal} bg={T.tealSoft} />}
            <Badge text={q.difficulty||'Medium'} color={diffTone[0]} bg={diffTone[1]} />
            <Badge text={`${q.marks||1} mark${(q.marks||1)===1?'':'s'}`} color={T.indigo} bg={T.indigoSoft} />
            {q._needsDiagram && <Badge text="Needs diagram" color={T.amber} bg={T.amberSoft} border={T.amberLine} />}
            {q.diagram_url && <Badge text="🖼 Diagram" color={T.green} bg={T.greenSoft} />}
            {merged && <button onClick={() => onFixOptions(q, merged)} style={btnSm(T.amberSoft, T.amber)}
              title={`Two options were saved in one box — split into ${Object.entries(merged).map(([k, v]) => `${k.slice(-1).toUpperCase()}: ${v}`).join(' · ')}`}>⚠ Fix options</button>}
            <span style={{ marginLeft:'auto', display:'flex', gap:6 }}>
              {onEdit && <button onClick={() => onEdit(q)} style={btnSm('#fff', T.indigo)} title="Edit question">✏️ Edit</button>}
              {onDelete && <button onClick={() => onDelete(q.id)} style={btnSm('#fff', T.rose)} title="Delete question">🗑 Delete</button>}
            </span>
          </div>
          <div style={{ fontSize:14.5, color:T.ink, fontWeight:500, lineHeight:1.65, marginBottom:q.question_mayek ? 4 : 12 }}>
            {q.question}
          </div>
          {q.question_mayek && (
            <div style={{ fontSize:15, color:'#374151', lineHeight:1.7, marginBottom:12, fontFamily:mayekFontFamily(q.question_mayek_font) }}>
              <MayekText text={q.question_mayek} font={q.question_mayek_font} />
            </div>
          )}
          {q.diagram_url && (
            <img src={q.diagram_url} alt="Question diagram"
              style={{ maxWidth:300, maxHeight:190, borderRadius:10, border:`1px solid ${T.border}`, marginBottom:12, display:'block', background:'#fff' }} />
          )}
          <div className="qb-opts" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            {['A','B','C','D'].map(l => {
              const correct = reveal && q.correct_option===l
              return (
                <div key={l} style={optionStyle(correct)}>
                  <OptionLetter letter={l} correct={correct} />
                  <div style={{ minWidth:0, paddingTop:1 }}>
                    {q[`option_${l.toLowerCase()}`] || <span style={{ color:T.faint }}>—</span>}
                    {q[`option_${l.toLowerCase()}_mayek`] && (
                      <div style={{ fontFamily:mayekFontFamily(q.question_mayek_font), fontWeight:400, marginTop:2 }}>
                        <MayekText text={q[`option_${l.toLowerCase()}_mayek`]} font={q.question_mayek_font} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={() => setReveal(r=>!r)} style={reveal ? btnSm('#fff', T.muted) : btnSm(T.green)}>
            {reveal ? '🙈 Hide answer' : '👁 Show answer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── STUDY MATERIALS REFERENCE PANEL ──────────────────────────────────────────
// Shows existing study materials for the selected subject+chapter.
// Used inside TabManualAdd and TabBulkPaste as a reference sidebar.
function StudyMaterialsRefPanel({ course, subject, chapter, onNavigate }) {
  const qbankSubject = normalizeToQBank(subject)
  const { materials, loading } = useStudyMaterialsByChapter(qbankSubject, chapter)

  if (!subject || !chapter) return null
  if (!loading && !materials.length) return null

  const TYPE_ICON = {
    notes:'📄', formula:'🔣', practice:'✏️', solved:'✅',
    mindmap:'🗂️', video:'🎥', currentaffairs:'📰',
  }

  return (
    <div style={{ padding:'10px 14px', borderRadius:9, background:'#f0f9ff', border:'1px solid #bae6fd', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:700, color:'#0369a1' }}>
          📖 Study Materials — {chapter}
        </span>
        <span style={{ display:'flex', gap:10 }}>
          <button
            onClick={() => openChapterIn('hub', { course, subject, chapter }, onNavigate)}
            title="Open this chapter in the Teaching hub"
            style={{ fontSize:10, color:'#0369a1', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>
            🎯 Chapter hub
          </button>
          <button
            onClick={() => openChapterIn('studymaterial', { course, subject, chapter }, onNavigate)}
            style={{ fontSize:10, color:'#0369a1', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>
            Open Study Materials →
          </button>
        </span>
      </div>
      {loading
        ? <div style={{ fontSize:11, color:'#94a3b8' }}>Loading…</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {materials.map(m => (
              <div key={m.id} style={{ display:'flex', gap:8, alignItems:'center', fontSize:12 }}>
                <span>{TYPE_ICON[m.material_type] || '📄'}</span>
                <span style={{ flex:1, color:'#1e293b', fontWeight:500 }}>{m.title}</span>
                {m.file_url && (
                  <a href={m.file_url} target="_blank" rel="noreferrer"
                    style={{ fontSize:10, color:'#2563eb', fontWeight:700, whiteSpace:'nowrap' }}>
                    Open ↗
                  </a>
                )}
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: QUESTION BANK
// Patch: applies initialFilter on mount + listens for NAVIGATE_TO event
// ══════════════════════════════════════════════════════════════════════════════
function TabBank({ questions, loading, refetch, showToast, initialFilter, isAdmin, canEdit = isAdmin, onNavigate }) {
  const [filterCourse,     setFilterCourse]     = useState('All')
  const [filterSubject,    setFilterSubject]    = useState('All')
  const [filterChapter,    setFilterChapter]    = useState('All')
  const [filterSubsection, setFilterSubsection] = useState('All')
  const [filterDiff,       setFilterDiff]       = useState('All')
  const [filterDiagram,    setFilterDiagram]    = useState('All')
  const [search,           setSearch]           = useState('')
  const [page,             setPage]             = useState(1)
  const [selected,         setSelected]         = useState(new Set())
  const [editQ,            setEditQ]            = useState(null)
  const PAGE = 20

  // Subject list scoped to the selected course — 'All' course falls back
  // to the union of every course's subjects (deduplicated) so switching
  // "All Courses" still lets you filter by a subject name shared across
  // courses (e.g. Mathematics appears in Sainik, Foundation, and RMS).
  const courseSubjectList = useMemo(() => {
    if (filterCourse === 'All') {
      const all = new Set()
      COURSE_LIST.forEach(c => Object.keys(COURSES[c].subjects).forEach(s => all.add(s)))
      return [...all]
    }
    return Object.keys(COURSES[filterCourse]?.subjects || {})
  }, [filterCourse])

  // ── PATCH: apply initialFilter from cross-module navigation ────────────────
  useEffect(() => {
    if (!initialFilter) return
    // Course-aware: previously only Sainik's four subject names were
    // accepted, so a focus on e.g. Navodaya "Arithmetic" was dropped.
    const course = COURSES[initialFilter.course] ? initialFilter.course : 'All'
    const subjectsHere = course === 'All'
      ? Object.assign({}, ...COURSE_LIST.map(c => COURSES[c].subjects))
      : COURSES[course].subjects
    const subject = !initialFilter.subject ? 'All'
      : subjectsHere[initialFilter.subject] ? initialFilter.subject
      : subjectsHere[normalizeToQBank(initialFilter.subject)] ? normalizeToQBank(initialFilter.subject)
      : 'All'
    // Applying a filter handed in by another module (a navigation event).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterCourse(course)
    setFilterSubject(subject)
    setFilterChapter(subject !== 'All' && initialFilter.chapter ? initialFilter.chapter : 'All')
    setFilterSubsection('All')
    setSearch('')
    setPage(1)
  }, [initialFilter])

  // Chapters come from the selected course+subject when both are picked;
  // with course='All', fall back to whichever course actually defines
  // that subject name (courses can share a subject name — e.g.
  // Mathematics — with different chapter lists, so 'All' courses +
  // one subject picks the first course that has it, same ambiguity
  // StudyMaterial.jsx accepts in its own cross-course subject matching).
  const chapters = useMemo(() => {
    if (filterSubject === 'All') return []
    if (filterCourse !== 'All') return COURSES[filterCourse]?.subjects[filterSubject] || []
    for (const c of COURSE_LIST) {
      if (COURSES[c].subjects[filterSubject]) return COURSES[c].subjects[filterSubject]
    }
    return []
  }, [filterCourse, filterSubject])

  const subsections = useMemo(() => {
    if (filterSubject === 'All' || filterChapter === 'All') return []
    const ss = new Set(questions
      .filter(q => q.subject === filterSubject && q.chapter === filterChapter)
      .map(q => q.subsection).filter(Boolean))
    return [...ss].sort()
  }, [questions, filterSubject, filterChapter])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return questions.filter(item => {
      if (filterCourse      !== 'All' && (item.course || '') !== filterCourse) return false
      if (filterSubject    !== 'All' && item.subject    !== filterSubject)    return false
      if (filterChapter    !== 'All' && item.chapter    !== filterChapter)    return false
      if (filterSubsection !== 'All' && item.subsection !== filterSubsection) return false
      if (filterDiff       !== 'All' && item.difficulty !== filterDiff)       return false
      if (filterDiagram === 'missing' && !(needsDiagram(item.question||'') && !item.diagram_url)) return false
      if (filterDiagram === 'has'     && !item.diagram_url)                   return false
      if (q && !item.question?.toLowerCase().includes(q))                    return false
      return true
    })
  }, [questions, filterCourse, filterSubject, filterChapter, filterSubsection, filterDiff, filterDiagram, search])

  // One pass over the bank for the subject cards, instead of a full
  // filter per subject on every render.
  const subjectCounts = useMemo(() => {
    const m = new Map()
    for (const q of questions) {
      if (filterCourse !== 'All' && (q.course || '') !== filterCourse) continue
      m.set(q.subject, (m.get(q.subject) || 0) + 1)
    }
    return m
  }, [questions, filterCourse])

  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE))
  const paginated    = filtered.slice((page-1)*PAGE, page*PAGE)

  // A selection only ever covers what the admin can currently see: changing
  // any filter or the search clears it, so a bulk delete can't include
  // rows hidden by a filter picked after they were checked.
  const filterKey = [filterCourse, filterSubject, filterChapter, filterSubsection, filterDiff, filterDiagram, search].join('\u241f')
  const [selectionKey, setSelectionKey] = useState(filterKey)
  if (selectionKey !== filterKey) { setSelectionKey(filterKey); setSelected(new Set()) }

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const allOnPageSelected = paginated.length > 0 && paginated.every(q => selected.has(q.id))
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev)
    if (allOnPageSelected) paginated.forEach(q => n.delete(q.id))
    else paginated.forEach(q => n.add(q.id))
    return n
  })

  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return
    const row = questions.find(q => q.id === id)
    // count: row-level security silently filters out rows the user may not
    // delete (no error), so check that the row was really removed.
    const { error, count } = await supabase.from('qbank_questions').delete({ count:'exact' }).eq('id', id)
    if (error) showToast('Delete failed: ' + error.message, C.rose)
    else if (!count) showToast('Nothing was deleted — the question is already gone, or you lack permission', C.amber)
    else {
      if (row?.diagram_url) removeDiagrams([row.diagram_url])
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
      showToast('Deleted ✓', C.rose); refetch(true)
    }
  }

  const handleBulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} questions?`)) return
    // Auto-backup: download the full content of every row about to be
    // deleted, BEFORE the delete call fires — see downloadQuestionsBackup's
    // own comment for why this runs synchronously ahead of the request.
    // Diagram images are kept on bulk delete (not removed from storage)
    // so the backup's diagram_url links stay restorable.
    const rowsToDelete = questions.filter(q => selected.has(q.id))
    downloadQuestionsBackup(rowsToDelete, `bulk_${selected.size}`)
    const { error, count } = await supabase.from('qbank_questions').delete({ count:'exact' }).in('id', [...selected])
    if (error) showToast('Bulk delete failed: ' + error.message, C.rose)
    else if (!count) showToast('Nothing was deleted — you may lack permission', C.amber)
    else { showToast(`${count} questions deleted (backup downloaded)`, C.rose); setSelected(new Set()); refetch(true) }
  }

  // One-click repair for a question whose options were merged on paste.
  const fixOptions = async (q, patch) => {
    const { data, error } = await supabase.from('qbank_questions').update(patch).eq('id', q.id).select('id')
    if (error) showToast('Fix failed: ' + error.message, C.rose)
    else if (!data?.length) showToast('Nothing was updated — you may lack permission', C.amber)
    else { showToast('Options split ✓', C.green); refetch(true) }
  }

  const startEdit = (q) => setEditQ({ ...q, _savedDiagramUrl: q.diagram_url || '' })
  const cancelEdit = () => {
    // Drop a diagram uploaded during this edit that is now being discarded.
    if (editQ?.diagram_url && editQ.diagram_url !== editQ._savedDiagramUrl) removeDiagrams([editQ.diagram_url])
    setEditQ(null)
  }

  const handleEditSave = async (updatedQ) => {
    // eslint-disable-next-line no-unused-vars -- the _fields are dropped on purpose
    const { id, _id, _qNum, _subsectionHint, _needsDiagram, _savedDiagramUrl, ...payload } = updatedQ
    // Same required fields as Manual Add — an edit must not be able to
    // save a question with no text, too few options, or no answer.
    const missing = []
    if (!payload.course) missing.push('course')
    if (!payload.subject) missing.push('subject')
    if (!payload.chapter) missing.push('chapter')
    if (!payload.question?.trim()) missing.push('question')
    if (!payload.option_a?.trim() || !payload.option_b?.trim()) missing.push('options A and B')
    if (!['A','B','C','D'].includes(payload.correct_option)) missing.push('correct answer')
    if (missing.length) { showToast(`Fill in: ${missing.join(', ')}`, C.amber); return }
    const { data, error } = await supabase.from('qbank_questions').update(payload).eq('id', id).select('id')
    if (error) showToast('Update failed: ' + error.message, C.rose)
    else if (!data?.length) showToast('Nothing was updated — the question no longer exists, or you lack permission', C.amber)
    else {
      if (_savedDiagramUrl && _savedDiagramUrl !== payload.diagram_url) removeDiagrams([_savedDiagramUrl])
      showToast('Updated ✓', C.green); setEditQ(null); refetch(true)
    }
  }

  return (
    <>
      {/* initialFilter active banner */}
      {initialFilter && (filterSubject !== 'All' || filterChapter !== 'All') && (
        <div className="qb-fade" style={{ padding:'10px 14px', borderRadius:12, background:T.violetSoft, border:'1px solid #ddd6fe', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12.5, fontWeight:600, color:T.violet }}>
            📚 Showing: {filterSubject !== 'All' ? filterSubject : ''}{filterChapter !== 'All' ? ` › ${filterChapter}` : ''}
          </span>
          <button onClick={() => { setFilterSubject('All'); setFilterChapter('All'); setPage(1) }}
            style={btnSm('#fff', T.violet)}>✕ Clear filter</button>
        </div>
      )}

      {/* ── PATCH: reciprocal materials panel ──────────────────────────────
          StudyMaterial already surfaces "N Q" badges that deep-link into
          this tab; this is the other direction — while browsing a specific
          chapter here, show what reference materials already exist for it,
          with a link back to Study Materials. Reuses the same panel the
          Manual Add / Bulk Paste forms already render, so both entry points
          stay visually and behaviourally consistent. */}
      {filterSubject !== 'All' && filterChapter !== 'All' && (
        <StudyMaterialsRefPanel course={filterCourse !== 'All' ? filterCourse : ''} subject={filterSubject} chapter={filterChapter} onNavigate={onNavigate} />
      )}

      {/* Subject cards — click to filter */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:12, marginBottom:18 }}>
        {[{ key:'All', label:'All subjects', count: filterCourse === 'All' ? questions.length : [...subjectCounts.values()].reduce((a,b)=>a+b,0), color:T.navy },
          ...courseSubjectList.map(s => ({ key:s, label:s, count: subjectCounts.get(s) || 0, color:(SC[s] || SC.Mathematics).color }))
            // With every course listed, most subjects belong to other courses
            // and read 0 — show only subjects that have questions (plus the
            // selected one). A specific course still lists all its subjects.
            .filter(c => filterCourse !== 'All' || c.count > 0 || c.key === filterSubject)
        ].map(({ key, label, count, color }) => {
          const active = filterSubject === key
          const total = Math.max(1, questions.length)
          return (
            <button key={key} className="qb-lift qb-click" aria-pressed={active}
              onClick={() => { setFilterSubject(key); setFilterChapter('All'); setFilterSubsection('All'); setPage(1) }}
              style={{ textAlign:'left', padding:'14px 16px', borderRadius:T.radius, cursor:'pointer',
                background: active ? '#fff' : T.surface, position:'relative', overflow:'hidden',
                border:`1px solid ${active ? color : T.border}`,
                boxShadow: active ? `0 0 0 3px ${color}22, ${T.shadow}` : T.shadow }}>
              <span aria-hidden style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:color, opacity: active ? 1 : .55 }} />
              <div style={{ fontSize:24, fontWeight:800, color:T.ink, letterSpacing:'-.02em', fontVariantNumeric:'tabular-nums' }}>
                {count.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize:11.5, fontWeight:600, color: active ? color : T.muted, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
              <div style={{ height:4, borderRadius:99, background:T.surfaceAlt, marginTop:10, overflow:'hidden' }}>
                <div style={{ width:`${Math.min(100, (count / total) * 100)}%`, height:'100%', background:color, borderRadius:99 }} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ ...cardS, padding:14, marginBottom:14 }}>
        <div className="qb-grid" style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap:10 }}>
          <div style={{ position:'relative' }}>
            <span aria-hidden style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, color:T.faint, pointerEvents:'none' }}>🔍</span>
            <input style={{ ...iS, paddingLeft:34 }} placeholder="Search questions…" value={search} aria-label="Search questions"
              onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select style={iS} value={filterCourse} aria-label="Course"
            onChange={e => { setFilterCourse(e.target.value); setFilterSubject('All'); setFilterChapter('All'); setFilterSubsection('All'); setPage(1) }}>
            <option value="All">All Courses</option>
            {COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}
          </select>
          <select style={iS} value={filterSubject} aria-label="Subject"
            onChange={e => { setFilterSubject(e.target.value); setFilterChapter('All'); setFilterSubsection('All'); setPage(1) }}>
            <option value="All">All Subjects</option>
            {courseSubjectList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={{ ...iS, opacity: filterSubject!=='All'?1:.55 }} value={filterChapter} aria-label="Chapter"
            onChange={e => { setFilterChapter(e.target.value); setFilterSubsection('All'); setPage(1) }}
            disabled={filterSubject==='All'}>
            <option value="All">All Chapters</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={{ ...iS, opacity: subsections.length?1:.55 }} value={filterSubsection} aria-label="Subsection"
            onChange={e => { setFilterSubsection(e.target.value); setPage(1) }}
            disabled={!subsections.length}>
            <option value="All">All Subsections</option>
            {subsections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={iS} value={filterDiff} aria-label="Difficulty"
            onChange={e => { setFilterDiff(e.target.value); setPage(1) }}>
            <option value="All">All Difficulties</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select style={iS} value={filterDiagram} aria-label="Diagram"
            onChange={e => { setFilterDiagram(e.target.value); setPage(1) }}>
            <option value="All">All Diagrams</option>
            <option value="missing">⚠️ Needs diagram</option>
            <option value="has">🖼 Has diagram</option>
          </select>
        </div>
      </div>

      {/* Results bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:12, padding:'0 2px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, color:T.muted }}>
            <strong style={{ color:T.ink, fontVariantNumeric:'tabular-nums' }}>{filtered.length.toLocaleString('en-IN')}</strong> question{filtered.length !== 1 ? 's' : ''}
            {totalPages > 1 && <> · page {page} of {totalPages}</>}
          </span>
          {isAdmin && !loading && paginated.length > 0 && (
            <label style={{ display:'inline-flex', gap:7, alignItems:'center', fontSize:12.5, color:T.muted, cursor:'pointer' }}>
              <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} />
              Select page
            </label>
          )}
          {(search || filterCourse !== 'All' || filterSubject !== 'All' || filterDiff !== 'All' || filterDiagram !== 'All') && (
            <button onClick={() => { setSearch(''); setFilterCourse('All'); setFilterSubject('All'); setFilterChapter('All'); setFilterSubsection('All'); setFilterDiff('All'); setFilterDiagram('All'); setPage(1) }}
              style={{ ...btnSm('transparent', T.indigo), border:'none', padding:'4px 6px' }}>Reset filters</button>
          )}
        </div>
        {isAdmin && selected.size > 0 && (
          <button onClick={handleBulkDelete} style={btn(C.rose)}>🗑 Delete {selected.size} selected</button>
        )}
      </div>

      {/* Edit inline panel — teaching staff and admins; delete stays admin-only */}
      {canEdit && editQ && (
        <div className="qb-fade" style={{ ...cardS, border:`1.5px solid ${T.indigo}`, boxShadow:`0 0 0 4px ${T.indigoSoft}, ${T.shadow}`, marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ width:30, height:30, borderRadius:9, background:T.indigoSoft, display:'flex', alignItems:'center', justifyContent:'center' }}>✏️</span>
            <div style={{ fontWeight:700, color:T.ink, fontSize:15 }}>Edit question</div>
          </div>
          <QuestionRowForm row={editQ} index={0} onChange={(i,k,v) => setEditQ(q=>({...q,[k]:v}))}
            onRemove={null} showImageUpload showToast={showToast} />
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button onClick={() => handleEditSave(editQ)} style={btn(C.green)}>✓ Save changes</button>
            <button onClick={cancelEdit} style={btnSm('#fff', T.muted)}>Cancel</button>
          </div>
        </div>
      )}

      {loading
        ? [0,1,2].map(i => (
            <div key={i} style={{ ...cardS, marginBottom:10, padding:'18px' }} aria-hidden>
              {[['40%',10],['92%',14],['70%',14]].map(([w,h],j) => (
                <div key={j} style={{ width:w, height:h, borderRadius:6, marginBottom:10,
                  background:'linear-gradient(90deg,#eef2f7 25%,#f6f8fb 50%,#eef2f7 75%)', backgroundSize:'200% 100%',
                  animation:'qbShimmer 1.2s linear infinite' }} />
              ))}
            </div>
          ))
        : paginated.length === 0
          ? <div className="qb-fade" style={{ ...cardS, textAlign:'center', padding:'48px 24px' }}>
              <div style={{ width:52, height:52, borderRadius:16, margin:'0 auto 12px', background:T.navySoft, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🗂️</div>
              <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>No questions found</div>
              <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>Try a different filter, or add questions from Manual Add or Bulk Paste.</div>
            </div>
          : paginated.map((q, i) => (
              <QCard key={q.id} q={q} index={(page-1)*PAGE+i}
                selectable={isAdmin} selected={selected.has(q.id)}
                onToggle={isAdmin ? toggleSelect : undefined}
                onEdit={canEdit ? startEdit : undefined}
                onFixOptions={canEdit ? fixOptions : undefined}
                onDelete={isAdmin ? handleDelete : undefined} />
            ))
      }

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:18, alignItems:'center' }}>
          {[
            { label:'«', to:1, dis: page===1, title:'First page' },
            { label:'‹ Prev', to:Math.max(1,page-1), dis: page===1, title:'Previous page' },
          ].map(b => <button key={b.label} title={b.title} onClick={() => setPage(b.to)} disabled={b.dis}
            style={{ ...btnSm('#fff', T.text), padding:'7px 12px', opacity: b.dis ? .45 : 1, cursor: b.dis ? 'not-allowed' : 'pointer' }}>{b.label}</button>)}
          <span style={{ padding:'7px 14px', fontWeight:600, color:T.ink, fontSize:13, fontVariantNumeric:'tabular-nums' }}>
            {page} <span style={{ color:T.faint, fontWeight:500 }}>/ {totalPages}</span>
          </span>
          {[
            { label:'Next ›', to:Math.min(totalPages,page+1), dis: page===totalPages, title:'Next page' },
            { label:'»', to:totalPages, dis: page===totalPages, title:'Last page' },
          ].map(b => <button key={b.label} title={b.title} onClick={() => setPage(b.to)} disabled={b.dis}
            style={{ ...btnSm('#fff', T.text), padding:'7px 12px', opacity: b.dis ? .45 : 1, cursor: b.dis ? 'not-allowed' : 'pointer' }}>{b.label}</button>)}
        </div>
      )}
    </>
  )
}

// ── SINGLE QUESTION ROW FORM (used in Manual Add + Edit) ─────────────────────
function QuestionRowForm({ row, index, onChange, onRemove, showImageUpload, showToast }) {
  const courseSubjects = row.course ? Object.keys(COURSES[row.course]?.subjects || {}) : SUBJECT_LIST
  const chapters    = row.course ? (COURSES[row.course]?.subjects[row.subject] || []) : (SUBJECTS[row.subject] || [])
  const subSecMap   = SUBSECTION_KEYWORDS[row.subject] || {}
  const subsections = Object.keys(subSecMap)
  const fileRef     = useRef()

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    e.target.value = '' // allow re-picking the same file after an error
    if (!file) return
    const ext = DIAGRAM_MIME_EXT[file.type]
    if (!ext) { showToast('Diagram must be a PNG, JPEG, WebP or GIF image', C.amber); return }
    if (file.size > DIAGRAM_MAX_BYTES) { showToast('Diagram is larger than 5 MB — please compress it', C.amber); return }
    const rand = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    const path = `q_${Date.now()}_${rand}.${ext}`
    const { error } = await supabase.storage.from(DIAGRAM_BUCKET)
      .upload(path, file, { upsert:false, contentType: file.type })
    if (error) { showToast('Image upload failed: ' + error.message, C.rose); return }
    const { data } = supabase.storage.from(DIAGRAM_BUCKET).getPublicUrl(path)
    // A diagram uploaded earlier in this same unsaved form (not yet on any
    // saved question) would be orphaned by this change — remove it. The
    // saved question's original diagram is only removed once the edit is
    // actually saved (see handleEditSave), so Cancel never loses it.
    if (row.diagram_url && row.diagram_url !== row._savedDiagramUrl) removeDiagrams([row.diagram_url])
    onChange(index, 'diagram_url', data.publicUrl)
    showToast('Diagram uploaded ✓', C.green)
  }

  const handleQuestionChange = (val) => {
    onChange(index, 'question', val)
    if (val.length > 20) {
      // Chapter first (only if not already picked) — subsection detection
      // downstream depends on subject, not chapter, so order here doesn't
      // matter for that, but filling chapter first means a teacher who
      // hasn't touched the chapter dropdown yet sees it populate as they type.
      if (row.course && row.subject && !row.chapter) {
        const detectedChapter = detectChapter(val, row.course, row.subject)
        if (detectedChapter) onChange(index, 'chapter', detectedChapter)
      }
      if (row.subject) {
        const detected = detectSubsection(val, row.subject)
        if (detected !== 'General' && !row.subsection) onChange(index, 'subsection', detected)
      }
    }
  }

  const handleAutoDetectChapter = () => {
    if (!row.course || !row.subject) { showToast?.('Pick a course and subject first', C.amber); return }
    if (!row.question || row.question.trim().length < 10) { showToast?.('Type the question first', C.amber); return }
    const detected = detectChapter(row.question, row.course, row.subject)
    if (detected) { onChange(index, 'chapter', detected); onChange(index, 'subsection', '') }
    else showToast?.('Could not confidently match a chapter — pick manually', C.amber)
  }

  return (
    <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginBottom:10, background:'#fafafa' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:700, color:C.navy }}>Question {index+1}</span>
        {onRemove && (
          <button onClick={() => onRemove(index)} style={btnSm('#fee2e2', C.rose)}>✖ Remove</button>
        )}
      </div>
      <div className="qb-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:10 }}>
        <div>
          <label style={lS}>Course *</label>
          <select style={iS} value={row.course || ''}
            onChange={e => { onChange(index,'course',e.target.value); onChange(index,'subject',''); onChange(index,'chapter',''); onChange(index,'subsection','') }}>
            <option value="">Select</option>
            {COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Subject *</label>
          <select style={{ ...iS, opacity: row.course?1:.5 }} value={row.subject}
            onChange={e => { onChange(index,'subject',e.target.value); onChange(index,'chapter',''); onChange(index,'subsection','') }}
            disabled={!row.course}>
            <option value="">Select</option>
            {courseSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>
            Chapter *
            <button type="button" onClick={handleAutoDetectChapter}
              disabled={!row.course || !row.subject}
              title="Guess the chapter from the question text"
              style={{ marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5,
                border:'none', cursor:(!row.course || !row.subject) ? 'default' : 'pointer',
                color: (!row.course || !row.subject) ? '#94a3b8' : '#7c3aed',
                background: (!row.course || !row.subject) ? '#f1f5f9' : '#ede9fe' }}>
              🪄 Auto-detect
            </button>
          </label>
          <select style={{ ...iS, opacity: row.subject?1:.5 }} value={row.chapter}
            onChange={e => { onChange(index,'chapter',e.target.value); onChange(index,'subsection','') }}
            disabled={!row.subject}>
            <option value="">Select</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Subsection <span style={{ fontWeight:400, textTransform:'none' }}>(auto-detected)</span></label>
          <select style={{ ...iS, opacity: row.subject?1:.5 }} value={row.subsection}
            onChange={e => onChange(index,'subsection',e.target.value)}
            disabled={!row.subject}>
            <option value="">Auto / General</option>
            {subsections.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="General">General</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={lS}>Question *</label>
        <textarea style={{ ...iS, resize:'vertical' }} rows={3}
          value={row.question} placeholder="Type question here… (fractions: use 5/4, 2 1/3 format)"
          onChange={e => handleQuestionChange(e.target.value)} />
      </div>
      <div className="qb-opts" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        {['A','B','C','D'].map(l => (
          <div key={l}>
            <label style={{ ...lS, color: row.correct_option===l ? C.green : C.slate }}>
              Option {l} {row.correct_option===l ? '✓ Correct' : ''}
            </label>
            <input style={{ ...iS, borderColor: row.correct_option===l ? '#86efac' : C.border }}
              value={row[`option_${l.toLowerCase()}`] || ''}
              onChange={e => onChange(index, `option_${l.toLowerCase()}`, e.target.value)}
              placeholder={`Option ${l}`} />
            <input style={{ ...iS, marginTop:4, fontFamily:mayekFontFamily(row.question_mayek_font) }}
              value={row[`option_${l.toLowerCase()}_mayek`] || ''}
              onChange={e => onChange(index, `option_${l.toLowerCase()}_mayek`, e.target.value)}
              placeholder={`Option ${l} (Meitei Mayek, optional)`} />
          </div>
        ))}
      </div>
      <div className="qb-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
        <div>
          <label style={lS}>Correct Answer *</label>
          <select style={iS} value={row.correct_option}
            onChange={e => onChange(index,'correct_option',e.target.value)}>
            <option value="">Select</option>
            {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Difficulty</label>
          <select style={iS} value={row.difficulty}
            onChange={e => onChange(index,'difficulty',e.target.value)}>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Marks</label>
          <select style={iS} value={row.marks}
            onChange={e => onChange(index,'marks',parseInt(e.target.value))}>
            {MARKS_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {showImageUpload && (
          <div>
            <label style={lS}>Diagram (optional)</label>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <button type="button" onClick={() => fileRef.current?.click()} style={btnSm('#eff6ff', C.navy)}>
                {row.diagram_url ? '🔄 Change' : '📎 Upload'}
              </button>
              {row.diagram_url && (
                <a href={row.diagram_url} target="_blank" rel="noreferrer"
                  style={{ fontSize:11, color:C.green }}>✅ View</a>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display:'none' }} onChange={handleImageUpload} />
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: MANUAL ADD
// Patch: StudyMaterialsRefPanel + emit QUESTION_SAVED after save
// ══════════════════════════════════════════════════════════════════════════════
// Emits one QUESTION_SAVED per distinct subject+chapter actually saved —
// a single event carrying only the first row's (or the batch-level,
// possibly blank) chapter left StudyMaterial badges for every other
// chapter in the batch stale.
function emitQuestionsSaved(rows) {
  const groups = new Map()
  for (const r of rows) {
    const key = `${r.subject}|${r.chapter}`
    const g = groups.get(key) || { subject: r.subject, chapter: r.chapter, count: 0 }
    g.count++
    groups.set(key, g)
  }
  for (const g of groups.values()) EventBus.emit(GNSI_EVENTS.QUESTION_SAVED, g)
}

// Fields a bulk-paste "Replace Existing" is allowed to write. Pasted rows
// carry blanks for anything the paste didn't contain (diagram_url: '',
// question_mayek: '', unmarked correct_option: '' …); writing those blanks
// over the existing row wiped its diagram, Mayek text and answer. Only
// non-empty values from the paste are applied.
function replacePayload(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === '' || v === null || v === undefined) continue
    out[k] = v
  }
  // question_mayek_font only makes sense alongside the text it describes.
  if (!out.question_mayek) delete out.question_mayek_font
  return out
}

const emptyRow = () => ({
  course:'', subject:'', chapter:'', subsection:'', question:'', question_mayek:'',
  option_a:'', option_b:'', option_c:'', option_d:'',
  option_a_mayek:'', option_b_mayek:'', option_c_mayek:'', option_d_mayek:'',
  correct_option:'', difficulty:'Medium', marks:1, diagram_url:'',
})

function TabManualAdd({ questions, refetch, showToast, onNavigate }) {
  const [rows,   setRows]   = useState([emptyRow()])
  const [saving, setSaving] = useState(false)

  const updateRow = (i, key, val) =>
    setRows(prev => prev.map((r, idx) => idx===i ? {...r,[key]:val} : r))
  const addRow    = () => setRows(prev => [...prev, emptyRow()])
  // Diagrams uploaded for rows that are discarded before saving would
  // otherwise sit in storage forever with nothing pointing at them.
  const removeRow = (i) => {
    if (rows[i]?.diagram_url) removeDiagrams([rows[i].diagram_url])
    setRows(prev => prev.filter((_,idx) => idx!==i))
  }
  const clearAll = () => {
    removeDiagrams(rows.map(r => r.diagram_url).filter(Boolean))
    setRows([emptyRow()])
  }

  // Subject and chapter of first row — drives the reference panel
  const refSubject = rows[0]?.subject
  const refChapter = rows[0]?.chapter

  const handleSave = async () => {
    const invalid = rows.filter(r => !r.course || !r.subject || !r.chapter || !r.question || !r.option_a || !r.option_b || !r.correct_option)
    if (invalid.length) { showToast(`${invalid.length} row(s) incomplete — fill all required fields`, C.amber); return }

    setSaving(true)
    // ── Duplicate check — feature #6 ──
    // Checked against the live bank for these chapters (falls back to the
    // cached list if that lookup fails), and also catches the same
    // question entered twice in this form.
    const live = await fetchLiveDupPool(rows)
    const dupes = findDuplicates(rows, live || questions || [])
    if (dupes.length) {
      const inBank  = dupes.filter(d => d.existingId !== undefined).map(d => d.index + 1)
      const inForm  = dupes.filter(d => d.batchDupOf !== undefined).map(d => d.index + 1)
      const parts = []
      if (inBank.length) parts.push(`${inBank.length} look identical to ones already in the bank (Q${inBank.join(', Q')})`)
      if (inForm.length) parts.push(`${inForm.length} repeat an earlier row in this form (Q${inForm.join(', Q')})`)
      const go = confirm(`${parts.join('; ')}. Save anyway?`)
      if (!go) { setSaving(false); return }
    }

    const payload = rows.map(r => ({
      ...r,
      subsection: r.subsection || detectSubsection(r.question, r.subject),
    }))
    const { error } = await supabase.from('qbank_questions').insert(payload)
    if (error) { showToast('Save failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ ${rows.length} question(s) saved!`, C.green)
    // ── PATCH: notify StudyMaterial badges (one event per chapter saved) ──
    emitQuestionsSaved(rows)
    setRows([emptyRow()]); refetch(true)
    setSaving(false)
  }

  return (
    <div style={cardS}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.navy }}>✏️ Manual Add</div>
          <div style={{ fontSize:12, color:C.slate, marginTop:2 }}>
            Add {rows.length} question{rows.length>1?'s':''} — fractions: write as 5/4 or 2 1/3
          </div>
        </div>
        <button onClick={addRow} style={btn(C.teal)}>+ Add Another Row</button>
      </div>

      {/* ── PATCH: reference panel shows study materials for the active chapter ── */}
      <StudyMaterialsRefPanel course={rows[0]?.course} subject={refSubject} chapter={refChapter} onNavigate={onNavigate} />

      {rows.map((row, i) => (
        <QuestionRowForm key={i} row={row} index={i}
          onChange={updateRow} onRemove={rows.length>1?removeRow:null}
          showImageUpload showToast={showToast} />
      ))}

      <div style={{ display:'flex', gap:10, marginTop:16 }}>
        <button onClick={handleSave} disabled={saving} style={btn(C.navy, saving)}>
          {saving ? '⏳ Saving…' : `✅ Save ${rows.length} Question${rows.length>1?'s':''}`}
        </button>
        <button onClick={clearAll} style={btn(C.slate)}>🔄 Clear All</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: BULK PASTE
// Patch: StudyMaterialsRefPanel + emit QUESTION_SAVED after save
// ══════════════════════════════════════════════════════════════════════════════
function TabBulkPaste({ questions, refetch, showToast, onNavigate }) {
  const [rawText,       setRawText]       = useState('')
  const [answerKeyText, setAnswerKeyText] = useState('')
  const [bulkCourse,    setBulkCourse]    = useState('')
  const [bulkSubject,   setBulkSubject]   = useState('')
  const [bulkChapter,   setBulkChapter]   = useState('')
  const [extracted,     setExtracted]     = useState([])
  const [showAnswerKey, setShowAnswerKey] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [step,          setStep]          = useState(1)
  const bulkSubjectList = bulkCourse ? Object.keys(COURSES[bulkCourse]?.subjects || {}) : []
  const chapters = bulkCourse ? (COURSES[bulkCourse]?.subjects[bulkSubject] || []) : []

  // Extra existing rows fetched live at save time (see fetchLiveDupPool) —
  // merged into the duplicate pool so matches the cached list missed
  // surface in the review UI.
  const [liveExisting, setLiveExisting] = useState([])

  // dupeByIndex: Map<row index, { existingId, batchDupOf }> for every row
  // findDuplicates flagged — carries the matched existing row's id forward
  // so a per-row "Replace" action knows exactly which bank row to update.
  const dupeByIndex = useMemo(() => {
    if (!extracted.length) return new Map()
    const known = new Set((questions || []).map(q => q.id))
    const pool = [...(questions || []), ...liveExisting.filter(q => !known.has(q.id))]
    const map = new Map()
    findDuplicates(extracted, pool).forEach(d => map.set(d.index, { existingId: d.existingId, batchDupOf: d.batchDupOf }))
    return map
  }, [extracted, questions, liveExisting])
  const dupeIndexSet = useMemo(() => new Set(dupeByIndex.keys()), [dupeByIndex])

  // Per-row action for flagged duplicates: 'ask' (default, unresolved),
  // 'skip' (don't save this row), 'new' (save as an additional row
  // despite the match), 'replace' (update the existing row in place
  // instead of inserting). Keyed by row index; only meaningful for rows
  // dupeIndexSet flags — non-duplicate rows are always saved as new
  // regardless of what (if anything) is in this map.
  const [dupeActions, setDupeActions] = useState({})
  // Reset per-row choices whenever a new batch is loaded (new extract,
  // re-paste, CSV re-upload) so a stale choice from a previous batch
  // never silently carries over onto a different set of rows.
  // A NEW batch replacing the review list (extract, CSV, partial-save
  // cleanup) resets per-row duplicate choices — and only then, not on
  // every answer/tag edit to a row.
  const loadBatch = (rows) => { setExtracted(rows); setDupeActions({}); setLiveExisting([]) }

  const setDupeAction = (idx, action) => setDupeActions(prev => ({ ...prev, [idx]: action }))
  const setAllDupeActions = action => {
    const next = {}
    dupeIndexSet.forEach(idx => {
      // A repeat inside this paste has no existing bank row to replace —
      // "Replace All" skips it (the first copy is still saved/replaced).
      next[idx] = action === 'replace' && !dupeByIndex.get(idx)?.existingId ? 'skip' : action
    })
    setDupeActions(next)
  }

  const handleExtract = () => {
    if (!rawText.trim()) { showToast('Paste some text first', C.amber); return }
    const parsed = parseQuestions(rawText)
    if (!parsed.length) { showToast('No questions detected — check the format', C.rose); return }
    const tagged = parsed.map(q => ({
      ...q,
      course: bulkCourse || '',
      subject: bulkSubject || '',
      // If the teacher pre-picked a chapter for the whole batch, every row
      // uses it (existing behaviour, unchanged). Otherwise try to detect
      // each row's chapter individually from its own question text — bulk
      // pastes often mix chapters within one paste, so a single global
      // pick isn't always right; per-row detection covers that case.
      chapter: bulkChapter || (bulkCourse && bulkSubject ? (detectChapter(q.question, bulkCourse, bulkSubject) || '') : ''),
      subsection: q._subsectionHint
        ? q._subsectionHint
        : (bulkSubject ? detectSubsection(q.question, bulkSubject) : ''),
    }))
    loadBatch(tagged)
    setStep(2)
    showToast(`✨ ${tagged.length} questions extracted!`, C.green)
  }

  // ── CSV import — feature #5 ──
  const csvFileRef = useRef()
  const handleCSVFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCSVQuestions(ev.target.result, bulkCourse, bulkSubject, bulkChapter)
      if (!parsed.length) { showToast('No valid rows found — check your CSV has a "question" column', C.rose); return }
      const tagged = parsed.map(q => ({
        ...q,
        subsection: q.subsection || (q.subject ? detectSubsection(q.question, q.subject) : ''),
      }))
      loadBatch(tagged)
      setStep(2)
      showToast(`✨ ${tagged.length} questions imported from CSV!`, C.green)
    }
    reader.onerror = () => showToast('Failed to read file', C.rose)
    reader.readAsText(file)
    e.target.value = ''
  }

  const applyAnswerKey = () => {
    if (!answerKeyText.trim()) return
    const keyMap = parseAnswerKey(answerKeyText)
    const matchedCount = extracted.filter(q => keyMap[q._qNum] !== undefined).length
    if (!matchedCount) { showToast('No matching question numbers found in answer key', C.amber); return }
    const overwriteCount = extracted.filter(q => keyMap[q._qNum] !== undefined && q.correct_option && q.correct_option !== keyMap[q._qNum]).length
    const proceed = overwriteCount > 0
      ? confirm(`This will set answers for ${matchedCount} question(s), overwriting ${overwriteCount} that already have a different answer marked. Continue?`)
      : confirm(`Apply this answer key to ${matchedCount} question(s)?`)
    if (!proceed) return
    setExtracted(prev => prev.map(q => ({
      ...q,
      correct_option: keyMap[q._qNum] !== undefined ? keyMap[q._qNum] : (q.correct_option || ''),
    })))
    showToast(`Answer key applied to ${matchedCount} questions`, C.green)
    setShowAnswerKey(false)
  }

  const updateQ = (idx, field, val) =>
    setExtracted(prev => prev.map((q,i) => i===idx ? {...q,[field]:val} : q))

  const setAnswer = (idx, ans) => updateQ(idx, 'correct_option', ans)

  const handleSave = async () => {
    const invalid = extracted.filter(q => !q.course || !q.subject || !q.chapter)
    if (invalid.length) { showToast(`${invalid.length} questions missing course/subject/chapter`, C.amber); return }
    const noAnswer = extracted.filter(q => !q.correct_option)
    if (noAnswer.length > 0) {
      const go = confirm(`${noAnswer.length} questions have no answer marked. Save anyway?`)
      if (!go) return
    }
    // ── Duplicate check — every flagged row needs a resolved action
    // (Skip / Save as New / Replace) before saving. Unlike the old
    // single confirm(), this can't silently default an unresolved
    // duplicate into "save as new" — the whole point of offering
    // Replace is to make it easy to correct an existing row, and
    // silently duplicating it instead defeats that.
    const unresolved = [...dupeIndexSet].filter(idx => !dupeActions[idx] || dupeActions[idx] === 'ask')
    if (unresolved.length) {
      showToast(`${unresolved.length} duplicate question(s) still need Skip / New / Replace chosen`, C.amber)
      return
    }

    setSaving(true)

    // Re-check duplicates against the LIVE bank for these chapters — the
    // cached list can be minutes old and never has other users' inserts.
    // Any newly found duplicate goes back to the review list for a
    // Skip / New / Replace choice instead of being saved blind.
    const live = await fetchLiveDupPool(extracted)
    if (live) {
      const known = new Set((questions || []).map(q => q.id))
      const newlyFound = findDuplicates(extracted, [...(questions || []), ...live.filter(q => !known.has(q.id))])
        .filter(d => !dupeIndexSet.has(d.index))
      if (newlyFound.length) {
        setLiveExisting(live)
        showToast(`${newlyFound.length} more duplicate(s) found in the live bank — choose Skip / New / Replace for them`, C.amber)
        setSaving(false)
        return
      }
    }

    // eslint-disable-next-line no-unused-vars -- the _fields are dropped on purpose
    const strip = ({ _id, _qNum, _subsectionHint, _needsDiagram, ...rest }) => ({
      ...rest,
      subsection: rest.subsection || detectSubsection(rest.question, rest.subject) || 'General',
    })

    const toInsert = []  // { idx, payload }
    const toReplace = [] // { idx, id, payload }
    extracted.forEach((q, i) => {
      const action = dupeIndexSet.has(i) ? dupeActions[i] : null
      if (action === 'skip') return
      const existingId = dupeByIndex.get(i)?.existingId
      if (action === 'replace' && existingId) toReplace.push({ idx: i, id: existingId, payload: replacePayload(strip(q)) })
      else toInsert.push({ idx: i, payload: strip(q) }) // covers 'new' and every non-duplicate row
    })

    if (toInsert.length === 0 && toReplace.length === 0) {
      showToast('Nothing to save — every row was skipped', C.amber)
      setSaving(false)
      return
    }

    // Indices of rows that are now in the bank. If a later step fails,
    // these are removed from the review list so pressing Save again can't
    // insert them a second time.
    const savedIdx = new Set()
    const failPartway = (msg) => {
      const savedRows = extracted.filter((_, i) => savedIdx.has(i))
      if (savedRows.length) emitQuestionsSaved(savedRows)
      loadBatch(extracted.filter((_, i) => !savedIdx.has(i)))
      refetch(true)
      showToast(
        savedIdx.size
          ? `${msg} — ${savedIdx.size} question(s) were already saved and removed from this list; review the rest and save again`
          : msg,
        C.rose
      )
      setSaving(false)
    }

    if (toInsert.length) {
      // A single insert call is atomic: either every row lands or none do.
      const { error } = await supabase.from('qbank_questions').insert(toInsert.map(t => t.payload))
      if (error) { showToast('Save failed: ' + error.message, C.rose); setSaving(false); return }
      toInsert.forEach(t => savedIdx.add(t.idx))
    }
    // Replacements go one at a time (not a single batch update) since
    // each row targets a DIFFERENT existing id with different content —
    // Supabase's .update() applies one payload to a filtered set, so N
    // distinct replacements genuinely need N distinct calls.
    for (const { idx, id, payload } of toReplace) {
      const { data, error } = await supabase.from('qbank_questions').update(payload).eq('id', id).select('id')
      if (error) { failPartway(`Replace failed for Q${extracted[idx]._qNum || idx + 1}: ${error.message}`); return }
      if (!data?.length) { failPartway(`Q${extracted[idx]._qNum || idx + 1}: the question it was meant to replace no longer exists, or you don't have permission to edit it`); return }
      savedIdx.add(idx)
    }

    const savedCount = toInsert.length + toReplace.length
    const skippedCount = extracted.length - savedCount
    showToast(
      `✅ ${toInsert.length} added${toReplace.length ? `, ${toReplace.length} replaced` : ''}${skippedCount ? `, ${skippedCount} skipped` : ''}`,
      C.green
    )
    // ── PATCH: notify StudyMaterial badges (one event per chapter saved) ──
    emitQuestionsSaved(extracted.filter((_, i) => savedIdx.has(i)))
    loadBatch([]); setRawText(''); setAnswerKeyText(''); setStep(1); refetch(true)
    setSaving(false)
  }

  return (
    <>
      {/* Step 1 — Paste */}
      {step === 1 && (
        <div style={cardS}>
          <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:4 }}>📤 Bulk Paste</div>
          <div style={{ fontSize:12, color:C.slate, marginBottom:16 }}>
            Paste any question paper format — app detects questions, options and subsections automatically
          </div>

          <div className="qb-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14,
            padding:'12px 14px', borderRadius:9, background:'#f8fafc', border:`1px solid ${C.border}` }}>
            <div>
              <label style={lS}>Assign Course to all</label>
              <select style={iS} value={bulkCourse}
                onChange={e => { setBulkCourse(e.target.value); setBulkSubject(''); setBulkChapter('') }}>
                <option value="">— Select Course —</option>
                {COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}
              </select>
            </div>
            <div>
              <label style={lS}>Assign Subject to all</label>
              <select style={{ ...iS, opacity: bulkCourse?1:.5 }} value={bulkSubject}
                onChange={e => { setBulkSubject(e.target.value); setBulkChapter('') }}
                disabled={!bulkCourse}>
                <option value="">— Select Subject —</option>
                {bulkSubjectList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lS}>Assign Chapter to all</label>
              <select style={{ ...iS, opacity: bulkSubject?1:.5 }} value={bulkChapter}
                onChange={e => setBulkChapter(e.target.value)} disabled={!bulkSubject}>
                <option value="">— Select Chapter —</option>
                {chapters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* ── PATCH: reference panel ── */}
          <StudyMaterialsRefPanel course={bulkCourse} subject={bulkSubject} chapter={bulkChapter} onNavigate={onNavigate} />

          <label style={lS}>Paste Question Paper Text *</label>
          <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={14}
            style={{ ...iS, resize:'vertical', fontFamily:'monospace', fontSize:12, marginBottom:14 }}
            placeholder={`Supported formats — any of these work:

1. Which of the following is an improper fraction?
(a) 2/3  (b) 16/17  (c) 5/4  (d) 19/50

Q2. What is 1/2 + 1/3?
A) 2/5   B) 5/6   C) 1/6   D) 3/5
Answer: B`} />

          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={handleExtract} disabled={!rawText.trim()} style={btn(C.navy, !rawText.trim())}>
              🔍 Extract Questions
            </button>
            <button onClick={() => setRawText('')} style={btn(C.slate)}>Clear</button>
            <span style={{ alignSelf:'center', fontSize:11, color:C.slate }}>or</span>
            <button onClick={() => csvFileRef.current?.click()} style={btn(C.teal)}>
              📊 Import CSV
            </button>
            <input ref={csvFileRef} type="file" accept=".csv,text/csv" style={{ display:'none' }} onChange={handleCSVFile} />
          </div>
          <div style={{ fontSize:11, color:C.slate }}>
            CSV columns: question, option_a, option_b, option_c, option_d, correct_option, subject, chapter, subsection, difficulty, marks — only "question" is required.
          </div>
        </div>
      )}

      {/* Step 2 — Review + Mark Answers (unchanged) */}
      {step === 2 && extracted.length > 0 && (
        <div>
          <div style={{ ...cardS, borderLeft:`4px solid ${C.green}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:C.navy }}>
                  ✅ {extracted.length} questions extracted
                </div>
                <div style={{ fontSize:12, color:C.slate, marginTop:2 }}>
                  Review each question, mark correct answer, then save
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={() => setShowAnswerKey(v=>!v)} style={btn(C.indigo)}>
                  📋 {showAnswerKey ? 'Hide' : 'Upload'} Answer Key
                </button>
                <button onClick={() => setStep(1)} style={btn(C.slate)}>← Back</button>
              </div>
            </div>

            {showAnswerKey && (
              <div style={{ marginTop:14, padding:'12px 14px', borderRadius:8, background:'#f0f9ff', border:'1px solid #bae6fd' }}>
                <label style={{ ...lS, color:'#0369a1' }}>
                  Paste Answer Key — any format works:
                  <span style={{ fontWeight:400, marginLeft:6 }}>
                    "1-b, 2-c, 3-a" or "1. B  2. C  3. A" or "Q1:B Q2:C"
                  </span>
                </label>
                <textarea value={answerKeyText} onChange={e => setAnswerKeyText(e.target.value)} rows={4}
                  style={{ ...iS, fontFamily:'monospace', fontSize:12, marginBottom:8 }}
                  placeholder="1-b, 2-c, 3-d, 4-a, 5-b..." />
                <button onClick={applyAnswerKey} style={btn(C.green)}>✓ Apply Answer Key</button>
              </div>
            )}

            <div style={{ marginTop:12, display:'flex', gap:16, fontSize:12, flexWrap:'wrap' }}>
              <span style={{ color:C.green }}>✅ {extracted.filter(q=>q.correct_option).length} answered</span>
              <span style={{ color:C.rose }}>❌ {extracted.filter(q=>!q.correct_option).length} unanswered</span>
              <span style={{ color:C.amber }}>⚠️ {extracted.filter(q=>q._needsDiagram).length} need diagram</span>
            </div>

            {dupeIndexSet.size > 0 && (
              <div style={{ marginTop:12, padding:'10px 14px', borderRadius:8, background:'#fffbeb', border:'1px solid #fde68a',
                display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>
                  ⚠️ {dupeIndexSet.size} possible duplicate{dupeIndexSet.size!==1?'s':''} found
                </span>
                <span style={{ fontSize:11, color:'#92400e' }}>Apply to all:</span>
                <button onClick={() => setAllDupeActions('skip')} style={btnSm('#fff', '#92400e')}>Skip All</button>
                <button onClick={() => setAllDupeActions('new')} style={btnSm('#fff', '#92400e')}>Save All as New</button>
                <button onClick={() => setAllDupeActions('replace')} style={btnSm(C.amber)}>Replace All</button>
                {Object.keys(dupeActions).length > 0 && (
                  <button onClick={() => setDupeActions({})} style={btnSm('#fff', C.slate)}>Reset choices</button>
                )}
              </div>
            )}
          </div>

          {extracted.map((q, i) => (
            <div key={i} style={{ ...cardS, marginBottom:10, padding:'14px 16px',
              border: dupeIndexSet.has(i) ? `1px solid ${C.amber}` : q.correct_option ? `1px solid #86efac` : `1px solid ${C.rose}44`,
              background: q._needsDiagram ? '#fffbeb' : '#fff' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.slate }}>Q{q._qNum || i+1}</span>
                {dupeIndexSet.has(i) && (
                  dupeByIndex.get(i)?.existingId
                    ? <Badge text="⚠️ Possible duplicate — already in bank" color="#92400e" bg="#fef3c7" />
                    : <Badge text={`⚠️ Repeated in this paste — same as Q${extracted[dupeByIndex.get(i).batchDupOf]?._qNum || dupeByIndex.get(i).batchDupOf + 1}`} color="#92400e" bg="#fef3c7" />
                )}
                {q._needsDiagram && (
                  <Badge text="⚠️ Needs Diagram — add image later via Bank tab" color="#92400e" bg="#fef3c7" />
                )}
                {q._subsectionHint && (
                  <Badge text={`Section: ${q._subsectionHint}`} color="#0369a1" bg="#e0f2fe" />
                )}
                {q.question_mayek && (
                  <Badge text="🈯 Meetei Mayek text detected" color="#065f46" bg="#d1fae5" />
                )}
              </div>
              {dupeIndexSet.has(i) && (
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:10,
                  padding:'7px 10px', borderRadius:7, background:'#fffbeb', border:'1px solid #fde68a' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#92400e' }}>This question:</span>
                  {[
                    { key:'skip',    label:'Skip' },
                    { key:'new',     label:'Save as New' },
                    // Only a match against an existing bank row can be
                    // replaced; a repeat within this paste has nothing to replace.
                    ...(dupeByIndex.get(i)?.existingId ? [{ key:'replace', label:'Replace Existing (fills in non-blank fields)' }] : []),
                  ].map(({key, label}) => (
                    <button key={key} onClick={() => setDupeAction(i, key)}
                      style={{
                        padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
                        border:`1px solid ${dupeActions[i]===key ? '#92400e' : '#fde68a'}`,
                        background: dupeActions[i]===key ? '#92400e' : '#fff',
                        color: dupeActions[i]===key ? '#fff' : '#92400e',
                      }}>
                      {label}
                    </button>
                  ))}
                  {!dupeActions[i] && (
                    <span style={{ fontSize:10.5, color:'#b45309', fontStyle:'italic' }}>— choose one before saving</span>
                  )}
                </div>
              )}
              <div style={{ fontSize:13, fontWeight:500, color:'#1e293b', marginBottom:q.question_mayek ? 4 : 10, lineHeight:1.6 }}>
                {q.question}
              </div>
              {q.question_mayek && (
                <div style={{ fontSize:14, color:'#374151', marginBottom:10, lineHeight:1.7, fontFamily:mayekFontFamily(q.question_mayek_font) }}>
                  <MayekText text={q.question_mayek} font={q.question_mayek_font} />
                </div>
              )}
              <div className="qb-opts" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:10 }}>
                {['A','B','C','D'].map(l => (
                  <div key={l} style={{ padding:'5px 10px', borderRadius:6, fontSize:12,
                    background: q.correct_option===l ? '#dcfce7' : '#f8fafc',
                    border:`1px solid ${q.correct_option===l ? '#86efac' : C.border}` }}>
                    <span style={{ fontWeight:700, marginRight:5 }}>{l}.</span>
                    {q[`option_${l.toLowerCase()}`] || '—'}
                    {q.correct_option===l && ' ✓'}
                    {q[`option_${l.toLowerCase()}_mayek`] && (
                      <div style={{ fontFamily:mayekFontFamily(q.question_mayek_font), marginTop:2 }}>
                        <MayekText text={q[`option_${l.toLowerCase()}_mayek`]} font={q.question_mayek_font} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.slate }}>Mark Answer:</span>
                {['A','B','C','D'].map(l => (
                  <button key={l} onClick={() => setAnswer(i, l)}
                    style={{ padding:'4px 14px', borderRadius:6, border:`2px solid ${q.correct_option===l?C.green:C.border}`,
                      background: q.correct_option===l ? '#dcfce7' : '#fff',
                      color: q.correct_option===l ? C.green : C.slate,
                      fontWeight:700, cursor:'pointer', fontSize:13 }}>
                    {l}
                  </button>
                ))}
                {q.correct_option && (
                  <button onClick={() => setAnswer(i,'')} style={btnSm('#f1f5f9', C.slate)}>✖ Clear</button>
                )}
              </div>
              <div className="qb-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:6 }}>
                <select style={{ ...iS, fontSize:11, padding:'4px 8px' }} value={q.course || ''}
                  onChange={e => { updateQ(i,'course',e.target.value); updateQ(i,'subject',''); updateQ(i,'chapter','') }}>
                  <option value="">Course?</option>
                  {COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}
                </select>
                <select style={{ ...iS, fontSize:11, padding:'4px 8px', opacity:q.course?1:.5 }} value={q.subject}
                  onChange={e => updateQ(i,'subject',e.target.value)} disabled={!q.course}>
                  <option value="">Subject?</option>
                  {(q.course ? Object.keys(COURSES[q.course]?.subjects || {}) : []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select style={{ ...iS, fontSize:11, padding:'4px 8px', opacity:q.subject?1:.5 }}
                  value={q.chapter} onChange={e => updateQ(i,'chapter',e.target.value)} disabled={!q.subject}>
                  <option value="">Chapter?</option>
                  {(q.course ? (COURSES[q.course]?.subjects[q.subject] || []) : []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select style={{ ...iS, fontSize:11, padding:'4px 8px', opacity:q.subject?1:.5 }}
                  value={q.subsection} onChange={e => updateQ(i,'subsection',e.target.value)} disabled={!q.subject}>
                  <option value="">Subsection (auto)</option>
                  {Object.keys(SUBSECTION_KEYWORDS[q.subject]||{}).map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="General">General</option>
                </select>
                <select style={{ ...iS, fontSize:11, padding:'4px 8px' }} value={q.difficulty}
                  onChange={e => updateQ(i,'difficulty',e.target.value)}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          ))}

          <div style={{ display:'flex', gap:10, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={handleSave} disabled={saving} style={btn(C.green, saving)}>
              {saving ? '⏳ Saving…' : `✅ Save ${extracted.length} Question${extracted.length!==1?'s':''} to Bank`}
            </button>
            <span style={{ fontSize:12, color:C.slate }}>
              {extracted.filter(q=>!q.correct_option).length > 0
                ? `⚠️ ${extracted.filter(q=>!q.correct_option).length} without answer`
                : '✅ All answered'}
            </span>
            {(() => {
              const unresolved = [...dupeIndexSet].filter(idx => !dupeActions[idx] || dupeActions[idx] === 'ask').length
              return unresolved > 0 ? (
                <span style={{ fontSize:12, color:'#92400e', fontWeight:700 }}>
                  ⚠️ {unresolved} duplicate{unresolved!==1?'s':''} need Skip/New/Replace chosen
                </span>
              ) : null
            })()}
          </div>
        </div>
      )}
    </>
  )
}

// ── PDF GENERATOR ─────────────────────────────────────────────────────────────
// Meitei Mayek font (base64, embedded once per file load) — needed because
// jsPDF's built-in fonts (Helvetica/Times/Courier) contain no Mayek glyphs.
// Source: Noto Sans Meetei Mayek Regular, SIL Open Font License 1.1
// https://github.com/notofonts/meetei-mayek
import { NotoSansMeeteiMayek } from './NotoSansMeeteiMayek-normal.js'

// jsPDF's virtual file system is per document, so the font is registered
// on every new doc.
function registerMayekFonts(doc) {
  doc.addFileToVFS('NotoSansMeeteiMayek.ttf', NotoSansMeeteiMayek)
  doc.addFont('NotoSansMeeteiMayek.ttf', 'NotoMayek', 'normal')
}
// BMEI04 rows (question_mayek_font === 'bmei04') are stored as legacy
// keystroke text. Drawing that raw text in the Unicode Noto font printed
// Latin garbage, and the BMEI04 TTF itself can't be embedded (jsPDF
// rejects it: it has no Unicode cmap). So it is converted to Unicode
// Meetei Mayek with the same converter the Mayek Tool uses.
const pdfMayekText = (text, fontTag) => slideMayekUnicode(text, fontTag)

// The Noto Meetei Mayek font has no Latin letters, digits or ASCII
// punctuation. jsPDF silently dropped the rest of a line after the first
// such character ("ꯍꯤꯟꯗꯨ-ꯑꯔꯥꯕꯤꯛ …" printed as just "ꯍꯤꯟꯗꯨ"), so each line
// is drawn in runs: Meetei Mayek in NotoMayek, everything else in Helvetica.
const MAYEK_CHAR = /[\uAAE0-\uAAFF\uABC0-\uABFF]/
function drawMayekLines(doc, lines, x, y, size, lineH) {
  lines.forEach((line, i) => {
    const runs = []
    for (const ch of line) {
      const kind = /\s/.test(ch) ? (runs.length ? runs[runs.length - 1].kind : 'm') : MAYEK_CHAR.test(ch) ? 'm' : 'l'
      if (runs.length && runs[runs.length - 1].kind === kind) runs[runs.length - 1].text += ch
      else runs.push({ kind, text: ch })
    }
    let cx = x
    runs.forEach(r => {
      doc.setFontSize(size); doc.setFont(r.kind === 'm' ? 'NotoMayek' : 'helvetica', 'normal')
      doc.text(r.kind === 'l' ? pdfSafe(r.text) : r.text, cx, y + i * lineH)
      cx += doc.getTextWidth(r.kind === 'l' ? pdfSafe(r.text) : r.text)
    })
  })
}

// Fetches a diagram image URL and converts it to a base64 data URL so jsPDF's
// addImage() can embed it (addImage cannot fetch remote URLs itself). Returns
// null on any failure so the caller can skip the image without breaking the PDF.
async function fetchImageAsDataURL(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

// Paper layout options (Create Paper → Layout):
//   columns 1 | 2 · optionCols 'auto' | 4 | 2 | 1 · spacing 'normal' | 'compact'
//   font 'helvetica' | 'times' | 'courier' · size 'S' | 'M' | 'L'
const PAPER_LAYOUT_DEFAULT = { columns: 1, optionCols: 'auto', spacing: 'normal', font: 'helvetica', size: 'M' }
const PAPER_FONT_CSS = { helvetica: 'Helvetica, Arial, sans-serif', times: "'Times New Roman', Times, serif", courier: "'Courier New', Courier, monospace" }
const PAPER_SIZE_PT = { S: 9, M: 10.5, L: 12 }

async function generatePDF({ title, subject, chapter, questions, sets, withAnswers, timeMinutes, instructions, layout = PAPER_LAYOUT_DEFAULT, options = {}, fileName }) {
  // Bundled npm dependency (same one Reports.jsx etc. use), loaded lazily —
  // no runtime CDN script, so PDFs work offline and can't be tampered with
  // by a compromised CDN.
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  registerMayekFonts(doc)
  const O = { ...PAPER_OPTIONS_DEFAULT, ...options }
  if (withAnswers) O.answerKey = 'inline'
  const SETS = sets?.length ? sets : [{ code: 'A', questions: questions || [] }]
  const multi = SETS.length > 1
  const allQs = SETS[0].questions
  // Helvetica text goes through pdfSafe (see helper) so symbols outside
  // its character set are spelled out instead of printing as garbage.
  title = pdfSafe(title); subject = pdfSafe(subject); chapter = pdfSafe(chapter)
  instructions = instructions ? pdfSafe(instructions) : instructions
  const dateText = O.paperDate ? new Date(O.paperDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : today()

  // Pre-fetch diagram images so they can be embedded synchronously during layout
  const diagramCache = {}
  await Promise.all(
    allQs.filter(q => q.diagram_url).map(async q => {
      diagramCache[q.id || q._id] = await fetchImageAsDataURL(q.diagram_url)
    })
  )

  const W = 210, H = 297, margin = 16
  const contentW = W - margin*2
  const HEADER_H = 40   // letterhead block height, repeated on every page
  const FOOTER_Y = H - 12
  const inline = O.answerKey === 'inline'

  // ── Letterhead — drawn identically on every page ──────────────────────────
  const drawLetterhead = (pageLabel) => {
    doc.setFillColor(30,58,95); doc.rect(0, 0, W, 26, 'F')
    doc.setDrawColor(201,162,75); doc.setLineWidth(1)
    doc.line(0, 26, W, 26)
    doc.setFillColor(201,162,75); doc.line(0, 27.3, W, 27.3) // thin gold accent line

    // Crest circle (initials monogram, no external image dependency)
    doc.setFillColor(255,255,255); doc.circle(margin+6, 13, 6.5, 'F')
    doc.setTextColor(30,58,95); doc.setFontSize(10); doc.setFont('helvetica','bold')
    doc.text('GN', margin+6, 12, { align:'center' })
    doc.text('SI', margin+6, 16.3, { align:'center' })

    doc.setTextColor(255,255,255)
    doc.setFontSize(15); doc.setFont('helvetica','bold')
    doc.text(pdfSafe(O.institute || 'Guidance Navodaya & Sainik Institute'), margin+16, 11)
    doc.setFontSize(8.5); doc.setFont('helvetica','normal')
    doc.text(pdfSafe(O.tagline || ''), margin+16, 16.5)
    doc.setFontSize(7.5)
    doc.text('AISSEE · JNVST · RMS Entrance Preparation', margin+16, 21.5)

    if (pageLabel) {
      doc.setFontSize(multi && /^SET/.test(pageLabel) ? 13 : 8); doc.setFont('helvetica','bold')
      doc.text(pageLabel, W-margin, 11.5, { align:'right' })
    }
    doc.setFontSize(7.5); doc.setFont('helvetica','normal')
    doc.text(`Date: ${dateText}`, W-margin, 18, { align:'right' })
  }

  // Diagonal watermark, drawn last on every page so it sits over the page
  // but in a very light tint.
  const drawWatermark = () => {
    if (!O.watermark) return
    doc.saveGraphicsState?.()
    try { doc.setGState?.(new doc.GState({ opacity: 0.08 })) } catch { /* old jsPDF — plain light grey */ }
    doc.setTextColor(150,160,175); doc.setFont('helvetica','bold'); doc.setFontSize(64)
    doc.text(pdfSafe(O.watermark), W/2, H/2 + 10, { align:'center', angle: 32 })
    doc.restoreGraphicsState?.()
  }

  // ── Footer — drawn identically on every page ──────────────────────────────
  const drawFooter = (pageNum, pageCount) => {
    doc.setDrawColor(226,232,240); doc.setLineWidth(.2)
    doc.line(margin, FOOTER_Y-4, W-margin, FOOTER_Y-4)
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184)
    doc.text('GNSI Question Paper · Confidential — For Institute Use Only', margin, FOOTER_Y)
    doc.text(`Page ${pageNum} of ${pageCount}`, W-margin, FOOTER_Y, { align:'right' })
  }

  // ── Layout ─────────────────────────────────────────────────────────────
  const L = { ...PAPER_LAYOUT_DEFAULT, ...layout }
  const FONT = ['helvetica', 'times', 'courier'].includes(L.font) ? L.font : 'helvetica'
  const qSize = PAPER_SIZE_PT[L.size] || 10.5
  const oSize = qSize - 1
  const lh = pt => pt * 0.44                      // line height (mm) for a font size (pt)
  const compact = L.spacing === 'compact'
  const twoCol = Number(L.columns) === 2
  const gutter = 8
  const colW = twoCol ? (contentW - gutter) / 2 : contentW
  const marksW = 14
  const LETTERS = ['A', 'B', 'C', 'D']
  const optColsFor = q => {
    const present = LETTERS.filter(l => q[`option_${l.toLowerCase()}`])
    if (L.optionCols !== 'auto') return Math.max(1, Math.min(4, Number(L.optionCols) || 2))
    doc.setFontSize(oSize); doc.setFont(FONT, 'normal')
    const widest = Math.max(0, ...present.map(l => doc.getTextWidth(pdfSafe(`${l}.  ${q[`option_${l.toLowerCase()}`]}`))))
    const hasMayek = O.showMayek && present.some(l => q[`option_${l.toLowerCase()}_mayek`])
    if (!hasMayek && widest <= colW / 4 - 3) return 4
    if (widest <= colW / 2 - 4) return 2
    return 1
  }

  let y = HEADER_H
  const renderSet = (set, first) => {
    const label = multi ? `SET ${set.code}` : ''
    if (!first) doc.addPage()
    drawLetterhead(label)
    y = HEADER_H
    const qs = set.questions
    const totalMarks = qs.reduce((s,q) => s + marksOf(q, O), 0)

    // ── Paper title block ─────────────────────────────────────────────────
    doc.setFontSize(15); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
    doc.text(title, W/2, y, { align:'center' }); y += 6
    doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
    doc.text(`Subject: ${subject}   |   Chapter: ${chapter}`, W/2, y, { align:'center' }); y += 5
    if (O.examLine) { doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95); doc.text(pdfSafe(O.examLine), W/2, y, { align:'center' }); y += 5 }
    y += 2

    // ── Student info — only the chosen fields, spread across the width ────
    const FIELDS = [['name','Name',3], ['roll','Roll No.',1.4], ['cls','Class',1.2], ['section','Section',1.2], ['date','Date',1.4], ['sign','Signature',2]].filter(([k]) => O.fields?.[k])
    if (FIELDS.length) {
      const weight = FIELDS.reduce((t, f) => t + f[2], 0)
      doc.setDrawColor(148,163,184); doc.setLineWidth(.3)
      doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59)
      let fx = margin
      FIELDS.forEach(([, lab, w]) => {
        const span = (contentW - (FIELDS.length - 1) * 4) * w / weight
        const lw = doc.getTextWidth(`${lab}:`) + 2
        doc.text(`${lab}:`, fx, y)
        doc.line(fx + lw, y + 0.8, fx + span, y + 0.8)
        fx += span + 4
      })
      y += 9
    }

    // ── Marks / time / instructions box ──────────────────────────────────
    doc.setFillColor(240,246,255); doc.setDrawColor(191,219,254); doc.setLineWidth(.3)
    const boxTop = y
    let baseRules = instructions || 'Attempt all questions. Each question carries the marks shown against it. No negative marking unless stated.'
    if (Number(O.negative) > 0) baseRules = baseRules.replace(/\s*No negative marking unless stated\.?/i, '')
    const rules = [baseRules]
    if (Number(O.negative) > 0) rules.push(pdfSafe(`${O.negative} mark(s) will be deducted for every wrong answer.`))
    const instrLines = doc.splitTextToSize(rules.join(' '), contentW-8)
    const boxH = 14 + instrLines.length*4.2
    doc.roundedRect(margin, boxTop, contentW, boxH, 1.5, 1.5, 'FD')
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
    doc.text(`Time Allowed: ${timeMinutes || Math.max(15, Math.round(qs.length*1.5))} minutes`, margin+4, boxTop+6)
    doc.text(`Maximum Marks: ${totalMarks}`, margin+contentW-4, boxTop+6, { align:'right' })
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(51,65,85)
    doc.text('General Instructions:', margin+4, boxTop+11.5)
    doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105)
    doc.text(instrLines, margin+4, boxTop+16)
    y = boxTop + boxH + 8

    doc.setDrawColor(30,58,95); doc.setLineWidth(.6)
    doc.line(margin, y, W-margin, y); y += 7

    // ── Questions: one or two page columns, each question kept whole ─────
    let col = 0, colTop = y
    const colTops = twoCol ? [{ page: doc.getNumberOfPages(), top: y }] : []
    const colX = () => margin + col * (colW + gutter)
    const place = h => {
      if (y + h <= FOOTER_Y - 6) return
      if (twoCol && col === 0) { col = 1; y = colTop; return }
      doc.addPage(); drawLetterhead(label); y = HEADER_H; colTop = y; col = 0
      if (twoCol) colTops.push({ page: doc.getNumberOfPages(), top: y })
    }

    let n = 0
    groupSections(qs, O.sections).forEach((g, gi) => {
      if (g.name) {
        place(14)
        const x = colX()
        doc.setFillColor(30,58,95); doc.rect(x, y - 4.2, colW, 6.4, 'F')
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
        const secMarks = g.items.reduce((t, q) => t + marksOf(q, O), 0)
        doc.text(pdfSafe(`SECTION ${sectionLetter(gi)} — ${g.name}`).slice(0, twoCol ? 42 : 90), x + 2, y)
        doc.text(`${g.items.length} Q · ${secMarks} marks`, x + colW - 2, y, { align:'right' })
        y += 7
      }
      g.items.forEach(q => {
        n++
        // ── measure ──
        doc.setFontSize(qSize); doc.setFont(FONT, 'bold')
        const qLines = doc.splitTextToSize(pdfSafe(`Q${n}. ${q.question}`), colW - marksW)
        let mLines = []
        if (O.showMayek && q.question_mayek) {
          doc.setFontSize(qSize); doc.setFont('NotoMayek', 'normal')
          mLines = doc.splitTextToSize(pdfMayekText(q.question_mayek, q.question_mayek_font), colW)
        }
        const diagramData = q.diagram_url ? diagramCache[q.id || q._id] : null
        const dW = Math.min(compact ? 40 : 50, colW), dH = dW * 0.64
        const nCols = optColsFor(q)
        const cellW = (colW - (nCols - 1) * 4) / nCols
        const opts = LETTERS.map(l => {
          doc.setFontSize(oSize); doc.setFont(FONT, 'normal')
          const lines = doc.splitTextToSize(pdfSafe(`${l}.  ${q[`option_${l.toLowerCase()}`] || '-'}`), cellW - 2)
          const mayek = O.showMayek ? q[`option_${l.toLowerCase()}_mayek`] : ''
          let ml = []
          if (mayek) { doc.setFontSize(oSize - 0.5); doc.setFont('NotoMayek', 'normal'); ml = doc.splitTextToSize(pdfMayekText(mayek, q.question_mayek_font), cellW - 2) }
          return { l, lines, ml, h: lines.length * lh(oSize) + ml.length * lh(oSize - 0.5) + (compact ? 1 : 2) }
        })
        const rows = []
        for (let r = 0; r < opts.length; r += nCols) rows.push(opts.slice(r, r + nCols))
        const rowGap = compact ? 0.5 : 1.5
        const optH = rows.reduce((t, row) => t + Math.max(...row.map(o => o.h)) + rowGap, 0)
        const qH = qLines.length * lh(qSize) + (compact ? 1 : 2)
        const mH = mLines.length ? mLines.length * lh(qSize) + (compact ? 1 : 2) : 0
        const dH2 = diagramData ? dH + 3 : 0
        const spaceH = (Number(O.answerSpace) || 0) * 7
        const tail = compact ? 3 : 8.5
        place(Math.min(qH + mH + dH2 + optH + spaceH + tail, FOOTER_Y - 6 - HEADER_H - 1))

        // ── draw ──
        const x = colX()
        doc.setFontSize(qSize); doc.setFont(FONT, 'bold'); doc.setTextColor(30,58,95)
        doc.text(qLines, x, y)
        doc.setFontSize(Math.max(7, oSize - 2)); doc.setFont(FONT, 'normal'); doc.setTextColor(100,116,139)
        doc.text(`[${marksOf(q, O)}M]`, x + colW, y, { align:'right' })
        y += qH
        if (mLines.length) {
          doc.setTextColor(55,65,81)
          drawMayekLines(doc, mLines, x, y, qSize, lh(qSize)); y += mH
        }
        if (diagramData) {
          try { doc.addImage(diagramData, x, y - 2, dW, dH); y += dH2 } catch { /* image failed to embed — skip, question text still stands */ }
        }
        rows.forEach(row => {
          const rowY = y
          const rowH = Math.max(...row.map(o => o.h))
          row.forEach((o, k) => {
            const cx = x + k * (cellW + 4)
            const isCorrect = inline && q.correct_option === o.l
            if (isCorrect) {
              doc.setFillColor(220,252,231)
              doc.roundedRect(cx - 1.5, rowY - lh(oSize) + 0.6, cellW, rowH, 1, 1, 'F')
            }
            doc.setFontSize(oSize); doc.setFont(FONT, isCorrect ? 'bold' : 'normal')
            doc.setTextColor(isCorrect?21:51, isCorrect?128:65, isCorrect?61:85)
            doc.text(o.lines, cx, rowY)
            if (o.ml.length) {
              doc.setTextColor(55,65,81)
              drawMayekLines(doc, o.ml, cx, rowY + o.lines.length * lh(oSize), oSize - 0.5, lh(oSize - 0.5))
            }
          })
          y += rowH + rowGap
        })
        if (spaceH) {
          doc.setDrawColor(203,213,225); doc.setLineWidth(.15)
          for (let k = 0; k < O.answerSpace; k++) { y += 7; doc.line(x, y - 1, x + colW, y - 1) }
        }
        // rows advance to the next baseline, so pull back most of that empty line before the divider
        y += (compact ? 0.5 : 3) - lh(oSize) * 0.6
        doc.setDrawColor(226,232,240); doc.setLineWidth(.15)
        doc.line(x, y, x + colW, y)
        y += compact ? 3.5 : 5.5
      })
    })

    if (O.endMarker && qs.length) {
      place(8)
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139)
      doc.text('*** End of paper ***', twoCol ? colX() + colW / 2 : W / 2, y + 1, { align:'center' })
      y += 8
    }

    // Column divider on every two-column page.
    if (twoCol && qs.length) {
      const last = doc.getNumberOfPages()
      colTops.forEach(({ page, top }) => {
        doc.setPage(page)
        doc.setDrawColor(203,213,225); doc.setLineWidth(.2)
        doc.line(margin + colW + gutter / 2, top - 4, margin + colW + gutter / 2, FOOTER_Y - 8)
      })
      doc.setPage(last)
    }

    // ── OMR bubble sheet for this set ────────────────────────────────────
    if (O.omr && qs.length) {
      doc.addPage(); drawLetterhead(multi ? `SET ${set.code} · OMR` : 'OMR Sheet'); y = HEADER_H
      doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
      doc.text(`OMR Answer Sheet${multi ? `  ·  Set ${set.code}` : ''}`, W/2, y, { align:'center' }); y += 7
      doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59)
      doc.text('Name: ______________________________   Roll No.: ____________   Set: ____', margin, y); y += 5
      doc.setFontSize(8); doc.setTextColor(100,116,139)
      doc.text('Darken ONE circle per question completely with a blue/black ball-point pen.', margin, y); y += 7
      const perCol = 25, colsN = 4, cw = contentW / colsN
      qs.forEach((_, i) => {
        const c = Math.floor(i / perCol) % colsN, r = i % perCol
        if (i > 0 && i % (perCol * colsN) === 0) { doc.addPage(); drawLetterhead('OMR Sheet — contd.'); y = HEADER_H }
        const bx = margin + c * cw, by = y + r * 7.6
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
        doc.text(String(i + 1), bx + 7, by, { align:'right' })
        LETTERS.forEach((l, k) => {
          doc.setDrawColor(30,58,95); doc.setLineWidth(.3); doc.circle(bx + 12 + k * 7, by - 1.2, 2.4)
          doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.text(l, bx + 12 + k * 7, by - 0.1, { align:'center' })
        })
      })
    }
  }

  SETS.forEach((s, i) => renderSet(s, i === 0))

  // ── Answer key: every set on clean, boxed pages ──────────────────────────
  if (O.answerKey === 'page') {
    doc.addPage()
    drawLetterhead('Answer Key')
    y = HEADER_H
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
    doc.text('Answer Key', W/2, y, { align:'center' }); y += 4
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
    const scope = `${subject} — ${chapter}`
    doc.text(title === scope || !title ? scope : `${title}  ·  ${scope}`, W/2, y, { align:'center' }); y += 8
    const cols = 6, cellW = contentW/cols, cellH = 9
    SETS.forEach(set => {
      if (multi) {
        if (y + 16 > FOOTER_Y - 10) { doc.addPage(); drawLetterhead('Answer Key — contd.'); y = HEADER_H }
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
        doc.text(`Set ${set.code}`, margin, y + 3); y += 7
      }
      set.questions.forEach((q, i) => {
        const col = i % cols
        if (col === 0 && i > 0) y += cellH
        if (y + cellH > FOOTER_Y - 10) { doc.addPage(); drawLetterhead('Answer Key — contd.'); y = HEADER_H }
        const cx = margin + col*cellW
        doc.setFillColor(240,246,255)
        doc.roundedRect(cx, y, cellW-2, cellH-2, 1, 1, 'F')
        doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
        doc.text(`Q${i+1}`, cx+3, y+5.5)
        doc.setFont('helvetica','normal'); doc.setTextColor(21,128,61)
        doc.text(q.correct_option || '—', cx+cellW-6, y+5.5, { align:'right' })
      })
      y += cellH + 6
    })
  }

  // ── Teacher blueprint: chapter × difficulty ──────────────────────────────
  if (O.blueprint && allQs.length) {
    const bp = blueprint(allQs, O)
    doc.addPage(); drawLetterhead('Blueprint'); y = HEADER_H
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
    doc.text('Paper Blueprint', W/2, y, { align:'center' }); y += 9
    const colsX = [margin, margin + 88, margin + 106, margin + 124, margin + 142, margin + 162]
    const head = ['Chapter', 'Easy', 'Medium', 'Hard', 'Total', 'Marks']
    const row = (cells, bold, fill) => {
      if (fill) { doc.setFillColor(240,246,255); doc.rect(margin, y - 5, contentW, 7.5, 'F') }
      doc.setFontSize(9); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(30,41,59)
      cells.forEach((c, i) => doc.text(pdfSafe(String(c)).slice(0, i === 0 ? 48 : 10), colsX[i], y))
      doc.setDrawColor(226,232,240); doc.setLineWidth(.15); doc.line(margin, y + 2.5, W - margin, y + 2.5)
      y += 7.5
    }
    row(head, true, true)
    bp.rows.forEach(r => row([r.chapter, r.Easy, r.Medium, r.Hard, r.total, r.marks]))
    row(['Total', bp.total.Easy, bp.total.Medium, bp.total.Hard, bp.total.total, bp.total.marks], true, true)
  }

  // ── Footer + watermark on every page ─────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p=1; p<=pages; p++) {
    doc.setPage(p)
    drawFooter(p, pages)
    drawWatermark()
  }

  doc.save(`${(fileName || title).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g,'_') || 'Question_Paper'}.pdf`)
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: MAYEK TOOL — manual BMEI04 keystroke <-> Unicode Meetei Mayek converter
// ══════════════════════════════════════════════════════════════════════════════
// Separate from the auto-detect-on-paste system in parseQuestions() above
// (which tags a whole question row 'bmei04' and renders it live with the
// embedded BMEI04 font). This tab is for manually typing or checking a
// word or line, and for converting one already-saved BMEI04 row to
// permanent Unicode (after which it renders with Noto Sans Meetei Mayek
// like any other Unicode row, and no longer needs the embedded font).
// Translate mode: meaning-level AI translation (mayekTranslate.js), shown for
// a human to check — unlike the keystroke modes, which never guess.
function MayekTranslator({ showToast, currentStaffId }) {
  const [from, setFrom] = useState('auto')
  const [to, setTo] = useState('mni-Mtei')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [detected, setDetected] = useState('')
  const [warnings, setWarnings] = useState([])
  const [busy, setBusy] = useState('')
  const [showKeys, setShowKeys] = useState(false)
  const [last, setLast] = useState(null) // what the engine returned, to spot staff edits
  const [saving, setSaving] = useState(false)
  const [translated, setTranslated] = useState(0) // re-checks the offline translator after each run
  const run = useRef(0)

  const mayekFont = code => (code === 'mni-Mtei' ? "'Noto Sans Meetei Mayek', sans-serif" : 'inherit')
  const doTranslate = async () => {
    if (!input.trim() || busy) return
    if (from === to) { setOutput(input); return }
    const id = ++run.current
    setBusy('Translating…'); setWarnings([]); setDetected(''); setLast(null)
    try {
      const r = await aiTranslate(input, from, to, (i, n) => { if (n > 1 && id === run.current) setBusy(`Translating part ${i} of ${n}…`) })
      if (id !== run.current) return
      setOutput(r.text); setDetected(r.detected); setWarnings(r.warnings)
      setLast({ source: r.source, machine: r.text, from: r.from, to, engine: r.engine, dictLines: r.dictLines })
    } catch (e) {
      if (id === run.current) showToast('Translation failed: ' + e.message, C.rose)
    } finally {
      if (id === run.current) setBusy('')
      setTranslated(n => n + 1)
    }
  }
  const swap = () => {
    // 'Detect' and BMEI04 are source-only, so they swap to a sensible target.
    const next = from === 'auto' || from === 'bmei04' ? (to === 'en' ? 'mni-Mtei' : 'en') : from
    setFrom(to); setTo(next); setInput(output); setOutput(''); setWarnings([]); setDetected(''); setLast(null)
  }
  // Lines the staff member changed after translating, ready to save to the dictionary.
  const pairs = useMemo(() => (last ? correctionPairs(last.source, last.machine, output, last.from, last.to) : null), [last, output])
  const edited = !!last && output !== last.machine
  const saveFixes = async () => {
    if (!pairs?.length || saving) return
    setSaving(true)
    try {
      const n = await saveCorrections(pairs, currentStaffId)
      showToast(`Saved ${n} correction${n === 1 ? '' : 's'} to the dictionary`, C.green)
      setLast(l => ({ ...l, machine: output }))
    } catch (e) { showToast('Could not save: ' + e.message, C.rose) }
    finally { setSaving(false) }
  }
  const copy = async text => {
    if (!text) return
    try { await navigator.clipboard.writeText(text); showToast('Copied', C.green) }
    catch { showToast('Copy failed', C.rose) }
  }
  const keys = useMemo(() => (to === 'mni-Mtei' && showKeys ? meeteiToRoman(output) : ''), [to, showKeys, output])
  const sel = { ...iS, width:'auto', minWidth:200, fontWeight:600 }
  const box = { width:'100%', minHeight:200, padding:'10px 12px', borderRadius:7, border:'1px solid '+C.border,
    fontSize:15, lineHeight:1.8, resize:'vertical', boxSizing:'border-box' }

  return (
    <div>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
        <select aria-label="Translate from" value={from} onChange={e => setFrom(e.target.value)} style={sel}>
          {LANGS.filter(l => l.source).map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button onClick={swap} title="Swap languages" aria-label="Swap languages" style={btnSm('#fff', C.navy)}>⇄</button>
        <select aria-label="Translate to" value={to} onChange={e => setTo(e.target.value)} style={sel}>
          {LANGS.filter(l => l.target).map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <OfflineToggle recheck={translated} />
      </div>

      <div className="qb-opts" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div>
          <label style={lS}>{langLabel(from)}{detected && from === 'auto' ? ` — detected: ${detected}` : ''}</label>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={9}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doTranslate() } }}
            placeholder={from === 'bmei04' ? 'Paste BMEI04 keystrokes, e.g. AEgi k_laski mruPsiH' : 'Type or paste text to translate (Ctrl+Enter)'}
            style={{ ...box, fontFamily: from === 'bmei04' ? 'monospace' : mayekFont(from) }} />
          <div style={{ fontSize:11, color:C.slate, marginTop:4 }}>{input.length.toLocaleString()} characters</div>
        </div>
        <div>
          <label style={lS}>{langLabel(to)}{last?.engine ? ` — ${ENGINE_LABELS[last.engine]}` : ''}{last?.dictLines && last.engine !== 'dictionary' ? ` + ${last.dictLines} line${last.dictLines === 1 ? '' : 's'} from your dictionary` : ''}</label>
          <textarea value={output} onChange={e => setOutput(e.target.value)} rows={9} aria-label="Translation"
            placeholder={busy || 'Translation will appear here — you can edit it'}
            style={{ ...box, background:'#f8fafc', fontFamily: mayekFont(to), fontSize: to === 'mni-Mtei' ? 19 : 15 }} />
          {keys && (
            <div style={{ marginTop:8 }}>
              <label style={lS}>BMEI04 keystrokes (to type in Word with the Bmei04 font)</label>
              <div style={{ padding:'8px 12px', borderRadius:7, background:'#f8fafc', border:'1px solid '+C.border,
                fontFamily:'monospace', fontSize:13, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{keys}</div>
            </div>
          )}
        </div>
      </div>

      {edited && pairs === null && (
        <div style={{ marginTop:10, fontSize:12, color:C.slate }}>
          {last.from === 'en' && last.to === 'mni-Mtei' || last.from === 'mni-Mtei' && last.to === 'en'
            ? 'To save corrections to the dictionary, keep the same number of lines as the original.'
            : 'Corrections can be saved to the dictionary only for English ↔ Manipuri (Meetei Mayek).'}
        </div>
      )}
      {warnings.map(w => (
        <div key={w} style={{ marginTop:10, padding:'8px 12px', borderRadius:8, background:'#fff7ed', border:'1px solid #fdba74', fontSize:12, color:'#9a3412' }}>⚠ {w}</div>
      ))}

      <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
        <button onClick={doTranslate} disabled={!input.trim() || !!busy} style={btn(C.navy, !input.trim() || !!busy)}>{busy || 'Translate'}</button>
        <button onClick={() => copy(output)} style={btn(C.teal, !output)} disabled={!output}>Copy Translation</button>
        {to === 'mni-Mtei' && <button onClick={() => setShowKeys(v => !v)} style={btn(C.slate)}>{showKeys ? 'Hide' : 'Show'} BMEI04 Keys</button>}
        {keys && <button onClick={() => copy(keys)} style={btn(C.slate)}>Copy Keys</button>}
        {pairs?.length > 0 && (
          <button onClick={saveFixes} disabled={saving} style={btn(C.green, saving)}
            title="Saves the lines you changed, so future translations use your wording">
            {saving ? 'Saving…' : `Save ${pairs.length} correction${pairs.length === 1 ? '' : 's'} to Dictionary`}
          </button>
        )}
        <button onClick={() => { run.current++; setInput(''); setOutput(''); setWarnings([]); setDetected(''); setBusy(''); setLast(null) }} style={btn(C.slate)}>Clear</button>
      </div>

      <div style={{ marginTop:14, padding:'10px 14px', borderRadius:8, background:'#f0f9ff',
        border:'1px solid #bae6fd', fontSize:11, color:'#0369a1', lineHeight:1.6 }}>
        Lines already in your Dictionary are used exactly; the rest is machine translation (the offline translator when switched on above, else Bhashini or Google Translate when set up, otherwise Gemini AI) —
        check it before putting it in a question paper. If a line is wrong, fix it in the result box and press
        <b> Save corrections to Dictionary</b>: the next translation of that line will use your wording.
        For exact letter-by-letter conversion of BMEI04 text, use the two keystroke modes instead.
      </div>
    </div>
  )
}

function TabTranslit({ questions, refetch, showToast, currentStaffId }) {
  const [mode, setMode] = useState('translate')
  const [input, setInput] = useState('')
  const output = useMemo(() => (mode === 'toMayek' ? romanToMeetei(input) : meeteiToRoman(input)), [input, mode])
  const [showPicker, setShowPicker] = useState(false)


  const handleCopy = async () => {
    if (!output) return
    try { await navigator.clipboard.writeText(output); showToast('Copied', C.green) }
    catch { showToast('Copy failed', C.rose) }
  }

  const handleSaveToBank = async () => {
    if (mode !== 'toMayek' || !output.trim()) {
      showToast('Switch to Roman to Mayek mode first', C.amber); return
    }
    // The typed keystrokes must match a saved BMEI04 question_mayek IN FULL
    // (whitespace-insensitive only). A prefix/substring match used to
    // overwrite the whole stored text with the conversion of just the
    // fragment typed, losing the rest. Case and punctuation are kept:
    // in BMEI04 they are distinct keystrokes (capitals are Lonsum forms,
    // ':' etc. map to glyphs), so stripping them made unrelated rows match.
    const norm = s => (s || '').replace(/\s+/g, ' ').trim()
    const needle = norm(input)
    if (!needle) { showToast('Type the full BMEI04 text of the question first', C.amber); return }
    const candidates = (questions || []).filter(q =>
      q.question_mayek_font === 'bmei04' &&
      q.question_mayek &&
      norm(q.question_mayek) === needle
    )
    if (!candidates.length) { showToast('No saved BMEI04 question has exactly this text — paste its full Mayek line', C.amber); return }
    if (candidates.length > 1) { showToast(candidates.length + ' matches - edit manually', C.amber); return }
    const { data, error } = await supabase
      .from('qbank_questions')
      .update({ question_mayek: output, question_mayek_font: 'unicode' })
      .eq('id', candidates[0].id)
      .select('id')
    if (error) { showToast('Update failed: ' + error.message, C.rose); return }
    if (!data?.length) { showToast('Nothing was updated — you may lack permission', C.amber); return }
    showToast('Converted BMEI04 to Unicode', C.green)
    refetch && refetch(true)
  }

  const allChars = useMemo(() => getAllCharacters(), [])

  return (
    <div style={cardS}>
      <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:4 }}>
        Mayek Tool - Translator
      </div>
      <div style={{ fontSize:12, color:C.slate, marginBottom:16 }}>
        {mode === 'translate'
          ? 'Translate between English, Hindi, Bengali and Manipuri (Meetei Mayek, Bengali script or Roman).'
          : 'Offline BMEI04 keystroke conversion, verified against real GNSI documents. No API, no model, instant.'}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14, padding:4, background:'#f1f5f9', borderRadius:9, width:'fit-content', flexWrap:'wrap' }}>
        {[{ k:'translate', label:'Translate' }, { k:'toMayek', label:'Roman - Meetei Mayek' }, { k:'toRoman', label:'Meetei Mayek - Roman' }].map(({ k, label }) => (
          <button key={k} onClick={() => { setMode(k); setInput('') }}
            style={{ padding:'8px 16px', borderRadius:7, border:'none', fontSize:12, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit',
              background: mode === k ? C.navy : 'transparent',
              color: mode === k ? '#fff' : C.slate }}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'translate' ? <MayekTranslator showToast={showToast} currentStaffId={currentStaffId} /> : (<>
      <div className="qb-opts" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div>
          <label style={lS}>{mode === 'toMayek' ? 'BMEI04 Keystrokes' : 'Meetei Mayek Input'}</label>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={8}
            style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid '+C.border,
              fontSize:13, fontFamily:'monospace', resize:'vertical', boxSizing:'border-box' }}
            placeholder={mode === 'toMayek' ? 'BMEI04 keystrokes, e.g. AepL (apple), mnipur (Manipur)' : 'Meetei Mayek text'} />
        </div>
        <div>
          <label style={lS}>{mode === 'toMayek' ? 'Meetei Mayek Output' : 'BMEI04 Keystrokes'}</label>
          <div style={{ minHeight:180, padding:'10px 12px', borderRadius:7,
            background:'#f8fafc', border:'1px solid '+C.border,
            fontFamily: mode === 'toMayek' ? 'Noto Sans Meetei Mayek, monospace' : 'monospace',
            fontSize: mode === 'toMayek' ? 20 : 13, lineHeight:1.8,
            whiteSpace:'pre-wrap', wordWrap:'break-word' }}>
            {output || <span style={{ color:'#94a3b8', fontSize:12, fontFamily:'inherit' }}>Output will appear here...</span>}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
        <button onClick={handleCopy} style={btn(C.navy)}>Copy Output</button>
        <button onClick={() => setInput('')} style={btn(C.slate)}>Clear</button>
        <button onClick={() => setShowPicker(v => !v)} style={btn(C.teal)}>
          {showPicker ? 'Hide' : 'Show'} Character Picker
        </button>
        {mode === 'toMayek' && (
          <button onClick={handleSaveToBank} style={btn(C.green)}>
            Save to Matching BMEI04 Question
          </button>
        )}
      </div>

      {showPicker && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid '+C.border }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#0891b2', marginBottom:8,
            textTransform:'uppercase', letterSpacing:'.05em' }}>
            Click a character to insert its BMEI04 key
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(58px, 1fr))', gap:6 }}>
            {allChars.map(({ key, char, name }) => (
              <div key={key} title={name + ' (' + key + ')'} onClick={() => setInput(v => v + key)}
                style={{ padding:'6px 4px', borderRadius:7, textAlign:'center', cursor:'pointer',
                  background:'#f8fafc', border:'1px solid '+C.border }}>
                <div style={{ fontSize:18, lineHeight:1.3, fontFamily:'Noto Sans Meetei Mayek, sans-serif' }}>{char}</div>
                <div style={{ fontSize:9, color:C.slate, marginTop:2 }}>{name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop:14, padding:'10px 14px', borderRadius:8, background:'#f0f9ff',
        border:'1px solid #bae6fd', fontSize:11, color:'#0369a1', lineHeight:1.6 }}>
        This reproduces BMEI04's actual keystrokes, not a generic phonetic scheme.
        Capital letters are mostly the Lonsum (word-final) form of the same consonant &mdash;
        type the capital yourself where a syllable ends (e.g. <code>boL</code> for &ldquo;ball&rdquo;).
        Lowercase <code>a</code> is the Atap vowel sign (&ldquo;aa&rdquo;), not the vowel letter &mdash; that's capital <code>A</code>.
        The Save button converts a saved BMEI04 question_mayek to real Unicode — paste that question's full Mayek line exactly as stored.
      </div>
      </>)}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DICTIONARY — English to Meetei Mayek, dictionary-backed (words + sentences)
// ══════════════════════════════════════════════════════════════════════════════
// Separate from TabTranslit above (which converts BMEI04 keystrokes <-> Unicode
// for text you already have in one script or the other). This tab goes from
// real English words/sentences to Meetei Mayek, using a Supabase table
// (mayek_dictionary) that grows as entries are added — never machine-translated,
// so a missing word is shown as [?word?] rather than guessed.
// "Use the offline translator on this computer" tick box with a running /
// not-running status. The setting is per browser (see mayekTranslate.js);
// the status is re-checked whenever `recheck` changes.
function OfflineToggle({ recheck = 0 }) {
  const [offline, setOffline] = useState(offlineEnabled)
  const [offlineUp, setOfflineUp] = useState(null) // null = not checked yet
  useEffect(() => {
    if (!offline) return
    let live = true
    offlineRunning().then(ok => { if (live) setOfflineUp(ok) })
    return () => { live = false }
  }, [offline, recheck])
  const toggle = on => { setOfflineEnabled(on); setOfflineUp(null); setOffline(on) }
  return (
    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:C.slate, cursor:'pointer' }}
      title="Translates English on this computer with no internet. Needs the offline translator program running here.">
      <input type="checkbox" checked={offline} onChange={e => toggle(e.target.checked)} />
      Use the offline translator on this computer
      {offline && (
        <b style={{ color: offlineUp ? C.green : offlineUp === false ? C.rose : C.slate }}>
          {offlineUp ? '— running' : offlineUp === false ? '— not running (start start-translator.bat)' : '— checking…'}
        </b>
      )}
    </label>
  )
}

function TabDictionary({ showToast, currentStaffId, questions, isAdmin }) {
  const [subView, setSubView] = useState('translate') // translate | add | bulk | wordlist | coverage | browse

  return (
    <div style={cardS}>
      <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:4 }}>
        Dictionary - English to Meetei Mayek
      </div>
      <div style={{ fontSize:12, color:C.slate, marginBottom:8 }}>
        Dictionary lookup for known words/sentences, with BMEI04 keystrokes. Unknown words are flagged, never guessed.
      </div>
      <div style={{ marginBottom:16 }}>
        <OfflineToggle recheck={subView} />
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16, padding:4, background:'#f1f5f9', borderRadius:9, width:'fit-content', flexWrap:'wrap' }}>
        {[
          { k:'translate', label:'Translate' },
          { k:'add', label:'Add Entry' },
          { k:'bulk', label:'Bulk Import (CSV)' },
          { k:'wordlist', label:'Seed Wordlist' },
          { k:'coverage', label:'Coverage' },
          { k:'browse', label:'Browse / Edit' },
        ].map(({ k, label }) => (
          <button key={k} onClick={() => setSubView(k)}
            style={{ padding:'8px 16px', borderRadius:7, border:'none', fontSize:12, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit',
              background: subView === k ? C.navy : 'transparent',
              color: subView === k ? '#fff' : C.slate }}>
            {label}
          </button>
        ))}
      </div>

      {subView === 'translate' && <DictTranslatePanel showToast={showToast} />}
      {subView === 'add' && <DictAddEntryPanel showToast={showToast} currentStaffId={currentStaffId} />}
      {subView === 'bulk' && <DictBulkImportPanel showToast={showToast} currentStaffId={currentStaffId} />}
      {subView === 'wordlist' && <DictSeedWordlistPanel showToast={showToast} currentStaffId={currentStaffId} />}
      {subView === 'coverage' && <DictCoveragePanel showToast={showToast} questions={questions} currentStaffId={currentStaffId} />}
      {subView === 'browse' && <DictBrowsePanel showToast={showToast} isAdmin={isAdmin} />}
    </div>
  )
}

// ── SEED WORDLIST ────────────────────────────────────────────────────────────
// Fast dictionary-growth path: paste a raw wordlist (textbook glossary, exam
// vocab sheet — one word per line, or comma/tab separated), no BMEI04 typing
// needed up front. Creates blank-bmei04 placeholder rows so the words show
// up in the Coverage "Unfilled" queue and can be typed in later, in bulk or
// one at a time, instead of ad hoc as questions happen to need them.
function DictSeedWordlistPanel({ showToast, currentStaffId }) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [result, setResult] = useState(null)

  const handleSeed = async () => {
    if (!text.trim()) return
    setSeeding(true); setResult(null)
    try {
      const res = await seedWordlist(text, { category: category.trim() || null, createdBy: currentStaffId || null })
      setResult(res)
      showToast(`Seeded ${res.seeded} new words`, C.green)
      if (res.seeded) setText('')
    } catch (err) {
      showToast('Seed failed: ' + err.message, C.rose)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div>
      <div style={{ fontSize:12, color:C.slate, marginBottom:10 }}>
        Paste a wordlist — one word per line (or comma/tab separated). Each new word is added to the
        dictionary with its BMEI04 keystrokes left blank, so it appears in the <strong>Coverage → Unfilled</strong>{' '}
        queue ready to be typed in. Words already in the dictionary (filled or not) are skipped automatically.
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={10}
        placeholder={'apple\nball\ncat\ndog\n... or: apple, ball, cat, dog'}
        style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid '+C.border,
          fontSize:13, fontFamily:'monospace', resize:'vertical', boxSizing:'border-box' }} />
      <label style={{ ...lS, marginTop:12 }}>Category (optional, applies to all seeded words)</label>
      <input value={category} onChange={e => setCategory(e.target.value)}
        placeholder="e.g. math, general, grammar" style={iS} />
      <button onClick={handleSeed} disabled={seeding} style={{ ...btn(C.navy), marginTop:12 }}>
        {seeding ? 'Seeding...' : 'Seed Wordlist'}
      </button>

      {result && (
        <div style={{ marginTop:14, fontSize:13 }}>
          <div style={{ fontWeight:700, color:C.green }}>{result.seeded} new words added (blank BMEI04)</div>
          {result.skippedExisting > 0 && (
            <div style={{ color:C.slate, marginTop:4 }}>{result.skippedExisting} already existed — skipped</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── COVERAGE ─────────────────────────────────────────────────────────────────
// Three linked views on the same question: how much of what students will
// actually see is real, verified Meetei Mayek right now, and what's the most
// useful next thing to fill in.
//   1. Gap scan — every distinct word across the live question bank
//      (question text + all four options), split into: has no dictionary
//      entry at all / has a blank placeholder / has a flagged translation /
//      fully covered.
//   2. Unfilled queue — dictionary rows with blank bmei04 (seeded via
//      Seed Wordlist, or any other blank-bmei04 row) needing keystrokes typed in.
//   3. Needs Review queue — rows WITH a translation that got flagged during
//      save (an unresolved word-initial vowel case — see meetei_mayek.js) so
//      a human can confirm or correct it, plus the phrase-template checklist
//      for recurring full-sentence phrasings (see COMMON_QUESTION_PHRASES).
function DictCoveragePanel({ showToast, questions, currentStaffId }) {
  const [scanning, setScanning] = useState(false)
  const [gaps, setGaps] = useState(null)
  const [unfilled, setUnfilled] = useState([])
  const [needsReview, setNeedsReview] = useState([])
  const [phrases, setPhrases] = useState([])
  const [loadingQueues, setLoadingQueues] = useState(true)
  const [fillDrafts, setFillDrafts] = useState({}) // id -> bmei04 text being typed
  const [drafting, setDrafting] = useState('') // progress text while entries are auto-filled
  const [sentScan, setSentScan] = useState(null) // Question Bank sentence coverage
  const [sentBusy, setSentBusy] = useState('')

  const loadQueues = useCallback(async () => {
    setLoadingQueues(true)
    try {
      const [uf, nr, ph] = await Promise.all([
        getUnfilledEntries(), getNeedsReviewEntries(), getPhraseTemplateStatus(),
      ])
      setUnfilled(uf); setNeedsReview(nr); setPhrases(ph)
    } catch (err) {
      showToast('Failed to load queues: ' + err.message, C.rose)
    } finally {
      setLoadingQueues(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- showToast is a new function each render; adding it would reload in a loop

  // Loads from the server on open; setLoading inside is the intended effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadQueues() }, [loadQueues])

  const runScan = async () => {
    setScanning(true)
    try {
      const texts = []
      for (const q of (questions || [])) {
        if (q.question) texts.push(q.question)
        for (const k of ['option_a', 'option_b', 'option_c', 'option_d']) if (q[k]) texts.push(q[k])
      }
      const res = await findCoverageGaps(texts)
      setGaps(res)
    } catch (err) {
      showToast('Scan failed: ' + err.message, C.rose)
    } finally {
      setScanning(false)
    }
  }

  const handleFillSave = async (row) => {
    const bmei04 = (fillDrafts[row.id] || '').trim()
    if (!bmei04) { showToast('Type BMEI04 keystrokes first', C.amber); return }
    try {
      await saveDictionaryEntry({
        entryType: row.entry_type, english: row.english, bmei04,
        category: row.category, source: reviewedSource(row.source),
        createdBy: currentStaffId || null,
      })
      showToast('Saved', C.green)
      setFillDrafts(d => { const n = { ...d }; delete n[row.id]; return n })
      loadQueues()
    } catch (err) {
      showToast('Save failed: ' + err.message, C.rose)
    }
  }

  // Blank entries are filled as drafts (needs_review) for a teacher to check:
  // by the offline translator where it is switched on and running, else Gemini.
  const DRAFT_LIMIT = 200
  const runDraft = async (rows) => {
    if (drafting || !rows.length) return
    const todo = rows.slice(0, DRAFT_LIMIT)
    setDrafting('Translating…')
    try {
      const { filled, offline, gemini, failed } = await aiDraftEntries(todo,
        (n, total, engine) => setDrafting(`${engine === 'indictrans' ? 'Offline translator' : 'Asking Gemini'}… ${n}/${total}`))
      const more = rows.length - todo.length
      const by = [offline && `${offline} by the offline translator`, gemini && `${gemini} by Gemini`].filter(Boolean).join(', ')
      showToast(`Drafted ${filled} entr${filled === 1 ? 'y' : 'ies'}${by ? ` (${by})` : ''} — check them under Needs Review` +
        (failed.length ? ` · ${failed.length} skipped` : '') + (more > 0 ? ` · ${more} more: click again` : ''), filled ? C.green : C.amber)
      loadQueues()
    } catch (err) {
      showToast('Auto-fill failed: ' + err.message, C.rose)
    } finally {
      setDrafting('')
    }
  }
  const draftMissing = async () => {
    if (drafting || !gaps?.missing.length) return
    setDrafting('Adding words…')
    try {
      await seedWordlist(gaps.missing.join('\n'), { source: 'coverage_scan', createdBy: currentStaffId || null })
      const want = new Set(gaps.missing)
      const rows = (await getUnfilledEntries({ limit: 5000 })).filter(r => want.has(r.english_norm))
      setDrafting('')
      await runDraft(rows)
      setGaps(g => g && ({ ...g, missing: [] }))
    } catch (err) {
      showToast('Could not add words: ' + err.message, C.rose)
      setDrafting('')
    }
  }
  const approve = async (ids) => {
    try {
      const n = await approveEntries(ids)
      showToast(`Approved ${n} entr${n === 1 ? 'y' : 'ies'}`, C.green)
      loadQueues()
    } catch (err) { showToast('Approve failed: ' + err.message, C.rose) }
  }
  const aiDrafts = needsReview.filter(r => REVIEWABLE_SOURCES.has(r.source))

  // ── Sentence database: Question Bank sentences -> sentence entries ──
  const runSentenceScan = async () => {
    setSentBusy('Scanning…')
    try { setSentScan(await scanSentences(questions)) }
    catch (err) { showToast('Sentence scan failed: ' + err.message, C.rose) }
    finally { setSentBusy('') }
  }
  const importPairs = async () => {
    if (!sentScan?.missingPairs.length) return
    setSentBusy('Importing…')
    try {
      const n = await addSentences(sentScan.missingPairs, currentStaffId || null)
      showToast(`Imported ${n} bilingual sentence${n === 1 ? '' : 's'} — confirm them under Needs Review`, C.green)
      loadQueues(); await runSentenceScan()
    } catch (err) { showToast('Import failed: ' + err.message, C.rose) }
    finally { setSentBusy('') }
  }
  const addEnglishSentences = async () => {
    if (!sentScan?.missingEnglish.length || drafting) return
    setSentBusy('Adding…')
    try {
      await addSentences(sentScan.missingEnglish, currentStaffId || null)
      const want = new Set(sentScan.missingEnglish.map(x => x.english_norm))
      const rows = (await getUnfilledEntries({ limit: 5000 })).filter(r => want.has(r.english_norm))
      setSentBusy('')
      await runDraft(rows)
      await runSentenceScan()
    } catch (err) { showToast('Could not add sentences: ' + err.message, C.rose); setSentBusy('') }
  }

  const pct = (n, total) => total ? Math.round((n / total) * 100) : 0

  return (
    <div>
      {/* ── Gap scan ── */}
      <div style={{ marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>Question Bank Coverage Scan</div>
          <button onClick={runScan} disabled={scanning} style={btnSm(C.navy)}>
            {scanning ? 'Scanning...' : 'Run Scan'}
          </button>
        </div>
        <div style={{ fontSize:11, color:C.slate, marginBottom:10 }}>
          Scans every question + option currently loaded ({(questions || []).length} questions) for distinct
          English words and checks each against the dictionary.
        </div>

        {gaps && (
          <div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
              {[
                { label:'Covered', n: gaps.coveredCount, color: C.green },
                { label:'Missing entirely', n: gaps.missing.length, color: C.rose },
                { label:'Unfilled (blank BMEI04)', n: gaps.unfilled.length, color: C.amber },
                { label:'Needs review', n: gaps.needsReview.length, color: '#991b1b' },
              ].map(s => (
                <div key={s.label} style={{ flex:'1 1 140px', padding:'10px 12px', borderRadius:8,
                  background:'#f8fafc', border:'1px solid '+C.border }}>
                  <div style={{ fontSize:20, fontWeight:800, color: s.color }}>{s.n}</div>
                  <div style={{ fontSize:11, color:C.slate, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:C.slate, marginBottom:10 }}>
              {gaps.totalDistinctWords} distinct words found · {pct(gaps.coveredCount, gaps.totalDistinctWords)}% fully covered
            </div>
            {gaps.missing.length > 0 && (
              <div style={{ padding:12, background:'#fef2f2', borderRadius:8, border:'1px solid #fecaca', marginBottom:10 }}>
                <div style={{ fontWeight:700, fontSize:12, color:'#991b1b', marginBottom:6 }}>
                  Not in dictionary at all ({gaps.missing.length}):
                </div>
                <div style={{ fontSize:12, color:'#7f1d1d', maxHeight:120, overflowY:'auto' }}>
                  {gaps.missing.join(', ')}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginTop:8 }}>
                  <button onClick={draftMissing} disabled={!!drafting} style={btnSm(C.violet)}>
                    {drafting || `✨ Add these & auto-fill`}
                  </button>
                  <span style={{ fontSize:11, color:'#991b1b' }}>
                    Or copy them into <strong>Seed Wordlist</strong> to fill by hand.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sentence database ── */}
      <div style={{ marginBottom:22, paddingTop:16, borderTop:'1px solid '+C.border }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:10, flexWrap:'wrap' }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>Sentence Database — Question Bank sentences</div>
          <button onClick={runSentenceScan} disabled={!!sentBusy} style={btnSm(C.navy)}>{sentBusy || 'Run Sentence Scan'}</button>
        </div>
        <div style={{ fontSize:11, color:C.slate, marginBottom:10 }}>
          Every question and option sentence ({(questions || []).length} questions loaded). Sentences in the dictionary are used
          word-for-word by the translator. Questions that already have a Meetei Mayek version give teacher-written pairs.
        </div>
        {sentScan && (
          <div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
              {[
                { label:'Sentences found', n: sentScan.total, color: C.navy },
                { label:'Approved in dictionary', n: sentScan.approved, color: C.green },
                { label:'Waiting for review', n: sentScan.waiting, color: C.violet },
                { label:'New with Mayek version', n: sentScan.missingPairs.length, color: C.teal },
                { label:'New, English only', n: sentScan.missingEnglish.length + sentScan.blank, color: C.amber },
              ].map(t => (
                <div key={t.label} style={{ flex:'1 1 120px', padding:'10px 12px', borderRadius:8, background:'#f8fafc', border:'1px solid '+C.border }}>
                  <div style={{ fontSize:20, fontWeight:800, color: t.color }}>{t.n}</div>
                  <div style={{ fontSize:11, color:C.slate, marginTop:2 }}>{t.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {sentScan.missingPairs.length > 0 && (
                <button onClick={importPairs} disabled={!!sentBusy} style={btnSm(C.teal)}
                  title="Saves each English sentence with the Meetei Mayek text teachers already wrote for it">
                  Import {sentScan.missingPairs.length} bilingual sentence{sentScan.missingPairs.length === 1 ? '' : 's'}
                </button>
              )}
              {sentScan.missingEnglish.length > 0 && (
                <button onClick={addEnglishSentences} disabled={!!sentBusy || !!drafting} style={btnSm(C.violet)}>
                  {drafting || `✨ Add ${sentScan.missingEnglish.length} English sentence${sentScan.missingEnglish.length === 1 ? '' : 's'} & auto-fill`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Unfilled queue ── */}
      <div style={{ marginBottom:22, paddingTop:16, borderTop:'1px solid '+C.border }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>
            Unfilled Entries ({unfilled.length}) — need BMEI04 keystrokes
          </div>
          {unfilled.length > 0 && (
            <button onClick={() => runDraft(unfilled)} disabled={!!drafting} style={btnSm(C.violet)}
              title="The offline translator (when ticked above and running) or Gemini suggests each entry; they're saved as drafts for a teacher to approve">
              {drafting || `✨ Auto-fill ${Math.min(unfilled.length, DRAFT_LIMIT)}`}
            </button>
          )}
        </div>
        {loadingQueues ? (
          <div style={{ fontSize:12, color:C.slate }}>Loading...</div>
        ) : unfilled.length === 0 ? (
          <div style={{ fontSize:12, color:C.slate }}>Nothing pending — every dictionary entry has keystrokes filled in.</div>
        ) : (
          <div style={{ maxHeight:320, overflowY:'auto' }}>
            {unfilled.map(row => (
              <div key={row.id} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 10px',
                borderBottom:'1px solid '+C.border }}>
                <div style={{ width: row.entry_type === 'sentence' ? 'min(40%, 360px)' : 140, flexShrink:0, fontWeight:700, fontSize:13, color:C.navy }}>{row.english}</div>
                <input value={fillDrafts[row.id] || ''} onChange={e => setFillDrafts(d => ({ ...d, [row.id]: e.target.value }))}
                  placeholder="Type BMEI04 keystrokes..." style={{ ...iS, flex:1, fontFamily:'monospace', fontSize:12 }} />
                <div style={{ minWidth:60, fontFamily:'Noto Sans Meetei Mayek, sans-serif', fontSize:18 }}>
                  {fillDrafts[row.id] ? romanToMeetei(fillDrafts[row.id]) : ''}
                </div>
                <button onClick={() => handleFillSave(row)} style={btnSm(C.green)}>Save</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Needs review queue ── */}
      <div style={{ marginBottom:22, paddingTop:16, borderTop:'1px solid '+C.border }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>
            Needs Review ({needsReview.length}) — AI drafts and entries flagged during entry
          </div>
          {aiDrafts.length > 1 && (
            <button onClick={() => { if (window.confirm(`Approve all ${aiDrafts.length} drafts (offline translator, Gemini and Question Bank) without checking each one? The translator will start using them.`)) approve(aiDrafts.map(r => r.id)) }}
              style={btnSm('#fff', C.navy)}>Approve all {aiDrafts.length} drafts</button>
          )}
        </div>
        {loadingQueues ? (
          <div style={{ fontSize:12, color:C.slate }}>Loading...</div>
        ) : needsReview.length === 0 ? (
          <div style={{ fontSize:12, color:C.slate }}>Nothing flagged.</div>
        ) : (
          <div style={{ maxHeight:320, overflowY:'auto' }}>
            {needsReview.map(row => (
              <div key={row.id} style={{ padding:'8px 10px', borderBottom:'1px solid '+C.border }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <div style={{ fontWeight:700, fontSize:13, color:C.navy, width: row.entry_type === 'sentence' ? 'min(100%, 420px)' : 140, flexShrink:0 }}>{row.english}</div>
                  <div style={{ fontFamily:'Noto Sans Meetei Mayek, sans-serif', fontSize:18 }}>{row.mayek_unicode}</div>
                  <div style={{ fontFamily:'monospace', fontSize:11, color:C.slate }}>{row.bmei04}</div>
                  {REVIEWABLE_SOURCES.has(row.source) && (
                    <span style={{ fontSize:10, fontWeight:700, color: row.source === AI_DRAFT_SOURCE ? C.violet : C.teal, background: row.source === AI_DRAFT_SOURCE ? '#f3e8ff' : '#ecfeff', borderRadius:5, padding:'2px 6px' }}>
                      {row.source === QB_SOURCE ? 'FROM QUESTION BANK' : row.source === OFFLINE_DRAFT_SOURCE ? 'OFFLINE TRANSLATOR' : 'AI DRAFT'}
                    </span>
                  )}
                </div>
                {REVIEWABLE_SOURCES.has(row.source) ? (
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, color:C.slate }}>
                      {row.source === QB_SOURCE ? 'Taken from a question written in both scripts — approve if it is a true translation' : `Suggested by ${row.source === OFFLINE_DRAFT_SOURCE ? 'the offline translator' : 'Gemini'} — approve if right`}, or type the correct BMEI04 keystrokes:
                    </span>
                    <button onClick={() => approve([row.id])} style={btnSm(C.green)}>✓ Approve</button>
                    <input value={fillDrafts[row.id] ?? ''} onChange={e => setFillDrafts(d => ({ ...d, [row.id]: e.target.value }))}
                      placeholder="Correct BMEI04…" style={{ ...iS, width:180, fontFamily:'monospace', fontSize:12, padding:'5px 8px' }} />
                    {fillDrafts[row.id] && <span style={{ fontFamily:'Noto Sans Meetei Mayek, sans-serif', fontSize:16 }}>{romanToMeetei(fillDrafts[row.id])}</span>}
                    {fillDrafts[row.id] && <button onClick={() => handleFillSave(row)} style={btnSm(C.navy)}>Save correction</button>}
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:'#991b1b', marginTop:4 }}>
                    This word started with a vowel sign that had no consonant to attach to — a word-initial
                    vowel case the transliterator can only guess at for 'a' and 'u'. Check the BMEI04 spelling
                    and re-save under Browse/Edit once confirmed.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Phrase template checklist ── */}
      <div style={{ paddingTop:16, borderTop:'1px solid '+C.border }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:6 }}>
          Common Phrase Templates ({phrases.filter(p => p.done).length}/{phrases.length} verified)
        </div>
        <div style={{ fontSize:11, color:C.slate, marginBottom:10 }}>
          Recurring full-sentence phrasings from the question bank. Word-by-word lookup gets English word
          order wrong for a real Meetei sentence — these need a one-time review by a fluent speaker/teacher
          as a whole sentence, saved as a <strong>sentence</strong>-type entry under "Add Entry". Nothing here
          is auto-translated.
        </div>
        <div>
          {phrases.map(p => (
            <div key={p.norm} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'7px 10px', borderBottom:'1px solid '+C.border, gap:10 }}>
              <div style={{ fontSize:13, color:C.navy }}>{p.phrase}</div>
              {p.done ? (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontFamily:'Noto Sans Meetei Mayek, sans-serif', fontSize:16 }}>{p.mayek_unicode}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:C.green }}>VERIFIED</span>
                </div>
              ) : (
                <span style={{ fontSize:10, fontWeight:700, color:C.amber }}>NOT YET REVIEWED</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DictTranslatePanel({ showToast }) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleTranslate = async () => {
    if (!input.trim()) return
    setLoading(true)
    try {
      const r = await translateText(input)
      setResult(r)
    } catch (err) {
      showToast('Translation failed: ' + err.message, C.rose)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result?.mayek) return
    try { await navigator.clipboard.writeText(result.mayek); showToast('Copied', C.green) }
    catch { showToast('Copy failed', C.rose) }
  }

  return (
    <div>
      <label style={lS}>English Text</label>
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={4}
        placeholder="Type an English word or sentence..."
        style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid '+C.border,
          fontSize:13, fontFamily:'monospace', resize:'vertical', boxSizing:'border-box' }} />
      <button onClick={handleTranslate} disabled={loading} style={{ ...btn(C.navy), marginTop:10 }}>
        {loading ? 'Translating...' : 'Translate'}
      </button>

      {result && (
        <div style={{ marginTop:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <label style={lS}>Meetei Mayek Output</label>
            {result.matchedSentence && (
              <span style={{ fontSize:11, fontWeight:700, color:C.green }}>Exact sentence match</span>
            )}
          </div>
          <div style={{ minHeight:60, padding:'10px 12px', borderRadius:7, background:'#f8fafc',
            border:'1px solid '+C.border, fontFamily:'Noto Sans Meetei Mayek, monospace', fontSize:20,
            lineHeight:1.8, whiteSpace:'pre-wrap', wordWrap:'break-word' }}>
            {result.mayek || <span style={{ color:'#94a3b8', fontSize:12, fontFamily:'inherit' }}>No output</span>}
          </div>
          <button onClick={handleCopy} style={{ ...btn(C.slate), marginTop:10 }}>Copy Mayek Text</button>

          <div style={{ marginTop:10, fontSize:12, color:C.slate }}>
            Coverage: {Math.round(result.coverage * 100)}% of words matched
          </div>

          {result.missingWords.length > 0 && (
            <div style={{ marginTop:10, padding:12, background:'#fffbeb', borderRadius:8, border:'1px solid #fde68a' }}>
              <div style={{ fontWeight:700, fontSize:12, color:'#92400e', marginBottom:6 }}>
                Not in dictionary yet ({result.missingWords.length}):
              </div>
              <div style={{ fontSize:13, color:'#78350f' }}>{result.missingWords.join(', ')}</div>
              <div style={{ fontSize:11, color:'#92400e', marginTop:6 }}>
                Add these under "Add Entry" to improve future translations.
              </div>
            </div>
          )}

          {result.reviewWords && result.reviewWords.length > 0 && (
            <div style={{ marginTop:10, padding:12, background:'#fef2f2', borderRadius:8, border:'1px solid #fecaca' }}>
              <div style={{ fontWeight:700, fontSize:12, color:'#991b1b', marginBottom:6 }}>
                ⚠ Unverified spelling ({result.reviewWords.length}):
              </div>
              <div style={{ fontSize:13, color:'#7f1d1d' }}>{result.reviewWords.join(', ')}</div>
              <div style={{ fontSize:11, color:'#991b1b', marginTop:6 }}>
                These words are in the dictionary but were flagged during entry (a word-initial vowel
                the transliterator couldn't safely resolve on its own). Check them under "Coverage" → Needs Review.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DictAddEntryPanel({ showToast, currentStaffId }) {
  const [entryType, setEntryType] = useState('word')
  const [english, setEnglish] = useState('')
  const [bmei04, setBmei04] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggested, setSuggested] = useState('') // keystrokes the offline translator gave, to record the source

  const preview = useMemo(() => { try { return romanToMeetei(bmei04) } catch { return '' } }, [bmei04])

  const suggest = async () => {
    if (!english.trim() || suggesting) return
    if (!offlineEnabled()) { showToast('Tick "Use the offline translator on this computer" above first', C.amber); return }
    setSuggesting(true)
    try {
      const out = await offlineToMayek([english.trim()])
      if (!out) { showToast('The offline translator is not running — start start-translator.bat', C.rose); return }
      if (!out[0]) { showToast('The offline translator gave no Meetei Mayek for this — type it in', C.amber); return }
      const keys = meeteiToRoman(out[0])
      setBmei04(keys); setSuggested(keys)
    } finally {
      setSuggesting(false)
    }
  }

  const handleSave = async () => {
    if (!english.trim() || !bmei04.trim()) {
      showToast('English and BMEI04 keystrokes are both required', C.amber); return
    }
    setSaving(true)
    try {
      await saveDictionaryEntry({
        entryType, english, bmei04,
        category: category.trim() || null,
        source: suggested && bmei04.trim() === suggested ? reviewedSource(OFFLINE_DRAFT_SOURCE) : null,
        createdBy: currentStaffId || null,
      })
      showToast('Saved to dictionary', C.green)
      setEnglish(''); setBmei04(''); setSuggested('')
    } catch (err) {
      showToast('Save failed: ' + err.message, C.rose)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {['word', 'sentence'].map(t => (
          <button key={t} onClick={() => setEntryType(t)}
            style={{ padding:'6px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12,
              fontWeight:700, fontFamily:'inherit',
              background: entryType === t ? C.navy : '#f1f5f9',
              color: entryType === t ? '#fff' : C.slate }}>
            {t === 'word' ? 'Single Word' : 'Full Sentence'}
          </button>
        ))}
      </div>

      <label style={lS}>English {entryType === 'word' ? 'Word' : 'Sentence'}</label>
      <input value={english} onChange={e => setEnglish(e.target.value)}
        placeholder={entryType === 'word' ? 'e.g. apple' : 'e.g. find the value of x'} style={iS} />

      <label style={{ ...lS, marginTop:12 }}>BMEI04 Keystrokes</label>
      <div style={{ display:'flex', gap:8 }}>
        <input value={bmei04} onChange={e => setBmei04(e.target.value)}
          placeholder="Type using BMEI04 keyboard layout" style={{ ...iS, flex:1, fontFamily:'monospace' }} />
        <button onClick={suggest} disabled={!english.trim() || suggesting} style={btnSm(C.violet)}
          title="Fills this in with the offline translator on this computer. Check it before saving.">
          {suggesting ? 'Translating…' : '✨ Translate'}
        </button>
      </div>
      {suggested && bmei04.trim() === suggested && (
        <div style={{ fontSize:11, color:C.slate, marginTop:4 }}>From the offline translator — check it, correct it if needed, then save.</div>
      )}

      <label style={{ ...lS, marginTop:12 }}>Category (optional)</label>
      <input value={category} onChange={e => setCategory(e.target.value)}
        placeholder="e.g. math, general, grammar" style={iS} />

      {bmei04.trim() && (
        <div style={{ marginTop:12 }}>
          <label style={lS}>Preview</label>
          <div style={{ padding:'10px 12px', borderRadius:7, background:'#f8fafc', border:'1px solid '+C.border,
            fontFamily:'Noto Sans Meetei Mayek, monospace', fontSize:20 }}>
            {preview}
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} style={{ ...btn(C.green), marginTop:14 }}>
        {saving ? 'Saving...' : 'Save to Dictionary'}
      </button>
    </div>
  )
}

function DictBulkImportPanel({ showToast, currentStaffId }) {
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const handleImport = async () => {
    if (!csvText.trim()) return
    setImporting(true); setResult(null)
    try {
      // Quote-aware: a sentence entry containing a comma must be quoted in
      // the CSV ("find x, then y") — a plain split(',') cut it apart.
      const [headerRow = [], ...dataRows] = parseCSV(csvText)
      const headers = headerRow.map(h => h.toLowerCase())
      const rows = dataRows.map(cells => {
        const row = {}
        headers.forEach((h, i) => { row[h] = cells[i] || '' })
        return row
      })
      const res = await bulkImportEntries(rows, { defaultSource:'bulk_import', createdBy: currentStaffId || null })
      setResult(res)
      showToast(`Imported ${res.inserted} entries`, C.green)
    } catch (err) {
      showToast('Import failed: ' + err.message, C.rose)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <div style={{ fontSize:12, color:C.slate, marginBottom:10 }}>
        Paste CSV with columns: <code>entry_type,english,bmei04,category</code> (entry_type and category are optional —
        entry_type auto-detects as "sentence" if the English text has more than one word). Rows with a blank
        bmei04 are skipped, so a wordlist CSV with empty bmei04 cells is safe to re-import as you fill it in.
        Put double quotes around any cell that contains a comma.
      </div>
      <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={9}
        placeholder={'entry_type,english,bmei04,category\nword,apple,AepL,general\nsentence,find the value of x,...,math'}
        style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid '+C.border,
          fontSize:12, fontFamily:'monospace', resize:'vertical', boxSizing:'border-box' }} />
      <button onClick={handleImport} disabled={importing} style={{ ...btn(C.navy), marginTop:10 }}>
        {importing ? 'Importing...' : 'Import CSV'}
      </button>

      {result && (
        <div style={{ marginTop:14 }}>
          <div style={{ fontWeight:700, color:C.green }}>{result.inserted} entries saved</div>
          {result.failed.length > 0 && (
            <div style={{ marginTop:10, padding:12, background:'#fef2f2', borderRadius:8, border:'1px solid #fecaca' }}>
              <div style={{ fontWeight:700, fontSize:12, color:'#991b1b', marginBottom:6 }}>
                {result.failed.length} rows failed{result.failed.length > 20 ? ' (showing first 20)' : ''}:
              </div>
              {result.failed.slice(0, 20).map((f, i) => (
                <div key={i} style={{ fontSize:11, color:'#7f1d1d' }}>{f.row.english || '(blank)'} — {f.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DictBrowsePanel({ showToast, isAdmin }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [entryType, setEntryType] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editBmei04, setEditBmei04] = useState('')
  const searchSeq = useRef(0)

  // Debounced: one request after typing pauses, not one per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const runSearch = useCallback(async () => {
    // Only the newest request may update the list — an older, slower
    // response arriving last used to overwrite the current results.
    const seq = ++searchSeq.current
    setLoading(true)
    try {
      const data = await searchDictionary({ query: debouncedQuery, entryType })
      if (seq === searchSeq.current) setRows(data)
    } catch (err) {
      if (seq === searchSeq.current) showToast('Search failed: ' + err.message, C.rose)
    } finally {
      if (seq === searchSeq.current) setLoading(false)
    }
  }, [debouncedQuery, entryType]) // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/set-state-in-effect -- server search on query change
  useEffect(() => { runSearch() }, [runSearch])

  // Deleting entries is admin-only, like deleting questions (the RLS
  // migration enforces the same rule server-side).
  const handleDelete = async (id) => {
    if (!isAdmin) return
    if (!window.confirm('Delete this dictionary entry?')) return
    try { await deleteDictionaryEntry(id); showToast('Deleted', C.rose); runSearch() }
    catch (err) { showToast('Delete failed: ' + err.message, C.rose) }
  }

  const handleEditSave = async (row) => {
    if (!editBmei04.trim()) { showToast('BMEI04 keystrokes cannot be blank', C.amber); return }
    try {
      await saveDictionaryEntry({ entryType: row.entry_type, english: row.english, bmei04: editBmei04, category: row.category, source: row.source })
      showToast('Updated', C.green); setEditingId(null); runSearch()
    } catch (err) { showToast('Update failed: ' + err.message, C.rose) }
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search English word/sentence..." style={{ ...iS, flex:1, minWidth:200 }} />
        {[[null, 'All'], ['word', 'Words'], ['sentence', 'Sentences']].map(([val, label]) => (
          <button key={label} onClick={() => setEntryType(val)}
            style={{ padding:'8px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12,
              fontWeight:700, fontFamily:'inherit',
              background: entryType === val ? C.navy : '#f1f5f9',
              color: entryType === val ? '#fff' : C.slate }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color:C.slate, fontSize:13 }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={{ color:C.slate, fontSize:13 }}>No entries found.</div>
      ) : (
        <div style={{ maxHeight:500, overflowY:'auto' }}>
          {rows.map(row => (
            <div key={row.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'10px 12px', borderBottom:'1px solid '+C.border, gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:C.navy }}>
                  {row.english}
                  <span style={{ marginLeft:8, fontSize:10, fontWeight:700, color:C.slate, textTransform:'uppercase' }}>
                    {row.entry_type}
                  </span>
                </div>
                {editingId === row.id ? (
                  <input value={editBmei04} onChange={e => setEditBmei04(e.target.value)}
                    style={{ ...iS, marginTop:4, fontFamily:'monospace', fontSize:12 }} />
                ) : (
                  <div style={{ fontSize:18, marginTop:2, fontFamily:'Noto Sans Meetei Mayek, sans-serif' }}>{row.mayek_unicode}</div>
                )}
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {editingId === row.id ? (
                  <>
                    <button onClick={() => handleEditSave(row)} style={btnSm(C.green)}>Save</button>
                    <button onClick={() => setEditingId(null)} style={btnSm(C.slate)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(row.id); setEditBmei04(row.bmei04) }} style={btnSm(C.teal)}>Edit</button>
                    {isAdmin && <button onClick={() => handleDelete(row.id)} style={btnSm(C.rose)}>Delete</button>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4: CREATE PAPER
// ══════════════════════════════════════════════════════════════════════════════
// Same bank row, made print-ready: merged options split ("65594 D)65494"
// in C with D empty), answer letter normalised, whitespace tidied.
// Rows typed or imported as "sainik school", "mathematics ", "natural
// numbers" should still land on the taxonomy names the picker uses.
const normName = v => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
function canonicalPlace(q) {
  const ck = COURSE_LIST.find(k => normName(k) === normName(q.course) || normName(COURSES[k].label) === normName(q.course))
  const course = ck || q.course
  const subs = COURSES[course]?.subjects || {}
  const subject = Object.keys(subs).find(x => normName(x) === normName(q.subject)) || q.subject
  const chapter = (subs[subject] || []).find(c => normName(c) === normName(q.chapter)) || q.chapter
  return { course, subject, chapter }
}

function paperReady(q) {
  const out = { ...q, ...canonicalPlace(q), ...(splitMergedOptions(q) || {}) }
  for (const k of ['question', 'question_mayek', 'option_a', 'option_b', 'option_c', 'option_d']) if (out[k] != null) out[k] = tidyText(out[k])
  out.correct_option = normalizeAnswer(q.correct_option)
  return out
}

function TabPaper({ questions: bankQuestions, showToast }) {
  const questions = useMemo(() => (bankQuestions || []).map(paperReady), [bankQuestions])
  const persisted = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') } } catch { return d } }
  const persist = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }
  const [course,       setCourse]       = useState('')
  const [subject,      setSubject]      = useState('')
  const [chapterSel,   setChapterSel]   = useState([])        // several chapters per paper
  const [selSubs,      setSelSubs]      = useState({})        // { "chapter␟sub": count }
  const [difficulty,   setDifficulty]   = useState('All')
  const [useMix,       setUseMix]       = useState(false)
  const [mix,          setMix]          = useState({ Easy: 30, Medium: 50, Hard: 20 })
  const [skipRecent,   setSkipRecent]   = useState(false)
  const [quality,      setQuality]      = useState(true)
  const [title,        setTitle]        = useState('')
  const [timeMinutes,  setTimeMinutes]  = useState('')
  const [instructions, setInstructions] = useState('Attempt all questions. Each question carries the marks shown against it. No negative marking unless stated.')
  const [layout,       setLayout]       = useState(() => persisted('gnsi_paper_layout', PAPER_LAYOUT_DEFAULT))
  const setLay = patch => setLayout(l => { const n = { ...l, ...patch }; persist('gnsi_paper_layout', n); return n })
  const [opts,         setOpts]         = useState(() => { const o = persisted('gnsi_paper_options', PAPER_OPTIONS_DEFAULT); return { ...o, fields: { ...PAPER_OPTIONS_DEFAULT.fields, ...o.fields }, weights: { ...PAPER_OPTIONS_DEFAULT.weights, ...o.weights } } })
  const setOpt = patch => setOpts(o => { const n = { ...o, ...patch }; persist('gnsi_paper_options', n); return n })
  const [preview,      setPreview]      = useState(null)
  const [downloading,  setDownloading]  = useState(false)
  const [templates,    setTemplates]    = useState(loadTemplates)
  const [history,      setHistory]      = useState(loadPaperHistory)
  const [tplName,      setTplName]      = useState('')
  const SEP = '␟'
  const courseSubjectList = course ? Object.keys(COURSES[course]?.subjects || {}) : []
  const chapters = (course && subject) ? (COURSES[course]?.subjects[subject] || []) : []
  const chapterLabel = chapterSel.length > 2 ? `${chapterSel.length} chapters` : chapterSel.join(', ')

  // Subsections available per chosen chapter (under the difficulty filter).
  const availableSubs = useMemo(() => {
    const map = {}
    if (!course || !subject || !chapterSel.length) return map
    const want = new Set(chapterSel)
    questions.filter(q => (q.course||'')===course && q.subject===subject && want.has(q.chapter) &&
      (difficulty==='All' || q.difficulty===difficulty) && (!quality || isCompleteQ(q)))
      .forEach(q => { const k = `${q.chapter}${SEP}${q.subsection||'General'}`; map[k] = (map[k]||0)+1 })
    return map
  }, [questions, course, subject, chapterSel, difficulty, quality, SEP])

  // Rows in the chosen chapters with no answer letter (they still go on the
  // paper; the key shows "—"), and rows missing their text or options A/B
  // (left out while "Only complete questions" is ticked).
  const { noAnswer, incomplete } = useMemo(() => {
    if (!course || !subject || !chapterSel.length) return { noAnswer: 0, incomplete: 0 }
    const want = new Set(chapterSel)
    const rows = questions.filter(q => (q.course||'')===course && q.subject===subject && want.has(q.chapter))
    return { noAnswer: rows.filter(q => !q.correct_option).length, incomplete: rows.filter(q => !isCompleteQ(q)).length }
  }, [questions, course, subject, chapterSel])

  // Everything in the chosen chapters, before the difficulty and quality
  // filters, so an empty pick can say which filter emptied it.
  const inScope = useMemo(() => {
    if (!course || !subject || !chapterSel.length) return 0
    const want = new Set(chapterSel)
    return questions.filter(q => (q.course||'')===course && q.subject===subject && want.has(q.chapter)).length
  }, [questions, course, subject, chapterSel])

  // When nothing is in scope: where do questions with these chapter names live?
  const elsewhere = useMemo(() => {
    if (!chapterSel.length || inScope) return []
    const want = new Set(chapterSel.map(normName))
    const map = new Map()
    questions.forEach(q => {
      if (!want.has(normName(q.chapter))) return
      const key = `${q.course || ''}\u241f${q.subject || ''}`
      map.set(key, (map.get(key) || 0) + 1)
    })
    return [...map.entries()].map(([k, n]) => { const [c, sj] = k.split('\u241f'); return { course: c, subject: sj, n } }).sort((x, y) => y.n - x.n)
  }, [questions, chapterSel, inScope])

  const toggleSub = key => setSelSubs(prev => { const n = { ...prev }; if (n[key] !== undefined) delete n[key]; else n[key] = Math.min(10, availableSubs[key] || 5); return n })
  const updateCount = (key, val) => setSelSubs(prev => ({ ...prev, [key]: Math.max(1, Math.min(availableSubs[key] || 1, parseInt(val) || 1)) }))
  const selectAllSubs = () => setSelSubs(Object.fromEntries(Object.entries(availableSubs).map(([k, c]) => [k, Math.min(5, c)])))
  const totalSelected = Object.entries(selSubs).reduce((a,[k,n]) => a + Math.min(n, availableSubs[k] || 0), 0)
  const toggleChapter = c => { setChapterSel(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]); setSelSubs(s => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith(c + SEP)))) }

  const handlePreview = () => {
    if (!course || !subject || !chapterSel.length) { showToast('Select course, subject and at least one chapter', C.amber); return }
    const blocks = Object.entries(selSubs).map(([k, count]) => { const [chapter, sub] = k.split(SEP); return { chapter, sub, count } })
    if (!blocks.length) { showToast('Select at least one subsection', C.amber); return }
    const { picked, shortfalls } = pickPaper(questions, { course, subject, blocks, difficulty, mix: useMix ? mix : null, exclude: skipRecent ? recentlyUsedIds(5) : new Set(), quality, dedupe: quality })
    if (!picked.length) { showToast('No questions available for the selected subsections', C.amber); return }
    setPreview(picked)
    if (!title) setTitle(`${subject} — ${chapterLabel}`)
    if (shortfalls.length) showToast(`Short by ${shortfalls.reduce((t, s) => t + s.count - s.got, 0)}: ${shortfalls.map(s => `${s.sub} ${s.got}/${s.count}`).join(', ')}`, C.amber)
  }

  // ── Preview editing ────────────────────────────────────────────────────
  const move = (i, d) => setPreview(p => { const a = [...p]; const j = i + d; if (j < 0 || j >= a.length) return a;[a[i], a[j]] = [a[j], a[i]]; return a })
  const removeQ = i => setPreview(p => p.filter((_, j) => j !== i))
  const swapQ = i => {
    const next = swapCandidate(questions, preview[i], preview, { exclude: skipRecent ? recentlyUsedIds(5) : new Set(), quality })
    if (!next) { showToast('No other question available in this subsection', C.amber); return }
    setPreview(p => p.map((q, j) => (j === i ? next : q)))
  }
  const sortBy = by => by && setPreview(p => sortPaper(p, by))

  // ── Build + export ──────────────────────────────────────────────────────
  const paperTitle = title || 'Question Paper'
  const seed = `${paperTitle}|${(preview || []).map(q => q.id).join(',')}`
  const sets = useMemo(() => (preview ? buildSets(preview, opts, seed) : []), [preview, opts, seed])
  const minutes = parseInt(timeMinutes) || Math.max(15, Math.round((preview?.length || 0) * 1.5))
  const record = what => setHistory(pushPaperHistory({ what, title: paperTitle, course, subject, chapters: chapterSel, questionIds: preview.map(q => q.id), n: preview.length, opts, layout, instructions, timeMinutes }))

  const handleDownload = async () => {
    if (!preview?.length) return
    setDownloading(true)
    try {
      await generatePDF({
        title: paperTitle, subject, chapter: chapterLabel, sets, timeMinutes: parseInt(timeMinutes) || undefined,
        instructions: instructions.trim() || undefined, layout, options: opts,
        fileName: sets.length > 1 ? `${paperTitle} Sets ${sets.map(s => s.code).join('')}` : paperTitle,
      })
      record('PDF')
      showToast(sets.length > 1 ? `📄 PDF with ${sets.length} sets downloaded!` : '📄 PDF downloaded!', C.green)
    } catch(e) { showToast('PDF failed: '+e.message, C.rose) }
    setDownloading(false)
  }
  const downloadWord = () => {
    // Word can't use the BMEI04 font, so Mayek goes out as Unicode script.
    const wordSets = sets.map(st => ({ ...st, questions: st.questions.map(q => ({ ...q, question_mayek: slideMayekUnicode(q.question_mayek, q.question_mayek_font) })) }))
    const html = paperWordHtml({ title: paperTitle, subject, chapterLabel, sets: wordSets, o: opts, timeMinutes: minutes, instructions })
    const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }))
    const a = document.createElement('a'); a.href = url; a.download = `${paperTitle.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Question_Paper'}.doc`
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500)
    record('Word'); showToast('Word file downloaded', C.green)
  }
  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); showToast(`${label} copied`, C.green) } catch { showToast('Copy failed — clipboard blocked', C.rose) }
  }

  // ── Templates & history ────────────────────────────────────────────────
  const saveTemplate = () => {
    const name = tplName.trim(); if (!name) return
    const list = [{ id: `t${Date.now()}`, name, opts, layout, instructions, timeMinutes, useMix, mix, quality }, ...templates.filter(t => t.name !== name)].slice(0, 20)
    setTemplates(list); saveTemplates(list); setTplName(''); showToast(`Template "${name}" saved`, C.green)
  }
  const applyTemplate = id => {
    const t = templates.find(x => x.id === id); if (!t) return
    setOpt(t.opts || {}); setLay(t.layout || {}); setInstructions(t.instructions || instructions); setTimeMinutes(t.timeMinutes || '')
    setUseMix(!!t.useMix); if (t.mix) setMix(t.mix); setQuality(t.quality !== false)
    showToast(`Template "${t.name}" applied`, C.green)
  }
  const deleteTemplate = id => { const list = templates.filter(t => t.id !== id); setTemplates(list); saveTemplates(list) }
  const reopen = h => {
    const byId = new Map(questions.map(q => [q.id, q]))
    const qs = (h.questionIds || []).map(id => byId.get(id)).filter(Boolean)
    if (!qs.length) { showToast('Those questions are no longer in the bank', C.amber); return }
    setCourse(h.course || ''); setSubject(h.subject || ''); setChapterSel(h.chapters || []); setTitle(h.title || '')
    if (h.opts) setOpt(h.opts); if (h.layout) setLay(h.layout); if (h.instructions) setInstructions(h.instructions); setTimeMinutes(h.timeMinutes || '')
    setPreview(qs)
    showToast(qs.length < h.n ? `Reopened — ${h.n - qs.length} question(s) no longer exist` : `Reopened "${h.title}"`, qs.length < h.n ? C.amber : C.green)
  }

  const bp = useMemo(() => (preview ? paperBlueprint(preview, opts) : null), [preview, opts])
  const F = [['name','Name'],['roll','Roll No.'],['cls','Class'],['section','Section'],['date','Date'],['sign','Signature']]
  const sub = { fontSize:12, fontWeight:800, color:C.navy, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:8 }
  const panel = { border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', marginBottom:14, background:'#fafbfc' }
  const grid = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }
  const chk = (label, v, on, aria) => (
    <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:12.5, color:C.navy, fontWeight:600 }}>
      <input type="checkbox" checked={!!v} onChange={e => on(e.target.checked)} aria-label={aria || label} />{label}
    </label>
  )

  return (
    <>
      <div style={cardS}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.navy }}>📄 Create Question Paper</div>
          {templates.length > 0 && (
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <select style={{ ...iS, width:'auto', padding:'6px 10px' }} value="" onChange={e => applyTemplate(e.target.value)} aria-label="Apply template">
                <option value="">Apply a template…</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="qb-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={lS}>Course *</label>
            <select style={iS} value={course} aria-label="Course"
              onChange={e => { setCourse(e.target.value); setSubject(''); setChapterSel([]); setSelSubs({}) }}>
              <option value="">Select</option>
              {COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Subject *</label>
            <select style={{ ...iS, opacity:course?1:.5 }} value={subject} aria-label="Subject"
              onChange={e => { setSubject(e.target.value); setChapterSel([]); setSelSubs({}) }} disabled={!course}>
              <option value="">Select</option>
              {courseSubjectList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Difficulty Filter</label>
            <select style={iS} value={difficulty} onChange={e => setDifficulty(e.target.value)} aria-label="Difficulty filter">
              <option value="All">All Difficulties</option>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {chapters.length > 0 && (
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lS}>Chapters * <span style={{ fontWeight:400, textTransform:'none' }}>({chapterSel.length} selected — pick one or several)</span></label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {chapters.map(c => (
                  <button key={c} type="button" onClick={() => toggleChapter(c)} aria-pressed={chapterSel.includes(c)}
                    style={{ ...btnSm(chapterSel.includes(c) ? C.navy : '#fff', chapterSel.includes(c) ? '#fff' : C.slate), border:`1px solid ${chapterSel.includes(c) ? C.navy : C.border}` }}>
                    {chapterSel.includes(c) ? '✓ ' : ''}{c}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lS}>Paper Title</label>
            <input style={iS} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fractions — Unit Test" aria-label="Paper title" />
          </div>
          <div>
            <label style={lS}>Time Allowed <span style={{ fontWeight:400, textTransform:'none' }}>(minutes)</span></label>
            <input type="number" min={1} style={iS} value={timeMinutes} onChange={e => setTimeMinutes(e.target.value)} placeholder="Auto (1.5 min/question)" />
          </div>
          <div style={{ gridColumn:'2/-1' }}>
            <label style={lS}>General Instructions</label>
            <textarea style={{ ...iS, resize:'vertical' }} rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} />
          </div>
        </div>

        {Object.keys(availableSubs).length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, gap:8, flexWrap:'wrap' }}>
              <label style={{ ...lS, margin:0 }}>Subsections & question count <span style={{ fontWeight:400, marginLeft:6, textTransform:'none' }}>(Total: {totalSelected})</span></label>
              <div style={{ display:'flex', gap:6 }}>
                <button type="button" onClick={selectAllSubs} style={btnSm('#fff', C.navy)}>Select all (5 each)</button>
                <button type="button" onClick={() => setSelSubs({})} style={btnSm('#fff', C.slate)}>Clear</button>
              </div>
            </div>
            {chapterSel.map(ch => {
              const entries = Object.entries(availableSubs).filter(([k]) => k.startsWith(ch + SEP))
              if (!entries.length) return <div key={ch} style={{ fontSize:12, color:C.amber, margin:'6px 0' }}>⚠ {ch}: no questions{difficulty !== 'All' ? ` at ${difficulty}` : ''}</div>
              return (
                <div key={ch} style={{ marginBottom:10 }}>
                  {chapterSel.length > 1 && <div style={{ fontSize:12, fontWeight:700, color:C.navy, margin:'4px 0 6px' }}>{ch}</div>}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:8 }}>
                    {entries.map(([key, count]) => {
                      const subName = key.split(SEP)[1], on = selSubs[key] !== undefined
                      return (
                        <div key={key} onClick={() => toggleSub(key)} role="checkbox" aria-checked={on} aria-label={`${ch} ${subName}`}
                          style={{ padding:'9px 12px', borderRadius:9, cursor:'pointer', border:`2px solid ${on?C.navy:C.border}`, background:on?'#eff6ff':'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:on?C.navy:C.slate }}>{on ? '☑' : '☐'} {subName}</div>
                            <div style={{ fontSize:11, color:C.slate }}>{count} available</div>
                          </div>
                          {on && (
                            <div onClick={e=>e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ fontSize:11, color:C.slate }}>Pick:</span>
                              <input type="number" min={1} max={count} value={selSubs[key]} onChange={e => updateCount(key, e.target.value)} aria-label={`${subName} count`}
                                style={{ width:50, padding:'3px 6px', borderRadius:5, border:`1px solid ${C.border}`, fontSize:12, textAlign:'center' }} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {chapterSel.length > 0 && Object.keys(availableSubs).length === 0 && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'#fef9c3', border:'1px solid #fde68a', fontSize:13, color:'#92400e', marginBottom:14 }}>
            {inScope === 0 ? (
              elsewhere.length ? (
                <>
                  ⚠️ No questions are saved under {COURSES[course]?.label || course} · {subject} for {chapterLabel}, but questions with {chapterSel.length > 1 ? 'these chapter names' : 'this chapter name'} exist elsewhere:
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                    {elsewhere.map(e => COURSES[e.course]?.subjects?.[e.subject]
                      ? <button key={e.course + e.subject} type="button" style={btnSm('#fff', C.navy)} onClick={() => { setCourse(e.course); setSubject(e.subject); setSelSubs({}) }}>Switch to {COURSES[e.course].label} · {e.subject} ({e.n})</button>
                      : <span key={e.course + e.subject} style={{ fontSize:12 }}>{e.n} saved with {e.course ? `course “${e.course}”` : 'no course'}{e.subject ? ` and subject “${e.subject}”` : ''} — fix them in the Question Bank tab (✏️ Edit).</span>)}
                  </div>
                </>
              ) : (
                <>⚠️ No questions found for the chosen chapter(s). Add questions using Manual Add or Bulk Paste.</>
              )
            ) : (
              <>
                ⚠️ {inScope} question{inScope === 1 ? ' is' : 's are'} in {chapterSel.length > 1 ? 'these chapters' : 'this chapter'}, but none match the current filters:
                <ul style={{ margin:'6px 0 8px 18px', padding:0 }}>
                  {quality && incomplete > 0 && <li>{incomplete === inScope ? 'All of them are' : `${incomplete} of them are`} missing the question text or options A/B, and “Only complete questions” leaves those out.</li>}
                  {difficulty !== 'All' && <li>Difficulty is set to {difficulty}.</li>}
                </ul>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {quality && incomplete > 0 && <button type="button" style={btnSm('#fff', C.navy)} onClick={() => setQuality(false)}>Include incomplete questions</button>}
                  {difficulty !== 'All' && <button type="button" style={btnSm('#fff', C.navy)} onClick={() => setDifficulty('All')}>Any difficulty</button>}
                </div>
              </>
            )}
          </div>
        )}

        <div style={panel}>
          <div style={sub}>Picking</div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
            {chk('Balance difficulty', useMix, setUseMix)}
            {useMix && DIFFICULTIES.map(d => (
              <span key={d} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:C.slate }}>{d}
                <input type="number" min={0} max={100} value={mix[d]} onChange={e => setMix(m => ({ ...m, [d]: Number(e.target.value) || 0 }))} aria-label={`${d} %`}
                  style={{ width:52, padding:'3px 6px', borderRadius:5, border:`1px solid ${C.border}`, fontSize:12 }} />%</span>
            ))}
            {chk('Skip questions used in my last 5 papers', skipRecent, setSkipRecent)}
            {chk('Only complete questions, no near-duplicates', quality, setQuality)}
            {noAnswer > 0 && (
              <div role="status" style={{ fontSize:11.5, color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:6, padding:'6px 8px', marginTop:6 }}>
                ⚠ {noAnswer} question{noAnswer === 1 ? '' : 's'} in {chapterSel.length > 1 ? 'these chapters' : 'this chapter'} {noAnswer === 1 ? 'has' : 'have'} no correct answer set.
                {' They are still included; the answer key shows “—” for them.'} To fill the key, set answers in the Question Bank tab (✏️ Edit) or re-upload with the answer key.
              </div>
            )}
          </div>
        </div>

        <div style={panel}>
          <div style={sub}>Layout</div>
          <div style={grid}>
            <div><label style={lS}>Page columns</label>
              <select style={iS} value={layout.columns} onChange={e=>setLay({ columns:Number(e.target.value) })} aria-label="Page columns">
                <option value={1}>One column</option><option value={2}>Two columns</option></select></div>
            <div><label style={lS}>Options per row</label>
              <select style={iS} value={layout.optionCols} onChange={e=>setLay({ optionCols:e.target.value === 'auto' ? 'auto' : Number(e.target.value) })} aria-label="Options per row">
                <option value="auto">Auto (fit)</option><option value={4}>4 in a row</option><option value={2}>2 × 2</option><option value={1}>1 per line</option></select></div>
            <div><label style={lS}>Spacing</label>
              <select style={iS} value={layout.spacing} onChange={e=>setLay({ spacing:e.target.value })} aria-label="Spacing">
                <option value="normal">Normal</option><option value="compact">Compact (saves paper)</option></select></div>
            <div><label style={lS}>Font</label>
              <select style={iS} value={layout.font} onChange={e=>setLay({ font:e.target.value })} aria-label="Font">
                <option value="helvetica">Helvetica (sans)</option><option value="times">Times (serif)</option><option value="courier">Courier (typewriter)</option></select></div>
            <div><label style={lS}>Text size</label>
              <select style={iS} value={layout.size} onChange={e=>setLay({ size:e.target.value })} aria-label="Text size">
                <option value="S">Small</option><option value="M">Medium</option><option value="L">Large</option></select></div>
            <div><label style={lS}>Answer lines</label>
              <select style={iS} value={opts.answerSpace} onChange={e=>setOpt({ answerSpace:Number(e.target.value) })} aria-label="Answer lines">
                <option value={0}>None (MCQ)</option><option value={2}>2 lines</option><option value={3}>3 lines</option><option value={5}>5 lines</option></select></div>
          </div>
        </div>

        <div style={panel}>
          <div style={sub}>Paper</div>
          <div style={grid}>
            <div><label style={lS}>Marks</label>
              <select style={iS} value={opts.marksMode} onChange={e=>setOpt({ marksMode:e.target.value })} aria-label="Marks scheme">
                <option value="bank">As saved in the bank</option><option value="flat">Same for every question</option><option value="difficulty">By difficulty</option></select></div>
            {opts.marksMode === 'flat' && <div><label style={lS}>Marks each</label><input type="number" min={0} step={0.5} style={iS} value={opts.marksFlat} onChange={e=>setOpt({ marksFlat:e.target.value })} aria-label="Marks each" /></div>}
            {opts.marksMode === 'difficulty' && DIFFICULTIES.map(d => <div key={d}><label style={lS}>{d} marks</label><input type="number" min={0} step={0.5} style={iS} value={opts.weights[d]} onChange={e=>setOpt({ weights:{ ...opts.weights, [d]: e.target.value } })} aria-label={`${d} marks`} /></div>)}
            <div><label style={lS}>− per wrong</label><input type="number" min={0} step={0.25} style={iS} value={opts.negative} onChange={e=>setOpt({ negative:e.target.value })} aria-label="Negative marks" /></div>
            <div><label style={lS}>Sections</label>
              <select style={iS} value={opts.sections} onChange={e=>setOpt({ sections:e.target.value })} aria-label="Sections">
                <option value="none">No sections</option><option value="chapter">By chapter</option><option value="subsection">By subsection</option></select></div>
            <div><label style={lS}>Sets</label>
              <select style={iS} value={opts.sets} onChange={e=>setOpt({ sets:Number(e.target.value) })} aria-label="Sets">
                {[1,2,3,4].map(n => <option key={n} value={n}>{'ABCD'.slice(0,n).split('').join(' · ')}</option>)}</select></div>
            <div><label style={lS}>Answer key</label>
              <select style={iS} value={opts.answerKey} onChange={e=>setOpt({ answerKey:e.target.value })} aria-label="Answer key">
                <option value="page">Separate page</option><option value="inline">Marked on the paper</option><option value="none">None</option></select></div>
            <div><label style={lS}>Language</label>
              <select style={iS} value={opts.showMayek ? 'both' : 'en'} onChange={e=>setOpt({ showMayek:e.target.value === 'both' })} aria-label="Language">
                <option value="both">English + Meitei Mayek</option><option value="en">English only</option></select></div>
          </div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:10 }}>
            {opts.sets > 1 && chk('Shuffle options in sets B–D', opts.shuffleOptions, v => setOpt({ shuffleOptions:v }))}
            {chk('OMR answer sheet', opts.omr, v => setOpt({ omr:v }))}
            {chk('Teacher blueprint page', opts.blueprint, v => setOpt({ blueprint:v }))}
            {chk('"End of paper" line', opts.endMarker, v => setOpt({ endMarker:v }))}
          </div>
        </div>

        <div style={panel}>
          <div style={sub}>Header & student details</div>
          <div style={grid}>
            <div><label style={lS}>Institute</label><input style={iS} value={opts.institute} onChange={e=>setOpt({ institute:e.target.value })} aria-label="Institute" /></div>
            <div><label style={lS}>Tagline</label><input style={iS} value={opts.tagline} onChange={e=>setOpt({ tagline:e.target.value })} aria-label="Tagline" /></div>
            <div><label style={lS}>Exam / class line</label><input style={iS} value={opts.examLine} onChange={e=>setOpt({ examLine:e.target.value })} placeholder="e.g. Class 6 · Unit Test 2" aria-label="Exam line" /></div>
            <div><label style={lS}>Paper date</label><input type="date" style={iS} value={opts.paperDate} onChange={e=>setOpt({ paperDate:e.target.value })} aria-label="Paper date" /></div>
            <div><label style={lS}>Watermark</label><input style={iS} value={opts.watermark} onChange={e=>setOpt({ watermark:e.target.value })} placeholder="e.g. CONFIDENTIAL" aria-label="Watermark" /></div>
          </div>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:10 }}>
            <span style={{ fontSize:12, color:C.slate, fontWeight:600 }}>Student fields:</span>
            {F.map(([k, l]) => <span key={k}>{chk(l, opts.fields[k], v => setOpt({ fields:{ ...opts.fields, [k]: v } }), `Field ${l}`)}</span>)}
          </div>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={handlePreview} disabled={!subject||!chapterSel.length||!totalSelected} style={btn(C.navy, !subject||!chapterSel.length||!totalSelected)}>
            👁 Preview Paper ({totalSelected} questions)
          </button>
          <span style={{ flex:1 }} />
          <input style={{ ...iS, width:190 }} value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="Template name…" aria-label="Template name" />
          <button onClick={saveTemplate} disabled={!tplName.trim()} style={btn(C.slate, !tplName.trim())}>💾 Save settings as template</button>
        </div>
        {templates.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
            {templates.map(t => (
              <span key={t.id} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, padding:'3px 8px', borderRadius:99, background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                {t.name}<button onClick={() => deleteTemplate(t.id)} aria-label={`Delete template ${t.name}`} style={{ border:'none', background:'none', cursor:'pointer', color:C.rose, padding:0 }}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <div style={cardS}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
            <strong style={{ color:C.navy }}>{preview.length} questions · {preview.reduce((t, q) => t + marksOf(q, opts), 0)} marks{sets.length > 1 ? ` · ${sets.length} sets` : ''}</strong>
            {bp && <span style={{ fontSize:12, color:C.slate }}>Easy {bp.total.Easy} · Medium {bp.total.Medium} · Hard {bp.total.Hard} · {bp.rows.length} chapter{bp.rows.length > 1 ? 's' : ''}</span>}
            <span style={{ flex:1 }} />
            <select style={{ ...iS, width:'auto', padding:'6px 10px' }} value="" onChange={e => sortBy(e.target.value)} aria-label="Sort questions">
              <option value="">Sort…</option><option value="chapter">By chapter</option><option value="difficulty">By difficulty</option><option value="shuffle">Shuffle</option>
            </select>
          </div>
          <div id="qbank-paper-preview" style={{ position:'relative', border:`2px solid ${C.navy}`, borderRadius:10, padding:'20px 24px', marginBottom:16, background:'#fff', overflow:'hidden' }}>
            {opts.watermark && <div aria-hidden style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', fontSize:64, fontWeight:800, color:'rgba(100,116,139,.08)', transform:'rotate(-28deg)' }}>{opts.watermark}</div>}
            <div style={{ textAlign:'center', borderBottom:`1px solid ${C.border}`, paddingBottom:12, marginBottom:14 }}>
              <div style={{ fontSize:18, fontWeight:800, color:C.navy }}>{opts.institute}</div>
              <div style={{ fontSize:11, color:C.slate }}>{opts.tagline}</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginTop:8 }}>{paperTitle}</div>
              <div style={{ fontSize:12, color:C.slate, marginTop:4 }}>Subject: {subject} | Chapter: {chapterLabel} | Date: {opts.paperDate ? new Date(opts.paperDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : today()}</div>
              {opts.examLine && <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginTop:2 }}>{opts.examLine}</div>}
            </div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, color:'#374151', marginBottom:12 }}>
              {F.filter(([k]) => opts.fields[k]).map(([k, l]) => <span key={k}>{l}: <span style={{ display:'inline-block', width:80, borderBottom:`1px solid ${C.border}` }}>&nbsp;</span></span>)}
            </div>
            <div style={{ padding:'10px 14px', borderRadius:8, background:'#f0f6ff', border:'1px solid #bfdbfe', marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:C.navy, marginBottom:6 }}>
                <span>Time Allowed: {minutes} minutes</span>
                <span>Maximum Marks: {preview.reduce((s,q)=>s+marksOf(q, opts),0)}</span>
              </div>
              <div style={{ fontSize:11, color:'#475569' }}><strong>General Instructions:</strong> {instructions}{Number(opts.negative) > 0 && ` ${opts.negative} mark(s) will be deducted for every wrong answer.`}</div>
            </div>

            <div style={{ columnCount: layout.columns === 2 ? 2 : 1, columnGap: 28, columnRule: layout.columns === 2 ? `1px solid ${C.border}` : undefined,
              fontFamily: PAPER_FONT_CSS[layout.font], fontSize: `${(PAPER_SIZE_PT[layout.size] || 10.5) + 2}px` }}>
            {(() => { let n = 0; const idx = new Map(preview.map((q, i) => [q, i])); return groupSections(preview, opts.sections).map((g, gi) => (
              <div key={gi}>
                {g.name && <div style={{ background:C.navy, color:'#fff', fontSize:11.5, fontWeight:700, padding:'4px 8px', borderRadius:4, margin:'4px 0 8px', breakInside:'avoid' }}>SECTION {sectionLetter(gi)} — {g.name}</div>}
                {g.items.map(q => {
                  const i = idx.get(q); n++
                  const optCols = layout.optionCols === 'auto'
                    ? (['a','b','c','d'].every(k => String(q[`option_${k}`] || '').length <= (layout.columns === 2 ? 7 : 16) && !(opts.showMayek && q[`option_${k}_mayek`])) ? 4
                      : ['a','b','c','d'].every(k => String(q[`option_${k}`] || '').length <= (layout.columns === 2 ? 18 : 40)) ? 2 : 1)
                    : Number(layout.optionCols)
                  return (
                  <div key={q.id||i} style={{ marginBottom: layout.spacing === 'compact' ? 6 : 14, breakInside:'avoid' }} className="qb-paper-q">
                    <div style={{ fontSize:'1.08em', fontWeight:600, color:'#1e293b', marginBottom:(opts.showMayek && q.question_mayek) ? 2 : (layout.spacing === 'compact' ? 3 : 6) }}>
                      <span style={{ color:C.slate, marginRight:6 }}>Q{n}.</span>{q.question}
                      <span style={{ float:'right', fontSize:11, color:C.slate }}>
                        [{marksOf(q, opts)}M]
                        <span style={{ marginLeft:6, whiteSpace:'nowrap' }}>
                          <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move question ${n} up`} style={miniB}>↑</button>
                          <button onClick={() => move(i, 1)} disabled={i === preview.length - 1} aria-label={`Move question ${n} down`} style={miniB}>↓</button>
                          <button onClick={() => swapQ(i)} aria-label={`Swap question ${n}`} title="Swap for another question from the same subsection" style={miniB}>⇄</button>
                          <button onClick={() => removeQ(i)} aria-label={`Remove question ${n}`} style={{ ...miniB, color:C.rose }}>✕</button>
                        </span>
                      </span>
                    </div>
                    {opts.showMayek && q.question_mayek && <div style={{ fontSize:13, color:'#374151', marginBottom:6, fontFamily:mayekFontFamily(q.question_mayek_font) }}><MayekText text={q.question_mayek} font={q.question_mayek_font} /></div>}
                    {q.diagram_url && <img src={q.diagram_url} alt="diagram" style={{ maxWidth:200, maxHeight:140, borderRadius:6, marginBottom:6, display:'block' }} />}
                    <div style={{ display:'grid', gridTemplateColumns:`repeat(${optCols},minmax(0,1fr))`, gap: layout.spacing === 'compact' ? 1 : 4 }}>
                      {['A','B','C','D'].map(l => (
                        <div key={l} style={{ fontSize:'1em', padding: layout.spacing === 'compact' ? '1px 6px' : '3px 8px', color:'#374151', background: opts.answerKey === 'inline' && q.correct_option===l ? '#dcfce7' : undefined, borderRadius:4 }}>
                          <span style={{ fontWeight:700, color:C.slate, marginRight:4 }}>{l}.</span>
                          {q[`option_${l.toLowerCase()}`]||'—'}
                          {opts.answerKey === 'inline' && q.correct_option===l && <span style={{ color:C.green, marginLeft:6, fontWeight:700 }}>✓</span>}
                          {opts.showMayek && q[`option_${l.toLowerCase()}_mayek`] && <div style={{ fontFamily:mayekFontFamily(q.question_mayek_font) }}><MayekText text={q[`option_${l.toLowerCase()}_mayek`]} font={q.question_mayek_font} /></div>}
                        </div>
                      ))}
                    </div>
                    {Array.from({ length: Number(opts.answerSpace) || 0 }).map((_, k) => <div key={k} style={{ borderBottom:'1px dotted #94a3b8', height:18 }} />)}
                    <div style={{ height:1, background:C.border, marginTop: layout.spacing === 'compact' ? 5 : 10 }} />
                  </div>
                  )
                })}
              </div>
            )) })()}
            </div>
            {opts.endMarker && <div style={{ textAlign:'center', fontSize:12, fontWeight:700, color:C.slate, marginTop:8 }}>*** End of paper ***</div>}
          </div>

          {opts.blueprint && bp && (
            <div style={{ marginBottom:14, overflowX:'auto' }}>
              <div style={sub}>Blueprint</div>
              <table style={{ borderCollapse:'collapse', fontSize:12, width:'100%' }}>
                <thead><tr>{['Chapter','Easy','Medium','Hard','Total','Marks'].map(h => <th key={h} style={{ textAlign:h==='Chapter'?'left':'center', padding:'5px 8px', background:'#f0f6ff', border:`1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
                <tbody>{[...bp.rows, { chapter:'Total', ...bp.total }].map(r => (
                  <tr key={r.chapter} style={r.chapter === 'Total' ? { fontWeight:700 } : undefined}>{[r.chapter, r.Easy, r.Medium, r.Hard, r.total, r.marks].map((c, k) => <td key={k} style={{ textAlign:k?'center':'left', padding:'5px 8px', border:`1px solid ${C.border}` }}>{c}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={handleDownload} disabled={downloading || !preview.length} style={btn(C.green, downloading || !preview.length)}>
              {downloading ? '⏳ Generating PDF…' : `⬇ Download PDF${sets.length > 1 ? ` (${sets.length} sets)` : ''}`}
            </button>
            <button onClick={downloadWord} disabled={!preview.length} style={btn(C.navy, !preview.length)}>📝 Word</button>
            <button onClick={() => copy(answerKeyText(sets, paperTitle), 'Answer key')} style={btn(C.slate)}>🔑 Copy answer key</button>
            <button onClick={() => copy(paperText(preview, paperTitle, opts), 'Paper text')} style={btn(C.slate)}>💬 Copy for WhatsApp</button>
            <button onClick={handlePreview} style={btn(C.navy)}>🔀 Re-pick</button>
            <CastButton presentTargetId="qbank-paper-preview" title={paperTitle} showToast={showToast} />
            <button onClick={() => setPreview(null)} style={btn(C.slate)}>✕ Close</button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={cardS}>
          <div style={sub}>Recent papers</div>
          {history.slice(0, 8).map(h => (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12.5 }}>
              <span style={{ flex:1, minWidth:0 }}><strong style={{ color:C.navy }}>{h.title}</strong> <span style={{ color:C.slate }}>· {h.n} Q · {h.what} · {new Date(h.at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span></span>
              <button onClick={() => reopen(h)} style={btnSm('#fff', C.navy)}>Reopen</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
const miniB = { border:'1px solid #e2e8f0', background:'#fff', borderRadius:5, padding:'0 5px', fontSize:11, cursor:'pointer', marginLeft:2, lineHeight:'16px' }

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5: ONLINE TEST (unchanged)
// ══════════════════════════════════════════════════════════════════════════════
// ── CAST QUESTION OVERLAY ─────────────────────────────────────────────────
// A stripped-down, full-screen, question-text-only view for casting to a
// classroom display during a live test. Deliberately omits options and any
// answer/selection state — the whole point is the shared screen shows only
// what the teacher is asking, not what any individual student has picked.
function CastQuestionOverlay({ questions, index, onIndexChange, onClose }) {
  const q = questions?.[index]
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndexChange(i => Math.min((questions?.length||1)-1, i+1))
      if (e.key === 'ArrowLeft')  onIndexChange(i => Math.max(0, i-1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onIndexChange, questions])

  if (!q) return null

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100000, background:C.navy,
      display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'14px 22px', background:'rgba(0,0,0,.2)' }}>
        <span style={{ color:'#fff', fontSize:13, fontWeight:700, opacity:.85 }}>
          📡 Casting Question {index+1} of {questions.length} — options hidden on shared screen
        </span>
        <button onClick={onClose} style={{ ...btnSm('rgba(255,255,255,.15)', '#fff'), padding:'6px 16px' }}>✕ Close</button>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ fontSize:'clamp(22px, 3.2vw, 40px)', fontWeight:700, color:'#fff', textAlign:'center', maxWidth:1000, lineHeight:1.5 }}>
          {q.question}
        </div>
        {q.question_mayek && (
          <div style={{ fontSize:'clamp(18px, 2.4vw, 28px)', color:'#cbd5e1', textAlign:'center', maxWidth:1000, marginTop:20, fontFamily:mayekFontFamily(q.question_mayek_font) }}>
            <MayekText text={q.question_mayek} font={q.question_mayek_font} />
          </div>
        )}
        {q.diagram_url && (
          <img src={q.diagram_url} alt="diagram" style={{ maxWidth:'60%', maxHeight:300, marginTop:28, borderRadius:10 }} />
        )}
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:16, padding:'20px 0 32px' }}>
        <button onClick={() => onIndexChange(i => Math.max(0, i-1))} disabled={index===0}
          style={btn('#334155', index===0)}>← Previous</button>
        <button onClick={() => onIndexChange(i => Math.min(questions.length-1, i+1))} disabled={index===questions.length-1}
          style={btn(C.green, index===questions.length-1)}>Next →</button>
      </div>
    </div>
  )
}

function TabTest({ questions, showToast }) {
  const [studentName, setStudentName] = useState('')
  const [course,      setCourse]      = useState('')
  const [subject,     setSubject]     = useState('')
  const [chapter,     setChapter]     = useState('')
  const [selSubs,     setSelSubs]     = useState(new Set())
  const [count,       setCount]       = useState(20)
  const [testQs,      setTestQs]      = useState(null)
  const [answers,     setAnswers]     = useState({})
  const [submitted,   setSubmitted]   = useState(false)
  const [result,      setResult]      = useState(null)
  const [timeLeft,    setTimeLeft]    = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [history,     setHistory]     = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [castOpen,      setCastOpen]      = useState(false)
  const [castQIndex,    setCastQIndex]    = useState(0)
  const courseSubjectList = course ? Object.keys(COURSES[course]?.subjects || {}) : []
  const chapters = (course && subject) ? (COURSES[course]?.subjects[subject] || []) : []

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setHistoryLoading(true)
      const { data, error } = await supabase
        .from('qbank_test_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (!cancelled) {
        if (!error) setHistory(data || [])
        setHistoryLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const availableSubs = useMemo(() => {
    if (!course || !subject || !chapter) return []
    const ss = new Set(questions.filter(q=>(q.course||'')===course&&q.subject===subject&&q.chapter===chapter).map(q=>q.subsection||'General'))
    return [...ss].sort()
  }, [questions, course, subject, chapter])

  // Latest questions/answers for handleSubmit, which can fire from the
  // timer effect. Read through refs so the scoring + DB insert happen
  // exactly once, outside any state updater — React may call updater
  // functions twice (StrictMode does in dev), which previously saved every
  // test result twice.
  const testQsRef = useRef(null)
  const answersRef = useRef({})
  const submittedRef = useRef(false)
  useEffect(() => { testQsRef.current = testQs }, [testQs])
  useEffect(() => { answersRef.current = answers }, [answers])

  const handleSubmit = useCallback(() => {
    const qs = testQsRef.current
    // Guard: the timer hitting 0 while a "Submit test?" confirm is open
    // must not produce a second submission.
    if (!qs || submittedRef.current) return
    submittedRef.current = true
    const ans = answersRef.current
    setTimerActive(false)
    const correct = qs.filter(q => ans[q._testIdx] === q.correct_option).length
    const wrong   = qs.filter(q => ans[q._testIdx] && ans[q._testIdx] !== q.correct_option).length
    const skipped = qs.filter(q => !ans[q._testIdx]).length
    const score   = qs.reduce((a, q) => ans[q._testIdx] === q.correct_option ? a + (q.marks||1) : a, 0)
    const maxScore= qs.reduce((a, q) => a + (q.marks||1), 0)
    const pct     = maxScore ? Math.round((score/maxScore)*100) : 0
    setResult({ correct, wrong, skipped, score, maxScore, pct })
    setSubmitted(true)
    // Persist attempt — best-effort, doesn't block showing the result
    supabase.from('qbank_test_results').insert({
      student_name: studentName,
      subject, chapter,
      question_count: qs.length,
      correct, wrong, skipped,
      score, max_score: maxScore, percent: pct,
    }).then(({ error }) => {
      if (error) console.error('Failed to save test result:', error.message)
      else supabase.from('qbank_test_results').select('*').order('created_at', { ascending: false }).limit(20)
        .then(({ data }) => setHistory(data || []))
    })
  }, [studentName, subject, chapter])

  useEffect(() => {
    if (!timerActive) return
    if (timeLeft <= 0) { handleSubmit(); return }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [timerActive, timeLeft, handleSubmit])

  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const handleStart = () => {
    if (!studentName.trim()) { showToast('Enter student name', C.amber); return }
    if (!course || !subject || !chapter) { showToast('Select course, subject and chapter', C.amber); return }
    const subFilter = selSubs.size > 0 ? [...selSubs] : availableSubs
    const pool = shuffled(questions.filter(q =>
      (q.course||'')===course && q.subject===subject && q.chapter===chapter &&
      subFilter.includes(q.subsection||'General')
    )).slice(0, count)
    if (!pool.length) { showToast('No questions available — add questions first', C.amber); return }
    const indexedPool = pool.map((q,i) => ({...q, _testIdx: i}))
    submittedRef.current = false
    setTestQs(indexedPool); setAnswers({}); setSubmitted(false); setResult(null)
    setTimeLeft(pool.length * 90); setTimerActive(true)
    setCastOpen(false); setCastQIndex(0)
  }

  if (submitted && result) {
    const { correct, wrong, skipped, score, maxScore, pct } = result
    const resultColor = pct>=75 ? C.green : pct>=50 ? C.amber : C.rose
    return (
      <div>
        <div style={{ ...cardS, textAlign:'center' }}>
          <div style={{ fontSize:56, fontWeight:900, color:resultColor }}>{pct}%</div>
          <div style={{ fontSize:22, color:C.navy, fontWeight:700, marginTop:4 }}>{score} / {maxScore}</div>
          <div style={{ fontSize:13, color:C.slate, marginTop:4 }}>
            {studentName} · {subject} · {chapter} · {testQs?.length} questions
          </div>
          <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:14, flexWrap:'wrap' }}>
            <span style={{ padding:'6px 16px', borderRadius:99, background:'#dcfce7', color:C.green, fontWeight:700, fontSize:13 }}>✅ {correct} correct</span>
            <span style={{ padding:'6px 16px', borderRadius:99, background:'#fee2e2', color:C.rose, fontWeight:700, fontSize:13 }}>✗ {wrong} wrong</span>
            <span style={{ padding:'6px 16px', borderRadius:99, background:'#f1f5f9', color:C.slate, fontWeight:700, fontSize:13 }}>— {skipped} skipped</span>
          </div>
          <div style={{ marginTop:14, padding:'8px 16px', borderRadius:8, display:'inline-block',
            background: pct>=75?'#dcfce7':pct>=50?'#fef9c3':'#fee2e2',
            color: resultColor, fontWeight:700, fontSize:14 }}>
            {pct>=75 ? '🏆 Excellent!' : pct>=50 ? '👍 Good — keep practicing!' : '📚 Needs more practice'}
          </div>
        </div>
        <div style={{ fontWeight:700, color:C.navy, marginBottom:10, fontSize:14 }}>📋 Question Review</div>
        {testQs?.map((q,i) => {
          const ua=answers[q._testIdx]; const ok=ua===q.correct_option; const wr=ua&&!ok
          return (
            <div key={i} style={{ marginBottom:8, padding:'12px 16px', borderRadius:9,
              border:`1px solid ${ok?'#86efac':wr?'#fca5a5':C.border}`,
              borderLeft:`4px solid ${ok?C.green:wr?C.rose:C.slate}`,
              background:ok?'#f0fdf4':wr?'#fff1f2':'#f8fafc' }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#1e293b', marginBottom:q.question_mayek ? 2 : 5 }}>
                <span style={{ color:C.slate, marginRight:6 }}>Q{i+1}.</span>{q.question}
              </div>
              {q.question_mayek && (
                <div style={{ fontSize:13, color:'#374151', marginBottom:5, fontFamily:mayekFontFamily(q.question_mayek_font) }}>
                  <MayekText text={q.question_mayek} font={q.question_mayek_font} />
                </div>
              )}
              <div style={{ fontSize:12 }}>
                Your answer: <strong style={{ color:ok?C.green:wr?C.rose:C.slate }}>{ua||'—'}</strong>
                {ok && ' ✅'}
                {wr && (
                  <span style={{ marginLeft:12, color:C.green }}>
                    Correct: <strong>{q.correct_option}. {q[`option_${q.correct_option?.toLowerCase()}`]}</strong>
                  </span>
                )}
                {!ua && <span style={{ marginLeft:8, color:C.slate }}>— Not attempted</span>}
              </div>
            </div>
          )
        })}
        <button onClick={() => { setTestQs(null); setSubmitted(false); setResult(null); setCastOpen(false) }}
          style={{ ...btn(C.navy), marginTop:16 }}>← New Test</button>
      </div>
    )
  }

  if (testQs) {
    return (
      <div>
        <div style={{ position:'sticky', top:0, zIndex:99, background:C.navy, borderRadius:10,
          padding:'11px 18px', marginBottom:14,
          display:'flex', justifyContent:'space-between', alignItems:'center', color:'#fff' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>{studentName} · {subject} — {chapter}</div>
            <div style={{ fontSize:11, opacity:.7 }}>{Object.keys(answers).length}/{testQs.length} answered</div>
          </div>
          <div style={{ fontSize:22, fontWeight:800, color: timeLeft<60?'#fca5a5':'#fff' }}>
            ⏱ {formatTime(timeLeft)}
          </div>
          <button onClick={() => { setCastQIndex(0); setCastOpen(true) }} style={btnSm('rgba(255,255,255,.15)', '#fff')}>
            📡 Cast Question
          </button>
          <button onClick={() => confirm('Submit test?') && handleSubmit()} style={btn(C.green)}>✅ Submit</button>
        </div>

        {castOpen && (
          <CastQuestionOverlay
            questions={testQs}
            index={castQIndex}
            onIndexChange={setCastQIndex}
            onClose={() => setCastOpen(false)}
          />
        )}
        {testQs.map((q,i) => (
          <div key={i} style={{ ...cardS, marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#1e293b', marginBottom:q.question_mayek ? 4 : 10, lineHeight:1.6 }}>
              <span style={{ color:C.slate, marginRight:8 }}>Q{i+1}.</span>{q.question}
              <span style={{ float:'right', fontSize:11, color:C.slate }}>[{q.marks||1}M]</span>
            </div>
            {q.question_mayek && (
              <div style={{ fontSize:14, color:'#374151', marginBottom:10, lineHeight:1.6, fontFamily:mayekFontFamily(q.question_mayek_font) }}>
                <MayekText text={q.question_mayek} font={q.question_mayek_font} />
              </div>
            )}
            {q.diagram_url && (
              <img src={q.diagram_url} alt="diagram"
                style={{ maxWidth:240, maxHeight:160, borderRadius:8, marginBottom:8, display:'block' }} />
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {['A','B','C','D'].map(l => (
                <button key={l} onClick={() => setAnswers(a=>({...a,[q._testIdx]:l}))}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px',
                    border:`2px solid ${answers[q._testIdx]===l?C.navy:C.border}`,
                    borderRadius:8, background: answers[q._testIdx]===l?'#eff6ff':'#fff',
                    cursor:'pointer', textAlign:'left', fontSize:13, fontFamily:'inherit' }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0,
                    border:`2px solid ${answers[q._testIdx]===l?C.navy:C.border}`,
                    background: answers[q._testIdx]===l?C.navy:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:11, fontWeight:700, color: answers[q._testIdx]===l?'#fff':C.slate }}>{l}</span>
                  </div>
                  <div>
                    {q[`option_${l.toLowerCase()}`]||'—'}
                    {q[`option_${l.toLowerCase()}_mayek`] && (
                      <div style={{ fontFamily:mayekFontFamily(q.question_mayek_font), fontSize:12 }}>
                        <MayekText text={q[`option_${l.toLowerCase()}_mayek`]} font={q.question_mayek_font} />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ textAlign:'center', padding:24 }}>
          <button onClick={() => confirm('Submit test?') && handleSubmit()} style={btn(C.green)}>✅ Submit Test</button>
        </div>
      </div>
    )
  }

  return (
    <div style={cardS}>
      <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:18 }}>📝 Online Test</div>
      <div className="qb-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label style={lS}>Student Name *</label>
          <input style={iS} value={studentName} onChange={e=>setStudentName(e.target.value)}
            placeholder="Enter student name" />
        </div>
        <div>
          <label style={lS}>Course *</label>
          <select style={iS} value={course}
            onChange={e=>{setCourse(e.target.value);setSubject('');setChapter('');setSelSubs(new Set())}}>
            <option value="">Select</option>
            {COURSE_LIST.map(c=><option key={c} value={c}>{COURSES[c].label}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Subject *</label>
          <select style={{...iS, opacity:course?1:.5}} value={subject}
            onChange={e=>{setSubject(e.target.value);setChapter('');setSelSubs(new Set())}} disabled={!course}>
            <option value="">Select</option>
            {courseSubjectList.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Chapter *</label>
          <select style={{...iS, opacity:subject?1:.5}} value={chapter}
            onChange={e=>{setChapter(e.target.value);setSelSubs(new Set())}} disabled={!subject}>
            <option value="">Select</option>
            {chapters.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>No. of Questions</label>
          <select style={iS} value={count} onChange={e=>setCount(parseInt(e.target.value))}>
            {[10,15,20,25,30,40,50].map(n=><option key={n} value={n}>{n} questions</option>)}
          </select>
        </div>
      </div>
      {availableSubs.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <label style={{ ...lS, marginBottom:6 }}>
            Filter by Subsection <span style={{ fontWeight:400, textTransform:'none' }}>(leave all unchecked = all subsections)</span>
          </label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {availableSubs.map(sub => (
              <button key={sub} onClick={() => setSelSubs(prev=>{const n=new Set(prev);n.has(sub)?n.delete(sub):n.add(sub);return n})}
                style={{ padding:'5px 12px', borderRadius:6,
                  border:`2px solid ${selSubs.has(sub)?C.navy:C.border}`,
                  background: selSubs.has(sub)?'#eff6ff':'#f8fafc',
                  color: selSubs.has(sub)?C.navy:C.slate,
                  fontSize:12, fontWeight:600, cursor:'pointer' }}>
                {selSubs.has(sub)?'☑':'☐'} {sub}
              </button>
            ))}
          </div>
        </div>
      )}
      {subject && chapter && (
        <div style={{ padding:'10px 14px', borderRadius:8, background:'#f0f9ff',
          border:'1px solid #bae6fd', fontSize:12, color:'#0369a1', marginBottom:14 }}>
          📊 <strong>{questions.filter(q=>(q.course||'')===course&&q.subject===subject&&q.chapter===chapter).length}</strong> questions available · Timer: ~{Math.round(count*1.5)} minutes
        </div>
      )}
      <button onClick={handleStart} disabled={!subject||!chapter||!studentName.trim()}
        style={btn(C.navy, !subject||!chapter||!studentName.trim())}>
        ▶ Start Test
      </button>

      {/* ── Test history — recent attempts, feature #8 ── */}
      <div style={{ marginTop:22, paddingTop:18, borderTop:`1px solid ${C.border}` }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10 }}>📜 Recent Attempts</div>
        {historyLoading ? (
          <div style={{ fontSize:12, color:C.slate }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ fontSize:12, color:'#94a3b8' }}>No test attempts recorded yet.</div>
        ) : (
          <div style={{ display:'grid', gap:6 }}>
            {history.map(h => {
              const pct = h.percent ?? (h.max_score ? Math.round((h.score/h.max_score)*100) : 0)
              const color = pct>=75 ? C.green : pct>=50 ? C.amber : C.rose
              return (
                <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                  borderRadius:8, border:`1px solid ${C.border}`, background:'#fafafa', fontSize:12 }}>
                  <span style={{ fontWeight:700, color:C.navy, flex:1 }}>{h.student_name}</span>
                  <span style={{ color:C.slate }}>{h.subject} · {h.chapter}</span>
                  <span style={{ color:C.slate }}>{h.correct}/{h.question_count}</span>
                  <span style={{ padding:'2px 8px', borderRadius:99, fontWeight:700, color, background:'#fff', border:`1px solid ${color}` }}>{pct}%</span>
                  <span style={{ color:'#94a3b8', fontSize:11 }}>
                    {h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 6: STATS (unchanged)
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// TAB: SMART PPT MAKER
// Builds a slide deck from a chapter's questions: present in-app (with cast),
// or export a real .pptx.
// ══════════════════════════════════════════════════════════════════════════════
function TabSmartPPT({ questions, showToast }) {
  const [course,      setCourse]      = useState('')
  const [subject,     setSubject]     = useState('')
  const [chapter,     setChapter]     = useState('')
  const [difficulty,  setDifficulty]  = useState('All')
  const [title,       setTitle]       = useState('')
  const [withAnswers, setWithAnswers] = useState(true)
  const [viewing,     setViewing]     = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const courseSubjectList = course ? Object.keys(COURSES[course]?.subjects || {}) : []
  const chapters = (course && subject) ? (COURSES[course]?.subjects[subject] || []) : []

  const chapterQs = useMemo(() => {
    if (!course || !subject || !chapter) return []
    return questions.filter(q => (q.course||'')===course && q.subject===subject && q.chapter===chapter &&
      (difficulty==='All' || q.difficulty===difficulty))
  }, [questions, course, subject, chapter, difficulty])

  const slides = useMemo(() => buildQuestionSlides(chapterQs), [chapterQs])

  const handleExport = async () => {
    if (!slides.length) { showToast('No questions to export', C.amber); return }
    setExporting(true)
    try {
      await generateQuestionPPTX({ title: title||'Chapter Slides', subject, chapter, slides, withAnswers })
      showToast('🎬 PPTX downloaded!', C.green)
    } catch (e) { showToast('Export failed: ' + e.message, C.rose) }
    setExporting(false)
  }

  return (
    <>
      <div style={cardS}>
        <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:4 }}>🎬 Smart PPT Maker</div>
        <div style={{ fontSize:12, color:C.slate, marginBottom:16 }}>
          Pick a chapter — every question becomes a slide automatically. Present live (with cast) or export a real .pptx.
        </div>
        <div className="qb-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={lS}>Course *</label>
            <select style={iS} value={course} onChange={e => { setCourse(e.target.value); setSubject(''); setChapter('') }}>
              <option value="">Select</option>
              {COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Subject *</label>
            <select style={{ ...iS, opacity:course?1:.5 }} value={subject} onChange={e => { setSubject(e.target.value); setChapter('') }} disabled={!course}>
              <option value="">Select</option>
              {courseSubjectList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Chapter *</label>
            <select style={{ ...iS, opacity:subject?1:.5 }} value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject}>
              <option value="">Select</option>
              {chapters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Difficulty Filter</label>
            <select style={iS} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="All">All Difficulties</option>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lS}>Deck Title</label>
            <input style={iS} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fractions — Revision Slides" />
          </div>
        </div>

        {subject && chapter && (
          <div style={{ padding:'10px 14px', borderRadius:8, background: slides.length ? '#f0f9ff' : '#fef3c7',
            border:`1px solid ${slides.length ? '#bae6fd' : '#fde68a'}`, fontSize:12,
            color: slides.length ? '#0369a1' : '#92400e', marginBottom:14 }}>
            {slides.length
              ? `📊 ${slides.length} question${slides.length!==1?'s':''} will become ${slides.length} slide${slides.length!==1?'s':''} (+ title & answer key)`
              : '⚠️ No questions found for this chapter — add some via Manual Add or Bulk Paste first'}
          </div>
        )}

        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:14 }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:C.navy, fontWeight:600 }}>
            <input type="checkbox" checked={withAnswers} onChange={e => setWithAnswers(e.target.checked)} />
            Show correct answers on slides
          </label>
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={() => setViewing(true)} disabled={!slides.length} style={btn(C.navy, !slides.length)}>
            ▶ Present Now
          </button>
          <button onClick={handleExport} disabled={!slides.length || exporting} style={btn(C.green, !slides.length || exporting)}>
            {exporting ? '⏳ Building .pptx…' : '⬇ Export .pptx'}
          </button>
        </div>
      </div>

      {viewing && (
        <SlideViewer
          slides={slides} title={title||'Chapter Slides'} subject={subject} chapter={chapter}
          onClose={() => setViewing(false)} showToast={showToast}
        />
      )}
    </>
  )
}


// ── PATCH: per-subject stats card, extracted from TabStats' inline map ──────
// Needs its own component (not an inline arrow inside .map()) so it can
// call useMaterialCountsByChapter — a hook — once per subject without
// breaking the rules of hooks. Shows the reciprocal of what
// StudyMaterialsRefPanel does in TabBank: here, each chapter's question
// count sits next to how many study materials exist for it, so gaps in
// either direction (questions with no materials, or materials with no
// questions) are visible at a glance instead of requiring a trip to the
// other module.
function SubjectStatsCard({ course, subj, chapData, chapters, countColor, countBg, countLabel, onNavigate }) {
  const sc = SC[subj] || SC.Mathematics
  const totalSubj = Object.values(chapData).reduce((a,b)=>a+b.total,0)
  const { counts: materialCounts } = useMaterialCountsByChapter(subj)

  return (
    <div style={{ ...cardS, position:'relative', overflow:'hidden' }}>
      <span aria-hidden style={{ position:'absolute', left:0, right:0, top:0, height:3, background:sc.color }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:T.ink, letterSpacing:'-.01em' }}>{subj}</div>
          <div style={{ fontSize:12.5, color:T.muted, marginTop:2 }}>
            {totalSubj.toLocaleString('en-IN')} questions · {(chapters || []).filter(ch => (chapData[ch]?.total || 0) > 0).length} of {(chapters || []).length} chapters covered
          </div>
        </div>
        <div style={{ minWidth:160, flex:'0 1 220px' }}>
          <div style={{ height:6, borderRadius:99, background:T.surfaceAlt, overflow:'hidden', border:`1px solid ${T.border}` }}>
            <div style={{ height:'100%', background:sc.color, borderRadius:99,
              width:`${(chapters || []).length ? Math.round(100 * (chapters || []).filter(ch => (chapData[ch]?.total || 0) > 0).length / (chapters || []).length) : 0}%` }} />
          </div>
        </div>
      </div>
      <div className="qb-opts" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, alignItems:'start' }}>
        {(chapters || []).map(ch => {
          const chData = chapData[ch] || { total:0, subsections:{} }
          const matCount = materialCounts[ch] || 0
          return (
            <div key={ch} style={{ padding:'10px 12px', borderRadius:10,
              border:`1px solid ${T.border}`, background: chData.total ? T.surface : T.surfaceAlt }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:countColor(chData.total) }} title={countLabel(chData.total)} />
                <span style={{ fontSize:12.5, fontWeight:600, color: chData.total ? T.text : T.muted, flex:1, minWidth:0 }}>{ch}</span>
                <span title={`${countLabel(chData.total)} coverage`} style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700, fontVariantNumeric:'tabular-nums',
                  color: countColor(chData.total), background: countBg(chData.total), whiteSpace:'nowrap' }}>
                  {chData.total}
                </span>
                <span
                  onClick={() => openChapterIn('studymaterial', { course, subject: subj, chapter: ch }, onNavigate)}
                  title={matCount > 0 ? `${matCount} study material${matCount>1?'s':''} for this chapter — click to open` : 'No study materials yet for this chapter — click to add one'}
                  style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700, whiteSpace:'nowrap', cursor: onNavigate ? 'pointer' : 'default',
                    color: matCount > 0 ? T.teal : T.faint, background: matCount > 0 ? T.tealSoft : T.surfaceAlt }}>
                  📄 {matCount}
                </span>
              </div>
              {Object.keys(chData.subsections).length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8, paddingLeft:16 }}>
                  {Object.entries(chData.subsections).map(([ss,cnt]) => (
                    <span key={ss} style={{ fontSize:10.5, padding:'2px 7px', borderRadius:6,
                      background:T.surfaceAlt, color:T.muted, border:`1px solid ${T.border}` }}>
                      {ss}: {cnt}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabStats({ questions, refetch, showToast, isAdmin, onNavigate }) {
  const [filterCourse, setFilterCourse] = useState(COURSE_LIST[0] || '')
  const [filterSubject, setFilterSubject] = useState('All')
  const [deleteAllInput, setDeleteAllInput] = useState('')
  const [deletingAll, setDeletingAll] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const merged = useMemo(() => questions.map(q => ({ q, patch: splitMergedOptions(q) })).filter(x => x.patch), [questions])
  const repairAll = async () => {
    if (!merged.length || !confirm(`Split the options of ${merged.length} question(s)?`)) return
    setRepairing(true)
    let done = 0, failed = 0
    for (let i = 0; i < merged.length; i += 20) {
      const res = await Promise.all(merged.slice(i, i + 20).map(({ q, patch }) => supabase.from('qbank_questions').update(patch).eq('id', q.id).select('id')))
      res.forEach(r => { if (r.error || !r.data?.length) failed++; else done++ })
    }
    setRepairing(false)
    showToast(failed ? `Repaired ${done}, ${failed} failed` : `Repaired ${done} question(s) ✓`, failed ? C.amber : C.green)
    refetch(true)
  }

  // Memoized on filterCourse — rebuilt every render, these made the stats
  // useMemo below recompute over the whole bank on every keystroke.
  const courseSubjects = useMemo(() => COURSES[filterCourse]?.subjects || {}, [filterCourse])
  const courseSubjectList = useMemo(() => Object.keys(courseSubjects), [courseSubjects])

  const stats = useMemo(() => {
    const result = {}
    courseSubjectList.forEach(subj => {
      result[subj] = {}
      courseSubjects[subj].forEach(ch => { result[subj][ch] = { total:0, subsections:{} } })
    })
    questions.filter(q => (q.course||'')===filterCourse).forEach(q => {
      if (!result[q.subject]) return
      if (!result[q.subject][q.chapter]) result[q.subject][q.chapter] = { total:0, subsections:{} }
      result[q.subject][q.chapter].total++
      const ss = q.subsection || 'General'
      result[q.subject][q.chapter].subsections[ss] = (result[q.subject][q.chapter].subsections[ss]||0) + 1
    })
    return result
  }, [questions, filterCourse, courseSubjectList, courseSubjects])

  const subjects = filterSubject==='All' ? courseSubjectList : [filterSubject]
  // Coverage tiers: 20+ good, 10–19 low, 1–9 thin, 0 empty (neutral, so an
  // unstarted syllabus reads as "to do" rather than a wall of red errors).
  const countColor = (n) => n >= 20 ? T.green : n >= 10 ? T.amber : n > 0 ? T.rose : T.faint
  const countBg    = (n) => n >= 20 ? T.greenSoft : n >= 10 ? T.amberSoft : n > 0 ? T.roseSoft : T.surfaceAlt
  const countLabel = (n) => n >= 20 ? 'Good' : n >= 10 ? 'Low' : n > 0 ? 'Thin' : 'Empty'

  // ── CSV export — feature #9 ──
  const handleExportCSV = () => {
    const rows = [['Course', 'Subject', 'Chapter', 'Subsection', 'Question Count']]
    subjects.forEach(subj => {
      const chapData = stats[subj] || {}
      ;(courseSubjects[subj] || []).forEach(ch => {
        const chData = chapData[ch] || { total:0, subsections:{} }
        if (Object.keys(chData.subsections).length === 0) {
          rows.push([COURSES[filterCourse]?.label || filterCourse, subj, ch, '', chData.total])
        } else {
          Object.entries(chData.subsections).forEach(([ss, cnt]) => {
            rows.push([COURSES[filterCourse]?.label || filterCourse, subj, ch, ss, cnt])
          })
        }
      })
    })
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `qbank_coverage_${filterSubject==='All'?'all_subjects':filterSubject.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── DANGER ZONE: wipe the entire question bank ──────────────────────────
  // Deletes every row in qbank_questions, no scoping by subject/chapter/
  // course — the whole table, irreversibly. Deliberately harder to
  // trigger than the existing single/bulk-selection delete (handleDelete/
  // handleBulkDelete in TabBank, which only ever act on a bounded
  // selection the admin explicitly checked): this requires typing the
  // literal word DELETE into a text field, not just a confirm() dialog,
  // because a single OK click is too little friction for an action that
  // destroys every question in the bank at once with no undo. Rendered
  // only inside TabStats, which is itself already gated to isAdmin at
  // the call site — never exposed to non-admin roles.
  const handleDeleteAll = async () => {
    if (deleteAllInput.trim().toUpperCase() !== 'DELETE') {
      showToast('Type DELETE exactly to confirm', C.amber)
      return
    }
    if (!confirm(`This will permanently delete ALL ${questions.length} questions in the bank. This cannot be undone. Continue?`)) return
    setDeletingAll(true)
    // Auto-backup: full JSON dump of the ENTIRE bank, downloaded BEFORE
    // the delete call fires — same downloadQuestionsBackup helper used by
    // handleBulkDelete in TabBank. This is the only recovery path for a
    // whole-table wipe, so it runs unconditionally, not behind a
    // separate opt-in step the admin could skip.
    downloadQuestionsBackup(questions, `full_bank_${questions.length}`)
    // .neq('id', <impossible value>) is the standard Supabase pattern for
    // "delete every row" — the client requires SOME filter on delete, it
    // won't run an unconditional DELETE FROM with none at all.
    const { error, count } = await supabase.from('qbank_questions').delete({ count:'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      showToast('Delete all failed: ' + error.message, C.rose)
    } else if (!count) {
      showToast('Nothing was deleted — you may lack permission (backup was still downloaded)', C.amber)
    } else {
      showToast(`🗑 Entire question bank deleted — backup downloaded (${count} questions)`, C.rose)
      setDeleteAllInput('')
      // force=true: without it the still-fresh module cache was served and
      // every deleted question stayed on screen for up to 5 minutes.
      refetch?.(true)
    }
    setDeletingAll(false)
  }

  return (
    <>
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <select style={{ ...iS, width:'auto' }} value={filterCourse}
          onChange={e=>{setFilterCourse(e.target.value);setFilterSubject('All')}}>
          {COURSE_LIST.map(c=><option key={c} value={c}>{COURSES[c].label}</option>)}
        </select>
        <select style={{ ...iS, width:'auto' }} value={filterSubject}
          onChange={e=>setFilterSubject(e.target.value)}>
          <option value="All">All Subjects</option>
          {courseSubjectList.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize:12, color:C.slate }}>
          Total: <strong>{questions.filter(q=>(q.course||'')===filterCourse).length}</strong> questions in {COURSES[filterCourse]?.label || filterCourse}
        </span>
        <button onClick={handleExportCSV} style={btnSm('#eff6ff', C.navy)}>⬇ Export CSV</button>
        <div style={{ display:'flex', gap:14, marginLeft:'auto', fontSize:12, color:T.muted, flexWrap:'wrap' }}>
          {[[20,'20+ good'],[10,'10–19 low'],[1,'1–9 thin'],[0,'empty']].map(([n,l]) => (
            <span key={l} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:countColor(n) }} />{l}
            </span>
          ))}
        </div>
      </div>
      {subjects.map(subj => (
        <SubjectStatsCard
          key={subj}
          course={filterCourse}
          subj={subj}
          chapData={stats[subj] || {}}
          chapters={courseSubjects[subj]}
          countColor={countColor} countBg={countBg} countLabel={countLabel}
          onNavigate={onNavigate}
        />
      ))}

      {isAdmin && (
        <div style={{ ...cardS, marginTop:24 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:6 }}>🔧 Repair merged options</div>
          <div style={{ fontSize:12.5, color:T.muted, marginBottom:10, lineHeight:1.6 }}>
            Questions pasted with an option marker and no space after it (e.g. <code>C) 3996400 D)3946400</code>) were saved
            with two options in one box. {merged.length ? <><strong>{merged.length}</strong> question{merged.length > 1 ? 's' : ''} found.</> : 'None found — the bank is clean.'}
          </div>
          {merged.slice(0, 5).map(({ q, patch }) => (
            <div key={q.id} style={{ fontSize:12, padding:'6px 10px', borderRadius:8, background:T.surfaceAlt, marginBottom:6 }}>
              <div style={{ fontWeight:600, color:T.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.question}</div>
              <div style={{ color:T.muted }}>{Object.entries(patch).map(([k, v]) => `${k.slice(-1).toUpperCase()}: ${v}`).join('  ·  ')}</div>
            </div>
          ))}
          {merged.length > 5 && <div style={{ fontSize:12, color:T.muted, marginBottom:6 }}>…and {merged.length - 5} more</div>}
          {merged.length > 0 && <button onClick={repairAll} disabled={repairing} style={btn(C.green, repairing)}>{repairing ? '⏳ Repairing…' : `✓ Split options in ${merged.length} question${merged.length > 1 ? 's' : ''}`}</button>}
        </div>
      )}

      {isAdmin && (
        <div style={{ ...cardS, marginTop:24, border:'2px solid #fecaca', background:'#fef2f2' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#991b1b', marginBottom:6 }}>
            ⚠️ Danger Zone
          </div>
          <div style={{ fontSize:12, color:'#7f1d1d', marginBottom:12, lineHeight:1.6 }}>
            Permanently deletes <strong>all {questions.length} questions</strong> currently in the bank — every
            subject, every chapter. A full JSON backup of every question downloads automatically the moment you confirm — this cannot be undone otherwise.
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <input
              value={deleteAllInput}
              onChange={e => setDeleteAllInput(e.target.value)}
              placeholder={`Type DELETE to confirm`}
              style={{ ...iS, width:220, borderColor:'#fecaca' }}
            />
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll || deleteAllInput.trim().toUpperCase() !== 'DELETE'}
              style={btn('#991b1b', deletingAll || deleteAllInput.trim().toUpperCase() !== 'DELETE')}
            >
              {deletingAll ? '⏳ Deleting…' : `🗑 Delete All ${questions.length} Questions`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// Patches: { onNavigate, initialFilter } props + NAVIGATE_TO EventBus listener
// ══════════════════════════════════════════════════════════════════════════════

// Module-level cache for the full qbank_questions table. QuestionBank.jsx
// used to re-fetch and re-paginate through all ~10,500+ rows every single
// time the component mounted (switching tabs away and back, navigating from
// another module, etc.), which was the single largest source of Supabase
// PostgREST egress in the whole app. Cached here across mounts within the
// same browser session; refetch(force=true) (called after saves/imports/
// deletes) bypasses the cache so writes are always reflected immediately.
let _qbankCache = null       // { data, fetchedAt } | null
const QBANK_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Create Paper / Online Test / Stats / Smart PPT are admin-only.
const ADMIN_ONLY_TABS = ['paper', 'test', 'stats', 'smartppt']

export default function QuestionBank({ currentUser, onNavigate, initialFilter: initialFilterProp, embedded = false }) {
  // BUGFIX: this used to check roleLower === 'admin' (exact lowercase
  // match only) based on a one-off SQL check against portal_users.role
  // that a prior pass here concluded meant "admin" was the only real
  // admin value and "Administrator" was an incorrect guess. That was
  // wrong — it's the same stale-role-string bug fixed elsewhere in this
  // app (Fees.jsx, Hostel.jsx): a real Administrator account (role
  // "Administrator", the value App.jsx's own login path sets) was being
  // shown "Question Bank is restricted" despite being a full admin. Now
  // uses the shared isAdminRole() from roles.js, the single source of
  // truth for admin roles (ADMIN_ROLES = ['Admin','Administrator',
  // 'Co-Admin']) that every other module already checks against.
  const isAdmin = isAdminRole(currentUser?.role)
  // Question Bank is open to every staff member who can reach it — who can
  // reach it is decided by the module permissions in Admin → Permissions
  // (App.jsx's canAccess), not by a hard-coded role list here. Any staff may
  // browse, add and edit questions; deleting and the Create Paper / Online
  // Test / Smart PPT / Stats tabs stay admin-only (the delete buttons check
  // isAdmin, and row-level security enforces delete on the server).
  const isStaffAllowed = !!currentUser

  const [tabState,      setTab]           = useState('bank')
  const [questions,     setQuestions]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState(null)
  // initialFilter drives TabBank's pre-filtered view; updated by EventBus
  const [initialFilter, setInitialFilter] = useState(initialFilterProp || null)

  // One timer at a time: an earlier toast's timer no longer hides a newer
  // toast early.
  const toastTimerRef = useRef(null)
  const showToast = (msg, color=C.navy) => {
    setToast({ msg, color })
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }
  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  const refetch = useCallback(async (force = false) => {
    // Skip the query entirely for non-staff — no data should ever leave
    // Supabase for a role that isn't permitted to see it.
    if (!isStaffAllowed) { setLoading(false); return }

    // Serve from the module-level cache when it's fresh and the caller
    // isn't explicitly forcing a reload (saves/imports/deletes pass
    // force=true so writes are never masked by a stale cache).
    if (!force && _qbankCache && (Date.now() - _qbankCache.fetchedAt) < QBANK_CACHE_TTL_MS) {
      setQuestions(_qbankCache.data)
      setLoading(false)
      return
    }

    setLoading(true)
    const PAGE_SIZE = 1000
    let all = []
    let from = 0
    let keepGoing = true
    let hadError = false

    while (keepGoing) {
      const { data, error } = await supabase
        .from('qbank_questions')
        .select('*')
        .order('created_at', { ascending:true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        hadError = true
        break
      }

      all = all.concat(data || [])

      if (!data || data.length < PAGE_SIZE) {
        keepGoing = false
      } else {
        from += PAGE_SIZE
      }
    }

    if (hadError) {
      showToast('Failed to load questions', C.rose)
    } else {
      _qbankCache = { data: all, fetchedAt: Date.now() }
      setQuestions(all)
    }
    setLoading(false)
  }, [isStaffAllowed])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the bank from the server on open
  useEffect(() => { refetch() }, [refetch])

  // ── PATCH: listen for cross-module NAVIGATE_TO events ─────────────────────
  // When StudyMaterial's 📚 Q badge is clicked, this fires and switches to
  // the Bank tab pre-filtered to that subject + chapter. Non-staff users
  // never see the module at all, so this listener is harmless for them —
  // it just never has anywhere to navigate to.
  useEffect(() => {
    const unsub = EventBus.on(GNSI_EVENTS.NAVIGATE_TO, ({ module, params }) => {
      if (module === 'questionbank' && params) {
        setInitialFilter(params)
        setTab('bank')
      }
    })
    return unsub
  }, [])

  // Chapter focus (StudyMaterialBridge.openChapterIn) — works even when this
  // page wasn't mounted yet at the moment of the click, which the
  // NAVIGATE_TO emit above can't. A fresh object each time so the same
  // chapter can be re-focused.
  useChapterFocus('questionbank', f => {
    setInitialFilter({ course: f.course, subject: f.subject, chapter: f.chapter })
    setTab('bank')
  })

  // ── ACCESS GUARD ─────────────────────────────────────────────────────────
  // Non-admins get view (Bank, read-only) + upload (Manual Add, Bulk Paste)
  // only. Create Paper / Online Test / Stats are admin-only.
  const tab = !isAdmin && ADMIN_ONLY_TABS.includes(tabState) ? 'bank' : tabState

  // Headline numbers for the page header.
  const bankStats = useMemo(() => {
    const chapters = new Set()
    let diagrams = 0, noAnswer = 0
    for (const q of questions) {
      if (q.subject && q.chapter) chapters.add(`${q.course || ''}|${q.subject}|${q.chapter}`)
      if (q.diagram_url) diagrams++
      if (!q.correct_option) noAnswer++
    }
    return { total: questions.length, chapters: chapters.size, diagrams, noAnswer }
  }, [questions])

  // Module-level gate — Teaching + Admin role only. This is a UI-layer
  // convenience; Supabase RLS or an equivalent server-side check should also
  // enforce this so the restriction doesn't depend solely on the client.
  if (!isStaffAllowed) {
    return (
      <div className="qbx" style={{ padding:24, background:C.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <QBThemeStyles />
        <div className="qb-fade" style={{ ...cardS, maxWidth:440, textAlign:'center', padding:'40px 34px' }}>
          <div style={{ width:56, height:56, borderRadius:16, margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center',
            background:T.navySoft, fontSize:26 }}>🔒</div>
          <div style={{ fontSize:18, fontWeight:700, color:T.ink, marginBottom:8, letterSpacing:'-.01em' }}>Please sign in</div>
          <div style={{ fontSize:13, color:C.slate, lineHeight:1.6 }}>
            Sign in with your staff account to open the Question Bank.
          </div>
        </div>
      </div>
    )
  }

  // group: 'bank' = content management, 'tools' = language tools,
  // 'deliver' = papers/tests/slides/analytics (admin). Groups are separated
  // by a divider in the tab bar.
  const ALL_TABS = [
    { key:'bank',    icon:'📚', label:'Question Bank', count: questions.length, group:'bank' },
    { key:'manual',  icon:'✏️', label:'Manual Add',    count: null, group:'bank' },
    { key:'bulk',    icon:'📤', label:'Bulk Paste',    count: null, group:'bank' },
    { key:'translit',icon:'🔤', label:'Mayek Tool',    count: null, group:'tools' },
    { key:'dictionary',icon:'📖', label:'Dictionary',  count: null, group:'tools' },
    { key:'paper',   icon:'📄', label:'Create Paper',  count: null,  adminOnly: true, group:'deliver' },
    { key:'test',    icon:'📝', label:'Online Test',   count: null,  adminOnly: true, group:'deliver' },
    { key:'smartppt',icon:'🎬', label:'Smart PPT',     count: null,  adminOnly: true, group:'deliver' },
    { key:'stats',   icon:'📊', label:'Stats',         count: null,  adminOnly: true, group:'deliver' },
  ]
  const TABS = isAdmin ? ALL_TABS : ALL_TABS.filter(t => !t.adminOnly)
  const fmt = n => n.toLocaleString('en-IN')

  return (
    <div className="qbx qb-page" style={embedded ? { background:'transparent' } : { padding:24, background:C.bg, minHeight:'100vh' }}>
      <QBThemeStyles />
      <BmeiFontFace />
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {/* ── Header — the Teaching hub shows its own when embedded ── */}
      {!embedded && (<>
      <div className="qb-hero" style={{ ...heroStyle, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:20, flexWrap:'wrap' }}>
          <div style={{ minWidth:0 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:10.5, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'.14em', color:'#fcd34d', marginBottom:8 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:T.accent, boxShadow:`0 0 0 4px rgba(245,158,11,.18)` }} />
              GNSI Portal · Academics
            </div>
            <div className="qb-hero-title" style={{ fontSize:28, fontWeight:800, letterSpacing:'-.025em', lineHeight:1.1 }}>Question Bank</div>
            <div className="qb-hero-sub" style={{ fontSize:13.5, color:'rgba(255,255,255,.72)', marginTop:6, maxWidth:520, lineHeight:1.5 }}>
              Sainik · Navodaya · RMS · Foundation — build, organise and deliver questions, papers and tests.
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <HeroStat label="Questions" value={loading ? '—' : fmt(bankStats.total)} />
            <HeroStat label="Chapters" value={loading ? '—' : fmt(bankStats.chapters)} hint="Distinct course / subject / chapter combinations with questions" />
            <HeroStat label="Diagrams" value={loading ? '—' : fmt(bankStats.diagrams)} />
            {bankStats.noAnswer > 0 && !loading && (
              <HeroStat label="No answer" value={fmt(bankStats.noAnswer)} hint="Questions saved without a correct option marked" />
            )}
          </div>
        </div>
      </div>

      </>)}

      {/* ── Tab bar ── */}
      <div role="tablist" aria-label="Question Bank sections" className="qb-tabs"
        style={{ position:'sticky', top:0, zIndex:60, display:'flex', alignItems:'center', gap:4, overflowX:'auto',
          padding:6, marginBottom:20, background:'rgba(255,255,255,.92)', backdropFilter:'blur(8px)',
          border:`1px solid ${T.border}`, borderRadius:14, boxShadow:T.shadow }}>
        {TABS.map((t, i) => {
          const active = tab === t.key
          const newGroup = i > 0 && TABS[i - 1].group !== t.group
          return (
            <React.Fragment key={t.key}>
              {newGroup && <span aria-hidden style={{ width:1, alignSelf:'stretch', margin:'6px 4px', background:T.border, flexShrink:0 }} />}
              <button role="tab" aria-selected={active} onClick={() => setTab(t.key)}
                style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 14px', borderRadius:10, flexShrink:0,
                  border:'none', background: active ? T.navy : 'transparent',
                  color: active ? '#fff' : T.muted, boxShadow: active ? '0 2px 8px rgba(14,42,71,.25)' : 'none',
                  fontSize:13, fontWeight: active ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap' }}>
                <span style={{ fontSize:14, filter: active ? 'none' : 'grayscale(.35)' }}>{t.icon}</span>
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span style={{ padding:'1px 7px', borderRadius:99, fontSize:10.5, fontWeight:700, fontVariantNumeric:'tabular-nums',
                    background: active ? 'rgba(255,255,255,.18)' : T.navySoft, color: active ? '#fff' : T.navy }}>
                    {fmt(t.count)}
                  </span>
                )}
              </button>
            </React.Fragment>
          )
        })}
      </div>

      {tab === 'bank'   && <TabBank   questions={questions} loading={loading} refetch={refetch} showToast={showToast} initialFilter={initialFilter} isAdmin={isAdmin} canEdit={isStaffAllowed} onNavigate={onNavigate} />}
      {tab === 'manual' && <TabManualAdd questions={questions} refetch={refetch} showToast={showToast} onNavigate={onNavigate} />}
      {tab === 'bulk'   && <TabBulkPaste questions={questions} refetch={refetch} showToast={showToast} onNavigate={onNavigate} />}
      {tab === 'translit' && <TabTranslit questions={questions} refetch={refetch} showToast={showToast} currentStaffId={currentUser?.staff_profile_id || null} />}
      {tab === 'dictionary' && <TabDictionary showToast={showToast} currentStaffId={currentUser?.staff_profile_id || null} questions={questions} isAdmin={isAdmin} />}
      {isAdmin && tab === 'paper'  && <TabPaper  questions={questions} showToast={showToast} />}
      {isAdmin && tab === 'test'   && <TabTest   questions={questions} showToast={showToast} />}
      {isAdmin && tab === 'smartppt' && <TabSmartPPT questions={questions} showToast={showToast} />}
      {isAdmin && tab === 'stats'  && <TabStats  questions={questions} refetch={refetch} showToast={showToast} isAdmin={isAdmin} onNavigate={onNavigate} />}
    </div>
  )
}