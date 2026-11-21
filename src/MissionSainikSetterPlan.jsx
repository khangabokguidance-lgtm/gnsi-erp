// MissionSainikSetterPlan.jsx — "Who sets the Pre Mock questions": pick the teacher for each subject of a Pre Mock test.
// Sits at the top of Allotment. Teachers come from the Question Setting Panel (with their workload shown); the verifier follows the panel rule.
import { useState, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill, PersonCell } from './MissionSainikUI'
import { fullName } from './missionSainikData'
import { pickVerifier, setterLoad, shareEvenly, copyPrevious } from './lib/missionSainikAllot'
import { staffOptions } from './lib/teacherPick'

const TABLE = 'mission_sainik_tasks'
const STATUS_TONE = { Pending: 'warn', Submitted: 'info', Verified: 'gold', Approved: 'ok' }

export default function MissionSainikSetterPlan({ tests, TESTS, SUBJECTS, panelSetters, peopleAll, staffDir = [], today, fmtShort, saveTask, reload, setMsg, audit, currentUser, isAdmin, isMobile }) {
  const firstUpcoming = (TESTS.find(t => t.date >= today) || TESTS[0])?.no || 1
  const [no, setNo] = useState(firstUpcoming)
  const [busy, setBusy] = useState(false)
  const test = TESTS.find(t => t.no === no) || TESTS[0]
  const bySubject = useMemo(() => Object.fromEntries(SUBJECTS.map(s => [s.label, tests.filter(r => r.subject === s.label)])), [tests, SUBJECTS])
  const cell = s => tests.find(r => r.test_no === no && r.subject === s.label)
  const unassigned = tests.filter(r => !r.setter).length
  const stamp = () => ({ updated_by: currentUser?.name || '', updated_at: new Date().toISOString() })

  const choose = async (r, s, setter) => {
    if (!setter || setter === r.setter) return
    if (r.status !== 'Pending' && !window.confirm(`${s.label} for ${test.id} is already ${r.status}. Change the setter anyway?`)) return
    const verifier = pickVerifier(s.key, setter, panelSetters(s.key)) || r.verifier || null
    await saveTask(r, { setter, verifier })
  }
  const bulk = async (changes, what) => {
    if (!changes.length) return setMsg('Nothing to change: it is already set that way.')
    setBusy(true)
    let failed = ''
    for (const c of changes) {
      const s = SUBJECTS.find(x => x.label === c.subject) || SUBJECTS.find(x => (bySubject[x.label] || []).some(r => r.id === c.id))
      const verifier = s ? pickVerifier(s.key, c.setter, panelSetters(s.key)) : ''
      const { error } = await supabase.from(TABLE).update({ setter: c.setter, ...(verifier ? { verifier } : {}), ...stamp() }).eq('id', c.id)
      if (error) { failed = error.message; break }
    }
    setBusy(false)
    if (failed) return setMsg('❌ ' + failed)
    audit('setter_plan', what, { rows: changes.length }); setMsg(`✅ ${changes.length} paper${changes.length === 1 ? '' : 's'} updated`); reload()
  }
  const share = s => {
    const setters = panelSetters(s.key)
    if (!setters.length) return setMsg(`❌ Add setters for ${s.label} on the Panel tab first.`)
    const changes = shareEvenly(bySubject[s.label] || [], setters)
    if (!changes.length) return setMsg(`${s.label} is already shared evenly.`)
    if (!window.confirm(`Share the ${s.label} tests evenly between ${setters.map(fullName).join(', ')}? ${changes.length} paper(s) change; tests already submitted keep their setter.`)) return
    bulk(changes, s.label)
  }
  const copyPrev = () => bulk(copyPrevious(tests, no), `${test.id} from previous`)

  const loadBy = setterLoad(tests)
  const staffTokens = useMemo(() => staffOptions(staffDir).map(o => o.pick), [staffDir])
  const pill = on => ({ padding: '7px 12px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', color: PX.navy, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })

  return (
    <PremiumCard title="Who sets the Pre Mock questions?" subtitle={isAdmin ? `Pick a test, then choose the teacher for each subject. The verifier follows the panel rule.${unassigned ? ` ${unassigned} paper(s) have no setter yet.` : ''}` : 'Who sets each Pre Mock paper. Only an admin can assign or change a setter.'}
      right={isAdmin && no > 1 ? <button type="button" className="px-hbtn" disabled={busy} onClick={copyPrev}>↧ Copy setters from PMT-{String(no - 1).padStart(2, '0')}</button> : null}>
      <div role="tablist" aria-label="Pre Mock test" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 10 }}>
        {TESTS.map(t => {
          const rs = tests.filter(r => r.test_no === t.no)
          const gap = rs.some(r => !r.setter)
          return <button key={t.no} type="button" role="tab" aria-selected={t.no === no} style={pill(t.no === no)} onClick={() => setNo(t.no)}>{t.id.replace('PMT-', '')}{gap ? ' ●' : ''}</button>
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <b style={{ fontFamily: PX.serif, fontSize: 18, color: PX.navy }}>{test.id}</b><span style={{ color: PX.sub, fontSize: 13 }}>{fmtShort(test.date)} · drafts due {fmtShort(test.drafts)}</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {SUBJECTS.map(s => {
          const r = cell(s)
          if (!r) return <div key={s.key} style={{ color: PX.faint, fontSize: 13 }}>{s.label}: no task yet</div>
          const panel = panelSetters(s.key)
          const others = [...new Set([...peopleAll, ...staffTokens])].filter(n => n && !panel.includes(n)).sort()
          const opt = n => <option key={n} value={n}>{fullName(n)} · {loadBy[n] || 0} test{(loadBy[n] || 0) === 1 ? '' : 's'}</option>
          return (
            <div key={s.key} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '150px minmax(220px,1fr) auto auto', gap: 8, alignItems: 'center', padding: '8px 10px', border: `1px solid ${PX.line}`, borderRadius: 14, background: r.setter ? '#fff' : '#fffaf0' }}>
              <b style={{ color: PX.navy }}>{s.label}</b>
              <select className="px-input" aria-label={`Setter for ${test.id} ${s.label}`} value={r.setter || ''} disabled={busy || !isAdmin} onChange={e => choose(r, s, e.target.value)}>
                {!r.setter && <option value="">— Choose a teacher —</option>}
                {r.setter && !panel.includes(r.setter) && !others.includes(r.setter) && opt(r.setter)}
                {panel.length > 0 && <optgroup label={`${s.label} panel`}>{panel.map(opt)}</optgroup>}
                {others.length > 0 && <optgroup label="Other staff">{others.map(opt)}</optgroup>}
              </select>
              <span style={{ fontSize: 12.5, color: PX.sub }}>{r.verifier ? <>Verifier: <b style={{ color: PX.ink }}>{fullName(r.verifier)}</b></> : 'No verifier'}</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Pill tone={STATUS_TONE[r.status] || 'mute'}>{r.status}</Pill>
                {isAdmin && <button type="button" className="px-hbtn" disabled={busy} onClick={() => share(s)} title={`Share all ${s.label} tests evenly between its panel setters`}>⚖ Share evenly</button>}
              </span>
            </div>)
        })}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: PX.sub }}>
        {Object.entries(loadBy).sort((a, b) => b[1] - a[1]).map(([n, c]) => <span key={n} style={{ display: 'inline-flex' }}><PersonCell name={n} size={20} sub={`${c} test${c === 1 ? '' : 's'}`}>{n}</PersonCell></span>)}
      </div>
    </PremiumCard>
  )
}
