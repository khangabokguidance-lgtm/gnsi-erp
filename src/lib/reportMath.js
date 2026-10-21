// reportMath.js — pure helpers for the Fees Reports & Export tab.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const isYm = v => /^\d{4}-\d{2}$/.test(v)
const feeMonthKey = (m, y) => { const i = MONTHS.indexOf(m); return i >= 0 && y ? `${y}-${String(i + 1).padStart(2, '0')}` : null }

// Money collected per calendar month, by payment date (the fee month is only a fallback when a row
// has no pay_date). Rows must already be un-reverted / paid. Sorted oldest → newest.
export function monthlyCollection({ flat = [], course = [], adm = [] }) {
  const map = {}
  const add = (r, fallbackKey, type, amt) => {
    const d = String(r.pay_date || '').slice(0, 7)
    const key = isYm(d) ? d : fallbackKey
    if (!key) return
    if (!map[key]) map[key] = { _k: key, Month: isYm(key) ? `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}` : key, 'Flat Fee': 0, 'Course Fee': 0, 'Admission Fee': 0 }
    map[key][type] += amt
  }
  flat.forEach(r => add(r, feeMonthKey(r.month, r.year), 'Flat Fee', Number(r.amount) || 0))
  course.forEach(r => add(r, feeMonthKey(r.for_month, r.year), 'Course Fee', Number(r.amount_paid) || 0))
  adm.forEach(r => add(r, null, 'Admission Fee', Number(r.amount_paid) || 0))
  return Object.values(map).sort((a, b) => a._k.localeCompare(b._k))
    .map(({ _k, ...m }) => ({ ...m, Total: m['Flat Fee'] + m['Course Fee'] + m['Admission Fee'] }))
}

// Which payment rows a report keeps: students passed by the course/hostel/status filters
// (`scope` = Set of GCC keys, null = everyone) and payment date inside [from, to].
export const keepRow = ({ scope = null, from = '', to = '' } = {}) => r =>
  (!scope || scope.has(String(parseInt(r.adm_app_id) || 0))) && (!from || (!!r.pay_date && r.pay_date >= from)) && (!to || (!!r.pay_date && r.pay_date <= to))

// Which calendar month the Month-wise Dues card counts a student's one-time admission fee in:
// the month of the admission date (or, without one, of the first admission payment), exactly as
// it happened — a student admitted in January for the coming session shows in January. Only a
// date before the card's first month, or no date at all, falls back to April of the session
// start. Returns { year, month } (month 0–11).
export function admissionMonth({ admissionDate, firstPaymentDate, sessionStartYear, rangeStart }) {
  const parse = v => { if (!v) return null; const d = new Date(String(v).slice(0, 10) + 'T00:00:00'); return Number.isNaN(d.getTime()) ? null : d }
  const d = parse(admissionDate) || parse(firstPaymentDate)
  if (d && d >= rangeStart) return { year: d.getFullYear(), month: d.getMonth() }
  return { year: sessionStartYear, month: 3 }
}
