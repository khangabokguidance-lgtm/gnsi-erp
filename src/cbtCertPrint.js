// cbtCertPrint.js — the premium CBT result certificate (A4, same design as the fee receipt and the other
// certificates) and the ERP student loader behind it.
import { supabase } from './supabase'
import { getInstitute } from './systemSettings'
import { receiptDocument, receiptSheet, receiptHeader, openReceiptWindow, receiptQrSVG, esc, fmtDate } from './premiumReceipt'
import { CERT_CSS } from './certificateCss'
import { certNumber, band, parentPhoneOf } from './lib/cbtCertLogic'

export async function loadStudents() {
  const { data, error } = await supabase.from('students').select('*').order('gcc_no')
  if (error) throw new Error(error.message)
  return data || []
}

const CSS = CERT_CSS + `
  .cc-sec{width:100%;border-collapse:collapse;margin-top:10px;font-size:11.5px}
  .cc-sec th{background:#0B1E3D;color:#fff;padding:5px 8px;text-align:left;font-weight:700;letter-spacing:.04em}
  .cc-sec td{border-bottom:1px solid #E6DCC3;padding:5px 8px}.cc-sec .n{text-align:right;font-variant-numeric:tabular-nums}
  .cc-band{display:inline-block;margin:4px 0 2px;padding:3px 14px;border:1.5px solid #C9A24B;border-radius:999px;color:#7A5A14;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}
`

// items: [{ student, test, row: { attempt, g, rank, took }, total }]
function sheet(it) {
  const inst = getInstitute(), { student: st, test, row, total } = it, { g, attempt: a } = row
  const b = band(g.percent), no = certNumber(test, st)
  const when = fmtDate(a.submittedAt || a.startedAt)
  const cell = (l, v, extra = '') => `<td class="c"${extra}><div class="l">${l}</div><div class="v">${v}</div></td>`
  const secs = g.sections.map(s => `<tr><td>${esc(s.label ? `${s.label} — ${s.title || ''}` : s.title)}</td><td class="n">${s.attempted} / ${s.total}</td><td class="n">${s.correct}</td><td class="n">${s.wrong}</td><td class="n"><b>${s.marks}</b> / ${s.max}</td></tr>`).join('')
  const body = `
    <div class="wrap">
      <div class="ct-row">
        <div><div class="l">Certificate No.</div><div class="mono" style="font-size:14px;font-weight:700;color:#0B1E3D;margin-top:2px">${esc(no)}</div></div>
        <div style="text-align:center"><div class="l">Test ID</div><div class="mono" style="font-size:12.5px;font-weight:700;margin-top:2px">${esc(test.id)}</div></div>
        <div style="text-align:right"><div class="l">Date of test</div><div style="font-size:13px;font-weight:700;margin-top:2px">${esc(when)}</div></div>
      </div>
      <table class="info"><tbody>
        <tr>${cell('Student Name', esc(st.name), ' colspan="2"')}${cell('GCC No.', `<span class="mono">GCC-${esc(st.gcc_no || '—')}</span>`)}${cell('Admission No.', esc(st.admission_no && st.admission_no !== '--' ? st.admission_no : '—'))}</tr>
        <tr>${cell("Father's Name", esc(st.father_name || '—'), ' colspan="2"')}${cell("Mother's Name", esc(st.mother_name || '—'), ' colspan="2"')}</tr>
        <tr>${cell('Parent contact', `<span class="mono">${esc(parentPhoneOf(st) || '—')}</span>`, ' colspan="2"')}${cell('Course', esc(st.course || '—'))}${cell('Class / Batch', esc(st.class_name || '—'))}</tr>
        <tr>${cell('Marks obtained', `<b class="mono">${g.marks} / ${g.max}</b>`)}${cell('Percentage', `<span class="mono">${g.percent == null ? '—' : g.percent + '%'}</span>`)}${cell('Rank', row.rank ? `<b style="color:#B8860B">${row.rank}</b> of ${total}` : '—')}${cell('Accuracy', `<span class="mono">${g.accuracy}%</span>`)}</tr>
      </tbody></table>
      <div class="ct-body" style="text-align:center">
        <div class="cc-band">${esc(b.label)}</div>
        <p style="text-align:center">This is to certify that <span class="nm">${esc(st.name)}</span>, GCC No. <b>${esc(st.gcc_no || '—')}</b>${st.father_name ? `, ward of <b>${esc(st.father_name)}</b>` : ''}, appeared in the computer based test <b>${esc(test.name)}</b> held on <b>${esc(when)}</b> and scored <b>${g.marks}</b> out of <b>${g.max}</b> marks${g.percent == null ? '' : ` (${g.percent}%)`}${row.rank ? `, securing <b>rank ${row.rank}</b> among ${total} candidates` : ''}. The institute congratulates the student ${esc(b.note)} this test.</p>
      </div>
      <table class="cc-sec"><thead><tr><th>Section</th><th class="n">Attempted</th><th class="n">Correct</th><th class="n">Wrong</th><th class="n">Marks</th></tr></thead><tbody>${secs}</tbody></table>
      <div class="foot" style="padding-top:34px;align-items:flex-end">
        <div class="ct-seal">Office<br/>seal</div>
        <div style="text-align:center">${receiptQrSVG(`${no} | ${test.id} | GCC ${st.gcc_no} | ${g.marks}/${g.max}`, 70)}<div class="l" style="margin-top:2px">Scan to verify</div></div>
        <div class="sig"><div class="line"></div><div class="who">Exam coordinator</div><div class="l">Signature</div></div>
        <div class="sig"><div class="line"></div><div class="who">${esc(inst.principal || 'Principal')}</div><div class="l">Principal</div></div>
      </div>
    </div>`
  return receiptSheet(receiptHeader('CBT RESULT CERTIFICATE', 'PREMIUM') + body, undefined, esc(no))
}

export const certificateHtml = (items, title = 'CBT result certificates') => receiptDocument(title, items.map(sheet).join(''), {
  extraCss: CSS, printLabel: items.length === 1 ? '🖨 Print certificate' : `🖨 Print ${items.length} certificates`,
})

export function printCbtCertificates(items, title = 'CBT result certificates') {
  if (!items.length) return
  openReceiptWindow(title, certificateHtml(items, title), { autoPrint: false })
}

