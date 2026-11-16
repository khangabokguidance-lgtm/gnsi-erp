// MissionSainikAnalyzer.jsx — Pre Mock Analyzer (PMT-01…20) and Mega Mock Analyzer (MT-01…20) for Mission Sainik.
// One component, two series. Results live in `mission_sainik_results` (migration 20261205_mission_sainik_results.sql).
// Pre Mock : 150 Q / 300 marks, six sections × 50 marks.   Mega Mock: AISSEE pattern, 125 Q / 300 marks, four sections.
// Qualifying rule (AISSEE): at least 25% in every section and 40% overall.
import { useState, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { TESTS, MOCK_TESTS } from './missionSainikData'

const CFG = {
  pre: {
    name: 'Pre Mock', tests: TESTS, prefix: 'PMT',
    sections: [
      { k: 'maths', l: 'Mathematics', s: 'Maths', max: 50 }, { k: 'reasoning', l: 'Reasoning', s: 'Reasoning', max: 50 },
      { k: 'science', l: 'Science', s: 'Science', max: 50 }, { k: 'gk', l: 'General Knowledge', s: 'GK', max: 50 },
      { k: 'grammar', l: 'English Grammar', s: 'Grammar', max: 50 }, { k: 'vocab', l: 'Vocabulary', s: 'Vocab', max: 50 },
    ],
  },
  mega: {
    name: 'Mega Mock', tests: MOCK_TESTS, prefix: 'MT',
    sections: [
      { k: 'maths', l: 'Mathematics', s: 'Maths', max: 150 }, { k: 'intel', l: 'Intelligence', s: 'Intel', max: 50 },
      { k: 'lang', l: 'Grammar + Vocabulary', s: 'Language', max: 50 }, { k: 'gksci', l: 'Science + GK', s: 'Sci+GK', max: 50 },
    ],
  },
}
const TOTAL = 300
const fmtShort = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const line = PX.line || '#eef1f6'

export default function MissionSainikAnalyzer({ series, results, reload, setupNeeded, currentUser, setMsg, isMobile }) {
  const cfg = CFG[series]
  const rows = useMemo(() => results.filter(r => r.series === series), [results, series])
  const [view, setView] = useState('test')
  const [testNo, setTestNo] = useState(1)
  const [student, setStudent] = useState('')
  const [draft, setDraft] = useState({ test_no: 1, student: '', roll: '', batch: '', scores: {} })
  const [bulk, setBulk] = useState('')
  const [busy, setBusy] = useState(false)

  const total = r => cfg.sections.reduce((a, x) => a + (Number(r.scores?.[x.k]) || 0), 0)
  const qualifies = r => total(r) / TOTAL >= 0.4 && cfg.sections.every(x => (Number(r.scores?.[x.k]) || 0) / x.max >= 0.25)
  const names = useMemo(() => [...new Set(rows.map(r => r.student))].sort(), [rows])
  const testRows = useMemo(() => rows.filter(r => r.test_no === testNo).sort((a, b) => total(b) - total(a)), [rows, testNo]) // eslint-disable-line react-hooks/exhaustive-deps
  const heldTests = useMemo(() => [...new Set(rows.map(r => r.test_no))].sort((a, b) => a - b), [rows])

  const validate = scores => {
    for (const x of cfg.sections) {
      const v = scores[x.k]
      if (v === '' || v == null) continue
      if (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > x.max) return `${x.l} must be 0–${x.max}`
    }
    return ''
  }
  const upsert = async list => {
    setBusy(true)
    const { error } = await supabase.from('mission_sainik_results').upsert(list, { onConflict: 'series,test_no,student' })
    setBusy(false)
    if (error) { setMsg('❌ ' + error.message); return false }
    await reload(); return true
  }
  const save = async () => {
    const d = draft
    if (!d.student.trim()) return setMsg('❌ Enter the student name.')
    const err = validate(d.scores); if (err) return setMsg('❌ ' + err)
    const scores = {}; cfg.sections.forEach(x => { if (d.scores[x.k] !== '' && d.scores[x.k] != null) scores[x.k] = Number(d.scores[x.k]) })
    if (await upsert([{ series, test_no: Number(d.test_no), student: d.student.trim(), roll: d.roll.trim() || null, batch: d.batch.trim() || null, scores, entered_by: currentUser?.name || '' }])) {
      setMsg('✅ Saved'); setDraft({ ...d, student: '', roll: '', scores: {} })
    }
  }
  const importBulk = async () => {
    const list = []
    for (const [i, ln] of bulk.split('\n').map(x => x.trim()).filter(Boolean).entries()) {
      const c = ln.split(/\t|,/).map(x => x.trim())
      if (i === 0 && Number.isNaN(Number(c[3]))) continue // header row
      const scores = {}; cfg.sections.forEach((x, j) => { if (c[3 + j] !== undefined && c[3 + j] !== '') scores[x.k] = Number(c[3 + j]) })
      const err = validate(scores)
      if (!c[0] || err) return setMsg(`❌ Line ${i + 1}: ${!c[0] ? 'missing name' : err}`)
      list.push({ series, test_no: Number(draft.test_no), student: c[0], roll: c[1] || null, batch: c[2] || null, scores, entered_by: currentUser?.name || '' })
    }
    if (!list.length) return setMsg('❌ Nothing to import.')
    if (await upsert(list)) { setMsg(`✅ Imported ${list.length} result(s) for ${cfg.prefix}-${String(draft.test_no).padStart(2, '0')}`); setBulk('') }
  }
  const del = async r => {
    if (!window.confirm(`Delete ${r.student}'s result?`)) return
    const { error } = await supabase.from('mission_sainik_results').delete().eq('id', r.id)
    if (error) return setMsg('❌ ' + error.message)
    reload()
  }

  // ── analysis helpers ───────────────────────────────────────────────────
  const rankIn = (r, list) => list.findIndex(x => x.id === r.id) + 1
  const Bar = ({ v, color }) => <div style={{ height: 8, borderRadius: 4, background: line, overflow: 'hidden' }}><div style={{ width: Math.max(0, Math.min(100, v)) + '%', height: '100%', background: color || PX.gold }} /></div>
  const chip = (ok, t) => <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: ok ? PX.ok : PX.bad, background: ok ? PX.okBg : PX.badBg }}>{t}</span>
  const stat = (l, v, sub, bad) => (
    <div style={{ padding: 12, borderRadius: 12, background: bad ? PX.badBg : PX.tint }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: PX.sub }}>{l}</div>
      <div style={{ fontFamily: PX.serif, fontSize: 24, color: bad ? PX.bad : PX.navy }}>{v}</div>
      <div style={{ fontSize: 11.5, color: PX.sub }}>{sub}</div>
    </div>
  )
  const tid = n => `${cfg.prefix}-${String(n).padStart(2, '0')}`
  const tdate = n => cfg.tests.find(t => t.no === n)?.date

  const TestView = () => {
    const n = testRows.length
    if (!n) return <PremiumCard title="Test analysis"><div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>No results entered for {tid(testNo)} yet — use the Enter results tab.</div></PremiumCard>
    const tots = testRows.map(total)
    const avg = tots.reduce((a, b) => a + b, 0) / n
    const secAvg = cfg.sections.map(x => ({ ...x, avg: testRows.reduce((a, r) => a + (Number(r.scores?.[x.k]) || 0), 0) / n }))
    const weakest = [...secAvg].sort((a, b) => a.avg / a.max - b.avg / b.max)[0]
    const bands = [0, 20, 40, 60, 80].map(lo => ({ lo, c: tots.filter(t => t / TOTAL * 100 >= lo && (lo === 80 ? true : t / TOTAL * 100 < lo + 20)).length }))
    const q = testRows.filter(qualifies).length
    return (
      <>
        <PremiumCard title={`${tid(testNo)} · ${n} student(s)`} subtitle={tdate(testNo) ? fmtShort(tdate(testNo)) : ''}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 10 }}>
            {stat('Average', avg.toFixed(1), `${(avg / TOTAL * 100).toFixed(0)}% of ${TOTAL}`)}
            {stat('Highest', Math.max(...tots), testRows[0].student)}
            {stat('Lowest', Math.min(...tots), testRows[n - 1].student)}
            {stat('Qualifying', `${q}/${n}`, '≥25% each · ≥40% total', q / n < 0.5)}
            {stat('Weakest section', weakest.s, `${(weakest.avg / weakest.max * 100).toFixed(0)}% average`, weakest.avg / weakest.max < 0.6)}
          </div>
        </PremiumCard>
        <PremiumCard title="Section-wise average" subtitle="Red bars are below 60%">
          {secAvg.map(x => { const p = x.avg / x.max * 100; return (
            <div key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13 }}>
              <span style={{ width: 150 }}>{x.l}</span><div style={{ flex: 1 }}><Bar v={p} color={p < 60 ? PX.bad : PX.ok} /></div><b style={{ width: 90, textAlign: 'right' }}>{x.avg.toFixed(1)}/{x.max}</b>
            </div>) })}
        </PremiumCard>
        <PremiumCard title="Score distribution">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 90 }}>
            {bands.map(b => (
              <div key={b.lo} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, color: PX.sub }}>
                <div style={{ height: Math.max(4, (b.c / n) * 70), background: PX.navy, borderRadius: 4, opacity: .85 }} />{b.c}<div>{b.lo}–{b.lo === 80 ? 100 : b.lo + 20}%</div>
              </div>))}
          </div>
        </PremiumCard>
        <PremiumCard title="Rank list" bodyStyle={{ padding: 0, overflowX: 'auto' }}>
          <table className="px-table" style={{ minWidth: 620 }}>
            <thead><tr><th>#</th><th>Student</th><th>Batch</th>{cfg.sections.map(x => <th key={x.k}>{x.s}</th>)}<th>Total</th><th>%</th><th>Result</th><th /></tr></thead>
            <tbody>{testRows.map((r, i) => (
              <tr key={r.id}>
                <td><b>{i + 1}</b></td>
                <td><button style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: PX.navy }} onClick={() => { setStudent(r.student); setView('student') }}>{r.student}</button>{r.roll ? <span style={{ color: PX.sub, fontSize: 11 }}> · {r.roll}</span> : null}</td>
                <td>{r.batch || '—'}</td>
                {cfg.sections.map(x => { const v = r.scores?.[x.k]; return <td key={x.k} style={{ color: v != null && v / x.max < 0.25 ? PX.bad : undefined }}>{v ?? '—'}</td> })}
                <td><b>{total(r)}</b></td><td>{(total(r) / TOTAL * 100).toFixed(0)}%</td><td>{chip(qualifies(r), qualifies(r) ? 'Qualifies' : 'Below cut-off')}</td>
                <td><button className="px-hbtn" onClick={() => del(r)} aria-label="Delete">🗑</button></td>
              </tr>))}
            </tbody>
          </table>
        </PremiumCard>
      </>
    )
  }

  const StudentView = () => {
    const mine = rows.filter(r => r.student === student).sort((a, b) => a.test_no - b.test_no)
    if (!student || !mine.length) return <PremiumCard title="Student analysis"><div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>Pick a student above.</div></PremiumCard>
    const per = mine.map(r => {
      const list = rows.filter(x => x.test_no === r.test_no).sort((a, b) => total(b) - total(a))
      const rk = rankIn(r, list)
      return { r, t: total(r), rk, n: list.length, pctile: Math.round(((list.length - rk + 1) / list.length) * 100) }
    })
    const secAvg = cfg.sections.map(x => ({ ...x, p: mine.reduce((a, r) => a + (Number(r.scores?.[x.k]) || 0) / x.max, 0) / mine.length * 100 })).sort((a, b) => a.p - b.p)
    const last3 = per.slice(-3), first3 = per.slice(0, 3)
    const mean = a => a.reduce((s, x) => s + x.t, 0) / a.length
    const projected = mean(last3)
    const delta = per.length >= 4 ? mean(last3) - mean(first3) : null
    const qual = projected / TOTAL >= 0.4 && secAvg.every(x => x.p >= 25)
    const W = 560, H = 140, pad = 28
    const pts = per.map((p, i) => [pad + (per.length > 1 ? (i / (per.length - 1)) * (W - 2 * pad) : (W - 2 * pad) / 2), H - pad - (p.t / TOTAL) * (H - 2 * pad), p])
    const print = () => {
      const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print')
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(student)} – ${cfg.name} report</title><style>@page{size:A4;margin:14mm}body{font-family:Georgia,serif;color:#111827;font-size:13px}h1{margin:0;color:#132a4f;font-size:20px;text-align:center}.s{text-align:center;color:#555;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{border:1px solid #999;padding:5px 7px;text-align:left}th{background:#eef1f6}</style></head><body>
<h1>Guidance Navodaya &amp; Sainik Institute</h1><div class="s">Mission Sainik 2027 · ${cfg.name} Report Card</div>
<p><b>${esc(student)}</b>${mine[0].roll ? ' · Roll ' + esc(mine[0].roll) : ''}${mine[0].batch ? ' · ' + esc(mine[0].batch) : ''}</p>
<table><tr><th>Test</th>${cfg.sections.map(x => `<th>${esc(x.s)} /${x.max}</th>`).join('')}<th>Total /300</th><th>Rank</th><th>Percentile</th></tr>
${per.map(p => `<tr><td>${tid(p.r.test_no)}</td>${cfg.sections.map(x => `<td>${p.r.scores?.[x.k] ?? '—'}</td>`).join('')}<td><b>${p.t}</b></td><td>${p.rk}/${p.n}</td><td>${p.pctile}</td></tr>`).join('')}</table>
<p><b>Projected score (last ${last3.length} tests):</b> ${projected.toFixed(0)}/300 — ${qual ? 'on track to qualify' : 'below the qualifying cut-off'}.</p>
<p><b>Focus areas:</b> ${secAvg.slice(0, 2).map(x => `${esc(x.l)} (${x.p.toFixed(0)}%)`).join(', ')}.</p>
<p style="margin-top:40px;text-align:right">Principal, GNSI</p><script>window.onload=()=>window.print()</script></body></html>`)
      w.document.close()
    }
    return (
      <>
        <PremiumCard title={student} subtitle={`${mine.length} ${cfg.name} test(s)${mine[0].batch ? ' · ' + mine[0].batch : ''}`} right={<button className="px-hbtn" onClick={print}>🖨 Report card</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
            {stat('Latest', per[per.length - 1].t, `${tid(per[per.length - 1].r.test_no)} · rank ${per[per.length - 1].rk}/${per[per.length - 1].n}`)}
            {stat('Projected', projected.toFixed(0), `avg of last ${last3.length} test(s)`, !qual)}
            {stat('Trend', delta == null ? '—' : (delta >= 0 ? '+' : '') + delta.toFixed(0), delta == null ? 'needs 4+ tests' : 'last 3 vs first 3', delta != null && delta < 0)}
            {stat('Qualifying', qual ? 'On track' : 'At risk', '≥25% each · ≥40% total', !qual)}
          </div>
        </PremiumCard>
        <PremiumCard title="Score trend" subtitle="Total out of 300 per test">
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 620 }} role="img" aria-label="Score trend">
            <line x1={pad} x2={W - pad} y1={H - pad - 0.4 * (H - 2 * pad)} y2={H - pad - 0.4 * (H - 2 * pad)} stroke={PX.bad} strokeDasharray="4 4" opacity=".5" />
            <text x={W - pad} y={H - pad - 0.4 * (H - 2 * pad) - 4} fontSize="9" textAnchor="end" fill={PX.bad}>40% cut-off</text>
            <polyline fill="none" stroke={PX.navy} strokeWidth="2" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} />
            {pts.map(p => <g key={p[2].r.id}><circle cx={p[0]} cy={p[1]} r="3.5" fill={PX.navy} /><text x={p[0]} y={H - 8} fontSize="9" textAnchor="middle" fill={PX.sub}>{p[2].r.test_no}</text><text x={p[0]} y={p[1] - 7} fontSize="9" textAnchor="middle" fill={PX.sub}>{p[2].t}</text></g>)}
          </svg>
        </PremiumCard>
        <PremiumCard title="Strengths and weak sections" subtitle="Average across all tests, weakest first">
          {secAvg.map(x => (
            <div key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13 }}>
              <span style={{ width: 150 }}>{x.l}</span><div style={{ flex: 1 }}><Bar v={x.p} color={x.p < 25 ? PX.bad : x.p < 60 ? PX.warn : PX.ok} /></div><b style={{ width: 50, textAlign: 'right' }}>{x.p.toFixed(0)}%</b>
            </div>))}
          <div style={{ marginTop: 8, fontSize: 13, color: PX.sub }}>Focus next on <b style={{ color: PX.navy }}>{secAvg.slice(0, 2).map(x => x.l).join(' and ')}</b>.</div>
        </PremiumCard>
        <PremiumCard title="Test-by-test" bodyStyle={{ padding: 0, overflowX: 'auto' }}>
          <table className="px-table" style={{ minWidth: 560 }}>
            <thead><tr><th>Test</th>{cfg.sections.map(x => <th key={x.k}>{x.s}</th>)}<th>Total</th><th>Rank</th><th>Percentile</th></tr></thead>
            <tbody>{per.map(p => <tr key={p.r.id}><td><b>{tid(p.r.test_no)}</b></td>{cfg.sections.map(x => <td key={x.k}>{p.r.scores?.[x.k] ?? '—'}</td>)}<td><b>{p.t}</b></td><td>{p.rk}/{p.n}</td><td>{p.pctile}</td></tr>)}</tbody>
          </table>
        </PremiumCard>
      </>
    )
  }

  const inp = { marginTop: 0 }
  const EnterView = () => (
    <>
      <PremiumCard title="Enter one result" subtitle={`Marks per section. Same test + student again overwrites. ${cfg.name} total is ${TOTAL}.`}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
          <select className="px-input" value={draft.test_no} onChange={e => { setDraft({ ...draft, test_no: e.target.value }); setTestNo(Number(e.target.value)) }}>{cfg.tests.map(t => <option key={t.no} value={t.no}>{tid(t.no)} · {fmtShort(t.date)}</option>)}</select>
          <input className="px-input" style={inp} placeholder="Student name" list="ms-students" value={draft.student} onChange={e => setDraft({ ...draft, student: e.target.value })} />
          <input className="px-input" style={inp} placeholder="Roll no (optional)" value={draft.roll} onChange={e => setDraft({ ...draft, roll: e.target.value })} />
          <input className="px-input" style={inp} placeholder="Batch (optional)" value={draft.batch} onChange={e => setDraft({ ...draft, batch: e.target.value })} />
          {cfg.sections.map(x => <input key={x.k} className="px-input" style={inp} type="number" min="0" max={x.max} placeholder={`${x.l} /${x.max}`} value={draft.scores[x.k] ?? ''} onChange={e => setDraft({ ...draft, scores: { ...draft.scores, [x.k]: e.target.value } })} />)}
        </div>
        <datalist id="ms-students">{names.map(n => <option key={n} value={n} />)}</datalist>
        <button className="px-btn gold" style={{ marginTop: 12 }} disabled={busy} onClick={save}>Save result</button>
      </PremiumCard>
      <PremiumCard title="Bulk paste" subtitle={`For the test selected above (${tid(draft.test_no)}). One student per line: name, roll, batch, ${cfg.sections.map(x => x.s).join(', ')} — comma or tab separated, so a spreadsheet paste works.`}>
        <textarea className="px-input" rows={6} value={bulk} onChange={e => setBulk(e.target.value)} placeholder={`Name, Roll, Batch, ${cfg.sections.map(x => x.s).join(', ')}`} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
        <button className="px-btn" style={{ marginTop: 10 }} disabled={busy || !bulk.trim()} onClick={importBulk}>Import</button>
      </PremiumCard>
    </>
  )

  const views = [['test', 'Test analysis'], ['student', 'Student analysis'], ['enter', 'Enter results']]
  return (
    <>
      {setupNeeded && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261205_mission_sainik_results.sql</b> in Supabase to enable the analyzers.</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {views.map(([id, l]) => <button key={id} className={'px-btn' + (view === id ? ' gold' : ' ghost')} onClick={() => setView(id)}>{l}</button>)}
        {view === 'test' && <select className="px-input" style={{ width: 'auto', marginLeft: 'auto' }} value={testNo} onChange={e => setTestNo(Number(e.target.value))}>
          {cfg.tests.map(t => <option key={t.no} value={t.no}>{tid(t.no)}{heldTests.includes(t.no) ? ' ●' : ''}</option>)}</select>}
        {view === 'student' && <select className="px-input" style={{ width: 'auto', marginLeft: 'auto' }} value={student} onChange={e => setStudent(e.target.value)}>
          <option value="">Choose student…</option>{names.map(n => <option key={n} value={n}>{n}</option>)}</select>}
      </div>
      {view === 'test' && <TestView />}
      {view === 'student' && <StudentView />}
      {view === 'enter' && <EnterView />}
    </>
  )
}
