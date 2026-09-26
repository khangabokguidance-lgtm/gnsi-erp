// ============================================================
//  GNSI Portal — Course Management Module (Mobile-Responsive)
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase";
import { isAdminRole } from "./roles";
import { PremiumStyles, PremiumHero, PremiumTabs, PIcon, PX } from "./premiumUI";

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
const FEE_TYPES = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "One-Time"];
const COURSE_COLORS = {
  Navodaya:          { color: "#1E3A6E", bg: "#E9EEF8", border: "#C9D5EA" },
  Sainik:            { color: "#1F6F4A", bg: "#E8F5EE", border: "#BFE3CF" },
  Foundation:        { color: "#8a6118", bg: "#F3EEFF", border: "#eadbb2" },
  "Combined Course": { color: "#A7771F", bg: "#FBF3E0", border: "#EADBB2" },
};
const NAV_TABS = [
  { id: "overview",    icon: PIcon.chart,  label: "Overview",    desc: "Courses, batches and how full they are" },
  { id: "batches",     icon: PIcon.layers, label: "Batches",     desc: "Create and manage course batches — the single source of truth" },
  { id: "enrollments", icon: PIcon.users,  label: "Enrollments", desc: "Which student is in which batch" },
  { id: "fees",        icon: PIcon.rupee,  label: "Fees",        desc: "Fee structure per course, batch and hostel type" },
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

// ─── Student Search Box ───────────────────────────────────────
function StudentSearchBox({ students, onSelect }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() =>
    q.length < 1 ? [] : students.filter(s =>
      (s.name || "").toLowerCase().includes(q.toLowerCase()) ||
      String(s.gcc_no || "").includes(q)
    ).slice(0, 8),
  [q, students]);

  return (
    <div style={{ position: "relative" }}>
      <label style={S.lbl}>🔍 Student — name or GCC No.</label>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Type to search…" style={S.inp()} />
      {hits.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #d9d2c2", borderRadius: 8, zIndex: 400, boxShadow: "0 6px 20px rgba(0,0,0,0.13)", maxHeight: 220, overflowY: "auto" }}>
          {hits.map(s => (
            <div key={s.id} onClick={() => { onSelect(s); setQ(""); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f0e8", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#e4ebf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1e3a6e", flexShrink: 0 }}>
                {(s.name || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#0f1b2e" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#5d6b82", display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                  {s.gcc_no && <span style={{ fontWeight: 700, color: "#1e3a6e" }}>GCC-{s.gcc_no}</span>}
                  {s.class_name && <span>{s.class_name}</span>}
                  {s.hostel_type && <HostelBadge type={s.hostel_type} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Scroll Filter Bar (mobile-friendly) ─────────────────────
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
      const [{ count: totalBatches }, { count: totalEnrollments }, { count: activeEnrollments }, { data: rec }] = await Promise.all([
        supabase.from("course_batches").select("*", { count: "exact", head: true }),
        supabase.from("course_enrollments").select("*", { count: "exact", head: true }),
        supabase.from("course_enrollments").select("*", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("course_enrollments").select("id,student_name,gcc_no,course,subtype,class_name,hostel_type,enrolled_at").order("enrolled_at", { ascending: false }).limit(6),
      ]);
      setStats({ totalBatches, totalEnrollments, activeEnrollments });
      setRecent(rec || []);

      const cc = await Promise.all(courses.map(async course => {
        const { count } = await supabase.from("course_enrollments").select("*", { count: "exact", head: true }).eq("course", course).eq("status", "Active");
        return { course, count: count ?? 0 };
      }));
      setCounts(cc);

      const hc = await Promise.all(HOSTEL_TYPES.map(async ht => {
        const { count } = await supabase.from("course_enrollments").select("*", { count: "exact", head: true }).eq("hostel_type", ht).eq("status", "Active");
        return { type: ht, count: count ?? 0 };
      }));
      setHostelCounts(hc);
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
        <StatCard label="Enrollments" value={stats?.totalEnrollments ?? 0} icon="👨‍🎓" color="#EA580C" bg="#FFF7ED" small={isMobile} />
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
          <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#2e3b52" }}>📊 Enrollments by Course</h3>
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
// 3. ENROLLMENTS
// ─────────────────────────────────────────────────────────────
function EnrollmentsSection({ courseData, isMobile, isAdmin }) {
  const { batches, courses, subtypesFor, batchIdFor } = courseData;
  const [enrollments,  setEnrollments]  = useState([]);
  const [students,     setStudents]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState(null);
  const [filter,       setFilter]       = useState("All");
  const [hostelFilter, setHostelFilter] = useState("All");
  const [search,       setSearch]       = useState("");

  const emptyForm = { student_name: "", student_id: "", gcc_no: "", hostel_type: "", course: "", subtype: "", class_name: "", batch_id: "", session_year: "2025-2026", enrolled_at: new Date().toISOString().slice(0, 10), status: "Active", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: enr }, { data: stu }] = await Promise.all([
      supabase.from("course_enrollments").select("*").order("enrolled_at", { ascending: false }),
      supabase.from("students").select("id,name,gcc_no,class_name,batch,course,hostel_type,session,status").order("name"),
    ]);
    setEnrollments(enr || []);
    setStudents(stu || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm(emptyForm); setErr(null); setShowModal(true); };
  const openEdit = e  => { setEditing(e); setForm({ ...emptyForm, ...e, enrolled_at: e.enrolled_at?.slice(0, 10) || "" }); setErr(null); setShowModal(true); };
  const del      = async id => { if (!window.confirm("Remove enrollment?")) return; await supabase.from("course_enrollments").delete().eq("id", id); load(); };

  const handlePick = s => {
    const batch_id = batchIdFor(s.course || "", s.batch || "", s.class_name || "");
    setForm(f => ({ ...f, student_name: s.name, student_id: String(s.id), gcc_no: s.gcc_no || "", class_name: s.class_name || s.batch || "", course: s.course || f.course, subtype: s.batch || f.subtype, hostel_type: s.hostel_type || "", session_year: s.session || f.session_year, batch_id }));
  };

  const save = async () => {
    if (!form.student_name || !form.course) { setErr("Student name and course required."); return; }
    // Guard against the duplicate-active-enrollment bug found in production:
    // several students (all created within the same 41-minute window on
    // 2026-06-23) ended up with two simultaneous Active course_enrollments
    // rows for the same gcc_no — one Boarder, one Day Scholar — because
    // nothing here checked for an existing active enrollment before
    // inserting a new one. A second bulk-edit style save (or a double
    // submit) silently created a conflicting duplicate instead of updating
    // the original. This check runs for both new enrollments and edits
    // (excluding the row being edited itself via .neq) so it can't be
    // bypassed either way.
    if (form.status === "Active" && form.gcc_no) {
      const { data: existingActive } = await supabase
        .from("course_enrollments")
        .select("id, hostel_type, course, subtype")
        .eq("gcc_no", form.gcc_no)
        .eq("status", "Active")
        .neq("id", editing?.id ?? -1);
      if (existingActive && existingActive.length > 0) {
        const conflict = existingActive[0];
        const differs = conflict.hostel_type !== form.hostel_type || conflict.course !== form.course;
        const proceed = window.confirm(
          `This student already has an active enrollment` +
          (differs ? ` (${conflict.course || "—"}${conflict.subtype ? " " + conflict.subtype : ""}, ${conflict.hostel_type || "no hostel type set"})` : "") +
          `.\n\nSaving this will create a SECOND active enrollment for the same student, which can cause conflicting hostel type / fee records like the one this check was added to catch.\n\nDo you want to continue anyway? (Usually you should edit the existing enrollment instead of creating a new one.)`
        );
        if (!proceed) return;
      }
    }
    // Soft warning (not blocking) when the hostel type chosen here doesn't
    // match the hostel type already on the student's own record — this is
    // the field that handlePick() auto-fills from `students.hostel_type`,
    // so a mismatch here usually means it was manually overridden after
    // picking the student, which is the same override pattern that caused
    // the production duplicates.
    const pickedStudent = students.find(s => String(s.id) === String(form.student_id));
    if (pickedStudent && pickedStudent.hostel_type && form.hostel_type && pickedStudent.hostel_type !== form.hostel_type) {
      const proceed = window.confirm(
        `This student's own record has hostel type "${pickedStudent.hostel_type}", but "${form.hostel_type}" is selected here.\n\nIf this student's hostel type genuinely changed, update it on the Students page first so it stays consistent everywhere. Continue saving with "${form.hostel_type}" anyway?`
      );
      if (!proceed) return;
    }
    setSaving(true); setErr(null);
    const payload = { student_name: form.student_name, student_id: form.student_id || null, gcc_no: form.gcc_no || null, hostel_type: form.hostel_type || null, course: form.course, subtype: form.subtype || null, class_name: form.class_name || null, batch_id: form.batch_id || null, session_year: form.session_year || null, enrolled_at: form.enrolled_at || null, status: form.status, notes: form.notes || null };
    const { error } = editing
      ? await supabase.from("course_enrollments").update(payload).eq("id", editing.id)
      : await supabase.from("course_enrollments").insert(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false); setShowModal(false); load();
  };

  const batchName = id => batches.find(b => b.id === id)?.batch_name || "—";
  const subtypes = form.course ? subtypesFor(form.course) : [];
  const filteredBatches = batches.filter(b => b.course === form.course && (!b.hostel_type || !form.hostel_type || b.hostel_type === form.hostel_type));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enrollments.filter(e =>
      (filter       === "All" || e.course      === filter) &&
      (hostelFilter === "All" || e.hostel_type === hostelFilter) &&
      (!search || e.student_name?.toLowerCase().includes(q) || String(e.gcc_no || "").includes(q))
    );
  }, [enrollments, filter, hostelFilter, search]);

  if (loading) return <Spinner />;

  const formContent = (
    <>
      {err && <ErrBox msg={err} />}
      <div style={{ marginBottom: 14 }}>
        <StudentSearchBox students={students} onSelect={handlePick} />
      </div>
      {form.student_id && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "#eef2f9", border: "1px solid #c9d5ea", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
          <span>✅</span>
          <span style={{ color: "#1e3a6e", fontWeight: 600 }}>Student linked</span>
          {form.gcc_no && <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1e3a6e" }}>GCC-{form.gcc_no}</span>}
          {form.hostel_type && <HostelBadge type={form.hostel_type} />}
          <button onClick={() => setForm(f => ({ ...f, student_id: "", gcc_no: "", student_name: "", hostel_type: "", batch_id: "" }))}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#8a93a6", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div>
          <label style={S.lbl}>GCC No.</label>
          <input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} style={S.inp({ fontFamily: "monospace", fontWeight: form.gcc_no ? 700 : 400, color: form.gcc_no ? "#1e3a6e" : "#2e3b52" })} />
        </div>
        <div>
          <label style={S.lbl}>Student Name *</label>
          <input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Course *</label>
          <select value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value, subtype: "", class_name: "", batch_id: "" }))} style={S.inp()}>
            <option value="">Select</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Subtype</label>
          {subtypes.length > 0
            ? <select value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value, batch_id: "" }))} style={S.inp()}><option value="">— Select —</option>{subtypes.map(s => <option key={s} value={s}>{s}</option>)}</select>
            : <input value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))} style={S.inp()} />
          }
        </div>
        <div>
          <label style={S.lbl}>Class Name</label>
          <input value={form.class_name} onChange={e => { const batch_id = batchIdFor(form.course, form.subtype, e.target.value); setForm(f => ({ ...f, class_name: e.target.value, batch_id })); }} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Hostel Type</label>
          <select value={form.hostel_type} onChange={e => setForm(f => ({ ...f, hostel_type: e.target.value, batch_id: "" }))} style={S.inp({ background: form.hostel_type ? HOSTEL_COLORS[form.hostel_type]?.bg : "white", color: form.hostel_type ? HOSTEL_COLORS[form.hostel_type]?.color : "#2e3b52", fontWeight: form.hostel_type ? 600 : 400 })}>
            <option value="">— Select —</option>
            {HOSTEL_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Batch (filtered)</label>
          <select value={form.batch_id} onChange={e => setForm(f => ({ ...f, batch_id: e.target.value }))} style={S.inp()}>
            <option value="">— No Batch —</option>
            {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.batch_name}{b.session_year ? ` (${b.session_year})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Session Year</label>
          <input value={form.session_year} onChange={e => setForm(f => ({ ...f, session_year: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Enrolled Date</label>
          <input type="date" value={form.enrolled_at} onChange={e => setForm(f => ({ ...f, enrolled_at: e.target.value }))} style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={S.inp()}>
            <option>Active</option><option>Completed</option><option>Dropped</option><option>On Hold</option>
          </select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={S.lbl}>Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...S.inp(), resize: "vertical" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={() => setShowModal(false)} style={S.btn("#f3f0e8", "#2e3b52")}>Cancel</button>
        <button onClick={save} disabled={saving} style={S.btn(saving ? "#b7c6e0" : "#1e3a6e")}>{saving ? "Saving…" : editing ? "Update" : "Enroll"}</button>
      </div>
    </>
  );

  return (
    <div>
      {showModal && <Modal title={editing ? "Edit Enrollment" : "Enroll Student"} onClose={() => setShowModal(false)} wide isMobile={isMobile}>{formContent}</Modal>}

      {/* Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        <FilterBar items={["All", ...courses]} active={filter} onSelect={setFilter} colorMap={COURSE_COLORS} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <FilterBar items={["All", ...HOSTEL_TYPES]} active={hostelFilter} onSelect={setHostelFilter} colorMap={HOSTEL_COLORS} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Name or GCC…" style={{ ...S.inp(), flex: 1 }} />
          {isAdmin && <button onClick={openAdd} style={{ ...S.btn(), flexShrink: 0, padding: "9px 14px", fontSize: 13 }}>+ Enroll</button>}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#5d6b82", marginBottom: 10 }}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</div>

      {/* Mobile: cards / Desktop: table */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: "#8a93a6" }}>No enrollments found.</div>
            : filtered.map(e => (
              <div key={e.id} style={{ background: "white", border: "1px solid #e8e3d8", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e4ebf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1e3a6e", flexShrink: 0 }}>
                    {(e.student_name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f1b2e" }}>{e.student_name}</div>
                    {e.gcc_no && <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#1e3a6e" }}>GCC-{e.gcc_no}</div>}
                  </div>
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 600, background: e.status === "Active" ? "#F0FDF4" : e.status === "Dropped" ? "#FEF2F2" : "#f3f0e8", color: e.status === "Active" ? "#16A34A" : e.status === "Dropped" ? "#DC2626" : "#5d6b82" }}>{e.status}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <CourseBadge course={e.course} />
                  {e.subtype    && <span style={{ fontSize: 11, color: "#5d6b82", padding: "2px 6px", background: "#f3f0e8", borderRadius: 4 }}>{e.subtype}</span>}
                  {e.class_name && <span style={{ fontSize: 11, color: "#5d6b82", padding: "2px 6px", background: "#f3f0e8", borderRadius: 4 }}>{e.class_name}</span>}
                  {e.hostel_type && <HostelBadge type={e.hostel_type} />}
                </div>
                <div style={{ fontSize: 11, color: "#8a93a6", marginBottom: 10 }}>
                  {e.session_year && <span>📅 {e.session_year}</span>}
                  {e.batch_id && <span style={{ marginLeft: 8 }}>📋 {batchName(e.batch_id)}</span>}
                </div>
                {isAdmin && <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(e)} style={S.btn("#f3f0e8", "#2e3b52", { padding: "6px 14px", fontSize: 12, flex: 1 })}>Edit</button>
                  <button onClick={() => del(e.id)}   style={S.btn("white", "#DC2626", { border: "1px solid #FECACA", padding: "6px 14px", fontSize: 12 })}>✕</button>
                </div>}
              </div>
            ))
          }
        </div>
      ) : (
        <div style={{ border: "1px solid #e8e3d8", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#faf8f3", borderBottom: "1px solid #e8e3d8" }}>
                  {["Student", "GCC", "Course", "Subtype", "Class", "Hostel", "Session", "Batch", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#5d6b82", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f3f0e8" : "none" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 500, color: "#0f1b2e" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e4ebf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#1e3a6e", flexShrink: 0 }}>{(e.student_name || "?")[0].toUpperCase()}</div>
                        {e.student_name}
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: e.gcc_no ? "#1e3a6e" : "#8a93a6" }}>{e.gcc_no ? `GCC-${e.gcc_no}` : "—"}</td>
                    <td style={{ padding: "11px 14px" }}><CourseBadge course={e.course} /></td>
                    <td style={{ padding: "11px 14px", color: "#5d6b82" }}>{e.subtype || "—"}</td>
                    <td style={{ padding: "11px 14px", color: "#5d6b82" }}>{e.class_name || "—"}</td>
                    <td style={{ padding: "11px 14px" }}>{e.hostel_type ? <HostelBadge type={e.hostel_type} /> : <span style={{ color: "#8a93a6" }}>—</span>}</td>
                    <td style={{ padding: "11px 14px", color: "#8a93a6", fontSize: 12 }}>{e.session_year || "—"}</td>
                    <td style={{ padding: "11px 14px", color: "#5d6b82", fontSize: 12 }}>{e.batch_id ? batchName(e.batch_id) : "—"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 600, background: e.status === "Active" ? "#F0FDF4" : e.status === "Dropped" ? "#FEF2F2" : "#f3f0e8", color: e.status === "Active" ? "#16A34A" : e.status === "Dropped" ? "#DC2626" : "#5d6b82" }}>{e.status}</span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {isAdmin && <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => openEdit(e)} style={S.btn("#f3f0e8", "#2e3b52", { padding: "4px 10px", fontSize: 12 })}>Edit</button>
                        <button onClick={() => del(e.id)}   style={S.btn("white", "#DC2626", { border: "1px solid #FECACA", padding: "4px 10px", fontSize: 12 })}>✕</button>
                      </div>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#8a93a6" }}>No enrollments found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. FEE STRUCTURE
// ─────────────────────────────────────────────────────────────
function FeesSection({ courseData, isMobile, isAdmin }) {
  const { courses, subtypesFor } = courseData;
  const [fees,      setFees]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState(null);

  const emptyForm = { course: "", subtype: "", hostel_type: "", class_name: "", fee_type: "Monthly", amount: "", due_day: "", discount_percent: "", notes: "", session_year: "2025-2026" };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("course_fees").select("*").order("course").order("subtype").order("hostel_type");
    setFees(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm(emptyForm); setErr(null); setShowModal(true); };
  const openEdit = f  => { setEditing(f); setForm({ ...emptyForm, ...f }); setErr(null); setShowModal(true); };
  const del      = async id => { if (!window.confirm("Delete fee entry?")) return; await supabase.from("course_fees").delete().eq("id", id); load(); };

  const save = async () => {
    if (!form.course || !form.amount) { setErr("Course and amount required."); return; }
    setSaving(true); setErr(null);
    const payload = { course: form.course, subtype: form.subtype || null, hostel_type: form.hostel_type || null, class_name: form.class_name || null, fee_type: form.fee_type, amount: parseFloat(form.amount), due_day: form.due_day ? parseInt(form.due_day) : null, discount_percent: form.discount_percent ? parseFloat(form.discount_percent) : null, notes: form.notes || null, session_year: form.session_year };
    const { error } = editing
      ? await supabase.from("course_fees").update(payload).eq("id", editing.id)
      : await supabase.from("course_fees").insert(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false); setShowModal(false); load();
  };

  const subtypes = form.course ? subtypesFor(form.course) : [];

  const grouped = {};
  fees.forEach(f => {
    const ck = f.course;
    const sk = f.subtype     || "—";
    const hk = f.hostel_type || "All";
    if (!grouped[ck])         grouped[ck]         = {};
    if (!grouped[ck][sk])     grouped[ck][sk]     = {};
    if (!grouped[ck][sk][hk]) grouped[ck][sk][hk] = [];
    grouped[ck][sk][hk].push(f);
  });

  if (loading) return <Spinner />;

  const formContent = (
    <>
      {err && <ErrBox msg={err} />}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div>
          <label style={S.lbl}>Course *</label>
          <select value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value, subtype: "" }))} style={S.inp()}>
            <option value="">Select</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Subtype</label>
          {subtypes.length > 0
            ? <select value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))} style={S.inp()}><option value="">All Subtypes</option>{subtypes.map(s => <option key={s} value={s}>{s}</option>)}</select>
            : <input value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))} placeholder="Optional" style={S.inp()} />
          }
        </div>
        <div>
          <label style={S.lbl}>Hostel Type</label>
          <select value={form.hostel_type} onChange={e => setForm(f => ({ ...f, hostel_type: e.target.value }))} style={S.inp({ background: form.hostel_type ? HOSTEL_COLORS[form.hostel_type]?.bg : "white", color: form.hostel_type ? HOSTEL_COLORS[form.hostel_type]?.color : "#2e3b52", fontWeight: form.hostel_type ? 700 : 400 })}>
            <option value="">— All Types —</option>
            {HOSTEL_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Fee Type</label>
          <select value={form.fee_type} onChange={e => setForm(f => ({ ...f, fee_type: e.target.value }))} style={S.inp()}>
            {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Amount (₹) *</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="3500" style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Due Day</label>
          <input type="number" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} placeholder="10" min="1" max="31" style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Discount (%)</label>
          <input type="number" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} placeholder="0" style={S.inp()} />
        </div>
        <div>
          <label style={S.lbl}>Session Year</label>
          <input value={form.session_year} onChange={e => setForm(f => ({ ...f, session_year: e.target.value }))} style={S.inp()} />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={S.lbl}>Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...S.inp(), resize: "vertical" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={() => setShowModal(false)} style={S.btn("#f3f0e8", "#2e3b52")}>Cancel</button>
        <button onClick={save} disabled={saving} style={S.btn(saving ? "#b7c6e0" : "#1e3a6e")}>{saving ? "Saving…" : editing ? "Update" : "Add Fee"}</button>
      </div>
    </>
  );

  return (
    <div>
      {showModal && <Modal title={editing ? "Edit Fee" : "Add Fee Structure"} onClose={() => setShowModal(false)} isMobile={isMobile}>{formContent}</Modal>}

      {isAdmin && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openAdd} style={S.btn()}>+ Add Fee</button>
      </div>}

      {courses.map(courseName => {
        const c      = COURSE_COLORS[courseName] || { color: "#2e3b52", bg: "#faf8f3", border: "#e8e3d8" };
        const cGroup = grouped[courseName];
        return (
          <div key={courseName} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "10px 14px", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: c.color }}>{courseName}</span>
              {cGroup
                ? <span style={{ fontSize: 12, color: c.color, opacity: 0.7 }}>{Object.values(cGroup).flatMap(sg => Object.values(sg).flat()).length} entries</span>
                : <span style={{ fontSize: 12, color: "#8a93a6" }}>No fees configured</span>
              }
            </div>
            {!cGroup ? null : Object.entries(cGroup).map(([subtype, hostelGroups]) => (
              <div key={subtype} style={{ marginBottom: 14, marginLeft: isMobile ? 0 : 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2e3b52", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                  {subtype === "—" ? "All Subtypes" : subtype}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginLeft: isMobile ? 0 : 14 }}>
                  {Object.entries(hostelGroups).map(([hostelType, entries]) => {
                    const hc   = HOSTEL_COLORS[hostelType] || { bg: "#faf8f3", color: "#2e3b52", border: "#e8e3d8" };
                    const icon = hostelType === "Boarder" ? "🛏️" : hostelType === "Day Boarder" ? "🌅" : hostelType === "Day Scholar" ? "🚶" : "🏫";
                    return (
                      <div key={hostelType} style={{ background: "white", border: `1.5px solid ${hc.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ background: hc.bg, padding: "8px 12px", borderBottom: `1px solid ${hc.border}` }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: hc.color }}>{icon} {hostelType === "All" ? "All Types" : hostelType}</span>
                        </div>
                        {entries.map(f => (
                          <div key={f.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f3f0e8", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: "#16A34A" }}>₹{f.amount?.toLocaleString("en-IN")}</div>
                              <div style={{ fontSize: 11, color: "#5d6b82", marginTop: 2 }}>
                                {f.fee_type}
                                {f.session_year     && ` · ${f.session_year}`}
                                {f.due_day          && ` · Due: ${f.due_day}th`}
                                {f.discount_percent && ` · ${f.discount_percent}% off`}
                              </div>
                              {f.notes && <div style={{ fontSize: 11, color: "#8a93a6", fontStyle: "italic" }}>{f.notes}</div>}
                            </div>
                            {isAdmin && <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button onClick={() => openEdit(f)} style={S.btn("#f3f0e8", "#2e3b52", { padding: "3px 8px", fontSize: 11 })}>Edit</button>
                              <button onClick={() => del(f.id)}   style={S.btn("white", "#DC2626", { border: "1px solid #FECACA", padding: "3px 8px", fontSize: 11 })}>✕</button>
                            </div>}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
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
    enrollments: <EnrollmentsSection {...sectionProps} />,
    fees:        <FeesSection        {...sectionProps} />,
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