// portalToApplication.js — an approved online application becomes an `admissions` row, so the normal flow
// (collect fee → Enroll → student) carries on from there without retyping anything.
const GENDER = { Boy: 'Male', Girl: 'Female', Other: 'Transgender' }
const nn = v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim())

// → the row to insert into `admissions`. Fee, ledger and student records are created by the callers, not here.
export function applicationRowFromPortal(p, { gcc }) {
  const f = p.form || {}
  const address = [f.address, f.district, f.state, f.pincode].map(nn).filter(Boolean).join(', ')
  return {
    gcc_no: parseInt(gcc, 10),
    applicant_name: nn(p.student_name), dob: p.dob || null, gender: GENDER[f.gender] || nn(f.gender),
    blood_group: nn(f.blood_group), category: nn(f.category), religion: nn(f.religion), mother_tongue: nn(f.mother_tongue),
    referral_source: nn(f.referral) || 'Online admission portal', sibling_gcc: parseInt(f.sibling_gcc, 10) || null,
    course: nn(p.course), batch: nn(p.batch), hostel_type: nn(p.hostel_type) || 'Day Scholar', session: nn(p.session),
    status: 'Admitted', father_name: nn(f.father_name), mother_name: nn(f.mother_name), phone: nn(p.phone), whatsapp: nn(p.phone),
    prev_school: nn(f.prev_school), address: nn(address), instalment_plan: 'monthly',
    remarks: [`Online application ${p.reference_no}`, f.prev_class && `last class ${f.prev_class}`, f.prev_percent && `marks ${f.prev_percent}`, f.remarks].filter(Boolean).join(' · '),
  }
}

// The admission-fee line for collectFee(), from the online payment the applicant already made.
export const feeFromPortal = p => ({
  amount: Number(p.fee_amount) || 0, payDate: p.fee_paid_on || new Date().toLocaleDateString('en-CA'),
  payMode: p.payment_mode === 'Online' ? 'Online (Razorpay)' : (p.payment_mode || 'Online'), txnRef: p.payment_id || null,
})
