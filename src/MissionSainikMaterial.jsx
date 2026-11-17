// MissionSainikMaterial.jsx — Study material studio: write rich notes (headings, lists, tables, callouts, maths, figures),
// see them live as a printed page, scan figures, and preview every kind of material (text, PDF, image, video, link).
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { PX } from './premiumUI'
import ScanFigure from './ScanFigure'
import { MATH_TOOLS } from './MultiQuestionAdder'
import { figFromFile } from './lib/figImage'
import { MATH_CSS, setMathStacked } from './lib/mathText'
import { renderMaterial, materialDocHtml, MATERIAL_CSS, figureLine, wordCount, embedFor, kindOf } from './lib/materialMarkup'

const DRAFT_KEY = 'msm-draft:v1'
const blank = { title: '', subject: '', test_no: 0, link_url: '', note: '', body: '', file: null }
const KIND = { text: ['📝', 'Notes'], pdf: ['📕', 'PDF'], image: ['🖼️', 'Image'], link: ['🔗', 'Link'], office: ['📄', 'Document'], file: ['📎', 'File'] }
const fmtDay = d => { try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) } catch { return '' } }

const TEMPLATES = {
  'Chapter notes': '# Chapter title\n\n## Key ideas\n- Idea one\n- Idea two\n\n> Formula: area = \\frac{1}{2} \\times b \\times h\n\n## Worked example\n> Example: Find the area of a triangle with base 6 cm and height 4 cm.\n\n1. Write the formula\n2. Put in the values\n3. Calculate: \\frac{1}{2} \\times 6 \\times 4 = 12 cm^2\n\n> Remember: always write the unit.\n',
  'Formula sheet': '# Formula sheet\n\n| Shape | Area | Perimeter |\n|---|---|---|\n| Square | a^2 | 4a |\n| Rectangle | l \\times b | 2(l + b) |\n| Triangle | \\frac{1}{2} b h | a + b + c |\n| Circle | \\pi r^2 | 2 \\pi r |\n\n> Tip: learn the formula, then practise one question of each type.\n',
  'Worksheet': '# Practice worksheet\n\nName: ____________   Date: ________\n\n## Section A — Short answers\n1. ______________________________\n2. ______________________________\n3. ______________________________\n\n## Section B — Fill in the blanks\n1. The sum of angles of a triangle is ____ °.\n2. \\frac{1}{2} + \\frac{1}{4} = ____\n\n> Important: show your working.\n',
}

export default function MissionSainikMaterial({ mats, matSetup, draft, setDraft, fileKey, editMat, busy, onSave, onCancelEdit, onEdit, onDelete, onOpen, canManage, getFileUrl, institute, isMobile, subjects, tests, setMsg }) {
  const [tab, setTab] = useState('library')                 // library | create
  const [view, setView] = useState(isMobile ? 'edit' : 'split')
  const [restored, setRestored] = useState(false)
  const [scan, setScan] = useState(false)
  const [figErr, setFigErr] = useState('')
  const [layout, setLayout] = useState({ columns: 1, size: 13 })
  const [q, setQ] = useState(''), [subj, setSubj] = useState(''), [kind, setKind] = useState(''), [testF, setTestF] = useState(''), [sort, setSort] = useState('new'), [grid, setGrid] = useState(false)
  const [viewer, setViewer] = useState(null)                // index into `shown`
  const ta = useRef(null)
  const set = patch => setDraft(d => ({ ...d, ...patch }))
  const instName = institute?.name || 'Guidance Navodaya & Sainik Institute'

  useEffect(() => { if (editMat) setTab('create') }, [editMat])

  // ── draft autosave (new material only) ──
  const loaded = useRef(false)
  useEffect(() => {
    if (!editMat && !draft.title && !draft.body) {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d && (d.title || d.body)) { setDraft(x => ({ ...x, ...d, file: null })); setRestored(true) } } catch { /* none */ }
    }
    loaded.current = true
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loaded.current || editMat) return
    const t = setTimeout(() => { try { if (!draft.title && !draft.body) localStorage.removeItem(DRAFT_KEY); else { const { file, ...rest } = draft; localStorage.setItem(DRAFT_KEY, JSON.stringify(rest)) } } catch { /* storage full/blocked */ } }, 500)
    return () => clearTimeout(t)
  }, [draft, editMat])

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
  const insertAt = (txt, caret) => edit((v, a, b) => ({ text: v.slice(0, a) + txt + v.slice(b), start: a + (caret ?? txt.length) }))
  const insertBlock = txt => edit((v, a) => { const pre = a > 0 && v[a - 1] !== '\n' ? '\n' : '', post = '\n'; return { text: v.slice(0, a) + pre + txt + post + v.slice(a), start: a + pre.length + txt.length + 1 } })
  const addFigure = async file => { setFigErr(''); try { insertBlock(figureLine(await figFromFile(file, { maxW: 720, quality: 0.8, cap: 220000 }), 'Figure')) } catch (e) { setFigErr(e.message) } }
  const useTemplate = name => { if (draft.body.trim() && !window.confirm('Replace what you have typed with this template?')) return; set({ body: TEMPLATES[name] }) }

  // ── library ──
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return mats.filter(m => (!subj || m.subject === subj) && (!kind || kindOf(m) === kind) && (!testF || String(m.test_no) === testF)
      && (!needle || [m.title, m.note, m.body, m.uploaded_by, m.subject].join(' ').toLowerCase().includes(needle)))
      .sort((a, b) => (sort === 'title' ? String(a.title).localeCompare(String(b.title)) : sort === 'old' ? String(a.created_at).localeCompare(String(b.created_at)) : String(b.created_at).localeCompare(String(a.created_at))))
  }, [mats, q, subj, kind, testF, sort])
  const kinds = useMemo(() => { const c = {}; mats.forEach(m => { const k = kindOf(m); c[k] = (c[k] || 0) + 1 }); return c }, [mats])

  const print = m => { const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print'); w.document.write(materialDocHtml(m, { institute: instName, columns: layout.columns, size: layout.size, auto: true }, MATH_CSS + MATERIAL_CSS)); w.document.close() }
  const word = m => {
    setMathStacked(false)
    let html; try { html = materialDocHtml(m, { institute: instName, columns: 1, size: layout.size }, MATH_CSS + MATERIAL_CSS) } finally { setMathStacked(true) }
    const url = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/msword' }))
    const a = document.createElement('a'); a.href = url; a.download = String(m.title).replace(/[^\w-]+/g, '_') + '.doc'; a.click(); URL.revokeObjectURL(url)
  }

  const inp = { padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${PX.line}`, fontSize: isMobile ? 16 : 14, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }
  const seg = on => ({ padding: '8px 14px', borderRadius: 10, border: 'none', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 4px rgba(15,27,46,.15)' : 'none', color: on ? PX.ink : PX.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' })
  const chip = on => ({ padding: '5px 12px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink2 })
  const tbtn = { minWidth: 34, height: 34, padding: '0 9px', borderRadius: 9, border: `1px solid ${PX.line}`, background: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink, flexShrink: 0 }
  const card = { background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 18, boxShadow: '0 1px 2px rgba(19,42,79,.05)', marginBottom: 14, overflow: 'hidden' }

  // ── live preview of what is being written ──
  const [fileUrl, setFileUrl] = useState('')
  useEffect(() => { if (draft.file && /^(image|application\/pdf)/.test(draft.file.type)) { const u = URL.createObjectURL(draft.file); setFileUrl(u); return () => URL.revokeObjectURL(u) } setFileUrl('') }, [draft.file])
  const words = wordCount(draft.body), mins = Math.max(1, Math.round(words / 180))
  const emb = embedFor(draft.link_url)
  const livePreview = (
    <div style={{ background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 6, padding: '22px 26px', boxShadow: '0 4px 18px rgba(15,27,46,.12)', minHeight: 260 }}>
      <div style={{ textAlign: 'center', borderBottom: '3px double #132a4f', paddingBottom: 6, marginBottom: 10, fontFamily: 'Georgia,serif' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#132a4f' }}>{instName}</div><div style={{ fontSize: 11.5, color: '#555' }}>Mission Sainik 2027 · Study Material</div></div>
      <div style={{ font: '700 19px Georgia,serif' }}>{draft.title || <span style={{ color: '#9aa5b8' }}>Title</span>}</div>
      <div style={{ font: '12px system-ui,sans-serif', color: PX.sub, margin: '2px 0 10px' }}>{[draft.subject || 'All subjects', Number(draft.test_no) ? 'Test ' + draft.test_no : ''].filter(Boolean).join(' · ')}</div>
      {draft.body.trim() ? <div className="md" style={{ fontSize: layout.size }} dangerouslySetInnerHTML={{ __html: renderMaterial(draft.body) }} /> : <div style={{ color: '#9aa5b8', fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Start typing — your notes appear here exactly as they will print.</div>}
      {fileUrl && draft.file?.type === 'application/pdf' && <iframe title="PDF preview" src={fileUrl} style={{ width: '100%', height: 360, border: `1px solid ${PX.line}`, marginTop: 12 }} />}
      {fileUrl && /^image/.test(draft.file?.type || '') && <img src={fileUrl} alt="Attached" style={{ maxWidth: '100%', marginTop: 12, borderRadius: 6 }} />}
      {draft.file && !fileUrl && <div style={{ marginTop: 12, padding: 10, background: '#f4f1e8', borderRadius: 8, fontSize: 13 }}>📎 {draft.file.name} will be attached.</div>}
      {draft.link_url && <div style={{ marginTop: 12, padding: 10, background: '#eef4ff', borderRadius: 8, fontSize: 13, wordBreak: 'break-all' }}>🔗 {draft.link_url}</div>}
      {emb && <iframe title="Link preview" src={emb.src} style={{ width: '100%', height: 260, border: 0, marginTop: 8, borderRadius: 8 }} allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />}
    </div>
  )

  const submit = async () => { const ok = await onSave(); if (ok) { try { localStorage.removeItem(DRAFT_KEY) } catch { /* ok */ } setRestored(false); setTab('library') } }

  return (
    <>
      <style>{MATH_CSS + MATERIAL_CSS}</style>
      {matSetup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261202_mission_sainik_materials.sql</b> in Supabase to enable study material.</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div role="tablist" aria-label="Study material" style={{ display: 'inline-flex', padding: 3, background: '#f1ede3', borderRadius: 13, gap: 2 }}>
          <button type="button" role="tab" aria-selected={tab === 'library'} style={seg(tab === 'library')} onClick={() => setTab('library')}>📚 Library ({mats.length})</button>
          <button type="button" role="tab" aria-selected={tab === 'create'} style={seg(tab === 'create')} onClick={() => setTab('create')}>{editMat ? '✎ Editing' : '✍️ Create'}</button>
        </div>
        <span style={{ fontSize: 12.5, color: PX.sub }}>Notes, PDFs, images or links — visible to all staff.</span>
      </div>

      {tab === 'create' && (
        <div style={card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PX.line}`, background: 'linear-gradient(180deg,#fff,#fcfbf7)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}><div style={{ fontFamily: PX.serif, fontSize: 18, fontWeight: 600 }}>{editMat ? 'Edit study material' : 'Create study material'}</div>
              <div style={{ fontSize: 12.5, color: PX.sub }}>{words} words · ~{mins} min read{!editMat && (draft.title || draft.body) ? ' · draft auto-saved' : ''}</div></div>
            <div role="tablist" aria-label="View" style={{ display: 'inline-flex', padding: 3, background: '#f1ede3', borderRadius: 12, gap: 2 }}>
              <button type="button" role="tab" aria-selected={view === 'edit'} style={seg(view === 'edit')} onClick={() => setView('edit')}>✏️ Edit</button>
              {!isMobile && <button type="button" role="tab" aria-selected={view === 'split'} style={seg(view === 'split')} onClick={() => setView('split')}>◫ Side by side</button>}
              <button type="button" role="tab" aria-selected={view === 'preview'} style={seg(view === 'preview')} onClick={() => setView('preview')}>👁 Preview</button>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {restored && <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', marginBottom: 10, borderRadius: 12, background: '#eef6ff', border: '1px solid #c9ddf5', fontSize: 13, color: '#1e3a6e' }}><span style={{ flex: 1 }}>📝 Your unsaved draft was restored.</span><button type="button" className="px-btn ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { setDraft({ ...blank }); setRestored(false) }}>Discard draft</button></div>}
            {view !== 'preview' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input style={inp} aria-label="Title" placeholder="Title, e.g. Fractions — Class 6 notes" value={draft.title} onChange={e => set({ title: e.target.value })} />
                <select style={inp} aria-label="Subject" value={draft.subject} onChange={e => set({ subject: e.target.value })}><option value="">All subjects</option>{subjects.map(x => <option key={x.key} value={x.label}>{x.label}</option>)}</select>
                <select style={inp} aria-label="Test" value={draft.test_no} onChange={e => set({ test_no: e.target.value })}><option value={0}>All tests</option>{tests.map(t => <option key={t.id} value={t.no ?? t.id}>{t.id}</option>)}</select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: view === 'split' ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 16, alignItems: 'start' }}>
              {view !== 'preview' && (
                <div>
                  <div style={{ position: 'sticky', top: 0, zIndex: 4, background: '#fffaf0', border: '1px solid #ead9a8', borderRadius: 12, padding: '6px 8px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', alignItems: 'center' }} role="toolbar" aria-label="Formatting">
                      {[['H1', 'Heading', () => linePrefix('# ')], ['H2', 'Subheading', () => linePrefix('## ')], ['B', 'Bold', () => wrap('**')], ['I', 'Italic', () => wrap('*')], ['▮', 'Highlight', () => wrap('==')], ['•', 'Bullet list', () => linePrefix('- ')], ['1.', 'Numbered list', () => linePrefix('', true)],
                        ['ℹ️ Note', 'Note box', () => linePrefix('> Note: ')], ['💡 Tip', 'Tip box', () => linePrefix('> Tip: ')], ['∑ Formula', 'Formula box', () => linePrefix('> Formula: ')], ['⚠ Important', 'Important box', () => linePrefix('> Important: ')], ['Ex.', 'Example box', () => linePrefix('> Example: ')],
                        ['▦ Table', 'Insert a table', () => insertBlock('| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| a | b | c |\n| d | e | f |')], ['─', 'Divider line', () => insertBlock('---')]].map(([l, t, f]) => <button key={t} type="button" title={t} aria-label={t} onMouseDown={e => e.preventDefault()} onClick={f} style={{ ...tbtn, fontStyle: l === 'I' ? 'italic' : undefined, fontWeight: l === 'B' ? 900 : 700 }}>{l}</button>)}
                      <label title="Upload a figure" style={{ ...tbtn, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>🖼 Figure<input type="file" accept="image/*" aria-label="Upload a figure" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addFigure(f) }} /></label>
                      <button type="button" title="Scan a figure" onClick={() => setScan(true)} style={tbtn}>📷 Scan</button>
                    </div>
                    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginTop: 5, alignItems: 'center' }} role="toolbar" aria-label="Maths symbols">
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a6118', marginRight: 4, flexShrink: 0 }}>Maths</span>
                      {MATH_TOOLS.map(([l, t, c, title]) => <button key={title} type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={() => insertAt(t, c)} style={{ ...tbtn, fontFamily: "Georgia,serif", fontSize: 15 }}>{l}</button>)}
                    </div>
                  </div>
                  {figErr && <div role="alert" style={{ margin: '0 0 8px', padding: '7px 11px', borderRadius: 10, background: '#fdecea', color: '#8f1d14', fontSize: 13 }}>❌ {figErr}</div>}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>Start from</span>
                    {Object.keys(TEMPLATES).map(n => <button key={n} type="button" style={chip(false)} onClick={() => useTemplate(n)}>{n}</button>)}
                  </div>
                  <textarea ref={ta} style={{ ...inp, minHeight: isMobile ? 260 : 380, resize: 'vertical', lineHeight: 1.55, fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: isMobile ? 16 : 13.5 }} aria-label="Study material text"
                    placeholder={'Type or paste the study material here.\n\n# Heading   ## Subheading   **bold**   - bullets   1. numbers\n> Formula: \\frac{3}{4} + \\frac{1}{4} = 1\n\nUse the buttons above for tables, boxes, maths and figures.'} value={draft.body} onChange={e => set({ body: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Attach a file (PDF, image, Word…)<input key={fileKey} style={{ ...inp, marginTop: 4 }} type="file" aria-label="Choose a file" onChange={e => set({ file: e.target.files?.[0] || null })} /></label>
                    <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>…or a link (Drive, YouTube)<input style={{ ...inp, marginTop: 4 }} aria-label="Link" placeholder="https://" value={draft.link_url} onChange={e => set({ link_url: e.target.value })} /></label>
                    <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub, gridColumn: '1 / -1' }}>Note (optional)<input style={{ ...inp, marginTop: 4 }} aria-label="Note" placeholder="e.g. For Class 6 batch, revise before Test 5" value={draft.note} onChange={e => set({ note: e.target.value })} /></label>
                  </div>
                </div>
              )}
              {view !== 'edit' && <div style={view === 'split' ? { position: 'sticky', top: 8, maxHeight: '86vh', overflow: 'auto' } : undefined}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13 }}>Live preview</b><span style={{ fontSize: 12, color: PX.sub }}>as it will print</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <select aria-label="Columns" style={{ ...inp, width: 'auto', padding: '4px 8px', fontSize: 12.5 }} value={layout.columns} onChange={e => setLayout(l => ({ ...l, columns: Number(e.target.value) }))}><option value={1}>1 column</option><option value={2}>2 columns</option></select>
                    <select aria-label="Text size" style={{ ...inp, width: 'auto', padding: '4px 8px', fontSize: 12.5 }} value={layout.size} onChange={e => setLayout(l => ({ ...l, size: Number(e.target.value) }))}>{[[12, 'Small'], [13, 'Medium'], [15, 'Large']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  </span>
                </div>
                {livePreview}
              </div>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap', position: 'sticky', bottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : 0, background: '#fff', padding: '10px 0', borderTop: `1px solid ${PX.line}`, zIndex: 4 }}>
              <button className="px-btn gold" disabled={busy} onClick={submit}>{busy ? 'Saving…' : editMat ? '✔ Save changes' : '⬆ Add material'}</button>
              {editMat && <><span style={{ fontSize: 13, color: PX.sub }}>Editing “{editMat.title}”{editMat.file_name ? ' · choose a file only to replace ' + editMat.file_name : ''}</span><button className="px-btn ghost" onClick={() => { onCancelEdit(); setTab('library') }}>Cancel</button></>}
            </div>
          </div>
        </div>
      )}

      {tab === 'library' && (
        <div style={card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PX.line}`, background: 'linear-gradient(180deg,#fff,#fcfbf7)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...inp, flex: '1 1 180px', width: 'auto' }} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search title, note or text…" aria-label="Search material" />
              <select style={{ ...inp, width: 'auto', flex: '0 1 150px' }} value={testF} onChange={e => setTestF(e.target.value)} aria-label="Filter by test"><option value="">All tests</option>{tests.map(t => <option key={t.id} value={t.no ?? t.id}>{t.id}</option>)}</select>
              <select style={{ ...inp, width: 'auto', flex: '0 1 140px' }} value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort material"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="title">Title A–Z</option></select>
              <span role="tablist" aria-label="Layout" style={{ display: 'inline-flex', padding: 3, background: '#f1ede3', borderRadius: 11, gap: 2 }}>{[[false, '☰ List'], [true, '▦ Grid']].map(([g, l]) => <button key={l} type="button" role="tab" aria-selected={grid === g} style={{ ...seg(grid === g), padding: '6px 11px' }} onClick={() => setGrid(g)}>{l}</button>)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" style={chip(!subj)} onClick={() => setSubj('')}>All subjects</button>
              {subjects.map(x => { const n = mats.filter(m => m.subject === x.label).length; return <button key={x.key} type="button" style={chip(subj === x.label)} onClick={() => setSubj(subj === x.label ? '' : x.label)}>{x.short} {n}</button> })}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" style={chip(!kind)} onClick={() => setKind('')}>Any type</button>
              {Object.entries(KIND).filter(([k]) => kinds[k]).map(([k, [ic, l]]) => <button key={k} type="button" style={chip(kind === k)} onClick={() => setKind(kind === k ? '' : k)}>{ic} {l} {kinds[k]}</button>)}
            </div>
          </div>
          <div style={{ padding: grid ? 14 : '4px 14px 10px' }}>
            {!shown.length && <div style={{ padding: 24, color: PX.sub, fontSize: 13.5, textAlign: 'center' }}>{mats.length ? 'No material matches these filters.' : 'Nothing here yet — tap “✍️ Create” to add the first notes.'}</div>}
            <div style={grid ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,250px),1fr))', gap: 12 } : undefined}>
              {shown.map((m, i) => {
                const k = kindOf(m), [ic, kl] = KIND[k]
                return (
                  <div key={m.id} style={grid ? { border: `1px solid ${PX.line}`, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: '#fff' } : { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 2px', borderTop: i ? `1px solid ${PX.line}` : 'none', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 190 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 14, background: '#eef2f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flex: 'none' }}>{ic}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14.5, color: PX.ink }}>{m.title}</div>
                        <div style={{ fontSize: 12, color: PX.sub, marginTop: 1 }}>{[kl, m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : null, m.uploaded_by, fmtDay(m.created_at)].filter(Boolean).join(' · ')}</div>
                        {m.note && <div style={{ fontSize: 12, color: PX.sub, fontStyle: 'italic', marginTop: 2 }}>{m.note}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="px-btn gold" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => setViewer(i)}>👁 Preview</button>
                      <button className="px-hbtn" onClick={() => onOpen(m)}>Open</button>
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

      {scan && <ScanFigure title="Scan a figure for your notes" maxW={720} cap={220000} onClose={() => setScan(false)} onDone={u => { setScan(false); insertBlock(figureLine(u, 'Figure')) }} />}
      {viewer != null && shown[viewer] && (
        <Viewer m={shown[viewer]} index={viewer} total={shown.length} onIndex={setViewer} onClose={() => setViewer(null)} getFileUrl={getFileUrl} instName={instName} layout={layout} setLayout={setLayout}
          canManage={canManage} onEdit={m => { setViewer(null); onEdit(m) }} onDelete={m => { setViewer(null); onDelete(m) }} onOpen={onOpen} onPrint={print} onWord={word} isMobile={isMobile} />
      )}
    </>
  )
}

// ── Full-screen preview of any material, with previous / next ──
function Viewer({ m, index, total, onIndex, onClose, getFileUrl, instName, layout, setLayout, canManage, onEdit, onDelete, onOpen, onPrint, onWord, isMobile }) {
  const k = kindOf(m), [ic, kl] = KIND[k]
  const [url, setUrl] = useState(''), [err, setErr] = useState('')
  const emb = k === 'link' ? embedFor(m.link_url) : null
  useEffect(() => {
    let live = true; setUrl(''); setErr('')
    if (m.file_path) getFileUrl(m).then(u => { if (live) setUrl(u || '') }, e => { if (live) setErr(e.message || 'Could not load the file') })
    return () => { live = false }
  }, [m.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const go = useCallback(d => onIndex(i => Math.max(0, Math.min(total - 1, i + d))), [onIndex, total])
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1) }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [go, onClose])
  const nb = { border: 'none', background: '#f1ede3', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18, color: PX.ink }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.62)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 14 }}>
      <div role="dialog" aria-modal="true" aria-label={`Preview: ${m.title}`} onClick={e => e.stopPropagation()} style={{ width: 'min(900px,100%)', height: isMobile ? '100%' : '90vh', background: '#fff', borderRadius: isMobile ? 0 : 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${PX.line}`, flexWrap: 'wrap' }}>
          <button type="button" style={{ ...nb, opacity: index === 0 ? .35 : 1 }} disabled={index === 0} onClick={() => go(-1)} aria-label="Previous material">‹</button>
          <button type="button" style={{ ...nb, opacity: index === total - 1 ? .35 : 1 }} disabled={index === total - 1} onClick={() => go(1)} aria-label="Next material">›</button>
          <div style={{ flex: 1, minWidth: 140 }}><div style={{ fontWeight: 800, fontSize: 15 }}>{ic} {m.title}</div><div style={{ fontSize: 12, color: PX.sub }}>{index + 1} of {total} · {[kl, m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : null, m.uploaded_by].filter(Boolean).join(' · ')}</div></div>
          <button type="button" aria-label="Close preview" onClick={onClose} style={nb}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#e9ecf2', padding: k === 'text' ? (isMobile ? 8 : 18) : 0, display: 'flex', flexDirection: 'column' }}>
          {k === 'text' && (
            <div style={{ background: '#fff', maxWidth: '210mm', width: '100%', margin: '0 auto', padding: isMobile ? '18px 16px' : '16mm 14mm', boxShadow: '0 4px 20px rgba(15,27,46,.2)', minHeight: '60%' }}>
              <div style={{ textAlign: 'center', borderBottom: '3px double #132a4f', paddingBottom: 6, marginBottom: 10, fontFamily: 'Georgia,serif' }}><div style={{ fontSize: 19, fontWeight: 700, color: '#132a4f' }}>{instName}</div><div style={{ fontSize: 11.5, color: '#555' }}>Mission Sainik 2027 · Study Material</div></div>
              <div style={{ font: '700 20px Georgia,serif' }}>{m.title}</div>
              <div style={{ font: '12px system-ui,sans-serif', color: PX.sub, margin: '2px 0 12px' }}>{[m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : '', m.uploaded_by].filter(Boolean).join(' · ')}</div>
              <div className={'md'} style={{ fontSize: layout.size, columnCount: layout.columns, columnGap: 28 }} dangerouslySetInnerHTML={{ __html: renderMaterial(m.body) }} />
            </div>
          )}
          {k === 'image' && (url ? <img src={url} alt={m.title} style={{ maxWidth: '100%', maxHeight: '100%', margin: 'auto', objectFit: 'contain' }} /> : <Msg err={err} />)}
          {k === 'pdf' && (url ? <iframe title={m.title} src={url} style={{ flex: 1, border: 0, width: '100%', background: '#fff' }} /> : <Msg err={err} />)}
          {k === 'link' && (emb
            ? <iframe title={m.title} src={emb.src} style={{ flex: 1, border: 0, width: '100%', background: '#000' }} allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />
            : <div style={{ margin: 'auto', background: '#fff', borderRadius: 16, padding: 22, maxWidth: 420, textAlign: 'center' }}><div style={{ fontSize: 36 }}>🔗</div><div style={{ fontWeight: 800, margin: '6px 0 2px' }}>{m.title}</div><div style={{ fontSize: 12.5, color: PX.sub, wordBreak: 'break-all', marginBottom: 12 }}>{m.link_url}</div><div style={{ fontSize: 12.5, color: PX.sub }}>This link can't be shown inside the portal. Use “Open original”.</div></div>)}
          {(k === 'office' || k === 'file') && <div style={{ margin: 'auto', background: '#fff', borderRadius: 16, padding: 22, maxWidth: 420, textAlign: 'center' }}><div style={{ fontSize: 40 }}>{ic}</div><div style={{ fontWeight: 800, margin: '6px 0 2px' }}>{m.file_name || m.title}</div><div style={{ fontSize: 12.5, color: PX.sub }}>This file type can't be previewed in the browser. Use “Open original” to download or open it.</div></div>}
          {m.body && k !== 'text' && <div style={{ background: '#fff', padding: 14, fontSize: 13.5, whiteSpace: 'pre-wrap', borderTop: `1px solid ${PX.line}` }}>{m.body}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderTop: `1px solid ${PX.line}`, background: '#fff' }}>
          {k === 'text' && <>
            <select aria-label="Columns" style={{ padding: '6px 8px', borderRadius: 10, border: `1.5px solid ${PX.line}`, fontSize: 13 }} value={layout.columns} onChange={e => setLayout(l => ({ ...l, columns: Number(e.target.value) }))}><option value={1}>1 column</option><option value={2}>2 columns</option></select>
            <select aria-label="Text size" style={{ padding: '6px 8px', borderRadius: 10, border: `1.5px solid ${PX.line}`, fontSize: 13 }} value={layout.size} onChange={e => setLayout(l => ({ ...l, size: Number(e.target.value) }))}>{[[12, 'Small'], [13, 'Medium'], [15, 'Large']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </>}
          <span style={{ flex: 1 }} />
          {m.body && <button className="px-btn gold" onClick={() => onPrint(m)}>🖨 Print</button>}
          {m.body && <button className="px-btn ghost" onClick={() => onWord(m)}>📝 Word</button>}
          <button className="px-btn ghost" onClick={() => onOpen(m)}>↗ Open original</button>
          {canManage(m) && <button className="px-btn ghost" onClick={() => onEdit(m)}>✎ Edit</button>}
          {canManage(m) && <button className="px-btn ghost" style={{ color: PX.bad }} onClick={() => onDelete(m)}>🗑</button>}
        </div>
      </div>
    </div>
  )
}
const Msg = ({ err }) => <div style={{ margin: 'auto', padding: 24, color: err ? '#8f1d14' : PX.sub, fontSize: 14 }}>{err ? '❌ ' + err : 'Loading preview…'}</div>
