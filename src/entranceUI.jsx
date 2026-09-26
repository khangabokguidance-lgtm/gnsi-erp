// entranceUI.jsx — small shared building blocks for the Entrance module,
// on top of premiumUI's navy/gold "Ledger & Crest" shell.

import { useEffect } from 'react'
import { PX } from './premiumUI'
import { STATUS_TONE } from './entranceHooks'

export function EntranceStyles() {
  return (
    <style>{`
      .ex-grid{display:grid;gap:14px}
      .ex-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
      .ex-g3{grid-template-columns:repeat(3,minmax(0,1fr))}
      .ex-g4{grid-template-columns:repeat(4,minmax(0,1fr))}
      .ex-side{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
      @media (max-width:900px){.ex-g4{grid-template-columns:repeat(2,minmax(0,1fr))}.ex-g3,.ex-side{grid-template-columns:minmax(0,1fr)}}
      @media (max-width:640px){.ex-g2,.ex-g4{grid-template-columns:minmax(0,1fr)}}
      .ex-label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${PX.sub};margin-bottom:5px}
      .ex-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
      .ex-tablewrap{overflow-x:auto;margin:-18px -20px}
      .ex-btn-sm{padding:6px 11px!important;font-size:12px!important;border-radius:9px!important}
      .ex-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;white-space:nowrap;border:1px solid transparent}
      button.ex-chip{cursor:pointer;font-family:inherit}
      .ex-step{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid ${PX.line};border-radius:14px;background:#fff;cursor:pointer;text-align:left;width:100%;font-family:inherit;transition:border-color .15s,transform .12s}
      .ex-step:hover{border-color:${PX.gold};transform:translateY(-1px)}
      .ex-dot{width:30px;height:30px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px}
      .ex-prog{height:5px;border-radius:5px;background:#f1ede3;overflow:hidden;margin-top:7px}
      .ex-prog>div{height:100%;border-radius:5px;background:linear-gradient(90deg,${PX.gold},#d4ae58)}
      .ex-mono{font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.04em}
      .ex-omr{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px;letter-spacing:.28em;text-transform:uppercase}
      .ex-kpi{border:1px solid ${PX.line};border-radius:14px;padding:12px 14px;background:linear-gradient(180deg,#fff,#fcfbf7)}
      .ex-kpi .k{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${PX.sub}}
      .ex-kpi .v{font-family:${PX.serif};font-size:24px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums}
      .ex-hero-select{height:40px;border-radius:12px;border:1px solid rgba(233,217,176,.45);background:rgba(255,255,255,.08);color:#fff;padding:0 12px;font:600 13px/1 ${PX.sans};max-width:320px}
      .ex-hero-select option{color:${PX.ink}}
      .ex-modal-bg{position:fixed;inset:0;background:rgba(14,32,63,.45);display:flex;align-items:flex-start;justify-content:center;z-index:1000;padding:4vh 12px;overflow-y:auto}
      .ex-modal{background:#fff;border-radius:18px;width:100%;box-shadow:0 30px 60px -20px rgba(14,32,63,.5);overflow:hidden}
      .ex-row-sel td{background:#fbf6e8!important}
      .ex-empty{text-align:center;padding:44px 16px;color:${PX.sub}}
      .ex-empty .i{font-size:34px;margin-bottom:8px}
      .ex-q{border:1px solid ${PX.line};border-radius:12px;padding:10px 12px;background:#fff}
    `}</style>
  )
}

const TONES = {
  navy: [PX.navy, '#e4ebf6'], gold: ['#8a6118', PX.goldBg], ok: [PX.ok, PX.okBg], bad: [PX.bad, PX.badBg],
  warn: [PX.warn, PX.warnBg], grey: [PX.sub, '#f3f0e8'], teal: ['#0f766e', '#ddf4ef'],
}
export function Chip({ tone = 'grey', children, onClick, title }) {
  const [fg, bg] = TONES[tone] || TONES.grey
  const Tag = onClick ? 'button' : 'span'
  return <Tag className="ex-chip" style={{ color: fg, background: bg, borderColor: fg + '22' }} onClick={onClick} title={title}>{children}</Tag>
}
export const StatusChip = ({ s, onClick, title }) => <Chip tone={STATUS_TONE[s] || 'grey'} onClick={onClick} title={title}>{s || '—'}</Chip>

export function Field({ label, children, span, hint }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label className="ex-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: PX.faint, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function Kpi({ k, v, tone, sub }) {
  return (
    <div className="ex-kpi">
      <div className="k">{k}</div>
      <div className="v" style={{ color: tone || PX.ink }}>{v}</div>
      {sub && <div style={{ fontSize: 11, color: PX.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Empty({ icon = '📋', title, children }) {
  return (
    <div className="ex-empty">
      <div className="i">{icon}</div>
      <div style={{ fontFamily: PX.serif, fontSize: 17, color: PX.ink, fontWeight: 600 }}>{title}</div>
      {children && <div style={{ fontSize: 13, marginTop: 6 }}>{children}</div>}
    </div>
  )
}

export function Modal({ title, subtitle, onClose, children, width = 720, footer }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="ex-modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="ex-modal" style={{ maxWidth: width }} role="dialog" aria-label={title}>
        <div className="px-card-h">
          <span className="bar" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="px-card-t">{title}</div>
            {subtitle && <div className="px-card-s">{subtitle}</div>}
          </div>
          <button className="px-btn ghost ex-btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: '18px 20px', maxHeight: '72vh', overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '12px 20px', borderTop: `1px solid ${PX.line}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', background: PX.tint }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({ message, danger = true, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <Modal title="Please confirm" onClose={onCancel} width={440}
      footer={<>
        <button className="px-btn ghost" onClick={onCancel}>Cancel</button>
        <button className="px-btn" style={danger ? { background: PX.bad } : undefined} onClick={onConfirm}>{confirmLabel}</button>
      </>}>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: PX.ink2 }}>{message}</div>
    </Modal>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  const bg = toast.tone === 'bad' ? PX.bad : toast.tone === 'warn' ? '#8a5a00' : toast.tone === 'ok' ? PX.ok : PX.navy
  return (
    <div role="status" style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: bg, color: '#fff', padding: '11px 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, zIndex: 1100, boxShadow: '0 14px 30px -10px rgba(0,0,0,.4)', maxWidth: 'calc(100vw - 32px)' }}>
      {toast.msg}
    </div>
  )
}

export function Progress({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return <div className="ex-prog"><div style={{ width: `${pct}%` }} /></div>
}

// Needs-an-exam guard used by every per-exam tab.
export function NeedExam({ exam, children }) {
  if (!exam) return <div className="px-card"><Empty icon="🗂️" title="Select or create an exam">Pick an exam from the selector at the top, or create one in the Exams tab.</Empty></div>
  return children
}
