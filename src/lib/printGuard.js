// printGuard.js — switches printing off inside the Exams module for everyone except admins.
// While Exams is open for a non-admin: the print helpers (report cards, admit cards, certificates, merit list,
// Mock Analyzer reports…) refuse to open a print window, Ctrl/Cmd+P is blocked, and the browser's own print
// of the page comes out blank. The block is released the moment Exams closes, so Fees, Accounts etc. still print.
let blocked = false
export const isPrintBlocked = () => blocked
export const PRINT_BLOCKED_MESSAGE = 'Printing in Exams is switched off for your account. Ask an admin to print this for you.'

// Use at the top of any print function: `if (denyPrint()) return`.
export function denyPrint() {
  if (!blocked) return false
  try { window.alert(PRINT_BLOCKED_MESSAGE) } catch { /* ignore */ }
  return true
}

const STYLE_ID = 'gnsi-exam-print-block'
// → cleanup function
export function blockExamPrinting() {
  blocked = true
  const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'p') { e.preventDefault(); e.stopPropagation(); denyPrint() } }
  window.addEventListener('keydown', onKey, true)
  let style = null
  if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = '@media print{html,body{visibility:hidden!important;background:#fff!important}body *{display:none!important}}'
    document.head.appendChild(style)
  }
  return () => { blocked = false; window.removeEventListener('keydown', onKey, true); style?.remove() }
}
