// Merit certificates for Mission Sainik mock tests: one A4-landscape page per winner, all in one PDF.
import jsPDF from 'jspdf'
import { drawPremiumCertificate } from '../premiumCertificate'

export const ordinal = n => { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th') }

// items: [{ rank, name, gcc, batch, pct, total, max }]; label: what the merit is for, e.g. "Pre Mock Test 2027 · PMT-05".
export async function downloadSainikCertificates(items, label, fileName, onProgress) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  for (let i = 0; i < items.length; i++) {
    const w = items[i]
    onProgress?.(i + 1, items.length)
    const canvas = await drawPremiumCertificate({
      kind: 'Merit',
      subtitle: `${ordinal(w.rank)} Position · Mission Sainik`,
      name: w.name,
      detail: [w.gcc ? `GCC No. ${w.gcc}` : '', 'Sainik', w.batch].filter(Boolean).join(' · '),
      body: [`for securing ${ordinal(w.rank)} position with ${w.pct}% (${w.total} out of ${w.max})`, `in ${label}.`],
      seal: { value: `${w.pct}%`, label: 'SCORE' },
      signatures: [{ title: 'Class Teacher' }, { title: 'Principal' }],
      certNo: `GNSI/MS/${String(w.rank).padStart(2, '0')}/${w.gcc || String(w.name).replace(/\W+/g, '').slice(0, 8)}`.slice(0, 60),
    })
    if (i) doc.addPage('a4', 'landscape')
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210)
  }
  doc.save(fileName)
}
