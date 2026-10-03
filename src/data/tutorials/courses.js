export default {
  id: 'courses',
  title: 'Courses',
  group: 'ACADEMIC',
  roles: ['Admin', 'Any staff'],
  summary: 'The master list of courses, batches, student enrollments and course fee amounts. Other modules use these batches, so keep them correct. Only Admin can add, edit or delete; other staff can only view.',
  before: [
    'Students should already be admitted in the Students module (you pick them by name or GCC number when enrolling).',
    'Create the Batch first, then enroll students into it.',
  ],
  tabs: [
    { name: 'Overview', what: 'Totals for courses, batches, enrollments and active students, with a count by hostel type.' },
    { name: 'Batches', what: 'Create and manage course batches. This is the single source of truth for batches.' },
    { name: 'Enrollments', what: 'See and manage which student is in which batch.' },
    { name: 'Fees', what: 'Fee structure per course, subtype and hostel type.' },
  ],
  steps: [
    {
      title: 'Add a new batch',
      body: [
        'Open Courses and click the "Batches" tab.',
        'Click "+ Add" (only Admin sees this button).',
        'Type the "Batch Name" (for example: Sainik Achiever Boarder 2025-26). It is required.',
        'Choose the "Course". It is required.',
        'Fill Subtype, Class Name, Hostel Type and Session Year as needed.',
        'Fill Teacher, Room, Start Time, End Time, Start Date, End Date and Capacity if you know them.',
        'Set "Status": Active, Upcoming, Completed or Cancelled.',
        'Tap the "Class Days" buttons (Mon to Sun) for the days the class runs.',
        'Click "Add Batch".',
      ],
      tip: 'If Batch Name or Course is empty, the screen shows "Batch name and course required."',
    },
    {
      title: 'Edit or delete a batch',
      body: [
        'In the "Batches" tab, you can filter the list by session year and by course.',
        'Click "Edit" on the batch, change the fields, then click "Update".',
        'To remove a batch, click the bin button and confirm "Delete batch?".',
      ],
      tip: 'Deleting cannot be undone. If a batch is only finished, change its Status to Completed instead.',
    },
    {
      title: 'Enroll a student in a batch',
      body: [
        'Open the "Enrollments" tab and click "+ Enroll".',
        'Use the student search box at the top to pick the student. Name, GCC No., course, class and hostel type fill in automatically and "Student linked" appears.',
        'Check "Course", "Subtype", "Class Name" and "Hostel Type".',
        'Choose the "Batch (filtered)". The list only shows batches of that course and hostel type.',
        'Check Session Year and Enrolled Date. Set Status: Active, Completed, Dropped or On Hold.',
        'Add Notes if needed, then click "Enroll".',
      ],
      tip: 'Student Name and Course are required.',
    },
    {
      title: 'Handle the duplicate enrollment warning',
      body: [
        'If the student already has an Active enrollment, a message warns that saving will create a SECOND active enrollment.',
        'Click Cancel unless you really want two. It is better to edit the old enrollment instead.',
        'If the hostel type you picked is different from the hostel type in the student record, you get another warning.',
        'If the hostel type really changed, update it on the Students page first, then come back.',
      ],
    },
    {
      title: 'Find or change an enrollment',
      body: [
        'In "Enrollments", filter by course and by hostel type (Boarder, Day Boarder, Day Scholar).',
        'Type a name or GCC number in the search box.',
        'Click "Edit" to change it, or the ✕ button to remove it (you must confirm "Remove enrollment?").',
      ],
    },
    {
      title: 'Add a course fee amount',
      body: [
        'Open the "Fees" tab and click "+ Add Fee".',
        'Choose the "Course" and, if needed, the Subtype and Hostel Type. Leave them empty to mean "All".',
        'Choose "Fee Type": Monthly, Quarterly, Half-Yearly, Annual or One-Time.',
        'Type the "Amount (₹)". Course and Amount are required.',
        'Optionally fill Due Day (1 to 31), Discount (%), Session Year and Notes.',
        'Click "Add Fee". Use "Edit" or ✕ on a fee card to change or delete it.',
      ],
      tip: 'Fees are shown in cards grouped by course, subtype and hostel type.',
    },
  ],
  tips: [
    'Only Admin, Administrator and Co-Admin can add, edit or delete. Everyone else can only look.',
    'Use the Overview tab for a quick count of batches and active students.',
    'Always give the batch a clear name with course, hostel type and year.',
  ],
  mistakes: [
    'Creating a second Active enrollment for the same student → edit the existing enrollment instead.',
    'Choosing a different hostel type here than in the student record → fix the Students record first.',
    'Deleting a batch that is still in use → change its Status instead.',
  ],
  faq: [
    { q: 'Why can I not see the "+ Add" or "Edit" buttons?', a: 'Only Admin-type roles can change Courses data. Ask an Admin.' },
    { q: 'Why is my batch missing in the Enroll form?', a: 'The batch list is filtered by the Course and Hostel Type you picked. Check both, or check the batch hostel type.' },
    { q: 'What does Due Day mean in Fees?', a: 'The day of the month on which that fee is due, from 1 to 31.' },
  ],
  related: ['students', 'fees', 'feesetup', 'timetable'],
}
