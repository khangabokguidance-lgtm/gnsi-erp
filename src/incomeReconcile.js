// incomeReconcile.js — explains "today's income": which Accounts entries make
// it up and how it compares with the fee payments recorded in the fee tables.
//
// Accounts' Today's Income counts every confirmed Income row RECORDED today
// (entry_date). Fees' Today's Fee Collection counts fee payments PAID today
// (pay_date in the fee tables). They differ when Accounts has other income
// (store sales, manual entries, online payments), when income for an earlier
// day was entered today, or when a fee entry and its fee record disagree.
import { supabase } from './supabase'

export const FEE_SOURCES = new Set(['adm_fee', 'flat_fee', 'course_fee', 'advance_fee', 'fee_payment'])
const isConfirmed = e => e.status == null || e.status === '' || e.status === 'Confirmed'
const sum = xs => xs.reduce((s, x) => s + (Number(x.amount) || 0), 0)
const d10 = v => String(v || '').slice(0, 10)
// Fee entries' notes end with "· <receipt no>" (optionally "· note").
const receiptIn = note => (String(note || '').split(' · ').map(s => s.trim()).find(p => /^[A-Z]{2,}[-/]\S+$/.test(p)) || null)

export async function loadTodayIncome(date = new Date().toLocaleDateString('en-CA')) {
  const [acc, adm, flat, crs] = await Promise.all([
    supabase.from('accounts').select('id,type,category,amount,entry_date,payment_date,payment_mode,note,description,source_type,source_ref,status,added_by,created_at')
      .eq('is_soft_deleted', false).eq('type', 'Income').or(`entry_date.eq.${date},payment_date.eq.${date}`).limit(5000),
    supabase.from('adm_fee_collections').select('amount_paid,receipt_no,student_name,adm_app_id').eq('reverted', false).eq('pay_date', date),
    supabase.from('adm_flat_fees').select('amount,receipt_no,student_name,adm_app_id').eq('paid', true).eq('reverted', false).eq('pay_date', date),
    supabase.from('adm_course_fees').select('amount_paid,receipt_no,student_name,adm_app_id').eq('reverted', false).eq('pay_date', date),
  ])
  const err = acc.error || adm.error || flat.error || crs.error
  if (err) throw new Error(err.message)

  const rows = (acc.data || []).map(r => ({ ...r, amount: Number(r.amount) || 0, paidOn: d10(r.payment_date || r.entry_date), recordedOn: d10(r.entry_date), fee: FEE_SOURCES.has(r.source_type), receipt: receiptIn(r.note) }))
  const pending = rows.filter(r => !isConfirmed(r) && r.recordedOn === date)
  const live = rows.filter(isConfirmed)
  const recorded = live.filter(r => r.recordedOn === date)          // = Accounts "Today's Income"
  const received = live.filter(r => r.paidOn === date)              // money that actually came in today

  const feePays = [
    ...(adm.data || []).map(r => ({ amount: Number(r.amount_paid) || 0, receipt: r.receipt_no, name: r.student_name, gcc: r.adm_app_id })),
    ...(flat.data || []).map(r => ({ amount: Number(r.amount) || 0, receipt: r.receipt_no, name: r.student_name, gcc: r.adm_app_id })),
    ...(crs.data || []).map(r => ({ amount: Number(r.amount_paid) || 0, receipt: r.receipt_no, name: r.student_name, gcc: r.adm_app_id })),
  ]
  const feeReceipts = new Set(feePays.map(p => p.receipt).filter(Boolean))
  const acctFeeToday = received.filter(r => r.fee)
  const acctReceipts = new Set(acctFeeToday.map(r => r.receipt).filter(Boolean))

  const groups = [
    { key: 'fee', label: 'Fee payments received today', tone: '#047857', rows: recorded.filter(r => r.fee && r.paidOn === date) },
    { key: 'feeLate', label: 'Fee entries recorded today for an earlier date', tone: '#9a5b00', rows: recorded.filter(r => r.fee && r.paidOn !== date) },
    { key: 'store', label: 'Store sales', tone: '#0e7490', rows: recorded.filter(r => r.source_type === 'store_sale') },
    { key: 'manual', label: 'Manual income entries received today', tone: '#1d3a78', rows: recorded.filter(r => !r.source_type && r.paidOn === date) },
    { key: 'manualLate', label: 'Manual income entered today for money received earlier', tone: '#b42318', rows: recorded.filter(r => !r.source_type && r.paidOn !== date) },
    { key: 'other', label: 'Other income', tone: '#475569', rows: recorded.filter(r => r.source_type && !r.fee && r.source_type !== 'store_sale') },
  ].map(g => ({ ...g, total: sum(g.rows) })).filter(g => g.rows.length)

  return {
    date, groups, pending, pendingTotal: sum(pending),
    recordedTotal: sum(recorded), recordedCount: recorded.length,
    receivedTotal: sum(received), feeTableTotal: sum(feePays), feeTableCount: feePays.length,
    acctFeeTotal: sum(acctFeeToday),
    // Cross-checks between the fee records and Accounts for today.
    inAccountsNotFees: acctFeeToday.filter(r => r.receipt && !feeReceipts.has(r.receipt)),
    inFeesNotAccounts: feePays.filter(p => p.receipt && !acctReceipts.has(p.receipt)),
  }
}
