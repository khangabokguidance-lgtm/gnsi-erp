import jsPDF from 'jspdf'

// ══════════════════════════════════════════════════════════════
//  AwardCertificate — shared A4-landscape "Certificate of
//  Appreciation" PDF generator, navy/gold styling matching the
//  Gate Pass / reports look used throughout the portal.
//
//  Extracted from Hostel.jsx's generateCertificatePDF() (originally
//  Housemaster-only) and generalized to work for any award category —
//  Awards.jsx calls this for all 5 categories; Hostel.jsx's own
//  Housemaster certificate card now calls this too, instead of
//  keeping a private duplicate of the same PDF layout.
//
//  Nothing about the PDF layout changed from the original — same
//  navy/gold palette, same border, same signature-line footer. Only
//  the subtitle/body copy is now parameterized per category instead
//  of hardcoded to "Housemaster Performance".
// ══════════════════════════════════════════════════════════════

export const CERT_SCHOOL_NAME = 'Guidance Navodaya & Sainik Institute'
export const CERT_SCHOOL_ADDRESS = 'Khangabok, Thoubal, Manipur — 795134'

// Per-category subtitle and body wording — the only category-specific
// text in the certificate. Add a new category here if Awards.jsx ever
// gains a 6th one; nothing else needs to change.
const CATEGORY_COPY = {
  house_master: {
    subtitle: 'Presented for Outstanding Housemaster Performance',
    role: (nomineeMeta) => `Housemaster of ${nomineeMeta?.house || ''} House`.trim(),
    reason: (monthLabel) => `in recognition of exemplary dedication, punctual roll-call completion,\nand consistent compliance during ${monthLabel}.`,
  },
  doubt_session: {
    subtitle: 'Presented for Outstanding Doubt Session Support',
    role: () => 'Doubt Session Staff',
    reason: (monthLabel) => `in recognition of dedicated, patient, and effective doubt-session\nsupport to students during ${monthLabel}.`,
  },
  non_teaching: {
    subtitle: 'Presented for Outstanding Non-Teaching Staff Performance',
    role: (nomineeMeta) => nomineeMeta?.designation || 'Non-Teaching Staff',
    reason: (monthLabel) => `in recognition of reliable, prompt, and dedicated service\nto the institution during ${monthLabel}.`,
  },
  faculty: {
    subtitle: 'Presented for Outstanding Faculty Performance',
    role: (nomineeMeta) => nomineeMeta?.designation || 'Faculty',
    reason: (monthLabel) => `in recognition of dedicated teaching, professionalism, and\ncommitment to student growth during ${monthLabel}.`,
  },
  house: {
    subtitle: 'Presented for Outstanding House Performance',
    role: () => 'House',
    reason: (monthLabel) => `in recognition of exemplary cleanliness, discipline, and\noverall order maintained during ${monthLabel}.`,
  },
}

/**
 * Generates and downloads a "Certificate of Appreciation" PDF.
 *
 * @param {object} params
 * @param {string} params.categoryKey  - one of CATEGORY_COPY's keys (house_master, doubt_session, non_teaching, faculty, house)
 * @param {string} params.name         - the winner's display name (staff name or house name)
 * @param {string} params.monthLabel   - e.g. "August 2026"
 * @param {number} params.score        - the winning score (0-100)
 * @param {object} [params.nomineeMeta] - optional extra context (e.g. { house: 'Kombirei' } for house_master, { designation: 'Concern Teacher' } for staff)
 */
export function generateAwardCertificate({ categoryKey, name, monthLabel, score, nomineeMeta }) {
  const copy = CATEGORY_COPY[categoryKey] || CATEGORY_COPY.faculty

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297, H = 210
  const navy = [30, 58, 95]
  const gold = [202, 138, 4]
  const grey = [100, 116, 139]

  // Decorative border
  doc.setDrawColor(...gold)
  doc.setLineWidth(1.2)
  doc.rect(8, 8, W - 16, H - 16)
  doc.setLineWidth(0.4)
  doc.rect(11, 11, W - 22, H - 22)

  // Header
  doc.setTextColor(...navy)
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  doc.text(CERT_SCHOOL_NAME, W / 2, 28, { align: 'center' })
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...grey)
  doc.text(CERT_SCHOOL_ADDRESS, W / 2, 34, { align: 'center' })

  // Gold rule
  doc.setDrawColor(...gold)
  doc.setLineWidth(0.6)
  doc.line(W / 2 - 30, 40, W / 2 + 30, 40)

  // Title
  doc.setTextColor(...gold)
  doc.setFont('times', 'bold')
  doc.setFontSize(30)
  doc.text('Certificate of Appreciation', W / 2, 62, { align: 'center' })

  doc.setTextColor(...grey)
  doc.setFont('times', 'italic')
  doc.setFontSize(12)
  doc.text(copy.subtitle, W / 2, 72, { align: 'center' })

  // "This is presented to"
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...navy)
  doc.text('This certificate is proudly presented to', W / 2, 92, { align: 'center' })

  // Name — large, centered
  doc.setFont('times', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...navy)
  doc.text(name, W / 2, 108, { align: 'center' })

  // Underline beneath name
  const nameWidth = doc.getTextWidth(name)
  doc.setDrawColor(...gold)
  doc.setLineWidth(0.4)
  doc.line(W / 2 - nameWidth / 2 - 6, 112, W / 2 + nameWidth / 2 + 6, 112)

  // Body text — role line, then the category-specific reason (may wrap to 2 lines)
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...grey)
  const roleLine = copy.role(nomineeMeta)
  const reasonLines = copy.reason(monthLabel).split('\n')
  const bodyLines = [roleLine, ...reasonLines].filter(Boolean)
  bodyLines.forEach((line, i) => {
    doc.text(line, W / 2, 122 + i * 6, { align: 'center' })
  })

  // Score badge
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...navy)
  doc.text(`Performance Score: ${score}%`, W / 2, 122 + bodyLines.length * 6 + 12, { align: 'center' })

  // Signature lines
  const sigY = 178
  doc.setDrawColor(...grey)
  doc.setLineWidth(0.3)
  doc.line(50, sigY, 110, sigY)
  doc.line(W - 110, sigY, W - 50, sigY)
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...grey)
  doc.text('Principal', 80, sigY + 6, { align: 'center' })
  doc.text('Head of the Institution', W - 80, sigY + 6, { align: 'center' })

  // Footer date
  doc.setFontSize(8)
  doc.text(
    `Issued: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`,
    W / 2, H - 16, { align: 'center' }
  )

  doc.save(`Certificate_${name.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`)
}