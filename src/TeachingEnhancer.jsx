// TeachingEnhancer.jsx — Study Materials → Teaching Enhancer.
// Four tools for staff, sharing one subject/chapter selection:
//   Readiness — what every chapter has, what's missing, what to prepare next
//   Class kit — best material of each type + a quick quiz, printable
//   Lesson planner — timed lesson plans with materials and a quiz attached
//   Requests — ask for missing material; admins track and fulfil
import { useEffect, useMemo, useState } from 'react'
import { PX, PIcon } from './premiumUI'
import { useQBankCountsByChapter } from './StudyMaterialBridge'
import {
  MATERIAL_KINDS, LEVELS, chapterReadiness, readinessSummary, buildClassKit, classKitHtml,
  BLOCK_KINDS, splitMinutes, defaultPlan, planMinutes, validatePlan, lessonPlanHtml, PLAN_STATUS,
  REQUEST_STATUS, requestFulfilled, pickQuiz,
} from './enhancerCore'
import { useLessonPlans, fetchChapterQuestions } from './enhancerHooks'

const kindMeta = key => MATERIAL_KINDS.find(k => k.key === key) || { key, label: key, icon: '📄' }

function openPrintable(html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const w = window.open(url, '_blank')
  if (!w) { const a = document.createElement('a'); a.href = url; a.download = 'teaching.html'; a.click() }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// ── small premium bits ───────────────────────────────────────────────────────
const chip = (tone, bg) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: tone, background: bg, whiteSpace: 'nowrap' })
const label = { display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub, marginBottom: 5 }
const muted = { fontSize: 12.5, color: PX.sub }

function Stars({ value = 0, onRate, size = 16, labelText }) {
  return (
    <span role={onRate ? 'radiogroup' : undefined} aria-label={labelText} style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(n => onRate
        ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onRate(n)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: size, lineHeight: 1, color: n <= value ? PX.gold : PX.line2 }}>★</button>
        : <span key={n} style={{ fontSize: size, lineHeight: 1, color: n <= Math.round(value) ? PX.gold : PX.line2 }}>★</span>)}
    </span>
  )
}
export { Stars }

function ScoreBar({ score }) {
  const lvl = LEVELS[score >= 70 ? 'ready' : score >= 35 ? 'partial' : 'thin']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 99, background: '#f1ede3', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', borderRadius: 99, background: lvl.tone }} />
      </div>
      <b style={{ fontSize: 12, color: lvl.tone, fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'right' }}>{score}</b>
    </div>
  )
}

function Section({ title, subtitle, right, children }) {
  return (
    <div className="px-card" style={{ marginBottom: 16 }}>
      <div className="px-card-h"><span className="bar" /><div style={{ flex: 1, minWidth: 0 }}><div className="px-card-t">{title}</div>{subtitle && <div className="px-card-s">{subtitle}</div>}</div>{right}</div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

function Notice({ children }) {
  return <div role="status" style={{ padding: '12px 16px', borderRadius: 12, background: PX.warnBg, color: PX.warn, border: '1px solid #f3dca8', fontSize: 13, marginBottom: 14, overflowWrap: 'anywhere' }}>{children}</div>
}

const MIGRATION_NOTE = <>This part needs the database update <code>supabase/migrations/20260927_teaching_enhancer.sql</code> (run it in the Supabase SQL editor after <code>20260925_qbank_rls.sql</code>).</>

// ── Picker shared by all four tools ─────────────────────────────────────────
function ChapterPicker({ courseData, subject, chapter, onChange, allowAllChapters }) {
  const subjects = Object.keys(courseData.subjects)
  const chapters = courseData.subjects[subject]?.chapters || []
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 200, flex: '1 1 200px' }}>
        <label style={label} htmlFor="te-subject">Subject</label>
        <select id="te-subject" className="px-input" value={subject} onChange={e => onChange(e.target.value, '')}>
          {subjects.map(s => <option key={s} value={s}>{courseData.subjects[s].icon} {s}</option>)}
        </select>
      </div>
      {chapter !== undefined && (
        <div style={{ minWidth: 220, flex: '2 1 260px' }}>
          <label style={label} htmlFor="te-chapter">Chapter</label>
          <select id="te-chapter" className="px-input" value={chapter} onChange={e => onChange(subject, e.target.value)}>
            <option value="">{allowAllChapters ? 'All chapters' : 'Choose a chapter…'}</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

// ══ 1. READINESS ═════════════════════════════════════════════════════════════
function Readiness({ courseData, materials, subject, setSel, qCounts, qLoading, canTeach, requests, go }) {
  const chapters = useMemo(() => courseData.subjects[subject]?.chapters || [], [courseData, subject])
  const rows = useMemo(() => chapterReadiness({ subject, chapters, materials, qCounts: canTeach ? qCounts : {} }), [subject, chapters, materials, qCounts, canTeach])
  const sum = readinessSummary(rows)
  const [filter, setFilter] = useState('all')
  const shown = rows.filter(r => filter === 'all' || r.level === filter)
  const openReq = ch => requests.filter(r => r.subject === subject && r.chapter === ch && ['open', 'in_progress'].includes(r.status)).length

  return (
    <>
      <Section title="Chapter readiness" subtitle="What each chapter has, what's missing, and a readiness score (materials + Question Bank questions)."
        right={<ChapterPicker courseData={courseData} subject={subject} onChange={s => setSel(s, '')} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { k: 'all', t: 'Average score', v: `${sum.avg}`, tone: PX.navy },
            { k: 'ready', t: LEVELS.ready.label, v: sum.ready, tone: LEVELS.ready.tone },
            { k: 'partial', t: LEVELS.partial.label, v: sum.partial, tone: LEVELS.partial.tone },
            { k: 'thin', t: LEVELS.thin.label, v: sum.thin, tone: LEVELS.thin.tone },
          ].map(s => (
            <button key={s.k} type="button" onClick={() => setFilter(s.k)} aria-pressed={filter === s.k}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', border: `1.5px solid ${filter === s.k ? PX.gold : PX.line}`, background: filter === s.k ? PX.goldBg : '#fff' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub }}>{s.t}</div>
              <div style={{ fontFamily: PX.serif, fontSize: 26, fontWeight: 600, color: s.tone, marginTop: 4 }}>{s.v}</div>
            </button>
          ))}
        </div>
        {sum.next.length > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: PX.tint, border: `1px dashed ${PX.line2}`, marginBottom: 14, fontSize: 13 }}>
            <b style={{ color: PX.navy }}>Prepare next:</b>{' '}
            {sum.next.map((r, i) => <span key={r.chapter}>{i ? ' · ' : ''}<button type="button" onClick={() => go('kit', subject, r.chapter)} style={{ border: 'none', background: 'none', color: PX.navy2, textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>{r.chapter}</button> <span style={{ color: PX.faint }}>({r.score})</span></span>)}
          </div>
        )}
        {!canTeach && <div style={{ ...muted, marginBottom: 10 }}>Question Bank counts are hidden for your role, so scores count materials only.</div>}
        {chapters.length === 0 ? <div style={muted}>No chapters in this subject yet.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="px-table" aria-label="Chapter readiness">
              <thead><tr><th>Chapter</th>{MATERIAL_KINDS.map(k => <th key={k.key} title={k.label} style={{ textAlign: 'center' }}>{k.icon}</th>)}<th style={{ textAlign: 'center' }}>Qs</th><th style={{ minWidth: 150 }}>Score</th><th /></tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.chapter}>
                    <td style={{ fontWeight: 600, color: PX.ink }}>{r.chapter}{openReq(r.chapter) > 0 && <span style={{ ...chip(PX.warn, PX.warnBg), marginLeft: 6 }}>{openReq(r.chapter)} request{openReq(r.chapter) > 1 ? 's' : ''}</span>}</td>
                    {MATERIAL_KINDS.map(k => <td key={k.key} style={{ textAlign: 'center', color: r.byType[k.key] ? PX.ok : PX.line2, fontWeight: 700 }} aria-label={`${k.label}: ${r.byType[k.key] || 0}`}>{r.byType[k.key] ? r.byType[k.key] : '—'}</td>)}
                    <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{qLoading ? '…' : canTeach ? r.questions : '—'}</td>
                    <td><ScoreBar score={r.score} /></td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => go('kit', subject, r.chapter)} aria-label={`Class kit for ${r.chapter}`}>Kit</button>{' '}
                      <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => go('planner', subject, r.chapter)} aria-label={`Plan a lesson for ${r.chapter}`}>Plan</button>{' '}
                      {r.missing.length > 0 && <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => go('requests', subject, r.chapter, { material_type: r.missing[0] })} aria-label={`Request material for ${r.chapter}`}>Request</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}

// ══ 2. CLASS KIT ═════════════════════════════════════════════════════════════
function ClassKit({ courseData, courseLabel, materials, subject, chapter, setSel, feedback, canTeach, go, showToast }) {
  const [questions, setQuestions] = useState([])
  const [seed, setSeed] = useState(1)
  const [quizSize, setQuizSize] = useState(10)
  const [loadedFor, setLoadedFor] = useState('')
  const key = `${subject}␟${chapter}`

  useEffect(() => {
    if (!chapter || !canTeach) return
    let live = true
    fetchChapterQuestions(subject, chapter).then(qs => { if (live) { setQuestions(qs); setLoadedFor(key) } })
    return () => { live = false }
  }, [subject, chapter, canTeach, key])
  const loading = !!chapter && canTeach && loadedFor !== key
  const qs = useMemo(() => (loadedFor === key ? questions : []), [loadedFor, key, questions])

  const kit = useMemo(() => buildClassKit({ subject, chapter, materials, questions: qs, feedback: feedback.byId, quizSize, seed }), [subject, chapter, materials, qs, feedback.byId, quizSize, seed])

  const copyQuiz = async () => {
    const text = [`${chapter} — Quick quiz`, ...kit.quiz.map((q, i) => `${i + 1}. ${q.question}\n   ${['a', 'b', 'c', 'd'].filter(l => q[`option_${l}`]).map(l => `(${l.toUpperCase()}) ${q[`option_${l}`]}`).join('  ')}`), '', `Answers: ${kit.quiz.map((q, i) => `${i + 1}-${q.correct_option || '—'}`).join(', ')}`].join('\n')
    try { await navigator.clipboard.writeText(text); showToast('Quiz copied', PX.ok) } catch { showToast('Copy failed — your browser blocked the clipboard', PX.bad) }
  }

  return (
    <Section title="One-click class kit" subtitle="The best-rated material of each type for the chapter, plus a quick quiz from the Question Bank.">
      <ChapterPicker courseData={courseData} subject={subject} chapter={chapter} onChange={setSel} />
      {!chapter ? <div style={{ ...muted, marginTop: 14 }}>Choose a chapter to build its kit.</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 10, margin: '16px 0' }}>
            {kit.items.map(({ kind, material }) => {
              const k = kindMeta(kind), f = material ? feedback.byId[String(material.id)] : null
              return (
                <div key={kind} style={{ padding: '12px 14px', borderRadius: 14, border: `1px solid ${material ? PX.line : PX.line2}`, background: material ? '#fff' : PX.tint, borderStyle: material ? 'solid' : 'dashed' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub }}>{k.icon} {k.label}</div>
                  {material ? (
                    <>
                      <div style={{ fontWeight: 700, color: PX.ink, marginTop: 6, fontSize: 13.5 }}>{material.title}</div>
                      {f?.count > 0 && <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Stars value={f.avg} size={13} /><span style={{ fontSize: 11, color: PX.sub }}>{f.avg} · {f.count}</span></div>}
                      {material.file_url && <a href={material.file_url} target="_blank" rel="noreferrer" className="px-btn ghost" style={{ marginTop: 8, padding: '6px 10px', fontSize: 12, textDecoration: 'none' }}>Open</a>}
                    </>
                  ) : (
                    <>
                      <div style={{ ...muted, marginTop: 6 }}>Not available yet</div>
                      <button type="button" className="px-btn ghost" style={{ marginTop: 8, padding: '6px 10px', fontSize: 12 }} onClick={() => go('requests', subject, chapter, { material_type: kind })}>Request it</button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {kit.extras.length > 0 && <div style={{ ...muted, marginBottom: 12 }}>Also for this chapter: {kit.extras.map(m => m.title).join(' · ')}</div>}

          <div style={{ borderTop: `1px solid ${PX.line}`, paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <b style={{ fontFamily: PX.serif, fontSize: 16, color: PX.ink }}>Quick quiz</b>
              <span style={muted}>{!canTeach ? 'Question Bank is hidden for your role.' : loading ? 'Loading questions…' : `${kit.quiz.length} of ${qs.length} questions`}</span>
              <span style={{ flex: 1 }} />
              <label style={{ ...muted, display: 'flex', alignItems: 'center', gap: 6 }}>Questions
                <select className="px-input" style={{ width: 80, padding: '6px 8px' }} value={quizSize} onChange={e => setQuizSize(Number(e.target.value))} aria-label="Quiz size">
                  {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => setSeed(s => s + 1)} disabled={!qs.length}>Shuffle</button>
            </div>
            {kit.quiz.length > 0 ? (
              <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8 }}>
                {kit.quiz.map(q => (
                  <li key={q.id} style={{ fontSize: 13.5, color: PX.ink2 }}>
                    {q.question} <span style={{ ...chip(PX.sub, '#f3f0e8'), marginLeft: 4 }}>{q.difficulty || '—'}</span>
                    <div style={{ fontSize: 12.5, color: PX.sub, marginTop: 2 }}>{['a', 'b', 'c', 'd'].filter(l => q[`option_${l}`]).map(l => `(${l.toUpperCase()}) ${q[`option_${l}`]}`).join('   ')}</div>
                  </li>
                ))}
              </ol>
            ) : canTeach && !loading && <div style={muted}>No Question Bank questions for this chapter yet.</div>}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="button" className="px-btn" onClick={() => openPrintable(classKitHtml({ kit, courseLabel, subject, chapter }))}><PIcon.print size={15} /> Print kit</button>
            <button type="button" className="px-btn ghost" onClick={copyQuiz} disabled={!kit.quiz.length}>Copy quiz</button>
            <button type="button" className="px-btn gold" onClick={() => go('planner', subject, chapter, { kit })}>Plan a lesson with this kit</button>
          </div>
        </>
      )}
    </Section>
  )
}

// ══ 3. LESSON PLANNER ════════════════════════════════════════════════════════
function PlanEditor({ plan, setPlan, courseData, materials, canTeach, onSave, onCancel, onPrint, saving }) {
  const chapterMats = materials.filter(m => m.subject === plan.subject && m.chapter === plan.chapter)
  const [pool, setPool] = useState([])
  useEffect(() => {
    if (!canTeach || !plan.chapter) return
    let live = true
    fetchChapterQuestions(plan.subject, plan.chapter).then(qs => { if (live) setPool(qs) })
    return () => { live = false }
  }, [plan.subject, plan.chapter, canTeach])
  const errors = validatePlan(plan)
  const total = planMinutes(plan)
  const set = patch => setPlan(p => ({ ...p, ...patch }))
  const setBlock = (i, patch) => set({ blocks: plan.blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)) })
  const move = (i, d) => { const b = [...plan.blocks]; const j = i + d; if (j < 0 || j >= b.length) return; [b[i], b[j]] = [b[j], b[i]]; set({ blocks: b }) }
  const resplit = () => { const m = splitMinutes(plan.duration_min); set({ blocks: plan.blocks.map((b, i) => ({ ...b, minutes: m[i] ?? b.minutes })) }) }
  const toggleMat = id => set({ material_ids: plan.material_ids.includes(id) ? plan.material_ids.filter(x => x !== id) : [...plan.material_ids, id] })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={label} htmlFor="lp-title">Title</label><input id="lp-title" className="px-input" value={plan.title} onChange={e => set({ title: e.target.value })} /></div>
        <div><label style={label} htmlFor="lp-subject">Subject</label>
          <select id="lp-subject" className="px-input" value={plan.subject} onChange={e => set({ subject: e.target.value, chapter: '', material_ids: [], question_ids: [] })}>
            {Object.keys(courseData.subjects).map(s => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><label style={label} htmlFor="lp-chapter">Chapter</label>
          <select id="lp-chapter" className="px-input" value={plan.chapter} onChange={e => set({ chapter: e.target.value, material_ids: [], question_ids: [] })}>
            <option value="">Choose…</option>
            {(courseData.subjects[plan.subject]?.chapters || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div><label style={label} htmlFor="lp-class">Class / section</label><input id="lp-class" className="px-input" placeholder="e.g. Class 6 · A" value={plan.class_label || ''} onChange={e => set({ class_label: e.target.value })} /></div>
        <div><label style={label} htmlFor="lp-duration">Duration (min)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input id="lp-duration" type="number" min={5} max={180} className="px-input" value={plan.duration_min} onChange={e => set({ duration_min: Math.max(5, Number(e.target.value) || 5) })} />
            <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={resplit} title="Share the time across the steps again">Re-time</button>
          </div></div>
        <div><label style={label} htmlFor="lp-status">Status</label>
          <select id="lp-status" className="px-input" value={plan.status} onChange={e => set({ status: e.target.value, taught_on: e.target.value === 'taught' ? (plan.taught_on || new Date().toISOString().slice(0, 10)) : plan.taught_on })}>
            {Object.entries(PLAN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={label} htmlFor="lp-obj">Learning objectives</label><textarea id="lp-obj" className="px-input" rows={2} value={plan.objectives || ''} onChange={e => set({ objectives: e.target.value })} /></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '18px 0 8px' }}>
        <b style={{ fontFamily: PX.serif, fontSize: 16, color: PX.ink }}>Lesson flow</b>
        <span style={{ ...muted, color: total === Number(plan.duration_min) ? PX.ok : PX.bad }}>{total} / {plan.duration_min} min</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {plan.blocks.map((b, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 90px auto', gap: 8, alignItems: 'start', padding: 10, borderRadius: 12, border: `1px solid ${PX.line}`, background: '#fff' }}>
            <div style={{ fontFamily: PX.serif, fontSize: 18, color: PX.gold, textAlign: 'center', paddingTop: 6 }}>{i + 1}</div>
            <div>
              <input className="px-input" value={b.title} onChange={e => setBlock(i, { title: e.target.value })} aria-label={`Step ${i + 1} title`} />
              <textarea className="px-input" rows={2} style={{ marginTop: 6 }} placeholder={BLOCK_KINDS.find(k => k.kind === b.kind)?.hint || 'What happens in this step'} value={b.notes || ''} onChange={e => setBlock(i, { notes: e.target.value })} aria-label={`Step ${i + 1} notes`} />
            </div>
            <input type="number" min={1} className="px-input" value={b.minutes} onChange={e => setBlock(i, { minutes: Math.max(1, Number(e.target.value) || 1) })} aria-label={`Step ${i + 1} minutes`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" className="px-btn ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`}>↑</button>
              <button type="button" className="px-btn ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`}>↓</button>
              <button type="button" className="px-btn ghost" style={{ padding: '3px 8px', fontSize: 12, color: PX.bad }} onClick={() => set({ blocks: plan.blocks.filter((_, k) => k !== i) })} aria-label={`Remove step ${i + 1}`}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="px-btn ghost" style={{ marginTop: 8, fontSize: 12.5 }} onClick={() => set({ blocks: [...plan.blocks, { kind: 'custom', title: 'New step', minutes: 5, notes: '' }] })}>+ Add step</button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap: 16, marginTop: 18 }}>
        <div>
          <label style={label}>Materials for this class</label>
          {!plan.chapter ? <div style={muted}>Choose a chapter first.</div> : chapterMats.length === 0 ? <div style={muted}>No materials for this chapter yet.</div> : (
            <div style={{ display: 'grid', gap: 6 }}>
              {chapterMats.map(m => (
                <label key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: PX.ink2, cursor: 'pointer' }}>
                  <input type="checkbox" checked={plan.material_ids.includes(m.id)} onChange={() => toggleMat(m.id)} style={{ accentColor: PX.gold }} />
                  {kindMeta(m.material_type || 'notes').icon} {m.title}
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <label style={label}>Quick quiz</label>
          {!canTeach ? <div style={muted}>Question Bank is hidden for your role.</div> : !plan.chapter ? <div style={muted}>Choose a chapter first.</div> : (
            <>
              <div style={muted}>{plan.question_ids.length} question{plan.question_ids.length === 1 ? '' : 's'} attached · {pool.length} in the bank for this chapter</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {[5, 10].map(n => <button key={n} type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} disabled={!pool.length} onClick={() => set({ question_ids: pickQuiz(pool, n, Date.now() % 100000).map(q => q.id) })}>Pick {n}</button>)}
                {plan.question_ids.length > 0 && <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => set({ question_ids: [] })}>Clear</button>}
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ marginTop: 14 }}><label style={label} htmlFor="lp-hw">Homework</label><textarea id="lp-hw" className="px-input" rows={2} value={plan.homework || ''} onChange={e => set({ homework: e.target.value })} /></div>

      {errors.length > 0 && <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: PX.bad }}>{errors.join(' ')}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" className="px-btn" disabled={saving || errors.length > 0} onClick={onSave}>{saving ? 'Saving…' : 'Save plan'}</button>
        <button type="button" className="px-btn ghost" onClick={() => onPrint(plan, pool)}><PIcon.print size={15} /> Print</button>
        <button type="button" className="px-btn ghost" onClick={onCancel}>Close</button>
      </div>
    </div>
  )
}

function Planner({ course, courseData, courseLabel, materials, subject, chapter, setSel, canTeach, isAdmin, authorName, myEmail, handoff, clearHandoff, showToast }) {
  const api = useLessonPlans()
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [scope, setScope] = useState('all')
  const [duration, setDuration] = useState(40)

  // "Plan a lesson with this kit" from the Class kit tab.
  useEffect(() => {
    if (!handoff) return
    const p = defaultPlan({ course, subject, chapter, duration, author: authorName })
    if (handoff.kit) {
      p.material_ids = handoff.kit.items.filter(i => i.material).map(i => i.material.id)
      p.question_ids = handoff.kit.quiz.map(q => q.id)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hand-off from another tab
    setEditing(p)
    clearHandoff()
  }, [handoff]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = p => myEmail && String(p.author_email || '').toLowerCase() === myEmail
  const list = api.plans.filter(p => p.course === course && (!subject || p.subject === subject) && (!chapter || p.chapter === chapter) && (scope === 'all' || mine(p)))

  const save = async () => {
    setSaving(true)
    const { data, error } = await api.save(editing)
    setSaving(false)
    if (error) { showToast('Save failed: ' + error.message, PX.bad); return }
    setEditing(data); showToast('Lesson plan saved', PX.ok)
  }
  const print = async (plan, pool) => {
    const qs = pool?.length ? pool : (canTeach ? await fetchChapterQuestions(plan.subject, plan.chapter) : [])
    const byId = new Map(qs.map(q => [q.id, q]))
    openPrintable(lessonPlanHtml({ plan, courseLabel, materials: materials.filter(m => (plan.material_ids || []).includes(m.id)), questions: (plan.question_ids || []).map(id => byId.get(id)).filter(Boolean) }))
  }
  const duplicate = p => {
    const copy = { ...p, title: `${p.title} (copy)`, status: 'draft', taught_on: null, author_name: authorName }
    ;['id', 'author_email', 'created_at', 'updated_at'].forEach(k => delete copy[k])
    setEditing(copy)
  }
  const remove = async p => {
    if (!confirm(`Delete "${p.title}"?`)) return
    const { error } = await api.remove(p.id)
    showToast(error ? 'Delete failed: ' + error.message : 'Plan deleted', error ? PX.bad : PX.ok)
  }

  if (!api.available) return <Section title="Lesson planner"><Notice>{MIGRATION_NOTE}</Notice></Section>

  if (editing) {
    return (
      <Section title={editing.id ? 'Edit lesson plan' : 'New lesson plan'} subtitle={`${courseLabel} · ${editing.subject}${editing.chapter ? ` · ${editing.chapter}` : ''}`}>
        <PlanEditor plan={editing} setPlan={setEditing} courseData={courseData} materials={materials} canTeach={canTeach} saving={saving}
          onSave={save} onCancel={() => setEditing(null)} onPrint={print} />
      </Section>
    )
  }

  return (
    <Section title="Lesson planner" subtitle="Timed lesson plans with materials and a quiz attached — printable, reusable and shared with the staff room."
      right={<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="number" min={5} max={180} className="px-input" style={{ width: 80, padding: '8px 10px' }} value={duration} onChange={e => setDuration(Math.max(5, Number(e.target.value) || 40))} aria-label="New plan duration in minutes" />
        <span style={muted}>min</span>
        <button type="button" className="px-btn gold" disabled={!chapter} title={chapter ? '' : 'Choose a chapter first'} onClick={() => setEditing(defaultPlan({ course, subject, chapter, duration, author: authorName }))}><PIcon.plus size={15} /> New plan</button>
      </div>}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1 }}><ChapterPicker courseData={courseData} subject={subject} chapter={chapter} onChange={setSel} allowAllChapters /></div>
        <div className="px-tabs" style={{ marginBottom: 0 }} role="tablist" aria-label="Whose plans">
          {[['all', 'All staff'], ['mine', 'My plans']].map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={scope === k} className={'px-tab' + (scope === k ? ' on' : '')} onClick={() => setScope(k)}>{t}</button>)}
        </div>
      </div>
      {api.loading ? <div style={muted}>Loading plans…</div> : list.length === 0 ? (
        <div style={{ ...muted, padding: '18px 0' }}>No lesson plans here yet.{chapter ? ' Click “New plan” to write one.' : ' Choose a chapter, then “New plan”.'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(280px,100%),1fr))', gap: 12 }}>
          {list.map(p => {
            const st = PLAN_STATUS[p.status] || PLAN_STATUS.draft
            const canEdit = isAdmin || mine(p)
            return (
              <div key={p.id} style={{ padding: 14, borderRadius: 16, border: `1px solid ${PX.line}`, background: '#fff', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={chip(st.tone, st.bg)}>{st.label}</span><span style={{ ...muted, fontSize: 11.5 }}>{p.duration_min} min{p.class_label ? ` · ${p.class_label}` : ''}</span></div>
                <div style={{ fontFamily: PX.serif, fontSize: 16, color: PX.ink, fontWeight: 600 }}>{p.title}</div>
                <div style={{ ...muted, fontSize: 12 }}>{p.subject} · {p.chapter}</div>
                <div style={{ ...muted, fontSize: 11.5 }}>{(p.material_ids || []).length} materials · {(p.question_ids || []).length} quiz questions{p.author_name ? ` · by ${p.author_name}` : ''}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => (canEdit ? setEditing({ ...p, material_ids: p.material_ids || [], question_ids: p.question_ids || [], blocks: p.blocks || [] }) : print(p))}>{canEdit ? 'Open' : 'View'}</button>
                  <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => print(p)} aria-label={`Print ${p.title}`}>Print</button>
                  <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => duplicate(p)} aria-label={`Duplicate ${p.title}`}>Duplicate</button>
                  {canEdit && <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12, color: PX.bad }} onClick={() => remove(p)} aria-label={`Delete ${p.title}`}>Delete</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ══ 4. REQUESTS ══════════════════════════════════════════════════════════════
function Requests({ course, courseData, materials, subject, chapter, setSel, isAdmin, authorName, myEmail, requestsApi, handoff, clearHandoff, showToast }) {
  const [form, setForm] = useState({ material_type: 'notes', priority: 'normal', note: '' })
  const [filter, setFilter] = useState('active')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!handoff) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hand-off from another tab
    setForm(f => ({ ...f, material_type: handoff.material_type || f.material_type }))
    clearHandoff()
  }, [handoff]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!requestsApi.available) return <Section title="Material requests"><Notice>{MIGRATION_NOTE}</Notice></Section>

  const mine = r => myEmail && String(r.author_email || '').toLowerCase() === myEmail
  const list = requestsApi.requests.filter(r => r.course === course && (
    filter === 'active' ? ['open', 'in_progress'].includes(r.status) : filter === 'mine' ? mine(r) : true))

  const submit = async () => {
    if (!chapter) { showToast('Choose a chapter', PX.warn); return }
    setBusy(true)
    const { error } = await requestsApi.create({ course, subject, chapter, material_type: form.material_type, priority: form.priority, note: form.note.trim() || null, requested_by: authorName || null })
    setBusy(false)
    if (error) { showToast('Request failed: ' + error.message, PX.bad); return }
    setForm(f => ({ ...f, note: '' })); showToast('Request sent to the admins', PX.ok)
  }
  const setStatus = async (r, status) => {
    const admin_note = status === 'declined' ? (prompt('Reason for declining (optional):') ?? null) : r.admin_note
    const { error } = await requestsApi.update(r.id, { status, admin_note, handled_by: authorName || null })
    showToast(error ? 'Update failed: ' + error.message : `Marked ${REQUEST_STATUS[status].label.toLowerCase()}`, error ? PX.bad : PX.ok)
  }
  const cancel = async r => {
    if (!confirm('Withdraw this request?')) return
    const { error } = await requestsApi.remove(r.id)
    showToast(error ? 'Failed: ' + error.message : 'Request withdrawn', error ? PX.bad : PX.ok)
  }

  return (
    <>
      <Section title="Request missing material" subtitle="Ask for notes, practice sets, videos… for a chapter. Admins see every request and mark it done.">
        <ChapterPicker courseData={courseData} subject={subject} chapter={chapter} onChange={setSel} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 10 }}>
          <div><label style={label} htmlFor="rq-type">Material type</label>
            <select id="rq-type" className="px-input" value={form.material_type} onChange={e => setForm(f => ({ ...f, material_type: e.target.value }))}>
              {MATERIAL_KINDS.map(k => <option key={k.key} value={k.key}>{k.icon} {k.label}</option>)}
            </select></div>
          <div><label style={label} htmlFor="rq-pri">Priority</label>
            <select id="rq-pri" className="px-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="normal">Normal</option><option value="urgent">Urgent — needed this week</option>
            </select></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={label} htmlFor="rq-note">Note (optional)</label>
            <input id="rq-note" className="px-input" placeholder="e.g. worksheet with 20 word problems" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
        </div>
        <button type="button" className="px-btn" style={{ marginTop: 12 }} disabled={busy || !chapter} onClick={submit}>{busy ? 'Sending…' : 'Send request'}</button>
      </Section>

      <Section title="Requests" subtitle={isAdmin ? 'Mark requests as you prepare the material.' : 'Track what you and colleagues have asked for.'}
        right={<div className="px-tabs" style={{ marginBottom: 0 }} role="tablist" aria-label="Request filter">
          {[['active', 'Open'], ['mine', 'Mine'], ['all', 'All']].map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={filter === k} className={'px-tab' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{t}</button>)}
        </div>}>
        {requestsApi.loading ? <div style={muted}>Loading…</div> : list.length === 0 ? <div style={muted}>No requests here.</div> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {list.map(r => {
              const st = REQUEST_STATUS[r.status] || REQUEST_STATUS.open
              const nowThere = ['open', 'in_progress'].includes(r.status) && requestFulfilled(r, materials)
              return (
                <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, border: `1px solid ${r.priority === 'urgent' && st !== REQUEST_STATUS.done ? '#f3c3bd' : PX.line}`, background: '#fff' }}>
                  <div style={{ fontSize: 22 }}>{kindMeta(r.material_type).icon}</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: PX.ink, fontSize: 13.5 }}>{kindMeta(r.material_type).label} · {r.chapter || r.subject}
                      {' '}<span style={chip(st.tone, st.bg)}>{st.label}</span>
                      {r.priority === 'urgent' && <span style={{ ...chip(PX.bad, PX.badBg), marginLeft: 4 }}>Urgent</span>}
                      {nowThere && <span style={{ ...chip(PX.ok, PX.okBg), marginLeft: 4 }}>Now available</span>}
                    </div>
                    <div style={{ ...muted, fontSize: 12, marginTop: 2 }}>{r.subject}{r.requested_by ? ` · ${r.requested_by}` : ''} · {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{r.note ? ` · “${r.note}”` : ''}{r.admin_note ? ` · Admin: ${r.admin_note}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {isAdmin && r.status !== 'in_progress' && r.status !== 'done' && <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setStatus(r, 'in_progress')}>Start</button>}
                    {isAdmin && r.status !== 'done' && <button type="button" className="px-btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setStatus(r, 'done')}>Done</button>}
                    {isAdmin && ['open', 'in_progress'].includes(r.status) && <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setStatus(r, 'declined')}>Decline</button>}
                    {!isAdmin && mine(r) && r.status === 'open' && <button type="button" className="px-btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => cancel(r)}>Withdraw</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}

// ══ Shell ═════════════════════════════════════════════════════════════════════
const SECTIONS = [
  { id: 'readiness', label: 'Readiness', icon: PIcon.chart },
  { id: 'kit', label: 'Class kit', icon: PIcon.layers },
  { id: 'planner', label: 'Lesson planner', icon: PIcon.pen },
  { id: 'requests', label: 'Requests', icon: PIcon.message },
]

export default function TeachingEnhancer({ course, courseData, courseLabel, materials, currentUser, isAdmin, canTeach, feedback, requestsApi, showToast }) {
  const subjects = Object.keys(courseData.subjects)
  const [section, setSection] = useState('readiness')
  const [sel, setSelState] = useState({ subject: subjects[0] || '', chapter: '' })
  const [handoff, setHandoff] = useState(null)
  // Keep the subject valid when the course changes.
  const subject = subjects.includes(sel.subject) ? sel.subject : (subjects[0] || '')
  const chapter = subject === sel.subject ? sel.chapter : ''
  const setSel = (s, c = '') => setSelState({ subject: s, chapter: c })
  const go = (to, s, c, extra = null) => { setSel(s, c); setHandoff(extra ? { to, ...extra } : null); setSection(to) }

  const { counts: qCounts, loading: qLoading } = useQBankCountsByChapter(canTeach && section === 'readiness' ? subject : '')
  const authorName = currentUser?.name || currentUser?.username || ''
  const myEmail = feedback.email
  const openCount = requestsApi.requests.filter(r => r.course === course && ['open', 'in_progress'].includes(r.status)).length
  const common = { course, courseData, courseLabel, materials, subject, chapter, setSel, canTeach, isAdmin, authorName, myEmail, showToast }

  return (
    <div>
      <nav className="px-tabs" role="tablist" aria-label="Teaching Enhancer">
        {SECTIONS.map(t => {
          const I = t.icon
          const badge = t.id === 'requests' ? openCount : 0
          return (
            <button key={t.id} type="button" role="tab" aria-selected={section === t.id} className={'px-tab' + (section === t.id ? ' on' : '')} onClick={() => setSection(t.id)}>
              <I size={15} />{t.label}{badge > 0 && <span className="px-badge">{badge}</span>}
            </button>
          )
        })}
      </nav>
      {section === 'readiness' && <Readiness {...common} qCounts={qCounts} qLoading={qLoading} requests={requestsApi.requests} go={go} />}
      {section === 'kit' && <ClassKit {...common} feedback={feedback} go={go} />}
      {section === 'planner' && <Planner {...common} handoff={handoff?.to === 'planner' ? handoff : null} clearHandoff={() => setHandoff(null)} />}
      {section === 'requests' && <Requests {...common} requestsApi={requestsApi} handoff={handoff?.to === 'requests' ? handoff : null} clearHandoff={() => setHandoff(null)} />}
    </div>
  )
}
