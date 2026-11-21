// MissionSainikSetterPlan.jsx — "Who sets the Pre Mock questions": pick the teacher for each subject of a Pre Mock test.
// Sits at the top of Allotment. Teachers come from the Question Setting Panel (with their workload shown); the verifier follows the panel rule.
import { useState, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill, PersonCell, Avatar } from './MissionSainikUI'
import { fullName } from './missionSainikData'
import { pickVerifier, setterLoad, shareEvenly, copyPrevious, currentCounts, assignByCounts } from './lib/missionSainikAllot'
import { staffOptions } from './lib/teacherPick'

const TABLE = 'mission_sainik_tasks'
const STATUS_TONE = { Pending: 'warn', Submitted: 'info', Verified: 'gold', Approved: 'ok' }

export default function MissionSainikSetterPlan({ tests, TESTS, SUBJECTS, panelSetters, peopleAll, staffDir = [], today, fmtShort, saveTask, reload, setMsg, audit, currentUser, isAdmin, isMobile }) {
  const firstUpcoming = (TESTS.find(t => t.date >= today) || TESTS[0])?.no || 1
  const [no, setNo] = useState(firstUpcoming)
  const [busy, setBusy] = useState(false)
  const [cSub, setCSub] = useState(SUBJECTS[0].label)   // subject shown in "Number of tests per teacher"
  const [edits, setEdits] = useState({})              // { subjectLabel: { name: count } } typed but not applied yet
  const test = TESTS.find(t => t.no === no) || TESTS[0]
  const bySubject = useMemo(() => Object.fromEntries(SUBJECTS.map(s => [s.label, tests.filter(r => r.subject === s.label)])), [tests, SUBJECTS])
  const cell = s => tests.find(r => r.test_no === no && r.subject === s.label)
  const unassigned = tests.filter(r => !r.setter).length
  const stamp = () => ({ updated_by: currentUser?.name || '', updated_at: new Date().toISOString() })

  // The verifier follows the panel rule unless an admin picked one by hand; a hand-picked verifier is kept when the setter changes.
  const verifierAfter = (r, s, setter) => {
    const auto = pickVerifier(s.key, setter, panelSetters(s.key))
    const wasAuto = !r.verifier || r.verifier === pickVerifier(s.key, r.setter, panelSetters(s.key))
    return wasAuto ? (auto || r.verifier || null) : r.verifier
  }
  const choose = async (r, s, setter) => {
    if (!setter || setter === r.setter) return
    if (r.status !== 'Pending' && !window.confirm(`${s.label} for ${test.id} is already ${r.status}. Change the setter anyway?`)) return
    await saveTask(r, { setter, verifier: verifierAfter(r, s, setter) })
  }
  const chooseVerifier = async (r, verifier) => {
    if ((verifier || null) === (r.verifier || null)) return
    await saveTask(r, { verifier: verifier || null })
  }
  const bulk = async (changes, what) => {
    if (!changes.length) return setMsg('Nothing to change: it is already set that way.')
    setBusy(true)
    let failed = ''
    for (const c of changes) {
      const row = tests.find(r => r.id === c.id)
      const s = row && SUBJECTS.find(x => x.label === row.subject)
      const verifier = row && s ? verifierAfter(row, s, c.setter) : null
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

  // ── Number of tests per teacher ──
  const cSubject = SUBJECTS.find(x => x.label === cSub) || SUBJECTS[0]
  const cRows = bySubject[cSubject.label] || []
  const cBase = currentCounts(cRows, panelSetters(cSubject.key))
  const cTargets = { ...cBase, ...(edits[cSubject.label] || {}) }
  const cTotal = Object.values(cTargets).reduce((n, v) => n + (Number(v) || 0), 0)
  const cDirty = Object.keys(cTargets).some(n => (cTargets[n] || 0) !== (cBase[n] || 0))
  const handedIn = n => cRows.filter(r => r.setter === n && r.status !== 'Pending').length
  const setTarget = t => setEdits(e => ({ ...e, [cSubject.label]: t }))
  // + / − keep the total fixed: raising one teacher takes a test from whoever has the most (never below what they handed in);
  // lowering one gives a test to whoever has the fewest.
  const bump = (name, delta) => {
    const t = { ...cTargets }, names = Object.keys(t)
    if (delta > 0) {
      const donors = names.filter(n => n !== name && t[n] > handedIn(n)).sort((a, b) => t[b] - t[a])
      if (!donors.length) return setMsg('❌ No one else has a test to give up.')
      t[donors[0]]--; t[name]++
    } else {
      if (t[name] <= handedIn(name)) return setMsg(`❌ ${fullName(name)} has already handed in ${handedIn(name)} test(s).`)
      const takers = names.filter(n => n !== name).sort((a, b) => t[a] - t[b])
      if (!takers.length) return setMsg('❌ Add another teacher to give the test to.')
      t[name]--; t[takers[0]]++
    }
    setTarget(t)
  }
  const addToCounts = name => { if (name) setTarget({ ...cTargets, [name]: cTargets[name] || 0 }) }
  const applyCounts = () => {
    const r = assignByCounts(cRows, cTargets)
    if (r.error) return setMsg('❌ ' + r.error)
    if (!r.changes.length) return setMsg('Nothing to change.')
    if (!window.confirm(`Change ${r.changes.length} ${cSubject.label} paper${r.changes.length === 1 ? '' : 's'} to match these numbers? Tests already submitted keep their setter.`)) return
    bulk(r.changes, `${cSubject.label} counts`).then(() => setEdits(e => ({ ...e, [cSubject.label]: undefined })))
  }

  const loadBy = setterLoad(tests)
  const staffTokens = useMemo(() => staffOptions(staffDir).map(o => o.pick), [staffDir])
  const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']
  const rowsNow = SUBJECTS.map(cell).filter(Boolean)
  const assigned = rowsNow.filter(r => r.setter).length
  const maxLoad = Math.max(1, ...Object.values(loadBy))
  const chip = (t, on) => {
    const rs = tests.filter(r => r.test_no === t.no)
    const full = rs.length > 0 && rs.every(r => r.setter), gap = rs.some(r => !r.setter)
    return { padding: '7px 0', minWidth: 46, textAlign: 'center', borderRadius: 12, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', flex: 'none', position: 'relative',
      border: `1.5px solid ${on ? PX.navy : full ? '#bfe3cc' : gap ? '#f1c9c4' : PX.line}`, background: on ? PX.navy : full ? '#f3fbf6' : gap ? '#fff7f6' : '#fff', color: on ? '#fff' : full ? '#0f7a4c' : gap ? '#b42318' : PX.navy }
  }
  const head = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub }
  const cols = isMobile ? '1fr' : '170px minmax(240px,1.4fr) minmax(150px,1fr) 110px'

  return (
    <PremiumCard title="Pre Mock setters" subtitle={isAdmin ? `Choose who sets and who verifies each paper. The verifier is suggested by the panel rule but can be any of the same teachers, even the setter.${unassigned ? ` ${unassigned} paper${unassigned === 1 ? ' has' : 's have'} no setter yet.` : ' Every paper has a setter.'}` : 'Who sets each Pre Mock paper. Only an admin can assign or change a setter.'}
      right={isAdmin && no > 1 ? <button type="button" className="px-hbtn" disabled={busy} onClick={copyPrev}>↧ Copy from PMT-{String(no - 1).padStart(2, '0')}</button> : null}>
      <div role="tablist" aria-label="Pre Mock test" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0 8px', marginBottom: 6 }}>
        {TESTS.map(t => <button key={t.no} type="button" role="tab" aria-selected={t.no === no} style={chip(t, t.no === no)} title={`${t.id} · ${fmtShort(t.date)}`} onClick={() => setNo(t.no)}>{String(t.no).padStart(2, '0')}</button>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 16, background: 'linear-gradient(135deg,#132a4f,#1e3a6e)', color: '#fff', marginBottom: 12 }}>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontFamily: PX.serif, fontSize: 21, fontWeight: 700, letterSpacing: '.01em' }}>{test.id}</div>
          <div style={{ fontSize: 12.5, color: '#e9d9b0', fontWeight: 600 }}>{fmtShort(test.date)} · drafts due {fmtShort(test.drafts)} · final {fmtShort(test.print)}</div>
        </div>
        <div style={{ flex: '1 1 180px', minWidth: 150 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 5 }}><span>Setters assigned</span><span>{assigned} / {rowsNow.length || SUBJECTS.length}</span></div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}><div style={{ width: `${rowsNow.length ? (assigned / rowsNow.length) * 100 : 0}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#e9d9b0,#86efac)', transition: 'width .3s' }} /></div>
        </div>
      </div>
      {!isMobile && <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '0 12px 6px' }}><span style={head}>Subject</span><span style={head}>Setter</span><span style={head}>Verifier</span><span style={head}>Status</span></div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {SUBJECTS.map((s, si) => {
          const r = cell(s)
          if (!r) return <div key={s.key} style={{ color: PX.faint, fontSize: 13, padding: '6px 12px' }}>{s.label}: no task yet</div>
          const panel = panelSetters(s.key)
          const others = [...new Set([...peopleAll, ...staffTokens])].filter(n => n && !panel.includes(n)).sort()
          const opt = n => <option key={n} value={n}>{fullName(n)} · {loadBy[n] || 0} test{(loadBy[n] || 0) === 1 ? '' : 's'}</option>
          return (
            <div key={s.key} style={{ display: 'grid', gridTemplateColumns: cols, gap: isMobile ? 8 : 10, alignItems: 'center', padding: '10px 12px', border: `1px solid ${r.setter ? PX.line : '#f1c9c4'}`, borderLeft: `4px solid ${TONES[si % TONES.length]}`, borderRadius: 14, background: r.setter ? '#fff' : '#fff9f8', boxShadow: '0 1px 2px rgba(19,42,79,.04)' }}>
              <div><b style={{ color: PX.navy, fontSize: 14.5 }}>{s.label}</b><div style={{ fontSize: 11.5, color: PX.sub }}>{panel.length} on the panel</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {r.setter ? <Avatar name={r.setter} size={30} /> : <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', border: '2px dashed #e0a39b', flex: 'none' }} />}
                <select className="px-input" aria-label={`Setter for ${test.id} ${s.label}`} value={r.setter || ''} disabled={busy || !isAdmin} onChange={e => choose(r, s, e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                  {!r.setter && <option value="">Choose a teacher…</option>}
                  {r.setter && !panel.includes(r.setter) && !others.includes(r.setter) && opt(r.setter)}
                  {panel.length > 0 && <optgroup label={`${s.label} panel`}>{panel.map(opt)}</optgroup>}
                  {others.length > 0 && <optgroup label="Other staff">{others.map(opt)}</optgroup>}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                {isMobile && <span style={{ ...head, display: 'block', marginBottom: 2 }}>Verifier</span>}
                <select className="px-input" aria-label={`Verifier for ${test.id} ${s.label}`} value={r.verifier || ''} disabled={busy || !isAdmin} onChange={e => chooseVerifier(r, e.target.value)} style={{ width: '100%' }}>
                  <option value="">No verifier</option>
                  {r.verifier && !panel.includes(r.verifier) && !others.includes(r.verifier) && opt(r.verifier)}
                  {panel.length > 0 && <optgroup label={`${s.label} panel`}>{panel.map(n => <option key={n} value={n}>{fullName(n)}{n === r.setter ? ' (setter)' : ''}</option>)}</optgroup>}
                  {others.length > 0 && <optgroup label="Other staff">{others.map(n => <option key={n} value={n}>{fullName(n)}{n === r.setter ? ' (setter)' : ''}</option>)}</optgroup>}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pill tone={STATUS_TONE[r.status] || 'mute'}>{r.status}</Pill>
                {isAdmin && <button type="button" className="px-hbtn" disabled={busy} onClick={() => share(s)} aria-label={`Share all ${s.label} tests evenly`} title={`Share all ${s.label} tests evenly between its panel setters`} style={{ height: 32, padding: '0 10px' }}>⚖</button>}
              </div>
            </div>)
        })}
      </div>
      <div style={{ marginTop: 18, padding: 14, borderRadius: 16, border: `1px solid ${PX.line}`, background: '#fcfbf7' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div><b style={{ color: PX.navy, fontSize: 15 }}>Number of tests per teacher</b><div style={{ fontSize: 12.5, color: PX.sub }}>{isAdmin ? 'Raise or lower how many of the 20 tests each teacher sets. The others adjust automatically; press Apply to save.' : 'How many tests each teacher sets. Only an admin can change these.'}</div></div>
        </div>
        <div role="tablist" aria-label="Subject" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {SUBJECTS.map(x => <button key={x.key} type="button" role="tab" aria-selected={x.label === cSubject.label} onClick={() => setCSub(x.label)} style={{ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${x.label === cSubject.label ? PX.navy : PX.line}`, background: x.label === cSubject.label ? PX.navy : '#fff', color: x.label === cSubject.label ? '#fff' : PX.navy, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{x.short}</button>)}
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {Object.keys(cTargets).sort((a, b) => cTargets[b] - cTargets[a] || a.localeCompare(b)).map(n => {
            const v = cTargets[n] || 0, was = cBase[n] || 0
            return (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(160px,1fr) 150px minmax(100px,1.2fr) 150px', gap: 10, alignItems: 'center', padding: '6px 10px', borderRadius: 12, background: '#fff', border: `1px solid ${v !== was ? PX.gold : '#eef1f6'}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><Avatar name={n} size={26} /><b style={{ color: PX.ink, fontSize: 13.5 }}>{fullName(n)}</b></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifySelf: isMobile ? 'end' : 'start' }}>
                  <button type="button" className="px-hbtn" aria-label={`One fewer test for ${n}`} disabled={!isAdmin || busy} onClick={() => bump(n, -1)} style={{ width: 34, height: 34, padding: 0, fontSize: 18 }}>−</button>
                  <b aria-live="polite" style={{ minWidth: 32, textAlign: 'center', fontSize: 17, color: PX.navy }}>{v}</b>
                  <button type="button" className="px-hbtn" aria-label={`One more test for ${n}`} disabled={!isAdmin || busy} onClick={() => bump(n, 1)} style={{ width: 34, height: 34, padding: 0, fontSize: 18 }}>＋</button>
                </span>
                {!isMobile && <span style={{ height: 7, borderRadius: 4, background: '#eef1f6', overflow: 'hidden' }}><span style={{ display: 'block', width: `${cRows.length ? (v / cRows.length) * 100 : 0}%`, height: '100%', background: v !== was ? 'linear-gradient(90deg,#b8923a,#e0b95a)' : '#9fb3d6' }} /></span>}
                {!isMobile && <span style={{ fontSize: 12, color: PX.sub }}>{v !== was ? <b style={{ color: '#8a6118' }}>was {was}</b> : handedIn(n) ? `${handedIn(n)} handed in` : ''}</span>}
              </div>)
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <Pill tone={cTotal === cRows.length ? 'ok' : 'warn'}>{cTotal} of {cRows.length} tests</Pill>
          {isAdmin && (() => {
            const extra = [...new Set([...peopleAll, ...staffTokens])].filter(n => n && !(n in cTargets)).sort()
            return extra.length > 0 && <select className="px-input" aria-label="Add another teacher" value="" onChange={e => addToCounts(e.target.value)} style={{ width: 'auto', maxWidth: 220 }}><option value="">＋ Add another teacher…</option>{extra.map(n => <option key={n} value={n}>{fullName(n)}</option>)}</select>
          })()}
          <span style={{ flex: 1 }} />
          {isAdmin && cDirty && <button type="button" className="px-btn ghost" disabled={busy} onClick={() => setEdits(e => ({ ...e, [cSubject.label]: undefined }))}>Reset</button>}
          {isAdmin && <button type="button" className="px-btn gold" disabled={busy || !cDirty || cTotal !== cRows.length} onClick={applyCounts}>{busy ? 'Saving…' : 'Apply'}</button>}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ ...head, marginBottom: 8 }}>Workload · tests each teacher sets</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: '6px 18px' }}>
          {Object.entries(loadBy).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 78, fontWeight: 700, color: PX.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
              <span style={{ flex: 1, height: 7, borderRadius: 4, background: '#eef1f6', overflow: 'hidden' }}><span style={{ display: 'block', width: `${(c / maxLoad) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#b8923a,#e0b95a)' }} /></span>
              <b style={{ width: 22, textAlign: 'right', color: PX.navy }}>{c}</b>
            </div>))}
        </div>
      </div>
    </PremiumCard>
  )
}
