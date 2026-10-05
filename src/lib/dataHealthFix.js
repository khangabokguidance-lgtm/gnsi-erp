// "Quick fix" rules for the Student data health screen. Pure — no React or
// Supabase — so the validation can be unit-tested with `npm test`.
// Only checks that can be fixed by writing ONE students column are listed;
// duplicates, phone numbers (several source columns) and photos still go
// through the Students module.

export const HOSTEL_TYPES = ['Boarder', 'Day Boarder', 'Day Scholar']

export const QUICK_FIXES = {
  name: { field: 'name', label: 'Full name', type: 'text' },
  course: { field: 'course', label: 'Course', type: 'text' },
  batch: { field: 'batch', label: 'Batch / Class', type: 'text' },
  hostel: { field: 'hostel_type', label: 'Hostel type', type: 'select', options: HOSTEL_TYPES },
  adm_missing: { field: 'admission_date', label: 'Admission date', type: 'date' },
  adm_future: { field: 'admission_date', label: 'Admission date', type: 'date' },
}

// -> { ok: true, value } | { ok: false, error }
export function validateQuickFix(checkKey, raw, todayStr) {
  const fix = QUICK_FIXES[checkKey]
  if (!fix) return { ok: false, error: 'This issue cannot be fixed here.' }
  const value = String(raw ?? '').trim()
  if (!value) return { ok: false, error: `${fix.label} is required.` }
  if (fix.type === 'select' && !fix.options.includes(value)) return { ok: false, error: `Choose a valid ${fix.label.toLowerCase()}.` }
  if (fix.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return { ok: false, error: 'Enter a valid date.' }
    if (value > todayStr) return { ok: false, error: 'Admission date cannot be in the future.' }
    if (value < '2000-01-01') return { ok: false, error: 'Admission date is too far in the past.' }
  }
  if (fix.type === 'text' && value.length > 120) return { ok: false, error: 'Too long (max 120 characters).' }
  return { ok: true, value }
}
