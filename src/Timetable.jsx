import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { staffDB } from './staffDB'

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════════════════════
const C = {
  ink900: '#0c0f1a', ink700: '#1e2235', ink500: '#4a5068', ink300: '#8b91a8',
  ink100: '#d4d8e8', ink50: '#f0f2f8', ink20: '#f8f9fc',
  indigo: '#3d4dff', indigoDim: '#2433cc', indigoLt: '#eef0ff', indigoMid: '#c7cbff',
  emerald: '#059669', emeraldLt: '#d1fae5',
  amber: '#d97706', amberLt: '#fef3c7',
  rose: '#e11d48', roseLt: '#ffe4e6',
  violet: '#7c3aed', violetLt: '#ede9fe',
  sky: '#0284c7', skyLt: '#e0f2fe',
  teal: '#0d9488', tealLt: '#ccfbf1',
  orange: '#ea580c', orangeLt: '#fff7ed',
  pink: '#db2777', pinkLt: '#fce7f3',
}
const FONT = `'DM Sans', 'Outfit', system-ui, sans-serif`
const ADMIN_PIN = '1950'
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const BATCH_PALETTE = {
  Achiever: { bg: C.indigoLt, border: C.indigoMid, text: C.indigoDim, dot: C.indigo },
  Leader: { bg: C.emeraldLt, border: '#6ee7b7', text: '#065f46', dot: C.emerald },
  Champion: { bg: C.violetLt, border: '#c4b5fd', text: '#5b21b6', dot: C.violet },
  Lakshya: { bg: C.orangeLt, border: '#fdba74', text: '#9a3412', dot: C.orange },
  Umeed: { bg: C.pinkLt, border: '#f9a8d4', text: '#9d174d', dot: C.pink },
  Elite: { bg: C.tealLt, border: '#5eead4', text: '#134e4a', dot: C.teal },
  Prime: { bg: C.amberLt, border: '#fcd34d', text: '#92400e', dot: C.amber },
}
const getBatchStyle = n => {
  if (!n) return { bg: C.ink50, border: C.ink100, text: C.ink500, dot: C.ink300 }
  return BATCH_PALETTE[n.split(' ')[0]] || { bg: C.ink50, border: C.ink100, text: C.ink500, dot: C.ink300 }
}
const isBreak = subj => /TEA BREAK|LUNCH|DINNER|BREAK/i.test(subj || '')
const isDoubt = subj => /DOUBT SESSION/i.test(subj || '')

function todayName() { return new Date().toLocaleDateString('en-US', { weekday: 'long' }) }
function todayISO() { return new Date().toISOString().split('T')[0] }

// ══════════════════════════════════════════════════════════════════════════════
// SEED DATA — July 2026 Doubt Session & Class Time Table (Mon–Sat, repeats weekly)
// ══════════════════════════════════════════════════════════════════════════════
const SEED_PERIODS = [
  { period_name: '10:25 AM–11:20 AM', rows: [
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Grammar', teacher_name: 'Sir Bidyachandra' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Science', teacher_name: 'Sir Arunkumar' },
    { class_name: 'Champion', section: 'Sainik', subject_name: 'GK', teacher_name: 'Sir Deepak' },
    { class_name: 'Lakshya', section: 'Navodaya', subject_name: 'Meitei Mayek', teacher_name: 'Sir Pawan' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Mathematics I', teacher_name: 'Sir Himan' },
    { class_name: 'Elite', section: 'Foundation', subject_name: 'Reasoning & Mental', teacher_name: 'Sir Roshan' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'English Grammar II', teacher_name: 'Sir Manglemba' },
  ]},
  { period_name: '11:20 AM–12:10 PM', rows: [
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Mathematics I', teacher_name: 'Sir Sumanta' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Reasoning', teacher_name: 'Sir Johny' },
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Mathematics II', teacher_name: 'Sir Romen' },
    { class_name: 'Lakshya', section: 'Navodaya', subject_name: 'Grammar', teacher_name: 'Sir Chetan' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Mental Ability Test', teacher_name: 'Sir Arjun' },
    { class_name: 'Elite', section: 'Foundation', subject_name: 'English Grammar I', teacher_name: 'Sir Lenin' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Mathematics I', teacher_name: 'Sir Sunder' },
  ]},
  { period_name: '12:10 PM–1:00 PM', rows: [
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Science', teacher_name: 'Sir Arunkumar' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Mathematics', teacher_name: 'Sir Sunder' },
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Grammar', teacher_name: 'Sir Manglemba' },
    { class_name: 'Lakshya', section: 'Navodaya', subject_name: 'Mathematics I', teacher_name: 'Sir Himan' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Meitei Mayek', teacher_name: 'Sir Pawan' },
    { class_name: 'Elite', section: 'Foundation', subject_name: 'Science', teacher_name: 'Sir Arjun' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Reasoning & Mental', teacher_name: 'Sir Roshan' },
  ]},
  { period_name: '1:00 PM–1:25 PM', rows: [
    { class_name: 'ALL', section: null, subject_name: 'TEA BREAK', teacher_name: null },
  ]},
  { period_name: '1:25 PM–2:15 PM', rows: [
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Mathematics II', teacher_name: 'Sir Himan' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Vocabulary', teacher_name: 'Sir Pawan' },
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Vocabulary', teacher_name: 'Sir Chetan' },
    { class_name: 'Lakshya', section: 'Navodaya', subject_name: 'Mathematics II', teacher_name: 'Sir Sumanta' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Mathematics II', teacher_name: 'Sir Romen' },
    { class_name: 'Elite', section: 'Foundation', subject_name: 'English Grammar II', teacher_name: 'Miss Fedrava' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'English Grammar I', teacher_name: 'Sir Lenin' },
  ]},
  { period_name: '2:15 PM–3:05 PM', rows: [
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Vocabulary', teacher_name: 'Sir Pawan' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Grammar', teacher_name: 'Sir Manglemba' },
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Reasoning', teacher_name: 'Sir Lenin' },
    { class_name: 'Lakshya', section: 'Navodaya', subject_name: 'Mental Ability', teacher_name: 'Sir Roshan' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Mental Ability', teacher_name: 'Sir Johny' },
    { class_name: 'Elite', section: 'Foundation', subject_name: 'Meitei Mayek', teacher_name: 'Madam Sandhya' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Mathematics II', teacher_name: 'Sir Sumanta' },
  ]},
  { period_name: '3:05 PM–3:50 PM', rows: [
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'Reasoning', teacher_name: 'Sir Johny' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'GK', teacher_name: 'Sir Deepak' },
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Mathematics I', teacher_name: 'Sir Himan' },
    { class_name: 'Lakshya', section: 'Navodaya', subject_name: 'Mental Ability Test', teacher_name: 'Sir Arjun' },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'Grammar', teacher_name: 'Sir Chetan' },
    { class_name: 'Elite', section: 'Foundation', subject_name: 'Mathematics I', teacher_name: 'Sir Sunder' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Meitei Mayek', teacher_name: 'Madam Sandhya' },
  ]},
  { period_name: '5:40 PM–6:35 PM', rows: [
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'DOUBT SESSION', teacher_name: null },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'DOUBT SESSION', teacher_name: null },
    { class_name: 'Champion', section: 'Sainik', subject_name: 'DOUBT SESSION', teacher_name: null },
    { class_name: 'Lakshya', section: 'Navodaya', subject_name: 'DOUBT SESSION', teacher_name: null },
    { class_name: 'Elite', section: 'Foundation', subject_name: 'Mathematics I', teacher_name: 'Sir Himan' },
    { class_name: 'Prime', section: 'Foundation', subject_name: 'Science', teacher_name: 'Sir Basanta' },
  ]},
  { period_name: '6:40 PM–7:35 PM', rows: [
    { class_name: 'Achiever', section: 'Sainik', subject_name: 'GK', teacher_name: 'Sir Deepak' },
    { class_name: 'Leader', section: 'Sainik', subject_name: 'Mathematics', teacher_name: 'Sir Himan' },
    { class_name: 'Champion', section: 'Sainik', subject_name: 'Science', teacher_name: 'Sir Arunkumar' },
    { class_name: 'Lakshya', section: 'Navodaya', subject_name: 'DOUBT SESSION', teacher_name: null },
    { class_name: 'Umeed', section: 'Navodaya', subject_name: 'DOUBT SESSION', teacher_name: null },
  ]},
  { period_name: '5:40 PM–6:35 PM', rows: [
    { class_name: 'Navodaya Course MM', section: 'Combined Group', subject_name: 'Mathematics', teacher_name: 'Sir Bronson' },
    { class_name: 'Navodaya Course ENG', section: 'Combined Group', subject_name: 'English Passage', teacher_name: 'Sir Adison' },
  ]},
  { period_name: '6:30 AM–7:30 AM', rows: [
    { class_name: 'Navodaya Course MM', section: 'Combined Group', subject_name: 'Meitei Mayek Passage', teacher_name: 'Miss Deviya' },
    { class_name: 'Navodaya Course ENG', section: 'Combined Group', subject_name: 'Mathematics', teacher_name: 'Sir Umesh' },
  ]},
  { period_name: '7:40 PM–8:30 PM', rows: [
    { class_name: 'Navodaya Course MM', section: 'Combined Group', subject_name: 'DOUBT SESSION', teacher_name: null },
    { class_name: 'Navodaya Course ENG', section: 'Combined Group', subject_name: 'DOUBT SESSION', teacher_name: null },
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
// SHARED UI PRIMITIVES
// ══════════════════════════════════════════════════════════════════════════════
const baseInput = {
  width: '100%', padding: '9px 13px', borderRadius: 8, border: `1px solid ${C.ink100}`,
  fontSize: 13, outline: 'none', fontFamily: FONT, color: C.ink900, background: 'white',
  boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s',
}
const S = {
  inp: baseInput,
  lbl: { display: 'block', fontSize: 11, fontWeight: 600, color: C.ink300, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' },
  pill: (bg, text) => ({ background: bg, color: text, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600 }),
  btn: {
    primary: { background: C.indigo, color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: FONT },
    ghost: { background: 'transparent', color: C.ink500, border: `1px solid ${C.ink100}`, borderRadius: 8, padding: '9px 16px', fontWeight: 500, cursor: 'pointer', fontSize: 13, fontFamily: FONT },
    danger: { background: C.rose, color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: FONT },
    icon: { background: C.ink50, color: C.ink500, border: `1px solid ${C.ink100}`, borderRadius: 7, padding: '5px 9px', fontWeight: 500, cursor: 'pointer', fontSize: 12, fontFamily: FONT },
    iconDanger: { background: C.roseLt, color: C.rose, border: `1px solid #fecdd3`, borderRadius: 7, padding: '5px 9px', fontWeight: 500, cursor: 'pointer', fontSize: 12, fontFamily: FONT },
  },
}

function Input({ value, onChange, placeholder, style = {}, list }) {
  const [focused, setFocused] = useState(false)
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} list={list}
      style={{ ...S.inp, ...(focused ? { borderColor: C.indigo, boxShadow: `0 0 0 3px ${C.indigoLt}` } : {}), ...style }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  )
}
function Select({ value, onChange, children, style = {} }) {
  return (
    <select value={value} onChange={onChange}
      style={{ ...S.inp, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b91a8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, ...style }}>
      {children}
    </select>
  )
}
function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 10, background: isErr ? C.rose : C.ink900, color: 'white', fontWeight: 500, fontSize: 13, fontFamily: FONT, boxShadow: '0 8px 40px rgba(0,0,0,.2)', minWidth: 280, maxWidth: 380 }}>
      <span style={{ fontSize: 16 }}>{isErr ? '⚠' : '✓'}</span>{toast.msg}
    </div>
  )
}
function PinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState(''); const [err, setErr] = useState(false)
  const submit = () => { if (pin === ADMIN_PIN) onSuccess(); else { setErr(true); setPin('') } }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,15,26,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 320, fontFamily: FONT }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink900, marginBottom: 4 }}>Admin Access</div>
        <div style={{ fontSize: 12, color: C.ink400, marginBottom: 16 }}>Enter PIN to edit the timetable</div>
        <input type="password" autoFocus value={pin} onChange={e => { setPin(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ ...S.inp, textAlign: 'center', fontSize: 20, letterSpacing: 6, marginBottom: 8, borderColor: err ? C.rose : C.ink100 }} placeholder="••••" />
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
// GRID CELL — resolves substitute for a given date if one exists
// ══════════════════════════════════════════════════════════════════════════════
function Cell({ entry, subMap, isAdmin, onEdit }) {
  if (!entry) return <td style={{ padding: 8, background: C.ink20 }} />
  const style = getBatchStyle(entry.class_name)
  const break_ = isBreak(entry.subject_name)
  const doubt = isDoubt(entry.subject_name)
  const sub = subMap.get(`${entry.day_name}|${entry.class_name}|${entry.period_name}`)

  if (break_) {
    return (
      <td style={{ padding: '10px 12px', background: C.ink900, color: 'white', textAlign: 'center', fontWeight: 700, fontSize: 12 }}>
        {entry.subject_name}
      </td>
    )
  }
  return (
    <td style={{ padding: 8, verticalAlign: 'top' }}>
      <div onClick={() => isAdmin && onEdit && onEdit(entry)}
        style={{
          background: doubt ? C.ink50 : style.bg, border: `1px solid ${doubt ? C.ink100 : style.border}`,
          borderRadius: 9, padding: '9px 11px', cursor: isAdmin ? 'pointer' : 'default', position: 'relative', minHeight: 54,
        }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: doubt ? C.ink500 : style.text, marginBottom: 2 }}>
          {entry.subject_name}
        </div>
        {entry.teacher_name && !sub && (
          <div style={{ fontSize: 11, color: doubt ? C.ink300 : style.text, opacity: .85 }}>{entry.teacher_name}</div>
        )}
        {sub && (
          <div style={{ marginTop: 4, padding: '4px 7px', background: C.roseLt, borderRadius: 6, fontSize: 10.5 }}>
            <div style={{ color: C.ink300, textDecoration: 'line-through' }}>{entry.teacher_name || '—'}</div>
            <div style={{ color: C.rose, fontWeight: 700 }}>→ {sub.substitute_teacher}</div>
          </div>
        )}
        {doubt && !entry.teacher_name && !sub && (
          <div style={{ fontSize: 10.5, color: C.ink300, fontStyle: 'italic' }}>Duty teacher TBD</div>
        )}
      </div>
    </td>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// WEEKLY GRID VIEW — batch selector + Mon–Sat × period table
// ══════════════════════════════════════════════════════════════════════════════
function WeeklyGrid({ entries, batches, activeBatch, setActiveBatch, subMap, isAdmin, onEdit }) {
  const periods = useMemo(() => {
    const seen = new Map()
    entries.filter(e => e.class_name === activeBatch || e.class_name === 'ALL').forEach(e => {
      if (!seen.has(e.period_name)) seen.set(e.period_name, true)
    })
    return [...seen.keys()]
  }, [entries, activeBatch])

  const grid = useMemo(() => {
    const m = {}
    for (const p of periods) {
      m[p] = {}
      for (const d of DAYS) {
        m[p][d] = entries.find(e => e.period_name === p && e.day_name === d && (e.class_name === activeBatch || e.class_name === 'ALL'))
      }
    }
    return m
  }, [entries, periods, activeBatch])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {batches.map(b => {
          const st = getBatchStyle(b)
          const active = activeBatch === b
          return (
            <button key={b} onClick={() => setActiveBatch(b)}
              style={{
                padding: '8px 16px', borderRadius: 9, border: `1px solid ${active ? st.dot : C.ink100}`,
                background: active ? st.dot : 'white', color: active ? 'white' : C.ink700,
                fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
              }}>
              {b}
            </button>
          )
        })}
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: `1px solid ${C.ink50}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
            <thead>
              <tr style={{ background: C.ink900 }}>
                <th style={{ padding: '11px 14px', textAlign: 'left', color: 'rgba(255,255,255,.6)', fontWeight: 600, fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Time</th>
                {DAYS.map(d => (
                  <th key={d} style={{ padding: '11px 14px', textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 12, minWidth: 150 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => (
                <tr key={p} style={{ borderBottom: `1px solid ${C.ink50}`, background: i % 2 === 0 ? 'white' : C.ink20 }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12, color: C.ink700, whiteSpace: 'nowrap' }}>{p}</td>
                  {DAYS.map(d => <Cell key={d} entry={grid[p][d]} subMap={subMap} isAdmin={isAdmin} onEdit={onEdit} />)}
                </tr>
              ))}
              {!periods.length && (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: C.ink300 }}>No periods found for this batch</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EDIT ENTRY MODAL — admin edits the recurring Mon–Sat grid
// ══════════════════════════════════════════════════════════════════════════════
function EditEntryModal({ entry, staffList, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...entry })
  const [saving, setSaving] = useState(false)
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,15,26,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 14, padding: 26, width: 420, fontFamily: FONT }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink900, marginBottom: 3 }}>Edit Slot</div>
        <div style={{ fontSize: 12, color: C.ink400, marginBottom: 18 }}>{form.class_name} · {form.day_name} · {form.period_name}</div>

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
  const uniquePeriods = [...new Set(periodsForBatch)]

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
    <div style={{ fontFamily: FONT }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 22, border: `1px solid ${C.ink50}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)', marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink900, marginBottom: 3 }}>Record a Substitute</div>
        <div style={{ fontSize: 12, color: C.ink400, marginBottom: 18 }}>
          Log a one-off substitution for a specific date. The recurring Mon–Sat grid is not changed.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={S.lbl}>Date *</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <div style={{ fontSize: 11, color: C.ink300, marginTop: 4 }}>{dayName}</div>
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
            <Select value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="">— Select —</option>
              {uniquePeriods.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <div>
            <label style={S.lbl}>Original Teacher</label>
            <Input value={matchedEntry?.teacher_name || '—'} onChange={() => {}} style={{ background: C.ink20, color: C.ink400 }} />
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

      <div style={{ background: 'white', borderRadius: 12, border: `1px solid ${C.ink50}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.ink50}`, fontSize: 13, fontWeight: 700, color: C.ink900 }}>
          Substitutes for {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ({dayName})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FONT }}>
          <thead>
            <tr style={{ background: C.ink20 }}>
              {['Batch', 'Period', 'Original', 'Substitute', 'Reason', ''].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: C.ink400, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {todaysSubs.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${C.ink50}` }}>
                <td style={{ padding: '10px 14px' }}><span style={S.pill(getBatchStyle(s.class_name).bg, getBatchStyle(s.class_name).text)}>{s.class_name}</span></td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{s.period_name}</td>
                <td style={{ padding: '10px 14px', color: C.ink400 }}>{s.original_teacher || '—'}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: C.rose }}>{s.substitute_teacher}</td>
                <td style={{ padding: '10px 14px', color: C.ink400 }}>{s.reason || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  {isAdmin && <button onClick={() => handleDeleteSub(s.id)} style={S.btn.iconDanger}>🗑</button>}
                </td>
              </tr>
            ))}
            {!todaysSubs.length && (
              <tr><td colSpan={6} style={{ padding: 36, textAlign: 'center', color: C.ink300 }}>No substitutes recorded for this date</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN SETUP — seed / reset the recurring grid
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
    <div style={{ background: 'white', borderRadius: 12, padding: 24, border: `1px solid ${C.ink50}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)', fontFamily: FONT }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.ink900, marginBottom: 3 }}>Setup Timetable</div>
      <div style={{ fontSize: 12, color: C.ink400, marginBottom: 18 }}>
        Currently {entries.length} slots stored, repeating every Monday–Saturday. Loading the standard schedule replaces everything below.
      </div>
      <div style={{ padding: '10px 14px', background: C.amberLt, borderRadius: 8, fontSize: 12, color: C.amber, fontWeight: 500, marginBottom: 18 }}>
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
  const [activeBatch, setActiveBatch] = useState('Achiever')
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
    ...(isAdmin ? [{ id: 'admin', label: 'Setup' }] : []),
  ]

  return (
    <div style={{ padding: 24, background: C.ink20, minHeight: '100vh', fontFamily: FONT }}>
      <Toast toast={toast} />
      {showPinModal && (
        <PinModal onClose={() => setShowPinModal(false)} onSuccess={() => { setAdminUnlocked(true); setShowPinModal(false); setTab('admin') }} />
      )}
      {editingEntry && (
        <EditEntryModal entry={editingEntry} staffList={staffList} onClose={() => setEditingEntry(null)} onSave={handleSaveEntry} onDelete={handleDeleteEntry} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.ink900, letterSpacing: '-0.3px' }}>Time Table</div>
          <div style={{ fontSize: 13, color: C.ink400 }}>Monday–Saturday recurring schedule</div>
        </div>
        <div style={{ display: 'flex', gap: 0, background: 'white', padding: 4, borderRadius: 10, border: `1px solid ${C.ink50}` }}>
          {navTabs.map(t => (
            <button key={t.id}
              onClick={() => {
                if (t.id === 'admin' && !isAdmin && !adminUnlocked) { setShowPinModal(true); return }
                setTab(t.id)
              }}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: FONT,
                fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? C.ink900 : 'transparent', color: tab === t.id ? 'white' : C.ink500,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 60, textAlign: 'center', color: C.ink400 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontWeight: 500, fontSize: 15 }}>Loading timetable…</div>
        </div>
      ) : tab === 'grid' ? (
        entries.length ? (
          <WeeklyGrid entries={entries} batches={batches} activeBatch={activeBatch} setActiveBatch={setActiveBatch}
            subMap={subMap} isAdmin={isAdmin} onEdit={setEditingEntry} />
        ) : (
          <div style={{ background: 'white', borderRadius: 12, padding: 60, textAlign: 'center', color: C.ink400 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗓️</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No timetable loaded yet</div>
            <div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Setup to load the standard schedule.' : 'Ask an admin to set up the timetable.'}</div>
          </div>
        )
      ) : tab === 'substitute' ? (
        <SubstitutePanel entries={entries} staffList={staffList} subs={subs} onRefresh={loadData} showToast={showToast} isAdmin={isAdmin} />
      ) : (
        <AdminSetup entries={entries} onRefresh={loadData} showToast={showToast} />
      )}

      <div style={{ fontSize: 11, color: C.ink300, textAlign: 'center', marginTop: 24 }}>
        Recurring Monday–Saturday timetable · Substitute records are date-specific and don't alter the base schedule
      </div>
    </div>
  )
}