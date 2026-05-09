/**
 * ExamManager.jsx  —  GNSI Portal
 * Migrated from modules/exams.js → renderExamManager()
 *
 * Tabs:
 *   seat · duty · attendance · qs · rooms · checklist
 *
 * Props:
 *   students      {Array}
 *   staff         {Array}
 *   currentUser   {Object} — { name, role }
 *   gnsiExamClassMode {string} — 'old' | 'new'
 *   onSetMode     {fn}
 *
 *   // Slot sub-components (pass once migrated)
 *   SeatArrangement
 *   InvigilatorDuty
 *   AttendanceModule
 *   QuestionSubmission
 *   RoomsModule
 *   ChecklistModule
 */

import { useState } from 'react';

// ── Tab definitions ─────────────────────────────────────────────────────────
const EM_TABS = [
  { id: 'seat',      label: '🪑 Seat Arrangement'   },
  { id: 'duty',      label: '👁 Invigilator Duty'    },
  { id: 'attendance',label: '📝 Attendance'          },
  { id: 'qs',        label: '📬 Question Submission' },
  { id: 'rooms',     label: '🏫 Rooms'               },
  { id: 'checklist', label: '✅ Checklist'            },
];

// ── Class mode toggle ───────────────────────────────────────────────────────
function ClassModeBar({ mode, onSetMode }) {
  const isOld = mode === 'old';
  const base = {
    padding: '5px 14px', borderRadius: 8, fontSize: 12,
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
      background: 'linear-gradient(135deg,#f8faff,#eef2ff)',
      border: '1.5px solid #c7d2fe', borderRadius: 10, marginBottom: 12, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1433a8' }}>📋 Class System:</span>
      <button
        style={{
          ...base,
          border: isOld ? '2px solid #1433a8' : '2px solid var(--border)',
          background: isOld ? '#1433a8' : 'var(--surface)',
          color: isOld ? '#fff' : 'var(--muted)',
          fontWeight: isOld ? 800 : 600,
        }}
        onClick={() => onSetMode('old')}
      >
        {isOld ? '✅ ' : ''}Old (Classes)
      </button>
      <button
        style={{
          ...base,
          border: !isOld ? '2px solid #7c3aed' : '2px solid var(--border)',
          background: !isOld ? '#7c3aed' : 'var(--surface)',
          color: !isOld ? '#fff' : 'var(--muted)',
          fontWeight: !isOld ? 800 : 600,
        }}
        onClick={() => onSetMode('new')}
      >
        {!isOld ? '✅ ' : ''}New (Batches)
      </button>
      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>
        {isOld
          ? 'Combined · Navodaya · Foundation · Sainik…'
          : 'Achiever · Leader · Champion · Lakshya · Umeed · Elite · Prime'}
      </span>
    </div>
  );
}

// ── Tab bar ─────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{
      display: 'flex', gap: 3,
      background: 'var(--surface)', border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius)', padding: 5, boxShadow: 'var(--shadow-xs)',
      overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      marginBottom: 22,
    }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              flex: '0 0 auto', minWidth: 90, padding: '9px 8px',
              borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: isActive ? 700 : 500,
              fontFamily: "'DM Sans', sans-serif",
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? '#fff' : 'var(--muted)',
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Placeholder panel ────────────────────────────────────────────────────────
function EMPlaceholder({ tab }) {
  return (
    <div style={{
      padding: '48px 32px', textAlign: 'center',
      background: 'var(--surface)', border: '1.5px dashed var(--border)',
      borderRadius: 14,
    }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{tab?.label?.slice(0, 2)}</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{tab?.label}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
        🚧 Sub-module migration in progress
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ExamManager({
  students   = [],
  staff      = [],
  currentUser = { name: 'Admin', role: 'admin' },
  gnsiExamClassMode = 'old',
  onSetMode  = () => {},

  // slot sub-components
  SeatArrangement,
  InvigilatorDuty,
  AttendanceModule,
  QuestionSubmission,
  RoomsModule,
  ChecklistModule,
}) {
  const [activeTab, setActiveTab] = useState('seat');
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);

  const isAdmin = currentUser?.role === 'admin';

  const activeTabObj = EM_TABS.find((t) => t.id === activeTab);

  const slotMap = {
    seat:       SeatArrangement   && <SeatArrangement students={students} staff={staff} isAdmin={isAdmin} />,
    duty:       InvigilatorDuty   && <InvigilatorDuty staff={staff} isAdmin={isAdmin} />,
    attendance: AttendanceModule  && <AttendanceModule students={students} isAdmin={isAdmin} />,
    qs:         QuestionSubmission && <QuestionSubmission isAdmin={isAdmin} />,
    rooms:      RoomsModule       && <RoomsModule isAdmin={isAdmin} />,
    checklist:  ChecklistModule   && <ChecklistModule isAdmin={isAdmin} />,
  };

  const content = slotMap[activeTab] ?? <EMPlaceholder tab={activeTabObj} />;

  return (
    <div>
      <ClassModeBar mode={gnsiExamClassMode} onSetMode={onSetMode} />

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-eyebrow">GNSI — ACADEMIC</div>
        <div className="page-header-title">🏛️ Exam Manager</div>
        <div className="page-header-sub">
          Seat Chart &nbsp;·&nbsp; Invigilator Duty &nbsp;·&nbsp; Attendance &nbsp;·&nbsp;
          Question Submission &nbsp;·&nbsp; Room Allocation &nbsp;·&nbsp; Material Checklist
        </div>
      </div>

      <TabBar tabs={EM_TABS} active={activeTab} onSelect={(id) => { setActiveTab(id); setShowForm(false); setEditId(null); }} />

      {content}
    </div>
  );
}
