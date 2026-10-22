// admissionConcessions.js — turns what an application promised (scholarship %, concession ₹/month) into rows for the
// Fee Concession Register, which is what the dues engine and receipts actually read. Pure; the caller writes them.
// Not covered on purpose: the sibling discount (the application only stores the sibling's GCC, not an amount) and
// instalment plans (their schedule needs a staff decision) — Fees still handles those by hand.
export function concessionRowsFor(app = {}, { validFrom, approvedBy } = {}) {
  const gcc = String(parseInt(app.gcc ?? app.gcc_no, 10) || '')
  if (!gcc) return []
  const name = app.name || app.applicant_name || null
  const from = String(validFrom || new Date().toLocaleDateString('en-CA')).slice(0, 10)
  const pct = Number(app.scholarshipPct ?? app.scholarship_pct) || 0
  const amt = Number(app.concessionAmt ?? app.concession_amt) || 0
  const rows = []
  if (pct > 0 && pct <= 100) rows.push({ gcc, student_name: name, kind: 'Scholarship-merit', basis: 'percent', value: pct, applies_to: 'course',
    valid_from: from, valid_to: null, reason: `Scholarship ${pct}% granted at admission (application GCC-${gcc})`, approved_by: approvedBy || null, status: 'active' })
  if (amt > 0) rows.push({ gcc, student_name: name, kind: 'Other', basis: 'fixed_per_month', value: amt, applies_to: 'course',
    valid_from: from, valid_to: null, reason: `Concession ₹${amt}/month granted at admission (application GCC-${gcc})`, approved_by: approvedBy || null, status: 'active' })
  return rows
}

// Drop rows the register already holds (same student, kind, basis and value, still active).
export const newConcessionRows = (rows, existing = []) =>
  rows.filter(r => !existing.some(e => String(e.gcc) === r.gcc && e.kind === r.kind && e.basis === r.basis && Number(e.value) === r.value && (e.status || 'active') === 'active'))
