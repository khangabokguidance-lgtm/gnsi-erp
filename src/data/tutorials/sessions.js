export default {
  id: 'sessions',
  title: 'Admission Sessions',
  group: 'CORE',
  roles: ['Admin'],
  summary: 'Create and manage academic year sessions such as "2025-26". Choose which session is Active, so new admissions are tagged to it, and Lock a session to stop new applications. Admin only.',
  before: [
    'Only Admin can open this page. Other users see "Access Denied".',
    'This page does not appear in the sidebar list. Admin opens it through the app when needed.',
  ],
  tabs: [],
  steps: [
    {
      title: 'Create a new session',
      body: [
        'Click the "+ New Session" button at the top right.',
        'Type the Session Name, for example 2025-26. This field is required.',
        'Optionally pick the Start Date and End Date. If the Session Name is empty, picking a Start Date fills in a name for you.',
        'Optionally add Notes / Description.',
        'Click "Create Session".',
      ],
      tip: 'A new session always starts as Inactive. If the name already exists, you get a message "already exists".',
    },
    {
      title: 'Make a session Active',
      body: [
        'Find the session card.',
        'Click "✅ Activate".',
        'Read the question and click OK. The previous active session is switched off.',
        'The green banner at the top now shows the new active session.',
      ],
      tip: 'Only one session can be Active at a time. Activating also removes any lock on that session.',
    },
    {
      title: 'Lock a session so no new applications can be made',
      body: [
        'Find the active session. You can use "🔒 Lock Session" in the banner or "🔒 Lock" on the card.',
        'Read the warning and confirm.',
        'The badge changes to "Active · Locked". New applications are blocked in Admissions.',
        'Existing records can still be edited.',
      ],
    },
    {
      title: 'Unlock a session',
      body: [
        'Click "🔓 Unlock Session" in the banner, or "🔓 Unlock" on the card.',
        'The session opens for new applications again. There is no extra question.',
      ],
    },
    {
      title: 'Deactivate a session',
      body: [
        'Click "Deactivate" on the active session card.',
        'Confirm the message.',
        'Now no session is active. A yellow "No active session" warning appears and Admissions will not auto-assign a session.',
        'Activate another session to continue admissions.',
      ],
    },
    {
      title: 'Edit a session',
      body: [
        'Click "Edit" on the session card.',
        'Change the name, dates or notes.',
        'Click "Update Session".',
      ],
    },
    {
      title: 'Delete a session',
      body: [
        'Click "Del" on the session card. It is greyed out for the active session.',
        'Read the warning. If the session has admission records, the records are NOT deleted, but they are no longer linked to a managed session.',
        'Confirm. This cannot be undone.',
      ],
      tip: 'Deactivate a session first if you want to delete it.',
    },
  ],
  tips: [
    'The top boxes show Total Sessions, the Active Session, Locked Sessions and Total Admissions across all sessions.',
    'Each card shows how many applications that session has.',
    'To keep an old year safe, deactivate it. Its admission records stay.',
    'Use one naming style for all sessions (for example always 2025-26) so they look the same everywhere.',
  ],
  mistakes: [
    'Deleting a session that has applications → deactivate or lock it instead.',
    'Forgetting to activate the new year → create the session, then click "✅ Activate".',
    'Locking the active session by mistake and wondering why new applications fail → click "🔓 Unlock Session".',
  ],
  faq: [
    { q: 'Can two sessions be active together?', a: 'No. Activating one session turns off the other.' },
    { q: 'What does Lock do?', a: 'It stops new admission applications for that session. Existing records can still be edited.' },
    { q: 'Why can I not delete the active session?', a: 'The Del button is disabled for the active session. Deactivate it first.' },
    { q: 'What is the difference from the Admission Sessions page with seat numbers?', a: 'This page has Notes and no seat count. The other page (Admission Sessions) has Label and Total Seats. Both work on the same list of sessions.' },
  ],
  related: ['admissionsessions', 'admissions', 'students'],
}
