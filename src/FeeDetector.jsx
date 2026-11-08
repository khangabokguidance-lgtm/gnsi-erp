// FeeDetector.jsx — Fees → Discounts & Waivers → Detector (admin, read-only).
//   Repeaters : students flagged as repeater, flagged ones that still paid an admission fee,
//               and students NOT flagged who look like repeaters (same name + father on an older record).
//   Low fee   : students paying below the standard rate — custom/lower fee, approved or pending
//               concession, or the same short amount paid again and again with nothing on record.
// Same data pipeline as the Waivers report (FeeWaivers); nothing here changes any record.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getSessionYear } from './feeEngine'
import { loadAllFeeRows, buildAllLedgers } from './feeLedgerBulk'
import { fmt, shortSession } from './feeLedgerModel'
import { rateFrom } from './hostelFeeCheck'
import { useAddonResolver } from './useAddonResolver'
import { detectWaivers } from './lib/waiverDetect'
import { BOOKS_CSS } from './feeBooksCss'
import { LedgerLink } from './LedgerLinks'
import { canonicalBatch, courseOf } from './courseMap'

const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const crs = s => { const c = courseOf(s); return c === 'Unassigned' ? (s.course || '') : c }
const isActive = s => !s.deleted_at && (!s.status || s.status === 'Active')
const day = v => String(v || '').slice(0, 10)

export default function FeeDetector({ students }) {
  const session = getSessionYear()
  const addon = useAddonResolver()
  const pool = useMemo(() => (students || []).filter(s => !s.deleted_at && s.gcc_no), [students])
  const [mode, setMode] = useState('repeater')
  const [rows, setRows] = useState(null)
  const [structures, setStructures] = useState(null)
  const [built, setBuilt] = useState({ key: null, items: [] })
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [q, setQ] = useState('')

  useEffect(() => {
    let live = true
    Promise.all([loadAllFeeRows(), supabase.from('fee_structures').select('session_year, course, batch, hostel_type, flat_fee, course_fee')])
      .then(([r, st]) => { if (!live) return; if (st.error) throw new Error(st.error.message); setRows(r); setStructures(st.data || []); setError('') })
      .catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [reload])
  const key = rows ? `${reload}|${pool.length}` : null
  useEffect(() => {
    if (!rows) return
    let live = true
    buildAllLedgers(pool, session, { rows }).then(items => { if (live) setBuilt({ key: `${reload}|${pool.length}`, items }) }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [rows, pool, session, reload])
  const ready = built.key === key && !!structures

  // Repeaters
  const repeaterRows = useMemo(() => {
    if (!ready) return []
    const byPerson = new Map()
    for (const s of pool) {
      const k = norm(s.name) + '|' + norm(s.father_name)
      if (norm(s.name) && norm(s.father_name)) byPerson.set(k, [...(byPerson.get(k) || []), s])
    }
    const out = []
    for (const x of built.items) {
      const s = x.student
      if (!isActive(s)) continue
      const admPaid = Number(x.reg.admission?.paidAmt || 0)
      const twins = (byPerson.get(norm(s.name) + '|' + norm(s.father_name)) || []).filter(o => o.gcc_no !== s.gcc_no)
      const older = twins.filter(o => day(o.admission_date) && day(o.admission_date) < day(s.admission_date))
      if (s.is_repeater) out.push({ s, kind: admPaid > 0 ? 'check' : 'flagged', note: admPaid > 0 ? `Flagged repeater but paid admission fee ₹${fmt(admPaid)} — confirm status` : 'Flagged repeater — admission fee waived', admPaid })
      else if (older.length) out.push({ s, kind: 'likely', note: `Not flagged, but an older record exists: ${older.map(o => `GCC-${o.gcc_no} (${day(o.admission_date).slice(0, 4) || '—'})`).join(', ')}`, admPaid })
    }
    const rank = { check: 0, likely: 1, flagged: 2 }
    return out.sort((a, b) => rank[a.kind] - rank[b.kind] || String(a.s.name).localeCompare(String(b.s.name)))
  }, [ready, built, pool])

  // Low fee
  const lowRows = useMemo(() => {
    if (!ready) return []
    const rateOf = a => { const b = rateFrom(structures, a); return b > 0 && a.student ? b + addon.amount(a.student, a.session) : b }
    return built.items.filter(x => isActive(x.student)).map(x => detectWaivers(x, rateOf)).filter(d => d && (d.sources.custom || d.sources.approved || d.sources.pending || d.unrecorded.length))
      .map(d => ({ d, short: d.sources.custom + d.sources.approved + d.unrecorded.reduce((n, u) => n + u.shortBy, 0) }))
      .sort((a, b) => b.short - a.short)
  }, [ready, built, structures, addon])

  const t = q.trim().toLowerCase()
  const match = s => !t || [s.name, s.gcc_no, s.admission_no, s.father_name].some(v => String(v || '').toLowerCase().includes(t))
  const rep = repeaterRows.filter(r => match(r.s))
  const low = lowRows.filter(r => match(r.d.student))
  const cnt = k => repeaterRows.filter(r => r.kind === k).length
  const KIND = { check: ['⚠ Check', '#b42318', '#fee4e2'], likely: ['Possible repeater', '#9a5b00', '#fff4dc'], flagged: ['Repeater', '#0f766e', '#e8f7f4'] }

  return (
    <div className="fbk">
      <style>{BOOKS_CSS}</style>
      <div className="fbk-card">
        <div className="fbk-bar">
          <button className={'fbk-chip' + (mode === 'repeater' ? ' gold' : '')} onClick={() => setMode('repeater')}>🔁 Repeaters ({repeaterRows.length})</button>
          <button className={'fbk-chip' + (mode === 'low' ? ' gold' : '')} onClick={() => setMode('low')}>📉 Low-fee students ({lowRows.length})</button>
          <input className="fbk-in" style={{ flex: '1 1 180px' }} placeholder="Name, GCC, adm. no, father…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
          <button className="fbk-chip" onClick={() => { setRows(null); setStructures(null); setReload(n => n + 1) }}>↻ Refresh</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Session {shortSession(session)} · active students only · read-only</div>
      </div>
      {error && <div className="fbk-card" style={{ color: '#b42318' }}>{error}</div>}
      {!ready && !error && <div className="fbk-card fbk-empty">Scanning fee records…</div>}
      {ready && mode === 'repeater' && (
        <>
          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Flagged repeaters</b><span>{cnt('flagged') + cnt('check')}</span></div>
            <div className="fbk-kpi"><b>Flagged but paid admission</b><span style={{ color: cnt('check') ? '#b42318' : '#146c3a' }}>{cnt('check')}</span></div>
            <div className="fbk-kpi"><b>Possible, not flagged</b><span style={{ color: cnt('likely') ? '#9a5b00' : '#146c3a' }}>{cnt('likely')}</span><small>same name + father on an older record</small></div>
          </div>
          <div className="fbk-card" style={{ padding: 0 }}><div className="fbk-scroll" style={{ border: 'none', maxHeight: '70vh' }}>
            <table aria-label="Repeater detector">
              <thead><tr><th>#</th><th>Student</th><th>Course · Batch</th><th>Admitted</th><th>Status</th><th>Why</th></tr></thead>
              <tbody>
                {rep.length === 0 && <tr><td colSpan={6} className="fbk-empty">No repeaters found.</td></tr>}
                {rep.map((r, i) => { const [l, c, bg] = KIND[r.kind]; return (
                  <tr key={r.s.gcc_no}>
                    <td className="muted">{i + 1}</td>
                    <td><LedgerLink gcc={r.s.gcc_no} style={{ fontWeight: 700 }}>{r.s.name}</LedgerLink><div className="muted" style={{ fontSize: 11 }}>GCC-{r.s.gcc_no}{r.s.father_name ? ` · ${r.s.father_name}` : ''}</div></td>
                    <td>{[crs(r.s), canonicalBatch(r.s.batch)].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{day(r.s.admission_date) || '—'}</td>
                    <td><span style={{ fontSize: 10.5, fontWeight: 800, color: c, background: bg, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>{l}</span></td>
                    <td style={{ fontSize: 12 }}>{r.note}</td>
                  </tr>) })}
              </tbody>
            </table>
          </div></div>
          <div className="fbk-legend"><span>To flag or unflag a repeater, open the student's fee payment screen (admin). "Possible" matches are by name and father's name only — confirm before changing anyone.</span></div>
        </>
      )}
      {ready && mode === 'low' && (
        <>
          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Low-fee students</b><span>{lowRows.length}</span></div>
            <div className="fbk-kpi"><b>Total shortfall</b><span style={{ color: '#b42318' }}>₹{fmt(lowRows.reduce((n, r) => n + r.short, 0))}</span></div>
            <div className="fbk-kpi"><b>With nothing on record</b><span style={{ color: '#b42318' }}>{lowRows.filter(r => r.d.unrecorded.length).length}</span></div>
          </div>
          <div className="fbk-card" style={{ padding: 0 }}><div className="fbk-scroll" style={{ border: 'none', maxHeight: '70vh' }}>
            <table aria-label="Low fee detector">
              <thead><tr><th>#</th><th>Student</th><th>Course · Batch</th><th>Hostel</th><th className="num">Shortfall ₹</th><th>Reason</th></tr></thead>
              <tbody>
                {low.length === 0 && <tr><td colSpan={6} className="fbk-empty">No low-fee students found.</td></tr>}
                {low.map((r, i) => { const s = r.d.student; return (
                  <tr key={s.gcc_no}>
                    <td className="muted">{i + 1}</td>
                    <td><LedgerLink gcc={s.gcc_no} style={{ fontWeight: 700 }}>{s.name}</LedgerLink><div className="muted" style={{ fontSize: 11 }}>GCC-{s.gcc_no}</div></td>
                    <td>{[crs(s), canonicalBatch(s.batch)].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{s.hostel_type || '—'}</td>
                    <td className="num" style={{ fontWeight: 800 }}>{r.short ? fmt(r.short) : '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {r.d.sources.custom > 0 && <div>Custom / lower fee ₹{fmt(r.d.sources.custom)}</div>}
                      {r.d.sources.approved > 0 && <div>Approved concession ₹{fmt(r.d.sources.approved)}</div>}
                      {r.d.sources.pending > 0 && <div>Concession awaiting approval</div>}
                      {r.d.unrecorded.map(u => <div key={u.paid} style={{ color: '#b42318' }}>⚠ Pays ₹{fmt(u.paid)} of ₹{fmt(u.fee)} in {u.months.join(', ')} — no concession on record</div>)}
                    </td>
                  </tr>) })}
              </tbody>
            </table>
          </div></div>
        </>
      )}
    </div>
  )
}
