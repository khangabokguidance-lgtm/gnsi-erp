import { useState, useCallback, useEffect } from 'react';
import { supabase } from './supabase';
// Redesigned to a premium Tailwind CSS UI — the legacy ParentsPortal.css
// stylesheet is no longer used; every visual class below is a Tailwind
// utility class instead of a pp-* / custom class name.

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

// ─── REPORT_CARD_CSS — premium Tailwind-inspired redesign of the printed
// report card. This intentionally diverges from Exams.jsx's staff-side
// version (per explicit request): a parent-printed card will no longer be
// byte-identical to a staff-printed one.
const REPORT_CARD_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
@page{margin:0.7cm;size:A4;}
body{font-family:'Inter',ui-sans-serif,system-ui,sans-serif;background:#0f172a;padding:32px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.no-print{text-align:center;margin-bottom:20px;display:flex;gap:12px;justify-content:center;}
.no-print button{padding:12px 28px;border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;transition:opacity .15s;}
.no-print button:hover{opacity:.9;}
.btn-print{background:#d4af37;color:#0f172a;}.btn-close{background:rgba(255,255,255,.08);color:#f8fafc;border:1px solid rgba(255,255,255,.15)!important;}
.page-break{page-break-after:always;height:0;overflow:hidden;}
.card{width:760px;margin:0 auto 28px;background:#ffffff;border-radius:24px;box-shadow:0 25px 70px -15px rgba(0,0,0,.45),0 0 0 1px rgba(15,23,42,.06);position:relative;overflow:hidden;}
.top-strip{height:6px;background:linear-gradient(90deg,#0f172a 0%,#1e3a8a 30%,#d4af37 60%,#f4d878 80%,#1e3a8a 100%);}
.header{background:linear-gradient(135deg,#0b1120 0%,#0f172a 50%,#152238 100%);padding:32px 40px 24px;display:flex;align-items:center;gap:20px;position:relative;}
.header::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 85% -20%,rgba(212,175,55,.18),transparent 60%);pointer-events:none;}
.logo-ring{width:72px;height:72px;border-radius:9999px;border:2px solid #d4af37;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 0 4px rgba(212,175,55,.12);}
.logo-text{font-family:'Inter',sans-serif;font-size:15px;font-weight:800;color:#fff;letter-spacing:.05em;}
.header-center{flex:1;text-align:center;}
.eyebrow{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;font-weight:600;}
.inst-name{font-family:'Inter',sans-serif;font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;letter-spacing:-.01em;}
.inst-addr{font-size:12px;color:#94a3b8;}
.doc-badge{text-align:center;flex-shrink:0;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.4);border-radius:14px;padding:8px 16px;}
.doc-badge-title{font-family:'Inter',sans-serif;font-size:13px;font-weight:800;color:#f4d878;letter-spacing:.15em;line-height:1.3;}
.doc-badge-sub{font-size:10px;color:#cbd5e1;margin-top:4px;font-weight:600;}
.exam-result-bar{background:#111c34;padding:14px 40px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,.06);}
.exam-info{display:flex;gap:28px;flex-wrap:wrap;}
.exam-info-item{display:flex;flex-direction:column;}
.exam-info-label{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#93a5c9;margin-bottom:3px;font-weight:700;}
.exam-info-value{font-size:14px;font-weight:700;color:#ffffff;}
.result-pill-bar{display:flex;align-items:center;gap:10px;}
.student-section{padding:24px 40px 8px;}
.section-title{font-family:'Inter',sans-serif;font-size:11px;font-weight:800;color:#0f172a;letter-spacing:.2em;text-transform:uppercase;margin-bottom:12px;}
.student-table{width:100%;border-collapse:separate;border-spacing:0 6px;font-size:13px;}
.student-table td{padding:10px 14px;background:#f8fafc;}
.student-table tr td:first-child{border-radius:10px 0 0 10px;}
.student-table tr td:last-child{border-radius:0 10px 10px 0;}
.student-table .lbl{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;font-weight:700;background:#eef2f9;width:130px;}
.student-table .val{font-weight:700;color:#0f172a;}
.student-table .val.big{font-family:'Inter',sans-serif;font-size:17px;color:#0f172a;letter-spacing:-.01em;}
.score-grid{display:grid;grid-template-columns:repeat(5,1fr);background:linear-gradient(135deg,#0f172a,#182b4d);margin:16px 40px 0;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px -10px rgba(15,23,42,.4);}
.score-cell{text-align:center;padding:16px 8px;border-right:1px solid rgba(255,255,255,.08);}
.score-cell:last-child{border-right:none;}
.score-lbl{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#93a5c9;margin-bottom:6px;font-weight:700;}
.score-val{font-family:'Inter',sans-serif;font-size:24px;font-weight:800;color:#ffffff;line-height:1;}
.score-val.gold{color:#f4d878;}
.score-sub{font-size:10px;color:#93a5c9;margin-top:4px;font-weight:600;}
.marks-section{padding:20px 40px;}
.marks-table{width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;}
.marks-table thead tr{background:#0f172a;}
.marks-table thead th{padding:11px 12px;text-align:center;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#cbd5e1;font-weight:700;}
.marks-table tbody tr:nth-child(even){background:#f8fafc;}
.marks-table tbody td{padding:11px 12px;text-align:center;border-bottom:1px solid #f1f5f9;}
.marks-table tfoot tr{background:#eef2f9;}
.marks-table tfoot td{padding:12px;border-top:2px solid #cbd5e1;text-align:center;font-weight:800;}
.remark-box{margin:0 40px 18px;padding:16px 20px;background:#fdfaf1;border:1px solid #f0e4bd;border-left:4px solid #d4af37;border-radius:14px;}
.remark-label{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#a17e1f;font-weight:800;margin-bottom:6px;}
.remark-text{font-family:'Inter',sans-serif;font-size:14px;font-style:italic;color:#453a15;line-height:1.65;}
.sig-section{display:flex;align-items:flex-end;justify-content:space-between;padding:18px 40px 26px;background:#fff;border-top:1px solid #e2e8f0;gap:20px;}
.sig-block{text-align:center;flex:1;}
.sig-space{height:44px;}
.sig-label{border-top:1.5px solid #cbd5e1;padding-top:6px;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#475569;font-weight:700;margin:0 10px;}
.seal-block{flex:0 0 90px;display:flex;flex-direction:column;align-items:center;}
.seal{width:90px;height:90px;display:flex;align-items:center;justify-content:center;}
.seal img{width:90px;height:90px;object-fit:contain;}
.footer-strip{background:linear-gradient(90deg,#0b1120,#0f172a,#0b1120);padding:12px 40px;}
.footer-text{font-size:10px;color:#94a3b8;text-align:center;font-weight:500;letter-spacing:.03em;}
.bottom-strip{height:5px;background:linear-gradient(90deg,#1e3a8a,#d4af37,#1e3a8a);}
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
// Same fallback-name problem Fees.jsx's getParentPhone already documents:
// the real guardian/parent contact column isn't standardized across this
// schema's history. Rather than guessing one name (which breaks login
// outright if wrong — Supabase errors the whole query on an unknown
// column, not just that field), probe each candidate individually against
// one known student id and cache whichever one actually exists. Probing
// against a real id (not a blind .select().limit(1)) means an empty
// table still resolves correctly instead of every column looking "absent".
let _guardianColumnCache; // undefined = not yet probed, null = none found, string = resolved column
const GUARDIAN_COLUMN_CANDIDATES = [
  'guardian_phone', 'father_phone', 'mother_phone', 'parent_phone',
  'guardian_mobile', 'mobile', 'phone', 'contact_no', 'contact_number',
];
async function resolveGuardianColumn(sampleStudentId) {
  if (_guardianColumnCache !== undefined) return _guardianColumnCache;
  for (const col of GUARDIAN_COLUMN_CANDIDATES) {
    try {
      const { error } = await supabase.from('students').select(col).eq('id', sampleStudentId).maybeSingle();
      if (!error) { _guardianColumnCache = col; return col; }
    } catch (_) { /* try next candidate */ }
  }
  _guardianColumnCache = null;
  return null;
}

export default function ParentsPortal({ isOpen, onClose }) {
  // Multi-child support: `siblings` holds every student matched to the same
  // GCC/name login family (same admission phone or same last name + hostel
  // is NOT reliable, so we key siblings off whichever guardian/parent
  // contact column resolveGuardianColumn() finds actually exists on this
  // schema); falls back to just the single logged-in student when no
  // such column exists or the resolved column has no value for them.
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

      // Base columns only — NOT any guardian/parent contact column. Which
      // of those actually exist on this schema is unconfirmed (Fees.jsx's
      // getParentPhone tries 8 different possible names — guardian_phone,
      // father_phone, mother_phone, parent_phone, guardian_mobile, mobile,
      // phone, contact_no/contact_number — because the real schema is
      // inconsistent), and a plain .select() errors out the ENTIRE query
      // if even one named column doesn't exist, not just that field.
      // resolveGuardianColumn() (below) probes for a working column
      // separately, once, after this login query has already succeeded.
      const { data, error } = await Promise.race([
        supabase
          .from('students')
          .select('id, name, course, class_name, batch, hostel_type, status, admission_no, gcc_no, photo_url')
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

      // Multi-child: look up siblings sharing the same guardian contact.
      // The real column name isn't known — resolveGuardianColumn() probes
      // a short candidate list one at a time (a query for a nonexistent
      // column errors, but only that one probe, not the login above) and
      // remembers whichever one worked so later logins in this session
      // don't re-probe. If none of the candidates exist, this quietly
      // falls back to a single-child view rather than erroring.
      try {
        const col = await resolveGuardianColumn(data.id);
        if (col && data[col]) {
          const { data: sibs } = await supabase
            .from('students')
            .select(`id, name, course, class_name, batch, hostel_type, status, admission_no, gcc_no, photo_url, ${col}`)
            .eq(col, data[col]);
          if (sibs && sibs.length > 1) setSiblings(sibs);
          else setSiblings([data]);
        } else {
          setSiblings([data]);
        }
      } catch (_) {
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
        <div class="no-print" style="position:sticky;top:0;z-index:2;background:rgba(15,23,42,.92);backdrop-filter:blur(8px);padding:1rem 1.4rem;display:flex;gap:.7rem;justify-content:flex-end;box-shadow:0 4px 20px rgba(0,0,0,.25);">
          <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
          <button class="btn-close" onclick="document.getElementById('rcPrintOverlay').remove();document.body.style.overflow='';">✕ Close</button>
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

  // Builds the single most relevant unpaid due to send as one payment
  // link — the real endpoint (create-payment-link.js) requires `gcc` and
  // `amount`, and its `notes.kind`/`for_month`/`year` are what webhook.js
  // reads to know which fee-table row to mark paid once payment succeeds,
  // so this can't just send the total: it has to target one concrete due.
  // Priority: admission fee (one-time, usually the first thing owed) →
  // earliest unpaid flat-fee month → earliest unpaid course-fee month.
  const pickNextDue = (dues) => {
    if (dues.admission && !dues.admission.paid && dues.admission.due > 0) {
      return { kind: 'admission', amount: dues.admission.due };
    }
    const unpaidFlat = (dues.flatFee?.items || []).filter(i => !i.paid).sort((a, b) => a.year - b.year);
    if (unpaidFlat.length) {
      const i = unpaidFlat[0];
      return { kind: 'flat', amount: i.expected, for_month: i.month, year: i.year };
    }
    const unpaidCourse = (dues.courseFee?.items || []).filter(i => !i.paid).sort((a, b) => a.year - b.year);
    if (unpaidCourse.length) {
      const i = unpaidCourse[0];
      return { kind: 'course', amount: i.expected, for_month: i.month, year: i.year };
    }
    return null;
  };

  const handlePayNow = async () => {
    if (!student || fees.status !== 'ready') return;
    const nextDue = pickNextDue(fees.data);
    if (!nextDue) {
      alert('No specific due found to pay online right now. Please contact the office.');
      return;
    }
    try {
      const res = await fetch('/api/razorpay/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gcc: student.gcc_no,
          amount: nextDue.amount,
          studentName: student.name,
          kind: nextDue.kind,
          for_month: nextDue.for_month,
          year: nextDue.year,
          course: student.course,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
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

  // LandingPage.jsx injects ~90KB of landing-page-only CSS via a JSX
  // <style dangerouslySetInnerHTML> tag (html{font-size:clamp(...)}, plus
  // resets on *, body, a, img, h1-h5). Because that tag is rendered as part
  // of LandingPage's own output, it lands in the DOM after Tailwind's
  // compiled stylesheet and wins cascade ties against Tailwind's base layer
  // for every element in this portal, since ParentsPortal mounts as
  // LandingPage's child.
  //
  // Fix: reset only the SPECIFIC properties that stylesheet clobbers
  // (font-size, line-height, margin, text-decoration, box-sizing) back to
  // browser defaults, scoped to #ppOverlay so it can't leak out onto the
  // rest of the landing page. Deliberately NOT `all: revert` — that would
  // have equal-or-higher specificity than Tailwind's own utility classes
  // (an ID selector beats a bare class selector) and would wipe out every
  // Tailwind utility too. Each Tailwind class Claude added below sets its
  // own explicit value for whichever property it touches, so it simply
  // wins normally wherever it's applied; only elements Claude did NOT put
  // an explicit Tailwind class on fall back to this safe baseline instead
  // of LandingPage's clamp()-based sizing.
  return (
    <>
      <style>{`
        #ppOverlay, #ppOverlay * {
          font-size: revert;
          line-height: revert;
          margin: revert;
          text-decoration: revert;
          box-sizing: border-box;
        }
      `}</style>
      <div
        className="fixed inset-0 z-[1000] bg-slate-950 flex items-stretch overflow-y-auto text-base font-sans antialiased"
        id="ppOverlay"
      >
      {!student ? (
        <div className="relative flex-1 flex items-center justify-center px-4 py-10 bg-[radial-gradient(circle_at_20%_-10%,rgba(212,175,55,.12),transparent_45%),radial-gradient(circle_at_90%_110%,rgba(30,58,138,.35),transparent_50%)]" id="ppLoginWrap">
          <button
            className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center text-lg"
            onClick={onClose}
          >
            ✕
          </button>
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_30px_90px_-20px_rgba(0,0,0,.6)] p-8">
            <div className="text-center mb-7">
              <img
                src={EMBLEM_URL}
                alt="GNSI"
                className="h-[70px] w-[70px] object-contain mx-auto mb-3 drop-shadow-[0_0_20px_rgba(212,175,55,.25)]"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <h2 className="text-xl font-bold text-white tracking-tight">Parents Portal</h2>
              <p className="text-xs text-slate-400 mt-1 tracking-wide">GNSI · Khangabok, Manipur</p>
            </div>
            {loginError && (
              <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {loginError}
              </div>
            )}
            <label className="block text-[11px] font-semibold uppercase tracking-[.15em] text-slate-400 mb-1.5">GCC No.</label>
            <input
              type="text"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 transition mb-4"
              placeholder="e.g. 1107"
              value={loginGcc}
              onChange={(e) => setLoginGcc(e.target.value)}
            />
            <label className="block text-[11px] font-semibold uppercase tracking-[.15em] text-slate-400 mb-1.5">Student Name</label>
            <input
              type="text"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 transition mb-6"
              placeholder="Full name as registered"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
            />
            <button
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 text-slate-900 font-bold py-3.5 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:brightness-105 active:scale-[.99] transition disabled:opacity-50 disabled:pointer-events-none"
              disabled={loginBusy}
              onClick={handleLogin}
            >
              {loginBusy ? 'Checking…' : 'Login to Parents Portal →'}
            </button>
            <p className="text-center text-xs text-slate-400 mt-5 tracking-wide">
              Contact institute if you need help:{" "}
              <a href="tel:+918974298074" className="text-amber-300 hover:text-amber-200 font-medium">
                +91 89742 98074
              </a>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-screen bg-slate-950" id="ppShell">
          {showInstallBanner && (
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-amber-400 to-amber-300 text-slate-900 px-4 py-2.5 text-sm font-medium">
              <span>📲 Install this portal as an app for quick access</span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleInstallClick} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 transition">Install</button>
                <button onClick={() => setShowInstallBanner(false)} className="h-7 w-7 rounded-lg hover:bg-black/10 flex items-center justify-center transition">✕</button>
              </div>
            </div>
          )}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={EMBLEM_URL} alt="GNSI" className="h-9 w-9 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{student.name || 'Student'}</h3>
                <p className="text-[11px] text-slate-400 tracking-wide">GNSI Parents Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {siblings.length > 1 && (
                <select
                  className="rounded-lg border border-white/10 bg-white/5 text-white text-xs px-2.5 py-2 outline-none focus:border-amber-400/60"
                  value={student.id}
                  onChange={(e) => {
                    const chosen = siblings.find(s => String(s.id) === e.target.value);
                    if (chosen) switchChild(chosen);
                  }}
                >
                  {siblings.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>
                  ))}
                </select>
              )}
              <button
                className="rounded-lg border border-white/10 text-slate-300 hover:text-white hover:border-white/25 px-3 py-2 text-xs font-semibold transition"
                onClick={() => { handleLogout(); onClose(); }}
              >
                Logout ✕
              </button>
            </div>
          </div>
          <div className="sticky top-[57px] z-10 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-white/10 bg-slate-950/95 backdrop-blur-xl px-4 py-2.5">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-amber-400 to-amber-300 text-slate-900 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => handleTabClick(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8 max-w-5xl w-full mx-auto">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
              <div className="h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-lg font-bold text-slate-900 overflow-hidden ring-2 ring-amber-400/30">
                {student.photo_url
                  ? <img src={student.photo_url} alt="" className="h-full w-full object-cover rounded-full" />
                  : ((student.name || 'S')[0] || 'S').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-white truncate">{student.name || 'Student'}</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{[student.course, student.class_name, student.batch].filter(Boolean).join(' · ')}</p>
                <div className="flex gap-1.5 mt-2">
                  <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300">{student.hostel_type || '—'}</span>
                  <span className="rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">{student.status || 'Active'}</span>
                </div>
              </div>
              <button
                className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/15 text-amber-300 px-3.5 py-2.5 text-xs font-semibold transition disabled:opacity-50"
                onClick={exportProgressReport}
                disabled={exportBusy}
                title="Download full progress report as PDF"
              >
                {exportBusy ? '⏳' : '⬇️'} <span className="hidden sm:inline">Export Report</span>
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
              <FeesTab state={fees} onPayNow={handlePayNow} nextDue={fees.status === 'ready' ? pickNextDue(fees.data) : null} />
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
    </>
  );
}
// ── TAB COMPONENTS ────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-400 text-sm">
      <div className="h-6 w-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
      Loading…
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="text-3xl opacity-70">{icon}</div>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

// Shared premium card shell used by every tab.
function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_10px_40px_-15px_rgba(0,0,0,.4)] overflow-hidden mb-4">
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
          <div className="text-sm font-bold text-white tracking-tight">{title}</div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function PremiumTable({ head, children }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[.12em] text-slate-400 border-b border-white/10">
            {head.map((h, i) => <th key={i} className="px-3 py-2.5 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

// ── FEATURE 10: DASHBOARD HOME (single glanceable summary) ──────────────────
function DashboardTab({ student, attendance, alertCount, fees, pushStatus, onEnablePush, onGoTab }) {
  const attPct = attendance.status === 'ready' ? attendance.data.pct : null;
  const feeBalance = fees.status === 'ready' ? fees.data.totalDue : undefined;

  const tiles = [
    { id: 'att', icon: '📊', val: attPct !== null ? `${attPct}%` : '—', lbl: 'Attendance this month' },
    { id: 'fees', icon: '💳', val: feeBalance !== undefined && feeBalance !== null ? `₹${feeBalance}` : '—', lbl: 'Fee balance due' },
    { id: 'alerts', icon: '🔔', val: alertCount !== null ? alertCount : '—', lbl: 'Absences (30 days)' },
    { id: 'notices', icon: '📣', val: 'View', lbl: 'Notice board' },
    { id: 'homework', icon: '📚', val: 'View', lbl: 'Homework & material' },
    { id: 'timetable', icon: '🗓️', val: 'View', lbl: 'Class timetable' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {tiles.map(t => (
          <button
            key={t.id}
            onClick={() => onGoTab(t.id)}
            className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-amber-400/30 p-4 transition shadow-[0_8px_30px_-12px_rgba(0,0,0,.4)]"
          >
            <div className="text-xl mb-2 group-hover:scale-110 transition-transform inline-block">{t.icon}</div>
            <div className="text-xl font-extrabold text-white tracking-tight">{t.val}</div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">{t.lbl}</div>
          </button>
        ))}
      </div>

      {pushStatus !== 'subscribed' && (
        <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/[0.08] to-transparent p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <strong className="text-sm font-bold text-white">Turn on notifications</strong>
            <p className="text-xs text-slate-400 mt-1">
              Get notified instantly about new notices, absences and exam results.
            </p>
          </div>
          <button
            className="shrink-0 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 text-slate-900 font-bold px-4 py-2.5 text-xs shadow-lg shadow-amber-500/20 hover:brightness-105 transition disabled:opacity-60"
            onClick={onEnablePush}
            disabled={pushStatus === 'unsupported' || pushStatus === 'denied'}
          >
            {pushStatus === 'unsupported' ? 'Not supported on this browser' : pushStatus === 'denied' ? 'Permission denied — check browser settings' : 'Enable'}
          </button>
        </div>
      )}
    </div>
  );
}

function Pill({ tone, children }) {
  const tones = {
    hi: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    mi: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
    lo: 'bg-rose-400/10 text-rose-300 border-rose-400/20',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function AttendanceTab({ state }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <Card><Loading /></Card>;
  }
  if (state.status === 'error') {
    return <Card><Empty icon="⚠️" text={state.error} /></Card>;
  }

  const { rows, monthLabel, daysInMonth, y, m, present, absent, pct } = state.data;
  const byDate = Object.fromEntries(rows.map(r => [r.date.slice(8, 10), r.status]));
  const last10 = rows.slice(-10).reverse();

  return (
    <div>
      <Card
        title="This Month's Attendance"
        right={<span className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold">{monthLabel}</span>}
      >
        <div className="grid grid-cols-7 gap-1.5 mb-5">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const dd = String(d).padStart(2, '0');
            const st = byDate[dd];
            const cls = st === 'Present'
              ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25'
              : st === 'Absent'
              ? 'bg-rose-400/15 text-rose-300 border-rose-400/25'
              : 'bg-white/[0.03] text-slate-500 border-white/5';
            return (
              <div
                key={d}
                title={`${y}-${m}-${dd}`}
                className={`aspect-square rounded-lg border flex items-center justify-center text-xs font-semibold ${cls}`}
              >
                {d}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-center">
            <strong className="block text-lg font-extrabold text-emerald-300">{present}</strong>
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Present</span>
          </div>
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-center">
            <strong className="block text-lg font-extrabold text-rose-300">{absent}</strong>
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Absent</span>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-center">
            <strong className="block text-lg font-extrabold text-amber-300">{pct}%</strong>
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Rate</span>
          </div>
        </div>
      </Card>
      <Card title="Last 10 Days">
        {last10.length ? (
          <PremiumTable head={['Date', 'Status']}>
            {last10.map((r, i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-slate-300">{r.date}</td>
                <td className="px-3 py-2.5"><Pill tone={r.status === 'Present' ? 'hi' : 'lo'}>{r.status}</Pill></td>
              </tr>
            ))}
          </PremiumTable>
        ) : (
          <Empty icon="📅" text="No recent records" />
        )}
      </Card>
    </div>
  );
}

function ExamsTab({ state }) {
  return (
    <Card title="Exam Results">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="📝" text="No results yet" />
        ) : (
          <PremiumTable head={['Exam', 'Subject', 'Marks', 'Date']}>
            {state.data.map((r, i) => {
              const tone = r.pct === null ? 'mi' : r.pct >= 75 ? 'hi' : r.pct >= 50 ? 'mi' : 'lo';
              const marksStr = r.hasMarks ? (r.total !== null ? `${r.marks_obtained}/${r.total}` : r.marks_obtained) : 'Not graded';
              return (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 text-slate-300">{r.examName}</td>
                  <td className="px-3 py-2.5 text-slate-300">{r.subject || '—'}</td>
                  <td className="px-3 py-2.5"><Pill tone={tone}>{marksStr}</Pill></td>
                  <td className="px-3 py-2.5 text-slate-400">{r.exam_date ? r.exam_date.slice(0, 10) : '—'}</td>
                </tr>
              );
            })}
          </PremiumTable>
        )
      )}
    </Card>
  );
}

function ReportCardTab({ examTypes, selectedType, onTypeChange, dates, selectedDate, onDateChange, onPrint, printBusy }) {
  const canPrint = selectedType && selectedDate && !printBusy;
  const selectCls = "w-full rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3.5 py-2.5 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 transition";
  return (
    <Card title="Report Card">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400 mb-1.5">Exam</label>
          <select className={selectCls} value={selectedType} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="" className="bg-slate-900">
              {examTypes.status === 'loading' ? 'Loading…' : examTypes.status === 'empty' ? '— No exams recorded —' : examTypes.status === 'error' ? '— Error loading exams —' : 'Select exam…'}
            </option>
            {examTypes.options.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400 mb-1.5">Date</label>
          <select className={selectCls} value={selectedDate} onChange={(e) => onDateChange(e.target.value)}>
            <option value="" className="bg-slate-900">
              {dates.status === 'loading' ? 'Loading…' : dates.status === 'empty' ? '— No dates —' : dates.status === 'error' ? '— Error —' : '—'}
            </option>
            {dates.options.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-5 leading-relaxed">
        Pick an exam and date, then view or print an official report card showing subject-wise marks, grade and class rank.
      </p>
      <button
        className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 text-slate-900 font-bold px-5 py-3 text-sm shadow-lg shadow-amber-500/20 hover:brightness-105 active:scale-[.99] transition disabled:opacity-50 disabled:pointer-events-none"
        onClick={onPrint}
        disabled={!canPrint}
      >
        {printBusy ? '⏳ Preparing…' : '🖨️ View / Print Report Card'}
      </button>
    </Card>
  );
}

// ── FEATURE 1: FEE DUES TAB ──────────────────────────────────────────────────
// Reads the real getStudentDues() shape from feeDues.js: separate
// admission/flatFee/courseFee breakdowns (each with its own due amount and,
// for flat/course fee, a list of individual month items), plus totalPaid/
// totalDue/monthsOverdue and a failedSources array flagging any fee source
// that errored during the lookup (dues are a LOWER BOUND when non-empty).
function FeesTab({ state, onPayNow, nextDue }) {
  return (
    <Card title="Fee Summary">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        <>
          {state.data.failedSources?.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-4 py-3 text-xs text-amber-200 leading-relaxed">
              ⚠️ Some fee data could not be loaded just now. The figures below may understate what's actually due — please refresh, or contact the office to confirm the exact balance.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-center">
              <div className="text-[10px] uppercase tracking-[.12em] text-slate-400 font-semibold mb-1">Total Paid</div>
              <div className="text-xl font-extrabold text-emerald-300">₹{state.data.totalPaid ?? 0}</div>
            </div>
            <div className={`rounded-xl border p-4 text-center ${(state.data.totalDue ?? 0) > 0 ? 'border-rose-400/20 bg-rose-400/[0.06]' : 'border-emerald-400/20 bg-emerald-400/[0.06]'}`}>
              <div className="text-[10px] uppercase tracking-[.12em] text-slate-400 font-semibold mb-1">Total Due</div>
              <div className={`text-xl font-extrabold ${(state.data.totalDue ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                ₹{state.data.totalDue ?? 0}
              </div>
            </div>
          </div>

          {state.data.monthsOverdue > 0 && (
            <p className="text-xs text-amber-300 mb-4 font-medium">
              {state.data.monthsOverdue} month{state.data.monthsOverdue === 1 ? '' : 's'} overdue across flat/course fee.
            </p>
          )}

          {nextDue && (
            <button
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 text-slate-900 font-bold px-5 py-3 text-sm shadow-lg shadow-amber-500/20 hover:brightness-105 active:scale-[.99] transition mb-5"
              onClick={onPayNow}
            >
              💳 Pay {nextDue.kind === 'admission' ? 'Admission Fee' : `${nextDue.kind === 'flat' ? 'Flat' : 'Course'} Fee — ${nextDue.for_month} ${nextDue.year}`} (₹{nextDue.amount}) Online
            </button>
          )}

          <div className="space-y-2.5 mb-6">
            <FeeBreakdownRow
              label="Admission Fee"
              paid={state.data.admission?.paid}
              due={state.data.admission?.due}
              detail={state.data.admission?.paid ? 'Fully paid' : `₹${state.data.admission?.paidAmount ?? 0} of ₹${state.data.admission?.expected ?? 0} paid`}
            />
            <FeeMonthsBreakdown label="Hostel Flat Fee" items={state.data.flatFee?.items} due={state.data.flatFee?.due} />
            <FeeMonthsBreakdown label="Course Fee" items={state.data.courseFee?.items} due={state.data.courseFee?.due} />
          </div>

          <div>
            <div className="text-sm font-bold text-white mb-3">Payment History</div>
            {(state.data.history || []).length ? (
              <PremiumTable head={['Date', 'Type', 'Mode', 'Amount']}>
                {(state.data.history || []).map((r, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-slate-400">{(r.date || '').slice(0, 10) || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-300">{r.type || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{r.mode || '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-white">₹{r.amount ?? 0}</td>
                  </tr>
                ))}
              </PremiumTable>
            ) : (
              <Empty icon="🧾" text="No payment history yet" />
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function FeeBreakdownRow({ label, paid, due, detail }) {
  const negative = !paid && due > 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">{detail}</div>
      </div>
      <div className={`text-sm font-bold shrink-0 ${negative ? 'text-rose-300' : 'text-emerald-300'}`}>
        {paid ? '✓ Paid' : due > 0 ? `₹${due} due` : '—'}
      </div>
    </div>
  );
}

function FeeMonthsBreakdown({ label, items, due }) {
  const list = items || [];
  const unpaid = list.filter(i => !i.paid);
  const negative = (due ?? 0) > 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className={`text-sm font-bold shrink-0 ${negative ? 'text-rose-300' : 'text-emerald-300'}`}>
          {negative ? `₹${due} due` : '✓ Up to date'}
        </div>
      </div>
      {unpaid.length > 0 && (
        <div className="text-xs text-slate-400 mt-1.5">
          Unpaid: {unpaid.map(i => `${i.month} ${i.year}`).join(', ')}
        </div>
      )}
    </div>
  );
}

// ── FEATURE 2: HOMEWORK / STUDY MATERIAL TAB ────────────────────────────────
function HomeworkTab({ state }) {
  return (
    <Card title="Homework & Study Material">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="📚" text="No study material posted yet" />
        ) : (
          <div className="space-y-2">
            {state.data.map((h) => (
              <a
                key={h.id}
                href={h.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-400/25 px-4 py-3 transition"
              >
                <div className="text-xl shrink-0">{h.material_type === 'video' ? '🎬' : '📄'}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{h.title || h.chapter || 'Study Material'}</div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{[h.subject, h.chapter].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="text-amber-300 shrink-0">⬇️</div>
              </a>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

// ── FEATURE 3: TIMETABLE TAB ─────────────────────────────────────────────────
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function TimetableTab({ state }) {
  return (
    <Card title="Weekly Timetable">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="🗓️" text="Timetable not published yet" />
        ) : (
          <div className="space-y-5">
            {DAY_ORDER.map((day) => {
              const rows = state.data.filter(r => r.day_of_week === day);
              if (!rows.length) return null;
              return (
                <div key={day}>
                  <div className="text-xs font-bold uppercase tracking-[.12em] text-amber-300 mb-2">{day}</div>
                  <PremiumTable head={['Period', 'Subject', 'Teacher', 'Time']}>
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-slate-400">{r.period}</td>
                        <td className="px-3 py-2.5 font-semibold text-white">{r.subject}</td>
                        <td className="px-3 py-2.5 text-slate-300">{r.teacher_name || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-400">{r.start_time ? `${r.start_time}–${r.end_time}` : '—'}</td>
                      </tr>
                    ))}
                  </PremiumTable>
                </div>
              );
            })}
          </div>
        )
      )}
    </Card>
  );
}

function NoticesTab({ state }) {
  const priTone = { High: 'lo', Medium: 'mi', Low: 'hi' };
  return (
    <Card title="Official Notices">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="📣" text="No notices" />
        ) : (
          <div className="space-y-3">
            {state.data.map((n, i) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4" key={i}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Pill tone={priTone[n.priority] || 'hi'}>{n.priority || 'Low'}</Pill>
                  <span className="text-[11px] text-slate-500">{n.notice_date || ''}</span>
                </div>
                <div className="text-sm font-bold text-white">{n.title}</div>
                <div className="text-xs text-slate-400 mt-1 leading-relaxed">{n.body || ''}</div>
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

function LeaveTab({ state }) {
  const stTone = { approved: 'hi', rejected: 'lo', pending: 'mi' };
  return (
    <Card title="Hostel Leave History">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="🏨" text="No leave history" />
        ) : (
          <div className="space-y-3">
            {state.data.map((r, i) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4" key={i}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-white">{r.from_date} → {r.to_date}</span>
                  <Pill tone={stTone[r.status] || 'mi'}>{r.status || 'pending'}</Pill>
                </div>
                <div className="text-xs text-slate-400">{r.reason || '—'}</div>
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

// ── FEATURE 7: MESSAGE TEACHER TAB ───────────────────────────────────────────
function MessagesTab({ state, draft, onDraftChange, onSend, sending }) {
  return (
    <Card title="Message Class Teacher">
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto mb-4 pr-1">
        {(state.status === 'loading' || state.status === 'idle') && <Loading />}
        {state.status === 'error' && <Empty icon="💬" text={state.error} />}
        {state.status === 'ready' && (
          state.data.length === 0 ? (
            <Empty icon="💬" text="No messages yet — say hello!" />
          ) : (
            state.data.map((m) => {
              const mine = m.sender === 'parent';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-gradient-to-r from-amber-400 to-amber-300 text-slate-900 rounded-br-sm' : 'bg-white/[0.06] text-white border border-white/10 rounded-bl-sm'}`}>
                    <div className="text-sm">{m.body}</div>
                    <div className={`text-[10px] mt-1 font-medium ${mine ? 'text-slate-900/60' : 'text-slate-400'}`}>
                      {mine ? 'You' : 'Teacher'} · {(m.created_at || '').slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 transition"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !sending) onSend(); }}
        />
        <button
          className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 text-slate-900 font-bold px-5 py-3 text-sm shadow-lg shadow-amber-500/20 hover:brightness-105 transition disabled:opacity-50 disabled:pointer-events-none"
          onClick={onSend}
          disabled={sending || !draft.trim()}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </Card>
  );
}

function AlertsTab({ state }) {
  return (
    <Card title="Recent Alerts">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="✅" text="No alerts — all good!" />
        ) : (
          <div className="space-y-2.5">
            {state.data.map((a, i) => (
              <div
                key={i}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${a.type === 'exam' ? 'border-rose-400/20 bg-rose-400/[0.06]' : 'border-amber-400/20 bg-amber-400/[0.06]'}`}
              >
                <div className="text-sm text-white">{a.msg}</div>
                <div className="text-[11px] text-slate-400 shrink-0">{a.date ? a.date.slice(0, 10) : ''}</div>
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}