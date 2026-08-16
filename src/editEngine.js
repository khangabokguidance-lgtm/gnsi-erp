// editEngine.js — safe, whitelisted inline editing for Student360 cards.
// ─────────────────────────────────────────────────────────────────────────────
// Student360 is a cross-module VIEW — it must never let someone edit a
// field that some other module's business logic depends on without going
// through that module's own validation (e.g. fee amounts must go through
// feeEngine.js's collectFee, not a raw UPDATE here). So this engine only
// allows editing fields explicitly whitelisted per table below — status
// flags, notes, dates, simple categorical fields — never money amounts,
// payment records, or anything with cross-table side effects.
//
// Every edit is written straight to the real table (the same one each
// module's own screens read from — no shadow/staging table), and logged
// to the EXISTING audit_logs table using the same shape Students.jsx's
// own auditLog() already writes, so edits made here show up in the same
// audit trail as edits made anywhere else in the portal.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// table key -> { column: { label, type, options? } }
// type: 'text' | 'select' | 'date' | 'textarea'
// Deliberately NOT whitelisted anywhere: amount/amount_paid, pay_date,
// pay_mode, txn_ref, reverted (fee integrity fields — must go through
// feeEngine.js), gcc_no, id (identity fields).
export const EDITABLE_FIELDS = {
  students: {
    status: { label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Dropout', 'Passed Out'] },
    house: { label: 'House', type: 'text' },
    hostel_type: { label: 'Hostel Type', type: 'select', options: ['Boarder', 'Day Boarder', 'Day Scholar'] },
    course: { label: 'Course', type: 'text' },
    batch: { label: 'Batch', type: 'text' },
    class_name: { label: 'Class', type: 'text' },
    phone: { label: 'Phone', type: 'text' },
    notes: { label: 'Notes', type: 'textarea' },
  },
  admissions: {
    status: { label: 'Status', type: 'select', options: ['Pending', 'Admitted', 'Rejected', 'Waitlisted'] },
  },
  hostel_allocations: {
    house: { label: 'House', type: 'text' },
  },
  discipline_records: {
    status: { label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Resolved', 'Closed'] },
    remarks: { label: 'Remarks', type: 'textarea' },
  },
  sickbay_records: {
    status: { label: 'Status', type: 'select', options: ['Admitted', 'Discharged'] },
  },
  leave_records: {
    status: { label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
  },
  reception_gatepasses: {
    status: { label: 'Status', type: 'select', options: ['Issued', 'Exited', 'Returned', 'Cancelled'] },
  },
  reception_enquiries: {
    status: { label: 'Status', type: 'select', options: ['Open', 'Follow-up', 'Closed'] },
  },
  reception_parent_items: {
    status: { label: 'Status', type: 'select', options: ['Pending', 'Delivered', 'Collected'] },
  },
  reception_complaints: {
    status: { label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Resolved'] },
  },
}

export function getEditableFields(tableKey) {
  return EDITABLE_FIELDS[tableKey] || null
}

// Same session-reading pattern as Students.jsx's auditLog() — this portal
// uses custom localStorage auth, not Supabase Auth, so user identity has
// to be pulled from gnsi_session rather than supabase.auth.getSession().
function getSessionUserName() {
  try {
    const raw = localStorage.getItem('gnsi_session')
    const session = raw ? JSON.parse(raw) : null
    const user = session?.user || session || null
    return user?.name || user?.username || user?.full_name || user?.role || 'Unknown'
  } catch {
    return 'Unknown'
  }
}

async function auditEdit(tableKey, rowId, field, oldValue, newValue, studentContext) {
  try {
    await supabase.from('audit_logs').insert({
      action: 'student360_field_edit',
      module: 'Student360',
      level: 'info',
      user_id: null,
      user_name: getSessionUserName(),
      metadata: {
        table: tableKey, row_id: rowId, field,
        old_value: oldValue, new_value: newValue,
        student_id: studentContext?.id ?? null,
        student_name: studentContext?.name ?? null,
        gcc_no: studentContext?.gcc_no ?? null,
      },
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    // Audit failure shouldn't block the edit itself, but must be visible
    // somewhere — this is the one case in this file where a silent
    // console.error is the right call rather than surfacing to the UI.
    console.error('editEngine: audit log write failed (edit still applied):', e.message)
  }
}

// Applies one field edit. Rejects anything not in EDITABLE_FIELDS for
// that table — this is the actual enforcement point, not just UI
// convention, so a future card can't accidentally expose a write to a
// field that was never vetted.
export async function editField({ tableKey, rowId, field, oldValue, newValue, studentContext }) {
  const allowed = EDITABLE_FIELDS[tableKey]
  if (!allowed || !allowed[field]) {
    throw new Error(`editField: "${field}" on "${tableKey}" is not in the edit whitelist.`)
  }
  const { error } = await supabase.from(tableKey).update({ [field]: newValue }).eq('id', rowId)
  if (error) throw error
  await auditEdit(tableKey, rowId, field, oldValue, newValue, studentContext)
  return true
}