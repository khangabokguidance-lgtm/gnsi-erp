export default {
  id: 'system',
  title: 'System',
  group: 'MANAGEMENT',
  roles: ['Admin'],
  summary: 'The settings page for the whole ERP: school details, login rules, colours and logo, alerts, academic settings, data tools and integrations. Only Admin can use it.',
  before: [
    'Only Admin, Administrator and Co-Admin can open it. Others see "Access restricted".',
    'Be careful. Changes here are saved for the whole school.',
  ],
  tabs: [
    { name: '🏫 Basic Info', what: 'School name, address, phone, email, principal, year established, academic session, institute type and affiliation.' },
    { name: '🔒 Security', what: 'Idle logout, maximum login attempts, lockout time, and the password reminder box.' },
    { name: '🎨 Appearance', what: 'Colour presets, Primary / Sidebar / Accent colours, font family, portal title, logo and favicon.' },
    { name: '🔔 Notifications', what: 'SMS, WhatsApp and Email (SMTP) settings and alert on/off switches.' },
    { name: '📚 Academic Config', what: 'Academic year, fee due day, attendance threshold, and the lists of Classes / Batches and Courses / Streams.' },
    { name: '🗄️ Data Mgmt', what: 'Database Health Check, Import Students from CSV, and Clear Module Data for logs.' },
    { name: '🔗 Integrations', what: 'Razorpay, Google Workspace, Portal API Key and Supabase Project URL.' },
  ],
  steps: [
    {
      title: 'Update the school details',
      body: [
        'Open "System" and stay on "🏫 Basic Info".',
        'Edit "School / Institute Name", "Address", "Phone", "Email", "Principal Name" and "Year Established".',
        'In "Academic & System Info", set "Academic Session" (for example 2025-2026), "Institute Type" and "Affiliation / Board".',
        'Press "Save Changes". It shows "✓ Saved!" when done.',
      ],
      tip: 'These details are used in fee receipts, reports and other printed documents, so keep them correct.',
    },
    {
      title: 'Set login rules',
      body: [
        'Open the "🔒 Security" tab.',
        'Set "Idle Logout (minutes — blank or 0 = off)".',
        'Set "Max Login Attempts" and "Lockout Duration (minutes)".',
        'Press "Save Changes".',
      ],
      tip: 'The toggles "Force Password Change" and "Two-Factor Required" are saved, but the page says they are not enforced yet.',
    },
    {
      title: 'Change colours, font, logo and title',
      body: [
        'Open the "🎨 Appearance" tab.',
        'Click a colour preset, or pick your own Primary, Sidebar and Accent colours.',
        'Choose a font in "Font Family".',
        'Under "Branding", fill "Portal Title", "Logo URL" and "Favicon URL". The URL must start with https://.',
        'Press "Save Changes".',
      ],
    },
    {
      title: 'Set academic settings',
      body: [
        'Open the "📚 Academic Config" tab.',
        'Fill "Year Start", "Year End", "Fee Due Day (of month)" and "Attendance Threshold (%)".',
        'Press "Save Changes".',
        'To change the lists, type a name in "Add class…" or "Add course…" and press "Add". Remove one with the cross on its tag.',
      ],
      tip: 'The Classes / Batches list is only a reference. Real classes and fees come from Courses and Fee Setup.',
    },
    {
      title: 'Check the database',
      body: [
        'Open the "🗄️ Data Mgmt" tab.',
        'Press "Run Health Check".',
        'Wait. Each table shows a green "rows" count, or a red error.',
      ],
    },
    {
      title: 'Import students from a CSV file',
      body: [
        'Open the "🗄️ Data Mgmt" tab.',
        'Press "📂 Choose CSV File" and select your .csv file.',
        'Wait for the result message. It tells how many students were imported and how many duplicates were skipped.',
      ],
      tip: 'Students with an admission number that already exists are skipped. New students are saved with status Active.',
    },
    {
      title: 'Clear old logs (irreversible)',
      body: [
        'Open the "🗄️ Data Mgmt" tab and go to "🗑️ Clear Module Data".',
        'Press "Clear" next to Audit Logs, Fraud Events or Backup Logs.',
        'Type the exact table name in the box that opens.',
        'Press "Clear table". All rows in that table are deleted for ever.',
      ],
    },
    {
      title: 'Set up Razorpay or Google',
      body: [
        'Open the "🔗 Integrations" tab.',
        'Turn the switch on for Razorpay or Google Workspace.',
        'Fill the keys (they are hidden by default).',
        'Press "Save Changes".',
      ],
      tip: 'Turning Razorpay off hides "Pay via Razorpay" in Fees.',
    },
  ],
  tips: [
    'If you changed something, the "Save Changes" button must be pressed. Nothing is saved before that.',
    'If you switch tabs with unsaved changes, the page asks "Switch anyway and discard them?".',
    'The browser also warns you if you close the page with unsaved changes.',
  ],
  mistakes: [
    'Leaving a tab without saving → your changes are lost. Press "Save Changes" first.',
    'Expecting "Change Password" here to work → it does not change your real password. Use the Admin page or Supabase Auth instead.',
    'Pressing "Test SMS" and expecting a message → the test does not send a real SMS yet.',
    'Clearing logs by mistake → clearing is permanent. Read the table name before you type it.',
  ],
  faq: [
    { q: 'Are the Active Sessions real?', a: 'No. The list is marked "(demo data)" on the page.' },
    { q: 'Do SMS and Email send messages now?', a: 'Not yet. The page says saving the details does not send anything. A server function is needed first.' },
    { q: 'Can I clear Students or Fees here?', a: 'No. Only Audit Logs, Fraud Events and Backup Logs can be cleared.' },
    { q: 'Are API keys safe here?', a: 'They are stored as plain text in the settings table. The page warns you about this. Show a key only when needed.' },
  ],
  related: ['admin', 'adminlink', 'feesetup'],
}
