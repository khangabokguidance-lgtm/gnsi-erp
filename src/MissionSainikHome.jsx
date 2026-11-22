// MissionSainikHome.jsx — the dashboard: notice board, programme summary, key figures, today's task, schedule table,
// service links, panel assignments and recognition. Laid out like an official portal dashboard.
import { Icon, hasIcon } from './MissionSainikIcons'

const CSS = `
.mh{display:grid;gap:20px;animation:msx-in .3s ease both}
.mh-notice{display:flex;gap:14px;align-items:flex-start;padding:14px 18px;border:1px solid #e3cf95;border-left:6px solid var(--gold);border-radius:6px;background:#fffaf0;color:#4d3a0b}
.mh-notice .tag{flex:none;margin-top:1px;padding:3px 9px;border-radius:3px;background:var(--gold);color:#fff;font-size:11px;font-weight:800;letter-spacing:.12em}
.mh-notice p{margin:0;flex:1;font-size:14.5px;font-weight:600;line-height:1.55;white-space:pre-wrap}
.mh-hero{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr);gap:0;border-radius:8px;overflow:hidden;background:var(--navy);color:#fff;box-shadow:0 4px 18px rgba(11,28,54,.22);border-bottom:4px solid var(--gold)}
.mh-hero .l{padding:26px 28px;background:linear-gradient(135deg,#0d2347,#17376b)}
.mh-hero .k{font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#e9d9b0}
.mh-hero h2{margin:6px 0 4px;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-.01em}
.mh-hero .hi{font-size:15px;color:#d5e0f4;margin:0 0 16px}
.mh-chips{display:flex;gap:8px;flex-wrap:wrap}
.mh-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border:1px solid rgba(255,255,255,.28);border-radius:4px;font-size:13px;font-weight:600;background:rgba(255,255,255,.07)}
.mh-hero .r{padding:26px 28px;background:#102b57;border-left:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;justify-content:center;gap:10px}
.mh-hero .pct{display:flex;align-items:baseline;gap:8px}.mh-hero .pct b{font-size:46px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}.mh-hero .pct span{font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#e9d9b0}
.mh-meter{height:10px;border-radius:2px;background:rgba(255,255,255,.18);overflow:hidden}.mh-meter i{display:block;height:100%;background:linear-gradient(90deg,#e6c35e,#f6e3a8);transition:width 1s ease}
.mh-hero .cap{font-size:12.5px;color:#c4d2ec}
.mh-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.mh-kpi{display:flex;align-items:center;gap:14px;padding:16px 18px;background:#fff;border:1px solid var(--line);border-top:4px solid var(--c,var(--navy));border-radius:6px;box-shadow:0 1px 2px rgba(16,24,40,.06)}
.mh-kpi .ic{width:44px;height:44px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--c,#132a4f) 12%,#fff);color:var(--c,var(--navy));flex:none}
.mh-kpi b{display:block;font-size:26px;line-height:1.1;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}
.mh-kpi span.l{display:block;margin-top:2px;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
.mh-cols{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,1fr);gap:20px;align-items:start}
.mh-col{display:grid;gap:20px;min-width:0}
.mh-panel{background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 1px 2px rgba(16,24,40,.06);overflow:hidden}
.mh-panel>header{display:flex;align-items:center;gap:10px;padding:13px 18px;background:#f6f8fc;border-bottom:1px solid var(--line)}
.mh-panel>header::before{content:'';width:4px;align-self:stretch;min-height:18px;background:var(--navy);border-radius:1px}
.mh-panel>header h3{margin:0;flex:1;font-size:15.5px;font-weight:800;color:var(--navy);letter-spacing:.005em}
.mh-panel>header a,.mh-panel>header button{font-size:13px;font-weight:700;color:var(--blue);text-decoration:underline;text-underline-offset:3px;padding:4px 2px}
.mh-body{padding:16px 18px}
.mh-task{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:14px 16px;border:1px solid var(--line);border-left:5px solid var(--c,var(--gold));border-radius:6px;background:#fff}
.mh-task:hover{background:#f4f8fe;border-color:#9fb4d6;border-left-color:var(--c,var(--gold))}
.mh-task .ic{width:44px;height:44px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#fff4d6;color:#8a6410;flex:none}.mh-task.late .ic{background:#fdecea;color:var(--bad)}
.mh-task b{display:block;font-size:15.5px;color:var(--ink)}.mh-task span.s{display:block;margin-top:2px;font-size:13px;font-weight:600;color:var(--sub)}.mh-task.late span.s{color:var(--bad)}
.mh-task .go{margin-left:auto;color:var(--blue)}
.mh-done{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid #bfe0cd;border-left:5px solid var(--ok);border-radius:6px;background:#f2faf5;color:#12492f;font-size:14.5px;font-weight:600}
.mh-sched{width:100%;border-collapse:collapse;font-size:14px}
.mh-sched th{padding:10px 18px;text-align:left;background:#e4ebf6;color:#10305f;border-bottom:2px solid var(--blue);font-size:11.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
.mh-sched td{padding:12px 18px;border-bottom:1px solid #e3e8f0;vertical-align:middle}
.mh-sched tbody tr:nth-child(even) td{background:#f8fafd}.mh-sched tbody tr:last-child td{border-bottom:0}
.mh-sched .id{font-weight:800;color:var(--navy)}
.mh-days{display:inline-block;padding:2px 9px;border-radius:3px;font-size:12px;font-weight:800;background:var(--tint);color:#10305f;white-space:nowrap}.mh-days.soon{background:#fff0d1;color:#7a4b00}.mh-days.now{background:#fde0dc;color:var(--bad)}
.mh-bar{display:flex;align-items:center;gap:10px;min-width:150px}.mh-bar .t{flex:1;height:8px;border-radius:2px;background:#e3e8f0;overflow:hidden}.mh-bar .t i{display:block;height:100%;background:var(--blue)}.mh-bar small{font-size:12px;font-weight:700;color:var(--sub);white-space:nowrap}
.mh-links{list-style:none;margin:0;padding:0}
.mh-links li+li{border-top:1px solid #e9edf4}
.mh-links button{display:flex;align-items:center;gap:13px;width:100%;padding:12px 18px;text-align:left;background:#fff}
.mh-links button:hover{background:#f0f5fc}
.mh-links .ic{width:38px;height:38px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:var(--tint);color:var(--navy);flex:none}
.mh-links b{display:block;font-size:14.5px;color:var(--ink)}.mh-links small{display:block;font-size:12.5px;color:var(--sub);margin-top:1px}
.mh-links .ch{margin-left:auto;color:var(--blue);flex:none}
.mh-quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:16px 18px}
.mh-quick button{position:relative;display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--line);border-radius:6px;background:#fff;font-size:13.5px;font-weight:700;color:var(--ink);text-align:left}
.mh-quick button:hover{background:#f0f5fc;border-color:#9fb4d6}.mh-quick .ic{color:var(--navy)}
.mh-quick .bd{margin-left:auto;min-width:20px;height:20px;border-radius:10px;background:var(--bad);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px}
.mh-roles{display:flex;gap:8px;flex-wrap:wrap}
.mh-role{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border:1px solid #9fb0cb;border-radius:4px;background:#fff;font-size:13.5px;font-weight:700;color:var(--navy);min-height:42px}
.mh-role:hover{background:var(--tint)}.mh-role em{font-style:normal;font-weight:600;color:var(--sub)}
.mh-lvl{display:flex;align-items:center;gap:14px}
.mh-lvl .badge{width:52px;height:52px;border-radius:6px;background:linear-gradient(135deg,#b8923a,#e9d9b0);color:#3d2d05;display:flex;align-items:center;justify-content:center;flex:none;animation:msx-pop .5s both}
.mh-lvl b{font-size:15.5px}.mh-lvl .m{flex:1;min-width:0}
.mh-lvl .t{height:8px;border-radius:2px;background:#e3e8f0;margin:7px 0 4px;overflow:hidden}.mh-lvl .t i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),#e0b95a)}
.mh-lvl small{font-size:12.5px;color:var(--sub);font-weight:600}
.mh-streak{text-align:center;color:#b45309;flex:none}.mh-streak b{display:block;font-size:20px;color:var(--ink);line-height:1}.mh-streak small{display:block;font-size:11px;color:var(--sub)}
.mh-week{display:flex;gap:5px;margin:14px 0 4px}.mh-week i{flex:1;height:30px;border-radius:4px;background:#eef1f6;display:flex;align-items:center;justify-content:center;color:#b45309}.mh-week i.on{background:#fbe9bd}
.mh-badges{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
.mh-badges span{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:4px;font-size:12.5px;font-weight:700;background:#f0f2f7;color:#8b97ad;border:1px solid transparent}
.mh-badges span.on{background:#fff6dc;color:#7a5a10;border-color:#e9d9b0}
@media (max-width:1100px){.mh-cols{grid-template-columns:1fr}.mh-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:700px){
  .mh{gap:14px}.mh-hero{grid-template-columns:1fr}.mh-hero .l,.mh-hero .r{padding:18px}.mh-hero .r{border-left:0;border-top:1px solid rgba(255,255,255,.12)}.mh-hero h2{font-size:25px}.mh-hero .pct b{font-size:38px}
  .mh-kpis{gap:10px}.mh-kpi{padding:12px;gap:10px}.mh-kpi .ic{width:36px;height:36px}.mh-kpi b{font-size:21px}.mh-kpi span.l{font-size:11px}
  .mh-notice{padding:12px;gap:10px}
  .mh-sched thead{display:none}.mh-sched,.mh-sched tbody{display:block}.mh-sched tr{display:grid;grid-template-columns:1fr auto;gap:6px 10px;padding:12px 16px;border-bottom:1px solid #e3e8f0}.mh-sched tr:last-child{border-bottom:0}.mh-sched td{padding:0;border:0;background:transparent!important}.mh-sched td.pr{grid-column:1/-1}
  .mh-sched td[data-l]::before{content:attr(data-l) ': ';font-size:11.5px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.05em}
}
`

const SERVICES = [
  ['prebuilder', 'Upload my questions', 'Add questions to a Pre Mock test'],
  ['practicebuilder', 'Make a practice set', 'Add up to 25 questions per subject'],
  ['mine', 'See my tasks', 'What I must set or verify, and by when'],
  ['syllabus', 'Check the syllabus', 'Which chapter is in which test'],
  ['marks', 'Enter test marks', 'Type or import results'],
  ['guide', 'I need help', 'Step-by-step guide for every screen'],
]

const Ic = ({ id, size = 22, fallback }) => (hasIcon(id) ? <Icon name={id} size={size} /> : <span aria-hidden="true">{fallback}</span>)

export default function MissionSainikHome({ upcoming = [], announcement, name, stats, game, nextTask, onGo, onOpenTask, quick = [], flow, myPanel = [] }) {
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = String(name || '').replace(/^(sir|miss|mr|mrs)\s+/i, '').split(' ')[0] || 'Teacher'
  const dayWord = u => (u.days === 0 ? 'Today' : u.days === 1 ? 'Tomorrow' : `In ${u.days} days`)
  const dayCls = u => (u.days <= 1 ? 'now' : u.days <= 5 ? 'soon' : '')
  const kpis = [
    ['Next test', stats.nextTest, 'schedule', '#1d4f91'],
    ['Submitted', stats.inLabel, 'upload', '#6d28d9'],
    ['Approved', stats.approved, 'check', '#0f7a4c'],
    ['Overdue', stats.overdue, 'alert', Number(stats.overdue) > 0 ? '#b42318' : '#5d6b82'],
  ]
  return (
    <div className="mh">
      <style>{CSS}</style>

      {announcement && (
        <div role="note" className="mh-notice"><span className="tag">NOTICE</span><p>{announcement}</p></div>)}

      <section className="mh-hero" aria-label="Programme summary">
        <div className="l">
          <div className="k">Programme dashboard</div>
          <h2>Mission Sainik 2027</h2>
          <p className="hi">{hello}, {first}. Here is where the programme stands today.</p>
          <div className="mh-chips">
            <span className="mh-chip"><Icon name="clock" size={16} />{stats.deadlineLabel}</span>
            <span className="mh-chip"><Icon name="mock" size={16} />AISSEE: {stats.examLabel}</span>
          </div>
        </div>
        <div className="r">
          <div className="pct"><b>{stats.pct}%</b><span>Approved</span></div>
          <div className="mh-meter" role="progressbar" aria-valuenow={stats.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Question sections approved"><i style={{ width: Math.min(100, stats.pct) + '%' }} /></div>
          <div className="cap">Share of all question sections that are set, verified and approved.</div>
        </div>
      </section>

      <section className="mh-kpis" aria-label="Key figures">
        {kpis.map(([l, v, ic, c]) => (
          <div key={l} className="mh-kpi" style={{ '--c': c }}>
            <span className="ic"><Icon name={ic} size={22} /></span>
            <span><b>{v}</b><span className="l">{l}</span></span>
          </div>))}
      </section>

      <div className="mh-cols">
        <div className="mh-col">
          <section className="mh-panel" aria-label="Today's task">
            <header><h3>Today's task</h3><button type="button" className="msx-tap" onClick={() => onGo('mine')}>All tasks</button></header>
            <div className="mh-body">
              {nextTask ? (
                <button type="button" className={'msx-tap mh-task' + (nextTask.late ? ' late' : '')} style={{ '--c': nextTask.late ? '#b42318' : '#b8923a' }} onClick={() => onOpenTask(nextTask.row)}>
                  <span className="ic"><Icon name={nextTask.late ? 'alert' : 'marks'} size={22} /></span>
                  <span><b>{nextTask.title}</b><span className="s">{nextTask.sub}</span></span>
                  <span className="go"><Icon name="chev" size={22} /></span>
                </button>
              ) : (
                <div className="mh-done"><Icon name="check" size={22} />You are all caught up. Check Insights, or help a colleague verify.</div>
              )}
            </div>
          </section>

          {flow}

          {upcoming.length > 0 && (
            <section className="mh-panel" aria-label="Upcoming tests">
              <header><h3>Upcoming tests</h3><button type="button" className="msx-tap" onClick={() => onGo('schedule')}>Full schedule</button></header>
              <table className="mh-sched">
                <thead><tr><th>Test</th><th>Date</th><th>When</th><th>Sections in</th><th>Drafts due</th></tr></thead>
                <tbody>
                  {upcoming.map(u => {
                    const pct = u.total ? Math.round((u.done / u.total) * 100) : 0
                    return (
                      <tr key={u.id}>
                        <td className="id" data-l="Test">{u.id}</td>
                        <td data-l="Date">{u.date} <span style={{ color: 'var(--sub)' }}>· {u.day}</span></td>
                        <td data-l="When"><span className={'mh-days ' + dayCls(u)}>{dayWord(u)}</span></td>
                        <td className="pr" data-l="Sections in"><span className="mh-bar"><span className="t"><i style={{ width: pct + '%' }} /></span><small>{u.done}/{u.total}</small></span></td>
                        <td data-l="Drafts due">{u.drafts}</td>
                      </tr>)
                  })}
                </tbody>
              </table>
            </section>)}
        </div>

        <aside className="mh-col" aria-label="Services and recognition">
          <section className="mh-panel">
            <header><h3>What would you like to do?</h3></header>
            <ul className="mh-links">
              {SERVICES.map(([id, t, d]) => (
                <li key={id}>
                  <button type="button" className="msx-tap" onClick={() => onGo(id)}>
                    <span className="ic"><Ic id={id} size={20} /></span>
                    <span style={{ minWidth: 0 }}><b>{t}</b><small>{d}</small></span>
                    <span className="ch"><Icon name="chev" size={20} /></span>
                  </button>
                </li>))}
            </ul>
          </section>

          {quick.length > 0 && (
            <section className="mh-panel">
              <header><h3>Quick access</h3></header>
              <div className="mh-quick">
                {quick.map(q => (
                  <button key={q.id} type="button" className="msx-tap" onClick={() => onGo(q.id)}>
                    <span className="ic"><Ic id={q.id} size={20} fallback={q.icon} /></span>{q.label}
                    {q.badge ? <span className="bd">{q.badge}</span> : null}
                  </button>))}
              </div>
            </section>)}

          {myPanel.length > 0 && (
            <section className="mh-panel">
              <header><h3>Your place on the panel</h3></header>
              <div className="mh-body">
                <div className="mh-roles">
                  {myPanel.map((m, i) => (
                    <button key={m.subject + m.role + i} type="button" className="msx-tap mh-role" onClick={() => onGo(m.role === 'setter' ? 'mine' : 'practice')}>
                      <Icon name={m.role === 'setter' ? 'prebuilder' : 'practice'} size={17} />{m.subject}<em>· {m.role}</em>
                    </button>))}
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--sub)' }}>Questions and study material for these subjects are yours to set. Select one to open your work.</p>
              </div>
            </section>)}

          <section className="mh-panel" aria-label="Recognition">
            <header><h3>Recognition</h3></header>
            <div className="mh-body">
              <div className="mh-lvl">
                <span className="badge"><Icon name="certs" size={28} /></span>
                <span className="m"><b>Level {game.level + 1} · {game.levelTitle}</b>
                  <div className="t"><i style={{ width: game.levelPct + '%' }} /></div>
                  <small>{game.xp} XP · {game.toNext} XP to the next rank</small></span>
                <span className="mh-streak"><Icon name="flame" size={26} fill="currentColor" stroke={1.2} /><b>{game.streak}</b><small>day{game.streak === 1 ? '' : 's'}</small></span>
              </div>
              <div className="mh-week" aria-label="Last 7 days">
                {game.week.map(d => <i key={d.d} title={d.d} className={d.on ? 'on' : ''}>{d.on ? <Icon name="flame" size={15} fill="currentColor" stroke={1.2} /> : null}</i>)}
              </div>
              <div className="mh-badges">
                {game.badges.map(b => (
                  <span key={b.id} className={b.on ? 'on' : ''} title={b.on ? 'Unlocked' : 'Locked'}>
                    <span style={{ filter: b.on ? 'none' : 'grayscale(1)', opacity: b.on ? 1 : 0.7, background: 'none', border: 0, padding: 0 }}>{b.icon}</span>{b.label}
                  </span>))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
