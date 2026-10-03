export default {
  id: 'feesetup',
  title: 'Fee Setup',
  group: 'FINANCE',
  roles: ['Admin'],
  summary: 'Where the Admin sets how much each course, batch and hostel type pays. It also lets the Admin give one student a special monthly flat fee. Other staff cannot open this module.',
  before: [
    'Only Admin can open Fee Setup. Other roles see "Access Denied".',
    'Decide the amounts for the session first: Flat Fee, Course Fee and Admission Fee for every batch and hostel type.',
  ],
  tabs: [
    { name: '📋 Fee Structures', what: 'Enter Flat Fee per month, Course Fee per month and Admission Fee for each course, batch and hostel type, for one session.' },
    { name: '✏️ Student Overrides', what: 'Give one student a different monthly flat fee for a session, with a reason.' },
  ],
  steps: [
    {
      title: 'Set the fees for a session',
      body: [
        'Open Fee Setup. The "📋 Fee Structures" tab opens.',
        'Under "Session:" press the session you want, for example 2026-2027.',
        'Press a course tab: Sainik, Navodaya, Foundation or Combined Course.',
        'For each batch and hostel type (Boarder, Day Boarder, Day Scholar), type the Flat Fee /mo, Course Fee /mo and Admission Fee.',
        'Changed rows show "EDITED".',
        'Press "💾 Save ... change(s)" at the top. When it shows "✓ Saved", it is done.',
      ],
      tip: 'Flat fee is the monthly hostel/facility fee. Course fee is the monthly tuition fee. Changes apply to the chosen session only.',
    },
    {
      title: 'Copy last session\'s fees to a new session',
      body: [
        'Choose the new session under "Session:".',
        'Press "📋 Copy from prev session".',
        'Read the message. It lists any combinations that had nothing to copy. Fill those by hand.',
        'Change any amounts that are different this year.',
        'Press "💾 Save ... change(s)". The copy is not saved until you press this.',
      ],
    },
    {
      title: 'Fix the "not configured" warning',
      body: [
        'If you see "⚠️ ... not configured" at the top, some combinations have no saved fee.',
        'Students in these groups are billed from the old built-in amounts. The ₹0 values on screen are only placeholders.',
        'Press the course button shown in the warning to jump to that course.',
        'Enter the real amounts and press Save.',
      ],
      tip: 'Rows that say "N students on old rates" have active students waiting for a saved fee.',
    },
    {
      title: 'Give one student a special flat fee',
      body: [
        'Open the "✏️ Student Overrides" tab.',
        'Choose the session at the top.',
        'Type the student name or GCC number and press "🔍 Search". Only active students are found.',
        'Click the student in the list.',
        'You will see the normal flat fee. Type the "New Flat Fee Override (₹/month)".',
        'Type a Reason, for example scholarship (optional).',
        'Press "✅ Set Override".',
      ],
      tip: 'The amount must be 0 or more. An override changes only the monthly flat fee for that session.',
    },
    {
      title: 'Change or remove an override',
      body: [
        'Under "Active Overrides", press "↻ Refresh" to see the current list for the session.',
        'Open the student from the list.',
        'To change it, type the new amount and press "✏️ Update Override".',
        'To remove it, press "🗑 Remove" and confirm. The student goes back to the standard rate.',
      ],
    },
  ],
  tips: [
    'Check the session shown under "Session:" before you type any amount.',
    'If a save fails, your edits stay on the screen. Check you are signed in as Admin and try again.',
    'Fee changes affect new dues. Check the Student Fee Ledger after a big change.',
  ],
  mistakes: [
    'Editing the wrong session → Always check the Session button first.',
    'Pressing "Copy from prev session" and leaving → It does not save. Press Save.',
    'Leaving ₹0 in unset rows → Those students are billed on old amounts. Enter the real fee.',
    'Using an override for the whole batch → Overrides are for one student only. Change the Fee Structure instead.',
  ],
  faq: [
    { q: 'Why can I not open Fee Setup?', a: 'It is for Admin only.' },
    { q: 'What is the default Admission Fee shown on a new row?', a: 'A new row starts with 6000 as a placeholder. It is not saved until you press Save, so enter the real amount.' },
    { q: 'Can I give a discount on course fee for one student?', a: 'The override screen changes only the monthly flat fee.' },
  ],
  related: ['fees', 'studentfeeledger', 'students', 'accounts'],
}
