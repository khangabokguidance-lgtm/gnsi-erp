/**
 * GNSI PORTAL — HRModule.jsx
 * Pages: Appraisal, Grievance
 * Original: modules/hr.js
 */

import { useState } from "react";

/* ── Helpers ── */
const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9,
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#f8faff", boxSizing: "border-box",
};
const RATE_OPTIONS = ["", "5 — Outstanding", "4 — Good", "3 — Average", "2 — Below Average", "1 — Poor"];

function FormGroup({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Badge({ label, color }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{label}</span>;
}

function Avatar({ name, size = 36 }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#1433a8", "#7c3aed", "#16a34a", "#0891b2", "#d4a853"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
      {initials}
    </div>
  );
}

/* ── Appraisal Form ── */
function AppraisalForm({ member, existing = {}, year, onSave, onBack }) {
  const [form, setForm] = useState({
    teach: existing.teach || "",
    discp: existing.discp || "",
    duty: existing.duty || "",
    punct: existing.punct || "",
    team: existing.team || "",
    remarks: existing.remarks || "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const FIELDS = [
    { key: "teach", label: "Teaching Quality" },
    { key: "discp", label: "Discipline & Conduct" },
    { key: "duty", label: "Duty Compliance" },
    { key: "punct", label: "Punctuality" },
    { key: "team", label: "Team Work" },
  ];

  const avgScore = (() => {
    const vals = FIELDS.map((f) => parseInt(form[f.key])).filter(Boolean);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  })();

  const scoreColor = avgScore >= 4 ? "#16a34a" : avgScore >= 3 ? "#d4a853" : "#dc2626";

  return (
    <div>
      <button onClick={onBack} style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b", marginBottom: 16 }}>
        ← Back
      </button>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8edfa", display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={member.name} size={40} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>📊 Appraisal — {member.name}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{member.role} · Year {year}</div>
          </div>
          {avgScore && (
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, fontFamily: "'Cormorant Garamond',serif" }}>{avgScore}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>avg score</div>
            </div>
          )}
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            {FIELDS.map((f) => (
              <FormGroup key={f.key} label={f.label}>
                <select style={inputStyle} value={form[f.key]} onChange={set(f.key)}>
                  {RATE_OPTIONS.map((o) => <option key={o} value={o ? o[0] : ""}>{o || "-- Rate --"}</option>)}
                </select>
              </FormGroup>
            ))}
            <div style={{ gridColumn: "1/-1" }}>
              <FormGroup label="Remarks / Observations">
                <textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} value={form.remarks} onChange={set("remarks")} placeholder="Enter observations..." />
              </FormGroup>
            </div>
          </div>
          <button onClick={() => onSave({ staffId: member.id, year, ...form })} style={{ marginTop: 16, padding: "10px 28px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Save Appraisal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Appraisal List ── */
function AppraisalList({ staff, appraisals, year, onSelect }) {
  const scoreColor = (avg) => avg >= 4 ? "#16a34a" : avg >= 3 ? "#d4a853" : "#dc2626";
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa" }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>📊 Staff Appraisals — {year}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8faff" }}>
              {["Name", "Role", "Teaching", "Discipline", "Duty", "Punctuality", "Teamwork", "Avg", "Action"].map((h) => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.filter((s) => s.status !== "Inactive").map((s) => {
              const ap = appraisals.find((a) => a.staffId === s.id && a.year === year) || {};
              const vals = [ap.teach, ap.discp, ap.duty, ap.punct, ap.team].map(Number).filter(Boolean);
              const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
              const cell = (v) => v ? <span style={{ fontWeight: 700, color: scoreColor(v) }}>{v}</span> : <span style={{ color: "#cbd5e1" }}>—</span>;
              return (
                <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={s.name} size={30} />
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{s.role}</td>
                  <td style={{ padding: "10px 14px" }}>{cell(ap.teach)}</td>
                  <td style={{ padding: "10px 14px" }}>{cell(ap.discp)}</td>
                  <td style={{ padding: "10px 14px" }}>{cell(ap.duty)}</td>
                  <td style={{ padding: "10px 14px" }}>{cell(ap.punct)}</td>
                  <td style={{ padding: "10px 14px" }}>{cell(ap.team)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {avg ? <span style={{ fontWeight: 800, color: scoreColor(avg), fontFamily: "'JetBrains Mono',monospace" }}>{avg}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => onSelect(s)} style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: ap.teach ? "#f0fdf4" : "#eff6ff", color: ap.teach ? "#16a34a" : "#1433a8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {ap.teach ? "✏️ Edit" : "+ Appraise"}
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

/* ── Grievance Tab ── */
function GrievanceTab({ currentUser, grievances, onGrievancesChange, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "Academic", description: "", anonymous: false });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  const STATUS_COLORS = { Open: "#dc2626", "In Progress": "#d4a853", Resolved: "#16a34a", Closed: "#64748b" };

  const handleSubmit = () => {
    if (!form.subject.trim() || !form.description.trim()) { showToast?.("Subject and description required", "#dc2626"); return; }
    onGrievancesChange([{ id: Date.now(), ...form, submittedBy: form.anonymous ? "Anonymous" : currentUser.name, staffId: form.anonymous ? null : currentUser.id, status: "Open", date: new Date().toISOString().split("T")[0], response: "" }, ...grievances]);
    setShow(false);
    setForm({ subject: "", category: "Academic", description: "", anonymous: false });
    showToast?.("Grievance submitted", "#16a34a");
  };

  const updateStatus = (id, status) => {
    onGrievancesChange(grievances.map((g) => g.id === id ? { ...g, status } : g));
  };

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#dc2626", marginBottom: 14 }}>📝 Submit Grievance</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <FormGroup label="Subject *"><input style={inputStyle} value={form.subject} onChange={set("subject")} placeholder="Brief subject" /></FormGroup>
            </div>
            <FormGroup label="Category">
              <select style={inputStyle} value={form.category} onChange={set("category")}>
                {["Academic", "Salary", "Infrastructure", "Conduct", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormGroup>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 24 }}>
              <input type="checkbox" id="grv-anon" checked={form.anonymous} onChange={set("anonymous")} />
              <label htmlFor="grv-anon" style={{ fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>Submit anonymously</label>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <FormGroup label="Description *">
                <textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} value={form.description} onChange={set("description")} placeholder="Detailed description of the grievance..." />
              </FormGroup>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleSubmit} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Submit</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>🗂 Grievances</span>
          <button onClick={() => setShow(!show)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Submit Grievance</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8faff" }}>
                {["Date", "Submitted By", "Category", "Subject", "Status", ...(isAdmin ? ["Action"] : [])].map((h) => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grievances.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No grievances submitted</td></tr>
              ) : grievances.map((g) => (
                <tr key={g.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{g.date}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{g.submittedBy}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{g.category}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, maxWidth: 200 }}>{g.subject}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge label={g.status} color={STATUS_COLORS[g.status] || "#64748b"} />
                  </td>
                  {isAdmin && (
                    <td style={{ padding: "10px 14px" }}>
                      <select style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "4px 8px" }} value={g.status} onChange={(e) => updateStatus(g.id, e.target.value)}>
                        {Object.keys(STATUS_COLORS).map((s) => <option key={s}>{s}</option>)}
                      </select>
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

/* ── Main HRModule ── */
export default function HRModule({ currentUser, staff = [], appraisals = [], grievances = [], onAppraisalsChange, onGrievancesChange, showToast }) {
  const [tab, setTab] = useState("appraisal");
  const [selectedMember, setSelectedMember] = useState(null);
  const year = new Date().getFullYear();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  const handleSaveAppraisal = (data) => {
    const existing = appraisals.findIndex((a) => a.staffId === data.staffId && a.year === data.year);
    if (existing >= 0) {
      onAppraisalsChange(appraisals.map((a, i) => i === existing ? { ...a, ...data } : a));
    } else {
      onAppraisalsChange([...appraisals, { id: Date.now(), ...data }]);
    }
    setSelectedMember(null);
    showToast?.("Appraisal saved", "#16a34a");
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[{ id: "appraisal", label: "📊 Appraisal" }, { id: "grievance", label: "📝 Grievance" }].map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelectedMember(null); }} style={{ padding: "8px 18px", borderRadius: 9, border: tab === t.id ? "none" : "1.5px solid #e2e8f0", background: tab === t.id ? "linear-gradient(135deg,#1433a8,#1b44cc)" : "#fff", color: tab === t.id ? "#fff" : "#64748b", fontWeight: tab === t.id ? 700 : 600, fontSize: 13, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "appraisal" && (
        selectedMember ? (
          <AppraisalForm
            member={selectedMember}
            existing={appraisals.find((a) => a.staffId === selectedMember.id && a.year === year)}
            year={year}
            onSave={handleSaveAppraisal}
            onBack={() => setSelectedMember(null)}
          />
        ) : (
          <AppraisalList staff={staff} appraisals={appraisals} year={year} onSelect={isAdmin ? setSelectedMember : null} />
        )
      )}

      {tab === "grievance" && (
        <GrievanceTab currentUser={currentUser} grievances={grievances} onGrievancesChange={onGrievancesChange} showToast={showToast} />
      )}
    </div>
  );
}
