// expenditureRules.js — accounting rules for the Expenditure module, as plain functions
// (no React, no Supabase) so the entry form, the Accounting Controls tab and the tests share one definition.
//
// The database enforces the hard rules for MANUAL entries (migration 20261031: ACC-001/002/003);
// these functions give the user the same answer *before* they hit Save, and power the exception report.

export const CONTROL_DEFAULTS = {
  receipt_required_above: 10000,   // null / blank = rule off
  require_txn_ref_for_digital: true,
  block_digital_in_cash_acct: true,
  require_delete_reason: true,
  generic_description_check: true,
  enforce_in_database: true,
}

export const DIGITAL_MODES = ['upi', 'bank', 'card', 'paytm', 'gpay', 'phonepe', 'cheque', 'neft', 'imps', 'rtgs', 'online', 'bank transfer']
export const isDigitalMode = m => DIGITAL_MODES.includes(String(m ?? '').trim().toLowerCase())

export const NATURES = ['Revenue', 'Capital', 'Drawings', 'Advance']
export const NATURE_HELP = {
  Revenue: 'Day-to-day running cost — counts against this period’s surplus',
  Capital: 'Building / equipment that lasts years — an asset, not a one-off expense',
  Drawings: 'Owner’s personal withdrawal — not an institute expense',
  Advance: 'Money lent to staff — recovered later, not an expense',
}

// A manual entry has no source_type / source_ref (fees, store and Razorpay postings carry them).
export const isManual = e => !(e?.source_type) && !(e?.source_ref)
export const isLive = e => !e?.is_soft_deleted && (e?.status == null || e.status === '' || e.status === 'Confirmed')
export const isExpense = e => e?.type === 'Expense'

const clean = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

// ── categories that say nothing about what the money was for ───────────────
const GENERIC_CATS = new Set(['paytm payment', 'paytm', 'gpay', 'gpay business', 'google business', 'google pay', 'phonepe', 'upi', 'bank transfer', 'other', 'others', 'misc', 'miscellaneous', 'expense', 'expenses', 'payment'])
const GENERIC_NOTES = new Set([...GENERIC_CATS, 'cash', 'cash payment', 'bank', 'paid', 'amount', 'money', 'transfer', 'online payment', 'gpay bussiness'])
export const isGenericCategory = c => GENERIC_CATS.has(clean(c).replace(/^\d+/, '').trim())
export const isGenericNote = n => { const c = clean(n); return !c || GENERIC_NOTES.has(c) }

// Spelling variants of the same head → one key, so "Kitchen gi" and "Kitchen item" are not two heads.
const CAT_SYNONYMS = {
  'kitchen gi': 'kitchen', 'kitchen item': 'kitchen', 'kitchen items': 'kitchen',
  'grocery items': 'grocery', 'grocery': 'grocery',
  'cheng or rice': 'rice', 'rice or cheng gi': 'rice', 'cheng ka ibosana': 'rice',
  'water supply': 'water supply', 'hair cut or sam kakpagi': 'haircut', 'hair cutting or sam kakpagi': 'haircut', 'sam kakpagi': 'haircut',
  'saturday chicken': 'saturday chicken', 'saturday fish': 'saturday fish',
  'cleaniness': 'cleaning', 'cleanliness': 'cleaning', 'salary advance': 'salary advance', 'previous salary': 'salary',
  'firewood or sing gi': 'firewood', 'deny bread': 'bread', 'construction': 'construction',
}
export const categoryKey = c => { const k = clean(c).replace(/^\d+/, '').trim(); return CAT_SYNONYMS[k] || k }

// ── capital vs revenue ──────────────────────────────────────────────────────
// An explicit expense_nature always wins. Otherwise derive from the head.
export function natureOf(e) {
  if (NATURES.includes(e?.expense_nature)) return e.expense_nature
  const c = categoryKey(e?.category), n = clean(e?.note)
  if (/\bdrawings?\b/.test(c) || /\bowner drawings?\b/.test(n)) return 'Drawings'
  if (/\badvance\b/.test(c) || /\bsalary advance\b/.test(n)) return 'Advance'
  if (/^(construction|civil work|building|furniture|equipment|machinery)\b/.test(c)) return 'Capital'
  return 'Revenue'
}

// null / blank / non-numeric → the receipt rule is switched off
export const receiptLimit = c => { const v = c?.receipt_required_above; return v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v) }

// ── entry-time validation ───────────────────────────────────────────────────
// row: the form row; ctx: { controls, hasReceipt, canStoreRef }
export function validateExpenseRow(row, ctx = {}) {
  const c = { ...CONTROL_DEFAULTS, ...(ctx.controls || {}) }
  const errors = [], warnings = []
  const amount = Number(row?.amount) || 0
  const digital = isDigitalMode(row?.payment_mode)

  if (digital && c.block_digital_in_cash_acct && (row?.account_type || 'Cash A/c') === 'Cash A/c')
    errors.push(`A ${row.payment_mode} payment cannot be booked to the Cash A/c — choose the bank / UPI account.`)

  if (digital && c.require_txn_ref_for_digital && ctx.canStoreRef !== false && String(row?.txn_ref ?? '').trim().length < 6)
    errors.push(`Enter the payment reference (UTR / transaction id, at least 6 characters) for the ${row.payment_mode} payment.`)

  const lim = receiptLimit(c)
  if (lim != null && amount > lim && !ctx.hasReceipt)
    errors.push(`Attach the bill / receipt — expenses above ₹${lim.toLocaleString('en-IN')} need one.`)

  if (c.generic_description_check) {
    const generic = isGenericNote(row?.note) || clean(row?.note) === categoryKey(row?.category)
    if (isGenericCategory(row?.category) && generic)
      errors.push(`"${row.category}" does not say what the money was for — write what was bought or paid, and to whom.`)
    else if (isGenericNote(row?.note))
      errors.push('The description is too generic — say what the money was spent on.')
  }

  if (amount >= 20000 && amount % 5000 === 0) warnings.push('Round amount — make sure it matches a bill, and attach the bill.')
  if (natureOf(row) === 'Revenue' && /^(construction|civil work|building)\b/.test(categoryKey(row?.category)))
    warnings.push('Construction is usually Capital expenditure — set Nature to Capital if this adds to a building.')
  return { errors, warnings }
}

// ── exception report ────────────────────────────────────────────────────────
const sum = rows => rows.reduce((s, e) => s + (Number(e.amount) || 0), 0)
const mk = (code, severity, title, why, action, rows, extra = {}) => rows.length || extra.always ? { code, severity, title, why, action, rows, total: sum(rows), ...extra } : null

/**
 * entries: ledger rows (any type; non-expenses and voided rows are ignored)
 * opts: { limit (receipt threshold), advanceRegisterIds: Set of account ids already in the advance register, hasVoucherNo }
 */
export function runExceptionChecks(entries, opts = {}) {
  const limit = receiptLimit({ receipt_required_above: opts.limit === undefined ? CONTROL_DEFAULTS.receipt_required_above : opts.limit })
  const ex = (entries || []).filter(e => isExpense(e) && isLive(e))
  const manual = ex.filter(isManual)
  const out = []

  out.push(mk('E1', 'High', 'Payments with no meaningful description',
    'Booked under a head such as “Paytm Payment” or “Other” with no payee or purpose — the money cannot be traced to a purchase.',
    'Add the payee, what was bought and the bill for each; use a real category.',
    manual.filter(e => isGenericCategory(e.category) && (isGenericNote(e.note) || clean(e.note) === categoryKey(e.category)))))

  if (limit != null) out.push(mk('E2', 'High', `Expenses above ₹${limit.toLocaleString('en-IN')} without a receipt`,
    'No bill or receipt is attached, so the amount cannot be verified.',
    'Attach the bill / receipt photo to each entry.',
    manual.filter(e => Number(e.amount) > limit && !e.receipt_url)))

  out.push(mk('E3', 'High', 'Digital payment booked in the Cash A/c',
    'UPI / bank / card payments are shown as cash, so the cash balance is wrong.',
    'Move the entry to the bank / UPI account.',
    manual.filter(e => isDigitalMode(e.payment_mode) && (e.account_type || 'Cash A/c') === 'Cash A/c')))

  out.push(mk('E4', 'Medium', 'Digital payments with no payment reference',
    'There is no UTR / transaction id to match against the bank or UPI statement.',
    'Enter the reference from the payment confirmation.',
    manual.filter(e => isDigitalMode(e.payment_mode) && String(e.txn_ref ?? '').trim().length < 6)))

  out.push(mk('E5', 'High', 'Pay recorded “under table” / without bill',
    'The entry describes unrecorded or off-book payment — a compliance risk (PF / ESI / tax).',
    'Pay and record as normal salary or expense with the right documents.',
    ex.filter(e => /\bunder\s*(the\s*)?table\b|\bwithout\s+bill\b|\bno\s+bill\b/i.test(`${e.note || ''} ${e.description || ''}`))))

  out.push(mk('E6', 'Medium', 'Possible owner / personal items',
    'Wording suggests a personal or owner-related payment mixed with institute costs.',
    'Confirm each; book personal payments to Owner Drawings (Nature = Drawings).',
    ex.filter(e => natureOf(e) !== 'Drawings' && /\b(sir\s+heman|owner|personal|family|home)\b/i.test(e.note || ''))))

  // duplicates: same date + amount + description
  const seen = new Map()
  ex.forEach(e => { const k = `${String(e.entry_date).slice(0, 10)}|${Number(e.amount)}|${clean(e.note)}`; (seen.get(k) || seen.set(k, []).get(k)).push(e) })
  out.push(mk('E7', 'Low', 'Possible duplicate entries',
    'Same date, amount and description appear more than once.',
    'Check whether the payment was really made twice; void the duplicate with a reason.',
    [...seen.values()].filter(g => g.length > 1).flat()))

  // round, repeated lump sums to the same description
  const lump = new Map()
  ex.filter(e => Number(e.amount) >= 10000 && Number(e.amount) % 5000 === 0).forEach(e => { const k = `${clean(e.note)}|${Number(e.amount)}`; (lump.get(k) || lump.set(k, []).get(k)).push(e) })
  out.push(mk('E8', 'Medium', 'Repeated round-sum payments',
    'The same round amount is paid again and again — often a payment on account, not an invoice.',
    'Get invoices and keep a supplier ledger with the balance owed.',
    [...lump.values()].filter(g => g.length > 1).flat()))

  // single-day batches
  const byDay = new Map()
  ex.forEach(e => { const d = String(e.entry_date).slice(0, 10); (byDay.get(d) || byDay.set(d, []).get(d)).push(e) })
  const total = sum(ex)
  out.push(mk('E9', 'Low', 'Heavy batch entry on one date',
    'Many entries share one date, so the dates probably show when they were typed, not when money was spent.',
    'Enter expenses on the day they are paid.',
    [...byDay.values()].filter(g => g.length >= 15 || (total > 0 && sum(g) / total > 0.25 && g.length >= 8)).flat(), { aggregate: true }))

  // category hygiene
  const keys = new Map()
  ex.forEach(e => { const k = categoryKey(e.category); const raw = String(e.category || '').trim(); (keys.get(k) || keys.set(k, new Map()).get(k)).set(raw, (keys.get(k).get(raw) || 0) + 1) })
  const split = [...keys.entries()].filter(([, v]) => v.size > 1)
  if (split.length) out.push({ code: 'E10', severity: 'Low', title: 'Same head spelled several ways',
    why: 'Reports split one head across variants (e.g. “Kitchen gi” / “Kitchen item”).', action: 'Pick one name per head and edit the rest.',
    aggregate: true, rows: ex.filter(e => split.some(([k]) => k === categoryKey(e.category))), total: 0, notes: split.map(([k, v]) => `${k}: ${[...v.keys()].join(' / ')}`) })

  out.push(mk('E11', 'Medium', 'Construction / equipment booked as ordinary expense',
    'Spending that builds an asset is Capital expenditure; counting it as a running cost understates the surplus and hides the asset.',
    'Set Nature = Capital and add the asset to a fixed-asset list.',
    ex.filter(e => natureOf(e) === 'Capital' && !NATURES.includes(e.expense_nature))))

  out.push(mk('E12', 'Medium', 'Salary advances not in the advance register',
    'Money lent to staff is not tracked, so nobody can say what each person still owes.',
    'Import them into Staff Advances and record recoveries.',
    ex.filter(e => natureOf(e) === 'Advance' && !(opts.advanceRegisterIds instanceof Set && opts.advanceRegisterIds.has(String(e.id))))))

  out.push(mk('E13', 'Low', 'Fee corrections or refunds booked as expenses',
    'A mistake in fee entry or a refund should reverse the fee, not appear as an expense.',
    'Correct it in the fee ledger.',
    ex.filter(e => /\bfee\b.*\b(mistake|intry mistake|wrong)\b|\brefund\b/i.test(e.note || '') && isManual(e))))

  // concentration: one voucher head authorising most of the money
  const vh = new Map()
  const headed = manual.filter(e => String(e.voucher_head || '').trim())   // entries with no voucher head say nothing about who authorised them
  headed.forEach(e => { const k = String(e.voucher_head).trim(); vh.set(k, (vh.get(k) || 0) + Number(e.amount)) })
  const [topName, topAmt] = [...vh.entries()].sort((a, b) => b[1] - a[1])[0] || []
  const mt = sum(headed)
  if (mt > 0 && topAmt / mt > 0.6 && headed.length >= 10)
    out.push({ code: 'E14', severity: 'High', title: 'One person accounts for most of the spending',
      why: `${topName} is the voucher head on ${Math.round(topAmt * 100 / mt)}% of manual expense value — no independent check.`,
      action: 'Introduce a second approver for larger entries and review cash-to-digital transfers monthly.',
      aggregate: true, rows: headed.filter(e => String(e.voucher_head).trim() === topName), total: topAmt })

  if (opts.hasVoucherNo) out.push(mk('E15', 'Low', 'Entries without a voucher number',
    'Older entries were made before numbering started.', 'Run backfill_voucher_numbers() once in Supabase.',
    ex.filter(e => !e.voucher_no)))

  const order = { High: 0, Medium: 1, Low: 2 }
  return out.filter(Boolean).sort((a, b) => order[a.severity] - order[b.severity] || b.total - a.total)
}

// ── advances & vendor ledgers ───────────────────────────────────────────────
export function advanceNameFromNote(note) {
  return String(note || '').replace(/salary\s*advance|advance|\(.*?\)|\bfor\b.*$/gi, '').replace(/\s+/g, ' ').trim()
}

// ── advances: match ledger advance payments to the Salary → Advances register ──
const TITLES = new Set(['sir', 'madam', 'miss', 'mr', 'mrs', 'ms', 'dr', 'bro', 'ka', 'che', 'endomcha', 'eteima', 'extra'])
const nameTokens = n => String(n || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(t => t.length >= 3 && !TITLES.has(t))
export const nameMatch = (a, b) => { const A = nameTokens(a), B = nameTokens(b); return A.some(x => B.some(y => x === y || x.startsWith(y) || y.startsWith(x))) }

/**
 * ledger: expense entries with natureOf === 'Advance'; register: [{id, name, amount, issued_month}]
 * An advance is matched when amount, month and person agree; each register row is used once.
 * → { matched: Set<string ledger id>, missing: entries with no register row }
 */
export function reconcileAdvances(ledger, register) {
  const used = new Set(), matched = new Set(), missing = []
  ;(ledger || []).forEach(e => {
    const month = String(e.entry_date).slice(0, 7), who = advanceNameFromNote(e.note)
    const hit = (register || []).find(r => !used.has(r.id) && Number(r.amount) === Number(e.amount) && String(r.issued_month).slice(0, 7) === month && nameMatch(who, r.name))
    if (hit) { used.add(hit.id); matched.add(String(e.id)) } else missing.push(e)
  })
  return { matched, missing }
}

// vendor id → { billed, paid, unbilledPaid, outstanding }
export function vendorLedger(bills, expenses) {
  const out = new Map()
  const get = id => out.get(String(id)) || out.set(String(id), { billed: 0, paid: 0, linkedPaid: 0, unbilledPaid: 0, outstanding: 0, bills: 0 }).get(String(id))
  ;(bills || []).filter(b => b.status !== 'Cancelled').forEach(b => { const v = get(b.vendor_id); v.billed += Number(b.amount); v.bills += 1 })
  ;(expenses || []).filter(e => isExpense(e) && isLive(e) && e.vendor_id).forEach(e => {
    const v = get(e.vendor_id); v.paid += Number(e.amount); if (e.bill_id) v.linkedPaid += Number(e.amount); else v.unbilledPaid += Number(e.amount)
  })
  out.forEach(v => { v.outstanding = v.billed - v.linkedPaid })
  return out
}

// Surplus view that separates what is really an operating cost.
export function accountingView(entries) {
  const live = (entries || []).filter(e => isExpense(e) && isLive(e))
  const t = { Revenue: 0, Capital: 0, Drawings: 0, Advance: 0 }
  live.forEach(e => { t[natureOf(e)] += Number(e.amount) || 0 })
  return { totals: t, operating: t.Revenue, outflow: t.Revenue + t.Capital + t.Drawings + t.Advance }
}
