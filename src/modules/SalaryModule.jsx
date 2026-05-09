/**
 * GNSI PORTAL — SalaryModule.jsx
 * Pages: Duty Hours, Period Salary, Staff Salary, Advances
 * Original: modules/salary.js
 */

import { useState } from "react";

/* ── Helpers ── */
const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9,
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#f8faff", boxSizing: "border-box",
};

const today = () => new Date().toISOString().split("T")[0];

function FormGroup({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${color}22`, borderLeft: `4px solid ${color}`, padding: "16px 20px" }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'Cormorant Garamond',serif" }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#0a1229", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

function Badge({ label, color }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{label}</span>;
}

const SHIFT_COLORS = { "Morning Shift": "#d4a853", "Evening Shift": "#3b78c9", "Night Shift": "#8b5cf6", "Full Shift": "#1a6b55" };
const DEPT_COLORS = { Administration: "#1433a8", Teaching: "#16a34a", Hostel: "#3b78c9", IT: "#0891b2", Support: "#78716c" };

/* ── Duty Hours Tab ── */
function DutyHoursTab({ data, currentUser, onChange, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ post: "", staff: "", shift: "Full Shift", from: "", to: "", color: "#1a6b55" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  const handleSave = () => {
    if (!form.post || !form.staff) { showToast?.("Post and Staff required", "#dc2626"); return; }
    onChange([...data, { id: Date.now(), ...form }]);
    setShow(false);
    setForm({ post: "", staff: "", shift: "Full Shift", from: "", to: "", color: "#1a6b55" });
    showToast?.("Duty entry added", "#16a34a");
  };

  const shiftCounts = Object.fromEntries(Object.keys(SHIFT_COLORS).map((k) => [k, data.filter((d) => d.shift === k).length]));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 16 }}>
        {Object.entries(shiftCounts).map(([shift, count]) => (
          <StatCard key={shift} label={shift} value={count} icon="🕐" color={SHIFT_COLORS[shift]} />
        ))}
      </div>

      {show && isAdmin && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1433a8", marginBottom: 14 }}>➕ Add New Duty Entry</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Post / Role *"><input style={inputStyle} value={form.post} onChange={set("post")} placeholder="e.g. Guard, Cook..." /></FormGroup>
            <FormGroup label="Staff Name(s) *"><input style={inputStyle} value={form.staff} onChange={set("staff")} placeholder="Name1, Name2..." /></FormGroup>
            <FormGroup label="Shift"><select style={inputStyle} value={form.shift} onChange={set("shift")}>{Object.keys(SHIFT_COLORS).map((s) => <option key={s}>{s}</option>)}</select></FormGroup>
            <FormGroup label="From"><input style={inputStyle} value={form.from} onChange={set("from")} placeholder="e.g. 07:00 AM" /></FormGroup>
            <FormGroup label="To"><input style={inputStyle} value={form.to} onChange={set("to")} placeholder="e.g. 11:00 AM" /></FormGroup>
            <FormGroup label="Color">
              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                {["#1a6b55", "#0891b2", "#dc2626", "#d4a853", "#8b5cf6", "#78716c"].map((c) => (
                  <div key={c} onClick={() => setForm((f) => ({ ...f, color: c }))} style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: "pointer", border: form.color === c ? "3px solid #0a1229" : "3px solid transparent" }} />
                ))}
              </div>
            </FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save Entry</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>🕐 Duty Roster</span>
          {isAdmin && <button onClick={() => setShow(!show)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Add Duty</button>}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8faff" }}>{["Post", "Staff", "Shift", "From", "To", ...(isAdmin ? [""] : [])].map((h) => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}</tr></thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No duty entries</td></tr>
              ) : data.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                      {d.post}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{d.staff}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge label={d.shift} color={SHIFT_COLORS[d.shift] || "#64748b"} />
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#64748b" }}>{d.from || "—"}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#64748b" }}>{d.to || "—"}</td>
                  {isAdmin && <td style={{ padding: "10px 14px" }}><button onClick={() => onChange(data.filter((x) => x.id !== d.id))} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Staff Salary Tab ── */
function StaffSalaryTab({ staff, salaryData, currentUser, onSalaryChange, showToast }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  const getStaffSalary = (staffId) => salaryData.find((s) => s.staffId === staffId && s.month === selectedMonth) || {};

  const handleUpdate = (staffId, field, value) => {
    const existing = salaryData.findIndex((s) => s.staffId === staffId && s.month === selectedMonth);
    const updated = existing >= 0
      ? salaryData.map((s, i) => i === existing ? { ...s, [field]: value } : s)
      : [...salaryData, { id: Date.now(), staffId, month: selectedMonth, [field]: value }];
    onSalaryChange(updated);
  };

  const totalPaid = salaryData.filter((s) => s.month === selectedMonth && s.status === "Paid").reduce((sum, s) => sum + (parseInt(s.basic) || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Month</label>
          <input style={{ ...inputStyle, width: 160 }} type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, flex: 1 }}>
          <StatCard label="Total Payroll" value={`₹${totalPaid.toLocaleString("en-IN")}`} icon="💰" color="#16a34a" />
          <StatCard label="Staff Count" value={staff.length} icon="👥" color="#1433a8" />
          <StatCard label="Paid This Month" value={salaryData.filter((s) => s.month === selectedMonth && s.status === "Paid").length} icon="✅" color="#d4a853" />
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>💰 Staff Salary — {selectedMonth}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8faff" }}>{["Name", "Role", "Basic (₹)", "Allowances (₹)", "Deductions (₹)", "Net (₹)", "Status", "Action"].map((h) => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>
              {staff.filter((s) => s.status !== "Inactive").map((s) => {
                const sal = getStaffSalary(s.id);
                const basic = parseInt(sal.basic) || 0;
                const allow = parseInt(sal.allowances) || 0;
                const ded = parseInt(sal.deductions) || 0;
                const net = basic + allow - ded;
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{s.name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{s.role}</td>
                    {isAdmin ? (
                      <>
                        <td style={{ padding: "6px 8px" }}><input style={{ ...inputStyle, width: 100, padding: "6px 8px", fontFamily: "'JetBrains Mono',monospace" }} type="number" value={sal.basic || ""} onChange={(e) => handleUpdate(s.id, "basic", e.target.value)} placeholder="0" /></td>
                        <td style={{ padding: "6px 8px" }}><input style={{ ...inputStyle, width: 100, padding: "6px 8px", fontFamily: "'JetBrains Mono',monospace" }} type="number" value={sal.allowances || ""} onChange={(e) => handleUpdate(s.id, "allowances", e.target.value)} placeholder="0" /></td>
                        <td style={{ padding: "6px 8px" }}><input style={{ ...inputStyle, width: 100, padding: "6px 8px", fontFamily: "'JetBrains Mono',monospace" }} type="number" value={sal.deductions || ""} onChange={(e) => handleUpdate(s.id, "deductions", e.target.value)} placeholder="0" /></td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace" }}>{basic ? `₹${basic.toLocaleString("en-IN")}` : "—"}</td>
                        <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace" }}>{allow ? `₹${allow.toLocaleString("en-IN")}` : "—"}</td>
                        <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace" }}>{ded ? `₹${ded.toLocaleString("en-IN")}` : "—"}</td>
                      </>
                    )}
                    <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: net > 0 ? "#16a34a" : "#94a3b8" }}>{net > 0 ? `₹${net.toLocaleString("en-IN")}` : "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <Badge label={sal.status || "Pending"} color={sal.status === "Paid" ? "#16a34a" : "#d4a853"} />
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "6px 8px" }}>
                        <button onClick={() => { handleUpdate(s.id, "status", sal.status === "Paid" ? "Pending" : "Paid"); showToast?.("Status updated", "#16a34a"); }} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: sal.status === "Paid" ? "#fef2f2" : "#f0fdf4", color: sal.status === "Paid" ? "#dc2626" : "#16a34a", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                          {sal.status === "Paid" ? "Unmark" : "Mark Paid"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Advances Tab ── */
function AdvancesTab({ advances, staff, currentUser, onAdvancesChange, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ staffId: "", amount: "", reason: "", date: today(), repayBy: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  const handleSave = () => {
    if (!form.staffId || !form.amount) { showToast?.("Staff and amount required", "#dc2626"); return; }
    const member = staff.find((s) => String(s.id) === String(form.staffId)) || { name: "?" };
    onAdvancesChange([{ id: Date.now(), staffName: member.name, ...form, status: "Pending" }, ...advances]);
    setShow(false);
    showToast?.("Advance recorded", "#16a34a");
  };

  const total = advances.filter((a) => a.status === "Pending").reduce((s, a) => s + (parseInt(a.amount) || 0), 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 16 }}>
        <StatCard label="Total Outstanding" value={`₹${total.toLocaleString("en-IN")}`} icon="💸" color="#dc2626" />
        <StatCard label="Advance Records" value={advances.length} icon="📋" color="#d4a853" />
      </div>

      {show && isAdmin && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#d4a853", marginBottom: 14 }}>💸 Record Advance</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Staff Member *">
              <select style={inputStyle} value={form.staffId} onChange={set("staffId")}>
                <option value="">-- Select Staff --</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Amount (₹) *"><input style={inputStyle} type="number" value={form.amount} onChange={set("amount")} placeholder="Amount" /></FormGroup>
            <FormGroup label="Date"><input style={inputStyle} type="date" value={form.date} onChange={set("date")} /></FormGroup>
            <FormGroup label="Repay By"><input style={inputStyle} type="date" value={form.repayBy} onChange={set("repayBy")} /></FormGroup>
            <FormGroup label="Reason">
              <input style={inputStyle} value={form.reason} onChange={set("reason")} placeholder="Reason for advance" />
            </FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "#d4a853", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Record Advance</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>💸 Advance Records</span>
          {isAdmin && <button onClick={() => setShow(!show)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#d4a853", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Record Advance</button>}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8faff" }}>{["Date", "Staff", "Amount", "Reason", "Repay By", "Status", ...(isAdmin ? ["Action"] : [])].map((h) => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}</tr></thead>
            <tbody>
              {advances.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No advance records</td></tr>
              ) : advances.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{a.date}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{a.staffName}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#dc2626" }}>₹{parseInt(a.amount).toLocaleString("en-IN")}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{a.reason || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{a.repayBy || "—"}</td>
                  <td style={{ padding: "10px 14px" }}><Badge label={a.status || "Pending"} color={a.status === "Repaid" ? "#16a34a" : "#d4a853"} /></td>
                  {isAdmin && (
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => onAdvancesChange(advances.map((x) => x.id === a.id ? { ...x, status: x.status === "Repaid" ? "Pending" : "Repaid" } : x))} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: a.status === "Repaid" ? "#fef2f2" : "#f0fdf4", color: a.status === "Repaid" ? "#dc2626" : "#16a34a", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                        {a.status === "Repaid" ? "Unmark" : "Mark Repaid"}
                      </button>
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

/* ── Main SalaryModule ── */
export default function SalaryModule({ currentUser, staff = [], salaryData = [], advances = [], dutyData = [], onSalaryChange, onAdvancesChange, onDutyChange, showToast }) {
  const [tab, setTab] = useState("salary");

  const TABS = [
    { id: "salary", label: "💰 Staff Salary" },
    { id: "dutyhours", label: "🕐 Duty Hours" },
    { id: "advances", label: "💸 Advances" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 18px", borderRadius: 9, border: tab === t.id ? "none" : "1.5px solid #e2e8f0", background: tab === t.id ? "linear-gradient(135deg,#1433a8,#1b44cc)" : "#fff", color: tab === t.id ? "#fff" : "#64748b", fontWeight: tab === t.id ? 700 : 600, fontSize: 13, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "salary" && <StaffSalaryTab staff={staff} salaryData={salaryData} currentUser={currentUser} onSalaryChange={onSalaryChange} showToast={showToast} />}
      {tab === "dutyhours" && <DutyHoursTab data={dutyData} currentUser={currentUser} onChange={onDutyChange} showToast={showToast} />}
      {tab === "advances" && <AdvancesTab advances={advances} staff={staff} currentUser={currentUser} onAdvancesChange={onAdvancesChange} showToast={showToast} />}
    </div>
  );
}
