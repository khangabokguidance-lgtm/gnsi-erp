// EntranceConduct.jsx — Entrance stages 3-5: question paper, seating &
// hall tickets, exam-day attendance.

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from './supabase'
import { PX, PremiumCard, PIcon } from './premiumUI'
import { fetchAllPages } from './StudyMaterialBridge'
import {
  SET_CODES, parseJson, fmtDate, hallTicketNo, pickQuestions, buildPaper, keyForSet, sectionRanges, normKey,
  safeWrite, audit, eligibility, inChunks, photoUrls, rng,
} from './entranceCore'
import {
  printWindow, openPrint, wrapDoc, hallTicketHtml, attendanceSheetHtml, seatingPlanHtml, paperHtml, answerKeyHtml, omrSheetHtml,
} from './entrancePrint'
import { Chip, StatusChip, Field, Kpi, Empty, Modal } from './entranceUI'
import { useManualKeys } from './entranceHooks'

const QB_FIELDS = 'id,question,option_a,option_b,option_c,option_d,correct_option,subject,chapter,difficulty,diagram_url,course'

// Question Bank rows for one section. Untagged (course null) questions are
// Sainik-shaped legacy data, so they count for every course, as in the
// Question Bank itself.
async function fetchPool(subject, course, fields = QB_FIELDS) {
  const { data, error } = await fetchAllPages(() => supabase.from('qbank_questions').select(fields).eq('subject', subject).order('id', { ascending: true }))
  if (error) throw error
  return (data || []).filter(q => !course || !q.course || q.course === course)
}

const qrFor = text => QRCode.toDataURL(text, { margin: 0, width: 160, errorCorrectionLevel: 'M' }).catch(() => '')

// ═══════════════════════════════════════════════════════════════════════════
// Question paper
// ═══════════════════════════════════════════════════════════════════════════
export function PaperTab({ exam, exams, sections, cands, resMap, can, reload, notify, setConfirm, user }) {
  const paper = parseJson(exam.paper)
  const hasPaper = !!paper?.questions?.length
  const course = exam.course || ''
  const [avail, setAvail] = useState({ key: '', counts: null })
  const [mix, setMix] = useState({ Easy: 30, Medium: 50, Hard: 20 })
  const [sets, setSets] = useState(2)
  const [avoid, setAvoid] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showQs, setShowQs] = useState(false)
  const [keyVer, setKeyVer] = useState(0)
  const manualKeys = useManualKeys(exam.id, keyVer)
  const availKey = exam.id + sections.map(s => s.subject).join('|')
  const evaluated = cands.some(c => resMap[c.id]?.responses)

  // Questions already used by other exams' papers.
  const used = useMemo(() => {
    const s = new Set()
    for (const e of exams) if (e.id !== exam.id) for (const q of parseJson(e.paper)?.questions || []) s.add(q.qid)
    return s
  }, [exams, exam.id])

  useEffect(() => {
    let live = true
    Promise.all(sections.map(s => fetchPool(s.subject, course, 'id,course,correct_option,difficulty,question,option_a,option_b').catch(() => null)))
      .then(pools => { if (live) setAvail({ key: availKey, counts: pools.map(p => (p ? { total: p.filter(q => /^[ABCD]/i.test(q.correct_option || '') && q.question && q.option_a && q.option_b).length, fresh: p.filter(q => !used.has(q.id)).length, byDiff: ['Easy', 'Medium', 'Hard'].map(d => p.filter(q => (q.difficulty || 'Medium') === d).length) } : null)) }) })
    return () => { live = false }
  }, [availKey, sections, course, used])
  const counts = avail.key === availKey ? avail.counts : null

  const savePaper = async (next, action, extra) => {
    const { error, dropped } = await safeWrite('entrance_exams', 'update', { paper: next }, { id: exam.id })
    if (error || dropped.includes('paper')) { notify(error?.message || 'The paper needs the database upgrade (paper column) before it can be saved', 'bad'); return false }
    audit(action, user, exam.id, extra)
    reload(); return true
  }

  const generate = async () => {
    setBusy(true)
    try {
      const picks = []
      const short = []
      const seed = rng(`${exam.id}:${Date.now()}`)
      for (const s of sections) {
        const pool = await fetchPool(s.subject, course)
        const p = pickQuestions(pool, Number(s.questions) || 0, { mix, exclude: avoid ? used : new Set(), rand: seed })
        if (p.length < (Number(s.questions) || 0)) short.push(`${s.name} ${p.length}/${s.questions}`)
        picks.push(p)
      }
      const next = buildPaper(exam, picks, { sets, by: user })
      if (await savePaper(next, 'paper_generate', { questions: next.questions.length, sets: next.sets.join('') })) {
        notify(short.length ? `Generated, but short in: ${short.join(', ')}` : `Paper generated — ${next.questions.length} questions, sets ${next.sets.join(', ')}`, short.length ? 'warn' : 'ok')
      }
    } catch (e) { notify(e.message || String(e), 'bad') }
    setBusy(false)
  }

  const replace = async idx => {
    const q = paper.questions[idx]
    const s = sections[q.sec]
    setBusy(true)
    try {
      const inPaper = new Set(paper.questions.map(x => x.qid))
      const pool = (await fetchPool(s.subject, course)).filter(x => !inPaper.has(x.id))
      const same = pool.filter(x => (x.difficulty || 'Medium') === (q.difficulty || 'Medium'))
      const [pick] = pickQuestions(same.length ? same : pool, 1, { exclude: used })
      if (!pick) { notify('No other question available for this section', 'warn'); setBusy(false); return }
      const fresh = buildPaper(exam, sections.map((_, i) => (i === q.sec ? [pick] : [])), { sets: 1 }).questions[0]
      const questions = paper.questions.map((x, i) => (i === idx ? fresh : x))
      if (await savePaper({ ...paper, questions }, 'paper_replace', { position: idx + 1, old: q.qid, new: pick.id })) notify(`Question ${idx + 1} replaced`, 'ok')
    } catch (e) { notify(e.message || String(e), 'bad') }
    setBusy(false)
  }

  const reviseKey = async (idx, val) => {
    const questions = paper.questions.map((x, i) => (i === idx ? { ...x, correct: val, revised: true } : x))
    if (await savePaper({ ...paper, questions }, 'answer_key_revise', { position: idx + 1, answer: val }))
      notify(evaluated ? 'Key revised — re-evaluate in the Evaluation tab' : 'Key revised', evaluated ? 'warn' : 'ok')
  }

  const discard = () => setConfirm({
    message: <>Discard this question paper? {evaluated && <b>OMR responses already entered will no longer match a paper.</b>}</>,
    confirmLabel: 'Discard paper',
    onConfirm: async () => { if (await savePaper(null, 'paper_discard')) notify('Paper discarded', 'ok') },
  })

  const printSet = set => openPrint(`${exam.exam_name} · Set ${set}`, paperHtml(exam, paper, set, sections))
  const printKeys = () => openPrint(`${exam.exam_name} · Answer key`, answerKeyHtml(exam, Object.fromEntries(paper.sets.map(s => [s, keyForSet(exam, paper, null, s)]))))
  const qTotal = sections.reduce((t, s) => t + (Number(s.questions) || 0), 0)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {hasPaper ? (
        <PremiumCard title="Question paper" subtitle={`Generated ${fmtDate(paper.generated_at)}${paper.generated_by ? ` by ${paper.generated_by}` : ''} · frozen copy — later Question Bank edits don't change it`}
          right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {paper.locked ? <Chip tone="ok">🔒 Locked</Chip> : <Chip tone="warn">Draft</Chip>}
            {can.edit && <button className="px-btn ghost ex-btn-sm" onClick={() => savePaper({ ...paper, locked: !paper.locked }, paper.locked ? 'paper_unlock' : 'paper_lock')}>{paper.locked ? 'Unlock' : 'Lock paper'}</button>}
          </div>}>
          <div className="ex-grid ex-g4" style={{ marginBottom: 14 }}>
            <Kpi k="Questions" v={paper.questions.length} sub={`${qTotal} in pattern`} />
            <Kpi k="Marks" v={paper.questions.reduce((t, q) => t + q.marks, 0)} />
            <Kpi k="Sets" v={paper.sets.join(' · ')} sub="question order shuffled per section" />
            <Kpi k="Difficulty" v={['Easy', 'Medium', 'Hard'].map(d => paper.questions.filter(q => q.difficulty === d).length).join(' / ')} sub="easy / medium / hard" />
          </div>
          <div className="ex-tablewrap" style={{ margin: '0 0 14px' }}>
            <table className="px-table">
              <thead><tr><th>Section</th><th>Q. numbers (set A)</th><th>Questions</th><th>Chapters</th><th>Marks</th></tr></thead>
              <tbody>{sectionRanges(exam, keyForSet(exam, paper, null, 'A')).map(r => (
                <tr key={r.index}><td><b>{r.name}</b><div style={{ fontSize: 11.5, color: PX.faint }}>{r.subject}</div></td><td>{r.from}–{r.to}</td>
                  <td>{r.count}{r.count < Number(r.questions) && <> <Chip tone="bad">short {Number(r.questions) - r.count}</Chip></>}</td>
                  <td>{new Set(paper.questions.filter(q => q.sec === r.index).map(q => q.chapter)).size}</td><td>{r.max}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {paper.sets.map(s => <button key={s} className="px-btn" onClick={() => printSet(s)}><PIcon.print size={14} />Booklet · Set {s}</button>)}
            <button className="px-btn ghost" onClick={printKeys}><PIcon.print size={14} />Answer keys</button>
            <button className="px-btn ghost" onClick={() => openPrint('OMR sheet', omrSheetHtml(exam, paper.questions.length, null))}><PIcon.print size={14} />Blank OMR sheet</button>
            <button className="px-btn ghost" onClick={() => setShowQs(v => !v)}>{showQs ? 'Hide questions' : 'Review questions & key'}</button>
            {can.edit && !paper.locked && <button className="px-btn ghost" style={{ color: PX.bad, marginLeft: 'auto' }} onClick={discard}>Discard paper</button>}
          </div>
          {showQs && (
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              <div style={{ fontSize: 12.5, color: PX.sub }}>Numbers are set A. Change an answer to revise the key after a challenge; <b>X</b> drops the question and gives its marks to everyone.</div>
              {paper.questions.map((q, i) => (
                <div key={i} className="ex-q">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <b style={{ color: PX.navy, minWidth: 26 }}>{i + 1}.</b>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: PX.ink, whiteSpace: 'pre-wrap' }}>{q.q}</div>
                      {q.img && <img src={q.img} alt="" style={{ maxHeight: 120, maxWidth: '100%', marginTop: 6, borderRadius: 8 }} />}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 4, marginTop: 6, fontSize: 12.5 }}>
                        {['a', 'b', 'c', 'd'].filter(k => q[k]).map(k => (
                          <div key={k} style={{ padding: '4px 8px', borderRadius: 8, background: q.correct === k.toUpperCase() ? PX.okBg : PX.tint, color: q.correct === k.toUpperCase() ? PX.ok : PX.ink2, fontWeight: q.correct === k.toUpperCase() ? 700 : 400 }}>({k.toUpperCase()}) {q[k]}</div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip tone="navy">{sections[q.sec]?.name}</Chip>{q.chapter && <Chip>{q.chapter}</Chip>}{q.difficulty && <Chip tone="gold">{q.difficulty}</Chip>}{q.revised && <Chip tone="warn">key revised</Chip>}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                      <select className="px-input" style={{ width: 78, padding: '6px 8px' }} value={q.correct} disabled={!can.edit} onChange={e => reviseKey(i, e.target.value)} aria-label={`Answer for question ${i + 1}`}>
                        {['A', 'B', 'C', 'D', 'X'].map(o => <option key={o} value={o}>{o === 'X' ? 'X drop' : o}</option>)}
                      </select>
                      {can.edit && !paper.locked && <button className="px-btn ghost ex-btn-sm" disabled={busy} onClick={() => replace(i)}>Replace</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PremiumCard>
      ) : (
        <PremiumCard title="Generate the paper from the Question Bank" subtitle={`${exam.course ? exam.course.toUpperCase() + ' questions plus untagged ones' : 'All courses'} · ${qTotal} questions across ${sections.length} sections`}>
          <div className="ex-tablewrap" style={{ margin: '0 0 16px' }}>
            <table className="px-table">
              <thead><tr><th>Section</th><th>QBank subject</th><th>Needed</th><th>Available</th><th>Not used before</th><th>Easy / Med / Hard</th></tr></thead>
              <tbody>{sections.map((s, i) => {
                const c = counts?.[i]
                return (
                  <tr key={i}><td><b>{s.name}</b></td><td>{s.subject}</td><td>{s.questions}</td>
                    <td>{c == null ? '…' : <span style={{ color: c.total < s.questions ? PX.bad : PX.ok, fontWeight: 700 }}>{c.total}</span>}</td>
                    <td>{c == null ? '…' : c.fresh}</td><td>{c == null ? '…' : c.byDiff.join(' / ')}</td></tr>
                )
              })}</tbody>
            </table>
          </div>
          {qTotal === 0 && <div style={{ color: PX.warn, fontSize: 13, marginBottom: 12 }}>This exam has no paper pattern yet — set sections and question counts in the Exams tab.</div>}
          <div className="ex-grid ex-g4" style={{ alignItems: 'end' }}>
            {['Easy', 'Medium', 'Hard'].map(d => (
              <Field key={d} label={`${d} %`}><input type="number" min="0" max="100" className="px-input" value={mix[d]} onChange={e => setMix(m => ({ ...m, [d]: Number(e.target.value) }))} /></Field>
            ))}
            <Field label="Paper sets"><select className="px-input" value={sets} onChange={e => setSets(Number(e.target.value))}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{SET_CODES.slice(0, n).join(', ')}</option>)}</select></Field>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '14px 0' }}>
            <input type="checkbox" checked={avoid} onChange={e => setAvoid(e.target.checked)} />Avoid questions used in earlier entrance papers ({used.size})
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="px-btn gold" disabled={!can.edit || busy || qTotal === 0} onClick={generate}>{busy ? 'Generating…' : '✦ Generate paper'}</button>
            <span style={{ fontSize: 12, color: PX.sub, alignSelf: 'center' }}>Questions are spread across chapters. Sets B–D shuffle the order within each section.</span>
          </div>
        </PremiumCard>
      )}

      {!hasPaper && <ManualKey exam={exam} sections={sections} rows={manualKeys} can={can} notify={notify} user={user} onSaved={() => setKeyVer(v => v + 1)} />}
    </div>
  )
}

// Paper set outside the Question Bank: type or paste each section's key.
function ManualKey({ exam, sections, rows, can, notify, user, onSaved }) {
  const fromRows = useMemo(() => sections.map(s => (rows || []).filter(r => r.subject === s.name || r.subject === s.subject).sort((a, b) => a.q_number - b.q_number).map(r => normKey(r.correct_option) || '-').join('')), [rows, sections])
  const [draft, setDraft] = useState(null)
  const vals = draft || fromRows
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const ins = []
    sections.forEach((s, si) => {
      const letters = (vals[si] || '').toUpperCase().replace(/[^ABCDX-]/g, '')
      ;[...letters].forEach((l, i) => ins.push({ exam_id: exam.id, subject: s.name, q_number: i + 1, correct_option: l === '-' ? '' : l, marks: Number(s.marks_each) || 1 }))
    })
    const del = await supabase.from('entrance_answer_keys').delete().eq('exam_id', exam.id)
    const res = del.error ? del : ins.length ? await supabase.from('entrance_answer_keys').insert(ins) : { error: null }
    setSaving(false)
    if (res.error) return notify(res.error.message, 'bad')
    audit('answer_key_manual', user, exam.id, { questions: ins.length })
    setDraft(null); notify('Answer key saved', 'ok'); onSaved()
  }

  return (
    <PremiumCard title="Or: enter the answer key by hand" subtitle="For a paper set outside the Question Bank. Question numbers run on across sections in this order.">
      {rows == null ? <div style={{ color: PX.sub }}>Loading…</div> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sections.map((s, si) => {
            const v = (vals[si] || '').toUpperCase().replace(/[^ABCDX-]/g, '')
            const need = Number(s.questions) || 0
            return (
              <Field key={si} label={`${s.name} · ${v.length}${need ? ` / ${need}` : ''} answers`} hint="Letters A–D in order, e.g. ABDCA… (X drops a question, - leaves it blank)">
                <input className="px-input ex-omr" value={v} disabled={!can.edit} onChange={e => setDraft(vals.map((x, j) => (j === si ? e.target.value : x)))} style={{ borderColor: need && v.length !== need ? PX.warn : undefined }} />
              </Field>
            )
          })}
          <div><button className="px-btn" disabled={!can.edit || saving || !draft} onClick={save}>{saving ? 'Saving…' : 'Save answer key'}</button></div>
        </div>
      )}
    </PremiumCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Seating & hall tickets
// ═══════════════════════════════════════════════════════════════════════════
export function HallTicketsTab({ exam, cands, can, reload, notify, user }) {
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState('')
  const [preview, setPreview] = useState(null)
  const paper = parseJson(exam.paper)
  const rooms = parseJson(exam.rooms, null)?.filter(r => r.name) || []
  const capacity = rooms.reduce((t, r) => t + (Number(r.capacity) || 0), 0)
  const elig = cands.map(c => ({ c, e: eligibility(c, exam) }))
  const eligible = elig.filter(x => x.e.ok).map(x => x.c)
  const issued = cands.filter(c => ['Hall Ticket Issued', 'Appeared', 'Absent'].includes(c.status))
  const seated = eligible.filter(c => c.room)
  const list = elig.filter(({ c }) => !q.trim() || [c.student_name, c.application_no, hallTicketNo(exam.id, c.roll_number)].join(' ').toLowerCase().includes(q.trim().toLowerCase()))

  const allot = async () => {
    if (!eligible.length) return notify('No eligible candidates to seat yet', 'warn')
    const plan = rooms.length ? rooms : [{ name: 'Hall 1', capacity: eligible.length }]
    const cap = plan.reduce((t, r) => t + (Number(r.capacity) || 0), 0)
    if (cap < eligible.length) return notify(`Rooms seat ${cap} but ${eligible.length} are eligible — add rooms in the exam set-up`, 'bad')
    setBusy('seat')
    const sets = paper?.sets?.length ? paper.sets : ['A']
    const updates = []
    let r = 0, seat = 0
    for (const c of [...eligible].sort((a, b) => (Number(a.roll_number) || 0) - (Number(b.roll_number) || 0))) {
      while (seat >= (Number(plan[r].capacity) || 0)) { r++; seat = 0 }
      seat++
      // Neighbouring seats get different sets.
      updates.push({ id: c.id, room: plan[r].name, seat_no: seat, paper_set: sets[(seat - 1) % sets.length] })
    }
    const res = await inChunks(updates, 25, u => safeWrite('entrance_candidates', 'update', { room: u.room, seat_no: u.seat_no, paper_set: u.paper_set }, { id: u.id }))
    setBusy('')
    const err = res.find(x => x.error)
    if (err) return notify(err.error.message, 'bad')
    if (res[0]?.dropped?.length) return notify('Seating needs the database upgrade (room, seat_no, paper_set)', 'bad')
    audit('seating_allot', user, exam.id, { candidates: updates.length, rooms: plan.length })
    notify(`Seated ${updates.length} candidates in ${new Set(updates.map(u => u.room)).size} room(s)`, 'ok'); reload()
  }

  const issue = async () => {
    const todo = eligible.filter(c => c.status === 'Registered')
    if (!todo.length) return notify('Every eligible candidate already has a hall ticket', 'warn')
    setBusy('issue')
    const { error } = await safeWrite('entrance_candidates', 'update', { status: 'Hall Ticket Issued' }, { id: todo.map(c => c.id) })
    setBusy('')
    if (error) return notify(error.message, 'bad')
    audit('halltickets_issue', user, exam.id, { count: todo.length })
    notify(`${todo.length} hall tickets issued${seated.length < eligible.length ? ' — some candidates are not seated yet' : ''}`, seated.length < eligible.length ? 'warn' : 'ok'); reload()
  }

  const printTickets = async targets => {
    if (!targets.length) return notify('No hall tickets to print', 'warn')
    const win = printWindow('hall tickets')
    if (!win) return
    const photos = await photoUrls(targets).catch(() => ({}))
    const qrs = await Promise.all(targets.map(c => qrFor(hallTicketNo(exam.id, c.roll_number))))
    openPrint(`Hall tickets · ${exam.exam_name}`, targets.map((c, i) => hallTicketHtml(c, exam, { photo: photos[c.id], qr: qrs[i] })).join(''), '', win)
  }

  const byRoom = useMemo(() => {
    const m = {}
    for (const c of cands.filter(c => c.room)) (m[c.room] ||= []).push(c)
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.seat_no || 0) - (b.seat_no || 0))
    return m
  }, [cands])
  const roomNames = Object.keys(byRoom)

  const printAttendance = async () => {
    if (!roomNames.length) return notify('Allot seats first', 'warn')
    const win = printWindow('attendance sheets')
    if (!win) return
    const photos = await photoUrls(cands.filter(c => c.room)).catch(() => ({}))
    openPrint(`Attendance · ${exam.exam_name}`, roomNames.map(r => attendanceSheetHtml(exam, r, byRoom[r], photos)).join(''), '', win)
  }
  const printSeating = () => {
    if (!roomNames.length) return notify('Allot seats first', 'warn')
    openPrint(`Seating plan · ${exam.exam_name}`, seatingPlanHtml(exam, roomNames.map(r => ({ name: r, count: byRoom[r].length, from: hallTicketNo(exam.id, byRoom[r][0].roll_number), to: hallTicketNo(exam.id, byRoom[r][byRoom[r].length - 1].roll_number) }))))
  }
  const printOMR = () => {
    const n = paper?.questions?.length || sectionRanges(exam, []).reduce((t, s) => t + (Number(s.questions) || 0), 0)
    if (!n) return notify('Generate the paper or set the pattern first', 'warn')
    const targets = issued.length ? issued : eligible
    openPrint(`OMR sheets · ${exam.exam_name}`, targets.map(c => omrSheetHtml(exam, n, c)).join(''))
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ex-grid ex-g4">
        <Kpi k="Eligible" v={eligible.length} sub={`${cands.length - eligible.length} not yet (verification / fee)`} />
        <Kpi k="Seated" v={seated.length} sub={rooms.length ? `${rooms.length} rooms · ${capacity} seats` : 'no rooms set — one hall'} />
        <Kpi k="Hall tickets issued" v={issued.length} tone="#8a6118" />
        <Kpi k="Paper sets" v={paper?.sets?.join(' · ') || 'A'} sub={paper ? 'rotated seat by seat' : 'paper not generated'} />
      </div>

      <PremiumCard title="Seating & hall tickets" subtitle="Seat eligible candidates room by room, issue tickets, then print"
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {can.edit && <button className="px-btn ghost ex-btn-sm" disabled={!!busy} onClick={allot}>{busy === 'seat' ? 'Seating…' : '① Allot seats'}</button>}
          {can.edit && <button className="px-btn ex-btn-sm" disabled={!!busy} onClick={issue}>{busy === 'issue' ? 'Issuing…' : '② Issue hall tickets'}</button>}
          <button className="px-btn gold ex-btn-sm" onClick={() => printTickets(issued)}><PIcon.print size={13} />③ Print all ({issued.length})</button>
        </div>}>
        <div className="ex-bar">
          <input className="px-input" style={{ maxWidth: 260 }} placeholder="Search candidate / roll no…" value={q} onChange={e => setQ(e.target.value)} />
          <span style={{ marginLeft: 'auto' }} />
          <button className="px-btn ghost ex-btn-sm" onClick={printSeating}><PIcon.print size={13} />Seating plan</button>
          <button className="px-btn ghost ex-btn-sm" onClick={printAttendance}><PIcon.print size={13} />Attendance sheets</button>
          <button className="px-btn ghost ex-btn-sm" onClick={printOMR}><PIcon.print size={13} />OMR sheets</button>
        </div>
        {cands.length === 0 ? <Empty icon="🎫" title="No applications yet" /> : (
          <div className="ex-tablewrap" style={{ marginTop: 0 }}>
            <table className="px-table">
              <thead><tr><th>Roll no.</th><th>Candidate</th><th>Eligibility</th><th>Room · Seat · Set</th><th>Status</th><th /></tr></thead>
              <tbody>{list.map(({ c, e }) => (
                <tr key={c.id}>
                  <td className="ex-mono" style={{ fontWeight: 700, fontSize: 12 }}>{hallTicketNo(exam.id, c.roll_number)}</td>
                  <td><div style={{ fontWeight: 700, color: PX.ink }}>{c.student_name}</div><div style={{ fontSize: 11.5, color: PX.faint }}>{c.application_no}</div></td>
                  <td>{e.ok ? <Chip tone="ok">Eligible</Chip> : e.reasons.map(r => <Chip key={r} tone="bad">{r}</Chip>)}</td>
                  <td>{c.room ? <>{c.room} · <b>{c.seat_no}</b> · <Chip tone="navy">{c.paper_set || 'A'}</Chip></> : <span style={{ color: PX.faint }}>—</span>}</td>
                  <td><StatusChip s={c.status} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="px-btn ghost ex-btn-sm" onClick={() => setPreview(c)}>Preview</button>{' '}
                    <button className="px-btn ghost ex-btn-sm" onClick={() => printTickets([c])} aria-label="Print"><PIcon.print size={13} /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </PremiumCard>
      {preview && <TicketPreview exam={exam} c={preview} onClose={() => setPreview(null)} onPrint={() => printTickets([preview])} />}
    </div>
  )
}

function TicketPreview({ exam, c, onClose, onPrint }) {
  const [assets, setAssets] = useState({ id: null })
  useEffect(() => {
    let live = true
    Promise.all([photoUrls([c]).catch(() => ({})), qrFor(hallTicketNo(exam.id, c.roll_number))])
      .then(([p, qr]) => { if (live) setAssets({ id: c.id, photo: p[c.id], qr }) })
    return () => { live = false }
  }, [c, exam.id])
  const ready = assets.id === c.id
  return (
    <Modal title="Hall ticket preview" subtitle={c.student_name} onClose={onClose} width={760}
      footer={<><button className="px-btn ghost" onClick={onClose}>Close</button><button className="px-btn gold" onClick={onPrint}><PIcon.print size={14} />Print</button></>}>
      {!eligibility(c, exam).ok && <div style={{ background: PX.warnBg, color: PX.warn, borderRadius: 10, padding: '8px 12px', fontSize: 12.5, marginBottom: 10 }}>Not eligible yet: {eligibility(c, exam).reasons.join(', ')}.</div>}
      {ready ? <iframe title="Hall ticket" sandbox="" srcDoc={wrapDoc('Hall ticket', hallTicketHtml(c, exam, assets))} style={{ width: '100%', height: 640, border: `1px solid ${PX.line}`, borderRadius: 12, background: '#fff' }} /> : <Empty icon="⏳" title="Preparing…" />}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Exam day — attendance by QR / roll scan, malpractice
// ═══════════════════════════════════════════════════════════════════════════
export function ExamDayTab({ exam, cands, can, reload, notify, user }) {
  const [scan, setScan] = useState('')
  const [last, setLast] = useState(null)
  const [room, setRoom] = useState('')
  const [q, setQ] = useState('')
  const [dq, setDq] = useState(null)
  const scanRef = useRef(null)
  const inHall = cands.filter(c => ['Hall Ticket Issued', 'Appeared', 'Absent', 'Disqualified'].includes(c.status) || c.room)
  const rooms = [...new Set(inHall.map(c => c.room).filter(Boolean))].sort()
  const list = inHall.filter(c => (!room || c.room === room) && (!q.trim() || [c.student_name, hallTicketNo(exam.id, c.roll_number), c.application_no].join(' ').toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => (a.room || '').localeCompare(b.room || '') || (a.seat_no || 0) - (b.seat_no || 0))
  const count = s => inHall.filter(c => c.status === s).length
  const unmarked = inHall.filter(c => !['Appeared', 'Absent', 'Disqualified'].includes(c.status))

  const setStatus = async (ids, status, extra = {}) => {
    const { error } = await safeWrite('entrance_candidates', 'update', { status, ...extra }, { id: ids })
    if (error) { notify(error.message, 'bad'); return false }
    audit('attendance', user, exam.id, { status, count: ids.length })
    reload(); return true
  }

  const onScan = async e => {
    e.preventDefault()
    const v = scan.trim().toUpperCase()
    if (!v) return
    const c = cands.find(x => hallTicketNo(exam.id, x.roll_number).toUpperCase() === v || String(x.application_no || '').toUpperCase() === v || (/^\d+$/.test(v) && Number(x.roll_number) === Number(v)))
    setScan('')
    if (!c) { setLast({ bad: `No candidate with roll / application no. ${v}` }); return }
    if (c.status === 'Disqualified') { setLast({ c, bad: 'Disqualified — do not admit' }); return }
    const warn = !['Hall Ticket Issued', 'Appeared', 'Absent'].includes(c.status) ? 'No hall ticket was issued' : ''
    if (c.status !== 'Appeared' && can.edit) await setStatus([c.id], 'Appeared')
    setLast({ c, warn, already: c.status === 'Appeared' })
    scanRef.current?.focus()
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ex-grid ex-g4">
        <Kpi k="Expected" v={inHall.length} sub={rooms.length ? `${rooms.length} rooms` : ''} />
        <Kpi k="Present" v={count('Appeared')} tone={PX.ok} />
        <Kpi k="Absent" v={count('Absent')} tone={PX.warn} />
        <Kpi k="Not marked" v={unmarked.length} tone={unmarked.length ? PX.bad : PX.sub} sub={count('Disqualified') ? `${count('Disqualified')} disqualified` : ''} />
      </div>

      <div className="ex-grid ex-side">
        <PremiumCard title="Gate check-in" subtitle="Scan the hall-ticket QR (USB/phone scanner) or type the roll number, then Enter"
          right={can.edit && <div style={{ display: 'flex', gap: 6 }}>
            {exam.status === 'Scheduled' && <button className="px-btn ex-btn-sm" onClick={async () => { const { error } = await safeWrite('entrance_exams', 'update', { status: 'Ongoing' }, { id: exam.id }); if (!error) { audit('exam_status', user, exam.id, { status: 'Ongoing' }); reload() } }}>▶ Start exam</button>}
            {exam.status === 'Ongoing' && <button className="px-btn ex-btn-sm" onClick={async () => { const { error } = await safeWrite('entrance_exams', 'update', { status: 'Completed' }, { id: exam.id }); if (!error) { audit('exam_status', user, exam.id, { status: 'Completed' }); reload() } }}>■ End exam</button>}
          </div>}>
          <form onSubmit={onScan} style={{ display: 'flex', gap: 8 }}>
            <input ref={scanRef} autoFocus className="px-input ex-mono" style={{ fontSize: 16 }} placeholder="GNSI/XXXX/0001 or 1" value={scan} onChange={e => setScan(e.target.value)} disabled={!can.edit} aria-label="Scan or type roll number" />
            <button className="px-btn" disabled={!can.edit}>Mark present</button>
          </form>
          {last && (
            <div style={{ marginTop: 14, borderRadius: 14, padding: '14px 16px', border: `1px solid ${last.bad ? '#f5c2bd' : last.warn ? '#f1d9a6' : '#bfe3cf'}`, background: last.bad ? PX.badBg : last.warn ? PX.warnBg : PX.okBg }}>
              {last.c && <div style={{ fontFamily: PX.serif, fontSize: 20, fontWeight: 600, color: PX.ink }}>{last.c.student_name}</div>}
              {last.c && <div style={{ fontSize: 13, color: PX.ink2, marginTop: 3 }}>{hallTicketNo(exam.id, last.c.roll_number)} · {last.c.room ? `${last.c.room}, seat ${last.c.seat_no}` : 'no seat'} · Set <b>{last.c.paper_set || 'A'}</b></div>}
              <div style={{ fontWeight: 700, marginTop: 6, color: last.bad ? PX.bad : last.warn ? PX.warn : PX.ok }}>{last.bad || (last.already ? '✓ Already marked present' : '✓ Marked present')}{last.warn ? ` · ${last.warn}` : ''}</div>
            </div>
          )}
        </PremiumCard>
        <PremiumCard title="Rooms">
          {rooms.length === 0 ? <div style={{ color: PX.sub, fontSize: 13 }}>No seating yet — allot seats in Hall Tickets.</div> : rooms.map(r => {
            const inR = inHall.filter(c => c.room === r)
            const p = inR.filter(c => c.status === 'Appeared').length
            return (
              <button key={r} onClick={() => setRoom(room === r ? '' : r)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '9px 10px', borderRadius: 10, border: `1px solid ${room === r ? PX.gold : 'transparent'}`, background: room === r ? PX.goldBg : 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                <b>{r}</b><span>{p}/{inR.length} present</span>
              </button>
            )
          })}
        </PremiumCard>
      </div>

      <PremiumCard title={room ? `Attendance · ${room}` : 'Attendance'} subtitle={`${list.length} candidates`}
        right={can.edit && unmarked.length > 0 && <button className="px-btn ghost ex-btn-sm" onClick={() => setStatus((room ? unmarked.filter(c => c.room === room) : unmarked).map(c => c.id), 'Absent')}>Mark {room ? 'room' : 'all'} unmarked absent</button>}>
        <div className="ex-bar"><input className="px-input" style={{ maxWidth: 260 }} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {list.length === 0 ? <Empty icon="🪑" title="No candidates">Issue hall tickets first.</Empty> : (
          <div className="ex-tablewrap" style={{ marginTop: 0 }}>
            <table className="px-table">
              <thead><tr><th>Room · Seat</th><th>Roll no.</th><th>Candidate</th><th>Set</th><th>Status</th><th /></tr></thead>
              <tbody>{list.map(c => (
                <tr key={c.id}>
                  <td>{c.room || '—'}{c.seat_no ? ` · ${c.seat_no}` : ''}</td>
                  <td className="ex-mono" style={{ fontSize: 12 }}>{hallTicketNo(exam.id, c.roll_number)}</td>
                  <td><b>{c.student_name}</b>{c.remarks && c.status === 'Disqualified' && <div style={{ fontSize: 11.5, color: PX.bad }}>{c.remarks}</div>}</td>
                  <td>{c.paper_set || 'A'}</td>
                  <td><StatusChip s={c.status} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{can.edit && <>
                    <button className="px-btn ghost ex-btn-sm" disabled={c.status === 'Appeared'} onClick={() => setStatus([c.id], 'Appeared')}>Present</button>{' '}
                    <button className="px-btn ghost ex-btn-sm" disabled={c.status === 'Absent'} onClick={() => setStatus([c.id], 'Absent')}>Absent</button>{' '}
                    <button className="px-btn ghost ex-btn-sm" style={{ color: PX.bad }} disabled={c.status === 'Disqualified'} onClick={() => setDq({ c, reason: '' })}>UFM</button>
                  </>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </PremiumCard>

      {dq && (
        <Modal title="Disqualify for unfair means" subtitle={dq.c.student_name} onClose={() => setDq(null)} width={480}
          footer={<><button className="px-btn ghost" onClick={() => setDq(null)}>Cancel</button>
            <button className="px-btn" style={{ background: PX.bad }} disabled={!dq.reason.trim()} onClick={async () => { if (await setStatus([dq.c.id], 'Disqualified', { remarks: `UFM: ${dq.reason.trim()}` })) { notify('Candidate disqualified', 'warn'); setDq(null) } }}>Disqualify</button></>}>
          <Field label="Reason (recorded on the candidate)"><textarea rows={3} className="px-input" autoFocus value={dq.reason} onChange={e => setDq({ ...dq, reason: e.target.value })} placeholder="e.g. copying from notes, found with phone" /></Field>
        </Modal>
      )}
    </div>
  )
}
