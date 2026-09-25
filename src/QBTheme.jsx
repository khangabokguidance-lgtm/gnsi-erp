// QBTheme.jsx — GNSI Portal
// Small presentational components for the Question Bank theme. Tokens,
// style helpers and the scoped stylesheet live in qbankTheme.js.
import { T, QB_CSS } from './qbankTheme'

// Injects the scoped Question Bank stylesheet (hover/focus/responsive).
export function QBThemeStyles() {
  return <style>{QB_CSS}</style>
}

// Stat tile inside the hero banner.
export function HeroStat({ label, value, hint }) {
  return (
    <div className="qb-hero-stat" style={{ padding: '10px 14px', borderRadius: 12, minWidth: 110,
      background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
      backdropFilter: 'blur(4px)' }} title={hint}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, opacity: .72, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// Letter bubble for an answer option; shows ✓ when it's the correct one.
export function OptionLetter({ letter, correct }) {
  return (
    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
      background: correct ? T.green : T.surface, color: correct ? '#fff' : T.muted,
      border: `1px solid ${correct ? T.green : T.borderStrong}` }}>
      {correct ? '✓' : letter}
    </span>
  )
}
