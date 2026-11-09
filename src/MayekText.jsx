import { Fragment } from 'react'
import { bmeiSegments, LATIN_FONT } from './mayekSegments'
import { fixApunOrder } from './meetei_mayek'

// Renders a Mayek line. For BMEI04 text the parent's font is BMEI04, so
// Roman numerals, English number names and unmappable words are wrapped
// in a Latin font instead of showing up as Mayek letters.
export default function MayekText({ text, font }) {
  if (!text) return null
  if (font !== 'bmei04') return fixApunOrder(text)
  const segs = bmeiSegments(text)
  if (!segs.some(s => s.latin)) return text
  return segs.map((s, i) => (s.latin
    ? <span key={i} style={{ fontFamily: LATIN_FONT }}>{s.text}</span>
    : <Fragment key={i}>{s.text}</Fragment>))
}
