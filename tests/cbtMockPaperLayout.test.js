// The layout of the "Navodaya Mega Mock" papers: a cover page that LOOKS like sections and a numbered instruction
// list, then "SECTION I … Q. 1–20" with picture-only figure questions grouped under "Part I: …" lines, then ordinary
// text questions. All of it must come out as the real questions only. Same structure in English and in the BMEI04 paper.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTest } from '../src/lib/cbtPaper.js'

const L = (text, images = 0) => ({ text, raw: text, images: Array.from({ length: images }, (_, i) => ({ dataUrl: `data:x${i}`, hash: `h${text}${i}` })) })
const E = (t, i) => L(t, i)
function paper(w) {   // w = the words that differ between the two languages
  return [
    L(w.title), L(w.sec + ' I'), L(w.t1), L('1–20'), L('25'), L('/ 20'), L('/ 25'),
    L(w.sec + ' II'), L(w.t2), L('21–40'), L('25'), L('/ 20'), L('/ 25'),
    L(w.instr),
    L('1. This booklet contains 40 questions in two sections.'), L('2. Each question has four options (A), (B), (C) and (D).'), L('3. Mark your answer on the OMR sheet.'),
    L('Do not open this booklet until you are told to do so.'),
    L(w.SEC + ' I'), L(w.t1 + ' Q. 1–20'),
    L(''), L(w.part + ' I: In questions 1 to 2, choose the answer figure that completes the pattern.'), L(''),
    L('1.'), L('', 1), L('2.'), L('', 1),
    L(w.part + ' II: In questions 3 to 4, choose the mirror image of the figure shown in the question.'), L(''),
    L('3.'), L('', 1), L('4.'), L('', 1),
    L(w.SEC + ' II'), L(w.t2 + ' Q. 21–40'),
    L('21. Which of these is a river?'), L('(A) Ganga'), L('(B) Himalaya'), L('(C) Thar'), L('(D) Deccan'),
    L('22. How many days are there in a week?'), L('(A) 5 (B) 6'), L('(C) 7 (D) 8'),
  ]
}
const EN = { title: 'MEGA MOCK TEST', sec: 'Section', SEC: 'SECTION', t1: 'Mental Ability Test', t2: 'Environmental Studies', instr: 'General Instructions', part: 'Part' }
const MM = { title: 'mega mok', sec: 'seKsN', SEC: 'seKsN', t1: 'meNteL Aebiliti', t2: 'INvaIrNmeNteL', instr: 'tOgdbsiZ', part: 'sruK' }

test('English paper: only the real questions, figure questions kept, Part lines are group notes', () => {
  const { sections, warnings } = buildTest(paper(EN))
  assert.deepEqual(sections.map(s => [s.label, s.title, s.questions.length]), [['I', 'Mental Ability Test', 4], ['II', 'Environmental Studies', 2]])
  const q = sections[0].questions
  assert.deepEqual(q.map(x => x.no), [1, 2, 3, 4])
  assert.ok(q.every(x => x.figure && x.images.length === 1 && x.text === ''), 'figure questions have a picture and no text')
  assert.match(q[0].passage, /^Part I:/); assert.equal(q[1].passage, q[0].passage); assert.match(q[2].passage, /^Part II:/)
  assert.ok(!q.some(x => /Part II/.test(x.text)), 'a Part line must not become part of the previous question')
  const t = sections[1].questions
  assert.deepEqual(t.map(x => x.options.map(o => o.text)), [['Ganga', 'Himalaya', 'Thar', 'Deccan'], ['5', '6', '7', '8']])
  // (this mini paper jumps from Q4 to Q21, so "not found" for 5–20 is expected) — nothing else may be reported
  assert.deepEqual(warnings.filter(w => !/^Question (5|6|7|8|9|1\d|20) was not found/.test(w)), [])
})

test('the numbered instruction list is not read as questions 1, 2, 3', () => {
  const { sections } = buildTest(paper(EN))
  assert.ok(!sections.flatMap(s => s.questions).some(x => /booklet|OMR sheet/.test(x.text)))
})

test('BMEI04 (Meitei Mayek) paper with the same layout pairs up with the English paper, no phantom question 1', () => {
  const { sections, warnings } = buildTest(paper(EN), paper(MM))
  const all = sections.flatMap(s => s.questions)
  assert.deepEqual(all.map(x => x.no), [1, 2, 3, 4, 21, 22])
  assert.ok(!warnings.some(w => /missing from the Meitei|only in the Meitei|Question (1|2|3|4|21|22) was not found/.test(w)), warnings.join(' | '))
  assert.equal(sections[0].questions[0].figure, true)
  assert.match(all[4].textMm, /river/)   // the Meitei text (same words here) paired by number
})

test('a question number repeated by a cover list is resolved in favour of the real section', () => {
  const lines = [L('Section A'), L('Maths'), L('1. This booklet has 3 questions.'), L('SECTION A Maths Q. 1–3'), L('1. 2 + 2?'), L('(A) 3'), L('(B) 4'), L('(C) 5'), L('(D) 6'), L('2. 3 + 3?'), L('(A) 6'), L('(B) 7'), L('(C) 8'), L('(D) 9')]
  const { sections } = buildTest(lines)
  const q = sections.flatMap(s => s.questions)
  assert.deepEqual(q.map(x => [x.no, x.text]), [[1, '2 + 2?'], [2, '3 + 3?']])
})

test('section titles lose the "Q. 1–20" range, in several spellings', () => {
  for (const h of ['Mental Ability Test Q. 1–20', 'Mental Ability Test (Q. 1-20)', 'Mental Ability Test Questions 1 – 20']) {
    const { sections } = buildTest([L('SECTION I'), L(h), L('1. x?'), L('(A) a'), L('(B) b'), L('(C) c'), L('(D) d')])
    assert.equal(sections[0].title, 'Mental Ability Test', h)
  }
})

test('a "Read the passage and answer questions…" heading is not glued onto the last option before it', () => {
  const lines = [L('SECTION II'), L('EVS Q. 1–3'), L('1. Who heads a State?'), L('(A) President'), L('(B) Governor'), L('(C) Chief Minister'), L('(D) District Collector'),
    L('Passage 2 · Read the passage and answer questions 2 to 3.'), L('Every winter birds fly from Siberia to India in huge flocks because the cold makes food hard to find in the north, and they stay until spring returns.'),
    L('2. Why do birds migrate?'), L('(A) Cold'), L('(B) Heat'), L('(C) Fun'), L('(D) Fear'), L('3. When do they leave?'), L('(A) Spring'), L('(B) Winter'), L('(C) Summer'), L('(D) Never')]
  const q = buildTest(lines).sections[0].questions
  assert.deepEqual(q[0].options.map(o => o.text), ['President', 'Governor', 'Chief Minister', 'District Collector'])
  assert.match(q[1].passage, /^Every winter birds fly/)
})
