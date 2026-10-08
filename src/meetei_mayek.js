// BMEI04 <-> Unicode Meetei Mayek transliterator
//
// IMPORTANT: this is NOT a generic phonetic scheme. It reproduces the exact
// keystroke behaviour of the legacy BMEI04 font used across GNSI's Bmei04
// documents, verified against real words the school actually typed
// (apple/ball/cat/dog/elephant, manipur, value, number, find, divide, most)
// plus an official Unicode Meetei Mayek reference chart. See the Eeyek
// converter tool for the full verification history.
//
// One English keystroke -> one Meetei Mayek character. Case matters:
// capital letters are mostly the LONSUM (final-consonant) forms, not a
// different sound. This is the same 42-key table used by Eeyek, except
// capital Y: the BMEI04 font draws THOU (ꯊ) on that key, not YANG.
//
// Two places where BMEI04 keystroke order differs from Unicode order:
//  - APUN IYEK (_) is typed AFTER the second consonant of a cluster
//    ("fy_" draws the PHAM+YANG conjunct), but Unicode puts the virama
//    between the two consonants (ꯐ꯭ꯌ). romanToMeetei/meeteiToRoman
//    reorder it in each direction.
//  - Capital I is the letter I (ꯏ), as in ꯇꯥꯏ — that is the form in all of
//    GNSI's existing Unicode text. I LONSUM (ꯢ) still converts back to I.

export const MAPPING = {
  // Consonants (base form, lowercase)
  k:'ꯀ', s:'ꯁ', l:'ꯂ', m:'ꯃ', p:'ꯄ', n:'ꯅ', c:'ꯆ', t:'ꯇ',
  w:'ꯋ', y:'ꯌ', h:'ꯍ', f:'ꯐ', g:'ꯒ', r:'ꯔ', b:'ꯕ', j:'ꯖ', d:'ꯗ',
  z:'ꯉ', H:'ꯈ', v:'ꯚ', Y:'ꯊ',

  // Final consonants (lonsum) - capitals
  K:'ꯛ', L:'ꯜ', M:'ꯝ', P:'ꯞ', N:'ꯟ', T:'ꯠ', Z:'ꯡ', I:'ꯏ',

  // Vowel signs (matras)
  a:'ꯥ', e:'ꯦ', E:'ꯩ', i:'ꯤ', o:'ꯣ', O:'ꯧ', u:'ꯨ', x:'ꯪ',

  // Special: independent vowel + standalone consonant
  A:'ꯑ', U:'ꯎ',

  // Punctuation / marks (also everyday punctuation - see note in TabTranslit)
  '|':'꯫', '.':'꯬', '_':'꯭',
}

export const CHAR_NAMES = {
  'ꯀ':'KOK', 'ꯁ':'SAM', 'ꯂ':'LAI', 'ꯃ':'MIT', 'ꯄ':'PA', 'ꯅ':'NA',
  'ꯆ':'CHIL', 'ꯇ':'TIL', 'ꯈ':'KHOU', 'ꯉ':'NGOU', 'ꯊ':'THOU', 'ꯋ':'WAI', 'ꯌ':'YANG',
  'ꯍ':'HUK', 'ꯎ':'UN', 'ꯐ':'PHAM', 'ꯑ':'ATIYA', 'ꯒ':'GOK', 'ꯔ':'RAI',
  'ꯕ':'BA', 'ꯖ':'JIL', 'ꯗ':'DIL', 'ꯚ':'BHAM',
  'ꯛ':'KOK LONSUM', 'ꯜ':'LAI LONSUM', 'ꯝ':'MIT LONSUM', 'ꯞ':'PA LONSUM',
  'ꯟ':'NA LONSUM', 'ꯠ':'TIL LONSUM', 'ꯡ':'NGOU LONSUM', 'ꯏ':'I', 'ꯢ':'I LONSUM',
  'ꯥ':'ATAP', 'ꯦ':'YENAP', 'ꯩ':'CHEINAP', 'ꯤ':'INAP', 'ꯣ':'ONAP',
  'ꯧ':'SOUNAP', 'ꯨ':'UNAP', 'ꯪ':'NUNG',
  '꯫':'CHEIKHEI', '꯬':'LUM IYEK', '꯭':'APUN IYEK',
}

// Reverse map: Unicode Meetei Mayek character -> BMEI04 keystroke.
const _REVERSE = {}
for (const [key, char] of Object.entries(MAPPING)) {
  if (!(char in _REVERSE)) _REVERSE[char] = key
}
// Letters the BMEI04 font has a key for but that are converted in this
// direction only. I LONSUM (ꯢ) is drawn on the same key as the letter I.
// J, G and D (JHAM, GHOU, DHOU) stay out of MAPPING on purpose: these
// letters are rare in Manipuri, and mayekSegments.js relies on capitals
// like these being unknown to keep English words ("Delhi", "Gopal",
// "June") in Latin letters inside a BMEI04 line.
Object.assign(_REVERSE, { 'ꯢ':'I', 'ꯓ':'J', 'ꯘ':'G', 'ꯙ':'D' })

// Vowel-sign (matra) keys. In this abugida, these attach to a PRECEDING
// consonant letter within the same syllable — they have no valid meaning
// as the first character of a word/syllable, since there is nothing for
// them to attach to. A word/syllable boundary is: start of string, or
// right after any non-letter (space, punctuation, digit).
const VOWEL_SIGN_KEYS = new Set(['a', 'e', 'E', 'i', 'o', 'O', 'u', 'x'])

// Word-initial substitution for vowel-sign keys that DO have a matching
// independent vowel letter in this 42-key table. Only 'a' (-> ATIYA, key
// A) and 'u' (-> UN, key U) have one; e/i/o/x do not, so those get flagged
// instead of guessed (see romanToMeetei below).
const WORD_INITIAL_SUBSTITUTE = { a: 'A', u: 'U' }

const APUN = '꯭'
// Full consonant letters (KOK..BHAM), i.e. the ones that can join in an
// APUN IYEK cluster. Excludes the independent vowels ꯎ ꯏ ꯑ and lonsum forms.
const isClusterConsonant = (c) => typeof c === 'string' && c.length === 1 &&
  c >= 'ꯀ' && c <= 'ꯚ' && c !== 'ꯎ' && c !== 'ꯏ' && c !== 'ꯑ'

// Appends one converted character, moving a typed APUN IYEK between the two
// consonants it joins: BMEI04 "fy_" -> ꯐ꯭ꯌ. Shared by every BMEI04 -> Unicode
// path so they all agree.
function pushConverted(out, char) {
  if (char === APUN && isClusterConsonant(out[out.length - 1]) && isClusterConsonant(out[out.length - 2])) {
    out.splice(out.length - 1, 0, APUN)
  } else {
    out.push(char)
  }
}

// Same consonant set as isClusterConsonant, for regular expressions.
const CONS = '[\\uABC0-\\uABCD\\uABD0\\uABD2-\\uABDA]'
// Two consonants then APUN, where nothing can follow the APUN as a cluster
// partner: a vowel sign, a lonsum letter, another APUN, a non-Mayek character
// or the end of the text. Correct Unicode never has this; it is BMEI04 typing
// order that was converted without reordering.
const KEYSTROKE_ORDER_APUN = new RegExp(`(${CONS})(${CONS})\\uABED(?=[\\uABDB-\\uABED\\uABF0-\\uABFF]|[^\\uABC0-\\uABFF]|$)`, 'g')

/**
 * Repair Unicode Meetei Mayek that was converted from BMEI04 before APUN
 * IYEK was reordered (ꯍꯋ꯭ꯥ -> ꯍ꯭ꯋꯥ). Only fixes the cases that cannot be
 * correct Unicode, so text that is already right is returned unchanged.
 */
export function fixApunOrder(text) {
  if (!text || !String(text).includes(APUN)) return text
  return String(text).replace(KEYSTROKE_ORDER_APUN, `$1${APUN}$2`)
}

/**
 * Convert BMEI04 keystrokes (plain English letters, exactly as you'd type
 * them with the Bmei04 font selected in Word) into Unicode Meetei Mayek.
 * Anything not in the table (digits, spaces, other punctuation) passes
 * through unchanged. Unrecognised letters are wrapped as [?x?] rather than
 * silently dropped or guessed.
 *
 * Enforces one abugida rule that plain keystroke-literal conversion
 * otherwise violates: a vowel-sign key (a,e,E,i,o,O,u,x) cannot legally
 * start a word/syllable — it needs a preceding consonant to attach to.
 * When one appears at a word boundary this function:
 *   - substitutes the independent vowel letter instead, for 'a' and 'u'
 *     (the only two with a real independent form in this table) — this is
 *     a correct BMEI04-equivalent form, not a guess;
 *   - otherwise (e, E, i, o, O, x) leaves it as [?x?], because no correct
 *     standalone form exists in this scheme to substitute, and guessing
 *     one would be exactly the silent-guess behaviour this module exists
 *     to avoid.
 *
 * Returns a plain string, same as before, for every existing call site.
 * Pass a third argument to also get the list of corrections/flags made:
 *
 *   const { text, warnings } = romanToMeetei(bmei04, {}, true)
 *
 * warnings is [] when nothing needed fixing/flagging.
 */
export function romanToMeetei(text, options = {}, withWarnings = false) {
  const out = []
  const warnings = []
  let atWordStart = true

  for (const ch of text) {
    const isLetter = /[A-Za-z]/.test(ch)

    if (isLetter || ch === '.' || ch === '_' || ch === '|') {
      if (isLetter && VOWEL_SIGN_KEYS.has(ch) && atWordStart) {
        const sub = WORD_INITIAL_SUBSTITUTE[ch]
        if (sub) {
          out.push(MAPPING[sub])
          warnings.push({
            original: ch, substituted: sub, charIndex: out.length - 1,
            reason: `Word-initial vowel sign '${ch}' has no consonant to attach to; used independent vowel letter '${sub}' instead.`,
          })
        } else {
          out.push(`[?${ch}?]`)
          warnings.push({
            original: ch, substituted: null, charIndex: out.length - 1,
            reason: `Word-initial vowel sign '${ch}' has no consonant to attach to, and this table has no independent vowel letter for it. Needs a human decision.`,
          })
        }
      } else if (ch in MAPPING) {
        pushConverted(out, MAPPING[ch])
      } else if (isLetter) {
        out.push(`[?${ch}?]`)
      } else {
        out.push(ch)
      }
      atWordStart = false
    } else {
      out.push(ch)
      atWordStart = true
    }
  }

  const joined = out.join('')
  return withWarnings ? { text: joined, warnings } : joined
}

/**
 * Convert Unicode Meetei Mayek text back into the BMEI04 keystrokes that
 * would produce it. Useful for checking a character's identity, or for
 * re-deriving what someone would have typed.
 */
export function meeteiToRoman(text) {
  const out = []
  const chars = [...text]
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (isClusterConsonant(ch) && chars[i + 1] === APUN && isClusterConsonant(chars[i + 2])) {
      // ꯐ꯭ꯌ -> "fy_" (the order a BMEI04 typist presses the keys)
      out.push(_REVERSE[ch], _REVERSE[chars[i + 2]], '_')
      i += 2
      continue
    }
    out.push(_REVERSE[ch] !== undefined ? _REVERSE[ch] : ch)
  }
  return out.join('')
}

/**
 * All 42 confirmed keys, each with its character and Unicode name, in a
 * sensible reading order (consonants, lonsum, vowel signs, special,
 * punctuation) for a character picker UI.
 */
export function getAllCharacters() {
  const order = [
    // consonants
    'k','s','l','m','p','n','c','t','H','z','Y','w','y','h','U','f','A',
    'g','r','b','j','d','v',
    // lonsum
    'K','L','M','P','N','T','Z','I',
    // vowel signs
    'a','e','E','i','o','O','u','x',
    // punctuation
    '|','.','_',
  ]
  return order.map(key => ({
    key,
    char: MAPPING[key],
    name: CHAR_NAMES[MAPPING[key]] || '',
  }))
}

/**
 * Convert BMEI04 PUA-encoded text (the raw characters stored in a .docx
 * that has Bmei04-tagged runs - each keystroke stored as ASCII + 0xF000)
 * into Unicode Meetei Mayek. This is what you need when importing an old
 * document's text, as opposed to romanToMeetei() which is for someone
 * typing fresh keystrokes directly.
 */
export function puaToMeetei(text) {
  const out = []
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (code >= 0xF020 && code <= 0xF07E) {
      const key = String.fromCharCode(code - 0xF000)
      if (key in MAPPING) pushConverted(out, MAPPING[key])
      else if (/[A-Za-z]/.test(key)) out.push(`[?${key}?]`)
      else out.push(key)
    } else {
      out.push(ch)
    }
  }
  return out.join('')
}
