// ─── ToppersCertificate.jsx ───────────────────────────────────────────────────
// Drop this file into src/ and import in Exams.jsx:
//   import ToppersCertificate from './ToppersCertificate'
// Add to TAB_GROUPS under Documents:
//   { id: "toppers", icon: "🏅", label: "Certificates", tip: "Print topper certificates" }
// Add to sectionMap:
//   toppers: <ToppersCertificate courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} />

import { useState, useEffect } from "react";
import { supabase } from './supabase';

// ─── Helpers (inline so this file is self-contained) ─────────────────────────
const COURSE_MAX_MARKS = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
};
function getCourseMax(course) {
  const m = COURSE_MAX_MARKS[course] || {};
  const t = Object.values(m).reduce((s, v) => s + v, 0);
  return t || 100;
}

const css = {
  btn:   { padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  input: { padding: "7px 11px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", color: "#111827", fontFamily: "'DM Sans',sans-serif" },
  card:  { background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
};

const RANK_COLORS = [
  { bg: "linear-gradient(135deg,#B8860B,#f0c040,#B8860B)", text: "#7A5800", light: "#FEF9E7", border: "#f0c040", medal: "🥇", ordinal: "1st", label: "FIRST" },
  { bg: "linear-gradient(135deg,#94A3B8,#CBD5E1,#94A3B8)", text: "#475569", light: "#F1F5F9", border: "#CBD5E1", medal: "🥈", ordinal: "2nd", label: "SECOND" },
  { bg: "linear-gradient(135deg,#CD7F32,#E8A96A,#CD7F32)", text: "#7C3F00", light: "#FEF3E7", border: "#E8A96A", medal: "🥉", ordinal: "3rd", label: "THIRD" },
];

// ─── Certificate HTML generator ───────────────────────────────────────────────
function buildCertificateHTML(student, rank, total, courseMax, pct, examName, examDate, course, institute, academicYear) {
  const rc = RANK_COLORS[rank - 1];
  const suffix = rank === 1 ? "st" : rank === 2 ? "nd" : "rd";

  return `
  <div class="cert-page">
    <div class="cert-outer">
      <!-- Decorative corner pieces -->
      <div class="corner tl"></div>
      <div class="corner tr"></div>
      <div class="corner bl"></div>
      <div class="corner br"></div>

      <!-- Watermark -->
      <div class="watermark">GNSI</div>

      <!-- Top ribbon -->
      <div class="top-ribbon" style="background:${rc.bg}">
        <div class="ribbon-text">CERTIFICATE OF EXCELLENCE</div>
      </div>

      <!-- Header -->
      <div class="cert-header">
        <div class="logo-area">
          ${institute.logoUrl
            ? `<img src="${institute.logoUrl}" class="logo-img" />`
            : `<div class="logo-placeholder">GNSI</div>`}
        </div>
        <div class="inst-info">
          <div class="inst-name">${institute.name || "Guidance Navodaya & Sainik Institute"}</div>
          <div class="inst-addr">${institute.address || "Khangabok, Thoubal, Manipur"}</div>
          <div class="inst-tag">${institute.tagline || "Excellence in Education"}</div>
        </div>
        <div class="medal-area">
          <div class="medal-circle" style="background:${rc.bg};border-color:${rc.border}">
            <div class="medal-emoji">${rc.medal}</div>
            <div class="medal-rank">${rc.label}</div>
          </div>
        </div>
      </div>

      <!-- Gold divider -->
      <div class="divider">
        <div class="divider-line"></div>
        <div class="divider-gem">◆</div>
        <div class="divider-line"></div>
      </div>

      <!-- Body -->
      <div class="cert-body">
        <div class="presents">This is to certify that</div>

        <div class="student-name">${student.name}</div>

        <div class="student-meta">
          <span class="meta-pill">GCC No. ${student.gcc_no || "—"}</span>
          <span class="meta-pill">${course} Batch</span>
          <span class="meta-pill">${student.class_name || "—"}</span>
        </div>

        <div class="achievement-text">
          has achieved <span class="rank-highlight" style="color:${rc.text};background:${rc.light};border:1px solid ${rc.border}">${rank}${suffix} Position</span>
          in the <strong>${examName}</strong>
        </div>

        <div class="score-row">
          <div class="score-box">
            <div class="score-label">Marks Obtained</div>
            <div class="score-value">${total}<span class="score-max">/${courseMax}</span></div>
          </div>
          <div class="score-box highlight-box" style="border-color:${rc.border}">
            <div class="score-label">Percentage</div>
            <div class="score-value" style="color:${rc.text}">${pct.toFixed(1)}%</div>
          </div>
          <div class="score-box">
            <div class="score-label">Class Rank</div>
            <div class="score-value" style="color:${rc.text}">${rank}${suffix}</div>
          </div>
        </div>

        <div class="exam-detail">
          Examination: <strong>${examName}</strong> &nbsp;·&nbsp;
          Date: <strong>${examDate || "—"}</strong> &nbsp;·&nbsp;
          Academic Year: <strong>${academicYear || "2026-2027"}</strong>
        </div>
      </div>

      <!-- Gold divider -->
      <div class="divider">
        <div class="divider-line"></div>
        <div class="divider-gem">◆</div>
        <div class="divider-line"></div>
      </div>

      <!-- Signatures -->
      <div class="sig-row">
        <div class="sig-block">
          <div class="sig-line-bar"></div>
          <div class="sig-title">Class Teacher</div>
        </div>
        <div class="seal-center">
          <div class="seal-circle">
            <div class="seal-word">Official</div>
            <div class="seal-star">★</div>
            <div class="seal-word">Seal</div>
          </div>
        </div>
        <div class="sig-block">
          <div class="sig-line-bar"></div>
          <div class="sig-title">Principal / Head of Institute</div>
        </div>
      </div>

      <!-- Bottom ribbon -->
      <div class="bottom-ribbon" style="background:${rc.bg}">
        <div class="ribbon-text" style="font-size:11px;letter-spacing:3px">${institute.name || "GNSI"} &nbsp;·&nbsp; ${examName} &nbsp;·&nbsp; ${academicYear || "2026-2027"}</div>
      </div>
    </div>
  </div>`;
}

const CERT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  body {
    font-family: 'DM Sans', sans-serif;
    background: #d6cfc0;
    padding: 24px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .no-print {
    text-align: center; margin-bottom: 20px;
    display: flex; gap: 10px; justify-content: center;
  }
  .no-print button {
    padding: 10px 28px; border: none; border-radius: 8px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
  }
  .btn-print { background: #1a3c2e; color: white; }
  .btn-close { background: #e5e7eb; color: #374151; }

  .cert-page {
    width: 900px; margin: 0 auto 40px;
    page-break-after: always;
  }
  .cert-outer {
    background: #FFFDF7;
    border: 3px solid #B8860B;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 16px 64px rgba(0,0,0,0.25), 0 0 0 8px #1a3c2e, 0 0 0 11px #B8860B;
    margin: 11px;
  }

  /* Corner ornaments */
  .corner {
    position: absolute; width: 60px; height: 60px; z-index: 2;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'%3E%3Cpath d='M0,0 L60,0 L60,10 L10,10 L10,60 L0,60 Z' fill='%23B8860B' opacity='0.6'/%3E%3Cpath d='M5,5 L55,5 L55,15 L15,15 L15,55 L5,55 Z' fill='none' stroke='%23B8860B' stroke-width='1.5' opacity='0.4'/%3E%3C/svg%3E");
  }
  .tl { top: 0; left: 0; }
  .tr { top: 0; right: 0; transform: scaleX(-1); }
  .bl { bottom: 0; left: 0; transform: scaleY(-1); }
  .br { bottom: 0; right: 0; transform: scale(-1); }

  /* Watermark */
  .watermark {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%,-50%) rotate(-30deg);
    font-family: 'Playfair Display', serif;
    font-size: 160px; font-weight: 800;
    color: rgba(184,134,11,0.04);
    pointer-events: none; z-index: 0;
    white-space: nowrap;
  }

  /* Ribbons */
  .top-ribbon, .bottom-ribbon {
    padding: 10px 40px;
    text-align: center; position: relative; z-index: 1;
  }
  .ribbon-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 700;
    letter-spacing: 6px; text-transform: uppercase;
    color: rgba(0,0,0,0.7);
  }

  /* Header */
  .cert-header {
    display: flex; align-items: center; gap: 20px;
    padding: 24px 48px 16px;
    position: relative; z-index: 1;
  }
  .logo-area { flex-shrink: 0; }
  .logo-img {
    width: 80px; height: 80px; border-radius: 50%;
    border: 2px solid #B8860B;
    object-fit: contain;
  }
  .logo-placeholder {
    width: 80px; height: 80px; border-radius: 50%;
    border: 2px solid #B8860B;
    background: #1a3c2e;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Playfair Display', serif;
    font-size: 18px; font-weight: 700; color: #f0c040;
  }
  .inst-info { flex: 1; text-align: center; }
  .inst-name {
    font-family: 'Playfair Display', serif;
    font-size: 22px; font-weight: 700; color: #1a3c2e;
    line-height: 1.2; margin-bottom: 4px;
  }
  .inst-addr { font-size: 12px; color: #64748b; margin-bottom: 3px; }
  .inst-tag {
    font-family: 'Cormorant Garamond', serif;
    font-size: 13px; font-style: italic; color: #B8860B;
  }
  .medal-area { flex-shrink: 0; }
  .medal-circle {
    width: 80px; height: 80px; border-radius: 50%;
    border: 3px solid;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .medal-emoji { font-size: 28px; line-height: 1; }
  .medal-rank {
    font-size: 8px; font-weight: 800; letter-spacing: 1.5px;
    text-transform: uppercase; color: rgba(0,0,0,0.6);
    margin-top: 2px;
  }

  /* Divider */
  .divider {
    display: flex; align-items: center;
    padding: 0 48px; margin: 4px 0;
    position: relative; z-index: 1;
  }
  .divider-line { flex: 1; height: 1.5px; background: linear-gradient(90deg,transparent,#B8860B,transparent); }
  .divider-gem { color: #B8860B; font-size: 14px; margin: 0 14px; }

  /* Body */
  .cert-body {
    padding: 20px 64px 24px;
    text-align: center;
    position: relative; z-index: 1;
  }
  .presents {
    font-family: 'Cormorant Garamond', serif;
    font-size: 16px; font-style: italic; color: #64748b;
    margin-bottom: 10px; letter-spacing: 1px;
  }
  .student-name {
    font-family: 'Playfair Display', serif;
    font-size: 48px; font-weight: 700; color: #1a3c2e;
    line-height: 1.1; margin-bottom: 12px;
    text-shadow: 0 2px 8px rgba(26,60,46,0.1);
  }
  .student-meta {
    display: flex; gap: 10px; justify-content: center;
    flex-wrap: wrap; margin-bottom: 18px;
  }
  .meta-pill {
    font-size: 12px; font-weight: 600;
    padding: 4px 14px;
    background: #F0FDF4; color: #0F6E56;
    border: 1px solid #BBF7D0; border-radius: 999px;
  }
  .achievement-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px; color: #374151; line-height: 1.6;
    margin-bottom: 20px;
  }
  .rank-highlight {
    display: inline-block;
    font-family: 'Playfair Display', serif;
    font-size: 22px; font-weight: 700;
    padding: 2px 16px; border-radius: 6px;
    margin: 0 4px;
  }
  .score-row {
    display: flex; gap: 16px; justify-content: center;
    margin-bottom: 20px;
  }
  .score-box {
    flex: 1; max-width: 180px;
    border: 1.5px solid #E5E7EB; border-radius: 10px;
    padding: 14px 10px; text-align: center;
    background: #FAFAFA;
  }
  .highlight-box { background: white; border-width: 2px; }
  .score-label {
    font-size: 10px; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase; color: #9CA3AF; margin-bottom: 6px;
  }
  .score-value {
    font-family: 'Playfair Display', serif;
    font-size: 32px; font-weight: 700; color: #1a3c2e; line-height: 1;
  }
  .score-max { font-size: 16px; color: #9CA3AF; font-weight: 400; }
  .exam-detail {
    font-size: 12px; color: #64748b; letter-spacing: 0.5px;
  }

  /* Signatures */
  .sig-row {
    display: flex; align-items: flex-end; justify-content: space-between;
    padding: 16px 64px 20px;
    position: relative; z-index: 1;
  }
  .sig-block { text-align: center; flex: 1; }
  .sig-line-bar {
    height: 1.5px; margin: 0 20px 6px;
    background: linear-gradient(90deg,transparent,#374151,transparent);
  }
  .sig-title {
    font-size: 10px; font-weight: 600; letter-spacing: 1.5px;
    text-transform: uppercase; color: #64748b;
  }
  .seal-center { flex: 0 0 100px; display: flex; justify-content: center; }
  .seal-circle {
    width: 80px; height: 80px; border-radius: 50%;
    border: 2px dashed #B8860B;
    background: #FFFDF7;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 1px;
  }
  .seal-word { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: #B8860B; font-weight: 700; }
  .seal-star { font-size: 18px; color: #B8860B; }

  @media print {
    body { background: white; padding: 0; }
    .no-print { display: none !important; }
    .cert-page { margin: 0; width: 100%; }
    .cert-outer { box-shadow: none; margin: 8px; }
    @page { margin: 0.5cm; size: A4 landscape; }
  }
`;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ToppersCertificate({ courseSubjects, examTypes, students, institute }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [dates, setDates] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(null); // null | "all" | studentId
  const [customTitle, setCustomTitle] = useState("");
  // ── Real exam config, sourced live from exam_schedule for this exact course +
  // exam type — NOT the static courseSubjects/COURSE_MAX_MARKS config, which can
  // drift out of sync with whatever was actually scheduled and marked.
  const [scheduledSubjects, setScheduledSubjects] = useState([]); // [{ id, subject, total_marks }]

  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course ||
    (s.course || "").toUpperCase() === course
  );
  const subjects = scheduledSubjects.length ? scheduledSubjects.map(s => s.subject) : (courseSubjects[course] || []);
  const courseMax = scheduledSubjects.length
    ? scheduledSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    : getCourseMax(course);
  const examName = examTypes.find(e => e.id === examType)?.name || "Examination";

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique);
      if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  useEffect(() => {
    if (!examType || !examDate || !course) return;
    setLoading(true);
    const ids = courseStudents.map(s => s.id);
    // Resolve via exam_schedule (exam_id -> subject) and the correct marks_obtained
    // column — the previous version read a `marks` column that doesn't exist on
    // exam_marks, which meant every total here silently came out as zero.
    Promise.all([
      supabase.from("exam_schedule").select("id, subject").eq("exam_type_id", examType).eq("course", course),
      supabase.from("exam_marks").select("student_id, exam_id, subject, marks_obtained")
        .eq("exam_type_id", examType).eq("exam_date", examDate)
        .in("student_id", ids.length ? ids : ["__none__"]),
    ]).then(([{ data: sched }, { data }]) => {
      const examIdToSubject = {};
      (sched || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
      const map = {};
      (data || []).forEach(r => {
        const sub = examIdToSubject[r.exam_id] || r.subject;
        if (sub) map[`${r.student_id}-${sub}`] = r.marks_obtained;
      });
      setMarks(map);
      setLoading(false);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);

  // Rank students
  const ranked = [...courseStudents]
    .map(st => ({ ...st, total: getTotal(st.id) }))
    .filter(st => st.total > 0)
    .sort((a, b) => b.total - a.total);

  let cr = 1, pt = null;
  const rankedWithRanks = ranked.map((st, i) => {
    if (i === 0) { cr = 1; pt = st.total; }
    else if (st.total !== pt) { cr++; pt = st.total; }
    return { ...st, rank: cr };
  });

  const topThree = rankedWithRanks.filter(st => st.rank <= 3).slice(0, 3);

  const printCertificates = (students) => {
    setPrinting("all");
    const cards = students.map(st => {
      const pct = (st.total / courseMax) * 100;
      return buildCertificateHTML(
        st, st.rank, st.total, courseMax, pct,
        customTitle || examName, examDate, course, institute,
        institute.academicYear || "2026-2027"
      );
    });

    const w = window.open("", "_blank");
    if (!w) { alert("Popup blocked — please allow popups."); setPrinting(null); return; }
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Toppers Certificate — ${course} — ${examName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>${CERT_CSS}</style>
    </head><body>
      <div class="no-print">
        <button class="btn-print" onclick="document.fonts.ready.then(()=>{window.print()})">🖨️ Print All (${cards.length}) Certificates</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
      ${cards.join("")}
    </body></html>`);
    w.document.close();
    setTimeout(() => setPrinting(null), 1000);
  };

  const printOne = (st) => {
    setPrinting(st.id);
    const pct = (st.total / courseMax) * 100;
    const card = buildCertificateHTML(
      st, st.rank, st.total, courseMax, pct,
      customTitle || examName, examDate, course, institute,
      institute.academicYear || "2026-2027"
    );
    const w = window.open("", "_blank");
    if (!w) { alert("Popup blocked."); setPrinting(null); return; }
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Certificate — ${st.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>${CERT_CSS}</style>
    </head><body>
      <div class="no-print">
        <button class="btn-print" onclick="document.fonts.ready.then(()=>{window.print()})">🖨️ Print Certificate</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
      ${card}
    </body></html>`);
    w.document.close();
    setTimeout(() => setPrinting(null), 1000);
  };

  const RANK_COLORS_UI = [
    { border: "#f0c040", bg: "#FEF9E7", text: "#7A5800", medal: "🥇" },
    { border: "#CBD5E1", bg: "#F1F5F9", text: "#475569", medal: "🥈" },
    { border: "#E8A96A", bg: "#FEF3E7", text: "#7C3F00", medal: "🥉" },
  ];

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Batch / Course</label>
          <select value={course} onChange={e => setCourse(e.target.value)} style={{ ...css.input }}>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={css.input}>
            {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={css.input}>
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Custom Exam Title (optional)</label>
          <input value={customTitle} onChange={e => setCustomTitle(e.target.value)}
            placeholder={examName} style={css.input} />
        </div>
      </div>

      {!scheduledSubjects.length && examType && course && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 12.5, color: "#991B1B", lineHeight: 1.6 }}>
          ⚠️ No exam is scheduled for <b>{course}</b> under "<b>{examName}</b>" — totals/max marks are falling back to the static Course Subjects config. Set up the schedule in <b>Exams → Schedule</b> for accurate certificates.
        </div>
      )}

      {/* Print all button */}
      {topThree.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <button
            onClick={() => printCertificates(topThree)}
            disabled={printing === "all"}
            style={{ ...css.btn, background: printing === "all" ? "#93C5FD" : "#1a3c2e", color: "white", padding: "10px 24px", fontSize: 14 }}>
            {printing === "all" ? "⏳ Opening…" : `🖨️ Print All ${topThree.length} Certificates`}
          </button>
        </div>
      )}

      {/* Topper cards preview */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>⏳ Loading marks…</div>
      ) : topThree.length === 0 ? (
        <div style={{ ...css.card, textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏅</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No results found</div>
          <div style={{ fontSize: 13 }}>Select a course, exam type, and date with marks entered.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
            {topThree.map((st, i) => {
              const rc = RANK_COLORS_UI[i];
              const pct = ((st.total / courseMax) * 100).toFixed(1);
              return (
                <div key={st.id} style={{
                  background: "white", borderRadius: 16, overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                  border: `2px solid ${rc.border}`,
                  position: "relative"
                }}>
                  {/* Top stripe */}
                  <div style={{
                    background: `linear-gradient(135deg, ${rc.border}, ${rc.bg})`,
                    padding: "20px 24px",
                    textAlign: "center",
                    borderBottom: `1px solid ${rc.border}`
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 6 }}>{rc.medal}</div>
                    <div style={{
                      fontFamily: "'Playfair Display',serif",
                      fontSize: 13, fontWeight: 700, letterSpacing: 3,
                      textTransform: "uppercase", color: rc.text
                    }}>
                      {["1st Place", "2nd Place", "3rd Place"][i]}
                    </div>
                  </div>

                  {/* Student info */}
                  <div style={{ padding: "20px 24px" }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: "#1a3c2e", marginBottom: 4 }}>
                      {st.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                      GCC {st.gcc_no} · {st.class_name || course}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                      <div style={{ textAlign: "center", padding: "10px", background: "#F8FAFC", borderRadius: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 4 }}>Score</div>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: "#1a3c2e" }}>
                          {st.total}<span style={{ fontSize: 12, color: "#9CA3AF" }}>/{courseMax}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "center", padding: "10px", background: rc.bg, borderRadius: 8, border: `1px solid ${rc.border}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: rc.text, textTransform: "uppercase", marginBottom: 4 }}>Percentage</div>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: rc.text }}>
                          {pct}%
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => printOne(st)}
                      disabled={printing === st.id}
                      style={{
                        ...css.btn, width: "100%",
                        background: printing === st.id ? "#93C5FD" : "#1a3c2e",
                        color: "white", fontSize: 13
                      }}>
                      {printing === st.id ? "⏳ Opening…" : "🖨️ Print Certificate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full ranking table */}
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>
              📊 Full Rankings — {course} · {customTitle || examName} · {examDate}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                  {["Rank", "Student", "GCC No.", "Score", "%", "Certificate"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "Student" ? "left" : "center", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankedWithRanks.map((st, i) => {
                  const pct = ((st.total / courseMax) * 100).toFixed(1);
                  const rc = st.rank <= 3 ? RANK_COLORS_UI[st.rank - 1] : null;
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, fontSize: st.rank <= 3 ? 18 : 13, color: rc ? rc.text : "#9CA3AF" }}>
                        {st.rank <= 3 ? medals[st.rank - 1] : `#${st.rank}`}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{st.name}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{st.gcc_no || "—"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>{st.total}/{courseMax}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: rc ? rc.text : "#374151" }}>{pct}%</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {st.rank <= 3 ? (
                          <button
                            onClick={() => printOne(st)}
                            disabled={printing === st.id}
                            style={{ ...css.btn, padding: "5px 14px", fontSize: 12, background: rc ? rc.bg : "#F3F4F6", color: rc ? rc.text : "#374151", border: `1px solid ${rc ? rc.border : "#E5E7EB"}` }}>
                            {printing === st.id ? "⏳" : "🖨️ Print"}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rankedWithRanks.length && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No marks found for this selection.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}