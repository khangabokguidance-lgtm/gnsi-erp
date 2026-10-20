// FeeTabShell.jsx — the common frame for a Fees hub tab: parchment surface, serif title,
// one-line purpose, optional summary tiles. Wrap a tab's content with it.
import { surface, titleStyle, subtitleStyle, card } from './feeTheme'
import { COLOR } from './ledgerTheme'

export function StatTile({ label, value, tone }) {
  const color = tone === 'bad' ? COLOR.danger : tone === 'warn' ? COLOR.warn : tone === 'ok' ? COLOR.ok : COLOR.ink
  return (
    <div style={{ ...card, padding: '10px 14px', minWidth: 130, flex: '1 1 130px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: COLOR.slate, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export default function FeeTabShell({ title, subtitle, stats, children }) {
  return (
    <div style={surface}>
      {title && (
        <div style={{ marginBottom: 14 }}>
          <h2 style={titleStyle}>{title}</h2>
          {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        </div>
      )}
      {stats?.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>{stats.map(s => <StatTile key={s.label} {...s} />)}</div>}
      {children}
    </div>
  )
}
