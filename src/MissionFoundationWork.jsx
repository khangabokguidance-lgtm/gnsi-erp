// MissionFoundationWork.jsx — the day-to-day cycle of Mission Foundation:
// Home (where every test stands and what to do next), Teaching tracker, Test day (checklist + printable sheets)
// and Prizes (winners, handed-over record, certificates, ceremony list).
import { useState, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill } from './MissionSainikUI'
import { Faces } from './MissionFoundationFaces'
import { printPremium } from './lib/printPremium'
import { getInstitute } from './systemSettings'
import { downloadCertificates } from './lib/missionFoundationCerts'
import {
  MISSION_NAME, BATCHES, CONDUCT_STEPS, splitChapters, prizeList, focusTest, cycleFor, maxMarks, subjectByLabel, nameMatches, isSetter, settersOf, titled,
} from './missionFoundationData'

const fmt = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
const fmtLong = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const Btn = ({ kind = 'ghost', children, ...p }) => <button type="button" className={'px-btn ' + kind} {...p}>{children}</button>
const STEP_TAB = { teach: 'teaching', papers: 'mine', conduct: 'conduct', marks: 'marks', results: 'analyser', prizes: 'prizes' }
const STEP_ICON = { teach: '📖', papers: '📝', conduct: '🏫', marks: '✍️', results: '📊', prizes: '🏆' }

function Stepper({ cycle, onOpen, compact }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(6, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: compact ? 4 : 10 }}>
      {cycle.steps.map((s, i) => {
        const done = s.value >= 1, now = i === cycle.current
        const tone = done ? PX.ok : now ? PX.gold : PX.faint
        if (compact) return <span key={s.key} title={`${s.label}: ${s.note}`} style={{ height: 8, borderRadius: 4, background: done ? PX.ok : now ? PX.gold : PX.line }} />
        return (
          <button key={s.key} type="button" onClick={() => onOpen(STEP_TAB[s.key])}
            style={{ textAlign: 'left', border: `1.5px solid ${now ? PX.gold : done ? '#bfe5cf' : PX.line}`, background: now ? PX.goldBg : done ? PX.okBg : '#fff', borderRadius: 16, padding: 12, cursor: 'pointer', font: 'inherit', color: PX.ink }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }} aria-hidden="true">{STEP_ICON[s.key]}</span>
              <b style={{ flex: 1 }}>{i + 1}. {s.label}</b>
              <span style={{ fontSize: 16, color: tone }} aria-hidden="true">{done ? '✔' : now ? '●' : '○'}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: PX.line, margin: '8px 0 6px', overflow: 'hidden' }}><div style={{ width: Math.round(s.value * 100) + '%', height: '100%', background: done ? PX.ok : PX.gold }} /></div>
            <div style={{ fontSize: 12.5, color: PX.sub }}>{s.note}</div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export function HomeDashboard({ photoOf = x => x, tests, ctx, today, me, isAdmin, papers, testById, setTab, setOpenTest }) {
  if (!tests.length) return (
    <PremiumCard title="Welcome to Mission Foundation" subtitle="Three steps to get started">
      <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
        <li><b>Teachers</b>: check who teaches each subject. The timetable teachers are already filled in.</li>
        <li><b>Schedule</b>: {isAdmin ? 'press "Create schedule" to make the 8 Monday tests.' : 'an admin makes the 8 Monday tests.'}</li>
        <li>Every teacher then uses <b>My papers</b> and <b>Teaching</b>. The home screen shows what to do next.</li>
      </ol>
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn kind="gold" onClick={() => setTab('schedule')}>Open Schedule</Btn>
        <Btn onClick={() => setTab('teachers')}>Open Teachers</Btn>
      </div>
    </PremiumCard>
  )
  const focus = focusTest(tests, today)
  const cycle = cycleFor(focus, ctx)
  const next = cycle.steps[cycle.current]
  const days = Math.round((new Date(focus.test_date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 1 ? `In ${days} days` : `${-days} days ago`
  const myTodo = papers.filter(p => (isSetter(me, p) && p.status === 'Pending') || (nameMatches(me, p.verifier) && p.status === 'Submitted'))
    .map(p => ({ ...p, test: testById[p.test_id] })).filter(p => p.test).sort((a, b) => a.test.test_date.localeCompare(b.test.test_date)).slice(0, 5)
  const NEXT_TEXT = {
    teach: 'Teachers tick the chapters they have taught for this test.', papers: 'Setters finish their papers; checkers check them; an admin approves.',
    conduct: 'Work through the test-day checklist and print the attendance sheets.', marks: 'Enter the marks of every student for every subject.',
    results: 'Look at the analysis, then tick "Results published" on the Test day page.', prizes: 'Hand over the prizes and print the certificates.',
  }
  return (
    <>
      <PremiumCard title={`${focus.title || 'Test ' + focus.test_no} · ${fmtLong(focus.test_date)}`} subtitle={`${when} · ${(focus.batches || BATCHES).join(' & ')}${focus.venue ? ' · ' + focus.venue : ''}${focus.start_time ? ' · ' + focus.start_time : ''}${focus.duration_min ? ' · ' + focus.duration_min + ' min, one sitting' : ''}`}
        right={<Pill tone={days < 0 ? 'mute' : days <= 2 ? 'gold' : 'info'}>{when}</Pill>}>
        <Stepper cycle={cycle} onOpen={setTab} />
        {next ? (
          <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 14, borderRadius: 14, background: PX.navy, color: '#fff' }}>
            <span style={{ fontSize: 26 }} aria-hidden="true">{STEP_ICON[next.key]}</span>
            <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontWeight: 800 }}>Next: {next.label}</div><div style={{ fontSize: 13.5, opacity: .8 }}>{NEXT_TEXT[next.key]}</div></div>
            <button type="button" className="px-hbtn gold" onClick={() => { if (next.key === 'teach' || next.key === 'conduct') setOpenTest(focus.id); setTab(STEP_TAB[next.key]) }}>Go →</button>
          </div>
        ) : <div style={{ marginTop: 14, fontWeight: 700, color: PX.ok }}>🎉 This test is complete, prizes included.</div>}
      </PremiumCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <PremiumCard title="My to-do" subtitle={me ? `Papers waiting for ${me}` : 'Sign in to see your papers'} bodyStyle={{ padding: 0 }}
          right={<Btn onClick={() => setTab('mine')}>All my papers</Btn>} style={{ marginBottom: 0 }}>
          {!myTodo.length ? <div style={{ padding: 18, color: PX.sub }}>Nothing waiting for you. ✅</div> : myTodo.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '11px 18px', borderTop: `1px solid ${PX.line}` }}>
              <span style={{ flex: 1 }}><b>{p.subject}</b> <span style={{ color: PX.sub }}>· {p.test.title} · {fmt(p.test.test_date)}</span></span>
              <Faces names={[...settersOf(p), p.verifier]} photoOf={photoOf} size={34} />
              <Pill tone={p.status === 'Pending' ? 'warn' : 'info'}>{isSetter(me, p) && p.status === 'Pending' ? 'Set paper' : 'Check paper'}</Pill>
            </div>
          ))}
        </PremiumCard>
        <PremiumCard title="All 8 tests" subtitle="Each bar shows the 6 steps: teach, papers, test day, marks, results, prizes" bodyStyle={{ padding: 0 }} style={{ marginBottom: 0 }}>
          {tests.map(t => {
            const c = cycleFor(t, ctx)
            return (
              <button key={t.id} type="button" onClick={() => { setOpenTest(t.id); setTab('conduct') }}
                style={{ display: 'grid', gridTemplateColumns: '78px 92px 1fr', gap: 10, alignItems: 'center', width: '100%', padding: '10px 18px', border: 'none', borderTop: `1px solid ${PX.line}`, background: t.id === focus.id ? PX.goldBg : '#fff', cursor: 'pointer', font: 'inherit', color: PX.ink, textAlign: 'left' }}>
                <b>{t.title || 'Test ' + t.test_no}</b><span style={{ color: PX.sub, fontSize: 13 }}>{fmt(t.test_date)}</span><Stepper cycle={c} compact onOpen={() => {}} />
              </button>
            )
          })}
        </PremiumCard>
      </div>
    </>
  )
}

// ─── Test picker shared by the work tabs ──────────────────────────────────────
export function TestPicker({ tests, value, onChange, label = 'Test' }) {
  return (
    <select className="px-input" aria-label={label} value={value || ''} onChange={e => onChange(e.target.value)} style={{ width: 'auto', fontWeight: 700 }}>
      {tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}
    </select>
  )
}

// ─── Teaching tracker ─────────────────────────────────────────────────────────
export function TeachingTab({ tests, testId, setTestId, papersByTest, teaching, setTeaching, savePaper, me, flash, panel, isAdmin }) {
  const papers = papersByTest[testId] || []
  const rows = teaching.filter(t => t.test_id === testId)
  const isDone = (subject, chapter) => rows.some(r => r.subject === subject && r.chapter === chapter && r.done)
  const rowOf = (subject, chapter) => rows.find(r => r.subject === subject && r.chapter === chapter)
  const [draft, setDraft] = useState({})
  const [editing, setEditing] = useState(null)   // { pid, old, value } — a chapter being renamed
  // The admin, and the people who set or check that subject's paper, may change its chapter list.
  const mayEdit = p => isAdmin || isSetter(me, p) || nameMatches(me, p.verifier)
  const renameChapter = async p => {
    const { old } = editing, nu = String(editing.value || '').replace(/;/g, ',').trim()
    if (!nu) return flash('A chapter needs a name.', true)
    if (nu === old) return setEditing(null)
    const list = splitChapters(p.syllabus)
    if (list.some(x => x !== old && x.toLowerCase() === nu.toLowerCase())) return flash(`"${nu}" is already in the list.`, true)
    savePaper(p.id, { syllabus: list.map(x => (x === old ? nu : x)).join('; ') })
    // keep its "taught" tick, who ticked it and when
    setTeaching(ts => ts.map(t => (t.test_id === testId && t.subject === p.subject && t.chapter === old ? { ...t, chapter: nu } : t)))
    const { error } = await supabase.from('mission_foundation_teaching').update({ chapter: nu }).eq('test_id', testId).eq('subject', p.subject).eq('chapter', old)
    if (error) flash('Renamed, but the tick was not carried over: ' + error.message, true)
    setEditing(null)
  }
  const deleteChapter = async (p, c) => {
    if (!window.confirm(`Delete the chapter "${c}" from ${p.subject}? Its taught tick for this test is removed too.`)) return
    savePaper(p.id, { syllabus: splitChapters(p.syllabus).filter(x => x !== c).join('; ') })
    setTeaching(ts => ts.filter(t => !(t.test_id === testId && t.subject === p.subject && t.chapter === c)))
    const { error } = await supabase.from('mission_foundation_teaching').delete().eq('test_id', testId).eq('subject', p.subject).eq('chapter', c)
    if (error) flash('Chapter removed, but its tick record was not cleared: ' + error.message, true)
  }

  const toggle = async (subject, chapter) => {
    const on = !isDone(subject, chapter)
    const row = { test_id: testId, subject, chapter, done: on, taught_by: on ? me : null, taught_on: on ? new Date().toLocaleDateString('en-CA') : null, updated_at: new Date().toISOString() }
    setTeaching(ts => [...ts.filter(t => !(t.test_id === testId && t.subject === subject && t.chapter === chapter)), row])
    const { error } = await supabase.from('mission_foundation_teaching').upsert(row, { onConflict: 'test_id,subject,chapter' })
    if (error) flash('Not saved: ' + error.message, true)
  }
  const addChapter = p => {
    const c = String(draft[p.id] || '').replace(/;/g, ',').trim()
    if (!c) return
    const list = splitChapters(p.syllabus)
    if (!list.some(x => x.toLowerCase() === c.toLowerCase())) savePaper(p.id, { syllabus: [...list, c].join('; ') })
    setDraft({ ...draft, [p.id]: '' })
  }
  const all = papers.flatMap(p => splitChapters(p.syllabus).map(c => [p.subject, c]))
  const doneCount = all.filter(([s, c]) => isDone(s, c)).length

  return (
    <>
      <PremiumCard title="Teaching before the test" subtitle="Tick each chapter once it has been taught. The paper should only ask what was taught."
        right={<TestPicker tests={tests} value={testId} onChange={setTestId} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 10, borderRadius: 5, background: PX.line, overflow: 'hidden' }}><div style={{ width: (all.length ? doneCount / all.length * 100 : 0) + '%', height: '100%', background: 'linear-gradient(90deg,#0f7a4c,#3fb184)' }} /></div>
          <b>{doneCount}/{all.length} chapters taught</b>
        </div>
      </PremiumCard>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {papers.map(p => {
          const chapters = splitChapters(p.syllabus)
          const n = chapters.filter(c => isDone(p.subject, c)).length
          return (
            <PremiumCard key={p.id} title={p.subject} subtitle={`${(panel[p.subject] || []).map(titled).join(', ') || 'No teacher yet'} · ${n}/${chapters.length} taught`} style={{ marginBottom: 0 }}
              right={chapters.length && n === chapters.length ? <Pill tone="ok">Done</Pill> : null}>
              {!chapters.length && <div style={{ color: PX.sub, fontSize: 13.5, marginBottom: 8 }}>No chapters yet. Add the chapters this test covers:</div>}
              <div style={{ display: 'grid', gap: 6 }}>
                {chapters.map(c => {
                  const r = rowOf(p.subject, c), on = !!r?.done
                  const editingThis = editing && editing.pid === p.id && editing.old === c
                  return (
                    <div key={c} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 8px 6px 10px', borderRadius: 12, background: on ? PX.okBg : PX.tint, minHeight: 44 }}>
                      {editingThis ? (
                        <>
                          <input className="px-input" autoFocus aria-label={`Rename chapter ${c}`} value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') renameChapter(p); if (e.key === 'Escape') setEditing(null) }} style={{ flex: '1 1 160px', minWidth: 0 }} />
                          <Btn kind="gold" onClick={() => renameChapter(p)}>Save</Btn>
                          <Btn onClick={() => setEditing(null)}>Cancel</Btn>
                        </>
                      ) : (
                        <>
                          <label style={{ display: 'flex', gap: 10, alignItems: 'center', flex: '1 1 160px', minWidth: 0, cursor: 'pointer', minHeight: 36 }}>
                            <input type="checkbox" checked={on} onChange={() => toggle(p.subject, c)} />
                            <span style={{ flex: 1, fontWeight: 600, minWidth: 0 }}>{c}</span>
                            {on && <span style={{ fontSize: 11.5, color: PX.sub }}>{r.taught_by || ''}{r.taught_on ? ' · ' + fmt(r.taught_on) : ''}</span>}
                          </label>
                          {mayEdit(p) && <>
                            <button type="button" className="px-hbtn" aria-label={`Edit chapter ${c}`} title="Rename this chapter" onClick={() => setEditing({ pid: p.id, old: c, value: c })} style={{ color: PX.navy }}>✎</button>
                            <button type="button" className="px-hbtn" aria-label={`Delete chapter ${c}`} title="Delete this chapter" onClick={() => deleteChapter(p, c)} style={{ color: PX.bad }}>🗑</button>
                          </>}
                        </>
                      )}
                    </div>
                  )
                })}
                {mayEdit(p) && <div style={{ display: 'flex', gap: 6 }}>
                  <input className="px-input" aria-label={`Add a chapter to ${p.subject}`} placeholder="Add a chapter" value={draft[p.id] || ''} onChange={e => setDraft({ ...draft, [p.id]: e.target.value })} onKeyDown={e => e.key === 'Enter' && addChapter(p)} style={{ padding: '7px 10px' }} />
                  <Btn onClick={() => addChapter(p)}>Add</Btn>
                </div>}
              </div>
            </PremiumCard>
          )
        })}
      </div>
      {!papers.length && <PremiumCard title="This test has no papers" subtitle="Add subjects in Schedule & syllabus." />}
    </>
  )
}

// ─── Test day ─────────────────────────────────────────────────────────────────
// Test-day sheets open in the premium A4 preview (official letterhead, paper-size picker, Print / Save as PDF).
const MFW_CSS = `<style>
.mfw{font-size:10.5px;color:#111}.mfw .pg{break-after:page;page-break-after:always}.mfw .pg:last-child{break-after:auto;page-break-after:auto}
.mfw h2{font-size:12px;margin:0 0 8px;text-align:center;font-weight:700;color:#0b1f45}
.mfw .meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:10.5px;margin:4px 0 8px}
.mfw table{width:100%;border-collapse:collapse;font-size:10.5px}.mfw th,.mfw td{border:1px solid #6b7686;padding:5px 5px;text-align:left}.mfw th{background:#0b1f45;color:#fff;font-size:9.5px}
.mfw td.c,.mfw th.c{text-align:center}.mfw tr{break-inside:avoid}.mfw thead{display:table-header-group}.mfw .sig{display:flex;justify-content:space-between;margin-top:24px;font-size:10.5px}
</style>`
function printHtml(title, body) {
  printPremium(`${MFW_CSS}<div class="mfw">${body.replace(/<h1>[^<]*<\/h1>/g, '')}</div>`, { title, institute: getInstitute(), docLabel: `${MISSION_NAME} · ${title}`, official: true })
  return true
}

export function ConductTab({ tests, testId, setTestId, papersByTest, students, marksCount, saveTest, lockTest, me, isAdmin, flash, setTab }) {
  const test = tests.find(t => t.id === testId)
  if (!test) return <PremiumCard title="No tests yet" subtitle="Create the schedule first." />
  const papers = papersByTest[test.id] || []
  const batches = test.batches || BATCHES
  const roster = (students || []).filter(s => batches.includes(s.batchName))
  const checklist = test.checklist || {}
  const autoDone = {
    papers: papers.length > 0 && papers.every(p => p.status === 'Approved'),
    marks: roster.length > 0 && (marksCount[test.id] || 0) >= roster.length * papers.length,
  }
  const tick = key => {
    const on = !checklist[key]?.done
    const next = { ...checklist, [key]: on ? { done: true, by: me, at: new Date().toISOString() } : { done: false } }
    const patch = { checklist: next }
    if (key === 'conducted' && on && ['Planned', 'Ready'].includes(test.status)) patch.status = 'Conducted'
    if (key === 'published') patch.status = on ? 'Results out' : (checklist.conducted?.done ? 'Conducted' : test.status)
    saveTest(test.id, patch)
  }
  const field = (k, label, ph) => (
    <label>{label}
      <input className="px-input" defaultValue={test[k] || ''} key={test.id + k} placeholder={ph} onBlur={e => { if ((e.target.value || '') !== (test[k] || '')) saveTest(test.id, { [k]: e.target.value.trim() }) }} />
    </label>
  )

  const head = (sub) => `<h1>Guidance Navodaya &amp; Sainik Institute</h1><h2>${esc(MISSION_NAME)} · ${esc(test.title || 'Test ' + test.test_no)} · ${esc(sub)}</h2>`
  const attendanceSheets = () => {
    const pages = batches.map(b => {
      const list = roster.filter(s => s.batchName === b)
      return `<div class="pg">${head('Attendance sheet')}<div class="meta"><span>Batch: <b>${esc(b)}</b></span><span>${esc(fmtLong(test.test_date))}</span><span>${esc(test.venue || '')} ${esc(test.start_time || '')}${test.duration_min ? ' · ' + esc(test.duration_min) + ' min' : ''}</span></div>
        <table><thead><tr><th class="c">#</th><th>Student</th><th>GCC</th><th class="c" style="width:22%">Student's signature</th><th class="c" style="width:12%">Present / Absent</th></tr></thead>
        <tbody>${list.map((s, i) => `<tr><td class="c">${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.gcc_no || '')}</td><td></td><td></td></tr>`).join('')}</tbody></table>
        <div class="sig"><span>Present: ______ &nbsp; Absent: ______</span><span>Invigilator: ${esc(test.invigilators || '________________')}</span></div></div>`
    })
    if (!printHtml('Attendance sheets', pages.join(''))) flash('Allow pop-ups to print.', true)
  }
  const marksSheets = () => {
    const pages = batches.map(b => {
      const list = roster.filter(s => s.batchName === b)
      return `<div class="pg">${head('Marks sheet')}<div class="meta"><span>Batch: <b>${esc(b)}</b></span><span>${esc(fmtLong(test.test_date))}</span></div>
        <table><thead><tr><th class="c">#</th><th>Student</th>${papers.map(p => `<th class="c">${esc(subjectByLabel(p.subject)?.short || p.subject)}<br>/${maxMarks(p)}</th>`).join('')}<th class="c">Total<br>/${papers.reduce((n, p) => n + maxMarks(p), 0)}</th></tr></thead>
        <tbody>${list.map((s, i) => `<tr><td class="c">${i + 1}</td><td>${esc(s.name)}</td>${papers.map(() => '<td></td>').join('')}<td></td></tr>`).join('')}</tbody></table>
        <div class="sig"><span>Checked by: ________________</span><span>Entered in ERP on: ____________</span></div></div>`
    })
    if (!printHtml('Marks sheets', pages.join(''))) flash('Allow pop-ups to print.', true)
  }
  const dutyChart = () => {
    const body = `<div class="pg">${head('Test-day plan')}<div class="meta"><span>${esc(fmtLong(test.test_date))}</span><span>${esc(test.venue || '')}</span><span>${esc(test.start_time || '')}${test.duration_min ? ' · ' + esc(test.duration_min) + ' min (all subjects, one sitting)' : ''}</span></div>
      <table><thead><tr><th>Subject</th><th>Syllabus</th><th class="c">Questions</th><th class="c">Marks</th><th>Paper set by</th><th>Checked by</th></tr></thead>
      <tbody>${papers.map(p => `<tr><td>${esc(p.subject)}</td><td>${esc(p.syllabus || '')}</td><td class="c">${esc(p.questions)}</td><td class="c">${maxMarks(p)}</td><td>${esc(p.setter || '')}</td><td>${esc(p.verifier || '')}</td></tr>`).join('')}</tbody></table>
      <p style="font-size:12px;margin-top:12px"><b>Invigilators:</b> ${esc(test.invigilators || '—')}<br><b>Students:</b> ${batches.map(b => `${esc(b)} ${roster.filter(s => s.batchName === b).length}`).join(' · ')}</p>
      ${test.notes ? `<p style="font-size:12px"><b>Notes:</b> ${esc(test.notes)}</p>` : ''}<div class="sig"><span>Exam in-charge</span><span>Principal</span></div></div>`
    if (!printHtml('Test-day plan', body)) flash('Allow pop-ups to print.', true)
  }

  const doneN = CONDUCT_STEPS.filter(s => s.auto ? autoDone[s.key] : checklist[s.key]?.done).length
  return (
    <>
      <PremiumCard title="Test day" subtitle={`${fmtLong(test.test_date)} · ${roster.length} students in ${batches.join(' & ')}${test.duration_min ? ` · all ${papers.length} subjects in one sitting of ${test.duration_min} min` : ''}`} right={<span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{test.locked && <Pill tone="gold">🔒 Locked{test.locked_by ? ' by ' + test.locked_by : ''}</Pill>}{isAdmin && lockTest && <Btn onClick={() => lockTest(test.id, !test.locked)}>{test.locked ? '🔓 Unlock test' : '🔒 Lock test'}</Btn>}<TestPicker tests={tests} value={testId} onChange={setTestId} /></span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {field('venue', 'Hall / room', 'e.g. Main hall')}
          {field('start_time', 'Start time', 'e.g. 9:00 AM')}
          {field('invigilators', 'Invigilators', 'e.g. Sir Roshan, Madam Sandhya')}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <Btn kind="gold" onClick={attendanceSheets} disabled={!roster.length}>🖨 Attendance sheets</Btn>
          <Btn onClick={marksSheets} disabled={!roster.length}>🖨 Blank marks sheets</Btn>
          <Btn onClick={dutyChart}>🖨 Test-day plan</Btn>
          <Btn onClick={() => setTab('marks')}>✍️ Enter marks</Btn>
        </div>
      </PremiumCard>
      <PremiumCard title={`Checklist · ${doneN}/${CONDUCT_STEPS.length}`} subtitle="Tick each step as it is done. Steps marked 'automatic' tick themselves." bodyStyle={{ padding: 0 }}>
        {CONDUCT_STEPS.map((s, i) => {
          const on = s.auto ? autoDone[s.key] : !!checklist[s.key]?.done
          const info = checklist[s.key]
          return (
            <label key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 18px', borderTop: i ? `1px solid ${PX.line}` : 'none', cursor: s.auto ? 'default' : 'pointer', background: on ? '#f5fbf7' : '#fff', minHeight: 52 }}>
              <input type="checkbox" checked={on} disabled={s.auto || (s.key === 'published' && !isAdmin && !on)} onChange={() => tick(s.key)} />
              <span style={{ flex: 1, fontWeight: 600 }}>{s.label}</span>
              {s.auto ? <Pill tone={on ? 'ok' : 'mute'}>automatic</Pill> : on && info?.by ? <span style={{ fontSize: 12, color: PX.sub }}>{info.by} · {new Date(info.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span> : null}
            </label>
          )
        })}
      </PremiumCard>
    </>
  )
}

// ─── Prizes ───────────────────────────────────────────────────────────────────
export function PrizesTab({ tests, papersByTest, allMarks, prizes, setPrizes, me, flash, today }) {
  const [scope, setScope] = useState('series')
  const [topN, setTopN] = useState(3)
  const [busy, setBusy] = useState('')
  const scopeTests = scope === 'series' ? tests : tests.filter(t => t.id === scope)
  const label = scope === 'series' ? `${MISSION_NAME} (all tests)` : `${scopeTests[0]?.title || 'Test'} of ${MISSION_NAME}, held on ${fmtLong(scopeTests[0]?.test_date)}`
  const list = useMemo(() => (allMarks ? prizeList({ marks: allMarks, tests: scopeTests, papersByTest, series: scope === 'series', topN: Number(topN) }) : []), [allMarks, scope, topN, tests, papersByTest]) // eslint-disable-line react-hooks/exhaustive-deps
  const given = (a) => prizes.find(p => p.scope === scope && p.award_key === a.award_key && p.student_id === a.student_id)
  const groups = [...new Set(list.map(a => a.group))]

  const toggle = async a => {
    const cur = given(a)
    const row = { scope, award_key: a.award_key, award: a.award, student_id: a.student_id, student_name: a.student_name, batch: a.batch,
      given: !cur?.given, given_on: !cur?.given ? today : null, given_by: !cur?.given ? me : null, updated_at: new Date().toISOString() }
    setPrizes(ps => [...ps.filter(p => !(p.scope === scope && p.award_key === a.award_key && p.student_id === a.student_id)), row])
    const { error } = await supabase.from('mission_foundation_prizes').upsert(row, { onConflict: 'scope,award_key,student_id' })
    if (error) flash('Not saved: ' + error.message, true)
  }
  const certs = async items => {
    if (!items.length) return
    try {
      await downloadCertificates(items, label, `Mission_Foundation_${scope === 'series' ? 'Series' : (scopeTests[0]?.title || 'Test').replace(/\W+/g, '_')}_prizes.pdf`, (i, n) => setBusy(`Making ${i} of ${n}…`))
      flash(`${items.length} certificate(s) downloaded.`)
    } catch (e) { flash('Could not make certificates: ' + (e?.message || e), true) }
    setBusy('')
  }
  const ceremony = () => {
    const rows = list.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${esc(a.award)}</td><td><b>${esc(a.student_name)}</b></td><td>${esc(a.batch)}</td><td>${esc(a.detail)}</td><td class="c">${given(a)?.given ? '✔' : ''}</td></tr>`).join('')
    const ok = printHtml('Prize list', `<div class="pg"><h1>Guidance Navodaya &amp; Sainik Institute</h1><h2>Prize distribution · ${esc(label)}</h2>
      <table><thead><tr><th class="c">#</th><th>Award</th><th>Student</th><th>Batch</th><th>For</th><th class="c">Given</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sig"><span>Exam in-charge</span><span>Principal</span></div></div>`)
    if (!ok) flash('Allow pop-ups to print.', true)
  }

  if (!tests.length) return <PremiumCard title="No tests yet" subtitle="Create the schedule first." />
  const givenN = list.filter(a => given(a)?.given).length
  return (
    <>
      <PremiumCard title="Prize distribution" subtitle="Winners are worked out from the marks. Tick each prize when it is handed over."
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Btn onClick={ceremony} disabled={!list.length}>🖨 Ceremony list</Btn>
          <Btn kind="gold" onClick={() => certs(list)} disabled={!!busy || !list.length}>{busy || `🎓 All ${list.length} certificates`}</Btn>
        </div>}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="px-input" aria-label="Prizes for" value={scope} onChange={e => setScope(e.target.value)} style={{ width: 'auto', fontWeight: 700 }}>
            <option value="series">Whole series (final prize day)</option>
            {tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Toppers per batch
            <select className="px-input" aria-label="Toppers per batch" value={topN} onChange={e => setTopN(e.target.value)} style={{ width: 'auto' }}>{[1, 2, 3, 5].map(n => <option key={n}>{n}</option>)}</select>
          </label>
          <span style={{ color: PX.sub }}>{givenN}/{list.length} handed over</span>
        </div>
      </PremiumCard>
      {allMarks === null ? <PremiumCard><div style={{ color: PX.sub }}>Loading marks…</div></PremiumCard>
        : !list.length ? <PremiumCard title="No winners yet" subtitle="Prizes appear here once marks are entered." /> : groups.map(g => (
          <PremiumCard key={g} title={{ Toppers: '🏆 Toppers', 'Subject toppers': '⭐ Subject toppers', 'Most improved': '📈 Most improved', 'Full attendance': '✅ Full attendance' }[g] || g} bodyStyle={{ padding: 0 }}>
            {list.filter(a => a.group === g).map(a => {
              const gv = given(a)
              return (
                <div key={a.award_key + a.student_id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 18px', borderTop: `1px solid ${PX.line}`, background: gv?.given ? '#f5fbf7' : '#fff' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 800 }}>{a.student_name} <span style={{ color: PX.sub, fontWeight: 500, fontSize: 13 }}>{a.batch}{a.gcc_no ? ' · GCC ' + a.gcc_no : ''}</span></div>
                    <div style={{ fontSize: 13, color: PX.sub }}>{a.award} · {a.detail}</div>
                  </div>
                  <Btn onClick={() => certs([a])} disabled={!!busy}>🎓 Certificate</Btn>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, minHeight: 44 }}>
                    <input type="checkbox" checked={!!gv?.given} onChange={() => toggle(a)} />
                    {gv?.given ? `Given ${gv.given_on ? fmt(gv.given_on) : ''}` : 'Mark given'}
                  </label>
                </div>
              )
            })}
          </PremiumCard>
        ))}
      <p style={{ color: PX.sub, fontSize: 13 }}>Toppers rank by % of the papers each student sat; ties share the prize. Subject toppers cover both batches together. Most improved and full attendance are given for the whole series.</p>
    </>
  )
}
