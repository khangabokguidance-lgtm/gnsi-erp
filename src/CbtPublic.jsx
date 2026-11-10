// CbtPublic.jsx — the page a candidate opens from the online exam link (…/exam?t=<id>): no login. They enter
// their name and roll number (and the access code if there is one), read the instructions, and take the exam
// exactly as in the office — but the paper comes from the server, the clock is the server's, answers are saved
// to the server as they go and the server marks it. Reopening the link on the same device resumes the attempt.
import { useEffect, useMemo, useState } from 'react'
import CbtCountdown from './CbtCountdown'
import { DEMO_TEST } from './lib/cbtDemo'
import { DISTRICT_OPTIONS, GENDERS, CASTES } from './lib/studentFields'
import { CBT_CSS } from './cbtCss'
import CbtPlayer, { CbtResult } from './CbtPlayer'
import { listPublicTests, listPracticeTests, listPracticeCopies, practiceCopyUrl, listTop5, practiceTest, examInfo, startExam, startGuest, resumeExam, saveExam, submitExam, lookupStudent, friendly, infoTest, localAttempt, resultView } from './cbtRemote'
import { getInstitute } from './systemSettings'
import ResponsiveTables from './ResponsiveTables'
import { parseExamRef, examHref, extractCode } from './lib/cbtRef'
import { parseMock, mockPath, MOCK_SLUG } from './lib/cbtMock'
import { FINDER_FILTERS, splitPublicTests, showBlocks, rankPractice } from './lib/cbtFinder'
import { trendOf } from './lib/cbtTop5'

const savedKey = id => `gnsi-cbt-remote:${id}`
const backupKey = id => `gnsi-cbt-bk:${id}`
const read = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage blocked */ } }
const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

// The adapter CbtPlayer talks to. `offset` = server time minus this device's time, so the countdown follows the server.
function makeRemote({ testId, code, candidate, gcc, parent, guest = null, attemptId = null, token = null, session = null }) {
  const r = { offset: 0, attemptId, token, session }
  const sync = o => { if (o?.serverNow) r.offset = Date.parse(o.serverNow) - Date.now() }
  const backup = a => write(backupKey(r.attemptId), { ts: Date.now(), answers: a.answers, marked: a.marked, visited: a.visited, current: a.current, lang: a.lang, switches: a.switches, proctor: a.proctor || null, timing: a.timing || null, sec: a.sec || null, changes: a.changes || null })
  r.begin = async () => {
    const res = guest ? await startGuest(testId, code, guest.name, guest.phone, guest.district, guest.gender, guest.caste) : await startExam(testId, code, gcc, parent, null)
    r.attemptId = res.attempt.id; r.token = res.token; r.session = res.session; sync(res.attempt)
    write(savedKey(testId), { attemptId: r.attemptId, token: r.token, session: r.session, name: candidate.name, roll: candidate.roll })
    return { test: res.test, attempt: localAttempt(res.attempt, res.test, candidate) }
  }
  r.save = async a => { backup(a); const res = await saveExam(r.attemptId, r.token, a, r.session); sync(res); return res }
  r.submit = async a => { backup(a); const res = await submitExam(r.attemptId, r.token, a, r.session); sync(res.attempt); return res }
  return r
}

// The welcome page of the exam site (/exam with no test in the link): shown first, once per browser session.
function CbtWelcome({ inst, onStart, onPractice }) {
  const [counts, setCounts] = useState(null)
  const load = () => listPublicTests().then(r => { const sp = splitPublicTests(r); setCounts({ open: sp.open.length, upcoming: sp.upcoming.length, next: sp.upcoming[0] || null }) })
  useEffect(() => { let live = true; listPublicTests().then(r => { if (live) { const sp = splitPublicTests(r); setCounts({ open: sp.open.length, upcoming: sp.upcoming.length, next: sp.upcoming[0] || null }) } }); return () => { live = false } }, [])
  const feats = [['📱', 'Any phone or computer', 'Take your test wherever you are.'], ['💾', 'Answers save automatically', 'If the connection drops, carry on where you left.'], ['🎯', 'Practice first', 'Try a short practice test — nothing is counted.'], ['📚', 'Practise past exams', 'Retake closed exams any time, with the answers.']]
  const steps = ['Pick your test, or paste the link your teacher sent.', 'Enter the access code, your GCC no. and the parent / guardian number.', 'Take the exam. Your result appears when the institute releases it.']
  return (
    <div className="cbt-welcome">
      <i className="cbt-welcome-ring r1" aria-hidden="true" /><i className="cbt-welcome-ring r2" aria-hidden="true" />
      <a className="cbt-home" href="/" aria-label="Back to the GNSI website home">‹ Back to home</a>
      <div className="cbt-welcome-crest"><img src="/gnsi-mark.webp" alt="GNSI" width="86" height="88" onError={e => { e.currentTarget.style.display = 'none' }} /></div>
      <div className="cbt-welcome-inst">{(inst.name || 'Guidance Navodaya & Sainik Institute').toUpperCase()}</div>
      <h1>Welcome to <span>Online Exams</span></h1>
      <div className="cbt-welcome-rule" aria-hidden="true"><span /><b /><span /></div>
      <p className="cbt-welcome-lead">Computer-based tests for Navodaya, Sainik School and RMS aspirants — in the same format as the real exam.</p>
      {counts && counts.next && counts.next.opensAt && <div className="cbt-welcome-next">
        <small>Next test opens in</small>
        <CbtCountdown to={counts.next.opensAt} className="cbt-cd cbt-cd-lg" onDone={load} />
        <b>{counts.next.name}</b>
        <span>{when(counts.next.opensAt)}{counts.next.durationMin ? ` · ${counts.next.durationMin} min` : ''}{counts.next.questions ? ` · ${counts.next.questions} questions` : ''}</span>
      </div>}
      {counts && (counts.open > 0 || counts.upcoming > 0) && <div className="cbt-welcome-live">
        {counts.open > 0 && <span><i aria-hidden="true" />{counts.open} test{counts.open === 1 ? '' : 's'} open now</span>}
        {counts.upcoming > 0 && <span className="up">{counts.upcoming} upcoming</span>}
      </div>}
      <div className="cbt-welcome-cta">
        <button type="button" className="cbt-welcome-go" onClick={onStart}><span>Find my exam</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
        <button type="button" className="cbt-welcome-alt" onClick={onPractice}>Try the practice test</button>
      </div>
      <div className="cbt-welcome-feats">{feats.map(([ic, t, d]) => <div key={t}><span aria-hidden="true">{ic}</span><b>{t}</b><small>{d}</small></div>)}</div>
      <div className="cbt-welcome-steps"><h2>How it works</h2><ol>{steps.map((t, i) => <li key={i}><i>{i + 1}</i><span>{t}</span></li>)}</ol></div>
      <p className="cbt-welcome-foot">Need help? Ask your teacher or call the institute.</p>
    </div>
  )
}

// Trend of the latest tests: the best score and the average, test by test (percent).
function TrendChart({ points }) {
  if (points.length < 2) return null
  const W = 320, H = 120, L = 30, R = 10, T = 12, B = 30
  const vals = points.flatMap(p => [p.topPercent, p.avgPercent]).filter(v => v != null)
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...vals) + 5) / 10) * 10)
  const x = i => L + (i * (W - L - R)) / (points.length - 1), y = v => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B)
  const line = key => points.map((p, i) => (p[key] == null ? null : `${x(i)},${y(p[key])}`)).filter(Boolean).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend of the top score and the average across the latest tests" style={{ width: '100%', maxWidth: 460, display: 'block' }}>
      {[lo, (lo + hi) / 2, hi].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e3e8f2" /><text x={L - 4} y={y(v) + 3} fontSize="8" textAnchor="end" fill="#64748b">{Math.round(v)}%</text></g>)}
      <polyline points={line('avgPercent')} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" />
      <polyline points={line('topPercent')} fill="none" stroke="#b8913f" strokeWidth="2.5" />
      {points.map((p, i) => <g key={p.id}>
        {p.topPercent != null && <circle cx={x(i)} cy={y(p.topPercent)} r="3.5" fill="#b8913f" />}
        <text x={x(i)} y={H - 16} fontSize="8" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fill="#334155">{p.name.length > 11 ? `${p.name.slice(0, 10)}…` : p.name}</text>
        {p.topPercent != null && <text x={x(i)} y={y(p.topPercent) - 7} fontSize="8.5" fontWeight="700" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fill="#7a5a14">{p.topPercent}%</text>}
      </g>)}
    </svg>
  )
}

// One test's published top 5: overall, or the top of a class.
function Top5Card({ item }) {
  const t = item.top5 || {}
  const tabs = [{ key: 'all', label: 'Overall', list: t.overall || [] }, ...(t.byClass || []).map(c => ({ key: c.key, label: c.label, list: c.list || [] }))]
  const [tab, setTab] = useState('all')
  const cur = tabs.find(x => x.key === tab) || tabs[0]
  const medal = ['🥇', '🥈', '🥉']
  return (
    <div className="card" style={{ borderLeft: '4px solid #b8913f' }}>
      <h3 style={{ margin: '0 0 2px' }}>{item.name}</h3>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{t.stats?.appeared ? `${t.stats.appeared} appeared · ` : ''}{t.stats?.avgPercent != null ? `average ${t.stats.avgPercent}%` : ''}</div>
      {tabs.length > 1 && <div className="cbt-filters" role="group" aria-label="Class">{tabs.map(x => <button key={x.key} type="button" className={`cbt-fchip${tab === x.key ? ' on' : ''}`} aria-pressed={tab === x.key} onClick={() => setTab(x.key)}>{x.label}</button>)}</div>}
      {cur.list.map(r => (
        <div key={`${r.rank}${r.name}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid #eef1f6' }}>
          <span style={{ width: 28, textAlign: 'center', fontSize: 20, fontWeight: 800 }}>{medal[r.rank - 1] || r.rank}</span>
          <div style={{ flex: 1, minWidth: 0 }}><b>{r.name}</b>{tab === 'all' && r.cls ? <div className="muted" style={{ fontSize: 12.5 }}>{r.cls}</div> : null}</div>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><b>{r.marks}</b><span className="muted"> / {r.max}</span>{r.percent != null && <div className="muted" style={{ fontSize: 12.5 }}>{r.percent}%</div>}</div>
        </div>
      ))}
    </div>
  )
}

// Opened as /exam with no test in the link (e.g. from the website menu): ask for the Test ID or the full link, and
// offer to continue an exam that was started on this device.
// If staff added this past exam as a static mock (public/mocks/, entry testId = the exam id), practise from that file: the CDN serves it, so any number of students can practise with no database call.
async function staticPractice(id) {
  const read = async url => { try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? r : null } catch { return null } }
  try {
    const base = import.meta.env.BASE_URL
    // copies staff published from the admin screen (public storage bucket) come first, then ones committed to the site (public/mocks/)
    const sources = [[await listPracticeCopies(), slug => practiceCopyUrl(slug)], [await (await read(`${base}mocks/index.json`))?.json?.().catch(() => []) || [], slug => mockPath(slug, base)]]
    for (const [idx, urlOf] of sources) {
      const m = Array.isArray(idx) && idx.find(x => x && x.testId === id && MOCK_SLUG.test(String(x.slug)))
      if (!m) continue
      const r = await read(urlOf(m.slug))
      if (!r) continue
      const t = parseMock(await r.json())
      // practice, like the database copy: no camera / full-screen rules, no minimum time, calculator and rough work on
      return { ...t, name: `${t.name} — practice`, instructions: `PRACTICE — this is a past exam. Nothing you do here is recorded or counted.\n\n${t.instructions || ''}`.trim(),
        marking: { ...(t.marking || {}), minMinutes: 0, proctor: { camera: 'off', shield: false, fullscreen: 'off' }, tools: { calc: true, rough: true, ...((t.marking || {}).tools || {}) } }, showResult: true, showAnswers: true }
    }
    return null
  } catch { return null }
}

function CbtFinder({ onPractice, onPracticePast, busyId }) {
  const [raw, setRaw] = useState('')
  const [msg, setMsg] = useState('')
  const [tests, setTests] = useState(null)   // tests open now (or starting soon) that the institute has listed; null while loading
  useEffect(() => { let live = true; listPublicTests().then(r => { if (live) setTests(r) }); return () => { live = false } }, [])
  const [past, setPast] = useState([])       // closed exams that may be practised
  const [filter, setFilter] = useState('all')   // all | open | upcoming | practice
  const [top, setTop] = useState([])         // published top-5 boards, newest first
  const [mocks, setMocks] = useState([])     // static mock tests (public/mocks/index.json): run on the student's device, no database
  useEffect(() => { let live = true; fetch(`${import.meta.env.BASE_URL}mocks/index.json`, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).then(r => { if (live && Array.isArray(r)) setMocks(r.filter(m => m && MOCK_SLUG.test(String(m.slug)))) }).catch(() => {}); return () => { live = false } }, [])
  const [topMore, setTopMore] = useState(false)
  useEffect(() => { let live = true; listTop5().then(r => { if (live) setTop(r) }); return () => { live = false } }, [])
  useEffect(() => { let live = true; listPracticeTests().then(r => { if (live) setPast(r) }); return () => { live = false } }, [])
  const scan = () => {
    const out = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('gnsi-cbt-remote:')) { const v = read(k); if (v && v.attemptId) out.push({ id: k.slice('gnsi-cbt-remote:'.length), name: v.name || '' }) }
      }
    } catch { /* storage blocked */ }
    return out
  }
  const [started, setStarted] = useState(scan)
  // "Not me / start fresh": forget the exam saved on this device (and its offline backup) so a new candidate can begin.
  // The attempt itself stays on the server; the candidate can still look themselves up with the access code + GCC no.
  const forget = x => {
    if (!window.confirm(`Remove ${x.name || 'this exam'} from this device?\n\nUse this when a different candidate will take the exam on this phone. Answers already saved on the server are kept.`)) return
    try { localStorage.removeItem(savedKey(x.id)); localStorage.removeItem(backupKey(x.id)) } catch { /* storage blocked */ }
    setStarted(scan())
  }
  const go = e => {
    e.preventDefault()
    const ref = parseExamRef(raw)
    if (!ref) { setMsg('Paste the exam link or type the Test ID your teacher gave you.'); return }
    window.location.href = examHref(ref)
  }
  const split = splitPublicTests(tests)
  const detected = parseExamRef(raw)
  const show = showBlocks(filter)
  return (
    <>
      {started.length > 0 && <div className="card" style={{ borderLeft: '4px solid #1f4e8c' }}>
        <b>Continue your exam</b>
        <div className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>An exam was started on this device. Open it to carry on — your answers are saved.</div>
        {started.map(x => (
          <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <a className="btn navy" style={{ display: 'inline-block', textDecoration: 'none' }} href={examHref({ id: x.id })}>Continue{x.name ? ` as ${x.name}` : ''} →</a>
            <button type="button" className="btn" onClick={() => forget(x)} aria-label={`Not ${x.name || 'me'} — start fresh`}>Not me · start fresh</button>
          </div>
        ))}
      </div>}
      <div className="cbt-filters" role="group" aria-label="Show">
        {FINDER_FILTERS.filter(([id]) => id !== 'top' || top.length > 0).map(([id, label]) => {
          const n = id === 'open' ? split.open.length : id === 'upcoming' ? split.upcoming.length : id === 'practice' ? past.length + (onPractice ? 1 : 0) : id === 'top' ? top.length : split.open.length + split.upcoming.length + past.length + top.length
          return <button key={id} type="button" className={`cbt-fchip${filter === id ? ' on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}<i>{n}</i></button>
        })}
      </div>
      {show.open && split.open.length > 0 && <div className="card" style={{ borderLeft: '4px solid #b42318' }}>
        <h3 style={{ margin: '0 0 4px' }}>Tests open now</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Choose your test. You will need the access code your teacher gave you and your GCC no.</div>
        {split.open.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eef1f6' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <b>{t.name}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{t.questions ? `${t.questions} questions · ` : ''}{t.durationMin} min{t.closesAt ? ` · closes ${when(t.closesAt)}` : ''}</div>
            </div>
            <a className="btn gold" style={{ textDecoration: 'none' }} href={examHref({ id: t.id })}>Start →</a>
          </div>
        ))}
      </div>}
      {show.upcoming && split.upcoming.length > 0 && <div className="card" style={{ borderLeft: '4px solid #9a5b00' }}>
        <h3 style={{ margin: '0 0 4px' }}>Upcoming tests</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>The test series that is coming up. Each one opens at the time shown.</div>
        {split.upcoming.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eef1f6' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <b>{t.name}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{t.questions ? `${t.questions} questions · ` : ''}{t.durationMin} min</div>
              {t.opensAt && <div style={{ marginTop: 4 }}><span style={{ fontSize: 12.5, color: '#9a5b00', fontWeight: 700 }}>Opens {when(t.opensAt)} · </span><CbtCountdown to={t.opensAt} className="cbt-cd cbt-cd-sm" onDone={() => listPublicTests().then(setTests)} /></div>}
            </div>
            <a className="btn navy" style={{ textDecoration: 'none' }} href={examHref({ id: t.id })}>View →</a>
          </div>
        ))}
      </div>}
      {filter === 'all' && tests !== null && !split.open.length && !split.upcoming.length && !top.length && !past.length && <div className="card" style={{ borderLeft: '4px solid #9a5b00' }}><b>No test is listed on this page right now.</b><div className="muted" style={{ marginTop: 4 }}>If your teacher sent you an invitation message or an exam link, paste it in the box below — the exam and the access code are picked out for you. You can also try the practice test.</div></div>}
      {(filter === 'open' && !split.open.length) && <div className="card muted">No test is open right now. Check <button type="button" className="cbt-link" onClick={() => setFilter('upcoming')}>Upcoming</button> or try <button type="button" className="cbt-link" onClick={() => setFilter('practice')}>Practice</button>.</div>}
      {(filter === 'top' && !top.length) && <div className="card muted">No top-5 board has been published yet.</div>}
      {(filter === 'upcoming' && !split.upcoming.length) && <div className="card muted">No upcoming test has been announced yet. Check back soon, or try <button type="button" className="cbt-link" onClick={() => setFilter('practice')}>Practice</button>.</div>}
      {show.top && top.length > 0 && <>
        {(() => { const tr = trendOf(top); return tr.points.length >= 2 && <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>📈 Trend — how the toppers are doing</h3>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>Best score <span style={{ color: '#b8913f', fontWeight: 800 }}>━</span> and average <span style={{ color: '#94a3b8', fontWeight: 800 }}>┅</span> in the latest tests.{tr.direction && tr.direction !== 'flat' ? ` The top score ${tr.direction === 'up' ? 'rose' : 'fell'} by ${Math.abs(tr.change)}% in the latest test.` : ''}</div>
          <TrendChart points={tr.points} />
        </div> })()}
        {(topMore ? top : top.slice(0, 2)).map(i => <Top5Card key={i.id} item={i} />)}
        {top.length > 2 && !topMore && <button type="button" className="btn" onClick={() => setTopMore(true)}>Show earlier tests ({top.length - 2})</button>}
      </>}
      {show.practice && mocks.filter(m => !past.some(t => t.id === m.testId)).length > 0 && <div className="card" style={{ borderLeft: '4px solid #146c3a' }}>
        <h3 style={{ margin: '0 0 4px' }}>Mock tests</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Full mock papers that run on your own phone or computer. Your score appears at the end; nothing is recorded or counted.</div>
        {mocks.filter(m => !past.some(t => t.id === m.testId)).map(m => (
          <div key={m.slug} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eef1f6' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}><b>{m.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{m.questions ? `${m.questions} questions · ` : ''}{m.durationMin} min</div></div>
            <a className="btn navy" href={`/exam?mock=${encodeURIComponent(m.slug)}`}>Start →</a>
          </div>
        ))}
      </div>}
      {show.practice && past.length > 0 && onPracticePast && <div className="card" style={{ borderLeft: '4px solid #1f4e8c' }}>
        <h3 style={{ margin: '0 0 4px' }}>Practise past exams</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>These exams have closed. Take them again in practice mode — nothing is recorded or counted, and your score and the answers appear at the end.</div>
        {rankPractice(past).map(t => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', padding: '10px 8px', borderTop: '1px solid #eef1f6', ...(t.latest ? { background: '#fffaf0', borderRadius: 10, border: '1px solid #f0dcaa' } : {}) }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <b>{t.name}</b>
                {t.latest && <span className="tag" style={{ background: '#c8962b', color: '#fff', fontWeight: 800, letterSpacing: .4 }}>LATEST</span>}
                {t.isNew && <span className="tag" style={{ background: '#e7f6ec', color: '#146c3a', fontWeight: 800 }}>NEW</span>}
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>{t.questions ? `${t.questions} questions · ` : ''}{t.durationMin} min{t.closedAt ? ` · closed ${when(t.closedAt)}` : ''}{t.ago ? <b style={{ color: t.isNew ? '#146c3a' : undefined }}> · {t.ago}</b> : ''}</div>
            </div>
            <button type="button" className="btn navy" disabled={!!busyId} onClick={() => onPracticePast(t.id)}>{busyId === t.id ? 'Opening…' : 'Practise →'}</button>
          </div>
        ))}
      </div>}
      {show.practice && onPractice && <div className="card" style={{ background: '#f8fafc' }}><b>New to computer-based tests?</b> <span className="muted">Try the 4-minute practice test — it is not counted and nothing is saved. Works any time, even after an exam has closed.</span><div style={{ marginTop: 8 }}><button className="btn" type="button" onClick={onPractice}>Try the practice test</button></div></div>}
      <form className="card" onSubmit={go}>
        <h3 style={{ margin: '0 0 6px' }}>Open your exam</h3>
        <p className="muted" style={{ margin: '0 0 10px' }}>Paste the whole invitation message your teacher sent (or just the exam link or Test ID). The exam and the access code are picked out for you.</p>
        <label><span className="lbl">Exam link or Test ID</span><input className="in" value={raw} onChange={e => { setRaw(e.target.value); setMsg('') }} onPaste={e => { const ref = parseExamRef(e.clipboardData?.getData('text') || ''); if (ref) { e.preventDefault(); window.location.href = examHref(ref) } }} placeholder="Paste the invitation, exam link or Test ID" autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
        {detected && <p style={{ color: '#146c3a', fontWeight: 700, margin: '8px 0 0' }}>✓ Exam found{detected.code ? ' · access code detected' : ''} — press Open exam.</p>}
        {msg && <p role="alert" style={{ color: '#b42318', fontWeight: 700, margin: '8px 0 0' }}>{msg}</p>}
        <div style={{ marginTop: 12 }}><button className="btn navy" type="submit">Open exam →</button></div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Do not have a link yet? Ask your teacher, or call the institute — tests are opened for each batch.</p>
      </form>
    </>
  )
}

function CbtPublicInner() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const testId = params.get('t') || ''
  const mockSlug = MOCK_SLUG.test(params.get('mock') || '') ? params.get('mock') : ''
  const [mock, setMock] = useState(null)       // the loaded static mock test (runs here, nothing sent anywhere)
  const [mockErr, setMockErr] = useState('')
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ gcc: '', parent: '', code: params.get('c') || '', gname: '', gphone: '', gdistrict: '', ggender: '', gcaste: '' })
  const [saved] = useState(() => read(savedKey(testId)))
  const [phase, setPhase] = useState('landing')     // landing | gate | exam | result | done
  const [run, setRun] = useState(null)              // { test, remote, candidate, resume }
  const [view, setView] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('find')     // find (access code + GCC no.) | verify (contact number)
  const [guestMode, setGuestMode] = useState(false)   // a candidate who is not in the institute records (only when the test allows guests)
  const [codeNote, setCodeNote] = useState('')
  const [stu, setStu] = useState(null)             // the ERP student found for the GCC no.: { gcc, hasPhone } | { none: true } | null
  const inst = getInstitute()
  const [welcomed, setWelcomed] = useState(() => { try { return sessionStorage.getItem('gnsi_cbt_welcome') === '1' } catch { return false } })
  const enter = () => { try { sessionStorage.setItem('gnsi_cbt_welcome', '1') } catch { /* storage blocked */ } setWelcomed(true); window.scrollTo?.(0, 0) }

  // the admin chose to share the current access code: fill it in (it replaces a stale code from an old link or invitation)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fills the field once the exam details arrive
    if (info && info.code) { setForm(f => (f.code === info.code ? f : { ...f, code: info.code })); setCodeNote('✓ Latest access code filled in automatically.') }
  }, [info])
  useEffect(() => {
    let live = true
    if (!mockSlug) return undefined
    fetch(mockPath(mockSlug, import.meta.env.BASE_URL), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('This mock test was not found. Check the link.'); return r.json() })
      .then(j => { if (live) setMock(parseMock(j)) }).catch(e => { if (live) setMockErr(e instanceof SyntaxError ? 'This mock test could not be read.' : e.message || 'This mock test could not be loaded.') })
    return () => { live = false }
  }, [mockSlug])
  useEffect(() => {
    let live = true
    if (!testId) return undefined                    // no test in the link: the finder below asks for it
    examInfo(testId).then(i => { if (live) setInfo(i) }).catch(e => { if (live) setErr(friendly(e)) })
    return () => { live = false }
  }, [testId])

  // GCC detector: type the access code and the GCC no.; the student is found in the ERP (exact GCC match) and the
  // full name appears. The parent number is then checked against the ERP record before the exam can begin.
  useEffect(() => {
    if (!form.gcc.trim() || !form.code.trim() || !testId) return
    let live = true
    const t = setTimeout(async () => {
      try { const r = await lookupStudent(testId, form.code, form.gcc); if (live) { setStu(r.length ? r[0] : { none: true }); setErr('') } } catch (e) { if (live) { setStu(null); setErr(friendly(e)) } }
    }, 700)
    return () => { live = false; clearTimeout(t) }
  }, [form.gcc, form.code, testId])
  const type = k => e => {
    const v = k === 'gcc' ? e.target.value.replace(/\D/g, '') : k === 'parent' || k === 'gphone' ? e.target.value.replace(/[^\d+\s-]/g, '') : e.target.value
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'gcc' || k === 'code') setStu(null)
  }
  const total = info ? info.sections.reduce((s, x) => s + x.count, 0) : 0

  const toVerify = () => {
    setErr('')
    if (!form.code.trim()) return setErr('Enter the access code you were given.')
    if (!stu || stu.none) return setErr('Enter a valid GCC no.')
    if (!stu.hasPhone) return setErr('No parent / guardian number is on file for this GCC no. Ask the office to add it.')
    setStep('verify')
  }

  const proceed = async () => {
    setErr('')
    const par = form.parent.replace(/\D/g, '')
    if (par.length < 10) return setErr('Enter the 10-digit parent / guardian contact number.')
    setBusy(true)
    try {
      const r = await lookupStudent(testId, form.code, form.gcc, par)
      if (!r.length || r[0].verified !== true) { setBusy(false); return setErr('The number does not match the institute records.') }
      const v = r[0]
      const candidate = { name: v.name, roll: String(Number(v.gcc) || v.gcc) }
      setRun({ test: infoTest(info), candidate, remote: makeRemote({ testId, code: form.code, candidate, gcc: v.gcc, parent: par }), resume: null })
      setPhase('gate')
    } catch (e) { setErr(friendly(e)) }
    setBusy(false)
  }

  const startAsGuest = () => {
    setErr('')
    if (!form.code.trim()) return setErr('Enter the access code you were given.')
    if (form.gname.trim().length < 2) return setErr('Enter your full name.')
    const ph = form.gphone.replace(/\D/g, '')
    if (ph.length < 10) return setErr('Enter your 10-digit mobile number.')
    if (!form.gdistrict || !form.ggender || !form.gcaste) return setErr('Choose your district, gender and category.')
    const candidate = { name: form.gname.trim(), roll: 'G' + ph.slice(-10) }
    setRun({ test: infoTest(info), candidate, remote: makeRemote({ testId, code: form.code, candidate, guest: { name: form.gname.trim(), phone: ph, district: form.gdistrict, gender: form.ggender, caste: form.gcaste } }), resume: null })
    setPhase('gate')
  }

  const resume = async () => {
    setBusy(true); setErr('')
    try {
      const res = await resumeExam(saved.attemptId, saved.token, saved.session)
      const candidate = { name: saved.name, roll: saved.roll }
      if (res.result) { setView(resultView(res.result, infoTest(info), candidate)); setPhase('result') } else {
        const remote = makeRemote({ testId, candidate, attemptId: saved.attemptId, token: saved.token, session: res.session })
        write(savedKey(testId), { ...saved, session: res.session })
        remote.offset = Date.parse(res.attempt.serverNow) - Date.now()
        setRun({ test: res.test, candidate, remote, resume: localAttempt(res.attempt, res.test, candidate, read(backupKey(saved.attemptId))) })
        setPhase('exam')
      }
    } catch (e) { setErr(friendly(e)) }
    setBusy(false)
  }

  const submitted = (res, test, cur) => { setView(resultView(res, test, run.candidate, cur)); setPhase('result') }
  // practice test: runs in this browser only; its result is the local attempt itself
  const startDemo = () => { setErr(''); setRun({ test: DEMO_TEST, candidate: { name: 'Practice', roll: 'DEMO' }, remote: null, resume: null, demo: true }); setPhase('gate') }
  const startMock = () => { setErr(''); setRun({ test: mock, candidate: { name: 'Mock test', roll: 'MOCK' }, remote: null, resume: null, demo: true }); setPhase('gate') }
  const demoDone = done => { setView({ test: run?.test || DEMO_TEST, attempt: done }); setPhase('result') }
  // practise a PAST exam: its real paper and key are fetched (only allowed once it is closed and its answers are out); marking happens here, nothing is saved
  const [practiceBusy, setPracticeBusy] = useState('')
  const startPractice = async id => {
    setErr(''); setPracticeBusy(id)
    try {
      const test = (await staticPractice(id)) || (await practiceTest(id))   // a CDN copy (no database) when staff added one, else the database copy
      setRun({ test, candidate: { name: 'Practice', roll: 'PRACTICE' }, remote: null, resume: null, demo: true }); setPhase('gate')
    } catch (e) { setErr(friendly(e)) }
    setPracticeBusy('')
  }

  if (phase === 'gate' || phase === 'exam') {
    return <CbtPlayer test={run.test} candidate={run.candidate} resume={run.resume} remote={run.remote} demo={!!run.demo} onSubmit={run.demo ? demoDone : submitted} onClose={() => { setPhase('landing'); setRun(null) }} />
  }
  if (phase === 'result' && view) {
    return <CbtResult test={view.test} attempt={view.attempt} closeLabel={run?.demo ? 'Back to the exam page' : 'Finish'} onClose={() => { if (run?.demo) { setRun(null); setView(null); setPhase('landing') } else setPhase('done') }} />
  }
  if (phase === 'done') {
    return (
      <div className="cbt cbt-page" style={{ maxWidth: 560 }}><style>{CBT_CSS}</style>
        <div className="card" style={{ textAlign: 'center', marginTop: 40 }}><h3>Thank you</h3><p className="muted">Your exam is complete. You can close this window.</p><a className="btn navy" style={{ textDecoration: 'none', display: 'inline-block' }} href="/">‹ Back to home</a></div>
      </div>
    )
  }

  const open = info?.state === 'open'
  // the access-code field (used by the student form and the guest form): paste the invitation, or use the Paste button, and the code is picked out
  const codeField = (
    <label><span className="lbl">Access code *</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <input className="in" autoComplete="one-time-code" autoCapitalize="off" spellCheck={false} value={form.code} onChange={e => { type('code')(e); setCodeNote('') }}
                      onPaste={e => { const t = e.clipboardData?.getData('text') || ''; const c = extractCode(t) || (/^[A-Za-z0-9]{4,20}$/.test(t.trim()) ? t.trim() : null); if (c) { e.preventDefault(); setForm(f => ({ ...f, code: c })); setStu(null); setCodeNote('✓ Access code detected from what you pasted.') } }} />
                    <button type="button" className="btn" title="Paste the access code from your clipboard" onClick={async () => { try { const t = await navigator.clipboard.readText(); const c = extractCode(t) || (/^[A-Za-z0-9]{4,20}$/.test((t || '').trim()) ? t.trim() : null); if (c) { setForm(f => ({ ...f, code: c })); setStu(null); setCodeNote('✓ Access code detected from your clipboard.') } else setCodeNote('No access code found in your clipboard. Copy the invitation message, then try again.') } catch { setCodeNote('Your browser did not allow clipboard access — paste into the box instead.') } }}>📋 Paste</button>
                  </span>
                  {(codeNote || params.get('c')) && <small style={{ color: codeNote.startsWith('✓') || (!codeNote && params.get('c')) ? '#146c3a' : '#9a5b00', fontWeight: 700 }}>{codeNote || '✓ Access code filled in from your link.'}</small>}
                  {!codeNote && !params.get('c') && <small className="muted">Tip: paste the whole invitation message and the code is picked out for you.</small>}
                </label>
  )
  if (!testId && !mockSlug && !welcomed) {
    return (
      <div className="cbt cbt-page" style={{ maxWidth: 720 }}>
        <style>{CBT_CSS}</style>
        <CbtWelcome inst={inst} onStart={enter} onPractice={() => { enter(); startDemo() }} />
      </div>
    )
  }
  return (
    <div className="cbt cbt-page" style={{ maxWidth: 720 }}>
      <style>{CBT_CSS}</style>
      <div className="cbt-hero">
        <a className="cbt-home" href="/" aria-label="Back to the GNSI website home">‹ Back to home</a>
        <div className="eyebrow">{(inst.name || 'GNSI').toUpperCase()} · ONLINE EXAM</div>
        <h2>{info ? info.name : mock ? mock.name : 'Online exam'}</h2>
        {info && <p>{total} questions · {info.durationMin} minutes · {info.marking.correct} mark{info.marking.correct === 1 ? '' : 's'} each{info.marking.wrong ? `, −${info.marking.wrong} for a wrong answer` : ', no negative marking'}</p>}
      </div>
      {mockSlug && <div className="card" style={{ borderLeft: '4px solid #146c3a' }}>
        {mockErr ? <div role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{mockErr}</div> : !mock ? <div className="muted">Loading the mock test…</div> : <>
          <h3 style={{ margin: '0 0 4px' }}>{mock.name}</h3>
          <div className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>{mock.sections.reduce((n, x) => n + x.questions.length, 0)} questions · {mock.durationMin} minutes. This mock runs on your own device — your score and the answers appear at the end, and nothing is recorded or counted. Do not refresh or close the page while you write — progress on a mock is not saved.</div>
          <button type="button" className="btn gold" onClick={startMock}>▶ Start the mock test</button>
        </>}
        <div style={{ marginTop: 10 }}><a className="cbt-link" href="/exam">See other tests</a></div>
      </div>}
      {!testId && !mockSlug && <CbtFinder onPractice={startDemo} onPracticePast={startPractice} busyId={practiceBusy} />}
      {testId && !info && !err && <div className="card muted">Loading…</div>}
      {info && (!saved || !open) && <div className="card" style={{ background: '#f8fafc' }}><b>New to computer-based tests?</b> <span className="muted">{open ? 'Try a 4-minute practice test first — it is not counted and nothing is saved.' : 'You can still try the 4-minute practice test any time — it is not counted and nothing is saved.'}</span> <button className="btn" style={{ marginLeft: 6 }} onClick={startDemo}>Try the practice test</button></div>}
      {err && !(info && open && !saved) && <div className="card" role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{err}</div>}
      {info && info.state === 'closed' && <div className="card"><div style={{ color: '#b42318', fontWeight: 700 }}>This exam is closed.</div><div className="muted" style={{ margin: '6px 0 8px' }}>You can still practise it: take the same paper again in practice mode — nothing is recorded or counted.</div><button type="button" className="btn navy" disabled={!!practiceBusy} onClick={() => startPractice(testId)}>{practiceBusy ? 'Opening…' : 'Practise this exam →'}</button></div>}
      {info && info.state === 'not_open' && <div className="card" style={{ color: '#9a5b00', fontWeight: 700, textAlign: 'center' }}>This exam opens on {when(info.opensAt)}.{info.opensAt && <div style={{ marginTop: 10 }}><CbtCountdown to={info.opensAt} onDone={() => window.location.reload()} /></div>}</div>}
      {info && saved && (
        <div className="card" style={{ borderColor: '#bfe3c7', background: '#f1faf3' }}>
          <h3>Continue your exam</h3>
          <p className="muted">You started this exam on this device as <b>{saved.name}</b> ({saved.roll}). Your answers were saved as you went.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn gold" onClick={resume} disabled={busy}>{busy ? 'Opening…' : 'Continue / see my result'}</button>
            <button className="btn" type="button" disabled={busy} onClick={() => {
              if (!window.confirm(`Start fresh on this device?\n\nThis removes ${saved.name || 'the saved exam'} from this phone so someone else can begin. Answers already saved on the server are kept.`)) return
              try { localStorage.removeItem(savedKey(testId)); localStorage.removeItem(backupKey(testId)) } catch { /* storage blocked */ }
              window.location.reload()
            }}>Not me · start fresh</button>
          </div>
        </div>
      )}
      {info && open && !saved && info.guests && guestMode && (
        <div className="card">
          <h3 style={{ marginBottom: 2 }}>Guest candidate</h3>
          <p className="muted" style={{ margin: '0 0 10px' }}>For candidates who are not students of the institute. You get one attempt per mobile number.</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
            {codeField}
            <label><span className="lbl">Full name *</span><input className="in" autoComplete="off" value={form.gname} onChange={type('gname')} /></label>
            <label><span className="lbl">Mobile number *</span><input className="in" inputMode="tel" autoComplete="off" placeholder="10-digit mobile" value={form.gphone} onChange={type('gphone')} /></label>
            <label><span className="lbl">District *</span><select className="in" value={form.gdistrict} onChange={type('gdistrict')}><option value="">Choose district…</option>{DISTRICT_OPTIONS.map(d => <option key={d}>{d}</option>)}</select></label>
            <label><span className="lbl">Gender *</span><select className="in" value={form.ggender} onChange={type('ggender')}><option value="">Choose…</option>{GENDERS.map(g => <option key={g}>{g}</option>)}</select></label>
            <label><span className="lbl">Category (caste) *</span><select className="in" value={form.gcaste} onChange={type('gcaste')}><option value="">Choose…</option>{CASTES.map(c => <option key={c}>{c}</option>)}</select></label>
          </div>
          {err && <p role="alert" style={{ margin: '10px 0 0', color: '#b42318', fontWeight: 700 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><button className="btn" onClick={() => { setErr(''); setGuestMode(false) }}>‹ I am a student</button><button className="btn gold" onClick={startAsGuest}>Continue ›</button></div>
        </div>
      )}
      {info && open && !saved && !guestMode && (
        <div className="card">
          {step === 'find' ? <>
            <h3 style={{ marginBottom: 2 }}>Your details</h3>
            <p className="muted" style={{ margin: '0 0 10px' }}>Step 1 of 2 — find yourself</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
              {codeField}
              <label><span className="lbl">GCC no. *</span><input className="in" inputMode="numeric" autoComplete="off" placeholder="your GCC number" value={form.gcc} onChange={type('gcc')} /></label>
            </div>
            {stu?.none && <p role="alert" style={{ margin: '8px 0', color: '#b42318', fontWeight: 700 }}>No student with this GCC no. was found. Check the number, or ask the office.</p>}
            {stu && !stu.none && stu.hasPhone && <p style={{ margin: '8px 0', color: '#1a7f37', fontWeight: 700 }}>✓ GCC no. found. Your name is shown after you verify the contact number.</p>}
            {stu && !stu.none && !stu.hasPhone && <p role="alert" style={{ margin: '8px 0', color: '#b42318', fontWeight: 700 }}>No parent / guardian number is on file for this GCC no., so you cannot start online. Please ask the office to add it.</p>}
            <ul className="muted" style={{ margin: '12px 0', paddingLeft: 18 }}>
              <li>Use a steady internet connection and keep this page open until you submit.</li>
              <li>The clock starts when you press “I am ready to begin”, and runs even if you close the page.</li>
              <li>You get one attempt. If the page closes, open this link again on the same device to continue.</li>
              <li>Leaving the exam screen is recorded.</li>
            </ul>
            {err && <p role="alert" style={{ margin: '0 0 10px', color: '#b42318', fontWeight: 700 }}>{err}</p>}
            <button className="btn gold" onClick={toVerify} disabled={!stu || !!stu.none || !stu.hasPhone}>Next: verify contact number ›</button>
            {info.guests && <p className="muted" style={{ margin: '12px 0 0' }}>Not a student of this institute? <button className="btn" onClick={() => { setErr(''); setGuestMode(true) }}>Take the exam as a guest</button></p>}
          </> : <>
            <h3 style={{ marginBottom: 2 }}>Verify your contact number</h3>
            <p className="muted" style={{ margin: '0 0 10px' }}>Step 2 of 2 — confirm it is really you</p>
            <label><span className="lbl">Parent / guardian contact no. *</span><input className="in" inputMode="tel" autoComplete="off" autoFocus placeholder="10-digit mobile" value={form.parent} onChange={type('parent')} /></label>
            <p className="muted" style={{ margin: '6px 0 12px' }}>Type the parent / guardian number given at admission (GCC {stu.gcc}).{stu.phoneHint ? <> Hint: it ends in <b>{stu.phoneHint.replace(/•/g, '')}</b>.</> : null}</p>
            {err && <p role="alert" style={{ margin: '0 0 10px', color: '#b42318', fontWeight: 700 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => { setErr(''); setStep('find') }} disabled={busy}>‹ Back</button>
              <button className="btn gold" onClick={proceed} disabled={busy}>{busy ? 'Checking…' : 'Verify and continue ›'}</button>
            </div>
          </>}
        </div>
      )}
    </div>
  )
}

export default function CbtPublic() {
  return <ResponsiveTables><CbtPublicInner /></ResponsiveTables>
}
