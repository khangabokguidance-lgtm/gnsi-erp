// feeTheme.js — one premium look for the Fees hub tabs (built on the "Ledger & Crest"
// tokens in ledgerTheme.jsx): parchment surface, ink table headers, brass accent,
// soft shadow, tabular numbers. Tabs import these instead of each defining its own.
import { COLOR, FONT, SHADOW } from './ledgerTheme'

export const NAVY = COLOR.inkRaised
export const BORDER = COLOR.rule
export const FEE_FONT = FONT

export const card = { background: COLOR.parchmentRaised, border: `1px solid ${COLOR.rule}`, borderRadius: 14, padding: 16, boxShadow: SHADOW.onParchment }
// Card whose children (tables) run to the edge.
export const cardFlush = { ...card, padding: 0, overflow: 'hidden', marginBottom: 14 }
export const label = { fontSize: 10, fontWeight: 700, color: COLOR.slate, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }
export const input = { padding: '8px 11px', border: `1px solid ${COLOR.rule}`, borderRadius: 8, fontSize: 13, background: '#fff', minWidth: 0, boxSizing: 'border-box', fontFamily: 'inherit', color: COLOR.ink2 }
export const inputFull = { ...input, width: '100%' }

// Buttons: `btnFn(bg, fg)` for tabs that colour per action, `btn` / `btnPrimary` objects for the rest.
export const btnFn = (bg = COLOR.inkRaised, fg = '#fff') => ({ padding: '8px 14px', borderRadius: 8, border: 'none', background: bg, color: fg, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' })
export const btn = { padding: '7px 13px', border: `1px solid ${COLOR.rule}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: COLOR.ink2, fontFamily: 'inherit' }
export const btnPrimary = { ...btn, background: COLOR.inkRaised, color: '#fff', border: `1px solid ${COLOR.inkRaised}` }

// Table cells: `cell`/`head` (register-style) and `td`/`th` (solid ink header).
export const cell = { padding: '9px 12px', borderBottom: `1px solid ${COLOR.cream}`, fontSize: 12.5, color: COLOR.ink2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
export const head = { ...cell, fontSize: 10.5, fontWeight: 700, color: COLOR.slate, textTransform: 'uppercase', letterSpacing: '.08em', background: COLOR.parchment, borderBottom: `1px solid ${COLOR.rule}` }
export const td = { ...cell, whiteSpace: 'normal', verticalAlign: 'middle' }
export const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff', background: COLOR.inkRaised, whiteSpace: 'nowrap', letterSpacing: '.06em', textTransform: 'uppercase' }

// Page surface wrapped around a tab: parchment, serif titles, aligned numbers.
export const surface = { background: COLOR.parchment, border: `1px solid ${COLOR.rule}`, borderRadius: 16, padding: 16, fontFamily: FONT.body, color: COLOR.ink2 }
export const titleStyle = { fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: COLOR.ink, margin: 0, letterSpacing: '-.01em' }
export const subtitleStyle = { fontSize: 12.5, color: COLOR.slate, margin: '4px 0 0' }
export const pill = (active) => ({ padding: '6px 13px', borderRadius: 999, border: `1px solid ${active ? COLOR.inkRaised : COLOR.rule}`, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: active ? COLOR.inkRaised : '#fff', color: active ? '#fff' : COLOR.ink2, fontFamily: 'inherit' })
