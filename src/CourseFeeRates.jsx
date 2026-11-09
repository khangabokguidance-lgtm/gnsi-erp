// CourseFeeRates.jsx — the Fees tab of the Courses module. It shows the REAL fee rates the Fees
// module charges (fee_structures, set in Fee → Fee Setup), grouped by course, batch and hostel
// type for a session. Read-only: the Courses module used to keep a second fee table
// (course_fees) that nothing charged from, so the two could disagree.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { COURSE_ORDER, canonicalBatch } from './courseMap'
import { getSessionYear, getCombinedAddonFee } from './feeEngine'

const inr = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const HOSTELS = ['Boarder', 'Day Boarder', 'Day Scholar']

export default function CourseFeeRates({ isMobile }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [session, setSession] = useState(getSessionYear())
  const [sessions, setSessions] = useState([getSessionYear()])

  useEffect(() => {
    let live = true
    Promise.resolve(supabase.from('fee_structures').select('session_year, course, batch, hostel_type, flat_fee, course_fee, admission_fee')).then(({ data, error }) => {
      if (!live) return
      if (error) { setErr(error.message); setRows([]); return }
      setRows(data || [])
      const all = [...new Set([getSessionYear(), ...(data || []).map(r => r.session_year).filter(Boolean)])].sort().reverse()
      setSessions(all)
    }).catch(e => { if (live) { setErr(e.message || 'Could not load fee rates'); setRows([]) } })
    return () => { live = false }
  }, [])

  // Combined Course students also pay a monthly add-on (set in Fee Setup) on top of these rates
  const [addon, setAddon] = useState(0)
  useEffect(() => {
    let live = true
    getCombinedAddonFee(session).then(n => { if (live) setAddon(n) }).catch(() => {})
    return () => { live = false }
  }, [session])

  // course → batch → hostel → row (batches under their standard names)
  const tree = useMemo(() => {
    const t = {}
    for (const r of (rows || []).filter(x => x.session_year === session)) {
      const batch = canonicalBatch(r.batch) || r.batch || '—'
      ;((t[r.course] ||= {})[batch] ||= {})[r.hostel_type] = r
    }
    return t
  }, [rows, session])
  const courses = [...COURSE_ORDER.filter(c => tree[c]), ...Object.keys(tree).filter(c => !COURSE_ORDER.includes(c))]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Fee rates charged by the Fees module</div>
          <div style={{ fontSize: 12, color: '#5d6b82', marginTop: 2 }}>Read-only. To change a rate, use Fees → Fee Setup — that is the table every fee, due and receipt is calculated from.</div>
        </div>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Session{' '}
          <select value={session} onChange={e => setSession(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d9d2c2' }}>
            {sessions.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {err && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load fee rates: {err}</div>}
      {rows === null && <div style={{ fontSize: 13 }}>Loading…</div>}
      {rows && !courses.length && !err && <div style={{ fontSize: 13, padding: 16, background: '#faf8f3', borderRadius: 10 }}>No fee rates are set for {session} yet. Set them in Fees → Fee Setup.</div>}
      {courses.map(course => (
        <div key={course} style={{ background: '#fff', border: '1px solid #e8e3d8', borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#faf8f3', borderBottom: '1px solid #e8e3d8', fontWeight: 800 }}>{course}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: isMobile ? 520 : 0 }}>
              <thead><tr style={{ textAlign: 'left', color: '#5d6b82' }}>
                <th style={{ padding: '8px 12px' }}>Batch</th><th>Hostel type</th>
                <th style={{ textAlign: 'right' }}>Admission</th><th style={{ textAlign: 'right' }}>Flat fee (Feb–Mar)</th><th style={{ textAlign: 'right', paddingRight: 12 }}>Monthly course fee</th>
              </tr></thead>
              <tbody>
                {Object.entries(tree[course]).flatMap(([batch, byHostel]) =>
                  [...HOSTELS, ...Object.keys(byHostel).filter(h => !HOSTELS.includes(h))].filter(h => byHostel[h]).map((h, i) => (
                    <tr key={batch + h} style={{ borderTop: '1px solid #f3f0e8' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>{i === 0 ? (batch === '—' ? 'All batches' : batch) : ''}</td>
                      <td>{h}</td>
                      <td style={{ textAlign: 'right' }}>{inr(byHostel[h].admission_fee)}</td>
                      <td style={{ textAlign: 'right' }}>{inr(byHostel[h].flat_fee)}</td>
                      <td style={{ textAlign: 'right', paddingRight: 12 }}>{inr(byHostel[h].course_fee)}</td>
                    </tr>)))}
              </tbody>
            </table>
          </div>
          {course === 'Combined Course' && addon > 0 && (
            <div style={{ padding: '9px 16px', background: '#fff9ec', borderTop: '1px solid #eadbb2', fontSize: 12.5, color: '#7a4a00' }}>
              ➕ Plus a <b>{inr(addon)} / month Combined add-on</b> on top of every fee above (course fee and flat fee), charged to students who are Combined by course or tagged in the Exam Combined papers.
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
