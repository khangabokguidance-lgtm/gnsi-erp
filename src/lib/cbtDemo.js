// cbtDemo.js — a short practice test candidates can try on the exam link before the real exam, so the screen, palette,
// "mark for review", the clock and the calculator are no surprise. It runs entirely in the browser: nothing is sent or saved.
const o = (...t) => ['A', 'B', 'C', 'D'].map((k, i) => ({ key: k, text: String(t[i]), textMm: '' }))
const q = (no, text, opts, answer) => ({ no, figure: false, text, textMm: '', options: o(...opts), passage: '', passageMm: '', image: null, images: [], answer })

export const DEMO_TEST = {
  id: 'demo-practice', name: 'Practice test (not counted)', durationMin: 4,
  marking: { correct: 1, wrong: 0, tools: { calc: true, rough: true } },
  instructions: `This is a PRACTICE test. Nothing you do here is recorded or marked for the real exam.
Try these on the screen:
1. Choose an option, then press “Save & Next”.
2. Press “Mark for Review & Next” to flag a question you want to revisit.
3. Use the question palette on the right (☰ Palette on a phone) to jump to any question.
4. Use A− / A+ for text size, ◐ for high contrast, 🖩 for the calculator and ✎ for rough work.
5. Press “Submit Test” when you are done to see how the result screen looks.`,
  showResult: true, showAnswers: true,
  sections: [{
    id: 'demo-s1', label: 'A', title: 'Practice questions', titleMm: '',
    questions: [
      q(1, 'What is 12 + 15?', [25, 27, 29, 31], 'B'),
      q(2, 'Which of these is the capital of India?', ['Mumbai', 'Kolkata', 'New Delhi', 'Chennai'], 'C'),
      q(3, 'How many days are there in a week?', [5, 6, 7, 8], 'C'),
      q(4, 'What is 9 × 8?', [64, 72, 81, 76], 'B'),
      q(5, 'Which is the largest number?', [99, 101, 100, 98], 'B'),
    ],
  }],
  createdAt: 0, updatedAt: 0,
}
