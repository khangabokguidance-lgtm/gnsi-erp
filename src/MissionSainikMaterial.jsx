// MissionSainikMaterial.jsx — Study material studio: write rich notes (headings, lists, tables, callouts, maths, figures),
// see them live as a printed page, scan figures, credit the creator with their designation, and print on fewer sheets.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { PX } from './premiumUI'
import ScanFigure from './ScanFigure'
import { MATH_TOOLS } from './MultiQuestionAdder'
import { figFromFile } from './lib/figImage'
import { MATH_CSS, setMathStacked } from './lib/mathText'
import { renderMaterial, materialDocHtml, MATERIAL_CSS, PRINT_DEFAULTS, figureLine, parseFigureLine, wordCount, embedFor, kindOf, outline } from './lib/materialMarkup'
import { creatorOf, initials } from './lib/staffLookup'
import { supabase } from './supabase'
import { fetchAll } from './lib/missionSainikQuestions'
import { mathPlain } from './lib/mathText'
import { questionsToNotes } from './lib/questionNotes'

const DRAFT_KEY = 'msm-draft:v1'
const blank = { title: '', subject: '', test_no: 0, link_url: '', note: '', body: '', file: null }
const KIND = { text: ['📝', 'Notes', 'linear-gradient(135deg,#1e3a6e,#3b6bbf)'], pdf: ['📕', 'PDF', 'linear-gradient(135deg,#b42318,#ee5a4a)'], image: ['🖼️', 'Image', 'linear-gradient(135deg,#0f7a4c,#3bbf8a)'], link: ['🔗', 'Link', 'linear-gradient(135deg,#6d28d9,#a78bfa)'], office: ['📄', 'Document', 'linear-gradient(135deg,#1d4ed8,#6aa4f8)'], file: ['📎', 'File', 'linear-gradient(135deg,#475569,#94a3b8)'] }
const fmtDay = d => { try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) } catch { return '' } }
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

const TEMPLATES = {
  'Chapter notes': '# Chapter title\n\n## Key ideas\n- Idea one\n- Idea two\n\n> Formula: area = \\frac{1}{2} \\times b \\times h\n\n## Worked example\n> Example: Find the area of a triangle with base 6 cm and height 4 cm.\n\n1. Write the formula\n2. Put in the values\n3. Calculate: \\frac{1}{2} \\times 6 \\times 4 = 12 cm^2\n\n> Teacher: Ask students to explain why the area is half of a rectangle.\n\n> Remember: always write the unit.\n',
  'Formula sheet': '# Formula sheet\n\n| Shape | Area | Perimeter |\n|---|---|---|\n| Square | a^2 | 4a |\n| Rectangle | l \\times b | 2(l + b) |\n| Triangle | \\frac{1}{2} b h | a + b + c |\n| Circle | \\pi r^2 | 2 \\pi r |\n\n> Tip: learn the formula, then practise one question of each type.\n',
  'Worksheet': '# Practice worksheet\n\nName: ____________   Date: ________\n\n## Section A — Short answers\n1. ______________________________\n2. ______________________________\n3. ______________________________\n\n## Section B — Fill in the blanks\n1. The sum of angles of a triangle is ____ °.\n2. \\frac{1}{2} + \\frac{1}{4} = ____\n\n> Teacher: Answers — A1 …, A2 …, B1 180, B2 \\frac{3}{4}.\n',
}


// Premium page header + title block shared by the live preview and the full preview
const SheetHead = ({ name }) => (
  <div style={{ textAlign: 'center', marginBottom: 14 }}>
    <div style={{ height: 5, borderRadius: 3, background: 'linear-gradient(90deg,#b8923a,#f0e1b8 50%,#b8923a)', marginBottom: 12 }} />
    <div style={{ fontFamily: 'Georgia,serif', fontSize: 17, fontWeight: 700, color: '#132a4f', letterSpacing: '.14em', textTransform: 'uppercase' }}>{name}</div>
    <div style={{ fontFamily: 'system-ui,sans-serif', fontSize: 10.5, fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: '#b8923a', marginTop: 3 }}>Mission Sainik 2027 · Study Material</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 8 }}><span style={{ height: 1, width: 60, background: 'linear-gradient(90deg,transparent,#b8923a)' }} /><span style={{ color: '#b8923a', fontSize: 11 }}>◆</span><span style={{ height: 1, width: 60, background: 'linear-gradient(270deg,transparent,#b8923a)' }} /></div>
  </div>
)
const TitleBlock = ({ title, subject, test, by, designation }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ font: '700 25px/1.2 Georgia,serif', color: '#0f1b2e' }}>{title || <span style={{ color: '#9aa5b8' }}>Title</span>}</div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 6px' }}>
      <span style={{ font: '700 11.5px system-ui,sans-serif', background: '#eef2f9', color: '#1e3a6e', borderRadius: 99, padding: '3px 11px' }}>{subject || 'All subjects'}</span>
      {test ? <span style={{ font: '700 11.5px system-ui,sans-serif', background: '#faf1d9', color: '#8a6118', borderRadius: 99, padding: '3px 11px' }}>Test {test}</span> : null}
    </div>
    {by ? <div style={{ font: '12.5px system-ui,sans-serif', color: '#2e3b52' }}>Prepared by <b>{by}</b>{designation ? <span style={{ color: '#5d6b82' }}>, {designation}</span> : null}</div> : null}
    <div style={{ height: 1, background: 'linear-gradient(90deg,#b8923a,#e8e3d8 60%,transparent)', marginTop: 12 }} />
  </div>
)

// ── Page estimate: lay the real print document out in a hidden frame at the page width and count pages ──
const MM = 3.7795
const MARGIN_MM = { normal: [16, 14, 18], narrow: [10, 10, 12], minimal: [6, 7, 8] }
function pageBox(o) {
  const [w, h] = o.paper === 'a5' ? [148, 210] : [210, 297], W = o.landscape ? h : w, H = o.landscape ? w : h, mg = MARGIN_MM[o.margin] || MARGIN_MM.normal
  return { cw: Math.round((W - 2 * mg[1]) * MM), ch: Math.round((H - mg[0] - mg[2]) * MM) }
}
export const CSS_ALL = MATH_CSS + MATERIAL_CSS
function estimatePages(m, opts) {
  const nup = opts.nup === 2
  return new Promise(resolve => {
    const { cw, ch } = nup ? { cw: Math.round(285 * MM), ch: Math.round(198 * MM) } : pageBox(opts), f = document.createElement('iframe')
    f.style.cssText = `position:fixed;left:-99999px;top:0;width:${cw}px;height:${ch}px;border:0;visibility:hidden`
    let done = false
    const finish = v => { if (done) return; done = true; f.remove(); resolve(v) }
    f.onload = () => { try { const d = f.contentDocument, h = nup ? d.querySelector('.panel').scrollHeight : d.documentElement.scrollHeight - 6; finish(Math.max(1, Math.ceil(h / ch))) } catch { finish(null) } }
    f.srcdoc = materialDocHtml(m, { ...opts, auto: false }, CSS_ALL + (nup ? '.sheet{height:auto!important;overflow:visible!important}.panel{overflow:visible!important}' : ''))
    document.body.appendChild(f)
    setTimeout(() => finish(null), 5000)
  })
}
const SAVERS = [
  { margin: 'normal', columns: 1, size: 13, compact: false, header: 'full' },
  { margin: 'narrow', columns: 1, size: 12, compact: true, header: 'compact' },
  { margin: 'narrow', columns: 2, size: 12, compact: true, header: 'compact' },
  { margin: 'minimal', columns: 2, size: 11, compact: true, header: 'compact' },
  { margin: 'minimal', columns: 3, size: 10.5, compact: true, header: 'compact' },
]

export default function MissionSainikMaterial({ mats, matSetup, draft, setDraft, fileKey, editMat, busy, onSave, onCancelEdit, onEdit, onDelete, onOpen, canManage, getFileUrl, institute, isMobile, subjects, tests, setMsg, staff = [], userName = '' }) {
  const [tab, setTab] = useState('library')
  const [view, setView] = useState(isMobile ? 'edit' : 'split')
  const [restored, setRestored] = useState(false)
  const [scan, setScan] = useState(false), [focus, setFocus] = useState(false), [picker, setPicker] = useState(false)
  const [figErr, setFigErr] = useState('')
  const [layout, setLayout] = useState(() => ({ columns: 1, size: 13, saver: false, ...load('msm-layout', {}) }))
  useEffect(() => { save('msm-layout', layout) }, [layout])
  const [q, setQ] = useState(''), [subj, setSubj] = useState(''), [kind, setKind] = useState(''), [testF, setTestF] = useState(''), [sort, setSort] = useState('new'), [grid, setGrid] = useState(false), [favOnly, setFavOnly] = useState(false)
  const [viewer, setViewer] = useState(null)
  const [favs, setFavs] = useState(() => load('msm-fav', [])), [recent, setRecent] = useState(() => load('msm-recent', []))
  const [printFor, setPrintFor] = useState(null)
  const [popts, setPopts] = useState(() => ({ ...PRINT_DEFAULTS, ...load('msm-print', {}) }))
  const ta = useRef(null)
  const set = patch => setDraft(d => ({ ...d, ...patch }))
  const instName = institute?.name || 'Guidance Navodaya & Sainik Institute'
  const me = useMemo(() => creatorOf(staff, userName), [staff, userName])
  const creator = useCallback(m => creatorOf(staff, m.uploaded_by), [staff])

  useEffect(() => { if (editMat || draft.title || draft.body) setTab('create') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (editMat) setTab('create') }, [editMat])
  useEffect(() => { save('msm-print', popts) }, [popts])
  const toggleFav = id => setFavs(f => { const n = f.includes(id) ? f.filter(x => x !== id) : [...f, id]; save('msm-fav', n); return n })
  const seen = id => setRecent(r => { const n = [id, ...r.filter(x => x !== id)].slice(0, 6); save('msm-recent', n); return n })

  // ── draft autosave (new material only) ──
  const loaded = useRef(false)
  useEffect(() => {
    if (!editMat && !draft.title && !draft.body) {
      const d = load(DRAFT_KEY, null)
      if (d && (d.title || d.body)) { setDraft(x => ({ ...x, ...d, file: null })); setRestored(true) }
    }
    loaded.current = true
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loaded.current || editMat) return
    const t = setTimeout(() => { if (!draft.title && !draft.body) { try { localStorage.removeItem(DRAFT_KEY) } catch { /* ok */ } } else { const { file, ...rest } = draft; save(DRAFT_KEY, rest) } }, 500)
    return () => clearTimeout(t)
  }, [draft, editMat])
  useEffect(() => { if (!focus) return; const k = e => e.key === 'Escape' && setFocus(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [focus])

  // ── undo / redo (own history, because toolbar edits and templates replace the text programmatically) ──
  const hist = useRef({ stack: [draft.body], i: 0, skip: false, timer: null })
  const [, bump] = useState(0)
  const flushHist = () => { const h = hist.current; clearTimeout(h.timer); if (h.stack[h.i] !== draft.body) { h.stack = [...h.stack.slice(0, h.i + 1), draft.body].slice(-100); h.i = h.stack.length - 1; bump(n => n + 1) } }
  useEffect(() => {
    const h = hist.current
    if (h.skip) { h.skip = false; return }
    clearTimeout(h.timer)
    h.timer = setTimeout(() => { if (h.stack[h.i] !== draft.body) { h.stack = [...h.stack.slice(0, h.i + 1), draft.body].slice(-100); h.i = h.stack.length - 1; bump(n => n + 1) } }, 450)
    return () => clearTimeout(h.timer)
  }, [draft.body])
  const canUndo = hist.current.i > 0 || hist.current.stack[hist.current.i] !== draft.body, canRedo = hist.current.i < hist.current.stack.length - 1
  const undo = () => { flushHist(); const h = hist.current; if (h.i > 0) { h.i--; h.skip = true; set({ body: h.stack[h.i] }); bump(n => n + 1) } }
  const redo = () => { const h = hist.current; if (h.i < h.stack.length - 1) { h.i++; h.skip = true; set({ body: h.stack[h.i] }); bump(n => n + 1) } }

  // ── find & replace ──
  const [fr, setFr] = useState({ open: false, find: '', repl: '', cs: false })
  const [frAt, setFrAt] = useState(-1)
  const matches = useMemo(() => {
    if (!fr.open || !fr.find) return []
    const hay = fr.cs ? draft.body : draft.body.toLowerCase(), nd = fr.cs ? fr.find : fr.find.toLowerCase(), out = []
    for (let i = hay.indexOf(nd); i >= 0 && out.length < 5000; i = hay.indexOf(nd, i + Math.max(1, nd.length))) out.push(i)
    return out
  }, [fr, draft.body])
  const gotoMatch = n => {
    const el = ta.current; if (!el || !matches.length) return
    const k = ((n % matches.length) + matches.length) % matches.length, at = matches[k]
    setFrAt(k); el.focus(); el.setSelectionRange(at, at + fr.find.length)
    const line = el.value.slice(0, at).split('\n').length - 1; el.scrollTop = Math.max(0, line * 22 - 80)
  }
  const replaceOne = () => {
    const el = ta.current; if (!el || !matches.length) return
    const k = frAt >= 0 && frAt < matches.length ? frAt : 0, at = matches[k]
    set({ body: draft.body.slice(0, at) + fr.repl + draft.body.slice(at + fr.find.length) }); setFrAt(k)
  }
  const replaceAll = () => {
    if (!matches.length) return
    const esc = fr.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    set({ body: draft.body.replace(new RegExp(esc, fr.cs ? 'g' : 'gi'), () => fr.repl) }); setMsg(`✓ Replaced ${matches.length} match${matches.length === 1 ? '' : 'es'}`)
  }

  // ── figures in the notes: thumbnails with caption, width and remove ──
  const figs = useMemo(() => draft.body.split('\n').map((l, i) => ({ i, f: parseFigureLine(l) })).filter(x => x.f), [draft.body])
  const setFig = (i, patch) => { const lines = draft.body.split('\n'), f = { ...parseFigureLine(lines[i]), ...patch }; lines[i] = figureLine(f.url, f.caption, f.width); set({ body: lines.join('\n') }) }
  const dropFig = i => { const lines = draft.body.split('\n'); lines.splice(i, 1); set({ body: lines.join('\n') }) }
  const moveFig = (i, d) => { const lines = draft.body.split('\n'), j = i + d; if (j < 0 || j >= lines.length) return; [lines[i], lines[j]] = [lines[j], lines[i]]; set({ body: lines.join('\n') }) }

  // ── editor helpers ──
  const edit = fn => {
    const el = ta.current; if (!el) return
    const { value, selectionStart: a, selectionEnd: b } = el
    const r = fn(value, a, b)
    set({ body: r.text })
    setTimeout(() => { try { el.focus(); el.setSelectionRange(r.start ?? a, r.end ?? r.start ?? b) } catch { /* gone */ } }, 15)
  }
  const wrap = (pre, post = pre, ph = 'text') => edit((v, a, b) => { const sel = v.slice(a, b) || ph; return { text: v.slice(0, a) + pre + sel + post + v.slice(b), start: a + pre.length, end: a + pre.length + sel.length } })
  const linePrefix = (pfx, numbered) => edit((v, a, b) => {
    const s = v.lastIndexOf('\n', a - 1) + 1, e0 = v.indexOf('\n', b), e = e0 < 0 ? v.length : e0
    const block = v.slice(s, e).split('\n').map((l, i) => (numbered ? `${i + 1}. ` : pfx) + l.replace(/^(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+|>\s?)/, '')).join('\n')
    return { text: v.slice(0, s) + block + v.slice(e), start: s, end: s + block.length }
  })
  const clearFormat = () => edit((v, a, b) => {
    const s0 = a === b ? v.lastIndexOf('\n', a - 1) + 1 : a, e0 = a === b ? (v.indexOf('\n', b) < 0 ? v.length : v.indexOf('\n', b)) : b
    const t = v.slice(s0, e0).split('\n').map(l => (parseFigureLine(l) ? l : l.replace(/^(#{1,3}\s+|>\s?(?:(?:note|tip|formula|important|example|teacher)\s*:\s*)?|[-*•]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/i, '').replace(/\*\*|==|~~|`|(?<![_\w])__(?=[^\s_])|(?<=[^\s_])__(?![_\w])/g, '').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2'))).join('\n')
    return { text: v.slice(0, s0) + t + v.slice(e0), start: s0, end: s0 + t.length }
  })
  const addLink = () => {
    const url = window.prompt('Link address (must start with http:// or https://):', 'https://'); if (!url) return
    if (!/^https?:\/\//i.test(url.trim())) return setFigErr('A link must start with http:// or https://')
    setFigErr(''); edit((v, a, b) => { const sel = v.slice(a, b) || 'link text', t = `[${sel}](${url.trim()})`; return { text: v.slice(0, a) + t + v.slice(b), start: a + 1, end: a + 1 + sel.length } })
  }
  const insertAt = (txt, caret) => edit((v, a, b) => ({ text: v.slice(0, a) + txt + v.slice(b), start: a + (caret ?? txt.length) }))
  const insertBlock = txt => edit((v, a) => { const pre = a > 0 && v[a - 1] !== '\n' ? '\n' : ''; return { text: v.slice(0, a) + pre + txt + '\n' + v.slice(a), start: a + pre.length + txt.length + 1 } })
  const addFigure = async file => { setFigErr(''); try { insertBlock(figureLine(await figFromFile(file, { maxW: 720, quality: 0.8, cap: 220000 }), 'Figure')) } catch (e) { setFigErr(e.message) } }
  const useTemplate = name => { if (draft.body.trim() && !window.confirm('Replace what you have typed with this template?')) return; set({ body: TEMPLATES[name] }) }
  const heads = useMemo(() => outline(draft.body), [draft.body])
  const jumpTo = idx => {
    const el = ta.current; if (!el || idx < 0) return
    let n = -1, pos = 0
    const lines = el.value.split('\n')
    for (let i = 0; i < lines.length; i++) { if (/^\s*#{1,3}\s+/.test(lines[i])) n++; if (n === idx) { el.focus(); el.setSelectionRange(pos, pos + lines[i].length); el.scrollTop = Math.max(0, i * 21 - 40); return } pos += lines[i].length + 1 }
  }
  const onEditorKey = e => {
    if (!(e.ctrlKey || e.metaKey)) return
    const k = e.key.toLowerCase()
    if (k === 'b') { e.preventDefault(); wrap('**') } else if (k === 'i') { e.preventDefault(); wrap('*') } else if (k === 'u') { e.preventDefault(); wrap('__') } else if (k === 'k') { e.preventDefault(); addLink() } else if (k === 's') { e.preventDefault(); submit() }
    else if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() } else if (k === 'y') { e.preventDefault(); redo() }
    else if (k === 'f' || k === 'h') { e.preventDefault(); const sel = ta.current ? ta.current.value.slice(ta.current.selectionStart, ta.current.selectionEnd) : ''; setFr(f => ({ ...f, open: true, find: sel && !sel.includes('\n') ? sel : f.find })) }
  }

  // ── library ──
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return mats.filter(m => (!subj || m.subject === subj) && (!kind || kindOf(m) === kind) && (!testF || String(m.test_no) === testF) && (!favOnly || favs.includes(m.id))
      && (!needle || [m.title, m.note, m.body, m.uploaded_by, m.subject].join(' ').toLowerCase().includes(needle)))
      .sort((a, b) => (favs.includes(b.id) - favs.includes(a.id)) || (sort === 'title' ? String(a.title).localeCompare(String(b.title)) : sort === 'old' ? String(a.created_at).localeCompare(String(b.created_at)) : String(b.created_at).localeCompare(String(a.created_at))))
  }, [mats, q, subj, kind, testF, sort, favOnly, favs])
  const kinds = useMemo(() => { const c = {}; mats.forEach(m => { const k = kindOf(m); c[k] = (c[k] || 0) + 1 }); return c }, [mats])
  const recents = useMemo(() => recent.map(id => mats.find(m => m.id === id)).filter(Boolean).slice(0, 4), [recent, mats])
  const mine = mats.filter(m => m.uploaded_by === userName).length
  const duplicate = m => { setDraft({ title: m.title + ' (copy)', subject: m.subject || '', test_no: m.test_no || 0, link_url: m.link_url || '', note: m.note || '', body: m.body || '', file: null }); setTab('create'); setView(isMobile ? 'edit' : 'split'); window.scrollTo?.({ top: 0, behavior: 'smooth' }); setMsg('📋 Copied into a new draft — edit and add it.') }

  // ── printing ──
  const asDoc = m => ({ ...m, uploaded_by: m.uploaded_by || userName })
  const printOptsFor = (m, o) => ({ ...o, institute: instName, author: creatorOf(staff, m.uploaded_by || userName) })
  const openPrint = m => { setPopts(p => ({ ...p, columns: layout.saver ? Math.max(2, layout.columns) : layout.columns, compact: layout.saver, size: layout.saver ? Math.min(layout.size, 12) : layout.size, margin: layout.saver ? 'narrow' : p.margin, header: layout.saver ? 'compact' : p.header })); setPrintFor(m) }
  const doPrint = (m, o) => { const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print'); w.document.write(materialDocHtml(asDoc(m), { ...printOptsFor(m, o), auto: true }, CSS_ALL)); w.document.close() }
  const doWord = (m, o) => {
    setMathStacked(false)
    let html; try { html = materialDocHtml(asDoc(m), { ...printOptsFor(m, o), columns: 1, nup: 1 }, CSS_ALL) } finally { setMathStacked(true) }
    const url = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/msword' }))
    const a = document.createElement('a'); a.href = url; a.download = String(m.title || 'notes').replace(/[^\w-]+/g, '_') + '.doc'; a.click(); URL.revokeObjectURL(url)
  }

  // ── styles ──
  const inp = { padding: '11px 13px', borderRadius: 13, border: `1.5px solid ${PX.line}`, fontSize: isMobile ? 16 : 14, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff', transition: 'border-color .15s,box-shadow .15s' }
  const seg = on => ({ padding: '8px 14px', borderRadius: 10, border: 'none', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 4px rgba(15,27,46,.15)' : 'none', color: on ? PX.ink : PX.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' })
  const chip = on => ({ padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink2, whiteSpace: 'nowrap', flexShrink: 0 })
  const tbtn = { minWidth: 36, height: 36, padding: '0 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.7)', background: 'rgba(255,255,255,.85)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink, flexShrink: 0, boxShadow: '0 1px 2px rgba(19,42,79,.08)' }
  const card = { background: '#fff', border: '1px solid #ebe6da', borderRadius: 22, boxShadow: '0 12px 34px -24px rgba(19,42,79,.45)', marginBottom: 16, overflow: 'hidden' }
  const Avatar = ({ name, size = 30 }) => <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#b8923a,#e9d9b0)', color: '#132a4f', fontWeight: 800, fontSize: size * 0.4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(name)}</span>
  const Byline = ({ m, size = 24 }) => { const c = creator(m); return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}><Avatar name={c.name} size={size} /><span style={{ fontSize: 12, color: PX.ink2, fontWeight: 700 }}>{c.name || 'Unknown'}{c.designation ? <span style={{ color: PX.sub, fontWeight: 600 }}> · {c.designation}</span> : null}</span></span> }

  // ── live preview of what is being written ──
  const [fileUrl, setFileUrl] = useState('')
  useEffect(() => { if (draft.file && /^(image|application\/pdf)/.test(draft.file.type)) { const u = URL.createObjectURL(draft.file); setFileUrl(u); return () => URL.revokeObjectURL(u) } setFileUrl('') }, [draft.file])
  const words = wordCount(draft.body), mins = Math.max(1, Math.round(words / 180))
  const emb = embedFor(draft.link_url)
  const livePreview = (
    <div style={{ background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 8, padding: isMobile ? '18px 16px' : '22px 26px', boxShadow: '0 10px 30px -14px rgba(15,27,46,.35)', minHeight: 260 }}>
      <SheetHead name={instName} />
      <TitleBlock title={draft.title} subject={draft.subject} test={Number(draft.test_no) || 0} by={(editMat?.uploaded_by) || userName || 'You'} designation={editMat ? creator(editMat).designation : me.designation} />
      {draft.body.trim() ? <div className={'md' + (layout.saver ? ' compact' : '')} style={bodyStyle(layout)} dangerouslySetInnerHTML={{ __html: renderMaterial(draft.body) }} /> : <div style={{ color: '#9aa5b8', fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Start typing — your notes appear here exactly as they will print.</div>}
      {fileUrl && draft.file?.type === 'application/pdf' && <iframe title="PDF preview" src={fileUrl} style={{ width: '100%', height: 360, border: `1px solid ${PX.line}`, marginTop: 12 }} />}
      {fileUrl && /^image/.test(draft.file?.type || '') && <img src={fileUrl} alt="Attached" style={{ maxWidth: '100%', marginTop: 12, borderRadius: 6 }} />}
      {draft.file && !fileUrl && <div style={{ marginTop: 12, padding: 10, background: '#f4f1e8', borderRadius: 8, fontSize: 13 }}>📎 {draft.file.name} will be attached.</div>}
      {draft.link_url && <div style={{ marginTop: 12, padding: 10, background: '#eef4ff', borderRadius: 8, fontSize: 13, wordBreak: 'break-all' }}>🔗 {draft.link_url}</div>}
      {emb && <iframe title="Link preview" src={emb.src} style={{ width: '100%', height: 260, border: 0, marginTop: 8, borderRadius: 8 }} allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />}
    </div>
  )

  const submit = async () => { const ok = await onSave(); if (ok) { try { localStorage.removeItem(DRAFT_KEY) } catch { /* ok */ } setRestored(false); setFocus(false); setTab('library') } }
  const openViewer = i => { setViewer(i); seen(shown[i].id) }

  return (
    <>
      <style>{CSS_ALL + `
.msm-hero{position:relative;overflow:hidden;border-radius:26px;padding:${isMobile ? '16px 16px 14px' : '22px 26px 20px'};margin-bottom:16px;color:#fff;background:linear-gradient(135deg,#132a4f 0%,#1e3a6e 58%,#2f5aa3 100%);box-shadow:0 18px 40px -22px rgba(19,42,79,.7)}
.msm-hero:before{content:"";position:absolute;right:-60px;top:-70px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(233,217,176,.35),transparent 70%)}
.msm-stat{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:8px 14px;min-width:78px;text-align:center;backdrop-filter:blur(4px)}
.msm-stat b{display:block;font:700 20px Georgia,serif}.msm-stat span{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#e9d9b0;font-weight:700}
.msm-item{transition:transform .18s,box-shadow .18s,border-color .18s}.msm-item:hover{transform:translateY(-2px);box-shadow:0 14px 30px -18px rgba(19,42,79,.5);border-color:#e3d3a6!important}
.msm-glass{background:linear-gradient(135deg,rgba(255,250,240,.96),rgba(250,241,217,.92));border:1px solid #ead9a8;backdrop-filter:blur(6px)}
.msm-in:focus{outline:none;border-color:#b8923a!important;box-shadow:0 0 0 4px rgba(184,146,58,.18)}
.msm-strip{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}.msm-strip::-webkit-scrollbar{display:none}
.msm-fav{border:none;background:transparent;cursor:pointer;font-size:19px;line-height:1;padding:2px 4px}
@media (max-width:700px){.msm-item .px-hbtn,.msm-item .px-btn{min-height:42px}}`}</style>
      {matSetup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261202_mission_sainik_materials.sql</b> in Supabase to enable study material.</div>}

      <div className="msm-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#e9d9b0' }}>Mission Sainik</div>
            <div style={{ fontFamily: PX.serif, fontSize: isMobile ? 24 : 28, fontWeight: 600, lineHeight: 1.15 }}>Study material</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', marginTop: 3 }}>Write, preview and print notes. Every item carries its creator's name and designation.</div>
          </div>
          <div className="msm-strip" style={{ maxWidth: '100%' }}>
            {[[mats.length, 'Total'], [kinds.text || 0, 'Notes'], [(kinds.pdf || 0) + (kinds.image || 0) + (kinds.office || 0) + (kinds.file || 0), 'Files'], [kinds.link || 0, 'Links'], [mine, 'Mine']].map(([n, l]) => <div key={l} className="msm-stat"><b>{n}</b><span>{l}</span></div>)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14, position: 'relative' }}>
          <div role="tablist" aria-label="Study material" style={{ display: 'inline-flex', padding: 3, background: 'rgba(255,255,255,.14)', borderRadius: 14, gap: 2 }}>
            {[['library', `📚 Library (${mats.length})`], ['create', editMat ? '✎ Editing' : '✍️ Create']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ padding: '9px 16px', borderRadius: 11, border: 'none', background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#132a4f' : '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
          </div>
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)' }}>✍️ You: <b style={{ color: '#fff' }}>{userName || 'Staff'}</b>{me.designation ? <span style={{ color: '#e9d9b0' }}> · {me.designation}</span> : null}</span>
        </div>
      </div>

      {tab === 'create' && (
        <div style={focus ? { position: 'fixed', inset: 0, zIndex: 900, background: '#fff', overflow: 'auto', borderRadius: 0 } : card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PX.line}`, background: 'linear-gradient(180deg,#fff,#fcfbf7)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}><div style={{ fontFamily: PX.serif, fontSize: 18, fontWeight: 600 }}>{editMat ? 'Edit study material' : 'Create study material'}</div>
              <div style={{ fontSize: 12.5, color: PX.sub }}>{words} words · ~{mins} min read{!editMat && (draft.title || draft.body) ? ' · draft auto-saved' : ''}</div></div>
            <div role="tablist" aria-label="View" style={{ display: 'inline-flex', padding: 3, background: '#f1ede3', borderRadius: 12, gap: 2 }}>
              <button type="button" role="tab" aria-selected={view === 'edit'} style={seg(view === 'edit')} onClick={() => setView('edit')}>✏️ Edit</button>
              {!isMobile && <button type="button" role="tab" aria-selected={view === 'split'} style={seg(view === 'split')} onClick={() => setView('split')}>◫ Side by side</button>}
              <button type="button" role="tab" aria-selected={view === 'preview'} style={seg(view === 'preview')} onClick={() => setView('preview')}>👁 Preview</button>
            </div>
            <button type="button" className="px-btn ghost" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => setFocus(f => !f)} aria-pressed={focus}>{focus ? '✕ Exit focus' : '⛶ Focus'}</button>
          </div>
          <div style={{ padding: isMobile ? 12 : 16 }}>
            {restored && <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', marginBottom: 10, borderRadius: 12, background: '#eef6ff', border: '1px solid #c9ddf5', fontSize: 13, color: '#1e3a6e' }}><span style={{ flex: 1 }}>📝 Your unsaved draft was restored.</span><button type="button" className="px-btn ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { setDraft({ ...blank }); setRestored(false) }}>Discard draft</button></div>}
            {view !== 'preview' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input className="msm-in" style={inp} aria-label="Title" placeholder="Title, e.g. Fractions — Class 6 notes" value={draft.title} onChange={e => set({ title: e.target.value })} />
                <select className="msm-in" style={inp} aria-label="Subject" value={draft.subject} onChange={e => set({ subject: e.target.value })}><option value="">All subjects</option>{subjects.map(x => <option key={x.key} value={x.label}>{x.label}</option>)}</select>
                <select className="msm-in" style={inp} aria-label="Test" value={draft.test_no} onChange={e => set({ test_no: e.target.value })}><option value={0}>All tests</option>{tests.map(t => <option key={t.id} value={t.no ?? t.id}>{t.id}</option>)}</select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: view === 'split' ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 16, alignItems: 'start' }}>
              {view !== 'preview' && (
                <div>
                  <div className="msm-glass" style={{ position: 'sticky', top: focus ? 0 : 0, zIndex: 4, borderRadius: 14, padding: '7px 8px', marginBottom: 8, boxShadow: '0 6px 18px -12px rgba(19,42,79,.4)' }}>
                    <div className="msm-strip" role="toolbar" aria-label="Formatting" style={{ alignItems: 'center' }}>
                      <button type="button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onMouseDown={e => e.preventDefault()} onClick={undo} style={{ ...tbtn, opacity: canUndo ? 1 : .4 }}>↶</button>
                      <button type="button" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!canRedo} onMouseDown={e => e.preventDefault()} onClick={redo} style={{ ...tbtn, opacity: canRedo ? 1 : .4 }}>↷</button>
                      <button type="button" title="Find and replace (Ctrl+F)" aria-label="Find and replace" aria-pressed={fr.open} onClick={() => setFr(f => ({ ...f, open: !f.open }))} style={{ ...tbtn, background: fr.open ? '#faf1d9' : tbtn.background }}>🔎</button>
                      {[['H1', 'Heading', () => linePrefix('# ')], ['H2', 'Subheading', () => linePrefix('## ')], ['B', 'Bold (Ctrl+B)', () => wrap('**')], ['I', 'Italic (Ctrl+I)', () => wrap('*')], ['▮', 'Highlight', () => wrap('==')], ['•', 'Bullet list', () => linePrefix('- ')], ['1.', 'Numbered list', () => linePrefix('', true)],
                        ['ℹ️ Note', 'Note box', () => linePrefix('> Note: ')], ['💡 Tip', 'Tip box', () => linePrefix('> Tip: ')], ['∑ Formula', 'Formula box', () => linePrefix('> Formula: ')], ['⚠ Important', 'Important box', () => linePrefix('> Important: ')], ['Ex.', 'Example box', () => linePrefix('> Example: ')], ['🎓 Teacher', 'Teacher-only box (left out of the student copy)', () => linePrefix('> Teacher: ')],
                        ['▦ Table', 'Insert a table', () => insertBlock('| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| a | b | c |\n| d | e | f |')], ['─', 'Divider line', () => insertBlock('---')]].map(([l, t, f]) => <button key={t} type="button" title={t} aria-label={t} onMouseDown={e => e.preventDefault()} onClick={f} style={{ ...tbtn, fontStyle: l === 'I' ? 'italic' : undefined, fontWeight: l === 'B' ? 900 : 700 }}>{l}</button>)}
                      <label title="Upload a figure" style={{ ...tbtn, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>🖼 Figure<input type="file" accept="image/*" aria-label="Upload a figure" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addFigure(f) }} /></label>
                      <button type="button" title="Scan a figure" onClick={() => setScan(true)} style={tbtn}>📷 Scan</button>
                      {[['U', 'Underline (Ctrl+U)', () => wrap('__')], ['S̶', 'Strikethrough', () => wrap('~~')], ['</>', 'Code', () => wrap('`')], ['🔗', 'Link (Ctrl+K)', addLink], ['☑', 'Checklist', () => linePrefix('- [ ] ')], ['⌫', 'Clear formatting', clearFormat]].map(([l, t, f]) => <button key={t} type="button" title={t} aria-label={t} onMouseDown={e => e.preventDefault()} onClick={f} style={{ ...tbtn, textDecoration: l === 'U' ? 'underline' : undefined }}>{l}</button>)}
                      <button type="button" title="Insert questions from the Practice bank" onClick={() => setPicker(true)} style={{ ...tbtn, background: '#eef6ff', borderColor: '#9ec3f2' }}>❓ From Practice bank</button>
                    </div>
                    <div className="msm-strip" role="toolbar" aria-label="Maths symbols" style={{ marginTop: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a6118', marginRight: 4, flexShrink: 0 }}>Maths</span>
                      {MATH_TOOLS.map(([l, t, c, title]) => <button key={title} type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={() => insertAt(t, c)} style={{ ...tbtn, fontFamily: 'Georgia,serif', fontSize: 15 }}>{l}</button>)}
                    </div>
                  </div>
                  {fr.open && (
                    <div className="msm-glass" style={{ borderRadius: 14, padding: '8px 10px', marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input className="msm-in" aria-label="Find" placeholder="Find…" value={fr.find} onChange={e => { setFr(f => ({ ...f, find: e.target.value })); setFrAt(-1) }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); gotoMatch(frAt + (e.shiftKey ? -1 : 1)) } else if (e.key === 'Escape') setFr(f => ({ ...f, open: false })) }} style={{ ...inp, width: 150, padding: '7px 10px', fontSize: isMobile ? 16 : 13 }} autoFocus />
                      <input className="msm-in" aria-label="Replace with" placeholder="Replace with…" value={fr.repl} onChange={e => setFr(f => ({ ...f, repl: e.target.value }))} style={{ ...inp, width: 150, padding: '7px 10px', fontSize: isMobile ? 16 : 13 }} />
                      <span style={{ fontSize: 12, color: matches.length ? PX.ink2 : PX.sub, minWidth: 70 }}>{fr.find ? (matches.length ? `${frAt >= 0 ? frAt + 1 : 0} of ${matches.length}` : 'No matches') : ''}</span>
                      <button type="button" className="px-btn ghost" style={{ padding: '5px 10px', fontSize: 12.5 }} disabled={!matches.length} onClick={() => gotoMatch(frAt - 1)}>↑</button>
                      <button type="button" className="px-btn ghost" style={{ padding: '5px 10px', fontSize: 12.5 }} disabled={!matches.length} onClick={() => gotoMatch(frAt + 1)}>↓</button>
                      <button type="button" className="px-btn ghost" style={{ padding: '5px 10px', fontSize: 12.5 }} disabled={!matches.length} onClick={replaceOne}>Replace</button>
                      <button type="button" className="px-btn ghost" style={{ padding: '5px 10px', fontSize: 12.5 }} disabled={!matches.length} onClick={replaceAll}>Replace all</button>
                      <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={fr.cs} onChange={e => setFr(f => ({ ...f, cs: e.target.checked }))} />Aa</label>
                      <button type="button" aria-label="Close find" onClick={() => setFr(f => ({ ...f, open: false }))} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                  )}
                  {figs.length > 0 && (
                    <details style={{ marginBottom: 8, border: `1px solid ${PX.line}`, borderRadius: 14, background: '#fff' }}>
                      <summary style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 13, fontWeight: 700 }}>🖼 Figures in these notes ({figs.length}) — caption, size, order</summary>
                      <div style={{ padding: '0 12px 10px', display: 'grid', gap: 8 }}>
                        {figs.map(({ i, f }, n) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <img src={f.url} alt="" style={{ height: 42, maxWidth: 70, objectFit: 'contain', borderRadius: 6, border: `1px solid ${PX.line}` }} />
                            <input className="msm-in" aria-label={`Caption for figure ${n + 1}`} placeholder="Caption" value={f.caption} onChange={e => setFig(i, { caption: e.target.value })} style={{ ...inp, flex: '1 1 120px', width: 'auto', padding: '6px 9px', fontSize: isMobile ? 16 : 13 }} />
                            <select aria-label={`Width of figure ${n + 1}`} className="msm-in" value={f.width || 100} onChange={e => setFig(i, { width: Number(e.target.value) })} style={{ ...inp, width: 'auto', padding: '6px 8px', fontSize: 13 }}>{[[100, 'Full width'], [75, '75%'], [50, 'Half'], [33, 'Third']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                            <button type="button" className="px-hbtn" aria-label="Move figure up" onClick={() => moveFig(i, -1)}>▲</button>
                            <button type="button" className="px-hbtn" aria-label="Move figure down" onClick={() => moveFig(i, 1)}>▼</button>
                            <button type="button" className="px-hbtn" aria-label="Remove figure" onClick={() => dropFig(i)}>🗑</button>
                          </div>))}
                      </div>
                    </details>
                  )}
                  {figErr && <div role="alert" style={{ margin: '0 0 8px', padding: '7px 11px', borderRadius: 10, background: '#fdecea', color: '#8f1d14', fontSize: 13 }}>❌ {figErr}</div>}
                  <div className="msm-strip" style={{ alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub, flexShrink: 0 }}>Start from</span>
                    {Object.keys(TEMPLATES).map(n => <button key={n} type="button" style={chip(false)} onClick={() => useTemplate(n)}>{n}</button>)}
                    {heads.length > 1 && <select aria-label="Jump to heading" className="msm-in" style={{ ...inp, width: 'auto', padding: '5px 10px', fontSize: 12.5, marginLeft: 'auto', flexShrink: 0 }} value="" onChange={e => { if (e.target.value !== '') jumpTo(Number(e.target.value)) }}><option value="">↳ Jump to heading</option>{heads.map((h, i) => <option key={h.id} value={i}>{'\u00A0\u00A0'.repeat(h.level - 1)}{h.text}</option>)}</select>}
                  </div>
                  <textarea ref={ta} className="msm-in" onKeyDown={onEditorKey} style={{ ...inp, minHeight: focus ? '62vh' : isMobile ? 280 : 400, resize: 'vertical', lineHeight: 1.6, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: isMobile ? 16 : 13.5 }} aria-label="Study material text"
                    placeholder={'Type or paste the study material here.\n\n# Heading   ## Subheading   **bold**   - bullets   1. numbers\n> Formula: \\frac{3}{4} + \\frac{1}{4} = 1\n> Teacher: this line is left out of the student copy\n\nUse the buttons above for tables, boxes, maths and figures.'} value={draft.body} onChange={e => set({ body: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Attach a file (PDF, image, Word…)<input key={fileKey} className="msm-in" style={{ ...inp, marginTop: 4 }} type="file" aria-label="Choose a file" onChange={e => set({ file: e.target.files?.[0] || null })} /></label>
                    <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>…or a link (Drive, YouTube)<input className="msm-in" style={{ ...inp, marginTop: 4 }} aria-label="Link" placeholder="https://" value={draft.link_url} onChange={e => set({ link_url: e.target.value })} /></label>
                    <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub, gridColumn: '1 / -1' }}>Note (optional)<input className="msm-in" style={{ ...inp, marginTop: 4 }} aria-label="Note" placeholder="e.g. For Class 6 batch, revise before Test 5" value={draft.note} onChange={e => set({ note: e.target.value })} /></label>
                  </div>
                </div>
              )}
              {view !== 'edit' && <div style={view === 'split' ? { position: 'sticky', top: 8, maxHeight: '86vh', overflow: 'auto' } : undefined}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13 }}>Live preview</b><span style={{ fontSize: 12, color: PX.sub }}>as it will print</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <LayoutControls layout={layout} setLayout={setLayout} inp={inp} />
                  </span>
                </div>
                {livePreview}
              </div>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap', position: 'sticky', bottom: isMobile && !focus ? 'calc(72px + env(safe-area-inset-bottom))' : 0, background: '#fff', padding: '10px 0', borderTop: `1px solid ${PX.line}`, zIndex: 4 }}>
              <button className="px-btn gold" disabled={busy} onClick={submit} style={{ minHeight: 44 }}>{busy ? 'Saving…' : editMat ? '✔ Save changes' : '⬆ Add material'}</button>
              <button className="px-btn ghost" style={{ minHeight: 44 }} disabled={!draft.body.trim()} onClick={() => openPrint({ title: draft.title || 'Untitled notes', body: draft.body, subject: draft.subject, test_no: Number(draft.test_no) || 0, uploaded_by: editMat?.uploaded_by || userName })}>🖨 Print options</button>
              {editMat && <><span style={{ fontSize: 13, color: PX.sub }}>Editing “{editMat.title}”{editMat.file_name ? ' · choose a file only to replace ' + editMat.file_name : ''}</span><button className="px-btn ghost" onClick={() => { onCancelEdit(); setTab('library') }}>Cancel</button></>}
            </div>
          </div>
        </div>
      )}

      {tab === 'library' && (
        <div style={card}>
          <div style={{ padding: isMobile ? '12px 12px' : '14px 18px', borderBottom: `1px solid ${PX.line}`, background: 'linear-gradient(180deg,#fff,#fcfbf7)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="msm-in" style={{ ...inp, flex: '1 1 180px', width: 'auto', borderRadius: 99 }} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search title, note, creator or text…" aria-label="Search material" />
              <select className="msm-in" style={{ ...inp, width: 'auto', flex: '0 1 150px' }} value={testF} onChange={e => setTestF(e.target.value)} aria-label="Filter by test"><option value="">All tests</option>{tests.map(t => <option key={t.id} value={t.no ?? t.id}>{t.id}</option>)}</select>
              <select className="msm-in" style={{ ...inp, width: 'auto', flex: '0 1 140px' }} value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort material"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="title">Title A–Z</option></select>
              <span role="tablist" aria-label="Layout" style={{ display: 'inline-flex', padding: 3, background: '#f1ede3', borderRadius: 11, gap: 2 }}>{[[false, '☰ List'], [true, '▦ Grid']].map(([g, l]) => <button key={l} type="button" role="tab" aria-selected={grid === g} style={{ ...seg(grid === g), padding: '6px 11px' }} onClick={() => setGrid(g)}>{l}</button>)}</span>
            </div>
            <div className="msm-strip" style={{ marginTop: 10 }}>
              <button type="button" style={chip(!subj)} onClick={() => setSubj('')}>All subjects</button>
              {subjects.map(x => { const n = mats.filter(m => m.subject === x.label).length; return <button key={x.key} type="button" style={chip(subj === x.label)} onClick={() => setSubj(subj === x.label ? '' : x.label)}>{x.short} {n}</button> })}
            </div>
            <div className="msm-strip" style={{ marginTop: 8 }}>
              <button type="button" style={chip(!kind && !favOnly)} onClick={() => { setKind(''); setFavOnly(false) }}>Any type</button>
              <button type="button" style={chip(favOnly)} onClick={() => setFavOnly(v => !v)}>⭐ Favourites {favs.filter(id => mats.some(m => m.id === id)).length}</button>
              {Object.entries(KIND).filter(([k]) => kinds[k]).map(([k, [ic, l]]) => <button key={k} type="button" style={chip(kind === k)} onClick={() => setKind(kind === k ? '' : k)}>{ic} {l} {kinds[k]}</button>)}
            </div>
          </div>
          {recents.length > 0 && !q && !subj && !kind && !favOnly && (
            <div style={{ padding: isMobile ? '10px 12px 0' : '12px 18px 0' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub, marginBottom: 6 }}>🕘 Recently viewed</div>
              <div className="msm-strip">{recents.map(m => <button key={m.id} type="button" className="msm-item" onClick={() => { const i = shown.findIndex(x => x.id === m.id); if (i >= 0) openViewer(i) }} style={{ flex: '0 0 auto', maxWidth: 220, textAlign: 'left', padding: '8px 12px', borderRadius: 14, border: '1px solid #ebe6da', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}><span style={{ fontSize: 15 }}>{KIND[kindOf(m)][0]}</span> <b style={{ fontSize: 13 }}>{m.title.length > 26 ? m.title.slice(0, 26) + '…' : m.title}</b></button>)}</div>
            </div>
          )}
          <div style={{ padding: grid ? 14 : isMobile ? '6px 12px 12px' : '6px 18px 14px' }}>
            {!shown.length && <div style={{ padding: 28, color: PX.sub, fontSize: 13.5, textAlign: 'center' }}>{mats.length ? 'No material matches these filters.' : 'Nothing here yet — tap “✍️ Create” to add the first notes.'}</div>}
            <div style={grid ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: 12 } : { display: 'grid', gap: 10, marginTop: 8 }}>
              {shown.map((m, i) => {
                const k = kindOf(m), [ic, kl, grad] = KIND[k], fav = favs.includes(m.id)
                return (
                  <div key={m.id} className="msm-item" style={{ border: '1px solid #ebe6da', borderRadius: 18, padding: 13, display: 'flex', flexDirection: grid ? 'column' : 'row', gap: 12, alignItems: grid ? 'stretch' : 'center', flexWrap: 'wrap', background: '#fff' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 200 }}>
                      <span style={{ width: 48, height: 48, borderRadius: 16, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, flex: 'none', boxShadow: '0 8px 16px -10px rgba(19,42,79,.6)' }}>{ic}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: PX.ink, lineHeight: 1.25 }}>{m.title}</div>
                        <div style={{ fontSize: 12, color: PX.sub, margin: '2px 0 4px' }}>{[kl, m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : null, fmtDay(m.created_at)].filter(Boolean).join(' · ')}</div>
                        <Byline m={m} />
                        {m.note && <div style={{ fontSize: 12, color: PX.sub, fontStyle: 'italic', marginTop: 3 }}>{m.note}</div>}
                      </div>
                      <button type="button" className="msm-fav" aria-pressed={fav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} onClick={() => toggleFav(m.id)} style={{ color: fav ? '#d9a21b' : '#c3bba8' }}>{fav ? '★' : '☆'}</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="px-btn gold" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => openViewer(i)}>👁 Preview</button>
                      {m.body && <button className="px-hbtn" onClick={() => openPrint(m)}>🖨 Print</button>}
                      <button className="px-hbtn" onClick={() => onOpen(m)}>Open</button>
                      {m.body && <button className="px-hbtn" title="Copy into a new draft" aria-label="Duplicate material" onClick={() => duplicate(m)}>⧉</button>}
                      {canManage(m) && <button className="px-hbtn" onClick={() => onEdit(m)} aria-label="Edit material">✎</button>}
                      {canManage(m) && <button className="px-hbtn" onClick={() => onDelete(m)} aria-label="Delete material">🗑</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {picker && <QuestionPicker subjects={subjects} isMobile={isMobile} onClose={() => setPicker(false)} onInsert={t => { setPicker(false); insertBlock(t) }} />}
      {scan && <ScanFigure title="Scan a figure for your notes" maxW={720} cap={220000} onClose={() => setScan(false)} onDone={u => { setScan(false); insertBlock(figureLine(u, 'Figure')) }} />}
      {printFor && <PrintDialog m={printFor} opts={popts} setOpts={setPopts} creator={creatorOf(staff, printFor.uploaded_by || userName)} onClose={() => setPrintFor(null)} onPrint={o => doPrint(printFor, o)} onWord={o => doWord(printFor, o)} isMobile={isMobile} instName={instName} />}
      {viewer != null && shown[viewer] && (
        <Viewer m={shown[viewer]} index={viewer} total={shown.length} onIndex={i => { setViewer(i); }} onClose={() => setViewer(null)} getFileUrl={getFileUrl} instName={instName} layout={layout} setLayout={setLayout} creator={creator(shown[viewer])}
          fav={favs.includes(shown[viewer].id)} onFav={() => toggleFav(shown[viewer].id)} onDuplicate={m => { setViewer(null); duplicate(m) }}
          canManage={canManage} onEdit={m => { setViewer(null); onEdit(m) }} onDelete={m => { setViewer(null); onDelete(m) }} onOpen={onOpen} onPrint={m => openPrint(m)} isMobile={isMobile} />
      )}
    </>
  )
}

// ── Print options: save paper with compact layouts, see the page count change, credit the creator ──
export function PrintDialog({ m, opts, setOpts, creator, onClose, onPrint, onWord, isMobile, instName }) {
  const [reviewer, setReviewer] = useState(''), [pages, setPages] = useState(null), [base, setBase] = useState(null), [fitting, setFitting] = useState(false), [note, setNote] = useState('')
  const o = { ...opts, reviewer, institute: instName, author: creator }
  const upd = patch => setOpts(p => ({ ...p, ...patch }))
  const key = JSON.stringify([m.body, m.title, opts, creator, reviewer])
  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      const [a, b] = await Promise.all([estimatePages(m, o), estimatePages(m, { ...PRINT_DEFAULTS, institute: instName, author: creator, teacher: opts.teacher })])
      if (live) { setPages(a); setBase(b) }
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  // Class set: two copies per sheet when the paper is short enough, otherwise 2 columns with the space saver.
  const classSet = async () => {
    const common = { margin: 'narrow', compact: true, size: 11, header: 'compact', studentLine: true, answerGrid: true, optStyle: 'auto' }
    setFitting(true)
    const p2 = await estimatePages(m, { ...o, ...common, nup: 2, columns: 1 })
    if (p2 === 1) { upd({ ...common, nup: 2, columns: 1 }); setNote('') }
    else { upd({ ...common, nup: 1, columns: 2 }); setNote(`Too long for 2 copies per sheet (it needs ${p2 ?? 'several'} sides), so it uses 2 columns with the space saver. Short papers of about 6 questions or fewer fit 2 per sheet.`) }
    setFitting(false)
  }
  const fit = async () => {
    setFitting(true)
    let best = null
    for (const c of SAVERS) { const p = await estimatePages(m, { ...o, ...c }); if (p != null && (!best || p < best.p)) best = { p, c } }
    if (best) upd(best.c)
    setFitting(false)
  }
  const chip = on => ({ padding: isMobile ? '9px 14px' : '6px 13px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink2 })
  const Row = ({ label, children }) => <div style={{ margin: '12px 0 0' }}><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub, marginBottom: 6 }}>{label}</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div></div>
  const Opt = ({ k, v, l }) => <button type="button" aria-pressed={opts[k] === v} style={chip(opts[k] === v)} onClick={() => upd({ [k]: v })}>{l}</button>
  const Tog = ({ k, l }) => <button type="button" aria-pressed={!!opts[k]} style={chip(!!opts[k])} onClick={() => upd({ [k]: !opts[k] })}>{opts[k] ? '✓ ' : ''}{l}</button>
  const nup = opts.nup === 2, students = Math.max(1, Math.min(500, Number(opts.copies) || 1))
  const sheetsNow = pages == null ? null : nup ? (pages === 1 ? Math.ceil(students / 2) : null) : pages * students
  const sheetsBase = base == null ? null : base * students
  const sheetsSaved = sheetsNow != null && sheetsBase != null ? sheetsBase - sheetsNow : 0
  const blocked = nup && pages != null && pages > 1
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.6)', zIndex: 1100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 14 }}>
      <div role="dialog" aria-modal="true" aria-label="Print options" onClick={e => e.stopPropagation()} style={{ width: 'min(620px,100%)', maxHeight: isMobile ? '92vh' : '90vh', overflow: 'auto', background: '#fff', borderRadius: isMobile ? '26px 26px 0 0' : 24, padding: 0, boxShadow: '0 24px 60px rgba(10,20,40,.4)' }}>
        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg,#132a4f,#2f5aa3)', color: '#fff', borderRadius: isMobile ? '26px 26px 0 0' : '24px 24px 0 0', position: 'sticky', top: 0, zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ flex: 1 }}><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#e9d9b0' }}>Print options</div><div style={{ fontFamily: PX.serif, fontSize: 19, fontWeight: 600 }}>{m.title}</div></div>
            <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 17 }}>×</button></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,.16)', borderRadius: 14, padding: '6px 14px', fontWeight: 800, fontSize: 15 }}>{pages == null ? 'Counting pages…' : nup ? (pages === 1 ? '✓ Fits one side' : `✗ ${pages} sides — too long`) : `≈ ${pages} page${pages === 1 ? '' : 's'}`}</span>
            {sheetsNow != null && <span style={{ background: 'rgba(255,255,255,.16)', borderRadius: 14, padding: '6px 12px', fontWeight: 800, fontSize: 13 }}>{sheetsNow} sheet{sheetsNow === 1 ? '' : 's'} for {students} student{students === 1 ? '' : 's'}</span>}
            {sheetsSaved > 0 && <span style={{ background: '#0f7a4c', borderRadius: 14, padding: '6px 12px', fontWeight: 800, fontSize: 13 }}>Saves {sheetsSaved} sheet{sheetsSaved === 1 ? '' : 's'} ({Math.round((sheetsSaved / sheetsBase) * 100)}%)</span>}
            {base != null && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>standard: {base} page{base === 1 ? '' : 's'} each</span>}
          </div>
        </div>
        <div style={{ padding: '4px 20px 20px' }}>
          <Row label="Quick layouts">
            <button type="button" style={chip(false)} onClick={() => upd({ ...PRINT_DEFAULTS, teacher: opts.teacher, byline: opts.byline })}>Standard</button>
            <button type="button" style={chip(false)} onClick={() => upd({ margin: 'narrow', columns: 2, size: 12, compact: true, header: 'compact' })}>⚡ Save paper</button>
            <button type="button" style={chip(false)} onClick={() => upd({ margin: 'minimal', columns: 3, size: 10.5, compact: true, header: 'compact', inkSaver: true })}>📚 Ultra compact</button>
            <button type="button" style={{ ...chip(false), background: '#eef6ff', borderColor: '#9ec3f2' }} disabled={fitting} onClick={fit}>{fitting ? 'Fitting…' : '✨ Fit to fewest pages'}</button>
            <button type="button" style={{ ...chip(false), background: '#eaf7ef', borderColor: '#9bd3b0' }} disabled={fitting} onClick={classSet}>👥 Class set (student lines + answer sheet)</button>
            {note && <div role="status" style={{ flexBasis: '100%', fontSize: 12, color: '#8a5a00', background: '#fff7e6', border: '1px solid #f1d9a8', borderRadius: 10, padding: '6px 10px' }}>{note}</div>}
          </Row>
          <Row label="Copies — how many students need one">
            {[10, 20, 30, 40, 60].map(n => <button key={n} type="button" style={chip(students === n)} aria-pressed={students === n} onClick={() => upd({ copies: n })}>{n}</button>)}
            <input type="number" min="1" max="500" aria-label="Number of students" value={opts.copies} onChange={e => upd({ copies: e.target.value })} style={{ width: 76, padding: '6px 10px', borderRadius: 12, border: `1.5px solid ${PX.line}`, fontSize: isMobile ? 16 : 13.5, fontFamily: 'inherit' }} />
          </Row>
          <Row label="Copies per sheet"><Opt k="nup" v={1} l="1 per sheet" /><Opt k="nup" v={2} l="2 per sheet (A4 landscape, cut in half)" /></Row>
          {nup && <div style={{ fontSize: 12, color: blocked ? PX.bad : PX.sub, marginTop: 6 }}>{blocked ? '⚠ This is too long to fit one side. Shorten it, choose a smaller text size, or use 2 columns instead.' : 'Two identical copies print side by side with a cut line. Paper size, margins and columns are set automatically.'}</div>}
          <Row label="Options (A–D) layout"><Opt k="optStyle" v="auto" l="Automatic" /><Opt k="optStyle" v="four" l="4 across" /><Opt k="optStyle" v="two" l="2 × 2" /><Opt k="optStyle" v="one" l="1 per line" /></Row>
          <Row label="Font"><Opt k="font" v="serif" l="Georgia" /><Opt k="font" v="times" l="Times (compact)" /><Opt k="font" v="sans" l="Arial" /><Opt k="font" v="narrow" l="Narrow (smallest)" /></Row>
          <Row label="Extras for a class set"><Tog k="studentLine" l="Name / roll / date line" /><Tog k="answerGrid" l="Answer-sheet bubbles" /><Tog k="smallFigs" l="Smaller figures" /></Row>
          <Row label="Paper"><Opt k="paper" v="a4" l="A4" /><Opt k="paper" v="a5" l="A5" /><Opt k="landscape" v={false} l="Portrait" /><Opt k="landscape" v={true} l="Landscape" /></Row>
          <Row label="Margins"><Opt k="margin" v="normal" l="Normal" /><Opt k="margin" v="narrow" l="Narrow" /><Opt k="margin" v="minimal" l="Minimal" /></Row>
          <Row label="Columns"><Opt k="columns" v={1} l="1" /><Opt k="columns" v={2} l="2" /><Opt k="columns" v={3} l="3" /></Row>
          <Row label="Text size">{[[10.5, 'XS'], [11, 'S'], [12, 'M−'], [13, 'M'], [14, 'L'], [16, 'XL']].map(([v, l]) => <Opt key={v} k="size" v={v} l={l} />)}</Row>
          <Row label="Header"><Opt k="header" v="full" l="Full" /><Opt k="header" v="compact" l="One line" /><Opt k="header" v="none" l="None" /></Row>
          <Row label="Save space &amp; ink"><Tog k="compact" l="Compact spacing" /><Tog k="inkSaver" l="Ink saver (no colour fills)" /><Tog k="toc" l="Contents list" /></Row>
          <Row label="Copy for"><Opt k="teacher" v={true} l="🎓 Teacher copy (all)" /><Opt k="teacher" v={false} l="🧑‍🎓 Student copy (no teacher boxes)" /></Row>
          <Row label="Credit"><Tog k="byline" l="Show creator & designation" /></Row>
          {opts.byline && (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 14, background: '#faf8f3', border: `1px solid ${PX.line}`, fontSize: 13 }}>
              <div>Prepared by <b>{creator.name || '—'}</b>{creator.designation ? `, ${creator.designation}` : <span style={{ color: PX.sub }}> (no designation found in staff records)</span>}</div>
              <input style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 12, border: `1.5px solid ${PX.line}`, fontSize: isMobile ? 16 : 13.5, fontFamily: 'inherit' }} aria-label="Reviewed by" placeholder="Reviewed by (optional), e.g. Sir Kabiraj, Senior Teacher" value={reviewer} onChange={e => setReviewer(e.target.value)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button className="px-btn gold" style={{ flex: '1 1 160px', minHeight: 46, fontSize: 15 }} disabled={blocked} onClick={() => { onPrint(o); onClose() }}>🖨 {nup ? `Print ${sheetsNow ?? ''} sheet${sheetsNow === 1 ? '' : 's'}` : 'Print / Save PDF'}</button>
            <button className="px-btn ghost" style={{ minHeight: 46 }} onClick={() => onWord(o)}>📝 Word</button>
            <button className="px-btn ghost" style={{ minHeight: 46 }} onClick={onClose}>Cancel</button>
          </div>
          <div style={{ fontSize: 11.5, color: PX.sub, marginTop: 8 }}>Tip: in the browser's print window set Margins to “Default” (or “None” for 2 per sheet), tick “Background graphics”, and print on both sides to halve the paper again. Page counts are estimates.</div>
        </div>
      </div>
    </div>
  )
}

// Page layout for the preview: 1 or 2 columns, and a space saver (tighter spacing, smaller text) like the print layouts.
const bodyStyle = l => ({ fontSize: l.saver ? Math.min(l.size, 12) : l.size, columnCount: l.columns, columnGap: l.columns > 1 ? 26 : undefined, columnRule: l.columns > 1 ? '1px solid #dde1ea' : undefined })
function LayoutControls({ layout, setLayout, inp }) {
  const on = layout.columns === 2 && layout.saver
  const pill = a => ({ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${a ? '#b8923a' : '#e8e3d8'}`, background: a ? '#f6efdc' : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select aria-label="Columns" className="msm-in" style={{ ...inp, width: 'auto', padding: '4px 8px', fontSize: 12.5 }} value={layout.columns} onChange={e => setLayout(l => ({ ...l, columns: Number(e.target.value) }))}><option value={1}>1 column</option><option value={2}>2 columns</option></select>
      <button type="button" aria-pressed={layout.saver} style={pill(layout.saver)} title="Tighter spacing and smaller text so more fits on a page" onClick={() => setLayout(l => ({ ...l, saver: !l.saver }))}>{layout.saver ? '✓ ' : ''}Space saver</button>
      <button type="button" aria-pressed={on} style={pill(on)} title="2 columns + space saver" onClick={() => setLayout(l => (on ? { ...l, columns: 1, saver: false } : { ...l, columns: 2, saver: true }))}>⚡ 2-col saver</button>
      <select aria-label="Text size" className="msm-in" style={{ ...inp, width: 'auto', padding: '4px 8px', fontSize: 12.5 }} value={layout.size} onChange={e => setLayout(l => ({ ...l, size: Number(e.target.value) }))}>{[[11, 'Tiny'], [12, 'Small'], [13, 'Medium'], [15, 'Large']].map(([v, l]) => <option key={v} value={v}>{l} text</option>)}</select>
    </span>
  )
}

// ── Full-screen preview of any material, with previous / next ──
function Viewer({ m, index, total, onIndex, onClose, getFileUrl, instName, layout, setLayout, creator, fav, onFav, onDuplicate, canManage, onEdit, onDelete, onOpen, onPrint, isMobile }) {
  const k = kindOf(m), [ic, kl] = KIND[k]
  const [url, setUrl] = useState(''), [err, setErr] = useState('')
  const emb = k === 'link' ? embedFor(m.link_url) : null
  useEffect(() => {
    let live = true; setUrl(''); setErr('')
    if (m.file_path) getFileUrl(m).then(u => { if (live) setUrl(u || '') }, e => { if (live) setErr(e.message || 'Could not load the file') })
    return () => { live = false }
  }, [m.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const go = useCallback(d => onIndex(Math.max(0, Math.min(total - 1, index + d))), [onIndex, total, index])
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1) }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [go, onClose])
  const touch = useRef(null)
  const nb = { border: 'none', background: '#f1ede3', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: 19, color: PX.ink, flexShrink: 0 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.62)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 14 }}>
      <div role="dialog" aria-modal="true" aria-label={`Preview: ${m.title}`} onClick={e => e.stopPropagation()}
        onTouchStart={e => { touch.current = e.touches[0].clientX }} onTouchEnd={e => { const d = e.changedTouches[0].clientX - (touch.current ?? 0); if (touch.current != null && Math.abs(d) > 90 && k === 'text') go(d < 0 ? 1 : -1); touch.current = null }}
        style={{ width: 'min(920px,100%)', height: isMobile ? '100%' : '92vh', background: '#fff', borderRadius: isMobile ? 0 : 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 28px 70px rgba(10,20,40,.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'linear-gradient(135deg,#132a4f,#2f5aa3)', color: '#fff' }}>
          <button type="button" style={{ ...nb, opacity: index === 0 ? .35 : 1 }} disabled={index === 0} onClick={() => go(-1)} aria-label="Previous material">‹</button>
          <button type="button" style={{ ...nb, opacity: index === total - 1 ? .35 : 1 }} disabled={index === total - 1} onClick={() => go(1)} aria-label="Next material">›</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ic} {m.title}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.75)' }}>{index + 1} of {total} · {[kl, m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : null].filter(Boolean).join(' · ')}</div>
          </div>
          <button type="button" aria-pressed={fav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} onClick={onFav} style={{ ...nb, background: 'rgba(255,255,255,.16)', color: fav ? '#f6c945' : '#fff' }}>{fav ? '★' : '☆'}</button>
          <button type="button" aria-label="Close preview" onClick={onClose} style={{ ...nb, background: 'rgba(255,255,255,.16)', color: '#fff' }}>×</button>
        </div>
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${PX.line}`, display: 'flex', alignItems: 'center', gap: 10, background: '#fcfbf7', flexWrap: 'wrap' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#b8923a,#e9d9b0)', color: '#132a4f', fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{initials(creator.name)}</span>
          <div style={{ lineHeight: 1.25 }}><div style={{ fontSize: 13.5, fontWeight: 800 }}>{creator.name || 'Unknown'}</div><div style={{ fontSize: 12, color: PX.sub }}>{creator.designation || 'Staff'} · {fmtDay(m.created_at)}</div></div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#e9ecf2', padding: k === 'text' ? (isMobile ? 8 : 18) : 0, display: 'flex', flexDirection: 'column' }}>
          {k === 'text' && (
            <div style={{ background: '#fff', maxWidth: '210mm', width: '100%', margin: '0 auto', padding: isMobile ? '18px 16px' : '16mm 14mm', boxShadow: '0 18px 44px -18px rgba(15,27,46,.45), 0 2px 6px rgba(15,27,46,.12)', borderRadius: 4, minHeight: '60%', flexShrink: 0, boxSizing: 'border-box' }}>
              <SheetHead name={instName} />
              <TitleBlock title={m.title} subject={m.subject} test={m.test_no} by={creator.name} designation={creator.designation} />
              <div className={'md' + (layout.saver ? ' compact' : '')} style={bodyStyle(layout)} dangerouslySetInnerHTML={{ __html: renderMaterial(m.body) }} />
            </div>
          )}
          {k === 'image' && (url ? <img src={url} alt={m.title} style={{ maxWidth: '100%', maxHeight: '100%', margin: 'auto', objectFit: 'contain' }} /> : <Msg err={err} />)}
          {k === 'pdf' && (url ? <iframe title={m.title} src={url} style={{ flex: 1, border: 0, width: '100%', background: '#fff' }} /> : <Msg err={err} />)}
          {k === 'link' && (emb
            ? <iframe title={m.title} src={emb.src} style={{ flex: 1, border: 0, width: '100%', background: '#000' }} allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />
            : <div style={{ margin: 'auto', background: '#fff', borderRadius: 16, padding: 22, maxWidth: 420, textAlign: 'center' }}><div style={{ fontSize: 36 }}>🔗</div><div style={{ fontWeight: 800, margin: '6px 0 2px' }}>{m.title}</div><div style={{ fontSize: 12.5, color: PX.sub, wordBreak: 'break-all', marginBottom: 12 }}>{m.link_url}</div><div style={{ fontSize: 12.5, color: PX.sub }}>This link can't be shown inside the portal. Use “Open original”.</div></div>)}
          {(k === 'office' || k === 'file') && <div style={{ margin: 'auto', background: '#fff', borderRadius: 16, padding: 22, maxWidth: 420, textAlign: 'center' }}><div style={{ fontSize: 40 }}>{ic}</div><div style={{ fontWeight: 800, margin: '6px 0 2px' }}>{m.file_name || m.title}</div><div style={{ fontSize: 12.5, color: PX.sub }}>This file type can't be previewed in the browser. Use “Open original” to download or open it.</div></div>}
          {m.body && k !== 'text' && <div style={{ background: '#fff', padding: 14, fontSize: 13.5, borderTop: `1px solid ${PX.line}` }}><div className="md" dangerouslySetInnerHTML={{ __html: renderMaterial(m.body) }} /></div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', borderTop: `1px solid ${PX.line}`, background: '#fff' }}>
          {k === 'text' && <LayoutControls layout={layout} setLayout={setLayout} inp={{ padding: '7px 9px', borderRadius: 10, border: `1.5px solid ${PX.line}`, fontSize: 13 }} />}
          <span style={{ flex: 1 }} />
          {m.body && <button className="px-btn gold" style={{ minHeight: 42 }} onClick={() => onPrint(m)}>🖨 Print…</button>}
          {m.body && <button className="px-btn ghost" style={{ minHeight: 42 }} title="Copy into a new draft" onClick={() => onDuplicate(m)}>⧉ Duplicate</button>}
          <button className="px-btn ghost" style={{ minHeight: 42 }} onClick={() => onOpen(m)}>↗ Open original</button>
          {canManage(m) && <button className="px-btn ghost" style={{ minHeight: 42 }} onClick={() => onEdit(m)}>✎ Edit</button>}
          {canManage(m) && <button className="px-btn ghost" style={{ minHeight: 42, color: PX.bad }} onClick={() => onDelete(m)}>🗑</button>}
        </div>
      </div>
    </div>
  )
}
const Msg = ({ err }) => <div style={{ margin: 'auto', padding: 24, color: err ? '#8f1d14' : PX.sub, fontSize: 14 }}>{err ? '❌ ' + err : 'Loading preview…'}</div>

// ── Insert questions from the Practice bank into the notes (as a tidy MCQ block) ──
function QuestionPicker({ subjects, onInsert, onClose, isMobile }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState('')
  const [subj, setSubj] = useState(''), [setNo, setSetNo] = useState(''), [q, setQ] = useState(''), [sel, setSel] = useState([])
  const [answers, setAnswers] = useState(true), [explain, setExplain] = useState(false)
  useEffect(() => {
    let live = true
    ;(async () => {
      let { data, error } = await fetchAll(() => supabase.from('mission_sainik_questions').select('*').eq('series', 'practice').is('deleted_at', null).order('id'))
      if (error) ({ data, error } = await fetchAll(() => supabase.from('mission_sainik_questions').select('*').eq('series', 'practice').order('id')))
      if (!live) return
      if (error) setErr(error.message || 'Could not load the Practice bank'); else setRows(data || [])
    })()
    return () => { live = false }
  }, [])
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const sets = useMemo(() => [...new Set((rows || []).filter(r => !subj || r.section === subj).map(r => r.test_no))].sort((a, b) => a - b), [rows, subj])
  const shown = useMemo(() => (rows || []).filter(r => (!subj || r.section === subj) && (!setNo || String(r.test_no) === setNo) && (!q.trim() || [r.question, r.topic, r.option_a, r.option_b, r.option_c, r.option_d].join(' ').toLowerCase().includes(q.trim().toLowerCase()))), [rows, subj, setNo, q])
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  const chosen = (rows || []).filter(r => sel.includes(r.id))
  const chip = on => ({ padding: '5px 12px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink2, whiteSpace: 'nowrap', flexShrink: 0 })
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.6)', zIndex: 1100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 14 }}>
      <div role="dialog" aria-modal="true" aria-label="Insert questions from the Practice bank" onClick={e => e.stopPropagation()} style={{ width: 'min(760px,100%)', height: isMobile ? '92vh' : '86vh', background: '#fff', borderRadius: isMobile ? '26px 26px 0 0' : 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg,#132a4f,#2f5aa3)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#e9d9b0' }}>Practice bank</div><div style={{ fontFamily: PX.serif, fontSize: 19, fontWeight: 600 }}>Insert questions into your notes</div></div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 17 }}>×</button>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${PX.line}` }}>
          <input style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 99, border: `1.5px solid ${PX.line}`, fontSize: isMobile ? 16 : 14, fontFamily: 'inherit' }} type="search" placeholder="🔍 Search questions or topics…" aria-label="Search questions" value={q} onChange={e => setQ(e.target.value)} />
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 8 }}><button type="button" style={chip(!subj)} onClick={() => { setSubj(''); setSetNo('') }}>All subjects</button>{subjects.map(x => <button key={x.key} type="button" style={chip(subj === x.label)} onClick={() => { setSubj(subj === x.label ? '' : x.label); setSetNo('') }}>{x.short}</button>)}</div>
          {sets.length > 1 && <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 6 }}><button type="button" style={chip(!setNo)} onClick={() => setSetNo('')}>All sets</button>{sets.map(n => <button key={n} type="button" style={chip(setNo === String(n))} onClick={() => setSetNo(setNo === String(n) ? '' : String(n))}>Set {n}</button>)}</div>}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px' }}>
          {err && <div role="alert" style={{ padding: 14, color: '#8f1d14' }}>❌ {err}</div>}
          {!rows && !err && <div style={{ padding: 24, color: PX.sub, textAlign: 'center' }}>Loading the Practice bank…</div>}
          {rows && !shown.length && <div style={{ padding: 24, color: PX.sub, textAlign: 'center' }}>{rows.length ? 'No questions match.' : 'The Practice bank has no questions yet.'}</div>}
          {shown.map(r => (
            <label key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 4px', borderBottom: `1px solid ${PX.line}`, cursor: 'pointer' }}>
              <input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, color: PX.ink, lineHeight: 1.4 }}>{mathPlain(r.question)}{r.image_data ? ' 🖼' : ''}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: PX.sub, marginTop: 2 }}>{[r.section, 'Set ' + r.test_no, r.topic, r.difficulty].filter(Boolean).join(' · ')}</span>
              </span>
            </label>))}
        </div>
        <div style={{ padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', borderTop: `1px solid ${PX.line}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#fcfbf7' }}>
          <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => setSel(sel.length === shown.length ? [] : shown.map(r => r.id))}>{sel.length && sel.length === shown.length ? 'Clear' : `Select all ${shown.length}`}</button>
          <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={answers} onChange={e => setAnswers(e.target.checked)} />Answers</label>
          <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={explain} onChange={e => setExplain(e.target.checked)} />Explanations</label>
          <span style={{ flex: 1 }} />
          <button type="button" className="px-btn gold" style={{ minHeight: 44 }} disabled={!chosen.length} onClick={() => onInsert(questionsToNotes(chosen, { answers, explain }))}>Insert {chosen.length || ''} question{chosen.length === 1 ? '' : 's'}</button>
        </div>
      </div>
    </div>
  )
}
