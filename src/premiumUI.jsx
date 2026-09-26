// premiumUI.jsx — shared "Ledger & Crest" premium shell for GNSI modules.
// Navy #132a4f · antique gold #b8923a · warm ivory surfaces · Fraunces serif titles.
// Used by Courses, Grievances, HR, Kitchen, Leave and Reports so every module
// opens with the same header, tabs, cards and controls as Students / Fees /
// Attendance / Reception.

export const PX = {
  navy: '#132a4f', navy2: '#1e3a6e', navyDeep: '#0e203f',
  gold: '#b8923a', goldLt: '#e9d9b0', goldBg: '#f6efdc', goldLine: '#eadbb2',
  ink: '#0f1b2e', ink2: '#2e3b52', sub: '#5d6b82', faint: '#8a93a6',
  line: '#e8e3d8', line2: '#d9d2c2', cream: '#f7f5f0', paper: '#ffffff', tint: '#faf8f3',
  ok: '#0f7a4c', okBg: '#e8f5ee', bad: '#b42318', badBg: '#fdecea', warn: '#9a5b00', warnBg: '#fff5e0',
  serif: "'Fraunces','Playfair Display',Georgia,serif",
  sans: "'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif",
}

// One stylesheet for every premium module (scoped under .px-root).
export function PremiumStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
      .px-root{font-family:${PX.sans};background:${PX.cream};color:${PX.ink};min-height:100vh;-webkit-font-smoothing:antialiased}
      .px-root *{box-sizing:border-box}
      .px-root input,.px-root select,.px-root textarea,.px-root button{font-family:inherit}
      .px-root input:focus,.px-root select:focus,.px-root textarea:focus{outline:none;border-color:${PX.gold}!important;box-shadow:0 0 0 4px rgba(184,146,58,.16)!important}
      .px-wrap{max-width:1200px;margin:0 auto;padding:22px 24px 36px}
      .px-hero{position:relative;overflow:hidden;border-radius:22px;color:#fff;padding:22px 26px 20px;margin-bottom:16px;
        background:radial-gradient(90% 140% at 100% 0%,rgba(184,146,58,.28) 0%,transparent 55%),linear-gradient(135deg,${PX.navyDeep} 0%,${PX.navy} 45%,${PX.navy2} 100%);
        box-shadow:0 24px 48px -24px rgba(19,42,79,.55)}
      .px-hero::before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:14px 14px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 70%);mask-image:linear-gradient(90deg,transparent,#000 70%);pointer-events:none}
      .px-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,${PX.gold},transparent)}
      .px-hero>*{position:relative}
      .px-hbtn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 15px;border-radius:12px;font:700 13px/1 ${PX.sans};cursor:pointer;white-space:nowrap;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.22);transition:background .15s,transform .12s}
      .px-hbtn:hover{background:rgba(255,255,255,.16);transform:translateY(-1px)}
      .px-hbtn.on{background:rgba(233,217,176,.2);border-color:rgba(233,217,176,.6)}
      .px-hbtn.gold{background:linear-gradient(180deg,#d4ae58,${PX.gold});color:#1a1406;border-color:#a37f2e;box-shadow:0 8px 18px -8px rgba(184,146,58,.8)}
      .px-hbtn.gold:hover{filter:brightness(1.05)}
      .px-hstat{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:11px 14px;min-width:0;text-align:left;font-family:${PX.sans};color:#fff}
      button.px-hstat{cursor:pointer;transition:background .15s,border-color .15s}
      button.px-hstat:hover{background:rgba(255,255,255,.11)}
      button.px-hstat.on{border-color:rgba(233,217,176,.7);background:rgba(233,217,176,.14)}
      .px-tabs{display:flex;gap:4px;padding:5px;background:#fff;border:1px solid ${PX.line};border-radius:14px;box-shadow:0 1px 2px rgba(19,42,79,.05);overflow-x:auto;scrollbar-width:none;margin-bottom:18px}
      .px-tabs::-webkit-scrollbar{display:none}
      .px-tab{position:relative;display:flex;align-items:center;gap:7px;padding:9px 15px;border:none;border-radius:10px;background:none;cursor:pointer;font:600 13.5px/1 ${PX.sans};color:${PX.sub};white-space:nowrap;transition:background .15s,color .15s}
      .px-tab:hover{color:${PX.ink};background:#f3f0e8}
      .px-tab.on{background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:#fff;box-shadow:0 6px 14px -6px rgba(19,42,79,.6)}
      .px-tab.on svg{color:${PX.goldLt}}
      .px-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#dc2626;color:#fff;font-size:10.5px;font-weight:800;line-height:1}
      .px-tab.on .px-badge{background:${PX.gold};color:#1a1406}
      .px-card{background:#fff;border:1px solid ${PX.line};border-radius:18px;box-shadow:0 1px 2px rgba(19,42,79,.05),0 12px 32px -22px rgba(19,42,79,.35);overflow:hidden}
      .px-card-h{display:flex;align-items:center;gap:12px;padding:15px 20px;border-bottom:1px solid ${PX.line};background:linear-gradient(180deg,#fff,#fcfbf7)}
      .px-card-h .bar{width:4px;align-self:stretch;min-height:24px;border-radius:4px;background:linear-gradient(180deg,${PX.gold},${PX.goldLt});flex-shrink:0}
      .px-card-t{font-family:${PX.serif};font-size:16.5px;font-weight:600;color:${PX.ink};line-height:1.25}
      .px-card-s{font-size:12px;color:${PX.sub};margin-top:2px}
      .px-input{width:100%;padding:10px 13px;border:1px solid ${PX.line};border-radius:11px;font-size:13.5px;background:#fff;color:${PX.ink}}
      .px-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 18px;border-radius:11px;border:none;cursor:pointer;font-weight:700;font-size:13.5px;background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:#fff;box-shadow:0 6px 14px -8px rgba(19,42,79,.7);white-space:nowrap}
      .px-btn:disabled{background:${PX.line2};box-shadow:none;cursor:not-allowed}
      .px-btn.ghost{background:#fff;color:${PX.ink2};border:1px solid ${PX.line2};box-shadow:none}
      .px-btn.gold{background:linear-gradient(180deg,#d4ae58,${PX.gold});color:#1a1406}
      .px-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
      .px-table th{position:sticky;top:0;background:${PX.tint};text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${PX.sub};padding:11px 14px;border-bottom:1px solid ${PX.line};white-space:nowrap}
      .px-table td{padding:12px 14px;border-bottom:1px solid #f1ede3;color:${PX.ink2};vertical-align:middle}
      .px-table tbody tr:hover td{background:#fcfaf5}
      .px-section{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:4px 0 14px}
      .px-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${PX.gold}}
      .px-h2{font-family:${PX.serif};font-size:22px;font-weight:600;color:${PX.ink}}
      @media (max-width:640px){.px-wrap{padding:12px 12px 90px}.px-hero{border-radius:18px;padding:16px 14px 14px}.px-tab{padding:9px 12px;font-size:13px}.px-h2{font-size:19px}}
    `}</style>
  )
}

// Hero header: eyebrow, title, subtitle, icon, action buttons and a stat row.
// stats: [{ label, value, sub, tone, onClick, active }]
export function PremiumHero({ eyebrow, title, subtitle, icon, actions, stats = [], isMobile, children }) {
  const cols = isMobile ? Math.min(stats.length, 2) : Math.min(stats.length, 6)
  return (
    <section className="px-hero" style={isMobile ? { padding: '16px 14px 14px' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          {icon && (
            <div style={{ width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 14, flexShrink: 0, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(233,217,176,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: PX.goldLt }}>
              {icon}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: PX.goldLt }}>{eyebrow}</div>}
            <div style={{ fontFamily: PX.serif, fontSize: isMobile ? 24 : 30, fontWeight: 600, lineHeight: 1.1, marginTop: 2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.62)', marginTop: 4 }}>{subtitle}</div>}
          </div>
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
      </div>
      {children}
      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 10, marginTop: 18 }}>
          {stats.map(s => {
            const Tag = s.onClick ? 'button' : 'div'
            return (
              <Tag key={s.label} className={'px-hstat' + (s.active ? ' on' : '')} onClick={s.onClick}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase', color: 'rgba(255,255,255,.58)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                <div style={{ fontFamily: PX.serif, fontSize: isMobile ? 21 : 26, fontWeight: 600, color: s.tone || '#fff', marginTop: 5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</div>}
              </Tag>
            )
          })}
        </div>
      )}
    </section>
  )
}

// Pill tab bar. tabs: [{ id, label, icon (component), badge }]
export function PremiumTabs({ tabs, active, onChange, style }) {
  return (
    <nav className="px-tabs" role="tablist" style={style}>
      {tabs.map(t => {
        const I = t.icon
        return (
          <button key={t.id} role="tab" aria-selected={active === t.id} className={'px-tab' + (active === t.id ? ' on' : '')} onClick={() => onChange(t.id)}>
            {I && <I size={15} />}{t.label}
            {t.badge > 0 && <span className="px-badge">{t.badge}</span>}
          </button>
        )
      })}
    </nav>
  )
}

export function PremiumCard({ title, subtitle, right, children, bodyStyle, style }) {
  return (
    <div className="px-card" style={style}>
      {title && (
        <div className="px-card-h">
          <span className="bar" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="px-card-t">{title}</div>
            {subtitle && <div className="px-card-s">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: '18px 20px', ...bodyStyle }}>{children}</div>
    </div>
  )
}

const svg = (p, children, extra = {}) => (
  <svg viewBox="0 0 24 24" width={p?.size || 16} height={p?.size || 16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...extra}>{children}</svg>
)
export const PIcon = {
  cap:      p => svg(p, <><path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/></>),
  layers:   p => svg(p, <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></>),
  users:    p => svg(p, <><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c3 .3 5.5 2.4 5.5 5.8"/></>),
  rupee:    p => svg(p, <><path d="M7 5h10M7 9h10M13 5c3 0 3 8-3 8H7l7 7"/></>),
  chart:    p => svg(p, <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>),
  message:  p => svg(p, <><path d="M4 5h16v11H9l-5 4Z"/><path d="M12 8v4M12 14.5v.01"/></>),
  folder:   p => svg(p, <><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z"/></>),
  leaf:     p => svg(p, <><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/></>),
  bowl:     p => svg(p, <><path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7c0-1 1-1.5 1-2.5M12 7c0-1 1-1.5 1-2.5M16 7c0-1 1-1.5 1-2.5"/></>),
  report:   p => svg(p, <><path d="M7 3h7l5 5v13H7Z"/><path d="M14 3v5h5M10 17v-3M13 17v-5M16 17v-2"/></>),
  calendar: p => svg(p, <><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></>),
  list:     p => svg(p, <><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></>),
  download: p => svg(p, <><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></>),
  plus:     p => svg(p, <path d="M12 5v14M5 12h14"/>, { strokeWidth: 2.2 }),
  print:    p => svg(p, <><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7Z"/></>),
  clock:    p => svg(p, <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>),
  shield:   p => svg(p, <><path d="M12 3 4 6.5v5.5c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/></>),
  file:     p => svg(p, <><path d="M7 3h7l5 5v13H7Z"/><path d="M14 3v5h5"/></>),
  alert:    p => svg(p, <><path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17v.01"/></>),
  pen:      p => svg(p, <><path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></>),
  scale:    p => svg(p, <><path d="M12 4v16M6 20h12M4 8h16M6 8l-3 6a3 3 0 0 0 6 0Zm12 0-3 6a3 3 0 0 0 6 0Z"/></>),
  whatsapp: p => svg(p, <><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.3-1.3-2-1-1 .8a4 4 0 0 1-2.3-2.3l.8-1-1-2Z"/></>),
  settings: p => svg(p, <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>),
}

// Old cool-grey / indigo / purple hexes → portal palette. Status reds,
// greens and ambers are intentionally left alone.
export const PX_REMAP = {
  '#e2e8f0':'#e8e3d8','#cbd5e1':'#d9d2c2','#d1d5db':'#d9d2c2','#e5e7eb':'#e8e3d8','#f3f4f6':'#f3f0e8','#f9fafb':'#faf8f3',
  '#f8fafc':'#faf8f3','#f1f5f9':'#f3f0e8','#64748b':'#5d6b82','#6b7280':'#5d6b82','#94a3b8':'#8a93a6','#9ca3af':'#8a93a6',
  '#475569':'#4b5870','#4b5563':'#4b5870','#334155':'#2e3b52','#374151':'#2e3b52','#1e293b':'#14213d','#111827':'#0f1b2e','#0f172a':'#0f1b2e',
  '#7c3aed':'#a7771f','#6d28d9':'#8a6118','#8b5cf6':'#b8923a','#f5f3ff':'#fbf3e0','#ede9fe':'#f6ecd2','#c4b5fd':'#e2c57e','#ddd6fe':'#eadbb2',
  '#4f46e5':'#1e3a6e','#6366f1':'#2f4f86','#3730a3':'#132a4f','#eef2ff':'#eef2f9','#eff6ff':'#eef2f9','#dbeafe':'#e4ebf6',
  '#bfdbfe':'#c9d5ea','#93c5fd':'#b7c6e0','#1e40af':'#132a4f','#2563eb':'#1e3a6e','#1d4ed8':'#1e3a6e','#3b82f6':'#2f4f86',
  '#1e3a5f':'#132a4f','#2d5490':'#1e3a6e','#f0f4f8':'#f7f5f0','#e8edf2':'#e8e3d8','#fafbfc':'#ffffff','#0b1e3d':'#0b1e3d','#c9a24b':'#b8923a',
}
