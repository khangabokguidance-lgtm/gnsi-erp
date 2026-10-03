export default {
  id: 'construction',
  title: 'Construction & Maintenance',
  group: 'FINANCE',
  roles: ['Admin', 'Accountant'],
  summary: 'Track campus building projects and repair work: budget, payments to contractors, milestones, photos, issues, site diary and regular upkeep tasks. It is kept separate from the main Accounts ledger.',
  before: [
    'Know the project name, budget and contractor before you create a project.',
    'Keep contractor bills or payment slips ready. You can attach a photo or file to each payment.',
    'If the Maintenance tab or some fields (Location, Retention) are missing, the extra database setup has not been done. Ask the Admin or developer.',
  ],
  tabs: [
    { name: '📊 Dashboard', what: 'Overview: monthly cash flow, projects by status, payments due in the next 30 days, category spend, top contractors, recent activity and alerts such as over budget.' },
    { name: '🏗️ Projects', what: 'All projects as Cards, Board or Table, with search and filters. Click a project to open it.' },
    { name: '🗓️ Timeline', what: 'A bar chart of planned start to target date for each project, with milestones marked.' },
    { name: '🔧 Maintenance', what: 'Regular upkeep tasks (like water tank cleaning) that repeat after a number of days. A number on the tab shows tasks that are due.' },
    { name: '👷 Contractors', what: 'List of contractors with their projects. Add or edit contractor details.' },
  ],
  steps: [
    {
      title: 'Create a new project',
      body: [
        'Press "+ New project" at the top.',
        'Choose the category: Construction or Maintenance.',
        'Type the Project name. It is required.',
        'Choose Status (Planned, Ongoing, Completed, On Hold or Cancelled) and Priority (Low, Medium, High or Critical).',
        'Type the Budget (₹), Contractor / vendor, Contractor phone, Start date and Target end date.',
        'Add a Description or Notes if needed.',
        'Press "✓ Create project".',
      ],
    },
    {
      title: 'Record a payment to a contractor',
      body: [
        'Open the project and go to the "Payments" tab.',
        'Press "+ Record payment".',
        'Type the Amount (₹). It is required. Check the Date.',
        'Choose the Mode (Cash, Bank, UPI or Card). For non-cash, type the Txn ref (UTR or cheque number).',
        'Fill Paid by and Received by (contractor side).',
        'Attach a Receipt / photo and add Notes if you have them.',
        'Press "✓ Save payment".',
        'Press the 🧾 button on a payment to print the payment voucher.',
      ],
      tip: 'If the total paid goes above the budget, a warning shows how much the project is over budget.',
    },
    {
      title: 'Update progress and status',
      body: [
        'Open the project. In the "Overview" tab, move the progress slider.',
        'To change the status, press one of the status buttons (Planned, Ongoing, Completed, On Hold, Cancelled).',
        'Press "✏️ Edit" to change budget, dates, contractor or notes, then "✓ Save changes".',
      ],
    },
    {
      title: 'Add milestones',
      body: [
        'Open the project and go to the "Milestones" tab.',
        'Press "+ Add milestone".',
        'Type the Milestone name, for example "Foundation complete", and fill the other fields.',
        'Save it.',
        'When the milestone payment is made, press the round tick button on that row to mark it paid.',
      ],
    },
    {
      title: 'Add photos, issues and site diary entries',
      body: [
        'Photos tab: choose the Stage (Before, During or After), add a Caption if you want, and upload the photo.',
        'Issues tab: press "+ Report issue", type the Issue, Priority, Assigned to and Fix by, and save.',
        'Site diary tab: press "+ Today\'s site entry", fill Date, Weather, Workers on site and "Work done today" (required), then save.',
      ],
      tip: 'Take a Before photo at the start and an After photo at the end. It makes the project report better.',
    },
    {
      title: 'Plan regular maintenance',
      body: [
        'Open the "🔧 Maintenance" tab and press "+ Schedule task".',
        'Pick a ready-made task (for example Water tank, Generator, CCTV) or type your own Asset and Task.',
        'Set "Repeat every (days)" and save.',
        'When the work is done, press "✓ Mark done" on the task.',
        'Use "Pause" to stop a task for a while and "Resume" to start it again.',
      ],
    },
    {
      title: 'Print a report or export',
      body: [
        'For all projects, press "📄 Portfolio PDF" at the top.',
        'In the Projects tab, press "⬇ Excel/CSV" to download the list.',
        'For one project, open it and press "📄 PDF report".',
      ],
    },
  ],
  tips: [
    'Use the Dashboard alerts every week: over budget, heading over budget and payments due.',
    'The "⧉ Duplicate" button on a project copies it, useful for similar jobs.',
    'In Projects you can switch between Cards, Board and Table. The Board lets you drag a card to change its status.',
    'Record every payment on the same day, so the balance is correct.',
  ],
  mistakes: [
    'Deleting a project to fix a mistake → Deleting removes the project and all its payments, milestones, photos and issues. It cannot be undone. Edit the project instead.',
    'Forgetting the contractor payment in this module → Payments here are kept separate from the main Accounts ledger. Record them here so the project balance is right.',
    'Leaving the status as Ongoing after the work ends → Open the project and set it to Completed.',
  ],
  faq: [
    { q: 'Do payments here appear in Accounts?', a: 'No. This module says it is kept separate from the main accounts ledger.' },
    { q: 'Can I delete a wrong payment?', a: 'Yes. In the Payments tab press the ✕ button on that payment and confirm. This cannot be undone.' },
    { q: 'What is retention?', a: 'Retention % is an amount held back from the contractor until the work is complete. It appears only if the extra setup is done. When the project is Completed you can record the retention payment from the Overview tab.' },
  ],
  related: ['accounts', 'store', 'dashboard'],
}
