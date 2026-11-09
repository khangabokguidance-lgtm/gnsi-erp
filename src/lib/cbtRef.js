// cbtRef.js — turns what a candidate pastes (the full exam link, or just the Test ID) into the id and optional access code.
export function parseExamRef(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  let id = s, code = ''
  if (/^https?:\/\//i.test(s) || /^[\w.-]+\.[a-z]{2,}\/.+\?/i.test(s)) {
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
      id = u.searchParams.get('t') || ''
      code = u.searchParams.get('c') || ''
    } catch { return null }
  }
  id = id.trim()
  if (!/^[\w-]{3,80}$/.test(id)) return null
  return { id, code: code.trim() }
}
export const examHref = ({ id, code }) => `/exam?t=${encodeURIComponent(id)}${code ? `&c=${encodeURIComponent(code)}` : ''}`
