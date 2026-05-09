/**
 * GNSI PORTAL — LeaveModule.jsx
 * Pages: Leave Applications, Substitute Teacher Roster
 * Original: modules/leave.js
 */

import { useState } from "react";

/* ── Helpers ── */
const today = () => new Date().toISOString().split("T")[0];

function daysBetween(from, to) {
  return Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
}

function Badge({ label, color }) {
  return (
    <span style={{ color, fontWeight: 700, fontSize: 12 }}>{label}</span>
  );
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

const selectStyle = { ...inputStyle };
const textareaStyle = { ...inputStyle, resize: "vertical" };

function FormGroup({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Leave Balance Strip ── */
function LeaveBalances({ myLeaves }) {
  const types = [
    { t: "Casual", key: "Casual Leave", max: 12 },
    { t: "Medical", key: "Medical Leave", max: 10 },
    { t: "Earned", key: "Earned Leave", max: 15 },
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {types.map((lt) => {
        const used = myLeaves
          .filter((l) => l.type === lt.key && l.status === "Approved")
          .reduce((s, l) => s + daysBetween(l.from, l.to), 0);
        const rem = lt.max - used;
        return (
          <div key={lt.t} style={{ background: "#f8faff", borderRadius: 10, padding: "12px 18px", minWidth: 120, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'JetBrains Mono',monospace" }}>{lt.t}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: rem > 3 ? "#16a34a" : "#c0291d", fontFamily: "'Cormorant Garamond',serif" }}>{rem}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>of {lt.max} remaining</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Apply Leave Form ── */
function LeaveForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ type: "Casual Leave", from: today(), to: today(), reason: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.from || !form.to || !form.reason.trim()) { alert("Please fill all fields."); return; }
    if (form.from > form.to) { alert("From date must be before To date."); return; }
    onSubmit(form);
  };

  return (
    <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#1433a8", marginBottom: 14 }}>Apply for Leave</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <FormGroup label="Leave Type *">
          <select style={selectStyle} value={form.type} onChange={set("type")}>
            {["Casual Leave", "Medical Leave", "Emergency Leave", "Earned Leave", "Other"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </FormGroup>
        <FormGroup label="From Date *">
          <input style={inputStyle} type="date" value={form.from} onChange={set("from")} />
        </FormGroup>
        <FormGroup label="To Date *">
          <input style={inputStyle} type="date" value={form.to} onChange={set("to")} />
        </FormGroup>
        <div style={{ gridColumn: "1/-1" }}>
          <FormGroup label="Reason *">
            <textarea style={textareaStyle} rows={2} placeholder="Brief reason for leave..." value={form.reason} onChange={set("reason")} />
          </FormGroup>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={handleSubmit} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Submit Application
        </button>
        <button onClick={onCancel} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Pending Approvals (Admin) ── */
function PendingApprovals({ leaves, staff, onDecision }) {
  const pending = leaves.filter((l) => l.status === "Pending");
  if (!pending.length) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #fde68a", marginBottom: 20, overflow: "hidden" }}>
      <div style={{ background: "#fffbeb", padding: "14px 20px", display: "flex", alignItems: "center" }}>
        <span style={{ fontWeight: 800, color: "#d4a853", fontSize: 14 }}>⏳ Pending Approvals ({pending.length})</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fffbeb" }}>
              {["Staff", "Type", "Dates", "Days", "Reason", "Action"].map((h) => (
                <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pending.map((l) => {
              const member = staff.find((s) => s.id === l.staffId) || { name: "Unknown", role: "" };
              const days = daysBetween(l.from, l.to);
              return (
                <tr key={l.id} style={{ borderTop: "1px solid #fef3c7" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{member.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{member.role}</div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{l.type}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{l.from} → {l.to}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{days}d</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b", maxWidth: 200 }}>{l.reason}</td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    <button onClick={() => onDecision(l.id, "Approved", "")} style={{ background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 700, fontSize: 11, marginRight: 4 }}>
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const remark = window.prompt("Reason for rejection:", "");
                        if (remark !== null) onDecision(l.id, "Rejected", remark);
                      }}
                      style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 700, fontSize: 11 }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── My Leave Applications Table ── */
function MyLeaveTable({ myLeaves, onApply }) {
  const statusColor = { Approved: "#16a34a", Rejected: "#c0291d", Pending: "#d4a853" };
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>📋 My Leave Applications</span>
        <button onClick={onApply} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          + Apply for Leave
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8faff" }}>
              {["Type", "From", "To", "Days", "Status", "Remark"].map((h) => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {myLeaves.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No leave applications yet</td></tr>
            ) : myLeaves.map((l) => (
              <tr key={l.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 14px", fontSize: 13 }}>{l.type}</td>
                <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{l.from}</td>
                <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{l.to}</td>
                <td style={{ padding: "10px 14px", fontSize: 13 }}>{daysBetween(l.from, l.to)} day{daysBetween(l.from, l.to) > 1 ? "s" : ""}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge label={l.status} color={statusColor[l.status] || "#64748b"} />
                </td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>{l.remark || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Substitute Tab ── */
function SubstituteTab({ currentUser, staff, subs, onAddSub, onDeleteSub }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: today(), absentId: "", subId: "", period: "", note: "" });
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";
  const teachers = staff.filter((s) => s.dept === "Teaching" || (s.role || "").toLowerCase().includes("teacher"));
  const todaySubs = subs.filter((s) => s.date === today());
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAdd = () => {
    const abMem = staff.find((s) => String(s.id) === String(form.absentId)) || { name: "?" };
    const subMem = staff.find((s) => String(s.id) === String(form.subId)) || { name: "?" };
    onAddSub({ id: Date.now(), date: form.date, absentId: form.absentId, absentName: abMem.name, subId: form.subId, subName: subMem.name, period: form.period, note: form.note });
    setShowForm(false);
    setForm({ date: today(), absentId: "", subId: "", period: "", note: "" });
  };

  return (
    <div>
      {showForm && isAdmin && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1433a8", marginBottom: 14 }}>Assign Substitute</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Date *"><input style={inputStyle} type="date" value={form.date} onChange={set("date")} /></FormGroup>
            <FormGroup label="Absent Teacher *">
              <select style={selectStyle} value={form.absentId} onChange={set("absentId")}>
                <option value="">-- Select --</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Substitute Teacher *">
              <select style={selectStyle} value={form.subId} onChange={set("subId")}>
                <option value="">-- Select --</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Period / Subject"><input style={inputStyle} value={form.period} onChange={set("period")} placeholder="e.g. Period 3 — Mathematics" /></FormGroup>
            <FormGroup label="Note"><input style={inputStyle} value={form.note} onChange={set("note")} placeholder="Optional note" /></FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleAdd} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Assign</button>
            <button onClick={() => setShowForm(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>📋 Substitute Assignments — {today()}</span>
          {isAdmin && (
            <button onClick={() => setShowForm(!showForm)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              + Assign Substitute
            </button>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8faff" }}>
                {["Absent Teacher", "Substitute", "Period / Subject", "Note", ...(isAdmin ? [""] : [])].map((h) => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todaySubs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No substitutes assigned for today</td></tr>
              ) : todaySubs.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{s.absentName}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{s.subName}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{s.period || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>{s.note || "—"}</td>
                  {isAdmin && (
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => onDeleteSub(s.id)} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Main LeaveModule ── */
export default function LeaveModule({ currentUser, staff = [], leaves = [], subs = [], onLeavesChange, onSubsChange, showToast }) {
  const [tab, setTab] = useState("leave");
  const [showForm, setShowForm] = useState(false);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";
  const myLeaves = leaves.filter((l) => l.staffId === currentUser?.id);

  const handleSubmitLeave = (form) => {
    const newLeave = { id: Date.now(), staffId: currentUser.id, staffName: currentUser.name, ...form, status: "Pending", appliedAt: new Date().toISOString(), remark: "" };
    onLeavesChange([...leaves, newLeave]);
    setShowForm(false);
    showToast?.("Leave application submitted", "#d4a853");
  };

  const handleDecision = (id, status, remark) => {
    onLeavesChange(leaves.map((l) => l.id === id ? { ...l, status, remark, decidedAt: new Date().toISOString(), decidedBy: currentUser.name } : l));
    showToast?.(`Leave ${status.toLowerCase()}`, "#16a34a");
  };

  const tabs = [{ id: "leave", label: "📋 Leave" }, { id: "substitute", label: "🔄 Substitute" }];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 18px", borderRadius: 9, border: tab === t.id ? "none" : "1.5px solid #e2e8f0", background: tab === t.id ? "linear-gradient(135deg,#1433a8,#1b44cc)" : "#fff", color: tab === t.id ? "#fff" : "#64748b", fontWeight: tab === t.id ? 700 : 600, fontSize: 13, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "leave" && (
        <>
          {isAdmin && <PendingApprovals leaves={leaves} staff={staff} onDecision={handleDecision} />}
          <LeaveBalances myLeaves={myLeaves} />
          {showForm && <LeaveForm onSubmit={handleSubmitLeave} onCancel={() => setShowForm(false)} />}
          <MyLeaveTable myLeaves={myLeaves} onApply={() => setShowForm(!showForm)} />
        </>
      )}

      {tab === "substitute" && (
        <SubstituteTab
          currentUser={currentUser}
          staff={staff}
          subs={subs}
          onAddSub={(sub) => { onSubsChange([...subs, sub]); showToast?.("Substitute assigned", "#16a34a"); }}
          onDeleteSub={(id) => onSubsChange(subs.filter((s) => s.id !== id))}
        />
      )}
    </div>
  );
}
