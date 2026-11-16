// MissionSainikHome.jsx — the "Home" screen: mission progress ring, today's mission, quick actions, level / streak / badges.
import { PX } from './premiumUI'

const card = { background: '#fff', borderRadius: 24, padding: 16, boxShadow: '0 2px 14px rgba(19,42,79,.08)', marginBottom: 12, animation: 'msx-in .35s ease both' }

function Ring({ pct, size = 112, stroke = 12, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role="img" aria-label={`${pct}% of sections approved`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9d9b0" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{children}</div>
    </div>
  )
}

export default function MissionSainikHome({ upcoming = [], announcement, name, stats, game, nextTask, onGo, onOpenTask, quick, isMobile }) {
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = String(name || '').replace(/^(sir|miss|mr|mrs)\s+/i, '').split(' ')[0] || 'Teacher'
  return (
    <>
      {announcement && (
        <div role="note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', marginBottom: 12, borderRadius: 18, background: '#fff6dc', border: '1px solid #e9d9b0', color: '#5c4510', fontSize: 13.5, fontWeight: 600, animation: 'msx-in .3s ease both' }}>
          <span style={{ fontSize: 20 }}>📣</span><span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{announcement}</span>
        </div>)}
      <div style={{ borderRadius: 28, padding: 18, marginBottom: 12, color: '#fff', background: 'linear-gradient(135deg,#132a4f,#1e3a6e 60%,#2a4f8f)', boxShadow: '0 14px 34px rgba(19,42,79,.4)', animation: 'msx-in .3s ease both' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Ring pct={stats.pct}>
            <div style={{ fontSize: 27, fontWeight: 800, lineHeight: 1 }}>{stats.pct}%</div>
            <div style={{ fontSize: 10, letterSpacing: '.12em', color: '#e9d9b0', fontWeight: 700 }}>APPROVED</div>
          </Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#e9d9b0', fontWeight: 600 }}>{hello}, {first} 👋</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, margin: '3px 0 8px' }}>Mission Sainik 2027</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,.14)', borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>⏳ {stats.deadlineLabel}</span>
              <span style={{ background: 'rgba(255,255,255,.14)', borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>🎯 AISSEE {stats.examLabel}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto', paddingBottom: 2 }}>
          {[['Next test', stats.nextTest], ['In', stats.inLabel], ['Approved', stats.approved], ['Overdue', stats.overdue]].map(([l, v]) => (
            <div key={l} style={{ flex: '1 0 auto', minWidth: 78, background: 'rgba(255,255,255,.1)', borderRadius: 16, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: l === 'Overdue' && Number(v) > 0 ? '#fca5a5' : '#fff' }}>{v}</div>
              <div style={{ fontSize: 10.5, color: '#e9d9b0', fontWeight: 700, letterSpacing: '.06em' }}>{l.toUpperCase()}</div>
            </div>))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', color: PX.sub }}>TODAY'S MISSION</div>
        {nextTask ? (
          <button className="msx-tap" onClick={() => onOpenTask(nextTask.row)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 4px 2px' }}>
            <span style={{ width: 48, height: 48, borderRadius: 16, background: nextTask.late ? '#fdecea' : '#fff6dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{nextTask.late ? '🚨' : '✍️'}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 15.5, color: PX.ink }}>{nextTask.title}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: nextTask.late ? PX.bad : PX.sub, fontWeight: 600 }}>{nextTask.sub}</span>
            </span>
            <span style={{ fontWeight: 800, color: PX.gold, fontSize: 22 }}>›</span>
          </button>
        ) : (
          <div style={{ padding: '10px 4px 2px', fontSize: 14, color: PX.ink, fontWeight: 600 }}>🎉 You're all caught up. Check Insights or help a colleague verify.</div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', color: PX.sub, marginBottom: 8 }}>UPCOMING TESTS</div>
          {upcoming.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i ? '1px solid #eef1f6' : 'none' }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: '#eef2f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: PX.navy, lineHeight: 1.05 }}>
                <span style={{ fontSize: 15 }}>{u.date.split(' ')[0]}</span><span style={{ fontSize: 9.5, letterSpacing: '.08em' }}>{u.date.split(' ')[1]?.toUpperCase()}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 14.5 }}>{u.id} <span style={{ fontWeight: 600, color: PX.sub, fontSize: 12.5 }}>· {u.day} · {u.days === 0 ? 'today' : u.days === 1 ? 'tomorrow' : 'in ' + u.days + ' days'}</span></span>
                <span style={{ display: 'block', height: 6, borderRadius: 3, background: '#eef1f6', margin: '6px 0 3px', overflow: 'hidden' }}><span style={{ display: 'block', width: Math.round((u.done / u.total) * 100) + '%', height: '100%', background: 'linear-gradient(90deg,#b8923a,#e6c35e)' }} /></span>
                <span style={{ fontSize: 11.5, color: PX.sub, fontWeight: 600 }}>{u.done}/{u.total} sections in · drafts due {u.drafts}</span>
              </span>
            </div>))}
        </div>)}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        {quick.map(q => (
          <button key={q.id} className="msx-tap" onClick={() => onGo(q.id)} style={{ ...card, marginBottom: 0, padding: '14px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: PX.ink, position: 'relative' }}>
            <span style={{ width: 46, height: 46, borderRadius: 16, background: q.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23 }}>{q.icon}</span>{q.label}
            {q.badge ? <span style={{ position: 'absolute', top: 8, right: 10, minWidth: 18, height: 18, borderRadius: 9, background: PX.bad, color: '#fff', fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{q.badge}</span> : null}
          </button>))}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: 'linear-gradient(135deg,#b8923a,#e9d9b0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, animation: 'msx-pop .5s both' }}>🎖️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Level {game.level + 1} · {game.levelTitle}</div>
            <div style={{ height: 10, borderRadius: 5, background: '#eef1f6', margin: '6px 0 3px', overflow: 'hidden' }}>
              <div style={{ width: game.levelPct + '%', height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,#b8923a,#e0b95a)', transition: 'width .8s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: PX.sub, fontWeight: 600 }}>{game.xp} XP · {game.toNext} XP to the next rank</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26 }}>🔥</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{game.streak}<span style={{ fontSize: 11, color: PX.sub }}> day{game.streak === 1 ? '' : 's'}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '12px 0 4px', justifyContent: 'space-between' }} aria-label="Last 7 days">
          {game.week.map(d => (
            <div key={d.d} title={d.d} style={{ flex: 1, height: 30, borderRadius: 10, background: d.on ? '#e9d9b0' : '#f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{d.on ? '🔥' : ''}</div>))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {game.badges.map(b => (
            <span key={b.id} title={b.on ? 'Unlocked' : 'Locked'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: b.on ? '#fff6dc' : '#f0f2f7', color: b.on ? '#7a5a10' : '#9aa5b8', border: b.on ? '1px solid #e9d9b0' : '1px solid transparent', opacity: b.on ? 1 : 0.75 }}>
              <span style={{ filter: b.on ? 'none' : 'grayscale(1)' }}>{b.icon}</span>{b.label}
            </span>))}
        </div>
      </div>
    </>
  )
}
