// CbtBuilder.jsx — make (or edit) a CBT test: read the English and Meitei Mayek question papers (.docx),
// check what was found, set the marking and the answer key, save.
import { useMemo, useRef, useState } from 'react'
import { paragraphsFromDocx, imagesFromDocx } from './cbtDocs'
import { buildTest, attachImages } from './lib/cbtPaper'
import { DEFAULT_INSTRUCTIONS, parseKey, keyStatus } from './lib/cbtEngine'
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
  const en = useRef(null), mm = useRef(null)

  const qs = useMemo(() => sections.flatMap(s => s.questions), [sections])
  const ks = keyStatus({ sections })

  const read = async () => {
    setError('')
    const f = en.current?.files?.[0], g = mm.current?.files?.[0]
    if (!f) { setError('Choose the English question paper (.docx) first.'); return }
    for (const x of [f, g].filter(Boolean)) if (!/\.docx$/i.test(x.name)) { setError(`"${x.name}" is not a .docx file. Open it in Word and use Save As → .docx.`); return }
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
        <h3>{editing ? 'Edit test' : 'New test from Word papers'}</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          <label><span className="lbl">Test name</span><input className="in" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 6th Pre Mock Test — Navodaya" /></label>
          <label><span className="lbl">Duration (minutes)</span><input className="in" type="number" min="1" value={durationMin} onChange={e => setDurationMin(e.target.value)} /></label>
          <label><span className="lbl">Marks for a correct answer</span><input className="in" type="number" step="0.05" min="0" value={correct} onChange={e => setCorrect(e.target.value)} /></label>
          <label><span className="lbl">Marks cut for a wrong answer</span><input className="in" type="number" step="0.05" min="0" value={wrong} onChange={e => setWrong(e.target.value)} /></label>
        </div>
        <p className="muted" style={{ margin: '8px 0 0' }}>Navodaya (JNVST) has no negative marking, so the default is 0. For an SSC-style test use 0.25 or 0.5.</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 13 }}>
          <label><input type="checkbox" checked={showResult} onChange={e => setShowResult(e.target.checked)} /> Show the score to the candidate after submitting</label>
          <label><input type="checkbox" checked={showAnswers} onChange={e => setShowAnswers(e.target.checked)} /> Show the correct answers in the review</label>
        </div>
      </div>

      <div className="card">
        <h3>{editing ? 'Replace the question papers (optional)' : 'Question papers'}</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
          <label><span className="lbl">English paper (.docx)</span><input className="in" type="file" accept=".docx" ref={en} /></label>
          <label><span className="lbl">Meitei Mayek paper (.docx, optional)</span><input className="in" type="file" accept=".docx" ref={mm} /></label>
        </div>
        <p className="muted">The English paper sets the questions, sections and figure pictures. The Meitei Mayek paper (typed in BMEI04 or Unicode) is matched to it by question number, so both languages are in one test. Figure questions (a picture with the options inside it) take the pictures in order.</p>
        <button className="btn gold" onClick={read} disabled={!!busy}>{busy || 'Read the papers'}</button>
        {error && <p role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{error}</p>}
      </div>

      {sections.length > 0 && (
        <div className="card">
          <h3>What was found</h3>
          <p className="muted">{qs.length} questions in {sections.length} section{sections.length === 1 ? '' : 's'} · {qs.filter(q => q.figure).length} figure questions · {qs.filter(q => q.passage).length} passage-based · Meitei Mayek {mmFound ? `found for ${qs.filter(q => q.textMm || q.figure).length} questions` : 'not added'}</p>
          {warnings.length > 0 && <div style={{ background: '#fff4dc', border: '1px solid #f3d38a', borderRadius: 8, padding: '8px 12px', margin: '8px 0', fontSize: 12.5 }}><b>Check these:</b><ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{warnings.slice(0, 15).map(w => <li key={w}>{w}</li>)}{warnings.length > 15 && <li>…and {warnings.length - 15} more</li>}</ul></div>}
          <table><thead><tr><th>Section</th><th>Questions</th><th>Directions</th></tr></thead>
            <tbody>{sections.map(s => <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title || '(no title)'}{s.titleMm ? <div className="muted" style={{ fontFamily: "'Noto Sans Meetei Mayek',sans-serif" }}>{s.titleMm}</div> : null}</td><td>Q{s.questions[0].no}–{s.questions.at(-1).no} ({s.questions.length})</td><td className="muted">{s.directions ? `${s.directions.slice(0, 90)}…` : '—'}</td></tr>)}</tbody></table>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {qs.filter(q => q.image).slice(0, 8).map(q => <img key={q.no} src={q.image} alt={`Q${q.no}`} title={`Q${q.no}`} style={{ height: 54, border: '1px solid #e1e6f0', borderRadius: 4 }} />)}
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="card">
          <h3>Answer key <span className="tag" style={{ background: ks.complete ? '#e7f6ec' : '#fff4dc', color: ks.complete ? '#146c3a' : '#9a5b00' }}>{ks.set} of {ks.total} set</span></h3>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))', gap: 6, marginTop: 6 }}>
                {s.questions.map(q => (
                  <div key={q.no} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid #e1e6f0', borderRadius: 6, padding: '3px 6px', background: q.answer ? '#f3faf4' : '#fff' }}>
                    <span style={{ width: 28, fontWeight: 800, fontSize: 12 }}>{q.no}</span>
                    {['A', 'B', 'C', 'D'].map(k => <button key={k} onClick={() => setAnswer(q.no, k)} aria-label={`Question ${q.no} answer ${k}`} aria-pressed={q.answer === k} style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid #c5cde0', background: q.answer === k ? '#1e3a6e' : '#fff', color: q.answer === k ? '#fff' : '#334155', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>{k}</button>)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Instructions shown to the candidate</h3>
        <textarea className="in" rows={9} value={instructions} onChange={e => setInstructions(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn gold" onClick={save} disabled={!!busy}>💾 {editing ? 'Save changes' : 'Save test'}</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
