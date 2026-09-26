// StudioPresenter.jsx — GNSI Portal · Material Studio presenter mode
//
// Full-screen classroom quiz straight from the tray: one question per
// screen, countdown timer, answer reveal and a team scoreboard.
// Keys: → / PageDown next · ← previous · Space reveal · T timer · F full
// screen · Esc close.

import { useCallback, useEffect, useRef, useState } from 'react'
import { BMEI04_BASE64 } from './bmei04_font_base64'
import { MATERIAL_TYPES, hasMayek } from './studioDesigns'

const OPTS = ['a', 'b', 'c', 'd']
const TIMERS = [0, 15, 30, 60, 90]
const mmFont = q => (q.question_mayek_font === 'bmei04' ? "'BMEI04', sans-serif" : "'Noto Sans Meetei Mayek', sans-serif")

export default function StudioPresenter({ tray, options, onClose }) {
  const [idx, setIdx] = useState(0)                       // 0 = title screen
  const [reveal, setReveal] = useState(false)
  const [seconds, setSeconds] = useState(30)
  const [left, setLeft] = useState(null)                  // null = timer idle
  const [teams, setTeams] = useState([{ name: 'Team A', score: 0 }, { name: 'Team B', score: 0 }])
  const [lang, setLang] = useState(options.lang || 'en')
  const rootRef = useRef(null)
  const total = tray.length
  const item = idx > 0 ? tray[idx - 1] : null
  const showMayek = tray.some(t => t.kind === 'q' && hasMayek(t.row))

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else rootRef.current?.requestFullscreen?.().catch(() => {})
  }, [])
  const go = useCallback(d => { setIdx(i => Math.max(0, Math.min(total, i + d))); setReveal(false); setLeft(null) }, [total])
  const toggleTimer = useCallback(() => setLeft(l => (l == null && seconds ? seconds : null)), [seconds])

  useEffect(() => {
    if (left == null || left <= 0) return
    const t = setTimeout(() => setLeft(l => (l == null ? null : l - 1)), 1000)
    return () => clearTimeout(t)
  }, [left])

  useEffect(() => {
    const h = e => {
      if (e.target.closest?.('input,select,textarea')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setReveal(r => !r) }
      else if (e.key === 't' || e.key === 'T') toggleTimer()
      else if (e.key === 'f' || e.key === 'F') fullscreen()
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go, toggleTimer, onClose, fullscreen])

  const text = (en, mm, q) => {
    if (lang === 'en' || !mm) return en
    const m = <span style={{ fontFamily: mmFont(q) }}>{mm}</span>
    return lang === 'mm' ? m : <>{en}<div style={{ fontSize: '.85em', opacity: .85, marginTop: 4 }}>{m}</div></>
  }

  const timeUp = left === 0
  return (
    <div ref={rootRef} role="dialog" aria-label="Presenter" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'linear-gradient(135deg,#0b1a33,#132a4f 60%,#1e3a6e)', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      {showMayek && <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Meetei+Mayek&display=swap');@font-face{font-family:'BMEI04';src:url(data:font/ttf;base64,${BMEI04_BASE64}) format('truetype')}.sp-sel option{color:#0f1b2e}`}</style>}
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.12)', flexWrap: 'wrap' }}>
        <b style={{ color: '#e9d9b0', letterSpacing: '.16em', fontSize: 12 }}>{options.brandName || 'GNSI'}</b>
        <span style={{ opacity: .7, fontSize: 13 }}>{options.title || 'Class quiz'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, opacity: .8 }}>{idx === 0 ? 'Start' : `${idx} / ${total}`}</span>
        {showMayek && (
          <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language" className="sp-sel" style={sel}>
            <option value="en">English</option><option value="mm">Meitei Mayek</option><option value="both">Both</option>
          </select>
        )}
        <select value={seconds} onChange={e => { setSeconds(Number(e.target.value)); setLeft(null) }} aria-label="Timer length" className="sp-sel" style={sel}>
          {TIMERS.map(s => <option key={s} value={s}>{s ? `${s}s timer` : 'No timer'}</option>)}
        </select>
        <button style={btn} onClick={fullscreen} title="Full screen (F)">⛶</button>
        <button style={btn} onClick={onClose} aria-label="Close presenter">✕ Close</button>
      </div>

      {/* stage */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 5vw', overflow: 'auto' }}>
        {idx === 0 ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#e9d9b0', letterSpacing: '.3em', fontSize: 14, fontWeight: 800 }}>{options.brandName || 'GNSI'}</div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 'clamp(34px,5vw,64px)', marginTop: 10 }}>{options.title || 'Class quiz'}</div>
            {options.subtitle && <div style={{ opacity: .7, fontSize: 20, marginTop: 8 }}>{options.subtitle}</div>}
            <div style={{ opacity: .6, marginTop: 28, fontSize: 14 }}>{total} slides · press → to begin · Space reveals the answer · T starts the timer</div>
          </div>
        ) : item.kind === 'q' ? (
          <div style={{ width: '100%', maxWidth: 1100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ color: '#e9d9b0', fontWeight: 800, letterSpacing: '.12em', fontSize: 14 }}>QUESTION {tray.slice(0, idx).filter(t => t.kind === 'q').length}{item.row.chapter ? ` · ${item.row.chapter}` : ''}</span>
              {left != null && <span aria-live="polite" style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: timeUp ? '#fca5a5' : left <= 5 ? '#fde68a' : '#fff' }}>{timeUp ? "Time's up" : `${left}s`}</span>}
            </div>
            <div style={{ fontSize: 'clamp(24px,3.2vw,42px)', fontWeight: 700, lineHeight: 1.3 }}>{text(item.row.question, item.row.question_mayek, item.row)}</div>
            {item.row.diagram_url && /^https?:/i.test(item.row.diagram_url) && <img src={item.row.diagram_url} alt="" style={{ maxHeight: '28vh', maxWidth: '100%', marginTop: 16, borderRadius: 12, background: '#fff' }} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginTop: 24 }}>
              {OPTS.filter(k => item.row[`option_${k}`]).map(k => {
                const right = reveal && item.row.correct_option === k.toUpperCase()
                const dim = reveal && !right
                return (
                  <div key={k} style={{ padding: '16px 20px', borderRadius: 16, fontSize: 'clamp(18px,2.2vw,28px)', background: right ? 'rgba(34,197,94,.28)' : 'rgba(255,255,255,.08)', border: `2px solid ${right ? '#4ade80' : 'rgba(255,255,255,.16)'}`, opacity: dim ? .45 : 1, transition: 'all .25s' }}>
                    <b style={{ color: '#e9d9b0', marginRight: 10 }}>{k.toUpperCase()}</b>{text(item.row[`option_${k}`], item.row[`option_${k}_mayek`], item.row)}{right && ' ✓'}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 1000 }}>
            <div style={{ color: '#e9d9b0', fontWeight: 800, letterSpacing: '.12em', fontSize: 14 }}>{(MATERIAL_TYPES[item.row.material_type]?.label || 'Material').toUpperCase()}</div>
            <div style={{ fontSize: 'clamp(28px,3.6vw,48px)', fontWeight: 700, marginTop: 8 }}>{item.row.title}</div>
            {item.row.description && <div style={{ fontSize: 'clamp(18px,2vw,26px)', opacity: .9, marginTop: 14, whiteSpace: 'pre-wrap' }}>{item.row.description}</div>}
            {item.row.file_url && /^https?:/i.test(item.row.file_url) && <a href={item.row.file_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 18, color: '#e9d9b0' }}>Open link ↗</a>}
          </div>
        )}
      </div>

      {/* bottom bar: controls + scoreboard */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.12)', flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => go(-1)} disabled={idx === 0}>← Prev</button>
        {item?.kind === 'q' && <button style={{ ...btn, background: '#b8923a', color: '#1a1406', borderColor: '#b8923a' }} onClick={() => setReveal(r => !r)}>{reveal ? 'Hide answer' : 'Reveal answer'}</button>}
        {item?.kind === 'q' && seconds > 0 && <button style={btn} onClick={toggleTimer}>{left == null ? '▶ Timer' : '■ Stop'}</button>}
        <button style={btn} onClick={() => go(1)} disabled={idx === total}>Next →</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {teams.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '4px 6px 4px 10px' }}>
              <input value={t.name} onChange={e => setTeams(ts => ts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={`Team ${i + 1} name`}
                style={{ width: 80, background: 'transparent', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13 }} />
              <b style={{ fontSize: 20, minWidth: 26, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} aria-label={`${t.name} score`}>{t.score}</b>
              <button style={mini} onClick={() => setTeams(ts => ts.map((x, j) => (j === i ? { ...x, score: x.score + 1 } : x)))} aria-label={`Add point to ${t.name}`}>+1</button>
              <button style={mini} onClick={() => setTeams(ts => ts.map((x, j) => (j === i ? { ...x, score: Math.max(0, x.score - 1) } : x)))} aria-label={`Remove point from ${t.name}`}>−</button>
            </div>
          ))}
          {teams.length < 4 && <button style={mini} onClick={() => setTeams(ts => [...ts, { name: `Team ${'ABCD'[ts.length]}`, score: 0 }])}>+ Team</button>}
        </div>
      </div>
    </div>
  )
}

const btn = { background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const mini = { ...btn, padding: '4px 9px', fontSize: 12 }
const sel = { background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 10, padding: '6px 8px', fontSize: 12.5, fontFamily: 'inherit' }
