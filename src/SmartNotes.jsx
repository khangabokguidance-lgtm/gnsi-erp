// Smart helpers for the study-material editors (Mission Foundation and Mission Sainik).
//   const smart = useSmartNotes({ body, setBody, flash })
//   {smart.bar}                       the toolbar: Smart format, Import Word, report, figure checklist
//   <textarea onPaste={smart.onPaste} />   pasting a question sheet is tidied on the way in
import { useMemo, useRef, useState } from 'react'
import { PX } from './premiumUI'
import { smartFormat, figureQuestions, insertFigureAfterQuestion, paragraphsToNotes } from './lib/smartNotes'
import { figureLine } from './lib/materialMarkup'
import { figFromFile } from './lib/figImage'
import { bmeiToUnicode } from './mayekSegments'
import { detectQuestions } from './lib/detectQuestions'

const tb = { padding: '6px 11px', borderRadius: 8, border: `1px solid ${PX.line}`, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

// A picture (data: URL) shrunk to the size figures are stored at.
async function shrink(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob()
  return figFromFile(new File([blob], 'figure', { type: blob.type || 'image/png' }), { maxW: 640, quality: 0.8 })
}

// HTML from Word / Google Docs → plain lines. Runs in the Bmei04 font are converted to Meetei Mayek (the font name
// travels with the pasted HTML even though the letters are Latin), and pictures that come as data: URLs become figure lines.
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = []
  let cur = ''
  const flush = () => { if (cur.trim()) out.push(cur.replace(/[  ]+/g, ' ').trim()); cur = '' }
  const isBmei = el => { for (let e = el; e && e !== doc.body; e = e.parentElement) { const f = (e.getAttribute?.('style') || '') + ' ' + (e.getAttribute?.('face') || ''); if (/bmei/i.test(f)) return true } return false }
  const BLOCK = /^(P|DIV|LI|TR|H[1-6]|BR|TABLE|UL|OL|BLOCKQUOTE)$/
  const walk = n => {
    if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' '); cur += isBmei(n.parentElement) ? bmeiToUnicode(t) : t; return }
    if (n.nodeType !== 1) return
    if (/^(STYLE|SCRIPT|HEAD)$/.test(n.tagName)) return
    if (n.tagName === 'IMG') { const src = n.getAttribute('src') || ''; if (/^data:image\//.test(src)) { flush(); out.push(figureLine(src, '')) } return }
    const block = BLOCK.test(n.tagName)
    if (block) flush()
    if (n.tagName === 'TD' || n.tagName === 'TH') cur += ' '
    n.childNodes.forEach(walk)
    if (block) flush()
  }
  walk(doc.body); flush()
  return out.join('\n')
}

export function useSmartNotes({ body, setBody, flash }) {
  const [report, setReport] = useState(null)
  const [undo, setUndo] = useState(null)
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const figs = useMemo(() => figureQuestions(body), [body])
  const missing = figs.filter(f => !f.hasFigure)
  const det = useMemo(() => detectQuestions(body), [body])   // does the text hold questions? shown live under the buttons

  const apply = (text, label) => {
    const r = smartFormat(text)
    setUndo(body); setReport({ ...r.report, label }); setBody(r.text)
  }
  const format = () => { if (!body.trim()) return flash?.('Paste or type your questions first.', true); apply(body, 'Smart format'); }

  const importWord = async file => {
    if (!file) return
    if (!/\.docx$/i.test(file.name)) return flash?.('Choose a Word (.docx) file. Old .doc files: open in Word and Save As .docx first.', true)
    setBusy(true)
    try {
      const { paragraphsFromDocx } = await import('./cbtDocs')
      const paras = await paragraphsFromDocx(await file.arrayBuffer(), { convertBmei: true })
      // shrink every picture once, keeping each with the paragraph it sat in
      for (const p of paras) for (const im of p.images || []) { try { im.dataUrl = await shrink(im.dataUrl) } catch { im.dataUrl = '' } }
      const text = paragraphsToNotes(paras.map(p => ({ ...p, images: (p.images || []).filter(i => i.dataUrl) })), d => figureLine(d, ''))
      if (!text.trim()) return flash?.('That Word file has no text to import.', true)
      const next = body.trim() ? body.replace(/\s+$/, '') + '\n\n' + text : text
      const r = smartFormat(next)
      setUndo(body); setReport({ ...r.report, label: `Imported ${file.name}` }); setBody(r.text)
    } catch (e) { flash?.('Could not read that file: ' + (e?.message || e), true) }
    setBusy(false)
  }

  const addFigure = async (q, file) => {
    try { setBody(insertFigureAfterQuestion(body, q.line, figureLine(await figFromFile(file, { maxW: 640, quality: 0.8 }), ''))) } catch (e) { flash?.(e.message, true) }
  }

  // Paste: Word/Docs HTML (Bmei04 fonts, pictures) or several lines of plain text are tidied before they land.
  const onPaste = e => {
    if (!auto) return
    const cd = e.clipboardData; if (!cd) return
    const html = cd.getData('text/html'), plain = cd.getData('text/plain') || ''
    const useHtml = html && (/bmei/i.test(html) || /<img[^>]+src="data:image/i.test(html))
    const text = useHtml ? htmlToText(html) : plain
    if (!useHtml && !/\n/.test(text.trim())) return          // a short one-line paste goes in as typed
    e.preventDefault()
    const el = e.currentTarget, a = el.selectionStart ?? body.length, b = el.selectionEnd ?? a
    const r = smartFormat(text)
    setUndo(body); setReport({ ...r.report, label: 'Smart paste' })
    setBody(body.slice(0, a) + r.text + body.slice(b))
  }

  const chips = report ? [
    report.questions && `${report.questions} question${report.questions === 1 ? '' : 's'}`,
    report.split && `${report.split} option line${report.split === 1 ? '' : 's'} split`,
    report.fractions && `${report.fractions} fraction${report.fractions === 1 ? '' : 's'}`,
    report.bmeiLines && `${report.bmeiLines} Meitei line${report.bmeiLines === 1 ? '' : 's'} converted`,
    report.headings && `${report.headings} heading${report.headings === 1 ? '' : 's'}`,
    report.joined && `${report.joined} wrapped line${report.joined === 1 ? '' : 's'} joined`,
  ].filter(Boolean) : []

  const bar = (
    <div style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 12, background: '#f4f8ff', border: '1px solid #cfe0f7' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <b style={{ fontSize: 13 }}>✨ Smart maker</b>
        <button type="button" style={{ ...tb, background: '#e4ebf6', borderColor: PX.navy }} onClick={format} title="Put each option on its own line, find fractions, Meitei text and figure questions">Smart format</button>
        <label style={{ ...tb, display: 'inline-flex', alignItems: 'center', opacity: busy ? .6 : 1 }} title="Import a Word file: Meitei Mayek (Bmei04) is converted and pictures stay with their question">
          {busy ? 'Reading…' : '📄 Import Word'}<input ref={fileRef} type="file" accept=".docx" aria-label="Import a Word file" disabled={busy} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; importWord(f) }} />
        </label>
        {undo != null && <button type="button" style={tb} onClick={() => { setBody(undo); setUndo(null); setReport(null) }}>↶ Undo</button>}
        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12.5, fontWeight: 600, marginLeft: 'auto' }}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Smart paste</label>
      </div>
      {det.kind !== 'empty' && <div role="status" aria-label="Question detection" style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, color: det.questions ? '#0f7a4c' : '#92400e' }}><b>🔎 Detected:</b> {det.text}</div>}
      {report && <div role="status" style={{ marginTop: 8, fontSize: 12.5, color: PX.ink, lineHeight: 1.5 }}><b>{report.label}:</b> {chips.length ? chips.join(' · ') : 'nothing needed changing'}</div>}
      {figs.length > 0 && (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: missing.length ? '#92400e' : '#0f7a4c' }}>{missing.length ? `Figures: ${missing.length} question${missing.length === 1 ? '' : 's'} need a picture` : 'Figures: all attached'}</div>
          {figs.map(f => (
            <div key={f.line} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
              <b style={{ minWidth: 34 }}>Q{f.no}</b>
              {f.hasFigure ? <span style={{ color: '#0f7a4c', fontWeight: 700 }}>✓ figure attached</span> : (
                <label style={{ ...tb, display: 'inline-flex', alignItems: 'center', background: '#fff7e6', borderColor: '#f1d9a8' }}>🖼 Add its figure<input type="file" accept="image/*" aria-label={`Add the figure for question ${f.no}`} style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) addFigure(f, file) }} /></label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
  return { bar, onPaste, format, report }
}
