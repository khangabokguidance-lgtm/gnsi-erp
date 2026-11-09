// feeAdjust.js — saving discounts / waivers from the Fee adjustments panel into the
// concession register (fee_concession_register), plus reading and revoking them.
import { supabase } from './supabase'
import { loadStanding } from './feeStanding'
import { planDiscount, planWaiver } from './lib/adjustPlan'

const SETUP_MSG = 'Run supabase/migrations/20261009_fee_dayclose_refunds_register.sql in the Supabase SQL editor to switch on discounts and waivers.'
const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /fee_concession_register/.test(err.message || ''))

async function insertRows(rows, action, student, extra) {
  const { error } = await supabase.from('fee_concession_register').insert(rows)
  if (error) throw new Error(missingTable(error) ? SETUP_MSG : error.message)
  try { await loadStanding({ force: true }) } catch { /* cache refresh only */ }
  try {
    await supabase.from('audit_log').insert({
      action, changed_by: rows[0]?.approved_by || 'Admin', target_id: String(student.id ?? ''),
      new_values: JSON.stringify({ gcc: student.gcc_no, student_name: student.name, entries: rows.length, ...extra }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
  return rows.length
}

export async function addDiscount(args) {
  const plan = planDiscount(args)
  if (plan.error) throw new Error(plan.error)
  return insertRows(plan.rows, 'fee_discount_added', args.student, { basis: args.basis, value: args.value, months: args.monthKeys, reason: plan.rows[0].reason })
}

export async function addWaiver(args) {
  const plan = planWaiver(args)
  if (plan.error) throw new Error(plan.error)
  return insertRows(plan.rows, 'fee_waiver_added', args.student, { total: plan.total, months: args.items.map(i => i.key), reason: plan.rows[0].reason })
}

// A student's entries on the register (newest first), including revoked ones.
export async function loadStudentRegister(gcc) {
  const { data, error } = await supabase.from('fee_concession_register').select('*').eq('gcc', String(gcc)).order('created_at', { ascending: false })
  if (error) return { rows: [], setupNeeded: missingTable(error), error: missingTable(error) ? null : error.message }
  return { rows: data || [], setupNeeded: false, error: null }
}

export async function revokeEntry(entry, reason, by) {
  const why = String(reason || '').trim()
  if (why.length < 3) throw new Error('Give a reason for removing this.')
  const { error } = await supabase.from('fee_concession_register').update({ status: 'revoked', revoked_reason: why }).eq('id', entry.id)
  if (error) throw new Error(error.message)
  try { await loadStanding({ force: true }) } catch { /* cache refresh only */ }
  try {
    await supabase.from('audit_log').insert({
      action: 'fee_adjustment_revoked', changed_by: by || 'Admin', target_id: String(entry.id),
      new_values: JSON.stringify({ gcc: entry.gcc, student_name: entry.student_name, kind: entry.kind, basis: entry.basis, value: entry.value, valid_from: entry.valid_from, reason: why }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
}
