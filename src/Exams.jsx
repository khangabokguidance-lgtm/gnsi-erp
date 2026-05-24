/**
 * GNSI Portal — Exams.jsx (v6 — Fixed Avg% calculation)
 *
 * KEY CHANGES from v5:
 *  ① Avg% now = total (since max per course = 100), not total/subjects
 *  ② Grade thresholds apply correctly on 0–100 scale
 *  ③ total_marks saved per-subject correctly from COURSE_MAX_MARKS
 *  ④ Avg% column renamed to "%" for clarity
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from './supabase'
import { staffDB, useStaffDB } from './staffDB'
import { ADMIT_CARD_CSS, generateAdmitCardHTML, openAdmitCardPrintWindow } from './admitCardTemplate'
import ToppersCertificate from './ToppersCertificate'
import ExamDashboard from './ExamDashboard'

// ─── Load Chart.js + SheetJS from CDN ────────────────────────────────────────
function loadScript(src, id) {
  return new Promise(res => {
    if (document.getElementById(id)) return res();
    const s = document.createElement("script");
    s.src = src; s.id = id; s.onload = res;
    document.head.appendChild(s);
  });
}
async function ensureLibs() {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "_xlsx");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js", "_chartjs");
}

// ─── Default per-course subjects ──────────────────────────────────────────────
const DEFAULT_COURSE_SUBJECTS = {
  ACHIEVER:  ["English Grammar", "Vocabulary", "General Knowledge", "Mathematics -I", "Mathematics - II", "Reasoning", "Science"],
  ELITE:     ["English Grammar", "Science", "Mathematics", "Reasoning", "Meitei Mayek"],
  PRIME:     ["English Grammar", "Science", "Mathematics", "Reasoning", "Meitei Mayek"],
  LAKSHYA:   ["Grammar", "Mental", "Mathematics", "Meitei Mayek"],
  UMEED:     ["Grammar & Vocabulary", "Mental", "Mathematics", "Meitei Mayek"],
  CHAMPION:  ["Vocabulary", "General Knowledge", "Mathematics-II", "Mathematics - I", "Reasoning", "Grammar", "Science"],
  LEADER:    ["Vocabulary", "Grammar", "General Knowledge", "Mathematics -I", "Mathematics - II", "Reasoning", "Science"],
};

// ─── Max marks per subject per course (all total to 100) ─────────────────────
const COURSE_MAX_MARKS = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
};

// Get total max marks for a course (should always be 100)
function getCourseMax(course) {
  const maxMap = COURSE_MAX_MARKS[course] || {};
  const total = Object.values(maxMap).reduce((s, v) => s + v, 0);
  return total || 100;
}

// Get subject max for a specific subject in a course
function getSubjectMax(course, subject) {
  return (COURSE_MAX_MARKS[course] || {})[subject] || 100;
}

// ─── Grade presets ────────────────────────────────────────────────────────────
const GRADE_PRESETS = [
  { min: 90, label: "A+", color: "#0F6E56", bg: "#E1F5EE", gpa: 4.0 },
  { min: 80, label: "A",  color: "#185FA5", bg: "#E6F1FB", gpa: 3.5 },
  { min: 70, label: "B+", color: "#534AB7", bg: "#EEEDFE", gpa: 3.0 },
  { min: 60, label: "B",  color: "#2563eb", bg: "#dbeafe", gpa: 2.5 },
  { min: 50, label: "C",  color: "#BA7517", bg: "#FAEEDA", gpa: 2.0 },
  { min: 40, label: "D",  color: "#ea580c", bg: "#fff7ed", gpa: 1.0 },
  { min: 0,  label: "F",  color: "#A32D2D", bg: "#FCEBEB", gpa: 0.0 },
];

// ─── Role permissions ────────────────────────────────────────────────────────
const ROLE_PERMS = {
  Admin:    { canEdit: true,  canDelete: true,  canImport: true,  canPrint: true  },
  Manager:  { canEdit: true,  canDelete: false, canImport: true,  canPrint: true  },
  Teacher:  { canEdit: true,  canDelete: false, canImport: false, canPrint: true  },
  Accounts: { canEdit: false, canDelete: false, canImport: false, canPrint: false },
}
function usePerm(currentUser) {
  return ROLE_PERMS[currentUser?.role] || ROLE_PERMS.Teacher
}

const TAB_GROUPS = [
  {
    groupLabel: "Entry", color: "#1433a8",
    tabs: [{ id: "entry", icon: "✏️", label: "Mark Entry", tip: "Enter & save marks" }]
  },
  {
    groupLabel: "Results", color: "#0891b2",
    tabs: [
      { id: "marks",     icon: "📊", label: "Marks Grid",  tip: "View all marks" },
      { id: "analytics", icon: "📉", label: "Analytics",   tip: "Charts & class analysis" },
      { id: "rankings",  icon: "🏆", label: "Rankings",    tip: "Top performers" },
      { id: "progress",  icon: "🎓", label: "Progress",    tip: "Per-student progress" },
      { id: "compare",   icon: "⚖️",  label: "Compare",    tip: "Side-by-side comparison" },
      { id: "merit",     icon: "📜", label: "Merit List",  tip: "Generate merit lists" },
      { id: "dashboard", icon: "🏠", label: "Dashboard", tip: "Exam HUB overview" }
    ]
  },
  {
    groupLabel: "Documents", color: "#16a34a",
    tabs: [
      { id: "admitcard",  icon: "🪪",  label: "Admit Cards",  tip: "Generate admit cards" },
      { id: "reportcard", icon: "📋", label: "Report Cards", tip: "Print report cards" },
      { id: "bulkreport", icon: "📦", label: "Bulk Reports", tip: "Batch report generation" },
      { id: "toppers", icon: "🏅", label: "Certificates", tip: "Print topper certificates" }
    ]
  },
  {
    groupLabel: "Schedule", color: "#d97706",
    tabs: [
      { id: "schedule",  icon: "📅", label: "Schedule",         tip: "Exam timetable" },
      { id: "seatplan",  icon: "🪑", label: "Seat Arrangement", tip: "Assign seats & rooms" },
    ]
  },
  {
    groupLabel: "Setup", color: "#7c3aed",
    tabs: [
      { id: "studentsmgr",   icon: "👤", label: "Students",       tip: "Add & manage students" },
      { id: "coursesubjects", icon: "📚", label: "Course Subjects", tip: "Subjects per course/batch" },
      { id: "examtypes",      icon: "⚙️",  label: "Exam Types",     tip: "Configure exam types" },
      { id: "settings",       icon: "🔧", label: "Settings",       tip: "Grading & institute config" },
    ]
  },
];

const INSTITUTE_DEFAULT = {
  name: "Guidance Navodaya & Sainik Institute",
  address: "Khangabok Sorok Wangma Thoubal, Manipur -795138",
  tagline: "A Premier Institute for Navodaya, Sainik & RMS Preparation since 2016",
  principal: "Principal",
  teacher: "Class Teacher",
  logoUrl: "https://postimg.cc/HrDFYwKn",
  academicYear: "2026-2027",
  examDate: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGrade(pct, scale = GRADE_PRESETS) {
  for (const g of scale) if (pct >= g.min) return g;
  return scale[scale.length - 1];
}

// pct = (total / courseMax) * 100
function calcPct(total, course) {
  const max = getCourseMax(course);
  return (total / max) * 100;
}

function printHTML(html, title = "GNSI") {
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    :root{--bg:#F7F6F1;--bg2:#EDEAE2;--border:#D5D0C5;--text:#1C1A16;--text2:#6B6657;--accent:#2A5C45;--gold:#B8860B;}
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);padding:28px;-webkit-font-smoothing:antialiased;}
    .page{max-width:720px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);}
    .header{background:linear-gradient(135deg,#1a3c2e 0%,#2A5C45 60%,#3a7a5c 100%);color:#fff;padding:28px 36px 22px;text-align:center;position:relative;}
    .header::after{content:'';display:block;position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#B8860B,#f0c040,#B8860B);}
    .eyebrow{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:6px;}
    .inst-name{font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:400;margin-bottom:4px;}
    .inst-addr{font-size:12px;color:rgba(255,255,255,.7);}
    .exam-pill{display:inline-block;margin-top:10px;font-size:12px;font-weight:500;background:rgba(255,255,255,.15);border-radius:20px;padding:4px 16px;color:rgba(255,255,255,.9);}
    .body{padding:28px 36px;}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:22px;font-size:13px;}
    .info-cell{padding:11px 16px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);}
    .info-cell:nth-child(even){border-right:none;}
    .info-cell:nth-last-child(-n+2){border-bottom:none;}
    .info-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--text2);margin-bottom:3px;font-weight:600;}
    .info-value{font-weight:600;font-size:14px;}
    table{width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:18px;}
    thead tr{background:#1a3c2e;color:#fff;}
    thead th{padding:10px 14px;font-weight:600;font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;text-align:center;}
    thead th:first-child{text-align:left;}
    tbody td{padding:9px 12px;text-align:center;border-bottom:1px solid var(--border);}
    tbody td:first-child{text-align:left;font-weight:500;}
    tbody tr:last-child td{border-bottom:none;}
    .total-row{background:var(--bg2);font-weight:700;}
    .summary{display:flex;gap:12px;margin-bottom:22px;}
    .sum-card{flex:1;text-align:center;border-radius:10px;padding:14px 10px;border:1px solid var(--border);}
    .sum-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--text2);margin-bottom:8px;font-weight:600;}
    .sum-value{font-family:'Playfair Display',Georgia,serif;font-size:32px;font-weight:600;line-height:1;}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px dashed var(--border);padding-top:18px;margin-top:4px;}
    .sig{text-align:center;}
    .sig-line{border-top:1.5px solid var(--text);width:140px;padding-top:5px;font-size:10.5px;color:var(--text2);letter-spacing:1.5px;text-transform:uppercase;font-weight:600;}
    .stamp{width:64px;height:64px;border-radius:50%;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text2);text-align:center;line-height:1.4;}
    .badge{border-radius:4px;padding:3px 10px;font-weight:600;font-size:11.5px;display:inline-block;}
    .no-print{display:none;}
    @media print{body{background:#fff;padding:0;}.page{box-shadow:none;border-radius:0;}@page{margin:1cm;}.no-print{display:none;}}
  </style></head><body>
  <div class="no-print" style="margin-bottom:14px;text-align:center;">
    <button onclick="window.print()" style="padding:10px 24px;background:#1a3c2e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:14px;">🖨️ Print / Save as PDF</button>
  </div>
  ${html}</body></html>`);
  w.document.close();
}

const css = {
  card:  { background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  input: { padding: "7px 11px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", color: "#111827", fontFamily: "'DM Sans',sans-serif" },
  btn:   { padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
};

// ─── Micro-components ─────────────────────────────────────────────────────────
function Spinner({ small }) {
  return <div style={{ padding: small ? 8 : 40, textAlign: "center", color: "#9CA3AF", fontSize: small ? 12 : 14 }}>⏳ Loading…</div>;
}
function Badge({ label, color, bg }) {
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color, background: bg }}>{label}</span>;
}
function SaveBtn({ onClick, saving, saved, label = "Save" }) {
  return (
    <button onClick={onClick} disabled={saving} style={{ ...css.btn, background: saved ? "#16A34A" : saving ? "#93C5FD" : "#1D4ED8", color: "white" }}>
      {saved ? "✓ Saved!" : saving ? "Saving…" : `💾 ${label}`}
    </button>
  );
}

// ─── Course selector pill bar ─────────────────────────────────────────────────
function CoursePicker({ courses, value, onChange, label = "Batch / Course" }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>{label}</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {courses.map(c => (
          <button key={c} onClick={() => onChange(c)}
            style={{ ...css.btn, padding: "6px 16px", background: value === c ? "#1a3c2e" : "#F3F4F6", color: value === c ? "white" : "#374151", border: value === c ? "none" : "1px solid #E5E7EB", fontSize: 12 }}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── DashStatCard ─────────────────────────────────────────────────────────────
function DashStatCard({ label, value, sub, color, strip }) {
  const strips = {
    blue: "linear-gradient(90deg,#185FA5,#4A90D9)", green: "linear-gradient(90deg,#0F6E56,#2A9D8F)",
    gold: "linear-gradient(90deg,#B8860B,#f0c040)", purple: "linear-gradient(90deg,#534AB7,#7B68EE)",
    red:  "linear-gradient(90deg,#A32D2D,#DC4444)", teal: "linear-gradient(90deg,#0891b2,#38bdf8)",
  };
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: strips[strip] || strips.blue }} />
      <div style={{ fontSize: 10.5, fontWeight: 700, color: color || "#6B7280", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10, marginTop: 2 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 34, fontWeight: 600, lineHeight: 1, color: color || "#1e293b", letterSpacing: "-.5px", marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>{sub}</div>}
    </div>
  );
}

// ─── TabNav ───────────────────────────────────────────────────────────────────
function TabNav({ active, onSelect }) {
  const row1 = TAB_GROUPS.slice(0, 3);
  const row2 = TAB_GROUPS.slice(3);
  const Divider = () => <div style={{ width: 1, background: "#E5E7EB", alignSelf: "stretch", margin: "0 12px" }} />;

  const renderGroup = (grp) => (
    <div key={grp.groupLabel} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: grp.color, textTransform: "uppercase", letterSpacing: ".12em", writingMode: "vertical-rl", transform: "rotate(180deg)", padding: "4px 0", opacity: 0.85, whiteSpace: "nowrap" }}>
        {grp.groupLabel}
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {grp.tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onSelect(tab.id)} title={tab.tip}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 13px", minWidth: 82, borderRadius: 9, border: isActive ? `1.5px solid ${grp.color}` : "1.5px solid #E5E7EB", background: isActive ? `linear-gradient(160deg,${grp.color}14 0%,${grp.color}06 100%)` : "white", boxShadow: isActive ? `0 2px 10px ${grp.color}25` : "0 1px 2px rgba(0,0,0,0.04)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all .15s", position: "relative", overflow: "hidden" }}>
              {isActive && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: grp.color, borderRadius: "9px 9px 0 0" }} />}
              <span style={{ fontSize: 16, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? grp.color : "#6B7280", whiteSpace: "nowrap" }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderRow = (groups) => (
    <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
      {groups.map((grp, i) => (
        <div key={grp.groupLabel} style={{ display: "flex", alignItems: "center" }}>
          {renderGroup(grp)}{i < groups.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "10px 24px", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
      {renderRow(row1)}
      <div style={{ height: 1, background: "#F1F5F9", margin: "0 -4px" }} />
      {renderRow(row2)}
    </div>
  );
}

// ─── Remarks Hook ─────────────────────────────────────────────────────────────
function useRemarks(studentId, examTypeId, examDate) {
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!studentId || !examTypeId || !examDate) return;
    supabase.from("exam_remarks").select("remark")
      .eq("student_id", studentId).eq("exam_type_id", examTypeId).eq("exam_date", examDate)
      .maybeSingle().then(({ data }) => { if (data?.remark) setRemark(data.remark); });
  }, [studentId, examTypeId, examDate]);

  const save = async (val) => {
    setSaving(true);
    await supabase.from("exam_remarks").upsert(
      { student_id: studentId, exam_type_id: examTypeId, exam_date: examDate, remark: val },
      { onConflict: "student_id,exam_type_id,exam_date" }
    );
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return { remark, setRemark, save, saving, saved };
}

// ─── STUDENTS TAB ─────────────────────────────────────────────────────────────
function StudentsTab({ courseSubjects, students, onStudentsChange, currentUser }) {
  const perm = usePerm(currentUser)
  const courses = Object.keys(courseSubjects);

  const EMPTY_FORM = { name: "", gcc_no: "", admission_no: "", course: courses[0] || "", class_name: "" };
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [editId, setEditId]         = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [deleteId, setDeleteId]     = useState(null);
  const [view, setView]             = useState("list");

  const batchesForCourse = (crs) => {
    const set = new Set(
      students.filter(s => (s.course || "").toUpperCase() === crs).map(s => s.class_name).filter(Boolean)
    );
    return [...set].sort();
  };

  const handleAdd = async () => {
    setError("");
    if (!form.name.trim())       { setError("Student name is required."); return; }
    if (!form.gcc_no.trim())     { setError("GCC No. is required."); return; }
    if (!form.course)            { setError("Course is required."); return; }
    if (!form.class_name.trim()) { setError("Batch is required."); return; }
    if (students.find(s => String(s.gcc_no) === String(form.gcc_no).trim())) {
      setError(`GCC No. ${form.gcc_no} already exists.`); return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim().toUpperCase(), gcc_no: Number(form.gcc_no),
      admission_no: form.admission_no.trim() || null,
      course: form.course.toUpperCase(), class_name: form.class_name.trim().toUpperCase(),
    };
    const { data, error: sbErr } = await supabase.from("students").insert([payload]).select();
    if (sbErr) { setError(sbErr.message); setSaving(false); return; }
    onStudentsChange([...students, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
    setForm(EMPTY_FORM); setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); setView("list"); }, 1800);
  };

  const startEdit = (st) => {
    setEditId(st.id);
    setEditForm({ name: st.name, gcc_no: st.gcc_no, admission_no: st.admission_no || "", course: st.course || "", class_name: st.class_name || "" });
  };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };
  const saveEdit = async (id) => {
    setEditSaving(true);
    const payload = {
      name: editForm.name.trim().toUpperCase(), gcc_no: Number(editForm.gcc_no),
      admission_no: editForm.admission_no || null,
      course: (editForm.course || "").toUpperCase(), class_name: (editForm.class_name || "").trim().toUpperCase(),
    };
    const { error: sbErr } = await supabase.from("students").update(payload).eq("id", id);
    if (sbErr) { alert(sbErr.message); setEditSaving(false); return; }
    onStudentsChange(students.map(s => s.id === id ? { ...s, ...payload } : s));
    setEditId(null); setEditSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from("students").delete().eq("id", deleteId);
    onStudentsChange(students.filter(s => s.id !== deleteId));
    setDeleteId(null);
  };

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search);
    const matchCourse = filterCourse === "ALL" || (s.course || "").toUpperCase() === filterCourse || (s.class_name || "").toUpperCase() === filterCourse;
    return matchSearch && matchCourse;
  });

  const statsPerCourse = courses.map(c => ({
    course: c, count: students.filter(s => (s.course || "").toUpperCase() === c).length, batches: batchesForCourse(c),
  }));

  const EditCell = ({ field, width = 120, type = "text" }) => (
    <input type={type} value={editForm[field] ?? ""}
      onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
      style={{ width, padding: "4px 7px", borderRadius: 6, border: "1.5px solid #6366f1", fontSize: 12, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
  );

  return (
    <div>
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 14, padding: 28, maxWidth: 380, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, textAlign: "center", marginBottom: 8 }}>Delete Student?</div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 22 }}>
              This will permanently remove <b>{students.find(s => s.id === deleteId)?.name}</b> and all their exam marks. This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ ...css.btn, flex: 1, background: "#F3F4F6", color: "#374151" }}>Cancel</button>
              <button onClick={confirmDelete} style={{ ...css.btn, flex: 1, background: "#DC2626", color: "white" }}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setView("list")} style={{ ...css.btn, padding: "8px 20px", background: view === "list" ? "#1a3c2e" : "#F3F4F6", color: view === "list" ? "white" : "#374151" }}>
          📋 All Students ({students.length})
        </button>
        <button onClick={() => { setView("add"); setError(""); setForm(EMPTY_FORM); setSaved(false); }} style={{ ...css.btn, padding: "8px 20px", background: view === "add" ? "#1a3c2e" : "#F3F4F6", color: view === "add" ? "white" : "#374151" }}>
          ➕ Add New Student
        </button>
      </div>

      {view === "add" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ background: "linear-gradient(135deg,#1a3c2e,#2A5C45)", padding: "18px 24px" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "white", fontWeight: 400 }}>➕ Register New Student</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>Fill in the details below to add a student to the portal</div>
            </div>
            <div style={{ padding: 24 }}>
              {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}
              {saved && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>✅ Student added successfully!</div>}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Full Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. LAISHRAM TOMTHIN SINGH" style={{ ...css.input, fontSize: 14 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>GCC No. *</label>
                  <input type="number" value={form.gcc_no} onChange={e => setForm(p => ({ ...p, gcc_no: e.target.value }))} placeholder="e.g. 1125" style={css.input} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Admission No.</label>
                  <input value={form.admission_no} onChange={e => setForm(p => ({ ...p, admission_no: e.target.value }))} placeholder="Optional" style={css.input} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Course *</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {courses.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, course: c, class_name: "" }))}
                      style={{ ...css.btn, padding: "6px 16px", fontSize: 12, background: form.course === c ? "#1a3c2e" : "#F3F4F6", color: form.course === c ? "white" : "#374151", border: form.course === c ? "none" : "1px solid #E5E7EB" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Batch *</label>
                {batchesForCourse(form.course).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {batchesForCourse(form.course).map(b => (
                      <button key={b} onClick={() => setForm(p => ({ ...p, class_name: b }))}
                        style={{ ...css.btn, padding: "5px 14px", fontSize: 12, background: form.class_name === b ? "#7c3aed" : "#F5F3FF", color: form.class_name === b ? "white" : "#5B21B6", border: form.class_name === b ? "none" : "1px solid #DDD6FE" }}>
                        {b}
                      </button>
                    ))}
                  </div>
                )}
                <input value={form.class_name} onChange={e => setForm(p => ({ ...p, class_name: e.target.value }))} placeholder="Type batch name or pick above…" style={css.input} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setView("list"); setError(""); }} style={{ ...css.btn, background: "#F3F4F6", color: "#374151", flex: 1 }}>Cancel</button>
                <button onClick={handleAdd} disabled={saving} style={{ ...css.btn, background: saving ? "#93C5FD" : "#1a3c2e", color: "white", flex: 2, fontSize: 14 }}>
                  {saving ? "⏳ Saving…" : "✅ Add Student"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "list" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
            {statsPerCourse.map(s => (
              <div key={s.course} style={{ background: "white", borderRadius: 10, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: "3px solid #1a3c2e" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".08em" }}>{s.course}</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 600, color: "#1a3c2e", lineHeight: 1.2, marginTop: 4 }}>{s.count}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>{s.batches.join(", ") || "no batches"}</div>
              </div>
            ))}
            <div style={{ background: "#1a3c2e", borderRadius: 10, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: ".08em" }}>Total</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 600, color: "white", lineHeight: 1.2, marginTop: 4 }}>{students.length}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>students enrolled</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="🔍 Search by name or GCC…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, flex: 1, minWidth: 200 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["ALL", ...courses].map(c => (
                <button key={c} onClick={() => setFilterCourse(c)}
                  style={{ ...css.btn, padding: "6px 14px", fontSize: 11, background: filterCourse === c ? "#1a3c2e" : "#F3F4F6", color: filterCourse === c ? "white" : "#374151", border: filterCourse === c ? "none" : "1px solid #E5E7EB" }}>
                  {c}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>{filtered.length} students</div>
          </div>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1a3c2e" }}>
                  {["GCC No.", "Name", "Batch", "Course", "Admission No.", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "Name" ? "left" : "center", color: "white", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((st, i) => (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    {editId === st.id ? (
                      <>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}><EditCell field="gcc_no" width={70} type="number" /></td>
                        <td style={{ padding: "6px 10px" }}><EditCell field="name" width={200} /></td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}><EditCell field="class_name" width={100} /></td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <select value={editForm.course || ""} onChange={e => setEditForm(p => ({ ...p, course: e.target.value }))} style={{ ...css.input, width: 120, fontSize: 12 }}>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}><EditCell field="admission_no" width={90} /></td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button onClick={() => saveEdit(st.id)} disabled={editSaving} style={{ ...css.btn, padding: "4px 12px", background: "#1a3c2e", color: "white", fontSize: 12 }}>{editSaving ? "…" : "✓ Save"}</button>
                            <button onClick={cancelEdit} style={{ ...css.btn, padding: "4px 10px", background: "#F3F4F6", color: "#374151", fontSize: 12 }}>✕</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "9px 14px", textAlign: "center", fontWeight: 700, color: "#1a3c2e" }}>{st.gcc_no}</td>
                        <td style={{ padding: "9px 14px", fontWeight: 600, color: "#1e293b" }}>{st.name}</td>
                        <td style={{ padding: "9px 14px", textAlign: "center" }}>
                          <span style={{ background: "#E0F2FE", color: "#0369A1", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.class_name || "—"}</span>
                        </td>
                        <td style={{ padding: "9px 14px", textAlign: "center" }}>
                          <span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.course || "—"}</span>
                        </td>
                        <td style={{ padding: "9px 14px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>{st.admission_no || "—"}</td>
                        <td style={{ padding: "9px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button onClick={() => startEdit(st)} style={{ ...css.btn, padding: "4px 12px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", fontSize: 12 }}>✏️ Edit</button>
                            {perm.canDelete && <button onClick={() => setDeleteId(st.id)} style={{ ...css.btn, padding: "4px 10px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>🗑️</button>}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No students found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MARK ENTRY ───────────────────────────────────────────────────────────────
function MarkEntry({ courseSubjects, examTypes, students, currentUser }) {
  const perm = usePerm(currentUser)
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase() ||
    (s.course || "").toUpperCase() === course.toUpperCase()
  );
  const courseMax = getCourseMax(course);

  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [importMode, setImportMode] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importInfo, setImportInfo] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [absentSet, setAbsentSet] = useState(new Set());
  const fileInputRef = useRef(null);

  const fetchMarks = useCallback(async (typeId, date, crs) => {
    if (!typeId || !date || !crs) return;
    setLoading(true);
    const ids = students.filter(s =>
      (s.class_name || "").toUpperCase() === crs.toUpperCase() ||
      (s.course || "").toUpperCase() === crs.toUpperCase()
    ).map(s => s.id);
    if (!ids.length) { setMarks({}); setLoading(false); return; }
    const { data } = await supabase.from("exam_marks").select("*")
      .eq("exam_type_id", typeId).eq("exam_date", date).in("student_id", ids);
    const map = {};
    (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; });
    setMarks(map); setLoading(false);
  }, [students]);

  useEffect(() => { fetchMarks(examType, examDate, course); }, [examType, examDate, course]);

  const handleMark = (sid, sub, val) => { setMarks(p => ({ ...p, [`${sid}-${sub}`]: val })); setSaved(false); };
  const toggleAbsent = (sid, sub) => {
    const key = `${sid}-${sub}`
    setAbsentSet(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else { next.add(key); setMarks(p => ({ ...p, [key]: 0 })); setSaved(false) } return next })
  }
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    const rows = [];
    for (const st of courseStudents) {
      for (const sub of subjects) {
        const m = Number(marks[`${st.id}-${sub}`]);
        if (!isNaN(m)) rows.push({
          student_id: st.id, student_name: st.name, class_name: st.class_name,
          exam_type_id: examType, subject: sub, marks: m,
          total_marks: getSubjectMax(course, sub),
          exam_date: examDate,
        });
      }
    }
    for (let i = 0; i < rows.length; i += 100)
      await supabase.from("exam_marks").upsert(rows.slice(i, i + 100), { onConflict: "student_id,exam_type_id,subject,exam_date" });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const downloadTemplate = () => {
    const headers = ["Student Name", "GCC NO", ...subjects];
    const rows = courseStudents.map(st => [st.name, st.gcc_no || st.admission_no || "", ...subjects.map(() => "")]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `GNSI_Template_${course}_${examDate}.csv`;
    a.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    await ensureLibs(); const XLSX = window.XLSX; let rows = [];
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      const text = await file.text();
      const lines = text.trim().split("\n").map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
      rows = lines;
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    }
    if (!rows.length) return;
    const headers = rows[0].map(h => String(h).trim());
    const courseCol = headers.findIndex(h => /^course$/i.test(h));
    let detectedCourse = course;
    if (courseCol !== -1 && rows.length > 1) {
      const raw = rows[1][courseCol]?.toString().trim().toUpperCase();
      if (raw && courseSubjects[raw]) detectedCourse = raw;
      else if (raw) { const match = Object.keys(courseSubjects).find(k => raw.includes(k) || k.includes(raw)); if (match) detectedCourse = match; }
    }
    const importSubjects = courseSubjects[detectedCourse] || subjects;
    const subjectCols = importSubjects.map(sub => ({ sub, col: headers.findIndex(h => h.toLowerCase().trim() === sub.toLowerCase().trim()) }));
    const nameCol = headers.findIndex(h => /name/i.test(h));
    const gccCol  = headers.findIndex(h => /gcc/i.test(h));
    const admCol  = headers.findIndex(h => /admission|adm|roll/i.test(h));
    if (nameCol === -1) { alert("Could not find a 'STUDENTS NAME' column in the file."); return; }
    const allStudentsForCourse = students.filter(s => (s.class_name || "").toUpperCase() === detectedCourse || (s.course || "").toUpperCase() === detectedCourse);
    const matchPool = allStudentsForCourse.length ? allStudentsForCourse : students;
    const matched = []; const errors = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawName = row[nameCol]?.toString().trim(); if (!rawName) continue;
      const rawGcc = gccCol !== -1 ? row[gccCol]?.toString().trim() : "";
      const rawAdm = admCol !== -1 ? row[admCol]?.toString().trim() : "";
      let student = rawGcc ? matchPool.find(s => String(s.gcc_no).trim() === rawGcc) : null;
      if (!student && rawAdm) student = matchPool.find(s => String(s.admission_no).trim() === rawAdm);
      if (!student) student = matchPool.find(s => s.name?.toLowerCase() === rawName.toLowerCase());
      if (!student) student = matchPool.find(s => s.name?.toLowerCase().startsWith(rawName.toLowerCase().slice(0, 8)));
      if (!student) { errors.push(rawName); continue; }
      const subMarks = {};
      subjectCols.forEach(({ sub, col }) => { if (col !== -1) { const v = Number(row[col]); if (!isNaN(v) && row[col] !== "") subMarks[sub] = v; } });
      matched.push({ student, subMarks });
    }
    setImportRows(matched); setImportErrors(errors);
    setImportInfo({ detectedCourse, subjects: importSubjects });
    setImportMode(true); setImportDone(false);
    if (detectedCourse !== course) setCourse(detectedCourse);
  };

  const confirmImport = async () => {
    setImporting(true);
    const importSubjects = importInfo?.subjects || subjects;
    const detCourse = importInfo?.detectedCourse || course;
    const rows = [];
    for (const { student: st, subMarks } of importRows) {
      for (const sub of importSubjects) {
        if (subMarks[sub] !== undefined) {
          rows.push({
            student_id: st.id, student_name: st.name, class_name: st.class_name,
            exam_type_id: examType, subject: sub, marks: subMarks[sub],
            total_marks: getSubjectMax(detCourse, sub),
            exam_date: examDate,
          });
        }
      }
    }
    for (let i = 0; i < rows.length; i += 100)
      await supabase.from("exam_marks").upsert(rows.slice(i, i + 100), { onConflict: "student_id,exam_type_id,subject,exam_date" });
    await fetchMarks(examType, examDate, importInfo?.detectedCourse || course);
    setImporting(false); setImportDone(true);
    setTimeout(() => { setImportMode(false); setImportRows([]); setImportErrors([]); setImportInfo(null); setImportDone(false); }, 2500);
  };

  const handleExport = async () => {
    await ensureLibs(); const XLSX = window.XLSX;
    const headers = ["Student", "Class", ...subjects, "Total", "%", "Grade"];
    const rows = courseStudents.map(st => {
      const total = getTotal(st.id);
      const pct = calcPct(total, course);
      const g = getGrade(pct);
      return [st.name, st.class_name, ...subjects.map(s => marks[`${st.id}-${s}`] ?? ""), total, pct.toFixed(1) + "%", g.label];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks");
    XLSX.writeFile(wb, `GNSI_${course}_Marks_${examDate}.xlsx`);
  };

  const filtered = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  const ImportPreview = () => {
    const previewSubjects = importInfo?.subjects || subjects;
    const detCourse = importInfo?.detectedCourse || course;
    return (
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.10)", padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, color: "#1e293b" }}>📂 Import Preview</div>
          <button onClick={() => { setImportMode(false); setImportRows([]); setImportErrors([]); setImportInfo(null); }}
            style={{ ...css.btn, padding: "5px 12px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>✕ Cancel</button>
        </div>
        {importInfo && (
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: "#1D4ED8" }}>🎯 Auto-detected batch: </span>
            <span style={{ fontWeight: 800, color: "#1a3c2e", background: "#D1FAE5", padding: "2px 10px", borderRadius: 999 }}>{importInfo.detectedCourse}</span>
            <span style={{ color: "#64748b", marginLeft: 8 }}>Max: {getCourseMax(detCourse)} marks</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#E1F5EE", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", textTransform: "uppercase" }}>Matched</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: "#0F6E56" }}>{importRows.length}</div>
          </div>
          <div style={{ flex: 1, background: importErrors.length ? "#FCEBEB" : "#F9FAFB", border: `1px solid ${importErrors.length ? "#FECACA" : "#E5E7EB"}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: importErrors.length ? "#A32D2D" : "#9CA3AF", textTransform: "uppercase" }}>Unmatched</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: importErrors.length ? "#A32D2D" : "#9CA3AF" }}>{importErrors.length}</div>
          </div>
          <div style={{ flex: 2, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase" }}>Exam</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1D4ED8", marginTop: 4 }}>{examTypes.find(e => e.id === examType)?.name} · {examDate}</div>
            <div style={{ fontSize: 11, color: "#93C5FD", marginTop: 2 }}>Existing marks will be overwritten</div>
          </div>
        </div>
        {importErrors.length > 0 && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: "#92400E" }}>⚠️ Could not match: </span>
            <span style={{ color: "#78350F" }}>{importErrors.join(", ")}</span>
          </div>
        )}
        <div style={{ overflowX: "auto", marginBottom: 16, maxHeight: 340, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr style={{ background: "#1a3c2e" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "white", fontWeight: 700 }}>Student</th>
                <th style={{ padding: "8px 10px", textAlign: "left", color: "white", fontWeight: 700 }}>Class</th>
                {previewSubjects.map(s => <th key={s} style={{ padding: "8px 8px", textAlign: "center", color: "white", fontWeight: 700, whiteSpace: "nowrap" }}>{s}</th>)}
                <th style={{ padding: "8px 10px", textAlign: "center", color: "white", fontWeight: 700 }}>Total</th>
                <th style={{ padding: "8px 10px", textAlign: "center", color: "white", fontWeight: 700 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {importRows.map(({ student: st, subMarks }, i) => {
                const total = previewSubjects.reduce((s, sub) => s + (subMarks[sub] ?? 0), 0);
                const pct = calcPct(total, detCourse);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "7px 12px", fontWeight: 600 }}>{st.name}</td>
                    <td style={{ padding: "7px 10px", color: "#64748b", fontSize: 11 }}>{st.class_name}</td>
                    {previewSubjects.map(sub => (
                      <td key={sub} style={{ padding: "7px 8px", textAlign: "center", color: subMarks[sub] !== undefined ? "#1e293b" : "#CBD5E1", fontWeight: subMarks[sub] !== undefined ? 600 : 400 }}>
                        {subMarks[sub] !== undefined ? subMarks[sub] : "--"}
                      </td>
                    ))}
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 800 }}>{total}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: getGrade(pct).color }}>{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {importDone
          ? <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✅ Import complete!</div>
          : <button onClick={confirmImport} disabled={importing || !importRows.length}
              style={{ ...css.btn, background: importing ? "#93C5FD" : "#1a3c2e", color: "white", padding: "10px 24px", fontSize: 14 }}>
              {importing ? "⏳ Saving…" : `✅ Confirm Import (${importRows.length} students)`}
            </button>
        }
      </div>
    );
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
        {subjects.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {subjects.map(s => (
              <span key={s} style={{ fontSize: 11, padding: "3px 10px", background: "#E0F2FE", color: "#0369A1", borderRadius: 999, fontWeight: 600 }}>
                {s} <span style={{ opacity: 0.6 }}>/{getSubjectMax(course, s)}</span>
              </span>
            ))}
            <span style={{ fontSize: 11, padding: "3px 10px", background: "#1a3c2e", color: "white", borderRadius: 999, fontWeight: 700 }}>Total: {courseMax}</span>
          </div>
        )}
        {courseStudents.length === 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#EF4444", fontWeight: 600 }}>
            ⚠️ No students found for <b>{course}</b>.
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Date</label>
          <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Search Student</label>
          <input placeholder="Name…" value={search} onChange={e => setSearch(e.target.value)} style={css.input} />
        </div>
        <SaveBtn onClick={handleSave} saving={saving} saved={saved} label="Save Marks" />
        <button onClick={handleExport} style={{ ...css.btn, background: "#E1F5EE", color: "#0F6E56", border: "1px solid #BBF7D0" }}>📥 Excel</button>
        <div style={{ width: 1, background: "#E5E7EB", alignSelf: "stretch" }} />
        <button onClick={downloadTemplate} style={{ ...css.btn, background: "#FAFAF9", color: "#6B7280", border: "1px solid #E5E7EB" }}>📋 Template</button>
        {perm?.canImport !== false && <button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#7c3aed", color: "white" }}>📂 Import Excel / CSV</button>}
      </div>
      {saved && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>✅ Marks saved!</div>}
      {importMode && <ImportPreview />}
      {loading ? <Spinner /> : (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#1a3c2e" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 12 }}>Student</th>
                {subjects.map(s => (
                  <th key={s} style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>
                    {s}<br /><span style={{ opacity: 0.6, fontWeight: 400 }}>/{getSubjectMax(course, s)}</span>
                  </th>
                ))}
                <th style={{ padding: "10px 10px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 12 }}>Total<br /><span style={{ opacity: 0.6, fontWeight: 400, fontSize: 10 }}>/{courseMax}</span></th>
                <th style={{ padding: "10px 10px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 12 }}>%</th>
                <th style={{ padding: "10px 10px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 12 }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((st, i) => {
                const total = getTotal(st.id);
                const pct = calcPct(total, course);
                const g = getGrade(pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 14px" }}>
                      <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{st.name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{st.class_name} · GCC {st.gcc_no}</div>
                    </td>
                    {subjects.map(sub => (
                      <td key={sub} style={{ padding: "6px 4px", textAlign: "center" }}>
                        <input type="number" min="0" max={getSubjectMax(course, sub)} placeholder="--"
                          value={marks[`${st.id}-${sub}`] ?? ""}
                          onChange={e => handleMark(st.id, sub, e.target.value)}
                          style={{ width: 56, padding: "5px 4px", borderRadius: 6, border: "1px solid #D1D5DB", textAlign: "center", fontSize: 13, outline: "none" }} />
                        <button onClick={() => toggleAbsent(st.id, sub)} style={{ fontSize:9, padding:'1px 5px', borderRadius:3, border:'1px solid #FECACA', background: absentSet.has(`${st.id}-${sub}`) ? '#FCA5A5' : '#F9FAFB', color: absentSet.has(`${st.id}-${sub}`) ? '#DC2626' : '#9CA3AF', cursor:'pointer', fontWeight:700 }}>{absentSet.has(`${st.id}-${sub}`) ? 'ABS' : 'A'}</button>
                      </td>
                    ))}
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800 }}>{total}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", color: g.color, fontWeight: 700 }}>{pct.toFixed(1)}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={subjects.length + 4} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No students found for <b>{course}</b>.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MARKS GRID ───────────────────────────────────────────────────────────────
function MarksGrid({ courseSubjects, examTypes, students }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    setLoading(true);
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; });
      setMarks(map); setLoading(false);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
      </div>
      {loading ? <Spinner /> : (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#1a3c2e" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 12 }}>Student</th>
              {subjects.map(s => (
                <th key={s} style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>
                  {s}<br /><span style={{ opacity: 0.6, fontWeight: 400, fontSize: 10 }}>/{getSubjectMax(course, s)}</span>
                </th>
              ))}
              <th style={{ padding: "10px 10px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 12 }}>Total<br /><span style={{ opacity: 0.6, fontWeight: 400, fontSize: 10 }}>/{courseMax}</span></th>
              <th style={{ padding: "10px 10px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 12 }}>%</th>
              <th style={{ padding: "10px 10px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 12 }}>Grade</th>
            </tr></thead>
            <tbody>
              {courseStudents.map((st, i) => {
                const total = getTotal(st.id);
                const pct = calcPct(total, course);
                const g = getGrade(pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 600, color: "#1e293b" }}>{st.name}<div style={{ fontSize: 11, color: "#9CA3AF" }}>GCC {st.gcc_no}</div></td>
                    {subjects.map(sub => <td key={sub} style={{ padding: "8px 8px", textAlign: "center" }}>{marks[`${st.id}-${sub}`] ?? <span style={{ color: "#CBD5E1" }}>--</span>}</td>)}
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800 }}>{total}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", color: g.color, fontWeight: 700 }}>{pct.toFixed(1)}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function Analytics({ courseSubjects, examTypes, students }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const gradeRef = useRef(null); const subjectRef = useRef(null); const passRef = useRef(null);
  const chartsRef = useRef([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const n = courseStudents.length || 1;

  const gradeCounts = {}; GRADE_PRESETS.forEach(g => { gradeCounts[g.label] = 0; });
  const subjectAvgPct = {}; const subjectPass = {};
  subjects.forEach(s => { subjectAvgPct[s] = 0; subjectPass[s] = 0; });

  courseStudents.forEach(st => {
    const pct = calcPct(getTotal(st.id), course);
    const g = getGrade(pct); gradeCounts[g.label] = (gradeCounts[g.label] || 0) + 1;
    subjects.forEach(sub => {
      const m = Number(marks[`${st.id}-${sub}`]) || 0;
      const subMax = getSubjectMax(course, sub);
      subjectAvgPct[sub] += (m / subMax) * 100;
      if ((m / subMax) * 100 >= 40) subjectPass[sub]++;
    });
  });
  subjects.forEach(s => { subjectAvgPct[s] = Math.round(subjectAvgPct[s] / n * 10) / 10; });

  const passed = courseStudents.filter(st => calcPct(getTotal(st.id), course) >= 40).length;
  const classAvg = (courseStudents.reduce((s, st) => s + calcPct(getTotal(st.id), course), 0) / n).toFixed(1);
  const highest = courseStudents.length ? Math.max(...courseStudents.map(st => getTotal(st.id))) : 0;
  const lowest  = courseStudents.length ? Math.min(...courseStudents.map(st => getTotal(st.id))) : 0;

  useEffect(() => {
    ensureLibs().then(() => {
      const Chart = window.Chart; if (!Chart) return;
      chartsRef.current = (chartsRef.current || []).filter(Boolean)
      chartsRef.current.forEach(c => { try { if (c && typeof c.destroy === 'function') c.destroy() } catch(_){} })
      chartsRef.current = [];
      if (gradeRef.current) {
        const labels = GRADE_PRESETS.map(g => g.label);
        chartsRef.current.push(new Chart(gradeRef.current, { type: "doughnut", data: { labels, datasets: [{ data: labels.map(l => gradeCounts[l] || 0), backgroundColor: GRADE_PRESETS.map(g => g.color), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } } }));
      }
      if (subjectRef.current) {
        chartsRef.current.push(new Chart(subjectRef.current, { type: "bar", data: { labels: subjects, datasets: [{ label: "Avg %", data: subjects.map(s => subjectAvgPct[s]), backgroundColor: "#2A5C45", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } } }));
      }
      if (passRef.current) {
        chartsRef.current.push(new Chart(passRef.current, { type: "bar", data: { labels: subjects, datasets: [{ label: "Pass Rate %", data: subjects.map(s => Math.round((subjectPass[s] / n) * 100)), backgroundColor: "#185FA5", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } } }));
      }
    });
    return () => { chartsRef.current.forEach(c => { try { c.destroy(); } catch (_) {} }); chartsRef.current = []; };
  }, [marks, course]);

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
        <DashStatCard label={`${course} Students`} value={courseStudents.length} strip="blue" color="#185FA5" />
        <DashStatCard label="Class Average" value={`${classAvg}%`} strip="teal" color="#0891b2" />
        <DashStatCard label="Pass Rate" value={`${Math.round(passed / n * 100)}%`} sub={`${passed} passed`} strip="green" color="#0F6E56" />
        <DashStatCard label="Highest Total" value={`${highest}/${courseMax}`} strip="gold" color="#B8860B" />
        <DashStatCard label="Lowest Total" value={`${lowest}/${courseMax}`} strip="red" color="#A32D2D" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={css.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#1e293b', fontFamily:"'Playfair Display',serif" }}>Grade Distribution</div>
              <button onClick={() => { if (!gradeRef.current) return; const a = document.createElement('a'); a.download=`grade-${course}.png`; a.href=gradeRef.current.toDataURL('image/png'); a.click() }}
                style={{ ...css.btn, padding:'4px 10px', background:'#F3F4F6', color:'#374151', border:'1px solid #E5E7EB', fontSize:11 }}>⬇ PNG</button>
            </div>
            <div style={{ height: 260 }}><canvas ref={gradeRef} /></div>
          </div>
        <div style={css.card}><div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 14, fontFamily: "'Playfair Display',serif" }}>Subject-wise Average %</div><div style={{ height: 260 }}><canvas ref={subjectRef} /></div></div>
      </div>
      <div style={css.card}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 14, fontFamily: "'Playfair Display',serif" }}>Subject-wise Pass Rate</div>
        <div style={{ height: 260 }}><canvas ref={passRef} /></div>
      </div>
    </div>
  );
}

// ─── RANKINGS ─────────────────────────────────────────────────────────────────
function Rankings({ courseSubjects, examTypes, students }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const ranked = [...courseStudents].map(st => ({ ...st, total: getTotal(st.id), pct: calcPct(getTotal(st.id), course) })).sort((a, b) => b.total - a.total);
  let cr = 1, pt = null;
  const rankedWithRanks = ranked.map((st, i) => { if (i === 0) { cr = 1; pt = st.total; } else if (st.total !== pt) { cr++; pt = st.total; } return { ...st, rank: cr }; });
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        {rankedWithRanks.slice(0, 3).map((st, i) => {
          const g = getGrade(st.pct);
          const podiumColor = i === 0 ? "#B8860B" : i === 1 ? "#94A3B8" : "#CD7F32";
          return (
            <div key={st.id} style={{ ...css.card, textAlign: "center", borderTop: `4px solid ${podiumColor}`, position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", width: 28, height: 28, borderRadius: "50%", background: podiumColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white" }}>{i + 1}</div>
              <div style={{ fontSize: 32, marginTop: 14, marginBottom: 6 }}>{medals[i]}</div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{st.name}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>GCC {st.gcc_no}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 600, color: g.color }}>{st.total}<span style={{ fontSize: 14, color: "#9CA3AF" }}>/{courseMax}</span></div>
              <div style={{ fontSize: 13, color: g.color, fontWeight: 700, marginBottom: 8 }}>{st.pct.toFixed(1)}%</div>
              <div><Badge label={g.label} color={g.color} bg={g.bg} /></div>
            </div>
          );
        })}
      </div>
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>🏆 Full Rankings — {course}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
            {["Rank", "Student", "GCC No", "Total", "%", "Grade"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: h === "Student" ? "left" : "center", fontWeight: 700, color: "#374151", fontSize: 12 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rankedWithRanks.map((st, i) => {
              const g = getGrade(st.pct);
              return (
                <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: st.rank <= 3 ? "#D97706" : "#9CA3AF", fontSize: st.rank <= 3 ? 16 : 13 }}>{st.rank <= 3 ? medals[st.rank - 1] : `#${st.rank}`}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{st.name}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{st.gcc_no || "—"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800 }}>{st.total}<span style={{ fontSize: 10, color: "#9CA3AF" }}>/{courseMax}</span></td>
                  <td style={{ padding: "10px 14px", textAlign: "center", color: g.color, fontWeight: 700 }}>{st.pct.toFixed(1)}%</td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MERIT LIST ───────────────────────────────────────────────────────────────
function MeritList({ courseSubjects, examTypes, students }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const [rankFilter, setRankFilter] = useState("");

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const ranked = [...courseStudents].map(st => ({ ...st, total: getTotal(st.id), pct: calcPct(getTotal(st.id), course) })).sort((a, b) => b.total - a.total);
  let cr = 1, pt = null;
  const rankedWithRanks = ranked.map((st, i) => { if (i === 0) { cr = 1; pt = st.total; } else if (st.total !== pt) { cr++; pt = st.total; } return { ...st, rank: cr }; });
  const filtered = rankedWithRanks.filter(st => !rankFilter || st.rank <= parseInt(rankFilter));
  const medals = ["🥇", "🥈", "🥉"];

  const handlePrint = () => {
    const rows = filtered.map((st, i) => {
      const grade = getGrade(st.pct);
      const medal = i < 3 ? medals[i] : "";
      return `<tr><td style="text-align:center">${medal} ${st.rank}</td><td>${st.name}</td><td style="text-align:center">${st.gcc_no || "—"}</td><td style="text-align:center;font-weight:700">${st.total}/${courseMax}</td><td style="text-align:center">${st.pct.toFixed(1)}%</td><td style="text-align:center"><span class="badge" style="background:${grade.bg};color:${grade.color}">${grade.label}</span></td></tr>`;
    }).join("");
    printHTML(`<div class="page"><div class="header"><div class="eyebrow">Merit List · ${course}</div><div class="inst-name">Guidance Navodaya & Sainik Institute</div><div class="inst-addr">Khangabok, Manipur</div><div class="exam-pill">${examTypes.find(e => e.id === examType)?.name || ""} · ${examDate}</div></div><div class="body"><table><thead><tr><th>Rank</th><th style="text-align:left">Student</th><th>GCC No</th><th>Total</th><th>%</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table></div></div>`, `Merit List – ${course}`);
  };

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Top Rank</label>
          <select value={rankFilter} onChange={e => setRankFilter(e.target.value)} style={{ ...css.input, width: 120 }}><option value="">All</option><option value="3">Top 3</option><option value="5">Top 5</option><option value="10">Top 10</option><option value="20">Top 20</option></select></div>
        <button onClick={handlePrint} style={{ ...css.btn, background: "#1a3c2e", color: "white" }}>🖨️ Print</button>
      </div>
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📜 Merit List — {course} ({filtered.length} students)</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
            {["Rank", "Student", "GCC No", "Total", "%", "Grade"].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: h === "Student" ? "left" : "center", fontWeight: 700, color: "#374151", fontSize: 12 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((st, i) => {
              const grade = getGrade(st.pct);
              return (
                <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: i < 3 ? 16 : 13, color: i < 3 ? "#D97706" : "#374151" }}>{i < 3 ? medals[i] : ""} {st.rank}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{st.name}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748b" }}>{st.gcc_no || "—"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800 }}>{st.total}<span style={{ fontSize: 10, color: "#9CA3AF" }}>/{courseMax}</span></td>
                  <td style={{ padding: "10px 12px", textAlign: "center", color: grade.color, fontWeight: 700 }}>{st.pct.toFixed(1)}%</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}><Badge label={grade.label} color={grade.color} bg={grade.bg} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── COURSE SUBJECTS MANAGER ──────────────────────────────────────────────────
function CourseSubjectsManager({ courseSubjects, onUpdate }) {
  const courses = Object.keys(courseSubjects);
  const [selected, setSelected] = useState(courses[0] || "");
  const [list, setList] = useState(courseSubjects[selected] || []);
  const [newSub, setNew] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setList(courseSubjects[selected] || []); }, [selected, courseSubjects]);

  const save = async () => {
    setSaving(true);
    const updated = { ...courseSubjects, [selected]: list };
    await supabase.from("system_settings").upsert({ key: "course_subjects", value: JSON.stringify(updated) }, { onConflict: "key" });
    onUpdate(updated); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addCourse = () => {
    const name = newCourse.trim().toUpperCase();
    if (!name || courseSubjects[name]) return;
    const updated = { ...courseSubjects, [name]: [] };
    onUpdate(updated); setSelected(name); setList([]); setNewCourse("");
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 17, color: "#1e293b", marginBottom: 16 }}>📚 Subjects per Course / Batch</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {Object.keys(courseSubjects).map(c => (
            <button key={c} onClick={() => setSelected(c)}
              style={{ ...css.btn, padding: "6px 18px", background: selected === c ? "#1a3c2e" : "#F3F4F6", color: selected === c ? "white" : "#374151", border: "1.5px solid " + (selected === c ? "#1a3c2e" : "#E5E7EB") }}>
              {c} <span style={{ fontSize: 11, opacity: 0.7 }}>({(courseSubjects[c] || []).length})</span>
            </button>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newCourse} onChange={e => setNewCourse(e.target.value)} placeholder="New course…" style={{ ...css.input, width: 130, fontSize: 12 }}
              onKeyDown={e => { if (e.key === "Enter") addCourse(); }} />
            <button onClick={addCourse} style={{ ...css.btn, padding: "6px 14px", background: "#E0F2FE", color: "#0369A1", fontSize: 12 }}>+ Add</button>
          </div>
        </div>
        {selected && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 8 }}>
              Subjects for <span style={{ color: "#1a3c2e" }}>{selected}</span>
              <span style={{ marginLeft: 8, fontWeight: 400, color: "#9CA3AF" }}>(Max: {getCourseMax(selected)} total marks)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {list.map((sub, i) => (
                <span key={sub} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", background: "#E0F2FE", border: "1px solid #BAE6FD", borderRadius: 999, fontSize: 13, color: "#0369A1" }}>
                  <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>{i + 1}.</span>
                  {sub}
                  <span style={{ fontSize: 10, color: "#7DD3FC", fontWeight: 600 }}>/{getSubjectMax(selected, sub)}</span>
                  <span onClick={() => setList(p => p.filter(s => s !== sub))} style={{ cursor: "pointer", color: "#7DD3FC", fontWeight: 800, fontSize: 15 }}>×</span>
                </span>
              ))}
              {!list.length && <span style={{ color: "#CBD5E1", fontSize: 13 }}>No subjects added yet.</span>}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={newSub} onChange={e => setNew(e.target.value)} placeholder="Add subject name…" style={{ ...css.input, flex: 1 }}
                onKeyDown={e => { if (e.key === "Enter" && newSub.trim()) { setList(p => [...p, newSub.trim()]); setNew(""); } }} />
              <button onClick={() => { if (newSub.trim()) { setList(p => [...p, newSub.trim()]); setNew(""); } }} style={{ ...css.btn, background: "#1D4ED8", color: "white" }}>Add</button>
            </div>
            <SaveBtn onClick={save} saving={saving} saved={saved} label={`Save ${selected} Subjects`} />
          </>
        )}
      </div>
      <div style={{ ...css.card, background: "#F8FAFC" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 15, color: "#1e293b", marginBottom: 12 }}>📋 All Courses Summary</div>
        {Object.entries(courseSubjects).map(([c, subs]) => (
          <div key={c} style={{ marginBottom: 10, padding: "10px 14px", background: "white", borderRadius: 8, border: "1px solid #E5E7EB" }}>
            <div style={{ fontWeight: 700, color: "#1a3c2e", fontSize: 13, marginBottom: 4 }}>
              {c} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({subs.length} subjects · max {getCourseMax(c)} marks)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {subs.map(s => (
                <span key={s} style={{ fontSize: 11, padding: "2px 8px", background: "#F1F5F9", borderRadius: 999, color: "#475569" }}>
                  {s} <span style={{ color: "#94A3B8" }}>/{getSubjectMax(c, s)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EXAM TYPES MANAGER ───────────────────────────────────────────────────────
function ExamTypesManager({ examTypes, onUpdate }) {
  const [list, setList] = useState(examTypes);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const add = async () => {
    if (!form.name.trim()) return; setSaving(true);
    const { data } = await supabase.from("exam_types").insert([{ name: form.name.trim(), description: form.description }]).select();
    if (data) { const updated = [...list, data[0]]; setList(updated); onUpdate(updated); }
    setForm({ name: "", description: "" }); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const remove = async id => {
    if (!confirm("Delete this exam type?")) return;
    await supabase.from("exam_types").delete().eq("id", id);
    const updated = list.filter(e => e.id !== id); setList(updated); onUpdate(updated);
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>➕ Add Exam Type</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. 1st Monthly Test" style={css.input} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Description</label>
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional" style={css.input} />
        </div>
        <SaveBtn onClick={add} saving={saving} saved={saved} label="Add Type" />
      </div>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>⚙️ Configured Exam Types</div>
        {list.map(et => (
          <div key={et.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 8, background: "#F9FAFB" }}>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>{et.name}</div>{et.description && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{et.description}</div>}</div>
            <button onClick={() => remove(et.id)} style={{ ...css.btn, padding: "4px 10px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>✕</button>
          </div>
        ))}
        {!list.length && <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: 20 }}>No exam types yet.</div>}
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function ExamSettings({ institute, onUpdateInstitute }) {
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState({ ...INSTITUTE_DEFAULT, ...institute });
  const updateConfig = (key, val) => setConfig(p => ({ ...p, [key]: val }));
  const save = async () => {
    setSaving(true);
    await supabase.from("system_settings").upsert({ key: "exam_institute_config", value: JSON.stringify(config) }, { onConflict: "key" });
    onUpdateInstitute(config); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 18, color: "#1e293b", marginBottom: 16 }}>🏛️ Institute Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 14 }}>
          {[
            { label: "Institute Name", key: "name" }, { label: "Address", key: "address" },
            { label: "Tagline", key: "tagline" }, { label: "Principal Name", key: "principal" },
            { label: "Class Teacher", key: "teacher" }, { label: "Logo URL", key: "logoUrl" },
            { label: "Academic Year", key: "academicYear" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>{f.label}</label>
              <input value={config[f.key] || ""} onChange={e => updateConfig(f.key, e.target.value)} style={css.input} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}><SaveBtn onClick={save} saving={saving} saved={saved} label="Save Settings" /></div>
      </div>
    </div>
  );
}

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
// ─── SEAT ARRANGEMENT ────────────────────────────────────────────────────────
/*
  SQL — run once in Supabase SQL Editor:

  CREATE TABLE IF NOT EXISTS seat_arrangements (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_type_id text NOT NULL,
    exam_date   text NOT NULL,
    room        text NOT NULL,
    student_id  uuid REFERENCES students(id) ON DELETE CASCADE,
    seat_number integer NOT NULL,
    created_at  timestamptz DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS seat_arrangements_unique
    ON seat_arrangements(exam_type_id, exam_date, room, seat_number);
*/

function SeatArrangement({ courseSubjects, examTypes, students, institute, schedule }) {
  const courses = Object.keys(courseSubjects);

  // ── State ──────────────────────────────────────────────────────────────────
  const [examType, setExamType]     = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate]     = useState("");
  const [dates, setDates]           = useState([]);
  const [room, setRoom]             = useState("");
  const [seats, setSeats]           = useState({}); // { seatNum: studentId }
  const [savedSeats, setSavedSeats] = useState({}); // loaded from DB
  const [capacity, setCapacity]     = useState(30);
  const [cols, setCols]             = useState(5);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [tab, setTab]               = useState("arrange"); // "arrange" | "view" | "print"
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [search, setSearch]         = useState("");
  const [dragStudent, setDragStudent] = useState(null);
  const [touchDragStudent, setTouchDragStudent] = useState(null);

  // ── Rooms from schedule ────────────────────────────────────────────────────
  const scheduleRooms = [...new Set(
    schedule.filter(s => s.exam_type_id === examType && (!examDate || s.exam_date === examDate) && s.room)
             .map(s => s.room)
  )];
  const [allRooms, setAllRooms] = useState([]);

  // Load exam dates
  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data||[]).map(r=>r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  // Load all rooms that have seat arrangements
  useEffect(() => {
    if (!examType || !examDate) return;
    supabase.from("seat_arrangements").select("room").eq("exam_type_id", examType).eq("exam_date", examDate).then(({ data }) => {
      const dbRooms = [...new Set((data||[]).map(r=>r.room))];
      const combined = [...new Set([...scheduleRooms, ...dbRooms])];
      setAllRooms(combined);
      if (!room && combined.length) setRoom(combined[0]);
    });
  }, [examType, examDate]);

  // Load seats for current room
  useEffect(() => {
    if (!examType || !examDate || !room) return;
    setLoading(true);
    supabase.from("seat_arrangements").select("*")
      .eq("exam_type_id", examType).eq("exam_date", examDate).eq("room", room)
      .then(({ data }) => {
        const map = {};
        (data||[]).forEach(r => { map[r.seat_number] = r.student_id; });
        setSeats(map); setSavedSeats(map); setLoading(false);
      });
  }, [examType, examDate, room]);

  // Assigned student IDs in this room
  const assignedInRoom = new Set(Object.values(seats).filter(Boolean));
  // Assigned across ALL rooms for this exam (to show globally assigned)
  const [globalAssigned, setGlobalAssigned] = useState(new Set());
  useEffect(() => {
    if (!examType || !examDate) return;
    supabase.from("seat_arrangements").select("student_id").eq("exam_type_id", examType).eq("exam_date", examDate).then(({ data }) => {
      setGlobalAssigned(new Set((data||[]).map(r=>r.student_id)));
    });
  }, [examType, examDate, seats]);

  // ── Students list (unassigned first) ──────────────────────────────────────
  const filteredStudents = students.filter(s => {
    const matchCourse = filterCourse==="ALL" || (s.course||"").toUpperCase()===filterCourse;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search);
    return matchCourse && matchSearch;
  }).sort((a,b) => {
    const aAssigned = globalAssigned.has(a.id);
    const bAssigned = globalAssigned.has(b.id);
    if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  // ── Auto-assign: fill seats with unassigned students ─────────────────────
  const autoAssign = () => {
    const unassigned = students.filter(s =>
      (filterCourse==="ALL" || (s.course||"").toUpperCase()===filterCourse) &&
      !globalAssigned.has(s.id)
    );
    const newSeats = { ...seats };
    let si = 0;
    for (let seat = 1; seat <= capacity && si < unassigned.length; seat++) {
      if (!newSeats[seat]) { newSeats[seat] = unassigned[si].id; si++; }
    }
    setSeats(newSeats); setSaved(false);
  };

  const clearRoom = () => { setSeats({}); setSaved(false); };

  // ── Save to DB ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    // Delete existing for this room
    await supabase.from("seat_arrangements").delete()
      .eq("exam_type_id", examType).eq("exam_date", examDate).eq("room", room);
    // Insert all assigned seats
    const rows = Object.entries(seats)
      .filter(([,sid]) => sid)
      .map(([seatNum, sid]) => ({ exam_type_id: examType, exam_date: examDate, room, student_id: sid, seat_number: Number(seatNum) }));
    if (rows.length) await supabase.from("seat_arrangements").insert(rows);
    setSavedSeats({...seats}); setSaving(false); setSaved(true);
    // Refresh rooms list
    const dbRooms = [...new Set([...allRooms, room])];
    setAllRooms(dbRooms);
    setTimeout(() => setSaved(false), 2500);
  };

  // ── Add new room ───────────────────────────────────────────────────────────
  const [newRoom, setNewRoom] = useState("");
  const addRoom = () => {
    const r = newRoom.trim().toUpperCase();
    if (!r) return;
    setAllRooms(p => [...new Set([...p, r])]);
    setRoom(r); setSeats({}); setNewRoom("");
  };

  // ── Print seat chart ───────────────────────────────────────────────────────
  const printSeatChart = () => {
    const rows = Math.ceil(capacity / cols);
    const examName = examTypes.find(e=>e.id===examType)?.name || "Examination";
    let gridHTML = "";
    for (let r = 0; r < rows; r++) {
      gridHTML += `<div class="seat-row">`;
      for (let c = 0; c < cols; c++) {
        const seatNum = r * cols + c + 1;
        if (seatNum > capacity) { gridHTML += `<div class="seat-empty"></div>`; continue; }
        const sid = seats[seatNum];
        const st = sid ? students.find(s=>s.id===sid) : null;
        gridHTML += `
          <div class="seat ${st ? "occupied" : "vacant"}">
            <div class="seat-num">${seatNum}</div>
            ${st ? `<div class="seat-name">${st.name.split(" ")[0]}<br/><span class="seat-gcc">${st.name.split(" ").slice(1).join(" ")}</span></div><div class="seat-batch">${st.class_name||st.course||""} · GCC ${st.gcc_no}</div>` : `<div class="seat-name vacant-label">VACANT</div>`}
          </div>`;
      }
      gridHTML += `</div>`;
    }

    // Table list
    const tableRows = Array.from({length: capacity}, (_,i)=>i+1).map(sn => {
      const sid = seats[sn]; const st = sid ? students.find(s=>s.id===sid) : null;
      return `<tr style="background:${sn%2?"#F9FAFB":"white"}">
        <td style="text-align:center;font-weight:800;color:#1a3c2e;padding:7px 12px">${sn}</td>
        <td style="padding:7px 12px;font-weight:600">${st ? st.name : "—"}</td>
        <td style="text-align:center;padding:7px 12px;color:#64748b">${st ? st.gcc_no : "—"}</td>
        <td style="text-align:center;padding:7px 12px"><span style="background:#E0F2FE;color:#0369A1;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700">${st ? (st.class_name||st.course||"") : "—"}</span></td>
        <td style="text-align:center;padding:7px 12px;color:${st?"#0F6E56":"#EF4444"};font-weight:700">${st ? "✓ Assigned" : "Vacant"}</td>
      </tr>`;
    }).join("");

    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head>
    <title>Seat Arrangement — ${room} — ${examDate}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'DM Sans',sans-serif;background:#F7F6F1;padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .no-print{text-align:center;margin-bottom:16px;display:flex;gap:10px;justify-content:center;}
      .no-print button{padding:9px 24px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;}
      .btn-print{background:#1a3c2e;color:white;} .btn-close{background:#e5e7eb;color:#374151;}
      .page{max-width:900px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);}
      .header{background:linear-gradient(135deg,#0d2818,#1a3c2e,#2A5C45);padding:22px 32px 18px;position:relative;}
      .header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#B8860B,#f0c040,#B8860B);}
      .header-top{display:flex;justify-content:space-between;align-items:flex-start;}
      .inst-name{font-family:'Playfair Display',serif;font-size:20px;color:white;font-weight:600;margin-bottom:3px;}
      .inst-addr{font-size:11px;color:rgba(255,255,255,0.65);}
      .room-badge{background:rgba(184,134,11,0.25);border:1px solid rgba(240,192,64,0.5);border-radius:8px;padding:10px 18px;text-align:center;}
      .room-label{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(240,192,64,0.75);margin-bottom:3px;}
      .room-name{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#f0c040;}
      .meta-row{display:flex;gap:24px;margin-top:12px;}
      .meta-item{font-size:11px;color:rgba(255,255,255,0.6);}
      .meta-item span{color:rgba(255,255,255,0.9);font-weight:600;}
      .section-title{font-family:'Playfair Display',serif;font-size:15px;font-weight:600;color:#1a3c2e;padding:14px 24px 10px;border-bottom:1px solid #E5E7EB;}
      /* Grid */
      .seat-grid{padding:20px 24px;}
      .seat-row{display:flex;gap:10px;margin-bottom:10px;justify-content:center;}
      .seat{width:130px;min-height:80px;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;position:relative;}
      .seat.occupied{background:#F0FDF4;border:1.5px solid #86EFAC;}
      .seat.vacant{background:#F9FAFB;border:1.5px dashed #D1D5DB;}
      .seat-empty{width:130px;}
      .seat-num{position:absolute;top:5px;right:8px;font-size:10px;font-weight:800;color:#94A3B8;}
      .seat.occupied .seat-num{color:#0F6E56;}
      .seat-name{font-size:11.5px;font-weight:700;color:#1e293b;line-height:1.3;margin-top:4px;}
      .seat-name .seat-gcc{font-weight:400;color:#64748b;}
      .vacant-label{color:#CBD5E1;font-weight:500;font-size:11px;}
      .seat-batch{font-size:9.5px;color:#94A3B8;margin-top:2px;}
      /* Table */
      .table-section{padding:0 24px 24px;}
      .list-table{width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;}
      .list-table thead tr{background:#1a3c2e;}
      .list-table thead th{padding:9px 12px;color:white;font-weight:700;font-size:11px;text-align:left;}
      .list-table thead th:first-child,.list-table thead th:last-child{text-align:center;}
      .stats-row{display:flex;gap:12px;padding:14px 24px;border-bottom:1px solid #E5E7EB;}
      .stat{flex:1;text-align:center;padding:10px;background:#F8FAFC;border-radius:8px;}
      .stat-val{font-family:'Playfair Display',serif;font-size:24px;font-weight:600;color:#1a3c2e;}
      .stat-lbl{font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;margin-top:3px;}
      @media print{body{background:white;padding:0;}.no-print{display:none!important;}.page{box-shadow:none;border-radius:0;}@page{margin:.8cm;size:A4 landscape;}}
    </style></head><body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Print Seat Chart</button>
      <button class="btn-close" onclick="window.close()">✕ Close</button>
    </div>
    <div class="page">
      <div class="header">
        <div class="header-top">
          <div>
            <div class="inst-name">${institute.name||"Guidance Navodaya & Sainik Institute"}</div>
            <div class="inst-addr">${institute.address||"Khangabok, Manipur"}</div>
          </div>
          <div class="room-badge">
            <div class="room-label">Examination Room</div>
            <div class="room-name">${room}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-item">Exam: <span>${examName}</span></div>
          <div class="meta-item">Date: <span>${examDate}</span></div>
          <div class="meta-item">Capacity: <span>${capacity} seats</span></div>
          <div class="meta-item">Assigned: <span>${Object.values(seats).filter(Boolean).length}</span></div>
          <div class="meta-item">Vacant: <span>${capacity - Object.values(seats).filter(Boolean).length}</span></div>
          <div class="meta-item">Academic Year: <span>${institute.academicYear||"2025-2026"}</span></div>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat"><div class="stat-val">${capacity}</div><div class="stat-lbl">Total Seats</div></div>
        <div class="stat"><div class="stat-val">${Object.values(seats).filter(Boolean).length}</div><div class="stat-lbl">Assigned</div></div>
        <div class="stat"><div class="stat-val">${capacity-Object.values(seats).filter(Boolean).length}</div><div class="stat-lbl">Vacant</div></div>
        <div class="stat"><div class="stat-val">${cols}</div><div class="stat-lbl">Columns</div></div>
        <div class="stat"><div class="stat-val">${Math.ceil(capacity/cols)}</div><div class="stat-lbl">Rows</div></div>
      </div>
      <div class="section-title">🪑 Seat Layout</div>
      <div class="seat-grid">${gridHTML}</div>
      <div class="section-title">📋 Seat-wise Student List</div>
      <div class="table-section">
        <table class="list-table">
          <thead><tr><th>Seat No.</th><th>Student Name</th><th>GCC No.</th><th>Batch</th><th>Status</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
    </body></html>`);
    w.document.close();
  };

  const examName = examTypes.find(e=>e.id===examType)?.name || "Examination";
  const occupiedCount = Object.values(seats).filter(Boolean).length;
  const rows = Math.ceil(capacity / cols);

  return (
    <div>
      {/* Top controls */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:18, alignItems:"flex-end" }}>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e=>setExamType(e.target.value)} style={{ ...css.input, width:200 }}>
            {examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
       <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Date</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <select value={examDate} onChange={e=>setExamDate(e.target.value)} style={{ ...css.input, width:160 }}>
              <option value="">— Pick from list —</option>
              {dates.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <input type="date" value={examDate} onChange={e=>setExamDate(e.target.value)}
              style={{ ...css.input, width:160 }}
              title="Or type/pick a date manually" />
          </div>
          {!examDate && (
            <div style={{ fontSize:11, color:"#EF4444", marginTop:4 }}>
              ⚠️ No dates found in exam marks yet — use the date picker on the right to set a date manually.
            </div>
          )}
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Capacity</label>
          <input type="number" value={capacity} onChange={e=>setCapacity(Math.max(1,Number(e.target.value)))} style={{ ...css.input, width:80 }} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Columns</label>
          <input type="number" value={cols} onChange={e=>setCols(Math.max(1,Math.min(10,Number(e.target.value))))} style={{ ...css.input, width:70 }} />
        </div>
      </div>

      {/* SQL reminder */}
      <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"10px 16px", marginBottom:16, fontSize:12, color:"#1D4ED8" }}>
        ℹ️ First time? Run the SQL in the comments at the top of the SeatArrangement component in Supabase to create the <b>seat_arrangements</b> table.
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:20 }}>
        {/* Left: Rooms + Student list */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* Room selector */}
          <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
            <div style={{ padding:"11px 16px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13 }}>🏫 Rooms</div>
            <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
              {allRooms.map(r => (
                <button key={r} onClick={()=>setRoom(r)}
                  style={{ ...css.btn, padding:"8px 14px", textAlign:"left", background:room===r?"#1a3c2e":"#F3F4F6", color:room===r?"white":"#374151", border:room===r?"none":"1px solid #E5E7EB", fontSize:12 }}>
                  🏫 {r}
                </button>
              ))}
              {!allRooms.length && <div style={{ fontSize:12, color:"#94A3B8", padding:"4px 0" }}>No rooms yet.</div>}
              <div style={{ display:"flex", gap:6, marginTop:4 }}>
                <input value={newRoom} onChange={e=>setNewRoom(e.target.value)} placeholder="New room…"
                  style={{ ...css.input, fontSize:12 }} onKeyDown={e=>{ if(e.key==="Enter") addRoom(); }} />
                <button onClick={addRoom} style={{ ...css.btn, padding:"6px 12px", background:"#E0F2FE", color:"#0369A1", fontSize:12, whiteSpace:"nowrap" }}>+ Add</button>
              </div>
            </div>
          </div>

          {/* Student list */}
          <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden", flex:1 }}>
            <div style={{ padding:"11px 16px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13 }}>👤 Students</div>
            <div style={{ padding:10 }}>
              <input placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...css.input, marginBottom:8, fontSize:12 }} />
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                {["ALL",...courses].map(c=>(
                  <button key={c} onClick={()=>setFilterCourse(c)}
                    style={{ ...css.btn, padding:"3px 10px", fontSize:10, background:filterCourse===c?"#1a3c2e":"#F3F4F6", color:filterCourse===c?"white":"#374151", border:filterCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight:340, overflowY:"auto", borderTop:"1px solid #F1F5F9" }}>
              {filteredStudents.map(st => {
                const inRoom = assignedInRoom.has(st.id);
                const inOther = !inRoom && globalAssigned.has(st.id);
                return (
                  <div key={st.id}
                    draggable={!inRoom}
                    onDragStart={()=>setDragStudent(st)}
                    onDragEnd={()=>setDragStudent(null)}
                    onTouchStart={()=>{ if(!inRoom) setTouchDragStudent(st) }}
                    onTouchEnd={()=>setTouchDragStudent(null)}
                    style={{ padding:"8px 14px", borderBottom:"1px solid #F1F5F9", cursor:inRoom?"default":"grab", background:inRoom?"#F0FDF4":inOther?"#FFFBEB":"white", opacity:inRoom?0.6:1 }}>
                    <div style={{ fontWeight:600, fontSize:12, color:inRoom?"#0F6E56":inOther?"#92400E":"#1e293b" }}>{st.name}</div>
                    <div style={{ fontSize:10, color:"#9CA3AF" }}>
                      GCC {st.gcc_no} · {st.class_name||st.course}
                      {inRoom && " · ✓ In this room"}
                      {inOther && " · ⚠️ Other room"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Seat grid + actions */}
        <div>
          {/* Action bar */}
          <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ background:"white", borderRadius:10, padding:"10px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", fontSize:13, fontWeight:600, color:"#1a3c2e" }}>
              🏫 <b>{room||"No room selected"}</b>
              <span style={{ fontWeight:400, color:"#9CA3AF", marginLeft:8 }}>{occupiedCount}/{capacity} seats filled</span>
            </div>
            <button onClick={autoAssign} style={{ ...css.btn, background:"#7c3aed", color:"white" }}>⚡ Auto Assign</button>
            <button onClick={clearRoom} style={{ ...css.btn, background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA" }}>🗑️ Clear Room</button>
            <button onClick={handleSave} disabled={saving||!room}
              style={{ ...css.btn, background:saved?"#16A34A":saving?"#93C5FD":"#1D4ED8", color:"white" }}>
              {saved?"✓ Saved!":saving?"Saving…":"💾 Save"}
            </button>
            <button onClick={printSeatChart} disabled={!room}
              style={{ ...css.btn, background:"#1a3c2e", color:"white" }}>🖨️ Print Chart</button>
          </div>

          {/* Progress bar */}
          <div style={{ background:"white", borderRadius:8, padding:"8px 14px", marginBottom:14, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6B7280", marginBottom:5 }}>
              <span>Room capacity</span>
              <span style={{ fontWeight:700, color:"#1a3c2e" }}>{occupiedCount} / {capacity}</span>
            </div>
            <div style={{ height:7, background:"#F1F5F9", borderRadius:999, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(occupiedCount/capacity)*100}%`, background:"#1a3c2e", borderRadius:999, transition:"width .3s" }} />
            </div>
          </div>

          {loading ? <Spinner /> : !room ? (
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:60, textAlign:"center", color:"#94A3B8" }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🏫</div>
              <div style={{ fontSize:15, fontWeight:600 }}>Select or add a room to begin</div>
            </div>
          ) : (
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:20, overflowX:"auto" }}>
              <div style={{ display:"inline-flex", flexDirection:"column", gap:8, minWidth:"100%" }}>
                {/* Column labels */}
                <div style={{ display:"flex", gap:8, paddingLeft:0 }}>
                  {Array.from({length:cols},(_,c)=>(
                    <div key={c} style={{ width:110, textAlign:"center", fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase" }}>Col {c+1}</div>
                  ))}
                </div>
                {Array.from({length:rows},(_,r)=>(
                  <div key={r} style={{ display:"flex", gap:8 }}>
                    {Array.from({length:cols},(_,c)=>{
                      const seatNum = r*cols+c+1;
                      if (seatNum > capacity) return <div key={c} style={{ width:110 }} />;
                      const sid = seats[seatNum];
                      const st = sid ? students.find(s=>s.id===sid) : null;
                      return (
                        <div key={seatNum}
                          onDragOver={e=>{e.preventDefault();}}
                          onDrop={e=>{ e.preventDefault(); if(dragStudent && !assignedInRoom.has(dragStudent.id)){ setSeats(p=>({...p,[seatNum]:dragStudent.id})); setSaved(false); setDragStudent(null); }}}
                          onTouchStart={()=>{ if(!inRoom) setTouchDragStudent(st) }}
                    onTouchEnd={()=>setTouchDragStudent(null)}
                          onClick={()=>{ if(st){ setSeats(p=>{ const n={...p}; delete n[seatNum]; return n; }); setSaved(false); } }}
                          style={{ width:110, minHeight:72, borderRadius:8, border:st?"1.5px solid #86EFAC":"1.5px dashed #D1D5DB", background:st?"#F0FDF4":"#F9FAFB", padding:"6px 8px", cursor:st?"pointer":"default", position:"relative", transition:"all .15s" }}>
                          <div style={{ position:"absolute", top:4, right:6, fontSize:10, fontWeight:800, color:st?"#0F6E56":"#CBD5E1" }}>{seatNum}</div>
                          {st ? (
                            <>
                              <div style={{ fontSize:11, fontWeight:700, color:"#1e293b", lineHeight:1.3, paddingRight:16, marginTop:2 }}>{st.name}</div>
                              <div style={{ fontSize:10, color:"#64748b", marginTop:3 }}>GCC {st.gcc_no}</div>
                              <div style={{ fontSize:9.5, color:"#94A3B8" }}>{st.class_name||st.course}</div>
                              <div title="Click to remove" style={{ position:"absolute", top:3, left:5, fontSize:9, color:"#FCA5A5", cursor:"pointer" }}>✕</div>
                            </>
                          ) : (
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#E5E7EB", fontSize:11, paddingTop:10 }}>Drop here</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ display:"flex", gap:16, marginTop:12, fontSize:12, color:"#64748b" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:14, height:14, borderRadius:3, background:"#F0FDF4", border:"1.5px solid #86EFAC" }} /> Assigned</div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:14, height:14, borderRadius:3, background:"#F9FAFB", border:"1.5px dashed #D1D5DB" }} /> Vacant</div>
            <span style={{ color:"#94A3B8" }}>Drag students from the list · Click assigned seat to remove</span>
          </div>
        </div>
      </div>
    </div>
  );
}

  // ─── SCHEDULE ─────────────────────────────────────────────────────────────────
// ─── SCHEDULE (v2 — Full Bulk Assign) ────────────────────────────────────────
// Drop-in replacement for the Schedule function in Exams.jsx
// Features added:
//  ① Bulk assign: one subject → multiple courses at once
//  ② Multi-subject entry: add all subjects for a course in one submit
//  ③ Duplicate/copy entries across dates
//  ④ Batch generate: full timetable over a date range (one subject/day)
//  ⑤ Import from CSV/Excel
//  ⑥ Original single-entry form preserved as "Single" tab

function Schedule({ courseSubjects, examTypes, onScheduleChange }) {
  const courses = Object.keys(courseSubjects);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [filterExamType, setFilterExamType] = useState("ALL");
  const [mode, setMode] = useState("single"); // single | multi | bulk | generate | import | duplicate
  const fileInputRef = useRef(null);

  // ── Single entry form ──
  const [form, setForm] = useState({
    exam_type_id: examTypes[0]?.id || "",
    course: courses[0] || "",
    subject: "",
    exam_date: "", time: "09:00", total_marks: 100, room: "", shift: "Morning"
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Multi-subject form ──
  const [msExamType, setMsExamType] = useState(examTypes[0]?.id || "");
  const [msCourse, setMsCourse] = useState(courses[0] || "");
  const [msStartDate, setMsStartDate] = useState("");
  const [msTime, setMsTime] = useState("09:00");
  const [msShift, setMsShift] = useState("Morning");
  const [msRoom, setMsRoom] = useState("");
  const [msRows, setMsRows] = useState([]); // [{subject, date, marks}]
  const [msSaving, setMsSaving] = useState(false);
  const [msSaved, setMsSaved] = useState(false);

  // ── Bulk (one subject → many courses) ──
  const [bkExamType, setBkExamType] = useState(examTypes[0]?.id || "");
  const [bkSubject, setBkSubject] = useState("");
  const [bkDate, setBkDate] = useState("");
  const [bkTime, setBkTime] = useState("09:00");
  const [bkShift, setBkShift] = useState("Morning");
  const [bkRoom, setBkRoom] = useState("");
  const [bkMarks, setBkMarks] = useState(100);
  const [bkCourses, setBkCourses] = useState(new Set());
  const [bkSaving, setBkSaving] = useState(false);
  const [bkSaved, setBkSaved] = useState(false);

  // ── Generate timetable ──
  const [genExamType, setGenExamType] = useState(examTypes[0]?.id || "");
  const [genCourse, setGenCourse] = useState(courses[0] || "");
  const [genStartDate, setGenStartDate] = useState("");
  const [genTime, setGenTime] = useState("09:00");
  const [genShift, setGenShift] = useState("Morning");
  const [genRoom, setGenRoom] = useState("");
  const [genSkipWeekends, setGenSkipWeekends] = useState(true);
  const [genSubjectOrder, setGenSubjectOrder] = useState([]); // [{subject, marks}]
  const [genPreview, setGenPreview] = useState([]);
  const [genSaving, setGenSaving] = useState(false);
  const [genSaved, setGenSaved] = useState(false);

  // ── Duplicate ──
  const [dupIds, setDupIds] = useState(new Set());
  const [dupDate, setDupDate] = useState("");
  const [dupSaving, setDupSaving] = useState(false);
  const [dupSaved, setDupSaved] = useState(false);

  // ── Import ──
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importSaving, setImportSaving] = useState(false);
  const [importDone, setImportDone] = useState(false);

  const fetchSchedule = async () => {
    setLoading(true);
    const { data } = await supabase.from("exam_schedule").select("*").order("exam_date", { ascending: true });
    setSchedule(data || []); setLoading(false);
  };
  useEffect(() => { fetchSchedule(); }, []);

  // ── Init multi-subject rows when course changes ──
  useEffect(() => {
    const subs = courseSubjects[msCourse] || [];
    setMsRows(subs.map((subject, i) => ({
      subject,
      date: "", // user fills per-subject or auto-increment from start date
      marks: getSubjectMax(msCourse, subject),
    })));
  }, [msCourse]);

  // ── Auto-fill multi-subject dates from start date ──
  useEffect(() => {
    if (!msStartDate) return;
    setMsRows(prev => {
      let d = new Date(msStartDate);
      return prev.map((r, i) => {
        const dateStr = d.toISOString().split("T")[0];
        d.setDate(d.getDate() + 1);
        return { ...r, date: dateStr };
      });
    });
  }, [msStartDate]);

  // ── Init generate subject order when course changes ──
  useEffect(() => {
    const subs = courseSubjects[genCourse] || [];
    setGenSubjectOrder(subs.map(s => ({ subject: s, marks: getSubjectMax(genCourse, s) })));
    setGenPreview([]);
  }, [genCourse]);

  // ── Build generate preview ──
  useEffect(() => {
    if (!genStartDate || !genSubjectOrder.length) { setGenPreview([]); return; }
    let d = new Date(genStartDate);
    const rows = [];
    for (const { subject, marks } of genSubjectOrder) {
      if (genSkipWeekends) { while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); }
      rows.push({ subject, exam_date: d.toISOString().split("T")[0], total_marks: marks });
      d.setDate(d.getDate() + 1);
    }
    setGenPreview(rows);
  }, [genStartDate, genSubjectOrder, genSkipWeekends]);

  // ─── Single save ──────────────────────────────────────────────────────────
  const handleSaveSingle = async () => {
    if (!form.exam_date || !form.subject) return;
    setSaving(true);
    await supabase.from("exam_schedule").insert([{ ...form, total_marks: Number(form.total_marks) }]);
    setSaving(false); setSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setSaved(false), 2000);
  };

  // ─── Multi-subject save ───────────────────────────────────────────────────
  const handleSaveMulti = async () => {
    const valid = msRows.filter(r => r.subject && r.date);
    if (!valid.length) return;
    setMsSaving(true);
    const rows = valid.map(r => ({
      exam_type_id: msExamType, course: msCourse,
      subject: r.subject, exam_date: r.date,
      time: msTime, shift: msShift, room: msRoom,
      total_marks: Number(r.marks) || 100,
    }));
    await supabase.from("exam_schedule").insert(rows);
    setMsSaving(false); setMsSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setMsSaved(false), 2000);
  };

  // ─── Bulk (one subject → many courses) save ───────────────────────────────
  const handleSaveBulk = async () => {
    if (!bkDate || !bkSubject || !bkCourses.size) return;
    setBkSaving(true);
    const rows = [...bkCourses].map(c => ({
      exam_type_id: bkExamType, course: c,
      subject: bkSubject, exam_date: bkDate,
      time: bkTime, shift: bkShift, room: bkRoom,
      total_marks: Number(bkMarks) || 100,
    }));
    await supabase.from("exam_schedule").insert(rows);
    setBkSaving(false); setBkSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setBkSaved(false), 2000);
  };

  // ─── Generate save ────────────────────────────────────────────────────────
  const handleSaveGenerate = async () => {
    if (!genPreview.length) return;
    setGenSaving(true);
    const rows = genPreview.map(r => ({
      exam_type_id: genExamType, course: genCourse,
      subject: r.subject, exam_date: r.exam_date,
      time: genTime, shift: genShift, room: genRoom,
      total_marks: Number(r.total_marks) || 100,
    }));
    await supabase.from("exam_schedule").insert(rows);
    setGenSaving(false); setGenSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setGenSaved(false), 2500);
  };

  // ─── Duplicate selected entries to new date ───────────────────────────────
  const handleDuplicate = async () => {
    if (!dupDate || !dupIds.size) return;
    setDupSaving(true);
    const toDup = schedule.filter(s => dupIds.has(s.id));
    const rows = toDup.map(({ id, created_at, ...rest }) => ({ ...rest, exam_date: dupDate }));
    await supabase.from("exam_schedule").insert(rows);
    setDupSaving(false); setDupSaved(true); setDupIds(new Set()); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setDupSaved(false), 2500);
  };

  // ─── Import from CSV/Excel ────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    await ensureLibs(); const XLSX = window.XLSX;
    let rows = [];
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      const text = await file.text();
      const lines = text.trim().split("\n").map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
      rows = lines;
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    }
    if (!rows.length) return;
    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    const col = (name) => headers.findIndex(h => h.includes(name));
    const parsed = []; const errors = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const course    = r[col("course")]?.toString().trim().toUpperCase();
      const subject   = r[col("subject")]?.toString().trim();
      const exam_date = r[col("date")]?.toString().trim();
      const exam_type_id = examTypes.find(et => et.name.toLowerCase().includes(r[col("type")]?.toString().toLowerCase()))?.id || examTypes[0]?.id;
      if (!course || !subject || !exam_date) { errors.push(`Row ${i+1}: missing course/subject/date`); continue; }
      parsed.push({
        exam_type_id, course, subject, exam_date,
        time: r[col("time")]?.toString().trim() || "09:00",
        shift: r[col("shift")]?.toString().trim() || "Morning",
        room: r[col("room")]?.toString().trim() || "",
        total_marks: Number(r[col("marks")]) || 100,
      });
    }
    setImportRows(parsed); setImportErrors(errors); setImportDone(false);
  };

  const handleImportSave = async () => {
    if (!importRows.length) return;
    setImportSaving(true);
    await supabase.from("exam_schedule").insert(importRows);
    setImportSaving(false); setImportDone(true); fetchSchedule(); onScheduleChange?.();
  };

  const downloadImportTemplate = () => {
    const headers = ["course","subject","date","type","time","shift","room","marks"];
    const example = [courses[0]||"ACHIEVER", courseSubjects[courses[0]]?.[0]||"Mathematics", "2025-06-01", examTypes[0]?.name||"1st Monthly Test", "09:00", "Morning", "Hall A", "100"];
    const csv = [headers, example].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "GNSI_Schedule_Import_Template.csv";
    a.click();
  };

  // ─── Delete single ────────────────────────────────────────────────────────
  const handleDelete = async id => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("exam_schedule").delete().eq("id", id);
    fetchSchedule(); onScheduleChange?.();
  };

  // ─── Filtered view ────────────────────────────────────────────────────────
  const filtered = schedule.filter(s => {
    const matchCourse = filterCourse === "ALL" || s.course === filterCourse;
    const matchType = filterExamType === "ALL" || s.exam_type_id === filterExamType;
    return matchCourse && matchType;
  });

  // ─── UI helpers ───────────────────────────────────────────────────────────
  const ModeBtn = ({ id, icon, label }) => (
    <button onClick={() => setMode(id)}
      style={{ ...css.btn, padding: "8px 16px", background: mode === id ? "#1a3c2e" : "#F3F4F6",
        color: mode === id ? "white" : "#374151", border: mode === id ? "none" : "1px solid #E5E7EB", fontSize: 12 }}>
      {icon} {label}
    </button>
  );

  const FieldLabel = ({ children }) => (
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>{children}</label>
  );

  const commonFields = (state, setState) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div>
        <FieldLabel>Shift</FieldLabel>
        <select value={state.shift} onChange={e => setState(p => ({ ...p, shift: e.target.value }))} style={css.input}>
          <option value="Morning">🌅 Morning</option>
          <option value="Afternoon">🌤️ Afternoon</option>
          <option value="Evening">🌆 Evening</option>
        </select>
      </div>
      <div>
        <FieldLabel>Time</FieldLabel>
        <input type="time" value={state.time} onChange={e => setState(p => ({ ...p, time: e.target.value }))} style={css.input} />
      </div>
      <div>
        <FieldLabel>Room / Hall</FieldLabel>
        <input value={state.room} onChange={e => setState(p => ({ ...p, room: e.target.value }))} placeholder="e.g. Hall A" style={css.input} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Mode switcher */}
      <div style={{ background: "white", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginRight: 4 }}>Mode:</span>
        <ModeBtn id="single"    icon="✏️"  label="Single Entry" />
        <ModeBtn id="multi"     icon="📋" label="Multi-Subject" />
        <ModeBtn id="bulk"      icon="🔀" label="One Subject → Many Courses" />
        <ModeBtn id="generate"  icon="⚡" label="Auto-Generate Timetable" />
        <ModeBtn id="duplicate" icon="📄" label="Duplicate Entries" />
        <ModeBtn id="import"    icon="📂" label="Import CSV/Excel" />
      </div>

      {/* ── SINGLE ENTRY ── */}
      {mode === "single" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>➕ Add Single Entry</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={form.exam_type_id} onChange={e => setForm(p => ({ ...p, exam_type_id: e.target.value }))} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Course / Batch</FieldLabel>
                <select value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value, subject: "" }))} style={css.input}>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><FieldLabel>Subject</FieldLabel>
                <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} style={css.input}>
                  <option value="">— Select Subject —</option>
                  {(courseSubjects[form.course] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><FieldLabel>Date</FieldLabel>
                <input type="date" value={form.exam_date} onChange={e => setForm(p => ({ ...p, exam_date: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Shift</FieldLabel>
                <select value={form.shift} onChange={e => setForm(p => ({ ...p, shift: e.target.value }))} style={css.input}>
                  <option value="Morning">🌅 Morning</option>
                  <option value="Afternoon">🌤️ Afternoon</option>
                  <option value="Evening">🌆 Evening</option>
                </select></div>
              <div><FieldLabel>Time</FieldLabel>
                <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Total Marks</FieldLabel>
                <input type="number" value={form.total_marks} onChange={e => setForm(p => ({ ...p, total_marks: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Room / Hall</FieldLabel>
                <input value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))} style={css.input} /></div>
              <SaveBtn onClick={handleSaveSingle} saving={saving} saved={saved} label="Add Entry" />
            </div>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={false} />
        </div>
      )}

      {/* ── MULTI-SUBJECT ── */}
      {mode === "multi" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>📋 Multi-Subject Entry</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Add all subjects for a course at once. Set a start date to auto-fill dates (one per day).</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={msExamType} onChange={e => setMsExamType(e.target.value)} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Course / Batch</FieldLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {courses.map(c => (
                    <button key={c} onClick={() => setMsCourse(c)}
                      style={{ ...css.btn, padding: "5px 14px", fontSize: 11, background: msCourse === c ? "#1a3c2e" : "#F3F4F6", color: msCourse === c ? "white" : "#374151", border: msCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>
                  ))}
                </div></div>
              <div><FieldLabel>Auto-fill Start Date (optional)</FieldLabel>
                <input type="date" value={msStartDate} onChange={e => setMsStartDate(e.target.value)} style={{ ...css.input, width: 180 }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel>
                  <select value={msShift} onChange={e => setMsShift(e.target.value)} style={css.input}>
                    <option>Morning</option><option>Afternoon</option><option>Evening</option>
                  </select></div>
                <div><FieldLabel>Time</FieldLabel>
                  <input type="time" value={msTime} onChange={e => setMsTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel>
                <input value={msRoom} onChange={e => setMsRoom(e.target.value)} style={css.input} /></div>
            </div>
            <button onClick={handleSaveMulti} disabled={msSaving}
              style={{ ...css.btn, background: msSaved ? "#16A34A" : msSaving ? "#93C5FD" : "#1a3c2e", color: "white", width: "100%", fontSize: 13 }}>
              {msSaved ? `✓ Saved ${msRows.filter(r=>r.date).length} entries!` : msSaving ? "Saving…" : `💾 Save ${msRows.filter(r=>r.date).length} Entries`}
            </button>
          </div>
          {/* Per-subject rows */}
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Subject List for <span style={{ color: "#1a3c2e" }}>{msCourse}</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {msRows.map((r, i) => (
                <div key={r.subject} style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px", gap: 8, alignItems: "center", padding: "8px 12px", background: i % 2 ? "#F9FAFB" : "white", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                    <span style={{ fontSize: 10, color: "#94A3B8", marginRight: 6 }}>{i + 1}.</span>{r.subject}
                  </div>
                  <input type="date" value={r.date}
                    onChange={e => setMsRows(p => p.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                    style={{ ...css.input, fontSize: 12, padding: "5px 8px" }} />
                  <input type="number" value={r.marks}
                    onChange={e => setMsRows(p => p.map((x, j) => j === i ? { ...x, marks: e.target.value } : x))}
                    style={{ ...css.input, fontSize: 12, padding: "5px 8px" }} placeholder="Max" />
                </div>
              ))}
              {!msRows.length && <div style={{ color: "#94A3B8", textAlign: "center", padding: 20 }}>No subjects for this course.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── BULK: ONE SUBJECT → MANY COURSES ── */}
      {mode === "bulk" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>🔀 One Subject → Many Courses</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Assign the same subject/date to multiple courses at once.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={bkExamType} onChange={e => setBkExamType(e.target.value)} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Subject Name</FieldLabel>
                <input value={bkSubject} onChange={e => setBkSubject(e.target.value)} placeholder="e.g. Mathematics" style={css.input} /></div>
              <div><FieldLabel>Date</FieldLabel>
                <input type="date" value={bkDate} onChange={e => setBkDate(e.target.value)} style={css.input} /></div>
              <div><FieldLabel>Total Marks</FieldLabel>
                <input type="number" value={bkMarks} onChange={e => setBkMarks(e.target.value)} style={css.input} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel>
                  <select value={bkShift} onChange={e => setBkShift(e.target.value)} style={css.input}>
                    <option>Morning</option><option>Afternoon</option><option>Evening</option>
                  </select></div>
                <div><FieldLabel>Time</FieldLabel>
                  <input type="time" value={bkTime} onChange={e => setBkTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel>
                <input value={bkRoom} onChange={e => setBkRoom(e.target.value)} style={css.input} /></div>
              <div>
                <FieldLabel>Target Courses ({bkCourses.size} selected)</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => setBkCourses(new Set(courses))}
                    style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#E0F2FE", color: "#0369A1" }}>All</button>
                  <button onClick={() => setBkCourses(new Set())}
                    style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626" }}>None</button>
                  {courses.map(c => {
                    const sel = bkCourses.has(c);
                    return (
                      <button key={c} onClick={() => setBkCourses(p => { const n = new Set(p); sel ? n.delete(c) : n.add(c); return n; })}
                        style={{ ...css.btn, padding: "5px 14px", fontSize: 11, background: sel ? "#1a3c2e" : "#F3F4F6", color: sel ? "white" : "#374151", border: sel ? "none" : "1px solid #E5E7EB" }}>
                        {sel ? "✓ " : ""}{c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={handleSaveBulk} disabled={bkSaving || !bkCourses.size || !bkDate || !bkSubject}
                style={{ ...css.btn, background: bkSaved ? "#16A34A" : bkSaving ? "#93C5FD" : "#1a3c2e", color: "white", fontSize: 13, marginTop: 4 }}>
                {bkSaved ? `✓ Saved to ${bkCourses.size} courses!` : bkSaving ? "Saving…" : `💾 Assign to ${bkCourses.size} Courses`}
              </button>
            </div>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={false} />
        </div>
      )}

      {/* ── AUTO-GENERATE TIMETABLE ── */}
      {mode === "generate" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>⚡ Auto-Generate Timetable</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>One subject per day, starting from a date. Drag rows to reorder subjects.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={genExamType} onChange={e => setGenExamType(e.target.value)} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Course</FieldLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {courses.map(c => (
                    <button key={c} onClick={() => setGenCourse(c)}
                      style={{ ...css.btn, padding: "5px 14px", fontSize: 11, background: genCourse === c ? "#1a3c2e" : "#F3F4F6", color: genCourse === c ? "white" : "#374151", border: genCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>
                  ))}
                </div></div>
              <div><FieldLabel>Start Date</FieldLabel>
                <input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} style={css.input} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel>
                  <select value={genShift} onChange={e => setGenShift(e.target.value)} style={css.input}>
                    <option>Morning</option><option>Afternoon</option><option>Evening</option>
                  </select></div>
                <div><FieldLabel>Time</FieldLabel>
                  <input type="time" value={genTime} onChange={e => setGenTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel>
                <input value={genRoom} onChange={e => setGenRoom(e.target.value)} style={css.input} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={genSkipWeekends} onChange={e => setGenSkipWeekends(e.target.checked)} />
                Skip weekends (Sat & Sun)
              </label>
            </div>
            <div style={{ marginTop: 16 }}>
              <FieldLabel>Subject Order (drag to reorder)</FieldLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {genSubjectOrder.map((s, i) => (
                  <div key={s.subject} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button onClick={() => { if (i === 0) return; const n = [...genSubjectOrder]; [n[i-1], n[i]] = [n[i], n[i-1]]; setGenSubjectOrder(n); }}
                        style={{ ...css.btn, padding: "1px 6px", fontSize: 10, background: "#E5E7EB", color: "#374151" }}>▲</button>
                      <button onClick={() => { if (i === genSubjectOrder.length - 1) return; const n = [...genSubjectOrder]; [n[i], n[i+1]] = [n[i+1], n[i]]; setGenSubjectOrder(n); }}
                        style={{ ...css.btn, padding: "1px 6px", fontSize: 10, background: "#E5E7EB", color: "#374151" }}>▼</button>
                    </div>
                    <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, minWidth: 16 }}>{i+1}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{s.subject}</span>
                    <input type="number" value={s.marks}
                      onChange={e => setGenSubjectOrder(p => p.map((x, j) => j === i ? { ...x, marks: Number(e.target.value) } : x))}
                      style={{ width: 60, padding: "4px 6px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview + save */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...css.card, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: "#1e293b" }}>
                  {genPreview.length} exam days generated
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                  {genCourse} · {examTypes.find(e=>e.id===genExamType)?.name} · starts {genStartDate || "—"}
                </div>
              </div>
              <button onClick={handleSaveGenerate} disabled={!genPreview.length || genSaving}
                style={{ ...css.btn, background: genSaved ? "#16A34A" : genSaving ? "#93C5FD" : "#1a3c2e", color: "white", padding: "10px 22px", fontSize: 13 }}>
                {genSaved ? `✓ Saved ${genPreview.length} entries!` : genSaving ? "Saving…" : `💾 Save ${genPreview.length} Entries`}
              </button>
            </div>
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "11px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📅 Preview</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                  {["#","Date","Day","Subject","Marks"].map(h => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {genPreview.map((r, i) => {
                    const day = new Date(r.exam_date).toLocaleDateString("en-IN", { weekday: "short" });
                    return (
                      <tr key={i} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 14px", color: "#94A3B8", fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600 }}>{r.exam_date}</td>
                        <td style={{ padding: "8px 14px", color: "#64748b" }}>{day}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600, color: "#1a3c2e" }}>{r.subject}</td>
                        <td style={{ padding: "8px 14px", color: "#64748b" }}>{r.total_marks}</td>
                      </tr>
                    );
                  })}
                  {!genPreview.length && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>Set a start date to preview.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DUPLICATE ENTRIES ── */}
      {mode === "duplicate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...css.card, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1e293b", flex: "0 0 100%", marginBottom: 4 }}>
              📄 Duplicate Schedule Entries to a New Date
            </div>
            <div>
              <FieldLabel>Copy to Date</FieldLabel>
              <input type="date" value={dupDate} onChange={e => setDupDate(e.target.value)} style={{ ...css.input, width: 180 }} />
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>
              {dupIds.size} entries selected
            </div>
            <button onClick={handleDuplicate} disabled={!dupIds.size || !dupDate || dupSaving}
              style={{ ...css.btn, background: dupSaved ? "#16A34A" : dupSaving ? "#93C5FD" : "#7c3aed", color: "white", fontSize: 13 }}>
              {dupSaved ? `✓ Duplicated ${dupIds.size} entries!` : dupSaving ? "Saving…" : `📄 Duplicate ${dupIds.size} Selected`}
            </button>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={true} selected={dupIds} onToggle={id => setDupIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onSelectAll={() => setDupIds(new Set(filtered.map(s => s.id)))}
            onDeselectAll={() => setDupIds(new Set())} />
        </div>
      )}

      {/* ── IMPORT CSV/EXCEL ── */}
      {mode === "import" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>📂 Import from CSV / Excel</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
              Upload a file with columns: <b>course, subject, date, type, time, shift, room, marks</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={downloadImportTemplate}
                style={{ ...css.btn, background: "#E0F2FE", color: "#0369A1", border: "1px solid #BAE6FD", fontSize: 12 }}>
                📋 Download Template
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()}
                style={{ ...css.btn, background: "#7c3aed", color: "white", fontSize: 13 }}>
                📂 Upload File
              </button>
              {importRows.length > 0 && (
                <div style={{ background: "#E1F5EE", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#0F6E56" }}>
                  ✅ {importRows.length} rows ready to import
                </div>
              )}
              {importErrors.length > 0 && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400E" }}>
                  ⚠️ {importErrors.length} rows skipped:<br />
                  {importErrors.map((e, i) => <div key={i} style={{ marginTop: 2 }}>• {e}</div>)}
                </div>
              )}
              {importRows.length > 0 && !importDone && (
                <button onClick={handleImportSave} disabled={importSaving}
                  style={{ ...css.btn, background: importSaving ? "#93C5FD" : "#1a3c2e", color: "white", fontSize: 13 }}>
                  {importSaving ? "Saving…" : `💾 Confirm Import (${importRows.length} entries)`}
                </button>
              )}
              {importDone && (
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  ✅ Import complete!
                </div>
              )}
            </div>
          </div>
          {/* Import preview */}
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "11px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>
              {importRows.length ? `📋 Import Preview (${importRows.length} rows)` : "📋 Awaiting file upload…"}
            </div>
            {importRows.length > 0 ? (
              <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                      {["Course","Subject","Date","Exam Type","Shift","Time","Room","Marks"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 12px" }}><span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.course}</span></td>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.subject}</td>
                        <td style={{ padding: "8px 12px" }}>{r.exam_date}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{examTypes.find(e => e.id === r.exam_type_id)?.name || r.exam_type_id}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.shift}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.time}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.room || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.total_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontSize: 13 }}>Upload a CSV or Excel file to preview before importing.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Always show table below in non-duplicate modes except when table is already shown inline */}
      {(mode === "multi" || mode === "generate") && (
        <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
          filterCourse={filterCourse} setFilterCourse={setFilterCourse}
          filterExamType={filterExamType} setFilterExamType={setFilterExamType}
          onDelete={handleDelete} selectable={false} />
      )}
    </div>
  );
}

// ─── Shared Schedule Table ────────────────────────────────────────────────────
// ─── SCHEDULE (v2 — Full Bulk Assign) ────────────────────────────────────────
// Drop-in replacement for the Schedule function in Exams.jsx
// Features added:
//  ① Bulk assign: one subject → multiple courses at once
//  ② Multi-subject entry: add all subjects for a course in one submit
//  ③ Duplicate/copy entries across dates
//  ④ Batch generate: full timetable over a date range (one subject/day)
//  ⑤ Import from CSV/Excel
//  ⑥ Original single-entry form preserved as "Single" tab

  // ─── Generate save ────────────────────────────────────────────────────────
  const handleSaveGenerate = async () => {
    if (!genPreview.length) return;
    setGenSaving(true);
    const rows = genPreview.map(r => ({
      exam_type_id: genExamType, course: genCourse,
      subject: r.subject, exam_date: r.exam_date,
      time: genTime, shift: genShift, room: genRoom,
      total_marks: Number(r.total_marks) || 100,
    }));
    await supabase.from("exam_schedule").insert(rows);
    setGenSaving(false); setGenSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setGenSaved(false), 2500);
  };

  // ─── Duplicate selected entries to new date ───────────────────────────────
  const handleDuplicate = async () => {
    if (!dupDate || !dupIds.size) return;
    setDupSaving(true);
    const toDup = schedule.filter(s => dupIds.has(s.id));
    const rows = toDup.map(({ id, created_at, ...rest }) => ({ ...rest, exam_date: dupDate }));
    await supabase.from("exam_schedule").insert(rows);
    setDupSaving(false); setDupSaved(true); setDupIds(new Set()); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setDupSaved(false), 2500);
  };

  // ─── Import from CSV/Excel ────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    await ensureLibs(); const XLSX = window.XLSX;
    let rows = [];
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      const text = await file.text();
      const lines = text.trim().split("\n").map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
      rows = lines;
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    }
    if (!rows.length) return;
    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    const col = (name) => headers.findIndex(h => h.includes(name));
    const parsed = []; const errors = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const course    = r[col("course")]?.toString().trim().toUpperCase();
      const subject   = r[col("subject")]?.toString().trim();
      const exam_date = r[col("date")]?.toString().trim();
      const exam_type_id = examTypes.find(et => et.name.toLowerCase().includes(r[col("type")]?.toString().toLowerCase()))?.id || examTypes[0]?.id;
      if (!course || !subject || !exam_date) { errors.push(`Row ${i+1}: missing course/subject/date`); continue; }
      parsed.push({
        exam_type_id, course, subject, exam_date,
        time: r[col("time")]?.toString().trim() || "09:00",
        shift: r[col("shift")]?.toString().trim() || "Morning",
        room: r[col("room")]?.toString().trim() || "",
        total_marks: Number(r[col("marks")]) || 100,
      });
    }
    setImportRows(parsed); setImportErrors(errors); setImportDone(false);
  };

  const handleImportSave = async () => {
    if (!importRows.length) return;
    setImportSaving(true);
    await supabase.from("exam_schedule").insert(importRows);
    setImportSaving(false); setImportDone(true); fetchSchedule(); onScheduleChange?.();
  };

  const downloadImportTemplate = () => {
    const headers = ["course","subject","date","type","time","shift","room","marks"];
    const example = [courses[0]||"ACHIEVER", courseSubjects[courses[0]]?.[0]||"Mathematics", "2025-06-01", examTypes[0]?.name||"1st Monthly Test", "09:00", "Morning", "Hall A", "100"];
    const csv = [headers, example].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "GNSI_Schedule_Import_Template.csv";
    a.click();
  };

  // ─── Delete single ────────────────────────────────────────────────────────
  const handleDelete = async id => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("exam_schedule").delete().eq("id", id);
    fetchSchedule(); onScheduleChange?.();
  };

  // ─── Filtered view ────────────────────────────────────────────────────────
  const filtered = schedule.filter(s => {
    const matchCourse = filterCourse === "ALL" || s.course === filterCourse;
    const matchType = filterExamType === "ALL" || s.exam_type_id === filterExamType;
    return matchCourse && matchType;
  });

  // ─── UI helpers ───────────────────────────────────────────────────────────
  const ModeBtn = ({ id, icon, label }) => (
    <button onClick={() => setMode(id)}
      style={{ ...css.btn, padding: "8px 16px", background: mode === id ? "#1a3c2e" : "#F3F4F6",
        color: mode === id ? "white" : "#374151", border: mode === id ? "none" : "1px solid #E5E7EB", fontSize: 12 }}>
      {icon} {label}
    </button>
  );

  const FieldLabel = ({ children }) => (
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>{children}</label>
  );

  const commonFields = (state, setState) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div>
        <FieldLabel>Shift</FieldLabel>
        <select value={state.shift} onChange={e => setState(p => ({ ...p, shift: e.target.value }))} style={css.input}>
          <option value="Morning">🌅 Morning</option>
          <option value="Afternoon">🌤️ Afternoon</option>
          <option value="Evening">🌆 Evening</option>
        </select>
      </div>
      <div>
        <FieldLabel>Time</FieldLabel>
        <input type="time" value={state.time} onChange={e => setState(p => ({ ...p, time: e.target.value }))} style={css.input} />
      </div>
      <div>
        <FieldLabel>Room / Hall</FieldLabel>
        <input value={state.room} onChange={e => setState(p => ({ ...p, room: e.target.value }))} placeholder="e.g. Hall A" style={css.input} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Mode switcher */}
      <div style={{ background: "white", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginRight: 4 }}>Mode:</span>
        <ModeBtn id="single"    icon="✏️"  label="Single Entry" />
        <ModeBtn id="multi"     icon="📋" label="Multi-Subject" />
        <ModeBtn id="bulk"      icon="🔀" label="One Subject → Many Courses" />
        <ModeBtn id="generate"  icon="⚡" label="Auto-Generate Timetable" />
        <ModeBtn id="duplicate" icon="📄" label="Duplicate Entries" />
        <ModeBtn id="import"    icon="📂" label="Import CSV/Excel" />
      </div>

      {/* ── SINGLE ENTRY ── */}
      {mode === "single" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>➕ Add Single Entry</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={form.exam_type_id} onChange={e => setForm(p => ({ ...p, exam_type_id: e.target.value }))} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Course / Batch</FieldLabel>
                <select value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value, subject: "" }))} style={css.input}>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><FieldLabel>Subject</FieldLabel>
                <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} style={css.input}>
                  <option value="">— Select Subject —</option>
                  {(courseSubjects[form.course] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><FieldLabel>Date</FieldLabel>
                <input type="date" value={form.exam_date} onChange={e => setForm(p => ({ ...p, exam_date: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Shift</FieldLabel>
                <select value={form.shift} onChange={e => setForm(p => ({ ...p, shift: e.target.value }))} style={css.input}>
                  <option value="Morning">🌅 Morning</option>
                  <option value="Afternoon">🌤️ Afternoon</option>
                  <option value="Evening">🌆 Evening</option>
                </select></div>
              <div><FieldLabel>Time</FieldLabel>
                <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Total Marks</FieldLabel>
                <input type="number" value={form.total_marks} onChange={e => setForm(p => ({ ...p, total_marks: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Room / Hall</FieldLabel>
                <input value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))} style={css.input} /></div>
              <SaveBtn onClick={handleSaveSingle} saving={saving} saved={saved} label="Add Entry" />
            </div>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={false} />
        </div>
      )}

      {/* ── MULTI-SUBJECT ── */}
      {mode === "multi" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>📋 Multi-Subject Entry</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Add all subjects for a course at once. Set a start date to auto-fill dates (one per day).</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={msExamType} onChange={e => setMsExamType(e.target.value)} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Course / Batch</FieldLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {courses.map(c => (
                    <button key={c} onClick={() => setMsCourse(c)}
                      style={{ ...css.btn, padding: "5px 14px", fontSize: 11, background: msCourse === c ? "#1a3c2e" : "#F3F4F6", color: msCourse === c ? "white" : "#374151", border: msCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>
                  ))}
                </div></div>
              <div><FieldLabel>Auto-fill Start Date (optional)</FieldLabel>
                <input type="date" value={msStartDate} onChange={e => setMsStartDate(e.target.value)} style={{ ...css.input, width: 180 }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel>
                  <select value={msShift} onChange={e => setMsShift(e.target.value)} style={css.input}>
                    <option>Morning</option><option>Afternoon</option><option>Evening</option>
                  </select></div>
                <div><FieldLabel>Time</FieldLabel>
                  <input type="time" value={msTime} onChange={e => setMsTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel>
                <input value={msRoom} onChange={e => setMsRoom(e.target.value)} style={css.input} /></div>
            </div>
            <button onClick={handleSaveMulti} disabled={msSaving}
              style={{ ...css.btn, background: msSaved ? "#16A34A" : msSaving ? "#93C5FD" : "#1a3c2e", color: "white", width: "100%", fontSize: 13 }}>
              {msSaved ? `✓ Saved ${msRows.filter(r=>r.date).length} entries!` : msSaving ? "Saving…" : `💾 Save ${msRows.filter(r=>r.date).length} Entries`}
            </button>
          </div>
          {/* Per-subject rows */}
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Subject List for <span style={{ color: "#1a3c2e" }}>{msCourse}</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {msRows.map((r, i) => (
                <div key={r.subject} style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px", gap: 8, alignItems: "center", padding: "8px 12px", background: i % 2 ? "#F9FAFB" : "white", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                    <span style={{ fontSize: 10, color: "#94A3B8", marginRight: 6 }}>{i + 1}.</span>{r.subject}
                  </div>
                  <input type="date" value={r.date}
                    onChange={e => setMsRows(p => p.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                    style={{ ...css.input, fontSize: 12, padding: "5px 8px" }} />
                  <input type="number" value={r.marks}
                    onChange={e => setMsRows(p => p.map((x, j) => j === i ? { ...x, marks: e.target.value } : x))}
                    style={{ ...css.input, fontSize: 12, padding: "5px 8px" }} placeholder="Max" />
                </div>
              ))}
              {!msRows.length && <div style={{ color: "#94A3B8", textAlign: "center", padding: 20 }}>No subjects for this course.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── BULK: ONE SUBJECT → MANY COURSES ── */}
      {mode === "bulk" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>🔀 One Subject → Many Courses</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Assign the same subject/date to multiple courses at once.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={bkExamType} onChange={e => setBkExamType(e.target.value)} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Subject Name</FieldLabel>
                <input value={bkSubject} onChange={e => setBkSubject(e.target.value)} placeholder="e.g. Mathematics" style={css.input} /></div>
              <div><FieldLabel>Date</FieldLabel>
                <input type="date" value={bkDate} onChange={e => setBkDate(e.target.value)} style={css.input} /></div>
              <div><FieldLabel>Total Marks</FieldLabel>
                <input type="number" value={bkMarks} onChange={e => setBkMarks(e.target.value)} style={css.input} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel>
                  <select value={bkShift} onChange={e => setBkShift(e.target.value)} style={css.input}>
                    <option>Morning</option><option>Afternoon</option><option>Evening</option>
                  </select></div>
                <div><FieldLabel>Time</FieldLabel>
                  <input type="time" value={bkTime} onChange={e => setBkTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel>
                <input value={bkRoom} onChange={e => setBkRoom(e.target.value)} style={css.input} /></div>
              <div>
                <FieldLabel>Target Courses ({bkCourses.size} selected)</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => setBkCourses(new Set(courses))}
                    style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#E0F2FE", color: "#0369A1" }}>All</button>
                  <button onClick={() => setBkCourses(new Set())}
                    style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626" }}>None</button>
                  {courses.map(c => {
                    const sel = bkCourses.has(c);
                    return (
                      <button key={c} onClick={() => setBkCourses(p => { const n = new Set(p); sel ? n.delete(c) : n.add(c); return n; })}
                        style={{ ...css.btn, padding: "5px 14px", fontSize: 11, background: sel ? "#1a3c2e" : "#F3F4F6", color: sel ? "white" : "#374151", border: sel ? "none" : "1px solid #E5E7EB" }}>
                        {sel ? "✓ " : ""}{c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={handleSaveBulk} disabled={bkSaving || !bkCourses.size || !bkDate || !bkSubject}
                style={{ ...css.btn, background: bkSaved ? "#16A34A" : bkSaving ? "#93C5FD" : "#1a3c2e", color: "white", fontSize: 13, marginTop: 4 }}>
                {bkSaved ? `✓ Saved to ${bkCourses.size} courses!` : bkSaving ? "Saving…" : `💾 Assign to ${bkCourses.size} Courses`}
              </button>
            </div>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={false} />
        </div>
      )}

      {/* ── AUTO-GENERATE TIMETABLE ── */}
      {mode === "generate" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>⚡ Auto-Generate Timetable</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>One subject per day, starting from a date. Drag rows to reorder subjects.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={genExamType} onChange={e => setGenExamType(e.target.value)} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Course</FieldLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {courses.map(c => (
                    <button key={c} onClick={() => setGenCourse(c)}
                      style={{ ...css.btn, padding: "5px 14px", fontSize: 11, background: genCourse === c ? "#1a3c2e" : "#F3F4F6", color: genCourse === c ? "white" : "#374151", border: genCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>
                  ))}
                </div></div>
              <div><FieldLabel>Start Date</FieldLabel>
                <input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} style={css.input} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel>
                  <select value={genShift} onChange={e => setGenShift(e.target.value)} style={css.input}>
                    <option>Morning</option><option>Afternoon</option><option>Evening</option>
                  </select></div>
                <div><FieldLabel>Time</FieldLabel>
                  <input type="time" value={genTime} onChange={e => setGenTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel>
                <input value={genRoom} onChange={e => setGenRoom(e.target.value)} style={css.input} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={genSkipWeekends} onChange={e => setGenSkipWeekends(e.target.checked)} />
                Skip weekends (Sat & Sun)
              </label>
            </div>
            <div style={{ marginTop: 16 }}>
              <FieldLabel>Subject Order (drag to reorder)</FieldLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {genSubjectOrder.map((s, i) => (
                  <div key={s.subject} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button onClick={() => { if (i === 0) return; const n = [...genSubjectOrder]; [n[i-1], n[i]] = [n[i], n[i-1]]; setGenSubjectOrder(n); }}
                        style={{ ...css.btn, padding: "1px 6px", fontSize: 10, background: "#E5E7EB", color: "#374151" }}>▲</button>
                      <button onClick={() => { if (i === genSubjectOrder.length - 1) return; const n = [...genSubjectOrder]; [n[i], n[i+1]] = [n[i+1], n[i]]; setGenSubjectOrder(n); }}
                        style={{ ...css.btn, padding: "1px 6px", fontSize: 10, background: "#E5E7EB", color: "#374151" }}>▼</button>
                    </div>
                    <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, minWidth: 16 }}>{i+1}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{s.subject}</span>
                    <input type="number" value={s.marks}
                      onChange={e => setGenSubjectOrder(p => p.map((x, j) => j === i ? { ...x, marks: Number(e.target.value) } : x))}
                      style={{ width: 60, padding: "4px 6px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview + save */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...css.card, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: "#1e293b" }}>
                  {genPreview.length} exam days generated
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                  {genCourse} · {examTypes.find(e=>e.id===genExamType)?.name} · starts {genStartDate || "—"}
                </div>
              </div>
              <button onClick={handleSaveGenerate} disabled={!genPreview.length || genSaving}
                style={{ ...css.btn, background: genSaved ? "#16A34A" : genSaving ? "#93C5FD" : "#1a3c2e", color: "white", padding: "10px 22px", fontSize: 13 }}>
                {genSaved ? `✓ Saved ${genPreview.length} entries!` : genSaving ? "Saving…" : `💾 Save ${genPreview.length} Entries`}
              </button>
            </div>
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "11px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📅 Preview</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                  {["#","Date","Day","Subject","Marks"].map(h => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {genPreview.map((r, i) => {
                    const day = new Date(r.exam_date).toLocaleDateString("en-IN", { weekday: "short" });
                    return (
                      <tr key={i} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 14px", color: "#94A3B8", fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600 }}>{r.exam_date}</td>
                        <td style={{ padding: "8px 14px", color: "#64748b" }}>{day}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600, color: "#1a3c2e" }}>{r.subject}</td>
                        <td style={{ padding: "8px 14px", color: "#64748b" }}>{r.total_marks}</td>
                      </tr>
                    );
                  })}
                  {!genPreview.length && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>Set a start date to preview.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DUPLICATE ENTRIES ── */}
      {mode === "duplicate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...css.card, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1e293b", flex: "0 0 100%", marginBottom: 4 }}>
              📄 Duplicate Schedule Entries to a New Date
            </div>
            <div>
              <FieldLabel>Copy to Date</FieldLabel>
              <input type="date" value={dupDate} onChange={e => setDupDate(e.target.value)} style={{ ...css.input, width: 180 }} />
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>
              {dupIds.size} entries selected
            </div>
            <button onClick={handleDuplicate} disabled={!dupIds.size || !dupDate || dupSaving}
              style={{ ...css.btn, background: dupSaved ? "#16A34A" : dupSaving ? "#93C5FD" : "#7c3aed", color: "white", fontSize: 13 }}>
              {dupSaved ? `✓ Duplicated ${dupIds.size} entries!` : dupSaving ? "Saving…" : `📄 Duplicate ${dupIds.size} Selected`}
            </button>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={true} selected={dupIds} onToggle={id => setDupIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onSelectAll={() => setDupIds(new Set(filtered.map(s => s.id)))}
            onDeselectAll={() => setDupIds(new Set())} />
        </div>
      )}

      {/* ── IMPORT CSV/EXCEL ── */}
      {mode === "import" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>📂 Import from CSV / Excel</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
              Upload a file with columns: <b>course, subject, date, type, time, shift, room, marks</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={downloadImportTemplate}
                style={{ ...css.btn, background: "#E0F2FE", color: "#0369A1", border: "1px solid #BAE6FD", fontSize: 12 }}>
                📋 Download Template
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()}
                style={{ ...css.btn, background: "#7c3aed", color: "white", fontSize: 13 }}>
                📂 Upload File
              </button>
              {importRows.length > 0 && (
                <div style={{ background: "#E1F5EE", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#0F6E56" }}>
                  ✅ {importRows.length} rows ready to import
                </div>
              )}
              {importErrors.length > 0 && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400E" }}>
                  ⚠️ {importErrors.length} rows skipped:<br />
                  {importErrors.map((e, i) => <div key={i} style={{ marginTop: 2 }}>• {e}</div>)}
                </div>
              )}
              {importRows.length > 0 && !importDone && (
                <button onClick={handleImportSave} disabled={importSaving}
                  style={{ ...css.btn, background: importSaving ? "#93C5FD" : "#1a3c2e", color: "white", fontSize: 13 }}>
                  {importSaving ? "Saving…" : `💾 Confirm Import (${importRows.length} entries)`}
                </button>
              )}
              {importDone && (
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  ✅ Import complete!
                </div>
              )}
            </div>
          </div>
          {/* Import preview */}
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "11px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>
              {importRows.length ? `📋 Import Preview (${importRows.length} rows)` : "📋 Awaiting file upload…"}
            </div>
            {importRows.length > 0 ? (
              <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                      {["Course","Subject","Date","Exam Type","Shift","Time","Room","Marks"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 12px" }}><span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.course}</span></td>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.subject}</td>
                        <td style={{ padding: "8px 12px" }}>{r.exam_date}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{examTypes.find(e => e.id === r.exam_type_id)?.name || r.exam_type_id}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.shift}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.time}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.room || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.total_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontSize: 13 }}>Upload a CSV or Excel file to preview before importing.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Always show table below in non-duplicate modes except when table is already shown inline */}
      {(mode === "multi" || mode === "generate") && (
        <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
          filterCourse={filterCourse} setFilterCourse={setFilterCourse}
          filterExamType={filterExamType} setFilterExamType={setFilterExamType}
          onDelete={handleDelete} selectable={false} />
      )}
    </div>
  );
}

// ─── REPORT CARDS ─────────────────────────────────────────────────────────────
function ReportCardItem({ st, subjects, marks, examType, examDate, examName, institute, allStudents, course }) {
  const { remark, setRemark, save: saveRemark, saving: savingRemark, saved: savedRemark } = useRemarks(st.id, examType, examDate);
  const courseMax = getCourseMax(course);
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const total = getTotal(st.id);
  const pct = calcPct(total, course);
  const grade = getGrade(pct);

  const printReport = () => {
    const sortedStudents = [...allStudents].map(s => ({ ...s, total: getTotal(s.id) })).sort((a, b) => b.total - a.total);
    let rank = 1, prev = null;
    for (let i = 0; i < sortedStudents.length; i++) {
      if (i === 0) { rank = 1; prev = sortedStudents[i].total; } else if (sortedStudents[i].total !== prev) { rank++; prev = sortedStudents[i].total; }
      if (sortedStudents[i].id === st.id) break;
    }
    const rankSuffix = rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
    const totalStudents = allStudents.length;
    const passed = pct >= 40;
    const gradeColors = { "A+": "#0F6E56", "A": "#185FA5", "B+": "#534AB7", "B": "#2563eb", "C": "#BA7517", "D": "#ea580c", "F": "#A32D2D" };
    const gradeColor = gradeColors[grade.label] || "#1a3c2e";

    // Per-subject bar width for visual bar
    const subjectRows = subjects.map((s, idx) => {
      const m = Number(marks[`${st.id}-${s}`]) || 0;
      const subMax = getSubjectMax(course, s);
      const subPct = Math.round((m / subMax) * 100);
      const subPassed = subPct >= 40;
      const barColor = subPct >= 80 ? "#0F6E56" : subPct >= 60 ? "#185FA5" : subPct >= 40 ? "#BA7517" : "#A32D2D";
      const rowBg = idx % 2 === 0 ? "#FDFAF3" : "#FFFFFF";
      return `
        <tr style="background:${rowBg}">
          <td class="sub-name">${s}</td>
          <td class="marks-cell">${m}<span class="marks-max">/${subMax}</span></td>
          <td class="bar-cell">
            <div class="bar-track">
              <div class="bar-fill" style="width:${subPct}%;background:${barColor}"></div>
            </div>
          </td>
          <td class="pct-cell" style="color:${barColor}">${subPct}%</td>
          <td class="result-cell">
            <span class="result-pill" style="background:${subPassed ? "#E1F5EE" : "#FCEBEB"};color:${subPassed ? "#0F6E56" : "#A32D2D"}">${subPassed ? "✓ PASS" : "✗ FAIL"}</span>
          </td>
        </tr>`;
    }).join("");

    const remarkBlock = remark ? `
      <div class="remark-box">
        <div class="remark-label">✦ Teacher's Remarks</div>
        <div class="remark-text">"${remark}"</div>
      </div>` : "";

    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head>
    <title>Report Card — ${st.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      :root {
        --green:   #1a3c2e;
        --green2:  #2A5C45;
        --green3:  #3a7a5c;
        --gold:    #B8860B;
        --gold2:   #D4A017;
        --gold3:   #f0c040;
        --cream:   #FDFAF3;
        --cream2:  #F5EFE0;
        --border:  #D5C89A;
        --text:    #1C1A16;
        --text2:   #5C5440;
        --grade:   ${gradeColor};
      }
      @page { margin: 0.7cm; size: A4; }
      body {
        font-family: 'DM Sans', sans-serif;
        background: #d6cfc0;
        padding: 24px;
        color: var(--text);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        text-align: center; margin-bottom: 18px;
        display: flex; gap: 10px; justify-content: center;
      }
      .no-print button {
        padding: 10px 28px; border: none; border-radius: 8px; cursor: pointer;
        font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
      }
      .btn-print { background: var(--green); color: white; }
      .btn-close { background: #e5e7eb; color: #374151; }

      /* ── Card shell ── */
      .card {
        width: 740px; margin: 0 auto;
        background: var(--cream);
        border-radius: 3px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.22), 0 0 0 1px var(--border);
        position: relative;
        overflow: hidden;
      }

      /* ── Decorative corner ornaments ── */
      .card::before, .card::after {
        content: '';
        position: absolute;
        width: 120px; height: 120px;
        background: radial-gradient(circle at center, var(--gold) 0%, transparent 70%);
        opacity: 0.07;
        pointer-events: none;
        z-index: 0;
      }
      .card::before { top: -40px; left: -40px; }
      .card::after  { bottom: -40px; right: -40px; }

      /* ── Top rainbow strip ── */
      .top-strip {
        height: 6px;
        background: linear-gradient(90deg,
          var(--green) 0%, var(--green2) 30%,
          var(--gold) 60%, var(--gold3) 80%,
          var(--green3) 100%);
        position: relative; z-index: 2;
      }

      /* ── Header ── */
      .header {
        background: linear-gradient(150deg, #0d2818 0%, var(--green) 45%, #1e4d36 100%);
        padding: 26px 36px 22px;
        position: relative; z-index: 1; overflow: hidden;
      }
      .header-pattern {
        position: absolute; inset: 0; opacity: 0.04;
        background-image: repeating-linear-gradient(
          45deg,
          var(--gold3) 0px, var(--gold3) 1px,
          transparent 1px, transparent 12px
        );
      }
      .header-inner {
        display: flex; align-items: center; gap: 20px;
        position: relative; z-index: 1;
      }
      .logo-ring {
        width: 72px; height: 72px; border-radius: 50%;
        border: 2.5px solid var(--gold2);
        box-shadow: 0 0 0 4px rgba(184,134,11,0.2), inset 0 0 20px rgba(0,0,0,0.3);
        background: rgba(255,255,255,0.08);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .logo-text {
        font-family: 'Playfair Display', serif;
        font-size: 16px; font-weight: 700;
        color: var(--gold3); letter-spacing: 1px;
      }
      .header-text { flex: 1; text-align: center; }
      .eyebrow {
        font-size: 9px; letter-spacing: 5px; text-transform: uppercase;
        color: rgba(240,192,64,0.75); margin-bottom: 5px;
      }
      .inst-name {
        font-family: 'Playfair Display', serif;
        font-size: 22px; font-weight: 600; color: #fff;
        letter-spacing: .3px; line-height: 1.2; margin-bottom: 3px;
      }
      .inst-addr { font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 4px; }
      .doc-title {
        display: inline-block;
        font-family: 'Cormorant Garamond', serif;
        font-size: 13px; font-style: italic; font-weight: 400;
        color: var(--gold3); letter-spacing: 2px;
        border-top: 1px solid rgba(240,192,64,0.4);
        border-bottom: 1px solid rgba(240,192,64,0.4);
        padding: 3px 18px; margin-top: 6px;
      }
      .exam-tag {
        flex-shrink: 0; text-align: center;
      }
      .exam-tag-inner {
        background: rgba(184,134,11,0.18);
        border: 1px solid rgba(240,192,64,0.4);
        border-radius: 6px; padding: 8px 14px;
      }
      .exam-tag-name {
        font-family: 'Playfair Display', serif;
        font-size: 13px; font-weight: 600; color: var(--gold3);
        letter-spacing: .5px; line-height: 1.3;
      }
      .exam-tag-date {
        font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 2px;
      }

      /* ── Gold rule ── */
      .gold-rule {
        display: flex; align-items: center;
        padding: 0 36px; background: var(--cream2);
        border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
        height: 24px;
      }
      .gold-rule-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--gold2), transparent); }
      .gold-rule-ornament { color: var(--gold2); font-size: 12px; margin: 0 14px; }

      /* ── Student strip ── */
      .student-strip {
        display: flex; align-items: stretch;
        background: white; border-bottom: 1px solid #EDE8D8;
        position: relative; z-index: 1;
      }
      .student-strip-left {
        flex: 1; padding: 18px 36px;
        display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 0; border-right: 1px solid #EDE8D8;
      }
      .info-block { padding: 0 16px; border-right: 1px solid #EDE8D8; }
      .info-block:first-child { padding-left: 0; }
      .info-block:last-child { border-right: none; }
      .info-label {
        font-size: 8.5px; letter-spacing: 2.5px; text-transform: uppercase;
        color: var(--gold); font-weight: 600; margin-bottom: 5px;
      }
      .info-value {
        font-family: 'Cormorant Garamond', serif;
        font-size: 15px; font-weight: 600; color: var(--text);
      }
      .info-value.big {
        font-family: 'Playfair Display', serif;
        font-size: 18px; color: var(--green);
      }
      .info-value.rank-val {
        font-family: 'Playfair Display', serif;
        font-size: 20px; font-weight: 700;
        color: ${rank <= 3 ? "var(--gold)" : "var(--green)"};
      }
      .student-strip-right {
        width: 130px; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 14px 16px; gap: 6px;
      }
      .grade-circle {
        width: 72px; height: 72px; border-radius: 50%;
        border: 3px solid var(--grade);
        box-shadow: 0 0 0 6px ${gradeColor}18;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: ${grade.bg};
      }
      .grade-letter {
        font-family: 'Playfair Display', serif;
        font-size: 28px; font-weight: 700; color: var(--grade);
        line-height: 1;
      }
      .grade-sub { font-size: 9px; color: var(--grade); font-weight: 600; letter-spacing: 1px; margin-top: 1px; }
      .status-pill {
        font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
        padding: 3px 12px; border-radius: 999px;
        background: ${passed ? "#E1F5EE" : "#FCEBEB"};
        color: ${passed ? "#0F6E56" : "#A32D2D"};
        border: 1px solid ${passed ? "#BBF7D0" : "#FECACA"};
      }

      /* ── Score bar row ── */
      .score-bar-row {
        display: flex; gap: 0;
        background: var(--green);
        padding: 0; overflow: hidden;
      }
      .score-stat {
        flex: 1; text-align: center;
        padding: 12px 8px;
        border-right: 1px solid rgba(255,255,255,0.1);
        position: relative;
      }
      .score-stat:last-child { border-right: none; }
      .score-stat-label {
        font-size: 8px; letter-spacing: 2.5px; text-transform: uppercase;
        color: rgba(240,192,64,0.7); margin-bottom: 4px;
      }
      .score-stat-value {
        font-family: 'Playfair Display', serif;
        font-size: 22px; font-weight: 600; color: white; line-height: 1;
      }
      .score-stat-sub { font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 2px; }
      .pct-highlight { color: var(--gold3) !important; }

      /* ── Subject table ── */
      .subjects-section { padding: 20px 36px; position: relative; z-index: 1; }
      .section-heading {
        font-family: 'Cormorant Garamond', serif;
        font-size: 14px; font-weight: 600; color: var(--green);
        letter-spacing: 2px; text-transform: uppercase;
        margin-bottom: 12px; display: flex; align-items: center; gap: 10px;
      }
      .section-heading::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,var(--border),transparent); }

      .sub-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .sub-table thead tr { background: transparent; }
      .sub-table thead th {
        padding: 6px 10px; text-align: left;
        font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
        color: var(--text2); font-weight: 600; border-bottom: 2px solid var(--border);
      }
      .sub-table thead th.center { text-align: center; }
      .sub-name { padding: 10px 10px; font-weight: 500; color: var(--text); width: 38%; }
      .marks-cell { padding: 10px 10px; text-align: center; font-family: 'Cormorant Garamond', serif; font-size: 17px; font-weight: 600; color: var(--green); width: 10%; }
      .marks-max { font-size: 11px; color: #9CA3AF; font-weight: 400; }
      .bar-cell { padding: 10px 10px; width: 28%; }
      .bar-track { height: 7px; background: #E5E7EB; border-radius: 999px; overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 999px; transition: width .3s; }
      .pct-cell { padding: 10px 8px; text-align: center; font-weight: 700; font-size: 13px; width: 10%; }
      .result-cell { padding: 10px 10px; text-align: center; width: 14%; }
      .result-pill { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
      .total-row td { padding: 12px 10px; border-top: 2px solid var(--border); background: var(--cream2); font-weight: 700; }
      .total-label { font-family: 'Playfair Display', serif; font-size: 14px; color: var(--green); }
      .total-marks { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--green); }

      /* ── Remark ── */
      .remark-box {
        margin: 0 36px 18px;
        padding: 14px 18px;
        background: white;
        border: 1px solid var(--border);
        border-left: 4px solid var(--gold);
        border-radius: 4px;
        position: relative; z-index: 1;
      }
      .remark-label {
        font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;
        color: var(--gold); font-weight: 700; margin-bottom: 6px;
      }
      .remark-text {
        font-family: 'Cormorant Garamond', serif;
        font-size: 15px; font-style: italic; color: var(--text2); line-height: 1.6;
      }

      /* ── Signatures ── */
      .sig-section {
        display: flex; align-items: flex-end; justify-content: space-between;
        padding: 18px 36px 20px;
        background: white;
        border-top: 1px solid #EDE8D8;
        position: relative; z-index: 1;
        gap: 20px;
      }
      .sig-block { text-align: center; flex: 1; }
      .sig-svg { margin-bottom: 2px; display: flex; justify-content: center; }
      .sig-line { height: 1.5px; background: linear-gradient(90deg, transparent, var(--border), var(--text), var(--border), transparent); margin: 4px 12px; }
      .sig-title { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--text2); font-weight: 600; margin-top: 4px; }
      .sig-name-sub { font-size: 11px; color: var(--green); font-weight: 600; margin-top: 2px; }
      .seal-block { flex: 0 0 80px; display: flex; flex-direction: column; align-items: center; }
      .seal {
        width: 72px; height: 72px; border-radius: 50%;
        border: 2px dashed var(--gold);
        background: var(--cream2);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 1px;
      }
      .seal-word { font-size: 7.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--gold); font-weight: 700; }
      .seal-star { font-size: 16px; color: var(--gold); line-height: 1; }

      /* ── Footer strip ── */
      .footer-strip {
        background: linear-gradient(90deg, #0d2818, var(--green), #0d2818);
        padding: 9px 36px; position: relative; z-index: 1;
      }
      .footer-strip::before {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; height: 2px;
        background: linear-gradient(90deg, var(--gold), var(--gold3), var(--gold));
      }
      .footer-text { font-size: 10px; color: rgba(255,255,255,0.55); text-align: center; letter-spacing: .5px; }

      @media print {
        body { background: white; padding: 0; }
        .no-print { display: none !important; }
        .card { box-shadow: none; border-radius: 0; width: 100%; margin: 0; }
      }
    </style></head><body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button class="btn-close" onclick="window.close()">✕ Close</button>
    </div>
    <div class="card">
      <div class="top-strip"></div>

      <!-- Header -->
      <div class="header">
        <div class="header-pattern"></div>
        <div class="header-inner">
          <div class="logo-ring">
            ${institute.logoUrl
              ? `<img src="${institute.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%"/>`
              : `<div class="logo-text">GNSI</div>`}
          </div>
          <div class="header-text">
            <div class="eyebrow">Official Academic Record · ${institute.academicYear || "2025-2026"}</div>
            <div class="inst-name">${institute.name || "Guidance Navodaya & Sainik Institute"}</div>
            <div class="inst-addr">${institute.address || "Khangabok, Manipur"}</div>
            <div class="doc-title">Report Card</div>
          </div>
          <div class="exam-tag">
            <div class="exam-tag-inner">
              <div class="exam-tag-name">${examName}</div>
              <div class="exam-tag-date">${examDate || ""}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="gold-rule">
        <div class="gold-rule-line"></div>
        <div class="gold-rule-ornament">◆ &nbsp; ◆ &nbsp; ◆</div>
        <div class="gold-rule-line"></div>
      </div>

      <!-- Student Info -->
      <div class="student-strip">
        <div class="student-strip-left">
          <div class="info-block">
            <div class="info-label">Student Name</div>
            <div class="info-value big">${st.name}</div>
          </div>
          <div class="info-block">
            <div class="info-label">GCC Number</div>
            <div class="info-value big">${st.gcc_no || "—"}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Course / Batch</div>
            <div class="info-value">${st.course || course} · ${st.class_name || "—"}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Class Rank</div>
            <div class="info-value rank-val">${rank}<sup style="font-size:12px">${rankSuffix}</sup> <span style="font-size:12px;color:#9CA3AF;font-family:'DM Sans',sans-serif">/ ${totalStudents}</span></div>
          </div>
        </div>
        <div class="student-strip-right">
          <div class="grade-circle">
            <div class="grade-letter">${grade.label}</div>
            <div class="grade-sub">GRADE</div>
          </div>
          <div class="status-pill">${passed ? "✓ PASS" : "✗ FAIL"}</div>
        </div>
      </div>

      <!-- Score bar -->
      <div class="score-bar-row">
        <div class="score-stat">
          <div class="score-stat-label">Marks Obtained</div>
          <div class="score-stat-value">${total}<span style="font-size:13px;opacity:0.5">/${courseMax}</span></div>
        </div>
        <div class="score-stat">
          <div class="score-stat-label">Percentage</div>
          <div class="score-stat-value pct-highlight">${pct.toFixed(1)}%</div>
        </div>
        <div class="score-stat">
          <div class="score-stat-label">Grade Points</div>
          <div class="score-stat-value">${grade.gpa.toFixed(1)}</div>
          <div class="score-stat-sub">GPA / 4.0</div>
        </div>
        <div class="score-stat">
          <div class="score-stat-label">Subjects</div>
          <div class="score-stat-value">${subjects.length}</div>
          <div class="score-stat-sub">attempted</div>
        </div>
        <div class="score-stat">
          <div class="score-stat-label">Class Rank</div>
          <div class="score-stat-value">${rank}<span style="font-size:13px;opacity:0.5">/${totalStudents}</span></div>
        </div>
      </div>

      <!-- Subject table -->
      <div class="subjects-section">
        <div class="section-heading">Subject-wise Performance</div>
        <table class="sub-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th class="center">Score</th>
              <th>Performance Bar</th>
              <th class="center">%</th>
              <th class="center">Result</th>
            </tr>
          </thead>
          <tbody>
            ${subjectRows}
            <tr class="total-row">
              <td class="total-label">Grand Total</td>
              <td class="total-marks" style="text-align:center">${total}<span style="font-size:12px;color:#9CA3AF;font-weight:400">/${courseMax}</span></td>
              <td>
                <div class="bar-track">
                  <div class="bar-fill" style="width:${pct}%;background:${gradeColor}"></div>
                </div>
              </td>
              <td style="text-align:center;font-size:16px;font-weight:800;color:${gradeColor}">${pct.toFixed(1)}%</td>
              <td style="text-align:center">
                <span class="result-pill" style="background:${grade.bg};color:${gradeColor};font-size:11px">${grade.label} · ${grade.gpa.toFixed(1)} GPA</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      ${remarkBlock}

      <!-- Signatures -->
      <div class="sig-section">
        <div class="sig-block">
          <div class="sig-svg" style="height:44px"></div>
          <div class="sig-line"></div>
          <div class="sig-title">Student's Signature</div>
        </div>
        <div class="seal-block">
          <div class="seal">
            <div class="seal-word">Official</div>
            <div class="seal-star">★</div>
            <div class="seal-word">Seal</div>
          </div>
        </div>
        <div class="sig-block">
          <div class="sig-svg" style="height:44px"></div>
          <div class="sig-line"></div>
          <div class="sig-title">Class Teacher</div>
        </div>
        <div class="sig-block">
          <div class="sig-svg" style="height:44px"></div>
          <div class="sig-line"></div>
          <div class="sig-title">Head of Institute</div>
        </div>
      </div>

      <div class="footer-strip">
        <div class="footer-text">${institute.name || "GNSI"} &nbsp;·&nbsp; ${institute.address || "Khangabok, Manipur"} &nbsp;·&nbsp; ${examName} &nbsp;·&nbsp; Academic Year ${institute.academicYear || "2025-2026"}</div>
      </div>
    </div>
    </body></html>`);
    w.document.close();
  };

  return (
    <div style={{ ...css.card, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${grade.color},${grade.bg})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div><div style={{ fontWeight: 700, fontSize: 15 }}>{st.name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>GCC {st.gcc_no} · {st.class_name}</div></div>
        <Badge label={grade.label} color={grade.color} bg={grade.bg} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ textAlign: "center", padding: 8, background: "#F9FAFB", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600 }}>{total}<span style={{ fontSize: 11, color: "#9CA3AF" }}>/{courseMax}</span></div>
        </div>
        <div style={{ textAlign: "center", padding: 8, background: "#F9FAFB", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>Percentage</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600, color: grade.color }}>{pct.toFixed(1)}%</div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Teacher's Remarks</label>
        <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Optional remark…"
          style={{ width: "100%", minHeight: 54, border: "1px solid #D1D5DB", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontFamily: "'DM Sans',sans-serif", resize: "vertical", outline: "none" }} />
        <button onClick={() => saveRemark(remark)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, marginTop: 5, background: savedRemark ? "#E1F5EE" : "#EFF6FF", color: savedRemark ? "#0F6E56" : "#1D4ED8", border: "1px solid " + (savedRemark ? "#BBF7D0" : "#BFDBFE") }}>
          {savingRemark ? "Saving…" : savedRemark ? "✓ Saved" : "💾 Save Remark"}
        </button>
      </div>
      {(() => {
        const [printing, setPrinting] = React.useState(false)
        return <button onClick={() => { setPrinting(true); printReport(); setTimeout(() => setPrinting(false), 3000) }}
          disabled={printing}
          style={{ ...css.btn, background: printing ? '#6B7280' : '#1a3c2e', color:'white', width:'100%', opacity: printing ? 0.8 : 1 }}>
          {printing ? '⏳ Opening print window...' : '🖨️ Print Report Card'}
        </button>
      })()}
    </div>
  );
}

function ReportCards({ courseSubjects, examTypes, students, institute }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const examName = examTypes.find(e => e.id === examType)?.name || "Examination";
  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {courseStudents.map(st => (
          <ReportCardItem key={st.id} st={st} subjects={subjects} marks={marks} examType={examType} examDate={examDate} examName={examName} institute={institute} allStudents={courseStudents} course={course} />
        ))}
      </div>
    </div>
  );
}

// ─── SHARED: Report Card HTML Generator ──────────────────────────────────────
function buildReportCardHTML(st, subjects, marksMap, course, allStudents, examName, examDate, institute, remarkText) {
  const courseMax = getCourseMax(course);
  const getTotal = sid => subjects.reduce((s,sub)=>s+(Number(marksMap[`${sid}-${sub}`])||0),0);
  const total = getTotal(st.id);
  const pct = calcPct(total, course);
  const grade = getGrade(pct);
  const passed = pct >= 40;
  const gradeColors = {"A+":"#0F6E56","A":"#1B4F8A","B+":"#534AB7","B":"#2563eb","C":"#BA7517","D":"#ea580c","F":"#C0392B"};
  const gradeColor = gradeColors[grade.label]||"#0A1628";

  const sortedStudents = [...allStudents].map(s=>({...s,total:getTotal(s.id)})).sort((a,b)=>b.total-a.total);
  let rank=1,prev=null;
  for(let i=0;i<sortedStudents.length;i++){
    if(i===0){rank=1;prev=sortedStudents[i].total;}else if(sortedStudents[i].total!==prev){rank++;prev=sortedStudents[i].total;}
    if(sortedStudents[i].id===st.id)break;
  }
  const rankSuffix=rank===1?"st":rank===2?"nd":rank===3?"rd":"th";

  const subjectRows = subjects.map((s,idx)=>{
    const m=Number(marksMap[`${st.id}-${s}`])||0;
    const subMax=getSubjectMax(course,s);
    const subPct=Math.round((m/subMax)*100);
    const subPassed=subPct>=40;
    const barColor=subPct>=80?"#0F6E56":subPct>=60?"#1B4F8A":subPct>=40?"#BA7517":"#C0392B";
    const gradeLbl=subPct>=90?"A+":subPct>=80?"A":subPct>=70?"B+":subPct>=60?"B":subPct>=50?"C":subPct>=40?"D":"F";
    return `<tr>
      <td style="text-align:left;font-weight:600;color:#2D3748">${idx+1}. ${s}</td>
      <td>${subMax}</td>
      <td style="font-family:'EB Garamond',serif;font-size:14px;font-weight:700;color:#0A1628">${m}</td>
      <td>
        <div style="display:flex;align-items:center;gap:5px;">
          <div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;">
            <div style="width:${subPct}%;height:100%;background:${barColor};border-radius:3px;"></div>
          </div>
          <span style="font-size:10px;font-weight:700;color:${barColor};min-width:32px">${subPct}%</span>
        </div>
      </td>
      <td><span style="display:inline-block;padding:1px 8px;border-radius:2px;font-family:'Libre Baskerville',serif;font-size:11px;font-weight:700;color:${barColor};border:1px solid ${barColor};background:${barColor}18">${gradeLbl}</span></td>
      <td><span style="font-size:10px;font-weight:700;color:${subPassed?"#0F6E56":"#C0392B"}">${subPassed?"✓ PASS":"✗ FAIL"}</span></td>
    </tr>`;
  }).join("");

  const remarkBlock = remarkText
    ? `<div class="remark-box"><div class="remark-label">✦ Teacher's Remarks</div><div class="remark-text">"${remarkText}"</div></div>`
    : "";

  return `<div class="card">
    <div class="top-strip"></div>
    <div class="header">
      <div class="logo-ring">
        ${institute.logoUrl?`<img src="${institute.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%"/>`:`<div class="logo-text">GNSI</div>`}
      </div>
      <div class="header-center">
        <div class="eyebrow">Official Academic Record · ${institute.academicYear||"2025-2026"}</div>
        <div class="inst-name">${institute.name||"Guidance Navodaya & Sainik Institute"}</div>
        <div class="inst-addr">${institute.address||"Khangabok, Thoubal, Manipur − 795131"}</div>
      </div>
      <div class="doc-badge">
        <div class="doc-badge-title">REPORT<br/>CARD</div>
        <div class="doc-badge-sub">${examName}</div>
      </div>
    </div>

    <div class="exam-result-bar">
      <div class="exam-info">
        <div class="exam-info-item">
          <span class="exam-info-label">Examination</span>
          <span class="exam-info-value">${examName}</span>
        </div>
        <div class="exam-info-item">
          <span class="exam-info-label">Date</span>
          <span class="exam-info-value">${examDate||"—"}</span>
        </div>
        <div class="exam-info-item">
          <span class="exam-info-label">Academic Year</span>
          <span class="exam-info-value">${institute.academicYear||"2025-2026"}</span>
        </div>
        <div class="exam-info-item">
          <span class="exam-info-label">Class Rank</span>
          <span class="exam-info-value" style="color:${rank<=3?"#f0c040":"white"}">${rank}<sup style="font-size:10px">${rankSuffix}</sup> / ${allStudents.length}</span>
        </div>
      </div>
      <div class="result-pill-bar">
        <span style="font-family:'Libre Baskerville',serif;font-size:20px;font-weight:700;color:${gradeColor}">${grade.label}</span>
        <span style="font-size:9px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:2px;background:${passed?"#E1F5EE":"#FCEBEB"};color:${passed?"#0F6E56":"#C0392B"};border:1px solid ${passed?"#BBF7D0":"#FECACA"}">${passed?"PASS":"FAIL"}</span>
      </div>
    </div>

    <div class="student-section">
      <div class="section-title">Candidate Details</div>
      <table class="student-table">
        <tr>
          <td class="lbl">Student Name</td>
          <td class="val big" colspan="3">${st.name}</td>
        </tr>
        <tr>
          <td class="lbl">GCC / Roll No.</td>
          <td class="val big" style="letter-spacing:3px">${String(st.gcc_no||"").padStart(6,"0")}</td>
          <td class="lbl">Admission No.</td>
          <td class="val">${st.admission_no||"—"}</td>
        </tr>
        <tr>
          <td class="lbl">Course</td>
          <td class="val">${st.course||course}</td>
          <td class="lbl">Batch</td>
          <td class="val">${st.class_name||"—"}</td>
        </tr>
      </table>
    </div>

    <div class="score-grid" style="margin:0 16px;">
      <div class="score-cell">
        <div class="score-lbl">Marks Obtained</div>
        <div class="score-val">${total}<span style="font-size:11px;opacity:.5">/${courseMax}</span></div>
      </div>
      <div class="score-cell">
        <div class="score-lbl">Percentage</div>
        <div class="score-val gold">${pct.toFixed(1)}%</div>
      </div>
      <div class="score-cell">
        <div class="score-lbl">Grade</div>
        <div class="score-val" style="color:${gradeColor}">${grade.label}</div>
        <div class="score-sub">${grade.gpa.toFixed(1)} GPA</div>
      </div>
      <div class="score-cell">
        <div class="score-lbl">Subjects</div>
        <div class="score-val">${subjects.length}</div>
      </div>
      <div class="score-cell">
        <div class="score-lbl">Class Rank</div>
        <div class="score-val" style="color:${rank<=3?"#f0c040":"white"}">${rank}<sup style="font-size:11px">${rankSuffix}</sup></div>
        <div class="score-sub">of ${allStudents.length}</div>
      </div>
    </div>

    <div class="marks-section">
      <div class="section-title" style="margin-top:8px">Subject-wise Performance</div>
      <table class="marks-table">
        <thead>
          <tr>
            <th style="text-align:left;width:32%">Subject</th>
            <th>Max Marks</th>
            <th>Marks Obtained</th>
            <th style="width:25%">Performance</th>
            <th>Grade</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>${subjectRows}</tbody>
        <tfoot>
          <tr>
            <td style="text-align:left;font-family:'Libre Baskerville',serif;color:#0A1628;font-size:12px">Grand Total</td>
            <td>${courseMax}</td>
            <td style="font-family:'EB Garamond',serif;font-size:16px;font-weight:700;color:#0A1628">${total}</td>
            <td>
              <div style="display:flex;align-items:center;gap:5px;">
                <div style="flex:1;height:7px;background:#E2E8F0;border-radius:3px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:${gradeColor};border-radius:3px;"></div>
                </div>
                <span style="font-size:11px;font-weight:700;color:${gradeColor}">${pct.toFixed(1)}%</span>
              </div>
            </td>
            <td><span style="display:inline-block;padding:2px 9px;border-radius:2px;font-family:'Libre Baskerville',serif;font-size:12px;font-weight:700;color:${gradeColor};border:1px solid ${gradeColor};background:${gradeColor}18">${grade.label}</span></td>
            <td><span style="font-size:11px;font-weight:700;color:${passed?"#0F6E56":"#C0392B"}">${passed?"✓ PASS":"✗ FAIL"}</span></td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${remarkBlock}

    <div class="sig-section">
      <div class="sig-block">
        <div class="sig-space"></div>
        <div class="sig-label">Student's Signature</div>
      </div>
      <div class="seal-block">
        <div class="seal">
          <div class="seal-word">Official</div>
          <div class="seal-star">★</div>
          <div class="seal-word">Seal</div>
        </div>
      </div>
      <div class="sig-block">
        <div class="sig-space"></div>
        <div class="sig-label">Class Teacher</div>
      </div>
      <div class="sig-block">
        <div class="sig-space"></div>
        <div class="sig-label">Head of Institute</div>
      </div>
    </div>

    <div class="footer-strip">
      <div class="footer-text">${institute.name||"GNSI"} · ${institute.address||"Khangabok, Manipur"} · ${examName} · Academic Year ${institute.academicYear||"2025-2026"}</div>
    </div>
    <div class="bottom-strip"></div>
  </div>`;
}

// ─── BULK REPORTS TAB ─────────────────────────────────────────────────────────
function BulkReports({ courseSubjects, examTypes, students, institute, schedule }) {
  const courses = Object.keys(courseSubjects);

  // ── Shared settings ──
  const [activeSection, setActiveSection] = useState("reportcard"); // "reportcard" | "admitcard"

  // ── Report Card settings ──
  const [rcCourse, setRcCourse]       = useState(courses[0] || "");
  const [rcExamType, setRcExamType]   = useState(examTypes[0]?.id || "");
  const [rcExamDate, setRcExamDate]   = useState("");
  const [rcDates, setRcDates]         = useState([]);
  const [rcMarks, setRcMarks]         = useState({});
  const [rcRemarks, setRcRemarks]     = useState({});
  const [rcLoading, setRcLoading]     = useState(false);
  const [rcProgress, setRcProgress]   = useState(null); // null | { current, total }
  const [rcFilter, setRcFilter]       = useState("all"); // "all" | "pass" | "fail" | "topN"
  const [rcTopN, setRcTopN]           = useState(10);
  const [rcSearch, setRcSearch]       = useState("");
  const [rcSortBy, setRcSortBy]       = useState("name"); // "name" | "rank" | "gcc"
  const [rcIncludeRemarks, setRcIncludeRemarks] = useState(true);
  const [rcPageBreak, setRcPageBreak] = useState(true);

  // ── Admit Card settings ──
  const [acCourse, setAcCourse]       = useState(courses[0] || "");
  const [acExamType, setAcExamType]   = useState(examTypes[0]?.id || "");
  const [acSearch, setAcSearch]       = useState("");
  const [acFilter, setAcFilter]       = useState("all");
  const [acSortBy, setAcSortBy]       = useState("name");
  const [acProgress, setAcProgress]   = useState(null);

  const rcSubjects = courseSubjects[rcCourse] || [];
  const rcStudents = students.filter(s =>
    (s.class_name||"").toUpperCase()===rcCourse||(s.course||"").toUpperCase()===rcCourse
  );
  const acStudents = students.filter(s =>
    (s.class_name||"").toUpperCase()===acCourse||(s.course||"").toUpperCase()===acCourse
  );
  const acSchedule = schedule.filter(s =>
    s.exam_type_id === acExamType &&
    (!s.course || s.course.toUpperCase() === acCourse.toUpperCase())
  );
  const acExamName = examTypes.find(e=>e.id===acExamType)?.name||"Examination";

  // Load dates for report card
  useEffect(() => {
    if (!rcExamType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", rcExamType).then(({ data }) => {
      const unique = [...new Set((data||[]).map(r=>r.exam_date))].sort().reverse();
      setRcDates(unique); if (unique.length) setRcExamDate(unique[0]);
    });
  }, [rcExamType]);

  // Load marks for report card
  useEffect(() => {
    if (!rcExamType || !rcExamDate) return;
    setRcLoading(true);
    const ids = rcStudents.map(s=>s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", rcExamType).eq("exam_date", rcExamDate).in("student_id", ids.length?ids:["__none__"]).then(({ data }) => {
      const map = {}; (data||[]).forEach(r=>{ map[`${r.student_id}-${r.subject}`]=r.marks; });
      setRcMarks(map); setRcLoading(false);
    });
  }, [rcExamType, rcExamDate, rcCourse]);

  // Load all remarks for report card bulk
  useEffect(() => {
    if (!rcExamType || !rcExamDate || !rcStudents.length) return;
    const ids = rcStudents.map(s=>s.id);
    supabase.from("exam_remarks").select("*").eq("exam_type_id", rcExamType).eq("exam_date", rcExamDate).in("student_id", ids).then(({ data }) => {
      const map = {}; (data||[]).forEach(r=>{ map[r.student_id]=r.remark; });
      setRcRemarks(map);
    });
  }, [rcExamType, rcExamDate, rcCourse]);

  const getTotal = (sid) => rcSubjects.reduce((s,sub)=>s+(Number(rcMarks[`${sid}-${sub}`])||0),0);
  const getPct   = (sid) => calcPct(getTotal(sid), rcCourse);

  // Sort + filter RC students
  const sortedRcStudents = [...rcStudents].sort((a,b)=>{
    if (rcSortBy==="rank") return getTotal(b.id)-getTotal(a.id);
    if (rcSortBy==="gcc")  return Number(a.gcc_no)-Number(b.gcc_no);
    return a.name.localeCompare(b.name);
  });
  const filteredRcStudents = sortedRcStudents.filter(s=>{
    const pct = getPct(s.id);
    const search = !rcSearch || s.name.toLowerCase().includes(rcSearch.toLowerCase()) || String(s.gcc_no).includes(rcSearch);
    if (!search) return false;
    if (rcFilter==="pass") return pct>=40;
    if (rcFilter==="fail") return pct<40;
    return true;
  }).slice(0, rcFilter==="topN" ? rcTopN : undefined);

  // Sort + filter AC students
  const sortedAcStudents = [...acStudents].sort((a,b)=>{
    if (acSortBy==="gcc") return Number(a.gcc_no)-Number(b.gcc_no);
    return a.name.localeCompare(b.name);
  });
  const filteredAcStudents = sortedAcStudents.filter(s=>
    !acSearch || s.name.toLowerCase().includes(acSearch.toLowerCase()) || String(s.gcc_no).includes(acSearch)
  );

  // ── Print all report cards ──
  const printAllReportCards = async () => {
    if (!filteredRcStudents.length) return;

    // ✅ Open window FIRST — must be synchronous at point of user click
    const w = window.open("", "_blank");
    if (!w) {
      alert("⚠️ Popup blocked!\n\nPlease allow popups for this site:\n• Chrome: click the blocked popup icon in the address bar\n• Safari: go to Settings → Websites → Popup Windows → Allow\n• Edge: click the popup blocked notification");
      return;
    }

    // Write a loading screen immediately so the window isn't blank
    w.document.write(`<!DOCTYPE html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet"/>
      <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;background:#1a3c2e;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style>
    </head><body>
      <div style="text-align:center;color:white;padding:40px;">
        <div style="font-family:'Playfair Display',serif;font-size:28px;margin-bottom:16px;">⏳ Preparing Report Cards</div>
        <div style="font-size:14px;opacity:0.7;">Please wait while cards are generated…</div>
      </div>
    </body></html>`);

    setRcProgress({ current: 0, total: filteredRcStudents.length });

    // Log print (non-blocking)
    try {
      await supabase.from('exam_print_log').insert({
        doc_type: 'report_card',
        course: rcCourse,
        exam_type: examTypes.find(e => e.id === rcExamType)?.name || '',
        student_count: filteredRcStudents.length
      });
    } catch(_) {}

    const cards = [];
    for (let i = 0; i < filteredRcStudents.length; i++) {
      const st = filteredRcStudents[i];
      const remark = rcIncludeRemarks ? (rcRemarks[st.id] || "") : "";
      cards.push(buildReportCardHTML(
        st, rcSubjects, rcMarks, rcCourse, rcStudents,
        examTypes.find(e => e.id === rcExamType)?.name || "Examination",
        rcExamDate, institute, remark
      ));
      setRcProgress({ current: i + 1, total: filteredRcStudents.length });
      await new Promise(r => setTimeout(r, 0));
    }

    const sep = rcPageBreak
      ? '<div class="page-break"></div>'
      : '<div style="margin-bottom:24px"></div>';

    // Now write final content into the already-open window
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Bulk Report Cards — ${rcCourse} — ${examTypes.find(e => e.id === rcExamType)?.name || ""}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>${REPORT_CARD_CSS}</style>
    </head><body>
      <div class="no-print">
        <button class="btn-print" onclick="this.textContent='⏳ Loading...';this.disabled=true;document.fonts.ready.then(()=>{setTimeout(()=>{window.print();this.disabled=false;this.textContent='🖨️ Print All (${cards.length}) Report Cards';},400);});">🖨️ Print All (${cards.length}) Report Cards</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
      ${cards.join(sep)}
    </body></html>`);
    w.document.close();
    setRcProgress(null);
  };

  // ── Admit card builder (shared NTA template) ──
const buildAdmitCardHTML = (st) =>
  generateAdmitCardHTML(st, { examTypeName: acExamName, examSchedule: acSchedule, institute, course: acCourse });

  const printAllAdmitCards = async () => {
    if (!filteredAcStudents.length) return;

    // ✅ Open window FIRST — must be synchronous at point of user click
    const w = window.open("", "_blank");
    if (!w) {
      alert("⚠️ Popup blocked!\n\nPlease allow popups for this site:\n• Chrome: click the blocked popup icon in the address bar\n• Safari: go to Settings → Websites → Popup Windows → Allow\n• Edge: click the popup blocked notification");
      return;
    }

    // Write a loading screen immediately
    w.document.write(`<!DOCTYPE html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet"/>
      <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;background:#1a3c2e;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style>
    </head><body>
      <div style="text-align:center;color:white;padding:40px;">
        <div style="font-family:'Playfair Display',serif;font-size:28px;margin-bottom:16px;">⏳ Preparing Admit Cards</div>
        <div style="font-size:14px;opacity:0.7;">Please wait while cards are generated…</div>
      </div>
    </body></html>`);

    setAcProgress({ current: 0, total: filteredAcStudents.length });

    // Log print (non-blocking)
    try {
      await supabase.from('exam_print_log').insert({
        doc_type: 'admit_card',
        course: acCourse,
        exam_type: acExamName,
        student_count: filteredAcStudents.length
      });
    } catch(_) {}

    const cards = [];
    for (let i = 0; i < filteredAcStudents.length; i++) {
      cards.push(buildAdmitCardHTML(filteredAcStudents[i]));
      setAcProgress({ current: i + 1, total: filteredAcStudents.length });
      await new Promise(r => setTimeout(r, 0));
    }

    // Write final content into the already-open window
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Bulk Admit Cards — ${acCourse} — ${acExamName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:wght@400;500;600&display=swap" rel="stylesheet"/>
      <style>${ADMIT_CARD_CSS}</style>
    </head><body>
      <div class="no-print">
        <button class="btn-print" onclick="
  this.textContent='⏳ Loading fonts...';
  this.disabled=true;
  document.fonts.ready.then(()=>{
    setTimeout(()=>{ window.print(); this.disabled=false; this.textContent='🖨️ Print All (${cards.length}) Admit Cards'; }, 400);
  });
">🖨️ Print All (${cards.length}) Admit Cards</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
      ${cards.join('<div class="page-break"></div>')}
    </body></html>`);
    w.document.close();
    setAcProgress(null);
  };

  // ── UI helpers ──
  const SectionBtn = ({ id, icon, label, count }) => (
    <button onClick={() => setActiveSection(id)}
      style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 24px", borderRadius:10, border: activeSection===id ? "2px solid #1a3c2e" : "2px solid #E5E7EB", background: activeSection===id ? "#1a3c2e" : "white", color: activeSection===id ? "white" : "#374151", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, flex:1, transition:"all .15s" }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <div style={{ textAlign:"left" }}>
        <div>{label}</div>
        <div style={{ fontSize:11, fontWeight:400, opacity:0.7 }}>{count} students ready</div>
      </div>
    </button>
  );

  const StatPill = ({ label, value, color }) => (
    <div style={{ background:"white", borderRadius:8, padding:"10px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", borderLeft:`3px solid ${color||"#1a3c2e"}` }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:".08em", marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600, color:color||"#1a3c2e" }}>{value}</div>
    </div>
  );

  return (
    <div>
      {/* Section selector */}
      <div style={{ display:"flex", gap:12, marginBottom:24 }}>
        <SectionBtn id="reportcard" icon="📋" label="Bulk Report Cards" count={rcStudents.length} />
        <SectionBtn id="admitcard" icon="🪪" label="Bulk Admit Cards"  count={acStudents.length} />
      </div>

      {/* ════ REPORT CARDS SECTION ════ */}
      {activeSection === "reportcard" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:20 }}>
            {/* Settings panel */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13 }}>⚙️ Report Card Settings</div>
                <div style={{ padding:18, display:"flex", flexDirection:"column", gap:14 }}>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Batch / Course</label>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {courses.map(c => (
                        <button key={c} onClick={()=>setRcCourse(c)}
                          style={{ ...css.btn, padding:"4px 12px", fontSize:11, background:rcCourse===c?"#1a3c2e":"#F3F4F6", color:rcCourse===c?"white":"#374151", border:rcCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
                    <select value={rcExamType} onChange={e=>setRcExamType(e.target.value)} style={css.input}>
                      {examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Date</label>
                    <select value={rcExamDate} onChange={e=>setRcExamDate(e.target.value)} style={css.input}>
                      {rcDates.map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div style={{ height:1, background:"#F1F5F9" }} />

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Filter Students</label>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {[["all","All Students"],["pass","Passed Only"],["fail","Failed Only"],["topN","Top N Students"]].map(([val,lbl])=>(
                        <label key={val} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}>
                          <input type="radio" checked={rcFilter===val} onChange={()=>setRcFilter(val)} />
                          {lbl}
                        </label>
                      ))}
                      {rcFilter==="topN" && (
                        <input type="number" value={rcTopN} onChange={e=>setRcTopN(Number(e.target.value))} min={1} max={rcStudents.length}
                          style={{ ...css.input, width:80, marginLeft:22, marginTop:4 }} />
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Sort By</label>
                    <select value={rcSortBy} onChange={e=>setRcSortBy(e.target.value)} style={css.input}>
                      <option value="name">Name (A–Z)</option>
                      <option value="rank">Rank (Highest first)</option>
                      <option value="gcc">GCC Number</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Search</label>
                    <input placeholder="Name or GCC…" value={rcSearch} onChange={e=>setRcSearch(e.target.value)} style={css.input} />
                  </div>

                  <div style={{ height:1, background:"#F1F5F9" }} />

                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}>
                      <input type="checkbox" checked={rcIncludeRemarks} onChange={e=>setRcIncludeRemarks(e.target.checked)} />
                      Include teacher remarks
                    </label>
                    <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}>
                      <input type="checkbox" checked={rcPageBreak} onChange={e=>setRcPageBreak(e.target.checked)} />
                      Page break between cards
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview + print */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Stats */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                <StatPill label="Total Students"  value={rcStudents.length}          color="#1a3c2e" />
                <StatPill label="Will Print"      value={filteredRcStudents.length}  color="#185FA5" />
                <StatPill label="Passed"          value={rcStudents.filter(s=>getPct(s.id)>=40).length} color="#0F6E56" />
                <StatPill label="Failed"          value={rcStudents.filter(s=>getPct(s.id)<40 && getTotal(s.id)>0).length} color="#A32D2D" />
              </div>

              {/* Print button */}
              <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:20 }}>
                {rcProgress ? (
                  <div style={{ textAlign:"center", padding:"20px 0" }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"#1a3c2e", marginBottom:12 }}>⏳ Generating {rcProgress.current}/{rcProgress.total} cards…</div>
                    <div style={{ height:8, background:"#F1F5F9", borderRadius:999, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(rcProgress.current/rcProgress.total)*100}%`, background:"#1a3c2e", borderRadius:999, transition:"width .2s" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
                    <div>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, color:"#1e293b", marginBottom:4 }}>
                        Ready to print {filteredRcStudents.length} report cards
                      </div>
                      <div style={{ fontSize:12, color:"#9CA3AF" }}>
                        {rcCourse} · {examTypes.find(e=>e.id===rcExamType)?.name} · {rcExamDate} · sorted by {rcSortBy}
                      </div>
                    </div>
                    <button onClick={printAllReportCards} disabled={!filteredRcStudents.length || rcLoading}
                      style={{ ...css.btn, background:"#1a3c2e", color:"white", padding:"12px 28px", fontSize:14, whiteSpace:"nowrap" }}>
                      🖨️ Print All {filteredRcStudents.length} Cards
                    </button>
                  </div>
                )}
              </div>

              {/* Student preview table */}
              <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13, display:"flex", justifyContent:"space-between" }}>
                  <span>📋 Students in Print Queue</span>
                  <span style={{ opacity:0.7, fontSize:12 }}>{filteredRcStudents.length} cards</span>
                </div>
                <div style={{ maxHeight:360, overflowY:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead style={{ position:"sticky", top:0 }}>
                      <tr style={{ background:"#F8FAFC", borderBottom:"2px solid #E5E7EB" }}>
                        {["#","GCC No.","Student Name","Total","% Score","Grade"].map(h=>(
                          <th key={h} style={{ padding:"9px 12px", textAlign:h==="Student Name"?"left":"center", fontWeight:700, color:"#374151", fontSize:11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRcStudents.map((st,i)=>{
                        const total = getTotal(st.id);
                        const pct = getPct(st.id);
                        const g = getGrade(pct);
                        return (
                          <tr key={st.id} style={{ background:i%2?"#F9FAFB":"white", borderBottom:"1px solid #F1F5F9" }}>
                            <td style={{ padding:"8px 12px", textAlign:"center", color:"#9CA3AF", fontSize:12 }}>{i+1}</td>
                            <td style={{ padding:"8px 12px", textAlign:"center", fontWeight:700, color:"#1a3c2e" }}>{st.gcc_no}</td>
                            <td style={{ padding:"8px 12px", fontWeight:600, color:"#1e293b" }}>{st.name}</td>
                            <td style={{ padding:"8px 12px", textAlign:"center", fontWeight:700 }}>{total}/{getCourseMax(rcCourse)}</td>
                            <td style={{ padding:"8px 12px", textAlign:"center", fontWeight:700, color:g.color }}>{pct.toFixed(1)}%</td>
                            <td style={{ padding:"8px 12px", textAlign:"center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
                          </tr>
                        );
                      })}
                      {!filteredRcStudents.length && <tr><td colSpan={6} style={{ padding:32, textAlign:"center", color:"#94A3B8" }}>No students match the current filter.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ ADMIT CARDS SECTION ════ */}
      {activeSection === "admitcard" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:20 }}>
            {/* Settings panel */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13 }}>⚙️ Admit Card Settings</div>
                <div style={{ padding:18, display:"flex", flexDirection:"column", gap:14 }}>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Batch / Course</label>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {courses.map(c=>(
                        <button key={c} onClick={()=>setAcCourse(c)}
                          style={{ ...css.btn, padding:"4px 12px", fontSize:11, background:acCourse===c?"#1a3c2e":"#F3F4F6", color:acCourse===c?"white":"#374151", border:acCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
                    <select value={acExamType} onChange={e=>setAcExamType(e.target.value)} style={css.input}>
                      {examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Sort By</label>
                    <select value={acSortBy} onChange={e=>setAcSortBy(e.target.value)} style={css.input}>
                      <option value="name">Name (A–Z)</option>
                      <option value="gcc">GCC Number</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Search</label>
                    <input placeholder="Name or GCC…" value={acSearch} onChange={e=>setAcSearch(e.target.value)} style={css.input} />
                  </div>

                  {/* Schedule status */}
                  <div style={{ background: acSchedule.length?"#E1F5EE":"#FFFBEB", border:`1px solid ${acSchedule.length?"#BBF7D0":"#FDE68A"}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:acSchedule.length?"#0F6E56":"#92400E" }}>
                    {acSchedule.length ? `✅ ${acSchedule.length} schedule entries found` : "⚠️ No schedule entries. Add in Schedule tab."}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview + print */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Stats */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                <StatPill label="Total Students"  value={acStudents.length}          color="#1a3c2e" />
                <StatPill label="Will Print"      value={filteredAcStudents.length}  color="#185FA5" />
                <StatPill label="Schedule Items"  value={acSchedule.length}          color="#7c3aed" />
              </div>

              {/* Print button */}
              <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:20 }}>
                {acProgress ? (
                  <div style={{ textAlign:"center", padding:"20px 0" }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"#1a3c2e", marginBottom:12 }}>⏳ Generating {acProgress.current}/{acProgress.total} cards…</div>
                    <div style={{ height:8, background:"#F1F5F9", borderRadius:999, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(acProgress.current/acProgress.total)*100}%`, background:"#1a3c2e", borderRadius:999, transition:"width .2s" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
                    <div>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, color:"#1e293b", marginBottom:4 }}>
                        Ready to print {filteredAcStudents.length} admit cards
                      </div>
                      <div style={{ fontSize:12, color:"#9CA3AF" }}>
                        {acCourse} · {acExamName} · sorted by {acSortBy}
                      </div>
                    </div>
                    <button onClick={printAllAdmitCards} disabled={!filteredAcStudents.length}
                      style={{ ...css.btn, background:"#1a3c2e", color:"white", padding:"12px 28px", fontSize:14, whiteSpace:"nowrap" }}>
                      🖨️ Print All {filteredAcStudents.length} Cards
                    </button>
                  </div>
                )}
              </div>

              {/* Student preview table */}
              <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13, display:"flex", justifyContent:"space-between" }}>
                  <span>🪪 Students in Print Queue</span>
                  <span style={{ opacity:0.7, fontSize:12 }}>{filteredAcStudents.length} cards</span>
                </div>
                <div style={{ maxHeight:360, overflowY:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead style={{ position:"sticky", top:0 }}>
                      <tr style={{ background:"#F8FAFC", borderBottom:"2px solid #E5E7EB" }}>
                        {["#","GCC No.","Student Name","Batch","Admission No."].map(h=>(
                          <th key={h} style={{ padding:"9px 12px", textAlign:h==="Student Name"?"left":"center", fontWeight:700, color:"#374151", fontSize:11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAcStudents.map((st,i)=>(
                        <tr key={st.id} style={{ background:i%2?"#F9FAFB":"white", borderBottom:"1px solid #F1F5F9" }}>
                          <td style={{ padding:"8px 12px", textAlign:"center", color:"#9CA3AF", fontSize:12 }}>{i+1}</td>
                          <td style={{ padding:"8px 12px", textAlign:"center", fontWeight:700, color:"#1a3c2e" }}>{st.gcc_no}</td>
                          <td style={{ padding:"8px 12px", fontWeight:600, color:"#1e293b" }}>{st.name}</td>
                          <td style={{ padding:"8px 12px", textAlign:"center" }}><span style={{ background:"#E0F2FE", color:"#0369A1", padding:"2px 10px", borderRadius:999, fontSize:11, fontWeight:700 }}>{st.class_name||"—"}</span></td>
                          <td style={{ padding:"8px 12px", textAlign:"center", color:"#94A3B8", fontSize:12 }}>{st.admission_no||"—"}</td>
                        </tr>
                      ))}
                      {!filteredAcStudents.length && <tr><td colSpan={5} style={{ padding:32, textAlign:"center", color:"#94A3B8" }}>No students found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROGRESS TAB ─────────────────────────────────────────────────────────────
function ProgressTab({ courseSubjects, examTypes, students }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [search, setSearch] = useState("");
  const [allMarks, setAllMarks] = useState([]);
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort();
      setDates(unique);
    });
  }, [examType]);

  useEffect(() => {
    if (!selectedStudent || !examType || !dates.length) return;
    setLoading(true);
    supabase.from("exam_marks").select("*").eq("student_id", selectedStudent.id).eq("exam_type_id", examType).then(({ data }) => {
      setAllMarks(data || []); setLoading(false);
    });
  }, [selectedStudent, examType, dates]);

  useEffect(() => {
    if (!chartRef.current || !selectedStudent || !dates.length) return;
    ensureLibs().then(() => {
      const Chart = window.Chart; if (!Chart) return;
      if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} }
      const colors = ["#2A5C45","#185FA5","#7c3aed","#d97706","#0891b2","#e11d48","#84cc16"];
      const datasets = subjects.map((sub, i) => ({
        label: sub,
        data: dates.map(d => { const m = allMarks.find(r => r.subject === sub && r.exam_date === d); return m ? m.marks : null; }),
        borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length] + "22",
        tension: 0.4, fill: false, pointRadius: 5, pointHoverRadius: 7, spanGaps: true,
      }));
      const totalsData = dates.map(d => {
        const dm = allMarks.filter(r => r.exam_date === d);
        return dm.length ? dm.reduce((s, r) => s + (r.marks || 0), 0) : null;
      });
      datasets.push({ label: "Total", data: totalsData, borderColor: "#1a3c2e", backgroundColor: "#1a3c2e22", tension: 0.4, fill: true, borderWidth: 3, pointRadius: 6, pointHoverRadius: 8, spanGaps: true, yAxisID: "y2" });
      chartInstance.current = new Chart(chartRef.current, {
        type: "line", data: { labels: dates, datasets },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: { x: { grid: { color: "#F1F5F9" } }, y: { beginAtZero: true, grid: { color: "#F1F5F9" }, title: { display: true, text: "Subject Marks" } }, y2: { beginAtZero: true, position: "right", max: courseMax, grid: { display: false }, title: { display: true, text: `Total /${courseMax}` } } } },
      });
    });
    return () => { if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} } };
  }, [allMarks, dates, selectedStudent]);

  const filteredStudents = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search));
  const dateSummary = dates.map(d => {
    const dm = allMarks.filter(r => r.exam_date === d);
    const total = dm.reduce((s, r) => s + (r.marks || 0), 0);
    const pct = dm.length ? calcPct(total, course) : null;
    return { date: d, total, pct, grade: pct !== null ? getGrade(pct) : null };
  });

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setSelectedStudent(null); setAllMarks([]); }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => { setExamType(e.target.value); setAllMarks([]); }} style={{ ...css.input, width: 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>👤 Select Student</div>
          <div style={{ padding: 12 }}><input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, marginBottom: 10, fontSize: 12 }} /></div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {filteredStudents.map(st => (
              <div key={st.id} onClick={() => setSelectedStudent(st)}
                style={{ padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", background: selectedStudent?.id === st.id ? "#E1F5EE" : "white" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: selectedStudent?.id === st.id ? "#0F6E56" : "#1e293b" }}>{st.name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>GCC {st.gcc_no} · {st.class_name}</div>
              </div>
            ))}
            {!filteredStudents.length && <div style={{ padding: 20, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No students found.</div>}
          </div>
        </div>
        <div>
          {!selectedStudent ? (
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 60, textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Select a student to view their progress</div>
            </div>
          ) : loading ? <Spinner /> : (
            <>
              <div style={{ background: "linear-gradient(135deg,#1a3c2e,#2A5C45)", borderRadius: 12, padding: "18px 24px", marginBottom: 16, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>{selectedStudent.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>GCC {selectedStudent.gcc_no} · {selectedStudent.class_name} · {course}</div>
                </div>
                {dateSummary.filter(d => d.pct !== null).slice(-1).map(d => (
                  <div key={d.date} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 600 }}>{d.pct?.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>Latest</div>
                  </div>
                ))}
              </div>
              {dates.length > 0 ? (
                <div style={{ ...css.card, marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 15, marginBottom: 14 }}>📈 Performance Trend</div>
                  <div style={{ height: 320 }}><canvas ref={chartRef} /></div>
                </div>
              ) : <div style={{ ...css.card, textAlign: "center", color: "#94A3B8", padding: 40 }}>No exam data found.</div>}
              {dateSummary.some(d => d.pct !== null) && (
                <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📋 Exam-wise Summary</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 12 }}>Date</th>
                      {subjects.map(s => <th key={s} style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 11, whiteSpace: "nowrap" }}>{s}</th>)}
                      <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 12 }}>Total</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 12 }}>%</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 12 }}>Grade</th>
                    </tr></thead>
                    <tbody>
                      {dateSummary.map((d, i) => (
                        <tr key={d.date} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "9px 16px", fontWeight: 600 }}>{d.date}</td>
                          {subjects.map(sub => { const m = allMarks.find(r => r.subject === sub && r.exam_date === d.date); return <td key={sub} style={{ padding: "9px 8px", textAlign: "center", color: m ? "#1e293b" : "#CBD5E1" }}>{m ? m.marks : "--"}</td>; })}
                          <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 800 }}>{d.pct !== null ? `${d.total}/${courseMax}` : "--"}</td>
                          <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, color: d.grade?.color || "#94A3B8" }}>{d.pct !== null ? `${d.pct.toFixed(1)}%` : "--"}</td>
                          <td style={{ padding: "9px 12px", textAlign: "center" }}>{d.grade ? <Badge label={d.grade.label} color={d.grade.color} bg={d.grade.bg} /> : "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── COMPARE TAB ──────────────────────────────────────────────────────────────
function CompareTab({ courseSubjects, examTypes, students }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [dates, setDates] = useState([]);
  const [marks, setMarks] = useState({});
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const COMPARE_COLORS = ["#2A5C45","#185FA5","#7c3aed","#d97706"];

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const toggleStudent = st => {
    if (selected.find(s => s.id === st.id)) setSelected(p => p.filter(s => s.id !== st.id));
    else if (selected.length < 4) setSelected(p => [...p, st]);
  };

  useEffect(() => {
    if (!chartRef.current || selected.length < 2) return;
    ensureLibs().then(() => {
      const Chart = window.Chart; if (!Chart) return;
      if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} }
      chartInstance.current = new Chart(chartRef.current, {
        type: "radar",
        data: { labels: subjects, datasets: selected.map((st, i) => ({ label: st.name.split(" ")[0], data: subjects.map(sub => Number(marks[`${st.id}-${sub}`]) || 0), borderColor: COMPARE_COLORS[i], backgroundColor: COMPARE_COLORS[i] + "33", borderWidth: 2, pointRadius: 4 })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { r: { beginAtZero: true } } },
      });
    });
    return () => { if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} } };
  }, [selected, marks]);

  const filteredStudents = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search));

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setSelected([]); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>Select 2–4 students</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>Select Students ({selected.length}/4)</div>
          <div style={{ padding: 12 }}><input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, marginBottom: 10, fontSize: 12 }} /></div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {filteredStudents.map(st => {
              const idx = selected.findIndex(s => s.id === st.id); const isSel = idx !== -1;
              return (
                <div key={st.id} onClick={() => toggleStudent(st)}
                  style={{ padding: "9px 16px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", background: isSel ? COMPARE_COLORS[idx] + "18" : "white", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: isSel ? COMPARE_COLORS[idx] : "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: isSel ? "white" : "#9CA3AF", flexShrink: 0 }}>{isSel ? idx + 1 : ""}</div>
                  <div><div style={{ fontWeight: 600, fontSize: 12, color: isSel ? COMPARE_COLORS[idx] : "#1e293b" }}>{st.name}</div><div style={{ fontSize: 10, color: "#9CA3AF" }}>GCC {st.gcc_no}</div></div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          {selected.length < 2 ? (
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 60, textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚖️</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Select at least 2 students to compare</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${selected.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
                {selected.map((st, i) => { const total = getTotal(st.id); const pct = calcPct(total, course); const g = getGrade(pct);
                  return (
                    <div key={st.id} style={{ background: "white", borderRadius: 12, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderTop: `4px solid ${COMPARE_COLORS[i]}`, position: "relative" }}>
                      <div style={{ position: "absolute", top: 10, right: 12, width: 24, height: 24, borderRadius: "50%", background: COMPARE_COLORS[i], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white" }}>{i + 1}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", marginBottom: 2, paddingRight: 28 }}>{st.name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>GCC {st.gcc_no}</div>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 600, color: COMPARE_COLORS[i] }}>{pct.toFixed(1)}%</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{total}/{courseMax}</div>
                      <div style={{ marginTop: 8 }}><Badge label={g.label} color={g.color} bg={g.bg} /></div>
                    </div>
                  );
                })}
              </div>
              <div style={{ ...css.card, marginBottom: 16 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 15, marginBottom: 14 }}>🕸️ Subject Radar</div>
                <div style={{ height: 320 }}><canvas ref={chartRef} /></div>
              </div>
              <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📊 Subject Breakdown</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 12 }}>Subject</th>
                    <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 11 }}>Max</th>
                    {selected.map((st, i) => <th key={st.id} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: COMPARE_COLORS[i], fontSize: 12 }}>{st.name.split(" ")[0]}</th>)}
                  </tr></thead>
                  <tbody>
                    {subjects.map((sub, ri) => {
                      const subMarks = selected.map(st => Number(marks[`${st.id}-${sub}`]) || 0);
                      const maxMark = Math.max(...subMarks);
                      return (
                        <tr key={sub} style={{ background: ri % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "9px 16px", fontWeight: 600 }}>{sub}</td>
                          <td style={{ padding: "9px 10px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>{getSubjectMax(course, sub)}</td>
                          {selected.map((st, i) => { const m = Number(marks[`${st.id}-${sub}`]) || 0; const isTop = m === maxMark && m > 0;
                            return <td key={st.id} style={{ padding: "9px 12px", textAlign: "center", fontWeight: isTop ? 800 : 500, color: isTop ? COMPARE_COLORS[i] : "#374151" }}>{m}{isTop ? " 🏆" : ""}</td>; })}
                        </tr>
                      );
                    })}
                    <tr style={{ background: "#F0FDF4", borderTop: "2px solid #BBF7D0" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 800, color: "#1a3c2e" }}>TOTAL</td>
                      <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "#94A3B8" }}>{courseMax}</td>
                      {selected.map((st, i) => { const total = getTotal(st.id); const pct = calcPct(total, course); const maxTotal = Math.max(...selected.map(s => getTotal(s.id))); const isTop = total === maxTotal;
                        return <td key={st.id} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: isTop ? COMPARE_COLORS[i] : "#374151" }}>{total} <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>({pct.toFixed(1)}%)</span>{isTop ? " 🏆" : ""}</td>; })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIT CARDS TAB ──────────────────────────────────────────────────────────
function AdmitCardsTab({ courseSubjects, examTypes, students, institute, schedule }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [search, setSearch] = useState("");

  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const filtered = courseStudents.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search)
  );
  const examTypeName = examTypes.find(e => e.id === examType)?.name || "Examination";
  const examSchedule = schedule.filter(s =>
    s.exam_type_id === examType &&
    (!s.course || s.course.toUpperCase() === course.toUpperCase())
  );

  const generateCardHTML = (st) =>
  generateAdmitCardHTML(st, { examTypeName, examSchedule, institute, course });

  const printAll = () =>
  openAdmitCardPrintWindow(
    filtered.map(st => generateCardHTML(st)),
    `Admit Cards — ${course} — ${examTypeName}`
  );
const printOne = (st) =>
  openAdmitCardPrintWindow(
    [generateCardHTML(st)],
    `Admit Card — ${st.name}`
  );

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={setCourse} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 220 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Search Student</label>
          <input placeholder="Name or GCC…" value={search} onChange={e => setSearch(e.target.value)} style={css.input} />
        </div>
        <button onClick={printAll} style={{ ...css.btn, background: "#1a3c2e", color: "white", padding: "9px 24px", fontSize: 14 }}>
          🖨️ Print All ({filtered.length}) Admit Cards
        </button>
      </div>
      {examSchedule.length === 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400E" }}>
          ⚠️ No schedule entries for this exam type. Go to <b>Schedule</b> tab and add exam dates/subjects/times.
        </div>
      )}
      {examSchedule.length > 0 && (
        <div style={{ background: "#E1F5EE", border: "1px solid #BBF7D0", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#0F6E56" }}>
          ✅ {examSchedule.length} schedule entries found for <b>{examTypeName}</b> — will appear on admit cards.
        </div>
      )}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>🪪 {course} — {examTypeName}</span>
          <span style={{ opacity: 0.7, fontSize: 12 }}>{filtered.length} students</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
            {["GCC No.", "Student Name", "Batch", "Admission No.", "Print"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: h === "Student Name" ? "left" : "center", fontWeight: 700, color: "#374151", fontSize: 12 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((st, i) => (
              <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "9px 14px", textAlign: "center", fontWeight: 700, color: "#1a3c2e" }}>{st.gcc_no}</td>
                <td style={{ padding: "9px 14px", fontWeight: 600, color: "#1e293b" }}>{st.name}</td>
                <td style={{ padding: "9px 14px", textAlign: "center" }}><span style={{ background: "#E0F2FE", color: "#0369A1", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.class_name || "—"}</span></td>
                <td style={{ padding: "9px 14px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>{st.admission_no || "—"}</td>
                <td style={{ padding: "9px 14px", textAlign: "center" }}>
                  <button onClick={() => printOne(st)} style={{ ...css.btn, padding: "5px 14px", background: "#1a3c2e", color: "white", fontSize: 12 }}>🖨️ Print</button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function Exams({ currentUser }) {
  const [tab, setTab] = useState("entry");
  const [students, setStudents] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [courseSubjects, setCourseSubjects] = useState(DEFAULT_COURSE_SUBJECTS);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [institute, setInstitute] = useState(INSTITUTE_DEFAULT);

  const refetchSchedule = useCallback(async () => {
    const { data } = await supabase.from('exam_schedule').select('*').order('exam_date')
    setSchedule(data || [])
  }, [])

  useEffect(() => {
    ensureLibs();
    Promise.all([
      supabase.from("students").select("id,name,class_name,course,admission_no,gcc_no").order("name"),
      supabase.from("exam_types").select("*").order("created_at"),
      supabase.from("system_settings").select("value").eq("key", "course_subjects").single(),
      supabase.from("exam_schedule").select("*").order("exam_date"),
      supabase.from("system_settings").select("value").eq("key", "exam_institute_config").single(),
    ]).then(([{ data: sts }, { data: types }, { data: csSetting }, { data: sched }, { data: instSetting }]) => {
      setStudents(sts || []);
      setExamTypes(types && types.length ? types : [{ id: "default", name: "1st Monthly Test" }]);
      if (csSetting?.value) { try { setCourseSubjects(JSON.parse(csSetting.value)); } catch (_) {} }
      setSchedule(sched || []);
      if (instSetting?.value) { try { setInstitute({ ...INSTITUTE_DEFAULT, ...JSON.parse(instSetting.value) }); } catch (_) {} }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "#F7F6F1", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>;
  }

  const courses = Object.keys(courseSubjects);

  const sectionMap = {
    dashboard:      <ExamDashboard courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />,
    toppers:        <ToppersCertificate courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} />,entry:          <MarkEntry courseSubjects={courseSubjects} examTypes={examTypes} students={students} currentUser={currentUser} />,
    marks:          <MarksGrid courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    analytics:      <Analytics courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    rankings:       <Rankings courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    merit:          <MeritList courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    reportcard:     <ReportCards courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} />,
    schedule:       <Schedule courseSubjects={courseSubjects} examTypes={examTypes} onScheduleChange={refetchSchedule} />,
    seatplan:       <SeatArrangement courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />,
    studentsmgr:    <StudentsTab courseSubjects={courseSubjects} students={students} onStudentsChange={setStudents} currentUser={currentUser} />,
    coursesubjects: <CourseSubjectsManager courseSubjects={courseSubjects} onUpdate={setCourseSubjects} />,
    examtypes:      <ExamTypesManager examTypes={examTypes} onUpdate={setExamTypes} />,
    settings:       <ExamSettings institute={institute} onUpdateInstitute={setInstitute} />,
    progress:       <ProgressTab courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    compare:        <CompareTab courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    admitcard:      <AdmitCardsTab courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />,
    bulkreport:     <BulkReports courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />,
  };

  const activeTabInfo = TAB_GROUPS.flatMap(g => g.tabs).find(t => t.id === tab);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F1", fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#1a3c2e 0%,#2A5C45 60%,#3a7a5c 100%)", padding: "20px 28px", color: "white", position: "relative" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#B8860B,#f0c040,#B8860B)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 32 }}>🎓</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 22, fontWeight: 400 }}>Exam HUB</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{institute.name} · Per-Batch Examination Management</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,auto)", gap: 16 }}>
            {[
              { label: "Students",   val: students.length },
              { label: "Batches",    val: courses.length },
              { label: "Exam Types", val: examTypes.length },
              { label: "Role",       val: currentUser?.role || "Admin" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 600 }}>{s.val}</div>
                <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: ".06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TabNav active={tab} onSelect={setTab} />

      <div style={{ padding: "24px 28px", maxWidth: 1400 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 400, color: "#1C1A16" }}>
            {activeTabInfo?.icon} {activeTabInfo?.label}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>{activeTabInfo?.tip}</p>
        </div>
        {sectionMap[tab]}
      </div>
    </div>
  );
}
