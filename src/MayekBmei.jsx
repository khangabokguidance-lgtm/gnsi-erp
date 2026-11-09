// MayekBmei.jsx — show Unicode Meetei Mayek in the BMEI04 ("Bmei") font.
// BMEI04 is a keyboard-encoded font: it has glyphs for plain keys (k, s, l …),
// not for the Unicode Meetei Mayek letters. So each run of Mayek letters is turned
// into its BMEI04 keystrokes (meeteiToRoman) and drawn in that font; English words,
// numbers and punctuation in the same line stay in the normal font.
import { meeteiToRoman } from './meetei_mayek'

// Letters, vowel signs, apun iyek, lonsums … (U+ABC0–ABEF) and extensions (U+AAE0–AAF6).
// Mayek digits (ABF0–ABF9) have no BMEI04 key, so they are left out and keep the normal font.
const RUN = /[ꫠ-꫶ꯀ-ꯪ꯬-꯭]+/g

/** Split text into [{ mayek, text }] pieces; mayek runs are already converted to BMEI04 keys. */
function bmeiSegments(text) {
  const s = String(text ?? '')
  const out = []
  let last = 0
  for (const m of s.matchAll(RUN)) {
    if (m.index > last) out.push({ mayek: false, text: s.slice(last, m.index) })
    out.push({ mayek: true, text: meeteiToRoman(m[0]) })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ mayek: false, text: s.slice(last) })
  return out
}

export function BmeiText({ text }) {
  const segs = bmeiSegments(text)
  if (!segs.some(x => x.mayek)) return <>{String(text ?? '')}</>
  return <>{segs.map((x, i) => x.mayek ? <span key={i} className="cbt-bmei">{x.text}</span> : x.text)}</>
}
