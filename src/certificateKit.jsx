// ════════════════════════════════════════════════════════════════════════
//  certificateKit.jsx — certificates for any student-facing module.
//  Same A4 design as the fee receipt / report card (premiumReceipt.js):
//  letterhead · navy title band · boxed student grid · certificate text ·
//  seal + signatures. Use <CertificateDialog student={s} onClose={…}/> to let
//  staff pick a type and print, or call printCertificate() directly.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react'
import { receiptDocument, receiptSheet, receiptHeader, openReceiptWindow, esc, fmtDate } from './premiumReceipt'
import { getInstitute } from './systemSettings'

const NAVY = '#0B1E3D'

export const CERTIFICATE_TYPES = [
  { id: 'bonafide',   label: 'Bonafide Certificate',          title: 'BONAFIDE CERTIFICATE', needsPurpose: true,
    text: s => `is a bonafide student of this institute, enrolled in <b>${s.course}</b>${s.batch}, and has been studying here during the academic session <b>${s.year}</b>. As per our records the student's admission number is <b>${s.adm}</b>.` },
  { id: 'character',  label: 'Character & Conduct Certificate', title: 'CHARACTER CERTIFICATE', needsPurpose: true,
    text: s => `has been a student of this institute in <b>${s.course}</b>${s.batch} during the academic session <b>${s.year}</b>. During this period the conduct and character of the student have been found <b>good</b>, and nothing adverse has come to our notice.` },
  { id: 'completion', label: 'Course Completion Certificate',  title: 'COURSE COMPLETION CERTIFICATE', needsPurpose: false,
    text: s => `has successfully completed the course <b>${s.course}</b>${s.batch} at this institute during the academic session <b>${s.year}</b>. We wish the student every success in the future.` },
  { id: 'hostel',     label: 'Hostel Residence Certificate',   title: 'HOSTEL RESIDENCE CERTIFICATE', needsPurpose: true,
    text: s => `is a resident of the institute hostel (<b>${s.hostel}</b>) and is staying in the hostel while studying in <b>${s.course}</b>${s.batch} during the academic session <b>${s.year}</b>.` },
  { id: 'leaving',    label: 'Leaving Certificate',            title: 'LEAVING CERTIFICATE', needsPurpose: false,
    text: s => `was a student of this institute in <b>${s.course}</b>${s.batch} during the academic session <b>${s.year}</b> and is leaving the institute on request of the parent/guardian. All dues, if any, have been settled as per the office record.` },
  { id: 'merit',      label: 'Certificate of Achievement',     title: 'CERTIFICATE OF ACHIEVEMENT', needsPurpose: false, custom: true,
    text: s => `has been awarded this certificate in recognition of <b>${s.achievement || 'outstanding performance'}</b> while studying in <b>${s.course}</b>${s.batch} during the academic session <b>${s.year}</b>. Keep up the excellent work!` },
]

const certNo = (st, type) => {
  const yr = new Date().getFullYear()
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `GNSI/CERT/${yr}/${type.id.slice(0, 3).toUpperCase()}-${String(st.gcc_no || '').padStart(4, '0')}-${rnd}`
}

const CERT_CSS = `
  .ct-body{margin-top:14px;border:1px solid #E6DCC3;border-left:5px solid #C9A24B;background:#FFFCF4;border-radius:8px;padding:22px 26px}
  .ct-body p{font-family:'Playfair Display',Georgia,serif;font-size:15px;line-height:2;color:#1F2A44;text-align:justify}
  .ct-body .nm{font-size:19px;font-weight:700;color:#0B1E3D;border-bottom:1.5px solid #C9A24B;padding:0 4px}
  .ct-purpose{margin-top:12px;font-size:12.5px;color:#334155}
  .ct-seal{width:92px;height:92px;border-radius:50%;border:2px dashed #94A3B8;color:#94A3B8;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;text-align:center;line-height:1.5}
  .ct-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
`

function certificateSheet(st, type, opts) {
  const inst = getInstitute()
  const year = inst.academicYear || opts.year || ''
  const issued = opts.date || new Date().toISOString().slice(0, 10)
  const no = opts.certNo || certNo(st, type)
  const data = {
    course: esc(st.course || '—'),
    batch: st.class_name ? ` (${esc(st.class_name)})` : '',
    year: esc(year || '—'),
    adm: esc(st.admission_no && st.admission_no !== '--' ? st.admission_no : '—'),
    hostel: esc(st.hostel_type || 'Hostel'),
    achievement: esc(opts.achievement || ''),
  }
  const parent = st.father_name ? ` ward of <b>${esc(st.father_name)}</b>${st.mother_name ? ` and <b>${esc(st.mother_name)}</b>` : ''},` : ''
  const cell = (l, v, extra = '') => `<td class="c"${extra}><div class="l">${l}</div><div class="v">${v}</div></td>`
  const body = `
    <div class="wrap">
      <div class="ct-row">
        <div><div class="l">Certificate No.</div><div class="mono" style="font-size:14px;font-weight:700;color:#0B1E3D;margin-top:2px">${esc(no)}</div></div>
        <div style="text-align:right"><div class="l">Date of issue</div><div style="font-size:13px;font-weight:700;margin-top:2px">${esc(fmtDate(issued))}</div></div>
      </div>
      <table class="info"><tbody>
        <tr>${cell('Student Name', esc(st.name), ' colspan="2"')}${cell('GCC No.', `<span class="mono">GCC-${esc(st.gcc_no || '—')}</span>`)}${cell('Admission No.', data.adm)}</tr>
        <tr>${cell("Father's Name", esc(st.father_name || '—'), ' colspan="2"')}${cell('Course', data.course)}${cell('Class / Batch', esc(st.class_name || '—'))}</tr>
        ${st.dob ? `<tr>${cell('Date of Birth', esc(fmtDate(st.dob)), ' colspan="2"')}${cell('Hostel', esc(st.hostel_type || '—'), ' colspan="2"')}</tr>` : ''}
      </tbody></table>
      <div class="ct-body">
        <p>This is to certify that <span class="nm">${esc(st.name)}</span>,${parent} GCC No. <b>${esc(st.gcc_no || '—')}</b>, ${type.text(data)}</p>
        ${opts.purpose && type.needsPurpose ? `<p class="ct-purpose" style="font-family:inherit">This certificate is issued on request for the purpose of: <b>${esc(opts.purpose)}</b>.</p>` : ''}
        ${opts.remarks ? `<p class="ct-purpose" style="font-family:inherit"><b>Remarks:</b> ${esc(opts.remarks)}</p>` : ''}
      </div>
      <div class="foot" style="padding-top:44px;align-items:flex-end">
        <div class="ct-seal">Office<br/>seal</div>
        <div class="sig"><div class="line"></div><div class="who">${esc(inst.principal || 'Principal')}</div><div class="l">Principal / Authorised signatory</div></div>
      </div>
      <div class="note" style="margin-top:14px;font-style:italic">This certificate is valid only with the office seal and signature of the authorised signatory.</div>
    </div>`
  return receiptSheet(receiptHeader(type.title, 'ORIGINAL') + body, `Issued: ${esc(fmtDate(issued))}`, esc(no))
}

// Print one or more certificates (students: array of student rows).
export function printCertificate(typeId, students, opts = {}) {
  const type = CERTIFICATE_TYPES.find(t => t.id === typeId) || CERTIFICATE_TYPES[0]
  const list = Array.isArray(students) ? students : [students]
  if (!list.length) return
  const title = `${type.label} — ${list.length === 1 ? list[0].name : `${list.length} students`}`
  openReceiptWindow(title, receiptDocument(title, list.map(s => certificateSheet(s, type, opts)).join(''), {
    extraCss: CERT_CSS,
    printLabel: list.length === 1 ? '🖨 Print certificate' : `🖨 Print ${list.length} certificates`,
  }), { autoPrint: false })
}

// Pop-up used by every module: pick the certificate type, add purpose, print.
export function CertificateDialog({ student, students, onClose, defaultType = 'bonafide', defaultAchievement = '' }) {
  const list = students || (student ? [student] : [])
  const [typeId, setTypeId] = useState(defaultType)
  const [purpose, setPurpose] = useState('')
  const [achievement, setAchievement] = useState(defaultAchievement)
  const [remarks, setRemarks] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const type = CERTIFICATE_TYPES.find(t => t.id === typeId) || CERTIFICATE_TYPES[0]
  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }
  const inp = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #e2d9c0', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(11,30,61,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 20, border: '1px solid #ece6d6', boxShadow: '0 30px 70px -20px rgba(11,30,61,.5)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1ebdc', background: 'linear-gradient(180deg,#fffdf8,#fff)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📜</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 600, fontSize: 17, color: '#0f1f3d' }}>Issue certificate</div>
            <div style={{ fontSize: 11.5, color: '#6b7690' }}>{list.length === 1 ? `${list[0].name} · GCC ${list[0].gcc_no}` : `${list.length} students`}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7690' }}>✕</button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={lbl}>Certificate type</label>
            <select value={typeId} onChange={e => setTypeId(e.target.value)} style={inp}>{CERTIFICATE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          {type.needsPurpose && <div><label style={lbl}>Purpose (optional)</label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Bank account opening, scholarship" style={inp} /></div>}
          {type.custom && <div><label style={lbl}>Awarded for</label>
            <input value={achievement} onChange={e => setAchievement(e.target.value)} placeholder="e.g. 1st rank in Unit Test 2" style={inp} /></div>}
          <div><label style={lbl}>Remarks (optional)</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Date of issue</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></div>
          <button onClick={() => { printCertificate(typeId, list, { purpose, achievement, remarks, date }); onClose?.() }}
            style={{ borderRadius: 12, border: 'none', background: NAVY, color: '#fff', fontWeight: 800, fontSize: 14, padding: '12px', cursor: 'pointer' }}>
            🖨 Preview &amp; print
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Merit / topper certificates (Exams → Certificates) ──────────────────────
// items: [{ student, rank, total, courseMax, pct, examName, examDate, course, title? }]
function meritSheet(it) {
  const inst = getInstitute()
  const st = it.student
  const ord = it.rank === 1 ? '1st' : it.rank === 2 ? '2nd' : it.rank === 3 ? '3rd' : `${it.rank}th`
  const no = `GNSI/MERIT/${new Date().getFullYear()}/${String(st.gcc_no || '').padStart(4, '0')}-${ord.toUpperCase()}`
  const cell = (l, v, extra = '') => `<td class="c"${extra}><div class="l">${l}</div><div class="v">${v}</div></td>`
  const body = `
    <div class="wrap">
      <div class="ct-row">
        <div><div class="l">Certificate No.</div><div class="mono" style="font-size:14px;font-weight:700;color:#0B1E3D;margin-top:2px">${esc(no)}</div></div>
        <div style="text-align:right"><div class="l">Examination</div><div style="font-size:13px;font-weight:700;margin-top:2px">${esc(it.title || it.examName)}${it.examDate ? ` · ${esc(it.examDate)}` : ''}</div></div>
      </div>
      <table class="info"><tbody>
        <tr>${cell('Student Name', esc(st.name), ' colspan="2"')}${cell('GCC No.', `<span class="mono">GCC-${esc(st.gcc_no || '—')}</span>`)}${cell('Rank', `<b style="color:#B8860B">${ord}</b>`)}</tr>
        <tr>${cell('Course', esc(it.course || st.course || '—'))}${cell('Class / Batch', esc(st.class_name || '—'))}${cell('Marks obtained', `<span class="mono">${esc(it.total)} / ${esc(it.courseMax)}</span>`)}${cell('Percentage', `<span class="mono">${Number(it.pct || 0).toFixed(1)}%</span>`)}</tr>
      </tbody></table>
      <div class="ct-body" style="text-align:center">
        <p style="text-align:center;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#7A5A14">Certificate of merit</p>
        <p style="text-align:center">This is to certify that <span class="nm">${esc(st.name)}</span> secured <b>${ord} rank</b> in <b>${esc(it.course || st.course || '')}</b> in the <b>${esc(it.title || it.examName)}</b> with <b>${esc(it.total)}</b> out of <b>${esc(it.courseMax)}</b> marks (${Number(it.pct || 0).toFixed(1)}%). The institute congratulates the student on this achievement.</p>
      </div>
      <div class="foot" style="padding-top:44px;align-items:flex-end">
        <div class="ct-seal">Office<br/>seal</div>
        <div class="sig"><div class="line"></div><div class="who">Exam coordinator</div><div class="l">Signature</div></div>
        <div class="sig"><div class="line"></div><div class="who">${esc(inst.principal || 'Principal')}</div><div class="l">Principal</div></div>
      </div>
    </div>`
  return receiptSheet(receiptHeader('CERTIFICATE OF MERIT', `${ord} RANK`) + body, undefined, esc(no))
}

export function printMeritCertificates(items, title = 'Certificates of merit') {
  if (!items?.length) return
  openReceiptWindow(title, receiptDocument(title, items.map(meritSheet).join(''), {
    extraCss: CERT_CSS,
    printLabel: items.length === 1 ? '🖨 Print certificate' : `🖨 Print ${items.length} certificates`,
  }), { autoPrint: false })
}
