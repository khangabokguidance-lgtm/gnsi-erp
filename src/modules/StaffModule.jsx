/**
 * GNSI PORTAL — StaffModule.jsx
 * Pages: Staff Directory, Staff Biodata
 * Original: modules/staff.js
 */

import { useState, useEffect, useCallback } from "react";

/* ── Constants ── */
const DEPT_COLORS = {
  "Concern Teacher": "#16a34a",
  "Hostel Staff": "#3b78c9",
  "IT & Counter Staff": "#0891b2",
  "Non-Teaching Staff": "#6474a0",
  "Administration": "#1433a8",
};

const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  teacher: "Teacher",
  accounts: "Accounts",
  hostel: "Hostel",
  it: "IT Staff",
  housemaster: "Housemaster",
  reception: "Reception",
  staff: "Staff",
};

const ROLE_COLORS = {
  admin: "#1433a8",
  manager: "#7c3aed",
  accounts: "#d4a853",
  teacher: "#16a34a",
  hostel: "#3b78c9",
  it: "#0891b2",
  housemaster: "#9d174d",
  reception: "#0e7490",
  staff: "#6474a0",
};

/* ── Helpers ── */
function Avatar({ name, size = 36 }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colors = ["#1433a8", "#7c3aed", "#16a34a", "#0891b2", "#d4a853", "#dc2626"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 800,
        fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}55`,
        borderRadius: 6,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function FormGroup({ label, children, span }) {
  return (
    <div style={{ gridColumn: span ? "1/-1" : undefined }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 700,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
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
  outline: "none",
  transition: "border-color 0.15s",
};

/* ── Add/Edit Staff Modal ── */
function StaffModal({ staff, onSave, onClose }) {
  const isEdit = !!staff;
  const [form, setForm] = useState({
    name: staff?.name || "",
    role: staff?.role || "",
    dept: staff?.dept || Object.keys(DEPT_COLORS)[0],
    phone: staff?.phone || "",
    email: staff?.email || "",
    status: staff?.status || "Active",
    sysRole: staff?.sysRole || "teacher",
    username: staff?.username || "",
    password: "",
  });
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const autoUsername = (name) => {
    return name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z.]/g, "");
  };

  useEffect(() => {
    if (!isEdit && form.name) {
      setForm((f) => ({ ...f, username: autoUsername(form.name) }));
    }
  }, [form.name, isEdit]);

  const handleSave = () => {
    if (!form.name.trim() || !form.role.trim()) {
      setError("Name and Role are required.");
      return;
    }
    setError("");
    onSave({ ...form, id: staff?.id });
    onClose();
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,18,41,0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg,#1433a8,#1b44cc)",
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            👤
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
              {isEdit ? "Edit Staff Member" : "Add New Staff Member"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", marginTop: 2 }}>
              {isEdit ? "Update details and sync" : "Login credentials are created automatically and synced"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Section 1 */}
          <div style={{ fontSize: 10, fontWeight: 800, color: "#1433a8", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 12, paddingBottom: 6, borderBottom: "2px solid #e8edfa" }}>
            📋 Basic Information
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <FormGroup label="Full Name *" span>
              <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Full name" />
            </FormGroup>
            <FormGroup label="Role / Designation *">
              <input style={inputStyle} value={form.role} onChange={set("role")} placeholder="e.g. Concern Teacher" />
            </FormGroup>
            <FormGroup label="Department">
              <select style={inputStyle} value={form.dept} onChange={set("dept")}>
                {Object.keys(DEPT_COLORS).map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Phone">
              <input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="10-digit number" />
            </FormGroup>
            <FormGroup label="Email">
              <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="email@domain.com" />
            </FormGroup>
            <FormGroup label="Status">
              <select style={inputStyle} value={form.status} onChange={set("status")}>
                {["Active", "On Leave", "Inactive"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </FormGroup>
          </div>

          {/* Section 2 — credentials (only for new) */}
          {!isEdit && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 12, paddingBottom: 6, borderBottom: "2px solid #ede9fe" }}>
                🔐 System Role & Login Credentials
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <FormGroup label="System Role *">
                  <select style={{ ...inputStyle, borderColor: "#c4b5fd" }} value={form.sysRole} onChange={set("sysRole")}>
                    {Object.entries(ROLE_LABELS).filter(([k]) => k !== "admin").map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </FormGroup>
                <FormGroup label="Login Username *">
                  <input style={{ ...inputStyle, borderColor: "#a5f3fc", fontFamily: "'JetBrains Mono',monospace" }} value={form.username} onChange={set("username")} placeholder="auto.filled" />
                </FormGroup>
                <FormGroup label="Default Password" span>
                  <input style={{ ...inputStyle, borderColor: "#fde68a", fontFamily: "'JetBrains Mono',monospace" }} type="password" value={form.password} onChange={set("password")} placeholder="Min 8 chars, upper, lower, number" />
                </FormGroup>
              </div>
            </>
          )}

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "9px 13px", fontSize: 13, color: "#dc2626", fontWeight: 600, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "10px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#64748b" }}>
              Cancel
            </button>
            <button onClick={handleSave} style={{ padding: "10px 28px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(20,51,168,0.35)" }}>
              💾 {isEdit ? "Save Changes" : "Save Staff & Create Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main StaffModule ── */
export default function StaffModule({ currentUser, staff = [], onStaffChange, showToast }) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [modal, setModal] = useState(null); // null | 'add' | staffObj

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";
  const canDel = isAdmin;

  const filtered = staff.filter((s) => {
    const deptMatch = dept === "All" || s.dept === dept;
    const searchMatch = s.name.toLowerCase().includes(search.toLowerCase());
    return deptMatch && searchMatch;
  });

  const handleSave = (data) => {
    if (data.id) {
      onStaffChange(staff.map((s) => (s.id === data.id ? { ...s, ...data } : s)));
      showToast?.("Staff updated", "#16a34a");
    } else {
      onStaffChange([...staff, { ...data, id: Date.now() }]);
      showToast?.("Staff added", "#16a34a");
    }
  };

  const handleRemove = (id) => {
    if (!window.confirm("Remove this staff member?")) return;
    onStaffChange(staff.filter((s) => s.id !== id));
    showToast?.("Staff removed", "#64748b");
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 15 }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff..."
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 160 }}>
          {["All", ...Object.keys(DEPT_COLORS)].map((d) => <option key={d}>{d}</option>)}
        </select>
        {isAdmin && (
          <button
            onClick={() => setModal("add")}
            style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + Add Staff
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden", boxShadow: "0 2px 16px rgba(20,51,168,0.07)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: "#0a1229" }}>Staff Directory</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#94a3b8" }}>
            {filtered.length} of {staff.length}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8faff" }}>
                {["Name", "Role", "Department", "Phone", "Status", "Action"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No staff found.</td>
                </tr>
              ) : filtered.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={s.name} size={34} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>ID #{s.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>{s.role}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge label={s.dept} color={DEPT_COLORS[s.dept] || "#6474a0"} />
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#94a3b8" }}>
                    {s.phone ? s.phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3") : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge label={s.status} color={s.status === "Active" ? "#16a34a" : s.status === "On Leave" ? "#d4a853" : "#dc2626"} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {isAdmin && (
                        <button onClick={() => setModal(s)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#eff6ff", color: "#1433a8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          ✏️ Edit
                        </button>
                      )}
                      {canDel && (
                        <button onClick={() => handleRemove(s.id)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          🗑 Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {(modal === "add" || (modal && typeof modal === "object")) && (
        <StaffModal
          staff={modal === "add" ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
