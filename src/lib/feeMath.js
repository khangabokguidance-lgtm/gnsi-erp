// feeMath.js — small pure helpers shared by the fee engine, dues and ledger.

// Wall-clock "now" in the institute's timezone (IST), as a Date whose local
// fields read as IST — so "has this fee month started?" does not depend on the
// browser's own clock zone.
export const instituteNow = (now = new Date()) => new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))

// Balance (top-up) rows for a part-paid month get id `<primary id>_b<n>`; the
// primary row keeps the plain id. Accounts entries are keyed the same way.
const BALANCE_SUFFIX = /_b(\d+)$/
export const isBalanceRowId = id => BALANCE_SUFFIX.test(String(id || ''))
export const balanceSuffix = id => { const m = String(id || '').match(BALANCE_SUFFIX); return m ? `_b${m[1]}` : '' }
export const balanceRowId = (primaryId, existingCount) => `${primaryId}_b${existingCount}`

// One rule for what an adm_fee_collections row is, used by dues AND ledger so
// they cannot disagree: 'admission' | 'advance' | 'item'.
export const admRowKind = r => {
  if (r.fee_type === 'advance') return 'advance'
  if (r.fee_type === 'admission' || r.description === 'Admission Fee') return 'admission'
  return 'item'
}

// A repeater pays no admission fee and no admission-package items (dress,
// prospectus). Returns the items to charge/collect and those left out. Flat,
// course and advance lines are never excluded.
export const excludeRepeaterFees = (isRepeater, items = []) => {
  if (!isRepeater) return { items, excluded: [] }
  const waived = it => it.kind === 'admission' || it.kind === 'item'
  return { items: items.filter(it => !waived(it)), excluded: items.filter(waived) }
}

// Amount a repeater is excused from, for a list of expected admission-package amounts.
export const repeaterWaivedTotal = (items = []) => excludeRepeaterFees(true, items).excluded.reduce((t, it) => t + (Number(it.amount) || 0), 0)
