// WhatsNewBanner.jsx — "What's new" strip shown at the top of every page until
// dismissed. Bump WHATS_NEW_VERSION when new features are listed so everyone
// sees it once more. Items with a `tab` open that Fees tab directly.
import { useState } from 'react'

export const WHATS_NEW_VERSION = '2026-10-06'
const KEY = 'gnsi_whatsnew_seen'

const ITEMS = [
  { icon: '📖', title: 'Help & Training', text: 'Step-by-step guides for every module, a full list of what changed, role-based training paths and a progress tracker. Look for "📖 Help for this page" at the top of every page.', tab: null, page: 'help' },
  { icon: '📲', title: 'Fee reminders', text: 'WhatsApp dues reminders with a reminder log and promise-to-pay dates.', tab: 'reminders', admin: true },
  { icon: '🧮', title: 'Daily closing', text: 'Count the cash at day end and reconcile it against recorded receipts.', tab: 'dayClose', admin: true },
  { icon: '🗓️', title: 'Installment plans', text: 'Split dues into scheduled instalments; students on a plan are tagged in the dues and reminder lists.', tab: 'installments', admin: true },
  { icon: '🎓', title: 'Concession register', text: 'Standing scholarships and concessions with expiry tracking — now reduce the dues automatically.', tab: 'concessionRegister', admin: true },
  { icon: '↩️', title: 'Refunds & transfers', text: 'Record refunds, credits and write-offs with an approval step; paid refunds post to Accounts.', tab: 'refunds', admin: true },
  { icon: '🛡️', title: 'Fees activity digest', text: 'Weekly/monthly summary of corrections, reverts and concessions with red flags.', tab: 'digest', admin: true },
  { icon: '🔎', title: 'Verify receipt', text: 'Every receipt carries a QR code. Parents can scan it on their phone to confirm it is genuine; staff can also check by number.', tab: 'verify' },
  { icon: '🩺', title: 'Data health', text: 'Finds students with missing GCC, course, hostel type, phone, photo and more.', tab: 'dataHealth', admin: true },
  { icon: '🔁', title: 'Session rollover planner', text: 'Plan April promotions, repeaters and carried-forward dues (read-only).', tab: 'rollover', admin: true },
  { icon: '📊', title: 'Dashboard upgrades', text: 'Month-wise dues from January incl. admission, exports on every section, Session Progress student list.' },
  { icon: '🔔', title: 'Daily fee alerts', text: 'Admins get one morning notification: overdue instalments, passed promises, unclosed days, pending approvals, expiring concessions.' },
  { icon: '🔒', title: 'Stronger fee security', text: 'Server-side checks on corrections, approvals and closed months; admin screens now verified with the database.' },
]

export default function WhatsNewBanner({ isAdmin, onOpenFeesTab, onOpenPage }) {
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(KEY) } catch { return null } })
  const [open, setOpen] = useState(false)
  if (seen === WHATS_NEW_VERSION) return null
  const dismiss = () => { try { localStorage.setItem(KEY, WHATS_NEW_VERSION) } catch { /* storage unavailable */ } setSeen(WHATS_NEW_VERSION) }
  const shown = ITEMS.filter(i => !i.admin || isAdmin)
  return (
    <div role="region" aria-label="What's new" style={{ margin: '12px 16px 0', borderRadius: 14, border: '1px solid #e2c57e', background: 'linear-gradient(135deg,#fffaf0,#fbf3e0)', boxShadow: '0 2px 10px rgba(167,119,31,.12)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>✨</span>
        <div style={{ flex: '1 1 220px', minWidth: 0, fontSize: 13, color: '#5b4208' }}>
          <b>What's new in GNSI ERP</b> — {shown.length} new features, including reminders, daily closing, receipt QR check and more.
        </div>
        <button type="button" onClick={() => setOpen(o => !o)} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid #a7771f', background: 'white', color: '#a7771f', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{open ? 'Hide' : 'See what\'s new'}</button>
        <button type="button" onClick={dismiss} aria-label="Dismiss what's new" style={{ padding: '6px 10px', borderRadius: 999, border: 'none', background: 'transparent', color: '#8a6a1f', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>×</button>
      </div>
      {open && (
        <div style={{ padding: '4px 14px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
          {shown.map(i => (
            <div key={i.title} style={{ background: 'white', border: '1px solid #f0e3bf', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a6e' }}>{i.icon} {i.title}</div>
              <div style={{ fontSize: 11.5, color: '#5d6b82', margin: '3px 0 6px', lineHeight: 1.4 }}>{i.text}</div>
              {i.page && <button type="button" onClick={() => { onOpenPage?.(i.page); dismiss() }} style={{ fontSize: 11, fontWeight: 800, color: '#a7771f', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Open →</button>}
              {i.tab && <button type="button" onClick={() => { onOpenFeesTab?.(i.tab); dismiss() }} style={{ fontSize: 11, fontWeight: 800, color: '#a7771f', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Open →</button>}
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
            <button type="button" onClick={dismiss} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', background: '#1e3a6e', color: 'white', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Got it</button>
          </div>
        </div>
      )}
    </div>
  )
}
