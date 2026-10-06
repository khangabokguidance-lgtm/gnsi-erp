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

// WhatsApp notice to the admin who approves low fees (wa.me opens a chat; the user taps send).
export const LOW_FEE_ADMIN_WA = '918974298074'
export function lowFeeWaUrl(payload = {}, summary = {}, requestedBy = '') {
  const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
  const lines = [
    '🔔 *Low-fee approval needed*',
    `Student: *${payload.studentName || '—'}* (GCC-${payload.gcc || '—'})`,
    `Class/Batch: ${payload.className || '—'} · Course: ${payload.course || '—'} · ${payload.hostelType || '—'}`,
    `Month(s): ${(summary.months || []).join(', ') || '—'}`,
    `Standard ${inr(summary.standard)} · Offered ${inr(summary.collected)} · *Short ${inr(summary.shortfall)}*`,
    `Reason: ${(summary.reasons || []).join(', ') || '—'}`,
    `Pay mode: ${payload.payMode || '—'}`,
    `Requested by: ${requestedBy || payload.collectedBy || '—'}`,
    '',
    'Please approve or reject in Fees → Low Fees. Nothing is recorded until you approve.',
  ]
  return `https://wa.me/${LOW_FEE_ADMIN_WA}?text=${encodeURIComponent(lines.join('\n'))}`
}

// Automatic send through the server (WhatsApp Cloud API). Resolves { ok, sent?, configured? }.
// Never throws — callers fall back to the wa.me link when it isn't sent.
export async function notifyAdminAuto(requestId, kind) {
  try {
    const r = await fetch('/api/whatsapp-notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, kind }) })
    const j = await r.json().catch(() => ({}))
    return { ok: !!j.ok, sent: !!j.sent || !!j.skipped, ...j }
  } catch (e) { return { ok: false, error: e.message } }
}

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
