export default {
  id: 'awards',
  title: 'Awards',
  group: 'PEOPLE',
  roles: ['Admin', 'Teacher', 'Housemaster'],
  summary: 'Monthly awards for staff and houses. Every day a supervisor ticks yes or no for each nominee. At month end the winner is worked out from those ticks.',
  before: [
    'Housemasters must be entered as Active in the Housemasters list. They become the House Master and Doubt Session nominees.',
    'Staff must be Active with role "Teaching" or "Non-Teaching" in the staff list. They become the Faculty and Non-Teaching nominees.',
    'Houses must exist, because they become the Best House nominees.',
  ],
  tabs: [
    { name: "✅ Today's ticks", what: 'Daily checklist, one award category at a time.' },
    { name: '📋 Master table', what: 'The same daily checklist for all five categories in one long page.' },
    { name: '🏆 Leaderboard', what: 'Monthly ranking, publishing the winner, certificate and downloads.' },
    { name: '⚙ Settings', what: 'Attendance gate, Best House mark scale and leave records for nominees.' },
  ],
  steps: [
    {
      title: 'Tick the daily checklist',
      body: [
        'Open "✅ Today\'s ticks". Choose a category button: House Master, Doubt Session Staff, Non-Teaching Staff, Faculty or House.',
        'The date box "Editing:" shows today. Each nominee who is not yet saved shows a form.',
        'Mark Present or Absent for the nominee. This is compulsory, except for House Master where the roll call tick is used as attendance.',
        'Tick every point you saw that day. Leave a point unticked if it was not done.',
        'Press "Save". The nominee then folds into a short row with a green ✓.',
        'The text "x of y done" at the top shows how many are left.',
      ],
      tip: 'Do this every day. The ranking is the share of recorded days with a tick.',
    },
    {
      title: 'Fill a normal day quickly',
      body: [
        'On the daily checklist, press "Mark all N remaining as normal day".',
        'Confirm the message. Everyone not yet saved is saved as Present with every point ticked yes (and full marks for Best House).',
        'Press "Edit" on any nominee who had a problem, change the ticks and press "Save".',
      ],
      tip: 'Only use this if you really observed a normal day. Do the exceptions first, then use this for the rest.',
    },
    {
      title: 'Enter the Best House mark',
      body: [
        'Choose the "House" category button.',
        'For each house, type the day\'s inspection mark in "Mark (out of N)". It is compulsory.',
        'Mark Present or Absent, tick the checklist points, and press "Save".',
      ],
    },
    {
      title: 'Fix a past day',
      body: [
        'Change the date in the "Editing:" box to the earlier day. A red "Editing a past day" label appears.',
        'Correct the ticks and press "Save" for each nominee.',
        'Press "Back to today" when you are done.',
      ],
      tip: 'You cannot choose a future date.',
    },
    {
      title: 'Record leave for a nominee',
      body: [
        'Open "⚙ Settings" and go to "Leave management".',
        'Choose the category, then the Nominee.',
        'Set Start and End dates and an optional Reason, then press "Add leave".',
        'On those dates the nominee shows "ON LEAVE" in the daily list and is not asked for ticks. If all recorded days are covered by leave, the leaderboard shows "On leave" instead of a low-attendance warning.',
        'To undo, press "Remove" next to the leave record and confirm.',
      ],
    },
    {
      title: 'See the ranking and publish a winner',
      body: [
        'Open "🏆 Leaderboard" and choose the category and the month.',
        'Read the ranking. Each line shows score, days recorded, attendance percent, streak and change from last month.',
        'The first eligible nominee is marked "LEADING". The text "Publishes ..." shows the planned publish date (the 10th, or the 11th if the 10th is a Sunday).',
        'Press "Confirm & publish winner" to confirm the winner.',
        'After publishing, press "Download certificate" for the certificate.',
        'Use "⬇ Excel (CSV)" or "⬇ PDF" to download the ranking list.',
      ],
      tip: 'The red box "not ticked today" lists nominees you forgot to tick today.',
    },
    {
      title: 'Change the attendance gate or mark scale',
      body: [
        'Open "⚙ Settings" → "Scoring thresholds".',
        'Change "Attendance gate (%)" (0 to 100) or "Best House mark scale (out of)" (more than 0).',
        'Press "Save settings".',
      ],
      tip: 'New values are used the next time a screen loads.',
    },
  ],
  tips: [
    'Default rules: attendance gate is 90 percent. Best House mark scale is out of 6. Settings can change both.',
    'A nominee below the attendance gate is not ranked, even with perfect ticks.',
    'Score for a nominee = average of the percent of days each point was ticked yes. For Best House, the checklist score and the mark percent are averaged.',
    'A person who is a House Master is judged only in the House Master and Doubt Session categories, not in Faculty or Non-Teaching.',
  ],
  mistakes: [
    'Saving without Present/Absent → the form says "Attendance is compulsory". Mark one first.',
    'Saving Best House without a mark → enter the day\'s mark first.',
    'House Master: "Timely roll call completed today" and "House routine tasks completed today" are marked Mandatory → give an answer for both before saving. The roll call tick is also used as attendance.',
    'Forgetting to tick for some days → days with no record do not count at all, so the score may not show the whole month.',
    'Using "Mark all as normal day" before checking the exceptions → it does not change people already saved, but it will mark everyone else as perfect.',
  ],
  faq: [
    { q: 'Why is a nominee not ranked?', a: 'The reason is shown next to the name: "No attendance recorded this month", "Below N% attendance gate" or "On leave".' },
    { q: 'Can I publish a winner again?', a: 'After publishing, the page shows the winner with a certificate button instead. Only press "Confirm & publish winner" when the ranking is final.' },
    { q: 'Where do the Co-housemasters get set?', a: 'The Settings page says this is done directly in the database (award_house_co_masters table). It does not change individual scores.' },
  ],
  related: ['hostel', 'staff'],
}
