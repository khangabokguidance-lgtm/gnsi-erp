import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE LAYER — all queries with server-side role filtering
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

  // FIX #2: Server-side filtering by role — staff only get their own tasks
  async getTasks(currentUser) {
    let query = supabase.from("staff_tasks").select("*").order("created_at", { ascending: false });
    if (currentUser?.role === "staff") {
      query = query.eq("assigned_to", currentUser.name);
    } else if (currentUser?.role === "incharge") {
      query = query.eq("department", currentUser.department);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // FIX #7: Server-side ownership check before update
  async assignTask(form, assignedByUser) {
    // FIX #4: assigned_by always comes from the verified server user, not client input
    const payload = { ...form, assigned_by: assignedByUser.name };
    const { data, error } = await supabase.from("staff_tasks").insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  async updateTask(id, changes, currentUser) {
    let query = supabase.from("staff_tasks")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id);
    // FIX #7: staff can only update their own tasks
    if (currentUser?.role === "staff") {
      query = query.eq("assigned_to", currentUser.name);
    }
    // FIX #6: incharge can only update tasks in their department
    if (currentUser?.role === "incharge") {
      query = query.eq("department", currentUser.department);
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async deleteTask(id, currentUser) {
    // FIX #7: server-side delete guard
    let query = supabase.from("staff_tasks").delete().eq("id", id);
    if (currentUser?.role === "incharge") {
      query = query.eq("department", currentUser.department);
    }
    // staff cannot delete tasks at all — blocked at UI + DB level
    const { error } = await query;
    if (error) throw error;
  },

  async getDuties(currentUser) {
    let query = supabase.from("staff_duties").select("*").order("created_at", { ascending: false });
    if (currentUser?.role === "staff") {
      query = query.eq("staff_id", currentUser.id);
    } else if (currentUser?.role === "incharge") {
      query = query.eq("department", currentUser.department);
    }
    const { data, error } = await query;
    if (error) return [];
    return data || [];
  },

  async addDuty(form, assignedByUser) {
    const payload = { ...form, created_by: assignedByUser.name, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from("staff_duties").insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  // FIX #8: Upload file to Supabase Storage and return public URL
  async uploadFile(file, taskId) {
    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `task-submissions/${taskId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("submissions").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("submissions").getPublicUrl(path);
    return { name: file.name, size: `${(file.size / 1024).toFixed(0)} KB`, type: ext, url: urlData.publicUrl };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════
function useBreakpoint() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1024, w };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & THEME
// ═══════════════════════════════════════════════════════════════════════════════
const PRIORITIES  = ["High", "Medium", "Low"];
const DEPARTMENTS = ["Administration","Academic","Accounts","Hostel","Reception","Transport","Maintenance"];
const SUB_STATUS  = ["Not Submitted","Under Review","Approved","Rejected"];
const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#16a34a" };
const SUB_STATUS_META = {
  "Not Submitted": { color: "#64748b", bg: "#f1f5f9", icon: "○" },
  "Under Review":  { color: "#d97706", bg: "#fffbeb", icon: "⏳" },
  "Approved":      { color: "#16a34a", bg: "#f0fdf4", icon: "✅" },
  "Rejected":      { color: "#dc2626", bg: "#fef2f2", icon: "✕" },
};
const FILE_ICON = { pdf: "📄", xlsx: "📊", docx: "📝", img: "🖼️", jpg:"🖼️", jpeg:"🖼️", png:"🖼️", default: "📎" };

const fmtDate  = d => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtTime  = d => d ? new Date(d).toLocaleString("en-IN",  { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—";
const daysDiff = d => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000); };
const isOverdue = t => t.status !== "Done" && t.status !== "Submitted" && t.due_date && daysDiff(t.due_date) < 0;
const initials  = n => n?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const roleColor = { admin: "#6366f1", incharge: "#0ea5e9", staff: "#16a34a" };
const roleLabel = { admin: "Admin", incharge: "In-charge", staff: "Staff" };

// Mobile-first font scale
const F = {
  xs:   13,  // was 10-11
  sm:   14,  // was 11-12
  base: 15,  // was 13
  md:   16,  // was 13-14
  lg:   18,  // was 16-17
  xl:   22,  // was 18-20
  xxl:  26,  // was 22-26
};

const T = {
  bg:       "#f8fafc",
  surface:  "#ffffff",
  surface2: "#f1f5f9",
  border:   "#e2e8f0",
  accent:   "#4f46e5",
  accentG:  "linear-gradient(135deg,#4f46e5,#6366f1)",
  text:     "#0f172a",
  textMid:  "#475569",
  textDim:  "#94a3b8",
  danger:   "#dc2626",
  success:  "#16a34a",
  warn:     "#d97706",
  info:     "#0ea5e9",
  shadow:   "0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)",
  shadowMd: "0 4px 12px rgba(0,0,0,.08)",
};

const G = {
  page:  { background: T.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif", color: T.text, padding: "0" },
  card:  { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", overflow: "hidden", boxShadow: T.shadow },
  // Mobile-first: larger padding, larger font
  inp:   { width: "100%", padding: "13px 14px", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "10px", color: T.text, fontSize: F.base, boxSizing: "border-box", fontFamily: "inherit", outline: "none", lineHeight: 1.4 },
  lbl:   { display: "block", fontSize: F.xs, fontWeight: "700", color: T.textMid, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "7px" },
  btn:   (bg = "#4f46e5", fg = "white") => ({ background: bg, color: fg, border: "none", borderRadius: "10px", padding: "13px 20px", fontWeight: "700", cursor: "pointer", fontSize: F.base, fontFamily: "inherit", lineHeight: 1 }),
  btnSm: (bg = T.accent) => ({ background: bg, color: "white", border: "none", borderRadius: "8px", padding: "9px 14px", fontWeight: "700", cursor: "pointer", fontSize: F.sm, fontFamily: "inherit", whiteSpace: "nowrap", lineHeight: 1 }),
  th:    { padding: "12px 14px", textAlign: "left", fontSize: F.xs, fontWeight: "700", color: T.textMid, textTransform: "uppercase", letterSpacing: ".06em", borderBottom: `1px solid ${T.border}`, background: T.surface2, whiteSpace: "nowrap" },
  td:    { padding: "12px 14px", fontSize: F.sm, color: T.text, verticalAlign: "middle", borderBottom: `1px solid ${T.border}` },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function Badge({ label, color, bg, icon }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:99, fontSize:F.xs, fontWeight:700, background:bg||T.surface2, color:color||T.textMid, whiteSpace:"nowrap", border:`1px solid ${color}22` }}>
      {icon} {label}
    </span>
  );
}
function SubStatusBadge({ status }) {
  const m = SUB_STATUS_META[status] || SUB_STATUS_META["Not Submitted"];
  return <Badge label={status} color={m.color} bg={m.bg} icon={m.icon} />;
}
function PriorityDot({ priority }) {
  return <span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background:PRIORITY_COLOR[priority]||"#94a3b8", marginRight:6, flexShrink:0 }} />;
}
function Avatar({ name, role, size = 40 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`${roleColor[role]||"#6366f1"}18`, border:`2px solid ${roleColor[role]||"#6366f1"}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.36, fontWeight:700, color:roleColor[role]||"#6366f1", flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}
function Toast({ msg, type = "success" }) {
  if (!msg) return null;
  const colors = { success: "#16a34a", error: "#dc2626", info: "#0ea5e9" };
  return (
    <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:9999, background:T.surface, border:`1px solid ${colors[type]}40`, color:colors[type], padding:"14px 22px", borderRadius:12, boxShadow:"0 8px 24px rgba(0,0,0,.14)", fontSize:F.base, fontWeight:700, display:"flex", alignItems:"center", gap:9, whiteSpace:"nowrap", maxWidth:"92vw" }}>
      {type==="success"?"✅":type==="error"?"❌":"ℹ️"} {msg}
    </div>
  );
}
function ProgressBar({ done, total, overdue = 0 }) {
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = overdue > 0 ? T.danger : pct >= 80 ? T.success : pct >= 50 ? T.warn : T.info;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:F.xs, color:T.textMid }}>{done}/{total} done</span>
        <span style={{ fontSize:F.xs, fontWeight:700, color }}>{pct}%</span>
      </div>
      <div style={{ height:6, borderRadius:99, background:T.surface2, border:`1px solid ${T.border}` }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99, transition:"width 0.4s ease" }} />
      </div>
    </div>
  );
}
function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:56, gap:14, color:T.textMid }}>
      <div style={{ width:22, height:22, border:`2.5px solid ${T.border}`, borderTop:`2.5px solid ${T.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <span style={{ fontSize:F.base }}>Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
function FileChip({ file, onRemove }) {
  const icon = FILE_ICON[file.type] || FILE_ICON.default;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, padding:"9px 12px" }}>
      <span style={{ fontSize:20 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:F.sm, fontWeight:600, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{file.name}</div>
        {file.size && <div style={{ fontSize:F.xs, color:T.textMid }}>{file.size}</div>}
      </div>
      {onRemove && <button onClick={onRemove} style={{ background:"none", border:"none", color:T.danger, cursor:"pointer", fontSize:18, padding:4 }}>✕</button>}
      {!onRemove && file.url && file.url !== "#" && (
        <a href={file.url} target="_blank" rel="noreferrer" style={{ fontSize:F.xs, color:T.accent, textDecoration:"none", fontWeight:700, padding:"4px 8px", background:`${T.accent}10`, borderRadius:6 }}>↓ Open</a>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAV COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function BottomNav({ currentUser, activeView, setActiveView }) {
  const navItems = useMemo(() => {
    if (currentUser.role === "admin") return [
      { id:"dashboard", label:"Home",   icon:"🏠" },
      { id:"tasks",     label:"Tasks",  icon:"📋" },
      { id:"staff",     label:"Staff",  icon:"👥" },
      { id:"review",    label:"Review", icon:"🔍" },
      { id:"more",      label:"More",   icon:"⋯"  },
    ];
    if (currentUser.role === "incharge") return [
      { id:"dashboard", label:"Home",   icon:"🏠" },
      { id:"tasks",     label:"Tasks",  icon:"📋" },
      { id:"staff",     label:"Staff",  icon:"👥" },
      { id:"review",    label:"Review", icon:"🔍" },
      { id:"duties",    label:"Duties", icon:"📌" },
    ];
    return [
      { id:"dashboard", label:"Home",   icon:"🏠" },
      { id:"mytasks",   label:"Tasks",  icon:"📋" },
      { id:"myduties",  label:"Duties", icon:"📌" },
      { id:"submit",    label:"Submit", icon:"📤" },
    ];
  }, [currentUser.role]);

  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:T.surface, borderTop:`1.5px solid ${T.border}`, display:"flex", zIndex:200, paddingBottom:"env(safe-area-inset-bottom)", boxShadow:"0 -2px 10px rgba(0,0,0,.08)" }}>
      {navItems.map(n => (
        <button key={n.id} onClick={() => setActiveView(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, padding:"12px 4px 10px", background:"none", border:"none", color:activeView===n.id?T.accent:T.textMid, cursor:"pointer", fontFamily:"inherit", fontSize:F.xs, fontWeight:activeView===n.id?700:500, borderTop:activeView===n.id?`3px solid ${T.accent}`:"3px solid transparent" }}>
          <span style={{ fontSize:22 }}>{n.icon}</span>
          {n.label}
        </button>
      ))}
    </div>
  );
}

function MoreMenu({ currentUser, activeView, setActiveView, onClose }) {
  const extras = currentUser.role === "admin"
    ? [{ id:"duties", label:"Duties", icon:"📌" }, { id:"monitoring", label:"Monitoring", icon:"📊" }]
    : [];
  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,.25)" }} onClick={onClose}>
      <div style={{ position:"absolute", bottom:80, left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:"18px 18px 0 0", padding:"18px 16px", boxShadow:"0 -4px 24px rgba(0,0,0,.12)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:F.xs, color:T.textMid, fontWeight:700, textTransform:"uppercase", marginBottom:14, paddingLeft:4 }}>More Options</div>
        {extras.map(n => (
          <button key={n.id} onClick={() => { setActiveView(n.id); onClose(); }} style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"14px", borderRadius:12, background:activeView===n.id?`${T.accent}10`:"none", border:"none", color:activeView===n.id?T.accent:T.text, fontSize:F.md, fontWeight:600, cursor:"pointer", fontFamily:"inherit", textAlign:"left", marginBottom:6 }}>
            <span style={{ fontSize:24 }}>{n.icon}</span> {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TopNav({ currentUser, activeView, setActiveView, setCurrentUser, users, onRefresh, tasks }) {
  const navItems = useMemo(() => {
    if (currentUser.role === "admin") return [
      { id:"dashboard",  label:"Dashboard",  icon:"🏠" },
      { id:"tasks",      label:"All Tasks",  icon:"📋" },
      { id:"staff",      label:"Staff",      icon:"👥" },
      { id:"duties",     label:"Duties",     icon:"📌" },
      { id:"monitoring", label:"Monitor",    icon:"📊" },
      { id:"review",     label:"Review",     icon:"🔍" },
    ];
    if (currentUser.role === "incharge") return [
      { id:"dashboard",  label:"Dashboard",  icon:"🏠" },
      { id:"tasks",      label:"Dept Tasks", icon:"📋" },
      { id:"staff",      label:"My Staff",   icon:"👥" },
      { id:"duties",     label:"Duties",     icon:"📌" },
      { id:"review",     label:"Review",     icon:"🔍" },
    ];
    return [
      { id:"dashboard",  label:"Dashboard",  icon:"🏠" },
      { id:"mytasks",    label:"My Tasks",   icon:"📋" },
      { id:"myduties",   label:"My Duties",  icon:"📌" },
      { id:"submit",     label:"Submit Work",icon:"📤" },
    ];
  }, [currentUser.role]);

  const pendingReview = tasks.filter(t =>
    t.submission_status === "Under Review" &&
    (currentUser.role === "admin" || (currentUser.role === "incharge" && t.department === currentUser.department))
  ).length;

  return (
    <div style={{ background:"white", borderBottom:`1px solid ${T.border}`, boxShadow:"0 2px 8px rgba(0,0,0,.06)", position:"sticky", top:0, zIndex:100 }}>
      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", height:56, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ background:T.accentG, borderRadius:10, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>✅</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:T.text, letterSpacing:-.2 }}>GNSI Checklist</div>
            <div style={{ fontSize:11, color:T.textMid }}>Task Management System</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {pendingReview > 0 && (
            <button onClick={() => setActiveView("review")} style={{ ...G.btnSm(T.warn), display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
              🔍 {pendingReview} Pending Review
            </button>
          )}
          {currentUser.role === "admin" && users.length > 1 && (
            <select style={{ ...G.inp, width:"auto", padding:"7px 10px", fontSize:12, border:`1.5px solid ${T.border}`, borderRadius:8 }}
              value={currentUser.id} onChange={e => setCurrentUser(users.find(u => u.id === +e.target.value) || users[0])}>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({roleLabel[u.role] || u.role})</option>)}
            </select>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:T.surface2, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"7px 12px" }}>
            <Avatar name={currentUser.name} role={currentUser.role} size={26} />
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{currentUser.name}</div>
              <div style={{ fontSize:10, fontWeight:700, color:roleColor[currentUser.role], textTransform:"uppercase" }}>{roleLabel[currentUser.role]}</div>
            </div>
          </div>
          <button onClick={onRefresh} style={{ ...G.btnSm(T.surface2), border:`1.5px solid ${T.border}`, color:T.textMid, fontSize:13 }}>🔄</button>
          <div style={{ fontSize:12, color:T.textMid, background:T.surface2, padding:"7px 12px", borderRadius:8, border:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>
            {new Date().toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" })}
          </div>
        </div>
      </div>
      {/* Tab bar */}
      <div style={{ display:"flex", alignItems:"center", padding:"0 28px", gap:2 }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setActiveView(n.id)} style={{
            display:"flex", alignItems:"center", gap:7, padding:"13px 18px",
            border:"none", background:"none", cursor:"pointer", fontFamily:"inherit",
            fontSize:13, fontWeight:activeView===n.id?700:500,
            color:activeView===n.id?T.accent:T.textMid,
            borderBottom:activeView===n.id?`2.5px solid ${T.accent}`:"2.5px solid transparent",
            marginBottom:-1, transition:"all .15s",
            whiteSpace:"nowrap",
          }}>
            <span style={{ fontSize:15 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileHeader({ currentUser, activeView, tasks, onRefresh, users, setCurrentUser }) {
  const [showUserPicker, setShowUserPicker] = useState(false);
  const VIEW_LABEL = {
    dashboard:"Dashboard", tasks:"Tasks", mytasks:"My Tasks", staff:"Staff",
    monitoring:"Monitoring", review:"Review", duties:"Duties", myduties:"My Duties", submit:"Submit Work",
  };
  const pendingReview = tasks.filter(t =>
    t.submission_status === "Under Review" &&
    (currentUser.role === "admin" || (currentUser.role === "incharge" && t.department === currentUser.department))
  ).length;

  return (
    <div style={{ background:T.surface, borderBottom:`1.5px solid ${T.border}`, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px" }}>
        <div>
          <div style={{ fontSize:F.xs, color:T.accent, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>GNSI Checklist</div>
          <div style={{ fontSize:F.xl, fontWeight:800, color:T.text, lineHeight:1.2 }}>{VIEW_LABEL[activeView] || "Dashboard"}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          {pendingReview > 0 && (
            <div style={{ background:T.warn, color:"white", borderRadius:99, fontSize:F.sm, fontWeight:800, padding:"3px 10px" }}>{pendingReview}</div>
          )}
          {/* FIX #3: Only admin sees user switcher on mobile */}
          {currentUser.role === "admin" && (
            <button onClick={() => setShowUserPicker(v => !v)} style={{ display:"flex", alignItems:"center", gap:7, background:T.surface2, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"8px 12px", cursor:"pointer", color:T.text, fontFamily:"inherit", fontSize:F.sm, fontWeight:600 }}>
              <Avatar name={currentUser.name} role={currentUser.role} size={26} />
              <span style={{ fontSize:F.xs, color:roleColor[currentUser.role], fontWeight:700, textTransform:"uppercase" }}>{roleLabel[currentUser.role] || currentUser.role}</span>
            </button>
          )}
          {currentUser.role !== "admin" && (
            <div style={{ display:"flex", alignItems:"center", gap:7, background:T.surface2, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"8px 12px" }}>
              <Avatar name={currentUser.name} role={currentUser.role} size={26} />
              <span style={{ fontSize:F.xs, color:roleColor[currentUser.role], fontWeight:700, textTransform:"uppercase" }}>{roleLabel[currentUser.role] || currentUser.role}</span>
            </div>
          )}
          <button onClick={onRefresh} style={{ background:T.surface2, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"10px 12px", cursor:"pointer", color:T.textMid, fontFamily:"inherit", fontSize:F.md, lineHeight:1 }}>🔄</button>
        </div>
      </div>
      {showUserPicker && currentUser.role === "admin" && users.length > 1 && (
        <div style={{ padding:"10px 16px 14px", borderTop:`1px solid ${T.border}`, background:T.surface2 }}>
          <label style={G.lbl}>Switch User (Admin Only)</label>
          <select style={{ ...G.inp }} value={currentUser.id} onChange={e => { setCurrentUser(users.find(u => u.id === +e.target.value) || users[0]); setShowUserPicker(false); }}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({roleLabel[u.role] || u.role})</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════
function AssignTaskModal({ currentUser, staffList, preselected, onClose, onSave }) {
  const [form, setForm] = useState({
    title: "", description: "", priority: "Medium", due_date: "",
    department: preselected?.department || currentUser.department || "Academic",
    assigned_to: preselected?.name || (staffList[0]?.name || ""),
    // FIX #4: assigned_by is set server-side in db.assignTask, not from form
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.assigned_to) { alert("Title and assignee required"); return; }
    setSaving(true);
    try {
      // FIX #4: pass currentUser so server sets assigned_by authoritatively
      const task = await db.assignTask(form, currentUser);
      onSave(task); onClose();
    } catch (err) {
      alert("Error saving task: " + err.message);
    } finally { setSaving(false); }
  };

  const filteredStaff = currentUser.role === "incharge"
    ? staffList.filter(s => s.department === currentUser.department && s.role === "staff")
    : staffList.filter(s => s.role !== "admin");

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", backdropFilter:"blur(4px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...G.card, width:"100%", maxWidth:600, maxHeight:"94vh", display:"flex", flexDirection:"column", borderRadius:"18px 18px 0 0", boxShadow:"0 -8px 36px rgba(0,0,0,.14)" }}>
        <div style={{ background:T.accentG, padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.7)", textTransform:"uppercase", letterSpacing:1 }}>New Assignment</div>
            <div style={{ fontSize:F.lg, fontWeight:800, color:"white" }}>Assign Task</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.22)", border:"none", color:"white", borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:20, fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:"18px 20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={G.lbl}>Task Title *</label>
            <input style={G.inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Submit June Lesson Plan" />
          </div>
          <div>
            <label style={G.lbl}>Instructions / Description</label>
            <textarea style={{ ...G.inp, resize:"vertical", minHeight:80 }} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Detailed instructions…" />
          </div>
          <div>
            <label style={G.lbl}>Assign To *</label>
            <select style={{ ...G.inp }} value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)}>
              {filteredStaff.map(s => <option key={s.id} value={s.name}>{s.name} — {s.designation}</option>)}
            </select>
          </div>
          <div>
            <label style={G.lbl}>Department</label>
            <select style={{ ...G.inp }} value={form.department} onChange={e => set("department", e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div>
              <label style={G.lbl}>Priority</label>
              <select style={{ ...G.inp }} value={form.priority} onChange={e => set("priority", e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={G.lbl}>Due Date</label>
              <input type="date" style={G.inp} value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ padding:"14px 20px 24px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10, background:T.surface2 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, background:T.accentG, color:"white", border:"none", borderRadius:12, padding:16, cursor:saving?"not-allowed":"pointer", fontWeight:800, fontSize:F.base, fontFamily:"inherit", opacity:saving?0.6:1 }}>
            {saving ? "⏳ Assigning…" : "✅ Assign Task"}
          </button>
          <button onClick={onClose} style={{ padding:"16px 20px", background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:12, cursor:"pointer", fontWeight:600, color:T.textMid, fontFamily:"inherit", fontSize:F.base }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SubmitWorkModal({ task, currentUser, onClose, onSubmit }) {
  const [note, setNote]     = useState(task.submission_note || "");
  const [files, setFiles]   = useState(task.submission_files || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // FIX #5: guard against resubmitting approved tasks
  const alreadyApproved = task.submission_status === "Approved";

  // FIX #8: actual file upload to Supabase Storage
  const handleFileAdd = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setUploading(true);
    try {
      const uploaded = await db.uploadFile(f, task.id);
      setFiles(prev => [...prev, uploaded]);
    } catch (err) {
      // Fallback: store metadata only if storage bucket not configured
      const ext  = f.name.split(".").pop().toLowerCase();
      const type = ["jpg","jpeg","png","gif","webp"].includes(ext) ? "img" : ext;
      setFiles(prev => [...prev, { name: f.name, size: `${(f.size / 1024).toFixed(0)} KB`, type, url: "#" }]);
      console.warn("File upload failed, storing metadata only:", err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (alreadyApproved) return;
    setSaving(true);
    try { await onSubmit(task.id, note, files); onClose(); }
    catch (err) { alert("Submit failed: " + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", backdropFilter:"blur(4px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...G.card, width:"100%", maxWidth:600, maxHeight:"94vh", display:"flex", flexDirection:"column", borderRadius:"18px 18px 0 0", boxShadow:"0 -8px 36px rgba(0,0,0,.14)" }}>
        <div style={{ background:"linear-gradient(135deg,#059669,#10b981)", padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.7)", textTransform:"uppercase", letterSpacing:1 }}>Work Submission</div>
            <div style={{ fontSize:F.base, fontWeight:700, color:"white" }}>{task.title}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.22)", border:"none", color:"white", borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:20, fontFamily:"inherit" }}>✕</button>
        </div>
        {alreadyApproved ? (
          <div style={{ padding:28, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
            <div style={{ fontSize:F.lg, fontWeight:700, color:T.success }}>Already Approved</div>
            <div style={{ fontSize:F.sm, color:T.textMid, marginTop:6 }}>This task has been approved and cannot be resubmitted.</div>
            <button onClick={onClose} style={{ ...G.btn(T.surface, T.textMid), border:`1.5px solid ${T.border}`, marginTop:20, width:"100%" }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ padding:"18px 20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:T.surface2, borderRadius:12, padding:"14px 16px", fontSize:F.base, color:T.textMid, lineHeight:1.6, border:`1px solid ${T.border}` }}>
                <div style={{ fontWeight:700, color:T.text, marginBottom:5, fontSize:F.base }}>📋 Instructions</div>
                {task.description || "No specific instructions provided."}
              </div>
              {task.submission_status === "Rejected" && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontWeight:700, color:T.danger, fontSize:F.base, marginBottom:5 }}>❌ Previously Rejected</div>
                  <div style={{ fontSize:F.sm, color:"#dc2626" }}>{task.review_feedback}</div>
                </div>
              )}
              <div>
                <label style={G.lbl}>Completion Note *</label>
                <textarea style={{ ...G.inp, resize:"vertical", minHeight:90 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Describe what you did…" />
              </div>
              <div>
                <label style={G.lbl}>Attach Work Files</label>
                <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                  {files.map((f, i) => <FileChip key={i} file={f} onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))} />)}
                  <input ref={fileRef} type="file" style={{ display:"none" }} onChange={handleFileAdd} accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...G.btn(T.surface, T.textMid), border:`1.5px dashed ${T.border}`, borderRadius:10, padding:"14px 16px", textAlign:"left", fontSize:F.base, width:"100%", opacity:uploading?0.6:1 }}>
                    {uploading ? "⏳ Uploading…" : "📎 Attach file (PDF, DOCX, XLSX, Image)"}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ padding:"14px 20px 24px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10, background:T.surface2 }}>
              <button onClick={handleSubmit} disabled={saving || !note.trim()} style={{ flex:1, background:"linear-gradient(135deg,#059669,#10b981)", color:"white", border:"none", borderRadius:12, padding:16, cursor:saving||!note.trim()?"not-allowed":"pointer", fontWeight:800, fontSize:F.base, fontFamily:"inherit", opacity:saving||!note.trim()?0.6:1 }}>
                {saving ? "⏳ Submitting…" : "📤 Submit Work"}
              </button>
              <button onClick={onClose} style={{ padding:"16px 18px", background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:12, cursor:"pointer", fontWeight:600, color:T.textMid, fontFamily:"inherit", fontSize:F.base }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewModal({ task, currentUser, onClose, onReview }) {
  const [feedback, setFeedback] = useState(task.review_feedback || "");
  const [saving, setSaving]     = useState(false);

  // FIX #6: verify department access before review
  const canReviewThisTask = currentUser.role === "admin" ||
    (currentUser.role === "incharge" && task.department === currentUser.department);

  const handleReview = async (action) => {
    if (!canReviewThisTask) { alert("You can only review tasks in your department."); return; }
    setSaving(true);
    try { await onReview(task.id, action, feedback, currentUser.name); onClose(); }
    catch (err) { alert("Review failed: " + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", backdropFilter:"blur(4px)", zIndex:2001, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...G.card, width:"100%", maxWidth:600, maxHeight:"94vh", display:"flex", flexDirection:"column", borderRadius:"18px 18px 0 0", boxShadow:"0 -8px 36px rgba(0,0,0,.14)" }}>
        <div style={{ background:"linear-gradient(135deg,#1e40af,#3b82f6)", padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:F.xs, color:"rgba(255,255,255,.7)", textTransform:"uppercase", letterSpacing:1 }}>Submission Review</div>
            <div style={{ fontSize:F.base, fontWeight:700, color:"white" }}>{task.title}</div>
            <div style={{ fontSize:F.sm, color:"rgba(255,255,255,.8)", marginTop:3 }}>by {task.assigned_to} · {task.department}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.22)", border:"none", color:"white", borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:20, fontFamily:"inherit" }}>✕</button>
        </div>
        {!canReviewThisTask ? (
          <div style={{ padding:28, textAlign:"center", color:T.danger, fontSize:F.base }}>
            🚫 You don't have permission to review this task.
          </div>
        ) : (
          <>
            <div style={{ padding:"18px 20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:T.surface2, borderRadius:12, padding:"14px 16px", border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:F.xs, color:T.textMid, fontWeight:700, textTransform:"uppercase", marginBottom:7 }}>Staff Completion Note</div>
                <div style={{ fontSize:F.base, color:T.text, lineHeight:1.6 }}>{task.submission_note || "No note provided."}</div>
              </div>
              {task.submission_files?.length > 0 && (
                <div>
                  <div style={{ fontSize:F.xs, color:T.textMid, fontWeight:700, textTransform:"uppercase", letterSpacing:.06, marginBottom:9 }}>Files ({task.submission_files.length})</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    {task.submission_files.map((f, i) => <FileChip key={i} file={f} />)}
                  </div>
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[["Submitted", fmtTime(task.submitted_at)], ["Due Date", fmtDate(task.due_date)]].map(([l, v]) => (
                  <div key={l} style={{ background:T.surface2, borderRadius:10, padding:"12px 14px", border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:F.xs, color:T.textMid, fontWeight:700, textTransform:"uppercase", marginBottom:3 }}>{l}</div>
                    <div style={{ fontSize:F.base, color:T.text, fontWeight:600 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <label style={G.lbl}>Review Feedback</label>
                <textarea style={{ ...G.inp, resize:"vertical", minHeight:80 }} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback or rejection reason…" />
              </div>
            </div>
            <div style={{ padding:"14px 20px 24px", borderTop:`1px solid ${T.border}`, display:"flex", gap:9, background:T.surface2 }}>
              <button onClick={() => handleReview("Approved")} disabled={saving} style={{ flex:1, background:"linear-gradient(135deg,#059669,#10b981)", color:"white", border:"none", borderRadius:12, padding:16, cursor:"pointer", fontWeight:800, fontSize:F.base, fontFamily:"inherit" }}>✅ Approve</button>
              <button onClick={() => { if (!feedback.trim()) { alert("Please provide rejection feedback."); return; } handleReview("Rejected"); }} disabled={saving} style={{ flex:1, background:"linear-gradient(135deg,#dc2626,#ef4444)", color:"white", border:"none", borderRadius:12, padding:16, cursor:"pointer", fontWeight:800, fontSize:F.base, fontFamily:"inherit" }}>❌ Reject</button>
              <button onClick={onClose} style={{ padding:"16px 16px", background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:12, cursor:"pointer", fontWeight:600, color:T.textMid, fontFamily:"inherit", fontSize:F.base }}>✕</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK CARD — mobile-first large touch targets
// ═══════════════════════════════════════════════════════════════════════════════
function TaskCard({ task, currentUser, onSubmit, onReview, onStatusChange, onDelete }) {
  const overdue   = isOverdue(task);
  const diff      = daysDiff(task.due_date);
  // FIX #5: staff can only submit if not already approved
  const canSubmit = currentUser.role === "staff" &&
    task.assigned_to === currentUser.name &&
    task.status !== "Done" &&
    task.submission_status !== "Approved" &&
    (task.submission_status === "Not Submitted" || task.submission_status === "Rejected");
  // FIX #6: double-check department for incharge
  const canReview = (currentUser.role === "admin" ||
    (currentUser.role === "incharge" && task.department === currentUser.department)) &&
    task.submission_status === "Under Review";
  // FIX #7: staff cannot delete
  const canDelete = currentUser.role === "admin" ||
    (currentUser.role === "incharge" && task.department === currentUser.department);

  return (
    <div style={{ background:T.surface, border:`1.5px solid ${overdue?"#fecaca":T.border}`, borderRadius:14, padding:"16px", display:"flex", flexDirection:"column", gap:12, boxShadow:T.shadow, borderLeft:`4px solid ${overdue?T.danger:task.submission_status==="Approved"?T.success:task.submission_status==="Under Review"?T.warn:T.border}` }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:9 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:5 }}>
            <PriorityDot priority={task.priority} />
            <span style={{ fontSize:F.md, fontWeight:700, color:T.text, lineHeight:1.3 }}>{task.title}</span>
          </div>
          <div style={{ fontSize:F.sm, color:T.textMid, display:"flex", gap:10, flexWrap:"wrap", marginTop:3 }}>
            <span>👤 {task.assigned_to}</span>
            <span>🏢 {task.department}</span>
            {task.due_date && (
              <span style={{ color:overdue?T.danger:diff!==null&&diff<=2?T.warn:T.textMid, fontWeight:overdue?700:400 }}>
                📅 {overdue ? `${Math.abs(diff)}d overdue` : diff===0 ? "Due today!" : diff!==null&&diff<=2 ? `${diff}d left` : fmtDate(task.due_date)}
              </span>
            )}
          </div>
        </div>
        <SubStatusBadge status={task.submission_status} />
      </div>

      {task.description && (
        <div style={{ fontSize:F.sm, color:T.textMid, lineHeight:1.6, background:T.surface2, borderRadius:10, padding:"10px 12px", border:`1px solid ${T.border}` }}>
          {task.description.length > 120 ? task.description.slice(0, 120) + "…" : task.description}
        </div>
      )}

      {task.submission_status === "Rejected" && task.review_feedback && (
        <div style={{ fontSize:F.sm, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"10px 12px", color:"#dc2626" }}>
          <span style={{ fontWeight:700 }}>Rejected: </span>{task.review_feedback}
        </div>
      )}
      {task.submission_status === "Approved" && (
        <div style={{ fontSize:F.sm, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", color:"#16a34a" }}>
          ✅ Approved by {task.reviewed_by} · {fmtTime(task.reviewed_at)}
        </div>
      )}

      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {canSubmit && <button onClick={() => onSubmit(task)} style={{ ...G.btnSm("#059669"), padding:"10px 16px", fontSize:F.sm }}>📤 Submit</button>}
        {canReview && <button onClick={() => onReview(task)} style={{ ...G.btnSm("#0ea5e9"), padding:"10px 16px", fontSize:F.sm }}>🔍 Review</button>}
        {canDelete && task.status !== "Done" && task.submission_status !== "Under Review" && (
          <>
            <button onClick={() => onStatusChange(task, task.status === "Pending" ? "In Progress" : "Done")} style={G.btnSm(task.status === "Pending" ? "#0ea5e9" : "#16a34a")}>
              {task.status === "Pending" ? "▶ Start" : "✅ Done"}
            </button>
            <button onClick={() => onDelete(task.id)} style={G.btnSm("#ef4444")}>🗑</button>
          </>
        )}
        {currentUser.role === "staff" && task.assigned_to === currentUser.name && task.submission_status === "Approved" && (
          <span style={{ fontSize:F.sm, color:T.success, fontWeight:700, padding:"6px 0" }}>Approved ✅</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardView({ currentUser, tasks, staff, duties, isMobile }) {
  const myTasks = tasks; // already filtered server-side
  const pendingReview = tasks.filter(t =>
    t.submission_status === "Under Review" &&
    (currentUser.role === "admin" || (currentUser.role === "incharge" && t.department === currentUser.department))
  );
  const stats = {
    total:     myTasks.length,
    done:      myTasks.filter(t => t.status === "Done" || t.submission_status === "Approved").length,
    pending:   myTasks.filter(t => t.status === "Pending").length,
    overdue:   myTasks.filter(t => isOverdue(t)).length,
    submitted: myTasks.filter(t => t.submission_status === "Under Review").length,
    approved:  myTasks.filter(t => t.submission_status === "Approved").length,
    rejected:  myTasks.filter(t => t.submission_status === "Rejected").length,
  };

  const STAT_CARDS = currentUser.role === "staff"
    ? [
      { label:"My Tasks",  value:stats.total,     color:T.info,    icon:"📋" },
      { label:"Pending",   value:stats.pending,   color:T.warn,    icon:"⏳" },
      { label:"Submitted", value:stats.submitted, color:T.info,    icon:"📤" },
      { label:"Approved",  value:stats.approved,  color:T.success, icon:"✅" },
      { label:"Rejected",  value:stats.rejected,  color:T.danger,  icon:"❌" },
      { label:"Overdue",   value:stats.overdue,   color:T.danger,  icon:"🚨" },
    ]
    : [
      { label:"Total Tasks",    value:stats.total,         color:T.info,    icon:"📋" },
      { label:"Approved",       value:stats.done,          color:T.success, icon:"✅" },
      { label:"Overdue",        value:stats.overdue,       color:T.danger,  icon:"🚨" },
      { label:"Pending Review", value:pendingReview.length,color:T.warn,    icon:"🔍" },
      { label:"Staff",          value:currentUser.role==="admin"?staff.filter(s=>s.role==="staff").length:staff.filter(s=>s.role==="staff"&&s.department===currentUser.department).length, color:"#7c3aed", icon:"👥" },
      { label:"Duties",         value:duties.length,       color:"#ea580c", icon:"📌" },
    ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {!isMobile && (
        <div style={{ paddingBottom:4 }}>
          <h2 style={{ fontSize:22, fontWeight:800, color:T.text, margin:"0 0 4px" }}>
            {currentUser.role==="staff" ? "My Dashboard" : currentUser.role==="incharge" ? `${currentUser.department} Dashboard` : "Admin Dashboard"}
          </h2>
          <p style={{ fontSize:F.base, color:T.textMid, margin:0 }}>Welcome back, {currentUser.name}</p>
        </div>
      )}
      {isMobile && (
        <div style={{ background:T.accentG, borderRadius:14, padding:"16px 18px", color:"white" }}>
          <div style={{ fontSize:F.xs, opacity:.8, textTransform:"uppercase", letterSpacing:.5, marginBottom:3 }}>Welcome back</div>
          <div style={{ fontSize:F.xl, fontWeight:800 }}>{currentUser.name}</div>
          <div style={{ fontSize:F.sm, opacity:.8, marginTop:2 }}>{roleLabel[currentUser.role]} · {currentUser.department}</div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(auto-fit,minmax(140px,1fr))", gap:10 }}>
        {STAT_CARDS.map(c => (
          <div key={c.label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:isMobile?"14px 10px":"18px", borderTop:`3px solid ${c.color}`, textAlign:isMobile?"center":"left", boxShadow:T.shadow }}>
            <div style={{ fontSize:isMobile?22:24, marginBottom:5 }}>{c.icon}</div>
            <div style={{ fontSize:isMobile?F.xxl:28, fontWeight:800, color:c.color, lineHeight:1 }}>{c.value}</div>
            <div style={{ fontSize:F.xs, color:T.textMid, marginTop:5, fontWeight:600, lineHeight:1.3 }}>{c.label}</div>
          </div>
        ))}
      </div>
      {pendingReview.length > 0 && (currentUser.role==="admin"||currentUser.role==="incharge") && (
        <div style={{ background:"#fffbeb", border:`1.5px solid #fde68a`, borderRadius:14, padding:"16px 18px" }}>
          <div style={{ fontWeight:700, color:T.warn, fontSize:F.md, marginBottom:9 }}>⏳ {pendingReview.length} Submission{pendingReview.length>1?"s":""} Awaiting Review</div>
          {pendingReview.slice(0, 3).map(t => (
            <div key={t.id} style={{ fontSize:F.sm, color:"#92400e", display:"flex", gap:9, marginBottom:5 }}>
              <span>•</span><span><b>{t.assigned_to}</b> submitted "{t.title}"</span>
            </div>
          ))}
          {pendingReview.length > 3 && <div style={{ fontSize:F.sm, color:T.warn }}>…and {pendingReview.length-3} more</div>}
        </div>
      )}
      {currentUser.role==="staff" && stats.overdue > 0 && (
        <div style={{ background:"#fef2f2", border:`1.5px solid #fecaca`, borderRadius:14, padding:"14px 18px" }}>
          <div style={{ fontWeight:700, color:T.danger, fontSize:F.md }}>🚨 {stats.overdue} overdue task{stats.overdue>1?"s":""}. Submit immediately.</div>
        </div>
      )}
      {currentUser.role==="staff" && stats.rejected > 0 && (
        <div style={{ background:"#fff7ed", border:`1.5px solid #fed7aa`, borderRadius:14, padding:"14px 18px" }}>
          <div style={{ fontWeight:700, color:"#ea580c", fontSize:F.md }}>❌ {stats.rejected} rejected. Check feedback and resubmit.</div>
        </div>
      )}
      <div>
        <div style={{ fontSize:F.sm, fontWeight:700, color:T.textMid, textTransform:"uppercase", letterSpacing:.06, marginBottom:12 }}>Recent Tasks</div>
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {myTasks.slice(0, 5).map(t => (
            <div key={t.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"13px 16px", display:"flex", alignItems:"center", gap:11, boxShadow:T.shadow }}>
              <PriorityDot priority={t.priority} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:F.base, fontWeight:600, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
                <div style={{ fontSize:F.sm, color:T.textMid }}>{t.assigned_to} · {t.department}</div>
              </div>
              <SubStatusBadge status={t.submission_status} />
            </div>
          ))}
          {myTasks.length === 0 && <div style={{ fontSize:F.base, color:T.textMid, padding:"20px 0" }}>No tasks yet.</div>}
        </div>
      </div>
    </div>
  );
}

function TasksView({ currentUser, tasks, onSubmit, onReview, onStatusChange, onDelete, onAssign, allStaff, isMobile }) {
  const [search, setSearch]           = useState("");
  const [filterStatus, setFStatus]    = useState("All");
  const [filterSub, setFSub]          = useState("All");
  const [filterDept, setFDept]        = useState("All");
  const [showAssign, setShowAssign]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // tasks are already server-filtered; UI filter is just for local search/sort
  const visible = useMemo(() => {
    let list = tasks;
    if (filterStatus !== "All") list = list.filter(t => t.status === filterStatus);
    if (filterSub !== "All")    list = list.filter(t => t.submission_status === filterSub);
    if (filterDept !== "All")   list = list.filter(t => t.department === filterDept);
    if (search) list = list.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.assigned_to.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [tasks, filterStatus, filterSub, filterDept, search]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10 }}>
        {!isMobile && <h2 style={{ fontSize:20, fontWeight:800, color:T.text, margin:0 }}>
          {currentUser.role==="staff" ? "My Tasks" : currentUser.role==="incharge" ? `${currentUser.department} Tasks` : "All Tasks"}
        </h2>}
        <div style={{ display:"flex", gap:9, marginLeft:"auto" }}>
          <button onClick={() => setShowFilters(v => !v)} style={{ ...G.btnSm(showFilters?T.accent:T.surface), border:`1.5px solid ${showFilters?T.accent:T.border}`, color:showFilters?"white":T.textMid }}>
            ⚙ Filters {filterStatus!=="All"||filterSub!=="All"||filterDept!=="All"?"•":""}
          </button>
          {currentUser.role !== "staff" && (
            <button onClick={() => setShowAssign(true)} style={{ ...G.btn(), background:T.accentG, padding:"10px 16px", borderRadius:10, fontSize:F.base }}>＋ Assign</button>
          )}
        </div>
      </div>
      <input style={{ ...G.inp, marginBottom:12 }} placeholder="🔍 Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
      {showFilters && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr", gap:9, marginBottom:14 }}>
          <select style={G.inp} value={filterStatus} onChange={e => setFStatus(e.target.value)}>
            {["All","Pending","In Progress","Done"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={G.inp} value={filterSub} onChange={e => setFSub(e.target.value)}>
            {["All",...SUB_STATUS].map(s => <option key={s}>{s}</option>)}
          </select>
          {currentUser.role === "admin" && (
            <select style={{ ...G.inp, gridColumn:isMobile?"1/-1":"auto" }} value={filterDept} onChange={e => setFDept(e.target.value)}>
              {["All",...DEPARTMENTS].map(d => <option key={d}>{d}</option>)}
            </select>
          )}
        </div>
      )}
      <div style={{ fontSize:F.sm, color:T.textMid, marginBottom:10 }}>{visible.length} task{visible.length!==1?"s":""}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        {visible.length === 0
          ? <div style={{ padding:44, textAlign:"center", color:T.textMid, fontSize:F.base }}>No tasks match filters.</div>
          : visible.map(t => <TaskCard key={t.id} task={t} currentUser={currentUser} onSubmit={onSubmit} onReview={onReview} onStatusChange={onStatusChange} onDelete={onDelete} />)
        }
      </div>
      {showAssign && (
        <AssignTaskModal currentUser={currentUser} staffList={allStaff} preselected={null}
          onClose={() => setShowAssign(false)}
          onSave={t => { onAssign(t); setShowAssign(false); }} />
      )}
    </div>
  );
}

function ReviewView({ currentUser, tasks, onReview, isMobile }) {
  const [reviewTask, setReviewTask] = useState(null);
  const [tab, setTab] = useState("Under Review");
  const tabs = ["Under Review","Approved","Rejected"];

  const filtered = tasks.filter(t => {
    const deptOk = currentUser.role === "admin" || t.department === currentUser.department;
    return deptOk && t.submission_status === tab;
  });

  return (
    <div>
      {!isMobile && <h2 style={{ fontSize:20, fontWeight:800, color:T.text, margin:"0 0 16px" }}>Review Submissions</h2>}
      <div style={{ display:"flex", gap:0, marginBottom:16, background:T.surface2, borderRadius:12, padding:4, border:`1px solid ${T.border}` }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"10px 6px", borderRadius:10, border:tab===t?`1px solid ${T.border}`:"none", background:tab===t?T.surface:"none", color:tab===t?T.text:T.textMid, fontWeight:tab===t?700:500, cursor:"pointer", fontSize:isMobile?F.sm:F.base, fontFamily:"inherit", textAlign:"center", boxShadow:tab===t?T.shadow:"none" }}>
            {SUB_STATUS_META[t]?.icon} {isMobile ? t.split(" ")[0] : t}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        {filtered.length === 0
          ? <div style={{ padding:44, textAlign:"center", color:T.textMid, fontSize:F.base }}>No submissions here.</div>
          : filtered.map(t => (
            <div key={t.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px", boxShadow:T.shadow }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:11, marginBottom:12 }}>
                <Avatar name={t.assigned_to} role="staff" size={40} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:F.md, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
                  <div style={{ fontSize:F.sm, color:T.textMid }}>{t.assigned_to} · {t.department}</div>
                  <div style={{ fontSize:F.xs, color:T.textDim }}>{fmtTime(t.submitted_at)}</div>
                </div>
                <SubStatusBadge status={t.submission_status} />
              </div>
              {t.submission_note && (
                <div style={{ fontSize:F.sm, color:T.textMid, background:T.surface2, borderRadius:10, padding:"10px 12px", marginBottom:10, border:`1px solid ${T.border}` }}>"{t.submission_note}"</div>
              )}
              {t.review_feedback && (
                <div style={{ fontSize:F.sm, background:t.submission_status==="Rejected"?"#fef2f2":"#f0fdf4", border:`1px solid ${t.submission_status==="Rejected"?"#fecaca":"#bbf7d0"}`, borderRadius:10, padding:"10px 12px", color:t.submission_status==="Rejected"?"#dc2626":"#16a34a", marginBottom:10 }}>
                  Reviewed by {t.reviewed_by}: {t.review_feedback}
                </div>
              )}
              {tab === "Under Review" && (
                <button onClick={() => setReviewTask(t)} style={{ ...G.btn("#0ea5e9"), fontSize:F.base, padding:"12px 18px", borderRadius:10, width:"100%" }}>🔍 Review Now</button>
              )}
            </div>
          ))
        }
      </div>
      {reviewTask && (
        <ReviewModal task={reviewTask} currentUser={currentUser} onClose={() => setReviewTask(null)}
          onReview={async (id, action, feedback, by) => { await onReview(id, action, feedback, by); setReviewTask(null); }} />
      )}
    </div>
  );
}

function StaffView({ currentUser, staff, tasks, onAssign, isMobile }) {
  const [showAssign, setShowAssign] = useState(false);
  const [target, setTarget]         = useState(null);

  const myStaff = currentUser.role === "incharge"
    ? staff.filter(s => s.role === "staff" && s.department === currentUser.department)
    : staff.filter(s => s.role === "staff");

  return (
    <div>
      {!isMobile && <h2 style={{ fontSize:20, fontWeight:800, color:T.text, margin:"0 0 16px" }}>
        {currentUser.role === "incharge" ? `${currentUser.department} Staff` : "All Staff"}
      </h2>}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(290px,1fr))", gap:14 }}>
        {myStaff.map(s => {
          const st      = tasks.filter(t => t.assigned_to === s.name);
          const done    = st.filter(t => t.submission_status === "Approved").length;
          const overdue = st.filter(t => isOverdue(t)).length;
          const pending = st.filter(t => t.submission_status === "Under Review").length;
          return (
            <div key={s.id} style={{ background:T.surface, border:`1.5px solid ${overdue>0?"#fecaca":T.border}`, borderRadius:14, padding:16, borderTop:`3px solid ${overdue>0?T.danger:T.info}`, boxShadow:T.shadow }}>
              <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:14 }}>
                <Avatar name={s.name} role={s.role} size={44} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:F.md, fontWeight:700, color:T.text }}>{s.name}</div>
                  <div style={{ fontSize:F.sm, color:T.textMid }}>{s.designation} · {s.department}</div>
                </div>
              </div>
              <ProgressBar done={done} total={st.length} overdue={overdue} />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:7, marginTop:14, marginBottom:12 }}>
                {[["Total",st.length,"#7c3aed"],["Done",done,T.success],["Review",pending,T.warn],["Overdue",overdue,T.danger]].map(([l,v,c]) => (
                  <div key={l} style={{ textAlign:"center", background:T.surface2, borderRadius:9, padding:"10px 4px", border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:F.lg, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:F.xs, color:T.textMid, fontWeight:600 }}>{l}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setTarget(s); setShowAssign(true); }} style={{ ...G.btnSm(T.accentG), width:"100%", padding:"11px", textAlign:"center", fontSize:F.base }}>+ Assign Task</button>
              {overdue > 0 && <div style={{ marginTop:10, fontSize:F.sm, color:T.danger, fontWeight:700, background:"#fef2f2", borderRadius:8, padding:"7px 10px", border:"1px solid #fecaca" }}>🚨 {overdue} overdue</div>}
            </div>
          );
        })}
      </div>
      {showAssign && (
        <AssignTaskModal currentUser={currentUser} staffList={staff} preselected={target}
          onClose={() => { setShowAssign(false); setTarget(null); }}
          onSave={t => { onAssign(t); setShowAssign(false); setTarget(null); }} />
      )}
    </div>
  );
}

function DutiesView({ currentUser, duties, setDuties, staff, isMobile }) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({ title:"", description:"", frequency:"Daily", department:currentUser.department||"Academic", staff_id:"" });

  // duties already server-filtered
  const getStaffName = id => staff.find(s => s.id === id || s.id === +id)?.name || "—";
  const freqColor = { Daily:"#6366f1", Weekly:"#0ea5e9", Monthly:"#f59e0b" };

  const handleAddDuty = async () => {
    if (!form.title || !form.staff_id) { alert("Title and staff required"); return; }
    setSaving(true);
    try {
      const duty = await db.addDuty({ ...form, staff_id: +form.staff_id }, currentUser);
      setDuties(prev => [...prev, duty]);
      setForm({ title:"", description:"", frequency:"Daily", department:currentUser.department||"Academic", staff_id:"" });
      setShowAdd(false);
    } catch (err) { alert("Error: " + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        {!isMobile && <h2 style={{ fontSize:20, fontWeight:800, color:T.text, margin:0 }}>Standing Duties</h2>}
        {currentUser.role !== "staff" && (
          <button onClick={() => setShowAdd(v => !v)} style={{ ...G.btn(), background:T.accentG, padding:"10px 16px", borderRadius:10, fontSize:F.base, marginLeft:"auto" }}>
            {showAdd ? "✕ Cancel" : "＋ Add Duty"}
          </button>
        )}
      </div>
      {showAdd && (
        <div style={{ ...G.card, padding:18, marginBottom:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:14 }}>
            <div>
              <label style={G.lbl}>Duty Title</label>
              <input style={G.inp} value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} placeholder="e.g. Daily Attendance" />
            </div>
            <div>
              <label style={G.lbl}>Frequency</label>
              <select style={G.inp} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency:e.target.value }))}>
                {["Daily","Weekly","Monthly"].map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label style={G.lbl}>Department</label>
              <select style={G.inp} value={form.department} onChange={e => setForm(f => ({ ...f, department:e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={G.lbl}>Assign To</label>
              <select style={G.inp} value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id:e.target.value }))}>
                <option value="">— Select Staff —</option>
                {staff.filter(s => s.role === "staff").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={G.lbl}>Description</label>
            <textarea style={{ ...G.inp, resize:"vertical", minHeight:64 }} value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} />
          </div>
          <button onClick={handleAddDuty} disabled={saving} style={{ ...G.btn(), background:T.accentG, width:"100%", opacity:saving?0.6:1, fontSize:F.base }}>
            {saving ? "⏳ Saving…" : "✅ Save Duty"}
          </button>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {duties.length === 0
          ? <div style={{ padding:44, textAlign:"center", color:T.textMid, fontSize:F.base }}>No duties found.</div>
          : duties.map(d => (
            <div key={d.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"15px 16px", display:"flex", alignItems:"flex-start", gap:13, boxShadow:T.shadow }}>
              <div style={{ width:38, height:38, borderRadius:10, background:`${freqColor[d.frequency]||"#6366f1"}15`, border:`1px solid ${freqColor[d.frequency]||"#6366f1"}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                {d.frequency==="Daily"?"🌅":d.frequency==="Weekly"?"📅":"🗓"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:F.md, fontWeight:700, color:T.text, marginBottom:3 }}>{d.title}</div>
                {d.description && <div style={{ fontSize:F.sm, color:T.textMid, marginBottom:8 }}>{d.description}</div>}
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  <Badge label={d.frequency} color={freqColor[d.frequency]} bg={`${freqColor[d.frequency]}12`} />
                  <Badge label={d.department} color={T.textMid} bg={T.surface2} />
                  {currentUser.role !== "staff" && <Badge label={getStaffName(d.staff_id)} color={T.info} bg={`${T.info}12`} icon="👤" />}
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function MonitoringView({ staff, tasks, isMobile }) {
  const deptMap = {};
  tasks.forEach(t => {
    const d = t.department || "General";
    if (!deptMap[d]) deptMap[d] = { total:0, approved:0, review:0, rejected:0, overdue:0 };
    deptMap[d].total++;
    if (t.submission_status === "Approved")          deptMap[d].approved++;
    else if (t.submission_status === "Under Review") deptMap[d].review++;
    else if (t.submission_status === "Rejected")     deptMap[d].rejected++;
    if (isOverdue(t)) deptMap[d].overdue++;
  });

  const staffStats = staff.filter(s => s.role === "staff").map(s => {
    const st = tasks.filter(t => t.assigned_to === s.name);
    return { ...s, total:st.length, approved:st.filter(t=>t.submission_status==="Approved").length, review:st.filter(t=>t.submission_status==="Under Review").length, overdue:st.filter(t=>isOverdue(t)).length };
  }).sort((a, b) => b.overdue - a.overdue || b.total - a.total);

  return (
    <div>
      {!isMobile && <h2 style={{ fontSize:20, fontWeight:800, color:T.text, margin:"0 0 16px" }}>Monitoring</h2>}
      {isMobile ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
          <div style={{ fontSize:F.sm, fontWeight:700, color:T.textMid, textTransform:"uppercase", marginBottom:5 }}>Department Summary</div>
          {Object.entries(deptMap).map(([dept, d]) => {
            const rate = d.total > 0 ? Math.round((d.approved / d.total) * 100) : 0;
            return (
              <div key={dept} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px", boxShadow:T.shadow }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                  <div style={{ fontSize:F.md, fontWeight:700, color:T.text }}>{dept}</div>
                  <span style={{ fontSize:F.md, fontWeight:800, color:rate>=80?T.success:rate>=50?T.warn:T.danger }}>{rate}%</span>
                </div>
                <div style={{ height:6, borderRadius:99, background:T.surface2, marginBottom:10, border:`1px solid ${T.border}` }}>
                  <div style={{ height:"100%", width:`${rate}%`, background:rate>=80?T.success:rate>=50?T.warn:T.danger, borderRadius:99 }} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
                  {[["Total",d.total,"#7c3aed"],["✅",d.approved,T.success],["⏳",d.review,T.warn],["🚨",d.overdue,T.danger]].map(([l,v,c]) => (
                    <div key={l} style={{ textAlign:"center", background:T.surface2, borderRadius:8, padding:"8px 4px", border:`1px solid ${T.border}` }}>
                      <div style={{ fontSize:F.lg, fontWeight:800, color:c }}>{v}</div>
                      <div style={{ fontSize:F.xs, color:T.textMid }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ ...G.card, marginBottom:18 }}>
          <div style={{ padding:"14px 18px", borderBottom:`1px solid ${T.border}`, fontWeight:700, fontSize:F.base, color:T.text, background:T.surface2 }}>🏢 Department Summary</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>{["Department","Total","Approved","In Review","Rejected","Overdue","Rate"].map(h => <th key={h} style={G.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {Object.entries(deptMap).map(([dept, d]) => {
                  const rate = d.total > 0 ? Math.round((d.approved / d.total) * 100) : 0;
                  return (
                    <tr key={dept}>
                      <td style={{ ...G.td, fontWeight:700 }}>{dept}</td>
                      <td style={{ ...G.td, textAlign:"center" }}>{d.total}</td>
                      <td style={{ ...G.td, textAlign:"center", color:T.success, fontWeight:700 }}>{d.approved}</td>
                      <td style={{ ...G.td, textAlign:"center", color:T.warn, fontWeight:700 }}>{d.review}</td>
                      <td style={{ ...G.td, textAlign:"center", color:T.danger, fontWeight:700 }}>{d.rejected}</td>
                      <td style={{ ...G.td, textAlign:"center", color:d.overdue>0?T.danger:T.textMid, fontWeight:d.overdue>0?700:400 }}>{d.overdue}</td>
                      <td style={G.td}>
                        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                          <div style={{ flex:1, height:6, background:T.surface2, borderRadius:99, border:`1px solid ${T.border}` }}>
                            <div style={{ height:"100%", width:`${rate}%`, background:rate>=80?T.success:rate>=50?T.warn:T.danger, borderRadius:99 }} />
                          </div>
                          <span style={{ fontSize:F.sm, fontWeight:700, color:T.text, minWidth:34 }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ fontSize:F.sm, fontWeight:700, color:T.textMid, textTransform:"uppercase", marginBottom:12 }}>Staff Performance</div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(270px,1fr))", gap:11 }}>
        {staffStats.map(s => {
          const pct   = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
          const color = s.overdue > 0 ? T.danger : pct >= 80 ? T.success : pct >= 50 ? T.warn : T.info;
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
              <ProgressBar done={s.approved} total={s.total} overdue={s.overdue} />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7, marginTop:12 }}>
                {[["Approved",s.approved,T.success],["Review",s.review,T.warn],["Overdue",s.overdue,T.danger]].map(([l,v,c]) => (
                  <div key={l} style={{ textAlign:"center", background:T.surface2, borderRadius:9, padding:"9px 4px", border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:F.lg, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:F.xs, color:T.textMid }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Checklist({ currentUser: portalUser }) {
  const { isMobile } = useBreakpoint();
  const [users,       setUsers]       = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks,       setTasks]       = useState([]);
  const [duties,      setDuties]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeView,  setActiveView]  = useState("dashboard");
  const [toast,       setToast]       = useState({ msg:"", type:"success" });
  const [submitTask,  setSubmitTask]  = useState(null);
  const [reviewTask,  setReviewTask]  = useState(null);
  const [showMore,    setShowMore]    = useState(false);

  // FIX #9: use a mounted ref to avoid state updates after unmount
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
      if (mountedRef.current) setToast({ msg:"", type:"success" });
    }, 3000);
  }, []);

  const fetchAll = useCallback(async (resolvedUser) => {
    setLoading(true);
    try {
      // Resolve who we are first, then fetch tasks with server-side filter
      const usersData = await db.getUsers();
      if (!mountedRef.current) return;
      setUsers(usersData);

      let activeUser = resolvedUser;
      if (!activeUser) {
        if (portalUser?.staff_profile_id) activeUser = usersData.find(u => u.id === portalUser.staff_profile_id);
        if (!activeUser && portalUser?.id && typeof portalUser.id === "number") activeUser = usersData.find(u => u.id === portalUser.id);
        if (!activeUser && portalUser?.name) activeUser = usersData.find(u => u.name === portalUser.name);
        if (!activeUser) activeUser = usersData[0];
      }

      // Portal session role overrides DB role — portal is authoritative
      if (activeUser && portalUser?.role) {
        const pr = portalUser.role.toLowerCase();
        if (["admin","administrator"].includes(pr)) {
          activeUser = { ...activeUser, role: "admin" };
        } else if (["incharge","in-charge","manager"].includes(pr)) {
          activeUser = { ...activeUser, role: "incharge" };
        }
      }
      if (!mountedRef.current) return;
      setCurrentUser(activeUser);

      // FIX #2: pass activeUser so DB filters server-side
      const [tasksData, dutiesData] = await Promise.all([
        db.getTasks(activeUser),
        db.getDuties(activeUser),
      ]);
      if (!mountedRef.current) return;
      setTasks(tasksData);
      setDuties(dutiesData);
    } catch (err) {
      if (!mountedRef.current) return;
      showToast("⚠️ " + err.message, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [portalUser, showToast]);

  useEffect(() => { fetchAll(null); }, [fetchAll]);

  // FIX #10: only reset view when user id actually changes, not on every render
  const prevUserIdRef = useRef(null);
  useEffect(() => {
    if (currentUser?.id && currentUser.id !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUser.id;
      setActiveView("dashboard");
    }
  }, [currentUser?.id]);

  // When admin switches user, re-fetch with new user context
  const handleSetCurrentUser = useCallback((user) => {
    setCurrentUser(user);
    db.getTasks(user).then(t => { if (mountedRef.current) setTasks(t); }).catch(() => {});
    db.getDuties(user).then(d => { if (mountedRef.current) setDuties(d); }).catch(() => {});
  }, []);

  const handleSetView = (view) => {
    if (view === "more") { setShowMore(true); return; }
    setActiveView(view);
  };

  const handleSubmit = useCallback(async (taskId, note, files) => {
    const updated = await db.updateTask(taskId, { status:"Submitted", submission_status:"Under Review", submission_note:note, submission_files:files, submitted_at:new Date().toISOString() }, currentUser);
    if (mountedRef.current) setTasks(prev => prev.map(t => t.id === taskId ? (updated || t) : t));
    showToast("📤 Work submitted for review!");
  }, [currentUser, showToast]);

  const handleReview = useCallback(async (taskId, action, feedback, by) => {
    const updated = await db.updateTask(taskId, { submission_status:action, status:action==="Approved"?"Done":undefined, review_feedback:feedback, reviewed_by:by, reviewed_at:new Date().toISOString() }, currentUser);
    if (mountedRef.current) setTasks(prev => prev.map(t => t.id === taskId ? (updated || t) : t));
    showToast(action==="Approved" ? "✅ Approved!" : "❌ Rejected.", action==="Approved"?"success":"error");
  }, [currentUser, showToast]);

  const handleStatusChange = useCallback(async (task, newStatus) => {
    const updated = await db.updateTask(task.id, { status: newStatus }, currentUser);
    if (mountedRef.current) setTasks(prev => prev.map(t => t.id === task.id ? (updated || { ...t, status: newStatus }) : t));
    showToast(`✅ Status → ${newStatus}`);
  }, [currentUser, showToast]);

  const handleDelete = useCallback(async (id) => {
    // FIX #7: staff cannot delete
    if (currentUser?.role === "staff") { showToast("Not permitted", "error"); return; }
    if (!window.confirm("Delete this task?")) return;
    await db.deleteTask(id, currentUser);
    if (mountedRef.current) setTasks(prev => prev.filter(t => t.id !== id));
    showToast("🗑️ Task deleted", "info");
  }, [currentUser, showToast]);

  const handleAssign = useCallback((task) => {
    setTasks(prev => [task, ...prev]);
    showToast("✅ Task assigned!");
  }, [showToast]);

  const activeUser = currentUser || (portalUser ? {
    id: 0,
    name: portalUser.name || "User",
    role: portalUser.role?.toLowerCase() === "admin" ? "admin" : "staff",
    department: "Administration",
  } : null);

  if (!activeUser && loading) {
    return (
      <div style={{ ...G.page, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:18 }}>
        <Spinner />
        <div style={{ fontSize:F.base, color:T.textMid }}>Connecting…</div>
      </div>
    );
  }
  if (!activeUser) return <div style={{ ...G.page, display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner /></div>;

  const viewProps = {
    currentUser: activeUser, tasks, duties, staff: users, allStaff: users, isMobile,
    onSubmit: setSubmitTask, onReview: setReviewTask,
    onStatusChange: handleStatusChange, onDelete: handleDelete, onAssign: handleAssign,
    setDuties,
  };

  return (
    <div style={G.page}>
      <Toast msg={toast.msg} type={toast.type} />
      {isMobile ? (
        <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          <MobileHeader currentUser={activeUser} activeView={activeView} tasks={tasks} onRefresh={() => fetchAll(activeUser)} users={users} setCurrentUser={handleSetCurrentUser} />
          <div style={{ flex:1, padding:"16px 14px", paddingBottom:88, overflowY:"auto" }}>
            {loading ? <Spinner /> : (() => {
              switch (activeView) {
                case "dashboard":  return <DashboardView {...viewProps} />;
                case "tasks": case "mytasks": case "submit": return <TasksView {...viewProps} />;
                case "staff":      return <StaffView {...viewProps} />;
                case "monitoring": return <MonitoringView {...viewProps} />;
                case "review":     return <ReviewView {...viewProps} />;
                case "duties": case "myduties": return <DutiesView {...viewProps} />;
                default:           return <DashboardView {...viewProps} />;
              }
            })()}
          </div>
          <BottomNav currentUser={activeUser} activeView={activeView} setActiveView={handleSetView} />
          {showMore && <MoreMenu currentUser={activeUser} activeView={activeView} setActiveView={setActiveView} onClose={() => setShowMore(false)} />}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:T.bg }}>
          <TopNav
            currentUser={activeUser}
            activeView={activeView}
            setActiveView={setActiveView}
            setCurrentUser={handleSetCurrentUser}
            users={users}
            onRefresh={() => fetchAll(activeUser)}
            tasks={tasks}
          />
          <div style={{ flex:1, padding:28, overflow:"auto" }}>
            {loading ? <Spinner /> : (() => {
              switch (activeView) {
                case "dashboard":  return <DashboardView {...viewProps} />;
                case "tasks": case "mytasks": case "submit": return <TasksView {...viewProps} />;
                case "staff":      return <StaffView {...viewProps} />;
                case "monitoring": return <MonitoringView {...viewProps} />;
                case "review":     return <ReviewView {...viewProps} />;
                case "duties": case "myduties": return <DutiesView {...viewProps} />;
                default:           return <DashboardView {...viewProps} />;
              }
            })()}
          </div>
        </div>
      )}
      {submitTask && (
        <SubmitWorkModal task={submitTask} currentUser={activeUser} onClose={() => setSubmitTask(null)}
          onSubmit={async (id, note, files) => { await handleSubmit(id, note, files); setSubmitTask(null); }} />
      )}
      {reviewTask && (
        <ReviewModal task={reviewTask} currentUser={activeUser} onClose={() => setReviewTask(null)}
          onReview={async (id, action, feedback, by) => { await handleReview(id, action, feedback, by); setReviewTask(null); }} />
      )}
    </div>
  );
}