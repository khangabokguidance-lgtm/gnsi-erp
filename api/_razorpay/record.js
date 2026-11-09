// api/_razorpay/record.js — turns a paid Razorpay Payment Link into the rows the fee screens expect.
// Pure (no database): webhook.js saves what this returns. Files under an underscore folder are not routes.
//
// What the fee screens need from an online payment:
//   • a receipt number (RZP-…): the Accounts "Income vs Collection" check matches fee rows to Accounts
//     rows by receipt number, and the database numbers the receipt (R/2026-27/…) from it
//   • an Accounts row of type 'fee_payment' carrying that receipt number in its note, with category
//     and payment mode, so it counts as fee income instead of unmatched "other" income
//   • the student's name and a numeric year, as in-app collections write them

const toYear = y => { const n = Number(y); return Number.isFinite(n) && n > 0 ? n : null }

export const receiptFor = paymentId => `RZP-${String(paymentId || '').replace(/^pay_/, '').toUpperCase()}`

// notes: the Payment Link's notes. amount: rupees actually paid. payDate: 'YYYY-MM-DD'.
export function buildOnlineRecords({ notes = {}, paymentId, amount, payDate }) {
  const gcc = String(notes.gcc || '')
  const kind = notes.kind || 'course'
  const year = toYear(notes.year)
  const receipt = receiptFor(paymentId)
  const name = notes.studentName || null
  const base = { pay_date: payDate, pay_mode: 'Razorpay', txn_ref: paymentId, receipt_no: receipt, collected_by: 'Online (Razorpay)', reverted: false }
  let table, row, label, category
  if (kind === 'course') {
    table = 'adm_course_fees'
    row = { adm_app_id: gcc, course: notes.course || null, for_month: notes.for_month || null, year, amount_paid: amount, ...(name ? { student_name: name } : {}), ...base }
    label = `Course Fee${notes.for_month ? ` ${notes.for_month}` : ''}${year ? ` ${year}` : ''}`; category = 'Fees'
  } else if (kind === 'flat') {
    table = 'adm_flat_fees'
    row = { adm_app_id: gcc, month: notes.for_month || null, year, amount, paid: true, ...(name ? { student_name: name } : {}), ...base }
    label = `Flat Fee${notes.for_month ? ` ${notes.for_month}` : ''}${year ? ` ${year}` : ''}`; category = 'Hostel'
  } else {
    table = 'adm_fee_collections'
    row = { adm_app_id: gcc, fee_type: kind === 'admission' ? 'admission' : kind || 'other', ...(kind === 'admission' ? { description: 'Admission Fee' } : {}), amount_paid: amount, ...base }
    label = kind === 'admission' ? 'Admission Fee' : 'Fee payment'; category = 'Fees'
  }
  const account = {
    entry_date: payDate, payment_date: payDate, type: 'Income', category, amount, payment_mode: 'Razorpay',
    note: [name || `GCC-${gcc}`, label, receipt].join(' · '),
    source_ref: paymentId, source_type: 'fee_payment', is_recurring: false, is_soft_deleted: false,
  }
  return { table, row, account, receipt }
}
