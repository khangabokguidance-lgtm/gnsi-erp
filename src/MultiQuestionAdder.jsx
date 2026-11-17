// MultiQuestionAdder.jsx — add many questions at once as cards (no text format to remember).
// Cards are turned into the same "Q1. … A) … Ans: B" text the paste box uses, so the builder's
// existing parser, duplicate check and upload path validate and save them.
import { useRef, useState, useEffect, useMemo } from 'react'
import { PX } from './premiumUI'
import { parseQuestions } from './lib/missionSainikQuestions'
import { figFromFile } from './lib/figImage'
import { splitPastedQuestion, countQuestionStarts, applyAnswerKey } from './lib/questionPaste'
import { csvToQuestionText } from './lib/missionSainikPaper'

export const blankCard = () => ({ id: Math.random().toString(36).slice(2), question: '', a: '', b: '', c: '', d: '', ans: '', exp: '', topic: '', level: '', passage: '', type: 'normal', image: '', showMore: false, collapsed: false })
const clean = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim()
export const isEmptyCard = c => !(c.question.trim() || c.a.trim() || c.b.trim() || c.c.trim() || c.d.trim() || c.exp.trim() || c.topic.trim())

export function cardsToText(cards) {
  let lastPassage = ''
  return cards.filter(c => !isEmptyCard(c)).map((c, i) => {
    const p = c.type === 'passage' ? clean(c.passage) : ''
    let head = ''
    if (p !== lastPassage) { head = (lastPassage ? 'End passage\n' : '') + (p ? `Passage: ${p}\n` : ''); lastPassage = p }
    return `${head}Q${i + 1}. ${clean(c.question)}\nA) ${clean(c.a)}\nB) ${clean(c.b)}\nC) ${clean(c.c)}\nD) ${clean(c.d)}\nAns: ${c.ans}${c.exp.trim() ? `\nExp: ${clean(c.exp)}` : ''}${c.topic.trim() ? `\nTopic: ${clean(c.topic)}` : ''}${c.level ? `\nLevel: ${c.level}` : ''}`
  }).join('\n')
}

const missingOf = c => {
  if (isEmptyCard(c)) return null
  const m = []
  if (!c.question.trim()) m.push('question')
  ;['a', 'b', 'c', 'd'].forEach(k => { if (!c[k].trim()) m.push('option ' + k.toUpperCase()) })
  if (!c.ans) m.push('correct answer')
  if (c.type === 'figure' && !c.image) m.push('figure picture')
  if (c.type === 'passage' && !c.passage.trim() && !c.image) m.push('passage text or picture')
  return m
}

export const cardsProblems = cards => cards.filter(c => { const m = missingOf(c); return m && m.length }).length
const TYPES = [['normal', '📝 Normal'], ['figure', '🖼️ Figure'], ['passage', '📖 Passage']]
const TONES = { A: '#2563eb', B: '#7c3aed', C: '#d97706', D: '#db2777' }
const field = { width: '100%', boxSizing: 'border-box', border: `1px solid ${PX.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', background: '#fff', color: PX.ink, outline: 'none' }
const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()
const readDraft = key => { try { const d = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(d) && d.length ? d.map(c => ({ ...blankCard(), ...c, type: c.type || (c.passage ? 'passage' : 'normal'), image: c.image || '' })) : null } catch { return null } }
const writeDraft = (key, cards) => {
  try { if (cards.every(isEmptyCard)) { localStorage.removeItem(key); return }; localStorage.setItem(key, JSON.stringify(cards)) }
  catch { try { localStorage.setItem(key, JSON.stringify(cards.map(c => ({ ...c, image: '' })))) } catch { /* storage unavailable */ } }   // pictures are large: keep the text if they do not fit
}

// Paper-style rendering of the cards (same option layout rule as the printed paper).
function PaperPreview({ cards, startNo, title, showAns }) {
  const list = cards.filter(c => !isEmptyCard(c))
  let last = ''
  const serif = "Georgia,'Times New Roman',serif"
  return (
    <div style={{ background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 6, padding: '22px 24px', fontFamily: serif, color: '#111', fontSize: 14, lineHeight: 1.5, boxShadow: '0 4px 18px rgba(15,27,46,.12)' }}>
      <div style={{ border: '1px solid #111', background: '#e4e5e9', textAlign: 'center', fontVariant: 'small-caps', fontWeight: 800, letterSpacing: '.03em', padding: '3px 6px', marginBottom: 10 }}>{title}</div>
      {list.length === 0 && <div style={{ textAlign: 'center', color: '#8a93a6', fontStyle: 'italic', padding: '24px 0' }}>Start typing a question — it appears here exactly as it will print.</div>}
      {list.map((c, i) => {
        const p = c.passage.trim(); const showP = p && p !== last; last = p
        const opts = ['a', 'b', 'c', 'd'].map(k => ({ k, text: c[k].trim() }))
        const len = Math.max(...opts.map(o => o.text.length))
        const cls = len <= 11 ? 'four' : len <= 27 ? 'two' : 'one'
        const ok = c.question.trim() && opts.every(o => o.text) && c.ans
        return (
          <div key={c.id} style={{ marginBottom: 12, breakInside: 'avoid' }}>
            {(showP || (c.type === 'passage' && c.image && !p)) && <><div style={{ fontStyle: 'italic', fontWeight: 700 }}>Read the following passage and answer the questions:</div>{p && <div style={{ textAlign: 'justify', margin: '2px 0 6px', textIndent: 18 }}>{p}</div>}</>}
            <div style={{ display: 'flex', gap: 8 }}><b style={{ minWidth: 26 }}>{startNo + i}.</b><span>{c.question.trim() || <i style={{ color: '#b45309' }}>(question missing)</i>}</span></div>
            {c.type !== 'normal' && (c.image ? <div style={{ textAlign: 'center', margin: '4px 0' }}><img src={c.image} alt={c.type === 'passage' ? 'Passage' : 'Figure'} style={{ maxWidth: '100%', maxHeight: 190 }} /></div> : <div style={{ margin: '3px 0 0 26px', fontSize: 11.5, color: '#b45309', fontFamily: 'system-ui,sans-serif' }}>⚠ {c.type === 'figure' ? 'Figure picture not added yet' : ''}</div>)}
            <div style={{ margin: '3px 0 0 26px', fontStyle: 'italic', display: cls === 'two' ? 'grid' : 'flex', gridTemplateColumns: '1fr 1fr', flexDirection: cls === 'one' ? 'column' : undefined, gap: cls === 'four' ? 14 : '2px 14px', flexWrap: 'wrap' }}>
              {opts.map(o => {
                const right = showAns && c.ans === o.k.toUpperCase()
                return <span key={o.k} style={{ fontWeight: right ? 800 : 400, color: right ? '#15803d' : undefined, background: right ? '#dcfce7' : undefined, borderRadius: 4, padding: right ? '0 4px' : 0 }}>({o.k}) {o.text || <i style={{ color: '#b45309' }}>(missing)</i>}{right ? ' ✓' : ''}</span>
              })}
            </div>
            {showAns && (c.exp.trim() || c.topic.trim() || c.level) && <div style={{ margin: '4px 0 0 26px', fontSize: 12, fontFamily: 'system-ui,sans-serif', color: '#5d6b82' }}>{[c.level, c.topic.trim()].filter(Boolean).join(' · ')}{c.exp.trim() ? ` — ${c.exp.trim()}` : ''}</div>}
            {!ok && <div style={{ margin: '3px 0 0 26px', fontSize: 11.5, color: '#b45309', fontFamily: 'system-ui,sans-serif' }}>⚠ Incomplete — won't upload until fixed</div>}
          </div>
        )
      })}
    </div>
  )
}

export default function MultiQuestionAdder({ cards, setCards, remaining, startNo = 1, title = 'Section', existing = [], draftKey, isMobile }) {
  const refs = useRef({})
  const [view, setView] = useState(isMobile ? 'edit' : 'split')   // edit | split | preview
  const [showAns, setShowAns] = useState(true)
  const [restored, setRestored] = useState(false)
  const [bulk, setBulk] = useState({ level: '', topic: '' })
  const loaded = useRef(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const bulkClean = useMemo(() => applyAnswerKey(bulkText), [bulkText])
  const bulk2 = useMemo(() => parseQuestions(bulkClean), [bulkClean])
  const loadBulkFile = e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const r = new FileReader(); r.onload = () => setBulkText(/\.csv$/i.test(f.name) ? csvToQuestionText(String(r.result || '')) : String(r.result || '')); r.readAsText(f) }
  const addBulk = () => {
    if (!bulk2.questions.length) return
    const made = bulk2.questions.map(q => ({ ...blankCard(), question: q.question, a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d, ans: q.answer, exp: q.explanation || '', topic: q.topic || '', level: q.difficulty || '', type: q.passage ? 'passage' : 'normal', passage: q.passage || '' }))
    setCards(cs => [...(cs.every(isEmptyCard) ? [] : cs), ...made])
    setBulkText(''); setBulkOpen(false)
  }
  // Paste a whole question (with its options) into the question box → it fills the card. Several questions → bulk paste.
  const onQuestionPaste = (e, id) => {
    const text = e.clipboardData?.getData('text') || ''
    if (!/\n/.test(text)) return
    if (countQuestionStarts(text) >= 2) { e.preventDefault(); setBulkText(text); setBulkOpen(true); return }
    const f = splitPastedQuestion(text)
    if (f) { e.preventDefault(); upd(id, f) }
  }
  const onCardPaste = (e, c) => {
    const file = [...(e.clipboardData?.files || [])].find(x => /^image\//.test(x.type))
    if (file) { e.preventDefault(); setImgErr(''); upd(c.id, { type: c.type === 'normal' ? 'figure' : c.type }); pickImage(c.id, file) }
  }
  const onCardDrop = (e, c) => {
    const file = [...(e.dataTransfer?.files || [])].find(x => /^image\//.test(x.type))
    if (file) { e.preventDefault(); setImgErr(''); upd(c.id, { type: c.type === 'normal' ? 'figure' : c.type }); pickImage(c.id, file) }
  }
  const onCardKey = (e, c) => {
    if (e.altKey && /^[a-d]$/i.test(e.key)) { e.preventDefault(); upd(c.id, { ans: e.key.toUpperCase() }) }   // Alt+A…D marks the answer
    else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addAfter(c.id, 1, c) }      // Ctrl+Enter: next question
  }
  const pickImage = async (id, file) => { try { upd(id, { image: await figFromFile(file) }) } catch (er) { setImgErr(er.message) } }
  const [imgErr, setImgErr] = useState('')

  // Each section has its own draft: load it when this section opens, autosave as you type.
  useEffect(() => {
    loaded.current = false
    const d = draftKey ? readDraft(draftKey) : null
    setCards(d || [blankCard()]); setRestored(!!d)
    const t = setTimeout(() => { loaded.current = true }, 0)
    return () => clearTimeout(t)
  }, [draftKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftKey || !loaded.current) return
    const t = setTimeout(() => writeDraft(draftKey, cards), 400)
    return () => clearTimeout(t)
  }, [cards, draftKey])

  const upd = (id, patch) => setCards(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)))
  const addAfter = (id, n = 1, copyFrom) => setCards(cs => {
    const i = id ? cs.findIndex(c => c.id === id) : cs.length - 1
    const fresh = Array.from({ length: n }, () => ({ ...blankCard(), ...(copyFrom ? { topic: copyFrom.topic, level: copyFrom.level, type: copyFrom.type === 'passage' ? 'passage' : 'normal', passage: copyFrom.type === 'passage' ? copyFrom.passage : '', showMore: copyFrom.showMore } : {}) }))
    const next = [...cs.slice(0, i + 1), ...fresh, ...cs.slice(i + 1)]
    setTimeout(() => refs.current[fresh[0].id]?.focus(), 30)
    return next
  })
  const [undo, setUndo] = useState(null)   // { card, index } of the last removed question
  const undoTimer = useRef(null)
  const remove = id => {
    const i = cards.findIndex(c => c.id === id)
    if (i >= 0 && !isEmptyCard(cards[i])) { setUndo({ card: cards[i], index: i }); clearTimeout(undoTimer.current); undoTimer.current = setTimeout(() => setUndo(null), 8000) }
    setCards(cs => (cs.length > 1 ? cs.filter(c => c.id !== id) : [blankCard()]))
  }
  const doUndo = () => { if (!undo) return; setCards(cs => { const base = cs.length === 1 && isEmptyCard(cs[0]) ? [] : cs; const n = [...base]; n.splice(Math.min(undo.index, n.length), 0, undo.card); return n }); setUndo(null) }
  const dup = c => setCards(cs => { const i = cs.findIndex(x => x.id === c.id); return [...cs.slice(0, i + 1), { ...c, id: blankCard().id }, ...cs.slice(i + 1)] })
  const move = (id, d) => setCards(cs => { const i = cs.findIndex(c => c.id === id), j = i + d; if (j < 0 || j >= cs.length) return cs; const n = [...cs]; [n[i], n[j]] = [n[j], n[i]]; return n })
  const filled = cards.filter(c => !isEmptyCard(c))
  const ready = filled.filter(c => missingOf(c).length === 0).length
  const existingSet = useMemo(() => new Set(existing.map(norm)), [existing])
  const seenAt = useMemo(() => { const m = {}; const out = {}; filled.forEach((c, i) => { const k = norm(c.question); if (!k) return; if (m[k] != null) out[c.id] = `Same as question ${startNo + m[k]} above`; else m[k] = i; if (existingSet.has(k)) out[c.id] = 'Already in this section' }); return out }, [cards, existingSet, startNo]) // eslint-disable-line react-hooks/exhaustive-deps
  const dupCount = Object.keys(seenAt).length
  const numOf = id => { const i = filled.findIndex(c => c.id === id); return i < 0 ? null : startNo + i }
  const applyBulk = () => setCards(cs => cs.map(c => (isEmptyCard(c) ? c : { ...c, ...(bulk.level ? { level: bulk.level } : {}), ...(bulk.topic.trim() ? { topic: bulk.topic.trim() } : {}) })))
  const showEdit = view !== 'preview', showPrev = view !== 'edit'
  const seg = on => ({ padding: '7px 12px', borderRadius: 9, border: 'none', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 4px rgba(15,27,46,.15)' : 'none', color: on ? PX.ink : PX.sub, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' })
  const gbtn = { padding: '7px 12px', fontSize: 12.5 }

  return (
    <div>
      {restored && (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', marginBottom: 10, borderRadius: 12, background: '#eef6ff', border: '1px solid #c9ddf5', fontSize: 13, color: '#1e3a6e' }}>
          <span style={{ flex: 1 }}>📝 Your unsent draft for this section was restored.</span>
          <button type="button" className="px-btn ghost" style={gbtn} onClick={() => { setCards([blankCard()]); setRestored(false) }}>Discard draft</button>
          <button type="button" onClick={() => setRestored(false)} aria-label="Dismiss" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '1 1 200px', fontSize: 13, color: PX.sub }}>
          <b style={{ color: PX.ink }}>{ready} ready</b>{filled.length > ready ? <span style={{ color: '#b45309' }}> · {filled.length - ready} incomplete</span> : null}{dupCount ? <span style={{ color: PX.bad }}> · {dupCount} duplicate</span> : null}
          {typeof remaining === 'number' && <span> · {remaining > 0 ? `${remaining} more needed` : 'section is full'}</span>}
          {draftKey && <span style={{ color: PX.faint }}> · draft auto-saved</span>}
        </div>
        <div role="tablist" aria-label="View" style={{ display: 'inline-flex', padding: 3, background: '#f4f1e8', borderRadius: 12, gap: 2 }}>
          <button type="button" role="tab" aria-selected={view === 'edit'} style={seg(view === 'edit')} onClick={() => setView('edit')}>✏️ Edit</button>
          {!isMobile && <button type="button" role="tab" aria-selected={view === 'split'} style={seg(view === 'split')} onClick={() => setView('split')}>◫ Side by side</button>}
          <button type="button" role="tab" aria-selected={view === 'preview'} style={seg(view === 'preview')} onClick={() => setView('preview')}>👁 Preview</button>
        </div>
      </div>
      {showEdit && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" className="px-btn ghost" style={{ ...gbtn, width: '100%', borderStyle: 'dashed' }} aria-expanded={bulkOpen} onClick={() => setBulkOpen(v => !v)}>{bulkOpen ? '▾' : '▸'} 📋 Bulk paste — add many questions at once</button>
          {bulkOpen && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 14, background: '#faf8f3', border: `1px solid ${PX.line}` }}>
              <div style={{ fontSize: 12.5, color: PX.sub, marginBottom: 6 }}>Paste from Word, Excel or a text file. Each question: the question, options A–D, <b>Ans: B</b> (optional <b>Exp:</b>, <b>Topic:</b>, <b>Level:</b>). Have the answers at the end instead? Add a line like <b>Answer key: 1-B 2-C 3-A</b>. For a reading passage put a <b>Passage: …</b> line before its questions. They become cards you can check, then add pictures to the figure and passage questions.</div>
              <pre style={{ background: '#fff', border: `1px solid ${PX.line}`, padding: 8, borderRadius: 8, fontSize: 12, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{'Q1. What is 3/4 + 1/4?\nA) 1/2\nB) 1\nC) 3/4\nD) 2\nAns: B'}</pre>
              <textarea rows={8} style={{ ...field, fontFamily: 'monospace', fontSize: isMobile ? 16 : 12, resize: 'vertical' }} placeholder="Paste questions here…" aria-label="Bulk paste questions" value={bulkText} onChange={e => setBulkText(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <label className="px-btn ghost" style={{ ...gbtn, cursor: 'pointer' }}>📂 Load .txt / .csv<input type="file" accept=".txt,.csv,text/plain,text/csv" aria-label="Load questions from a file" style={{ display: 'none' }} onChange={loadBulkFile} /></label>
                <span style={{ fontSize: 12.5, color: bulk2.errors.length ? PX.bad : PX.sub }}>{bulkText.trim() ? (bulk2.errors.length ? bulk2.errors.slice(0, 2).join(' · ') : `${bulk2.questions.length} question(s) found`) : ''}{bulkText.trim() && bulk2.errors.length && bulk2.questions.length ? ` · ${bulk2.questions.length} OK` : ''}</span>
                <button type="button" className="px-btn ghost" style={{ ...gbtn, marginLeft: 'auto' }} onClick={() => { setBulkText(''); setBulkOpen(false) }}>Cancel</button>
                <button type="button" className="px-btn gold" style={gbtn} disabled={!bulk2.questions.length} onClick={addBulk}>Add {bulk2.questions.length || ''} to cards</button>
              </div>
            </div>
          )}
        </div>
      )}
      {showEdit && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', marginBottom: 10, borderRadius: 12, background: '#faf8f3', border: `1px solid ${PX.line}` }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>Apply to all</span>
          {['Easy', 'Medium', 'Hard'].map(l => <button key={l} type="button" aria-pressed={bulk.level === l} onClick={() => setBulk(b => ({ ...b, level: b.level === l ? '' : l }))} style={{ padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${bulk.level === l ? PX.gold : PX.line}`, background: bulk.level === l ? PX.goldBg : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
          <input style={{ ...field, width: 150, padding: '6px 10px', fontSize: 13 }} placeholder="Topic for all…" aria-label="Topic for all" value={bulk.topic} onChange={e => setBulk(b => ({ ...b, topic: e.target.value }))} />
          <button type="button" className="px-btn ghost" style={gbtn} disabled={!bulk.level && !bulk.topic.trim()} onClick={applyBulk}>Apply</button>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" className="px-btn ghost" style={gbtn} onClick={() => setCards(cs => cs.map(c => ({ ...c, collapsed: true })))}>Collapse all</button>
            <button type="button" className="px-btn ghost" style={gbtn} onClick={() => setCards(cs => cs.map(c => ({ ...c, collapsed: false })))}>Expand all</button>
          </span>
        </div>
      )}
      {undo && <div role="status" style={{ position: 'sticky', top: 8, zIndex: 6, display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px', padding: '9px 14px', borderRadius: 12, background: '#243049', color: '#fff', fontSize: 13.5 }}><span style={{ flex: 1 }}>Question removed.</span><button type="button" onClick={doUndo} style={{ border: 'none', background: '#e9d9b0', color: '#132a4f', borderRadius: 8, padding: '6px 12px', fontWeight: 800, cursor: 'pointer' }}>Undo</button><button type="button" aria-label="Dismiss" onClick={() => setUndo(null)} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button></div>}
      {imgErr && <div role="alert" style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 10, background: '#fdecea', color: '#8f1d14', fontSize: 13 }}>❌ {imgErr} <button type="button" onClick={() => setImgErr('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>×</button></div>}
      <div style={{ display: 'grid', gridTemplateColumns: view === 'split' ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 16, alignItems: 'start' }}>
        {showEdit && (
          <div>
            <div style={{ display: 'grid', gap: 12 }}>
              {cards.map((c, i) => {
                const miss = missingOf(c)
                const ok = miss && miss.length === 0
                const dupMsg = seenAt[c.id]
                const n = numOf(c.id)
                return (
                  <div key={c.id} onPaste={e => onCardPaste(e, c)} onDragOver={e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault() }} onDrop={e => onCardDrop(e, c)} onKeyDown={e => onCardKey(e, c)} style={{ border: `1.5px solid ${dupMsg ? '#f5b5b0' : ok ? '#bfe3cc' : miss ? '#f1d9a8' : PX.line}`, borderRadius: 16, background: ok && !dupMsg ? '#f7fcf9' : '#fff', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: c.collapsed ? 'none' : `1px solid ${PX.line}`, background: '#fcfbf7' }}>
                      <button type="button" onClick={() => upd(c.id, { collapsed: !c.collapsed })} aria-expanded={!c.collapsed} aria-label={c.collapsed ? 'Expand question' : 'Collapse question'} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: PX.navy, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>{n ?? i + 1}</button>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: dupMsg ? PX.bad : ok ? PX.ok : miss ? '#b45309' : PX.faint, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.collapsed && c.question.trim() ? c.question.trim() : dupMsg ? '⚠ ' + dupMsg : ok ? '✓ Ready' : miss ? 'Missing: ' + miss.join(', ') : 'Empty'}
                      </span>
                      <button type="button" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(c.id, -1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, opacity: i === 0 ? .3 : 1 }}>▲</button>
                      <button type="button" aria-label="Move down" title="Move down" disabled={i === cards.length - 1} onClick={() => move(c.id, 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, opacity: i === cards.length - 1 ? .3 : 1 }}>▼</button>
                      <button type="button" aria-label="Duplicate question" title="Duplicate" onClick={() => dup(c)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 }}>⧉</button>
                      <button type="button" aria-label="Remove question" title="Remove" onClick={() => remove(c.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 }}>🗑</button>
                    </div>
                    {!c.collapsed && (
                      <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Question type">
                          {TYPES.map(([k, l]) => <button key={k} type="button" aria-pressed={c.type === k} onClick={() => upd(c.id, { type: k, ...(k === 'normal' ? { image: '' } : {}) })}
                            style={{ padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${c.type === k ? PX.navy : PX.line}`, background: c.type === k ? '#e4ebf6' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
                        </div>
                        {c.type === 'passage' && <textarea rows={3} style={{ ...field, resize: 'vertical', fontSize: isMobile ? 16 : 14 }} placeholder="Reading passage text — add the same text to each question that shares it (or upload the passage as a picture below)" aria-label="Passage" value={c.passage} onChange={e => upd(c.id, { passage: e.target.value })} />}
                        {c.type !== 'normal' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 12, border: `1.5px dashed ${c.image ? '#bfe3cc' : '#d9c28a'}`, background: c.image ? '#f7fcf9' : '#fffaf0' }}>
                            {c.image ? <img src={c.image} alt="Attached" style={{ maxHeight: 64, maxWidth: 110, objectFit: 'contain', borderRadius: 6, border: `1px solid ${PX.line}`, background: '#fff' }} /> : <span style={{ fontSize: 22 }}>{c.type === 'figure' ? '🖼️' : '📖'}</span>}
                            <span style={{ flex: 1, minWidth: 130, fontSize: 12.5, color: PX.sub }}>{c.image ? 'Picture attached' : c.type === 'figure' ? 'Add the figure / diagram for this question' : 'Optional: upload the passage as a picture'}</span>
                            <label className="px-btn ghost" style={{ ...gbtn, cursor: 'pointer' }}>{c.image ? 'Replace' : '📷 Add picture'}<input type="file" accept="image/*" aria-label="Upload a picture" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setImgErr(''); pickImage(c.id, f) } }} /></label>
                            {c.image && <button type="button" className="px-btn ghost" style={gbtn} onClick={() => upd(c.id, { image: '' })}>Remove</button>}
                          </div>
                        )}
                        <textarea ref={el => { refs.current[c.id] = el }} rows={2} style={{ ...field, resize: 'vertical', fontSize: isMobile ? 16 : 15 }} placeholder="Type the question — or paste a whole question with its options (A–D) and I'll split it" aria-label={`Question ${i + 1}`} value={c.question} onChange={e => upd(c.id, { question: e.target.value })} onPaste={e => onQuestionPaste(e, c.id)} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 8 }}>
                          {['A', 'B', 'C', 'D'].map(k => {
                            const on = c.ans === k
                            return (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${on ? TONES[k] : PX.line}`, background: on ? TONES[k] + '14' : '#fff', borderRadius: 12, padding: '4px 6px 4px 4px' }}>
                                <button type="button" aria-pressed={on} aria-label={`Mark ${k} as the correct answer`} title="Tap to mark correct" onClick={() => upd(c.id, { ans: on ? '' : k })}
                                  style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: on ? TONES[k] : '#f1ede3', color: on ? '#fff' : PX.ink2, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>{on ? '✓' : k}</button>
                                <input style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: isMobile ? 16 : 14, fontFamily: 'inherit', background: 'transparent', padding: '6px 2px' }} placeholder={`Option ${k}`} aria-label={`Question ${i + 1} option ${k}`} value={c[k.toLowerCase()]}
                                  onChange={e => upd(c.id, { [k.toLowerCase()]: e.target.value })}
                                  onKeyDown={e => { if (k === 'D' && e.key === 'Enter') { e.preventDefault(); addAfter(c.id, 1, c) } }} />
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>Level</span>
                          {['Easy', 'Medium', 'Hard'].map(l => <button key={l} type="button" aria-pressed={c.level === l} onClick={() => upd(c.id, { level: c.level === l ? '' : l })}
                            style={{ padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${c.level === l ? PX.gold : PX.line}`, background: c.level === l ? PX.goldBg : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
                          <button type="button" onClick={() => upd(c.id, { showMore: !c.showMore })} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: PX.navy, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{c.showMore ? '− Less' : '＋ Explanation, topic'}</button>
                        </div>
                        {c.showMore && (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <input style={field} placeholder="Topic (e.g. Fractions)" aria-label="Topic" value={c.topic} onChange={e => upd(c.id, { topic: e.target.value })} />
                            <textarea rows={2} style={{ ...field, resize: 'vertical' }} placeholder="Explanation (shown in the answer key)" aria-label="Explanation" value={c.exp} onChange={e => upd(c.id, { exp: e.target.value })} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" className="px-btn ghost" style={{ flex: 1, borderStyle: 'dashed' }} onClick={() => addAfter(null, 1, cards[cards.length - 1])}>＋ Add question</button>
              <button type="button" className="px-btn ghost" style={{ borderStyle: 'dashed' }} onClick={() => addAfter(null, 5, cards[cards.length - 1])}>＋ Add 5</button>
            </div>
            <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 6 }}>Tips: tap a letter (or Alt+A–D) to mark the answer · Enter in option D or Ctrl+Enter starts the next question · paste a whole question into the box and it splits itself · paste or drop a picture onto a card for figures · ▲▼ reorder.</div>
          </div>
        )}
        {showPrev && (
          <div style={view === 'split' ? { position: 'sticky', top: 8, maxHeight: '84vh', overflow: 'auto', borderRadius: 8 } : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 13 }}>Live preview</b><span style={{ fontSize: 12, color: PX.sub }}>as it will print · Q{startNo}{filled.length > 1 ? `–Q${startNo + filled.length - 1}` : ''}</span>
              <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 700 }}><input type="checkbox" checked={showAns} onChange={e => setShowAns(e.target.checked)} />Show answers</label>
            </div>
            <PaperPreview cards={cards} startNo={startNo} title={title} showAns={showAns} />
          </div>
        )}
      </div>
    </div>
  )
}
