export default {
  id: 'staff',
  title: 'Staff',
  group: 'PEOPLE',
  roles: ['Admin', 'HR'],
  summary: 'Staff profiles, task assignment, monthly performance scores and staff location attendance. Everyone can look; only Admin and Staff Manager can add, edit or delete.',
  before: [
    'Salary is set separately after the profile is added, and it needs the Admin PIN.',
    'For performance scoring, attendance and tasks should already be recorded for the month.',
  ],
  tabs: [
    { name: '👥 Staff', what: 'Staff cards with search and filters. Add, edit, set salary, delete and enrol face from here.' },
    { name: '📋 Tasks', what: 'Task monitor. See all tasks, their status and who is late. Assign new tasks.' },
    { name: '📊 Scoring', what: 'Admin only. Monthly performance scoring for every staff member.' },
    { name: '🏆 Leaders', what: 'Performance leaderboard for the chosen month.' },
    { name: '📅 History', what: 'Choose one staff member to see their score history and trend.' },
    { name: '📍 Geo', what: 'Location-based attendance. Staff mark their own attendance here. Admin also sees pending face enrolments.' },
  ],
  steps: [
    {
      title: 'Add a new staff member',
      body: [
        'Open Staff. On the "👥 Staff" tab click "➕ Add Staff".',
        'Fill "Full Name *" and "Designation *". These two are required.',
        'Fill Phone (10 digits), Email, Joining Date and Qualification if you have them.',
        'Choose Department, Role (Teaching, Non-Teaching, Admin or Teaching + Admin) and Status.',
        'Click "✅ Save Staff".',
        'Then set the salary: click "🔐 Salary" on the new card.',
      ],
      tip: 'A wrong phone or email shows a red warning under the box. Fix it and save again.',
    },
    {
      title: 'Find a staff member',
      body: [
        'Type in "🔍 Search name, phone, role…".',
        'Use the "All Status" and "All Roles" boxes to filter.',
        'Use the page arrows at the bottom. Each page shows up to 25 staff.',
      ],
    },
    {
      title: 'Edit a profile or delete a staff record',
      body: [
        'Find the staff card.',
        'Click "✏️ Edit", change the details and save.',
        'To delete, click "🗑 Delete" and confirm "Delete".',
      ],
      tip: 'Delete is permanent. If someone has left, consider changing Status to Inactive instead.',
    },
    {
      title: 'Set salary (needs Admin PIN)',
      body: [
        'Click "🔐 Salary" on the staff card.',
        'If asked, type the Admin PIN and click "🔓 Verify".',
        'Fill Basic Salary, HRA, Seniority Allowance, Loyalty Bonus and Role Bonus in rupees.',
        'Save. A message says "Salary saved".',
      ],
      tip: 'After you enter the PIN, salary stays unlocked for 15 minutes. A green "🔓 Admin session active" badge shows this.',
    },
    {
      title: 'Assign a task',
      body: [
        'Go to the "📋 Tasks" tab and click "＋ Assign Task". You can also use the assign button on a staff card.',
        'Type the "Task Title *" and the instructions.',
        'Choose "Assign To *", Department, Priority (High, Medium, Low) and Due Date.',
        'Click "✅ Assign Task".',
        'Later, use "Start" to move a task to In Progress, and "✅" to mark it Done. "View" shows the details.',
      ],
      tip: 'Click a staff box in "Staff Task Overview" to see only that person\'s tasks.',
    },
    {
      title: 'Do the monthly performance scoring (Admin only)',
      body: [
        'Open the "📊 Scoring" tab.',
        'Choose the month and set the working "Days".',
        'Click "⚡ Auto-Mark All". It fills attendance, tasks, feedback and initiative from the records.',
        'Check the numbers and change any that look wrong.',
        'Click "💾 Save".',
        'When the month is final, click "✅ Lock" and confirm.',
      ],
      tip: 'The score is out of 100: attendance 30, punctuality 20, tasks 20, feedback 15, initiative 15.',
    },
    {
      title: 'Mark your own attendance by location',
      body: [
        'Open the "📍 Geo" tab.',
        'Follow the Self Attendance screen to mark attendance using your device location.',
      ],
      tip: 'Allow location access in the browser when it asks.',
    },
  ],
  tips: [
    'Staff who cannot edit see a "👁 View only" badge at the top.',
    'Levels used in scoring: Elite 90+, Outstanding 75-89, Excellent 60-74, Good 45-59, Probation below 45.',
    'On a staff card, "🧑‍💼 Enroll Face" starts face enrolment. It shows "Face ✓" when done.',
    'The Gross Salary on a card is the sum of basic, seniority, loyalty, role bonus and HRA.',
  ],
  mistakes: [
    'Saving without Designation → Name and Designation are required. Fill both.',
    'Typing a phone number with spaces or letters → use exactly 10 digits.',
    'Locking scores too early → "Lock" cannot be reversed. Save and check first.',
    'Deleting a staff record that is only on leave or has left → set Status to Inactive instead.',
  ],
  faq: [
    { q: 'Why can I not see Add Staff or Edit?', a: 'Only Admin, Co-Admin and Staff Manager can change staff records. Others have view-only access.' },
    { q: 'Why is the Scoring tab missing?', a: 'Scoring is for Admin only.' },
    { q: 'The Salary button asks for a PIN. What is it?', a: 'It is the Admin PIN. Ask the Admin. Without it you cannot see or change salary.' },
    { q: 'What does Auto-Mark All use?', a: 'It uses location attendance records, task records and exam scores to fill the score fields.' },
  ],
  related: ['hr', 'leave', 'faceattendance'],
}
