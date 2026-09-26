// monthLock.js — shared month-close check for fee collections.
//
// Accounts closes a month per account type in the `month_locks` table
// (account_type + 'YYYY-MM', is_locked = true). Before this helper, only
// Accounts' own entry form looked at that table, so Fees and the Students
// bulk-fee button could still post fee income into a month the books had
// already been closed for — silently changing a closed month's totals.
//
// Fee income can land in more than one account type (cash vs bank), so the
// rule is: if ANY account type is closed for the payment month, a fee
// collection dated in that month is treated as touching closed books.
//   • Non-admins are blocked.
//   • Admins are warned and must confirm (that is how a late correction is
//     still possible without reopening the month first).
// If month_locks can't be read (table missing, network), collection is NOT
// blocked — a lock-check outage must never stop the front desk taking fees.

import { supabase } from './supabase'

export async function getLockedAccountTypes(dateStr) {
  const month = String(dateStr || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) return []
  try {
    const { data, error } = await supabase
      .from('month_locks')
      .select('account_type')
      .eq('month', month)
      .eq('is_locked', true)
    if (error) { console.warn('monthLock: could not read month_locks —', error.message); return [] }
    return (data || []).map(r => r.account_type).filter(Boolean)
  } catch (e) {
    console.warn('monthLock: month_locks check failed —', e?.message || e)
    return []
  }
}

// Returns true when the collection may go ahead.
export async function confirmFeeMonthOpen(dateStr, { isAdmin = false } = {}) {
  const locked = await getLockedAccountTypes(dateStr)
  if (!locked.length) return true
  const month = String(dateStr).slice(0, 7)
  if (!isAdmin) {
    alert(`${month} is closed in Accounts (${locked.join(', ')}).\n\nFee collections dated in a closed month are blocked. Ask an admin to reopen the month in Accounts, or use today's date if the money was received today.`)
    return false
  }
  return window.confirm(`⚠️ ${month} is closed in Accounts (${locked.join(', ')}).\n\nRecording this fee will change that closed month's income. Continue anyway?`)
}
