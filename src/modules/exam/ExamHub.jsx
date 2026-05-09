/**
 * ExamHub.jsx  —  GNSI Portal
 * Migrated from modules/exams.js → renderExamHub()
 *
 * Props:
 *   students        {Array}   — global students array
 *   examMarksData   {Object}  — marks keyed by "examType_subject_studentId"
 *   EXAM_TYPES      {Array}
 *   EXAM_SUBJECTS   {Array}
 *   currentUser     {Object}  — { name, role }
 *   tenant          {Object}  — { name, address }
 *   erData          {Object}  — { courses: [], data: {} }   (ER bridge)
 *   gnsiExamClassMode {string} — 'old' | 'new'
 *   onSetMode       {fn}      — (mode) => void
 *   onTabChange     {fn}      — (tabId) => void   optional
 *
 * Internal routing (activeTab) is managed here; pass onTabChange if the
 * parent also needs to know which sub-module is open.
 */

import { useState, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────
// RBAC helper  (mirrors examComputePermissions logic)
// ─────────────────────────────────────────────────────────────
function computePermissions(role) {
  const adminOrManager = role === 'admin' || role === 'manager';
  const isAdminOrArunkumar =
    role === 'admin' || role === 'arunkumar'; // keep parity with _isAdminOrArunkumar()

  return {
    canEdit:    adminOrManager || role === 'teacher',
    canManage:  adminOrManager,
    canExport:  adminOrManager,
    canPrint:   adminOrManager || role === 'teacher',
    canAnalytics: adminOrManager || role === 'teacher',
    isAdmin:    role === 'admin',
    isAdminMgr: adminOrManager,
    isAdminOrArunkumar,
  };
}

// ─────────────────────────────────────────────────────────────
// Tab definitions  (mirrors tabGroups in the original)
// ─────────────────────────────────────────────────────────────
function buildTabGroups(perms) {
  const { canEdit, canAnalytics, isAdminOrArunkumar } = perms;
  return [
    {
      groupLabel: 'Entry',
      color: '#1433a8',
      tabs: [
        { id: 'entry',    icon: '✏️',  label: 'Mark Entry',   tip: 'Enter & save marks (main roster)',    show: canEdit },
        { id: 'erentry',  icon: '📝',  label: 'ER Mark Entry',tip: 'Enter marks in Results module',       show: canEdit },
      ],
    },
    {
      groupLabel: 'Results',
      color: '#0891b2',
      tabs: [
        { id: 'marks',      icon: '📊', label: 'Marks Grid',   tip: 'View all entered marks',              show: true },
        { id: 'erresults',  icon: '📈', label: 'ER Results',   tip: 'Ranked results & grades (ER module)', show: true },
        { id: 'analytics',  icon: '📉', label: 'Analytics',    tip: 'Class & subject analysis',            show: canAnalytics },
        { id: 'eranalytics',icon: '🔭', label: 'ER Analytics', tip: 'ER module deep analytics',            show: canAnalytics },
        { id: 'rankings',   icon: '🏆', label: 'Rankings',     tip: 'Top performers & leaderboard',        show: true },
        { id: 'progress',   icon: '🎓', label: 'Progress',     tip: 'Per-student progress over exams',     show: true },
      ],
    },
    {
      groupLabel: 'Documents',
      color: '#16a34a',
      tabs: [
        { id: 'admitcard',   icon: '🪪',  label: 'Admit Cards',  tip: 'Generate & print admit cards',       show: isAdminOrArunkumar },
        { id: 'reportcard',  icon: '📋',  label: 'Report Cards', tip: 'Print report cards (main)',          show: isAdminOrArunkumar },
        { id: 'erreportcard',icon: '🖨️', label: 'ER Reports',   tip: 'ER module report cards',            show: isAdminOrArunkumar },
      ],
    },
    {
      groupLabel: 'Students',
      color: '#7c3aed',
      tabs: [
        { id: 'erstudents', icon: '👥', label: 'ER Students', tip: 'Manage ER module student list', show: isAdminOrArunkumar },
      ],
    },
    {
      groupLabel: 'Schedule',
      color: '#d97706',
      tabs: [
        { id: 'schedule', icon: '📅', label: 'Schedule', tip: 'Exam timetable & dates', show: true },
      ],
    },
    {
      groupLabel: 'Batch',
      color: '#0891b2',
      tabs: [
        { id: 'batchassign', icon: '🎯', label: 'Batch Assign', tip: 'Assign students to course batches after KBT', show: isAdminOrArunkumar },
      ],
    },
    {
      groupLabel: 'Setup',
      color: '#c9870a',
      tabs: [
        { id: 'classsubjects', icon: '📚', label: 'Subjects', tip: 'Assign subjects per class',      show: isAdminOrArunkumar },
        { id: 'manage',        icon: '⚙️', label: 'Manage',   tip: 'Exam types, grades, subjects',   show: isAdminOrArunkumar },
        { id: 'ersettings',    icon: '🔧', label: 'ER Settings',tip:'ER module settings',            show: isAdminOrArunkumar },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Role label map
// ─────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  admin:       '🛡 Administrator',
  manager:     '⚙️ Manager',
  teacher:     '📖 Teacher',
  accounts:    '💳 Accounts',
  hostel:      '🏠 Hostel',
  housemaster: '🏠 House Master',
  it:          '💻 IT',
  staff:       '👤 Staff',
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Stat strip card */
function StatCard({ label, value, sub, barWidth, barGradient }) {
  return (
    <div className="gnsi-exam-stat-item">
      <div className="gnsi-exam-stat-label">{label}</div>
      <div className="gnsi-exam-stat-val">{value}</div>
      <div className="gnsi-exam-stat-sub">{sub}</div>
      <div className="gnsi-exam-stat-bar">
        <div
          className="gnsi-exam-stat-bar-fill"
          style={{ width: `${barWidth}%`, background: barGradient }}
        />
      </div>
    </div>
  );
}

/** Masthead banner */
function ExamMasthead({ tenant, bridgeActive, erExamCount, erStuCount, roleLabel, stats }) {
  const { totalStudents, totalExamTypes, totalSubjects, completionPct, totalMarksEntered } = stats;

  return (
    <div className="gnsi-exam-hub-masthead">
      {/* decorative dot grid */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 18, zIndex: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='%23ffffff' fill-opacity='0.06'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* top row */}
      <div className="gnsi-exam-masthead-top">
        <div className="gnsi-exam-masthead-icon">🎓</div>
        <div>
          <div className="gnsi-exam-masthead-title">Exam HUB</div>
          <div className="gnsi-exam-masthead-sub">
            {tenant?.name ?? 'Guidance Navodaya & Sainik Institute'} · Examination Management
          </div>
        </div>
        <div className="gnsi-exam-masthead-right">
          <div className={`gnsi-exam-status-pill ${bridgeActive ? 'green' : 'amber'}`}>
            <span className="pill-dot" />
            {bridgeActive
              ? `🔗 Bridge Active · ${erExamCount} exams · ${erStuCount} students`
              : '⚠️ No ER sync yet'}
          </div>
          <div style={{
            background: 'rgba(255,255,255,.08)',
            border: '1px solid rgba(255,255,255,.14)',
            borderRadius: 9,
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(255,255,255,.8)',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {roleLabel}
          </div>
        </div>
      </div>

      {/* stat strip */}
      <div className="gnsi-exam-stat-strip">
        <StatCard
          label="Students" value={totalStudents} sub="enrolled"
          barWidth={100} barGradient="linear-gradient(90deg,#2451ff,#5b7fff)"
        />
        <StatCard
          label="Exam Types" value={totalExamTypes} sub="configured"
          barWidth={Math.min(100, totalExamTypes * 20)}
          barGradient="linear-gradient(90deg,#7c3aed,#a78bfa)"
        />
        <StatCard
          label="Subjects" value={totalSubjects} sub="active"
          barWidth={Math.min(100, totalSubjects * 10)}
          barGradient="linear-gradient(90deg,#d97706,#fbbf24)"
        />
        <StatCard
          label="Completion" value={`${completionPct}%`} sub={`${totalMarksEntered} marks entered`}
          barWidth={completionPct}
          barGradient="linear-gradient(90deg,#06d6a0,#34d399)"
        />
      </div>
    </div>
  );
}

/** Pro tab navigation */
function TabNav({ tabGroups, activeTab, onSelect }) {
  return (
    <div className="gnsi-exam-pro-tabnav">
      {tabGroups.map((grp) => {
        const visibleTabs = grp.tabs.filter((t) => t.show);
        if (!visibleTabs.length) return null;
        return (
          <div key={grp.groupLabel} className="gnsi-exam-pro-tabgroup">
            <span className="gnsi-exam-pro-grouplabel">{grp.groupLabel}</span>
            <div className="gnsi-exam-dash-grid">
              {visibleTabs.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    title={t.tip}
                    className={`gnsi-exam-pro-tab${isActive ? ' active' : ''}`}
                    onClick={() => onSelect(t.id)}
                    style={
                      isActive
                        ? { background: grp.color, boxShadow: `0 4px 16px ${grp.color}55` }
                        : { '--accent-col': grp.color }
                    }
                  >
                    <span className="tab-accent-bar" style={{ background: grp.color }} />
                    <span className="tab-icon">{t.icon}</span>
                    <span className="tab-label">{t.label}</span>
                    <span className="tab-tip">{t.tip}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Context hint bar */
function ContextHint({ tab, color }) {
  if (!tab) return null;
  return (
    <div className="gnsi-exam-context-hint">
      <span style={{ fontSize: 15 }}>💡</span>
      <span>
        <b>{tab.icon} {tab.label}</b> — {tab.tip}
      </span>
    </div>
  );
}

/** Bridge banner */
function BridgeBanner({ bridgeActive, erExamCount, erStuCount }) {
  return bridgeActive ? (
    <div className="gnsi-exam-bridge-banner active">
      🔗 Bridge active — {erExamCount} exams · {erStuCount} students synced to Parent Portal
    </div>
  ) : (
    <div className="gnsi-exam-bridge-banner inactive">
      ⚠️ No ER data yet — enter marks to auto-sync to Parent Portal
    </div>
  );
}

/** Class mode toggle */
function ClassModeToggle({ mode, onSetMode }) {
  const isOld = mode === 'old';
  const baseBtn = {
    padding: '7px 18px', borderRadius: 9, fontSize: 12.5,
    cursor: 'pointer', transition: 'all .15s', fontFamily: "'DM Sans', sans-serif",
  };
  const activeStyle  = { ...baseBtn, border: '2px solid #1433a8', background: '#1433a8', color: '#fff', fontWeight: 800 };
  const inactiveStyle= { ...baseBtn, border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontWeight: 600 };
  const activeNew    = { ...baseBtn, border: '2px solid #7c3aed', background: '#7c3aed', color: '#fff', fontWeight: 800 };
  const inactiveNew  = { ...baseBtn, border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontWeight: 600 };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
      background: 'linear-gradient(135deg,#f8faff,#eef2ff)',
      border: '1.5px solid #c7d2fe', borderRadius: 12, marginBottom: 14, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#1433a8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        📋 Class System
      </span>
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        <button style={isOld ? activeStyle : inactiveStyle} onClick={() => onSetMode('old')}>
          {isOld ? '✅ ' : ''}Old System (Classes)
        </button>
        <button style={!isOld ? activeNew : inactiveNew} onClick={() => onSetMode('new')}>
          {!isOld ? '✅ ' : ''}New System (Batches)
        </button>
      </div>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
        {isOld
          ? 'Original classes: Combined, Navodaya, Foundation, Sainik…'
          : '7 Batches: Achiever · Leader · Champion · Lakshya · Umeed · Elite · Prime'}
      </span>
    </div>
  );
}

/**
 * Placeholder panel — shown for tabs whose sub-module hasn't been migrated yet.
 * Replace with the real component once each sub-module is ported.
 */
function TabPlaceholder({ tab }) {
  if (!tab) return null;
  return (
    <div style={{
      padding: '48px 32px', textAlign: 'center',
      background: 'var(--surface)', border: '1.5px dashed var(--border)',
      borderRadius: 14, marginTop: 8,
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{tab.icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{tab.label}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{tab.tip}</div>
      <div style={{
        marginTop: 20, display: 'inline-block',
        padding: '6px 18px', borderRadius: 8,
        background: 'var(--accent-light)', color: 'var(--accent)',
        fontSize: 12, fontWeight: 700,
      }}>
        🚧 Migration in progress — sub-module coming soon
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main ExamHub component
// ─────────────────────────────────────────────────────────────
export default function ExamHub({
  students       = [],
  examMarksData  = {},
  EXAM_TYPES     = [],
  EXAM_SUBJECTS  = [],
  currentUser    = { name: 'Admin', role: 'admin' },
  tenant         = null,
  erData         = { courses: [], data: {} },
  gnsiExamClassMode = 'old',
  onSetMode      = () => {},
  onTabChange,

  // Slot props: pass real sub-components once migrated
  ExamEntry,
  ExamMarksGrid,
  ExamAnalytics,
  ERResultsModule,
  ExamSchedule,
  AdmitCards,
  ReportCards,
  BatchAssign,
  ClassSubjects,
  ExamManager,
}) {
  const role  = currentUser?.role ?? 'staff';
  const perms = useMemo(() => computePermissions(role), [role]);
  const tabGroups = useMemo(() => buildTabGroups(perms), [perms]);

  // Flatten visible tabs
  const allVisibleTabs = useMemo(
    () => tabGroups.flatMap((g) => g.tabs.filter((t) => t.show)).map((t) => t.id),
    [tabGroups]
  );

  const [activeTab, setActiveTab] = useState(() => allVisibleTabs[0] ?? 'marks');

  // Validate tab on perm change
  const safeTab = allVisibleTabs.includes(activeTab) ? activeTab : allVisibleTabs[0] ?? 'marks';

  const handleTabSelect = (id) => {
    setActiveTab(id);
    onTabChange?.(id);
  };

  // Find active tab object & group color
  const { activeTabObj, activeGroupColor } = useMemo(() => {
    for (const g of tabGroups) {
      for (const t of g.tabs) {
        if (t.id === safeTab) return { activeTabObj: t, activeGroupColor: g.color };
      }
    }
    return { activeTabObj: null, activeGroupColor: '#1433a8' };
  }, [tabGroups, safeTab]);

  // ER bridge stats
  const erExamCount = erData?.courses?.length ?? 0;
  const erStuCount  = Object.values(erData?.data ?? {}).reduce(
    (sum, c) => sum + (c.students?.length ?? 0), 0
  );
  const bridgeActive = erExamCount > 0 || erStuCount > 0;

  // Quick stats
  const totalStudents  = students.length;
  const totalExamTypes = EXAM_TYPES.length;
  const totalSubjects  = EXAM_SUBJECTS.length;

  const totalMarksEntered = useMemo(
    () => Object.values(examMarksData).reduce((s, d) => s + (d ? Object.keys(d).length : 0), 0),
    [examMarksData]
  );
  const totalMarkSlots =
    totalStudents && totalExamTypes && totalSubjects
      ? totalStudents * totalExamTypes * totalSubjects
      : 0;
  const completionPct = totalMarkSlots > 0
    ? Math.min(100, Math.round((totalMarksEntered / totalMarkSlots) * 100))
    : 0;

  const roleLabel = ROLE_LABELS[role] ?? '👤 User';

  // ── Content routing (mirrors the if/else block in the original) ──
  const renderContent = () => {
    const t = safeTab;

    // ER module views
    const erViews = {
      erentry:     ERResultsModule && <ERResultsModule view="markentry" />,
      erresults:   ERResultsModule && <ERResultsModule view="results" />,
      eranalytics: ERResultsModule && <ERResultsModule view="analytics" />,
      erreportcard:ERResultsModule && <ERResultsModule view="reportcard" />,
      erstudents:  ERResultsModule && <ERResultsModule view="students" />,
      ersettings:  ERResultsModule && <ERResultsModule view="settings" />,
    };
    if (erViews[t] !== undefined) return erViews[t] ?? <TabPlaceholder tab={activeTabObj} />;

    // Main exam module views
    const mainViews = {
      entry:        ExamEntry        && <ExamEntry />,
      marks:        ExamMarksGrid    && <ExamMarksGrid />,
      analytics:    ExamAnalytics    && <ExamAnalytics />,
      rankings:     ExamAnalytics    && <ExamAnalytics view="rankings" />,
      progress:     ExamAnalytics    && <ExamAnalytics view="progress" />,
      schedule:     ExamSchedule     && <ExamSchedule />,
      admitcard:    AdmitCards       && <AdmitCards />,
      reportcard:   ReportCards      && <ReportCards />,
      batchassign:  BatchAssign      && <BatchAssign />,
      classsubjects:ClassSubjects    && <ClassSubjects />,
      manage:       ExamManager      && <ExamManager />,
    };
    if (mainViews[t] !== undefined) return mainViews[t] ?? <TabPlaceholder tab={activeTabObj} />;

    return <TabPlaceholder tab={activeTabObj} />;
  };

  return (
    <div className="gnsi-exam-hub-root">
      <ExamMasthead
        tenant={tenant}
        bridgeActive={bridgeActive}
        erExamCount={erExamCount}
        erStuCount={erStuCount}
        roleLabel={roleLabel}
        stats={{ totalStudents, totalExamTypes, totalSubjects, completionPct, totalMarksEntered }}
      />

      <TabNav tabGroups={tabGroups} activeTab={safeTab} onSelect={handleTabSelect} />

      <ContextHint tab={activeTabObj} color={activeGroupColor} />

      <BridgeBanner
        bridgeActive={bridgeActive}
        erExamCount={erExamCount}
        erStuCount={erStuCount}
      />

      <ClassModeToggle mode={gnsiExamClassMode} onSetMode={onSetMode} />

      <div className="gnsi-exam-hub-body">
        {renderContent()}
      </div>
    </div>
  );
}
