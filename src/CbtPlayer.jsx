// CbtPlayer.jsx — the candidate's exam screen, laid out like the SSC / TCS computer based test:
// instructions → declaration → exam (question + options on the left, colour-coded question palette on the
// right, section tabs, countdown clock, language switch) → summary → submit. CbtResult shows the score card.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CBT_CSS } from './cbtCss'
import { cbtStore } from './cbtStore'
import {
  STATUS_LABEL, flatQuestions, newAttempt, statusOf, go, select, clear, mark, counts, neighbour, secondsLeft, clock, grade, keyStatus,
} from './lib/cbtEngine'

const hasMm = test => flatQuestions(test).some(q => q.textMm || q.options.some(o => o.textMm))
const pick = (en, mm, lang) => (lang === 'mm' && mm ? mm : en)
const picsOf = q => (q.images?.length ? q.images : q.image ? [q.image] : [])
const LEGEND = ['answered', 'notAnswered', 'notVisited', 'marked', 'answeredMarked']
const Swatch = ({ s, n }) => <span className={`cbt-s ${s}`}>{n}</span>

export default function CbtPlayer({ test, candidate, resume, onSubmit, onClose }) {
  const mm = useMemo(() => hasMm(test), [test])
  const qs = useMemo(() => flatQuestions(test), [test])
  const [stage, setStage] = useState(resume ? 'exam' : 'instructions')
  const [a, setA] = useState(resume || null)
  const [now, setNow] = useState(() => Date.now())
  const [modal, setModal] = useState(null)       // 'summary' | 'confirm' | 'instructions'
  const [fs, setFs] = useState(15)
  const [agree, setAgree] = useState(false)
  const [toast, setToast] = useState('')
  const [drawer, setDrawer] = useState(false)      // phone: the question palette as a bottom sheet
  const [passOpen, setPassOpen] = useState(true)   // phone: the reading passage can be folded away
  const submitted = useRef(false)
  const lastSwitch = useRef(0)
  const aRef = useRef(a)
  useEffect(() => { aRef.current = a }, [a])

  const flash = t => { setToast(t); setTimeout(() => setToast(''), 3500) }
  const begin = () => {
    const att = newAttempt(test, candidate)
    att.lang = 'en'
    const first = go(att, att.current)
    setA(first); cbtStore.saveAttempt(first); setStage('exam')
    try { document.documentElement.requestFullscreen?.() } catch { /* not allowed — fine */ }
  }

  // clock
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const left = a ? secondsLeft(a, test, now) : test.durationMin * 60

  const finish = useCallback(async (auto = false) => {
    const cur = aRef.current
    if (!cur || submitted.current) return
    submitted.current = true
    const done = { ...cur, state: 'submitted', submittedAt: Date.now(), autoSubmitted: auto }
    done.score = grade(test, done.answers)
    await cbtStore.saveAttempt(done)
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ignore */ }
    onSubmit(done)
  }, [test, onSubmit])
  useEffect(() => { if (stage === 'exam' && a && left <= 0) finish(true) }, [stage, a, left, finish])

  // autosave (so a refresh or a power cut loses nothing)
  useEffect(() => {
    if (stage !== 'exam' || !a || a.state !== 'inprogress') return
    const t = setTimeout(() => cbtStore.saveAttempt(a), 500)
    return () => clearTimeout(t)
  }, [a, stage])

  // leaving the screen is recorded
  useEffect(() => {
    if (stage !== 'exam') return
    const away = () => {
      if (Date.now() - lastSwitch.current < 1500) return
      lastSwitch.current = Date.now()
      setA(x => (x ? { ...x, switches: (x.switches || 0) + 1 } : x))
      flash('You left the exam screen. This has been recorded.')
    }
    const vis = () => { if (document.hidden) away() }
    const stop = e => { e.preventDefault(); e.returnValue = '' }
    document.addEventListener('visibilitychange', vis); window.addEventListener('blur', away); window.addEventListener('beforeunload', stop)
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', away); window.removeEventListener('beforeunload', stop) }
  }, [stage])

  const q = a ? qs.find(x => x.no === a.current) : null
  const sec = q ? test.sections[q.sectionIndex] : null
  const lang = a?.lang || 'en'
  const open = no => { setA(x => go(x, no)); setDrawer(false) }
  const next = () => setA(x => go(x, neighbour(test, x.current, 1)))
  const prev = () => setA(x => go(x, neighbour(test, x.current, -1)))
  const choose = key => setA(x => select(go(x, x.current), x.current, key))
  const saveNext = () => { setA(x => go(mark(x, x.current, false), neighbour(test, x.current, 1))) }
  const markNext = () => { setA(x => go(mark(x, x.current, true), neighbour(test, x.current, 1))) }
  const clearIt = () => setA(x => clear(x, x.current))

  useEffect(() => {
    if (stage !== 'exam' || modal) return
    const key = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'radio') return
      const k = e.key.toLowerCase()
      if (/^[a-d1-4]$/.test(k)) choose('ABCD'['abcd'.includes(k) ? 'abcd'.indexOf(k) : Number(k) - 1])
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }) // re-bound each render so it always sees the current question

  const shell = body => (
    <div className="cbt cbt-exam" onContextMenu={e => e.preventDefault()} onCopy={e => e.preventDefault()} style={{ '--fs': `${fs}px` }}>
      <style>{CBT_CSS}</style>{body}
    </div>
  )

  // ── instructions ──
  if (stage === 'instructions' || stage === 'declaration') {
    return shell(<>
      <div className="cbt-top"><div className="title">{test.name}</div><div className="cbt-tools"><div className="cand"><span className="avatar">{(candidate.name || '?')[0].toUpperCase()}</span><span>{candidate.name}{candidate.roll ? ` · ${candidate.roll}` : ''}</span></div></div></div>
      <div className="cbt-center"><div className="panel">
        {stage === 'instructions' ? <>
          <h3 style={{ textAlign: 'center' }}>Instructions</h3>
          <p style={{ textAlign: 'center', margin: '0 0 12px' }}><b>Duration: {test.durationMin} minutes</b> · Maximum marks: {grade(test, {}).max || '—'} · {flatQuestions(test).length} questions</p>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.65 }}>{test.instructions}</div>
          <p style={{ margin: '14px 0 6px', fontWeight: 700 }}>Marking scheme</p>
          <p style={{ margin: 0, fontSize: 14 }}>Correct answer: <b style={{ color: '#146c3a' }}>+{test.marking.correct}</b> · Wrong answer: <b style={{ color: '#b42318' }}>{test.marking.wrong ? `−${test.marking.wrong}` : 'no negative marking'}</b> · Not answered: 0</p>
          <p style={{ margin: '14px 0 6px', fontWeight: 700 }}>Sections</p>
          <div className="tbl"><table><thead><tr><th>Section</th><th>Questions</th></tr></thead><tbody>{test.sections.map(s => <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td>{s.questions.length} (Q{s.questions[0].no}–{s.questions.at(-1).no})</td></tr>)}</tbody></table></div>
          <div className="cbt-row">
            <button className="cbt-b" onClick={onClose}>Cancel</button>
            <button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => setStage('declaration')}>Next ›</button>
          </div>
        </> : <>
          <h3 style={{ textAlign: 'center' }}>Declaration</h3>
          <label style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.6, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 5, width: 18, height: 18 }} />
            <span>I have read and understood the instructions. I will not use any unfair means, and I understand that leaving this screen during the test is recorded.</span>
          </label>
          <div className="cbt-row">
            <button className="cbt-b" onClick={() => setStage('instructions')}>‹ Previous</button>
            <button className="cbt-b sub" style={{ width: 'auto', margin: 0, opacity: agree ? 1 : .5 }} disabled={!agree} onClick={begin}>I am ready to begin</button>
          </div>
        </>}
      </div></div>
    </>)
  }

  if (!a || !q) return null
  const low = left <= 300
  const inSec = qs.filter(x => x.sectionIndex === q.sectionIndex)
  const sel = a.answers[q.no]
  const marksOf = test.marking
  const secCounts = s => counts(a, qs.filter(x => x.sectionId === s.id))
  const all = counts(a, qs)

  const summaryTable = (
    <div className="tbl"><table>
      <thead><tr><th>Section</th><th>Questions</th><th>Answered</th><th>Not Answered</th><th>Marked for Review</th><th>Answered &amp; Marked</th><th>Not Visited</th></tr></thead>
      <tbody>{test.sections.map(s => { const c = secCounts(s); return <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td>{s.questions.length}</td><td>{c.answered}</td><td>{c.notAnswered}</td><td>{c.marked}</td><td>{c.answeredMarked}</td><td>{c.notVisited}</td></tr> })}</tbody>
    </table></div>
  )

  return shell(<>
    {toast && <div className="cbt-toast" role="alert">{toast}</div>}
    <div className="cbt-top">
      <div className="title">{test.name}</div>
      <span className={`cbt-timer${low ? ' low' : ''}`} aria-label="Time left">⏱ {clock(left)}</span>
      <div className="cbt-tools">
        <div className="cand"><span className="avatar">{(a.candidate.name || '?')[0].toUpperCase()}</span><span>{a.candidate.name}{a.candidate.roll ? <><br /><small>Roll: {a.candidate.roll}</small></> : null}</span></div>
        {mm && <select value={lang} onChange={e => setA(x => ({ ...x, lang: e.target.value }))} aria-label="Language"><option value="en">English</option><option value="mm">ꯃꯤꯇꯩꯂꯣꯟ (Meitei Mayek)</option></select>}
        <button className="sm" onClick={() => setFs(f => Math.max(12, f - 1))} aria-label="Smaller text">A−</button>
        <button className="sm" onClick={() => setFs(f => Math.min(24, f + 1))} aria-label="Larger text">A+</button>
        <button className="sm" onClick={() => setModal('instructions')} aria-label="Instructions"><span className="not-sm">Instructions</span><span className="only-sm">ⓘ Info</span></button>
      </div>
    </div>
    <div className="cbt-secbar" role="tablist" aria-label="Sections">
      {test.sections.map((s, i) => {
        const c = secCounts(s)
        return <button key={s.id} role="tab" aria-selected={q.sectionIndex === i} className={`cbt-sec${q.sectionIndex === i ? ' on' : ''}`} onClick={() => open(s.questions[0].no)}>{s.label ? `${s.label}: ` : ''}{pick(s.title, s.titleMm, lang) || `Section ${i + 1}`}<small>{c.answered + c.answeredMarked}/{s.questions.length}</small></button>
      })}
    </div>
    <div className="cbt-body">
      <div className="cbt-main">
        <div className="cbt-qhead">
          <span className="cbt-qno">Question No. <i>{q.no}</i><small>of {qs.length}</small></span>
          <span className="cbt-marks">Marks: <span className="p">+{marksOf.correct}</span> · <span className="n">{marksOf.wrong ? `−${marksOf.wrong}` : '0'}</span></span>
          <button className="cbt-palbtn" onClick={() => setDrawer(true)} aria-label="Open question palette">☰ Palette · {all.answered + all.answeredMarked}/{qs.length}</button>
        </div>
        <div className="cbt-qarea">
          {q.passage && <div className={`cbt-pass${passOpen ? ' open' : ''}`}>
            <button className="cbt-passbar" onClick={() => setPassOpen(o => !o)} aria-expanded={passOpen}><span>📖 PASSAGE</span><span>{passOpen ? 'Hide ▴' : 'Read ▾'}</span></button>
            <h5>PASSAGE</h5><div className={lang === 'mm' && q.passageMm ? 'mm' : ''}>{pick(q.passage, q.passageMm, lang)}</div>
          </div>}
          <div className="cbt-q">
            {q.no === sec.questions[0].no && (sec.directions || sec.directionsMm) && <div className={`cbt-dir${lang === 'mm' && sec.directionsMm ? ' mm' : ''}`}><b>Directions: </b>{pick(sec.directions, sec.directionsMm, lang)}</div>}
            {picsOf(q).map((src, i) => <img key={i} className="cbt-fig" src={src} alt={`Question ${q.no} figure ${i + 1}`} draggable={false} />)}
            {q.text && <div className={`cbt-qtext${lang === 'mm' && q.textMm ? ' mm' : ''}`}>{pick(q.text, q.textMm, lang)}</div>}
            {q.options.map(o => (
              <label key={o.key} className={`cbt-opt${sel === o.key ? ' on' : ''}`}>
                <input type="radio" name={`q${q.no}`} checked={sel === o.key} onChange={() => choose(o.key)} />
                <b>{o.key}.</b>
                <span className={lang === 'mm' && o.textMm ? 'mm' : ''}>{q.figure ? `Option ${o.key}` : pick(o.text, o.textMm, lang)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="cbt-act">
          <button className="cbt-b mark b-mark" onClick={markNext}>Mark for Review &amp; Next</button>
          <button className="cbt-b b-clear" onClick={clearIt}>Clear Response</button>
          <span className="sp" />
          <button className="cbt-b b-prev" onClick={prev} disabled={q.no === qs[0].no}>‹ Previous</button>
          <button className="cbt-b save b-save" onClick={saveNext}>Save &amp; Next</button>
        </div>
      </div>
      {drawer && <div className="cbt-backdrop open" onClick={() => setDrawer(false)} />}
      <aside className={`cbt-side${drawer ? ' open' : ''}`} aria-label="Question palette">
        <div className="cbt-sheet-h"><span>Question palette</span><button onClick={() => setDrawer(false)} aria-label="Close palette">✕</button></div>
        <div className="cbt-legend">
          {LEGEND.map(s => <div key={s}><Swatch s={s} n={all[s]} />{STATUS_LABEL[s]}</div>)}
        </div>
        <div className="cbt-pal">
          <h5>{sec.label ? `Section ${sec.label}: ` : ''}{pick(sec.title, sec.titleMm, lang)}</h5>
          <div className="cbt-grid">
            {inSec.map(x => <button key={x.no} className={`cbt-n ${statusOf(a, x.no)}${x.no === q.no ? ' cur' : ''}`} onClick={() => open(x.no)} aria-label={`Question ${x.no}, ${STATUS_LABEL[statusOf(a, x.no)]}`}>{x.no}</button>)}
          </div>
        </div>
        <div className="foot"><button className="cbt-b sub" style={{ marginTop: 0 }} onClick={() => setModal('summary')}>Submit Test</button></div>
      </aside>
    </div>

    {modal === 'instructions' && <div className="cbt-modal" onClick={() => setModal(null)}><div className="box" onClick={e => e.stopPropagation()}><h3>Instructions</h3><div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6 }}>{test.instructions}</div><div style={{ textAlign: 'right', marginTop: 14 }}><button className="cbt-b" onClick={() => setModal(null)}>Close</button></div></div></div>}
    {modal === 'summary' && <div className="cbt-modal"><div className="box">
      <h3 style={{ textAlign: 'center' }}>Exam Summary</h3>
      <p className="muted" style={{ textAlign: 'center' }}>Time left: <b>{clock(left)}</b></p>
      {summaryTable}
      <p style={{ fontSize: 13, marginTop: 12 }}>Answered and marked questions are counted for marking. Questions not answered carry no marks.</p>
      <div className="cbt-row">
        <button className="cbt-b" onClick={() => setModal(null)}>Go back to the exam</button>
        <button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => setModal('confirm')}>Submit Test</button>
      </div>
    </div></div>}
    {modal === 'confirm' && <div className="cbt-modal"><div className="box" style={{ maxWidth: 460 }}>
      <h3>Submit the test?</h3>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>You have answered <b>{all.answered + all.answeredMarked}</b> of <b>{qs.length}</b> questions. Once you submit you cannot go back or change any answer.</p>
      <div className="cbt-row">
        <button className="cbt-b" onClick={() => setModal('summary')}>No</button>
        <button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => finish(false)}>Yes, submit</button>
      </div>
    </div></div>}
  </>)
}

// ── Score card + answer review ───────────────────────────────────────────────
export function CbtResult({ test, attempt, onClose, admin = false, closeLabel = 'Close' }) {
  const g = useMemo(() => grade(test, attempt.answers), [test, attempt])
  const [filter, setFilter] = useState('all')
  const [lang, setLang] = useState('en')
  const qs = useMemo(() => flatQuestions(test), [test])
  const ks = keyStatus(test)
  const visible = admin || test.showResult !== false
  const took = attempt.submittedAt ? Math.round((attempt.submittedAt - attempt.startedAt) / 60000) : null
  const rows = qs.filter(q => {
    const given = attempt.answers[q.no]
    return filter === 'all' || (filter === 'wrong' && given && q.answer && given !== q.answer) || (filter === 'skipped' && !given) || (filter === 'correct' && given && given === q.answer)
  })
  const stat = (l, v, c) => <div className="cbt-stat"><div className="muted">{l}</div><b style={{ color: c || '#14264a' }}>{v}</b></div>
  return (
    <div className="cbt cbt-exam" style={{ overflow: 'auto' }}>
      <style>{CBT_CSS}</style>
      <div className="cbt-top"><div className="title">{test.name} — {admin ? 'Result' : 'Test submitted'}</div><div className="cbt-tools"><button className="sm" onClick={onClose}>{closeLabel}</button></div></div>
      <div className="cbt-center" style={{ maxWidth: 940, userSelect: 'text' }}>
        <div className="panel">
          <h3>{attempt.candidate.name}{attempt.candidate.roll ? ` · ${attempt.candidate.roll}` : ''}</h3>
          <p className="muted">Started {new Date(attempt.startedAt).toLocaleString('en-IN')}{took !== null ? ` · took ${took} min` : ''}{attempt.autoSubmitted ? ' · submitted automatically when time ended' : ''}{attempt.switches ? ` · left the screen ${attempt.switches} time${attempt.switches === 1 ? '' : 's'}` : ''}</p>
          {!visible ? (
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>Your answers have been recorded. The result will be declared by the institute.</p>
          ) : <>
            {!ks.complete && <p style={{ background: '#fff4dc', border: '1px solid #f3d38a', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>⚠️ The answer key is {ks.set ? `set for ${ks.set} of ${ks.total} questions` : 'not set yet'}, so this score is {ks.set ? 'partial' : 'not available'}. Add the key under CBT Exam → Edit, then open the result again.</p>}
            <div className="cbt-stats">
              {stat('Score', ks.set ? `${g.marks} / ${g.max}` : '—', '#146c3a')}
              {stat('Correct', g.correct, '#146c3a')}{stat('Wrong', g.wrong, '#b42318')}{stat('Not answered', g.skipped)}
              {stat('Accuracy', ks.set ? `${g.accuracy}%` : '—')}
            </div>
            <div className="tbl"><table><thead><tr><th>Section</th><th className="num">Qs</th><th className="num">Tried</th><th className="num">Right</th><th className="num">Wrong</th><th className="num">Marks</th></tr></thead>
              <tbody>{g.sections.map(s => <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td className="num">{s.total}</td><td className="num">{s.attempted}</td><td className="num">{s.correct}</td><td className="num">{s.wrong}</td><td className="num"><b>{s.marks}</b> / {s.max}</td></tr>)}</tbody></table></div>
            {(admin || test.showAnswers !== false) && <>
              <div style={{ display: 'flex', gap: 8, margin: '18px 0 10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <h3 style={{ margin: 0, flex: 1 }}>Answer review</h3>
                {['all', 'correct', 'wrong', 'skipped'].map(f => <button key={f} className={`btn${filter === f ? ' navy' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
                {hasMm(test) && <select className="in" style={{ width: 'auto' }} value={lang} onChange={e => setLang(e.target.value)}><option value="en">English</option><option value="mm">Meitei Mayek</option></select>}
              </div>
              {rows.map(q => {
                const given = attempt.answers[q.no], ok = given && given === q.answer
                return (
                  <div key={q.no} className="cbt-review" style={{ borderLeftColor: !given ? '#94a3b8' : !q.answer ? '#d9b566' : ok ? '#3a9d3a' : '#d9532c' }}>
                    <b>Q{q.no}.</b> <span className={`tag`} style={{ background: !given ? '#f1f5f9' : ok ? '#e7f6ec' : '#fde8e6', color: !given ? '#475569' : ok ? '#146c3a' : '#b42318' }}>{!given ? 'Not answered' : !q.answer ? 'No key' : ok ? 'Correct' : 'Wrong'}</span>
                    {q.passage && <div className="muted" style={{ margin: '6px 0' }}>Passage: {pick(q.passage, q.passageMm, lang).slice(0, 160)}…</div>}
                    {picsOf(q).map((src, i) => <img key={i} className="cbt-fig" style={{ maxHeight: 220, margin: '8px 0' }} src={src} alt={`Question ${q.no} figure ${i + 1}`} />)}
                    {q.text && <div className={lang === 'mm' && q.textMm ? 'mm' : ''} style={{ whiteSpace: 'pre-wrap', margin: '6px 0', fontWeight: 600 }}>{pick(q.text, q.textMm, lang)}</div>}
                    <div style={{ display: 'grid', gap: 4 }}>
                      {q.options.map(o => <div key={o.key} className={lang === 'mm' && o.textMm ? 'mm' : ''} style={{ padding: '4px 8px', borderRadius: 4, background: o.key === q.answer ? '#e7f6ec' : o.key === given ? '#fde8e6' : 'transparent', fontWeight: o.key === q.answer || o.key === given ? 700 : 400 }}>{o.key}. {q.figure ? `Option ${o.key}` : pick(o.text, o.textMm, lang)}{o.key === q.answer ? '  ✓ correct' : ''}{o.key === given && o.key !== q.answer ? '  ✗ your answer' : ''}{o.key === given && o.key === q.answer ? '  (your answer)' : ''}</div>)}
                    </div>
                  </div>
                )
              })}
              {rows.length === 0 && <p className="muted">No questions to show.</p>}
            </>}
          </>}
        </div>
      </div>
    </div>
  )
}
