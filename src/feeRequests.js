// feeRequests.js — low-fee payments that wait for an admin BEFORE any money is
// recorded. The collector's full payment is stored as a request (fee_payment_requests,
// migration 20261015_fee_payment_requests.sql); an admin approves/rejects it; only an
// approved request can then be collected (recorded + receipt printed).
import { supabase } from './supabase'
import { CONCESSION_SELF_APPROVE_LIMIT, isSoleAdmin } from './feeConcessions'

const TABLE = 'fee_payment_requests'
export const REQUESTS_SETUP_MSG = 'Low-fee payment requests need the database update 20261015_fee_payment_requests.sql — run it in Supabase (SQL editor).'
export const isMissingRequestsTable = err => !!err && (err.code === '42P01' || err.code === 'PGRST205' || new RegExp(TABLE).test(err.message || ''))
const sameWho = (a, b) => !!String(a || '').trim() && String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

export async function fileFeeRequest({ gcc, studentName, requestedBy, payload, summary }) {
  const shortfall = Number(summary?.shortfall) || 0
  const { data, error } = await supabase.from(TABLE).insert({
    gcc: String(gcc), student_name: studentName || null, requested_by: requestedBy || null,
    payload, summary: summary || null, shortfall, status: 'pending',
  }).select().single()
  return { data, error }
}

export async function loadFeeRequests() {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(500)
  if (error) return { rows: [], setupNeeded: isMissingRequestsTable(error), error: isMissingRequestsTable(error) ? null : error.message }
  return { rows: data || [], setupNeeded: false, error: null }
}

export async function countPendingFeeRequests() {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return error ? 0 : count || 0
}

// Months this request covers, e.g. ["flat:October 2026", "course:September 2026"].
export const requestKeys = r => (r?.payload?.items || [])
  .filter(i => i.kind === 'flat' || i.kind === 'course').map(i => `${i.kind}:${i.month} ${i.year}`)

// Existing live (pending/approved, not yet collected) requests for a student.
export async function openRequestsFor(gcc) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('gcc', String(gcc)).in('status', ['pending', 'approved'])
  return error ? [] : data || []
}

export async function decideFeeRequest(req, approve, { by, note } = {}) {
  if (approve && Number(req.shortfall) > CONCESSION_SELF_APPROVE_LIMIT && sameWho(by, req.requested_by) && !(await isSoleAdmin())) {
    throw new Error(`This ₹${Number(req.shortfall).toLocaleString('en-IN')} request was raised by you — a different admin must approve anything above ₹${CONCESSION_SELF_APPROVE_LIMIT.toLocaleString('en-IN')}.`)
  }
  const { error } = await supabase.from(TABLE).update({
    status: approve ? 'approved' : 'rejected', decided_by: by || 'Admin', decided_at: new Date().toISOString(), decision_note: note || null,
  }).eq('id', req.id).eq('status', 'pending')
  if (error) throw new Error(error.message)
}

export async function markRequestCollected(req, receiptNo) {
  const { error } = await supabase.from(TABLE).update({
    status: 'collected', collected_receipt_no: receiptNo, collected_at: new Date().toISOString(),
  }).eq('id', req.id).eq('status', 'approved')
  if (error) console.warn('Could not mark the request collected:', error.message)
}
