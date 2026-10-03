export default {
  id: 'studentfeeledger',
  title: 'Student Fee Ledger',
  group: 'FINANCE',
  roles: ['Admin', 'Accountant', 'Reception'],
  summary: 'A read-only record of every fee a student has paid, with month-wise dues, receipts and day books. Use it to check a student\'s account, reprint a receipt, or send a dues notice. You cannot change any payment here.',
  before: [
    'Fees must have been collected in the Fees module. Payments show here automatically.',
    'Fee Setup must have the correct fee amounts, so dues and "Short" months are right.',
  ],
  tabs: [
    { name: '📒 Student ledger', what: 'Search one student and see their full fee record, receipts, month-wise register and statement.' },
    { name: '📅 Fee Day Book', what: 'All fee receipts for a day, week or month, with cash, UPI and other totals. Print it.' },
    { name: '🗓 Monthly Fee Ledger', what: 'One register for all students showing who has paid and who has dues. Print it.' },
    { name: '💸 Expenditure Day Book', what: 'Expense day book from Accounts. Shown only to users who can open Accounts.' },
    { name: '⚖️ Income & Expenditure', what: 'Income and expenditure register from Accounts. Shown only to users who can open Accounts.' },
  ],
  steps: [
    {
      title: 'Look up one student\'s fee record',
      body: [
        'Open Student Fee Ledger. The "📒 Student ledger" tab opens first.',
        'Type in the search box: name, GCC No. or Adm. No.',
        'Click the student from the list.',
        'Read the cards: Admission & Kit, Flat Fees, Course Fees and Grand Total.',
        'Use "📒 Register book" for the month-wise view or "🗂 By fee type" for lists by fee type.',
      ],
      tip: 'To clear the student and search another, use the clear button on the student card.',
    },
    {
      title: 'Check month-wise dues and the statement',
      body: [
        'Open a student in "📒 Register book".',
        'Choose the session at the top ("Session ...").',
        'Press "📅 Month-wise" to see each month: Paid, Advance, Short, Due or Upcoming.',
        'Press "🧾 Statement", choose From and To dates, to see the statement of account.',
        'Press "📊 Insights" to see collection %, on-time payments and the next fee.',
      ],
    },
    {
      title: 'Reprint a receipt',
      body: [
        'Open the student.',
        'Find the payment in the list or in the "Day book" part of the register.',
        'Click the receipt number (or the print button on the row).',
        'A receipt opens. Print it.',
      ],
      tip: 'The day book can be searched by receipt, month, mode or amount. Choose "This session" or "All time".',
    },
    {
      title: 'Print or send a dues notice',
      body: [
        'Open the student in "📒 Register book".',
        'Press "📄 Dues notice" to print a dues notice.',
        'Or press "📋 Copy reminder" to copy the reminder text and paste it into a message.',
        'If the "📲 WhatsApp reminder" button is shown, press it to send to the parent phone number on file.',
      ],
      tip: 'If the student has no parent phone on file, the WhatsApp button will not work. Add the phone number in Students.',
    },
    {
      title: 'Print a day book for the fee desk',
      body: [
        'Open the "📅 Fee Day Book" tab.',
        'Pick Today, Yesterday, This week, This month or Last month. Or set From and To dates.',
        'Use Mode or Search to narrow the list.',
        'Press "🖨️ Print day book".',
      ],
    },
    {
      title: 'See who has dues this month',
      body: [
        'Open the "🗓 Monthly Fee Ledger" tab.',
        'In "Show" choose "With dues" or "Fully paid".',
        'In "Sort" choose "Highest due" to see the biggest dues first.',
        'Use "Students" to include inactive students if needed.',
        'Press "🖨️ Print register" to print.',
      ],
    },
    {
      title: 'Print every ledger or export to Excel',
      body: [
        'For all students, press "🖨️ Print all ledgers" next to the search box.',
        'For one student, open the student and press "⬇️ Excel" or "🖨️ Print register".',
      ],
    },
  ],
  tips: [
    '"🔗 Copy ledger link" copies a link to this student\'s ledger that you can share with other staff.',
    'This module only shows data. To fix a wrong payment, use the Fees module.',
    'Check the hostel type note on the register if the fee looks different from the usual amount.',
  ],
  mistakes: [
    'Looking for a button to add or edit a payment → Not possible here. Use Fees.',
    'Student not found → Try the GCC No. or Adm. No. instead of the name, and check the spelling.',
    'Wrong session shown → Press the correct "Session ..." button at the top of the register.',
  ],
  faq: [
    { q: 'Why do I not see the Expenditure Day Book tab?', a: 'It is shown only to staff who can open the Accounts module.' },
    { q: 'What do Paid, Advance, Short and Due mean?', a: 'Paid: month fully paid. Advance: paid ahead of time. Short: paid but less than the fee. Due: not paid yet. Upcoming: month not yet started.' },
    { q: 'Can I delete a payment here?', a: 'No. This screen is read-only.' },
  ],
  related: ['fees', 'feesetup', 'accounts', 'students'],
}
