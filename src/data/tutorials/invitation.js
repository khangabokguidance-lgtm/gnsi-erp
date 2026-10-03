export default {
  id: 'invitation',
  title: 'Invitation',
  group: 'MANAGEMENT',
  roles: ['Admin'],
  summary: 'Design and print an event invitation. It makes two A5 cards on one A4 landscape page: Page 1 is the invitation and Page 2 is the programme.',
  before: [
    'Only Admin and Manager can use it. Other roles see "Admin / Manager Access Only". The Admin must also give permission to this module.',
    'Have the event details ready: title, date, venue, chief guests, and the programme items with times.',
  ],
  tabs: [
    { name: 'Page 1', what: 'Editor panel for the invitation card: institute name, address, opening line, event title, date, venue, anchor, guests and quote.' },
    { name: 'Page 2', what: 'Editor panel for the programme card: section title, date, start time, venue note and the list of programme items.' },
    { name: 'Fonts', what: 'Change the font size of each text and the font style.' },
    { name: 'Colors', what: 'Panel "Colors & Print": change card colours and turn on "Less Ink Mode".' },
  ],
  steps: [
    {
      title: 'Open the studio and the editor panels',
      body: [
        'Click "Invitation" in the sidebar.',
        'In the top bar, under "Editor", click "Page 1", "Page 2", "Fonts" or "Colors".',
        'The panel opens on top of the preview. Click the same button again to close it.',
        'The two cards show live in the preview as you type.',
      ],
      tip: 'You can open more than one panel at the same time.',
    },
    {
      title: 'Edit the invitation card (Page 1)',
      body: [
        'Open the "Page 1" panel.',
        'Change the institute "Name", "Address" and "Script" lines.',
        'Edit "Opening Line" and "Event Title".',
        'Fill the date: "Month", "Day", "Ord" and "Year".',
        'Fill "Venue" and its "Note".',
        'Fill the anchor "Name" and "Role".',
        'Click "+ Add Member" to add a guest with a name and a role. Click "✕" to remove one.',
        'Edit the "Quote" at the end if you want.',
      ],
    },
    {
      title: 'Edit the programme card (Page 2)',
      body: [
        'Open the "Page 2" panel.',
        'Fill "Section Title", "Date", "Start Time" and "Venue Note".',
        'Click "+ Add Item" to add a programme item with time, name and sub text. Click "✕" to remove one.',
        'Fill "Footer Left" and "Footer Right".',
      ],
    },
    {
      title: 'Change fonts and colours',
      body: [
        'Open the "Fonts" panel to change the size of the texts.',
        'Open the "Colors" panel to change "Background / Navy", "Primary Gold" and "Light Gold".',
        'Press "Reset Colors" to return to the original colours.',
        'Turn on "Less Ink Mode" to use white backgrounds and save toner.',
      ],
    },
    {
      title: 'Print the invitation',
      body: [
        'Check the spelling of both cards in the preview.',
        'Press "⎙ Print / PDF".',
        'A new window opens and the print dialog appears.',
        'Choose your printer, or choose "Save as PDF".',
      ],
      tip: 'The page size is A4 Landscape (297 × 210 mm) with two A5 cards. If the print window does not open, allow pop-ups for this site.',
    },
    {
      title: 'Save your work and reload it later',
      body: [
        'In the top bar, choose a slot: "Slot A", "Slot B" or "Slot C".',
        'Press "💾 Save".',
        'Later, choose the same slot and press "📂 Load".',
        'Press "⬇ Export" to download the cards as an HTML file.',
      ],
      tip: 'Saved slots are kept in this browser only. They will not show on another computer.',
    },
  ],
  tips: [
    'Use the Zoom slider in the top bar to make the preview bigger or smaller. "Reset" in that box returns to the normal size.',
    'Use the fullscreen button to see the cards bigger. Press Esc to leave fullscreen.',
    'The minimise button hides the top bar for a full preview. Click the thin gold line at the top to bring it back.',
  ],
  mistakes: [
    'Saving into the wrong slot → the old design in that slot is replaced. Use a different slot for each event.',
    'Changing the text but not checking the other card → check both Page 1 and Page 2 before printing.',
    'Expecting saved slots on another computer → they are saved in this browser only. Use "⬇ Export" to keep a file.',
  ],
  faq: [
    { q: 'Why do I see "Admin / Manager Access Only"?', a: 'Your role cannot use this module. Ask the Admin.' },
    { q: 'Does "Load" bring back my design after I close the browser?', a: 'Yes, if you saved it in a slot on the same browser and did not clear the browser data.' },
    { q: 'Can I print only one card?', a: 'No. The print puts both cards on one A4 landscape page.' },
  ],
  related: ['certificate', 'notice', 'social'],
}
