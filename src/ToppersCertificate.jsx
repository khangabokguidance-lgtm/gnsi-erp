// ─── ToppersCertificate.jsx ───────────────────────────────────────────────────
// Drop this file into src/ and import in Exams.jsx:
//   import ToppersCertificate from './ToppersCertificate'
// Add to TAB_GROUPS under Documents:
//   { id: "toppers", icon: "🏅", label: "Certificates", tip: "Print topper certificates" }
// Add to sectionMap:
//   toppers: <ToppersCertificate courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} />

import { useState, useEffect } from "react";
import { supabase } from './supabase';
import { printMeritCertificates } from './certificateKit';

// ─── Helpers (inline so this file is self-contained) ─────────────────────────
// Last-resort fallback only — the live source of truth is window.__gnsiCourseMaxMarks,
// which Exams.jsx keeps in sync with whichever exam config is currently active. Reading
// that global first (instead of only ever using this static table) keeps this file from
// silently drifting out of sync when a new batch or a mark scheme changes in Exams.jsx —
// same fix already applied to ExamDashboard.jsx.
const COURSE_MAX_MARKS_FALLBACK = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  UDAAN:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRAGATI:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
};
function getCourseMax(course) {
  const m = (window.__gnsiCourseMaxMarks || COURSE_MAX_MARKS_FALLBACK)[course] || {};
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

  const toItem = st => ({ student: st, rank: st.rank, total: st.total, courseMax, pct: (st.total / courseMax) * 100,
    examName, title: customTitle || examName, examDate, course });

  const printCertificates = (students) => {
    printMeritCertificates(students.map(toItem), `Certificates of merit — ${course} — ${examName}`);
  };

  const printOne = (st) => {
    printMeritCertificates([toItem(st)], `Certificate — ${st.name}`);
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