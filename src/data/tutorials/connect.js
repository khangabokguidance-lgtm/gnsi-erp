export default {
  id: 'connect',
  title: 'Connect',
  group: 'OPERATIONS',
  roles: ['Admin', 'Any staff'],
  summary: 'The communication hub. Admin writes broadcast messages to parents, students and staff, keeps message templates, and tracks replies, grievances and consent slips.',
  before: [],
  tabs: [
    { name: '✏️ Compose', what: 'Write and send a message or an emergency alert. Admin only.' },
    { name: '📡 Broadcasts', what: 'History of all messages sent or scheduled.' },
    { name: '📨 Inbox', what: 'Replies received. A number shows unread replies.' },
    { name: '🗂️ Grievances', what: 'Complaints raised as tickets. A number shows open ones.' },
    { name: '✅ Consent', what: 'Consent slips (for example for a trip) with the count of each answer.' },
    { name: '📅 Calendar', what: 'Month view of broadcasts by date.' },
    { name: '📊 Analytics', what: 'Counts of messages by channel for the last 7, 30 or 90 days.' },
    { name: '📝 Templates', what: 'Saved message texts that can be reused.' },
    { name: '⚙️ Settings', what: 'Do Not Disturb time and the daily quota. Admin only, and not shown to other staff.' },
  ],
  steps: [
    {
      title: 'Send a message (Admin only)',
      body: [
        'Open "✏️ Compose".',
        'Optional: type a Title. Choose the Audience (All, Parents, Students, Teachers, Staff, Fee Defaulters, Absent Today, Hostel Students).',
        'Choose the Channel (SMS, Email, WhatsApp, Portal), Priority (Urgent, Important, General) and Language (English, Hindi, Meitei).',
        'Type the Message. For SMS, a counter shows the characters and how many SMS it will use (160 characters per SMS).',
        'To send later, pick a "Schedule Date (optional)". The button then reads "🗓️ Schedule".',
        'Press "📤 Send Now" (or "🗓️ Schedule"), check the details in the box, then press "📤 Confirm Send".',
      ],
      tip: 'You can tap a saved template at the bottom of the page. It fills the message and the channel for you.',
    },
    {
      title: 'Send an emergency alert (Admin only)',
      body: [
        'In Compose, read the red "🚨 Emergency Alert" box. It sends to ALL, through ALL channels.',
        'Type the message.',
        'Press "🚨 Send Emergency". Priority is set to Urgent and Audience to All.',
        'Check the box and press "🚨 Confirm Emergency".',
      ],
      tip: 'Use this only for real emergencies, such as an accident or sudden closure.',
    },
    {
      title: 'Check what was sent',
      body: [
        'Open "📡 Broadcasts".',
        'Use the filters All, Sent, Scheduled, Urgent, Important.',
        'Click a row to read the full message.',
        'Admin can delete a row with "Delete" (or ✕) and confirm "Delete?".',
      ],
    },
    {
      title: 'Handle a grievance',
      body: [
        'Open "🗂️ Grievances". The "Open" filter is shown first.',
        'Read the ticket and who sent it.',
        'Admin: type an "Admin note…" and press "In Progress" while you work on it.',
        'When finished, press "✓ Resolve". The note is shown on the ticket.',
      ],
    },
    {
      title: 'Read replies in the Inbox',
      body: [
        'Open "📨 Inbox" and press "Unread" to see only new replies.',
        'Press "Mark Read" on a reply when you have read it.',
      ],
    },
    {
      title: 'Create a consent slip (Admin only)',
      body: [
        'Open "✅ Consent".',
        'In "➕ Create Consent Slip", fill the Title (required) and Description.',
        'Edit "Options (comma-separated)" if needed. The default is Yes,No,Maybe.',
        'Pick a Deadline and press "✅ Create".',
      ],
    },
    {
      title: 'Save a message template (Admin only)',
      body: [
        'Open "📝 Templates".',
        'In "➕ New Template", fill Name, Category, Channel, Language and Template Text.',
        'Press "💾 Save". Admin can remove a template with ✕.',
      ],
    },
  ],
  tips: [
    'Staff who are not Admin can read Broadcasts, Inbox, Grievances, Consent, Calendar, Analytics and Templates, but cannot send or change anything.',
    'The top of the page shows "Quota left", unread replies and open grievances. Click the last two to jump to that tab.',
    'If you press Send for the same audience, channel and start of message twice, you get a "Duplicate detected" warning. Press "Send Anyway" only if you really mean it.',
  ],
  mistakes: [
    'Sending a message before checking the Audience → read the confirm box carefully before pressing Confirm.',
    'Using Emergency for a normal notice → use the normal Send for non-urgent messages.',
    'Expecting Settings to be saved for later → see the question below.',
  ],
  faq: [
    { q: 'Why can I not see the Compose form?', a: 'Only Admin can send messages. Other staff see "Access Restricted".' },
    { q: 'Is there a message limit?', a: 'Yes. The screen shows "Quota" and each send uses one from it. When it is 0, you see "Daily quota exhausted."' },
    { q: 'Do the Do Not Disturb and quota settings stay saved?', a: 'The Save Settings button only shows a "Saved!" message on the screen. We could not confirm in the code that these values are stored, so do not rely on them.' },
  ],
  related: ['notice', 'social'],
}
