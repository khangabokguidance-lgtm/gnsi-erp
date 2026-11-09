// docxNumbering.js — Word's AUTOMATIC list numbers ("1." "2.", "(a)" "(b)", "A)" …) are not stored in the paragraph
// text, only as a list reference (numPr) plus numbering.xml. A question paper typed that way would have lost every
// question number and option letter. This works out the label Word would have shown for each paragraph.
// Pure DOM work: takes the parsed numbering.xml and styles.xml documents (either may be null).

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const attr = (el, n) => el?.getAttributeNS(W, n) ?? el?.getAttribute('w:' + n) ?? null
const kids = (el, tag) => Array.from(el?.childNodes || []).filter(n => n.nodeType === 1 && n.localName === tag)
const first = (el, tag) => kids(el, tag)[0] || null

const ROMAN = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
const roman = n => ROMAN.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v } return s }, '')
const letters = n => { let s = ''; for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(97 + ((k - 1) % 26)) + s; return s }   // 1 a … 26 z 27 aa
export function formatNumber(n, fmt) {
  switch (fmt) {
    case 'lowerLetter': return letters(n)
    case 'upperLetter': return letters(n).toUpperCase()
    case 'lowerRoman': return roman(n)
    case 'upperRoman': return roman(n).toUpperCase()
    case 'decimalZero': return String(n).padStart(2, '0')
    case 'bullet': case 'none': return ''
    default: return String(n)
  }
}

export function makeNumbering(numberingDoc, stylesDoc) {
  const abstract = new Map()   // abstractNumId -> { ilvl -> { start, fmt, text } }
  const nums = new Map()       // numId -> { abstractId, restart: Set(ilvl) | null, starts: { ilvl -> n } }
  const styleNum = new Map()   // styleId -> { numId, ilvl, basedOn }
  if (numberingDoc) {
    const root = numberingDoc.documentElement
    for (const an of kids(root, 'abstractNum')) {
      const lv = {}
      for (const l of kids(an, 'lvl')) lv[Number(attr(l, 'ilvl'))] = { start: Number(attr(first(l, 'start'), 'val') ?? 1), fmt: attr(first(l, 'numFmt'), 'val') || 'decimal', text: attr(first(l, 'lvlText'), 'val') ?? '' }
      abstract.set(attr(an, 'abstractNumId'), lv)
    }
    for (const n of kids(root, 'num')) {
      const starts = {}
      for (const o of kids(n, 'lvlOverride')) { const so = first(o, 'startOverride'); if (so) starts[Number(attr(o, 'ilvl'))] = Number(attr(so, 'val')) }
      nums.set(attr(n, 'numId'), { abstractId: attr(first(n, 'abstractNumId'), 'val'), starts })
    }
  }
  if (stylesDoc) {
    for (const st of kids(stylesDoc.documentElement, 'style')) {
      const np = first(first(st, 'pPr'), 'numPr')
      styleNum.set(attr(st, 'styleId'), { numId: np ? attr(first(np, 'numId'), 'val') : null, ilvl: np && first(np, 'ilvl') ? Number(attr(first(np, 'ilvl'), 'val')) : null, basedOn: attr(first(st, 'basedOn'), 'val') })
    }
  }
  const fromStyle = id => { for (let hop = 0; id && hop < 10; hop++) { const s = styleNum.get(id); if (!s) return null; if (s.numId != null) return s; id = s.basedOn } return null }
  const counters = new Map()   // list key -> array of counters per level

  // The label Word shows for this paragraph ('' = not numbered). Call for EVERY paragraph in document order.
  return function labelFor(p) {
    const ppr = first(p, 'pPr')
    let numId = null, ilvl = 0
    const np = first(ppr, 'numPr')
    if (np) { numId = attr(first(np, 'numId'), 'val'); if (first(np, 'ilvl')) ilvl = Number(attr(first(np, 'ilvl'), 'val')) }
    if (numId == null) { const s = fromStyle(attr(first(ppr, 'pStyle'), 'val')); if (s) { numId = s.numId; if (s.ilvl != null) ilvl = s.ilvl } }
    if (numId == null || numId === '0') return ''
    const def = nums.get(numId); const lv = def && abstract.get(def.abstractId)
    if (!lv || !lv[ilvl]) return ''
    // lists that share one abstract definition keep counting together, unless a startOverride restarts them
    const key = Object.keys(def.starts).length ? 'n' + numId : 'a' + def.abstractId
    const c = counters.get(key) || []
    const startAt = l => (def.starts[l] ?? lv[l]?.start ?? 1)
    c[ilvl] = c[ilvl] === undefined ? startAt(ilvl) : c[ilvl] + 1
    for (let l = ilvl + 1; l < c.length; l++) c[l] = undefined
    counters.set(key, c)
    const L = lv[ilvl]
    if (L.fmt === 'bullet' || L.fmt === 'none') return ''
    let label = L.text.replace(/%(\d)/g, (_, d) => { const lvl = Number(d) - 1; const v = c[lvl] ?? startAt(lvl); return formatNumber(v, lv[lvl]?.fmt || 'decimal') })
    if (!label.trim()) label = formatNumber(c[ilvl], L.fmt)
    label = label.trim()
    // "1" or "A" with no bracket / dot would not read as a label — add the usual dot
    if (/^[0-9A-Za-z]{1,3}$/.test(label)) label += '.'
    return label
  }
}
