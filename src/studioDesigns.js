// studioDesigns.js — GNSI Portal · Material Studio output designs
//
// Turns a tray of Question Bank questions and study materials into a
// finished teaching document:
//   worksheet · differentiated worksheets · test paper (versions A–D) ·
//   revision notes · flashcards (print / PDF / Word) and PowerPoint slides.
// Options cover four visual themes, institute branding (logo, watermark),
// English / Meitei Mayek / bilingual text, A4 / A5 / two-up paper, marks by
// difficulty, OMR answer sheets, a teacher blueprint page and homework mode.
// Every value is HTML-escaped: the print window shares the portal's origin.

import QRCode from 'qrcode'
import { BMEI04_BASE64 } from './bmei04_font_base64'

export const DESIGNS = [
  { id: 'worksheet', label: 'Worksheet', icon: '📝', desc: 'Practice or homework sheet with answer space and an answer key' },
  { id: 'levels', label: 'Differentiated sheets', icon: '🪜', desc: 'Foundation · Standard · Challenge sheets split by difficulty' },
  { id: 'test', label: 'Test paper', icon: '🧾', desc: 'Sections, marks, time, versions A–D, OMR sheet and keys' },
  { id: 'slides', label: 'Slides', icon: '🎞️', desc: 'PowerPoint — one question per slide with answer reveal' },
  { id: 'notes', label: 'Revision notes', icon: '📚', desc: 'Chapter handout from materials, with QR links and key questions' },
  { id: 'flashcards', label: 'Flashcards', icon: '🃏', desc: 'Cut-out cards — question on the front, answer on the back' },
]

export const THEMES = [
  { id: 'classic', label: 'Classic', hint: 'Navy & gold' },
  { id: 'photocopy', label: 'Photocopy', hint: 'Pure black & white' },
  { id: 'exam', label: 'Exam board', hint: 'Formal serif' },
  { id: 'kids', label: 'Kids', hint: 'Bright & rounded' },
]

export const INSTRUCTION_PRESETS = [
  'Answer all questions. Each question has only one correct answer.',
  'Write the letter of the correct option in the box.',
  'Show your working in the space provided.',
  'Calculators are not allowed.',
  'Complete at home and bring it to the next class.',
  'Read each question carefully before answering.',
]

export const MATERIAL_TYPES = {
  notes: { label: 'Notes', icon: '📄' }, formula: { label: 'Formula sheet', icon: '🔣' }, practice: { label: 'Practice set', icon: '✏️' },
  solved: { label: 'Solved paper', icon: '✅' }, mindmap: { label: 'Mind map', icon: '🗂️' }, video: { label: 'Video', icon: '🎥' },
  currentaffairs: { label: 'Current affairs', icon: '📰' },
}

export const DEFAULT_OPTIONS = {
  title: '', subtitle: '', teacher: '', date: new Date().toISOString().slice(0, 10), instructions: '',
  columns: 1, answerSpace: 'none', showTags: false, fontSize: 'M', answerKey: true,
  marksMode: 'flat', marksEach: 1, weights: { Easy: 1, Medium: 2, Hard: 3 }, negative: 0,
  duration: 30, versions: 1, shuffle: false, shuffleOptions: false, sectionBy: 'subject', revealAnswers: true,
  theme: 'classic', paper: 'A4', twoUp: false, lang: 'en', omr: false, blueprint: false,
  homework: false, dueDate: '',
  brandName: 'GNSI', tagline: 'Guidance Navodaya & Sainik Institute · Khangabok', logo: '', watermark: '',
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
const OPTS = ['a', 'b', 'c', 'd']
const FONT = { S: 11.5, M: 13, L: 15 }
const safeImg = s => (/^(https?:|data:image\/)/i.test(String(s || '')) ? esc(s) : '')

export const questionsOf = tray => tray.filter(i => i.kind === 'q').map(i => i.row)
export const materialsOf = tray => tray.filter(i => i.kind === 'm').map(i => i.row)
export const marksFor = (q, o) => (o.marksMode === 'difficulty' ? Number(o.weights?.[q.difficulty || 'Medium']) || 1 : Number(o.marksEach) || 1)

// ── Randomness (seeded, so a version prints the same every time) ─────────────
export function seeded(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6 }
}
function shuffle(arr, rand) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Reorder a question's options and move the answer letter with them.
export function permuteOptions(q, rand) {
  const keys = OPTS.filter(k => q[`option_${k}`])
  const order = shuffle(keys.map((_, i) => i), rand)
  const out = { ...q }
  keys.forEach((k, i) => {
    const src = keys[order[i]]
    out[`option_${k}`] = q[`option_${src}`]
    out[`option_${k}_mayek`] = q[`option_${src}_mayek`] || ''
  })
  const ci = keys.indexOf(String(q.correct_option || '').toLowerCase())
  if (ci >= 0) out.correct_option = keys[order.indexOf(ci)].toUpperCase()
  return out
}

// ── Language: English / Meitei Mayek / both ──────────────────────────────────
const mmClass = q => (q.question_mayek_font === 'bmei04' ? 'mm mm-b' : 'mm mm-u')
const hasMayek = q => !!(q.question_mayek || OPTS.some(k => q[`option_${k}_mayek`]))
function qText(q, o) {
  const en = esc(q.question)
  if (o.lang === 'en' || !q.question_mayek) return en
  const mm = `<span class="${mmClass(q)}">${esc(q.question_mayek)}</span>`
  return o.lang === 'mm' ? mm : `${en}<div>${mm}</div>`
}
function optText(q, k, o) {
  const en = esc(q[`option_${k}`]), m = q[`option_${k}_mayek`]
  if (o.lang === 'en' || !m) return en
  const mm = `<span class="${mmClass(q)}">${esc(m)}</span>`
  return o.lang === 'mm' ? mm : `${en} / ${mm}`
}

// ── Themes & page chrome ─────────────────────────────────────────────────────
const THEME = {
  classic: { ink: '#0f1b2e', primary: '#132a4f', accent: '#b8923a', soft: '#faf8f3', tag: '#f6efdc', tagInk: '#8a6118', body: "'Segoe UI', Arial, sans-serif", head: 'Georgia, serif', secBg: '#132a4f', secInk: '#fff', secBorder: 'none', radius: 8, ok: '#0f7a4c' },
  photocopy: { ink: '#000', primary: '#000', accent: '#000', soft: '#fff', tag: '#fff', tagInk: '#000', body: 'Arial, sans-serif', head: 'Arial, sans-serif', secBg: '#fff', secInk: '#000', secBorder: '1.5px solid #000', radius: 0, ok: '#000' },
  exam: { ink: '#111', primary: '#111', accent: '#666', soft: '#f5f5f5', tag: '#eee', tagInk: '#333', body: "'Times New Roman', Times, serif", head: "'Times New Roman', Times, serif", secBg: '#e9e9e9', secInk: '#000', secBorder: '1px solid #999', radius: 0, ok: '#1a5c1a' },
  kids: { ink: '#1f2937', primary: '#0f766e', accent: '#f59e0b', soft: '#fff7ed', tag: '#fef3c7', tagInk: '#92400e', body: "'Trebuchet MS', 'Comic Sans MS', sans-serif", head: "'Trebuchet MS', 'Comic Sans MS', sans-serif", secBg: '#0f766e', secInk: '#fff', secBorder: 'none', radius: 14, ok: '#15803d' },
}

function css(o, { mayek = false } = {}) {
  const t = THEME[o.theme] || THEME.classic
  const size = (FONT[o.fontSize] || 13) + (o.theme === 'kids' ? 1 : 0) - (o.twoUp ? 2 : 0)
  const pageSize = o.twoUp ? 'A4 landscape' : o.paper === 'A5' ? 'A5' : 'A4'
  return `
  ${mayek ? `@font-face { font-family:'BMEI04'; src:url(data:font/ttf;base64,${BMEI04_BASE64}) format('truetype') }` : ''}
  @page { size: ${pageSize}; margin: ${o.paper === 'A5' || o.twoUp ? 9 : 13}mm }
  * { box-sizing: border-box }
  body { font-family: ${t.body}; color: ${t.ink}; margin: 0; font-size: ${size}px; line-height: 1.45 }
  .page { page-break-after: always; position: relative } .page:last-child { page-break-after: auto }
  .sheet2 { display:grid; grid-template-columns:1fr 1fr; gap:10mm } .sheet2 .half { min-width:0 } .sheet2 .half + .half { border-left:1px dashed #9aa3b2; padding-left:5mm }
  .mm { font-size: 1.08em } .mm-b { font-family: 'BMEI04', sans-serif } .mm-u { font-family: 'Noto Sans Meetei Mayek', sans-serif }
  .wm { position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-28deg); font-size: 72px; font-weight: 800; color: ${t.primary}; opacity: .06; letter-spacing: .12em; pointer-events: none; z-index: 0 }
  .head { display:flex; justify-content:space-between; align-items:flex-end; gap:10px; border-bottom:3px solid ${t.primary}; padding-bottom:8px; margin-bottom:4px }
  .head .brand { font-family:${t.head}; font-weight:700; font-size:1.5em; color:${t.primary}; letter-spacing:.04em; line-height:1.1 }
  .head .inst { font-size:.8em; color:#5d6b82 } .head img { height:42px; width:auto; margin-right:10px }
  .rule { height:2px; background:${t.accent}; margin-bottom:12px }
  h1 { font-family:${t.head}; font-size:1.55em; margin:6px 0 2px; color:${t.ink} }
  .sub { color:#5d6b82; font-size:.92em }
  .badge { display:inline-block; font-size:.72em; font-weight:800; letter-spacing:.1em; text-transform:uppercase; padding:3px 10px; border-radius:99px; background:${t.tag}; color:${t.tagInk}; border:${o.theme === 'photocopy' ? '1px solid #000' : 'none'}; margin-right:6px }
  .meta { display:flex; gap:14px; flex-wrap:wrap; font-size:.9em; margin:10px 0; padding:8px 12px; border:1px solid #d9d2c2; border-radius:${t.radius}px; background:${t.soft} }
  .fill { display:flex; gap:18px; margin:8px 0 12px; font-size:.92em } .fill span { flex:1; border-bottom:1px solid #9aa3b2; padding-bottom:2px }
  .instr { background:${t.soft}; border:1px solid #d9d2c2; border-radius:${t.radius}px; padding:8px 12px; font-size:.9em; margin-bottom:12px; white-space:pre-wrap }
  .sec { background:${t.secBg}; color:${t.secInk}; border:${t.secBorder}; border-radius:${Math.min(t.radius, 8)}px; padding:5px 10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; font-size:.85em; margin:14px 0 8px; break-after:avoid; column-span:all }
  .q { break-inside:avoid; margin-bottom:12px }
  .q .n { font-weight:700; color:${t.primary}; margin-right:4px }
  .q .opts { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; margin:4px 0 0 20px }
  .q .tag { display:inline-block; font-size:.72em; color:${t.tagInk}; background:${t.tag}; border-radius:99px; padding:1px 7px; margin-left:6px; vertical-align:middle }
  .q img { max-width:100%; max-height:170px; margin:5px 0 0 20px; display:block }
  .marks { float:right; font-size:.8em; color:#5d6b82 }
  .lines div { border-bottom:1px dotted #9aa3b2; height:22px; margin-left:20px }
  .box { border:1px solid #9aa3b2; border-radius:6px; height:70px; margin:6px 0 0 20px }
  .cols2 { columns:2; column-gap:9mm; column-rule:1px solid #e8e3d8 }
  table.grid { width:100%; border-collapse:collapse } table.grid td, table.grid th { border:1px solid #c9c2b1; text-align:center; padding:5px; font-size:.9em }
  table.grid th { background:${t.soft} } table.grid td b { display:block; font-size:1.1em }
  .bub { display:inline-flex; width:15px; height:15px; border:1.3px solid ${t.primary}; border-radius:50%; align-items:center; justify-content:center; font-size:8.5px; margin:0 2px }
  .sign { display:flex; justify-content:space-between; margin-top:22px; font-size:.85em }
  .foot { margin-top:14px; font-size:.75em; color:#8a93a6; text-align:center }
`
}

const header = (o, right = '') => `
  <div class="head"><div style="display:flex;align-items:center">${safeImg(o.logo) ? `<img src="${safeImg(o.logo)}" alt="">` : ''}
    <div><div class="brand">${esc(o.brandName || 'GNSI')}</div>${o.tagline ? `<div class="inst">${esc(o.tagline)}</div>` : ''}</div></div>
  <div style="text-align:right;font-size:.85em;color:#5d6b82">${right}</div></div><div class="rule"></div>`

const optionsHtml = (q, o, withAnswer) => `<div class="opts">${OPTS.filter(k => q[`option_${k}`]).map(k => {
  const L = k.toUpperCase(), right = withAnswer && q.correct_option === L
  return `<div${right ? ` style="font-weight:700;color:${(THEME[o.theme] || THEME.classic).ok}"` : ''}>(${L}) ${optText(q, k, o)}${right ? ' ✓' : ''}</div>`
}).join('')}</div>`

const answerSpace = o => (o.answerSpace === 'lines' ? '<div class="lines"><div></div><div></div></div>' : o.answerSpace === 'box' ? '<div class="box"></div>' : '')
const tagOf = q => [q.subject, q.chapter].filter(Boolean).join(' · ')

function questionHtml(q, n, o, { withAnswer = false, marks = null } = {}) {
  return `<div class="q">${marks != null ? `<span class="marks">[${esc(marks)}]</span>` : ''}
    <span class="n">${n}.</span>${qText(q, o)}${o.showTags ? `<span class="tag">${esc(tagOf(q))}</span>` : ''}
    ${safeImg(q.diagram_url) ? `<img src="${safeImg(q.diagram_url)}" alt="">` : ''}
    ${optionsHtml(q, o, withAnswer)}${withAnswer ? '' : answerSpace(o)}</div>`
}

function keyTable(qs, label) {
  const cells = qs.map((q, i) => `<td><span style="color:#8a93a6;font-size:.8em">${i + 1}</span><b>${esc(q.correct_option || '—')}</b></td>`)
  const rows = []
  for (let i = 0; i < cells.length; i += 10) rows.push(`<tr>${cells.slice(i, i + 10).join('')}</tr>`)
  return `<h1 style="font-size:1.2em">${esc(label)}</h1><table class="grid">${rows.join('')}</table>`
}

function sections(qs, by) {
  if (by === 'none') return [{ name: '', items: qs }]
  const m = new Map()
  for (const q of qs) { const k = (by === 'chapter' ? q.chapter : q.subject) || 'General'; if (!m.has(k)) m.set(k, []); m.get(k).push(q) }
  return [...m].map(([name, items]) => ({ name, items }))
}

const titleBlock = (o, fallback, extraBadge = '') => `
  <div>${o.homework ? `<span class="badge">Homework${o.dueDate ? ` · due ${esc(fmtDate(o.dueDate))}` : ''}</span>` : ''}${extraBadge}</div>
  <h1>${esc(o.title || fallback)}</h1>${o.subtitle ? `<div class="sub">${esc(o.subtitle)}</div>` : ''}`
const signBlock = o => (o.homework ? `<div class="sign"><span>Parent's signature: ____________________</span><span>Teacher: ${esc(o.teacher || '________________')}</span></div>` : o.teacher ? `<div class="foot">Prepared by ${esc(o.teacher)}</div>` : '')

// ── Teacher blueprint: chapter × difficulty ──────────────────────────────────
function blueprint(qs, o, label = 'Blueprint') {
  const rows = new Map()
  for (const q of qs) {
    const k = tagOf(q) || 'Other'
    if (!rows.has(k)) rows.set(k, { Easy: 0, Medium: 0, Hard: 0, marks: 0 })
    const r = rows.get(k); r[q.difficulty in r ? q.difficulty : 'Medium']++; r.marks += marksFor(q, o)
  }
  const tot = { Easy: 0, Medium: 0, Hard: 0, marks: 0 }
  const tr = [...rows].map(([k, r]) => { for (const c in tot) tot[c] += r[c]; return `<tr><td style="text-align:left">${esc(k)}</td><td>${r.Easy}</td><td>${r.Medium}</td><td>${r.Hard}</td><td>${r.Easy + r.Medium + r.Hard}</td><td>${r.marks}</td></tr>` }).join('')
  return `<h1 style="font-size:1.2em">${esc(label)}</h1><table class="grid"><tr><th style="text-align:left">Chapter</th><th>Easy</th><th>Medium</th><th>Hard</th><th>Questions</th><th>Marks</th></tr>${tr}
    <tr><th style="text-align:left">Total</th><th>${tot.Easy}</th><th>${tot.Medium}</th><th>${tot.Hard}</th><th>${tot.Easy + tot.Medium + tot.Hard}</th><th>${tot.marks}</th></tr></table>`
}

// ── OMR bubble sheet ─────────────────────────────────────────────────────────
function omrSheet(n, o, code) {
  const perCol = 25, cols = []
  for (let s = 0; s < n; s += perCol) {
    const items = []
    for (let i = s; i < Math.min(n, s + perCol); i++) items.push(`<div style="display:flex;align-items:center;height:21px"><span style="width:26px;text-align:right;margin-right:6px;font-weight:700;font-size:10px">${i + 1}</span>${['A', 'B', 'C', 'D'].map(l => `<span class="bub">${l}</span>`).join('')}</div>`)
    cols.push(`<div style="border:1px solid #d9d2c2;border-radius:6px;padding:6px 8px">${items.join('')}</div>`)
  }
  return `${header(o, code ? `SET ${code}` : '')}<h1 style="font-size:1.25em">OMR answer sheet${code ? ` · Set ${code}` : ''}</h1>
    <div class="fill"><span>Name:</span><span>Roll no.:</span><span>Set: ${esc(code || '')}</span></div>
    <div class="sub" style="margin-bottom:8px">Darken ONE circle per question completely with a blue/black pen.</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${cols.join('')}</div>`
}

// ── Worksheet ────────────────────────────────────────────────────────────────
function worksheetPages(qs, o, { badge = '', keyLabel = 'Answer key' } = {}) {
  let n = 0
  const body = sections(qs, o.sectionBy).map(s => `${s.name ? `<div class="sec">${esc(s.name)}</div>` : ''}${s.items.map(q => questionHtml(q, ++n, o, { marks: o.marksMode === 'difficulty' ? marksFor(q, o) : null })).join('')}`).join('')
  const pages = [`${header(o, esc(fmtDate(o.date)))}${titleBlock(o, 'Worksheet', badge)}
    <div class="fill"><span>Name:</span><span>Class / Roll:</span><span>Date:</span></div>
    ${o.instructions ? `<div class="instr">${esc(o.instructions)}</div>` : ''}
    <div class="${o.columns === 2 ? 'cols2' : ''}">${body || '<p class="sub">No questions in the tray.</p>'}</div>${signBlock(o)}`]
  if (o.answerKey && qs.length) pages.push(`${header(o, 'Teacher copy')}${keyTable(qs, keyLabel)}`)
  return pages
}
const worksheet = (tray, o) => {
  const qs = questionsOf(tray)
  const pages = worksheetPages(qs, o)
  if (o.blueprint && qs.length) pages.push(`${header(o, 'Teacher copy')}${blueprint(qs, o)}`)
  return pages
}

// ── Differentiated worksheets ────────────────────────────────────────────────
const LEVELS = [['Easy', 'Foundation'], ['Medium', 'Standard'], ['Hard', 'Challenge']]
function levels(tray, o) {
  const qs = questionsOf(tray)
  const pages = [], keys = []
  for (const [d, name] of LEVELS) {
    const part = qs.filter(q => (q.difficulty || 'Medium') === d)
    if (!part.length) continue
    pages.push(worksheetPages(part, { ...o, answerKey: false }, { badge: `<span class="badge">${name} level</span>` })[0])
    keys.push(keyTable(part, `${name} level — answer key`))
  }
  if (!pages.length) pages.push(`${header(o)}<p class="sub">No questions in the tray.</p>`)
  if (o.answerKey && keys.length) pages.push(`${header(o, 'Teacher copy')}${keys.join('<div style="height:14px"></div>')}`)
  return pages
}

// ── Test paper (versions A–D) ────────────────────────────────────────────────
export function testVersions(tray, o) {
  const base = questionsOf(tray)
  const n = Math.max(1, Math.min(4, Number(o.versions) || 1))
  return 'ABCD'.slice(0, n).split('').map((code, v) => {
    const rand = seeded(`${o.title}|${base.map(q => q.id).join(',')}|${code}`)
    const secs = sections(base, o.sectionBy).map(s => {
      let items = v === 0 && !o.shuffle ? s.items : shuffle(s.items, rand)
      if (o.shuffleOptions && (v > 0 || o.shuffle)) items = items.map(q => permuteOptions(q, rand))
      return { ...s, items }
    })
    return { code, secs, flat: secs.flatMap(s => s.items) }
  })
}
function testPaper(tray, o) {
  const versions = testVersions(tray, o)
  const multi = versions.length > 1
  const pages = []
  for (const { code, secs, flat } of versions) {
    const max = flat.reduce((t, q) => t + marksFor(q, o), 0)
    let n = 0
    const body = secs.map(s => `${s.name ? `<div class="sec">${esc(s.name)} · ${s.items.reduce((t, q) => t + marksFor(q, o), 0)} marks</div>` : ''}${s.items.map(q => questionHtml(q, ++n, o, { marks: marksFor(q, o) })).join('')}`).join('')
    const rules = [o.instructions || 'Answer all questions. Each question has one correct answer.']
    if (Number(o.negative) > 0) rules.push(`${o.negative} mark(s) will be deducted for each wrong answer.`)
    pages.push(`${header(o, multi ? `<b style="font-size:1.6em;border:2px solid currentColor;padding:2px 12px">SET ${code}</b>` : '')}
      ${titleBlock(o, 'Class Test')}
      <div class="meta"><span><b>Date:</b> ${esc(fmtDate(o.date))}</span><span><b>Time:</b> ${esc(o.duration)} min</span><span><b>Questions:</b> ${flat.length}</span><span><b>Max. marks:</b> ${max}</span>${o.teacher ? `<span><b>Teacher:</b> ${esc(o.teacher)}</span>` : ''}</div>
      <div class="fill"><span>Name:</span><span>Roll no.:</span><span>Marks obtained: ____ / ${max}</span></div>
      <div class="instr">${rules.map(esc).join('\n')}</div>
      <div class="${o.columns === 2 ? 'cols2' : ''}">${body || '<p class="sub">No questions in the tray.</p>'}</div>`)
    if (o.omr && flat.length) pages.push(omrSheet(flat.length, o, multi ? code : ''))
  }
  const all = versions[0]?.flat || []
  if (o.answerKey && all.length) pages.push(`${header(o, 'Teacher copy — confidential')}${versions.map(v => keyTable(v.flat, multi ? `Answer key · Set ${v.code}` : 'Answer key')).join('<div style="height:16px"></div>')}`)
  if (o.blueprint && all.length) pages.push(`${header(o, 'Teacher copy')}${blueprint(all, o)}`)
  return pages
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
        ${m.file_url ? `<div style="margin-top:4px;font-size:.8em;word-break:break-all">${esc(m.file_url)}</div>` : ''}</div>
      ${code ? `<div style="text-align:center"><img src="${code}" style="width:84px;height:84px"><div style="font-size:.65em;color:#8a93a6">scan to open</div></div>` : ''}
    </div>`).join('')}`).join('')
  const practice = qs.length ? `<div class="sec">Key questions</div>${qs.map((q, i) => questionHtml(q, i + 1, { ...o, answerSpace: 'none' }, { withAnswer: o.revealAnswers })).join('')}` : ''
  return [`${header(o, esc(fmtDate(o.date)))}${titleBlock(o, 'Revision Notes')}
    ${o.instructions ? `<div class="instr">${esc(o.instructions)}</div>` : ''}
    ${matHtml || (practice ? '' : '<p class="sub">Add study materials or questions to the tray.</p>')}${practice}${signBlock(o)}`]
}

// ── Flashcards (8 per page: fronts, then backs mirrored for duplex) ──────────
function flashcards(tray, o) {
  const cards = [
    ...questionsOf(tray).map(q => ({
      front: `${qText(q, o)}${safeImg(q.diagram_url) ? `<img src="${safeImg(q.diagram_url)}" style="max-height:70px;display:block;margin:6px auto 0">` : ''}<div style="font-size:.8em;margin-top:8px;text-align:left">${OPTS.filter(k => q[`option_${k}`]).map(k => `(${k.toUpperCase()}) ${optText(q, k, o)}`).join('<br>')}</div>`,
      back: `<div style="font-size:2.2em;font-weight:800">${esc(q.correct_option || '?')}</div><div>${q.correct_option ? optText(q, String(q.correct_option).toLowerCase(), o) : ''}</div>`,
      tag: tagOf(q),
    })),
    ...materialsOf(tray).map(m => ({ front: `<b>${esc(m.title)}</b>`, back: esc(m.description || m.file_url || ''), tag: [m.subject, m.chapter].filter(Boolean).join(' · ') })),
  ]
  if (!cards.length) return [`${header(o)}<p class="sub">Add questions or materials to the tray.</p>`]
  const t = THEME[o.theme] || THEME.classic
  const card = (html, tag, back) => `<div style="border:1.5px dashed #9aa3b2;border-radius:10px;padding:12px;height:62mm;display:flex;flex-direction:column;justify-content:center;text-align:center;overflow:hidden;position:relative;background:${back ? t.tag : '#fff'}">
    <div style="position:absolute;top:6px;left:10px;font-size:.62em;color:${t.tagInk};letter-spacing:.08em;text-transform:uppercase">${back ? 'Answer' : esc(o.title || o.brandName || 'GNSI')}</div>
    ${html}<div style="position:absolute;bottom:6px;right:10px;font-size:.62em;color:#8a93a6">${esc(tag || '')}</div></div>`
  const pages = []
  for (let i = 0; i < cards.length; i += 8) {
    const chunk = cards.slice(i, i + 8)
    pages.push(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm">${chunk.map(c => card(c.front, c.tag)).join('')}</div>`)
    const backs = []
    for (let r = 0; r < chunk.length; r += 2) { backs.push(chunk[r + 1] ? card(chunk[r + 1].back, '', true) : '<div></div>'); backs.push(card(chunk[r].back, '', true)) }
    pages.push(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm">${backs.join('')}</div>`)
  }
  return pages
}

// ── Slide preview (HTML) ─────────────────────────────────────────────────────
function slidesPreview(tray, o) {
  const s = (inner, dark) => `<div style="aspect-ratio:16/9;border-radius:10px;margin:0 0 12px;padding:22px 28px;display:flex;flex-direction:column;justify-content:center;background:${dark ? 'linear-gradient(135deg,#0e203f,#132a4f)' : '#fff'};color:${dark ? '#fff' : '#0f1b2e'};border:1px solid #e8e3d8;border-bottom:4px solid #b8923a">${inner}</div>`
  const out = [s(`<div style="color:#e9d9b0;letter-spacing:.2em;font-size:.75em">${esc(o.brandName || 'GNSI')}</div><div style="font-family:Georgia,serif;font-size:2em;margin-top:6px">${esc(o.title || 'Class presentation')}</div><div style="opacity:.7">${esc(o.subtitle || '')}</div>`, true)]
  let n = 0
  for (const it of tray) {
    if (it.kind === 'q') {
      const q = it.row; n++
      out.push(s(`<div style="color:#8a6118;font-size:.75em">Question ${n}${o.showTags ? ` · ${esc(tagOf(q))}` : ''}</div><div style="font-size:1.25em;font-weight:600;margin:6px 0 10px">${qText(q, o)}</div>${optionsHtml(q, o, false)}`))
      if (o.revealAnswers) out.push(s(`<div style="color:#8a6118;font-size:.75em">Answer ${n}</div><div style="font-size:1.1em;margin:6px 0 10px">${qText(q, o)}</div>${optionsHtml(q, o, true)}`))
    } else {
      const m = it.row
      out.push(s(`<div style="color:#8a6118;font-size:.75em">${esc(MATERIAL_TYPES[m.material_type]?.label || 'Material')}</div><div style="font-size:1.4em;font-weight:700;margin:6px 0">${esc(m.title)}</div><div style="white-space:pre-wrap">${esc(m.description || '')}</div>${m.file_url ? `<div style="font-size:.8em;color:#1e3a6e;margin-top:8px;word-break:break-all">${esc(m.file_url)}</div>` : ''}`))
    }
  }
  return `<div style="max-width:720px;margin:0 auto;padding:12px">${out.join('')}</div>`
}

// ── Public API ───────────────────────────────────────────────────────────────
function assemble(pages, o, design) {
  const twoUp = o.twoUp && !['flashcards', 'slides'].includes(design)
  const wm = o.watermark ? `<div class="wm">${esc(o.watermark)}</div>` : ''
  return wm + pages.map(p => (twoUp ? `<div class="page sheet2"><div class="half">${p}</div><div class="half">${p}</div></div>` : `<div class="page">${p}</div>`)).join('')
}

export async function buildHtml(design, tray, opts, { autoPrint = false } = {}) {
  const o = { ...DEFAULT_OPTIONS, ...opts }
  if (design === 'flashcards' || design === 'slides') o.twoUp = false
  const mayek = o.lang !== 'en' && questionsOf(tray).some(hasMayek)
  const body = design === 'slides' ? slidesPreview(tray, o) : assemble(
    design === 'worksheet' ? worksheet(tray, o) : design === 'levels' ? levels(tray, o) : design === 'test' ? testPaper(tray, o)
      : design === 'notes' ? await notes(tray, o) : flashcards(tray, o), o, design)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.title || 'GNSI material')}</title>
    ${mayek ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Meetei+Mayek&display=swap">' : ''}
    <style>${css(o, { mayek })}</style></head><body${design === 'slides' ? ' style="background:#f3f0e8"' : ''}>${body}
    ${autoPrint ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})</script>" : ''}</body></html>`
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

export async function downloadPptx(tray, opts) {
  const o = { ...DEFAULT_OPTIONS, ...opts }
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'
  const NAVY = '132A4F', GOLD = 'B8923A', INK = '0F1B2E', OK = '0F7A4C'
  const title = pres.addSlide()
  title.background = { color: '0E203F' }
  title.addText(o.brandName || 'GNSI', { x: 0.6, y: 1.6, w: 12, h: 0.4, fontSize: 14, color: 'E9D9B0', charSpacing: 8, bold: true })
  title.addText(o.title || 'Class presentation', { x: 0.6, y: 2.1, w: 12, h: 1.2, fontSize: 40, color: 'FFFFFF', fontFace: 'Georgia' })
  if (o.subtitle) title.addText(o.subtitle, { x: 0.6, y: 3.3, w: 12, h: 0.6, fontSize: 18, color: 'C9D5EA' })
  if (safeImg(o.logo)) { try { title.addImage({ data: o.logo, x: 11.2, y: 0.5, w: 1.4, h: 1.4, sizing: { type: 'contain', w: 1.4, h: 1.4 } }) } catch { /* bad logo */ } }
  title.addShape(pres.ShapeType.rect, { x: 0, y: 7.3, w: 13.33, h: 0.2, fill: { color: GOLD } })
  const frame = sl => { sl.background = { color: 'FFFFFF' }; sl.addShape(pres.ShapeType.rect, { x: 0, y: 7.3, w: 13.33, h: 0.2, fill: { color: GOLD } }) }
  const opts2 = (q, reveal) => OPTS.filter(k => q[`option_${k}`]).map(k => {
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
        if (safeImg(q.diagram_url)) { try { sl.addImage({ path: q.diagram_url, x: 8.6, y: 2.5, w: 4, h: 3, sizing: { type: 'contain', w: 4, h: 3 } }) } catch { /* unreachable image — skip */ } }
        sl.addText(opts2(q, reveal), { x: 0.8, y: q.diagram_url ? 2.5 : 3.1, w: q.diagram_url ? 7.6 : 11.8, h: 3.6, fontSize: 22, valign: 'top', paraSpaceAfter: 8 })
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

// Used by the presenter to decide whether to offer the Meitei Mayek toggle.
export { hasMayek }
