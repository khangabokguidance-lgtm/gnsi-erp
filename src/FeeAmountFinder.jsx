// FeeAmountFinder.jsx — "Who pays ₹X?" tab of the Fee Ledger.
// Lists every student with fee payments of an exact amount (default ₹6,500), what the fee should be for
// them today, and whether they are Combined — so unexpected amounts (an add-on, a wrong rate) show up.
import { useEffect, useMemo, useState } from 'react'
import { loadAllFeeRows } from './feeLedgerBulk'
import { getFeeRates, getSessionYear } from './feeEngine'
import { useAddonResolver } from './useAddonResolver'
import { findStudentsByAmount, sessionOfMonth } from './lib/amountFinder'

const fmt = n => Number(n || 0).toLocaleString('en-IN')
const C = { navy: '#132a4f', gold: '#b8923a', line: '#e6dcc3', sub: '#5d6b82', ink: '#14213d', ok: '#146c3a', warn: '#9a5b00', bad: '#b42318' }
const MON = { January: 'Jan', February: 'Feb', March: 'Mar', April: 'Apr', May: 'May', June: 'Jun', July: 'Jul', August: 'Aug', September: 'Sep', October: 'Oct', November: 'Nov', December: 'Dec' }

export default function FeeAmountFinder({ students, initial }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '6500')
  const [kind, setKind] = useState(initial?.kind || 'all')
  const [session, setSession] = useState(initial?.session ?? '')
  const [q, setQ] = useState('')
  const [std, setStd] = useState({})          // gcc → { courseFee, flatFee, addonFee }
  const addon = useAddonResolver()

  useEffect(() => {
    let live = true
    loadAllFeeRows().then(r => { if (live) setRows(r) }).catch(e => { if (live) setErr(e.message || 'Could not load fee records') })
    return () => { live = false }
  }, [])

  const sessions = useMemo(() => {
    if (!rows) return []
    const set = new Set([getSessionYear()])
    ;[...rows.crs.values()].flat().forEach(r => { const s = sessionOfMonth(r.for_month, r.year); if (s) set.add(s) })
    ;[...rows.flat.values()].flat().forEach(r => { const s = sessionOfMonth(r.month, r.year); if (s) set.add(s) })
    return [...set].sort().reverse()
  }, [rows])

  const found = useMemo(() => rows ? findStudentsByAmount({ students, rows, amount, kind, session }) : [], [rows, students, amount, kind, session])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? found.filter(g => `${g.student.name} ${g.student.gcc_no}`.toLowerCase().includes(t)) : found
  }, [found, q])

  // What each listed student's fee is today (their own course/batch/hostel, add-on and override included).
  useEffect(() => {
    let live = true
    const todo = shown.slice(0, 150).filter(g => !std[String(g.student.gcc_no)])
    if (!todo.length) return undefined
    ;(async () => {
      const out = {}
      for (let i = 0; i < todo.length; i += 10) {
        await Promise.all(todo.slice(i, i + 10).map(async g => {
          const s = g.student
          try { const r = await getFeeRates(session || getSessionYear(), s.course || '', s.batch || '', s.hostel_type || 'Day Scholar', parseInt(s.gcc_no) || null); out[String(s.gcc_no)] = { courseFee: r.courseFee, flatFee: r.flatFee, addonFee: r.addonFee || 0 } }
          catch { out[String(s.gcc_no)] = null }
        }))
        if (!live) return
      }
      if (live) setStd(p => ({ ...p, ...out }))
    })()
    return () => { live = false }
  }, [shown, session]) // eslint-disable-line react-hooks/exhaustive-deps

  const target = Number(amount)
  const byCourse = useMemo(() => { const m = {}; found.forEach(g => { const c = g.student.course || 'No course'; m[c] = (m[c] || 0) + 1 }); return m }, [found])
  const combinedCount = found.filter(g => addon.eligible(g.student)).length
  const verdict = g => {
    const r = std[String(g.student.gcc_no)]
    if (!r) return null
    const flatOnly = kind === 'flat' || (kind === 'all' && g.matches.every(m => m.kind === 'flat'))
    const want = flatOnly ? r.flatFee : r.courseFee
    if (!(want > 0)) return { t: 'no standard rate set', c: C.warn }
    if (Math.abs(want - target) < 0.5) return { t: `= standard ₹${fmt(want)}${r.addonFee ? ' (incl. add-on)' : ''}`, c: C.ok }
    return target > want ? { t: `₹${fmt(target - want)} above standard ₹${fmt(want)}`, c: C.warn } : { t: `₹${fmt(want - target)} below standard ₹${fmt(want)}`, c: C.bad }
  }

  const exportCsv = () => {
    const head = ['Name', 'GCC', 'Course', 'Batch', 'Hostel', 'Combined', 'Months at this amount', 'Other payments', 'Today standard']
    const lines = shown.map(g => { const v = verdict(g); return [g.student.name, g.student.gcc_no, g.student.course || '', g.student.batch || '', g.student.hostel_type || '', addon.eligible(g.student) ? 'Yes' : '', g.matches.map(m => `${MON[m.month] || m.month} ${m.year}`).join('; '), g.payments - g.matches.length, v ? v.t : ''] })
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv)
    a.download = `GNSI_students_paying_${Math.round(target)}.csv`
    a.click()
  }

  const inp = { height: 38, padding: '0 12px', border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#fff', color: C.ink }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="gp-card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>🔎 Who pays this amount?</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>Every student with fee payments of exactly this amount — to spot a Combined add-on, a wrong rate or a pattern.</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>Amount ₹<br /><input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inp, width: 130, fontWeight: 800, marginTop: 4 }} /></label>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>Fee type<br />
            <select value={kind} onChange={e => setKind(e.target.value)} style={{ ...inp, marginTop: 4 }}><option value="all">Course + flat</option><option value="course">Course fee only</option><option value="flat">Flat fee only</option></select></label>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>Session<br />
            <select value={session} onChange={e => setSession(e.target.value)} style={{ ...inp, marginTop: 4 }}><option value="">All sessions</option>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or GCC…" style={{ ...inp, flex: 1, minWidth: 160 }} />
          <button onClick={exportCsv} disabled={!shown.length} style={{ ...inp, cursor: shown.length ? 'pointer' : 'not-allowed', fontWeight: 700 }}>📥 Export {shown.length}</button>
        </div>
      </div>

      {err && <div style={{ color: C.bad, fontWeight: 600 }}>⚠ {err}</div>}
      {!rows && !err && <div style={{ color: C.sub, padding: 20 }}>⏳ Loading fee records…</div>}

      {rows && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="gp-card" style={{ padding: '12px 18px' }}><b style={{ fontSize: 26, color: C.navy }}>{found.length}</b><div style={{ fontSize: 12, color: C.sub }}>students paid ₹{fmt(target)}</div></div>
            <div className="gp-card" style={{ padding: '12px 18px' }}><b style={{ fontSize: 26, color: C.navy }}>{found.reduce((s, g) => s + g.matches.length, 0)}</b><div style={{ fontSize: 12, color: C.sub }}>payments of ₹{fmt(target)}</div></div>
            <div className="gp-card" style={{ padding: '12px 18px' }}><b style={{ fontSize: 26, color: '#5b21b6' }}>{combinedCount}</b><div style={{ fontSize: 12, color: C.sub }}>of them Combined</div></div>
            <div className="gp-card" style={{ padding: '12px 18px', flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>By course</div>
              {Object.entries(byCourse).sort((a, b) => b[1] - a[1]).map(([c, n]) => <span key={c} style={{ display: 'inline-block', marginRight: 10, fontSize: 13, fontWeight: 700, color: C.ink }}>{c} <span style={{ color: C.gold }}>{n}</span></span>)}
              {!found.length && <span style={{ fontSize: 13, color: C.sub }}>—</span>}
            </div>
          </div>

          <div className="gp-card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
              <thead><tr style={{ textAlign: 'left', color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                <th style={{ padding: '10px 14px' }}>Student</th><th>Course · batch</th><th>Months at ₹{fmt(target)}</th><th>Other payments</th><th>Today’s standard</th>
              </tr></thead>
              <tbody>
                {shown.slice(0, 300).map(g => {
                  const s = g.student, v = verdict(g), why = addon.eligible(s)
                  return (
                    <tr key={s.gcc_no} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ padding: '9px 14px' }}><b style={{ color: C.ink }}>{s.name}</b>{why && <span title={why === 'exam' ? 'Combined add-on — appears in the Exam Combined papers' : 'Combined add-on applies'} style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#5b21b6', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 3, padding: '1px 4px' }}>{why === 'exam' ? 'COMBINED·EXAM' : 'COMBINED'}</span>}<div style={{ fontSize: 11, color: C.sub }}>GCC-{s.gcc_no} · {s.hostel_type || '—'}</div></td>
                      <td>{s.course || '—'}{s.batch && s.batch !== '—' ? ` · ${s.batch}` : ''}</td>
                      <td><b>{g.matches.length}</b> <span style={{ color: C.sub, fontSize: 11.5 }}>{g.matches.slice(0, 4).map(m => `${MON[m.month] || m.month} ${String(m.year).slice(2)}`).join(', ')}{g.matches.length > 4 ? ` +${g.matches.length - 4}` : ''}</span></td>
                      <td style={{ color: C.sub }}>{g.payments - g.matches.length || '—'}</td>
                      <td style={{ fontWeight: 700, color: v ? v.c : C.sub }}>{v ? v.t : '…'}</td>
                    </tr>
                  )
                })}
                {!shown.length && <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: C.sub }}>No student has a payment of exactly ₹{fmt(target)}{session ? ` in ${session}` : ''}.</td></tr>}
              </tbody>
            </table>
            {shown.length > 300 && <div style={{ padding: '10px 14px', fontSize: 12, color: C.sub, borderTop: `1px solid ${C.line}` }}>Showing the first 300 of {shown.length} — narrow the search or export for the full list.</div>}
          </div>
        </>
      )}
    </div>
  )
}
