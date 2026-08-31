// ledgerTheme.js — shared design tokens for the "Ledger & Crest" identity
// used across FaceAttendance.jsx and GeoAttendance.jsx.
//
// Grounding: GNSI is a residential Sainik/Navodaya coaching institute —
// the visual language should read like a campus duty roster / regimental
// ledger, not a generic consumer time-tracking app. Deep ink-navy pages,
// a parchment (not stark-white) content surface, brass-gold as an earned
// accent used sparingly, hairline rules doing the structural work that
// boxed cards usually do, and a wax-seal motif for verified/approved
// states as the one deliberate flourish.
//
// Two type roles: a serif for headings/identity (the "ledger" voice) and
// a grotesk for data, tables, and UI chrome (the "roster" voice). Numbers
// in tables use tabular-nums so columns align.

export const COLOR = {
  ink:        '#0B1730', // primary background — deep ink-navy, darker than the old #0B1E3D
  inkRaised:  '#132244', // one step up — headers, raised panels on ink
  hairline:   '#24365C', // borders/dividers on ink surfaces
  parchment:  '#F7F4EC', // primary content background — warm, not stark white
  parchmentRaised: '#FFFFFF', // cards/rows sitting on parchment
  rule:       '#E7E0CF', // hairline dividers on parchment
  brass:      '#C9A24B', // the earned accent — CTAs, active states, the seal
  brassDeep:  '#A8823A', // pressed/hover state of brass
  ink2:       '#1E2A44', // secondary text on parchment (not pure black)
  slate:      '#5B6B85', // muted text on parchment
  sage:       '#3D5A5B', // "verified / live" accent — distinct from generic green
  sageDeep:   '#2C4142',
  danger:     '#9C3B3B', // muted brick red, not saturated SaaS red
  dangerBg:   '#F6E8E4',
  warn:       '#8A6A1F', // muted ochre, not saturated amber
  warnBg:     '#F7EFD9',
  ok:         '#3D5A5B',
  okBg:       '#E4EDEA',
  cream:      '#F5F1E6',
}

export const FONT = {
  // Serif for headings/identity — falls back gracefully without a webfont link.
  display: "'Source Serif 4', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
  // Grotesk for data/UI chrome — the workhorse voice.
  body: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "'IBM Plex Mono', 'SF Mono', Menlo, monospace",
}

export const RADIUS = { sm: 6, md: 10, lg: 16, pill: 999 }

export const SHADOW = {
  onParchment: '0 1px 2px rgba(11,23,48,0.06), 0 8px 24px -12px rgba(11,23,48,0.18)',
  onInk:       '0 8px 30px -10px rgba(0,0,0,0.5)',
  seal:        '0 2px 8px rgba(201,162,75,0.35)',
}

// ─── Shared primitive styles ────────────────────────────────────────────
// Import and spread these into a page's own `S` object rather than
// replacing it wholesale, so existing call sites keep working while the
// visual language becomes consistent across both files.

export const ledger = {
  page: {
    padding: '22px 20px 100px',
    fontFamily: FONT.body,
    background: COLOR.parchment,
    minHeight: '100vh',
    color: COLOR.ink2,
  },

  // The signature header treatment — deep ink gradient, brass hairline
  // at the base, serif identity text. Used at the top of both modules.
  header: {
    margin: '-22px -20px 22px',
    padding: '20px 22px 26px',
    background: `linear-gradient(165deg, ${COLOR.ink} 0%, ${COLOR.inkRaised} 100%)`,
    borderBottom: `1px solid ${COLOR.brass}55`,
    borderRadius: '0 0 22px 22px',
    color: COLOR.cream,
    position: 'relative',
    overflow: 'hidden',
  },
  headerRule: {
    // A thin brass hairline inset from the header's bottom edge — the
    // "braid trim" detail, restrained to a single 1px line.
    position: 'absolute', left: 22, right: 22, bottom: 10, height: 1,
    background: `linear-gradient(90deg, transparent, ${COLOR.brass}88, transparent)`,
  },
  eyebrow: {
    fontFamily: FONT.body, fontSize: 10.5, letterSpacing: '0.14em',
    color: COLOR.brass, fontWeight: 700, opacity: 0.9,
  },
  headline: {
    fontFamily: FONT.display, fontSize: 19, fontWeight: 600,
    color: COLOR.cream, margin: '2px 0 0', letterSpacing: '-0.01em',
  },

  // Cards on parchment — replace flat SaaS-card shadow with a softer,
  // warmer elevation and a hairline border instead of a heavy shadow.
  card: {
    background: COLOR.parchmentRaised,
    borderRadius: RADIUS.lg,
    border: `1px solid ${COLOR.rule}`,
    boxShadow: SHADOW.onParchment,
    padding: 20,
    marginBottom: 16,
  },
  cardInk: {
    background: COLOR.inkRaised,
    borderRadius: RADIUS.lg,
    border: `1px solid ${COLOR.hairline}`,
    boxShadow: SHADOW.onInk,
    padding: 20,
    color: COLOR.cream,
  },

  // Ledger row — hairline-divided list row, used INSTEAD of boxed cards
  // for repeating list content (staff rows, shift rows, approval rows).
  // This is the structural device that replaces "card soup".
  ledgerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 4px', borderBottom: `1px solid ${COLOR.rule}`,
  },
  ledgerList: {
    background: COLOR.parchmentRaised,
    borderRadius: RADIUS.lg,
    border: `1px solid ${COLOR.rule}`,
    boxShadow: SHADOW.onParchment,
    padding: '4px 16px',
  },

  btnPrimary: (disabled = false) => ({
    background: disabled ? '#C9C2AC' : COLOR.brass,
    color: COLOR.ink, border: 'none', borderRadius: RADIUS.md,
    padding: '12px 20px', fontWeight: 700, fontSize: 13.5,
    fontFamily: FONT.body, cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : SHADOW.seal,
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  }),
  btnGhost: (disabled = false) => ({
    background: 'transparent', color: disabled ? COLOR.slate : COLOR.ink2,
    border: `1px solid ${COLOR.rule}`, borderRadius: RADIUS.md,
    padding: '11px 18px', fontWeight: 700, fontSize: 13,
    fontFamily: FONT.body, cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  btnOnInk: (disabled = false) => ({
    background: disabled ? '#3A4A6A' : COLOR.brass,
    color: COLOR.ink, border: 'none', borderRadius: RADIUS.md,
    padding: '12px 20px', fontWeight: 700, fontSize: 13.5,
    fontFamily: FONT.body, cursor: disabled ? 'not-allowed' : 'pointer',
  }),

  th: {
    padding: '11px 14px', textAlign: 'left', fontWeight: 700,
    color: COLOR.slate, fontSize: 10.5, letterSpacing: '0.04em',
    fontFamily: FONT.body, borderBottom: `1px solid ${COLOR.rule}`,
    background: 'transparent',
  },
  td: {
    padding: '13px 14px', verticalAlign: 'middle', color: COLOR.ink2,
    fontSize: 13, fontFamily: FONT.body, fontVariantNumeric: 'tabular-nums',
  },

  input: {
    width: '100%', padding: '11px 14px', borderRadius: RADIUS.md,
    border: `1px solid ${COLOR.rule}`, fontSize: 14, boxSizing: 'border-box',
    fontFamily: FONT.body, background: COLOR.parchmentRaised, color: COLOR.ink2,
  },
  label: {
    display: 'block', fontSize: 11.5, fontWeight: 700, color: COLOR.slate,
    marginBottom: 6, letterSpacing: '0.02em', fontFamily: FONT.body,
  },
}

// ─── The seal — signature verified/approved motif ──────────────────────
// A small wax-seal-style circular mark, used at the ONE moment that
// deserves ceremony: a successful verified check-in, or an approved
// enrollment. Not used decoratively elsewhere — this restraint is what
// makes it land.
export function Seal({ size = 56, tone = 'brass' }) {
  const ring = tone === 'brass' ? COLOR.brass : COLOR.sage
  const core = tone === 'brass' ? COLOR.brassDeep : COLOR.sageDeep
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <circle cx="50" cy="50" r="47" fill="none" stroke={ring} strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="50" r="38" fill={core} />
      <circle cx="50" cy="50" r="38" fill="none" stroke={ring} strokeWidth="1.5" />
      <path d="M32 52 L44 64 L69 38" fill="none" stroke={ring} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// One-time global style injection: webfont import + keyframes shared by
// both modules. Call once near the root of whichever module mounts first;
// safe to call from both, guarded by the id check.
export function injectLedgerGlobalStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('ledger-theme-globals')) return
  const style = document.createElement('style')
  style.id = 'ledger-theme-globals'
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500&display=swap');
    @keyframes ledger-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes ledger-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ledger-seal-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes ledger-slide-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
    }
  `
  document.head.appendChild(style)
}
