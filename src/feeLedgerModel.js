// feeLedgerModel.js — the calculations behind the Student Fee Ledger's register,
// account statement, insights and reminders. One place, so every view agrees.
//
// Same rules as the dues engine (feeDues.js): fee months follow the April–March
// session, Feb/Mar are flat-fee months, a month isn't due until it starts, and
// months before admission aren't charged.
import {
  MONTHS_LIST, isFlatFeeMonth, feeMonthYearForSession, sessionStartYear,
  isPreAdmissionMonth, normalizeSessionYear, ADM_FEE_BASE,
} from './feeEngine'

export const fmt = n => Number(n || 0).toLocaleString('en-IN')
export const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const escH = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const iso = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const monthIdx = m => new Date(`${m} 1, 2000`).getMonth()

const isJanToMar = m => ['January', 'February', 'March'].includes(m)
// Session a fee month belongs to: Apr–Dec of Y → Y-(Y+1); Jan–Mar of Y → (Y-1)-Y.
export const sessionOfMonth = (month, year) => {
  const y = Number(year)
  if (!month || !y) return null
  const start = isJanToMar(month) ? y - 1 : y
  return `${start}-${start + 1}`
}
export const sessionOfDate = d => {
  if (!d) return null
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  const start = dt.getMonth() + 1 >= 4 ? dt.getFullYear() : dt.getFullYear() - 1
  return `${start}-${start + 1}`
}
export const shortSession = s => { const m = String(s || '').match(/^(\d{4})-(\d{4})$/); return m ? `${m[1]}-${m[2].slice(2)}` : s }
export const prevSession = s => { const st = sessionStartYear(s); return `${st - 1}-${st}` }
export const monthStarted = (month, year, now = new Date()) => new Date(Number(year), monthIdx(month), 1) <= now

// Low-fee concession recorded on a flat/course fee row (see feeConcessions.js):
// only an APPROVED concession counts towards the month; pending/rejected don't.
const concessionOf = r => ({
  rowId: r.id,
  concessionStatus: r.concession_status || null,
  concession: r.concession_status === 'approved' ? Number(r.concession_amount) || 0 : 0,
})

// One normalised entry per payment row, whichever table it came from.
export function toEntries(student, admRows, flatRows, crsRows) {
  const e = []
  for (const r of admRows) e.push({
    kind: r.fee_type === 'advance' ? 'advance' : r.fee_type === 'item' ? 'item' : 'admission',
    date: r.pay_date, receipt: r.receipt_no, amount: Number(r.amount_paid) || 0, mode: r.pay_mode, ref: r.txn_ref, by: r.collected_by,
    particulars: r.description || (r.fee_type === 'admission' ? 'Admission Fee' : 'Admission / Kit'),
    period: 'One-time', category: 'Admission & Kit', session: sessionOfDate(r.pay_date),
  })
  for (const r of flatRows) e.push({
    kind: 'flat', month: r.month, year: Number(r.year), date: r.pay_date, receipt: r.receipt_no, amount: Number(r.amount) || 0,
    mode: r.pay_mode, ref: r.txn_ref, by: r.collected_by, advance: !!r.is_advance, note: r.underpayment_note || null, ...concessionOf(r),
    particulars: 'Monthly Flat Fee', period: `${r.month} ${r.year}`, category: r.hostel_type || student.hostel_type || 'Hostel',
    session: sessionOfMonth(r.month, r.year),
  })
  for (const r of crsRows) e.push({
    kind: 'course', month: r.for_month, year: Number(r.year), date: r.pay_date, receipt: r.receipt_no, amount: Number(r.amount_paid) || 0,
    mode: r.pay_mode, ref: r.txn_ref, by: r.collected_by, advance: !!r.is_advance, note: r.override_note || null, ...concessionOf(r),
    particulars: `Course Fee${r.course ? ' — ' + r.course : ''}${r.subtype ? ' ' + r.subtype : ''}`, period: `${r.for_month} ${r.year}`,
    category: r.course || student.course || 'Course', session: sessionOfMonth(r.for_month, r.year),
  })
  return e.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.receipt || '').localeCompare(String(b.receipt || '')))
}

// Month-wise register for one session.
// rates: the session's rates object, or a function (month, year) → rates when
// the student's hostel type changed mid-session (see hostelHistory.js), so each
// month is expected at the type in effect that month.
export function buildRegister(student, entries, session, rates, now = new Date()) {
  const rateAt = (month, year) => (typeof rates === 'function' ? rates(month, year) : rates)
  const start = sessionStartYear(session)
  const admissionDate = student.admission_date || null
  const rows = MONTHS_LIST.map(month => {
    const year = feeMonthYearForSession(month, session)
    const flat = isFlatFeeMonth(month)
    const head = flat ? 'Flat Fee' : 'Course Fee'
    const R = rateAt(month, year)
    const expected = flat ? Number(R?.flatFee || 0) : Number(R?.courseFee || 0)
    const paid = entries.filter(x => x.kind === (flat ? 'flat' : 'course') && x.month === month && Number(x.year) === year)
    const paidAmt = paid.reduce((s, x) => s + x.amount, 0)
    const waived = paid.reduce((s, x) => s + (x.concession || 0), 0)   // approved low-fee concession
    const concessionPending = paid.some(x => x.concessionStatus === 'pending')
    let status
    if (paid.length) status = paid.some(x => x.advance) ? 'advance' : paidAmt + waived + 0.5 < expected ? 'short' : 'paid'
    else if (isPreAdmissionMonth(month, year, admissionDate)) status = 'before'
    else if (!monthStarted(month, year, now)) status = 'upcoming'
    else status = 'due'
    const shortBy = status === 'short' ? Math.max(0, expected - paidAmt - waived) : 0
    // A part-paid month still owes its shortfall (until an admin approves a concession).
    const due = status === 'due' ? expected : shortBy
    return { month, year, head, hostelType: R?.hostelType || null, expected, paid, paidAmt, waived, concessionPending, status, due, shortBy }
  })
  // Admission fee: shown in the session it was paid in, or — if unpaid — in
  // the student's own session.
  const admEntries = entries.filter(x => x.kind === 'admission')
  const admSession = admEntries[0]?.session || normalizeSessionYear(student.session) || sessionOfDate(admissionDate)
  // A repeater's admission fee is waived.
  const admExpected = student.is_repeater ? 0 : Number((typeof rates === 'function' ? rates.current : rates)?.admissionFee ?? ADM_FEE_BASE)
  const admPaid = admEntries.reduce((s, x) => s + x.amount, 0)
  const admission = admSession === session
    ? { expected: admExpected, paid: admEntries, paidAmt: admPaid, due: Math.max(0, admExpected - admPaid) }
    : null
  const other = entries.filter(x => (x.kind === 'item' || x.kind === 'advance') && x.session === session)
  const totalPaid = rows.reduce((s, r) => s + r.paidAmt, 0) + (admission?.paidAmt || 0) + other.reduce((s, x) => s + x.amount, 0)
  const totalDue = rows.reduce((s, r) => s + r.due, 0) + (admission?.due || 0)
  return { start, rows, admission, other, totalPaid, totalDue, dueMonths: rows.filter(r => r.status === 'due').length }
}

// ── Account statement (Dr/Cr) ───────────────────────────────────────────────
// Charges (debits) are raised on the 1st of each fee month once it has
// started — or when it was paid in advance — and the admission fee on the
// admission date; every payment is a credit. Kit/advance payments are
// charged and paid in the same line. Opening balance = the previous session's
// unpaid dues brought forward.
export function buildStatement(student, entries, session, reg, { openingBalance = 0, from = null, to = null } = {}) {
  const lines = []
  const sessStart = `${sessionStartYear(session)}-04-01`
  if (reg.admission) {
    const date = student.admission_date || reg.admission.paid[0]?.date || sessStart
    lines.push({ date: iso(date) < sessStart ? sessStart : iso(date), kind: 'charge', particulars: 'Admission fee charged', debit: reg.admission.expected, credit: 0 })
  }
  for (const r of reg.rows) {
    if (r.status === 'before' || r.status === 'upcoming') continue
    lines.push({ date: iso(new Date(r.year, monthIdx(r.month), 1)), kind: 'charge', particulars: `${r.head} — ${r.month} ${r.year}${r.status === 'advance' ? ' (advance)' : ''}`, debit: r.expected, credit: 0, month: r.month, year: r.year })
  }
  for (const x of reg.other) lines.push({ date: iso(x.date), kind: 'charge', particulars: `${x.particulars} charged`, debit: x.amount, credit: 0 })
  const paidIn = entries.filter(x => x.session === session)
  for (const x of paidIn) lines.push({ date: iso(x.date), kind: 'payment', particulars: `Received — ${x.particulars}${x.period && x.period !== 'One-time' ? ` (${x.period})` : ''}`, debit: 0, credit: x.amount, receipt: x.receipt, mode: x.mode, note: x.note })
  // An approved low-fee concession settles the rest of that month's charge.
  for (const x of paidIn.filter(p => p.concession > 0)) lines.push({ date: iso(x.date), kind: 'payment', particulars: `Concession approved — ${x.particulars} (${x.period})`, debit: 0, credit: x.concession, receipt: x.receipt, note: 'Low-fee concession approved by admin' })
  // Charges before payments on the same day, then by date.
  lines.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'charge' ? -1 : 1))

  let bal = openingBalance
  const withBal = lines.map(l => ({ ...l, balance: (bal = bal + l.debit - l.credit) }))
  const inRange = l => (!from || l.date >= from) && (!to || l.date <= to)
  const before = withBal.filter(l => from && l.date < from)
  const opening = before.length ? before[before.length - 1].balance : openingBalance
  const shown = withBal.filter(inRange)
  const debits = shown.reduce((s, l) => s + l.debit, 0)
  const credits = shown.reduce((s, l) => s + l.credit, 0)
  const shortPaid = reg.rows.reduce((s, r) => s + (r.shortBy > 0 ? r.shortBy : 0), 0)
  return { opening, lines: shown, debits, credits, closing: opening + debits - credits, shortPaid }
}

// ── Insights ─────────────────────────────────────────────────────────────────
export function computeInsights(student, entries, reg, now = new Date()) {
  // Timeliness for the session on screen: the monthly payments in its register.
  const monthly = reg.rows.flatMap(r => r.paid)
  // Delay = days from the 1st of the fee month to the payment date (advance
  // payments count as 0 — paid before the month began).
  const delays = monthly.filter(x => x.date).map(x => Math.max(0, Math.round((new Date(x.date) - new Date(x.year, monthIdx(x.month), 1)) / 86400000)))
  const onTime = delays.filter(d => d <= 10).length // paid within the first 10 days
  const last = [...entries].filter(x => x.date).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null
  const modes = {}
  for (const x of entries) { const m = x.mode || 'Other'; modes[m] = (modes[m] || 0) + x.amount }
  const expectedSoFar = reg.rows.filter(r => !['before', 'upcoming'].includes(r.status) || r.paidAmt).reduce((s, r) => s + r.expected, 0) + (reg.admission?.expected || 0)
  const paidAgainstThose = reg.rows.reduce((s, r) => s + r.paidAmt + (r.waived || 0), 0) + (reg.admission?.paidAmt || 0)
  const sessionTotal = reg.rows.filter(r => r.status !== 'before').reduce((s, r) => s + r.expected, 0) + (reg.admission?.expected || 0)
  const upcoming = reg.rows.filter(r => r.status === 'upcoming')
  return {
    collectionPct: expectedSoFar ? Math.min(100, Math.round((paidAgainstThose / expectedSoFar) * 100)) : null,
    onTimePct: delays.length ? Math.round((onTime / delays.length) * 100) : null,
    avgDelay: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
    maxDelay: delays.length ? Math.max(...delays) : null,
    last, daysSinceLast: last ? Math.max(0, Math.floor((now - new Date(last.date)) / 86400000)) : null,
    modes: Object.entries(modes).sort((a, b) => b[1] - a[1]),
    advanceMonths: reg.rows.filter(r => r.status === 'advance').length,
    shortMonths: reg.rows.filter(r => r.status === 'short').length,
    sessionTotal, stillToCome: upcoming.reduce((s, r) => s + r.expected, 0), upcomingCount: upcoming.length,
    nextDue: upcoming[0] ? `${upcoming[0].month} ${upcoming[0].year}` : null,
  }
}

// ── Reminders ────────────────────────────────────────────────────────────────
export const parentPhone = s => {
  const raw = s.parent_phone || s.father_phone || s.guardian_phone || s.phone || s.mobile || ''
  const d = String(raw).replace(/\D/g, '')
  if (!d) return null
  return d.length === 10 ? '91' + d : d
}

// arrears: earlier sessions' unpaid dues [{ session, due, months }] (brought forward).
export function reminderText(student, reg, session, arrears = []) {
  const dueRows = reg.rows.filter(r => r.due > 0)
  const lines = [
    ...arrears.map(a => `• Brought forward from ${shortSession(a.session)} (${a.months.join(', ')}) — ₹${fmt(a.due)}`),
    ...(reg.admission?.due ? [`• Admission fee — ₹${fmt(reg.admission.due)}`] : []),
    ...dueRows.map(r => `• ${r.head} ${r.month} ${r.year}${r.status === 'short' ? ' (balance)' : ''} — ₹${fmt(r.due)}`),
  ]
  const total = reg.totalDue + arrears.reduce((t, a) => t + a.due, 0)
  const who = student.father_name ? `Dear ${student.father_name}` : 'Dear Parent/Guardian'
  if (!lines.length) {
    return `${who},\n\nThank you — all fees for ${student.name} (GCC-${student.gcc_no}) are paid up to date for session ${shortSession(session)}.\n\n— Accounts Office, Guidance Navodaya & Sainik Institute, Khangabok`
  }
  return `${who},\n\nThis is a gentle reminder that the following fees for ${student.name} (GCC-${student.gcc_no}, ${[student.course, student.batch].filter(Boolean).join(' · ')}) are pending for session ${shortSession(session)}:\n\n${lines.join('\n')}\n\nTotal due: ₹${fmt(total)}\n\nKindly pay at the institute office at the earliest. Please ignore this message if already paid.\n\n— Accounts Office, Guidance Navodaya & Sainik Institute, Khangabok`
}

// ── Month to be paid ─────────────────────────────────────────────────────────
// Course-fee months (April → January) of `session` that have started, are not
// before admission and have no payment yet — oldest first. `paid` is a Set of
// 'Month|year' keys (any course-fee row counts, the same rule collectFee uses
// to refuse a second payment for a month). With nothing due, `next` is the
// first unpaid month still to come (an advance).
export function courseMonthsDue({ session, paid, admissionDate = null, now = new Date() }) {
  const months = MONTHS_LIST.filter(m => !isFlatFeeMonth(m)).map(month => ({ month, year: feeMonthYearForSession(month, session) }))
    .filter(x => !paid.has(`${x.month}|${x.year}`) && !isPreAdmissionMonth(x.month, x.year, admissionDate))
  const due = months.filter(x => monthStarted(x.month, x.year, now))
  const upcoming = months.filter(x => !monthStarted(x.month, x.year, now))
  return { due, next: due[0] || upcoming[0] || null, isAdvance: !due.length && !!upcoming[0] }
}
