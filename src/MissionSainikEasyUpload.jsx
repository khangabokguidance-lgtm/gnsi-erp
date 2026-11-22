// MissionSainikEasyUpload.jsx — "Easy upload": the shortest path for a setter on a phone.
//   1 tap your section  →  2 paste the questions (and the answer key if it is separate)  →  3 press Upload.
// Light on data (no images), big tap targets, 16px text (no zoom on phones), plain-language checking.
// The parent owns the draft text (it is already saved per test and section) and does the real upload.
import { useEffect, useMemo, useState } from 'react'
import { PX } from './premiumUI'
import { parseWithKey, friendlyErrors } from './lib/missionSainikQuestions'

const EXAMPLE = 'Q1. What is 3/4 + 1/4?\nA) 1/2\nB) 1\nC) 3/4\nD) 2\nAns: B\n\nQ2. Capital of India?\n(a) Mumbai (b) Delhi\n(c) Kolkata (d) Chennai\nAns: B'
const box = { width: '100%', boxSizing: 'border-box', border: `1.5px solid ${PX.line}`, borderRadius: 12, padding: '12px', fontSize: 16, fontFamily: 'inherit', background: '#fff', color: PX.ink, outline: 'none' }
const bigBtn = (on, tone = PX.navy) => ({ minHeight: 48, padding: '0 16px', borderRadius: 14, border: `1.5px solid ${on ? tone : PX.line}`, background: on ? tone : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' })

// sections: [{ t, label, short, have, need }] — the person's own sections (everything of this test for an admin)
const SEEN_KEY = 'msb-easy-seen'
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false } }
const writeSeen = () => { try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ } }

// paper (admin only, optional): { ready, total, have, need } for the test being built; onPreview / onPrint open the assembled paper.
export default function MissionSainikEasyUpload({ sections = [], testNo, section, tid, onPick, text, setText, onUpload, onFile, mayEdit, why = '', busy = false, paper = null, onPreview, onPrint }) {
  const [keyText, setKeyText] = useState('')
  const [open, setOpen] = useState(true)
  const [help, setHelp] = useState(false)
  const [seen, setSeen] = useState(readSeen)   // the 3-step guide shows until the person taps 'Got it'
  const [added, setAdded] = useState(0)        // how many were just uploaded (drives the 'done' panel)
  useEffect(() => { if (text.trim()) setAdded(0) }, [text])
  const cur = sections.find(x => x.t === testNo && x.label === section)
  const parsed = useMemo(() => parseWithKey(text, keyText), [text, keyText])
  const problems = friendlyErrors(parsed.errors)
  const n = parsed.questions.length
  const keyCount = useMemo(() => new Set([...String(keyText).matchAll(/(\d+)\s*[.):\-–]?\s*\(?([A-Da-d])\)?(?![a-z])/g)].map(m => m[1])).size, [keyText])
  const left = cur ? Math.max(0, cur.need - cur.have) : 0

  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) setText(x => (x.trim() ? x.replace(/\s+$/, '') + '\n\n' : '') + t) } catch { /* the browser asked and was refused: the box below still works with a long-press paste */ }
  }
  const go = async () => { const k = parsed.questions.length; if (await onUpload(parsed.questions)) { setKeyText(''); setAdded(k); window.scrollTo?.({ top: document.getElementById('msb-easy')?.offsetTop ? Math.max(0, document.getElementById('msb-easy').getBoundingClientRect().top + window.scrollY - 70) : 0, behavior: 'smooth' }) } }
  const nextSec = sections.find(x => !(x.t === testNo && x.label === section) && x.have < x.need)
  const doneCount = sections.filter(x => x.have >= x.need).length
  const guide = !seen || help

  if (!sections.length) return null
  return (
    <div id="msb-easy" style={{ margin: '0 0 12px', scrollMarginTop: 70, borderRadius: 18, border: '2px solid #e2c57e', background: 'linear-gradient(180deg,#fffaf0,#fff)', overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
        <span style={{ fontSize: 22 }}>⚡</span><span style={{ flex: 1 }}><b style={{ color: PX.navy, fontSize: 16 }}>Easy upload</b><div style={{ fontSize: 12.5, color: PX.sub }}>Tap your section · paste · upload</div></span><span style={{ color: PX.sub }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
          {guide && (
            <div role="note" style={{ padding: '12px 14px', borderRadius: 14, background: '#eef4ff', border: '1px solid #cfdcf7', color: PX.navy, fontSize: 14.5, lineHeight: 1.5 }}>
              <b>New here? It takes 3 steps.</b>
              <ol style={{ margin: '6px 0 8px', paddingLeft: 20 }}>
                <li><b>Tap your section</b> (it shows how many questions are done).</li>
                <li><b>Paste your questions</b> from Word or WhatsApp. If the answers are in a separate list, paste them in the small box.</li>
                <li><b>Press Upload.</b> If something is missing, it tells you exactly what to add.</li>
              </ol>
              <pre style={{ margin: '0 0 8px', padding: 8, borderRadius: 10, background: '#fff', border: `1px solid ${PX.line}`, fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{EXAMPLE}</pre>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={bigBtn(false)} onClick={() => { setText(x => (x.trim() ? x : EXAMPLE)); setHelp(false) }}>▶ Try the example</button>
                <button type="button" style={bigBtn(true)} onClick={() => { writeSeen(); setSeen(true); setHelp(false) }}>Got it</button>
              </div>
            </div>
          )}
          {paper && (
            <div style={{ padding: '10px 12px', borderRadius: 14, background: '#fff', border: `1px solid ${PX.line}` }}>
              <div style={{ fontSize: 14, color: PX.ink }}><b>{tid(testNo)}</b> paper: <b>{paper.ready} of {paper.total}</b> subjects complete · {paper.have} of {paper.need} questions</div>
              <div style={{ height: 8, borderRadius: 4, background: '#eef1f6', overflow: 'hidden', margin: '6px 0 8px' }}><div style={{ width: Math.min(100, paper.need ? (paper.have / paper.need) * 100 : 0) + '%', height: '100%', background: paper.ready >= paper.total ? '#0f7a4c' : '#b8923a' }} /></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={bigBtn(false)} onClick={onPreview}>👁 See paper</button>
                <button type="button" style={bigBtn(paper.ready >= paper.total, '#0f7a4c')} onClick={onPrint}>🖨 Print paper</button>
              </div>
            </div>
          )}
          {!paper && sections.length > 1 && <div style={{ fontSize: 13.5, color: PX.sub }}>You have finished <b style={{ color: PX.navy }}>{doneCount} of {sections.length}</b> sections{doneCount === sections.length ? ' 🎉' : ''}.</div>}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub, marginBottom: 6 }}>1 · Your section</div>
            <div role="tablist" aria-label="Choose your section" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
              {sections.map(x => {
                const on = x.t === testNo && x.label === section, done = x.have >= x.need
                return <button key={x.t + '|' + x.label} type="button" role="tab" aria-selected={on} onClick={() => onPick(x.t, x.label)} style={{ ...bigBtn(on), flex: '0 0 auto', textAlign: 'left', lineHeight: 1.25, padding: '8px 14px', borderColor: on ? PX.navy : done ? '#0f7a4c' : PX.line }}>
                  {tid(x.t)} · {x.short}<div style={{ fontSize: 12, fontWeight: 700, opacity: .85 }}>{x.have}/{x.need}{done ? ' ✓' : ''}</div>
                </button>
              })}
            </div>
            {cur && <div style={{ fontSize: 14, color: PX.ink, marginTop: 4 }}>Adding to <b>{tid(cur.t)} · {cur.label}</b> — {cur.have} of {cur.need} done{left ? <> · <b>{left} to go</b></> : ' ✓'}</div>}
          </div>

          {added > 0 && !text.trim() && (
            <div role="status" aria-live="polite" style={{ padding: '14px', borderRadius: 14, background: '#e6f4ea', border: '1px solid #b9dfc5', color: '#0f5d3a' }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>✅ {added} question{added === 1 ? '' : 's'} uploaded</div>
              {cur && <div style={{ fontSize: 14, marginTop: 2 }}>{cur.label}: {cur.have >= cur.need ? 'complete ✓' : `${cur.have} of ${cur.need} done`}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {nextSec && <button type="button" style={{ ...bigBtn(true, '#b8923a'), flex: '1 1 200px' }} onClick={() => { setAdded(0); onPick(nextSec.t, nextSec.label) }}>Next: {tid(nextSec.t)} · {nextSec.short} →</button>}
                <button type="button" style={bigBtn(false)} onClick={() => setAdded(0)}>Add more here</button>
              </div>
            </div>
          )}
          {!mayEdit ? <div role="status" style={{ padding: '10px 12px', borderRadius: 12, background: '#fff6dc', border: '1px solid #e9d9b0', color: '#5c4510', fontSize: 14 }}>🔒 {why || 'You cannot upload to this section.'}</div> : <>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub, marginBottom: 6 }}>2 · Paste your questions</div>
              <textarea aria-label="Paste your questions" rows={7} value={text} onChange={e => setText(e.target.value)} placeholder={'Paste here. Each question: the question, options A–D, then Ans: B'} style={{ ...box, resize: 'vertical', minHeight: 150 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" style={bigBtn(false)} onClick={paste}>📋 Paste</button>
                <label style={{ ...bigBtn(false), display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>📂 Open file<input type="file" accept=".txt,.csv,text/plain,text/csv" aria-label="Open a .txt or .csv file" style={{ display: 'none' }} onChange={onFile} /></label>
                {text.trim() && <button type="button" style={bigBtn(false)} onClick={() => { if (window.confirm('Clear what you pasted?')) { setText(''); setKeyText('') } }}>✕ Clear</button>}
                <button type="button" style={{ ...bigBtn(false), borderStyle: 'dashed' }} aria-expanded={guide} onClick={() => setHelp(h => !h)}>❓ Help</button>
              </div>
                          </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub, marginBottom: 6 }}>Answers separate? (optional)</div>
              <textarea aria-label="Answer key" rows={2} value={keyText} onChange={e => setKeyText(e.target.value)} placeholder="1-C 2-B 3-A 4-D …" style={box} />
              {keyText.trim() && <div style={{ fontSize: 13.5, marginTop: 4, color: keyCount ? '#0f7a4c' : PX.bad }}>{keyCount ? `🔑 ${keyCount} answer(s) read` : 'No answers found — write them like 1-C 2-B 3-A'}</div>}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub, marginBottom: 6 }}>3 · Upload</div>
              {text.trim() && <div role="status" aria-live="polite" style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 12, background: problems.length ? '#fdecea' : n ? '#e6f4ea' : '#f4f6fa', color: problems.length ? PX.bad : n ? '#0f7a4c' : PX.sub, fontSize: 14.5, fontWeight: 600 }}>
                {n > 0 && <div>✅ {n} question{n === 1 ? '' : 's'} ready{cur && n > left && left ? ` (more than the ${left} still needed — you will be asked)` : ''}</div>}
                {problems.length > 0 && <div>⚠ {problems.length} to fix{problems.length > 1 ? '' : ''}:{problems.slice(0, 4).map((p, i) => <div key={i}>• {p}</div>)}{problems.length > 4 && <div>• and {problems.length - 4} more</div>}</div>}
                {!n && !problems.length && <div>Nothing found yet — tap ❓ Help to see an example.</div>}
              </div>}
              <button type="button" disabled={busy || !n || problems.length > 0} onClick={go} style={{ ...bigBtn(true, '#b8923a'), width: '100%', minHeight: 54, fontSize: 17, opacity: busy || !n || problems.length ? .55 : 1 }}>{busy ? 'Uploading…' : n ? `⬆ Upload ${n} question${n === 1 ? '' : 's'}` : '⬆ Upload'}</button>
              {problems.length > 0 && <div style={{ fontSize: 12.5, color: PX.sub, marginTop: 6 }}>Fix the points above first, then the button turns on. Nothing is half-saved.</div>}
            </div>
          </>}
        </div>
      )}
    </div>
  )
}
