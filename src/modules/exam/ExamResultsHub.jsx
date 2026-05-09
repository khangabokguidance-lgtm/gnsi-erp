/**
 * ExamResultsHub.jsx  —  GNSI Portal
 * Migrated from modules/exams.js → renderExamResultsHub()
 *
 * This is the ER (Exam Results) hub shell. It renders the header,
 * summary strip, tab nav and delegates the body area to _erhBuildCourseArea.
 *
 * Props:
 *   tenant        {Object}  — { name, address }
 *   examLabel     {string}  — e.g. "2nd Test · 2026"
 *   courses       {Array}   — ERH course list  (_ERH_COURSES)
 *   erData        {Object}  — { [courseId]: { students:[], marks:{} } }
 *   gradeSettings {Object}  — grade thresholds
 *   currentUser   {Object}  — { name, role }
 *
 *   // Slot components (pass once migrated):
 *   CourseAreaComponent  — renders the main course area
 */

import { useState, useMemo } from 'react';

// ── ERH Tab definitions ────────────────────────────────────────────────────
const ERH_TABS = [
  { id: 'overview',  icon: '📊', label: 'Overview'   },
  { id: 'results',   icon: '🏆', label: 'Results'    },
  { id: 'markentry', icon: '✏️', label: 'Mark Entry' },
  { id: 'analytics', icon: '📉', label: 'Analytics'  },
  { id: 'reportcard',icon: '📋', label: 'Report Card'},
  { id: 'students',  icon: '👥', label: 'Students'   },
  { id: 'settings',  icon: '🔧', label: 'Settings'   },
];

// ── Summary card ───────────────────────────────────────────────────────────
function SummaryCard({ icon, label, value, color = '#1433a8' }) {
  return (
    <div className="erh-summary-card" style={{ '--c': color }}>
      <div className="erh-summary-icon">{icon}</div>
      <div className="erh-summary-value">{value}</div>
      <div className="erh-summary-label">{label}</div>
    </div>
  );
}

// ── Placeholder panel ──────────────────────────────────────────────────────
function ERHPlaceholder({ tab }) {
  return (
    <div style={{
      padding: '48px 32px', textAlign: 'center',
      background: 'var(--surface)', border: '1.5px dashed var(--border)',
      borderRadius: 14, marginTop: 8,
    }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{tab?.icon}</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{tab?.label}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
        🚧 ER sub-module migration in progress
      </div>
    </div>
  );
}

// ── Derived stats from courses + erData ───────────────────────────────────
function useERHStats(courses, erData) {
  return useMemo(() => {
    const totalCourses  = courses.length;
    const totalStudents = courses.reduce(
      (s, c) => s + (erData?.[c.id]?.students?.length ?? 0), 0
    );
    const totalMarks = courses.reduce((s, c) => {
      const marks = erData?.[c.id]?.marks ?? {};
      return s + Object.keys(marks).length;
    }, 0);
    return { totalCourses, totalStudents, totalMarks };
  }, [courses, erData]);
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ExamResultsHub({
  tenant        = null,
  examLabel     = '2nd Test · 2026',
  courses       = [],
  erData        = {},
  gradeSettings = {},
  currentUser   = { name: 'Admin', role: 'admin' },
  initialView   = 'overview',

  // slot
  CourseAreaComponent,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView]   = useState(initialView);

  const stats = useERHStats(courses, erData);

  const activeTab = ERH_TABS.find((t) => t.id === activeView) ?? ERH_TABS[0];

  const renderBody = () => {
    if (CourseAreaComponent) {
      return (
        <CourseAreaComponent
          view={activeView}
          courses={courses}
          erData={erData}
          gradeSettings={gradeSettings}
          currentUser={currentUser}
          searchQuery={searchQuery}
        />
      );
    }
    return <ERHPlaceholder tab={activeTab} />;
  };

  return (
    <div className="erh-page">
      {/* Header */}
      <div className="erh-header">
        <div className="erh-header-inner">
          <div className="erh-header-logo">📋</div>
          <div>
            <div className="erh-header-badge">{examLabel}</div>
            <div className="erh-header-title">Exam Results Hub</div>
            <div className="erh-header-sub">
              {tenant?.name ?? 'Navodaya & Sainik Institute'} &middot;{' '}
              {tenant?.address ?? 'Khangabok, Thoubal, Manipur'}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="erh-summary-strip">
          <SummaryCard icon="📚" label="Courses"  value={stats.totalCourses}  color="#1433a8" />
          <SummaryCard icon="👥" label="Students" value={stats.totalStudents} color="#16a34a" />
          <SummaryCard icon="✏️" label="Marks"    value={stats.totalMarks}    color="#d97706" />
        </div>

        {/* Search */}
        <div style={{ padding: '0 20px 12px' }}>
          <input
            className="filter-sel"
            placeholder="🔍 Search students, courses…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: 360 }}
          />
        </div>

        {/* Tab nav */}
        <div className="erh-tab-nav-wrap">
          <div className="erh-tab-nav" id="erh-tab-nav">
            {ERH_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`erh-tab-btn${activeView === tab.id ? ' active' : ''}`}
                onClick={() => setActiveView(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="erh-main">
        <div id="erh-course-area">
          {renderBody()}
        </div>
      </div>
    </div>
  );
}
