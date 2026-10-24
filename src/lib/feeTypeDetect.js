// feeTypeDetect.js — work out a student's real hostel type (Boarder / Day Boarder
// / Day Scholar) from what they actually paid, and flag records that disagree.
// Pure: rate lookup is passed in, so it can be tested without the app.
//
// Evidence, from the student's most recent payments (flat and course fees):
//   • each payment is tagged with the hostel type it was charged at (+1 vote)
//   • a payment whose amount equals exactly ONE type's configured rate for that
//     month, course and batch votes for that type (+2) — concessions, custom
//     flat fees and part payments are not evidence, so they are ignored
//   • an active hostel bed votes for Boarder (+3)
// A mismatch is reported when another type has at least 2 points and at least
// double the recorded type's points. High confidence: ≥ 4 points, ≥ 85% of all
// evidence, and nothing for the recorded type.

export const FEE_TYPES = ['Boarder', 'Day Boarder', 'Day Scholar']
export const EVIDENCE_WINDOW = 6

const MONTH_NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 }
export const sessionOfMonthYear = (month, year) => {
  const m = MONTH_NUM[month], y = Number(year)
  if (!m || !y) return null
  const start = m >= 4 ? y : y - 1
  return `${start}-${start + 1}`
}
const gccKey = v => String(parseInt(v) || 0)

// rows: { course: [...adm_course_fees], flat: [...adm_flat_fees] }
// rateOf({ session, course, batch, type, field }) → configured rate (0 if none)
// beds: Set of student ids with an active hostel bed, or null if unknown
export function detectFeeTypes({ students = [], courseRows = [], flatRows = [], rateOf, beds = null, overrideGccs = new Set(), window = EVIDENCE_WINDOW }) {
  const pays = new Map()
  const add = (g, p) => { if (!pays.has(g)) pays.set(g, []); pays.get(g).push(p) }
  for (const r of courseRows) {
    if (r.reverted) continue
    add(gccKey(r.adm_app_id), { kind: 'course', date: String(r.pay_date || ''), id: Number(r.id) || 0, month: r.for_month, year: r.year, amount: Number(r.amount_paid) || 0, tag: r.hostel_type, course: r.course, concession: !!r.concession_status })
  }
  for (const r of flatRows) {
    if (!r.paid || r.reverted) continue
    add(gccKey(r.adm_app_id), { kind: 'flat', date: String(r.pay_date || ''), id: Number(r.id) || 0, month: r.month, year: r.year, amount: Number(r.amount) || 0, tag: r.hostel_type, course: null, concession: !!r.concession_status })
  }
  const out = []
  let matched = 0, noData = 0
  for (const st of students) {
    if ((st.status || 'Active') !== 'Active') continue
    const g = gccKey(st.gcc_no)
    const recorded = st.hostel_type || 'Day Scholar'
    const recent = (pays.get(g) || []).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, window)
    const score = { Boarder: 0, 'Day Boarder': 0, 'Day Scholar': 0 }
    let tagVotes = 0, amountVotes = 0
    const tagged = { Boarder: 0, 'Day Boarder': 0, 'Day Scholar': 0 }, byAmount = { Boarder: 0, 'Day Boarder': 0, 'Day Scholar': 0 }
    for (const p of recent) {
      if (FEE_TYPES.includes(p.tag)) { score[p.tag] += 1; tagged[p.tag]++; tagVotes++ }
      if (p.concession || !(p.amount > 0) || (p.kind === 'flat' && overrideGccs.has(g))) continue
      const field = p.kind === 'flat' ? 'flat_fee' : 'course_fee'
      const course = p.course || st.course || ''
      const session = sessionOfMonthYear(p.month, p.year)
      if (!session) continue
      const hits = FEE_TYPES.filter(t => { const r = rateOf({ session, course, batch: st.batch || '', type: t, field }); return r > 0 && r === p.amount })
      if (hits.length === 1) { score[hits[0]] += 2; byAmount[hits[0]]++; amountVotes++ }
    }
    const hasBed = beds ? beds.has(String(st.id)) : null
    if (hasBed === true) score.Boarder += 3
    const total = FEE_TYPES.reduce((s, t) => s + score[t], 0)
    if (!total) { noData++; continue }
    const top = FEE_TYPES.reduce((a, b) => (score[b] > score[a] ? b : a))
    if (top === recorded || score[top] < 2 || score[top] < 2 * score[recorded] || score[top] === score[recorded]) { matched++; continue }
    const confidence = score[top] >= 4 && score[top] / total >= 0.85 && score[recorded] === 0 ? 'high' : 'medium'
    const evidence = []
    if (tagged[top]) evidence.push(`${tagged[top]} of the last ${recent.length} payment${recent.length === 1 ? '' : 's'} charged as ${top}`)
    if (byAmount[top]) evidence.push(`${byAmount[top]} payment amount${byAmount[top] === 1 ? '' : 's'} match the ${top} rate`)
    if (hasBed === true && top === 'Boarder') evidence.push('holds an active hostel bed')
    if (score[recorded]) evidence.push(`${score[recorded]} point${score[recorded] === 1 ? '' : 's'} still support ${recorded}`)
    out.push({ student: st, recorded, detected: top, confidence, score, evidence, payments: recent.length, tagVotes, amountVotes, hasBed })
  }
  out.sort((a, b) => (a.confidence === b.confidence ? b.score[b.detected] - a.score[a.detected] : a.confidence === 'high' ? -1 : 1))
  return { mismatches: out, matched, noData }
}
