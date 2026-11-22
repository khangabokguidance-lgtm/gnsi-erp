// MissionSainikIcons.jsx — one consistent set of line icons (24px grid, 1.8 stroke) for the Mission Sainik module,
// plus the module emblem. Replaces emoji so the interface reads like a formal portal.

const P = {
  overview: 'M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5',
  schedule: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  mock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  allotment: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
  syllabus: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
  panel: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  students: 'M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v6',
  mine: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9',
  practice: 'M12 2l9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
  material: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  prebuilder: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  megabuilder: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M3 21h18',
  dailybuilder: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  practicebuilder: 'M4 4h16v16H4zM12 8v8M8 12h8',
  admit: 'M3 5h18v14H3zM7 10a2 2 0 1 0 4 0 2 2 0 0 0-4 0M6 16c.6-2.2 4.4-2.2 5 0M14 10h4M14 14h4',
  marks: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  mockmarks: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  premock: 'M5 20V11M12 20V4M19 20v-8M3 20h18',
  megamock: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  certs: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14L7 22l5-3 5 3-1.5-8',
  insights: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  guide: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.4-1.1.9-1.1 1.7M12 17h.01',
  admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  // UI glyphs
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  print: 'M7 8V3h10v5M6 17H4v-7h16v7h-2M7 14h10v7H7z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  back: 'M15 6l-6 6 6 6',
  chev: 'M9 6l6 6-6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  flame: 'M12 22c4 0 7-2.7 7-6.5 0-3-2-5-3.5-6.5-.3 1.5-1 2.5-2 3 .3-3-1.2-6-4-8.5.2 3-2 4.7-3 7C5.5 12.5 5 14 5 15.5 5 19.3 8 22 12 22z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
}

export function Icon({ name, size = 20, stroke = 1.8, fill = 'none', style, ...rest }) {
  const d = P[name]
  if (!d) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: 'none', ...style }} {...rest}>
      <path d={d} />
    </svg>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const hasIcon = name => !!P[name]

// Module emblem: shield with a five-point star.
export function Emblem({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Mission Sainik emblem" style={{ flex: 'none' }}>
      <path d="M24 3l17 6.5v13c0 10.5-7 18-17 22.5C14 40.5 7 33 7 22.500v-13z" fill="#0b2a55" stroke="#b8923a" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 3l17 6.5v13c0 10.5-7 18-17 22.5z" fill="#123a73" />
      <polygon points="24,12.500 26.600,19.200 33.800,19.500 28.200,24 30.100,31 24,27 17.900,31 19.800,24 14.200,19.500 21.400,19.200" fill="#e9d9b0" stroke="#b8923a" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}
