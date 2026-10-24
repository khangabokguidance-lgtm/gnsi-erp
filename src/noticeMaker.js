// noticeMaker.js — the Notice Maker's document model and outputs.
// A formal notice on the institute letterhead: reference and date, addressee,
// subject, numbered paragraphs, how-to steps, a schedule table, highlighted
// boxes, a signing block, copy-to list and a tear-off acknowledgement slip.
// The same model is turned into print-ready HTML, a Word file and plain text.
// In any text, **bold** makes bold and [[text]] makes red bold.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from 'docx'

const PURPLE = '3B2A55'
const GOLD = 'B8913F'
const RED = 'B42318'
const INK = '1F2A44'

let seq = 0
export const bid = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const longDate = (d = new Date()) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`

// ── Rich text: [{ text, bold, red }] ────────────────────────────────────────
export function runsOf(s) {
  return String(s ?? '').split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/).filter(Boolean).map(p =>
    p.startsWith('**') ? { text: p.slice(2, -2), bold: true }
      : p.startsWith('[[') ? { text: p.slice(2, -2), bold: true, red: true }
        : { text: p })
}
export const richHTML = s => runsOf(s).map(r => r.red ? `<b class="red">${esc(r.text)}</b>` : r.bold ? `<b>${esc(r.text)}</b>` : esc(r.text)).join('').replace(/\n/g, '<br>')
export const plain = s => runsOf(s).map(r => r.text).join('')

const letter = i => `(${String.fromCharCode(97 + i)})`
const clean = xs => (xs || []).map(x => String(x ?? '').trim()).filter(Boolean)

// ── Model ───────────────────────────────────────────────────────────────────
// The screen passes the institute's saved details (System Settings) in here;
// kept out of this module so the model can be tested without the app.
let inst = {}
export const setInstitute = i => { inst = i || {} }

export function defaultLetterhead() {
  const i = inst
  return {
    name: String(i.name || 'Guidance Navodaya & Sainik Institute').toUpperCase(),
    tagline: `A premier institute for Navodaya & Sainik preparation · since ${i.established || '2016'}`,
    address: 'KHANGABOK SOROK WANGMA, THOUBAL, MANIPUR – 795138',
    regd: 'Regd. No. 25 of 2016-17 under the Manipur Societies Registration Act, 1989',
    logoUrl: i.logoUrl || '',
  }
}

export const blankNotice = () => ({
  letterhead: defaultLetterhead(),
  heading: 'NOTICE', subtitle: '',
  refPrefix: 'GN&SI/Office', ref: '', date: longDate(), to: '', urgent: false, subject: '',
  blocks: [{ id: bid(), type: 'para', text: '' }],
  closing: '', signBy: 'By Order', signTitle: 'Head of the Institute', signOrg: 'Guidance Navodaya & Sainik Institute',
  copyTo: [], ack: false,
})

export const BLOCK_LABEL = { para: 'Numbered paragraph', list: 'Paragraph with (a) (b) list', steps: 'Step boxes', table: 'Schedule table', box: 'Highlighted box' }
export const newBlock = type => ({
  id: bid(), type,
  ...(type === 'para' ? { text: '' } : {}),
  ...(type === 'list' ? { text: '', items: [''] } : {}),
  ...(type === 'steps' ? { heading: 'PROCEDURE', note: '', items: [{ title: '', text: '' }] } : {}),
  ...(type === 'table' ? { heading: 'SCHEDULE', head: ['Sl.', 'Date', 'Action'], rows: [{ a: '', b: '', final: false }] } : {}),
  ...(type === 'box' ? { heading: '', text: '', tone: 'red' } : {}),
})

const withIds = n => ({ ...n, letterhead: defaultLetterhead(), blocks: n.blocks.map(b => ({ ...b, id: bid() })) })

export const PRESETS = {
  'Fee Collection Drive': () => withIds({
    heading: 'NOTICE', subtitle: 'FEE COLLECTION DRIVE · 27 OCTOBER – 10 NOVEMBER 2026',
    refPrefix: 'GN&SI/Fees', ref: 'GN&SI/Fees/2026/____', date: '____ October 2026', to: 'All Fee Counter Staff, GN&SI', urgent: true,
    subject: 'Mandatory Collection of All Outstanding Fees by 10 November 2026',
    blocks: [
      { type: 'para', text: 'The Institute is passing through a [[serious financial crisis]]. Outstanding student fees have reached a level the Institute can no longer carry, owing largely to **carelessness and lack of follow-up in fee collection** at the Fee Counter. The Head of the Institute has taken a serious view of this lapse and has expressed strong displeasure over it. Collection of these dues is therefore declared the top priority of the Fee Counter with immediate effect.' },
      { type: 'list', text: 'All Fee Counter Staff are hereby directed to:', items: [
        'collect all outstanding fees on or before **10 November 2026**;',
        'follow up with every defaulting parent or guardian by telephone, in person and in writing, using the Month-wise Dues ledger in the ERP to ascertain the amount due from each student;',
        'submit a signed collection report (students contacted, amount collected, amount still pending with reasons) at the Founder’s Office by **10 November 2026, 5:00 PM**;',
        'enter every receipt in the ERP on the day of collection. Reports that do not tally with the ERP shall not be accepted.'] },
      { type: 'steps', heading: 'PROCEDURE — HOW TO COLLECT', note: 'Full steps in the ERP: Help Center → Fees → “Fee counter routine: collect dues step by step”.', items: [
        { title: 'Call list', text: 'Student Fee Ledger → Month-wise Dues: select the month and print the call list.' },
        { title: 'Contact', text: 'Contact each parent or guardian. Fees → Reminders opens a WhatsApp dues message.' },
        { title: 'Collect', text: 'Fees → Fee Payment: search by GCC No., select the fee, verify the amount, set date and mode, collect and print the receipt.' },
        { title: 'Part payment', text: 'Collect it with the reason recorded, or agree a plan in Fees → Instalments.' },
        { title: 'Day close', text: 'Fees → Day Close: count the cash and save the closing.' },
        { title: 'Report', text: 'Student Fee Ledger → Month-wise Collection: select the month, print, sign and submit at the Founder’s Office.' }] },
      { type: 'table', heading: 'SCHEDULE', head: ['Sl.', 'Date', 'Action'], rows: [
        { a: '27 October 2026', b: 'Dues lists issued to Fee Counter Staff from the ERP; collection drive starts' },
        { a: '3 November 2026, 5:00 PM', b: 'Progress check: amount collected so far reported at the Founder’s Office' },
        { a: '7 November 2026', b: 'Final reminders to all parents and guardians who have not paid' },
        { a: '10 November 2026, 5:00 PM', b: '[[FINAL DEADLINE:]] fees collected and signed collection report submitted at the Founder’s Office', final: true }] },
      { type: 'box', heading: 'CONSEQUENCE OF NON-COMPLIANCE', tone: 'red', text: 'No extension shall be granted. The salary of any Fee Counter Staff member who has not collected the dues assigned to them and has not submitted the collection report by the deadline shall be [[withheld]] until the report is submitted and reviewed by the Founder’s Office.' },
    ],
    closing: 'This notice is final and shall be treated as URGENT. All concerned are directed to comply strictly with this order.',
    signBy: 'By Order', signTitle: 'Head of the Institute', signOrg: 'Guidance Navodaya & Sainik Institute',
    copyTo: ['The Accounts Section, GN&SI, for information and necessary action.', 'The Notice Board, Fee Counter.', 'Office copy.'], ack: true,
  }),
  'General Circular': () => withIds({
    heading: 'CIRCULAR', subtitle: '', refPrefix: 'GN&SI/Office', ref: '', date: longDate(), to: 'All Concerned', urgent: false, subject: '',
    blocks: [{ type: 'para', text: 'It is hereby notified for the information of all concerned that ' }, { type: 'para', text: 'All concerned are requested to take note and act accordingly.' }],
    closing: '', signBy: 'By Order', signTitle: 'Head of the Institute', signOrg: 'Guidance Navodaya & Sainik Institute', copyTo: ['Notice Board.', 'Office copy.'], ack: false,
  }),
  'Holiday Notice': () => withIds({
    heading: 'NOTICE', subtitle: 'HOLIDAY ANNOUNCEMENT', refPrefix: 'GN&SI/Office', ref: '', date: longDate(), to: 'All Students, Parents and Staff', urgent: false,
    subject: 'Institute will remain closed on ____',
    blocks: [{ type: 'para', text: 'It is hereby notified that the Institute (including the hostel office and classes) will remain **closed on ____ on account of ____**.' }, { type: 'para', text: 'Classes and office work will resume on **____**. Hostel students shall follow the instructions given by the Warden.' }],
    closing: '', signBy: 'By Order', signTitle: 'Head of the Institute', signOrg: 'Guidance Navodaya & Sainik Institute', copyTo: ['Notice Board.', 'Hostel Warden.', 'Office copy.'], ack: false,
  }),
  'Staff Meeting': () => withIds({
    heading: 'NOTICE', subtitle: 'STAFF MEETING', refPrefix: 'GN&SI/Office', ref: '', date: longDate(), to: 'All Teaching and Non-Teaching Staff', urgent: false,
    subject: 'General staff meeting on ____',
    blocks: [
      { type: 'para', text: 'A general staff meeting will be held as follows. Attendance is **compulsory** for all staff.' },
      { type: 'table', heading: 'MEETING DETAILS', head: ['Sl.', 'Item', 'Details'], rows: [{ a: 'Date and time', b: '____' }, { a: 'Venue', b: '____' }, { a: 'Agenda', b: '____' }] },
    ],
    closing: 'Absence without prior permission will be viewed seriously.', signBy: 'By Order', signTitle: 'Head of the Institute', signOrg: 'Guidance Navodaya & Sainik Institute', copyTo: ['Office copy.'], ack: true,
  }),
}

// ── Plain text (copy, WhatsApp, Notice Board description) ───────────────────
export function noticeText(n) {
  const out = []
  out.push(n.letterhead.name, '')
  out.push(`${n.heading}${n.urgent ? ' (URGENT)' : ''}`)
  if (n.subtitle) out.push(n.subtitle)
  out.push('', `Ref. No.: ${n.ref || '____'}    Date: ${n.date}`)
  if (n.to) out.push(`To: ${n.to}`)
  if (n.subject) out.push(`Subject: ${n.subject}`)
  out.push('')
  let no = 0
  for (const b of n.blocks) {
    if (b.type === 'para') { if (b.text.trim()) out.push(`${++no}. ${plain(b.text)}`, '') }
    else if (b.type === 'list') { out.push(`${++no}. ${plain(b.text)}`); clean(b.items).forEach((x, i) => out.push(`   ${letter(i)} ${plain(x)}`)); out.push('') }
    else if (b.type === 'steps') { out.push(b.heading, b.note ? plain(b.note) : '', ...b.items.map((s, i) => `${i + 1}. ${plain(s.title)}: ${plain(s.text)}`), '') }
    else if (b.type === 'table') { out.push(b.heading, ...b.rows.map((r, i) => `${i + 1}. ${plain(r.a)} — ${plain(r.b)}`), '') }
    else if (b.type === 'box') { out.push([b.heading, plain(b.text)].filter(Boolean).join(': '), '') }
  }
  if (n.closing) out.push(plain(n.closing), '')
  out.push(n.signBy, n.signTitle, n.signOrg)
  if (clean(n.copyTo).length) out.push('', 'Copy to:', ...clean(n.copyTo).map((c, i) => `${i + 1}. ${c}`))
  return out.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n').trim()
}

// ── HTML (preview, print, save as PDF) ──────────────────────────────────────
const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,'Times New Roman',serif;color:#${INK};background:#e9ecf2;padding:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;max-width:100%;margin:0 auto;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.18)}table.wrap{width:100%;border-collapse:collapse}table.wrap>thead>tr>td,table.wrap>tbody>tr>td,table.wrap>tfoot>tr>td{padding:0}table.wrap>thead>tr>td{padding-bottom:10px}
.lh{background:#${PURPLE};color:#fff;text-align:center;padding:12px 18px;display:flex;align-items:center;gap:14px;justify-content:center}.lh img{height:62px;width:auto}.lh h2{font-size:21px;letter-spacing:.06em;font-weight:700;color:#fff}
.lh .tag{font-style:italic;color:#e2c57e;font-size:12.5px;margin-top:2px}.lh .adr{font-family:Arial,sans-serif;letter-spacing:.22em;font-size:9.5px;margin-top:5px;font-weight:700}.lh .reg{font-size:9px;color:#d8d0e6;margin-top:3px}
.in{padding:14px 26px 8px}.hd{text-align:center;margin:8px 0 14px}.hd h1{font-family:Arial,sans-serif;letter-spacing:.5em;font-size:22px;color:#${PURPLE};padding-left:.5em}.hd p{font-family:Arial,sans-serif;font-size:10px;letter-spacing:.28em;color:#${GOLD};font-weight:700;margin-top:4px}
.meta{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:11px;border-bottom:1px solid #cfc7dd;padding:4px 0}.to{display:flex;justify-content:space-between;align-items:center;font-family:Arial,sans-serif;font-size:11px;padding:5px 0}
.urg{background:#${RED};color:#fff;font-weight:800;letter-spacing:.2em;font-size:9.5px;padding:2px 9px}.sub{margin:8px 0 12px;background:#f1e7cc;border-left:4px solid #${GOLD};padding:6px 12px;font-family:Arial,sans-serif;font-weight:700;font-size:12px;color:#${PURPLE}}
.red{color:#${RED}}p.np{display:flex;gap:10px;font-size:12px;line-height:1.55;text-align:justify;margin:0 0 8px;break-inside:avoid}p.np>b.n{color:#${PURPLE};min-width:18px}.li{display:flex;gap:8px;margin:2px 0 2px 28px;font-size:12px;line-height:1.5;text-align:justify}.li>span:first-child{min-width:22px;color:#${PURPLE};font-weight:700}
.sec{font-family:Arial,sans-serif;font-size:11px;letter-spacing:.2em;font-weight:800;color:#${PURPLE};border-left:4px solid #${GOLD};padding-left:8px;margin:14px 0 6px}.note{font-style:italic;font-size:10.5px;color:#555;margin-bottom:6px}
.steps{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}.step{background:#f4f1f9;padding:6px 10px;display:flex;gap:8px;break-inside:avoid;font-size:11px;line-height:1.4}.step .k{font-family:Arial,sans-serif;font-size:21px;font-weight:700;color:#${GOLD};line-height:1}.step b{display:block;color:#${PURPLE};font-family:Arial,sans-serif;font-size:11px}
table.t{width:100%;border-collapse:collapse;font-size:11.5px}table.t th{background:#${PURPLE};color:#fff;text-align:left;padding:6px 8px;font-family:Arial,sans-serif;font-size:10.5px}table.t td{padding:6px 8px;border-bottom:1px solid #ddd5e8;vertical-align:top}table.t tr.fin td{background:#fdecec;color:#${RED};font-weight:700}table.t tr:nth-child(even):not(.fin) td{background:#f7f4fb}
.box{margin:14px 0 8px;padding:9px 14px;font-size:12px;line-height:1.55;break-inside:avoid;border-left:4px solid}.box h4{font-family:Arial,sans-serif;font-size:11px;letter-spacing:.18em;margin-bottom:4px}.box.red{background:#fdecec;border-color:#${RED}}.box.red h4{color:#${RED}}.box.blue{background:#eef2fb;border-color:#1d3a78}.box.blue h4{color:#1d3a78}.box.grey{background:#f3f3f3;border-color:#777}
.close{font-weight:700;font-size:12px;color:#${PURPLE};margin:12px 0 4px;line-height:1.5}.sign{display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px;break-inside:avoid;font-size:11px}.sign .cc{font-family:Arial,sans-serif;font-size:10px;line-height:1.5}.sign .sg{text-align:center;min-width:230px}.sg .by{font-family:Arial,sans-serif;font-weight:700;margin-bottom:34px;text-align:center}.sg .ln{border-top:1px solid #${INK};padding-top:3px;font-style:italic}.sg b{display:block;color:#${PURPLE};font-family:Arial,sans-serif}
.ack{margin-top:16px;border-top:1.5px dashed #888;padding-top:6px;break-inside:avoid;font-size:11px}.ack .cut{font-size:9.5px;font-style:italic;color:#666}.ack h5{text-align:center;font-family:Arial,sans-serif;letter-spacing:.3em;font-size:11px;margin:8px 0 4px;color:#${PURPLE}}.ack p{text-align:center}.ack .f{display:flex;justify-content:space-between;margin-top:14px}
.np-bar{position:sticky;top:0;display:flex;justify-content:center;gap:8px;padding:8px;background:#${PURPLE};margin:-14px -14px 12px}.np-bar button{padding:8px 20px;border-radius:99px;border:none;font-weight:800;cursor:pointer;background:#e2c57e;color:#${PURPLE}}
@media print{body{background:#fff;padding:0}.page{box-shadow:none;width:auto}.np-bar{display:none}}`

export function noticeHTML(n, { toolbar = false } = {}) {
  const lh = n.letterhead
  let no = 0
  const blocks = n.blocks.map(b => {
    if (b.type === 'para') return b.text.trim() ? `<p class="np"><b class="n">${++no}.</b><span>${richHTML(b.text)}</span></p>` : ''
    if (b.type === 'list') return `<p class="np"><b class="n">${++no}.</b><span>${richHTML(b.text)}</span></p>${clean(b.items).map((x, i) => `<div class="li"><span>${letter(i)}</span><span>${richHTML(x)}</span></div>`).join('')}`
    if (b.type === 'steps') return `<div class="sec">${esc(b.heading)}</div>${b.note ? `<div class="note">${richHTML(b.note)}</div>` : ''}<div class="steps">${b.items.map((s, i) => `<div class="step"><span class="k">${i + 1}</span><span><b>${esc(s.title)}</b>${richHTML(s.text)}</span></div>`).join('')}</div>`
    if (b.type === 'table') return `<div class="sec">${esc(b.heading)}</div><table class="t"><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r, i) => `<tr class="${r.final ? 'fin' : ''}"><td>${i + 1}</td><td>${richHTML(r.a)}</td><td>${richHTML(r.b)}</td></tr>`).join('')}</tbody></table>`
    if (b.type === 'box') return `<div class="box ${b.tone || 'red'}">${b.heading ? `<h4>${esc(b.heading)}</h4>` : ''}${richHTML(b.text)}</div>`
    return ''
  }).join('')
  const cc = clean(n.copyTo)
  const body = `<div class="in"><div class="hd"><h1>${esc(n.heading)}</h1>${n.subtitle ? `<p>${esc(n.subtitle)}</p>` : ''}</div>
    <div class="meta"><span><b>Ref. No.:</b> ${esc(n.ref || '____')}</span><span><b>Date:</b> ${esc(n.date)}</span></div>
    <div class="to"><span><b>To:</b> ${esc(n.to)}</span>${n.urgent ? '<span class="urg">URGENT</span>' : ''}</div>
    ${n.subject ? `<div class="sub">Subject: ${esc(n.subject)}</div>` : ''}${blocks}
    ${n.closing ? `<div class="close">${richHTML(n.closing)}</div>` : ''}
    <div class="sign"><div class="cc">${cc.length ? `<b>Copy to:</b><br>${cc.map((c, i) => `${i + 1}. ${esc(c)}`).join('<br>')}` : ''}</div>
      <div class="sg"><div class="by">${esc(n.signBy)}</div><div class="ln">${esc(n.signTitle)}</div><b>${esc(n.signOrg)}</b></div></div>
    ${n.ack ? `<div class="ack"><div class="cut">✂ cut here and return to the Founder’s Office</div><h5>ACKNOWLEDGEMENT</h5><p>I have received and read Notice Ref. No. ${esc(n.ref || '____')} and will comply with it.</p><div class="f"><span>Name: _______________</span><span>Signature: _______________</span><span>Date: ________</span></div></div>` : ''}</div>`
  const head = `<div class="lh">${lh.logoUrl ? `<img src="${esc(lh.logoUrl)}" alt="">` : ''}<div><h2>${esc(lh.name)}</h2>${lh.tagline ? `<div class="tag">${esc(lh.tagline)}</div>` : ''}${lh.address ? `<div class="adr">${esc(lh.address)}</div>` : ''}${lh.regd ? `<div class="reg">${esc(lh.regd)}</div>` : ''}</div></div>`
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(`${n.heading} ${n.ref || ''}`.trim())}</title><style>${CSS}@page{size:A4;margin:8mm}</style></head><body>${toolbar ? '<div class="np-bar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>' : ''}<div class="page"><table class="wrap"><thead><tr><td>${head}</td></tr></thead><tbody><tr><td>${body}</td></tr></tbody></table></div></body></html>`
}

export function printNotice(n) {
  const html = noticeHTML(n, { toolbar: true })
  const w = window.open('', '_blank', 'width=1000,height=900')
  if (!w) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  w.document.write(html); w.document.close()
}

// ── Word ────────────────────────────────────────────────────────────────────
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE }
const FONT = 'Cambria'
const run = (r, extra = {}) => new TextRun({ text: r.text, bold: r.bold || extra.bold, color: r.red ? RED : extra.color, font: FONT, size: extra.size ?? 22, italics: extra.italics })
const runs = (s, extra) => runsOf(s).map(r => run(r, extra))
const para = (children, o = {}) => new Paragraph({ children, spacing: { after: 100, line: 300 }, alignment: AlignmentType.JUSTIFIED, ...o })
const cell = (children, fill, o = {}) => new TableCell({ children, shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined, margins: { top: 70, bottom: 70, left: 120, right: 120 }, borders: NO_BORDERS, ...o })
const table = (rows, widths) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths, rows })
const section = h => new Paragraph({ children: [new TextRun({ text: h, bold: true, color: PURPLE, font: FONT, size: 20, characterSpacing: 40 })], border: { left: { style: BorderStyle.SINGLE, size: 24, color: GOLD, space: 6 } }, spacing: { before: 220, after: 100 }, keepNext: true })

async function logoRun(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg'
    return new ImageRun({ type, data: await res.arrayBuffer(), transformation: { width: 62, height: 62 } })
  } catch { return null }
}

export async function buildNoticeDocx(n) {
  const lh = n.letterhead
  const logo = await logoRun(lh.logoUrl)
  const ctr = (t, o) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: t, font: FONT, color: 'FFFFFF', ...o })] })
  const headText = [ctr(lh.name, { bold: true, size: 34 }), lh.tagline && ctr(lh.tagline, { italics: true, size: 20, color: 'E2C57E' }), lh.address && ctr(lh.address, { bold: true, size: 16, characterSpacing: 40 }), lh.regd && ctr(lh.regd, { size: 15, color: 'D8D0E6' })].filter(Boolean)
  const header = new Header({ children: [table([new TableRow({ children: [
    ...(logo ? [cell([new Paragraph({ children: [logo], alignment: AlignmentType.CENTER })], PURPLE, { width: { size: 14, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER })] : []),
    cell(headText, PURPLE, { verticalAlign: VerticalAlign.CENTER }),
  ] })], logo ? [14, 86] : [100])] })

  const body = []
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 40 }, children: [new TextRun({ text: n.heading.split('').join(' '), bold: true, color: PURPLE, font: FONT, size: 40 })] }))
  if (n.subtitle) body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: n.subtitle, bold: true, color: GOLD, font: FONT, size: 18, characterSpacing: 30 })] }))
  body.push(table([new TableRow({ children: [
    cell([para([run({ text: 'Ref. No.: ', bold: true }), run({ text: n.ref || '____' })], { alignment: AlignmentType.LEFT })], undefined, { width: { size: 60, type: WidthType.PERCENTAGE } }),
    cell([para([run({ text: 'Date: ', bold: true }), run({ text: n.date })], { alignment: AlignmentType.RIGHT })]),
  ] })], [60, 40]))
  body.push(table([new TableRow({ children: [
    cell([para([run({ text: 'To: ', bold: true }), run({ text: n.to })], { alignment: AlignmentType.LEFT })], undefined, { width: { size: 80, type: WidthType.PERCENTAGE } }),
    cell(n.urgent ? [para([run({ text: 'URGENT', bold: true, color: 'FFFFFF' }, { size: 18 })], { alignment: AlignmentType.CENTER })] : [para([])], n.urgent ? RED : undefined),
  ] })], [80, 20]))
  if (n.subject) body.push(new Paragraph({ children: [run({ text: `Subject: ${n.subject}`, bold: true }, { color: PURPLE })], shading: { type: ShadingType.CLEAR, fill: 'F1E7CC', color: 'auto' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: GOLD, space: 6 } }, spacing: { before: 140, after: 180 } }))

  let no = 0
  for (const b of n.blocks) {
    if (b.type === 'para') { if (b.text.trim()) body.push(para([run({ text: `${++no}.  `, bold: true }, { color: PURPLE }), ...runs(b.text)])) }
    else if (b.type === 'list') {
      body.push(para([run({ text: `${++no}.  `, bold: true }, { color: PURPLE }), ...runs(b.text)]))
      clean(b.items).forEach((x, i) => body.push(para([run({ text: `${letter(i)}  `, bold: true }, { color: PURPLE }), ...runs(x)], { indent: { left: 560 }, spacing: { after: 60, line: 290 } })))
    } else if (b.type === 'steps') {
      body.push(section(b.heading))
      if (b.note) body.push(new Paragraph({ children: runs(b.note, { italics: true, size: 19 }), spacing: { after: 80 } }))
      const cells = b.items.map((s, i) => cell([para([run({ text: `${i + 1}  `, bold: true }, { color: GOLD, size: 30 }), run({ text: s.title, bold: true }, { color: PURPLE })], { alignment: AlignmentType.LEFT, spacing: { after: 30 } }), para(runs(s.text, { size: 20 }), { alignment: AlignmentType.LEFT })], 'F4F1F9', { width: { size: 50, type: WidthType.PERCENTAGE } }))
      const rows = []
      for (let i = 0; i < cells.length; i += 2) rows.push(new TableRow({ cantSplit: true, children: [cells[i], cells[i + 1] || cell([para([])])] }))
      body.push(table(rows, [50, 50]))
    } else if (b.type === 'table') {
      body.push(section(b.heading))
      const th = (t, w) => cell([para([run({ text: t, bold: true, color: 'FFFFFF' }, { size: 20 })], { alignment: AlignmentType.LEFT })], PURPLE, { width: { size: w, type: WidthType.PERCENTAGE } })
      const rows = [new TableRow({ tableHeader: true, children: [th(b.head[0], 8), th(b.head[1], 30), th(b.head[2], 62)] })]
      b.rows.forEach((r, i) => {
        const fill = r.final ? 'FDECEC' : i % 2 ? 'F7F4FB' : undefined
        const x = { size: 20, bold: r.final, color: r.final ? RED : undefined }
        rows.push(new TableRow({ cantSplit: true, children: [cell([para([run({ text: String(i + 1) }, x)], { alignment: AlignmentType.LEFT })], fill), cell([para(runs(r.a, x), { alignment: AlignmentType.LEFT })], fill), cell([para(runs(r.b, x), { alignment: AlignmentType.LEFT })], fill)] }))
      })
      body.push(table(rows, [8, 30, 62]))
    } else if (b.type === 'box') {
      const tone = { red: ['FDECEC', RED], blue: ['EEF2FB', '1D3A78'], grey: ['F3F3F3', '777777'] }[b.tone] || ['FDECEC', RED]
      const inner = [b.heading && new Paragraph({ children: [new TextRun({ text: b.heading, bold: true, color: tone[1], font: FONT, size: 20, characterSpacing: 30 })], spacing: { after: 60 } }), para(runs(b.text), { alignment: AlignmentType.LEFT })].filter(Boolean)
      body.push(new Paragraph({ spacing: { before: 120 }, children: [] }))
      body.push(table([new TableRow({ cantSplit: true, children: [cell(inner, tone[0], { borders: { ...NO_BORDERS, left: { style: BorderStyle.SINGLE, size: 24, color: tone[1] } } })] })], [100]))
    }
  }
  if (n.closing) body.push(new Paragraph({ children: runs(n.closing, { bold: true, color: PURPLE }), spacing: { before: 200, after: 120 }, alignment: AlignmentType.JUSTIFIED }))
  const cc = clean(n.copyTo)
  body.push(table([new TableRow({ cantSplit: true, children: [
    cell(cc.length ? [para([run({ text: 'Copy to:', bold: true }, { size: 19 })], { alignment: AlignmentType.LEFT, spacing: { after: 20 } }), ...cc.map((c, i) => para([run({ text: `${i + 1}. ${c}` }, { size: 19 })], { alignment: AlignmentType.LEFT, spacing: { after: 10 } }))] : [para([])], undefined, { width: { size: 55, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.BOTTOM }),
    cell([para([run({ text: n.signBy, bold: true }, { size: 20 })], { alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 500 } }), new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 2 } }, children: [new TextRun({ text: n.signTitle, italics: true, font: FONT, size: 20 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: n.signOrg, bold: true, color: PURPLE, font: FONT, size: 20 })] })], undefined, { width: { size: 45, type: WidthType.PERCENTAGE } }),
  ] })], [55, 45]))
  if (n.ack) {
    body.push(new Paragraph({ spacing: { before: 280, after: 60 }, border: { top: { style: BorderStyle.DASHED, size: 8, color: '888888', space: 6 } }, children: [new TextRun({ text: '✂  cut here and return to the Founder’s Office', italics: true, font: FONT, size: 18, color: '666666' })] }))
    body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'A C K N O W L E D G E M E N T', bold: true, color: PURPLE, font: FONT, size: 20 })] }))
    body.push(para([run({ text: `I have received and read Notice Ref. No. ${n.ref || '____'} and will comply with it.` }, { size: 20 })], { alignment: AlignmentType.CENTER }))
    body.push(new Paragraph({ spacing: { before: 260 }, children: [new TextRun({ text: 'Name: ______________________        Signature: ______________________        Date: ____________', font: FONT, size: 20 })] }))
  }

  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${n.ref || n.heading}  ·  Page `, font: FONT, size: 16, color: '777777' }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '777777' })] })] })
  return Packer.toBlob(new Document({ creator: 'GNSI ERP', title: `${n.heading} ${n.ref || ''}`.trim(), sections: [{ properties: { page: { margin: { top: 1100, bottom: 900, left: 1000, right: 1000, header: 360 } } }, headers: { default: header }, footers: { default: footer }, children: body }] }))
}

export async function downloadNoticeDocx(n) {
  const blob = await buildNoticeDocx(n)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${(n.ref || n.heading || 'Notice').replace(/[^\w.-]+/g, '-')}.docx`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ── Notice Board helpers ────────────────────────────────────────────────────
// A Notice Board entry as a letterhead notice (print / Word from the board).
export function noticeFromBoard(item) {
  const d = item.publish_date ? new Date(`${item.publish_date}T00:00:00`) : new Date()
  const paras = String(item.description || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean)
  return {
    ...blankNotice(),
    heading: 'NOTICE', subtitle: item.category && item.category !== 'General' ? String(item.category).toUpperCase() : '',
    date: longDate(Number.isNaN(d.getTime()) ? new Date() : d),
    to: item.audience === 'Class Specific' ? (item.class_target || 'All Concerned') : item.audience === 'All' ? 'All Concerned' : `All ${item.audience}`,
    urgent: item.priority === 'Urgent', subject: item.title || '',
    blocks: (paras.length ? paras : ['']).map(text => ({ id: bid(), type: 'para', text })),
    copyTo: ['Notice Board.', 'Office copy.'],
  }
}

const csvCell = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
export const noticesCSV = list => [
  ['Title', 'Category', 'Audience', 'Class', 'Priority', 'Status', 'Publish date', 'Expiry date', 'Pinned', 'Public', 'Description'],
  ...list.map(n => [n.title, n.category, n.audience, n.class_target, n.priority, n.status, n.publish_date, n.expiry_date, n.pinned ? 'Yes' : 'No', n.is_public ? 'Yes' : 'No', n.description]),
].map(r => r.map(csvCell).join(',')).join('\r\n')

// ISO date `days` after `from` (a date or today), for "extend expiry".
export function addDays(iso, days) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  const base = y ? new Date(y, m - 1, d) : new Date()
  base.setDate(base.getDate() + days)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}
