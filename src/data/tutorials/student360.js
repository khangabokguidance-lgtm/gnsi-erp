export default {
  id: 'student360',
  title: 'Student 360°',
  group: 'MANAGEMENT',
  roles: ['Admin'],
  summary: 'See everything every module has recorded about one student on a single screen (profile, fees, attendance, exams, hostel and more). It also finds and helps fix records that do not match between modules. Admin only.',
  before: [
    'Only Admin accounts can open it. Others see "Admin access only".',
    'The student must already exist in the Students module.',
  ],
  tabs: [
    { name: '🔍 Search Student', what: 'Find one student and see their full record from all modules.' },
    { name: '🌐 Global Search', what: 'Search a word, receipt number, phone number or note across every module.' },
    { name: '🧠 Admin Intelligence', what: 'Extra insight screen for the Admin.' },
    { name: '📊 Mismatch Dashboard', what: 'A list of records that disagree between modules, with Fix, Acknowledge and Resolve actions.' },
    { name: '🏫 School Overview', what: 'School-wide numbers: enrollment by course, students by house, fee collection, hostel occupancy, and fee defaulters.' },
    { name: '🗄️ Table Browser', what: 'Browse the raw tables of the system.' },
  ],
  steps: [
    {
      title: 'Look up one student',
      body: [
        'Open "Student 360°" and stay on "🔍 Search Student".',
        'Type in "Search by name, GCC No, admission no, or batch…".',
        'Click the student in the results.',
        'Wait for "Pulling records from every module…".',
        'Read the top card, the summary strip and the charts (attendance, exam marks, fee breakdown).',
      ],
    },
    {
      title: 'Read the sections of a student',
      body: [
        'Scroll to the section cards: Student Profile, Admission Record, Fees, Attendance, Exam Marks, Hostel, Discipline, Sickbay, Leave Records, Gate Passes, Enquiries & Parent Items and Complaints.',
        'Click a card to open it. Or press "⬇ Expand All" to open all cards, and "⬆ Collapse All" to close them.',
        'Some cards have a link to the full module (for example Students, Fees, Hostel). Click it to go there.',
        'Press "⬇ CSV" on a card to download that data.',
      ],
    },
    {
      title: 'Correct a field in the student record',
      body: [
        'Find the field in a section such as Student Profile or Hostel.',
        'Click the small ✎ pencil next to the value.',
        'Type or choose the new value.',
        'Press "Save", or "Cancel" to stop.',
      ],
      tip: 'Only fields that the system allows are editable. Changes are saved in the real record, so other modules show the new value too.',
    },
    {
      title: 'Alert the admin about mismatches',
      body: [
        'When a student has mismatch flags, a flag list shows under the charts.',
        'Press "🔔 Notify Admin" to log the flags.',
        'The button then says "✓ Admin notified". If the flags were already logged it says "Already flagged — no new alert sent".',
      ],
    },
    {
      title: 'Work through the Mismatch Dashboard',
      body: [
        'Open the "📊 Mismatch Dashboard" tab.',
        'Read the top numbers: Total open, Critical, Warning, Students affected, Unacknowledged.',
        'Filter by name or GCC, severity, status or issue type. Press "↻ Refresh" to reload.',
        'On a row, press "✎ Fix …" to correct the value right there (then "Save"), or open the student.',
        'Press "Acknowledge" to say you have seen it, or "Resolve" when it is fixed.',
      ],
      tip: 'Start with the Critical items.',
    },
    {
      title: 'Search across the whole system',
      body: [
        'Open the "🌐 Global Search" tab.',
        'Type at least 2 letters or numbers (a receipt number, phone number, gate pass reason, discipline note…).',
        'Press "Search" or Enter.',
        'Use the filter buttons to narrow by module. Click a result to open the student or the module.',
      ],
    },
    {
      title: 'See school-wide numbers and fee defaulters',
      body: [
        'Open the "🏫 School Overview" tab.',
        'Read the cards: Enrollment by Course, Students by House, Fee Collection Summary, Hostel Occupancy by House and Students With No Fee Payment On Record.',
        'In "Fee Defaulters (Exact Amounts Owed)", press "Compute Exact Dues" and wait.',
      ],
      tip: 'Compute Exact Dues checks every active student, so it takes some time.',
    },
  ],
  tips: [
    'Use this page to check a student before calling the parents, so you see fees, attendance and exams in one place.',
    'Green and red colours on the cards show if something is fine or needs attention (for example attendance under 75% shows red).',
    'Click a student name in dashboards to jump straight to their full record.',
  ],
  mistakes: [
    'Editing a value without checking the other modules → the same fact may be wrong elsewhere. Look at the mismatch flags too.',
    'Marking a mismatch "Resolve" before fixing it → fix it first with the "✎ Fix" button.',
    'Using Backfill and Cleanup buttons without need → read the message first. They change hostel allocation records for many students.',
  ],
  faq: [
    { q: 'Why can I not open this module?', a: 'It is for Admin accounts only. Ask the Admin.' },
    { q: 'What does the Backfill button do?', a: 'It appears when students have a house but no allocation record. "⚡ Backfill house allocations" creates the missing allocation records after you confirm.' },
    { q: 'What is "🧹 Remove Dayscholar allocation rows"?', a: 'It removes hostel allocation rows wrongly created for day scholars. It does not touch real boarding allocations.' },
    { q: 'Where do I change fees or attendance in full?', a: 'Use the link on the card to open the real module, such as Fees or Attendance.' },
  ],
  related: ['students', 'fees', 'attendance', 'hostel', 'reception'],
}
