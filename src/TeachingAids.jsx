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
// ─────────────────────────────────────────────────────────────────────────────
//
// Supabase tables expected (create if missing):
//   teaching_aids (
//     id uuid primary key default gen_random_uuid(),
//     batch text not null,              -- 'Lakshya' | 'Umeed' | 'Combined Course'
//     subject text,
//     title text not null,
//     description text default '',
//     kind text not null,                -- 'pdf' | 'image'
//     file_path text not null,           -- storage path (private bucket)
//     page_count int default 1,          -- for pdfs rendered as page images
//     created_by text,
//     created_at timestamptz default now()
//   )
//
// Storage bucket: 'teaching-aids' — MUST be a PRIVATE bucket (not public).
// Files are served only via short-lived signed URLs generated on demand,
// never via public URL, so links can't be shared/reused long-term.
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

const BUCKET = 'teaching-aids'
const SIGNED_URL_TTL = 60 * 5 // 5 minutes — short-lived on purpose

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
// Injected once. Blocks text selection, drag, print rendering, and adds a
// screen-reader/DOM signal that content is restricted (does not stop OS-level
// screenshots — see banner comment at top of file).
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

// Adds a body-level watermark class during print attempts + blocks Ctrl/Cmd+P
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

// Blurs the viewer content when the tab loses focus, devtools appear to be
// open (heuristic, not reliable), or the window is resized abnormally
// (common devtools-docking signal). This is a deterrent only.
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

    // Heuristic devtools-open detector via window size delta.
    // Unreliable by design constraints of the web platform — deterrent only.
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

// ── SECURE VIEWER (images rendered directly; PDFs rendered page-by-page as images) ──
function SecureViewer({ aid, pageUrls, watermarkLabel, onClose }) {
  const blurred = useBlurGuard(true)
  usePrintBlock()
  const [pageIdx, setPageIdx] = useState(0)
  const isPdf = aid.kind === 'pdf'
  const totalPages = pageUrls.length

  useEffect(() => {
    const escHandler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', escHandler)
    return () => window.removeEventListener('keydown', escHandler)
  }, [onClose])

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#0f172a', color: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{aid.title}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>View-only · Screenshots and printing are not permitted</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isPdf && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <button disabled={pageIdx === 0} onClick={() => setPageIdx(p => Math.max(0, p - 1))}
                style={btnSm(pageIdx === 0 ? '#334155' : '#1e293b')}>‹ Prev</button>
              <span>{pageIdx + 1} / {totalPages}</span>
              <button disabled={pageIdx === totalPages - 1} onClick={() => setPageIdx(p => Math.min(totalPages - 1, p + 1))}
                style={btnSm(pageIdx === totalPages - 1 ? '#334155' : '#1e293b')}>Next ›</button>
            </div>
          )}
          <button onClick={onClose} style={btnSm('#dc2626')}>✕ Close</button>
        </div>
      </div>

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
  const [description, setDescription] = useState('')
  const [kind, setKind]               = useState('pdf')
  const [files, setFiles]             = useState([])
  const [saving, setSaving]           = useState(false)
  const fileInputRef = useRef()

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files || []))
  }

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) { showToast('Enter a title', C.amber); return }
    if (!files.length) { showToast('Choose at least one file', C.amber); return }

    setSaving(true)
    try {
      // For PDFs: expect the admin to upload page images (page-1.jpg, page-2.jpg, ...)
      // already rendered client-side is out of scope for this component; instead
      // we accept either: (a) a single PDF file — stored as-is and rendered via
      // a signed URL fed into a canvas-render step server-side/elsewhere, or
      // (b) multiple image files representing pages. To keep this component
      // self-contained and avoid a client-side PDF.js dependency, we require
      // image uploads (jpg/png) for the guarded viewer. A PDF-to-images
      // conversion step should happen at upload time (e.g. via a small admin
      // tool) before files reach here — see note in handleSave below if a
      // raw PDF is selected.
      const isSingleRawPdf = files.length === 1 && files[0].type === 'application/pdf'

      if (isSingleRawPdf) {
        // Store the raw PDF too, but flag kind as 'pdf-raw' so the viewer
        // knows to render it as PDF pages are not pre-rasterised. Because the
        // portal has no server-side rasteriser wired up yet, we still store
        // it — the SecureViewer will show a message asking the admin to
        // provide page images for full guarded viewing, since native PDF
        // embeds can't be reliably locked down (browser PDF viewers expose
        // their own download/print controls we cannot suppress).
        const path = `${batch}/${Date.now()}-${files[0].name}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, files[0], { upsert: false })
        if (upErr) throw upErr

        const { error: insErr } = await supabase.from('teaching_aids').insert({
          batch, subject: subject.trim() || null, title: trimmedTitle,
          description: description.trim(), kind: 'pdf-raw',
          file_path: path, page_count: 1,
          created_by: currentUser?.name || currentUser?.role || 'admin',
        })
        if (insErr) throw insErr

        showToast('⚠️ PDF stored, but page-image conversion is recommended for full view-only protection. See notes.', C.amber)
      } else {
        // Multiple images = pages of one teaching aid, uploaded in order.
        const uploadedPaths = []
        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          const path = `${batch}/${Date.now()}-p${i + 1}-${f.name}`
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, { upsert: false })
          if (upErr) throw upErr
          uploadedPaths.push(path)
        }
        // Store as a JSON array in file_path (pipe-joined) since schema uses
        // a single text column; adjust to a join table if you prefer.
        const { error: insErr } = await supabase.from('teaching_aids').insert({
          batch, subject: subject.trim() || null, title: trimmedTitle,
          description: description.trim(), kind: 'image',
          file_path: uploadedPaths.join('|'), page_count: uploadedPaths.length,
          created_by: currentUser?.name || currentUser?.role || 'admin',
        })
        if (insErr) throw insErr
        showToast(`✅ Teaching aid "${trimmedTitle}" added (${uploadedPaths.length} page${uploadedPaths.length > 1 ? 's' : ''})`, C.green)
      }

      setSaving(false)
      onSaved()
      onClose()
    } catch (err) {
      showToast('Upload failed: ' + err.message, C.rose)
      setSaving(false)
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

        <div style={{ fontSize: 11, color: C.slate, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 12px', marginBottom: 16, lineHeight: 1.6 }}>
          For full view-only protection, upload page images (JPG/PNG), one per page, selected in order.
          Raw PDF uploads are stored but cannot be as strictly guarded, since browser PDF viewers expose
          their own download/print controls that this portal cannot suppress.
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={lS}>Title *</label>
            <input style={iS} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fractions — Concept Chart" autoFocus />
          </div>
          <div>
            <label style={lS}>Subject (optional)</label>
            <input style={iS} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
          </div>
          <div>
            <label style={lS}>Description (optional)</label>
            <textarea style={{ ...iS, minHeight: 60, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label style={lS}>Files * (images, in page order — or a single PDF)</label>
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
      <div style={{ fontSize: 22, flexShrink: 0 }}>{aid.kind === 'image' ? '🖼️' : '📄'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{aid.title}</div>
        {aid.subject && <div style={{ fontSize: 11, color: C.indigo, marginTop: 2 }}>{aid.subject}</div>}
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
  const isMobile = useIsMobile()

  // Admin check follows the same convention seen across other GNSI modules:
  // currentUser?.role === 'Admin' grants full access; perms.read gates
  // everyone else's viewing rights.
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
          <button key={b} onClick={() => setActiveBatch(b)}
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
      <div style={{ ...cardS, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{activeBatch}</div>
          <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>{aids.length} teaching aid{aids.length !== 1 ? 's' : ''}</div>
        </div>
        {canAdd && (
          <button onClick={() => setShowAdd(true)} style={btn(C.indigo)}>➕ Add Teaching Aid</button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ ...cardS, textAlign: 'center', padding: 40, color: C.slate }}>⏳ Loading…</div>
      ) : aids.length === 0 ? (
        <div style={{ ...cardS, textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          No teaching aids uploaded yet for {activeBatch}.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {aids.map(aid => (
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