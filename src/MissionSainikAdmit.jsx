// MissionSainikAdmit.jsx — Admit cards for the Mission Sainik mock tests (Pre Mock and Mega Mock): pick the test, set the time and hall,
// choose the students (Sainik + Combined course, from Students) and print the cards in the institute's standard admit card design.
import { useMemo, useState } from 'react'
import { PremiumCard, PX } from './premiumUI'
import { Avatar } from './MissionSainikUI'
import { useSainikRoster } from './useSainikRoster'
import { generateAdmitCardHTML, openAdmitCardPrintWindow } from './admitCardTemplate'
import { filterRoster, rosterCounts } from './lib/missionSainikStudents'
import { EXAM_KINDS, admitSchedule, admitTitle } from './lib/missionSainikExam'

const fmtDay = iso => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function MissionSainikAdmit({ institute, setMsg, isMobile, today = '' }) {
  const roster = useSainikRoster({ photos: false })
  const [kind, setKind] = useState('pre')
  const tests = useMemo(() => EXAM_KINDS[kind].tests(), [kind])
  const [testNo, setTestNo] = useState(() => (EXAM_KINDS.pre.tests().find(t => t.date >= today) || EXAM_KINDS.pre.tests()[0]).no)
  const test = tests.find(t => t.no === Number(testNo)) || tests[0]
  const [time, setTime] = useState('10:00 AM')
  const [room, setRoom] = useState('')
  const [shift, setShift] = useState('Morning')
  const [batchKey, setBatchKey] = useState('')
  const [q, setQ] = useState('')
  const [off, setOff] = useState(() => new Set())            // students left out (everyone is on by default)

  const counts = useMemo(() => rosterCounts(roster || [], 'all'), [roster])
  const shown = useMemo(() => filterRoster(roster || [], { batchKey, q }), [roster, batchKey, q])
  const chosen = shown.filter(r => !off.has(r.id))
  const chip = on => ({ padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
  const switchKind = k => { setKind(k); const t = EXAM_KINDS[k].tests(); setTestNo((t.find(x => x.date >= today) || t[0]).no) }
  const toggle = id => setOff(o => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allOn = shown.length > 0 && shown.every(r => !off.has(r.id))
  const toggleAll = () => setOff(o => { const n = new Set(o); shown.forEach(r => (allOn ? n.add(r.id) : n.delete(r.id))); return n })

  const print = list => {
    if (!list.length) return setMsg?.('❌ Tick at least one student.')
    const schedule = admitSchedule(kind, test, { time, room, shift })
    const html = list.map(r => generateAdmitCardHTML({ name: r.name, gcc_no: r.gcc, admission_no: r.admissionNo, course: 'Sainik', class_name: r.batch }, { examTypeName: admitTitle(kind, test), examSchedule: schedule, institute, course: 'Sainik' }))
    openAdmitCardPrintWindow(html, `Admit cards · ${admitTitle(kind, test)}`)
  }
  const lab = { fontSize: 12, fontWeight: 700, color: PX.sub, display: 'block' }

  return (
    <>
      <PremiumCard title="Admit cards" subtitle="Print admit cards for a Pre Mock or Mega Mock test, in the institute's standard admit card design.">
        <div role="tablist" aria-label="Test series" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(EXAM_KINDS).map(([k, v]) => <button key={k} type="button" role="tab" aria-selected={kind === k} style={chip(kind === k)} onClick={() => switchKind(k)}>{v.label}</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.4fr 1fr 1fr 1fr', gap: 10 }}>
          <label style={lab}>Test<select className="px-input" value={test.no} onChange={e => setTestNo(Number(e.target.value))}>{tests.map(t => <option key={t.no} value={t.no}>{t.id} · {fmtDay(t.date)}</option>)}</select></label>
          <label style={lab}>Time<input className="px-input" value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 10:00 AM" /></label>
          <label style={lab}>Hall / room<input className="px-input" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Hall A" /></label>
          <label style={lab}>Shift<select className="px-input" value={shift} onChange={e => setShift(e.target.value)}><option>Morning</option><option>Afternoon</option></select></label>
        </div>
      </PremiumCard>
      <PremiumCard title="Students" subtitle={roster === null ? 'Loading students…' : `${chosen.length} of ${shown.length} ticked · every Sainik and Combined course student`}
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="px-hbtn" disabled={!chosen.length} onClick={() => print(chosen.slice(0, 1))}>👁 Preview one</button>
          <button type="button" className="px-btn gold" disabled={!chosen.length} onClick={() => print(chosen)}>🪪 Print {chosen.length} admit card{chosen.length === 1 ? '' : 's'}</button>
        </span>}>
        {counts.batches.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" style={chip(!batchKey)} onClick={() => setBatchKey('')}>Every batch · {counts.all}</button>
            {counts.batches.map(b => <button key={b.key} type="button" style={chip(batchKey === b.key)} onClick={() => setBatchKey(batchKey === b.key ? '' : b.key)}>{b.label} · {b.n}</button>)}
          </div>)}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <input className="px-input" type="search" aria-label="Search students" placeholder="🔍 Search name, GCC number…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: '1 1 220px' }} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, color: PX.ink }}><input type="checkbox" checked={allOn} onChange={toggleAll} /> Tick all shown</label>
        </div>
        {roster !== null && !shown.length ? <div style={{ padding: 16, color: PX.sub }}>No student matches.</div> : (
          <div style={{ display: 'grid', gap: 6, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))' }}>
            {shown.map(r => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${off.has(r.id) ? PX.line : '#bfe3cc'}`, borderRadius: 14, background: off.has(r.id) ? '#fff' : '#f3fbf6', cursor: 'pointer' }}>
                <input type="checkbox" checked={!off.has(r.id)} onChange={() => toggle(r.id)} />
                <Avatar name={r.name} size={36} staff={false} />
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', fontSize: 13.5, color: PX.ink }}>{r.name}</b><small style={{ color: PX.sub }}>{[r.gcc && 'GCC ' + r.gcc, r.batch].filter(Boolean).join(' · ')}</small></span>
              </label>))}
          </div>)}
      </PremiumCard>
    </>
  )
}
