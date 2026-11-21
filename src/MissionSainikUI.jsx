// MissionSainikUI.jsx — small premium building blocks used inside the module's tables:
// initials avatars, status pills with a dot, count pills with a mini progress bar, score pills, gradient bars.
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PX } from './premiumUI'
import { useStaffPhotos, findStaffPhoto } from './staffPhotos'

const PALETTE = [['#132a4f', '#2f5aa8'], ['#a97c1f', '#e3bd5f'], ['#0f7a4c', '#3fb184'], ['#6d28d9', '#a78bfa'], ['#c2410c', '#fb923c'], ['#0e7490', '#38bdf8'], ['#be185d', '#f472b6'], ['#4d7c0f', '#a3c94a']]
const initials = n => String(n || '?').replace(/^(sir|miss|mr|mrs)\s+/i, '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
const hue = n => { let h = 0; for (const c of String(n || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length] }

// True on a phone-width screen (updates when the window is resized or rotated).
function usePhone() {
  const q = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 700px)') : null)
  const [phone, setPhone] = useState(() => !!q()?.matches)
  useEffect(() => {
    const m = q(); if (!m) return undefined
    const f = e => setPhone(e.matches)
    m.addEventListener?.('change', f)
    return () => m.removeEventListener?.('change', f)
  }, [])
  return phone
}

// Full-size photo: tap anywhere or press Esc to close.
function PhotoViewer({ url, name, onClose }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Photo of ${name}`} onClick={e => { e.stopPropagation(); onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(8,16,34,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 16, cursor: 'zoom-out' }}>
      <img src={url} alt={String(name || '')} style={{ width: 'min(92vw, 520px)', maxHeight: '78vh', objectFit: 'contain', borderRadius: 20, background: '#F4F1EA', border: '3px solid #E2C57E', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} />
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, textAlign: 'center' }}>{name}</div>
      <button type="button" onClick={e => { e.stopPropagation(); onClose() }} aria-label="Close photo" style={{ border: 0, borderRadius: 99, padding: '10px 26px', fontSize: 15, fontWeight: 800, background: '#fff', color: '#132a4f', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
    </div>, document.body)
}

// Initials circle, or the person's real photo when one exists in the staff photo system (Staff profile photo, or Website Manager → Faculty).
// On a phone the photo is drawn larger, and tapping it opens it full size. staff={false} for people who are not staff (students, batches):
// they keep the initials and are never matched to a staff photo.
export function Avatar({ name, size = 34, staff = true, photoName }) {
  useStaffPhotos()
  const phone = usePhone()
  const [broken, setBroken] = useState(false)
  const [open, setOpen] = useState(false)
  const url = staff && !broken ? findStaffPhoto(photoName || name) : null
  const [a, b] = hue(name)
  if (url) {
    const px = phone ? Math.min(Math.round(size * 1.45), 76) : size
    const big = size >= 24                                   // tiny chips are not tappable
    return (
      <>
        <img src={url} alt={String(name || '')} title={String(name || '')} loading="lazy" onError={() => setBroken(true)}
          onClick={big ? e => { e.stopPropagation(); setOpen(true) } : undefined} role={big ? 'button' : undefined} aria-label={big ? `Show a larger photo of ${name}` : undefined}
          style={{ width: px, height: px, borderRadius: '50%', flex: 'none', objectFit: 'cover', objectPosition: 'center top', display: 'inline-block', background: '#F4F1EA', cursor: big ? 'zoom-in' : undefined,
            boxShadow: '0 2px 6px rgba(19,42,79,.22), inset 0 0 0 2px rgba(255,255,255,.35)', border: '2px solid #E2C57E' }} />
        {open && <PhotoViewer url={url} name={String(photoName || name || '')} onClose={() => setOpen(false)} />}
      </>
    )
  }
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38, letterSpacing: '.02em',
      background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: '0 2px 6px rgba(19,42,79,.22), inset 0 0 0 2px rgba(255,255,255,.35)' }}>{initials(name)}</span>
  )
}

export function PersonCell({ name, sub, size = 34, children, staff = true, photoName }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Avatar name={name} size={size} staff={staff} photoName={photoName} />
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: PX.ink }}>{children || name}</span>
        {sub ? <span style={{ fontSize: 11.5, color: PX.sub, fontWeight: 500, overflowWrap: 'anywhere' }}>{sub}</span> : null}
      </span>
    </span>
  )
}

const TONES = {
  ok: ['#0f7a4c', '#e6f5ec', '#bfe5cf'], warn: ['#9a5b00', '#fff3d6', '#f3dca3'], bad: ['#b42318', '#fdecea', '#f5c2bd'],
  info: ['#1d4ed8', '#e8f0fe', '#c3d5fb'], gold: ['#7a5a10', '#f8efd3', '#e7d194'], mute: ['#5d6b82', '#eef1f6', '#dde3ee'],
}
export function Pill({ tone = 'mute', dot = true, children, title }) {
  const [fg, bg, bd] = TONES[tone] || TONES.mute
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, color: fg, background: bg, border: `1px solid ${bd}`, whiteSpace: 'nowrap' }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: fg, boxShadow: `0 0 0 3px ${bg}` }} />}{children}
    </span>
  )
}

export function MiniBar({ pct, tone = 'gold', width = 84 }) {
  const grad = { gold: 'linear-gradient(90deg,#b8923a,#e6c35e)', ok: 'linear-gradient(90deg,#0f7a4c,#3fb184)', bad: 'linear-gradient(90deg,#b42318,#f0776c)', info: 'linear-gradient(90deg,#1d4ed8,#6b9bff)' }[tone]
  return (
    <span role="img" aria-label={`${Math.round(pct)}%`} style={{ display: 'inline-block', width, height: 7, borderRadius: 4, background: '#ece7d8', overflow: 'hidden', verticalAlign: 'middle' }}>
      <span style={{ display: 'block', width: Math.max(0, Math.min(100, pct)) + '%', height: '100%', borderRadius: 4, background: grad, transition: 'width .6s ease' }} />
    </span>
  )
}

// "14/25" with a thin progress bar under it; green when full, amber when partly done, grey when empty.
export function CountPill({ n, q }) {
  const full = n >= q, part = n > 0 && !full
  const tone = full ? 'ok' : part ? 'warn' : 'mute'
  const [fg, bg, bd] = TONES[tone]
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, minWidth: 64 }}>
      <span style={{ textAlign: 'center', padding: '3px 10px', borderRadius: 10, fontWeight: 800, fontSize: 12.5, color: fg, background: bg, border: `1px solid ${bd}` }}>{full ? '✓ ' : ''}{n}/{q}</span>
      <MiniBar pct={q ? (n / q) * 100 : 0} tone={full ? 'ok' : 'gold'} width={64} />
    </span>
  )
}

// A mark with its out-of-max; tinted by percentage (green ≥75, gold ≥60, red <60).
export function ScorePill({ v, max }) {
  if (v == null || v === '') return <span style={{ color: PX.faint }}>—</span>
  const p = (Number(v) / max) * 100
  const tone = p >= 75 ? 'ok' : p >= 60 ? 'gold' : 'bad'
  const [fg, bg, bd] = TONES[tone]
  return <span style={{ display: 'inline-block', minWidth: 44, textAlign: 'center', padding: '3px 10px', borderRadius: 10, fontWeight: 800, fontSize: 12.5, color: fg, background: bg, border: `1px solid ${bd}` }} title={`${Math.round(p)}%`}>{v}</span>
}
