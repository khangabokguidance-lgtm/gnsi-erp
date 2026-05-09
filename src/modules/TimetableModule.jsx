/**
 * GNSI PORTAL — TimetableModule.jsx
 * Pages: Timetable (schedule, batch mapping, student view), Doubt TT
 * Original: modules/timetable.js + notices.js (timetable section)
 */

import { useState, useCallback } from "react";

/* ── Constants ── */
const TT_PALETTE = ["#1435a0","#8b5cf6","#3b78c9","#0891b2","#d4a853","#dc2626","#16a34a","#ea580c","#db2777","#059669","#7c3aed","#b45309"];
const SUBJECTS = ["Science","Maths","Mathematics","Reasoning","Grammar","GK","Mental","Hindi","English","Social Studies","Computer","Physical Ed","Doubt Session"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat"];

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

/* ── Column Manager Modal ── */
function ColModal({ cols, onSave, onClose }) {
  const [form, setForm] = useState({ label: "", key: `batch_${Date.now()}`, color: TT_PALETTE[cols.length % TT_PALETTE.length] });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.label.trim()) return;
    onSave({ ...form, key: form.label.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now() });
    onClose();
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(10,18,41,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Add Batch Column</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormGroup label="Batch Name *"><input style={inputStyle} value={form.label} onChange={set("label")} placeholder="e.g. Achiever Batch" /></FormGroup>
          <FormGroup label="Column Color">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TT_PALETTE.map((c) => (
                <div key={c} onClick={() => setForm((f) => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: "pointer", border: form.color === c ? "3px solid #0a1229" : "3px solid transparent", transition: "border-color 0.15s" }} />
              ))}
            </div>
          </FormGroup>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: form.color, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", flex: 1 }}>Add Column</button>
          <button onClick={onClose} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── Cell Edit Modal ── */
function CellModal({ cell, cols, periods, onSave, onClose }) {
  const period = periods.find((p) => p.id === cell.periodId) || {};
  const col = cols.find((c) => c.key === cell.colKey) || {};
  const existing = period.cells?.[cell.colKey] || {};
  const [form, setForm] = useState({ subject: existing.subject || "", teacher: existing.teacher || "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(10,18,41,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Edit Cell</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
          {period.time} · <span style={{ color: col.color, fontWeight: 700 }}>{col.label}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormGroup label="Subject">
            <select style={inputStyle} value={form.subject} onChange={set("subject")}>
              <option value="">-- Select Subject --</option>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Teacher"><input style={inputStyle} value={form.teacher} onChange={set("teacher")} placeholder="Teacher name" /></FormGroup>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => { onSave(cell.periodId, cell.colKey, form); onClose(); }} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", flex: 1 }}>Save</button>
          <button onClick={() => { onSave(cell.periodId, cell.colKey, { subject: "", teacher: "" }); onClose(); }} style={{ padding: "9px 22px", borderRadius: 9, border: "1px solid #fca5a5", background: "#fef2f2", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#dc2626" }}>Clear</button>
        </div>
      </div>
    </div>
  );
}

/* ── Schedule Grid ── */
function ScheduleTab({ currentUser, cols, periods, onPeriodsChange, onColAdd, onColRemove }) {
  const [cellModal, setCellModal] = useState(null);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  const updateCell = (periodId, colKey, data) => {
    onPeriodsChange(periods.map((p) => p.id === periodId ? { ...p, cells: { ...p.cells, [colKey]: data } } : p));
  };

  const addPeriodRow = () => {
    const lastTime = periods.filter((p) => !p.isBreak).pop()?.time || "07:00-07:45";
    const newId = "p_" + Date.now();
    onPeriodsChange([...periods, { id: newId, time: "New Period", isBreak: false, cells: {} }]);
  };

  const addBreak = () => {
    onPeriodsChange([...periods, { id: "b_" + Date.now(), time: "Break", isBreak: true, breakLabel: "Lunch / Tea Break", cells: {} }]);
  };

  return (
    <div>
      {/* Controls */}
      {isAdmin && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={onColAdd} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Add Batch Column</button>
          <button onClick={addPeriodRow} style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", color: "#1433a8" }}>+ Add Period Row</button>
          <button onClick={addBreak} style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", color: "#64748b" }}>☕ Add Break</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: 140, padding: "12px 16px", background: "#1433a8", color: "#fff", textAlign: "left", fontSize: 12, fontWeight: 700, position: "sticky", left: 0, zIndex: 2 }}>
                  Time (Mon–Sat)
                </th>
                {cols.map((c) => (
                  <th key={c.key} style={{ minWidth: 130, padding: "10px 12px 10px 10px", background: c.color, color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "center", position: "relative" }}>
                    {c.label}
                    {isAdmin && (
                      <button onClick={() => onColRemove(c.key)} title="Remove" style={{ position: "absolute", top: 4, right: 4, background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 4, width: 16, height: 16, cursor: "pointer", fontSize: 9, color: "#fff", lineHeight: "16px", textAlign: "center" }}>
                        ✕
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                if (p.isBreak) {
                  return (
                    <tr key={p.id} style={{ background: "#f8faff" }}>
                      <td style={{ padding: "10px 16px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8", fontWeight: 700, position: "sticky", left: 0, background: "#f8faff" }}>{p.time}</td>
                      <td colSpan={cols.length} style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, letterSpacing: "0.08em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                        ☕ {p.breakLabel}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 16px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#64748b", fontWeight: 700, position: "sticky", left: 0, background: "#fff", borderRight: "1px solid #e8edfa" }}>
                      <input
                        value={p.time}
                        onChange={(e) => onPeriodsChange(periods.map((row) => row.id === p.id ? { ...row, time: e.target.value } : row))}
                        style={{ border: "none", background: "transparent", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#64748b", fontWeight: 700, width: "100%", outline: "none" }}
                      />
                    </td>
                    {cols.map((c) => {
                      const cell = p.cells?.[c.key] || {};
                      const hasContent = !!(cell.subject || cell.teacher);
                      return (
                        <td key={c.key}
                          onClick={isAdmin ? () => setCellModal({ periodId: p.id, colKey: c.key }) : undefined}
                          style={{ padding: 6, textAlign: "center", cursor: isAdmin ? "pointer" : "default", verticalAlign: "middle", minWidth: 130 }}
                        >
                          <div style={{
                            borderRadius: 8,
                            padding: hasContent ? "8px 10px" : "8px",
                            background: hasContent ? c.color + "18" : isAdmin ? "#f8faff" : "transparent",
                            border: hasContent ? `1.5px solid ${c.color}44` : isAdmin ? "1.5px dashed #e2e8f0" : "none",
                            minHeight: 50,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 3,
                          }}>
                            {hasContent ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: 12, color: c.color }}>{cell.subject}</div>
                                {cell.teacher && <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{cell.teacher}</div>}
                              </>
                            ) : isAdmin ? (
                              <span style={{ fontSize: 18, color: "#e2e8f0" }}>+</span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {cellModal && (
        <CellModal
          cell={cellModal}
          cols={cols}
          periods={periods}
          onSave={updateCell}
          onClose={() => setCellModal(null)}
        />
      )}
    </div>
  );
}

/* ── Batch Mapping Tab ── */
function MappingTab({ students, cols, studentBatchMap, onMapChange }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = students.filter((s) => {
    const sm = filter === "all" || studentBatchMap[s.id] === filter || (!studentBatchMap[s.id] && filter === "unassigned");
    return sm && s.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, maxWidth: 240 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search students..." />
        <select style={{ ...inputStyle, width: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Students</option>
          <option value="unassigned">Unassigned</option>
          {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8faff" }}>
                {["Name", "Class", "Current Batch", "Assign Batch"].map((h) => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const batchKey = studentBatchMap[s.id];
                const batch = cols.find((c) => c.key === batchKey);
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{s.name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#64748b" }}>{s.class || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {batch ? (
                        <span style={{ background: batch.color + "22", color: batch.color, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{batch.label}</span>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <select style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "5px 10px" }} value={batchKey || ""} onChange={(e) => onMapChange(s.id, e.target.value || null)}>
                        <option value="">-- Unassign --</option>
                        {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Doubt TT ── */
function DoubtTTTab({ currentUser, cols, periods }) {
  const doubtPeriods = periods.filter((p) => !p.isBreak && Object.values(p.cells || {}).some((c) => c.subject === "Doubt Session"));

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>❓ Doubt Session Schedule</span>
        </div>
        {doubtPeriods.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            No doubt sessions scheduled. Mark cells as "Doubt Session" in the timetable to see them here.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8faff" }}>
                  {["Time", "Batch", "Teacher"].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doubtPeriods.flatMap((p) =>
                  cols.filter((c) => p.cells?.[c.key]?.subject === "Doubt Session").map((c) => (
                    <tr key={`${p.id}-${c.key}`} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#64748b" }}>{p.time}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: c.color + "22", color: c.color, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{c.label}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>{p.cells[c.key].teacher || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main TimetableModule ── */
export default function TimetableModule({ currentUser, timetableData = {}, students = [], onTimetableChange, showToast }) {
  const [tab, setTab] = useState("schedule");
  const [showColModal, setShowColModal] = useState(false);

  const { cols = [], periods = [], studentBatchMap = {} } = timetableData;

  const update = (key) => (val) => onTimetableChange({ ...timetableData, [key]: val });

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  const TABS = [
    { id: "schedule", label: "📅 Schedule" },
    { id: "mapping", label: "🔗 Batch Mapping" },
    { id: "doubt", label: "❓ Doubt TT" },
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

      {tab === "schedule" && (
        <ScheduleTab
          currentUser={currentUser}
          cols={cols}
          periods={periods}
          onPeriodsChange={update("periods")}
          onColAdd={() => isAdmin && setShowColModal(true)}
          onColRemove={(key) => { if (isAdmin && window.confirm("Remove this batch column?")) update("cols")(cols.filter((c) => c.key !== key)); }}
        />
      )}

      {tab === "mapping" && (
        <MappingTab
          students={students}
          cols={cols}
          studentBatchMap={studentBatchMap}
          onMapChange={(stuId, batchKey) => {
            const map = { ...studentBatchMap };
            if (batchKey) map[stuId] = batchKey; else delete map[stuId];
            update("studentBatchMap")(map);
          }}
        />
      )}

      {tab === "doubt" && <DoubtTTTab currentUser={currentUser} cols={cols} periods={periods} />}

      {showColModal && (
        <ColModal
          cols={cols}
          onSave={(col) => { update("cols")([...cols, col]); showToast?.("Batch column added", "#16a34a"); }}
          onClose={() => setShowColModal(false)}
        />
      )}
    </div>
  );
}
