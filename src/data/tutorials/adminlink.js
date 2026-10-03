export default {
  id: 'adminlink',
  title: 'Link Staff',
  group: 'MANAGEMENT',
  roles: ['Admin'],
  summary: 'Connect each staff member to a login account, so they can sign in to the ERP. Only Admin can open this page.',
  before: [
    'The staff member must already exist in the Staff list.',
    'Only Admin can see this module. Other users see "Access Denied".',
  ],
  tabs: [
    { name: '⚠️ Unlinked Staff', what: 'Staff who do not have a login yet. Each one has a drop-down to link a login.' },
    { name: '✅ Linked Staff', what: 'Staff who already have a login. Each one has an "Unlink" button.' },
  ],
  steps: [
    {
      title: 'Check who needs a login',
      body: [
        'Click "Link Staff" in the sidebar.',
        'Look at the top numbers: Staff, Linked and Unlinked.',
        'Find the staff member under "⚠️ Unlinked Staff".',
      ],
      tip: 'Press "🔄 Refresh" to reload the list. The page also updates by itself when staff change ("Live sync on").',
    },
    {
      title: 'Create a new login',
      body: [
        'Press "➕ Create User".',
        'Fill "Name *", "Email *" and "Password *". "Phone" is optional.',
        'Press "✅ Create User".',
        'The new login now appears in the drop-down list.',
      ],
      tip: 'Give a temporary password and ask the staff member to keep it safe.',
    },
    {
      title: 'Link a staff member to a login',
      body: [
        'Find the staff member under "⚠️ Unlinked Staff".',
        'Open the drop-down "— Select Auth User to Link —".',
        'Choose the correct login (the email is shown).',
        'You will see "✅ Linked!" and the person moves to "✅ Linked Staff".',
      ],
    },
    {
      title: 'Create logins for all unlinked staff',
      body: [
        'Press "⚡ Create All (number)". The number is how many staff are unlinked.',
        'Read the question that asks to confirm, then confirm.',
        'Wait. The button shows "⏳ Creating…".',
        'In "⚡ Bulk Results", copy each Email and Temp Password.',
      ],
      tip: 'If a staff member has no email, an email like name+id@gnsi.edu is made for them.',
    },
    {
      title: 'Unlink a staff member',
      body: [
        'Find the person under "✅ Linked Staff".',
        'Press "Unlink".',
        'Confirm "Unlink this staff member?".',
      ],
    },
  ],
  tips: [
    'Link the staff member to the right login. Check the name and email before choosing.',
    'A green "UPDATED" tag shows on a row that just changed.',
  ],
  mistakes: [
    'Closing the Bulk Results without copying passwords → the passwords are shown only once. Copy them first.',
    'Linking a staff member to someone else\'s login → check the email in the drop-down carefully.',
    'Pressing "⚡ Create All" without checking → it creates logins for every unlinked staff member.',
  ],
  faq: [
    { q: 'Why does a staff member not appear in the drop-down?', a: 'The login must exist first. Press "➕ Create User", or press "🔄 Refresh".' },
    { q: 'What happens if I unlink someone?', a: 'The staff record stays, but it is no longer connected to that login. You can link again later.' },
    { q: 'Where do I see the passwords after Create All?', a: 'Only in "⚡ Bulk Results" right after it finishes. They are not shown again.' },
  ],
  related: ['admin', 'staff'],
}
