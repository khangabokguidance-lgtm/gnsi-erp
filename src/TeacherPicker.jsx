// TeacherPicker.jsx — pick teachers from the staff list (search, tick several, add them in one go).
// Used by the admin setups of Mission Sainik (Panel) and Mission Foundation (Teachers).
//   staff   : [{ name, designation, department }]      taken : tokens already in the list (e.g. ['Kabiraj'])
//   onAdd   : (tokens: string[]) => void               busy  : disables the button while saving
import { useMemo, useState } from 'react'
import { PX } from './premiumUI'
import { staffOptions, filterStaff, firstName } from './lib/teacherPick'

export default function TeacherPicker({ staff, taken = [], onAdd, busy = false, addLabel = 'Add', max = 12, autoFocus = false, countLabel = '', defaultCount = '' }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState([])          // chosen tokens, in the order they were ticked
  const [counts, setCounts] = useState({})    // token → number typed for that teacher (only when countLabel is set)
  const options = useMemo(() => staffOptions(staff), [staff])
  const list = useMemo(() => filterStaff(options, q, taken), [options, q, taken])
  const toggle = o => { if (o.taken) return; setSel(s => (s.includes(o.pick) ? s.filter(x => x !== o.pick) : [...s, o.pick])) }
  const typed = firstName(q)
  const canTyped = q.trim().length > 1 && !list.length && !taken.some(t => t.toLowerCase() === typed.toLowerCase()) && !sel.includes(typed)
  const add = () => { if (sel.length) { onAdd(sel, Object.fromEntries(sel.map(n => [n, counts[n] ?? '']))); setSel([]); setCounts({}); setQ('') } }
  return (
    <div style={{ border: `1px solid ${PX.line}`, borderRadius: 14, background: '#fff', padding: 10 }}>
      {sel.length > 0 && !countLabel && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }} aria-label="Chosen teachers">
          {sel.map(n => (
            <button key={n} type="button" onClick={() => setSel(s => s.filter(x => x !== n))} title="Click to remove"
              style={{ border: 0, cursor: 'pointer', padding: '4px 10px', borderRadius: 99, background: PX.goldBg || '#fff6dc', color: PX.navy, fontWeight: 800, fontSize: 12.5, fontFamily: 'inherit' }}>{n} ✕</button>))}
        </div>)}
      {sel.length > 0 && countLabel && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 10, padding: 8, borderRadius: 12, background: PX.goldBg || '#fff6dc' }} aria-label="Chosen teachers">
          {sel.map(n => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ flex: 1, minWidth: 0, color: PX.navy, fontSize: 13.5 }}>{n}</b>
              <label style={{ fontSize: 12, color: PX.sub, display: 'flex', alignItems: 'center', gap: 6 }}>{countLabel}
                <input className="px-input" type="number" min="0" aria-label={`${countLabel} for ${n}`} placeholder={defaultCount === '' ? '—' : String(defaultCount)} value={counts[n] ?? ''} onChange={e => setCounts(c => ({ ...c, [n]: e.target.value }))} style={{ width: 76, padding: '6px 8px' }} />
              </label>
              <button type="button" onClick={() => setSel(s => s.filter(x => x !== n))} aria-label={`Remove ${n}`} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: PX.sub, fontSize: 16 }}>✕</button>
            </div>))}
          <div style={{ fontSize: 11.5, color: PX.sub }}>Leave a number empty to use {defaultCount === '' ? 'no change' : `the default (${defaultCount})`}.</div>
        </div>)}
      <input className="px-input" type="search" autoFocus={autoFocus} aria-label="Search teachers" placeholder="🔍 Search staff by name or subject…" value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <div role="listbox" aria-multiselectable="true" aria-label="Staff" style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 2 }}>
        {list.map(o => {
          const on = sel.includes(o.pick)
          return (
            <button key={o.name} type="button" role="option" aria-selected={on} disabled={o.taken || (!on && sel.length >= max)} onClick={() => toggle(o)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: 0, fontFamily: 'inherit', cursor: o.taken ? 'default' : 'pointer', background: on ? (PX.goldBg || '#fff6dc') : 'transparent', opacity: o.taken ? 0.5 : 1 }}>
              <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${on ? PX.gold : '#c9c2ae'}`, background: on ? PX.gold : '#fff', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 14, color: PX.ink }}>{o.name}</b>
                <small style={{ color: PX.sub, fontSize: 12 }}>{[o.designation, o.department].filter(Boolean).join(' · ') || 'Staff'}{o.taken ? ' · already added' : ''}{o.shared && !o.taken ? ` · saved as “${o.pick}” (shared first name)` : ''}</small>
              </span>
            </button>)
        })}
        {!list.length && !canTyped && <div style={{ padding: 10, color: PX.sub, fontSize: 13 }}>{options.length ? 'No staff match.' : 'The staff list is empty or still loading.'}</div>}
        {canTyped && <button type="button" onClick={() => setSel(s => [...s, typed])} style={{ padding: '8px 10px', borderRadius: 10, border: `1px dashed ${PX.line}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 700, color: PX.navy }}>＋ Not in the list? Add “{typed}”</button>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button type="button" className="px-btn gold" disabled={!sel.length || busy} onClick={add}>{busy ? 'Adding…' : `${addLabel}${sel.length ? ` ${sel.length}` : ''}`}</button>
        <span style={{ fontSize: 12, color: PX.sub }}>{sel.length ? 'Tick more people, then press the button.' : 'Tick one or more teachers.'}</span>
      </div>
    </div>
  )
}
