// ════════════════════════════════════════════════════════════════════════
//  premiumReceipt.js — the ONE fee-receipt design used everywhere
//  (Fees → Collect, Student Fee Ledger → Receipt). Hospital-style layout:
//  letterhead · FEE RECEIPT bar · barcode · boxed student grid · itemised
//  bill · gross / concession / NET PAID · amount in words · PAID stamp.
// ════════════════════════════════════════════════════════════════════════
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
    'Monthly fees for the April–March session should be paid by the 10th of each month.',
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

function receiptHTML(d, hist) {
  const rows = (d.items || []).map(it => ({ ...(it.particulars ? it : itemRow(it, d.hostel_type)), amount: Number(it.amount || 0) }))
  const gross = rows.reduce((s, r) => s + r.amount, 0)
  const discount = Number(d.discount || 0)
  const net = d.total != null ? Number(d.total) : gross - discount
  const rno = d.receipt_no || '—'
  const printed = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const cell = (l, v, extra = '') => `<td class="c"${extra}><div class="l">${l}</div><div class="v">${v}</div></td>`
  const bodyRows = rows.map((r, i) => `<tr><td>${i + 1}</td><td style="font-weight:700">${escH(r.particulars)}</td><td>${escH(r.period)}</td><td>${escH(r.category)}</td><td class="r mono" style="font-weight:700">${money(r.amount)}</td></tr>`).join('')
  const by = d.collected_by ? escH(d.collected_by) : '—'

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${escH(rno)}</title><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;background:#EEF1F5;color:#111827;display:flex;flex-direction:column;align-items:center;padding:20px 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .mono{font-family:'JetBrains Mono',monospace}
  /* A4 = 210 × 297 mm; 8 mm print margins leave 194 × 281 mm for the sheet. */
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
  @media print{body{background:#fff;padding:0;display:block}.sheet{box-shadow:none;border:none;width:194mm;min-height:0;height:281mm;overflow:hidden;zoom:var(--fit,1)}.btns{display:none}}
  </style></head><body>
  <div class="sheet" id="sheet">
    <div class="top">
      <div class="logo">GN</div>
      <div>
        <div class="name">Guidance Navodaya &amp; Sainik Institute</div>
        <div class="tagline">Residential Coaching · JNVST · AISSEE · RMS · Est. 2016</div>
      </div>
      <div class="contact"><b>Khangabok, Thoubal, Manipur</b><br/>📞 +91 89742 98074<br/>🌐 guidancekhangabok.in</div>
    </div>
    <div class="band"><span class="t">FEE RECEIPT</span><span class="p">ORIGINAL · PAID</span></div>
    <div class="accent"></div>
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px">
        <div><div class="l">Receipt No.</div><div class="mono" style="font-size:17px;font-weight:700;color:#0B1E3D;margin-top:2px">${escH(rno)}</div></div>
        <div style="text-align:center">${barcodeSVG(rno)}<div class="mono" style="font-size:8.5px;color:#64748B;margin-top:1px;letter-spacing:.2em">${escH(rno)}</div></div>
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
    <div class="bottom"><span>Printed: ${escH(printed)}</span><span>Thank you — wishing ${escH(d.student_name)} every success.</span></div>
  </div>
  <div class="btns"><button class="btn" style="background:#0B1E3D;color:#fff" onclick="window.print()">🖨 Print receipt</button><button class="btn" style="background:#fff;color:#0B1E3D" onclick="window.close()">Close</button></div>
  <script>
  // Keep the receipt on ONE A4 page: if the content is taller than the
  // printable area (281 mm), shrink it to fit when printing.
  (function(){var s=document.getElementById('sheet');function fit(){s.style.height='auto';s.style.minHeight='0';var h=s.scrollHeight,max=281*96/25.4;s.style.height='';s.style.minHeight='';document.documentElement.style.setProperty('--fit',h>max?(max/h).toFixed(3):'1')}fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);window.addEventListener('beforeprint',fit)})()
  </script>
  </body></html>`
}

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
  const rno = d.receipt_no || '—'
  // Open the window now (inside the click) so pop-up blockers allow it, then fill it.
  const pw = window.open('', '_blank', 'width=860,height=1000,scrollbars=yes')
  const write = hist => {
    const html = receiptHTML(d, hist)
    if (!pw) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
    pw.document.open(); pw.document.write(html); pw.document.close(); pw.document.title = 'Receipt ' + rno
    setTimeout(() => { try { pw.focus(); pw.print() } catch { /* window closed */ } }, 900)
  }
  if (pw) pw.document.write(`<p style="font:600 14px system-ui;color:#475569;padding:40px;text-align:center">Preparing receipt ${escH(rno)}…</p>`)
  if (d.history !== undefined) { write(d.history); return }
  import('./receiptHistory')
    .then(m => Promise.race([m.loadReceiptHistory(d), new Promise(r => setTimeout(() => r(null), 8000))]))
    .catch(e => { console.warn('Receipt history unavailable:', e); return null })
    .then(write)
}
