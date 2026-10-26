// ExamHome.jsx — the desktop landing screen for the Exams module.
// Built around what a teacher wants to DO ("Enter marks", "Print admit cards")
// rather than where the tool lives: a search that jumps anywhere, plain-language
// task cards, a six-step exam journey with a live next-step hint, upcoming
// papers and the tools you used last. Styles are scoped under .eh-*.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import ExamIcon from './examIcons'
import { PX } from './premiumUI'

const TASKS = [
  { id: 'entry',        title: 'Enter marks',          hint: 'Type or paste marks for a batch',         color: '#1e3a6e', key: 'M' },
  { id: 'csvimport',    title: 'Import from Excel',    hint: 'Upload a sheet — we match the students',  color: '#1e3a6e', key: 'I' },
  { id: 'rankings',     title: 'See rankings',         hint: 'Toppers and positions, instantly',        color: '#b8923a', key: 'R' },
  { id: 'admitcard',    title: 'Print admit cards',    hint: 'One card or a whole batch',               color: '#0f7a4c', key: 'A' },
  { id: 'reportcard',   title: 'Print report cards',   hint: 'Individual or bulk, ready to hand out',   color: '#0f7a4c', key: 'P' },
  { id: 'mockanalyzer', title: 'Analyse a mock test',  hint: 'Subject, student and batch insights',     color: '#c026d3', key: 'N' },
  { id: 'schedule',     title: 'Plan the timetable',   hint: 'Dates, subjects and marks per paper',     color: '#9a5b00', key: 'T' },
  { id: 'seatplan',     title: 'Arrange seating',      hint: 'Rooms and seats in a click',              color: '#9a5b00', key: 'S' },
]

const JOURNEY = [
  { id: 'examtypes',  n: 1, title: 'Set up',        hint: 'Create the exam (e.g. 1st Monthly Test)' },
  { id: 'schedule',   n: 2, title: 'Schedule',      hint: 'Add papers, dates and marks' },
  { id: 'admitcard',  n: 3, title: 'Admit cards',   hint: 'Print before exam day' },
  { id: 'entry',      n: 4, title: 'Enter marks',   hint: 'After papers are checked' },
  { id: 'rankings',   n: 5, title: 'Results',       hint: 'Check ranks and merit list' },
  { id: 'reportcard', n: 6, title: 'Report cards',  hint: 'Print and hand over' },
]

const RECENT_KEY = 'gnsi_exam_recent'
export function readRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
export function pushRecent(id) {
  if (!id || id === 'home') return
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter(x => x !== id)].slice(0, 6))) } catch { /* private mode */ }
}

const fmtD = d => { try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) } catch { return d } }

export default function ExamHome({ groups, onSelect, institute, role, userName, stats, schedule = [] }) {
  const [q, setQ] = useState('')
  const [cur, setCur] = useState(0)
  const ref = useRef(null)
  const flat = useMemo(() => groups.flatMap(g => g.tabs.map(t => ({ ...t, color: g.color, group: g.groupLabel }))), [groups])
  const byId = useMemo(() => Object.fromEntries(flat.map(t => [t.id, t])), [flat])
  const allowed = id => !!byId[id]
  const tasks = TASKS.filter(t => allowed(t.id))
  const recent = readRecent().filter(allowed).map(id => byId[id])

  const needle = q.trim().toLowerCase()
  const hits = needle ? flat.filter(t => `${t.label} ${t.tip} ${t.group} ${(TASKS.find(x => x.id === t.id) || {}).title || ''}`.toLowerCase().includes(needle)).slice(0, 7) : []
  useEffect(() => setCur(0), [needle])

  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
      if (e.key === '/') { e.preventDefault(); ref.current?.focus(); return }
      const hit = TASKS.find(t => t.key.toLowerCase() === e.key.toLowerCase() && allowed(t.id))
      if (hit) { e.preventDefault(); onSelect(hit.id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [byId, onSelect]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = new Date().toLocaleDateString('en-CA')
  const upcoming = useMemo(() => schedule.filter(s => s.exam_date && s.exam_date >= todayStr).sort((a, b) => a.exam_date.localeCompare(b.exam_date)).slice(0, 5), [schedule, todayStr])

  // journey progress we can honestly infer from loaded data
  const done = { examtypes: stats.examTypes > 0 && stats.batches > 0, schedule: schedule.length > 0 }
  const next = JOURNEY.find(s => !done[s.id] && allowed(s.id)) || JOURNEY.find(s => allowed(s.id))

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const who = (userName || '').split(' ')[0]

  const onKeyDown = e => {
    if (!hits.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCur(c => Math.min(hits.length - 1, c + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCur(c => Math.max(0, c - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); onSelect(hits[cur].id) }
    if (e.key === 'Escape') setQ('')
  }

  return (
    <div className="eh">
      <style>{`
        @keyframes ehRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .eh{display:flex;flex-direction:column;gap:18px;font-family:${PX.sans}}
        .eh>*{animation:ehRise .55s cubic-bezier(.2,.7,.2,1) both}
        .eh>*:nth-child(2){animation-delay:.07s}.eh>*:nth-child(3){animation-delay:.14s}.eh>*:nth-child(4){animation-delay:.21s}
        .eh-spot{position:relative;border-radius:22px;padding:26px 28px 24px;
          background:radial-gradient(70% 130% at 0% 0%,rgba(184,146,58,.17),transparent 60%),linear-gradient(135deg,#fffdf7,#f6efdc);
          border:1px solid ${PX.goldLine};box-shadow:0 18px 40px -26px rgba(138,97,24,.6),inset 0 1px 0 #fff}
        .eh-spot::after{content:'';position:absolute;right:-50px;bottom:-70px;width:230px;height:230px;border-radius:50%;pointer-events:none;
          background:repeating-radial-gradient(circle at center,transparent 0 22px,rgba(184,146,58,.14) 22px 23px)}
        .eh-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${PX.gold}}
        .eh-h{font-family:${PX.serif};font-size:30px;font-weight:600;color:${PX.navy};line-height:1.12;margin-top:4px}
        .eh-h i{font-weight:500;color:#8a6118}
        .eh-search{position:relative;z-index:2;margin-top:16px;max-width:620px}
        .eh-search input{width:100%;height:52px;padding:0 54px 0 48px;border-radius:15px;border:1px solid ${PX.line2};background:#fff;font:600 15px ${PX.sans};color:${PX.ink};
          box-shadow:0 10px 26px -18px rgba(19,42,79,.5)}
        .eh-search .ic{position:absolute;left:16px;top:15px;color:${PX.gold}}
        .eh-search kbd,.eh-kbd{font:700 11px/1 ${PX.sans};padding:4px 7px;border-radius:6px;background:${PX.cream};border:1px solid ${PX.line2};color:${PX.sub}}
        .eh-search kbd{position:absolute;right:14px;top:16px}
        .eh-pop{position:absolute;left:0;right:0;top:58px;background:#fff;border:1px solid ${PX.line};border-radius:14px;box-shadow:0 24px 50px -22px rgba(19,42,79,.55);overflow:hidden;z-index:5}
        .eh-hit{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border:none;background:none;cursor:pointer;text-align:left;font-family:${PX.sans}}
        .eh-hit.on,.eh-hit:hover{background:${PX.goldBg}}
        .eh-ico{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--c);background:color-mix(in srgb,var(--c) 12%,#fff);border:1px solid color-mix(in srgb,var(--c) 22%,#fff)}
        .eh-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .eh-task{position:relative;overflow:hidden;display:flex;flex-direction:column;gap:12px;align-items:flex-start;padding:16px;border-radius:18px;border:1px solid ${PX.line};background:linear-gradient(180deg,#fff,#fcfbf7);
          cursor:pointer;text-align:left;font-family:${PX.sans};transition:transform .14s,box-shadow .18s,border-color .18s}
        .eh-task:hover{transform:translateY(-3px);border-color:var(--c);box-shadow:0 18px 30px -20px color-mix(in srgb,var(--c) 70%,#000)}
        .eh-task::before{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(233,217,176,.35) 50%,transparent 70%);transform:translateX(-120%);transition:transform .6s}
        .eh-task:hover::before{transform:translateX(120%)}
        .eh-task .eh-ico{width:44px;height:44px;border-radius:14px}
        .eh-card{background:#fff;border:1px solid ${PX.line};border-radius:20px;box-shadow:0 1px 2px rgba(19,42,79,.05),0 14px 34px -24px rgba(19,42,79,.4);padding:20px 22px}
        .eh-t{font-family:${PX.serif};font-size:17px;font-weight:600;color:${PX.ink}}
        .eh-s{font-size:12px;color:${PX.sub};margin-top:2px}
        .eh-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0;margin-top:18px;position:relative}
        .eh-step{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:0 6px;border:none;background:none;cursor:pointer;font-family:${PX.sans}}
        .eh-step::before{content:'';position:absolute;top:19px;left:-50%;right:50%;height:2px;background:${PX.line2}}
        .eh-step:first-child::before{display:none}
        .eh-step.done::before,.eh-step.next::before{background:linear-gradient(90deg,${PX.gold},${PX.goldLt})}
        .eh-dot{position:relative;z-index:1;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 15px ${PX.serif};
          background:#fff;border:2px solid ${PX.line2};color:${PX.sub};transition:transform .15s}
        .eh-step:hover .eh-dot{transform:scale(1.08)}
        .eh-step.done .eh-dot{background:${PX.okBg};border-color:${PX.ok};color:${PX.ok}}
        .eh-step.next .eh-dot{background:linear-gradient(145deg,${PX.navy2},${PX.navy});border-color:${PX.gold};color:#fff;box-shadow:0 0 0 5px rgba(184,146,58,.2)}
        .eh-two{display:grid;grid-template-columns:1.2fr 1fr;gap:18px;align-items:start}
        .eh-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;border:1px solid ${PX.line};background:${PX.tint};cursor:pointer;font:600 13px ${PX.sans};color:${PX.ink2};transition:border-color .15s,background .15s}
        .eh-chip:hover{border-color:${PX.gold};background:${PX.goldBg}}
        .eh-chip .eh-ico{width:26px;height:26px;border-radius:8px}
        @media (max-width:1000px){.eh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.eh-two{grid-template-columns:1fr}.eh-steps{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:18px}.eh-step::before{display:none}}
        @media (prefers-reduced-motion:reduce){.eh>*{animation:none}.eh-task::before{display:none}}
      `}</style>

      {/* Spotlight + search */}
      <div className="eh-spot">
        <div className="eh-eyebrow">{institute?.name || 'Examinations'}{role ? ` · ${role}` : ''}</div>
        <div className="eh-h">{greet}{who ? <>, <i>{who}</i></> : null}. What would you like to do?</div>
        <div className="eh-search">
          <svg className="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Try “marks”, “admit card”, “rank”, “timetable”…" aria-label="Search exam tools" />
          <kbd>/</kbd>
          {hits.length > 0 && (
            <div className="eh-pop">
              {hits.map((t, i) => (
                <button key={t.id} className={'eh-hit' + (i === cur ? ' on' : '')} onMouseEnter={() => setCur(i)} onClick={() => onSelect(t.id)}>
                  <span className="eh-ico" style={{ '--c': t.color }}><ExamIcon id={t.id} size={18} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 14, color: PX.ink }}>{t.label}</b>
                    <small style={{ color: PX.sub, fontSize: 12 }}>{t.tip}</small>
                  </span>
                  <small style={{ color: PX.faint, fontWeight: 700, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>{t.group}</small>
                </button>
              ))}
            </div>
          )}
          {needle && !hits.length && <div className="eh-pop" style={{ padding: 16, fontSize: 13, color: PX.sub }}>Nothing matches “{q}”. Try “marks”, “report” or “schedule”.</div>}
        </div>
      </div>

      {/* Tasks */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span className="eh-t">Most common jobs</span><span className="eh-s">One click — or press the key shown</span>
        </div>
        <div className="eh-grid">
          {tasks.map(t => (
            <button key={t.id} className="eh-task" style={{ '--c': t.color }} onClick={() => onSelect(t.id)}>
              <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                <span className="eh-ico"><ExamIcon id={t.id} size={22} /></span>
                <kbd className="eh-kbd">{t.key}</kbd>
              </span>
              <span>
                <b style={{ display: 'block', fontSize: 14.5, color: PX.ink }}>{t.title}</b>
                <small style={{ display: 'block', fontSize: 12, color: PX.sub, marginTop: 3, lineHeight: 1.4 }}>{t.hint}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Journey */}
      <div className="eh-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div><div className="eh-t">Your exam, step by step</div><div className="eh-s">Not sure where to start? Follow the gold step.</div></div>
          {next && <button className="eh-chip" style={{ background: `linear-gradient(180deg,${PX.navy2},${PX.navy})`, color: '#fff', borderColor: PX.navy }} onClick={() => onSelect(next.id)}>Next: {next.title} →</button>}
        </div>
        <div className="eh-steps">
          {JOURNEY.filter(s => allowed(s.id)).map(s => (
            <button key={s.id} className={'eh-step' + (done[s.id] ? ' done' : next?.id === s.id ? ' next' : '')} onClick={() => onSelect(s.id)}>
              <span className="eh-dot">{done[s.id] ? '✓' : s.n}</span>
              <b style={{ fontSize: 13, color: PX.ink }}>{s.title}</b>
              <small style={{ fontSize: 11.5, color: PX.sub, lineHeight: 1.35 }}>{s.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="eh-two">
        {/* Upcoming */}
        <div className="eh-card">
          <div className="eh-t">Coming up</div><div className="eh-s">Next scheduled papers</div>
          {upcoming.length === 0 ? (
            <div style={{ padding: '22px 0 4px', fontSize: 13, color: PX.sub }}>No upcoming papers. {allowed('schedule') && <button className="eh-chip" style={{ marginLeft: 8 }} onClick={() => onSelect('schedule')}>Plan a timetable</button>}</div>
          ) : upcoming.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: `1px solid ${PX.line}`, marginTop: 8 }}>
              <div style={{ width: 46, textAlign: 'center', padding: '5px 0', borderRadius: 11, background: PX.goldBg, border: `1px solid ${PX.goldLine}`, fontFamily: PX.serif, fontWeight: 600, fontSize: 13, color: '#8a6118', lineHeight: 1.2 }}>{fmtD(s.exam_date)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13.5, color: PX.ink }}>{s.subject || 'Paper'}</b>
                <div style={{ fontSize: 12, color: PX.sub }}>{[s.course, s.total_marks ? `${s.total_marks} marks` : null].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent + all tools */}
        <div className="eh-card">
          <div className="eh-t">Jump back in</div><div className="eh-s">{recent.length ? 'Tools you used last' : 'Your recent tools will appear here'}</div>
          {recent.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {recent.map(t => <button key={t.id} className="eh-chip" onClick={() => onSelect(t.id)}><span className="eh-ico" style={{ '--c': t.color }}><ExamIcon id={t.id} size={14} /></span>{t.label}</button>)}
          </div>}
          <div style={{ borderTop: `1px solid ${PX.line}`, margin: '16px 0 12px' }} />
          <div className="eh-t" style={{ fontSize: 14 }}>All tools</div>
          {groups.map(g => (
            <div key={g.groupLabel} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: g.color }}>{g.groupLabel}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {g.tabs.map(t => <button key={t.id} className="eh-chip" style={{ padding: '6px 10px', fontSize: 12.5 }} title={t.tip} onClick={() => onSelect(t.id)}>{t.label}</button>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
