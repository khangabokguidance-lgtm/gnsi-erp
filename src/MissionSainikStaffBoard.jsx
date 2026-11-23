// MissionSainikStaffBoard.jsx — the staff board on the Practice Maker and the Pre Mock builder.
// Each setter with their photo, progress on their share, achievements, and the smart "hardworking" detector,
// which weighs every question by its level (Easy 1, Medium 2, Hard 3, +¼ for a worked explanation).
import { useMemo, useState } from 'react'
import { PremiumCard, PX } from './premiumUI'
import { Avatar } from './MissionSainikUI'
import { staffBoard, LEVEL_POINTS, EXPLAIN_BONUS } from './lib/staffEffort'

const TONE = { gold: [PX.goldBg, '#7a5a12', PX.goldLine], ok: [PX.okBg, PX.ok, '#bfe3cf'], warn: [PX.warnBg, PX.warn, '#f1d9a8'], bad: [PX.badBg, PX.bad, '#f3c4bf'], info: ['#eef2f9', PX.navy2, '#d5deee'] }
const ACTIVE = { background: PX.navy, color: '#fff', borderColor: PX.navy }
const MEDAL = ['🥇', '🥈', '🥉']
const LEVEL_C = { Easy: '#3f9a6b', Medium: '#d69a2b', Hard: '#c2412d', untagged: '#c9ced8' }

function LevelBar({ levels, n }) {
  if (!n) return <div style={{ height: 6, borderRadius: 99, background: '#f1ede3' }} />
  return (
    <div title={`Easy ${levels.Easy} · Medium ${levels.Medium} · Hard ${levels.Hard}${levels.untagged ? ` · no level ${levels.untagged}` : ''}`} style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', background: '#f1ede3' }}>
      {['Easy', 'Medium', 'Hard', 'untagged'].map(k => levels[k] ? <i key={k} style={{ width: (levels[k] / n) * 100 + '%', background: LEVEL_C[k] }} /> : null)}
    </div>
  )
}

// label: the board's heading (Practice Maker, Pre Mock, Mission Foundation); unit: 'set' | 'test'. tests: [{ no }]; currentTest: the one open now.
// Used by Mission Sainik (Practice Maker, Pre Mock) and Mission Foundation (question maker); each passes only its own rows.
// sectionsOf(t) → [{ label, short, q }]; settersOf(t, label) → panel names; byVersion: every setter writes a full set.
export default function MissionSainikStaffBoard({ label, unit = 'test', storageKey = 'ms_staff_board', tests, currentTest, tid, sectionsOf, settersOf, byVersion, rows, signoffs, same, displayName = n => n, photoOf = n => n, isMobile }) {
  const [scope, setScope] = useState('test')     // 'test' (the open test or set) | 'all'
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(storageKey) !== 'closed' } catch { return true } })
  const [how, setHow] = useState(false)
  const [flt, setFlt] = useState({ q: '', tag: '', section: '', level: '' })   // filter of the setter list
  const toggle = v => { setOpen(v); try { localStorage.setItem(storageKey, v ? 'open' : 'closed') } catch { /* storage blocked */ } }
  const scopeTests = scope === 'all' ? tests.map(t => t.no) : [currentTest]
  const board = useMemo(() => {
    const assignments = []
    scopeTests.forEach(t => sectionsOf(t).forEach(s => {
      const who = [...new Set(settersOf(t, s.label).filter(Boolean))]
      who.forEach(name => assignments.push({ name, test_no: t, section: s.label, target: byVersion ? s.q : Math.ceil(s.q / who.length) }))
    }))
    const inScope = new Set(scopeTests)
    return staffBoard({ assignments, rows: rows.filter(q => inScope.has(q.test_no)), signoffs: signoffs.filter(s => inScope.has(s.test_no)), same })
  }, [scope, currentTest, rows, signoffs, byVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const people = board.people
  const secNames = [...new Set(people.flatMap(p => p.secs.map(x => x.section)))]
  const listed = people.filter(p => (!flt.q.trim() || p.name.toLowerCase().includes(flt.q.trim().toLowerCase()))
    && (!flt.tag || (flt.tag === 'hardworking' ? ['star', 'hardworking'].includes(p.detector?.id) : p.detector?.id === flt.tag))
    && (!flt.section || p.secs.some(x => x.section === flt.section))
    && (!flt.level || (p.levels[flt.level] || 0) > 0))
  const stars = people.filter(p => p.detector && (p.detector.id === 'star' || p.detector.id === 'hardworking'))
  const scopeName = scope === 'all' ? `all ${tests.length} ${unit}s` : tid(currentTest)

  if (!open) return (
    <button type="button" className="px-btn ghost" onClick={() => toggle(true)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px', padding: '10px 16px', textAlign: 'left', gap: 10 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <b>🏆 Staff board</b>
        <span style={{ display: 'inline-flex' }}>{people.filter(p => p.uploaded).slice(0, 5).map((p, i) => <span key={p.name} style={{ marginLeft: i ? -8 : 0 }}><Avatar name={displayName(p.name)} photoName={photoOf(p.name)} size={24} /></span>)}</span>
        <span style={{ color: PX.sub, fontSize: 12.5 }}>· {stars.length ? `${stars.length} hardworking` : `${people.length} setters`}</span>
      </span><span>▸</span>
    </button>
  )

  return (
    <PremiumCard title={`Staff board · ${label}`} subtitle={`${scopeName} · ${board.team.uploaded}/${board.team.target || '—'} questions in · effort weighted by question level`}
      right={<span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="px-hbtn" style={scope === 'test' ? ACTIVE : undefined} aria-pressed={scope === 'test'} onClick={() => setScope('test')}>This {unit}</button>
        <button className="px-hbtn" style={scope === 'all' ? ACTIVE : undefined} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All</button>
        <button className="px-hbtn" aria-expanded={how} onClick={() => setHow(v => !v)}>How it scores</button>
        <button className="px-hbtn" onClick={() => toggle(false)}>Hide</button>
      </span>}>
      {how && <div style={{ fontSize: 12.5, color: PX.ink2, background: PX.tint, border: `1px solid ${PX.line}`, borderRadius: 12, padding: '10px 12px', marginBottom: 12, lineHeight: 1.5 }}>
        Every question earns points by its level: Easy {LEVEL_POINTS.Easy}, Medium {LEVEL_POINTS.Medium}, Hard {LEVEL_POINTS.Hard} (no level counts as Easy), plus {EXPLAIN_BONUS} for a worked explanation.
        The detector compares each setter with the team: <b>Hardworking</b> means effort at least 1.25× the middle setter (or close to the top); <b>Tough setter</b> means 30% or more hard questions; <b>Mostly easy</b> and <b>Behind the team</b> flag who needs a nudge.
      </div>}
      {!people.length ? <div style={{ color: PX.sub, fontSize: 13 }}>No setters are allotted for {scopeName} yet.</div> : <>
        {/* podium: the top three by effort */}
        {people.filter(p => p.uploaded).length >= 2 && <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, people.filter(p => p.uploaded).length)}, minmax(0,1fr))`, gap: 10, marginBottom: 14 }}>
          {people.filter(p => p.uploaded).slice(0, 3).map((p, i) => (
            <div key={p.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px', borderRadius: 14, background: i === 0 ? PX.goldBg : PX.tint, border: `1px solid ${i === 0 ? PX.goldLine : PX.line}`, textAlign: 'center' }}>
              <div style={{ position: 'relative' }}><Avatar name={displayName(p.name)} photoName={photoOf(p.name)} size={i === 0 ? 64 : 52} /><span style={{ position: 'absolute', right: -6, bottom: -4, fontSize: 20 }}>{MEDAL[i]}</span></div>
              <b style={{ fontSize: 13, color: PX.ink }}>{displayName(p.name)}</b>
              <span style={{ fontSize: 12, color: PX.sub }}>{p.points} pts · {p.uploaded} Qs · {p.levels.Hard} hard</span>
            </div>))}
        </div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input className="px-input" type="search" placeholder="Find a teacher…" aria-label="Find a teacher" value={flt.q} onChange={e => setFlt({ ...flt, q: e.target.value })} style={{ flex: '1 1 160px' }} />
          <select className="px-input" aria-label="Detector" value={flt.tag} onChange={e => setFlt({ ...flt, tag: e.target.value })} style={{ flex: '0 1 190px' }}>
            <option value="">Everyone</option><option value="hardworking">💪 Hardworking</option><option value="star">🔥 Hardworking · tough</option><option value="tough">Tough setter</option><option value="steady">Steady</option><option value="easyHeavy">Mostly easy</option><option value="behind">Behind the team</option><option value="notStarted">Not started</option>
          </select>
          {secNames.length > 1 && <select className="px-input" aria-label="Section" value={flt.section} onChange={e => setFlt({ ...flt, section: e.target.value })} style={{ flex: '0 1 170px' }}><option value="">All sections</option>{secNames.map(x => <option key={x}>{x}</option>)}</select>}
          <select className="px-input" aria-label="Has questions of level" value={flt.level} onChange={e => setFlt({ ...flt, level: e.target.value })} style={{ flex: '0 1 150px' }}><option value="">Any level</option><option value="Hard">Has hard</option><option value="Medium">Has medium</option><option value="Easy">Has easy</option></select>
          {(flt.q || flt.tag || flt.section || flt.level) && <button type="button" className="px-btn ghost" onClick={() => setFlt({ q: '', tag: '', section: '', level: '' })}>Clear · {listed.length} of {people.length}</button>}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {!listed.length && <div style={{ color: PX.sub, fontSize: 13 }}>No teacher matches this filter.</div>}
          {listed.map(p => {
            const [bg, fg, ln] = TONE[p.detector?.tone || 'info']
            return (
              <div key={p.name} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'auto 1fr' : 'auto minmax(150px,1.2fr) minmax(140px,1fr) minmax(120px,.9fr) auto', gap: isMobile ? '8px 10px' : 14, alignItems: 'center', padding: '10px 12px', border: `1px solid ${PX.line}`, borderRadius: 14, background: '#fff' }}>
                <Avatar name={displayName(p.name)} photoName={photoOf(p.name)} size={44} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: PX.ink, fontSize: 14 }}>{p.rank ? <span style={{ color: PX.sub, fontWeight: 700 }}>#{p.rank} </span> : null}{displayName(p.name)}</div>
                  <div style={{ fontSize: 12, color: PX.sub }}>{p.onPanel ? `${p.secsDone}/${p.assignedSecs} section${p.assignedSecs === 1 ? '' : 's'} done${p.secsVerified ? ` · ${p.secsVerified} verified` : ''}` : 'Not on the panel'}</div>
                  {p.detector && <span title={p.detector.why} style={{ display: 'inline-block', marginTop: 4, fontSize: 11.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: bg, color: fg, border: `1px solid ${ln}` }}>{p.detector.id === 'star' ? '🔥 ' : p.detector.id === 'hardworking' ? '💪 ' : ''}{p.detector.label}</span>}
                </div>
                <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: PX.ink2 }}><span>Progress</span><span>{p.target ? `${p.assigned}/${p.target}` : p.uploaded} · {p.progress}%</span></div>
                  <div style={{ height: 6, borderRadius: 99, background: '#f1ede3', margin: '4px 0 6px', overflow: 'hidden' }}><div style={{ width: Math.min(100, p.progress) + '%', height: '100%', background: p.progress >= 100 ? PX.ok : PX.gold }} /></div>
                  <LevelBar levels={p.levels} n={p.uploaded} />
                  <div style={{ fontSize: 11, color: PX.sub, marginTop: 3 }}>E {p.levels.Easy} · M {p.levels.Medium} · H {p.levels.Hard}{p.levels.untagged ? ` · no level ${p.levels.untagged}` : ''}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>
                  {p.badges.length ? p.badges.map(b => <span key={b.id} title={b.why} style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: PX.tint, border: `1px solid ${PX.line}`, color: PX.ink2 }}>{b.icon} {b.label}</span>) : <span style={{ fontSize: 11.5, color: PX.faint }}>No achievements yet</span>}
                </div>
                <div style={{ textAlign: isMobile ? 'left' : 'right', gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: PX.navy, lineHeight: 1 }}>{p.points}</div>
                  <div style={{ fontSize: 11, color: PX.sub }}>effort pts{p.index ? ` · ${p.index}×` : ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      </>}
    </PremiumCard>
  )
}
