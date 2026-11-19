// Merit certificates for Mission Foundation prizes: one A4-landscape page per winner, all in one PDF.
import jsPDF from 'jspdf'
import { drawPremiumCertificate } from '../premiumCertificate'

// items: [{ award, award_key, detail, student_name, student_id, gcc_no, batch, pct }]; label: what the prize is for.
export async function downloadCertificates(items, label, fileName, onProgress) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  for (let i = 0; i < items.length; i++) {
    const w = items[i]
    onProgress?.(i + 1, items.length)
    const canvas = await drawPremiumCertificate({
      kind: 'Merit',
      subtitle: w.award,
      name: w.student_name,
      detail: [w.gcc_no ? `GCC No. ${w.gcc_no}` : '', 'Foundation', w.batch].filter(Boolean).join(' · '),
      body: [`for the award "${w.award}" (${w.detail})`, `in ${label}.`],
      seal: { value: w.pct != null ? `${w.pct}%` : '★', label: 'SCORE' },
      signatures: [{ title: 'Class Teacher' }, { title: 'Principal' }],
      certNo: `GNSI/MF/${String(w.award_key).toUpperCase()}/${w.gcc_no || w.student_id}`.slice(0, 60),
    })
    if (i) doc.addPage('a4', 'landscape')
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210)
  }
  doc.save(fileName)
}

