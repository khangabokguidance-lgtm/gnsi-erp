// candidateToApplication.js — an entrance-exam candidate who was Admitted becomes an admission application, so the
// normal flow (collect admission fee → Enroll → student) can start without retyping anything.
const COURSE_BY_KEY = { sainik: 'Sainik', navodaya: 'Navodaya', foundation: 'Foundation', '': 'Combined Course' }
const GENDER = { Boy: 'Male', Girl: 'Female', Other: 'Transgender' }
const key = (n, d) => `${String(n || '').trim().toLowerCase()}|${String(d || '').slice(0, 10)}`
export const candidateKey = key

// → the `admissions` row to insert. RMS has no matching course in Admissions, so its course is left for staff to choose.
export function applicationFromCandidate(c, exam, { gcc, session }) {
  const courseKey = exam?.course ?? ''
  const course = courseKey === 'rms' ? null : (COURSE_BY_KEY[courseKey] ?? null)
  return {
    gcc_no: parseInt(gcc, 10), applicant_name: String(c.student_name || '').trim(), dob: c.dob || null, gender: GENDER[c.gender] || c.gender || null,
    category: c.category || null, father_name: c.father_name || null, mother_name: c.mother_name || null, phone: c.phone || null,
    address: c.address || null, prev_school: c.school || null, course, session: session || null, status: 'Admitted', hostel_type: 'Day Scholar',
    remarks: `Admitted via ${exam?.exam_name || 'entrance exam'}${c.application_no ? ` · application ${c.application_no}` : ''}${c.rank ? ` · rank ${c.rank}` : ''}${c.quota ? ` · ${c.quota} quota` : ''}`,
  }
}
