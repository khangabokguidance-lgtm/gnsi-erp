// MissionFoundationPaper.jsx — Question maker for the combined Mission Foundation paper.
// All six subjects are written in one sitting, so every subject's questions go into one booklet:
// Section A Mathematics I, Section B Mathematics II … numbered straight through, one total time, one answer key, one OMR sheet.
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill } from './MissionSainikUI'
import MultiQuestionAdder, { blankCard, cardsToText, isEmptyCard, cardsProblems } from './MultiQuestionAdder'
import { parseQuestions, fetchAll } from './lib/missionSainikQuestions'
import { omrHtml, wordWrap } from './lib/missionSainikPaper'
import { mathToHtml } from './lib/mathText'
import { paperModel, paperHtml, answerKeyHtml, nextPosition, PAPER_INSTRUCTIONS } from './lib/missionFoundationPaper'
import { TestPicker } from './MissionFoundationWork'
import { MISSION_NAME, DEFAULT_TEST_MINUTES, isSetter, settersOf } from './missionFoundationData'

const T_QUESTIONS = 'mission_foundation_questions'
const INSTITUTE = 'Guidance Navodaya & Sainik Institute'
const Btn = ({ kind = 'ghost', children, ...p }) => <button type="button" className={'px-btn ' + kind} {...p}>{children}</button>
const fmtLong = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()

function openDoc(html) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html); w.document.close()
  return true
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function QuestionMakerTab({ tests, testId, setTestId, papersByTest, me, isAdmin, flash, savePaper, isMobile }) {
  const test = tests.find(t => t.id === testId)
  const papers = useMemo(() => papersByTest[testId] || [], [papersByTest, testId])
  const [data, setData] = useState({ id: null, rows: [] })   // questions of the test that was loaded last
  const [missing, setMissing] = useState(false)
  const [adding, setAdding] = useState(null)        // subject being typed
  const [viewing, setViewing] = useState(null)      // subject whose questions are listed
  const [cards, setCards] = useState([blankCard()])
  const [busy, setBusy] = useState(false)
  const [opt, setOpt] = useState({ set: 'A', columns: 2, size: 13, instructions: PAPER_INSTRUCTIONS, explanations: false })
  const [preview, setPreview] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = () => setTick(n => n + 1)
  const loading = data.id !== testId
  const rows = useMemo(() => (data.id === testId ? data.rows : []), [data, testId])
  const setRows = f => setData(d => ({ ...d, rows: f(d.rows) }))

  useEffect(() => {
    if (!testId) return
    let live = true
    fetchAll(() => supabase.from(T_QUESTIONS).select('*').eq('test_id', testId).order('position').order('created_at')).then(({ data: list, error }) => {
      if (!live) return
      if (error) { if (/does not exist|schema cache/i.test(error.message)) setMissing(true); else flash('Could not load questions: ' + error.message, true); return }
      setMissing(false); setData({ id: testId, rows: list || [] })
    })
    return () => { live = false }
  }, [testId, tick, flash])

  const model = useMemo(() => paperModel(papers, rows), [papers, rows])
  const printModel = useMemo(() => (opt.set === 'A' ? model : paperModel(papers, rows, { set: opt.set, seed: testId })), [model, papers, rows, opt.set, testId])
  const canEdit = p => isAdmin || isSetter(me, p)
  const pct = model.wanted ? Math.min(100, Math.round((model.total / model.wanted) * 100)) : 0
  const title = test ? (test.title || 'Test ' + String(test.test_no).padStart(2, '0')) : ''
  const minutes = test?.duration_min || DEFAULT_TEST_MINUTES
  const head = { institute: INSTITUTE, title: `${MISSION_NAME} · ${title}`, subtitle: 'Combined paper · ' + papers.map(p => p.subject).join(', '), date: fmtLong(test?.test_date), minutes, columns: opt.columns, size: opt.size, set: opt.set, instructions: opt.instructions, explanations: opt.explanations }
  const fileBase = `Mission-Foundation-${title.replace(/[^\w]+/g, '-')}${opt.set !== 'A' ? '-Set-' + opt.set : ''}`

  // ── adding questions to one subject ──
  const section = adding ? model.sections.find(s => s.subject === adding) : null
  const parsed = useMemo(() => {
    const base = parseQuestions(cardsToText(cards))
    const filled = cards.filter(c => !isEmptyCard(c))
    const problems = cardsProblems(cards)
    return { errors: problems && !base.errors.length ? [`${problems} question card(s) are not complete. See the red notes.`] : base.errors, questions: base.questions.map((q, i) => (filled[i]?.image && filled[i].type !== 'normal' ? { ...q, image_data: filled[i].image } : q)) }
  }, [cards])
  const startAdding = subject => { setCards([blankCard()]); setViewing(null); setAdding(subject) }
  const saveCards = async () => {
    if (parsed.errors.length) return flash(parsed.errors.slice(0, 2).join(' · '), true)
    if (!parsed.questions.length) return flash('Type at least one question first.', true)
    const have = new Set(rows.filter(r => r.subject === adding).map(r => norm(r.question)))
    const dup = parsed.questions.find((q, i) => have.has(norm(q.question)) || parsed.questions.findIndex(z => norm(z.question) === norm(q.question)) !== i)
    if (dup) return flash(`This question is already in ${adding}: “${dup.question.slice(0, 60)}”`, true)
    const wanted = section?.wanted || 0
    if (wanted && section.items.length + parsed.questions.length > wanted && !window.confirm(`${adding} needs ${wanted} questions. This makes ${section.items.length + parsed.questions.length}. Save anyway?`)) return
    setBusy(true)
    let pos = nextPosition(rows, adding)
    const ins = parsed.questions.map(q => ({ ...q, test_id: testId, subject: adding, position: pos++, uploaded_by: me }))
    const { error } = await supabase.from(T_QUESTIONS).insert(ins)
    setBusy(false)
    if (error) return flash('Not saved: ' + error.message, true)
    try { localStorage.removeItem(`mf-draft:${testId}:${adding}`) } catch { /* storage unavailable */ }
    flash(`${ins.length} question(s) saved to ${adding}.`)
    setCards([blankCard()]); setAdding(null)
    reload()
  }
  const removeQ = async q => {
    if (!window.confirm('Delete this question?')) return
    const { error } = await supabase.from(T_QUESTIONS).delete().eq('id', q.id)
    if (error) return flash('Not deleted: ' + error.message, true)
    setRows(rs => rs.filter(r => r.id !== q.id))
  }
  const move = async (q, dir) => {
    const list = rows.filter(r => r.subject === q.subject).sort((a, b) => a.position - b.position)
    const i = list.findIndex(r => r.id === q.id), j = i + dir
    if (j < 0 || j >= list.length) return
    const other = list[j]
    const a = { id: q.id, position: other.position }, b = { id: other.id, position: q.position === other.position ? q.position + dir : q.position }
    setRows(rs => rs.map(r => (r.id === a.id ? { ...r, position: a.position } : r.id === b.id ? { ...r, position: b.position } : r)))
    const r1 = await supabase.from(T_QUESTIONS).update({ position: a.position }).eq('id', a.id)
    const r2 = await supabase.from(T_QUESTIONS).update({ position: b.position }).eq('id', b.id)
    if (r1.error || r2.error) { flash('Order not saved: ' + (r1.error || r2.error).message, true); reload() }
  }

  // ── outputs ──
  const needAll = () => {
    if (!model.total) { flash('Add questions first.', true); return false }
    const short = model.sections.filter(s => s.items.length < s.wanted)
    if (short.length && !window.confirm(`Not complete yet: ${short.map(s => `${s.subject} ${s.items.length}/${s.wanted}`).join(', ')}. Print anyway?`)) return false
    return true
  }
  const printPaper = () => { if (needAll() && !openDoc(paperHtml(printModel, { ...head, autoPrint: true }))) flash('Allow pop-ups to print.', true) }
  const printKey = () => { if (model.total && !openDoc(answerKeyHtml(printModel, { ...head, autoPrint: true }))) flash('Allow pop-ups to print.', true) }
  const printOmr = () => { if (!openDoc(omrHtml({ title: `${MISSION_NAME} · ${title}`, institute: INSTITUTE, total: model.total || model.wanted, setLabel: opt.set !== 'A' ? opt.set : '' }))) flash('Allow pop-ups to print.', true) }
  const wordFile = () => {
    if (!needAll()) return
    const html = paperHtml(printModel, head)
    const inner = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
    const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>') + 8)
    download(fileBase + '.doc', wordWrap(style + inner, title), 'application/msword')
  }

  if (!tests.length) return <PremiumCard title="Question maker" subtitle="Create the 8 tests in Schedule first." />
  if (missing) return (
    <PremiumCard title="One step to switch this on" subtitle="Run the Mission Foundation SQL file again in the Supabase SQL Editor. It adds the question table.">
      <code>supabase/migrations/20261216_mission_foundation.sql</code>
    </PremiumCard>
  )

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PremiumCard title="Question maker · combined paper" subtitle="All subjects in one booklet and one sitting. Each teacher adds their section; the paper numbers itself."
        right={<TestPicker tests={tests} value={testId} onChange={setTestId} />}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: PX.sub, marginBottom: 6 }}>
              <span><b style={{ color: PX.ink, fontSize: 18 }}>{model.total}</b> / {model.wanted} questions</span>
              <span>{minutes} min · {model.sections.reduce((n, s) => n + s.wanted * s.marksEach, 0)} marks</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: PX.line, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: pct >= 100 ? PX.ok : PX.gold, transition: 'width .3s' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn kind="gold" onClick={() => setPreview(v => !v)} disabled={!model.total}>{preview ? 'Hide paper' : '👁 See full paper'}</Btn>
            <Btn onClick={printPaper}>🖨 Print paper</Btn>
            <Btn onClick={printKey}>🔑 Answer key</Btn>
            <Btn onClick={printOmr}>🟢 OMR sheet</Btn>
            <Btn onClick={wordFile}>📄 Word</Btn>
          </div>
        </div>
        {loading && <div style={{ marginTop: 8, color: PX.sub, fontSize: 13 }}>Loading questions…</div>}
      </PremiumCard>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {model.sections.map(s => {
          const p = papers.find(x => x.subject === s.subject)
          const done = s.wanted && s.items.length >= s.wanted
          const edit = canEdit(p)
          return (
            <div key={s.subject} style={{ border: `1.5px solid ${adding === s.subject ? PX.gold : done ? '#bfe5cf' : PX.line}`, borderRadius: 16, padding: 14, background: done ? PX.okBg : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 10, background: '#132a4f', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{s.letter}</span>
                <div style={{ flex: 1 }}>
                  <b>{s.subject}</b>
                  <div style={{ fontSize: 12, color: PX.sub }}>{s.items.length ? `Q ${s.start}–${s.end}` : 'No questions yet'} · {s.marksEach} mark{s.marksEach === 1 ? '' : 's'} each · {p?.setter || 'no setter'}</div>
                </div>
                <Pill tone={done ? 'ok' : s.items.length ? 'warn' : 'mute'}>{s.items.length}/{s.wanted}</Pill>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: PX.line, margin: '10px 0', overflow: 'hidden' }}><div style={{ width: (s.wanted ? Math.min(100, (s.items.length / s.wanted) * 100) : 0) + '%', height: '100%', background: done ? PX.ok : PX.gold }} /></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {edit && <Btn kind={adding === s.subject ? 'gold' : 'ghost'} onClick={() => (adding === s.subject ? setAdding(null) : startAdding(s.subject))}>{adding === s.subject ? 'Close' : '＋ Add questions'}</Btn>}
                <Btn onClick={() => { setAdding(null); setViewing(v => (v === s.subject ? null : s.subject)) }} disabled={!s.items.length}>{viewing === s.subject ? 'Hide' : `View (${s.items.length})`}</Btn>
                {edit && done && p?.status === 'Pending' && <Btn kind="gold" onClick={() => savePaper(p.id, { status: 'Submitted', questions: s.wanted })}>Send for checking</Btn>}
                {p && p.status !== 'Pending' && <Pill tone={p.status === 'Approved' ? 'ok' : 'info'}>{p.status}</Pill>}
              </div>
              {!edit && <div style={{ fontSize: 12, color: PX.faint, marginTop: 6 }}>Only {p ? (settersOf(p).join(' or ') || 'the setter') : 'the setter'} or an admin can add here.</div>}
            </div>
          )
        })}
      </div>

      {adding && section && (
        <PremiumCard title={`Section ${section.letter} · ${adding}`} subtitle={`Numbering continues from Q${section.start + section.items.length}. ${Math.max(0, section.wanted - section.items.length)} more needed.`}
          right={<Btn onClick={() => setAdding(null)}>Close</Btn>}>
          <MultiQuestionAdder noExplanation key={`${testId}:${adding}`} draftKey={`mf-draft:${testId}:${adding}`} cards={cards} setCards={setCards}
            remaining={Math.max(0, section.wanted - section.items.length)} startNo={section.start + section.items.length}
            title={`Section ${section.letter}: ${adding}`} existing={section.items.map(q => q.question)} isMobile={isMobile} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <Btn kind="gold" onClick={saveCards} disabled={busy || !parsed.questions.length}>{busy ? 'Saving…' : `💾 Save ${parsed.questions.length || ''} question${parsed.questions.length === 1 ? '' : 's'} to ${adding}`}</Btn>
            {parsed.errors.length > 0 && <span style={{ color: PX.bad, fontSize: 13 }}>{parsed.errors[0]}</span>}
          </div>
        </PremiumCard>
      )}

      {viewing && (() => {
        const s = model.sections.find(x => x.subject === viewing)
        const p = papers.find(x => x.subject === viewing)
        const edit = canEdit(p)
        if (!s) return null
        return (
          <PremiumCard title={`Section ${s.letter} · ${s.subject}`} subtitle={`${s.items.length} questions · Q ${s.start}–${s.end}`} right={<Btn onClick={() => setViewing(null)}>Close</Btn>}>
            <div style={{ display: 'grid', gap: 8 }}>
              {s.items.map((q, i) => (
                <div key={q.id} style={{ border: `1px solid ${PX.line}`, borderRadius: 12, padding: 10, display: 'flex', gap: 10 }}>
                  <b style={{ minWidth: 28 }}>{s.start + i}.</b>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {q.passage && (i === 0 || s.items[i - 1].passage !== q.passage) && <div style={{ fontSize: 12.5, color: PX.sub, borderLeft: `3px solid ${PX.line}`, paddingLeft: 8, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: mathToHtml(q.passage) }} />}
                    <div dangerouslySetInnerHTML={{ __html: mathToHtml(q.question) }} />
                    {q.image_data && /^data:image\//.test(q.image_data) && <img src={q.image_data} alt="Figure" style={{ maxWidth: 220, maxHeight: 140, display: 'block', margin: '4px 0' }} />}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 4, fontSize: 13, marginTop: 4 }}>
                      {q.opts.map(o => <span key={o.k} style={{ padding: '2px 6px', borderRadius: 6, background: o.k === q.answer ? PX.okBg : 'transparent', fontWeight: o.k === q.answer ? 700 : 400 }} dangerouslySetInnerHTML={{ __html: `(${o.k}) ${mathToHtml(o.text)}` }} />)}
                    </div>
                    <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 3 }}>{[q.topic, q.difficulty, q.uploaded_by && 'by ' + q.uploaded_by].filter(Boolean).join(' · ')}</div>
                  </div>
                  {edit && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button type="button" className="px-btn ghost" aria-label="Move up" onClick={() => move(q, -1)} disabled={i === 0}>↑</button>
                      <button type="button" className="px-btn ghost" aria-label="Move down" onClick={() => move(q, 1)} disabled={i === s.items.length - 1}>↓</button>
                      <button type="button" className="px-btn ghost" aria-label="Delete question" onClick={() => removeQ(q)} style={{ color: PX.bad }}>✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </PremiumCard>
        )
      })()}

      {preview && (
        <PremiumCard title="Full paper" subtitle="This is what prints. Change the layout here.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
            <label>Set <select className="px-input" style={{ width: 'auto' }} value={opt.set} onChange={e => setOpt({ ...opt, set: e.target.value })}>
              <option value="A">A (as typed)</option><option value="B">B (shuffled)</option><option value="C">C (shuffled)</option></select></label>
            <label>Columns <select className="px-input" style={{ width: 'auto' }} value={opt.columns} onChange={e => setOpt({ ...opt, columns: Number(e.target.value) })}>
              <option value={1}>1</option><option value={2}>2</option></select></label>
            <label>Text size <select className="px-input" style={{ width: 'auto' }} value={opt.size} onChange={e => setOpt({ ...opt, size: Number(e.target.value) })}>
              {[11, 12, 13, 14, 15, 16].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={opt.explanations} onChange={e => setOpt({ ...opt, explanations: e.target.checked })} /> Explanations in answer key</label>
          </div>
          <details style={{ marginBottom: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Instructions on the paper</summary>
            <textarea className="px-input" rows={5} value={opt.instructions} onChange={e => setOpt({ ...opt, instructions: e.target.value })} style={{ width: '100%', marginTop: 6 }} />
          </details>
          <iframe title="Combined paper preview" srcDoc={paperHtml(printModel, head)} style={{ width: '100%', height: isMobile ? 520 : 760, border: `1px solid ${PX.line}`, borderRadius: 12, background: '#fff' }} />
        </PremiumCard>
      )}
    </div>
  )
}
