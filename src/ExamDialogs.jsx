// ExamDialogs.jsx — in-app confirm dialog + toasts for the Exams module,
// replacing the browser's blocking alert()/confirm() boxes.
import { useEffect, useState } from 'react'
import { dialogBus } from './examShared'
import { PX } from './premiumUI'

const TONE = {
  info:  { bg: '#fff', bar: PX.navy, ic: 'ℹ️' },
  ok:    { bg: '#f1faf5', bar: PX.ok, ic: '✅' },
  warn:  { bg: '#fff9ec', bar: PX.gold, ic: '⚠️' },
  error: { bg: '#fff3f1', bar: PX.bad, ic: '⛔' },
}

export default function ExamDialogHost() {
  const [toasts, setToasts] = useState([])
  const [ask, setAsk] = useState(null)

  useEffect(() => dialogBus.on(ev => {
    if (ev.type === 'toast') {
      setToasts(t => [...t.slice(-3), ev])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== ev.id)), ev.kind === 'error' ? 7000 : 4200)
    } else if (ev.type === 'confirm') setAsk(ev)
  }), [])

  const close = ok => { ask?.resolve(ok); setAsk(null) }
  useEffect(() => {
    if (!ask) return undefined
    const onKey = e => { if (e.key === 'Escape') close(false); if (e.key === 'Enter') close(true) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes exdPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
        .exd-toasts{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100000;display:flex;flex-direction:column;gap:8px;width:min(460px,calc(100vw - 24px));pointer-events:none}
        .exd-toast{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;border:1px solid ${PX.line};border-left-width:4px;
          box-shadow:0 18px 40px -18px rgba(19,42,79,.55);font:600 13px/1.4 ${PX.sans};color:${PX.ink};animation:exdPop .25s ease both}
        .exd-veil{position:fixed;inset:0;z-index:100001;background:rgba(14,32,63,.45);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px}
        .exd-box{width:min(430px,100%);background:#fff;border-radius:20px;border:1px solid ${PX.goldLine};box-shadow:0 30px 70px -20px rgba(14,32,63,.6);overflow:hidden;animation:exdPop .22s ease both;font-family:${PX.sans}}
        .exd-box::before{content:'';display:block;height:3px;background:linear-gradient(90deg,${PX.gold},${PX.goldLt},${PX.gold})}
        .exd-btn{height:40px;padding:0 18px;border-radius:11px;border:1px solid ${PX.line2};background:#fff;font:700 13px ${PX.sans};color:${PX.ink2};cursor:pointer}
        .exd-btn.p{border:none;color:#fff;background:linear-gradient(180deg,${PX.navy2},${PX.navy})}
        .exd-btn.d{border:none;color:#fff;background:linear-gradient(180deg,#d1453b,${PX.bad})}
      `}</style>
      <div className="exd-toasts" aria-live="polite">
        {toasts.map(t => { const k = TONE[t.kind] || TONE.info; return (
          <div key={t.id} className="exd-toast" style={{ background: k.bg, borderLeftColor: k.bar }}>
            <span>{k.ic}</span><span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => setToasts(x => x.filter(y => y.id !== t.id))} aria-label="Dismiss" style={{ border: 'none', background: 'none', cursor: 'pointer', color: PX.faint, fontSize: 14 }}>✕</button>
          </div>) })}
      </div>
      {ask && (
        <div className="exd-veil" onClick={() => close(false)}>
          <div className="exd-box" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '22px 24px 8px' }}>
              <div style={{ fontFamily: PX.serif, fontSize: 19, fontWeight: 600, color: PX.navy }}>{ask.danger ? 'Please confirm' : 'Before you continue'}</div>
              <div style={{ fontSize: 13.5, color: PX.ink2, marginTop: 8, lineHeight: 1.55 }}>{ask.message}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px 20px' }}>
              <button className="exd-btn" onClick={() => close(false)}>Cancel</button>
              <button className={'exd-btn ' + (ask.danger ? 'd' : 'p')} autoFocus onClick={() => close(true)}>{ask.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
