// MissionSainikMockMarks.jsx — enter the marks of a Pre Mock or Mega Mock test student by student, with Absent for those who did not appear.
// Saved to the same store the Pre / Mega analyzers read (mock_test_results), so every report, rank and analysis follows automatically.
import { useEffect, useMemo, useState } from 'react'
import { PremiumCard, PX } from './premiumUI'
import { Avatar, Pill } from './MissionSainikUI'
import { useSainikRoster } from './useSainikRoster'
import { loadAll, saveRows } from './lib/mockTestStore'
import { filterRoster, rosterCounts } from './lib/missionSainikStudents'
import { EXAM_KINDS, examSections, parseMark, buildMarkRows, entriesFromRows } from './lib/missionSainikExam'

const fmtDay = iso => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')

export default function MissionSainikMockMarks({ currentUser, setMsg, isMobile, today = '' }) {
  const roster = useSainikRoster({ photos: false })
  const [kind, setKind] = useState('pre')
  const tests = useMemo(() => EXAM_KINDS[kind].tests(), [kind])
  const [testNo, setTestNo] = useState(() => (EXAM_KINDS.pre.tests().filter(t => t.date <= today).pop() || EXAM_KINDS.pre.tests()[0]).no)
  const test = tests.find(t => t.no === Number(testNo)) || tests[0]
  const sections = useMemo(() => examSections(kind), [kind])
  const [batchKey, setBatchKey] = useState('')
  const [stored, setStored] = useState({ rows: [], mode: 'cloud', note: '' })
  const [series, setSeries] = useState(EXAM_KINDS.pre.series)
  const [entries, setEntries] = useState({})
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const reload = async () => { try { setStored(await loadAll()) } catch (e) { setMsg?.('❌ Could not load saved marks: ' + (e.message || e)) } setLoaded(true) }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => rosterCounts(roster || [], 'all'), [roster])
  const batch = counts.batches.find(b => b.key === batchKey)
  const students = useMemo(() => filterRoster(roster || [], { batchKey }), [roster, batchKey])
  // series names the analyzer already has for this kind (Mega ones contain "Mega"), plus the default
  const seriesOptions = useMemo(() => [...new Set([EXAM_KINDS[kind].series, ...stored.rows.map(r => r.series).filter(n => (kind === 'mega') === /mega/i.test(n || ''))])], [stored, kind])
  const switchKind = k => { setKind(k); setSeries(EXAM_KINDS[k].series); setEntries({}); const t = EXAM_KINDS[k].tests(); setTestNo((t.filter(x => x.date <= today).pop() || t[0]).no) }

  // the saved rows of this exact (series, test, batch) come back onto the sheet so marks can be corrected
  useEffect(() => {
    if (!batchKey || !students.length) { setEntries({}); return }
    const mine = stored.rows.filter(r => r.series === series && Number(r.test_no) === test.no && r.batch === (batch?.label || ''))
    setEntries(entriesFromRows(mine, students))
  }, [batchKey, series, test.no, stored, students]) // eslint-disable-line react-hooks/exhaustive-deps

  const setMark = (s, subj, v) => setEntries(e => ({ ...e, [s.id]: { absent: false, ...e[s.id], marks: { ...(e[s.id]?.marks || {}), [subj]: v } } }))
  const setAbsent = (s, on) => setEntries(e => ({ ...e, [s.id]: { marks: {}, ...e[s.id], absent: on, ...(on ? { marks: {} } : {}) } }))
  const totalOf = s => Math.round(sections.reduce((a, x) => a + (parseMark(entries[s.id]?.marks?.[x.subject], x.max).value || 0), 0) * 100) / 100
  const errors = students.reduce((n, s) => n + sections.filter(x => parseMark(entries[s.id]?.marks?.[x.subject], x.max).error).length, 0)
  const appeared = students.filter(s => !entries[s.id]?.absent && sections.some(x => parseMark(entries[s.id]?.marks?.[x.subject], x.max).value !== null)).length
  const absent = students.filter(s => entries[s.id]?.absent).length
  const maxTotal = sections.reduce((a, x) => a + x.max, 0)

  const save = async () => {
    if (!batchKey) return setMsg?.('❌ Choose the batch first.')
    if (errors) return setMsg?.(`❌ Fix ${errors} mark${errors === 1 ? '' : 's'} first (each must be from 0 to the section maximum).`)
    const rows = buildMarkRows({ series, test, batch: batch?.label || '', kind, students, entries, who: currentUser?.name || '' })
    if (!rows.length) return setMsg?.('❌ Enter at least one mark.')
    setBusy(true)
    try { await saveRows(rows, stored.mode, currentUser?.name || ''); setMsg?.(`✅ ${rows.length} student${rows.length === 1 ? '' : 's'} saved for ${test.id} · ${batch?.label}${absent ? ` · ${absent} absent (not counted)` : ''}`); await reload() }
    catch (e) { setMsg?.('❌ ' + (e.message || e)) }
    setBusy(false)
  }
  const next = (e, i, subjIdx) => { if (e.key !== 'Enter') return; e.preventDefault(); const el = document.querySelector(`[data-mm="${i + 1}-${subjIdx}"]`); if (el) { el.focus(); el.select?.() } }
  const chip = on => ({ padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
  const lab = { fontSize: 12, fontWeight: 700, color: PX.sub, display: 'block' }

  return (
    <PremiumCard title="Mock test marks" subtitle="Enter each student's marks for a Pre Mock or Mega Mock test. Mark Absent for those who did not appear. The analyzers use these marks."
      right={<button type="button" className="px-btn gold" disabled={busy || !batchKey} onClick={save}>{busy ? 'Saving…' : 'Save marks'}</button>}>
      {stored.mode === 'local' && <div role="note" style={{ padding: '9px 12px', borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13, marginBottom: 12 }}>{stored.note || 'The results table is not created in Supabase yet, so marks are kept in this browser only.'}</div>}
      <div role="tablist" aria-label="Test series" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(EXAM_KINDS).map(([k, v]) => <button key={k} type="button" role="tab" aria-selected={kind === k} style={chip(kind === k)} onClick={() => switchKind(k)}>{v.label}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1.6fr 1.4fr', gap: 10, marginBottom: 12 }}>
        <label style={lab}>Test<select className="px-input" value={test.no} onChange={e => setTestNo(Number(e.target.value))}>{tests.map(t => <option key={t.no} value={t.no}>{t.id} · {fmtDay(t.date)}</option>)}</select></label>
        <label style={lab}>Series<select className="px-input" value={series} onChange={e => setSeries(e.target.value)}>{seriesOptions.map(n => <option key={n}>{n}</option>)}</select></label>
        <label style={lab}>Batch<select className="px-input" value={batchKey} onChange={e => setBatchKey(e.target.value)}><option value="">Choose a batch…</option>{counts.batches.map(b => <option key={b.key} value={b.key}>{b.label} · {b.n}</option>)}</select></label>
      </div>
      {!batchKey ? <div style={{ padding: 18, color: PX.sub }}>{roster === null || !loaded ? 'Loading…' : 'Choose a batch to see its students.'}</div> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <Pill tone="ok" dot={false}>{appeared} appeared</Pill><Pill tone="warn" dot={false}>{absent} absent</Pill><Pill tone="mute" dot={false}>{students.length - appeared - absent} not entered</Pill>
            <span style={{ fontSize: 12.5, color: PX.sub, alignSelf: 'center' }}>Out of {maxTotal} · {sections.map(x => `${x.subject} ${x.max}`).join(' · ')}</span>
          </div>
          {isMobile ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {students.map((s, i) => {
                const ab = !!entries[s.id]?.absent
                return (
                  <div key={s.id} style={{ border: `1px solid ${ab ? '#f1d9a8' : PX.line}`, borderRadius: 18, padding: 12, background: ab ? '#fffaf0' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <Avatar name={s.name} size={44} staff={false} />
                      <div style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', fontSize: 15, color: PX.ink }}>{s.name}</b><small style={{ color: PX.sub }}>{s.gcc ? 'GCC ' + s.gcc : ''}{ab ? '' : ` · total ${totalOf(s)}/${maxTotal}`}</small></div>
                      <button type="button" aria-pressed={ab} onClick={() => setAbsent(s, !ab)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 99, border: `1.5px solid ${ab ? '#b45309' : PX.line}`, background: ab ? '#fde9c8' : '#fff', color: ab ? '#8a4a05' : PX.navy, fontWeight: 800, fontSize: 13, fontFamily: 'inherit' }}>{ab ? 'Absent ✓' : 'Absent?'}</button>
                    </div>
                    {!ab && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {sections.map((x, j) => {
                          const v = entries[s.id]?.marks?.[x.subject] ?? ''
                          const bad = !!parseMark(v, x.max).error
                          return (
                            <label key={x.subject} style={{ fontSize: 11.5, fontWeight: 800, color: bad ? PX.bad : PX.sub }}>{x.subject} <span style={{ fontWeight: 600 }}>/{x.max}</span>
                              <input data-mm={`${i}-${j}`} className="px-input" type="number" inputMode="decimal" min="0" max={x.max} step="0.25" aria-label={`${s.name} ${x.subject}`} value={v} onChange={e => setMark(s, x.subject, e.target.value)} onKeyDown={e => next(e, i, j)}
                                style={{ width: '100%', marginTop: 3, minHeight: 46, fontSize: 16, ...(bad ? { borderColor: PX.bad, background: '#fdecea' } : {}) }} />
                            </label>)
                        })}
                      </div>)}
                  </div>)
              })}
              <button type="button" className="px-btn gold" disabled={busy} onClick={save} style={{ minHeight: 50, fontSize: 15 }}>{busy ? 'Saving…' : 'Save marks'}</button>
            </div>
          ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="px-table" style={{ width: '100%', minWidth: 760 }}>
              <thead><tr><th>Student</th>{sections.map(x => <th key={x.subject}>{x.subject}<br /><small>/{x.max}</small></th>)}<th>Total</th><th>Absent</th></tr></thead>
              <tbody>
                {students.map((s, i) => {
                  const ab = !!entries[s.id]?.absent
                  return (
                    <tr key={s.id} style={ab ? { opacity: .55 } : undefined}>
                      <td><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={s.name} size={30} staff={false} /><span><b>{s.name}</b><br /><small style={{ color: PX.sub }}>{s.gcc ? 'GCC ' + s.gcc : ''}</small></span></span></td>
                      {sections.map((x, j) => {
                        const v = entries[s.id]?.marks?.[x.subject] ?? ''
                        const bad = !!parseMark(v, x.max).error
                        return <td key={x.subject}><input data-mm={`${i}-${j}`} className="px-input" type="number" inputMode="decimal" min="0" max={x.max} step="0.25" aria-label={`${s.name} ${x.subject}`} disabled={ab} value={v} onChange={e => setMark(s, x.subject, e.target.value)} onKeyDown={e => next(e, i, j)} style={{ width: 78, padding: '6px 8px', ...(bad ? { borderColor: PX.bad, background: '#fdecea' } : {}) }} /></td>
                      })}
                      <td><b>{ab ? '—' : totalOf(s)}</b></td>
                      <td><input type="checkbox" aria-label={`${s.name} absent`} checked={ab} onChange={e => setAbsent(s, e.target.checked)} /></td>
                    </tr>)
                })}
              </tbody>
            </table>
          </div>)}
          <div style={{ marginTop: 10, fontSize: 12.5, color: PX.sub }}>Press Enter to move down a column. Absent students are not saved, so the analyzers show them as having skipped the test. Saving again replaces this test and batch.</div>
        </>)}
    </PremiumCard>
  )
}
