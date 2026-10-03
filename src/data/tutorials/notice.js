export default {
  id: 'notice',
  title: 'Notice',
  group: 'OPERATIONS',
  roles: ['Admin', 'Reception', 'Any staff'],
  summary: 'Write and manage circulars and announcements. A notice can be kept internal for staff, or shown on the public website.',
  before: [],
  tabs: [],
  steps: [
    {
      title: 'Add a new notice',
      body: [
        'Click the "➕ Add Notice" button at the top right.',
        'Optional: pick a ready-made text from the "— Use template —" list (Exam Schedule, Holiday Notice, Fee Reminder, Event Announcement, Urgent Circular, Admission Open, Result Announced). It fills the title, text, category, audience and priority for you.',
        'Fill the Title and the Description. Both are required.',
        'Choose the Category (General, Exam, Holiday, Fee, Event, Academic) and the Audience (All, Students, Parents, Staff, Teachers, Class Specific).',
        'If the audience is a single class, type it in "Class Target", for example "Class 10 A".',
        'Set the Publish Date, and an Expiry Date if the notice should stop after a day.',
        'Choose Priority (Normal, Important, Urgent) and Status (Published, Draft, Expired).',
        'Press "Save Notice".',
      ],
      tip: 'Use Status "Draft" while you are still writing. Change it to Published when it is ready.',
    },
    {
      title: 'Show a notice on the public website',
      body: [
        'In the form, tick "🌐 Show on public website (landing page)". The text below it tells you who can see the notice.',
        'Or, on an existing notice, click the 🌐 button. Click it again to remove the notice from the website.',
        'The green bar at the top shows how many notices are visible on guidancekhangabok.in right now.',
      ],
      tip: 'Only put public information here, such as admissions and results. Never put private fee or student details in a public notice.',
    },
    {
      title: 'Edit, pin or publish a notice',
      body: [
        'Find the notice in the list. Use the search box or the filters (Audience, Status, Category, Priority, Visibility, sort order).',
        'Click "✏️ Edit" to change it, then press "Update".',
        'Click 📌 to pin the notice. Pinned notices always stay at the top.',
        'In the table view (☰), click ⏸ to change a Published notice to Draft, or ▶ to publish a Draft.',
        'Click "👁 View" (or the notice title) to open the full notice and its attachment.',
      ],
    },
    {
      title: 'Copy an old notice',
      body: [
        'In the card view (⊞), click the ⧉ button on the notice.',
        'A new notice called "Copy of ..." is made as a Draft, with today as the publish date. It is not pinned and not public.',
        'Click "✏️ Edit" on the copy, change the text and set it to Published.',
      ],
    },
    {
      title: 'Delete a notice',
      body: [
        'Click the 🗑 button on the notice.',
        'Confirm the message "Delete this notice?".',
      ],
      tip: 'Deleting cannot be undone. If you only want to hide it, set it to Draft instead.',
    },
  ],
  tips: [
    'Notices with an Expiry Date earlier than today are changed to "Expired" automatically when the page opens.',
    'An amber bar warns you when notices will expire within 3 days.',
    'Urgent notices have a red edge and Important notices an orange edge on the card.',
    'Switch between cards (⊞) and table (☰) with the two buttons next to the search box.',
    'To attach a file, paste its web link in "Attachment URL". The module does not upload files.',
  ],
  mistakes: [
    'Saving a notice as Draft and expecting it to be live → set Status to Published.',
    'Ticking the public option for an internal notice → untick it, or click 🌐 to remove it from the website.',
    'Using "Class Specific" audience but leaving "Class Target" empty → type the class in Class Target.',
    'Deleting a notice that is only out of date → leave it. It becomes Expired by itself.',
  ],
  faq: [
    { q: 'Who sees a notice that is not public?', a: 'Only logged-in staff. The notice shows "No — internal only" in the preview.' },
    { q: 'Why did my notice change to Expired?', a: 'Its Expiry Date has passed. Edit it, set a new Expiry Date and set Status to Published.' },
    { q: 'Does this send an SMS or WhatsApp message?', a: 'No. Notice only publishes the circular. To send messages, use the Connect module.' },
  ],
  related: ['connect', 'social'],
}
