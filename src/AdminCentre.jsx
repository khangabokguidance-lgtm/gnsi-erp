// AdminCentre.jsx — the admin dashboard's command centre: a bento overview of every module, a map of how the
// modules connect (with live cross-module checks), and a Report Centre to export every module's data.
// Read-only: nothing here changes a record. Rendered by GNSIDashboard (admins only).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { isAdminRole } from './roles'
import { courseOf, batchOf, canonicalBatch } from './courseMap'
import { getSessionYear, sourceRef } from './feeEngine'
import { computeDuesSnapshot, fetchAll } from './duesSnapshot'
import AdmissionsStudentsMatch from './AdmissionsStudentsMatch'
import { crossModuleChecks } from './lib/crossChecks'

const INK = '#0b1730', NAVY = '#132a4f', GOLD_LT = '#e2c57e', SUB = '#6a7592', BG = '#eef0f6'
const card = { background: '#fff', borderRadius: 22, padding: '16px 18px', boxShadow: '0 8px 24px -14px rgba(20,33,61,.35)', position: 'relative', overflow: 'hidden' }
const lbl = { fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 800, color: SUB }
const serif = "'Iowan Old Style','Palatino Linotype',Georgia,serif"
const inr = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const compact = n => { const v = Number(n || 0); return v >= 1e7 ? `₹${(v / 1e7).toFixed(2)}Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(2)}L` : inr(v) }
const LEVEL = { critical: ['🔴', '#b23a48'], warning: ['🟡', '#8a6a1f'], good: ['🟢', '#1e7a55'], info: ['🔵', '#2c5aa0'] }

const csvOf = rows => {
  if (!rows.length) return ''
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const q = v => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return `"${s.replace(/"/g, '""')}"` }
  return '﻿' + [cols.map(q).join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n')
}
function download(name, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const pill = on => ({ padding: '8px 16px', borderRadius: 999, border: `1px solid ${on ? NAVY : '#d6dae6'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : INK, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' })
const btn = { padding: '7px 13px', borderRadius: 10, border: '1px solid #d6dae6', background: '#fff', color: INK, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }

// ── Bento overview ─────────────────────────────────────────────────────────────
function Spark({ values, color = GOLD_LT, h = 110 }) {
  const v = values.length > 1 ? values : [0, 0]
  const max = Math.max(...v, 1), W = 520
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * W},${h - 10 - (y / max) * (h - 24)}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></svg>
}

function Tile({ icon, label, value, sub, onClick, accent, wide, phone }) {
  return (
    <button type="button" onClick={onClick} style={{ ...card, gridColumn: wide ? (phone ? '1 / -1' : 'span 2') : undefined, ...(phone ? { padding: 14, minWidth: 0 } : null), textAlign: 'left', border: 0, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', color: INK,
      ...(accent ? { background: 'linear-gradient(150deg,#d9b566,#b8923a)', color: '#1a1406' } : null) }}>
      <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 20 }}>{icon}</span>
      <div style={{ ...lbl, color: accent ? 'rgba(26,20,6,.7)' : SUB }}>{label}</div>
      <div style={{ fontFamily: serif, fontSize: phone ? 24 : 28, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, marginTop: 4, color: accent ? 'rgba(26,20,6,.75)' : SUB }}>{sub}</div>}
    </button>
  )
}

function usePhone() {
  const [p, setP] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setP(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return p
}

function Overview({ data, briefing, onOpenSection, onNavigate }) {
  const phone = usePhone()
  const [pending, setPending] = useState(null)   // null | { busy, done, total } | { total, count }
  const workOutDues = async () => {
    setPending({ busy: true, done: 0, total: 0 })
    try {
      const r = await computeDuesSnapshot(p => setPending({ busy: true, ...p }))
      setPending({ total: r.total, count: r.count, of: r.of, partial: r.partial })
    } catch (e) { setPending({ error: e.message || 'Could not work out dues' }) }
  }
  const collected = (data.monthlyFees || []).map(m => m.collected)
  const att = data.totalToday ? Math.round((data.presentToday / data.totalToday) * 100) : null
  const open = (section, module) => () => (section ? onOpenSection(section) : onNavigate?.(module))
  const L = briefing || []
  return (
    <div style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(2,minmax(0,1fr))' : 'repeat(auto-fill,minmax(190px,1fr))', gridAutoRows: phone ? 'auto' : 'minmax(118px,auto)', gap: phone ? 10 : 14, gridAutoFlow: 'dense' }}>
      <button type="button" onClick={open('finance')} style={{ ...card, gridColumn: phone ? '1 / -1' : 'span 3', gridRow: phone ? 'auto' : 'span 3', border: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0, color: '#fff', fontFamily: 'inherit',
        background: 'linear-gradient(150deg,#13294f,#0b1730 70%)', padding: 24 }}>
        <div style={{ ...lbl, color: 'rgba(255,255,255,.7)' }}>Fees collected</div>
        <div style={{ fontFamily: serif, fontSize: 'clamp(34px,5vw,54px)', lineHeight: 1, margin: '10px 0 6px', color: GOLD_LT }}>{inr(data.totalFeeCollected)}</div>
        <div style={{ fontSize: 13, opacity: .78 }}>Admission {compact(data.admFeeTotal)} · Flat {compact(data.flatFeeTotal)} · Course {compact(data.courseFeeTotal)}</div>
        <div style={{ marginTop: 22 }}><Spark values={collected} /></div>
        <div style={{ fontSize: 11, opacity: .6, marginTop: 6 }}>Income by month this session · tap for the Finance report</div>
      </button>
      <Tile phone={phone} icon="🎓" label="Students" value={Number(data.activeStudentCount ?? data.totalStudents ?? 0).toLocaleString('en-IN')} sub={`${data.totalStudents ?? 0} on record`} onClick={open('students')} />
      <Tile phone={phone} icon="✅" label="Attendance today" value={att == null ? '—' : `${att}%`} sub={data.totalToday ? `${data.presentToday} of ${data.totalToday} present` : 'not marked yet'} onClick={open('attendance')} />
      <Tile phone={phone} icon="📋" label="Admissions" value={Number(data.totalAdmissions || 0).toLocaleString('en-IN')} sub={`${data.admEnrolled || 0} enrolled`} onClick={open('admissions')} />
      <div style={{ ...card, gridColumn: 'span 1', background: 'linear-gradient(150deg,#d9b566,#b8923a)', color: '#1a1406', display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 16px' }}>
        <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 20 }}>💸</span>
        <div style={{ ...lbl, color: 'rgba(26,20,6,.7)' }}>Fee pending</div>
        {!pending && <button type="button" onClick={workOutDues} style={{ ...btn, marginTop: 6, background: 'rgba(255,255,255,.55)', borderColor: 'rgba(26,20,6,.2)' }}>Work out dues</button>}
        {pending?.busy && <div style={{ fontSize: 12.5, marginTop: 6 }}>Working out… {pending.done || 0}{pending.total ? ` / ${pending.total}` : ''}</div>}
        {pending?.error && <div style={{ fontSize: 12, marginTop: 6 }}>{pending.error}</div>}
        {pending && !pending.busy && !pending.error && <>
          <div style={{ fontFamily: serif, fontSize: 28, lineHeight: 1.1, marginTop: 4 }}>{compact(pending.total)}</div>
          <div style={{ fontSize: 11.5 }}>{pending.count} of {pending.of} students owe{pending.partial ? ' · some figures incomplete' : ''}</div>
          <button type="button" onClick={() => onNavigate?.('fees')} style={{ ...btn, padding: '4px 10px', fontSize: 11.5, marginTop: 4, background: 'rgba(255,255,255,.55)' }}>Open Fees →</button></>}
      </div>
      <Tile wide phone={phone} icon="📉" label="Net P&L" value={compact(data.netPL)} sub={`Expenses ${compact(data.totalExpenses)} · income ${compact(data.totalFeeCollected)}`} onClick={open('expenses')} />
      <Tile phone={phone} icon="🛏️" label="Hostel" value={`${data.hostelOccupied ?? 0}`} sub={`occupied of ${data.hostelTotalRooms ?? 0} rooms`} onClick={open('hostel')} />
      <Tile phone={phone} icon="📝" label="Tests" value={data.totalTests ?? 0} sub={`${data.totalTestEntries ?? 0} entries`} onClick={open('tests')} />
      <Tile phone={phone} icon="👨‍💼" label="Staff & HR" value={data.activeStaffCnt ?? data.totalStaff ?? 0} sub="active" onClick={open('staff')} />
      <div style={{ ...card, gridColumn: phone ? '1 / -1' : 'span 2', gridRow: phone ? 'auto' : 'span 2', padding: 18 }}>
        <div style={lbl}>Daily briefing</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {L.length ? L.map((b, i) => <li key={i} style={{ fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid #eef0f6', display: 'flex', gap: 8, color: (LEVEL[b.level] || LEVEL.info)[1] }}><span>{(LEVEL[b.level] || LEVEL.info)[0]}</span><span style={{ color: INK }}>{b.text}</span></li>)
            : <li style={{ fontSize: 12.5, color: SUB }}>Nothing needs attention right now.</li>}
        </ul>
      </div>
      <Tile phone={phone} icon="📚" label="Academic" value={data.avgScore != null ? `${Math.round(data.avgScore)}%` : '—'} sub="average score" onClick={open('academic')} />
      <Tile phone={phone} icon="🔍" label="Enquiry" value={data.openEnquiries ?? 0} sub={`${data.totalEnquiries ?? 0} leads`} onClick={open('enquiry')} />
      <Tile phone={phone} icon="🗂️" label="Batches" value={data.activeBatches ?? 0} sub={`${data.totalBatches ?? 0} total`} onClick={open('batches')} />
      <Tile phone={phone} icon="🏅" label="Selections" value={data.totalSelections ?? 0} sub={`JNV ${data.jnvSelections ?? 0} · Sainik ${data.sainikSelections ?? 0}`} onClick={open('results')} />
      <Tile phone={phone} icon="💬" label="Doubts open" value={data.unresolvedDoubts ?? 0} sub={`${data.totalDoubts ?? 0} raised`} onClick={open('doubts')} />
      <Tile phone={phone} icon="👨‍👩‍👧" label="Parent SMS" value={data.totalSMSSent ?? 0} sub="sent" onClick={open('parents')} />
      <Tile phone={phone} icon="🏆" label="Entrance exams" value={data.totalEntranceExams ?? 0} sub={`${data.totalEntranceCandidates ?? 0} candidates`} onClick={open('entrance')} />
    </div>
  )
}

// ── Connections map + cross-module checks ──────────────────────────────────────────
const FLOWS = [
  { title: 'Admission to money', nodes: [['Admissions', 'admissions'], ['Students', 'students'], ['Fees', 'fees'], ['Accounts', 'accounts']],
    links: [['adm_no_student', 'enrolled_no_photo'], ['stu_no_rate', 'stu_no_admdate'], ['pay_no_account']] },
  { title: 'Entrance to fees', nodes: [['Entrance', 'entrance'], ['Admissions', 'admissions'], ['Fees', 'fees']],
    links: [['ent_no_application'], ['enrolled_no_admfee', 'adm_concession_not_in_fees', 'adm_plan_not_set']] },
  { title: 'Who is in which class', nodes: [['Courses', 'courses'], ['Students', 'students'], ['Hostel', 'hostel']],
    links: [['stu_no_course'], ['boarder_no_bed']] },
]

function Connections({ onNavigate }) {
  const [state, setState] = useState({ busy: true })
  const [openKey, setOpenKey] = useState(null)
  const run = useCallback(async () => {
    setState({ busy: true })
    try {
      const session = getSessionYear()
      const [students, admissions, feeStructures, allocations, flatRows, courseRows, admRows, acct, concessions, plans, entCands, entResults] = await Promise.all([
        fetchAll('students', 'id, gcc_no, name, course, batch, class_name, hostel_type, admission_date, status, deleted_at, photo_url, photo_path'),
        fetchAll('admissions', 'id, gcc_no, applicant_name, dob, status, scholarship_pct, concession_amt, sibling_gcc, instalment_plan, photo_url'),
        fetchAll('fee_structures', 'course, batch, hostel_type', [['session_year', 'eq', session]]),
        fetchAll('hostel_allocations', 'student_id, status').catch(() => []),
        fetchAll('adm_flat_fees', 'id, adm_app_id, month, year, amount, paid, reverted, pay_date, receipt_no'),
        fetchAll('adm_course_fees', 'id, adm_app_id, for_month, year, amount_paid, reverted, pay_date, receipt_no'),
        fetchAll('adm_fee_collections', 'id, adm_app_id, fee_type, description, amount_paid, reverted, pay_date, receipt_no'),
        fetchAll('accounts', 'source_ref, source_type', [['is_soft_deleted', 'eq', false]]),
        fetchAll('fee_concession_register', 'gcc', [['status', 'eq', 'active']]).catch(() => []),     // a table that is not there yet just means "none"
        fetchAll('fee_installment_plans', 'gcc', [['status', 'eq', 'active']]).catch(() => []),
        fetchAll('entrance_candidates', 'id, student_name, dob, application_no').catch(() => []),
        fetchAll('entrance_results', 'candidate_id, result_status').catch(() => []),
      ])
      const gk = v => String(parseInt(v) || 0)
      const admittedIds = new Set(entResults.filter(r => r.result_status === 'Admitted').map(r => String(r.candidate_id)))
      const accountRefs = new Set(acct.map(a => `${a.source_ref}|${a.source_type}`))
      const checks = crossModuleChecks({ students, admissions, feeStructures, allocations, flatRows, courseRows, admRows, accountRefs,
        concessionGccs: new Set(concessions.map(r => gk(r.gcc))), planGccs: new Set(plans.map(r => gk(r.gcc))), entranceAdmitted: entCands.filter(c => admittedIds.has(String(c.id))),
        sessionStart: `${session.slice(0, 4)}-04-01`, courseOf, batchOf, canonicalBatch, sourceRef })
      setState({ checks: Object.fromEntries(checks.map(c => [c.key, c])), at: new Date() })
    } catch (e) { setState({ error: e.message || 'Could not run the checks' }) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- runs the checks once when the tab opens
  useEffect(() => { run() }, [run])

  const cnt = key => state.checks?.[key]?.items.length
  const total = state.checks ? Object.values(state.checks).reduce((t, c) => t + c.items.length, 0) : null
  const linkTone = keys => { const n = keys.reduce((t, k) => t + (cnt(k) || 0), 0); return state.busy || state.error ? ['#d6dae6', SUB, '…'] : n ? ['#e8c9a4', '#8a4a1f', `${n} to fix`] : ['#bfe0cf', '#1e7a55', 'all linked'] }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: serif, fontSize: 20, color: INK }}>How the modules connect</div>
          <div style={{ fontSize: 12.5, color: SUB }}>Live, read-only checks on each link. {total != null && (total ? `${total} records need attention.` : 'Everything lines up.')}{state.at && ` Checked ${state.at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`}</div>
        </div>
        <button type="button" style={btn} onClick={run} disabled={state.busy}>{state.busy ? 'Checking…' : '↻ Re-run checks'}</button>
      </div>
      {state.error && <div style={{ ...card, color: '#b91c1c', marginBottom: 14 }}>Could not run the checks: {state.error}</div>}
      {FLOWS.map(f => (
        <div key={f.title} style={{ ...card, marginBottom: 14 }}>
          <div style={{ ...lbl, marginBottom: 12 }}>{f.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {f.nodes.map(([name, mod], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" onClick={() => onNavigate?.(mod)} style={{ ...btn, padding: '12px 18px', background: NAVY, color: '#fff', borderColor: NAVY, fontSize: 14 }}>{name}</button>
                {i < f.links.length && (() => { const [bd, fg, t] = linkTone(f.links[i]); return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: SUB, fontSize: 18 }}>⟶<span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99, border: `1px solid ${bd}`, color: fg, background: '#fff' }}>{t}</span>⟶</span> })()}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ ...card }}>
        <div style={{ ...lbl, marginBottom: 8 }}>Checks</div>
        {Object.values(state.checks || {}).map(c => (
          <div key={c.key} style={{ borderTop: '1px solid #eef0f6' }}>
            <button type="button" onClick={() => setOpenKey(openKey === c.key ? null : c.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: INK }}>
              <span style={{ minWidth: 38, textAlign: 'center', fontWeight: 800, padding: '3px 8px', borderRadius: 99, background: c.items.length ? '#fbe6e8' : '#e1f0e8', color: c.items.length ? '#b23a48' : '#1e7a55' }}>{c.items.length}</span>
              <span style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{c.label}</b><span style={{ display: 'block', fontSize: 11.5, color: SUB }}>{c.from} → {c.to}</span></span>
              <span style={{ color: SUB, fontSize: 12 }}>{c.items.length ? (openKey === c.key ? '▲' : '▼') : '✓'}</span>
            </button>
            {openKey === c.key && c.items.length > 0 && (
              <div style={{ padding: '0 2px 14px 50px' }}>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>How to fix: {c.fix}</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, maxHeight: 220, overflowY: 'auto' }}>{c.items.slice(0, 100).map(i => <li key={i.id}>{i.label}</li>)}</ul>
                {c.items.length > 100 && <div style={{ fontSize: 11.5, color: SUB, marginTop: 4 }}>Showing 100 of {c.items.length}.</div>}
                <button type="button" style={{ ...btn, marginTop: 8 }} onClick={() => onNavigate?.(c.module)}>Open the module →</button>
              </div>
            )}
          </div>
        ))}
        {state.busy && !state.checks && <div style={{ fontSize: 13, color: SUB, padding: '8px 0' }}>Reading the modules…</div>}
      </div>
    </div>
  )
}

// ── Report Centre ─────────────────────────────────────────────────────────────────
const REPORTS = [
  { group: 'Finance', items: [
    { label: 'Fee collections (admission, kit, advance)', table: 'adm_fee_collections', filters: [['reverted', 'eq', false]], module: 'fees' },
    { label: 'Monthly flat fees', table: 'adm_flat_fees', filters: [['paid', 'eq', true], ['reverted', 'eq', false]], module: 'fees' },
    { label: 'Course fees', table: 'adm_course_fees', filters: [['reverted', 'eq', false]], module: 'fees' },
    { label: 'Fee rates (Fee Setup)', table: 'fee_structures', module: 'feesetup' },
    { label: 'Accounts ledger', table: 'accounts', filters: [['is_soft_deleted', 'eq', false]], module: 'accounts' },
  ] },
  { group: 'Students & admissions', items: [
    { label: 'Students', table: 'students', module: 'students' },
    { label: 'Admissions', table: 'admissions', module: 'admissions' },
    { label: 'Course batches', table: 'course_batches', module: 'courses' },
    { label: 'Hostel allocations', table: 'hostel_allocations', module: 'hostel' },
  ] },
  { group: 'Academic', items: [
    { label: 'Attendance', table: 'attendance', module: 'attendance', note: 'large' },
    { label: 'Exams', table: 'exams', module: 'exams' },
    { label: 'Exam scores', table: 'exam_scores', module: 'exams' },
  ] },
  { group: 'Staff', items: [{ label: 'Staff profiles (includes salary fields)', table: 'staff_profiles', module: 'staff' }] },
]

function ReportCentre({ onNavigate }) {
  const [st, setSt] = useState({})   // table → { busy } | { rows } | { error }
  const exportOne = async r => {
    setSt(s => ({ ...s, [r.table]: { busy: true } }))
    try {
      const rows = await fetchAll(r.table, '*', r.filters || [])
      if (!rows.length) { setSt(s => ({ ...s, [r.table]: { rows: 0 } })); return }
      download(`GNSI_${r.table}_${new Date().toLocaleDateString('en-CA')}.csv`, csvOf(rows))
      setSt(s => ({ ...s, [r.table]: { rows: rows.length } }))
    } catch (e) { setSt(s => ({ ...s, [r.table]: { error: e.message } })) }
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: serif, fontSize: 20, color: INK }}>Report Centre</div>
          <div style={{ fontSize: 12.5, color: SUB }}>Every module's data in one place. CSV opens in Excel or Google Sheets. Reverted and deleted rows are left out.</div>
        </div>
        <button type="button" style={{ ...btn, background: NAVY, color: '#fff', borderColor: NAVY }} onClick={() => onNavigate?.('reports')}>Custom report builder →</button>
      </div>
      {REPORTS.map(g => (
        <div key={g.group} style={{ ...card, marginBottom: 14, padding: '14px 18px' }}>
          <div style={{ ...lbl, marginBottom: 6 }}>{g.group}</div>
          {g.items.map(r => { const s = st[r.table] || {}; return (
            <div key={r.table} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #eef0f6', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <b style={{ fontSize: 13.5 }}>{r.label}</b>
                <div style={{ fontSize: 11.5, color: s.error ? '#b91c1c' : SUB }}>{s.error ? s.error : s.rows === 0 ? 'No rows to export.' : s.rows ? `Downloaded ${s.rows.toLocaleString('en-IN')} rows.` : r.note === 'large' ? 'Can be large — may take a moment.' : r.table}</div>
              </div>
              <button type="button" style={btn} disabled={s.busy} onClick={() => exportOne(r)}>{s.busy ? 'Preparing…' : '⬇ Export CSV'}</button>
              <button type="button" style={btn} onClick={() => onNavigate?.(r.module)}>Open module →</button>
            </div>) })}
        </div>
      ))}
    </div>
  )
}

// ── Centre ────────────────────────────────────────────────────────────────────────
export default function AdminCentre({ data, briefing, currentUser, onNavigate, onOpenSection }) {
  const [view, setView] = useState('overview')
  const admin = isAdminRole(currentUser?.role)
  const today = useMemo(() => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), [])
  if (currentUser && !admin) return <div style={{ ...card, textAlign: 'center', color: SUB }}>🔒 The command centre is for administrators.</div>
  return (
    <div style={{ background: BG, borderRadius: 24, padding: 'clamp(14px,2.4vw,26px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontFamily: serif, fontSize: 'clamp(22px,3vw,28px)', color: INK }}>Command centre</h1>
          <div style={{ fontSize: 12.5, color: SUB }}>{today} · Session {getSessionYear()} · Read-only · tap a tile to open that module's report</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['overview', 'Overview'], ['connections', 'Connections & checks'], ['admstu', 'Admissions ↔ Students'], ['reports', 'Report Centre']].map(([id, label]) => <button key={id} type="button" style={pill(view === id)} onClick={() => setView(id)}>{label}</button>)}
        </div>
      </div>
      {view === 'overview' && <Overview data={data} briefing={briefing} onOpenSection={onOpenSection} onNavigate={onNavigate} />}
      {view === 'connections' && <Connections onNavigate={onNavigate} />}
      {view === 'admstu' && <AdmissionsStudentsMatch onNavigate={onNavigate} />}
      {view === 'reports' && <ReportCentre onNavigate={onNavigate} />}
    </div>
  )
}
