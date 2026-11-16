// Personal progress ("levels, streak, badges") for the Mission Sainik home screen. Pure functions so they can be unit-tested.
export const LEVELS = ['Recruit', 'Cadet', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel', 'Commander']
export const XP_PER_LEVEL = 60

const dayMs = 86400000
const iso = d => new Date(d).toLocaleDateString('en-CA')

// rows: task rows, mats: study-material rows. isMe(name) tells whether a setter / verifier name is the current user.
export function computeGame({ rows = [], mats = [], userName = '', isMe = () => false, today }) {
  const mine = rows.filter(r => isMe(r.setter))
  const submitted = mine.filter(r => r.status !== 'Pending').length
  const approved = mine.filter(r => r.status === 'Approved').length
  const verified = rows.filter(r => isMe(r.verifier) && (r.status === 'Verified' || r.status === 'Approved')).length
  const uploads = mats.filter(m => userName && m.uploaded_by === userName).length
  const xp = submitted * 20 + approved * 10 + verified * 15 + uploads * 5
  const level = Math.floor(xp / XP_PER_LEVEL)
  const levelPct = Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100)

  // Activity days (days on which this user changed a task or added material) → streak ending today or yesterday.
  const days = new Set([
    ...rows.filter(r => userName && r.updated_by === userName && r.updated_at).map(r => iso(r.updated_at)),
    ...mats.filter(m => userName && m.uploaded_by === userName && m.created_at).map(m => iso(m.created_at)),
  ])
  let streak = 0
  const t0 = new Date(today + 'T00:00:00').getTime()
  let cursor = days.has(today) ? t0 : t0 - dayMs
  while (days.has(iso(cursor))) { streak++; cursor -= dayMs }
  const week = Array.from({ length: 7 }, (_, i) => { const d = iso(t0 - (6 - i) * dayMs); return { d, on: days.has(d) } })

  const overdue = mine.filter(r => r.status === 'Pending' && r.due && today > r.due).length
  const badges = [
    { id: 'first', icon: '🚀', label: 'First submission', on: submitted >= 1 },
    { id: 'five', icon: '🎯', label: '5 sections in', on: submitted >= 5 },
    { id: 'verifier', icon: '🔍', label: 'Verifier', on: verified >= 1 },
    { id: 'library', icon: '📚', label: 'Material builder', on: uploads >= 3 },
    { id: 'streak3', icon: '🔥', label: '3-day streak', on: streak >= 3 },
    { id: 'clean', icon: '🛡️', label: 'Nothing overdue', on: mine.length > 0 && overdue === 0 },
  ]
  return { xp, level, levelTitle: LEVELS[Math.min(level, LEVELS.length - 1)], levelPct, toNext: XP_PER_LEVEL - (xp % XP_PER_LEVEL), streak, week, badges, submitted, verified, uploads, mineCount: mine.length }
}
