// entranceReg.js — rules for online / counter registration of an entrance-exam candidate (pure, import-free so the
// api/entrance functions and the browser form apply exactly the same checks).
export const CLASS_OPTIONS = ['Class 5→6', 'Class 6→7', 'Class 8→9', 'Class 9→10', 'Class 11→12']
export const STATES = ['Manipur', 'Assam', 'Nagaland', 'Mizoram', 'Meghalaya', 'Tripura', 'Arunachal Pradesh', 'Sikkim', 'Other']
export const MEDIUMS = ['English', 'Hindi', 'Manipuri (Meiteilon)']
export const MAX_PHOTO_KB = 200, MAX_SIGN_KB = 100

const todayStr = () => new Date().toLocaleDateString('en-CA')
const clean = v => String(v ?? '').trim()
const digits = v => clean(v).replace(/\D/g, '')

// Is the exam taking applications on `today`? (app_open / app_close are optional dates.)
export function registrationWindow(exam, today = todayStr()) {
  if (!exam) return { open: false, reason: 'This exam could not be found.' }
  if (exam.status === 'Cancelled') return { open: false, reason: 'This exam has been cancelled.' }
  if (exam.status === 'Completed') return { open: false, reason: 'This exam is over.' }
  if (exam.app_open && today < String(exam.app_open).slice(0, 10)) return { open: false, reason: `Applications open on ${String(exam.app_open).slice(0, 10)}.` }
  if (exam.app_close && today > String(exam.app_close).slice(0, 10)) return { open: false, reason: `Applications closed on ${String(exam.app_close).slice(0, 10)}.` }
  return { open: true, reason: '' }
}

export const feeFor = exam => Math.max(0, Number(exam?.application_fee) || 0)

// → { field: message }; empty object = valid. `assets` = { photo, signature } (true/false or data) when they are required.
export function validateRegistration(f = {}, exam, { today = todayStr(), needAssets = true, assets = {} } = {}) {
  const e = {}
  if (!clean(f.student_name)) e.student_name = "Enter the candidate's name"
  else if (clean(f.student_name).length < 3) e.student_name = 'Name looks too short'
  if (!clean(f.dob)) e.dob = 'Select date of birth'
  else {
    const d = new Date(f.dob)
    if (Number.isNaN(d.getTime()) || clean(f.dob) >= today) e.dob = 'Enter a valid date of birth'
    else {
      let age = new Date(today).getFullYear() - d.getFullYear()
      const t = new Date(today)
      if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--
      if (age < 7 || age > 20) e.dob = `Age ${age} is outside the range for this exam — check the date`
    }
  }
  if (!clean(f.gender)) e.gender = 'Select gender'
  if (!clean(f.category)) e.category = 'Select category'
  if (!clean(f.father_name)) e.father_name = "Enter father's / guardian's name"
  if (!clean(f.mother_name)) e.mother_name = "Enter mother's name"
  const ph = digits(f.phone).slice(-10)
  if (!/^[6-9]\d{9}$/.test(ph)) e.phone = 'Enter a valid 10-digit mobile number'
  if (clean(f.alt_phone) && !/^[6-9]\d{9}$/.test(digits(f.alt_phone).slice(-10))) e.alt_phone = 'Enter a valid 10-digit mobile number'
  if (clean(f.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(f.email))) e.email = 'Enter a valid email address'
  if (clean(f.address).length < 8) e.address = 'Enter the full postal address'
  if (!clean(f.state)) e.state = 'Select state'
  if (!clean(f.district)) e.district = 'Enter district'
  if (!/^\d{6}$/.test(clean(f.pincode))) e.pincode = 'Enter a 6-digit PIN code'
  if (!clean(f.class_studying)) e.class_studying = 'Select the class applied for'
  if (!clean(f.school)) e.school = 'Enter the present school'
  if (clean(f.aadhaar) && !/^\d{12}$/.test(digits(f.aadhaar))) e.aadhaar = 'Aadhaar must be 12 digits (or leave blank)'
  if (!f.declared) e.declared = 'Tick the declaration to continue'
  if (needAssets) {
    if (!assets.photo) e.photo = 'Upload a recent passport-size photograph'
    if (!assets.signature) e.signature = 'Upload the candidate\'s signature'
  }
  return e
}

// The columns saved on entrance_candidates. Extras the NTA-style form collects go in reg_details (jsonb).
export function candidatePayload(f = {}) {
  const t = k => clean(f[k]) || null
  return {
    student_name: clean(f.student_name), dob: t('dob'), gender: t('gender'), category: clean(f.category) || 'General',
    father_name: t('father_name'), mother_name: t('mother_name'), phone: digits(f.phone).slice(-10) || null, email: t('email'),
    address: [clean(f.address), clean(f.district), clean(f.state), clean(f.pincode)].filter(Boolean).join(', '),
    school: t('school'), class_studying: t('class_studying'),
    reg_details: {
      nationality: clean(f.nationality) || 'Indian', alt_phone: digits(f.alt_phone).slice(-10) || null, aadhaar_last4: digits(f.aadhaar).slice(-4) || null,
      state: t('state'), district: t('district'), pincode: t('pincode'), medium: t('medium'), pwd: !!f.pwd, pwd_note: t('pwd_note'),
      guardian_occupation: t('guardian_occupation'), annual_income: t('annual_income'),
    },
    declared_at: f.declared ? new Date().toISOString() : null,
  }
}

// What the candidate gets to download. slip = registration confirmation; admit = full admit card.
export function admitCardState(c, exam) {
  if (!c) return { state: 'none', label: 'No application found' }
  const fee = feeFor(exam)
  const paid = c.fee_status === 'Paid' || c.fee_status === 'Waived' || fee === 0
  if (!paid) return { state: 'pay', label: 'Payment pending' }
  if (c.status === 'Hall Ticket Issued' || c.status === 'Appeared') return { state: 'admit', label: 'Admit card ready' }
  return { state: 'slip', label: 'Registered — admit card not issued yet' }
}

// Application number + date of birth is the candidate's "login" for payment, status and the admit card.
export const sameDob = (a, b) => clean(a).slice(0, 10) !== '' && clean(a).slice(0, 10) === clean(b).slice(0, 10)
