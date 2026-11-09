// backupTables.js — which tables are backed up, exported and importable.
// ─────────────────────────────────────────────────────────────────────────────
// Plain data with no imports, so the server-side daily backup (server/backup.js)
// and the System Settings export / import screens use the same list.
//   tier 'daily'  → in every nightly backup
//   tier 'weekly' → large tables, added to the Sunday backup only
//   pk            → column used to order pages and to match rows on import
//   noExport / noImport → left out of the on-screen export / import
//                         (the server backup still includes noExport tables)

export const BACKUP_TABLES = [
  { name: 'students',              label: 'Students',                 group: 'Students & admissions', tier: 'daily' },
  { name: 'admissions',            label: 'Admissions',               group: 'Students & admissions', tier: 'daily' },
  { name: 'adm_fee_collections',   label: 'Admission fee payments',   group: 'Fees & accounts', tier: 'daily' },
  { name: 'adm_flat_fees',         label: 'Monthly flat fee payments', group: 'Fees & accounts', tier: 'daily' },
  { name: 'adm_course_fees',       label: 'Course fee payments',      group: 'Fees & accounts', tier: 'daily' },
  { name: 'student_fee_overrides', label: 'Special flat fees',        group: 'Fees & accounts', tier: 'daily' },
  { name: 'fee_structures',        label: 'Fee structures',           group: 'Fees & accounts', tier: 'daily' },
  { name: 'accounts',              label: 'Accounts entries',         group: 'Fees & accounts', tier: 'daily' },
  { name: 'leave_records',         label: 'Hostel leave records',     group: 'Hostel', tier: 'daily' },
  { name: 'hostel_allocations',    label: 'Hostel allocations',       group: 'Hostel', tier: 'daily' },
  { name: 'discipline_records',    label: 'Discipline records',       group: 'Hostel', tier: 'daily' },
  { name: 'sickbay_records',       label: 'Sickbay records',          group: 'Hostel', tier: 'daily' },
  { name: 'houses',                label: 'Houses',                   group: 'Hostel', tier: 'daily' },
  { name: 'housemasters',          label: 'Housemasters',             group: 'Hostel', tier: 'daily' },
  { name: 'exam_types',            label: 'Exam types',               group: 'Exams', tier: 'daily' },
  { name: 'exam_schedule',         label: 'Exam schedule',            group: 'Exams', tier: 'daily' },
  { name: 'staff_profiles',        label: 'Staff profiles',           group: 'Staff & settings', tier: 'daily' },
  { name: 'system_settings',       label: 'System settings',          group: 'Staff & settings', tier: 'daily', pk: 'key' },
  { name: 'portal_users',          label: 'Portal logins',            group: 'Staff & settings', tier: 'daily', noExport: true, noImport: true },
  { name: 'attendance_records',    label: 'Attendance and roll call records', group: 'Large tables (weekly backup)', tier: 'weekly' },
  { name: 'exam_marks',            label: 'Exam marks',               group: 'Large tables (weekly backup)', tier: 'weekly' },
  { name: 'staff_geo_attendance',  label: 'Staff GPS attendance',     group: 'Large tables (weekly backup)', tier: 'weekly' },
  { name: 'teaching_logs',         label: 'Teaching logs',            group: 'Large tables (weekly backup)', tier: 'weekly' },
  { name: 'qbank_questions',       label: 'Question bank',            group: 'Large tables (weekly backup)', tier: 'weekly' },
  { name: 'audit_log',             label: 'Audit log',                group: 'Large tables (weekly backup)', tier: 'weekly', noImport: true },
]

export const pkOf = name => BACKUP_TABLES.find(t => t.name === name)?.pk || 'id'
export const exportableTables = () => BACKUP_TABLES.filter(t => !t.noExport)
export const importableNames = () => new Set(BACKUP_TABLES.filter(t => !t.noImport).map(t => t.name))
export const tablesForTier = weekly => BACKUP_TABLES.filter(t => t.tier === 'daily' || weekly)
