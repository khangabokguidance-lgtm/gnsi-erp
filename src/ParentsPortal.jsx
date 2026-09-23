import { useState, useCallback, useEffect } from 'react';
import { supabase } from './supabase';
// Redesigned to match Accounts.jsx's design language — white cards, navy
// #1e3a5f accents, inline styles (no Tailwind). The legacy ParentsPortal.css
// stylesheet is no longer used.

const EMBLEM_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/emblem/gnsi-emblem.png";
// "Celebrating 10 Years" full banner (navy background, not transparent) —
// upload gnsi-10years-banner.jpg to gnsi-public/banners/ in Supabase.
const TENYEAR_BANNER_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/banners/gnsi-10years-banner.jpg";

// ── .ics CALENDAR EXPORT ─────────────────────────────────────────────────
// Builds a minimal RFC 5545 calendar file client-side (no library) from
// dates already present in state the parent can see on screen — exam dates
// from exam_marks, approved leave date ranges from leave_records. There is
// no "upcoming events" table in this schema to export from, so this only
// ever exports real dates the portal already shows, not a fabricated feed.
function icsEscape(str) {
  return String(str ?? '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}
function icsDate(dateStr) {
  // dateStr is 'YYYY-MM-DD' — VALUE=DATE all-day events need 'YYYYMMDD'.
  return (dateStr || '').slice(0, 10).replace(/-/g, '');
}
function downloadIcs(filename, events) {
  // events: [{ uid, title, date, endDate?, description? }] — endDate is
  // exclusive per the iCal all-day-event convention, so callers pass the
  // day AFTER the last day the event covers.
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GNSI Parents Portal//EN',
    'CALSCALE:GREGORIAN',
  ];
  events.forEach(ev => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(ev.uid)}@gnsi-portal`,
      `DTSTAMP:${icsDate(new Date().toISOString())}T000000Z`,
      `DTSTART;VALUE=DATE:${icsDate(ev.date)}`,
      `DTEND;VALUE=DATE:${icsDate(ev.endDate || ev.date)}`,
      `SUMMARY:${icsEscape(ev.title)}`,
      ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : null,
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── FEE RECEIPT PRINT ────────────────────────────────────────────────────
// Ported from StudentFeeLedger.jsx's printReceipt (same admin-side receipt
// used at the front desk) so a parent gets the identical branded receipt
// for a past payment, not a lookalike built separately. `row` here is the
// flattened Payment History entry from loadFees above — `row.raw` carries
// the original adm_fee_collections/adm_flat_fees/adm_course_fees row for
// the fee-type-specific fields (hostel_type, course, month), and
// `row.feeType` is 'adm' | 'flat' | 'crs', matching StudentFeeLedger's
// printReceipt(student, row, type) signature exactly.
const feeFmt = (n) => Number(n || 0).toLocaleString('en-IN');
const feeFmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function printFeeReceipt(student, historyEntry) {
  const row = historyEntry.raw || {};
  const type = historyEntry.feeType;
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const receiptNo = row.receipt_no || historyEntry.receipt || '—';
  const payDate = feeFmtDate(row.pay_date || historyEntry.date);
  const payMode = row.pay_mode || historyEntry.mode || '—';
  const txnRef = row.txn_ref || null;
  let description, amount, sectionLabel, accentColor;

  if (type === 'adm') {
    description = row.description || row.fee_type || 'Admission / Kit Fee';
    amount = Number(row.amount_paid ?? historyEntry.amount ?? 0);
    sectionLabel = 'Admission & Kit Fee';
    accentColor = '#4f46e5';
  } else if (type === 'flat') {
    description = `Monthly Fee — ${row.month || ''}${row.year ? ' ' + row.year : ''}${row.hostel_type ? ' (' + row.hostel_type + ')' : ''}`;
    amount = Number(row.amount ?? historyEntry.amount ?? 0);
    sectionLabel = `Monthly Flat Fee${row.hostel_type ? ' · ' + row.hostel_type : ''}`;
    accentColor = '#059669';
  } else {
    description = `Course Fee — ${row.for_month || ''}${row.year ? ' ' + row.year : ''}`;
    amount = Number(row.amount_paid ?? historyEntry.amount ?? 0);
    sectionLabel = `Course Fee${row.course ? ' · ' + row.course : ''}`;
    accentColor = '#7c3aed';
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${receiptNo}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#f0f4f8;display:flex;justify-content:center;padding:32px 16px}.page{width:720px;background:white;border-radius:0;box-shadow:0 4px 40px rgba(0,0,0,.15);overflow:hidden}.header{background:#1e3a5f;padding:28px 36px}.inst-name{font-size:20px;font-weight:700;color:white}.receipt-no{font-size:22px;font-weight:800;color:#c9a84c;font-family:monospace}.meta{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #E2E8F0}.mc{padding:10px 18px;border-right:1px solid #E2E8F0}.ml{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}.mv{font-weight:700;color:#1E293B;font-size:12px}table{width:100%;border-collapse:collapse}td{padding:8px 18px;border-bottom:1px solid #F1F5F9}.grand td{background:#1E1B4B;font-weight:900;font-size:16px;color:#fff;padding:14px 18px;border:none}.ftr{padding:16px 20px;background:#F8FAFC;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between}.sig-line{height:1px;width:130px;border-top:1.5px dashed #CBD5E1;margin-top:32px}.btns{display:flex;gap:10px;justify-content:center;margin-top:20px}.btn{padding:11px 30px;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer}.bp{background:#1e3a5f;color:#fff}@media print{.btns{display:none}}</style></head><body>
  <div class="page">
    <div class="header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><div class="inst-name">Guidance Navodaya &amp; Sainik Institute</div><div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:4px">Khangabok, Thoubal, Manipur</div></div>
      <div style="text-align:right"><div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.1em">Receipt No.</div><div class="receipt-no">${receiptNo}</div></div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,${accentColor},#c9a84c)"></div>
    <div class="meta">
      <div class="mc"><div class="ml">Date</div><div class="mv">${payDate}</div></div>
      <div class="mc"><div class="ml">Pay mode</div><div class="mv">${payMode}</div></div>
      <div class="mc"><div class="ml">Type</div><div class="mv" style="color:${accentColor}">${sectionLabel}</div></div>
    </div>
    <table><tbody>
      <tr><td style="color:#64748B;width:40%">Student</td><td style="font-weight:700">${student.name}</td></tr>
      <tr><td style="color:#64748B">GCC No.</td><td style="font-weight:700">GCC-${student.gcc_no}</td></tr>
      <tr><td style="color:#64748B">Class / Course</td><td style="font-weight:700">${[student.batch, student.course].filter(Boolean).join(' · ') || '—'}</td></tr>
      ${row.hostel_type ? `<tr><td style="color:#64748B">Hostel Type</td><td style="font-weight:700">${row.hostel_type}</td></tr>` : ''}
      ${txnRef ? `<tr><td style="color:#64748B">Txn ref</td><td style="font-weight:700">${txnRef}</td></tr>` : ''}
    </tbody></table>
    <table><tbody>
      <tr><td style="color:#1E293B;font-weight:600">${description}</td><td style="text-align:right;font-weight:800;font-size:16px;color:${accentColor}">₹${feeFmt(amount)}</td></tr>
      <tr class="grand"><td>Total Paid</td><td style="text-align:right">₹${feeFmt(amount)}</td></tr>
    </tbody></table>
    <div class="ftr">
      <div><div style="font-size:11px;color:#94a3b8;margin-bottom:4px">Authorised signatory</div><div class="sig-line"></div></div>
      <div style="text-align:right;font-size:11px;color:#94A3B8"><div style="font-weight:700;color:#1E293B;font-size:13px">GNSI</div><div>Printed on: ${dateStr}</div></div>
    </div>
  </div>
  <div class="btns"><button class="btn bp" onclick="window.print()">Print receipt</button></div>
  </body></html>`;

  const pw = window.open('', '_blank', 'width=820,height=950,scrollbars=yes');
  if (!pw) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return; }
  pw.document.write(html); pw.document.close();
  setTimeout(() => pw.print(), 500);
}

// ── responsive hook ───────────────────────────────────────────────────────
// Same pattern Accounts.jsx uses (useWindowWidth): drives real breakpoint
// behavior (stacking grids, smaller padding/fonts) rather than just letting
// fixed-fraction grids flex proportionally forever.
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

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

// Homework, Timetable, Notices and Message Teacher are disabled below —
// they queried tables (study_materials, timetables, notices,
// parent_messages) that don't exist anywhere in the real schema (checked
// against every admin-side module: Hostel.jsx, Exams.jsx, Students.jsx,
// Accounts.jsx, etc.). Re-enable each by adding it back here once its
// table is actually created — see the matching commented-out tab state /
// load function / render block below for what to restore.
const TABS = [
  { id: 'home',       label: '🏠 Dashboard' },
  { id: 'profile',    label: '🪪 My Profile' },
  { id: 'att',        label: '📊 Attendance' },
  { id: 'exams',      label: '📝 Exam Scores' },
  { id: 'reportcard', label: '🧾 Report Card' },
  { id: 'fees',       label: '💳 Fee Dues' },
  { id: 'leave',      label: '🏨 Hostel Leave' },
  { id: 'items',      label: '🎒 Parent Items' },
  { id: 'purchases',  label: '🛒 Store Purchases' },
  { id: 'grievance',  label: '📮 Raise a Concern' },
  { id: 'alerts',     label: '🔔 Alerts' },
  { id: 'site',       label: '🌐 More Info & Site' },
];

// Every public landing-page section, so a logged-in parent can jump straight
// to it without leaving the portal to go hunting through the public nav.
// Grouped the same way the landing page's own "More" hamburger menu groups
// them. Clicking a link closes the portal and sets window.location.hash —
// LandingPage.jsx already listens for hashchange (see onHashChange) and
// switches to the matching tab, so this needs no extra plumbing/props.
const SITE_LINK_GROUPS = [
  {
    heading: 'Admissions & Results',
    links: [
      { label: 'Admissions / Enquiry', href: '#enquiry', icon: '📋' },
      { label: "Results & Toppers' Wall", href: '#results', icon: '🏆' },
      { label: 'Fee Payment', href: '#fee-payment', icon: '💳' },
      { label: 'Courses', href: '#courses', icon: '📚' },
      { label: 'Scholarship / Free Test', href: '#scholarship', icon: '🎓' },
    ],
  },
  {
    heading: 'Exam Preparation',
    links: [
      { label: 'Syllabus', href: '#syllabus', icon: '📖' },
      { label: 'Question Papers', href: '#question-papers', icon: '📄' },
      { label: 'Exam Calendar', href: '#exam-calendar', icon: '🗓️' },
      { label: 'Important Dates', href: '#important-dates', icon: '⏰' },
      { label: 'Mock Tests', href: '#mock-tests', icon: '📝' },
    ],
  },
  {
    heading: 'About GNSI',
    links: [
      { label: 'About GNSI', href: '#about', icon: 'ℹ️' },
      { label: 'Head of the Institute', href: '#head-institute', icon: '🎖️' },
      { label: 'Faculty', href: '#faculty', icon: '👨‍🏫' },
      { label: 'Facilities', href: '#facilities', icon: '🏫' },
      { label: 'Student Reviews', href: '#reviews', icon: '⭐' },
    ],
  },
  {
    heading: 'Media & Updates',
    links: [
      { label: 'Notices', href: '#notices', icon: '📌' },
      { label: 'Blog & News', href: '#blog', icon: '📰' },
      { label: 'Gallery', href: '#gallery', icon: '🖼️' },
      { label: 'Videos', href: '#videos', icon: '🎬' },
      { label: 'Events', href: '#events', icon: '🎉' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'FAQ', href: '#faq', icon: '❓' },
      { label: 'Download App', href: '#app-download', icon: '📲' },
      { label: 'Helpdesk / Grievance', href: '#helpdesk', icon: '🆘' },
    ],
  },
];

// Mobile-only bottom nav: 4 icons fit a thumb-reach bar (matches Android/iOS
// tab-bar convention). Everything else lives behind "More", opened as a
// slide-up sheet — same pattern most native apps use once tabs outgrow the
// bar. Desktop keeps the full horizontal-scroll strip (TABS) unchanged.
const BOTTOM_NAV_TABS = [
  { id: 'home',  label: 'Home',   icon: '🏠' },
  { id: 'att',   label: 'Attend', icon: '📊' },
  { id: 'fees',  label: 'Fees',   icon: '💳' },
  { id: 'alerts', label: 'Alerts', icon: '🔔' },
];
const MORE_TABS = TABS.filter(t => !BOTTOM_NAV_TABS.some(b => b.id === t.id));

const initialTabState = { status: 'idle', data: null, error: null };
/**
 * ParentsPortal — student login + attendance/exams/report-card/fees/leave/
 * grievance/alerts dashboard. Talks directly to Supabase; has no dependency
 * on websiteApi.js. All data lives in React state — no getElementById/
 * innerHTML (except the isolated print overlay, which is a deliberate
 * exception for print-window HTML).
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
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 640;

  // Multi-child support: `siblings` holds every student matched to the same
  // GCC/name login family (same admission phone or same last name + hostel
  // is NOT reliable, so we key siblings off whichever guardian/parent
  // contact column resolveGuardianColumn() finds actually exists on this
  // schema); falls back to just the single logged-in student when no
  // such column exists or the resolved column has no value for them.
  const [siblings, setSiblings] = useState([]);
  const [student, setStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [moreOpen, setMoreOpen] = useState(false);
  // Hamburger dropdown for the top nav — replaces the old horizontal-scroll
  // TABS strip, which overflowed/got cramped at tablet widths (below the
  // 640px isMobile cutoff that switches to the separate bottom nav).
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  const [loginGcc, setLoginGcc] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [documents, setDocuments] = useState(initialTabState);
  const [attendance, setAttendance] = useState(initialTabState);
  const [exams, setExams] = useState(initialTabState);
  const [leave, setLeave] = useState(initialTabState);
  const [alerts, setAlerts] = useState(initialTabState);
  const [fees, setFees] = useState(initialTabState);
  // Homework, Timetable, Notices, Message Teacher — disabled, see the TABS
  // comment above for why. State/load functions/render blocks removed
  // along with the tabs so there's no dead code pretending to work.
  const [grievanceDone, setGrievanceDone] = useState(false);

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
    setDocuments(initialTabState);
    setExams(initialTabState);
    setLeave(initialTabState);
    setAlerts(initialTabState);
    setFees(initialTabState);
    setGrievanceDone(false);
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
          .select('id, name, course, class_name, batch, hostel_type, status, admission_no, gcc_no, photo_url, dob, blood_group, father_name, mother_name, address')
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
      loadAttendance(data);
      loadDocuments(data.id);
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
    loadAttendance(child);
    loadDocuments(child.id);
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
    setMoreOpen(false);
    setNavMenuOpen(false);
    if (!student) return;
    if (id === 'att' && attendance.status === 'idle') loadAttendance(student);
    if (id === 'profile' && documents.status === 'idle') loadDocuments(student.id);
    if (id === 'exams' && exams.status === 'idle') loadExams(student.id);
    if (id === 'reportcard' && rcExamTypes.status === 'idle') loadReportCardExamTypes(student.id);
    if (id === 'leave' && leave.status === 'idle') loadLeave(student.id);
    if (id === 'alerts' && alerts.status === 'idle') loadAlerts(student.id);
    if (id === 'fees' && fees.status === 'idle') loadFees(student);
  };

  // ── TAB: ATTENDANCE ──────────────────────────────────────────────────────

  const loadAttendance = useCallback(async (stu) => {
    setAttendance({ status: 'loading', data: null, error: null });

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const monthStart = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const monthEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    try {
      // Real tables are attendance_sessions + attendance_records
      // (Attendance.jsx) — a session is one class period (course/subtype/
      // period_number on a session_date), and attendance_records rows key
      // off session_id, not a date column of their own. Roll call runs once
      // per period, so a student can have several rows on the same date
      // (one per class that day). Same join pattern Attendance.jsx itself
      // uses to build a single student's monthly history: fetch this
      // month's sessions, then this student's records against those
      // session ids (matched by gcc_no, falling back to name), then join
      // session_date back in. Collapse to one status per day for the
      // calendar/summary: Present if marked Present in any period that
      // day, else the "worst" status present (Absent worse than Late,
      // worse than Leave).
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id, session_date')
        .gte('session_date', monthStart)
        .lte('session_date', monthEnd);

      const sessById = Object.fromEntries((sessions || []).map(s => [s.id, s]));
      const ids = (sessions || []).map(s => s.id);

      let recs = [];
      if (ids.length) {
        const q = stu.gcc_no != null && stu.gcc_no !== ''
          ? supabase.from('attendance_records').select('session_id, status, gcc_no, student_name').in('session_id', ids).eq('gcc_no', stu.gcc_no)
          : supabase.from('attendance_records').select('session_id, status, gcc_no, student_name').in('session_id', ids).eq('student_name', stu.name);
        const { data } = await q;
        recs = data || [];
      }

      const STATUS_RANK = { 'Present': 0, 'Late': 1, 'Leave': 2, 'Absent': 3 };
      const byDay = new Map();
      recs.forEach(r => {
        const date = sessById[r.session_id]?.session_date;
        if (!date) return;
        const existing = byDay.get(date);
        if (!existing || (STATUS_RANK[r.status] ?? 0) > (STATUS_RANK[existing.status] ?? 0)) {
          byDay.set(date, { date, status: r.status });
        }
      });
      const rows = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

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

  // ── TAB: MY PROFILE (documents) ──────────────────────────────────────────
  // Real table is student_documents (Students.jsx): student_id, doc_type,
  // file_name, storage_path, created_at. Files live in the "gnsi" storage
  // bucket and are only reachable through short-lived signed URLs (no
  // public bucket access) — same getSignedUrl(path, ttl) pattern
  // Students.jsx uses for staff. Fetched once per student login; profile
  // fields themselves (dob, blood_group, father_name, mother_name,
  // address) already come back on the login row, added to that select.
  const loadDocuments = useCallback(async (studentId) => {
    setDocuments({ status: 'loading', data: null, error: null });
    try {
      const { data, error } = await supabase
        .from('student_documents')
        .select('id, doc_type, file_name, storage_path, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments({ status: 'ready', data: data || [], error: null });
    } catch (e) {
      console.error('Documents load failed:', e);
      setDocuments({ status: 'error', data: null, error: 'Failed to load documents' });
    }
  }, []);

  const handleViewDocument = async (storagePath) => {
    try {
      const { data, error } = await supabase.storage.from('gnsi').createSignedUrl(storagePath, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noreferrer');
    } catch (e) {
      alert('Could not open document: ' + (e?.message || 'Unknown error'));
    }
  };

  // Lets a parent fill in the handful of identity/contact fields that are
  // still blank on the office record (dob, blood_group, father_name,
  // mother_name, address) — never overwrite a field staff already entered,
  // so this only ever patches columns that were null/empty going in.
  // `patch` is pre-filtered by ProfileTab to just those blank fields.
  const handleSaveProfileFields = async (patch) => {
    if (!student?.id || !patch || Object.keys(patch).length === 0) return;
    const { error } = await supabase.from('students').update(patch).eq('id', student.id);
    if (error) throw error;
    setStudent((prev) => (prev ? { ...prev, ...patch } : prev));
  };

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

  // ── TAB: HOSTEL LEAVE ────────────────────────────────────────────────────

  const loadLeave = useCallback(async (studentId) => {
    setLeave({ status: 'loading', data: null, error: null });
    try {
      // Real table is leave_records (Hostel.jsx), not "leave_requests" —
      // also carries leave_type and approval_level, which the admin side
      // uses to track multi-level (HM → Superintendent) sign-off.
      // select('*') rather than naming every column: Hostel.jsx's own
      // queries only confirm id/student_id/student_name/leave_type/
      // from_date/to_date/approval_level/status — `reason` and
      // `created_at` are likely present but unconfirmed, and naming a
      // column that doesn't exist errors out the whole query.
      const { data } = await supabase
        .from('leave_records')
        .select('*')
        .eq('student_id', studentId)
        .order('from_date', { ascending: false })
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
          .from('attendance_records')
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
      // attendance_records has up to 2 rows/day (morning + evening roll
      // call) — dedupe by date so a full-day absence doesn't show twice.
      const seenAbsentDates = new Set();
      (attRes.data || []).forEach(r => {
        if (seenAbsentDates.has(r.date)) return;
        seenAbsentDates.add(r.date);
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
      // Note: attendance_records can have 2 rows/day (morning+evening), so
      // this count is "absent roll-call marks in 30 days", not distinct
      // days — an acceptable approximation for a home-screen badge; the
      // Alerts tab itself dedupes by date for the detailed list above.
      const { count } = await supabase
        .from('attendance_records')
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
      // Select * (not a narrow column list) on each so the raw row is kept
      // alongside the normalized display fields below — printReceipt needs
      // fee-type-specific columns (hostel_type, course, month/for_month,
      // fee_type) that the flattened `type`/`mode`/`amount` shape below
      // doesn't carry, and re-deriving them from the normalized string
      // (e.g. parsing "Flat Fee — June 2026" back apart) would be fragile.
      const [{ data: admRows }, { data: flatRows }, { data: courseRows }] = await Promise.all([
        supabase.from('adm_fee_collections').select('*').eq('adm_app_id', gcc).eq('reverted', false),
        supabase.from('adm_flat_fees').select('*').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false),
        supabase.from('adm_course_fees').select('*').eq('adm_app_id', gcc).eq('reverted', false),
      ]);

      const history = [
        ...(admRows || []).map(r => ({ date: r.pay_date, type: r.description || 'Admission/Item Fee', mode: r.pay_mode, amount: r.amount_paid, receipt: r.receipt_no, feeType: 'adm', raw: r })),
        ...(flatRows || []).map(r => ({ date: r.pay_date, type: `Flat Fee — ${r.month} ${r.year}`, mode: r.pay_mode, amount: r.amount, receipt: r.receipt_no, feeType: 'flat', raw: r })),
        ...(courseRows || []).map(r => ({ date: r.pay_date, type: `Course Fee — ${r.for_month} ${r.year}`, mode: r.pay_mode, amount: r.amount_paid, receipt: r.receipt_no, feeType: 'crs', raw: r })),
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


  // Homework/Study Material, Timetable and Message Teacher tabs removed —
  // their tables (study_materials, timetables, parent_messages) don't
  // exist anywhere in the real schema. Re-add once those tables are
  // created; the original query shapes are preserved in the migration
  // notes given alongside this file.

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
        supabase.from('attendance_records').select('date, status').eq('student_id', student.id).order('date', { ascending: false }).limit(60),
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

  // ── Accounts-module design language ──────────────────────────────────────
  // Matches Accounts.jsx: light background (#f8fafc), white rounded cards
  // with a soft shadow, navy (#1e3a5f) as the primary accent, colored
  // left-border stat cards, and inline styles (no Tailwind) — same
  // conventions Accounts.jsx uses throughout, so the two modules look like
  // one product instead of two different UI kits bolted together.
  const NAVY = '#1e3a5f';
  const BG = '#f8fafc';
  const GOLD = '#B8912E';
  const GOLDL = '#D9B65C';

  return (
    <>
      <style>{`
        @keyframes pp-spin { to { transform: rotate(360deg); } }
        #ppOverlay .no-scrollbar::-webkit-scrollbar { display: none; }
        #ppOverlay .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        /* The host page (guidancekhangabok.in) has its own global CSS —
           this overlay mounts as a child of that page's DOM, so without an
           explicit reset here every element inherits whatever box-sizing/
           width rules the host page's stylesheet happens to set. Most of
           this file's inline styles pair padding with width:100% or a
           percentage width, which only stays inside its container under
           border-box sizing — under the browser's default content-box (or
           whatever the host page overrides it to), that padding adds on
           top of the width and pushes content past the viewport edge,
           which is exactly the horizontal overflow/no-mobile-layout bug.
           The !important is deliberate: this must win over the host
           page's rules, not just Tailwind's (which is no longer used here). */
        #ppOverlay, #ppOverlay *, #ppOverlay *::before, #ppOverlay *::after {
          box-sizing: border-box !important;
        }
        #ppOverlay { max-width: 100vw; overflow-x: hidden; }
        #ppOverlay img { max-width: 100%; }
      `}</style>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: BG,
          display: 'flex', alignItems: 'stretch', overflowY: 'auto', overflowX: 'hidden',
          fontFamily: 'inherit', fontSize: 14, color: '#1e293b', width: '100%', maxWidth: '100vw',
        }}
        id="ppOverlay"
      >
      {!student ? (
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '56px 12px 24px' : '40px 16px', background: 'linear-gradient(135deg,#eef2f9 0%,#f8fafc 60%)' }} id="ppLoginWrap">
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: isMobile ? 12 : 20, right: isMobile ? 12 : 20, height: 40, width: 40, borderRadius: '50%', backgroundColor: 'white', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', fontSize: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
          <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src={TENYEAR_BANNER_URL}
              alt="GNSI — Celebrating 10 Years of Success"
              style={{
                width: '100%', maxWidth: 220, height: 'auto', borderRadius: isMobile ? 20 : 14,
                marginBottom: isMobile ? 18 : 22, boxShadow: '0 10px 30px -8px rgba(15,23,42,.35)',
                display: 'block',
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          <div style={{
            width: '100%', maxWidth: 420,
            borderRadius: isMobile ? 28 : 18,
            backgroundColor: 'white',
            boxShadow: isMobile ? '0 2px 10px rgba(30,58,95,0.12)' : '0 20px 50px -12px rgba(15,23,42,.22)',
            padding: isMobile ? '30px 22px 26px' : '0 36px 32px',
            overflow: 'hidden',
          }}>
            {!isMobile && (
              <div style={{
                margin: '0 -36px 26px', padding: '26px 36px 20px',
                background: `linear-gradient(135deg, ${NAVY} 0%, #142c4d 100%)`,
                borderBottom: `3px solid ${GOLD}`,
                textAlign: 'center',
              }}>
                <div style={{
                  width: 78, height: 78, borderRadius: '50%', margin: '0 auto 12px',
                  backgroundColor: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${GOLDL}`, boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                }}>
                  <img
                    src={EMBLEM_URL}
                    alt="GNSI"
                    style={{ height: 54, width: 54, objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '.01em' }}>Parents Portal</h2>
                <p style={{ fontSize: 12, color: GOLDL, marginTop: 5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  GNSI · Khangabok, Manipur
                </p>
              </div>
            )}
            {isMobile && (
              <div style={{ textAlign: 'center', marginBottom: 26 }}>
                <div style={{
                  width: 76, height: 76, borderRadius: '50%', margin: '0 auto 12px',
                  backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${GOLD}`,
                }}>
                  <img
                    src={EMBLEM_URL}
                    alt="GNSI"
                    style={{ height: 54, width: 54, objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: 0 }}>Parents Portal</h2>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>GNSI · Khangabok, Manipur</p>
              </div>
            )}
            {loginError && (
              <div style={{ marginBottom: 16, borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #fecaca', backgroundColor: isMobile ? '#fdeaea' : '#fef2f2', padding: '12px 16px', fontSize: 13, color: '#b91c1c' }}>
                {loginError}
              </div>
            )}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b', marginBottom: 6 }}>GCC No.</label>
            <input
              type="text"
              style={{
                width: '100%', borderRadius: isMobile ? 16 : 10,
                border: isMobile ? 'none' : '1px solid #cbd5e1',
                backgroundColor: isMobile ? '#eef1f7' : '#f8fafc',
                padding: isMobile ? '14px 16px' : '12px 14px',
                color: '#1e293b', outline: 'none', marginBottom: 16, fontSize: 14, boxSizing: 'border-box',
              }}
              placeholder="e.g. 1107"
              value={loginGcc}
              onChange={(e) => setLoginGcc(e.target.value)}
            />
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b', marginBottom: 6 }}>Student Name</label>
            <input
              type="text"
              style={{
                width: '100%', borderRadius: isMobile ? 16 : 10,
                border: isMobile ? 'none' : '1px solid #cbd5e1',
                backgroundColor: isMobile ? '#eef1f7' : '#f8fafc',
                padding: isMobile ? '14px 16px' : '12px 14px',
                color: '#1e293b', outline: 'none', marginBottom: 22, fontSize: 14, boxSizing: 'border-box',
              }}
              placeholder="Full name as registered"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
            />
            <button
              style={{
                width: '100%', borderRadius: isMobile ? 999 : 10, backgroundColor: NAVY, color: 'white', fontWeight: 700,
                padding: isMobile ? '15px 0' : '13px 0', border: `1px solid ${NAVY}`, cursor: loginBusy ? 'not-allowed' : 'pointer',
                fontSize: 14, opacity: loginBusy ? 0.6 : 1,
                boxShadow: isMobile ? '0 3px 8px rgba(30,58,95,0.3)' : '0 6px 16px rgba(30,58,95,0.3)',
              }}
              disabled={loginBusy}
              onClick={handleLogin}
            >
              {loginBusy ? 'Checking…' : 'Login to Parents Portal →'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#64748b', marginTop: 18, marginBottom: 0 }}>
              Contact institute if you need help:{" "}
              <a href="tel:+918974298074" style={{ color: NAVY, fontWeight: 600, textDecoration: 'none' }}>
                +91 89742 98074
              </a>
            </p>
            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 20, paddingTop: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
                Not logging in?
              </p>
              <button
                onClick={() => { onClose(); window.location.hash = '#courses'; }}
                style={{
                  background: 'none', border: `1px solid ${GOLD}`, color: GOLD, borderRadius: isMobile ? 999 : 8,
                  padding: '9px 18px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Browse Site: Admissions, Syllabus, Notices →
              </button>
            </div>
          </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: BG }} id="ppShell">
          {showInstallBanner && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: NAVY, color: 'white', padding: '10px 16px', fontSize: 13, fontWeight: 600, flexWrap: 'wrap' }}>
              <span>📲 Install this portal as an app for quick access</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button onClick={handleInstallClick} style={{ borderRadius: 8, backgroundColor: 'white', color: NAVY, border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Install</button>
                <button onClick={() => setShowInstallBanner(false)} style={{ height: 28, width: 28, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>
          )}
          <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 8 : 16, borderBottom: '1px solid #e2e8f0', backgroundColor: 'white', padding: isMobile ? '10px 12px' : '12px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, minWidth: 0 }}>
              <img src={EMBLEM_URL} alt="GNSI" style={{ height: isMobile ? 30 : 36, width: isMobile ? 30 : 36, objectFit: 'contain', flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} />
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: NAVY, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name || 'Student'}</h3>
                {!isMobile && <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>GNSI Parents Portal</p>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexShrink: 0 }}>
              {siblings.length > 1 && (
                <select
                  style={{
                    borderRadius: isMobile ? 999 : 8,
                    border: isMobile ? 'none' : '1px solid #cbd5e1',
                    backgroundColor: isMobile ? '#eef1f7' : '#f8fafc',
                    color: '#1e293b', fontSize: isMobile ? 11 : 12, padding: isMobile ? '7px 10px' : '7px 10px', outline: 'none', maxWidth: isMobile ? 90 : 'none',
                  }}
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
              <button
                style={{
                  borderRadius: isMobile ? 999 : 8,
                  border: isMobile ? 'none' : '1px solid #e2e8f0',
                  color: isMobile ? NAVY : '#64748b',
                  backgroundColor: isMobile ? '#eef1f7' : 'white',
                  padding: isMobile ? '8px 10px' : '8px 12px', fontSize: isMobile ? 13 : 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
                onClick={() => { handleLogout(); onClose(); }}
              >
                {isMobile ? '✕' : 'Logout ✕'}
              </button>
            </div>
          </div>
          {!isMobile && (
            <div style={{ position: 'sticky', top: 60, zIndex: 20, borderBottom: '1px solid #e2e8f0', backgroundColor: 'white', padding: '10px 16px' }}>
              <div style={{ position: 'relative', maxWidth: 960, margin: '0 auto' }}>
                <button
                  onClick={() => setNavMenuOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10,
                    border: '1px solid #e2e8f0', padding: '9px 14px', fontSize: 13, fontWeight: 700,
                    backgroundColor: navMenuOpen ? '#eef2f9' : 'white', color: NAVY, cursor: 'pointer',
                  }}
                  aria-expanded={navMenuOpen}
                  aria-haspopup="true"
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>☰</span>
                  <span>{TABS.find(t => t.id === activeTab)?.label || 'Menu'}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>{navMenuOpen ? '▲' : '▼'}</span>
                </button>

                {navMenuOpen && (
                  <>
                    {/* Click-outside scrim — transparent, just for dismissal */}
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                      onClick={() => setNavMenuOpen(false)}
                    />
                    <div
                      style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 21,
                        minWidth: 220, backgroundColor: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
                        boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 6,
                      }}
                    >
                      {TABS.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleTabClick(t.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                            borderRadius: 8, border: 'none', padding: '10px 12px', fontSize: 13, fontWeight: 700,
                            backgroundColor: activeTab === t.id ? NAVY : 'transparent',
                            color: activeTab === t.id ? 'white' : '#334155', cursor: 'pointer',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          <div style={{ flex: 1, position: 'relative', zIndex: 1, padding: isMobile ? '14px 10px' : '28px 16px', paddingBottom: isMobile ? 78 : 20, maxWidth: 960, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={isMobile ? {
              display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap',
              gap: 12, borderRadius: 24, backgroundColor: 'white', boxShadow: '0 1px 3px rgba(30,58,95,0.10), 0 1px 2px rgba(30,58,95,0.06)',
              padding: 16, marginBottom: 14,
            } : {
              display: 'flex', alignItems: 'center', flexWrap: 'nowrap',
              gap: 16, borderRadius: 12, backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              padding: 16, marginBottom: 20, borderLeft: `4px solid ${NAVY}`,
            }}>
              <div style={{ height: isMobile ? 46 : 56, width: isMobile ? 46 : 56, flexShrink: 0, borderRadius: '50%', backgroundColor: '#eef2f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 15 : 18, fontWeight: 800, color: NAVY, overflow: 'hidden', border: isMobile ? 'none' : `2px solid ${NAVY}` }}>
                {student.photo_url
                  ? <img src={student.photo_url} alt="" style={{ height: '100%', width: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : ((student.name || 'S')[0] || 'S').toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <h3 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name || 'Student'}</h3>
                <p style={{ fontSize: isMobile ? 11 : 12, color: '#64748b', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[student.course, student.class_name, student.batch].filter(Boolean).join(' · ')}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ borderRadius: 999, backgroundColor: isMobile ? '#eef1f7' : '#f1f5f9', border: isMobile ? 'none' : '1px solid #e2e8f0', padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#64748b' }}>{student.hostel_type || '—'}</span>
                  <span style={{ borderRadius: 999, backgroundColor: isMobile ? '#d9f2e3' : '#dcfce7', border: isMobile ? 'none' : '1px solid #bbf7d0', padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#16a34a' }}>{student.status || 'Active'}</span>
                </div>
              </div>
              <button
                style={{
                  flexShrink: 0,
                  borderRadius: isMobile ? 999 : 10,
                  border: isMobile ? 'none' : `1px solid ${NAVY}`,
                  backgroundColor: '#eef2f9', color: NAVY,
                  padding: isMobile ? '11px 14px' : '10px 14px', fontSize: isMobile ? 12 : 12, fontWeight: 700,
                  cursor: exportBusy ? 'not-allowed' : 'pointer', opacity: exportBusy ? 0.6 : 1,
                  width: isMobile ? '100%' : 'auto', textAlign: 'center',
                }}
                onClick={exportProgressReport}
                disabled={exportBusy}
                title="Download full progress report as PDF"
              >
                {exportBusy ? '⏳' : '⬇️'} <span>Export Report</span>
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
                isMobile={isMobile}
                siblings={siblings}
                onSwitchChild={switchChild}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileTab student={student} documents={documents} onViewDocument={handleViewDocument} onSaveFields={handleSaveProfileFields} isMobile={isMobile} />
            )}
            {activeTab === 'att' && (
              <AttendanceTab state={attendance} isMobile={isMobile} />
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
                isMobile={isMobile}
              />
            )}
            {activeTab === 'fees' && (
              <FeesTab state={fees} onPayNow={handlePayNow} nextDue={fees.status === 'ready' ? pickNextDue(fees.data) : null} isMobile={isMobile} student={student} />
            )}
            {activeTab === 'leave' && (
              <LeaveTab state={leave} studentId={student.id} studentName={student.name} onSubmitted={() => loadLeave(student.id)} />
            )}
            {activeTab === 'items' && (
              <ParentItemsTab studentName={student.name} />
            )}
            {activeTab === 'purchases' && (
              <StorePurchasesTab student={student} />
            )}
            {activeTab === 'grievance' && (
              <GrievanceTab
                studentId={student.id}
                studentName={student.name}
                done={grievanceDone}
                onSubmitted={() => setGrievanceDone(true)}
                isMobile={isMobile}
              />
            )}
            {activeTab === 'alerts' && (
              <AlertsTab state={alerts} />
            )}
            {activeTab === 'site' && (
              <SiteLinksTab
                isMobile={isMobile}
                onNavigate={(href) => { onClose(); window.location.hash = href; }}
              />
            )}
          </div>

          {isMobile && (
            <>
              {/* Fixed bottom nav — native-app tab bar. Fits 4 primary
                  destinations plus a "More" button that opens the rest as a
                  slide-up sheet, the standard pattern once tabs outgrow a
                  bottom bar (5 slots total, thumb-reachable). */}
              <div
                style={{
                  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
                  display: 'flex', backgroundColor: 'white', borderTop: '1px solid #e2e8f0',
                  boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
              >
                {BOTTOM_NAV_TABS.map(t => {
                  const active = activeTab === t.id && !moreOpen;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleTabClick(t.id)}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 2, padding: '8px 4px 6px', border: 'none', background: 'none', cursor: 'pointer', position: 'relative',
                        color: active ? CYAN : '#94a3b8',
                      }}
                    >
                      {active && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, borderRadius: 999, backgroundColor: CYAN }} />}
                      <span style={{ fontSize: 19, lineHeight: 1 }}>{t.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, color: active ? NAVY : '#94a3b8' }}>{t.label}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setMoreOpen(true)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, padding: '8px 4px 6px', border: 'none', background: 'none', cursor: 'pointer',
                    color: moreOpen || MORE_TABS.some(t => t.id === activeTab) ? NAVY : '#94a3b8',
                  }}
                >
                  <span style={{ fontSize: 19, lineHeight: 1 }}>☰</span>
                  <span style={{ fontSize: 10, fontWeight: (moreOpen || MORE_TABS.some(t => t.id === activeTab)) ? 800 : 600 }}>More</span>
                </button>
              </div>

              {/* "More" drawer — slide-up sheet, dismissible by tapping the
                  scrim or an item. Kept mounted only while open. */}
              {moreOpen && (
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'flex-end' }}
                  onClick={() => setMoreOpen(false)}
                >
                  <div
                    style={{
                      width: '100%', backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16,
                      padding: '10px 10px calc(10px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: '#e2e8f0', margin: '2px auto 10px' }} />
                    {MORE_TABS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleTabClick(t.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                          borderRadius: 10, border: 'none', padding: '13px 12px', fontSize: 14, fontWeight: 700,
                          backgroundColor: activeTab === t.id ? '#eef2f9' : 'transparent',
                          color: activeTab === t.id ? NAVY : '#334155', cursor: 'pointer',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>
    </>
  );
}
// ── TAB COMPONENTS ────────────────────────────────────────────────────────────
// All styled to match Accounts.jsx: white cards, navy #1e3a5f accents,
// colored left-border stat tiles, light backgrounds instead of dark
// glassmorphism.

// Paytm-style palette: deep blue primary + cyan accent, replacing the
// previous plain navy. NAVY is kept as the variable name (read everywhere
// in this file) so this is a value swap, not a rename across 2000+ lines.
const NAVY = '#00295B';
const CYAN = '#00BAF2';

// ── Material Design 3 tokens (mobile only) ───────────────────────────────
// NAVY stays the M3 "primary" so the brand colour doesn't change — only the
// shapes, surfaces and elevation shift to Android's current style. Desktop
// keeps the original flatter web-card look (Card/Pill/etc. branch on
// isMobile), since M3 is specifically an Android convention, not a web one.
const M3 = {
  radiusLg: 20,      // cards / sheets
  radiusMd: 16,      // tonal buttons, tiles
  radiusSm: 12,      // inputs, pills
  radiusFull: 999,   // chips
  primary: NAVY,
  accent: CYAN,
  primaryContainer: '#dceefc',   // tonal fill behind primary content
  onPrimaryContainer: NAVY,
  surface: '#ffffff',
  surfaceContainer: '#f2f7fc',   // low-emphasis tonal surface (M3 "surface container")
  outline: '#dbe7f2',
  // M3 elevation is a soft, colour-tinted shadow rather than a hard drop
  // shadow — level 1 (resting cards) and level 3 (sheets/menus over content).
  elevation1: '0 1px 3px rgba(0,41,91,0.10), 0 1px 2px rgba(0,41,91,0.06)',
  elevation3: '0 4px 12px rgba(0,41,91,0.14), 0 2px 6px rgba(0,41,91,0.08)',
};

function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: '#94a3b8', fontSize: 13 }}>
      <div style={{ height: 24, width: 24, borderRadius: '50%', border: `3px solid #e2e8f0`, borderTopColor: NAVY, animation: 'pp-spin .8s linear infinite' }} />
      Loading…
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 30, opacity: 0.7 }}>{icon}</div>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{text}</p>
    </div>
  );
}

// Shared card shell, matching Accounts.jsx's white/shadow/rounded convention.
function Card({ title, right, children }) {
  // Self-contained responsive check (rather than threading isMobile through
  // every single call site) — Card is used by nearly every tab, and its
  // only mobile need is tighter padding.
  const isMobile = useWindowWidth() < 640;
  return (
    <div style={{
      borderRadius: isMobile ? M3.radiusLg : 12,
      border: isMobile ? 'none' : '1px solid #e2e8f0',
      backgroundColor: isMobile ? M3.surface : 'white',
      boxShadow: isMobile ? M3.elevation1 : '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden', marginBottom: isMobile ? 12 : 16,
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          borderBottom: isMobile ? 'none' : '1px solid #e2e8f0',
          backgroundColor: isMobile ? M3.surfaceContainer : 'transparent',
          padding: isMobile ? '14px 16px' : '14px 18px',
        }}>
          <div style={{ fontSize: isMobile ? 14 : 14, fontWeight: 700, letterSpacing: isMobile ? 0 : undefined, color: NAVY }}>{title}</div>
          {right}
        </div>
      )}
      <div style={{ padding: isMobile ? 16 : 18 }}>{children}</div>
    </div>
  );
}

// `align` is optional — an array of 'left'/'right'/'center' matching `head`,
// used when a column (e.g. a numeric/marks column) reads better right- or
// center-aligned than the default left.
function PremiumTable({ head, align, children }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
            {head.map((h, i) => <th key={i} style={{ padding: '10px 12px', fontWeight: 700, textAlign: align?.[i] || 'left' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// Fee data here has no day-level due date (feeDues.js only tracks month/year
// + paid/unpaid — see pickNextDue above), so a literal "due in N days"
// countdown can't be built honestly from it. The real actionable signal
// this data does support: an unpaid admission fee, or the current calendar
// month's flat/course fee not yet marked paid — both mean money is owed
// right now, which is what the banner surfaces.
function getDueSoonSummary(dues) {
  if (!dues) return null;
  const items = [];
  if (dues.admission && !dues.admission.paid && dues.admission.due > 0) {
    items.push({ label: 'Admission Fee', amount: dues.admission.due });
  }
  const now = new Date();
  const curMonthName = now.toLocaleString('default', { month: 'long' });
  const curYear = now.getFullYear();
  const isCurrentMonth = (i) => i.month === curMonthName && Number(i.year) === curYear;
  const unpaidFlatNow = (dues.flatFee?.items || []).find(i => !i.paid && isCurrentMonth(i));
  if (unpaidFlatNow) items.push({ label: `Hostel Fee — ${unpaidFlatNow.month} ${unpaidFlatNow.year}`, amount: unpaidFlatNow.expected });
  const unpaidCourseNow = (dues.courseFee?.items || []).find(i => !i.paid && isCurrentMonth(i));
  if (unpaidCourseNow) items.push({ label: `Course Fee — ${unpaidCourseNow.month} ${unpaidCourseNow.year}`, amount: unpaidCourseNow.expected });
  return items.length ? items : null;
}

// Family overview — shown only for multi-child households (siblings.length
// > 1). Runs the same lightweight per-child fee-due lookup (getStudentDues,
// same as loadFees above but skipping the heavier payment-history join)
// plus a this-month attendance-% query, in parallel for every sibling, so
// a parent with multiple children doesn't have to switch back and forth to
// see who's OK and who needs attention. Real data per child — nothing here
// is estimated.
function SiblingOverview({ siblings, activeStudentId, onSwitchChild, isMobile }) {
  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!siblings || siblings.length < 2) return;
    let cancelled = false;
    (async () => {
      try {
        const feeMod = await import('./feeDues.js');
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const from = `${y}-${m}-01`;
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

        const results = await Promise.all(siblings.map(async (s) => {
          let dues = null, pct = null;
          try {
            let admissionDate = s.admission_date;
            if (admissionDate === undefined) {
              const { data: admRow } = await supabase.from('students').select('admission_date').eq('id', s.id).maybeSingle();
              admissionDate = admRow?.admission_date || null;
            }
            dues = await feeMod.getStudentDues({ ...s, admission_date: admissionDate });
          } catch (e) { console.error('Sibling fee lookup failed:', s.id, e); }
          try {
            const { data } = await supabase
              .from('attendance_records')
              .select('date, status')
              .eq('student_id', s.id)
              .gte('date', from).lte('date', to);
            const byDay = new Map();
            (data || []).forEach(r => { if (!byDay.has(r.date)) byDay.set(r.date, r.status); });
            const total = byDay.size;
            const present = [...byDay.values()].filter(v => v === 'Present').length;
            pct = total ? Math.round((present / total) * 100) : null;
          } catch (e) { console.error('Sibling attendance lookup failed:', s.id, e); }
          return { student: s, totalDue: dues?.totalDue ?? null, pct };
        }));
        if (!cancelled) setRows(results);
      } catch (e) {
        console.error('Sibling overview load failed:', e);
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [siblings]);

  if (!siblings || siblings.length < 2) return null;

  return (
    <Card title="Family Overview" right={<span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94a3b8', fontWeight: 700 }}>{siblings.length} children</span>}>
      {error && <Empty icon="⚠️" text="Could not load family overview" />}
      {!error && rows === null && <Loading />}
      {!error && rows !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(({ student: s, totalDue, pct }) => {
            const isActive = s.id === activeStudentId;
            return (
              <button
                key={s.id}
                onClick={() => !isActive && onSwitchChild?.(s)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  borderRadius: isMobile ? 16 : 10, textAlign: 'left', cursor: isActive ? 'default' : 'pointer',
                  border: isActive ? `1px solid ${NAVY}` : (isMobile ? 'none' : '1px solid #e2e8f0'),
                  backgroundColor: isActive ? '#eef2f9' : (isMobile ? M3.surfaceContainer : '#f8fafc'),
                  padding: '12px 14px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {s.name}
                    {isActive && <span style={{ fontSize: 10, fontWeight: 700, color: NAVY }}>(viewing)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{[s.course, s.class_name, s.batch].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: pct === null ? '#94a3b8' : pct >= 75 ? '#16a34a' : '#dc2626', borderRadius: 999, padding: '3px 8px', backgroundColor: pct === null ? '#f1f5f9' : pct >= 75 ? '#dcfce7' : '#fee2e2' }}>
                    {pct === null ? 'Att —' : `Att ${pct}%`}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: (totalDue ?? 0) > 0 ? '#dc2626' : '#16a34a', borderRadius: 999, padding: '3px 8px', backgroundColor: (totalDue ?? 0) > 0 ? '#fee2e2' : '#dcfce7' }}>
                    {totalDue === null ? 'Fee —' : (totalDue ?? 0) > 0 ? `₹${totalDue} due` : 'Fees OK'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── FEATURE 10: DASHBOARD HOME (Paytm-style: balance card + icon grid) ─────
// Redesigned to match the Paytm app's home pattern: a gradient "balance
// card" up top surfacing the one number that matters most (fee due, or an
// all-clear state), then a grid of square icon tiles — one per portal
// section — instead of a vertical list/menu. Every TABS entry gets a tile
// here now (previously only 6 of 10 sections were tiled; Profile, Report
// Card, Parent Items and Store Purchases were reachable only via the nav).
const HOME_TILES = [
  { id: 'profile',    icon: '🪪', label: 'My Profile',    color: NAVY },
  { id: 'att',        icon: '📊', label: 'Attendance',    color: NAVY },
  { id: 'exams',      icon: '📝', label: 'Exam Scores',   color: '#16a34a' },
  { id: 'reportcard', icon: '🧾', label: 'Report Card',   color: '#7c3aed' },
  { id: 'fees',       icon: '💳', label: 'Fee Dues',      color: '#dc2626' },
  { id: 'leave',      icon: '🏨', label: 'Hostel Leave',  color: '#0891b2' },
  { id: 'items',      icon: '🎒', label: 'Parent Items',  color: '#d97706' },
  { id: 'purchases',  icon: '🛒', label: 'Store Purchases', color: CYAN },
  { id: 'grievance',  icon: '📮', label: 'Raise a Concern', color: '#7c3aed' },
  { id: 'alerts',     icon: '🔔', label: 'Alerts',        color: '#f59e0b' },
];

function DashboardTab({ student, attendance, alertCount, fees, pushStatus, onEnablePush, onGoTab, isMobile, siblings, onSwitchChild }) {
  const attPct = attendance.status === 'ready' ? attendance.data.pct : null;
  const feeBalance = fees.status === 'ready' ? fees.data.totalDue : undefined;
  const dueSoon = fees.status === 'ready' ? getDueSoonSummary(fees.data) : null;
  const hasFeeData = feeBalance !== undefined && feeBalance !== null;
  const feeIsDue = hasFeeData && feeBalance > 0;

  const [dueBannerDismissed, setDueBannerDismissed] = useState(false);

  return (
    <div>
      {/* Paytm-style balance card — gradient banner, the one number that
          matters most (fee balance) front and center, quick attendance
          chip alongside it. */}
      <div style={{
        borderRadius: isMobile ? M3.radiusLg : 16,
        background: `linear-gradient(135deg, ${NAVY} 0%, #003b7a 55%, ${CYAN} 130%)`,
        padding: isMobile ? '20px 18px' : '24px 26px',
        marginBottom: isMobile ? 14 : 18,
        color: 'white',
        boxShadow: '0 8px 24px rgba(0,41,91,0.25)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.75 }}>
          {student?.name || 'Student'}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>{hasFeeData ? 'Fee balance' : 'Fee balance'}</div>
            <div style={{ fontSize: isMobile ? 30 : 34, fontWeight: 900, lineHeight: 1.15 }}>
              {hasFeeData ? `₹${feeBalance}` : '—'}
            </div>
            {hasFeeData && (
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, color: feeIsDue ? '#fecaca' : '#bbf7d0' }}>
                {feeIsDue ? 'Payment pending' : 'All dues cleared ✓'}
              </div>
            )}
          </div>
          <div style={{
            borderRadius: isMobile ? M3.radiusMd : 12, backgroundColor: 'rgba(255,255,255,0.14)',
            padding: '10px 14px', textAlign: 'center', minWidth: 78,
          }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{attPct !== null ? `${attPct}%` : '—'}</div>
            <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 600 }}>Attendance</div>
          </div>
        </div>
        {feeIsDue && (
          <button
            onClick={() => onGoTab('fees')}
            style={{
              marginTop: 14, borderRadius: 999, border: 'none', backgroundColor: CYAN, color: NAVY,
              fontWeight: 800, padding: '9px 18px', fontSize: 13, cursor: 'pointer',
            }}
          >
            Pay Now →
          </button>
        )}
      </div>

      <SiblingOverview siblings={siblings} activeStudentId={student?.id} onSwitchChild={onSwitchChild} isMobile={isMobile} />

      {dueSoon && !dueBannerDismissed && (
        <div style={{
          borderRadius: isMobile ? M3.radiusMd : 12, border: isMobile ? 'none' : '1px solid #fecaca',
          backgroundColor: isMobile ? '#fbe4e4' : '#fef2f2', padding: isMobile ? 14 : 16,
          marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⏰</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c' }}>Fee due</strong>
            <p style={{ fontSize: 12, color: '#7f1d1d', margin: '4px 0 8px', lineHeight: 1.5 }}>
              {dueSoon.map(d => `${d.label} (₹${d.amount})`).join(' · ')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => onGoTab('fees')}
                style={{ borderRadius: isMobile ? 999 : 8, border: 'none', backgroundColor: '#dc2626', color: 'white', fontWeight: 700, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
              >
                Pay Now
              </button>
              <button
                onClick={() => setDueBannerDismissed(true)}
                style={{ borderRadius: isMobile ? 999 : 8, border: '1px solid #fecaca', backgroundColor: 'transparent', color: '#b91c1c', fontWeight: 700, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Icon grid — Paytm's home-screen convention: a square tile per
          section instead of a menu/list. One tile per TABS entry so every
          section is one tap away from home, not just the 6 that used to
          get a tile. */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 4 : 5}, 1fr)`,
        gap: isMobile ? 10 : 14, marginBottom: 16,
      }}>
        {HOME_TILES.map(t => (
          <button
            key={t.id}
            onClick={() => onGoTab(t.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              border: 'none', background: 'none', cursor: 'pointer', padding: isMobile ? '6px 2px' : '8px 4px',
            }}
          >
            <div style={{
              height: isMobile ? 48 : 56, width: isMobile ? 48 : 56, borderRadius: isMobile ? M3.radiusMd : 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobile ? 22 : 26, backgroundColor: `${t.color}17`,
              boxShadow: isMobile ? M3.elevation1 : '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              {t.icon}
            </div>
            <span style={{ fontSize: isMobile ? 10.5 : 11.5, fontWeight: 700, color: '#334155', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {alertCount !== null && alertCount > 0 && (
        <div
          onClick={() => onGoTab('alerts')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            borderRadius: isMobile ? M3.radiusMd : 12, border: isMobile ? 'none' : '1px solid #fde68a',
            backgroundColor: isMobile ? '#fdf1da' : '#fffbeb', padding: isMobile ? 14 : 16, marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 18 }}>🔔</span>
          <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
            {alertCount} absence{alertCount > 1 ? 's' : ''} in the last 30 days — tap to view
          </div>
        </div>
      )}

      {pushStatus !== 'subscribed' && (
        <div style={isMobile ? {
          borderRadius: M3.radiusMd, border: 'none', backgroundColor: M3.primaryContainer,
          padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        } : {
          borderRadius: 12, border: '1px solid #dbeefc', backgroundColor: '#eef8fe', padding: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
        }}>
          <div>
            <strong style={{ fontSize: 13, fontWeight: 800, color: M3.onPrimaryContainer }}>Turn on notifications</strong>
            <p style={{ fontSize: 12, color: isMobile ? '#3d5372' : '#64748b', marginTop: 4, marginBottom: 0 }}>
              Get notified instantly about new notices, absences and exam results.
            </p>
          </div>
          <button
            style={{
              flexShrink: 0, borderRadius: isMobile ? M3.radiusFull : 8, backgroundColor: NAVY, color: 'white', fontWeight: 700,
              padding: isMobile ? '11px 18px' : '10px 16px', fontSize: 12, border: 'none',
              width: isMobile ? '100%' : 'auto',
              cursor: (pushStatus === 'unsupported' || pushStatus === 'denied') ? 'not-allowed' : 'pointer',
              opacity: (pushStatus === 'unsupported' || pushStatus === 'denied') ? 0.6 : 1,
            }}
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
    hi: { backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' },
    mi: { backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' },
    lo: { backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' },
  };
  return <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700, ...tones[tone] }}>{children}</span>;
}

// ── MY PROFILE TAB ───────────────────────────────────────────────────────────
// Student identity/contact fields (confirmed columns on `students`, per
// Students.jsx: dob, blood_group, father_name, mother_name, address) plus a
// read-only list of student_documents, opened via short-lived signed URLs
// from the "gnsi" storage bucket — same as staff use, no direct/public link.
function ProfileField({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

// Fields a parent is allowed to complete when the office record still has
// them blank. Deliberately narrow — identity/contact fields only, and only
// ones confirmed to exist as plain columns on `students` (Students.jsx).
// Never includes anything already locked-in elsewhere (name, GCC no.,
// course, etc.) — those stay staff-only.
const COMPLETABLE_FIELDS = [
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  { key: 'blood_group', label: 'Blood Group', type: 'text', placeholder: 'e.g. O+' },
  { key: 'father_name', label: "Father's Name", type: 'text' },
  { key: 'mother_name', label: "Mother's Name", type: 'text' },
  { key: 'address', label: 'Address', type: 'textarea' },
];

function CompleteProfileForm({ student, missingFields, onSaveFields }) {
  const [values, setValues] = useState(() => Object.fromEntries(missingFields.map((f) => [f.key, ''])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleChange = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const patch = {};
    missingFields.forEach((f) => {
      const v = (values[f.key] || '').trim();
      if (v) patch[f.key] = v;
    });
    if (Object.keys(patch).length === 0) { setError('Fill in at least one field before saving.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSaveFields(patch);
      setSaved(true);
    } catch (e2) {
      console.error('Profile field save failed:', e2);
      setError(e2?.message || 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Card title="Complete Your Details">
        <Empty icon="✅" text="Saved — thank you for completing this information." />
      </Card>
    );
  }

  return (
    <Card title="Complete Your Details">
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
        These fields are missing from the office record. Fill in what you know — this won't overwrite anything already on file.
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {missingFields.map((f) => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                value={values[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                rows={2}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
            ) : (
              <input
                type={f.type}
                value={values[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                placeholder={f.placeholder || ''}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }}
              />
            )}
          </div>
        ))}
        {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}
        <button
          type="submit"
          disabled={saving}
          style={{ alignSelf: 'flex-start', borderRadius: 8, border: 'none', backgroundColor: NAVY, color: 'white', fontWeight: 700, padding: '9px 18px', fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Card>
  );
}

function ProfileTab({ student, documents, onViewDocument, onSaveFields, isMobile }) {
  const fmtDob = student?.dob ? String(student.dob).slice(0, 10) : '';
  const missingFields = COMPLETABLE_FIELDS.filter((f) => !student?.[f.key]);
  return (
    <div>
      <Card title="Student Details">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 16 }}>
          <ProfileField label="Name" value={student?.name} />
          <ProfileField label="GCC No." value={student?.gcc_no} />
          <ProfileField label="Admission No." value={student?.admission_no} />
          <ProfileField label="Course" value={student?.course} />
          <ProfileField label="Class" value={student?.class_name} />
          <ProfileField label="Batch" value={student?.batch} />
          <ProfileField label="Hostel Type" value={student?.hostel_type} />
          <ProfileField label="Status" value={student?.status} />
          <ProfileField label="Date of Birth" value={fmtDob} />
          <ProfileField label="Blood Group" value={student?.blood_group} />
          <ProfileField label="Father's Name" value={student?.father_name} />
          <ProfileField label="Mother's Name" value={student?.mother_name} />
          <ProfileField label="Address" value={student?.address} />
        </div>
      </Card>
      {missingFields.length > 0 && (
        <CompleteProfileForm student={student} missingFields={missingFields} onSaveFields={onSaveFields} />
      )}
      <Card title="Documents">
        {(documents.status === 'loading' || documents.status === 'idle') && <Loading />}
        {documents.status === 'error' && <Empty icon="⚠️" text={documents.error} />}
        {documents.status === 'ready' && (
          documents.data.length === 0 ? (
            <Empty icon="📄" text="No documents on file" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {documents.data.map((d, i) => (
                <div
                  key={d.id || i}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc', padding: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{d.doc_type || 'Document'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.file_name}{d.created_at ? ` · ${(d.created_at || '').slice(0, 10)}` : ''}</div>
                  </div>
                  <button
                    onClick={() => onViewDocument(d.storage_path)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: 'white', color: NAVY, fontWeight: 700, padding: '6px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    👁️ View
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </Card>
    </div>
  );
}

function AttendanceTab({ state, isMobile }) {
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
        right={<span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8', fontWeight: 700 }}>{monthLabel}</span>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 4 : 6, marginBottom: isMobile ? 16 : 20 }}>
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const dd = String(d).padStart(2, '0');
            const st = byDate[dd];
            const style = st === 'Present'
              ? { backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }
              : st === 'Absent'
              ? { backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }
              : st === 'Late'
              ? { backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
              : st === 'Leave'
              ? { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }
              : { backgroundColor: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' };
            return (
              <div
                key={d}
                title={`${y}-${m}-${dd}`}
                style={{ aspectRatio: '1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 10 : 12, fontWeight: 700, ...style }}
              >
                {d}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 8 : 12 }}>
          <div style={{ borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #bbf7d0', backgroundColor: isMobile ? '#e3f6e9' : '#f0fdf4', padding: isMobile ? 10 : 12, textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: isMobile ? 16 : 18, fontWeight: 800, color: '#16a34a' }}>{present}</strong>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', fontWeight: 700 }}>Present</span>
          </div>
          <div style={{ borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #fecaca', backgroundColor: isMobile ? '#fbe4e4' : '#fef2f2', padding: isMobile ? 10 : 12, textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: isMobile ? 16 : 18, fontWeight: 800, color: '#dc2626' }}>{absent}</strong>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', fontWeight: 700 }}>Absent</span>
          </div>
          <div style={{ borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #fde68a', backgroundColor: isMobile ? '#fdf1da' : '#fffbeb', padding: isMobile ? 10 : 12, textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: isMobile ? 16 : 18, fontWeight: 800, color: '#d97706' }}>{pct}%</strong>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', fontWeight: 700 }}>Rate</span>
          </div>
        </div>
      </Card>
      <Card title="Last 10 Days">
        {last10.length ? (
          <PremiumTable head={['Date', 'Status']}>
            {last10.map((r, i) => (
              <tr key={i} style={{ borderTop: i ? '1px solid #f1f5f9' : 'none' }}>
                <td style={{ padding: '10px 12px', color: '#475569' }}>{r.date}</td>
                <td style={{ padding: '10px 12px' }}><Pill tone={r.status === 'Present' ? 'hi' : r.status === 'Absent' ? 'lo' : 'mi'}>{r.status}</Pill></td>
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

// Groups flat exam-mark rows by exam (name + date) so each exam gets its
// own compact subject/marks table instead of repeating the exam name on
// every row — the repeated long names (e.g. "1st Monthly Test of
// September") were what forced the old single-table layout to wrap onto
// several lines per row on narrow screens.
function groupExamRows(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.examName}__${r.exam_date || ''}`;
    if (!groups.has(key)) groups.set(key, { examName: r.examName, exam_date: r.exam_date, rows: [] });
    groups.get(key).rows.push(r);
  }
  return [...groups.values()];
}

// Groups the flat exam_marks rows by subject (across all exams), sorted by
// date, for the trend chart — a different cut of the same `state.data`
// groupExamRows above groups by exam.
function groupBySubject(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (r.pct === null || r.pct === undefined) continue; // ungraded rows can't plot
    const key = r.subject || 'Unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || ''));
  }
  return [...groups.entries()]
    .map(([subject, points]) => ({ subject, points }))
    .filter(g => g.points.length >= 2) // a single point isn't a "trend"
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

// Pure-SVG line chart — no charting library dependency. Plots % score over
// exams for one subject; a flat/rising/falling line is exactly what a
// parent needs to see at a glance, more than the underlying numbers.
function SubjectTrendLine({ subject, points, isMobile }) {
  const w = isMobile ? 280 : 420;
  const h = 90;
  const padX = 8;
  const padY = 14;
  const n = points.length;
  const xAt = (i) => n === 1 ? w / 2 : padX + (i * (w - padX * 2)) / (n - 1);
  const yAt = (pct) => padY + (1 - Math.max(0, Math.min(100, pct)) / 100) * (h - padY * 2);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.pct).toFixed(1)}`).join(' ');
  const first = points[0].pct;
  const last = points[points.length - 1].pct;
  const delta = last - first;
  const trendColor = delta > 2 ? '#16a34a' : delta < -2 ? '#dc2626' : '#94a3b8';
  const trendLabel = delta > 2 ? `▲ +${delta}%` : delta < -2 ? `▼ ${delta}%` : '— steady';

  return (
    <div style={{
      borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #e2e8f0',
      backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc', padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{subject}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: trendColor }}>{trendLabel}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
        {[25, 50, 75].map(g => (
          <line key={g} x1={0} x2={w} y1={yAt(g)} y2={yAt(g)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,3" />
        ))}
        <path d={pathD} fill="none" stroke={NAVY} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={xAt(i)} cy={yAt(p.pct)} r={3} fill={NAVY}>
            <title>{`${p.examName || 'Exam'} (${(p.exam_date || '').slice(0, 10)}): ${p.pct}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function ExamsTab({ state }) {
  const isMobile = useWindowWidth() < 640;
  const groups = state.status === 'ready' ? groupExamRows(state.data) : [];
  const trends = state.status === 'ready' ? groupBySubject(state.data) : [];

  return (
    <div>
      {(state.status === 'loading' || state.status === 'idle') && <Card title="Exam Results"><Loading /></Card>}
      {state.status === 'error' && <Card title="Exam Results"><Empty icon="⚠️" text={state.error} /></Card>}
      {state.status === 'ready' && (
        groups.length === 0 ? (
          <Card title="Exam Results"><Empty icon="📝" text="No results yet" /></Card>
        ) : (
          <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              onClick={() => downloadIcs('gnsi-exam-dates.ics', groups.filter(g => g.exam_date).map((g, i) => ({
                uid: `exam-${g.examName}-${g.exam_date}-${i}`,
                title: g.examName,
                date: g.exam_date,
                description: `GNSI exam: ${g.examName}`,
              })))}
              style={{ borderRadius: isMobile ? 999 : 8, border: '1px solid #e2e8f0', backgroundColor: 'white', color: NAVY, fontWeight: 700, padding: '7px 12px', fontSize: 11, cursor: 'pointer' }}
            >
              📅 Add to Calendar
            </button>
          </div>
          {trends.length > 0 && (
            <Card title="Performance Trend" right={<span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94a3b8', fontWeight: 700 }}>Across all exams</span>}>
              {trends.map((t, i) => (
                <SubjectTrendLine key={i} subject={t.subject} points={t.points} isMobile={isMobile} />
              ))}
            </Card>
          )}
          {groups.map((g, gi) => (
            <Card
              key={gi}
              title={g.examName}
              right={<span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94a3b8', fontWeight: 700 }}>{g.exam_date ? g.exam_date.slice(0, 10) : '—'}</span>}
            >
              <PremiumTable head={['Subject', 'Marks']} align={['left', 'right']}>
                {g.rows.map((r, i) => {
                  const tone = r.pct === null ? 'mi' : r.pct >= 75 ? 'hi' : r.pct >= 50 ? 'mi' : 'lo';
                  const marksStr = r.hasMarks ? (r.total !== null ? `${r.marks_obtained}/${r.total}` : r.marks_obtained) : 'Not graded';
                  return (
                    <tr key={i} style={{ borderTop: i ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', color: '#475569', fontWeight: 600 }}>{r.subject || '—'}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'right' }}><Pill tone={tone}>{marksStr}</Pill></td>
                    </tr>
                  );
                })}
              </PremiumTable>
            </Card>
          ))}
          </>
        )
      )}
    </div>
  );
}

function ReportCardTab({ examTypes, selectedType, onTypeChange, dates, selectedDate, onDateChange, onPrint, printBusy, isMobile }) {
  const canPrint = selectedType && selectedDate && !printBusy;
  const selectStyle = isMobile
    ? { width: '100%', borderRadius: 16, border: 'none', backgroundColor: '#eef1f7', color: '#1e293b', fontSize: 13, padding: '12px 14px', outline: 'none', boxSizing: 'border-box' }
    : { width: '100%', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#1e293b', fontSize: 13, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' };
  return (
    <Card title="Report Card">
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>Exam</label>
          <select style={selectStyle} value={selectedType} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="">
              {examTypes.status === 'loading' ? 'Loading…' : examTypes.status === 'empty' ? '— No exams recorded —' : examTypes.status === 'error' ? '— Error loading exams —' : 'Select exam…'}
            </option>
            {examTypes.options.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>Date</label>
          <select style={selectStyle} value={selectedDate} onChange={(e) => onDateChange(e.target.value)}>
            <option value="">
              {dates.status === 'loading' ? 'Loading…' : dates.status === 'empty' ? '— No dates —' : dates.status === 'error' ? '— Error —' : '—'}
            </option>
            {dates.options.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 18, lineHeight: 1.6 }}>
        Pick an exam and date, then view or print an official report card showing subject-wise marks, grade and class rank.
      </p>
      <button
        style={{
          borderRadius: isMobile ? 999 : 10, backgroundColor: NAVY, color: 'white', fontWeight: 700,
          padding: isMobile ? '13px 20px' : '12px 20px', fontSize: 13, border: 'none',
          width: isMobile ? '100%' : 'auto',
          cursor: canPrint ? 'pointer' : 'not-allowed', opacity: canPrint ? 1 : 0.5,
        }}
        onClick={onPrint}
        disabled={!canPrint}
      >
        {printBusy ? '⏳ Preparing…' : '🖨️ View / Print Report Card'}
      </button>
    </Card>
  );
}

// ── FEATURE 1: FEE DUES TAB ──────────────────────────────────────────────────
function FeesTab({ state, onPayNow, nextDue, isMobile, student }) {
  return (
    <Card title="Fee Summary">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        <>
          {state.data.failedSources?.length > 0 && (
            <div style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #fde68a', backgroundColor: '#fffbeb', padding: '12px 16px', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
              ⚠️ Some fee data could not be loaded just now. The figures below may understate what's actually due — please refresh, or contact the office to confirm the exact balance.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 8 : 12, marginBottom: 16 }}>
            <div style={{ borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #bbf7d0', backgroundColor: isMobile ? '#e3f6e9' : '#f0fdf4', padding: isMobile ? 12 : 16, textAlign: 'center' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>Total Paid</div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: '#16a34a' }}>₹{state.data.totalPaid ?? 0}</div>
            </div>
            <div style={{
              borderRadius: isMobile ? 16 : 10,
              border: isMobile ? 'none' : `1px solid ${(state.data.totalDue ?? 0) > 0 ? '#fecaca' : '#bbf7d0'}`,
              backgroundColor: isMobile
                ? ((state.data.totalDue ?? 0) > 0 ? '#fbe4e4' : '#e3f6e9')
                : ((state.data.totalDue ?? 0) > 0 ? '#fef2f2' : '#f0fdf4'),
              padding: isMobile ? 12 : 16, textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>Total Due</div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: (state.data.totalDue ?? 0) > 0 ? '#dc2626' : '#16a34a' }}>
                ₹{state.data.totalDue ?? 0}
              </div>
            </div>
          </div>

          {state.data.monthsOverdue > 0 && (
            <p style={{ fontSize: 12, color: '#d97706', marginBottom: 16, fontWeight: 600 }}>
              {state.data.monthsOverdue} month{state.data.monthsOverdue === 1 ? '' : 's'} overdue across flat/course fee.
            </p>
          )}

          {nextDue && (
            <button
              style={{
                width: '100%', borderRadius: isMobile ? 999 : 10, backgroundColor: NAVY, color: 'white', fontWeight: 700,
                padding: isMobile ? '13px 20px' : '12px 20px', fontSize: 13, border: 'none', cursor: 'pointer', marginBottom: 20,
              }}
              onClick={onPayNow}
            >
              💳 Pay {nextDue.kind === 'admission' ? 'Admission Fee' : `${nextDue.kind === 'flat' ? 'Flat' : 'Course'} Fee — ${nextDue.for_month} ${nextDue.year}`} (₹{nextDue.amount}) Online
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
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
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12 }}>Payment History</div>
            {(state.data.history || []).length ? (
              <PremiumTable head={['Date', 'Type', 'Mode', 'Amount', '']}>
                {(state.data.history || []).map((r, i) => (
                  <tr key={i} style={{ borderTop: i ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{(r.date || '').slice(0, 10) || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{r.type || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{r.mode || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>₹{r.amount ?? 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => printFeeReceipt(student, r)}
                        style={{
                          borderRadius: isMobile ? 999 : 7, border: `1.5px solid ${NAVY}`, background: 'white', color: NAVY,
                          fontSize: 11, fontWeight: 700, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        🖨️ Receipt
                      </button>
                    </td>
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
  const isMobile = useWindowWidth() < 640;
  const negative = !paid && due > 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      borderRadius: isMobile ? 16 : 10,
      border: isMobile ? 'none' : '1px solid #e2e8f0',
      backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc',
      padding: '12px 16px',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{detail}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, flexShrink: 0, color: negative ? '#dc2626' : '#16a34a' }}>
        {paid ? '✓ Paid' : due > 0 ? `₹${due} due` : '—'}
      </div>
    </div>
  );
}

function FeeMonthsBreakdown({ label, items, due }) {
  const isMobile = useWindowWidth() < 640;
  const list = items || [];
  const unpaid = list.filter(i => !i.paid);
  const negative = (due ?? 0) > 0;
  return (
    <div style={{
      borderRadius: isMobile ? 16 : 10,
      border: isMobile ? 'none' : '1px solid #e2e8f0',
      backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc',
      padding: '12px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 800, flexShrink: 0, color: negative ? '#dc2626' : '#16a34a' }}>
          {negative ? `₹${due} due` : '✓ Up to date'}
        </div>
      </div>
      {unpaid.length > 0 && (
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
          Unpaid: {unpaid.map(i => `${i.month} ${i.year}`).join(', ')}
        </div>
      )}
    </div>
  );
}

const LEAVE_TYPES = ['Home Visit', 'Medical', 'Family Emergency', 'Other'];

// New leave request form. Writes only the columns Hostel.jsx's own queries
// have confirmed exist on leave_records (see loadLeave's comment above):
// student_id, student_name, leave_type, from_date, to_date, status. `reason`
// is included too since LeaveTab already reads it back for display, but if
// that column turns out not to exist this insert will error — same
// unconfirmed-column caveat the read side already carries.
function LeaveRequestForm({ studentId, studentName, onSubmitted }) {
  const isMobile = useWindowWidth() < 640;
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  const inputStyle = isMobile
    ? { width: '100%', borderRadius: 16, border: 'none', backgroundColor: '#eef1f7', padding: '13px 14px', fontSize: 13, color: '#1e293b', outline: 'none', boxSizing: 'border-box' }
    : { width: '100%', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', padding: '11px 14px', fontSize: 13, color: '#1e293b', outline: 'none', boxSizing: 'border-box' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromDate || !toDate) { setError('Please select both dates.'); return; }
    if (toDate < fromDate) { setError('Return date must be on or after the leave start date.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('leave_records').insert({
        student_id: studentId,
        student_name: studentName || null,
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim() || null,
        status: 'Pending',
      });
      if (insertError) throw insertError;
      setJustSubmitted(true);
      setFromDate(''); setToDate(''); setReason('');
      onSubmitted?.();
    } catch (err) {
      console.error('Leave request submit error:', err);
      setError('Something went wrong. Please try again or contact the hostel office directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Request Leave">
      {justSubmitted && (
        <div style={{ marginBottom: 16, borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #bbf7d0', backgroundColor: isMobile ? '#e3f6e9' : '#f0fdf4', padding: '12px 16px', fontSize: 13, color: '#166534' }}>
          ✓ Leave request submitted — the hostel office will review it.
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 16, borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #fecaca', backgroundColor: isMobile ? '#fbe4e4' : '#fef2f2', padding: '12px 16px', fontSize: 13, color: '#b91c1c' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>Leave Type</label>
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
          {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>Reason (optional)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} style={{ ...inputStyle, marginBottom: 16, resize: 'vertical', fontFamily: 'inherit' }} />

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', borderRadius: isMobile ? 999 : 10, backgroundColor: NAVY, color: 'white', fontWeight: 700,
            padding: isMobile ? '13px 20px' : '12px 20px', fontSize: 13, border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Leave Request'}
        </button>
      </form>
    </Card>
  );
}

function LeaveTab({ state, studentId, studentName, onSubmitted }) {
  const isMobile = useWindowWidth() < 640;
  // Hostel.jsx's real leave_records statuses are capitalized (Approved,
  // Pending, Rejected) — not the lowercase guesses this used to key off.
  const stTone = { Approved: 'hi', Rejected: 'lo', Pending: 'mi' };
  return (
    <div>
      <LeaveRequestForm studentId={studentId} studentName={studentName} onSubmitted={onSubmitted} />
      <Card
        title="Hostel Leave History"
        right={
          state.status === 'ready' && state.data.some(r => r.status === 'Approved') ? (
            <button
              onClick={() => downloadIcs('gnsi-approved-leave.ics', state.data.filter(r => r.status === 'Approved').map((r, i) => {
                // .ics all-day DTEND is exclusive, so add one day past to_date
                // to cover the full leave span inclusively.
                const end = new Date(`${r.to_date}T00:00:00`);
                end.setDate(end.getDate() + 1);
                const endStr = end.toISOString().slice(0, 10);
                return {
                  uid: `leave-${r.id || i}-${r.from_date}`,
                  title: `Hostel Leave${r.leave_type ? ` — ${r.leave_type}` : ''}`,
                  date: r.from_date,
                  endDate: endStr,
                  description: r.reason || '',
                };
              }))}
              style={{ borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: 'white', color: NAVY, fontWeight: 700, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              📅 Add to Calendar
            </button>
          ) : null
        }
      >
        {(state.status === 'loading' || state.status === 'idle') && <Loading />}
        {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
        {state.status === 'ready' && (
          state.data.length === 0 ? (
            <Empty icon="🏨" text="No leave history" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {state.data.map((r, i) => (
                <div style={{
                  borderRadius: isMobile ? 16 : 10,
                  border: isMobile ? 'none' : '1px solid #e2e8f0',
                  backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc',
                  padding: 16,
                }} key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{r.from_date} → {r.to_date}</span>
                    <Pill tone={stTone[r.status] || 'mi'}>{r.status || 'Pending'}</Pill>
                  </div>
                  {r.leave_type && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{r.leave_type}</div>
                  )}
                  <div style={{ fontSize: 12, color: '#64748b' }}>{r.reason || '—'}</div>
                </div>
              ))}
            </div>
          )
        )}
      </Card>
      <ReceptionLeaveApplications studentName={studentName} />
    </div>
  );
}

// Gate-pass leave applications filed at Reception (Reception.jsx's own
// `leave_applications` table) — a separate workflow from the Hostel Leave
// History above (`leave_records`, Hostel.jsx). This one carries the actual
// approval trail: who printed it, who reviewed it, and the linked gate pass,
// so it's shown read-only here rather than merged with the hostel history,
// which would blur two different tables/statuses together.
const RLA_STATUS_TONE = { Approved: 'hi', Rejected: 'lo', Pending: 'mi' };

function ReceptionLeaveApplications({ studentName }) {
  const isMobile = useWindowWidth() < 640;
  const [state, setState] = useState(initialTabState);

  useEffect(() => {
    if (!studentName) return;
    let cancelled = false;
    (async () => {
      setState({ status: 'loading', data: null, error: null });
      try {
        const { data, error } = await supabase
          .from('leave_applications')
          .select('*')
          .eq('student_name', studentName)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        if (!cancelled) setState({ status: 'ready', data: data || [], error: null });
      } catch (e) {
        console.error('Reception leave applications load failed:', e);
        if (!cancelled) setState({ status: 'error', data: null, error: 'Failed to load leave applications' });
      }
    })();
    return () => { cancelled = true; };
  }, [studentName]);

  if (state.status === 'idle') return null;

  return (
    <Card title="Gate-Pass Leave Applications (Reception)">
      {(state.status === 'loading') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="🚪" text="No gate-pass leave applications filed at Reception" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.data.map((a, i) => (
              <div style={{
                borderRadius: isMobile ? 16 : 10,
                border: isMobile ? 'none' : '1px solid #e2e8f0',
                backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc',
                padding: 16,
              }} key={a.id || i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{a.from_date} → {a.to_date}</span>
                  <Pill tone={RLA_STATUS_TONE[a.status] || 'mi'}>{a.status || 'Pending'}</Pill>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{a.reason || '—'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#94a3b8' }}>
                  <span>Submitted by {a.submitted_by || '—'}{a.created_at ? ` · ${(a.created_at || '').slice(0, 10)}` : ''}</span>
                  {a.printed_at && (
                    <span>🖨️ Printed{a.printed_by ? ` by ${a.printed_by}` : ''} · {(a.printed_at || '').slice(0, 10)}</span>
                  )}
                  {a.status === 'Approved' && a.reviewed_by && (
                    <span>✅ Approved by {a.reviewed_by}{a.reviewer_role ? ` (${a.reviewer_role})` : ''}{a.reviewed_at ? ` · ${(a.reviewed_at || '').slice(0, 10)}` : ''}</span>
                  )}
                  {a.status === 'Approved' && a.gate_pass_id && (
                    <span>🎫 Gate pass issued</span>
                  )}
                  {a.status === 'Rejected' && (
                    <span>❌ Rejected by {a.reviewed_by || '—'}{a.reviewer_role ? ` (${a.reviewer_role})` : ''}{a.reviewed_at ? ` · ${(a.reviewed_at || '').slice(0, 10)}` : ''}</span>
                  )}
                  {a.status === 'Rejected' && a.rejection_reason && (
                    <span>Reason: {a.rejection_reason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

// ── PARENT ITEMS TAB ─────────────────────────────────────────────────────────
// Read-only view of items parents/guardians drop off at Reception for the
// student (reception_parent_items — Reception.jsx's Parent Items tab).
// Status lifecycle: Pending → Delivered/Returned (set by Reception staff via
// canTransition; this view has no write actions, it only reflects status).
const PI_STATUS_TONE = { Delivered: 'hi', Returned: 'hi', Pending: 'mi' };

function ParentItemsTab({ studentName }) {
  const isMobile = useWindowWidth() < 640;
  const [state, setState] = useState(initialTabState);

  useEffect(() => {
    if (!studentName) return;
    let cancelled = false;
    (async () => {
      setState({ status: 'loading', data: null, error: null });
      try {
        const { data, error } = await supabase
          .from('reception_parent_items')
          .select('*')
          .eq('student_name', studentName)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setState({ status: 'ready', data: data || [], error: null });
      } catch (e) {
        console.error('Parent items load failed:', e);
        if (!cancelled) setState({ status: 'error', data: null, error: 'Failed to load parent items' });
      }
    })();
    return () => { cancelled = true; };
  }, [studentName]);

  return (
    <Card title="Items Dropped Off at Reception">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="🎒" text="No items recorded at Reception" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.data.map((it, i) => (
              <div style={{
                borderRadius: isMobile ? 16 : 10,
                border: isMobile ? 'none' : '1px solid #e2e8f0',
                backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc',
                padding: 16,
              }} key={it.id || i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{it.item_name || 'Item'}{it.quantity ? ` × ${it.quantity}` : ''}</span>
                  <Pill tone={PI_STATUS_TONE[it.status] || 'mi'}>{it.status || 'Pending'}</Pill>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                  {it.parent_name ? `From ${it.parent_name}` : ''}{it.received_date ? ` · ${it.received_date}` : ''}{it.received_by ? ` · Received by ${it.received_by}` : ''}
                </div>
                {it.remarks && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>{it.remarks}</div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

// ── STORE PURCHASES TAB ──────────────────────────────────────────────────────
// GNSI Store (StorePublic.jsx) is a separate, no-login storefront — orders
// aren't linked to a students.id, only to whatever phone number the parent
// typed in at checkout. The only confirmed lookup path is the same RPC the
// storefront's own "Track my order" modal uses: store_lookup_orders(p_phone,
// p_order_no). So this reuses resolveGuardianColumn() (already used for
// sibling lookup above) to find whichever phone-ish column actually exists
// on `students`, reads that value for the logged-in student, and looks up
// orders against it — no guessed GCC-based RPC parameter, since the RPC's
// real signature isn't visible from here.
const STORE_STATUS_LABEL = { new: 'Order received', confirmed: 'Confirmed', ready: 'Ready for pickup', delivered: 'Delivered / collected', cancelled: 'Cancelled' };
const STORE_STATUS_TONE = { new: 'mi', confirmed: 'mi', ready: 'mi', delivered: 'hi', cancelled: 'lo' };
const storeCurrency = (v) => Number(v || 0).toLocaleString('en-IN');

function StorePurchasesTab({ student }) {
  const isMobile = useWindowWidth() < 640;
  const [state, setState] = useState({ status: 'idle', data: null, error: null, phone: null });

  useEffect(() => {
    if (!student?.id) return;
    let cancelled = false;
    (async () => {
      setState({ status: 'loading', data: null, error: null, phone: null });
      try {
        const col = await resolveGuardianColumn(student.id);
        if (!col) {
          if (!cancelled) setState({ status: 'ready', data: [], error: null, phone: null });
          return;
        }
        const { data: row } = await supabase.from('students').select(col).eq('id', student.id).maybeSingle();
        const phone = row?.[col];
        if (!phone) {
          if (!cancelled) setState({ status: 'ready', data: [], error: null, phone: null });
          return;
        }
        const { data, error } = await supabase.rpc('store_lookup_orders', { p_phone: phone, p_order_no: null });
        if (error) throw error;
        if (!cancelled) setState({ status: 'ready', data: data || [], error: null, phone });
      } catch (e) {
        console.error('Store purchases load failed:', e);
        if (!cancelled) setState({ status: 'error', data: null, error: 'Failed to load store purchases', phone: null });
      }
    })();
    return () => { cancelled = true; };
  }, [student?.id]);

  return (
    <Card title="GNSI Store Purchases">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        !state.phone ? (
          <Empty icon="🛒" text="No phone number on file to match store orders — orders placed at guidancekhangabok.in/store are looked up by the phone number used at checkout." />
        ) : state.data.length === 0 ? (
          <Empty icon="🛒" text="No store orders found for this number" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.data.map((o, i) => (
              <div style={{
                borderRadius: isMobile ? 16 : 10,
                border: isMobile ? 'none' : '1px solid #e2e8f0',
                backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc',
                padding: 16,
              }} key={o.id || i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{o.order_no}</span>
                  <Pill tone={STORE_STATUS_TONE[o.status] || 'mi'}>{STORE_STATUS_LABEL[o.status] || o.status}</Pill>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                  {o.created_at ? new Date(o.created_at).toLocaleString('en-IN') : ''}
                </div>
                {Array.isArray(o.items) && o.items.length > 0 && (
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                    {o.items.map((it, idx) => (
                      <div key={idx}>{it.name || 'Item'}{it.qty ? ` × ${it.qty}` : ''}</div>
                    ))}
                  </div>
                )}
                {o.total != null && (
                  <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Total ₹{storeCurrency(o.total)}</div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

// ── RAISE A CONCERN (Grievance) TAB ──────────────────────────────────────────
// Wired to the real `grievances` table (confirmed via the admin-side
// Grievances.jsx: student_id, teacher_id, subject, category, description,
// source, filed_by_name, filed_by_contact, status). Source is tagged
// 'parent_portal' so staff can triage it separately from admin-logged ones.
const GRIEVANCE_CATEGORIES = [
  'Academic Weakness',
  'Behavioral',
  'Communication',
  'Attendance Handling',
  'Discipline',
  'Other',
];

// Status tracking list — reads back past grievances by student_id so a
// parent can see where things stand on a return visit, not just the
// one-time "recorded" message right after submitting. No reply/thread
// table is confirmed to exist for `grievances` (unlike Reception's
// reception_complaints + complaint_updates pair), so this shows status
// only — not fabricated staff replies.
const GRV_STATUS_TONE = { Open: 'mi', 'In Progress': 'mi', Resolved: 'hi', Closed: 'hi', Rejected: 'lo' };

function PastGrievances({ studentId, refreshKey }) {
  const isMobile = useWindowWidth() < 640;
  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      setState({ status: 'loading', data: null, error: null });
      try {
        const { data, error } = await supabase
          .from('grievances')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        if (!cancelled) setState({ status: 'ready', data: data || [], error: null });
      } catch (e) {
        console.error('Past grievances load failed:', e);
        if (!cancelled) setState({ status: 'error', data: null, error: 'Failed to load past concerns' });
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, refreshKey]);

  if (state.status === 'idle') return null;

  return (
    <Card title="Past Concerns">
      {(state.status === 'loading') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="📮" text="No concerns raised yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.data.map((g, i) => (
              <div style={{
                borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #e2e8f0',
                backgroundColor: isMobile ? M3.surfaceContainer : '#f8fafc', padding: 16,
              }} key={g.id || i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{g.category || g.subject || 'Concern'}</span>
                  <Pill tone={GRV_STATUS_TONE[g.status] || 'mi'}>{g.status || 'Open'}</Pill>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{g.description}</div>
                {g.created_at && (
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{(g.created_at || '').slice(0, 10)}</div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

function GrievanceTab({ studentId, studentName, done, onSubmitted, isMobile }) {
  const [category, setCategory] = useState('Academic Weakness');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Bumped on every successful submit so PastGrievances re-fetches and picks
  // up the just-filed concern without a full page reload.
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) { setError('Please describe your concern.'); return; }
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('grievances').insert({
        student_id: studentId || null,
        subject: category,
        category,
        description: description.trim(),
        source: 'parent_portal',
        filed_by_name: name.trim(),
        filed_by_contact: contact.trim() || null,
        status: 'Open',
      });
      if (insertError) throw insertError;
      setRefreshKey(k => k + 1);
      onSubmitted?.();
    } catch (err) {
      console.error('Parent grievance submit error:', err);
      setError('Something went wrong. Please try again or contact the office directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = isMobile
    ? { width: '100%', borderRadius: 16, border: 'none', backgroundColor: '#eef1f7', padding: '13px 14px', fontSize: 13, color: '#1e293b', outline: 'none', boxSizing: 'border-box' }
    : { width: '100%', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', padding: '11px 14px', fontSize: 13, color: '#1e293b', outline: 'none', boxSizing: 'border-box' };

  return (
    <div>
      {done ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <h3 style={{ margin: '0 0 6px', color: NAVY, fontSize: 16 }}>Your concern has been recorded</h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
              A staff member will review this and follow up with you shortly.
            </p>
          </div>
        </Card>
      ) : (
        <Card title="Raise a Concern">
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 18 }}>
            {studentName ? `Regarding: ${studentName}` : "Tell us what's on your mind — we take every concern seriously."}
          </p>
          {error && (
            <div style={{ marginBottom: 16, borderRadius: isMobile ? 16 : 10, border: isMobile ? 'none' : '1px solid #fecaca', backgroundColor: isMobile ? '#fbe4e4' : '#fef2f2', padding: '12px 16px', fontSize: 13, color: '#b91c1c' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
              {GRIEVANCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>Describe your concern</label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. My daughter seems to be struggling with Mathematics and I'd like to understand what support is available…"
              style={{ ...inputStyle, marginBottom: 14, resize: 'vertical' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>Your Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 6 }}>Phone / Email (optional)</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', borderRadius: isMobile ? 999 : 10, backgroundColor: NAVY, color: 'white', fontWeight: 700,
                padding: isMobile ? '15px 0' : '13px 0', border: 'none', fontSize: 14,
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit Concern'}
            </button>
          </form>
        </Card>
      )}
      <PastGrievances studentId={studentId} refreshKey={refreshKey} />
    </div>
  );
}

// Grid of every public landing-page section, grouped the same way the
// landing page's own hamburger menu groups them — lets a logged-in parent
// jump straight to Notices, Syllabus, Gallery, etc. without leaving the
// portal to go hunting through the public site's nav. onNavigate closes the
// portal and sets the hash; LandingPage.jsx's own hashchange listener does
// the actual tab switch, so this component has no routing logic of its own.
function SiteLinksTab({ isMobile, onNavigate }) {
  return (
    <>
      {SITE_LINK_GROUPS.map((group) => (
        <Card key={group.heading} title={group.heading}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {group.links.map((link) => (
              <button
                key={link.href}
                onClick={() => onNavigate(link.href)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  borderRadius: isMobile ? 16 : 10,
                  border: isMobile ? 'none' : '1px solid #e2e8f0',
                  backgroundColor: isMobile ? '#eef1f7' : '#f8fafc',
                  padding: isMobile ? '12px 14px' : '11px 14px',
                  fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{link.icon}</span>
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

function AlertsTab({ state }) {
  const isMobile = useWindowWidth() < 640;
  return (
    <Card title="Recent Alerts">
      {(state.status === 'loading' || state.status === 'idle') && <Loading />}
      {state.status === 'error' && <Empty icon="⚠️" text={state.error} />}
      {state.status === 'ready' && (
        state.data.length === 0 ? (
          <Empty icon="✅" text="No alerts — all good!" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state.data.map((a, i) => (
              <div
                key={i}
                style={{
                  borderRadius: isMobile ? 16 : 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  border: isMobile ? 'none' : `1px solid ${a.type === 'exam' ? '#fecaca' : '#fde68a'}`,
                  backgroundColor: isMobile
                    ? (a.type === 'exam' ? '#fbe4e4' : '#fdf1da')
                    : (a.type === 'exam' ? '#fef2f2' : '#fffbeb'),
                }}
              >
                <div style={{ fontSize: 13, color: '#1e293b' }}>{a.msg}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{a.date ? a.date.slice(0, 10) : ''}</div>
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}