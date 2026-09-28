// ledgerLink.js — "open this student's fee ledger" from anywhere.
//
// Every ledger has a real URL (…/?ledger=<GCC>) so it can be copied, shared,
// bookmarked or opened in a new tab. Inside the app, clicking a link switches
// to Student Fee Ledger with that student already loaded instead of reloading
// the page. The pending GCC is kept here because the ledger screen may not be
// mounted yet when the link is clicked — it takes the value when it mounts.
import { gccStr } from './feeEngine'

export const OPEN_LEDGER_EVENT = 'gnsi:open-ledger'

let pendingGcc = null

export const ledgerUrl = gcc => {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('ledger', gccStr(gcc))
  return url.toString()
}

// GCC asked for by the URL (?ledger=123), if any.
export const ledgerGccFromUrl = () => {
  try {
    const v = new URLSearchParams(window.location.search).get('ledger')
    return v ? gccStr(v) : null
  } catch { return null }
}

export function openStudentLedger(gcc) {
  if (!gcc) return
  pendingGcc = gccStr(gcc)
  window.dispatchEvent(new CustomEvent(OPEN_LEDGER_EVENT, { detail: { gcc: pendingGcc } }))
}

// The ledger screen calls this on mount: a link clicked elsewhere, else the URL.
export function takePendingLedgerGcc() {
  const g = pendingGcc || ledgerGccFromUrl()
  pendingGcc = null
  return g
}

// Keeps the address bar in step with the ledger on screen, so it can be copied.
export function setLedgerUrl(gcc) {
  try {
    const url = new URL(window.location.href)
    if (gcc) url.searchParams.set('ledger', gccStr(gcc))
    else url.searchParams.delete('ledger')
    window.history.replaceState(window.history.state, '', url)
  } catch { /* URL API unavailable — the ledger still works */ }
}

