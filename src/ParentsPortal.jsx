import { useState, useCallback, useEffect } from 'react';
import { supabase } from './supabase';
import './ParentsPortal.css';

const EMBLEM_URL = "https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/gnsi-emblem.png";

// ── VAPID / PUSH ──────────────────────────────────────────────────────────
// Reuses the same push infrastructure already built for staff
// (VAPID keys + service worker + push_subscriptions table).
// Set this to the institute's real public VAPID key.
const VAPID_PUBLIC_KEY = import.meta.env?.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT CARD — ported verbatim from Exams.jsx's GRADE_PRESETS / getGrade /
// COURSE_MAX_MARKS / getCourseMax / buildReportCardHTML / REPORT_CARD_CSS,
// so a parent's printed card is byte-for-byte the same document staff print
// from the main portal — not a lookalike built from a separate guess at the
// grading rules. (Exams.jsx's version also reads a `window.__gnsiCourseMaxMarks`
// runtime global set by ExamConfigManager when staff switch configs — that
// global is never populated here since this page never mounts Exams.jsx, so
// this copy always falls through to the static COURSE_MAX_MARKS table below,
// exactly like a fresh Exams.jsx page load would before any config switch.
// The live `exam_schedule` rows fetched per-print in handlePrintReportCard
// are the real source of truth either way and take priority over both.)

const GRADE_PRESETS = [
  { min: 90, label: "A+", color: "#0F6E56", bg: "#E1F5EE", gpa: 4.0 },
  { min: 80, label: "A",  color: "#185FA5", bg: "#E6F1FB", gpa: 3.5 },
  { min: 70, label: "B+", color: "#534AB7", bg: "#EEEDFE", gpa: 3.0 },
  { min: 60, label: "B",  color: "#2563eb", bg: "#dbeafe", gpa: 2.5 },
  { min: 50, label: "C",  color: "#BA7517", bg: "#FAEEDA", gpa: 2.0 },
  { min: 40, label: "D",  color: "#ea580c", bg: "#fff7ed", gpa: 1.0 },
  { min: 0,  label: "F",  color: "#A32D2D", bg: "#FCEBEB", gpa: 0.0 },
];
function getGrade(pct, scale = GRADE_PRESETS) {
  for (const g of scale) if (pct >= g.min) return g;
  return scale[scale.length - 1];
}

// Static fallback max-marks table (mirrors Exams.jsx's COURSE_MAX_MARKS
// constant). Only used when a course has no live exam_schedule rows for the
// selected exam type/date — see handlePrintReportCard.
const COURSE_MAX_MARKS = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  "LAKSHYA - A": { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  "LAKSHYA - B": { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  "Combined Navodaya Course (Sainik Appearing Group)": { "Mathematics": 25, "Mental Ability": 25, "Passage": 25, "EVS": 25 },
};
function getCourseMax(course) {
  const maxMap = COURSE_MAX_MARKS[course] || {};
  return Object.values(maxMap).reduce((s, v) => s + v, 0) || 100;
}

// ─── REPORT_CARD_CSS — identical to Exams.jsx's constant of the same name ───
const REPORT_CARD_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
@page{margin:0.7cm;size:A4;}
body{font-family:'DM Sans',sans-serif;background:#d6cfc0;padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.no-print{text-align:center;margin-bottom:16px;display:flex;gap:10px;justify-content:center;}
.no-print button{padding:10px 28px;border:none;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;}
.btn-print{background:#0f2d5e;color:white;}.btn-close{background:#e5e7eb;color:#374151;}
.page-break{page-break-after:always;height:0;overflow:hidden;}
.card{width:720px;margin:0 auto 24px;background:#F0F4FF;border-radius:3px;box-shadow:0 12px 48px rgba(0,0,0,0.22),0 0 0 1px #B8C9E8;position:relative;overflow:hidden;}
.top-strip{height:5px;background:linear-gradient(90deg,#0f2d5e 0%,#1a4d8a 30%,#B8860B 60%,#f0c040 80%,#1a4d8a 100%);}
.header{background:linear-gradient(150deg,#071a3e 0%,#0f2d5e 45%,#133a7a 100%);padding:22px 32px 18px;display:flex;align-items:center;gap:16px;}
.logo-ring{width:64px;height:64px;border-radius:50%;border:2px solid #D4A017;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.logo-text{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:white;}
.header-center{flex:1;text-align:center;}
.eyebrow{font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#cbd5e1;margin-bottom:5px;font-weight:600;}
.inst-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:white;margin-bottom:3px;}
.inst-addr{font-size:11px;color:#cbd5e1;}
.doc-badge{text-align:center;flex-shrink:0;}
.doc-badge-title{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:white;letter-spacing:2px;line-height:1.2;}
.doc-badge-sub{font-size:10px;color:#cbd5e1;margin-top:3px;font-weight:600;}
.exam-result-bar{background:#0f2d5e;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;}
.exam-info{display:flex;gap:20px;flex-wrap:wrap;}
.exam-info-item{display:flex;flex-direction:column;}
.exam-info-label{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#e0e7ff;margin-bottom:2px;font-weight:700;}
.exam-info-value{font-size:13px;font-weight:600;color:#ffffff;}
.result-pill-bar{display:flex;align-items:center;gap:8px;}
.student-section{padding:14px 24px 10px;}
.section-title{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:600;color:#0f2d5e;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;}
.student-table{width:100%;border-collapse:collapse;font-size:13px;}
.student-table td{padding:7px 10px;border:1px solid #BFDBFE;}
.student-table .lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#1a4d8a;font-weight:600;background:#EFF6FF;width:120px;}
.student-table .val{font-weight:600;color:#0A1628;}
.student-table .val.big{font-family:'Playfair Display',serif;font-size:16px;color:#0f2d5e;}
.score-grid{display:grid;grid-template-columns:repeat(5,1fr);background:#0f2d5e;margin:0 16px 0;border-radius:6px;overflow:hidden;}
.score-cell{text-align:center;padding:12px 8px;border-right:1px solid rgba(255,255,255,0.2);}
.score-cell:last-child{border-right:none;}
.score-lbl{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#e0e7ff;margin-bottom:4px;font-weight:700;}
.score-val{font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:#ffffff;line-height:1;}
.score-val.gold{color:#fbbf24;}
.score-sub{font-size:10px;color:#d0d9ff;margin-top:2px;font-weight:500;}
.marks-section{padding:14px 24px;}
.marks-table{width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid #BFDBFE;border-radius:6px;overflow:hidden;}
.marks-table thead tr{background:#DBEAFE;}
.marks-table thead th{padding:8px 10px;text-align:center;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#1e3a6e;font-weight:700;border-bottom:2px solid #93C5FD;}
.marks-table tbody td{padding:9px 10px;text-align:center;border-bottom:1px solid #EFF6FF;}
.marks-table tfoot tr{background:#DBEAFE;}
.marks-table tfoot td{padding:10px;border-top:2px solid #93C5FD;text-align:center;font-weight:700;}
.remark-box{margin:0 24px 14px;padding:12px 16px;background:white;border:1px solid #BFDBFE;border-left:4px solid #1a4d8a;border-radius:4px;}
.remark-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#1a4d8a;font-weight:700;margin-bottom:5px;}
.remark-text{font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;color:#1e3a6e;line-height:1.6;}
.sig-section{display:flex;align-items:flex-end;justify-content:space-between;padding:14px 24px 18px;background:white;border-top:1px solid #BFDBFE;gap:16px;}
.sig-block{text-align:center;flex:1;}
.sig-space{height:40px;}
.sig-label{border-top:1.5px solid #1C1A16;padding-top:5px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#1e3a6e;font-weight:600;margin:0 10px;}
.seal-block{flex:0 0 90px;display:flex;flex-direction:column;align-items:center;}
.seal{width:90px;height:90px;display:flex;align-items:center;justify-content:center;}
.seal img{width:90px;height:90px;object-fit:contain;}
.footer-strip{background:linear-gradient(90deg,#071a3e,#0f2d5e,#071a3e);padding:8px 32px;}
.footer-text{font-size:10px;color:#cbd5e1;text-align:center;font-weight:500;}
.bottom-strip{height:4px;background:linear-gradient(90deg,#1a4d8a,#60A5FA,#1a4d8a);}
@media print{body{background:white;padding:0;}.no-print{display:none!important;}.card{box-shadow:none;border-radius:0;width:100%;margin:0;}}
`;

// ─── buildReportCardHTML — identical logic to Exams.jsx's function of the
// same name (ranking algorithm, subject rows, grade colors, layout markup)
// so parent-printed cards match staff-printed ones exactly.
function buildReportCardHTML(st, subjects, subjectMaxMap, courseMax, marksMap, course, allStudents, examName, examDate, institute, remarkText) {
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marksMap[`${sid}-${sub}`]) || 0), 0);
  const total = getTotal(st.id);
  const pct = courseMax ? (total / courseMax) * 100 : 0;
  const grade = getGrade(pct);
  const passed = pct >= 40;
  const gradeColors = { "A+": "#fbbf24", "A": "#fbbf24", "B+": "#e0e7ff", "B": "#e0e7ff", "C": "#f87171", "D": "#fb923c", "F": "#fca5a5" };
  const gradeColor = gradeColors[grade.label] || "#0A1628";

  const sortedStudents = [...allStudents].map(s => ({ ...s, total: getTotal(s.id) })).sort((a, b) => b.total - a.total);
  let rank = 1, prev = null;
  for (let i = 0; i < sortedStudents.length; i++) {
    if (i === 0) { rank = 1; prev = sortedStudents[i].total; } else if (sortedStudents[i].total !== prev) { rank++; prev = sortedStudents[i].total; }
    if (sortedStudents[i].id === st.id) break;
  }
  const rankSuffix = rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";

  const subjectRows = subjects.map((s, idx) => {
    const m = Number(marksMap[`${st.id}-${s}`]) || 0;
    const subMax = (subjectMaxMap && subjectMaxMap[s]) || 100;
    const subPct = Math.round((m / subMax) * 100);
    const subPassed = subPct >= 40;
    const barColor = subPct >= 80 ? "#1a56db" : subPct >= 60 ? "#1B4F8A" : subPct >= 40 ? "#BA7517" : "#C0392B";
    const gradeLbl = subPct >= 90 ? "A+" : subPct >= 80 ? "A" : subPct >= 70 ? "B+" : subPct >= 60 ? "B" : subPct >= 50 ? "C" : subPct >= 40 ? "D" : "F";
    return `<tr>
      <td style="text-align:left;font-weight:600;color:#2D3748">${idx + 1}. ${s}</td>
      <td>${subMax}</td>
      <td style="font-family:'EB Garamond',serif;font-size:14px;font-weight:700;color:#0A1628">${m}</td>
      <td><div style="display:flex;align-items:center;gap:5px;"><div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;"><div style="width:${subPct}%;height:100%;background:${barColor};border-radius:3px;"></div></div><span style="font-size:10px;font-weight:700;color:${barColor};min-width:32px">${subPct}%</span></div></td>
      <td><span style="display:inline-block;padding:1px 8px;border-radius:2px;font-size:11px;font-weight:700;color:${barColor};border:1px solid ${barColor};background:${barColor}18">${gradeLbl}</span></td>
      <td><span style="font-size:10px;font-weight:700;color:${subPassed ? "#1a56db" : "#C0392B"}">${subPassed ? "✓ PASS" : "✗ FAIL"}</span></td>
    </tr>`;
  }).join("");

  const remarkBlock = remarkText
    ? `<div class="remark-box"><div class="remark-label">✦ Teacher's Remarks</div><div class="remark-text">"${remarkText}"</div></div>`
    : "";

  return `<div class="card">
    <div class="top-strip"></div>
    <div class="header">
      <div class="logo-ring">${institute.logoUrl ? `<img src="${institute.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%"/>` : `<div class="logo-text">GNSI</div>`}</div>
      <div class="header-center">
        <div class="eyebrow">Official Academic Record · ${institute.academicYear || "2025-2026"}</div>
        <div class="inst-name">${institute.name || "Guidance Navodaya & Sainik Institute"}</div>
        <div class="inst-addr">${institute.address || "Khangabok, Thoubal, Manipur"}</div>
      </div>
      <div class="doc-badge"><div class="doc-badge-title">REPORT<br/>CARD</div><div class="doc-badge-sub">${examName}</div></div>
    </div>
    <div class="exam-result-bar">
      <div class="exam-info">
        <div class="exam-info-item"><span class="exam-info-label">Examination</span><span class="exam-info-value">${examName}</span></div>
        <div class="exam-info-item"><span class="exam-info-label">Date</span><span class="exam-info-value">${examDate || "—"}</span></div>
        <div class="exam-info-item"><span class="exam-info-label">Academic Year</span><span class="exam-info-value">${institute.academicYear || "2025-2026"}</span></div>
        <div class="exam-info-item"><span class="exam-info-label">Class Rank</span><span class="exam-info-value" style="color:${rank <= 3 ? "#f0c040" : "white"}">${rank}<sup style="font-size:10px">${rankSuffix}</sup> / ${allStudents.length}</span></div>
      </div>
      <div class="result-pill-bar">
        <span style="font-size:20px;font-weight:700;color:${gradeColor}">${grade.label}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:2px;background:${passed ? "#EFF6FF" : "#FCEBEB"};color:${passed ? "#1a56db" : "#C0392B"};border:1px solid ${passed ? "#BFDBFE" : "#FECACA"}">${passed ? "PASS" : "FAIL"}</span>
      </div>
    </div>
    <div class="student-section">
      <div class="section-title">Candidate Details</div>
      <table class="student-table">
        <tr><td class="lbl">Student Name</td><td class="val big" colspan="3">${st.name}</td></tr>
        <tr><td class="lbl">GCC / Roll No.</td><td class="val big" style="letter-spacing:3px">${String(st.gcc_no || "").padStart(6, "0")}</td><td class="lbl">Admission No.</td><td class="val">${st.admission_no || "—"}</td></tr>
        <tr><td class="lbl">Course</td><td class="val">${st.course || course}</td><td class="lbl">Batch</td><td class="val">${st.class_name || "—"}</td></tr>
      </table>
    </div>
    <div class="score-grid" style="margin:0 16px;">
      <div class="score-cell"><div class="score-lbl">Marks Obtained</div><div class="score-val">${total}<span style="font-size:11px;opacity:.5">/${courseMax}</span></div></div>
      <div class="score-cell"><div class="score-lbl">Percentage</div><div class="score-val gold">${pct.toFixed(1)}%</div></div>
      <div class="score-cell"><div class="score-lbl">Grade</div><div class="score-val" style="color:${gradeColor}">${grade.label}</div><div class="score-sub">${grade.gpa.toFixed(1)} GPA</div></div>
      <div class="score-cell"><div class="score-lbl">Subjects</div><div class="score-val">${subjects.length}</div></div>
      <div class="score-cell"><div class="score-lbl">Class Rank</div><div class="score-val" style="color:${rank <= 3 ? "#f0c040" : "white"}">${rank}<sup style="font-size:11px">${rankSuffix}</sup></div><div class="score-sub">of ${allStudents.length}</div></div>
    </div>
    <div class="marks-section">
      <div class="section-title" style="margin-top:8px">Subject-wise Performance</div>
      <table class="marks-table">
        <thead><tr><th style="text-align:left;width:32%">Subject</th><th>Max Marks</th><th>Marks Obtained</th><th style="width:25%">Performance</th><th>Grade</th><th>Result</th></tr></thead>
        <tbody>${subjectRows}</tbody>
        <tfoot><tr>
          <td style="text-align:left;font-size:12px;font-weight:700">Grand Total</td>
          <td>${courseMax}</td>
          <td style="font-size:16px;font-weight:700;color:#0A1628">${total}</td>
          <td colspan="3"></td>
        </tr></tfoot>
      </table>
    </div>
    ${remarkBlock}
    <div class="sig-section">
      <div class="sig-block"><div class="sig-space"></div><div class="sig-label">Class Teacher</div></div>
      <div class="sig-block"><div class="sig-space"></div><div class="sig-label">Head of Institute</div></div>
    </div>
    <div class="footer-strip"><div class="footer-text">${institute.name || "GNSI"} · ${institute.address || "Khangabok, Manipur"} · ${examName} · Academic Year ${institute.academicYear || "2025-2026"}</div></div>
    <div class="bottom-strip"></div>
  </div>`;
}

// ─── matchesCourseBatch — ported verbatim from Exams.jsx ────────────────────
// Needed for correct classmate/ranking lookups: a plain class_name equality
// check returns zero students (and a meaningless "rank 1 of 1") for any
// batch that encodes a Combined Navodaya section tag (ENG/MM), since those
// students' class_name is a phantom secondary-batch tag rather than the
// base course key.
function matchesCourseBatch(s, courseKey) {
  const cn = (s.class_name || "").trim().toUpperCase();
  const target = (courseKey || "").trim().toUpperCase();
  if (cn === target) return true; // exact match — normal, unaffected case

  const sectionMatch = target.match(/^(.*?)[\s(]*\b(ENG|MAN|MM|HIN|MEI)\b\)?\s*$/);
  if (!sectionMatch) return false;
  const base = sectionMatch[1].trim();
  let section = sectionMatch[2];
  if (section === "MAN") section = "MM";

  const sameFamily = cn.startsWith(base) || base.startsWith(cn) || cn.includes("COMBINED NAVODAY");
  if (!sameFamily) return false;

  const rawBatch = (s.batch || "").toUpperCase();
  if (rawBatch.includes(section) || (section === "MM" && rawBatch.includes("MAN"))) return true;

  const classNameHasSectionTag = cn.includes(`(${section})`) || cn.includes(` ${section})`) || cn.includes(section);
  if (!base.includes(section) && classNameHasSectionTag) {
    return true;
  }

  return false;
}

// Same convention as Exams.jsx's isStudentAbsentForExam: absence is recorded
// as marks_obtained = 0 in every subject. A student with no rows at all
// (not yet entered) is NOT counted as absent — only fully-zero rows are.
function isStudentAbsentForExam(studentId, subjects, marksMap) {
  if (!subjects.length) return false;
  const values = subjects.map(sub => marksMap[`${studentId}-${sub}`]);
  const hasAnyRow = values.some(v => v !== undefined && v !== null && v !== "");
  if (!hasAnyRow) return false;
  return values.every(v => Number(v) === 0);
}

const TABS = [
  { id: 'home',       label: '🏠 Dashboard' },
  { id: 'att',        label: '📊 Attendance' },
  { id: 'exams',      label: '📝 Exam Scores' },
  { id: 'reportcard', label: '🧾 Report Card' },
  { id: 'fees',       label: '💳 Fee Dues' },
  { id: 'homework',   label: '📚 Homework' },
  { id: 'timetable',  label: '🗓️ Timetable' },
  { id: 'notices',    label: '📣 Notices' },
  { id: 'leave',      label: '🏨 Hostel Leave' },
  { id: 'messages',   label: '💬 Message Teacher' },
  { id: 'alerts',     label: '🔔 Alerts' },
];

const initialTabState = { status: 'idle', data: null, error: null };
/**
 * ParentsPortal — student login + attendance/exams/report-card/fees/homework/
 * timetable/notices/leave/messages/alerts dashboard. Talks directly to
 * Supabase; has no dependency on websiteApi.js. All data lives in React
 * state — no getElementById/innerHTML (except the isolated print overlay,
 * which is a deliberate exception for print-window HTML).
 */
export default function ParentsPortal({ isOpen, onClose }) {
  // Multi-child support: `siblings` holds every student matched to the same
  // GCC/name login family (same admission phone or same last name + hostel
  // is NOT reliable, so we key siblings off a shared `parent_phone` /
  // `guardian_contact` column if present on `students`; falls back to just
  // the single logged-in student when no such column/match exists).
  const [siblings, setSiblings] = useState([]);
  const [student, setStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('home');

  const [loginGcc, setLoginGcc] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [attendance, setAttendance] = useState(initialTabState);
  const [exams, setExams] = useState(initialTabState);
  const [notices, setNotices] = useState(initialTabState);
  const [leave, setLeave] = useState(initialTabState);
  const [alerts, setAlerts] = useState(initialTabState);
  const [fees, setFees] = useState(initialTabState);
  const [homework, setHomework] = useState(initialTabState);
  const [timetable, setTimetable] = useState(initialTabState);
  const [messages, setMessages] = useState(initialTabState);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageSending, setMessageSending] = useState(false);

  const [rcExamTypes, setRcExamTypes] = useState({ status: 'idle', options: [] });
  const [rcSelectedType, setRcSelectedType] = useState('');
  const [rcDates, setRcDates] = useState({ status: 'idle', options: [] });
  const [rcSelectedDate, setRcSelectedDate] = useState('');
  const [rcPrintBusy, setRcPrintBusy] = useState(false);

  const [pushStatus, setPushStatus] = useState('idle'); // idle | subscribed | unsupported | denied
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const resetPortalState = () => {
    setStudent(null);
    setSiblings([]);
    setActiveTab('home');
    setAttendance(initialTabState);
    setExams(initialTabState);
    setNotices(initialTabState);
    setLeave(initialTabState);
    setAlerts(initialTabState);
    setFees(initialTabState);
    setHomework(initialTabState);
    setTimetable(initialTabState);
    setMessages(initialTabState);
    setRcExamTypes({ status: 'idle', options: [] });
    setRcSelectedType('');
    setRcDates({ status: 'idle', options: [] });
    setRcSelectedDate('');
  };

  // ── FEATURE 9: PWA INSTALL PROMPT ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowInstallBanner(false);
  };

  // ── LOGIN / LOGOUT (with sibling lookup for multi-child) ────────────────

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
          .select('id, name, course, class_name, batch, hostel_type, status, admission_no, gcc_no, guardian_contact, photo_url')
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
      loadAlertsSummary(data.id);

      // Multi-child: look up siblings sharing the same guardian contact,
      // if that column exists and is populated. Fails silently (single-
      // child view) if the column is absent on this schema.
      if (data.guardian_contact) {
        try {
          const { data: sibs } = await supabase
            .from('students')
            .select('id, name, course, class_name, batch, hostel_type, status, admission_no, gcc_no, guardian_contact, photo_url')
            .eq('guardian_contact', data.guardian_contact);
          if (sibs && sibs.length > 1) setSiblings(sibs);
          else setSiblings([data]);
        } catch (_) {
          setSiblings([data]);
        }
      } else {
        setSiblings([data]);
      }
    } catch (e) {
      setLoginError(e?.message || 'Connection error. Try again.');
      setLoginBusy(false);
    }
  };

  const switchChild = (child) => {
    resetPortalState();
    setSiblings((prev) => prev.length ? prev : [child]);
    setStudent(child);
    setActiveTab('home');
    loadAttendance(child.id);
    loadAlertsSummary(child.id);
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
    if (id === 'fees' && fees.status === 'idle') loadFees(student);
    if (id === 'homework' && homework.status === 'idle') loadHomework(student);
    if (id === 'timetable' && timetable.status === 'idle') loadTimetable(student);
    if (id === 'messages' && messages.status === 'idle') loadMessages(student.id);
  };

  // ── TAB: ATTENDANCE ──────────────────────────────────────────────────────

  const loadAttendance = useCallback(async (studentId) => {
    setAttendance({ status: 'loading', data: null, error: null });

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const from = `${y}-${m}-01`;
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
      // Use class_name verbatim, NOT uppercased/derived — this must match a
      // real courseSubjects/exam_schedule key exactly (Exams.jsx's own
      // ReportCards tab treats `course` as whatever was picked from that
      // dropdown, case as-is; some real keys like "Combined Navodaya
      // Course (Sainik Appearing Group)" are mixed-case, so forcing
      // uppercase here would silently break scheduling/ranking lookups
      // for those batches).
      const course = student.class_name || student.batch || '';
      const examTypeName = rcExamTypes.options.find(t => String(t.id) === String(examTypeId))?.name || 'Examination';

      // Live exam_schedule is the real source of truth for subjects/max
      // marks (same priority order as Exams.jsx's ReportCards tab) — only
      // fall back to the static COURSE_MAX_MARKS table if nothing was
      // actually scheduled for this course + exam type.
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
        subjectMaxMap = COURSE_MAX_MARKS[course] || {};
        subjects = Object.keys(subjectMaxMap);
        courseMax = getCourseMax(course);
      }

      // Classmates for ranking: use the same matchesCourseBatch matcher
      // Exams.jsx uses everywhere, not a plain ilike — a bare equality/ilike
      // check silently returns zero students (and a meaningless "rank 1 of
      // 1") for any batch that encodes a Combined Navodaya section tag
      // (ENG/MM), since those students' class_name is a phantom secondary-
      // batch tag rather than the base course key. Pull a broad candidate
      // set once, then filter client-side with the real matcher.
      const { data: candidatePool } = await supabase
        .from('students')
        .select('id, name, gcc_no, class_name, course, admission_no, batch')
        .eq('status', 'Active');
      const allStudents = (candidatePool || []).filter(s => matchesCourseBatch(s, course));
      if (!allStudents.some(s => s.id === student.id)) allStudents.push(student);

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

      // Exclude absent students from the ranking pool, same convention as
      // Exams.jsx's ReportCards (excludeAbsent defaults on there too).
      const rankPool = allStudents.filter(s => s.id === student.id || !isStudentAbsentForExam(s.id, subjects, marksMap));

      const { data: remarkRow } = await supabase.from('exam_remarks').select('remark')
        .eq('student_id', student.id).eq('exam_type_id', examTypeId).eq('exam_date', examDate).maybeSingle();
      const remarkText = remarkRow?.remark || '';

      const { data: instSetting } = await supabase.from('system_settings').select('value').eq('key', 'exam_institute_config').maybeSingle();
      let institute = { name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok, Thoubal, Manipur', academicYear: '2026-2027' };
      try { institute = { ...institute, ...JSON.parse(instSetting?.value || '{}') }; } catch (_) {}

      const html = buildReportCardHTML(student, subjects, subjectMaxMap, courseMax, marksMap, course, rankPool, examTypeName, examDate, institute, remarkText);

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
        <style>${REPORT_CARD_CSS}</style>
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

  // Lightweight version used only to populate the home dashboard's alert
  // count without duplicating the full alerts tab state machine.
  const [homeAlertCount, setHomeAlertCount] = useState(null);
  const loadAlertsSummary = useCallback(async (studentId) => {
    try {
      const { count } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('status', 'Absent')
        .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
      setHomeAlertCount(count || 0);
    } catch (_) {
      setHomeAlertCount(null);
    }
  }, []);

  // ── FEATURE 1: FEE DUES TAB ──────────────────────────────────────────────
  // Wired to the real feeDues.js. getStudentDues(student, sessionYear) needs
  // the FULL student object (gcc_no, course, batch, hostel_type,
  // admission_date) — not a bare id — and returns a structured
  // { admission, flatFee, courseFee, totalPaid, totalDue, failedSources }
  // shape, not a flat { balance } number. Never calls collectFee()/
  // upsertAccount() directly, same as PublicFeeLookup.jsx, since the portal
  // has no authenticated staff currentUser.
  //
  // student.admission_date is not fetched at login (see handleLogin's
  // .select()) — without it, getStudentDues still works but can't exclude
  // pre-admission months, so a very recently admitted student could show
  // phantom course/flat-fee dues for months before they joined. Fetched
  // here as a targeted follow-up read rather than widening every login
  // query for a field only this tab needs.
  const loadFees = useCallback(async (stu) => {
    setFees({ status: 'loading', data: null, error: null });
    try {
      let admissionDate = stu.admission_date;
      if (admissionDate === undefined) {
        const { data: admRow } = await supabase.from('students').select('admission_date').eq('id', stu.id).maybeSingle();
        admissionDate = admRow?.admission_date || null;
      }

      const feeMod = await import('./feeDues.js');
      const dues = await feeMod.getStudentDues({ ...stu, admission_date: admissionDate });

      if (!dues) {
        setFees({ status: 'error', data: null, error: 'Fee details are not available for this student (no GCC number on record).' });
        return;
      }

      // Payment history: adm_fee_collections/adm_flat_fees/adm_course_fees
      // are keyed by adm_app_id = gcc_no, NOT student_id — and each table
      // uses different column names for the paid amount and the fee-period
      // label (see collectFee in feeEngine.js). Normalize all three into
      // one shape for a single combined, date-sorted history list.
      const gcc = String(stu.gcc_no || '');
      const [{ data: admRows }, { data: flatRows }, { data: courseRows }] = await Promise.all([
        supabase.from('adm_fee_collections').select('amount_paid, pay_date, pay_mode, description, fee_type, receipt_no').eq('adm_app_id', gcc).eq('reverted', false),
        supabase.from('adm_flat_fees').select('amount, pay_date, pay_mode, month, year, receipt_no').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false),
        supabase.from('adm_course_fees').select('amount_paid, pay_date, pay_mode, for_month, year, receipt_no').eq('adm_app_id', gcc).eq('reverted', false),
      ]);

      const history = [
        ...(admRows || []).map(r => ({ date: r.pay_date, type: r.description || 'Admission/Item Fee', mode: r.pay_mode, amount: r.amount_paid, receipt: r.receipt_no })),
        ...(flatRows || []).map(r => ({ date: r.pay_date, type: `Flat Fee — ${r.month} ${r.year}`, mode: r.pay_mode, amount: r.amount, receipt: r.receipt_no })),
        ...(courseRows || []).map(r => ({ date: r.pay_date, type: `Course Fee — ${r.for_month} ${r.year}`, mode: r.pay_mode, amount: r.amount_paid, receipt: r.receipt_no })),
      ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      setFees({ status: 'ready', data: { ...dues, history }, error: null });
    } catch (e) {
      console.error('Fees load failed:', e);
      setFees({ status: 'error', data: null, error: 'Failed to load fee details' });
    }
  }, []);

  const handlePayNow = async () => {
    if (!student) return;
    try {
      const res = await fetch('/api/razorpay/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, gcc_no: student.gcc_no, name: student.name }),
      });
      const json = await res.json();
      if (json?.short_url) {
        window.open(json.short_url, '_blank');
      } else {
        throw new Error('No payment link returned');
      }
    } catch (e) {
      console.error('Pay-now failed:', e);
      alert('Could not start online payment right now. Please pay via UPI/bank transfer or contact the office.');
    }
  };


  // ── FEATURE 2: HOMEWORK / STUDY MATERIAL TAB ─────────────────────────────
  // Reads from the existing `study_materials` table (file_url, chapter,
  // subject, course, material_type) — same table StudyMaterial.jsx writes
  // to — filtered to the logged-in student's course.
  const loadHomework = useCallback(async (stu) => {
    setHomework({ status: 'loading', data: null, error: null });
    try {
      const course = (stu.course || '').toLowerCase();
      const { data } = await supabase
        .from('study_materials')
        .select('id, file_url, chapter, subject, course, material_type, created_at, title')
        .ilike('course', course)
        .order('created_at', { ascending: false })
        .limit(50);

      setHomework({ status: 'ready', data: data || [], error: null });
    } catch (e) {
      console.error('Homework load failed:', e);
      setHomework({ status: 'error', data: null, error: 'Failed to load homework / study material' });
    }
  }, []);

  // ── FEATURE 3: TIMETABLE TAB ──────────────────────────────────────────────
  // Reads from the `timetables` table Timetable.jsx already writes to,
  // scoped to the student's batch/class.
  const loadTimetable = useCallback(async (stu) => {
    setTimetable({ status: 'loading', data: null, error: null });
    try {
      const { data } = await supabase
        .from('timetables')
        .select('day_of_week, period, subject, teacher_name, start_time, end_time')
        .eq('batch', stu.batch || stu.class_name)
        .order('day_of_week', { ascending: true })
        .order('period', { ascending: true });

      setTimetable({ status: 'ready', data: data || [], error: null });
    } catch (e) {
      console.error('Timetable load failed:', e);
      setTimetable({ status: 'error', data: null, error: 'Failed to load timetable' });
    }
  }, []);

  // ── FEATURE 7: MESSAGE CLASS TEACHER ─────────────────────────────────────
  // Simple threaded messages table (parent_messages) keyed by student_id.
  // Staff-side reply UI would live in the main portal (not built here);
  // this is the parent-facing read/send half.
  const loadMessages = useCallback(async (studentId) => {
    setMessages({ status: 'loading', data: null, error: null });
    try {
      const { data } = await supabase
        .from('parent_messages')
        .select('id, sender, body, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true })
        .limit(100);

      setMessages({ status: 'ready', data: data || [], error: null });
    } catch (e) {
      console.error('Messages load failed:', e);
      setMessages({ status: 'error', data: null, error: 'Messaging is not set up yet. Please contact the office directly.' });
    }
  }, []);

  const sendMessage = async () => {
    const body = messageDraft.trim();
    if (!body || !student) return;
    setMessageSending(true);
    try {
      const { error } = await supabase
        .from('parent_messages')
        .insert({ student_id: student.id, sender: 'parent', body });
      if (error) throw error;
      setMessageDraft('');
      loadMessages(student.id);
    } catch (e) {
      console.error('Send message failed:', e);
      alert('Could not send message: ' + (e?.message || 'unknown error'));
    } finally {
      setMessageSending(false);
    }
  };

  // ── FEATURE 5: PUSH NOTIFICATIONS ─────────────────────────────────────────
  const enablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setPushStatus('unsupported');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await supabase.from('push_subscriptions').insert({
        student_id: student?.id || null,
        endpoint: sub.endpoint,
        subscription: JSON.stringify(sub),
        role: 'parent',
      });
      setPushStatus('subscribed');
    } catch (e) {
      console.error('Push subscription failed:', e);
      setPushStatus('unsupported');
    }
  };

  // ── FEATURE 8: EXPORT FULL PROGRESS REPORT (PDF via print) ───────────────
  const exportProgressReport = async () => {
    if (!student) return;
    setExportBusy(true);
    try {
      const [{ data: attRows }, { data: markRows }, feesSnapshot] = await Promise.all([
        supabase.from('attendance').select('date, status').eq('student_id', student.id).order('date', { ascending: false }).limit(60),
        supabase.from('exam_marks').select('subject, marks_obtained, total_marks, exam_date').eq('student_id', student.id).order('exam_date', { ascending: false }).limit(30),
        fees.status === 'ready' ? Promise.resolve(fees.data) : Promise.resolve(null),
      ]);

      const presentCount = (attRows || []).filter(r => r.status === 'Present').length;
      const attPct = attRows?.length ? Math.round((presentCount / attRows.length) * 100) : 0;

      const examRowsHtml = (markRows || []).map(r => {
        const pct = (r.total_marks && r.marks_obtained != null) ? Math.round((r.marks_obtained / r.total_marks) * 100) : null;
        return `<tr><td>${r.subject || '—'}</td><td>${r.marks_obtained ?? '—'}/${r.total_marks ?? '—'}</td><td>${pct !== null ? pct + '%' : '—'}</td><td>${(r.exam_date || '').slice(0, 10)}</td></tr>`;
      }).join('');

      const feesHtml = feesSnapshot
        ? `<p><strong>Balance Due:</strong> ₹${feesSnapshot.totalDue ?? '—'}<br/><strong>Total Paid:</strong> ₹${feesSnapshot.totalPaid ?? '—'}</p>`
        : '<p>Fee summary not loaded — open the Fee Dues tab first for a complete report.</p>';

      const win = window.open('', '_blank');
      win.document.write(`
        <html><head><title>Progress Report — ${student.name}</title>
        <style>
          body { font-family: Georgia, serif; padding: 30px; color: #1a1a1a; }
          h1 { color: #0B1E3D; } table { width: 100%; border-collapse: collapse; margin: 14px 0; }
          th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; }
          th { background: #0B1E3D; color: #fff; }
        </style></head><body>
        <h1>Progress Report — ${student.name}</h1>
        <p>${[student.course, student.class_name, student.batch].filter(Boolean).join(' · ')} &middot; GCC No. ${student.gcc_no}</p>
        <h3>Attendance (last ${attRows?.length || 0} recorded days)</h3>
        <p><strong>${attPct}%</strong> present (${presentCount} of ${attRows?.length || 0} days)</p>
        <h3>Recent Exam Scores</h3>
        <table><thead><tr><th>Subject</th><th>Marks</th><th>%</th><th>Date</th></tr></thead><tbody>${examRowsHtml || '<tr><td colspan="4">No exam data</td></tr>'}</tbody></table>
        <h3>Fee Summary</h3>
        ${feesHtml}
        <script>window.onload = () => window.print();</script>
        </body></html>
      `);
      win.document.close();
    } catch (e) {
      console.error('Export failed:', e);
      alert('Could not generate the progress report: ' + (e?.message || 'unknown error'));
    } finally {
      setExportBusy(false);
    }
  };
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
          {showInstallBanner && (
            <div className="pp-install-banner">
              <span>📲 Install this portal as an app for quick access</span>
              <div>
                <button onClick={handleInstallClick} className="pp-install-btn">Install</button>
                <button onClick={() => setShowInstallBanner(false)} className="pp-install-dismiss">✕</button>
              </div>
            </div>
          )}
          <div className="pp-topbar">
            <div className="pp-topbar-l">
              <img src={EMBLEM_URL} alt="GNSI" style={{ height: 36, width: 36, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
              <div>
                <h3>{student.name || 'Student'}</h3>
                <p>GNSI Parents Portal</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              {siblings.length > 1 && (
                <select
                  className="pp-child-switch"
                  value={student.id}
                  onChange={(e) => {
                    const chosen = siblings.find(s => String(s.id) === e.target.value);
                    if (chosen) switchChild(chosen);
                  }}
                >
                  {siblings.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <button className="pp-lout" onClick={() => { handleLogout(); onClose(); }}>
                Logout ✕
              </button>
            </div>
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
                {student.photo_url
                  ? <img src={student.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : ((student.name || 'S')[0] || 'S').toUpperCase()}
              </div>
              <div className="stu-info">
                <h3>{student.name || 'Student'}</h3>
                <p>{[student.course, student.class_name, student.batch].filter(Boolean).join(' · ')}</p>
                <div className="stu-badges">
                  <span className="stu-badge">{student.hostel_type || '—'}</span>
                  <span className="stu-badge">{student.status || 'Active'}</span>
                </div>
              </div>
              <button className="pp-export-btn" onClick={exportProgressReport} disabled={exportBusy} title="Download full progress report as PDF">
                {exportBusy ? '⏳' : '⬇️'} Export Report
              </button>
            </div>

            {activeTab === 'home' && (
              <DashboardTab
                student={student}
                attendance={attendance}
                alertCount={homeAlertCount}
                fees={fees}
                pushStatus={pushStatus}
                onEnablePush={enablePush}
                onGoTab={handleTabClick}
              />
            )}
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
            {activeTab === 'fees' && (
              <FeesTab state={fees} onPayNow={handlePayNow} />
            )}
            {activeTab === 'homework' && (
              <HomeworkTab state={homework} />
            )}
            {activeTab === 'timetable' && (
              <TimetableTab state={timetable} />
            )}
            {activeTab === 'notices' && (
              <NoticesTab state={notices} />
            )}
            {activeTab === 'leave' && (
              <LeaveTab state={leave} />
            )}
            {activeTab === 'messages' && (
              <MessagesTab
                state={messages}
                draft={messageDraft}
                onDraftChange={setMessageDraft}
                onSend={sendMessage}
                sending={messageSending}
              />
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

// ── FEATURE 10: DASHBOARD HOME (single glanceable summary) ──────────────────
function DashboardTab({ student, attendance, alertCount, fees, pushStatus, onEnablePush, onGoTab }) {
  const attPct = attendance.status === 'ready' ? attendance.data.pct : null;
  const feeBalance = fees.status === 'ready' ? fees.data.totalDue : undefined;

  return (
    <div className="pp-sec active">
      <div className="pp-dash-grid">
        <div className="pp-dash-card" onClick={() => onGoTab('att')}>
          <div className="pp-dash-icon">📊</div>
          <div className="pp-dash-val">{attPct !== null ? `${attPct}%` : '—'}</div>
          <div className="pp-dash-lbl">Attendance this month</div>
        </div>
        <div className="pp-dash-card" onClick={() => onGoTab('fees')}>
          <div className="pp-dash-icon">💳</div>
          <div className="pp-dash-val">{feeBalance !== undefined && feeBalance !== null ? `₹${feeBalance}` : '—'}</div>
          <div className="pp-dash-lbl">Fee balance due</div>
        </div>
        <div className="pp-dash-card" onClick={() => onGoTab('alerts')}>
          <div className="pp-dash-icon">🔔</div>
          <div className="pp-dash-val">{alertCount !== null ? alertCount : '—'}</div>
          <div className="pp-dash-lbl">Absences (30 days)</div>
        </div>
        <div className="pp-dash-card" onClick={() => onGoTab('notices')}>
          <div className="pp-dash-icon">📣</div>
          <div className="pp-dash-val">View</div>
          <div className="pp-dash-lbl">Notice board</div>
        </div>
        <div className="pp-dash-card" onClick={() => onGoTab('homework')}>
          <div className="pp-dash-icon">📚</div>
          <div className="pp-dash-val">View</div>
          <div className="pp-dash-lbl">Homework & material</div>
        </div>
        <div className="pp-dash-card" onClick={() => onGoTab('timetable')}>
          <div className="pp-dash-icon">🗓️</div>
          <div className="pp-dash-val">View</div>
          <div className="pp-dash-lbl">Class timetable</div>
        </div>
      </div>

      {pushStatus !== 'subscribed' && (
        <div className="pp-card pp-push-card">
          <div className="pp-card-body pp-push-body">
            <div>
              <strong>Turn on notifications</strong>
              <p className="pp-push-desc">
                Get notified instantly about new notices, absences and exam results.
              </p>
            </div>
            <button className="pp-lbtn pp-push-btn" onClick={onEnablePush}>
              {pushStatus === 'unsupported' ? 'Not supported on this browser' : pushStatus === 'denied' ? 'Permission denied — check browser settings' : 'Enable'}
            </button>
          </div>
        </div>
      )}
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

// ── FEATURE 1: FEE DUES TAB ──────────────────────────────────────────────────
// Reads the real getStudentDues() shape from feeDues.js: separate
// admission/flatFee/courseFee breakdowns (each with its own due amount and,
// for flat/course fee, a list of individual month items), plus totalPaid/
// totalDue/monthsOverdue and a failedSources array flagging any fee source
// that errored during the lookup (dues are a LOWER BOUND when non-empty).
function FeesTab({ state, onPayNow }) {
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Fee Summary</div></div>
        <div className="pp-card-body">
          {(state.status === 'loading' || state.status === 'idle') && <Loading />}
          {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
          {state.status === 'ready' && (
            <>
              {state.data.failedSources?.length > 0 && (
                <div className="fee-warn-banner">
                  ⚠️ Some fee data could not be loaded just now. The figures below may understate what's actually due — please refresh, or contact the office to confirm the exact balance.
                </div>
              )}

              <div className="fee-sum-grid">
                <div className="fee-sum-box">
                  <div className="fee-sum-lbl">Total Paid</div>
                  <div className="fee-sum-val fee-positive">₹{state.data.totalPaid ?? 0}</div>
                </div>
                <div className="fee-sum-box">
                  <div className="fee-sum-lbl">Total Due</div>
                  <div className={`fee-sum-val ${(state.data.totalDue ?? 0) > 0 ? 'fee-negative' : 'fee-positive'}`}>
                    ₹{state.data.totalDue ?? 0}
                  </div>
                </div>
              </div>

              {state.data.monthsOverdue > 0 && (
                <p className="fee-overdue-note">
                  {state.data.monthsOverdue} month{state.data.monthsOverdue === 1 ? '' : 's'} overdue across flat/course fee.
                </p>
              )}

              {(state.data.totalDue ?? 0) > 0 && (
                <button className="pp-lbtn fee-pay-btn" onClick={onPayNow}>
                  💳 Pay Now Online
                </button>
              )}

              <div className="fee-breakdown-list">
                <FeeBreakdownRow
                  label="Admission Fee"
                  paid={state.data.admission?.paid}
                  due={state.data.admission?.due}
                  detail={state.data.admission?.paid ? 'Fully paid' : `₹${state.data.admission?.paidAmount ?? 0} of ₹${state.data.admission?.expected ?? 0} paid`}
                />
                <FeeMonthsBreakdown label="Hostel Flat Fee" items={state.data.flatFee?.items} due={state.data.flatFee?.due} />
                <FeeMonthsBreakdown label="Course Fee" items={state.data.courseFee?.items} due={state.data.courseFee?.due} />
              </div>

              <div className="fee-history-section">
                <div className="pp-card-title fee-history-title">Payment History</div>
                {(state.data.history || []).length ? (
                  <table className="pp-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Mode</th><th>Amount</th></tr></thead>
                    <tbody>
                      {(state.data.history || []).map((r, i) => (
                        <tr key={i}>
                          <td>{(r.date || '').slice(0, 10) || '—'}</td>
                          <td>{r.type || '—'}</td>
                          <td>{r.mode || '—'}</td>
                          <td>₹{r.amount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Empty icon="🧾" text="No payment history yet" />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FeeBreakdownRow({ label, paid, due, detail }) {
  return (
    <div className="fee-row">
      <div>
        <div className="fee-row-label">{label}</div>
        <div className="fee-row-detail">{detail}</div>
      </div>
      <div className={`fee-row-status ${paid ? 'fee-positive' : due > 0 ? 'fee-negative' : 'fee-positive'}`}>
        {paid ? '✓ Paid' : due > 0 ? `₹${due} due` : '—'}
      </div>
    </div>
  );
}

function FeeMonthsBreakdown({ label, items, due }) {
  const list = items || [];
  const unpaid = list.filter(i => !i.paid);
  return (
    <div className="fee-row fee-row-stacked">
      <div className="fee-row-top">
        <div className="fee-row-label">{label}</div>
        <div className={`fee-row-status ${(due ?? 0) > 0 ? 'fee-negative' : 'fee-positive'}`}>
          {(due ?? 0) > 0 ? `₹${due} due` : '✓ Up to date'}
        </div>
      </div>
      {unpaid.length > 0 && (
        <div className="fee-row-unpaid">
          Unpaid: {unpaid.map(i => `${i.month} ${i.year}`).join(', ')}
        </div>
      )}
    </div>
  );
}

// ── FEATURE 2: HOMEWORK / STUDY MATERIAL TAB ────────────────────────────────
function HomeworkTab({ state }) {
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Homework & Study Material</div></div>
        <div className="pp-card-body">
          {(state.status === 'loading' || state.status === 'idle') && <Loading />}
          {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
          {state.status === 'ready' && (
            state.data.length === 0 ? (
              <Empty icon="📚" text="No study material posted yet" />
            ) : (
              <div className="hw-list">
                {state.data.map((h) => (
                  <a key={h.id} href={h.file_url} target="_blank" rel="noreferrer" className="hw-item">
                    <div className="hw-icon">{h.material_type === 'video' ? '🎬' : '📄'}</div>
                    <div className="hw-info">
                      <div className="hw-title">{h.title || h.chapter || 'Study Material'}</div>
                      <div className="hw-meta">{[h.subject, h.chapter].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="hw-dl">⬇️</div>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── FEATURE 3: TIMETABLE TAB ─────────────────────────────────────────────────
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function TimetableTab({ state }) {
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Weekly Timetable</div></div>
        <div className="pp-card-body">
          {(state.status === 'loading' || state.status === 'idle') && <Loading />}
          {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
          {state.status === 'ready' && (
            state.data.length === 0 ? (
              <Empty icon="🗓️" text="Timetable not published yet" />
            ) : (
              DAY_ORDER.map((day) => {
                const rows = state.data.filter(r => r.day_of_week === day);
                if (!rows.length) return null;
                return (
                  <div key={day} className="tt-day-block">
                    <div className="pp-card-title tt-day-title">{day}</div>
                    <table className="pp-table">
                      <thead><tr><th>Period</th><th>Subject</th><th>Teacher</th><th>Time</th></tr></thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td>{r.period}</td>
                            <td>{r.subject}</td>
                            <td>{r.teacher_name || '—'}</td>
                            <td>{r.start_time ? `${r.start_time}–${r.end_time}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
              <Empty icon="🏨" text="No leave history" />
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

// ── FEATURE 7: MESSAGE TEACHER TAB ───────────────────────────────────────────
function MessagesTab({ state, draft, onDraftChange, onSend, sending }) {
  return (
    <div className="pp-sec active">
      <div className="pp-card">
        <div className="pp-card-hd"><div className="pp-card-title">Message Class Teacher</div></div>
        <div className="pp-card-body">
          <div className="msg-thread">
            {(state.status === 'loading' || state.status === 'idle') && <Loading />}
            {state.status === 'error' && <Empty icon="💬" text={state.error} />}
            {state.status === 'ready' && (
              state.data.length === 0 ? (
                <Empty icon="💬" text="No messages yet — say hello!" />
              ) : (
                state.data.map((m) => (
                  <div key={m.id} className={`msg-bubble ${m.sender === 'parent' ? 'msg-me' : 'msg-them'}`}>
                    <div className="msg-body">{m.body}</div>
                    <div className="msg-meta">{m.sender === 'parent' ? 'You' : 'Teacher'} · {(m.created_at || '').slice(0, 16).replace('T', ' ')}</div>
                  </div>
                ))
              )
            )}
          </div>
          <div className="msg-composer">
            <input
              type="text"
              className="pp-fi"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !sending) onSend(); }}
            />
            <button className="pp-lbtn msg-send-btn" onClick={onSend} disabled={sending || !draft.trim()}>
              {sending ? '…' : 'Send'}
            </button>
          </div>
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