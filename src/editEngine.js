// editEngine.js — inline editing for Student360 cards.
// ─────────────────────────────────────────────────────────────────────────────
// ✦ Policy change: editing is no longer restricted to the field whitelist
//   below. getEditableFields() now falls back to "every column on this row
//   is editable as plain text" for any table/column not explicitly
//   described in EDITABLE_FIELDS — the explicit entries just upgrade a
//   field to a nicer input (select/date/textarea) with labels, they no
//   longer gate whether editing is allowed at all.
//
//   This means Student360 can now write to fields another module's
//   business logic depends on (e.g. fee amounts normally set via
//   feeEngine.js's collectFee) without going through that module's own
//   validation. That's an intentional, explicit trade-off — direct edits
//   here can drift out of sync with whatever a module's own logic expects,
//   so use with care on fields you know are managed elsewhere.
//
//   SYSTEM_LOCKED_FIELDS below stays hard-blocked regardless — editing id/
//   created_at/updated_at directly doesn't bypass business logic, it
//   corrupts row identity and audit history, so no policy choice should
//   ever re-open those.
//
// Every edit is written straight to the real table and logged to the 
// EXISTING audit_logs table. Edits to `students` automatically cascade 
// to `admissions` to prevent drift.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// Never editable from Table Browser, no matter what — these are identity/
// bookkeeping columns, not business data. Editing them doesn't skip some
// other module's validation, it just corrupts the row or its history.
const SYSTEM_LOCKED_FIELDS = new Set(['id', 'created_at', 'updated_at'])

// ── Admissions Sync Map ──
// Mirrors the sync logic from Students.jsx. If a field edited here is in 
// this list, it will automatically push to the corresponding admissions row.
const STUDENT_ADM_SYNC_FIELDS = new Map([
  ['name', 'applicant_name'],
  ['dob', 'dob'],
  ['gender', 'gender'],
  ['blood_group', 'blood_group'],
  ['course', 'course'],
  ['batch', 'batch'],
  ['class_name', 'class_name'],
  ['house', 'house'],
  ['hostel_type', 'hostel_type'],
  ['session', 'session'],
  ['father_name', 'father_name'],
  ['mother_name', 'mother_name'],
  ['phone', 'phone'],
  ['parent_phone', 'parent_phone'],
  ['address', 'address'],
  ['prev_school', 'prev_school'],
  ['referral_source', 'referral_source'],
  ['remarks', 'remarks'],
])

// table key -> { column: { label, type, options? } }
// type: 'text' | 'select' | 'date' | 'textarea'
export const EDITABLE_FIELDS = {
  students: {
    // Core Identity
    name: { label: 'Name', type: 'text' },
    gender: { label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    dob: { label: 'Date of Birth', type: 'date' },
    
    // Academic & Status
    status: { label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Dropout', 'Passed Out', 'Withdrawn'] },
    course: { label: 'Course', type: 'text' },
    batch: { label: 'Batch / Class', type: 'text' },
    session: { label: 'Session', type: 'text' },
    admission_date: { label: 'Admission Date', type: 'date' },
    left_date: { label: 'Left Date', type: 'date' },
    
    // Residence
    house: { label: 'House', type: 'text' },
    hostel_type: { label: 'Hostel Type', type: 'select', options: ['Boarder', 'Day Boarder', 'Day Scholar'] },
    
    // Contact & Parents
    father_name: { label: "Father's Name", type: 'text' },
    mother_name: { label: "Mother's Name", type: 'text' },
    phone: { label: 'Phone', type: 'text' },
    emergency_contact: { label: 'Emergency Contact', type: 'text' },
    address: { label: 'Address', type: 'textarea' },
    
    // Notes & Background
    medical_notes: { label: 'Medical Notes', type: 'textarea' },
    remarks: { label: 'Remarks', type: 'textarea' },
    academic_remarks: { label: 'Academic Remarks', type: 'textarea' },
    prev_school: { label: 'Previous School', type: 'text' },
    referral_source: { label: 'Referral Source', type: 'text' },
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

function defaultFieldDef(column) {
  return { label: column.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), type: 'text' }
}

// Pass the row currently being rendered (any row from that table works —
// only its column names matter) so every column can get a default
// text-editable definition when it's not explicitly described above.
// Without a sampleRow, falls back to just the explicit definitions (or
// null), same as the old whitelist-only behavior — callers that already
// have a row in hand should pass it to get full editability.
export function getEditableFields(tableKey, sampleRow = null) {
  const explicit = EDITABLE_FIELDS[tableKey] || {}
  if (!sampleRow) return EDITABLE_FIELDS[tableKey] || null

  const merged = { ...explicit }
  Object.keys(sampleRow).forEach(col => {
    if (SYSTEM_LOCKED_FIELDS.has(col)) return
    if (!merged[col]) merged[col] = defaultFieldDef(col)
  })
  return merged
}

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
    console.error('editEngine: audit log write failed:', e.message)
  }
}

export async function editField({ tableKey, rowId, field, oldValue, newValue, studentContext }) {
  if (SYSTEM_LOCKED_FIELDS.has(field)) {
    throw new Error(`editField: "${field}" is a system field and can't be edited here.`)
  }

  // 1. Update the primary table
  const { error } = await supabase.from(tableKey).update({ [field]: newValue }).eq('id', rowId)
  if (error) throw error

  // 2. Cascade sync to admissions (if applicable)
  if (tableKey === 'students' && studentContext?.gcc_no) {
    const admCol = STUDENT_ADM_SYNC_FIELDS.get(field)
    if (admCol) {
      // Fire-and-forget sync — if it fails, it logs but doesn't crash the UI edit
      supabase.from('admissions')
        .update({ [admCol]: newValue })
        .eq('gcc_no', studentContext.gcc_no)
        .then(({ error: syncErr }) => {
          if (syncErr) console.error(`editEngine: sync ${field}->${admCol} failed:`, syncErr.message)
        })
    }
  }

  // 3. Log the audit trail
  await auditEdit(tableKey, rowId, field, oldValue, newValue, studentContext)
  
  return true
}