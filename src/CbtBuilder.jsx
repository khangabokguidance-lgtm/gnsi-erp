// CbtBuilder.jsx — make (or edit) a CBT test: read the English and Meitei Mayek question papers (.docx),
// check what was found, set the marking and the answer key, save.
import { useMemo, useRef, useState } from 'react'
import { paragraphsFromDocx, imagesFromDocx, picHash } from './cbtDocs'
import { buildTest, attachImages } from './lib/cbtPaper'
import { DEFAULT_INSTRUCTIONS, parseKey, keyStatus } from './lib/cbtEngine'
import { verifyTest } from './lib/cbtVerify'
import { newTestId } from './cbtStore'

const nice = name => String(name || '').replace(/\.docx$/i, '').replace(/^[0-9a-f]{6,}[-_]/i, '').replace(/[_-]+/g, ' ').trim()
const clone = o => JSON.parse(JSON.stringify(o))

export default function CbtBuilder({ initial, onSave, onCancel }) {
  const editing = !!initial
  const [name, setName] = useState(initial?.name || '')
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 120)
  const [correct, setCorrect] = useState(initial?.marking?.correct ?? 1.25)
  const [wrong, setWrong] = useState(initial?.marking?.wrong ?? 0)
  const [instructions, setInstructions] = useState(initial?.instructions ?? DEFAULT_INSTRUCTIONS)
  const [showResult, setShowResult] = useState(initial?.showResult !== false)
  const [showAnswers, setShowAnswers] = useState(initial?.showAnswers !== false)
  const [sections, setSections] = useState(() => (initial ? clone(initial.sections) : []))
  const [warnings, setWarnings] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [keyText, setKeyText] = useState('')
  const [keyMsg, setKeyMsg] = useState([])
  const [reviewNo, setReviewNo] = useState(null)
  const [swapWith, setSwapWith] = useState('')
  const en = useRef(null), mm = useRef(null)

  const qs = useMemo(() => sections.flatMap(s => s.questions), [sections])
  const ks = keyStatus({ sections })
  const report = useMemo(() => verifyTest(sections), [sections])
  const flagged = report.items.filter(i => i.status !== 'ok' || i.reviewed)
  const rq = reviewNo ? qs.find(x => x.no === reviewNo) : null

  const read = async () => {
    setError('')
    const f = en.current?.files?.[0], g = mm.current?.files?.[0]
    if (!f) { setError('Choose the English question paper (.docx) first.'); return }
    for (const x of [f, g].filter(Boolean)) if (!/\.docx$/i.test(x.name)) { setError(`"${x.name}" is not a .docx file. Open it in Word and use Save As → .docx.`); return }
    if (sections.length && !window.confirm('Reading the papers again replaces the questions below, including any fixes you made here. Answers already keyed are kept by question number. Continue?')) return
    setBusy('Reading the papers…')
    try {
      const [enL, mmL, imgs] = await Promise.all([paragraphsFromDocx(await f.arrayBuffer()), g ? paragraphsFromDocx(await g.arrayBuffer()) : null, imagesFromDocx(await f.arrayBuffer())])
      const t = buildTest(enL, mmL)
      if (!t.sections.length) throw new Error('No questions were found. Questions should start like "Q1." with options (A) (B) (C) (D).')
      const w = attachImages(t.sections, imgs)
      if (!imgs.length && !t.sections.some(s => s.questions.some(q => q.figure))) w.length = 0
      // keep the answers already entered for questions with the same number
      const old = new Map(qs.map(q => [q.no, q.answer]))
      t.sections.forEach(s => s.questions.forEach(q => { q.answer = old.get(q.no) || null }))
      setSections(t.sections); setWarnings([...t.warnings, ...w])
      if (!name) setName(nice(f.name))
    } catch (e) { setError(e.message || 'Could not read the paper.') }
    setBusy('')
  }

  const setAnswer = (no, key) => setSections(ss => ss.map(s => ({ ...s, questions: s.questions.map(q => (q.no === no ? { ...q, answer: q.answer === key ? null : key } : q)) })))
  // Fix a question in place: text, options, passage, pictures.
  const patchQ = (no, f) => setSections(ss => ss.map(s => ({ ...s, questions: s.questions.map(q => (q.no === no ? { ...q, ...(typeof f === 'function' ? f(q) : f), reviewed: false } : q)) })))
  const patchOpt = (no, key, patch) => patchQ(no, q => ({ options: q.options.map(o => (o.key === key ? { ...o, ...patch } : o)) }))
  const markReviewed = no => setSections(ss => ss.map(s => ({ ...s, questions: s.questions.map(q => (q.no === no ? { ...q, reviewed: true } : q)) })))
  const picsOf = q => (q.images?.length ? q.images : q.image ? [q.image] : [])
  const setPics = (no, pics) => patchQ(no, { images: pics, image: pics[0] || null, figHash: pics.map(picHash), figHashMm: pics.map(picHash) })   // a hand-set picture is the admin's decision
  const readPic = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file) })
  const replacePic = async (no, file) => { if (file && /^image\//.test(file.type)) setPics(no, [await readPic(file)]) }
  const swapPics = (a, b) => {
    const A = qs.find(x => x.no === a), B = qs.find(x => x.no === b)
    if (!A || !B) return
    const pa = picsOf(A), pb = picsOf(B)
    setSections(ss => ss.map(sc => ({ ...sc, questions: sc.questions.map(q => (q.no === a ? { ...q, images: pb, image: pb[0] || null, figHash: pb.map(picHash), figHashMm: pb.map(picHash), reviewed: false } : q.no === b ? { ...q, images: pa, image: pa[0] || null, figHash: pa.map(picHash), figHashMm: pa.map(picHash), reviewed: false } : q)) })))
    setSwapWith('')
  }
  const applyKey = () => {
    const { key, errors } = parseKey(keyText, qs.map(q => q.no))
    setKeyMsg(errors)
    if (!Object.keys(key).length) return
    setSections(ss => ss.map(s => ({ ...s, questions: s.questions.map(q => (key[q.no] ? { ...q, answer: key[q.no] } : q)) })))
  }

  const save = async () => {
    if (!name.trim()) { setError('Give the test a name.'); return }
    if (!sections.length) { setError('Read a question paper first.'); return }
    if (!(durationMin > 0)) { setError('Enter the duration in minutes.'); return }
    if (report.counts.error && !window.confirm(`${report.counts.error} question${report.counts.error === 1 ? ' has' : 's have'} errors in the smart check (a missing picture, option or text). Save the test anyway?`)) return
    setBusy('Saving…')
    await onSave({
      ...(initial || {}), id: initial?.id || newTestId(), name: name.trim(), durationMin: Number(durationMin), marking: { correct: Number(correct) || 0, wrong: Number(wrong) || 0 },
      instructions, showResult, showAnswers, sections, createdAt: initial?.createdAt || Date.now(), updatedAt: Date.now(),
    })
    setBusy('')
  }

  const mmFound = qs.some(q => q.textMm)
  return (
    <div>
      <div className="card">
        <h3><span className="step">1</span>{editing ? 'Edit test' : 'New test from Word papers'}</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
          <label><span className="lbl">Test name</span><input className="in" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 6th Pre Mock Test — Navodaya" /></label>
          <label><span className="lbl">Duration (minutes)</span><input className="in" type="number" min="1" value={durationMin} onChange={e => setDurationMin(e.target.value)} /></label>
          <label><span className="lbl">Marks for a correct answer</span><input className="in" type="number" step="0.05" min="0" value={correct} onChange={e => setCorrect(e.target.value)} /></label>
          <label><span className="lbl">Marks cut for a wrong answer</span><input className="in" type="number" step="0.05" min="0" value={wrong} onChange={e => setWrong(e.target.value)} /></label>
        </div>
        <p className="muted" style={{ margin: '8px 0 0' }}>Navodaya (JNVST) has no negative marking, so the default is 0. For an SSC-style test use 0.25 or 0.5.</p>
        <div style={{ display: 'flex', gap: '8px 18px', flexWrap: 'wrap', marginTop: 10, fontSize: 13 }}>
          <label><input type="checkbox" checked={showResult} onChange={e => setShowResult(e.target.checked)} /> Show the score to the candidate after submitting</label>
          <label><input type="checkbox" checked={showAnswers} onChange={e => setShowAnswers(e.target.checked)} /> Show the correct answers in the review</label>
        </div>
      </div>

      <div className="card">
        <h3><span className="step">2</span>{editing ? 'Replace the question papers (optional)' : 'Question papers'}</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
          <label><span className="lbl">English paper (.docx)</span><input className="in" type="file" accept=".docx" ref={en} /></label>
          <label><span className="lbl">Meitei Mayek paper (.docx, optional)</span><input className="in" type="file" accept=".docx" ref={mm} /></label>
        </div>
        <p className="muted">The English paper sets the questions, sections and figure pictures. The Meitei Mayek paper (typed in BMEI04 or Unicode) is matched to it by question number, so both languages are in one test. Figure questions (a picture with the options inside it) take the pictures in order.</p>
        <button className="btn gold" onClick={read} disabled={!!busy}>{busy || 'Read the papers'}</button>
        {error && <p role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{error}</p>}
      </div>

      {sections.length > 0 && (
        <div className="card">
          <h3><span className="step">3</span>What was found</h3>
          <p className="muted">{qs.length} questions in {sections.length} section{sections.length === 1 ? '' : 's'} · {qs.filter(q => q.figure).length} figure questions · {qs.filter(q => q.passage).length} passage-based · Meitei Mayek {mmFound ? `found for ${qs.filter(q => q.textMm || q.figure).length} questions` : 'not added'}</p>
          {warnings.length > 0 && <div style={{ background: '#fff4dc', border: '1px solid #f3d38a', borderRadius: 8, padding: '8px 12px', margin: '8px 0', fontSize: 12.5 }}><b>Check these:</b><ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{warnings.slice(0, 15).map(w => <li key={w}>{w}</li>)}{warnings.length > 15 && <li>…and {warnings.length - 15} more</li>}</ul></div>}
          <div className="tbl"><table><thead><tr><th>Section</th><th>Questions</th><th>Directions</th></tr></thead>
            <tbody>{sections.map(s => <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title || '(no title)'}{s.titleMm ? <div className="muted" style={{ fontFamily: "'Noto Sans Meetei Mayek',sans-serif" }}>{s.titleMm}</div> : null}</td><td>Q{s.questions[0].no}–{s.questions.at(-1).no} ({s.questions.length})</td><td className="muted">{s.directions ? `${s.directions.slice(0, 90)}…` : '—'}</td></tr>)}</tbody></table></div>
          <div className="cbt-thumbs" style={{ marginTop: 10 }}>
            {qs.filter(q => q.image).slice(0, 8).map(q => <img key={q.no} src={q.image} alt={`Q${q.no}`} title={`Q${q.no}`} style={{ height: 54, border: '1px solid #e1e6f0', borderRadius: 4 }} />)}
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="card">
          <h3><span className="step">4</span>Smart check</h3>
          <p className="muted">Every question is checked on its own and against its other-language twin: the picture it carries, its options, and that numbers agree between English and Meitei Mayek (numbers do not change with language, so a different number means a shifted or mistyped question). Click a question to look at it side by side and fix it here.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
            <span className="tag" style={{ background: '#e7f6ec', color: '#146c3a' }}>✔ {report.counts.ok} verified</span>
            <span className="tag" style={{ background: report.counts.warn ? '#fff4dc' : '#f1f5f9', color: report.counts.warn ? '#9a5b00' : '#64748b' }}>⚠ {report.counts.warn} to check</span>
            <span className="tag" style={{ background: report.counts.error ? '#fde8e6' : '#f1f5f9', color: report.counts.error ? '#b42318' : '#64748b' }}>✖ {report.counts.error} errors</span>
            {report.hasMm ? <span className="tag" style={{ background: '#eef2f9', color: '#1e3a6e' }}>English ⇄ Meitei Mayek compared</span> : <span className="tag" style={{ background: '#f1f5f9', color: '#64748b' }}>English only</span>}
          </div>
          {flagged.length === 0 && <p style={{ color: '#146c3a', fontWeight: 700, margin: '6px 0' }}>✓ Nothing to check — every question passed.</p>}
          {flagged.map(i => (
            <div key={i.no} className={`cbt-flag ${i.status}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>Q{i.no}</b> <span className="tag" style={{ background: i.status === 'error' ? '#fde8e6' : i.reviewed ? '#e7f6ec' : '#fff4dc', color: i.status === 'error' ? '#b42318' : i.reviewed ? '#146c3a' : '#9a5b00' }}>{i.status === 'error' ? 'ERROR' : i.reviewed ? 'ACCEPTED' : 'CHECK'}</span>
                <ul>{i.problems.map(p => <li key={p.msg}>{p.msg}</li>)}</ul>
              </div>
              <button className="btn" onClick={() => setReviewNo(reviewNo === i.no ? null : i.no)}>{reviewNo === i.no ? 'Close' : 'Review / fix'}</button>
            </div>
          ))}
          <div className="muted" style={{ margin: '12px 0 6px' }}>All questions — click one to open it:</div>
          <div className="cbt-chips">
            {report.items.map(i => <button key={i.no} className={`cbt-chip ${i.status}${reviewNo === i.no ? ' sel' : ''}`} onClick={() => setReviewNo(reviewNo === i.no ? null : i.no)} aria-label={`Question ${i.no}, ${i.status === 'ok' ? 'verified' : i.status === 'warn' ? 'to check' : 'error'}`}>{i.no}</button>)}
          </div>
          {rq && (
            <div className="cbt-edit">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>Question {rq.no}</h3>
                <div className="cbt-actions">
                  {report.byNo.get(rq.no).problems.length > 0 && <button className="btn" onClick={() => markReviewed(rq.no)}>✔ Looks fine</button>}
                  <button className="btn" onClick={() => setReviewNo(null)}>Close</button>
                </div>
              </div>
              {report.byNo.get(rq.no).problems.map(p => <div key={p.msg} style={{ color: p.level === 'error' ? '#b42318' : '#9a5b00', fontSize: 12.5, marginTop: 4 }}>{p.level === 'error' ? '✖' : '⚠'} {p.msg}</div>)}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '10px 0', fontSize: 13 }}><input type="checkbox" checked={!!rq.figure} onChange={e => patchQ(rq.no, { figure: e.target.checked })} /> Figure question (the picture holds the problem and the options)</label>
              {(rq.figure || picsOf(rq).length > 0) && (
                <div className="cbt-figbox">
                  {picsOf(rq).map((src, i) => <img key={i} src={src} alt={`Figure for question ${rq.no}`} />)}
                  {picsOf(rq).length === 0 && <div className="muted">No picture on this question.</div>}
                  <div className="cbt-actions" style={{ marginTop: 8 }}>
                    <label className="btn" style={{ display: 'inline-block' }}>🖼 {picsOf(rq).length ? 'Replace' : 'Add'} picture<input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { replacePic(rq.no, e.target.files?.[0]); e.target.value = '' }} /></label>
                    {picsOf(rq).length > 0 && <button className="btn red" onClick={() => setPics(rq.no, [])}>Remove picture</button>}
                    <select className="in" style={{ width: 'auto' }} value={swapWith} onChange={e => setSwapWith(e.target.value)} aria-label="Swap picture with question">
                      <option value="">Swap picture with…</option>{qs.filter(x => x.no !== rq.no && (x.figure || picsOf(x).length)).map(x => <option key={x.no} value={x.no}>Question {x.no}</option>)}
                    </select>
                    {swapWith && <button className="btn navy" onClick={() => swapPics(rq.no, Number(swapWith))}>Swap</button>}
                  </div>
                </div>
              )}
              <div className="cbt-twin">
                <div>
                  <b className="lbl">English</b>
                  <textarea className="in" rows={3} value={rq.text} onChange={e => patchQ(rq.no, { text: e.target.value })} placeholder={rq.figure ? '(no text — the picture is the question)' : 'Question text'} />
                  {rq.options.map(o => !rq.figure && <input key={o.key} className="in" style={{ marginTop: 6 }} aria-label={`English option ${o.key}`} value={o.text} onChange={e => patchOpt(rq.no, o.key, { text: e.target.value })} placeholder={`(${o.key})`} />)}
                  <textarea className="in" style={{ marginTop: 6 }} rows={2} value={rq.passage} onChange={e => patchQ(rq.no, { passage: e.target.value })} placeholder="Reading passage (if any)" />
                </div>
                <div className="mm">
                  <b className="lbl" style={{ fontFamily: 'inherit' }}>Meitei Mayek</b>
                  <textarea className="in mm" rows={3} value={rq.textMm} onChange={e => patchQ(rq.no, { textMm: e.target.value })} />
                  {rq.options.map(o => !rq.figure && <input key={o.key} className="in mm" style={{ marginTop: 6 }} aria-label={`Meitei Mayek option ${o.key}`} value={o.textMm} onChange={e => patchOpt(rq.no, o.key, { textMm: e.target.value })} placeholder={`(${o.key})`} />)}
                  <textarea className="in mm" style={{ marginTop: 6 }} rows={2} value={rq.passageMm} onChange={e => patchQ(rq.no, { passageMm: e.target.value })} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {sections.length > 0 && (
        <div className="card">
          <h3><span className="step">5</span>Answer key <span className="tag" style={{ background: ks.complete ? '#e7f6ec' : '#fff4dc', color: ks.complete ? '#146c3a' : '#9a5b00' }}>{ks.set} of {ks.total} set</span></h3>
          <p className="muted">The papers do not carry the answers. Paste the key, or click the answers below. Without a key the test still runs, but scores cannot be worked out.</p>
          <textarea className="in" rows={3} value={keyText} onChange={e => setKeyText(e.target.value)} placeholder={'1-A, 2-C, 3-B …   or the letters in order:   ACBDDA…'} />
          <div style={{ display: 'flex', gap: 8, margin: '8px 0', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn navy" onClick={applyKey}>Apply key</button>
            <button className="btn" onClick={() => setSections(ss => ss.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, answer: null })) })))}>Clear all</button>
            {keyMsg.map(m => <span key={m} style={{ color: '#b42318', fontSize: 12 }}>⚠ {m}</span>)}
          </div>
          {sections.map(s => (
            <div key={s.id} style={{ marginTop: 10 }}>
              <b style={{ fontSize: 12.5 }}>{s.label ? `${s.label} — ` : ''}{s.title}</b>
              <div className="cbt-keygrid">
                {s.questions.map(q => (
                  <div key={q.no} className={`cbt-keyrow${q.answer ? ' set' : ''}`}>
                    <b>{q.no}</b>
                    {['A', 'B', 'C', 'D'].map(k => <button key={k} onClick={() => setAnswer(q.no, k)} aria-label={`Question ${q.no} answer ${k}`} aria-pressed={q.answer === k}>{k}</button>)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3><span className="step">6</span>Instructions shown to the candidate</h3>
        <textarea className="in" rows={9} value={instructions} onChange={e => setInstructions(e.target.value)} />
      </div>

      <div className="cbt-savebar">
        <button className="btn gold" onClick={save} disabled={!!busy}>💾 {editing ? 'Save changes' : 'Save test'}</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
