// sessionMove.js — plan for moving the active students to one session (pure; the caller reads and writes).
// Only current students move: not archived (deleted_at) and not Dropout / Inactive / Passed Out / etc.
const isCurrent = s => !s.deleted_at && (!String(s.status || '').trim() || String(s.status).trim().toLowerCase() === 'active')
const label = v => String(v ?? '').trim()

export function planSessionMove(students = [], target) {
  const t = label(target)
  const moves = [], bySource = {}
  let alreadyThere = 0, notCurrent = 0
  for (const s of students) {
    if (!isCurrent(s)) { notCurrent++; continue }
    if (label(s.session) === t) { alreadyThere++; continue }
    const from = label(s.session)
    moves.push({ id: s.id, gcc: s.gcc_no, name: s.name || '—', course: s.course || '—', batch: s.batch || '—', from, to: t })
    const k = from || '(none)'
    bySource[k] = (bySource[k] || 0) + 1
  }
  moves.sort((a, b) => Number(a.gcc) - Number(b.gcc))
  return { moves, bySource, alreadyThere, notCurrent, target: t }
}
