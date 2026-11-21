// Maths in question text: fractions, powers, roots and picture options, rendered to safe HTML for the paper, preview and Word.
//   \frac{3}{4}   → stacked fraction        x^2, x^{10}, 10^{-3} → superscript       H_2O, a_{n} → subscript
//   \sqrt{16}     → √ with a bar            [[img:data:image/jpeg;base64,…]] → a picture (used for picture options)
//   \times \div \pm \le \ge \ne \pi \deg \angle \therefore \rightarrow \approx \infty \triangle \perp \parallel → symbols
// The input is escaped first, so question text can never inject HTML.

const SYMBOLS = { times: '×', div: '÷', pm: '±', le: '≤', ge: '≥', ne: '≠', pi: 'π', deg: '°', angle: '∠', therefore: '∴', rightarrow: '→', approx: '≈', infty: '∞', triangle: '△', perp: '⊥', parallel: '∥', cdot: '·', theta: 'θ', alpha: 'α', beta: 'β', rupee: '₹' }
const IMG_RE = /\[\[img:(data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+)\]\]/g
let stackedMode = true
export const setMathStacked = v => { stackedMode = !!v }   // Word cannot stack fractions with CSS, so exports switch this off

const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export const hasPicture = text => { IMG_RE.lastIndex = 0; const r = IMG_RE.test(String(text || '')); IMG_RE.lastIndex = 0; return r }
export const pictureOf = text => { IMG_RE.lastIndex = 0; const m = IMG_RE.exec(String(text || '')); IMG_RE.lastIndex = 0; return m ? m[1] : '' }
export const withPicture = (text, dataUrl) => (dataUrl ? `[[img:${dataUrl}]]` : '') + String(text || '').replace(IMG_RE, '').trim()
export const withoutPicture = text => String(text || '').replace(IMG_RE, '').trim()
// For a box someone is typing into: the same, but spaces are kept (a trimmed box swallows the space after every word).
export const withPictureRaw = (text, dataUrl) => (dataUrl ? `[[img:${dataUrl}]]` : '') + String(text || '').replace(IMG_RE, '')
export const withoutPictureRaw = text => String(text || '').replace(IMG_RE, '')

// Approximate printed length (used to choose 4-up / 2-up / stacked options): markup and pictures count as short.
export function mathPlain(text) {
  return String(text || '').replace(IMG_RE, 'IMG').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2').replace(/\\sqrt\{([^{}]*)\}/g, '√$1').replace(/\\([a-z]+)/gi, (m, k) => SYMBOLS[k] || m).replace(/[{}^]/g, '')
}

function typeset(raw) {
  let s = escHtml(raw)
  const frac = (a, b) => (stackedMode ? `<span class="fr"><span>${a}</span><span>${b}</span></span>` : `<sup>${a}</sup>⁄<sub>${b}</sub>`)
  for (let i = 0; i < 3; i++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => frac(a, b))         // nested fractions resolve from the inside out
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_, a) => (stackedMode ? `√<span class="rt">${a}</span>` : `√(${a})`))
  s = s.replace(/\\([a-z]+)/gi, (m, k) => SYMBOLS[k] ?? m)
  s = s.replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>').replace(/(?<=[A-Za-z0-9)\]])\^(-?[0-9a-z]{1,3})(?![0-9a-z])/gi, '<sup>$1</sup>')
  s = s.replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>').replace(/(?<=[A-Za-z0-9)])_([0-9](?!_)|[a-z](?![_0-9A-Za-z]))/g, '<sub>$1</sub>')   // "____" blanks are left alone
  return s
}

export function mathToHtml(text) {
  const src = String(text ?? '')
  let out = '', last = 0
  IMG_RE.lastIndex = 0
  for (let m; (m = IMG_RE.exec(src));) {
    out += typeset(src.slice(last, m.index)) + `<img class="oi" src="${m[1]}" alt="">`
    last = m.index + m[0].length
  }
  IMG_RE.lastIndex = 0
  return out + typeset(src.slice(last))
}

export const MATH_CSS = `.fr{display:inline-block;vertical-align:middle;text-align:center;line-height:1.15;margin:0 1px}.fr>span{display:block;padding:0 2px}.fr>span:first-child{border-bottom:1px solid currentColor}
.rt{border-top:1px solid currentColor;padding:0 1px;margin-left:1px}sup,sub{line-height:0;font-size:72%}img.oi{max-height:24mm;max-width:100%;vertical-align:middle;display:inline-block}`
