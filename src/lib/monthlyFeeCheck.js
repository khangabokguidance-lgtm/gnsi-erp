// monthlyFeeCheck.js — month by month, did each student pay what their COURSE and HOSTEL TYPE require?
// Pure: the rate lookup (and, optionally, the hostel type in force each month) are passed in, so it can be
// tested without the app. Same rateOf contract as feeTypeDetect.js / waiverDetect.js.
//
// For every month in which a student has a payment, per fee kind (course fee, flat fee), the payments are
// added up (a balance paid later joins its month) and compared with the standard rate for that session,
// course, batch and hostel type. Each month gets one verdict:
//   ok          paid exactly the rate
//   short       paid less than the rate
//   excess      paid more than the rate
//   wrong-type  the amount equals ANOTHER hostel type's rate (charged as the wrong type)
//   concession  short, but a concession is recorded on the payment (not an error)
//   no-rate     no standard rate is configured, so it cannot be judged
// Flags (independent of the verdict, shown as `flags`):
//   tag-differs     the payment was charged under a different hostel type than the student had that month
//   course-differs  the payment's course differs from the student's course
// Months with no payment are not listed here — unpaid dues are already covered by the dues grids.

export const FEE_TYPES = ['Boarder', 'Day Boarder', 'Day Scholar']
export const PROBLEM_VERDICTS = ['short', 'excess', 'wrong-type']

const MONTH_NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 }
const sessionOf = (month, year) => {
  const m = MONTH_NUM[month], y = Number(year)
  if (!m || !y) return null
  const s = m >= 4 ? y : y - 1
  return `${s}-${s + 1}`
}
const gccKey = v => String(parseInt(v) || 0)
const r2 = n => Math.round((Number(n) || 0) * 100) / 100

// students: students rows (gcc_no, name, course, batch, hostel_type, status)
// courseRows: adm_course_fees; flatRows: adm_flat_fees (paid rows only are used)
// rateOf({ session, course, batch, type, field, student }) → standard rate, 0 if none
// courseAt(student, month, year) → { course, batch } in force that month (e.g. from course history); defaults to the student's own
// typeAt(student, month, year) → hostel type in force that month (e.g. from hostel history); defaults to
//   the student's current hostel_type
// tolerance: rupees of difference treated as equal
export function checkMonthlyFees({ students = [], courseRows = [], flatRows = [], rateOf, typeAt = null, courseAt = null, tolerance = 0.5 }) {
  const groups = new Map() // `${gcc}|${kind}|${year}|${month}` → payments
  const push = (gcc, kind, month, year, p) => {
    const k = `${gcc}|${kind}|${year}|${month}`
    if (!groups.has(k)) groups.set(k, { gcc, kind, month, year, pays: [] })
    groups.get(k).pays.push(p)
  }
  for (const r of courseRows) {
    if (r.reverted || !r.for_month || !(Number(r.amount_paid) > 0)) continue
    push(gccKey(r.adm_app_id), 'course', r.for_month, Number(r.year), { amount: Number(r.amount_paid), tag: r.hostel_type, course: r.course, concession: !!r.concession_status, table: 'adm_course_fees', id: r.id, receipt: r.receipt_no, mode: r.pay_mode })
  }
  for (const r of flatRows) {
    if (!r.paid || r.reverted || !r.month || !(Number(r.amount) > 0)) continue
    push(gccKey(r.adm_app_id), 'flat', r.month, Number(r.year), { amount: Number(r.amount), tag: r.hostel_type, course: null, concession: !!r.concession_status, table: 'adm_flat_fees', id: r.id, receipt: r.receipt_no, mode: r.pay_mode })
  }

  const byGcc = new Map()
  for (const g of groups.values()) { if (!byGcc.has(g.gcc)) byGcc.set(g.gcc, []); byGcc.get(g.gcc).push(g) }

  const out = []
  const summary = { students: 0, withProblems: 0, months: 0, ok: 0, short: 0, excess: 0, 'wrong-type': 0, concession: 0, 'no-rate': 0 }
  for (const st of students) {
    if ((st.status || 'Active') !== 'Active') continue
    const gs = byGcc.get(gccKey(st.gcc_no))
    if (!gs) continue
    summary.students++
    const months = []
    for (const g of gs) {
      const session = sessionOf(g.month, g.year)
      const type = (typeAt && typeAt(st, g.month, g.year)) || st.hostel_type || 'Day Scholar'
      // the course / batch in force that month (a mid-session course change keeps earlier months at the old course)
      const cb = (courseAt && courseAt(st, g.month, g.year)) || { course: st.course || '', batch: st.batch || '' }
      const field = g.kind === 'flat' ? 'flat_fee' : 'course_fee'
      const paid = r2(g.pays.reduce((s, p) => s + p.amount, 0))
      const concession = g.pays.some(p => p.concession)
      const flags = []
      const tags = [...new Set(g.pays.map(p => p.tag).filter(t => FEE_TYPES.includes(t)))]
      if (tags.some(t => t !== type)) flags.push('tag-differs')
      const payCourse = g.pays.map(p => p.course).find(Boolean)
      if (g.kind === 'course' && payCourse && cb.course && payCourse !== cb.course) flags.push('course-differs')

      const rateFor = t => (session ? Number(rateOf({ session, course: cb.course || '', batch: cb.batch || '', type: t, field, student: st })) || 0 : 0)
      const expected = rateFor(type)
      let verdict, detectedType = null
      if (!(expected > 0)) verdict = 'no-rate'
      else if (Math.abs(paid - expected) <= tolerance) verdict = 'ok'
      else {
        const hits = FEE_TYPES.filter(t => t !== type && Math.abs(rateFor(t) - paid) <= tolerance && rateFor(t) > 0)
        if (hits.length === 1) { verdict = 'wrong-type'; detectedType = hits[0] }
        else if (paid < expected) verdict = concession ? 'concession' : 'short'
        else verdict = 'excess'
      }
      summary.months++; summary[verdict]++
      months.push({
        month: g.month, year: g.year, session, kind: g.kind, hostelType: type, course: cb.course || '',
        expected, paid, diff: r2(paid - expected), verdict, detectedType, flags,
        pays: g.pays.map((p) => ({ table: p.table, id: p.id, receipt: p.receipt, mode: p.mode, amount: p.amount })),
      })
    }
    months.sort((a, b) => a.year - b.year || MONTH_NUM[a.month] - MONTH_NUM[b.month] || a.kind.localeCompare(b.kind))
    const problems = months.filter(m => PROBLEM_VERDICTS.includes(m.verdict) || m.flags.length)
    if (problems.length) summary.withProblems++
    out.push({ student: st, months, problems })
  }
  out.sort((a, b) => b.problems.length - a.problems.length || String(a.student.name).localeCompare(String(b.student.name)))
  return { results: out, summary }
}

// Payments that are only a few rupees off the standard rate (e.g. ₹4,998 or ₹6,503 for a ₹5,000 / ₹6,500 fee):
// the month has ONE payment, it is short or over by at most `maxDiff` rupees, no concession is recorded, and it
// was not an online (Razorpay) payment — online money must match what the gateway actually received.
// Each candidate says what the payment should be rounded to (the standard rate) and by how much it moves.
export function roundingCandidates(results, { maxDiff = 10 } = {}) {
  const out = [];
  for (const r of results || []) {
    for (const m of r.months) {
      if (!['short', 'excess'].includes(m.verdict)) continue;
      if (!(Math.abs(m.diff) > 0.005 && Math.abs(m.diff) <= maxDiff)) continue;
      if (m.pays.length !== 1) continue;
      const p = m.pays[0];
      if (!p.id || !p.table || /razorpay|online/i.test(String(p.mode || ''))) continue;
      out.push({ student: r.student, session: m.session, month: m.month, year: m.year, kind: m.kind, table: p.table, id: p.id, receipt: p.receipt || '', mode: p.mode || '', from: p.amount, to: m.expected, diff: m.diff });
    }
  }
  return out;
}
