// ─── GNSI Time Table 2026 — shared data source ────────────────────────────
// Extracted from GNSI_Time_Table_2026.docx
// Used by Timetable.jsx (display) and TeacherAttendance.jsx (attendance/doubt sessions)

export const BATCHES = [
  { name: 'Champion',   sub: 'Sainik',           color: '#1F4E79', light: '#D9E6F2' },
  { name: 'Achiever',   sub: 'Sainik',           color: '#2E5E4E', light: '#DCEDE7' },
  { name: 'Leader',     sub: 'Sainik',           color: '#6A2C70', light: '#E8DCEB' },
  { name: 'Lakshya A',  sub: 'Navodaya',         color: '#A05A00', light: '#F5E3CC' },
  { name: 'Lakshya B',  sub: 'Navodaya',         color: '#8C5F00', light: '#F2E6CC' },
  { name: 'Umeed',      sub: 'Navodaya',         color: '#B23A48', light: '#F5DADE' },
  { name: 'Elite',      sub: 'Navodaya Course',  color: '#1B5E5E', light: '#D6EDED' },
  { name: 'Prime',      sub: 'Foundation',       color: '#4A4A00', light: '#EFEFCC' },
]

// Each row: from/to + one [subject, teacher] pair per batch (null = no class that slot)
export const TIMETABLE_ROWS = [
  {
    from: '10:25 AM', to: '11:20 AM',
    cells: [
      ['Mathematics II', 'Sir Sumanta'], ['GK', 'Sir Deepak'], ['Mathematics I', 'Sir Sunder'],
      ['Mathematics I', 'Sir Himan'], ['Environmental Studies II', 'Sir Chetan'],
      ['Environmental Studies II', 'Sir Umesh'], ['Grammar', 'Sir Manglemba'], ['Mathematics II', 'Sir Kabiraj'],
    ],
  },
  {
    from: '11:20 AM', to: '12:10 PM',
    cells: [
      ['Reasoning', 'Sir Johny'], ['Mathematics II', 'Sir Himan'], ['Grammar', 'Sir Manglemba'],
      ['Environmental Studies II', 'Sir Chetan'], ['Passage & Grammar', 'Sir Pawan'],
      ['Mathematics Revision', 'Sir Sunder'], ['Mathematics', 'Sir Sumanta'], ['English Grammar', 'Sir Adison'],
    ],
  },
  {
    from: '12:10 PM', to: '1:00 PM',
    cells: [
      ['Science', 'Sir Arunkumar'], ['Reasoning', 'Sir Johny'], ['GK', 'Sir Deepak'],
      ['Passage & Grammar', 'Sir Pawan'], ['Mathematics Revision', 'Sir Lenin'],
      ['Environmental Studies I', 'Sir Shrinivash'], ['Meitei Mayek', 'Madam Sandhya'], ['Reasoning', 'Sir Roshan'],
    ],
  },
  { break: true, from: '1:00 PM', to: '1:15 PM', label: 'BREAK' },
  {
    from: '1:20 PM', to: '2:10 PM',
    cells: [
      ['Mathematics I', 'Sir Sunder'], ['Science', 'Sir Arunkumar'], ['Mathematics II', 'Sir Sumanta'],
      ['Environmental Studies I', 'Sir Deepak'], ['Mathematics', 'Sir Himan'],
      ['Passage & Grammar', 'Sir Pawan'], ['Environmental Studies', 'Sir Arjun'], ['Mathematics', 'Sir Lenin'],
    ],
  },
  {
    from: '2:10 PM', to: '3:00 PM',
    cells: [
      ['Vocabulary', 'Sir Lenin'], ['Grammar', 'Sir Manglemba'], ['Reasoning', 'Sir Johny'],
      ['Mathematics Revision', 'Sir Kabiraj'], ['Environmental Studies I', 'Sir Arunkumar'],
      ['Mathematics', 'Sir Himan'], ['Mathematics I', 'Sir Kabiraj'], ['Environmental Studies', 'Sir Arjun'],
    ],
  },
  {
    from: '3:00 PM', to: '3:50 PM',
    cells: [
      ['Grammar', 'Sir Bidyachandra'], ['Vocabulary', 'Sir Pawan'], ['Vocabulary', 'Sir Chetan'],
      ['Mathematics Revision', 'Sir Sunder'], ['Mathematics II', 'Sir Kabiraj'],
      ['Mental Ability', 'Sir Roshan'], ['Reasoning', 'Sir Roshan'], ['Passage', 'Madam Sandhya'],
    ],
  },
  {
    from: '6:00 PM', to: '7:00 PM',
    cells: [
      ['GK', 'Sir Deepak'], ['Mathematics I', 'Sir Bronson'], ['Science', 'Sir Arunkumar'],
      null, null, null, null, null,
    ],
  },
]

// Flattened helper: every (batch, period, subject, teacher) tuple for a given weekday's grid.
// Used to seed the attendance-marking list without re-deriving structure in the component.
export function flattenPeriods() {
  const out = []
  for (const row of TIMETABLE_ROWS) {
    if (row.break) continue
    row.cells.forEach((cell, i) => {
      if (!cell) return
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