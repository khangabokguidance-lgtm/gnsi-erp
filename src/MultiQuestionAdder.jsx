// MultiQuestionAdder.jsx — add many questions at once as cards (no text format to remember).
// Cards are turned into the same "Q1. … A) … Ans: B" text the paste box uses, so the builder's
// existing parser, duplicate check and upload path validate and save them.
import { useRef, useState, useEffect, useMemo } from 'react'
import { PX } from './premiumUI'
import { parseQuestions } from './lib/missionSainikQuestions'
import { detectQuestions } from './lib/detectQuestions'
import { figFromFile, svgToJpeg } from './lib/figImage'
import { vennSvg, vennPresetSvg, VENN_PRESETS } from './lib/vennSvg'
import ScanFigure from './ScanFigure'
import StripSplit, { splitFileAuto } from './StripSplit'
import ChartMaker from './ChartMaker'
import { splitPastedQuestion, countQuestionStarts, applyAnswerKey } from './lib/questionPaste'
import { csvToQuestionText } from './lib/missionSainikPaper'
import { mathToHtml, mathPlain, hasPicture, pictureOf, withPicture, withoutPicture, withPictureRaw, withoutPictureRaw } from './lib/mathText'

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
  if ((c.type === 'figure' || c.type === 'venn') && !c.image) m.push(c.type === 'venn' ? 'Venn diagram' : 'figure picture')
  if (c.type === 'nonverbal' && !c.image && !allOptionPictures(c)) m.push('figure or picture options')
  if (c.type === 'passage' && !c.passage.trim() && !c.image) m.push('passage text or picture')
  return m
}

export const cardsProblems = cards => cards.filter(c => { const m = missingOf(c); return m && m.length }).length
// Insert buttons for the maths toolbar: [label, text, caret offset from the start of the insert, title]
export const MATH_TOOLS = [
  ['a⁄b', '\\frac{}{}', 6, 'Fraction (type the top, then the bottom)'], ['½', '½', 1, 'One half'], ['¼', '¼', 1, 'One quarter'], ['¾', '¾', 1, 'Three quarters'],
  ['x²', '^{2}', 4, 'Power / square'], ['xⁿ', '^{}', 2, 'Power'], ['x₂', '_{}', 2, 'Subscript'], ['√', '\\sqrt{}', 6, 'Square root'],
  ['×', '×', 1, 'Multiply'], ['÷', '÷', 1, 'Divide'], ['±', '±', 1, 'Plus or minus'], ['≤', '≤', 1, 'Less than or equal'], ['≥', '≥', 1, 'Greater than or equal'], ['≠', '≠', 1, 'Not equal'],
  ['π', 'π', 1, 'Pi'], ['°', '°', 1, 'Degree'], ['∠', '∠', 1, 'Angle'], ['△', '△', 1, 'Triangle'], ['∴', '∴', 1, 'Therefore'], ['→', '→', 1, 'Arrow'], ['₹', '₹', 1, 'Rupee'],
]
const TYPES = [['normal', '📝 Normal'], ['figure', '🖼️ Figure'], ['venn', '🔵 Venn diagram'], ['nonverbal', '🔷 Non-verbal figure'], ['passage', '📖 Passage']]
// Intelligence "picture" chapters (names match the official syllabus) — tapping one sets the question's topic.
const PICTURE_CHAPTERS = ['Figure Series', 'Odd Figure Out', 'Mirror Image', 'Water Image', 'Paper Folding', 'Embedded Figure', 'Figure Matching', 'Pattern Completion', 'Figure Series Completion', 'Geometrical Figure Completion', 'Space Visualisation', 'Counting Figures']
const allOptionPictures = c => ['a', 'b', 'c', 'd'].every(k => hasPicture(c[k]))
const TONES = { A: '#2563eb', B: '#7c3aed', C: '#d97706', D: '#db2777' }
const field = { width: '100%', boxSizing: 'border-box', border: `1px solid ${PX.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', background: '#fff', color: PX.ink, outline: 'none' }
const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()
const readDraft = key => { try { const d = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(d) && d.length ? d.map(c => ({ ...blankCard(), ...c, type: c.type || (c.passage ? 'passage' : 'normal'), image: c.image || '' })) : null } catch { return null } }
const writeDraft = (key, cards) => {
  try { if (cards.every(isEmptyCard)) { localStorage.removeItem(key); return }; localStorage.setItem(key, JSON.stringify(cards)) }
  catch { try { localStorage.setItem(key, JSON.stringify(cards.map(c => ({ ...c, image: '' })))) } catch { /* storage unavailable */ } }   // pictures are large: keep the text if they do not fit
}

// Questions read from pasted text → the card shape the paper preview draws.
export const questionsToCards = qs => (qs || []).map(q => ({ ...blankCard(), question: q.question || '', a: q.option_a || '', b: q.option_b || '', c: q.option_c || '', d: q.option_d || '', ans: q.answer || '', exp: q.explanation || '', topic: q.topic || '', level: q.difficulty || '', type: q.passage ? 'passage' : (q.image_data ? 'figure' : 'normal'), passage: q.passage || '', image: q.image_data || '' }))

// What pasted text will look like once uploaded: the printed paper layout, numbered where the questions will land,
// with the same warnings the cards give (missing option / answer / duplicate answer letter).
export function PastePreview({ questions, startNo = 1, title = 'Section', errors = [] }) {
  const [showAns, setShowAns] = useState(true)
  const cards = useMemo(() => questionsToCards(questions), [questions])
  const flagged = useMemo(() => cards.map((c, i) => ({ n: startNo + i, why: missingOf(c) })).filter(x => x.why && x.why.length), [cards, startNo])
  if (!cards.length && !errors.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <b style={{ fontSize: 13 }}>Preview</b><span style={{ fontSize: 12, color: PX.sub }}>as it will print · Q{startNo}{cards.length > 1 ? `–Q${startNo + cards.length - 1}` : ''}</span>
        <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 700 }}><input type="checkbox" checked={showAns} onChange={e => setShowAns(e.target.checked)} /> Show answers</label>
      </div>
      {flagged.length > 0 && <div role="status" style={{ padding: '8px 12px', borderRadius: 10, background: '#fff7e6', border: '1px solid #f1d9a8', fontSize: 12.5, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Check before uploading: {flagged.slice(0, 6).map(x => `Q${x.n} — ${x.why.join(', ')} missing`).join(' · ')}{flagged.length > 6 ? ` · and ${flagged.length - 6} more` : ''}</div>}
      {errors.length > 0 && <div role="alert" style={{ padding: '8px 12px', borderRadius: 10, background: '#fdecea', fontSize: 12.5, fontWeight: 700, color: PX.bad, marginBottom: 8 }}>Not in the preview until fixed: {errors.slice(0, 4).join(' · ')}{errors.length > 4 ? ` · and ${errors.length - 4} more` : ''}</div>}
      {cards.length > 0 && <div style={{ maxHeight: 520, overflow: 'auto', borderRadius: 8 }}><PaperPreview cards={cards} startNo={startNo} title={title} showAns={showAns} /></div>}
    </div>
  )
}

// Paper-style rendering of the cards (same option layout rule as the printed paper).
export function PaperPreview({ cards, startNo, title, showAns }) {
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
        const len = Math.max(...opts.map(o => mathPlain(o.text).length))
        const cls = len <= 11 ? 'four' : len <= 27 ? 'two' : 'one'
        const ok = c.question.trim() && opts.every(o => o.text) && c.ans
        return (
          <div key={c.id} style={{ marginBottom: 12, breakInside: 'avoid' }}>
            {(showP || (c.type === 'passage' && c.image && !p)) && <><div style={{ fontStyle: 'italic', fontWeight: 700 }}>Read the following passage and answer the questions:</div>{p && <div style={{ textAlign: 'justify', margin: '2px 0 6px', textIndent: 18 }} dangerouslySetInnerHTML={{ __html: mathToHtml(p) }} />}</>}
            <div style={{ display: 'flex', gap: 8 }}><b style={{ minWidth: 26 }}>{startNo + i}.</b>{c.question.trim() ? <span dangerouslySetInnerHTML={{ __html: mathToHtml(c.question.trim()) }} /> : <i style={{ color: '#b45309' }}>(question missing)</i>}</div>
            {c.type !== 'normal' && (c.image ? <div style={{ textAlign: 'center', margin: '4px 0' }}><img src={c.image} alt={c.type === 'passage' ? 'Passage' : 'Figure'} style={{ maxWidth: '100%', maxHeight: 190 }} /></div> : <div style={{ margin: '3px 0 0 26px', fontSize: 11.5, color: '#b45309', fontFamily: 'system-ui,sans-serif' }}>⚠ {c.type === 'venn' ? 'Venn diagram not added yet' : c.type === 'nonverbal' ? (allOptionPictures(c) ? '' : 'Figure not added yet') : c.type === 'figure' ? 'Figure picture not added yet' : ''}</div>)}
            <div style={{ margin: '3px 0 0 26px', fontStyle: 'italic', display: cls === 'two' ? 'grid' : 'flex', gridTemplateColumns: '1fr 1fr', flexDirection: cls === 'one' ? 'column' : undefined, gap: cls === 'four' ? 14 : '2px 14px', flexWrap: 'wrap' }}>
              {opts.map(o => {
                const right = showAns && c.ans === o.k.toUpperCase()
                return <span key={o.k} style={{ fontWeight: right ? 800 : 400, color: right ? '#15803d' : undefined, background: right ? '#dcfce7' : undefined, borderRadius: 4, padding: right ? '0 4px' : 0 }}>({o.k}) {o.text ? <span dangerouslySetInnerHTML={{ __html: mathToHtml(o.text) }} /> : <i style={{ color: '#b45309' }}>(missing)</i>}{right ? ' ✓' : ''}</span>
              })}
            </div>
            {showAns && (c.exp.trim() || c.topic.trim() || c.level) && <div style={{ margin: '4px 0 0 26px', fontSize: 12, fontFamily: 'system-ui,sans-serif', color: '#5d6b82' }}>{[c.level, c.topic.trim()].filter(Boolean).join(' · ')}{c.exp.trim() ? <span> — <span dangerouslySetInnerHTML={{ __html: mathToHtml(c.exp.trim()) }} /></span> : null}</div>}
            {!ok && <div style={{ margin: '3px 0 0 26px', fontSize: 11.5, color: '#b45309', fontFamily: 'system-ui,sans-serif' }}>⚠ Incomplete — won't upload until fixed</div>}
          </div>
        )
      })}
    </div>
  )
}

export const ADDER_CSS = ''
export default function MultiQuestionAdder({ cards, setCards, remaining, startNo = 1, title = 'Section', existing = [], draftKey, isMobile, chapters = [], noExplanation = false }) {
  const refs = useRef({})
  const [view, setView] = useState(isMobile ? 'edit' : 'split')   // edit | split | preview
  const [showAns, setShowAns] = useState(true)
  const [restored, setRestored] = useState(false)
  const [bulk, setBulk] = useState({ level: '', topic: '' })
  const loaded = useRef(false)
  // ── undo / redo for the whole set of cards, and find & replace across them ──
  const hist = useRef({ stack: [cards], i: 0, skip: false, timer: null })
  const [, bump] = useState(0)
  useEffect(() => {
    const h = hist.current
    if (h.skip) { h.skip = false; return }
    if (h.stack[h.i] === cards) return
    clearTimeout(h.timer)
    h.timer = setTimeout(() => { if (h.stack[h.i] !== cards) { h.stack = [...h.stack.slice(0, h.i + 1), cards].slice(-60); h.i = h.stack.length - 1; bump(n => n + 1) } }, 500)
    return () => clearTimeout(h.timer)
  }, [cards])
  const flushHist = () => { const h = hist.current; clearTimeout(h.timer); if (h.stack[h.i] !== cards) { h.stack = [...h.stack.slice(0, h.i + 1), cards].slice(-60); h.i = h.stack.length - 1 } }
  const canUndo = hist.current.i > 0 || hist.current.stack[hist.current.i] !== cards, canRedo = hist.current.i < hist.current.stack.length - 1
  const undoAll = () => { flushHist(); const h = hist.current; if (h.i > 0) { h.i--; h.skip = true; setCards(h.stack[h.i]); bump(n => n + 1) } }
  const redoAll = () => { const h = hist.current; if (h.i < h.stack.length - 1) { h.i++; h.skip = true; setCards(h.stack[h.i]); bump(n => n + 1) } }
  const [fr, setFr] = useState({ open: false, find: '', repl: '', cs: false })
  const TEXT_FIELDS = ['question', 'a', 'b', 'c', 'd', 'exp', 'topic', 'passage']
  const reFor = f => new RegExp(f.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), f.cs ? 'g' : 'gi')
  const frHits = useMemo(() => {
    if (!fr.open || !fr.find) return []
    const re = reFor(fr)
    return cards.map((c, i) => ({ id: c.id, i, n: TEXT_FIELDS.reduce((t, k) => t + ((withoutPicture(c[k] || '').match(re) || []).length), 0) })).filter(x => x.n)
  }, [fr, cards]) // eslint-disable-line react-hooks/exhaustive-deps
  const frTotal = frHits.reduce((t, x) => t + x.n, 0)
  const replaceEverywhere = () => {
    if (!frTotal) return
    const re = reFor(fr)
    setCards(cs => cs.map(c => { const o = { ...c }; TEXT_FIELDS.forEach(k => { const t = c[k] || ''; if (!t) return; const pic = pictureOf(t); const txt = withoutPicture(t); if (re.test(txt)) { re.lastIndex = 0; o[k] = withPicture(txt.replace(re, () => fr.repl), pic) } re.lastIndex = 0 }); return o }))
  }
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [keyText, setKeyText] = useState('')   // separate answer key box: "1-C 2-B 3-A", "1. (c)", "1 c" …
  const keyCount = useMemo(() => new Set([...keyText.matchAll(/(\d+)\s*[.):\-–]?\s*\(?([A-Da-d])\)?(?![a-z])/g)].map(m => m[1])).size, [keyText])
  const bulkClean = useMemo(() => applyAnswerKey(keyText.trim() ? bulkText.replace(/\s+$/, '') + '\nAnswer key: ' + keyText : bulkText), [bulkText, keyText])
  const bulk2 = useMemo(() => parseQuestions(bulkClean), [bulkClean])
  const bulkDet = useMemo(() => detectQuestions(bulkClean), [bulkClean])   // does the pasted / loaded text hold questions at all?
  const loadBulkFile = e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const r = new FileReader(); r.onload = () => setBulkText(/\.csv$/i.test(f.name) ? csvToQuestionText(String(r.result || '')) : String(r.result || '')); r.readAsText(f) }
  const addBulk = () => {
    if (!bulk2.questions.length) return
    const made = bulk2.questions.map(q => ({ ...blankCard(), question: q.question, a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d, ans: q.answer, exp: q.explanation || '', topic: q.topic || '', level: q.difficulty || '', type: q.passage ? 'passage' : 'normal', passage: q.passage || '' }))
    setCards(cs => [...(cs.every(isEmptyCard) ? [] : cs), ...made])
    setBulkText(''); setKeyText(''); setBulkOpen(false)
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
  const pickOptionImage = async (id, k, file) => {
    try { const u = await figFromFile(file, { maxW: 260, quality: 0.72, cap: 60000, label: 'Option picture' }); setCards(cs => cs.map(c => (c.id === id ? { ...c, [k]: withPicture(c[k], u) } : c))) } catch (er) { setImgErr(er.message) }
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
  const activeField = useRef(null)   // { id, field, el } — the box the maths toolbar types into
  const track = (id, field) => e => { activeField.current = { id, field, el: e.currentTarget } }
  const insertMath = (text, caret) => {
    const a = activeField.current
    if (!a || !a.el || !document.contains(a.el)) { setImgErr('Click inside a question, option or explanation box first, then tap a symbol.'); return }
    setImgErr('')
    const el = a.el, start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? start
    const next = el.value.slice(0, start) + text + el.value.slice(end)
    upd(a.id, { [a.field]: next })
    setTimeout(() => { try { el.focus(); el.setSelectionRange(start + caret, start + caret) } catch { /* element replaced */ } }, 20)
  }
  const [scan, setScan] = useState(null)   // { id, k? } — scanning a figure (k = option letter for an option picture)
  const onScanned = url => {
    const t = scan; setScan(null); if (!t) return
    if (t.k) setCards(cs => cs.map(c => (c.id === t.id ? { ...c, [t.k]: withPicture(c[t.k], url) } : c)))
    else setCards(cs => cs.map(c => (c.id === t.id ? { ...c, image: url, type: c.type === 'normal' ? 'figure' : c.type } : c)))
  }
  const [strip, setStrip] = useState(null)   // { id, file } — a model-style strip picture being split into question + 4 options
  const onStripped = r => {
    const t = strip; setStrip(null); if (!t) return
    setCards(cs => cs.map(c => (c.id === t.id ? { ...c, type: 'nonverbal', image: r.image, a: withPicture('', r.options[0]), b: withPicture('', r.options[1]), c: withPicture('', r.options[2]), d: withPicture('', r.options[3]) } : c)))
  }
  // Many strip pictures at once → one figure question per picture, in file-name order (1.png, 2.png, … 10.png).
  const [bulkMsg, setBulkMsg] = useState('')
  const addStrips = async files => {
    const list = [...files].sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))
    setBulkMsg(`Reading ${list.length} picture${list.length === 1 ? '' : 's'}…`)
    const made = []; let guessed = 0
    for (const f of list) {
      try { const r = await splitFileAuto(f); if (!r.checked) guessed++; made.push({ ...blankCard(), type: 'nonverbal', image: r.image, a: withPicture('', r.options[0]), b: withPicture('', r.options[1]), c: withPicture('', r.options[2]), d: withPicture('', r.options[3]) }) } catch (er) { setBulkMsg(`${f.name}: ${er.message}`); return }
    }
    setCards(cs => [...cs.filter(c => !isEmptyCard(c)), ...made])
    setBulkMsg(`${made.length} figure question${made.length === 1 ? '' : 's'} added. Type each question, tap its correct letter${guessed ? ` · ${guessed} picture${guessed === 1 ? '' : 's'} could not be split exactly — open ✂ Strip on those to adjust` : ''}.`)
  }
  const [chartFor, setChartFor] = useState(null)   // { id, spec } — drawing a bar / line / pie chart for a Maths figure question
  const onCharted = r => {
    const t = chartFor; setChartFor(null); if (!t) return
    setCards(cs => cs.map(c => (c.id === t.id ? { ...c, image: r.image, chart: r.spec, type: c.type === 'normal' ? 'figure' : c.type } : c)))
  }
  const [vennFor, setVennFor] = useState(null)
  const [vennDraft, setVennDraft] = useState({ sets: 2, labels: ['', '', ''], v: {}, universe: true })
  const [presetFor, setPresetFor] = useState(null)   // { id, k } — picking a relationship diagram for an option
  const pickPreset = async presetId => {
    const t = presetFor; setPresetFor(null); if (!t) return
    try { const u = await svgToJpeg(vennPresetSvg(presetId), 200, 120, { scale: 1.2, quality: 0.8 }); setCards(cs => cs.map(c => (c.id === t.id ? { ...c, [t.k]: withPicture(c[t.k], u) } : c))) } catch (er) { setImgErr(er.message) }
  }
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="px-btn ghost" style={gbtn} disabled={!canUndo} onClick={undoAll} title="Undo the last change to the cards">↶ Undo</button>
            <button type="button" className="px-btn ghost" style={gbtn} disabled={!canRedo} onClick={redoAll} title="Redo">↷ Redo</button>
            <button type="button" className="px-btn ghost" style={{ ...gbtn, background: fr.open ? PX.goldBg : undefined }} aria-pressed={fr.open} onClick={() => setFr(f => ({ ...f, open: !f.open }))}>🔎 Find &amp; replace</button>
          </div>
          {fr.open && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 12, background: '#fffaf0', border: '1px solid #ead9a8', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...field, width: 150, padding: '6px 10px', fontSize: isMobile ? 16 : 13 }} aria-label="Find" placeholder="Find…" value={fr.find} onChange={e => setFr(f => ({ ...f, find: e.target.value }))} autoFocus />
              <input style={{ ...field, width: 150, padding: '6px 10px', fontSize: isMobile ? 16 : 13 }} aria-label="Replace with" placeholder="Replace with…" value={fr.repl} onChange={e => setFr(f => ({ ...f, repl: e.target.value }))} />
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={fr.cs} onChange={e => setFr(f => ({ ...f, cs: e.target.checked }))} />Aa</label>
              <button type="button" className="px-btn gold" style={gbtn} disabled={!frTotal} onClick={replaceEverywhere}>Replace all ({frTotal})</button>
              <span style={{ fontSize: 12, color: PX.sub }}>{fr.find ? (frTotal ? `in question${frHits.length === 1 ? '' : 's'}: ` : 'No matches') : 'Searches questions, options, explanations and topics'}</span>
              {frHits.map(h => <button key={h.id} type="button" onClick={() => document.getElementById('qc-' + h.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} style={{ padding: '2px 9px', borderRadius: 99, border: `1px solid ${PX.line}`, background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>#{h.i + 1} ×{h.n}</button>)}
            </div>
          )}
        </div>
      )}
      {showEdit && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" className="px-btn ghost" style={{ ...gbtn, width: '100%', borderStyle: 'dashed' }} aria-expanded={bulkOpen} onClick={() => setBulkOpen(v => !v)}>{bulkOpen ? '▾' : '▸'} 📋 Bulk paste — add many questions at once</button>
          {bulkOpen && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 14, background: '#faf8f3', border: `1px solid ${PX.line}` }}>
              <div style={{ fontSize: 12.5, color: PX.sub, marginBottom: 6 }}>Paste from Word, Excel or a text file. Each question: the question, options A–D, <b>Ans: B</b> (optional <b>Exp:</b>, <b>Topic:</b>, <b>Level:</b>). Have the answers at the end instead? Add a line like <b>Answer key: 1-B 2-C 3-A</b>. For a reading passage put a <b>Passage: …</b> line before its questions. They become cards you can check, then add pictures to the figure and passage questions.</div>
              <pre style={{ background: '#fff', border: `1px solid ${PX.line}`, padding: 8, borderRadius: 8, fontSize: 12, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{'Q1. What is 3/4 + 1/4?\nA) 1/2\nB) 1\nC) 3/4\nD) 2\nAns: B'}</pre>
              <textarea rows={8} style={{ ...field, fontFamily: 'monospace', fontSize: isMobile ? 16 : 12, resize: 'vertical' }} placeholder="Paste questions here…" aria-label="Bulk paste questions" value={bulkText} onChange={e => setBulkText(e.target.value)} />
              <textarea rows={2} style={{ ...field, fontFamily: 'monospace', fontSize: isMobile ? 16 : 12, resize: 'vertical', marginTop: 8 }} placeholder="Answer key (optional) — e.g. 1-C 2-B 3-A 4-D …" aria-label="Answer key" value={keyText} onChange={e => setKeyText(e.target.value)} />
              {keyText.trim() && <div style={{ marginTop: 4, fontSize: 12.5, color: keyCount ? '#0f7a4c' : PX.bad }}>{keyCount ? `🔑 ${keyCount} answer(s) read from the key — matched to questions by number` : 'No answers found — write them like 1-C 2-B 3-A'}</div>}
              {bulkDet.kind !== 'empty' && <div role="status" aria-label="Question detection" style={{ marginTop: 6, fontSize: 12.5, color: bulkDet.questions ? '#0f7a4c' : '#92400e' }}><b>🔎 Detected:</b> {bulkDet.text}</div>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <label className="px-btn ghost" style={{ ...gbtn, cursor: 'pointer' }}>📂 Load .txt / .csv<input type="file" accept=".txt,.csv,text/plain,text/csv" aria-label="Load questions from a file" style={{ display: 'none' }} onChange={loadBulkFile} /></label>
                <span style={{ fontSize: 12.5, color: bulk2.errors.length ? PX.bad : PX.sub }}>{bulkText.trim() ? (bulk2.errors.length ? bulk2.errors.slice(0, 2).join(' · ') : `${bulk2.questions.length} question(s) found`) : ''}{bulkText.trim() && bulk2.errors.length && bulk2.questions.length ? ` · ${bulk2.questions.length} OK` : ''}</span>
                <button type="button" className="px-btn ghost" style={{ ...gbtn, marginLeft: 'auto' }} onClick={() => { setBulkText(''); setKeyText(''); setBulkOpen(false) }}>Cancel</button>
                <button type="button" className="px-btn gold" style={gbtn} disabled={!bulk2.questions.length} onClick={addBulk}>Add {bulk2.questions.length || ''} to cards</button>
              </div>
              <PastePreview questions={bulk2.questions} errors={bulk2.errors} startNo={startNo + filled.length} title={title} />
            </div>
          )}
        </div>
      )}
      {showEdit && (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, marginBottom: 10, padding: '6px 8px', borderRadius: 12, background: '#fffaf0', border: '1px solid #ead9a8', boxShadow: '0 2px 8px rgba(19,42,79,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} role="toolbar" aria-label="Maths symbols">
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a6118', flexShrink: 0, marginRight: 4 }}>Maths</span>
            {MATH_TOOLS.map(([label, text, caret, title]) => (
              <button key={title} type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={() => insertMath(text, caret)}
                style={{ flexShrink: 0, minWidth: 36, height: 34, padding: '0 8px', borderRadius: 9, border: `1px solid ${PX.line}`, background: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "Georgia,'Times New Roman',serif", color: PX.ink }}>{label}</button>))}
          </div>
          <div style={{ fontSize: 11, color: PX.sub, margin: '4px 2px 0' }}>Click a box, then a symbol. <b>a⁄b</b> makes a stacked fraction: type the top and bottom inside the braces, e.g. <code>\frac{'{3}{4}'}</code>. Powers: <code>x^2</code> · roots: <code>\sqrt{'{16}'}</code>. The preview shows exactly how it prints.</div>
        </div>
      )}
      <datalist id="mqa-chapters">{chapters.map(ch => <option key={ch} value={ch} />)}</datalist>
      {showEdit && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', marginBottom: 10, borderRadius: 12, background: '#faf8f3', border: `1px solid ${PX.line}` }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>Apply to all</span>
          {['Easy', 'Medium', 'Hard'].map(l => <button key={l} type="button" aria-pressed={bulk.level === l} onClick={() => setBulk(b => ({ ...b, level: b.level === l ? '' : l }))} style={{ padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${bulk.level === l ? PX.gold : PX.line}`, background: bulk.level === l ? PX.goldBg : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
          {chapters.length > 0 && <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>Chapter</span>
            {chapters.map(ch => <button key={ch} type="button" title="Tag every question below with this syllabus chapter" onClick={() => setCards(cs => cs.map(c => (isEmptyCard(c) ? c : { ...c, topic: ch })))} style={{ padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${PX.line}`, background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.navy }}>{ch}</button>)}
          </span>}
          <input style={{ ...field, width: 150, padding: '6px 10px', fontSize: 13 }} list="mqa-chapters" placeholder="Topic for all…" aria-label="Topic for all" value={bulk.topic} onChange={e => setBulk(b => ({ ...b, topic: e.target.value }))} />
          <button type="button" className="px-btn ghost" style={gbtn} disabled={!bulk.level && !bulk.topic.trim()} onClick={applyBulk}>Apply</button>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" className="px-btn ghost" style={gbtn} onClick={() => setCards(cs => cs.map(c => ({ ...c, collapsed: true })))}>Collapse all</button>
            <button type="button" className="px-btn ghost" style={gbtn} onClick={() => setCards(cs => cs.map(c => ({ ...c, collapsed: false })))}>Expand all</button>
          </span>
        </div>
      )}
      {undo && <div role="status" style={{ position: 'sticky', top: 8, zIndex: 6, display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px', padding: '9px 14px', borderRadius: 12, background: '#243049', color: '#fff', fontSize: 13.5 }}><span style={{ flex: 1 }}>Question removed.</span><button type="button" onClick={doUndo} style={{ border: 'none', background: '#e9d9b0', color: '#132a4f', borderRadius: 8, padding: '6px 12px', fontWeight: 800, cursor: 'pointer' }}>Undo</button><button type="button" aria-label="Dismiss" onClick={() => setUndo(null)} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button></div>}
      {chartFor && <ChartMaker initial={chartFor.spec} onDone={onCharted} onClose={() => setChartFor(null)} />}
      {strip && <StripSplit file={strip.file} onDone={onStripped} onClose={() => setStrip(null)} />}
      {scan && <ScanFigure title={scan.k ? `Scan a picture for option ${scan.k.toUpperCase()}` : 'Scan a figure'} onDone={onScanned} onClose={() => setScan(null)} {...(scan.k ? { maxW: 260, quality: 0.72, cap: 60000, label: 'Option picture' } : {})} />}
      {presetFor && (
        <div onClick={() => setPresetFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div role="dialog" aria-label="Venn relationship diagrams" onClick={e => e.stopPropagation()} style={{ width: 'min(520px,100%)', maxHeight: '86vh', overflow: 'auto', background: '#fff', borderRadius: 18, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}><b style={{ flex: 1, fontSize: 16 }}>Pick a diagram for option {presetFor.k.toUpperCase()}</b><button type="button" aria-label="Close" onClick={() => setPresetFor(null)} style={{ border: 'none', background: '#f1ede3', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button></div>
            <div style={{ fontSize: 12.5, color: PX.sub, marginBottom: 10 }}>Relationship diagrams, e.g. "Which diagram shows Doctors, Men and Teachers?". Pick one for each option.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
              {VENN_PRESETS.map(p => (
                <button key={p.id} type="button" onClick={() => pickPreset(p.id)} style={{ border: `1.5px solid ${PX.line}`, borderRadius: 12, background: '#fff', padding: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: vennPresetSvg(p.id).replace(/ width="\d+" height="\d+"/, ' style="width:100%;height:auto"') }} />
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: PX.ink2, marginTop: 2 }}>{p.name}</span>
                </button>))}
            </div>
          </div>
        </div>
      )}
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
                  <div key={c.id} id={'qc-' + c.id} onPaste={e => onCardPaste(e, c)} onDragOver={e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault() }} onDrop={e => onCardDrop(e, c)} onKeyDown={e => onCardKey(e, c)} style={{ border: `1.5px solid ${dupMsg ? '#f5b5b0' : ok ? '#bfe3cc' : miss ? '#f1d9a8' : PX.line}`, borderRadius: 16, background: ok && !dupMsg ? '#f7fcf9' : '#fff', overflow: 'hidden' }}>
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
                      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Question type">
                          {TYPES.map(([k, l]) => <button key={k} type="button" aria-pressed={c.type === k} onClick={() => upd(c.id, { type: k, ...(k === 'normal' ? { image: '' } : {}), ...(k === 'venn' && !c.topic ? { topic: 'Venn Diagram' } : {}) })}
                            style={{ padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${c.type === k ? PX.navy : PX.line}`, background: c.type === k ? '#e4ebf6' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
                        </div>
                        {c.type === 'passage' && <textarea rows={3} style={{ ...field, resize: 'vertical', fontSize: isMobile ? 16 : 14 }} placeholder="Reading passage text — add the same text to each question that shares it (or upload the passage as a picture below)" aria-label="Passage" value={c.passage} onChange={e => upd(c.id, { passage: e.target.value })} onFocus={track(c.id, 'passage')} />}
                        {c.type !== 'normal' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 12, border: `1.5px dashed ${c.image ? '#bfe3cc' : '#d9c28a'}`, background: c.image ? '#f7fcf9' : '#fffaf0' }}>
                            {c.image ? <img src={c.image} alt="Attached" style={{ maxHeight: 64, maxWidth: 110, objectFit: 'contain', borderRadius: 6, border: `1px solid ${PX.line}`, background: '#fff' }} /> : <span style={{ fontSize: 22 }}>{c.type === 'passage' ? '📖' : c.type === 'venn' ? '🔵' : c.type === 'nonverbal' ? '🔷' : '🖼️'}</span>}
                            <span style={{ flex: 1, minWidth: 130, fontSize: 12.5, color: PX.sub }}>{c.image ? 'Picture attached' : c.type === 'venn' ? 'Draw the Venn diagram below, or upload one' : c.type === 'nonverbal' ? 'Add the question figure (or give all four options as pictures)' : c.type === 'figure' ? 'Add the figure / diagram for this question' : 'Optional: upload the passage as a picture'}</span>
                            <button type="button" className="px-btn ghost" style={gbtn} onClick={() => setScan({ id: c.id })}>📷 Scan</button>
                            {c.type === 'figure' && <button type="button" className="px-btn ghost" style={gbtn} onClick={() => setChartFor({ id: c.id, spec: c.chart || null })} title="Draw a bar graph, line graph or pie chart from numbers — labels can be in Meetei Mayek">{c.chart ? '📊 Edit chart' : '📊 Chart'}</button>}
                            {(c.type === 'figure' || c.type === 'nonverbal') && <label className="px-btn ghost" style={{ ...gbtn, cursor: 'pointer' }} title="One picture with the question figure, a divider and four option figures">✂ Strip → 4 options<input type="file" accept="image/*" aria-label="Upload a strip picture to split into question and four options" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setStrip({ id: c.id, file: f }) }} /></label>}
                            <label className="px-btn ghost" style={{ ...gbtn, cursor: 'pointer' }}>{c.image ? 'Replace' : '⬆ Upload'}<input type="file" accept="image/*" aria-label="Upload a picture" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setImgErr(''); pickImage(c.id, f) } }} /></label>
                            {c.image && <button type="button" className="px-btn ghost" style={gbtn} onClick={() => upd(c.id, { image: '' })}>Remove</button>}
                          </div>
                        )}
                        {(c.type === 'nonverbal' || c.type === 'figure') && (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>Chapter</span>
                            {PICTURE_CHAPTERS.map(ch => <button key={ch} type="button" aria-pressed={c.topic === ch} onClick={() => upd(c.id, { topic: c.topic === ch ? '' : ch })} style={{ padding: '3px 9px', borderRadius: 99, border: `1.5px solid ${c.topic === ch ? PX.gold : PX.line}`, background: c.topic === ch ? PX.goldBg : '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{ch}</button>)}
                          </div>
                        )}
                        {c.type === 'venn' && (
                          <div>
                            <button type="button" className="px-btn ghost" style={gbtn} aria-expanded={vennFor === c.id} onClick={() => setVennFor(v => (v === c.id ? null : c.id))}>{vennFor === c.id ? '▾' : '▸'} 🎨 Draw a Venn diagram</button>
                            {vennFor === c.id && (
                              <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: '#f4f8ff', border: '1px solid #cfe0f7' }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                                  {[2, 3].map(n => <button key={n} type="button" aria-pressed={vennDraft.sets === n} onClick={() => setVennDraft(d => ({ ...d, sets: n }))} style={{ padding: '4px 11px', borderRadius: 99, border: `1.5px solid ${vennDraft.sets === n ? PX.navy : PX.line}`, background: vennDraft.sets === n ? '#e4ebf6' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{n} sets</button>)}
                                  <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={vennDraft.universe} onChange={e => setVennDraft(d => ({ ...d, universe: e.target.checked }))} />Outer box</label>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 6 }}>
                                  {Array.from({ length: vennDraft.sets }, (_, i) => <input key={'l' + i} style={{ ...field, padding: '6px 9px', fontSize: 13 }} placeholder={`Name of set ${'ABC'[i]}`} aria-label={`Name of set ${'ABC'[i]}`} value={vennDraft.labels[i] || ''} onChange={e => setVennDraft(d => ({ ...d, labels: Object.assign([...d.labels], { [i]: e.target.value }) }))} />)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub, margin: '8px 0 4px' }}>Numbers or words in each part (optional)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(84px,1fr))', gap: 6 }}>
                                  {(vennDraft.sets === 3 ? [['a', 'Only A'], ['b', 'Only B'], ['c', 'Only C'], ['ab', 'A and B'], ['ac', 'A and C'], ['bc', 'B and C'], ['abc', 'All three'], ['out', 'Outside']] : [['a', 'Only A'], ['b', 'Only B'], ['ab', 'A and B'], ['out', 'Outside']]).map(([k, l]) => (
                                    <input key={k} style={{ ...field, padding: '6px 9px', fontSize: 13 }} placeholder={l} aria-label={l} value={vennDraft.v[k] || ''} onChange={e => setVennDraft(d => ({ ...d, v: { ...d.v, [k]: e.target.value } }))} />))}
                                </div>
                                <div style={{ margin: '10px 0', textAlign: 'center', background: '#fff', borderRadius: 8, border: `1px solid ${PX.line}`, padding: 6 }} dangerouslySetInnerHTML={{ __html: vennSvg(vennDraft).replace(/ width="\d+" height="\d+"/, ' style="max-width:100%;height:auto;max-height:210px"') }} />
                                <button type="button" className="px-btn gold" style={gbtn} onClick={async () => { try { const big = vennDraft.sets === 3; upd(c.id, { image: await svgToJpeg(vennSvg(vennDraft), 320, big ? 290 : 210, { scale: 1.6 }) }); setVennFor(null) } catch (er) { setImgErr(er.message) } }}>Use this diagram as the question figure</button>
                              </div>
                            )}
                          </div>
                        )}
                        <textarea ref={el => { refs.current[c.id] = el }} rows={2} style={{ ...field, resize: 'vertical', fontSize: isMobile ? 16 : 15 }} placeholder="Type the question — or paste a whole question with its options (A–D) and I'll split it" aria-label={`Question ${i + 1}`} value={c.question} onChange={e => upd(c.id, { question: e.target.value })} onPaste={e => onQuestionPaste(e, c.id)} onFocus={track(c.id, 'question')} />
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: c.ans ? PX.ok : '#b45309' }}>{c.ans ? `✓ Correct answer: ${c.ans}` : '👇 Tap the letter of the correct answer'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 8 }}>
                          {['A', 'B', 'C', 'D'].map(k => {
                            const on = c.ans === k
                            return (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${on ? TONES[k] : PX.line}`, background: on ? TONES[k] + '14' : '#fff', borderRadius: 12, padding: '4px 6px 4px 4px' }}>
                                <button type="button" aria-pressed={on} aria-label={`Mark ${k} as the correct answer`} title="Tap to mark correct" onClick={() => upd(c.id, { ans: on ? '' : k })}
                                  style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: on ? TONES[k] : '#f1ede3', color: on ? '#fff' : PX.ink2, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>{on ? '✓' : k}</button>
                                {hasPicture(c[k.toLowerCase()]) && <img src={pictureOf(c[k.toLowerCase()])} alt={`Option ${k} picture`} style={{ height: 34, maxWidth: 70, objectFit: 'contain', borderRadius: 6, border: `1px solid ${PX.line}`, background: '#fff', flexShrink: 0 }} />}
                                <input style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: isMobile ? 16 : 14, fontFamily: 'inherit', background: 'transparent', padding: '6px 2px' }} placeholder={hasPicture(c[k.toLowerCase()]) ? 'Optional caption' : `Option ${k}`} aria-label={`Question ${i + 1} option ${k}`} value={withoutPictureRaw(c[k.toLowerCase()])}
                                  onFocus={track(c.id, k.toLowerCase())}
                                  onChange={e => upd(c.id, { [k.toLowerCase()]: withPictureRaw(e.target.value, pictureOf(c[k.toLowerCase()])) })}
                                  onKeyDown={e => { if (k === 'D' && e.key === 'Enter') { e.preventDefault(); addAfter(c.id, 1, c) } }} />
                                {c.type === 'venn' && <button type="button" title="Pick a Venn relationship diagram" aria-label={`Pick a Venn diagram for option ${k}`} onClick={() => setPresetFor({ id: c.id, k: k.toLowerCase() })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, padding: '0 2px', flexShrink: 0 }}>🔵</button>}
                                <button type="button" title="Scan a picture for this option" aria-label={`Scan a picture for option ${k}`} onClick={() => setScan({ id: c.id, k: k.toLowerCase() })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, padding: '0 2px', flexShrink: 0, opacity: .6 }}>📷</button>
                                <label title={hasPicture(c[k.toLowerCase()]) ? 'Replace picture' : 'Upload a picture for this option'} style={{ cursor: 'pointer', fontSize: 16, padding: '0 3px', flexShrink: 0, opacity: hasPicture(c[k.toLowerCase()]) ? 1 : .55 }}>🖼<input type="file" accept="image/*" aria-label={`Picture for option ${k}`} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setImgErr(''); pickOptionImage(c.id, k.toLowerCase(), f) } }} /></label>
                                {hasPicture(c[k.toLowerCase()]) && <button type="button" aria-label={`Remove picture from option ${k}`} onClick={() => upd(c.id, { [k.toLowerCase()]: withoutPicture(c[k.toLowerCase()]) })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: PX.sub, flexShrink: 0 }}>×</button>}
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>Level</span>
                          {['Easy', 'Medium', 'Hard'].map(l => <button key={l} type="button" aria-pressed={c.level === l} onClick={() => upd(c.id, { level: c.level === l ? '' : l })}
                            style={{ padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${c.level === l ? PX.gold : PX.line}`, background: c.level === l ? PX.goldBg : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
                          <button type="button" onClick={() => upd(c.id, { showMore: !c.showMore })} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: PX.navy, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{c.showMore ? '− Less' : noExplanation ? '＋ Topic' : '＋ Explanation, topic'}</button>
                        </div>
                        {c.showMore && (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <input style={field} list="mqa-chapters" placeholder="Topic (e.g. Fractions)" aria-label="Topic" value={c.topic} onChange={e => upd(c.id, { topic: e.target.value })} />
                            {!noExplanation && <textarea rows={2} style={{ ...field, resize: 'vertical' }} placeholder="Explanation (shown in the answer key)" aria-label="Explanation" value={c.exp} onChange={e => upd(c.id, { exp: e.target.value })} onFocus={track(c.id, 'exp')} />}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <button type="button" className="px-btn ghost" style={{ flex: 1, borderStyle: 'dashed' }} onClick={() => addAfter(null, 1, cards[cards.length - 1])}>＋ Add question</button>
              <button type="button" className="px-btn ghost" style={{ borderStyle: 'dashed' }} onClick={() => addAfter(null, 5, cards[cards.length - 1])}>＋ Add 5</button>
              <label className="px-btn ghost" style={{ borderStyle: 'dashed', cursor: 'pointer' }} title="Pick many strip pictures (question figure + four options in one picture); each becomes a question">✂ Add figure strips<input type="file" multiple accept="image/*" aria-label="Add many strip pictures" style={{ display: 'none' }} onChange={e => { const fs = e.target.files; if (fs?.length) addStrips(fs); e.target.value = '' }} /></label>
            </div>
            {bulkMsg && <div role="status" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: PX.goldBg, fontSize: 12.5, fontWeight: 700 }}>{bulkMsg}</div>}
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
