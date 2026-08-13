import { useState, useCallback } from 'react';
import { supabase } from './supabase';
import './ParentsPortal.css';

const EMBLEM_URL = "https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/gnsi-emblem.png";

// ── REPORT CARD GRADING ──────────────────────────────────────────────────────

const RC_GRADE_PRESETS = [
  { min: 90, label: "A+", color: "#0F6E56", gpa: 4.0 },
  { min: 80, label: "A",  color: "#185FA5", gpa: 3.5 },
  { min: 70, label: "B+", color: "#534AB7", gpa: 3.0 },
  { min: 60, label: "B",  color: "#2563eb", gpa: 2.5 },
  { min: 50, label: "C",  color: "#BA7517", gpa: 2.0 },
  { min: 40, label: "D",  color: "#ea580c", gpa: 1.0 },
  { min: 0,  label: "F",  color: "#A32D2D", gpa: 0.0 },
];
function rcGetGrade(pct) {
  for (const g of RC_GRADE_PRESETS) if (pct >= g.min) return g;
  return RC_GRADE_PRESETS[RC_GRADE_PRESETS.length - 1];
}
const RC_COURSE_MAX_MARKS = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
};

// TODO: buildRCHTML/RC_CSS were referenced in the original file but never
// defined anywhere in the codebase — the "Print/View Report Card" button
// has never actually worked. Needs: buildRCHTML(student, subjects,
// subjectMaxMap, courseMax, marksMap, allStudents, examTypeName, examDate,
// institute, remarkText) -> full HTML string, and a RC_CSS string for the
// print stylesheet. Until written, printing fails with a clear, honest
// message instead of a generic error.
const buildRCHTML = undefined; // see TODO above
const RC_CSS = undefined;      // see TODO above

const TABS = [
  { id: 'att',        label: '📊 Attendance' },
  { id: 'exams',       label: '📝 Exam Scores' },
  { id: 'reportcard', label: '🧾 Report Card' },
  { id: 'notices',    label: '📣 Notices' },
  { id: 'leave',       label: '🏠 Hostel Leave' },
  { id: 'alerts',      label: '🔔 Alerts' },
];

const initialTabState = { status: 'idle', data: null, error: null };

/**
 * ParentsPortal — student login + attendance/exams/report-card/leave/alerts
 * dashboard. Talks directly to Supabase; has no dependency on websiteApi.js.
 * All data lives in React state — no getElementById/innerHTML.
 */
export default function ParentsPortal({ isOpen, onClose }) {
  const [student, setStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('att');

  const [loginGcc, setLoginGcc] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [attendance, setAttendance] = useState(initialTabState);
  const [exams, setExams] = useState(initialTabState);
  const [notices, setNotices] = useState(initialTabState);
  const [leave, setLeave] = useState(initialTabState);
  const [alerts, setAlerts] = useState(initialTabState);

  const [rcExamTypes, setRcExamTypes] = useState({ status: 'idle', options: [] });
  const [rcSelectedType, setRcSelectedType] = useState('');
  const [rcDates, setRcDates] = useState({ status: 'idle', options: [] });
  const [rcSelectedDate, setRcSelectedDate] = useState('');
  const [rcPrintBusy, setRcPrintBusy] = useState(false);

  const resetPortalState = () => {
    setStudent(null);
    setActiveTab('att');
    setAttendance(initialTabState);
    setExams(initialTabState);
    setNotices(initialTabState);
    setLeave(initialTabState);
    setAlerts(initialTabState);
    setRcExamTypes({ status: 'idle', options: [] });
    setRcSelectedType('');
    setRcDates({ status: 'idle', options: [] });
    setRcSelectedDate('');
  };

  // ── LOGIN / LOGOUT ─────────────────────────────────────────────────────────

  const handleLogin = async () => {
    const gccNo = loginGcc.trim();
    const nameInput = loginName.trim().toUpperCase();

    if (!gccNo || !nameInput) {
      setLoginError('Please enter both GCC No. and Student Name.');
      return;
    }
    setLoginBusy(true);
    setLoginError('');

    try {
      const timeout = (ms) => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), ms));

      const { data, error } = await Promise.race([
        supabase
          .from('students')
          .select('id, name, course, class_name, batch, hostel_type, status, admission_no, gcc_no')
          .eq('gcc_no', gccNo)
          .single(),
        timeout(15000),
      ]);

      const normalizedDataName = (data?.name || '').toUpperCase().replace(/\s+/g, ' ').trim();
      const normalizedInput = nameInput.replace(/\s+/g, ' ').trim();

      if (error || !data || normalizedDataName !== normalizedInput) {
        const msg = error ? `Error: ${error.message}` : !data ? 'GCC No. not found.' : 'Name does not match.';
        setLoginError(msg);
        setLoginBusy(false);
        return;
      }

      setStudent(data);
      setLoginBusy(false);
      loadAttendance(data.id);
    } catch (e) {
      setLoginError(e?.message || 'Connection error. Try again.');
      setLoginBusy(false);
    }
  };

  const handleLogout = () => {
    setLoginGcc('');
    setLoginName('');
    setLoginError('');
    resetPortalState();
  };

  const handleTabClick = (id) => {
    setActiveTab(id);
    if (!student) return;
    if (id === 'att' && attendance.status === 'idle') loadAttendance(student.id);
    if (id === 'exams' && exams.status === 'idle') loadExams(student.id);
    if (id === 'reportcard' && rcExamTypes.status === 'idle') loadReportCardExamTypes(student.id);
    if (id === 'notices' && notices.status === 'idle') loadNotices();
    if (id === 'leave' && leave.status === 'idle') loadLeave(student.id);
    if (id === 'alerts' && alerts.status === 'idle') loadAlerts(student.id);
  };

  // ── TAB: ATTENDANCE ──────────────────────────────────────────────────────

  const loadAttendance = useCallback(async (studentId) => {
    setAttendance({ status: 'loading', data: null, error: null });

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const from = `${y}-${m}-01`;
    // Real last day of the month, not a hardcoded '31' (invalid for
    // Feb/Apr/Jun/Sep/Nov and could break the range filter).
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    try {
      const { data } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('student_id', studentId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true });

      const rows = data || [];
      const present = rows.filter(r => r.status === 'Present').length;
      const absent = rows.filter(r => r.status === 'Absent').length;
      const pct = rows.length ? Math.round((present / rows.length) * 100) : 0;

      setAttendance({
        status: 'ready',
        error: null,
        data: { rows, monthLabel, daysInMonth: lastDay, y, m, present, absent, pct },
      });
    } catch (e) {
      console.error('Attendance load failed:', e);
      setAttendance({ status: 'error', data: null, error: 'Failed to load attendance' });
    }
  }, []);

  // ── TAB: EXAM SCORES ─────────────────────────────────────────────────────

  const loadExams = useCallback(async (studentId) => {
    setExams({ status: 'loading', data: null, error: null });
    try {
      const { data: marks } = await supabase
        .from('exam_marks')
        .select('subject, marks_obtained, total_marks, exam_date, exam_type_id')
        .eq('student_id', studentId)
        .order('exam_date', { ascending: false });

      if (!marks?.length) {
        setExams({ status: 'ready', data: [], error: null });
        return;
      }

      const typeIds = [...new Set(marks.map(r => r.exam_type_id).filter(Boolean))];
      const { data: types } = typeIds.length
        ? await supabase.from('exam_types').select('id, name').in('id', typeIds)
        : { data: [] };
      const typeMap = Object.fromEntries((types || []).map(t => [t.id, t.name]));

      const rows = marks.map(r => {
        const total = r.total_marks ?? null;
        const examName = typeMap[r.exam_type_id] || '—';
        // Guard against NaN: an ungraded subject (marks_obtained is
        // null/undefined) must not silently render as a low score.
        const hasMarks = r.marks_obtained !== null && r.marks_obtained !== undefined;
        const pct = (total !== null && hasMarks) ? Math.round((r.marks_obtained / total) * 100) : null;
        return { ...r, examName, total, hasMarks, pct };
      });

      setExams({ status: 'ready', data: rows, error: null });
    } catch (e) {
      console.error('Exams load failed:', e);
      setExams({ status: 'error', data: null, error: 'Failed to load exam scores' });
    }
  }, []);

  // ── TAB: REPORT CARD ─────────────────────────────────────────────────────

  const loadReportCardExamTypes = useCallback(async (studentId) => {
    setRcExamTypes({ status: 'loading', options: [] });
    try {
      const { data: marks } = await supabase
        .from('exam_marks')
        .select('exam_type_id')
        .eq('student_id', studentId);

      const typeIds = [...new Set((marks || []).map(r => r.exam_type_id).filter(Boolean))];
      if (!typeIds.length) {
        setRcExamTypes({ status: 'empty', options: [] });
        return;
      }
      const { data: types } = await supabase.from('exam_types').select('id, name').in('id', typeIds);
      setRcExamTypes({ status: 'ready', options: types || [] });
    } catch (e) {
      console.error('Report card exam types load failed:', e);
      setRcExamTypes({ status: 'error', options: [] });
    }
  }, []);

  const handleRcExamTypeChange = async (examTypeId) => {
    setRcSelectedType(examTypeId);
    setRcSelectedDate('');
    if (!examTypeId) { setRcDates({ status: 'idle', options: [] }); return; }
    if (!student) return;

    setRcDates({ status: 'loading', options: [] });
    try {
      const { data } = await supabase
        .from('exam_marks')
        .select('exam_date')
        .eq('student_id', student.id)
        .eq('exam_type_id', examTypeId);
      const dates = [...new Set((data || []).map(r => (r.exam_date || '').slice(0, 10)).filter(Boolean))].sort().reverse();
      setRcDates({ status: dates.length ? 'ready' : 'empty', options: dates });
    } catch (e) {
      console.error('Exam date load failed:', e);
      setRcDates({ status: 'error', options: [] });
    }
  };

  const handlePrintReportCard = async () => {
    const examTypeId = rcSelectedType;
    const examDate = rcSelectedDate;
    if (!examTypeId || !examDate || !student) return;

    setRcPrintBusy(true);
    try {
      // buildRCHTML/RC_CSS are not implemented yet (see TODO at top of
      // file) — fail clearly instead of pretending this works.
      if (typeof buildRCHTML !== 'function') {
        throw new Error('Report card template is not yet configured. Please contact the developer.');
      }

      const course = (student.class_name || student.batch || '').toUpperCase();
      const examTypeName = rcExamTypes.options.find(t => String(t.id) === String(examTypeId))?.name || 'Examination';

      const { data: sched } = await supabase
        .from('exam_schedule')
        .select('id, subject, total_marks')
        .eq('exam_type_id', examTypeId)
        .eq('course', course);

      let subjects = [], subjectMaxMap = {}, courseMax = 0;
      if (sched && sched.length) {
        subjects = sched.map(s => s.subject);
        sched.forEach(s => { subjectMaxMap[s.subject] = Number(s.total_marks) || 100; });
        courseMax = sched.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0);
      } else {
        const { data: csSetting } = await supabase.from('system_settings').select('value').eq('key', 'course_subjects').maybeSingle();
        let cfg = {};
        try { cfg = JSON.parse(csSetting?.value || '{}'); } catch (_) {}
        subjects = cfg[course] || [];
        subjectMaxMap = RC_COURSE_MAX_MARKS[course] || {};
        courseMax = Object.values(subjectMaxMap).reduce((s, v) => s + v, 0) || 100;
      }

      const { data: classmates } = await supabase
        .from('students')
        .select('id, name, gcc_no, class_name, course, admission_no')
        .ilike('class_name', course);
      const allStudents = (classmates && classmates.length) ? classmates : [student];

      const ids = allStudents.map(s => s.id);
      const [{ data: schedRows }, { data: markRows }] = await Promise.all([
        supabase.from('exam_schedule').select('id, subject').eq('exam_type_id', examTypeId).eq('course', course),
        supabase.from('exam_marks').select('student_id, exam_id, subject, marks_obtained, exam_date').eq('exam_type_id', examTypeId).in('student_id', ids),
      ]);
      const examIdToSubject = {};
      (schedRows || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
      const marksMap = {};
      (markRows || []).forEach(r => {
        if ((r.exam_date || '').slice(0, 10) !== examDate) return;
        const sub = examIdToSubject[r.exam_id] || r.subject;
        if (sub) marksMap[`${r.student_id}-${sub}`] = r.marks_obtained;
      });

      const { data: remarkRow } = await supabase.from('exam_remarks').select('remark')
        .eq('student_id', student.id).eq('exam_type_id', examTypeId).eq('exam_date', examDate).maybeSingle();
      const remarkText = remarkRow?.remark || '';

      const { data: instSetting } = await supabase.from('system_settings').select('value').eq('key', 'exam_institute_config').maybeSingle();
      let institute = { name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok, Thoubal, Manipur', academicYear: '2026-2027' };
      try { institute = { ...institute, ...JSON.parse(instSetting?.value || '{}') }; } catch (_) {}

      const html = buildRCHTML(student, subjects, subjectMaxMap, courseMax, marksMap, allStudents, examTypeName, examDate, institute, remarkText);

      let overlay = document.getElementById('rcPrintOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'rcPrintOverlay';
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;min-height:100vh;z-index:99999;background:#f4f4f4;';
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);

        if (!document.getElementById('rcPrintStyles')) {
          const styleTag = document.createElement('style');
          styleTag.id = 'rcPrintStyles';
          styleTag.textContent = `
            @media print {
              body > *:not(#rcPrintOverlay) { display: none !important; }
              #rcPrintOverlay .no-print { display: none !important; }
            }
          `;
          document.head.appendChild(styleTag);
        }
      }
      overlay.innerHTML = `
        <style>${RC_CSS}</style>
        <div class="no-print" style="position:sticky;top:0;z-index:2;background:#080F1E;padding:.8rem 1.2rem;display:flex;gap:.6rem;justify-content:flex-end;box-shadow:0 2px 10px rgba(0,0,0,.2);">
          <button onclick="window.print()" style="padding:.6rem 1.2rem;background:#8C6F2E;color:#080F1E;border:none;font-weight:700;cursor:pointer;border-radius:4px;">🖨️ Print / Save as PDF</button>
          <button onclick="document.getElementById('rcPrintOverlay').remove();document.body.style.overflow='';" style="padding:.6rem 1.2rem;background:transparent;color:#F7F3E9;border:1px solid #8C6F2E;cursor:pointer;border-radius:4px;">✕ Close</button>
        </div>
        ${html}
      `;
      overlay.scrollTop = 0;
    } catch (e) {
      console.error('Report card generation failed:', e);
      alert('Could not generate the report card: ' + (e?.message || 'unknown error') + '. Please try again or contact support.');
    } finally {
      setRcPrintBusy(false);
    }
  };

  // ── TAB: NOTICES ─────────────────────────────────────────────────────────

  const loadNotices = useCallback(async () => {
    setNotices({ status: 'loading', data: null, error: null });
    try {
      const { data } = await supabase
        .from('notices')
        .select('title, body, priority, notice_date')
        .eq('is_archived', false)
        .order('notice_date', { ascending: false })
        .limit(15);

      setNotices({ status: 'ready', data: data || [], error: null });
    } catch (e) {
      console.error('Notices load failed:', e);
      setNotices({ status: 'error', data: null, error: 'Failed to load notices' });
    }
  }, []);

  // ── TAB: HOSTEL LEAVE ────────────────────────────────────────────────────

  const loadLeave = useCallback(async (studentId) => {
    setLeave({ status: 'loading', data: null, error: null });
    try {
      const { data } = await supabase
        .from('leave_requests')
        .select('from_date, to_date, reason, status, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(20);

      setLeave({ status: 'ready', data: data || [], error: null });
    } catch (e) {
      console.error('Leave load failed:', e);
      setLeave({ status: 'error', data: null, error: 'Failed to load leave history' });
    }
  }, []);

  // ── TAB: ALERTS ──────────────────────────────────────────────────────────

  const loadAlerts = useCallback(async (studentId) => {
    setAlerts({ status: 'loading', data: null, error: null });
    try {
      const [attRes, examRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('date, status')
          .eq('student_id', studentId)
          .eq('status', 'Absent')
          .order('date', { ascending: false })
          .limit(5),
        supabase
          .from('exam_marks')
          .select('exam_type_id, marks_obtained, total_marks, exam_date')
          .eq('student_id', studentId)
          .order('exam_date', { ascending: false })
          .limit(20),
      ]);

      const examRows = examRes.data || [];
      const typeIds = [...new Set(examRows.map(r => r.exam_type_id).filter(Boolean))];
      const { data: types } = typeIds.length
        ? await supabase.from('exam_types').select('id, name').in('id', typeIds)
        : { data: [] };
      const typeMap = Object.fromEntries((types || []).map(t => [t.id, t.name]));

      const items = [];
      (attRes.data || []).forEach(r => {
        items.push({ type: 'att', msg: `Absent on ${r.date}`, date: r.date });
      });
      examRows.forEach(r => {
        const total = r.total_marks;
        const hasMarks = r.marks_obtained !== null && r.marks_obtained !== undefined;
        const pct = (total && hasMarks) ? Math.round((r.marks_obtained / total) * 100) : null;
        if (pct !== null && pct < 50) {
          const name = typeMap[r.exam_type_id] || 'Exam';
          items.push({ type: 'exam', msg: `Low score in ${name}: ${r.marks_obtained}/${total} (${pct}%)`, date: r.exam_date });
        }
      });

      setAlerts({ status: 'ready', data: items, error: null });
    } catch (e) {
      console.error('Alerts load failed:', e);
      setAlerts({ status: 'error', data: null, error: 'Failed to load alerts' });
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="pp-overlay open" id="ppOverlay">
      {!student ? (
        <div className="pp-login-wrap" id="ppLoginWrap">
          <button className="pp-close" onClick={onClose}>
            ✕
          </button>
          <div className="pp-box">
            <div className="pp-logo">
              <img
                src={EMBLEM_URL}
                alt="GNSI"
                style={{ height: 70, width: 70, objectFit: "contain", margin: "0 auto .8rem", display: "block" }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <h2>Parents Portal</h2>
              <p>GNSI · Khangabok, Manipur</p>
            </div>
            {loginError && <div className="pp-err" style={{ display: 'block' }}>{loginError}</div>}
            <label className="pp-fl">GCC No.</label>
            <input
              type="text"
              className="pp-fi"
              placeholder="e.g. 1107"
              value={loginGcc}
              onChange={(e) => setLoginGcc(e.target.value)}
            />
            <label className="pp-fl">Student Name</label>
            <input
              type="text"
              className="pp-fi"
              placeholder="Full name as registered"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
            />
            <button className="pp-lbtn" disabled={loginBusy} onClick={handleLogin}>
              {loginBusy ? 'Checking…' : 'Login to Parents Portal →'}
            </button>
            <p
              style={{
                color: "rgba(247,243,233,.85)",
                fontSize: ".7rem",
                fontFamily: '"Rajdhani",sans-serif',
                letterSpacing: ".05em",
                textAlign: "center",
                marginTop: "1rem"
              }}
            >
              Contact institute if you need help:{" "}
              <a href="tel:+918974298074" style={{ color: "var(--goldL)" }}>
                +91 89742 98074
              </a>
            </p>
          </div>
        </div>
      ) : (
        <div className="pp-shell show" id="ppShell">
          <div className="pp-topbar">
            <div className="pp-topbar-l">
              <img src={EMBLEM_URL} alt="GNSI" style={{ height: 36, width: 36, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
              <div>
                <h3>{student.name || 'Student'}</h3>
                <p>GNSI Parents Portal</p>
              </div>
            </div>
            <button className="pp-lout" onClick={() => { handleLogout(); onClose(); }}>
              Logout ✕
            </button>
          </div>
          <div className="pp-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`pp-tab${activeTab === t.id ? ' active' : ''}`}
                onClick={() => handleTabClick(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="pp-content">
            <div className="stu-hdr">
              <div className="stu-av">
                {((student.name || 'S')[0] || 'S').toUpperCase()}
              </div>
              <div className="stu-info">
                <h3>{student.name || 'Student'}</h3>
                <p>{[student.course, student.class_name, student.batch].filter(Boolean).join(' · ')}</p>
                <div className="stu-badges">
                  <span className="stu-badge">{student.hostel_type || '—'}</span>
                  <span className="stu-badge">{student.status || 'Active'}</span>
                </div>
              </div>
            </div>

            {activeTab === 'att' && (
              <AttendanceTab state={attendance} />
            )}
            {activeTab === 'exams' && (
              <ExamsTab state={exams} />
            )}
            {activeTab === 'reportcard' && (
              <ReportCardTab
                examTypes={rcExamTypes}
                selectedType={rcSelectedType}
                onTypeChange={handleRcExamTypeChange}
                dates={rcDates}
                selectedDate={rcSelectedDate}
                onDateChange={setRcSelectedDate}
                onPrint={handlePrintReportCard}
                printBusy={rcPrintBusy}
              />
            )}
            {activeTab === 'notices' && (
              <NoticesTab state={notices} />
            )}
            {activeTab === 'leave' && (
              <LeaveTab state={leave} />
            )}
            {activeTab === 'alerts' && (
              <AlertsTab state={alerts} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAB COMPONENTS ────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="pp-loading">
      <div className="spin" />
      Loading…
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className="pp-empty">
      <div className="pp-empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

function AttendanceTab({ state }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="pp-sec active">
        <div className="pp-card"><div className="pp-card-body"><Loading /></div></div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="pp-sec active">
        <div className="pp-card"><div className="pp-card-body"><Empty icon="⚠️" text={state.error} /></div></div>
      </div>
    );
  }

  const { rows, monthLabel, daysInMonth, y, m, present, absent, pct } = state.data;
  const byDate = Object.fromEntries(rows.map(r => [r.date.slice(8, 10), r.status]));
  const last10 = rows.slice(-10).reverse();

  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd">
          <div className="pp-card-title">This Month's Attendance</div>
          <div style={{ color: "rgba(247,243,233,.28)", fontSize: ".68rem", fontFamily: '"Rajdhani",sans-serif', letterSpacing: ".06em", textTransform: "uppercase" }}>
            {monthLabel}
          </div>
        </div>
        <div className="pp-card-body">
          <div className="att-grid">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const dd = String(d).padStart(2, '0');
              const st = byDate[dd];
              const cls = st === 'Present' ? 'att-p' : st === 'Absent' ? 'att-a' : 'att-h';
              return <div key={d} className={`att-day ${cls}`} title={`${y}-${m}-${dd}`}>{d}</div>;
            })}
          </div>
          <div className="att-sum">
            <div className="att-si p"><strong>{present}</strong><span>Present</span></div>
            <div className="att-si a"><strong>{absent}</strong><span>Absent</span></div>
            <div className="att-si pct"><strong>{pct}%</strong><span>Rate</span></div>
          </div>
        </div>
      </div>
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Last 10 Days</div></div>
        <div className="pp-card-body">
          {last10.length ? (
            <table className="pp-table">
              <thead><tr><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {last10.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td><span className={r.status === 'Present' ? 'sc-hi' : 'sc-lo'}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty icon="📅" text="No recent records" />
          )}
        </div>
      </div>
    </div>
  );
}

function ExamsTab({ state }) {
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Exam Results</div></div>
        <div className="pp-card-body">
          {(state.status === 'loading' || state.status === 'idle') && <Loading />}
          {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
          {state.status === 'ready' && (
            state.data.length === 0 ? (
              <Empty icon="📝" text="No results yet" />
            ) : (
              <table className="pp-table">
                <thead><tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Date</th></tr></thead>
                <tbody>
                  {state.data.map((r, i) => {
                    const badge = r.pct === null ? 'sc-mi' : r.pct >= 75 ? 'sc-hi' : r.pct >= 50 ? 'sc-mi' : 'sc-lo';
                    const marksStr = r.hasMarks ? (r.total !== null ? `${r.marks_obtained}/${r.total}` : r.marks_obtained) : 'Not graded';
                    return (
                      <tr key={i}>
                        <td>{r.examName}</td>
                        <td>{r.subject || '—'}</td>
                        <td><span className={badge}>{marksStr}</span></td>
                        <td>{r.exam_date ? r.exam_date.slice(0, 10) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function ReportCardTab({ examTypes, selectedType, onTypeChange, dates, selectedDate, onDateChange, onPrint, printBusy }) {
  const canPrint = selectedType && selectedDate && !printBusy;
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Report Card</div></div>
        <div className="pp-card-body">
          <div className="rc-row">
            <div className="rc-col">
              <label>Exam</label>
              <select className="rc-select" value={selectedType} onChange={(e) => onTypeChange(e.target.value)}>
                <option value="">
                  {examTypes.status === 'loading' ? 'Loading…' : examTypes.status === 'empty' ? '— No exams recorded —' : examTypes.status === 'error' ? '— Error loading exams —' : 'Select exam…'}
                </option>
                {examTypes.options.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="rc-col">
              <label>Date</label>
              <select className="rc-select" value={selectedDate} onChange={(e) => onDateChange(e.target.value)}>
                <option value="">
                  {dates.status === 'loading' ? 'Loading…' : dates.status === 'empty' ? '— No dates —' : dates.status === 'error' ? '— Error —' : '—'}
                </option>
                {dates.options.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <p style={{ color: "rgba(247,243,233,.6)", fontSize: ".78rem", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".03em", marginBottom: "1rem" }}>
            Pick an exam and date, then view or print an official report card showing subject-wise marks, grade and class rank.
          </p>
          <button className="pp-lbtn" onClick={onPrint} disabled={!canPrint}>
            {printBusy ? '⏳ Preparing…' : '🖨️ View / Print Report Card'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoticesTab({ state }) {
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Official Notices</div></div>
        <div className="pp-card-body">
          {(state.status === 'loading' || state.status === 'idle') && <Loading />}
          {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
          {state.status === 'ready' && (
            state.data.length === 0 ? (
              <Empty icon="📣" text="No notices" />
            ) : (
              state.data.map((n, i) => {
                const priCls = n.priority === 'High' ? 'pri-h' : n.priority === 'Medium' ? 'pri-m' : 'pri-l';
                return (
                  <div className="pp-ni" key={i}>
                    <span className={`pp-npri ${priCls}`}>{n.priority || 'Low'}</span>
                    <div className="pp-ntitle">{n.title}</div>
                    <div className="pp-nbody">{n.body || ''}</div>
                    <div className="pp-ndate">{n.notice_date || ''}</div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
}

function LeaveTab({ state }) {
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Hostel Leave History</div></div>
        <div className="pp-card-body">
          {(state.status === 'loading' || state.status === 'idle') && <Loading />}
          {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
          {state.status === 'ready' && (
            state.data.length === 0 ? (
              <Empty icon="🏠" text="No leave history" />
            ) : (
              state.data.map((r, i) => {
                const stCls = r.status === 'approved' ? 'ls-ap' : r.status === 'rejected' ? 'ls-re' : 'ls-pe';
                return (
                  <div className="leave-item" key={i}>
                    <div className="leave-hd">
                      <span>{r.from_date} → {r.to_date}</span>
                      <span className={`ls ${stCls}`}>{r.status || 'pending'}</span>
                    </div>
                    <div className="leave-rsn">{r.reason || '—'}</div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
}

function AlertsTab({ state }) {
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Recent Alerts</div></div>
        <div className="pp-card-body">
          {(state.status === 'loading' || state.status === 'idle') && <Loading />}
          {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
          {state.status === 'ready' && (
            state.data.length === 0 ? (
              <Empty icon="✅" text="No alerts — all good!" />
            ) : (
              state.data.map((a, i) => (
                <div className={`alert-item ${a.type}`} key={i}>
                  <div className="alert-msg">{a.msg}</div>
                  <div className="alert-meta">{a.date ? a.date.slice(0, 10) : ''}</div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}