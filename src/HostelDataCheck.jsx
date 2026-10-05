// HostelDataCheck.jsx — premium "Hostel data" view for the Students module:
// Students ↔ hostel_allocations consistency (boarder vs day scholar, gender,
// fields missing from the allocation) with inline fixes. Logic lives in
// lib/hostelChecks.js; writes go through editEngine.editField (audit log +
// admissions sync) and hostelAllocation.allocateStudent (the one writer of
// hostel_allocations).
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { PremiumStyles, PremiumCard, PX } from './premiumUI'
import { editField } from './editEngine'
import { allocateStudent } from './hostelAllocation'
import { checkHostelData, ISSUES, GROUPS } from './lib/hostelChecks'

const COLS = 'student_id,student_name,gcc_no,class_name,hostel_name,room_number,bed_number,allotment_date,status'
const GENDER_C = { Male: '#3b82f6', Female: '#ec4899', unknown: '#cbd5e1' }
const isDayHouse = h => String(h || '').toLowerCase().replace(/[^a-z]/g, '') === 'dayscholar'

async function loadAllocations() {
  const PAGE = 1000
  let from = 0, all = []
  for (;;) {
    const { data, error } = await supabase.from('hostel_allocations').select(COLS).range(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < PAGE) return all
    from += PAGE
  }
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: PX.sub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function FixPanel({ row, houses, canPII, onDone }) {
  const { st, alloc, issues } = row
  const has = k => issues.some(i => i.key === k)
  const needGender = has('gender_missing') || has('gender_house_mismatch')
  const needType = has('type_missing') || has('type_house_conflict') || has('dayscholar_has_room')
  const needAlloc = ['boarder_no_allocation', 'boarder_no_house', 'room_missing', 'bed_missing', 'date_missing', 'status_missing', 'alloc_inactive'].some(has)
  const needContact = has('contact_missing') && canPII

  const [gender, setGender] = useState(st.gender || '')
  const [type, setType] = useState(st.hostel_type || '')
  const [house, setHouse] = useState(alloc?.hostel_name || (isDayHouse(st.house) ? '' : st.house) || '')
  const [room, setRoom] = useState(/^tbd$/i.test(alloc?.room_number || '') ? '' : alloc?.room_number || '')
  const [bed, setBed] = useState(alloc?.bed_number || '')
  const [date, setDate] = useState(alloc?.allotment_date ? String(alloc.allotment_date).slice(0, 10) : '')
  const [contact, setContact] = useState(st.emergency_contact || '')
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)
  const ctx = { id: st.id, name: st.name, gcc_no: st.gcc_no }

  const run = async (name, fn) => {
    setBusy(name); setErr(null)
    try { await fn() } catch (e) { setErr(e?.message || 'Save failed — try again.') }
    setBusy(null)
  }
  const saveField = (name, field, value, patchKey = field) => run(name, async () => {
    if (!String(value).trim()) throw new Error('Enter a value first.')
    await editField({ tableKey: 'students', rowId: st.id, field, oldValue: st[field] ?? null, newValue: String(value).trim(), studentContext: ctx })
    onDone({ student: { [patchKey]: String(value).trim() } })
  })
  const saveAlloc = () => run('alloc', async () => {
    if (!house) throw new Error('Choose a house.')
    if (!room.trim()) throw new Error('Enter the room number.')
    await allocateStudent(st, { hostelName: house, roomNumber: room.trim(), bedNumber: bed.trim() || null, allotmentDate: date || null, status: 'Active' })
    onDone({ student: { house }, alloc: { student_id: st.id, hostel_name: house, room_number: room.trim(), bed_number: bed.trim() || null, allotment_date: date || new Date().toLocaleDateString('en-CA'), status: 'Active' } })
  })
  const Save = ({ name, onClick, disabled }) => <button type="button" className="px-btn" disabled={busy === name || disabled} onClick={onClick}>{busy === name ? 'Saving…' : 'Save'}</button>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
      {needGender && (
        <Field label="Gender">
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="px-input" value={gender} onChange={e => setGender(e.target.value)} aria-label="Gender"><option value="">Choose…</option><option>Male</option><option>Female</option><option>Other</option></select>
            <Save name="gender" disabled={!gender} onClick={() => saveField('gender', 'gender', gender)} />
          </div>
          {has('gender_house_mismatch') && <div style={{ fontSize: 11.5, color: PX.warn, marginTop: 5 }}>Most students in {st.house} are the other gender — confirm this is right, or move the student.</div>}
        </Field>
      )}
      {needType && (
        <Field label="Hostel type">
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="px-input" value={type} onChange={e => setType(e.target.value)} aria-label="Hostel type"><option value="">Choose…</option><option>Boarder</option><option>Day Boarder</option><option>Day Scholar</option></select>
            <Save name="type" disabled={!type} onClick={() => saveField('type', 'hostel_type', type)} />
          </div>
        </Field>
      )}
      {needContact && (
        <Field label="Emergency contact">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="px-input" value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone number" aria-label="Emergency contact" />
            <Save name="contact" disabled={!contact.trim()} onClick={() => saveField('contact', 'emergency_contact', contact)} />
          </div>
        </Field>
      )}
      {needAlloc && (
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, alignItems: 'end' }}>
          <Field label="House"><select className="px-input" value={house} onChange={e => setHouse(e.target.value)} aria-label="House"><option value="">Choose…</option>{houses.map(h => <option key={h}>{h}</option>)}</select></Field>
          <Field label="Room no."><input className="px-input" value={room} onChange={e => setRoom(e.target.value)} aria-label="Room number" /></Field>
          <Field label="Bed no."><input className="px-input" value={bed} onChange={e => setBed(e.target.value)} aria-label="Bed number" /></Field>
          <Field label="Allotment date"><input className="px-input" type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Allotment date" /></Field>
          <Save name="alloc" onClick={saveAlloc} />
        </div>
      )}
      {err && <div role="alert" style={{ gridColumn: '1 / -1', fontSize: 12, color: PX.bad }}>{err}</div>}
    </div>
  )
}

export default function HostelDataCheck({ students = [], canWrite = false, viewPII = false }) {
  const [allocs, setAllocs] = useState(null)   // null = loading
  const [loadErr, setLoadErr] = useState(null)
  const [patches, setPatches] = useState({})   // student id -> column patch
  const [allocPatch, setAllocPatch] = useState({})
  const [filter, setFilter] = useState(null)   // issue key
  const [group, setGroup] = useState(null)
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')

  const load = useCallback(() => {
    setAllocs(null); setLoadErr(null)
    loadAllocations().then(setAllocs).catch(e => { setLoadErr(e?.message || 'Could not load hostel allocations.'); setAllocs([]) })
  }, [])
  useEffect(load, [load])

  const active = useMemo(() => students.filter(s => !s.deleted_at && (!s.status || String(s.status).toLowerCase() === 'active')).map(s => (patches[s.id] ? { ...s, ...patches[s.id] } : s)), [students, patches])
  const allocRows = useMemo(() => (allocs || []).map(a => (allocPatch[a.student_id] ? { ...a, ...allocPatch[a.student_id] } : a)).concat(Object.values(allocPatch).filter(p => !(allocs || []).some(a => a.student_id === p.student_id))), [allocs, allocPatch])
  const res = useMemo(() => checkHostelData(active, allocRows, { viewPII }), [active, allocRows, viewPII])
  const houses = useMemo(() => [...new Set([...active.map(s => s.house), ...allocRows.map(a => a.hostel_name)].filter(h => h && !isDayHouse(h)))].sort(), [active, allocRows])
  const mixRows = Object.values(res.mix).sort((a, b) => a.house.localeCompare(b.house))

  const needle = q.trim().toLowerCase()
  const shown = res.rows.filter(r => {
    if (filter && !r.issues.some(i => i.key === filter)) return false
    if (group && !r.issues.some(i => i.group === group)) return false
    return !needle || [r.st.name, r.st.gcc_no, r.st.house].some(v => String(v ?? '').toLowerCase().includes(needle))
  })
  const groupCount = g => res.rows.filter(r => r.issues.some(i => i.group === g)).length

  const stat = (label, value, sub, tone) => (
    <div style={{ background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 14, padding: '12px 16px', boxShadow: '0 1px 2px rgba(19,42,79,.05)' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub }}>{label}</div>
      <div style={{ fontFamily: PX.serif, fontSize: 28, fontWeight: 600, color: tone || PX.ink, marginTop: 4, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 4 }}>{sub}</div>
    </div>
  )

  return (
    <div className="px-root" style={{ minHeight: 0, background: 'transparent' }}>
      <PremiumStyles />
      <style>{`.hdc-table{min-width:720px}.hdc-show-sm{display:none}@media (max-width:640px){.hdc-table{min-width:0}.hdc-table td{min-width:0!important}.hdc-hide-sm{display:none}.hdc-show-sm{display:block!important}.hdc-table td,.hdc-table th{padding-left:10px;padding-right:10px}}`}</style>
      {loadErr && <div role="alert" style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 12, background: PX.badBg, color: PX.bad, fontSize: 12.5 }}>⚠ {loadErr} Checks below only use student records.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 16 }}>
        {stat('Boarders', res.boarders, `${res.withAlloc} hold a hostel allocation`)}
        {stat('Allocation completeness', allocs === null ? '…' : `${res.allocCompleteness}%`, 'room · bed · date · status', res.allocCompleteness >= 90 ? PX.ok : res.allocCompleteness >= 70 ? PX.warn : PX.bad)}
        {stat('Students to review', res.issueStudents, `${res.rows.reduce((n, r) => n + r.issues.length, 0)} open issues`, res.issueStudents ? PX.bad : PX.ok)}
        {stat('Houses checked', mixRows.length, `${mixRows.filter(m => m.majority).length} single-gender`)}
      </div>

      <PremiumCard title="Gender mix by house" subtitle="A student of the minority gender in a clearly single-gender house is flagged for review" style={{ marginBottom: 16 }}>
        {mixRows.length === 0 ? <div style={{ fontSize: 12.5, color: PX.faint }}>No boarders with a house yet.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '12px 28px' }}>
            {mixRows.map(m => (
              <div key={m.house}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                  <b>{m.house}</b>
                  <span style={{ color: PX.sub, fontVariantNumeric: 'tabular-nums' }}>♂ {m.Male} · ♀ {m.Female}{m.unknown ? ` · ? ${m.unknown}` : ''}</span>
                </div>
                <div role="img" aria-label={`${m.house}: ${m.Male} male, ${m.Female} female, ${m.unknown} unknown`} style={{ display: 'flex', height: 9, borderRadius: 5, overflow: 'hidden', background: PX.line }}>
                  {['Male', 'Female', 'unknown'].map(k => m[k] ? <i key={k} style={{ width: `${(m[k] / m.total) * 100}%`, background: GENDER_C[k], display: 'block' }} /> : null)}
                </div>
                {m.majority && m[m.minority] > 0 && <div style={{ fontSize: 11, color: PX.warn, marginTop: 4 }}>{m[m.minority]} {m.minority.toLowerCase()} in a mostly {m.majority.toLowerCase()} house — review</div>}
              </div>
            ))}
          </div>
        )}
      </PremiumCard>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }} role="group" aria-label="Filter by area">
        {Object.entries(GROUPS).map(([g, label]) => {
          const n = groupCount(g), on = group === g
          return <button key={g} type="button" aria-pressed={on} onClick={() => { setGroup(on ? null : g); setFilter(null); setOpen(null) }}
            style={{ padding: '7px 14px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, border: `1px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.ink2 }}>
            {label} <span style={{ opacity: .75, fontVariantNumeric: 'tabular-nums' }}>{n}</span></button>
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10, marginBottom: 16 }}>
        {Object.entries(ISSUES).filter(([, v]) => !group || v.group === group).map(([k, v]) => {
          const n = res.counts[k] || 0, on = filter === k
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => { setFilter(on ? null : k); setOpen(null) }}
              style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? PX.navy : PX.line}`, background: on ? '#eef2fa' : '#fff' }}>
              <span style={{ fontFamily: PX.serif, fontSize: 22, fontWeight: 600, color: n ? (v.level === 'red' ? PX.bad : PX.warn) : PX.ok }}>{n || '✓'}</span>
              <div style={{ fontSize: 12, fontWeight: 600, color: PX.ink2, marginTop: 2 }}>{v.label}</div>
            </button>
          )
        })}
      </div>

      <PremiumCard title={`Students to review (${shown.length})`} subtitle={canWrite ? 'Press Fix to correct a record without leaving this screen' : 'View only — editing needs write access'}
        right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: '1 1 220px', justifyContent: 'flex-end' }}>
          <input className="px-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / GCC / house…" aria-label="Search students" style={{ flex: '1 1 160px', minWidth: 0, maxWidth: 260 }} />
          <button type="button" className="px-btn ghost" onClick={load}>↻ Refresh</button>
        </div>} bodyStyle={{ padding: 0 }}>
        {allocs === null ? <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>Loading hostel allocations…</div>
          : shown.length === 0 ? <div style={{ padding: 44, textAlign: 'center', color: PX.ok, fontWeight: 700 }}>✓ Nothing to review — hostel data looks consistent.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="px-table hdc-table">
                <thead><tr>{['Student', 'House', 'Type', 'Gender', 'Issues', ''].map(h => <th key={h} className={['Type', 'House', 'Gender'].includes(h) ? 'hdc-hide-sm' : undefined}>{h}</th>)}</tr></thead>
                <tbody>
                  {shown.slice(0, 300).map(r => {
                    const id = r.st.id, isOpen = open === id
                    return [
                      <tr key={id}>
                        <td><b>{r.st.name}</b><div style={{ fontSize: 11.5, color: PX.faint }}>GCC-{r.st.gcc_no || '—'} · {r.st.batch || r.st.class_name || '—'}</div><div className="hdc-show-sm" style={{ fontSize: 11.5, color: PX.sub }}>{[r.st.house, r.st.hostel_type, r.st.gender].filter(Boolean).join(' · ')}</div></td>
                        <td className="hdc-hide-sm">{r.st.house || '—'}</td>
                        <td className="hdc-hide-sm">{r.st.hostel_type || '—'}</td>
                        <td className="hdc-hide-sm">{r.st.gender || '—'}</td>
                        <td style={{ whiteSpace: 'normal', minWidth: 240 }}>
                          {r.issues.map(i => <span key={i.key} style={{ display: 'inline-block', margin: '2px 4px 2px 0', padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: i.level === 'red' ? PX.badBg : PX.warnBg, color: i.level === 'red' ? PX.bad : PX.warn }}>{i.label}</span>)}
                        </td>
                        <td style={{ textAlign: 'right' }}>{canWrite && <button type="button" className={isOpen ? 'px-btn ghost' : 'px-btn'} style={{ padding: '6px 14px', fontSize: 12.5 }} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>{isOpen ? 'Close' : 'Fix'}</button>}</td>
                      </tr>,
                      isOpen && (
                        <tr key={id + '-fix'}><td colSpan={6} style={{ background: PX.tint, padding: '14px 18px' }}>
                          <FixPanel row={r} houses={houses} canPII={viewPII}
                            onDone={({ student, alloc }) => { setPatches(p => ({ ...p, [id]: { ...p[id], ...student } })); if (alloc) setAllocPatch(p => ({ ...p, [id]: alloc })); }} />
                        </td></tr>
                      ),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )}
        {shown.length > 300 && <div style={{ padding: '10px 20px', fontSize: 11.5, color: PX.sub }}>Showing first 300 — narrow with a filter or search.</div>}
      </PremiumCard>
    </div>
  )
}
