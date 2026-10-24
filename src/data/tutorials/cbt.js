export default {
  id: 'cbt',
  title: 'CBT Exam',
  group: 'ACADEMIC',
  roles: ['Admin', 'Teacher'],
  summary: 'Run a computer based test like the SSC / TCS exam screen: question palette with colours, Mark for Review, countdown clock, English and Meitei Mayek, automatic submit and a score card. Build a test from your Word question papers.',
  before: [
    'Have the question paper as a Word file (.docx): English, and the Meitei Mayek version if you want both languages. Questions should start like "Q1." and have options (A) (B) (C) (D).',
    'Have the answer key ready. The papers do not carry it, so you type or paste it once.',
    'Use a computer with a modern browser. Tests and results are kept in that browser on that computer; use Export to move a test to another computer.',
  ],
  tabs: [
    { name: '📝 Tests', what: 'Your tests. Build a new one, start it for a candidate, edit the key, export or delete.' },
    { name: '📊 Results', what: 'Every attempt on a test with rank, marks, section-wise score and how many times the candidate left the screen. Export to CSV.' },
  ],
  steps: [
    {
      title: 'Make a test from Word papers',
      body: [
        'Open CBT Exam → Tests → "➕ New test from Word papers".',
        'Fill the test name, duration in minutes and the marks. Navodaya has no negative marking (leave the wrong-answer marks at 0); for an SSC-style test use 0.25 or 0.5.',
        'Choose the English paper. Add the Meitei Mayek paper if you have it (BMEI04 text is converted automatically). Press "Read the papers".',
        'Check "What was found": number of questions, sections, figure questions and passages. Read any yellow warnings, for example a question with three options or a number that is missing.',
        'Figure questions (a picture that holds the problem and the options) take the pictures from the English paper in order.',
        'Add the answer key: paste "1-A, 2-C, 3-B …" or the letters in order, press "Apply key", or click the answers in the grid. Then press "Save test".',
      ],
      tip: 'You can save without a key and add it later with ✏️ Edit / key. Candidates can still take the test, but scores appear only after the key is complete.',
    },
    {
      title: 'Run the exam for a candidate',
      body: [
        'On the test card press "▶ Start exam". Enter the candidate\'s name and roll number, then press Start.',
        'The test opens full screen. The candidate reads the instructions, ticks the declaration and presses "I am ready to begin". The clock starts then.',
        'On the exam screen: choose an option; "Save & Next" saves and moves on; "Mark for Review & Next" flags it; "Clear Response" removes the answer. Click a number in the palette to jump. Use the section names at the top to change section, and the language box (top right) to switch between English and Meitei Mayek.',
        'Palette colours: green = answered, red = not answered, grey = not visited, purple = marked for review, purple with a tick = answered and marked.',
        'Press "Submit Test" to see the summary table, then confirm. When the time ends the test is submitted automatically.',
      ],
      tip: 'If the page is refreshed or the computer restarts, press Start exam again and choose "Resume" under the candidate\'s name. The clock does not stop while they are away.',
    },
    {
      title: 'See results',
      body: [
        'Open CBT Exam → Results and choose the test.',
        'The table lists each attempt with rank, marks, correct, wrong and how many times the candidate left the exam screen.',
        'Press View to see the score card, section-wise marks and every question with the candidate\'s answer and the correct one. Press "Export CSV" for a spreadsheet.',
      ],
    },
    {
      title: 'Move a test to another computer',
      body: [
        'On the test card press "📤 Export". A file ending in .cbt.json is downloaded (figure pictures included).',
        'On the other computer open CBT Exam and press "⬆️ Import test file".',
      ],
      tip: 'Results are kept on the computer where the exam was taken. Export the CSV before clearing the browser\'s data.',
    },
  ],
  tips: [
    'Candidates choose A–D with the keyboard too (A B C D or 1 2 3 4); the arrow keys move between questions.',
    'The exam screen blocks right-click and copy, and records every time the candidate leaves the screen. This discourages cheating; it is not a locked-down exam browser.',
    'Give the computer to the candidate before pressing Start, because the screen goes full screen at once.',
  ],
  mistakes: [
    'Starting a test with no answer key and expecting a score → add the key first (✏️ Edit / key), then open the result again.',
    'Choosing a .doc file → open it in Word and Save As .docx first.',
    'Clearing browser data between the exam and the export → the results are lost; export the CSV first.',
  ],
  faq: [
    { q: 'Where are the tests and results stored?', a: 'In the browser on the computer used (IndexedDB). They are not on the server, so other computers do not see them until you Export and Import.' },
    { q: 'Can candidates see the correct answers?', a: 'Only if "Show the correct answers in the review" is ticked when you make the test. Staff always see them under Results → View.' },
    { q: 'Why is a figure question showing only the picture?', a: 'The options are drawn inside the picture, so the screen shows the picture with radio buttons A to D.' },
  ],
  related: ['exams', 'learninghub'],
}
