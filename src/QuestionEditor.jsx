// QuestionEditor.jsx — premium full-screen editor for questions already in the bank (Practice bank, Pre Mock, Mega Mock, Daily).
// Edit the stem, four options (text or picture), answer, level, topic, explanation, passage and figure; see it as a printed paper;
// move between the section's questions with Save & next. Maths, pictures, scanning and Venn relationship diagrams included.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { PX } from './premiumUI'
import ScanFigure from './ScanFigure'
import { MATH_TOOLS, PaperPreview, blankCard } from './MultiQuestionAdder'
import { figFromFile, svgToJpeg } from './lib/figImage'
import { hasPicture, pictureOf, withPicture, withoutPicture, withPictureRaw, withoutPictureRaw, mathPlain } from './lib/mathText'
import { vennPresetSvg, VENN_PRESETS } from './lib/vennSvg'

const TONES = { A: '#2563eb', B: '#7c3aed', C: '#d97706', D: '#db2777' }
const TYPES = [['normal', '📝 Normal'], ['figure', '🖼️ Figure'], ['venn', '🔵 Venn'], ['nonverbal', '🔷 Non-verbal'], ['passage', '📖 Passage']]
const CHAPTERS = ['Figure Series', 'Odd Figure Out', 'Mirror Image', 'Water Image', 'Paper Folding', 'Embedded Figure', 'Figure Matching', 'Pattern Completion', 'Space Visualisation', 'Geometrical Figure Completion']
const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()

// database row <-> editor card
export const toCard = q => ({
  ...blankCard(), id: q.id, question: q.question || '', a: q.option_a || '', b: q.option_b || '', c: q.option_c || '', d: q.option_d || '',
  ans: q.answer || '', exp: q.explanation || '', topic: q.topic || '', level: q.difficulty || '', passage: q.passage || '', image: q.image_data || '',
  type: q.passage ? 'passage' : q.topic === 'Venn Diagram' ? 'venn' : q.image_data ? 'figure' : 'normal',
})
const problems = c => {
  const m = []
  if (!c.question.trim()) m.push('question')
  ;['a', 'b', 'c', 'd'].forEach(k => { if (!c[k].trim()) m.push('option ' + k.toUpperCase()) })
  if (!c.ans) m.push('correct answer')
  if ((c.type === 'figure' || c.type === 'venn') && !c.image) m.push('figure')
  if (c.type === 'passage' && !c.passage.trim() && !c.image) m.push('passage')
  return m
}
const same = (a, b) => JSON.stringify([a.question, a.a, a.b, a.c, a.d, a.ans, a.exp, a.topic, a.level, a.passage, a.image, a.type]) === JSON.stringify([b.question, b.a, b.b, b.c, b.d, b.ans, b.exp, b.topic, b.level, b.passage, b.image, b.type])

export default function QuestionEditor({ list, startIndex = 0, startNo = 1, title = 'Questions', subtitle = '', canEdit, hasPictureCols, isMobile, onSave, onDelete, onClose, setMsg }) {
  const [idx, setIdx] = useState(Math.min(Math.max(startIndex, 0), Math.max(list.length - 1, 0)))
  const q = list[idx]
  const original = useMemo(() => (q ? toCard(q) : blankCard()), [q])
  const [card, setCard] = useState(original)
  const [view, setView] = useState(isMobile ? 'edit' : 'split')
  const [saving, setSaving] = useState(false), [scan, setScan] = useState(null), [presetFor, setPresetFor] = useState(null), [err, setErr] = useState(''), [showRail, setShowRail] = useState(!isMobile)
  const active = useRef(null)
  useEffect(() => { setCard(toCard(list[idx] || {})); setErr('') }, [idx, list[idx]?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !same(card, original)
  const probs = problems(card)
  const dup = useMemo(() => list.some((x, i) => i !== idx && norm(x.question) === norm(card.question) && card.question.trim()), [list, idx, card.question])
  const upd = patch => setCard(c => ({ ...c, ...patch }))
  const track = field => e => { active.current = { field, el: e.currentTarget } }
  const insertMath = (text, caret) => {
    const a = active.current
    if (!a?.el || !document.contains(a.el)) return setErr('Click inside the question, an option or the explanation first, then tap a symbol.')
    setErr('')
    const el = a.el, s = el.selectionStart ?? el.value.length, e2 = el.selectionEnd ?? s
    upd({ [a.field]: el.value.slice(0, s) + text + el.value.slice(e2) })
    setTimeout(() => { try { el.focus(); el.setSelectionRange(s + caret, s + caret) } catch { /* replaced */ } }, 20)
  }

  const go = useCallback(async d => {
    const to = idx + d; if (to < 0 || to >= list.length) return
    if (dirty && canEdit) { if (window.confirm('Save your changes to this question before moving on?\n\nOK = save, Cancel = discard.')) { const ok = await save(false); if (!ok) return } }
    setIdx(to)
  }, [idx, list.length, dirty, canEdit, card]) // eslint-disable-line react-hooks/exhaustive-deps

  const patchFor = c => {
    const patch = { question: c.question.trim(), option_a: c.a.trim(), option_b: c.b.trim(), option_c: c.c.trim(), option_d: c.d.trim(), answer: c.ans, explanation: c.exp.trim() || null, topic: c.topic.trim() || null, difficulty: c.level || null }
    if (hasPictureCols) { patch.passage = c.type === 'passage' ? (c.passage.trim() || null) : null; patch.image_data = c.type === 'normal' ? null : (c.image || null) }
    return patch
  }
  async function save(next) {
    if (!canEdit) return false
    if (probs.length) { setErr('Still needed: ' + probs.join(', ')); return false }
    if (dup) { setErr('Another question in this section has the same text.'); return false }
    if ((card.image || card.type !== 'normal') && !hasPictureCols) { setErr('Pictures and passages need migration 20261211 in Supabase.'); return false }
    setSaving(true); const ok = await onSave(q, patchFor(card)); setSaving(false)
    if (!ok) return false
    if (next && idx < list.length - 1) setIdx(idx + 1)
    return true
  }
  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape' && !scan && !presetFor) { if (!dirty || window.confirm('Close without saving your changes?')) onClose() }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(true) }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(false) }
      else if (e.altKey && /^[a-d]$/i.test(e.key)) { e.preventDefault(); upd({ ans: e.key.toUpperCase() }) }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }) // re-bound each render so it always sees the latest card

  const pickImg = async (file, opt) => {
    try {
      if (opt) { const u = await figFromFile(file, { maxW: 260, quality: 0.72, cap: 60000, label: 'Option picture' }); upd({ [opt]: withPicture(card[opt], u) }) }
      else upd({ image: await figFromFile(file), type: card.type === 'normal' ? 'figure' : card.type })
    } catch (e) { setErr(e.message) }
  }
  const pickPreset = async id => { const t = presetFor; setPresetFor(null); try { upd({ [t]: withPicture(card[t], await svgToJpeg(vennPresetSvg(id), 200, 120, { scale: 1.2, quality: 0.8 })) }) } catch (e) { setErr(e.message) } }

  const field = { width: '100%', boxSizing: 'border-box', border: `1.5px solid ${PX.line}`, borderRadius: 13, padding: '11px 13px', fontSize: isMobile ? 16 : 14.5, fontFamily: 'inherit', background: '#fff', color: PX.ink, outline: 'none' }
  const chip = on => ({ padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink2, whiteSpace: 'nowrap', flexShrink: 0 })
  const seg = on => ({ padding: '7px 13px', borderRadius: 10, border: 'none', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 4px rgba(15,27,46,.15)' : 'none', color: on ? PX.ink : PX.sub, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' })
  const tbtn = { minWidth: 34, height: 34, padding: '0 9px', borderRadius: 9, border: '1px solid rgba(255,255,255,.7)', background: 'rgba(255,255,255,.88)', fontSize: 14, cursor: 'pointer', fontFamily: 'Georgia,serif', fontWeight: 700, color: PX.ink, flexShrink: 0 }
  const lab = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub, margin: '14px 0 6px', display: 'block' }
  const figLike = card.type !== 'normal'
  const statusOf = x => { const c = toCard(x), m = problems(c); return m.length ? 'warn' : 'ok' }

  if (!q) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#eef1f6', display: 'flex', flexDirection: 'column' }} role="dialog" aria-modal="true" aria-label="Question editor">
      <style>{`.qe-in:focus{border-color:#b8923a!important;box-shadow:0 0 0 4px rgba(184,146,58,.18)!important;outline:none}.qe-strip{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.qe-strip::-webkit-scrollbar{display:none}.qe-row{transition:background .12s}.qe-row:hover{background:#faf6ea}`}</style>
      {/* header */}
      <div style={{ background: 'linear-gradient(135deg,#132a4f,#2f5aa3)', color: '#fff', padding: isMobile ? '10px 12px' : '12px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: '0 8px 24px -14px rgba(10,20,40,.7)' }}>
        <button type="button" aria-label="Close editor" onClick={() => { if (!dirty || window.confirm('Close without saving your changes?')) onClose() }} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: 18 }}>×</button>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#e9d9b0' }}>Question editor</div>
          <div style={{ fontFamily: PX.serif, fontSize: isMobile ? 17 : 20, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}{subtitle ? <span style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,.7)' }}> · {subtitle}</span> : null}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" aria-label="Previous question" disabled={idx === 0} onClick={() => go(-1)} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: 19, opacity: idx === 0 ? .4 : 1 }}>‹</button>
          <span style={{ fontWeight: 800, fontSize: 14, minWidth: 74, textAlign: 'center' }}>Q{startNo + idx} <span style={{ opacity: .65, fontWeight: 600 }}>of {startNo + list.length - 1}</span></span>
          <button type="button" aria-label="Next question" disabled={idx === list.length - 1} onClick={() => go(1)} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: 19, opacity: idx === list.length - 1 ? .4 : 1 }}>›</button>
        </div>
        <span style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 800, background: probs.length ? 'rgba(217,119,6,.9)' : 'rgba(15,122,76,.95)' }}>{probs.length ? '⚠ ' + probs.length + ' to fix' : '✓ Complete'}</span>
        {dirty && <span style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,.2)' }}>● Unsaved</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* question rail */}
        {(showRail && (!isMobile || true)) && !isMobile && (
          <div style={{ width: 250, flex: 'none', background: '#fff', borderRight: `1px solid ${PX.line}`, overflow: 'auto' }}>
            <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub }}>{list.length} questions</div>
            {list.map((x, i) => (
              <button key={x.id} type="button" className="qe-row" onClick={() => i !== idx && go(i - idx)} aria-current={i === idx ? 'true' : undefined}
                style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderLeft: `4px solid ${i === idx ? PX.gold : 'transparent'}`, background: i === idx ? '#faf1d9' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: statusOf(x) === 'ok' ? '#e3f4ea' : '#fdecd2', color: statusOf(x) === 'ok' ? '#14633f' : '#9a5b00', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{startNo + i}</span>
                <span style={{ fontSize: 12.5, color: PX.ink2, lineHeight: 1.35 }}>{mathPlain(x.question).slice(0, 70)}{x.question.length > 70 ? '…' : ''}{x.image_data ? ' 🖼' : ''}</span>
              </button>))}
          </div>
        )}

        {/* editor + preview */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: isMobile ? 10 : 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div role="tablist" aria-label="View" style={{ display: 'inline-flex', padding: 3, background: '#e4e8f0', borderRadius: 12, gap: 2 }}>
              <button type="button" role="tab" aria-selected={view === 'edit'} style={seg(view === 'edit')} onClick={() => setView('edit')}>✏️ Edit</button>
              {!isMobile && <button type="button" role="tab" aria-selected={view === 'split'} style={seg(view === 'split')} onClick={() => setView('split')}>◫ Side by side</button>}
              <button type="button" role="tab" aria-selected={view === 'preview'} style={seg(view === 'preview')} onClick={() => setView('preview')}>👁 Preview</button>
            </div>
            {!canEdit && <span style={{ fontSize: 12.5, color: PX.warn, fontWeight: 700 }}>🔒 View only — only this section's setter or an admin can edit.</span>}
            {isMobile && <select aria-label="Jump to question" style={{ ...field, width: 'auto', padding: '6px 10px', fontSize: 13, marginLeft: 'auto' }} value={idx} onChange={e => go(Number(e.target.value) - idx)}>{list.map((x, i) => <option key={x.id} value={i}>Q{startNo + i} {statusOf(x) === 'ok' ? '✓' : '⚠'}</option>)}</select>}
          </div>
          {err && <div role="alert" style={{ margin: '0 0 10px', padding: '9px 13px', borderRadius: 12, background: '#fdecea', color: '#8f1d14', fontSize: 13.5 }}>❌ {err} <button type="button" onClick={() => setErr('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 6 }}>×</button></div>}
          <div style={{ display: 'grid', gridTemplateColumns: view === 'split' ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 18, alignItems: 'start' }}>
            {view !== 'preview' && (
              <fieldset disabled={!canEdit} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
                <div style={{ position: 'sticky', top: 0, zIndex: 4, borderRadius: 14, padding: '7px 8px', marginBottom: 6, background: 'linear-gradient(135deg,rgba(255,250,240,.97),rgba(250,241,217,.94))', border: '1px solid #ead9a8', boxShadow: '0 6px 18px -12px rgba(19,42,79,.4)' }}>
                  <div className="qe-strip" role="toolbar" aria-label="Maths symbols" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a6118', flexShrink: 0, marginRight: 4 }}>Maths</span>
                    {MATH_TOOLS.map(([l, t, c, ttl]) => <button key={ttl} type="button" title={ttl} aria-label={ttl} onMouseDown={e => e.preventDefault()} onClick={() => insertMath(t, c)} style={tbtn}>{l}</button>)}
                  </div>
                </div>
                <span style={lab}>Question type</span>
                <div className="qe-strip">{TYPES.map(([k, l]) => <button key={k} type="button" aria-pressed={card.type === k} onClick={() => upd({ type: k, ...(k === 'normal' ? { image: '' } : {}), ...(k === 'venn' && !card.topic ? { topic: 'Venn Diagram' } : {}) })} style={{ ...chip(card.type === k), borderColor: card.type === k ? PX.navy : PX.line, background: card.type === k ? '#e4ebf6' : '#fff' }}>{l}</button>)}</div>

                {card.type === 'passage' && <><span style={lab}>Reading passage</span><textarea className="qe-in" rows={4} style={{ ...field, resize: 'vertical' }} aria-label="Passage" placeholder="Passage text — questions that share the same passage text are grouped under it when printed" value={card.passage} onChange={e => upd({ passage: e.target.value })} onFocus={track('passage')} /></>}
                {figLike && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 12px', borderRadius: 14, border: `1.5px dashed ${card.image ? '#bfe3cc' : '#d9c28a'}`, background: card.image ? '#f7fcf9' : '#fffaf0' }}>
                    {card.image ? <img src={card.image} alt="Attached" style={{ maxHeight: 70, maxWidth: 120, objectFit: 'contain', borderRadius: 8, border: `1px solid ${PX.line}`, background: '#fff' }} /> : <span style={{ fontSize: 24 }}>{card.type === 'passage' ? '📖' : card.type === 'venn' ? '🔵' : '🖼️'}</span>}
                    <span style={{ flex: 1, minWidth: 120, fontSize: 12.5, color: PX.sub }}>{card.image ? 'Picture attached' : card.type === 'passage' ? 'Optional: the passage as a picture' : 'Add the figure for this question'}</span>
                    <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => setScan({})}>📷 Scan</button>
                    <label className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }}>⬆ {card.image ? 'Replace' : 'Upload'}<input type="file" accept="image/*" aria-label="Upload a picture" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickImg(f) }} /></label>
                    {card.image && <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => upd({ image: '' })}>Remove</button>}
                  </div>
                )}
                <span style={lab}>Question</span>
                <textarea className="qe-in" rows={3} style={{ ...field, resize: 'vertical', fontSize: isMobile ? 16 : 15.5, lineHeight: 1.5 }} aria-label="Question" placeholder="Type the question…" value={card.question} onChange={e => upd({ question: e.target.value })} onFocus={track('question')} />
                {dup && <div style={{ fontSize: 12.5, color: PX.bad, marginTop: 4 }}>⚠ Another question in this section has the same text.</div>}

                <span style={lab}>Options — tap the letter to mark the correct answer (Alt+A–D)</span>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  {['A', 'B', 'C', 'D'].map(k => {
                    const key = k.toLowerCase(), on = card.ans === k, pic = hasPicture(card[key])
                    return (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1.5px solid ${on ? TONES[k] : PX.line}`, background: on ? TONES[k] + '14' : '#fff', borderRadius: 14, padding: '5px 8px 5px 5px' }}>
                        <button type="button" aria-pressed={on} aria-label={`Mark ${k} as correct`} onClick={() => upd({ ans: k })} style={{ width: 36, height: 36, borderRadius: 11, border: 'none', background: on ? TONES[k] : '#f1ede3', color: on ? '#fff' : PX.ink2, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>{on ? '✓' : k}</button>
                        {pic && <img src={pictureOf(card[key])} alt={`Option ${k}`} style={{ height: 36, maxWidth: 70, objectFit: 'contain', borderRadius: 6, border: `1px solid ${PX.line}`, background: '#fff', flexShrink: 0 }} />}
                        <input style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: isMobile ? 16 : 14.5, background: 'transparent', fontFamily: 'inherit', padding: '6px 2px' }} aria-label={`Option ${k}`} placeholder={pic ? 'Optional caption' : `Option ${k}`} value={withoutPictureRaw(card[key])} onFocus={track(key)}
                          onChange={e => upd({ [key]: withPictureRaw(e.target.value, pictureOf(card[key])) })} />
                        {card.type === 'venn' && <button type="button" title="Pick a Venn relationship diagram" aria-label={`Venn diagram for option ${k}`} onClick={() => setPresetFor(key)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>🔵</button>}
                        <button type="button" title="Scan a picture" aria-label={`Scan a picture for option ${k}`} onClick={() => setScan({ opt: key })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, opacity: .6, flexShrink: 0 }}>📷</button>
                        <label title="Upload a picture" style={{ cursor: 'pointer', fontSize: 16, opacity: pic ? 1 : .55, flexShrink: 0 }}>🖼<input type="file" accept="image/*" aria-label={`Picture for option ${k}`} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickImg(f, key) }} /></label>
                        {pic && <button type="button" aria-label={`Remove picture from option ${k}`} onClick={() => upd({ [key]: withoutPicture(card[key]) })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: PX.sub, flexShrink: 0 }}>×</button>}
                      </div>
                    )
                  })}
                </div>

                <span style={lab}>Level</span>
                <div className="qe-strip">{['Easy', 'Medium', 'Hard'].map(l => <button key={l} type="button" aria-pressed={card.level === l} style={chip(card.level === l)} onClick={() => upd({ level: card.level === l ? '' : l })}>{l}</button>)}</div>
                <span style={lab}>Topic</span>
                <input className="qe-in" style={field} aria-label="Topic" placeholder="e.g. Fractions" value={card.topic} onChange={e => upd({ topic: e.target.value })} />
                {(card.type === 'nonverbal' || card.type === 'figure') && <div className="qe-strip" style={{ marginTop: 6, flexWrap: 'wrap' }}>{CHAPTERS.map(ch => <button key={ch} type="button" style={{ ...chip(card.topic === ch), padding: '3px 9px', fontSize: 11.5 }} onClick={() => upd({ topic: card.topic === ch ? '' : ch })}>{ch}</button>)}</div>}
                <span style={lab}>Explanation (shown in the answer key)</span>
                <textarea className="qe-in" rows={3} style={{ ...field, resize: 'vertical' }} aria-label="Explanation" placeholder="Why is the answer correct?" value={card.exp} onChange={e => upd({ exp: e.target.value })} onFocus={track('exp')} />
              </fieldset>
            )}
            {view !== 'edit' && (
              <div style={view === 'split' ? { position: 'sticky', top: 8, maxHeight: 'calc(100vh - 170px)', overflow: 'auto' } : undefined}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><b style={{ fontSize: 13 }}>Live preview</b><span style={{ fontSize: 12, color: PX.sub }}>as it will print · Q{startNo + idx}</span></div>
                <PaperPreview cards={[card]} startNo={startNo + idx} title={title} showAns />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ background: '#fff', borderTop: `1px solid ${PX.line}`, padding: `10px ${isMobile ? 12 : 20}px calc(10px + env(safe-area-inset-bottom))`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 -8px 24px -18px rgba(19,42,79,.4)' }}>
        <span style={{ fontSize: 12.5, color: probs.length ? '#b45309' : PX.sub, flex: '1 1 160px' }}>{probs.length ? 'Still needed: ' + probs.join(', ') : 'Ctrl+S saves · Ctrl+Enter saves and goes to the next question'}</span>
        {canEdit && <button className="px-btn ghost" style={{ minHeight: 44 }} disabled={!dirty} onClick={() => { setCard(original); setErr('') }}>↺ Revert</button>}
        {canEdit && onDelete && <button className="px-btn ghost" style={{ minHeight: 44, color: PX.bad }} onClick={async () => { await onDelete(q); onClose() }}>🗑</button>}
        {canEdit && <button className="px-btn ghost" style={{ minHeight: 44 }} disabled={saving || !dirty} onClick={() => save(false)}>{saving ? 'Saving…' : '✔ Save'}</button>}
        {canEdit && <button className="px-btn gold" style={{ minHeight: 44 }} disabled={saving || (!dirty && idx === list.length - 1)} onClick={() => (dirty ? save(true) : go(1))}>{idx === list.length - 1 ? '✔ Save' : dirty ? 'Save & next ›' : 'Next ›'}</button>}
        {!canEdit && <button className="px-btn gold" style={{ minHeight: 44 }} onClick={onClose}>Close</button>}
      </div>

      {scan && <ScanFigure title={scan.opt ? `Scan a picture for option ${scan.opt.toUpperCase()}` : 'Scan a figure'} {...(scan.opt ? { maxW: 260, quality: 0.72, cap: 60000, label: 'Option picture' } : {})} onClose={() => setScan(null)} onDone={u => { const t = scan; setScan(null); if (t.opt) upd({ [t.opt]: withPicture(card[t.opt], u) }); else upd({ image: u, type: card.type === 'normal' ? 'figure' : card.type }) }} />}
      {presetFor && (
        <div onClick={() => setPresetFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div role="dialog" aria-label="Venn relationship diagrams" onClick={e => e.stopPropagation()} style={{ width: 'min(520px,100%)', maxHeight: '86vh', overflow: 'auto', background: '#fff', borderRadius: 20, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}><b style={{ flex: 1, fontSize: 16 }}>Diagram for option {presetFor.toUpperCase()}</b><button type="button" aria-label="Close" onClick={() => setPresetFor(null)} style={{ border: 'none', background: '#f1ede3', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }}>×</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
              {VENN_PRESETS.map(p => <button key={p.id} type="button" onClick={() => pickPreset(p.id)} style={{ border: `1.5px solid ${PX.line}`, borderRadius: 12, background: '#fff', padding: 6, cursor: 'pointer', fontFamily: 'inherit' }}><span style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: vennPresetSvg(p.id).replace(/ width="\d+" height="\d+"/, ' style="width:100%;height:auto"') }} /><span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: PX.ink2, marginTop: 2 }}>{p.name}</span></button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
