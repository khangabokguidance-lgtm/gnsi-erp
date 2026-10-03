export default {
  id: 'checklist',
  title: 'Checklist',
  group: 'MANAGEMENT',
  roles: ['Admin', 'Teacher', 'Any staff'],
  summary: 'Track exams and events step by step. An Admin or In-charge gives a checklist to a staff member. The staff member finishes each step, and the In-charge or Admin approves it.',
  before: [
    'Your staff profile must be linked to your login (see Link Staff). Otherwise the page cannot find your checklists.',
    'Your role decides what you can do: Staff do the steps, In-charge and Admin assign, approve and sign off.',
  ],
  tabs: [
    { name: '🏠 Dashboard', what: 'A quick summary of your checklists and pending work.' },
    { name: '📋 Exams', what: 'Exam checklists: Monthly Test, Pre Mock Test and Mega Mock Test.' },
    { name: '📅 Events', what: 'Event checklists: Annual Day, Sports Day, Cultural Event, Parent-Teacher Meeting, Independence / Republic Day, Admission Camp / Open Day, Other.' },
    { name: '🗂️ Records', what: 'Completed (signed off) exams and events, with the full step history. You can export it as CSV.' },
    { name: '📊 Monitor', what: 'Staff progress and recent activity. Only Admin and In-charge see this tab.' },
  ],
  steps: [
    {
      title: 'Assign an exam checklist (Admin / In-charge)',
      body: [
        'Open the "📋 Exams" tab.',
        'Press "＋ Assign".',
        'Choose "👤 Single Staff" or "👥 Bulk Assign".',
        'Pick the Exam Type: Monthly Test, Pre Mock Test or Mega Mock Test.',
        'Type a Title (optional) and choose the Exam Date.',
        'Admin can also choose the Department.',
        'Choose the person in "Assign To", or tick many staff for bulk. "Select All" is available.',
        'Press the save button at the bottom.',
      ],
      tip: 'In bulk mode, each person\'s name is added to the title automatically.',
    },
    {
      title: 'Assign an event checklist (Admin / In-charge)',
      body: [
        'Open the "📅 Events" tab.',
        'Press "＋ Assign Event".',
        'Pick the Event Type and fill Title and Event Date.',
        'Fill "Venue / Location" and "Notes" if needed.',
        'Choose the staff member(s) and save.',
      ],
    },
    {
      title: 'Finish a step (Staff)',
      body: [
        'Open the "Exams" or "Events" tab and find your checklist.',
        'Press the "Steps — Open" button on the card.',
        'Click the step that says "Active". Later steps are locked until earlier ones are approved.',
        'Write what you did in the "Completion note" box. The note is compulsory.',
        'Press "Submit for review →".',
        'The step shows "Awaiting Review" until the In-charge or Admin checks it.',
      ],
      tip: 'If a step is "Rejected", read the rejection reason, fix the work and submit again.',
    },
    {
      title: 'Approve or reject a step (Admin / In-charge)',
      body: [
        'Open the checklist. Cards with work waiting show an orange button.',
        'Click the step with "Awaiting Review".',
        'Read the staff note.',
        'To accept, write optional feedback and press "✓ Approve".',
        'To send it back, you must write a reason in the Feedback box and press "✕ Reject".',
      ],
    },
    {
      title: 'Sign off a finished checklist (Admin / In-charge)',
      body: [
        'Approve every step first.',
        'Open the checklist. The bottom shows "Approve all steps to enable final sign-off" until all steps are approved.',
        'Press "🏁 Final Sign-off — Complete".',
        'The checklist moves to the "🗂️ Records" tab as Finalized.',
      ],
    },
    {
      title: 'Find old records and export',
      body: [
        'Open the "🗂️ Records" tab.',
        'Use the search box, the type drop-down (All Types / Exams Only / Events Only), the month picker, or "Filter by staff…".',
        'Click a record to see who assigned it, who finalized it, and the step audit trail.',
        'Press "⬇ Export CSV" to download the list.',
      ],
    },
  ],
  tips: [
    'The "⏳ Pending" button at the top shows how many steps wait for review. Click it to go to them.',
    'The small coloured dots on a card show each step: grey is pending, blue is in progress, orange is awaiting review, green is approved, red is rejected.',
    'Press 🔄 at the top to refresh.',
  ],
  mistakes: [
    'Submitting a step without a note → the system asks for a completion note. Write what was done.',
    'Rejecting without a reason → a reason is required. Explain what must be fixed.',
    'Trying to skip a step → steps are in order. Only the first non-approved step is active.',
    'Deleting a checklist by mistake → delete (🗑) asks to confirm "Delete this item?". It cannot be undone, so read carefully.',
  ],
  faq: [
    { q: 'Why can I not see the Assign button?', a: 'Only Admin and In-charge can assign checklists. Staff can only do the steps given to them.' },
    { q: 'Who can delete a checklist?', a: 'Admin can delete any checklist. An In-charge can delete only those in their own department. A finalized checklist cannot be deleted.' },
    { q: 'Why do I see only some checklists?', a: 'Staff see only the ones assigned to them. In-charge see their department. Admin sees all.' },
    { q: 'Who counts as In-charge?', a: 'Staff whose role is In-charge, Manager, Coordinator, HOD, Head of Department, Supervisor or Superintendent.' },
  ],
  related: ['exams', 'staff', 'adminlink'],
}
