// mayekPaperHtml.js — the question paper as a printable A4 HTML page, laid out
// like the Word file (mayekDocx.js): letterhead, paper details, instructions,
// questions in one or two columns or side by side, marks, watermark, and the
// answer key / OMR pages. Used for the live preview and for "Save as PDF"
// (the browser's print dialog), so the PDF needs no extra library and shapes
// Meetei Mayek with the browser's own text engine.
import { NotoSansMeeteiMayek } from './NotoSansMeeteiMayek-normal.js'
import { LETTERS, answerKey, numbered, optionsPerRow, answerLineCount, LOOKS } from './mayekPaper.js'

const MAYEK_FONT = 'Noto Sans Meetei Mayek'
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const main = x => (x.mm || x.en)
const sub = (x, lang) => (lang === 'bilingual' && x.mm && x.en && x.mm !== x.en ? `<div class="en">${esc(x.en)}</div>` : '')
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv']
const BUBBLES = ['Ⓐ', 'Ⓑ', 'Ⓒ', 'Ⓓ', 'Ⓔ', 'Ⓕ', 'Ⓖ', 'Ⓗ']

const CSS = `
@font-face{font-family:'${MAYEK_FONT}';src:url(data:font/ttf;base64,${NotoSansMeeteiMayek}) format('truetype')}
@page{size:A4;margin:17mm 17mm 16mm}
*{box-sizing:border-box}
html,body{margin:0;background:#fff}
body{font:11pt/1.5 Calibri,'Carlito','Segoe UI',Arial,'${MAYEK_FONT}',sans-serif;color:#0f1b2e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mm,.q-t,.opt-t,.sec,.txt{font-family:Calibri,'Carlito','Segoe UI','${MAYEK_FONT}',sans-serif}
.sheet{position:relative;width:210mm;min-height:297mm;margin:0 auto;padding:17mm 17mm 16mm;background:#fff}
@media screen{body{background:#e9e5dc}.sheet{box-shadow:0 10px 30px rgba(0,0,0,.15);margin:14px auto}}
@media print{.sheet{width:auto;min-height:0;padding:0;margin:0}.page-break{break-before:page}.sheet + .sheet .wm{display:none}}
.wm{position:fixed;top:50%;left:50%;width:150mm;height:150mm;transform:translate(-50%,-50%);z-index:0;pointer-events:none}
@media screen{.wm{position:absolute;top:148mm}}
.content{position:relative;z-index:1}
.lh{display:flex;align-items:center;gap:14px}
.lh img{width:19mm;height:19mm;object-fit:contain}
.lh h1{margin:0;font-size:17pt;color:#132a4f;line-height:1.15}
.lh .tag{font-style:italic;color:#b8923a;font-size:9pt}
.lh .ad{color:#5d6b82;font-size:9pt}
.rule{border-bottom:3px double #b8923a;margin:7px 0 10px}
.title{text-align:center;font-weight:700;font-size:15pt;margin:2px 0}
.title.mm{color:#132a4f;font-size:13pt}
.facts{display:flex;margin:8px 0 10px}
.facts span{flex:1;text-align:center;background:#f6efdc;border:1px solid #eadbb2;padding:3px 4px;font-size:10pt;font-weight:700;white-space:nowrap}
.facts span b{font-size:7pt;color:#b8923a;letter-spacing:.06em;margin-right:5px}
.facts span.set{background:#132a4f;color:#fff}.facts span.set b{color:#e9d9b0}
.ins{background:#fbf8f1;border:1px solid #eadbb2;border-left:5px solid #b8923a;padding:7px 12px;margin-bottom:10px}
.ins h3{margin:0 0 3px;font-size:10pt;color:#132a4f}
.ins ol{margin:0;padding-left:26px;list-style:none;counter-reset:r}
.ins li{position:relative;font-size:10pt}
.ins li i{position:absolute;left:-26px;color:#b8923a;font-weight:700;font-style:normal}
.cols2{column-count:2;column-gap:7.5mm;column-rule:1px solid #e8e3d8}
.zone{line-height:calc(1.5 * var(--lf,1))}
.q{break-inside:avoid;margin:calc(8px * var(--g,1)) 0 calc(4px * var(--g,1))}
.al{margin-left:28px;height:calc(9.5mm * var(--k,1));border-bottom:1px dotted #b9b2a2}
.roll td{border:1px solid #d9d2c2;height:10mm;padding:3px 8px;vertical-align:top;font-size:7pt;font-weight:700;color:#b8923a;letter-spacing:.06em}
.q-h{display:flex;gap:6px;font-weight:700;font-size:11.5pt}
.q-n{color:#132a4f;min-width:22px}
.q-t{flex:1}
.q-m{color:#b8923a;font-size:9.5pt;white-space:nowrap;padding-left:6px}
.en{font-weight:400;font-style:italic;color:#5d6b82;font-size:8.5pt}
.q-l{padding-left:28px;font-size:11pt}
.opts{padding-left:28px;display:grid;gap:1px 10px;margin-top:2px}
.opt{display:flex;gap:6px;font-size:11pt}
.opt b{color:#b8923a;font-size:10pt;min-width:22px}
.sec{text-align:center;font-weight:700;color:#132a4f;font-size:12pt;border-bottom:1px solid #eadbb2;margin:calc(12px * var(--g,1)) 0 calc(6px * var(--g,1));padding-bottom:2px;break-after:avoid;column-span:all}
.txt{margin:calc(5px * var(--g,1)) 0;font-size:11pt}
table{border-collapse:collapse;width:100%}
.sbs th{background:#132a4f;color:#fff;font-size:8.5pt;text-align:left;padding:4px 6px}
.sbs td{border-bottom:1px solid #f1ede3;padding:4px 6px;vertical-align:top;font-size:10.5pt}
.sbs td.n{font-weight:700;color:#132a4f;width:8%}.sbs td.m{text-align:center;color:#b8923a;font-weight:700;width:8%}
.sbs tr.secrow td{background:#f6efdc;text-align:center;font-weight:700;color:#132a4f}
.sbs tr.q td.t{font-weight:700}
.sbs .ol{color:#b8923a;font-weight:700;margin-right:4px}
.sbs tr{break-inside:avoid}
.ptitle{text-align:center;font-size:15pt;font-weight:700;color:#132a4f;margin:4px 0 0}
.psub{text-align:center;color:#5d6b82;font-size:9.5pt;margin-bottom:10px}
.key td{border:1px solid #eadbb2;padding:5px 7px;font-size:10pt;width:20%}
.key tr:nth-child(odd) td{background:#fbf8f1}
.key b{color:#132a4f;margin-right:5px}.key .l{color:#b8923a;font-weight:700;margin-right:5px}.key .x{color:#5d6b82;font-size:8.5pt}
.omr-f td{border:1px solid #d9d2c2;padding:7px 9px;font-size:10.5pt;font-weight:700;height:11mm}
.omr-f td b{font-size:7pt;color:#b8923a;letter-spacing:.06em;margin-right:6px}
.omr td{padding:2px 8px;font-size:10pt;border-right:1px solid #eadbb2;width:25%}
.omr td:last-child{border-right:0}
.omr b{color:#132a4f;display:inline-block;min-width:22px}
.omr span{font-family:'Segoe UI Symbol','DejaVu Sans',sans-serif;color:#5d6b82;font-size:13pt;letter-spacing:2px}
.note{font-style:italic;color:#5d6b82;font-size:9pt;margin:8px 0}
.foot{margin-top:14px;border-top:1px solid #e8e3d8;padding-top:3px;display:flex;justify-content:space-between;font-size:7.5pt;color:#8a93a6}
`

function letterhead(inst, logoSrc) {
  return `<div class="lh">${logoSrc ? `<img src="${logoSrc}" alt="">` : ''}<div><h1>${esc(inst.name)}</h1>${inst.tagline ? `<div class="tag">${esc(inst.tagline)}</div>` : ''}${inst.address ? `<div class="ad">${esc(inst.address)}</div>` : ''}<div class="ad">${esc([inst.phone, inst.email, inst.website].filter(Boolean).join('  ·  '))}</div></div></div><div class="rule"></div>`
}

function question(q, lang, look) {
  const lines = q.body.filter(b => b.kind === 'line'), opts = q.body.filter(b => b.kind === 'option')
  const per = optionsPerRow(opts.map(o => main(o)), look.perRow, { bilingual: lang === 'bilingual', wide: !look.twoCols })
  const ruled = answerLineCount(q, look.answerLines)
  return `<div class="q"><div class="q-h"><span class="q-n">${q.no}.</span><span class="q-t">${esc(main(q, lang))}${sub(q, lang)}</span>${q.marks ? `<span class="q-m">[${esc(q.marks)}]</span>` : ''}</div>`
    + lines.map(l => `<div class="q-l">${esc(main(l, lang))}${sub(l, lang)}</div>`).join('')
    + '<div class="al"></div>'.repeat(ruled)
    + (opts.length ? `<div class="opts" style="grid-template-columns:repeat(${per},minmax(0,1fr))">${opts.map((o, i) => `<div class="opt"><b>(${LETTERS[i]})</b><span>${esc(main(o, lang))}${sub(o, lang)}</span></div>`).join('')}</div>` : '')
    + '</div>'
}

function sideBySide(blocks) {
  const rows = blocks.map(b => {
    if (b.type === 'section') return `<tr class="secrow"><td colspan="4">${esc(b.en)} · ${esc(b.mm || '')}</td></tr>`
    if (b.type === 'text') return `<tr><td></td><td>${esc(b.en)}</td><td>${esc(b.mm || '')}</td><td></td></tr>`
    const lines = b.body.filter(x => x.kind === 'line')
    return `<tr class="q"><td class="n">${b.no}.</td><td class="t">${esc(b.en)}${lines.map(l => `<div>${esc(l.en)}</div>`).join('')}</td><td class="t">${esc(b.mm || '')}${lines.map(l => `<div>${esc(l.mm || '')}</div>`).join('')}</td><td class="m">${b.marks ? `[${esc(b.marks)}]` : ''}</td></tr>`
      + b.body.filter(x => x.kind === 'option').map((o, i) => `<tr><td></td><td><span class="ol">(${LETTERS[i]})</span>${esc(o.en)}</td><td><span class="ol">(${LETTERS[i]})</span>${esc(o.mm || '')}</td><td></td></tr>`).join('')
  }).join('')
  return `<table class="sbs"><thead><tr><th>No.</th><th>English</th><th>Meetei Mayek</th><th style="text-align:center">Marks</th></tr></thead><tbody>${rows}</tbody></table>`
}

function keyHtml(model, paper, setName) {
  const key = answerKey(model)
  const rows = []
  for (let r = 0; r < key.length; r += 5) rows.push(`<tr>${Array.from({ length: 5 }, (_, k) => { const e = key[r + k]; return `<td>${e ? `<b>${e.no}.</b>${e.letter ? `<span class="l">(${e.letter})</span><span class="x">${esc(e.text)}</span>` : esc(e.text || '—')}` : ''}</td>` }).join('')}</tr>`)
  return `<div class="ptitle">Answer Key${setName ? ` — Set ${esc(setName)}` : ''}</div><div class="psub">${esc([paper.title, paper.subject, paper.klass && `Class ${paper.klass}`].filter(Boolean).join('  ·  '))}</div><table class="key">${rows.join('')}</table>`
}

function omrHtml(model, paper, setName) {
  const qs = numbered(model).filter(b => b.type === 'question' && b.body.some(x => x.kind === 'option'))
  const n = Math.min(8, Math.max(2, ...qs.map(q => q.body.filter(x => x.kind === 'option').length)))
  const per = Math.ceil(qs.length / 4)
  const rows = Array.from({ length: per }, (_, r) => `<tr>${Array.from({ length: 4 }, (_, c) => { const q = qs[c * per + r]; return `<td>${q ? `<b>${q.no}</b><span>${BUBBLES.slice(0, n).join(' ')}</span>` : ''}</td>` }).join('')}</tr>`)
  return `<div class="ptitle">OMR Answer Sheet</div><div class="psub">${esc([paper.title, setName && `Set ${setName}`].filter(Boolean).join('  ·  '))}</div>`
    + `<table class="omr-f"><tr><td><b>NAME OF CANDIDATE</b></td><td><b>ROLL NO.</b></td></tr><tr><td><b>SET</b>${esc(setName || '')}</td><td><b>SIGNATURE OF INVIGILATOR</b></td></tr></table>`
    + `<div class="note">Use a blue or black ball pen. Darken one circle fully for each question. Do not make any stray marks.</div><table class="omr">${rows.join('')}</table>`
}

/**
 * Full HTML document for a paper. opts as buildPaperDocx (mayekDocx.js), plus
 * watermarkSrc (a data URL from watermarkDataUrl) and print (open the print
 * dialog when loaded).
 */
export function paperHtml(model, opts = {}) {
  const { lang = 'mayek', institute = {}, paper = {}, instructions = [], logoSrc, showLogo = true, setName = '', withKey = false, withOmr = false, keyOnly = false, watermarkSrc = '', print = false } = opts
  const columns = lang === 'sidebyside' ? 1 : opts.columns === 2 ? 2 : 1
  const facts = [['Class', paper.klass], ['Subject', paper.subject], ['Date', paper.date], ['Time', paper.time], ['Full marks', paper.marks]].filter(([, v]) => v)
  const ins = (instructions || []).filter(x => x.en || x.mm)
  const blocks = numbered(model)
  const top = letterhead(institute, showLogo ? logoSrc : '')
  const head = `${top}${paper.title ? `<div class="title">${esc(paper.title)}</div>` : ''}${paper.titleMayek ? `<div class="title mm">${esc(paper.titleMayek)}</div>` : ''}`
    + (facts.length || setName ? `<div class="facts">${facts.map(([k, v]) => `<span><b>${k.toUpperCase()}</b>${esc(v)}</span>`).join('')}${setName ? `<span class="set"><b>SET</b>${esc(setName)}</span>` : ''}</div>` : '')
    + (opts.rollBox ? '<table class="roll"><tr><td style="width:52%">NAME</td><td>ROLL NO.</td><td>CLASS / SECTION</td></tr></table><div style="height:8px"></div>' : '')
    + (ins.length ? `<div class="ins"><h3>General Instructions</h3><ol>${ins.map((x, i) => `<li><i>(${ROMAN[i] || i + 1})</i>${esc(main(x, lang))}${sub(x, lang)}</li>`).join('')}</ol></div>` : '')
  const look = { perRow: opts.optionsPerRow || 'auto', answerLines: opts.answerLines || 'off', twoCols: columns === 2 }
  const k = LOOKS.size[opts.textSize] || 1
  const zone = `style="zoom:${k};--k:${k};--g:${LOOKS.spacing[opts.spacing] || 1};--lf:${(LOOKS.line[opts.spacing] || 1.08) / 1.08}"`
  const body = lang === 'sidebyside' ? `<div class="zone" ${zone}>${sideBySide(blocks)}</div>`
    : `<div class="zone ${columns === 2 ? 'cols2' : ''}" ${zone}>${blocks.map(b => (b.type === 'question' ? question(b, lang, look) : b.type === 'section' ? `<div class="sec">${esc(main(b, lang))}${sub(b, lang)}</div>` : `<div class="txt">${esc(main(b, lang))}${sub(b, lang)}</div>`)).join('')}</div>`
  const foot = `<div class="foot"><span>${esc([institute.name, institute.website].filter(Boolean).join('  ·  '))}</span><span>${esc([paper.title, setName && `Set ${setName}`].filter(Boolean).join(' · '))}</span></div>`
  const pages = keyOnly
    ? [`${top}${keyHtml(model, paper, setName)}`]
    : [`${head}${body}`, ...(withKey ? [keyHtml(model, paper, setName)] : []), ...(withOmr ? [omrHtml(model, paper, setName)] : [])]
  const wm = watermarkSrc ? `<img class="wm" src="${watermarkSrc}" alt="">` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc([paper.title || 'Question paper', setName && `Set ${setName}`].filter(Boolean).join(' — '))}</title><style>${CSS}</style></head><body>`
    + pages.map((p, i) => `<div class="sheet${i ? ' page-break' : ''}">${wm}<div class="content">${p}${foot}</div></div>`).join('')
    + (print ? '<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},300)})</script>' : '')
    + '</body></html>'
}
