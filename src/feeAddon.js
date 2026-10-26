// feeAddon.js — the monthly add-on fee for Combined Course students (appearing for both
// Navodaya and Sainik). One amount per academic session, set in Fee Setup, charged every
// month on top of the normal monthly fee. Stored as JSON in system_settings:
//   key 'fee_combined_addon'  →  { "2026-2027": 500, "2027-2028": 600 }
// Pure helpers only (unit-tested); feeEngine.js does the loading.
export const ADDON_SETTING_KEY = 'fee_combined_addon'
export const ADDON_COURSE = 'Combined Course'

/** Parse the stored setting; anything unreadable means "no add-on". */
export function parseAddonMap(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out = {}
    for (const [k, n] of Object.entries(v)) { const x = Number(n); if (Number.isFinite(x) && x > 0) out[k] = Math.round(x) }
    return out
  } catch { return {} }
}

/** Add-on for one session (0 when none is set). */
export const addonFor = (map, session) => Number((map || {})[session]) || 0

/** Next map after setting a session's amount (0 or blank removes it). */
export function withAddon(map, session, amount) {
  const next = { ...(map || {}) }
  const n = Math.round(Number(amount))
  if (Number.isFinite(n) && n > 0) next[session] = n; else delete next[session]
  return next
}

/**
 * Rates with the add-on included. Every module that bills a month asks getFeeRates for
 * courseFee (most months) or flatFee (Feb–Mar), so adding it to both makes the add-on
 * appear everywhere — collection, dues, ledgers — without touching each of them.
 * Other courses, and a zero add-on, return the rates unchanged.
 */
export function applyAddon(rates, course, addon) {
  if (course !== ADDON_COURSE || !(addon > 0)) return rates
  return { ...rates, flatFee: Number(rates.flatFee || 0) + addon, courseFee: Number(rates.courseFee || 0) + addon, addonFee: addon }
}
