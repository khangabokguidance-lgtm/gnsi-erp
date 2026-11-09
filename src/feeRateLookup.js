// feeRateLookup.js — which fee_structures row applies to a student (pure, unit-tested).
//
// Fee Setup stores one row per session / course / batch / hostel type. Combined Course has
// no batches, so its rows are stored under the placeholder batch '—'. A Combined student whose
// batch holds anything else (a class name from Admissions, free text) must still get those rows —
// otherwise billing silently falls back to the old hardcoded rates.
export const COMBINED = 'Combined Course'
export const NO_BATCH = '—'

/** Batch spellings to look for, most specific first. */
export function batchKeysFor({ course, batch, rawBatch, aliases = [] }) {
  const keys = [batch, rawBatch, ...aliases]
  if (course === COMBINED) keys.push(NO_BATCH)
  return [...new Set(keys.filter(v => v != null))]
}

/** The best row: standard course name first, then the student's own batch, then (Combined) the '—' row. */
export function pickFeeRow(matches, { course, batch }) {
  const rank = r => (r.course === course ? 0 : 2) + (r.batch === batch ? 0 : (course === COMBINED && r.batch === NO_BATCH ? 0.5 : 1))
  return (matches || []).slice().sort((a, b) => rank(a) - rank(b))[0] || null
}
