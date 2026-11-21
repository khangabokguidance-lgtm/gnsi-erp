// MissionSainikPracticePlan.jsx — admin setup of the Practice question bank: for every subject and set (Set 1, Set 2 …) choose the teachers
// who set it (several allowed) and its verifier. Sits on the Allotment tab under "Pre Mock setters".
import { useState, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill, Avatar } from './MissionSainikUI'
import { fullName } from './missionSainikData'
import { groupBySet, addableTeachers } from './lib/missionSainikAllot'
import { staffOptions } from './lib/teacherPick'

const TABLE = 'mission_sainik_tasks'
const STATUS_TONE = { Pending: 'warn', Submitted: 'info', Verified: 'gold', Approved: 'ok' }
const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']

export default function MissionSainikPracticePlan({ practice, SUBJECTS, PRACTICE_PANEL, subjectOfPractice, setNoFor, practiceNames, peopleAll, staffDir = [], reload, setMsg, audit, currentUser, isAdmin, isMobile }) {
  const [key, setKey] = useState(SUBJECTS[0].key)
  const [busy, setBusy] = useState(false)
  const sub = SUBJECTS.find(x => x.key === key) || SUBJECTS[0]
  const sets = PRACTICE_PANEL[sub.key]?.sets || 1
  const rows = useMemo(() => practice.filter(r => subjectOfPractice(r).key === sub.key), [practice, sub.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const groups = groupBySet(rows, sets, setNoFor)
  const staffTokens = useMemo(() => staffOptions(staffDir).map(o => o.pick), [staffDir])
  const candidates = [...new Set([...practiceNames(sub.key), ...peopleAll, ...staffTokens])]
  const defaultVerifier = PRACTICE_PANEL[sub.key]?.verifier || null
  const stamp = () => ({ updated_by: currentUser?.name || '', updated_at: new Date().toISOString() })
  const head = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub }
  const tone = TONES[SUBJECTS.findIndex(x => x.key === sub.key) % TONES.length]

  const run = async (fn, okMsg, what) => {
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) return setMsg('❌ ' + (/duplicate|unique/i.test(error.message) ? 'That teacher already has this set.' : error.message))
    audit('practice_plan', `${sub.key}:${what}`, null); setMsg('✅ ' + okMsg); reload()
  }
  const addTeacher = (set, name) => name && run(() => supabase.from(TABLE).insert({ kind: 'practice', test_no: set.no, subject: sub.label, setter: name, verifier: set.rows[0]?.verifier || defaultVerifier, question_count: 25, status: 'Pending', ...stamp() }),
    `${fullName(name)} added to Set ${set.no}`, `set${set.no}+${name}`)
  const removeTeacher = (set, r) => {
    if (r.status !== 'Pending') return setMsg(`❌ ${fullName(r.setter)} has already handed in Set ${set.no}; it cannot be removed.`)
    if (!window.confirm(`Remove ${fullName(r.setter)} from ${sub.label} Set ${set.no}? Questions they uploaded stay in the bank.`)) return
    run(() => supabase.from(TABLE).delete().eq('id', r.id), `${fullName(r.setter)} removed from Set ${set.no}`, `set${set.no}-${r.setter}`)
  }
  const setVerifier = (set, verifier) => set.rows.length && run(() => supabase.from(TABLE).update({ verifier: verifier || null, ...stamp() }).in('id', set.rows.map(r => r.id)), `Verifier for Set ${set.no} saved`, `set${set.no}:verifier`)

  const pill = on => ({ padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
  const totalTeachers = new Set(rows.map(r => r.setter)).size

  return (
    <PremiumCard title="Practice sets" subtitle={isAdmin ? 'Choose the teachers who set each practice set (several can set the same set) and who verifies it.' : 'Who sets each practice set. Only an admin can change this.'}>
      <div role="tablist" aria-label="Subject" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
        {SUBJECTS.map(x => <button key={x.key} type="button" role="tab" aria-selected={x.key === sub.key} style={pill(x.key === sub.key)} onClick={() => setKey(x.key)}>{x.short}</button>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <b style={{ fontFamily: PX.serif, fontSize: 18, color: PX.navy }}>{sub.label}</b>
        <span style={{ color: PX.sub, fontSize: 13 }}>{sets} practice set{sets === 1 ? '' : 's'} · {totalTeachers} teacher{totalTeachers === 1 ? '' : 's'}</span>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(280px,1fr))' }}>
        {groups.map(g => {
          const verifiers = [...new Set(g.rows.map(r => r.verifier).filter(Boolean))]
          const add = addableTeachers(candidates, g.rows)
          return (
            <div key={g.no} style={{ border: `1px solid ${PX.line}`, borderTop: `4px solid ${tone}`, borderRadius: 16, padding: '12px 14px', background: '#fff', boxShadow: '0 1px 2px rgba(19,42,79,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <b style={{ color: PX.navy, fontSize: 15 }}>Set {g.no}</b><span style={{ ...head }}>{g.rows.length} teacher{g.rows.length === 1 ? '' : 's'}</span>
              </div>
              {!g.rows.length && <div style={{ color: '#b42318', fontSize: 13, padding: '4px 0 8px' }}>No one sets this yet.</div>}
              <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                {g.rows.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 12, background: '#fafbfd', border: '1px solid #eef1f6' }}>
                    <Avatar name={r.setter} size={26} /><b style={{ flex: 1, minWidth: 0, color: PX.ink, fontSize: 13.5 }}>{fullName(r.setter)}</b>
                    <Pill tone={STATUS_TONE[r.status] || 'mute'}>{r.status}</Pill>
                    {isAdmin && <button type="button" className="px-hbtn" disabled={busy} onClick={() => removeTeacher(g, r)} aria-label={`Remove ${r.setter} from Set ${g.no}`} style={{ width: 30, height: 30, padding: 0 }}>✕</button>}
                  </div>))}
              </div>
              {isAdmin && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <select className="px-input" aria-label={`Add a teacher to ${sub.label} Set ${g.no}`} value="" disabled={busy} onChange={e => addTeacher(g, e.target.value)} style={{ width: '100%' }}>
                    <option value="">＋ Add a teacher…</option>
                    {add.map(n => <option key={n} value={n}>{fullName(n)}</option>)}
                  </select>
                  {g.rows.length > 0 && (
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: PX.sub }}>Verifier
                      <select className="px-input" value={verifiers.length === 1 ? verifiers[0] : ''} disabled={busy} onChange={e => setVerifier(g, e.target.value)} style={{ width: '100%', marginTop: 3 }}>
                        <option value="">{verifiers.length > 1 ? 'Different verifiers…' : 'No verifier'}</option>
                        {[...new Set([...candidates, ...verifiers])].sort().map(n => <option key={n} value={n}>{fullName(n)}</option>)}
                      </select>
                    </label>)}
                </div>)}
              {!isAdmin && verifiers.length > 0 && <div style={{ fontSize: 12.5, color: PX.sub }}>Verifier: <b style={{ color: PX.ink }}>{verifiers.map(fullName).join(', ')}</b></div>}
            </div>)
        })}
      </div>
    </PremiumCard>
  )
}
