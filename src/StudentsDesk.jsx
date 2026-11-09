// StudentsDesk.jsx — landing screen of the Students module.
// One search that finds a student by name, GCC no., phone or parent and shows their
// live status; what needs attention (with one click to the right tab); shortcuts;
// and the students you opened last.
import { useEffect, useMemo, useRef, useState } from 'react'
import { readRecentStudents, pushRecentStudent } from './studentsRecent'

const V = {
  surface: 'var(--surface)', surface2: 'var(--surface2)', border: 'var(--border)', border2: 'var(--border2)',
  t1: 'var(--text1)', t2: 'var(--text2)', t3: 'var(--text3)', t4: 'var(--text4)',
  navy: '#132a4f', navy2: '#1e3a6e', gold: '#b8923a', goldBg: '#f6efdc', goldLine: '#e9d9b0',
  red: '#DC2626', redBg: '#FEF2F2', amber: '#D97706', amberBg: '#FFFBEB', green: '#059669', greenBg: '#ECFDF5',
  serif: "'Fraunces',Georgia,serif",
}
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export default function StudentsDesk({ students, feeData, attData, userName, isMobile, counts, onOpenDetail, onOpenFee, onEdit, canEdit, goTab }) {
  const [q, setQ] = useState('')
  const ref = useRef(null)
  const [recentIds] = useState(readRecentStudents)

  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
      if (e.key === '/') { e.preventDefault(); ref.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return students.filter(x =>
      String(x.name || '').toLowerCase().includes(s) || String(x.gcc_no || '').includes(s) ||
      String(x.phone || '').includes(s) || String(x.father_name || '').toLowerCase().includes(s)).slice(0, 8)
  }, [q, students])
  const recent = useMemo(() => recentIds.map(id => students.find(s => s.id === id)).filter(Boolean), [recentIds, students])

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const who = (userName || '').split(' ')[0]

  const queue = [
    { n: counts.courseIssues, tab: 'courseCheck', icon: '🛡️', tone: V.red, title: 'Students in the wrong exam list', sub: 'Course / batch mismatches, Combined students — fix in Course Check' },
    { n: counts.incomplete, tab: 'dataQuality', icon: '🧩', tone: V.amber, title: 'Records with missing details', sub: 'Complete them in Data Quality, worst first' },
    { n: counts.highDues, tab: 'students', icon: '💰', tone: V.amber, title: 'Students with fee dues above ₹10,000', sub: 'Open All Students and filter by dues' },
    { n: counts.lowAtt, tab: 'dashboard', icon: '📅', tone: V.red, title: 'Students with attendance below 50%', sub: 'See the attendance breakdown on the dashboard' },
  ].filter(x => x.n > 0)

  const tiles = [
    { tab: 'students', icon: '👥', label: 'All students', hint: 'Search, filter, edit' },
    { tab: 'courses', icon: '📚', label: 'Courses', hint: 'By course and batch' },
    { tab: 'courseCheck', icon: '🛡️', label: 'Course Check', hint: 'Combined & mismatches', badge: counts.courseIssues },
    { tab: 'dataQuality', icon: '🧩', label: 'Data Quality', hint: 'Complete records', badge: counts.incomplete },
    { tab: 'scholarship', icon: '🎓', label: 'Scholarship / Waiver', hint: 'Requests & approvals' },
    { tab: 'dashboard', icon: '📊', label: 'Dashboard', hint: 'Fees, attendance, exams' },
  ]

  const card = { background: V.surface, border: `1px solid ${V.border}`, borderRadius: 18, boxShadow: '0 12px 30px -24px rgba(19,42,79,.4)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes sdRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .sd>*{animation:sdRise .5s cubic-bezier(.2,.7,.2,1) both}.sd>*:nth-child(2){animation-delay:.06s}.sd>*:nth-child(3){animation-delay:.12s}
        .sd-tile{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid ${V.border};border-radius:16px;background:${V.surface};cursor:pointer;font-family:inherit;text-align:left;position:relative;transition:transform .14s,border-color .15s,box-shadow .15s}
        .sd-tile:hover{transform:translateY(-2px);border-color:${V.gold};box-shadow:0 14px 26px -18px rgba(19,42,79,.5)}
        .sd-hit{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border:none;border-top:1px solid ${V.border};background:none;font-family:inherit;text-align:left}
        .sd-hit:hover{background:${V.surface2}}
        @media (prefers-reduced-motion:reduce){.sd>*{animation:none}}
      `}</style>
      <div className="sd" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Spotlight + search */}
        <div style={{ position: 'relative', borderRadius: 22, padding: isMobile ? '18px 16px' : '24px 28px', background: 'radial-gradient(70% 130% at 0% 0%,rgba(184,146,58,.17),transparent 60%),linear-gradient(135deg,#fffdf7,#f6efdc)', border: `1px solid ${V.goldLine}`, boxShadow: '0 18px 40px -26px rgba(138,97,24,.6)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: V.gold }}>Students · {students.length} on roll</div>
          <div style={{ fontFamily: V.serif, fontSize: isMobile ? 24 : 30, fontWeight: 600, color: V.navy, lineHeight: 1.12, marginTop: 4 }}>{greet}{who ? <>, <i style={{ fontWeight: 500, color: '#8a6118' }}>{who}</i></> : null}. Who are you looking for?</div>
          <div style={{ position: 'relative', marginTop: 16, maxWidth: 640 }}>
            <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Name, GCC no., phone or parent’s name…" aria-label="Find a student"
              style={{ width: '100%', height: 52, padding: '0 54px 0 18px', borderRadius: 15, border: `1px solid ${V.border2}`, background: '#fff', color: '#0f1b2e', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', boxShadow: '0 10px 26px -18px rgba(19,42,79,.5)', boxSizing: 'border-box' }} />
            {!isMobile && <kbd style={{ position: 'absolute', right: 14, top: 16, font: '700 11px/1 inherit', padding: '4px 7px', borderRadius: 6, background: '#f7f5f0', border: `1px solid ${V.border2}`, color: '#5d6b82' }}>/</kbd>}
          </div>
        </div>

        {q.trim().length >= 2 && (
          <div style={{ ...card, overflow: 'hidden' }}>
            {hits.length === 0 ? <div style={{ padding: 22, fontSize: 13, color: V.t3 }}>No student matches “{q}”.</div> : hits.map((s, i) => {
              const dues = feeData[s.id]?.dues || 0, att = attData[s.id]
              return (
                <div key={s.id} className="sd-hit" style={i === 0 ? { borderTop: 'none' } : undefined}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ color: V.t1, fontSize: 14 }}>{s.name}</b>
                    <div style={{ fontSize: 12, color: V.t3 }}>{[s.course, s.batch, s.house, s.gcc_no ? 'GCC ' + s.gcc_no : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  {!isMobile && <>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: s.status === 'Active' ? V.greenBg : V.surface2, color: s.status === 'Active' ? V.green : V.t3 }}>{s.status || '—'}</span>
                    {dues > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: V.amberBg, color: V.amber }}>{inr(dues)} due</span>}
                    {att != null && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: att < 50 ? V.redBg : V.surface2, color: att < 50 ? V.red : V.t2 }}>{att.toFixed(0)}% att.</span>}
                  </>}
                  <button onClick={() => { pushRecentStudent(s.id); onOpenDetail(s) }} style={{ height: 32, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: '#fff', background: `linear-gradient(180deg,${V.navy2},${V.navy})` }}>Profile</button>
                  <button onClick={() => onOpenFee(s)} style={{ height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${V.border2}`, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: V.t2, background: V.surface }}>Fee</button>
                  {canEdit && <button onClick={() => onEdit(s)} style={{ height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${V.border2}`, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: V.t2, background: V.surface }}>Edit</button>}
                </div>
              )
            })}
          </div>
        )}

        {/* Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))', gap: 12 }}>
          {tiles.map(t => (
            <button key={t.tab} className="sd-tile" onClick={() => goTab(t.tab)}>
              <span style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: V.goldBg, border: `1px solid ${V.goldLine}`, flexShrink: 0 }}>{t.icon}</span>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13.5, color: V.t1 }}>{t.label}</b>
                <small style={{ display: 'block', fontSize: 11.5, color: V.t3, marginTop: 2 }}>{t.hint}</small>
              </span>
              {t.badge > 0 && <span style={{ position: 'absolute', top: 10, right: 10, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, background: V.red, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '15px 20px', borderBottom: `1px solid ${V.border}` }}>
              <div style={{ fontFamily: V.serif, fontSize: 17, fontWeight: 600, color: V.t1 }}>Needs attention</div>
              <div style={{ fontSize: 12, color: V.t3, marginTop: 2 }}>{queue.length ? 'Click an item to go straight to the fix' : 'All clear'}</div>
            </div>
            {queue.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: V.t3, fontSize: 13 }}>✅ Nothing needs attention right now.</div> : queue.map(it => (
              <button key={it.title} onClick={() => goTab(it.tab)} className="sd-hit" style={{ cursor: 'pointer', borderLeft: `3px solid ${it.tone}` }}>
                <span style={{ fontSize: 20 }}>{it.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13, color: V.t1 }}>{it.n} · {it.title}</b>
                  <small style={{ color: V.t3, fontSize: 11.5 }}>{it.sub}</small>
                </span>
                <span style={{ color: V.t4 }}>→</span>
              </button>
            ))}
          </div>

          <div style={{ ...card, padding: '15px 20px' }}>
            <div style={{ fontFamily: V.serif, fontSize: 17, fontWeight: 600, color: V.t1 }}>Recently opened</div>
            <div style={{ fontSize: 12, color: V.t3, marginTop: 2 }}>{recent.length ? 'Jump back to a profile' : 'Students you open will appear here'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {recent.map(s => (
                <button key={s.id} onClick={() => { pushRecentStudent(s.id); onOpenDetail(s) }} style={{ border: `1px solid ${V.border}`, background: V.surface2, borderRadius: 12, padding: '8px 12px', fontWeight: 600, fontSize: 12.5, color: V.t2, cursor: 'pointer', fontFamily: 'inherit' }}>{s.name}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
