// qbankTheme.js — GNSI Portal
// Shared visual system for QuestionBank.jsx and QuestionBankViewer.jsx:
// design tokens, style helpers and the scoped stylesheet. The small
// presentational components that use them live in QBTheme.jsx (split so
// React fast refresh works: a file should export only components or only
// constants).
//
// Tokens follow the portal's own look (deep navy sidebar #03263a with an
// amber accent, light slate canvas, Inter — loaded globally by App.jsx).
// Components in both files use inline styles, which can't express hover,
// focus or media queries, so QB_CSS adds those once, scoped under the
// `.qbx` root class so nothing leaks into other modules.

export const T = {
  // Brand
  ink:        '#0b1f33',   // headings / primary text
  navy:       '#0e2a47',   // primary actions, active states
  navyDeep:   '#071a2c',
  navySoft:   '#e8eef6',
  accent:     '#f59e0b',   // portal amber
  accentSoft: '#fff7e6',
  // Neutrals
  text:       '#1e293b',
  muted:      '#5b6b80',
  faint:      '#94a3b8',
  border:     '#e3e8ef',
  borderStrong:'#cfd8e3',
  canvas:     '#f4f6fa',
  surface:    '#ffffff',
  surfaceAlt: '#f8fafc',
  // Semantic
  green:      '#15803d', greenSoft: '#e8f7ee', greenLine: '#a7e3bd',
  rose:       '#e11d48', roseSoft:  '#fff1f3', roseLine:  '#fecdd6',
  amber:      '#b45309', amberSoft: '#fff7e6', amberLine: '#fde2a7',
  indigo:     '#4f46e5', indigoSoft:'#eef0ff',
  teal:       '#0e7490', tealSoft:  '#e6f6fa',
  violet:     '#7c3aed', violetSoft:'#f3edff',
  // Shape
  radius:     14,
  radiusSm:   9,
  shadow:     '0 1px 2px rgba(16,24,40,.04), 0 6px 18px rgba(16,24,40,.05)',
  shadowLg:   '0 12px 40px rgba(16,24,40,.16)',
  font:       "'Inter', 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
}

// Dark hero banner used at the top of both screens.
export const heroStyle = {
  position: 'relative', overflow: 'hidden',
  background: `radial-gradient(1200px 300px at 100% -40%, rgba(245,158,11,.22), transparent 60%),
               linear-gradient(135deg, ${T.navyDeep} 0%, #0c2a45 55%, #113a5e 100%)`,
  borderRadius: 18, padding: '22px 26px', color: '#fff',
  boxShadow: '0 10px 30px rgba(7,26,44,.18)',
}

// One answer option (A–D). `correct` highlights it as the right answer.
export function optionStyle(correct) {
  return {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 10,
    fontSize: 13, lineHeight: 1.5, color: correct ? '#14532d' : T.text,
    background: correct ? T.greenSoft : T.surfaceAlt,
    border: `1px solid ${correct ? T.greenLine : T.border}`,
    fontWeight: correct ? 600 : 400,
  }
}

const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235b6b80' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export const QB_CSS = `
.qbx { font-family: ${T.font}; color: ${T.text}; -webkit-font-smoothing: antialiased; }
.qbx *, .qbx *::before, .qbx *::after { box-sizing: border-box; }
.qbx button, .qbx input, .qbx select, .qbx textarea { font-family: inherit; }

/* Inputs */
.qbx input:not([type=checkbox]):not([type=radio]):not([type=file]),
.qbx select, .qbx textarea {
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
  color: ${T.text};
}
.qbx input:not([type=checkbox]):not([type=radio]):hover,
.qbx select:hover:not(:disabled), .qbx textarea:hover { border-color: ${T.borderStrong} !important; }
.qbx input:not([type=checkbox]):not([type=radio]):focus,
.qbx select:focus, .qbx textarea:focus {
  outline: none; border-color: #3b82f6 !important;
  box-shadow: 0 0 0 3px rgba(59,130,246,.16) !important;
}
.qbx select {
  -webkit-appearance: none; appearance: none; cursor: pointer;
  background-image: ${CHEVRON}; background-repeat: no-repeat;
  background-position: right 10px center; padding-right: 30px !important;
}
.qbx select:disabled { cursor: not-allowed; }
.qbx ::placeholder { color: ${T.faint}; }
.qbx input[type=checkbox], .qbx input[type=radio] { accent-color: ${T.navy}; cursor: pointer; }

/* Buttons */
.qbx button { transition: transform .12s ease, box-shadow .15s ease, filter .15s ease, background-color .15s ease, border-color .15s ease; }
.qbx button:not(:disabled):hover { filter: brightness(1.06); }
.qbx button:not(:disabled):active { transform: translateY(1px); }
.qbx button:focus-visible, .qbx [role=tab]:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; }

/* Cards / motion */
.qbx .qb-lift { transition: box-shadow .2s ease, border-color .2s ease, transform .2s ease; }
.qbx .qb-lift:hover { box-shadow: 0 2px 4px rgba(16,24,40,.05), 0 12px 28px rgba(16,24,40,.08); border-color: ${T.borderStrong} !important; }
.qbx .qb-click { cursor: pointer; }
.qbx .qb-click:hover { transform: translateY(-1px); }
.qbx .qb-fade { animation: qbFade .28s ease both; }
@keyframes qbFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes qbShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes qbToastIn { from { opacity: 0; transform: translateY(-8px) scale(.98); } to { opacity: 1; transform: none; } }
.qbx .qb-tabs::-webkit-scrollbar { height: 0; }
.qbx .qb-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.qbx .qb-scroll::-webkit-scrollbar-thumb { background: #d5dde7; border-radius: 99px; }
.qbx .qb-scroll::-webkit-scrollbar-track { background: transparent; }

/* Responsive: inline grids marked .qb-grid / .qb-opts collapse on small screens */
@media (max-width: 1024px) {
  .qbx .qb-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .qbx .qb-grid > [style*="grid-column"] { grid-column: 1 / -1 !important; }
}
@media (max-width: 640px) {
  .qbx .qb-grid, .qbx .qb-opts { grid-template-columns: minmax(0, 1fr) !important; }
  .qbx .qb-page { padding: 14px !important; }
  .qbx .qb-hero { padding: 18px !important; border-radius: 14px !important; }
  .qbx .qb-hero-title { font-size: 22px !important; }
  .qbx .qb-hero-sub { display: none; }
  .qbx .qb-hero-stat { min-width: 0 !important; padding: 8px 12px !important; flex: 1 1 40%; }
}
@media print { .qbx .qb-hero, .qbx .qb-tabs { display: none !important; } }
`
