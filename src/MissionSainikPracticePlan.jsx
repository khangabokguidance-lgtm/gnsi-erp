// MissionSainikPracticePlan.jsx — admin setup of the Practice question bank. Every practice teacher of a subject sets their OWN practice questions for
// EVERY Pre Mock test (PMT-01 … PMT-20), each on that test's planned chapter. Here the admin chooses the teachers and the verifier of each subject
// and watches how many of the 20 tests each teacher has finished. Sits on the Allotment tab under "Pre Mock setters".
import { useState, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill, Avatar } from './MissionSainikUI'
import { fullName, staffMatching } from './missionSainikData'
import { addableTeachers } from './lib/missionSainikAllot'
import { staffOptions } from './lib/teacherPick'

const TABLE = 'mission_sainik_tasks'
const STATUS_TONE = { Pending: 'warn', Submitted: 'info', Verified: 'gold', Approved: 'ok' }
const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']

export default function MissionSainikPracticePlan({ questionsPer = () => 25, coverOf = () => ({ done: 0, started: 0, total: 20, qs: 0 }), photoOf = x => x, practiceSetters = () => [], practice, SUBJECTS, PRACTICE_PANEL, practiceNames, peopleAll, staffDir = [], reload, setMsg, audit, currentUser, isAdmin, isMobile }) {
  const [key, setKey] = useState(SUBJECTS[0].key)
  const [busy, setBusy] = useState(false)
  const sub = SUBJECTS.find(x => x.key === key) || SUBJECTS[0]
  const rows = useMemo(() => practice.filter(r => r.subject === sub.label), [practice, sub.label])
  const staffTokens = useMemo(() => staffOptions(staffDir).map(o => o.pick), [staffDir])
  const candidates = [...new Set([...practiceNames(sub.key), ...peopleAll, ...staffTokens])]
  const defaultVerifier = PRACTICE_PANEL[sub.key]?.verifier || null
  const stamp = () => ({ updated_by: currentUser?.name || '', updated_at: new Date().toISOString() })
  const tone = TONES[SUBJECTS.findIndex(x => x.key === sub.key) % TONES.length]
  const q = questionsPer(sub.key)
  const verifiers = [...new Set(rows.map(r => r.verifier).filter(Boolean))]
  const add = addableTeachers(candidates, rows)
  const missing = practiceSetters(sub.key).filter(n => !rows.some(r => r.setter === n))

  const run = async (fn, okMsg, what, mustChange = false) => {
    setBusy(true)
    const { error, data } = await fn()
    setBusy(false)
    if (!error && mustChange && Array.isArray(data) && !data.length) { reload(); return setMsg('❌ Could not remove: the database did not delete it (no permission, or it is already gone). Refreshed the list.') }
    if (error) { reload(); return setMsg('❌ ' + (/duplicate|unique/i.test(error.message) ? 'That teacher is already on this subject. The list was refreshed.' : error.message)) }
    audit('practice_plan', `${sub.key}:${what}`, null); setMsg('✅ ' + okMsg); reload()
  }
  // One assignment per teacher and subject (test_no 0): the teacher sets practice questions for every test.
  const rowFor = name => ({ kind: 'practice', test_no: 0, subject: sub.label, setter: name, verifier: rows[0]?.verifier || defaultVerifier, question_count: q, status: 'Pending', ...stamp() })
  const addTeachers = names => names.length && run(() => supabase.from(TABLE).upsert(names.map(rowFor), { onConflict: 'kind,test_no,subject,setter', ignoreDuplicates: true }).select('id'),
    names.length === 1 ? `${fullName(names[0])} added to ${sub.label} practice` : `${names.length} teachers added to ${sub.label} practice`, `add:${names.join('+')}`)
  const removeTeacher = r => {
    if (r.status !== 'Pending') return setMsg(`❌ ${fullName(r.setter)} has already handed in their ${sub.label} practice; they cannot be removed.`)
    if (!window.confirm(`Remove ${fullName(r.setter)} from ${sub.label} practice? Questions they uploaded stay in the bank.`)) return
    run(() => supabase.from(TABLE).delete().eq('kind', 'practice').eq('subject', sub.label).eq('setter', r.setter).select('id'), `${fullName(r.setter)} removed from ${sub.label} practice`, `remove:${r.setter}`, true)
  }
  const setVerifier = verifier => rows.length && run(() => supabase.from(TABLE).update({ verifier: verifier || null, ...stamp() }).eq('kind', 'practice').eq('subject', sub.label), `Verifier for ${sub.label} practice saved`, 'verifier')

  const pill = on => ({ padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })

  return (
    <PremiumCard title="Practice teachers" subtitle={isAdmin ? 'Every practice teacher sets their own questions for every test (PMT-01 to PMT-20), each on that test’s planned chapter. Add the teachers and choose who verifies.' : 'Who sets the practice questions of each subject, and how far each has got.'}>
      <div data-ti-skip role="tablist" aria-label="Subject" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
        {SUBJECTS.map(x => <button key={x.key} type="button" role="tab" aria-selected={x.key === sub.key} style={pill(x.key === sub.key)} onClick={() => setKey(x.key)}>{x.short}</button>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <b style={{ fontFamily: PX.serif, fontSize: 18, color: PX.navy }}>{sub.label}</b>
        <span style={{ color: PX.sub, fontSize: 13 }}>{rows.length} teacher{rows.length === 1 ? '' : 's'} · each sets {q} questions for every one of the {coverOf(sub.label, '', q).total} tests</span>
      </div>
      <div style={{ border: `1px solid ${PX.line}`, borderTop: `4px solid ${tone}`, borderRadius: 16, padding: '12px 14px', background: '#fff', boxShadow: '0 1px 2px rgba(19,42,79,.04)' }}>
        {!rows.length && <div style={{ color: '#b42318', fontSize: 13, padding: '4px 0 10px' }}>No practice teacher yet. Without one, nobody can upload practice questions for {sub.label}.</div>}
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {rows.map(r => {
            const c = coverOf(sub.label, r.setter, q), pct = c.total ? Math.round((c.done / c.total) * 100) : 0
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 12, background: '#fafbfd', border: '1px solid #eef1f6' }}>
                <Avatar name={r.setter} photoName={photoOf(r.setter)} size={44} />
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <b style={{ color: PX.ink, fontSize: 14 }}>{fullName(r.setter)}</b>
                  <div style={{ fontSize: 12, color: PX.sub }}>{c.qs} question{c.qs === 1 ? '' : 's'} set so far{c.started ? ` · ${c.started} test${c.started === 1 ? '' : 's'} in progress` : ''}</div>
                </div>
                <div style={{ flex: '1 1 150px', minWidth: 120 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: c.done === c.total ? '#0f7a4c' : PX.navy, marginBottom: 3 }}>{c.done} of {c.total} tests done</div>
                  <div style={{ height: 8, borderRadius: 99, background: '#e3e8f0', overflow: 'hidden' }} role="img" aria-label={`${c.done} of ${c.total} tests done`}><div style={{ width: pct + '%', height: '100%', borderRadius: 99, background: c.done === c.total ? '#16a34a' : tone }} /></div>
                </div>
                {staffMatching(r.setter, staffDir).length > 1 && <Pill tone="bad" title={`“${r.setter}” matches ${staffMatching(r.setter, staffDir).join(', ')}. It identifies nobody until you use a more specific name.`}>⚠ matches {staffMatching(r.setter, staffDir).length} staff</Pill>}
                <Pill tone={STATUS_TONE[r.status] || 'mute'}>{r.status}</Pill>
                {isAdmin && <button type="button" className="px-hbtn" disabled={busy} onClick={() => removeTeacher(r)} aria-label={`Remove ${r.setter} from ${sub.label} practice`} style={{ width: 32, height: 32, padding: 0 }}>✕</button>}
              </div>)
          })}
        </div>
        {isAdmin && (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(240px,1fr))', alignItems: 'end' }}>
            <select className="px-input" aria-label={`Add a practice teacher to ${sub.label}`} value="" disabled={busy} onChange={e => e.target.value && addTeachers([e.target.value])}>
              <option value="">＋ Add a practice teacher…</option>
              {add.map(n => <option key={n} value={n}>{fullName(n)}</option>)}
            </select>
            {missing.length > 0 && <button type="button" className="px-hbtn" disabled={busy} onClick={() => addTeachers(missing)} style={{ justifyContent: 'center' }}>👥 Add all practice teachers ({missing.length} not yet here)</button>}
            {rows.length > 0 && (
              <label style={{ fontSize: 11.5, fontWeight: 700, color: PX.sub }}>Verifier
                <select className="px-input" value={verifiers.length === 1 ? verifiers[0] : ''} disabled={busy} onChange={e => setVerifier(e.target.value)} style={{ width: '100%', marginTop: 3 }}>
                  <option value="">{verifiers.length > 1 ? 'Different verifiers…' : 'No verifier'}</option>
                  {[...new Set([...candidates, ...verifiers])].sort().map(n => <option key={n} value={n}>{fullName(n)}</option>)}
                </select>
              </label>)}
          </div>)}
        {!isAdmin && verifiers.length > 0 && <div style={{ fontSize: 12.5, color: PX.sub }}>Verifier: <b style={{ color: PX.ink }}>{verifiers.map(fullName).join(', ')}</b></div>}
      </div>
    </PremiumCard>
  )
}
