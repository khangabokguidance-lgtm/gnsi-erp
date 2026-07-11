// TeachingAids.jsx — GNSI Portal
// View-only Teaching Aids for Navodaya: Lakshya, Umeed, Combined Course.
// Admin-only upload. Strictly deterrent view-only rendering (no download, no
// print, no text-select, no right-click, blur-on-blur, watermark overlay).
//
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT — HONEST LIMITATION, READ BEFORE RELYING ON THIS FOR SECURITY:
// Nothing running in a browser can truly prevent a screenshot, a phone camera
// photo, a screen recording, or a determined user with browser dev tools.
// Everything below is a deterrent that raises friction for casual copying —
// it is NOT a DRM system and will not stop someone who wants to bypass it.
// Treat this as "makes casual copying annoying and obvious", not "unbreakable".
//
// CASTING NOTE: The "cast to TV" feature uses the W3C Presentation API, which
// is supported by Chrome/Edge talking to Chromecast or DIAL-capable Android
// TVs. It is NOT Miracast/AirPlay — those are OS-level wireless-display
// protocols the browser cannot drive directly. If a classroom TV only supports
// Miracast (Windows "Connect") or AirPlay (Apple), the teacher must mirror
// the whole laptop screen via the OS instead — this component clearly says
// so when the Presentation API isn't available.
// ─────────────────────────────────────────────────────────────────────────────
//
// Supabase tables expected (create if missing):
//   teaching_aids (
//     id uuid primary key default gen_random_uuid(),
//     batch text not null,              -- 'Lakshya' | 'Umeed' | 'Combined Course'
//     subject text,
//     subtopic text,                    -- NEW: structured subtopic tag
//     title text not null,
//     description text default '',
//     kind text not null,                -- 'image'  (pdf is rasterized to images at upload)
//     file_path text not null,           -- storage path(s), pipe-joined
//     page_count int default 1,
//     created_by text,
//     created_at timestamptz default now()
//   )
//
// Storage bucket: 'teaching-aids' — MUST be a PRIVATE bucket (not public).
// Files are served only via short-lived signed URLs generated on demand,
// never via public URL, so links can't be shared/reused long-term.
//
// EXTERNAL SCRIPTS (loaded lazily, only when needed):
//   - pdf.js (pdfjs-dist) from cdnjs — rasterizes PDF pages to images client-side
//   - tesseract.js from cdnjs — OCRs the first page/image for subtopic hints
//
// Props (matching your existing module convention):
//   currentUser — { name, role, ... }
//   perms       — { read, canEdit, canDelete, ... } from getModulePerms(...)

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'

const BATCHES = ['Lakshya', 'Umeed', 'Combined Course']

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
const chip = (active) => ({
  padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  border: active ? `1.5px solid ${C.indigo}` : `1.5px solid ${C.border}`,
  background: active ? '#ede9fe' : C.white, color: active ? C.indigo : C.slate,
})

const BUCKET = 'teaching-aids'
const SIGNED_URL_TTL = 60 * 5 // 5 minutes — short-lived on purpose

// ── LAZY EXTERNAL SCRIPT LOADERS ─────────────────────────────────────────────
const scriptCache = {}
function loadScript(src) {
  if (scriptCache[src]) return scriptCache[src]
  scriptCache[src] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { existing.addEventListener('load', resolve); if (existing.dataset.loaded) resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => { s.dataset.loaded = '1'; resolve() }
    s.onerror = reject
    document.head.appendChild(s)
  })
  return scriptCache[src]
}
async function ensurePdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  return window.pdfjsLib
}
async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js')
  return window.Tesseract
}

// ── PDF → IMAGE PAGES (client-side rasterization via pdf.js) ────────────────
// Converts a raw PDF File into an array of PNG Blobs, one per page, rendered
// at a resolution suitable for on-screen reading. Runs entirely in the
// browser — nothing is uploaded until conversion is complete.
async function rasterizePdfToImages(file, { scale = 1.8, onProgress } = {}) {
  const pdfjsLib = await ensurePdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const blobs = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.92))
    blobs.push(blob)
    onProgress?.(pageNum, pdf.numPages)
  }
  return blobs
}

// ── SMART SUBJECT / SUBTOPIC DETECTOR ────────────────────────────────────────
// Two signals, merged:
//  (1) Keyword match against the typed title/description text (instant, free)
//  (2) OCR of the first uploaded page/image via tesseract.js (slower, optional)
// Results are shown as clickable chips — nothing is auto-filled silently, the
// admin always picks/confirms, keeping them in control of the final tag.
const SUBJECT_MAP = {
  Mathematics: {
    keywords: ['fraction', 'decimal', 'algebra', 'geometry', 'triangle', 'circle', 'percentage', 'ratio', 'proportion', 'lcm', 'hcf', 'mensuration', 'area', 'perimeter', 'volume', 'number system', 'simplification', 'profit', 'loss', 'simple interest', 'time and work', 'speed', 'distance'],
    subtopics: ['Number System', 'Fractions & Decimals', 'Algebra', 'Geometry', 'Mensuration', 'Ratio & Proportion', 'Percentage', 'Profit & Loss', 'Simple Interest', 'Time, Speed & Distance', 'Time & Work'],
  },
  'Mental Ability': {
    keywords: ['analogy', 'series', 'pattern', 'mirror image', 'coding', 'decoding', 'classification', 'odd one out', 'figure', 'embedded', 'puzzle', 'reasoning', 'water image'],
    subtopics: ['Analogy', 'Classification', 'Series Completion', 'Pattern Completion', 'Coding-Decoding', 'Mirror & Water Images', 'Embedded Figures', 'Space Visualization'],
  },
  'Language / Reading': {
    keywords: ['comprehension', 'grammar', 'tense', 'noun', 'verb', 'pronoun', 'antonym', 'synonym', 'vocabulary', 'passage', 'unseen passage', 'article', 'preposition'],
    subtopics: ['Reading Comprehension', 'Grammar', 'Tenses', 'Vocabulary', 'Synonyms & Antonyms', 'Parts of Speech'],
  },
  EVS: {
    keywords: ['environment', 'plant', 'animal', 'habitat', 'ecosystem', 'water cycle', 'soil', 'forest', 'pollution', 'natural resource', 'food chain', 'adaptation', 'transport', 'shelter'],
    subtopics: ['Plants & Animals', 'Habitats & Ecosystems', 'Natural Resources', 'Water Cycle', 'Pollution & Conservation', 'Food Chain', 'Human Body', 'Transport & Communication'],
  },
  GK: {
    keywords: ['general knowledge', 'current affairs', 'capital', 'state', 'country', 'history', 'freedom fighter', 'sports', 'award', 'monument', 'river', 'mountain'],
    subtopics: ['Indian History', 'Geography', 'Current Affairs', 'Sports', 'Awards & Honours', 'Monuments & Places'],
  },
}

function detectFromText(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const hits = []
  for (const [subject, cfg] of Object.entries(SUBJECT_MAP)) {
    for (const kw of cfg.keywords) {
      if (lower.includes(kw)) {
        // Suggest the subject, plus any subtopic whose own label loosely matches
        hits.push({ subject, subtopic: cfg.subtopics.find(st => lower.includes(st.toLowerCase().split(' ')[0])) || null, source: 'text', matched: kw })
      }
    }
  }
  return hits
}

async function detectFromOcr(fileOrBlob) {
  try {
    const Tesseract = await ensureTesseract()
    const { data } = await Tesseract.recognize(fileOrBlob, 'eng')
    const text = data?.text || ''
    return detectFromText(text).map(h => ({ ...h, source: 'ocr' }))
  } catch {
    return [] // OCR is best-effort; never block the upload flow on failure
  }
}

function mergeSuggestions(hitArrays) {
  const bySubject = new Map()
  for (const hits of hitArrays) {
    for (const h of hits) {
      const key = h.subject
      const entry = bySubject.get(key) || { subject: h.subject, subtopics: new Set(), sources: new Set() }
      if (h.subtopic) entry.subtopics.add(h.subtopic)
      entry.sources.add(h.source)
      bySubject.set(key, entry)
    }
  }
  return Array.from(bySubject.values()).map(e => ({
    subject: e.subject,
    subtopics: Array.from(e.subtopics),
    fromOcr: e.sources.has('ocr'),
  }))
}

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

// ── GLOBAL DETERRENCE STYLES ─────────────────────────────────────────────────
function GlobalGuardStyles() {
  return (
    <style>{`
      .ta-guard, .ta-guard * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      .ta-guard img, .ta-guard canvas {
        pointer-events: none;
        -webkit-user-drag: none;
        user-drag: none;
      }
      @media print {
        .ta-guard, .ta-guard-print-block {
          display: none !important;
          visibility: hidden !important;
        }
        body.ta-printing-blocked::before {
          content: "Printing is disabled for Teaching Aids content.";
          display: block;
          font-size: 20px;
          text-align: center;
          padding: 100px 20px;
        }
      }
    `}</style>
  )
}

function usePrintBlock() {
  useEffect(() => {
    const beforePrint = () => { document.body.classList.add('ta-printing-blocked') }
    const afterPrint  = () => { document.body.classList.remove('ta-printing-blocked') }
    const keyBlock = (e) => {
      const isPrintCombo = (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')
      if (isPrintCombo) { e.preventDefault(); e.stopPropagation() }
    }
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    window.addEventListener('keydown', keyBlock, true)
    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
      window.removeEventListener('keydown', keyBlock, true)
    }
  }, [])
}

function useBlurGuard(active) {
  const [blurred, setBlurred] = useState(false)

  useEffect(() => {
    if (!active) return
    const blur = () => setBlurred(true)
    const unblur = () => setBlurred(false)

    window.addEventListener('blur', blur)
    window.addEventListener('focus', unblur)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) blur(); else unblur()
    })

    let lastCheck = Date.now()
    const sizeCheck = setInterval(() => {
      const threshold = 160
      const widthGap  = window.outerWidth - window.innerWidth
      const heightGap = window.outerHeight - window.innerHeight
      if (widthGap > threshold || heightGap > threshold) blur()
      lastCheck = Date.now()
    }, 800)

    return () => {
      window.removeEventListener('blur', blur)
      window.removeEventListener('focus', unblur)
      clearInterval(sizeCheck)
    }
  }, [active])

  return blurred
}

// ── CAST TO TV (Presentation API — Chromecast / DIAL Android TV) ────────────
// NOT Miracast/AirPlay: those are OS-level wireless-display mirroring
// protocols with no web API. This drives the standards-based Presentation
// API instead, which Chrome/Edge use to throw a *second, receiver-rendered*
// page (presentationUrl) onto a Chromecast or DIAL-capable Android TV.
// Because the receiver page is a separate page (not a literal mirror of this
// tab), we point it at a lightweight standalone viewer route that takes the
// same signed page URLs as query/hash state.
function useCastToTV({ aid, pageUrls, pageIdx, watermarkLabel, receiverPath = '/cast-receiver' }) {
  const [supported, setSupported] = useState(false)
  const [casting, setCasting] = useState(false)
  const requestRef = useRef(null)
  const connectionRef = useRef(null)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'PresentationRequest' in window)
  }, [])

  const buildReceiverUrl = useCallback(() => {
    const base = `${window.location.origin}${receiverPath}`
    const payload = {
      title: aid.title,
      pages: pageUrls,
      idx: pageIdx,
      wm: watermarkLabel,
      batch: aid.batch,
    }
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))))
    return `${base}#data=${encoded}`
  }, [aid, pageUrls, pageIdx, watermarkLabel, receiverPath])

  const startCast = useCallback(async () => {
    if (!supported) return
    try {
      const request = new window.PresentationRequest([buildReceiverUrl()])
      requestRef.current = request
      const connection = await request.start()
      connectionRef.current = connection
      setCasting(true)
      connection.addEventListener('close', () => setCasting(false))
      connection.addEventListener('terminate', () => setCasting(false))
    } catch (err) {
      // User cancelled the device picker, or no receiver found — not an error
      // worth alarming over.
      setCasting(false)
    }
  }, [supported, buildReceiverUrl])

  const updatePage = useCallback((newIdx) => {
    if (!casting || !connectionRef.current) return
    connectionRef.current.send(JSON.stringify({ type: 'page', idx: newIdx }))
  }, [casting])

  // Signed URLs expire after SIGNED_URL_TTL — if a class runs long, call this
  // with freshly re-signed URLs (same paths) to keep the TV display working
  // without dropping the cast session.
  const refreshUrls = useCallback((freshPageUrls) => {
    if (!casting || !connectionRef.current) return
    connectionRef.current.send(JSON.stringify({ type: 'refresh', pages: freshPageUrls }))
  }, [casting])

  const stopCast = useCallback(() => {
    connectionRef.current?.terminate?.()
    setCasting(false)
  }, [])

  return { supported, casting, startCast, stopCast, updatePage, refreshUrls }
}

// ── WATERMARK OVERLAY ────────────────────────────────────────────────────────
function WatermarkOverlay({ label }) {
  const tiles = useMemo(() => new Array(24).fill(0), [])
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', zIndex: 5,
    }}>
      {tiles.map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: 'rotate(-28deg)', opacity: 0.11, fontSize: 13, fontWeight: 700,
          color: '#0f172a', whiteSpace: 'nowrap', padding: '30px 0',
        }}>
          {label}
        </div>
      ))}
    </div>
  )
}

// ── SECURE VIEWER (images rendered directly; PDFs are pre-rasterized to images at upload) ──
function SecureViewer({ aid, pageUrls, watermarkLabel, onClose }) {
  const blurred = useBlurGuard(true)
  usePrintBlock()
  const [pageIdx, setPageIdx] = useState(0)
  const totalPages = pageUrls.length

  const cast = useCastToTV({ aid, pageUrls, pageIdx, watermarkLabel })

  useEffect(() => {
    const escHandler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', escHandler)
    return () => window.removeEventListener('keydown', escHandler)
  }, [onClose])

  useEffect(() => { cast.updatePage(pageIdx) }, [pageIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Signed URLs expire after SIGNED_URL_TTL (5 min). If still casting when
  // that's about to happen, re-sign the same storage paths and push fresh
  // URLs to the TV so a long class doesn't hit broken images mid-lesson.
  useEffect(() => {
    if (!cast.casting) return
    const timer = setInterval(async () => {
      try {
        const paths = aid.file_path.split('|')
        const fresh = await Promise.all(
          paths.map(async (p) => {
            const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p, SIGNED_URL_TTL)
            if (error) throw error
            return data.signedUrl
          })
        )
        cast.refreshUrls(fresh)
      } catch {
        // Best-effort — if re-signing fails we simply skip this cycle and
        // try again next interval rather than interrupting the class.
      }
    }, (SIGNED_URL_TTL - 30) * 1000) // refresh 30s before expiry
    return () => clearInterval(timer)
  }, [cast.casting, aid.file_path]) // eslint-disable-line react-hooks/exhaustive-deps

  const goPrev = () => setPageIdx(p => Math.max(0, p - 1))
  const goNext = () => setPageIdx(p => Math.min(totalPages - 1, p + 1))

  return (
    <div
      className="ta-guard"
      onContextMenu={e => e.preventDefault()}
      style={{
        position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(10,15,25,.95)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#0f172a', color: '#fff', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{aid.title}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>View-only · Screenshots and printing are not permitted</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <button disabled={pageIdx === 0} onClick={goPrev}
                style={btnSm(pageIdx === 0 ? '#334155' : '#1e293b')}>‹ Prev</button>
              <span>{pageIdx + 1} / {totalPages}</span>
              <button disabled={pageIdx === totalPages - 1} onClick={goNext}
                style={btnSm(pageIdx === totalPages - 1 ? '#334155' : '#1e293b')}>Next ›</button>
            </div>
          )}
          {cast.supported && (
            cast.casting ? (
              <button onClick={cast.stopCast} style={btnSm(C.rose)}>📺 Stop Casting</button>
            ) : (
              <button onClick={cast.startCast} style={btnSm(C.indigo)}>📺 Cast to TV</button>
            )
          )}
          <button onClick={onClose} style={btnSm('#dc2626')}>✕ Close</button>
        </div>
      </div>

      {!cast.supported && (
        <div style={{ background: '#1e293b', color: '#94a3b8', fontSize: 10, textAlign: 'center', padding: '4px 12px' }}>
          Cast-to-TV needs Chrome/Edge + a Chromecast or Android TV. Miracast/AirPlay displays aren't
          controllable from the browser — use your laptop's screen-mirroring (Windows "Connect" / macOS
          AirPlay) instead.
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', position: 'relative' }}>
        <div style={{ position: 'relative', maxWidth: 900, width: '100%' }}>
          <img
            src={pageUrls[pageIdx]}
            alt=""
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            style={{
              width: '100%', height: 'auto', borderRadius: 6, display: 'block',
              filter: blurred ? 'blur(22px)' : 'none', transition: 'filter .15s',
              boxShadow: '0 4px 24px rgba(0,0,0,.4)',
            }}
          />
          <WatermarkOverlay label={watermarkLabel} />
          {blurred && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(15,23,42,.35)', borderRadius: 6, zIndex: 6 }}>
              Content hidden — window lost focus
            </div>
          )}
        </div>
      </div>

      {/* Footer strip — repeats the deterrence notice */}
      <div style={{ padding: '8px 18px', background: '#0f172a', color: '#64748b', fontSize: 10, textAlign: 'center', flexShrink: 0 }}>
        This material is for {aid.batch} students only. Do not photograph, screen-record, or redistribute.
      </div>
    </div>
  )
}

// ── ADD TEACHING AID MODAL (admin only) ──────────────────────────────────────
function AddAidModal({ batch, onClose, onSaved, showToast, currentUser }) {
  const [title, setTitle]             = useState('')
  const [subject, setSubject]         = useState('')
  const [subtopic, setSubtopic]       = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles]             = useState([])
  const [saving, setSaving]           = useState(false)
  const [converting, setConverting]   = useState(null) // { page, total } | null
  const [suggestions, setSuggestions] = useState([])
  const [ocrRunning, setOcrRunning]   = useState(false)
  const fileInputRef = useRef()

  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || [])
    setFiles(list)
    setSuggestions([])
    if (list.length) runOcrSuggestions(list[0])
  }

  // Re-run text-based detection whenever title/description text changes.
  useEffect(() => {
    const textHits = detectFromText(`${title} ${description}`)
    if (textHits.length) {
      setSuggestions(prev => {
        const ocrOnly = prev.filter(s => s.fromOcr && !textHits.some(h => h.subject === s.subject))
        return mergeSuggestions([textHits]).concat(ocrOnly)
      })
    }
  }, [title, description])

  const runOcrSuggestions = async (file) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return
    setOcrRunning(true)
    try {
      // OCR only the first page for speed — enough to catch subject keywords.
      const ocrTarget = file.type === 'application/pdf'
        ? (await rasterizePdfToImages(file, { scale: 1.2 }))[0]
        : file
      const ocrHits = await detectFromOcr(ocrTarget)
      if (ocrHits.length) {
        setSuggestions(prev => {
          const merged = mergeSuggestions([detectFromText(`${title} ${description}`), ocrHits])
          return merged
        })
      }
    } finally {
      setOcrRunning(false)
    }
  }

  const applySuggestion = (s) => {
    setSubject(s.subject)
    if (s.subtopics.length === 1) setSubtopic(s.subtopics[0])
  }

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) { showToast('Enter a title', C.amber); return }
    if (!files.length) { showToast('Choose at least one file', C.amber); return }

    setSaving(true)
    try {
      // Expand any raw PDFs into rasterized page images client-side, in the
      // order the admin selected files. Non-PDF images pass through as-is.
      let allBlobs = []
      let namePrefix = 0
      for (const f of files) {
        if (f.type === 'application/pdf') {
          setConverting({ page: 0, total: 0, name: f.name })
          const pageBlobs = await rasterizePdfToImages(f, {
            onProgress: (page, total) => setConverting({ page, total, name: f.name }),
          })
          pageBlobs.forEach((blob, i) => allBlobs.push({ blob, name: `${f.name.replace(/\.pdf$/i, '')}-p${i + 1}.png` }))
        } else {
          allBlobs.push({ blob: f, name: f.name })
        }
        namePrefix++
      }
      setConverting(null)

      const uploadedPaths = []
      for (let i = 0; i < allBlobs.length; i++) {
        const { blob, name } = allBlobs[i]
        const path = `${batch}/${Date.now()}-p${i + 1}-${name}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: false })
        if (upErr) throw upErr
        uploadedPaths.push(path)
      }

      const { error: insErr } = await supabase.from('teaching_aids').insert({
        batch, subject: subject.trim() || null, subtopic: subtopic.trim() || null,
        title: trimmedTitle, description: description.trim(), kind: 'image',
        file_path: uploadedPaths.join('|'), page_count: uploadedPaths.length,
        created_by: currentUser?.name || currentUser?.role || 'admin',
      })
      if (insErr) throw insErr

      showToast(`✅ Teaching aid "${trimmedTitle}" added (${uploadedPaths.length} page${uploadedPaths.length > 1 ? 's' : ''})`, C.green)
      setSaving(false)
      onSaved()
      onClose()
    } catch (err) {
      showToast('Upload failed: ' + err.message, C.rose)
      setSaving(false)
      setConverting(null)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.white, borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 520, boxShadow: '0 -8px 40px rgba(0,0,0,.18)', padding: '24px 20px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>➕ Add Teaching Aid — {batch}</div>
          <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: C.slate, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '9px 12px', marginBottom: 16, lineHeight: 1.6 }}>
          PDFs are now supported directly — pages are converted to guarded images right in your browser
          before upload, so no separate conversion step is needed.
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={lS}>Title *</label>
            <input style={iS} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fractions — Concept Chart" autoFocus />
          </div>

          {(suggestions.length > 0 || ocrRunning) && (
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                💡 Suggested {ocrRunning && '· scanning file…'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {suggestions.map(s => (
                  <span key={s.subject} onClick={() => applySuggestion(s)} style={chip(subject === s.subject)}>
                    {s.subject}{s.fromOcr ? ' (from scan)' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={lS}>Subject</label>
            <input style={iS} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" list="subject-list" />
            <datalist id="subject-list">
              {Object.keys(SUBJECT_MAP).map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label style={lS}>Subtopic</label>
            <input style={iS} value={subtopic} onChange={e => setSubtopic(e.target.value)} placeholder="e.g. Fractions & Decimals" list="subtopic-list" />
            <datalist id="subtopic-list">
              {(SUBJECT_MAP[subject]?.subtopics || Object.values(SUBJECT_MAP).flatMap(c => c.subtopics)).map(st => <option key={st} value={st} />)}
            </datalist>
            {SUBJECT_MAP[subject] && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {SUBJECT_MAP[subject].subtopics.map(st => (
                  <span key={st} onClick={() => setSubtopic(st)} style={chip(subtopic === st)}>{st}</span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={lS}>Description (optional)</label>
            <textarea style={{ ...iS, minHeight: 60, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <label style={lS}>Files * (PDF, or images in page order)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              multiple
              onChange={handleFileChange}
              style={{ fontSize: 12 }}
            />
            {files.length > 0 && (
              <div style={{ fontSize: 11, color: C.slate, marginTop: 6 }}>{files.length} file{files.length > 1 ? 's' : ''} selected</div>
            )}
          </div>

          {converting && (
            <div style={{ fontSize: 12, color: C.indigo, background: '#ede9fe', borderRadius: 8, padding: '8px 12px' }}>
              ⏳ Converting {converting.name}{converting.total ? ` — page ${converting.page}/${converting.total}` : '…'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={handleSave} disabled={saving || !title.trim() || !files.length} style={{ ...btn(C.indigo, saving || !title.trim() || !files.length), flex: 1 }}>
              {saving ? '⏳ Uploading…' : '✅ Add Teaching Aid'}
            </button>
            <button onClick={onClose} style={btn(C.slate)}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AID CARD (list item) ─────────────────────────────────────────────────────
function AidCard({ aid, canDelete, onOpen, onDelete }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm(`Delete "${aid.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const paths = aid.file_path.split('|')
    await supabase.storage.from(BUCKET).remove(paths)
    const { error } = await supabase.from('teaching_aids').delete().eq('id', aid.id)
    if (error) { onDelete(null, error); setDeleting(false); return }
    onDelete(aid.id, null)
  }

  return (
    <div
      onClick={() => onOpen(aid)}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px',
        borderRadius: 10, border: `1px solid ${C.border}`, background: C.white,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 22, flexShrink: 0 }}>🖼️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{aid.title}</div>
        {(aid.subject || aid.subtopic) && (
          <div style={{ fontSize: 11, color: C.indigo, marginTop: 2 }}>
            {aid.subject}{aid.subject && aid.subtopic ? ' · ' : ''}{aid.subtopic}
          </div>
        )}
        {aid.description && <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>{aid.description}</div>}
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
          {aid.page_count} page{aid.page_count !== 1 ? 's' : ''}
          {aid.created_at && <span> · {new Date(aid.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <span style={btnSm(C.indigo)}>👁 View</span>
        {canDelete && (
          <button onClick={handleDelete} disabled={deleting} style={btnSm('#fee2e2', C.rose)}>
            {deleting ? '…' : '🗑'}
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function TeachingAids({ currentUser, perms }) {
  const [activeBatch, setActiveBatch] = useState(BATCHES[0])
  const [aids, setAids]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState(null)
  const [showAdd, setShowAdd]         = useState(false)
  const [viewer, setViewer]           = useState(null) // { aid, pageUrls }
  const [subjectFilter, setSubjectFilter] = useState('')
  const isMobile = useIsMobile()

  const isAdmin  = currentUser?.role === 'Admin'
  const canView  = isAdmin || perms?.read === true
  const canAdd   = isAdmin
  const canDelete = isAdmin

  const showToast = (msg, color = C.navy) => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('teaching_aids')
      .select('*')
      .eq('batch', activeBatch)
      .order('created_at', { ascending: false })
    if (error) showToast('Failed to load teaching aids: ' + error.message, C.rose)
    else setAids(data || [])
    setLoading(false)
  }, [activeBatch])

  useEffect(() => { refetch() }, [refetch])

  const visibleAids = useMemo(() => {
    if (!subjectFilter) return aids
    return aids.filter(a => a.subject === subjectFilter)
  }, [aids, subjectFilter])

  const subjectsInView = useMemo(() => {
    const set = new Set(aids.map(a => a.subject).filter(Boolean))
    return Array.from(set)
  }, [aids])

  const handleOpen = async (aid) => {
    const paths = aid.file_path.split('|')
    try {
      const signedUrls = await Promise.all(
        paths.map(async (p) => {
          const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p, SIGNED_URL_TTL)
          if (error) throw error
          return data.signedUrl
        })
      )
      setViewer({ aid, pageUrls: signedUrls })
    } catch (err) {
      showToast('Could not open material: ' + err.message, C.rose)
    }
  }

  const watermarkLabel = `${currentUser?.name || 'GNSI Student'} · ${new Date().toLocaleDateString('en-IN')}`

  if (!canView) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.slate }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🚫</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.rose }}>Access Denied</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>You don't have permission to view Teaching Aids.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? '16px 12px' : 24, fontFamily: 'system-ui,sans-serif', background: C.bg, minHeight: '100vh' }}>
      <GlobalGuardStyles />
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {showAdd && (
        <AddAidModal
          batch={activeBatch}
          currentUser={currentUser}
          onClose={() => setShowAdd(false)}
          onSaved={refetch}
          showToast={showToast}
        />
      )}

      {viewer && (
        <SecureViewer
          aid={viewer.aid}
          pageUrls={viewer.pageUrls}
          watermarkLabel={watermarkLabel}
          onClose={() => setViewer(null)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: C.slate, marginBottom: 4 }}>GNSI Portal · Navodaya</div>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: C.navy, letterSpacing: '-.02em' }}>🔒 Teaching Aids</div>
        <div style={{ fontSize: 12, color: C.slate, marginTop: 3 }}>View-only material · screenshots and printing are discouraged and technically restricted where possible</div>
      </div>

      {/* Batch tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {BATCHES.map(b => (
          <button key={b} onClick={() => { setActiveBatch(b); setSubjectFilter('') }}
            style={{
              padding: isMobile ? '8px 14px' : '10px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              border: activeBatch === b ? `2px solid ${C.indigo}` : `2px solid ${C.border}`,
              background: activeBatch === b ? '#ede9fe' : C.white,
              color: activeBatch === b ? C.indigo : C.slate, cursor: 'pointer',
            }}>
            {b}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ ...cardS, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{activeBatch}</div>
          <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>{visibleAids.length} teaching aid{visibleAids.length !== 1 ? 's' : ''}</div>
        </div>
        {canAdd && (
          <button onClick={() => setShowAdd(true)} style={btn(C.indigo)}>➕ Add Teaching Aid</button>
        )}
      </div>

      {/* Subject filter chips */}
      {subjectsInView.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <span onClick={() => setSubjectFilter('')} style={chip(subjectFilter === '')}>All Subjects</span>
          {subjectsInView.map(s => (
            <span key={s} onClick={() => setSubjectFilter(s)} style={chip(subjectFilter === s)}>{s}</span>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ ...cardS, textAlign: 'center', padding: 40, color: C.slate }}>⏳ Loading…</div>
      ) : visibleAids.length === 0 ? (
        <div style={{ ...cardS, textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          No teaching aids{subjectFilter ? ` for ${subjectFilter}` : ''} uploaded yet for {activeBatch}.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {visibleAids.map(aid => (
            <AidCard
              key={aid.id}
              aid={aid}
              canDelete={canDelete}
              onOpen={handleOpen}
              onDelete={(id, error) => {
                if (error) { showToast('Delete failed: ' + error.message, C.rose); return }
                showToast('Deleted', C.rose)
                setAids(prev => prev.filter(a => a.id !== id))
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}