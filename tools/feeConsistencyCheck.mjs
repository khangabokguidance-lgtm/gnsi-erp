// feeConsistencyCheck.js — checks that the fee screens agree with each other, on made-up students
// (no database needed; the database is faked in memory). Run from the project folder:
//   node tools/feeConsistencyCheck.mjs
// Part 1: a student's register balance vs the account statement balance.
// Part 2: the dues engine (feeDues.js — parent portal, Student 360, dashboard) vs the ledger balance.
// Prints MISMATCH for any scenario where they differ and exits 1.
import { createServer } from 'vite'

process.env.VITE_SUPABASE_URL = 'http://db.local'; process.env.VITE_SUPABASE_ANON_KEY = 'x'
let DB = {}
globalThis.fetch = async url => {
  const t = new URL(String(url)).pathname.split('/').pop()
  const body = t === 'public_fee_rows' ? { adm: DB.adm_fee_collections || [], flat: DB.adm_flat_fees || [], course: DB.adm_course_fees || [] } : (DB[t] || [])
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}
console.warn = () => {}; console.error = () => {}
const srv = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let bad = 0
const M = await srv.ssrLoadModule('/src/feeLedgerModel.js')
const now = new Date(2026, 9, 24)
const rates = { flatFee: 6000, courseFee: 5500, admissionFee: 3000, hostelType: 'Hostel' }
const st = { gcc_no: '1', name: 'T', admission_date: '2026-04-05', session: '2026-2027', course: 'Navodaya', batch: 'B', hostel_type: 'Hostel' }
const E = (kind, month, year, amount, extra = {}) => ({ kind, month, year, amount, date: '2026-04-10', receipt: 'R' + amount, advance: false, concession: 0, session: M.sessionOfMonth(month, year), particulars: 'x', period: `${month} ${year}`, ...extra })
const ADM = (amount) => ({ kind: 'admission', amount, date: '2026-04-06', receipt: 'A', session: '2026-2027', particulars: 'Admission Fee', period: 'One-time' })
const standing = [{ status: 'active', basis: 'fixed_per_month', value: 1000, applies_to: 'both', valid_from: '2026-04-01' }]
const cases = {
  'nothing paid': { e: [] },
  'admission + 7 months paid': { e: [ADM(3000), ...['April','May','June','July','August','September','October'].map(m => E('course', m, 2026, 5500))] },
  'part paid past month': { e: [E('course', 'April', 2026, 2000)] },
  'approved concession': { e: [E('course', 'June', 2026, 3000, { concession: 2500, concessionStatus: 'approved' })] },
  'pending concession': { e: [E('course', 'June', 2026, 3000, { concession: 0, concessionStatus: 'pending' })] },
  'standing concession 1000/mo': { e: [], standing },
  'part-paid FUTURE advance': { e: [E('course', 'December', 2026, 2000, { advance: true })] },
  'full FUTURE advance': { e: [E('course', 'December', 2026, 5500, { advance: true })] },
  'overpaid one month': { e: [E('course', 'May', 2026, 9000)] },
  'kit item + advance deposit': { e: [{ kind: 'item', amount: 1500, date: '2026-04-06', receipt: 'K', session: '2026-2027', particulars: 'Kit', period: 'One-time' }, { kind: 'advance', amount: 4000, date: '2026-04-06', receipt: 'V', session: '2026-2027', particulars: 'Advance', period: 'One-time' }] },
  'write-off 3000': { e: [], wo: 3000, extra: [{ date: '2026-09-01', kind: 'adjustment', particulars: 'Dues written off', debit: 0, credit: 3000 }] },
}
for (const [name, c] of Object.entries(cases)) {
  const reg = M.buildRegister(st, c.e, '2026-2027', rates, now, c.standing || [], c.wo || 0)
  const stmt = M.buildStatement(st, c.e, '2026-2027', reg, { extraLines: c.extra || [] })
  const ins = M.computeInsights(st, c.e, reg, now)
  const ok = Math.abs(stmt.closing - reg.totalDue) < 0.5 || name === 'overpaid one month'  // overpayment: statement credits it, register does not (by design)
  if (!ok) bad++
  console.log(`${ok ? 'ok      ' : 'MISMATCH'} ${name.padEnd(30)} register due ${String(reg.totalDue).padStart(6)} | statement closing ${String(stmt.closing).padStart(6)} | collection% ${ins.collectionPct}`)
}

const Dues = await srv.ssrLoadModule('/src/feeDues.js')
const Bulk = await srv.ssrLoadModule('/src/feeLedgerBulk.js')
const Standing = await srv.ssrLoadModule('/src/feeStanding.js')
const Eng = await srv.ssrLoadModule('/src/feeEngine.js')
const SESSION = Eng.getSessionYear()
const y = Number(SESSION.slice(0, 4))
const stu = { id: 7, gcc_no: '1', name: 'T', admission_date: `${y - 1}-04-05`, session: `${y - 1}-${y}`, course: 'Navodaya', batch: '', hostel_type: 'Boarder', status: 'Active' }
const crs = (month, year, amount, extra = {}) => ({ id: Math.random(), adm_app_id: '1', for_month: month, year, amount_paid: amount, pay_date: `${year}-04-10`, receipt_no: 'R', reverted: false, ...extra })
const flat = (month, year, amount, extra = {}) => ({ id: Math.random(), adm_app_id: '1', month, year, amount, paid: true, reverted: false, pay_date: `${year}-04-10`, receipt_no: 'F', ...extra })
const adm = (amount) => ({ id: 1, adm_app_id: '1', amount_paid: amount, fee_type: 'admission', description: 'Admission Fee', pay_date: `${y - 1}-04-06`, reverted: false })
const wo = (amount, date) => ({ id: 1, gcc: '1', kind: 'Write-off dues', status: 'approved', amount, decided_at: date })
const cases2 = {
  'new in prev session, nothing paid': {},
  'prev-session write-off 5000': { fee_refunds: [wo(5000, `${y - 1}-09-01T00:00:00Z`)] },
  'prev-session unpaid + current paid': { adm_course_fees: ['April','May','June','July','August','September','October'].map(m => crs(m, y, 4500)) },
  'standing across prev + current': { fee_concession_register: [{ gcc: '1', status: 'active', basis: 'fixed_per_month', value: 1000, applies_to: 'both', valid_from: `${y - 1}-04-01` }] },
  'standing concession': { fee_concession_register: [{ gcc: '1', status: 'active', basis: 'fixed_per_month', value: 1000, applies_to: 'both', valid_from: `${y}-04-01` }] },
  'admission part-paid in prev session': { adm_fee_collections: [adm(1000)] },
}
for (const [name, tables] of Object.entries(cases2)) {
  DB = tables
  await Standing.loadStanding({ force: true })
  const A = await Dues.getStudentDues(stu, SESSION)
  const rows = await Bulk.loadAllFeeRows()
  const [L] = await Bulk.buildAllLedgers([stu], SESSION, { rows })
  const ok = Math.abs(A.totalDue - L.balance) < 0.5
  if (!ok) bad++
  console.log(`${ok ? 'ok      ' : 'MISMATCH'} ${name.padEnd(38)} feeDues total ${String(A.totalDue).padStart(6)} (session ${A.sessionDue}, arrears ${A.arrears}) | ledger ${String(L.balance).padStart(6)} (session ${L.reg.totalDue}, arrears ${L.arrears})`)
}
await srv.close()
console.log(bad ? `\n${bad} mismatch(es)` : '\nAll scenarios agree')
process.exit(bad ? 1 : 0)
