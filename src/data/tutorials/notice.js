export default {
  id: 'notice',
  title: 'Notice',
  group: 'OPERATIONS',
  roles: ['Admin', 'Reception', 'Any staff'],
  summary: 'Write and manage circulars and announcements. A notice can be kept internal for staff, or shown on the public website.',
  before: [],
  tabs: [
    { name: '📋 Notice Board', what: 'The list of notices: add, edit, pin, publish and show on the website.' },
    { name: '✍️ Notice Maker', what: 'Build a formal notice on the institute letterhead and print it, save it as PDF or Word, share it, or post it to the Notice Board.' },
  ],
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
      title: 'Make a formal notice on the letterhead (Notice Maker)',
      body: [
        'Open Notice → "✍️ Notice Maker".',
        'In "Start from" choose a ready-made notice (Fee Collection Drive, General Circular, Holiday Notice, Staff Meeting) or "Blank notice". The preview on the right updates as you type.',
        'Fill the heading, Ref. No. (press "🔢 Number it" for the next number in that series), date, "To" and Subject. Tick "Mark as URGENT" for the red tag.',
        'Edit the body. Each block can be a numbered paragraph, a paragraph with (a) (b) points, step boxes, a schedule table or a highlighted box. Use ↑ ↓ to reorder and 🗑 to remove. Type **text** for bold and [[text]] for red bold.',
        'Set the closing line, who signs, the "Copy to" list, and tick "Add a tear-off acknowledgement slip" if staff must sign and return it.',
        'Press "🖨️ Print / Save as PDF" for paper or a PDF, "📄 Download Word" to edit it in Word, "📋 Copy text" or "📲 WhatsApp" to send the text.',
        'Press "💾 Save draft" to keep it on this computer and open it later from "Saved drafts".',
        'To put it on the Notice Board, choose Category, Audience, Status and an optional Expiry, then press "📌 Post to Notice Board". It is posted as internal, not public.',
      ],
      tip: 'The letterhead (name, tagline, address, registration line, logo link) can be changed under "Letterhead" in the editor. Drafts and templates are saved in this browser only.',
    },
    {
      title: 'Keep and reuse notices in the Notice Maker',
      body: [
        'Your work is saved automatically and reopens where you left off.',
        '"⭐ Save as my template" keeps the layout and wording (the reference number is cleared). It then appears under "My templates" in Start from.',
        '"💾 Save draft" keeps a named copy to finish later.',
        '"⬇️ Export file" downloads the notice as a file you can send to another computer; "⬆️ Open file" loads such a file.',
      ],
    },
    {
      title: 'Change many notices at once (bulk actions)',
      body: [
        'Tick the box on each notice (cards or table), or press "☑ Select all shown" to pick everything the filters show.',
        'A dark bar appears with how many are selected. Press Publish, Draft, Pin, Unpin, "⏳ Extend expiry +7d", "🔒 Make internal" or "🗑 Delete".',
        'Extend expiry adds 7 days to each notice\'s expiry (or 7 days from today if it has none or has passed) and brings an Expired notice back to Published.',
        'Press Clear to deselect without changing anything.',
      ],
      tip: 'Delete and "Make internal" ask you to confirm first. Deleting cannot be undone.',
    },
    {
      title: 'Print, share or export notices from the board',
      body: [
        'Press 🖨 on a notice to print it on the institute letterhead (or save it as PDF). The title becomes the subject and the description becomes numbered paragraphs.',
        'Press 📲 to open WhatsApp with the notice text ready to send.',
        'Press "📊 Export CSV" to download the notices the filters show, for a meeting or record.',
        'A notice that is Published but has a future Publish Date shows "⏳ Scheduled for …" on its card.',
      ],
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
