export default {
  id: 'cbt',
  title: 'CBT Exam',
  group: 'ACADEMIC',
  roles: ['Admin', 'Teacher'],
  summary: 'Run a computer based test like the SSC / TCS exam screen: question palette with colours, Mark for Review, countdown clock, English and Meitei Mayek, automatic submit and a score card. Build a test from your Word question papers.',
  before: [
    'Have the question paper as a Word file (.docx): English, and the Meitei Mayek version if you want both languages. Questions should start like "Q1." and have options (A) (B) (C) (D).',
    'Have the answer key ready. The papers do not carry it, so you type or paste it once.',
    'Use a computer with a modern browser. Tests built here are kept in that browser on that computer (use Export to move one). For candidates at home, publish the test online — see "Let candidates take the exam from anywhere".',
    'Online exams need a one-time database update: the administrator runs supabase/migrations/20261034_cbt_online_exam.sql and then 20261035_cbt_erp_lookup.sql (name / GCC detector) in Supabase → SQL editor.',
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
        'Figure questions (a picture that holds the problem and the options) take the picture that sits under their question number in the Word file, so a picture can never slip to the wrong question.',
        'Read the Smart check card (see "Check the questions before saving" below), fix anything it flags, then add the answer key: paste "1-A, 2-C, 3-B …" or the letters in order, press "Apply key", or click the answers in the grid. Then press "Save test".',
      ],
      tip: 'You can save without a key and add it later with ✏️ Edit / key. Candidates can still take the test, but scores appear only after the key is complete.',
    },
    {
      title: 'Check the questions before saving (Smart check)',
      body: [
        'After you press "Read the papers", the Smart check card shows how many questions are verified (green), need a look (amber) or have an error (red). Every question is a numbered square; click one to open it.',
        'It checks each question on its own: question text present, exactly 4 options, none empty, no two options alike, a figure question has its picture, and no question repeats another.',
        'It also compares each English question with its Meitei Mayek twin. Numbers do not change with language, so if a number differs (English 37800, Meitei Mayek 378010) the translation is probably shifted or mistyped. It also flags Meitei Mayek that is missing, not translated, still in Latin letters, or a passage that exists in only one language.',
        'If the two papers carry a different picture for the same question number, that is an error.',
        'Press "Review / fix" to see English and Meitei Mayek side by side. Edit the text or options, add, replace, remove or swap a picture with another question, or press "✔ Looks fine" to accept a warning (for example when a number is written in words).',
        'You can still save with errors, after a confirmation. Page footers such as "Page - 3" are removed automatically.',
      ],
      tip: 'Run it on every paper you upload. In the Navodaya paper it caught a repeated question, a mistyped number and a missing number in the Meitei Mayek version.',
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
      title: 'Let candidates take the exam from anywhere (online exam)',
      body: [
        'On the test card press "🌐 Online". Set an access code (a 6-digit code is made for you, or clear it for none) and, if you want, when the exam opens and closes. Press "Publish online".',
        'Copy the invitation (or press WhatsApp) and send the link and code to the candidates. The link looks like your-site/exam?t=… and works on any phone or computer; no login is needed.',
        'A candidate enters the access code, then types their GCC no. or the first letters of their name — the exam page finds them in the ERP student list and they tap "This is me" (the parent contact number is taken from the ERP unless they type another). They then read the instructions and begins. The clock is the server\'s and keeps running if they close the page. Answers are saved to the server as they go. If the page closes or the internet drops, opening the same link on the same device continues the exam.',
        'The server marks the attempt when it is submitted, or when the time ends. Each roll number gets one attempt; to let someone start again, delete their attempt under Results.',
        'Open the "🌐 Online" tab to see all online exams: copy the invitation, see how many attempts are submitted, Close or Reopen an exam, or remove it. A candidate who started before the closing time keeps their full time.',
        'Results for an online exam appear in the Results tab (marked 🌐 Online), from any office computer, even one that did not build the test. Use "⬇ To this computer" to copy an online test to the computer you are on.',
      ],
      tip: 'The answer key stays on the server and is never sent to candidates. "Show the score" and "Show the correct answers" (in the test settings) decide what a candidate sees after submitting.',
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
    { q: 'Where are the tests and results stored?', a: 'A test built here is kept in this browser (IndexedDB) and its in-office results stay on that computer. A test published online, and every online attempt, is on the server and shows on any office computer.' },
    { q: 'A candidate says the link says the exam is not valid.', a: 'The test must be published (Online button) and not removed. A closed or not-yet-open exam says so on the page.' },
    { q: 'A candidate cannot start: the roll number is already used.', a: 'One attempt per roll number. If it is the same person, they should open the link on the device they started on. To allow a fresh start, delete their attempt under Results.' },
    { q: 'Can candidates see the correct answers?', a: 'Only if "Show the correct answers in the review" is ticked when you make the test. Staff always see them under Results → View.' },
    { q: 'Why is a figure question showing only the picture?', a: 'The options are drawn inside the picture, so the screen shows the picture with radio buttons A to D.' },
  ],
  related: ['exams', 'learninghub'],
}
