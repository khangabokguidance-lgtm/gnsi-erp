// The font check reads fonts from the run, its styles and the document default, and spots untagged BMEI04 text.
import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
globalThis.DOMParser = DOMParser
const { fontReport, paragraphsFromDocx } = await import('../src/cbtDocs.js')

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
async function docx(bodyXml, stylesXml = '') {
  const z = new JSZip()
  z.file('word/document.xml', `<?xml version="1.0"?><w:document ${NS}><w:body>${bodyXml}</w:body></w:document>`)
  if (stylesXml) z.file('word/styles.xml', `<?xml version="1.0"?><w:styles ${NS}>${stylesXml}</w:styles>`)
  return z.generateAsync({ type: 'arraybuffer' })
}
const run = (t, font) => `<w:r>${font ? `<w:rPr><w:rFonts w:ascii="${font}"/></w:rPr>` : ''}<w:t>${t}</w:t></w:r>`

test('BMEI04 is found on the run itself', async () => {
  const d = await docx(`<w:p>${run('Q1. ', 'Arial')}${run('kmKPm', 'BMEI04')}</w:p>`)
  const r = await fontReport(d)
  assert.equal(r.bmeiRuns, 1)
  assert.deepEqual(r.fonts.map(f => f.name).sort(), ['Arial', 'BMEI04'])
})

test('BMEI04 set only by a paragraph style or the document default is still found and converted', async () => {
  const styles = '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:styleId="Mm"><w:rPr><w:rFonts w:ascii="BMEI04"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Mm2"><w:basedOn w:val="Mm"/></w:style>'
  const d = await docx(`<w:p><w:pPr><w:pStyle w:val="Mm2"/></w:pPr>${run('kmKPm')}</w:p><w:p>${run('plain')}</w:p>`, styles)
  const r = await fontReport(d)
  assert.equal(r.bmeiRuns, 1)
  const [a, b] = await paragraphsFromDocx(d)
  assert.notEqual(a.text, a.raw, 'styled BMEI04 text is converted')
  assert.equal(b.text, 'plain', 'other text is left alone')
})

test('untagged text that looks like BMEI04 keystrokes is reported; plain English is not', async () => {
  const d = await docx(`<w:p>${run('k[mK]P{m} |c@n #xy`z')}</w:p><w:p>${run('Choose the correct answer from the options below')}</w:p>`)
  const r = await fontReport(d)
  assert.equal(r.bmeiRuns, 0)
  assert.equal(r.suspects.length, 1)
  const [p] = await paragraphsFromDocx(d, { forceBmei: true })
  assert.notEqual(p.text, p.raw)
})
