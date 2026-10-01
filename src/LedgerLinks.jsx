// LedgerLink.jsx — clickable links that open a student's fee ledger (see ledgerLink.js).
import { ledgerUrl, openStudentLedger } from './ledgerLink'

// A student's name (or any label) that opens their fee ledger. A real link, so
// Ctrl/Cmd-click or middle-click still opens it in a new tab.
export function LedgerLink({ gcc, children, title = 'Open fee ledger', style }) {
  if (!gcc) return children ?? null
  return (
    <a
      href={ledgerUrl(gcc)}
      title={title}
      onClick={e => {
        e.stopPropagation()
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
        e.preventDefault()
        openStudentLedger(gcc)
      }}
      style={{ color: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'rgba(30,58,110,.45)', textUnderlineOffset: 3, cursor: 'pointer', ...style }}
    >
      {children}
    </a>
  )
}

// Compact "📒 Ledger" chip for profile headers and action rows.
export function LedgerButton({ gcc, dark = false, label = '📒 Ledger' }) {
  if (!gcc) return null
  return (
    <a
      href={ledgerUrl(gcc)}
      title="Open this student's fee register"
      onClick={e => {
        e.stopPropagation()
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
        e.preventDefault()
        openStudentLedger(gcc)
      }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 999,
        fontSize: 11.5, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer',
        ...(dark
          ? { background: 'rgba(255,255,255,.14)', color: '#fff', border: '1px solid rgba(255,255,255,.35)' }
          : { background: '#fbf3e0', color: '#7a5a14', border: '1px solid #e9d9b0' }),
      }}
    >
      {label}
    </a>
  )
}
