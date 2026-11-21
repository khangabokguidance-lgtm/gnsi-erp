// MissionSainikStudents.jsx — "Students" in Mission Sainik: every Sainik student (Achiever, Leader, Champion) and the Combined Course
// students, read live from Students. Views: All, Sainik, Combined course; chips per batch; search; print, CSV and Word.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getActiveStudents } from './studentQueries'
import { PremiumCard, PX } from './premiumUI'
import { Avatar, Pill } from './MissionSainikUI'
import { downloadCsv } from './lib/missionSainikExport'
import { printPremium } from './lib/printPremium'
import { buildTableDocx, downloadDocx } from './lib/missionSainikDocx'
import { sainikRoster, filterRoster, rosterCounts, SAINIK_VIEWS } from './lib/missionSainikStudents'

const PHOTO_BUCKET = 'gnsi'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Students keep photos in private storage (photo_path); turn them into temporary viewing links, in memory only.
async function withPhotoLinks(rows) {
  const need = rows.filter(r => r.photoPath && !r.photo)
  if (!need.length) return rows
  try {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(need.map(r => r.photoPath), 86400)
    if (error || !data) return rows
    const by = new Map(data.filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]))
    return rows.map(r => (r.photoPath && !r.photo && by.get(r.photoPath) ? { ...r, photo: by.get(r.photoPath) } : r))
  } catch { return rows }
}

export default function MissionSainikStudents({ institute, isMobile, setMsg }) {
  const [roster, setRoster] = useState(null)
  const [view, setView] = useState('all')
  const [batchKey, setBatchKey] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      let rows = null
      try { rows = await getActiveStudents('id,name,gcc_no,admission_no,phone,course,batch,class_name,status,photo_url,photo_path') } catch { rows = null }
      if (!rows || !rows.length) { try { rows = await getActiveStudents('id,name,gcc_no,admission_no,phone,course,batch,class_name,status') } catch { rows = [] } }   // a database without the photo columns
      const list = await withPhotoLinks(sainikRoster(rows || []))
      if (live) setRoster(list)
    })()
    return () => { live = false }
  }, [])

  const counts = useMemo(() => rosterCounts(roster || [], view), [roster, view])
  const shown = useMemo(() => filterRoster(roster || [], { view, batchKey, q }), [roster, view, batchKey, q])
  const label = `${SAINIK_VIEWS.find(v => v[0] === view)?.[1] || 'All students'}${batchKey ? ' · ' + (counts.batches.find(b => b.key === batchKey)?.label || '') : ''}`
  const chip = on => ({ padding: '8px 15px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
  const head = ['#', 'Student', 'GCC no.', 'Batch', 'Phone', 'Status']
  const body = r => [r.name, r.gcc || '—', r.batch, r.phone || '—', r.status || '—']

  const csv = () => downloadCsv(`Mission_Sainik_students_${view}${batchKey ? '_' + batchKey : ''}.csv`, [head.slice(1), ...shown.map(body)])
  const print = () => {
    if (!shown.length) return setMsg?.('No students to print.')
    printPremium(`<div class="title">Mission Sainik 2027 · Students</div><div class="sub">${esc(label)} · ${shown.length} student${shown.length === 1 ? '' : 's'}</div>
      <table class="t"><colgroup><col style="width:6%"><col style="width:34%"><col style="width:16%"><col style="width:20%"><col style="width:14%"><col style="width:10%"></colgroup>
      <thead><tr>${head.map((h, i) => `<th${i === 1 ? ' class="l"' : ''}>${h}</th>`).join('')}</tr></thead>
      <tbody>${shown.map((r, i) => `<tr><td>${i + 1}</td><td class="l"><b>${esc(r.name)}</b></td>${body(r).slice(1).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
    { title: `Mission Sainik students · ${label}`, institute, docLabel: `Mission Sainik students · ${label}`, official: true })
  }
  const word = async () => {
    if (!shown.length) return setMsg?.('No students to export.')
    try {
      downloadDocx(`Mission_Sainik_students_${view}`, await buildTableDocx({ title: 'Mission Sainik 2027 · Students', sub: `${label} · ${shown.length} students`, institute, label: 'Mission Sainik students', landscape: false,
        columns: [{ h: '#', w: 0.6 }, { h: 'Student', w: 3, left: true }, { h: 'GCC no.', w: 1.4 }, { h: 'Batch', w: 1.8 }, { h: 'Phone', w: 1.4 }, { h: 'Status', w: 1 }],
        rows: shown.map((r, i) => [i + 1, ...body(r)]), signatures: [] }))
    } catch (e) { setMsg?.('❌ Could not make the Word file: ' + (e.message || e)) }
  }

  return (
    <PremiumCard title="Students" subtitle="Every Sainik student and the Combined course students, live from the Students module."
      right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="px-hbtn" onClick={print}>🖨 Print</button><button className="px-hbtn" onClick={word}>📝 Word</button><button className="px-hbtn" onClick={csv}>⬇ CSV</button></span>}>
      <div role="tablist" aria-label="Student list" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {SAINIK_VIEWS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} style={chip(view === k)} onClick={() => { setView(k); setBatchKey('') }}>{l} · {counts[k] ?? 0}</button>)}
      </div>
      {counts.batches.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" style={{ ...chip(!batchKey), padding: '5px 12px', fontSize: 12 }} onClick={() => setBatchKey('')}>Every batch</button>
          {counts.batches.map(b => <button key={b.key} type="button" style={{ ...chip(batchKey === b.key), padding: '5px 12px', fontSize: 12 }} onClick={() => setBatchKey(batchKey === b.key ? '' : b.key)}>{b.label} · {b.n}</button>)}
        </div>)}
      <input className="px-input" type="search" aria-label="Search students" placeholder="🔍 Search by name, GCC number, phone or batch…" value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
      {roster === null ? <div style={{ padding: 20, color: PX.sub }}>Loading students…</div>
        : !roster.length ? <div style={{ padding: 20, color: PX.sub }}>No Sainik or Combined course students found in Students.</div>
          : !shown.length ? <div style={{ padding: 20, color: PX.sub }}>No student matches.</div> : (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(330px,1fr))' }}>
              {shown.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${PX.line}`, borderRadius: 16, background: '#fff' }}>
                  <Avatar name={r.name} size={52} staff={false} photoUrl={r.photo || undefined} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', color: PX.ink, fontSize: 14.5 }}>{r.name}</b>
                    <span style={{ fontSize: 12.5, color: PX.sub }}>{[r.gcc && 'GCC ' + r.gcc, r.phone].filter(Boolean).join(' · ') || '—'}</span>
                  </div>
                  <span style={{ display: 'grid', gap: 4, justifyItems: 'end' }}><Pill tone={r.group === 'sainik' ? 'info' : 'gold'} dot={false}>{r.batch}</Pill>{r.status && r.status !== 'Active' ? <Pill tone="warn" dot={false}>{r.status}</Pill> : null}</span>
                </div>))}
            </div>)}
      {roster !== null && shown.length > 0 && <div style={{ marginTop: 10, fontSize: 12.5, color: PX.sub }}>{shown.length} of {roster.length} students shown.</div>}
    </PremiumCard>
  )
}
