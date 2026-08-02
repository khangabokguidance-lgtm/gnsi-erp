import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from './supabase'
import { staffDB } from './staffDB'

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — "Ledger & Crest"
// Deep navy authority + brass/gold achievement, in the register of a school
// administration office, not a SaaS dashboard. Serif display for headers
// (letterheads, section titles), clean grotesk for data-dense tables.
// ══════════════════════════════════════════════════════════════════════════════
const C = {
  navy900: '#0B1E3D',
  navy700: '#14304F',
  navy500: '#2A4A73',
  navy100: '#DCE4F0',
  navy50:  '#F2F5FA',
  parchment: '#FAF7F0',
  paper:   '#FFFFFF',
  gold:    '#C9A24B',
  goldDim: '#A6813A',
  goldLt:  '#F6EDD8',
  ink:     '#1C2430',
  inkSoft: '#5B6472',
  inkFaint:'#94A0AF',
  line:    '#E4E8EF',
  rose:    '#B3261E',
  roseLt:  '#FBE9E7',
  emerald: '#1B6E4B',
  emeraldLt: '#E3F3EB',
}
const SERIF = `'Source Serif Pro', 'Georgia', 'Times New Roman', serif`
const SANS  = `'Inter', 'Segoe UI', system-ui, sans-serif`
const ADMIN_PIN = '1950'
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const INSTITUTE = {
  name: 'GUIDANCE NAVODAYA & SAINIK INSTITUTE',
  short: 'GNSI',
  tagline: 'NVS · Sainik School · RMS Entrance Coaching',
  address: 'Khangabok, Thoubal District, Manipur — 795138',
  phone: '+91 89742 98074',
  email: 'admissions@guidancekhangabok.in',
  website: 'guidancekhangabok.in',
  founded: '2016',
}

const BATCH_PALETTE = {
  Achiever: { bg: '#EEF2FA', border: '#B9C7E6', text: '#1E3A6E', dot: '#2A4A9E' },
  Leader:   { bg: '#E9F5EF', border: '#9FD6BB', text: '#155A3B', dot: '#1B8F55' },
  Champion: { bg: '#F3EEFA', border: '#CBB6E8', text: '#5A2E8E', dot: '#7C3EC4' },
  Lakshya:  { bg: '#FCF1E6', border: '#EABF8F', text: '#8A4A16', dot: '#C1701F' },
  Umeed:    { bg: '#FCEEF3', border: '#EAB0C6', text: '#8A2050', dot: '#C22D6F' },
  Elite:    { bg: '#EAF6F4', border: '#9CD8CE', text: '#0F5C50', dot: '#1A8D79' },
  Prime:    { bg: '#FBF3DF', border: '#E7C878', text: '#7A5710', dot: '#B3861F' },
}
const getBatchStyle = n => {
  if (!n) return { bg: C.navy50, border: C.line, text: C.inkSoft, dot: C.inkFaint }
  return BATCH_PALETTE[n.split(' ')[0]] || { bg: C.navy50, border: C.line, text: C.inkSoft, dot: C.inkFaint }
}
const isBreak = subj => /TEA BREAK|LUNCH|DINNER|BREAK/i.test(subj || '')
const isDoubt = subj => /DOUBT SESSION/i.test(subj || '')

function todayISO() { return new Date().toISOString().split('T')[0] }
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
// SEED DATA — 2026 Academic Time Table (Mon–Sat, repeats weekly)
// Source: GNSI_Time_Table_2026.docx
// ══════════════════════════════════════════════════════════════════════════════
const SEED_PERIODS = [
  { period_name: '10:25 AM–11:20 AM', rows: [
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Mathematics II', teacher_name: 'Sir Sumanta' },
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'GK', teacher_name: 'Sir Deepak' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Mathematics I', teacher_name: 'Sir Sunder' },
    { class_name: 'Lakshya A', section: 'Navodaya', subject_name: 'Mathematics I', teacher_name: 'Sir Himan' },
    { class_name: 'Lakshya B', section: 'Navodaya', subject_name: 'Environmental Studies II', teacher_name: 'Sir Chetan' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Environmental Studies II', teacher_name: 'Sir Arjun' },
    { class_name: 'Elite', section: 'Navodaya Course', subject_name: 'Grammar', teacher_name: 'Sir Manglemba' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Mathematics II', teacher_name: 'Sir Kabiraj' },
  ]},
  { period_name: '11:20 AM–12:10 PM', rows: [
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Reasoning', teacher_name: 'Sir Johny' },
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Science', teacher_name: 'Sir Arunkumar' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Grammar', teacher_name: 'Sir Manglemba' },
    { class_name: 'Lakshya A', section: 'Navodaya', subject_name: 'Passage & Grammar', teacher_name: 'Sir Pawan' },
    { class_name: 'Lakshya B', section: 'Navodaya', subject_name: 'Mathematics', teacher_name: 'Sir Himan' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Mathematics Revision', teacher_name: 'Sir Sunder' },
    { class_name: 'Elite', section: 'Navodaya Course', subject_name: 'Mathematics I', teacher_name: 'Sir Kabiraj' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'English Grammar', teacher_name: 'Sir Adison' },
  ]},
  { period_name: '12:10 PM–1:00 PM', rows: [
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Science', teacher_name: 'Sir Arunkumar' },
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Reasoning', teacher_name: 'Sir Johny' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'GK', teacher_name: 'Sir Deepak' },
    { class_name: 'Lakshya A', section: 'Navodaya', subject_name: 'Environmental Studies II', teacher_name: 'Sir Chetan' },
    { class_name: 'Lakshya B', section: 'Navodaya', subject_name: 'Mathematics Revision', teacher_name: 'Sir Lenin' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Environmental Studies I', teacher_name: 'Sir Shrinivash' },
    { class_name: 'Elite', section: 'Navodaya Course', subject_name: 'Meitei Mayek', teacher_name: 'Madam Sandhya' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Reasoning', teacher_name: 'Sir Roshan' },
  ]},
  { period_name: '1:00 PM–1:15 PM', rows: [
    { class_name: 'ALL', section: null, subject_name: 'BREAK', teacher_name: null },
  ]},
  { period_name: '1:20 PM–2:10 PM', rows: [
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Mathematics I', teacher_name: 'Sir Sunder' },
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Mathematics II', teacher_name: 'Sir Himan' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Mathematics II', teacher_name: 'Sir Sumanta' },
    { class_name: 'Lakshya A', section: 'Navodaya', subject_name: 'Environmental Studies I', teacher_name: 'Sir Deepak' },
    { class_name: 'Lakshya B', section: 'Navodaya', subject_name: 'Passage & Grammar', teacher_name: 'Sir Pawan' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Mental Ability', teacher_name: 'Sir Roshan' },
    { class_name: 'Elite', section: 'Navodaya Course', subject_name: 'Environmental Studies', teacher_name: 'Sir Arjun' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Mathematics', teacher_name: 'Sir Lenin' },
  ]},
  { period_name: '2:10 PM–3:00 PM', rows: [
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Vocabulary', teacher_name: 'Sir Lenin' },
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Grammar', teacher_name: 'Sir Manglemba' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Vocabulary', teacher_name: 'Sir Chetan' },
    { class_name: 'Lakshya A', section: 'Navodaya', subject_name: 'Mathematics Revision', teacher_name: 'Sir Kabiraj' },
    { class_name: 'Lakshya B', section: 'Navodaya', subject_name: 'Environmental Studies I', teacher_name: 'Sir Arunkumar' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Mathematics', teacher_name: 'Sir Himan' },
    { class_name: 'Elite', section: 'Navodaya Course', subject_name: 'Mathematics', teacher_name: 'Sir Sumanta' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Environmental Studies', teacher_name: 'Sir Arjun' },
  ]},
  { period_name: '3:00 PM–3:50 PM', rows: [
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Grammar', teacher_name: 'Sir Bidyachandra' },
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Vocabulary', teacher_name: 'Sir Pawan' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Reasoning', teacher_name: 'Sir Johny' },
    { class_name: 'Lakshya A', section: 'Navodaya', subject_name: 'Mathematics Revision', teacher_name: 'Sir Sunder' },
    { class_name: 'Lakshya B', section: 'Navodaya', subject_name: 'Mathematics Revision', teacher_name: 'Sir Kabiraj' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Passage & Grammar', teacher_name: 'Sir Pawan' },
    { class_name: 'Elite', section: 'Navodaya Course', subject_name: 'Reasoning', teacher_name: 'Sir Roshan' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Passage', teacher_name: 'Madam Sandhya' },
  ]},
  { period_name: '6:00 PM–7:00 PM', rows: [
    { class_name: 'Champion', section: 'Sainik', subject_name: 'GK', teacher_name: 'Sir Deepak' },
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Mathematics I', teacher_name: 'Sir Bronson' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Science', teacher_name: 'Sir Arunkumar' },
  ]},
]

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
// GRID CELL
// ══════════════════════════════════════════════════════════════════════════════
function Cell({ entry, subMap, isAdmin, onEdit }) {
  if (!entry) return <td style={{ padding: 8, background: C.navy50 }} />
  const style = getBatchStyle(entry.class_name)
  const break_ = isBreak(entry.subject_name)
  const doubt = isDoubt(entry.subject_name)
  const sub = subMap.get(`${entry.day_name}|${entry.class_name}|${entry.period_name}`)

  if (break_) {
    return (
      <td style={{ padding: '10px 12px', background: C.navy900, color: C.gold, textAlign: 'center', fontWeight: 700, fontSize: 12, letterSpacing: '.04em' }}>
        {entry.subject_name}
      </td>
    )
  }
  return (
    <td style={{ padding: 8, verticalAlign: 'top' }}>
      <div onClick={() => isAdmin && onEdit && onEdit(entry)}
        style={{
          background: doubt ? C.navy50 : style.bg, border: `1px solid ${doubt ? C.line : style.border}`,
          borderRadius: 8, padding: '9px 11px', cursor: isAdmin ? 'pointer' : 'default', position: 'relative', minHeight: 54,
        }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: doubt ? C.inkSoft : style.text, marginBottom: 2 }}>
          {entry.subject_name}
        </div>
        {entry.teacher_name && !sub && (
          <div style={{ fontSize: 11, color: doubt ? C.inkFaint : style.text, opacity: .85 }}>{entry.teacher_name}</div>
        )}
        {sub && (
          <div style={{ marginTop: 4, padding: '4px 7px', background: C.roseLt, borderRadius: 5, fontSize: 10.5 }}>
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

// ══════════════════════════════════════════════════════════════════════════════
// WEEKLY GRID VIEW
// ══════════════════════════════════════════════════════════════════════════════
function WeeklyGrid({ entries, batches, activeBatch, setActiveBatch, subMap, isAdmin, onEdit }) {
  const showAll = activeBatch === 'ALL_BATCHES'

  const periodsForBatch = useMemo(() => (b) => {
    const seen = new Map()
    entries.filter(e => e.class_name === b || e.class_name === 'ALL').forEach(e => {
      if (!seen.has(e.period_name)) seen.set(e.period_name, true)
    })
    return [...seen.keys()].sort((a, c) => periodStartMinutes(a) - periodStartMinutes(c))
  }, [entries])

  const gridForBatch = useMemo(() => (b, periods) => {
    const m = {}
    for (const p of periods) {
      m[p] = {}
      for (const d of DAYS) {
        m[p][d] = entries.find(e => e.period_name === p && e.day_name === d && (e.class_name === b || e.class_name === 'ALL'))
      }
    }
    return m
  }, [entries])

  const periods = useMemo(() => showAll ? [] : periodsForBatch(activeBatch), [showAll, activeBatch, periodsForBatch])
  const grid = useMemo(() => showAll ? {} : gridForBatch(activeBatch, periods), [showAll, activeBatch, periods, gridForBatch])

  function BatchTable({ b }) {
    const p = periodsForBatch(b)
    const g = gridForBatch(b, p)
    return (
      <div style={{ background: 'white', borderRadius: 10, border: `1px solid ${C.line}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(11,30,61,.06)', marginBottom: 18 }}>
        <div style={{ padding: '14px 18px', background: C.navy900, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Crest size={22} />
          <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 700, color: 'white' }}>{b} Batch</div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: C.navy100, marginLeft: 'auto' }}>Monday – Saturday</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
            <thead>
              <tr style={{ background: C.navy50 }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.navy700, fontWeight: 700, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `2px solid ${C.gold}` }}>Time</th>
                {DAYS.map(d => (
                  <th key={d} style={{ padding: '10px 12px', textAlign: 'left', color: C.navy900, fontWeight: 700, fontSize: 12, minWidth: 130, borderBottom: `2px solid ${C.gold}` }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.map((pd, i) => (
                <tr key={pd} style={{ borderBottom: `1px solid ${C.line}`, background: i % 2 === 0 ? 'white' : C.navy50 }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, fontSize: 11.5, color: C.navy700, whiteSpace: 'nowrap' }}>{pd}</td>
                  {DAYS.map(d => <Cell key={d} entry={g[pd][d]} subMap={subMap} isAdmin={isAdmin} onEdit={onEdit} />)}
                </tr>
              ))}
              {!p.length && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.inkFaint }}>No periods found for this batch</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button onClick={() => setActiveBatch('ALL_BATCHES')}
          style={{
            padding: '8px 18px', borderRadius: 7, border: `1px solid ${showAll ? C.navy900 : C.line}`,
            background: showAll ? C.navy900 : 'white', color: showAll ? C.gold : C.navy700,
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: SANS, letterSpacing: '.02em',
          }}>
          All Batches
        </button>
        {batches.map(b => {
          const active = activeBatch === b
          return (
            <button key={b} onClick={() => setActiveBatch(b)}
              style={{
                padding: '8px 18px', borderRadius: 7, border: `1px solid ${active ? C.navy900 : C.line}`,
                background: active ? C.navy900 : 'white', color: active ? C.gold : C.navy700,
                fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: SANS, letterSpacing: '.02em',
              }}>
              {b}
            </button>
          )
        })}
      </div>

      {showAll ? (
        batches.map(b => <BatchTable key={b} b={b} />)
      ) : (
        <div style={{ background: 'white', borderRadius: 10, border: `1px solid ${C.line}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(11,30,61,.06)' }}>
          <div style={{ padding: '14px 18px', background: C.navy900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crest size={26} />
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: 'white' }}>{activeBatch} Batch</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.navy100, marginLeft: 'auto' }}>Monday – Saturday</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
              <thead>
                <tr style={{ background: C.navy50 }}>
                  <th style={{ padding: '11px 14px', textAlign: 'left', color: C.navy700, fontWeight: 700, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `2px solid ${C.gold}` }}>Time</th>
                  {DAYS.map(d => (
                    <th key={d} style={{ padding: '11px 14px', textAlign: 'left', color: C.navy900, fontWeight: 700, fontSize: 12.5, minWidth: 150, borderBottom: `2px solid ${C.gold}` }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={p} style={{ borderBottom: `1px solid ${C.line}`, background: i % 2 === 0 ? 'white' : C.navy50 }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 12, color: C.navy700, whiteSpace: 'nowrap' }}>{p}</td>
                    {DAYS.map(d => <Cell key={d} entry={grid[p][d]} subMap={subMap} isAdmin={isAdmin} onEdit={onEdit} />)}
                  </tr>
                ))}
                {!periods.length && (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: C.inkFaint }}>No periods found for this batch</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EDIT ENTRY MODAL
// ══════════════════════════════════════════════════════════════════════════════
function EditEntryModal({ entry, staffList, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...entry })
  const [saving, setSaving] = useState(false)
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,30,61,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 10, padding: 26, width: 420, fontFamily: SANS, border: `1px solid ${C.line}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: C.navy900, marginBottom: 3 }}>Edit Slot</div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 18 }}>{form.class_name} · {form.day_name} · {form.period_name}</div>

        <label style={S.lbl}>Subject</label>
        <Input value={form.subject_name || ''} onChange={e => upd('subject_name', e.target.value)} style={{ marginBottom: 12 }} />

        <label style={S.lbl}>Teacher</label>
        <Select value={form.teacher_name || ''} onChange={e => upd('teacher_name', e.target.value)} style={{ marginBottom: 12 }}>
          <option value="">— None —</option>
          {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </Select>

        <label style={S.lbl}>Room</label>
        <Input value={form.room_name || ''} onChange={e => upd('room_name', e.target.value)} style={{ marginBottom: 20 }} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={saving} onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }} style={{ ...S.btn.primary, flex: 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => onDelete(form.id)} style={S.btn.iconDanger}>🗑</button>
          <button onClick={onClose} style={S.btn.ghost}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBSTITUTE TEACHER ENTRY SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
function SubstitutePanel({ entries, staffList, subs, onRefresh, showToast, isAdmin }) {
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
      <div style={{ background: 'white', borderRadius: 10, padding: 22, border: `1px solid ${C.line}`, boxShadow: '0 1px 3px rgba(11,30,61,.06)', marginBottom: 18 }}>
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

      <div style={{ background: 'white', borderRadius: 10, border: `1px solid ${C.line}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(11,30,61,.06)' }}>
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
// REPORT GENERATOR
// ══════════════════════════════════════════════════════════════════════════════
const REPORT_KINDS = [
  { id: 'batch', label: 'Batch Timetable', desc: 'Full Mon–Sat schedule for one batch' },
  { id: 'master', label: 'Master Timetable', desc: 'All batches, full week, single document' },
  { id: 'substitute', label: 'Substitute Log', desc: 'Substitute records over a date range' },
]

function ReportGenerator({ entries, subs, batches }) {
  const [kind, setKind] = useState('master')
  const [batch, setBatch] = useState(batches[0] || '')
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const printRef = useRef(null)

  const handlePrint = () => {
    const printContents = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=1000,height=1300')
    win.document.write(`
      <html><head><title>${INSTITUTE.short} Report</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: ${SANS}; margin: 0; background: white; color: ${C.ink}; }
        table { width: 100%; border-collapse: collapse; }
        th, td { font-size: 11px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
      </head><body>${printContents}</body></html>
    `)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  const periodsFor = b => {
    const seen = new Map()
    entries.filter(e => e.class_name === b || e.class_name === 'ALL').forEach(e => { if (!seen.has(e.period_name)) seen.set(e.period_name, true) })
    return [...seen.keys()].sort((a, b2) => periodStartMinutes(a) - periodStartMinutes(b2))
  }

  const filteredSubs = subs.filter(s => s.date >= dateFrom && s.date <= dateTo).sort((a, b) => a.date.localeCompare(b.date) || a.class_name.localeCompare(b.class_name))

  return (
    <div style={{ fontFamily: SANS }}>
      <div style={{ background: 'white', borderRadius: 10, padding: 22, border: `1px solid ${C.line}`, boxShadow: '0 1px 3px rgba(11,30,61,.06)', marginBottom: 20 }}>
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
        {kind === 'substitute' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18, maxWidth: 500 }}>
            <div><label style={S.lbl}>From</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div><label style={S.lbl}>To</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          </div>
        )}

        <button onClick={handlePrint} style={S.btn.gold}>🖨 Generate & Print Report</button>
      </div>

      <div style={{ background: C.parchment, borderRadius: 10, border: `1px solid ${C.line}`, padding: 24, boxShadow: '0 1px 3px rgba(11,30,61,.06)' }}>
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
                        return (
                          <td key={d} style={{ padding: '7px 10px', border: `1px solid ${C.line}` }}>
                            {e ? (isBreak(e.subject_name) ? <strong>{e.subject_name}</strong> : (
                              <>
                                <div style={{ fontWeight: 700 }}>{e.subject_name}</div>
                                {e.teacher_name && <div style={{ fontSize: 10, color: C.inkSoft }}>{e.teacher_name}</div>}
                              </>
                            )) : '—'}
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
                            return (
                              <td key={d} style={{ padding: '5px 9px', border: `1px solid ${C.line}`, fontSize: 10 }}>
                                {e ? (isBreak(e.subject_name) ? e.subject_name : `${e.subject_name}${e.teacher_name ? ' — ' + e.teacher_name : ''}`) : '—'}
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
    <div style={{ background: 'white', borderRadius: 10, padding: 24, border: `1px solid ${C.line}`, boxShadow: '0 1px 3px rgba(11,30,61,.06)', fontFamily: SANS }}>
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
export default function Timetable({ currentUser }) {
  const isAdmin = currentUser?.role === 'Admin'
  const [entries, setEntries] = useState([])
  const [subs, setSubs] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('grid')
  const [activeBatch, setActiveBatch] = useState('ALL_BATCHES')
  const [editingEntry, setEditingEntry] = useState(null)
  const [toast, setToast] = useState(null)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200) }

  const loadData = async () => {
    setLoading(true)
    const [{ data: tt, error: e1 }, { data: sb, error: e2 }] = await Promise.all([
      supabase.from('timetable_master').select('*'),
      supabase.from('substitute_log').select('*').order('date', { ascending: false }),
    ])
    if (!e1) setEntries(tt || [])
    if (!e2) setSubs(sb || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    staffDB.forTimetable().then(d => setStaffList(d || []))
  }, [])

  const batches = [...new Set(entries.map(e => e.class_name).filter(c => c && c !== 'ALL'))].sort()

  const subMap = useMemo(() => {
    const today = todayISO()
    const m = new Map()
    subs.filter(s => s.date === today).forEach(s => m.set(`${s.day_name}|${s.class_name}|${s.period_name}`, s))
    return m
  }, [subs])

  const handleSaveEntry = async form => {
    const { error } = await supabase.from('timetable_master')
      .update({ subject_name: form.subject_name, teacher_name: form.teacher_name || null, room_name: form.room_name || null })
      .eq('id', form.id)
    if (error) showToast('Save failed: ' + error.message, 'error')
    else { showToast('Updated'); setEditingEntry(null); loadData() }
  }

  const handleDeleteEntry = async id => {
    if (!window.confirm('Delete this slot?')) return
    const { error } = await supabase.from('timetable_master').delete().eq('id', id)
    if (error) showToast('Delete failed', 'error')
    else { showToast('Deleted'); setEditingEntry(null); loadData() }
  }

  const navTabs = [
    { id: 'grid', label: 'Timetable' },
    { id: 'substitute', label: 'Substitute Entry' },
    { id: 'reports', label: 'Reports' },
    ...(isAdmin ? [{ id: 'admin', label: 'Setup' }] : []),
  ]

  return (
    <div style={{ padding: 24, background: C.navy50, minHeight: '100vh', fontFamily: SANS }}>
      <Toast toast={toast} />
      {showPinModal && (
        <PinModal onClose={() => setShowPinModal(false)} onSuccess={() => { setAdminUnlocked(true); setShowPinModal(false); setTab('admin') }} />
      )}
      {editingEntry && (
        <EditEntryModal entry={editingEntry} staffList={staffList} onClose={() => setEditingEntry(null)} onSave={handleSaveEntry} onDelete={handleDeleteEntry} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12, background: C.navy900, borderRadius: 10, padding: '16px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Crest size={40} />
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: 'white', letterSpacing: '.02em' }}>Time Table</div>
            <div style={{ fontSize: 12, color: C.navy100 }}>{INSTITUTE.short} · Monday–Saturday recurring schedule</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,.08)', padding: 4, borderRadius: 8 }}>
          {navTabs.map(t => (
            <button key={t.id}
              onClick={() => {
                if (t.id === 'admin' && !isAdmin && !adminUnlocked) { setShowPinModal(true); return }
                setTab(t.id)
              }}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: SANS,
                fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? C.gold : 'transparent', color: tab === t.id ? C.navy900 : C.navy100,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ background: 'white', borderRadius: 10, padding: 60, textAlign: 'center', color: C.inkFaint }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Loading timetable…</div>
        </div>
      ) : tab === 'grid' ? (
        entries.length ? (
          <WeeklyGrid entries={entries} batches={batches} activeBatch={activeBatch} setActiveBatch={setActiveBatch}
            subMap={subMap} isAdmin={isAdmin} onEdit={setEditingEntry} />
        ) : (
          <div style={{ background: 'white', borderRadius: 10, padding: 60, textAlign: 'center', color: C.inkFaint }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗓️</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: C.navy900, fontFamily: SERIF }}>No timetable loaded yet</div>
            <div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Setup to load the standard schedule.' : 'Ask an admin to set up the timetable.'}</div>
          </div>
        )
      ) : tab === 'substitute' ? (
        <SubstitutePanel entries={entries} staffList={staffList} subs={subs} onRefresh={loadData} showToast={showToast} isAdmin={isAdmin} />
      ) : tab === 'reports' ? (
        <ReportGenerator entries={entries} subs={subs} batches={batches.length ? batches : ['Achiever']} />
      ) : (
        <AdminSetup entries={entries} onRefresh={loadData} showToast={showToast} />
      )}

      <div style={{ fontSize: 11, color: C.inkFaint, textAlign: 'center', marginTop: 24 }}>
        Recurring Monday–Saturday timetable · Substitute records are date-specific and don't alter the base schedule
      </div>
    </div>
  )
}