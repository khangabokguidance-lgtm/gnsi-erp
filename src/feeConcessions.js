// feeConcessions.js — low-fee (concession) approvals.
//
// A flat or course fee collected below its standard (Fee Setup) rate needs a
// reason and an admin decision:
//   approved → the shortfall is waived (fee row concession_status 'approved',
//              concession_amount = shortfall; the ledger counts it as settled)
//   rejected → the shortfall stays due
//   pending  → waiting for an admin; shows as due meanwhile
// Requests live in fee_concessions (migration 20260929_fee_concessions.sql).
import { supabase } from './supabase'

export const CONCESSION_REASONS = [
  'Sibling concession',
  'Staff ward',
  'Financial hardship',
  'Scholarship / merit',
  'Joined mid-month',
  'Management decision',
  'Hostel type mismatch',
  'Other',
]

// A concession above this (₹) cannot be approved by the person who raised it —
// a second admin must decide it. Keep in step with fee_self_approve_limit() in
// supabase/migrations/20261006_fee_integrity_guards.sql.
export const CONCESSION_SELF_APPROVE_LIMIT = 2000
const sameWho = (a, b) => !!String(a || '').trim() && String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /fee_concessions|concession_(amount|status)/.test(err.message || ''))
export const CONCESSIONS_SETUP_MSG = 'Low-fee approvals need the database update 20260929_fee_concessions.sql — run it in Supabase (SQL editor) to switch this on.'

// Called by collectFee() for each below-standard flat/course line it saves.
// Never throws: a missing table must not block a payment (the reason is also
// in the audit log). Returns the created request or null.
export async function recordConcession({ replace = false, table, rowId, kind, gcc, studentName, month, year, course, standard, collected, reason, note, receiptNo, payDate, collectedBy, approvedBy }) {
  const shortfall = Math.round((Number(standard) - Number(collected)) * 100) / 100
  if (!(shortfall > 0) || !rowId) return null
  // Approval at the counter is only honoured when it is explained and, for a big
  // amount, not the requester approving their own request; otherwise it waits
  // for a (different) admin.
  const unexplained = (reason || 'Other') === 'Other' && String(note || '').trim().length < 3
  const selfApproved = approvedBy && shortfall > CONCESSION_SELF_APPROVE_LIMIT && sameWho(approvedBy, collectedBy)
  if (unexplained) note = '⚠ No explanation was given'
  if (unexplained || selfApproved) approvedBy = null
  const status = approvedBy ? 'approved' : 'pending'
  const now = new Date().toISOString()
  // The fee row id is reused when a month is collected again after a reversal:
  // replace any earlier request for it (pending ones only — decided ones are
  // removed by the reversal itself).
  if (replace) await supabase.from('fee_concessions').delete().eq('fee_table', table).eq('fee_row_id', String(rowId)).eq('status', 'pending')
  const { data, error } = await supabase.from('fee_concessions').insert({
    gcc: String(gcc), student_name: studentName || null, fee_table: table, fee_row_id: String(rowId), fee_kind: kind,
    month: month || null, year: year ? Number(year) : null, course: course || null,
    standard_amount: Number(standard), collected_amount: Number(collected), shortfall,
    reason: reason || 'Other', reason_note: note || null, receipt_no: receiptNo || null, pay_date: payDate || null,
    collected_by: collectedBy || null, requested_by: collectedBy || null,
    status, ...(approvedBy ? { decided_by: approvedBy, decided_at: now, decision_note: 'Approved at collection' } : {}),
  }).select().single()
  if (error) { console.warn(missingTable(error) ? CONCESSIONS_SETUP_MSG : `Could not file low-fee request: ${error.message}`); return null }
  const { error: rowErr } = await supabase.from(table).update({ concession_status: status, concession_amount: approvedBy ? shortfall : 0 }).eq('id', rowId)
  if (rowErr) console.warn('Could not mark the fee row with its concession status:', rowErr.message)
  return data
}

// A fee line collected at (or above) its standard rate: make sure no stale
// concession from an earlier, reversed payment of the same month remains.
export async function clearConcession(table, rowId) {
  try { await supabase.from(table).update({ concession_status: null, concession_amount: 0 }).eq('id', rowId).not('concession_status', 'is', null) } catch { /* columns not there yet */ }
}

export async function loadConcessions() {
  const { data, error } = await supabase.from('fee_concessions').select('*').order('created_at', { ascending: false }).limit(2000)
  if (error) return { rows: [], setupNeeded: missingTable(error), error: missingTable(error) ? null : error.message }
  return { rows: data || [], setupNeeded: false, error: null }
}

export async function countPendingConcessions() {
  const { count, error } = await supabase.from('fee_concessions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return error ? 0 : count || 0
}

// Admin decision. approve → waive the shortfall; reject → it stays due.
export async function decideConcession(c, approve, { by, note } = {}) {
  if (approve && Number(c.shortfall) > CONCESSION_SELF_APPROVE_LIMIT && sameWho(by, c.requested_by || c.collected_by)) {
    throw new Error(`This ₹${Number(c.shortfall).toLocaleString('en-IN')} concession was raised by you — a different admin must approve anything above ₹${CONCESSION_SELF_APPROVE_LIMIT.toLocaleString('en-IN')}.`)
  }
  if (approve && c.reason === 'Other' && String(c.reason_note || '').trim().length < 3 && String(note || '').trim().length < 3) {
    throw new Error('This concession has reason "Other" with no explanation — write the explanation in the decision note before approving.')
  }
  const status = approve ? 'approved' : 'rejected'
  const { error } = await supabase.from('fee_concessions').update({ status, decided_by: by || 'Admin', decided_at: new Date().toISOString(), decision_note: note || null }).eq('id', c.id)
  if (error) throw new Error(error.message)
  const { error: rowErr } = await supabase.from(c.fee_table).update({ concession_status: status, concession_amount: approve ? Number(c.shortfall) : 0 }).eq('id', c.fee_row_id)
  if (rowErr) throw new Error(`Decision saved, but the fee row could not be updated: ${rowErr.message}`)
  try {
    await supabase.from('audit_log').insert({
      action: approve ? 'fee_concession_approved' : 'fee_concession_rejected', changed_by: by || 'Admin', target_id: c.fee_row_id,
      new_values: JSON.stringify({ gcc: c.gcc, student_name: c.student_name, month: c.month, year: c.year, shortfall: c.shortfall, reason: c.reason, note: note || null, receipt_no: c.receipt_no }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
}

// ── Investigation helpers ────────────────────────────────────────────────────
const sum = xs => xs.reduce((s, x) => s + (Number(x.shortfall) || 0), 0)
const groupBy = (rows, key) => Object.values(rows.reduce((m, r) => { const k = key(r) || '—'; (m[k] ||= { key: k, count: 0, total: 0, pending: 0, rejected: 0, students: new Set() }); const g = m[k]; g.count++; g.total += Number(r.shortfall) || 0; if (r.status === 'pending') g.pending++; if (r.status === 'rejected') g.rejected++; g.students.add(r.gcc); return m }, {}))
  .map(g => ({ ...g, students: g.students.size })).sort((a, b) => b.total - a.total)

export function summarise(rows) {
  const by = s => rows.filter(r => r.status === s)
  return {
    pending: { count: by('pending').length, total: sum(by('pending')) },
    approved: { count: by('approved').length, total: sum(by('approved')) },
    rejected: { count: by('rejected').length, total: sum(by('rejected')) },
    byStaff: groupBy(rows, r => r.collected_by),
    byReason: groupBy(rows, r => r.reason),
    // Students given a low fee more than once — worth a closer look.
    repeat: groupBy(rows, r => `${r.gcc}|${r.student_name || ''}`).filter(g => g.count > 1),
  }
}

// Short-paid months in the ledgers with no concession on file (collected
// before approvals existed, or through another path). items: buildAllLedgers output.
export function unexplainedShortPayments(items, concessions) {
  const known = new Set(concessions.map(c => `${c.fee_table}|${c.fee_row_id}`))
  const out = []
  for (const { student, reg } of items) {
    for (const r of reg.rows) {
      if (r.status !== 'short' || !(r.shortBy > 0)) continue
      const rowsFor = r.paid.filter(p => !known.has(`${p.kind === 'flat' ? 'adm_flat_fees' : 'adm_course_fees'}|${p.rowId}`))
      if (!rowsFor.length) continue
      out.push({ student, month: r.month, year: r.year, head: r.head, expected: r.expected, paid: r.paidAmt, shortBy: r.shortBy, payment: rowsFor[rowsFor.length - 1] })
    }
  }
  return out.sort((a, b) => b.shortBy - a.shortBy)
}
