/**
 * MarksGrid.jsx — GNSI Portal
 * Progress Matrix: Class × Subject grid showing marks entered / completion %
 *
 * Props:
 *   students       {Array}   — all students [{ id, name, cls, roll, ... }]
 *   examMarksData  {Object}  — { "examTypeId_subjectId_studentId": mark }
 *   EXAM_TYPES     {Array}   — [{ id, name }]
 *   EXAM_SUBJECTS  {Array}   — [{ id, name, max, pass }]
 *   gnsiExamClassMode {string} — 'old' | 'new'
 *   onCellClick    {fn}      — (classId, subjectId) => void  (jump to entry)
 */

import { useState, useMemo } from 'react';

// ── Batch / class definitions ──────────────────────────────────────────────
const NEW_BATCHES = [
  { id: 'achiever',  label: 'Achiever Batch (Combined)' },
  { id: 'leader',    label: 'Leader Batch (Sainik)'     },
  { id: 'champion',  label: 'Champion Batch (Sainik)'   },
  { id: 'lakshya',   label: 'Lakshya Batch (Navodaya)'  },
  { id: 'umeed',     label: 'Umeed Batch (Navodaya)'    },
  { id: 'elite',     label: 'Elite Batch (Foundation)'  },
  { id: 'prime',     label: 'Prime Batch (Foundation)'  },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getClassNames(students, mode) {
  if (mode === 'new') return NEW_BATCHES.map((b) => b.id);
  return [...new Set(students.map((s) => s.cls).filter(Boolean))].sort();
}

function getClassLabel(classId, mode) {
  if (mode === 'new') {
    return NEW_BATCHES.find((b) => b.id === classId)?.label ?? classId;
  }
  return classId;
}

function getStudentsInClass(students, classId, mode) {
  if (mode === 'new') return students.filter((s) => s.batch === classId);
  return students.filter((s) => s.cls === classId);
}

/**
 * For a given examType + class + subject:
 * returns { entered, total, pct }
 */
function calcCell(students, classId, mode, examTypeId, subjectId, examMarksData) {
  const classStudents = getStudentsInClass(students, classId, mode);
  const total = classStudents.length;
  if (!total) return { entered: 0, total: 0, pct: 0 };

  const entered = classStudents.filter((s) => {
    const key = `${examTypeId}_${subjectId}_${s.id}`;
    return examMarksData?.[key] !== undefined && examMarksData[key] !== null && examMarksData[key] !== '';
  }).length;

  return { entered, total, pct: total > 0 ? Math.round((entered / total) * 100) : 0 };
}

// ── Cell component ─────────────────────────────────────────────────────────
function GridCell({ entered, total, pct, onClick }) {
  const isEmpty = total === 0;
  const isDone  = pct === 100 && total > 0;
  const isPartial = pct > 0 && pct < 100;

  return (
    <td
      onClick={!isEmpty ? onClick : undefined}
      style={{
        padding: '10px 8px',
        border: '1px solid #e2e8f0',
        textAlign: 'center',
        cursor: isEmpty ? 'default' : 'pointer',
        background: isEmpty
          ? '#f8fafc'
          : isDone
          ? '#f0fdf4'
          : isPartial
          ? '#fffbeb'
          : '#fff',
        transition: 'background .15s',
        minWidth: 72,
      }}
      title={isEmpty ? 'No students' : `${entered}/${total} entered — click to jump to entry`}
    >
      {isEmpty ? (
        <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
      ) : (
        <>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: isDone ? '#16a34a' : isPartial ? '#c9870a' : '#64748b',
          }}>
            {entered}/{total}
          </div>
          <div style={{
            fontSize: 11,
            color: isDone ? '#16a34a' : isPartial ? '#c9870a' : '#94a3b8',
          }}>
            {pct}%
          </div>
        </>
      )}
    </td>
  );
}

// ── Exam type selector ─────────────────────────────────────────────────────
function ExamTypePill({ type, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 18px', borderRadius: 9, border: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: active ? 800 : 600,
        background: active ? '#1433a8' : '#f1f5f9',
        color: active ? '#fff' : '#475569',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'all .15s',
        boxShadow: active ? '0 4px 14px #1433a855' : 'none',
      }}
    >
      {type.name}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MarksGrid({
  students      = [],
  examMarksData = {},
  EXAM_TYPES    = [],
  EXAM_SUBJECTS = [],
  gnsiExamClassMode = 'new',
  onCellClick,
}) {
  const [activeExamType, setActiveExamType] = useState(EXAM_TYPES[0]?.id ?? '');

  const classIds = useMemo(
    () => getClassNames(students, gnsiExamClassMode),
    [students, gnsiExamClassMode]
  );

  const activeType = EXAM_TYPES.find((t) => t.id === activeExamType) ?? EXAM_TYPES[0];

  // Overall stats for header
  const overallStats = useMemo(() => {
    let totalEntered = 0, totalSlots = 0;
    classIds.forEach((cls) => {
      EXAM_SUBJECTS.forEach((sub) => {
        const { entered, total } = calcCell(students, cls, gnsiExamClassMode, activeExamType, sub.id, examMarksData);
        totalEntered += entered;
        totalSlots   += total;
      });
    });
    return { totalEntered, totalSlots, pct: totalSlots > 0 ? Math.round((totalEntered / totalSlots) * 100) : 0 };
  }, [students, classIds, EXAM_SUBJECTS, activeExamType, examMarksData, gnsiExamClassMode]);

  if (!EXAM_TYPES.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>No exam types configured</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Go to Setup → Manage to add exam types</div>
      </div>
    );
  }

  return (
    <div>
      {/* Exam type selector */}
      {EXAM_TYPES.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1433a8', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            📋 EXAM:
          </span>
          {EXAM_TYPES.map((t) => (
            <ExamTypePill
              key={t.id}
              type={t}
              active={activeExamType === t.id}
              onClick={() => setActiveExamType(t.id)}
            />
          ))}
        </div>
      )}

      {/* Single exam type shown as pill */}
      {EXAM_TYPES.length === 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            📋 EXAM:
          </span>
          <span style={{
            padding: '8px 20px', borderRadius: 10,
            background: '#1433a8', color: '#fff',
            fontSize: 14, fontWeight: 800,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {EXAM_TYPES[0].name}
          </span>
        </div>
      )}

      {/* Progress Matrix card */}
      <div style={{
        background: '#fff', borderRadius: 14,
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 2px 12px rgba(0,0,0,.06)',
        overflow: 'hidden',
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: '#1433a8' }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
              Progress Matrix — {activeType?.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Click any cell to jump to entry
            </span>
            <span style={{
              padding: '4px 14px', borderRadius: 20,
              background: overallStats.pct === 100 ? '#dcfce7' : overallStats.pct > 0 ? '#fef9c3' : '#f1f5f9',
              color: overallStats.pct === 100 ? '#16a34a' : overallStats.pct > 0 ? '#c9870a' : '#64748b',
              fontSize: 12, fontWeight: 700,
            }}>
              {overallStats.totalEntered}/{overallStats.totalSlots} · {overallStats.pct}%
            </span>
          </div>
        </div>

        {/* Scrollable table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead>
              <tr style={{ background: '#1433a8' }}>
                {/* CLASS column */}
                <th style={{
                  padding: '14px 20px', textAlign: 'left',
                  color: '#fff', fontSize: 12, fontWeight: 800,
                  letterSpacing: '.08em', textTransform: 'uppercase',
                  minWidth: 220, position: 'sticky', left: 0, zIndex: 2,
                  background: '#1433a8',
                }}>
                  CLASS
                </th>
                {/* Subject columns */}
                {EXAM_SUBJECTS.map((sub) => (
                  <th key={sub.id} style={{
                    padding: '10px 8px', textAlign: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    letterSpacing: '.04em', textTransform: 'uppercase',
                    minWidth: 80,
                  }}>
                    <div>{sub.name}</div>
                    {sub.max && (
                      <div style={{ fontSize: 9, opacity: .7, marginTop: 3, fontWeight: 500 }}>
                        MAX:{sub.max}
                        {sub.pass ? ` PASS:${sub.pass}` : ''}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classIds.map((classId, ri) => {
                const classStudents = getStudentsInClass(students, classId, gnsiExamClassMode);
                const classTotal = classStudents.length;
                return (
                  <tr
                    key={classId}
                    style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}
                  >
                    {/* Class label cell */}
                    <td style={{
                      padding: '12px 20px',
                      border: '1px solid #e2e8f0',
                      fontWeight: 700, fontSize: 14,
                      color: '#1e293b',
                      position: 'sticky', left: 0, zIndex: 1,
                      background: ri % 2 === 0 ? '#fff' : '#f8fafc',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span>{getClassLabel(classId, gnsiExamClassMode)}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 20,
                          background: '#e0e8f9', color: '#1433a8',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {classTotal}/0
                        </span>
                      </div>
                    </td>
                    {/* Subject cells */}
                    {EXAM_SUBJECTS.map((sub) => {
                      const cell = calcCell(students, classId, gnsiExamClassMode, activeExamType, sub.id, examMarksData);
                      return (
                        <GridCell
                          key={sub.id}
                          {...cell}
                          onClick={() => onCellClick?.(classId, sub.id)}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 20, padding: '12px 20px',
          borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexWrap: 'wrap',
        }}>
          {[
            { color: '#f0fdf4', text: '#16a34a', label: '100% complete' },
            { color: '#fffbeb', text: '#c9870a', label: 'Partial entry' },
            { color: '#fff',    text: '#64748b', label: 'Not started'   },
            { color: '#f8fafc', text: '#cbd5e1', label: 'No students'   },
          ].map(({ color, text, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: color, border: '1px solid #e2e8f0' }} />
              <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
