export default {
  id: 'timetable',
  title: 'Timetable',
  group: 'ACADEMIC',
  roles: ['Admin', 'Teacher', 'Any staff'],
  summary: 'The weekly Monday to Saturday class timetable for every batch, with a log for one-day substitute teachers and printable reports.',
  before: [
    'An Admin must load the timetable first (Setup tab). If it is empty you will see "No timetable loaded yet".',
    'Staff names must exist in the Staff module so they appear in the teacher lists.',
  ],
  tabs: [
    { name: 'Timetable', what: 'The weekly grid. Choose "All Batches" or one batch to see periods, subjects and teachers for Monday to Saturday.' },
    { name: 'Substitute Entry', what: 'Record that another teacher takes a class on one particular date.' },
    { name: 'Reports', what: 'Make a print-ready Batch Timetable, Master Timetable or Substitute Log.' },
    { name: 'Setup', what: 'Admin only. Load the standard Monday to Saturday schedule.' },
  ],
  steps: [
    {
      title: 'See the timetable of a batch',
      body: [
        'Open Timetable. The "Timetable" tab opens first.',
        'Click "All Batches" to see every batch, or click one batch name to see only that batch.',
        'Read across a row for the period and down a column for the day.',
        'Break rows are shown as dark bars. If a substitute is recorded for today, the old teacher is crossed out and the new teacher is shown with an arrow.',
      ],
      tip: 'Substitute names show on the grid only for today. They do not change the weekly timetable.',
    },
    {
      title: 'Record a substitute teacher',
      body: [
        'Click the "Substitute Entry" tab.',
        'Pick the "Date". The day name is shown under it.',
        'Choose the "Batch".',
        'Choose the "Period". Only periods that the batch has on that day are listed. If you see "No classes on ...", pick another date or batch.',
        '"Original Teacher" fills in by itself (grey box).',
        'Choose the "Substitute Teacher" from the list.',
        'Optional: type a "Reason" (for example leave or official duty).',
        'Click "+ Record Substitute". A "Substitute recorded" message appears.',
      ],
      tip: 'Date, Batch, Period and Substitute Teacher are required.',
    },
    {
      title: 'Check or remove a substitute',
      body: [
        'In "Substitute Entry", set the date. The table "Substitutes for ..." shows records for that date.',
        'Only Admin sees the 🗑 button. Click it to remove a record. It is removed at once.',
      ],
    },
    {
      title: 'Print a timetable or substitute report',
      body: [
        'Open the "Reports" tab.',
        'Pick one: "Batch Timetable", "Master Timetable" or "Substitute Log".',
        'For Batch Timetable choose the Batch. For Substitute Log choose the "From" and "To" dates.',
        'Click "🖨 Generate & Print Report". A new window opens with the school letterhead.',
        'In the print window choose a printer, or choose "Save as PDF".',
      ],
      tip: 'Allow pop-ups in your browser if the print window does not open.',
    },
    {
      title: 'Change one slot (Admin only)',
      body: [
        'In the "Timetable" tab, click the slot (subject box) you want to change. Only Admin can click slots.',
        'Change "Subject", "Teacher" or "Room".',
        'Click "Save". Or click "Cancel" to close without changes.',
        'To remove the slot click the 🗑 button and confirm "Delete this slot?".',
      ],
      tip: 'This changes the weekly timetable for every week, not just one day. For a one-day change use Substitute Entry.',
    },
    {
      title: 'Load the standard schedule (Admin only)',
      body: [
        'Click the "Setup" tab.',
        'Read the warning. This clears the full weekly grid and reloads it.',
        'Click "Load Standard Mon–Sat Schedule" and confirm.',
        'Wait for the "Loaded ... slots" message.',
      ],
      tip: 'All your manual slot edits are lost when you do this. Substitute records are not affected.',
    },
  ],
  tips: [
    'Use a Substitute Entry for one-day changes. Edit the slot only for permanent changes.',
    'Teachers can open the Timetable tab to check their own periods.',
    'Use the Master Timetable report to put one full page on the notice board.',
  ],
  mistakes: [
    'Editing a slot to cover one absent teacher → use Substitute Entry so the weekly timetable stays correct.',
    'Pressing "Load Standard Mon–Sat Schedule" to fix one slot → this replaces the whole grid. Edit the single slot instead.',
    'Choosing a Sunday or a day with no classes for a substitute → the Period list will be empty. Pick the correct date.',
  ],
  faq: [
    { q: 'Why can I not click on a slot?', a: 'Only Admin can edit slots. Ask an Admin.' },
    { q: 'Why is the Setup tab missing?', a: 'It is shown to Admin only.' },
    { q: 'Does a substitute change next week?', a: 'No. A substitute is for the chosen date only.' },
  ],
  related: ['courses', 'teaching', 'staff', 'attendance'],
}
