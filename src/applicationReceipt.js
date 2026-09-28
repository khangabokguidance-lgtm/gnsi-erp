// applicationReceipt.js — the admission application receipt, in the same
// letterhead / A4 design as every other printed receipt (premiumReceipt.js),
// with a scannable QR code and the applicant's photo.
import { receiptDocument, receiptSheet, receiptHeader, infoGrid, openReceiptWindow, esc } from './premiumReceipt'

export function printApplicationReceipt(a, { exams = [], reg: rg = null } = {}) {
  const now = new Date()
  const submittedAt = now.toLocaleString('en-IN', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
  // Deterministic from GCC + session, so a reprint shows the same number.
  const serialNo = `GNSI/${a.session || now.getFullYear()}/ADM/${String(a.gcc).padStart(5,'0')}`
  const e = esc
  const dob = a.dob ? new Date(a.dob).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}) : ''
  let examGrid = ''
  if (exams.length && rg) {
    examGrid = `<div class="sect">Entrance examination particulars</div>` + infoGrid([
      [['Examination', e(exams.join(' + ') + ' · Class ' + rg.targetClass), 2], ['Medium', e(rg.medium)], ['Domicile / Area', e([rg.domicileState, rg.area].filter(Boolean).join(' · '))]],
      [['Category', e([a.category !== '--' ? a.category : '', rg.defence !== 'None' ? 'Defence (' + rg.defence + ')' : '', rg.divyang !== 'None' ? 'PwD' : ''].filter(Boolean).join(' · ')), 2],
       exams.includes('AISSEE') ? ['AISSEE', e([rg.aissee.status, rg.aissee.appNo && 'App. No. ' + rg.aissee.appNo].filter(Boolean).join(' · '))] : ['AISSEE', 'N/A'],
       exams.includes('JNVST') ? ['JNVST', e([rg.jnvst.status, rg.jnvst.regNo && 'Reg. No. ' + rg.jnvst.regNo, rg.jnvst.jnv].filter(Boolean).join(' · '))] : ['JNVST', 'N/A']],
    ])
  }
  const body = `
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:10px">
        <div><div class="l">GCC Registration No.</div><div class="mono" style="font-size:22px;font-weight:700;color:#0B1E3D;margin-top:2px">GCC-${e(a.gcc)}</div>
          <div class="l" style="margin-top:8px">Reference</div><div class="mono" style="font-size:11px;font-weight:700;margin-top:2px">${e(serialNo)}</div></div>
        <div id="qrBox" style="width:84px;height:84px;display:flex;align-items:center;justify-content:center;border:1px solid #DCE3EC;border-radius:6px;font-size:9px;color:#94A3B8">QR</div>
        <div style="width:84px;height:104px;border:1px solid #DCE3EC;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94A3B8;text-align:center">${a.photoUrl ? `<img src="${e(a.photoUrl)}" alt="Photo" style="width:100%;height:100%;object-fit:cover"/>` : 'Photo not<br/>uploaded'}</div>
      </div>
      <div class="sect">Applicant particulars</div>
      ${infoGrid([
        [['Applicant name', e(a.name), 2], ['Admission No.', e(a.admNo || 'Pending')], ['Date of birth', e(dob)]],
        [["Father's name", e(a.father), 2], ["Mother's name", e(a.mother)], ['Gender', e(a.gender)]],
        [['Phone', e(a.phone), 2], ['Application status', e(a.status || 'Applied')], ['Submitted on', e(submittedAt)]],
      ])}
      <div class="sect">Admission particulars</div>
      ${infoGrid([
        [['Course', e(a.course ? `${a.course}${a.subtype ? ' – ' + a.subtype : ''}` : ''), 2], ['Class / Batch', e(a.cls)], ['Academic session', e(a.session)]],
        [['House / Block', e(a.house), 2], ['Hostel type', e(a.hostel_type), 2]],
      ])}
      ${examGrid}
      <div class="words" style="margin-top:12px;line-height:1.55"><b>This receipt confirms your application has been formally received by the Institute.</b>
        Please keep it, and quote the GCC Registration No. above in all future correspondence, fee payments and enquiries at the admission office.</div>
      <div class="foot">
        <div class="sig"><div style="width:84px;height:84px;border:1.5px dashed #94A3B8;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94A3B8;margin:0 auto">Office seal</div></div>
        <div class="sig"><div class="line"></div><div class="l">Admission Officer</div></div>
      </div>
    </div>`
  const qr = `<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>
    try { var q=document.getElementById('qrBox'); q.innerHTML=''; new QRCode(q, { text: ${JSON.stringify(`GNSI Application Receipt | Ref: ${serialNo} | GCC: ${a.gcc} | ${a.name}`)}, width: 76, height: 76, colorDark: '#0B1E3D', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }) } catch (err) { console.error('QR generation failed', err) }
  </script>`
  const title = `Application Receipt – ${a.name}`
  const doc = receiptDocument(title, receiptSheet(receiptHeader('APPLICATION RECEIPT', 'ORIGINAL'), undefined, 'System-generated receipt · GNSI Admission Portal').replace('<div class="bottom">', body + '<div class="bottom">'),
    { extraCss: '.sect{margin:12px 0 5px;font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7A5A14}', printLabel: '🖨 Print / Save PDF' })
    .replace('</body>', qr + '</body>')
  openReceiptWindow(title, doc, { autoPrint: false })
}
