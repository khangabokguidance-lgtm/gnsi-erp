// studioDesigns.js — GNSI Portal · Material Studio output designs
//
// Turns a tray of Question Bank questions and study materials into a
// finished teaching document:
//   worksheet · test paper (A/B versions) · revision notes · flashcards
//   (all print / PDF / Word) and PowerPoint slides.
// Every value is HTML-escaped: the print window shares the portal's origin.

import QRCode from 'qrcode'

export const DESIGNS = [
  { id: 'worksheet', label: 'Worksheet', icon: '📝', desc: 'Practice sheet with answer space and a separate answer key' },
  { id: 'test', label: 'Test paper', icon: '🧾', desc: 'Sections, marks, time, A/B versions and an answer key' },
  { id: 'slides', label: 'Slides', icon: '🎞️', desc: 'PowerPoint — one question per slide with answer reveal' },
  { id: 'notes', label: 'Revision notes', icon: '📚', desc: 'Chapter handout from materials, with QR links and key questions' },
  { id: 'flashcards', label: 'Flashcards', icon: '🃏', desc: 'Cut-out cards — question on the front, answer on the back' },
]

export const MATERIAL_TYPES = {
  notes: { label: 'Notes', icon: '📄' }, formula: { label: 'Formula sheet', icon: '🔣' }, practice: { label: 'Practice set', icon: '✏️' },
  solved: { label: 'Solved paper', icon: '✅' }, mindmap: { label: 'Mind map', icon: '🗂️' }, video: { label: 'Video', icon: '🎥' },
  currentaffairs: { label: 'Current affairs', icon: '📰' },
}

export const DEFAULT_OPTIONS = {
  title: '', subtitle: '', teacher: '', date: new Date().toISOString().slice(0, 10), instructions: '',
  columns: 1, answerSpace: 'none', showTags: false, fontSize: 'M', answerKey: true,
  marksEach: 1, duration: 30, versions: 1, shuffle: false, sectionBy: 'subject', revealAnswers: true,
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
const OPTS = ['a', 'b', 'c', 'd']
const FONT = { S: 11.5, M: 13, L: 15 }

// Seeded shuffle so version B is the same every time it's printed.
function seeded(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6 }
}
function shuffle(arr, rand) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

export const questionsOf = tray => tray.filter(i => i.kind === 'q').map(i => i.row)
export const materialsOf = tray => tray.filter(i => i.kind === 'm').map(i => i.row)

// ── Page chrome ───────────────────────────────────────────────────────────────
const css = o => `
  @page { size: A4; margin: 13mm }
  * { box-sizing: border-box }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f1b2e; margin: 0; font-size: ${FONT[o.fontSize] || 13}px; line-height: 1.45 }
  .page { page-break-after: always } .page:last-child { page-break-after: auto }
  .head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #132a4f; padding-bottom:8px; margin-bottom:4px }
  .head .brand { font-family: Georgia, serif; font-weight:700; font-size:20px; color:#132a4f; letter-spacing:.04em }
  .head .inst { font-size:10.5px; color:#5d6b82 }
  .gold { height:2px; background:#b8923a; margin-bottom:12px }
  h1 { font-family: Georgia, serif; font-size:1.6em; margin:6px 0 2px; color:#0f1b2e }
  .sub { color:#5d6b82; font-size:.92em }
  .meta { display:flex; gap:14px; flex-wrap:wrap; font-size:.9em; margin:10px 0; padding:8px 12px; border:1px solid #e8e3d8; border-radius:8px; background:#faf8f3 }
  .fill { display:flex; gap:18px; margin:8px 0 12px; font-size:.92em } .fill span { flex:1; border-bottom:1px solid #9aa3b2; padding-bottom:2px }
  .instr { background:#fff5e0; border:1px solid #eadbb2; border-radius:8px; padding:8px 12px; font-size:.9em; margin-bottom:12px; white-space:pre-wrap }
  .sec { background:#132a4f; color:#fff; padding:5px 10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; font-size:.85em; margin:14px 0 8px; break-after:avoid; column-span:all }
  .q { break-inside:avoid; margin-bottom:12px }
  .q .n { font-weight:700; color:#132a4f; margin-right:4px }
  .q .opts { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; margin:4px 0 0 20px }
  .q .tag { display:inline-block; font-size:.72em; color:#8a6118; background:#f6efdc; border-radius:99px; padding:1px 7px; margin-left:6px; vertical-align:middle }
  .q img { max-width:100%; max-height:170px; margin:5px 0 0 20px; display:block }
  .marks { float:right; font-size:.8em; color:#5d6b82 }
  .lines div { border-bottom:1px dotted #9aa3b2; height:22px; margin-left:20px }
  .box { border:1px solid #9aa3b2; border-radius:6px; height:70px; margin:6px 0 0 20px }
  .cols2 { columns:2; column-gap:9mm; column-rule:1px solid #e8e3d8 }
  table.key { width:100%; border-collapse:collapse } table.key td { border:1px solid #d9d2c2; text-align:center; padding:5px; font-size:.9em }
  table.key td b { display:block; font-size:1.1em }
  .foot { margin-top:14px; font-size:.75em; color:#8a93a6; text-align:center }
`

const header = (o, right = '') => `
  <div class="head"><div><div class="brand">GNSI</div><div class="inst">Guidance Navodaya &amp; Sainik Institute · Khangabok</div></div>
  <div style="text-align:right;font-size:.85em;color:#5d6b82">${right}</div></div><div class="gold"></div>`

const optionsHtml = (q, withAnswer) => `<div class="opts">${OPTS.filter(k => q[`option_${k}`]).map(k => {
  const L = k.toUpperCase(), right = withAnswer && q.correct_option === L
  return `<div${right ? ' style="font-weight:700;color:#0f7a4c"' : ''}>(${L}) ${esc(q[`option_${k}`])}${right ? ' ✓' : ''}</div>`
}).join('')}</div>`

const answerSpace = o => (o.answerSpace === 'lines' ? '<div class="lines"><div></div><div></div></div>' : o.answerSpace === 'box' ? '<div class="box"></div>' : '')

const tagOf = q => [q.subject, q.chapter].filter(Boolean).join(' · ')

function questionHtml(q, n, o, { withAnswer = false, marks = null } = {}) {
  return `<div class="q">${marks != null ? `<span class="marks">[${esc(marks)}]</span>` : ''}
    <span class="n">${n}.</span>${esc(q.question)}${o.showTags ? `<span class="tag">${esc(tagOf(q))}</span>` : ''}
    ${q.diagram_url ? `<img src="${esc(q.diagram_url)}" alt="">` : ''}
    ${optionsHtml(q, withAnswer)}${withAnswer ? '' : answerSpace(o)}</div>`
}

function keyTable(qs, label = 'Answer key') {
  const cells = qs.map((q, i) => `<td><span style="color:#8a93a6;font-size:.8em">${i + 1}</span><b>${esc(q.correct_option || '—')}</b></td>`)
  const rows = []
  for (let i = 0; i < cells.length; i += 10) rows.push(`<tr>${cells.slice(i, i + 10).join('')}</tr>`)
  return `<h1 style="font-size:1.25em">${esc(label)}</h1><table class="key">${rows.join('')}</table>`
}

// Group questions by subject (or chapter) in first-seen order.
function sections(qs, by) {
  if (by === 'none') return [{ name: '', items: qs }]
  const m = new Map()
  for (const q of qs) { const k = (by === 'chapter' ? q.chapter : q.subject) || 'General'; if (!m.has(k)) m.set(k, []); m.get(k).push(q) }
  return [...m].map(([name, items]) => ({ name, items }))
}

// ── Worksheet ────────────────────────────────────────────────────────────────
function worksheet(tray, o) {
  const qs = questionsOf(tray)
  let n = 0
  const body = sections(qs, o.sectionBy).map(s => `${s.name ? `<div class="sec">${esc(s.name)}</div>` : ''}${s.items.map(q => questionHtml(q, ++n, o)).join('')}`).join('')
  let html = `<div class="page">${header(o, esc(fmtDate(o.date)))}
    <h1>${esc(o.title || 'Worksheet')}</h1>${o.subtitle ? `<div class="sub">${esc(o.subtitle)}</div>` : ''}
    <div class="fill"><span>Name:</span><span>Class / Roll:</span><span>Date:</span></div>
    ${o.instructions ? `<div class="instr">${esc(o.instructions)}</div>` : ''}
    <div class="${o.columns === 2 ? 'cols2' : ''}">${body || '<p class="sub">No questions in the tray.</p>'}</div>
    ${o.teacher ? `<div class="foot">Prepared by ${esc(o.teacher)}</div>` : ''}</div>`
  if (o.answerKey && qs.length) html += `<div class="page">${header(o, 'Teacher copy')}${keyTable(qs)}</div>`
  return html
}

// ── Test paper ───────────────────────────────────────────────────────────────
function testPaper(tray, o) {
  const base = questionsOf(tray)
  const versions = Math.max(1, Math.min(2, Number(o.versions) || 1))
  const pages = []
  const keys = []
  for (let v = 0; v < versions; v++) {
    const code = 'AB'[v]
    const rand = seeded(`${o.title}|${base.map(q => q.id).join(',')}|${code}`)
    // Version A keeps tray order (or one shuffle if asked); B is always shuffled within sections.
    const secs = sections(base, o.sectionBy).map(s => ({ ...s, items: v === 0 && !o.shuffle ? s.items : shuffle(s.items, rand) }))
    const flat = secs.flatMap(s => s.items)
    const marks = Number(o.marksEach) || 1
    let n = 0
    const body = secs.map(s => `${s.name ? `<div class="sec">${esc(s.name)} · ${s.items.length * marks} marks</div>` : ''}${s.items.map(q => questionHtml(q, ++n, o, { marks })).join('')}`).join('')
    pages.push(`<div class="page">${header(o, versions > 1 ? `<b style="font-size:1.6em;color:#132a4f;border:2px solid #132a4f;padding:2px 12px">SET ${code}</b>` : '')}
      <h1>${esc(o.title || 'Class Test')}</h1>${o.subtitle ? `<div class="sub">${esc(o.subtitle)}</div>` : ''}
      <div class="meta"><span><b>Date:</b> ${esc(fmtDate(o.date))}</span><span><b>Time:</b> ${esc(o.duration)} min</span><span><b>Questions:</b> ${flat.length}</span><span><b>Max. marks:</b> ${flat.length * marks}</span>${o.teacher ? `<span><b>Teacher:</b> ${esc(o.teacher)}</span>` : ''}</div>
      <div class="fill"><span>Name:</span><span>Roll no.:</span><span>Marks obtained: ____ / ${flat.length * marks}</span></div>
      <div class="instr">${esc(o.instructions || 'Answer all questions. Each question has one correct answer. Write the letter of the correct option.')}</div>
      <div class="${o.columns === 2 ? 'cols2' : ''}">${body || '<p class="sub">No questions in the tray.</p>'}</div></div>`)
    keys.push({ code, flat })
  }
  if (o.answerKey && base.length) pages.push(`<div class="page">${header(o, 'Teacher copy — confidential')}${keys.map(k => keyTable(k.flat, versions > 1 ? `Answer key · Set ${k.code}` : 'Answer key')).join('<div style="height:18px"></div>')}</div>`)
  return pages.join('')
}

// ── Revision notes ───────────────────────────────────────────────────────────
async function notes(tray, o) {
  const mats = materialsOf(tray), qs = questionsOf(tray)
  const qr = await Promise.all(mats.map(m => (m.file_url && /^https?:/i.test(m.file_url) ? QRCode.toDataURL(m.file_url, { margin: 0, width: 110 }).catch(() => '') : '')))
  const byCh = new Map()
  mats.forEach((m, i) => { const k = [m.subject, m.chapter].filter(Boolean).join(' · ') || 'General'; if (!byCh.has(k)) byCh.set(k, []); byCh.get(k).push({ m, qr: qr[i] }) })
  const matHtml = [...byCh].map(([ch, list]) => `<div class="sec">${esc(ch)}</div>${list.map(({ m, qr: code }) => `
    <div class="q" style="display:flex;gap:12px;border:1px solid #e8e3d8;border-radius:10px;padding:10px 12px">
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:1.05em">${esc(MATERIAL_TYPES[m.material_type]?.icon || '📄')} ${esc(m.title)}</div>
        <div class="sub" style="font-size:.8em;text-transform:uppercase;letter-spacing:.06em">${esc(MATERIAL_TYPES[m.material_type]?.label || m.material_type || 'Material')}</div>
        ${m.description ? `<div style="margin-top:4px;white-space:pre-wrap">${esc(m.description)}</div>` : ''}
        ${m.file_url ? `<div style="margin-top:4px;font-size:.8em;color:#1e3a6e;word-break:break-all">${esc(m.file_url)}</div>` : ''}</div>
      ${code ? `<div style="text-align:center"><img src="${code}" style="width:84px;height:84px"><div style="font-size:.65em;color:#8a93a6">scan to open</div></div>` : ''}
    </div>`).join('')}`).join('')
  const practice = qs.length ? `<div class="sec">Key questions</div>${qs.map((q, i) => questionHtml(q, i + 1, { ...o, answerSpace: 'none' }, { withAnswer: o.revealAnswers })).join('')}` : ''
  return `<div class="page">${header(o, esc(fmtDate(o.date)))}
    <h1>${esc(o.title || 'Revision Notes')}</h1>${o.subtitle ? `<div class="sub">${esc(o.subtitle)}</div>` : ''}
    ${o.instructions ? `<div class="instr">${esc(o.instructions)}</div>` : ''}
    ${matHtml || (practice ? '' : '<p class="sub">Add study materials or questions to the tray.</p>')}${practice}
    ${o.teacher ? `<div class="foot">Prepared by ${esc(o.teacher)}</div>` : ''}</div>`
}

// ── Flashcards (8 per A4: fronts, then backs mirrored for duplex) ─────────────
function flashcards(tray, o) {
  const cards = [
    ...questionsOf(tray).map(q => ({
      front: `${esc(q.question)}${q.diagram_url ? `<img src="${esc(q.diagram_url)}" style="max-height:70px;display:block;margin:6px auto 0">` : ''}<div style="font-size:.8em;margin-top:8px;text-align:left">${OPTS.filter(k => q[`option_${k}`]).map(k => `(${k.toUpperCase()}) ${esc(q[`option_${k}`])}`).join('<br>')}</div>`,
      back: `<div style="font-size:2.2em;font-weight:800;color:#0f7a4c">${esc(q.correct_option || '?')}</div><div>${esc(q[`option_${String(q.correct_option || '').toLowerCase()}`] || '')}</div>`,
      tag: tagOf(q),
    })),
    ...materialsOf(tray).map(m => ({ front: `<b>${esc(m.title)}</b>`, back: esc(m.description || m.file_url || ''), tag: [m.subject, m.chapter].filter(Boolean).join(' · ') })),
  ]
  if (!cards.length) return `<div class="page">${header(o)}<p class="sub">Add questions or materials to the tray.</p></div>`
  const card = (html, tag, back) => `<div style="border:1.5px dashed #9aa3b2;border-radius:10px;padding:12px;height:62mm;display:flex;flex-direction:column;justify-content:center;text-align:center;overflow:hidden;position:relative;background:${back ? '#f6efdc' : '#fff'}">
    <div style="position:absolute;top:6px;left:10px;font-size:.62em;color:#8a6118;letter-spacing:.08em;text-transform:uppercase">${back ? 'Answer' : esc(o.title || 'GNSI')}</div>
    ${html}<div style="position:absolute;bottom:6px;right:10px;font-size:.62em;color:#8a93a6">${esc(tag || '')}</div></div>`
  const pages = []
  for (let i = 0; i < cards.length; i += 8) {
    const chunk = cards.slice(i, i + 8)
    pages.push(`<div class="page"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm">${chunk.map(c => card(c.front, c.tag)).join('')}</div></div>`)
    // Backs: swap columns in each row so they line up when printed double-sided.
    const backs = []
    for (let r = 0; r < chunk.length; r += 2) { backs.push(chunk[r + 1] ? card(chunk[r + 1].back, '', true) : '<div></div>'); backs.push(card(chunk[r].back, '', true)) }
    pages.push(`<div class="page"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm">${backs.join('')}</div></div>`)
  }
  return pages.join('')
}

// ── Slide preview (HTML) ─────────────────────────────────────────────────────
function slidesPreview(tray, o) {
  const s = (inner, dark) => `<div style="aspect-ratio:16/9;border-radius:10px;margin:0 0 12px;padding:22px 28px;display:flex;flex-direction:column;justify-content:center;background:${dark ? 'linear-gradient(135deg,#0e203f,#132a4f)' : '#fff'};color:${dark ? '#fff' : '#0f1b2e'};border:1px solid #e8e3d8;border-bottom:4px solid #b8923a">${inner}</div>`
  const out = [s(`<div style="color:#e9d9b0;letter-spacing:.2em;font-size:.75em">GNSI</div><div style="font-family:Georgia,serif;font-size:2em;margin-top:6px">${esc(o.title || 'Class presentation')}</div><div style="opacity:.7">${esc(o.subtitle || '')}</div>`, true)]
  let n = 0
  for (const it of tray) {
    if (it.kind === 'q') {
      const q = it.row; n++
      out.push(s(`<div style="color:#8a6118;font-size:.75em">Question ${n}${o.showTags ? ` · ${esc(tagOf(q))}` : ''}</div><div style="font-size:1.25em;font-weight:600;margin:6px 0 10px">${esc(q.question)}</div>${optionsHtml(q, false)}`))
      if (o.revealAnswers) out.push(s(`<div style="color:#8a6118;font-size:.75em">Answer ${n}</div><div style="font-size:1.1em;margin:6px 0 10px">${esc(q.question)}</div>${optionsHtml(q, true)}`))
    } else {
      const m = it.row
      out.push(s(`<div style="color:#8a6118;font-size:.75em">${esc(MATERIAL_TYPES[m.material_type]?.label || 'Material')}</div><div style="font-size:1.4em;font-weight:700;margin:6px 0">${esc(m.title)}</div><div style="white-space:pre-wrap">${esc(m.description || '')}</div>${m.file_url ? `<div style="font-size:.8em;color:#1e3a6e;margin-top:8px;word-break:break-all">${esc(m.file_url)}</div>` : ''}`))
    }
  }
  return `<div style="max-width:720px;margin:0 auto;padding:12px">${out.join('')}</div>`
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function buildHtml(design, tray, o, { autoPrint = false } = {}) {
  const body = design === 'worksheet' ? worksheet(tray, o) : design === 'test' ? testPaper(tray, o)
    : design === 'notes' ? await notes(tray, o) : design === 'flashcards' ? flashcards(tray, o) : slidesPreview(tray, o)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.title || 'GNSI material')}</title><style>${css(o)}</style></head><body${design === 'slides' ? ' style="background:#f3f0e8"' : ''}>${body}
    ${autoPrint ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},350)})</script>" : ''}</body></html>`
}

export function openPrintWindow() {
  const w = window.open('', '_blank')
  if (w) w.document.write('<p style="font:14px system-ui;padding:24px;color:#5d6b82">Preparing…</p>')
  return w
}

export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const fileBase = o => (o.title || 'GNSI-material').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'GNSI-material'

// Word opens HTML saved with a Word namespace as a normal document.
export async function downloadWord(design, tray, o) {
  const html = (await buildHtml(design, tray, o)).replace('<html>', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">')
  downloadBlob(`${fileBase(o)}.doc`, new Blob(['﻿', html], { type: 'application/msword' }))
}

export async function downloadPptx(tray, o) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'
  const NAVY = '132A4F', GOLD = 'B8923A', INK = '0F1B2E', OK = '0F7A4C'
  const title = pres.addSlide()
  title.background = { color: '0E203F' }
  title.addText('GNSI', { x: 0.6, y: 1.6, w: 12, h: 0.4, fontSize: 14, color: 'E9D9B0', charSpacing: 8, bold: true })
  title.addText(o.title || 'Class presentation', { x: 0.6, y: 2.1, w: 12, h: 1.2, fontSize: 40, color: 'FFFFFF', fontFace: 'Georgia' })
  if (o.subtitle) title.addText(o.subtitle, { x: 0.6, y: 3.3, w: 12, h: 0.6, fontSize: 18, color: 'C9D5EA' })
  title.addShape(pres.ShapeType.rect, { x: 0, y: 7.3, w: 13.33, h: 0.2, fill: { color: GOLD } })
  const frame = sl => { sl.background = { color: 'FFFFFF' }; sl.addShape(pres.ShapeType.rect, { x: 0, y: 7.3, w: 13.33, h: 0.2, fill: { color: GOLD } }) }
  const opts = (q, reveal) => OPTS.filter(k => q[`option_${k}`]).map(k => {
    const right = reveal && q.correct_option === k.toUpperCase()
    return { text: `(${k.toUpperCase()}) ${q[`option_${k}`]}${right ? '  ✓' : ''}`, options: { color: right ? OK : INK, bold: right, breakLine: true } }
  })
  let n = 0
  for (const it of tray) {
    if (it.kind === 'q') {
      const q = it.row; n++
      for (const reveal of o.revealAnswers ? [false, true] : [false]) {
        const sl = pres.addSlide(); frame(sl)
        sl.addText(`${reveal ? 'Answer' : 'Question'} ${n}${o.showTags ? ` · ${tagOf(q)}` : ''}`, { x: 0.6, y: 0.35, w: 12, h: 0.4, fontSize: 14, color: GOLD, bold: true })
        sl.addText(q.question || '', { x: 0.6, y: 0.8, w: 12, h: q.diagram_url ? 1.6 : 2.2, fontSize: 26, color: NAVY, bold: true, valign: 'top' })
        if (q.diagram_url) { try { sl.addImage({ path: q.diagram_url, x: 8.6, y: 2.5, w: 4, h: 3, sizing: { type: 'contain', w: 4, h: 3 } }) } catch { /* unreachable image — skip */ } }
        sl.addText(opts(q, reveal), { x: 0.8, y: q.diagram_url ? 2.5 : 3.1, w: q.diagram_url ? 7.6 : 11.8, h: 3.6, fontSize: 22, valign: 'top', paraSpaceAfter: 8 })
      }
    } else {
      const m = it.row, sl = pres.addSlide(); frame(sl)
      sl.addText(MATERIAL_TYPES[m.material_type]?.label || 'Material', { x: 0.6, y: 0.35, w: 12, h: 0.4, fontSize: 14, color: GOLD, bold: true })
      sl.addText(m.title || '', { x: 0.6, y: 0.8, w: 12, h: 1, fontSize: 30, color: NAVY, bold: true })
      if (m.description) sl.addText(m.description, { x: 0.6, y: 1.9, w: 12, h: 4.2, fontSize: 20, color: INK, valign: 'top' })
      if (m.file_url) sl.addText(m.file_url, { x: 0.6, y: 6.4, w: 12, h: 0.5, fontSize: 12, color: '1E3A6E', hyperlink: /^https?:/i.test(m.file_url) ? { url: m.file_url } : undefined })
    }
  }
  const blob = await pres.write({ outputType: 'blob' })
  downloadBlob(`${fileBase(o)}.pptx`, blob)
}
