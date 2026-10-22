// houseOccupancy.js — how many seats each house really has taken (pure; the caller fetches the rows).
// A seat is taken by (a) a current student living in the house, or (b) an applicant who is Admitted into the
// house but has no student record yet. An Enrolled applicant already HAS a student row, so counting both
// (as the old code did) double-counted every enrolled student; dropped-out / inactive / deleted students and
// Applied, Rejected or Waitlisted applicants take no seat.
const norm = h => (h || '').toString().trim().toLowerCase()
const gk = v => String(parseInt(v, 10) || '')
export const holdsSeat = s => !s.deleted_at && s.status !== 'Dropout' && s.status !== 'Inactive' && s.status !== 'Deleted'

export function countHouseOccupancy({ houses = [], students = [], admissions = [], excludeGcc = null }) {
  const seated = students.filter(holdsSeat)
  const hasStudent = new Set(students.map(s => gk(s.gcc_no)).filter(Boolean))
  const waiting = admissions.filter(a => a.status === 'Admitted' && !hasStudent.has(gk(a.gcc_no)) && (excludeGcc == null || gk(a.gcc_no) !== gk(excludeGcc)))
  return houses.map(h => {
    const capacity = h.capacity ?? 40
    const studentCount = seated.filter(s => norm(s.house) === norm(h.name)).length
    const applicantCount = waiting.filter(a => norm(a.house) === norm(h.name)).length
    const occupied = studentCount + applicantCount
    return { name: h.name, capacity, occupied, studentCount, applicantCount, available: Math.max(0, capacity - occupied), isFull: occupied >= capacity }
  })
}
