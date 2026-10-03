export default {
  id: 'bulkadmission',
  title: 'Bulk Admission',
  group: 'CORE',
  roles: ['Admin', 'Accountant', 'Reception'],
  summary: 'Collect admission fee, dress fee and prospectus fee for many enrolled students in one go, and print all the receipts together. It lists enrolled students whose admission fee has not been collected yet.',
  before: [
    'The student must already be Enrolled in Admissions.',
    'Only students with no admission fee collected (or whose admission fee was reverted) appear in the list.',
    'If the Accounts month for your payment date is closed, collections dated in that month are blocked. Ask Admin.',
  ],
  tabs: [],
  steps: [
    {
      title: 'Set the payment details for the whole batch',
      body: [
        'Open Bulk Admission. Wait for "Loading enrolled students…" to finish.',
        'In "Global payment settings", choose the Payment Mode.',
        'Check the Payment Date. It starts as today.',
        'Check "Collected By". It starts with your name. It is required.',
        'If the mode is not Cash, type the "Txn Ref / Cheque No.". It is required for every non-cash mode.',
      ],
      tip: 'These four settings apply to all selected students.',
    },
    {
      title: 'Find and select students',
      body: [
        'Type in the search box ("Search name, GCC, class…") to find students.',
        'Use the course dropdown to show only one course.',
        'Click a student row to tick it. You can also click "☑ Select all" to tick everyone shown, and "☐ None" to clear.',
        'The top right shows how many are selected and the total in rupees.',
      ],
    },
    {
      title: 'Choose the fee items and amounts',
      body: [
        'On each student row there are three items: Admission Fee, Dress Fee and Prospectus Fee.',
        'Admission Fee is ticked by default. Tick Dress Fee or Prospectus Fee if the student is paying them.',
        'Change the amount in the small box if needed. Defaults are 6000 for Admission Fee, 3000 for Dress Fee and 200 for Prospectus Fee.',
        'To set the same amount for all selected students, type it in "Apply fee amount to all selected students" and click outside the box.',
      ],
      tip: 'Select the students first, then use the "→ all selected" amount boxes.',
    },
    {
      title: 'Save and generate receipts',
      body: [
        'Check the bottom bar. It shows "students" and the total amount.',
        'Click "💾 Record & Generate Receipts".',
        'Read the question and click OK.',
        'Wait while the progress bar runs (for example 5 / 20).',
        'When it finishes, a "Receipts ready" window opens.',
      ],
      tip: 'Click "Cancel" in the bottom bar to clear your selection before saving.',
    },
    {
      title: 'Print the receipts',
      body: [
        'In the "Receipts ready" window, check the list of students and amounts.',
        'Click "🖨️ Print all receipts".',
        'In the print window, print or save as PDF. Each student gets one A4 receipt.',
        'Click "Close" when done.',
      ],
    },
    {
      title: 'Check for problems after saving',
      body: [
        'Look for an orange message at the top of the page.',
        'A line with "failed" lists students whose save did not work, with the reason.',
        'A line with "Already collected, skipped" lists items that were already paid. They are not charged twice.',
        'The list refreshes. Students who were saved leave the list.',
      ],
    },
  ],
  tips: [
    'The page header shows how many students are pending admission fee and how many were processed in this visit.',
    'Receipts use the same design as all other fee receipts, and the payments appear in Fees and Accounts.',
    'Do a small batch first if you are unsure.',
  ],
  mistakes: [
    'Saving without "Collected By" → type the staff name first. The page will not save without it.',
    'Choosing UPI, Bank Transfer or Cheque and leaving the reference empty → type the transaction or cheque number.',
    'Leaving all three items unticked for a student → that student is skipped and gets no receipt.',
    'Closing the receipt window before printing → the fees are already saved. Ask Admin how to reprint a receipt from the Fees module.',
  ],
  faq: [
    { q: 'Why is a student missing from the list?', a: 'Only Enrolled students without an active admission fee payment are listed. If the student is not Enrolled, finish enrollment in Admissions. If the fee was already paid, the student is not shown.' },
    { q: 'What if I collected a fee by mistake?', a: 'Do not collect again. Revert the payment in Fees. The student then comes back into this list.' },
    { q: 'Can I collect only the dress fee?', a: 'Yes. Untick Admission Fee and tick Dress Fee for that student. The admission fee stays pending.' },
    { q: 'Does it update Accounts?', a: 'Yes. Each payment is recorded the same way as in Fees, so it appears in Accounts.' },
  ],
  related: ['admissions', 'fees', 'accounts', 'students'],
}
