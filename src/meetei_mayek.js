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
// different sound. This is the same 42-key table used by Eeyek.

export const MAPPING = {
  // Consonants (base form, lowercase)
  k:'ꯀ', s:'ꯁ', l:'ꯂ', m:'ꯃ', p:'ꯄ', n:'ꯅ', c:'ꯆ', t:'ꯇ',
  w:'ꯋ', y:'ꯌ', h:'ꯍ', f:'ꯐ', g:'ꯒ', r:'ꯔ', b:'ꯕ', j:'ꯖ', d:'ꯗ',
  z:'ꯉ', H:'ꯈ', v:'ꯚ', Y:'ꯌ',

  // Final consonants (lonsum) - capitals
  K:'ꯛ', L:'ꯜ', M:'ꯝ', P:'ꯞ', N:'ꯟ', T:'ꯠ', Z:'ꯡ', I:'ꯢ',

  // Vowel signs (matras)
  a:'ꯥ', e:'ꯦ', E:'ꯩ', i:'ꯤ', o:'ꯣ', O:'ꯧ', u:'ꯨ', x:'ꯪ',

  // Special: independent vowel + standalone consonant
  A:'ꯑ', U:'ꯎ',

  // Punctuation / marks (also everyday punctuation - see note in TabTranslit)
  '|':'꯫', '.':'꯬', '_':'꯭',
}

export const CHAR_NAMES = {
  'ꯀ':'KOK', 'ꯁ':'SAM', 'ꯂ':'LAI', 'ꯃ':'MIT', 'ꯄ':'PA', 'ꯅ':'NA',
  'ꯆ':'CHIL', 'ꯇ':'TIL', 'ꯈ':'KHOU', 'ꯉ':'NGOU', 'ꯋ':'WAI', 'ꯌ':'YANG',
  'ꯍ':'HUK', 'ꯎ':'UN', 'ꯐ':'PHAM', 'ꯑ':'ATIYA', 'ꯒ':'GOK', 'ꯔ':'RAI',
  'ꯕ':'BA', 'ꯖ':'JIL', 'ꯗ':'DIL', 'ꯚ':'BHAM',
  'ꯛ':'KOK LONSUM', 'ꯜ':'LAI LONSUM', 'ꯝ':'MIT LONSUM', 'ꯞ':'PA LONSUM',
  'ꯟ':'NA LONSUM', 'ꯠ':'TIL LONSUM', 'ꯡ':'NGOU LONSUM', 'ꯢ':'I LONSUM',
  'ꯥ':'ATAP', 'ꯦ':'YENAP', 'ꯩ':'CHEINAP', 'ꯤ':'INAP', 'ꯣ':'ONAP',
  'ꯧ':'SOUNAP', 'ꯨ':'UNAP', 'ꯪ':'NUNG',
  '꯫':'CHEIKHEI', '꯬':'LUM IYEK', '꯭':'APUN IYEK',
}

// Reverse map: Unicode Meetei Mayek character -> BMEI04 keystroke.
// Two keys can map to the same character (y/Y both give YANG) - the
// reverse map keeps the first one encountered, which is fine since both
// keystrokes are equally valid.
const _REVERSE = {}
for (const [key, char] of Object.entries(MAPPING)) {
  if (!(char in _REVERSE)) _REVERSE[char] = key
}

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
        out.push(MAPPING[ch])
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
  for (const ch of text) {
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
    'k','s','l','m','p','n','c','t','H','z','w','y','h','U','f','A',
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
      if (key in MAPPING) out.push(MAPPING[key])
      else if (/[A-Za-z]/.test(key)) out.push(`[?${key}?]`)
      else out.push(key)
    } else {
      out.push(ch)
    }
  }
  return out.join('')
}
