// admissionConfirmation.js — the printed "Admission Confirmation & Registration Form" given to the family once a student
// is enrolled: GCC number, student / parent / admission particulars, admission fee paid, documents received, undertaking
// and signature blocks. Same letterhead and A4 design system as every other receipt (premiumReceipt.js).
import { receiptDocument, receiptSheet, receiptHeader, infoGrid, openReceiptWindow, receiptQrSVG, amountInWords, esc, fmtDate } from './premiumReceipt'
import { getInstitute } from './systemSettings'

const ADM_DOCS = ['Birth Certificate', 'Aadhaar Card', 'Passport Photo', 'Mark Sheet', 'Transfer Certificate', 'Medical Certificate', 'Caste Certificate', 'Address Proof']
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN')

const UNDERTAKING = [
  'The particulars given in the admission form are true and complete. Admission is subject to verification of the original documents; a false statement can lead to cancellation of admission.',
  'The student will follow the rules, timetable and code of conduct of the Institute and, for boarders, the hostel rules, and will respect the staff and fellow students.',
  'Fees are payable as per the fee schedule of the Institute and every payment is acknowledged by a numbered receipt. Refunds and transfers are governed by the Institute\'s published fee policy.',
  'The parent / guardian will keep the Institute informed of any change of address or telephone number and will attend meetings called by the Institute.',
  'The Institute may use the student\'s photograph and results for the Institute\'s records and, with consent, for publication.',
]

// d: { app, student, fees: [{ description, amount_paid, receipt_no, pay_date, pay_mode, fee_type }], rates: { flatFee, courseFee }|null, photo }
export function admissionConfirmationHtml({ app, student, fees = [], rates = null, photo = '' }) {
  const e = esc
  const inst = getInstitute()
  const gcc = String(app.gcc || student?.gcc_no || '')
  const session = app.session || student?.session || ''
  const refNo = `GNSI/${session || new Date().getFullYear()}/ADM-CONF/${gcc.padStart(5, '0')}`
  const admDate = student?.admission_date || fees.map(f => f.pay_date).filter(Boolean).sort()[0] || ''
  const dob = app.dob ? fmtDate(app.dob) : ''
  const paid = fees.filter(f => !f.reverted)
  const total = paid.reduce((t, f) => t + (Number(f.amount_paid) || 0), 0)
  const have = new Set(app.docs || [])
  const course = app.course ? `${app.course}${app.subtype ? ' – ' + app.subtype : ''}` : ''
  const qrText = `GNSI Admission Confirmation | Ref ${refNo} | GCC-${gcc} | ${app.name} | ${session}`

  const feeRows = paid.length
    ? paid.map((f, i) => `<tr><td>${i + 1}</td><td style="font-weight:700">${e(f.description || (f.fee_type === 'admission' ? 'Admission fee' : f.fee_type) || 'Fee')}</td><td>${e(fmtDate(f.pay_date))}</td><td>${e(f.pay_mode || '—')}</td><td class="mono">${e(f.receipt_no || '—')}</td><td class="r mono" style="font-weight:700">${e(Number(f.amount_paid || 0).toLocaleString('en-IN'))}</td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#64748B;padding:12px">No admission fee has been recorded yet.</td></tr>'

  const page1 = receiptSheet(receiptHeader('ADMISSION CONFIRMATION & REGISTRATION FORM', 'OFFICIAL COPY') + `
    <div class="wrap">
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:6px">
        <div style="flex:1">
          <div class="l">GCC Registration No.</div><div class="mono" style="font-size:24px;font-weight:700;color:#0B1E3D;margin-top:2px">GCC-${e(gcc)}</div>
          <div class="l" style="margin-top:8px">Reference</div><div class="mono" style="font-size:11px;font-weight:700;margin-top:2px">${e(refNo)}</div>
        </div>
        <div style="text-align:center">${receiptQrSVG(qrText, 78)}<div class="l" style="margin-top:3px">Scan to verify</div></div>
        <div style="width:92px;height:114px;border:1px solid #DCE3EC;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94A3B8;text-align:center">${photo ? `<img src="${e(photo)}" alt="" style="width:100%;height:100%;object-fit:cover">` : 'Affix passport photograph'}</div>
      </div>
      <div style="background:#EEF8F1;border:1px solid #BFE3CC;border-radius:6px;padding:8px 12px;font-size:11.5px;color:#14532D;margin:4px 0 2px"><b>Admission confirmed.</b> ${e(app.name)} has been admitted to ${e(inst.name)} for the session ${e(session)}${admDate ? `, with effect from ${e(fmtDate(admDate))}` : ''}.</div>

      <div class="sect">Student particulars</div>
      ${infoGrid([
        [['Name of student', e(app.name), 2], ['Admission No.', e(app.admNo || '—')], ['Date of birth', e(dob)]],
        [['Gender', e(app.gender)], ['Blood group', e(app.blood)], ['Category', e(app.category && app.category !== '--' ? app.category : '')], ['Religion', e(app.religion && app.religion !== '--' ? app.religion : '')]],
        [['Previous school', e(app.prevSchool), 2], ['Mother tongue', e(app.motherTongue && app.motherTongue !== '--' ? app.motherTongue : '')], ['Date of admission', e(admDate ? fmtDate(admDate) : '')]],
      ])}
      <div class="sect">Parent / guardian & contact</div>
      ${infoGrid([
        [["Father's name", e(app.father), 2], ["Mother's name", e(app.mother), 2]],
        [['Mobile', e(app.phone)], ['WhatsApp', e(app.whatsapp)], ['Emergency contact', e([app.emergencyName, app.emergencyRel && `(${app.emergencyRel})`, app.emergencyPhone].filter(Boolean).join(' '), ), 2]],
        [['Address', e(app.address), 4]],
      ])}
      <div class="sect">Admission particulars</div>
      ${infoGrid([
        [['Course', e(course), 2], ['Class / Batch', e(app.cls)], ['Academic session', e(session)]],
        [['House / Block', e(app.house)], ['Hostel type', e(app.hostel_type)], ['Bed / Room', e(app.bedNumber)], ['Instalment plan', e(app.instalmentPlan)]],
        ...(rates && (rates.flatFee || rates.courseFee) ? [[['Monthly flat (hostel/boarding) fee', e(rates.flatFee ? inr(rates.flatFee) : '—'), 2], ['Monthly course fee', e(rates.courseFee ? inr(rates.courseFee) : '—'), 2]]] : []),
      ])}

      <div class="sect">Admission fee received</div>
      <table class="items" style="margin-top:4px"><thead><tr><th style="width:34px">Sl.</th><th>Particulars</th><th style="width:96px">Date</th><th style="width:80px">Mode</th><th style="width:120px">Receipt no.</th><th class="r" style="width:96px">Amount (₹)</th></tr></thead>
        <tbody>${feeRows}</tbody></table>
      ${paid.length ? `<div class="words"><b>Total received: ${e(inr(total))}</b> — ${e(amountInWords(total))}</div>` : ''}

      <div class="sect">Documents received</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px 10px;font-size:10.5px;margin-top:4px">
        ${ADM_DOCS.map(d => `<div>${have.has(d) ? '☑' : '☐'} ${e(d)}</div>`).join('')}
      </div>
      <div style="font-size:9.5px;color:#64748B;margin-top:4px">Originals not yet submitted must be produced at the admission office when asked.</div>
    </div>`, `Reference: ${e(refNo)}`, `Page 1 of 2 · ${e(inst.name)}`)

  const page2 = receiptSheet(receiptHeader('UNDERTAKING & DECLARATION', 'FOR SIGNATURE') + `
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:6px">
        <div><div class="l">Student</div><div class="v" style="font-size:14px">${e(app.name)}</div></div>
        <div><div class="l">GCC No.</div><div class="v mono" style="font-size:14px">GCC-${e(gcc)}</div></div>
        <div><div class="l">Course · Class</div><div class="v" style="font-size:14px">${e([app.course, app.cls].filter(Boolean).join(' · '))}</div></div>
        <div><div class="l">Session</div><div class="v" style="font-size:14px">${e(session)}</div></div>
      </div>
      <div class="sect">Undertaking by the parent / guardian and the student</div>
      <ol style="padding-left:18px;font-size:11.5px;line-height:1.7;color:#1E293B;margin-top:6px">${UNDERTAKING.map(t => `<li style="margin-bottom:7px">${e(t)}</li>`).join('')}</ol>
      <div style="font-size:11.5px;margin-top:10px;line-height:1.7">I / We, the undersigned, have read and understood the above and accept admission on these terms.</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px;text-align:center;font-size:11px">
        <div><div style="border-top:1px solid #0F172A;padding-top:4px"><b>Parent / Guardian</b><br>${e(app.father || '')}</div><div class="l" style="margin-top:4px">Date: ____________</div></div>
        <div><div style="border-top:1px solid #0F172A;padding-top:4px"><b>Student</b><br>${e(app.name)}</div><div class="l" style="margin-top:4px">Date: ____________</div></div>
        <div><div style="border-top:1px solid #0F172A;padding-top:4px"><b>Admission Officer</b><br>${e(inst.name)}</div><div class="l" style="margin-top:4px">Date: ____________</div></div>
      </div>
      <div class="foot" style="margin-top:40px">
        <div class="note">For office use<br>Receipt checked ☐ &nbsp; Documents checked ☐ &nbsp; Entered in register ☐ &nbsp; House allotted ☐<br>Registrar / Principal's remarks: ______________________________________________</div>
        <div class="sig"><div style="width:84px;height:84px;border:1.5px dashed #94A3B8;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94A3B8;margin:0 auto">Office seal</div><div class="line" style="margin-top:8px"></div><div class="who">Principal / Director</div></div>
      </div>
    </div>`, `Reference: ${e(refNo)}`, `Page 2 of 2 · ${e(inst.name)}`)

  const title = `Admission Confirmation – ${app.name}`
  return { title, html: receiptDocument(title, page1 + page2, { extraCss: '.sect{margin:12px 0 5px;font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7A5A14}', printLabel: '🖨 Print / Save PDF' }) }
}

// Call straight from a click: opens the print window at once and fills it when the fee rates are in.
export function printAdmissionConfirmation(data, ratesPromise = Promise.resolve(null)) {
  const title = `Admission Confirmation – ${data.app.name}`
  openReceiptWindow(title, ratesPromise.catch(() => null).then(rates => admissionConfirmationHtml({ ...data, rates }).html), { autoPrint: false })
}
