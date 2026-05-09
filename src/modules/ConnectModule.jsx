/* GNSI PORTAL — ConnectModule.jsx
   Pages: parentfeedback, ptm, calendar, library, parent
   Props: { currentUser, students, staff, connectData, onDataChange, showToast }
   connectData = { feedback, ptmMeetings, events, books, bookIssues }
*/

import { useState, useMemo } from "react";

/* ── Shared Helpers ── */
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};
const nextId = (arr) => arr.length ? Math.max(...arr.map((x) => x.id || 0)) + 1 : 1;
const esc = (s) => String(s ?? "");

const CAL_TYPES = ["Holiday", "Exam", "Sports", "Cultural", "Meeting", "Other"];
const CAL_TYPE_COLORS = { Holiday: "#dc2626", Exam: "#1433a8", Sports: "#16a34a", Cultural: "#d97706", Meeting: "#6366f1", Other: "#64748b" };
const LIB_SUBJECTS = ["All", "Mathematics", "Science", "English", "Social Studies", "Computer Science", "General Knowledge", "Hindi", "Other"];
const LIB_GENRES = ["Textbook", "Reference", "Non-Fiction", "Fiction", "Science Fiction", "Biography", "Poetry", "Other"];
const PFA_CATS = ["Academic", "Hostel", "Food", "Discipline", "Infrastructure", "Other"];
const PTM_STATUSES = { Scheduled: "#1433a8", Completed: "#16a34a", Cancelled: "#dc2626", "No Show": "#d97706" };

const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" };
const selectStyle = { ...inputStyle };
const btnPrimary = { padding: "9px 20px", borderRadius: 9, background: "#1433a8", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" };
const btnOutline = { padding: "9px 16px", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" };

/* ── Tab Button ── */
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 16px", borderRadius: 20, border: `1.5px solid ${active ? "#1433a8" : "var(--border)"}`, background: active ? "#1433a8" : "var(--surface)", color: active ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════
   1. PARENT FEEDBACK
═══════════════════════════════════════════════ */
function ParentFeedbackTab({ currentUser, connectData, onDataChange, showToast }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const isAdm = currentUser?.role === "admin" || currentUser?.role === "manager";
  const feedback = connectData.feedback || [];

  const filtered = feedback.filter((r) => {
    const catOk = filter === "all" || r.category === filter;
    const q = search.toLowerCase();
    return catOk && (!q || (r.studentName || "").toLowerCase().includes(q) || (r.message || "").toLowerCase().includes(q));
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const avg = feedback.length ? (feedback.reduce((s, r) => s + (parseInt(r.rating) || 0), 0) / feedback.length).toFixed(1) : 0;
  const catCounts = Object.fromEntries(PFA_CATS.map((c) => [c, feedback.filter((r) => r.category === c).length]));

  const del = (id) => {
    if (!window.confirm("Delete this feedback?")) return;
    onDataChange({ feedback: feedback.filter((x) => x.id !== id) });
    showToast("Feedback deleted", "#64748b");
  };

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "flex", gap: 12, padding: "16px 20px", flexWrap: "wrap", background: "var(--surface)", borderRadius: 12, marginBottom: 16, border: "1.5px solid var(--border)" }}>
        {[["Total Feedback", feedback.length, "var(--accent-light)", "var(--accent)"], ["Avg Rating", `${avg}⭐`, "#fefce8", "#c9870a"], ["5-Star", feedback.filter((r) => parseInt(r.rating) === 5).length, "#f0fdf4", "#16a34a"]].map(([label, val, bg, col]) => (
          <div key={label} style={{ flex: 1, background: bg, borderRadius: 10, padding: "12px 16px", minWidth: 100 }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{val}</div>
          </div>
        ))}
      </div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {["all", ...PFA_CATS].map((c) => (
          <button key={c} onClick={() => setFilter(c)} style={{ borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${filter === c ? "var(--accent)" : "var(--border)"}`, background: filter === c ? "var(--accent)" : "transparent", color: filter === c ? "#fff" : "var(--muted)" }}>
            {c === "all" ? `All (${feedback.length})` : `${c} (${catCounts[c] || 0})`}
          </button>
        ))}
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
      </div>
      {/* Table */}
      <div style={{ background: "var(--surface)", borderRadius: 12, border: "1.5px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "var(--surface2)" }}>
            {["Date", "Student / Parent", "Category", "Rating", "Message", ...(isAdm ? [""] : [])].map((h) => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length ? filtered.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px" }}>{r.date || "—"}</td>
                <td style={{ padding: "10px 12px" }}><b>{esc(r.studentName || "Anonymous")}</b><div style={{ fontSize: 11, color: "var(--muted)" }}>{esc(r.parentName || "")}</div></td>
                <td style={{ padding: "10px 12px" }}><span style={{ background: "var(--accent-light)", color: "var(--accent)", borderRadius: 5, padding: "2px 8px", fontSize: 11 }}>{esc(r.category || "General")}</span></td>
                <td style={{ padding: "10px 12px" }}>{"⭐".repeat(Math.min(5, parseInt(r.rating) || 0))}</td>
                <td style={{ padding: "10px 12px", maxWidth: 220, fontSize: 12 }}>{esc(r.message || "—")}</td>
                {isAdm && <td style={{ padding: "10px 12px" }}><button onClick={() => del(r.id)} style={{ background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🗑️</button></td>}
              </tr>
            )) : (
              <tr><td colSpan={isAdm ? 6 : 5} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No feedback submitted yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   2. PTM — Parent-Teacher Meetings
═══════════════════════════════════════════════ */
function PTMTab({ currentUser, staff, connectData, onDataChange, showToast }) {
  const [tab, setTab] = useState("scheduled");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const isAdm = ["admin", "manager"].includes(currentUser?.role);
  const meetings = connectData.ptmMeetings || [];
  const teachers = staff.filter((s) => s.dept === "Teaching" || (s.role || "").toLowerCase().includes("teacher"));

  const filtered = meetings.filter((m) => tab === "all" ? true : tab === "scheduled" ? m.status === "Scheduled" : m.status === "Completed" || m.status === "No Show");
  const sched = meetings.filter((m) => m.status === "Scheduled").length;
  const done = meetings.filter((m) => m.status === "Completed").length;

  const save = () => {
    if (!form.date || !form.teacher || !form.student) { showToast("Fill all required fields", "#dc2626"); return; }
    const upd = editId
      ? meetings.map((m) => m.id === editId ? { ...m, ...form } : m)
      : [...meetings, { id: nextId(meetings), status: "Scheduled", ...form }];
    onDataChange({ ptmMeetings: upd });
    setShowForm(false); setEditId(null); setForm({});
    showToast(editId ? "Meeting updated" : "Meeting scheduled", "#16a34a");
  };

  const updateStatus = (id, status) => {
    onDataChange({ ptmMeetings: meetings.map((m) => m.id === id ? { ...m, status } : m) });
  };

  const addNotes = (id) => {
    const el = document.getElementById(`ptm-note-${id}`);
    if (!el) return;
    onDataChange({ ptmMeetings: meetings.map((m) => m.id === id ? { ...m, notes: el.value } : m) });
    showToast("Note saved", "#16a34a");
  };

  const del = (id) => {
    if (!window.confirm("Delete this meeting?")) return;
    onDataChange({ ptmMeetings: meetings.filter((m) => m.id !== id) });
  };

  const openEdit = (id) => {
    const m = meetings.find((x) => x.id === id);
    if (m) { setForm(m); setEditId(id); setShowForm(true); }
  };

  return (
    <div style={{ padding: "8px 0 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: "var(--text)" }}>🤝 Parent-Teacher Meet</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>{sched} scheduled · {done} completed · {meetings.length} total</div>
        </div>
        {isAdm && !showForm && <button onClick={() => { setShowForm(true); setEditId(null); setForm({ date: today(), time: "09:00" }); }} style={btnPrimary}>➕ Schedule Meeting</button>}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: "var(--surface)", border: "1.5px solid #1433a8", borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{editId ? "✏️ Edit Meeting" : "➕ Schedule PTM Meeting"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {[["date", "Date *", "date"], ["time", "Time", "time"]].map(([k, label, type]) => (
              <div key={k}><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</label>
                <input type={type} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={inputStyle} /></div>
            ))}
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Teacher *</label>
              <select value={form.teacher || ""} onChange={(e) => setForm({ ...form, teacher: e.target.value })} style={selectStyle}>
                <option value="">-- Select --</option>
                {teachers.map((t) => <option key={t.id}>{t.name}</option>)}
              </select></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Student Name *</label>
              <input value={form.student || ""} onChange={(e) => setForm({ ...form, student: e.target.value })} placeholder="Student full name" style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Parent / Guardian</label>
              <input value={form.parent || ""} onChange={(e) => setForm({ ...form, parent: e.target.value })} placeholder="Parent name" style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Class</label>
              <input value={form.cls || ""} onChange={(e) => setForm({ ...form, cls: e.target.value })} placeholder="e.g. Navodaya New" style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Agenda / Purpose</label>
            <textarea value={form.agenda || ""} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={2} placeholder="e.g. Discuss exam performance…" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} style={btnPrimary}>Save Meeting</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm({}); }} style={btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["scheduled", "completed", "all"].map((t) => <TabBtn key={t} active={tab === t} onClick={() => setTab(t)}>{t}</TabBtn>)}
      </div>

      {/* Meeting Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length ? filtered.map((m) => {
          const sc = PTM_STATUSES[m.status] || "#64748b";
          return (
            <div key={m.id} style={{ background: "var(--surface)", border: `1.5px solid var(--border)`, borderLeft: `4px solid ${sc}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>👤 {esc(m.student)}{m.cls ? ` · ` : ""}<span style={{ fontWeight: 500, color: "var(--muted)" }}>{esc(m.cls)}</span></div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sc, background: `${sc}18`, borderRadius: 5, padding: "2px 8px" }}>{m.status}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>👩‍🏫 {esc(m.teacher)} · 📅 {esc(m.date)}{m.time ? ` ${m.time}` : ""}{m.parent ? ` · Parent: ${esc(m.parent)}` : ""}</div>
                  {m.agenda && <div style={{ fontSize: 12, color: "var(--text)", marginTop: 4, background: "var(--bg)", borderRadius: 7, padding: "6px 10px" }}>{esc(m.agenda)}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                  {m.status === "Scheduled" && <>
                    <button onClick={() => updateStatus(m.id, "Completed")} style={{ padding: "4px 10px", borderRadius: 7, background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓ Mark Done</button>
                    <button onClick={() => updateStatus(m.id, "No Show")} style={{ padding: "4px 10px", borderRadius: 7, background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>⚠ No Show</button>
                  </>}
                  {isAdm && <button onClick={() => openEdit(m.id)} style={{ padding: "4px 10px", borderRadius: 7, background: "var(--bg)", color: "var(--muted)", border: "1.5px solid var(--border)", fontSize: 11, cursor: "pointer" }}>✏️</button>}
                  {isAdm && <button onClick={() => del(m.id)} style={{ padding: "4px 10px", borderRadius: 7, background: "#fee2e2", color: "#ef4444", border: "1px solid #fca5a5", fontSize: 11, cursor: "pointer" }}>🗑</button>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                <input id={`ptm-note-${m.id}`} defaultValue={m.notes || ""} placeholder="Add meeting notes…" style={{ ...inputStyle, fontSize: 12, padding: "6px 10px" }} />
                <button onClick={() => addNotes(m.id)} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 11, whiteSpace: "nowrap" }}>Save Note</button>
              </div>
            </div>
          );
        }) : <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No meetings found.</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   3. EVENT CALENDAR
═══════════════════════════════════════════════ */
function CalendarTab({ currentUser, connectData, onDataChange, showToast }) {
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selDate, setSelDate] = useState("");
  const [form, setForm] = useState({});
  const isAdm = ["admin", "manager"].includes(currentUser?.role);
  const events = connectData.events || [];
  const todayStr = today();

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const eventsOnDate = (ds) => events.filter((e) => e.date === ds || (e.endDate && ds >= e.date && ds <= e.endDate));
  const upcoming = events.filter((e) => e.date >= todayStr).sort((a, b) => a.date > b.date ? 1 : -1).slice(0, 8);

  const saveEvent = () => {
    if (!form.title || !form.date) { showToast("Title and date required", "#dc2626"); return; }
    const upd = editId
      ? events.map((e) => e.id === editId ? { ...e, ...form } : e)
      : [...events, { id: `ev${Date.now()}`, type: "Other", ...form }];
    onDataChange({ events: upd });
    setShowForm(false); setEditId(null); setForm({});
    showToast(editId ? "Event updated" : "Event added", "#16a34a");
  };

  const delEvent = (id) => {
    if (!window.confirm("Delete this event?")) return;
    onDataChange({ events: events.filter((e) => e.id !== id) });
  };

  const openForm = (ds, id) => {
    if (id) {
      const ev = events.find((e) => e.id === id);
      if (ev) { setForm(ev); setEditId(id); }
    } else {
      setForm({ date: ds || today(), type: "Other" }); setEditId(null);
    }
    setShowForm(true);
  };

  return (
    <div style={{ padding: "8px 0 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800 }}>📅 Event Calendar</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>{events.length} events · {upcoming.length} upcoming</div>
        </div>
        {isAdm && !showForm && <button onClick={() => openForm()} style={btnPrimary}>➕ Add Event</button>}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: "var(--surface)", border: "1.5px solid #1433a8", borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{editId ? "✏️ Edit Event" : "➕ Add Event"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Title *</label><input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Type</label>
              <select value={form.type || "Other"} onChange={(e) => setForm({ ...form, type: e.target.value })} style={selectStyle}>
                {CAL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Start Date *</label><input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>End Date (optional)</label><input type="date" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Description</label>
            <textarea value={form.desc || ""} onChange={(e) => setForm({ ...form, desc: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveEvent} style={btnPrimary}>Save Event</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm({}); }} style={btnOutline}>Cancel</button>
            {editId && isAdm && <button onClick={() => { delEvent(editId); setShowForm(false); }} style={{ ...btnOutline, color: "#ef4444", borderColor: "#fee2e2", marginLeft: "auto" }}>🗑 Delete</button>}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
        {/* Calendar Grid */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1.5px solid var(--border)" }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>‹</button>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>{MONTHS[calMonth]} {calYear}</div>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, padding: 12 }}>
            {DAYS.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)", padding: "6px 0", textTransform: "uppercase" }}>{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`b${i}`} style={{ minHeight: 70, borderRadius: 8, background: "var(--bg)", opacity: 0.3 }} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayEvs = eventsOnDate(ds);
              const isToday = ds === todayStr;
              const isSun = new Date(calYear, calMonth, d).getDay() === 0;
              return (
                <div key={d} onClick={() => isAdm && openForm(ds)} style={{ minHeight: 70, borderRadius: 8, border: `1.5px solid ${isToday ? "#1433a8" : "var(--border)"}`, background: isToday ? "#e8edff" : "var(--surface)", padding: 6, cursor: isAdm ? "pointer" : "default", overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isSun ? "#dc2626" : isToday ? "#1433a8" : "var(--text)", marginBottom: 3 }}>{d}</div>
                  {dayEvs.slice(0, 2).map((e) => <div key={e.id} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: CAL_TYPE_COLORS[e.type] || "#64748b", borderRadius: 3, padding: "1px 5px", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>)}
                  {dayEvs.length > 2 && <div style={{ fontSize: 10, color: "var(--muted)" }}>+{dayEvs.length - 2} more</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".04em" }}>Event Types</div>
            {CAL_TYPES.map((t) => <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: CAL_TYPE_COLORS[t] }} /><span style={{ fontSize: 12 }}>{t}</span></div>)}
          </div>
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".04em" }}>Upcoming Events</div>
            {upcoming.length ? upcoming.map((e) => {
              const c = CAL_TYPE_COLORS[e.type] || "#64748b";
              return <div key={e.id} onClick={() => isAdm && openForm(e.date, e.id)} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid var(--border)", cursor: isAdm ? "pointer" : "default" }}>
                <div style={{ width: 4, minHeight: 32, background: c, borderRadius: 2, flexShrink: 0 }} />
                <div><div style={{ fontSize: 12, fontWeight: 700 }}>{e.title}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{e.date}{e.endDate ? ` → ${e.endDate}` : ""}</div></div>
              </div>;
            }) : <div style={{ fontSize: 12, color: "var(--muted)" }}>No upcoming events.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   4. LIBRARY
═══════════════════════════════════════════════ */
function LibraryTab({ currentUser, connectData, onDataChange, showToast }) {
  const [libTab, setLibTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [subjFilter, setSubjFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [issueBookId, setIssueBookId] = useState(null);
  const [form, setForm] = useState({});
  const [issueForm, setIssueForm] = useState({});
  const isAdm = ["admin", "manager", "teacher"].includes(currentUser?.role);
  const books = connectData.books || [];
  const issues = connectData.bookIssues || [];
  const todayStr = today();

  const totalBooks = books.reduce((s, b) => s + (b.qty || 0), 0);
  const totalAvail = books.reduce((s, b) => s + (b.available || 0), 0);
  const totalIssued = issues.filter((i) => i.status === "Issued").length;
  const overdueCount = issues.filter((i) => i.status === "Issued" && i.dueDate < todayStr).length;

  const filteredBooks = books.filter((b) => {
    const sMatch = subjFilter === "All" || b.subject === subjFilter;
    const q = search.toLowerCase();
    return sMatch && (!q || (b.title + b.author + (b.accNo || "")).toLowerCase().includes(q));
  });

  const saveBook = () => {
    if (!form.title) { showToast("Title required", "#dc2626"); return; }
    const upd = editId
      ? books.map((b) => b.id === editId ? { ...b, ...form } : b)
      : [...books, { id: `lib${Date.now()}`, available: parseInt(form.qty) || 1, issued: 0, addedOn: todayStr, ...form }];
    onDataChange({ books: upd });
    setShowForm(false); setEditId(null); setForm({});
    showToast("Book saved", "#16a34a");
  };

  const issueBook = () => {
    const book = books.find((b) => b.id === issueBookId);
    if (!issueForm.borrower) { showToast("Borrower name required", "#dc2626"); return; }
    if (!book || book.available <= 0) { showToast("No copies available", "#dc2626"); return; }
    const newIssue = { id: `iss${Date.now()}`, bookId: book.id, bookTitle: book.title, borrower: issueForm.borrower, borrowerType: issueForm.borrowerType || "Student", issueDate: issueForm.issueDate || todayStr, dueDate: issueForm.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0], status: "Issued" };
    onDataChange({ books: books.map((b) => b.id === issueBookId ? { ...b, available: b.available - 1, issued: (b.issued || 0) + 1 } : b), bookIssues: [...issues, newIssue] });
    setShowIssueForm(false); setIssueBookId(null); setIssueForm({});
    showToast("Book issued", "#16a34a");
  };

  const returnBook = (issId) => {
    const iss = issues.find((i) => i.id === issId);
    if (!iss) return;
    onDataChange({ books: books.map((b) => b.id === iss.bookId ? { ...b, available: (b.available || 0) + 1, issued: Math.max(0, (b.issued || 0) - 1) } : b), bookIssues: issues.map((i) => i.id === issId ? { ...i, status: "Returned", returnDate: todayStr } : i) });
    showToast("Book returned", "#16a34a");
  };

  const delBook = (id) => {
    if (!window.confirm("Delete this book?")) return;
    onDataChange({ books: books.filter((b) => b.id !== id) });
  };

  return (
    <div style={{ padding: "8px 0 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800 }}>📚 Library</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>{books.length} titles · {totalBooks} copies · {totalAvail} available · {totalIssued} issued{overdueCount > 0 ? ` · ` : ""}{overdueCount > 0 && <span style={{ color: "#dc2626", fontWeight: 700 }}>{overdueCount} overdue</span>}</div>
        </div>
        {isAdm && !showForm && !showIssueForm && <button onClick={() => { setShowForm(true); setEditId(null); setForm({}); }} style={btnPrimary}>➕ Add Book</button>}
      </div>

      {/* Add Book Form */}
      {showForm && (
        <div style={{ background: "var(--surface)", border: "1.5px solid #1433a8", borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{editId ? "✏️ Edit Book" : "📚 Add Book to Catalog"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {[["title", "Title *"], ["author", "Author"], ["publisher", "Publisher"], ["year", "Year"], ["accNo", "Accession No."], ["location", "Shelf Location"]].map(([k, label]) => (
              <div key={k}><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</label>
                <input value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={label} style={inputStyle} /></div>
            ))}
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Subject</label>
              <select value={form.subject || "Mathematics"} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={selectStyle}>{LIB_SUBJECTS.slice(1).map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Genre</label>
              <select value={form.genre || "Textbook"} onChange={(e) => setForm({ ...form, genre: e.target.value })} style={selectStyle}>{LIB_GENRES.map((g) => <option key={g}>{g}</option>)}</select></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Total Copies</label>
              <input type="number" min="1" value={form.qty || 1} onChange={(e) => setForm({ ...form, qty: parseInt(e.target.value) })} style={inputStyle} /></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}><button onClick={saveBook} style={btnPrimary}>Save Book</button><button onClick={() => { setShowForm(false); setEditId(null); setForm({}); }} style={btnOutline}>Cancel</button></div>
        </div>
      )}

      {/* Issue Form */}
      {showIssueForm && (
        <div style={{ background: "var(--surface)", border: "1.5px solid #16a34a", borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📖 Issue Book</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Issuing: <b style={{ color: "var(--text)" }}>{books.find((b) => b.id === issueBookId)?.title}</b></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Borrower Name *</label><input value={issueForm.borrower || ""} onChange={(e) => setIssueForm({ ...issueForm, borrower: e.target.value })} placeholder="Student or staff name" style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Borrower Type</label>
              <select value={issueForm.borrowerType || "Student"} onChange={(e) => setIssueForm({ ...issueForm, borrowerType: e.target.value })} style={selectStyle}><option>Student</option><option>Staff</option><option>Guest</option></select></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Issue Date *</label><input type="date" value={issueForm.issueDate || todayStr} onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })} style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Due Date *</label><input type="date" value={issueForm.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]} onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })} style={inputStyle} /></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}><button onClick={issueBook} style={{ ...btnPrimary, background: "#16a34a" }}>Issue Book</button><button onClick={() => { setShowIssueForm(false); setIssueBookId(null); setIssueForm({}); }} style={btnOutline}>Cancel</button></div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["catalog", "📚 Catalog"], ["issued", `📖 Issued (${totalIssued})`], ["overdue", `⚠️ Overdue (${overdueCount})`]].map(([t, label]) => (
          <TabBtn key={t} active={libTab === t} onClick={() => setLibTab(t)}>{label}</TabBtn>
        ))}
      </div>

      {/* Catalog */}
      {libTab === "catalog" && (
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search title, author…" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
            <select value={subjFilter} onChange={(e) => setSubjFilter(e.target.value)} style={{ ...selectStyle, width: "auto" }}>{LIB_SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "var(--bg)", borderBottom: "2px solid var(--border)" }}>
                {["Title & Author", "Subject", "Accession", "Copies", "Available", "Shelf", "Actions"].map((h) => <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredBooks.length ? filteredBooks.map((b, i) => {
                  const ac = b.available === 0 ? "#dc2626" : b.available <= 2 ? "#d97706" : "#16a34a";
                  return <tr key={b.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td style={{ padding: "10px 12px" }}><div style={{ fontWeight: 700 }}>{b.title}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{b.author || "--"}{b.year ? ` · ${b.year}` : ""}</div></td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{b.subject}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)", fontFamily: "monospace", fontSize: 12 }}>{b.accNo || "--"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>{b.qty}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}><span style={{ fontWeight: 700, color: ac }}>{b.available}</span></td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 12 }}>{b.location || "--"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {b.available > 0 ? <button onClick={() => { setIssueBookId(b.id); setShowIssueForm(true); setIssueForm({}); }} style={{ padding: "4px 10px", borderRadius: 7, background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Issue</button>
                          : <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>All Issued</span>}
                        {isAdm && <button onClick={() => { const bk = books.find((x) => x.id === b.id); setForm(bk || {}); setEditId(b.id); setShowForm(true); }} style={{ padding: "4px 9px", borderRadius: 7, border: "1.5px solid var(--border)", background: "var(--surface)", fontSize: 11, cursor: "pointer" }}>✏️</button>}
                        {isAdm && <button onClick={() => delBook(b.id)} style={{ padding: "4px 9px", borderRadius: 7, border: "1.5px solid #fee2e2", background: "#fff1f2", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>🗑</button>}
                      </div>
                    </td>
                  </tr>;
                }) : <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No books found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issued */}
      {libTab === "issued" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {issues.filter((i) => i.status === "Issued").length ? issues.filter((i) => i.status === "Issued").map((iss) => {
            const overdue = iss.dueDate < todayStr;
            const daysLeft = Math.ceil((new Date(iss.dueDate) - new Date(todayStr)) / 86400000);
            return <div key={iss.id} style={{ background: "var(--surface)", border: `1.5px solid ${overdue ? "#fca5a5" : "var(--border)"}`, borderLeft: `4px solid ${overdue ? "#dc2626" : "#1433a8"}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{iss.bookTitle}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>👤 <b>{iss.borrower}</b> ({iss.borrowerType}) · Issued: {iss.issueDate} · Due: {iss.dueDate}</div>
                {overdue ? <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginTop: 4 }}>⚠️ OVERDUE by {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? "s" : ""}</div>
                  : <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining</div>}
              </div>
              <button onClick={() => returnBook(iss.id)} style={{ ...btnPrimary, fontSize: 12, padding: "7px 16px", whiteSpace: "nowrap" }}>↩ Return</button>
            </div>;
          }) : <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No books currently issued.</div>}
        </div>
      )}

      {/* Overdue */}
      {libTab === "overdue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {issues.filter((i) => i.status === "Issued" && i.dueDate < todayStr).length ? issues.filter((i) => i.status === "Issued" && i.dueDate < todayStr).map((iss) => {
            const daysLate = Math.ceil((new Date(todayStr) - new Date(iss.dueDate)) / 86400000);
            return <div key={iss.id} style={{ background: "#fff1f2", border: "1.5px solid #fca5a5", borderLeft: "4px solid #dc2626", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 3 }}>⚠️ {iss.bookTitle}</div>
                <div style={{ fontSize: 12, color: "#7f1d1d" }}>👤 <b>{iss.borrower}</b> · Due: {iss.dueDate} · <b>{daysLate} day{daysLate !== 1 ? "s" : ""} overdue</b></div>
              </div>
              <button onClick={() => returnBook(iss.id)} style={{ ...btnPrimary, background: "#dc2626", fontSize: 12, padding: "7px 16px", whiteSpace: "nowrap" }}>↩ Return</button>
            </div>;
          }) : <div style={{ padding: 40, textAlign: "center", color: "#16a34a", fontSize: 13 }}>✅ No overdue books.</div>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   5. PARENT PORTAL
═══════════════════════════════════════════════ */
function ParentPortalTab({ currentUser, students, connectData, onDataChange, showToast }) {
  const [ppTab, setPpTab] = useState("result");
  const [ppStudent, setPpStudent] = useState(null);
  const [gcc, setGcc] = useState("");
  const [roll, setRoll] = useState("");
  const [fbForm, setFbForm] = useState({ name: "", student: "", rating: "", message: "" });
  const feedback = connectData.feedback || [];

  const login = () => {
    if (!gcc && !roll) { showToast("Enter GCC or Roll number", "#dc2626"); return; }
    const found = students.find((s) => (gcc && (s.gcc === gcc || s.admissionNo === gcc || String(s.roll) === gcc)) || (roll && String(s.roll) === roll));
    if (!found) { showToast("Student not found. Check GCC / Roll No.", "#dc2626"); return; }
    setPpStudent(found);
  };

  const submitFeedback = () => {
    if (!fbForm.name || !fbForm.message) { showToast("Please fill Name and Feedback", "#dc2626"); return; }
    onDataChange({ feedback: [...feedback, { id: `PF${Date.now()}`, ...fbForm, date: new Date().toISOString() }] });
    setFbForm({ name: "", student: "", rating: "", message: "" });
    showToast("Feedback submitted. Thank you!", "#16a34a");
  };

  const tabs = [{ id: "result", icon: "📋", label: "Check Result" }, { id: "fee", icon: "💳", label: "Fee Status" }, { id: "notices", icon: "📢", label: "Notices" }, { id: "feedback", icon: "💬", label: "Feedback" }];

  return (
    <div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>👨‍👩‍👧 Parent & Student Portal</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map((t) => {
          const act = ppTab === t.id;
          return <button key={t.id} onClick={() => setPpTab(t.id)} style={{ flex: 1, minWidth: 90, padding: "9px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: act ? 700 : 500, background: act ? "var(--accent)" : "#f1f5f9", color: act ? "#fff" : "var(--muted)", transition: "all .15s" }}>{t.icon} {t.label}</button>;
        })}
      </div>

      {/* Result Tab */}
      {ppTab === "result" && (
        ppStudent ? (
          <div className="card">
            <div className="card-head"><span className="card-title">📋 Results — {ppStudent.name}</span><button onClick={() => setPpStudent(null)} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>← Logout</button></div>
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>No results data available. Results will appear here once exam marks are entered.</div>
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 20, maxWidth: 360 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>📋 Check Result</div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>GCC / Admission No.</label><input value={gcc} onChange={(e) => setGcc(e.target.value)} placeholder="e.g. GNSI-2024-001" style={inputStyle} /></div>
            <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Roll Number</label><input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="Roll number" style={inputStyle} /></div>
            <button onClick={login} style={btnPrimary}>🔍 View Result</button>
          </div>
        )
      )}

      {/* Fee Tab */}
      {ppTab === "fee" && (
        ppStudent ? (
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div className="card-head"><span className="card-title">💳 Fee Status — {ppStudent.name}</span><button onClick={() => setPpStudent(null)} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>← Logout</button></div>
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>Fee records will appear here once fee data is linked to this student.</div>
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 20, maxWidth: 360 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>💳 Fee Status</div>
            <div style={{ marginBottom: 12 }}><input value={gcc} onChange={(e) => setGcc(e.target.value)} placeholder="GCC / Admission No." style={inputStyle} /></div>
            <div style={{ marginBottom: 16 }}><input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="Roll number" style={inputStyle} /></div>
            <button onClick={login} style={btnPrimary}>🔍 View Fee Status</button>
          </div>
        )
      )}

      {/* Notices Tab */}
      {ppTab === "notices" && (
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div className="card-head"><span className="card-title">📢 Notice Board</span></div>
          {(connectData.notices || []).slice(0, 20).length ? (connectData.notices || []).slice(0, 20).map((n) => (
            <div key={n.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{n.title || "Notice"}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{(n.date || "").split("T")[0]}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{n.body || n.content || ""}</div>
            </div>
          )) : <div style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>No notices published.</div>}
        </div>
      )}

      {/* Feedback Tab */}
      {ppTab === "feedback" && (
        <div>
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
            <div className="card-head"><span className="card-title">💬 Share Feedback</span></div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Your Name</label><input value={fbForm.name} onChange={(e) => setFbForm({ ...fbForm, name: e.target.value })} placeholder="Parent / Guardian name" style={inputStyle} /></div>
                <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Student Name</label><input value={fbForm.student} onChange={(e) => setFbForm({ ...fbForm, student: e.target.value })} placeholder="Ward's name" style={inputStyle} /></div>
                <div><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Rating</label>
                  <select value={fbForm.rating} onChange={(e) => setFbForm({ ...fbForm, rating: e.target.value })} style={selectStyle}>
                    <option value="">-- Select --</option>
                    {["⭐⭐⭐⭐⭐ Excellent", "⭐⭐⭐⭐ Good", "⭐⭐⭐ Average", "⭐⭐ Below Average", "⭐ Poor"].map((r) => <option key={r}>{r}</option>)}
                  </select></div>
                <div style={{ gridColumn: "1/-1" }}><label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Feedback / Suggestions</label>
                  <textarea value={fbForm.message} onChange={(e) => setFbForm({ ...fbForm, message: e.target.value })} rows={4} placeholder="Share your experience…" style={{ ...inputStyle, resize: "vertical" }} /></div>
              </div>
              <button onClick={submitFeedback} style={btnPrimary}>📤 Submit Feedback</button>
            </div>
          </div>
          {feedback.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12 }}>
              <div className="card-head"><span className="card-title" style={{ fontSize: 13 }}>Recent Feedback ({feedback.length})</span></div>
              {feedback.slice().reverse().slice(0, 5).map((f) => (
                <div key={f.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{f.name || "Anonymous"} — {f.student || ""}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{(f.date || "").split("T")[0]} · {f.rating || ""}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{f.message || ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════ */
export default function ConnectModule({ currentUser, students = [], staff = [], connectData = {}, onDataChange, showToast }) {
  const [activeTab, setActiveTab] = useState("feedback");

  const tabs = [
    { id: "feedback", label: "💬 Feedback" },
    { id: "ptm", label: "🤝 PTM" },
    { id: "calendar", label: "📅 Calendar" },
    { id: "library", label: "📚 Library" },
    { id: "parent", label: "👨‍👩‍👧 Parent Portal" },
  ];

  const merge = (partial) => onDataChange?.({ ...connectData, ...partial });

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 4 }}>GNSI — CONNECT</div>
        <div style={{ fontSize: 24, fontFamily: "'Playfair Display',serif", fontWeight: 700, color: "var(--text)" }}>Connect & Community</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Parent Feedback · PTM · Calendar · Library · Parent Portal</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${activeTab === t.id ? "#1433a8" : "var(--border)"}`, background: activeTab === t.id ? "#1433a8" : "var(--surface)", color: activeTab === t.id ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: activeTab === t.id ? 700 : 500, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "feedback" && <ParentFeedbackTab currentUser={currentUser} connectData={connectData} onDataChange={merge} showToast={showToast} />}
      {activeTab === "ptm" && <PTMTab currentUser={currentUser} staff={staff} connectData={connectData} onDataChange={merge} showToast={showToast} />}
      {activeTab === "calendar" && <CalendarTab currentUser={currentUser} connectData={connectData} onDataChange={merge} showToast={showToast} />}
      {activeTab === "library" && <LibraryTab currentUser={currentUser} connectData={connectData} onDataChange={merge} showToast={showToast} />}
      {activeTab === "parent" && <ParentPortalTab currentUser={currentUser} students={students} connectData={connectData} onDataChange={merge} showToast={showToast} />}
    </div>
  );
}
