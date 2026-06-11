import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const ROLE_MAP = {
  admin:"admin", administrator:"admin", "super admin":"admin", superadmin:"admin",
  principal:"admin", director:"admin", "teaching + admin":"admin",
  incharge:"incharge", "in-charge":"incharge", "in charge":"incharge",
  manager:"incharge", coordinator:"incharge", hod:"incharge",
  "head of department":"incharge", supervisor:"incharge", superintendent:"incharge",
};
function resolveRole(r) { return r ? (ROLE_MAP[r.toLowerCase().trim()] || "staff") : "staff"; }

function resolveActiveUser(portalUser, staffList) {
  const portalRole = resolveRole(portalUser?.role);
  if (portalRole === "admin" && !portalUser?.staff_profile_id) {
    return { id:0, name:portalUser?.name||"Administrator", role:"admin",
      department:portalUser?.department||"Administration", designation:"Administrator",
      email:portalUser?.email||"", isSynthetic:true };
  }
  let match = null;
  if (portalUser?.staff_profile_id) match = staffList.find(s => s.id === portalUser.staff_profile_id);
  if (!match && portalUser?.email) match = staffList.find(s => s.email?.toLowerCase() === portalUser.email?.toLowerCase());
  if (!match && portalUser?.name) match = staffList.find(s => s.name?.toLowerCase() === portalUser.name?.toLowerCase());
  if (!match) return null;
  const finalRole = portalRole === "admin" ? "admin" : portalRole === "incharge" ? "incharge" : resolveRole(match.role);
  return { id:match.id, name:match.name, role:finalRole, department:match.department||"General",
    designation:match.designation||"", email:match.email||"", phone:match.phone||"", isSynthetic:false };
}

const PERMS = {
  canAssign:      u => u.role === "admin" || u.role === "incharge",
  canDelete:      (u,c) => u.role === "admin" || (u.role === "incharge" && c.department === u.department),
  canApprove:     u => u.role === "admin" || u.role === "incharge",
  canFinalize:    u => u.role === "admin" || u.role === "incharge",
  canSubmitStep:  (u,st) => u.role === "staff" && (st === "pending" || st === "in_progress" || st === "rejected"),
  canSwitchUser:  u => u.role === "admin",
  canViewMonitor: u => u.role === "admin" || u.role === "incharge",
};

const EXAM_TYPES = ["Monthly Test", "Pre Mock Test", "Mega Mock Test"];
const PIPELINE_STEPS = {
  "Monthly Test": [
    { key:"syllabus_confirm", label:"Syllabus Confirmation",  icon:"📚", desc:"Confirm syllabus coverage and share with staff" },
    { key:"question_setting", label:"Question Paper Setting", icon:"✏️",  desc:"Prepare and seal question paper" },
    { key:"printing",         label:"Printing & Packaging",   icon:"🖨️",  desc:"Print, collate and pack answer booklets" },
    { key:"conducting",       label:"Conducting Exam",        icon:"🏫",  desc:"Supervise and conduct the examination" },
    { key:"collection",       label:"Script Collection",      icon:"📦",  desc:"Collect and count all answer scripts" },
    { key:"evaluation",       label:"Paper Evaluation",       icon:"📝",  desc:"Evaluate scripts and enter marks" },
    { key:"result_entry",     label:"Result Entry",           icon:"💻",  desc:"Enter marks in portal / register" },
    { key:"report",           label:"Report & Sign-off",      icon:"📊",  desc:"Prepare result report for authority" },
  ],
  "Pre Mock Test": [
    { key:"schedule",         label:"Schedule & Timetable",   icon:"🗓️",  desc:"Finalise exam schedule and assign invigilators" },
    { key:"question_setting", label:"Question Paper Setting", icon:"✏️",  desc:"Prepare mock-level question papers" },
    { key:"printing",         label:"Printing & Packaging",   icon:"🖨️",  desc:"Print, collate and pack" },
    { key:"seating_plan",     label:"Seating Arrangement",    icon:"🪑",  desc:"Prepare seating chart for all students" },
    { key:"conducting",       label:"Conducting Exam",        icon:"🏫",  desc:"Conduct under mock conditions" },
    { key:"collection",       label:"Script Collection",      icon:"📦",  desc:"Collect and verify script count" },
    { key:"evaluation",       label:"Evaluation",             icon:"📝",  desc:"Evaluate and record marks" },
    { key:"result_entry",     label:"Result Entry & Analysis",icon:"💻",  desc:"Enter marks and prepare analysis" },
    { key:"report",           label:"Final Report & Sign-off",icon:"📊",  desc:"Submit final pre-mock report" },
  ],
  "Mega Mock Test": [
    { key:"planning",         label:"Full Exam Planning",          icon:"🗺️",  desc:"Plan logistics, manpower, and venues" },
    { key:"schedule",         label:"Schedule & Communication",    icon:"🗓️",  desc:"Communicate schedule to all stakeholders" },
    { key:"question_setting", label:"Question Paper Setting",      icon:"✏️",  desc:"Prepare exam-standard question papers" },
    { key:"printing",         label:"Bulk Printing & Packing",     icon:"🖨️",  desc:"Large-scale printing with labelled packs" },
    { key:"seating_plan",     label:"Seating Plan",                icon:"🪑",  desc:"Detailed seating for all batches" },
    { key:"invigilator",      label:"Invigilator Assignment",      icon:"👁️",  desc:"Assign and brief all invigilators" },
    { key:"conducting",       label:"Conducting Exam",             icon:"🏫",  desc:"Full-day exam conduct with supervision" },
    { key:"collection",       label:"Script Collection & Count",   icon:"📦",  desc:"Collect, count and pack all scripts" },
    { key:"evaluation",       label:"Evaluation",                  icon:"📝",  desc:"Evaluate all scripts accurately" },
    { key:"result_entry",     label:"Result Entry",                icon:"💻",  desc:"Enter all marks in portal" },
    { key:"analysis",         label:"Performance Analysis",        icon:"📈",  desc:"Prepare subject-wise analysis report" },
    { key:"report",           label:"Final Sign-off & Report",     icon:"📊",  desc:"Submit comprehensive exam report to admin" },
  ],
};

const EVENT_TYPES = [
  "Annual Day / Prize Distribution",
  "Sports Day",
  "Cultural Event",
  "Parent-Teacher Meeting",
  "Independence / Republic Day",
  "Admission Camp / Open Day",
  "Other",
];

const EVENT_STEPS = {
  "Annual Day / Prize Distribution": [
    { key:"planning",    label:"Event Planning",       icon:"🗺️",  desc:"Finalise program, budget, and responsibilities" },
    { key:"venue",       label:"Venue Setup",          icon:"🏛️",  desc:"Arrange hall, stage, seating and decoration" },
    { key:"invitations", label:"Invitations & Comms",  icon:"✉️",  desc:"Send invites to parents, guests and dignitaries" },
    { key:"rehearsal",   label:"Rehearsal",            icon:"🎭",  desc:"Full dress rehearsal for all performers" },
    { key:"conduct",     label:"Day Conduct",          icon:"🎪",  desc:"Conduct the event smoothly on the day" },
    { key:"prizes",      label:"Prize Distribution",   icon:"🏆",  desc:"Distribute prizes and certificates" },
    { key:"cleanup",     label:"Post-Event Cleanup",   icon:"🧹",  desc:"Restore venue and collect materials" },
    { key:"report",      label:"Report & Sign-off",    icon:"📊",  desc:"Submit event report with photos" },
  ],
  "Sports Day": [
    { key:"planning",      label:"Event Planning",        icon:"🗺️",  desc:"Finalise events, schedule and responsibilities" },
    { key:"ground",        label:"Ground Preparation",    icon:"🏟️",  desc:"Mark ground, set up tracks and equipment" },
    { key:"registration",  label:"Team Registration",     icon:"📋",  desc:"Register participants and assign house teams" },
    { key:"equipment",     label:"Equipment Arrangement", icon:"🏋️",  desc:"Arrange all sports equipment and first aid" },
    { key:"conduct",       label:"Day Conduct",           icon:"🏃",  desc:"Conduct all events with proper officiating" },
    { key:"results",       label:"Results Tabulation",    icon:"📊",  desc:"Tabulate all results and declare winners" },
    { key:"prizes",        label:"Prize Distribution",    icon:"🥇",  desc:"Distribute trophies, medals and certificates" },
    { key:"report",        label:"Report & Sign-off",     icon:"📝",  desc:"Submit sports day report with results" },
  ],
  "Cultural Event": [
    { key:"planning",      label:"Event Planning",       icon:"🗺️",  desc:"Finalise program, roles and budget" },
    { key:"performers",    label:"Performer Selection",  icon:"🎭",  desc:"Audition and finalise all performers" },
    { key:"rehearsal",     label:"Rehearsals",           icon:"🎵",  desc:"Conduct regular rehearsals and full dress" },
    { key:"stage",         label:"Stage Setup",          icon:"🎪",  desc:"Set up stage, lights, sound and props" },
    { key:"conduct",       label:"Day Conduct",          icon:"🎨",  desc:"Conduct event with smooth coordination" },
    { key:"documentation", label:"Documentation",        icon:"📸",  desc:"Photograph and document the event" },
    { key:"report",        label:"Report & Sign-off",    icon:"📊",  desc:"Submit event report" },
  ],
  "Parent-Teacher Meeting": [
    { key:"schedule",      label:"Schedule & Date Fix",  icon:"🗓️",  desc:"Fix date, time slots and assign teachers" },
    { key:"communication", label:"Parent Communication", icon:"📢",  desc:"Send notices/SMS to all parents" },
    { key:"venue",         label:"Venue Preparation",    icon:"🏫",  desc:"Arrange seating, records and report cards" },
    { key:"conduct",       label:"Meeting Conduct",      icon:"🤝",  desc:"Conduct all meetings per schedule" },
    { key:"minutes",       label:"Minutes Recording",    icon:"📝",  desc:"Record key discussion points and concerns" },
    { key:"followup",      label:"Follow-up Actions",    icon:"✅",  desc:"Address concerns raised by parents" },
    { key:"report",        label:"Report & Sign-off",    icon:"📊",  desc:"Submit PTM summary report" },
  ],
  "Independence / Republic Day": [
    { key:"planning",  label:"Event Planning",        icon:"🗺️",  desc:"Plan program, assign roles and responsibilities" },
    { key:"flag_prep", label:"Flag & Ground Prep",    icon:"🚩",  desc:"Prepare ground, flag post and decorations" },
    { key:"program",   label:"Program Finalisation",  icon:"📋",  desc:"Finalise speeches, march-past and cultural items" },
    { key:"rehearsal", label:"Rehearsal",             icon:"🎭",  desc:"Full dress rehearsal with all participants" },
    { key:"conduct",   label:"Day Conduct",           icon:"🏳️",  desc:"Conduct flag hoisting ceremony and programs" },
    { key:"report",    label:"Report & Sign-off",     icon:"📊",  desc:"Submit event report with photos" },
  ],
  "Admission Camp / Open Day": [
    { key:"planning",  label:"Event Planning",       icon:"🗺️",  desc:"Plan schedule, stalls and presentations" },
    { key:"marketing", label:"Marketing & Promotion",icon:"📢",  desc:"Distribute pamphlets, social media, banners" },
    { key:"venue",     label:"Venue Setup",          icon:"🏫",  desc:"Set up info stalls, banner displays, seating" },
    { key:"conduct",   label:"Day Conduct",          icon:"🎯",  desc:"Conduct demos, counselling and registrations" },
    { key:"leads",     label:"Lead Recording",       icon:"📋",  desc:"Record all enquiries and contact details" },
    { key:"followup",  label:"Follow-up",            icon:"📞",  desc:"Follow up with all enquiries within 48 hours" },
    { key:"report",    label:"Report & Sign-off",    icon:"📊",  desc:"Submit admission camp report and lead count" },
  ],
  "Other": [
    { key:"planning",      label:"Planning",       icon:"🗺️",  desc:"Plan the event end to end" },
    { key:"preparation",   label:"Preparation",    icon:"⚙️",  desc:"Prepare all materials and logistics" },
    { key:"execution",     label:"Execution",      icon:"🎯",  desc:"Execute the event as planned" },
    { key:"documentation", label:"Documentation",  icon:"📸",  desc:"Document proceedings and outcomes" },
    { key:"report",        label:"Report & Sign-off",icon:"📊",desc:"Submit final report" },
  ],
};

const EVENT_META = {
  "Annual Day / Prize Distribution": { color:"#7c3aed", soft:"#ede9fe", icon:"🎖️",  grad:"linear-gradient(135deg,#7c3aed,#8b5cf6)" },
  "Sports Day":                       { color:"#059669", soft:"#ecfdf5", icon:"🏃",  grad:"linear-gradient(135deg,#059669,#10b981)" },
  "Cultural Event":                   { color:"#db2777", soft:"#fdf2f8", icon:"🎭",  grad:"linear-gradient(135deg,#db2777,#ec4899)" },
  "Parent-Teacher Meeting":           { color:"#0284c7", soft:"#e0f2fe", icon:"🤝",  grad:"linear-gradient(135deg,#0284c7,#0ea5e9)" },
  "Independence / Republic Day":      { color:"#b45309", soft:"#fef3c7", icon:"🚩",  grad:"linear-gradient(135deg,#b45309,#d97706)" },
  "Admission Camp / Open Day":        { color:"#0f766e", soft:"#f0fdfa", icon:"🎯",  grad:"linear-gradient(135deg,#0f766e,#14b8a6)" },
  "Other":                            { color:"#64748b", soft:"#f1f5f9", icon:"📌",  grad:"linear-gradient(135deg,#64748b,#94a3b8)" },
};

const db = {
  async getStaffProfiles() {
    const { data, error } = await supabase.from("staff_profiles")
      .select("id,name,role,department,designation,phone,email,status")
      .eq("status","Active").order("name");
    if (error) throw error;
    return data || [];
  },
  async getExamChecklists(user) {
    let q = supabase.from("exam_checklists").select("*").order("created_at",{ascending:false});
    if (user.role==="staff") q = q.eq("assigned_to_id",user.id);
    else if (user.role==="incharge") q = q.eq("department",user.department);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async getEventChecklists(user) {
    let q = supabase.from("event_checklists").select("*").order("created_at",{ascending:false});
    if (user.role==="staff") q = q.eq("assigned_to_id",user.id);
    else if (user.role==="incharge") q = q.eq("department",user.department);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async createExamChecklist(p) {
    const { data, error } = await supabase.from("exam_checklists").insert([p]).select().single();
    if (error) throw error; return data;
  },
  async createEventChecklist(p) {
    const { data, error } = await supabase.from("event_checklists").insert([p]).select().single();
    if (error) throw error; return data;
  },
  async updateExamChecklist(id, ch) {
    const { data, error } = await supabase.from("exam_checklists")
      .update({...ch, updated_at:new Date().toISOString()}).eq("id",id).select().single();
    if (error) throw error; return data;
  },
  async updateEventChecklist(id, ch) {
    const { data, error } = await supabase.from("event_checklists")
      .update({...ch, updated_at:new Date().toISOString()}).eq("id",id).select().single();
    if (error) throw error; return data;
  },
  async deleteExamChecklist(id) {
    const { error } = await supabase.from("exam_checklists").delete().eq("id",id);
    if (error) throw error;
  },
  async deleteEventChecklist(id) {
    const { error } = await supabase.from("event_checklists").delete().eq("id",id);
    if (error) throw error;
  },
};

const DEPARTMENTS = ["Administration","Academic","Accounts","Hostel","Reception","Transport","Maintenance"];
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtTime = d => d ? new Date(d).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
const initials = n => n?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "?";

const C = {
  bg:"#f5f7fa", surface:"#ffffff", surface2:"#f1f4f8", border:"#e3e8ef",
  brand:"#1e40af", brandMid:"#2563eb", brandSoft:"#dbeafe",
  success:"#16a34a", successSoft:"#f0fdf4",
  warn:"#d97706", warnSoft:"#fffbeb",
  danger:"#dc2626", dangerSoft:"#fef2f2",
  info:"#0284c7", infoSoft:"#e0f2fe",
  text:"#0f172a", textMid:"#475569", textDim:"#94a3b8",
  shadow:"0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04)",
  shadowMd:"0 4px 16px rgba(0,0,0,.09)",
  shadowLg:"0 20px 60px rgba(0,0,0,.18)",
};
const EXAM_META = {
  "Monthly Test":   { color:"#0284c7", soft:"#e0f2fe", icon:"📋", grad:"linear-gradient(135deg,#0284c7,#0ea5e9)" },
  "Pre Mock Test":  { color:"#7c3aed", soft:"#ede9fe", icon:"🎯", grad:"linear-gradient(135deg,#7c3aed,#8b5cf6)" },
  "Mega Mock Test": { color:"#b45309", soft:"#fef3c7", icon:"🏆", grad:"linear-gradient(135deg,#b45309,#d97706)" },
};
const STEP_META = {
  pending:     { color:"#94a3b8", soft:"#f1f5f9", label:"Pending",         dot:"#cbd5e1" },
  in_progress: { color:"#0284c7", soft:"#e0f2fe", label:"In Progress",     dot:"#0284c7" },
  submitted:   { color:"#d97706", soft:"#fffbeb", label:"Awaiting Review",  dot:"#d97706" },
  approved:    { color:"#16a34a", soft:"#f0fdf4", label:"Approved",         dot:"#16a34a" },
  rejected:    { color:"#dc2626", soft:"#fef2f2", label:"Rejected",         dot:"#dc2626" },
};
const ROLE_DISPLAY = {
  admin:    { label:"Admin",     color:"#4f46e5", soft:"#eef2ff" },
  incharge: { label:"In-charge", color:"#0284c7", soft:"#e0f2fe" },
  staff:    { label:"Staff",     color:"#16a34a", soft:"#f0fdf4" },
};
const F = { xs:12, sm:13, base:14, md:15, lg:17, xl:20, xxl:24, hero:28 };
const s = {
  card: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", boxShadow:C.shadow },
  input: { width:"100%", padding:"10px 13px", background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:F.base, boxSizing:"border-box", fontFamily:"inherit", outline:"none", lineHeight:1.5 },
  label: { display:"block", fontSize:F.xs, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".07em", marginBottom:5 },
  btn: (bg=C.brand,fg="white") => ({ background:bg, color:fg, border:"none", borderRadius:9, padding:"10px 18px", fontWeight:700, cursor:"pointer", fontSize:F.base, fontFamily:"inherit", lineHeight:1 }),
  btnSm: (bg=C.brand) => ({ background:bg, color:"white", border:"none", borderRadius:7, padding:"7px 13px", fontWeight:700, cursor:"pointer", fontSize:F.sm, fontFamily:"inherit", whiteSpace:"nowrap" }),
  btnGhost: { background:"none", border:`1.5px solid ${C.border}`, borderRadius:9, padding:"9px 14px", fontWeight:600, cursor:"pointer", fontSize:F.sm, fontFamily:"inherit", color:C.textMid },
};

function RoleBadge({ role }) {
  const r = ROLE_DISPLAY[role] || ROLE_DISPLAY.staff;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px", borderRadius:99, fontSize:F.xs, fontWeight:700, background:r.soft, color:r.color, border:`1px solid ${r.color}25` }}>
      {role==="admin"?"⬡":role==="incharge"?"◈":"○"} {r.label}
    </span>
  );
}
function StatusBadge({ status }) {
  const m = STEP_META[status] || STEP_META.pending;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:99, fontSize:F.xs, fontWeight:700, background:m.soft, color:m.color, border:`1px solid ${m.color}25`, whiteSpace:"nowrap" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:m.dot, display:"inline-block", flexShrink:0 }} />
      {m.label}
    </span>
  );
}
function Avatar({ name, role, size=36 }) {
  const r = ROLE_DISPLAY[role] || ROLE_DISPLAY.staff;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:r.soft, border:`2px solid ${r.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.33, fontWeight:800, color:r.color, flexShrink:0, letterSpacing:-0.5 }}>
      {initials(name)}
    </div>
  );
}
function Toast({ msg, type="success" }) {
  if (!msg) return null;
  const colors = { success:C.success, error:C.danger, info:C.info, warn:C.warn };
  const icons  = { success:"✓", error:"✕", info:"i", warn:"!" };
  const c = colors[type] || C.info;
  return (
    <div style={{ position:"fixed", top:18, left:"50%", transform:"translateX(-50%)", zIndex:9999, background:C.surface, borderRadius:11, boxShadow:C.shadowMd, fontSize:F.base, fontWeight:700, display:"flex", alignItems:"center", gap:10, padding:"12px 20px", maxWidth:"90vw", border:`1.5px solid ${c}30`, borderLeft:`4px solid ${c}` }}>
      <span style={{ width:22, height:22, borderRadius:"50%", background:`${c}18`, color:c, display:"flex", alignItems:"center", justifyContent:"center", fontSize:F.sm, fontWeight:900, flexShrink:0 }}>{icons[type]}</span>
      <span style={{ color:C.text }}>{msg}</span>
    </div>
  );
}
function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48, gap:12, color:C.textMid }}>
      <div style={{ width:22, height:22, border:`2.5px solid ${C.border}`, borderTop:`2.5px solid ${C.brand}`, borderRadius:"50%", animation:"spin .65s linear infinite" }} />
      <span style={{ fontSize:F.base }}>Loading…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{ background:C.dangerSoft, border:`1.5px solid ${C.danger}30`, borderRadius:12, padding:"18px 20px", display:"flex", alignItems:"flex-start", gap:14 }}>
      <span style={{ fontSize:20, flexShrink:0 }}>⚠️</span>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, color:C.danger, fontSize:F.md, marginBottom:4 }}>Could not load your profile</div>
        <div style={{ fontSize:F.sm, color:C.textMid, marginBottom:12, lineHeight:1.6 }}>{message}</div>
        {onRetry && <button onClick={onRetry} style={{ ...s.btn(C.danger), padding:"8px 16px", fontSize:F.sm }}>Retry</button>}
      </div>
    </div>
  );
}

function PipelineBar({ steps, stepData, compact=false, light=false }) {
  const approved = steps.filter(s => stepData?.[s.key]?.status==="approved").length;
  const pct = steps.length > 0 ? Math.round((approved/steps.length)*100) : 0;
  const barColor = pct===100?C.success:pct>=60?C.info:pct>=30?C.warn:C.textDim;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:F.xs, color:light?"rgba(255,255,255,.8)":C.textMid }}>{approved}/{steps.length} steps approved</span>
        <span style={{ fontSize:F.xs, fontWeight:800, color:light?"white":barColor }}>{pct}%</span>
      </div>
      <div style={{ height:compact?4:6, borderRadius:99, background:light?"rgba(255,255,255,.2)":C.surface2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:light?"white":barColor, borderRadius:99, transition:"width .4s ease", opacity:light?0.9:1 }} />
      </div>
      {!compact && (
        <div style={{ display:"flex", gap:4, marginTop:9, flexWrap:"wrap" }}>
          {steps.map(step => {
            const st = stepData?.[step.key]?.status || "pending";
            const m  = STEP_META[st];
            return <div key={step.key} title={`${step.label}: ${m.label}`} style={{ width:14, height:14, borderRadius:"50%", background:m.dot, flexShrink:0, opacity:st==="pending"?(light?0.35:0.22):1, transition:"opacity .2s" }} />;
          })}
        </div>
      )}
    </div>
  );
}

function StepRow({ step, stepState, isActive, isLocked, currentUser, onSubmitStep, onApproveStep, onRejectStep, stepIndex }) {
  const [expanded, setExpanded] = useState(false);
  const [note,     setNote]     = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving,   setSaving]   = useState(false);

  const st = stepState?.status || "pending";
  const canSubmit  = PERMS.canSubmitStep(currentUser, st) && isActive;
  const canApprove = PERMS.canApprove(currentUser) && st==="submitted";

  const numBg = st==="approved" ? { bg:C.successSoft, border:"#86efac", color:C.success }
    : isActive ? { bg:C.infoSoft, border:"#7dd3fc", color:C.info }
    : { bg:C.surface2, border:C.border, color:C.textDim };

  const doSubmit = async () => {
    if (!note.trim()) { alert("Add a completion note."); return; }
    setSaving(true);
    try { await onSubmitStep(step.key, note); setNote(""); setExpanded(false); }
    catch(e) { alert(e.message); } finally { setSaving(false); }
  };
  const doApprove = async () => {
    setSaving(true);
    try { await onApproveStep(step.key, feedback); setFeedback(""); setExpanded(false); }
    catch(e) { alert(e.message); } finally { setSaving(false); }
  };
  const doReject = async () => {
    if (!feedback.trim()) { alert("Provide a rejection reason."); return; }
    setSaving(true);
    try { await onRejectStep(step.key, feedback); setFeedback(""); setExpanded(false); }
    catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ borderBottom:`0.5px solid ${C.border}` }}>
      <div onClick={() => !isLocked && setExpanded(v=>!v)}
        style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 20px", cursor:isLocked?"default":"pointer", background:expanded?C.surface2:"transparent", transition:"background .1s", opacity:isLocked?0.4:1 }}>
        <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, flexShrink:0, background:numBg.bg, border:`0.5px solid ${numBg.border}`, color:numBg.color }}>
          {st==="approved"?"✓":stepIndex+1}
        </div>
        <div style={{ width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0, background:st==="approved"?C.successSoft:isActive?C.infoSoft:C.surface2, border:`0.5px solid ${C.border}` }}>
          {step.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:isLocked?C.textDim:C.text, marginBottom:1 }}>{step.label}</div>
          <div style={{ fontSize:11, color:C.textDim }}>{step.desc}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
          {isActive && st!=="approved" && <span style={{ fontSize:10, fontWeight:600, color:C.info, background:C.infoSoft, padding:"2px 8px", borderRadius:99, border:`0.5px solid #7dd3fc` }}>Active</span>}
          <StatusBadge status={st} />
          {!isLocked && <span style={{ fontSize:11, color:C.textDim, transform:expanded?"rotate(180deg)":"none", transition:"transform .2s", display:"inline-block" }}>▾</span>}
        </div>
      </div>
      {expanded && !isLocked && (
        <div style={{ padding:"0 20px 16px", background:C.surface2, borderTop:`0.5px solid ${C.border}` }}>
          {stepState?.note && (
            <div style={{ background:C.surface, border:`0.5px solid ${C.border}`, borderRadius:10, padding:"11px 13px", marginTop:12, marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em", color:C.textDim, marginBottom:5 }}>Staff note</div>
              <div style={{ fontSize:13, color:C.text, lineHeight:1.6 }}>"{stepState.note}"</div>
              {stepState.submitted_at && <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>Submitted {fmtTime(stepState.submitted_at)} by {stepState.submitted_by}</div>}
            </div>
          )}
          {stepState?.feedback && (
            <div style={{ background:C.surface, border:`0.5px solid ${st==="rejected"?"#fca5a5":C.border}`, borderRadius:10, padding:"11px 13px", marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em", color:C.textDim, marginBottom:5 }}>{st==="rejected"?"Rejection reason":"Approval note"}</div>
              <div style={{ fontSize:13, color:st==="rejected"?C.danger:C.success, lineHeight:1.6 }}>{stepState.feedback}</div>
              {stepState.reviewed_at && <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>by {stepState.reviewed_by} · {fmtTime(stepState.reviewed_at)}</div>}
            </div>
          )}
          {canSubmit && (
            <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.textMid, textTransform:"uppercase", letterSpacing:".06em" }}>Completion note</div>
              <textarea style={{ width:"100%", padding:"9px 12px", border:`0.5px solid ${C.border}`, borderRadius:9, background:C.surface, color:C.text, fontSize:13, fontFamily:"inherit", resize:"vertical", minHeight:70, lineHeight:1.6, outline:"none", boxSizing:"border-box" }}
                value={note} onChange={e=>setNote(e.target.value)} placeholder={`Describe what was completed for "${step.label}"…`} />
              <button onClick={doSubmit} disabled={saving||!note.trim()} style={{ padding:"9px 18px", borderRadius:9, background:C.brand, color:"white", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:saving||!note.trim()?0.5:1 }}>
                {saving?"Submitting…":"Submit for review →"}
              </button>
            </div>
          )}
          {canApprove && (
            <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.textMid, textTransform:"uppercase", letterSpacing:".06em" }}>Feedback <span style={{ fontWeight:400, textTransform:"none" }}>(optional for approval)</span></div>
              <textarea style={{ width:"100%", padding:"9px 12px", border:`0.5px solid ${C.border}`, borderRadius:9, background:C.surface, color:C.text, fontSize:13, fontFamily:"inherit", resize:"vertical", minHeight:54, lineHeight:1.6, outline:"none", boxSizing:"border-box" }}
                value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Add feedback or rejection reason…" />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={doApprove} disabled={saving} style={{ flex:1, padding:"9px 14px", borderRadius:9, background:C.successSoft, color:C.success, border:`0.5px solid #86efac`, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>✓ Approve</button>
                <button onClick={doReject}  disabled={saving} style={{ flex:1, padding:"9px 14px", borderRadius:9, background:C.dangerSoft,  color:C.danger,  border:`0.5px solid #fca5a5`, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>✕ Reject</button>
              </div>
            </div>
          )}
          {currentUser.role==="staff" && st==="submitted" && (
            <div style={{ marginTop:12, padding:"9px 12px", borderRadius:9, background:C.warnSoft, border:`0.5px solid #fde68a`, fontSize:12, color:C.warn }}>
              ⏳ Awaiting review from in-charge / admin
            </div>
          )}
          {st==="approved" && (
            <div style={{ marginTop:12, padding:"9px 12px", borderRadius:9, background:C.successSoft, border:`0.5px solid #86efac`, fontSize:12, color:C.success }}>
              ✓ Approved by {stepState?.reviewed_by} · {fmtTime(stepState?.reviewed_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailModal({ checklist, currentUser, onClose, onUpdate, isMobile, isEvent=false }) {
  const steps    = isEvent ? (EVENT_STEPS[checklist.event_type]||[]) : (PIPELINE_STEPS[checklist.exam_type]||[]);
  const stepData = checklist.step_data || {};
  const [saving, setSaving] = useState(false);

  const activeIdx   = steps.findIndex(s => stepData[s.key]?.status !== "approved");
  const activeKey   = activeIdx >= 0 ? steps[activeIdx]?.key : null;
  const allDone     = activeIdx === -1;
  const isFinalized = checklist.status === "finalized";
  const meta        = isEvent ? (EVENT_META[checklist.event_type]||EVENT_META["Other"]) : (EXAM_META[checklist.exam_type]||EXAM_META["Monthly Test"]);
  const typeLabel   = isEvent ? checklist.event_type : checklist.exam_type;

  const updateData = async (newSD, extra={}) => {
    const updated = isEvent
      ? await db.updateEventChecklist(checklist.id, { step_data:newSD, ...extra })
      : await db.updateExamChecklist(checklist.id, { step_data:newSD, ...extra });
    onUpdate(updated, isEvent);
  };

  const handleSubmit = useCallback(async (key, note) => {
    await updateData({ ...stepData, [key]:{ ...(stepData[key]||{}), status:"submitted", note, submitted_at:new Date().toISOString(), submitted_by:currentUser.name } });
  }, [stepData, currentUser]);

  const handleApprove = useCallback(async (key, feedback) => {
    const updated = { ...(stepData[key]||{}), status:"approved", feedback, reviewed_by:currentUser.name, reviewed_at:new Date().toISOString() };
    const newSD = { ...stepData, [key]:updated };
    const allApproved = steps.every(s => (s.key===key ? true : newSD[s.key]?.status==="approved"));
    await updateData(newSD, allApproved ? { status:"completed" } : {});
  }, [stepData, steps, currentUser]);

  const handleReject = useCallback(async (key, feedback) => {
    await updateData({ ...stepData, [key]:{ ...(stepData[key]||{}), status:"rejected", feedback, reviewed_by:currentUser.name, reviewed_at:new Date().toISOString() } });
  }, [stepData, currentUser]);

  const handleFinalize = async () => {
    if (!allDone) { alert("All steps must be approved before final sign-off."); return; }
    if (!PERMS.canFinalize(currentUser)) { alert("You don't have permission to finalize."); return; }
    setSaving(true);
    try {
      const updated = isEvent
        ? await db.updateEventChecklist(checklist.id, { status:"finalized", finalized_by:currentUser.name, finalized_at:new Date().toISOString() })
        : await db.updateExamChecklist(checklist.id, { status:"finalized", finalized_by:currentUser.name, finalized_at:new Date().toISOString() });
      onUpdate(updated, isEvent);
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.55)", backdropFilter:"blur(5px)", zIndex:2000, display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center" }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ ...s.card, width:"100%", maxWidth:660, maxHeight:isMobile?"95vh":"90vh", display:"flex", flexDirection:"column", borderRadius:isMobile?"18px 18px 0 0":16, boxShadow:C.shadowLg }}>
        <div style={{ background:meta.grad, padding:"16px 18px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1, minWidth:0, paddingRight:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                <span style={{ fontSize:18 }}>{meta.icon}</span>
                <span style={{ fontSize:F.xs, color:"rgba(255,255,255,.75)", fontWeight:700, textTransform:"uppercase", letterSpacing:.6 }}>{typeLabel}</span>
                {isEvent && <span style={{ fontSize:F.xs, background:"rgba(255,255,255,.2)", color:"white", padding:"2px 9px", borderRadius:99, fontWeight:700 }}>Event</span>}
                {isFinalized && <span style={{ fontSize:F.xs, background:"rgba(255,255,255,.2)", color:"white", padding:"2px 9px", borderRadius:99, fontWeight:700 }}>✅ Finalized</span>}
              </div>
              <div style={{ fontSize:F.xl, fontWeight:800, color:"white", lineHeight:1.2, marginBottom:5 }}>{checklist.title}</div>
              <div style={{ fontSize:F.sm, color:"rgba(255,255,255,.8)" }}>Assigned to: <b>{checklist.assigned_to_name}</b> · {checklist.department}</div>
              {checklist.event_date && <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.7)", marginTop:3 }}>📅 Event Date: {fmtDate(checklist.event_date)}</div>}
              {checklist.exam_date  && <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.7)", marginTop:3 }}>📅 Exam Date: {fmtDate(checklist.exam_date)}</div>}
              {isEvent && checklist.location && <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.7)", marginTop:3 }}>📍 {checklist.location}</div>}
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.18)", border:"none", color:"white", borderRadius:9, width:36, height:36, cursor:"pointer", fontSize:18, flexShrink:0 }}>✕</button>
          </div>
          <div style={{ marginTop:14 }}><PipelineBar steps={steps} stepData={stepData} light /></div>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {isFinalized && (
            <div style={{ background:C.successSoft, border:"2px solid #16a34a", borderRadius:12, padding:"16px 18px", textAlign:"center", margin:"14px 16px 0" }}>
              <div style={{ fontSize:26, marginBottom:6 }}>🎉</div>
              <div style={{ fontSize:F.lg, fontWeight:800, color:C.success }}>{isEvent?"Event":"Exam"} Fully Completed & Signed Off</div>
              <div style={{ fontSize:F.sm, color:C.textMid, marginTop:4 }}>By {checklist.finalized_by} · {fmtTime(checklist.finalized_at)}</div>
            </div>
          )}
          {steps.map((step,idx) => (
            <StepRow key={step.key} step={step} stepState={stepData[step.key]}
              isActive={step.key===activeKey} isLocked={idx>activeIdx && activeIdx!==-1}
              currentUser={currentUser} onSubmitStep={handleSubmit}
              onApproveStep={handleApprove} onRejectStep={handleReject} stepIndex={idx} />
          ))}
        </div>
        {!isFinalized && PERMS.canFinalize(currentUser) && (
          <div style={{ padding:"12px 16px 18px", borderTop:`1px solid ${C.border}`, background:C.surface2, flexShrink:0 }}>
            {allDone ? (
              <button onClick={handleFinalize} disabled={saving} style={{ ...s.btn("#059669"), width:"100%", fontSize:F.lg, padding:"14px 20px", fontWeight:800, opacity:saving?0.6:1 }}>
                {saving?"Finalizing…":"🏁 Final Sign-off — Complete"}
              </button>
            ) : (
              <div style={{ fontSize:F.sm, color:C.textMid, textAlign:"center", padding:"4px 0" }}>
                Approve all {steps.length} steps to enable final sign-off
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignModal({ currentUser, staffList, onClose, onSave, mode="exam" }) {
  const isEvent = mode === "event";
  const types   = isEvent ? EVENT_TYPES : EXAM_TYPES;
  const metaMap = isEvent ? EVENT_META : EXAM_META;

  const [assignMode, setAssignMode] = useState("single");
  const [selType,    setSelType]    = useState(types[0]);
  const [title,      setTitle]      = useState("");
  const [dateVal,    setDateVal]    = useState("");
  const [dept,       setDept]       = useState(currentUser.department||"Academic");
  const [assignedTo, setAssignedTo] = useState("");
  const [bulkIds,    setBulkIds]    = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [location,   setLocation]   = useState("");
  const [notes,      setNotes]      = useState("");

  const eligible = useMemo(() => {
    if (currentUser.role==="incharge") return staffList.filter(s=>resolveRole(s.role)==="staff"&&s.department===currentUser.department);
    return staffList.filter(s=>resolveRole(s.role)!=="admin");
  }, [staffList, currentUser]);

  const toggleBulk = id => setBulkIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const handleSave = async () => {
    const baseTitle = title.trim() || `${selType} ${isEvent?"Event":"Checklist"}`;
    const targets = assignMode==="bulk"
      ? bulkIds.map(id=>staffList.find(s=>s.id===id)).filter(Boolean)
      : [staffList.find(s=>s.id===+assignedTo)].filter(Boolean);
    if (!targets.length) { alert("Select at least one staff member."); return; }
    setSaving(true);
    try {
      const results = [];
      for (const staff of targets) {
        const payload = {
          ...(isEvent ? { event_type:selType, event_date:dateVal||null } : { exam_type:selType, exam_date:dateVal||null }),
          title: assignMode==="bulk" ? `${baseTitle} — ${staff.name}` : baseTitle,
          department: staff.department||dept,
          assigned_to_id: staff.id,
          assigned_to_name: staff.name,
          assigned_by: currentUser.name,
          status: "active",
          step_data: {},
          created_at: new Date().toISOString(),
          ...(isEvent ? { location:location||null, notes:notes||null } : {}),
        };
        const rec = isEvent ? await db.createEventChecklist(payload) : await db.createExamChecklist(payload);
        results.push(rec);
      }
      onSave(results, isEvent);
      onClose();
    } catch(e) { alert("Error: "+e.message); } finally { setSaving(false); }
  };

  const meta   = metaMap[selType] || Object.values(metaMap)[0];
  const canSave = assignMode==="single" ? !!assignedTo : bulkIds.length>0;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.5)", backdropFilter:"blur(4px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ ...s.card, width:"100%", maxWidth:580, maxHeight:"95vh", display:"flex", flexDirection:"column", borderRadius:"16px 16px 0 0", boxShadow:"0 -8px 36px rgba(0,0,0,.14)" }}>
        <div style={{ background:isEvent?meta.grad:`linear-gradient(135deg,${C.brand},${C.brandMid})`, padding:"16px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.7)", textTransform:"uppercase", letterSpacing:1 }}>New {isEvent?"Event":"Exam"} Assignment</div>
            <div style={{ fontSize:F.lg, fontWeight:800, color:"white" }}>Assign {isEvent?"Event":"Exam"} Checklist</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"white", borderRadius:9, width:36, height:36, cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", background:C.surface2, borderRadius:10, padding:3, border:`1px solid ${C.border}`, gap:3 }}>
            {[["single","👤 Single Staff"],["bulk","👥 Bulk Assign"]].map(([m,l])=>(
              <button key={m} onClick={()=>setAssignMode(m)} style={{ flex:1, padding:"9px 8px", borderRadius:8, border:assignMode===m?`1px solid ${C.border}`:"none", background:assignMode===m?C.surface:"none", color:assignMode===m?C.text:C.textMid, fontWeight:assignMode===m?700:500, cursor:"pointer", fontSize:F.sm, fontFamily:"inherit" }}>{l}</button>
            ))}
          </div>
          <div>
            <label style={s.label}>{isEvent?"Event Type":"Exam Type"}</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7 }}>
              {types.map(t=>{
                const m=metaMap[t]||Object.values(metaMap)[0], sel=selType===t;
                return (
                  <button key={t} onClick={()=>setSelType(t)} style={{ padding:"10px 5px", borderRadius:11, border:`2px solid ${sel?m.color:C.border}`, background:sel?m.soft:C.surface, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>
                    <div style={{ fontSize:18 }}>{m.icon}</div>
                    <div style={{ fontSize:F.xs, fontWeight:700, color:sel?m.color:C.textMid, marginTop:3, lineHeight:1.2 }}>{t}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={s.label}>Title {assignMode==="bulk"&&<span style={{ fontWeight:400, textTransform:"none", marginLeft:5 }}>(name auto-appended)</span>}</label>
            <input style={s.input} value={title} onChange={e=>setTitle(e.target.value)} placeholder={`e.g. ${selType} — June 2025`} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={s.label}>{isEvent?"Event Date":"Exam Date"}</label>
              <input type="date" style={s.input} value={dateVal} onChange={e=>setDateVal(e.target.value)} />
            </div>
            {currentUser.role==="admin" && (
              <div>
                <label style={s.label}>Department</label>
                <select style={s.input} value={dept} onChange={e=>setDept(e.target.value)}>
                  {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>
          {isEvent && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={s.label}>Venue / Location</label>
                <input style={s.input} value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Main Hall" />
              </div>
              <div>
                <label style={s.label}>Notes</label>
                <input style={s.input} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any special notes…" />
              </div>
            </div>
          )}
          {assignMode==="single" ? (
            <div>
              <label style={s.label}>Assign To</label>
              <select style={s.input} value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}>
                <option value="">— Select Staff —</option>
                {eligible.map(st=><option key={st.id} value={st.id}>{st.name} — {st.designation||st.department}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={s.label}>Select Staff ({bulkIds.length} selected)</label>
              <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:9, padding:9 }}>
                <button onClick={()=>setBulkIds(bulkIds.length===eligible.length?[]:eligible.map(s=>s.id))} style={{ ...s.btnGhost, fontSize:F.xs, marginBottom:3 }}>
                  {bulkIds.length===eligible.length?"Deselect All":"Select All"}
                </button>
                {eligible.map(st=>(
                  <label key={st.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:9, cursor:"pointer", border:`1.5px solid ${bulkIds.includes(st.id)?C.brand:C.border}`, background:bulkIds.includes(st.id)?`${C.brand}08`:C.surface }}>
                    <input type="checkbox" checked={bulkIds.includes(st.id)} onChange={()=>toggleBulk(st.id)} style={{ width:15, height:15, accentColor:C.brand }} />
                    <Avatar name={st.name} role={resolveRole(st.role)} size={26} />
                    <div>
                      <div style={{ fontSize:F.sm, fontWeight:600, color:C.text }}>{st.name}</div>
                      <div style={{ fontSize:F.xs, color:C.textMid }}>{st.designation||""} · {st.department}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:"12px 18px 22px", borderTop:`1px solid ${C.border}`, background:C.surface2, flexShrink:0 }}>
          <button onClick={handleSave} disabled={saving||!canSave} style={{ width:"100%", background:isEvent?meta.grad:`linear-gradient(135deg,${C.brand},${C.brandMid})`, color:"white", border:"none", borderRadius:11, padding:"14px 20px", fontWeight:800, fontSize:F.base, fontFamily:"inherit", cursor:"pointer", opacity:saving||!canSave?0.55:1 }}>
            {saving?"Assigning…":assignMode==="bulk"?`✅ Assign to ${bulkIds.length} Staff Member${bulkIds.length!==1?"s":""}`:isEvent?"✅ Assign Event":"✅ Assign Checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChecklistCard({ item, currentUser, onOpen, onDelete, isEvent=false }) {
  const steps    = isEvent ? (EVENT_STEPS[item.event_type]||[]) : (PIPELINE_STEPS[item.exam_type]||[]);
  const stepData = item.step_data || {};
  const meta     = isEvent ? (EVENT_META[item.event_type]||EVENT_META["Other"]) : (EXAM_META[item.exam_type]||EXAM_META["Monthly Test"]);
  const typeLabel = isEvent ? item.event_type : item.exam_type;
  const isFinalized   = item.status==="finalized";
  const isCompleted   = item.status==="completed"||isFinalized;
  const pendingReview = steps.some(s=>stepData[s.key]?.status==="submitted");
  const approved      = steps.filter(s=>stepData[s.key]?.status==="approved").length;
  const activeIdx     = steps.findIndex(s=>stepData[s.key]?.status!=="approved");
  const activeStep    = activeIdx>=0?steps[activeIdx]:null;
  const canDel        = PERMS.canDelete(currentUser, item);
  const borderColor   = isFinalized?C.success:pendingReview?C.warn:isCompleted?"#86efac":C.border;

  return (
    <div style={{ background:C.surface, border:`2px solid ${borderColor}`, borderRadius:14, overflow:"hidden", boxShadow:C.shadow, display:"flex", flexDirection:"column" }}>
      <div style={{ height:3, background:meta.grad }} />
      <div style={{ padding:"14px 15px", flex:1 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12 }}>
          <div style={{ width:38, height:38, borderRadius:11, background:meta.soft, border:`1.5px solid ${meta.color}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{meta.icon}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center", marginBottom:4 }}>
              <span style={{ fontSize:F.xs, fontWeight:700, color:meta.color, background:meta.soft, padding:"2px 9px", borderRadius:99, border:`1px solid ${meta.color}20` }}>{typeLabel}</span>
              {isFinalized && <span style={{ fontSize:F.xs, fontWeight:700, color:C.success, background:C.successSoft, padding:"2px 9px", borderRadius:99 }}>✅ Finalized</span>}
              {pendingReview&&!isFinalized && <span style={{ fontSize:F.xs, fontWeight:700, color:C.warn, background:C.warnSoft, padding:"2px 9px", borderRadius:99 }}>⏳ Review needed</span>}
            </div>
            <div style={{ fontSize:F.md, fontWeight:700, color:C.text, lineHeight:1.3 }}>{item.title}</div>
            <div style={{ fontSize:F.xs, color:C.textMid, marginTop:3 }}>👤 {item.assigned_to_name} · {item.department}</div>
          </div>
        </div>
        <PipelineBar steps={steps} stepData={stepData} compact />
        {activeStep&&!isFinalized && (
          <div style={{ marginTop:10, fontSize:F.sm, color:C.textMid, background:C.surface2, borderRadius:8, padding:"8px 11px", border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:14 }}>{activeStep.icon}</span>
            <span><b>Current:</b> {activeStep.label}</span>
          </div>
        )}
        {(item.event_date||item.exam_date) && <div style={{ marginTop:8, fontSize:F.xs, color:C.textDim }}>📅 {fmtDate(item.event_date||item.exam_date)} · By {item.assigned_by}</div>}
        {isEvent && item.location && <div style={{ marginTop:3, fontSize:F.xs, color:C.textDim }}>📍 {item.location}</div>}
      </div>
      <div style={{ padding:"9px 15px 13px", borderTop:`1px solid ${C.border}`, display:"flex", gap:7, background:C.surface2 }}>
        <button onClick={()=>onOpen(item,isEvent)} style={{ flex:1, ...s.btn(isFinalized?C.success:pendingReview?C.warn:C.brand), padding:"10px 14px", fontSize:F.sm }}>
          {isFinalized?"🏆 View":`${approved}/${steps.length} Steps — Open`}
        </button>
        {canDel&&!isFinalized && <button onClick={()=>onDelete(item.id,isEvent)} style={{ ...s.btnSm("#ef4444"), padding:"10px 11px" }}>🗑</button>}
      </div>
    </div>
  );
}

function RecordsView({ examChecklists, eventChecklists, isMobile }) {
  const [filterKind,  setFilterKind]  = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [expandedId,  setExpandedId]  = useState(null);
  const [search,      setSearch]      = useState("");

  const allRecords = useMemo(() => {
    const exams  = examChecklists.filter(c=>c.status==="finalized"||c.status==="completed").map(c=>({...c,_kind:"exam"}));
    const events = eventChecklists.filter(c=>c.status==="finalized"||c.status==="completed").map(c=>({...c,_kind:"event"}));
    return [...exams,...events].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at));
  },[examChecklists,eventChecklists]);

  const filtered = useMemo(()=>{
    let list = allRecords;
    if (filterKind!=="all") list=list.filter(r=>r._kind===filterKind);
    if (filterMonth) list=list.filter(r=>{ const d=r.finalized_at||r.updated_at||r.created_at; return d&&d.startsWith(filterMonth); });
    if (filterStaff) list=list.filter(r=>r.assigned_to_name?.toLowerCase().includes(filterStaff.toLowerCase()));
    if (search) list=list.filter(r=>r.title?.toLowerCase().includes(search.toLowerCase())||r.assigned_to_name?.toLowerCase().includes(search.toLowerCase()));
    return list;
  },[allRecords,filterKind,filterMonth,filterStaff,search]);

  const exportCSV = () => {
    const rows = [["Type","Kind","Title","Assigned To","Department","Assigned By","Date","Status","Finalized By","Finalized At","Steps Approved"]];
    filtered.forEach(r=>{
      const steps = r._kind==="event"?(EVENT_STEPS[r.event_type]||[]):(PIPELINE_STEPS[r.exam_type]||[]);
      const approved = steps.filter(s=>r.step_data?.[s.key]?.status==="approved").length;
      rows.push([r._kind==="event"?r.event_type:r.exam_type,r._kind,r.title,r.assigned_to_name,r.department,r.assigned_by,fmtDate(r.event_date||r.exam_date||""),r.status,r.finalized_by||"",fmtTime(r.finalized_at||""),`${approved}/${steps.length}`]);
    });
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = `gnsi-records-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:10, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:F.xl, fontWeight:800, color:C.text }}>Records</div>
          <div style={{ fontSize:F.sm, color:C.textMid }}>{filtered.length} completed record{filtered.length!==1?"s":""}</div>
        </div>
        <button onClick={exportCSV} style={{ ...s.btn(C.success), padding:"9px 16px", fontSize:F.sm }}>⬇ Export CSV</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:8, marginBottom:12 }}>
        <input style={s.input} placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={s.input} value={filterKind} onChange={e=>setFilterKind(e.target.value)}>
          <option value="all">All Types</option>
          <option value="exam">Exams Only</option>
          <option value="event">Events Only</option>
        </select>
        <input type="month" style={s.input} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} />
        <input style={s.input} placeholder="Filter by staff…" value={filterStaff} onChange={e=>setFilterStaff(e.target.value)} />
      </div>
      {filtered.length===0 ? (
        <div style={{ padding:44, textAlign:"center", color:C.textMid, fontSize:F.base, background:C.surface, borderRadius:14, border:`1px solid ${C.border}` }}>No completed records found.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(r=>{
            const isEv  = r._kind==="event";
            const steps = isEv?(EVENT_STEPS[r.event_type]||[]):(PIPELINE_STEPS[r.exam_type]||[]);
            const meta  = isEv?(EVENT_META[r.event_type]||EVENT_META["Other"]):(EXAM_META[r.exam_type]||EXAM_META["Monthly Test"]);
            const approved = steps.filter(s=>r.step_data?.[s.key]?.status==="approved").length;
            const isExp = expandedId===r.id;
            return (
              <div key={r.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", boxShadow:C.shadow }}>
                <div onClick={()=>setExpandedId(isExp?null:r.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", cursor:"pointer", background:isExp?C.surface2:"transparent" }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:meta.soft, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{meta.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3, flexWrap:"wrap" }}>
                      <span style={{ fontSize:F.xs, fontWeight:700, color:meta.color, background:meta.soft, padding:"1px 8px", borderRadius:99 }}>{isEv?"📅 Event":"📋 Exam"}</span>
                      <span style={{ fontSize:F.xs, color:C.textDim }}>{isEv?r.event_type:r.exam_type}</span>
                    </div>
                    <div style={{ fontSize:F.md, fontWeight:700, color:C.text, marginBottom:2 }}>{r.title}</div>
                    <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                      <span style={{ fontSize:F.xs, color:C.textMid }}>👤 {r.assigned_to_name}</span>
                      <span style={{ fontSize:F.xs, color:C.textMid }}>🏢 {r.department}</span>
                      {r.finalized_at && <span style={{ fontSize:F.xs, color:C.textDim }}>✅ {fmtTime(r.finalized_at)}</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:F.sm, fontWeight:700, color:C.success }}>{approved}/{steps.length}</div>
                      <div style={{ fontSize:F.xs, color:C.textDim }}>steps</div>
                    </div>
                    <span style={{ fontSize:11, color:C.textDim, transform:isExp?"rotate(180deg)":"none", transition:"transform .2s", display:"inline-block" }}>▾</span>
                  </div>
                </div>
                {isExp && (
                  <div style={{ borderTop:`1px solid ${C.border}`, background:C.surface2 }}>
                    <div style={{ padding:"12px 16px", borderBottom:`0.5px solid ${C.border}`, display:"flex", gap:16, flexWrap:"wrap" }}>
                      {[["Assigned by",r.assigned_by],["Finalized by",r.finalized_by||"—"],["Finalized at",fmtTime(r.finalized_at)||"—"],[isEv?"Event Date":"Exam Date",fmtDate(r.event_date||r.exam_date)]].map(([lbl,val])=>(
                        <div key={lbl} style={{ fontSize:F.xs }}>
                          <div style={{ fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:C.textDim, marginBottom:3 }}>{lbl}</div>
                          <div style={{ color:C.text, fontWeight:600 }}>{val}</div>
                        </div>
                      ))}
                      {isEv && r.location && (
                        <div style={{ fontSize:F.xs }}>
                          <div style={{ fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:C.textDim, marginBottom:3 }}>Venue</div>
                          <div style={{ color:C.text, fontWeight:600 }}>{r.location}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding:"12px 16px" }}>
                      <div style={{ fontSize:F.xs, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em", color:C.textDim, marginBottom:10 }}>Step Audit Trail</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {steps.map((step,idx)=>{
                          const sd = r.step_data?.[step.key];
                          const st = sd?.status||"pending";
                          const m  = STEP_META[st];
                          return (
                            <div key={step.key} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px", borderRadius:9, background:C.surface, border:`0.5px solid ${C.border}` }}>
                              <div style={{ width:22, height:22, borderRadius:"50%", background:m.soft, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:m.color, flexShrink:0, border:`0.5px solid ${m.color}30` }}>
                                {st==="approved"?"✓":idx+1}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2, flexWrap:"wrap" }}>
                                  <span style={{ fontSize:F.sm, fontWeight:600, color:C.text }}>{step.label}</span>
                                  <StatusBadge status={st} />
                                </div>
                                {sd?.submitted_by && <div style={{ fontSize:F.xs, color:C.textMid }}>Submitted by <b>{sd.submitted_by}</b> · {fmtTime(sd.submitted_at)}</div>}
                                {sd?.reviewed_by && (
                                  <div style={{ fontSize:F.xs, color:st==="approved"?C.success:C.danger }}>
                                    {st==="approved"?"✓ Approved":"✕ Rejected"} by <b>{sd.reviewed_by}</b> · {fmtTime(sd.reviewed_at)}
                                    {sd.feedback && <span style={{ color:C.textMid }}> — "{sd.feedback}"</span>}
                                  </div>
                                )}
                                {sd?.note && <div style={{ fontSize:F.xs, color:C.textDim, marginTop:2 }}>Note: "{sd.note}"</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExamsView({ currentUser, checklists, staff, onOpen, onDelete, onAssign, isMobile }) {
  const [showAssign,   setShowAssign]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilters,  setShowFilters]  = useState(false);

  const visible = useMemo(()=>{
    let list = checklists;
    if (filterType!=="All") list=list.filter(c=>c.exam_type===filterType);
    if (filterStatus==="active")    list=list.filter(c=>c.status==="active");
    if (filterStatus==="completed") list=list.filter(c=>c.status==="completed"||c.status==="finalized");
    if (filterStatus==="review")    list=list.filter(c=>{const steps=PIPELINE_STEPS[c.exam_type]||[];return steps.some(s=>c.step_data?.[s.key]?.status==="submitted");});
    if (search) list=list.filter(c=>c.title.toLowerCase().includes(search.toLowerCase())||c.assigned_to_name.toLowerCase().includes(search.toLowerCase()));
    return list;
  },[checklists,filterType,filterStatus,search]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10 }}>
        {!isMobile && <div style={{ fontSize:F.xl, fontWeight:800, color:C.text }}>{currentUser.role==="staff"?"My Exam Checklists":currentUser.role==="incharge"?`${currentUser.department} Exams`:"All Exam Checklists"}</div>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={()=>setShowFilters(v=>!v)} style={{ ...s.btnGhost, background:showFilters?C.brandSoft:"none", color:showFilters?C.brand:C.textMid, borderColor:showFilters?C.brand:C.border }}>⚙ {showFilters?"Hide":"Filters"}</button>
          {PERMS.canAssign(currentUser) && <button onClick={()=>setShowAssign(true)} style={{ ...s.btn(), background:`linear-gradient(135deg,${C.brand},${C.brandMid})`, padding:"9px 16px", borderRadius:9, fontSize:F.base }}>＋ Assign</button>}
        </div>
      </div>
      <input style={{ ...s.input, marginBottom:10 }} placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)} />
      {showFilters && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:8, marginBottom:12 }}>
          <select style={s.input} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="All">All Types</option>
            {EXAM_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <select style={s.input} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="active">Active</option>
            <option value="review">Needs Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}
      <div style={{ fontSize:F.sm, color:C.textMid, marginBottom:11 }}>{visible.length} checklist{visible.length!==1?"s":""}</div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))", gap:13 }}>
        {visible.length===0 ? <div style={{ padding:44, textAlign:"center", color:C.textMid, fontSize:F.base, gridColumn:"1/-1" }}>No checklists found.</div>
          : visible.map(c=><ChecklistCard key={c.id} item={c} currentUser={currentUser} onOpen={onOpen} onDelete={onDelete} isEvent={false} />)}
      </div>
      {showAssign && <AssignModal currentUser={currentUser} staffList={staff} onClose={()=>setShowAssign(false)} onSave={(items,isEv)=>{onAssign(items,isEv);setShowAssign(false);}} mode="exam" />}
    </div>
  );
}

function EventsView({ currentUser, events, staff, onOpen, onDelete, onAssign, isMobile }) {
  const [showAssign,   setShowAssign]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilters,  setShowFilters]  = useState(false);

  const visible = useMemo(()=>{
    let list = events;
    if (filterType!=="All") list=list.filter(c=>c.event_type===filterType);
    if (filterStatus==="active")    list=list.filter(c=>c.status==="active");
    if (filterStatus==="completed") list=list.filter(c=>c.status==="completed"||c.status==="finalized");
    if (filterStatus==="review")    list=list.filter(c=>{const steps=EVENT_STEPS[c.event_type]||[];return steps.some(s=>c.step_data?.[s.key]?.status==="submitted");});
    if (search) list=list.filter(c=>c.title.toLowerCase().includes(search.toLowerCase())||c.assigned_to_name.toLowerCase().includes(search.toLowerCase()));
    return list;
  },[events,filterType,filterStatus,search]);

  const pendingReview = events.filter(c=>{const steps=EVENT_STEPS[c.event_type]||[];const ok=currentUser.role==="admin"||c.department===currentUser.department;return ok&&steps.some(s=>c.step_data?.[s.key]?.status==="submitted");}).length;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10 }}>
        {!isMobile && <div>
          <div style={{ fontSize:F.xl, fontWeight:800, color:C.text }}>{currentUser.role==="staff"?"My Events":currentUser.role==="incharge"?`${currentUser.department} Events`:"All Events"}</div>
          {pendingReview>0&&PERMS.canApprove(currentUser) && <div style={{ fontSize:F.sm, color:C.warn, marginTop:3 }}>⏳ {pendingReview} event{pendingReview!==1?"s":""} awaiting approval</div>}
        </div>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={()=>setShowFilters(v=>!v)} style={{ ...s.btnGhost, background:showFilters?C.brandSoft:"none", color:showFilters?C.brand:C.textMid, borderColor:showFilters?C.brand:C.border }}>⚙ {showFilters?"Hide":"Filters"}</button>
          {PERMS.canAssign(currentUser) && <button onClick={()=>setShowAssign(true)} style={{ ...s.btn(), background:"linear-gradient(135deg,#7c3aed,#8b5cf6)", padding:"9px 16px", borderRadius:9, fontSize:F.base }}>＋ Assign Event</button>}
        </div>
      </div>
      <input style={{ ...s.input, marginBottom:10 }} placeholder="🔍 Search events…" value={search} onChange={e=>setSearch(e.target.value)} />
      {showFilters && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:8, marginBottom:12 }}>
          <select style={s.input} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="All">All Event Types</option>
            {EVENT_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <select style={s.input} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="active">Active</option>
            <option value="review">Needs Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}
      <div style={{ fontSize:F.sm, color:C.textMid, marginBottom:11 }}>{visible.length} event{visible.length!==1?"s":""}</div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))", gap:13 }}>
        {visible.length===0
          ? <div style={{ padding:44, textAlign:"center", color:C.textMid, fontSize:F.base, gridColumn:"1/-1" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📅</div>
              <div style={{ fontWeight:700, marginBottom:6 }}>No events yet</div>
              {PERMS.canAssign(currentUser) && <div style={{ fontSize:F.sm }}>Click "Assign Event" to create your first event checklist.</div>}
            </div>
          : visible.map(c=><ChecklistCard key={c.id} item={c} currentUser={currentUser} onOpen={onOpen} onDelete={onDelete} isEvent={true} />)}
      </div>
      {showAssign && <AssignModal currentUser={currentUser} staffList={staff} onClose={()=>setShowAssign(false)} onSave={(items,isEv)=>{onAssign(items,isEv);setShowAssign(false);}} mode="event" />}
    </div>
  );
}

function DashboardView({ currentUser, checklists, events, isMobile }) {
  const stats = useMemo(()=>({
    examTotal:      checklists.length,
    examActive:     checklists.filter(c=>c.status==="active").length,
    examFinalized:  checklists.filter(c=>c.status==="finalized").length,
    examReview:     checklists.filter(c=>{const steps=PIPELINE_STEPS[c.exam_type]||[];return steps.some(s=>c.step_data?.[s.key]?.status==="submitted");}).length,
    eventTotal:     events.length,
    eventActive:    events.filter(c=>c.status==="active").length,
    eventFinalized: events.filter(c=>c.status==="finalized").length,
    eventReview:    events.filter(c=>{const steps=EVENT_STEPS[c.event_type]||[];return steps.some(s=>c.step_data?.[s.key]?.status==="submitted");}).length,
  }),[checklists,events]);

  const recentActivity = useMemo(()=>{
    const examA = checklists.flatMap(c=>{const steps=PIPELINE_STEPS[c.exam_type]||[];return steps.filter(s=>c.step_data?.[s.key]?.submitted_at||c.step_data?.[s.key]?.reviewed_at).map(s=>({title:c.title,who:c.assigned_to_name,step:s.label,sd:c.step_data[s.key],time:c.step_data[s.key]?.reviewed_at||c.step_data[s.key]?.submitted_at,kind:"exam"}));});
    const evtA  = events.flatMap(c=>{const steps=EVENT_STEPS[c.event_type]||[];return steps.filter(s=>c.step_data?.[s.key]?.submitted_at||c.step_data?.[s.key]?.reviewed_at).map(s=>({title:c.title,who:c.assigned_to_name,step:s.label,sd:c.step_data[s.key],time:c.step_data[s.key]?.reviewed_at||c.step_data[s.key]?.submitted_at,kind:"event"}));});
    return [...examA,...evtA].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,6);
  },[checklists,events]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div>
        <div style={{ fontSize:F.xxl, fontWeight:800, color:C.text, marginBottom:3 }}>
          {currentUser.role==="staff"?"My Dashboard":currentUser.role==="incharge"?`${currentUser.department} — Dashboard`:"Dashboard"}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontSize:F.base, color:C.textMid }}>Welcome back, {currentUser.name}</span>
          <RoleBadge role={currentUser.role} />
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:16, boxShadow:C.shadow }}>
          <div style={{ fontSize:F.sm, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".07em", marginBottom:12 }}>📋 Exam Checklists</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            {[["Total",stats.examTotal,C.info],["Active",stats.examActive,C.brand],["Review",stats.examReview,C.warn],["Finalized",stats.examFinalized,C.success]].map(([l,v,c])=>(
              <div key={l} style={{ background:C.surface2, borderRadius:10, padding:"12px", borderLeft:`3px solid ${c}` }}>
                <div style={{ fontSize:F.xl, fontWeight:800, color:c }}>{v}</div>
                <div style={{ fontSize:F.xs, color:C.textMid, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:16, boxShadow:C.shadow }}>
          <div style={{ fontSize:F.sm, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:".07em", marginBottom:12 }}>📅 Event Checklists</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            {[["Total",stats.eventTotal,"#7c3aed"],["Active",stats.eventActive,"#db2777"],["Review",stats.eventReview,C.warn],["Finalized",stats.eventFinalized,C.success]].map(([l,v,c])=>(
              <div key={l} style={{ background:C.surface2, borderRadius:10, padding:"12px", borderLeft:`3px solid ${c}` }}>
                <div style={{ fontSize:F.xl, fontWeight:800, color:c }}>{v}</div>
                <div style={{ fontSize:F.xs, color:C.textMid, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {(stats.examReview>0||stats.eventReview>0)&&PERMS.canApprove(currentUser) && (
        <div style={{ background:C.warnSoft, border:`1.5px solid #fde68a`, borderRadius:12, padding:"13px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>⏳</span>
          <span style={{ fontWeight:700, color:C.warn, fontSize:F.md }}>
            {[stats.examReview>0&&`${stats.examReview} exam step${stats.examReview!==1?"s":""}`,stats.eventReview>0&&`${stats.eventReview} event step${stats.eventReview!==1?"s":""}`].filter(Boolean).join(" and ")} awaiting your approval
          </span>
        </div>
      )}
      {recentActivity.length>0 && (
        <div>
          <div style={{ fontSize:F.sm, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:.07, marginBottom:10 }}>Recent Activity</div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {recentActivity.map((a,i)=>{
              const m = STEP_META[a.sd.status]||STEP_META.pending;
              return (
                <div key={i} style={{ ...s.card, padding:"11px 13px", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:m.dot, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:F.sm, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.who} — {a.step}</div>
                    <div style={{ fontSize:F.xs, color:C.textMid, display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:10, background:a.kind==="event"?"#ede9fe":C.brandSoft, color:a.kind==="event"?"#7c3aed":C.brand, padding:"1px 7px", borderRadius:99, fontWeight:700 }}>{a.kind==="event"?"Event":"Exam"}</span>
                      {a.title}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3, flexShrink:0 }}>
                    <StatusBadge status={a.sd.status} />
                    <span style={{ fontSize:F.xs, color:C.textDim }}>{fmtTime(a.time)}</span>
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

function MonitorView({ currentUser, checklists, events, staff, isMobile }) {
  const staffStats = useMemo(()=>staff.filter(s=>resolveRole(s.role)==="staff").map(s=>{
    const myExams  = checklists.filter(c=>c.assigned_to_id===s.id);
    const myEvents = events.filter(c=>c.assigned_to_id===s.id);
    const examDone  = myExams.filter(c=>c.status==="finalized"||c.status==="completed").length;
    const eventDone = myEvents.filter(c=>c.status==="finalized"||c.status==="completed").length;
    const pending   = [...myExams,...myEvents].filter(c=>{const steps=c.exam_type?(PIPELINE_STEPS[c.exam_type]||[]):(EVENT_STEPS[c.event_type]||[]);return steps.some(st=>c.step_data?.[st.key]?.status==="submitted");}).length;
    return {...s,examTotal:myExams.length,eventTotal:myEvents.length,examDone,eventDone,pending};
  }).sort((a,b)=>b.pending-a.pending||(b.examTotal+b.eventTotal)-(a.examTotal+a.eventTotal))
  ,[staff,checklists,events]);

  return (
    <div>
      {!isMobile && <div style={{ fontSize:F.xl, fontWeight:800, color:C.text, marginBottom:16 }}>Monitor</div>}
      <div style={{ fontSize:F.sm, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:.07, marginBottom:12 }}>Staff Progress</div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))", gap:11 }}>
        {staffStats.map(st=>{
          const total=st.examTotal+st.eventTotal, done=st.examDone+st.eventDone;
          const pct=total>0?Math.round((done/total)*100):0;
          const color=st.pending>0?C.warn:pct>=80?C.success:pct>=50?C.info:C.textDim;
          return (
            <div key={st.id} style={{ ...s.card, padding:15, borderTop:`3px solid ${color}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:11 }}>
                <Avatar name={st.name} role={resolveRole(st.role)} size={34} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:F.md, fontWeight:700, color:C.text }}>{st.name}</div>
                  <div style={{ fontSize:F.xs, color:C.textMid }}>{st.department}</div>
                </div>
                <span style={{ fontSize:F.xl, fontWeight:800, color }}>{pct}%</span>
              </div>
              <div style={{ height:5, borderRadius:99, background:C.surface2, marginBottom:10, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99 }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                {[["Exams",st.examTotal,C.brand],["Events",st.eventTotal,"#7c3aed"],["Done",done,C.success],["Review",st.pending,C.warn]].map(([l,v,c])=>(
                  <div key={l} style={{ textAlign:"center", background:C.surface2, borderRadius:8, padding:"8px 4px", border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:F.lg, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:F.xs, color:C.textMid }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {staffStats.length===0 && <div style={{ fontSize:F.base, color:C.textMid, padding:"24px 0" }}>No staff data available.</div>}
      </div>
    </div>
  );
}

function TopNav({ currentUser, activeTab, setActiveTab, onRefresh, users, setCurrentUser, checklists, events }) {
  const examPending  = checklists.filter(c=>{const steps=PIPELINE_STEPS[c.exam_type]||[];const ok=currentUser.role==="admin"||c.department===currentUser.department;return ok&&steps.some(s=>c.step_data?.[s.key]?.status==="submitted");}).length;
  const eventPending = events.filter(c=>{const steps=EVENT_STEPS[c.event_type]||[];const ok=currentUser.role==="admin"||c.department===currentUser.department;return ok&&steps.some(s=>c.step_data?.[s.key]?.status==="submitted");}).length;
  const totalPending = examPending+eventPending;
  const tabs = [
    { id:"dashboard", label:"Dashboard", icon:"🏠" },
    { id:"exams",     label:"Exams",     icon:"📋", badge:examPending },
    { id:"events",    label:"Events",    icon:"📅", badge:eventPending },
    { id:"records",   label:"Records",   icon:"🗂️" },
    ...(PERMS.canViewMonitor(currentUser)?[{ id:"monitor", label:"Monitor", icon:"📊" }]:[]),
  ];
  return (
    <div style={{ background:"white", borderBottom:`1px solid ${C.border}`, boxShadow:"0 2px 8px rgba(0,0,0,.05)", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", height:54, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ background:`linear-gradient(135deg,${C.brand},${C.brandMid})`, borderRadius:9, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏫</div>
          <div>
            <div style={{ fontSize:F.md, fontWeight:800, color:C.text }}>GNSI Checklist System</div>
            <div style={{ fontSize:F.xs, color:C.textMid }}>Exams · Events · Records</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {totalPending>0 && <button onClick={()=>setActiveTab(examPending>=eventPending?"exams":"events")} style={{ ...s.btnSm(C.warn), fontSize:F.xs }}>⏳ {totalPending} Pending</button>}
          {PERMS.canSwitchUser(currentUser) && users.length>1 && (
            <select style={{ ...s.input, width:"auto", padding:"6px 10px", fontSize:F.xs, borderRadius:8 }} value={currentUser.id} onChange={e=>setCurrentUser(users.find(u=>u.id===+e.target.value)||users[0])}>
              {users.map(u=><option key={u.id} value={u.id}>{u.name} ({ROLE_DISPLAY[resolveRole(u.role)]?.label||u.role})</option>)}
            </select>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:C.surface2, border:`1.5px solid ${C.border}`, borderRadius:9, padding:"6px 11px" }}>
            <Avatar name={currentUser.name} role={currentUser.role} size={24} />
            <div>
              <div style={{ fontSize:F.xs, fontWeight:700, color:C.text }}>{currentUser.name}</div>
              <RoleBadge role={currentUser.role} />
            </div>
          </div>
          <button onClick={onRefresh} style={{ ...s.btnGhost, padding:"7px 11px" }}>🔄</button>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", padding:"0 24px", gap:2 }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 16px", border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", fontSize:F.sm, fontWeight:activeTab===t.id?700:500, color:activeTab===t.id?C.brand:C.textMid, borderBottom:activeTab===t.id?`2.5px solid ${C.brand}`:"2.5px solid transparent", marginBottom:-1, whiteSpace:"nowrap" }}>
            <span style={{ fontSize:14 }}>{t.icon}</span>{t.label}
            {t.badge>0 && <span style={{ background:C.warn, color:"white", borderRadius:99, fontSize:10, fontWeight:800, padding:"1px 6px", marginLeft:2 }}>{t.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function BottomNav({ currentUser, activeTab, setActiveTab }) {
  const items = [
    { id:"dashboard", label:"Home",    icon:"🏠" },
    { id:"exams",     label:"Exams",   icon:"📋" },
    { id:"events",    label:"Events",  icon:"📅" },
    { id:"records",   label:"Records", icon:"🗂️" },
  ];
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.surface, borderTop:`1.5px solid ${C.border}`, display:"flex", zIndex:200, paddingBottom:"env(safe-area-inset-bottom)", boxShadow:"0 -2px 10px rgba(0,0,0,.07)" }}>
      {items.map(n=>(
        <button key={n.id} onClick={()=>setActiveTab(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, padding:"10px 4px 9px", background:"none", border:"none", color:activeTab===n.id?C.brand:C.textMid, cursor:"pointer", fontFamily:"inherit", fontSize:F.xs, fontWeight:activeTab===n.id?700:500, borderTop:activeTab===n.id?`3px solid ${C.brand}`:"3px solid transparent" }}>
          <span style={{ fontSize:20 }}>{n.icon}</span>{n.label}
        </button>
      ))}
    </div>
  );
}

export default function Checklist({ currentUser: portalUser }) {
  const [w, setW] = useState(typeof window!=="undefined"?window.innerWidth:1024);
  useEffect(()=>{ const fn=()=>setW(window.innerWidth); window.addEventListener("resize",fn); return()=>window.removeEventListener("resize",fn); },[]);
  const isMobile = w < 768;

  const [staffList,     setStaffList]     = useState([]);
  const [currentUser,   setCurrentUser]   = useState(null);
  const [checklists,    setChecklists]    = useState([]);
  const [events,        setEvents]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [authError,     setAuthError]     = useState(null);
  const [activeTab,     setActiveTab]     = useState("dashboard");
  const [toast,         setToast]         = useState({ msg:"", type:"success" });
  const [openItem,      setOpenItem]      = useState(null);

  const mountedRef    = useRef(true);
  const toastTimerRef = useRef(null);
  useEffect(()=>{ mountedRef.current=true; return()=>{ mountedRef.current=false; if(toastTimerRef.current)clearTimeout(toastTimerRef.current); }; },[]);

  const showToast = useCallback((msg,type="success")=>{
    if(!mountedRef.current)return;
    if(toastTimerRef.current)clearTimeout(toastTimerRef.current);
    setToast({msg,type});
    toastTimerRef.current=setTimeout(()=>{ if(mountedRef.current)setToast({msg:"",type:"success"}); },3200);
  },[]);

  const fetchAll = useCallback(async (resolvedUser)=>{
    setLoading(true); setAuthError(null);
    try {
      const profiles = await db.getStaffProfiles();
      if(!mountedRef.current)return;
      setStaffList(profiles);
      let activeUser = resolvedUser;
      if(!activeUser) {
        activeUser = resolveActiveUser(portalUser, profiles);
        if(!activeUser) { setAuthError(`Staff profile not found for "${portalUser?.name||"unknown user"}". Please ensure your profile is active.`); setLoading(false); return; }
      }
      if(!mountedRef.current)return;
      setCurrentUser(activeUser);
      const [examData, eventData] = await Promise.all([db.getExamChecklists(activeUser), db.getEventChecklists(activeUser)]);
      if(!mountedRef.current)return;
      setChecklists(examData);
      setEvents(eventData);
    } catch(err) {
      if(!mountedRef.current)return;
      setAuthError(err.message);
      showToast("⚠️ "+err.message,"error");
    } finally { if(mountedRef.current)setLoading(false); }
  },[portalUser,showToast]);

  useEffect(()=>{ fetchAll(null); },[fetchAll]);

  const prevUserIdRef = useRef(null);
  useEffect(()=>{
    if(currentUser?.id!==undefined&&currentUser.id!==prevUserIdRef.current) { prevUserIdRef.current=currentUser.id; setActiveTab("dashboard"); }
  },[currentUser?.id]);

  const handleSwitchUser = useCallback((user)=>{
    const resolved = resolveActiveUser({...user,role:user.role},staffList);
    if(!resolved)return;
    setCurrentUser(resolved);
    Promise.all([db.getExamChecklists(resolved),db.getEventChecklists(resolved)])
      .then(([e,ev])=>{ if(mountedRef.current){setChecklists(e);setEvents(ev);} }).catch(()=>{});
  },[staffList]);

  const handleAssign = useCallback((items,isEvent)=>{
    if(isEvent) setEvents(prev=>[...items,...prev]);
    else        setChecklists(prev=>[...items,...prev]);
    showToast(`✅ ${items.length} ${isEvent?"event":"checklist"}${items.length!==1?"s":""} assigned!`);
  },[showToast]);

  const handleDelete = useCallback(async (id,isEvent)=>{
    if(!window.confirm("Delete this item?"))return;
    try {
      if(isEvent) await db.deleteEventChecklist(id); else await db.deleteExamChecklist(id);
      if(mountedRef.current) { if(isEvent) setEvents(prev=>prev.filter(c=>c.id!==id)); else setChecklists(prev=>prev.filter(c=>c.id!==id)); }
      showToast("Deleted","info");
    } catch(e) { showToast("Error: "+e.message,"error"); }
  },[showToast]);

  const handleUpdate = useCallback((updated,isEvent)=>{
    if(!updated)return;
    if(isEvent) setEvents(prev=>prev.map(c=>c.id===updated.id?updated:c));
    else        setChecklists(prev=>prev.map(c=>c.id===updated.id?updated:c));
    setOpenItem(prev=>prev?.item?.id===updated.id?{...prev,item:updated}:prev);
    const steps = isEvent?(EVENT_STEPS[updated.event_type]||[]):(PIPELINE_STEPS[updated.exam_type]||[]);
    const allApproved = steps.every(s=>updated.step_data?.[s.key]?.status==="approved");
    if(updated.status==="finalized") showToast("🏁 Finalized!");
    else if(allApproved) showToast("✅ All steps approved — ready for sign-off!");
    else showToast("✅ Step updated!");
  },[showToast]);

  const handleOpen = useCallback((item,isEvent)=>setOpenItem({item,isEvent}),[]);

  if(loading&&!currentUser) return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif", color:C.text, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Spinner />
    </div>
  );
  if(authError&&!currentUser) return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif", color:C.text, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ maxWidth:480, width:"100%" }}><ErrorBanner message={authError} onRetry={()=>fetchAll(null)} /></div>
    </div>
  );

  const activeUser = currentUser || { id:0, name:portalUser?.name||"User", role:resolveRole(portalUser?.role), department:"Administration" };
  const viewProps  = { currentUser:activeUser, checklists, events, staff:staffList, isMobile, onOpen:handleOpen, onDelete:handleDelete, onAssign:handleAssign };

  const renderTab = () => {
    if(loading) return <Spinner />;
    switch(activeTab) {
      case "dashboard": return <DashboardView {...viewProps} />;
      case "exams":     return <ExamsView {...viewProps} />;
      case "events":    return <EventsView {...viewProps} />;
      case "records":   return <RecordsView examChecklists={checklists} eventChecklists={events} isMobile={isMobile} />;
      case "monitor":   return PERMS.canViewMonitor(activeUser)?<MonitorView {...viewProps} />:<DashboardView {...viewProps} />;
      default:          return <DashboardView {...viewProps} />;
    }
  };

  const pageStyle = { background:C.bg, minHeight:"100vh", fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif", color:C.text };

  return (
    <div style={pageStyle}>
      <Toast msg={toast.msg} type={toast.type} />
      {isMobile ? (
        <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          <div style={{ background:C.surface, borderBottom:`1.5px solid ${C.border}`, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px" }}>
              <div>
                <div style={{ fontSize:F.xs, color:C.brand, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>GNSI</div>
                <div style={{ fontSize:F.xl, fontWeight:800, color:C.text, lineHeight:1.2 }}>
                  {{dashboard:"Dashboard",exams:"Exams",events:"Events",records:"Records",monitor:"Monitor"}[activeTab]||"Dashboard"}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Avatar name={activeUser.name} role={activeUser.role} size={30} />
                <button onClick={()=>fetchAll(activeUser)} style={{ ...s.btnGhost, padding:"8px 11px" }}>🔄</button>
              </div>
            </div>
          </div>
          <div style={{ flex:1, padding:"14px 14px", paddingBottom:86 }}>{renderTab()}</div>
          <BottomNav currentUser={activeUser} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          <TopNav currentUser={activeUser} activeTab={activeTab} setActiveTab={setActiveTab} onRefresh={()=>fetchAll(activeUser)} users={staffList} setCurrentUser={handleSwitchUser} checklists={checklists} events={events} />
          <div style={{ flex:1, padding:26, maxWidth:1200, margin:"0 auto", width:"100%" }}>{renderTab()}</div>
        </div>
      )}
      {openItem && (
        <DetailModal checklist={openItem.item} currentUser={activeUser} onClose={()=>setOpenItem(null)} onUpdate={handleUpdate} isMobile={isMobile} isEvent={openItem.isEvent} />
      )}
    </div>
  );
}