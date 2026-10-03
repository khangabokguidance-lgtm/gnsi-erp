export default {
  id: 'certificate',
  title: 'Certificates',
  group: 'MANAGEMENT',
  roles: ['Admin', 'Reception'],
  summary: 'Make and print batch achievement certificates for students (Navodaya and Sainik groups). You pick a student, check the details, and print or save as PDF.',
  before: [
    'You need permission for this module. Admin and Manager can always open it. Other staff need "read" permission, or they see "Access Denied".',
    'Have the correct student names, school names and addresses ready.',
  ],
  tabs: [
    { name: '⊙ Student', what: 'Choose a Batch List, pick a student from the list, and edit name, salutation, batch, group, selected school and address.' },
    { name: '✎ Certificate', what: 'Edit the Exam / Programme, Award Line and Year / Session text.' },
    { name: '✒ Signatures', what: 'Change the name and title of the two signatories.' },
    { name: 'Aa Typography', what: 'Change the font and size of the institution name, student name and body text.' },
    { name: '⊞ Logos', what: 'Upload left, centre and right logos, and set the logo size and shape.' },
    { name: '◈ Templates', what: 'Pick a ready-made look: Classic Gold, Royal Navy, Emerald, Crimson, Midnight or Antique.' },
    { name: '🎨 Design', what: 'Change colours, background, border and spacing of the certificate.' },
    { name: '⚙ Advanced', what: 'Extra CSS, the Element Inspector, scale and filters, and the Print / Save PDF, Save as PNG and Copy HTML options.' },
  ],
  steps: [
    {
      title: 'Open the generator',
      body: [
        'Click "Certificates" in the sidebar under MANAGEMENT.',
        'Wait for "Loading Certificate Generator…" to finish.',
        'The editor opens on the left side. Press the ✦ button to open or close it.',
      ],
      tip: 'If the page does not load, press "↺ Reload" at the top right.',
    },
    {
      title: 'Make a certificate for one student',
      body: [
        'Open the "⊙ Student" tab.',
        'In "Batch List", choose the right list (for example "JNV – 9th Batch (2026-27)").',
        'Click the student in the list.',
        'Check "Full Name", "Salutation", "Batch", "Group / Stream", "Selected School / JNV" and "Address".',
        'Press "✎ Apply Changes" to see the changes on the certificate.',
      ],
    },
    {
      title: 'Change the wording of the certificate',
      body: [
        'Open the "✎ Certificate" tab.',
        'Edit "Exam / Programme", "Award Line" and "Year / Session".',
        'Press "✎ Apply Changes".',
      ],
    },
    {
      title: 'Change the signatures',
      body: [
        'Open the "✒ Signatures" tab.',
        'Edit the "Name" and "Title" for signature 1 and signature 2.',
        'Press "✎ Apply Changes".',
      ],
    },
    {
      title: 'Change the look',
      body: [
        'Open the "◈ Templates" tab and click a template card.',
        'To fine-tune, open the "🎨 Design" tab and change the colours or border.',
        'Press "↺ Live Preview" to see it. Press "↺ Reset" to go back.',
      ],
    },
    {
      title: 'Print or save',
      body: [
        'Check the certificate on screen first.',
        'Press "⎙ Print / PDF" and choose a printer or "Save as PDF".',
        'Use the "◀" and "▶" buttons to go to the previous or next student.',
        'For a picture file, open the "⚙ Advanced" tab and press "⬇ Save as PNG".',
      ],
      tip: 'In the Advanced tab, "Print Scale" has "100% — A4", "85% — Fit A4" and "75% — Compact" if the page does not fit.',
    },
    {
      title: 'Edit many students at once',
      body: [
        'Press "⊞ Bulk Edit" in the Student tab.',
        'Use the tabs "Students", "Common Fields", "Find & Replace" or "CSV Import".',
      ],
    },
  ],
  tips: [
    'Always scroll through the certificate and check each spelling before printing.',
    'Use "⛶ Fullscreen" at the top to see a bigger preview.',
    'Always press "✎ Apply Changes" after typing, or the certificate will not update.',
  ],
  mistakes: [
    'Printing before checking the name spelling → check the name, school and address on screen first.',
    'Forgetting to press "✎ Apply Changes" → press it after every edit.',
    'Choosing the wrong Batch List → the student names come from that list, so pick the right one first.',
  ],
  faq: [
    { q: 'I see "Access Denied". What do I do?', a: 'You do not have permission for this module. Ask the Admin to give you access.' },
    { q: 'The page shows "Could not load certificate.html".', a: 'Press "↺ Reload". If it still fails, tell the Admin or the IT person.' },
    { q: 'Can I add a school logo?', a: 'Yes. Open the "⊞ Logos" tab and press "↑ Upload" for the left, centre or right logo. Press "✕" to remove it.' },
  ],
  related: ['students', 'awards', 'invitation'],
}
