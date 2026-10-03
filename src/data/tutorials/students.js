export default {
  id: 'students',
  title: 'Students',
  group: 'CORE',
  roles: ['Admin', 'Reception', 'Accountant', 'Teacher', 'Housemaster'],
  summary: 'The register of all enrolled students. Look up a student, see attendance, exam scores and fees, edit details, and run reports. New students are NOT added here. They come from Admissions.',
  before: [
    'A student appears here only after Admissions → Enroll has been done.',
    'What you can do depends on your role. Edit, Delete, Merge and Rollover need Admin (or Manager) rights. Fee needs Admin or Accounts. Exams and Attendance need Admin, Teacher (Attendance also Hostel).',
    'Phone numbers, father name and address are hidden for roles that are not allowed to see them.',
  ],
  tabs: [
    { name: 'Courses', what: 'Students grouped by course and batch, with course-wise counts. This tab opens first.' },
    { name: 'Dashboard', what: 'Charts and summary numbers for all students.' },
    { name: 'All Students', what: 'The full student list as cards, with search, filters, selection, bulk actions, export and archive.' },
    { name: 'Scholarship/Waiver', what: 'The record book of all scholarship and fee waiver requests, with pending ones to approve or reject (Admin).' },
    { name: 'Data Quality', what: 'Shows students with missing details so you can complete them.' },
  ],
  steps: [
    {
      title: 'Find a student',
      body: [
        'Open Students and click the "All Students" tab.',
        'Type a name or GCC number in the search box.',
        'Use the filter dropdowns (for example status, course, hostel, house, gender, session, batch) to narrow the list.',
        'Click "✕ Clear" to remove all filters.',
        'Click a student card to open the student details.',
      ],
      tip: 'Click "⭐ Presets" to save a set of filters and reuse it later.',
    },
    {
      title: 'See a student\'s full profile',
      body: [
        'Click the student card.',
        'A side panel opens with tabs: Profile, Academic, Attendance, Fees, Scholarship/Waiver, Documents and Notes.',
        'Click each tab to see that information.',
        'Close the panel when you are done.',
      ],
    },
    {
      title: 'Add a new student',
      body: [
        'Students cannot be created here.',
        'Click "New Admission" (shown to users who can edit). It takes you to Admissions.',
        'In Admissions, create the application, collect the admission fee and click Enroll.',
        'The student then appears here.',
      ],
      tip: 'This keeps the chain Admissions → Students → Fees → Accounts correct.',
    },
    {
      title: 'Edit student details',
      body: [
        'On the student card click the Edit (pencil) button. Only Admin or Manager roles see it.',
        'Change the details. Name and GCC No. are required.',
        'Fill sections such as Course & Class, Family & Contact and Medical & Notes as needed.',
        'Save the form. A message "Student updated" appears.',
      ],
      tip: 'The GCC No. cannot be changed on an existing student. Scholarship and waiver are not edited here. Use a request (see below).',
    },
    {
      title: 'Request a scholarship or fee waiver',
      body: [
        'Open the student and click the "Scholarship/Waiver" tab.',
        'Click "+ New Request" (needs Fees rights).',
        'Choose Scholarship or Fee Waiver, enter the amount and the Reason.',
        'Submit. You can print the request form.',
        'An Admin then approves or rejects it in this tab or in the main "Scholarship/Waiver" tab. Admin has to enter a PIN to approve or reject.',
        'Once approved, it is applied to the student\'s fees.',
      ],
      tip: 'The amount must be more than zero.',
    },
    {
      title: 'Archive a student and undo it',
      body: [
        'On the student card click the Delete (dustbin) button. Only Admin or Manager see it.',
        'Read "Archive Student" and click "Archive".',
        'A bar appears for 7 seconds. Click Undo if it was a mistake.',
        'Later, click the "Archive" button in the toolbar to see archived students and press "↩ Restore" to bring one back.',
      ],
      tip: 'Archive hides the student. It does not delete the record.',
    },
    {
      title: 'Do an action for many students (bulk)',
      body: [
        'In "All Students", tick the boxes on the cards, or click "☑ Select Page".',
        'A bar appears with buttons: Bulk Actions, Reassign House, Bulk Fee and Scholarship/Waiver.',
        'Bulk Actions lets you Change Status, Promote, Change Session, Change Batch or Archive the selected students.',
        'Bulk Fee asks for Amount / Student, Month For (for example Jan 2026) and Method, then collects that fee for every selected student.',
        'Confirm the question. Click the round "x" button to clear the selection.',
      ],
      tip: 'Bulk Fee needs Fees rights. Check the total in the confirm message before you press OK.',
    },
    {
      title: 'Move students to the next session (Rollover)',
      body: [
        'Click "Rollover" in the toolbar (Admin or Manager only).',
        'Step 1: pick the Source Session and Target Session.',
        'Step 2: check the preview. It shows each student\'s new batch and session. Students with no next batch will become "Passed Out".',
        'Step 3: click "Execute Rollover".',
      ],
    },
    {
      title: 'Download lists and reports',
      body: [
        'Click "Export" in the toolbar (Admin, Manager or Accounts). Choose Student List (CSV), Student List (PDF) or Parent Contacts.',
        'Click "Reports" to open the report maker and print a professional report.',
      ],
    },
  ],
  tips: [
    'The coloured numbers at the top show Active students, average attendance, boarders and fee dues.',
    'Click "Refresh" if the list does not look current.',
    'Use the Data Quality tab to find students with missing phone, address or other details.',
    'Use "Merge" (Admin) to combine duplicate student records.',
    'The Courses tab remembers the course you last looked at.',
  ],
  mistakes: [
    'Trying to add a student with a form here → go to Admissions and enrol the applicant instead.',
    'Changing a student to Dropout/Withdrawn in Admissions → do this in Students. Admissions blocks status changes for enrolled students.',
    'Bulk Rollover before checking the preview → always read step 2.',
    'Not seeing Edit or Delete buttons → your role is read-only for those. Ask Admin.',
  ],
  faq: [
    { q: 'Why can I not see a student?', a: 'Archived students are hidden. Check the "Archive" button. Also check that filters are cleared. Students not yet enrolled in Admissions are not listed.' },
    { q: 'Can I change a GCC number?', a: 'No. The GCC No. links the student with Admissions, Fees and Accounts and cannot be changed on an existing student.' },
    { q: 'Who approves scholarships and waivers?', a: 'An Admin, using a PIN. Until then the request stays pending.' },
    { q: 'Where do I mark attendance?', a: 'In the Attendance module. Here the Attendance button only shows the record.' },
    { q: 'How do I mark a student as left the school?', a: 'Edit the student and change Status (Inactive, Passed Out, Withdrawn or Dropout). A Left Date field appears.' },
  ],
  related: ['admissions', 'fees', 'studentfeeledger', 'attendance', 'hostel'],
}
