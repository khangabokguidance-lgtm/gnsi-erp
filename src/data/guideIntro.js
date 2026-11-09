// guideIntro.js — the "front matter" and appendices of the Complete Guide.
// Module chapters come from src/data/tutorials/*.js. Keep facts here in step with the app.
export const GUIDE_TITLE = 'GNSI ERP — Complete User Guide'
export const GUIDE_SUBTITLE = 'Guidance Navodaya & Sainik Institute · School & Hostel Management Portal'

// Order the module chapters appear in (matches the sidebar).
export const CHAPTER_ORDER = [
  ['CORE', ['dashboard', 'students', 'admissions', 'bulkadmission', 'sessions', 'admissionsessions']],
  ['FINANCE', ['fees', 'accounts', 'studentfeeledger', 'feesetup', 'construction']],
  ['ACADEMIC', ['attendance', 'exams', 'timetable', 'teaching', 'courses', 'learninghub', 'studylockers']],
  ['PEOPLE', ['kitchen', 'staff', 'hr', 'leave', 'hostel', 'awards', 'faceattendance']],
  ['OPERATIONS', ['reception', 'notice', 'social', 'connect', 'website', 'store']],
  ['MANAGEMENT', ['reports', 'checklist', 'invitation', 'certificate', 'admin', 'student360', 'system', 'adminlink']],
  ['HELP', ['help']],
]
export const GROUP_TITLES = {
  CORE: 'Core', FINANCE: 'Finance', ACADEMIC: 'Academic', PEOPLE: 'People & Hostel',
  OPERATIONS: 'Operations', MANAGEMENT: 'Management & Administration', HELP: 'Help',
}

// Each part: { id, title, blocks }. A block is { h, p?: [paragraphs], ul?: [bullets], ol?: [numbered steps], table?: {head:[], rows:[[]]}, note? }
export const PARTS = [
  {
    id: 'start', title: 'Part 1 — Getting started',
    blocks: [
      { h: 'What the GNSI ERP is', p: [
        'The GNSI ERP is the institute\'s single portal for running the school and hostel: student records and admissions, fee collection and accounts, attendance, exams and teaching, hostel roll calls and discipline, staff, leave, the kitchen and store, notices, the website and reports.',
        'Everything is linked by the student\'s GCC number, so a payment, an attendance mark or a hostel entry made in one module appears wherever that student is looked up.',
      ] },
      { h: 'Signing in', ol: [
        'Open the portal and press the sign-in button. Type your Username and Password.',
        'Tick "Remember me" on your own device if you want the username filled in next time. Do not do this on a shared computer.',
        'Press Sign in. You land on your Dashboard.',
        'Forgot your password? The sign-in page says: contact the admin. Staff cannot reset their own password.',
      ], note: 'You stay signed in for at most 24 hours. The admin can also set an inactivity logout (System → session timeout); if it is on you will see "You were logged out after N minutes without activity."' },
      { h: 'Finding your way around', ul: [
        'The left sidebar lists the modules you are allowed to open, grouped as Core, Finance, Academic, People, Operations, Management and Help. A module you cannot see is simply not allowed for your role.',
        'The sidebar search box ("Search modules…") finds a module by name; press "/" to jump to it.',
        'Inside a module, the tabs along the top are its screens. Each tab has its own colour and icon.',
        'The top bar shows the page name, today\'s date, who you are, a "📖 Help for this page" button and Sign Out.',
        'On a phone the sidebar becomes a menu and the tabs become a scrolling row; everything works with the same login.',
      ] },
      { h: 'Roles and permissions', p: [
        'Admin, Administrator and Co-Admin are the administrator roles: they can open every module and do every action.',
        'Everyone else has a role such as Manager, Accountant, Teacher, Hostel or Reception. For each module the admin decides what that role may do: Read, Add, Edit, Delete. These are set by an admin in Admin → 🛡️ Permissions (and Overrides for a single person).',
        'If a button is missing or you see "Access denied", you do not have that permission — ask the admin; do not try to work around it.',
      ], note: 'Important actions are double-checked by the database itself, not only by the screen. For example, only an admin can change or revert a recorded payment, and a revert needs a second admin to approve it.' },
      { h: 'Keeping the data safe', ul: [
        'Never share your login. Everything you do is recorded with your name.',
        'Sign out on shared computers.',
        'Corrections to money (amount, month, date, hostel type) need a written reason and leave an audit record you cannot delete.',
        'If you see the orange banner "Secure database connection is off", press "Sign in again". Until then records may look empty or show ₹0 — the data is safe.',
      ] },
      { h: 'Getting help', ul: [
        'Open Help & Training from the sidebar, or press "📖 Help for this page" at the top of any page, for the step-by-step guide of that module.',
        '"What\'s new" in Help & Training lists every change, newest first.',
        'For wrong data or lost access, contact the administrator.',
      ] },
    ],
  },
  {
    id: 'concepts', title: 'Part 2 — Words and rules you will meet',
    blocks: [
      { h: 'Glossary', table: { head: ['Term', 'Meaning'], rows: [
        ['GCC number', 'The student\'s ID, written GCC-1102. Search by it whenever two students have similar names.'],
        ['Session', 'The fee year, April to March (for example 2026-2027). Fees for January–March belong to the session that began the previous April.'],
        ['Admission fee', 'One-time fee charged in the month the student is admitted. Its default amount comes from Fee Setup. A repeater\'s admission fee is waived.'],
        ['Flat fee', 'The hostel/flat fee charged for February and March (the "flat fee months").'],
        ['Course fee', 'The monthly tuition-type fee charged for all the other months.'],
        ['Hostel type', 'Boarder, Day Boarder or Day Scholar. The fee rate depends on it, so a wrong hostel type means wrong dues.'],
        ['Repeater', 'A student repeating the year. Marked on the student record; the admission fee is waived.'],
        ['Concession', 'A reduction of a fee. A one-off low fee needs a reason and an admin\'s approval; a standing scholarship is recorded in Fees → Register.'],
        ['Revert', 'Removing a recorded payment. It is not instant: a different admin must approve it.'],
        ['Month lock', 'Accounts can close a month. Non-admins cannot post fees dated in a closed month.'],
        ['Day closing', 'End-of-day cash check in Fees → Day Close.'],
        ['Student status', 'Active, Inactive, Passed Out, Withdrawn or Dropout. Only Active students appear in fee dashboards and dues.'],
        ['Roll call', 'The housemaster\'s morning and night attendance of the hostel, marked in the Hostel module.'],
        ['Six mandatory tabs', 'Discipline, Sickbay, Repairs, Journal, Mess Duty and Activities — a housemaster must log them every day.'],
      ] } },
      { h: 'Fee rules in one page', ul: [
        'Fees come from Fee Setup by session, course, batch and hostel type. If a combination is not configured, billing falls back to old built-in amounts — Fee Setup shows a red "NOT CONFIGURED" tag.',
        'Collecting less than the standard fee needs a reason; the shortfall stays due until an admin approves a concession.',
        'A concession above ₹2,000 cannot be approved by the person who raised it (unless there is only one admin).',
        'Amounts must be above zero and at most ₹5,00,000; payment dates cannot be in the future.',
        'Corrections (amount, month, date, hostel type) need a reason of at least 5 characters and are written to the audit log first.',
        'A revert or delete is requested by one admin and approved by a different admin in Fees → Approvals.',
        'Each receipt has a QR code. Anyone can scan it to check it is genuine; staff can also use Fees → Verify.',
      ] },
      { h: 'Hostel discipline rules', ul: [
        'Morning roll call closes at 7:30 AM and night roll call at 10:00 PM. After that it is blocked for the day and the housemaster must request the admin to unlock it.',
        'The six mandatory tabs must be logged every day.',
        'A missed roll call or unlogged tab is recorded automatically (the next morning) and flagged to the housemaster and all admins; it carries the same penalty notice as a late roll call.',
        'Housemasters on approved leave are skipped.',
      ] },
    ],
  },
  {
    id: 'routines', title: 'Part 3 — Daily, weekly and yearly routines',
    blocks: [
      { h: 'Fee counter / accountant — every day', ol: [
        'Collect fees in Fees → Fee Payment and hand over the printed receipt.',
        'Give a reason whenever you collect less than the standard fee.',
        'At the end of the day, count the cash and complete Fees → Day Close.',
        'Check Fees → Approvals and Low Fees for anything waiting for a decision.',
      ] },
      { h: 'Reception — every day', ol: [
        'Sign visitors in and out, record admission enquiries and complaints, and handle student leave and gate passes in Reception.',
        'Enter new admissions in Admissions; use Bulk Admission for a batch.',
        'Check Notice for messages from the office.',
      ] },
      { h: 'Teachers — every day', ol: [
        'Mark Attendance for your classes first.',
        'Write the Daily Log in Teaching (the system checks you are on campus and that attendance is done).',
        'Enter marks for tests in Exams when a test is held.',
        'Apply for leave in Leave when needed.',
      ] },
      { h: 'Housemasters / wardens — every day', ol: [
        'Complete the morning roll call before 7:30 AM and the night roll call before 10:00 PM.',
        'Log Discipline, Sickbay, Repairs, Journal, Mess Duty and Activities.',
        'Check the house report that appears when roll call reaches 100%.',
      ] },
      { h: 'Administrators — weekly', ol: [
        'Fees → Data Health: fix students with missing course, hostel type, phone or admission date.',
        'Fees → Digest: review corrections, reverts and concessions; follow up the red flags.',
        'Fees → Reminders: send dues reminders and record promise-to-pay dates.',
        'Fees → Instalments and Register: review overdue plans and expiring concessions.',
        'Hostel: read the neglect report for missed roll calls and tabs.',
      ] },
      { h: 'Administrators — every month', ol: [
        'Export Fees → Dashboard → Month-wise Dues for the meeting.',
        'Check Accounts against the fee collections, then close the month.',
        'Review Reports and the Admin audit log.',
      ] },
      { h: 'Administrators — every April (new session)', ol: [
        'Open Fees → Rollover (planner) to see promotions, repeaters and dues to carry forward.',
        'In Fee Setup, enter the fees for the new session for every course, batch and hostel type.',
        'Promote students and mark repeaters in Students.',
        'Close the March books in Accounts.',
      ] },
    ],
  },
]

export const APPENDIX = [
  {
    id: 'trouble', title: 'Appendix A — When something goes wrong',
    blocks: [
      { table: { head: ['What you see', 'What to do'], rows: [
        ['"Secure database connection is off" or records show empty / ₹0', 'Press "Sign in again". If it continues, tell the admin.'],
        ['"Only an admin can…" or "violates row-level security"', 'You do not have permission for that action. Ask an admin to do it.'],
        ['"…is closed in Accounts"', 'The month is locked. Ask an admin to post or correct the entry.'],
        ['A fee amount looks old or wrong', 'Check Fee Setup for a red NOT CONFIGURED tag for that course/batch/hostel type.'],
        ['A student shows dues you did not expect', 'Check the student\'s course, hostel type and admission date (Fees → Data Health), then the Student Ledger for that month.'],
        ['A scholarship is not reducing the dues', 'It must be Active in Fees → Register and cover that month and fee type.'],
        ['Printing or Save-as-PDF opens nothing', 'Allow pop-ups for the portal in your browser.'],
        ['You were logged out', 'Sessions end after 24 hours, or after the inactivity time the admin set. Sign in again.'],
        ['A button or module is missing', 'Your role does not include it. Ask the admin to review your permissions.'],
        ['A photo is too large', 'Photos are compressed automatically on upload; try again with a normal phone photo.'],
      ] } },
    ],
  },
  {
    id: 'checklist', title: 'Appendix B — New staff first-week checklist',
    blocks: [
      { ol: [
        'Sign in and change nothing until you know your modules (look at the sidebar).',
        'Read "Part 1" and "Part 2" of this guide.',
        'Open Help & Training → Training paths and follow the path for your job.',
        'Read the guide for each module you use and tick "Mark as learned".',
        'Do a practice task with a senior colleague watching (for fees: collect a small test fee and revert it with the admin).',
        'Ask the admin to confirm your permissions are right.',
      ] },
    ],
  },
]
