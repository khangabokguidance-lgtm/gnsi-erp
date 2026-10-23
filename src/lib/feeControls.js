// feeControls.js — accounting rules for the Fees module as plain functions (no React / Supabase), shared by
// the collection screen, the Fee Controls tab and the tests. The database enforces the same rules for people
// using the app (migration 20261032: FEE-001 closed day, FEE-002 payment reference, FEE-003 revert reason);
// these give the answer *before* Save and power the exception report.
//
// Deliberately NOT repeated here (already in Fees → Anomaly Monitor / Data Health / Late Entries /
// Income vs Collection): duplicate months, future dates, zero amounts, rate deviation, spikes, orphan GCC,
// back-dated entries, fee↔accounts mismatch.

export const FEE_CONTROL_DEFAULTS = {
  lock_closed_days: true,
  require_digital_ref: true,
  min_ref_length: 4,
  require_revert_reason: true,
  enforce_in_database: true,
}

export const FEE_DIGITAL_MODES = ['upi', 'cheque', 'bank transfer', 'dd', 'neft', 'imps', 'rtgs', 'online', 'card']
export const isDigitalFeeMode = m => FEE_DIGITAL_MODES.includes(String(m ?? '').trim().toLowerCase())

const REVERT_REASON_MIN = 4

// Pre-save check for a collection. Returns an error message, or '' when fine.
//   closedStatus: 'closed' | 'reopened' | null for the payment date; isAdmin: caller may write on a closed day
export function validateFeeCollection({ payMode, txnRef, closedStatus = null, isAdmin = false, controls = null, payDate = '' } = {}) {
  const c = { ...FEE_CONTROL_DEFAULTS, ...(controls || {}) }
  if (controls === null) return ''   // migration not run: nothing to enforce
  if (c.require_digital_ref && isDigitalFeeMode(payMode) && String(txnRef ?? '').trim().length < Number(c.min_ref_length || 4))
    return `Enter the payment reference (UPI / cheque / transaction no.) for the ${payMode} payment.`
  if (c.lock_closed_days && closedStatus === 'closed' && !isAdmin)
    return `${payDate || 'This day'} is already closed. Ask an admin to reopen it in Fees → Day Close before recording a payment for that date.`
  return ''
}

export const revertReasonError = (reason, controls = null) =>
  controls && (controls.require_revert_reason ?? true) && String(reason ?? '').trim().length < REVERT_REASON_MIN
    ? `Give a reason of at least ${REVERT_REASON_MIN} characters to revert a payment.` : ''

// ── normalise the three fee tables into one shape ───────────────────────────
const TABLES = { adm_fee_collections: 'Admission / items', adm_flat_fees: 'Flat fee', adm_course_fees: 'Course fee' }
export function normaliseFeeRows(adm = [], flat = [], course = []) {
  const mk = (t, r, amount, live) => ({
    id: `${t}:${r.id}`, table: t, kind: TABLES[t], gcc: String(r.adm_app_id ?? ''), amount: Number(amount) || 0, live,
    date: String(r.pay_date || '').slice(0, 10), mode: String(r.pay_mode || '').trim(), ref: String(r.txn_ref || '').trim(),
    receipt: r.receipt_no || '', serial: r.receipt_serial || '', by: String(r.collected_by || '').trim(),
    reverted: !!r.reverted, revertedBy: String(r.reverted_by || '').trim(), revertReason: String(r.revert_reason || '').trim(),
    revertedAt: r.reverted_at || null, enteredAt: r.collected_at || r.created_at || null,
  })
  return [
    ...adm.map(r => mk('adm_fee_collections', r, r.amount_paid, !r.reverted)),
    ...flat.filter(r => r.paid || r.reverted).map(r => mk('adm_flat_fees', r, r.amount, r.paid && !r.reverted)),
    ...course.map(r => mk('adm_course_fees', r, r.amount_paid, !r.reverted)),
  ].filter(r => r.amount > 0)
}

const sum = rows => rows.reduce((s, r) => s + r.amount, 0)
const mk = (code, severity, title, why, action, rows, extra = {}) => rows.length ? { code, severity, title, why, action, rows, total: sum(rows), ...extra } : null

/**
 * rows: normaliseFeeRows(...)   refunds: fee_refunds rows   closes: fee_day_close rows
 * opts: { serialReady, now }
 */
export function runFeeChecks({ rows = [], refunds = [], closes = [] } = {}, opts = {}) {
  const live = rows.filter(r => r.live)
  const out = []

  out.push(mk('FC1', 'High', 'Digital payments with no payment reference',
    'UPI / cheque / bank transfer receipts carry no reference, so they cannot be matched to the bank or UPI statement.',
    'Add the reference from the payment confirmation; keep staff from saving without it.',
    live.filter(r => isDigitalFeeMode(r.mode) && r.ref.length < 4)))

  out.push(mk('FC2', 'High', 'Reverted without a proper reason',
    'A payment was cancelled with no reason (or a one-word reason) on record.',
    'Record why each reversal was made; require the reason at the time of the request.',
    rows.filter(r => r.reverted && r.revertReason.length < REVERT_REASON_MIN)))

  // entered after the day was closed (and the day is still closed): someone with admin rights wrote into a closed day
  const closedAt = new Map(closes.filter(c => c.status === 'closed').map(c => [String(c.close_date).slice(0, 10), c.created_at]))
  out.push(mk('FC3', 'High', 'Payments recorded after the day was closed',
    'These receipts were saved after Day Close was signed off, so the counted cash no longer matches the books.',
    'Reopen the day with a reason, or record the receipt on today’s date.',
    live.filter(r => r.date && closedAt.has(r.date) && r.enteredAt && closedAt.get(r.date) && new Date(r.enteredAt) > new Date(closedAt.get(r.date)))))

  out.push(mk('FC4', 'Medium', 'Refunds raised and approved by the same person',
    'Nobody independent checked the refund before it was approved.',
    'Have a second person approve every refund.',
    refunds.filter(f => f.requested_by && f.decided_by && String(f.requested_by).trim().toLowerCase() === String(f.decided_by).trim().toLowerCase()
      && ['approved', 'paid'].includes(f.status)).map(f => ({ id: `refund:${f.id}`, table: 'fee_refunds', kind: `Refund (${f.kind})`, gcc: String(f.gcc), amount: Number(f.amount) || 0, date: String(f.created_at || '').slice(0, 10), mode: f.mode || '', ref: f.reference || '', receipt: '', by: f.requested_by, live: true }))))

  // one receipt number must belong to one student
  const byReceipt = new Map()
  live.filter(r => r.receipt).forEach(r => { (byReceipt.get(r.receipt) || byReceipt.set(r.receipt, []).get(r.receipt)).push(r) })
  out.push(mk('FC5', 'High', 'One receipt number used for different students',
    'A receipt number should belong to exactly one student.',
    'Check the receipts concerned and correct the wrong one.',
    [...byReceipt.values()].filter(g => new Set(g.map(r => r.gcc)).size > 1).flat()))

  out.push(mk('FC6', 'Medium', 'Payments with no payment mode',
    'Without a mode, Day Close cannot split cash from bank and the books cannot be matched.',
    'Edit the receipt and set the mode.',
    live.filter(r => !r.mode || /^unspecified$/i.test(r.mode))))

  // repeated reversals by one person
  const rev = new Map()
  rows.filter(r => r.reverted && r.revertedBy).forEach(r => { (rev.get(r.revertedBy) || rev.set(r.revertedBy, []).get(r.revertedBy)).push(r) })
  const heavy = [...rev.entries()].filter(([, g]) => g.length >= 5)
  if (heavy.length) out.push({ code: 'FC7', severity: 'Medium', title: 'One person reversing many payments', aggregate: true,
    why: heavy.map(([n, g]) => `${n}: ${g.length} reversals (${g.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')})`).join(' · '),
    action: 'Review the reasons given; reversals should be rare.', rows: heavy.flatMap(([, g]) => g), total: sum(heavy.flatMap(([, g]) => g)) })

  if (opts.serialReady) out.push(mk('FC8', 'Low', 'Receipts without a serial number',
    'Older receipts were issued before the numbered series started.', 'Run fee_backfill_receipt_serials() once in Supabase.',
    live.filter(r => r.receipt && !r.serial), { aggregate: true }))

  const order = { High: 0, Medium: 1, Low: 2 }
  return out.filter(Boolean).sort((a, b) => order[a.severity] - order[b.severity] || b.total - a.total)
}

// Receipts (not rows): one line per receipt number, for the receipt-series view.
export function receiptSeries(rows) {
  const m = new Map()
  rows.filter(r => r.live && r.receipt).forEach(r => {
    const e = m.get(r.receipt) || m.set(r.receipt, { receipt: r.receipt, serial: r.serial, date: r.date, gcc: r.gcc, amount: 0, mode: r.mode, by: r.by }).get(r.receipt)
    e.amount += r.amount; if (!e.serial && r.serial) e.serial = r.serial
  })
  return [...m.values()].sort((a, b) => String(b.serial || '').localeCompare(String(a.serial || '')) || b.date.localeCompare(a.date))
}
