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

/**
 * printFeeReceipt({ receipt_no, pay_date, pay_mode, txn_ref, collected_by,
 *   student_name, adm_no, gcc_no, class_name, course, hostel_type,
 *   items:[{kind,label,month,year,course,subtype,amount} | {particulars,period,category,amount}],
 *   total, discount, photo_url })
 */
export function printFeeReceipt(d) {
  const rows = (d.items || []).map(it => ({ ...(it.particulars ? it : itemRow(it, d.hostel_type)), amount: Number(it.amount || 0) }))
  const gross = rows.reduce((s, r) => s + r.amount, 0)
  const discount = Number(d.discount || 0)
  const net = d.total != null ? Number(d.total) : gross - discount
  const rno = d.receipt_no || '—'
  const printed = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const cell = (l, v, extra = '') => `<td class="c"${extra}><div class="l">${l}</div><div class="v">${v}</div></td>`
  const bodyRows = rows.map((r, i) => `<tr><td>${i + 1}</td><td style="font-weight:700">${escH(r.particulars)}</td><td>${escH(r.period)}</td><td>${escH(r.category)}</td><td class="r mono" style="font-weight:700">${money(r.amount)}</td></tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${escH(rno)}</title><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;background:#EEF1F5;color:#111827;display:flex;flex-direction:column;align-items:center;padding:26px 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .mono{font-family:'JetBrains Mono',monospace}
  .sheet{width:780px;max-width:100%;background:#fff;border:1px solid #D6DCE5;box-shadow:0 24px 60px rgba(15,23,42,.14)}
  .top{display:flex;align-items:center;gap:16px;padding:22px 28px 16px}
  .logo{width:60px;height:60px;border-radius:14px;background:linear-gradient(145deg,#0B1E3D,#1F4E8C);color:#E2C57E;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:22px;font-weight:700;flex-shrink:0}
  .name{font-family:'Playfair Display',serif;font-size:21px;font-weight:700;color:#0B1E3D;line-height:1.15}
  .tagline{font-size:10.5px;color:#475569;letter-spacing:.06em;margin-top:3px;text-transform:uppercase;font-weight:600}
  .contact{margin-left:auto;text-align:right;font-size:10.5px;color:#475569;line-height:1.65}
  .contact b{color:#0B1E3D}
  .band{display:flex;justify-content:space-between;align-items:center;background:#0B1E3D;color:#fff;padding:9px 28px}
  .band .t{font-size:13px;font-weight:800;letter-spacing:.22em}
  .band .p{font-size:10px;font-weight:700;letter-spacing:.14em;color:#E2C57E;border:1px solid rgba(226,197,126,.6);padding:3px 10px;border-radius:999px}
  .accent{height:3px;background:linear-gradient(90deg,#0EA5A4,#1F4E8C 55%,#C9A24B)}
  .wrap{padding:18px 28px 22px}
  table{width:100%;border-collapse:collapse}
  .info td.c{border:1px solid #DCE3EC;padding:8px 12px;vertical-align:top;width:25%}
  .l{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748B}
  .v{font-size:12.5px;font-weight:700;color:#0F172A;margin-top:3px}
  .items{margin-top:16px}
  .items th{background:#F1F5F9;border:1px solid #DCE3EC;font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#334155;padding:8px 10px;text-align:left}
  .items td{border:1px solid #DCE3EC;padding:10px;font-size:12.5px}
  .r{text-align:right}
  .tot td{border:1px solid #DCE3EC;padding:7px 10px;font-size:12px}
  .tot .k{color:#475569;font-weight:600}
  .net td{background:#0B1E3D;color:#fff;font-weight:800;font-size:14px;border-color:#0B1E3D}
  .net .amt{color:#E2C57E;font-size:18px}
  .words{margin-top:12px;border:1px dashed #94A3B8;border-radius:6px;padding:9px 12px;font-size:12px}
  .stamp{margin:14px 0 0 60px;width:92px;height:92px;border-radius:50%;border:2.5px solid rgba(5,150,105,.55);color:rgba(5,150,105,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-14deg);font-weight:800;font-size:15px;letter-spacing:.12em}
  .stamp small{font-size:8px;letter-spacing:.14em;text-align:center}
  .foot{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:18px}
  .note{font-size:9.8px;color:#64748B;line-height:1.7}
  .sig{text-align:center;min-width:170px}
  .sig .line{border-top:1px solid #0F172A;margin:34px 0 5px}
  .bottom{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #DCE3EC;padding:10px 28px;font-size:9.5px;color:#64748B;background:#F8FAFC;gap:10px}
  .btns{display:flex;gap:10px;justify-content:center;margin-top:16px}
  .btn{padding:10px 24px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;border:1px solid #0B1E3D}
  @page{size:A4;margin:10mm}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;width:100%}.btns{display:none}}
  </style></head><body>
  <div class="sheet">
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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px">
        <div><div class="l">Receipt No.</div><div class="mono" style="font-size:18px;font-weight:700;color:#0B1E3D;margin-top:2px">${escH(rno)}</div></div>
        <div style="text-align:center">${barcodeSVG(rno)}<div class="mono" style="font-size:9px;color:#64748B;margin-top:2px;letter-spacing:.2em">${escH(rno)}</div></div>
        <div style="text-align:right"><div class="l">Receipt Date</div><div style="font-size:13px;font-weight:700;margin-top:2px">${escH(fmtDate(d.pay_date))}</div></div>
      </div>
      <table class="info"><tbody>
        <tr>${cell('Student Name', escH(d.student_name), ' colspan="2"')}${cell('GCC No.', `<span class="mono">GCC-${escH(d.gcc_no)}</span>`)}${cell('Admission No.', escH(d.adm_no && d.adm_no !== '--' ? d.adm_no : '—'))}</tr>
        <tr>${cell('Class / Batch', escH(d.class_name || '—'))}${cell('Course', escH(d.course || '—'))}${cell('Hostel Type', escH(d.hostel_type || '—'))}${cell('Payment Mode', escH(d.pay_mode || '—'))}</tr>
        ${d.txn_ref ? `<tr>${cell('Transaction Ref.', `<span class="mono">${escH(d.txn_ref)}</span>`, ' colspan="4"')}</tr>` : ''}
      </tbody></table>
      <table class="items"><thead><tr>
        <th style="width:44px">Sl.</th><th>Particulars</th><th style="width:130px">Period</th><th style="width:130px">Category</th><th class="r" style="width:120px">Amount (₹)</th>
      </tr></thead><tbody>${bodyRows || '<tr><td colspan="5" style="text-align:center;color:#94A3B8">—</td></tr>'}</tbody></table>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:-1px">
        <div class="stamp">PAID<small>GNSI · ${escH(fmtDate(d.pay_date))}</small></div>
        <table class="tot" style="width:320px"><tbody>
          <tr><td class="k">Gross Amount</td><td class="r mono">${money(gross)}</td></tr>
          <tr><td class="k">Concession / Discount</td><td class="r mono">${money(discount)}</td></tr>
          <tr class="net"><td>NET AMOUNT PAID</td><td class="r amt">₹ ${money(net)}</td></tr>
        </tbody></table>
      </div>
      <div class="words"><span class="l" style="margin-right:6px">Amount in words:</span><b>${amountInWords(net)}</b></div>
      <div class="foot">
        <div class="note"><b style="color:#0F172A">Terms</b><br/>
          1. Fees once paid are non-refundable and non-transferable.<br/>
          2. Please preserve this receipt; it is required for any fee query.<br/>
          3. This is a computer-generated receipt.</div>
        <div class="sig"><div class="line"></div><div class="l">Received by${d.collected_by ? ' · ' + escH(d.collected_by) : ' (Accounts)'}</div></div>
      </div>
    </div>
    <div class="bottom"><span>Printed: ${escH(printed)}</span><span>Thank you — wishing ${escH(d.student_name)} every success.</span></div>
  </div>
  <div class="btns"><button class="btn" style="background:#0B1E3D;color:#fff" onclick="window.print()">🖨 Print receipt</button><button class="btn" style="background:#fff;color:#0B1E3D" onclick="window.close()">Close</button></div>
  </body></html>`

  const pw = window.open('', '_blank', 'width=860,height=980,scrollbars=yes')
  if (!pw) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  pw.document.write(html); pw.document.close(); pw.document.title = 'Receipt ' + rno
  setTimeout(() => { try { pw.focus(); pw.print() } catch (_) {} }, 700)
}
