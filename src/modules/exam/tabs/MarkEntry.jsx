/**
 * MarkEntry.jsx — GNSI Portal
 * Full mark entry UI:
 *   Course filter → Class selector → Subject selector → Student list with mark inputs
 *
 * Props:
 *   students         {Array}   — [{ id, name, cls, batch, roll, gcc }]
 *   examMarksData    {Object}  — { "examTypeId_subjectId_studentId": mark }
 *   EXAM_TYPES       {Array}   — [{ id, name }]
 *   EXAM_SUBJECTS    {Array}   — [{ id, name, max, pass }]
 *   gnsiExamClassMode {string} — 'old' | 'new'
 *   onSetMode        {fn}      — (mode) => void
 *   onSaveMark       {fn}      — (examTypeId, subjectId, studentId, value) => Promise<void>
 *   onSaveAll        {fn}      — (entries: [{examTypeId,subjectId,studentId,value}]) => Promise<void>
 *   currentUser      {Object}  — { name, role }
 */

import { useState, useMemo, useCallback, useRef } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────
const COURSES = [
  { id: 'all',      label: 'All Courses',        icon: '🏫' },
  { id: 'sainik',   label: 'Sainik',              icon: '⚔️' },
  { id: 'navodaya', label: 'Navodaya',            icon: '📗' },
  { id: 'foundation',label:'Foundation',          icon: '🏛️' },
  { id: 'combined', label: 'Combined',            icon: '🎯' },
  { id: 'combined_nav_sai', label: 'Combined (Nav + Sai)', icon: '🎯' },
];

const NEW_BATCHES = [
  { id: 'achiever', label: 'Achiever Batch (Combined)', course: 'combined'   },
  { id: 'leader',   label: 'Leader Batch (Sainik)',     course: 'sainik'     },
  { id: 'champion', label: 'Champion Batch (Sainik)',   course: 'sainik'     },
  { id: 'lakshya',  label: 'Lakshya Batch (Navodaya)',  course: 'navodaya'   },
  { id: 'umeed',    label: 'Umeed Batch (Navodaya)',    course: 'navodaya'   },
  { id: 'elite',    label: 'Elite Batch (Foundation)',  course: 'foundation' },
  { id: 'prime',    label: 'Prime Batch (Foundation)',  course: 'foundation' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function markKey(examTypeId, subjectId, studentId) {
  return `${examTypeId}_${subjectId}_${studentId}`;
}

function getStudentsForClass(students, classId, mode) {
  if (mode === 'new') return students.filter((s) => s.batch === classId);
  return students.filter((s) => s.cls === classId);
}

function getBatchesForCourse(courseId) {
  if (courseId === 'all') return NEW_BATCHES;
  return NEW_BATCHES.filter((b) => b.course === courseId);
}

function getOldClasses(students) {
  return [...new Set(students.map((s) => s.cls).filter(Boolean))].sort();
}

function countEntered(students, classId, mode, examTypeId, subjectId, marksData) {
  const cls = getStudentsForClass(students, classId, mode);
  const entered = cls.filter((s) => {
    const v = marksData?.[markKey(examTypeId, subjectId, s.id)];
    return v !== undefined && v !== null && v !== '';
  }).length;
  return { entered, total: cls.length };
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Top header bar */
function EntryHeader({ examName, subject, onSaveAll, saving, entered, total, passRate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 24px', flexWrap: 'wrap', gap: 12,
      background: 'linear-gradient(135deg,#1433a8,#1b44cc)',
      borderRadius: 14, marginBottom: 16, color: '#fff',
    }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>
          ✏️ {examName} — Mark Entry
        </div>
        {subject && (
          <div style={{ fontSize: 13, opacity: .8, marginTop: 3 }}>
            Subject: <b>{subject.name}</b> · Max: {subject.max} · Pass: {subject.pass}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {/* Entered stat */}
        <div style={{
          background: 'rgba(255,255,255,.12)', borderRadius: 10,
          padding: '8px 16px', textAlign: 'center', minWidth: 70,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{entered}/{total}</div>
          <div style={{ fontSize: 11, opacity: .75 }}>Entered</div>
        </div>
        {/* Pass rate */}
        <div style={{
          background: 'rgba(255,255,255,.12)', borderRadius: 10,
          padding: '8px 16px', textAlign: 'center', minWidth: 70,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{passRate ?? '—'}</div>
          <div style={{ fontSize: 11, opacity: .75 }}>Pass Rate</div>
        </div>
        {/* Save all button */}
        <button
          onClick={onSaveAll}
          disabled={saving}
          style={{
            padding: '10px 22px', borderRadius: 10,
            background: '#fff', color: '#1433a8',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 800,
            fontFamily: "'DM Sans', sans-serif",
            opacity: saving ? .6 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          💾 {saving ? 'Saving…' : 'All Saved'}
        </button>
      </div>
    </div>
  );
}

/** Course filter pills */
function CourseFilter({ courses, activeCourse, onSelect, studentCounts }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      flexWrap: 'wrap', marginBottom: 16,
      padding: '12px 16px',
      background: '#f8fafc', borderRadius: 10,
      border: '1px solid #e2e8f0',
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        🎓 COURSE:
      </span>
      {courses.map((c) => {
        const isActive = activeCourse === c.id;
        const count = studentCounts?.[c.id] ?? 0;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              padding: '6px 16px', borderRadius: 20,
              border: isActive ? '2px solid #1433a8' : '1.5px solid #e2e8f0',
              background: isActive ? '#1433a8' : '#fff',
              color: isActive ? '#fff' : '#475569',
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all .15s',
            }}
          >
            {c.icon} {c.label}
            {c.id !== 'all' && (
              <span style={{
                background: isActive ? 'rgba(255,255,255,.25)' : '#e0e8f9',
                color: isActive ? '#fff' : '#1433a8',
                borderRadius: 20, padding: '0 6px', fontSize: 11, fontWeight: 700,
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontStyle: 'italic' }}>
        ✨ Permanent — saved across sessions
      </span>
    </div>
  );
}

/** Class selector grid */
function ClassSelector({ classes, activeClass, onSelect, students, mode, examTypeId, subjectId, marksData }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
        🏫 CLASS: <span style={{ color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>(TEMPORARY)</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {classes.map((cls) => {
          const isActive = activeClass === cls.id;
          const { entered, total } = countEntered(students, cls.id, mode, examTypeId, subjectId, marksData);
          return (
            <button
              key={cls.id}
              onClick={() => onSelect(cls.id)}
              style={{
                padding: '12px 20px', borderRadius: 12,
                border: isActive ? '2.5px solid #1433a8' : '1.5px solid #e2e8f0',
                background: isActive ? 'rgba(20,51,168,.06)' : '#fff',
                color: '#1e293b', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                textAlign: 'left', minWidth: 180,
                transition: 'all .15s',
                boxShadow: isActive ? '0 0 0 3px #1433a820' : 'none',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: isActive ? 800 : 600 }}>{cls.label}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{entered}/{total}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Subject selector pills */
function SubjectSelector({ subjects, activeSubject, onSelect, students, activeClass, mode, examTypeId, marksData }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
        📋 SUBJECT:
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {subjects.map((sub) => {
          const isActive = activeSubject === sub.id;
          const { entered, total } = countEntered(students, activeClass, mode, examTypeId, sub.id, marksData);
          return (
            <button
              key={sub.id}
              onClick={() => onSelect(sub.id)}
              style={{
                padding: '8px 16px', borderRadius: 20,
                border: isActive ? '2px solid #1433a8' : '1.5px solid #e2e8f0',
                background: isActive ? '#1433a8' : '#fff',
                color: isActive ? '#fff' : '#475569',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {sub.name}
              <span style={{
                background: isActive ? 'rgba(255,255,255,.25)' : '#e0e8f9',
                color: isActive ? '#fff' : '#1433a8',
                borderRadius: 20, padding: '0 6px', fontSize: 11, fontWeight: 700,
              }}>
                {entered}/{total}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Student mark input row */
function StudentRow({ student, mark, maxMark, passMark, onChange, onBlur, index }) {
  const numMark  = mark !== '' && mark !== undefined && mark !== null ? Number(mark) : null;
  const isPassed = numMark !== null && passMark && numMark >= passMark;
  const isFailed = numMark !== null && passMark && numMark < passMark;
  const isOver   = numMark !== null && maxMark && numMark > maxMark;

  return (
    <tr style={{ background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
      {/* Index */}
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8', fontWeight: 700, width: 40 }}>
        {index + 1}
      </td>
      {/* Roll */}
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
        {student.roll ?? '—'}
      </td>
      {/* Name */}
      <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
        {student.name}
        {student.gcc && student.gcc !== '--' && (
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>GCC: {student.gcc}</span>
        )}
      </td>
      {/* Class */}
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
        {student.cls ?? student.batch ?? '—'}
      </td>
      {/* Mark input */}
      <td style={{ padding: '8px 12px', width: 110 }}>
        <input
          type="number"
          min={0}
          max={maxMark}
          value={mark ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="—"
          style={{
            width: '100%', padding: '7px 10px',
            borderRadius: 8,
            border: isOver
              ? '2px solid #ef4444'
              : numMark !== null
              ? `2px solid ${isPassed ? '#16a34a' : '#ef4444'}`
              : '1.5px solid #e2e8f0',
            fontSize: 14, fontWeight: 700, textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            outline: 'none',
            background: isOver ? '#fef2f2' : isPassed ? '#f0fdf4' : isFailed ? '#fef2f2' : '#fff',
            color: isOver ? '#ef4444' : isPassed ? '#16a34a' : isFailed ? '#ef4444' : '#1e293b',
          }}
        />
      </td>
      {/* Status badge */}
      <td style={{ padding: '10px 12px', width: 80 }}>
        {numMark === null ? (
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
        ) : isOver ? (
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠️ Over</span>
        ) : isPassed ? (
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✅ Pass</span>
        ) : (
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>❌ Fail</span>
        )}
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MarkEntry({
  students         = [],
  examMarksData    = {},
  EXAM_TYPES       = [],
  EXAM_SUBJECTS    = [],
  gnsiExamClassMode = 'new',
  onSetMode        = () => {},
  onSaveMark       = async () => {},
  onSaveAll        = async () => {},
  currentUser      = { name: 'Admin', role: 'admin' },
}) {
  const [activeCourse,  setActiveCourse]  = useState('all');
  const [activeClass,   setActiveClass]   = useState(null);
  const [activeSubject, setActiveSubject] = useState(EXAM_SUBJECTS[0]?.id ?? '');
  const [activeExamType]                  = useState(EXAM_TYPES[0]?.id ?? '');
  const [search,        setSearch]        = useState('');
  const [localMarks,    setLocalMarks]    = useState({});
  const [saving,        setSaving]        = useState(false);
  const [dirty,         setDirty]         = useState({});

  // ── Derived classes list ────────────────────────────────────────────────
  const classList = useMemo(() => {
    if (gnsiExamClassMode === 'new') {
      const batches = getBatchesForCourse(activeCourse);
      return batches;
    }
    return getOldClasses(students).map((c) => ({ id: c, label: c }));
  }, [gnsiExamClassMode, activeCourse, students]);

  // Auto-select first class when list changes
  const safeActiveClass = classList.find((c) => c.id === activeClass)
    ? activeClass
    : classList[0]?.id ?? null;

  // ── Filtered students ───────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    if (!safeActiveClass) return [];
    let list = getStudentsForClass(students, safeActiveClass, gnsiExamClassMode);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name?.toLowerCase().includes(q) || String(s.roll ?? '').includes(q)
      );
    }
    return list;
  }, [students, safeActiveClass, gnsiExamClassMode, search]);

  // ── Current subject ─────────────────────────────────────────────────────
  const currentSubject = EXAM_SUBJECTS.find((s) => s.id === activeSubject);

  // ── Marks resolution (local overrides saved) ────────────────────────────
  const getMark = useCallback((studentId) => {
    const k = markKey(activeExamType, activeSubject, studentId);
    return localMarks[k] !== undefined ? localMarks[k] : examMarksData?.[k] ?? '';
  }, [localMarks, examMarksData, activeExamType, activeSubject]);

  // ── Entry stats ─────────────────────────────────────────────────────────
  const { entered, total, passRate } = useMemo(() => {
    const cls = safeActiveClass
      ? getStudentsForClass(students, safeActiveClass, gnsiExamClassMode)
      : [];
    let entered = 0, passed = 0;
    cls.forEach((s) => {
      const v = getMark(s.id);
      if (v !== '' && v !== null && v !== undefined) {
        entered++;
        if (currentSubject?.pass && Number(v) >= currentSubject.pass) passed++;
      }
    });
    const rate = entered > 0 ? `${Math.round((passed / entered) * 100)}%` : '—';
    return { entered, total: cls.length, passRate: rate };
  }, [students, safeActiveClass, gnsiExamClassMode, getMark, currentSubject]);

  // ── Course student counts ───────────────────────────────────────────────
  const studentCounts = useMemo(() => {
    const counts = { all: students.length };
    COURSES.slice(1).forEach((c) => {
      if (gnsiExamClassMode === 'new') {
        const batches = getBatchesForCourse(c.id);
        counts[c.id] = batches.reduce(
          (s, b) => s + getStudentsForClass(students, b.id, 'new').length, 0
        );
      } else {
        counts[c.id] = 0;
      }
    });
    return counts;
  }, [students, gnsiExamClassMode]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleMarkChange = (studentId, value) => {
    const k = markKey(activeExamType, activeSubject, studentId);
    setLocalMarks((prev) => ({ ...prev, [k]: value }));
    setDirty((prev) => ({ ...prev, [k]: true }));
  };

  const handleMarkBlur = async (studentId) => {
    const k = markKey(activeExamType, activeSubject, studentId);
    if (!dirty[k]) return;
    const value = localMarks[k];
    try {
      await onSaveMark(activeExamType, activeSubject, studentId, value);
      setDirty((prev) => { const n = { ...prev }; delete n[k]; return n; });
    } catch (e) {
      console.error('Save failed:', e);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const entries = Object.entries(dirty)
      .filter(([, d]) => d)
      .map(([k]) => {
        const [examTypeId, subjectId, studentId] = k.split('_');
        return { examTypeId, subjectId, studentId, value: localMarks[k] };
      });
    try {
      await onSaveAll(entries);
      setDirty({});
    } catch (e) {
      console.error('Save all failed:', e);
    } finally {
      setSaving(false);
    }
  };

  if (!EXAM_TYPES.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✏️</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>No exam types configured</div>
      </div>
    );
  }

  return (
    <div>
      {/* Top entry header */}
      <EntryHeader
        examName={EXAM_TYPES[0]?.name ?? 'Exam'}
        subject={currentSubject}
        onSaveAll={handleSaveAll}
        saving={saving}
        entered={entered}
        total={total}
        passRate={passRate}
      />

      {/* Course filter */}
      <CourseFilter
        courses={COURSES}
        activeCourse={activeCourse}
        onSelect={setActiveCourse}
        studentCounts={studentCounts}
      />

      {/* Class selector */}
      {classList.length > 0 && (
        <ClassSelector
          classes={classList}
          activeClass={safeActiveClass}
          onSelect={setActiveClass}
          students={students}
          mode={gnsiExamClassMode}
          examTypeId={activeExamType}
          subjectId={activeSubject}
          marksData={{ ...examMarksData, ...localMarks }}
        />
      )}

      {/* Subject selector */}
      <SubjectSelector
        subjects={EXAM_SUBJECTS}
        activeSubject={activeSubject}
        onSelect={setActiveSubject}
        students={students}
        activeClass={safeActiveClass}
        mode={gnsiExamClassMode}
        examTypeId={activeExamType}
        marksData={{ ...examMarksData, ...localMarks }}
      />

      {/* Student list */}
      <div style={{
        background: '#fff', borderRadius: 14,
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 2px 12px rgba(0,0,0,.06)',
        overflow: 'hidden',
      }}>
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by name or roll…"
              style={{
                width: '100%', padding: '9px 12px 9px 36px',
                border: '1.5px solid #e2e8f0', borderRadius: 9,
                fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                outline: 'none', background: '#fff',
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 16 }}>
            {filteredStudents.length} students
          </span>
        </div>

        {/* Table */}
        {filteredStudents.length === 0 ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {search ? 'No students match your search' : 'No students in this class'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Roll</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Name</th>
                  <th style={thStyle}>Class</th>
                  <th style={thStyle}>
                    Marks
                    {currentSubject?.max && (
                      <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', fontWeight: 500 }}>
                        / {currentSubject.max}
                      </span>
                    )}
                  </th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, i) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    index={i}
                    mark={getMark(student.id)}
                    maxMark={currentSubject?.max}
                    passMark={currentSubject?.pass}
                    onChange={(val) => handleMarkChange(student.id, val)}
                    onBlur={() => handleMarkBlur(student.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer save bar */}
        {Object.keys(dirty).length > 0 && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#fffbeb',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: '#c9870a', fontWeight: 600 }}>
              ⚠️ {Object.keys(dirty).length} unsaved change(s)
            </span>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: '#1433a8', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              💾 {saving ? 'Saving…' : 'Save All'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '10px 14px',
  fontSize: 11, fontWeight: 700,
  color: '#64748b', textAlign: 'center',
  textTransform: 'uppercase', letterSpacing: '.06em',
};
