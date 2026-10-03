export default {
  id: 'leave',
  title: 'Leave',
  group: 'PEOPLE',
  roles: ['Admin', 'HR', 'Any staff'],
  summary: 'Staff leave requests. Admin applies for staff, approves or rejects, and sees unpaid leave deductions. Teaching and Non-Teaching staff see only their own leave records.',
  before: [
    'Staff must already be added in the Staff module.',
    'Only Admin (Admin, Administrator, Co-Admin or Teaching + Admin) can apply, approve, reject or delete. Other staff can only view.',
  ],
  tabs: [],
  steps: [
    {
      title: 'Apply leave for a staff member',
      body: [
        'Open Leave and click "Apply leave".',
        'Choose "Select Staff *".',
        'Choose "Leave Type *": Casual Leave or Sick Leave.',
        'Choose "Half Day Type": Full Day, First Half (0.5 day) or Second Half (0.5 day).',
        'Pick "From Date *" and "To Date *".',
        'Write the "Reason *".',
        'Check the balance box and the Deduction Preview.',
        'Click "Submit leave request". The request is saved as Pending.',
      ],
      tip: 'The To Date must not be before the From Date. If the staff already has leave on those dates, a warning shows and you cannot submit.',
    },
    {
      title: 'Understand the balance and unpaid leave',
      body: [
        'Each staff gets 12 leave days per session. The session runs from 10 January to 9 January and resets every 10 January.',
        'After you choose a staff member, the form shows the total, used and remaining days.',
        'If the request is more than the balance, you see "Exceeds balance - will be treated as LWP".',
        'To make a leave unpaid, tick "Mark as Unpaid Leave (LWP)".',
        'The Deduction Preview then shows the money that will be cut, using the daily rate.',
      ],
      tip: 'Only approved leave counts as used days.',
    },
    {
      title: 'Approve or reject a request',
      body: [
        'Find the request. Use the search box or the "All Status" box (Pending, Approved, Rejected).',
        'Click "✅ Approve" or "❌ Reject".',
        'The status changes and the action is saved in the leave history.',
      ],
      tip: 'The Pending box at the top is a quick filter. Click it to see only pending requests.',
    },
    {
      title: 'Approve or reject many requests at once',
      body: [
        'Tick the box on each request, or tick the top box to select all in the list.',
        'A bar appears. Click "✅ Approve All", "❌ Reject All" or "🗑 Delete All".',
        'Confirm the question that pops up.',
        'Click "Clear" to unselect.',
      ],
      tip: 'Check the list first. Delete All cannot be undone.',
    },
    {
      title: 'See details and history of one request',
      body: [
        'Click the 👁 button on the request.',
        'A window opens with the full details and the history of actions.',
        'Close it with ✖.',
      ],
    },
    {
      title: 'Use the calendar view and export',
      body: [
        'Click "Calendar" at the top to see leave on a calendar. Click "List" to come back.',
        'Admin can click "Export" to download the leave records as a CSV file.',
      ],
    },
    {
      title: 'See your own leave (Teaching and Non-Teaching staff)',
      body: [
        'Open Leave.',
        'You see only your own leave records and their status.',
        'To apply for leave, ask Admin or HR.',
      ],
    },
  ],
  tips: [
    'The top cards show Pending, Approved, Rejected, and for Admin the unpaid leave deduction this month and in total.',
    'Search works on staff name, department, leave type and reason.',
    'Write a clear reason. It helps whoever approves later.',
  ],
  mistakes: [
    'Submitting leave for dates that already have leave → the form blocks it. Check the existing request first.',
    'Choosing the wrong half-day type → a half day counts as 0.5. Choose Full Day for whole days.',
    'Using Delete when you meant Reject → Reject keeps the record. Delete removes it for good.',
    'Forgetting to tick Unpaid Leave (LWP) when the staff has no balance left → tick it so the deduction is shown.',
  ],
  faq: [
    { q: 'Why can I not see the Apply leave button?', a: 'Only Admin roles can apply for leave. Other staff can only view their own records.' },
    { q: 'How many leave days does a staff member get?', a: '12 days per session. The session resets every 10 January.' },
    { q: 'Where do students apply for leave?', a: 'Student leave and gate passes are in the Hostel module, not here.' },
    { q: 'Is there a separate leave list in HR?', a: 'Yes, the HR module has a quick Leaves tab with its own approval steps. The Leave module is the full record.' },
  ],
  related: ['staff', 'hr', 'hostel'],
}
