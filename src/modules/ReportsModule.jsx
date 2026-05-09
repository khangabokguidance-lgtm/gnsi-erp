/**
 * GNSI PORTAL — ReportsModule.jsx
 * Pages: Attendance, Staff, Students, Salary, Timetable, Fee Records, Hostel, Staff Rating
 * Original: modules/reports.js
 */

import { useState } from "react";

/* ── Helpers ── */
const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9,
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#f8faff", boxSizing: "border-box",
};

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${color}22`, borderLeft: `4px solid ${color}`, padding: "16px 20px" }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, fontFamily: "'Cormorant Garamond',serif" }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1229", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ icon, title, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0a1229" }}>{icon} {title}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function DataTable({ cols, rows, emptyMsg = "No data" }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8faff" }}>
              {cols.map((c) => <th key={c} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={cols.length} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>{emptyMsg}</td></tr> : rows}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ label, color }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{label}</span>;
}

/* ── Attendance Report ── */
function AttendanceReport({ attendance = {}, staff = [], students = [] }) {
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [viewType, setViewType] = useState("staff");

  const attendanceList = Object.entries(attendance).filter(([date]) => date >= dateFrom && date <= dateTo);
  const totalDays = attendanceList.length;

  const staffStats = staff.map((s) => {
    const present = attendanceList.filter(([, dayData]) => dayData[s.id] === "Present").length;
    const pct = totalDays ? Math.round((present / totalDays) * 100) : 0;
    return { ...s, present, absent: totalDays - present, pct };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>From</label>
          <input style={{ ...inputStyle, width: 160 }} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>To</label>
          <input style={{ ...inputStyle, width: 160 }} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["staff", "students"].map((v) => (
            <button key={v} onClick={() => setViewType(v)} style={{ padding: "8px 16px", borderRadius: 8, border: viewType === v ? "none" : "1.5px solid #e2e8f0", background: viewType === v ? "linear-gradient(135deg,#1433a8,#1b44cc)" : "#fff", color: viewType === v ? "#fff" : "#64748b", fontWeight: viewType === v ? 700 : 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14, marginBottom: 16 }}>
        <StatCard label="Total Days" value={totalDays} icon="📅" color="#1433a8" />
        <StatCard label="Staff Count" value={staff.length} icon="👥" color="#7c3aed" />
        <StatCard label="Avg Attendance" value={staffStats.length ? Math.round(staffStats.reduce((s, x) => s + x.pct, 0) / staffStats.length) + "%" : "—"} icon="📊" color="#16a34a" />
      </div>

      {viewType === "staff" && (
        <DataTable
          cols={["Name", "Role", "Present", "Absent", "Attendance %"]}
          emptyMsg="No attendance data"
          rows={staffStats.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{s.name}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{s.role}</td>
              <td style={{ padding: "10px 14px", fontSize: 13, color: "#16a34a", fontWeight: 700 }}>{s.present}</td>
              <td style={{ padding: "10px 14px", fontSize: 13, color: "#dc2626", fontWeight: 700 }}>{s.absent}</td>
              <td style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: s.pct + "%", background: s.pct >= 75 ? "#16a34a" : s.pct >= 60 ? "#d4a853" : "#dc2626", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: s.pct >= 75 ? "#16a34a" : s.pct >= 60 ? "#d4a853" : "#dc2626", minWidth: 36 }}>{s.pct}%</span>
                </div>
              </td>
            </tr>
          ))}
        />
      )}
    </div>
  );
}

/* ── Staff Report ── */
function StaffReport({ staff = [] }) {
  const deptGroups = staff.reduce((acc, s) => {
    const dept = s.dept || "Other";
    acc[dept] = (acc[dept] || []);
    acc[dept].push(s);
    return acc;
  }, {});

  const statusCounts = { Active: 0, "On Leave": 0, Inactive: 0 };
  staff.forEach((s) => { if (statusCounts[s.status] !== undefined) statusCounts[s.status]++; });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Staff" value={staff.length} icon="👥" color="#1433a8" />
        <StatCard label="Active" value={statusCounts.Active} icon="✅" color="#16a34a" />
        <StatCard label="On Leave" value={statusCounts["On Leave"]} icon="🏖" color="#d4a853" />
        <StatCard label="Inactive" value={statusCounts.Inactive} icon="⛔" color="#dc2626" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        {Object.entries(deptGroups).map(([dept, members]) => (
          <div key={dept} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8edfa", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: 13 }}>{dept}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#94a3b8" }}>{members.length} staff</span>
            </div>
            {members.map((s) => (
              <div key={s.id} style={{ padding: "8px 16px", borderTop: "1px solid #f8faff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.role}</div>
                </div>
                <Badge label={s.status || "Active"} color={s.status === "Active" ? "#16a34a" : s.status === "On Leave" ? "#d4a853" : "#dc2626"} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Students Report ── */
function StudentsReport({ students = [] }) {
  const [search, setSearch] = useState("");
  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const classCounts = students.reduce((acc, s) => { acc[s.class || "Unknown"] = (acc[s.class || "Unknown"] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14, marginBottom: 16 }}>
        <StatCard label="Total Students" value={students.length} icon="🎓" color="#1433a8" />
        <StatCard label="Classes" value={Object.keys(classCounts).length} icon="🏫" color="#7c3aed" />
      </div>
      <input style={{ ...inputStyle, maxWidth: 300, marginBottom: 14 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search students..." />
      <DataTable
        cols={["Name", "Class", "Roll No", "Status", "Fees"]}
        emptyMsg="No students found"
        rows={filtered.map((s) => (
          <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
            <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{s.name}</td>
            <td style={{ padding: "10px 14px", fontSize: 13 }}>{s.class || "—"}</td>
            <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#94a3b8" }}>{s.rollNo || "—"}</td>
            <td style={{ padding: "10px 14px" }}><Badge label={s.status || "Active"} color={s.status === "Active" ? "#16a34a" : "#dc2626"} /></td>
            <td style={{ padding: "10px 14px" }}><Badge label={s.fees || "Pending"} color={s.fees === "Paid" ? "#16a34a" : "#dc2626"} /></td>
          </tr>
        ))}
      />
    </div>
  );
}

/* ── Staff Rating ── */
function StaffRatingReport({ staff = [], appraisals = [] }) {
  const year = new Date().getFullYear();
  const FIELDS = ["teach", "discp", "duty", "punct", "team"];
  const LABELS = { teach: "Teaching", discp: "Discipline", duty: "Duty", punct: "Punctuality", team: "Teamwork" };

  const ratedStaff = staff.map((s) => {
    const ap = appraisals.find((a) => a.staffId === s.id && a.year === year) || {};
    const vals = FIELDS.map((f) => parseInt(ap[f])).filter(Boolean);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { ...s, ap, avg };
  }).filter((s) => s.avg !== null).sort((a, b) => b.avg - a.avg);

  const getColor = (v) => v >= 4 ? "#16a34a" : v >= 3 ? "#d4a853" : "#dc2626";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14, marginBottom: 16 }}>
        <StatCard label="Appraised Staff" value={ratedStaff.length} icon="⭐" color="#d4a853" sub={`of ${staff.length} total`} />
        <StatCard label="Avg Score" value={ratedStaff.length ? (ratedStaff.reduce((s, x) => s + x.avg, 0) / ratedStaff.length).toFixed(1) : "—"} icon="📊" color="#1433a8" sub="out of 5" />
      </div>
      <DataTable
        cols={["Rank", "Name", ...FIELDS.map((f) => LABELS[f]), "Avg Score"]}
        emptyMsg="No appraisals for this year"
        rows={ratedStaff.map((s, i) => (
          <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
            <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: i < 3 ? "#d4a853" : "#94a3b8" }}>#{i + 1}</td>
            <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{s.name}</td>
            {FIELDS.map((f) => (
              <td key={f} style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: s.ap[f] ? getColor(s.ap[f]) : "#cbd5e1" }}>
                {s.ap[f] || "—"}
              </td>
            ))}
            <td style={{ padding: "10px 14px" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: 15, color: getColor(s.avg) }}>{s.avg.toFixed(1)}</span>
            </td>
          </tr>
        ))}
      />
    </div>
  );
}

/* ── Generic placeholder for Salary/Fees/Hostel/Timetable sub-reports ── */
function PlaceholderReport({ title, icon }) {
  return (
    <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1229", marginBottom: 8 }}>{title} Report</div>
      <div style={{ fontSize: 13 }}>Data will appear here once salary / fee / hostel / timetable records are available.</div>
    </div>
  );
}

/* ── Main ReportsModule ── */
export default function ReportsModule({ currentUser, staff = [], students = [], appraisals = [], attendance = {}, showToast }) {
  const [tab, setTab] = useState("attendance");

  const TABS = [
    { id: "attendance", label: "📋 Attendance" },
    { id: "staff", label: "👥 Staff" },
    { id: "students", label: "🎓 Students" },
    { id: "salary", label: "💰 Salary" },
    { id: "timetable", label: "📅 Timetable" },
    { id: "fees", label: "💳 Fee Records" },
    { id: "hostelrpt", label: "🏠 Hostel" },
    { id: "staffrating", label: "⭐ Staff Rating" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0a1229" }}>📈 Reports</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Analytics, summaries, and exportable data across all modules</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", borderRadius: 8, border: tab === t.id ? "none" : "1.5px solid #e2e8f0", background: tab === t.id ? "linear-gradient(135deg,#1433a8,#1b44cc)" : "#fff", color: tab === t.id ? "#fff" : "#64748b", fontWeight: tab === t.id ? 700 : 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "attendance" && <AttendanceReport attendance={attendance} staff={staff} students={students} />}
      {tab === "staff" && <StaffReport staff={staff} />}
      {tab === "students" && <StudentsReport students={students} />}
      {tab === "salary" && <PlaceholderReport title="Salary" icon="💰" />}
      {tab === "timetable" && <PlaceholderReport title="Timetable" icon="📅" />}
      {tab === "fees" && <PlaceholderReport title="Fee Records" icon="💳" />}
      {tab === "hostelrpt" && <PlaceholderReport title="Hostel" icon="🏠" />}
      {tab === "staffrating" && <StaffRatingReport staff={staff} appraisals={appraisals} />}
    </div>
  );
}
