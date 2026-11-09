// FeeWaivers.jsx — Waivers & Concessions: every student who gets a fee waiver or
// concession, detected from each fee type (course fee, flat fee, admission) in
// the fee register, with where it comes from. Also flags students who keep
// paying the same reduced amount with no concession on record.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getSessionYear } from './feeEngine'
import { loadAllFeeRows, buildAllLedgers } from './feeLedgerBulk'
import { fmt, shortSession } from './feeLedgerModel'
import { rateFrom } from './hostelFeeCheck'
import { useAddonResolver } from './useAddonResolver'
import { detectWaivers, waiverTags, SOURCE_LABEL } from './lib/waiverDetect'
import { printWaivers, exportWaiversExcel } from './feeBooks'
import { BOOKS_CSS } from './feeBooksCss'
import { LedgerLink } from './LedgerLinks'
import { canonicalBatch, courseOf } from './courseMap'

const crs = s => { const c = courseOf(s); return c === 'Unassigned' ? (s.course || '') : c }
const uniq = xs => [...new Set(xs.filter(Boolean))].sort()
const isActive = s => !s.deleted_at && (!s.status || s.status === 'Active')
const TAG_STYLE = { approved: ['#146c3a', '#e7f6ec'], standing: ['#1e3a6e', '#eef2f9'], custom: ['#7c3aed', '#f3efff'], writtenOff: ['#475569', '#f1f5f9'], pending: ['#9a5b00', '#fff4dc'], repeater: ['#0f766e', '#e8f7f4'] }
const Tag = ({ t }) => { const [c, bg] = TAG_STYLE[t]; return <span style={{ fontSize: 10.5, fontWeight: 800, color: c, background: bg, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap', marginRight: 4 }}>{SOURCE_LABEL[t]}</span> }

export default function FeeWaivers({ students }) {
  const current = getSessionYear()
  const sessions = useMemo(() => { const y = Number(current.slice(0, 4)); return [0, 1, 2].map(k => `${y - k}-${y - k + 1}`) }, [current])
  const [session, setSession] = useState(current)
  const [rows, setRows] = useState(null)
  const [structures, setStructures] = useState(null)
  const [built, setBuilt] = useState({ key: null, items: [] })
  const [progress, setProgress] = useState('Loading fee records…')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [course, setCourse] = useState('All')
  const [batch, setBatch] = useState('All')
  const [hostel, setHostel] = useState('All')
  const [who, setWho] = useState('active')
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')

  const addon = useAddonResolver()   // Combined students pay the monthly add-on on top of the standard rate
  const pool = useMemo(() => (students || []).filter(s => !s.deleted_at && s.gcc_no), [students])

  useEffect(() => {
    let live = true
    Promise.all([loadAllFeeRows(), supabase.from('fee_structures').select('session_year, course, batch, hostel_type, flat_fee, course_fee')])
      .then(([r, st]) => { if (!live) return; if (st.error) throw new Error(st.error.message); setRows(r); setStructures(st.data || []); setError('') })
      .catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [reload])

  const key = rows ? `${session}|${reload}|${pool.length}` : null
  useEffect(() => {
    if (!rows) return
    let live = true
    buildAllLedgers(pool, session, { rows, onProgress: m => live && setProgress(m) })
      .then(items => { if (live) setBuilt({ key: `${session}|${reload}|${pool.length}`, items }) })
      .catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [rows, pool, session, reload])
  const ready = built.key === key && !!structures

  const courses = useMemo(() => uniq(pool.map(crs)), [pool])
  const batches = useMemo(() => uniq(pool.filter(s => course === 'All' || crs(s) === course).map(s => canonicalBatch(s.batch))), [pool, course])
  const hostels = useMemo(() => uniq(pool.map(s => s.hostel_type)), [pool])

  const detected = useMemo(() => {
    if (!ready) return []
    const rateOf = a => { const b = rateFrom(structures, a); return b > 0 && a.student ? b + addon.amount(a.student, a.session) : b }
    return built.items.filter(x => (who === 'all' || isActive(x.student)) && (course === 'All' || crs(x.student) === course) && (batch === 'All' || canonicalBatch(x.student.batch) === batch) && (hostel === 'All' || x.student.hostel_type === hostel))
      .map(x => detectWaivers(x, rateOf)).filter(Boolean)
  }, [ready, built, structures, who, course, batch, hostel, addon])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return detected.filter(d => (kind === 'all' || (kind === 'unrecorded' ? d.unrecorded.length > 0 : waiverTags(d).includes(kind)))
      && (!t || [d.student.name, d.student.gcc_no, d.student.admission_no, d.student.father_name].some(v => String(v || '').toLowerCase().includes(t))))
      .sort((a, b) => b.waived - a.waived || b.unrecorded.length - a.unrecorded.length)
  }, [detected, kind, q])

  const total = list.reduce((s, d) => s + d.waived, 0)
  const sum = f => list.reduce((s, d) => s + f(d), 0)
  const count = k => detected.filter(d => (k === 'unrecorded' ? d.unrecorded.length > 0 : waiverTags(d).includes(k))).length
  const scope = [course !== 'All' && course, batch !== 'All' && batch, hostel !== 'All' && hostel, who === 'all' && 'incl. inactive'].filter(Boolean).join(' · ')
  const sel = (lbl, value, set, opts, extra) => (
    <label className="fbk-lbl">{lbl}<select className="fbk-in" value={value} onChange={e => { set(e.target.value); extra?.() }}>{opts.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>)}</select></label>
  )

  return (
    <div className="fbk">
      <style>{BOOKS_CSS}</style>
      <div className="fbk-card">
        <div className="fbk-bar" style={{ alignItems: 'flex-end' }}>
          {sel('Session', session, setSession, sessions.map(s => [s, shortSession(s)]))}
          {sel('Course', course, setCourse, ['All', ...courses], () => setBatch('All'))}
          {sel('Batch', batch, setBatch, ['All', ...batches])}
          {sel('Hostel', hostel, setHostel, ['All', ...hostels])}
          {sel('Students', who, setWho, [['active', 'Active only'], ['all', 'All (incl. inactive)']])}
          {sel('Type', kind, setKind, [['all', 'All detected'], ['approved', `Approved concession (${count('approved')})`], ['standing', `Standing scholarship (${count('standing')})`], ['custom', `Custom / lower fee (${count('custom')})`], ['writtenOff', `Dues written off (${count('writtenOff')})`], ['pending', `Pending approval (${count('pending')})`], ['repeater', `Repeaters (${count('repeater')})`], ['unrecorded', `⚠ Unrecorded pattern (${count('unrecorded')})`]])}
          <label className="fbk-lbl" style={{ flex: '1 1 170px' }}>Search<input className="fbk-in" placeholder="Name, GCC, adm. no…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search waivers" /></label>
        </div>
        <div className="fbk-bar" style={{ marginTop: 12 }}>
          <button className="fbk-chip gold" disabled={!ready} onClick={() => printWaivers(list, session, scope)}>🖨️ Print list</button>
          <button className="fbk-chip gold" disabled={!ready} onClick={() => exportWaiversExcel(list, session)}>📊 Excel</button>
          <button className="fbk-chip" onClick={() => { setRows(null); setStructures(null); setReload(n => n + 1) }}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="fbk-card" style={{ color: '#b42318' }}>{error}</div>}
      {!ready && !error && <div className="fbk-card fbk-empty">{progress}</div>}
      {ready && (
        <>
          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Students detected</b><span>{list.length}</span><small>{scope || 'all courses'} · {shortSession(session)}</small></div>
            <div className="fbk-kpi"><b>Total waived</b><span style={{ color: '#146c3a' }}>₹{fmt(total)}</span><small>course ₹{fmt(sum(d => d.byType.course))} · flat ₹{fmt(sum(d => d.byType.flat))}</small></div>
            <div className="fbk-kpi"><b>Written off</b><span>₹{fmt(sum(d => d.sources.writtenOff))}</span><small>Refunds &amp; Transfers</small></div>
            <div className="fbk-kpi"><b>Unrecorded pattern</b><span style={{ color: count('unrecorded') ? '#b42318' : '#146c3a' }}>{count('unrecorded')}</span><small>same reduced amount, no concession</small></div>
          </div>
          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll" style={{ border: 'none', maxHeight: '70vh' }}>
              <table aria-label="Fee waivers and concessions">
                <thead><tr><th>#</th><th>Student</th><th>Course · Batch</th><th>Hostel</th><th className="num">Course fee ₹</th><th className="num">Flat fee ₹</th><th className="num">Total ₹</th><th>Source</th></tr></thead>
                <tbody>
                  {list.length === 0 && <tr><td colSpan={8} className="fbk-empty">No waivers or concessions detected for these filters.</td></tr>}
                  {list.map((d, i) => (
                    <tr key={d.student.gcc_no}>
                      <td className="muted">{i + 1}</td>
                      <td><LedgerLink gcc={d.student.gcc_no} style={{ fontWeight: 700 }}>{d.student.name}</LedgerLink><div className="muted" style={{ fontSize: 11 }}>GCC-{d.student.gcc_no}</div></td>
                      <td>{[crs(d.student), d.student.batch].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{d.student.hostel_type || '—'}</td>
                      <td className="num">{d.byType.course ? fmt(d.byType.course) : '—'}</td>
                      <td className="num">{d.byType.flat ? fmt(d.byType.flat) : '—'}</td>
                      <td className="num" style={{ fontWeight: 800, color: '#146c3a' }}>{d.waived ? fmt(d.waived) : '—'}</td>
                      <td>
                        {waiverTags(d).map(t => <Tag key={t} t={t} />)}
                        {d.unrecorded.map(u => <div key={u.paid} style={{ fontSize: 11.5, color: '#b42318', marginTop: 3 }}>⚠ Pays ₹{fmt(u.paid)} of ₹{fmt(u.fee)} in {u.months.join(', ')} — ₹{fmt(u.shortBy)} short, no concession on record. Enter a concession or custom fee if this was agreed.</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {list.length > 0 && <tfoot><tr><td colSpan={6}>Total — {list.length} student{list.length === 1 ? '' : 's'}</td><td className="num">₹{fmt(total)}</td><td /></tr></tfoot>}
              </table>
            </div>
          </div>
          <div className="fbk-legend"><span>Read from each student's fee register. Custom / lower fee = a month charged below the standard rate for the student's hostel type. Part payments still owing are not waivers. Admission-fee waivers are shown for repeaters only. Click a name to open the ledger.</span></div>
        </>
      )}
    </div>
  )
}
