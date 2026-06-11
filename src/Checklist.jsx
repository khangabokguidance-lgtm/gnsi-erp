import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE DETECTION — production-grade, single source of truth
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical role resolver.
 * Maps any raw role string from staff_profiles → one of: "admin" | "incharge" | "staff"
 * Never trust portalUser.role directly — always resolve through here.
 */
const ROLE_MAP = {
  // Admin variants
  admin:             "admin",
  administrator:     "admin",
  "super admin":     "admin",
  superadmin:        "admin",
  principal:         "admin",
  director:          "admin",
  "teaching + admin":"admin",
  // Incharge variants
  incharge:          "incharge",
  "in-charge":       "incharge",
  "in charge":       "incharge",
  manager:           "incharge",
  coordinator:       "incharge",
  hod:               "incharge",
  "head of department": "incharge",
  supervisor:        "incharge",
  superintendent:    "incharge",
  // Everything else → staff
};

function resolveRole(rawRole) {
  if (!rawRole) return "staff";
  return ROLE_MAP[rawRole.toLowerCase().trim()] || "staff";
}

/**
 * Resolve the active user from portalUser + staff_profiles data.
 * Returns a normalized user object with guaranteed { id, name, role, department }.
 *
 * Priority:
 *  1. staff_profile_id match (most reliable)
 *  2. email match
 *  3. name match (fallback)
 *  4. synthetic admin object if portal role is admin
 */
function resolveActiveUser(portalUser, staffList) {
  const portalRole = resolveRole(portalUser?.role);

  // Synthetic admin — no staff profile needed
  if (portalRole === "admin" && !portalUser?.staff_profile_id) {
    return {
      id:          0,
      name:        portalUser?.name || "Administrator",
      role:        "admin",
      department:  portalUser?.department || "Administration",
      designation: "Administrator",
      email:       portalUser?.email || "",
      isSynthetic: true,
    };
  }

  // Try to find matching staff profile
  let match = null;

  if (portalUser?.staff_profile_id) {
    match = staffList.find(s => s.id === portalUser.staff_profile_id);
  }
  if (!match && portalUser?.email) {
    match = staffList.find(s => s.email?.toLowerCase() === portalUser.email?.toLowerCase());
  }
  if (!match && portalUser?.name) {
    match = staffList.find(s => s.name?.toLowerCase() === portalUser.name?.toLowerCase());
  }

  if (!match) return null; // caller handles this

  // Portal role overrides DB role when portal says admin/incharge
  // but DB says staff — portal role is the authority for access level
  const dbRole    = resolveRole(match.role);
  const finalRole = portalRole === "admin" ? "admin"
                  : portalRole === "incharge" ? "incharge"
                  : dbRole;

  return {
    id:          match.id,
    name:        match.name,
    role:        finalRole,
    department:  match.department || "General",
    designation: match.designation || "",
    email:       match.email || "",
    phone:       match.phone || "",
    isSynthetic: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const PERMS = {
  canAssign:       u => u.role === "admin" || u.role === "incharge",
  canDelete:       (u, c) => u.role === "admin" || (u.role === "incharge" && c.department === u.department),
  canApprove:      u => u.role === "admin" || u.role === "incharge",
  canFinalize:     u => u.role === "admin" || u.role === "incharge",
  canViewAll:      u => u.role === "admin",
  canViewDept:     (u, c) => u.role === "incharge" && c.department === u.department,
  canSubmitStep:   (u, step, st) => u.role === "staff" && (st === "pending" || st === "in_progress" || st === "rejected"),
  canSwitchUser:   u => u.role === "admin",
  canViewMonitor:  u => u.role === "admin" || u.role === "incharge",
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXAM PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════
const EXAM_TYPES = ["Monthly Test", "Pre Mock Test", "Mega Mock Test"];

const PIPELINE_STEPS = {
  "Monthly Test": [
    { key: "syllabus_confirm", label: "Syllabus Confirmation",   icon: "📚", desc: "Confirm syllabus coverage and share with staff" },
    { key: "question_setting", label: "Question Paper Setting",  icon: "✏️",  desc: "Prepare and seal question paper" },
    { key: "printing",         label: "Printing & Packaging",    icon: "🖨️",  desc: "Print, collate and pack answer booklets" },
    { key: "conducting",       label: "Conducting Exam",         icon: "🏫", desc: "Supervise and conduct the examination" },
    { key: "collection",       label: "Script Collection",       icon: "📦", desc: "Collect and count all answer scripts" },
    { key: "evaluation",       label: "Paper Evaluation",        icon: "📝", desc: "Evaluate scripts and enter marks" },
    { key: "result_entry",     label: "Result Entry",            icon: "💻", desc: "Enter marks in portal / register" },
    { key: "report",           label: "Report & Sign-off",       icon: "📊", desc: "Prepare result report for authority" },
  ],
  "Pre Mock Test": [
    { key: "schedule",         label: "Schedule & Timetable",   icon: "🗓️",  desc: "Finalise exam schedule and assign invigilators" },
    { key: "question_setting", label: "Question Paper Setting", icon: "✏️",  desc: "Prepare mock-level question papers" },
    { key: "printing",         label: "Printing & Packaging",   icon: "🖨️",  desc: "Print, collate and pack" },
    { key: "seating_plan",     label: "Seating Arrangement",    icon: "🪑", desc: "Prepare seating chart for all students" },
    { key: "conducting",       label: "Conducting Exam",        icon: "🏫", desc: "Conduct under mock conditions" },
    { key: "collection",       label: "Script Collection",      icon: "📦", desc: "Collect and verify script count" },
    { key: "evaluation",       label: "Evaluation",             icon: "📝", desc: "Evaluate and record marks" },
    { key: "result_entry",     label: "Result Entry & Analysis",icon: "💻", desc: "Enter marks and prepare analysis" },
    { key: "report",           label: "Final Report & Sign-off",icon: "📊", desc: "Submit final pre-mock report" },
  ],
  "Mega Mock Test": [
    { key: "planning",         label: "Full Exam Planning",          icon: "🗺️",  desc: "Plan logistics, manpower, and venues" },
    { key: "schedule",         label: "Schedule & Communication",    icon: "🗓️",  desc: "Communicate schedule to all stakeholders" },
    { key: "question_setting", label: "Question Paper Setting",      icon: "✏️",  desc: "Prepare exam-standard question papers" },
    { key: "printing",         label: "Bulk Printing & Packing",     icon: "🖨️",  desc: "Large-scale printing with labelled packs" },
    { key: "seating_plan",     label: "Seating Plan",                icon: "🪑", desc: "Detailed seating for all batches" },
    { key: "invigilator",      label: "Invigilator Assignment",      icon: "👁️",  desc: "Assign and brief all invigilators" },
    { key: "conducting",       label: "Conducting Exam",             icon: "🏫", desc: "Full-day exam conduct with supervision" },
    { key: "collection",       label: "Script Collection & Count",   icon: "📦", desc: "Collect, count and pack all scripts" },
    { key: "evaluation",       label: "Evaluation",                  icon: "📝", desc: "Evaluate all scripts accurately" },
    { key: "result_entry",     label: "Result Entry",                icon: "💻", desc: "Enter all marks in portal" },
    { key: "analysis",         label: "Performance Analysis",        icon: "📈", desc: "Prepare subject-wise analysis report" },
    { key: "report",           label: "Final Sign-off & Report",     icon: "📊", desc: "Submit comprehensive exam report to admin" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE LAYER
// ═══════════════════════════════════════════════════════════════════════════════
const db = {
  async getStaffProfiles() {
    const { data, error } = await supabase
      .from("staff_profiles")
      .select("id, name, role, department, designation, phone, email, status")
      .eq("status", "Active")
      .order("name");
    if (error) throw error;
    return data || [];
  },

  async getExamChecklists(user) {
    let q = supabase.from("exam_checklists").select("*").order("created_at", { ascending: false });
    if (user.role === "staff")   q = q.eq("assigned_to_id", user.id);
    else if (user.role === "incharge") q = q.eq("department", user.department);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async createExamChecklist(payload) {
    const { data, error } = await supabase
      .from("exam_checklists").insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  async updateExamChecklist(id, changes) {
    const { data, error } = await supabase
      .from("exam_checklists")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteExamChecklist(id) {
    const { error } = await supabase.from("exam_checklists").delete().eq("id", id);
    if (error) throw error;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// THEME & DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
const DEPARTMENTS = ["Administration","Academic","Accounts","Hostel","Reception","Transport","Maintenance"];

const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtTime = d => d ? new Date(d).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—";
const initials = n => n?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "?";

// Color palette — institution blue + exam-specific accents
const C = {
  // Neutrals
  bg:       "#f5f7fa",
  surface:  "#ffffff",
  surface2: "#f1f4f8",
  border:   "#e3e8ef",
  // Brand
  brand:    "#1e40af",
  brandMid: "#2563eb",
  brandSoft:"#dbeafe",
  // Semantic
  success:  "#16a34a",
  successSoft: "#f0fdf4",
  warn:     "#d97706",
  warnSoft: "#fffbeb",
  danger:   "#dc2626",
  dangerSoft:"#fef2f2",
  info:     "#0284c7",
  infoSoft: "#e0f2fe",
  // Text
  text:     "#0f172a",
  textMid:  "#475569",
  textDim:  "#94a3b8",
  // Shadows
  shadow:   "0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04)",
  shadowMd: "0 4px 16px rgba(0,0,0,.09)",
  shadowLg: "0 20px 60px rgba(0,0,0,.18)",
};

const EXAM_META = {
  "Monthly Test":   { color: "#0284c7", soft: "#e0f2fe", icon: "📋", grad: "linear-gradient(135deg,#0284c7,#0ea5e9)" },
  "Pre Mock Test":  { color: "#7c3aed", soft: "#ede9fe", icon: "🎯", grad: "linear-gradient(135deg,#7c3aed,#8b5cf6)" },
  "Mega Mock Test": { color: "#b45309", soft: "#fef3c7", icon: "🏆", grad: "linear-gradient(135deg,#b45309,#d97706)" },
};

const STEP_META = {
  pending:     { color: "#94a3b8", soft: "#f1f5f9", label: "Pending",     dot: "#cbd5e1" },
  in_progress: { color: "#0284c7", soft: "#e0f2fe", label: "In Progress", dot: "#0284c7" },
  submitted:   { color: "#d97706", soft: "#fffbeb", label: "Submitted",   dot: "#d97706" },
  approved:    { color: "#16a34a", soft: "#f0fdf4", label: "Approved",    dot: "#16a34a" },
  rejected:    { color: "#dc2626", soft: "#fef2f2", label: "Rejected",    dot: "#dc2626" },
};

const ROLE_DISPLAY = {
  admin:    { label: "Admin",      color: "#4f46e5", soft: "#eef2ff" },
  incharge: { label: "In-charge",  color: "#0284c7", soft: "#e0f2fe" },
  staff:    { label: "Staff",      color: "#16a34a", soft: "#f0fdf4" },
};

const F = { xs:12, sm:13, base:14, md:15, lg:17, xl:20, xxl:24, hero:28 };

// Style helpers
const s = {
  card: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 14, overflow: "hidden", boxShadow: C.shadow,
  },
  input: {
    width: "100%", padding: "10px 13px", background: C.surface,
    border: `1.5px solid ${C.border}`, borderRadius: 9, color: C.text,
    fontSize: F.base, boxSizing: "border-box", fontFamily: "inherit",
    outline: "none", lineHeight: 1.5,
  },
  label: {
    display: "block", fontSize: F.xs, fontWeight: 700, color: C.textMid,
    textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 5,
  },
  btn: (bg = C.brand, fg = "white") => ({
    background: bg, color: fg, border: "none", borderRadius: 9,
    padding: "10px 18px", fontWeight: 700, cursor: "pointer",
    fontSize: F.base, fontFamily: "inherit", lineHeight: 1,
  }),
  btnSm: (bg = C.brand) => ({
    background: bg, color: "white", border: "none", borderRadius: 7,
    padding: "7px 13px", fontWeight: 700, cursor: "pointer",
    fontSize: F.sm, fontFamily: "inherit", whiteSpace: "nowrap",
  }),
  btnGhost: {
    background: "none", border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: "9px 14px", fontWeight: 600, cursor: "pointer",
    fontSize: F.sm, fontFamily: "inherit", color: C.textMid,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════════════════

function RoleBadge({ role }) {
  const r = ROLE_DISPLAY[role] || ROLE_DISPLAY.staff;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 99, fontSize: F.xs, fontWeight: 700,
      background: r.soft, color: r.color, border: `1px solid ${r.color}25`,
    }}>
      {role === "admin" ? "⬡" : role === "incharge" ? "◈" : "○"} {r.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const m = STEP_META[status] || STEP_META.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 99, fontSize: F.xs, fontWeight: 700,
      background: m.soft, color: m.color, border: `1px solid ${m.color}25`,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, display: "inline-block", flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function Avatar({ name, role, size = 36 }) {
  const r = ROLE_DISPLAY[role] || ROLE_DISPLAY.staff;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: r.soft, border: `2px solid ${r.color}35`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 800, color: r.color, flexShrink: 0,
      letterSpacing: -0.5,
    }}>
      {initials(name)}
    </div>
  );
}

function Toast({ msg, type = "success" }) {
  if (!msg) return null;
  const colors = { success: C.success, error: C.danger, info: C.info, warn: C.warn };
  const icons  = { success: "✓", error: "✕", info: "i", warn: "!" };
  const c = colors[type] || C.info;
  return (
    <div style={{
      position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, background: C.surface, borderRadius: 11,
      boxShadow: C.shadowMd, fontSize: F.base, fontWeight: 700,
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 20px", maxWidth: "90vw",
      border: `1.5px solid ${c}30`, borderLeft: `4px solid ${c}`,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%", background: `${c}18`,
        color: c, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: F.sm, fontWeight: 900, flexShrink: 0,
      }}>{icons[type]}</span>
      <span style={{ color: C.text }}>{msg}</span>
    </div>
  );
}

function Spinner({ size = 22 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48, gap: 12, color: C.textMid }}>
      <div style={{
        width: size, height: size,
        border: `2.5px solid ${C.border}`, borderTop: `2.5px solid ${C.brand}`,
        borderRadius: "50%", animation: "spin .65s linear infinite",
      }} />
      <span style={{ fontSize: F.base }}>Loading…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{
      background: C.dangerSoft, border: `1.5px solid ${C.danger}30`,
      borderRadius: 12, padding: "18px 20px",
      display: "flex", alignItems: "flex-start", gap: 14,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: C.danger, fontSize: F.md, marginBottom: 4 }}>
          Could not load your profile
        </div>
        <div style={{ fontSize: F.sm, color: C.textMid, marginBottom: 12, lineHeight: 1.6 }}>
          {message}
        </div>
        {onRetry && (
          <button onClick={onRetry} style={{ ...s.btn(C.danger), padding: "8px 16px", fontSize: F.sm }}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE BAR
// ═══════════════════════════════════════════════════════════════════════════════
function PipelineBar({ steps, stepData, compact = false, light = false }) {
  const approved = steps.filter(s => stepData?.[s.key]?.status === "approved").length;
  const pct = steps.length > 0 ? Math.round((approved / steps.length) * 100) : 0;
  const barColor = pct === 100 ? C.success : pct >= 60 ? C.info : pct >= 30 ? C.warn : C.textDim;
  const textColor = light ? "rgba(255,255,255,.8)" : C.textMid;
  const trackColor = light ? "rgba(255,255,255,.2)" : C.surface2;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: F.xs, color: textColor }}>
          {approved}/{steps.length} steps approved
        </span>
        <span style={{ fontSize: F.xs, fontWeight: 800, color: light ? "white" : barColor }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: compact ? 4 : 6, borderRadius: 99, background: trackColor, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: light ? "white" : barColor,
          borderRadius: 99, transition: "width .4s ease", opacity: light ? 0.9 : 1,
        }} />
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 4, marginTop: 9, flexWrap: "wrap" }}>
          {steps.map(step => {
            const st = stepData?.[step.key]?.status || "pending";
            const m  = STEP_META[st];
            return (
              <div
                key={step.key}
                title={`${step.label}: ${m.label}`}
                style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: m.dot, flexShrink: 0,
                  opacity: st === "pending" ? (light ? 0.35 : 0.22) : 1,
                  transition: "opacity .2s",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP ROW
// ═══════════════════════════════════════════════════════════════════════════════
function StepRow({ step, stepState, isActive, isLocked, currentUser, onSubmitStep, onApproveStep, onRejectStep }) {
  const [expanded, setExpanded] = useState(false);
  const [note,     setNote]     = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving,   setSaving]   = useState(false);

  const st = stepState?.status || "pending";
  const m  = STEP_META[st];

  const canSubmit  = PERMS.canSubmitStep(currentUser, step, st) && isActive;
  const canApprove = PERMS.canApprove(currentUser) && st === "submitted";

  const doSubmit = async () => {
    if (!note.trim()) { alert("Add a completion note before submitting."); return; }
    setSaving(true);
    try { await onSubmitStep(step.key, note); setNote(""); setExpanded(false); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const doApprove = async () => {
    setSaving(true);
    try { await onApproveStep(step.key, feedback); setFeedback(""); setExpanded(false); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const doReject = async () => {
    if (!feedback.trim()) { alert("Provide a rejection reason."); return; }
    setSaving(true);
    try { await onRejectStep(step.key, feedback); setFeedback(""); setExpanded(false); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const borderColor = st === "approved" ? "#bbf7d0"
    : st === "rejected" ? "#fecaca"
    : st === "submitted" ? "#fde68a"
    : isActive ? `${C.brand}55`
    : C.border;

  const headerBg = st === "approved" ? "#f0fdf4"
    : st === "submitted" ? "#fffbeb"
    : isActive ? `${C.brand}06`
    : "transparent";

  return (
    <div style={{
      border: `1.5px solid ${borderColor}`, borderRadius: 11,
      overflow: "hidden",
      background: isLocked ? "#fafafa" : C.surface,
      opacity: isLocked ? 0.5 : 1,
      transition: "opacity .15s",
    }}>
      {/* Header */}
      <div
        onClick={() => !isLocked && setExpanded(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 11,
          padding: "11px 14px", cursor: isLocked ? "default" : "pointer",
          background: headerBg,
        }}
      >
        {/* Step icon */}
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: m.soft, border: `1.5px solid ${m.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17, flexShrink: 0,
        }}>
          {step.icon}
        </div>

        {/* Label + desc */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: F.md, fontWeight: 700, color: C.text }}>{step.label}</span>
            {isActive && st !== "approved" && (
              <span style={{
                fontSize: F.xs, color: C.brand, fontWeight: 700,
                background: `${C.brand}12`, padding: "2px 8px", borderRadius: 99,
              }}>Active</span>
            )}
          </div>
          <div style={{ fontSize: F.xs, color: C.textMid, marginTop: 1 }}>{step.desc}</div>
        </div>

        {/* Status + chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <StatusBadge status={st} />
          {!isLocked && (
            <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>
              {expanded ? "▲" : "▼"}
            </span>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && !isLocked && (
        <div style={{
          padding: "13px 14px 15px",
          borderTop: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", gap: 11,
          background: C.surface,
        }}>
          {/* Staff note */}
          {stepState?.note && (
            <div style={{
              background: `${C.info}08`, border: `1px solid ${C.info}25`,
              borderRadius: 9, padding: "10px 13px",
            }}>
              <div style={{ fontSize: F.xs, color: C.textMid, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                Staff Note
              </div>
              <div style={{ fontSize: F.base, color: C.text, lineHeight: 1.65 }}>
                "{stepState.note}"
              </div>
              {stepState.submitted_at && (
                <div style={{ fontSize: F.xs, color: C.textDim, marginTop: 5 }}>
                  Submitted {fmtTime(stepState.submitted_at)} by {stepState.submitted_by}
                </div>
              )}
            </div>
          )}

          {/* Feedback note */}
          {stepState?.feedback && (
            <div style={{
              background: st === "rejected" ? C.dangerSoft : C.successSoft,
              border: `1px solid ${st === "rejected" ? "#fecaca" : "#bbf7d0"}`,
              borderRadius: 9, padding: "10px 13px",
            }}>
              <div style={{ fontSize: F.xs, color: C.textMid, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                {st === "rejected" ? "Rejection Reason" : "Approval Note"}
              </div>
              <div style={{ fontSize: F.base, color: st === "rejected" ? C.danger : C.success, lineHeight: 1.65 }}>
                {stepState.feedback}
              </div>
              {stepState.reviewed_at && (
                <div style={{ fontSize: F.xs, color: C.textDim, marginTop: 5 }}>
                  by {stepState.reviewed_by} · {fmtTime(stepState.reviewed_at)}
                </div>
              )}
            </div>
          )}

          {/* Staff: submit */}
          {canSubmit && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={s.label}>Completion note *</label>
                <textarea
                  style={{ ...s.input, resize: "vertical", minHeight: 70 }}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={`Describe what was completed for "${step.label}"…`}
                />
              </div>
              <button
                onClick={doSubmit}
                disabled={saving || !note.trim()}
                style={{ ...s.btn("#059669"), opacity: saving || !note.trim() ? 0.55 : 1 }}
              >
                {saving ? "Submitting…" : "📤 Submit for Approval"}
              </button>
            </div>
          )}

          {/* Admin/Incharge: approve or reject */}
          {canApprove && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={s.label}>
                  Feedback
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 5 }}>
                    (optional for approval, required for rejection)
                  </span>
                </label>
                <textarea
                  style={{ ...s.input, resize: "vertical", minHeight: 58 }}
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Add feedback or rejection reason…"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={doApprove} disabled={saving} style={{ flex: 1, ...s.btn("#059669") }}>
                  ✅ Approve
                </button>
                <button onClick={doReject} disabled={saving} style={{ flex: 1, ...s.btn(C.danger) }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          )}

          {/* Waiting state */}
          {currentUser.role === "staff" && st === "submitted" && (
            <div style={{
              fontSize: F.sm, color: C.warn, fontWeight: 600,
              background: C.warnSoft, border: `1px solid #fde68a`,
              borderRadius: 8, padding: "9px 12px",
            }}>
              ⏳ Awaiting approval from in-charge / admin…
            </div>
          )}

          {/* Approved summary */}
          {st === "approved" && (
            <div style={{
              fontSize: F.sm, color: C.success, fontWeight: 700,
              background: C.successSoft, border: "1px solid #bbf7d0",
              borderRadius: 8, padding: "9px 12px",
            }}>
              ✅ Approved by {stepState?.reviewed_by} · {fmtTime(stepState?.reviewed_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLIST DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ChecklistDetailModal({ checklist, currentUser, onClose, onUpdate, isMobile }) {
  const steps    = PIPELINE_STEPS[checklist.exam_type] || [];
  const stepData = checklist.step_data || {};
  const [saving, setSaving] = useState(false);

  const activeIdx = steps.findIndex(s => stepData[s.key]?.status !== "approved");
  const activeKey = activeIdx >= 0 ? steps[activeIdx]?.key : null;
  const allDone   = activeIdx === -1;
  const isFinalized = checklist.status === "finalized";
  const examMeta  = EXAM_META[checklist.exam_type] || EXAM_META["Monthly Test"];

  const updateStepData = async (newStepData, extra = {}) => {
    const updated = await db.updateExamChecklist(checklist.id, { step_data: newStepData, ...extra });
    onUpdate(updated);
  };

  const handleSubmitStep = useCallback(async (key, note) => {
    const newSD = {
      ...stepData,
      [key]: { ...(stepData[key] || {}), status: "submitted", note, submitted_at: new Date().toISOString(), submitted_by: currentUser.name },
    };
    await updateStepData(newSD);
  }, [stepData, currentUser]);

  const handleApproveStep = useCallback(async (key, feedback) => {
    const updated = { ...(stepData[key] || {}), status: "approved", feedback, reviewed_by: currentUser.name, reviewed_at: new Date().toISOString() };
    const newSD = { ...stepData, [key]: updated };
    const allApproved = steps.every(s => (s.key === key ? true : newSD[s.key]?.status === "approved"));
    await updateStepData(newSD, allApproved ? { status: "completed" } : {});
  }, [stepData, steps, currentUser]);

  const handleRejectStep = useCallback(async (key, feedback) => {
    const newSD = {
      ...stepData,
      [key]: { ...(stepData[key] || {}), status: "rejected", feedback, reviewed_by: currentUser.name, reviewed_at: new Date().toISOString() },
    };
    await updateStepData(newSD);
  }, [stepData, currentUser]);

  const handleFinalize = async () => {
    if (!allDone) { alert("All steps must be approved before final sign-off."); return; }
    if (!PERMS.canFinalize(currentUser)) { alert("You don't have permission to finalize."); return; }
    setSaving(true);
    try {
      const updated = await db.updateExamChecklist(checklist.id, {
        status: "finalized", finalized_by: currentUser.name, finalized_at: new Date().toISOString(),
      });
      onUpdate(updated);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,.55)",
        backdropFilter: "blur(5px)", zIndex: 2000,
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        ...s.card,
        width: "100%", maxWidth: 660,
        maxHeight: isMobile ? "95vh" : "90vh",
        display: "flex", flexDirection: "column",
        borderRadius: isMobile ? "18px 18px 0 0" : 16,
        boxShadow: C.shadowLg,
      }}>
        {/* Header */}
        <div style={{ background: examMeta.grad, padding: "16px 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <span style={{ fontSize: 18 }}>{examMeta.icon}</span>
                <span style={{ fontSize: F.xs, color: "rgba(255,255,255,.75)", fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>
                  {checklist.exam_type}
                </span>
                {isFinalized && (
                  <span style={{ fontSize: F.xs, background: "rgba(255,255,255,.2)", color: "white", padding: "2px 9px", borderRadius: 99, fontWeight: 700 }}>
                    ✅ Finalized
                  </span>
                )}
              </div>
              <div style={{ fontSize: F.xl, fontWeight: 800, color: "white", lineHeight: 1.2, marginBottom: 5 }}>
                {checklist.title}
              </div>
              <div style={{ fontSize: F.sm, color: "rgba(255,255,255,.8)" }}>
                Assigned to: <b>{checklist.assigned_to_name}</b> · {checklist.department}
              </div>
              {checklist.exam_date && (
                <div style={{ fontSize: F.xs, color: "rgba(255,255,255,.7)", marginTop: 3 }}>
                  📅 Exam Date: {fmtDate(checklist.exam_date)}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,.18)", border: "none", color: "white",
                borderRadius: 9, width: 36, height: 36, cursor: "pointer", fontSize: 18, flexShrink: 0,
              }}
            >✕</button>
          </div>
          <div style={{ marginTop: 14 }}>
            <PipelineBar steps={steps} stepData={stepData} light />
          </div>
        </div>

        {/* Steps list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {isFinalized && (
            <div style={{
              background: C.successSoft, border: "2px solid #16a34a",
              borderRadius: 12, padding: "16px 18px", textAlign: "center", marginBottom: 4,
            }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>🎉</div>
              <div style={{ fontSize: F.lg, fontWeight: 800, color: C.success }}>
                Exam Fully Completed & Signed Off
              </div>
              <div style={{ fontSize: F.sm, color: C.textMid, marginTop: 4 }}>
                By {checklist.finalized_by} · {fmtTime(checklist.finalized_at)}
              </div>
            </div>
          )}

          {steps.map((step, idx) => (
            <StepRow
              key={step.key}
              step={step}
              stepState={stepData[step.key]}
              isActive={step.key === activeKey}
              isLocked={idx > activeIdx && activeIdx !== -1}
              currentUser={currentUser}
              onSubmitStep={handleSubmitStep}
              onApproveStep={handleApproveStep}
              onRejectStep={handleRejectStep}
            />
          ))}
        </div>

        {/* Footer */}
        {!isFinalized && PERMS.canFinalize(currentUser) && (
          <div style={{ padding: "12px 16px 18px", borderTop: `1px solid ${C.border}`, background: C.surface2, flexShrink: 0 }}>
            {allDone ? (
              <button
                onClick={handleFinalize}
                disabled={saving}
                style={{ ...s.btn("#059669"), width: "100%", fontSize: F.lg, padding: "14px 20px", fontWeight: 800, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Finalizing…" : "🏁 Final Sign-off — Complete Exam Checklist"}
              </button>
            ) : (
              <div style={{ fontSize: F.sm, color: C.textMid, textAlign: "center", padding: "4px 0" }}>
                Approve all {steps.length} steps to enable final sign-off
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function AssignModal({ currentUser, staffList, onClose, onSave }) {
  const [mode,       setMode]       = useState("single");
  const [examType,   setExamType]   = useState("Monthly Test");
  const [title,      setTitle]      = useState("");
  const [examDate,   setExamDate]   = useState("");
  const [dept,       setDept]       = useState(currentUser.department || "Academic");
  const [assignedTo, setAssignedTo] = useState("");
  const [bulkIds,    setBulkIds]    = useState([]);
  const [saving,     setSaving]     = useState(false);

  const eligible = useMemo(() => {
    if (currentUser.role === "incharge")
      return staffList.filter(s => resolveRole(s.role) === "staff" && s.department === currentUser.department);
    return staffList.filter(s => resolveRole(s.role) !== "admin");
  }, [staffList, currentUser]);

  const toggleBulk = id => setBulkIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleSave = async () => {
    const baseTitle = title.trim() || `${examType} Checklist`;
    const targets = mode === "bulk"
      ? bulkIds.map(id => staffList.find(s => s.id === id)).filter(Boolean)
      : [staffList.find(s => s.id === +assignedTo)].filter(Boolean);

    if (!targets.length) { alert("Select at least one staff member."); return; }
    setSaving(true);
    try {
      const results = [];
      for (const staff of targets) {
        const rec = await db.createExamChecklist({
          exam_type:        examType,
          title:            mode === "bulk" ? `${baseTitle} — ${staff.name}` : baseTitle,
          department:       staff.department || dept,
          assigned_to_id:   staff.id,
          assigned_to_name: staff.name,
          assigned_by:      currentUser.name,
          exam_date:        examDate || null,
          status:           "active",
          step_data:        {},
          created_at:       new Date().toISOString(),
        });
        results.push(rec);
      }
      onSave(results);
      onClose();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const examMeta = EXAM_META[examType];
  const canSave  = mode === "single" ? !!assignedTo : bulkIds.length > 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,.5)",
        backdropFilter: "blur(4px)", zIndex: 2000,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        ...s.card, width: "100%", maxWidth: 580,
        maxHeight: "95vh", display: "flex", flexDirection: "column",
        borderRadius: "16px 16px 0 0", boxShadow: "0 -8px 36px rgba(0,0,0,.14)",
      }}>
        <div style={{
          background: `linear-gradient(135deg,${C.brand},${C.brandMid})`,
          padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: F.xs, color: "rgba(255,255,255,.7)", textTransform: "uppercase", letterSpacing: 1 }}>
              New Assignment
            </div>
            <div style={{ fontSize: F.lg, fontWeight: 800, color: "white" }}>Assign Exam Checklist</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "white", borderRadius: 9, width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", background: C.surface2, borderRadius: 10, padding: 3, border: `1px solid ${C.border}`, gap: 3 }}>
            {[["single", "👤 Single Staff"], ["bulk", "👥 Bulk Assign"]].map(([m, l]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: "9px 8px", borderRadius: 8,
                  border: mode === m ? `1px solid ${C.border}` : "none",
                  background: mode === m ? C.surface : "none",
                  color: mode === m ? C.text : C.textMid,
                  fontWeight: mode === m ? 700 : 500,
                  cursor: "pointer", fontSize: F.sm, fontFamily: "inherit",
                  boxShadow: mode === m ? C.shadow : "none",
                }}
              >{l}</button>
            ))}
          </div>

          {/* Exam type */}
          <div>
            <label style={s.label}>Exam Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {EXAM_TYPES.map(et => {
                const m = EXAM_META[et];
                const sel = examType === et;
                return (
                  <button
                    key={et}
                    onClick={() => setExamType(et)}
                    style={{
                      padding: "12px 6px", borderRadius: 11,
                      border: `2px solid ${sel ? m.color : C.border}`,
                      background: sel ? m.soft : C.surface,
                      cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 20 }}>{m.icon}</div>
                    <div style={{ fontSize: F.xs, fontWeight: 700, color: sel ? m.color : C.textMid, marginTop: 4, lineHeight: 1.3 }}>{et}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={s.label}>
              Checklist Title
              {mode === "bulk" && <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 5 }}>(staff name auto-appended)</span>}
            </label>
            <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} placeholder={`e.g. ${examType} — June 2025`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={s.label}>Exam Date</label>
              <input type="date" style={s.input} value={examDate} onChange={e => setExamDate(e.target.value)} />
            </div>
            {currentUser.role === "admin" && (
              <div>
                <label style={s.label}>Department</label>
                <select style={s.input} value={dept} onChange={e => setDept(e.target.value)}>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>

          {mode === "single" && (
            <div>
              <label style={s.label}>Assign To</label>
              <select style={s.input} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">— Select Staff —</option>
                {eligible.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation || s.department}</option>)}
              </select>
            </div>
          )}

          {mode === "bulk" && (
            <div>
              <label style={s.label}>Select Staff ({bulkIds.length} selected)</label>
              <div style={{
                display: "flex", flexDirection: "column", gap: 6,
                maxHeight: 210, overflowY: "auto",
                border: `1px solid ${C.border}`, borderRadius: 9, padding: 9,
              }}>
                <button
                  onClick={() => setBulkIds(bulkIds.length === eligible.length ? [] : eligible.map(s => s.id))}
                  style={{ ...s.btnGhost, fontSize: F.xs, marginBottom: 3 }}
                >
                  {bulkIds.length === eligible.length ? "Deselect All" : "Select All"}
                </button>
                {eligible.map(staff => (
                  <label key={staff.id} style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                    border: `1.5px solid ${bulkIds.includes(staff.id) ? C.brand : C.border}`,
                    background: bulkIds.includes(staff.id) ? `${C.brand}08` : C.surface,
                  }}>
                    <input type="checkbox" checked={bulkIds.includes(staff.id)} onChange={() => toggleBulk(staff.id)} style={{ width: 15, height: 15, accentColor: C.brand }} />
                    <Avatar name={staff.name} role={resolveRole(staff.role)} size={26} />
                    <div>
                      <div style={{ fontSize: F.sm, fontWeight: 600, color: C.text }}>{staff.name}</div>
                      <div style={{ fontSize: F.xs, color: C.textMid }}>{staff.designation || ""} · {staff.department}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 18px 22px", borderTop: `1px solid ${C.border}`, background: C.surface2, flexShrink: 0 }}>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            style={{
              width: "100%", background: `linear-gradient(135deg,${C.brand},${C.brandMid})`,
              color: "white", border: "none", borderRadius: 11, padding: "14px 20px",
              fontWeight: 800, fontSize: F.base, fontFamily: "inherit", cursor: "pointer",
              opacity: saving || !canSave ? 0.55 : 1,
            }}
          >
            {saving ? "Assigning…"
              : mode === "bulk" ? `✅ Assign to ${bulkIds.length} Staff Member${bulkIds.length !== 1 ? "s" : ""}`
              : "✅ Assign Checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLIST CARD
// ═══════════════════════════════════════════════════════════════════════════════
function ChecklistCard({ checklist, currentUser, onOpen, onDelete }) {
  const steps    = PIPELINE_STEPS[checklist.exam_type] || [];
  const stepData = checklist.step_data || {};
  const meta     = EXAM_META[checklist.exam_type] || EXAM_META["Monthly Test"];

  const isFinalized    = checklist.status === "finalized";
  const isCompleted    = checklist.status === "completed" || isFinalized;
  const pendingReview  = steps.some(s => stepData[s.key]?.status === "submitted");
  const approved       = steps.filter(s => stepData[s.key]?.status === "approved").length;
  const activeIdx      = steps.findIndex(s => stepData[s.key]?.status !== "approved");
  const activeStep     = activeIdx >= 0 ? steps[activeIdx] : null;
  const canDel         = PERMS.canDelete(currentUser, checklist);

  const borderColor = isFinalized ? C.success : pendingReview ? C.warn : isCompleted ? "#86efac" : C.border;

  return (
    <div style={{
      background: C.surface,
      border: `2px solid ${borderColor}`,
      borderRadius: 14, overflow: "hidden",
      boxShadow: C.shadow, display: "flex", flexDirection: "column",
    }}>
      <div style={{ height: 3, background: meta.grad }} />

      <div style={{ padding: "14px 15px", flex: 1 }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: meta.soft, border: `1.5px solid ${meta.color}25`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>{meta.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
              <span style={{
                fontSize: F.xs, fontWeight: 700, color: meta.color,
                background: meta.soft, padding: "2px 9px", borderRadius: 99,
                border: `1px solid ${meta.color}20`,
              }}>{checklist.exam_type}</span>
              {isFinalized && <span style={{ fontSize: F.xs, fontWeight: 700, color: C.success, background: C.successSoft, padding: "2px 9px", borderRadius: 99 }}>✅ Finalized</span>}
              {pendingReview && !isFinalized && <span style={{ fontSize: F.xs, fontWeight: 700, color: C.warn, background: C.warnSoft, padding: "2px 9px", borderRadius: 99 }}>⏳ Review needed</span>}
            </div>
            <div style={{ fontSize: F.md, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{checklist.title}</div>
            <div style={{ fontSize: F.xs, color: C.textMid, marginTop: 3 }}>
              👤 {checklist.assigned_to_name} · {checklist.department}
            </div>
          </div>
        </div>

        <PipelineBar steps={steps} stepData={stepData} compact />

        {activeStep && !isFinalized && (
          <div style={{
            marginTop: 10, fontSize: F.sm, color: C.textMid,
            background: C.surface2, borderRadius: 8,
            padding: "8px 11px", border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <span style={{ fontSize: 14 }}>{activeStep.icon}</span>
            <span><b>Current:</b> {activeStep.label}</span>
          </div>
        )}

        {checklist.exam_date && (
          <div style={{ marginTop: 8, fontSize: F.xs, color: C.textDim }}>
            📅 {fmtDate(checklist.exam_date)} · Assigned by {checklist.assigned_by}
          </div>
        )}
      </div>

      <div style={{ padding: "9px 15px 13px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 7, background: C.surface2 }}>
        <button
          onClick={() => onOpen(checklist)}
          style={{
            flex: 1, ...s.btn(isFinalized ? C.success : pendingReview ? C.warn : C.brand),
            padding: "10px 14px", fontSize: F.sm,
          }}
        >
          {isFinalized ? "🏆 View" : `${approved}/${steps.length} Steps — Open`}
        </button>
        {canDel && !isFinalized && (
          <button
            onClick={() => onDelete(checklist.id)}
            style={{ ...s.btnSm("#ef4444"), padding: "10px 11px", fontSize: F.sm }}
          >🗑</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardView({ currentUser, checklists, isMobile }) {
  const stats = useMemo(() => {
    const total     = checklists.length;
    const finalized = checklists.filter(c => c.status === "finalized").length;
    const active    = checklists.filter(c => c.status === "active").length;
    const completed = checklists.filter(c => c.status === "completed").length;
    const pending   = checklists.filter(c => {
      const steps = PIPELINE_STEPS[c.exam_type] || [];
      return steps.some(s => c.step_data?.[s.key]?.status === "submitted");
    }).length;
    return { total, finalized, active, completed, pending };
  }, [checklists]);

  const byType = EXAM_TYPES.map(et => ({
    type: et, meta: EXAM_META[et],
    count: checklists.filter(c => c.exam_type === et).length,
    done:  checklists.filter(c => c.exam_type === et && c.status === "finalized").length,
  }));

  const recentActivity = useMemo(() => checklists
    .flatMap(c => {
      const steps = PIPELINE_STEPS[c.exam_type] || [];
      return steps
        .filter(s => c.step_data?.[s.key]?.submitted_at || c.step_data?.[s.key]?.reviewed_at)
        .map(s => ({
          checklist: c, step: s, sd: c.step_data[s.key],
          time: c.step_data[s.key]?.reviewed_at || c.step_data[s.key]?.submitted_at,
        }));
    })
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5)
  , [checklists]);

  const statCards = [
    { label: "Total",          value: stats.total,              color: C.info,    icon: "📋" },
    { label: "Active",         value: stats.active,             color: C.brand,   icon: "▶" },
    { label: "Completed",      value: stats.completed + stats.finalized, color: C.success, icon: "✅" },
    { label: "Needs Review",   value: stats.pending,            color: C.warn,    icon: "⏳" },
    { label: "Finalized",      value: stats.finalized,          color: "#059669", icon: "🏆" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: F.xxl, fontWeight: 800, color: C.text, marginBottom: 3 }}>
          {currentUser.role === "staff" ? "My Checklists"
            : currentUser.role === "incharge" ? `${currentUser.department} — Dashboard`
            : "Exam Checklist Dashboard"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: F.base, color: C.textMid }}>Welcome back, {currentUser.name}</span>
          <RoleBadge role={currentUser.role} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(5,1fr)", gap: 10 }}>
        {statCards.map(c => (
          <div key={c.label} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 13, padding: isMobile ? "12px 8px" : "16px",
            borderTop: `3px solid ${c.color}`,
            textAlign: isMobile ? "center" : "left",
            boxShadow: C.shadow,
          }}>
            <div style={{ fontSize: isMobile ? 20 : 22, marginBottom: 5 }}>{c.icon}</div>
            <div style={{ fontSize: isMobile ? F.xl : F.hero, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: F.xs, color: C.textMid, marginTop: 5, fontWeight: 600, lineHeight: 1.3 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* By type */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 11 }}>
        {byType.map(({ type, meta, count, done }) => (
          <div key={type} style={{ ...s.card, padding: "15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.soft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                {meta.icon}
              </div>
              <div>
                <div style={{ fontSize: F.base, fontWeight: 700, color: C.text }}>{type}</div>
                <div style={{ fontSize: F.xs, color: C.textMid }}>{count} checklist{count !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: C.surface2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${count > 0 ? Math.round((done / count) * 100) : 0}%`, background: meta.color, borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: F.xs, color: C.textMid, marginTop: 6 }}>{done}/{count} finalized</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {stats.pending > 0 && PERMS.canApprove(currentUser) && (
        <div style={{ background: C.warnSoft, border: `1.5px solid #fde68a`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⏳</span>
          <span style={{ fontWeight: 700, color: C.warn, fontSize: F.md }}>
            {stats.pending} checklist{stats.pending > 1 ? "s have" : " has"} steps awaiting your approval
          </span>
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div>
          <div style={{ fontSize: F.sm, fontWeight: 700, color: C.textMid, textTransform: "uppercase", letterSpacing: .07, marginBottom: 10 }}>
            Recent Activity
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {recentActivity.map((a, i) => {
              const m  = STEP_META[a.sd.status] || STEP_META.pending;
              return (
                <div key={i} style={{
                  ...s.card, padding: "11px 13px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: F.sm, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.checklist.assigned_to_name} — {a.step.label}
                    </div>
                    <div style={{ fontSize: F.xs, color: C.textMid }}>{a.checklist.title}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                    <StatusBadge status={a.sd.status} />
                    <span style={{ fontSize: F.xs, color: C.textDim }}>{fmtTime(a.time)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLISTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ChecklistsView({ currentUser, checklists, staff, onOpen, onDelete, onAssign, isMobile }) {
  const [showAssign,    setShowAssign]    = useState(false);
  const [search,        setSearch]        = useState("");
  const [filterType,    setFilterType]    = useState("All");
  const [filterStatus,  setFilterStatus]  = useState("All");
  const [showFilters,   setShowFilters]   = useState(false);

  const visible = useMemo(() => {
    let list = checklists;
    if (filterType !== "All")         list = list.filter(c => c.exam_type === filterType);
    if (filterStatus === "active")    list = list.filter(c => c.status === "active");
    if (filterStatus === "completed") list = list.filter(c => c.status === "completed" || c.status === "finalized");
    if (filterStatus === "review")    list = list.filter(c => {
      const steps = PIPELINE_STEPS[c.exam_type] || [];
      return steps.some(s => c.step_data?.[s.key]?.status === "submitted");
    });
    if (search) list = list.filter(c =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.assigned_to_name.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [checklists, filterType, filterStatus, search]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
        {!isMobile && (
          <div style={{ fontSize: F.xl, fontWeight: 800, color: C.text }}>
            {currentUser.role === "staff" ? "My Checklists"
              : currentUser.role === "incharge" ? `${currentUser.department} Checklists`
              : "All Checklists"}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{ ...s.btnGhost, background: showFilters ? C.brandSoft : "none", color: showFilters ? C.brand : C.textMid, borderColor: showFilters ? C.brand : C.border }}
          >
            ⚙ {showFilters ? "Hide" : "Filters"}
          </button>
          {PERMS.canAssign(currentUser) && (
            <button
              onClick={() => setShowAssign(true)}
              style={{ ...s.btn(), background: `linear-gradient(135deg,${C.brand},${C.brandMid})`, padding: "9px 16px", borderRadius: 9, fontSize: F.base }}
            >＋ Assign</button>
          )}
        </div>
      </div>

      <input
        style={{ ...s.input, marginBottom: 10 }}
        placeholder="🔍 Search by title or staff name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {showFilters && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          <select style={s.input} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="All">All Types</option>
            {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select style={s.input} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="active">Active</option>
            <option value="review">Needs Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}

      <div style={{ fontSize: F.sm, color: C.textMid, marginBottom: 11 }}>
        {visible.length} checklist{visible.length !== 1 ? "s" : ""}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(320px,1fr))",
        gap: 13,
      }}>
        {visible.length === 0 ? (
          <div style={{ padding: 44, textAlign: "center", color: C.textMid, fontSize: F.base, gridColumn: "1/-1" }}>
            No checklists found.
          </div>
        ) : (
          visible.map(c => (
            <ChecklistCard
              key={c.id}
              checklist={c}
              currentUser={currentUser}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {showAssign && (
        <AssignModal
          currentUser={currentUser}
          staffList={staff}
          onClose={() => setShowAssign(false)}
          onSave={items => { onAssign(items); setShowAssign(false); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONITOR VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function MonitorView({ currentUser, checklists, staff, isMobile }) {
  const staffStats = useMemo(() => staff
    .filter(s => resolveRole(s.role) === "staff")
    .map(s => {
      const mine    = checklists.filter(c => c.assigned_to_id === s.id);
      const approved = mine.filter(c => c.status === "finalized" || c.status === "completed").length;
      const pending  = mine.filter(c => {
        const steps = PIPELINE_STEPS[c.exam_type] || [];
        return steps.some(st => c.step_data?.[st.key]?.status === "submitted");
      }).length;
      return { ...s, total: mine.length, approved, pending };
    })
    .sort((a, b) => b.pending - a.pending || b.total - a.total)
  , [staff, checklists]);

  return (
    <div>
      {!isMobile && <div style={{ fontSize: F.xl, fontWeight: 800, color: C.text, marginBottom: 16 }}>Exam Monitor</div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 11, marginBottom: 20 }}>
        {EXAM_TYPES.map(et => {
          const list = checklists.filter(c => c.exam_type === et);
          const done = list.filter(c => c.status === "finalized").length;
          const m    = EXAM_META[et];
          const pct  = list.length > 0 ? Math.round((done / list.length) * 100) : 0;
          return (
            <div key={et} style={{ ...s.card, padding: 15 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
                <span style={{ fontSize: 22 }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: F.base, fontWeight: 700, color: C.text }}>{et}</div>
                  <div style={{ fontSize: F.xs, color: C.textMid }}>{list.length} assigned</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: F.lg, fontWeight: 800, color: m.color }}>{pct}%</div>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: C.surface2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: m.color, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: F.xs, color: C.textMid, marginTop: 6 }}>{done}/{list.length} finalized</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: F.sm, fontWeight: 700, color: C.textMid, textTransform: "uppercase", letterSpacing: .07, marginBottom: 12 }}>
        Staff Progress
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(260px,1fr))", gap: 11 }}>
        {staffStats.map(staff => {
          const pct   = staff.total > 0 ? Math.round((staff.approved / staff.total) * 100) : 0;
          const color = staff.pending > 0 ? C.warn : pct >= 80 ? C.success : pct >= 50 ? C.info : C.textDim;
          return (
            <div key={staff.id} style={{ ...s.card, padding: 15, borderTop: `3px solid ${color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
                <Avatar name={staff.name} role={resolveRole(staff.role)} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: F.md, fontWeight: 700, color: C.text }}>{staff.name}</div>
                  <div style={{ fontSize: F.xs, color: C.textMid }}>{staff.department}</div>
                </div>
                <span style={{ fontSize: F.xl, fontWeight: 800, color }}>{pct}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: C.surface2, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {[["Assigned", staff.total, "#7c3aed"], ["Done", staff.approved, C.success], ["Review", staff.pending, C.warn]].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: "center", background: C.surface2, borderRadius: 8, padding: "8px 4px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: F.lg, fontWeight: 800, color: c }}>{v}</div>
                    <div style={{ fontSize: F.xs, color: C.textMid }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {staffStats.length === 0 && (
          <div style={{ fontSize: F.base, color: C.textMid, padding: "24px 0" }}>No staff data available.</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════════════════════════
function TopNav({ currentUser, activeView, setActiveView, onRefresh, users, setCurrentUser, checklists }) {
  const navItems = useMemo(() => {
    if (currentUser.role === "staff") return [
      { id: "dashboard", label: "Dashboard",     icon: "🏠" },
      { id: "my",        label: "My Checklists", icon: "📋" },
    ];
    if (currentUser.role === "incharge") return [
      { id: "dashboard", label: "Dashboard",  icon: "🏠" },
      { id: "all",       label: "Checklists", icon: "📋" },
      { id: "monitor",   label: "Monitor",    icon: "📊" },
    ];
    return [
      { id: "dashboard", label: "Dashboard",      icon: "🏠" },
      { id: "all",       label: "All Checklists", icon: "📋" },
      { id: "monitor",   label: "Monitor",        icon: "📊" },
    ];
  }, [currentUser.role]);

  const pendingCount = checklists.filter(c => {
    const steps = PIPELINE_STEPS[c.exam_type] || [];
    const deptOk = currentUser.role === "admin" || c.department === currentUser.department;
    return deptOk && steps.some(s => c.step_data?.[s.key]?.status === "submitted");
  }).length;

  return (
    <div style={{ background: "white", borderBottom: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,.05)", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 54, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: `linear-gradient(135deg,${C.brand},${C.brandMid})`, borderRadius: 9, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏆</div>
          <div>
            <div style={{ fontSize: F.md, fontWeight: 800, color: C.text }}>GNSI Exam Checklist</div>
            <div style={{ fontSize: F.xs, color: C.textMid }}>Monthly · Pre Mock · Mega Mock</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pendingCount > 0 && (
            <button onClick={() => setActiveView("all")} style={{ ...s.btnSm(C.warn), fontSize: F.xs }}>
              ⏳ {pendingCount} Awaiting Approval
            </button>
          )}
          {PERMS.canSwitchUser(currentUser) && users.length > 1 && (
            <select
              style={{ ...s.input, width: "auto", padding: "6px 10px", fontSize: F.xs, borderRadius: 8 }}
              value={currentUser.id}
              onChange={e => setCurrentUser(users.find(u => u.id === +e.target.value) || users[0])}
            >
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLE_DISPLAY[resolveRole(u.role)]?.label || u.role})</option>)}
            </select>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface2, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: "6px 11px" }}>
            <Avatar name={currentUser.name} role={currentUser.role} size={24} />
            <div>
              <div style={{ fontSize: F.xs, fontWeight: 700, color: C.text }}>{currentUser.name}</div>
              <RoleBadge role={currentUser.role} />
            </div>
          </div>
          <button onClick={onRefresh} style={{ ...s.btnGhost, padding: "7px 11px" }}>🔄</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "0 24px", gap: 2 }}>
        {navItems.map(n => (
          <button
            key={n.id}
            onClick={() => setActiveView(n.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "11px 16px", border: "none", background: "none",
              cursor: "pointer", fontFamily: "inherit", fontSize: F.sm,
              fontWeight: activeView === n.id ? 700 : 500,
              color: activeView === n.id ? C.brand : C.textMid,
              borderBottom: activeView === n.id ? `2.5px solid ${C.brand}` : "2.5px solid transparent",
              marginBottom: -1, whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 14 }}>{n.icon}</span>{n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BottomNav({ currentUser, activeView, setActiveView }) {
  const items = useMemo(() => {
    if (currentUser.role === "staff") return [
      { id: "dashboard", label: "Home",  icon: "🏠" },
      { id: "my",        label: "Tasks", icon: "📋" },
    ];
    return [
      { id: "dashboard", label: "Home",       icon: "🏠" },
      { id: "all",       label: "Checklists", icon: "📋" },
      { id: "monitor",   label: "Monitor",    icon: "📊" },
    ];
  }, [currentUser.role]);

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: C.surface, borderTop: `1.5px solid ${C.border}`,
      display: "flex", zIndex: 200, paddingBottom: "env(safe-area-inset-bottom)",
      boxShadow: "0 -2px 10px rgba(0,0,0,.07)",
    }}>
      {items.map(n => (
        <button
          key={n.id}
          onClick={() => setActiveView(n.id)}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 3, padding: "10px 4px 9px",
            background: "none", border: "none",
            color: activeView === n.id ? C.brand : C.textMid,
            cursor: "pointer", fontFamily: "inherit", fontSize: F.xs,
            fontWeight: activeView === n.id ? 700 : 500,
            borderTop: activeView === n.id ? `3px solid ${C.brand}` : "3px solid transparent",
          }}
        >
          <span style={{ fontSize: 20 }}>{n.icon}</span>{n.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Checklist({ currentUser: portalUser }) {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isMobile = w < 768;

  const [staffList,     setStaffList]     = useState([]);
  const [currentUser,   setCurrentUser]   = useState(null);
  const [checklists,    setChecklists]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [authError,     setAuthError]     = useState(null);
  const [activeView,    setActiveView]    = useState("dashboard");
  const [toast,         setToast]         = useState({ msg: "", type: "success" });
  const [openChecklist, setOpenChecklist] = useState(null);

  const mountedRef    = useRef(true);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    if (!mountedRef.current) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setToast({ msg: "", type: "success" });
    }, 3200);
  }, []);

  const fetchAll = useCallback(async (resolvedUser) => {
    setLoading(true);
    setAuthError(null);
    try {
      const profiles = await db.getStaffProfiles();
      if (!mountedRef.current) return;
      setStaffList(profiles);

      let activeUser = resolvedUser;
      if (!activeUser) {
        activeUser = resolveActiveUser(portalUser, profiles);
        if (!activeUser) {
          const errMsg = `Staff profile not found for "${portalUser?.name || "unknown user"}". ` +
            `Please ensure your staff profile is active in the system.`;
          setAuthError(errMsg);
          setLoading(false);
          return;
        }
      }

      if (!mountedRef.current) return;
      setCurrentUser(activeUser);

      const data = await db.getExamChecklists(activeUser);
      if (!mountedRef.current) return;
      setChecklists(data);
    } catch (err) {
      if (!mountedRef.current) return;
      setAuthError(err.message);
      showToast("⚠️ " + err.message, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [portalUser, showToast]);

  useEffect(() => { fetchAll(null); }, [fetchAll]);

  const prevUserIdRef = useRef(null);
  useEffect(() => {
    if (currentUser?.id !== undefined && currentUser.id !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUser.id;
      setActiveView("dashboard");
    }
  }, [currentUser?.id]);

  const handleSwitchUser = useCallback((user) => {
    const resolved = resolveActiveUser({ ...user, role: user.role }, staffList);
    if (!resolved) return;
    setCurrentUser(resolved);
    db.getExamChecklists(resolved)
      .then(d => { if (mountedRef.current) setChecklists(d); })
      .catch(() => {});
  }, [staffList]);

  const handleAssign = useCallback((items) => {
    setChecklists(prev => [...items, ...prev]);
    showToast(`✅ ${items.length} checklist${items.length !== 1 ? "s" : ""} assigned!`);
  }, [showToast]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this checklist?")) return;
    try {
      await db.deleteExamChecklist(id);
      if (mountedRef.current) setChecklists(prev => prev.filter(c => c.id !== id));
      showToast("Deleted", "info");
    } catch (e) { showToast("Error: " + e.message, "error"); }
  }, [showToast]);

  const handleUpdate = useCallback((updated) => {
    if (!updated) return;
    setChecklists(prev => prev.map(c => c.id === updated.id ? updated : c));
    setOpenChecklist(prev => prev?.id === updated.id ? updated : prev);
    const allSteps   = PIPELINE_STEPS[updated.exam_type] || [];
    const allApproved = allSteps.every(s => updated.step_data?.[s.key]?.status === "approved");
    if (updated.status === "finalized")  showToast("🏁 Exam checklist finalized!");
    else if (allApproved)               showToast("✅ All steps approved — ready for sign-off!");
    else                                showToast("✅ Step updated!");
  }, [showToast]);

  // Loading state
  if (loading && !currentUser) {
    return (
      <div style={{ ...{ background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif", color: C.text }, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner />
      </div>
    );
  }

  // Auth error
  if (authError && !currentUser) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif", color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <ErrorBanner message={authError} onRetry={() => fetchAll(null)} />
        </div>
      </div>
    );
  }

  const activeUser = currentUser || {
    id: 0, name: portalUser?.name || "User",
    role: resolveRole(portalUser?.role),
    department: "Administration",
  };

  const viewProps = {
    currentUser: activeUser,
    checklists,
    staff: staffList,
    isMobile,
    onOpen:   setOpenChecklist,
    onDelete: handleDelete,
    onAssign: handleAssign,
  };

  const renderView = () => {
    if (loading) return <Spinner />;
    switch (activeView) {
      case "dashboard": return <DashboardView {...viewProps} />;
      case "all":
      case "my":        return <ChecklistsView {...viewProps} />;
      case "monitor":   return PERMS.canViewMonitor(activeUser) ? <MonitorView {...viewProps} /> : <DashboardView {...viewProps} />;
      default:          return <DashboardView {...viewProps} />;
    }
  };

  const pageStyle = { background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif", color: C.text };

  return (
    <div style={pageStyle}>
      <Toast msg={toast.msg} type={toast.type} />

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {/* Mobile header */}
          <div style={{ background: C.surface, borderBottom: `1.5px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
              <div>
                <div style={{ fontSize: F.xs, color: C.brand, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>GNSI Exams</div>
                <div style={{ fontSize: F.xl, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
                  {{ dashboard: "Dashboard", all: "Checklists", my: "My Tasks", monitor: "Monitor" }[activeView] || "Dashboard"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={activeUser.name} role={activeUser.role} size={30} />
                <button onClick={() => fetchAll(activeUser)} style={{ ...s.btnGhost, padding: "8px 11px" }}>🔄</button>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: "14px 14px", paddingBottom: 86 }}>
            {renderView()}
          </div>
          <BottomNav currentUser={activeUser} activeView={activeView} setActiveView={setActiveView} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <TopNav
            currentUser={activeUser}
            activeView={activeView}
            setActiveView={setActiveView}
            onRefresh={() => fetchAll(activeUser)}
            users={staffList}
            setCurrentUser={handleSwitchUser}
            checklists={checklists}
          />
          <div style={{ flex: 1, padding: 26, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
            {renderView()}
          </div>
        </div>
      )}

      {openChecklist && (
        <ChecklistDetailModal
          checklist={openChecklist}
          currentUser={activeUser}
          onClose={() => setOpenChecklist(null)}
          onUpdate={handleUpdate}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}