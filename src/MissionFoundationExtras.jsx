/* eslint-disable react-hooks/set-state-in-effect -- data loaders set state after fetching, as elsewhere in the portal */
// MissionFoundationExtras.jsx — the Analyser, Study material and Group chat tabs of Mission Foundation.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill, Avatar } from './MissionSainikUI'
import { downloadCsv } from './lib/missionSainikExport'
import NotesStudio, { printNote } from './MissionFoundationNotes'
import { MATERIAL_CSS, renderMaterial } from './lib/materialMarkup'
import { MATH_CSS } from './lib/mathText'
import {
  BATCHES, SUBJECTS, rankResults, subjectStats, scoreBands, batchAverages,
  seriesRanking, ordinal, nameMatches, safeUrl,
} from './missionFoundationData'

const T_MAT = 'mission_foundation_materials'
const T_MSG = 'mission_foundation_messages'
const BUCKET = 'teacher-materials'

const fmt = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const Btn = ({ kind = 'ghost', children, ...p }) => <button type="button" className={'px-btn ' + kind} {...p}>{children}</button>
const pctTone = p => p == null ? 'mute' : p >= 75 ? 'ok' : p >= 50 ? 'gold' : 'bad'
const pickTest = (tests, today) => [...tests].reverse().find(t => t.test_date <= today) || tests[0]

function Bar({ pct, tone = 'gold' }) {
  const c = { ok: PX.ok, gold: PX.gold, bad: PX.bad, mute: PX.faint }[tone]
  return (
    <div role="img" aria-label={`${pct ?? 0}%`} style={{ height: 10, borderRadius: 5, background: PX.line, overflow: 'hidden', minWidth: 80 }}>
      <div style={{ width: Math.max(0, Math.min(100, pct || 0)) + '%', height: '100%', background: c, borderRadius: 5 }} />
    </div>
  )
}

// ─── Analyser ─────────────────────────────────────────────────────────────────
export function AnalyserTab({ tests, papersByTest, allMarks: marks, today }) {
  const [view, setView] = useState(() => pickTest(tests, today)?.id || 'series')
  const [batch, setBatch] = useState('All')
  const inBatch = r => batch === 'All' || r.batch === batch

  const test = tests.find(t => t.id === view)
  const papers = useMemo(() => papersByTest[view] || [], [papersByTest, view])
  const testRows = useMemo(() => (marks || []).filter(r => r.test_id === view && inBatch(r)), [marks, view, batch]) // eslint-disable-line react-hooks/exhaustive-deps
  const ranked = useMemo(() => rankResults(testRows, papers), [testRows, papers])
  const allRanked = useMemo(() => rankResults((marks || []).filter(r => r.test_id === view), papers), [marks, view, papers])
  const subj = useMemo(() => subjectStats(testRows, papers), [testRows, papers])
  const bands = useMemo(() => scoreBands(ranked), [ranked])
  const series = useMemo(() => seriesRanking((marks || []).filter(inBatch), tests, papersByTest), [marks, tests, papersByTest, batch]) // eslint-disable-line react-hooks/exhaustive-deps

  const picker = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <select className="px-input" aria-label="Test" value={view} onChange={e => setView(e.target.value)} style={{ width: 'auto' }}>
        <option value="series">Whole series (all tests)</option>
        {tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}
      </select>
      <select className="px-input" aria-label="Batch" value={batch} onChange={e => setBatch(e.target.value)} style={{ width: 'auto' }}>{['All', ...BATCHES].map(b => <option key={b}>{b}</option>)}</select>
    </div>
  )
  if (!tests.length) return <PremiumCard title="No tests yet" subtitle="Create the schedule first." />
  if (marks === null) return <>{picker}<PremiumCard><div style={{ color: PX.sub }}>Loading marks…</div></PremiumCard></>

  if (view === 'series') {
    const sat = series.filter(s => s.pct != null)
    const testAvgs = tests.map(t => {
      const r = rankResults((marks || []).filter(m => m.test_id === t.id && inBatch(m)), papersByTest[t.id] || []).filter(x => x.pct != null)
      return { t, n: r.length, avg: r.length ? Math.round(r.reduce((a, x) => a + x.pct, 0) / r.length * 10) / 10 : null }
    })
    const exportCsv = () => downloadCsv(`Mission_Foundation_series_${batch}.csv`, [
      ['Rank', 'Student', 'GCC', 'Batch', ...tests.map(t => t.title || 'Test ' + t.test_no), 'Tests sat', 'Average %', 'First to last'],
      ...series.map(s => [s.rank ?? '', s.student_name, s.gcc_no || '', s.batch, ...tests.map(t => s.perTest[t.id] ?? ''), s.tests, s.pct ?? '', s.change ?? '']),
    ])
    return (
      <>
        {picker}
        <PremiumCard title="Test by test" subtitle={`Average % of ${batch === 'All' ? 'both batches' : batch} in each test`}>
          {testAvgs.map(({ t, n, avg }) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 90px', gap: 12, alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontWeight: 700 }}>{t.title || 'Test ' + t.test_no}<div style={{ fontSize: 12, color: PX.sub, fontWeight: 500 }}>{fmt(t.test_date)} · {n} students</div></span>
              <Bar pct={avg} tone={pctTone(avg)} />
              <span style={{ fontWeight: 800, textAlign: 'right' }}>{avg == null ? '—' : avg + '%'}</span>
            </div>
          ))}
        </PremiumCard>
        <PremiumCard title="Series ranking" subtitle="Average % across the tests each student sat; 'First to last' is the change from their first test to their latest" bodyStyle={{ padding: 0 }}
          right={<Btn onClick={exportCsv} disabled={!sat.length}>Excel (CSV)</Btn>}>
          {!sat.length ? <div style={{ padding: 20, color: PX.sub }}>No marks entered yet.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="px-table" style={{ width: '100%' }}>
                <thead><tr><th>Rank</th><th>Student</th><th>Batch</th>{tests.map(t => <th key={t.id}>T{t.test_no}</th>)}<th>Average</th><th>First → last</th></tr></thead>
                <tbody>
                  {series.map(s => (
                    <tr key={s.student_id}>
                      <td style={{ fontWeight: 800 }}>{s.rank ?? '—'}</td><td style={{ fontWeight: 600 }}>{s.student_name}</td><td>{s.batch}</td>
                      {tests.map(t => <td key={t.id}>{s.perTest[t.id] ?? '—'}</td>)}
                      <td><Pill tone={pctTone(s.pct)}>{s.pct == null ? '—' : s.pct + '%'}</Pill></td>
                      <td style={{ fontWeight: 700, color: s.change == null ? PX.faint : s.change >= 0 ? PX.ok : PX.bad }}>{s.change == null ? '—' : (s.change > 0 ? '▲ ' : s.change < 0 ? '▼ ' : '') + Math.abs(s.change)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>
      </>
    )
  }

  const satList = ranked.filter(r => r.pct != null)
  const avgPct = satList.length ? Math.round(satList.reduce((a, r) => a + r.pct, 0) / satList.length * 10) / 10 : null
  const top = satList.slice(0, 5)
  const needHelp = [...satList].reverse().slice(0, 5)
  const tile = (label, value, sub) => (
    <div style={{ background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 16, padding: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: PX.navy, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: PX.sub }}>{sub}</div>}
    </div>
  )
  return (
    <>
      {picker}
      {!satList.length ? <PremiumCard title={test?.title} subtitle="No marks entered for this test yet." /> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
          {tile('Students', satList.length, `${ranked.length - satList.length} absent`)}
          {tile('Average', avgPct + '%', 'of full marks')}
          {tile('Highest', satList[0].pct + '%', satList[0].student_name)}
          {tile('50% or more', satList.filter(r => r.pct >= 50).length, `of ${satList.length} students`)}
        </div>
        <PremiumCard title="Subjects" subtitle="Average, highest and lowest marks; 'Below 40%' shows where to re-teach" bodyStyle={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="px-table" style={{ width: '100%' }}>
              <thead><tr><th>Subject</th><th>Average</th><th style={{ minWidth: 120 }}>Average %</th><th>Highest</th><th>Lowest</th><th>Below 40%</th><th>Absent</th></tr></thead>
              <tbody>
                {subj.map(s => (
                  <tr key={s.subject}>
                    <td style={{ fontWeight: 700 }}>{s.subject}</td>
                    <td>{s.avg ?? '—'} / {s.max}</td>
                    <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Bar pct={s.avgPct} tone={pctTone(s.avgPct)} /><b>{s.avgPct ?? '—'}%</b></div></td>
                    <td>{s.high ?? '—'}</td><td>{s.low ?? '—'}</td>
                    <td>{s.weak ? <Pill tone="bad">{s.weak}</Pill> : '0'}</td><td>{s.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
          <PremiumCard title="Score bands" subtitle="How many students in each range">
            {bands.map(b => (
              <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 10, alignItems: 'center', padding: '5px 0' }}>
                <span style={{ fontSize: 13.5 }}>{b.label}</span>
                <Bar pct={satList.length ? (b.count / satList.length) * 100 : 0} tone={b.min >= 75 ? 'ok' : b.min >= 50 ? 'gold' : 'bad'} />
                <b style={{ textAlign: 'right' }}>{b.count}</b>
              </div>
            ))}
          </PremiumCard>
          <PremiumCard title="Udaan and Pragati" subtitle="Average % of each batch in this test">
            {batchAverages(allRanked).map(b => (
              <div key={b.batch} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', gap: 10, alignItems: 'center', padding: '8px 0' }}>
                <b>{b.batch}</b><Bar pct={b.avgPct} tone={pctTone(b.avgPct)} /><span style={{ textAlign: 'right', fontWeight: 800 }}>{b.avgPct == null ? '—' : b.avgPct + '%'}</span>
              </div>
            ))}
            <div style={{ fontSize: 12.5, color: PX.sub }}>{batchAverages(allRanked).map(b => `${b.batch}: ${b.students} students`).join(' · ')}</div>
          </PremiumCard>
          <PremiumCard title="Top 5" subtitle={batch === 'All' ? 'Both batches' : batch}>
            {top.map(r => <div key={r.student_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}><span><b>{ordinal(r.rank)}</b> {r.student_name} <span style={{ color: PX.sub, fontSize: 12.5 }}>{r.batch}</span></span><Pill tone={pctTone(r.pct)}>{r.pct}%</Pill></div>)}
          </PremiumCard>
          <PremiumCard title="Need extra help" subtitle="The 5 lowest scores in this test">
            {needHelp.map(r => <div key={r.student_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}><span>{r.student_name} <span style={{ color: PX.sub, fontSize: 12.5 }}>{r.batch}</span></span><Pill tone={pctTone(r.pct)}>{r.pct}%</Pill></div>)}
          </PremiumCard>
        </div>
      </>}
    </>
  )
}

// ─── Study material ───────────────────────────────────────────────────────────
const blank = { title: '', subject: '', test_id: '', link_url: '', note: '', file: null }
async function uploadFile(file, me, folder) {
  const safe = file.name.replace(/[^\w.-]+/g, '_')
  const who = (me || 'staff').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const path = `mission-foundation/${folder}/${who}/${Date.now()}-${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return path
}
async function openFile(path, flash) {
  const tab = window.open('', '_blank')
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) { tab?.close(); return flash('Could not open the file: ' + (error?.message || 'no link'), true) }
  if (tab) tab.location.href = data.signedUrl; else window.location.href = data.signedUrl
}

export function MaterialTab({ tests, me, isAdmin, flash }) {
  const [items, setItems] = useState(null)
  const [d, setD] = useState(blank)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')
  const [mode, setMode] = useState('write')      // write (the builder) | file (attach a file or link)
  const [editing, setEditing] = useState(null)
  const [openId, setOpenId] = useState(null)
  const load = useCallback(async () => {
    const { data, error } = await supabase.from(T_MAT).select('*').order('created_at', { ascending: false })
    if (error) flash('Could not load material: ' + error.message, true)
    setItems(data || [])
  }, [flash])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!d.title.trim()) return flash('Give the material a title.', true)
    const link = d.link_url.trim() ? safeUrl(d.link_url) : ''
    if (d.link_url.trim() && !link) return flash('Use a full https:// link.', true)
    if (!d.file && !link) return flash('Choose a file or paste a link.', true)
    if (d.file && d.file.size > 25 * 1024 * 1024) return flash('The file is larger than 25 MB.', true)
    setBusy(true)
    try {
      const file_path = d.file ? await uploadFile(d.file, me, 'material') : null
      const { error } = await supabase.from(T_MAT).insert({ title: d.title.trim(), subject: d.subject || null, test_id: d.test_id || null, link_url: link || null, file_path, file_name: d.file?.name || null, note: d.note.trim() || null, uploaded_by: me })
      if (error) throw error
      setD(blank); setFileKey(k => k + 1); flash('Material added.'); load()
    } catch (e) { flash('Not added: ' + (e?.message || e), true) }
    setBusy(false)
  }
  const remove = async m => {
    if (!window.confirm(`Delete "${m.title}"?`)) return
    const { error } = await supabase.from(T_MAT).delete().eq('id', m.id)
    if (error) return flash('Not deleted: ' + error.message, true)
    if (m.file_path) await supabase.storage.from(BUCKET).remove([m.file_path])
    load()
  }
  const testName = id => { const t = tests.find(x => x.id === id); return t ? (t.title || 'Test ' + t.test_no) : '' }
  const shown = (items || []).filter(m => !filter || m.subject === filter)

  const chip = on => ({ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? '#e4ebf6' : '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' })
  const startEdit = m => { setEditing(m); setMode('write'); window.scrollTo?.({ top: 0, behavior: 'smooth' }) }
  return (
    <>
      <div role="tablist" aria-label="Add study material" data-ti-skip style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" role="tab" aria-selected={mode === 'write'} style={chip(mode === 'write')} onClick={() => { setMode('write') }}>✍ Write notes</button>
        <button type="button" role="tab" aria-selected={mode === 'file'} style={chip(mode === 'file')} onClick={() => { setMode('file'); setEditing(null) }}>📎 Attach a file or link</button>
      </div>
      {mode === 'write' && <NotesStudio key={editing?.id || 'new'} {...{ tests, me, flash, editing }} onSaved={cancelled => { setEditing(null); if (!cancelled) load() }} />}
      {mode === 'file' && <PremiumCard title="Attach a file or link" subtitle="Notes, worksheets, answer keys: a file (PDF, Word, photo, up to 25 MB) or a link. Only staff can open them.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <label>Title<input className="px-input" value={d.title} onChange={e => setD({ ...d, title: e.target.value })} placeholder="e.g. Fractions worksheet 1" /></label>
          <label>Subject<select className="px-input" value={d.subject} onChange={e => setD({ ...d, subject: e.target.value })}><option value="">All subjects</option>{SUBJECTS.map(s => <option key={s.key}>{s.label}</option>)}</select></label>
          <label>For test<select className="px-input" value={d.test_id} onChange={e => setD({ ...d, test_id: e.target.value })}><option value="">Any test</option>{tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}</select></label>
          <label>File<input key={fileKey} className="px-input" type="file" onChange={e => setD({ ...d, file: e.target.files?.[0] || null })} /></label>
          <label>or Link<input className="px-input" value={d.link_url} onChange={e => setD({ ...d, link_url: e.target.value })} placeholder="https://drive.google.com/…" /></label>
          <label>Note<input className="px-input" value={d.note} onChange={e => setD({ ...d, note: e.target.value })} placeholder="Optional" /></label>
        </div>
        <div style={{ marginTop: 12 }}><Btn kind="gold" disabled={busy} onClick={add}>{busy ? 'Uploading…' : 'Add material'}</Btn></div>
      </PremiumCard>}
      <PremiumCard title={`Material · ${shown.length}`} bodyStyle={{ padding: 0 }}
        right={<select className="px-input" aria-label="Filter by subject" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}><option value="">All subjects</option>{SUBJECTS.map(s => <option key={s.key}>{s.label}</option>)}</select>}>
        {items === null ? <div style={{ padding: 20, color: PX.sub }}>Loading…</div> : !shown.length ? <div style={{ padding: 20, color: PX.sub }}>Nothing here yet — write the first notes above.</div> : shown.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 18px', borderTop: `1px solid ${PX.line}` }}>
            <span style={{ fontSize: 24 }} aria-hidden="true">{m.body ? '📝' : m.file_path ? '📄' : '🔗'}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700 }}>{m.title}</div>
              <div style={{ fontSize: 12.5, color: PX.sub }}>{[m.subject || 'All subjects', testName(m.test_id), m.uploaded_by, new Date(m.created_at).toLocaleDateString('en-GB')].filter(Boolean).join(' · ')}{m.note ? ` · ${m.note}` : ''}</div>
            </div>
            {m.body && <Btn onClick={() => setOpenId(openId === m.id ? null : m.id)}>{openId === m.id ? 'Hide' : 'Read'}</Btn>}
            {m.body && <Btn onClick={() => printNote(m, tests, m.uploaded_by)}>🖨 Print</Btn>}
            {m.body && (isAdmin || nameMatches(me, m.uploaded_by) || m.uploaded_by === me) && <Btn onClick={() => startEdit(m)}>✎ Edit</Btn>}
            {m.file_path && <Btn onClick={() => openFile(m.file_path, flash)}>Open file</Btn>}
            {m.link_url && <a className="px-btn ghost" href={safeUrl(m.link_url)} target="_blank" rel="noreferrer">Open link</a>}
            {(isAdmin || nameMatches(me, m.uploaded_by) || m.uploaded_by === me) && <Btn onClick={() => remove(m)} aria-label={`Delete ${m.title}`}>✕</Btn>}
            {openId === m.id && m.body && (
              <div style={{ flexBasis: '100%', border: `1px solid ${PX.line}`, borderRadius: 12, background: '#fff', padding: 16, maxHeight: 480, overflow: 'auto' }}>
                <style>{MATH_CSS + MATERIAL_CSS}</style>
                <div className="md" dangerouslySetInnerHTML={{ __html: renderMaterial(m.body) }} />
              </div>
            )}
          </div>
        ))}
      </PremiumCard>
    </>
  )
}

// ─── Group chat ───────────────────────────────────────────────────────────────
export function ChatTab({ me, isAdmin, flash }) {
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  const load = useCallback(async () => {
    const { data, error } = await supabase.from(T_MSG).select('*').order('created_at', { ascending: false }).limit(300)
    if (error) { flash('Could not load messages: ' + error.message, true); return }
    setMsgs((data || []).reverse())
  }, [flash])
  useEffect(() => {
    load()
    const poll = setInterval(load, 15000)
    const ch = supabase.channel('mission-foundation-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: T_MSG }, () => load())
      .subscribe()
    return () => { clearInterval(poll); supabase.removeChannel(ch) }
  }, [load])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs?.length])

  const send = async () => {
    const body = text.trim()
    if (!body && !file) return
    if (file && file.size > 25 * 1024 * 1024) return flash('The file is larger than 25 MB.', true)
    setBusy(true)
    try {
      const url = body && /^https?:\/\/\S+$/i.test(body) ? safeUrl(body) : ''
      const file_path = file ? await uploadFile(file, me, 'chat') : null
      const { error } = await supabase.from(T_MSG).insert({ author: me || 'Staff', body: body || null, link_url: url || null, file_path, file_name: file?.name || null })
      if (error) throw error
      setText(''); setFile(null); setFileKey(k => k + 1); load()
    } catch (e) { flash('Not sent: ' + (e?.message || e), true) }
    setBusy(false)
  }
  const remove = async m => {
    if (!window.confirm('Delete this message?')) return
    const { error } = await supabase.from(T_MSG).delete().eq('id', m.id)
    if (error) return flash('Not deleted: ' + error.message, true)
    if (m.file_path) await supabase.storage.from(BUCKET).remove([m.file_path])
    load()
  }

  let lastDay = ''
  return (
    <PremiumCard title="Foundation teachers' group" subtitle="Messages, files and links for everyone working on Mission Foundation. New messages appear by themselves." bodyStyle={{ padding: 0 }}>
      <div style={{ height: 'min(60vh, 560px)', overflowY: 'auto', padding: '14px 16px', background: '#efe9dc' }}>
        {msgs === null ? <div style={{ color: PX.sub }}>Loading…</div> : !msgs.length ? <div style={{ color: PX.sub, textAlign: 'center', marginTop: 40 }}>No messages yet. Say hello 👋</div> : msgs.map(m => {
          const mine = m.author === me
          const day = new Date(m.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
          const showDay = day !== lastDay; lastDay = day
          return (
            <div key={m.id}>
              {showDay && <div style={{ textAlign: 'center', margin: '10px 0' }}><span style={{ background: '#fff', borderRadius: 8, padding: '3px 10px', fontSize: 12, color: PX.sub, fontWeight: 700 }}>{day}</span></div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', margin: '6px 0' }}>
                {!mine && <Avatar name={m.author} size={30} />}
                <div style={{ maxWidth: '78%', background: mine ? '#d9fdd3' : '#fff', borderRadius: 14, padding: '8px 12px', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
                  {!mine && <div style={{ fontSize: 12.5, fontWeight: 800, color: PX.navy2 }}>{m.author}</div>}
                  {m.body && (m.link_url ? <a href={safeUrl(m.link_url)} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{m.body}</a> : <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>)}
                  {m.file_path && <button type="button" className="px-btn ghost" style={{ marginTop: 6 }} onClick={() => openFile(m.file_path, flash)}>📎 {m.file_name || 'File'}</button>}
                  <div style={{ fontSize: 11, color: PX.faint, textAlign: 'right', marginTop: 2 }}>
                    {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {(mine || isAdmin) && <button type="button" aria-label="Delete message" onClick={() => remove(m)} style={{ marginLeft: 8, border: 'none', background: 'none', color: PX.faint, cursor: 'pointer' }}>✕</button>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12, alignItems: 'flex-end', borderTop: `1px solid ${PX.line}`, flexWrap: 'wrap' }}>
        <textarea className="px-input" aria-label="Message" rows={2} placeholder="Type a message…" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} style={{ flex: '1 1 260px', resize: 'vertical' }} />
        <label className="px-btn ghost" style={{ cursor: 'pointer' }}>📎 {file ? file.name.slice(0, 18) : 'File'}<input key={fileKey} type="file" hidden onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        <Btn kind="gold" disabled={busy || (!text.trim() && !file)} onClick={send}>{busy ? 'Sending…' : 'Send'}</Btn>
      </div>
    </PremiumCard>
  )
}


// ─── Students: the live roster from the ERP Students module ──────────────────
// Nothing is copied: marks entry, test day sheets, results and prizes read the active Udaan / Pragati students
// straight from the students table, so a new admission shows up here as soon as it is saved in Students.
export function StudentsTab({ students, unplaced, allMarks, tests, isAdmin, flash, reloadStudents }) {
  const [q, setQ] = useState('')
  const [batch, setBatch] = useState('All')
  const [busy, setBusy] = useState('')
  const sat = useMemo(() => {
    const m = {}
    ;(allMarks || []).forEach(r => { (m[r.student_id] ||= new Set()).add(r.test_id) })
    return m
  }, [allMarks])
  if (students == null) return <PremiumCard title="Students" subtitle="Loading the Foundation students…" />
  const count = b => students.filter(s => s.batchName === b).length
  const needle = q.trim().toLowerCase()
  const list = students.filter(s => (batch === 'All' || s.batchName === batch) && (!needle || `${s.name} ${s.gcc_no || ''} ${s.admission_no || ''}`.toLowerCase().includes(needle)))
  const place = async (s, b) => {
    setBusy(s.id)
    const { error } = await supabase.from('students').update({ batch: b, course: 'Foundation' }).eq('id', s.id)
    setBusy('')
    if (error) return flash('Not saved: ' + error.message, true)
    flash(`${s.name} is now in ${b}.`); reloadStudents()
  }
  const exportCsv = () => downloadCsv('Mission_Foundation_students.csv', [
    ['Name', 'GCC', 'Admission no.', 'Batch', 'Phone', 'Tests with marks'],
    ...list.map(s => [s.name, s.gcc_no || '', s.admission_no || '', s.batchName, s.phone || '', sat[s.id]?.size || 0]),
  ])
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PremiumCard title="Foundation students" subtitle="Live from the Students module. Every active Udaan and Pragati student is in marks entry, test day sheets, results and certificates automatically."
        right={<div style={{ display: 'flex', gap: 8 }}><Btn onClick={reloadStudents}>↻ Refresh</Btn><Btn onClick={exportCsv} disabled={!list.length}>⬇ Excel</Btn></div>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
          {[['All', students.length], ...BATCHES.map(b => [b, count(b)])].map(([b, n]) => (
            <button key={b} type="button" onClick={() => setBatch(b)} aria-pressed={batch === b}
              style={{ textAlign: 'left', border: `1.5px solid ${batch === b ? PX.gold : PX.line}`, background: batch === b ? PX.goldBg : '#fff', borderRadius: 14, padding: '10px 14px', cursor: 'pointer', font: 'inherit', color: PX.ink }}>
              <div style={{ fontSize: 12, color: PX.sub }}>{b === 'All' ? 'All Foundation' : b}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{n}</div>
            </button>
          ))}
          {unplaced.length > 0 && (
            <div style={{ border: `1.5px solid ${PX.warn}`, background: PX.warnBg, borderRadius: 14, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, color: PX.warn }}>No batch yet</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: PX.warn }}>{unplaced.length}</div>
            </div>
          )}
        </div>
        <input className="px-input" placeholder="Search name, GCC or admission no." aria-label="Search students" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 360, marginBottom: 10 }} />
        <div style={{ overflowX: 'auto' }}>
          <table className="px-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ textAlign: 'left', color: PX.sub }}><th style={{ padding: 6 }}>#</th><th>Student</th><th>GCC</th><th>Batch</th><th>Phone</th><th>Tests with marks</th></tr></thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id} style={{ borderTop: `1px solid ${PX.line}` }}>
                  <td style={{ padding: 6, color: PX.faint }}>{i + 1}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={s.name} size={26} staff={false} /><b>{s.name}</b></div></td>
                  <td>{s.gcc_no || '—'}</td>
                  <td><Pill tone={s.batchName === 'Udaan' ? 'info' : 'gold'}>{s.batchName}</Pill></td>
                  <td>{s.phone || '—'}</td>
                  <td>{sat[s.id]?.size || 0} / {tests.length}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} style={{ padding: 14, color: PX.sub }}>{students.length ? 'No student matches.' : 'No active Udaan or Pragati students found in Students.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </PremiumCard>
      {unplaced.length > 0 && (
        <PremiumCard title={`${unplaced.length} Foundation student${unplaced.length === 1 ? '' : 's'} with no Udaan / Pragati batch`} subtitle="They are Foundation students but their batch is blank or unknown, so they are left out of marks entry. Put each one in a batch.">
          <div style={{ display: 'grid', gap: 8 }}>
            {unplaced.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: `1px solid ${PX.line}`, borderRadius: 12, padding: '8px 12px' }}>
                <Avatar name={s.name} size={26} staff={false} />
                <b style={{ flex: 1, minWidth: 140 }}>{s.name}</b>
                <span style={{ fontSize: 12.5, color: PX.sub }}>GCC {s.gcc_no || '—'} · batch “{s.batch || 'blank'}”</span>
                {isAdmin ? BATCHES.map(b => <Btn key={b} disabled={busy === s.id} onClick={() => place(s, b)}>Put in {b}</Btn>) : <span style={{ fontSize: 12, color: PX.faint }}>An admin can fix this in Students.</span>}
              </div>
            ))}
          </div>
        </PremiumCard>
      )}
    </div>
  )
}

// ─── Audit log (admin) ────────────────────────────────────────────────────────────────────────────
export function AuditTab({ flash }) {
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('mission_foundation_audit').select('*').order('at', { ascending: false }).limit(300)
    if (error) { flash('Could not load the audit log: ' + error.message + ' (run supabase/migrations/20261217_mission_foundation_audit.sql)', true); setRows([]) } else setRows(data || [])
  }, [flash])
  useEffect(() => { load() }, [load])
  const needle = q.trim().toLowerCase()
  const shown = (rows || []).filter(r => !needle || [r.actor, r.action, r.ref, JSON.stringify(r.detail || '')].join(' ').toLowerCase().includes(needle))
  const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <PremiumCard title="Audit log" subtitle="Every paper change, mark entry and lock, newest first. Entries cannot be edited or deleted." bodyStyle={{ padding: 0 }}
      right={<span style={{ display: 'flex', gap: 6 }}><input className="px-input" type="search" aria-label="Find in the log" placeholder="Find…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 160 }} />
        <button type="button" className="px-btn ghost" onClick={load}>↻ Refresh</button></span>}>
      {rows === null ? <div style={{ padding: 20, color: PX.sub }}>Loading…</div> : !shown.length ? <div style={{ padding: 20, color: PX.sub }}>Nothing logged yet.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="px-table" style={{ width: '100%' }}>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th><th>Details</th></tr></thead>
            <tbody>{shown.map(r => (
              <tr key={r.id}><td>{when(r.at)}</td><td>{r.actor || '—'}</td><td><Pill tone={/lock/.test(r.action) ? 'gold' : 'info'}>{r.action}</Pill></td><td>{r.ref || '—'}</td>
                <td style={{ whiteSpace: 'normal', fontSize: 12.5 }}>{r.detail ? JSON.stringify(r.detail) : ''}</td></tr>))}</tbody>
          </table>
        </div>)}
    </PremiumCard>
  )
}
