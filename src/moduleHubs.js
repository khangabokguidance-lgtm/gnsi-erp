// moduleHubs.js — modules with overlapping features, grouped into one menu entry each.
// Each hub is a page of tabs (ModuleHub.jsx); every tab is an existing module that keeps
// its own permission key, so role settings still decide who sees which tab, and the hub
// shows in the menu when the user may open at least one of its tabs. Links to a tab's old
// module id (pins, recents, dashboard shortcuts, "New Admission" buttons) open the hub on
// that tab. admin: true tabs are shown to admins only (as their old pages were).
// HR (DAILY_ATTENDANCE_TRACKER_COMPLETE.jsx) and the Learning Hub group modules the same way
// with their own pages.
export const MODULE_HUBS = [
  {
    id: 'studentshub', label: 'Students & Admissions', eyebrow: 'GNSI · Students',
    blurb: 'Profiles, admissions and the full picture of every student',
    keywords: 'students admissions admission bulk import student 360 profile',
    groups: [
      { label: 'Students', color: '#185FA5', tabs: [
        { id: 'students',   label: 'Students',     hint: 'Profiles, documents and edits' },
        { id: 'student360', label: 'Student 360°', hint: 'Everything about one student', admin: true },
      ] },
      { label: 'Admissions', color: '#0f7a4c', tabs: [
        { id: 'admissions',    label: 'Admissions',     hint: 'Enquiry to enrolment' },
        { id: 'bulkadmission', label: 'Bulk Admission', hint: 'Import many students at once' },
      ] },
    ],
  },
  {
    id: 'feeshub', label: 'Fees', eyebrow: 'GNSI · Fees',
    blurb: 'Collect fees, read each student’s ledger and set fee structures',
    keywords: 'fees fee ledger student fee ledger fee setup structure receipt dues',
    groups: [
      { label: 'Collect', color: '#0f7a4c', tabs: [
        { id: 'fees',             label: 'Fees',               hint: 'Collection, receipts and dues' },
        { id: 'studentfeeledger', label: 'Student Fee Ledger', hint: 'One student’s full account' },
      ] },
      { label: 'Set up', color: '#a7771f', tabs: [
        { id: 'feesetup', label: 'Fee Setup', hint: 'Fee heads and structures', admin: true },
      ] },
    ],
  },
  {
    id: 'examshub', label: 'Exams & CBT', eyebrow: 'GNSI · Exams',
    blurb: 'Written exams and computer based tests in one place',
    keywords: 'exams exam cbt computer based test marks results',
    groups: [
      { label: 'Exams', color: '#b42318', tabs: [
        { id: 'exams', label: 'Exams',    hint: 'Schedules, marks and results' },
        { id: 'cbt',   label: 'CBT Exam', hint: 'Computer based tests' },
      ] },
    ],
  },
  {
    id: 'commshub', label: 'Communication', eyebrow: 'GNSI · Communication',
    blurb: 'Broadcasts, campaigns and the public website',
    keywords: 'connect social website whatsapp broadcast campaigns leads posts enquiries gallery',
    groups: [
      { label: 'Messages', color: '#128c7e', tabs: [
        { id: 'connect', label: 'Connect', hint: 'Broadcasts, replies, grievances' },
        { id: 'social',  label: 'Social',  hint: 'Campaigns, leads and posts' },
      ] },
      { label: 'Website', color: '#1e3a6e', tabs: [
        { id: 'website', label: 'Website Manager', hint: 'Enquiries, notices, gallery' },
      ] },
    ],
  },
  {
    id: 'adminhub', label: 'Admin & System', eyebrow: 'GNSI · Administration',
    blurb: 'Users, permissions, settings and staff log-ins',
    keywords: 'admin permissions roles users system settings link staff auth',
    groups: [
      { label: 'Administration', color: '#132a4f', tabs: [
        { id: 'admin',     label: 'Admin',      hint: 'Users, roles and permissions', admin: true },
        { id: 'system',    label: 'System',     hint: 'Portal-wide settings' },
        { id: 'adminlink', label: 'Link Staff', hint: 'Connect staff to log-ins', admin: true },
      ] },
    ],
  },
]

export const HUB_BY_ID = Object.fromEntries(MODULE_HUBS.map(h => [h.id, h]))
export const hubTabs = (hub) => hub.groups.flatMap(g => g.tabs)
// module id → the hub it now lives in
export const HUB_OF = Object.fromEntries(MODULE_HUBS.flatMap(h => hubTabs(h).map(t => [t.id, h.id])))
// the tabs of a hub this user may open; can(id) is App's access check
export const visibleHubTabs = (hub, can, isAdmin) => hubTabs(hub).filter(t => can(t.id) && (!t.admin || isAdmin)).map(t => t.id)
