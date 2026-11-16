// MissionSainik.jsx — GNSI Portal · Management → Mission Sainik
// Tracks the question setting for "Mission Sainik 2027 – Search for Extra Ordinary":
// 20 Pre Mock Tests (6 sections × 25 questions each) plus the practice question bank.
// Who sets what, who verifies, deadlines, and progress: Pending → Submitted → Verified → Approved.
// Plan and deadlines: missionSainikData.js (Office Order GNSI/MS-2027/PMT/2026/01).
// Progress is stored in the `mission_sainik_tasks` table (migration 20261201_mission_sainik_tasks.sql).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { isAdminRole } from './roles'
import { PremiumStyles, PremiumHero, PremiumTabs, PremiumCard, PX, PIcon } from './premiumUI'
import {
  ORDER_NO, ORDER_DATE, SUBMISSION_DEADLINE, SUBJECTS, PANEL, TESTS, JNVST,
  buildSeedRows, fullName, STATUS_FLOW,
} from './missionSainikData'

const TABLE = 'mission_sainik_tasks'
const STATUS_STYLE = {
  Pending:   { fg: PX.warn,  bg: PX.warnBg },
  Submitted: { fg: '#1d4ed8', bg: '#e8f0fe' },
  Verified:  { fg: PX.gold,  bg: PX.goldBg },
  Approved:  { fg: PX.ok,    bg: PX.okBg },
  Overdue:   { fg: PX.bad,   bg: PX.badBg },
}

const todayISO = () => new Date().toLocaleDateString('en-CA')
const parse = iso => new Date(iso + 'T00:00:00')
const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)
const fmt = iso => parse(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = iso => parse(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const dayName = iso => parse(iso).toLocaleDateString('en-GB', { weekday: 'long' })
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 700)
  useEffect(() => {
    const f = () => setM(window.innerWidth < 700)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return m
}

function dueFor(task) {
  if (task.kind === 'practice') return SUBMISSION_DEADLINE
  return TESTS[task.test_no - 1]?.drafts || SUBMISSION_DEADLINE
}
const isOverdue = (task, today) => task.status === 'Pending' && today > dueFor(task)

function Chip({ status, overdue, small }) {
  const st = STATUS_STYLE[overdue ? 'Overdue' : status] || STATUS_STYLE.Pending
  return (
    <span style={{ display: 'inline-block', padding: small ? '2px 8px' : '3px 10px', borderRadius: 99, fontSize: small ? 10.5 : 11.5, fontWeight: 700, color: st.fg, background: st.bg, whiteSpace: 'nowrap' }}>
      {overdue ? 'Overdue' : status}
    </span>
  )
}

function Bar({ value, total, color = PX.gold }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ height: 8, borderRadius: 4, background: PX.line, overflow: 'hidden' }} role="img" aria-label={`${pct}% done`}>
      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 4 }} />
    </div>
  )
}

// Update dialog — a top-level component so typing is never lost when the screen behind it re-renders.
function TaskDialog({ sel, today, isAdmin, allowed, busy, onSave, onClose }) {
    const [remarks, setRemarks] = useState(sel.remarks || '')
    const [count, setCount] = useState(sel.question_count ?? '')
    const next = allowed
    const mayEdit = isAdmin || next.length > 0
    return (
      <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div role="dialog" aria-modal="true" aria-label="Update task" onClick={e => e.stopPropagation()}
          style={{ width: 'min(480px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 30px 60px -20px rgba(0,0,0,.5)' }}>
          <div style={{ fontFamily: PX.serif, fontSize: 21, fontWeight: 600, color: PX.navy }}>
            {sel.kind === 'test' ? `PMT-${String(sel.test_no).padStart(2, '0')} · ` : 'Practice · '}{sel.subject}
          </div>
          <div style={{ fontSize: 13, color: PX.sub, margin: '4px 0 12px' }}>
            Setter {fullName(sel.setter)}{sel.verifier ? ` · verifier ${fullName(sel.verifier)}` : ''} · due {fmt(dueFor(sel))}
            {sel.kind === 'test' && ` · test on ${fmtShort(TESTS[sel.test_no - 1].date)}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Chip status={sel.status} overdue={isOverdue(sel, today)} />
            {sel.submitted_on && <span style={{ fontSize: 12, color: PX.sub }}>submitted {fmtShort(sel.submitted_on)}</span>}
            {sel.verified_on && <span style={{ fontSize: 12, color: PX.sub }}>· verified {fmtShort(sel.verified_on)}</span>}
            {sel.approved_on && <span style={{ fontSize: 12, color: PX.sub }}>· approved {fmtShort(sel.approved_on)}</span>}
          </div>
          {mayEdit && (
            <>
              <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Questions
                <input className="px-input" type="number" min="0" value={count} onChange={e => setCount(e.target.value)} style={{ marginTop: 4 }} />
              </label>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub, marginTop: 10 }}>Remarks
                <textarea className="px-input" rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} style={{ marginTop: 4, resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {next.map(s => (
                  <button key={s} className={'px-btn' + (STATUS_FLOW.indexOf(s) > STATUS_FLOW.indexOf(sel.status) ? ' gold' : ' ghost')} disabled={busy}
                    onClick={async () => { if (await onSave(sel, { status: s, remarks, question_count: count === '' ? null : +count })) onClose() }}>
                    {STATUS_FLOW.indexOf(s) > STATUS_FLOW.indexOf(sel.status) ? `Mark ${s.toLowerCase()}` : `Move back to ${s.toLowerCase()}`}
                  </button>
                ))}
                <button className="px-btn" disabled={busy}
                  onClick={async () => { if (await onSave(sel, { remarks, question_count: count === '' ? null : +count })) onClose() }}>Save notes</button>
              </div>
            </>
          )}
          {!mayEdit && (
            <div style={{ fontSize: 13, color: PX.sub }}>
              {sel.remarks ? `Remarks: ${sel.remarks}` : 'Only the setter, the verifier or the Principal can update this task.'}
            </div>
          )}
          <div style={{ marginTop: 14, textAlign: 'right' }}><button className="px-btn ghost" onClick={() => onClose()}>Close</button></div>
        </div>
      </div>
    )
}

export default function MissionSainik({ currentUser, perms }) {
  const isMobile = useIsMobile()
  const isAdmin = isAdminRole(currentUser?.role)
  const canEdit = isAdmin || !!perms?.edit
  const [tab, setTab] = useState('overview')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [setup, setSetup] = useState(false) // table missing → migration not run yet
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(null)       // task open in the update dialog
  const [person, setPerson] = useState('')   // admin filter on "My tasks"
  const [filterTest, setFilterTest] = useState(0)
  const today = todayISO()

  const me = (currentUser?.name || '').toLowerCase()
  const isMe = name => !!name && me.includes(String(name).toLowerCase())

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from(TABLE).select('*').order('kind').order('test_no').order('id')
    if (error) {
      const text = `${error.code || ''} ${error.message || ''}`
      if (/42P01|PGRST205|does not exist|schema cache/i.test(text)) setSetup(true)
      else setMsg('Could not load: ' + error.message)
      setRows([])
    } else { setSetup(false); setRows(data || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 4500); return () => clearTimeout(t) }, [msg])

  const tests = useMemo(() => rows.filter(r => r.kind === 'test'), [rows])
  const practice = useMemo(() => rows.filter(r => r.kind === 'practice'), [rows])
  const byCell = useMemo(() => {
    const m = {}
    tests.forEach(r => { m[r.test_no + '|' + r.subject] = r })
    return m
  }, [tests])

  const total = rows.length
  const seedCount = buildSeedRows().length
  const submitted = rows.filter(r => r.status !== 'Pending').length
  const approved = rows.filter(r => r.status === 'Approved').length
  const overdue = rows.filter(r => isOverdue(r, today)).length
  const daysToDeadline = dayDiff(today, SUBMISSION_DEADLINE)
  const nextTest = TESTS.find(t => t.date >= today)

  // ── actions ────────────────────────────────────────────────────────────
  const allowedStatuses = task => {
    const s = task.status
    if (isAdmin) return STATUS_FLOW.filter(x => x !== s)
    if (!canEdit) return []
    const out = []
    if (isMe(task.setter)) { if (s === 'Pending') out.push('Submitted'); if (s === 'Submitted') out.push('Pending') }
    if (task.verifier && isMe(task.verifier)) { if (s === 'Submitted') out.push('Verified'); if (s === 'Verified') out.push('Submitted') }
    return out
  }

  const saveTask = async (task, patch) => {
    setBusy(true)
    const next = { ...patch, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }
    if (patch.status) {
      const keep = STATUS_FLOW.indexOf(patch.status)
      next.submitted_on = keep >= 1 ? (task.submitted_on || today) : null
      next.verified_on = keep >= 2 ? (task.verified_on || today) : null
      next.approved_on = keep >= 3 ? (task.approved_on || today) : null
    }
    const { error } = await supabase.from(TABLE).update(next).eq('id', task.id)
    setBusy(false)
    if (error) { setMsg('❌ ' + error.message); return false }
    setRows(rs => rs.map(r => (r.id === task.id ? { ...r, ...next } : r)))
    setSel(s => (s && s.id === task.id ? { ...s, ...next } : s))
    setMsg('✅ Saved')
    return true
  }

  const createAllotment = async () => {
    setBusy(true)
    const { error } = await supabase.from(TABLE).upsert(buildSeedRows(), { onConflict: 'kind,test_no,subject,setter', ignoreDuplicates: true })
    setBusy(false)
    if (error) { setMsg('❌ ' + error.message); return }
    setMsg('✅ Allotment created')
    load()
  }

  const exportCsv = () => {
    const head = ['Kind', 'Test', 'Subject', 'Setter', 'Verifier', 'Questions', 'Due', 'Status', 'Submitted on', 'Verified on', 'Approved on', 'Remarks']
    const lines = [head.join(',')].concat(rows.map(r => [
      r.kind, r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice', r.subject, fullName(r.setter), r.verifier ? fullName(r.verifier) : '',
      r.question_count ?? '', dueFor(r), r.status, r.submitted_on || '', r.verified_on || '', r.approved_on || '', r.remarks || '',
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')))
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'Mission_Sainik_2027_tasks.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const printNotice = () => {
    const rowsHtml = TESTS.map(t => `<tr><td><b>${t.id}</b></td><td>${esc(fmt(t.date))}</td><td>${esc(dayName(t.date))}</td><td>${esc(fmtShort(t.drafts))}</td><td>${esc(fmtShort(t.verify))}</td><td>${esc(fmtShort(t.print))}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Notice – Mission Sainik 2027</title>
<style>@page{size:A4;margin:14mm}body{font-family:'Times New Roman',serif;color:#111827;font-size:12.5px;line-height:1.45}
.lh{text-align:center;border-bottom:3px double #132a4f;padding-bottom:8px}.lh h1{margin:0;font-size:21px;color:#132a4f;letter-spacing:.5px}
.lh div{font-size:11.5px}.ref{display:flex;justify-content:space-between;font-weight:bold;margin:10px 0}
h2{text-align:center;text-decoration:underline;letter-spacing:3px;color:#132a4f;margin:8px 0 4px}
.sub{text-align:center;font-weight:bold;margin-bottom:10px}ol{padding-left:20px}li{margin-bottom:5px;text-align:justify}
table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px}th{background:#132a4f;color:#fff;text-align:left}
th,td{border:1px solid #7a8194;padding:3px 6px}.sig{margin-top:26px;text-align:right}</style></head><body>
<div class="lh"><h1>GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE (GNSI)</h1><div>Khangabok, Thoubal, Manipur · Established 2016</div><div><b>OFFICE OF THE PRINCIPAL</b></div></div>
<div class="ref"><span>No. ${esc(ORDER_NO)}</span><span>Date: ${esc(fmt(ORDER_DATE))}</span></div>
<h2>NOTICE</h2><div class="sub">Schedule of 20 Pre Mock Tests under Mission Sainik 2027 and submission of study material by Question Setters.</div>
<ol><li>The Institute shall conduct twenty (20) Pre Mock Tests, PMT-01 to PMT-20, on alternate days from ${esc(fmt(TESTS[0].date))} to ${esc(fmt(TESTS[19].date))}, in the latest AISSEE pattern. Each test has 150 questions for 300 marks, in six sections of 25 questions at 2 marks each.</li>
<li><b>All study material</b> (the question sections of all twenty tests and the practice question bank) shall be submitted at the office of the Head of the Institute <b>on or before ${esc(fmt(SUBMISSION_DEADLINE))}</b>. The material for PMT-01 and PMT-02 is due on ${esc(fmtShort(TESTS[0].drafts))} and ${esc(fmtShort(TESTS[1].drafts))}.</li>
<li>Every teacher on the Question Setting Panel sets questions and verifies a colleague's questions, never their own.</li>
<li>No test or deadline falls on 13 December, 27 December 2026 or 1 January 2027.</li>
<li>Any deviation requires the prior written approval of the Principal.</li></ol>
<table><thead><tr><th>Test</th><th>Date</th><th>Day</th><th>Drafts due</th><th>Verification</th><th>Final &amp; print</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<div class="sig"><b>(Moirangthem Himan Singh)</b><br>Founder &amp; Principal</div>
<script>window.onload=function(){window.print()}<\/script></body></html>`
    const w = window.open('', '_blank')
    if (!w) { setMsg('❌ Allow pop-ups to print the notice'); return }
    w.document.write(html); w.document.close()
  }

  // ── shared bits ────────────────────────────────────────────────────────
  const sectionStats = r => ({ done: r.filter(x => x.status !== 'Pending').length, ok: r.filter(x => x.status === 'Approved').length, n: r.length })
  const tabs = [
    { id: 'overview',   label: 'Overview',    icon: PIcon.chart },
    { id: 'schedule',   label: 'Schedule',    icon: PIcon.calendar },
    { id: 'allotment',  label: 'Allotment',   icon: PIcon.list },
    { id: 'mine',       label: isAdmin ? 'All tasks' : 'My tasks', icon: PIcon.pen, badge: isAdmin ? 0 : rows.filter(r => (isMe(r.setter) && r.status === 'Pending') || (isMe(r.verifier) && r.status === 'Submitted')).length },
    { id: 'practice',   label: 'Practice bank', icon: PIcon.folder },
    { id: 'panel',      label: 'Panel',       icon: PIcon.users },
  ]

  // ── screens ────────────────────────────────────────────────────────────
  const Overview = () => {
    const subjectStats = SUBJECTS.map(s => ({ s, ...sectionStats(tests.filter(r => r.subject === s.label)) }))
    return (
      <>
        <PremiumCard title="Deadline" subtitle="All study material at the Head of the Institute's office">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: PX.navy, color: PX.goldLt, borderRadius: 14, padding: '10px 16px', textAlign: 'center', minWidth: 84 }}>
              <div style={{ fontFamily: PX.serif, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{parse(SUBMISSION_DEADLINE).getDate()}</div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em' }}>NOV 2026</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: PX.serif, fontSize: 18, fontWeight: 600 }}>
                {daysToDeadline > 0 ? `${daysToDeadline} day${daysToDeadline > 1 ? 's' : ''} left` : daysToDeadline === 0 ? 'Due today' : `Passed ${-daysToDeadline} day${-daysToDeadline > 1 ? 's' : ''} ago`}
              </div>
              <div style={{ fontSize: 13, color: PX.sub, marginTop: 2 }}>PMT-01 is due {fmtShort(TESTS[0].drafts)} and PMT-02 {fmtShort(TESTS[1].drafts)}; everything else by {fmtShort(SUBMISSION_DEADLINE)}.</div>
              <div style={{ marginTop: 10 }}><Bar value={submitted} total={total} /></div>
              <div style={{ fontSize: 12, color: PX.sub, marginTop: 4 }}>{submitted} of {total} sections and sets submitted</div>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard title="Progress by subject" subtitle="Submitted · approved, out of 20 test sections" style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: '14px 28px' }}>
            {subjectStats.map(({ s, done, ok, n }) => (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                  <span>{s.label}</span><span style={{ color: PX.sub }}>{done}/{n || 20} · {ok} approved</span>
                </div>
                <Bar value={done} total={n || 20} />
              </div>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard title="All 20 tests" subtitle="Tap a test to see its sections" style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 4 : 10},minmax(0,1fr))`, gap: 8 }}>
            {TESTS.map(t => {
              const r = tests.filter(x => x.test_no === t.no)
              const st = sectionStats(r)
              const late = r.some(x => isOverdue(x, today))
              const full = r.length > 0 && st.ok === r.length
              const bg = late ? PX.badBg : full ? PX.okBg : st.done ? PX.goldBg : '#fff'
              const fg = late ? PX.bad : full ? PX.ok : st.done ? PX.gold : PX.sub
              return (
                <button key={t.no} type="button" onClick={() => { setFilterTest(t.no); setTab('allotment') }}
                  style={{ border: `1px solid ${PX.line2}`, background: bg, color: fg, borderRadius: 12, padding: '8px 4px', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontFamily: PX.serif, fontSize: 16, fontWeight: 700 }}>{String(t.no).padStart(2, '0')}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700 }}>{st.done}/{r.length || 6}</div>
                </button>
              )
            })}
          </div>
        </PremiumCard>

        {isAdmin && total < seedCount && (
          <PremiumCard title="Create allotment" subtitle={`${total} of ${seedCount} rows exist`} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: PX.sub, marginBottom: 10 }}>Creates the 20 tests × 6 sections and the 13 practice sets from the Office Order. Existing rows are left as they are.</div>
            <button className="px-btn gold" disabled={busy} onClick={createAllotment}>{busy ? 'Creating…' : 'Create allotment'}</button>
          </PremiumCard>
        )}
      </>
    )
  }

  const Schedule = () => (
    <PremiumCard title="Schedule of Pre Mock Tests" subtitle={`Office Order ${ORDER_NO} · tests on alternate days`} bodyStyle={{ padding: 0 }}
      right={<span style={{ fontSize: 11.5, color: PX.sub }}>No test or deadline on 13 Dec, 27 Dec, 1 Jan</span>}>
      <div style={{ overflowX: 'auto' }}>
        <table className="px-table">
          <thead><tr><th>Test</th><th>Date</th><th>Day</th><th>Drafts due</th><th>Verification</th><th>Final &amp; print</th><th>Sections</th><th>Status</th></tr></thead>
          <tbody>
            {TESTS.map(t => {
              const r = tests.filter(x => x.test_no === t.no)
              const st = sectionStats(r)
              const late = r.some(x => isOverdue(x, today))
              const done = r.length > 0 && st.ok === r.length
              const upcoming = nextTest && nextTest.no === t.no
              return (
                <tr key={t.no} style={dayName(t.date) === 'Sunday' ? { background: PX.tint } : undefined}>
                  <td><b>{t.id}</b>{upcoming && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: PX.gold }}>NEXT</span>}</td>
                  <td>{fmt(t.date)}</td>
                  <td>{dayName(t.date)}{dayName(t.date) === 'Sunday' ? ' *' : ''}</td>
                  <td>{fmtShort(t.drafts)}</td><td>{fmtShort(t.verify)}</td><td>{fmtShort(t.print)}</td>
                  <td>{st.done}/{r.length || 6} in · {st.ok} approved</td>
                  <td>{r.length ? <Chip status={done ? 'Approved' : st.done ? 'Submitted' : 'Pending'} overdue={late && !done} small /> : <span style={{ color: PX.faint }}>—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 16px', fontSize: 12, color: PX.sub }}>* Sunday, a working day. The 1 Jan test moved to 2 Jan; the tests start right after the JNVST ({fmtShort(JNVST[0])}–{fmtShort(JNVST[3])}).</div>
    </PremiumCard>
  )

  const Allotment = () => {
    const list = filterTest ? TESTS.filter(t => t.no === filterTest) : TESTS
    return (
      <PremiumCard title="Allotment" subtitle="Who sets each section. Tap a cell to update it."
        right={filterTest ? <button className="px-btn ghost" onClick={() => setFilterTest(0)}>Show all tests</button> : null} bodyStyle={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="px-table" style={{ minWidth: 720 }}>
            <thead><tr><th>Test</th>{SUBJECTS.map(s => <th key={s.key}>{s.short}</th>)}</tr></thead>
            <tbody>
              {list.map(t => (
                <tr key={t.no}>
                  <td><b>{t.id}</b><div style={{ fontSize: 11, color: PX.sub }}>{fmtShort(t.date)}</div></td>
                  {SUBJECTS.map(s => {
                    const r = byCell[t.no + '|' + s.label]
                    if (!r) return <td key={s.key} style={{ color: PX.faint }}>—</td>
                    return (
                      <td key={s.key} style={{ cursor: 'pointer' }} onClick={() => setSel(r)}>
                        <div style={{ fontWeight: 600, color: PX.ink }}>{r.setter}</div>
                        <Chip status={r.status} overdue={isOverdue(r, today)} small />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No allotment yet. {isAdmin ? 'Use “Create allotment” on the Overview tab.' : 'Ask the Principal to create it.'}</div>}
      </PremiumCard>
    )
  }

  const TaskRow = ({ r }) => {
    const late = isOverdue(r, today)
    const next = allowedStatuses(r)
    const quick = next.find(x => STATUS_FLOW.indexOf(x) === STATUS_FLOW.indexOf(r.status) + 1)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${PX.line}`, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.kind === 'test' ? `PMT-${String(r.test_no).padStart(2, '0')} · ` : 'Practice · '}{r.subject}</div>
          <div style={{ fontSize: 12, color: PX.sub, marginTop: 2 }}>
            Setter {fullName(r.setter)}{r.verifier ? ` · verifier ${fullName(r.verifier)}` : ''} · {r.question_count ?? '—'} questions · due {fmtShort(dueFor(r))}
          </div>
        </div>
        <Chip status={r.status} overdue={late} />
        {quick && <button className="px-btn gold" disabled={busy} onClick={() => saveTask(r, { status: quick })}>Mark {quick.toLowerCase()}</button>}
        <button className="px-btn ghost" onClick={() => setSel(r)}>Open</button>
      </div>
    )
  }

  const Mine = () => {
    const names = Array.from(new Set(rows.flatMap(r => [r.setter, r.verifier]).filter(Boolean))).sort()
    const mine = rows
      .filter(r => (isAdmin ? (!person || r.setter === person || r.verifier === person) : (isMe(r.setter) || isMe(r.verifier))))
      .sort((a, b) => dueFor(a).localeCompare(dueFor(b)) || a.test_no - b.test_no)
    return (
      <PremiumCard title={isAdmin ? 'All tasks' : 'My tasks'} subtitle={isAdmin ? 'Filter by teacher, update any task, export to CSV' : 'Sections you set or verify, earliest deadline first'}
        right={isAdmin ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="px-input" style={{ width: 170 }} value={person} onChange={e => setPerson(e.target.value)} aria-label="Filter by teacher">
              <option value="">All teachers</option>
              {names.map(n => <option key={n} value={n}>{fullName(n)}</option>)}
            </select>
            <button className="px-btn ghost" onClick={exportCsv}>Export CSV</button>
          </div>) : null}
        bodyStyle={{ padding: 0 }}>
        {mine.length === 0
          ? <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>{isAdmin ? 'Nothing to show.' : `No tasks matched “${currentUser?.name || 'your name'}”. Ask the Principal to link your name, or see the Allotment tab.`}</div>
          : mine.map(r => <TaskRow key={r.id} r={r} />)}
      </PremiumCard>
    )
  }

  const Practice = () => (
    <PremiumCard title="Practice question bank" subtitle="Latest pattern · verified by another teacher of the subject · issued to students by 15 Dec" bodyStyle={{ padding: 0 }}>
      {practice.length === 0 && <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No practice sets yet. {isAdmin ? 'Use “Create allotment” on the Overview tab.' : ''}</div>}
      {practice.map(r => <TaskRow key={r.id} r={r} />)}
      {practice.length > 0 && (
        <div style={{ padding: '12px 16px', fontSize: 13, color: PX.sub }}>
          {practice.reduce((n, r) => n + (r.question_count || 0), 0)} questions so far; Sir Sumanta's Mathematics count and the subject of Sir Deepak's set are to be notified.
        </div>
      )}
    </PremiumCard>
  )

  const Panel = () => (
    <>
      <div style={{ fontSize: 13, color: PX.sub, margin: '0 2px 12px' }}>Every teacher listed sets questions for both the tests and the practice bank. Nobody verifies their own questions.</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,minmax(0,1fr))', gap: 14 }}>
        {SUBJECTS.map(s => {
          const list = PANEL[s.key]
          return (
            <PremiumCard key={s.key} title={s.label} subtitle={s.key === 'gk' ? 'Checked by Sir Arunkumar or the Principal' : list.length === 2 ? 'Each verifies the other' : list.join(' → ') + ' → ' + list[0]}>
              {list.map(n => {
                const mineRows = tests.filter(r => r.subject === s.label && r.setter === n)
                return (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5, borderBottom: `1px solid ${PX.line}` }}>
                    <span style={{ fontWeight: 600 }}>{fullName(n)}</span>
                    <span style={{ color: PX.sub }}>{mineRows.length || '—'} tests · {mineRows.filter(r => r.status !== 'Pending').length} in</span>
                  </div>
                )
              })}
            </PremiumCard>
          )
        })}
      </div>
    </>
  )

  // ── render ─────────────────────────────────────────────────────────────
  if (setup) {
    return (
      <div className="px-root"><PremiumStyles />
        <div className="px-wrap">
          <PremiumCard title="One-time setup needed" subtitle="The Mission Sainik table is not in the database yet">
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              Open Supabase → SQL editor and run <b>supabase/migrations/20261201_mission_sainik_tasks.sql</b>, then reload this page.
            </div>
          </PremiumCard>
        </div>
      </div>
    )
  }

  return (
    <div className="px-root">
      <PremiumStyles />
      <div className="px-wrap">
        <PremiumHero eyebrow="GNSI · Mission Sainik 2027" title="Pre Mock Tests" subtitle={`Search for Extra Ordinary · 20 tests · ${fmtShort(TESTS[0].date)} – ${fmt(TESTS[19].date)}`}
          icon={<span style={{ fontSize: 24 }}>🎖️</span>} isMobile={isMobile}
          actions={<>
            <button className="px-hbtn" onClick={printNotice}>🖨 Notice</button>
            <button className="px-hbtn" onClick={load} aria-label="Refresh">🔄</button>
          </>}
          stats={[
            { label: 'Next test', value: nextTest ? nextTest.id : 'Done', sub: nextTest ? `${fmtShort(nextTest.date)} · ${dayName(nextTest.date)}` : 'All 20 held' },
            { label: 'Submission', value: daysToDeadline > 0 ? daysToDeadline + 'd left' : daysToDeadline === 0 ? 'Today' : 'Closed', sub: 'by ' + fmtShort(SUBMISSION_DEADLINE) },
            { label: 'In', value: `${submitted}/${total || seedCount}`, sub: 'submitted or beyond' },
            { label: 'Approved', value: approved, sub: 'ready to print', tone: PX.goldLt },
            { label: 'Overdue', value: overdue, sub: 'not submitted', tone: overdue ? '#fca5a5' : '#fff' },
          ]} />
        <PremiumTabs tabs={tabs} active={tab} onChange={setTab} style={{ marginBottom: 14 }} />
        {msg && <div role="status" style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 12, background: msg.startsWith('❌') ? PX.badBg : PX.okBg, color: msg.startsWith('❌') ? PX.bad : PX.ok, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>Loading…</div> : (
          <>
            {tab === 'overview' && <Overview />}
            {tab === 'schedule' && <Schedule />}
            {tab === 'allotment' && <Allotment />}
            {tab === 'mine' && <Mine />}
            {tab === 'practice' && <Practice />}
            {tab === 'panel' && <Panel />}
          </>
        )}
      </div>
      {sel && <TaskDialog key={sel.id} sel={sel} today={today} isAdmin={isAdmin} allowed={allowedStatuses(sel)} busy={busy} onSave={saveTask} onClose={() => setSel(null)} />}
    </div>
  )
}
