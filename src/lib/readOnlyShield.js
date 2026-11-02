// readOnlyShield.js — pure rules for the View-only shield (see ReadOnlyShield.jsx).
// Several older modules never read the `perms` prop, so "read" access used to mean full edit rights there.
// For the sensitive ones, a user without add / edit / delete rights gets a view-only screen: any control
// that saves, changes, approves or removes something is blocked. Best-effort UI guard — the database itself
// still decides what the signed-in session may write.
const WRITE_WORDS = /\b(save|add|new|create|delete|remove|update|edit|submit|approve|reject|pay|paid|collect|issue|import|upload|mark|record|assign|publish|send|post|disburse|generate payroll|process|close day|reopen|restore|rename|transfer|merge|archive|activate|deactivate)\b/i

export const hasWriteRights = (perms) => !!(perms && (perms.add === true || perms.edit === true || perms.delete === true))

// text = a control's visible label / title / aria-label
export const isWriteLabel = (text) => {
  const t = String(text || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim()
  return t.length > 0 && t.length <= 60 && WRITE_WORDS.test(t)
}

// → true when this DOM element is a control the shield must block
export function isWriteControl(el) {
  if (!el || !el.closest) return false
  const btn = el.closest('button, [role=button], input[type=submit], input[type=button], a[role=button]')
  if (!btn) return false
  if (btn.closest('[data-ro-allow]')) return false
  if (btn.getAttribute('type') === 'submit') return true
  const label = btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.value || btn.textContent
  return isWriteLabel(label)
}
