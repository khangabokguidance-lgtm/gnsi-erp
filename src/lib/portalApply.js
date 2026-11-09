// portalApply.js — the rules of the online admission portal, shared by the public form, the staff console and the
// api/_admission handlers (which keep a byte-identical copy; tests/fees.test.js fails if the two drift). No imports,
// no Supabase: pure functions only, so the server and the browser enforce exactly the same thing.

export const GENDERS = ['Boy', 'Girl', 'Other']
export const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS']
export const STATES = ['Manipur', 'Assam', 'Nagaland', 'Mizoram', 'Meghalaya', 'Tripura', 'Arunachal Pradesh', 'Sikkim', 'Other']
export const MAX_PHOTO_KB = 250
export const MAX_DOC_KB = 1500

// Applicant lifecycle. `Submitted` → (`Docs requested` ↔ `Under review`) → `Approved` | `Rejected` | `Withdrawn`.
export const STATUSES = ['Submitted', 'Under review', 'Docs requested', 'Approved', 'Rejected', 'Withdrawn']
export const OPEN_STATUSES = ['Submitted', 'Under review', 'Docs requested']
// Fee lifecycle. A rejected/withdrawn application that already paid is `Refund due` until the office refunds it.
export const FEE_STATUSES = ['Unpaid', 'Paid', 'Waived', 'Refund due', 'Refunded']

// Documents the office keeps on file. `required` ones must be uploaded (and verified) before an application can be approved.
export const DOC_TYPES = [
  { key: 'birth_proof', label: 'Birth certificate / age proof', required: true },
  { key: 'marksheet', label: 'Last marksheet / report card', required: true },
  { key: 'id_proof', label: 'Aadhaar / parent ID proof', required: false },
  { key: 'caste_cert', label: 'Caste / category certificate', required: false },
  { key: 'transfer_cert', label: 'Transfer certificate', required: false },
  { key: 'other', label: 'Other document', required: false },
]
export const docLabel = key => DOC_TYPES.find(d => d.key === key)?.label || key

const clean = v => String(v ?? '').trim()
const digits = v => String(v ?? '').replace(/\D/g, '')
const todayStr = () => new Date().toLocaleDateString('en-CA')

// The 10 digits of an Indian mobile number, or ''.
export const mobile10 = v => { const d = digits(v).slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : '' }

export function ageOn(dob, today = todayStr()) {
  const d = new Date(dob), t = new Date(today)
  if (Number.isNaN(d.getTime())) return null
  let age = t.getFullYear() - d.getFullYear()
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--
  return age
}

// `options` = what the office has configured for the session: [{ course, batch, hostel_type, admission_fee }]
export function validateApplication(f = {}, options = [], { today = todayStr(), needPhoto = true, hasPhoto = false } = {}) {
  const e = {}
  if (!clean(f.student_name)) e.student_name = "Enter the applicant's name"
  else if (clean(f.student_name).length < 3) e.student_name = 'Name looks too short'
  if (!clean(f.dob)) e.dob = 'Select date of birth'
  else {
    const age = ageOn(f.dob, today)
    if (age === null || clean(f.dob) >= today) e.dob = 'Enter a valid date of birth'
    else if (age < 6 || age > 21) e.dob = `Age ${age} looks wrong — check the date`
  }
  if (!clean(f.gender)) e.gender = 'Select gender'
  if (!clean(f.category)) e.category = 'Select category'
  if (!clean(f.father_name)) e.father_name = "Enter father's / guardian's name"
  if (!clean(f.mother_name)) e.mother_name = "Enter mother's name"
  if (!mobile10(f.phone)) e.phone = 'Enter a valid 10-digit mobile number'
  if (clean(f.alt_phone) && !mobile10(f.alt_phone)) e.alt_phone = 'Enter a valid 10-digit mobile number'
  if (clean(f.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(f.email))) e.email = 'Enter a valid email address'
  if (clean(f.address).length < 8) e.address = 'Enter the full postal address'
  if (!clean(f.state)) e.state = 'Select state'
  if (!clean(f.district)) e.district = 'Enter district'
  if (!/^\d{6}$/.test(clean(f.pincode))) e.pincode = 'Enter a 6-digit PIN code'
  if (!clean(f.prev_school)) e.prev_school = 'Enter the school last attended'
  if (clean(f.aadhaar) && !/^\d{12}$/.test(digits(f.aadhaar))) e.aadhaar = 'Aadhaar must be 12 digits (or leave blank)'
  if (!clean(f.course)) e.course = 'Select the course'
  else if (!clean(f.batch)) e.batch = 'Select the batch'
  else if (!clean(f.hostel_type)) e.hostel_type = 'Select day scholar or boarder'
  else if (!findOption(options, f)) e.course = 'That course / batch / hostel combination is not open for admission'
  if (!f.declared) e.declared = 'Tick the declaration to continue'
  if (needPhoto && !hasPhoto) e.photo = 'Upload a recent passport-size photograph'
  return e
}

export const findOption = (options = [], f = {}) =>
  options.find(o => o.course === clean(f.course) && o.batch === clean(f.batch) && o.hostel_type === clean(f.hostel_type)) || null

// The fee the portal charges online: the admission fee configured for the chosen combination.
export const portalFee = (options, f) => Math.max(0, Number(findOption(options, f)?.admission_fee) || 0)

// Columns kept on the application row itself (searchable); everything else stays in the `form` json.
export function applicationColumns(f = {}) {
  const t = k => clean(f[k]) || null
  return {
    student_name: clean(f.student_name).replace(/\s+/g, ' '),
    dob: clean(f.dob).slice(0, 10),
    phone: mobile10(f.phone),
    email: t('email'),
    course: t('course'), batch: t('batch'), hostel_type: t('hostel_type'),
  }
}

// The complete form as stored (aadhaar reduced to its last 4 digits — the office never needs the whole number).
export function formSnapshot(f = {}) {
  const keep = ['student_name', 'dob', 'gender', 'blood_group', 'category', 'religion', 'mother_tongue', 'father_name', 'mother_name', 'phone', 'alt_phone',
    'email', 'address', 'district', 'state', 'pincode', 'prev_school', 'prev_class', 'prev_percent', 'course', 'batch', 'hostel_type', 'referral', 'sibling_gcc', 'remarks']
  const out = {}
  for (const k of keep) if (clean(f[k]) !== '') out[k] = clean(f[k])
  if (out.phone) out.phone = mobile10(out.phone)
  if (out.alt_phone) out.alt_phone = mobile10(out.alt_phone)
  if (clean(f.aadhaar)) out.aadhaar_last4 = digits(f.aadhaar).slice(-4)
  out.declared_at = new Date().toISOString()
  return out
}

// "AP26-0001": two-digit year of the session start + a running number.
export const referenceNo = (year, seq) => `AP${String(year).slice(-2)}-${String(seq).padStart(4, '0')}`
export function nextReferenceSeq(existing = [], year) {
  const prefix = `AP${String(year).slice(-2)}-`
  let max = 0
  for (const r of existing) {
    const m = String(r.reference_no || r).startsWith(prefix) && /-(\d+)$/.exec(String(r.reference_no || r))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

// Which documents are still missing / not yet verified, given the stored document rows.
export function documentStatus(docs = []) {
  const live = docs.filter(d => d.status !== 'Rejected')
  return DOC_TYPES.map(t => {
    const mine = docs.filter(d => d.doc_type === t.key)
    const ok = mine.find(d => d.status === 'Verified') || null
    const pending = mine.find(d => d.status !== 'Rejected' && d.status !== 'Verified') || null
    const rejected = !ok && !pending && mine.find(d => d.status === 'Rejected') || null
    return { ...t, state: ok ? 'verified' : pending ? 'uploaded' : rejected ? 'rejected' : 'missing', doc: ok || pending || rejected || null, count: live.filter(d => d.doc_type === t.key).length }
  })
}

// Why an application cannot be approved yet: `hard` blockers (closed application, unpaid fee) can never be overridden;
// `docs` (required documents not verified) can be, with a note in the timeline.
export function approvalState(app, docs = []) {
  const hard = [], missing = []
  if (!app) return { hard: ['No application'], docs: [] }
  if (app.status === 'Approved') hard.push('Already approved')
  if (app.status === 'Rejected' || app.status === 'Withdrawn') hard.push(`Application is ${app.status.toLowerCase()}`)
  if (app.fee_status !== 'Paid' && app.fee_status !== 'Waived' && Number(app.fee_amount) > 0) hard.push('Admission fee not paid')
  for (const d of documentStatus(docs)) if (d.required && d.state !== 'verified') missing.push(`${d.label}: ${d.state === 'missing' ? 'not uploaded' : d.state === 'rejected' ? 'rejected, needs re-upload' : 'not verified yet'}`)
  return { hard, docs: missing }
}
export const approvalBlockers = (app, docs) => { const s = approvalState(app, docs); return [...s.hard, ...s.docs] }

// What the applicant sees. Staff statuses are phrased for a parent.
export function applicantStage(app, docs = []) {
  if (!app) return { key: 'none', label: '', tone: 'info', next: '' }
  if (app.status === 'Approved') return { key: 'approved', label: 'Admission confirmed', tone: 'good', next: app.promoted_gcc ? `Your GCC number is ${app.promoted_gcc}. Please visit the office with the original documents.` : 'Please visit the office with the original documents.' }
  if (app.status === 'Rejected') return { key: 'rejected', label: 'Not selected', tone: 'bad', next: app.rejection_reason || 'Please contact the office.' }
  if (app.status === 'Withdrawn') return { key: 'withdrawn', label: 'Withdrawn', tone: 'bad', next: '' }
  if (app.fee_status === 'Unpaid' && Number(app.fee_amount) > 0) return { key: 'pay', label: 'Payment pending', tone: 'warn', next: 'Pay the admission fee to complete your application.' }
  const dstat = documentStatus(docs)
  const missing = dstat.filter(d => d.required && (d.state === 'missing' || d.state === 'rejected'))
  if (app.status === 'Docs requested' || missing.length) return { key: 'docs', label: 'Documents needed', tone: 'warn', next: app.public_note || `Upload: ${missing.map(d => d.label).join(', ')}.` }
  return { key: 'review', label: 'Under review', tone: 'info', next: 'The office is reviewing your application. You will be contacted on your mobile number.' }
}
