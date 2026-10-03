// ════════════════════════════════════════════════════════════════════════
//  premiumReceipt.js — the ONE fee-receipt design used everywhere
//  (Fees → Collect, Student Fee Ledger → Receipt). Hospital-style layout:
//  letterhead · FEE RECEIPT bar · barcode · boxed student grid · itemised
//  bill · gross / concession / NET PAID · amount in words · PAID stamp.
// ════════════════════════════════════════════════════════════════════════
import QRCode from 'qrcode'
import { getInstitute } from './systemSettings'

const escH = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
const money = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = d => { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }

export function amountInWords(num) {
  num = Math.round(Number(num) || 0)
  if (num === 0) return 'Zero Rupees Only'
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = n => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
  const three = n => (n >= 100 ? a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '')
  const parts = []
  const cr = Math.floor(num / 10000000); num %= 10000000
  const lk = Math.floor(num / 100000); num %= 100000
  const th = Math.floor(num / 1000); num %= 1000
  if (cr) parts.push(two(cr) + ' Crore'); if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (num) parts.push(three(num))
  return parts.join(' ') + ' Rupees Only'
}

// QR code as inline SVG (sync — built from the qrcode library's module matrix).
// The QR carries a check link: staff open it (or type the receipt number into
// Fees → Verify Receipt) to confirm the receipt exists, its amount and that it
// has not been reverted. Nothing is shown to the public.
export function receiptQrSVG(text, px = 64) {
  try {
    const { modules } = QRCode.create(String(text), { errorCorrectionLevel: 'M' })
    const n = modules.size
    let d = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.data[y * n + x]) d += `M${x},${y}h1v1h-1z`
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${n + 2} ${n + 2}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="#0B1E3D"/></svg>`
  } catch { return '' }
}

// Simple Code-39 barcode as SVG (receipt number) — prints crisp on any printer
export function barcodeSVG(text) {
  const C = { '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
    'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
    'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
    'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn','Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','*':'nwnnwnwnn' }
  const s = '*' + String(text || '0').toUpperCase().replace(/[^0-9A-Z.\- ]/g, '-') + '*'
  let x = 0, bars = ''
  for (const ch of s) {
    const p = C[ch] || C['-']
    for (let i = 0; i < 9; i++) { const w = p[i] === 'w' ? 3 : 1; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="40" fill="#111"/>`; x += w }
    x += 1
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 40" width="${Math.min(x * 1.3, 240)}" height="38" preserveAspectRatio="none">${bars}</svg>`
}


// Turn a Fees.jsx line item ({kind, label, month, year, course, subtype, amount}) into a bill row
function itemRow(it, hostel) {
  const per = [it.month, it.year].filter(Boolean).join(' ')
  switch (it.kind) {
    case 'admission': return { particulars: 'Admission Fee', period: 'One-time', category: 'Admission' }
    case 'item':      return { particulars: it.label || 'Item', period: 'One-time', category: 'Kit / Items' }
    case 'flat':      return { particulars: 'Monthly Flat Fee', period: per || '—', category: hostel || 'Hostel' }
    case 'course':    return { particulars: `Course Fee${it.subtype ? ' — ' + it.subtype : ''}`, period: per || '—', category: it.course || 'Course' }
    case 'advance':   return { particulars: `Advance${it.label ? ' — ' + it.label : ''}`, period: '—', category: 'Advance' }
    default:          return { particulars: it.label || it.description || 'Fee', period: per || '—', category: it.category || '—' }
  }
}

// Instructions printed on every receipt — edit the wording here.
export const RECEIPT_INSTRUCTIONS = {
  payment: [
    'Monthly fees should be paid by the 10th of each month.',
    'Pay at the institute office in cash, or by UPI / bank transfer quoting the student\'s GCC No.',
    'For UPI or bank payments, share the transaction reference with the office — a payment is confirmed only when a receipt is issued.',
    'Clear any balance shown on this receipt at the earliest. Fees once paid are non-refundable and non-transferable.',
  ],
  receipt: [
    'Ask for a receipt for every payment. Do not pay any amount without a receipt.',
    'Check the name, GCC No., months and amount before leaving the counter; report any mistake to the office within 7 days.',
    'Keep all receipts safe for the whole session — they are needed for any fee query or certificate.',
    'A receipt is valid only with its receipt number and the name of the staff member who received the fee.',
  ],
}

const ST = { paid: ['PAID', '#047857', '#E7F6EC'], advance: ['ADV', '#0B5C8A', '#E6F1FB'], short: ['SHORT', '#9A5B00', '#FFF4DC'], due: ['DUE', '#B42318', '#FDE8E6'], upcoming: ['—', '#94A3B8', '#F8FAFC'], before: ['N/A', '#CBD5E1', '#F8FAFC'] }

// The "fee position" block: month strip, previous month, earlier receipts, balance.
function historyBlock(h) {
  if (!h) return ''
  const strip = h.months.map(m => {
    const [lab, ink, bg] = ST[m.status] || ST.upcoming
    const amt = m.status === 'due' ? money(m.due).replace('.00', '') : m.paidAmt ? money(m.paidAmt).replace('.00', '') : ''
    return `<td style="background:${m.thisReceipt ? '#0B1E3D' : bg};color:${m.thisReceipt ? '#E2C57E' : ink}"><div class="mm">${escH(m.month.slice(0, 3))} ${String(m.year).slice(2)}</div><div class="ms">${m.thisReceipt ? 'THIS' : lab}</div><div class="ma mono">${amt}</div></td>`
  }).join('')
  const pmv = h.previousMonth
  const pmText = pmv.status === 'due' ? `<b style="color:#B42318">Not paid — ₹${money(pmv.due)} due</b>`
    : pmv.payments.length ? `<b style="color:#047857">Paid ₹${money(pmv.paidAmt)}</b>${pmv.shortBy ? ` <span style="color:#9A5B00">(short ₹${money(pmv.shortBy)})</span>` : ''} · ${pmv.payments.map(p => `${escH(fmtDate(p.date))}${p.receipt ? `, Rcpt ${escH(p.receipt)}` : ''}${p.by ? `, received by <b>${escH(p.by)}</b>` : ''}`).join('; ')}`
    : pmv.status === 'before' ? 'Before admission' : pmv.status === 'upcoming' ? '—' : 'No payment recorded'
  const prev = h.previous.map(p => `<tr><td>${escH(fmtDate(p.date))}</td><td class="mono">${escH(p.receipt)}</td><td>${escH([...new Set(p.periods)].join(', '))}</td><td>${escH(p.mode || '—')}</td><td>${escH(p.by || '—')}</td><td class="r mono">${money(p.amount)}</td></tr>`).join('')
  return `
      <div class="hist">
        <div class="hh"><span>FEE POSITION · SESSION ${escH(String(h.session).replace(/^(\d{4})-\d{2}(\d{2})$/, '$1-$2'))}</span><span>Paid this session: <b>₹${money(h.sessionPaid)}</b></span></div>
        <table class="strip"><tbody><tr>${strip}</tr></tbody></table>
        <div class="pm"><span class="l">Previous month · ${escH(pmv.label)}</span><div>${pmText}</div></div>
        ${prev ? `<table class="prev"><thead><tr><th>Date</th><th>Receipt</th><th>For</th><th>Mode</th><th>Received by</th><th class="r">Amount (₹)</th></tr></thead><tbody>${prev}</tbody></table>` : '<div class="pm" style="border-top:none"><span class="l">Earlier payments</span><div>None — this is the first receipt.</div></div>'}
        <div class="bal ${h.dueAfter ? 'bad' : 'ok'}"><span>${h.dueAfter ? `Balance due after this receipt${h.dueMonths.length ? ` (${escH(h.dueMonths.join(', '))})` : ''}` : 'All fees due to date are cleared'}</span><b class="mono">₹ ${money(h.dueAfter)}</b></div>
      </div>`
}

// ── Shared receipt kit ───────────────────────────────────────────────────────
// Every printed receipt / voucher in the ERP uses these pieces so they look
// the same: letterhead, navy title band, A4 sheet, info grid, footer bar.
export const RECEIPT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;background:#EEF1F5;color:#111827;display:flex;flex-direction:column;align-items:center;padding:20px 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .mono{font-family:'JetBrains Mono',monospace}
  /* A4 = 210 × 297 mm; 8 mm print margins leave 194 × 281 mm — the sheet uses 279 mm so rounding never spills a blank page. */
  .sheet{width:194mm;max-width:100%;min-height:281mm;background:#fff;border:1px solid #D6DCE5;box-shadow:0 24px 60px rgba(15,23,42,.14);display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:14px;padding:16px 22px 12px}
  .logo{width:54px;height:54px;border-radius:12px;background:linear-gradient(145deg,#0B1E3D,#1F4E8C);color:#E2C57E;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:20px;font-weight:700;flex-shrink:0}
  .name{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#0B1E3D;line-height:1.15}
  .tagline{font-size:10px;color:#475569;letter-spacing:.06em;margin-top:3px;text-transform:uppercase;font-weight:600}
  .contact{margin-left:auto;text-align:right;font-size:10px;color:#475569;line-height:1.6}
  .contact b{color:#0B1E3D}
  .band{display:flex;justify-content:space-between;align-items:center;background:#0B1E3D;color:#fff;padding:7px 22px}
  .band .t{font-size:12.5px;font-weight:800;letter-spacing:.22em}
  .band .p{font-size:9.5px;font-weight:700;letter-spacing:.14em;color:#E2C57E;border:1px solid rgba(226,197,126,.6);padding:2px 10px;border-radius:999px}
  .accent{height:3px;background:linear-gradient(90deg,#0EA5A4,#1F4E8C 55%,#C9A24B)}
  .wrap{padding:12px 22px 14px;flex:1;display:flex;flex-direction:column}
  table{width:100%;border-collapse:collapse}
  .info td.c{border:1px solid #DCE3EC;padding:6px 10px;vertical-align:top;width:25%}
  .l{font-size:8.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748B}
  .v{font-size:12px;font-weight:700;color:#0F172A;margin-top:2px}
  .items{margin-top:10px}
  .items th{background:#F1F5F9;border:1px solid #DCE3EC;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#334155;padding:6px 9px;text-align:left}
  .items td{border:1px solid #DCE3EC;padding:7px 9px;font-size:12px}
  .r{text-align:right}
  .tot td{border:1px solid #DCE3EC;padding:5px 9px;font-size:11.5px}
  .tot .k{color:#475569;font-weight:600}
  .net td{background:#0B1E3D;color:#fff;font-weight:800;font-size:13px;border-color:#0B1E3D}
  .net .amt{color:#E2C57E;font-size:17px}
  .words{margin-top:8px;border:1px dashed #94A3B8;border-radius:6px;padding:7px 11px;font-size:11.5px}
  .stamp{margin:8px 0 0 50px;width:80px;height:80px;border-radius:50%;border:2.5px solid rgba(5,150,105,.55);color:rgba(5,150,105,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-14deg);font-weight:800;font-size:14px;letter-spacing:.12em}
  .stamp small{font-size:7.5px;letter-spacing:.12em;text-align:center}
  .hist{margin-top:12px;border:1px solid #DCE3EC;border-radius:8px;overflow:hidden}
  .hh{display:flex;justify-content:space-between;gap:10px;background:#F1F5F9;padding:6px 10px;font-size:9.5px;font-weight:800;letter-spacing:.1em;color:#334155}
  .hh span:last-child{letter-spacing:0;font-weight:600}
  .strip td{border:1px solid #fff;text-align:center;padding:4px 1px;width:8.33%}
  .strip .mm{font-size:9px;font-weight:800}.strip .ms{font-size:7.5px;font-weight:800;letter-spacing:.08em;margin-top:1px}.strip .ma{font-size:8.5px;margin-top:1px;min-height:10px}
  .pm{display:flex;gap:10px;align-items:baseline;padding:6px 10px;border-top:1px solid #E2E8F0;font-size:11px;flex-wrap:wrap}
  .prev th{background:#F8FAFC;font-size:8.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#475569;padding:4px 8px;text-align:left;border-top:1px solid #E2E8F0}
  .prev td{padding:4px 8px;font-size:10.5px;border-top:1px solid #F1F5F9}
  .bal{display:flex;justify-content:space-between;gap:10px;padding:7px 10px;font-size:11.5px;font-weight:700;border-top:1px solid #E2E8F0}
  .bal.bad{background:#FDF0EE;color:#B42318}.bal.ok{background:#EEF8F1;color:#047857}
  .instr{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
  .instr>div{border:1px solid #E6DCC3;background:#FFFCF4;border-radius:8px;padding:7px 10px}
  .instr h4{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7A5A14;margin-bottom:4px}
  .instr ol{padding-left:15px;font-size:9.6px;line-height:1.5;color:#334155}
  .instr li+li{margin-top:2px}
  .foot{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:auto;padding-top:14px}
  .note{font-size:9.5px;color:#64748B;line-height:1.65}
  .sig{text-align:center;min-width:150px}
  .sig .line{border-top:1px solid #0F172A;margin:30px 0 4px}
  .sig .who{font-size:11.5px;font-weight:800;color:#0F172A}
  .bottom{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #DCE3EC;padding:8px 22px;font-size:9px;color:#64748B;background:#F8FAFC;gap:10px}
  .btns{display:flex;gap:10px;justify-content:center;margin-top:14px}
  .btn{padding:10px 24px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;border:1px solid #0B1E3D}
  @page{size:A4 portrait;margin:8mm}
  @media print{html,body{margin:0;background:#fff;padding:0;display:block}.sheet{box-shadow:none;border:none;width:194mm;min-height:0;height:279mm;overflow:hidden;zoom:var(--fit,1);margin:0}.sheet+.sheet{break-before:page;margin-top:0}.btns{display:none}}
  .sheet+.sheet{margin-top:18px}
`

export const esc = escH
export { money, fmtDate }

// Letterhead + title band. title e.g. 'FEE RECEIPT'; tag e.g. 'ORIGINAL · PAID'.
// Institute name, address, phone, email, logo and year come from System
// Settings → Basic Info / Appearance (defaults below until set).
export function receiptHeader(title, tag = 'ORIGINAL') {
  const inst = getInstitute()
  const logo = /^https:\/\//.test(inst.logoUrl)
    ? `<div class="logo" style="background:#fff;padding:3px"><img src="${escH(inst.logoUrl)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:9px"/></div>`
    : '<div class="logo">GN</div>'
  return `
    <div class="top">
      ${logo}
      <div>
        <div class="name">${escH(inst.name)}</div>
        <div class="tagline">Residential Coaching · JNVST · AISSEE · RMS${inst.established ? ` · Est. ${escH(inst.established)}` : ''}</div>
      </div>
      <div class="contact"><b>${escH(inst.address)}</b>${inst.phone ? `<br/>📞 ${escH(inst.phone)}` : ''}${inst.email ? `<br/>✉ ${escH(inst.email)}` : ''}<br/>🌐 ${escH(inst.website)}</div>
    </div>
    <div class="band"><span class="t">${escH(title)}</span>${tag ? `<span class="p">${escH(tag)}</span>` : ''}</div>
    <div class="accent"></div>`
}

// Boxed label/value grid. rows: [[label, valueHTML, span?], …] per row (spans total 4).
export function infoGrid(rows) {
  return `<table class="info"><tbody>${rows.map(r => `<tr>${r.map(([l, v, span]) => `<td class="c"${span > 1 ? ` colspan="${span}"` : ''}><div class="l">${escH(l)}</div><div class="v">${v == null || v === '' ? '—' : v}</div></td>`).join('')}</tr>`).join('')}</tbody></table>`
}

export function receiptSheet(inner, footLeft, footRight) {
  const printed = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `<div class="sheet">${inner}<div class="bottom"><span>${footLeft ?? `Printed: ${escH(printed)}`}</span><span>${footRight ?? escH(getInstitute().name)}</span></div></div>`
}

// Full HTML document for one or more sheets; each sheet prints on its own A4
// page and shrinks to fit if its content is taller than the page.
export function receiptDocument(title, sheets, { extraCss = '', extraHead = '', printLabel = '🖨 Print' } = {}) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escH(title)}</title>${extraHead}<style>${RECEIPT_CSS}${extraCss}</style></head><body>
  ${sheets}
  <div class="btns"><button class="btn" style="background:#0B1E3D;color:#fff" onclick="window.print()">${printLabel}</button><button class="btn" style="background:#fff;color:#0B1E3D" onclick="window.close()">Close</button></div>
  <script>
  (function(){function fit(){var max=279*96/25.4;document.querySelectorAll('.sheet').forEach(function(s){s.style.setProperty('--fit','1');s.style.height='auto';s.style.minHeight='0';var h=s.scrollHeight;s.style.height='';s.style.minHeight='';s.style.setProperty('--fit',h>max?(max/h).toFixed(3):'1')})}fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);window.addEventListener('beforeprint',fit)})()
  </script>
  </body></html>`
}

// Open a print window synchronously (inside the click, so pop-up blockers
// allow it) and fill it with html — or a promise of html.
export function openReceiptWindow(title, html, { autoPrint = true } = {}) {
  const pw = window.open('', '_blank', 'width=860,height=1000,scrollbars=yes')
  if (pw) pw.document.write(`<p style="font:600 14px system-ui;color:#475569;padding:40px;text-align:center">Preparing ${escH(title)}…</p>`)
  Promise.resolve(html).then(h => {
    if (!pw) { window.open(URL.createObjectURL(new Blob([h], { type: 'text/html' })), '_blank'); return }
    pw.document.open(); pw.document.write(h); pw.document.close(); pw.document.title = title
    if (autoPrint) setTimeout(() => { try { pw.focus(); pw.print() } catch { /* window closed */ } }, 900)
  })
}

// One fee receipt sheet.
function feeReceiptSheet(d, hist) {
  const rows = (d.items || []).map(it => ({ ...(it.particulars ? it : itemRow(it, d.hostel_type)), amount: Number(it.amount || 0) }))
  const gross = rows.reduce((s, r) => s + r.amount, 0)
  const discount = Number(d.discount || 0)
  const net = d.total != null ? Number(d.total) : gross - discount
  const rno = d.receipt_no || '—'
  const cell = (l, v, extra = '') => `<td class="c"${extra}><div class="l">${l}</div><div class="v">${v}</div></td>`
  const bodyRows = rows.map((r, i) => `<tr><td>${i + 1}</td><td style="font-weight:700">${escH(r.particulars)}</td><td>${escH(r.period)}</td><td>${escH(r.category)}</td><td class="r mono" style="font-weight:700">${money(r.amount)}</td></tr>`).join('')
  const by = d.collected_by ? escH(d.collected_by) : '—'
  return receiptSheet(receiptHeader('FEE RECEIPT', 'ORIGINAL · PAID') + `
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px">
        <div><div class="l">Receipt No.</div><div class="mono" style="font-size:17px;font-weight:700;color:#0B1E3D;margin-top:2px">${escH(rno)}</div></div>
        <div style="text-align:center;display:flex;align-items:center;gap:10px">${receiptQrSVG(`${typeof location !== 'undefined' ? location.origin : ''}/?verifyReceipt=${encodeURIComponent(rno)}&gcc=${encodeURIComponent(d.gcc_no || '')}&amt=${net}`)}<div>${barcodeSVG(rno)}<div class="mono" style="font-size:8.5px;color:#64748B;margin-top:1px;letter-spacing:.2em">${escH(rno)}</div></div></div>
        <div style="text-align:right"><div class="l">Receipt Date</div><div style="font-size:13px;font-weight:700;margin-top:2px">${escH(fmtDate(d.pay_date))}</div></div>
      </div>
      <table class="info"><tbody>
        <tr>${cell('Student Name', escH(d.student_name), ' colspan="2"')}${cell('GCC No.', `<span class="mono">GCC-${escH(d.gcc_no)}</span>`)}${cell('Admission No.', escH(d.adm_no && d.adm_no !== '--' ? d.adm_no : '—'))}</tr>
        <tr>${cell('Class / Batch', escH(d.class_name || '—'))}${cell('Course', escH(d.course || '—'))}${cell('Hostel Type', escH(d.hostel_type || '—'))}${cell('Payment Mode', escH(d.pay_mode || '—'))}</tr>
        <tr>${cell('Fee received by (staff)', by, ' colspan="2"')}${cell('Transaction Ref.', d.txn_ref ? `<span class="mono">${escH(d.txn_ref)}</span>` : '—', ' colspan="2"')}</tr>
      </tbody></table>
      <table class="items"><thead><tr>
        <th style="width:40px">Sl.</th><th>Particulars</th><th style="width:120px">Period</th><th style="width:120px">Category</th><th class="r" style="width:110px">Amount (₹)</th>
      </tr></thead><tbody>${bodyRows || '<tr><td colspan="5" style="text-align:center;color:#94A3B8">—</td></tr>'}</tbody></table>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:-1px">
        <div class="stamp">PAID<small>GNSI · ${escH(fmtDate(d.pay_date))}</small></div>
        <table class="tot" style="width:300px"><tbody>
          <tr><td class="k">Gross Amount</td><td class="r mono">${money(gross)}</td></tr>
          <tr><td class="k">Concession / Discount</td><td class="r mono">${money(discount)}</td></tr>
          <tr class="net"><td>NET AMOUNT PAID</td><td class="r amt">₹ ${money(net)}</td></tr>
        </tbody></table>
      </div>
      <div class="words"><span class="l" style="margin-right:6px">Amount in words:</span><b>${amountInWords(net)}</b></div>
      ${historyBlock(hist)}
      <div class="instr">
        <div><h4>💳 Fee payment</h4><ol>${RECEIPT_INSTRUCTIONS.payment.map(x => `<li>${escH(x)}</li>`).join('')}</ol></div>
        <div><h4>🧾 Receipt collection</h4><ol>${RECEIPT_INSTRUCTIONS.receipt.map(x => `<li>${escH(x)}</li>`).join('')}</ol></div>
      </div>
      <div class="foot">
        <div class="note" style="font-style:italic">This is a computer-generated receipt.</div>
        <div class="sig"><div class="line"></div><div class="who">${by === '—' ? 'Accounts' : by}</div><div class="l">Received by (signature)</div></div>
      </div>
    </div>
`, undefined, `Thank you — wishing ${escH(d.student_name)} every success.`)
}

const withHistory = d => d.history !== undefined ? Promise.resolve(d.history)
  : import('./receiptHistory')
    .then(m => Promise.race([m.loadReceiptHistory(d), new Promise(r => setTimeout(() => r(null), 8000))]))
    .catch(e => { console.warn('Receipt history unavailable:', e); return null })

/**
 * printFeeReceipt({ receipt_no, pay_date, pay_mode, txn_ref, collected_by,
 *   student_name, adm_no, gcc_no, class_name, course, hostel_type,
 *   items:[{kind,label,month,year,course,subtype,amount} | {particulars,period,category,amount}],
 *   total, discount, photo_url, history })
 * Fits one A4 page. Adds the student's fee position (month strip, previous
 * month, earlier receipts with who received them, balance due) — loaded from
 * the fee tables unless `history` is passed (null = leave it out).
 */
export function printFeeReceipt(d) {
  const title = 'Receipt ' + (d.receipt_no || '—')
  openReceiptWindow(title, withHistory(d).then(h => receiptDocument(title, feeReceiptSheet(d, h), { printLabel: '🖨 Print receipt' })))
}

// Several fee receipts in one print job, one A4 page each (e.g. Bulk Admission).
export function printFeeReceipts(list, title = 'Fee receipts') {
  if (!list?.length) return
  openReceiptWindow(title, Promise.all(list.map(d => withHistory(d).then(h => feeReceiptSheet(d, h))))
    .then(sheets => receiptDocument(title, sheets.join(''), { printLabel: `🖨 Print ${list.length} receipt${list.length === 1 ? '' : 's'}` })))
}

// Convert the fee engine's receipt sections ({title, items:[{label, amount}]})
// into bill rows for the receipt above.
export function sectionsToItems(sections = [], hostelType = '') {
  const flag = l => [/ADVANCE/.test(l) && 'Advance', /UNDERPAID/.test(l) && 'Underpaid'].filter(Boolean).join(', ')
  const out = []
  for (const sec of sections) {
    const t = String(sec.title || '')
    for (const it of sec.items || []) {
      const l = String(it.label || ''), f = flag(l), base = l.split(' · ')[0]
      if (/^Monthly Flat/i.test(t)) {
        const m = base.match(/^(\S+ \d{4})/)
        out.push({ particulars: `Monthly Flat Fee${f ? ` (${f})` : ''}`, period: m ? m[1] : base, category: hostelType || 'Hostel', amount: it.amount })
      } else if (/^Course/i.test(t)) {
        const [crs, month] = l.split(' — ')
        out.push({ particulars: `Course Fee — ${crs.replace(' · ', ' ')}${f ? ` (${f})` : ''}`, period: (month || '').split(' · ')[0] || '—', category: 'Course', amount: it.amount })
      } else if (/^Advance/i.test(t)) {
        out.push({ particulars: l || 'Advance', period: '—', category: 'Advance', amount: it.amount })
      } else {
        out.push({ particulars: l || 'Fee', period: 'One-time', category: t || 'Admission & Kit', amount: it.amount })
      }
    }
  }
  return out
}

// ── Accounts voucher (receipt voucher for income, payment voucher for expense) ──
export function printAccountVoucher(item, { party = '' } = {}) {
  const isIncome = item.type === 'Income'
  const title = isIncome ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'
  const vno = item.voucher_no || item.id || '—'
  const amt = Number(item.amount || 0)
  const who = party || item.voucher_head || ''
  const body = `
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px">
        <div><div class="l">Voucher No.</div><div class="mono" style="font-size:17px;font-weight:700;color:#0B1E3D;margin-top:2px">${escH(vno)}</div></div>
        <div style="text-align:center">${barcodeSVG(String(vno))}</div>
        <div style="text-align:right"><div class="l">Voucher Date</div><div style="font-size:13px;font-weight:700;margin-top:2px">${escH(fmtDate(item.entry_date))}</div></div>
      </div>
      ${infoGrid([
        [[isIncome ? 'Received from' : 'Paid to', escH(who || '—'), 2], ['Type', escH(item.type)], ['Status', escH(item.status || 'Confirmed')]],
        [['Head / Category', escH([item.category, item.sub_category].filter(Boolean).join(' › ') || '—'), 2], ['Account', escH(item.account_type || 'Cash A/c')], ['Payment Mode', escH(item.payment_mode || '—')]],
        [['Entered by (staff)', escH(item.added_by || item.edited_by || '—'), 2], [isIncome ? 'Date received' : 'Date paid', escH(fmtDate(item.payment_date || item.entry_date))], ['Recurring', item.is_recurring ? 'Yes' : 'No']],
      ])}
      <table class="items"><thead><tr><th style="width:40px">Sl.</th><th>Particulars</th><th class="r" style="width:130px">Amount (₹)</th></tr></thead>
        <tbody><tr><td>1</td><td style="font-weight:700">${escH(item.note || item.description || item.category || '—')}</td><td class="r mono" style="font-weight:700">${money(amt)}</td></tr></tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:-1px">
        <table class="tot" style="width:300px"><tbody><tr class="net"><td>${isIncome ? 'AMOUNT RECEIVED' : 'AMOUNT PAID'}</td><td class="r amt">₹ ${money(amt)}</td></tr></tbody></table>
      </div>
      <div class="words"><span class="l" style="margin-right:6px">Amount in words:</span><b>${amountInWords(amt)}</b></div>
      ${item.receipt_url ? `<div class="words" style="border-style:solid"><span class="l" style="margin-right:6px">Bill / proof attached:</span><span class="mono" style="font-size:10px;word-break:break-all">${escH(item.receipt_url)}</span></div>` : ''}
      <div class="foot" style="padding-top:40px">
        <div class="sig"><div class="line"></div><div class="who">${escH(item.added_by || '—')}</div><div class="l">Prepared by</div></div>
        <div class="sig"><div class="line"></div><div class="who">${escH(who || ' ')}</div><div class="l">${isIncome ? 'Paid by' : 'Received by (payee)'}</div></div>
        <div class="sig"><div class="line"></div><div class="who">&nbsp;</div><div class="l">Authorised signatory</div></div>
      </div>
    </div>`
  const doc = receiptDocument(`${title} ${vno}`, receiptSheet(receiptHeader(title, isIncome ? 'INCOME' : 'EXPENDITURE') + body), { extraCss: `.band .p{color:${isIncome ? '#86EFAC' : '#FCA5A5'};border-color:currentColor}.net .amt{color:#E2C57E}.foot .sig{min-width:0;flex:1}`, printLabel: '🖨 Print voucher' })
  openReceiptWindow(`${title} ${vno}`, doc)
}

// ── Store sales bill ─────────────────────────────────────────────────────────
export const STORE_BILL_NOTES = [
  'Goods once sold are exchangeable only with this bill, within 7 days, in unused condition.',
  'Please check the items and the balance returned before leaving the counter.',
  'Any balance shown as due is added to the student\'s account and must be cleared with the fees.',
]

export function printStoreBill(sale) {
  const items = Array.isArray(sale.items) ? sale.items : Array.isArray(sale.store_sale_items) ? sale.store_sale_items : []
  const bno = sale.bill_no || '—'
  const due = Number(sale.due_amount || 0)
  const rows = items.map((i, k) => `<tr><td>${k + 1}</td><td style="font-weight:700">${escH(i.name)}</td><td>${escH(i.size || '—')}</td><td class="r mono">${Number(i.qty || 0)}</td><td class="r mono">${money(i.price)}</td><td class="r mono" style="font-weight:700">${money(i.amount)}</td></tr>`).join('')
  const line = (k, v, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><td class="k">${k}</td><td class="r mono">${v}</td></tr>`
  const body = `
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px">
        <div><div class="l">Bill No.</div><div class="mono" style="font-size:17px;font-weight:700;color:#0B1E3D;margin-top:2px">${escH(bno)}</div></div>
        <div style="text-align:center">${barcodeSVG(bno)}<div class="mono" style="font-size:8.5px;color:#64748B;margin-top:1px;letter-spacing:.2em">${escH(bno)}</div></div>
        <div style="text-align:right"><div class="l">Bill Date</div><div style="font-size:13px;font-weight:700;margin-top:2px">${escH(fmtDate(sale.sale_date))}</div></div>
      </div>
      ${infoGrid([
        [['Customer', escH(sale.customer_name || 'Walk-in customer'), 2], ['GCC No.', sale.gcc_no ? `<span class="mono">GCC-${escH(sale.gcc_no)}</span>` : '—'], ['Phone', escH(sale.phone || '—')]],
        [['Billed by (staff)', escH(sale.collected_by || '—'), 2], ['Payment Mode', escH(sale.pay_mode || (Number(sale.amount_paid) > 0 ? '—' : 'On account'))], ['Transaction Ref.', sale.txn_ref ? `<span class="mono">${escH(sale.txn_ref)}</span>` : '—']],
      ])}
      <table class="items"><thead><tr><th style="width:40px">Sl.</th><th>Item</th><th style="width:90px">Size</th><th class="r" style="width:60px">Qty</th><th class="r" style="width:100px">Rate (₹)</th><th class="r" style="width:110px">Amount (₹)</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94A3B8">—</td></tr>'}</tbody></table>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:-1px">
        <div class="stamp" style="${due > 0 ? `border-color:rgba(${Number(sale.amount_paid) ? '154,91,0' : '180,35,24'},.55);color:rgba(${Number(sale.amount_paid) ? '154,91,0' : '180,35,24'},.85);${Number(sale.amount_paid) ? 'font-size:11.5px' : ''}` : ''}">${due > 0 ? (Number(sale.amount_paid) ? 'PART PAID' : 'DUE') : 'PAID'}<small>GNSI STORE · ${escH(fmtDate(sale.sale_date))}</small></div>
        <table class="tot" style="width:300px"><tbody>
          ${line('Subtotal', money(sale.subtotal ?? items.reduce((s, i) => s + Number(i.amount || 0), 0)))}
          ${Number(sale.discount) > 0 ? line('Discount', '− ' + money(sale.discount)) : ''}
          <tr class="net"><td>TOTAL</td><td class="r amt">₹ ${money(sale.total)}</td></tr>
          ${line('Amount paid', money(sale.amount_paid))}
          ${Number(sale.tendered) > 0 ? line('Cash tendered', money(sale.tendered)) + line('Change returned', money(sale.change)) : ''}
          ${due > 0 ? `<tr><td class="k" style="color:#B42318;font-weight:800">Balance due (student account)</td><td class="r mono" style="color:#B42318;font-weight:800">${money(due)}</td></tr>` : ''}
        </tbody></table>
      </div>
      <div class="words"><span class="l" style="margin-right:6px">Amount in words:</span><b>${amountInWords(sale.total)}</b></div>
      ${Number(sale.points_earned) > 0 ? `<div class="words" style="border-style:solid;border-color:#E9D9B0;background:#FFFCF4">⭐ <b>${Number(sale.points_earned)}</b> loyalty points earned on this bill.</div>` : ''}
      <div class="instr" style="grid-template-columns:1fr"><div><h4>🛍️ Store policy</h4><ol>${STORE_BILL_NOTES.map(x => `<li>${escH(x)}</li>`).join('')}</ol></div></div>
      <div class="foot">
        <div class="note" style="font-style:italic">This is a computer-generated bill.</div>
        <div class="sig"><div class="line"></div><div class="who">${escH(sale.collected_by || 'GNSI Store')}</div><div class="l">Billed by (signature)</div></div>
      </div>
    </div>`
  const title = 'Bill ' + bno
  openReceiptWindow(title, receiptDocument(title, receiptSheet(receiptHeader('SALES BILL', due > 0 ? 'GNSI STORE · BALANCE DUE' : 'GNSI STORE · PAID') + body, undefined, 'Thank you for shopping at the GNSI Store.'), { printLabel: '🖨 Print bill' }), { autoPrint: true })
}
