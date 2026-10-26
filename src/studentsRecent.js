// Remembers the last few students opened, for the Students desk ("Recently opened").
const RECENT_KEY = 'gnsi_students_recent'
export const readRecentStudents = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
export const pushRecentStudent = id => {
  if (id == null) return
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecentStudents().filter(x => x !== id)].slice(0, 8))) } catch { /* private mode */ }
}

