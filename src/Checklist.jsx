import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// EXAM PIPELINE — ordered steps every exam checklist must pass through
// ═══════════════════════════════════════════════════════════════════════════════
const EXAM_TYPES = ["Monthly Test", "Pre Mock Test", "Mega Mock Test"];

const PIPELINE_STEPS = {
  "Monthly Test": [
    { key: "syllabus_confirm",  label: "Syllabus Confirmation",     icon: "📚", desc: "Confirm syllabus coverage and share with staff" },
    { key: "question_setting",  label: "Question Paper Setting",     icon: "✏️",  desc: "Prepare and seal question paper" },
    { key: "printing",          label: "Printing & Packaging",       icon: "🖨️",  desc: "Print, collate and pack answer booklets" },
    { key: "conducting",        label: "Conducting Exam",            icon: "🏫",  desc: "Supervise and conduct the examination" },
    { key: "collection",        label: "Answer Script Collection",   icon: "📦",  desc: "Collect and count all answer scripts" },
    { key: "evaluation",        label: "Paper Evaluation",           icon: "📝",  desc: "Evaluate scripts and enter marks" },
    { key: "result_entry",      label: "Result Entry",               icon: "💻",  desc: "Enter marks in portal / register" },
    { key: "report",            label: "Report & Sign-off",          icon: "📊",  desc: "Prepare result report for authority" },
  ],
  "Pre Mock Test": [
    { key: "schedule",          label: "Schedule & Timetable",       icon: "🗓️",  desc: "Finalise exam schedule and assign invigilators" },
    { key: "question_setting",  label: "Question Paper Setting",     icon: "✏️",  desc: "Prepare mock-level question papers" },
    { key: "printing",          label: "Printing & Packaging",       icon: "🖨️",  desc: "Print, collate and pack" },
    { key: "seating_plan",      label: "Seating Arrangement",        icon: "🪑",  desc: "Prepare seating chart for all students" },
    { key: "conducting",        label: "Conducting Exam",            icon: "🏫",  desc: "Conduct under mock conditions" },
    { key: "collection",        label: "Script Collection",          icon: "📦",  desc: "Collect and verify script count" },
    { key: "evaluation",        label: "Evaluation",                 icon: "📝",  desc: "Evaluate and record marks" },
    { key: "result_entry",      label: "Result Entry & Analysis",    icon: "💻",  desc: "Enter marks and prepare analysis" },
    { key: "report",            label: "Final Report & Sign-off",    icon: "📊",  desc: "Submit final pre-mock report" },
  ],
  "Mega Mock Test": [
    { key: "planning",          label: "Full Exam Planning",         icon: "🗺️",  desc: "Plan logistics, manpower, and venues" },
    { key: "schedule",          label: "Schedule & Communication",   icon: "🗓️",  desc: "Communicate schedule to all stakeholders" },
    { key: "question_setting",  label: "Question Paper Setting",     icon: "✏️",  desc: "Prepare exam-standard question papers" },
    { key: "printing",          label: "Bulk Printing & Packing",    icon: "🖨️",  desc: "Large-scale printing with labelled packs" },
    { key: "seating_plan",      label: "Seating Plan",               icon: "🪑",  desc: "Detailed seating for all batches" },
    { key: "invigilator",       label: "Invigilator Assignment",     icon: "👁️",  desc: "Assign and brief all invigilators" },
    { key: "conducting",        label: "Conducting Exam",            icon: "🏫",  desc: "Full-day exam conduct with supervision" },
    { key: "collection",        label: "Script Collection & Count",  icon: "📦",  desc: "Collect, count and pack all scripts" },
    { key: "evaluation",        label: "Evaluation",                 icon: "📝",  desc: "Evaluate all scripts accurately" },
    { key: "result_entry",      label: "Result Entry",               icon: "💻",  desc: "Enter all marks in portal" },
    { key: "analysis",          label: "Performance Analysis",       icon: "📈",  desc: "Prepare subject-wise analysis report" },
    { key: "report",            label: "Final Sign-off & Report",    icon: "📊",  desc: "Submit comprehensive exam report to admin" },
  ],
};

const STEP_STATUS = { PENDING: "pending", IN_PROGRESS: "in_progress", SUBMITTED: "submitted", APPROVED: "approved", REJECTED: "rejected" };

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE LAYER
// ═══════════════════════════════════════════════════════════════════════════════
const db = {
  async getUsers() {
    const { data, error } = await supabase
      .from("staff_profiles")
      .select("id, name, role, department, designation, phone, email, status")
      .eq("status", "Active")
      .order("name");
    if (error) throw error;
    return (data || []).map(s => ({
      ...s,
      role: ["Teaching + Admin","Administrator","admin","Admin"].includes(s.role) ? "admin"
          : ["incharge","Incharge","In-charge","manager","Manager"].includes(s.role) ? "incharge"
          : "staff",
    }));
  },

  async getExamChecklists(currentUser) {
    let q = supabase.from("exam_checklists").select("*").order("created_at", { ascending: false });
    if (currentUser?.role === "staff") q = q.eq("assigned_to_id", currentUser.id);
    else if (currentUser?.role === "incharge") q = q.eq("department", currentUser.department);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async createExamChecklist(payload) {
    const { data, error } = await supabase
      .from("exam_checklists")
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateExamChecklist(id, changes) {
    const { data, error } = await supabase
      .from("exam_checklists")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteExamChecklist(id) {
    const { error } = await supabase.from("exam_checklists").delete().eq("id", id);
    if (error) throw error;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS & THEME
// ═══════════════════════════════════════════════════════════════════════════════
const DEPARTMENTS = ["Administration","Academic","Accounts","Hostel","Reception","Transport","Maintenance"];
const fmtDate  = d => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtTime  = d => d ? new Date(d).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—";
const initials = n => n?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "?";

const EXAM_META = {
  "Monthly Test":   { color: "#0ea5e9", bg: "#e0f2fe", icon: "📋", short: "Monthly" },
  "Pre Mock Test":  { color: "#8b5cf6", bg: "#ede9fe", icon: "🎯", short: "Pre Mock" },
  "Mega Mock Test": { color: "#f59e0b", bg: "#fef3c7", icon: "🏆", short: "Mega Mock" },
};

const STEP_META = {
  pending:     { color: "#94a3b8", bg: "#f1f5f9", label: "Pending",     icon: "○"  },
  in_progress: { color: "#0ea5e9", bg: "#e0f2fe", label: "In Progress", icon: "◑"  },
  submitted:   { color: "#f59e0b", bg: "#fef3c7", label: "Submitted",   icon: "⏳" },
  approved:    { color: "#16a34a", bg: "#f0fdf4", label: "Approved",    icon: "✅" },
  rejected:    { color: "#dc2626", bg: "#fef2f2", label: "Rejected",    icon: "✕"  },
};

const roleColor = { admin: "#6366f1", incharge: "#0ea5e9", staff: "#16a34a" };
const roleLabel = { admin: "Admin", incharge: "In-charge", staff: "Staff" };

const F = { xs:13, sm:14, base:15, md:16, lg:18, xl:22, xxl:26 };
const T = {
  bg:"#f0f4f8", surface:"#ffffff", surface2:"#f1f5f9", border:"#e2e8f0",
  accent:"#4f46e5", accentG:"linear-gradient(135deg,#4f46e5,#6366f1)",
  text:"#0f172a", textMid:"#475569", textDim:"#94a3b8",
  danger:"#dc2626", success:"#16a34a", warn:"#d97706", info:"#0ea5e9",
  shadow:"0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.05)",
  shadowMd:"0 4px 12px rgba(0,0,0,.08)",
};
const G = {
  page: { background:T.bg, minHeight:"100vh", fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif", color:T.text },
  card: { background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden", boxShadow:T.shadow },
  inp:  { width:"100%", padding:"12px 14px", background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:10, color:T.text, fontSize:F.base, boxSizing:"border-box", fontFamily:"inherit", outline:"none", lineHeight:1.4 },
  lbl:  { display:"block", fontSize:F.xs, fontWeight:700, color:T.textMid, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 },
  btn:  (bg="#4f46e5",fg="white") => ({ background:bg, color:fg, border:"none", borderRadius:10, padding:"12px 20px", fontWeight:700, cursor:"pointer", fontSize:F.base, fontFamily:"inherit", lineHeight:1 }),
  btnSm:(bg=T.accent) => ({ background:bg, color:"white", border:"none", borderRadius:8, padding:"8px 14px", fontWeight:700, cursor:"pointer", fontSize:F.sm, fontFamily:"inherit", whiteSpace:"nowrap" }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function Badge({ label, color, bg, icon }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:99, fontSize:F.xs, fontWeight:700, background:bg||T.surface2, color:color||T.textMid, border:`1px solid ${color}22`, whiteSpace:"nowrap" }}>
      {icon} {label}
    </span>
  );
}
function Avatar({ name, role, size=38 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`${roleColor[role]||"#6366f1"}18`, border:`2px solid ${roleColor[role]||"#6366f1"}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:700, color:roleColor[role]||"#6366f1", flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}
function Toast({ msg, type="success" }) {
  if (!msg) return null;
  const colors = { success:"#16a34a", error:"#dc2626", info:"#0ea5e9" };
  return (
    <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:9999, background:T.surface, border:`1px solid ${colors[type]}40`, color:colors[type], padding:"13px 22px", borderRadius:12, boxShadow:"0 8px 24px rgba(0,0,0,.14)", fontSize:F.base, fontWeight:700, display:"flex", alignItems:"center", gap:9, whiteSpace:"nowrap", maxWidth:"92vw" }}>
      {type==="success"?"✅":type==="error"?"❌":"ℹ️"} {msg}
    </div>
  );
}
function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:56, gap:14, color:T.textMid }}>
      <div style={{ width:22, height:22, border:`2.5px solid ${T.border}`, borderTop:`2.5px solid ${T.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <span>Loading…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP PIPELINE PROGRESS BAR
// ═══════════════════════════════════════════════════════════════════════════════
function PipelineBar({ steps, stepData, compact=false }) {
  const approved = steps.filter(s => stepData?.[s.key]?.status === "approved").length;
  const pct = steps.length > 0 ? Math.round((approved/steps.length)*100) : 0;
  const color = pct===100?T.success:pct>=60?T.info:pct>=30?T.warn:T.textDim;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:F.xs, color:T.textMid }}>{approved}/{steps.length} steps approved</span>
        <span style={{ fontSize:F.xs, fontWeight:700, color }}>{pct}%</span>
      </div>
      <div style={{ height:compact?5:7, borderRadius:99, background:T.surface2, border:`1px solid ${T.border}`, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99, transition:"width 0.4s ease" }} />
      </div>
      {!compact && (
        <div style={{ display:"flex", gap:3, marginTop:8, flexWrap:"wrap" }}>
          {steps.map(s => {
            const st = stepData?.[s.key]?.status || "pending";
            const m  = STEP_META[st];
            return (
              <div key={s.key} title={`${s.label}: ${m.label}`} style={{ width:16, height:16, borderRadius:"50%", background:m.color, flexShrink:0, opacity: st==="pending" ? 0.25 : 1 }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP DETAIL ROW — staff submits, admin approves, per step
// ═══════════════════════════════════════════════════════════════════════════════
function StepRow({ step, stepState, isActive, isLocked, currentUser, onSubmitStep, onApproveStep, onRejectStep, isMobile }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote]         = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving]     = useState(false);

  const st  = stepState?.status || "pending";
  const m   = STEP_META[st];
  const canSubmit  = currentUser.role === "staff" && isActive && (st === "pending" || st === "in_progress" || st === "rejected");
  const canApprove = (currentUser.role === "admin" || currentUser.role === "incharge") && st === "submitted";

  const doSubmit = async () => {
    if (!note.trim()) { alert("Add a completion note before submitting."); return; }
    setSaving(true);
    try { await onSubmitStep(step.key, note); setNote(""); setExpanded(false); }
    catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };
  const doApprove = async () => {
    setSaving(true);
    try { await onApproveStep(step.key, feedback); setFeedback(""); setExpanded(false); }
    catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };
  const doReject = async () => {
    if (!feedback.trim()) { alert("Provide rejection reason."); return; }
    setSaving(true);
    try { await onRejectStep(step.key, feedback); setFeedback(""); setExpanded(false); }
    catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ border:`1.5px solid ${st==="approved"?"#bbf7d0":st==="rejected"?"#fecaca":st==="submitted"?"#fde68a":isActive?T.accent+"44":T.border}`, borderRadius:12, overflow:"hidden", background:isLocked?"#fafafa":T.surface, opacity:isLocked?0.55:1 }}>
      {/* Step header */}
      <div
        onClick={() => !isLocked && setExpanded(v => !v)}
        style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", cursor:isLocked?"default":"pointer", background:st==="approved"?"#f0fdf4":st==="submitted"?"#fffbeb":isActive?`${T.accent}08`:"transparent" }}
      >
        <div style={{ width:36, height:36, borderRadius:10, background:m.bg, border:`1.5px solid ${m.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
          {step.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
            <span style={{ fontSize:F.base, fontWeight:700, color:T.text }}>{step.label}</span>
            {isActive && st!=="approved" && <span style={{ fontSize:F.xs, color:T.accent, fontWeight:700, background:`${T.accent}12`, padding:"2px 7px", borderRadius:99 }}>Active</span>}
          </div>
          <div style={{ fontSize:F.xs, color:T.textMid, marginTop:2 }}>{step.desc}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, minWidth:0 }}>
          <Badge label={m.label} color={m.color} bg={m.bg} />
          {!isLocked && <span style={{ fontSize:13, color:T.textMid, flexShrink:0 }}>{expanded?"▲":"▼"}</span>}
        </div>
      </div>  {/* ← closes the step header div */}

      {/* Expanded body */}
      {expanded && !isLocked && (
        <div style={{ padding:"14px 16px 16px", borderTop:`1px solid ${T.border}`, display:"flex", flexDirection:"column", gap:12 }}>
          {/* Staff message history */}
          {stepState?.note && (
            <div style={{ background:`${T.info}08`, border:`1px solid ${T.info}30`, borderRadius:10, padding:"11px 14px" }}>
              <div style={{ fontSize:F.xs, color:T.textMid, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Staff Note</div>
              <div style={{ fontSize:F.base, color:T.text, lineHeight:1.6 }}>"{stepState.note}"</div>
              {stepState.submitted_at && <div style={{ fontSize:F.xs, color:T.textDim, marginTop:5 }}>Submitted {fmtTime(stepState.submitted_at)}</div>}
            </div>
          )}
          {/* Feedback / rejection note */}
          {stepState?.feedback && (
            <div style={{ background:st==="rejected"?"#fef2f2":"#f0fdf4", border:`1px solid ${st==="rejected"?"#fecaca":"#bbf7d0"}`, borderRadius:10, padding:"11px 14px" }}>
              <div style={{ fontSize:F.xs, color:T.textMid, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>
                {st==="rejected"?"Rejection Reason":"Approval Note"}
              </div>
              <div style={{ fontSize:F.base, color:st==="rejected"?T.danger:T.success, lineHeight:1.6 }}>{stepState.feedback}</div>
              {stepState.reviewed_at && <div style={{ fontSize:F.xs, color:T.textDim, marginTop:5 }}>by {stepState.reviewed_by} · {fmtTime(stepState.reviewed_at)}</div>}
            </div>
          )}

          {/* Staff: submit step */}
          {canSubmit && (
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              <div>
                <label style={G.lbl}>Completion Message *</label>
                <textarea style={{ ...G.inp, resize:"vertical", minHeight:72 }} value={note} onChange={e => setNote(e.target.value)}
                  placeholder={`Describe what was done for "${step.label}"…`} />
              </div>
              <button onClick={doSubmit} disabled={saving||!note.trim()} style={{ ...G.btn("#059669"), opacity:saving||!note.trim()?0.6:1, width:"100%" }}>
                {saving?"⏳ Submitting…":"📤 Submit Step for Approval"}
              </button>
            </div>
          )}

          {/* Admin/Incharge: approve or reject */}
          {canApprove && (
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              <div>
                <label style={G.lbl}>Feedback (optional for approval, required for rejection)</label>
                <textarea style={{ ...G.inp, resize:"vertical", minHeight:60 }} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Add feedback or rejection reason…" />
              </div>
              <div style={{ display:"flex", gap:9 }}>
                <button onClick={doApprove} disabled={saving} style={{ flex:1, ...G.btn("#059669") }}>✅ Approve Step</button>
                <button onClick={doReject}  disabled={saving} style={{ flex:1, ...G.btn("#dc2626") }}>✕ Reject Step</button>
              </div>
            </div>
          )}

          {/* Staff: already submitted and waiting */}
          {currentUser.role==="staff" && st==="submitted" && (
            <div style={{ fontSize:F.sm, color:T.warn, fontWeight:600, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:9, padding:"10px 13px" }}>
              ⏳ Awaiting approval from incharge / admin…
            </div>
          )}
          {/* Approved — locked view */}
          {st==="approved" && (
            <div style={{ fontSize:F.sm, color:T.success, fontWeight:700, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:9, padding:"10px 13px" }}>
              ✅ Approved by {stepState?.reviewed_by} · {fmtTime(stepState?.reviewed_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLIST DETAIL MODAL — full pipeline view for one exam checklist
// ═══════════════════════════════════════════════════════════════════════════════
function ChecklistDetailModal({ checklist, currentUser, onClose, onUpdate, isMobile }) {
  const steps    = PIPELINE_STEPS[checklist.exam_type] || [];
  const stepData = checklist.step_data || {};
  const [saving, setSaving] = useState(false);

  // Active step = first non-approved
  const activeIdx = steps.findIndex(s => stepData[s.key]?.status !== "approved");
  const activeKey = activeIdx >= 0 ? steps[activeIdx]?.key : null;

  const allDone  = activeIdx === -1;
  const isFinalized = checklist.status === "finalized";

  const updateStepData = async (newStepData, extraFields={}) => {
    const updated = await db.updateExamChecklist(checklist.id, {
      step_data: newStepData,
      ...extraFields,
    });
    onUpdate(updated);
  };

  const handleSubmitStep = useCallback(async (key, note) => {
    const newStepData = {
      ...stepData,
      [key]: { ...(stepData[key]||{}), status:"submitted", note, submitted_at:new Date().toISOString(), submitted_by:currentUser.name },
    };
    await updateStepData(newStepData);
  }, [stepData, currentUser]);

  const handleApproveStep = useCallback(async (key, feedback) => {
    const updatedStep = { ...(stepData[key]||{}), status:"approved", feedback, reviewed_by:currentUser.name, reviewed_at:new Date().toISOString() };
    const newStepData = { ...stepData, [key]: updatedStep };
    // Check if all steps approved → auto-complete
    const allApproved = steps.every(s => (s.key===key ? true : newStepData[s.key]?.status==="approved"));
    await updateStepData(newStepData, allApproved ? { status:"completed" } : {});
  }, [stepData, steps, currentUser]);

  const handleRejectStep = useCallback(async (key, feedback) => {
    const newStepData = {
      ...stepData,
      [key]: { ...(stepData[key]||{}), status:"rejected", feedback, reviewed_by:currentUser.name, reviewed_at:new Date().toISOString() },
    };
    await updateStepData(newStepData);
  }, [stepData, currentUser]);

  const handleFinalize = async () => {
    if (!allDone) { alert("All steps must be approved before final sign-off."); return; }
    setSaving(true);
    try {
      const updated = await db.updateExamChecklist(checklist.id, { status:"finalized", finalized_by:currentUser.name, finalized_at:new Date().toISOString() });
      onUpdate(updated);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const examMeta = EXAM_META[checklist.exam_type] || EXAM_META["Monthly Test"];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.5)", backdropFilter:"blur(4px)", zIndex:2000, display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ ...G.card, width:"100%", maxWidth:680, maxHeight:isMobile?"95vh":"90vh", display:"flex", flexDirection:"column", borderRadius:isMobile?"18px 18px 0 0":"18px", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
  {/* Header */}
  <div style={{ background:`linear-gradient(135deg,${examMeta.color},${examMeta.color}cc)`, padding:"14px 16px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontSize:22 }}>{examMeta.icon}</span>
                <span style={{ fontSize:F.xs, color:"rgba(255,255,255,.8)", fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>{checklist.exam_type}</span>
                {isFinalized && <Badge label="Finalized ✅" color="white" bg="rgba(255,255,255,.25)" />}
              </div>
              <div style={{ fontSize:F.xl, fontWeight:800, color:"white", lineHeight:1.2 }}>{checklist.title}</div>
              <div style={{ fontSize:F.sm, color:"rgba(255,255,255,.8)", marginTop:4 }}>
                Assigned to: <b>{checklist.assigned_to_name}</b> · {checklist.department}
              </div>
              {checklist.exam_date && <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.75)", marginTop:3 }}>📅 Exam Date: {fmtDate(checklist.exam_date)}</div>}
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"white", borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:20, flexShrink:0 }}>✕</button>
          </div>
          <div style={{ marginTop:14 }}>
            <PipelineBar steps={steps} stepData={stepData} />
          </div>
        </div>

        {/* Steps */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:9 }}>
          {isFinalized && (
            <div style={{ background:"#f0fdf4", border:"2px solid #16a34a", borderRadius:12, padding:"16px 18px", textAlign:"center", marginBottom:4 }}>
              <div style={{ fontSize:28 }}>🎉</div>
              <div style={{ fontSize:F.lg, fontWeight:800, color:T.success }}>Exam Fully Completed & Signed Off</div>
              <div style={{ fontSize:F.sm, color:T.textMid, marginTop:4 }}>By {checklist.finalized_by} · {fmtTime(checklist.finalized_at)}</div>
            </div>
          )}
          {steps.map((step, idx) => {
            const isActive = step.key === activeKey;
            const isLocked = idx > activeIdx && activeIdx !== -1;
            return (
              <StepRow
                key={step.key}
                step={step}
                stepState={stepData[step.key]}
                isActive={isActive}
                isLocked={isLocked}
                currentUser={currentUser}
                onSubmitStep={handleSubmitStep}
                onApproveStep={handleApproveStep}
                onRejectStep={handleRejectStep}
                isMobile={isMobile}
              />
            );
          })}
        </div>

        {/* Footer — Final Sign-off */}
        {!isFinalized && (currentUser.role==="admin" || currentUser.role==="incharge") && (
          <div style={{ padding:"14px 18px 20px", borderTop:`1px solid ${T.border}`, background:T.surface2 }}>
            {allDone ? (
              <button onClick={handleFinalize} disabled={saving} style={{ ...G.btn("#059669"), width:"100%", fontSize:F.lg, padding:16, fontWeight:800, opacity:saving?0.6:1 }}>
                {saving?"⏳ Finalizing…":"🏁 Final Sign-off — Complete Exam Checklist"}
              </button>
            ) : (
              <div style={{ fontSize:F.sm, color:T.textMid, textAlign:"center", padding:"6px 0" }}>
                Approve all {steps.length} steps to enable final sign-off.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN MODAL — single or bulk assignment
// ═══════════════════════════════════════════════════════════════════════════════
function AssignChecklistModal({ currentUser, staffList, onClose, onSave }) {
  const [mode, setMode]         = useState("single"); // "single" | "bulk"
  const [examType, setExamType] = useState("Monthly Test");
  const [title, setTitle]       = useState("");
  const [examDate, setExamDate] = useState("");
  const [dept, setDept]         = useState(currentUser.department || "Academic");
  const [assignedTo, setAssignedTo] = useState("");
  const [bulkStaff, setBulkStaff]   = useState([]);
  const [saving, setSaving] = useState(false);

  const filteredStaff = useMemo(() => {
    if (currentUser.role === "incharge") return staffList.filter(s => s.role==="staff" && s.department===currentUser.department);
    return staffList.filter(s => s.role !== "admin");
  }, [staffList, currentUser]);

  const toggleBulk = (id) => setBulkStaff(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);

  const handleSave = async () => {
    const baseTitle = title.trim() || `${examType} Checklist`;
    setSaving(true);
    try {
      const targets = mode==="bulk" ? bulkStaff.map(id => staffList.find(s=>s.id===id)) : [staffList.find(s=>s.id===+assignedTo)];
      if (targets.some(t=>!t)) { alert("Select at least one staff member"); setSaving(false); return; }
      const results = [];
      for (const staff of targets) {
        const payload = {
          exam_type: examType,
          title: mode==="bulk" ? `${baseTitle} — ${staff.name}` : baseTitle,
          department: staff.department || dept,
          assigned_to_id: staff.id,
          assigned_to_name: staff.name,
          assigned_by: currentUser.name,
          exam_date: examDate || null,
          status: "active",
          step_data: {},
          created_at: new Date().toISOString(),
        };
        const rec = await db.createExamChecklist(payload);
        results.push(rec);
      }
      onSave(results);
      onClose();
    } catch(e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", backdropFilter:"blur(4px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ ...G.card, width:"100%", maxWidth:600, maxHeight:"95vh", display:"flex", flexDirection:"column", borderRadius:"18px 18px 0 0", boxShadow:"0 -8px 36px rgba(0,0,0,.14)" }}>
        <div style={{ background:T.accentG, padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.7)", textTransform:"uppercase", letterSpacing:1 }}>New Assignment</div>
            <div style={{ fontSize:F.lg, fontWeight:800, color:"white" }}>Assign Exam Checklist</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.22)", border:"none", color:"white", borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:20 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"18px 20px", display:"flex", flexDirection:"column", gap:16 }}>
          {/* Mode toggle */}
          <div style={{ display:"flex", gap:0, background:T.surface2, borderRadius:12, padding:4, border:`1px solid ${T.border}` }}>
            {[["single","Single Staff"],["bulk","Bulk Assign"]].map(([m,l]) => (
              <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:"10px 8px", borderRadius:10, border:mode===m?`1px solid ${T.border}`:"none", background:mode===m?T.surface:"none", color:mode===m?T.text:T.textMid, fontWeight:mode===m?700:500, cursor:"pointer", fontSize:F.sm, fontFamily:"inherit", boxShadow:mode===m?T.shadow:"none" }}>
                {m==="single"?"👤":"👥"} {l}
              </button>
            ))}
          </div>

          {/* Exam type */}
          <div>
            <label style={G.lbl}>Exam Type</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9 }}>
              {EXAM_TYPES.map(et => {
                const m = EXAM_META[et];
                return (
                  <button key={et} onClick={() => setExamType(et)} style={{ padding:"13px 8px", borderRadius:12, border:`2px solid ${examType===et?m.color:T.border}`, background:examType===et?m.bg:T.surface, cursor:"pointer", fontFamily:"inherit", textAlign:"center", transition:"all .15s" }}>
                    <div style={{ fontSize:22 }}>{m.icon}</div>
                    <div style={{ fontSize:F.xs, fontWeight:700, color:examType===et?m.color:T.textMid, marginTop:4, lineHeight:1.3 }}>{et}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={G.lbl}>Checklist Title {mode==="bulk"&&<span style={{ fontWeight:400,textTransform:"none",fontSize:F.xs }}>(staff name auto-appended)</span>}</label>
            <input style={G.inp} value={title} onChange={e=>setTitle(e.target.value)} placeholder={`e.g. ${examType} — June 2025`} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={G.lbl}>Exam Date</label>
              <input type="date" style={G.inp} value={examDate} onChange={e=>setExamDate(e.target.value)} />
            </div>
            {currentUser.role==="admin" && (
              <div>
                <label style={G.lbl}>Department</label>
                <select style={G.inp} value={dept} onChange={e=>setDept(e.target.value)}>
                  {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Single assign */}
          {mode==="single" && (
            <div>
              <label style={G.lbl}>Assign To</label>
              <select style={G.inp} value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}>
                <option value="">— Select Staff —</option>
                {filteredStaff.map(s=><option key={s.id} value={s.id}>{s.name} — {s.designation||s.department}</option>)}
              </select>
            </div>
          )}

          {/* Bulk assign */}
          {mode==="bulk" && (
            <div>
              <label style={G.lbl}>Select Staff ({bulkStaff.length} selected)</label>
              <div style={{ display:"flex", flexDirection:"column", gap:7, maxHeight:220, overflowY:"auto", border:`1px solid ${T.border}`, borderRadius:10, padding:10 }}>
                <button onClick={() => setBulkStaff(bulkStaff.length===filteredStaff.length?[]:filteredStaff.map(s=>s.id))} style={{ ...G.btnSm(T.surface), border:`1px solid ${T.border}`, color:T.textMid, fontSize:F.xs, marginBottom:4 }}>
                  {bulkStaff.length===filteredStaff.length?"Deselect All":"Select All"}
                </button>
                {filteredStaff.map(s => (
                  <label key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 11px", borderRadius:10, border:`1.5px solid ${bulkStaff.includes(s.id)?T.accent:T.border}`, background:bulkStaff.includes(s.id)?`${T.accent}08`:T.surface, cursor:"pointer" }}>
                    <input type="checkbox" checked={bulkStaff.includes(s.id)} onChange={()=>toggleBulk(s.id)} style={{ width:16,height:16,accentColor:T.accent }} />
                    <Avatar name={s.name} role={s.role} size={28} />
                    <div>
                      <div style={{ fontSize:F.sm, fontWeight:600, color:T.text }}>{s.name}</div>
                      <div style={{ fontSize:F.xs, color:T.textMid }}>{s.designation||""} · {s.department}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:"14px 20px 24px", borderTop:`1px solid ${T.border}`, background:T.surface2 }}>
          <button onClick={handleSave} disabled={saving||(mode==="single"&&!assignedTo)||(mode==="bulk"&&bulkStaff.length===0)} style={{ width:"100%", background:T.accentG, color:"white", border:"none", borderRadius:12, padding:16, fontWeight:800, fontSize:F.base, fontFamily:"inherit", cursor:"pointer", opacity:(saving||(mode==="single"&&!assignedTo)||(mode==="bulk"&&bulkStaff.length===0))?0.6:1 }}>
            {saving ? "⏳ Assigning…" : mode==="bulk" ? `✅ Assign to ${bulkStaff.length} Staff Member${bulkStaff.length!==1?"s":""}` : "✅ Assign Checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLIST CARD
// ═══════════════════════════════════════════════════════════════════════════════
function ChecklistCard({ checklist, currentUser, onOpen, onDelete, isMobile }) {
  const steps     = PIPELINE_STEPS[checklist.exam_type] || [];
  const stepData  = checklist.step_data || {};
  const examMeta  = EXAM_META[checklist.exam_type] || EXAM_META["Monthly Test"];
  const isFinalized = checklist.status === "finalized";
  const isCompleted = checklist.status === "completed" || isFinalized;
  const approved  = steps.filter(s => stepData[s.key]?.status==="approved").length;
  const activeIdx = steps.findIndex(s => stepData[s.key]?.status!=="approved");
  const activeStep = activeIdx>=0 ? steps[activeIdx] : null;
  const pendingReview = steps.some(s => stepData[s.key]?.status==="submitted");

  const canDelete = currentUser.role==="admin" || (currentUser.role==="incharge" && checklist.department===currentUser.department);

  return (
    <div style={{ background:T.surface, border:`2px solid ${isFinalized?"#16a34a":pendingReview?"#f59e0b":isCompleted?"#bbf7d0":T.border}`, borderRadius:16, overflow:"hidden", boxShadow:T.shadow, display:"flex", flexDirection:"column" }}>
      {/* Color strip */}
      <div style={{ height:4, background:`linear-gradient(90deg,${examMeta.color},${examMeta.color}88)` }} />
      <div style={{ padding:"15px 16px", flex:1 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:examMeta.bg, border:`1.5px solid ${examMeta.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{examMeta.icon}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:3 }}>
              <Badge label={checklist.exam_type} color={examMeta.color} bg={examMeta.bg} />
              {isFinalized && <Badge label="✅ Finalized" color={T.success} bg="#f0fdf4" />}
              {pendingReview && !isFinalized && <Badge label="⏳ Review Needed" color={T.warn} bg="#fffbeb" />}
            </div>
            <div style={{ fontSize:F.md, fontWeight:700, color:T.text, lineHeight:1.3 }}>{checklist.title}</div>
            <div style={{ fontSize:F.xs, color:T.textMid, marginTop:3 }}>👤 {checklist.assigned_to_name} · {checklist.department}</div>
          </div>
        </div>

        <PipelineBar steps={steps} stepData={stepData} />

        {activeStep && !isFinalized && (
          <div style={{ marginTop:11, fontSize:F.sm, color:T.textMid, background:T.surface2, borderRadius:9, padding:"9px 12px", border:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:16 }}>{activeStep.icon}</span>
            <span><b>Current:</b> {activeStep.label}</span>
            {pendingReview && <Badge label="Awaiting Approval" color={T.warn} bg="#fffbeb" icon="⏳" />}
          </div>
        )}
        {checklist.exam_date && (
          <div style={{ marginTop:8, fontSize:F.xs, color:T.textDim }}>📅 {fmtDate(checklist.exam_date)} · By {checklist.assigned_by}</div>
        )}
      </div>
      <div style={{ padding:"10px 16px 14px", borderTop:`1px solid ${T.border}`, display:"flex", gap:8, background:T.surface2 }}>
        <button onClick={() => onOpen(checklist)} style={{ flex:1, ...G.btn(isFinalized?"#16a34a":pendingReview?"#f59e0b":T.accent), padding:"11px 14px", fontSize:F.sm }}>
          {isFinalized?"🏆 View":`${approved}/${steps.length} Steps — Open`}
        </button>
        {canDelete && !isFinalized && (
          <button onClick={() => onDelete(checklist.id)} style={{ ...G.btnSm("#ef4444"), padding:"11px 12px" }}>🗑</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardView({ currentUser, checklists, isMobile }) {
  const total      = checklists.length;
  const finalized  = checklists.filter(c => c.status==="finalized").length;
  const active     = checklists.filter(c => c.status==="active").length;
  const completed  = checklists.filter(c => c.status==="completed").length;
  const pending    = checklists.filter(c => {
    const steps = PIPELINE_STEPS[c.exam_type]||[];
    return steps.some(s => c.step_data?.[s.key]?.status==="submitted");
  }).length;

  const byType = EXAM_TYPES.map(et => ({
    type: et,
    count: checklists.filter(c => c.exam_type===et).length,
    done:  checklists.filter(c => c.exam_type===et && c.status==="finalized").length,
    meta:  EXAM_META[et],
  }));

  const recentActivity = checklists
    .flatMap(c => {
      const steps = PIPELINE_STEPS[c.exam_type]||[];
      return steps.filter(s => c.step_data?.[s.key]?.submitted_at || c.step_data?.[s.key]?.reviewed_at).map(s => ({
        checklist: c,
        step: s,
        sd: c.step_data[s.key],
        time: c.step_data[s.key]?.reviewed_at || c.step_data[s.key]?.submitted_at,
      }));
    })
    .sort((a,b) => new Date(b.time)-new Date(a.time))
    .slice(0,6);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {isMobile && (
        <div style={{ background:T.accentG, borderRadius:14, padding:"16px 18px", color:"white" }}>
          <div style={{ fontSize:F.xs, opacity:.8, textTransform:"uppercase", letterSpacing:.5, marginBottom:3 }}>Welcome back</div>
          <div style={{ fontSize:F.xl, fontWeight:800 }}>{currentUser.name}</div>
          <div style={{ fontSize:F.sm, opacity:.8 }}>{roleLabel[currentUser.role]} · Exam Checklist System</div>
        </div>
      )}
      {!isMobile && (
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:T.text, margin:"0 0 4px" }}>
            {currentUser.role==="staff"?"My Exam Checklists":currentUser.role==="incharge"?`${currentUser.department} Dashboard`:"Exam Checklist Dashboard"}
          </h2>
          <p style={{ fontSize:F.base, color:T.textMid, margin:0 }}>Welcome back, {currentUser.name}</p>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(5,1fr)", gap:10 }}>
        {[
          { label:"Total",         value:total,    color:T.info,    icon:"📋" },
          { label:"Active",        value:active,   color:T.accent,  icon:"▶" },
          { label:"Completed",     value:completed+finalized, color:T.success, icon:"✅" },
          { label:"Pending Review",value:pending,  color:T.warn,    icon:"⏳" },
          { label:"Finalized",     value:finalized,color:"#059669", icon:"🏆" },
        ].map(c => (
          <div key={c.label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:isMobile?"13px 9px":"18px", borderTop:`3px solid ${c.color}`, textAlign:isMobile?"center":"left", boxShadow:T.shadow }}>
            <div style={{ fontSize:isMobile?22:24, marginBottom:5 }}>{c.icon}</div>
            <div style={{ fontSize:isMobile?F.xxl:28, fontWeight:800, color:c.color, lineHeight:1 }}>{c.value}</div>
            <div style={{ fontSize:F.xs, color:T.textMid, marginTop:5, fontWeight:600, lineHeight:1.3 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* By exam type */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:12 }}>
        {byType.map(({ type, count, done, meta }) => (
          <div key={type} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px", boxShadow:T.shadow }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:11 }}>
              <div style={{ width:38, height:38, borderRadius:11, background:meta.bg, border:`1.5px solid ${meta.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{meta.icon}</div>
              <div>
                <div style={{ fontSize:F.base, fontWeight:700, color:T.text }}>{type}</div>
                <div style={{ fontSize:F.xs, color:T.textMid }}>{count} checklist{count!==1?"s":""}</div>
              </div>
            </div>
            <div style={{ height:6, borderRadius:99, background:T.surface2, border:`1px solid ${T.border}`, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${count>0?Math.round((done/count)*100):0}%`, background:meta.color, borderRadius:99 }} />
            </div>
            <div style={{ fontSize:F.xs, color:T.textMid, marginTop:6 }}>{done}/{count} finalized</div>
          </div>
        ))}
      </div>

      {/* Pending review alert */}
      {pending>0 && (currentUser.role==="admin"||currentUser.role==="incharge") && (
        <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:14, padding:"16px 18px" }}>
          <div style={{ fontWeight:700, color:T.warn, fontSize:F.md }}>⏳ {pending} checklist{pending>1?"s":""} have steps awaiting your approval</div>
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length>0 && (
        <div>
          <div style={{ fontSize:F.sm, fontWeight:700, color:T.textMid, textTransform:"uppercase", letterSpacing:.06, marginBottom:10 }}>Recent Activity</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {recentActivity.map((a,i) => {
              const m  = STEP_META[a.sd.status]||STEP_META.pending;
              const em = EXAM_META[a.checklist.exam_type]||EXAM_META["Monthly Test"];
              return (
                <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:11, padding:"12px 14px", display:"flex", alignItems:"center", gap:11, boxShadow:T.shadow }}>
                  <div style={{ width:32, height:32, borderRadius:9, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{m.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:F.sm, fontWeight:600, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {a.checklist.assigned_to_name} — {a.step.label}
                    </div>
                    <div style={{ fontSize:F.xs, color:T.textMid }}>{a.checklist.title}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3, flexShrink:0 }}>
                    <Badge label={m.label} color={m.color} bg={m.bg} icon={m.icon} />
                    <span style={{ fontSize:F.xs, color:T.textDim }}>{fmtTime(a.time)}</span>
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
// CHECKLISTS LIST VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ChecklistsView({ currentUser, checklists, staff, onOpen, onDelete, onAssign, isMobile }) {
  const [showAssign, setShowAssign] = useState(false);
  const [search, setSearch]         = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  const visible = useMemo(() => {
    let list = checklists;
    if (filterType!=="All") list = list.filter(c => c.exam_type===filterType);
    if (filterStatus==="active")    list = list.filter(c => c.status==="active");
    if (filterStatus==="completed") list = list.filter(c => c.status==="completed"||c.status==="finalized");
    if (filterStatus==="review")    list = list.filter(c => {
      const steps = PIPELINE_STEPS[c.exam_type]||[];
      return steps.some(s => c.step_data?.[s.key]?.status==="submitted");
    });
    if (search) list = list.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.assigned_to_name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [checklists, filterType, filterStatus, search]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10 }}>
        {!isMobile && <h2 style={{ fontSize:20, fontWeight:800, color:T.text, margin:0 }}>
          {currentUser.role==="staff"?"My Checklists":currentUser.role==="incharge"?`${currentUser.department} Checklists`:"All Checklists"}
        </h2>}
        <div style={{ display:"flex", gap:9, marginLeft:"auto" }}>
          <button onClick={() => setShowFilters(v=>!v)} style={{ ...G.btnSm(showFilters?T.accent:T.surface), border:`1.5px solid ${showFilters?T.accent:T.border}`, color:showFilters?"white":T.textMid }}>
            ⚙ {showFilters?"Hide":"Filters"}
          </button>
          {currentUser.role!=="staff" && (
            <button onClick={() => setShowAssign(true)} style={{ ...G.btn(), background:T.accentG, padding:"10px 16px", borderRadius:10, fontSize:F.base }}>＋ Assign</button>
          )}
        </div>
      </div>

      <input style={{ ...G.inp, marginBottom:12 }} placeholder="🔍 Search checklists…" value={search} onChange={e=>setSearch(e.target.value)} />

      {showFilters && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:9, marginBottom:14 }}>
          <select style={G.inp} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="All">All Exam Types</option>
            {EXAM_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <select style={G.inp} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="active">Active</option>
            <option value="review">Needs Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}

      <div style={{ fontSize:F.sm, color:T.textMid, marginBottom:12 }}>{visible.length} checklist{visible.length!==1?"s":""}</div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":checklists.length>4?"repeat(auto-fill,minmax(320px,1fr))":"repeat(auto-fill,minmax(340px,1fr))", gap:14 }}>
        {visible.length===0
          ? <div style={{ padding:44, textAlign:"center", color:T.textMid, fontSize:F.base, gridColumn:"1/-1" }}>No checklists found.</div>
          : visible.map(c => <ChecklistCard key={c.id} checklist={c} currentUser={currentUser} onOpen={onOpen} onDelete={onDelete} isMobile={isMobile} />)
        }
      </div>

      {showAssign && (
        <AssignChecklistModal currentUser={currentUser} staffList={staff}
          onClose={() => setShowAssign(false)}
          onSave={items => { onAssign(items); setShowAssign(false); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════════════════════════
function TopNav({ currentUser, activeView, setActiveView, onRefresh, users, setCurrentUser, checklists }) {
  const navItems = useMemo(() => {
    if (currentUser.role==="staff") return [
      { id:"dashboard", label:"Dashboard", icon:"🏠" },
      { id:"my",        label:"My Checklists", icon:"📋" },
    ];
    if (currentUser.role==="incharge") return [
      { id:"dashboard", label:"Dashboard",    icon:"🏠" },
      { id:"all",       label:"Checklists",   icon:"📋" },
      { id:"monitor",   label:"Monitor",      icon:"📊" },
    ];
    return [
      { id:"dashboard", label:"Dashboard",    icon:"🏠" },
      { id:"all",       label:"All Checklists",icon:"📋" },
      { id:"monitor",   label:"Monitor",      icon:"📊" },
    ];
  }, [currentUser.role]);

  const pendingReview = checklists.filter(c => {
    const steps = PIPELINE_STEPS[c.exam_type]||[];
    const deptOk = currentUser.role==="admin" || c.department===currentUser.department;
    return deptOk && steps.some(s => c.step_data?.[s.key]?.status==="submitted");
  }).length;

  return (
    <div style={{ background:"white", borderBottom:`1px solid ${T.border}`, boxShadow:"0 2px 8px rgba(0,0,0,.06)", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", height:56, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ background:T.accentG, borderRadius:10, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏆</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:T.text, letterSpacing:-.2 }}>GNSI Exam Checklist</div>
            <div style={{ fontSize:11, color:T.textMid }}>Monthly · Pre Mock · Mega Mock</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {pendingReview>0 && (
            <button onClick={() => setActiveView("all")} style={{ ...G.btnSm(T.warn), fontSize:12 }}>⏳ {pendingReview} Awaiting Approval</button>
          )}
          {currentUser.role==="admin" && users.length>1 && (
            <select style={{ ...G.inp, width:"auto", padding:"7px 10px", fontSize:12, borderRadius:8 }}
              value={currentUser.id} onChange={e => setCurrentUser(users.find(u=>u.id===+e.target.value)||users[0])}>
              {users.map(u=><option key={u.id} value={u.id}>{u.name} ({roleLabel[u.role]||u.role})</option>)}
            </select>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:T.surface2, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"7px 12px" }}>
            <Avatar name={currentUser.name} role={currentUser.role} size={26} />
            <div>
              <div style={{ fontSize:12, fontWeight:700 }}>{currentUser.name}</div>
              <div style={{ fontSize:10, fontWeight:700, color:roleColor[currentUser.role], textTransform:"uppercase" }}>{roleLabel[currentUser.role]}</div>
            </div>
          </div>
          <button onClick={onRefresh} style={{ ...G.btnSm(T.surface2), border:`1.5px solid ${T.border}`, color:T.textMid, fontSize:13 }}>🔄</button>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", padding:"0 28px", gap:2 }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setActiveView(n.id)} style={{ display:"flex", alignItems:"center", gap:7, padding:"13px 18px", border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:activeView===n.id?700:500, color:activeView===n.id?T.accent:T.textMid, borderBottom:activeView===n.id?`2.5px solid ${T.accent}`:"2.5px solid transparent", marginBottom:-1, whiteSpace:"nowrap" }}>
            <span style={{ fontSize:15 }}>{n.icon}</span>{n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BottomNav({ currentUser, activeView, setActiveView }) {
  const navItems = useMemo(() => {
    if (currentUser.role==="staff") return [
      { id:"dashboard", label:"Home",   icon:"🏠" },
      { id:"my",        label:"Tasks",  icon:"📋" },
    ];
    if (currentUser.role==="incharge") return [
      { id:"dashboard", label:"Home",      icon:"🏠" },
      { id:"all",       label:"Checklists",icon:"📋" },
      { id:"monitor",   label:"Monitor",   icon:"📊" },
    ];
    return [
      { id:"dashboard", label:"Home",      icon:"🏠" },
      { id:"all",       label:"All",       icon:"📋" },
      { id:"monitor",   label:"Monitor",   icon:"📊" },
    ];
  }, [currentUser.role]);

  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:T.surface, borderTop:`1.5px solid ${T.border}`, display:"flex", zIndex:200, paddingBottom:"env(safe-area-inset-bottom)", boxShadow:"0 -2px 10px rgba(0,0,0,.08)" }}>
      {navItems.map(n => (
        <button key={n.id} onClick={() => setActiveView(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, padding:"12px 4px 10px", background:"none", border:"none", color:activeView===n.id?T.accent:T.textMid, cursor:"pointer", fontFamily:"inherit", fontSize:F.xs, fontWeight:activeView===n.id?700:500, borderTop:activeView===n.id?`3px solid ${T.accent}`:"3px solid transparent" }}>
          <span style={{ fontSize:22 }}>{n.icon}</span>{n.label}
        </button>
      ))}
    </div>
  );
}

function MobileHeader({ currentUser, activeView, checklists, onRefresh, users, setCurrentUser }) {
  const [showPicker, setShowPicker] = useState(false);
  const VIEW_LABEL = { dashboard:"Dashboard", all:"Checklists", my:"My Checklists", monitor:"Monitor" };
  const pendingReview = checklists.filter(c => {
    const steps = PIPELINE_STEPS[c.exam_type]||[];
    const ok = currentUser.role==="admin"||c.department===currentUser.department;
    return ok && steps.some(s=>c.step_data?.[s.key]?.status==="submitted");
  }).length;

  return (
    <div style={{ background:T.surface, borderBottom:`1.5px solid ${T.border}`, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px" }}>
        <div>
          <div style={{ fontSize:F.xs, color:T.accent, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>GNSI Exam Checklist</div>
          <div style={{ fontSize:F.xl, fontWeight:800, color:T.text, lineHeight:1.2 }}>{VIEW_LABEL[activeView]||"Dashboard"}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          {pendingReview>0 && <div style={{ background:T.warn, color:"white", borderRadius:99, fontSize:F.sm, fontWeight:800, padding:"3px 10px" }}>{pendingReview}</div>}
          {currentUser.role==="admin" ? (
            <button onClick={() => setShowPicker(v=>!v)} style={{ display:"flex", alignItems:"center", gap:7, background:T.surface2, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"8px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:F.sm, fontWeight:600 }}>
              <Avatar name={currentUser.name} role={currentUser.role} size={26} />
              <span style={{ fontSize:F.xs, color:roleColor[currentUser.role], fontWeight:700, textTransform:"uppercase" }}>{roleLabel[currentUser.role]}</span>
            </button>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:7, background:T.surface2, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"8px 12px" }}>
              <Avatar name={currentUser.name} role={currentUser.role} size={26} />
              <span style={{ fontSize:F.xs, color:roleColor[currentUser.role], fontWeight:700, textTransform:"uppercase" }}>{roleLabel[currentUser.role]}</span>
            </div>
          )}
          <button onClick={onRefresh} style={{ background:T.surface2, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"10px 12px", cursor:"pointer", color:T.textMid, fontSize:F.md }}>🔄</button>
        </div>
      </div>
      {showPicker && currentUser.role==="admin" && users.length>1 && (
        <div style={{ padding:"10px 16px 14px", borderTop:`1px solid ${T.border}`, background:T.surface2 }}>
          <label style={G.lbl}>Switch User</label>
          <select style={G.inp} value={currentUser.id} onChange={e => { setCurrentUser(users.find(u=>u.id===+e.target.value)||users[0]); setShowPicker(false); }}>
            {users.map(u=><option key={u.id} value={u.id}>{u.name} ({roleLabel[u.role]||u.role})</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONITOR VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function MonitorView({ currentUser, checklists, staff, isMobile }) {
  const staffStats = staff.filter(s=>s.role==="staff").map(s => {
    const my = checklists.filter(c=>c.assigned_to_id===s.id);
    const approved = my.filter(c=>c.status==="finalized"||c.status==="completed").length;
    const pending  = my.filter(c=>{
      const steps=PIPELINE_STEPS[c.exam_type]||[];
      return steps.some(st=>c.step_data?.[st.key]?.status==="submitted");
    }).length;
    return { ...s, total:my.length, approved, pending };
  }).sort((a,b)=>b.pending-a.pending||b.total-a.total);

  return (
    <div>
      {!isMobile && <h2 style={{ fontSize:20, fontWeight:800, color:T.text, margin:"0 0 16px" }}>Exam Monitor</h2>}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {EXAM_TYPES.map(et => {
          const list = checklists.filter(c=>c.exam_type===et);
          const done = list.filter(c=>c.status==="finalized").length;
          const m    = EXAM_META[et];
          const pct  = list.length>0?Math.round((done/list.length)*100):0;
          return (
            <div key={et} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16, boxShadow:T.shadow }}>
              <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:12 }}>
                <span style={{ fontSize:24 }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize:F.base, fontWeight:700, color:T.text }}>{et}</div>
                  <div style={{ fontSize:F.xs, color:T.textMid }}>{list.length} assigned</div>
                </div>
              </div>
              <div style={{ height:7, borderRadius:99, background:T.surface2, marginBottom:6, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:m.color, borderRadius:99 }} />
              </div>
              <div style={{ fontSize:F.xs, color:T.textMid }}>{done}/{list.length} finalized · {pct}%</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:F.sm, fontWeight:700, color:T.textMid, textTransform:"uppercase", marginBottom:12 }}>Staff Progress</div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(270px,1fr))", gap:11 }}>
        {staffStats.map(s => {
          const pct   = s.total>0?Math.round((s.approved/s.total)*100):0;
          const color = s.pending>0?T.warn:pct>=80?T.success:pct>=50?T.info:T.textDim;
          return (
            <div key={s.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16, borderTop:`3px solid ${color}`, boxShadow:T.shadow }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <Avatar name={s.name} role={s.role} size={36} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:F.md, fontWeight:700, color:T.text }}>{s.name}</div>
                  <div style={{ fontSize:F.sm, color:T.textMid }}>{s.department}</div>
                </div>
                <span style={{ fontSize:F.xl, fontWeight:800, color }}>{pct}%</span>
              </div>
              <div style={{ height:6, borderRadius:99, background:T.surface2, marginBottom:10, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99 }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7 }}>
                {[["Assigned",s.total,"#7c3aed"],["Done",s.approved,T.success],["Review",s.pending,T.warn]].map(([l,v,c])=>(
                  <div key={l} style={{ textAlign:"center", background:T.surface2, borderRadius:9, padding:"9px 4px", border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:F.lg, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:F.xs, color:T.textMid }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {staffStats.length===0 && <div style={{ fontSize:F.base, color:T.textMid, padding:"30px 0" }}>No staff data.</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Checklist({ currentUser: portalUser }) {
  const [w, setW] = useState(typeof window!=="undefined"?window.innerWidth:1024);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isMobile = w < 768;

  const [users,       setUsers]       = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [checklists,  setChecklists]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeView,  setActiveView]  = useState("dashboard");
  const [toast,       setToast]       = useState({ msg:"", type:"success" });
  const [openChecklist, setOpenChecklist] = useState(null);

  const mountedRef    = useRef(true);
  const toastTimerRef = useRef(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  const showToast = useCallback((msg, type="success") => {
    if (!mountedRef.current) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => { if (mountedRef.current) setToast({ msg:"", type:"success" }); }, 3200);
  }, []);

  const fetchAll = useCallback(async (resolvedUser) => {
    setLoading(true);
    try {
      const usersData = await db.getUsers();
      if (!mountedRef.current) return;
      setUsers(usersData);

      let activeUser = resolvedUser;
      const portalRole = portalUser?.role?.toLowerCase() || "";
      if (!activeUser) {
        if (["admin","administrator"].includes(portalRole)) {
          activeUser = { id:0, name:"Administrator", role:"admin", department:"Administration", designation:"Administrator", status:"Active" };
        } else {
          if (portalUser?.staff_profile_id) activeUser = usersData.find(u=>u.id===portalUser.staff_profile_id)||null;
          if (!activeUser && portalUser?.name) activeUser = usersData.find(u=>u.name===portalUser.name)||null;
          if (!activeUser) { showToast("⚠️ Staff profile not found.", "error"); setLoading(false); return; }
          if (["incharge","in-charge","manager"].includes(portalRole)) activeUser = { ...activeUser, role:"incharge" };
          else activeUser = { ...activeUser, role:"staff" };
        }
      }
      if (!mountedRef.current) return;
      setCurrentUser(activeUser);
      const data = await db.getExamChecklists(activeUser);
      if (!mountedRef.current) return;
      setChecklists(data);
    } catch(err) {
      if (!mountedRef.current) return;
      showToast("⚠️ " + err.message, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [portalUser, showToast]);

  useEffect(() => { fetchAll(null); }, [fetchAll]);

  const prevUserIdRef = useRef(null);
  useEffect(() => {
    if (currentUser?.id && currentUser.id !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUser.id;
      setActiveView("dashboard");
    }
  }, [currentUser?.id]);

  const handleSetCurrentUser = useCallback((user) => {
    setCurrentUser(user);
    db.getExamChecklists(user).then(d => { if (mountedRef.current) setChecklists(d); }).catch(()=>{});
  }, []);

  const handleAssign = useCallback((items) => {
    setChecklists(prev => [...items, ...prev]);
    showToast(`✅ ${items.length} checklist${items.length!==1?"s":""} assigned!`);
  }, [showToast]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this checklist?")) return;
    try {
      await db.deleteExamChecklist(id);
      if (mountedRef.current) setChecklists(prev => prev.filter(c=>c.id!==id));
      showToast("🗑️ Deleted", "info");
    } catch(e) { showToast("Error: "+e.message, "error"); }
  }, [showToast]);

  const handleUpdate = useCallback((updated) => {
    if (!updated) return;
    setChecklists(prev => prev.map(c => c.id===updated.id ? updated : c));
    // Sync open checklist
    setOpenChecklist(prev => prev?.id===updated.id ? updated : prev);
    const allSteps = PIPELINE_STEPS[updated.exam_type]||[];
    const allApproved = allSteps.every(s=>updated.step_data?.[s.key]?.status==="approved");
    if (updated.status==="finalized") showToast("🏁 Exam checklist finalized!");
    else if (allApproved) showToast("✅ All steps approved — ready for sign-off!");
    else showToast("✅ Step updated!");
  }, [showToast]);

  const activeUser = currentUser || {
    id:0, name:portalUser?.name||"User",
    role:portalUser?.role?.toLowerCase()==="admin"?"admin":"staff",
    department:"Administration",
  };

  if (loading && !currentUser) {
    return (
      <div style={{ ...G.page, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:18 }}>
        <Spinner />
      </div>
    );
  }

  const filteredChecklists = checklists; // already server-filtered
  const viewProps = { currentUser:activeUser, checklists:filteredChecklists, staff:users, isMobile,
    onOpen:setOpenChecklist, onDelete:handleDelete, onAssign:handleAssign };

  const renderView = () => {
    if (loading) return <Spinner />;
    switch(activeView) {
      case "dashboard": return <DashboardView {...viewProps} />;
      case "all": case "my": return <ChecklistsView {...viewProps} />;
      case "monitor": return <MonitorView {...viewProps} />;
      default: return <DashboardView {...viewProps} />;
    }
  };

  return (
    <div style={G.page}>
      <Toast msg={toast.msg} type={toast.type} />
      {isMobile ? (
        <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          <MobileHeader currentUser={activeUser} activeView={activeView} checklists={checklists} onRefresh={() => fetchAll(activeUser)} users={users} setCurrentUser={handleSetCurrentUser} />
          <div style={{ flex:1, padding:"16px 14px", paddingBottom:88 }}>
            {renderView()}
          </div>
          <BottomNav currentUser={activeUser} activeView={activeView} setActiveView={setActiveView} />
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          <TopNav currentUser={activeUser} activeView={activeView} setActiveView={setActiveView} onRefresh={() => fetchAll(activeUser)} users={users} setCurrentUser={handleSetCurrentUser} checklists={checklists} />
          <div style={{ flex:1, padding:28 }}>
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