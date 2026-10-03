export default {
  id: 'admissionsessions',
  title: 'Admission Sessions',
  group: 'CORE',
  roles: ['Admin'],
  summary: 'Create academic year sessions, set total seats, activate one session and lock it. Each card shows how many admissions the session has and how full it is. Admin only.',
  before: [
    'Only Admin can open this page. Other users see "Access Denied".',
    'This page is not in the sidebar list.',
  ],
  tabs: [],
  steps: [
    {
      title: 'Create a new session',
      body: [
        'Click "➕ New Session" at the top right.',
        'Type the Session Name, for example 2025-26. It is required.',
        'The Label fills in automatically as "Academic Year 2025-26". You can change it.',
        'Pick the Start Date and End Date (optional).',
        'Type Total Seats, for example 100 (optional).',
        'Click "Create Session".',
      ],
      tip: 'If the same Session Name already exists, you get a message and nothing is saved.',
    },
    {
      title: 'Activate a session',
      body: [
        'Find the session card. Only sessions that are not Active and not Locked show the button.',
        'Click "▶ Activate".',
        'Confirm. The current active session is switched off.',
        'The green banner "Currently Active Session" shows your session and its admission count.',
      ],
    },
    {
      title: 'Lock a session',
      body: [
        'On the active session card, click "🔒 Lock Session".',
        'Confirm. No new admissions will be accepted.',
        'The card shows a "🔒 Locked" badge.',
      ],
    },
    {
      title: 'Unlock a session',
      body: [
        'On a locked card, click "🔓 Unlock".',
        'Confirm. New admissions are allowed again.',
      ],
      tip: 'A locked session does not show the Activate button. Unlock it first.',
    },
    {
      title: 'Edit a session',
      body: [
        'Click "✏️ Edit" on the card.',
        'Change the name, label, dates or seats in the form.',
        'Click "Update Session".',
      ],
    },
    {
      title: 'Delete an empty session',
      body: [
        'The "🗑 Delete" button shows only for a session that is not Active and has 0 admissions.',
        'Click it and confirm. This cannot be undone.',
      ],
    },
  ],
  tips: [
    'When Total Seats is set, the card shows "Seat utilisation" with a bar and the seats remaining. The bar is green, then amber from 70%, then red from 90%.',
    'The three boxes show Total Sessions, Total Admissions and the Active Session.',
    'The Session Name is used on all admission records, so choose it carefully.',
  ],
  mistakes: [
    'Looking for Delete on a session that has admissions → it is hidden by design. Lock or deactivate it instead.',
    'Leaving Total Seats empty and expecting a seat bar → type the seats number to see it.',
    'Creating the same session twice → check the list first. Duplicates are refused.',
  ],
  faq: [
    { q: 'Can several sessions be active?', a: 'No. Activating one session turns the others off.' },
    { q: 'Where are the seat numbers counted from?', a: 'The card counts admission records whose session matches the Session Name.' },
    { q: 'What does Lock do?', a: 'It stops new admissions for that session.' },
  ],
  related: ['sessions', 'admissions', 'students'],
}
