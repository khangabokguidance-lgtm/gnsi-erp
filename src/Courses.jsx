// ============================================================
//  GNSI Portal — Course Management Module (Mobile-Responsive)
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase";
import { isAdminRole } from "./roles";
import { PremiumStyles, PremiumHero, PremiumTabs, PIcon, PX } from "./premiumUI";
import CourseFeeRates from "./CourseFeeRates";
import CourseRoster from "./CourseRoster";
import { courseOf, batchOf } from "./courseMap";

// ─── Breakpoint Hook ──────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1024, w };
}

// ─── Shared useCourseData hook ────────────────────────────────
export function useCourseData() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("course_batches")
      .select("id, batch_name, course, subtype, class_name, hostel_type, session_year, status")
      .order("course");
    setBatches(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const courses = useMemo(() => [...new Set(batches.map(b => b.course))], [batches]);
  const activeBatches = useMemo(() => batches.filter(b => b.status === "Active"), [batches]);

  const subtypesFor = useCallback((course) =>
    [...new Set(batches.filter(b => b.course === course).map(b => b.subtype).filter(Boolean))],
  [batches]);

  const classesFor = useCallback((course, subtype) =>
    [...new Set(batches.filter(b => b.course === course && (!subtype || b.subtype === subtype)).map(b => b.class_name).filter(Boolean))],
  [batches]);

  const batchIdFor = useCallback((course, subtype, className) =>
    batches.find(b => b.course === course && (!subtype || b.subtype === subtype) && (!className || b.class_name === className))?.id || "",
  [batches]);

  const batchById = useCallback((id) => batches.find(b => b.id === id), [batches]);

  return { batches, activeBatches, courses, subtypesFor, classesFor, batchIdFor, batchById, loading, reload };
}

// ─── Constants ────────────────────────────────────────────────
const HOSTEL_TYPES  = ["Boarder", "Day Boarder", "Day Scholar"];
const HOSTEL_COLORS = {
  "Boarder":     { bg: "#eef2f9", color: "#1e3a6e", border: "#c9d5ea" },
  "Day Boarder": { bg: "#FFF7ED", color: "#EA580C", border: "#FED7AA" },
  "Day Scholar": { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
};
const COURSE_COLORS = {
  Navodaya:          { color: "#1E3A6E", bg: "#E9EEF8", border: "#C9D5EA" },
  Sainik:            { color: "#1F6F4A", bg: "#E8F5EE", border: "#BFE3CF" },
  Foundation:        { color: "#8a6118", bg: "#F3EEFF", border: "#eadbb2" },
  "Combined Course": { color: "#A7771F", bg: "#FBF3E0", border: "#EADBB2" },
};
const NAV_TABS = [
  { id: "overview",    icon: PIcon.chart,  label: "Overview",    desc: "Courses, batches and how full they are" },
  { id: "batches",     icon: PIcon.layers, label: "Batches",     desc: "Create and manage course batches — the single source of truth" },
  { id: "enrollments", icon: PIcon.users,  label: "Enrollments", desc: "Active students by course and batch, from the Students module" },
  { id: "fees",        icon: PIcon.rupee,  label: "Fees",        desc: "The fee rates the Fees module charges, per course, batch and hostel type" },
];

// ─── Shared UI ────────────────────────────────────────────────
const S = {
  inp: (extra = {}) => ({
    width: "100%", padding: "10px 13px", borderRadius: 11, fontSize: 13.5,
    border: "1px solid #E8E3D8", outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", background: "white", color: "#0F1B2E", ...extra,
  }),
  lbl: { fontSize: 10.5, fontWeight: 700, color: "#5D6B82", display: "block", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" },
  btn: (bg = "#132A4F", c = "white", extra = {}) => ({
    background: bg === "#132A4F" ? "linear-gradient(180deg,#1E3A6E,#132A4F)" : bg, color: c, border: "none", borderRadius: 11,
    padding: "10px 18px", fontWeight: 700, cursor: "pointer",
    fontSize: 13, fontFamily: "inherit", boxShadow: bg === "#132A4F" ? "0 6px 14px -8px rgba(19,42,79,.7)" : "none", ...extra,
  }),
};

function Spinner() {
  return <div style={{ padding: 48, textAlign: "center", color: "#8a93a6", fontSize: 14 }}>⏳ Loading…</div>;
}
function ErrBox({ msg }) {
  return <div style={{ padding: "11px 15px", borderRadius: 9, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 13, marginBottom: 12 }}>🚨 {msg}</div>;
}

function StatCard({ label, value, icon, color, bg, small }) {
  return (
    <div style={{ padding: small ? "12px 10px" : "18px 20px", borderRadius: 12, background: bg, border: `1px solid ${color}30`, textAlign: "center" }}>
      <div style={{ fontSize: small ? 18 : 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: small ? 20 : 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: small ? 10 : 12, color: "#5d6b82", marginTop: 3, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function CourseBadge({ course }) {
  const c = COURSE_COLORS[course] || { color: "#2e3b52", bg: "#f3f0e8", border: "#e8e3d8" };
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "2px 8px", whiteSpace: "nowrap" }}>
      {course}
    </span>
  );
}

function HostelBadge({ type }) {
  const c = HOSTEL_COLORS[type] || { bg: "#f3f0e8", color: "#2e3b52", border: "#e8e3d8" };
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "2px 8px", whiteSpace: "nowrap" }}>
      {type}
    </span>
  );
}

// ─── Modal — slides up from bottom on mobile ──────────────────
function Modal({ title, onClose, children, wide = false, isMobile }) {
  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 999, backdropFilter: "blur(2px)" }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ background: "white", borderRadius: "16px 16px 0 0", padding: "20px 18px 24px", width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 -8px 32px rgba(0,0,0,0.15)" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f1b2e" }}>{title}</h3>
            <button onClick={onClose} style={{ background: "#f3f0e8", border: "none", fontSize: 18, cursor: "pointer", color: "#5d6b82", lineHeight: 1, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(2px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", borderRadius: 14, padding: 28, width: wide ? 680 : 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 48px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f1b2e" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#8a93a6", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── CoursePicker (exported) ──────────────────────────────────
export function CoursePicker({ form, setForm, courseData, required = false }) {
  const { courses, subtypesFor, classesFor, batchIdFor } = courseData;
  const subtypes = form.course ? subtypesFor(form.course) : [];
  const classes  = (form.course && form.subtype) ? classesFor(form.course, form.subtype) : [];

  return (
    <>
      <div>
        <label style={S.lbl}>Course {required && "*"}</label>
        <select value={form.course || ""} onChange={e => setForm(f => ({ ...f, course: e.target.value, subtype: "", class_name: "", batch_id: "" }))} required={required} style={S.inp()}>
          <option value="">Select Course</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label style={S.lbl}>Subtype / Batch</label>
        <select value={form.subtype || ""} onChange={e => {
          const cls = classesFor(form.course, e.target.value);
          const class_name = cls.length === 1 ? cls[0] : "";
          const batch_id = class_name ? batchIdFor(form.course, e.target.value, class_name) : "";
          setForm(f => ({ ...f, subtype: e.target.value, class_name, batch_id }));
        }} disabled={!form.course} style={S.inp({ opacity: form.course ? 1 : 0.5 })}>
          <option value="">All Subtypes</option>
          {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label style={S.lbl}>
          Class
          {form.batch_id && <span style={{ marginLeft: 6, fontSize: 10, color: "#16A34A", fontWeight: 700 }}>✓ linked</span>}
        </label>
        {classes.length > 0
          ? <select value={form.class_name || ""} onChange={e => setForm(f => ({ ...f, class_name: e.target.value, batch_id: batchIdFor(form.course, form.subtype, e.target.value) }))} disabled={!form.subtype} style={S.inp({ opacity: form.subtype ? 1 : 0.5 })}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          : <input value={form.class_name || ""} onChange={e => setForm(f => ({ ...f, class_name: e.target.value, batch_id: batchIdFor(form.course, form.subtype, e.target.value) }))} placeholder="e.g. Class 6" disabled={!form.subtype} style={S.inp({ opacity: form.subtype ? 1 : 0.5 })} />
        }
      </div>
    </>
  );
}

function FilterBar({ items, active, onSelect, colorMap }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
      <style>{`.filter-bar::-webkit-scrollbar{display:none}`}</style>
      {items.map(item => {
        const c = colorMap?.[item] || {};
        const isActive = active === item;
        return (
          <button key={item} onClick={() => onSelect(item)}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
              border: isActive ? `1.5px solid ${c.color || "#1e3a6e"}` : "1px solid #e8e3d8",
              background: isActive ? (c.bg || "#eef2f9") : "white",
              color: isActive ? (c.color || "#1e3a6e") : "#2e3b52",
              fontWeight: isActive ? 700 : 400,
            }}>
            {item}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. OVERVIEW
// ─────────────────────────────────────────────────────────────
function OverviewSection({ courseData, isMobile }) {
  const [stats,        setStats]        = useState(null);
  const [counts,       setCounts]       = useState([]);
  const [hostelCounts, setHostelCounts] = useState([]);
  const [recent,       setRecent]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const { courses } = courseData;

  useEffect(() => {
    if (!courses.length) return;
    (async () => {
      const [{ count: totalBatches }, { data: stu }] = await Promise.all([
        supabase.from("course_batches").select("*", { count: "exact", head: true }),
        supabase.from("students").select("id,name,gcc_no,course,batch,class_name,hostel_type,status,admission_date,created_at"),
      ]);
      // Headline numbers come from the Students table (the real roster), not a separate enrollment list.
      const all = stu || [];
      const active = all.filter(s => !s.status || s.status === "Active");
      setStats({ totalBatches, totalEnrollments: all.length, activeEnrollments: active.length });
      setRecent([...active].sort((a, b) => String(b.admission_date || b.created_at || "").localeCompare(String(a.admission_date || a.created_at || ""))).slice(0, 6)
        .map(s => ({ id: s.id, student_name: s.name, gcc_no: s.gcc_no, course: courseOf(s), subtype: batchOf(s), class_name: s.class_name, hostel_type: s.hostel_type, enrolled_at: s.admission_date || s.created_at })));
      setCounts(courses.map(course => ({ course, count: active.filter(s => courseOf(s) === course).length })));
      setHostelCounts(HOSTEL_TYPES.map(ht => ({ type: ht, count: active.filter(s => s.hostel_type === ht).length })));
      setLoading(false);
    })();
  }, [courses]);

  if (loading || courseData.loading) return <Spinner />;

  return (
    <div>
      {/* Top stat cards — 2 cols mobile, 4 desktop */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: isMobile ? 10 : 14, marginBottom: 16 }}>
        <StatCard label="Courses"     value={courses.length}               icon="📚" color="#1e3a6e" bg="#eef2f9" small={isMobile} />
        <StatCard label="Batches"     value={stats?.totalBatches ?? 0}     icon="🕐" color="#a7771f" bg="#fbf3e0" small={isMobile} />
        <StatCard label="Students"    value={stats?.totalEnrollments ?? 0} icon="👨‍🎓" color="#EA580C" bg="#FFF7ED" small={isMobile} />
        <StatCard label="Active"      value={stats?.activeEnrollments ?? 0}icon="✅" color="#16A34A" bg="#F0FDF4" small={isMobile} />
      </div>

      {/* Hostel breakdown — 3 cols mobile too */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: isMobile ? 8 : 14, marginBottom: 16 }}>
        {hostelCounts.map(({ type, count }) => {
          const c = HOSTEL_COLORS[type] || { color: "#2e3b52", bg: "#f3f0e8" };
          return <StatCard key={type} label={type} value={count} icon={type === "Boarder" ? "🛏️" : type === "Day Boarder" ? "🌅" : "🚶"} color={c.color} bg={c.bg} small={isMobile} />;
        })}
      </div>

      {/* Charts + Recent — stack on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 24 }}>
        <div style={{ background: "white", border: "1px solid #e8e3d8", borderRadius: 12, padding: isMobile ? 16 : 22 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#2e3b52" }}>📊 Students by Course</h3>
          {counts.map(({ course, count }) => {
            const c   = COURSE_COLORS[course] || { color: "#2e3b52" };
            const max = Math.max(...counts.map(x => x.count), 1);
            return (
              <div key={course} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 500, color: "#2e3b52", fontSize: isMobile ? 12 : 13 }}>{course}</span>
                  <span style={{ fontWeight: 700, color: c.color }}>{count}</span>
                </div>
                <div style={{ height: 7, background: "#f3f0e8", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(count / max) * 100}%`, background: c.color, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "white", border: "1px solid #e8e3d8", borderRadius: 12, padding: isMobile ? 16 : 22 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#2e3b52" }}>🆕 Recent Enrollments</h3>
          {recent.length === 0
            ? <div style={{ textAlign: "center", color: "#8a93a6", fontSize: 13, padding: 16 }}>No enrollments yet.</div>
            : recent.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #f3f0e8" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e4ebf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#1e3a6e", flexShrink: 0 }}>
                  {(e.student_name || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1b2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.student_name}
                    {e.gcc_no && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#1e3a6e" }}>GCC-{e.gcc_no}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#8a93a6", display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                    <CourseBadge course={e.course} />
                    {e.hostel_type && <HostelBadge type={e.hostel_type} />}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "#8a93a6", flexShrink: 0 }}>
                  {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. BATCHES
// ─────────────────────────────────────────────────────────────
function BatchesSection({ courseData, isMobile, isAdmin }) {
  const { batches, courses, subtypesFor, reload } = courseData;
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState(null);
  const [sessionFilter, setSessionFilter] = useState("All");
  const [courseFilter,  setCourseFilter]  = useState("All");

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const emptyForm = { batch_name: "", course: "", subtype: "", class_name: "", hostel_type: "", session_year: "2025-2026", start_time: "", end_time: "", days: [], start_date: "", end_date: "", teacher_name: "", room: "", capacity: "", status: "Active" };
  const [form, setForm] = useState(emptyForm);

  const openAdd  = () => { setEditing(null); setForm(emptyForm); setErr(null); setShowModal(true); };
  const openEdit = b  => { setEditing(b); setForm({ ...emptyForm, ...b, days: b.days || [] }); setErr(null); setShowModal(true); };
  const del      = async id => { if (!window.confirm("Delete batch?")) return; await supabase.from("course_batches").delete().eq("id", id); reload(); };
  const toggleDay = d => setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }));

  const save = async () => {
    if (!form.batch_name || !form.course) { setErr("Batch name and course required."); return; }
    setSaving(true); setErr(null);
    const payload = { batch_name: form.batch_name, course: form.course, subtype: form.subtype || null, class_name: form.class_name || null, hostel_type: form.hostel_type || null, session_year: form.session_year || null, start_time: form.start_time || null, end_time: form.end_time || null, days: form.days, start_date: form.start_date || null, end_date: form.end_date || null, teacher_name: form.teacher_name || null, room: form.room || null, capacity: form.capacity ? parseInt(form.capacity) : null, status: form.status };
    const { error } = editing
      ? await supabase.from("course_batches").update(payload).eq("id", editing.id)
      : await supabase.from("course_batches").insert(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false); setShowModal(false); reload();
  };

  const sessions = ["All", ...new Set(batches.map(b => b.session_year).filter(Boolean).sort().reverse())];
  const filtered = batches
    .filter(b => sessionFilter === "All" || b.session_year === sessionFilter)
    .filter(b => courseFilter  === "All" || b.course       === courseFilter);

  const subtypes = form.course ? subtypesFor(form.course) : [];

  const formContent = (
    <>
      {err && <ErrBox msg={err} />}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={S.lbl}>Batch Name *</label>
          <input value={form.batch_name} onChange={e => setForm(f => ({ ...f, batch_name: e.target.value }))} placeholder="e.g. Sainik Achiever Boarder 2025-26" style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Course *</label>
          <select value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value, subtype: "", class_name: "" }))} style={S.inp()}>
            <option value="">Select</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Subtype</label>
          {subtypes.length > 0
            ? <select value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value, class_name: "" }))} style={S.inp()}><option value="">— All —</option>{subtypes.map(s => <option key={s} value={s}>{s}</option>)}</select>
            : <input value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))} style={S.inp()} />
          }
        </div>
        <div>
          <label style={S.lbl}>Class Name</label>
          <input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} placeholder="e.g. Class 6" style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Hostel Type</label>
          <select value={form.hostel_type} onChange={e => setForm(f => ({ ...f, hostel_type: e.target.value }))} style={S.inp()}>
            <option value="">— All Types —</option>
            {HOSTEL_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Session Year</label>
          <input value={form.session_year} onChange={e => setForm(f => ({ ...f, session_year: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Teacher</label>
          <input value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Room</label>
          <input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Start Time</label>
          <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>End Time</label>
          <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Start Date</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>End Date</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Capacity</label>
          <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="30" style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={S.inp()}>
            <option>Active</option><option>Upcoming</option><option>Completed</option><option>Cancelled</option>
          </select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={S.lbl}>Class Days</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DAYS.map(d => (
              <button key={d} type="button" onClick={() => toggleDay(d)}
                style={{ padding: "7px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit", border: form.days.includes(d) ? "2px solid #1e3a6e" : "1px solid #e8e3d8", background: form.days.includes(d) ? "#eef2f9" : "white", color: form.days.includes(d) ? "#1e3a6e" : "#2e3b52", fontWeight: form.days.includes(d) ? 700 : 400 }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={() => setShowModal(false)} style={S.btn("#f3f0e8", "#2e3b52")}>Cancel</button>
        <button onClick={save} disabled={saving} style={S.btn(saving ? "#b7c6e0" : "#1e3a6e")}>{saving ? "Saving…" : editing ? "Update" : "Add Batch"}</button>
      </div>
    </>
  );

  return (
    <div>
      {showModal && <Modal title={editing ? "Edit Batch" : "Add Batch"} onClose={() => setShowModal(false)} wide isMobile={isMobile}>{formContent}</Modal>}

      {/* Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <FilterBar items={["All", ...courses]} active={courseFilter} onSelect={setCourseFilter} colorMap={COURSE_COLORS} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <FilterBar items={sessions} active={sessionFilter} onSelect={setSessionFilter} colorMap={{ All: { color: "#a7771f", bg: "#fbf3e0" } }} />
          {isAdmin && <button onClick={openAdd} style={{ ...S.btn(), flexShrink: 0, padding: "7px 14px", fontSize: 13 }}>+ Add</button>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
        {filtered.map(b => {
          const c = COURSE_COLORS[b.course] || { color: "#2e3b52", bg: "#faf8f3", border: "#e8e3d8" };
          return (
            <div key={b.id} style={{ padding: 16, border: `1px solid ${c.border}`, borderRadius: 12, background: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f1b2e", marginBottom: 6, lineHeight: 1.3 }}>{b.batch_name}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <CourseBadge course={b.course} />
                    {b.subtype    && <span style={{ fontSize: 11, padding: "2px 8px", background: c.bg, borderRadius: 6, color: c.color, border: `1px solid ${c.border}`, fontWeight: 600 }}>{b.subtype}</span>}
                    {b.class_name && <span style={{ fontSize: 11, padding: "2px 8px", background: "#f3f0e8", borderRadius: 6, color: "#2e3b52", border: "1px solid #e8e3d8", fontWeight: 600 }}>{b.class_name}</span>}
                    {b.hostel_type && <HostelBadge type={b.hostel_type} />}
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 600, background: b.status === "Active" ? "#F0FDF4" : "#f3f0e8", color: b.status === "Active" ? "#16A34A" : "#5d6b82", border: `1px solid ${b.status === "Active" ? "#BBF7D0" : "#e8e3d8"}`, whiteSpace: "nowrap", marginLeft: 8, flexShrink: 0 }}>{b.status}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: "#5d6b82", marginBottom: 10 }}>
                {b.session_year && <span>📅 {b.session_year}</span>}
                {b.start_time   && <span>🕐 {b.start_time}–{b.end_time}</span>}
                {b.teacher_name && <span>👨‍🏫 {b.teacher_name}</span>}
                {b.room         && <span>🚪 {b.room}</span>}
                {b.capacity     && <span>💺 {b.capacity}</span>}
                {b.days?.length > 0 && <span style={{ gridColumn: "1/-1" }}>📆 {b.days.join(", ")}</span>}
              </div>
              {isAdmin && <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEdit(b)} style={S.btn("#f3f0e8", "#2e3b52", { padding: "6px 14px", fontSize: 12, flex: 1 })}>Edit</button>
                <button onClick={() => del(b.id)}   style={S.btn("white", "#DC2626", { border: "1px solid #FECACA", padding: "6px 14px", fontSize: 12 })}>🗑</button>
              </div>}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#8a93a6", fontSize: 14 }}>No batches found.</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
export default function CoursePage({ currentUser, perms }) {
  // Was an exact 'Admin' match — Administrator / Co-Admin were treated as read-only.
  const isAdmin = isAdminRole(currentUser?.role) || ['admin', 'administrator', 'co-admin'].includes(String(currentUser?.role || '').toLowerCase())
  const { isMobile } = useBreakpoint();
  const [activeTab, setActiveTab] = useState("overview");
  const courseData = useCourseData();

  const sectionProps = { courseData, isMobile, isAdmin };

  const sectionMap = {
    overview:    <OverviewSection    {...sectionProps} />,
    batches:     <BatchesSection     {...sectionProps} />,
    enrollments: <CourseRoster isMobile={isMobile} />,
    fees:        <CourseFeeRates isMobile={isMobile} />,
  };

  const tab = NAV_TABS.find(t => t.id === activeTab);
  const sessions = [...new Set(courseData.batches.map(b => b.session_year).filter(Boolean))].sort().reverse();
  const boarderBatches = courseData.activeBatches.filter(b => b.hostel_type === "Boarder").length;

  return (
    <div className="px-root">
      <PremiumStyles />
      <div className="px-wrap">
        <PremiumHero
          isMobile={isMobile}
          icon={<PIcon.cap size={isMobile ? 21 : 24} />}
          eyebrow="GNSI · Academics"
          title="Course Management"
          subtitle="Courses, batches, enrollments and fee structure — one source of truth"
          actions={!isMobile && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 420 }}>
              {courseData.courses.map(name => {
                const c = COURSE_COLORS[name] || { color: "#fff" };
                return (
                  <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 99, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", color: "rgba(255,255,255,.9)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color === "#1E3A6E" ? "#93a8d6" : c.color }} />{name}
                  </span>
                );
              })}
            </div>
          )}
          stats={[
            { label: "Courses", value: courseData.loading ? "—" : courseData.courses.length, sub: "running" },
            { label: "Active batches", value: courseData.loading ? "—" : courseData.activeBatches.length, sub: `${courseData.batches.length} in total`, tone: "#86efac" },
            { label: "Boarding batches", value: courseData.loading ? "—" : boarderBatches, sub: "active, boarder" },
            ...(isMobile ? [] : [{ label: "Sessions", value: sessions.length || "—", sub: sessions.slice(0, 2).join(", ") || "none yet" }]),
          ]}
        />

        {!isMobile && <PremiumTabs tabs={NAV_TABS} active={activeTab} onChange={setActiveTab} />}

        <div className="px-section">
          <span className="px-eyebrow">{tab?.label}</span>
          {!isMobile && <span style={{ fontSize: 13, color: PX.sub }}>{tab?.desc}</span>}
        </div>

        {sectionMap[activeTab]}
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: PX.navy, display: "flex", zIndex: 200, padding: "6px 4px calc(6px + env(safe-area-inset-bottom, 0px))", boxShadow: "0 -8px 24px rgba(11,30,61,.3)" }}>
          {NAV_TABS.map(t => {
            const on = activeTab === t.id, I = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "5px 2px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: on ? "#fff" : "rgba(255,255,255,.62)", fontSize: 10, fontWeight: on ? 800 : 600 }}>
                <span style={{ width: 40, height: 26, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: on ? PX.gold : "transparent", color: on ? "#1a1406" : "inherit" }}><I size={18} /></span>
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}