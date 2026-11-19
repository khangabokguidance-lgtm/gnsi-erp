/* eslint-disable react-hooks/set-state-in-effect -- data loaders set state after fetching, as elsewhere in the portal */
// MissionFoundationExtras.jsx — the Analyser, Certificates, Study material and Group chat tabs of Mission Foundation.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import jsPDF from 'jspdf'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill, Avatar } from './MissionSainikUI'
import { downloadCsv } from './lib/missionSainikExport'
import { drawPremiumCertificate } from './premiumCertificate'
import {
  MISSION_NAME, BATCHES, SUBJECTS, rankResults, subjectStats, scoreBands, batchAverages,
  seriesRanking, topPerBatch, ordinal, nameMatches, safeUrl,
} from './missionFoundationData'

const T_MARKS = 'mission_foundation_marks'
const T_MAT = 'mission_foundation_materials'
const T_MSG = 'mission_foundation_messages'
const BUCKET = 'teacher-materials'

const fmt = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const Btn = ({ kind = 'ghost', children, ...p }) => <button type="button" className={'px-btn ' + kind} {...p}>{children}</button>
const pctTone = p => p == null ? 'mute' : p >= 75 ? 'ok' : p >= 50 ? 'gold' : 'bad'
const pickTest = (tests, today) => [...tests].reverse().find(t => t.test_date <= today) || tests[0]

// All marks of the series, loaded once per tab visit.
function useAllMarks(flash) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      const out = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(T_MARKS).select('test_id, student_id, student_name, gcc_no, batch, subject, marks, absent').range(from, from + 999)
        if (error) { flash('Could not load marks: ' + error.message, true); break }
        out.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      if (live) setRows(out)
    })()
    return () => { live = false }
  }, [flash])
  return rows
}

function Bar({ pct, tone = 'gold' }) {
  const c = { ok: PX.ok, gold: PX.gold, bad: PX.bad, mute: PX.faint }[tone]
  return (
    <div role="img" aria-label={`${pct ?? 0}%`} style={{ height: 10, borderRadius: 5, background: PX.line, overflow: 'hidden', minWidth: 80 }}>
      <div style={{ width: Math.max(0, Math.min(100, pct || 0)) + '%', height: '100%', background: c, borderRadius: 5 }} />
    </div>
  )
}

// ─── Analyser ─────────────────────────────────────────────────────────────────
export function AnalyserTab({ tests, papersByTest, flash, today }) {
  const marks = useAllMarks(flash)
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

// ─── Certificates ─────────────────────────────────────────────────────────────
export function CertificatesTab({ tests, papersByTest, flash, today }) {
  const marks = useAllMarks(flash)
  const [view, setView] = useState(() => pickTest(tests, today)?.id || 'series')
  const [topN, setTopN] = useState(3)
  const [picked, setPicked] = useState({})
  const [busy, setBusy] = useState('')
  const test = tests.find(t => t.id === view)
  const ranked = useMemo(() => {
    if (!marks) return []
    return view === 'series' ? seriesRanking(marks, tests, papersByTest) : rankResults(marks.filter(r => r.test_id === view), papersByTest[view] || [])
  }, [marks, view, tests, papersByTest])
  const winners = useMemo(() => topPerBatch(ranked, Number(topN) || 3), [ranked, topN])
  useEffect(() => { setPicked(Object.fromEntries(winners.map(w => [w.student_id, true]))) }, [winners])
  const chosen = winners.filter(w => picked[w.student_id])
  const what = view === 'series' ? `${MISSION_NAME} (all tests)` : `${test?.title || 'Test'} of ${MISSION_NAME}`

  const make = async () => {
    if (!chosen.length) return flash('Tick at least one student.', true)
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      for (let i = 0; i < chosen.length; i++) {
        const w = chosen[i]
        setBusy(`Making ${i + 1} of ${chosen.length}…`)
        const canvas = await drawPremiumCertificate({
          kind: 'Merit',
          subtitle: `${ordinal(w.batchRank)} Position · ${w.batch} Batch`,
          name: w.student_name,
          detail: [w.gcc_no ? `GCC No. ${w.gcc_no}` : '', 'Foundation', w.batch].filter(Boolean).join(' · '),
          body: [`for securing the ${ordinal(w.batchRank)} position in the ${w.batch} batch`, `in the ${what}${view === 'series' ? '' : ` held on ${fmt(test?.test_date)}`}, scoring ${w.pct}%.`],
          seal: { value: `${w.pct}%`, label: 'SCORE' },
          signatures: [{ title: 'Class Teacher' }, { title: 'Principal' }],
          certNo: `GNSI/MF/${view === 'series' ? 'SERIES' : 'T' + (test?.test_no || '')}/${w.gcc_no || w.student_id}`.slice(0, 60),
        })
        if (i) doc.addPage('a4', 'landscape')
        doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210)
      }
      doc.save(`Mission_Foundation_${view === 'series' ? 'Series' : (test?.title || 'Test').replace(/\W+/g, '_')}_certificates.pdf`)
      flash(`${chosen.length} certificate(s) downloaded.`)
    } catch (e) {
      flash('Could not make certificates: ' + (e?.message || e), true)
    }
    setBusy('')
  }

  if (!tests.length) return <PremiumCard title="No tests yet" subtitle="Create the schedule first." />
  return (
    <PremiumCard title="Merit certificates" subtitle="Top students of each batch, one A4 page each, in one PDF ready to print" bodyStyle={{ padding: 0 }}
      right={<Btn kind="gold" disabled={!!busy || !chosen.length} onClick={make}>{busy || `Download ${chosen.length} certificate${chosen.length === 1 ? '' : 's'}`}</Btn>}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 18px', alignItems: 'center' }}>
        <select className="px-input" aria-label="Test" value={view} onChange={e => setView(e.target.value)} style={{ width: 'auto' }}>
          <option value="series">Whole series (average of all tests)</option>
          {tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Top
          <select className="px-input" aria-label="How many per batch" value={topN} onChange={e => setTopN(e.target.value)} style={{ width: 'auto' }}>{[1, 2, 3, 5, 10].map(n => <option key={n}>{n}</option>)}</select>
          per batch</label>
      </div>
      {marks === null ? <div style={{ padding: 20, color: PX.sub }}>Loading marks…</div> : !winners.length ? <div style={{ padding: 20, color: PX.sub }}>No marks entered yet.</div> : (
        <table className="px-table" style={{ width: '100%' }}>
          <thead><tr><th /><th>Position</th><th>Student</th><th>Batch</th><th>Score</th></tr></thead>
          <tbody>
            {winners.map(w => (
              <tr key={w.student_id}>
                <td><input type="checkbox" aria-label={`Certificate for ${w.student_name}`} checked={!!picked[w.student_id]} onChange={e => setPicked({ ...picked, [w.student_id]: e.target.checked })} /></td>
                <td style={{ fontWeight: 800 }}>{ordinal(w.batchRank)}</td><td style={{ fontWeight: 600 }}>{w.student_name}</td><td>{w.batch}</td>
                <td><Pill tone={pctTone(w.pct)}>{w.pct}%</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PremiumCard>
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

  return (
    <>
      <PremiumCard title="Upload study material" subtitle="Notes, worksheets, answer keys: a file (PDF, Word, photo, up to 25 MB) or a link. Only staff can open them.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <label>Title<input className="px-input" value={d.title} onChange={e => setD({ ...d, title: e.target.value })} placeholder="e.g. Fractions worksheet 1" /></label>
          <label>Subject<select className="px-input" value={d.subject} onChange={e => setD({ ...d, subject: e.target.value })}><option value="">All subjects</option>{SUBJECTS.map(s => <option key={s.key}>{s.label}</option>)}</select></label>
          <label>For test<select className="px-input" value={d.test_id} onChange={e => setD({ ...d, test_id: e.target.value })}><option value="">Any test</option>{tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}</select></label>
          <label>File<input key={fileKey} className="px-input" type="file" onChange={e => setD({ ...d, file: e.target.files?.[0] || null })} /></label>
          <label>or Link<input className="px-input" value={d.link_url} onChange={e => setD({ ...d, link_url: e.target.value })} placeholder="https://drive.google.com/…" /></label>
          <label>Note<input className="px-input" value={d.note} onChange={e => setD({ ...d, note: e.target.value })} placeholder="Optional" /></label>
        </div>
        <div style={{ marginTop: 12 }}><Btn kind="gold" disabled={busy} onClick={add}>{busy ? 'Uploading…' : 'Add material'}</Btn></div>
      </PremiumCard>
      <PremiumCard title={`Material · ${shown.length}`} bodyStyle={{ padding: 0 }}
        right={<select className="px-input" aria-label="Filter by subject" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}><option value="">All subjects</option>{SUBJECTS.map(s => <option key={s.key}>{s.label}</option>)}</select>}>
        {items === null ? <div style={{ padding: 20, color: PX.sub }}>Loading…</div> : !shown.length ? <div style={{ padding: 20, color: PX.sub }}>Nothing uploaded yet.</div> : shown.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 18px', borderTop: `1px solid ${PX.line}` }}>
            <span style={{ fontSize: 24 }} aria-hidden="true">{m.file_path ? '📄' : '🔗'}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700 }}>{m.title}</div>
              <div style={{ fontSize: 12.5, color: PX.sub }}>{[m.subject || 'All subjects', testName(m.test_id), m.uploaded_by, new Date(m.created_at).toLocaleDateString('en-GB')].filter(Boolean).join(' · ')}{m.note ? ` · ${m.note}` : ''}</div>
            </div>
            {m.file_path && <Btn onClick={() => openFile(m.file_path, flash)}>Open file</Btn>}
            {m.link_url && <a className="px-btn ghost" href={safeUrl(m.link_url)} target="_blank" rel="noreferrer">Open link</a>}
            {(isAdmin || nameMatches(me, m.uploaded_by) || m.uploaded_by === me) && <Btn onClick={() => remove(m)} aria-label={`Delete ${m.title}`}>✕</Btn>}
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

