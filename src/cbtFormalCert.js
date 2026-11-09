// cbtFormalCert.js — the formal "Heritage" certificate (premiumCertificate.js) for a CBT result.
import { drawFormalCertificate, certificatePdf } from './premiumCertificate'

const ordinal = n => { const v = n % 100; const sfx = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'); return `${n}${sfx}` }

/** Wording for one candidate. Pure — used by the download and by tests. */
export function cbtFormalOpts({ student, row, test, total }) {
  const marks = row?.g?.marks, max = row?.g?.max
  const pct = max > 0 ? Math.round((Number(marks) / Number(max)) * 100) : null
  const rank = row?.rank
  const body = [`in recognition of sincere effort and a commendable performance in ${test.name}`,
    `${marks != null && max != null ? `with ${marks} out of ${max} marks` : 'in the online examination'}${rank && total ? `, securing ${ordinal(rank)} rank among ${total} candidates` : ''}.`]
  return {
    kind: 'Appreciation',
    subtitle: 'Online Examination · CBT',
    name: student.name || '',
    detail: [student.course, student.class_name, student.gcc_no ? `GCC No. ${student.gcc_no}` : ''].filter(Boolean).join(' · '),
    body,
    seal: pct != null ? { value: `${pct}%`, label: 'SCORE' } : null,
    signatures: [{ title: 'Principal' }, { title: 'Head of the Institution' }],
    certNo: `GNSI/CBT/${String(test.id || '').slice(0, 8).toUpperCase()}/${student.gcc_no || ''}`,
  }
}

export async function downloadCbtFormalCertificate(item) {
  const canvas = await drawFormalCertificate(cbtFormalOpts(item))
  certificatePdf(canvas, `Certificate_${String(item.student.name || 'student').replace(/\s+/g, '_')}_${String(item.test.name || 'CBT').replace(/\s+/g, '_')}.pdf`)
}
