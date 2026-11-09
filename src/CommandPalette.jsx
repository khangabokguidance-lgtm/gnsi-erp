// CommandPalette.jsx — jump anywhere in the portal by typing: every module, every section
// inside a hub (Fees → Student Fee Ledger, HR → Timetable…), and the everyday actions.
// Opens with Ctrl+K / ⌘K, or the search buttons in the top bars (openPalette, paletteEvents.js).
// Same sheet on phones (full width, top) and computers (centred). Items come from App, already
// filtered to what this user may open.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavIcon } from './navIcons'
import { OPEN_PALETTE_EVENT } from './paletteEvents'

const NAVY = '#132a4f', GOLD = '#b8923a', INK = '#0f1b2e', SUB = '#5d6b82', LINE = '#e8e3d8'
const CSS = `
.cp-back{position:fixed;inset:0;z-index:10000;background:rgba(11,22,42,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;justify-content:center;align-items:flex-start;padding:min(12vh,110px) 16px 16px;animation:cp-fade .12s ease-out}
.cp{width:min(640px,100%);max-height:min(70vh,560px);display:flex;flex-direction:column;background:#fff;border:1px solid ${LINE};border-radius:20px;box-shadow:0 30px 70px -20px rgba(11,22,42,.55);overflow:hidden;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:${INK};animation:cp-pop .14s ease-out}
.cp-in{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid ${LINE}}
.cp-in input{flex:1;min-width:0;border:0;outline:0;font:600 16px 'Plus Jakarta Sans',system-ui,sans-serif;color:${INK};background:none}
.cp-in kbd{font:700 10.5px 'Plus Jakarta Sans',system-ui,sans-serif;color:${SUB};border:1px solid ${LINE};border-radius:6px;padding:3px 6px;background:#faf8f3}
.cp-list{overflow-y:auto;padding:6px 8px 10px}
.cp-h{font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${GOLD};padding:10px 10px 4px}
.cp-it{display:flex;align-items:center;gap:12px;width:100%;padding:9px 10px;border:0;border-radius:12px;background:none;cursor:pointer;text-align:left;font:inherit;color:inherit}
.cp-it.on{background:linear-gradient(180deg,#1e3a6e,${NAVY});color:#fff}
.cp-ic{width:34px;height:34px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#f6efdc;color:#7a5a14}
.cp-it.on .cp-ic{background:rgba(233,217,176,.18);color:#e9d9b0}
.cp-t{font-weight:700;font-size:14px;line-height:1.2}
.cp-s{font-size:11.5px;color:${SUB};margin-top:1px}
.cp-it.on .cp-s{color:rgba(255,255,255,.7)}
.cp-go{margin-left:auto;font-size:11px;font-weight:700;color:${SUB};opacity:0}
.cp-it.on .cp-go{opacity:1;color:#e9d9b0}
.cp-empty{padding:28px 12px;text-align:center;color:${SUB};font-size:13.5px}
.cp-foot{display:flex;gap:14px;padding:9px 16px;border-top:1px solid ${LINE};background:#faf8f3;font-size:11px;color:${SUB}}
@keyframes cp-fade{from{opacity:0}}
@keyframes cp-pop{from{opacity:0;transform:translateY(-6px) scale(.98)}}
@media (max-width:640px){.cp-back{padding:10px 10px 10px}.cp{max-height:calc(100dvh - 20px);border-radius:18px}.cp-foot{display:none}}
@media (prefers-reduced-motion:reduce){.cp-back,.cp{animation:none}}
`

// every word typed must appear in the label, hint or keywords
const matches = (it, words) => {
  const hay = `${it.label} ${it.hint || ''} ${it.keywords || ''} ${it.group || ''}`.toLowerCase()
  return words.every(w => hay.includes(w))
}
const score = (it, q) => {
  const l = it.label.toLowerCase()
  return l.startsWith(q) ? 0 : l.includes(q) ? 1 : 2
}

// items: [{ key, label, hint, icon (module id for the glyph), group: 'Actions' | 'Modules' | 'Sections', keywords, run() }]
// recentIds: module ids opened lately (shown first when nothing is typed)
export default function CommandPalette({ items, recentIds = [] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    const show = () => { setQ(''); setSel(0); setOpen(true) }
    const key = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => { if (!o) { setQ(''); setSel(0) } return !o }) }
    }
    window.addEventListener(OPEN_PALETTE_EVENT, show)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener(OPEN_PALETTE_EVENT, show); window.removeEventListener('keydown', key) }
  }, [])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) {
      const recent = recentIds.map(id => items.find(i => i.group === 'Modules' && i.icon === id)).filter(Boolean).slice(0, 5)
      return [
        ...(recent.length ? [{ title: 'Recent', list: recent }] : []),
        { title: 'Actions', list: items.filter(i => i.group === 'Actions') },
        { title: 'Modules', list: items.filter(i => i.group === 'Modules' && !recent.includes(i)) },
      ].filter(s => s.list.length)
    }
    const words = needle.split(/\s+/)
    const hits = items.filter(i => matches(i, words)).sort((a, b) => score(a, needle) - score(b, needle))
    return ['Actions', 'Modules', 'Sections'].map(g => ({ title: g, list: hits.filter(h => h.group === g) })).filter(s => s.list.length)
  }, [q, items, recentIds])
  const flat = sections.flatMap(s => s.list)
  const cur = Math.min(sel, Math.max(flat.length - 1, 0))

  useEffect(() => { listRef.current?.querySelector('.cp-it.on')?.scrollIntoView({ block: 'nearest' }) }, [cur, open])

  if (!open) return null
  const pick = it => { setOpen(false); it.run() }
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(Math.min(i, flat.length - 1) + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(Math.min(i, flat.length - 1) - 1, 0)) }
    else if (e.key === 'Enter' && flat[cur]) { e.preventDefault(); pick(flat[cur]) }
  }
  let n = -1
  return createPortal(
    <div className="cp-back" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <style>{CSS}</style>
      <div className="cp" role="dialog" aria-modal="true" aria-label="Go to">
        <label className="cp-in">
          <span style={{ color: GOLD, display: 'flex' }}><NavIcon id="search" size={20} /></span>
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0) }} onKeyDown={onKey}
            placeholder="Go to a module, section or action…" aria-label="Search modules, sections and actions"
            role="combobox" aria-expanded="true" aria-controls="cp-list" aria-activedescendant={flat[cur] ? `cp-${flat[cur].key}` : undefined} />
          <kbd>Esc</kbd>
        </label>
        <div className="cp-list" id="cp-list" role="listbox" ref={listRef}>
          {sections.map(s => (
            <div key={s.title}>
              <div className="cp-h">{s.title}</div>
              {s.list.map(it => {
                n++
                const i = n
                return (
                  <button key={it.key} id={`cp-${it.key}`} type="button" role="option" aria-selected={i === cur}
                    className={'cp-it' + (i === cur ? ' on' : '')} onMouseMove={() => setSel(i)} onClick={() => pick(it)}>
                    <span className="cp-ic"><NavIcon id={it.icon} size={18} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="cp-t" style={{ display: 'block' }}>{it.label}</span>
                      {it.hint && <span className="cp-s" style={{ display: 'block' }}>{it.hint}</span>}
                    </span>
                    <span className="cp-go">Open ↵</span>
                  </button>
                )
              })}
            </div>
          ))}
          {!flat.length && <div className="cp-empty">Nothing matches “{q}”. Try a module name like “fees” or “timetable”.</div>}
        </div>
        <div className="cp-foot"><span><b>↑ ↓</b> move</span><span><b>Enter</b> open</span><span><b>Ctrl K</b> open or close anywhere</span></div>
      </div>
    </div>,
    document.body,
  )
}
