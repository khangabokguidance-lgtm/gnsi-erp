// Question papers come in many Word layouts. Each one below must come out as 3 questions with 4 options each,
// answered A / B / C in the way the paper is typed. Covers typed labels AND Word's automatic numbering.
import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
globalThis.DOMParser = DOMParser
const { paragraphsFromDocx } = await import('../src/cbtDocs.js')
const { buildTest } = await import('../src/lib/cbtPaper.js')

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const p = (t, numPr = '') => `<w:p><w:pPr>${numPr}</w:pPr><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`
const num = (numId, ilvl) => `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`
async function docx(body, numberingXml = '', stylesXml = '') {
  const z = new JSZip()
  z.file('word/document.xml', `<?xml version="1.0"?><w:document ${NS}><w:body>${body}</w:body></w:document>`)
  if (numberingXml) z.file('word/numbering.xml', `<?xml version="1.0"?><w:numbering ${NS}>${numberingXml}</w:numbering>`)
  if (stylesXml) z.file('word/styles.xml', `<?xml version="1.0"?><w:styles ${NS}>${stylesXml}</w:styles>`)
  return z.generateAsync({ type: 'arraybuffer' })
}
const QS = [
  ['What is 2 + 2?', ['3', '4', '5', '6']],
  ['What is the capital of India?', ['Mumbai', 'New Delhi', 'Chennai', 'Kolkata']],
  ['Which is the largest number?', ['99', '101', '100', '98']],
]
const L = 'ABCD'
// layout helpers: label(i) for a question, opt(k, text) for an option line
async function read(data) {
  const lines = await paragraphsFromDocx(data, { convertBmei: false })
  return buildTest(lines).sections
}
function check(sections, label) {
  const qs = sections.flatMap(s => s.questions)
  assert.equal(qs.length, 3, `${label}: expected 3 questions, got ${qs.length}`)
  QS.forEach(([text, opts], i) => {
    assert.ok(qs[i].text.includes(text), `${label}: Q${i + 1} text was "${qs[i].text}"`)
    assert.equal(qs[i].options.length, 4, `${label}: Q${i + 1} has ${qs[i].options.length} options`)
    assert.deepEqual(qs[i].options.map(o => o.text), opts, `${label}: Q${i + 1} options`)
    assert.deepEqual(qs[i].options.map(o => o.key), ['A', 'B', 'C', 'D'], `${label}: Q${i + 1} option keys`)
  })
}
const typed = (q, o, oneLine = false) => QS.map(([t, opts], i) => p(q(i + 1, t)) + (oneLine ? p(opts.map((x, k) => o(k, x)).join('  ')) : opts.map((x, k) => p(o(k, x))).join(''))).join('')

test('typed: Q1. + (A)', async () => check(await read(await docx(typed((n, t) => `Q${n}. ${t}`, (k, x) => `(${L[k]}) ${x}`))), 'Q1. (A)'))
test('typed: 1. + A.', async () => check(await read(await docx(typed((n, t) => `${n}. ${t}`, (k, x) => `${L[k]}. ${x}`))), '1. A.'))
test('typed: 1) + a)', async () => check(await read(await docx(typed((n, t) => `${n}) ${t}`, (k, x) => `${L[k].toLowerCase()}) ${x}`))), '1) a)'))
test('typed: 1) + A) (no leading bracket)', async () => check(await read(await docx(typed((n, t) => `${n}) ${t}`, (k, x) => `${L[k]}) ${x}`))), '1) A)'))
test('typed: Q1: + (a)', async () => check(await read(await docx(typed((n, t) => `Q${n}: ${t}`, (k, x) => `(${L[k].toLowerCase()}) ${x}`))), 'Q1: (a)'))
test('typed: Question 1. + A)', async () => check(await read(await docx(typed((n, t) => `Question ${n}. ${t}`, (k, x) => `${L[k]}) ${x}`))), 'Question 1.'))
test('typed: Q.1 + (A)', async () => check(await read(await docx(typed((n, t) => `Q.${n} ${t}`, (k, x) => `(${L[k]}) ${x}`))), 'Q.1'))
test('typed: options four on one line, (A) x (B) y …', async () => check(await read(await docx(typed((n, t) => `Q${n}. ${t}`, (k, x) => `(${L[k]}) ${x}`, true))), 'one line (A)'))
test('typed: options four on one line, A) x B) y …', async () => check(await read(await docx(typed((n, t) => `${n}. ${t}`, (k, x) => `${L[k]}) ${x}`, true))), 'one line A)'))
test('typed: numeric options (1) (2) (3) (4)', async () => check(await read(await docx(typed((n, t) => `${n}. ${t}`, (k, x) => `(${k + 1}) ${x}`))), '(1)-(4)'))
test('typed: numeric options 1) 2) 3) 4) under Q labels', async () => check(await read(await docx(typed((n, t) => `Q${n}. ${t}`, (k, x) => `${k + 1}) ${x}`))), 'Q + 1)-4)'))

// Word's automatic numbering: the digits / letters are NOT in the paragraph text
const NUMBERING = `
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="(%2)"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>`
test('auto-numbered: 1. 2. 3. questions with (A) (B) (C) (D) options as a second level', async () => {
  const body = QS.map(([t, opts]) => p(t, num(1, 0)) + opts.map(x => p(x, num(1, 1))).join('')).join('')
  check(await read(await docx(body, NUMBERING)), 'auto 2-level')
})
const NUMBERING2 = `
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="Q%1."/></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%1)"/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="3"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>
  <w:num w:numId="4"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`
test('auto-numbered: questions in one list, each question\'s options in its own restarted list (a) b) c) d))', async () => {
  const body = QS.map(([t, opts], i) => p(t, num(1, 0)) + opts.map(x => p(x, num(i === 0 ? 2 : i === 1 ? 3 : 4, 0))).join('')).join('')
  check(await read(await docx(body, NUMBERING2)), 'auto separate lists')
})
test('auto-numbered: numbering set by a paragraph style', async () => {
  const styles = `<w:style w:type="paragraph" w:styleId="Qn"><w:name w:val="Qn"/><w:pPr>${num(1, 0)}</w:pPr></w:style>
                  <w:style w:type="paragraph" w:styleId="Opt"><w:name w:val="Opt"/><w:pPr>${num(1, 1)}</w:pPr></w:style>`
  const sp = (t, id) => `<w:p><w:pPr><w:pStyle w:val="${id}"/></w:pPr><w:r><w:t>${esc(t)}</w:t></w:r></w:p>`
  const body = QS.map(([t, opts]) => sp(t, 'Qn') + opts.map(x => sp(x, 'Opt')).join('')).join('')
  check(await read(await docx(body, NUMBERING, styles)), 'auto via style')
})
test('typed questions inside a Word table (number | text), options in the next rows', async () => {
  const cell = t => `<w:tc><w:p><w:r><w:t>${esc(t)}</w:t></w:r></w:p></w:tc>`
  const row = (a, b) => `<w:tr>${cell(a)}${cell(b)}</w:tr>`
  const body = `<w:tbl>${QS.map(([t, opts], i) => row(`${i + 1}.`, t) + opts.map((x, k) => row(`(${L[k]})`, x)).join('')).join('')}</w:tbl>`
  check(await read(await docx(body)), 'table rows')
})

// one paragraph per question, lines separated by a Word line break (Shift+Enter)
test('question and options in ONE paragraph separated by line breaks', async () => {
  const br = '</w:t></w:r><w:r><w:br/></w:r><w:r><w:t xml:space="preserve">'
  const body = QS.map(([t, opts], i) => `<w:p><w:r><w:t xml:space="preserve">${esc(`Q${i + 1}. ${t}`)}${opts.map((x, k) => br + esc(`(${L[k]}) ${x}`)).join('')}</w:t></w:r></w:p>`).join('')
  check(await read(await docx(body)), 'line breaks')
})
test('question and its four options all on ONE line', async () => {
  const body = QS.map(([t, opts], i) => p(`${i + 1}. ${t} ${opts.map((x, k) => `(${L[k]}) ${x}`).join(' ')}`)).join('')
  check(await read(await docx(body)), 'all inline')
})
test('question with options inline using A) B) C) D)', async () => {
  const body = QS.map(([t, opts], i) => p(`Q${i + 1}. ${t} ${opts.map((x, k) => `${L[k]}) ${x}`).join(' ')}`)).join('')
  check(await read(await docx(body)), 'all inline A)')
})
test('auto-numbered paper that also has section headings and directions', async () => {
  const body = p('SECTION - A MENTAL ABILITY') + p('Directions: Choose the correct answer.') + QS.map(([t, opts]) => p(t, num(1, 0)) + opts.map(x => p(x, num(1, 1))).join('')).join('')
  const s = await read(await docx(body, NUMBERING))
  check(s, 'auto + section'); assert.equal(s[0].label, 'A'); assert.match(s[0].directions, /correct answer/)
})
