// Hostel data checks: Students ↔ hostel_allocations. Pure — unit-tested.
//
// Gender: houses carry no gender attribute in the database, so a "gender
// mismatch" is detected from the data itself — in a house where one gender is
// a clear majority, a student of the other gender is flagged for review.
// It is a prompt to double-check, not proof of an error.

export const MIN_HOUSE_SIZE = 4       // fewer boarders than this → too few to judge
export const MAJORITY = 0.75          // ≥ 75% one gender → single-gender house

const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const has = v => String(v ?? '').trim() !== ''
const isDayHouse = h => ['dayscholar'].includes(norm(h))
const type = s => norm(s.hostel_type)
const isBoarder = s => type(s) === 'boarder'
const isDayScholar = s => type(s) === 'dayscholar' || isDayHouse(s.house)
const gender = s => (/^m/i.test(s.gender || '') ? 'Male' : /^f/i.test(s.gender || '') ? 'Female' : null)
const placeholderRoom = r => !has(r) || norm(r) === 'tbd'

export const ISSUES = {
  type_missing:           { group: 'type',   level: 'amber', label: 'Hostel type not set' },
  type_house_conflict:    { group: 'type',   level: 'red',   label: 'Type and house disagree' },
  dayscholar_has_room:    { group: 'type',   level: 'red',   label: 'Day scholar holds a room' },
  boarder_no_house:       { group: 'type',   level: 'red',   label: 'Boarder has no house' },
  boarder_no_allocation:  { group: 'alloc',  level: 'red',   label: 'Boarder has no allocation' },
  gender_missing:         { group: 'gender', level: 'amber', label: 'Gender not set' },
  gender_house_mismatch:  { group: 'gender', level: 'amber', label: 'Gender differs from house' },
  room_missing:           { group: 'fields', level: 'amber', label: 'Room number missing' },
  bed_missing:            { group: 'fields', level: 'amber', label: 'Bed number missing' },
  date_missing:           { group: 'fields', level: 'amber', label: 'Allotment date missing' },
  status_missing:         { group: 'fields', level: 'amber', label: 'Allocation status missing' },
  alloc_inactive:         { group: 'fields', level: 'amber', label: 'Allocation not active' },
  contact_missing:        { group: 'info',   level: 'amber', label: 'Emergency contact missing' },
}
export const GROUPS = {
  type: 'Boarder / day scholar',
  alloc: 'Allocation',
  gender: 'Gender',
  fields: 'Missing hostel fields',
  info: 'Missing student info',
}

// Gender mix per real hostel house, from boarders who hold that house.
export function houseGenderMix(students) {
  const mix = {}
  for (const s of students) {
    if (!has(s.house) || isDayHouse(s.house) || isDayScholar(s)) continue
    const g = gender(s)
    const m = (mix[s.house] ||= { house: s.house, Male: 0, Female: 0, unknown: 0, total: 0 })
    m.total++
    if (g) m[g]++; else m.unknown++
  }
  for (const m of Object.values(mix)) {
    const known = m.Male + m.Female
    const top = m.Male >= m.Female ? 'Male' : 'Female'
    m.majority = known >= MIN_HOUSE_SIZE && m[top] / known >= MAJORITY ? top : null
    m.minority = m.majority ? (m.majority === 'Male' ? 'Female' : 'Male') : null
  }
  return mix
}

// allocations: hostel_allocations rows. opts.viewPII gates the student-contact check.
export function checkHostelData(students, allocations = [], opts = {}) {
  const allocBy = new Map()
  for (const a of allocations || []) if (a?.student_id != null) allocBy.set(a.student_id, a)
  const mix = houseGenderMix(students)
  const rows = []

  for (const st of students) {
    const issues = []
    const add = key => issues.push({ key, ...ISSUES[key] })
    const alloc = allocBy.get(st.id) || null
    const boarderish = isBoarder(st)

    if (!has(st.hostel_type)) add('type_missing')
    if (boarderish && isDayHouse(st.house)) add('type_house_conflict')
    else if (type(st) === 'dayscholar' && has(st.house) && !isDayHouse(st.house)) add('type_house_conflict')
    if (boarderish && !has(st.house)) add('boarder_no_house')
    if (isDayScholar(st) && alloc) add('dayscholar_has_room')
    if (boarderish && !alloc) add('boarder_no_allocation')

    if (boarderish || alloc) {
      const g = gender(st)
      if (!g) add('gender_missing')
      else {
        const m = mix[st.house]
        if (m?.majority && g === m.minority) add('gender_house_mismatch')
      }
    }

    if (alloc) {
      if (placeholderRoom(alloc.room_number)) add('room_missing')
      if (!has(alloc.bed_number)) add('bed_missing')
      if (!has(alloc.allotment_date)) add('date_missing')
      if (!has(alloc.status)) add('status_missing')
      else if (norm(alloc.status) !== 'active') add('alloc_inactive')
    }

    if (opts.viewPII && (boarderish || alloc) && !has(st.emergency_contact)) add('contact_missing')

    if (issues.length) rows.push({ st, alloc, issues })
  }

  const counts = {}
  for (const r of rows) for (const i of r.issues) counts[i.key] = (counts[i.key] || 0) + 1
  const boarders = students.filter(isBoarder).length
  const withAlloc = students.filter(s => allocBy.has(s.id)).length
  const fieldSlots = withAlloc * 4
  const missingSlots = ['room_missing', 'bed_missing', 'date_missing', 'status_missing'].reduce((n, k) => n + (counts[k] || 0), 0)
  return {
    rows, counts, mix,
    boarders, withAlloc,
    allocCompleteness: fieldSlots ? Math.round(((fieldSlots - missingSlots) / fieldSlots) * 100) : 100,
    issueStudents: rows.length,
  }
}
