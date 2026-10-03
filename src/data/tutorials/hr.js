export default {
  id: 'hr',
  title: 'HR',
  group: 'PEOPLE',
  roles: ['Admin', 'HR'],
  summary: 'The Staff Attendance tracker. Mark daily staff attendance, see absentees, apply for and approve leave, check location check-ins, see risk and compliance warnings, and manage teaching shifts.',
  before: [
    'Staff must already be added in the Staff module.',
    'Only Admin, Principal and Vice Principal can mark attendance, override check-ins, assign shifts and use Bulk Ops. Others see "View Only Mode".',
  ],
  tabs: [
    { name: '📊 Dashboard', what: 'Quick overview of staff attendance numbers.' },
    { name: '📅 Daily', what: 'Pick a date and mark each staff member Present, Absent, Late or Leave.' },
    { name: '📉 Absentees', what: 'The top 10 staff with the most absences in a chosen month.' },
    { name: '🏖️ Leaves', what: 'Leave requests with filters. Apply for leave, approve or reject.' },
    { name: '🎯 Risk', what: 'Absence risk for each staff member (High, Medium or Low) based on past records.' },
    { name: '📈 Performance', what: 'Attendance scorecards for each staff member.' },
    { name: '⚖️ Compliance', what: 'Warnings for staff with too many absences or worrying patterns, with a suggested action.' },
    { name: '🔄 Shifts', what: 'Assign teaching time slots (Morning, Slot, Evening, Self Study) to staff.' },
    { name: '📍 Geo', what: 'Location check-ins by staff for a date. Admin can override a failed check-in.' },
    { name: '⚙️ Bulk Ops', what: 'Mark all active staff at once, or import attendance from a CSV file.' },
  ],
  steps: [
    {
      title: 'Mark daily attendance',
      body: [
        'Open HR and click the "📅 Daily" tab.',
        'Choose the date.',
        'Find the staff member. Use the filter buttons (ALL, PRESENT, ABSENT, LEAVE) if needed.',
        'Click one of "✓ Present", "✗ Absent", "⏰ Late" or "✈ Leave".',
        'A message such as "Marked Present" appears. Present also records the check-in time.',
      ],
      tip: 'Clicking again with a different status simply changes the record for that day.',
    },
    {
      title: 'Apply for leave for a staff member',
      body: [
        'Open the "🏖️ Leaves" tab and click "＋ Apply Leave".',
        'Choose the staff member (only active staff are listed).',
        'Fill the leave type, start date, end date and "Reason...".',
        'Click "Submit Leave". If a field is missing you see "Fill all fields".',
      ],
      tip: 'The list shows each request with its days and status.',
    },
    {
      title: 'Approve or reject a leave request',
      body: [
        'Open the "🏖️ Leaves" tab.',
        'Use the filter buttons (all, submitted, hod approved, principal approved, approved, rejected).',
        'On a request with status SUBMITTED, click "✓ Approve" or "✗ Reject".',
      ],
      tip: 'Only requests that are still SUBMITTED show the two buttons.',
    },
    {
      title: 'Approve a location check-in that failed',
      body: [
        'Open the "📍 Geo" tab and choose the date.',
        'Find the staff member whose check-in is not approved.',
        'Click "Override ✓".',
        'The check-in is approved and attendance is marked Present.',
      ],
      tip: 'Only Admin, Principal and Vice Principal see Override. Verified check-ins mark attendance automatically.',
    },
    {
      title: 'Assign a teaching shift',
      body: [
        'Open the "🔄 Shifts" tab and choose the date.',
        'Click "＋ Assign".',
        'Choose Staff, Time Slot, Batch and Subject. All four are required.',
        'Save. A message says "Shift assigned!".',
        'To remove a shift click the 🗑 button and confirm "Delete".',
      ],
    },
    {
      title: 'Mark everyone at once or import a CSV',
      body: [
        'Open the "⚙️ Bulk Ops" tab.',
        'Choose the "Target Date".',
        'Click "✓ Mark All Present" or "✗ Mark All Absent". Only active staff are marked.',
        'Or choose a CSV file with two columns, staff_id and status (example: 101,Present). The first row is a heading.',
        'Check the preview list and click "✓ Confirm Import".',
      ],
      tip: 'Bulk marking replaces any status already saved for that date.',
    },
    {
      title: 'Check warnings in Compliance',
      body: [
        'Open the "⚖️ Compliance" tab.',
        'Read each warning: more than 8 absences in this month, 3 or more absences in a row, or a Friday absence pattern.',
        'Take the suggested action (for example, issue a warning letter).',
        'Click "Dismiss" to hide a warning from the list.',
      ],
      tip: 'The "✓ Approve" button here only shows a message. It does not send a letter or change any record.',
    },
  ],
  tips: [
    'The tracker uses the last 3 months of attendance records.',
    'Use "📉 Absentees" before the monthly meeting to see who needs a talk.',
    'Check the date before you mark. The Daily tab starts on today.',
  ],
  mistakes: [
    'Clicking Mark All Absent by accident → it overwrites that date for every active staff. Mark All Present again, or fix individually in Daily.',
    'Marking the wrong date → check the date box before clicking a status.',
    'CSV with names instead of ids → use the numeric staff_id in the first column.',
    'Expecting Dismiss to delete a warning forever → it only hides it until the page reloads.',
  ],
  faq: [
    { q: 'Why can I only view and not mark?', a: 'Only Admin, Principal and Vice Principal can mark attendance. You will see "View Only Mode".' },
    { q: 'Is this the same as the Leave module?', a: 'No. The Leaves tab here is a quick leave list. The Leave module has the full leave system.' },
    { q: 'What does Present from Geo mean?', a: 'The staff member checked in near the school using their phone location, or Admin used Override.' },
  ],
  related: ['staff', 'leave', 'faceattendance'],
}
