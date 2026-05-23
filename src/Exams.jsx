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
  LEADER:    ["Vocabulary", "Grammar", "General Knowledge", "Mathematics", "Mathematics - II", "Reasoning", "Science"],
};

// ─── Max marks per subject per course (all total to 100) ─────────────────────
const COURSE_MAX_MARKS = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
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
    ]
  },
  {
    groupLabel: "Documents", color: "#16a34a",
    tabs: [
      { id: "admitcard",  icon: "🪪",  label: "Admit Cards",  tip: "Generate admit cards" },
      { id: "reportcard", icon: "📋", label: "Report Cards", tip: "Print report cards" },
      { id: "bulkreport", icon: "📦", label: "Bulk Reports", tip: "Batch report generation" },
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
  address: "Khangabok, Manipur",
  tagline: "Excellence in Education",
  principal: "Principal",
  teacher: "Class Teacher",
  logoUrl: "",
  academicYear: "2025-2026",
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
          <select value={examDate} onChange={e=>setExamDate(e.target.value)} style={{ ...css.input, width:160 }}>
            {dates.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
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
function Schedule({ courseSubjects, examTypes, onScheduleChange }) {
  const courses = Object.keys(courseSubjects);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [filterExamType, setFilterExamType] = useState("ALL");
  const allSubjects = [...new Set(Object.values(courseSubjects).flat())];
  const [form, setForm] = useState({
    exam_type_id: examTypes[0]?.id || "",
    course: courses[0] || "",
    subject: "",
    exam_date: "", time: "09:00", total_marks: 100, room: "", shift: "Morning"
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSchedule = async () => {
    setLoading(true);
    const { data } = await supabase.from("exam_schedule").select("*").order("exam_date", { ascending: true });
    setSchedule(data || []); setLoading(false);
  };
  useEffect(() => { fetchSchedule(); }, []);

  // subjects for selected course in form
  const formSubjects = courseSubjects[form.course] || [];

  const handleSave = async () => {
    if (!form.exam_date || !form.subject) return;
    setSaving(true);
    await supabase.from("exam_schedule").insert([{ ...form, total_marks: Number(form.total_marks) }]);
    setSaving(false); setSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async id => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("exam_schedule").delete().eq("id", id);
    fetchSchedule(); onScheduleChange?.();
  };

  const filtered = schedule.filter(s => {
    const matchCourse = filterCourse === "ALL" || s.course === filterCourse;
    const matchType = filterExamType === "ALL" || s.exam_type_id === filterExamType;
    return matchCourse && matchType;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>➕ Add Entry</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={form.exam_type_id} onChange={e => setForm(p => ({ ...p, exam_type_id: e.target.value }))} style={css.input}>
            {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Course / Batch</label>
          <select value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value, subject: "" }))} style={css.input}>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Subject</label>
          <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} style={css.input}>
            <option value="">— Select Subject —</option>
            {formSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Shift</label>
          <select value={form.shift} onChange={e => setForm(p => ({ ...p, shift: e.target.value }))} style={css.input}>
            <option value="Morning">🌅 Morning</option>
            <option value="Afternoon">🌤️ Afternoon</option>
            <option value="Evening">🌆 Evening</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <input type="date" value={form.exam_date} onChange={e => setForm(p => ({ ...p, exam_date: e.target.value }))} style={css.input} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Time</label>
          <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={css.input} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Total Marks</label>
          <input type="number" value={form.total_marks} onChange={e => setForm(p => ({ ...p, total_marks: e.target.value }))} style={css.input} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Room / Hall</label>
          <input type="text" value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))} style={css.input} />
        </div>

        <SaveBtn onClick={handleSave} saving={saving} saved={saved} label="Add Entry" />
      </div>

      <div>
        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Filter Course</label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["ALL", ...courses].map(c => (
                <button key={c} onClick={() => setFilterCourse(c)}
                  style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: filterCourse === c ? "#1a3c2e" : "#F3F4F6", color: filterCourse === c ? "white" : "#374151", border: filterCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Filter Exam Type</label>
            <select value={filterExamType} onChange={e => setFilterExamType(e.target.value)} style={{ ...css.input, width: 180 }}>
              <option value="ALL">All Types</option>
              {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>{filtered.length} entries</div>
        </div>

        {loading ? <Spinner /> : (
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📅 Exam Schedule</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                {["Date", "Course", "Exam Type", "Subject", "Shift", "Time", "Marks", "Room", ""].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "9px 12px", fontWeight: 600 }}>{s.exam_date}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.course || "—"}</span>
                    </td>
                    <td style={{ padding: "9px 12px" }}>{examTypes.find(e => e.id === s.exam_type_id)?.name || s.exam_type_id}</td>
                    <td style={{ padding: "9px 12px" }}>{s.subject}</td>
                    <td style={{ padding: "9px 12px", color: "#64748b" }}>{s.shift || "Morning"}</td>
                    <td style={{ padding: "9px 12px", color: "#64748b" }}>{s.time || "--"}</td>
                    <td style={{ padding: "9px 12px", color: "#64748b" }}>{s.total_marks}</td>
                    <td style={{ padding: "9px 12px", color: "#64748b" }}>{s.room || "--"}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <button onClick={() => handleDelete(s.id)} style={{ ...css.btn, padding: "4px 10px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>✕</button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No schedule entries yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marksMap[`${sid}-${sub}`]) || 0), 0);
  const total = getTotal(st.id);
  const pct = calcPct(total, course);
  const grade = getGrade(pct);
  const passed = pct >= 40;
  const gradeColors = { "A+":"#0F6E56","A":"#185FA5","B+":"#534AB7","B":"#2563eb","C":"#BA7517","D":"#ea580c","F":"#A32D2D" };
  const gradeColor = gradeColors[grade.label] || "#1a3c2e";

  const sortedStudents = [...allStudents].map(s => ({ ...s, total: getTotal(s.id) })).sort((a,b) => b.total - a.total);
  let rank = 1, prev = null;
  for (let i = 0; i < sortedStudents.length; i++) {
    if (i === 0) { rank = 1; prev = sortedStudents[i].total; } else if (sortedStudents[i].total !== prev) { rank++; prev = sortedStudents[i].total; }
    if (sortedStudents[i].id === st.id) break;
  }
  const rankSuffix = rank===1?"st":rank===2?"nd":rank===3?"rd":"th";
  const totalStudents = allStudents.length;

  const subjectRows = subjects.map((s, idx) => {
    const m = Number(marksMap[`${st.id}-${s}`]) || 0;
    const subMax = getSubjectMax(course, s);
    const subPct = Math.round((m / subMax) * 100);
    const subPassed = subPct >= 40;
    const barColor = subPct>=80?"#0F6E56":subPct>=60?"#185FA5":subPct>=40?"#BA7517":"#A32D2D";
    const rowBg = idx%2===0?"#FDFAF3":"#FFFFFF";
    return `<tr style="background:${rowBg}">
      <td class="sub-name">${s}</td>
      <td class="marks-cell">${m}<span class="marks-max">/${subMax}</span></td>
      <td class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${subPct}%;background:${barColor}"></div></div></td>
      <td class="pct-cell" style="color:${barColor}">${subPct}%</td>
      <td class="result-cell"><span class="result-pill" style="background:${subPassed?"#E1F5EE":"#FCEBEB"};color:${subPassed?"#0F6E56":"#A32D2D"}">${subPassed?"✓ PASS":"✗ FAIL"}</span></td>
    </tr>`;
  }).join("");

  const remarkBlock = remarkText ? `<div class="remark-box"><div class="remark-label">✦ Teacher's Remarks</div><div class="remark-text">"${remarkText}"</div></div>` : "";

  return `<div class="card">
    <div class="top-strip"></div>
    <div class="header">
      <div class="header-pattern"></div>
      <div class="header-inner">
        <div class="logo-ring">${institute.logoUrl?`<img src="${institute.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%"/>`:`<div class="logo-text">GNSI</div>`}</div>
        <div class="header-text">
          <div class="eyebrow">Official Academic Record · ${institute.academicYear||"2025-2026"}</div>
          <div class="inst-name">${institute.name||"Guidance Navodaya & Sainik Institute"}</div>
          <div class="inst-addr">${institute.address||"Khangabok, Manipur"}</div>
          <div class="doc-title">Report Card</div>
        </div>
        <div class="exam-tag"><div class="exam-tag-inner">
          <div class="exam-tag-name">${examName}</div>
          <div class="exam-tag-date">${examDate||""}</div>
        </div></div>
      </div>
    </div>
    <div class="gold-rule"><div class="gold-rule-line"></div><div class="gold-rule-ornament">◆ &nbsp; ◆ &nbsp; ◆</div><div class="gold-rule-line"></div></div>
    <div class="student-strip">
      <div class="student-strip-left">
        <div class="info-block"><div class="info-label">Student Name</div><div class="info-value big">${st.name}</div></div>
        <div class="info-block"><div class="info-label">GCC Number</div><div class="info-value big">${st.gcc_no||"—"}</div></div>
        <div class="info-block"><div class="info-label">Course / Batch</div><div class="info-value">${st.course||course} · ${st.class_name||"—"}</div></div>
        <div class="info-block"><div class="info-label">Class Rank</div><div class="info-value rank-val" style="color:${rank<=3?"#B8860B":"#1a3c2e"}">${rank}<sup style="font-size:12px">${rankSuffix}</sup> <span style="font-size:12px;color:#9CA3AF;font-family:'DM Sans',sans-serif">/ ${totalStudents}</span></div></div>
      </div>
      <div class="student-strip-right">
        <div class="grade-circle" style="border-color:${gradeColor};box-shadow:0 0 0 6px ${gradeColor}18;background:${grade.bg}">
          <div class="grade-letter" style="color:${gradeColor}">${grade.label}</div>
          <div class="grade-sub" style="color:${gradeColor}">GRADE</div>
        </div>
        <div class="status-pill" style="background:${passed?"#E1F5EE":"#FCEBEB"};color:${passed?"#0F6E56":"#A32D2D"};border:1px solid ${passed?"#BBF7D0":"#FECACA"}">${passed?"✓ PASS":"✗ FAIL"}</div>
      </div>
    </div>
    <div class="score-bar-row">
      <div class="score-stat"><div class="score-stat-label">Marks Obtained</div><div class="score-stat-value">${total}<span style="font-size:13px;opacity:0.5">/${courseMax}</span></div></div>
      <div class="score-stat"><div class="score-stat-label">Percentage</div><div class="score-stat-value pct-highlight">${pct.toFixed(1)}%</div></div>
      <div class="score-stat"><div class="score-stat-label">Grade Points</div><div class="score-stat-value">${grade.gpa.toFixed(1)}</div><div class="score-stat-sub">GPA / 4.0</div></div>
      <div class="score-stat"><div class="score-stat-label">Subjects</div><div class="score-stat-value">${subjects.length}</div><div class="score-stat-sub">attempted</div></div>
      <div class="score-stat"><div class="score-stat-label">Class Rank</div><div class="score-stat-value">${rank}<span style="font-size:13px;opacity:0.5">/${totalStudents}</span></div></div>
    </div>
    <div class="subjects-section">
      <div class="section-heading">Subject-wise Performance</div>
      <table class="sub-table">
        <thead><tr><th>Subject</th><th class="center">Score</th><th>Performance Bar</th><th class="center">%</th><th class="center">Result</th></tr></thead>
        <tbody>
          ${subjectRows}
          <tr class="total-row">
            <td class="total-label">Grand Total</td>
            <td class="total-marks" style="text-align:center">${total}<span style="font-size:12px;color:#9CA3AF;font-weight:400">/${courseMax}</span></td>
            <td><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${gradeColor}"></div></div></td>
            <td style="text-align:center;font-size:16px;font-weight:800;color:${gradeColor}">${pct.toFixed(1)}%</td>
            <td style="text-align:center"><span class="result-pill" style="background:${grade.bg};color:${gradeColor};font-size:11px">${grade.label} · ${grade.gpa.toFixed(1)} GPA</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    ${remarkBlock}
    <div class="sig-section">
      <div class="sig-block">
        <div class="sig-svg" style="height:44px"></div>
        <div class="sig-line"></div>
        <div class="sig-title">Student's Signature</div>
      </div>
      <div class="seal-block"><div class="seal"><div class="seal-word">Official</div><div class="seal-star">★</div><div class="seal-word">Seal</div></div></div>
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
    <div class="footer-strip"><div class="footer-text">${institute.name||"GNSI"} &nbsp;·&nbsp; ${institute.address||"Khangabok, Manipur"} &nbsp;·&nbsp; ${examName} &nbsp;·&nbsp; Academic Year ${institute.academicYear||"2025-2026"}</div></div>
  </div>`;
}

const REPORT_CARD_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{--green:#1a3c2e;--green2:#2A5C45;--green3:#3a7a5c;--gold:#B8860B;--gold2:#D4A017;--gold3:#f0c040;--cream:#FDFAF3;--cream2:#F5EFE0;--border:#D5C89A;--text:#1C1A16;--text2:#5C5440;}
  @page{margin:0.7cm;size:A4;}
  body{font-family:'DM Sans',sans-serif;background:#d6cfc0;padding:20px;color:var(--text);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .no-print{text-align:center;margin-bottom:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
  .no-print button{padding:9px 24px;border:none;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;}
  .btn-print{background:#1a3c2e;color:white;} .btn-close{background:#e5e7eb;color:#374151;}
  .card{width:740px;margin:0 auto 32px;background:var(--cream);border-radius:3px;box-shadow:0 8px 40px rgba(0,0,0,0.18),0 0 0 1px var(--border);position:relative;overflow:hidden;}
  .top-strip{height:6px;background:linear-gradient(90deg,#0d2818 0%,var(--green) 30%,var(--gold) 60%,var(--gold3) 80%,var(--green3) 100%);}
  .header{background:linear-gradient(150deg,#0d2818 0%,var(--green) 45%,#1e4d36 100%);padding:22px 32px 18px;position:relative;z-index:1;overflow:hidden;}
  .header-pattern{position:absolute;inset:0;opacity:0.04;background-image:repeating-linear-gradient(45deg,var(--gold3) 0px,var(--gold3) 1px,transparent 1px,transparent 12px);}
  .header-inner{display:flex;align-items:center;gap:18px;position:relative;z-index:1;}
  .logo-ring{width:68px;height:68px;border-radius:50%;border:2.5px solid var(--gold2);box-shadow:0 0 0 4px rgba(184,134,11,0.2);background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .logo-text{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--gold3);letter-spacing:1px;}
  .header-text{flex:1;text-align:center;}
  .eyebrow{font-size:9px;letter-spacing:5px;text-transform:uppercase;color:rgba(240,192,64,0.75);margin-bottom:4px;}
  .inst-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:#fff;letter-spacing:.3px;line-height:1.2;margin-bottom:3px;}
  .inst-addr{font-size:11px;color:rgba(255,255,255,0.65);margin-bottom:3px;}
  .doc-title{display:inline-block;font-family:'Cormorant Garamond',serif;font-size:12px;font-style:italic;color:var(--gold3);letter-spacing:2px;border-top:1px solid rgba(240,192,64,0.4);border-bottom:1px solid rgba(240,192,64,0.4);padding:2px 16px;margin-top:5px;}
  .exam-tag-inner{background:rgba(184,134,11,0.18);border:1px solid rgba(240,192,64,0.4);border-radius:6px;padding:7px 12px;}
  .exam-tag-name{font-family:'Playfair Display',serif;font-size:12px;font-weight:600;color:var(--gold3);letter-spacing:.5px;line-height:1.3;}
  .exam-tag-date{font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px;}
  .gold-rule{display:flex;align-items:center;padding:0 32px;background:var(--cream2);border-top:1px solid var(--border);border-bottom:1px solid var(--border);height:22px;}
  .gold-rule-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--gold2),transparent);}
  .gold-rule-ornament{color:var(--gold2);font-size:11px;margin:0 12px;}
  .student-strip{display:flex;align-items:stretch;background:white;border-bottom:1px solid #EDE8D8;}
  .student-strip-left{flex:1;padding:16px 32px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;border-right:1px solid #EDE8D8;}
  .info-block{padding:0 14px;border-right:1px solid #EDE8D8;}
  .info-block:first-child{padding-left:0;} .info-block:last-child{border-right:none;}
  .info-label{font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:4px;}
  .info-value{font-family:'Cormorant Garamond',serif;font-size:14px;font-weight:600;color:var(--text);}
  .info-value.big{font-family:'Playfair Display',serif;font-size:16px;color:var(--green);}
  .info-value.rank-val{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;}
  .student-strip-right{width:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;gap:6px;}
  .grade-circle{width:68px;height:68px;border-radius:50%;border:3px solid;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .grade-letter{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;line-height:1;}
  .grade-sub{font-size:8px;font-weight:600;letter-spacing:1px;margin-top:1px;}
  .status-pill{font-size:10px;font-weight:700;letter-spacing:1.5px;padding:3px 10px;border-radius:999px;}
  .score-bar-row{display:flex;background:var(--green);}
  .score-stat{flex:1;text-align:center;padding:10px 6px;border-right:1px solid rgba(255,255,255,0.1);}
  .score-stat:last-child{border-right:none;}
  .score-stat-label{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(240,192,64,0.7);margin-bottom:3px;}
  .score-stat-value{font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:white;line-height:1;}
  .score-stat-sub{font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;}
  .pct-highlight{color:var(--gold3)!important;}
  .subjects-section{padding:16px 32px;}
  .section-heading{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:600;color:var(--green);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:10px;}
  .section-heading::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--border),transparent);}
  .sub-table{width:100%;border-collapse:collapse;font-size:13px;}
  .sub-table thead th{padding:5px 8px;text-align:left;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border);}
  .sub-table thead th.center{text-align:center;}
  .sub-name{padding:9px 8px;font-weight:500;color:var(--text);width:36%;}
  .marks-cell{padding:9px 8px;text-align:center;font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:600;color:var(--green);width:10%;}
  .marks-max{font-size:10px;color:#9CA3AF;font-weight:400;}
  .bar-cell{padding:9px 8px;width:28%;}
  .bar-track{height:7px;background:#E5E7EB;border-radius:999px;overflow:hidden;}
  .bar-fill{height:100%;border-radius:999px;}
  .pct-cell{padding:9px 6px;text-align:center;font-weight:700;font-size:12px;width:10%;}
  .result-cell{padding:9px 8px;text-align:center;width:14%;}
  .result-pill{font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;}
  .total-row td{padding:10px 8px;border-top:2px solid var(--border);background:var(--cream2);font-weight:700;}
  .total-label{font-family:'Playfair Display',serif;font-size:13px;color:var(--green);}
  .total-marks{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--green);}
  .remark-box{margin:0 32px 14px;padding:12px 16px;background:white;border:1px solid var(--border);border-left:4px solid var(--gold);border-radius:4px;}
  .remark-label{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:5px;}
  .remark-text{font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;color:var(--text2);line-height:1.6;}
  .sig-section{display:flex;align-items:flex-end;justify-content:space-between;padding:14px 32px 16px;background:white;border-top:1px solid #EDE8D8;gap:16px;}
  .sig-block{text-align:center;flex:1;}
  .sig-svg{margin-bottom:2px;display:flex;justify-content:center;}
  .sig-line{height:1.5px;background:linear-gradient(90deg,transparent,var(--border),var(--text),var(--border),transparent);margin:4px 10px;}
  .sig-title{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--text2);font-weight:600;margin-top:3px;}
  .sig-name-sub{font-size:10.5px;color:var(--green);font-weight:600;margin-top:2px;}
  .seal-block{flex:0 0 76px;display:flex;flex-direction:column;align-items:center;}
  .seal{width:68px;height:68px;border-radius:50%;border:2px dashed var(--gold);background:var(--cream2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;}
  .seal-word{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);font-weight:700;}
  .seal-star{font-size:15px;color:var(--gold);line-height:1;}
  .footer-strip{background:linear-gradient(90deg,#0d2818,var(--green),#0d2818);padding:7px 32px;position:relative;}
  .footer-strip::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold),var(--gold3),var(--gold));}
  .footer-text{font-size:9.5px;color:rgba(255,255,255,0.55);text-align:center;letter-spacing:.5px;}
  .page-break{page-break-after:always;height:0;}
  @media print{body{background:white;padding:0;}.no-print{display:none!important;}.card{box-shadow:none;border-radius:0;width:100%;margin:0 auto 0;}}
`;

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
  const acSchedule = schedule.filter(s => s.exam_type_id === acExamType && (!s.course || s.course === acCourse));
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
    setRcProgress({ current: 0, total: filteredRcStudents.length });
    const cards = [];
    try { await supabase.from('exam_print_log').insert({ doc_type:'report_card', course:rcCourse, exam_type:examTypes.find(e=>e.id===rcExamType)?.name||'', student_count:filteredRcStudents.length }) } catch(_){}
    for (let i = 0; i < filteredRcStudents.length; i++) {
      const st = filteredRcStudents[i];
      const remark = rcIncludeRemarks ? (rcRemarks[st.id] || "") : "";
      cards.push(buildReportCardHTML(st, rcSubjects, rcMarks, rcCourse, rcStudents, examTypes.find(e=>e.id===rcExamType)?.name||"Examination", rcExamDate, institute, remark));
      setRcProgress({ current: i+1, total: filteredRcStudents.length });
      await new Promise(r=>setTimeout(r,0)); // allow UI update
    }
    const sep = rcPageBreak ? '<div class="page-break"></div>' : '<div style="margin-bottom:24px"></div>';
    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Bulk Report Cards — ${rcCourse} — ${examTypes.find(e=>e.id===rcExamType)?.name||""}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>${REPORT_CARD_CSS}</style></head><body>
      <div class="no-print">
        <button class="btn-print" onclick="window.print()">🖨️ Print All (${cards.length}) Report Cards</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
      ${cards.join(sep)}
    </body></html>`);
    w.document.close();
    setRcProgress(null);
  };

  // ── Admit card builder (reuse from AdmitCardsTab) ──
  const buildAdmitCardHTML = (st) => {
    const scheduleRows = acSchedule.length
      ? acSchedule.sort((a,b)=>a.exam_date.localeCompare(b.exam_date)).map(s=>`<tr><td>${s.exam_date}</td><td>${s.time||"—"}</td><td>${s.subject}</td><td style="text-align:center">${s.total_marks}</td><td style="text-align:center">${s.room||"—"}</td></tr>`).join("")
      : `<tr><td colspan="5" style="text-align:center;color:#999;padding:14px">No schedule entries.</td></tr>`;
    return `<div class="admit-card">
      <div class="watermark">ADMIT CARD</div>
      <div class="top-strip"></div>
      <div class="card-header">
        <div class="logo-circle">${institute.logoUrl?`<img src="${institute.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%"/>`:`<div class="logo-initials">GNSI</div>`}</div>
        <div class="header-center">
          <div class="inst-eyebrow">GOVERNMENT AFFILIATED · EST. 2015</div>
          <div class="inst-name">${institute.name||"Guidance Navodaya & Sainik Institute"}</div>
          <div class="inst-addr">${institute.address||"Khangabok, Manipur"}</div>
          <div class="inst-tagline">${institute.tagline||"Excellence in Education"}</div>
        </div>
        <div class="header-right"><div class="admit-badge"><div class="admit-badge-text">ADMIT</div><div class="admit-badge-text">CARD</div></div></div>
      </div>
      <div class="gold-divider"><div class="gold-line"></div><div class="gold-diamond">◆</div><div class="gold-line"></div></div>
      <div class="exam-banner"><div class="exam-banner-title">${acExamName}</div><div class="exam-banner-year">${institute.academicYear||"2025-2026"}</div></div>
      <div class="student-section">
        <div class="student-info-grid">
          <div class="info-row">
            <div class="info-field"><div class="field-label">Student Name</div><div class="field-value name-value">${st.name}</div></div>
            <div class="info-field"><div class="field-label">GCC Number</div><div class="field-value gcc-value">${st.gcc_no||"—"}</div></div>
          </div>
          <div class="info-row">
            <div class="info-field"><div class="field-label">Course / Batch</div><div class="field-value">${st.course||acCourse} — ${st.class_name||acCourse}</div></div>
            <div class="info-field"><div class="field-label">Admission No.</div><div class="field-value">${st.admission_no||"—"}</div></div>
            <div class="info-field"><div class="field-label">Academic Year</div><div class="field-value">${institute.academicYear||"2025-2026"}</div></div>
          </div>
        </div>
        <div class="photo-box"><div class="photo-inner"><div class="photo-text">Affix<br/>Passport<br/>Photo</div></div><div class="photo-label">Photograph</div></div>
      </div>
      <div class="gold-divider mini"><div class="gold-line"></div><div class="gold-diamond">◆</div><div class="gold-line"></div></div>
      <div class="schedule-section">
        <div class="section-title">📅 Examination Schedule</div>
        <table class="sched-table"><thead><tr><th>Date</th><th>Time</th><th>Subject</th><th>Max Marks</th><th>Hall / Room</th></tr></thead><tbody>${scheduleRows}</tbody></table>
      </div>
      <div class="instructions">
        <div class="instr-title">📋 Important Instructions</div>
        <div class="instr-grid">
          <div class="instr-item">① Carry this admit card to the examination hall.</div>
          <div class="instr-item">② Arrive at least 15 minutes before the exam.</div>
          <div class="instr-item">③ Electronic devices are strictly prohibited.</div>
          <div class="instr-item">④ This card must be presented on demand.</div>
          <div class="instr-item">⑤ Students without this card will not be permitted.</div>
          <div class="instr-item">⑥ Any malpractice will lead to disqualification.</div>
        </div>
      </div>
      <div class="signatures">
        <div class="sig-block"><div class="sig-digital" style="height:38px"></div><div class="sig-line-draw"></div><div class="sig-label">Student's Signature</div></div>
        <div class="sig-center"><div class="official-seal"><div class="seal-inner"><div class="seal-word">OFFICIAL</div><div class="seal-star">★</div><div class="seal-word">SEAL</div></div></div></div>
        <div class="sig-block sig-right">
          <div class="sig-digital" style="height:38px"></div>
          <div class="sig-line-draw"></div>
          <div class="sig-label">Exam Coordinator</div>
        </div>
        <div class="sig-block sig-right">
          <div class="sig-digital" style="height:38px"></div>
          <div class="sig-line-draw"></div>
          <div class="sig-label">Head of Institute</div>
        </div>
      </div>
      <div class="bottom-bar"><div class="bottom-bar-text">Issued by ${institute.name||"GNSI"} · ${institute.address||""} · ${acExamName} · ${institute.academicYear||"2025-2026"}</div></div>
    </div>`;
  };

  const ADMIT_CSS = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :root{--green-dark:#0d2818;--green:#1a3c2e;--green-mid:#2A5C45;--gold:#B8860B;--gold-light:#f0c040;--gold-pale:#FDF8E8;--border:#D5C89A;--text:#1C1A16;--text2:#5C5440;}
    @page{margin:1cm;size:A4;}
    body{font-family:'EB Garamond',Georgia,serif;background:#e8e0d0;padding:20px;color:var(--text);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .no-print{text-align:center;margin-bottom:16px;display:flex;gap:10px;justify-content:center;}
    .no-print button{padding:9px 24px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;}
    .btn-print{background:var(--green);color:white;} .btn-close{background:#e5e7eb;color:#374151;}
    .admit-card{width:720px;margin:0 auto 32px;background:var(--gold-pale);border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,0.18),0 0 0 1px var(--border);position:relative;overflow:hidden;}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-family:'Playfair Display',serif;font-size:76px;font-weight:700;color:rgba(184,134,11,0.055);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:12px;}
    .top-strip{height:7px;background:linear-gradient(90deg,var(--green-dark) 0%,var(--green) 40%,var(--green-mid) 70%,var(--gold) 100%);}
    .card-header{display:flex;align-items:center;gap:16px;padding:18px 26px 14px;background:linear-gradient(135deg,var(--green-dark) 0%,var(--green) 55%,#1e4d36 100%);position:relative;z-index:1;}
    .logo-circle{width:64px;height:64px;border-radius:50%;border:3px solid var(--gold);background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .logo-initials{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--gold-light);letter-spacing:1px;}
    .header-center{flex:1;text-align:center;}
    .inst-eyebrow{font-size:9px;letter-spacing:4px;text-transform:uppercase;color:var(--gold-light);opacity:0.8;margin-bottom:3px;}
    .inst-name{font-family:'Playfair Display',serif;font-size:19px;font-weight:600;color:#fff;margin-bottom:2px;}
    .inst-addr{font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:2px;}
    .inst-tagline{font-family:'Playfair Display',serif;font-style:italic;font-size:10px;color:var(--gold-light);opacity:0.85;}
    .admit-badge{background:var(--gold);border-radius:4px;padding:7px 12px;text-align:center;}
    .admit-badge-text{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:var(--green-dark);letter-spacing:3px;line-height:1.3;}
    .gold-divider{display:flex;align-items:center;padding:8px 26px;background:var(--gold-pale);border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
    .gold-divider.mini{padding:5px 26px;}
    .gold-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);}
    .gold-diamond{color:var(--gold);font-size:10px;margin:0 10px;}
    .exam-banner{display:flex;justify-content:space-between;align-items:center;padding:9px 26px;background:#E1F5EE;border-bottom:1px solid #BBF7D0;}
    .exam-banner-title{font-family:'Playfair Display',serif;font-size:16px;font-weight:600;color:var(--green);}
    .exam-banner-year{font-size:11px;color:var(--green-mid);font-weight:600;background:white;padding:3px 12px;border-radius:999px;border:1px solid #BBF7D0;}
    .student-section{display:flex;gap:18px;padding:16px 26px;background:white;border-bottom:1px solid #F0ECD8;position:relative;z-index:1;}
    .student-info-grid{flex:1;}
    .info-row{display:flex;gap:14px;margin-bottom:10px;}
    .info-row:last-child{margin-bottom:0;}
    .info-field{flex:1;}
    .field-label{font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:3px;}
    .field-value{font-size:13px;font-weight:500;color:var(--text);border-bottom:1.5px solid var(--border);padding-bottom:3px;}
    .name-value{font-family:'Playfair Display',serif;font-size:16px;font-weight:600;color:var(--green);}
    .gcc-value{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--green-dark);letter-spacing:2px;}
    .photo-box{flex-shrink:0;text-align:center;}
    .photo-inner{width:86px;height:104px;border:2px dashed var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--gold-pale);margin-bottom:3px;}
    .photo-text{font-size:10px;color:var(--text2);text-align:center;line-height:1.6;}
    .photo-label{font-size:9px;color:var(--text2);letter-spacing:1px;text-transform:uppercase;}
    .schedule-section{padding:14px 26px;position:relative;z-index:1;}
    .section-title{font-family:'Playfair Display',serif;font-size:13px;font-weight:600;color:var(--green);margin-bottom:8px;}
    .sched-table{width:100%;border-collapse:collapse;border:1px solid var(--border);font-size:11.5px;}
    .sched-table thead tr{background:var(--green);color:white;}
    .sched-table thead th{padding:7px 10px;text-align:left;font-weight:600;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;}
    .sched-table tbody tr:nth-child(odd){background:var(--gold-pale);}
    .sched-table tbody tr:nth-child(even){background:white;}
    .sched-table tbody td{padding:7px 10px;border-bottom:1px solid var(--border);}
    .instructions{padding:10px 26px 12px;background:#F8F6F0;border-top:1px solid #EDE8D8;border-bottom:1px solid #EDE8D8;position:relative;z-index:1;}
    .instr-title{font-family:'Playfair Display',serif;font-size:11.5px;font-weight:600;color:var(--green);margin-bottom:6px;}
    .instr-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 20px;}
    .instr-item{font-size:10.5px;color:var(--text2);line-height:1.5;}
    .signatures{display:flex;justify-content:space-between;align-items:flex-end;padding:14px 26px 14px;gap:14px;background:white;position:relative;z-index:1;}
    .sig-block{text-align:center;flex:1;}
    .sig-center{flex:0.6;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;}
    .sig-name{font-size:9.5px;color:var(--text2);margin-bottom:2px;font-style:italic;height:18px;}
    .sig-digital{height:40px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:2px;}
    .sig-line-draw{height:1.5px;background:linear-gradient(90deg,transparent 0%,var(--border) 15%,var(--text) 50%,var(--border) 85%,transparent 100%);margin:3px 6px 3px;}
    .sig-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--text2);font-weight:600;margin-top:2px;}
    .sig-subname{font-size:10px;color:var(--green);font-weight:600;margin-top:2px;}
    .official-seal{width:66px;height:66px;border-radius:50%;border:2px dashed var(--gold);display:flex;align-items:center;justify-content:center;background:var(--gold-pale);margin-bottom:3px;}
    .seal-inner{text-align:center;}
    .seal-word{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);font-weight:700;}
    .seal-star{color:var(--gold);font-size:13px;line-height:1;}
    .bottom-bar{background:linear-gradient(90deg,var(--green-dark),var(--green),var(--green-dark));padding:7px 26px;position:relative;z-index:1;}
    .bottom-bar::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold),var(--gold-light),var(--gold));}
    .bottom-bar-text{font-size:9.5px;color:rgba(255,255,255,0.6);text-align:center;letter-spacing:.5px;}
    .page-break{page-break-after:always;height:0;}
    @media print{body{background:white;padding:0;}.no-print{display:none!important;}.admit-card{box-shadow:none;margin:0 auto;border-radius:0;} @page{margin:1cm;size:A4;}}
  `;

  const printAllAdmitCards = async () => {
    setAcProgress({ current: 0, total: filteredAcStudents.length });
    try { await supabase.from('exam_print_log').insert({ doc_type:'admit_card', course:acCourse, exam_type:acExamName, student_count:filteredAcStudents.length }) } catch(_){}
    const cards = [];
    for (let i = 0; i < filteredAcStudents.length; i++) {
      cards.push(buildAdmitCardHTML(filteredAcStudents[i]));
      setAcProgress({ current: i+1, total: filteredAcStudents.length });
      await new Promise(r=>setTimeout(r,0));
    }
    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Bulk Admit Cards — ${acCourse} — ${acExamName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:wght@400;500;600&display=swap" rel="stylesheet"/>
      <style>${ADMIT_CSS}</style></head><body>
      <div class="no-print">
        <button class="btn-print" onclick="window.print()">🖨️ Print All (${cards.length}) Admit Cards</button>
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
  const examSchedule = schedule.filter(s => s.exam_type_id === examType && (!s.course || s.course === course));

  const generateCardHTML = (st) => {
    const scheduleRows = examSchedule.length
      ? examSchedule.sort((a, b) => a.exam_date.localeCompare(b.exam_date)).map(s =>
          `<tr><td>${s.exam_date}</td><td>${s.time || "—"}</td><td>${s.subject}</td><td style="text-align:center">${s.total_marks}</td><td style="text-align:center">${s.room || "—"}</td></tr>`
        ).join("")
      : `<tr><td colspan="5" style="text-align:center;color:#999;padding:14px">No schedule entries. Add them in the Schedule tab.</td></tr>`;

    return `
    <div class="admit-card">
      <div class="watermark">ADMIT CARD</div>
      <div class="top-strip"></div>
      <div class="card-header">
        <div class="logo-circle">${institute.logoUrl ? `<img src="${institute.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" />` : `<div class="logo-initials">GNSI</div>`}</div>
        <div class="header-center">
          <div class="inst-eyebrow">GOVERNMENT AFFILIATED · EST. 2015</div>
          <div class="inst-name">${institute.name || "Guidance Navodaya & Sainik Institute"}</div>
          <div class="inst-addr">${institute.address || "Khangabok, Manipur"}</div>
          <div class="inst-tagline">${institute.tagline || "Excellence in Education"}</div>
        </div>
        <div class="header-right"><div class="admit-badge"><div class="admit-badge-text">ADMIT</div><div class="admit-badge-text">CARD</div></div></div>
      </div>
      <div class="gold-divider"><div class="gold-line"></div><div class="gold-diamond">◆</div><div class="gold-line"></div></div>
      <div class="exam-banner">
        <div class="exam-banner-title">${examTypeName}</div>
        <div class="exam-banner-year">${institute.academicYear || "2025-2026"}</div>
      </div>
      <div class="student-section">
        <div class="student-info-grid">
          <div class="info-row">
            <div class="info-field"><div class="field-label">Student Name</div><div class="field-value name-value">${st.name}</div></div>
            <div class="info-field"><div class="field-label">GCC Number</div><div class="field-value gcc-value">${st.gcc_no || "—"}</div></div>
          </div>
          <div class="info-row">
            <div class="info-field"><div class="field-label">Course / Batch</div><div class="field-value">${st.course || course} — ${st.class_name || course}</div></div>
            <div class="info-field"><div class="field-label">Admission No.</div><div class="field-value">${st.admission_no || "—"}</div></div>
            <div class="info-field"><div class="field-label">Academic Year</div><div class="field-value">${institute.academicYear || "2025-2026"}</div></div>
          </div>
        </div>
        <div class="photo-box">
          <div class="photo-inner">${st.photo_url ? `<img src="${st.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px"/>` : `<div class="photo-text">Affix<br/>Passport<br/>Photo</div>`}</div>
          <div class="photo-label">Photograph</div>
        </div>
      </div>
      <div class="gold-divider mini"><div class="gold-line"></div><div class="gold-diamond">◆</div><div class="gold-line"></div></div>
      <div class="schedule-section">
        <div class="section-title">📅 Examination Schedule</div>
        <table class="sched-table">
          <thead><tr><th>Date</th><th>Time</th><th>Subject</th><th>Max Marks</th><th>Hall / Room</th></tr></thead>
          <tbody>${scheduleRows}</tbody>
        </table>
      </div>
      <div class="instructions">
        <div class="instr-title">📋 Important Instructions</div>
        <div class="instr-grid">
          <div class="instr-item">① Carry this admit card to the examination hall.</div>
          <div class="instr-item">② Arrive at least 15 minutes before the exam.</div>
          <div class="instr-item">③ Electronic devices are strictly prohibited.</div>
          <div class="instr-item">④ This card must be presented on demand.</div>
          <div class="instr-item">⑤ Students without this card will not be permitted.</div>
          <div class="instr-item">⑥ Any malpractice will lead to disqualification.</div>
        </div>
      </div>
      <div class="signatures">
        <div class="sig-block">
          <div class="sig-digital" style="height:42px"></div>
          <div class="sig-line-draw"></div>
          <div class="sig-label">Student's Signature</div>
        </div>
        <div class="sig-center">
          <div class="official-seal"><div class="seal-inner"><div class="seal-text">OFFICIAL</div><div class="seal-star">★</div><div class="seal-text">SEAL</div></div></div>
        </div>
        <div class="sig-block sig-right">
          <div class="sig-digital" style="height:42px"></div>
          <div class="sig-line-draw"></div>
          <div class="sig-label">Exam Coordinator</div>
        </div>
        <div class="sig-block sig-right">
          <div class="sig-digital" style="height:42px"></div>
          <div class="sig-line-draw"></div>
          <div class="sig-label">Head of Institute</div>
        </div>
      </div>
      <div class="bottom-bar"><div class="bottom-bar-text">Issued by ${institute.name || "GNSI"} · ${institute.address || "Khangabok, Manipur"} · ${examTypeName} · ${institute.academicYear || "2025-2026"}</div></div>
    </div>`;
  };

  const PRINT_CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --green-dark:#0d2818; --green:#1a3c2e; --green-mid:#2A5C45; --gold:#B8860B; --gold-light:#f0c040; --gold-pale:#FDF8E8; --border:#D5C89A; --text:#1C1A16; --text2:#5C5440; --bg:#FDFAF3; }
    body { font-family:'EB Garamond',Georgia,serif; background:#e8e0d0; padding:24px; color:var(--text); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .no-print { text-align:center; margin-bottom:20px; display:flex; gap:12px; justify-content:center; }
    .no-print button { padding:10px 28px; background:var(--green); color:white; border:none; border-radius:8px; cursor:pointer; font-size:15px; }
    .admit-card { width:720px; margin:0 auto 40px; background:var(--bg); border-radius:4px; box-shadow:0 8px 40px rgba(0,0,0,0.18),0 0 0 1px var(--border); position:relative; overflow:hidden; }
    .watermark { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-family:'Playfair Display',serif; font-size:80px; font-weight:700; color:rgba(184,134,11,0.055); white-space:nowrap; pointer-events:none; z-index:0; letter-spacing:12px; }
    .top-strip { height:7px; background:linear-gradient(90deg,var(--green-dark) 0%,var(--green) 40%,var(--green-mid) 70%,var(--gold) 100%); }
    .card-header { display:flex; align-items:center; gap:18px; padding:20px 28px 16px; background:linear-gradient(135deg,var(--green-dark) 0%,var(--green) 55%,#1e4d36 100%); position:relative; z-index:1; }
    .logo-circle { width:68px; height:68px; border-radius:50%; border:3px solid var(--gold); background:rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .logo-initials { font-family:'Playfair Display',serif; font-size:17px; font-weight:700; color:var(--gold-light); letter-spacing:1px; }
    .header-center { flex:1; text-align:center; }
    .inst-eyebrow { font-size:9px; letter-spacing:4px; text-transform:uppercase; color:var(--gold-light); opacity:0.8; margin-bottom:4px; }
    .inst-name { font-family:'Playfair Display',serif; font-size:21px; font-weight:600; color:#fff; letter-spacing:.5px; line-height:1.2; margin-bottom:3px; }
    .inst-addr { font-size:12px; color:rgba(255,255,255,0.72); margin-bottom:2px; }
    .inst-tagline { font-family:'Playfair Display',serif; font-style:italic; font-size:11px; color:var(--gold-light); opacity:0.85; }
    .admit-badge { background:var(--gold); border-radius:4px; padding:8px 14px; text-align:center; }
    .admit-badge-text { font-family:'Playfair Display',serif; font-size:15px; font-weight:700; color:var(--green-dark); letter-spacing:3px; line-height:1.3; }
    .gold-divider { display:flex; align-items:center; padding:10px 28px; background:var(--gold-pale); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
    .gold-divider.mini { padding:6px 28px; }
    .gold-line { flex:1; height:1px; background:linear-gradient(90deg,transparent,var(--gold),transparent); }
    .gold-diamond { color:var(--gold); font-size:10px; margin:0 12px; }
    .exam-banner { display:flex; justify-content:space-between; align-items:center; padding:10px 28px; background:#E1F5EE; border-bottom:1px solid #BBF7D0; }
    .exam-banner-title { font-family:'Playfair Display',serif; font-size:17px; font-weight:600; color:var(--green); }
    .exam-banner-year { font-size:12px; color:var(--green-mid); font-weight:600; letter-spacing:1px; background:white; padding:3px 12px; border-radius:999px; border:1px solid #BBF7D0; }
    .student-section { display:flex; gap:20px; padding:18px 28px; background:white; border-bottom:1px solid #F0ECD8; position:relative; z-index:1; }
    .student-info-grid { flex:1; }
    .info-row { display:flex; gap:16px; margin-bottom:12px; }
    .info-row:last-child { margin-bottom:0; }
    .info-field { flex:1; }
    .field-label { font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--gold); font-weight:600; margin-bottom:4px; }
    .field-value { font-size:14px; font-weight:500; color:var(--text); border-bottom:1.5px solid var(--border); padding-bottom:4px; }
    .name-value { font-family:'Playfair Display',serif; font-size:17px; font-weight:600; color:var(--green); }
    .gcc-value { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:var(--green-dark); letter-spacing:2px; }
    .photo-box { flex-shrink:0; text-align:center; }
    .photo-inner { width:90px; height:108px; border:2px dashed var(--border); border-radius:4px; display:flex; align-items:center; justify-content:center; background:var(--gold-pale); margin-bottom:4px; }
    .photo-text { font-size:10px; color:var(--text2); text-align:center; line-height:1.6; }
    .photo-label { font-size:9px; color:var(--text2); letter-spacing:1px; text-transform:uppercase; }
    .schedule-section { padding:16px 28px; position:relative; z-index:1; }
    .section-title { font-family:'Playfair Display',serif; font-size:13px; font-weight:600; color:var(--green); margin-bottom:10px; }
    .sched-table { width:100%; border-collapse:collapse; border:1px solid var(--border); font-size:12px; }
    .sched-table thead tr { background:var(--green); color:white; }
    .sched-table thead th { padding:8px 12px; text-align:left; font-weight:600; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; }
    .sched-table tbody tr:nth-child(odd) { background:var(--gold-pale); }
    .sched-table tbody tr:nth-child(even) { background:white; }
    .sched-table tbody td { padding:8px 12px; border-bottom:1px solid var(--border); }
    .instructions { padding:12px 28px 14px; background:#F8F6F0; border-top:1px solid #EDE8D8; border-bottom:1px solid #EDE8D8; position:relative; z-index:1; }
    .instr-title { font-family:'Playfair Display',serif; font-size:12px; font-weight:600; color:var(--green); margin-bottom:8px; }
    .instr-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; }
    .instr-item { font-size:11px; color:var(--text2); line-height:1.5; }
    .signatures { display:flex; justify-content:space-between; align-items:flex-end; padding:18px 28px 16px; gap:16px; background:white; position:relative; z-index:1; }
    .sig-block { text-align:center; flex:1; }
    .sig-center { flex:0.6; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; }
    .sig-name { font-size:10px; color:var(--text2); margin-bottom:2px; font-style:italic; height:20px; }
    .sig-digital { height:42px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:2px; }
    .sig-line-draw { height:1.5px; background:linear-gradient(90deg,transparent 0%,var(--border) 15%,var(--text) 50%,var(--border) 85%,transparent 100%); margin:4px 8px 4px; }
    .sig-label { font-size:9.5px; letter-spacing:2px; text-transform:uppercase; color:var(--text2); font-weight:600; margin-top:3px; }
    .sig-subname { font-size:10.5px; color:var(--green); font-weight:600; margin-top:2px; }
    .official-seal { width:70px; height:70px; border-radius:50%; border:2px dashed var(--gold); display:flex; align-items:center; justify-content:center; background:var(--gold-pale); margin-bottom:4px; }
    .seal-inner { text-align:center; }
    .seal-text { font-size:7px; letter-spacing:2px; text-transform:uppercase; color:var(--gold); font-weight:700; }
    .seal-star { color:var(--gold); font-size:14px; line-height:1; }
    .bottom-bar { background:linear-gradient(90deg,var(--green-dark),var(--green),var(--green-dark)); padding:8px 28px; position:relative; z-index:1; }
    .bottom-bar::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--gold),var(--gold-light),var(--gold)); }
    .bottom-bar-text { font-size:10px; color:rgba(255,255,255,0.65); text-align:center; letter-spacing:.5px; }
    .page-break { page-break-after:always; height:0; }
    @media print { body { background:white; padding:0; } .no-print { display:none !important; } .admit-card { box-shadow:none; margin:0 auto; border-radius:0; } @page { margin:1cm; size:A4; } }
  `;

  const openPrintWindow = (body, title) => {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:wght@400;500;600&display=swap" rel="stylesheet"/>
    <style>${PRINT_CSS}</style></head><body>
    <div class="no-print"><button onclick="window.print()">🖨️ Print All Cards</button><button onclick="window.close()">✕ Close</button></div>
    ${body}</body></html>`);
    w.document.close();
  };

  const printAll = () => openPrintWindow(filtered.map(st => generateCardHTML(st)).join('<div class="page-break"></div>'), `Admit Cards — ${course} — ${examTypeName}`);
  const printOne = st => openPrintWindow(generateCardHTML(st), `Admit Card — ${st.name}`);

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
    entry:          <MarkEntry courseSubjects={courseSubjects} examTypes={examTypes} students={students} currentUser={currentUser} />,
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
