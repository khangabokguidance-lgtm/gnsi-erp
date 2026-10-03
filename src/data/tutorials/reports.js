export default {
  id: 'reports',
  title: 'Reports',
  group: 'MANAGEMENT',
  roles: ['Admin', 'Accountant', 'Reception'],
  summary: 'Make a list report from almost any part of the ERP (students, fees, staff, hostel and more). You can filter it, see charts, and download it as PDF, Excel, CSV or Word, or print it.',
  before: [
    'You need permission to open the Reports module. Ask the Admin if you cannot see it in the sidebar.',
    'The data must already be entered in the other modules. A report only shows what is already saved.',
  ],
  tabs: [
    { name: '⚡ Quick Presets', what: 'Ready-made reports (for example Fee Defaulters, Active Students, Boarders) and your own saved reports.' },
    { name: '📂 Report Source & Filters', what: 'Choose the data source, then set Search, Status, Date From, Date To, Group By and the Columns.' },
    { name: '📋 Table', what: 'Shows the report rows page by page. Click it after pressing Generate Report.' },
    { name: '📊 Charts', what: 'Shows the same report as charts (Status Distribution, and Records by the Group By column).' },
    { name: 'Letterhead', what: 'Top button. Opens "🏫 Institute Header" to set the institute name, address, phone, logo and watermark used in downloads.' },
    { name: 'History', what: 'Top button. Opens "📋 Report History" showing the reports you made on this device.' },
  ],
  steps: [
    {
      title: 'Make a report from a ready-made preset',
      body: [
        'Open "Reports" from the sidebar.',
        'Under "⚡ Quick Presets", click a preset such as "⚠️ Fee Defaulters" or "🏠 Boarders".',
        'Click "🔄 Generate Report".',
        'The rows appear in the "📋 Table" view.',
      ],
      tip: 'Clicking a preset only sets the filters. You must still press "🔄 Generate Report".',
    },
    {
      title: 'Make your own report',
      body: [
        'Under "📂 Report Source & Filters", click a source button (for example "🎓 Students" or "💰 Fees"). The sources are grouped as Students & Admissions, Finance, Academic & Staff, and Hostel & Admin.',
        'Type in "Search" to find any word in the rows.',
        'If shown, choose "Status", "Date From" and "Date To".',
        'If shown, choose "Group By" to group rows (for example by department).',
        'Tick or untick the Columns you want. Drag a column chip to change the order.',
        'Click "🔄 Generate Report".',
      ],
    },
    {
      title: 'Download or print the report',
      body: [
        'Generate the report first.',
        'Click one of the buttons: "📄 PDF", "📊 Excel", "📁 CSV", "📝 Word" or "🖨️ Print".',
        'Open the downloaded file from your browser downloads.',
      ],
      tip: 'Click a column heading in the table to sort by that column.',
    },
    {
      title: 'Set the school header for PDF and print',
      body: [
        'Click "Letterhead" at the top.',
        'Fill "Institute Name", "Address" and "Phone".',
        'Use "Upload Logo" to add a logo. Click "Remove" to take it out.',
        'Choose a "Watermark": None, CONFIDENTIAL, DRAFT or INTERNAL.',
      ],
    },
    {
      title: 'Save a report setup to use again',
      body: [
        'Set your source and filters the way you want.',
        'Click "+ Save Preset".',
        'Type a name in "Preset name…" and click "Save".',
        'Your preset appears in Quick Presets. Click the "✕" next to it to delete it.',
      ],
      tip: 'Saved presets are kept in this browser only.',
    },
    {
      title: 'See the past reports',
      body: [
        'Click "History" at the top.',
        'See the last reports you made (up to 50).',
        'Click "Clear All" to empty the list.',
      ],
    },
  ],
  tips: [
    'Use "▲ Collapse" to hide the filters and see more of the table.',
    'The top boxes show Total Records, Positive, Pending / Other and, for some sources, a rupee total.',
    'Use the page buttons at the table bottom when there are many rows.',
  ],
  mistakes: [
    'Changing filters and expecting the table to change → press "🔄 Generate Report" again.',
    'Downloading before generating → the table is empty. Generate first.',
    'Expecting your saved presets on another computer → presets, history and the letterhead are saved on this device only.',
  ],
  faq: [
    { q: 'Why is my report empty?', a: 'Check the Status, dates and Search box. Remove filters and press "🔄 Generate Report" again.' },
    { q: 'Can I choose which columns go in the file?', a: 'Yes. Tick only the Columns you need before pressing Generate Report.' },
    { q: 'Does it show more than 1000 rows?', a: 'Yes. The report reads all rows of the source, not only the first 1000.' },
  ],
  related: ['students', 'fees', 'accounts', 'dashboard'],
}
