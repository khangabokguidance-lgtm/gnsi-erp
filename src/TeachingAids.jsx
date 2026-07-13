// TeachingAids.jsx — GNSI Portal
// Kindle-style Teaching Aids for Navodaya: Lakshya, Umeed, Combined Course.
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
// protocols the browser cannot drive directly.
// ─────────────────────────────────────────────────────────────────────────────
//
// KINDLE-STYLE READING FEATURES (new):
//   - Bookshelf view: grid of "book covers" (first page thumbnail) per batch,
//     sorted with in-progress books first ("Continue Reading").
//   - Reader: swipe/arrow page-turn, pinch/button zoom, night mode, bookmark
//     current page. Progress (last page read) auto-saves per student per aid.
//   - Highlights: student drags a rectangle over part of a page image to
//     mark it — stored as 0–1 fractional coordinates so they survive any
//     screen size / zoom level. NOTE: this is a box over an image, not real
//     text-range highlighting — the underlying content is a rasterized page
//     image (PDF pages are converted to PNGs at upload), not selectable text.
//   - Notes: a page-level notepad — plain-text notes attached to a specific
//     page, separate from highlights.
//   - Admin monitor: admins can see any student's progress/bookmarks/
//     highlights/notes for support/monitoring purposes (see AdminAidMonitor).
//
// Supabase tables expected (create if missing — see add_share_token.sql and
// add_kindle_tables.sql):
//   teaching_aids (
//     id uuid primary key default gen_random_uuid(),
//     batch text not null,              -- 'Lakshya' | 'Umeed' | 'Combined Course'
//     subject text,
//     subtopic text,
//     title text not null,
//     description text default '',
//     kind text not null,                -- 'image'  (pdf is rasterized to images at upload)
//     file_path text not null,           -- storage path(s), pipe-joined
//     page_count int default 1,
//     created_by text,
//     created_at timestamptz default now(),
//     share_token text unique default gen_random_uuid()::text
//   )
//   teaching_aid_progress   ( aid_id, student_key, student_name, student_role,
//                             last_page, total_pages, bookmarked_pages int[],
//                             night_mode, zoom_level, updated_at )
//   teaching_aid_highlights ( aid_id, student_key, student_name, page_idx,
//                             x, y, w, h, color, created_at )
//   teaching_aid_notes      ( aid_id, student_key, student_name, page_idx,
//                             note, created_at, updated_at )
//
// student_key = portal_users.id (currentUser.id) — used for ANY logged-in
// role (student, staff, admin), since this portal has no separate students
// table wired to portal_users. Each person's reading data is scoped to their
// own student_key; admins can view everyone's via AdminAidMonitor.
//
// SHARE LINKS (login required, any role):
//   Every aid gets a permanent share_token automatically. Admins see a
//   "🔗 Copy Link" button on each card/cover, which copies:
//     https://guidancekhangabok.in/teaching-aids/view/<share_token>
//   See ViewAidByToken below and the routing notes in App.jsx
//   (pendingShareToken / active === 'view-aid').
//
// Storage bucket: 'teaching-aids' — MUST be a PRIVATE bucket (not public).
// Files are served only via short-lived signed URLs generated on demand.
//
// EXTERNAL SCRIPTS (loaded lazily, only when needed):
//   - pdf.js (pdfjs-dist) from cdnjs — rasterizes PDF pages to images client-side
//   - tesseract.js from cdnjs — OCRs the first page/image for subtopic hints
//
// Props (matching your existing module convention):
//   currentUser — { id, name, role, ... }
//   perms       — { read, canEdit, canDelete, ... } from getModulePerms(...)

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'

// Tracks group related batches for the tab UI. "All Courses" is a special
// pseudo-batch (not a real value in teaching_aids.batch) that means "don't
// filter by batch at all" — see the query logic in the main component.
const TRACKS = [
  { name: 'Sainik',     batches: ['Achiever', 'Leader', 'Champion'] },
  { name: 'Navodaya',   batches: ['Lakshya', 'Umeed'] },
  { name: 'Foundation', batches: ['Elite', 'Prime'] },
  { name: 'Combined',   batches: ['Combined Course'] },
]
const ALL_BATCHES = TRACKS.flatMap(t => t.batches)
const ALL_COURSES = '__all__' // sentinel value for activeBatch meaning "no batch filter"

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
const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#fca5a5', '#d8b4fe']

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
    return []
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
    const sizeCheck = setInterval(() => {
      const threshold = 160
      const widthGap  = window.outerWidth - window.innerWidth
      const heightGap = window.outerHeight - window.innerHeight
      if (widthGap > threshold || heightGap > threshold) blur()
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
    const payload = { title: aid.title, pages: pageUrls, idx: pageIdx, wm: watermarkLabel, batch: aid.batch }
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
      setCasting(false)
    }
  }, [supported, buildReceiverUrl])

  const updatePage = useCallback((newIdx) => {
    if (!casting || !connectionRef.current) return
    connectionRef.current.send(JSON.stringify({ type: 'page', idx: newIdx }))
  }, [casting])

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
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', zIndex: 5 }}>
      {tiles.map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-28deg)', opacity: 0.11, fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', padding: '30px 0' }}>
          {label}
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// READING PROGRESS / BOOKMARKS (per student per aid)
// ══════════════════════════════════════════════════════════════════════════
function useReadingProgress(aid, currentUser) {
  const studentKey = currentUser?.id
  const [progress, setProgress] = useState(null) // row from teaching_aid_progress | null
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    if (!aid?.id || !studentKey) { setLoaded(true); return }
    ;(async () => {
      const { data } = await supabase
        .from('teaching_aid_progress')
        .select('*')
        .eq('aid_id', aid.id)
        .eq('student_key', studentKey)
        .maybeSingle()
      if (cancelled) return
      setProgress(data || null)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [aid?.id, studentKey])

  // Debounced upsert — called on every page turn / bookmark toggle / setting
  // change, but only actually writes ~600ms after the last call so rapid
  // page-flipping doesn't hammer the DB.
  const persist = useCallback((patch) => {
    if (!aid?.id || !studentKey) return
    setProgress(prev => ({ ...(prev || {}), ...patch }))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const row = {
        aid_id: aid.id,
        student_key: studentKey,
        student_name: currentUser?.name || null,
        student_role: currentUser?.role || null,
        total_pages: aid.page_count || 1,
        updated_at: new Date().toISOString(),
        ...patch,
      }
      await supabase.from('teaching_aid_progress').upsert(row, { onConflict: 'aid_id,student_key' })
    }, 600)
  }, [aid?.id, aid?.page_count, studentKey, currentUser?.name, currentUser?.role])

  const setLastPage = (pageIdx) => persist({ last_page: pageIdx })

  const toggleBookmark = (pageIdx) => {
    const current = progress?.bookmarked_pages || []
    const next = current.includes(pageIdx) ? current.filter(p => p !== pageIdx) : [...current, pageIdx].sort((a, b) => a - b)
    persist({ bookmarked_pages: next })
    return next
  }

  const setNightMode = (val) => persist({ night_mode: val })
  const setZoomLevel = (val) => persist({ zoom_level: val })

  return {
    loaded,
    lastPage: progress?.last_page || 0,
    bookmarks: progress?.bookmarked_pages || [],
    nightMode: progress?.night_mode || false,
    zoomLevel: progress?.zoom_level || 1,
    setLastPage,
    toggleBookmark,
    setNightMode,
    setZoomLevel,
  }
}

// ══════════════════════════════════════════════════════════════════════════
// HIGHLIGHTS (draw-a-box over the page image, stored as 0–1 fractions)
// ══════════════════════════════════════════════════════════════════════════
function useHighlights(aid, currentUser, pageIdx) {
  const studentKey = currentUser?.id
  const [highlights, setHighlights] = useState([])

  const refetch = useCallback(async () => {
    if (!aid?.id || !studentKey) return
    const { data } = await supabase
      .from('teaching_aid_highlights')
      .select('*')
      .eq('aid_id', aid.id)
      .eq('student_key', studentKey)
      .eq('page_idx', pageIdx)
      .order('created_at', { ascending: true })
    setHighlights(data || [])
  }, [aid?.id, studentKey, pageIdx])

  useEffect(() => { refetch() }, [refetch])

  const addHighlight = async (rect, color) => {
    if (!aid?.id || !studentKey) return
    const row = {
      aid_id: aid.id, student_key: studentKey, student_name: currentUser?.name || null,
      page_idx: pageIdx, x: rect.x, y: rect.y, w: rect.w, h: rect.h, color,
    }
    const { data, error } = await supabase.from('teaching_aid_highlights').insert(row).select().maybeSingle()
    if (!error && data) setHighlights(prev => [...prev, data])
  }

  const removeHighlight = async (id) => {
    setHighlights(prev => prev.filter(h => h.id !== id))
    await supabase.from('teaching_aid_highlights').delete().eq('id', id)
  }

  return { highlights, addHighlight, removeHighlight }
}

// Transparent overlay for drawing + displaying highlight rectangles on one page.
function HighlightLayer({ highlights, onAdd, onRemove, activeColor, drawingEnabled }) {
  const containerRef = useRef(null)
  const [draft, setDraft] = useState(null) // { startX, startY, x, y, w, h } in px while dragging

  const toFraction = (px, py, rect) => ({
    x: px / rect.width, y: py / rect.height,
  })

  const handleDown = (e) => {
    if (!drawingEnabled) return
    const rect = containerRef.current.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    const x = point.clientX - rect.left
    const y = point.clientY - rect.top
    setDraft({ startX: x, startY: y, x, y, w: 0, h: 0, rectW: rect.width, rectH: rect.height })
  }
  const handleMove = (e) => {
    if (!draft) return
    const rect = containerRef.current.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    const cx = point.clientX - rect.left
    const cy = point.clientY - rect.top
    setDraft(prev => ({
      ...prev,
      x: Math.min(prev.startX, cx), y: Math.min(prev.startY, cy),
      w: Math.abs(cx - prev.startX), h: Math.abs(cy - prev.startY),
    }))
  }
  const handleUp = () => {
    if (!draft) return
    if (draft.w > 12 && draft.h > 8) {
      const rect = { width: draft.rectW, height: draft.rectH }
      const topLeft = toFraction(draft.x, draft.y, rect)
      const size = toFraction(draft.w, draft.h, rect)
      onAdd({ x: topLeft.x, y: topLeft.y, w: size.x, h: size.y }, activeColor)
    }
    setDraft(null)
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
      onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp}
      style={{ position: 'absolute', inset: 0, zIndex: 7, cursor: drawingEnabled ? 'crosshair' : 'default' }}
    >
      {highlights.map(h => (
        <div
          key={h.id}
          onClick={(e) => { e.stopPropagation(); if (drawingEnabled) onRemove(h.id) }}
          title={drawingEnabled ? 'Tap to remove highlight' : ''}
          style={{
            position: 'absolute',
            left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%`,
            background: h.color, opacity: 0.38, borderRadius: 3, mixBlendMode: 'multiply',
            cursor: drawingEnabled ? 'pointer' : 'default', pointerEvents: 'auto',
          }}
        />
      ))}
      {draft && (
        <div style={{ position: 'absolute', left: draft.x, top: draft.y, width: draft.w, height: draft.h, border: `2px dashed ${activeColor}`, background: `${activeColor}33`, borderRadius: 3, pointerEvents: 'none' }} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE NOTES (plain-text notepad per page)
// ══════════════════════════════════════════════════════════════════════════
function usePageNotes(aid, currentUser, pageIdx) {
  const studentKey = currentUser?.id
  const [notes, setNotes] = useState([])

  const refetch = useCallback(async () => {
    if (!aid?.id || !studentKey) return
    const { data } = await supabase
      .from('teaching_aid_notes')
      .select('*')
      .eq('aid_id', aid.id)
      .eq('student_key', studentKey)
      .eq('page_idx', pageIdx)
      .order('created_at', { ascending: true })
    setNotes(data || [])
  }, [aid?.id, studentKey, pageIdx])

  useEffect(() => { refetch() }, [refetch])

  const addNote = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || !aid?.id || !studentKey) return
    const row = { aid_id: aid.id, student_key: studentKey, student_name: currentUser?.name || null, page_idx: pageIdx, note: trimmed }
    const { data, error } = await supabase.from('teaching_aid_notes').insert(row).select().maybeSingle()
    if (!error && data) setNotes(prev => [...prev, data])
  }

  const deleteNote = async (id) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    await supabase.from('teaching_aid_notes').delete().eq('id', id)
  }

  return { notes, addNote, deleteNote }
}

function PageNotesPanel({ notes, onAdd, onDelete, onClose }) {
  const [draft, setDraft] = useState('')
  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 300, maxWidth: '85vw', background: '#fff', zIndex: 20500, boxShadow: '-6px 0 24px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>📝 Notes for this page</div>
        <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 20 }}>No notes on this page yet.</div>}
        {notes.map(n => (
          <div key={n.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', position: 'relative' }}>
            <div style={{ fontSize: 12, color: '#1e293b', whiteSpace: 'pre-wrap', paddingRight: 18 }}>{n.note}</div>
            <div style={{ fontSize: 9, color: '#a16207', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            <button onClick={() => onDelete(n.id)} style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
        <textarea
          value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Write a note about this page…"
          style={{ ...iS, minHeight: 50, resize: 'vertical', flex: 1 }}
        />
        <button
          onClick={() => { onAdd(draft); setDraft('') }}
          disabled={!draft.trim()}
          style={btn(C.indigo, !draft.trim())}
        >Add</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// KINDLE READER (replaces the old plain SecureViewer)
// Images rendered directly; PDFs are pre-rasterized to images at upload.
// ══════════════════════════════════════════════════════════════════════════
function KindleReader({ aid, pageUrls, watermarkLabel, currentUser, onClose }) {
  const blurred = useBlurGuard(true)
  usePrintBlock()
  const rp = useReadingProgress(aid, currentUser)
  const [pageIdx, setPageIdxRaw] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const totalPages = pageUrls.length
  const touchStartX = useRef(null)

  const { highlights, addHighlight, removeHighlight } = useHighlights(aid, currentUser, pageIdx)
  const { notes, addNote, deleteNote } = usePageNotes(aid, currentUser, pageIdx)

  // Resume from last-read page once progress has loaded, but only once —
  // afterwards the student is free to navigate anywhere without being
  // yanked back to lastPage on every render.
  const resumedRef = useRef(false)
  useEffect(() => {
    if (rp.loaded && !resumedRef.current) {
      resumedRef.current = true
      if (rp.lastPage > 0 && rp.lastPage < totalPages) setPageIdxRaw(rp.lastPage)
    }
  }, [rp.loaded, rp.lastPage, totalPages])

  const setPageIdx = useCallback((updater) => {
    setPageIdxRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const clamped = Math.max(0, Math.min(totalPages - 1, next))
      rp.setLastPage(clamped)
      return clamped
    })
  }, [totalPages, rp.setLastPage])

  const cast = useCastToTV({ aid, pageUrls, pageIdx, watermarkLabel })

  useEffect(() => {
    const escHandler = (e) => {
      if (e.key === 'Escape') { showNotes ? setShowNotes(false) : onClose() }
      if (e.key === 'ArrowLeft')  setPageIdx(p => p - 1)
      if (e.key === 'ArrowRight') setPageIdx(p => p + 1)
    }
    window.addEventListener('keydown', escHandler)
    return () => window.removeEventListener('keydown', escHandler)
  }, [onClose, showNotes, setPageIdx])

  useEffect(() => { cast.updatePage(pageIdx) }, [pageIdx]) // eslint-disable-line react-hooks/exhaustive-deps

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
      } catch { /* best-effort */ }
    }, (SIGNED_URL_TTL - 30) * 1000)
    return () => clearInterval(timer)
  }, [cast.casting, aid.file_path]) // eslint-disable-line react-hooks/exhaustive-deps

  const goPrev = () => setPageIdx(p => p - 1)
  const goNext = () => setPageIdx(p => p + 1)

  // Swipe gesture for page turn (mobile-first, Kindle-like)
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 60) { dx > 0 ? goPrev() : goNext() }
    touchStartX.current = null
  }

  const isBookmarked = rp.bookmarks.includes(pageIdx)
  const zoomPct = Math.round(rp.zoomLevel * 100)

  const bg = rp.nightMode ? '#0a0e14' : 'rgba(10,15,25,.95)'
  const headerBg = rp.nightMode ? '#000' : '#0f172a'

  return (
    <div
      className="ta-guard"
      onContextMenu={e => e.preventDefault()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'fixed', inset: 0, zIndex: 20000, background: bg, display: 'flex', flexDirection: 'column' }}
    >
      {showNotes && (
        <PageNotesPanel
          notes={notes}
          onAdd={addNote}
          onDelete={deleteNote}
          onClose={() => setShowNotes(false)}
        />
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: headerBg, color: '#fff', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{aid.title}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>View-only · Page {pageIdx + 1} of {totalPages}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => rp.toggleBookmark(pageIdx)} title="Bookmark this page" style={btnSm(isBookmarked ? C.amber : '#1e293b')}>
            {isBookmarked ? '🔖 Bookmarked' : '🔖 Bookmark'}
          </button>
          <button onClick={() => setShowBookmarks(v => !v)} style={btnSm('#1e293b')}>📑 {rp.bookmarks.length}</button>
          <button onClick={() => setDrawMode(v => !v)} title="Draw a highlight box" style={btnSm(drawMode ? C.indigo : '#1e293b')}>
            {drawMode ? '✏️ Highlighting' : '✏️ Highlight'}
          </button>
          {drawMode && (
            <div style={{ display: 'flex', gap: 3 }}>
              {HIGHLIGHT_COLORS.map(c => (
                <span key={c} onClick={() => setActiveColor(c)}
                  style={{ width: 16, height: 16, borderRadius: 4, background: c, cursor: 'pointer', border: activeColor === c ? '2px solid #fff' : '2px solid transparent' }} />
              ))}
            </div>
          )}
          <button onClick={() => setShowNotes(true)} style={btnSm('#1e293b')}>📝 {notes.length > 0 ? notes.length : ''}</button>
          <button onClick={() => rp.setZoomLevel(Math.max(0.6, rp.zoomLevel - 0.2))} style={btnSm('#1e293b')}>A−</button>
          <span style={{ fontSize: 11, minWidth: 32, textAlign: 'center' }}>{zoomPct}%</span>
          <button onClick={() => rp.setZoomLevel(Math.min(2.2, rp.zoomLevel + 0.2))} style={btnSm('#1e293b')}>A+</button>
          <button onClick={() => rp.setNightMode(!rp.nightMode)} title="Night mode" style={btnSm(rp.nightMode ? '#facc15' : '#1e293b', rp.nightMode ? '#000' : '#fff')}>
            {rp.nightMode ? '☀️' : '🌙'}
          </button>
          {cast.supported && (
            cast.casting
              ? <button onClick={cast.stopCast} style={btnSm(C.rose)}>📺 Stop</button>
              : <button onClick={cast.startCast} style={btnSm(C.indigo)}>📺 Cast</button>
          )}
          <button onClick={onClose} style={btnSm('#dc2626')}>✕ Close</button>
        </div>
      </div>

      {/* Bookmarks strip */}
      {showBookmarks && (
        <div style={{ background: headerBg, borderTop: '1px solid #334155', padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {rp.bookmarks.length === 0 && <span style={{ fontSize: 11, color: '#64748b' }}>No bookmarks yet — tap 🔖 on any page.</span>}
          {rp.bookmarks.map(p => (
            <button key={p} onClick={() => setPageIdx(p)} style={btnSm(p === pageIdx ? C.indigo : '#1e293b')}>Page {p + 1}</button>
          ))}
        </div>
      )}

      {!cast.supported && (
        <div style={{ background: '#1e293b', color: '#94a3b8', fontSize: 10, textAlign: 'center', padding: '4px 12px' }}>
          Cast-to-TV needs Chrome/Edge + a Chromecast or Android TV. For Miracast/AirPlay TVs, use your laptop's screen-mirroring instead.
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', position: 'relative' }}>
        <div style={{ position: 'relative', maxWidth: 900 * rp.zoomLevel, width: '100%' }}>
          <img
            src={pageUrls[pageIdx]}
            alt=""
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            style={{
              width: '100%', height: 'auto', borderRadius: 6, display: 'block',
              filter: `${blurred ? 'blur(22px) ' : ''}${rp.nightMode ? 'invert(1) hue-rotate(180deg) brightness(.92)' : 'none'}`,
              transition: 'filter .15s', boxShadow: '0 4px 24px rgba(0,0,0,.4)',
            }}
          />
          <HighlightLayer
            highlights={highlights}
            onAdd={(rect, color) => addHighlight(rect, color)}
            onRemove={removeHighlight}
            activeColor={activeColor}
            drawingEnabled={drawMode}
          />
          <WatermarkOverlay label={watermarkLabel} />
          {blurred && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(15,23,42,.35)', borderRadius: 6, zIndex: 6 }}>
              Content hidden — window lost focus
            </div>
          )}
        </div>

        {/* Prev/Next tap zones (desktop) */}
        <button onClick={goPrev} disabled={pageIdx === 0} aria-label="Previous page"
          style={{ position: 'fixed', left: 4, top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,.5)', color: '#fff', border: 'none', borderRadius: 8, width: 34, height: 60, fontSize: 18, cursor: pageIdx === 0 ? 'not-allowed' : 'pointer', opacity: pageIdx === 0 ? 0.3 : 1 }}>‹</button>
        <button onClick={goNext} disabled={pageIdx === totalPages - 1} aria-label="Next page"
          style={{ position: 'fixed', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,.5)', color: '#fff', border: 'none', borderRadius: 8, width: 34, height: 60, fontSize: 18, cursor: pageIdx === totalPages - 1 ? 'not-allowed' : 'pointer', opacity: pageIdx === totalPages - 1 ? 0.3 : 1 }}>›</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#1e293b', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${((pageIdx + 1) / totalPages) * 100}%`, background: C.indigo, transition: 'width .2s' }} />
      </div>

      {/* Footer strip */}
      <div style={{ padding: '6px 18px', background: headerBg, color: '#64748b', fontSize: 10, textAlign: 'center', flexShrink: 0 }}>
        This material is for {aid.batch} students only. Do not photograph, screen-record, or redistribute. Swipe or use ‹ › to turn pages.
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// ADD TEACHING AID MODAL (admin only) — unchanged from before
// ══════════════════════════════════════════════════════════════════════════
function AddAidModal({ batch, allBatches, onBatchChange, onClose, onSaved, showToast, currentUser }) {
  const [title, setTitle]             = useState('')
  const [subject, setSubject]         = useState('')
  const [subtopic, setSubtopic]       = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles]             = useState([])
  const [saving, setSaving]           = useState(false)
  const [converting, setConverting]   = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [ocrRunning, setOcrRunning]   = useState(false)
  const fileInputRef = useRef()

  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || [])
    setFiles(list)
    setSuggestions([])
    if (list.length) runOcrSuggestions(list[0])
  }

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
      const ocrTarget = file.type === 'application/pdf'
        ? (await rasterizePdfToImages(file, { scale: 1.2 }))[0]
        : file
      const ocrHits = await detectFromOcr(ocrTarget)
      if (ocrHits.length) {
        setSuggestions(prev => mergeSuggestions([detectFromText(`${title} ${description}`), ocrHits]))
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
    let uploadedPaths = []
    try {
      let allBlobs = []
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
      }
      setConverting(null)

      for (let i = 0; i < allBlobs.length; i++) {
        const { blob, name } = allBlobs[i]
        const path = `${batch}/${Date.now()}-p${i + 1}-${name}`
        setConverting({ page: i + 1, total: allBlobs.length, name: `Uploading ${name}` })

        // Retry each upload up to 3 times with backoff — protects against
        // transient network drops that would otherwise leave a gap.
        let lastErr = null
        let ok = false
        for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: false })
          if (!upErr) { ok = true; break }
          lastErr = upErr
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 800))
        }
        if (!ok) throw new Error(`Failed to upload page ${i + 1} (${name}): ${lastErr?.message || 'unknown error'}`)
        uploadedPaths.push(path)
      }

      // Verify every uploaded path actually exists in storage before writing
      // the DB row — prevents a row referencing objects that silently failed
      // to persist server-side despite a client-side "success" response.
      setConverting({ page: allBlobs.length, total: allBlobs.length, name: 'Verifying upload…' })
      const missing = []
      for (const path of uploadedPaths) {
        const folder = path.substring(0, path.lastIndexOf('/'))
        const filename = path.substring(path.lastIndexOf('/') + 1)
        const { data: listData, error: listErr } = await supabase.storage
          .from(BUCKET)
          .list(folder, { search: filename })
        const found = !listErr && listData?.some(f => f.name === filename)
        if (!found) missing.push(path)
      }
      if (missing.length) {
        throw new Error(`${missing.length} of ${uploadedPaths.length} pages failed to save to storage. Please try uploading again.`)
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
      // Best-effort cleanup: remove any pages that did upload before the
      // failure, so a retry doesn't leave orphaned objects in storage.
      if (uploadedPaths.length) {
        supabase.storage.from(BUCKET).remove(uploadedPaths).catch(() => {})
      }
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.white, borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 520, boxShadow: '0 -8px 40px rgba(0,0,0,.18)', padding: '24px 20px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>➕ Add Teaching Aid{!allBatches ? ` — ${batch}` : ''}</div>
          <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕</button>
        </div>

        {allBatches && (
          <div style={{ marginBottom: 14 }}>
            <label style={lS}>Batch *</label>
            <select style={iS} value={batch} onChange={e => onBatchChange(e.target.value)}>
              {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        <div style={{ fontSize: 11, color: C.slate, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '9px 12px', marginBottom: 16, lineHeight: 1.6 }}>
          PDFs are supported directly — pages are converted to guarded images right in your browser before upload.
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
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,application/pdf" multiple onChange={handleFileChange} style={{ fontSize: 12 }} />
            {files.length > 0 && <div style={{ fontSize: 11, color: C.slate, marginTop: 6 }}>{files.length} file{files.length > 1 ? 's' : ''} selected</div>}
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

// ══════════════════════════════════════════════════════════════════════════
// BOOKSHELF — grid of "book covers" (first-page thumbnail) with progress
// ══════════════════════════════════════════════════════════════════════════
// One row per aid, holding just enough to render the cover + progress bar
// without opening the full signed-URL viewer flow. We sign only the FIRST
// page's URL for the thumbnail (cheap), and fetch each student's own
// progress row for the "% read" bar and "Continue Reading" sort.
function useBookshelfData(aids, currentUser) {
  const studentKey = currentUser?.id
  const [covers, setCovers] = useState({})   // aid.id -> signed thumbnail URL
  const [progressMap, setProgressMap] = useState({}) // aid.id -> progress row

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(aids.map(async (aid) => {
        const firstPath = aid.file_path.split('|')[0]
        try {
          const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(firstPath, SIGNED_URL_TTL)
          if (error) throw error
          return [aid.id, data.signedUrl]
        } catch {
          return [aid.id, null]
        }
      }))
      if (!cancelled) setCovers(Object.fromEntries(entries))
    })()
    return () => { cancelled = true }
  }, [aids])

  useEffect(() => {
    if (!studentKey || aids.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('teaching_aid_progress')
        .select('*')
        .in('aid_id', aids.map(a => a.id))
        .eq('student_key', studentKey)
      if (cancelled) return
      const map = {}
      for (const row of (data || [])) map[row.aid_id] = row
      setProgressMap(map)
    })()
    return () => { cancelled = true }
  }, [aids, studentKey])

  return { covers, progressMap }
}

function BookCover({ aid, coverUrl, progress, canDelete, canShare, onOpen, onDelete, showToast }) {
  const [deleting, setDeleting] = useState(false)
  const pct = progress ? Math.round(((progress.last_page + 1) / (progress.total_pages || aid.page_count || 1)) * 100) : 0
  const hasStarted = progress && progress.last_page > 0

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

  const handleCopyLink = async (e) => {
    e.stopPropagation()
    if (!aid.share_token) { showToast?.('This aid has no share link yet.', C.amber); return }
    const url = `${window.location.origin}/teaching-aids/view/${aid.share_token}`
    try {
      await navigator.clipboard.writeText(url)
      showToast?.('🔗 Link copied — works for any logged-in portal user', C.green)
    } catch {
      showToast?.(url, C.navy)
    }
  }

  return (
    <div onClick={() => onOpen(aid)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        position: 'relative', aspectRatio: '3 / 4', borderRadius: 10, overflow: 'hidden',
        background: '#e2e8f0', boxShadow: '0 3px 10px rgba(0,0,0,.15)', border: `1px solid ${C.border}`,
      }}>
        {coverUrl ? (
          <img src={coverUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🖼️</div>
        )}
        {hasStarted && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: 'rgba(0,0,0,.25)' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: C.indigo }} />
          </div>
        )}
        {progress?.bookmarked_pages?.length > 0 && (
          <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 14 }}>🔖</div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(0,0,0,0) 60%, rgba(0,0,0,.55))' }} />
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1.25, textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>
          {aid.title}
        </div>
      </div>
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <div style={{ fontSize: 10, color: C.slate, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hasStarted ? `${pct}% read` : `${aid.page_count} page${aid.page_count !== 1 ? 's' : ''}`}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {canShare && <button onClick={handleCopyLink} title="Copy view-only link" style={{ ...btnSm('#eef2ff', C.indigo), padding: '2px 6px' }}>🔗</button>}
          {canDelete && <button onClick={handleDelete} disabled={deleting} style={{ ...btnSm('#fee2e2', C.rose), padding: '2px 6px' }}>{deleting ? '…' : '🗑'}</button>}
        </div>
      </div>
    </div>
  )
}

function Bookshelf({ aids, currentUser, canDelete, canShare, onOpen, onDelete, showToast, subjectFilter }) {
  const { covers, progressMap } = useBookshelfData(aids, currentUser)

  const sorted = useMemo(() => {
    return [...aids].sort((a, b) => {
      const pa = progressMap[a.id]?.last_page || 0
      const pb = progressMap[b.id]?.last_page || 0
      const aStarted = pa > 0, bStarted = pb > 0
      if (aStarted !== bStarted) return aStarted ? -1 : 1 // in-progress first
      if (aStarted && bStarted) return (progressMap[b.id]?.updated_at || '').localeCompare(progressMap[a.id]?.updated_at || '')
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [aids, progressMap])

  if (sorted.length === 0) {
    return (
      <div style={{ ...cardS, textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        No teaching aids{subjectFilter ? ` for ${subjectFilter}` : ''} uploaded yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 16 }}>
      {sorted.map(aid => (
        <BookCover
          key={aid.id}
          aid={aid}
          coverUrl={covers[aid.id]}
          progress={progressMap[aid.id]}
          canDelete={canDelete}
          canShare={canShare}
          onOpen={onOpen}
          showToast={showToast}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// ADMIN MONITOR — admin can inspect any student's progress/bookmarks/
// highlights/notes for a given aid, for support/monitoring purposes.
// Read-only: admin cannot edit a student's notes/highlights from here.
// ══════════════════════════════════════════════════════════════════════════
function AdminAidMonitor({ aid, onClose }) {
  const [rows, setRows] = useState([])       // progress rows for this aid, one per student
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // student_key currently drilled into
  const [detail, setDetail] = useState({ highlights: [], notes: [] })
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('teaching_aid_progress')
        .select('*')
        .eq('aid_id', aid.id)
        .order('updated_at', { ascending: false })
      if (!cancelled) { setRows(data || []); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [aid.id])

  const openStudent = async (studentKey) => {
    setSelected(studentKey)
    setDetailLoading(true)
    const [{ data: hl }, { data: nt }] = await Promise.all([
      supabase.from('teaching_aid_highlights').select('*').eq('aid_id', aid.id).eq('student_key', studentKey).order('page_idx'),
      supabase.from('teaching_aid_notes').select('*').eq('aid_id', aid.id).eq('student_key', studentKey).order('page_idx'),
    ])
    setDetail({ highlights: hl || [], notes: nt || [] })
    setDetailLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 21000, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>📊 Reading Activity — {aid.title}</div>
            <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>Admin view · student-private data, monitoring only</div>
          </div>
          <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', color: C.slate, padding: 20 }}>⏳ Loading…</div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 12 }}>No one has opened this aid yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {rows.map(r => {
                  const pct = Math.round(((r.last_page + 1) / (r.total_pages || aid.page_count || 1)) * 100)
                  return (
                    <div key={r.student_key} onClick={() => openStudent(r.student_key)}
                      style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${selected === r.student_key ? C.indigo : C.border}`, cursor: 'pointer', background: selected === r.student_key ? '#ede9fe' : '#fff' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{r.student_name || 'Unknown user'} <span style={{ fontWeight: 400, color: C.slate }}>· {r.student_role || '—'}</span></div>
                      <div style={{ fontSize: 11, color: C.slate, marginTop: 3 }}>{pct}% read · page {r.last_page + 1} · {r.bookmarked_pages?.length || 0} bookmark{r.bookmarked_pages?.length !== 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Last active {new Date(r.updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {selected && (
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 8 }}>Highlights & Notes</div>
              {detailLoading ? (
                <div style={{ color: C.slate, fontSize: 12 }}>⏳ Loading…</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 4 }}>✏️ Highlights ({detail.highlights.length})</div>
                  {detail.highlights.length === 0 && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>None</div>}
                  {detail.highlights.map(h => (
                    <div key={h.id} style={{ fontSize: 11, color: '#1e293b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: h.color, display: 'inline-block' }} /> Page {h.page_idx + 1}
                    </div>
                  ))}
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, marginTop: 12, marginBottom: 4 }}>📝 Notes ({detail.notes.length})</div>
                  {detail.notes.length === 0 && <div style={{ fontSize: 11, color: '#94a3b8' }}>None</div>}
                  {detail.notes.map(n => (
                    <div key={n.id} style={{ fontSize: 11, color: '#1e293b', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 8px', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>Page {n.page_idx + 1}</div>
                      {n.note}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED-LINK VIEWER (login required, any role)
// Reached via /teaching-aids/view/<share_token>. App.jsx already guarantees
// currentUser exists before this renders. Hands off to the same KindleReader
// everything else uses — same watermark, blur guard, print block, progress,
// bookmarks, highlights, notes. No separate viewer to keep in sync.
// ══════════════════════════════════════════════════════════════════════════════
export function ViewAidByToken({ token, currentUser, onClose }) {
  const [state, setState] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [viewerData, setViewerData] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: aid, error } = await supabase
          .from('teaching_aids')
          .select('*')
          .eq('share_token', token)
          .maybeSingle()
        if (cancelled) return
        if (error) throw error
        if (!aid) { setState('notfound'); return }

        const paths = aid.file_path.split('|')
        const signedUrls = await Promise.all(
          paths.map(async (p) => {
            const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(p, SIGNED_URL_TTL)
            if (signErr) throw signErr
            return data.signedUrl
          })
        )
        if (cancelled) return
        setViewerData({ aid, pageUrls: signedUrls })
        setState('ready')
      } catch (err) {
        if (cancelled) return
        setErrorMsg(err?.message || 'Something went wrong opening this link.')
        setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const watermarkLabel = `${currentUser?.name || 'GNSI Staff'} · ${new Date().toLocaleDateString('en-IN')}`

  if (state === 'loading') {
    return <div style={{ padding: 60, textAlign: 'center', color: C.slate, fontFamily: 'system-ui,sans-serif' }}>⏳ Opening shared teaching aid…</div>
  }
  if (state === 'notfound') {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔗</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.rose }}>Link not found</div>
        <div style={{ fontSize: 12, color: C.slate, marginTop: 6 }}>This teaching aid may have been deleted, or the link is incorrect.</div>
        <button onClick={onClose} style={{ ...btn(C.indigo), marginTop: 18 }}>Go to Dashboard</button>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.rose }}>Could not open this link</div>
        <div style={{ fontSize: 12, color: C.slate, marginTop: 6 }}>{errorMsg}</div>
        <button onClick={onClose} style={{ ...btn(C.indigo), marginTop: 18 }}>Go to Dashboard</button>
      </div>
    )
  }

  return (
    <>
      <GlobalGuardStyles />
      <KindleReader
        aid={viewerData.aid}
        pageUrls={viewerData.pageUrls}
        watermarkLabel={watermarkLabel}
        currentUser={currentUser}
        onClose={onClose}
      />
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function TeachingAids({ currentUser, perms }) {
  const [activeBatch, setActiveBatch] = useState(ALL_COURSES)
  const [uploadBatch, setUploadBatch] = useState(ALL_BATCHES[0]) // which real batch a new aid gets uploaded to
  const [aids, setAids]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState(null)
  const [showAdd, setShowAdd]         = useState(false)
  const [viewer, setViewer]           = useState(null) // { aid, pageUrls }
  const [monitorAid, setMonitorAid]   = useState(null) // aid currently under admin monitor
  const [subjectFilter, setSubjectFilter] = useState('')
  const isMobile = useIsMobile()

  const isAdmin  = currentUser?.role === 'Admin'
  const canView  = isAdmin || perms?.read === true
  const canAdd   = isAdmin
  const canDelete = isAdmin

  const showToast = (msg, color = C.navy) => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }

  const refetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('teaching_aids').select('*').order('created_at', { ascending: false })
    // All Courses shows every batch together; otherwise filter to the
    // selected batch as before.
    if (activeBatch !== ALL_COURSES) query = query.eq('batch', activeBatch)
    const { data, error } = await query
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
          batch={activeBatch === ALL_COURSES ? uploadBatch : activeBatch}
          allBatches={ALL_BATCHES}
          onBatchChange={setUploadBatch}
          currentUser={currentUser}
          onClose={() => setShowAdd(false)}
          onSaved={refetch}
          showToast={showToast}
        />
      )}

      {viewer && (
        <KindleReader
          aid={viewer.aid}
          pageUrls={viewer.pageUrls}
          watermarkLabel={watermarkLabel}
          currentUser={currentUser}
          onClose={() => setViewer(null)}
        />
      )}

      {monitorAid && (
        <AdminAidMonitor aid={monitorAid} onClose={() => setMonitorAid(null)} />
      )}

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: C.slate, marginBottom: 4 }}>GNSI Portal · Sainik · Navodaya · Foundation · Combined</div>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: C.navy, letterSpacing: '-.02em' }}>🔒 Teaching Aids</div>
        <div style={{ fontSize: 12, color: C.slate, marginTop: 3 }}>View-only library · bookmarks, highlights, and notes save automatically</div>
      </div>

      {/* All Courses + track-grouped batch tabs */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={() => { setActiveBatch(ALL_COURSES); setSubjectFilter('') }}
            style={{
              padding: isMobile ? '8px 14px' : '10px 20px', borderRadius: 10, fontSize: 12, fontWeight: 800,
              border: activeBatch === ALL_COURSES ? `2px solid ${C.indigo}` : `2px solid ${C.border}`,
              background: activeBatch === ALL_COURSES ? '#ede9fe' : C.white,
              color: activeBatch === ALL_COURSES ? C.indigo : C.slate, cursor: 'pointer',
            }}>
            📚 All Courses
          </button>
        </div>
        {TRACKS.map(track => (
          <div key={track.name} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{track.name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {track.batches.map(b => (
                <button key={b} onClick={() => { setActiveBatch(b); setUploadBatch(b); setSubjectFilter('') }}
                  style={{
                    padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: activeBatch === b ? `2px solid ${C.indigo}` : `2px solid ${C.border}`,
                    background: activeBatch === b ? '#ede9fe' : C.white,
                    color: activeBatch === b ? C.indigo : C.slate, cursor: 'pointer',
                  }}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ ...cardS, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{activeBatch === ALL_COURSES ? 'All Courses' : activeBatch}</div>
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

      {/* Bookshelf */}
      {loading ? (
        <div style={{ ...cardS, textAlign: 'center', padding: 40, color: C.slate }}>⏳ Loading…</div>
      ) : (
        <Bookshelf
          aids={visibleAids}
          currentUser={currentUser}
          canDelete={canDelete}
          canShare={isAdmin}
          onOpen={handleOpen}
          subjectFilter={subjectFilter}
          showToast={showToast}
          onDelete={(id, error) => {
            if (error) { showToast('Delete failed: ' + error.message, C.rose); return }
            showToast('Deleted', C.rose)
            setAids(prev => prev.filter(a => a.id !== id))
          }}
        />
      )}

      {/* Admin: per-aid "view activity" links, shown under the bookshelf */}
      {isAdmin && visibleAids.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Admin · Reading Activity</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {visibleAids.map(aid => (
              <button key={aid.id} onClick={() => setMonitorAid(aid)} style={btnSm('#f1f5f9', C.navy)}>
                📊 {aid.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}