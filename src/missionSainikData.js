// missionSainikData.js — fixed plan for "Mission Sainik 2027 – Search for Extra Ordinary".
// Office Order No. GNSI/MS-2027/PMT/2026/01 dated 2026-11-16.
// 20 Pre Mock Tests (PMT-01 … PMT-20), 150 questions / 300 marks each, six sections of 25 questions × 2 marks.
// Only the progress of each task (status, dates, remarks) is stored in Supabase (`mission_sainik_tasks`);
// the schedule, panel and allotment rules live here so they are versioned with the code.

export const ORDER_NO = 'GNSI/MS-2027/PMT/2026/01'
export const ORDER_DATE = '2026-11-16'
export const SUBMISSION_DEADLINE = '2026-11-28' // all study material at the Head of the Institute's office

// key → label stored in the database `subject` column
export const SUBJECTS = [
  { key: 'maths',     label: 'Mathematics',       short: 'Maths' },
  { key: 'reasoning', label: 'Reasoning',         short: 'Reasoning' },
  { key: 'science',   label: 'Science',           short: 'Science' },
  { key: 'gk',        label: 'General Knowledge', short: 'GK' },
  { key: 'grammar',   label: 'English Grammar',   short: 'Grammar' },
  { key: 'vocab',     label: 'Vocabulary',        short: 'Vocab' },
]

// Question Setting Panel — every teacher listed sets questions; nobody verifies their own.
export const PANEL = {
  maths:     ['Sumanta', 'Kabiraj'],
  reasoning: ['Johny', 'Roshan', 'Umesh'],
  science:   ['Arunkumar', 'Boy'],
  gk:        ['Deepak'],
  grammar:   ['Manglemba', 'Bidyachandra', 'Adision'],
  vocab:     ['Pawan', 'Fedrava'],
}

// Verifier rule: two teachers verify each other; three rotate (A→B→C→A); GK is checked by Sir Arunkumar (or the Principal).
export function verifierFor(subjectKey, setter) {
  if (subjectKey === 'gk') return 'Arunkumar'
  const list = PANEL[subjectKey] || []
  const i = list.indexOf(setter)
  if (i < 0 || list.length < 2) return ''
  return list[(i + 1) % list.length]
}

export const SETTER_TITLES = { Fedrava: 'Miss Fedrava' } // everyone else is "Sir …"
export const fullName = n => (SETTER_TITLES[n] || 'Sir ' + n)

// [test_no, test date, drafts due, verification, final & print]
const RAW = [
  [1,  '2026-11-30', '2026-11-23', '2026-11-24', '2026-11-25'],
  [2,  '2026-12-02', '2026-11-25', '2026-11-30', '2026-12-01'],
  [3,  '2026-12-04', '2026-11-28', '2026-12-02', '2026-12-03'],
  [4,  '2026-12-06', '2026-11-28', '2026-12-04', '2026-12-05'],
  [5,  '2026-12-08', '2026-11-28', '2026-12-06', '2026-12-07'],
  [6,  '2026-12-10', '2026-11-28', '2026-12-08', '2026-12-09'],
  [7,  '2026-12-12', '2026-11-28', '2026-12-10', '2026-12-11'],
  [8,  '2026-12-14', '2026-11-28', '2026-12-11', '2026-12-12'],
  [9,  '2026-12-16', '2026-11-28', '2026-12-14', '2026-12-15'],
  [10, '2026-12-18', '2026-11-28', '2026-12-16', '2026-12-17'],
  [11, '2026-12-20', '2026-11-28', '2026-12-18', '2026-12-19'],
  [12, '2026-12-22', '2026-11-28', '2026-12-20', '2026-12-21'],
  [13, '2026-12-24', '2026-11-28', '2026-12-22', '2026-12-23'],
  [14, '2026-12-26', '2026-11-28', '2026-12-24', '2026-12-25'],
  [15, '2026-12-28', '2026-11-28', '2026-12-26', '2026-12-26'],
  [16, '2026-12-30', '2026-11-28', '2026-12-28', '2026-12-29'],
  [17, '2027-01-02', '2026-11-28', '2026-12-30', '2026-12-31'],
  [18, '2027-01-04', '2026-11-28', '2027-01-02', '2027-01-03'],
  [19, '2027-01-06', '2026-11-28', '2027-01-04', '2027-01-05'],
  [20, '2027-01-08', '2026-11-28', '2027-01-06', '2027-01-07'],
]
export const TESTS = RAW.map(([no, date, drafts, verify, print]) => ({ no, id: 'PMT-' + String(no).padStart(2, '0'), date, drafts, verify, print }))

// Holidays inside the window (no test or deadline): 2nd/4th Sundays 13 & 27 Dec, New Year's Day. JNVST 26–29 Nov.
export const HOLIDAYS = ['2026-12-13', '2026-12-27', '2027-01-01']
export const JNVST = ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']

// Practice question bank — [subject, setter, count (null = to be notified)]
export const PRACTICE = [
  ['Mathematics',       'Kabiraj',      30],
  ['Mathematics',       'Sumanta',      null],
  ['Reasoning',         'Johny',        20],
  ['Reasoning',         'Roshan',       20],
  ['Reasoning',         'Umesh',        20],
  ['English Grammar',   'Manglemba',    30],
  ['English Grammar',   'Bidyachandra', 20],
  ['English Grammar',   'Adision',      20],
  ['Vocabulary',        'Pawan',        25],
  ['Vocabulary',        'Fedrava',      25],
  ['Science',           'Arunkumar',    20],
  ['Science',           'Boy',          20],
  ['Science / General Knowledge (to be notified)', 'Deepak', 30],
].map(([subject, setter, count]) => {
  const key = SUBJECTS.find(s => s.label === subject)?.key
  return { subject, setter, count, verifier: key ? verifierFor(key, setter) : 'Arunkumar' }
})

// Rows to create in `mission_sainik_tasks`: 20 tests × 6 sections + 13 practice sets.
export function buildSeedRows() {
  const rows = []
  TESTS.forEach((t, i) => {
    SUBJECTS.forEach(s => {
      const list = PANEL[s.key]
      const setter = list[i % list.length]
      rows.push({ kind: 'test', test_no: t.no, subject: s.label, setter, verifier: verifierFor(s.key, setter), question_count: 25, status: 'Pending' })
    })
  })
  PRACTICE.forEach(p => rows.push({ kind: 'practice', test_no: 0, subject: p.subject, setter: p.setter, verifier: p.verifier, question_count: p.count, status: 'Pending' }))
  return rows
}

export const STATUS_FLOW = ['Pending', 'Submitted', 'Verified', 'Approved']

// Sainik Mock Test Series (Annexure-III, second table) — 20 tests, 10–30 Jan 2027; AISSEE Class VI on 31 Jan 2027.
export const EXAM_DATE = '2027-01-31'
export const MOCK_DATES = [
  '2027-01-10', '2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14', '2027-01-15', '2027-01-16', '2027-01-17', '2027-01-18', '2027-01-19',
  '2027-01-20', '2027-01-21', '2027-01-22', '2027-01-23', '2027-01-24', '2027-01-25', '2027-01-27', '2027-01-28', '2027-01-29', '2027-01-30',
]
export const MOCK_TESTS = MOCK_DATES.map((date, i) => ({ no: i + 1, id: 'MT-' + String(i + 1).padStart(2, '0'), date }))
// AISSEE pattern: 125 questions, 300 marks, 150 minutes, no negative marking.
export const MOCK_SECTIONS = [
  { label: 'Mathematics', q: 50, marks: 150 }, { label: 'Intelligence', q: 25, marks: 50 },
  { label: 'Grammar + Vocabulary', q: 25, marks: 50 }, { label: 'Science + GK', q: 25, marks: 50 },
]

// Practice Question Setting Panel (Annexure-II, second table): verifier + assistants per subject, and the number of
// practice sets (25 questions each) per chapter — Maths 25+25+25, Reasoning/Science/GK/Vocabulary 25+25, Grammar 25+25+25.
// Daily Class Test (Annexure-V): Maths 20 Q × 3 marks, Reasoning / Grammar / GK 10 Q × 2 marks each = 120 marks.
export const PRACTICE_PANEL = {
  maths:     { verifier: 'Sumanta',   assistants: ['Sunder', 'Kabiraj', 'Bronson'], sets: 3 },
  reasoning: { verifier: 'Johny',     assistants: ['Umesh'], sets: 2 },
  science:   { verifier: 'Arunkumar', assistants: ['Basanta'], sets: 2 },
  gk:        { verifier: 'Deepak',    assistants: ['Chetan'], sets: 2 },
  grammar:   { verifier: 'Manglemba', assistants: ['Bidyachandra', 'Adision'], sets: 3 },
  vocab:     { verifier: 'Pawan',     assistants: ['Fedrava'], sets: 2 },
}

// Whole-word, case-insensitive match of a panel name ("Sumanta") inside a login / display name ("Sir Sumanta Singh").
// Stricter than String.includes so "Boy" never matches "Boyd" and "Johny" never matches "Johnyson".
export function nameMatches(who, name) {
  if (!who || !name) return false
  const words = String(who).toLowerCase().split(/[^a-z0-9]+/), want = String(name).toLowerCase()
  // a short panel name ("Sandhya") also matches a longer login name ("Sandhyarani")
  return words.includes(want) || (want.length >= 4 && words.some(x => x.startsWith(want)))
}
// Only http(s) links may be stored or opened (blocks javascript: / data: URLs).
export function safeUrl(u) {
  try { const x = new URL(String(u || '').trim()); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : '' } catch { return '' }
}
