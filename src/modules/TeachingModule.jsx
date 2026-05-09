/**
 * GNSI PORTAL — TeachingModule.jsx
 * Pages: Today's Lesson, Lesson Plans, Assignments, Performance, Diary, LessonBridge
 * Original: modules/teaching.js
 */

import { useState } from "react";

/* ── Helpers ── */
const today = () => new Date().toISOString().split("T")[0];

const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9,
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#f8faff", boxSizing: "border-box",
};

const BATCHES = ["Achiever Batch (Combined)","Leader Batch (Sainik)","Champion Batch (Sainik)","Lakshya Batch (Navodaya)","Umeed Batch (Navodaya)","Elite Batch (Foundation)","Prime Batch (Foundation)"];
const SUBJECTS = ["Mathematics","Science","English","Hindi","Social Studies","Computer","Reasoning","GK","Grammar","Physical Ed","Other"];

function FormGroup({ label, children, span }) {
  return (
    <div style={{ gridColumn: span ? "1/-1" : undefined }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Card({ title, children, action, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edfa", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8edfa", display: "flex", alignItems: "center", justifyContent: "space-between", background: color ? color + "0a" : undefined }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: color || "#0a1229" }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ── Today's Lesson Tab ── */
function TodayTab({ data, onSave, showToast }) {
  const [form, setForm] = useState({ subject: "", topic: "", batch: "", periods: "", note: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.subject || !form.topic) { showToast?.("Subject and Topic required", "#dc2626"); return; }
    onSave("todayLessons", [{ id: Date.now(), date: today(), ...form }, ...(data.todayLessons || [])]);
    setForm({ subject: "", topic: "", batch: "", periods: "", note: "" });
    showToast?.("Lesson logged", "#16a34a");
  };

  const lessons = (data.todayLessons || []).filter((l) => l.date === today());

  return (
    <div>
      <div style={{ background: "#fff", border: "1.5px solid #1433a820", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#1433a8", marginBottom: 14 }}>📅 Log Today's Lesson</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
          <FormGroup label="Subject *">
            <input style={inputStyle} value={form.subject} onChange={set("subject")} placeholder="e.g. Mathematics" />
          </FormGroup>
          <FormGroup label="Topic *">
            <input style={inputStyle} value={form.topic} onChange={set("topic")} placeholder="e.g. Fractions" />
          </FormGroup>
          <FormGroup label="Batch">
            <select style={inputStyle} value={form.batch} onChange={set("batch")}>
              <option value="">-- Select Batch --</option>
              {BATCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Periods Covered">
            <input style={inputStyle} value={form.periods} onChange={set("periods")} placeholder="e.g. P1, P3" />
          </FormGroup>
          <FormGroup label="Notes" span>
            <input style={inputStyle} value={form.note} onChange={set("note")} placeholder="Additional notes" />
          </FormGroup>
        </div>
        <button onClick={handleSave} style={{ marginTop: 14, padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#1433a8,#1b44cc)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Save Lesson
        </button>
      </div>

      <Card title={`📋 Today's Lessons (${today()})`}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8faff" }}>{["Subject","Topic","Batch","Periods","Notes",""].map((h) => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}</tr></thead>
            <tbody>
              {lessons.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No lessons logged today</td></tr>
              ) : lessons.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, color: "#1433a8" }}>{l.subject}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{l.topic}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{l.batch || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{l.periods || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{l.note || "—"}</td>
                  <td style={{ padding: "10px 14px" }}><button onClick={() => onSave("todayLessons", (data.todayLessons || []).filter((x) => x.id !== l.id))} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Lesson Plans Tab ── */
function PlansTab({ data, onSave, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ subject: "", topic: "", batch: "", week: "", objectives: "", methods: "", materials: "", homework: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.subject || !form.topic) { showToast?.("Subject and Topic required", "#dc2626"); return; }
    onSave("lessonPlans", [{ id: Date.now(), createdAt: today(), ...form }, ...(data.lessonPlans || [])]);
    setShow(false);
    setForm({ subject: "", topic: "", batch: "", week: "", objectives: "", methods: "", materials: "", homework: "" });
    showToast?.("Lesson plan saved", "#16a34a");
  };

  const plans = data.lessonPlans || [];

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #16a34a20", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#16a34a", marginBottom: 14 }}>📋 New Lesson Plan</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Subject *"><input style={inputStyle} value={form.subject} onChange={set("subject")} placeholder="Subject" /></FormGroup>
            <FormGroup label="Topic *"><input style={inputStyle} value={form.topic} onChange={set("topic")} placeholder="Topic / Unit" /></FormGroup>
            <FormGroup label="Batch"><select style={inputStyle} value={form.batch} onChange={set("batch")}><option value="">-- Select --</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}</select></FormGroup>
            <FormGroup label="Week / Date"><input style={inputStyle} value={form.week} onChange={set("week")} placeholder="e.g. Week 3, Jan" /></FormGroup>
            <FormGroup label="Objectives" span><textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={form.objectives} onChange={set("objectives")} placeholder="Learning objectives" /></FormGroup>
            <FormGroup label="Teaching Methods"><input style={inputStyle} value={form.methods} onChange={set("methods")} placeholder="e.g. Lecture, Activity" /></FormGroup>
            <FormGroup label="Materials Needed"><input style={inputStyle} value={form.materials} onChange={set("materials")} placeholder="Books, chart paper..." /></FormGroup>
            <FormGroup label="Homework"><input style={inputStyle} value={form.homework} onChange={set("homework")} placeholder="Assignment for students" /></FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save Plan</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}
      <Card title="📋 Lesson Plans" color="#16a34a" action={<button onClick={() => setShow(!show)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ New Plan</button>}>
        {plans.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No lesson plans yet</div>
        ) : plans.map((p) => (
          <div key={p.id} style={{ padding: "14px 20px", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{p.subject}</span>
                <span style={{ margin: "0 8px", color: "#cbd5e1" }}>·</span>
                <span style={{ fontSize: 13, color: "#64748b" }}>{p.topic}</span>
                {p.batch && <span style={{ marginLeft: 8, background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{p.batch}</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{p.week || p.createdAt}</span>
                <button onClick={() => onSave("lessonPlans", plans.filter((x) => x.id !== p.id))} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            </div>
            {p.objectives && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>🎯 {p.objectives}</div>}
            {p.homework && <div style={{ fontSize: 12, color: "#d4a853", marginTop: 3 }}>📝 HW: {p.homework}</div>}
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ── Assignments Tab ── */
function AssignmentsTab({ data, onSave, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", batch: "", dueDate: today(), description: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.title) { showToast?.("Title required", "#dc2626"); return; }
    onSave("assignments", [{ id: Date.now(), createdAt: today(), ...form }, ...(data.assignments || [])]);
    setShow(false);
    setForm({ title: "", subject: "", batch: "", dueDate: today(), description: "" });
    showToast?.("Assignment created", "#16a34a");
  };

  const assignments = data.assignments || [];

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #8b5cf620", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#8b5cf6", marginBottom: 14 }}>📝 New Assignment</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Title *"><input style={inputStyle} value={form.title} onChange={set("title")} placeholder="Assignment title" /></FormGroup>
            <FormGroup label="Subject"><input style={inputStyle} value={form.subject} onChange={set("subject")} placeholder="Subject" /></FormGroup>
            <FormGroup label="Batch"><select style={inputStyle} value={form.batch} onChange={set("batch")}><option value="">-- Select --</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}</select></FormGroup>
            <FormGroup label="Due Date"><input style={inputStyle} type="date" value={form.dueDate} onChange={set("dueDate")} /></FormGroup>
            <FormGroup label="Description" span><textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={form.description} onChange={set("description")} placeholder="Instructions..." /></FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "#8b5cf6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Create Assignment</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}
      <Card title="📝 Assignments" color="#8b5cf6" action={<button onClick={() => setShow(!show)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#8b5cf6", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ New Assignment</button>}>
        {assignments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No assignments created yet</div>
        ) : assignments.map((a) => {
          const isOverdue = a.dueDate < today();
          return (
            <div key={a.id} style={{ padding: "14px 20px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{a.subject} {a.batch && `· ${a.batch}`}</div>
                {a.description && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{a.description}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: isOverdue ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                  {isOverdue ? "⚠ Overdue" : "📅 Due"}: {a.dueDate}
                </div>
                <button onClick={() => onSave("assignments", assignments.filter((x) => x.id !== a.id))} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12, marginTop: 4 }}>Remove</button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ── Performance Tab ── */
function PerformanceTab({ data, onSave, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ studentName: "", batch: "", subject: "", score: "", maxScore: "100", examType: "Monthly Test", date: today(), remarks: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.studentName || !form.score) { showToast?.("Student name and score required", "#dc2626"); return; }
    onSave("performances", [{ id: Date.now(), ...form }, ...(data.performances || [])]);
    setShow(false);
    showToast?.("Score saved", "#16a34a");
  };

  const performances = data.performances || [];
  const getGrade = (score, max) => {
    const pct = (score / max) * 100;
    if (pct >= 90) return { grade: "A+", color: "#16a34a" };
    if (pct >= 75) return { grade: "A", color: "#16a34a" };
    if (pct >= 60) return { grade: "B", color: "#d4a853" };
    if (pct >= 45) return { grade: "C", color: "#ea580c" };
    return { grade: "D", color: "#dc2626" };
  };

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #0891b220", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0891b2", marginBottom: 14 }}>📊 Record Score</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Student Name *"><input style={inputStyle} value={form.studentName} onChange={set("studentName")} placeholder="Student" /></FormGroup>
            <FormGroup label="Batch"><select style={inputStyle} value={form.batch} onChange={set("batch")}><option value="">-- Select --</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}</select></FormGroup>
            <FormGroup label="Subject"><input style={inputStyle} value={form.subject} onChange={set("subject")} placeholder="Subject" /></FormGroup>
            <FormGroup label="Exam Type"><select style={inputStyle} value={form.examType} onChange={set("examType")}>{["Monthly Test","Unit Test","Semester Exam","Practice Test","Mock Exam"].map((t) => <option key={t}>{t}</option>)}</select></FormGroup>
            <FormGroup label="Score *"><input style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace" }} type="number" value={form.score} onChange={set("score")} placeholder="Score" /></FormGroup>
            <FormGroup label="Max Score"><input style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace" }} type="number" value={form.maxScore} onChange={set("maxScore")} /></FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save Score</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}
      <Card title="📊 Student Performance" color="#0891b2" action={<button onClick={() => setShow(!show)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Record Score</button>}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8faff" }}>{["Date","Student","Batch","Subject","Exam","Score","Grade",""].map((h) => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}</tr></thead>
            <tbody>
              {performances.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No scores recorded</td></tr>
              ) : performances.map((p) => {
                const { grade, color } = getGrade(p.score, p.maxScore || 100);
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{p.date}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{p.studentName}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{p.batch || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>{p.subject || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{p.examType}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{p.score}/{p.maxScore || 100}</td>
                    <td style={{ padding: "10px 14px" }}><span style={{ background: color + "22", color, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 800 }}>{grade}</span></td>
                    <td style={{ padding: "10px 14px" }}><button onClick={() => onSave("performances", performances.filter((x) => x.id !== p.id))} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Diary Tab ── */
function DiaryTab({ data, currentUser, onSave, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ date: today(), title: "", content: "", mood: "😊" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.title || !form.content) { showToast?.("Title and content required", "#dc2626"); return; }
    onSave("diary", [{ id: Date.now(), author: currentUser?.name, ...form }, ...(data.diary || [])]);
    setShow(false);
    setForm({ date: today(), title: "", content: "", mood: "😊" });
    showToast?.("Diary entry saved", "#16a34a");
  };

  const entries = (data.diary || []).filter((e) => e.author === currentUser?.name || currentUser?.role === "admin");

  return (
    <div>
      {show && (
        <div style={{ background: "#fff", border: "1.5px solid #d4a85320", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#d4a853", marginBottom: 14 }}>📓 New Diary Entry</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            <FormGroup label="Date"><input style={inputStyle} type="date" value={form.date} onChange={set("date")} /></FormGroup>
            <FormGroup label="Mood">
              <select style={inputStyle} value={form.mood} onChange={set("mood")}>
                {["😊 Great","🙂 Good","😐 Okay","😔 Difficult","😤 Frustrated"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Title *" span><input style={inputStyle} value={form.title} onChange={set("title")} placeholder="Entry title" /></FormGroup>
            <FormGroup label="Content *" span><textarea style={{ ...inputStyle, resize: "vertical" }} rows={4} value={form.content} onChange={set("content")} placeholder="What happened today in class?" /></FormGroup>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "#d4a853", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save Entry</button>
            <button onClick={() => setShow(false)} style={{ padding: "9px 22px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>Cancel</button>
          </div>
        </div>
      )}
      <Card title="📓 Teaching Diary" color="#d4a853" action={<button onClick={() => setShow(!show)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#d4a853", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ New Entry</button>}>
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No diary entries yet</div>
        ) : entries.map((e) => (
          <div key={e.id} style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{e.mood?.split(" ")[0] || "📝"}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{e.title}</div>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>{e.date} · {e.author}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{e.content}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ── Main TeachingModule ── */
export default function TeachingModule({ currentUser, teachingData = {}, onDataChange, showToast }) {
  const [tab, setTab] = useState("today");

  const save = (key, val) => onDataChange({ ...teachingData, [key]: val });

  const isTeacher = ["teacher", "admin", "manager"].includes(currentUser?.role);

  const TABS = [
    { id: "today", label: "📅 Today's Lesson" },
    { id: "plans", label: "📋 Lesson Plans" },
    { id: "assignments", label: "📝 Assignments" },
    { id: "performance", label: "📊 Performance" },
    { id: "diary", label: "📓 Diary" },
  ];

  if (!isTeacher) return (
    <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
      🔒 Teaching module is accessible to teachers and administrators only.
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", borderRadius: 9, border: tab === t.id ? "none" : "1.5px solid #e2e8f0", background: tab === t.id ? "linear-gradient(135deg,#1433a8,#1b44cc)" : "#fff", color: tab === t.id ? "#fff" : "#64748b", fontWeight: tab === t.id ? 700 : 600, fontSize: 13, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "today" && <TodayTab data={teachingData} onSave={save} showToast={showToast} />}
      {tab === "plans" && <PlansTab data={teachingData} onSave={save} showToast={showToast} />}
      {tab === "assignments" && <AssignmentsTab data={teachingData} onSave={save} showToast={showToast} />}
      {tab === "performance" && <PerformanceTab data={teachingData} onSave={save} showToast={showToast} />}
      {tab === "diary" && <DiaryTab data={teachingData} currentUser={currentUser} onSave={save} showToast={showToast} />}
    </div>
  );
}
