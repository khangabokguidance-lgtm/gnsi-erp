// mayekSegments.js — which words in a BMEI04 Mayek line are NOT Meetei.
//
// BMEI04 lines are typed with Latin keys ("CCCIV Asi hiNdu-ArabiK myeKt:"),
// and the same line often carries things that must stay in Latin:
// Roman numerals being asked about (CCCIV, LXIX, "M, D, C Amdi L"),
// English number names ("… Seventy crore one lakh five thousand"), and
// words the BMEI04 table can't map at all. Drawing the whole line in the
// BMEI04 font, or converting it letter by letter to Unicode, turned those
// into Mayek letters. Every screen, the PDF, Word and PowerPoint use this
// one rule so they agree.
import { romanToMeetei } from './meetei_mayek'

const EN_NUMBER_WORDS = new Set('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand lakh lakhs lac crore crores million millions billion billions and'.split(' '))
const ROMAN = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/
const letters = t => t.replace(/[^A-Za-z]/g, '')

// A multi-letter, all-capital, valid Roman numeral: CCCIV, LXIX, MMCCCXIV.
export const isRomanNumeral = t => { const l = letters(t); return l.length >= 2 && l === l.toUpperCase() && ROMAN.test(l) }

// Splits text into [{ text, latin }] runs (whitespace joins the run before it).
export function bmeiSegments(text) {
  const parts = String(text ?? '').split(/(\s+)/)
  const words = parts.map((t, i) => (/\S/.test(t) ? i : -1)).filter(i => i >= 0)
  const keep = new Array(parts.length).fill(false)
  const info = new Map(words.map(i => {
    const core = letters(parts[i]).toLowerCase()
    return [i, { core, num: !!core && EN_NUMBER_WORDS.has(core), bad: /[A-Za-z]/.test(parts[i]) && romanToMeetei(parts[i]).includes('[?') }]
  }))
  // Single Roman symbols count only in a list of them ("M, D, C Amdi L gi").
  const singles = words.filter(i => /^[MDCLXV][,.;:)]*$/.test(parts[i]))
  words.forEach(i => {
    const w = parts[i], inf = info.get(i)
    if (inf.bad || isRomanNumeral(w) || (singles.length >= 2 && singles.includes(i))) keep[i] = true
  })
  // Runs of two or more English number words ("and" joins but doesn't count).
  for (let k = 0; k < words.length; k++) {
    if (!info.get(words[k]).num) continue
    let e = k
    while (e + 1 < words.length && info.get(words[e + 1]).num) e++
    const run = words.slice(k, e + 1)
    if (run.filter(i => info.get(i).core !== 'and').length >= 2) run.forEach(i => { keep[i] = true })
    k = e
  }
  const out = []
  parts.forEach((t, i) => {
    if (!t) return
    const latin = /\S/.test(t) ? keep[i] : (out.length ? out[out.length - 1].latin : false)
    if (out.length && out[out.length - 1].latin === latin) out[out.length - 1].text += t
    else out.push({ text: t, latin })
  })
  return out
}

// BMEI04 keystrokes → Unicode Meetei Mayek, Latin runs left as typed.
export function bmeiToUnicode(text) {
  if (!text) return ''
  return bmeiSegments(text).map(s => (s.latin ? s.text : romanToMeetei(s.text))).join('')
}

// Font stack for the Latin runs inside a BMEI04 line.
export const LATIN_FONT = "'Inter', 'Segoe UI', Roboto, Arial, sans-serif"
