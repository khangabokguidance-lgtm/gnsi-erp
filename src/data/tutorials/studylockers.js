export default {
  id: 'studylockers',
  title: 'Study Lockers',
  group: 'ACADEMIC',
  roles: ['Admin', 'Teacher'],
  summary: 'Each teacher gets a password-protected locker for their own study materials. From a locker you can also make practice papers as PDF or Word files.',
  before: [
    'Admin must create a locker for the teacher and give the teacher the password.',
    'To make a paper from the Question Bank, questions for that subject must already be in the Question Bank.',
  ],
  tabs: [
    { name: '🗃️ All Lockers', what: 'All lockers as cards. Filter by course, then click a card to unlock or open it.' },
    { name: 'Teacher locker tab (shows the icon and teacher name)', what: 'Appears after you unlock a locker. Shows that locker\'s materials, search and filters.' },
    { name: '⚙️ Admin', what: 'Admin only. Create lockers, reset passwords and delete lockers.' },
  ],
  steps: [
    {
      title: 'Create a locker (Admin only)',
      body: [
        'Open Study Lockers and click the "⚙️ Admin" tab.',
        'Type the "Teacher Name".',
        'Choose the "Course" and then the "Subject".',
        'Type the "Locker Password". Share it with the teacher yourself.',
        'Pick an icon and a locker colour.',
        'Click the create button. A message says the locker was created.',
      ],
      tip: 'All of Teacher Name, Subject and Password are required.',
    },
    {
      title: 'Unlock and open your locker',
      body: [
        'Open the "🗃️ All Lockers" tab.',
        'Use the course buttons (All Courses, Sainik School and so on) to find your card.',
        'Click your locker card.',
        'Type the password in "Enter Locker Password" and click the unlock button.',
        'If the password is wrong, you see "Incorrect password. Try again."',
      ],
      tip: 'A locker locks again by itself after 30 minutes. Click "🔒 Lock" to lock it sooner.',
    },
    {
      title: 'Add materials to your locker',
      body: [
        'Unlock your locker.',
        'Click "📋 Bulk Paste".',
        'Paste your list: one item per line, with a title and a Drive or YouTube link.',
        'Click "🔍 Detect Items with AI" and wait.',
        'Check the list and untick anything you do not want.',
        'Click "✅ Save … to Locker".',
      ],
      tip: 'If detection fails, a "Parse error" message shows. Check your internet and try again.',
    },
    {
      title: 'Find or delete a material',
      body: [
        'Use "🔍 Search materials…" to search by title or chapter.',
        'Use the type buttons (All, Notes PDF, Formula Sheet and so on) to filter.',
        'Click "▶ Watch", "🔗 Open Link" or "📥 Download" to open a material.',
        'To remove one, click "🗑 Delete" on it and confirm. This cannot be undone.',
      ],
      tip: 'Delete is shown only while the locker is unlocked.',
    },
    {
      title: 'Make a practice paper',
      body: [
        'Unlock your locker and click "📄 Create Paper".',
        'Type the "Paper Title" and the "Instructions".',
        'Choose the Question Source: "📚 From QBank" or "✍️ Type Manually".',
        'For QBank: tick the questions you want, or use "Select All". The selected count and total marks show beside it.',
        'For manual: click "+ Add Question", type the question, options A to D, the correct answer and the marks.',
        'Click a download button: "📄 PDF (Question Paper)", "📄 PDF (With Answers)", "📝 Word Doc" or "📝 Word (With Answers)".',
      ],
      tip: 'Give students the paper without answers. Keep the "With Answers" file for the teacher.',
    },
    {
      title: 'Reset a password or delete a locker (Admin only)',
      body: [
        'Open the "⚙️ Admin" tab.',
        'To reset: click "🔑 Reset PW" on the locker, type a new password and confirm.',
        'To delete: click the 🗑 button and confirm. The materials inside are unlinked, not erased.',
      ],
    },
  ],
  tips: [
    'The green dot and 🔓 show which lockers are open right now.',
    'You can arrive here from another module with a subject already highlighted (🎯 badge on matching lockers).',
    'Passwords are stored in a scrambled form. Nobody can read an old password, so reset it if it is forgotten.',
  ],
  mistakes: [
    'Forgetting the password → ask Admin to use "🔑 Reset PW".',
    'Leaving a locker open on a shared computer → click "🔒 Lock" when you finish.',
    'No questions appear in Create Paper → add questions for that subject in the Question Bank first.',
    'Deleting a locker to remove one file → delete only the file with "🗑 Delete".',
  ],
  faq: [
    { q: 'Who can see the ⚙️ Admin tab?', a: 'Only Admin roles. Other staff see All Lockers and any locker they unlock.' },
    { q: 'How long does a locker stay open?', a: '30 minutes. After that you must type the password again.' },
    { q: 'Where do the paper questions come from?', a: 'From the Question Bank for the locker\'s subject, or from questions you type in yourself.' },
    { q: 'Can I get my materials back if the locker is deleted?', a: 'The materials are unlinked, not erased, but the locker is gone. Ask Admin before deleting.' },
  ],
  related: ['learninghub', 'teaching'],
}
