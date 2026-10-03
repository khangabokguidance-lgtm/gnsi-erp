export default {
  id: 'social',
  title: 'Social',
  group: 'OPERATIONS',
  roles: ['Admin', 'Reception'],
  summary: 'Plan social media posts and ad campaigns, and follow up on admission enquiries (leads) that come from Facebook, Instagram, WhatsApp, walk-ins and other sources.',
  before: [],
  tabs: [
    { name: 'Daily', what: 'Your daily work screen: follow-ups that are due, posts for today, a score summary and alerts.' },
    { name: 'Campaigns', what: 'List of ad or promotion campaigns with platform, budget and status.' },
    { name: 'Leads', what: 'Everyone who has shown interest in admission, with phone, source, follow-up date and status.' },
    { name: 'Posts', what: 'The plan of social media posts, with date, platform, type and status.' },
  ],
  steps: [
    {
      title: 'Do your daily follow-up calls',
      body: [
        'Open the "🌅 Daily" tab. A red number on the tab shows how many follow-ups are overdue or due today.',
        'Stay on "📞 Follow-ups". Work through "Overdue" first, then "Due today", then "Upcoming".',
        'Tap the 📞 button to call the parent, or the 💬 button to open WhatsApp.',
        'At the bottom, in "⚡ Quick note on lead", choose the lead, choose the new status, type what was said and press "Log note".',
      ],
      tip: 'The note is added to the lead with the date and time, and the status is changed at the same time.',
    },
    {
      title: 'Log a walk-in visitor',
      body: [
        'In Daily → Follow-ups, press "👤 Log a walk-in".',
        'Fill Student Name (required), Phone, Class interest, and Source.',
        'Press "⚡ Save walk-in".',
        'The lead is saved with status New, and the follow-up date is set to today.',
      ],
    },
    {
      title: 'Add a lead manually',
      body: [
        'Open the "Leads" tab and press "+ Add".',
        'Fill Student Name (required), Parent Name, Phone, Class Interest, Source and Follow Up Date.',
        'Choose the Status: New, Contacted, Follow Up, Converted or Closed.',
        'Press "Save Lead".',
      ],
      tip: 'Set a Follow Up Date. Leads with no date never show up in the Daily follow-up list.',
    },
    {
      title: 'Add a campaign',
      body: [
        'Open the "Campaigns" tab and press "+ Add".',
        'Fill Campaign Name (required), Platform, Budget, Start Date and End Date.',
        'Choose the Status: Active, Paused or Completed.',
        'Press "Save Campaign".',
        'An Active campaign that ends within 3 days is shown as a warning on the Daily tab.',
      ],
    },
    {
      title: 'Plan a post and mark it as posted',
      body: [
        'Open the "Posts" tab and press "+ Add".',
        'Fill Title (required), Platform, Content Type (Admission, Result, Event, Topper, Announcement) and Post Date.',
        'Choose the Status: Planned, Posted or Cancelled, then press "Save Post".',
        'On the day, open Daily → "📢 Posts". Press the circle ○ next to the post once it is published. It turns into a tick ✓. Press again to undo.',
      ],
    },
    {
      title: 'Delete a record',
      body: [
        'Open Campaigns, Leads or Posts.',
        'Press "Delete" (or ✕ on a phone) on the row.',
        'Confirm the "Delete?" message.',
      ],
      tip: 'Deleting cannot be undone. For a lead you no longer need, set the status to Closed with a note instead.',
    },
  ],
  tips: [
    'Use the search box in each tab to find a name, phone number or platform.',
    'The "📊 Score" tab shows how many leads are in each status. The "🔔 Alerts" tab lists everything that needs action today.',
    'Leads that are Converted or Closed are not shown in follow-ups.',
  ],
  mistakes: [
    'Leaving the Follow Up Date empty → add a date so the lead appears in Daily.',
    'Changing a lead status but forgetting the note → use "Log note" so the history is saved.',
    'Marking a post as Posted before it is really published → press the ✓ again to put it back to Planned.',
  ],
  faq: [
    { q: 'Can I edit a lead after saving it?', a: 'Not in the Leads list. Use "Log note" in the Daily tab to add a note and change the status. To correct other details, delete the lead and add it again.' },
    { q: 'Does Social post to Facebook or Instagram for me?', a: 'No. It is only a planner and tracker. You post on the platform yourself.' },
    { q: 'What do the red and yellow follow-up labels mean?', a: 'Red "Overdue" means the follow-up date has passed. Yellow "Due today" means it is today.' },
  ],
  related: ['reception', 'notice', 'connect'],
}
