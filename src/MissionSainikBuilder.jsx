// MissionSainikBuilder.jsx — Pre Mock Test Builder (PMT, 150 Q) and Mega Mock Test Builder (MT, 125 Q) for Mission Sainik.
// Teachers upload their questions per section; the paper and answer key assemble automatically (no build step).
// Only the section's own setter (or an admin) can upload / delete. Everyone else can only view and print.
// Questions live in `mission_sainik_questions` (migration 20261206_mission_sainik_questions.sql).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { isAdminRole } from './roles'
import { PremiumCard, PX } from './premiumUI'
import { parseQuestions, fetchAll } from './lib/missionSainikQuestions'
import { TESTS, MOCK_TESTS, SUBJECTS, PANEL, PRACTICE_PANEL, MOCK_SECTIONS, fullName, nameMatches } from './missionSainikData'

const TABLE = 'mission_sainik_questions'
const line = PX.line || '#eef1f6'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmtShort = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// Which panel subjects may upload each Mega Mock section.
const MEGA_PANEL = { Mathematics: ['maths'], Intelligence: ['reasoning'], 'Grammar + Vocabulary': ['grammar', 'vocab'], 'Science + GK': ['science', 'gk'] }

const SUBJ = Object.fromEntries(SUBJECTS.map(x => [x.key, x]))
const DAILY_SECTIONS = [['maths', 20, 3], ['reasoning', 10, 2], ['grammar', 10, 2], ['gk', 10, 2]]
  .map(([k, q, marks]) => ({ label: SUBJ[k].label, short: SUBJ[k].short, q, marks, key: k }))
const CFG = {
  daily: {
    name: 'Daily Class Test', prefix: 'T', tests: TESTS.map(t => ({ no: t.no, date: t.date })), noun: 'Test',
    sections: DAILY_SECTIONS, duration: 'as notified', panel: 'practice',
  },
  practice: {
    name: 'Practice Bank', prefix: 'Set', noun: 'Set', restart: true, noMarks: true, panel: 'practice',
    tests: [1, 2, 3].map(no => ({ no, date: null })),
    sections: SUBJECTS.map(x => ({ label: x.label, short: x.short, q: 25, marks: 0, key: x.key, sets: PRACTICE_PANEL[x.key].sets })),
    duration: '',
  },
  pre: {
    name: 'Pre Mock', prefix: 'PMT', tests: TESTS, perQ: 2,
    sections: SUBJECTS.map(s => ({ label: s.label, short: s.short, q: 25, marks: 2, key: s.key })),
    duration: 'as notified',
  },
  mega: {
    name: 'Mega Mock', prefix: 'MT', tests: MOCK_TESTS,
    sections: MOCK_SECTIONS.map(s => ({ label: s.label, short: s.label, q: s.q, marks: s.marks / s.q })),
    duration: '150 minutes',
  },
}

export default function MissionSainikBuilder({ series, tasks, saveTask, currentUser, setMsg, isMobile, institute }) {
  const cfg = CFG[series]
  const isAdmin = isAdminRole(currentUser?.role)
  const isMe = n => nameMatches(currentUser?.name, n)
  const [qs, setQs] = useState([])
  const [setup, setSetup] = useState(false)
  const [testNo, setTestNo] = useState(1)
  const [sectionSel, setSection] = useState(cfg.sections[0].label)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await fetchAll(() => supabase.from(TABLE).select('*').eq('series', series).order('id'))
    if (error) { setSetup(true); setQs([]) } else { setSetup(false); setQs(data || []) }
  }, [series])
  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect

  const bySec = useMemo(() => {
    const m = {}; qs.forEach(q => { (m[q.test_no + '|' + q.section] = m[q.test_no + '|' + q.section] || []).push(q) }); return m
  }, [qs])
  const get = (t, s) => bySec[t + '|' + s] || []
  const avail = (t, s) => !s.sets || t <= s.sets                       // practice: not every subject has a 3rd set
  const live = t => cfg.sections.filter(s => avail(t, s))
  const section = (live(testNo).find(s => s.label === sectionSel) || live(testNo)[0]).label   // falls back when a set lacks this subject
  const testReady = t => live(t).every(s => get(t, s.label).length >= s.q)
  const testCount = t => live(t).reduce((a, s) => a + Math.min(get(t, s.label).length, s.q), 0)
  const totalQ = t => live(t).reduce((a, s) => a + s.q, 0)

  // Who may upload to a section: its setter (Pre Mock: the allotted setter; Mega Mock: the panel of its subjects) or an admin.
  const settersOf = (t, s) => cfg.panel === 'practice'
    ? (() => { const p = PRACTICE_PANEL[cfg.sections.find(x => x.label === s)?.key]; return p ? [p.verifier, ...p.assistants] : [] })()
    : series === 'pre'
    ? (tasks || []).filter(r => r.kind === 'test' && r.test_no === t && r.subject === s).map(r => r.setter)
    : (MEGA_PANEL[s] || []).flatMap(k => PANEL[k] || [])
  const canEdit = (t, s) => isAdmin || settersOf(t, s).some(isMe)

  const tid = n => (cfg.noun === 'Set' ? `Set ${n}` : `${cfg.prefix}-${String(n).padStart(2, '0')}`)
  const parsed = useMemo(() => parseQuestions(text), [text])
  const upload = async () => {
    if (!canEdit(testNo, section)) return setMsg('❌ Only the section setter or an admin can upload here.')
    if (parsed.errors.length) return setMsg('❌ ' + parsed.errors.slice(0, 3).join(' · '))
    if (!parsed.questions.length) return setMsg('❌ No questions found — check the format.')
    const have = get(testNo, section).length
    if (parsed.questions.length > 200) return setMsg('❌ Upload at most 200 questions at a time.')
    const norm = x => x.toLowerCase().replace(/\s+/g, ' ').trim()
    const seen = new Set(get(testNo, section).map(q => norm(q.question)))
    const dupes = parsed.questions.filter((q, i) => seen.has(norm(q.question)) || parsed.questions.findIndex(z => norm(z.question) === norm(q.question)) !== i)
    if (dupes.length) return setMsg(`❌ ${dupes.length} duplicate question(s) already in this section, e.g. “${dupes[0].question.slice(0, 50)}”. Remove them and upload again.`)
    if (have + parsed.questions.length > sec.q && !window.confirm(`${section} needs ${sec.q} questions; this makes ${have + parsed.questions.length}. Upload anyway?`)) return
    setBusy(true)
    const rows = parsed.questions.map(q => ({ ...q, series, test_no: testNo, section, uploaded_by: currentUser?.name || '' }))
    const { error } = await supabase.from(TABLE).insert(rows)
    setBusy(false)
    if (error) return setMsg('❌ ' + error.message)
    setText(''); setMsg(`✅ ${rows.length} question(s) added to ${tid(testNo)} · ${section}`)
    await load()
    // Pre Mock: when the section is complete, mark the allotted task as submitted automatically.
    if (series === 'pre' && have + rows.length >= sec.q) {
      const task = (tasks || []).find(r => r.kind === 'test' && r.test_no === testNo && r.subject === section)
      if (task && task.status === 'Pending' && saveTask) await saveTask(task, { status: 'Submitted', question_count: have + rows.length })
    }
  }
  const del = async q => {
    if (!canEdit(q.test_no, q.section)) return
    if (!window.confirm('Delete this question?')) return
    const { error } = await supabase.from(TABLE).delete().eq('id', q.id)
    if (error) return setMsg('❌ ' + error.message)
    load()
  }
  const clearSection = async () => {
    const list = get(testNo, section)
    if (!list.length || !canEdit(testNo, section)) return
    if (!window.confirm(`Delete all ${list.length} questions of ${section} for ${tid(testNo)}?`)) return
    const { error } = await supabase.from(TABLE).delete().eq('series', series).eq('test_no', testNo).eq('section', section)
    if (error) return setMsg('❌ ' + error.message)
    load()
  }
  const loadFile = e => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader(); r.onload = () => setText(String(r.result || '')); r.readAsText(f); e.target.value = ''
  }

  // ── automatic assembly → printable paper / key ─────────────────────────
  // Serial numbers are fixed by section (Annexure-II: Maths Q1–25, Reasoning Q26–50, Science Q51–75, GK Q76–100, Grammar Q101–125,
  // Vocabulary Q126–150), so a partly uploaded section never shifts the numbers of the sections after it.
  const startOf = label => cfg.restart ? 1 : cfg.sections.slice(0, cfg.sections.findIndex(s => s.label === label)).reduce((a, s) => a + s.q, 0) + 1
  const range = s => `Q${startOf(s.label)}–Q${startOf(s.label) + s.q - 1}`
  const assemble = t => live(t).map(s => ({ ...s, from: startOf(s.label), items: get(t, s.label).slice(0, s.q).map((q, i) => ({ ...q, no: startOf(s.label) + i })) }))
  const printDoc = (t, key) => {
    const secs = assemble(t); const count = secs.reduce((a, s) => a + s.items.length, 0)
    if (!count) return setMsg('❌ No questions uploaded for this test yet.')
    const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print')
    const id = cfg.noun === 'Set' ? `Practice Set ${t}` : `${cfg.prefix}-${String(t).padStart(2, '0')}`
    const date = cfg.tests.find(x => x.no === t)?.date
    const body = key
      ? `<table><tr><th>Q</th><th>Ans</th><th>Topic</th><th>Level</th><th>Explanation</th></tr>${secs.flatMap(s => [`<tr><td colspan="5" class="sec">${esc(s.label)} · Q${s.from}–Q${s.from + s.q - 1}</td></tr>`, ...s.items.map(q => `<tr><td>${q.no}</td><td><b>${q.answer}</b></td><td>${esc(q.topic || '')}</td><td>${esc(q.difficulty || '')}</td><td>${esc(q.explanation || '')}</td></tr>`)]).join('')}</table>`
      : secs.map(s => `<div class="sec">${esc(s.label)} · Q${s.from}–Q${s.from + s.q - 1} — ${s.q} question(s)${cfg.noMarks ? '' : ' × ' + s.marks + ' mark(s)'}</div>${s.items.map(q => `<div class="q"><b>${q.no}.</b> ${esc(q.question)}<div class="o"><span>(A) ${esc(q.option_a)}</span><span>(B) ${esc(q.option_b)}</span><span>(C) ${esc(q.option_c)}</span><span>(D) ${esc(q.option_d)}</span></div></div>`).join('')}`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${id} ${key ? 'Answer Key' : 'Question Paper'}</title><style>
@page{size:A4;margin:14mm}body{font-family:Georgia,'Times New Roman',serif;color:#111827;font-size:12.5px;line-height:1.45}
.lh{text-align:center;border-bottom:3px double #132a4f;padding-bottom:6px;margin-bottom:8px}.lh h1{margin:0;font-size:19px;color:#132a4f}.lh div{font-size:11.5px;color:#555}
.meta{display:flex;justify-content:space-between;font-weight:700;margin:6px 0 8px}.note{font-size:11.5px;color:#444;margin-bottom:6px}
.sec{background:#eef1f6;border:1px solid #c9d1de;padding:4px 8px;font-weight:700;margin:10px 0 6px}
.q{margin:0 0 7px;page-break-inside:avoid}.o{display:grid;grid-template-columns:1fr 1fr;gap:1px 14px;margin-left:18px}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eef1f6}
.conf{margin-top:10px;font-size:10.5px;color:#a00;text-align:center}</style></head><body>
<div class="lh"><h1>${esc(institute?.name || 'Guidance Navodaya & Sainik Institute')}</h1><div>Mission Sainik 2027 · ${cfg.name} Test ${key ? '· ANSWER KEY (CONFIDENTIAL)' : ''}</div></div>
<div class="meta"><span>${id}${date ? ' · ' + esc(fmtShort(date)) : ''}</span>${cfg.noMarks ? '' : `<span>Marks: ${secs.reduce((a, s) => a + s.q * s.marks, 0)}</span><span>Time: ${esc(cfg.duration)}</span>`}</div>
${key ? '' : '<div class="note">Each question has four options. Choose the one correct answer and darken the bubble on the OMR sheet. There is no negative marking.</div>'}
${body}${count < totalQ(t) ? `<div class="conf">DRAFT — ${count} of ${totalQ(t)} questions uploaded so far.</div>` : ''}
<div class="conf">All questions are confidential until the test is held.</div><script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }

  const secStatus = (t, s) => { const n = get(t, s.label).length; return n >= s.q ? 'ok' : n ? 'part' : 'none' }
  const col = st => (st === 'ok' ? PX.ok : st === 'part' ? PX.warn : PX.faint || '#9aa5b8')
  const sec = cfg.sections.find(s => s.label === section)
  const secList = get(testNo, sec.label)
  const mayEdit = canEdit(testNo, sec.label)
  const ready = testReady(testNo)
  const lvl = { Easy: 0, Medium: 0, Hard: 0 }; secList.forEach(q => { if (lvl[q.difficulty] != null) lvl[q.difficulty]++ })

  return (
    <>
      {setup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261206_mission_sainik_questions.sql</b> in Supabase to enable the builders.</div>}
      <PremiumCard title={`${cfg.name} ${cfg.noun === 'Set' ? '' : cfg.noun === 'Test' ? 'Builder' : 'Test Builder'}`.trim()} subtitle={`Assembles automatically as setters upload — ${cfg.noun === 'Set' ? '25 questions per subject set' : totalQ(1) + ' questions per test'}. Only a section's own setter (or an admin) can upload; everyone else can view and print.`}
        bodyStyle={{ padding: 0, overflowX: 'auto' }}>
        <table className="px-table" style={{ minWidth: 640 }}>
          <thead><tr><th>{cfg.noun === 'Set' ? 'Set' : 'Test'}</th>{cfg.sections.map(s => <th key={s.label}>{s.short}</th>)}<th>Total</th><th /></tr></thead>
          <tbody>{cfg.tests.map(t => (
            <tr key={t.no} style={t.no === testNo ? { background: PX.tint } : undefined}>
              <td><button style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: PX.navy }} onClick={() => setTestNo(t.no)}>{tid(t.no)}</button><div style={{ fontSize: 11, color: PX.sub }}>{t.date ? fmtShort(t.date) : ''}</div></td>
              {cfg.sections.map(s => avail(t.no, s) ? <td key={s.label} style={{ color: col(secStatus(t.no, s)), fontWeight: 700 }}>{get(t.no, s.label).length}/{s.q}</td> : <td key={s.label} style={{ color: PX.faint || '#9aa5b8' }}>—</td>)}
              <td><b>{testCount(t.no)}/{totalQ(t.no)}</b></td>
              <td>{testReady(t.no) ? <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: PX.ok, background: PX.okBg }}>Ready</span> : null}</td>
            </tr>))}
          </tbody>
        </table>
      </PremiumCard>

      <PremiumCard title={`${tid(testNo)}${ready ? ' · Ready to print' : ''}`} subtitle={`${testCount(testNo)} of ${totalQ(testNo)} questions in`}
        right={<span style={{ display: 'flex', gap: 8 }}><button className="px-hbtn" onClick={() => printDoc(testNo, false)}>🖨 Question paper</button><button className="px-hbtn" onClick={() => printDoc(testNo, true)}>🔑 Answer key</button></span>}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${live(testNo).length}, 1fr)`, gap: 8 }}>
          {live(testNo).map(s => {
            const n = get(testNo, s.label).length, st = secStatus(testNo, s)
            const ups = [...new Set(get(testNo, s.label).map(q => q.uploaded_by).filter(Boolean))]
            return (
              <button key={s.label} onClick={() => setSection(s.label)} style={{ all: 'unset', cursor: 'pointer', padding: 10, borderRadius: 12, background: s.label === section ? '#fff' : PX.tint, border: `2px solid ${s.label === section ? PX.gold : 'transparent'}`, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>{s.short} <span style={{ fontWeight: 400 }}>· {range(s)}</span></div>
                <div style={{ fontFamily: PX.serif, fontSize: 22, color: col(st) }}>{n}/{s.q}</div>
                <div style={{ fontSize: 11, color: PX.sub }}>{ups.length ? ups.map(fullName).join(', ') : settersOf(testNo, s.label).map(fullName).join(', ') || '—'}</div>
              </button>
            )
          })}
        </div>
      </PremiumCard>

      <PremiumCard title={`${section} · ${range(sec)}`} subtitle={`${secList.length}/${sec.q} questions · Easy ${lvl.Easy} · Medium ${lvl.Medium} · Hard ${lvl.Hard} (aim ≈ 40/40/20)`}
        right={mayEdit && secList.length ? <button className="px-hbtn" onClick={clearSection}>🗑 Clear section</button> : null}>
        {mayEdit ? (
          <>
            {secList.length > sec.q && <div style={{ fontSize: 12.5, color: PX.warn, marginBottom: 8 }}>⚠ {secList.length - sec.q} extra question(s): only the first {sec.q} are used in the paper. Delete the extras you don't want.</div>}
            <div style={{ fontSize: 12.5, color: PX.sub, marginBottom: 8 }}>
              Paste your questions in this format (or load a .txt file):
              <pre style={{ background: PX.tint, padding: 8, borderRadius: 8, fontSize: 12, margin: '6px 0', whiteSpace: 'pre-wrap' }}>{`Q1. What is 3/4 + 1/4?\nA) 1/2\nB) 1\nC) 3/4\nD) 2\nAns: B\nExp: Same denominator, add numerators.\nTopic: Fractions\nLevel: Easy`}</pre>
            </div>
            <textarea className="px-input" rows={9} value={text} onChange={e => setText(e.target.value)} placeholder="Paste questions here…" style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              <input type="file" accept=".txt,text/plain" onChange={loadFile} style={{ fontSize: 12 }} />
              <span style={{ fontSize: 12.5, color: parsed.errors.length ? PX.bad : PX.sub }}>
                {text.trim() ? (parsed.errors.length ? parsed.errors.slice(0, 2).join(' · ') : `${parsed.questions.length} question(s) ready to upload`) : ''}
              </span>
              <button className="px-btn gold" style={{ marginLeft: 'auto' }} disabled={busy || !parsed.questions.length || parsed.errors.length > 0} onClick={upload}>{busy ? 'Uploading…' : '⬆ Upload questions'}</button>
            </div>
          </>
        ) : (
          <div style={{ padding: '8px 12px', borderRadius: 10, background: PX.tint, fontSize: 13, color: PX.sub }}>
            🔒 View only. Only {settersOf(testNo, section).map(fullName).join(' / ') || 'the section setter'} (or an admin) can upload to this section.
          </div>
        )}
      </PremiumCard>

      <PremiumCard title="Questions in this section" subtitle={secList.length ? 'Click a question to see options, answer and explanation' : ''}>
        {!secList.length ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>Nothing uploaded yet.</div> : secList.map((q, i) => (
          <div key={q.id} style={{ borderTop: i ? `1px solid ${line}` : 'none', padding: '8px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <button style={{ all: 'unset', cursor: 'pointer', flex: 1, fontSize: 13.5 }} onClick={() => setOpen(open === q.id ? '' : q.id)}><b>Q{startOf(section) + i}.</b> {q.question}</button>
              {q.difficulty && <span style={{ fontSize: 11, color: PX.sub }}>{q.difficulty}</span>}
              {mayEdit && <button className="px-hbtn" onClick={() => del(q)} aria-label="Delete question">🗑</button>}
            </div>
            {open === q.id && (
              <div style={{ marginTop: 6, marginLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                {['A', 'B', 'C', 'D'].map(k => <div key={k} style={{ fontWeight: q.answer === k ? 700 : 400, color: q.answer === k ? PX.ok : undefined }}>({k}) {q['option_' + k.toLowerCase()]}{q.answer === k ? ' ✓' : ''}</div>)}
                {q.explanation && <div style={{ color: PX.sub }}>Exp: {q.explanation}</div>}
                <div style={{ color: PX.sub, fontSize: 12 }}>{[q.topic, q.uploaded_by].filter(Boolean).join(' · ')}</div>
              </div>
            )}
          </div>
        ))}
      </PremiumCard>
    </>
  )
}
