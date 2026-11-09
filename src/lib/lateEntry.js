// lateEntry.js — find students who joined after the session began (late entry)
// and have started paying fees, pure so it can be tested without the database.
//
// A student is a late entry for a session when their admission date falls after
// the session's April start: the months that ended before they joined are not
// charged (same rule as isPreAdmissionMonth), so their fees start part-way
// through the year. `started` says whether a payment has been recorded yet.
const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']
const calMonth = m => new Date(`${m} 1, 2000`).getMonth()
const monthYear = (m, startYear) => (['January', 'February', 'March'].includes(m) ? startYear + 1 : startYear)
const gccKey = v => String(parseInt(v) || 0)

// sessionYear '2026-2027'. students need gcc_no, name, admission_date.
// courseRows: { adm_app_id, for_month, year, amount_paid, pay_date, reverted }
// flatRows:   { adm_app_id, month, year, amount, pay_date, reverted, paid }
export function detectLateEntryStudents(students, courseRows, flatRows, sessionYear) {
  const startYear = Number(String(sessionYear).slice(0, 4))
  if (!startYear) return []
  const sessionStart = new Date(startYear, 3, 1), sessionEnd = new Date(startYear + 1, 3, 1)

  const paidBy = new Map()   // gcc → [{ month, year, amount, payDate }]
  const add = (g, month, year, amount, payDate) => {
    const k = gccKey(g); if (!paidBy.has(k)) paidBy.set(k, [])
    paidBy.get(k).push({ month, year: Number(year), amount: Number(amount) || 0, payDate })
  }
  for (const r of courseRows || []) if (!r.reverted) add(r.adm_app_id, r.for_month, r.year, r.amount_paid, r.pay_date)
  for (const r of flatRows || []) if (!r.reverted && r.paid !== false) add(r.adm_app_id, r.month, r.year, r.amount, r.pay_date)

  const out = []
  for (const s of students || []) {
    const adm = s.admission_date ? new Date(s.admission_date) : null
    if (!adm || Number.isNaN(adm.getTime()) || adm < sessionStart || adm >= sessionEnd) continue
    // First chargeable month: the one the student joined in.
    const firstIdx = MONTHS.findIndex(m => { const y = monthYear(m, startYear); return new Date(y, calMonth(m) + 1, 0) >= adm })
    if (firstIdx <= 0) continue   // joined in April (or before): not a late entry
    const skipped = MONTHS.slice(0, firstIdx)
    const rows = (paidBy.get(gccKey(s.gcc_no)) || []).filter(r => MONTHS.includes(r.month))
      .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month))
      .filter(r => monthYear(r.month, startYear) === r.year)   // this session only
    const first = rows[0] || null
    out.push({
      gcc_no: s.gcc_no, name: s.name, admission_date: String(s.admission_date).slice(0, 10),
      firstFeeMonth: `${MONTHS[firstIdx]} ${monthYear(MONTHS[firstIdx], startYear)}`,
      monthsNotCharged: skipped,
      started: rows.length > 0,
      firstPaidMonth: first ? `${first.month} ${first.year}` : null,
      totalPaid: rows.reduce((t, r) => t + r.amount, 0),
      // Paid first for a later month than the one they joined in → earlier joining months still unpaid.
      skippedJoiningMonth: !!first && MONTHS.indexOf(first.month) > firstIdx,
    })
  }
  return out.sort((a, b) => Number(a.started) - Number(b.started) || String(a.admission_date).localeCompare(b.admission_date))
}
