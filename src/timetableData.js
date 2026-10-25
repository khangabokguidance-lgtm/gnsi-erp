// ─── GNSI Time Table — shared data source ────────────────────────────────
// Extracted from Time_Table_October_2026.docx — academic periods 1–6 plus the
// Boarder Time Table (Winter Session) for the rest of the day.
// Used by Timetable.jsx (grid seed, reports) and anything that needs the
// recurring Mon–Sat schedule without a database round-trip.

// Column order follows the source document.
export const BATCHES = [
  { name: 'Lakshya A',  sub: 'Navodaya',  color: '#A05A00', light: '#F5E3CC' },
  { name: 'Lakshya B',  sub: 'Navodaya',  color: '#8C5F00', light: '#F2E6CC' },
  { name: 'Umeed',      sub: 'Navodaya',  color: '#B23A48', light: '#F5DADE' },
  { name: 'Champion',   sub: 'Sainik',    color: '#1F4E79', light: '#D9E6F2' },
  { name: 'Achiever',   sub: 'Sainik',    color: '#2E5E4E', light: '#DCEDE7' },
  { name: 'Leader',     sub: 'Sainik',    color: '#6A2C70', light: '#E8DCEB' },
  { name: 'Udaan',      sub: 'Combined',  color: '#1B5E5E', light: '#D6EDED' },
  { name: 'Pragati',    sub: 'Combined',  color: '#4A4A00', light: '#EFEFCC' },
]

// Boarder self-study slots are set per group: Navodaya (3 batches), Sainik (3), Combined (2).
const group = (navodaya, sainik, combined) => [
  [navodaya, null], [navodaya, null], [navodaya, null],
  [sainik, null], [sainik, null], [sainik, null],
  [combined, null], [combined, null],
]
// A slot the whole institute keeps together (assembly, meals, breaks, lights off).
// The grid draws these as a single dark band across every batch.
const whole = (from, to, label) => ({ wholeInstitute: true, from, to, label })

// Each row: from/to + one [subject, teacher] pair per batch (null = no class that slot),
// or a whole-institute row (see whole() above). `to` is null for a point in time (Lights Off).
export const TIMETABLE_ROWS = [
  // ── Boarder: early morning ──
  {
    from: '6:20 AM', to: '7:10 AM',
    cells: group('Passage Practice', 'Meitei Mayek & EVS Class (Combined Group) · Mathematics Practice', 'Meitei Mayek Practice'),
  },
  whole('7:10 AM', '7:25 AM', 'Morning Assembly'),
  // ── Academic periods 1–6 ──
  {
    from: '7:30 AM', to: '8:20 AM',
    cells: [
      ['Environmental Studies II', 'Sir Arunkumar'], ['Environmental Studies II Revision', 'Sir Chetan'], ['Environmental Studies I', 'Sir Pawan'],
      ['Science', 'Sir Basanta'], ['GK', 'Sir Deepak'], ['Mathematics II', 'Sir Himan'],
      ['Reasoning', 'Sir Roshan'], ['Environmental Studies', 'Sir Arjun'],
    ],
  },
  // Lakshya B + Umeed sit together for Sir Himan's revision class this period.
  {
    from: '8:20 AM', to: '9:10 AM',
    cells: [
      ['Mathematics Revision', 'Sir Bronson'], ['Mathematics Revision', 'Sir Himan'], ['Mathematics Revision', 'Sir Himan'],
      ['GK', 'Sir Deepak'], ['Mathematics I', 'Sir Lenin'], ['Grammar', 'Sir Manglemba'],
      ['Mathematics (Navodaya)', 'Sir Kabiraj'], ['Reasoning', 'Sir Roshan'],
    ],
  },
  whole('9:10 AM', '9:40 AM', 'Heavy Breakfast'),
  // Champion has a double period of Mathematics II (Sir Sumanta) across periods 3–4.
  {
    from: '9:40 AM', to: '10:30 AM',
    cells: [
      ['Mathematics Revision', 'Sir Himan'], ['Mathematics Revision', 'Sir Johny'], ['Environmental Studies I Revision', 'Sir Sunder'],
      ['Mathematics II', 'Sir Sumanta'], ['Science', 'Sir Arunkumar'], ['GK', 'Sir Deepak'],
      ['Passage', 'Madam Sandhya'], ['Mathematics (Navodaya)', 'Sir Lenin'],
    ],
  },
  {
    from: '10:30 AM', to: '11:20 AM',
    cells: [
      ['Environmental Studies I', 'Sir Pawan'], ['Environmental Studies I Revision', 'Sir Sunder'], ['Environmental Studies II Revision', 'Sir Deepak'],
      ['Mathematics II', 'Sir Sumanta'], ['Grammar', 'Sir Manglemba'], ['Mathematics I', 'Sir Kabiraj'],
      ['Mathematics (Navodaya)', 'Sir Lenin'], ['Passage', 'Madam Sandhya'],
    ],
  },
  whole('11:20 AM', '11:30 AM', 'Short Break'),
  {
    from: '11:30 AM', to: '12:20 PM',
    cells: [
      ['Environmental Studies II Revision', 'Sir Chetan'], ['Environmental Studies I', 'Sir Pawan'], ['Mathematics Revision', 'Sir Lenin'],
      ['Reasoning', 'Sir Johny'], ['Mathematics II', 'Sir Sumanta'], ['Science', 'Sir Arunkumar'],
      ['Environmental Studies (Navodaya)', 'Sir Arjun'], ['Mathematics I (Navodaya)', 'Sir Kabiraj'],
    ],
  },
  {
    from: '12:20 PM', to: '1:10 PM',
    cells: [
      ['Environmental Studies I Revision', 'Sir Sunder'], ['Environmental Studies II', 'Sir Arunkumar'], ['Environmental Studies II', 'Sir Chetan'],
      ['Grammar', 'Sir Bidyachandra'], ['Reasoning', 'Sir Roshan'], ['Reasoning', 'Sir Johny'],
      ['Grammar', 'Sir Manglemba'], ['Grammar', 'Sir Adison'],
    ],
  },
  // ── Boarder Time Table (Winter Session) ──
  whole('1:30 PM', '2:30 PM', 'Lunch Time'),
  whole('2:30 PM', '3:30 PM', 'Refresh Hour'),
  { from: '3:30 PM', to: '4:30 PM', cells: group('Pre Mock Test Daily', 'Pre Mock Test Daily', 'Mathematics I Practice') },
  { from: '4:30 PM', to: '5:30 PM', cells: group('Pre Mock Test Daily', 'Mathematics I & II Practice (Sainik Group)', 'Recreation') },
  whole('5:30 PM', '6:00 PM', 'Tea Break'),
  // Source document prints this slot as "6:00 – 7:30 AM"; it falls between Tea Break and Dinner, so PM.
  { from: '6:00 PM', to: '7:30 PM', cells: group('EVS Practice', 'EVS & Passage (Combined Group) · Reasoning & Science, GK (Sainik Group)', 'EVS & English Grammar') },
  whole('7:30 PM', '8:30 PM', 'Dinner Time'),
  whole('8:30 PM', '9:00 PM', 'Refresh / Duty / Boarder Staff Dinner Time'),
  { from: '9:00 PM', to: '10:30 PM', cells: group('Maths Practice', 'Maths Practice (Combined Group) · English Grammar, Vocabulary (Sainik Group)', 'Reasoning / Maths II') },
  whole('10:30 PM', null, 'Lights Off'),
]

// "7:10 AM–7:25 AM", or just "10:30 PM" for a point in time. Matches timetable_master.period_name.
export const periodName = row => row.to ? `${row.from}–${row.to}` : row.from

// True for a timetable_master entry that belongs to the whole institute rather than one batch.
// Seeded whole-institute rows use class_name 'ALL'; the subject check keeps older break rows
// (and any hand-entered ones) drawn as a band too.
export const isWholeInstituteEntry = entry =>
  !!entry && (entry.class_name === 'ALL' || /TEA BREAK|LUNCH|DINNER|BREAK/i.test(entry.subject_name || ''))

// Flattened helper: every (batch, period, subject, teacher) tuple for a given weekday's grid.
// Used to seed the attendance-marking list without re-deriving structure in the component.
// Whole-institute rows and teacher-less self-study slots are left out.
export function flattenPeriods() {
  const out = []
  for (const row of TIMETABLE_ROWS) {
    if (row.wholeInstitute) continue
    row.cells.forEach((cell, i) => {
      if (!cell || !cell[1]) return
      const [subject, teacher] = cell
      out.push({
        batch: BATCHES[i].name,
        period_from: row.from,
        period_to: row.to,
        subject,
        teacher_name: teacher,
      })
    })
  }
  return out
}
