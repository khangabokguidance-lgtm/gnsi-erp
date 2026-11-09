// changelog.js — everything that has changed in the ERP, newest first.
// type: new | improved | fixed | security.  module = sidebar module id (opens that guide).
// Add new entries at the TOP of the array when you ship something.
export const CHANGELOG = [
  {
    date: '2026-11-02', title: 'Permission loopholes closed (Salary, Awards, Construction, Exams, Entrance, CBT)',
    items: [
      { type: 'security', module: 'admin', text: 'Salary, Awards and Construction never checked the add / edit / delete rights in Admin → Permissions, so anyone who could open them could change everything. A non-admin without those rights now gets a “View only” screen where saving, adding, editing, approving and deleting are blocked.' },
      { type: 'security', module: 'admin', text: 'Exams, Entrance Exam and CBT treated a missing permission as “allowed”. They now default to no access unless the right is explicitly granted.' },
    ],
  },
  {
    date: '2026-11-02', title: 'Exams: printing is admin-only',
    items: [
      { type: 'security', module: 'exams', text: 'Printing inside the Exams module (report cards, admit cards, certificates, merit lists, Mock Analyzer reports, duty sheets and the Revision Plan) is now switched off for everyone except admins. Other staff get a notice instead of a print window, Ctrl+P is blocked, and the browser’s own page print comes out blank. Fees, Accounts and the other modules still print normally.' },
    ],
  },
  {
    date: '2026-11-02', title: 'Learning Hub: staff see only what they need',
    items: [
      { type: 'security', module: 'learninghub', text: 'Learning Hub tabs that create or run things — Question Bank, Entrance Exam and Model Set Maker — now stay hidden from staff unless the admin gives that user add / edit / delete rights on them; read access alone no longer opens them. Study Materials, Class Material, Teaching Aids, Study Lockers, Question Bank Viewer and Model Sets stay open for viewing.' },
      { type: 'security', module: 'classmaterial', text: 'Class Material is now admin-only for uploading, hiding and deleting in the database itself (not just on screen), and visible only to signed-in staff — never to the public website.' },
    ],
  },
  {
    date: '2026-11-02', title: 'Learning Hub → Class Material (view-only study material & test series)',
    items: [
      { type: 'new', module: 'classmaterial', text: 'New Learning Hub section “Class Material”: the admin uploads study material and test-series papers (PDF or images) by course (Navodaya / Sainik / Foundation), class and subject; staff browse subject by subject and open them for class use.' },
      { type: 'new', module: 'classmaterial', text: 'Test series are grouped by series name with tests in order (Test 1, 2, 3…). Admin can hide a file from staff or delete it; search finds any title, subject or series.' },
      { type: 'security', module: 'classmaterial', text: 'Files open in a view-only viewer — no download or print button, no file link, right-click / copy / save / print blocked, and the viewer’s name and date is tiled across every page. Files are kept in a private bucket. Give staff access under Admin → Permissions → “Class Material (view-only)”.' },
    ],
  },
  {
    date: '2026-11-02', title: 'Mock Analyzer → Revision Plan & time table',
    items: [
      { type: 'new', module: 'exams', text: 'Pre Mock and Mega Mock Analyser have a new “Revision Plan” tab built on the Academic Time Table valid from 2 Nov 2026: for each class, every subject’s average, students below the pass mark, how many revision periods (and minutes) a day it gets, the teacher, and whether the time given matches how weak the class is — with plain advice such as moving a period from a strong subject to a weak one.' },
      { type: 'new', module: 'exams', text: 'Revision Plan: a period-by-period day sheet for each class (weakest subject starred), the full colour time table for all 8 classes, a time table check (no teacher in two classes at once, one subject per period, teacher load) and print / PDF for the class plan and the time table.' },
    ],
  },
  {
    date: '2026-11-02', title: 'Checklist → Today: daily teacher tool',
    items: [
      { type: 'new', module: 'checklist', text: 'Checklist now opens on a new “Today” tab for every teacher: your tasks for the day for Navodaya, Sainik and Foundation (with batch and subject), a tick-off progress bar, and day-by-day navigation.' },
      { type: 'new', module: 'checklist', text: 'Store the material you prepared for today’s classes — notes, links (Drive, YouTube, websites) or uploaded files — under the right course, batch and subject. “Bring pending from yesterday” carries unfinished tasks forward; “Print” makes a premium task sheet. Admins and in-charges can view all teachers.' },
    ],
  },
  {
    date: '2026-11-02', title: 'Pre Mock & Mega Mock analysers, self-study groups',
    items: [
      { type: 'new', module: 'exams', text: 'Results → Pre Mock Analyser and Mega Mock Analyser are now two separate tabs, each with its own results. Mega results are saved into a series with “Mega” in its name.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups: every class is split into 7 groups from weakest to strongest marks, with a focus subject for each group, an English / Meitei Mayek filter, and Excel / Print.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups show each student’s house and the assigned House Master / Mistress (name from the Staff Records), with a House filter and the same in Excel / Print.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups: mixed-class groups (one set of 7 groups across the chosen classes), subject-wise groups (marks of one subject only, or one Excel sheet per subject), and manual moves — an admin can put any student in any of the 7 groups, saved per subject.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups: the admin can choose how many students form the top group (best N across all chosen classes), and assign a House Master / Mistress to each group of each subject.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups: an admin can set the language (English / Meitei Mayek) of every class, so Lakshya, Umeed and other classes count in the language filter.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups → Smart report: six report types (group roster, student study cards, group summary, subject-wise matrix, House Master / Mistress workload, manual moves), advanced filters (groups, class, house, House Master, mentor, weakest subject, trend, marks, below pass, moved by admin), automatic insights, saved setups, quick reports, print / PDF and Excel.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups: teaching staff from the Staff Records can now be put on duty for a group, alongside House Masters / Mistresses (“Assigned for duty”); the report type is now a Duty roster.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups → Duty desk: every duty teacher / House Master with their groups and student lists, premium printable duty sheets (with attendance boxes), remove or transfer a student (teachers on their own groups, admins on any, restorable), and groups built from a hand-picked list of students.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups: every person on duty gets an instruction — where, why (reason), when (days and time slot) and what to do — shown on the group card and Duty desk, with overlap warnings, a copyable message, and a clear “Your duty — please read” notice at the top of the printed duty sheet.' },
      { type: 'new', module: 'exams', text: 'Smart report: the Duty roster now shows clearly WHICH SUBJECT each person supervises study duty for (all subjects at once), with group, where, when and why; filter by supervised subject; subjects with nobody on duty are flagged; the other reports name the subject next to the person on duty.' },
      { type: 'improved', module: 'exams', text: 'Self-Study Groups is easier to use: three clear views (Groups, Duty desk, Reports), simple filters first with “More options” for the rest, a “How it works” guide, a duty-setup progress bar, hidden empty groups, plain-language labels and a “saved ✓” confirmation after each change.' },
      { type: 'fixed', module: 'exams', text: 'Self-Study Groups: the Duty desk, duty sheets and duty roster now always show everyone on duty — previously people disappeared when you switched between class-wise and mixed groups or set a class filter. Mixed-class duties remember which classes were mixed. Excel sheets with “/” or “:” in a subject name no longer fail.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups: choose which subject(s) to print — “Print…” on the Groups view lets you tick the subjects (each prints as its own section), and the Duty desk has a “Show & print only” subject filter that applies to duty sheets, Excel and the copied instruction message.' },
      { type: 'new', module: 'exams', text: 'Self-Study Groups: study schedule — a time slot for each subject (Passage 6:00–7:00 am, Mathematics 3:15–4:45 pm, EVS 5:30–7:00 pm) and a room for each group (Group 1–7 → Room 1–7), editable and applied to every group card, the Duty desk, duty sheets and reports; room clashes are flagged.' },
      { type: 'improved', module: 'exams', text: 'Printed sheets and reports (duty sheets, Smart report, group lists and the analyser reports) have a premium design: the institute logo in the letterhead, as a faint watermark and in every page footer; “Design by Moirangthem Himan Singh” on every page; consistent Inter / Fraunces fonts (with Meitei Mayek support) loaded in the print window; tables that flow across pages with no half-empty pages; fixed column widths; and no browser date / about:blank header.' },
      { type: 'new', module: 'exams', text: 'Pre Mock Tests 10–16 added to the built-in data (59 sheets, 2,525 results).' },
    ],
  },
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
