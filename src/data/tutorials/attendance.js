export default {
  id: 'attendance',
  title: 'Attendance',
  group: 'ACADEMIC',
  roles: ['Teacher', 'Housemaster', 'Admin', 'Reception'],
  summary: 'Mark daily student attendance by class session, see sessions, reports and dashboards, manage the student list (Student DB), student leave requests and the monthly attendance award.',
  before: [
    'Students must be in the Student DB with the right Course and Batch. Only active students appear in the roll call.',
    'It helps if the batch has a timetable (Timetable module), because Subject and Teacher can then fill in from the Period.',
  ],
  tabs: [
    { name: 'Overview', what: 'Quick numbers: students enrolled, average attendance, high risk and on track.' },
    { name: 'Student DB', what: 'The student list: add, edit, mark as dropout, delete, import from CSV. Views: Active, Dropout, Trash (Trash is Admin only).' },
    { name: 'Student 360', what: 'For each student: attendance, discipline, fees and hostel status in one view. Has "Export CSV".' },
    { name: 'Mark', what: 'Take attendance for a class session.' },
    { name: 'Sessions', what: 'All recorded attendance sessions. Filter by date and course, open one, or delete it.' },
    { name: 'Dashboard', what: 'Charts: attendance by course over time, weekday pattern, status split, longest streaks and who needs attention. Choose the last 3, 6 or 12 months.' },
    { name: 'Reports', what: 'Sub-tabs Monthly, Batch trend, Heatmap, By subject and Staff log. Print or Export CSV.' },
    { name: 'Leaves', what: 'Student leave requests. Sub-tabs Pending, Approved, Rejected and "+ Apply".' },
    { name: 'Awards', what: 'Best Student of the Month, ranked by attendance percentage.' },
  ],
  steps: [
    {
      title: 'Take attendance for a class',
      body: [
        'Open Attendance and click "Mark".',
        'Choose the "Course" (required) and the "Batch". "Class" is optional (for example 9A).',
        'Choose the "Date". It shows today by default.',
        'Choose the "Period". If the timetable has it, Subject and Teacher fill in automatically. You can also choose them yourself.',
        'Everyone starts as Present. Change the status of absent, late or leave students. The statuses are Present, Absent, Late and Leave.',
        'Use the search box (name or GCC number) to find a student quickly.',
        'Click "Save attendance · N students".',
        'After saving, a success box appears and a WhatsApp report panel opens. If there are absent students, a panel to message parents also opens.',
      ],
      tip: 'Each Save creates a new session. Do not save the same class twice.',
    },
    {
      title: 'Mark fast with GCC number',
      body: [
        'In "Mark", find the box "⚡ Quick mark — scan or type GCC number, press Enter".',
        'Type or scan the GCC number and press Enter.',
        'The student is marked Present and you see "marked Present". If the number is not found you see "No student found for GCC ...".',
      ],
      tip: 'A barcode scanner works here because it types the number and presses Enter.',
    },
    {
      title: 'Copy last session or flip everyone',
      body: [
        'Choose a Course first.',
        'Click "Copy last" to copy the records of the last session for that course.',
        'Click "Invert" (on large screens) to flip Present to Absent and the others to Present.',
        'Fix any students who need a different status, then Save.',
      ],
    },
    {
      title: 'Check or delete a recorded session',
      body: [
        'Click "Sessions".',
        'Use the date and course filters. Click "Clear filters" to reset.',
        'Click a session to see its records.',
        'To remove it click the delete icon, then "Delete" in the question "Delete this session and all its records permanently?". This cannot be undone.',
      ],
    },
    {
      title: 'Get a monthly report',
      body: [
        'Click "Reports".',
        'Choose a sub-tab: Monthly, Batch trend, Heatmap, By subject or Staff log.',
        'Choose the month and the course ("All courses" is allowed).',
        'Click "🖨️ Print" or "⬇️ Export CSV".',
      ],
      tip: 'In the monthly report the colour bands are Good 75% and above, Low 50 to 74%, Risk below 50%.',
    },
    {
      title: 'Add a student or change a student',
      body: [
        'Click "Student DB". The tabs are "👥 Active", "🚪 Dropout" and (Admin only) "🗑 Trash".',
        'Click "+ Add Student". Name is required. Choose Course and Batch. GCC No. must be a number.',
        'Fill Parent Contact No. and Hostel Type, then save.',
        'To change a student click "✏️ Edit".',
        'To stop a student from appearing in roll call, mark them as Dropout and click "⚠️ Confirm Dropout". They can come back with "↩️ Reactivate".',
        'Admin can use "⬆️ Import CSV". The file must have a "name" column.',
      ],
      tip: 'Parent phone numbers are hidden from staff who are not Admin.',
    },
    {
      title: 'Apply for and approve student leave',
      body: [
        'Click "Leaves", then "+ Apply".',
        'Fill Student name, From, To and Reason. Course and Batch are optional. All four main fields are required.',
        'Submit. The request shows in "Pending".',
        'Admin opens "Pending" and clicks Approve or Reject.',
      ],
    },
    {
      title: 'Finalize the Best Student of the Month (Admin)',
      body: [
        'Click "Awards". The ranking is by attendance percentage.',
        'Admin clicks "Finalize" to save the award for a course or overall.',
        'A certificate can be viewed after the award is saved.',
      ],
      tip: 'Staff who are not Admin can only look at the ranking.',
    },
  ],
  tips: [
    'Mark attendance first, because Teaching logs cannot be saved until attendance is marked for that batch and date.',
    'On a phone, the bottom bar shows the main five pages. The rest are under "More".',
    'Add a Remarks note on the Mark page for special days.',
  ],
  mistakes: [
    'Saving the roll call without checking the date → check the Date field before saving.',
    'Saving the same class twice → open Sessions and delete the wrong session.',
    'Choosing the wrong Batch → students of other batches will not show. Choose the correct Batch.',
    'Deleting a student who left → mark them as Dropout instead, so their history stays.',
  ],
  faq: [
    { q: 'Why is a student missing from the Mark list?', a: 'Dropout students and deleted students are not shown. Also check the Course and Batch of the student in Student DB.' },
    { q: 'Who can permanently delete a student?', a: 'Only Admin ("🗑 Delete Forever" in Trash). Other staff can only move a student to trash.' },
    { q: 'What do the risk labels mean?', a: 'The Overview and Student 360 use High risk, Watch and On track. They come from attendance, open discipline cases, overdue fees and hostel status.' },
    { q: 'Can I undo a saved attendance?', a: 'The Mark page only creates new sessions. If a session was wrong, delete it in Sessions and mark the class again.' },
  ],
  related: ['students', 'teaching', 'timetable', 'exams', 'courses'],
}
