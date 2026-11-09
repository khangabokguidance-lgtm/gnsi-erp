// studentFields.js — the lists behind the District / Gender / Caste dropdowns (student record, admission, CBT exam).
// Keep MANIPUR_DISTRICTS, GENDERS and CASTES in step with supabase/migrations/20261065_student_district_caste_cbt.sql.
export const MANIPUR_DISTRICTS = [
  'Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong',
  'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul',
]
export const OUTSIDE_MANIPUR = 'Outside Manipur'
export const DISTRICT_OPTIONS = [...MANIPUR_DISTRICTS, OUTSIDE_MANIPUR]
export const GENDERS = ['Male', 'Female', 'Other']
export const CASTES = ['General', 'OBC', 'SC', 'ST']

// A saved value is shown only if it is on the list (old free-text values stay visible, flagged as "other").
export const inList = (list, v) => !v || list.includes(v)
