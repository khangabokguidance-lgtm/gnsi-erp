import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const db = {
  async getUsers() {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role, dept, designation, phone, email, status")
    .eq("status", "Active")
    .order("name");
  if (error) throw error;
  // Map to expected shape
  return (data || []).map(s => ({
    ...s,
    department: s.dept,
    role: s.role === "admin" ? "admin"
        : s.role === "incharge" ? "incharge"
        : "staff",
  }));
},
  async assignTask(form) {
    const payload = {
      title: form.title, description: form.description || "", priority: form.priority,
      status: "Pending", due_date: form.due_date || null, department: form.department,
      assigned_to: form.assigned_to, assigned_by: form.assigned_by,
      submission_status: "Not Submitted", submission_note: "", submission_files: [],
      submitted_at: null, review_feedback: "", reviewed_by: "", reviewed_at: null,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("staff_tasks").insert([payload]).select().single();
    if (error) throw error;
    return data;
  },
  async updateTask(id, changes) {
    const { data, error } = await supabase.from("staff_tasks").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteTask(id) {
    const { error } = await supabase.from("staff_tasks").delete().eq("id", id);
    if (error) throw error;
  },
  async getDuties() {
    const { data, error } = await supabase.from("staff_duties").select("*").order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  },
  async addDuty(form) {
    const { data, error } = await supabase.from("staff_duties").insert([{ ...form, created_at: new Date().toISOString() }]).select().single();
    if (error) throw error;
    return data;
  },
};

function useBreakpoint() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1024, w };
}

const PRIORITIES  = ["High", "Medium", "Low"];
const DEPARTMENTS = ["Administration","Academic","Accounts","Hostel","Reception","Transport","Maintenance"];
const SUB_STATUS  = ["Not Submitted","Under Review","Approved","Rejected"];
const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };
const SUB_STATUS_META = {
  "Not Submitted": { color: "#94a3b8", bg: "#f1f5f9", icon: "○" },
  "Under Review":  { color: "#f59e0b", bg: "#fffbeb", icon: "⏳" },
  "Approved":      { color: "#22c55e", bg: "#f0fdf4", icon: "✅" },
  "Rejected":      { color: "#ef4444", bg: "#fef2f2", icon: "✕" },
};
const FILE_ICON = { pdf: "📄", xlsx: "📊", docx: "📝", img: "🖼️", default: "📎" };

const fmtDate  = d => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtTime  = d => d ? new Date(d).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—";
const daysDiff = d => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000); };
const isOverdue = t => t.status !== "Done" && t.status !== "Submitted" && t.due_date && daysDiff(t.due_date) < 0;
const initials  = n => n?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const roleColor = { admin: "#6366f1", incharge: "#0ea5e9", staff: "#22c55e" };
const roleLabel = { admin: "Admin", incharge: "In-charge", staff: "Staff" };

const T = {
  bg: "#0d1117", surface: "#161b22", surface2: "#1c2333", border: "#30363d",
  accent: "#58a6ff", accentG: "linear-gradient(135deg,#1e40af,#6366f1)",
  text: "#e6edf3", textMid: "#8b949e", textDim: "#484f58",
  danger: "#f85149", success: "#3fb950", warn: "#d29922", info: "#58a6ff",
};

const G = {
  page:  { background: T.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif", color: T.text, padding: "0" },
  card:  { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" },
  inp:   { width: "100%", padding: "10px 12px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.text, fontSize: "14px", boxSizing: "border-box", fontFamily: "inherit", outline: "none" },
  lbl:   { display: "block", fontSize: "11px", fontWeight: "700", color: T.textMid, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "6px" },
  btn:   (bg = "#1e40af", fg = "white") => ({ background: bg, color: fg, border: "none", borderRadius: "8px", padding: "10px 18px", fontWeight: "700", cursor: "pointer", fontSize: "14px", fontFamily: "inherit" }),
  btnSm: (bg = T.accent) => ({ background: bg, color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: "700", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", whiteSpace: "nowrap" }),
  th:    { padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: T.textMid, textTransform: "uppercase", letterSpacing: ".06em", borderBottom: `1px solid ${T.border}`, background: T.surface2, whiteSpace: "nowrap" },
  td:    { padding: "10px 12px", fontSize: "12px", color: T.text, verticalAlign: "middle", borderBottom: `1px solid ${T.border}` },
};

function Badge({ label, color, bg, icon }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:99, fontSize:11, fontWeight:700, background:bg||"#1c2333", color:color||T.textMid, whiteSpace:"nowrap" }}>
      {icon} {label}
    </span>
  );
}
function SubStatusBadge({ status }) {
  const m = SUB_STATUS_META[status] || SUB_STATUS_META["Not Submitted"];
  return <Badge label={status} color={m.color} bg={m.bg + "22"} icon={m.icon} />;
}
function PriorityDot({ priority }) {
  return <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:PRIORITY_COLOR[priority]||"#94a3b8", marginRight:5, flexShrink:0 }} />;
}
function Avatar({ name, role, size = 36 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`${roleColor[role]||"#6366f1"}22`, border:`2px solid ${roleColor[role]||"#6366f1"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:700, color:roleColor[role]||"#6366f1", flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}
function Toast({ msg, type = "success" }) {
  if (!msg) return null;
  const colors = { success: "#3fb950", error: "#f85149", info: "#58a6ff" };
  return (
    <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:9999, background:T.surface, border:`1px solid ${colors[type]}`, color:colors[type], padding:"12px 20px", borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,.5)", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap", maxWidth:"90vw" }}>
      {type==="success"?"✅":type==="error"?"❌":"ℹ️"} {msg}
    </div>
  );
}
function ProgressBar({ done, total, overdue = 0 }) {
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = overdue > 0 ? T.danger : pct >= 80 ? T.success : pct >= 50 ? T.warn : T.info;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:11, color:T.textMid }}>{done}/{total} done</span>
        <span style={{ fontSize:11, fontWeight:700, color }}>{pct}%</span>
      </div>
      <div style={{ height:4, borderRadius:99, background:T.surface2 }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99 }} />
      </div>
    </div>
  );
}
function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48, gap:12, color:T.textMid }}>
      <div style={{ width:20, height:20, border:`2px solid ${T.border}`, borderTop:`2px solid ${T.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <span style={{ fontSize:13 }}>Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
function FileChip({ file, onRemove }) {
  const icon = FILE_ICON[file.type] || FILE_ICON.default;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 10px" }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{file.name}</div>
        {file.size && <div style={{ fontSize:10, color:T.textMid }}>{file.size}</div>}
      </div>
      {onRemove && <button onClick={onRemove} style={{ background:"none", border:"none", color:T.danger, cursor:"pointer", fontSize:14, padding:0 }}>✕</button>}
      {!onRemove && <a href={file.url || "#"} style={{ fontSize:10, color:T.accent, textDecoration:"none", fontWeight:700 }}>↓</a>}
    </div>
  );
}

function BottomNav({ currentUser, activeView, setActiveView }) {
  const navItems = useMemo(() => {
    if (currentUser.role === "admin") return [
      { id:"dashboard", label:"Home",   icon:"⬛" },
      { id:"tasks",     label:"Tasks",  icon:"📋" },
      { id:"staff",     label:"Staff",  icon:"👥" },
      { id:"review",    label:"Review", icon:"🔍" },
      { id:"more",      label:"More",   icon:"⋯"  },
    ];
    if (currentUser.role === "incharge") return [
      { id:"dashboard", label:"Home",   icon:"⬛" },
      { id:"tasks",     label:"Tasks",  icon:"📋" },
      { id:"staff",     label:"Staff",  icon:"👥" },
      { id:"review",    label:"Review", icon:"🔍" },
      { id:"duties",    label:"Duties", icon:"📌" },
    ];
    return [
      { id:"dashboard", label:"Home",   icon:"⬛" },
      { id:"mytasks",   label:"Tasks",  icon:"📋" },
      { id:"myduties",  label:"Duties", icon:"📌" },
      { id:"submit",    label:"Submit", icon:"📤" },
    ];
  }, [currentUser.role]);

  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:T.surface, borderTop:`1px solid ${T.border}`, display:"flex", zIndex:200, paddingBottom:"env(safe-area-inset-bottom)" }}>
      {navItems.map(n => (
        <button key={n.id} onClick={() => setActiveView(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, padding:"10px 4px 8px", background:"none", border:"none", color:activeView===n.id?T.accent:T.textMid, cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:activeView===n.id?700:500, borderTop:activeView===n.id?`2px solid ${T.accent}`:"2px solid transparent" }}>
          <span style={{ fontSize:18 }}>{n.icon}</span>
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
    <div style={{ position:"fixed", inset:0, zIndex:500 }} onClick={onClose}>
      <div style={{ position:"absolute", bottom:80, left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:"16px 16px 0 0", padding:16 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:12, color:T.textMid, fontWeight:700, textTransform:"uppercase", marginBottom:12, paddingLeft:4 }}>More Options</div>
        {extras.map(n => (
          <button key={n.id} onClick={() => { setActiveView(n.id); onClose(); }} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px", borderRadius:10, background:activeView===n.id?`${T.accent}18`:"none", border:"none", color:activeView===n.id?T.accent:T.text, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", textAlign:"left", marginBottom:4 }}>
            <span style={{ fontSize:20 }}>{n.icon}</span> {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ currentUser, activeView, setActiveView, setCurrentUser, users }) {
  const navItems = useMemo(() => {
    if (currentUser.role === "admin") return [
      { id:"dashboard",  label:"Dashboard",         icon:"⬛" },
      { id:"tasks",      label:"All Tasks",          icon:"📋" },
      { id:"staff",      label:"Staff Overview",     icon:"👥" },
      { id:"duties",     label:"Duties",             icon:"📌" },
      { id:"monitoring", label:"Monitoring",         icon:"📊" },
      { id:"review",     label:"Review Submissions", icon:"🔍" },
    ];
    if (currentUser.role === "incharge") return [
      { id:"dashboard",  label:"Dashboard",          icon:"⬛" },
      { id:"tasks",      label:"Dept Tasks",          icon:"📋" },
      { id:"staff",      label:"My Staff",            icon:"👥" },
      { id:"duties",     label:"Duties",              icon:"📌" },
      { id:"review",     label:"Review Submissions",  icon:"🔍" },
    ];
    return [
      { id:"dashboard",  label:"My Dashboard",       icon:"⬛" },
      { id:"mytasks",    label:"My Tasks",            icon:"📋" },
      { id:"myduties",   label:"My Duties",           icon:"📌" },
      { id:"submit",     label:"Submit Work",         icon:"📤" },
    ];
  }, [currentUser.role]);

  return (
    <div style={{ width:220, background:T.surface, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", flexShrink:0, minHeight:"100vh" }}>
      <div style={{ padding:"20px 18px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.text, letterSpacing:.5 }}>GNSI Checklist</div>
        <div style={{ fontSize:11, color:T.textMid, marginTop:2 }}>Task Management</div>
      </div>
      {users.length > 1 && (
        <div style={{ padding:"12px 12px 0" }}>
          <select style={{ ...G.inp, fontSize:11, padding:"7px 10px" }} value={currentUser.id} onChange={e => setCurrentUser(users.find(u => u.id === e.target.value) || users[0])}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
      )}
      <div style={{ padding:"14px 14px 10px", borderBottom:`1px solid ${T.border}`, marginTop:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <Avatar name={currentUser.name} role={currentUser.role} size={34} />
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{currentUser.name}</div>
            <div style={{ fontSize:10, color:roleColor[currentUser.role], fontWeight:700, textTransform:"uppercase" }}>{roleLabel[currentUser.role]}</div>
          </div>
        </div>
      </div>
      <nav style={{ flex:1, padding:"10px 8px" }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setActiveView(n.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, background:activeView===n.id?`${T.accent}18`:"none", border:activeView===n.id?`1px solid ${T.accent}33`:"1px solid transparent", color:activeView===n.id?T.accent:T.textMid, fontSize:13, fontWeight:activeView===n.id?700:500, cursor:"pointer", fontFamily:"inherit", textAlign:"left", marginBottom:2 }}>
            <span style={{ fontSize:14 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
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
    <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px" }}>
        <div>
          <div style={{ fontSize:11, color:T.textMid, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>GNSI Checklist</div>
          <div style={{ fontSize:16, fontWeight:800, color:T.text }}>{VIEW_LABEL[activeView] || "Dashboard"}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {pendingReview > 0 && (
            <div style={{ background:T.warn, color:"#000", borderRadius:99, fontSize:11, fontWeight:800, padding:"2px 8px" }}>{pendingReview}</div>
          )}
          <button onClick={() => setShowUserPicker(v => !v)} style={{ display:"flex", alignItems:"center", gap:6, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 10px", cursor:"pointer", color:T.text, fontFamily:"inherit", fontSize:12, fontWeight:600 }}>
            <Avatar name={currentUser.name} role={currentUser.role} size={22} />
            <span style={{ fontSize:10, color:roleColor[currentUser.role], fontWeight:700, textTransform:"uppercase" }}>{roleLabel[currentUser.role]}</span>
          </button>
          <button onClick={onRefresh} style={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px", cursor:"pointer", color:T.textMid, fontFamily:"inherit", fontSize:14, lineHeight:1 }}>🔄</button>
        </div>
      </div>
      {showUserPicker && users.length > 1 && (
        <div style={{ padding:"8px 16px 12px", borderTop:`1px solid ${T.border}` }}>
          <label style={G.lbl}>Switch User</label>
          <select style={{ ...G.inp }} value={currentUser.id} onChange={e => { setCurrentUser(users.find(u => u.id === e.target.value) || users[0]); setShowUserPicker(false); }}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function AssignTaskModal({ currentUser, staffList, preselected, onClose, onSave }) {
  const [form, setForm] = useState({
    title: "", description: "", priority: "Medium", due_date: "",
    department: preselected?.department || currentUser.department || "Academic",
    assigned_to: preselected?.name || (staffList[0]?.name || ""),
    assigned_by: currentUser.name,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.assigned_to) { alert("Title and assignee required"); return; }
    setSaving(true);
    try {
      const task = await db.assignTask({ ...form, due_date: form.due_date || null });
      onSave(task); onClose();
    } catch (err) {
      alert("Error saving task: " + err.message);
    } finally { setSaving(false); }
  };

  const filteredStaff = currentUser.role === "incharge"
    ? staffList.filter(s => s.department === currentUser.department && s.role === "staff")
    : staffList.filter(s => s.role !== "admin");

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(6px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...G.card, width:"100%", maxWidth:600, maxHeight:"92vh", display:"flex", flexDirection:"column", borderRadius:"16px 16px 0 0" }}>
        <div style={{ background:T.accentG, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", textTransform:"uppercase", letterSpacing:1 }}>New Assignment</div>
            <div style={{ fontSize:17, fontWeight:800, color:"white" }}>Assign Task</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", border:"none", color:"white", borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:18, fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:"16px 20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={G.lbl}>Task Title *</label>
            <input style={G.inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Submit June Lesson Plan" />
          </div>
          <div>
            <label style={G.lbl}>Instructions / Description</label>
            <textarea style={{ ...G.inp, resize:"vertical", minHeight:72 }} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Detailed instructions…" />
          </div>
          <div>
            <label style={G.lbl}>Assign To *</label>
            <select style={{ ...G.inp, backgroundColor:T.surface2 }} value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)}>
              {filteredStaff.map(s => <option key={s.id} value={s.name}>{s.name} — {s.designation}</option>)}
            </select>
          </div>
          <div>
            <label style={G.lbl}>Department</label>
            <select style={{ ...G.inp, backgroundColor:T.surface2 }} value={form.department} onChange={e => set("department", e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={G.lbl}>Priority</label>
              <select style={{ ...G.inp, backgroundColor:T.surface2 }} value={form.priority} onChange={e => set("priority", e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={G.lbl}>Due Date</label>
              <input type="date" style={G.inp} value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ padding:"12px 20px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, background:T.accentG, color:"white", border:"none", borderRadius:10, padding:14, cursor:saving?"not-allowed":"pointer", fontWeight:800, fontSize:14, fontFamily:"inherit", opacity:saving?0.6:1 }}>
            {saving ? "⏳ Assigning…" : "✅ Assign Task"}
          </button>
          <button onClick={onClose} style={{ padding:"14px 18px", background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, cursor:"pointer", fontWeight:600, color:T.textMid, fontFamily:"inherit" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SubmitWorkModal({ task, onClose, onSubmit }) {
  const [note, setNote]   = useState(task.submission_note || "");
  const [files, setFiles] = useState(task.submission_files || []);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleFileAdd = e => {
    const f = e.target.files[0];
    if (!f) return;
    const ext  = f.name.split(".").pop().toLowerCase();
    const type = ["jpg","jpeg","png","gif","webp"].includes(ext) ? "img" : ext;
    setFiles(prev => [...prev, { name: f.name, size: `${(f.size / 1024).toFixed(0)} KB`, type, url: "#" }]);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try { await onSubmit(task.id, note, files); onClose(); }
    catch (err) { alert("Submit failed: " + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(6px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...G.card, width:"100%", maxWidth:600, maxHeight:"92vh", display:"flex", flexDirection:"column", borderRadius:"16px 16px 0 0" }}>
        <div style={{ background:"linear-gradient(135deg,#065f46,#059669)", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", textTransform:"uppercase", letterSpacing:1 }}>Work Submission</div>
            <div style={{ fontSize:15, fontWeight:700, color:"white" }}>{task.title}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", border:"none", color:"white", borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:18, fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:"16px 20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:T.surface2, borderRadius:10, padding:"12px 14px", fontSize:13, color:T.textMid, lineHeight:1.6 }}>
            <div style={{ fontWeight:700, color:T.text, marginBottom:4 }}>📋 Instructions</div>
            {task.description || "No specific instructions provided."}
          </div>
          {task.submission_status === "Rejected" && (
            <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontWeight:700, color:T.danger, fontSize:13, marginBottom:4 }}>❌ Previously Rejected</div>
              <div style={{ fontSize:12, color:"#fca5a5" }}>{task.review_feedback}</div>
            </div>
          )}
          <div>
            <label style={G.lbl}>Completion Note *</label>
            <textarea style={{ ...G.inp, resize:"vertical", minHeight:80 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Describe what you did…" />
          </div>
          <div>
            <label style={G.lbl}>Attach Work Files</label>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {files.map((f, i) => <FileChip key={i} file={f} onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))} />)}
              <input ref={fileRef} type="file" style={{ display:"none" }} onChange={handleFileAdd} accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" />
              <button onClick={() => fileRef.current?.click()} style={{ ...G.btn(T.surface2, T.textMid), border:`1px dashed ${T.border}`, borderRadius:8, padding:"12px 14px", textAlign:"left", fontSize:13, width:"100%" }}>
                📎 Attach file (PDF, DOCX, XLSX, Image)
              </button>
            </div>
          </div>
        </div>
        <div style={{ padding:"12px 20px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10 }}>
          <button onClick={handleSubmit} disabled={saving || !note.trim()} style={{ flex:1, background:"linear-gradient(135deg,#065f46,#059669)", color:"white", border:"none", borderRadius:10, padding:14, cursor:saving||!note.trim()?"not-allowed":"pointer", fontWeight:800, fontSize:14, fontFamily:"inherit", opacity:saving||!note.trim()?0.6:1 }}>
            {saving ? "⏳ Submitting…" : "📤 Submit Work"}
          </button>
          <button onClick={onClose} style={{ padding:"14px 16px", background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, cursor:"pointer", fontWeight:600, color:T.textMid, fontFamily:"inherit" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ task, currentUser, onClose, onReview }) {
  const [feedback, setFeedback] = useState(task.review_feedback || "");
  const [saving, setSaving]     = useState(false);

  const handleReview = async (action) => {
    setSaving(true);
    try { await onReview(task.id, action, feedback, currentUser.name); onClose(); }
    catch (err) { alert("Review failed: " + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(6px)", zIndex:2001, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...G.card, width:"100%", maxWidth:600, maxHeight:"92vh", display:"flex", flexDirection:"column", borderRadius:"16px 16px 0 0" }}>
        <div style={{ background:"linear-gradient(135deg,#1e3a5f,#0ea5e9)", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", textTransform:"uppercase", letterSpacing:1 }}>Submission Review</div>
            <div style={{ fontSize:15, fontWeight:700, color:"white" }}>{task.title}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginTop:2 }}>by {task.assigned_to}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", border:"none", color:"white", borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:18, fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:"16px 20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:T.surface2, borderRadius:10, padding:"12px 14px" }}>
            <div style={{ fontSize:11, color:T.textMid, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Staff Completion Note</div>
            <div style={{ fontSize:13, color:T.text, lineHeight:1.6 }}>{task.submission_note || "No note provided."}</div>
          </div>
          {task.submission_files?.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:T.textMid, fontWeight:700, textTransform:"uppercase", letterSpacing:.06, marginBottom:8 }}>Files ({task.submission_files.length})</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {task.submission_files.map((f, i) => <FileChip key={i} file={f} />)}
              </div>
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[["Submitted", fmtTime(task.submitted_at)], ["Due Date", fmtDate(task.due_date)]].map(([l, v]) => (
              <div key={l} style={{ background:T.surface2, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:10, color:T.textMid, fontWeight:700, textTransform:"uppercase", marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div>
            <label style={G.lbl}>Review Feedback</label>
            <textarea style={{ ...G.inp, resize:"vertical", minHeight:72 }} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback or rejection reason…" />
          </div>
        </div>
        <div style={{ padding:"12px 20px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:8 }}>
          <button onClick={() => handleReview("Approved")} disabled={saving} style={{ flex:1, background:"linear-gradient(135deg,#065f46,#059669)", color:"white", border:"none", borderRadius:10, padding:14, cursor:"pointer", fontWeight:800, fontSize:13, fontFamily:"inherit" }}>✅ Approve</button>
          <button onClick={() => { if (!feedback.trim()) { alert("Please provide rejection feedback."); return; } handleReview("Rejected"); }} disabled={saving} style={{ flex:1, background:"linear-gradient(135deg,#7f1d1d,#ef4444)", color:"white", border:"none", borderRadius:10, padding:14, cursor:"pointer", fontWeight:800, fontSize:13, fontFamily:"inherit" }}>❌ Reject</button>
          <button onClick={onClose} style={{ padding:"14px 14px", background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, cursor:"pointer", fontWeight:600, color:T.textMid, fontFamily:"inherit" }}>✕</button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, currentUser, onSubmit, onReview, onStatusChange, onDelete }) {
  const overdue   = isOverdue(task);
  const diff      = daysDiff(task.due_date);
  const canSubmit = currentUser.role === "staff" && task.assigned_to === currentUser.name && task.status !== "Done" && (task.submission_status === "Not Submitted" || task.submission_status === "Rejected");
  const canReview = (currentUser.role === "admin" || (currentUser.role === "incharge" && task.department === currentUser.department)) && task.submission_status === "Under Review";

  return (
    <div style={{ background:T.surface, border:`1px solid ${overdue?T.danger:T.border}`, borderRadius:12, padding:"14px", display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:4 }}>
            <PriorityDot priority={task.priority} />
            <span style={{ fontSize:14, fontWeight:700, color:T.text, lineHeight:1.3 }}>{task.title}</span>
          </div>
          <div style={{ fontSize:11, color:T.textMid, display:"flex", gap:8, flexWrap:"wrap", marginTop:2 }}>
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
        <div style={{ fontSize:12, color:T.textMid, lineHeight:1.5, background:T.surface2, borderRadius:8, padding:"8px 10px" }}>
          {task.description.length > 100 ? task.description.slice(0, 100) + "…" : task.description}
        </div>
      )}

      {task.submission_status === "Rejected" && task.review_feedback && (
        <div style={{ fontSize:12, background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"8px 10px", color:"#fca5a5" }}>
          <span style={{ fontWeight:700 }}>Rejected: </span>{task.review_feedback}
        </div>
      )}
      {task.submission_status === "Approved" && (
        <div style={{ fontSize:12, background:"#052e16", border:"1px solid #14532d", borderRadius:8, padding:"8px 10px", color:"#86efac" }}>
          ✅ Approved by {task.reviewed_by} · {fmtTime(task.reviewed_at)}
        </div>
      )}

      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {canSubmit && <button onClick={() => onSubmit(task)} style={{ ...G.btnSm("#059669"), padding:"7px 14px", fontSize:13 }}>📤 Submit</button>}
        {canReview && <button onClick={() => onReview(task)} style={{ ...G.btnSm("#0ea5e9"), padding:"7px 14px", fontSize:13 }}>🔍 Review</button>}
        {(currentUser.role === "admin" || (currentUser.role === "incharge" && task.department === currentUser.department)) && task.status !== "Done" && task.submission_status !== "Under Review" && (
          <>
            <button onClick={() => onStatusChange(task, task.status === "Pending" ? "In Progress" : "Done")} style={G.btnSm(task.status === "Pending" ? "#0ea5e9" : "#22c55e")}>
              {task.status === "Pending" ? "▶ Start" : "✅ Done"}
            </button>
            <button onClick={() => onDelete(task.id)} style={G.btnSm("#ef4444")}>🗑</button>
          </>
        )}
        {currentUser.role === "staff" && task.assigned_to === currentUser.name && task.submission_status === "Approved" && (
          <span style={{ fontSize:11, color:T.success, fontWeight:700 }}>Approved ✅</span>
        )}
      </div>
    </div>
  );
}

function DashboardView({ currentUser, tasks, staff, duties, isMobile }) {
  const myTasks = tasks.filter(t =>
    currentUser.role === "staff" ? t.assigned_to === currentUser.name
    : currentUser.role === "incharge" ? t.department === currentUser.department
    : true
  );
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
      { label:"Staff",          value:currentUser.role==="admin"?staff.filter(s=>s.role==="staff").length:staff.filter(s=>s.role==="staff"&&s.department===currentUser.department).length, color:"#a78bfa", icon:"👥" },
      { label:"Duties",         value:duties.length,       color:"#fb923c", icon:"📌" },
    ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {!isMobile && (
        <div>
          <h2 style={{ fontSize:20, fontWeight:800, color:T.text, margin:"0 0 4px" }}>
            {currentUser.role==="staff" ? "My Dashboard" : currentUser.role==="incharge" ? `${currentUser.department} Dashboard` : "Admin Dashboard"}
          </h2>
          <p style={{ fontSize:13, color:T.textMid, margin:0 }}>Welcome back, {currentUser.name}</p>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
        {STAT_CARDS.map(c => (
          <div key={c.label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:isMobile?"12px 8px":"16px", borderTop:`3px solid ${c.color}`, textAlign:isMobile?"center":"left" }}>
            <div style={{ fontSize:isMobile?16:20, marginBottom:4 }}>{c.icon}</div>
            <div style={{ fontSize:isMobile?22:26, fontWeight:800, color:c.color, lineHeight:1 }}>{c.value}</div>
            <div style={{ fontSize:10, color:T.textMid, marginTop:4, fontWeight:600, lineHeight:1.3 }}>{c.label}</div>
          </div>
        ))}
      </div>
      {pendingReview.length > 0 && (currentUser.role==="admin"||currentUser.role==="incharge") && (
        <div style={{ background:"#451a03", border:`1px solid ${T.warn}`, borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontWeight:700, color:T.warn, fontSize:14, marginBottom:8 }}>⏳ {pendingReview.length} Submission{pendingReview.length>1?"s":""} Awaiting Review</div>
          {pendingReview.slice(0, 3).map(t => (
            <div key={t.id} style={{ fontSize:12, color:"#fde68a", display:"flex", gap:8, marginBottom:4 }}>
              <span>•</span><span><b>{t.assigned_to}</b> submitted "{t.title}"</span>
            </div>
          ))}
          {pendingReview.length > 3 && <div style={{ fontSize:12, color:T.warn }}>…and {pendingReview.length-3} more</div>}
        </div>
      )}
      {currentUser.role==="staff" && stats.overdue > 0 && (
        <div style={{ background:"#450a0a", border:`1px solid ${T.danger}`, borderRadius:12, padding:"12px 16px" }}>
          <div style={{ fontWeight:700, color:T.danger, fontSize:14 }}>🚨 {stats.overdue} overdue task{stats.overdue>1?"s":""}. Submit immediately.</div>
        </div>
      )}
      {currentUser.role==="staff" && stats.rejected > 0 && (
        <div style={{ background:"#1c0a00", border:`1px solid #f97316`, borderRadius:12, padding:"12px 16px" }}>
          <div style={{ fontWeight:700, color:"#fb923c", fontSize:14 }}>❌ {stats.rejected} rejected. Check feedback and resubmit.</div>
        </div>
      )}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:T.textMid, textTransform:"uppercase", letterSpacing:.06, marginBottom:10 }}>Recent Tasks</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {myTasks.slice(0, 5).map(t => (
            <div key={t.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"11px 14px", display:"flex", alignItems:"center", gap:10 }}>
              <PriorityDot priority={t.priority} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
                <div style={{ fontSize:11, color:T.textMid }}>{t.assigned_to} · {t.department}</div>
              </div>
              <SubStatusBadge status={t.submission_status} />
            </div>
          ))}
          {myTasks.length === 0 && <div style={{ fontSize:13, color:T.textMid, padding:"16px 0" }}>No tasks yet.</div>}
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

  const visible = useMemo(() => {
    let list = tasks;
    if (currentUser.role === "staff") list = list.filter(t => t.assigned_to === currentUser.name);
    else if (currentUser.role === "incharge") list = list.filter(t => t.department === currentUser.department);
    if (filterStatus !== "All") list = list.filter(t => t.status === filterStatus);
    if (filterSub !== "All")    list = list.filter(t => t.submission_status === filterSub);
    if (filterDept !== "All")   list = list.filter(t => t.department === filterDept);
    if (search) list = list.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.assigned_to.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [tasks, currentUser, filterStatus, filterSub, filterDept, search]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10 }}>
        {!isMobile && <h2 style={{ fontSize:18, fontWeight:800, color:T.text, margin:0 }}>
          {currentUser.role==="staff" ? "My Tasks" : currentUser.role==="incharge" ? `${currentUser.department} Tasks` : "All Tasks"}
        </h2>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={() => setShowFilters(v => !v)} style={{ ...G.btnSm(showFilters?T.accent:T.surface2), border:`1px solid ${T.border}`, color:showFilters?T.surface:T.textMid }}>
            ⚙ Filters {filterStatus!=="All"||filterSub!=="All"||filterDept!=="All"?"•":""}
          </button>
          {currentUser.role !== "staff" && (
            <button onClick={() => setShowAssign(true)} style={{ ...G.btn(), background:T.accentG, padding:"8px 14px", borderRadius:9, fontSize:13 }}>＋ Assign</button>
          )}
        </div>
      </div>
      <input style={{ ...G.inp, marginBottom:10 }} placeholder="🔍 Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
      {showFilters && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
          <select style={{ ...G.inp, backgroundColor:T.surface2 }} value={filterStatus} onChange={e => setFStatus(e.target.value)}>
            {["All","Pending","In Progress","Done"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={{ ...G.inp, backgroundColor:T.surface2 }} value={filterSub} onChange={e => setFSub(e.target.value)}>
            {["All",...SUB_STATUS].map(s => <option key={s}>{s}</option>)}
          </select>
          {currentUser.role === "admin" && (
            <select style={{ ...G.inp, backgroundColor:T.surface2, gridColumn:isMobile?"1/-1":"auto" }} value={filterDept} onChange={e => setFDept(e.target.value)}>
              {["All",...DEPARTMENTS].map(d => <option key={d}>{d}</option>)}
            </select>
          )}
        </div>
      )}
      <div style={{ fontSize:12, color:T.textMid, marginBottom:8 }}>{visible.length} task{visible.length!==1?"s":""}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {visible.length === 0
          ? <div style={{ padding:40, textAlign:"center", color:T.textMid, fontSize:14 }}>No tasks match filters.</div>
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
      {!isMobile && <h2 style={{ fontSize:18, fontWeight:800, color:T.text, margin:"0 0 14px" }}>Review Submissions</h2>}
      <div style={{ display:"flex", gap:0, marginBottom:14, background:T.surface2, borderRadius:10, padding:4, overflow:"hidden" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"8px 6px", borderRadius:8, border:"none", background:tab===t?T.surface:"none", color:tab===t?T.text:T.textMid, fontWeight:tab===t?700:500, cursor:"pointer", fontSize:isMobile?11:12, fontFamily:"inherit", textAlign:"center" }}>
            {SUB_STATUS_META[t]?.icon} {isMobile ? t.split(" ")[0] : t}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.length === 0
          ? <div style={{ padding:40, textAlign:"center", color:T.textMid }}>No submissions here.</div>
          : filtered.map(t => (
            <div key={t.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
                <Avatar name={t.assigned_to} role="staff" size={34} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
                  <div style={{ fontSize:11, color:T.textMid }}>{t.assigned_to} · {t.department}</div>
                  <div style={{ fontSize:10, color:T.textDim }}>{fmtTime(t.submitted_at)}</div>
                </div>
                <SubStatusBadge status={t.submission_status} />
              </div>
              {t.submission_note && (
                <div style={{ fontSize:12, color:T.textMid, background:T.surface2, borderRadius:8, padding:"8px 10px", marginBottom:8 }}>"{t.submission_note}"</div>
              )}
              {t.review_feedback && (
                <div style={{ fontSize:12, background:t.submission_status==="Rejected"?"#450a0a":"#052e16", border:`1px solid ${t.submission_status==="Rejected"?"#7f1d1d":"#14532d"}`, borderRadius:8, padding:"8px 10px", color:t.submission_status==="Rejected"?"#fca5a5":"#86efac", marginBottom:8 }}>
                  Reviewed by {t.reviewed_by}: {t.review_feedback}
                </div>
              )}
              {tab === "Under Review" && (
                <button onClick={() => setReviewTask(t)} style={{ ...G.btn("#0ea5e9"), fontSize:13, padding:"8px 16px", borderRadius:8, width:"100%" }}>🔍 Review Now</button>
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
      {!isMobile && <h2 style={{ fontSize:18, fontWeight:800, color:T.text, margin:"0 0 14px" }}>
        {currentUser.role === "incharge" ? `${currentUser.department} Staff` : "All Staff"}
      </h2>}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
        {myStaff.map(s => {
          const st      = tasks.filter(t => t.assigned_to === s.name);
          const done    = st.filter(t => t.submission_status === "Approved").length;
          const overdue = st.filter(t => isOverdue(t)).length;
          const pending = st.filter(t => t.submission_status === "Under Review").length;
          return (
            <div key={s.id} style={{ background:T.surface, border:`1px solid ${overdue>0?T.danger:T.border}`, borderRadius:12, padding:14, borderTop:`3px solid ${overdue>0?T.danger:T.info}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <Avatar name={s.name} role={s.role} size={40} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{s.name}</div>
                  <div style={{ fontSize:11, color:T.textMid }}>{s.designation} · {s.department}</div>
                </div>
              </div>
              <ProgressBar done={done} total={st.length} overdue={overdue} />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginTop:12, marginBottom:10 }}>
                {[["Total",st.length,"#6366f1"],["Done",done,T.success],["Review",pending,T.warn],["Overdue",overdue,T.danger]].map(([l,v,c]) => (
                  <div key={l} style={{ textAlign:"center", background:T.surface2, borderRadius:8, padding:"8px 4px" }}>
                    <div style={{ fontSize:16, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:10, color:T.textMid, fontWeight:600 }}>{l}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setTarget(s); setShowAssign(true); }} style={{ ...G.btnSm(T.accentG), width:"100%", padding:"8px", textAlign:"center", fontSize:13 }}>+ Assign Task</button>
              {overdue > 0 && <div style={{ marginTop:8, fontSize:11, color:T.danger, fontWeight:700, background:"#450a0a", borderRadius:6, padding:"5px 8px" }}>🚨 {overdue} overdue</div>}
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

  const myDuties = currentUser.role === "staff"
    ? duties.filter(d => d.staff_id === currentUser.id || d.staff_id === String(currentUser.id))
    : currentUser.role === "incharge"
    ? duties.filter(d => d.department === currentUser.department)
    : duties;

  const getStaffName = id => staff.find(s => s.id === id || s.id === +id)?.name || "—";
  const freqColor = { Daily:"#6366f1", Weekly:"#0ea5e9", Monthly:"#f59e0b" };

  const handleAddDuty = async () => {
    if (!form.title || !form.staff_id) { alert("Title and staff required"); return; }
    setSaving(true);
    try {
      const duty = await db.addDuty({ ...form, staff_id: +form.staff_id });
      setDuties(prev => [...prev, duty]);
      setForm({ title:"", description:"", frequency:"Daily", department:currentUser.department||"Academic", staff_id:"" });
      setShowAdd(false);
    } catch (err) { alert("Error: " + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        {!isMobile && <h2 style={{ fontSize:18, fontWeight:800, color:T.text, margin:0 }}>Standing Duties</h2>}
        {currentUser.role !== "staff" && (
          <button onClick={() => setShowAdd(v => !v)} style={{ ...G.btn(), background:T.accentG, padding:"8px 14px", borderRadius:9, fontSize:13, marginLeft:"auto" }}>
            {showAdd ? "✕ Cancel" : "＋ Add Duty"}
          </button>
        )}
      </div>
      {showAdd && (
        <div style={{ ...G.card, padding:16, marginBottom:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={G.lbl}>Duty Title</label>
              <input style={G.inp} value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} placeholder="e.g. Daily Attendance" />
            </div>
            <div>
              <label style={G.lbl}>Frequency</label>
              <select style={{ ...G.inp, backgroundColor:T.surface2 }} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency:e.target.value }))}>
                {["Daily","Weekly","Monthly"].map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label style={G.lbl}>Department</label>
              <select style={{ ...G.inp, backgroundColor:T.surface2 }} value={form.department} onChange={e => setForm(f => ({ ...f, department:e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={G.lbl}>Assign To</label>
              <select style={{ ...G.inp, backgroundColor:T.surface2 }} value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id:e.target.value }))}>
                <option value="">— Select Staff —</option>
                {staff.filter(s => s.role === "staff").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={G.lbl}>Description</label>
            <textarea style={{ ...G.inp, resize:"vertical", minHeight:56 }} value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} />
          </div>
          <button onClick={handleAddDuty} disabled={saving} style={{ ...G.btn(), background:T.accentG, width:"100%", opacity:saving?0.6:1 }}>
            {saving ? "⏳ Saving…" : "✅ Save Duty"}
          </button>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {myDuties.length === 0
          ? <div style={{ padding:40, textAlign:"center", color:T.textMid }}>No duties found.</div>
          : myDuties.map(d => (
            <div key={d.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"13px 14px", display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ width:34, height:34, borderRadius:8, background:`${freqColor[d.frequency]||"#6366f1"}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                {d.frequency==="Daily"?"🌅":d.frequency==="Weekly"?"📅":"🗓"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:2 }}>{d.title}</div>
                {d.description && <div style={{ fontSize:11, color:T.textMid, marginBottom:6 }}>{d.description}</div>}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <Badge label={d.frequency} color={freqColor[d.frequency]} bg={`${freqColor[d.frequency]}22`} />
                  <Badge label={d.department} color={T.textMid} bg={T.surface2} />
                  {currentUser.role !== "staff" && <Badge label={getStaffName(d.staff_id)} color={T.info} bg={`${T.info}22`} icon="👤" />}
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
      {!isMobile && <h2 style={{ fontSize:18, fontWeight:800, color:T.text, margin:"0 0 14px" }}>Monitoring</h2>}
      {isMobile ? (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.textMid, textTransform:"uppercase", marginBottom:4 }}>Department Summary</div>
          {Object.entries(deptMap).map(([dept, d]) => {
            const rate = d.total > 0 ? Math.round((d.approved / d.total) * 100) : 0;
            return (
              <div key={dept} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{dept}</div>
                  <span style={{ fontSize:13, fontWeight:800, color:rate>=80?T.success:rate>=50?T.warn:T.danger }}>{rate}%</span>
                </div>
                <div style={{ height:4, borderRadius:99, background:T.surface2, marginBottom:8 }}>
                  <div style={{ height:"100%", width:`${rate}%`, background:rate>=80?T.success:rate>=50?T.warn:T.danger, borderRadius:99 }} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4 }}>
                  {[["Total",d.total,"#6366f1"],["✅",d.approved,T.success],["⏳",d.review,T.warn],["🚨",d.overdue,T.danger]].map(([l,v,c]) => (
                    <div key={l} style={{ textAlign:"center", background:T.surface2, borderRadius:6, padding:"6px 4px" }}>
                      <div style={{ fontSize:14, fontWeight:800, color:c }}>{v}</div>
                      <div style={{ fontSize:10, color:T.textMid }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ ...G.card, marginBottom:16 }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontWeight:700, fontSize:13, color:T.text }}>🏢 Department Summary</div>
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
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ flex:1, height:5, background:T.surface2, borderRadius:99 }}>
                            <div style={{ height:"100%", width:`${rate}%`, background:rate>=80?T.success:rate>=50?T.warn:T.danger, borderRadius:99 }} />
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:T.text, minWidth:32 }}>{rate}%</span>
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
      <div style={{ fontSize:12, fontWeight:700, color:T.textMid, textTransform:"uppercase", marginBottom:10 }}>Staff Performance</div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
        {staffStats.map(s => {
          const pct   = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
          const color = s.overdue > 0 ? T.danger : pct >= 80 ? T.success : pct >= 50 ? T.warn : T.info;
          return (
            <div key={s.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:14, borderTop:`3px solid ${color}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <Avatar name={s.name} role={s.role} size={32} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{s.name}</div>
                  <div style={{ fontSize:11, color:T.textMid }}>{s.department}</div>
                </div>
                <span style={{ fontSize:18, fontWeight:800, color }}>{pct}%</span>
              </div>
              <ProgressBar done={s.approved} total={s.total} overdue={s.overdue} />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginTop:10 }}>
                {[["Approved",s.approved,T.success],["Review",s.review,T.warn],["Overdue",s.overdue,T.danger]].map(([l,v,c]) => (
                  <div key={l} style={{ textAlign:"center", background:T.surface2, borderRadius:8, padding:"7px 4px" }}>
                    <div style={{ fontSize:15, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:10, color:T.textMid }}>{l}</div>
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

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg:"", type:"success" }), 3000);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, tasksData, dutiesData] = await Promise.all([
        db.getUsers(), db.getTasks(), db.getDuties()
      ]);
      setUsers(usersData);
      setTasks(tasksData);
      setDuties(dutiesData);
      if (usersData.length > 0) {
        setCurrentUser(prev => prev || usersData.find(u => u.role === "admin") || usersData[0]);
      } else if (portalUser) {
        setCurrentUser({
          id: 1, name: portalUser.name,
          role: portalUser.role?.toLowerCase() === "admin" ? "admin" : "staff",
          department: "Administration",
        });
      }
    } catch (err) {
      showToast("⚠️ " + err.message, "error");
      if (portalUser && !currentUser) {
        setCurrentUser({
          id: 1, name: portalUser.name,
          role: portalUser.role?.toLowerCase() === "admin" ? "admin" : "staff",
          department: "Administration",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [portalUser, showToast]);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (currentUser) setActiveView("dashboard"); }, [currentUser?.id]);

  const handleSetView = (view) => {
    if (view === "more") { setShowMore(true); return; }
    setActiveView(view);
  };

  const handleSubmit = useCallback(async (taskId, note, files) => {
    const updated = await db.updateTask(taskId, { status:"Submitted", submission_status:"Under Review", submission_note:note, submission_files:files, submitted_at:new Date().toISOString() });
    setTasks(prev => prev.map(t => t.id === taskId ? (updated || t) : t));
    showToast("📤 Work submitted for review!");
  }, [showToast]);

  const handleReview = useCallback(async (taskId, action, feedback, by) => {
    const updated = await db.updateTask(taskId, { submission_status:action, status:action==="Approved"?"Done":undefined, review_feedback:feedback, reviewed_by:by, reviewed_at:new Date().toISOString() });
    setTasks(prev => prev.map(t => t.id === taskId ? (updated || t) : t));
    showToast(action==="Approved" ? "✅ Approved!" : "❌ Rejected.", action==="Approved"?"success":"error");
  }, [showToast]);

  const handleStatusChange = useCallback(async (task, newStatus) => {
    const updated = await db.updateTask(task.id, { status: newStatus });
    setTasks(prev => prev.map(t => t.id === task.id ? (updated || { ...t, status: newStatus }) : t));
    showToast(`✅ Status → ${newStatus}`);
  }, [showToast]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this task?")) return;
    await db.deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast("🗑️ Task deleted", "info");
  }, [showToast]);

  const handleAssign = useCallback((task) => {
    setTasks(prev => [task, ...prev]);
    showToast("✅ Task assigned!");
  }, [showToast]);

  const viewProps = {
    currentUser, tasks, duties, staff: users, allStaff: users, isMobile,
    onSubmit: setSubmitTask, onReview: setReviewTask,
    onStatusChange: handleStatusChange, onDelete: handleDelete, onAssign: handleAssign,
  };

  const renderView = () => {
    if (!currentUser) return null;
    switch (activeView) {
      case "dashboard": return <DashboardView {...viewProps} />;
      case "tasks":
      case "mytasks":
      case "submit":    return <TasksView {...viewProps} />;
      case "staff":     return <StaffView {...viewProps} />;
      case "monitoring":return <MonitoringView {...viewProps} />;
      case "review":    return <ReviewView {...viewProps} />;
      case "duties":
      case "myduties":  return <DutiesView {...viewProps} setDuties={setDuties} />;
      default:          return <DashboardView {...viewProps} />;
    }
  };

  // Only show full-page spinner if we have nothing to show yet
  if (loading && !currentUser && !portalUser) {
    return (
      <div style={{ ...G.page, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
        <Spinner />
        <div style={{ fontSize:13, color:T.textMid }}>Connecting to Supabase…</div>
      </div>
    );
  }

  // If still loading but portalUser exists, use it immediately
  const activeUser = currentUser || (portalUser ? {
    id: 1, name: portalUser.name,
    role: portalUser.role?.toLowerCase() === "admin" ? "admin" : "staff",
    department: "Administration",
  } : null);

  if (!activeUser) return <div style={{ ...G.page, display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner /></div>;

  const effectiveViewProps = { ...viewProps, currentUser: activeUser };

  return (
    <div style={G.page}>
      <Toast msg={toast.msg} type={toast.type} />
      {isMobile ? (
        <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          <MobileHeader currentUser={activeUser} activeView={activeView} tasks={tasks} onRefresh={fetchAll} users={users} setCurrentUser={setCurrentUser} />
          <div style={{ flex:1, padding:"16px 14px", paddingBottom:80, overflowY:"auto" }}>
            {loading ? <Spinner /> : (() => {
              if (!activeUser) return null;
              switch (activeView) {
                case "dashboard": return <DashboardView {...effectiveViewProps} />;
                case "tasks": case "mytasks": case "submit": return <TasksView {...effectiveViewProps} />;
                case "staff":     return <StaffView {...effectiveViewProps} />;
                case "monitoring":return <MonitoringView {...effectiveViewProps} />;
                case "review":    return <ReviewView {...effectiveViewProps} />;
                case "duties": case "myduties": return <DutiesView {...effectiveViewProps} setDuties={setDuties} />;
                default: return <DashboardView {...effectiveViewProps} />;
              }
            })()}
          </div>
          <BottomNav currentUser={activeUser} activeView={activeView} setActiveView={handleSetView} />
          {showMore && <MoreMenu currentUser={activeUser} activeView={activeView} setActiveView={setActiveView} onClose={() => setShowMore(false)} />}
        </div>
      ) : (
        <div style={{ display:"flex", minHeight:"100vh" }}>
          <Sidebar currentUser={activeUser} activeView={activeView} setActiveView={setActiveView} setCurrentUser={u => setCurrentUser(u)} users={users} />
          <div style={{ flex:1, overflow:"auto" }}>
            <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.text }}>
                {({dashboard:"Dashboard", tasks:"Tasks", mytasks:"My Tasks", staff:"Staff", monitoring:"Monitoring", review:"Review Submissions", duties:"Duties", myduties:"My Duties", submit:"Submit Work"})[activeView] || "GNSI Checklist"}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {tasks.filter(t => t.submission_status === "Under Review" && (activeUser.role === "admin" || (activeUser.role === "incharge" && t.department === activeUser.department))).length > 0 && (
                  <button onClick={() => setActiveView("review")} style={{ ...G.btnSm(T.warn) }}>
                    🔍 {tasks.filter(t => t.submission_status === "Under Review").length} Pending
                  </button>
                )}
                <button onClick={fetchAll} style={{ ...G.btnSm(T.surface2), border:`1px solid ${T.border}` }}>🔄 Refresh</button>
                <div style={{ fontSize:11, color:T.textMid }}>
                  {new Date().toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" })}
                </div>
              </div>
            </div>
            <div style={{ padding:24 }}>
              {loading ? <Spinner /> : (() => {
                switch (activeView) {
                  case "dashboard": return <DashboardView {...effectiveViewProps} />;
                  case "tasks": case "mytasks": case "submit": return <TasksView {...effectiveViewProps} />;
                  case "staff":     return <StaffView {...effectiveViewProps} />;
                  case "monitoring":return <MonitoringView {...effectiveViewProps} />;
                  case "review":    return <ReviewView {...effectiveViewProps} />;
                  case "duties": case "myduties": return <DutiesView {...effectiveViewProps} setDuties={setDuties} />;
                  default: return <DashboardView {...effectiveViewProps} />;
                }
              })()}
            </div>
          </div>
        </div>
      )}
      {submitTask && (
        <SubmitWorkModal task={submitTask} onClose={() => setSubmitTask(null)}
          onSubmit={async (id, note, files) => { await handleSubmit(id, note, files); setSubmitTask(null); }} />
      )}
      {reviewTask && (
        <ReviewModal task={reviewTask} currentUser={activeUser} onClose={() => setReviewTask(null)}
          onReview={async (id, action, feedback, by) => { await handleReview(id, action, feedback, by); setReviewTask(null); }} />
      )}
    </div>
  );
}