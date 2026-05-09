/**
 * GNSI PORTAL — ReceptionModule.jsx
 * Pages: Visitors, Phone Log, Enquiries, Appointments, Parcels, Items, Daily Summary
 * Original: modules/reception.js
 */

import { useState } from "react";

/* ── Helpers ── */
const today = () => new Date().toISOString().split("T")[0];
const nowTime = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9,
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#f8faff", boxSizing: "border-box",
};

function FormGroup({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Card({ title, children, action }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function DataTable({ cols, rows, emptyMsg }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8faff" }}>
            {cols.map((c) => (
              <th key={c} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>{emptyMsg}</td></tr>
          ) : rows}
        </tbody>
      </table>
    </div>
  );
}

function AddBtn({ onClick, label }) {
  return (
    <button onClick={onClick} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
      {label}
    </button>
  );
}

/* ── Visitor Log ── */
function VisitorsTab({ data, isAdmin, onChange, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", purpose: "", phone: "", host: "", badge: "", date: today(), inTime: nowTime(), outTime: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAdd = () => {
    if (!form.name || !form.purpose) { showToast?.("Name & Purpose required", "#dc2626"); return; }
    onChange([{ id: Date.now(), ...form }, ...data]);
    setShow(false);
    setForm({ name: "", purpose: "", phone: "", host: "", badge: "", date: today(), inTime: nowTime(), outTime: "" });
    showToast?.("Visitor logged", "#16a34a");
  };

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1433a8", marginBottom: 14 }}>Log New Visitor</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Visitor Name *"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Full Name" /></FormGroup>
            <FormGroup label="Purpose *"><input style={inputStyle} value={form.purpose} onChange={set("purpose")} placeholder="Purpose of visit" /></FormGroup>
            <FormGroup label="Phone"><input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="Contact number" /></FormGroup>
            <FormGroup label="Meeting With"><input style={inputStyle} value={form.host} onChange={set("host")} placeholder="Staff / Department" /></FormGroup>
            <FormGroup label="Badge No"><input style={inputStyle} value={form.badge} onChange={set("badge")} placeholder="Badge #" /></FormGroup>
            <FormGroup label="In Time"><input style={inputStyle} value={form.inTime} onChange={set("inTime")} placeholder="HH:MM" /></FormGroup>
            <FormGroup label="Out Time"><input style={inputStyle} value={form.outTime} onChange={set("outTime")} placeholder="HH:MM (on exit)" /></FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleAdd} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Log Visitor</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}
      <Card title={`👥 Visitor Log — ${today()}`} action={<AddBtn onClick={() => setShow(!show)} label="+ Log Visitor" />}>
        <DataTable
          cols={["Name", "Purpose", "Phone", "Host", "Badge", "In", "Out", ""]}
          emptyMsg="No visitors logged today"
          rows={data.map((v) => (
            <tr key={v.id} style={{ borderTop: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{v.name}</td>
              <td style={{ padding: "10px 14px", fontSize: 13, color: "#64748b" }}>{v.purpose}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{v.phone || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{v.host || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{v.badge || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{v.inTime}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: v.outTime ? "#16a34a" : "#d4a853" }}>{v.outTime || "In"}</td>
              {isAdmin && <td style={{ padding: "10px 14px" }}><button onClick={() => onChange(data.filter((x) => x.id !== v.id))} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✕</button></td>}
            </tr>
          ))}
        />
      </Card>
    </div>
  );
}

/* ── Phone Log ── */
function PhoneLogTab({ data, onChange, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ caller: "", number: "", purpose: "", direction: "Incoming", handledBy: "", date: today(), time: nowTime() });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAdd = () => {
    if (!form.caller) { showToast?.("Caller name required", "#dc2626"); return; }
    onChange([{ id: Date.now(), ...form }, ...data]);
    setShow(false);
    setForm({ caller: "", number: "", purpose: "", direction: "Incoming", handledBy: "", date: today(), time: nowTime() });
    showToast?.("Call logged", "#16a34a");
  };

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1433a8", marginBottom: 14 }}>Log Phone Call</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Caller Name *"><input style={inputStyle} value={form.caller} onChange={set("caller")} placeholder="Name" /></FormGroup>
            <FormGroup label="Phone Number"><input style={inputStyle} value={form.number} onChange={set("number")} placeholder="Number" /></FormGroup>
            <FormGroup label="Direction">
              <select style={inputStyle} value={form.direction} onChange={set("direction")}><option>Incoming</option><option>Outgoing</option></select>
            </FormGroup>
            <FormGroup label="Purpose"><input style={inputStyle} value={form.purpose} onChange={set("purpose")} placeholder="Reason for call" /></FormGroup>
            <FormGroup label="Handled By"><input style={inputStyle} value={form.handledBy} onChange={set("handledBy")} placeholder="Staff name" /></FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleAdd} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Log Call</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}
      <Card title="📞 Phone Log" action={<AddBtn onClick={() => setShow(!show)} label="+ Log Call" />}>
        <DataTable
          cols={["Time", "Caller", "Number", "Direction", "Purpose", "Handled By"]}
          emptyMsg="No calls logged today"
          rows={data.map((c) => (
            <tr key={c.id} style={{ borderTop: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{c.time}</td>
              <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{c.caller}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{c.number || "—"}</td>
              <td style={{ padding: "10px 14px" }}>
                <span style={{ background: c.direction === "Incoming" ? "#dcfce7" : "#dbeafe", color: c.direction === "Incoming" ? "#16a34a" : "#1d4ed8", borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{c.direction}</span>
              </td>
              <td style={{ padding: "10px 14px", fontSize: 13, color: "#64748b" }}>{c.purpose || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{c.handledBy || "—"}</td>
            </tr>
          ))}
        />
      </Card>
    </div>
  );
}

/* ── Enquiries ── */
function EnquiriesTab({ data, onChange, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ parentName: "", studentName: "", class: "", phone: "", email: "", source: "Walk-in", status: "New", notes: "", date: today() });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAdd = () => {
    if (!form.parentName) { showToast?.("Parent name required", "#dc2626"); return; }
    onChange([{ id: Date.now(), ...form }, ...data]);
    setShow(false);
    setForm({ parentName: "", studentName: "", class: "", phone: "", email: "", source: "Walk-in", status: "New", notes: "", date: today() });
    showToast?.("Enquiry logged", "#16a34a");
  };

  const STATUS_COLORS = { New: "#1d4ed8", "Follow-up": "#d4a853", Admitted: "#16a34a", Closed: "#64748b" };

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1433a8", marginBottom: 14 }}>New Enquiry</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Parent Name *"><input style={inputStyle} value={form.parentName} onChange={set("parentName")} placeholder="Parent/Guardian" /></FormGroup>
            <FormGroup label="Student Name"><input style={inputStyle} value={form.studentName} onChange={set("studentName")} placeholder="Child's name" /></FormGroup>
            <FormGroup label="Class Seeking"><input style={inputStyle} value={form.class} onChange={set("class")} placeholder="e.g. Class 6" /></FormGroup>
            <FormGroup label="Phone"><input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="Phone" /></FormGroup>
            <FormGroup label="Source">
              <select style={inputStyle} value={form.source} onChange={set("source")}>
                {["Walk-in", "Phone", "Online", "Referral", "Camp"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Status">
              <select style={inputStyle} value={form.status} onChange={set("status")}>
                {["New", "Follow-up", "Admitted", "Closed"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </FormGroup>
            <div style={{ gridColumn: "1/-1" }}>
              <FormGroup label="Notes"><input style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Additional notes" /></FormGroup>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleAdd} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save Enquiry</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}
      <Card title="❓ Enquiries" action={<AddBtn onClick={() => setShow(!show)} label="+ New Enquiry" />}>
        <DataTable
          cols={["Date", "Parent", "Student", "Class", "Phone", "Source", "Status"]}
          emptyMsg="No enquiries logged yet"
          rows={data.map((e) => (
            <tr key={e.id} style={{ borderTop: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{e.date}</td>
              <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{e.parentName}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{e.studentName || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{e.class || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{e.phone || "—"}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{e.source}</td>
              <td style={{ padding: "10px 14px" }}>
                <span style={{ background: (STATUS_COLORS[e.status] || "#64748b") + "22", color: STATUS_COLORS[e.status] || "#64748b", borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{e.status}</span>
              </td>
            </tr>
          ))}
        />
      </Card>
    </div>
  );
}

/* ── Daily Summary ── */
function DashboardTab({ visitors, phoneLogs, enquiries, appointments, parcels, items }) {
  const stats = [
    { label: "Visitors Today", value: visitors.filter((v) => v.date === today()).length, icon: "👥", color: "#1433a8" },
    { label: "Calls Today", value: phoneLogs.filter((c) => c.date === today()).length, icon: "📞", color: "#7c3aed" },
    { label: "New Enquiries", value: enquiries.filter((e) => e.status === "New").length, icon: "❓", color: "#d4a853" },
    { label: "Appointments", value: appointments.filter((a) => a.date === today()).length, icon: "📅", color: "#16a34a" },
    { label: "Pending Parcels", value: parcels.filter((p) => !p.collected).length, icon: "📦", color: "#dc2626" },
    { label: "Items Received", value: items.filter((i) => i.date === today()).length, icon: "🎒", color: "#0891b2" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${s.color}22`, borderLeft: `4px solid ${s.color}`, padding: "16px 18px" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'Cormorant Garamond',serif" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Simple generic tab for Appointments, Parcels, Items ── */
function SimpleTab({ title, icon, fields, data, onChange, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(Object.fromEntries(fields.map((f) => [f.key, f.default || ""])));
  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleAdd = () => {
    const required = fields.filter((f) => f.required);
    if (required.some((f) => !form[f.key])) { showToast?.(`${required[0].label} is required`, "#dc2626"); return; }
    onChange([{ id: Date.now(), date: today(), ...form }, ...data]);
    setShow(false);
    setForm(Object.fromEntries(fields.map((f) => [f.key, f.default || ""])));
    showToast?.(`${title} added`, "#16a34a");
  };

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1433a8", marginBottom: 14 }}>Add {title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            {fields.map((f) => (
              <FormGroup key={f.key} label={f.label + (f.required ? " *" : "")}>
                {f.type === "select" ? (
                  <select style={inputStyle} value={form[f.key]} onChange={set(f.key)}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
                ) : (
                  <input style={inputStyle} type={f.type || "text"} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder || ""} />
                )}
              </FormGroup>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleAdd} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}
      <Card title={`${icon} ${title}`} action={<AddBtn onClick={() => setShow(!show)} label={`+ Add ${title}`} />}>
        <DataTable
          cols={["Date", ...fields.map((f) => f.label), ""]}
          emptyMsg={`No ${title.toLowerCase()} records`}
          rows={data.map((d) => (
            <tr key={d.id} style={{ borderTop: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{d.date}</td>
              {fields.map((f) => (
                <td key={f.key} style={{ padding: "10px 14px", fontSize: 13, color: "#64748b" }}>{d[f.key] || "—"}</td>
              ))}
              <td style={{ padding: "10px 14px" }}>
                <button onClick={() => onChange(data.filter((x) => x.id !== d.id))} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✕</button>
              </td>
            </tr>
          ))}
        />
      </Card>
    </div>
  );
}

/* ── Main ReceptionModule ── */
export default function ReceptionModule({ currentUser, receptionData = {}, onDataChange, showToast }) {
  const [tab, setTab] = useState("visitors");
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  const { visitors = [], phoneLogs = [], enquiries = [], appointments = [], parcels = [], items = [] } = receptionData;
  const update = (key) => (val) => onDataChange({ ...receptionData, [key]: val });

  const TABS = [
    { id: "visitors", label: "Visitor Log", icon: "👥" },
    { id: "phonelog", label: "Phone Log", icon: "📞" },
    { id: "enquiries", label: "Enquiries", icon: "❓" },
    { id: "appointments", label: "Appointments", icon: "📅" },
    { id: "parcels", label: "Parcels", icon: "📦" },
    { id: "items", label: "Items", icon: "🎒" },
    { id: "rcdashboard", label: "Daily Summary", icon: "📊" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Front Desk</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0a1229" }}>Reception Management</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Visitors · Phone · Enquiries · Appointments · Parcels · Items · Daily Summary</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", borderRadius: 8, border: tab === t.id ? "none" : "1.5px solid #e2e8f0", cursor: "pointer", fontSize: 12.5, fontWeight: tab === t.id ? 700 : 600, background: tab === t.id ? "linear-gradient(135deg,#1433a8,#1b44cc)" : "#fff", color: tab === t.id ? "#fff" : "#64748b", whiteSpace: "nowrap" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "visitors" && <VisitorsTab data={visitors} isAdmin={isAdmin} onChange={update("visitors")} showToast={showToast} />}
      {tab === "phonelog" && <PhoneLogTab data={phoneLogs} onChange={update("phoneLogs")} showToast={showToast} />}
      {tab === "enquiries" && <EnquiriesTab data={enquiries} onChange={update("enquiries")} showToast={showToast} />}
      {tab === "appointments" && (
        <SimpleTab
          title="Appointment" icon="📅" data={appointments} onChange={update("appointments")} showToast={showToast}
          fields={[
            { key: "visitorName", label: "Visitor Name", required: true, placeholder: "Name" },
            { key: "meetWith", label: "Meeting With", placeholder: "Staff / HOD" },
            { key: "time", label: "Time", placeholder: "HH:MM" },
            { key: "status", label: "Status", type: "select", options: ["Scheduled", "Completed", "Cancelled"], default: "Scheduled" },
          ]}
        />
      )}
      {tab === "parcels" && (
        <SimpleTab
          title="Parcel" icon="📦" data={parcels} onChange={update("parcels")} showToast={showToast}
          fields={[
            { key: "sender", label: "Sender", required: true, placeholder: "Sender name / courier" },
            { key: "recipient", label: "Recipient", placeholder: "Staff / Student" },
            { key: "tracking", label: "Tracking #", placeholder: "Tracking number" },
            { key: "collected", label: "Status", type: "select", options: ["Pending", "Collected"], default: "Pending" },
          ]}
        />
      )}
      {tab === "items" && (
        <SimpleTab
          title="Item from Parent" icon="🎒" data={items} onChange={update("items")} showToast={showToast}
          fields={[
            { key: "studentName", label: "Student", required: true, placeholder: "Student name" },
            { key: "parentName", label: "Parent", placeholder: "Parent name" },
            { key: "item", label: "Item", placeholder: "Description of item" },
            { key: "handedTo", label: "Handed To", placeholder: "Staff / Class" },
          ]}
        />
      )}
      {tab === "rcdashboard" && (
        <DashboardTab visitors={visitors} phoneLogs={phoneLogs} enquiries={enquiries} appointments={appointments} parcels={parcels} items={items} />
      )}
    </div>
  );
}
