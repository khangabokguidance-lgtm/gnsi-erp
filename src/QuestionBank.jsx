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
import { useStudyMaterialsByChapter, normalizeToQBank } from './StudyMaterialBridge'
import { EventBus, GNSI_EVENTS } from './EventBus'

// ── SUBJECTS & CHAPTERS ──────────────────────────────────────────────────────
const SUBJECTS = {
  Mathematics: [
    'Natural Numbers','LCM and HCF','Fractions','Decimal Numbers',
    'Ratio and Proportion','Percentage','Profit and Loss','Simple Interest',
    'Average','Unitary Method','Area and Perimeter','Volume of Cube and Cuboids',
    'Speed and Time','Lines and Angles','Types of Angles','Circle',
    'Prime and Composite Numbers','Roman Numerals','Simplification',
    'Conversion of Units','Operation on Numbers','Temperature',
    'Plane Figures','Arranging of Fractions','Complementary and Supplementary Angles',
    'Rounding Off Numbers','Measurement','Squares, Cubes and Roots','Data Handling','Time and Work',
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
    'Analogies':              ['analogy','analogies','is to','relates'],
    'Venn Diagram':           ['venn','diagram','circle','overlapping'],
    'Mirror Image':           ['mirror','reflection','image'],
    'Series Completion':      ['series','next term','missing','sequence','pattern'],
    'Coding Decoding':        ['code','coding','decoding','cipher','encoded'],
    'Direction Test':         ['direction','north','south','east','west','km away','turn'],
    'Blood Relations':        ['blood','relation','father','mother','son','daughter','brother','sister','uncle','aunt'],
    'Order & Ranking':        ['rank','ranking','position','tallest','shortest','heavier'],
    'Clock & Calendar':       ['clock','time','calendar','day','month','year','date'],
    'Paper Folding':          ['fold','paper','punch','hole'],
    'Odd Man Out':            ['odd','different','does not belong','not related'],
    'Classification':         ['classify','group','category','belong'],
    'Figure Completion':      ['complete','missing part','figure','shape'],
    'Mathematical Operations':['operation','replace','symbol','+','-','×','÷'],
    'Sitting Arrangement':    ['sitting','arrangement','row','circle','facing'],
    'Word Formation':         ['word','letter','form','arrange','meaningful'],
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
    'Types of Sentence':      ['sentence','declarative','interrogative','exclamatory','imperative'],
    'Singular & Plural':      ['singular','plural','one','many'],
    'Number & Gender':        ['gender','masculine','feminine','neuter','common'],
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
const C = {
  navy: '#1e3a5f', green: '#16a34a', rose: '#dc2626',
  amber: '#d97706', violet: '#7c3aed', slate: '#64748b',
  indigo: '#4f46e5', teal: '#0891b2', bg: '#f8fafc',
  border: '#e2e8f0', white: '#ffffff',
}
const SC = {
  Mathematics:         { color: '#1e3a5f', bg: '#eff6ff', border: '#bfdbfe' },
  Intelligence:        { color: '#7c3aed', bg: '#f3e8ff', border: '#ddd6fe' },
  Language:            { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'General Knowledge': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
}
const CHART_COLORS = ['#1e3a5f','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2']

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
const iS = {
  width:'100%', padding:'8px 11px', borderRadius:7,
  border:`1px solid ${C.border}`, fontSize:13,
  background:C.white, boxSizing:'border-box', fontFamily:'inherit', outline:'none',
}
const lS = { display:'block', fontSize:11, fontWeight:700, color:C.slate, marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }
const cardS = { background:C.white, borderRadius:12, boxShadow:'0 1px 6px rgba(0,0,0,.07)', padding:'20px 22px', marginBottom:16 }
const btn = (bg, dis=false) => ({
  padding:'8px 18px', borderRadius:8, background: dis ? '#94a3b8' : bg,
  color:'#fff', border:'none', fontSize:13, fontWeight:700,
  cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .7 : 1,
})
const btnSm = (bg, color='#fff') => ({
  padding:'4px 10px', borderRadius:6, background:bg,
  color, border:'none', fontSize:11, fontWeight:700, cursor:'pointer',
})
const tdS = { padding:'10px 12px', color:C.slate, fontSize:13 }

// ── HELPERS ───────────────────────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })

function Badge({ text, color, bg, border }) {
  return (
    <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10, fontWeight:700,
      color, background:bg, border:`1px solid ${border||bg}`, whiteSpace:'nowrap' }}>
      {text}
    </span>
  )
}

function Toast({ msg, color }) {
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:99999,
      background:'#fff', border:`1px solid ${C.border}`,
      borderLeft:`3px solid ${color}`, borderRadius:10,
      padding:'11px 18px', fontSize:13, fontWeight:600,
      boxShadow:'0 8px 32px rgba(0,0,0,.12)', maxWidth:360 }}>
      {msg}
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
  const [available, setAvailable] = useState(false)
  const [casting, setCasting] = useState(false)
  const connectionRef = useRef(null)

  useEffect(() => {
    setAvailable(typeof window !== 'undefined' && 'PresentationRequest' in window)
  }, [])

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
function CastButton({ url, presentTargetId, title, showToast, small }) {
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
// Uses PptxGenJS (lazy-loaded from CDN, same pattern as jsPDF above) to
// generate a real, downloadable .pptx that opens in PowerPoint/Keynote/
// Google Slides/LibreOffice — not an HTML mockup.
async function ensurePptxGenLoaded() {
  if (window.PptxGenJS) return
  await new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
    s.onload = res; s.onerror = rej; document.head.appendChild(s)
  })
}

async function generateQuestionPPTX({ title, subject, chapter, slides, withAnswers }) {
  await ensurePptxGenLoaded()
  const pres = new window.PptxGenJS()
  pres.defineLayout({ name: 'GNSI16x9', width: 10, height: 5.63 })
  pres.layout = 'GNSI16x9'

  const NAVY = '1E3A5F', GOLD = 'C9A24B', GREEN = '15803D', GREEN_BG = 'DCFCE7', SLATE = '64748B'

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
      slide.addText(q.title_mayek, { x:0.4, y:2.15, w:9.2, h:0.6, fontSize:14, color:'374151' })
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
          <div style={{ fontSize:'clamp(16px,1.9vw,24px)', color:'#cbd5e1', maxWidth:1000, marginTop:16, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
            {slide.title_mayek}
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

function needsDiagram(questionText) {
  const q = questionText.toLowerCase()
  return DIAGRAM_KEYWORDS.some(kw => q.includes(kw))
}

// ── SMART BULK PASTE PARSER ───────────────────────────────────────────────────
function extractOptionsFromLine(line) {
  const norm = line.replace(/\t+/g, ' ').replace(/  +/g, ' ').trim()
  const result = {}
  const markerRe = /\(([a-dA-D])\)[ ]|([a-dA-D])[.)]\s/g
  const positions = []
  let mm
  while ((mm = markerRe.exec(norm)) !== null) {
    positions.push({ letter: (mm[1] || mm[2]).toUpperCase(), start: mm.index, end: mm.index + mm[0].length })
  }
  positions.forEach((pos, idx) => {
    const valueStart = pos.end
    const valueEnd   = idx + 1 < positions.length ? positions[idx + 1].start : norm.length
    const value      = norm.slice(valueStart, valueEnd).trim()
    if (value) result[pos.letter] = value
  })
  return result
}

function parseQuestions(rawText) {
  const lines = rawText.split('\n').map(l => l.replace(/\r/g, '').trimEnd()).filter(l => l.trim())
  const questions = []
  let currentSubsectionHeading = ''
  let i = 0

  const isAnswerLine = (line) => {
    const t = line.trim()
    return /^ans(wer)?\s*[:.\-]?\s*[a-d]/i.test(t) ||
           /^\([a-d]\)\s*$/i.test(t) ||
           /^[a-d]\s*$/i.test(t)
  }

  const isHeading = (line) => {
    const t = line.trim()
    return /^\d+\.\s+[A-Z]/.test(t) &&
           t.length < 70 &&
           !t.match(/^\d+\.\s+(which|what|find|how|if |the |a |an |select|choose|write|fill|solve|express|by |in |from |simplif)/i)
  }

  const isQuestionStart = (line) => /^(Q?\s*\d+[\.\)]\s+|Q\s*\d+\s+)/i.test(line.trim())
  const hasOptionMarker = (line) => /\(?\s*[a-dA-D]\s*[.)]\s*.{1,}/i.test(line.trim())

  while (i < lines.length) {
    const line = lines[i].trim()

    if (isHeading(line) && !isQuestionStart(line)) {
      currentSubsectionHeading = line.replace(/^\d+\.\s*/, '').trim()
      i++; continue
    }

    if (isQuestionStart(line)) {
      const qNum   = line.match(/^Q?\s*(\d+)/i)?.[1]
      let qText    = line.replace(/^Q?\s*\d+[\.\)]\s*/i, '').trim()

      let j = i + 1
      while (j < lines.length) {
        const next = lines[j].trim()
        if (hasOptionMarker(next) || isQuestionStart(next) || isHeading(next) || isAnswerLine(next)) break
        if (next) qText += ' ' + next
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
        const ans = lines[i].match(/[a-dA-D]/i)
        if (ans) correctOption = ans[0].toUpperCase()
        i++
      }

      if (qText && (options.A || options.B || options.C || options.D)) {
        questions.push({
          _id: questions.length,
          _qNum: parseInt(qNum) || questions.length + 1,
          question: qText.trim(),
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
  const matches = keyText.matchAll(/Q?(\d+)[.\-\)\s:]+([a-dA-D])/gi)
  for (const m of matches) { map[parseInt(m[1])] = m[2].toUpperCase() }
  return map
}

// ── DUPLICATE DETECTION ───────────────────────────────────────────────────────
// Normalizes question text for comparison: lowercase, strip punctuation/whitespace
// differences so near-identical pastes (extra spaces, different casing) still match.
function normalizeQuestionText(text) {
  return (text || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

function findDuplicates(candidateRows, existingQuestions) {
  const existingSet = new Set(existingQuestions.map(q => normalizeQuestionText(q.question)))
  return candidateRows.map((r, i) => ({
    index: i,
    isDuplicate: existingSet.has(normalizeQuestionText(r.question)),
  })).filter(r => r.isDuplicate)
}

// ── CSV IMPORT ─────────────────────────────────────────────────────────────
// Expected header row (case-insensitive, order-independent):
// question, option_a, option_b, option_c, option_d, correct_option, subject, chapter, subsection, difficulty, marks
function parseCSVLine(line) {
  const cells = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cells.push(cur); cur = '' }
      else cur += ch
    }
  }
  cells.push(cur)
  return cells.map(c => c.trim())
}

function parseCSVQuestions(csvText, defaultSubject, defaultChapter) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g,'_'))
  const colIdx = (name) => header.indexOf(name)
  const qi = colIdx('question')
  if (qi === -1) return []

  return lines.slice(1).map((line, i) => {
    const cells = parseCSVLine(line)
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
      subject: get('subject') || defaultSubject || '',
      chapter: get('chapter') || defaultChapter || '',
      subsection: get('subsection') || '',
      difficulty: ['Easy','Medium','Hard'].includes(get('difficulty')) ? get('difficulty') : 'Medium',
      marks: parseInt(get('marks')) || 1,
      diagram_url: '',
      _subsectionHint: '',
      _needsDiagram: needsDiagram(question),
    }
  }).filter(Boolean)
}

// ── QUESTION CARD ─────────────────────────────────────────────────────────────
function QCard({ q, index, showAnswer=false, selectable, selected, onToggle, onDelete, onEdit }) {
  const [reveal, setReveal] = useState(showAnswer)
  const sc = SC[q.subject] || SC.Mathematics
  return (
    <div style={{ ...cardS, marginBottom:8, padding:'12px 16px',
      border: selected ? `2px solid ${C.navy}` : `1px solid ${C.border}`,
      background: selected ? '#f0f6ff' : q._needsDiagram ? '#fffbeb' : '#fff' }}>
      <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
        {selectable && (
          <input type="checkbox" checked={!!selected}
            onChange={() => onToggle?.(q.id || q._id)}
            style={{ width:16, height:16, marginTop:3, cursor:'pointer', flexShrink:0 }} />
        )}
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7, alignItems:'center' }}>
            <span style={{ fontSize:11, color:C.slate, fontWeight:700 }}>Q{index+1}</span>
            {q.subject && <Badge text={q.subject} color={sc.color} bg={sc.bg} border={sc.border} />}
            {q.chapter && <Badge text={q.chapter} color={C.slate} bg="#f1f5f9" />}
            {q.subsection && <Badge text={q.subsection} color="#0369a1" bg="#e0f2fe" />}
            <Badge text={q.difficulty||'Medium'}
              color={q.difficulty==='Easy'?C.green:q.difficulty==='Hard'?C.rose:C.amber}
              bg={q.difficulty==='Easy'?'#dcfce7':q.difficulty==='Hard'?'#fee2e2':'#fef9c3'} />
            <Badge text={`${q.marks||1}M`} color={C.indigo} bg="#eff6ff" />
            {q._needsDiagram && <Badge text="⚠️ Needs Diagram" color="#92400e" bg="#fef3c7" />}
            {q.diagram_url && <Badge text="🖼 Has Diagram" color="#065f46" bg="#d1fae5" />}
          </div>
          <div style={{ fontSize:14, color:'#1e293b', fontWeight:500, lineHeight:1.6, marginBottom:q.question_mayek ? 4 : 8 }}>
            {q.question}
          </div>
          {q.question_mayek && (
            <div style={{ fontSize:15, color:'#374151', lineHeight:1.7, marginBottom:8, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
              {q.question_mayek}
            </div>
          )}
          {q.diagram_url && (
            <img src={q.diagram_url} alt="Question diagram"
              style={{ maxWidth:280, maxHeight:180, borderRadius:8, border:`1px solid ${C.border}`, marginBottom:8, display:'block' }} />
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:8 }}>
            {['A','B','C','D'].map(l => (
              <div key={l} style={{ padding:'5px 10px', borderRadius:6, fontSize:12,
                background: reveal && q.correct_option===l ? '#dcfce7' : '#f8fafc',
                border:`1px solid ${reveal && q.correct_option===l ? '#86efac' : C.border}`,
                color: reveal && q.correct_option===l ? '#15803d' : '#374151',
                fontWeight: reveal && q.correct_option===l ? 700 : 400 }}>
                <span style={{ fontWeight:700, marginRight:5, color:C.slate }}>{l}.</span>
                {q[`option_${l.toLowerCase()}`] || '—'}
                {reveal && q.correct_option===l && ' ✓'}
                {q[`option_${l.toLowerCase()}_mayek`] && (
                  <div style={{ fontFamily:"'Noto Sans Meetei Mayek', sans-serif", fontWeight:400, marginTop:2 }}>
                    {q[`option_${l.toLowerCase()}_mayek`]}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button onClick={() => setReveal(r=>!r)} style={btnSm(reveal?C.slate:C.green)}>
              {reveal ? '🙈 Hide' : '👁 Answer'}
            </button>
            {onEdit && <button onClick={() => onEdit(q)} style={btnSm(C.indigo)}>✏️ Edit</button>}
            {onDelete && <button onClick={() => onDelete(q.id)} style={btnSm(C.rose)}>🗑 Delete</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── STUDY MATERIALS REFERENCE PANEL ──────────────────────────────────────────
// Shows existing study materials for the selected subject+chapter.
// Used inside TabManualAdd and TabBulkPaste as a reference sidebar.
function StudyMaterialsRefPanel({ subject, chapter, onNavigate }) {
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
        <button
          onClick={() => onNavigate?.('studymaterial')}
          style={{ fontSize:10, color:'#0369a1', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>
          Open Study Materials →
        </button>
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
function TabBank({ questions, loading, refetch, showToast, initialFilter, isAdmin }) {
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

  // ── PATCH: apply initialFilter from cross-module navigation ────────────────
  useEffect(() => {
    if (!initialFilter) return
    if (initialFilter.subject) {
      // Normalize: StudyMaterial subjects may differ from QBank subjects
      const qbankSubject = normalizeToQBank(initialFilter.subject)
      if (SUBJECTS[qbankSubject]) {
        setFilterSubject(qbankSubject)
      }
    }
    if (initialFilter.chapter) {
      setFilterChapter(initialFilter.chapter)
    }
    setPage(1)
  }, [initialFilter])

  const chapters    = filterSubject !== 'All' ? (SUBJECTS[filterSubject] || []) : []
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
      if (filterSubject    !== 'All' && item.subject    !== filterSubject)    return false
      if (filterChapter    !== 'All' && item.chapter    !== filterChapter)    return false
      if (filterSubsection !== 'All' && item.subsection !== filterSubsection) return false
      if (filterDiff       !== 'All' && item.difficulty !== filterDiff)       return false
      if (filterDiagram === 'missing' && !(needsDiagram(item.question||'') && !item.diagram_url)) return false
      if (filterDiagram === 'has'     && !item.diagram_url)                   return false
      if (q && !item.question?.toLowerCase().includes(q))                    return false
      return true
    })
  }, [questions, filterSubject, filterChapter, filterSubsection, filterDiff, filterDiagram, search])

  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE))
  const paginated    = filtered.slice((page-1)*PAGE, page*PAGE)

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set())
    else setSelected(new Set(paginated.map(q => q.id)))
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return
    const { error } = await supabase.from('qbank_questions').delete().eq('id', id)
    if (error) showToast('Delete failed: ' + error.message, C.rose)
    else { showToast('Deleted ✓', C.rose); refetch() }
  }

  const handleBulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} questions?`)) return
    const { error } = await supabase.from('qbank_questions').delete().in('id', [...selected])
    if (error) showToast('Bulk delete failed', C.rose)
    else { showToast(`${selected.size} questions deleted`, C.rose); setSelected(new Set()); refetch() }
  }

  const handleEditSave = async (updatedQ) => {
    const { id, _id, _qNum, _subsectionHint, _needsDiagram, ...payload } = updatedQ
    const { error } = await supabase.from('qbank_questions').update(payload).eq('id', id)
    if (error) showToast('Update failed: ' + error.message, C.rose)
    else { showToast('Updated ✓', C.green); setEditQ(null); refetch() }
  }

  const stats = useMemo(() => {
    const map = {}
    SUBJECT_LIST.forEach(s => { map[s] = 0 })
    questions.forEach(q => { map[q.subject] = (map[q.subject]||0)+1 })
    return map
  }, [questions])

  return (
    <>
      {/* initialFilter active banner */}
      {initialFilter && (filterSubject !== 'All' || filterChapter !== 'All') && (
        <div style={{ padding:'8px 14px', borderRadius:8, background:'#ede9fe', border:'1px solid #ddd6fe', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#7c3aed' }}>
            📚 Showing: {filterSubject !== 'All' ? filterSubject : ''}{filterChapter !== 'All' ? ` › ${filterChapter}` : ''}
          </span>
          <button onClick={() => { setFilterSubject('All'); setFilterChapter('All'); setPage(1) }}
            style={{ ...btnSm('#7c3aed'), fontSize:10 }}>✕ Clear filter</button>
        </div>
      )}

      {/* Subject stat cards */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
        {SUBJECT_LIST.map(s => {
          const sc = SC[s]
          return (
            <div key={s} onClick={() => { setFilterSubject(s); setFilterChapter('All'); setFilterSubsection('All'); setPage(1) }}
              style={{ flex:1, minWidth:130, padding:'13px 15px', borderRadius:10,
                background:sc.bg, border:`1.5px solid ${filterSubject===s?sc.color:sc.border}`,
                cursor:'pointer', transition:'all .12s' }}>
              <div style={{ fontSize:24, fontWeight:800, color:sc.color }}>{stats[s]||0}</div>
              <div style={{ fontSize:10, fontWeight:700, color:sc.color, textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>{s}</div>
            </div>
          )
        })}
        <div onClick={() => { setFilterSubject('All'); setFilterChapter('All'); setPage(1) }}
          style={{ flex:1, minWidth:100, padding:'13px 15px', borderRadius:10,
            background:'#f1f5f9', border:`1.5px solid ${filterSubject==='All'?C.navy:C.border}`, cursor:'pointer' }}>
          <div style={{ fontSize:24, fontWeight:800, color:C.navy }}>{questions.length}</div>
          <div style={{ fontSize:10, fontWeight:700, color:C.slate, textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>All</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        <input style={iS} placeholder="🔍 Search questions…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <select style={iS} value={filterSubject}
          onChange={e => { setFilterSubject(e.target.value); setFilterChapter('All'); setFilterSubsection('All'); setPage(1) }}>
          <option value="All">All Subjects</option>
          {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={{ ...iS, opacity: filterSubject!=='All'?1:.5 }} value={filterChapter}
          onChange={e => { setFilterChapter(e.target.value); setFilterSubsection('All'); setPage(1) }}
          disabled={filterSubject==='All'}>
          <option value="All">All Chapters</option>
          {chapters.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={{ ...iS, opacity: subsections.length?1:.5 }} value={filterSubsection}
          onChange={e => { setFilterSubsection(e.target.value); setPage(1) }}
          disabled={!subsections.length}>
          <option value="All">All Subsections</option>
          {subsections.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={iS} value={filterDiff}
          onChange={e => { setFilterDiff(e.target.value); setPage(1) }}>
          <option value="All">All Difficulties</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={iS} value={filterDiagram}
          onChange={e => { setFilterDiagram(e.target.value); setPage(1) }}>
          <option value="All">All Diagrams</option>
          <option value="missing">⚠️ Needs diagram</option>
          <option value="has">🖼 Has diagram</option>
        </select>
      </div>

      {/* Bulk action bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <span style={{ fontSize:12, color:C.slate }}>{filtered.length} questions found</span>
        <div style={{ display:'flex', gap:8 }}>
          {isAdmin && selected.size > 0 && (
            <button onClick={handleBulkDelete} style={btn(C.rose)}>🗑 Delete {selected.size} selected</button>
          )}
        </div>
      </div>

      {/* Edit inline modal — admin only */}
      {isAdmin && editQ && (
        <div style={{ ...cardS, border:`2px solid ${C.indigo}`, marginBottom:16 }}>
          <div style={{ fontWeight:700, color:C.navy, marginBottom:12 }}>✏️ Edit Question</div>
          <QuestionRowForm row={editQ} index={0} onChange={(i,k,v) => setEditQ(q=>({...q,[k]:v}))}
            onRemove={null} showImageUpload showToast={showToast} />
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button onClick={() => handleEditSave(editQ)} style={btn(C.green)}>✅ Save Changes</button>
            <button onClick={() => setEditQ(null)} style={btn(C.slate)}>Cancel</button>
          </div>
        </div>
      )}

      {loading
        ? <div style={{ textAlign:'center', padding:48, color:C.slate }}>⏳ Loading questions…</div>
        : paginated.length === 0
          ? <div style={{ ...cardS, textAlign:'center', padding:48, color:'#94a3b8' }}>
              No questions found. Add questions using Manual Add or Bulk Paste tab.
            </div>
          : (
            <>
              {isAdmin && (
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                  <input type="checkbox" checked={selected.size===paginated.length && paginated.length>0}
                    onChange={toggleAll} />
                  <span style={{ fontSize:12, color:C.slate }}>Select all on page</span>
                </div>
              )}
              {paginated.map((q, i) => (
                <QCard key={q.id} q={q} index={(page-1)*PAGE+i}
                  selectable={isAdmin} selected={selected.has(q.id)}
                  onToggle={isAdmin ? toggleSelect : undefined}
                  onEdit={isAdmin ? setEditQ : undefined}
                  onDelete={isAdmin ? handleDelete : undefined} />
              ))}
            </>
          )
      }

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16, alignItems:'center' }}>
          <button onClick={() => setPage(1)} disabled={page===1} style={btn(C.slate, page===1)}>«</button>
          <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={btn(C.slate, page===1)}>‹</button>
          <span style={{ padding:'8px 14px', fontWeight:600, color:C.navy, fontSize:13 }}>
            Page {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={btn(C.slate, page===totalPages)}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page===totalPages} style={btn(C.slate, page===totalPages)}>»</button>
        </div>
      )}
    </>
  )
}

// ── SINGLE QUESTION ROW FORM (used in Manual Add + Edit) ─────────────────────
function QuestionRowForm({ row, index, onChange, onRemove, showImageUpload, showToast }) {
  const chapters    = SUBJECTS[row.subject] || []
  const subSecMap   = SUBSECTION_KEYWORDS[row.subject] || {}
  const subsections = Object.keys(subSecMap)
  const fileRef     = useRef()

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const ext  = file.name.split('.').pop()
    const path = `q_${Date.now()}_${index}.${ext}`
    const { error } = await supabase.storage.from(DIAGRAM_BUCKET).upload(path, file, { upsert:true })
    if (error) { showToast('Image upload failed: ' + error.message, C.rose); return }
    const { data } = supabase.storage.from(DIAGRAM_BUCKET).getPublicUrl(path)
    onChange(index, 'diagram_url', data.publicUrl)
    showToast('Diagram uploaded ✓', C.green)
  }

  const handleQuestionChange = (val) => {
    onChange(index, 'question', val)
    if (row.subject && val.length > 20) {
      const detected = detectSubsection(val, row.subject)
      if (detected !== 'General' && !row.subsection) onChange(index, 'subsection', detected)
    }
  }

  return (
    <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginBottom:10, background:'#fafafa' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:700, color:C.navy }}>Question {index+1}</span>
        {onRemove && (
          <button onClick={() => onRemove(index)} style={btnSm('#fee2e2', C.rose)}>✖ Remove</button>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
        <div>
          <label style={lS}>Subject *</label>
          <select style={iS} value={row.subject}
            onChange={e => { onChange(index,'subject',e.target.value); onChange(index,'chapter',''); onChange(index,'subsection','') }}>
            <option value="">Select</option>
            {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Chapter *</label>
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
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        {['A','B','C','D'].map(l => (
          <div key={l}>
            <label style={{ ...lS, color: row.correct_option===l ? C.green : C.slate }}>
              Option {l} {row.correct_option===l ? '✓ Correct' : ''}
            </label>
            <input style={{ ...iS, borderColor: row.correct_option===l ? '#86efac' : C.border }}
              value={row[`option_${l.toLowerCase()}`] || ''}
              onChange={e => onChange(index, `option_${l.toLowerCase()}`, e.target.value)}
              placeholder={`Option ${l}`} />
            <input style={{ ...iS, marginTop:4, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}
              value={row[`option_${l.toLowerCase()}_mayek`] || ''}
              onChange={e => onChange(index, `option_${l.toLowerCase()}_mayek`, e.target.value)}
              placeholder={`Option ${l} (Meitei Mayek, optional)`} />
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
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
            <input ref={fileRef} type="file" accept="image/*"
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
const emptyRow = () => ({
  subject:'', chapter:'', subsection:'', question:'', question_mayek:'',
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
  const removeRow = (i) => setRows(prev => prev.filter((_,idx) => idx!==i))

  // Subject and chapter of first row — drives the reference panel
  const refSubject = rows[0]?.subject
  const refChapter = rows[0]?.chapter

  const handleSave = async () => {
    const invalid = rows.filter(r => !r.subject || !r.chapter || !r.question || !r.option_a || !r.option_b || !r.correct_option)
    if (invalid.length) { showToast(`${invalid.length} row(s) incomplete — fill all required fields`, C.amber); return }

    // ── Duplicate check — feature #6 ──
    const dupes = findDuplicates(rows, questions || [])
    if (dupes.length) {
      const go = confirm(`${dupes.length} question(s) look identical to ones already in the bank (Q${dupes.map(d=>d.index+1).join(', Q')}). Save anyway?`)
      if (!go) return
    }

    setSaving(true)
    const payload = rows.map(r => ({
      ...r,
      subsection: r.subsection || detectSubsection(r.question, r.subject),
    }))
    const { error } = await supabase.from('qbank_questions').insert(payload)
    if (error) { showToast('Save failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ ${rows.length} question(s) saved!`, C.green)
    // ── PATCH: notify StudyMaterial badge to refresh ──
    EventBus.emit(GNSI_EVENTS.QUESTION_SAVED, { subject: refSubject, chapter: refChapter, count: rows.length })
    setRows([emptyRow()]); refetch()
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
      <StudyMaterialsRefPanel subject={refSubject} chapter={refChapter} onNavigate={onNavigate} />

      {rows.map((row, i) => (
        <QuestionRowForm key={i} row={row} index={i}
          onChange={updateRow} onRemove={rows.length>1?removeRow:null}
          showImageUpload showToast={showToast} />
      ))}

      <div style={{ display:'flex', gap:10, marginTop:16 }}>
        <button onClick={handleSave} disabled={saving} style={btn(C.navy, saving)}>
          {saving ? '⏳ Saving…' : `✅ Save ${rows.length} Question${rows.length>1?'s':''}`}
        </button>
        <button onClick={() => setRows([emptyRow()])} style={btn(C.slate)}>🔄 Clear All</button>
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
  const [bulkSubject,   setBulkSubject]   = useState('')
  const [bulkChapter,   setBulkChapter]   = useState('')
  const [extracted,     setExtracted]     = useState([])
  const [showAnswerKey, setShowAnswerKey] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [step,          setStep]          = useState(1)
  const chapters = SUBJECTS[bulkSubject] || []

  const dupeIndexSet = useMemo(() => {
    if (!extracted.length) return new Set()
    return new Set(findDuplicates(extracted, questions || []).map(d => d.index))
  }, [extracted, questions])

  const handleExtract = () => {
    if (!rawText.trim()) { showToast('Paste some text first', C.amber); return }
    const parsed = parseQuestions(rawText)
    if (!parsed.length) { showToast('No questions detected — check the format', C.rose); return }
    const tagged = parsed.map(q => ({
      ...q,
      subject: bulkSubject || '',
      chapter: bulkChapter || '',
      subsection: q._subsectionHint
        ? q._subsectionHint
        : (bulkSubject ? detectSubsection(q.question, bulkSubject) : ''),
    }))
    setExtracted(tagged)
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
      const parsed = parseCSVQuestions(ev.target.result, bulkSubject, bulkChapter)
      if (!parsed.length) { showToast('No valid rows found — check your CSV has a "question" column', C.rose); return }
      const tagged = parsed.map(q => ({
        ...q,
        subsection: q.subsection || (q.subject ? detectSubsection(q.question, q.subject) : ''),
      }))
      setExtracted(tagged)
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
    const invalid = extracted.filter(q => !q.subject || !q.chapter)
    if (invalid.length) { showToast(`${invalid.length} questions missing subject/chapter`, C.amber); return }
    const noAnswer = extracted.filter(q => !q.correct_option)
    if (noAnswer.length > 0) {
      const go = confirm(`${noAnswer.length} questions have no answer marked. Save anyway?`)
      if (!go) return
    }
    // ── Duplicate check — feature #6 ──
    if (dupeIndexSet.size) {
      const go = confirm(`${dupeIndexSet.size} question(s) look identical to ones already in the bank (highlighted below). Save anyway?`)
      if (!go) return
    }
    setSaving(true)
    const payload = extracted.map(({ _id, _qNum, _subsectionHint, _needsDiagram, ...rest }) => ({
      ...rest,
      subsection: rest.subsection || detectSubsection(rest.question, rest.subject) || 'General',
    }))
    const { error } = await supabase.from('qbank_questions').insert(payload)
    if (error) { showToast('Save failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ ${payload.length} questions saved to bank!`, C.green)
    // ── PATCH: notify StudyMaterial badge to refresh ──
    EventBus.emit(GNSI_EVENTS.QUESTION_SAVED, { subject: bulkSubject, chapter: bulkChapter, count: payload.length })
    setExtracted([]); setRawText(''); setAnswerKeyText(''); setStep(1); refetch()
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

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14,
            padding:'12px 14px', borderRadius:9, background:'#f8fafc', border:`1px solid ${C.border}` }}>
            <div>
              <label style={lS}>Assign Subject to all</label>
              <select style={iS} value={bulkSubject}
                onChange={e => { setBulkSubject(e.target.value); setBulkChapter('') }}>
                <option value="">— Select Subject —</option>
                {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
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
          <StudyMaterialsRefPanel subject={bulkSubject} chapter={bulkChapter} onNavigate={onNavigate} />

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

            <div style={{ marginTop:12, display:'flex', gap:16, fontSize:12 }}>
              <span style={{ color:C.green }}>✅ {extracted.filter(q=>q.correct_option).length} answered</span>
              <span style={{ color:C.rose }}>❌ {extracted.filter(q=>!q.correct_option).length} unanswered</span>
              <span style={{ color:C.amber }}>⚠️ {extracted.filter(q=>q._needsDiagram).length} need diagram</span>
            </div>
          </div>

          {extracted.map((q, i) => (
            <div key={i} style={{ ...cardS, marginBottom:10, padding:'14px 16px',
              border: dupeIndexSet.has(i) ? `1px solid ${C.amber}` : q.correct_option ? `1px solid #86efac` : `1px solid ${C.rose}44`,
              background: q._needsDiagram ? '#fffbeb' : '#fff' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.slate }}>Q{q._qNum || i+1}</span>
                {dupeIndexSet.has(i) && (
                  <Badge text="⚠️ Possible duplicate — already in bank" color="#92400e" bg="#fef3c7" />
                )}
                {q._needsDiagram && (
                  <Badge text="⚠️ Needs Diagram — add image later via Bank tab" color="#92400e" bg="#fef3c7" />
                )}
                {q._subsectionHint && (
                  <Badge text={`Section: ${q._subsectionHint}`} color="#0369a1" bg="#e0f2fe" />
                )}
              </div>
              <div style={{ fontSize:13, fontWeight:500, color:'#1e293b', marginBottom:q.question_mayek ? 4 : 10, lineHeight:1.6 }}>
                {q.question}
              </div>
              {q.question_mayek && (
                <div style={{ fontSize:14, color:'#374151', marginBottom:10, lineHeight:1.7, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
                  {q.question_mayek}
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:10 }}>
                {['A','B','C','D'].map(l => (
                  <div key={l} style={{ padding:'5px 10px', borderRadius:6, fontSize:12,
                    background: q.correct_option===l ? '#dcfce7' : '#f8fafc',
                    border:`1px solid ${q.correct_option===l ? '#86efac' : C.border}` }}>
                    <span style={{ fontWeight:700, marginRight:5 }}>{l}.</span>
                    {q[`option_${l.toLowerCase()}`] || '—'}
                    {q.correct_option===l && ' ✓'}
                    {q[`option_${l.toLowerCase()}_mayek`] && (
                      <div style={{ fontFamily:"'Noto Sans Meetei Mayek', sans-serif", marginTop:2 }}>
                        {q[`option_${l.toLowerCase()}_mayek`]}
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                <select style={{ ...iS, fontSize:11, padding:'4px 8px' }} value={q.subject}
                  onChange={e => updateQ(i,'subject',e.target.value)}>
                  <option value="">Subject?</option>
                  {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select style={{ ...iS, fontSize:11, padding:'4px 8px', opacity:q.subject?1:.5 }}
                  value={q.chapter} onChange={e => updateQ(i,'chapter',e.target.value)} disabled={!q.subject}>
                  <option value="">Chapter?</option>
                  {(SUBJECTS[q.subject]||[]).map(c => <option key={c} value={c}>{c}</option>)}
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

          <div style={{ display:'flex', gap:10, marginTop:8, alignItems:'center' }}>
            <button onClick={handleSave} disabled={saving} style={btn(C.green, saving)}>
              {saving ? '⏳ Saving…' : `✅ Save All ${extracted.length} Questions to Bank`}
            </button>
            <span style={{ fontSize:12, color:C.slate }}>
              {extracted.filter(q=>!q.correct_option).length > 0
                ? `⚠️ ${extracted.filter(q=>!q.correct_option).length} without answer`
                : '✅ All answered'}
            </span>
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

let mayekFontRegistered = false
async function ensureMayekFont(doc) {
  if (!mayekFontRegistered) {
    doc.addFileToVFS('NotoSansMeeteiMayek.ttf', NotoSansMeeteiMayek)
    doc.addFont('NotoSansMeeteiMayek.ttf', 'NotoMayek', 'normal')
    mayekFontRegistered = true
  } else {
    // Font data is per-instance in some jsPDF versions — re-register safely if needed
    try {
      doc.addFileToVFS('NotoSansMeeteiMayek.ttf', NotoSansMeeteiMayek)
      doc.addFont('NotoSansMeeteiMayek.ttf', 'NotoMayek', 'normal')
    } catch (e) { /* already registered on this doc instance */ }
  }
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
  } catch (e) { return null }
}

async function generatePDF({ title, subject, chapter, questions, withAnswers, timeMinutes, instructions }) {
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = res; s.onerror = rej; document.head.appendChild(s)
    })
  }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  await ensureMayekFont(doc)

  // Pre-fetch diagram images so they can be embedded synchronously during layout
  const diagramCache = {}
  await Promise.all(
    questions.filter(q => q.diagram_url).map(async q => {
      diagramCache[q.id || q._id] = await fetchImageAsDataURL(q.diagram_url)
    })
  )

  const W = 210, H = 297, margin = 16
  const contentW = W - margin*2
  const totalMarks = questions.reduce((s,q)=>s+(q.marks||1),0)
  const HEADER_H = 40   // letterhead block height, repeated on every page
  const FOOTER_Y = H - 12

  // ── Letterhead — drawn identically on every page ──────────────────────────
  const drawLetterhead = (pageLabel) => {
    // Navy band with institute name + crest circle
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
    doc.text('Guidance Navodaya & Sainik Institute', margin+16, 11)
    doc.setFontSize(8.5); doc.setFont('helvetica','normal')
    doc.text('Khangabok, Thoubal, Manipur  ·  Est. 2016', margin+16, 16.5)
    doc.setFontSize(7.5)
    doc.text('AISSEE · JNVST · RMS Entrance Preparation', margin+16, 21.5)

    doc.setFontSize(8); doc.setFont('helvetica','normal')
    doc.text(pageLabel || '', W-margin, 11, { align:'right' })
    doc.setFontSize(7.5)
    doc.text(`Date: ${today()}`, W-margin, 16.5, { align:'right' })
  }

  // ── Footer — drawn identically on every page ──────────────────────────────
  const drawFooter = (pageNum, pageCount) => {
    doc.setDrawColor(226,232,240); doc.setLineWidth(.2)
    doc.line(margin, FOOTER_Y-4, W-margin, FOOTER_Y-4)
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184)
    doc.text('GNSI Question Paper · Confidential — For Institute Use Only', margin, FOOTER_Y)
    doc.text(`Page ${pageNum} of ${pageCount}`, W-margin, FOOTER_Y, { align:'right' })
  }

  let y = HEADER_H
  drawLetterhead()

  const checkPage = (need=10) => {
    if (y + need > FOOTER_Y - 6) {
      doc.addPage()
      drawLetterhead()
      y = HEADER_H
    }
  }

  // ── Paper title block ───────────────────────────────────────────────────
  doc.setFontSize(15); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
  doc.text(title, W/2, y, { align:'center' }); y += 6
  doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
  doc.text(`Subject: ${subject}   |   Chapter: ${chapter}`, W/2, y, { align:'center' }); y += 7

  // ── Student info line — real exam-blank fields ─────────────────────────
  doc.setDrawColor(148,163,184); doc.setLineWidth(.3)
  const infoY = y
  doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59)
  doc.text('Name:', margin, infoY)
  doc.line(margin+16, infoY+0.8, margin+78, infoY+0.8)
  doc.text('Roll No.:', margin+84, infoY)
  doc.line(margin+100, infoY+0.8, margin+130, infoY+0.8)
  doc.text('Class:', margin+136, infoY)
  doc.line(margin+148, infoY+0.8, W-margin, infoY+0.8)
  y += 9

  // ── Marks / time / instructions box ────────────────────────────────────
  doc.setFillColor(240,246,255); doc.setDrawColor(191,219,254); doc.setLineWidth(.3)
  const boxTop = y
  const instrLines = doc.splitTextToSize(instructions || 'Attempt all questions. Each question carries the marks shown against it. No negative marking unless stated.', contentW-8)
  const boxH = 14 + instrLines.length*4.2
  doc.roundedRect(margin, boxTop, contentW, boxH, 1.5, 1.5, 'FD')
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
  doc.text(`Time Allowed: ${timeMinutes || Math.max(15, Math.round(questions.length*1.5))} minutes`, margin+4, boxTop+6)
  doc.text(`Maximum Marks: ${totalMarks}`, margin+contentW-4, boxTop+6, { align:'right' })
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(51,65,85)
  doc.text('General Instructions:', margin+4, boxTop+11.5)
  doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105)
  doc.text(instrLines, margin+4, boxTop+16)
  y = boxTop + boxH + 8

  doc.setDrawColor(30,58,95); doc.setLineWidth(.6)
  doc.line(margin, y, W-margin, y); y += 7

  // ── Questions — two-column option layout (A/B on one row, C/D on next) ──
  const optColW = (contentW - 12) / 2
  questions.forEach((q,i) => {
    checkPage(26)
    doc.setFontSize(10.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
    const qText = `Q${i+1}. ${q.question}`
    const qLines = doc.splitTextToSize(qText, contentW)
    checkPage(qLines.length*5 + 24)
    doc.text(qLines, margin, y)
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
    doc.text(`[${q.marks||1} ${(q.marks||1)===1?'mark':'marks'}]`, W-margin, y, { align:'right' })
    y += qLines.length*5 + 2

    if (q.question_mayek) {
      checkPage(9)
      doc.setFontSize(10.5); doc.setFont('NotoMayek','normal'); doc.setTextColor(55,65,81)
      const mLines = doc.splitTextToSize(q.question_mayek, contentW)
      checkPage(mLines.length*5+8)
      doc.text(mLines, margin, y); y += mLines.length*5 + 2
    }

    const diagramData = diagramCache[q.id || q._id]
    if (q.diagram_url && diagramData) {
      checkPage(36)
      try {
        doc.addImage(diagramData, margin, y, 50, 32)
        y += 35
      } catch(e) { /* image failed to embed — skip silently, question text still stands */ }
    }

    // Options in a 2×2 grid: A B on one row, C D on next
    const pairs = [['A','B'], ['C','D']]
    pairs.forEach(([l1, l2]) => {
      checkPage(8)
      const rowY = y
      let maxRowH = 6
      ;[[l1, margin], [l2, margin + optColW + 12]].forEach(([l, x]) => {
        const isCorrect = withAnswers && q.correct_option === l
        const optText = `${l}.  ${q[`option_${l.toLowerCase()}`] || '—'}`
        doc.setFontSize(9.5); doc.setFont('helvetica', isCorrect?'bold':'normal')
        doc.setTextColor(isCorrect?21:51, isCorrect?128:65, isCorrect?61:85)
        const lines = doc.splitTextToSize(optText, optColW)
        if (isCorrect) {
          doc.setFillColor(220,252,231)
          doc.roundedRect(x-2, rowY-4, optColW+2, lines.length*4.6+2, 1, 1, 'F')
          doc.setTextColor(21,128,61); doc.setFont('helvetica','bold')
        }
        doc.text(lines, x, rowY)
        maxRowH = Math.max(maxRowH, lines.length*4.6+2)

        const mayek = q[`option_${l.toLowerCase()}_mayek`]
        if (mayek) {
          doc.setFontSize(9); doc.setFont('NotoMayek','normal')
          const mLines = doc.splitTextToSize(mayek, optColW)
          doc.text(mLines, x, rowY + lines.length*4.6)
          maxRowH = Math.max(maxRowH, lines.length*4.6 + mLines.length*4.6 + 2)
        }
      })
      y += maxRowH + 1.5
    })

    y += 3
    doc.setDrawColor(226,232,240); doc.setLineWidth(.15)
    doc.line(margin, y, W-margin, y)
    y += 5.5
  })

  // ── Answer key on its own clean, boxed page ────────────────────────────
  if (!withAnswers) {
    doc.addPage()
    drawLetterhead('Answer Key')
    y = HEADER_H
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
    doc.text('Answer Key', W/2, y, { align:'center' }); y += 4
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
    doc.text(`${title}  ·  ${subject} — ${chapter}`, W/2, y, { align:'center' }); y += 8

    const cols = 6, cellW = contentW/cols, cellH = 9
    const rowsPerPage = Math.floor((FOOTER_Y - 10 - y) / cellH)
    doc.setDrawColor(191,219,254); doc.setLineWidth(.3)
    let pageStartY = y
    questions.forEach((q,i) => {
      const posOnPage = i % (cols * rowsPerPage)
      const col = posOnPage % cols
      const row = Math.floor(posOnPage / cols)
      if (posOnPage === 0 && i > 0) {
        doc.addPage(); drawLetterhead('Answer Key — contd.')
        pageStartY = HEADER_H
      }
      const cx = margin + col*cellW
      const cy = pageStartY + row*cellH
      doc.setFillColor(240,246,255)
      doc.roundedRect(cx, cy, cellW-2, cellH-2, 1, 1, 'F')
      doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
      doc.text(`Q${i+1}`, cx+3, cy+5.5)
      doc.setFont('helvetica','normal'); doc.setTextColor(21,128,61)
      doc.text(q.correct_option || '—', cx+cellW-6, cy+5.5, { align:'right' })
    })
  }

  // ── Footer on every page ────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p=1; p<=pages; p++) {
    doc.setPage(p)
    drawFooter(p, pages)
  }

  doc.save(`${title.replace(/\s+/g,'_')}.pdf`)
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4: CREATE PAPER (unchanged)
// ══════════════════════════════════════════════════════════════════════════════
function TabPaper({ questions, showToast }) {
  const [subject,      setSubject]      = useState('')
  const [chapter,      setChapter]      = useState('')
  const [selSubs,      setSelSubs]      = useState({})
  const [difficulty,   setDifficulty]   = useState('All')
  const [title,        setTitle]        = useState('')
  const [withAnswers,  setWithAnswers]  = useState(false)
  const [timeMinutes,  setTimeMinutes]  = useState('')
  const [instructions, setInstructions] = useState('Attempt all questions. Each question carries the marks shown against it. No negative marking unless stated.')
  const [preview,      setPreview]      = useState(null)
  const [downloading,  setDownloading]  = useState(false)
  const chapters = subject ? SUBJECTS[subject] : []

  const availableSubs = useMemo(() => {
    if (!subject || !chapter) return {}
    const map = {}
    questions.filter(q => q.subject===subject && q.chapter===chapter &&
      (difficulty==='All' || q.difficulty===difficulty))
      .forEach(q => { const s=q.subsection||'General'; map[s]=(map[s]||0)+1 })
    return map
  }, [questions, subject, chapter, difficulty])

  const toggleSub = (sub) => {
    setSelSubs(prev => {
      const n = {...prev}
      if (n[sub] !== undefined) delete n[sub]
      else n[sub] = Math.min(10, availableSubs[sub]||5)
      return n
    })
  }
  const updateCount = (sub, val) => setSelSubs(prev => ({...prev, [sub]: parseInt(val)||1}))
  const totalSelected = Object.values(selSubs).reduce((a,b)=>a+b,0)

  const handlePreview = () => {
    if (!subject || !chapter) { showToast('Select subject and chapter', C.amber); return }
    const selected = Object.keys(selSubs)
    if (!selected.length) { showToast('Select at least one subsection', C.amber); return }
    let pool = []
    selected.forEach(sub => {
      const subQs = questions.filter(q =>
        q.subject===subject && q.chapter===chapter &&
        (q.subsection||'General')===sub &&
        (difficulty==='All' || q.difficulty===difficulty)
      ).sort(() => Math.random()-.5)
      pool = pool.concat(subQs.slice(0, selSubs[sub]||5))
    })
    if (!pool.length) { showToast('No questions available for selected subsections', C.amber); return }
    setPreview(pool)
    if (!title) setTitle(`${subject} — ${chapter}`)
  }

  const handleDownload = async () => {
    if (!preview?.length) return
    setDownloading(true)
    try {
      await generatePDF({
        title: title||'Question Paper', subject, chapter, questions:preview, withAnswers,
        timeMinutes: parseInt(timeMinutes) || undefined,
        instructions: instructions.trim() || undefined,
      })
      showToast('📄 PDF downloaded!', C.green)
    } catch(e) { showToast('PDF failed: '+e.message, C.rose) }
    setDownloading(false)
  }

  return (
    <>
      <div style={cardS}>
        <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:16 }}>📄 Create Question Paper</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={lS}>Subject *</label>
            <select style={iS} value={subject}
              onChange={e => { setSubject(e.target.value); setChapter(''); setSelSubs({}) }}>
              <option value="">Select</option>
              {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Chapter *</label>
            <select style={{ ...iS, opacity:subject?1:.5 }} value={chapter}
              onChange={e => { setChapter(e.target.value); setSelSubs({}) }} disabled={!subject}>
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
            <label style={lS}>Paper Title</label>
            <input style={iS} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Fractions — Unit Test" />
          </div>
          <div>
            <label style={lS}>Time Allowed <span style={{ fontWeight:400, textTransform:'none' }}>(minutes, optional)</span></label>
            <input type="number" min={1} style={iS} value={timeMinutes}
              onChange={e => setTimeMinutes(e.target.value)}
              placeholder="Auto (1.5 min/question)" />
          </div>
          <div style={{ gridColumn:'2/-1' }}>
            <label style={lS}>General Instructions <span style={{ fontWeight:400, textTransform:'none' }}>(shown on the paper)</span></label>
            <textarea style={{ ...iS, resize:'vertical' }} rows={2} value={instructions}
              onChange={e => setInstructions(e.target.value)} />
          </div>
        </div>

        {Object.keys(availableSubs).length > 0 && (
          <div style={{ marginBottom:16 }}>
            <label style={{ ...lS, marginBottom:8 }}>
              Select Subsections & Question Count
              <span style={{ fontWeight:400, marginLeft:6, textTransform:'none' }}>(Total: {totalSelected} questions)</span>
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {Object.entries(availableSubs).map(([sub, count]) => (
                <div key={sub} onClick={() => toggleSub(sub)}
                  style={{ padding:'10px 14px', borderRadius:9, cursor:'pointer',
                    border:`2px solid ${selSubs[sub]!==undefined?C.navy:C.border}`,
                    background: selSubs[sub]!==undefined ? '#eff6ff' : '#f8fafc',
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:selSubs[sub]!==undefined?C.navy:C.slate }}>
                      {selSubs[sub]!==undefined ? '☑' : '☐'} {sub}
                    </div>
                    <div style={{ fontSize:11, color:C.slate }}>{count} questions available</div>
                  </div>
                  {selSubs[sub]!==undefined && (
                    <div onClick={e=>e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:11, color:C.slate }}>Pick:</span>
                      <input type="number" min={1} max={count} value={selSubs[sub]}
                        onChange={e => updateCount(sub, e.target.value)}
                        style={{ width:50, padding:'3px 6px', borderRadius:5,
                          border:`1px solid ${C.border}`, fontSize:12, textAlign:'center' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {chapter && Object.keys(availableSubs).length === 0 && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'#fef9c3', border:'1px solid #fde68a',
            fontSize:13, color:'#92400e', marginBottom:14 }}>
            ⚠️ No questions found for this chapter. Add questions using Manual Add or Bulk Paste.
          </div>
        )}

        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:14 }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:C.navy, fontWeight:600 }}>
            <input type="checkbox" checked={withAnswers} onChange={e=>setWithAnswers(e.target.checked)} />
            Include answers in PDF
          </label>
        </div>

        <button onClick={handlePreview} disabled={!subject||!chapter||!totalSelected}
          style={btn(C.navy, !subject||!chapter||!totalSelected)}>
          👁 Preview Paper ({totalSelected} questions)
        </button>
      </div>

      {preview && (
        <div style={cardS}>
          <div id="qbank-paper-preview" style={{ border:`2px solid ${C.navy}`, borderRadius:10, padding:'20px 24px', marginBottom:16, background:'#fff' }}>
            <div style={{ textAlign:'center', borderBottom:`1px solid ${C.border}`, paddingBottom:12, marginBottom:14 }}>
              <div style={{ fontSize:18, fontWeight:800, color:C.navy }}>Guidance Navodaya & Sainik Institute</div>
              <div style={{ fontSize:11, color:C.slate }}>Khangabok, Thoubal, Manipur · Est. 2016</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginTop:8 }}>{title}</div>
              <div style={{ fontSize:12, color:C.slate, marginTop:4 }}>
                Subject: {subject} | Chapter: {chapter} | Date: {today()}
              </div>
            </div>

            <div style={{ display:'flex', gap:20, fontSize:12, color:'#374151', marginBottom:12 }}>
              <span>Name: <span style={{ display:'inline-block', width:110, borderBottom:`1px solid ${C.border}` }}>&nbsp;</span></span>
              <span>Roll No.: <span style={{ display:'inline-block', width:70, borderBottom:`1px solid ${C.border}` }}>&nbsp;</span></span>
              <span>Class: <span style={{ display:'inline-block', width:60, borderBottom:`1px solid ${C.border}` }}>&nbsp;</span></span>
            </div>

            <div style={{ padding:'10px 14px', borderRadius:8, background:'#f0f6ff', border:'1px solid #bfdbfe', marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:C.navy, marginBottom:6 }}>
                <span>Time Allowed: {timeMinutes || Math.max(15, Math.round(preview.length*1.5))} minutes</span>
                <span>Maximum Marks: {preview.reduce((s,q)=>s+(q.marks||1),0)}</span>
              </div>
              <div style={{ fontSize:11, color:'#475569' }}>
                <strong>General Instructions:</strong> {instructions}
              </div>
            </div>

            {preview.map((q,i) => (
              <div key={q.id||i} style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:q.question_mayek ? 2 : 6 }}>
                  <span style={{ color:C.slate, marginRight:6 }}>Q{i+1}.</span>{q.question}
                  <span style={{ float:'right', fontSize:11, color:C.slate }}>[{q.marks||1}M]</span>
                </div>
                {q.question_mayek && (
                  <div style={{ fontSize:13, color:'#374151', marginBottom:6, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
                    {q.question_mayek}
                  </div>
                )}
                {q.diagram_url && (
                  <img src={q.diagram_url} alt="diagram"
                    style={{ maxWidth:200, maxHeight:140, borderRadius:6, marginBottom:6, display:'block' }} />
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                  {['A','B','C','D'].map(l => (
                    <div key={l} style={{ fontSize:12, padding:'3px 8px', color:'#374151' }}>
                      <span style={{ fontWeight:700, color:C.slate, marginRight:4 }}>{l}.</span>
                      {q[`option_${l.toLowerCase()}`]||'—'}
                      {withAnswers && q.correct_option===l && <span style={{ color:C.green, marginLeft:6, fontWeight:700 }}>✓</span>}
                      {q[`option_${l.toLowerCase()}_mayek`] && (
                        <div style={{ fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
                          {q[`option_${l.toLowerCase()}_mayek`]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {i<preview.length-1 && <div style={{ height:1, background:C.border, marginTop:10 }} />}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={handleDownload} disabled={downloading} style={btn(C.green, downloading)}>
              {downloading ? '⏳ Generating PDF…' : '⬇ Download PDF'}
            </button>
            <button onClick={handlePreview} style={btn(C.navy)}>🔀 Reshuffle</button>
            <CastButton presentTargetId="qbank-paper-preview" title={title} showToast={showToast} />
            <button onClick={() => setPreview(null)} style={btn(C.slate)}>✕ Close</button>
          </div>
        </div>
      )}
    </>
  )
}

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
          <div style={{ fontSize:'clamp(18px, 2.4vw, 28px)', color:'#cbd5e1', textAlign:'center', maxWidth:1000, marginTop:20, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
            {q.question_mayek}
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
  const chapters = subject ? SUBJECTS[subject] : []

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
    if (!subject || !chapter) return []
    const ss = new Set(questions.filter(q=>q.subject===subject&&q.chapter===chapter).map(q=>q.subsection||'General'))
    return [...ss].sort()
  }, [questions, subject, chapter])

  const handleSubmit = useCallback(() => {
    setTestQs(prevQs => {
      if (!prevQs) return prevQs
      setTimerActive(false)
      setAnswers(prevAnswers => {
        const correct = prevQs.filter(q => prevAnswers[q._testIdx] === q.correct_option).length
        const wrong   = prevQs.filter(q => prevAnswers[q._testIdx] && prevAnswers[q._testIdx] !== q.correct_option).length
        const skipped = prevQs.filter(q => !prevAnswers[q._testIdx]).length
        const score   = prevQs.reduce((a, q) => prevAnswers[q._testIdx] === q.correct_option ? a + (q.marks||1) : a, 0)
        const maxScore= prevQs.reduce((a, q) => a + (q.marks||1), 0)
        const pct     = maxScore ? Math.round((score/maxScore)*100) : 0
        setResult({ correct, wrong, skipped, score, maxScore, pct })
        setSubmitted(true)
        // Persist attempt — best-effort, doesn't block showing the result
        supabase.from('qbank_test_results').insert({
          student_name: studentName,
          subject, chapter,
          question_count: prevQs.length,
          correct, wrong, skipped,
          score, max_score: maxScore, percent: pct,
        }).then(({ error }) => {
          if (error) console.error('Failed to save test result:', error.message)
          else supabase.from('qbank_test_results').select('*').order('created_at', { ascending: false }).limit(20)
            .then(({ data }) => setHistory(data || []))
        })
        return prevAnswers
      })
      return prevQs
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
    if (!subject || !chapter) { showToast('Select subject and chapter', C.amber); return }
    const subFilter = selSubs.size > 0 ? [...selSubs] : availableSubs
    let pool = questions.filter(q =>
      q.subject===subject && q.chapter===chapter &&
      subFilter.includes(q.subsection||'General')
    ).sort(() => Math.random()-.5).slice(0, count)
    if (!pool.length) { showToast('No questions available — add questions first', C.amber); return }
    const indexedPool = pool.map((q,i) => ({...q, _testIdx: i}))
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
                <div style={{ fontSize:13, color:'#374151', marginBottom:5, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
                  {q.question_mayek}
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
              <div style={{ fontSize:14, color:'#374151', marginBottom:10, lineHeight:1.6, fontFamily:"'Noto Sans Meetei Mayek', sans-serif" }}>
                {q.question_mayek}
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
                      <div style={{ fontFamily:"'Noto Sans Meetei Mayek', sans-serif", fontSize:12 }}>
                        {q[`option_${l.toLowerCase()}_mayek`]}
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
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label style={lS}>Student Name *</label>
          <input style={iS} value={studentName} onChange={e=>setStudentName(e.target.value)}
            placeholder="Enter student name" />
        </div>
        <div>
          <label style={lS}>Subject *</label>
          <select style={iS} value={subject}
            onChange={e=>{setSubject(e.target.value);setChapter('');setSelSubs(new Set())}}>
            <option value="">Select</option>
            {SUBJECT_LIST.map(s=><option key={s} value={s}>{s}</option>)}
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
          📊 <strong>{questions.filter(q=>q.subject===subject&&q.chapter===chapter).length}</strong> questions available · Timer: ~{Math.round(count*1.5)} minutes
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
  const [subject,     setSubject]     = useState('')
  const [chapter,     setChapter]     = useState('')
  const [difficulty,  setDifficulty]  = useState('All')
  const [title,       setTitle]       = useState('')
  const [withAnswers, setWithAnswers] = useState(true)
  const [viewing,     setViewing]     = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const chapters = subject ? SUBJECTS[subject] : []

  const chapterQs = useMemo(() => {
    if (!subject || !chapter) return []
    return questions.filter(q => q.subject===subject && q.chapter===chapter &&
      (difficulty==='All' || q.difficulty===difficulty))
  }, [questions, subject, chapter, difficulty])

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
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={lS}>Subject *</label>
            <select style={iS} value={subject} onChange={e => { setSubject(e.target.value); setChapter('') }}>
              <option value="">Select</option>
              {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
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


function TabStats({ questions }) {
  const [filterSubject, setFilterSubject] = useState('All')

  const stats = useMemo(() => {
    const result = {}
    SUBJECT_LIST.forEach(subj => {
      result[subj] = {}
      SUBJECTS[subj].forEach(ch => { result[subj][ch] = { total:0, subsections:{} } })
    })
    questions.forEach(q => {
      if (!result[q.subject]) return
      if (!result[q.subject][q.chapter]) result[q.subject][q.chapter] = { total:0, subsections:{} }
      result[q.subject][q.chapter].total++
      const ss = q.subsection || 'General'
      result[q.subject][q.chapter].subsections[ss] = (result[q.subject][q.chapter].subsections[ss]||0) + 1
    })
    return result
  }, [questions])

  const subjects = filterSubject==='All' ? SUBJECT_LIST : [filterSubject]
  const countColor = (n) => n >= 20 ? C.green : n >= 10 ? C.amber : C.rose
  const countBg    = (n) => n >= 20 ? '#dcfce7' : n >= 10 ? '#fef9c3' : '#fee2e2'
  const countLabel = (n) => n >= 20 ? '✅' : n >= 10 ? '⚠️' : '❌'

  // ── CSV export — feature #9 ──
  const handleExportCSV = () => {
    const rows = [['Subject', 'Chapter', 'Subsection', 'Question Count']]
    subjects.forEach(subj => {
      const chapData = stats[subj] || {}
      SUBJECTS[subj].forEach(ch => {
        const chData = chapData[ch] || { total:0, subsections:{} }
        if (Object.keys(chData.subsections).length === 0) {
          rows.push([subj, ch, '', chData.total])
        } else {
          Object.entries(chData.subsections).forEach(([ss, cnt]) => {
            rows.push([subj, ch, ss, cnt])
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

  return (
    <>
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <select style={{ ...iS, width:'auto' }} value={filterSubject}
          onChange={e=>setFilterSubject(e.target.value)}>
          <option value="All">All Subjects</option>
          {SUBJECT_LIST.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize:12, color:C.slate }}>
          Total: <strong>{questions.length}</strong> questions in bank
        </span>
        <button onClick={handleExportCSV} style={btnSm('#eff6ff', C.navy)}>⬇ Export CSV</button>
        <div style={{ display:'flex', gap:12, marginLeft:'auto', fontSize:12 }}>
          <span>✅ 20+ Good</span><span>⚠️ 10–19 Low</span><span>❌ 0–9 Empty</span>
        </div>
      </div>
      {subjects.map(subj => {
        const sc = SC[subj]
        const chapData = stats[subj] || {}
        const totalSubj = Object.values(chapData).reduce((a,b)=>a+b.total,0)
        return (
          <div key={subj} style={{ ...cardS, borderTop:`3px solid ${sc.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:sc.color }}>{subj}</div>
                <div style={{ fontSize:12, color:C.slate }}>{totalSubj} total questions</div>
              </div>
              <Badge text={`${totalSubj} Q`} color={sc.color} bg={sc.bg} border={sc.border} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {SUBJECTS[subj].map(ch => {
                const chData = chapData[ch] || { total:0, subsections:{} }
                return (
                  <div key={ch} style={{ padding:'10px 14px', borderRadius:8,
                    border:`1px solid ${C.border}`, background:'#fafafa' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#1e293b' }}>{ch}</span>
                      <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700,
                        color: countColor(chData.total), background: countBg(chData.total) }}>
                        {countLabel(chData.total)} {chData.total}
                      </span>
                    </div>
                    {Object.keys(chData.subsections).length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                        {Object.entries(chData.subsections).map(([ss,cnt]) => (
                          <span key={ss} style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                            background:'#f1f5f9', color:C.slate, border:`1px solid ${C.border}` }}>
                            {ss}: {cnt}
                          </span>
                        ))}
                      </div>
                    )}
                    {chData.total === 0 && (
                      <div style={{ fontSize:11, color:C.rose, marginTop:2 }}>
                        Add questions via Manual Add or Bulk Paste
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// Patches: { onNavigate, initialFilter } props + NAVIGATE_TO EventBus listener
// ══════════════════════════════════════════════════════════════════════════════
export default function QuestionBank({ currentUser, perms, onNavigate, initialFilter: initialFilterProp }) {
  // Confirmed via SQL against portal_users.role: "Teaching + Admin",
  // "Teaching", "Non-Teaching" are the staff roles, and "Administrator" is
  // a separate top-level role — both grant admin access.
  const roleLower = (currentUser?.role || '').toLowerCase()
  const isAdmin = roleLower === 'teaching + admin' || roleLower === 'administrator'
  // Question Bank is restricted to the admin role only — "Teaching" and
  // "Non-Teaching" get no access at all, not even read-only viewing.
  const isStaffAllowed = isAdmin

  const [tab,           setTab]           = useState('bank')
  const [questions,     setQuestions]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState(null)
  // initialFilter drives TabBank's pre-filtered view; updated by EventBus
  const [initialFilter, setInitialFilter] = useState(initialFilterProp || null)

  const showToast = (msg, color=C.navy) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  const refetch = useCallback(async () => {
    // Skip the query entirely for non-staff — no data should ever leave
    // Supabase for a role that isn't permitted to see it.
    if (!isStaffAllowed) { setLoading(false); return }
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

    if (hadError) showToast('Failed to load questions', C.rose)
    else setQuestions(all)
    setLoading(false)
  }, [isStaffAllowed])

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

  // ── ACCESS GUARD ─────────────────────────────────────────────────────────
  // Non-admins get view (Bank, read-only) + upload (Manual Add, Bulk Paste)
  // only. Create Paper / Online Test / Stats are admin-only.
  const ADMIN_ONLY_TABS = ['paper', 'test', 'stats', 'smartppt']

  useEffect(() => {
    if (!isAdmin && ADMIN_ONLY_TABS.includes(tab)) {
      setTab('bank')
    }
  }, [isAdmin, tab])

  // Module-level gate — Teaching + Admin role only. This is a UI-layer
  // convenience; Supabase RLS or an equivalent server-side check should also
  // enforce this so the restriction doesn't depend solely on the client.
  if (!isStaffAllowed) {
    return (
      <div style={{ padding:24, fontFamily:'system-ui,sans-serif', background:C.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ ...cardS, maxWidth:420, textAlign:'center', padding:'40px 32px' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:8 }}>Question Bank is restricted</div>
          <div style={{ fontSize:13, color:C.slate, lineHeight:1.6 }}>
            This module is only available to Administrator and Teaching + Admin accounts.
            If you need access to questions or papers for a class, please ask
            an admin to prepare it or check <strong>Study Materials</strong> for
            teaching content.
          </div>
        </div>
      </div>
    )
  }

  const ALL_TABS = [
    { key:'bank',    icon:'📚', label:'Question Bank', count: questions.length },
    { key:'manual',  icon:'✏️', label:'Manual Add',    count: null },
    { key:'bulk',    icon:'📤', label:'Bulk Paste',    count: null },
    { key:'paper',   icon:'📄', label:'Create Paper',  count: null,  adminOnly: true },
    { key:'test',    icon:'📝', label:'Online Test',   count: null,  adminOnly: true },
    { key:'smartppt',icon:'🎬', label:'Smart PPT',     count: null,  adminOnly: true },
    { key:'stats',   icon:'📊', label:'Stats',         count: null,  adminOnly: true },
  ]
  const TABS = isAdmin ? ALL_TABS : ALL_TABS.filter(t => !t.adminOnly)

  return (
    <div style={{ padding:24, fontFamily:'system-ui,sans-serif', background:C.bg, minHeight:'100vh' }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.12em', color:C.slate, marginBottom:4 }}>
          GNSI Portal
        </div>
        <div style={{ fontSize:26, fontWeight:900, color:C.navy, letterSpacing:'-.02em' }}>Question Bank</div>
        <div style={{ fontSize:13, color:C.slate, marginTop:3 }}>
          AISSEE · Sainik School · Navodaya — store, organise, test and print · No AI needed
        </div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:22, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:9,
              border: tab===t.key ? `2px solid ${C.navy}` : `2px solid ${C.border}`,
              background: tab===t.key ? C.navy : '#fff',
              color: tab===t.key ? '#fff' : C.slate,
              fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .12s' }}>
            <span style={{ fontSize:15 }}>{t.icon}</span>
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span style={{ padding:'1px 7px', borderRadius:99, fontSize:10, fontWeight:700,
                background: tab===t.key?'rgba(255,255,255,.2)':C.navy, color:'#fff' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'bank'   && <TabBank   questions={questions} loading={loading} refetch={refetch} showToast={showToast} initialFilter={initialFilter} isAdmin={isAdmin} />}
      {tab === 'manual' && <TabManualAdd questions={questions} refetch={refetch} showToast={showToast} onNavigate={onNavigate} />}
      {tab === 'bulk'   && <TabBulkPaste questions={questions} refetch={refetch} showToast={showToast} onNavigate={onNavigate} />}
      {isAdmin && tab === 'paper'  && <TabPaper  questions={questions} showToast={showToast} />}
      {isAdmin && tab === 'test'   && <TabTest   questions={questions} showToast={showToast} />}
      {isAdmin && tab === 'smartppt' && <TabSmartPPT questions={questions} showToast={showToast} />}
      {isAdmin && tab === 'stats'  && <TabStats  questions={questions} />}
    </div>
  )
}