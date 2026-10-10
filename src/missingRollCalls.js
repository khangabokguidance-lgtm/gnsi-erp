// missingRollCalls.js — which hostel roll calls are closed but not complete.
// Pure logic for the "Missing roll call" warning (Hostel.jsx).
//   rows      attendance rows { student_id, house, date, session } for the days
//   students  the students in scope (a housemaster's house, or every house)
//   days      dates newest first, days[0] = today
//   isClosed  (date, session) → has that roll call's window closed?
// A past day counts only if some house marked it, so a school holiday (nobody
// marked) never raises it. Today counts as soon as its window has closed.
export function findMissingRollCalls({ rows, students, days, isClosed, normalizeHouse }) {
  const byHouse = new Map()
  for (const s of students || []) {
    const h = normalizeHouse(s.house)
    if (!h || /day\s*scholar/i.test(h)) continue
    if (!byHouse.has(h)) byHouse.set(h, { name: s.house, ids: new Set() })
    byHouse.get(h).ids.add(s.id)
  }
  const marked = new Map() // `${date}|${session}` → Set(student_id)
  for (const r of rows || []) {
    if (!r.house) continue
    const k = `${r.date}|${r.session}`
    if (!marked.has(k)) marked.set(k, new Set())
    marked.get(k).add(r.student_id)
  }
  const out = []
  for (const date of days) {
    for (const session of ['night', 'morning']) {
      if (!isClosed(date, session)) continue
      const done = marked.get(`${date}|${session}`)
      if (date !== days[0] && !done) continue
      for (const { name, ids } of byHouse.values()) {
        let n = 0
        if (done) for (const id of ids) if (done.has(id)) n++
        if (n < ids.size) out.push({ house: name, date, session, marked: n, total: ids.size, today: date === days[0], yesterday: date === days[1] })
      }
    }
  }
  return out
}
