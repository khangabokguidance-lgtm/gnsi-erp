import { drawPremiumCertificate, certificatePdf } from './premiumCertificate'

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
//  The page itself is the shared premium certificate
//  (premiumCertificate.js); only the wording is per category.
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

// Ribbon title and certificate-number code per category.
const CATEGORY_BADGE = {
  house_master: { ribbon: 'Housemaster of the Month · Hostel', code: 'HM' },
  doubt_session: { ribbon: 'Doubt Session Champion', code: 'DS' },
  non_teaching: { ribbon: 'Non-Teaching Staff of the Month', code: 'NT' },
  faculty: { ribbon: 'Faculty of the Month', code: 'FAC' },
  house: { ribbon: 'House of the Month', code: 'HSE' },
}

/**
 * Generates and downloads a "Certificate of Appreciation" PDF — the premium
 * GNSI certificate (premiumCertificate.js), A4 landscape.
 *
 * @param {object} params
 * @param {string} params.categoryKey  - one of CATEGORY_COPY's keys (house_master, doubt_session, non_teaching, faculty, house)
 * @param {string} params.name         - the winner's display name (staff name or house name)
 * @param {string} params.monthLabel   - e.g. "August 2026"
 * @param {number} params.score        - the winning score (0-100)
 * @param {object} [params.nomineeMeta] - optional extra context (e.g. { house: 'Kombirei' } for house_master, { designation: 'Concern Teacher' } for staff)
 */
export async function generateAwardCertificate({ categoryKey, name, monthLabel, score, nomineeMeta }) {
  const copy = CATEGORY_COPY[categoryKey] || CATEGORY_COPY.faculty
  const badge = CATEGORY_BADGE[categoryKey] || CATEGORY_BADGE.faculty
  const canvas = await drawPremiumCertificate({
    kind: 'Appreciation',
    subtitle: badge.ribbon,
    name,
    detail: copy.role(nomineeMeta),
    body: copy.reason(monthLabel).split('\n'),
    seal: { value: `${score}%`, label: 'SCORE' },
    signatures: [{ title: 'Principal' }, { title: 'Head of the Institution' }],
    certNo: `GNSI/${badge.code}/${String(monthLabel).replace(/\s+/g, '-').toUpperCase()}`,
  })
  certificatePdf(canvas, `Certificate_${name.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`)
}
