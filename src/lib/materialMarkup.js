// Study-material text: a small, safe markup (headings, lists, tables, callouts, figures, maths) rendered to HTML for the
// portal preview, printing and Word export. Everything is escaped first, so typed text can never inject HTML.
//
//   # Heading   ## Subheading   ### Small heading        **bold**  *italic*  ==highlight==
//   - bullet      1. numbered      > Note: callout (Note / Tip / Formula / Important / Example / Warning)
//   | a | b |  tables (a |---| row under the header row is optional)        ---  divider line
//   [[img:data:image/jpeg;base64,…|optional caption]]  a figure on its own line      \frac{3}{4}  x^2  \sqrt{9}  maths
import { mathToHtml } from './mathText.js'

const FIG_RE = /^\[\[img:(data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+)(?:\|([^\]]*))?\]\]$/
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const figureLine = (dataUrl, caption = '') => `[[img:${dataUrl}${caption ? '|' + caption.replace(/[\]\n|]/g, ' ') : ''}]]`

const CALLOUTS = { teacher: ['Teacher', 'teacher'], note: ['Note', 'info'], tip: ['Tip', 'tip'], formula: ['Formula', 'formula'], important: ['Important', 'warn'], remember: ['Remember', 'warn'], example: ['Example', 'ex'], warning: ['Warning', 'warn'] }

function inline(t) {
  let s = mathToHtml(t)
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>').replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
  return s
}

// opts.teacher === false hides "> Teacher: …" boxes (the student copy).
export function renderMaterial(src, opts = {}) {
  const showTeacher = opts.teacher !== false
  let hc = 0
  const lines = String(src ?? '').replace(/\r/g, '').split('\n')
  let html = '', para = [], list = null, quote = null, table = null, choices = null
  const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = [] } }
  const flushOpts = () => { if (choices) { html += `<div class="opts">${choices.map(([k, t]) => `<div class="op"><span class="ol">${k}</span><span>${inline(t)}</span></div>`).join('')}</div>`; choices = null } }
  const flushList = () => { if (list) { html += `<${list.t}>${list.items.map(x => `<li>${inline(x)}</li>`).join('')}</${list.t}>`; list = null } }
  const flushQuote = () => {
    if (!quote) return
    const first = quote[0] || '', m = first.match(/^(teacher|note|tip|formula|important|remember|example|warning)\s*[:\-–]\s*(.*)$/i)
    const [label, cls] = m ? CALLOUTS[m[1].toLowerCase()] : ['', 'info']
    const rest = m ? [m[2], ...quote.slice(1)] : quote
    if (cls === 'teacher' && !showTeacher) { quote = null; return }
    html += `<div class="box ${cls}">${label ? `<b class="bl">${label}</b> ` : ''}${rest.filter(x => x !== '' || rest.length > 1).map(inline).join('<br>')}</div>`; quote = null
  }
  const flushTable = () => {
    if (!table) return
    const rows = table.filter(r => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r.join('|')) || r.some(c => /[^\s:|-]/.test(c)))
    const head = rows[0], body = rows.slice(1)
    html += `<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${head.map((_, i) => `<td>${inline(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`; table = null
  }
  const flushAll = () => { flushPara(); flushOpts(); flushList(); flushQuote(); flushTable() }
  for (const raw of lines) {
    const ln = raw.trimEnd(), t = ln.trim()
    let m
    if (!t) { flushAll(); continue }
    // Multiple-choice questions typed as plain text: "A) …" lines become an options grid, "Answer: …" a highlighted answer.
    if ((m = t.match(/^\(?([A-Da-d])[.)]\s+(.*)$/))) {
      flushPara(); flushList(); flushQuote(); flushTable()
      if (!choices) { choices = []; if (html.endsWith('</p>')) { const i = html.lastIndexOf('<p>'); if (i >= 0) html = html.slice(0, i) + '<p class="q">' + html.slice(i + 3) } }
      choices.push([m[1].toUpperCase(), m[2]]); continue
    }
    if ((m = t.match(/^(?:answer|ans)\s*[:\-–]\s*(.+)$/i))) { flushPara(); flushOpts(); flushList(); flushQuote(); flushTable(); html += `<div class="ans"><b>Answer</b> ${inline(m[1])}</div>`; continue }
    if (choices) flushOpts()
    if ((m = t.match(FIG_RE))) { flushAll(); html += `<figure><img src="${m[1]}" alt="">${m[2] ? `<figcaption>${escHtml(m[2].trim())}</figcaption>` : ''}</figure>`; continue }
    if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(t)) { flushAll(); html += '<hr>'; continue }
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { flushAll(); html += `<h${m[1].length} id="h${++hc}">${inline(m[2])}</h${m[1].length}>`; continue }
    if (t.startsWith('>')) { flushPara(); flushList(); flushTable(); (quote ||= []).push(t.replace(/^>\s?/, '')); continue }
    if (t.startsWith('|') && t.endsWith('|') && t.length > 2) { flushPara(); flushList(); flushQuote(); (table ||= []).push(t.slice(1, -1).split('|').map(c => c.trim())); continue }
    if ((m = t.match(/^(?:[-*•])\s+(.*)$/))) { flushPara(); flushQuote(); flushTable(); if (list?.t !== 'ul') { flushList(); list = { t: 'ul', items: [] } } list.items.push(m[1]); continue }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); flushQuote(); flushTable(); if (list?.t !== 'ol') { flushList(); list = { t: 'ol', items: [] } } list.items.push(m[1]); continue }
    flushList(); flushQuote(); flushTable(); para.push(t)
  }
  flushAll()
  return html
}

// Headings in order, for a contents list / outline: [{ id, level, text }]
export function outline(src) {
  const out = []; let n = 0
  for (const raw of String(src ?? '').replace(/\r/g, '').split('\n')) {
    const m = raw.trim().match(/^(#{1,3})\s+(.*)$/)
    if (m) out.push({ id: 'h' + ++n, level: m[1].length, text: m[2].replace(/[*=]/g, '').replace(/\\[a-z]+|[{}^]/gi, '').trim() })
  }
  return out
}

export const MATERIAL_CSS = `.md{font-family:Georgia,'Times New Roman',serif;color:#111827;line-height:1.6;font-size:14px}
.md h1{font-size:23px;color:#132a4f;margin:18px 0 8px;border-bottom:2.5px solid #b8923a;padding-bottom:4px;letter-spacing:.01em}.md h2{font-size:18px;color:#132a4f;margin:16px 0 6px}.md h3{font-size:15px;color:#2e3b52;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.04em}
.md p{margin:0 0 9px}.md ul,.md ol{margin:0 0 10px;padding-left:24px}.md li{margin:2px 0}.md hr{border:0;border-top:1px solid #cfd6e4;margin:14px 0}.md mark{background:#fff1b8;padding:0 2px}
.md table{border-collapse:collapse;width:100%;margin:8px 0 12px;font-size:13px;break-inside:avoid}.md th,.md td{border:1px solid #9aa5b8;padding:5px 9px;text-align:left;vertical-align:top}.md th{background:#eef1f6}
.md figure{margin:10px 0;text-align:center;break-inside:avoid}.md figure img{max-width:100%;max-height:320px}.md figcaption{font:italic 12px system-ui,sans-serif;color:#5d6b82;margin-top:3px}
.md .box{margin:8px 0 12px;padding:8px 12px;border-left:4px solid #2563eb;background:#eef4ff;border-radius:4px;break-inside:avoid}.md .box.tip{border-color:#16a34a;background:#eefaf2}.md .box.formula{border-color:#7c3aed;background:#f4f0ff;font-size:15px}
.md .box.teacher{border-color:#be123c;background:#fff1f3}.md .box.warn{border-color:#d97706;background:#fff6e5}
.md p.q{font-weight:600;margin:12px 0 5px;padding-left:10px;border-left:3px solid #b8923a;break-after:avoid}.md .opts{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin:0 0 6px 13px;break-inside:avoid}.md .op{display:flex;gap:8px;align-items:baseline}.md .ol{flex:none;width:1.6em;height:1.6em;line-height:1.6em;border-radius:50%;background:#eef1f6;color:#132a4f;font:700 .78em system-ui,sans-serif;text-align:center}
.md .ans{display:inline-block;margin:2px 0 10px 13px;padding:2px 12px;border-radius:99px;background:#eaf7ef;border:1px solid #b9e2c6;color:#14633f;font-size:.92em}.md .ans b{font:800 .72em system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;margin-right:6px}
@media (max-width:520px){.md .opts{grid-template-columns:1fr}}.md .box.ex{border-color:#0891b2;background:#ebf9fc}.md .bl{font:800 11px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-right:4px}`

export const wordCount = s => (String(s || '').replace(/\[\[img:[^\]]*\]\]/g, ' ').match(/\S+/g) || []).length

// Print layouts that save paper: margins, columns, text size, compact spacing, ink saver, slim header, contents list.
export const PRINT_DEFAULTS = { paper: 'a4', landscape: false, margin: 'normal', columns: 1, size: 13, compact: false, inkSaver: false, header: 'full', toc: false, teacher: true, byline: true }
const MARGINS = { normal: '16mm 14mm 18mm', narrow: '10mm 10mm 12mm', minimal: '6mm 7mm 8mm' }

// Full printable page: institute header, title block with the creator's name and designation, contents list, body, footer.
export function materialDocHtml(m, o = {}, css = '') {
  const opt = { ...PRINT_DEFAULTS, ...o }
  const institute = opt.institute || 'Guidance Navodaya & Sainik Institute'
  const author = opt.author || {}
  const meta = [m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : ''].filter(Boolean).map(escHtml).join(' · ')
  const by = opt.byline && (author.name || m.uploaded_by)
    ? `<div class="by">Prepared by <b>${escHtml(author.name || m.uploaded_by)}</b>${author.designation ? `, ${escHtml(author.designation)}` : ''}${opt.reviewer ? ` · Reviewed by <b>${escHtml(opt.reviewer)}</b>` : ''}</div>` : ''
  const heads = opt.toc ? outline(m.body || '') : []
  const toc = heads.length >= 3 ? `<div class="toc"><b>Contents</b><ol>${heads.filter(h => h.level < 3).map(h => `<li class="l${h.level}"><a href="#${h.id}">${escHtml(h.text)}</a></li>`).join('')}</ol></div>` : ''
  const lh = opt.header === 'none' ? '' : opt.header === 'compact'
    ? `<div class="lh1"><b>${escHtml(institute)}</b> · ${escHtml(opt.tagline || 'Study Material')}</div>`
    : `<div class="lh"><h1>${escHtml(institute)}</h1><div>${escHtml(opt.tagline || 'Mission Sainik 2027 · Study Material')}</div></div>`
  const size = Math.max(8, Math.min(18, Number(opt.size) || 13)), cols = Math.max(1, Math.min(3, Number(opt.columns) || 1))
  const paper = (opt.paper === 'a5' ? 'A5' : 'A4') + (opt.landscape ? ' landscape' : '')
  const compactCss = opt.compact ? '.md{line-height:1.36}.md p{margin:0 0 4px}.md h1{margin:9px 0 3px;font-size:1.35em;padding-bottom:2px}.md h2{margin:8px 0 3px;font-size:1.15em}.md h3{margin:6px 0 2px}.md ul,.md ol{margin:0 0 5px;padding-left:19px}.md li{margin:0}.md table{margin:4px 0 7px}.md th,.md td{padding:2px 6px}.md .box{margin:4px 0 7px;padding:4px 9px}.md figure{margin:5px 0}.md figure img{max-height:230px}.md hr{margin:7px 0}' : ''
  const inkCss = opt.inkSaver ? '.md .box,.md .box.tip,.md .box.formula,.md .box.warn,.md .box.ex,.md .box.teacher{background:none!important;border:1px solid #777!important;border-left:3px solid #333!important}.md th{background:none!important;font-weight:800}.md mark{background:none;text-decoration:underline}.md h1{border-bottom:1px solid #444;color:#000}.md h2,.md h3{color:#000}.lh{border-bottom:1px solid #444}.lh h1{color:#000}.md figure img{filter:grayscale(1) contrast(1.1)}' : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(m.title)}</title><style>@page{size:${paper};margin:${MARGINS[opt.margin] || MARGINS.normal};@bottom-center{content:"${String(institute).replace(/["\\]/g, '')} · Page " counter(page) " of " counter(pages);font:8pt system-ui,sans-serif;color:#666}}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0}
.lh{text-align:center;border-bottom:1px solid #b8923a;padding-bottom:6px;margin-bottom:9px;font-family:Georgia,serif}.lh:before{content:"";display:block;height:4px;background:linear-gradient(90deg,#b8923a,#f0e1b8,#b8923a);margin-bottom:7px}.lh h1{margin:0;font-size:17px;color:#132a4f;letter-spacing:.12em;text-transform:uppercase}.lh div{font-size:10px;color:#b8923a;font-weight:700;letter-spacing:.2em;text-transform:uppercase;margin-top:2px}.lh1{font:11px system-ui,sans-serif;color:#444;border-bottom:1px solid #999;padding-bottom:2px;margin-bottom:6px}
.ti{font:700 ${opt.compact ? 17 : 19}px Georgia,serif;margin:0 0 1px}.me{font:11.5px system-ui,sans-serif;color:#5d6b82;margin-bottom:2px}.by{font:12px system-ui,sans-serif;color:#2e3b52;margin-bottom:${opt.compact ? 5 : 9}px}
.md{font-size:${size}px}.cols{column-count:${cols};column-gap:7mm;${cols > 1 ? 'column-rule:.5pt solid #ccc;' : ''}}.cols h1,.cols h2,.cols h3{break-after:avoid}
.toc{font:12px system-ui,sans-serif;border:1px solid #cfd6e4;border-radius:6px;padding:6px 12px;margin:0 0 8px;break-inside:avoid}.toc ol{margin:3px 0 0;padding-left:20px;columns:${cols > 1 ? 1 : 2}}.toc li.l2{margin-left:12px;color:#555}.toc a{color:inherit;text-decoration:none}
body{padding-bottom:6mm}${compactCss}${inkCss}${css}</style></head><body>${lh}
<div class="ti">${escHtml(m.title)}</div><div class="me">${meta}</div>${by}${toc}
<div class="md${cols > 1 ? ' cols' : ''}">${renderMaterial(m.body || '', { teacher: opt.teacher })}</div>${opt.auto ? '<script>window.onload=()=>window.print()</script>' : ''}</body></html>`
}

// Preview helpers for links and files.
export function embedFor(url) {
  const u = String(url || '')
  let m
  if ((m = u.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{11})/))) return { kind: 'video', src: `https://www.youtube.com/embed/${m[1]}` }
  if ((m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return { kind: 'drive', src: `https://drive.google.com/file/d/${m[1]}/preview` }
  if ((m = u.match(/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([\w-]+)/))) return { kind: 'drive', src: `https://docs.google.com/${m[1]}/d/${m[2]}/preview` }
  return null
}
export function kindOf(m) {
  if (m.link_url) return 'link'
  const n = String(m.file_name || m.file_path || '').toLowerCase()
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return 'image'
  if (/\.pdf$/.test(n)) return 'pdf'
  if (/\.(docx?|pptx?|xlsx?|odt|ods|odp|rtf)$/.test(n)) return 'office'
  if (m.file_path) return 'file'
  return 'text'
}
