// feeRequestRecord.js — records an APPROVED low-fee request and prints its receipt.
//
// The database only lets an admin write an approved fee concession (RLS + triggers in
// 20260929_fee_concessions.sql / 20261006_fee_integrity_guards.sql), so the payment is
// recorded in the approving admin's session right after approval — not by the collector.
// The collector then prints the receipt from "My low-fee requests".
import { collectFee, rcptNo, today } from './feeEngine'
import { markRequestCollected, notifyAdminAuto } from './feeRequests'
import { printFeeReceipt } from './premiumReceipt'

export async function recordApprovedRequest(req, adminName) {
  const p = req.payload || {}
  const approver = req.decided_by || adminName || 'Admin'
  const items = (p.items || []).map(i => (Number(i.underpaymentAmount) > 0 ? { ...i, concessionApprovedBy: approver } : i))
  const receiptNo = rcptNo('FEE')
  const payDate = today()
  const { total } = await collectFee({ ...p, items, payDate, receiptNo, skipHold: true, skipClashCheck: true })
  await markRequestCollected(req, receiptNo)
  notifyAdminAuto(req.id, 'collected')
  return { receiptNo, total, payDate }
}

// Receipt of an already-recorded request (status 'collected').
export function printRequestReceipt(req) {
  const p = req.payload || {}
  const total = (p.items || []).reduce((t, i) => t + (Number(i.amount) || 0), 0)
  printFeeReceipt({
    receipt_no: req.collected_receipt_no, pay_date: String(req.collected_at || '').slice(0, 10) || today(), pay_mode: p.payMode, txn_ref: p.txnRef,
    collected_by: p.collectedBy, student_name: p.studentName, adm_no: p.admNo, gcc_no: p.gcc, class_name: p.className, course: p.course,
    hostel_type: p.hostelType, items: p.items || [], total,
  })
}
