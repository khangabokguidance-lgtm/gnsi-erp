// Study-material text: a small, safe markup (headings, lists, tables, callouts, figures, maths) rendered to HTML for the
// portal preview, printing and Word export. Everything is escaped first, so typed text can never inject HTML.
//
//   # Heading   ## Subheading   ### Small heading        **bold**  *italic*  ==highlight==
//   - bullet      1. numbered      > Note: callout (Note / Tip / Formula / Important / Example / Warning)
//   | a | b |  tables (a |---| row under the header row is optional)        ---  divider line
//   [[img:data:image/jpeg;base64,…|optional caption]]  a figure on its own line      \frac{3}{4}  x^2  \sqrt{9}  maths
import { SOFTWARE_CREDIT } from './credit.js'
import { mathToHtml, mathPlain } from './mathText.js'

const FIG_RE = /^\[\[img:(data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+)(?:\|([^\]]*))?\]\]$/
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const figureLine = (dataUrl, caption = '', width = 0) => {
  const cap = String(caption || '').replace(/[\]\n|]/g, ' ').trim(), w = Math.round(Number(width) || 0)
  return `[[img:${dataUrl}${cap || w ? '|' + cap : ''}${w >= 20 && w < 100 ? '|' + w + '%' : ''}]]`
}
// Read a figure line back: { url, caption, width } (width 0 = full), or null when the line is not a figure.
export function parseFigureLine(line) {
  const m = String(line || '').trim().match(FIG_RE); if (!m) return null
  const mm = (m[2] || '').match(/^(.*?)(?:\|(\d{2,3})%)?$/s)
  return { url: m[1], caption: (mm[1] || '').trim(), width: mm[2] ? Math.min(100, Math.max(20, Number(mm[2]))) : 0 }
}

const CALLOUTS = { teacher: ['Teacher', 'teacher'], note: ['Note', 'info'], tip: ['Tip', 'tip'], formula: ['Formula', 'formula'], important: ['Important', 'warn'], remember: ['Remember', 'warn'], example: ['Example', 'ex'], warning: ['Warning', 'warn'] }

function inline(t) {
  let s = mathToHtml(t)
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>').replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
  s = s.replace(/~~([^~\n]+)~~/g, '<s>$1</s>').replace(/`([^`\n]+)`/g, '<code>$1</code>')
  s = s.replace(/(?<![_\w])__(?=[^\s_])([^_\n]*[^\s_])__(?![_\w])/g, '<u>$1</u>')                      // "____" blanks are left alone
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)<>"]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  return s
}

// opts.teacher === false hides "> Teacher: …" boxes (the student copy).
export function renderMaterial(src, opts = {}) {
  const showTeacher = opts.teacher !== false
  let hc = 0
  const lines = String(src ?? '').replace(/\r/g, '').split('\n')
  let html = '', para = [], list = null, quote = null, table = null, choices = null, lastQ = null   // lastQ: number of the previous question under this heading
  const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = [] } }
  const optCls = list => { const st = opts.optStyle || 'auto'; if (st !== 'auto') return st; const len = Math.max(...list.map(([, t]) => mathPlain(t).length)); return len <= 12 ? (opts.narrow ? 'two' : 'four') : len <= 32 ? 'two' : 'one' }
  const flushOpts = () => { if (choices) { html += `<div class="opts ${optCls(choices)}">${choices.map(([k, t]) => `<div class="op"><span class="ol">${k}</span><span>${inline(t)}</span></div>`).join('')}</div>`; choices = null } }
  const flushList = () => { if (list) { html += `<${list.t}>${list.items.map(x => { const c = x.match(/^\[( |x|X)\]\s+(.*)$/); return c ? `<li class="chk">${c[1] === ' ' ? '☐' : '☑'} ${inline(c[2])}</li>` : `<li>${inline(x)}</li>` }).join('')}</${list.t}>`; list = null } }
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
  const isOpt = x => /^(?:[-*•]\s*)?\(?([A-Da-d])[.)]\s+\S/.test(x)   // a bullet in front of an option ("• A) 6") still counts as an option
  const nextIsOpt = from => { for (let k = from; k < lines.length; k++) { const x = lines[k].trim(); if (!x) return false; if (parseFigureLine(x)) continue; return isOpt(x) } return false }
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]
    const ln = raw.trimEnd(), t = ln.trim()
    let m
    if (!t) { flushAll(); continue }
    // A numbered question that is followed by (a)(b)(c)(d) options: keep its number, stem and options together.
    if ((m = t.match(/^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[.)]\s+(.+)$/i)) && nextIsOpt(li + 1)) { flushAll(); let qn = Number(m[1]); if (lastQ !== null && qn <= lastQ) qn = lastQ + 1; lastQ = qn   // pasted lists often number every question "1.": count on instead
      html += `<p class="q"><b class="qn">${qn}.</b> ${inline(m[2])}</p>`; continue }
    // Multiple-choice questions typed as plain text: "A) …" lines become an options grid, "Answer: …" a highlighted answer.
    if ((m = t.match(/^(?:[-*•]\s*)?\(?([A-Da-d])[.)]\s+(.*)$/))) {
      flushPara(); flushList(); flushQuote(); flushTable()
      if (!choices) { choices = []; if (html.endsWith('</p>')) { const i = html.lastIndexOf('<p'); if (i >= 0 && html.startsWith('<p>', i)) html = html.slice(0, i) + '<p class="q">' + html.slice(i + 3) } }
      choices.push([m[1].toUpperCase(), m[2]]); continue
    }
    if ((m = t.match(/^(?:answer|ans)\s*[:\-–]\s*(.+)$/i))) { flushPara(); flushOpts(); flushList(); flushQuote(); flushTable(); html += `<div class="ans"><b>Answer</b> ${inline(m[1])}</div>`; continue }
    if (choices) flushOpts()
    if ((m = parseFigureLine(t))) { flushAll(); html += `<figure><img src="${m.url}" alt=""${m.width ? ` style="max-width:${m.width}%"` : ''}>${m.caption ? `<figcaption>${escHtml(m.caption)}</figcaption>` : ''}</figure>`; continue }
    if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(t)) { flushAll(); html += '<hr>'; continue }
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { flushAll(); lastQ = null; html += `<h${m[1].length} id="h${++hc}">${inline(m[2])}</h${m[1].length}>`; continue }
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
.md figure{margin:10px 0;text-align:center;break-inside:avoid}.md figure img{max-width:100%;max-height:320px}.md li.chk{list-style:none;margin-left:-18px}.md code{font:.9em ui-monospace,Menlo,Consolas,monospace;background:#f1f3f7;padding:0 4px;border-radius:3px}.md a{color:#1d4ed8}.md s{opacity:.7}
.md.compact{line-height:1.38;font-size:12px}.md.compact p{margin:0 0 4px}.md.compact h1{margin:9px 0 3px;font-size:1.35em;padding-bottom:2px}.md.compact h2{margin:8px 0 3px;font-size:1.15em}.md.compact h3{margin:6px 0 2px}.md.compact ul,.md.compact ol{margin:0 0 5px;padding-left:19px}.md.compact li{margin:0}.md.compact table{margin:4px 0 7px}.md.compact th,.md.compact td{padding:2px 6px}.md.compact .box{margin:4px 0 7px;padding:4px 9px}.md.compact figure{margin:5px 0}.md.compact figure img{max-height:230px}.md.compact hr{margin:7px 0}.md.compact .opts{margin-bottom:3px}.md.compact p.q{margin:6px 0 3px}
.md figcaption{font:italic 12px system-ui,sans-serif;color:#5d6b82;margin-top:3px}
.md .box{margin:8px 0 12px;padding:8px 12px;border-left:4px solid #2563eb;background:#eef4ff;border-radius:4px;break-inside:avoid}.md .box.tip{border-color:#16a34a;background:#eefaf2}.md .box.formula{border-color:#7c3aed;background:#f4f0ff;font-size:15px}
.md .box.teacher{border-color:#be123c;background:#fff1f3}.md .box.warn{border-color:#d97706;background:#fff6e5}
.md p.q{font-weight:600;margin:12px 0 5px;padding-left:10px;border-left:3px solid #b8923a;break-after:avoid}.md .opts{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin:0 0 6px 13px;break-inside:avoid}.md .opts.four{display:flex;flex-wrap:wrap;gap:3px 20px}.md .opts.one{grid-template-columns:1fr}.md .opts.two{grid-template-columns:1fr 1fr}.md .op{display:flex;gap:8px;align-items:baseline}.md .ol{flex:none;width:1.6em;height:1.6em;line-height:1.6em;border-radius:50%;background:#eef1f6;color:#132a4f;font:700 .78em system-ui,sans-serif;text-align:center}
.md .ans{display:inline-block;margin:2px 0 10px 13px;padding:2px 12px;border-radius:99px;background:#eaf7ef;border:1px solid #b9e2c6;color:#14633f;font-size:.92em}.md .ans b{font:800 .72em system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;margin-right:6px}
@media (max-width:520px){.md .opts{grid-template-columns:1fr 1fr}}.md .box.ex{border-color:#0891b2;background:#ebf9fc}.md .bl{font:800 11px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-right:4px}`

export const wordCount = s => (String(s || '').replace(/\[\[img:[^\]]*\]\]/g, ' ').match(/\S+/g) || []).length

// Print layouts that save paper: margins, columns, text size, compact spacing, ink saver, slim header, contents list.
export const PRINT_DEFAULTS = { paper: 'a4', landscape: false, margin: 'normal', columns: 1, size: 13, compact: false, inkSaver: false, header: 'full', toc: false, teacher: true, byline: true, font: 'serif', hf: true, optStyle: 'auto', studentLine: false, answerGrid: false, nup: 1, copies: 1, smallFigs: false }
export const FONTS = { serif: "Georgia,'Times New Roman',serif", times: "'Times New Roman',Times,serif", sans: 'Arial,Helvetica,sans-serif', narrow: "'Arial Narrow','Roboto Condensed','Liberation Sans Narrow',Arial,sans-serif" }
const MARGINS = { normal: '16mm 14mm 18mm', narrow: '10mm 10mm 12mm', minimal: '6mm 7mm 8mm' }

// Bubble grid for MCQ answers (saves an OMR sheet): Q1 ◯A ◯B ◯C ◯D in compact cells.
export const answerGridHtml = n => n > 0 ? `<div class="ag"><div class="agt">Answer sheet — fill one circle for each question</div><div class="agg">${Array.from({ length: n }, (_, i) => `<div class="agc"><b>${i + 1}</b>${['A', 'B', 'C', 'D'].map(k => `<span>${k}</span>`).join('')}</div>`).join('')}</div></div>` : ''

// Full printable page: institute header, title block with the creator's name and designation, contents list, body, footer.
// nup = 2 prints two copies side by side on an A4 landscape sheet (for class sets); `copies` is how many students need one.
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
  const nup = opt.nup === 2
  const size = Math.max(8, Math.min(18, Number(opt.size) || 13)), cols = nup ? 1 : Math.max(1, Math.min(3, Number(opt.columns) || 1))
  const paper = nup ? 'A4 landscape' : (opt.paper === 'a5' ? 'A5' : 'A4') + (opt.landscape ? ' landscape' : '')
  // Header & footer on every page: the non-question text (institute, title, subject / test, prepared by, page numbers) goes in the page margins,
  // so the page itself is all questions. Not used for 2-copies-per-sheet, with header "none", or for Word (hf: false).
  const hf = !nup && opt.hf !== false && opt.header !== 'none'
  const mg0 = nup ? '6mm' : (MARGINS[opt.margin] || MARGINS.normal)
  const mg = hf ? mg0.split(' ').map((v, i) => (i === 0 || i === 2 ? Math.max(13, parseFloat(v)) + 'mm' : v)).join(' ') : mg0
  const hfc = (x, n = 64) => { const t = String(x ?? '').replace(/["\\<>\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
  const byText = opt.byline && (author.name || m.uploaded_by) ? `Prepared by ${author.name || m.uploaded_by}${author.designation ? ', ' + author.designation : ''}${opt.reviewer ? ' · Reviewed by ' + opt.reviewer : ''}` : ''
  const prem = opt.premium !== false && !opt.inkSaver   // institute look: navy and gold, logo tile, badges, banded tables
  const logo = /^(https:\/\/|data:image\/)/.test(opt.logo || '') ? String(opt.logo).replace(/["'()\\\s]/g, c => encodeURIComponent(c)) : ''
  const hfBox = 'font:8pt system-ui,sans-serif;color:#555'
  const topBox = prem ? 'border-bottom:1.3pt solid #b8923a;padding-bottom:1.6mm;vertical-align:bottom' : ''
  const botBox = prem ? 'border-top:.6pt solid #cdbf93;padding-top:1.6mm;vertical-align:top' : ''
  const pageRule = nup ? `@page{size:${paper};margin:${mg}}`
    : hf ? `@page{size:${paper};margin:${mg};${prem && logo ? `@top-left-corner{content:"";background:#0f2d5e url("${logo}") center/80% no-repeat;border-radius:1.4mm;margin:3mm 1mm 1.6mm 3mm}` : ''}@top-left{content:"${hfc(institute, 44)}";${hfBox};${topBox};font-weight:700;color:#132a4f${prem ? ';text-transform:uppercase;letter-spacing:.06em;font-family:Georgia,serif' : ''}}@top-center{content:"${hfc(m.title, 56)}";${hfBox};${topBox};font-weight:700;color:#111${prem ? ';font-family:Georgia,serif;font-size:9pt' : ''}}@top-right{content:"${hfc([m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : ''].filter(Boolean).join(' · '), 40)}";${hfBox};${topBox}${prem ? ';color:#8a6118;font-weight:700' : ''}}@bottom-left{content:"${hfc(byText, 70)}";${hfBox};${botBox}}@bottom-center{content:"Page " counter(page) " of " counter(pages);${hfBox};${botBox}${prem ? ';color:#132a4f;font-weight:700' : ''}}@bottom-right{content:"${hfc(SOFTWARE_CREDIT, 60)}";${hfBox};${botBox}${prem ? ';color:#8a6118;font-style:italic' : ''}}}`
    : `@page{size:${paper};margin:${mg};@bottom-center{content:"${String(institute).replace(/["\\]/g, '')} · Page " counter(page) " of " counter(pages);font:8pt system-ui,sans-serif;color:#666}}`
  const compactCss = opt.compact || nup ? '.md{line-height:1.36}.md p{margin:0 0 4px}.md h1{margin:9px 0 3px;font-size:1.35em;padding-bottom:2px}.md h2{margin:8px 0 3px;font-size:1.15em}.md h3{margin:6px 0 2px}.md ul,.md ol{margin:0 0 5px;padding-left:19px}.md li{margin:0}.md table{margin:4px 0 7px}.md th,.md td{padding:2px 6px}.md .box{margin:4px 0 7px;padding:4px 9px}.md figure{margin:5px 0}.md figure img{max-height:230px}.md hr{margin:7px 0}.md p.q{margin:6px 0 3px}.md .opts{margin-bottom:3px}' : ''
  const inkCss = opt.inkSaver ? '.md .box,.md .box.tip,.md .box.formula,.md .box.warn,.md .box.ex,.md .box.teacher{background:none!important;border:1px solid #777!important;border-left:3px solid #333!important}.md th{background:none!important;font-weight:800}.md mark{background:none;text-decoration:underline}.md h1{border-bottom:1px solid #444;color:#000}.md h2,.md h3{color:#000}.lh{border-bottom:1px solid #444}.lh h1{color:#000}.md figure img{filter:grayscale(1) contrast(1.1)}.md .ol{background:none;border:1px solid #666}.md .ans{background:none;border-color:#666;color:#000}' : ''
  const premCss = prem ? `.md{color:#1b2433}.md h1{font-family:Georgia,'Times New Roman',serif;color:#132a4f;border-bottom:3px double #132a4f;padding-bottom:3px;letter-spacing:.02em}.md h2{color:#132a4f;background:linear-gradient(90deg,#eef2fa,#fff);border-left:4px solid #b8923a;padding:3px 9px;border-radius:0 4px 4px 0}.md h3{color:#132a4f;border-bottom:1px solid #d9c58a;padding-bottom:2px}
.md p.q{border-left:0;padding-left:0}.md .qn{display:inline-block;min-width:1.55em;text-align:center;background:#132a4f;color:#fff;border-radius:4px;padding:0 5px;margin-right:6px;font:700 .82em system-ui,Arial,sans-serif;line-height:1.55}.md .ol{background:#f6efdc;color:#132a4f;border:1px solid #d9c58a}
.md th{background:#132a4f;color:#fff;border-color:#132a4f}.md tbody tr:nth-child(even) td{background:#f7f9fc}.md td,.md th{border-color:#b9c2d3}.md blockquote,.md .box{border-radius:5px}.md hr{border-top:1px solid #d9c58a}
.stu{border:1px solid #cdbf93;border-radius:6px;padding:5px 9px;background:#fdfbf4}.stu i{border-bottom:1px solid #132a4f}` : ''
  const figCss = opt.smallFigs ? '.md figure img{max-height:120px!important}.md img.oi{max-height:14mm}' : ''
  const body = renderMaterial(m.body || '', { teacher: opt.teacher, optStyle: opt.optStyle, narrow: nup || cols >= 3 })   // in narrow columns 4-across options become 2 x 2
  const nq = (body.match(/<p class="q"/g) || []).length
  const grid = opt.answerGrid ? answerGridHtml(nq) : ''
  const stu = opt.studentLine ? '<div class="stu"><span>Name: <i></i></span><span>Roll no.: <i></i></span><span>Date: <i></i></span></div>' : ''
  const head = hf ? `${stu}${toc}` : `${lh}<div class="ti">${escHtml(m.title)}</div><div class="me">${meta}</div>${by}${stu}${toc}`
  const credit = hf ? '' : `<div class="cr">${escHtml(SOFTWARE_CREDIT)}</div>`   // with a page footer the credit sits in the footer instead
  const main = `<div class="md${cols > 1 ? ' cols' : ''}">${body}</div>${grid}${credit}`
  const sheets = Math.max(1, Math.ceil((Math.max(1, Math.min(500, Number(opt.copies) || 1))) / 2))
  const page = nup
    ? Array.from({ length: sheets }, () => `<div class="sheet"><div class="panel">${head}${main}</div><div class="panel">${head}${main}</div></div>`).join('')
    : `${head}${main}`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(m.title)}</title><style>${pageRule}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0}
.lh{text-align:center;border-bottom:1px solid #b8923a;padding-bottom:6px;margin-bottom:9px;font-family:Georgia,serif}.lh:before{content:"";display:block;height:4px;background:linear-gradient(90deg,#b8923a,#f0e1b8,#b8923a);margin-bottom:7px}.lh h1{margin:0;font-size:17px;color:#132a4f;letter-spacing:.12em;text-transform:uppercase}.lh div{font-size:10px;color:#b8923a;font-weight:700;letter-spacing:.2em;text-transform:uppercase;margin-top:2px}.lh1{font:11px system-ui,sans-serif;color:#444;border-bottom:1px solid #999;padding-bottom:2px;margin-bottom:6px}
.ti{font:700 ${opt.compact || nup ? 17 : 19}px Georgia,serif;margin:0 0 1px}.me{font:11.5px system-ui,sans-serif;color:#5d6b82;margin-bottom:2px}.by{font:12px system-ui,sans-serif;color:#2e3b52;margin-bottom:${opt.compact || nup ? 5 : 9}px}
.stu{display:flex;gap:14px;font:12px system-ui,sans-serif;margin:2px 0 8px}.stu span{flex:1;white-space:nowrap}.stu span:first-child{flex:2}.stu i{display:inline-block;width:calc(100% - 62px);border-bottom:1px solid #444;height:12px;vertical-align:bottom}
.md{font-size:${size}px;font-family:${FONTS[opt.font] || FONTS.serif}}.cols{column-count:${cols};column-gap:7mm;${cols > 1 ? 'column-rule:.5pt solid #ccc;' : ''}}.cols h1,.cols h2,.cols h3{break-after:avoid}
.toc{font:12px system-ui,sans-serif;border:1px solid #cfd6e4;border-radius:6px;padding:6px 12px;margin:0 0 8px;break-inside:avoid}.toc ol{margin:3px 0 0;padding-left:20px;columns:${cols > 1 ? 1 : 2}}.toc li.l2{margin-left:12px;color:#555}.toc a{color:inherit;text-decoration:none}
.cr{margin-top:8px;border-top:.6pt solid #cdbf93;padding-top:3px;text-align:center;font:italic 8pt Georgia,serif;color:#8a6118;break-inside:avoid}
.ag{margin-top:10px;border:1px solid #888;border-radius:4px;padding:5px 7px;break-inside:avoid;font-family:system-ui,sans-serif}.agt{font:700 10px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}.agg{display:grid;grid-template-columns:repeat(${nup ? 3 : 5},1fr);gap:3px 6px}.agc{display:flex;align-items:center;gap:3px;font-size:9px}.agc b{width:15px;text-align:right}.agc span{display:inline-block;width:12px;height:12px;border:1px solid #444;border-radius:50%;text-align:center;font-size:7px;line-height:12px;color:#444}
${nup ? '.sheet{display:grid;grid-template-columns:1fr 1fr;height:198mm;overflow:hidden;break-after:page;page-break-after:always}.panel{padding:0 4mm;overflow:hidden;box-sizing:border-box}.panel:first-child{border-right:1px dashed #888}' : 'body{padding-bottom:6mm}'}${css}${premCss}${compactCss}${inkCss}${figCss}.md{font-size:${size}px;font-family:${FONTS[opt.font] || FONTS.serif}}</style></head><body>${page}${opt.auto ? '<script>window.onload=()=>window.print()</script>' : ''}</body></html>`
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
