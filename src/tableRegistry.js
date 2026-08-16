// tableRegistry.js — the map Student360's "data centre" features are built on.
// ─────────────────────────────────────────────────────────────────────────────
// One entry per table that holds student-related records. Each entry says:
//   - which module owns it (for the "open in module" link)
//   - which columns to search against (for global search)
//   - which column identifies the student (for cross-referencing)
//   - how to render one row as a short label (for search results / browser)
//
// Adding a new table to Student360's search/browser/export features means
// adding ONE entry here — not touching search logic, export logic, or the
// browser UI, all of which just iterate this registry.
// ─────────────────────────────────────────────────────────────────────────────

export const TABLE_REGISTRY = [
  {
    key: 'admissions',
    label: 'Admissions',
    icon: '📝',
    module: 'admissions',
    studentKeyCol: 'gcc_no',
    searchCols: ['name', 'gcc_no', 'phone', 'course', 'status'],
    summarize: r => `${r.name || 'GCC-' + r.gcc_no} · ${r.course || '—'} · ${r.status || '—'}`,
  },
  {
    key: 'students',
    label: 'Students',
    icon: '🎓',
    module: 'students',
    studentKeyCol: 'gcc_no',
    searchCols: ['name', 'gcc_no', 'admission_no', 'phone', 'course', 'batch', 'house'],
    summarize: r => `${r.name} · ${r.course || '—'} · ${r.batch || '—'}`,
  },
  {
    key: 'adm_fee_collections',
    label: 'Admission Fee Payments',
    icon: '💰',
    module: 'fees',
    studentKeyCol: 'adm_app_id',   // holds gcc_no
    searchCols: ['description', 'pay_mode', 'txn_ref'],
    summarize: r => `₹${r.amount_paid} · ${r.pay_mode || '—'} · ${r.pay_date || '—'}`,
  },
  {
    key: 'adm_flat_fees',
    label: 'Flat Fee Payments',
    icon: '💰',
    module: 'fees',
    studentKeyCol: 'adm_app_id',
    searchCols: ['month', 'pay_mode', 'txn_ref'],
    summarize: r => `${r.month} ${r.year} · ₹${r.amount} · ${r.pay_mode || '—'}`,
  },
  {
    key: 'adm_course_fees',
    label: 'Course Fee Payments',
    icon: '💰',
    module: 'fees',
    studentKeyCol: 'adm_app_id',
    searchCols: ['for_month', 'course', 'pay_mode', 'txn_ref'],
    summarize: r => `${r.for_month} ${r.year} · ₹${r.amount_paid} · ${r.course || '—'}`,
  },
  {
    key: 'attendance_records',
    label: 'Attendance',
    icon: '📋',
    module: 'attendance',
    studentKeyCol: 'gcc_no',
    searchCols: ['student_name', 'gcc_no', 'status'],
    summarize: r => `${r.student_name || 'GCC-' + r.gcc_no} · ${r.status || '—'}`,
    // No confirmed 'id' ordering column for this table in the codebase —
    // session_id is what every other query in Attendance.jsx orders/joins
    // on, so TableBrowser uses that instead of assuming 'id' exists.
    orderCol: 'session_id',
  },
  {
    key: 'exam_marks',
    label: 'Exam Marks',
    icon: '✏️',
    module: 'exams',
    studentKeyCol: 'student_id',   // internal id, not gcc_no
    studentKeyIsId: true,
    searchCols: ['subject'],
    summarize: r => `${r.subject || '—'} · ${r.marks_obtained ?? '—'} · ${r.exam_date || '—'}`,
  },
  {
    key: 'hostel_allocations',
    label: 'Hostel Allocations',
    icon: '🏠',
    module: 'hostel',
    studentKeyCol: 'student_id',
    studentKeyIsId: true,
    searchCols: ['house'],
    summarize: r => `${r.house || '—'} · ${r.created_at || '—'}`,
  },
  {
    key: 'discipline_records',
    label: 'Discipline',
    icon: '🚩',
    module: 'hostel',
    studentKeyCol: 'student_id',
    studentKeyIsId: true,
    searchCols: ['status', 'category', 'description', 'remarks'],
    summarize: r => `${r.category || 'Discipline'} · ${r.status || '—'} · ${r.date || '—'}`,
  },
  {
    key: 'sickbay_records',
    label: 'Sickbay',
    icon: '🏥',
    module: 'hostel',
    studentKeyCol: 'student_id',
    studentKeyIsId: true,
    searchCols: ['status', 'condition', 'reason'],
    summarize: r => `${r.condition || r.reason || 'Sickbay'} · ${r.status || '—'} · ${r.date || '—'}`,
  },
  {
    key: 'leave_records',
    label: 'Leave Records',
    icon: '🎫',
    module: 'hostel',
    studentKeyCol: 'student_id',
    studentKeyIsId: true,
    searchCols: ['leave_type', 'status'],
    summarize: r => `${r.leave_type || 'Leave'} · ${r.status || '—'} · ${r.from_date || '—'}`,
  },
  {
    key: 'reception_gatepasses',
    label: 'Gate Passes',
    icon: '🪪',
    module: 'reception',
    studentKeyCol: 'student_name',  // keyed by name, not gcc/id — matches Reception.jsx's own pattern
    studentKeyIsName: true,
    searchCols: ['student_name', 'reason', 'status'],
    summarize: r => `${r.student_name || '—'} · ${r.status || '—'} · ${r.reason || '—'}`,
  },
  {
    key: 'reception_enquiries',
    label: 'Enquiries',
    icon: '📞',
    module: 'reception',
    studentKeyCol: 'student_name',
    studentKeyIsName: true,
    searchCols: ['student_name', 'phone', 'subject', 'category', 'status'],
    summarize: r => `${r.student_name || r.phone || '—'} · ${r.subject || r.category || '—'} · ${r.status || '—'}`,
  },
  {
    key: 'reception_parent_items',
    label: 'Parent Items',
    icon: '📦',
    module: 'reception',
    studentKeyCol: 'student_name',
    studentKeyIsName: true,
    searchCols: ['student_name', 'item_type', 'description', 'status'],
    summarize: r => `${r.student_name || '—'} · ${r.item_type || r.description || '—'} · ${r.status || '—'}`,
  },
  {
    key: 'reception_complaints',
    label: 'Complaints',
    icon: '⚠️',
    module: 'reception',
    studentKeyCol: 'student_name',
    studentKeyIsName: true,
    searchCols: ['student_name', 'category', 'status'],
    summarize: r => `${r.student_name || '—'} · ${r.category || '—'} · ${r.status || '—'}`,
  },
]

export function getTableEntry(key) {
  return TABLE_REGISTRY.find(t => t.key === key) || null
}