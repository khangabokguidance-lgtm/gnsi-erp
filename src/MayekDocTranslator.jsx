// MayekDocTranslator.jsx — Question Bank → Language tools → Document Translator.
//
// An English question paper (Word .docx, a .txt file, or pasted text) is
// translated line by line into Meetei Mayek, checked and corrected on screen,
// and downloaded as a Word document with the institute letterhead, a paper
// details block and a watermark (mayekDocx.js builds the file).
//
// Translation goes through the same pipeline as the Mayek Tool
// (mayekTranslate.js): the school's dictionary first, then the offline
// translator when it is switched on, then the online services. New lines are
// saved to the Dictionary as drafts, and corrections made here can be saved
// back as reviewed entries.
import { useEffect, useMemo, useRef, useState } from 'react'
import { PX, PIcon } from './premiumUI'
import { getInstitute } from './systemSettings'
import { LOGO_BASE64 } from './logo'
import { NotoSansMeeteiMayek } from './NotoSansMeeteiMayek-normal.js'
import { translate, ENGINE_LABELS, saveTranslationDrafts, saveCorrections, offlineEnabled, setOfflineEnabled, offlineRunning } from './mayekTranslate'
import { readPaperFile, linesFromText, cleanLines, lineKind, buildMayekDocx, docxFileName, watermarkDataUrl, MAX_LINES, MAYEK_FONT } from './mayekDocx'

const LOGO_SRC = `data:image/jpeg;base64,${LOGO_BASE64}`
const SETTINGS_KEY = 'gnsi_mayek_doc_settings'
const CHUNK = 25 // lines per translation request
const MTEI = /[ꯀ-꯿]/

const loadSettings = () => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} } }
const instituteDefaults = () => {
  const i = getInstitute()
  return { name: i.name, short: i.short || 'GNSI', tagline: '', address: i.address, phone: i.phone, email: i.email, website: i.website }
}
const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const CSS = `
@font-face{font-family:'${MAYEK_FONT}';src:url(data:font/ttf;base64,${NotoSansMeeteiMayek}) format('truetype')}
.mdt{font-family:${PX.sans};color:${PX.ink}}
.mdt *{box-sizing:border-box}
.mdt-hero{position:relative;overflow:hidden;border-radius:20px;color:#fff;padding:20px 22px;margin-bottom:16px;background:radial-gradient(90% 140% at 100% 0%,rgba(184,146,58,.30) 0%,transparent 55%),linear-gradient(135deg,${PX.navyDeep} 0%,${PX.navy} 45%,${PX.navy2} 100%);box-shadow:0 20px 40px -24px rgba(19,42,79,.6)}
.mdt-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,${PX.gold},transparent)}
.mdt-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${PX.goldLt}}
.mdt-h1{font-family:${PX.serif};font-size:25px;font-weight:600;margin-top:3px;line-height:1.15}
.mdt-sub{font-size:12.5px;color:rgba(255,255,255,.68);margin-top:5px;max-width:640px;line-height:1.5}
.mdt-steps{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.mdt-step{display:inline-flex;align-items:center;gap:7px;padding:6px 12px 6px 6px;border-radius:99px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);font-size:12px;font-weight:700;color:rgba(255,255,255,.7)}
.mdt-step b{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12);font-size:11px}
.mdt-step.on{color:#fff;border-color:rgba(233,217,176,.6);background:rgba(233,217,176,.14)}
.mdt-step.on b{background:linear-gradient(180deg,#d4ae58,${PX.gold});color:#1a1406}
.mdt-step.done b{background:#0f7a4c;color:#fff}
.mdt-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}
@media (max-width:1100px){.mdt-grid{grid-template-columns:1fr}}
.mdt-card{background:#fff;border:1px solid ${PX.line};border-radius:18px;box-shadow:0 1px 2px rgba(19,42,79,.05),0 12px 30px -24px rgba(19,42,79,.4);margin-bottom:16px;overflow:hidden}
.mdt-card-h{display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid ${PX.line};background:linear-gradient(180deg,#fff,#fcfbf7)}
.mdt-card-h .bar{width:4px;height:20px;border-radius:4px;background:linear-gradient(180deg,${PX.gold},${PX.goldLt})}
.mdt-card-t{font-family:${PX.serif};font-size:16px;font-weight:600}
.mdt-card-s{font-size:11.5px;color:${PX.sub};margin-left:auto}
.mdt-body{padding:16px 18px}
.mdt-drop{border:2px dashed ${PX.line2};border-radius:16px;padding:26px 16px;text-align:center;background:${PX.tint};cursor:pointer;transition:border-color .15s,background .15s}
.mdt-drop:hover,.mdt-drop.over{border-color:${PX.gold};background:${PX.goldBg}}
.mdt-drop-ico{width:52px;height:52px;border-radius:16px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:${PX.goldLt}}
.mdt-drop b{display:block;font-size:14px}
.mdt-drop span{font-size:12px;color:${PX.sub}}
.mdt-or{display:flex;align-items:center;gap:10px;margin:14px 0;font-size:11px;font-weight:700;color:${PX.faint};text-transform:uppercase;letter-spacing:.12em}
.mdt-or::before,.mdt-or::after{content:'';flex:1;height:1px;background:${PX.line}}
.mdt-lbl{display:block;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${PX.sub};margin:0 0 5px}
.mdt-in{width:100%;padding:9px 12px;border:1px solid ${PX.line};border-radius:10px;font:500 13px ${PX.sans};color:${PX.ink};background:#fff}
.mdt-in:focus{outline:none;border-color:${PX.gold};box-shadow:0 0 0 4px rgba(184,146,58,.15)}
textarea.mdt-in{resize:vertical;line-height:1.5}
.mdt-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px}
.mdt-row.three{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:560px){.mdt-row,.mdt-row.three{grid-template-columns:1fr}}
.mdt-seg{display:flex;gap:4px;padding:4px;background:${PX.tint};border:1px solid ${PX.line};border-radius:12px;flex-wrap:wrap}
.mdt-seg button{flex:1;min-width:90px;border:0;border-radius:9px;padding:8px 10px;background:none;font:700 12px ${PX.sans};color:${PX.sub};cursor:pointer}
.mdt-seg button.on{background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:#fff;box-shadow:0 6px 14px -8px rgba(19,42,79,.7)}
.mdt-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:12px;border:0;cursor:pointer;font:800 13.5px ${PX.sans};background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:#fff;box-shadow:0 8px 18px -10px rgba(19,42,79,.8);white-space:nowrap}
.mdt-btn.gold{background:linear-gradient(180deg,#d4ae58,${PX.gold});color:#1a1406;box-shadow:0 8px 18px -10px rgba(184,146,58,.9)}
.mdt-btn.ghost{background:#fff;color:${PX.ink2};border:1px solid ${PX.line2};box-shadow:none}
.mdt-btn.sm{padding:7px 12px;font-size:12px;border-radius:10px}
.mdt-btn:disabled{opacity:.55;cursor:not-allowed}
.mdt-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;background:${PX.goldBg};color:#7a5a12}
.mdt-chip.ok{background:${PX.okBg};color:${PX.ok}}
.mdt-chip.warn{background:${PX.warnBg};color:${PX.warn}}
.mdt-progress{height:8px;border-radius:99px;background:${PX.tint};overflow:hidden;border:1px solid ${PX.line}}
.mdt-progress i{display:block;height:100%;background:linear-gradient(90deg,${PX.gold},#d4ae58);transition:width .3s}
.mdt-lines{max-height:620px;overflow:auto;border-top:1px solid ${PX.line}}
.mdt-line{display:grid;grid-template-columns:38px minmax(0,1fr) minmax(0,1.15fr) 34px;gap:10px;padding:9px 14px;border-bottom:1px solid #f1ede3;align-items:start}
.mdt-line.edited{background:#fffbeb}
.mdt-line.flag{background:#fff7f5}
.mdt-n{font-size:11px;font-weight:800;color:${PX.faint};padding-top:7px;text-align:right;font-variant-numeric:tabular-nums}
.mdt-en{font-size:12.5px;color:${PX.ink2};line-height:1.5;padding-top:6px;white-space:pre-wrap;word-break:break-word}
.mdt-en.q{font-weight:700;color:${PX.ink}}
.mdt-mm{width:100%;border:1px solid transparent;border-radius:9px;padding:5px 8px;font:16px/1.55 '${MAYEK_FONT}',${PX.sans};color:${PX.ink};background:transparent;resize:vertical;min-height:34px}
.mdt-mm:hover{border-color:${PX.line}}
.mdt-mm:focus{outline:none;border-color:${PX.gold};background:#fff}
.mdt-redo{border:0;background:none;color:${PX.faint};cursor:pointer;font-size:15px;padding:6px 4px;border-radius:8px}
.mdt-redo:hover{color:${PX.navy};background:${PX.tint}}
@media (max-width:640px){.mdt-line{grid-template-columns:1fr 30px}.mdt-n{display:none}.mdt-en{grid-column:1 / -1;padding-top:0}}
.mdt-sticky{position:sticky;top:12px}
.mdt-page{position:relative;aspect-ratio:1/1.414;background:#fff;border:1px solid ${PX.line};border-radius:6px;box-shadow:0 16px 36px -20px rgba(19,42,79,.5);padding:7% 7% 6%;overflow:hidden;font-size:7px;line-height:1.45}
.mdt-wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.mdt-wm img{width:92%}
.mdt-lh{display:flex;align-items:center;gap:7px;position:relative}
.mdt-lh img{width:26px;height:26px;object-fit:contain}
.mdt-lh b{display:block;font-size:10px;color:${PX.navy}}
.mdt-lh small{display:block;font-size:6px;color:${PX.sub}}
.mdt-rule{border-bottom:3px double ${PX.gold};margin:5px 0 7px}
.mdt-pt{text-align:center;font-weight:800;font-size:9px;margin-bottom:4px;position:relative}
.mdt-facts{display:flex;gap:2px;margin-bottom:6px;position:relative}
.mdt-facts span{flex:1;background:${PX.goldBg};border:1px solid ${PX.goldLine};text-align:center;padding:2px 1px;font-size:5.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mdt-pl{position:relative;font-family:'${MAYEK_FONT}',${PX.sans};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mdt-pl.q{font-weight:700;margin-top:3px}
.mdt-pl.o{padding-left:9%}
.mdt-pl.en{font-family:${PX.sans};color:${PX.sub};font-style:italic;font-size:5.5px}
.mdt-foot{position:absolute;left:7%;right:7%;bottom:3%;border-top:1px solid ${PX.line};padding-top:2px;display:flex;justify-content:space-between;font-size:5px;color:${PX.faint}}
.mdt-note{font-size:12px;color:${PX.sub};line-height:1.55}
.mdt-warn{padding:9px 12px;border-radius:10px;background:${PX.warnBg};border:1px solid #f1d9a6;color:${PX.warn};font-size:12px;margin-top:10px}
.mdt-check{display:flex;align-items:center;gap:7px;font-size:12px;color:${PX.sub};cursor:pointer}
`

function Card({ title, sub, children, right }) {
  return (
    <section className="mdt-card">
      <div className="mdt-card-h"><span className="bar" /><span className="mdt-card-t">{title}</span>{sub && <span className="mdt-card-s">{sub}</span>}{right}</div>
      <div className="mdt-body">{children}</div>
    </section>
  )
}

function PagePreview({ pairs, layout, inst, paper, watermark, showLogo }) {
  const sample = pairs.filter(p => p.en || p.mm).slice(0, layout === 'bilingual' ? 12 : 20)
  // The same watermark image the Word file gets.
  const [wm, setWm] = useState('')
  const wmText = watermark.text || inst.short || inst.name
  useEffect(() => {
    if (watermark.kind === 'none') return
    let live = true
    const t = setTimeout(() => {
      watermarkDataUrl({ kind: watermark.kind, text: wmText, logoSrc: LOGO_SRC, strength: watermark.strength })
        .then(u => { if (live) setWm(u) }).catch(() => {})
    }, 150)
    return () => { live = false; clearTimeout(t) }
  }, [watermark.kind, watermark.strength, wmText])
  const facts = [['Class', paper.klass], ['Subject', paper.subject], ['Date', paper.date], ['Time', paper.time], ['Marks', paper.marks]].filter(([, v]) => v)
  return (
    <div className="mdt-page" aria-label="Page preview">
      {watermark.kind !== 'none' && wm && <div className="mdt-wm"><img src={wm} alt="" /></div>}
      <div className="mdt-lh">
        {showLogo && <img src={LOGO_SRC} alt="" />}
        <div><b>{inst.name}</b><small>{inst.address}</small><small>{[inst.phone, inst.website].filter(Boolean).join(' · ')}</small></div>
      </div>
      <div className="mdt-rule" />
      {paper.title && <div className="mdt-pt">{paper.title}</div>}
      {paper.titleMayek && <div className="mdt-pt" style={{ fontFamily: `'${MAYEK_FONT}'`, color: PX.navy }}>{paper.titleMayek}</div>}
      {facts.length > 0 && <div className="mdt-facts">{facts.map(([k, v]) => <span key={k}>{k} {v}</span>)}</div>}
      {sample.length === 0 && <div className="mdt-pl" style={{ color: PX.faint, fontFamily: PX.sans }}>Your translated questions appear here.</div>}
      {sample.map((p, i) => {
        const k = lineKind(p.en || p.mm)
        return (
          <div key={i}>
            <div className={'mdt-pl' + (k === 'question' ? ' q' : k === 'option' ? ' o' : '')}>{p.mm || p.en}</div>
            {layout === 'bilingual' && p.en && p.mm && <div className={'mdt-pl en' + (k === 'option' ? ' o' : '')}>{p.en}</div>}
          </div>
        )
      })}
      <div className="mdt-foot"><span>{inst.name}</span><span>Page 1 of 1</span></div>
    </div>
  )
}

export default function MayekDocTranslator({ showToast, currentStaffId }) {
  const [saved] = useState(loadSettings)
  const [source, setSource] = useState(null) // { name, lines, pictures }
  const [pasted, setPasted] = useState('')
  const [over, setOver] = useState(false)
  const [pairs, setPairs] = useState([]) // { en, mm, machine, engine }
  const [busy, setBusy] = useState(null) // { label, done, total }
  const [warnings, setWarnings] = useState([])
  const [engines, setEngines] = useState({})
  const [layout, setLayout] = useState(saved.layout || 'mayek')
  const [inst, setInst] = useState(() => ({ ...instituteDefaults(), ...(saved.inst || {}) }))
  const [paper, setPaper] = useState({ title: '', titleMayek: '', klass: '', subject: '', date: today(), time: '', marks: '' })
  const [watermark, setWatermark] = useState(() => ({ kind: 'text', text: '', strength: 0.5, ...(saved.watermark || {}) }))
  const [showLogo, setShowLogo] = useState(saved.showLogo ?? true)
  const [offline, setOffline] = useState(offlineEnabled)
  const [offlineUp, setOfflineUp] = useState(null)
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const run = useRef(0)

  // Letterhead, watermark and layout choices are remembered on this computer.
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout, inst, watermark, showLogo })) } catch { /* private mode */ }
  }, [layout, inst, watermark, showLogo])
  useEffect(() => {
    if (!offline) return
    let live = true
    offlineRunning().then(ok => { if (live) setOfflineUp(ok) })
    return () => { live = false }
  }, [offline, busy])

  const lines = useMemo(() => cleanLines(source ? source.lines : linesFromText(pasted)), [source, pasted])
  const realLines = lines.filter(Boolean).length
  const step = pairs.length ? (busy ? 2 : 3) : realLines ? 2 : 1
  const edited = pairs.filter(p => p.machine != null && p.mm.trim() !== p.machine.trim() && p.en && MTEI.test(p.mm))
  const flagged = p => p.en && (!p.mm.trim() || (/[A-Za-z]{3,}/.test(p.mm) && !MTEI.test(p.mm)))
  const flaggedCount = pairs.filter(flagged).length

  const pickFile = async file => {
    if (!file) return
    try {
      const r = await readPaperFile(file)
      const ls = cleanLines(r.lines)
      if (!ls.some(Boolean)) { showToast('No text found in this file', PX.warn); return }
      setSource({ name: file.name, lines: ls, pictures: r.pictures })
      setPairs([]); setWarnings([])
      if (!paper.title) setPaper(p => ({ ...p, title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }))
    } catch (e) { showToast(e.message, PX.bad) }
  }

  // Translate in chunks of lines; a chunk whose reply doesn't keep one line
  // per line is redone line by line so every line stays paired.
  const translateAll = async () => {
    if (!realLines || busy) return
    if (realLines > MAX_LINES) { showToast(`This paper has ${realLines} lines; the limit is ${MAX_LINES}. Split it into parts.`, PX.warn); return }
    const id = ++run.current
    const out = lines.map(en => ({ en, mm: en ? '' : '', machine: en ? '' : null, engine: '' }))
    const idx = lines.map((l, i) => (l ? i : -1)).filter(i => i >= 0)
    const used = {}, warns = new Set()
    setPairs(out.map(p => ({ ...p }))); setWarnings([]); setEngines({})
    const one = async (text) => {
      const r = await translate(text, 'en', 'mni-Mtei')
      used[r.engine] = (used[r.engine] || 0) + 1
      r.warnings.forEach(w => warns.add(w))
      saveTranslationDrafts(r.pairs, r.engine, currentStaffId).catch(() => {})
      return r
    }
    try {
      if (!paper.titleMayek && paper.title) {
        const t = await one(paper.title).catch(() => null)
        if (t && MTEI.test(t.text)) setPaper(p => ({ ...p, titleMayek: t.text.trim() }))
      }
      for (let c = 0; c < idx.length; c += CHUNK) {
        if (id !== run.current) return
        const part = idx.slice(c, c + CHUNK)
        setBusy({ label: 'Translating', done: c, total: idx.length })
        const r = await one(part.map(i => lines[i]).join('\n'))
        let got = r.text.split('\n')
        if (got.length !== part.length) {
          got = []
          for (const i of part) got.push((await one(lines[i])).text.replace(/\n/g, ' '))
        }
        part.forEach((i, k) => { out[i] = { en: lines[i], mm: (got[k] || '').trim(), machine: (got[k] || '').trim(), engine: r.engine } })
        setPairs(out.map(p => ({ ...p })))
      }
      setEngines(used); setWarnings([...warns])
      showToast('Translated — check the lines, then download', PX.ok)
    } catch (e) {
      showToast('Translation failed: ' + e.message, PX.bad)
    } finally {
      if (id === run.current) setBusy(null)
    }
  }

  const redoLine = async i => {
    try {
      const r = await translate(pairs[i].en, 'en', 'mni-Mtei')
      setPairs(ps => ps.map((p, k) => (k === i ? { ...p, mm: r.text.replace(/\n/g, ' ').trim(), machine: r.text.replace(/\n/g, ' ').trim(), engine: r.engine } : p)))
    } catch (e) { showToast('Could not translate this line: ' + e.message, PX.bad) }
  }

  const saveFixes = async () => {
    if (!edited.length) return
    setSaving(true)
    try {
      const n = await saveCorrections(edited.map(p => ({ english: p.en, mayek: p.mm.trim() })), currentStaffId)
      setPairs(ps => ps.map(p => (edited.includes(p) ? { ...p, machine: p.mm } : p)))
      showToast(`Saved ${n} correction${n === 1 ? '' : 's'} to the Dictionary`, PX.ok)
    } catch (e) { showToast('Save failed: ' + e.message, PX.bad) }
    finally { setSaving(false) }
  }

  const download = async (which = layout) => {
    if (busy) return
    setBusy({ label: 'Making the Word file', done: 0, total: 0 })
    try {
      const list = pairs.length ? pairs : lines.map(en => ({ en, mm: '' }))
      const blob = await buildMayekDocx(list, { layout: which, institute: inst, paper, watermark, logoSrc: LOGO_SRC, showLogo })
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: docxFileName(paper, which === 'bilingual' ? 'Bilingual' : 'Mayek') })
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      showToast('Word file downloaded', PX.ok)
    } catch (e) {
      showToast('Could not make the Word file: ' + e.message, PX.bad)
    } finally { setBusy(null) }
  }

  const reset = () => { run.current++; setSource(null); setPasted(''); setPairs([]); setWarnings([]); setBusy(null); setPaper(p => ({ ...p, title: '', titleMayek: '' })) }
  const setI = k => e => setInst(v => ({ ...v, [k]: e.target.value }))
  const setP = k => e => setPaper(v => ({ ...v, [k]: e.target.value }))
  const pct = busy?.total ? Math.round((busy.done / busy.total) * 100) : 0
  const shown = pairs.map((p, i) => ({ ...p, i })).filter(p => p.en && (!onlyFlagged || flagged(p)))

  return (
    <div className="mdt">
      <style>{CSS}</style>
      <header className="mdt-hero">
        <div className="mdt-eyebrow">Mayek Tool · Document Translator</div>
        <div className="mdt-h1">English question paper → Meetei Mayek Word file</div>
        <div className="mdt-sub">Upload a Word or text file of questions, check the translation line by line, and download a ready-to-print .docx with your letterhead and watermark.</div>
        <div className="mdt-steps">
          {['Add the paper', 'Translate & check', 'Download'].map((s, k) => (
            <span key={s} className={'mdt-step' + (step === k + 1 ? ' on' : step > k + 1 ? ' done' : '')}><b>{step > k + 1 ? '✓' : k + 1}</b>{s}</span>
          ))}
        </div>
      </header>

      <div className="mdt-grid">
        <div>
          <Card title="1 · The English paper" sub={realLines ? `${realLines} line${realLines === 1 ? '' : 's'}` : 'Word .docx or .txt'}
            right={(source || pasted) && <button className="mdt-btn ghost sm" style={{ marginLeft: 10 }} onClick={reset}>Start again</button>}>
            {source ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="mdt-drop-ico" style={{ margin: 0, width: 44, height: 44 }}><PIcon.file size={22} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, wordBreak: 'break-all' }}>{source.name}</div>
                  <div className="mdt-note">{realLines} lines of text{source.pictures ? ` · ${source.pictures} picture${source.pictures === 1 ? '' : 's'} not carried over (add them in Word afterwards)` : ''}</div>
                </div>
                <button className="mdt-btn ghost sm" onClick={() => fileRef.current?.click()}>Choose another</button>
              </div>
            ) : (
              <>
                <div className={'mdt-drop' + (over ? ' over' : '')} role="button" tabIndex={0}
                  onClick={() => fileRef.current?.click()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
                  onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
                  onDrop={e => { e.preventDefault(); setOver(false); pickFile(e.dataTransfer.files?.[0]) }}>
                  <div className="mdt-drop-ico"><PIcon.download size={24} /></div>
                  <b>Drop a question paper here, or click to choose</b>
                  <span>Word (.docx) or text (.txt) · numbered lists and tables are read</span>
                </div>
                <div className="mdt-or">or paste the questions</div>
                <textarea className="mdt-in" rows={7} value={pasted} onChange={e => { setPasted(e.target.value); setPairs([]) }}
                  placeholder={'1. What is the capital of India?\n(a) Delhi  (b) Mumbai  (c) Kolkata  (d) Chennai\n2. Find the value of x if 2x + 3 = 11.'} />
              </>
            )}
            <input ref={fileRef} type="file" accept=".docx,.txt,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden
              onChange={e => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
          </Card>

          <Card title="2 · Translate & check" sub={pairs.length ? `${pairs.filter(p => p.en).length} lines` : ''}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button className="mdt-btn gold" onClick={translateAll} disabled={!realLines || !!busy}>
                <PIcon.pen size={16} />{pairs.length ? 'Translate again' : 'Translate to Meetei Mayek'}
              </button>
              <label className="mdt-check" title="Translates on this computer with no internet. Needs the offline translator program running here.">
                <input type="checkbox" checked={offline} onChange={e => { setOfflineEnabled(e.target.checked); setOfflineUp(null); setOffline(e.target.checked) }} />
                Use the offline translator on this computer
                {offline && <b style={{ color: offlineUp ? PX.ok : offlineUp === false ? PX.bad : PX.sub }}>{offlineUp ? '— running' : offlineUp === false ? '— not running' : '— checking…'}</b>}
              </label>
            </div>
            {busy && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: PX.sub, marginBottom: 6 }}>
                  <span>{busy.label}…</span>{busy.total > 0 && <span>{busy.done} / {busy.total} lines</span>}
                </div>
                <div className="mdt-progress"><i style={{ width: busy.total ? `${pct}%` : '100%' }} /></div>
              </div>
            )}
            {Object.keys(engines).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {Object.entries(engines).map(([e, n]) => <span key={e} className="mdt-chip">{ENGINE_LABELS[e] || e} · {n}</span>)}
                {flaggedCount > 0 ? <span className="mdt-chip warn">{flaggedCount} line{flaggedCount === 1 ? '' : 's'} to check</span> : <span className="mdt-chip ok">All lines in Meetei Mayek</span>}
              </div>
            )}
            {warnings.map(w => <div key={w} className="mdt-warn">⚠ {w}</div>)}
            {!pairs.length && !busy && (
              <p className="mdt-note" style={{ margin: '12px 0 0' }}>
                Lines already in your Dictionary are used exactly. The rest is machine translation — check every line before printing.
                New lines are kept in the Dictionary as drafts for a teacher to approve.
              </p>
            )}
          </Card>

          {pairs.length > 0 && (
            <section className="mdt-card">
              <div className="mdt-card-h" style={{ flexWrap: 'wrap' }}>
                <span className="bar" /><span className="mdt-card-t">Line by line</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {flaggedCount > 0 && <label className="mdt-check"><input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} />Only lines to check</label>}
                  {edited.length > 0 && <button className="mdt-btn sm" onClick={saveFixes} disabled={saving}>{saving ? 'Saving…' : `Save ${edited.length} correction${edited.length === 1 ? '' : 's'} to Dictionary`}</button>}
                </span>
              </div>
              <div className="mdt-lines">
                {shown.map(p => {
                  const k = lineKind(p.en)
                  const isEdited = p.machine != null && p.mm.trim() !== p.machine.trim()
                  return (
                    <div key={p.i} className={'mdt-line' + (isEdited ? ' edited' : flagged(p) ? ' flag' : '')}>
                      <span className="mdt-n">{p.i + 1}</span>
                      <div className={'mdt-en' + (k === 'question' || k === 'section' ? ' q' : '')}>{p.en}</div>
                      <textarea className="mdt-mm" rows={Math.max(1, Math.ceil((p.mm || '').length / 46))} value={p.mm} aria-label={`Meetei Mayek for line ${p.i + 1}`}
                        placeholder={busy ? '…' : 'Type the Meetei Mayek'}
                        onChange={e => { const v = e.target.value; setPairs(ps => ps.map((x, j) => (j === p.i ? { ...x, mm: v } : x))) }} />
                      <button className="mdt-redo" title="Translate this line again" aria-label={`Translate line ${p.i + 1} again`} onClick={() => redoLine(p.i)} disabled={!!busy}>↻</button>
                    </div>
                  )
                })}
                {!shown.length && <div className="mdt-note" style={{ padding: 16 }}>Nothing to check.</div>}
              </div>
            </section>
          )}
        </div>

        <aside className="mdt-sticky">
          <Card title="3 · Paper & letterhead">
            <label className="mdt-lbl">Paper title</label>
            <input className="mdt-in" value={paper.title} onChange={setP('title')} placeholder="e.g. Unit Test 2 — Mathematics" style={{ marginBottom: 8 }} />
            <input className="mdt-in" value={paper.titleMayek} onChange={setP('titleMayek')} placeholder="Title in Meetei Mayek (filled in when you translate)" style={{ marginBottom: 10, fontFamily: `'${MAYEK_FONT}',${PX.sans}` }} />
            <div className="mdt-row three">
              <div><label className="mdt-lbl">Class</label><input className="mdt-in" value={paper.klass} onChange={setP('klass')} placeholder="VI" /></div>
              <div><label className="mdt-lbl">Subject</label><input className="mdt-in" value={paper.subject} onChange={setP('subject')} placeholder="Maths" /></div>
              <div><label className="mdt-lbl">Date</label><input className="mdt-in" value={paper.date} onChange={setP('date')} /></div>
            </div>
            <div className="mdt-row">
              <div><label className="mdt-lbl">Time</label><input className="mdt-in" value={paper.time} onChange={setP('time')} placeholder="1 hr 30 min" /></div>
              <div><label className="mdt-lbl">Full marks</label><input className="mdt-in" value={paper.marks} onChange={setP('marks')} placeholder="50" /></div>
            </div>

            <label className="mdt-lbl" style={{ marginTop: 6 }}>Layout</label>
            <div className="mdt-seg" style={{ marginBottom: 12 }}>
              {[['mayek', 'Meetei Mayek only'], ['bilingual', 'Mayek + English']].map(([k, l]) => <button key={k} className={layout === k ? 'on' : ''} onClick={() => setLayout(k)}>{l}</button>)}
            </div>

            <label className="mdt-lbl">Watermark</label>
            <div className="mdt-seg" style={{ marginBottom: 8 }}>
              {[['text', 'Name'], ['logo', 'Logo'], ['none', 'None']].map(([k, l]) => <button key={k} className={watermark.kind === k ? 'on' : ''} onClick={() => setWatermark(w => ({ ...w, kind: k }))}>{l}</button>)}
            </div>
            {watermark.kind === 'text' && <input className="mdt-in" value={watermark.text} onChange={e => setWatermark(w => ({ ...w, text: e.target.value }))} placeholder={`Watermark text (default: ${inst.short || inst.name})`} style={{ marginBottom: 8 }} />}
            {watermark.kind !== 'none' && (
              <label className="mdt-check" style={{ marginBottom: 12 }}>Strength
                <input type="range" min="0" max="1" step="0.05" value={watermark.strength} onChange={e => setWatermark(w => ({ ...w, strength: +e.target.value }))} style={{ flex: 1 }} />
              </label>
            )}

            <details>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: PX.navy, margin: '4px 0 10px' }}>Institute details on the letterhead</summary>
              <label className="mdt-check" style={{ marginBottom: 10 }}><input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} />Show the logo</label>
              <label className="mdt-lbl">Name</label><input className="mdt-in" value={inst.name} onChange={setI('name')} style={{ marginBottom: 8 }} />
              <div className="mdt-row">
                <div><label className="mdt-lbl">Short name</label><input className="mdt-in" value={inst.short} onChange={setI('short')} /></div>
                <div><label className="mdt-lbl">Phone</label><input className="mdt-in" value={inst.phone} onChange={setI('phone')} /></div>
              </div>
              <label className="mdt-lbl">Tagline</label><input className="mdt-in" value={inst.tagline} onChange={setI('tagline')} placeholder="optional" style={{ marginBottom: 8 }} />
              <label className="mdt-lbl">Address</label><input className="mdt-in" value={inst.address} onChange={setI('address')} style={{ marginBottom: 8 }} />
              <div className="mdt-row">
                <div><label className="mdt-lbl">Email</label><input className="mdt-in" value={inst.email} onChange={setI('email')} /></div>
                <div><label className="mdt-lbl">Website</label><input className="mdt-in" value={inst.website} onChange={setI('website')} /></div>
              </div>
              <button className="mdt-btn ghost sm" onClick={() => setInst(instituteDefaults())}>Use System Settings details</button>
            </details>
          </Card>

          <Card title="Preview" sub="first page">
            <PagePreview pairs={pairs.length ? pairs : lines.map(en => ({ en, mm: '' }))} layout={layout} inst={inst} paper={paper} watermark={watermark} showLogo={showLogo} />
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              <button className="mdt-btn gold" onClick={() => download()} disabled={!pairs.some(p => p.mm) || !!busy}>
                <PIcon.download size={16} />Download Word file (.docx)
              </button>
              {pairs.some(p => p.mm) && flaggedCount > 0 && <div className="mdt-note" style={{ color: PX.warn }}>{flaggedCount} line{flaggedCount === 1 ? ' is' : 's are'} not in Meetei Mayek yet — they print as they are.</div>}
              {!pairs.length && <div className="mdt-note">Translate the paper first; the Word file is made from the checked lines.</div>}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
