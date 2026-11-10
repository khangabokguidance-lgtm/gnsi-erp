// cbtRef.js — turns what a candidate pastes into the exam id and access code. It understands:
//   • the full exam link          https://site/exam?t=ID&c=CODE
//   • the whole invitation text   "Online exam: … / Link: https://site/exam?t=ID / Access code: 123456 / …"  (as copied from WhatsApp)
//   • a bare Test ID

// The access code, found in free text: "Access code: 123456", "Code - AB12CD", or "?c=123456" in a link. null when there is none.
export function extractCode(text) {
  const s = String(text ?? '')
  const q = s.match(/[?&]c=([A-Za-z0-9]{4,20})(?![A-Za-z0-9])/)
  if (q) return q[1]
  const m = s.match(/(?:access\s*code|exam\s*code|passcode|code)\s*(?:is)?\s*[:=\-–—]?\s*([A-Za-z0-9]{4,20})(?![A-Za-z0-9])/i)
  return m ? m[1] : null
}

const urlIn = s => { const m = s.match(/(?:https?:\/\/|\b[\w.-]+\.[a-z]{2,}\/)[^\s<>"')]+/gi); return m ? m : [] }

export function parseExamRef(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  let id = '', code = extractCode(s) || ''
  if (/\s/.test(s) || /[/?=]/.test(s)) {
    // a link, or a whole message: take the first link that names a test
    for (const u of urlIn(s)) {
      try {
        const url = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`)
        const t = url.searchParams.get('t')
        if (t) { id = t; code = code || url.searchParams.get('c') || ''; break }
      } catch { /* not a link */ }
    }
    if (!id) return null
  } else id = s
  id = id.trim()
  if (!/^[\w-]{3,80}$/.test(id)) return null
  return { id, code: String(code).trim() }
}
export const examHref = ({ id, code }) => `/exam?t=${encodeURIComponent(id)}${code ? `&c=${encodeURIComponent(code)}` : ''}`
