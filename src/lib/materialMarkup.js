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

const CALLOUTS = { note: ['Note', 'info'], tip: ['Tip', 'tip'], formula: ['Formula', 'formula'], important: ['Important', 'warn'], remember: ['Remember', 'warn'], example: ['Example', 'ex'], warning: ['Warning', 'warn'] }

function inline(t) {
  let s = mathToHtml(t)
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>').replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
  return s
}

export function renderMaterial(src) {
  const lines = String(src ?? '').replace(/\r/g, '').split('\n')
  let html = '', para = [], list = null, quote = null, table = null
  const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = [] } }
  const flushList = () => { if (list) { html += `<${list.t}>${list.items.map(x => `<li>${inline(x)}</li>`).join('')}</${list.t}>`; list = null } }
  const flushQuote = () => {
    if (!quote) return
    const first = quote[0] || '', m = first.match(/^(note|tip|formula|important|remember|example|warning)\s*[:\-–]\s*(.*)$/i)
    const [label, cls] = m ? CALLOUTS[m[1].toLowerCase()] : ['', 'info']
    const rest = m ? [m[2], ...quote.slice(1)] : quote
    html += `<div class="box ${cls}">${label ? `<b class="bl">${label}</b> ` : ''}${rest.filter(x => x !== '' || rest.length > 1).map(inline).join('<br>')}</div>`; quote = null
  }
  const flushTable = () => {
    if (!table) return
    const rows = table.filter(r => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r.join('|')) || r.some(c => /[^\s:|-]/.test(c)))
    const head = rows[0], body = rows.slice(1)
    html += `<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${head.map((_, i) => `<td>${inline(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`; table = null
  }
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable() }
  for (const raw of lines) {
    const ln = raw.trimEnd(), t = ln.trim()
    let m
    if (!t) { flushAll(); continue }
    if ((m = t.match(FIG_RE))) { flushAll(); html += `<figure><img src="${m[1]}" alt="">${m[2] ? `<figcaption>${escHtml(m[2].trim())}</figcaption>` : ''}</figure>`; continue }
    if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(t)) { flushAll(); html += '<hr>'; continue }
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { flushAll(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; continue }
    if (t.startsWith('>')) { flushPara(); flushList(); flushTable(); (quote ||= []).push(t.replace(/^>\s?/, '')); continue }
    if (t.startsWith('|') && t.endsWith('|') && t.length > 2) { flushPara(); flushList(); flushQuote(); (table ||= []).push(t.slice(1, -1).split('|').map(c => c.trim())); continue }
    if ((m = t.match(/^(?:[-*•])\s+(.*)$/))) { flushPara(); flushQuote(); flushTable(); if (list?.t !== 'ul') { flushList(); list = { t: 'ul', items: [] } } list.items.push(m[1]); continue }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); flushQuote(); flushTable(); if (list?.t !== 'ol') { flushList(); list = { t: 'ol', items: [] } } list.items.push(m[1]); continue }
    flushList(); flushQuote(); flushTable(); para.push(t)
  }
  flushAll()
  return html
}

export const MATERIAL_CSS = `.md{font-family:Georgia,'Times New Roman',serif;color:#111827;line-height:1.6;font-size:14px}
.md h1{font-size:23px;color:#132a4f;margin:18px 0 8px;border-bottom:2.5px solid #b8923a;padding-bottom:4px}.md h2{font-size:18px;color:#132a4f;margin:16px 0 6px}.md h3{font-size:15px;color:#2e3b52;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.04em}
.md p{margin:0 0 9px}.md ul,.md ol{margin:0 0 10px;padding-left:24px}.md li{margin:2px 0}.md hr{border:0;border-top:1px solid #cfd6e4;margin:14px 0}.md mark{background:#fff1b8;padding:0 2px}
.md table{border-collapse:collapse;width:100%;margin:8px 0 12px;font-size:13px;break-inside:avoid}.md th,.md td{border:1px solid #9aa5b8;padding:5px 9px;text-align:left;vertical-align:top}.md th{background:#eef1f6}
.md figure{margin:10px 0;text-align:center;break-inside:avoid}.md figure img{max-width:100%;max-height:320px}.md figcaption{font:italic 12px system-ui,sans-serif;color:#5d6b82;margin-top:3px}
.md .box{margin:8px 0 12px;padding:8px 12px;border-left:4px solid #2563eb;background:#eef4ff;border-radius:4px;break-inside:avoid}.md .box.tip{border-color:#16a34a;background:#eefaf2}.md .box.formula{border-color:#7c3aed;background:#f4f0ff;font-size:15px}
.md .box.warn{border-color:#d97706;background:#fff6e5}.md .box.ex{border-color:#0891b2;background:#ebf9fc}.md .bl{font:800 11px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-right:4px}`

export const wordCount = s => (String(s || '').replace(/\[\[img:[^\]]*\]\]/g, ' ').match(/\S+/g) || []).length

// Full printable page: institute header, title block, body, page-number footer.
export function materialDocHtml(m, { institute = 'Guidance Navodaya & Sainik Institute', tagline = '', columns = 1, size = 13, auto = false, stacked = true } = {}, css = '') {
  const meta = [m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : '', m.uploaded_by].filter(Boolean).map(escHtml).join(' · ')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(m.title)}</title><style>@page{size:A4;margin:16mm 14mm 18mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0}
.lh{text-align:center;border-bottom:3px double #132a4f;padding-bottom:6px;margin-bottom:10px;font-family:Georgia,serif}.lh h1{margin:0;font-size:20px;color:#132a4f}.lh div{font-size:11.5px;color:#555}
.ti{font:700 19px Georgia,serif;margin:0 0 2px}.me{font:12px system-ui,sans-serif;color:#5d6b82;margin-bottom:10px}.md{font-size:${size}px}.cols{column-count:${columns};column-gap:9mm}.cols h1,.cols h2{break-after:avoid}
.ft{position:fixed;left:0;right:0;bottom:0;text-align:center;font:600 8.5pt system-ui,sans-serif;color:#666}${css}</style></head><body>
<div class="lh"><h1>${escHtml(institute)}</h1><div>${escHtml(tagline || 'Mission Sainik 2027 · Study Material')}</div></div>
<div class="ti">${escHtml(m.title)}</div><div class="me">${meta}</div>
<div class="md${columns > 1 ? ' cols' : ''}">${renderMaterial(m.body || '')}</div>
<div class="ft">${escHtml(institute)} · ${escHtml(m.title)}</div>${auto ? '<script>window.onload=()=>window.print()</script>' : ''}</body></html>`
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
