// crossChecks.js — read-only checks on how the modules connect (pure; the caller fetches the rows
// and passes in the helpers). Each check returns { key, from, to, label, fix, module, items }, where
// `items` are the records that do not line up: [{ id, label }].
const gk = v => String(parseInt(v) || 0)
const isActive = s => (!s.status || s.status === 'Active') && !s.deleted_at

export function crossModuleChecks({ students = [], admissions = [], feeStructures = [], allocations = [], flatRows = [], courseRows = [], admRows = [],
  concessionGccs = new Set(), planGccs = new Set(), entranceAdmitted = [],
  accountRefs = new Set(), sessionStart = '', courseOf, batchOf, canonicalBatch, sourceRef }) {
  const active = students.filter(isActive)
  const label = s => `GCC-${s.gcc_no ?? '—'} · ${s.name || s.applicant_name || 'No name'}`
  const checks = []

  // Admissions → Students: an application marked Enrolled should have a student record.
  const studentGccs = new Set(students.map(s => gk(s.gcc_no)).filter(g => g !== '0'))
  checks.push({ key: 'adm_no_student', from: 'Admissions', to: 'Students', module: 'admissions',
    label: 'Enrolled admissions with no student record', fix: 'Admissions → open the application and press Enroll again, or check the GCC number matches the student.',
    items: admissions.filter(a => a.status === 'Enrolled' && !studentGccs.has(gk(a.gcc_no))).map(a => ({ id: a.id ?? a.gcc_no, label: label(a) })) })

  // Students → Courses: every active student maps to a known course.
  checks.push({ key: 'stu_no_course', from: 'Students', to: 'Courses', module: 'students',
    label: 'Active students with no course', fix: 'Students → edit the student and choose a course and batch.',
    items: active.filter(s => courseOf(s) === 'Unassigned').map(s => ({ id: s.id ?? s.gcc_no, label: label(s) })) })

  // Students → Fees (rates): a fee rate must exist for the student's course, batch and hostel type.
  const rates = new Set(feeStructures.map(f => `${f.course}|${canonicalBatch(f.batch) || f.batch}|${f.hostel_type}`))
  checks.push({ key: 'stu_no_rate', from: 'Students', to: 'Fees', module: 'feesetup',
    label: 'Active students whose course / batch / hostel type has no fee rate this session', fix: 'Fees → Fee Setup → add the missing rate (or fix the student\'s batch or hostel type).',
    items: active.filter(s => {
      const c = courseOf(s); if (c === 'Unassigned') return false
      const b = c === 'Combined Course' ? '—' : batchOf(s)
      return !rates.has(`${c}|${b}|${s.hostel_type}`)
    }).map(s => ({ id: s.id ?? s.gcc_no, label: `${label(s)} · ${courseOf(s)} / ${batchOf(s)} / ${s.hostel_type || 'no hostel type'}` })) })

  // Students → Fees (months): dues are counted from the admission date.
  checks.push({ key: 'stu_no_admdate', from: 'Students', to: 'Fees', module: 'students',
    label: 'Active students with no admission date (fee months and late entries depend on it)', fix: 'Students → edit the student and set the admission date.',
    items: active.filter(s => !s.admission_date).map(s => ({ id: s.id ?? s.gcc_no, label: label(s) })) })

  // Students → Hostel: a Boarder needs an active bed.
  const bedded = new Set(allocations.filter(a => a.status === 'Active').map(a => String(a.student_id)))
  checks.push({ key: 'boarder_no_bed', from: 'Students', to: 'Hostel', module: 'hostel',
    label: 'Boarders with no active hostel bed', fix: 'Hostel → allocate a bed, or change the student\'s hostel type if they are not boarding.',
    items: active.filter(s => s.hostel_type === 'Boarder' && !bedded.has(String(s.id))).map(s => ({ id: s.id ?? s.gcc_no, label: label(s) })) })

  // Fees → Accounts: every payment this session should have an income entry in Accounts.
  const inSession = r => !sessionStart || String(r.pay_date || '') >= sessionStart
  const has = (ref, type) => accountRefs.has(`${ref}|${type}`)
  const missing = []
  for (const r of flatRows) if (r.paid && !r.reverted && inSession(r) && !has(sourceRef.flatFee(r.adm_app_id, r.month, r.year, r.id), 'flat_fee'))
    missing.push({ id: r.id, label: `GCC-${r.adm_app_id} · ${r.month} ${r.year} flat fee · ₹${Number(r.amount || 0).toLocaleString('en-IN')} · ${r.receipt_no || 'no receipt'}` })
  for (const r of courseRows) if (!r.reverted && inSession(r) && !has(sourceRef.courseFee(r.adm_app_id, r.for_month, r.year, r.id), 'course_fee'))
    missing.push({ id: r.id, label: `GCC-${r.adm_app_id} · ${r.for_month} ${r.year} course fee · ₹${Number(r.amount_paid || 0).toLocaleString('en-IN')} · ${r.receipt_no || 'no receipt'}` })
  for (const r of admRows) {
    if (r.reverted || !inSession(r)) continue
    const ok = r.fee_type === 'admission' ? has(sourceRef.admission(r.adm_app_id), 'adm_fee') : r.fee_type === 'advance' ? has(r.id, 'advance_fee') : true
    if (!ok) missing.push({ id: r.id, label: `GCC-${r.adm_app_id} · ${r.description || r.fee_type} · ₹${Number(r.amount_paid || 0).toLocaleString('en-IN')} · ${r.receipt_no || 'no receipt'}` })
  }
  checks.push({ key: 'pay_no_account', from: 'Fees', to: 'Accounts', module: 'accounts',
    label: 'Fee payments this session with no income entry in Accounts', fix: 'Accounts → Reconciliation: check the day\'s income against the fee receipts, then re-save or correct the missing entry.', items: missing })

  // ── Admission → Fees: things promised on the application that Fees has to apply ─────────────────────────────────
  const enrolled = admissions.filter(a => a.status === 'Enrolled')
  const hasAdmFee = new Set(admRows.filter(r => !r.reverted && r.fee_type === 'admission').map(r => gk(r.adm_app_id)))
  const lbl = a => `GCC-${a.gcc_no ?? '—'} · ${a.applicant_name || a.name || 'No name'}`
  checks.push({ key: 'enrolled_no_admfee', from: 'Admissions', to: 'Fees', module: 'fees',
    label: 'Enrolled students with no admission fee on record', fix: 'Fees → Fee Payment: collect the admission fee, or Admissions → Bulk admission fee for migrated students.',
    items: enrolled.filter(a => !hasAdmFee.has(gk(a.gcc_no))).map(a => ({ id: a.id ?? a.gcc_no, label: lbl(a) })) })
  const promised = a => Number(a.scholarship_pct) > 0 || Number(a.concession_amt) > 0 || !!a.sibling_gcc
  checks.push({ key: 'adm_concession_not_in_fees', from: 'Admissions', to: 'Fees', module: 'fees',
    label: 'Scholarship / concession / sibling discount on the application, but none in Fees', fix: 'Admissions → Applications: an admin presses "Apply to Fees" (or adds it in Fees → Concession Register) so dues and receipts apply it. Sibling discounts have no amount on the application, so add those by hand.',
    items: enrolled.filter(a => promised(a) && !concessionGccs.has(gk(a.gcc_no))).map(a => ({ id: a.id ?? a.gcc_no,
      label: `${lbl(a)} · ${[Number(a.scholarship_pct) > 0 && `scholarship ${a.scholarship_pct}%`, Number(a.concession_amt) > 0 && `concession ₹${a.concession_amt}`, a.sibling_gcc && `sibling GCC-${a.sibling_gcc}`].filter(Boolean).join(', ')}` })) })
  checks.push({ key: 'adm_plan_not_set', from: 'Admissions', to: 'Fees', module: 'fees',
    label: 'Instalment plan chosen on the application, but no plan in Fees', fix: 'Fees → Instalment Plans: create the plan for the student (the application only records the choice).',
    items: enrolled.filter(a => a.instalment_plan && a.instalment_plan !== 'monthly' && !planGccs.has(gk(a.gcc_no))).map(a => ({ id: a.id ?? a.gcc_no, label: `${lbl(a)} · ${a.instalment_plan}` })) })

  // ── Admission → Students: a photo should exist on one side or the other ──────────────────────────────────────────
  const stuByGcc = new Map(students.map(s => [gk(s.gcc_no), s]))
  checks.push({ key: 'enrolled_no_photo', from: 'Admissions', to: 'Students', module: 'admissions',
    label: 'Enrolled students with no photo on the application or the student record', fix: 'Students → open the student → upload a photo (it also appears on hall tickets and ID cards).',
    items: enrolled.filter(a => { const s = stuByGcc.get(gk(a.gcc_no)); return !a.photo_url && !(s && (s.photo_url || s.photo_path)) }).map(a => ({ id: a.id ?? a.gcc_no, label: lbl(a) })) })

  // ── Entrance → Admissions: an admitted candidate should become an application ──────────────────────────────────
  const key = (n, d) => `${String(n || '').trim().toLowerCase()}|${String(d || '').slice(0, 10)}`
  const applied = new Set(admissions.map(a => key(a.applicant_name || a.name, a.dob)))
  checks.push({ key: 'ent_no_application', from: 'Entrance', to: 'Admissions', module: 'admissions',
    label: 'Entrance candidates marked Admitted who have no application', fix: 'Admissions → New Application for the candidate (same name and date of birth), then collect the admission fee and Enroll.',
    items: entranceAdmitted.filter(c => !applied.has(key(c.student_name, c.dob))).map(c => ({ id: c.id, label: `${c.application_no || 'No application no.'} · ${c.student_name || 'No name'}${c.dob ? ' · ' + String(c.dob).slice(0, 10) : ''}` })) })

  return checks
}
