import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from './supabase'
import { sysOr, sysValue } from './systemSettings'
import { staffDB } from './staffDB'
import { isAdminRole } from './roles'
import { PremiumStyles, PremiumHero, PremiumTabs, PX } from './premiumUI'
import { BATCHES, TIMETABLE_ROWS, periodName, isWholeInstituteEntry } from './timetableData'
import { teacherLoad, findClashes, suggestSubstitutes, nowAndNext, sameTeacher, isBusy, periodSpan, dayOf } from './timetableTools'

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — the portal's premium register (premiumUI.jsx): deep navy +
// antique gold on warm paper. Fraunces for display (letterheads, titles, times),
// Plus Jakarta Sans for data — both loaded by <PremiumStyles />, so the grid no
// longer falls back to system fonts. Times use tabular figures so columns align.
// ══════════════════════════════════════════════════════════════════════════════
const C = {
  navy900: PX.navyDeep,
  navy700: PX.navy,
  navy500: PX.navy2,
  navy100: '#d7deea',
  navy50:  '#f3f0e8',
  parchment: PX.tint,
  paper:   PX.paper,
  gold:    PX.gold,
  goldDim: '#8f6f24',
  goldLt:  PX.goldBg,
  ink:     PX.ink,
  inkSoft: PX.sub,
  inkFaint:PX.faint,
  line:    PX.line,
  rose:    PX.bad,
  roseLt:  PX.badBg,
  emerald: PX.ok,
  emeraldLt: PX.okBg,
}
const SERIF = PX.serif
const SANS  = PX.sans
const NUM = { fontVariantNumeric: 'tabular-nums' }

// Module stylesheet (scoped under .tt-root): cards, the live "now" ring, timeline, load bars.
const TT_CSS = `
.tt-root{font-family:${PX.sans}}
.tt-card{background:#fff;border:1px solid ${PX.line};border-radius:18px;box-shadow:0 1px 2px rgba(19,42,79,.05),0 18px 36px -28px rgba(19,42,79,.45)}
.tt-h{font-family:${PX.serif};font-weight:600;color:${PX.navyDeep};letter-spacing:-.01em}
.tt-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${PX.gold}}
.tt-slot{position:relative;border-radius:12px;padding:10px 12px 10px 14px;min-height:58px;transition:transform .12s ease,box-shadow .12s ease}
.tt-slot::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:4px;border-radius:0 4px 4px 0;background:var(--dot)}
.tt-slot.edit{cursor:pointer}
.tt-slot.edit:hover{transform:translateY(-1px);box-shadow:0 10px 18px -12px rgba(19,42,79,.45)}
.tt-slot.now{box-shadow:0 0 0 2px ${PX.gold},0 12px 24px -14px rgba(184,146,58,.8)}
.tt-now{position:absolute;top:-8px;right:8px;background:linear-gradient(180deg,#d4ae58,${PX.gold});color:#1a1406;font:800 9px/1 ${PX.sans};letter-spacing:.12em;padding:3px 7px;border-radius:99px}
.tt-band{background:linear-gradient(90deg,${PX.navyDeep},${PX.navy});color:${PX.goldLt};text-align:center;font:700 11.5px/1.2 ${PX.sans};letter-spacing:.14em;text-transform:uppercase;padding:11px 12px;border-radius:10px}
.tt-time{font-family:${PX.serif};font-weight:600;color:${PX.navy};font-variant-numeric:tabular-nums;white-space:nowrap}
.tt-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;border:1px solid ${PX.line};background:#fff;font:700 12px/1 ${PX.sans};color:${PX.ink2};cursor:pointer}
.tt-chip.on{background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:#fff;border-color:${PX.navy}}
.tt-chip i{width:8px;height:8px;border-radius:50%;background:var(--dot);display:inline-block}
.tt-bar{height:8px;border-radius:99px;background:#efe9db;overflow:hidden}
.tt-bar b{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,${PX.gold},#d4ae58)}
.tt-avatar{width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:800 12px/1 ${PX.sans};color:#fff;flex-shrink:0;background:linear-gradient(180deg,${PX.navy2},${PX.navy})}
.tt-grid th{position:sticky;top:0;z-index:1}
@media (max-width:720px){.tt-hide-sm{display:none!important}}
@keyframes ttPulse{0%{box-shadow:0 0 0 0 rgba(184,146,58,.55)}100%{box-shadow:0 0 0 10px rgba(184,146,58,0)}}
.tt-live{width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block;animation:ttPulse 1.6s infinite}
@media (prefers-reduced-motion:reduce){.tt-live{animation:none}.tt-slot{transition:none}}
`
const ADMIN_PIN = '1950'
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const INSTITUTE = {
  // Name / address / phone / email follow System Settings → Basic Info.
  get name() { const n = sysValue('school_name'); return n ? n.toUpperCase() : 'GUIDANCE NAVODAYA & SAINIK INSTITUTE' },
  short: 'GNSI',
  tagline: 'NVS · Sainik School · RMS Entrance Coaching',
  get address() { return sysOr('school_address', 'Khangabok, Thoubal District, Manipur — 795138') },
  get phone() { return sysOr('school_phone', '+91 89742 98074') },
  get email() { return sysOr('school_email', 'admissions@guidancekhangabok.in') },
  website: 'guidancekhangabok.in',
  founded: '2016',
}

const BATCH_PALETTE = {
  Achiever: { bg: '#EEF2FA', border: '#B9C7E6', text: '#1E3A6E', dot: '#2A4A9E' },
  Leader:   { bg: '#E9F5EF', border: '#9FD6BB', text: '#155A3B', dot: '#1B8F55' },
  Champion: { bg: '#F3EEFA', border: '#CBB6E8', text: '#5A2E8E', dot: '#7C3EC4' },
  Lakshya:  { bg: '#FCF1E6', border: '#EABF8F', text: '#8A4A16', dot: '#C1701F' },
  Umeed:    { bg: '#FCEEF3', border: '#EAB0C6', text: '#8A2050', dot: '#C22D6F' },
  Udaan:    { bg: '#EAF6F4', border: '#9CD8CE', text: '#0F5C50', dot: '#1A8D79' },
  Pragati:  { bg: '#FBF3DF', border: '#E7C878', text: '#7A5710', dot: '#B3861F' },
}
const getBatchStyle = n => {
  if (!n) return { bg: C.navy50, border: C.line, text: C.inkSoft, dot: C.inkFaint }
  return BATCH_PALETTE[n.split(' ')[0]] || { bg: C.navy50, border: C.line, text: C.inkSoft, dot: C.inkFaint }
}
const isDoubt = subj => /DOUBT SESSION/i.test(subj || '')

// local calendar date (toISOString would give yesterday's date before 5:30 AM in India)
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function addDaysISO(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Parses the start time out of a period_name like "10:25 AM–11:20 AM" (en dash or hyphen)
// and returns minutes since midnight, for chronological sorting of the grid.
function periodStartMinutes(periodName) {
  const first = (periodName || '').split(/[–-]/)[0].trim()
  const m = first.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])/)
  if (!m) return 0
  let [, hh, mm, ap] = m
  hh = parseInt(hh, 10)
  mm = parseInt(mm, 10)
  if (/pm/i.test(ap) && hh !== 12) hh += 12
  if (/am/i.test(ap) && hh === 12) hh = 0
  return hh * 60 + mm
}

// ══════════════════════════════════════════════════════════════════════════════
// SEED DATA — October 2026 Time Table (Mon–Sat, repeats weekly)
// Built from the shared schedule in timetableData.js so the grid, reports and
// any other reader stay in step. Whole-institute rows (assembly, meals, breaks,
// Refresh Hour, Lights Off) are stored once per day with class_name 'ALL'.
// ══════════════════════════════════════════════════════════════════════════════
const SEED_PERIODS = TIMETABLE_ROWS.map(row => ({
  period_name: periodName(row),
  rows: row.wholeInstitute
    ? [{ class_name: 'ALL', section: null, subject_name: row.label, teacher_name: null }]
    : row.cells.flatMap((cell, i) => cell ? [{
        class_name: BATCHES[i].name, section: BATCHES[i].sub,
        subject_name: cell[0], teacher_name: cell[1] || null,
      }] : []),
}))

function buildSeedRows() {
  const rows = []
  for (const day of DAYS) {
    for (const period of SEED_PERIODS) {
      for (const r of period.rows) {
        rows.push({
          class_name: r.class_name, section: r.section, day_name: day,
          period_name: period.period_name, subject_name: r.subject_name,
          teacher_name: r.teacher_name, room_name: null,
        })
      }
    }
  }
  return rows
}

// ══════════════════════════════════════════════════════════════════════════════
// CREST — SVG signature mark, laurel + star + open book. Original device.
// ══════════════════════════════════════════════════════════════════════════════
function Crest({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill={C.navy900} stroke={C.gold} strokeWidth="2" />
      <path d="M32 14 L36 26 L49 26 L38 34 L42 47 L32 39 L22 47 L26 34 L15 26 L28 26 Z" fill={C.gold} opacity="0.95" />
      <path d="M18 44 Q32 52 46 44" stroke={C.gold} strokeWidth="1.6" fill="none" opacity="0.8" />
      <path d="M14 40 Q32 50 50 40" stroke={C.gold} strokeWidth="1" fill="none" opacity="0.5" />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LETTERHEAD
// ══════════════════════════════════════════════════════════════════════════════
function docRef() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `GNSI/TT/${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function Letterhead({ reportTitle, reportMeta }) {
  return (
    <div style={{ borderBottom: `3px double ${C.navy900}`, paddingBottom: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Crest size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.navy900, letterSpacing: '0.3px', lineHeight: 1.15 }}>
            {INSTITUTE.name}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: C.goldDim, fontWeight: 600, letterSpacing: '.04em', marginTop: 2 }}>
            {INSTITUTE.tagline}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 10, color: C.inkSoft, marginTop: 4 }}>
            {INSTITUTE.address} &nbsp;·&nbsp; {INSTITUTE.phone} &nbsp;·&nbsp; {INSTITUTE.email} &nbsp;·&nbsp; {INSTITUTE.website}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: SANS, flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: '.08em' }}>Est. {INSTITUTE.founded}</div>
          <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 3 }}>Ref: {docRef()}</div>
        </div>
      </div>
      {reportTitle && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: C.navy900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            {reportTitle}
          </div>
          {reportMeta && <div style={{ fontFamily: SANS, fontSize: 10.5, color: C.inkSoft, marginTop: 3 }}>{reportMeta}</div>}
        </div>
      )}
    </div>
  )
}

function ReportFooter({ generatedAt }) {
  return (
    <div style={{ marginTop: 24, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontFamily: SANS, fontSize: 9.5, color: C.inkFaint }}>
      <div>Generated {generatedAt} · {INSTITUTE.short} Timetable System</div>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 130, borderTop: `1px solid ${C.inkFaint}`, marginBottom: 4 }} />
          Prepared By
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 130, borderTop: `1px solid ${C.inkFaint}`, marginBottom: 4 }} />
          Authorized Signature
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ══════════════════════════════════════════════════════════════════════════════
const baseInput = {
  width: '100%', padding: '9px 13px', borderRadius: 7, border: `1px solid ${C.line}`,
  fontSize: 13, outline: 'none', fontFamily: SANS, color: C.ink, background: 'white',
  boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s',
}
const S = {
  inp: baseInput,
  lbl: { display: 'block', fontSize: 10.5, fontWeight: 700, color: C.inkFaint, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' },
  pill: (bg, text) => ({ background: bg, color: text, padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 700 }),
  btn: {
    primary: { background: C.navy900, color: C.gold, border: `1px solid ${C.navy900}`, borderRadius: 7, padding: '9px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: SANS, letterSpacing: '.02em' },
    gold: { background: C.gold, color: C.navy900, border: `1px solid ${C.goldDim}`, borderRadius: 7, padding: '9px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: SANS },
    ghost: { background: 'transparent', color: C.navy700, border: `1px solid ${C.line}`, borderRadius: 7, padding: '9px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: SANS },
    danger: { background: C.rose, color: 'white', border: 'none', borderRadius: 7, padding: '9px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: SANS },
    icon: { background: C.navy50, color: C.navy700, border: `1px solid ${C.line}`, borderRadius: 6, padding: '5px 9px', fontWeight: 600, cursor: 'pointer', fontSize: 12, fontFamily: SANS },
    iconDanger: { background: C.roseLt, color: C.rose, border: `1px solid #f0c4c0`, borderRadius: 6, padding: '5px 9px', fontWeight: 600, cursor: 'pointer', fontSize: 12, fontFamily: SANS },
  },
}

function Input({ value, onChange, placeholder, style = {}, list, type = 'text' }) {
  const [focused, setFocused] = useState(false)
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} list={list}
      style={{ ...S.inp, ...(focused ? { borderColor: C.gold, boxShadow: `0 0 0 3px ${C.goldLt}` } : {}), ...style }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  )
}
function Select({ value, onChange, children, style = {}, disabled = false }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}
      style={{ ...S.inp, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235B6472' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, ...(disabled ? { backgroundColor: C.navy50, cursor: 'not-allowed', color: C.inkFaint } : {}), ...style }}>
      {children}
    </select>
  )
}
function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 8, background: isErr ? C.rose : C.navy900, color: isErr ? 'white' : C.gold, fontWeight: 600, fontSize: 13, fontFamily: SANS, boxShadow: '0 8px 40px rgba(11,30,61,.28)', minWidth: 280, maxWidth: 380 }}>
      <span style={{ fontSize: 16 }}>{isErr ? '⚠' : '✓'}</span>{toast.msg}
    </div>
  )
}
function PinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState(''); const [err, setErr] = useState(false)
  const submit = () => { if (pin === ADMIN_PIN) onSuccess(); else { setErr(true); setPin('') } }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,30,61,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 10, padding: 28, width: 320, fontFamily: SANS, border: `1px solid ${C.line}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: C.navy900, marginBottom: 4 }}>Admin Access</div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 16 }}>Enter PIN to edit the timetable</div>
        <input type="password" autoFocus value={pin} onChange={e => { setPin(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ ...S.inp, textAlign: 'center', fontSize: 20, letterSpacing: 6, marginBottom: 8, borderColor: err ? C.rose : C.line }} placeholder="••••" />
        {err && <div style={{ fontSize: 12, color: C.rose, marginBottom: 8 }}>Incorrect PIN</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={submit} style={{ ...S.btn.primary, flex: 1 }}>Unlock</button>
          <button onClick={onClose} style={S.btn.ghost}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// GRID CELL — a slot card with the batch's colour stripe; whole-institute rows are
// one navy band; the period running right now gets a gold ring and a NOW tag.
// ══════════════════════════════════════════════════════════════════════════════
function Cell({ entry, subMap, isAdmin, onEdit, isNow }) {
  if (!entry) return <td style={{ padding: 6, background: 'transparent' }}><div style={{ minHeight: 58, borderRadius: 12, border: `1px dashed ${C.line}` }} /></td>
  const style = getBatchStyle(entry.class_name)
  const doubt = isDoubt(entry.subject_name)
  const sub = subMap.get(`${entry.day_name}|${entry.class_name}|${entry.period_name}`)

  // Breaks, assembly, meals, Refresh Hour, Lights Off — one dark band across the row.
  if (isWholeInstituteEntry(entry)) {
    return (
      <td style={{ padding: 6 }}>
        <div className="tt-band" style={isNow ? { boxShadow: `0 0 0 2px ${C.gold}` } : undefined}>{entry.subject_name}</div>
      </td>
    )
  }
  return (
    <td style={{ padding: 6, verticalAlign: 'top' }}>
      <div className={'tt-slot' + (isAdmin && onEdit ? ' edit' : '') + (isNow ? ' now' : '')}
        onClick={() => isAdmin && onEdit && onEdit(entry)}
        title={isAdmin ? 'Edit this slot' : undefined}
        style={{ '--dot': doubt ? C.inkFaint : style.dot, background: doubt ? C.navy50 : style.bg, border: `1px solid ${doubt ? C.line : style.border}` }}>
        {isNow && <span className="tt-now">NOW</span>}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: doubt ? C.inkSoft : style.text, lineHeight: 1.3 }}>
          {entry.subject_name}
        </div>
        {entry.teacher_name && !sub && (
          <div style={{ fontSize: 11, color: doubt ? C.inkFaint : style.text, opacity: .85, marginTop: 3 }}>{entry.teacher_name}</div>
        )}
        {entry.room_name && <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 3 }}>Room {entry.room_name}</div>}
        {sub && (
          <div style={{ marginTop: 5, padding: '4px 7px', background: C.roseLt, borderRadius: 7, fontSize: 10.5 }}>
            <div style={{ color: C.inkFaint, textDecoration: 'line-through' }}>{entry.teacher_name || '—'}</div>
            <div style={{ color: C.rose, fontWeight: 700 }}>→ {sub.substitute_teacher}</div>
          </div>
        )}
        {doubt && !entry.teacher_name && !sub && (
          <div style={{ fontSize: 10.5, color: C.inkFaint, fontStyle: 'italic' }}>Duty teacher TBD</div>
        )}
      </div>
    </td>
  )
}

// period names in time order for one batch (its own rows plus whole-institute rows)
function periodsOf(entries, b) {
  const seen = new Set()
  entries.filter(e => e.class_name === b || e.class_name === 'ALL').forEach(e => seen.add(e.period_name))
  return [...seen].sort((a, c) => periodStartMinutes(a) - periodStartMinutes(c))
}
const slotFor = (entries, b, p, d) => entries.find(e => e.period_name === p && e.day_name === d && (e.class_name === b || e.class_name === 'ALL'))
const isNowSlot = (now, d, p) => !!now && now.day === d && (() => { const sp = periodSpan(p); return sp.start <= now.minutes && now.minutes < Math.max(sp.end, sp.start + 1) })()

function BatchTable({ entries, b, subMap, isAdmin, onEdit, now }) {
  const periods = periodsOf(entries, b)
  const st = getBatchStyle(b)
  return (
    <div className="tt-card" style={{ overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ padding: '14px 18px', background: `linear-gradient(135deg,${C.navy900},${C.navy700})`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: st.dot, boxShadow: `0 0 0 3px rgba(255,255,255,.18)` }} />
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: 'white' }}>{b}</div>
        <div style={{ fontSize: 11, color: C.goldLt, marginLeft: 'auto', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>Monday – Saturday</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tt-grid" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: SANS }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 14px', textAlign: 'left', background: C.parchment, color: C.inkFaint, fontWeight: 800, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', borderBottom: `2px solid ${C.gold}` }}>Time</th>
              {DAYS.map(d => {
                const today = now && now.day === d
                return (
                  <th key={d} style={{ padding: '12px 10px', textAlign: 'left', background: today ? C.goldLt : C.parchment, color: C.navy900, fontWeight: 800, fontSize: 12.5, minWidth: 150, borderBottom: `2px solid ${C.gold}` }}>
                    {d}{today && <span style={{ marginLeft: 6, fontSize: 9.5, color: C.goldDim, letterSpacing: '.1em' }}>TODAY</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {periods.map(p => {
              const sp = periodSpan(p)
              const [from, to] = p.split(/\s*[–-]\s*(?=\d)/)
              return (
                <tr key={p}>
                  <td style={{ padding: '8px 14px', borderBottom: `1px solid ${C.line}`, verticalAlign: 'middle' }}>
                    <div className="tt-time" style={{ fontSize: 13 }}>{from}</div>
                    {to && <div style={{ fontSize: 10.5, color: C.inkFaint, ...NUM }}>to {to} · {Math.max(0, sp.end - sp.start)} min</div>}
                  </td>
                  {DAYS.map(d => <Cell key={d} entry={slotFor(entries, b, p, d)} subMap={subMap} isAdmin={isAdmin} onEdit={onEdit} isNow={isNowSlot(now, d, p)} />)}
                </tr>
              )
            })}
            {!periods.length && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.inkFaint }}>No periods found for this batch</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BatchChips({ batches, active, onPick, allLabel = 'All batches' }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {allLabel && <button className={'tt-chip' + (active === 'ALL_BATCHES' ? ' on' : '')} onClick={() => onPick('ALL_BATCHES')}>{allLabel}</button>}
      {batches.map(b => (
        <button key={b} className={'tt-chip' + (active === b ? ' on' : '')} onClick={() => onPick(b)} style={{ '--dot': getBatchStyle(b).dot }}>
          <i />{b}
        </button>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// WEEKLY GRID VIEW
// ══════════════════════════════════════════════════════════════════════════════
function WeeklyGrid({ entries, batches, activeBatch, setActiveBatch, subMap, isAdmin, onEdit, now }) {
  const shown = activeBatch === 'ALL_BATCHES' ? batches : [activeBatch]
  return (
    <div>
      <BatchChips batches={batches} active={activeBatch} onPick={setActiveBatch} />
      {isAdmin && <div style={{ fontSize: 11.5, color: C.inkFaint, margin: '-6px 0 12px' }}>Tap a class to edit it — you can apply the change to every day at once.</div>}
      {shown.map(b => <BatchTable key={b} entries={entries} b={b} subMap={subMap} isAdmin={isAdmin} onEdit={onEdit} now={now} />)}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EDIT ENTRY MODAL
// ══════════════════════════════════════════════════════════════════════════════
function EditEntryModal({ entry, entries, staffList, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...entry })
  const [allDays, setAllDays] = useState(false)
  const [saving, setSaving] = useState(false)
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  // Is the chosen teacher already teaching another batch then (on this day, or on any day when applying to all)?
  const busyOn = useMemo(() => {
    if (!form.teacher_name) return []
    const others = entries.filter(e => !(e.class_name === form.class_name && e.period_name === form.period_name))
    return (allDays ? DAYS : [form.day_name]).filter(d => isBusy(others, form.teacher_name, d, form.period_name))
  }, [entries, form.teacher_name, form.class_name, form.period_name, form.day_name, allDays])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }} onClick={onClose}>
      <div className="tt-card" style={{ padding: 26, width: 'min(460px,100%)', fontFamily: SANS }} onClick={e => e.stopPropagation()}>
        <div className="tt-eyebrow">Edit slot</div>
        <div className="tt-h" style={{ fontSize: 20, margin: '4px 0 2px' }}>{form.class_name}</div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 18, ...NUM }}>{form.day_name} · {form.period_name}</div>

        <label style={S.lbl}>Subject</label>
        <Input value={form.subject_name || ''} onChange={e => upd('subject_name', e.target.value)} style={{ marginBottom: 12 }} />

        <label style={S.lbl}>Teacher</label>
        <Select value={form.teacher_name || ''} onChange={e => upd('teacher_name', e.target.value)} style={{ marginBottom: 6 }}>
          <option value="">— None —</option>
          {form.teacher_name && !staffList.some(s => s.name === form.teacher_name) && <option value={form.teacher_name}>{form.teacher_name}</option>}
          {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </Select>
        {busyOn.length > 0 ? (
          <div style={{ fontSize: 11.5, color: C.rose, background: C.roseLt, borderRadius: 8, padding: '6px 9px', marginBottom: 12 }}>
            ⚠ {form.teacher_name} already teaches another batch at this time on {busyOn.join(', ')}.
          </div>
        ) : <div style={{ height: 6 }} />}

        <label style={S.lbl}>Room</label>
        <Input value={form.room_name || ''} onChange={e => upd('room_name', e.target.value)} style={{ marginBottom: 14 }} />

        <label style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 13, color: C.ink, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={allDays} onChange={e => setAllDays(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.navy700 }} />
          Apply to every day (Mon–Sat) for {form.class_name} at this time
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={saving} onClick={async () => { setSaving(true); await onSave(form, allDays); setSaving(false) }} style={{ ...S.btn.primary, flex: 1 }}>
            {saving ? 'Saving…' : allDays ? 'Save for all days' : 'Save'}
          </button>
          <button onClick={() => onDelete(form.id)} style={S.btn.iconDanger} aria-label="Delete slot" title="Delete slot">🗑</button>
          <button onClick={onClose} style={S.btn.ghost}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBSTITUTE TEACHER ENTRY SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
function SubstitutePanel({ entries, staffList, allStaff, subs, onRefresh, showToast, isAdmin }) {
  const [date, setDate] = useState(todayISO())
  const dayName = useMemo(() => {
    const d = new Date(date + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long' })
  }, [date])

  const [batch, setBatch] = useState('')
  const [period, setPeriod] = useState('')
  const [substituteTeacher, setSubstituteTeacher] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const batches = [...new Set(entries.map(e => e.class_name).filter(c => c && c !== 'ALL'))].sort()
  const periodsForBatch = entries
    .filter(e => e.class_name === batch && e.day_name === dayName)
    .map(e => e.period_name)
  const uniquePeriods = [...new Set(periodsForBatch)].sort((a, b) => periodStartMinutes(a) - periodStartMinutes(b))

  const matchedEntry = entries.find(e => e.class_name === batch && e.day_name === dayName && e.period_name === period)
  const away = useAbsences(date, allStaff)
  const suggestions = useMemo(() => !matchedEntry ? [] : suggestSubstitutes(entries, {
    day: dayName, periodName: period, subject: matchedEntry.subject_name, staff: staffList,
    absentNames: away.map(a => a.name), subsToday: subs.filter(s => s.date === date),
  }).slice(0, 6), [matchedEntry, entries, dayName, period, staffList, away, subs, date])
  const originalAway = matchedEntry?.teacher_name && away.find(a => sameTeacher(a.name, matchedEntry.teacher_name))

  const handleAddSub = async () => {
    if (!batch || !period || !substituteTeacher) { showToast('Batch, period and substitute teacher are required', 'error'); return }
    setSaving(true)
    const row = {
      date, day_name: dayName, class_name: batch, period_name: period,
      original_teacher: matchedEntry?.teacher_name || null,
      substitute_teacher: substituteTeacher, reason: reason || null,
    }
    const { error } = await supabase.from('substitute_log').insert([row])
    if (error) showToast('Error: ' + error.message, 'error')
    else {
      showToast('Substitute recorded')
      setBatch(''); setPeriod(''); setSubstituteTeacher(''); setReason('')
      onRefresh()
    }
    setSaving(false)
  }

  const handleDeleteSub = async id => {
    const { error } = await supabase.from('substitute_log').delete().eq('id', id)
    if (error) showToast('Delete failed', 'error')
    else { showToast('Removed'); onRefresh() }
  }

  const todaysSubs = subs.filter(s => s.date === date).sort((a, b) => a.class_name.localeCompare(b.class_name))

  return (
    <div style={{ fontFamily: SANS }}>
      <div style={{ background: 'white', borderRadius: 18, padding: 22, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(19,42,79,.05),0 18px 36px -28px rgba(19,42,79,.45)', marginBottom: 18 }}>
        <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700, color: C.navy900, marginBottom: 3 }}>Record a Substitute</div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 18 }}>
          Log a one-off substitution for a specific date. The recurring Mon–Sat grid is not changed.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={S.lbl}>Date *</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4 }}>{dayName}</div>
          </div>
          <div>
            <label style={S.lbl}>Batch *</label>
            <Select value={batch} onChange={e => { setBatch(e.target.value); setPeriod('') }}>
              <option value="">— Select —</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </Select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={S.lbl}>Period *</label>
            <Select value={period} onChange={e => setPeriod(e.target.value)} disabled={!batch || uniquePeriods.length === 0}>
              <option value="">
                {!batch ? '— Select a batch first —' : uniquePeriods.length === 0 ? `No classes on ${dayName}` : '— Select —'}
              </option>
              {uniquePeriods.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
            {batch && uniquePeriods.length === 0 && (
              <div style={{ fontSize: 11, color: C.rose, marginTop: 4 }}>
                {batch} has no timetable entries for {dayName}. Choose a different date or batch.
              </div>
            )}
          </div>
          <div>
            <label style={S.lbl}>Original Teacher</label>
            <Input value={matchedEntry?.teacher_name || '—'} onChange={() => {}} style={{ background: C.navy50, color: C.inkFaint }} />
          </div>
        </div>

        {matchedEntry && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 12, background: C.parchment, border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: C.goldDim, marginBottom: 6 }}>
              Free at this time{originalAway ? ` · ${matchedEntry.teacher_name} is ${originalAway.reason.toLowerCase()} in HR` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {suggestions.map(t => (
                <button key={t.name} type="button" className={'tt-chip' + (substituteTeacher === t.name ? ' on' : '')} onClick={() => { setSubstituteTeacher(t.name); if (!reason && originalAway) setReason(originalAway.reason) }}
                  title={`${t.subjectMatch ? 'Teaches this subject · ' : ''}${t.dayLoad} class${t.dayLoad === 1 ? '' : 'es'} that day`}>
                  {t.subjectMatch && <span style={{ color: C.gold }}>★</span>}{t.name}<span style={{ opacity: .7, fontWeight: 600 }}>· {t.dayLoad}</span>
                </button>
              ))}
              {!suggestions.length && <span style={{ fontSize: 12, color: C.rose }}>No teacher is free at this time.</span>}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <div>
            <label style={S.lbl}>Substitute Teacher *</label>
            <Select value={substituteTeacher} onChange={e => setSubstituteTeacher(e.target.value)}>
              <option value="">— Select —</option>
              {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
          </div>
          <div>
            <label style={S.lbl}>Reason (optional)</label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Leave, official duty…" />
          </div>
        </div>

        <button disabled={saving} onClick={handleAddSub} style={{ ...S.btn.primary, opacity: saving ? .7 : 1 }}>
          {saving ? 'Saving…' : '+ Record Substitute'}
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 18, border: `1px solid ${C.line}`, overflow: 'hidden', boxShadow: '0 1px 2px rgba(19,42,79,.05),0 18px 36px -28px rgba(19,42,79,.45)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line}`, fontFamily: SERIF, fontSize: 14, fontWeight: 700, color: C.navy900 }}>
          Substitutes for {fmtDate(date)} ({dayName})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: SANS }}>
          <thead>
            <tr style={{ background: C.navy50 }}>
              {['Batch', 'Period', 'Original', 'Substitute', 'Reason', ''].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: C.navy700, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {todaysSubs.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td style={{ padding: '10px 14px' }}><span style={S.pill(getBatchStyle(s.class_name).bg, getBatchStyle(s.class_name).text)}>{s.class_name}</span></td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{s.period_name}</td>
                <td style={{ padding: '10px 14px', color: C.inkFaint }}>{s.original_teacher || '—'}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: C.rose }}>{s.substitute_teacher}</td>
                <td style={{ padding: '10px 14px', color: C.inkFaint }}>{s.reason || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  {isAdmin && <button onClick={() => handleDeleteSub(s.id)} style={S.btn.iconDanger}>🗑</button>}
                </td>
              </tr>
            ))}
            {!todaysSubs.length && (
              <tr><td colSpan={6} style={{ padding: 36, textAlign: 'center', color: C.inkFaint }}>No substitutes recorded for this date</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// HR DATA — who is away on a date: attendance marked Absent/Leave in HR, plus
// approved leave covering the date. Used by Today and the substitute suggestions.
// ══════════════════════════════════════════════════════════════════════════════
function useAbsences(date, allStaff) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    let live = true
    ;(async () => {
      const [att, lv] = await Promise.all([
        supabase.from('attendance_logs').select('staff_id,status').eq('date', date).in('status', ['Absent', 'Leave']),
        supabase.from('leaves').select('staff_id,status,start_date,end_date').lte('start_date', date).gte('end_date', date),
      ])
      if (!live) return
      const byId = new Map()
      for (const r of att.data || []) byId.set(String(r.staff_id), r.status === 'Leave' ? 'On leave' : 'Absent')
      for (const r of lv.data || []) if (/approved/i.test(r.status || '') && !byId.has(String(r.staff_id))) byId.set(String(r.staff_id), 'On approved leave')
      setRows([...byId.entries()].map(([id, reason]) => {
        const st = allStaff.find(s => String(s.id) === id)
        return st ? { id, name: st.name, designation: st.designation, reason } : null
      }).filter(Boolean))
    })().catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [date, allStaff])
  return rows
}

const initials = n => String(n || '?').replace(/^(sir|madam|mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
const fmtMinutes = m => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

function useClock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 30000); return () => clearInterval(id) }, [])
  return t
}

// One-tap substitute: writes the same substitute_log row the form does.
async function recordSubstitute({ date, entry, teacher, reason }) {
  return supabase.from('substitute_log').insert([{
    date, day_name: entry.day_name, class_name: entry.class_name, period_name: entry.period_name,
    original_teacher: entry.teacher_name || null, substitute_teacher: teacher, reason: reason || null,
  }])
}

// ══════════════════════════════════════════════════════════════════════════════
// TODAY — live board: what every batch has now and next, and cover for teachers away
// ══════════════════════════════════════════════════════════════════════════════
function TodayBoard({ entries, batches, subs, staffList, allStaff, isAdmin, showToast, onRefresh }) {
  const clock = useClock()
  // on a Sunday the board opens on Monday, the next school day
  const [date, setDate] = useState(() => dayOf(todayISO()) === 'Sunday' ? addDaysISO(todayISO(), 1) : todayISO())
  const isToday = date === todayISO()
  const day = dayOf(date)
  const minutes = isToday ? clock.getHours() * 60 + clock.getMinutes() : -1
  const away = useAbsences(date, allStaff)
  const subsOn = subs.filter(s => s.date === date)
  const subFor = e => subsOn.find(s => s.class_name === e.class_name && s.period_name === e.period_name)
  const awayName = t => away.find(a => sameTeacher(a.name, t))
  const [busy, setBusy] = useState('')

  const assign = async (entry, teacher, reason) => {
    setBusy(entry.class_name + entry.period_name)
    const { error } = await recordSubstitute({ date, entry, teacher, reason })
    setBusy('')
    if (error) showToast('Could not record the substitute: ' + error.message, 'error')
    else { showToast(`${teacher} covers ${entry.class_name} · ${entry.period_name}`); onRefresh() }
  }

  if (day === 'Sunday') return (
    <div className="tt-card" style={{ padding: 40, textAlign: 'center' }}>
      <div className="tt-h" style={{ fontSize: 20 }}>Sunday — no classes</div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Input type="date" value={date} onChange={e => setDate(e.target.value || todayISO())} style={{ maxWidth: 200 }} />
        <button style={S.btn.primary} onClick={() => setDate(addDaysISO(date, 1))}>Show Monday</button>
      </div>
    </div>
  )

  // classes today whose teacher is away
  const affected = away.map(a => ({
    ...a,
    classes: entries.filter(e => e.day_name === day && !isWholeInstituteEntry(e) && e.teacher_name && sameTeacher(e.teacher_name, a.name))
      .sort((x, y) => periodStartMinutes(x.period_name) - periodStartMinutes(y.period_name)),
  })).filter(a => a.classes.length)
  const needCover = affected.reduce((n, a) => n + a.classes.filter(c => !subFor(c)).length, 0)

  return (
    <div>
      <div className="tt-card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="tt-eyebrow">{isToday ? 'Live' : 'Planning'}</div>
          <div className="tt-h" style={{ fontSize: 22 }}>{day}, {fmtDate(date)}</div>
        </div>
        {isToday && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 99, background: C.navy50 }}>
            <span className="tt-live" />
            <span className="tt-time" style={{ fontSize: 18 }}>{fmtMinutes(minutes)}</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input type="date" value={date} onChange={e => setDate(e.target.value || todayISO())} style={{ width: 170 }} />
          {!isToday && <button style={S.btn.ghost} onClick={() => setDate(todayISO())}>Today</button>}
        </div>
      </div>

      {/* teachers away and their classes */}
      <div className="tt-card" style={{ padding: 18, marginBottom: 16, borderLeft: `4px solid ${needCover ? C.rose : C.emerald}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: affected.length ? 12 : 0 }}>
          <div className="tt-h" style={{ fontSize: 16 }}>Teachers away</div>
          <div style={{ fontSize: 12.5, color: needCover ? C.rose : C.emerald, fontWeight: 700 }}>
            {affected.length ? (needCover ? `${needCover} class${needCover === 1 ? '' : 'es'} need cover` : 'All classes covered') : 'Nobody with classes is marked absent or on leave in HR'}
          </div>
        </div>
        {affected.map(a => (
          <div key={a.id} style={{ borderTop: `1px solid ${C.line}`, padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="tt-avatar" style={{ background: C.rose }}>{initials(a.name)}</span>
              <div><div style={{ fontWeight: 700 }}>{a.name}</div><div style={{ fontSize: 11.5, color: C.inkSoft }}>{a.reason}{a.designation ? ` · ${a.designation}` : ''}</div></div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {a.classes.map(c => {
                const done = subFor(c)
                const sugg = done ? [] : suggestSubstitutes(entries, { day, periodName: c.period_name, subject: c.subject_name, staff: staffList, absentNames: away.map(x => x.name), subsToday: subsOn }).slice(0, 3)
                return (
                  <div key={c.class_name + c.period_name} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10, background: done ? C.emeraldLt : C.parchment }}>
                    <span className="tt-time" style={{ fontSize: 12.5, minWidth: 140 }}>{c.period_name}</span>
                    <span style={S.pill(getBatchStyle(c.class_name).bg, getBatchStyle(c.class_name).text)}>{c.class_name}</span>
                    <span style={{ fontSize: 12.5 }}>{c.subject_name}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {done ? <b style={{ color: C.emerald, fontSize: 12.5 }}>✓ {done.substitute_teacher}</b>
                        : sugg.length ? sugg.map(t => (
                          <button key={t.name} disabled={!isAdmin || !!busy} onClick={() => assign(c, t.name, a.reason)} className="tt-chip"
                            title={`${t.subjectMatch ? 'Teaches this subject · ' : ''}${t.dayLoad} class${t.dayLoad === 1 ? '' : 'es'} that day`}>
                            {t.subjectMatch && <span style={{ color: C.gold }}>★</span>}{t.name}<span style={{ color: C.inkFaint, fontWeight: 600 }}>· {t.dayLoad}</span>
                          </button>
                        )) : <span style={{ fontSize: 12, color: C.rose }}>No free teacher at this time</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {affected.length > 0 && !isAdmin && <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 6 }}>Only admins can assign a substitute.</div>}
        {affected.length > 0 && isAdmin && <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 6 }}>★ teaches this subject · the number is classes that teacher already has that day. Tap a name to record the substitute.</div>}
      </div>

      {/* every batch: now and next */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
        {batches.map(b => {
          const st = getBatchStyle(b)
          const { now, next, rows } = nowAndNext(entries, { day, batch: b, minutes: isToday ? minutes : -1 })
          const show = isToday ? now : rows[0]
          const left = now ? Math.max(0, now.span.end - minutes) : 0
          const pct = now && now.span.end > now.span.start ? Math.min(100, Math.round(((minutes - now.span.start) / (now.span.end - now.span.start)) * 100)) : 0
          const coverOf = e => e && subFor(e)
          const awayOf = e => e && e.teacher_name && !isWholeInstituteEntry(e) && awayName(e.teacher_name)
          return (
            <div key={b} className="tt-card" style={{ padding: 16, borderTop: `4px solid ${st.dot}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: st.dot }} />
                <div className="tt-h" style={{ fontSize: 16 }}>{b}</div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: C.inkFaint }}>{rows.filter(r => !isWholeInstituteEntry(r)).length} classes</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: C.inkFaint, textTransform: 'uppercase' }}>{isToday ? (now ? 'Now' : 'Now — free') : 'First'}</div>
              {show ? (
                <div style={{ margin: '4px 0 10px' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: isWholeInstituteEntry(show) ? C.navy900 : st.text }}>{show.subject_name}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, ...NUM }}>{show.period_name}{show.teacher_name ? ` · ${coverOf(show) ? coverOf(show).substitute_teacher + ' (cover)' : show.teacher_name}` : ''}</div>
                  {awayOf(show) && !coverOf(show) && <div style={{ fontSize: 11.5, color: C.rose, fontWeight: 700, marginTop: 3 }}>Teacher away — needs cover</div>}
                  {isToday && now && <div className="tt-bar" style={{ marginTop: 8 }}><b style={{ width: pct + '%' }} /></div>}
                  {isToday && now && <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4, ...NUM }}>{left} min left</div>}
                </div>
              ) : <div style={{ fontSize: 12.5, color: C.inkFaint, margin: '4px 0 10px' }}>{isToday ? 'Between classes' : 'No classes'}</div>}
              {isToday && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: C.inkFaint, textTransform: 'uppercase' }}>Next</div>
                  {next ? (
                    <div style={{ marginTop: 3 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{next.subject_name}</div>
                      <div style={{ fontSize: 11.5, color: C.inkSoft, ...NUM }}>at {fmtMinutes(next.span.start)}{next.teacher_name ? ` · ${coverOf(next) ? coverOf(next).substitute_teacher + ' (cover)' : next.teacher_name}` : ''}</div>
                      {awayOf(next) && !coverOf(next) && <div style={{ fontSize: 11.5, color: C.rose, fontWeight: 700 }}>Teacher away — needs cover</div>}
                    </div>
                  ) : <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 3 }}>Done for the day</div>}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TEACHERS — weekly load for everyone, and one teacher's own timetable
// ══════════════════════════════════════════════════════════════════════════════
function TeacherWeek({ entries, teacher }) {
  const mine = entries.filter(e => !isWholeInstituteEntry(e) && e.teacher_name && sameTeacher(e.teacher_name, teacher.name))
  const periods = [...new Set(mine.map(e => e.period_name))].sort((a, b) => periodStartMinutes(a) - periodStartMinutes(b))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tt-grid" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ padding: '10px 12px', textAlign: 'left', background: C.parchment, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: C.inkFaint, borderBottom: `2px solid ${C.gold}` }}>Time</th>
            {DAYS.map(d => <th key={d} style={{ padding: '10px 8px', textAlign: 'left', background: C.parchment, fontSize: 12.5, color: C.navy900, minWidth: 130, borderBottom: `2px solid ${C.gold}` }}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {periods.map(p => (
            <tr key={p}>
              <td style={{ padding: '8px 12px', borderBottom: `1px solid ${C.line}` }}><span className="tt-time" style={{ fontSize: 12.5 }}>{p}</span></td>
              {DAYS.map(d => {
                const here = mine.filter(e => e.day_name === d && e.period_name === p)
                if (!here.length) return <td key={d} style={{ padding: 6 }}><div style={{ minHeight: 48, borderRadius: 10, border: `1px dashed ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.inkFaint }}>Free</div></td>
                const st = getBatchStyle(here[0].class_name)
                // several batches at once: the same subject is a joint class, different subjects a clash
                const clash = new Set(here.map(e => String(e.subject_name || '').trim().toLowerCase())).size > 1
                return (
                  <td key={d} style={{ padding: 6 }}>
                    <div className="tt-slot" style={clash ? { '--dot': C.rose, background: C.roseLt, border: `1px solid #f0c4c0`, minHeight: 48 } : { '--dot': st.dot, background: st.bg, border: `1px solid ${st.border}`, minHeight: 48 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: clash ? C.rose : st.text }}>{here.map(e => e.class_name).join(' + ')}</div>
                      <div style={{ fontSize: 11, color: clash ? C.rose : st.text, opacity: .85 }}>
                        {clash ? `Clash: ${here.map(e => e.subject_name).join(' / ')}` : `${here[0].subject_name}${here.length > 1 ? ' · joint class' : ''}`}
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
          {!periods.length && <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: C.inkFaint }}>No classes for this teacher</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function TeacherBoard({ entries, staffList }) {
  const load = useMemo(() => teacherLoad(entries, staffList), [entries, staffList])
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const max = Math.max(1, ...load.map(t => t.total))
  const shown = load.filter(t => !q || [t.name, ...t.names, t.staff?.name || ''].join(' ').toLowerCase().includes(q.toLowerCase()))
  const sel = pick && load.find(t => t.name === pick)
  const avg = load.length ? Math.round(load.reduce((n, t) => n + t.total, 0) / load.length) : 0
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {sel && (
        <div className="tt-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="tt-avatar" style={{ width: 42, height: 42, fontSize: 15 }}>{initials(sel.name)}</span>
            <div>
              <div className="tt-h" style={{ fontSize: 20 }}>{sel.staff?.name || sel.name}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{sel.total} periods a week · busiest day {sel.maxDay} · {sel.batches.length} batches{sel.names.length > 1 ? ` · listed as ${sel.names.join(', ')}` : ''}</div>
            </div>
            <button style={{ ...S.btn.ghost, marginLeft: 'auto' }} onClick={() => setPick(null)}>Close</button>
          </div>
          <TeacherWeek entries={entries} teacher={sel} />
        </div>
      )}
      <div className="tt-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div className="tt-h" style={{ fontSize: 17 }}>Teaching load</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>{load.length} teachers · {avg} periods a week on average. A joint class counts once.</div>
          </div>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search teacher…" style={{ maxWidth: 240, marginLeft: 'auto' }} />
        </div>
        <div style={{ display: 'grid', gap: 2 }}>
          {shown.map(t => (
            <button key={t.name} onClick={() => setPick(t.name)}
              style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1.3fr) minmax(0,1fr) auto', gap: 12, alignItems: 'center', textAlign: 'left', padding: '10px 8px', border: 'none', borderBottom: `1px solid ${C.line}`, background: pick === t.name ? C.goldLt : 'transparent', cursor: 'pointer', borderRadius: 8 }}>
              <span className="tt-avatar">{initials(t.name)}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, color: C.ink }}>{t.staff?.name || t.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: C.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subjects.slice(0, 3).join(' · ')}{t.subjects.length > 3 ? ' …' : ''}</span>
              </span>
              <span className="tt-hide-sm" style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }} title="Periods each day, Monday to Saturday">
                {DAYS.map(d => <span key={d} style={{ width: 10, height: `${Math.max(3, (t.perDay[d] / Math.max(1, ...load.map(x => x.maxDay))) * 28)}px`, borderRadius: 3, background: t.perDay[d] ? C.navy500 : C.line }} />)}
              </span>
              <span style={{ minWidth: 110 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: C.navy900, ...NUM }}>{t.total}<span style={{ color: C.inkFaint, fontWeight: 600 }}>/ week</span></span>
                <span className="tt-bar" style={{ display: 'block', marginTop: 4 }}><b style={{ width: `${(t.total / max) * 100}%` }} /></span>
              </span>
            </button>
          ))}
          {!shown.length && <div style={{ padding: 30, textAlign: 'center', color: C.inkFaint }}>No teacher matches “{q}”.</div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CLASHES — a teacher in two places at once; joint classes listed separately
// ══════════════════════════════════════════════════════════════════════════════
function ClashItem({ c, isAdmin, onEdit }) {
  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <span className="tt-avatar" style={c.kind === 'clash' ? { background: C.rose } : undefined}>{initials(c.teacher)}</span>
        <b>{c.teacher}</b><span style={{ fontSize: 12.5, color: C.inkSoft }}>{c.day}</span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {c.entries.map(e => (
          <div key={e.id || e.class_name + e.period_name} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '7px 10px', borderRadius: 10, background: C.parchment }}>
            <span className="tt-time" style={{ fontSize: 12.5, minWidth: 140 }}>{e.period_name}</span>
            <span style={S.pill(getBatchStyle(e.class_name).bg, getBatchStyle(e.class_name).text)}>{e.class_name}</span>
            <span style={{ fontSize: 12.5 }}>{e.subject_name}</span>
            {isAdmin && e.id && <button style={{ ...S.btn.icon, marginLeft: 'auto' }} onClick={() => onEdit(e)}>Edit</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ClashBoard({ clashes, isAdmin, onEdit }) {
  const real = clashes.filter(c => c.kind === 'clash'), joint = clashes.filter(c => c.kind === 'joint')
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="tt-card" style={{ padding: 18, borderLeft: `4px solid ${real.length ? C.rose : C.emerald}` }}>
        <div className="tt-h" style={{ fontSize: 17 }}>{real.length ? `${real.length} clash${real.length === 1 ? '' : 'es'}` : 'No clashes'}</div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: real.length ? 6 : 0 }}>
          {real.length ? 'The same teacher is timetabled for different classes at overlapping times. Edit one of them, or record a substitute for the day.' : 'No teacher is timetabled in two different classes at once.'}
        </div>
        {real.map((c, i) => <ClashItem key={'c' + i} c={c} isAdmin={isAdmin} onEdit={onEdit} />)}
      </div>
      {joint.length > 0 && (
        <div className="tt-card" style={{ padding: 18 }}>
          <div className="tt-h" style={{ fontSize: 17 }}>{joint.length} joint class{joint.length === 1 ? '' : 'es'}</div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 6 }}>Batches sitting together with one teacher for the same subject. Listed so you can confirm they are intended.</div>
          {joint.map((c, i) => <ClashItem key={'j' + i} c={c} isAdmin={isAdmin} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ══════════════════════════════════════════════════════════════════════════════
const REPORT_KINDS = [
  { id: 'batch', label: 'Batch Timetable', desc: 'Full Mon–Sat schedule for one batch' },
  { id: 'master', label: 'Master Timetable', desc: 'All batches, full week, single document' },
  { id: 'teacher', label: 'Teacher Timetable', desc: 'One teacher’s week, joint classes marked' },
  { id: 'workload', label: 'Workload Summary', desc: 'Periods per teacher, day by day' },
  { id: 'substitute', label: 'Substitute Log', desc: 'Substitute records over a date range' },
]

function ReportGenerator({ entries, subs, batches, staffList = [] }) {
  const [kind, setKind] = useState('master')
  const [batch, setBatch] = useState(batches[0] || '')
  const load = useMemo(() => teacherLoad(entries, staffList), [entries, staffList])
  const [teacherName, setTeacherName] = useState('')
  const teacher = load.find(t => t.name === teacherName) || load[0]
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const printRef = useRef(null)

  const handlePrint = () => {
    const printContents = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=1000,height=1300')
    win.document.write(`
      <html><head><title>${INSTITUTE.short} Report</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap">
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: ${SANS}; margin: 0; background: white; color: ${C.ink}; }
        table { width: 100%; border-collapse: collapse; }
        th, td { font-size: 11px; font-variant-numeric: tabular-nums; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
      </head><body>${printContents}</body></html>
    `)
    win.document.close()
    // wait for the fonts so the printout uses them, not a fallback
    const go = () => { win.focus(); win.print() }
    setTimeout(() => { try { (win.document.fonts?.ready || Promise.resolve()).then(go) } catch { go() } }, 400)
  }

  const periodsFor = b => {
    const seen = new Map()
    entries.filter(e => e.class_name === b || e.class_name === 'ALL').forEach(e => { if (!seen.has(e.period_name)) seen.set(e.period_name, true) })
    return [...seen.keys()].sort((a, b2) => periodStartMinutes(a) - periodStartMinutes(b2))
  }

  const filteredSubs = subs.filter(s => s.date >= dateFrom && s.date <= dateTo).sort((a, b) => a.date.localeCompare(b.date) || a.class_name.localeCompare(b.class_name))

  return (
    <div style={{ fontFamily: SANS }}>
      <div style={{ background: 'white', borderRadius: 18, padding: 22, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(19,42,79,.05),0 18px 36px -28px rgba(19,42,79,.45)', marginBottom: 20 }}>
        <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700, color: C.navy900, marginBottom: 3 }}>Report Generator</div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 18 }}>
          Produces a print-ready document with the {INSTITUTE.short} letterhead. Use your browser's Print dialog to save as PDF.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {REPORT_KINDS.map(k => (
            <button key={k.id} onClick={() => setKind(k.id)}
              style={{
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${kind === k.id ? C.navy900 : C.line}`,
                background: kind === k.id ? C.navy900 : 'white', color: kind === k.id ? C.gold : C.navy700,
                cursor: 'pointer', fontFamily: SANS, textAlign: 'left', minWidth: 200,
              }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{k.label}</div>
              <div style={{ fontSize: 10.5, opacity: .8, marginTop: 2 }}>{k.desc}</div>
            </button>
          ))}
        </div>

        {kind === 'batch' && (
          <div style={{ marginBottom: 18 }}>
            <label style={S.lbl}>Batch</label>
            <Select value={batch} onChange={e => setBatch(e.target.value)} style={{ maxWidth: 260 }}>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </Select>
          </div>
        )}
        {kind === 'teacher' && (
          <div style={{ marginBottom: 18 }}>
            <label style={S.lbl}>Teacher</label>
            <Select value={teacher?.name || ''} onChange={e => setTeacherName(e.target.value)} style={{ maxWidth: 300 }}>
              {load.map(t => <option key={t.name} value={t.name}>{t.staff?.name || t.name} — {t.total}/week</option>)}
            </Select>
          </div>
        )}
        {kind === 'substitute' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18, maxWidth: 500 }}>
            <div><label style={S.lbl}>From</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div><label style={S.lbl}>To</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          </div>
        )}

        <button onClick={handlePrint} style={S.btn.gold}>🖨 Generate & Print Report</button>
      </div>

      <div style={{ background: C.parchment, borderRadius: 18, border: `1px solid ${C.line}`, padding: 24, boxShadow: '0 1px 2px rgba(19,42,79,.05),0 18px 36px -28px rgba(19,42,79,.45)' }}>
        <div ref={printRef}>
          {kind === 'batch' && (
            <div>
              <Letterhead reportTitle="Batch Timetable" reportMeta={`${batch} Batch · Monday – Saturday`} />
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', background: C.navy900, color: C.gold, border: `1px solid ${C.navy900}` }}>Time</th>
                    {DAYS.map(d => <th key={d} style={{ padding: '8px 10px', textAlign: 'left', background: C.navy900, color: 'white', border: `1px solid ${C.navy900}` }}>{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {periodsFor(batch).map((p, i) => (
                    <tr key={p} style={{ background: i % 2 === 0 ? 'white' : C.navy50 }}>
                      <td style={{ padding: '7px 10px', fontWeight: 700, border: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{p}</td>
                      {DAYS.map(d => {
                        const e = entries.find(en => en.period_name === p && en.day_name === d && (en.class_name === batch || en.class_name === 'ALL'))
                        if (isWholeInstituteEntry(e)) return (
                          <td key={d} style={{ padding: '7px 10px', border: `1px solid ${C.navy900}`, background: C.navy900, color: C.gold, textAlign: 'center', fontWeight: 700 }}>{e.subject_name}</td>
                        )
                        return (
                          <td key={d} style={{ padding: '7px 10px', border: `1px solid ${C.line}` }}>
                            {e ? (
                              <>
                                <div style={{ fontWeight: 700 }}>{e.subject_name}</div>
                                {e.teacher_name && <div style={{ fontSize: 10, color: C.inkSoft }}>{e.teacher_name}</div>}
                              </>
                            ) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <ReportFooter generatedAt={new Date().toLocaleString('en-IN')} />
            </div>
          )}

          {kind === 'teacher' && teacher && (
            <div>
              <Letterhead reportTitle="Teacher Timetable" reportMeta={`${teacher.staff?.name || teacher.name} · ${teacher.total} periods a week · Monday – Saturday`} />
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', background: C.navy900, color: C.gold, border: `1px solid ${C.navy900}` }}>Time</th>
                    {DAYS.map(d => <th key={d} style={{ padding: '8px 10px', textAlign: 'left', background: C.navy900, color: 'white', border: `1px solid ${C.navy900}` }}>{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(entries.filter(e => !isWholeInstituteEntry(e) && e.teacher_name && sameTeacher(e.teacher_name, teacher.name)).map(e => e.period_name))]
                    .sort((a, b) => periodStartMinutes(a) - periodStartMinutes(b)).map((p, i) => (
                    <tr key={p} style={{ background: i % 2 === 0 ? 'white' : C.navy50 }}>
                      <td style={{ padding: '7px 10px', fontWeight: 700, border: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{p}</td>
                      {DAYS.map(d => {
                        const here = entries.filter(e => e.day_name === d && e.period_name === p && !isWholeInstituteEntry(e) && e.teacher_name && sameTeacher(e.teacher_name, teacher.name))
                        return (
                          <td key={d} style={{ padding: '7px 10px', border: `1px solid ${C.line}` }}>
                            {here.length ? (<><div style={{ fontWeight: 700 }}>{here.map(e => e.class_name).join(' + ')}</div><div style={{ fontSize: 10, color: C.inkSoft }}>{here[0].subject_name}{here.length > 1 ? ' (joint)' : ''}</div></>) : <span style={{ color: C.inkFaint }}>Free</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <ReportFooter generatedAt={new Date().toLocaleString('en-IN')} />
            </div>
          )}

          {kind === 'workload' && (
            <div>
              <Letterhead reportTitle="Teaching Workload Summary" reportMeta={`${load.length} teachers · periods per day, Monday – Saturday (a joint class counts once)`} />
              <table>
                <thead>
                  <tr>
                    {['Teacher', ...DAYS.map(d => d.slice(0, 3)), 'Total', 'Batches', 'Subjects'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', background: C.navy900, color: h === 'Teacher' ? C.gold : 'white', border: `1px solid ${C.navy900}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {load.map((t, i) => (
                    <tr key={t.name} style={{ background: i % 2 === 0 ? 'white' : C.navy50 }}>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}`, fontWeight: 700 }}>{t.staff?.name || t.name}</td>
                      {DAYS.map(d => <td key={d} style={{ padding: '7px 10px', border: `1px solid ${C.line}`, textAlign: 'center' }}>{t.perDay[d] || '–'}</td>)}
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}`, textAlign: 'center', fontWeight: 800 }}>{t.total}</td>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}`, fontSize: 10 }}>{t.batches.join(', ')}</td>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}`, fontSize: 10 }}>{t.subjects.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ReportFooter generatedAt={new Date().toLocaleString('en-IN')} />
            </div>
          )}

          {kind === 'master' && (
            <div>
              <Letterhead reportTitle="Master Timetable" reportMeta="All Batches · Monday – Saturday" />
              {batches.map(b => (
                <div key={b} style={{ marginBottom: 22, breakInside: 'avoid' }}>
                  <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 700, color: C.navy900, marginBottom: 6, borderBottom: `2px solid ${C.gold}`, display: 'inline-block', paddingBottom: 2 }}>{b} Batch</div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ padding: '6px 9px', textAlign: 'left', background: C.navy900, color: C.gold, border: `1px solid ${C.navy900}`, fontSize: 10 }}>Time</th>
                        {DAYS.map(d => <th key={d} style={{ padding: '6px 9px', textAlign: 'left', background: C.navy900, color: 'white', border: `1px solid ${C.navy900}`, fontSize: 10 }}>{d.slice(0, 3)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {periodsFor(b).map((p, i) => (
                        <tr key={p} style={{ background: i % 2 === 0 ? 'white' : C.navy50 }}>
                          <td style={{ padding: '5px 9px', fontWeight: 700, border: `1px solid ${C.line}`, whiteSpace: 'nowrap', fontSize: 10 }}>{p}</td>
                          {DAYS.map(d => {
                            const e = entries.find(en => en.period_name === p && en.day_name === d && (en.class_name === b || en.class_name === 'ALL'))
                            if (isWholeInstituteEntry(e)) return (
                              <td key={d} style={{ padding: '5px 9px', border: `1px solid ${C.navy900}`, background: C.navy900, color: C.gold, textAlign: 'center', fontWeight: 700, fontSize: 10 }}>{e.subject_name}</td>
                            )
                            return (
                              <td key={d} style={{ padding: '5px 9px', border: `1px solid ${C.line}`, fontSize: 10 }}>
                                {e ? `${e.subject_name}${e.teacher_name ? ' — ' + e.teacher_name : ''}` : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <ReportFooter generatedAt={new Date().toLocaleString('en-IN')} />
            </div>
          )}

          {kind === 'substitute' && (
            <div>
              <Letterhead reportTitle="Substitute Teacher Log" reportMeta={`${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`} />
              <table>
                <thead>
                  <tr>
                    {['Date', 'Day', 'Batch', 'Period', 'Original Teacher', 'Substitute Teacher', 'Reason'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', background: C.navy900, color: 'white', border: `1px solid ${C.navy900}`, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map((s, i) => (
                    <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : C.navy50 }}>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}` }}>{fmtDate(s.date)}</td>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}` }}>{s.day_name}</td>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}` }}>{s.class_name}</td>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{s.period_name}</td>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}` }}>{s.original_teacher || '—'}</td>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}`, fontWeight: 700 }}>{s.substitute_teacher}</td>
                      <td style={{ padding: '7px 10px', border: `1px solid ${C.line}` }}>{s.reason || '—'}</td>
                    </tr>
                  ))}
                  {!filteredSubs.length && (
                    <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: C.inkFaint, border: `1px solid ${C.line}` }}>No substitute records in this date range</td></tr>
                  )}
                </tbody>
              </table>
              <ReportFooter generatedAt={new Date().toLocaleString('en-IN')} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN SETUP
// ══════════════════════════════════════════════════════════════════════════════
function AdminSetup({ entries, onRefresh, showToast }) {
  const [seeding, setSeeding] = useState(false)
  const seedCount = buildSeedRows().length

  const handleSeed = async () => {
    if (!window.confirm(`This will replace the entire Mon–Sat timetable with the standard schedule (${seedCount} slots). Continue?`)) return
    setSeeding(true)
    const { error: delErr } = await supabase.from('timetable_master').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (delErr) { showToast('Clear failed: ' + delErr.message, 'error'); setSeeding(false); return }
    const rows = buildSeedRows()
    const CHUNK = 200
    let total = 0
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { error } = await supabase.from('timetable_master').insert(chunk)
      if (error) { showToast(`Import failed: ${error.message}`, 'error'); setSeeding(false); return }
      total += chunk.length
    }
    showToast(`Loaded ${total} slots`)
    onRefresh()
    setSeeding(false)
  }

  return (
    <div style={{ background: 'white', borderRadius: 18, padding: 24, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(19,42,79,.05),0 18px 36px -28px rgba(19,42,79,.45)', fontFamily: SANS }}>
      <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700, color: C.navy900, marginBottom: 3 }}>Setup Timetable</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 18 }}>
        Currently {entries.length} slots stored, repeating every Monday–Saturday. Loading the standard schedule replaces everything below.
      </div>
      <div style={{ padding: '10px 14px', background: C.goldLt, borderRadius: 7, fontSize: 12, color: C.goldDim, fontWeight: 600, marginBottom: 18, border: `1px solid ${C.gold}` }}>
        ⚠ This clears and reloads the full weekly grid ({seedCount} slots). Substitute records are not affected.
      </div>
      <button disabled={seeding} onClick={handleSeed} style={{ ...S.btn.primary, opacity: seeding ? .7 : 1 }}>
        {seeding ? 'Loading…' : 'Load Standard Mon–Sat Schedule'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const fetchTimetable = () => Promise.all([
  supabase.from('timetable_master').select('*'),
  supabase.from('substitute_log').select('*').order('date', { ascending: false }),
])

// embedded: shown as a section of HR (no page background, HR keeps the outer frame)
export default function Timetable({ currentUser, embedded = false }) {
  const isAdmin = isAdminRole(currentUser?.role)
  const [entries, setEntries] = useState([])
  const [subs, setSubs] = useState([])
  const [staffList, setStaffList] = useState([])
  const [allStaff, setAllStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('today')
  const [activeBatch, setActiveBatch] = useState('ALL_BATCHES')
  const [editingEntry, setEditingEntry] = useState(null)
  const [toast, setToast] = useState(null)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const clock = useClock()

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200) }

  const apply = ([{ data: tt, error: e1 }, { data: sb, error: e2 }]) => {
    if (!e1) setEntries(tt || [])
    if (!e2) setSubs(sb || [])
    setLoading(false)
  }
  // refreshes keep the current grid on screen until the new rows arrive
  const loadData = () => fetchTimetable().then(apply)

  useEffect(() => {
    let live = true
    fetchTimetable().then(r => { if (live) apply(r) })
    staffDB.forTimetable().then(d => { if (live) setStaffList(d || []) })
    // every staff member (not only teaching staff), to read HR attendance and leave by id
    supabase.from('staff_profiles').select('id, name, designation, department, status').order('name')
      .then(({ data }) => { if (live) setAllStaff(data || []) }, () => { if (live) setAllStaff([]) })
    return () => { live = false }
  }, [])

  const batches = [...new Set(entries.map(e => e.class_name).filter(c => c && c !== 'ALL'))].sort()
  const now = useMemo(() => ({ day: clock.toLocaleDateString('en-US', { weekday: 'long' }), minutes: clock.getHours() * 60 + clock.getMinutes() }), [clock])
  const clashes = useMemo(() => findClashes(entries), [entries])
  const realClashes = clashes.filter(c => c.kind === 'clash').length
  const teachers = useMemo(() => teacherLoad(entries, staffList), [entries, staffList])
  const weeklyClasses = useMemo(() => entries.filter(e => !isWholeInstituteEntry(e) && e.teacher_name).length, [entries])
  const subsToday = subs.filter(s => s.date === todayISO()).length

  const subMap = useMemo(() => {
    const today = todayISO()
    const m = new Map()
    subs.filter(s => s.date === today).forEach(s => m.set(`${s.day_name}|${s.class_name}|${s.period_name}`, s))
    return m
  }, [subs])

  const handleSaveEntry = async (form, allDays) => {
    const fields = { subject_name: form.subject_name, teacher_name: form.teacher_name || null, room_name: form.room_name || null }
    const q = supabase.from('timetable_master').update(fields)
    const { error } = allDays
      ? await q.eq('class_name', form.class_name).eq('period_name', form.period_name).in('day_name', DAYS)
      : await q.eq('id', form.id)
    if (error) showToast('Save failed: ' + error.message, 'error')
    else { showToast(allDays ? `Updated ${form.class_name} · ${form.period_name} for every day` : 'Updated'); setEditingEntry(null); loadData() }
  }

  const handleDeleteEntry = async id => {
    if (!window.confirm('Delete this slot?')) return
    const { error } = await supabase.from('timetable_master').delete().eq('id', id)
    if (error) showToast('Delete failed', 'error')
    else { showToast('Deleted'); setEditingEntry(null); loadData() }
  }

  const navTabs = [
    { id: 'today', label: 'Today' },
    { id: 'grid', label: 'Weekly' },
    { id: 'teachers', label: 'Teachers' },
    { id: 'substitute', label: 'Substitutes', badge: subsToday },
    { id: 'clashes', label: 'Clashes', badge: realClashes },
    { id: 'reports', label: 'Reports' },
    ...(isAdmin ? [{ id: 'admin', label: 'Setup' }] : []),
  ]
  const pickTab = id => {
    if (id === 'admin' && !isAdmin && !adminUnlocked) { setShowPinModal(true); return }
    setTab(id)
  }

  return (
    <div className="px-root tt-root" style={embedded ? { background: 'transparent', minHeight: 'auto', fontFamily: SANS } : { padding: 'clamp(12px,3vw,24px)', background: C.parchment, minHeight: '100vh', fontFamily: SANS }}>
      <PremiumStyles />
      <style>{TT_CSS}</style>
      <Toast toast={toast} />
      {showPinModal && (
        <PinModal onClose={() => setShowPinModal(false)} onSuccess={() => { setAdminUnlocked(true); setShowPinModal(false); setTab('admin') }} />
      )}
      {editingEntry && (
        <EditEntryModal entry={editingEntry} entries={entries} staffList={staffList} onClose={() => setEditingEntry(null)} onSave={handleSaveEntry} onDelete={handleDeleteEntry} />
      )}

      <PremiumHero eyebrow={`${INSTITUTE.short} · ${embedded ? 'HR' : 'Academic'}`} title="Time Table"
        subtitle={`Monday–Saturday schedule · ${now.day === 'Sunday' ? 'No classes today' : `${now.day}, ${fmtMinutes(now.minutes)}`}`}
        icon={<Crest size={34} />}
        actions={<span className="px-hbtn" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="tt-live" /> Live</span>}
        stats={entries.length ? [
          { label: 'Batches', value: batches.length, sub: 'Mon–Sat', onClick: () => setTab('grid') },
          { label: 'Teachers', value: teachers.length, sub: `${weeklyClasses} classes a week`, onClick: () => setTab('teachers') },
          { label: 'Substitutes', value: subsToday, sub: 'Today', onClick: () => setTab('substitute') },
          { label: 'Clashes', value: realClashes, sub: realClashes ? 'Need attention' : 'All clear', onClick: () => setTab('clashes') },
        ] : []} />

      <PremiumTabs tabs={navTabs} active={tab} onChange={pickTab} />

      {loading ? (
        <div className="tt-card" style={{ padding: 60, textAlign: 'center', color: C.inkFaint }}>
          <div className="tt-h" style={{ fontSize: 16 }}>Loading timetable…</div>
        </div>
      ) : !entries.length && tab !== 'admin' && tab !== 'substitute' && tab !== 'reports' ? (
        <div className="tt-card" style={{ padding: 60, textAlign: 'center', color: C.inkFaint }}>
          <div className="tt-h" style={{ fontSize: 18, marginBottom: 6 }}>No timetable loaded yet</div>
          <div style={{ fontSize: 13 }}>{isAdmin ? 'Open Setup to load the standard schedule.' : 'Ask an admin to set up the timetable.'}</div>
        </div>
      ) : tab === 'today' ? (
        <TodayBoard entries={entries} batches={batches} subs={subs} staffList={staffList} allStaff={allStaff} isAdmin={isAdmin} showToast={showToast} onRefresh={loadData} />
      ) : tab === 'grid' ? (
        <WeeklyGrid entries={entries} batches={batches} activeBatch={activeBatch} setActiveBatch={setActiveBatch}
          subMap={subMap} isAdmin={isAdmin} onEdit={setEditingEntry} now={now} />
      ) : tab === 'teachers' ? (
        <TeacherBoard entries={entries} staffList={staffList} />
      ) : tab === 'substitute' ? (
        <SubstitutePanel entries={entries} staffList={staffList} allStaff={allStaff} subs={subs} onRefresh={loadData} showToast={showToast} isAdmin={isAdmin} />
      ) : tab === 'clashes' ? (
        <ClashBoard clashes={clashes} isAdmin={isAdmin} onEdit={setEditingEntry} />
      ) : tab === 'reports' ? (
        <ReportGenerator entries={entries} subs={subs} batches={batches.length ? batches : ['Achiever']} staffList={staffList} />
      ) : (
        <AdminSetup entries={entries} onRefresh={loadData} showToast={showToast} />
      )}

      <div style={{ fontSize: 11, color: C.inkFaint, textAlign: 'center', marginTop: 24 }}>
        Recurring Monday–Saturday timetable · Substitute records are date-specific and don't alter the base schedule
      </div>
    </div>
  )
}
