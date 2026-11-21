// MissionSainikUI.jsx — small premium building blocks used inside the module's tables:
// initials avatars, status pills with a dot, count pills with a mini progress bar, score pills, gradient bars.
import { PX } from './premiumUI'

const PALETTE = [['#132a4f', '#2f5aa8'], ['#a97c1f', '#e3bd5f'], ['#0f7a4c', '#3fb184'], ['#6d28d9', '#a78bfa'], ['#c2410c', '#fb923c'], ['#0e7490', '#38bdf8'], ['#be185d', '#f472b6'], ['#4d7c0f', '#a3c94a']]
const initials = n => String(n || '?').replace(/^(sir|miss|mr|mrs)\s+/i, '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
const hue = n => { let h = 0; for (const c of String(n || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length] }

export function Avatar({ name, size = 34 }) {
  const [a, b] = hue(name)
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38, letterSpacing: '.02em',
      background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: '0 2px 6px rgba(19,42,79,.22), inset 0 0 0 2px rgba(255,255,255,.35)' }}>{initials(name)}</span>
  )
}

export function PersonCell({ name, sub, size = 34, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Avatar name={name} size={size} />
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
