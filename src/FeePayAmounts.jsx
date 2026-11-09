// FeePayAmounts.jsx — "Who pays how much" tab of the Fee Ledger.
//   By amount:  every amount that fee payments were made at, with how many students / payments (bars).
//               Click an amount to see exactly who paid it.
//   By student: each student's usual amount, range and total, against what their fee is today.
import { useEffect, useMemo, useState } from 'react'
import { loadAllFeeRows } from './feeLedgerBulk'
import { getFeeRates, getSessionYear } from './feeEngine'
import { useAddonResolver } from './useAddonResolver'
import { amountDistribution, studentAmounts, sessionOfMonth } from './lib/amountFinder'

const fmt = n => Number(n || 0).toLocaleString('en-IN')
const C = { navy: '#132a4f', gold: '#b8923a', line: '#e6dcc3', sub: '#5d6b82', ink: '#14213d', ok: '#146c3a', warn: '#9a5b00', bad: '#b42318' }

export default function FeePayAmounts({ students, onPickAmount }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState('amount')          // 'amount' | 'student'
  const [kind, setKind] = useState('course')
  const [session, setSession] = useState(getSessionYear())
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState('name')        // name | usual | total | mixed
  const [onlyMixed, setOnlyMixed] = useState(false)
  const [std, setStd] = useState({})
  const addon = useAddonResolver()

  useEffect(() => {
    let live = true
    loadAllFeeRows().then(r => { if (live) setRows(r) }).catch(e => { if (live) setErr(e.message || 'Could not load fee records') })
    return () => { live = false }
  }, [])

  const sessions = useMemo(() => {
    if (!rows) return [getSessionYear()]
    const set = new Set([getSessionYear()])
    ;[...rows.crs.values()].flat().forEach(r => { const s = sessionOfMonth(r.for_month, r.year); if (s) set.add(s) })
    ;[...rows.flat.values()].flat().forEach(r => { const s = sessionOfMonth(r.month, r.year); if (s) set.add(s) })
    return [...set].sort().reverse()
  }, [rows])

  const dist = useMemo(() => rows ? amountDistribution({ students, rows, kind, session }) : [], [rows, students, kind, session])
  const perStudent = useMemo(() => rows ? studentAmounts({ students, rows, kind, session }) : [], [rows, students, kind, session])
  const maxPay = Math.max(1, ...dist.map(d => d.payments))
  const totalPayments = dist.reduce((s, d) => s + d.payments, 0)

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const l = perStudent.filter(r => (!onlyMixed || r.distinct > 1) && (!t || `${r.student.name} ${r.student.gcc_no}`.toLowerCase().includes(t)))
    const by = { name: (a, b) => String(a.student.name).localeCompare(String(b.student.name)), usual: (a, b) => b.usual - a.usual, total: (a, b) => b.total - a.total, mixed: (a, b) => b.distinct - a.distinct || String(a.student.name).localeCompare(String(b.student.name)) }
    return l.slice().sort(by[sortBy])
  }, [perStudent, q, onlyMixed, sortBy])

  // Today's standard for the students on screen (their own course/batch/hostel, add-on and override included).
  useEffect(() => {
    if (view !== 'student') return undefined
    let live = true
    const todo = list.slice(0, 120).filter(r => std[String(r.student.gcc_no)] === undefined)
    if (!todo.length) return undefined
    ;(async () => {
      const out = {}
      for (let i = 0; i < todo.length; i += 10) {
        await Promise.all(todo.slice(i, i + 10).map(async r => {
          const s = r.student
          try { const x = await getFeeRates(session, s.course || '', s.batch || '', s.hostel_type || 'Day Scholar', parseInt(s.gcc_no) || null); out[String(s.gcc_no)] = { course: x.courseFee, flat: x.flatFee } }
          catch { out[String(s.gcc_no)] = null }
        }))
        if (!live) return
      }
      if (live) setStd(p => ({ ...p, ...out }))
    })()
    return () => { live = false }
  }, [view, list, session]) // eslint-disable-line react-hooks/exhaustive-deps

  const verdict = r => {
    const x = std[String(r.student.gcc_no)]
    if (x === undefined) return { t: '…', c: C.sub }
    const want = kind === 'flat' ? x?.flat : x?.course
    if (!(want > 0)) return { t: 'no rate set', c: C.warn }
    if (Math.abs(want - r.usual) < 0.5) return { t: `= ₹${fmt(want)}`, c: C.ok }
    return r.usual > want ? { t: `₹${fmt(r.usual - want)} above ₹${fmt(want)}`, c: C.warn } : { t: `₹${fmt(want - r.usual)} below ₹${fmt(want)}`, c: C.bad }
  }

  const exportCsv = () => {
    const head = view === 'amount' ? ['Amount', 'Students', 'Payments', 'Course-fee payments', 'Flat-fee payments'] : ['Name', 'GCC', 'Course', 'Batch', 'Combined', 'Usual amount', 'Paid that amount (months)', 'Lowest', 'Highest', 'Different amounts', 'Total paid']
    const lines = view === 'amount'
      ? dist.map(d => [d.amount, d.students, d.payments, d.course, d.flat])
      : list.map(r => [r.student.name, r.student.gcc_no, r.student.course || '', r.student.batch || '', addon.eligible(r.student) ? 'Yes' : '', r.usual, r.usualCount, r.min, r.max, r.distinct, r.total])
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv)
    a.download = `GNSI_who_pays_how_much_${view}_${session || 'all'}.csv`
    a.click()
  }

  const inp = { height: 38, padding: '0 12px', border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', background: '#fff', color: C.ink }
  const pill = on => ({ padding: '8px 16px', borderRadius: 999, border: `1px solid ${on ? C.navy : C.line}`, background: on ? C.navy : '#fff', color: on ? '#fff' : C.sub, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="gp-card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>💰 Who pays how much</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>Every amount fee payments were made at — and who pays each — so odd amounts, add-ons and wrong rates stand out.</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <button style={pill(view === 'amount')} onClick={() => setView('amount')}>By amount</button>
          <button style={pill(view === 'student')} onClick={() => setView('student')}>By student</button>
          <select value={kind} onChange={e => setKind(e.target.value)} style={inp} aria-label="Fee type"><option value="course">Course fee</option><option value="flat">Flat fee (Feb–Mar)</option><option value="all">Course + flat</option></select>
          <select value={session} onChange={e => setSession(e.target.value)} style={inp} aria-label="Session"><option value="">All sessions</option>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select>
          {view === 'student' && <>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or GCC…" style={{ ...inp, flex: 1, minWidth: 150 }} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={inp} aria-label="Sort"><option value="name">Sort: name</option><option value="usual">Sort: highest usual amount</option><option value="total">Sort: total paid</option><option value="mixed">Sort: most different amounts</option></select>
            <label style={{ fontSize: 12.5, color: C.sub, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={onlyMixed} onChange={e => setOnlyMixed(e.target.checked)} />only students who paid different amounts</label>
          </>}
          <button onClick={exportCsv} disabled={view === 'amount' ? !dist.length : !list.length} style={{ ...inp, cursor: 'pointer', fontWeight: 700, marginLeft: 'auto' }}>📥 Export</button>
        </div>
      </div>

      {err && <div style={{ color: C.bad, fontWeight: 600 }}>⚠ {err}</div>}
      {!rows && !err && <div style={{ color: C.sub, padding: 20 }}>⏳ Loading fee records…</div>}

      {rows && view === 'amount' && (
        <div className="gp-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead><tr style={{ textAlign: 'left', color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              <th style={{ padding: '10px 14px' }}>Amount</th><th>Students</th><th>Payments</th><th style={{ width: '36%' }}>Share of all payments</th><th />
            </tr></thead>
            <tbody>
              {dist.slice(0, 60).map(d => (
                <tr key={d.amount} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: '9px 14px', fontWeight: 800, color: C.ink, fontSize: 15 }}>₹{fmt(d.amount)}</td>
                  <td><b>{d.students}</b></td>
                  <td>{d.payments}{kind === 'all' && <span style={{ color: C.sub, fontSize: 11 }}> ({d.course} course · {d.flat} flat)</span>}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, height: 9, background: '#f3f0e8', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${(d.payments / maxPay) * 100}%`, height: '100%', background: `linear-gradient(90deg,${C.navy},${C.gold})`, borderRadius: 99 }} /></div><span style={{ fontSize: 11.5, color: C.sub, minWidth: 34 }}>{Math.round((d.payments / totalPayments) * 100)}%</span></div></td>
                  <td style={{ textAlign: 'right', paddingRight: 14 }}><button onClick={() => onPickAmount?.({ amount: d.amount, kind, session })} style={{ border: 'none', background: 'none', color: '#1e3a6e', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Who? →</button></td>
                </tr>
              ))}
              {!dist.length && <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: C.sub }}>No fee payments in this selection.</td></tr>}
            </tbody>
          </table>
          {dist.length > 60 && <div style={{ padding: '10px 14px', fontSize: 12, color: C.sub, borderTop: `1px solid ${C.line}` }}>Showing the 60 most common of {dist.length} amounts — export for the full list.</div>}
        </div>
      )}

      {rows && view === 'student' && (
        <div className="gp-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
            <thead><tr style={{ textAlign: 'left', color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              <th style={{ padding: '10px 14px' }}>Student</th><th>Course · batch</th><th>Usual amount</th><th>Range</th><th>Total paid</th><th>Compared with today’s fee</th>
            </tr></thead>
            <tbody>
              {list.slice(0, 300).map(r => {
                const s = r.student, v = verdict(r), why = addon.eligible(s)
                return (
                  <tr key={s.gcc_no} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: '9px 14px' }}><b style={{ color: C.ink }}>{s.name}</b>{why && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#5b21b6', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 3, padding: '1px 4px' }}>{why === 'exam' ? 'COMBINED·EXAM' : 'COMBINED'}</span>}<div style={{ fontSize: 11, color: C.sub }}>GCC-{s.gcc_no} · {s.hostel_type || '—'}</div></td>
                    <td>{s.course || '—'}{s.batch && s.batch !== '—' ? ` · ${s.batch}` : ''}</td>
                    <td><b style={{ fontSize: 14 }}>₹{fmt(r.usual)}</b> <span style={{ color: C.sub, fontSize: 11.5 }}>× {r.usualCount} of {r.payments}</span></td>
                    <td style={{ color: r.distinct > 1 ? C.warn : C.sub }}>{r.distinct > 1 ? `₹${fmt(r.min)} – ₹${fmt(r.max)} (${r.distinct} amounts)` : 'same every time'}</td>
                    <td>₹{fmt(r.total)}</td>
                    <td style={{ fontWeight: 700, color: v.c }}>{v.t}</td>
                  </tr>
                )
              })}
              {!list.length && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: C.sub }}>No students match.</td></tr>}
            </tbody>
          </table>
          {list.length > 300 && <div style={{ padding: '10px 14px', fontSize: 12, color: C.sub, borderTop: `1px solid ${C.line}` }}>Showing the first 300 of {list.length} — narrow the search or export for the full list.</div>}
        </div>
      )}
    </div>
  )
}
