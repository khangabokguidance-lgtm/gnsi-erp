// cbtDocs.js — read a question paper .docx for the CBT Exam builder.
//   paragraphsFromDocx: every paragraph as { text, raw }. Runs typed in the old BMEI04 font are
//     converted to Unicode Meetei Mayek (only those runs — English words, numbers and the (A) (B)
//     labels in other fonts are kept as typed); raw is the text exactly as stored.
//   imagesFromDocx: the pictures, in the order they appear on the page (figure questions).
import JSZip from 'jszip'
import { bmeiToUnicode } from './mayekSegments'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' }

const isBmei = el => {
  const f = el.getElementsByTagNameNS(W_NS, 'rFonts')[0]
  const name = f && (f.getAttributeNS(W_NS, 'ascii') || f.getAttribute('w:ascii') || f.getAttributeNS(W_NS, 'hAnsi') || f.getAttribute('w:hAnsi') || '')
  return /bmei/i.test(name || '')
}

async function open(data) {
  const zip = await JSZip.loadAsync(data)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('This is not a Word document (.docx).')
  return { zip, doc: new DOMParser().parseFromString(xml, 'application/xml') }
}

export async function paragraphsFromDocx(data, { convertBmei = true } = {}) {
  const { doc } = await open(data)
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0]
  if (!body) return []
  const out = []
  for (const p of Array.from(body.getElementsByTagNameNS(W_NS, 'p'))) {
    let skip = false
    for (let n = p.parentNode; n && n !== body; n = n.parentNode) if (n.localName === 'Fallback') { skip = true; break }
    if (skip) continue
    const pieces = []
    const push = (text, bmei) => {
      if (!text) return
      const last = pieces[pieces.length - 1]
      if (last && last.bmei === bmei) last.text += text
      else pieces.push({ text, bmei })
    }
    const walk = el => {
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType !== 1) continue
        const n = c.localName
        if (n === 'pPr' || n === 'rPr' || n === 'txbxContent' || n === 'Fallback' || n === 'p') continue
        if (n === 'r') {
          const bmei = isBmei(c)
          let t = ''
          for (const k of Array.from(c.childNodes)) {
            if (k.nodeType !== 1) continue
            if (k.localName === 't') t += k.textContent
            else if (k.localName === 'tab' || k.localName === 'br' || k.localName === 'cr') t += ' '
          }
          push(t, bmei)
        } else walk(c)
      }
    }
    walk(p)
    const raw = pieces.map(x => x.text).join('')
    const text = pieces.map(x => (x.bmei && convertBmei ? bmeiToUnicode(x.text) : x.text)).join('')
    // A row of dots typed as a blank (…………) comes out of BMEI04 as a row of Lum Iyek marks; show it as a blank line.
    const tidy = t => t.replace(/\s+/g, ' ').trim()
    out.push({ text: tidy(text.replace(/\uABEC{3,}/g, '________')), raw: tidy(raw) })
  }
  return out
}

// Pictures in reading order: [{ name, mime, dataUrl }]
export async function imagesFromDocx(data) {
  const { zip, doc } = await open(data)
  const rels = await zip.file('word/_rels/document.xml.rels')?.async('string')
  const targets = new Map()
  if (rels) {
    const rd = new DOMParser().parseFromString(rels, 'application/xml')
    for (const r of Array.from(rd.getElementsByTagName('Relationship'))) targets.set(r.getAttribute('Id'), r.getAttribute('Target'))
  }
  const out = []
  for (const blip of Array.from(doc.getElementsByTagNameNS(A_NS, 'blip'))) {
    const id = blip.getAttributeNS(R_NS, 'embed') || blip.getAttribute('r:embed')
    let target = targets.get(id)
    if (!target) continue
    target = target.replace(/^\//, '')
    const path = target.startsWith('word/') ? target : `word/${target}`
    const f = zip.file(path)
    if (!f) continue
    const ext = path.split('.').pop().toLowerCase()
    const mime = MIME[ext]
    if (!mime) continue
    out.push({ name: path.split('/').pop(), mime, dataUrl: `data:${mime};base64,${await f.async('base64')}` })
  }
  return out
}
