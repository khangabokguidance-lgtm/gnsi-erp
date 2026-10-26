// Remembers the last few Exams tools a user opened (shown on the Exam Desk home).
const RECENT_KEY = 'gnsi_exam_recent'
export function readRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
export function pushRecent(id) {
  if (!id || id === 'home') return
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter(x => x !== id)].slice(0, 6))) } catch { /* private mode */ }
}

