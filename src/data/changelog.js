// changelog.js — everything that has changed in the ERP, newest first.
// type: new | improved | fixed | security.  module = sidebar module id (opens that guide).
// Add new entries at the TOP of the array when you ship something.
export const CHANGELOG = [
  {
    date: '2026-10-03', title: 'Complete guide to the whole ERP',
    items: [
      { type: 'new', module: 'help', text: 'Help & Training → Complete guide: getting started, glossary, rules, daily/weekly/yearly routines, every module and troubleshooting in one book. Print or save as PDF, download as Word or Markdown.' },
      { type: 'fixed', module: 'fees', text: 'Session Progress: only the admission fee is waived for repeaters; their flat and course fees are counted as normal.' },
    ],
  },
  {
    date: '2026-10-03', title: 'Fees: new tools, training and safer money handling (latest)',
    items: [
      { type: 'new', module: 'fees', text: 'Fee Reminders tab: WhatsApp dues reminders with a reminder log and promise-to-pay dates.' },
      { type: 'new', module: 'fees', text: 'Instalment Plans tab: split dues into scheduled instalments; students on a plan are tagged ON PLAN / PLAN OVERDUE in dues lists.' },
      { type: 'new', module: 'fees', text: 'Concession Register tab: standing scholarships and concessions with expiry tracking — active entries now reduce the dues automatically.' },
      { type: 'new', module: 'fees', text: 'Refunds & Transfers tab: refund, credit and write-off requests with approval; paid refunds post to Accounts as an expense.' },
      { type: 'new', module: 'fees', text: 'Daily Closing tab: count the cash at day end, compare with recorded receipts, give a reason for any difference.' },
      { type: 'new', module: 'fees', text: 'Fees Activity Digest tab: 7/30-day summary of corrections, reverts and concessions with red flags.' },
      { type: 'new', module: 'fees', text: 'Data Health tab: finds students with missing GCC, course, hostel type, phone, photo and similar problems.' },
      { type: 'new', module: 'fees', text: 'Session Rollover planner (read-only) for the April changeover: promotions, repeaters and carried-forward dues.' },
      { type: 'new', module: 'fees', text: 'Every fee receipt now has a QR code. Parents can scan it to confirm the receipt is genuine; staff can also use Fees → Verify.' },
      { type: 'new', module: 'dashboard', text: 'Daily fees alert for admins: overdue instalments, passed promises, unclosed days, pending approvals, expiring concessions.' },
      { type: 'new', module: 'help', text: 'Help & Training: this page — what changed, step-by-step guides for every module, and role-based training paths.' },
      { type: 'security', module: 'fees', text: 'Database now blocks non-admins from changing or reverting recorded payments, and blocks posting into closed months.' },
      { type: 'security', module: 'fees', text: 'Corrections (amount, month, date, hostel type) must have a reason of 5+ characters and write an audit record first.' },
      { type: 'security', module: 'fees', text: 'A concession above ₹2,000 cannot be approved by the person who raised it (unless there is only one admin).' },
      { type: 'security', module: 'fees', text: 'Admin screens in Fees are now confirmed with the database, not only the browser.' },
      { type: 'improved', module: 'fees', text: 'Any shortfall below the standard fee now needs a reason and approval (previously small shortfalls passed silently).' },
      { type: 'improved', module: 'fees', text: 'Fee Dashboard hub tabs re-laid out so labels no longer overlap.' },
    ],
  },
  {
    date: '2026-10-03', title: 'Fee Dashboard upgrades',
    items: [
      { type: 'new', module: 'fees', text: 'Export button (CSV / Excel) on every Fee Dashboard section.' },
      { type: 'new', module: 'fees', text: 'Session Progress now has Stage and Student filters, a student list and export; repeaters and continuing students are no longer counted as unpaid.' },
      { type: 'improved', module: 'fees', text: 'Month-wise Dues now runs from January, includes admission fees, shows who is on a plan, and exports to CSV / Excel / Print.' },
      { type: 'new', module: 'fees', text: 'Reports & Export Centre has Dues Reports (month-wise summary and defaulters list).' },
      { type: 'improved', module: 'fees', text: 'Fix panel: choosing "Other" as the concession reason lets you type your own reason.' },
    ],
  },
  {
    date: '2026-10-03', title: 'Students, Fee Setup and error fixes',
    items: [
      { type: 'new', module: 'students', text: 'Student registration style form and photo store: photos are compressed on upload (about 150–250 KB) and display correctly.' },
      { type: 'fixed', module: 'feesetup', text: 'Saving fees in Fee Setup no longer fails with a "row-level security" error (admin write rule added).' },
      { type: 'improved', module: 'feesetup', text: 'Fee Setup can show courses/batches that have no fee configured yet.' },
      { type: 'fixed', module: 'student360', text: 'Cross-module mismatch scan no longer floods the console with permission errors.' },
    ],
  },
  {
    date: '2026-10-03', title: 'Look and feel, Mock Analyzer',
    items: [
      { type: 'improved', module: 'dashboard', text: 'Every module tab has its own colour, with icon-over-label tabs like a phone app.' },
      { type: 'new', module: 'exams', text: 'Mock Test Analyzer: custom data filter (batches, tests, subjects, students, score range) applied across all charts and printouts.' },
      { type: 'improved', module: 'dashboard', text: 'Premium redesigned sign-in page.' },
    ],
  },
  {
    date: '2026-10-03', title: 'Hostel discipline',
    items: [
      { type: 'new', module: 'hostel', text: 'Housemaster compliance enforced every day: missed roll calls and unlogged mandatory tabs are recorded automatically, with warnings in the evening and morning.' },
      { type: 'new', module: 'hostel', text: 'Housemasters on approved leave are skipped; the same penalty rule applies to missed and late roll calls.' },
    ],
  },
  {
    date: '2026-10-02', title: 'Tabs and phone layout',
    items: [
      { type: 'improved', module: 'dashboard', text: 'Every module tab now carries a consistent line icon instead of mixed emoji.' },
      { type: 'fixed', module: 'invitation', text: 'Invitation Studio fits on a phone screen, and the page no longer overflows sideways on desktop.' },
    ],
  },
]

export const TYPE_META = {
  new:      { label: 'New',      bg: '#dcfce7', fg: '#166534' },
  improved: { label: 'Improved', bg: '#dbeafe', fg: '#1e40af' },
  fixed:    { label: 'Fixed',    bg: '#fef3c7', fg: '#92400e' },
  security: { label: 'Security', bg: '#fee2e2', fg: '#991b1b' },
}
