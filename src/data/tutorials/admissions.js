export default {
  id: 'admissions',
  title: 'Admissions',
  group: 'CORE',
  roles: ['Admin', 'Reception'],
  summary: 'Take new admission applications, collect the admission fee, and move each applicant step by step to Admitted and Enrolled. Enrolling creates the student record.',
  before: [
    'Admin should have an Active session set (in Admission Sessions). New applications are tagged to it. If the session is locked, nothing can be saved.',
    'Fee Setup should have the fee rates entered. The monthly fee shown after saving comes from them.',
    'Keep the documents ready: birth certificate, Aadhaar, photo, mark sheet and similar.',
  ],
  tabs: [
    { name: '📝 New Application', what: 'The step-by-step application form.' },
    { name: '📋 Applications', what: 'The list of all applications with counts, search, filters and actions.' },
    { name: '🔗 Student Ledger', what: 'Search one student and see the connected student record and full fee history.' },
    { name: '📅 Sessions', what: 'Create sessions, make one Active and Lock or Unlock it.' },
  ],
  steps: [
    {
      title: 'Take a new application',
      body: [
        'Click the "📝 New Application" tab.',
        'Go through the steps: Programme, Candidate, Parents & Contact, Address, Schooling, Exam Registration, GNSI Assessment, Documents.',
        'Fill all required fields. Missing items are listed. The GCC No. is suggested as the next free number. Change it if needed.',
        'Phone, WhatsApp and Emergency phone must be 10 digits.',
        'Tick the enclosures and the declaration on the Documents step.',
        'Click "Review application →", check everything, then click "✓ Confirm & submit application".',
      ],
      tip: 'If the screen closes by mistake, an "Unsaved draft found" bar offers "Resume draft".',
    },
    {
      title: 'Collect the admission fee',
      body: [
        'After you submit, the fee window opens by itself and the status stays "Applied".',
        'Collect the admission fee there.',
        'If you closed it, click "Collect Fee" (or "Fee Account") on the applicant\'s card later.',
      ],
    },
    {
      title: 'Admit the applicant',
      body: [
        'Open the "📋 Applications" tab.',
        'Find the applicant with status Applied or Under Review.',
        'Click "Admit" and confirm "Mark as Admitted?".',
        'The status becomes Admitted.',
      ],
    },
    {
      title: 'Enroll the student',
      body: [
        'Find the Admitted applicant whose admission fee is paid.',
        'Click "Enroll →" and confirm.',
        'The student record is created and the status becomes Enrolled.',
        'If the admission fee is not paid, you get "Collect admission fee first" and the fee window opens.',
        'If the chosen house is full, enrollment stops with a message and the status stays unchanged.',
      ],
      tip: 'Enroll one student at a time. Bulk change to Enrolled is blocked.',
    },
    {
      title: 'Search and filter applications',
      body: [
        'In "📋 Applications", click a status box (Applied, Under Review, Admitted, Enrolled, Rejected, Waitlisted) to show only that status. Click it again to show all.',
        'Use the Session, Course, Batch, Hostel and House strips to narrow the list.',
        'Use "🔎 Advanced" for more filters.',
        'Switch the view with the four small view buttons (cards, table, kanban, gallery).',
      ],
    },
    {
      title: 'Edit an application or change status quickly',
      body: [
        'Open the card and use Edit to change the full application.',
        'Use the quick edit to change status, house, follow-up date or bed number only.',
        'Save. Status "Enrolled" can only be set with the Enroll button.',
      ],
      tip: 'The GCC No. cannot be changed after enrollment or after any fee is collected.',
    },
    {
      title: 'Delete a wrong application',
      body: [
        'Only Admin can delete. Click the delete button on the card and confirm.',
        'A message shows for 5 seconds with an Undo option.',
        'After 5 seconds the record is removed for good.',
      ],
      tip: 'Enrolled applicants, or those with fees collected, cannot be deleted. Set them to Rejected, or revert the fees in Fees first.',
    },
    {
      title: 'Import, export and bulk actions',
      body: [
        'Click "📥 Import" and paste a CSV with the headers name, gcc_no, gender, dob, course, batch, house, hostel_type, session, phone, father_name, status.',
        'Click "📤 Export" to download the list. Confirm the warning because the file has phone numbers and addresses.',
        'Tick several cards for bulk actions (Admin): set status, set house, export, print, WhatsApp blast or delete.',
        '"Auto-assign house" shares unassigned boarders across the houses.',
      ],
    },
  ],
  tips: [
    'The top card shows Total applications, Admitted, Enrolled, Pending and the monthly revenue.',
    'The progress line shows the flow: Applied → Under Review → Admitted → Fee Collection → Enrolled → Student.',
    'Keyboard shortcuts shown on the page include N for a new application and V to change the view.',
    'Use "Viewing:" at the top to look at another session. It only changes this page.',
    '📊 Analytics shows charts for the applications.',
  ],
  mistakes: [
    'Enrolling before the admission fee is paid → collect the fee first.',
    'Date of birth outside the exam window → the form refuses it. Check the date and the course.',
    'Typing the GCC No. wrongly and fixing it after fees → it cannot be changed then. Check it before saving.',
    'Creating applications while the session is locked → ask Admin to unlock the session.',
    'Deleting an enrolled student\'s application → mark the student Dropout or Withdrawn in Students instead.',
  ],
  faq: [
    { q: 'Who can create applications?', a: 'Admin and Reception can create. Delete and bulk actions are for Admin only. Other staff can mostly view and edit.' },
    { q: 'Where do new students appear?', a: 'In Students, after you click Enroll.' },
    { q: 'What if I get "Session locked"?', a: 'The active session is locked. Ask Admin to unlock it in the Sessions tab.' },
    { q: 'Can I enroll many students together?', a: 'No. Enroll each one with the Enroll button so the fee is checked.' },
    { q: 'Why is my date of birth refused?', a: 'The date must fall in the official window for the course exam (AISSEE or JNVST) and the class applied for.' },
  ],
  related: ['students', 'bulkadmission', 'fees', 'admissionsessions', 'studentfeeledger'],
}
