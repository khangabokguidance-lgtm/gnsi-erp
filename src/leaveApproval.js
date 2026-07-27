import { supabase } from './supabase'
import { NOTIF_TRIGGERS, dispatchNotification } from './LeaveTab'

// ══════════════════════════════════════════════════════════════
//  SHARED LEAVE APPROVAL LOGIC
//  Mirrors handleHMApprove / handleSuptApprove / decrementBalance /
//  ensureBalanceRow from LeaveTab.jsx exactly, extracted here so
//  Hostel.jsx's roll-call "✓ Approve" button performs the identical
//  DB transition (audit row, quota deduction, SMS) rather than a
//  simplified duplicate that could drift out of sync over time.
//
//  LeaveTab.jsx's own approve buttons still use their local closures
//  (unchanged) — this module is purely for external callers like the
//  roll-call flow in Hostel.jsx.
// ══════════════════════════════════════════════════════════════

const DEFAULT_QUOTAS = {
  'Home Leave':    4,
  'Day Outing':    6,
  'Night Out':     2,
  'Weekend Leave': 2,
  'Emergency':    -1,  // unlimited
}

const currentAcademicYear = () => {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth() + 1
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`
}

async function ensureBalanceRow(studentId, leaveType) {
  const year = currentAcademicYear()
  const { data: existing } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('student_id', studentId)
    .eq('academic_year', year)
    .eq('leave_type', leaveType)
    .maybeSingle()
  if (existing) return existing

  const { data: cfg } = await supabase
    .from('leave_quota_config')
    .select('*')
    .eq('academic_year', year)
    .eq('leave_type', leaveType)
    .maybeSingle()

  const quota     = cfg?.default_quota  ?? DEFAULT_QUOTAS[leaveType] ?? 4
  const unlimited = cfg?.is_unlimited   ?? (DEFAULT_QUOTAS[leaveType] === -1)

  const { data: created } = await supabase
    .from('leave_balances')
    .insert([{
      student_id:    studentId,
      academic_year: year,
      leave_type:    leaveType,
      total_quota:   unlimited ? 999 : quota,
      used:          0,
      remaining:     unlimited ? 999 : quota,
      is_unlimited:  unlimited,
      updated_at:    new Date().toISOString(),
    }])
    .select()
    .single()
  return created
}

async function decrementBalance(studentId, leaveType) {
  const row = await ensureBalanceRow(studentId, leaveType)
  if (!row || row.is_unlimited) return
  await supabase.from('leave_balances').update({
    used:       (row.used || 0) + 1,
    remaining:  Math.max(0, (row.remaining || 0) - 1),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
}

// Check whether approving this record at Superintendent level (the
// level that actually grants the leave) would exceed quota. Returns
// { exceeded, balance } — callers should confirm with the user before
// calling approveLeaveRecord if exceeded is true, mirroring
// LeaveTab.jsx's QuotaExceededModal confirmation step.
export async function checkQuotaBeforeApproval(record) {
  const level = record.approval_level ?? 0
  if (level < 1) return { exceeded: false, balance: null } // HM approval never grants leave itself
  const row = await ensureBalanceRow(record.student_id, record.leave_type)
  if (!row || row.is_unlimited) return { exceeded: false, balance: row }
  return { exceeded: (row.remaining || 0) <= 0, balance: row }
}

// Approves a leave record one level (HM: 0→1, Superintendent: 1→2).
// actorName/actorPhone identify who performed the approval for the
// audit trail and SMS template. Returns the updated fields on success,
// or throws on a DB error so the caller can show it.
export async function approveLeaveRecord(record, actorName, actorPhone = '', remarks = '') {
  const level = record.approval_level ?? 0
  const now = new Date().toISOString()

  if (level === 0) {
    // HM approval: level 0 → 1, status stays Pending (awaiting Superintendent)
    const { error } = await supabase
      .from('leave_records')
      .update({
        approval_level:  1,
        status:          'Pending',
        hm_approved_by:  actorName,
        hm_approved_at:  now,
        rejection_reason: null,
      })
      .eq('id', record.id)
    if (error) throw error

    await supabase.from('leave_approvals').insert([{
      leave_id: record.id, level: 0, action: 'Approved',
      actioned_by: actorName, actioned_at: now, remarks,
    }])

    return { approval_level: 1, status: 'Pending' }
  } else {
    // Superintendent approval: level 1 → 2, status → Approved, grants the leave
    const { error } = await supabase
      .from('leave_records')
      .update({
        approval_level:   2,
        status:           'Approved',
        supt_approved_by: actorName,
        supt_approved_at: now,
        rejection_reason: null,
      })
      .eq('id', record.id)
    if (error) throw error

    await supabase.from('leave_approvals').insert([{
      leave_id: record.id, level: 1, action: 'Approved',
      actioned_by: actorName, actioned_at: now, remarks,
    }])

    await decrementBalance(record.student_id, record.leave_type)

    const approvedRecord = { ...record, status: 'Approved', supt_approved_by: actorName, approval_level: 2 }
    await dispatchNotification(NOTIF_TRIGGERS.APPROVED, approvedRecord, actorName, actorPhone)

    return { approval_level: 2, status: 'Approved' }
  }
}