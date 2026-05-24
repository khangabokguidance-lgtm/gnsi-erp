// ─── ExamDashboard.jsx ────────────────────────────────────────────────────────
// Drop into src/ and import in Exams.jsx:
//   import ExamDashboard from './ExamDashboard'
// Add to TAB_GROUPS as first tab in a new group OR prepend to Entry group:
//   { id: "dashboard", icon: "🏠", label: "Dashboard", tip: "Exam HUB overview" }
// Add to sectionMap:
//   dashboard: <ExamDashboard courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />

import { useState, useEffect, useRef } from "react";
import { supabase } from './supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const GRADE_PRESETS = [
  { min: 90, label: "A+", color: "#0F6E56", bg: "#E1F5EE" },
  { min: 80, label: "A",  color: "#185FA5", bg: "#E6F1FB" },
  { min: 70, label: "B+", color: "#534AB7", bg: "#EEEDFE" },
  { min: 60, label: "B",  color: "#2563eb", bg: "#dbeafe" },
  { min: 50, label: "C",  color: "#BA7517", bg: "#FAEEDA" },
  { min: 40, label: "D",  color: "#ea580c", bg: "#fff7ed" },
  { min: 0,  label: "F",  color: "#A32D2D", bg: "#FCEBEB" },
];
function getGrade(pct) {
  for (const g of GRADE_PRESETS) if (pct >= g.min) return g;
  return GRADE_PRESETS[GRADE_PRESETS.length - 1];
}

const COURSE_COLORS = ["#1a3c2e","#185FA5","#7c3aed","#d97706","#0891b2","#e11d48","#84cc16","#64748b"];

// ─── Mini Sparkline (SVG) ─────────────────────────────────────────────────────
function Sparkline({ data, color = "#1a3c2e", height = 40, width = 120 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(" ").pop().split(",")[0]} cy={pts.split(" ").pop().split(",")[1]} r={3} fill={color} />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, sparkData }) {
  return (
    <div style={{
      background: "white", borderRadius: 14, padding: "18px 20px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      borderLeft: `4px solid ${color}`,
      display: "flex", flexDirection: "column", gap: 8,
      position: "relative", overflow: "hidden"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".1em" }}>{label}</div>
        <div style={{ fontSize: 22 }}>{icon}</div>
      </div>
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 36, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b" }}>{sub}</div>}
      {sparkData && (
        <div style={{ position: "absolute", bottom: 12, right: 16, opacity: 0.3 }}>
          <Sparkline data={sparkData} color={color} />
        </div>
      )}
    </div>
  );
}

// ─── Course Performance Bar ───────────────────────────────────────────────────
function CourseBar({ course, avg, pass, total, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{course}</span>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{total} students</span>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color }}>{avg.toFixed(1)}%</span>
          <span style={{ color: "#0F6E56" }}>✓ {pass}% pass</span>
        </div>
      </div>
      <div style={{ height: 8, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${avg}%`, background: color, borderRadius: 999, transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function ExamDashboard({ courseSubjects, examTypes, students, institute, schedule }) {
  const courses = Object.keys(courseSubjects);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [allMarks, setAllMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);

  const examName = examTypes.find(e => e.id === examType)?.name || "Examination";

  // Load all marks for selected exam type (latest date per course)
  useEffect(() => {
    if (!examType) return;
    setLoading(true);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType)
      .then(({ data }) => {
        setAllMarks(data || []);
        setLoading(false);
      });
  }, [examType]);

  // ── Per-course stats ──────────────────────────────────────────────────────
  const courseStats = courses.map((course, ci) => {
    const subjects = courseSubjects[course] || [];
    const courseMax = getCourseMax(course);
    const courseStudents = students.filter(s =>
      (s.class_name || "").toUpperCase() === course ||
      (s.course || "").toUpperCase() === course
    );

    // Latest date for this course
    const courseDates = [...new Set(
      allMarks
        .filter(r => courseStudents.some(s => s.id === r.student_id))
        .map(r => r.exam_date)
    )].sort().reverse();
    const latestDate = courseDates[0];

    const latestMarks = allMarks.filter(r =>
      r.exam_date === latestDate &&
      courseStudents.some(s => s.id === r.student_id)
    );

    const studentsWithMarks = courseStudents.filter(st =>
      latestMarks.some(r => r.student_id === st.id)
    );

    const totals = studentsWithMarks.map(st => {
      const total = subjects.reduce((s, sub) => {
        const m = latestMarks.find(r => r.student_id === st.id && r.subject === sub);
        return s + (m ? Number(m.marks) || 0 : 0);
      }, 0);
      return { ...st, total, pct: (total / courseMax) * 100 };
    });

    const avgPct = totals.length ? totals.reduce((s, t) => s + t.pct, 0) / totals.length : 0;
    const passCount = totals.filter(t => t.pct >= 40).length;
    const passRate = totals.length ? Math.round((passCount / totals.length) * 100) : 0;
    const topper = totals.sort((a, b) => b.total - a.total)[0];

    // Trend: avg pct across all dates
    const trendData = courseDates.slice(0, 6).reverse().map(date => {
      const dm = allMarks.filter(r =>
        r.exam_date === date && courseStudents.some(s => s.id === r.student_id)
      );
      const stTotals = courseStudents.map(st => {
        return subjects.reduce((s, sub) => {
          const m = dm.find(r => r.student_id === st.id && r.subject === sub);
          return s + (m ? Number(m.marks) || 0 : 0);
        }, 0);
      }).filter(t => t > 0);
      return stTotals.length ? (stTotals.reduce((a, b) => a + b, 0) / stTotals.length / courseMax) * 100 : 0;
    });

    return {
      course, courseMax, color: COURSE_COLORS[ci % COURSE_COLORS.length],
      total: courseStudents.length, tested: studentsWithMarks.length,
      avgPct, passRate, topper, latestDate, trendData,
    };
  });

  // ── Overall stats ─────────────────────────────────────────────────────────
  const totalStudents = students.length;
  const totalTested = courseStats.reduce((s, c) => s + c.tested, 0);
  const overallAvg = courseStats.filter(c => c.tested > 0).length
    ? courseStats.filter(c => c.tested > 0).reduce((s, c) => s + c.avgPct, 0) / courseStats.filter(c => c.tested > 0).length
    : 0;
  const overallPass = courseStats.filter(c => c.tested > 0).length
    ? courseStats.filter(c => c.tested > 0).reduce((s, c) => s + c.passRate, 0) / courseStats.filter(c => c.tested > 0).length
    : 0;

  // ── Upcoming exams from schedule ──────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const upcoming = schedule
    .filter(s => s.exam_date >= today && s.exam_type_id === examType)
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
    .slice(0, upcomingExpanded ? 20 : 5);

  // ── All-time toppers across courses ───────────────────────────────────────
  const allToppers = courseStats
    .filter(c => c.topper)
    .map(c => ({ ...c.topper, course: c.course, color: c.color, courseMax: c.courseMax }))
    .sort((a, b) => b.pct - a.pct);

  // ── Grade distribution across all ─────────────────────────────────────────
  const gradeCounts = { "A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0 };
  courseStats.forEach(c => {
    const subjects = courseSubjects[c.course] || [];
    const courseStudentsLocal = students.filter(s =>
      (s.class_name || "").toUpperCase() === c.course ||
      (s.course || "").toUpperCase() === c.course
    );
    const latestMarksLocal = allMarks.filter(r =>
      r.exam_date === c.latestDate &&
      courseStudentsLocal.some(s => s.id === r.student_id)
    );
    courseStudentsLocal.forEach(st => {
      const total = subjects.reduce((s, sub) => {
        const m = latestMarksLocal.find(r => r.student_id === st.id && r.subject === sub);
        return s + (m ? Number(m.marks) || 0 : 0);
      }, 0);
      if (total > 0) {
        const pct = (total / c.courseMax) * 100;
        const g = getGrade(pct);
        gradeCounts[g.label] = (gradeCounts[g.label] || 0) + 1;
      }
    });
  });
  const gradeTotal = Object.values(gradeCounts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header bar */}
      <div style={{
        background: "linear-gradient(135deg,#1a3c2e,#2A5C45)",
        borderRadius: 14, padding: "20px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12
      }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "white", fontWeight: 400 }}>
            📊 Exam HUB — Overview
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>
            {institute.name} · Academic Year {institute.academicYear || "2026-2027"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.15)", color: "white", outline: "none", cursor: "pointer" }}>
            {examTypes.map(et => <option key={et.id} value={et.id} style={{ background: "#1a3c2e" }}>{et.name}</option>)}
          </select>
        </div>
      </div>

      {/* Top KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard icon="👥" label="Total Students" value={totalStudents} sub={`${courses.length} courses enrolled`} color="#1a3c2e" />
        <StatCard icon="📝" label="Tests Taken" value={totalTested} sub={`out of ${totalStudents} students`} color="#185FA5" />
        <StatCard icon="📈" label="Class Average" value={`${overallAvg.toFixed(1)}%`} sub="across all batches" color="#0891b2" />
        <StatCard icon="✅" label="Avg Pass Rate" value={`${overallPass.toFixed(0)}%`} sub="across all courses" color="#0F6E56" />
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>

        {/* Left: Course performance */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Course bars */}
          <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 18 }}>
              📚 Course-wise Performance — {examName}
            </div>
            {loading ? (
              <div style={{ textAlign: "center", color: "#9CA3AF", padding: 40 }}>⏳ Loading…</div>
            ) : (
              courseStats.map(c => (
                <CourseBar key={c.course} course={c.course} avg={c.avgPct}
                  pass={c.passRate} total={c.total} color={c.color} />
              ))
            )}
          </div>

          {/* Per-course detail cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
            {courseStats.map(c => (
              <div key={c.course} style={{
                background: "white", borderRadius: 12, padding: "16px 18px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                borderTop: `3px solid ${c.color}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{c.course}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                      {c.tested}/{c.total} students tested
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: c.color }}>
                      {c.avgPct.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>avg</div>
                  </div>
                </div>

                {/* Trend sparkline */}
                {c.trendData.length > 1 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>Trend</div>
                    <Sparkline data={c.trendData} color={c.color} height={36} width={200} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, textAlign: "center", background: "#F8FAFC", borderRadius: 8, padding: "8px 4px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>Pass Rate</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: c.passRate >= 70 ? "#0F6E56" : c.passRate >= 50 ? "#BA7517" : "#A32D2D" }}>
                      {c.passRate}%
                    </div>
                  </div>
                  {c.topper && (
                    <div style={{ flex: 2, background: "#F8FAFC", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 3 }}>🥇 Topper</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.topper.name}
                      </div>
                      <div style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>
                        {c.topper.total}/{c.courseMax} ({c.topper.pct.toFixed(1)}%)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Grade distribution */}
          <div style={{ background: "white", borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 14 }}>
              🎓 Grade Distribution
            </div>
            {Object.entries(gradeCounts).map(([label, count]) => {
              const g = GRADE_PRESETS.find(x => x.label === label);
              const pct = Math.round((count / gradeTotal) * 100);
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{
                    width: 28, height: 20, borderRadius: 4, fontSize: 11, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: g?.bg, color: g?.color
                  }}>{label}</span>
                  <div style={{ flex: 1, height: 8, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: g?.color, borderRadius: 999, transition: "width .5s" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", minWidth: 28, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Top performers across all courses */}
          <div style={{ background: "white", borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 14 }}>
              🏆 Top Performers (All Courses)
            </div>
            {allToppers.slice(0, 7).map((st, i) => (
              <div key={st.id || i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8, marginBottom: 6,
                background: i === 0 ? "#FEF9E7" : "#F9FAFB",
                border: i === 0 ? "1px solid #f0c040" : "1px solid #F1F5F9"
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: i === 0 ? "#f0c040" : st.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "white"
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {st.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{st.course} · GCC {st.gcc_no}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: st.color }}>{st.pct?.toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{st.total}/{st.courseMax}</div>
                </div>
              </div>
            ))}
            {allToppers.length === 0 && (
              <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 12, padding: 20 }}>No marks data yet.</div>
            )}
          </div>

          {/* Upcoming exams */}
          <div style={{ background: "white", borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1e293b" }}>
                📅 Upcoming — {examName}
              </div>
              <button onClick={() => setUpcomingExpanded(p => !p)}
                style={{ fontSize: 11, color: "#185FA5", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                {upcomingExpanded ? "Show less" : "Show all"}
              </button>
            </div>
            {upcoming.length === 0 ? (
              <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 12, padding: "12px 0" }}>No upcoming exams scheduled.</div>
            ) : (
              upcoming.map((s, i) => {
                const daysUntil = Math.ceil((new Date(s.exam_date) - new Date()) / 86400000);
                const isToday = daysUntil === 0;
                const isSoon = daysUntil <= 3;
                return (
                  <div key={s.id || i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 0", borderBottom: "1px solid #F1F5F9"
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 8, flexShrink: 0,
                      background: isToday ? "#FEF2F2" : isSoon ? "#FFFBEB" : "#E1F5EE",
                      border: `1px solid ${isToday ? "#FECACA" : isSoon ? "#FDE68A" : "#BBF7D0"}`,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isToday ? "#DC2626" : isSoon ? "#92400E" : "#0F6E56", lineHeight: 1 }}>
                        {new Date(s.exam_date).getDate()}
                      </div>
                      <div style={{ fontSize: 8, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" }}>
                        {new Date(s.exam_date).toLocaleString("en-IN", { month: "short" })}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.subject}
                      </div>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>
                        {s.course} · {s.shift || "Morning"} {s.time ? `· ${s.time}` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? "#DC2626" : isSoon ? "#92400E" : "#64748b", flexShrink: 0 }}>
                      {isToday ? "Today" : `${daysUntil}d`}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* Bottom: Quick stats bar */}
      <div style={{
        background: "#1a3c2e", borderRadius: 14, padding: "16px 28px",
        display: "flex", gap: 0, overflow: "hidden"
      }}>
        {[
          { label: "Courses", val: courses.length },
          { label: "Exam Types", val: examTypes.length },
          { label: "Schedule Entries", val: schedule.length },
          { label: "Upcoming (7d)", val: schedule.filter(s => { const d = Math.ceil((new Date(s.exam_date) - new Date()) / 86400000); return d >= 0 && d <= 7; }).length },
          { label: "Mark Entries", val: allMarks.length },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            flex: 1, textAlign: "center", padding: "8px 0",
            borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none"
          }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, color: "white" }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}