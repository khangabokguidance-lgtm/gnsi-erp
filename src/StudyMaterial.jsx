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

// ── CAST TO SCREEN ──────────────────────────────────────────────────────────
// Browsers cannot invoke the Miracast protocol directly — there is no web API
// for that OS-level wireless-display standard. What the browser CAN offer:
// 1) The Presentation API, which opens the OS's native device picker. On
//    Windows this picker includes Miracast receivers alongside Chromecast/
//    DLNA targets, so triggering it is the closest a web app gets to
//    "cast via Miracast" — the actual protocol handoff happens in the OS,
//    outside the page's control.
// 2) A fallback for machines with no wireless receiver available: open the
//    content in a dedicated full-screen window, so a teacher can still
//    present via an HDMI/physical mirroring setup with a clean, chrome-free
//    view instead of the whole app UI.
function useCast() {
  const [available, setAvailable] = useState(false)
  const [casting, setCasting] = useState(false)
  const connectionRef = useRef(null)

  useEffect(() => {
    setAvailable(typeof window !== 'undefined' && 'PresentationRequest' in window)
  }, [])

  const startCast = useCallback(async (url, { onFallback, showToast } = {}) => {
    if (available) {
      try {
        const request = new window.PresentationRequest([url])
        const connection = await request.start()
        connectionRef.current = connection
        setCasting(true)
        connection.addEventListener('close', () => setCasting(false))
        connection.addEventListener('terminate', () => setCasting(false))
        return
      } catch (err) {
        // User cancelled the device picker, or no receiver responded —
        // fall through to the full-screen fallback rather than dead-ending.
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

// Opens a chrome-free full-screen window showing the material — the practical
// fallback for teachers with a physically mirrored/HDMI-connected display and
// no wireless receiver for the Presentation API to find.
function openFullscreenPresentation(url, title) {
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) return false
  win.document.write(`<!DOCTYPE html><html><head><title>${title || 'GNSI Presentation'}</title>
    <style>html,body{margin:0;height:100%;background:#000;}
    iframe{width:100%;height:100%;border:none;}</style></head>
    <body><iframe src="${url}#toolbar=0&navpanes=0" allowfullscreen></iframe></body></html>`)
  win.document.close()
  try { win.document.documentElement.requestFullscreen?.() } catch (e) { /* fullscreen may be blocked by browser policy — window still opens */ }
  return true
}

function CastButton({ url, title, showToast, small }) {
  const { castAvailable, casting, startCast, stopCast } = useCast()

  const handleClick = () => {
    if (casting) { stopCast(); return }
    startCast(url, {
      showToast,
      onFallback: () => {
        const opened = openFullscreenPresentation(url, title)
        if (!opened) showToast?.('Pop-up blocked — allow pop-ups to present full-screen', C.amber)
      },
    })
  }

  const style = small
    ? btnSm(casting ? '#dcfce7' : '#eff6ff', casting ? '#15803d' : C.navy)
    : btn(casting ? C.green : C.navy)

  return (
    <button onClick={handleClick} style={style} title={castAvailable ? 'Cast to a TV or wireless display' : 'Present full-screen'}>
      {casting ? '📡 Casting — tap to stop' : castAvailable ? '📡 Cast to Screen' : '🖥 Present Full-Screen'}
    </button>
  )
}

// ── SMART PPT / SLIDE CAST ENGINE (materials) ───────────────────────────────
// Same two-path casting model as QuestionBank's Smart PPT: a same-machine
// dual-screen path via BroadcastChannel, and a genuinely wireless path via
// the Presentation API + a real /cast-receiver route that re-fetches its
// own content from Supabase (see CastReceiver.jsx — shared by both modules).
const CAST_CHANNEL_NAME = 'gnsi-cast-v1'

function buildMaterialSlides(materials) {
  return materials.map(m => ({
    kind: 'material',
    id: m.id,
    title: m.title,
    material_type: m.material_type,
    description: m.description || '',
    file_url: m.file_url || '',
  }))
}

function useSlideCast({ subject, chapter, source = 'studymaterial' }) {
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

  const postLocal = useCallback((index) => {
    channelRef.current?.postMessage({ subject, chapter, source, index, ts: Date.now() })
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
      const url = `${window.location.origin}/cast-receiver?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}&source=${source}&session=${newSession}`
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

  const broadcastIndex = useCallback((index) => {
    if (localCasting) postLocal(index)
    if (wirelessCasting) postWireless(index)
  }, [localCasting, wirelessCasting, postLocal, postWireless])

  return {
    localAvailable, wirelessAvailable, localCasting, wirelessCasting,
    startLocalCast, stopLocalCast, startWirelessCast, stopWirelessCast,
    broadcastIndex,
  }
}

// ── SMART PPT: .pptx EXPORT (materials) ─────────────────────────────────────
async function ensurePptxGenLoaded() {
  if (window.PptxGenJS) return
  await new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
    s.onload = res; s.onerror = rej; document.head.appendChild(s)
  })
}

async function generateMaterialPPTX({ title, subject, chapter, slides }) {
  await ensurePptxGenLoaded()
  const pres = new window.PptxGenJS()
  pres.defineLayout({ name: 'GNSI16x9', width: 10, height: 5.63 })
  pres.layout = 'GNSI16x9'
  const NAVY = '1E3A5F', GOLD = 'C9A24B'

  const titleSlide = pres.addSlide()
  titleSlide.background = { color: NAVY }
  titleSlide.addText('Guidance Navodaya & Sainik Institute', { x:0.5, y:1.6, w:9, h:0.6, fontSize:24, bold:true, color:'FFFFFF', align:'center' })
  titleSlide.addText(title, { x:0.5, y:2.4, w:9, h:0.8, fontSize:32, bold:true, color:GOLD, align:'center' })
  titleSlide.addText(`${subject}  ·  ${chapter}`, { x:0.5, y:3.2, w:9, h:0.5, fontSize:16, color:'CBD5E1', align:'center' })

  slides.forEach((m, i) => {
    const slide = pres.addSlide()
    slide.background = { color: 'FFFFFF' }
    slide.addText(`${i+1}`, { x:0.4, y:0.3, w:1.2, h:0.5, fontSize:14, bold:true, color:GOLD })
    slide.addText(m.title, { x:0.4, y:0.9, w:9.2, h:1.2, fontSize:24, bold:true, color:NAVY, valign:'top' })
    if (m.description) {
      slide.addText(m.description, { x:0.4, y:2.1, w:9.2, h:1.5, fontSize:15, color:'374151', valign:'top' })
    }
    slide.addText(m.material_type, { x:0.4, y:4.7, w:3, h:0.5, fontSize:12, color:GOLD, bold:true })
  })

  await pres.writeFile({ fileName: `${title.replace(/\s+/g,'_')}.pptx` })
}

// ── SMART PPT: IN-APP SLIDE VIEWER (materials) ──────────────────────────────
function MaterialSlideViewer({ slides, title, subject, chapter, onClose, showToast }) {
  const [index, setIndex] = useState(0)
  const containerRef = useRef(null)
  const cast = useSlideCast({ subject, chapter, source: 'studymaterial' })

  const slide = slides[index]
  const go = (delta) => setIndex(i => Math.max(0, Math.min(slides.length - 1, i + delta)))

  useEffect(() => {
    cast.broadcastIndex(index)
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === ' ') go(1)
      if (e.key === 'ArrowLeft') go(-1)
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
        <div style={{ fontSize:'clamp(22px,2.8vw,38px)', fontWeight:700, color:'#fff', maxWidth:1000 }}>
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
      </div>

      <div style={{ display:'flex', justifyContent:'center', gap:16, padding:'18px 0 26px' }}>
        <button onClick={() => go(-1)} disabled={index===0} style={btn('#334155', index===0)}>← Previous</button>
        <span style={{ color:'#fff', alignSelf:'center', fontSize:13, opacity:.7 }}>Space/→ next · Esc close</span>
        <button onClick={() => go(1)} disabled={index===slides.length-1} style={btn(C.green, index===slides.length-1)}>Next →</button>
      </div>
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

// ── VIEW-ONLY MODAL (non-admin file access) ────────────────────────────────
// Renders the file inline via iframe with no download link exposed by the UI.
// Note: this deters casual download/print through the app but cannot fully
// block a browser's native PDF viewer controls (Ctrl+P, save) — true
// prevention needs a server-side watermark or signed streaming viewer.
function ViewOnlyModal({ mat, onClose, showToast }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div onContextMenu={e => e.preventDefault()}
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,23,42,.82)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: C.navy, color: '#fff' }}>
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>👁 View Only — {mat.title}</span>
        <span style={{ fontSize: 11, opacity: .75 }}>Download & print are disabled for this account</span>
        <CastButton url={mat.file_url} title={mat.title} showToast={showToast} small />
        <button onClick={onClose} style={{ ...btnSm('rgba(255,255,255,.15)', '#fff'), padding: '6px 14px' }}>✕ Close</button>
      </div>
      <div style={{ flex: 1, padding: 12 }}>
        <iframe
          src={`${mat.file_url}#toolbar=0&navpanes=0`}
          title={mat.title}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, background: '#fff' }}
        />
      </div>
    </div>
  )
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

// ── BULK PASTE PARSER (no AI, no network) ───────────────────────────────────
// Study-material pastes are line-oriented: each line is roughly
// "<title> <optional URL>", sometimes with a type keyword ("formula sheet",
// "practice set", etc.) embedded in the title. This mirrors the reliability
// QuestionBank's Bulk Paste already gets from its regex parser — no API call,
// so nothing here can fail with a network error.
const MATERIAL_URL_RE = /(https?:\/\/[^\s]+)/i
const MATERIAL_TYPE_KEYWORDS = [
  { type: 'formula',        kws: ['formula sheet', 'formula', 'formulae'] },
  { type: 'practice',       kws: ['practice set', 'practice', 'worksheet', 'exercise'] },
  { type: 'solved',         kws: ['solved paper', 'solved', 'solution', 'answer key'] },
  { type: 'mindmap',        kws: ['mind map', 'mindmap', 'concept map'] },
  { type: 'currentaffairs', kws: ['current affairs', 'gk update', 'daily current'] },
  { type: 'notes',          kws: ['notes', 'chapter notes', 'summary'] },
]

function detectMaterialType(title, url) {
  const lower = title.toLowerCase()
  if (url && /youtube\.com|youtu\.be/i.test(url)) return 'video'
  for (const { type, kws } of MATERIAL_TYPE_KEYWORDS) {
    if (kws.some(kw => lower.includes(kw))) return type
  }
  return 'notes'
}

function parseMaterialLines(rawText, chapters) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const chapterLower = chapters.map(c => ({ name: c, lower: c.toLowerCase() }))

  return lines.map(line => {
    const urlMatch = line.match(MATERIAL_URL_RE)
    const url = urlMatch ? urlMatch[1].replace(/[),.]+$/, '') : ''
    // Title is whatever's left after stripping the URL, cleaned of stray punctuation
    let title = url ? line.replace(url, '').trim() : line
    title = title.replace(/[-–—:|]+$/, '').replace(/^[-–—:|]+/, '').trim()
    if (!title) title = url ? 'Untitled material' : line

    // Best-effort chapter match: does the title contain a known chapter name?
    const matchedChapter = chapterLower.find(c => title.toLowerCase().includes(c.lower))

    return {
      title,
      material_type: detectMaterialType(title, url),
      chapter: matchedChapter?.name || '',
      file_url: url,
      description: '',
    }
  }).filter(item => item.title)
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

  const handleParse = () => {
    if (!rawText.trim()) { showToast('Paste something first', C.amber); return }
    setParsing(true)
    // Synchronous, local parsing — no network call, so this can't fail with
    // "Failed to fetch". Wrapped in a rAF so the "Detecting…" state actually
    // paints before the (near-instant) parse runs.
    requestAnimationFrame(() => {
      try {
        const parsed = parseMaterialLines(rawText, chapters)
        if (!parsed.length) { showToast('No items detected', C.amber); setParsing(false); return }
        setItems(parsed); setChecked(parsed.map((_, i) => i)); setStep('preview')
      } catch (err) {
        showToast('Parse error: ' + err.message, C.rose)
      }
      setParsing(false)
    })
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
                One item per line — a title, optionally followed by a Drive/YouTube link. Each line becomes one material.
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
                  {parsing ? '⏳ Detecting…' : '🔍 Detect Items'}
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
function MaterialCard({ mat, onDelete, showToast, isAdmin }) {
  const [deleting, setDeleting] = useState(false)
  const [viewingOnly, setViewingOnly] = useState(false)
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
  // BUG FIX: file_name is never set by any upload path in this component
  // (BulkPasteModal always writes file_name:'' — there is no direct file
  // upload here), so the old `!isLink` check was permanently false and the
  // View Only gate below never actually applied to anything. Classify by
  // URL shape instead: a direct PDF/doc link (Supabase storage or a raw
  // file URL) is restrictable; a Drive/Docs share page has its own
  // print/download UI we can't suppress via iframe, so treat it like a
  // link rather than falsely promising view-only protection.
  const isDirectFileUrl = !!mat.file_url && /\.(pdf|docx?|pptx?|xlsx?)(\?|#|$)/i.test(mat.file_url)
  const isDownloadableFile = !isVideo && (mat.file_name || isDirectFileUrl)

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
          {mat.file_url && !isAdmin && isDownloadableFile && (
            <button onClick={() => setViewingOnly(true)} style={btnSm('#eff6ff', C.navy)}>👁 View Only</button>
          )}
          {mat.file_url && (isAdmin || !isDownloadableFile) && (
            <a href={mat.file_url} target="_blank" rel="noreferrer" style={btnSm(isVideo ? '#fee2e2' : '#eff6ff', isVideo ? C.rose : C.navy)}>
              {isVideo ? '▶ Watch' : isLink ? '🔗 Open Link' : '📥 Download'}
            </a>
          )}
          {mat.file_url && isAdmin && !isVideo && (
            <CastButton url={mat.file_url} title={mat.title} showToast={showToast} small />
          )}
          {isAdmin && (
            <button onClick={handleDelete} disabled={deleting} style={btnSm('#fee2e2', C.rose)}>
              {deleting ? '…' : '🗑 Delete'}
            </button>
          )}
        </div>
        {viewingOnly && <ViewOnlyModal mat={mat} onClose={() => setViewingOnly(false)} showToast={showToast} />}
      </div>
    </div>
  )
}

// ── SUBJECT PANEL ─────────────────────────────────────────────────────────────
function SubjectPanel({ course, subjectName, subjectData, isCustomSubject, materials, onRefetch, showToast, customChapters, onStructureChange, onNavigate, isAdmin, isStaffAllowed }) {
  const [expandedChapter, setExpandedChapter] = useState(null)
  const [showUpload,      setShowUpload]      = useState(false)
  const [uploadChapter,   setUploadChapter]   = useState('')
  const [filterType,      setFilterType]      = useState('all')
  // Non-staff pass an empty subject so this never queries QBank data for a
  // role that isn't permitted to see it (mirrors the same gate in LessonPrep).
  const { counts: qCounts } = useQBankCountsByChapter(isStaffAllowed ? subjectName : '')

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
            {isAdmin && isCustomSubject && (
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
{isStaffAllowed && qCounts[ch] > 0 && (
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
              {isAdmin && isCustomCh && (
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
                  : <div style={{ display: 'grid', gap: 8 }}>{chMats.map(m => <MaterialCard key={m.id} mat={m} onDelete={onRefetch} showToast={showToast} isAdmin={isAdmin} />)}</div>
                }
              </div>
            )}
          </div>
        )
      })}

      {/* Add chapter inline — admin only (structural change) */}
      {isAdmin && (
        <AddChapterInline
          course={course} subject={subjectName} courseData={courseData}
          existingChapters={allChapters} onSaved={onStructureChange} showToast={showToast}
        />
      )}
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

// ── LESSON PREP ────────────────────────────────────────────────────────────
// A teacher opens this before class: pick a chapter, see materials AND
// QBank question count side by side, with a clear warning when there's
// practice content but nothing to teach from first (or vice versa).
function LessonPrepChapterRow({ course, subject, subjectData, chapter, materials, onNavigate, qCounts, qLoading, isStaffAllowed }) {
  const qCount = qCounts?.[chapter] || 0

  const chapterMats = useMemo(
    () => materials.filter(m => m.subject === subject && m.chapter === chapter),
    [materials, subject, chapter]
  )
  const hasMaterials = chapterMats.length > 0
  // Non-staff never learn whether QBank has questions for this chapter —
  // that's restricted-module information. Gap detection (which depends on
  // knowing hasQuestions) is staff-only too; teachers just see material
  // coverage on its own, no QBank-derived insight layered on top.
  const hasQuestions = isStaffAllowed && qCount > 0

  // Gap logic — the actual "teacher helper" insight:
  // - Questions exist but nothing to study from first → students drilling blind
  // - Materials exist but no practice questions → no way to test understanding
  // - Neither exists → chapter is completely unprepared
  let gapLevel = null, gapMsg = ''
  if (isStaffAllowed) {
    if (!hasMaterials && hasQuestions) {
      gapLevel = 'warn'
      gapMsg = `${qCount} practice question${qCount!==1?'s':''} but no notes/materials — students have nothing to study from first`
    } else if (hasMaterials && !hasQuestions) {
      gapLevel = 'info'
      gapMsg = `Materials ready but no practice questions yet — add some via Question Bank`
    } else if (!hasMaterials && !hasQuestions) {
      gapLevel = 'empty'
      gapMsg = `Nothing prepared for this chapter yet`
    }
  } else if (!hasMaterials) {
    gapLevel = 'empty'
    gapMsg = `No materials uploaded for this chapter yet`
  }

  const TYPE_ICON = { notes:'📄', formula:'🔣', practice:'✏️', solved:'✅', mindmap:'🗂️', video:'🎥', currentaffairs:'📰' }

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8, overflow: 'hidden', background: C.white }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, flex: 1, minWidth: 140 }}>{chapter}</span>
        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          color: hasMaterials ? '#15803d' : '#94a3b8', background: hasMaterials ? '#dcfce7' : '#f1f5f9' }}>
          📄 {chapterMats.length} material{chapterMats.length!==1?'s':''}
        </span>
        {isStaffAllowed && (
          <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
            color: hasQuestions ? '#4f46e5' : '#94a3b8', background: hasQuestions ? '#eef2ff' : '#f1f5f9' }}>
            {qLoading ? '⏳ …' : `📚 ${qCount} question${qCount!==1?'s':''}`}
          </span>
        )}
        {gapLevel && (
          <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
            color: gapLevel==='warn' ? '#92400e' : gapLevel==='empty' ? '#991b1b' : '#0369a1',
            background: gapLevel==='warn' ? '#fef3c7' : gapLevel==='empty' ? '#fee2e2' : '#e0f2fe' }}>
            {gapLevel==='warn' ? '⚠️' : gapLevel==='empty' ? '❌' : 'ℹ️'} Gap
          </span>
        )}
        {isStaffAllowed && hasQuestions && (
          <button
            onClick={() => {
              onNavigate?.('questionbank')
              EventBus.emit(GNSI_EVENTS.NAVIGATE_TO, { module: 'questionbank', params: { subject, chapter } })
            }}
            style={{ ...btnSm('#ede9fe', '#7c3aed'), whiteSpace: 'nowrap' }}>
            Open in QBank →
          </button>
        )}
      </div>
      {gapMsg && (
        <div style={{ padding: '8px 14px', fontSize: 11.5, color: gapLevel==='warn' ? '#92400e' : gapLevel==='empty' ? '#991b1b' : '#0369a1',
          background: gapLevel==='warn' ? '#fffbeb' : gapLevel==='empty' ? '#fef2f2' : '#f0f9ff',
          borderTop: `1px solid ${gapLevel==='warn' ? '#fde68a' : gapLevel==='empty' ? '#fecaca' : '#bae6fd'}` }}>
          {gapMsg}
        </div>
      )}
      {hasMaterials && (
        <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chapterMats.map(m => (
            <span key={m.id} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: '#f8fafc', border: `1px solid ${C.border}`, color: '#374151' }}>
              {TYPE_ICON[m.material_type] || '📄'} {m.title}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function LessonPrep({ course, courseData, materials, onNavigate, isStaffAllowed }) {
  const subjectList = Object.keys(courseData.subjects)
  const [subject, setSubject] = useState(subjectList[0] || '')
  const [gapFilter, setGapFilter] = useState('all') // all | warn | empty

  useEffect(() => {
    if (!subjectList.includes(subject)) setSubject(subjectList[0] || '')
  }, [course]) // eslint-disable-line react-hooks/exhaustive-deps

  const subjectData = courseData.subjects[subject]
  const chapters = subjectData?.chapters || []

  // Called once per subject — every chapter row reads from this shared map
  // instead of each row independently re-subscribing to the same query.
  // Non-staff pass an empty subject so the underlying query never runs and
  // never returns QBank data to a role that shouldn't see it.
  const { counts: qCounts, loading: qLoading } = useQBankCountsByChapter(isStaffAllowed ? subject : '')

  const visibleChapters = useMemo(() => {
    if (gapFilter === 'all' || !isStaffAllowed) return chapters
    return chapters.filter(ch => {
      const qCount = qCounts?.[ch] || 0
      const hasMaterials = materials.some(m => m.subject === subject && m.chapter === ch)
      const hasQuestions = qCount > 0
      if (gapFilter === 'warn')  return hasQuestions && !hasMaterials
      if (gapFilter === 'empty') return !hasQuestions && !hasMaterials
      return true
    })
  }, [chapters, gapFilter, qCounts, materials, subject, isStaffAllowed])

  return (
    <div>
      <div style={{ ...cardS, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>🧑‍🏫 Lesson Prep</div>
          <div style={{ fontSize: 11.5, color: C.slate, marginTop: 2 }}>
            {isStaffAllowed
              ? 'See materials and Question Bank coverage together, chapter by chapter — spot what\'s missing before class.'
              : 'See what materials are ready for each chapter before class.'}
          </div>
        </div>
        <select style={{ ...iS, width: 'auto', minWidth: 180 }} value={subject} onChange={e => setSubject(e.target.value)}>
          {subjectList.map(s => <option key={s} value={s}>{courseData.subjects[s].icon} {s}</option>)}
        </select>
        {isStaffAllowed && (
          <select style={{ ...iS, width: 'auto' }} value={gapFilter} onChange={e => setGapFilter(e.target.value)}>
            <option value="all">All chapters</option>
            <option value="warn">⚠️ Questions but no materials</option>
            <option value="empty">❌ Nothing prepared</option>
          </select>
        )}
      </div>

      {chapters.length === 0 ? (
        <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>No chapters in this subject yet.</div>
      ) : visibleChapters.length === 0 ? (
        <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>
          No chapters match this filter — nice, coverage looks solid here.
        </div>
      ) : (
        <div style={cardS}>
          {visibleChapters.map(ch => (
            <LessonPrepChapterRow
              key={ch} course={course} subject={subject} subjectData={subjectData}
              chapter={ch} materials={materials} onNavigate={onNavigate}
              qCounts={qCounts} qLoading={qLoading} isStaffAllowed={isStaffAllowed}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── SMART PPT MAKER (materials) ─────────────────────────────────────────────
function TabSmartPPTMaterials({ course, courseData, materials, showToast }) {
  const subjectList = Object.keys(courseData.subjects)
  const [subject, setSubject] = useState(subjectList[0] || '')
  const [chapter, setChapter] = useState('')
  const [title,   setTitle]   = useState('')
  const [viewing,   setViewing]   = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!subjectList.includes(subject)) setSubject(subjectList[0] || '')
  }, [course]) // eslint-disable-line react-hooks/exhaustive-deps

  const subjectData = courseData.subjects[subject]
  const chapters = subjectData?.chapters || []

  const chapterMats = useMemo(
    () => materials.filter(m => m.subject === subject && m.chapter === chapter),
    [materials, subject, chapter]
  )
  const slides = useMemo(() => buildMaterialSlides(chapterMats), [chapterMats])

  const handleExport = async () => {
    if (!slides.length) { showToast('No materials to export', C.amber); return }
    setExporting(true)
    try {
      await generateMaterialPPTX({ title: title || 'Chapter Slides', subject, chapter, slides })
      showToast('🎬 PPTX downloaded!', C.green)
    } catch (e) { showToast('Export failed: ' + e.message, C.rose) }
    setExporting(false)
  }

  return (
    <div>
      <div style={cardS}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>🎬 Smart PPT Maker</div>
        <div style={{ fontSize: 11.5, color: C.slate, marginBottom: 14 }}>
          Pick a chapter — every material becomes a slide automatically. Present live (with cast) or export a real .pptx.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lS}>Subject</label>
            <select style={iS} value={subject} onChange={e => { setSubject(e.target.value); setChapter('') }}>
              {subjectList.map(s => <option key={s} value={s}>{courseData.subjects[s].icon} {s}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Chapter *</label>
            <select style={{ ...iS, opacity: subject ? 1 : .5 }} value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject}>
              <option value="">Select</option>
              {chapters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Deck Title</label>
            <input style={iS} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fractions — Class Notes" />
          </div>
        </div>

        {subject && chapter && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: slides.length ? '#f0f9ff' : '#fef3c7',
            border: `1px solid ${slides.length ? '#bae6fd' : '#fde68a'}`, fontSize: 12,
            color: slides.length ? '#0369a1' : '#92400e', marginBottom: 14 }}>
            {slides.length
              ? `📊 ${slides.length} material${slides.length !== 1 ? 's' : ''} will become ${slides.length} slide${slides.length !== 1 ? 's' : ''} (+ title slide)`
              : '⚠️ No materials found for this chapter yet — add some via Bulk Paste first'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setViewing(true)} disabled={!slides.length} style={btn(C.navy, !slides.length)}>
            ▶ Present Now
          </button>
          <button onClick={handleExport} disabled={!slides.length || exporting} style={btn(C.green, !slides.length || exporting)}>
            {exporting ? '⏳ Building .pptx…' : '⬇ Export .pptx'}
          </button>
        </div>
      </div>

      {viewing && (
        <MaterialSlideViewer
          slides={slides} title={title || 'Chapter Slides'} subject={subject} chapter={chapter}
          onClose={() => setViewing(false)} showToast={showToast}
        />
      )}
    </div>
  )
}


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
  // Confirmed via SQL against portal_users.role — the real values are
  // "Teaching + Admin", "Teaching", "Non-Teaching". There is no separate
  // admin/computer-staff role: "Teaching + Admin" IS the admin role.
  const roleLower = (currentUser?.role || '').toLowerCase()
  const isAdmin = roleLower === 'teaching + admin'
  // Question Bank access (used to gate the "N Q" badges and cross-nav
  // buttons in this file that link over to it) matches QuestionBank.jsx's
  // own gate exactly — admin role only.
  const isStaffAllowed = isAdmin

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

      {isAdmin && showAddSubject && (
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
        {isAdmin && (
          <button onClick={() => setShowAddSubject(true)} style={btn(courseData.color)}>
            ➕ Add Subject
          </button>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setActiveView('subjects')} style={btn(activeView === 'subjects' ? courseData.color : C.slate)}>
            📚 Subjects
          </button>
          <button onClick={() => setActiveView('lessonprep')} style={btn(activeView === 'lessonprep' ? courseData.color : C.slate)}>
            🧑‍🏫 Lesson Prep
          </button>
          <button onClick={() => setActiveView('smartppt')} style={btn(activeView === 'smartppt' ? courseData.color : C.slate)}>
            🎬 Smart PPT
          </button>
          <button onClick={() => setActiveView('stats')} style={btn(activeView === 'stats' ? courseData.color : C.slate)}>
            📊 Stats
          </button>
        </div>
      </div>

      {activeView === 'stats' ? (
        <CourseStats course={activeCourse} materials={materials} mergedCourses={mergedCourses} />
      ) : activeView === 'lessonprep' ? (
        <LessonPrep course={activeCourse} courseData={courseData} materials={courseMaterials} onNavigate={onNavigate} isStaffAllowed={isStaffAllowed} />
      ) : activeView === 'smartppt' ? (
        <TabSmartPPTMaterials course={activeCourse} courseData={courseData} materials={courseMaterials} showToast={showToast} />
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
              onNavigate={onNavigate} isAdmin={isAdmin} isStaffAllowed={isStaffAllowed}
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
                onNavigate={onNavigate} isAdmin={isAdmin} isStaffAllowed={isStaffAllowed}
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