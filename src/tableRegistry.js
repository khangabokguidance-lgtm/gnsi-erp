// tableRegistry.js — the map Student360's "data centre" features are built on.
// ─────────────────────────────────────────────────────────────────────────────
// One entry per table that holds student-related records. Each entry says:
//   - which module owns it (for the "open in module" link)
//   - which columns to search against (for global search)
//   - which column identifies the student (for cross-referencing)
//   - how to render one row as a short label (for search results / browser)
//   - orderCol: which column TableBrowser should order/page by
//
// ✦ Bug fix: every orderCol below is now something CONFIRMED by an actual
//   query elsewhere in the codebase (grep across Reception.jsx, Hostel.jsx,
//   Attendance.jsx, Students.jsx, studentProfileLoader.js) — not a guess.
//   TableBrowser previously defaulted to ordering by 'id' for any table
//   without an explicit orderCol, but NOT ONE table in this registry has
//   ever been confirmed to order by 'id' in real usage; hostel_allocations
//   in particular has no confirmed 'id' column at all. That silent
//   ordering failure is why the Table Browser showed "408 total rows" (the
//   count query succeeded) but an empty table (the ordered row fetch
//   failed) for Hostel Allocations. Every entry now states its real
//   ordering column explicitly so this can't happen again for any table —
//   adding a new entry without checking its real query pattern first will
//   reproduce this bug, so always grep for the real .order() call against
//   that table before adding it here.
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
    orderCol: 'created_at',
  },
  {
    key: 'students',
    label: 'Students',
    icon: '🎓',
    module: 'students',
    studentKeyCol: 'gcc_no',
    searchCols: ['name', 'gcc_no', 'admission_no', 'phone', 'course', 'batch', 'house'],
    summarize: r => `${r.name} · ${r.course || '—'} · ${r.batch || '—'}`,
    // Confirmed via studentQueries.js / Students.jsx: students consistently
    // ordered by name, never id.
    orderCol: 'name',
  },
  {
    key: 'adm_fee_collections',
    label: 'Admission Fee Payments',
    icon: '💰',
    module: 'fees',
    studentKeyCol: 'adm_app_id',   // holds gcc_no
    searchCols: ['description', 'pay_mode', 'txn_ref'],
    summarize: r => `₹${r.amount_paid} · ${r.pay_mode || '—'} · ${r.pay_date || '—'}`,
    orderCol: 'pay_date',
  },
  {
    key: 'adm_flat_fees',
    label: 'Flat Fee Payments',
    icon: '💰',
    module: 'fees',
    studentKeyCol: 'adm_app_id',
    searchCols: ['month', 'pay_mode', 'txn_ref'],
    summarize: r => `${r.month} ${r.year} · ₹${r.amount} · ${r.pay_mode || '—'}`,
    orderCol: 'pay_date',
  },
  {
    key: 'adm_course_fees',
    label: 'Course Fee Payments',
    icon: '💰',
    module: 'fees',
    studentKeyCol: 'adm_app_id',
    searchCols: ['for_month', 'course', 'pay_mode', 'txn_ref'],
    summarize: r => `${r.for_month} ${r.year} · ₹${r.amount_paid} · ${r.course || '—'}`,
    orderCol: 'pay_date',
  },
  {
    key: 'attendance_records',
    label: 'Attendance',
    icon: '📋',
    module: 'attendance',
    studentKeyCol: 'gcc_no',
    searchCols: ['student_name', 'gcc_no', 'status'],
    summarize: r => `${r.student_name || 'GCC-' + r.gcc_no} · ${r.status || '—'}`,
    // Confirmed via Attendance.jsx (orders by student_name in the one
    // direct query found) — no confirmed 'id' or date column ordering.
    orderCol: 'student_name',
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
    orderCol: 'exam_date',
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
    // Confirmed via Reception.jsx / studentProfileLoader.js — this is the
    // table that surfaced the orderCol bug (see file header note).
    orderCol: 'created_at',
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
    orderCol: 'date',
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
    orderCol: 'date',
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
    orderCol: 'from_date',
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
    orderCol: 'created_at',
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
    orderCol: 'created_at',
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
    orderCol: 'created_at',
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
    orderCol: 'created_at',
  },
]

export function getTableEntry(key) {
  return TABLE_REGISTRY.find(t => t.key === key) || null
}