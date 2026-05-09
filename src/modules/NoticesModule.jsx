/**
 * GNSI PORTAL — NoticesModule.jsx
 * Pages: Notices Board (CRUD, priority, cloud sync indicator)
 * Original: modules/notices.js
 */

import { useState } from "react";

/* ── Helpers ── */
const PRIORITY_COLORS = { High: "#dc2626", Medium: "#d4a853", Low: "#16a34a" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 9,
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  background: "#f8faff",
  boxSizing: "border-box",
};

/* ── Notice Form ── */
function NoticeForm({ notice, onSave, onCancel }) {
  const isEdit = !!notice;
  const [form, setForm] = useState({
    title: notice?.title || "",
    priority: notice?.priority || "Medium",
    body: notice?.body || "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const color = isEdit ? "#f59e0b" : "#8b5cf6";

  const handleSave = () => {
    if (!form.title.trim()) { alert("Title is required."); return; }
    onSave({ ...form, id: notice?.id });
  };

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${color}`, borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color, marginBottom: 16 }}>
        {isEdit ? "✏️ Edit Notice" : "📢 Post New Notice"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Notice Title *</label>
          <input style={inputStyle} value={form.title} onChange={set("title")} placeholder="e.g. Examination Schedule" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Priority</label>
          <select style={{ ...inputStyle, width: 120 }} value={form.priority} onChange={set("priority")}>
            {["High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Notice Content</label>
        <textarea style={{ ...inputStyle, resize: "vertical" }} rows={4} value={form.body} onChange={set("body")} placeholder="Enter notice details here..." />
      </div>
      <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#0369a1" }}>
        ☁️ This notice will sync to Supabase and be visible to all logged-in users immediately.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: isEdit ? "#f59e0b" : "#8b5cf6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {isEdit ? "✅ Save Changes" : "📢 Post Notice"}
        </button>
        <button onClick={onCancel} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Notice Card ── */
function NoticeCard({ notice, canEdit, canDel, onEdit, onDelete }) {
  const color = PRIORITY_COLORS[notice.priority] || "#64748b";
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${color}22`, borderLeft: `4px solid ${color}`, padding: 20, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", transition: "box-shadow 0.2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
          {notice.priority}
        </span>
        <div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{notice.title}</div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {canEdit && (
            <button onClick={() => onEdit(notice)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8", lineHeight: 1 }}>✏️</button>
          )}
          {canDel && (
            <button onClick={() => onDelete(notice.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace", marginBottom: 10 }}>
        📅 {fmtDate(notice.date)}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{notice.body}</div>
    </div>
  );
}

/* ── Main NoticesModule ── */
export default function NoticesModule({ currentUser, notices = [], onNoticesChange, isOnline = true, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";
  const canPost = isAdmin;
  const canEdit = isAdmin;
  const canDel = isAdmin;

  const handleSave = (data) => {
    if (data.id) {
      // Edit
      onNoticesChange(notices.map((n) => n.id === data.id ? { ...n, ...data } : n));
      showToast?.("Notice updated", "#16a34a");
      setEditingNotice(null);
    } else {
      // Add
      const newNotice = {
        id: Date.now(),
        title: data.title,
        body: data.body,
        priority: data.priority,
        date: new Date().toISOString().split("T")[0],
      };
      onNoticesChange([newNotice, ...notices]);
      showToast?.(isOnline ? "✅ Notice posted — visible to all users now" : "Notice posted (offline — will sync when connected)", isOnline ? "#16a34a" : "#f59e0b");
      setShowForm(false);
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this notice?")) return;
    onNoticesChange(notices.filter((n) => n.id !== id));
    showToast?.("🗑 Notice removed", "#64748b");
  };

  const handleEdit = (notice) => {
    setEditingNotice(notice);
    setShowForm(false);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {isOnline ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, padding: "2px 10px" }}>
            ☁️ Cloud Sync ON
          </span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "2px 10px" }}>
            ⚠️ Offline Mode
          </span>
        )}
        <div style={{ flex: 1 }} />
        {canPost && (
          <button
            onClick={() => { setShowForm(!showForm); setEditingNotice(null); }}
            style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            + Post Notice
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && !editingNotice && (
        <NoticeForm onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}

      {/* Edit form */}
      {editingNotice && (
        <NoticeForm notice={editingNotice} onSave={handleSave} onCancel={() => setEditingNotice(null)} />
      )}

      {/* Notice cards */}
      {notices.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>No notices posted yet.</div>
      ) : (
        notices.map((n) => (
          <NoticeCard
            key={n.id}
            notice={n}
            canEdit={canEdit}
            canDel={canDel}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  );
}
