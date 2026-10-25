import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateExpenseRow, runExceptionChecks, natureOf, isDigitalMode, isGenericCategory,
  categoryKey, vendorLedger, accountingView, advanceNameFromNote, CONTROL_DEFAULTS, nameMatch, reconcileAdvances,
  isGenericText, isPlaceholderName, reasonProblems, entryCategoryChoices, suggestHead, EXPENSE_HEAD_NAMES,
} from '../src/lib/expenditureRules.js'

const E = (o) => ({ type: 'Expense', status: 'Confirmed', is_soft_deleted: false, payment_mode: 'Cash', account_type: 'Cash A/c', ...o })

test('digital modes are recognised, cash is not', () => {
  for (const m of ['UPI', 'Bank', 'Card', 'Paytm', 'gpay', ' NEFT ']) assert.equal(isDigitalMode(m), true, m)
  for (const m of ['Cash', '', null, undefined]) assert.equal(isDigitalMode(m), false, String(m))
})

test('entry rule: UPI payment in Cash A/c is refused (the "Paytm booked as cash" case)', () => {
  const r = validateExpenseRow({ amount: 6000, payment_mode: 'UPI', account_type: 'Cash A/c', txn_ref: 'UTR123456', category: 'Maintenance', note: 'Sagar iron — gate repair' }, { hasReceipt: true })
  assert.equal(r.errors.length, 1); assert.match(r.errors[0], /Cash A\/c/)
})

test('entry rule: digital payment needs a reference; cash does not', () => {
  const base = { amount: 500, account_type: '2026-27 A/c', category: 'Maintenance', note: 'Plumber visit for hostel tap' }
  assert.match(validateExpenseRow({ ...base, payment_mode: 'UPI', txn_ref: '' }, { hasReceipt: true }).errors.join(), /reference/)
  assert.equal(validateExpenseRow({ ...base, payment_mode: 'UPI', txn_ref: '412345678901' }, { hasReceipt: true }).errors.length, 0)
  assert.equal(validateExpenseRow({ ...base, payment_mode: 'Cash', account_type: 'Cash A/c' }, { hasReceipt: true }).errors.length, 0)
})

test('entry rule: reference is not demanded when the database cannot store it yet', () => {
  const r = validateExpenseRow({ amount: 500, payment_mode: 'UPI', account_type: '2026-27 A/c', category: 'Maintenance', note: 'Plumber visit hostel' }, { hasReceipt: true, canStoreRef: false })
  assert.equal(r.errors.length, 0)
})

test('entry rule: receipt required above the limit, not at or below it', () => {
  const row = { amount: 12500, payment_mode: 'Cash', account_type: 'Cash A/c', category: 'Grocery', note: 'Ta Kumar grocery bill 118' }
  const lim = { receipt_required_above: 10000 }
  assert.equal(validateExpenseRow(row, { hasReceipt: false }).errors.length, 0)                     // receipts are optional by default
  assert.match(validateExpenseRow(row, { hasReceipt: false, controls: lim }).errors.join(), /receipt/i) // when a ₹10,000 limit is set
  assert.equal(validateExpenseRow(row, { hasReceipt: true, controls: lim }).errors.length, 0)
  assert.equal(validateExpenseRow({ ...row, amount: 10000 }, { hasReceipt: false, controls: lim }).errors.length, 0) // at the limit: fine
  assert.equal(validateExpenseRow(row, { hasReceipt: false, controls: { receipt_required_above: 50000 } }).errors.length, 0)
  assert.equal(validateExpenseRow(row, { hasReceipt: false, controls: { receipt_required_above: null } }).errors.length, 0) // rule off
  assert.equal(validateExpenseRow(row, { hasReceipt: false, controls: { receipt_required_above: '' } }).errors.length, 0)
  assert.match(validateExpenseRow({ ...row, amount: 3000 }, { hasReceipt: false, controls: { receipt_required_above: 2000 } }).errors.join(), /receipt/i)
})

test('entry rule: "Paytm Payment" with no description is refused; a described one is fine', () => {
  const bad = validateExpenseRow({ amount: 277500, payment_mode: 'UPI', account_type: '2026-27 A/c', txn_ref: 'UTR123456', category: 'Paytm Payment', note: 'Paytm Payment' }, { hasReceipt: true })
  assert.match(bad.errors.join(), /not a real category/); assert.match(bad.errors.join(), /real reason/)
  const ok = validateExpenseRow({ amount: 6000, payment_mode: 'UPI', account_type: '2026-27 A/c', txn_ref: 'UTR123456', category: 'Rice', note: 'Rice 7 bags from Ibosana, bill 214' }, { hasReceipt: true })
  assert.equal(ok.errors.length, 0)
})

test('entry rule: round large amounts warn but do not block', () => {
  const r = validateExpenseRow({ amount: 50000, payment_mode: 'Cash', account_type: 'Cash A/c', category: 'Grocery', note: 'Ta Kumar grocery bill' }, { hasReceipt: true })
  assert.equal(r.errors.length, 0); assert.equal(r.warnings.length, 1)
})

test('nature: construction is Capital, advances are Advance, explicit nature wins', () => {
  assert.equal(natureOf({ category: 'construction' }), 'Capital')
  assert.equal(natureOf({ category: 'Construction' }), 'Capital')
  assert.equal(natureOf({ category: 'salary advance' }), 'Advance')
  assert.equal(natureOf({ category: 'Salary', note: 'Sir Sunder Salary Advance' }), 'Advance')
  assert.equal(natureOf({ category: 'Salary', note: 'Teaching staff salary' }), 'Revenue')
  assert.equal(natureOf({ category: 'construction', expense_nature: 'Revenue' }), 'Revenue')
  assert.equal(natureOf({ category: 'Maintenance' }), 'Revenue')
})

test('category keys fold spelling variants together', () => {
  assert.equal(categoryKey('Kitchen gi'), categoryKey('Kitchen item'))
  assert.equal(categoryKey('21Other'), 'other')
  assert.equal(categoryKey('water Supply'), categoryKey('Water supply'))
  assert.equal(isGenericCategory('Paytm Payment'), true)
  assert.equal(isGenericCategory('Saturday Chicken'), false)
})

test('exception report: receipt check can be switched off', () => {
  const rows = [E({ id: 1, entry_date: '2026-10-01', category: 'Rice', note: 'Rice 7 bags bill 12', amount: 25000, voucher_head: 'A' })]
  assert.equal(runExceptionChecks(rows, { limit: null }).some(c => c.code === 'E2'), false)
  assert.equal(runExceptionChecks(rows, { limit: 10000 }).some(c => c.code === 'E2'), true)
})

test('exception report finds the issues in a ledger shaped like the audited statements', () => {
  const rows = [
    E({ id: 1, entry_date: '2026-10-11', category: 'Paytm Payment', note: 'Paytm Payment', amount: 277500, voucher_head: 'Arun' }),
    E({ id: 2, entry_date: '2026-10-06', category: 'Salary', note: 'Sir Roshan Salary under table', amount: 3500, voucher_head: 'Arun' }),
    E({ id: 3, entry_date: '2026-10-06', category: 'Other', note: 'Sir Heman marup ki', amount: 9000, voucher_head: 'Arun' }),
    E({ id: 4, entry_date: '2026-10-10', category: 'Grocery', note: 'Ta kumar Grocery', amount: 50000, voucher_head: 'Arun' }),
    E({ id: 5, entry_date: '2026-09-27', category: 'Grocery', note: 'Ta kumar Grocery', amount: 50000, voucher_head: 'Arun' }),
    E({ id: 6, entry_date: '2026-10-07', category: 'Vegetables', note: 'Vegetables', amount: 200, voucher_head: 'Arun' }),
    E({ id: 7, entry_date: '2026-10-07', category: 'Vegetables', note: 'Vegetables', amount: 200, voucher_head: 'Arun' }),
    E({ id: 8, entry_date: '2026-10-08', category: 'Paytm Payment', note: 'Bank transfer', amount: 20500, payment_mode: 'UPI', voucher_head: 'Arun' }),
    E({ id: 9, entry_date: '2026-10-08', category: 'construction', note: 'Sagar iron', amount: 6000, voucher_head: 'Arun' }),
    E({ id: 10, entry_date: '2026-10-09', category: 'Kitchen gi', note: 'Kitchen material', amount: 1100, voucher_head: 'Arun' }),
    E({ id: 11, entry_date: '2026-10-09', category: 'Kitchen item', note: 'Machoubi veg', amount: 500, voucher_head: 'Arun' }),
    E({ id: 12, entry_date: '2026-10-09', category: 'Salary', note: 'Ranbir fee intry mistake', amount: 6000, voucher_head: 'Arun' }),
    E({ id: 13, entry_date: '2026-10-09', category: 'Salary', note: 'Sir Manglemba Salary Advance', amount: 500, voucher_head: 'Arun' }),
    E({ id: 99, entry_date: '2026-10-09', category: 'Paytm Payment', note: 'Paytm Payment', amount: 1, is_soft_deleted: true }),   // voided: ignored
    E({ id: 98, entry_date: '2026-10-09', category: 'Paytm Payment', note: 'Paytm Payment', amount: 1, status: 'Pending' }),         // pending: ignored
    { id: 97, type: 'Income', entry_date: '2026-10-09', category: 'Fees', amount: 5000 },                                              // income: ignored
  ]
  const by = Object.fromEntries(runExceptionChecks(rows, { limit: 2000 }).map(c => [c.code, c]))
  assert.deepEqual(by.E1.rows.map(r => r.id).sort((a, b) => a - b), [1, 8])
  assert.deepEqual(by.E2.rows.map(r => r.id).sort((a, b) => a - b), [1, 2, 3, 4, 5, 8, 9, 12])  // every row above the ₹2,000 limit with no receipt
  assert.deepEqual(by.E3.rows.map(r => r.id), [8])
  assert.deepEqual(by.E4.rows.map(r => r.id), [8])
  assert.deepEqual(by.E5.rows.map(r => r.id), [2])
  assert.deepEqual(by.E6.rows.map(r => r.id), [3])
  assert.deepEqual(by.E7.rows.map(r => r.id).sort((a, b) => a - b), [6, 7])
  assert.deepEqual(by.E8.rows.map(r => r.id).sort((a, b) => a - b), [4, 5])
  assert.match(by.E10.notes.join(), /kitchen/)
  assert.deepEqual(by.E11.rows.map(r => r.id), [9])
  assert.deepEqual(by.E12.rows.map(r => r.id), [13])
  assert.deepEqual(by.E13.rows.map(r => r.id), [12])
  assert.equal(by.E14.severity, 'High'); assert.equal(by.E14.aggregate, true)
  // voided / pending / income rows never appear anywhere
  const seen = new Set(Object.values(by).flatMap(c => c.rows.map(r => r.id)))
  for (const id of [97, 98, 99]) assert.equal(seen.has(id), false, `row ${id} must be ignored`)
  // High findings come first
  const sev = runExceptionChecks(rows, { limit: 2000 }).map(c => c.severity)
  assert.deepEqual(sev, [...sev].sort((a, b) => ({ High: 0, Medium: 1, Low: 2 })[a] - ({ High: 0, Medium: 1, Low: 2 })[b]))
})

test('automatic postings (fees / store) are never flagged by the manual-entry checks', () => {
  const rows = [
    E({ id: 1, entry_date: '2026-10-01', category: 'Store Refunds', note: 'Refund', amount: 9000, payment_mode: 'UPI', source_type: 'store_sale', voucher_head: 'x' }),
  ]
  const codes = runExceptionChecks(rows).map(c => c.code)
  for (const c of ['E1', 'E2', 'E3', 'E4']) assert.equal(codes.includes(c), false, c)
})

test('concentration ignores entries that have no voucher head (older exports)', () => {
  const rows = Array.from({ length: 12 }, (_, i) => E({ id: i + 1, entry_date: `2026-09-${String(i + 1).padStart(2, '0')}`, category: 'Rice', note: `Bill ${i} from vendor`, amount: 900 + i, receipt_url: 'x' }))
  assert.equal(runExceptionChecks(rows).some(c => c.code === 'E14'), false)
})

test('a clean ledger produces no findings', () => {
  const rows = Array.from({ length: 12 }, (_, i) => E({ id: i + 1, entry_date: `2026-10-${String(i + 1).padStart(2, '0')}`, category: ['Rice', 'Fuel', 'Repairs'][i % 3], note: `Bill ${i + 1} from vendor ${i}`, amount: 900 + i * 37, voucher_head: ['A', 'B', 'C'][i % 3], receipt_url: 'x' }))
  assert.deepEqual(runExceptionChecks(rows), [])
})

test('vendor ledger: bills, linked payments and outstanding', () => {
  const bills = [{ id: 1, vendor_id: 7, amount: 50000, status: 'Open' }, { id: 2, vendor_id: 7, amount: 10000, status: 'Cancelled' }]
  const pay = [E({ id: 1, vendor_id: 7, amount: 20000, bill_id: 1 }), E({ id: 2, vendor_id: 7, amount: 5000 }), E({ id: 3, vendor_id: 7, amount: 999, bill_id: 1, is_soft_deleted: true })]
  const v = vendorLedger(bills, pay).get('7')
  assert.deepEqual({ billed: v.billed, paid: v.paid, unbilled: v.unbilledPaid, outstanding: v.outstanding }, { billed: 50000, paid: 25000, unbilled: 5000, outstanding: 30000 })
})

test('accounting view splits revenue, capital, drawings and advances', () => {
  const v = accountingView([E({ category: 'Rice', amount: 100 }), E({ category: 'construction', amount: 400 }), E({ category: 'Other', expense_nature: 'Drawings', amount: 30 }), E({ category: 'Salary', note: 'salary advance', amount: 20 }), E({ category: 'Rice', amount: 5, is_soft_deleted: true })])
  assert.deepEqual(v.totals, { Revenue: 100, Capital: 400, Drawings: 30, Advance: 20 })
  assert.equal(v.operating, 100); assert.equal(v.outflow, 550)
})

test('advance name is pulled out of the note', () => {
  assert.equal(advanceNameFromNote('Sir Manglemba Salary Advance'), 'Sir Manglemba')
  assert.equal(advanceNameFromNote('Johnson salary Advance'), 'Johnson')
})

test('defaults: receipts optional, database enforcement on', () => {
  assert.equal(CONTROL_DEFAULTS.receipt_required_above, null)
  assert.equal(CONTROL_DEFAULTS.enforce_in_database, true)
})

test('advance matching: same person, amount and month match; others are reported missing', () => {
  const ledger = [
    E({ id: 1, entry_date: '2026-10-05', category: 'Salary', note: 'Sir Manglemba Salary Advance', amount: 500 }),
    E({ id: 2, entry_date: '2026-10-08', category: 'salary Advance', note: 'Johnson Salary Advance', amount: 5000 }),
    E({ id: 3, entry_date: '2026-10-14', category: 'Salary', note: 'Sir Manglemba Salary Advance', amount: 3000 }),
    E({ id: 4, entry_date: '2026-10-08', category: 'Salary', note: 'Sir Manglemba Salary Advance', amount: 500 }),
  ]
  const register = [
    { id: 10, name: 'Ningthoujam Manglemba Singh', amount: 500, issued_month: '2026-10' },
    { id: 11, name: 'Ningthoujam Johnson Singh', amount: 4000, issued_month: '2026-10' },   // wrong amount
  ]
  const r = reconcileAdvances(ledger, register)
  assert.deepEqual([...r.matched], ['1'])                                   // only row 10 exists once
  assert.deepEqual(r.missing.map(e => e.id).sort(), [2, 3, 4])             // 4 is the second ₹500: the register has one
})

test('advance matching: titles are ignored and one register row is never used twice', () => {
  assert.equal(nameMatch('Sir Sunder', 'Khundrakpam Sunder'), true)
  assert.equal(nameMatch('Sir Sunder', 'Khundrakpam Johny'), false)
  assert.equal(nameMatch('Sir', 'Sir Arun'), false)                          // a bare title says nothing
  const l = [E({ id: 1, entry_date: '2026-10-12', note: 'Sir Sunder Salary Advance', amount: 1500 }), E({ id: 2, entry_date: '2026-10-13', note: 'Sunder advance', amount: 1500 })]
  const r = reconcileAdvances(l, [{ id: 9, name: 'Sunder K', amount: 1500, issued_month: '2026-10' }])
  assert.equal(r.matched.size, 1); assert.equal(r.missing.length, 1)
})

// ── genuine data: real heads, real reasons ─────────────────────────────────
test('generic text = every word is a filler; one real word makes it specific', () => {
  for (const g of ['Other', 'other', '21Other', 'Paytm Payment', 'Gpay Business', 'Google Business', 'Cash payment', 'Misc expense', 'NA', '', '  ']) assert.equal(isGenericText(g), true, JSON.stringify(g))
  for (const s of ['Kitchen item', 'Paytm to Ibosana for rice', 'Saturday Chicken', 'Hair Cutting', 'Rice']) assert.equal(isGenericText(s), false, s)
})

test('placeholder payees are refused, real names pass', () => {
  for (const n of ['', 'NA', 'Other', 'cash', 'Shop', 'vendor', 'ab']) assert.equal(isPlaceholderName(n), true, JSON.stringify(n))
  for (const n of ['Ta Kumar Grocery', 'Sagar Iron Works', 'Ibosana']) assert.equal(isPlaceholderName(n), false, n)
})

test('reason must be long enough, several words, specific, and add something new', () => {
  assert.ok(reasonProblems({ note: 'Paytm Payment', category: 'Paytm Payment' }).length >= 2)
  assert.ok(reasonProblems({ note: 'Machoubi', category: 'Other' }).length >= 2)
  assert.ok(reasonProblems({ note: 'aaaaaa aaaaaa aaaaaa', category: 'Rice' }).some(p => /placeholder/.test(p)))
  assert.ok(reasonProblems({ note: 'test test test test', category: 'Rice' }).length >= 1)
  assert.ok(reasonProblems({ note: 'Rice from Ibosana', category: 'Rice', vendorName: 'Ibosana' }).some(p => /something new/.test(p)))
  assert.deepEqual(reasonProblems({ note: 'Rice 7 bags (50 kg) for hostel kitchen, bill 214', category: 'Food & Kitchen', subCategory: 'Rice & Grains', vendorName: 'Ibosana' }), [])
  assert.deepEqual(reasonProblems({ note: 'Sir Manglemba salary advance for medical need', category: 'Salary Advance' }), [])
})

test('new entry: "Other" is refused even with a good description; a real head passes', () => {
  const base = { amount: 900, payment_mode: 'Cash', account_type: 'Cash A/c', sub_category: 'Plumbing', note: 'Plumber for hostel tap repair, 2 hours work' }
  assert.match(validateExpenseRow({ ...base, category: 'Other' }, { hasReceipt: true, vendorName: 'Ranjit Plumber' }).errors.join(), /not a real category/)
  assert.match(validateExpenseRow({ ...base, category: 'Paytm Payment' }, { hasReceipt: true, vendorName: 'Ranjit Plumber' }).errors.join(), /not a real category/)
  assert.equal(validateExpenseRow({ ...base, category: 'Maintenance' }, { hasReceipt: true, vendorName: 'Ranjit Plumber' }).errors.length, 0)
})

test('new entry: vague reason and placeholder payee are refused', () => {
  const base = { amount: 900, payment_mode: 'Cash', account_type: 'Cash A/c', category: 'Maintenance', sub_category: 'Plumbing' }
  assert.match(validateExpenseRow({ ...base, note: 'Paytm Payment' }, { hasReceipt: true, vendorName: 'Ranjit' }).errors.join(), /real reason/)
  assert.match(validateExpenseRow({ ...base, note: 'repair' }, { hasReceipt: true, vendorName: 'Ranjit' }).errors.join(), /real reason/)
  assert.match(validateExpenseRow({ ...base, note: 'Plumber for hostel tap repair, 2 hours' }, { hasReceipt: true, vendorName: 'NA' }).errors.join(), /not a real payee/)
  assert.match(validateExpenseRow({ ...base, note: 'Plumber for hostel tap repair, 2 hours', sub_category: 'Other' }, { hasReceipt: true, vendorName: 'Ranjit' }).errors.join(), /sub-category/)
})

test('editing an old entry only enforces what the person changes', () => {
  const old = { category: 'Other', sub_category: 'Misc', note: 'Machoubi' }
  const row = { ...old, amount: 500, payment_mode: 'Cash', account_type: 'Cash A/c' }
  // attaching a receipt / changing the date leaves category and reason alone: not blocked
  assert.equal(validateExpenseRow(row, { hasReceipt: true, original: old, vendorName: 'Machoubi' }).errors.length, 0)
  // but changing the reason to another weak one, or the category to another generic, is
  assert.match(validateExpenseRow({ ...row, note: 'Machoubi lougi' }, { hasReceipt: true, original: old, vendorName: 'Machoubi' }).errors.join(), /real reason/)
  assert.match(validateExpenseRow({ ...row, category: 'Others' }, { hasReceipt: true, original: old, vendorName: 'Machoubi' }).errors.join(), /not a real category/)
})

test('controls can switch the new rules off', () => {
  const row = { amount: 500, payment_mode: 'Cash', account_type: 'Cash A/c', category: 'Other', sub_category: 'Plumbing', note: 'Paytm Payment' }
  const r = validateExpenseRow(row, { hasReceipt: true, vendorName: 'Ranjit', controls: { block_generic_category: false, generic_description_check: false } })
  assert.equal(r.errors.length, 0)
})

test('category choices: real heads first, no "Other" or bank-app names, no spelling variants', () => {
  const used = ['Other', 'Paytm Payment', 'Gpay Business', '21Other', 'Kitchen gi', 'Saturday Chicken', 'Salary', 'Ranbir Shop Items', 'Ranbir Shop Items']
  const c = entryCategoryChoices(used, ['Sports Kit', 'Misc'])
  assert.deepEqual(c.slice(0, EXPENSE_HEAD_NAMES.length), EXPENSE_HEAD_NAMES)
  assert.deepEqual(c.slice(EXPENSE_HEAD_NAMES.length), ['Ranbir Shop Items', 'Sports Kit'])
  assert.equal(c.includes('Other'), false); assert.equal(c.includes('Paytm Payment'), false); assert.equal(c.includes('Kitchen gi'), false)
  assert.equal(c.includes('Salary Advance'), true)
})

test('old heads are mapped to a real head when cleaning up', () => {
  assert.equal(suggestHead('Saturday Chicken'), 'Food & Kitchen')
  assert.equal(suggestHead('Kitchen gi'), 'Food & Kitchen')
  assert.equal(suggestHead('salary Advance'), 'Salary Advance')
  assert.equal(suggestHead('Hospital'), 'Medical')
  assert.equal(suggestHead('Paytm Payment'), null)
})

test('exception report: legacy generic heads and weak reasons are listed for clean-up', () => {
  const E2 = o => ({ type: 'Expense', status: 'Confirmed', is_soft_deleted: false, payment_mode: 'Cash', account_type: 'Cash A/c', voucher_head: 'A', receipt_url: 'x', entry_date: '2026-10-01', amount: 500, ...o })
  const rows = [
    E2({ id: 1, category: 'Other', note: 'Sir Heman marup ki wedding gift cash' }),     // generic head, decent note -> E16
    E2({ id: 2, category: 'Paytm Payment', note: 'Paytm Payment' }),                     // E1 (not repeated in E16)
    E2({ id: 3, category: 'Kitchen item', note: 'Machoubi' }),                           // weak reason -> E17
    E2({ id: 4, category: 'Maintenance', note: 'Plumber visit for hostel tap repair' }), // fine
  ]
  const by = Object.fromEntries(runExceptionChecks(rows).map(c => [c.code, c]))
  assert.deepEqual(by.E1.rows.map(r => r.id), [2])
  assert.deepEqual(by.E16.rows.map(r => r.id), [1])
  assert.deepEqual(by.E17.rows.map(r => r.id), [3])
})
