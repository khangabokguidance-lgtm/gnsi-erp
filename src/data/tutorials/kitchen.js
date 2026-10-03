export default {
  id: 'kitchen',
  title: 'Kitchen',
  group: 'PEOPLE',
  roles: ['Kitchen', 'Admin'],
  summary: 'The Kitchen Ledger. Record each meal cooked (cost, items, how many students ate, bill photo), watch the monthly budget, and track cook attendance. Admin can lock days, set the budget and review the data.',
  before: [
    'Know the meal, the date and the total amount spent. Keep the bill photo ready if you want to attach it.',
    'Admin can add the common food items first under "Items", so staff can pick them from a list.',
  ],
  tabs: [
    { name: 'Ledger', what: 'Entries for the chosen month, grouped by day. Filter by date or meal. Shows meal totals, cost per student and missing-meal alerts.' },
    { name: 'Analytics', what: 'Charts: monthly spend, meal split, calendar heat map, vendor summary and most used items. Click a day on the calendar to open it in the Ledger.' },
  ],
  steps: [
    {
      title: 'Add a meal entry',
      body: [
        'Open Kitchen. Check the month in the top right (change it if needed).',
        'Press "Add entry".',
        'Choose the Meal: Morning Lunch, Afternoon Breakfast, Evening Breakfast or Dinner.',
        'Check the Date and type the Amount (₹). Date and Amount are required.',
        'Optional: Serving Time, Items / Ingredients (pick from "🍛 Manipuri Dishes" or "🧺 Item List", or type a custom item and press Enter).',
        'Optional: Prepared By, Vendor / Supplier, Students Served, Meal Quality and Notes.',
        'Optional: attach the bill under "📎 Receipt / Bill Photo".',
        'Save the entry. "Entry saved" shows.',
      ],
      tip: 'Fill "Students Served" every time. It is used to work out the cost per student.',
    },
    {
      title: 'Find or fix an entry',
      body: [
        'Stay on the "Ledger" tab.',
        'Use the date box or the meal list to filter the entries.',
        'Press "Edit" on the entry, change it and save.',
      ],
      tip: 'If a day is locked ("🔒 Locked"), its entries cannot be edited. Ask the Admin to unlock it.',
    },
    {
      title: 'Check missing meals and cost per student',
      body: [
        'On the Ledger tab, look at the alert for missing meals. It has a button to log the meal.',
        'Read the cost per student card and the meal totals below it.',
        'Press "Report", "CSV" or "WhatsApp" at the top to print, download or share the month\'s data.',
      ],
    },
    {
      title: 'Mark cook attendance (Admin)',
      body: [
        'Press "Cook attendance" at the top. This panel is for Admin.',
        'In "📋 Mark", set each cook\'s status for the Morning (6:30 to 9:00 AM) and Evening (6:00 to 9:00 PM) shift. Check the in and out times.',
        'Add Notes if needed and save. "Attendance saved" shows.',
        'Open "📊 Monthly" to see the month\'s attendance.',
      ],
    },
    {
      title: 'Set the monthly budget (Admin)',
      body: [
        'Press "Budget" at the top.',
        'Type the Budget Amount (₹).',
        'Save. "Budget updated" shows.',
        'The budget bar then shows spent against budget for the month.',
      ],
    },
    {
      title: 'Lock a finished day (Admin)',
      body: [
        'On the Ledger tab, find the day.',
        'Press the lock button on that day and confirm.',
        'The day shows 🔒 Locked and its entries cannot be edited or deleted.',
        'To change something later, press unlock first.',
      ],
    },
    {
      title: 'Manage items and other Admin tools',
      body: [
        '"Items": the kitchen item list. Add or edit items in the master list, or search the list.',
        '"Monitor": the Admin Monitor panel to review kitchen entries.',
        '"Cook log": Log Cook Activity with the cook name, meal, arrived and left time, then press "Save Log".',
      ],
    },
  ],
  tips: [
    'Enter the meal on the same day while you remember the details.',
    'Attach a photo of the bill for every purchase so the Admin can check it.',
    'Use the same vendor names each time so the Analytics vendor summary is correct.',
    'The Admin tools (Items, Monitor, Cook log, Cook attendance) appear only for Admin and Superintendent.',
  ],
  mistakes: [
    'Wrong amount or date → Edit the entry (if the day is not locked).',
    'Trying to delete an entry → Only Admin and Superintendent can delete. Ask them.',
    'Forgetting the students served → The cost per student will be wrong. Edit the entry and add the number.',
    'Trying to edit a locked day → Ask Admin to unlock the day.',
  ],
  faq: [
    { q: 'Who can delete an entry or lock a day?', a: 'Only Admin (and Superintendent). Other staff see no delete or lock buttons.' },
    { q: 'What are the four meals?', a: 'Morning Lunch, Afternoon Breakfast, Evening Breakfast and Dinner.' },
    { q: 'How do I see another month?', a: 'Use the month box in the top right of the screen.' },
  ],
  related: ['store', 'accounts', 'attendance'],
}
