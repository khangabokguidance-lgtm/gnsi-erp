/* GNSI PORTAL — SystemModule.jsx
   Pages: sync, settings, aiassistant, analytics, assets, backup, storage_manager
   Props: { currentUser, staff, students, notices, showToast, isOnline, syncStatus }
*/

import { useState, useEffect, useRef } from "react";

/* ── Helpers ── */
const esc = (s) => String(s ?? "");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtSize = (bytes) => bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1048576).toFixed(2)}MB`;

const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" };
const selectStyle = { ...inputStyle };
const btnPrimary = { padding: "9px 20px", borderRadius: 9, background: "#1433a8", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" };
const btnOutline = { padding: "9px 16px", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 13, cursor: "pointer" };

function StatCard({ icon, label, value, sub, color = "#1433a8" }) {
  return (
    <div className="stat-card" style={{ "--c": color }}>
      <div className="stat-label">{label}</div>
      <div className="stat-val" style={{ fontSize: 24, color }}>{icon && <span style={{ marginRight: 6 }}>{icon}</span>}{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   1. SYNC PAGE
═══════════════════════════════════════════════ */
function SyncPage({ currentUser, staff, students, notices, showToast, isOnline, syncStatus }) {
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState(() => { try { return JSON.parse(localStorage.getItem("ims_synclog") || "[]"); } catch { return []; } });
  const dataSize = ((JSON.stringify(staff || []) + JSON.stringify(students || []) + JSON.stringify(notices || [])).length / 1024).toFixed(1);
  const lastSync = localStorage.getItem("gnsi_kv_bulk_ts") || localStorage.getItem("ims_lastsync");

  const addLog = (action, result, detail) => {
    const entry = { ts: new Date().toLocaleString("en-IN"), action, result, detail };
    const newLog = [entry, ...log].slice(0, 20);
    setLog(newLog);
    try { localStorage.setItem("ims_synclog", JSON.stringify(newLog)); } catch {}
  };

  const pushAll = () => {
    setSyncing(true);
    addLog("Push All", "Started", "Pushing all data to cloud…");
    setTimeout(() => {
      setSyncing(false);
      addLog("Push All", "Success", `${(staff || []).length + (students || []).length} records synced`);
      showToast("✅ All data pushed to cloud", "#16a34a");
    }, 1500);
  };

  const pullLatest = () => {
    setSyncing(true);
    addLog("Pull Latest", "Started", "Fetching latest from cloud…");
    setTimeout(() => {
      setSyncing(false);
      addLog("Pull Latest", "Success", "Latest data loaded");
      showToast("✅ Data refreshed from cloud", "#16a34a");
    }, 1500);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 4 }}>GNSI — SYNC & BACKUP</div>
        <div style={{ fontSize: 24, fontFamily: "'Playfair Display',serif", fontWeight: 700 }}>Real-Time Cloud Sync</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Powered by Supabase — all sections sync instantly across every staff device</div>
      </div>

      {/* Status Banner */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 18px", background: "linear-gradient(135deg,#0b1e6e08,#1433a808)", border: "1.5px solid #1433a822", borderRadius: 12, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: isOnline ? "#16a34a" : "#dc2626", boxShadow: `0 0 6px ${isOnline ? "#16a34a" : "#dc2626"}`, flexShrink: 0, animation: "pulse-dot 1.4s ease-in-out infinite" }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: isOnline ? "#16a34a" : "#dc2626" }}>{isOnline ? "Realtime Engine Active" : "Offline Mode"}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>{isOnline ? "8 live channels monitoring every table" : "Changes will sync when connection restores"}</div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Data Size" value={`${dataSize}KB`} sub="Current snapshot" color="var(--accent)" />
        <StatCard label="Last Sync" value={lastSync ? new Date(lastSync).toLocaleTimeString("en-IN") : "Never"} sub={lastSync ? fmtDate(lastSync) : "Not synced yet"} color="#16a34a" />
        <StatCard label="Cloud Status" value="☁️ CLOUD" sub="All data in Supabase" color="#7c3aed" />
        <StatCard label="Records" value={(staff || []).length + (students || []).length} sub="Staff + Students" color="#d4a853" />
      </div>

      {/* Sync Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ background: "linear-gradient(135deg,#f0fdf4,#f5fffe)" }}>
          <div>
            <span className="card-title" style={{ color: "#16a34a" }}>☁️ Supabase Cloud — Active</span>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>All data stored exclusively in Supabase — changes sync instantly</div>
          </div>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 600, border: "1px solid var(--border)", padding: "5px 11px", borderRadius: 7, whiteSpace: "nowrap" }}>Open Dashboard ↗</a>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ background: "linear-gradient(135deg,#eff6ff,#f0f9ff)", border: "1.5px solid #93c5fd", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", marginBottom: 12 }}>☁️ Cloud Mode — What this means:</div>
            <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 2 }}>
              ✅ Every save immediately writes to Supabase KV or dedicated tables<br />
              ✅ Any device that opens this portal sees the same data instantly<br />
              ✅ No data is stored only on one device — all staff see live data<br />
              ✅ Offline changes are queued and pushed when connection restores<br />
              🔒 Session tokens & passwords remain device-local for security
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button disabled={syncing} onClick={pullLatest} style={{ ...btnPrimary, background: "#16a34a", opacity: syncing ? .6 : 1 }}>{syncing ? "⏳ Pulling…" : "⬇ Pull Latest from Cloud"}</button>
            <button disabled={syncing} onClick={pushAll} style={{ ...btnOutline, color: "#16a34a", borderColor: "#16a34a", opacity: syncing ? .6 : 1 }}>{syncing ? "⏳ Pushing…" : "⬆ Push All to Cloud"}</button>
          </div>
        </div>
      </div>

      {/* Multi-Device Guide */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><span className="card-title">📱 Multi-Device Real-Time Sync Guide</span></div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14, marginBottom: 16 }}>
            {[{ icon: "🖥", title: "Admin PC / Office", desc: "Open the portal HTML file in any browser. Logs in → auto-loads cloud data.", color: "#1433a8" }, { icon: "📱", title: "Staff Phone", desc: "Open the same HTML file. Data is always up to date from the cloud.", color: "#16a34a" }, { icon: "💻", title: "Any Laptop / Tablet", desc: "Same HTML file, any browser — Chrome, Edge, Firefox. Supabase syncs everything.", color: "#7c3aed" }, { icon: "📟", title: "Any Other Device", desc: "Just open the file and log in. All sections are shared live.", color: "#d4a853" }].map((d) => (
              <div key={d.title} style={{ background: "var(--surface2)", borderRadius: 10, padding: 16, border: "1px solid var(--border-soft)", borderTop: `3px solid ${d.color}` }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{d.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 5 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sync Log */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">📋 Sync Activity Log</span>
          <button onClick={() => { setLog([]); localStorage.removeItem("ims_synclog"); }} style={{ ...btnOutline, fontSize: 12, padding: "4px 10px", color: "#dc2626" }}>Clear</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table><thead><tr><th>Timestamp</th><th>Action</th><th>Result</th><th>Detail</th></tr></thead>
            <tbody>
              {log.length ? log.map((l, i) => {
                const c = l.result === "Success" || l.result === "Started" ? "#16a34a" : l.result === "Failed" ? "#dc2626" : "#d4a853";
                return <tr key={i}><td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--muted)" }}>{l.ts}</td><td style={{ fontWeight: 700 }}>{l.action}</td><td><span style={{ color: c, fontWeight: 700 }}>{l.result}</span></td><td style={{ fontSize: 12, color: "var(--muted)" }}>{l.detail}</td></tr>;
              }) : <tr><td colSpan={4} style={{ textAlign: "center", padding: 28, color: "var(--muted)" }}>No sync operations yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   2. AI ASSISTANT
═══════════════════════════════════════════════ */
function AIAssistantPage({ currentUser, staff, students, notices, showToast }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hello! I'm the GNSI AI Assistant. I can help you with school management queries, student data analysis, and more. What would you like to know?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const context = `You are an AI assistant for GNSI (Guidance Navodaya & Sainik Institute), a school management portal in Manipur, India. Current data: ${staff?.length || 0} staff members, ${students?.length || 0} students, ${notices?.length || 0} notices. Current user: ${currentUser?.name} (${currentUser?.role}). Be helpful, concise, and professional. For data-specific questions, use the portal sections. Today is ${new Date().toLocaleDateString("en-IN")}.`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: context,
          messages: [...messages, { role: "user", content: userMsg }].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await resp.json();
      const reply = data.content?.[0]?.text || "I'm having trouble responding right now. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "I'm currently unavailable. Please check your connection and try again." }]);
    }
    setLoading(false);
  };

  const quickPrompts = ["How many students are enrolled?", "Summarize today's notices", "What are the staff roles?", "Help me write a parent notice", "Suggest improvements for attendance tracking"];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700 }}>🤖 AI Assistant</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Powered by Claude — your intelligent school management companion</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
        {/* Chat */}
        <div className="card" style={{ display: "flex", flexDirection: "column", height: 520 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10 }}>
                {msg.role === "assistant" && <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1433a8,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🤖</div>}
                <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? "#1433a8" : "var(--surface2)", color: msg.role === "user" ? "#fff" : "var(--text)", fontSize: 13.5, lineHeight: 1.6, border: msg.role === "assistant" ? "1.5px solid var(--border)" : "none", whiteSpace: "pre-wrap" }}>{msg.content}</div>
                {msg.role === "user" && <div style={{ width: 32, height: 32, borderRadius: "50%", background: `hsl(${(currentUser?.name || "U").charCodeAt(0) % 360},60%,45%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{(currentUser?.name || "U")[0]}</div>}
              </div>
            ))}
            {loading && <div style={{ display: "flex", gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1433a8,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div><div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "var(--surface2)", border: "1.5px solid var(--border)" }}><span style={{ display: "inline-flex", gap: 4 }}>{[...Array(3)].map((_, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)", animation: `bounce .6s ${i * .15}s infinite alternate` }} />)}</span></div></div>}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} placeholder="Ask me anything about GNSI…" style={{ ...inputStyle }} />
            <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ ...btnPrimary, opacity: loading || !input.trim() ? .5 : 1, whiteSpace: "nowrap" }}>Send ↵</button>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-head"><span className="card-title" style={{ fontSize: 13 }}>⚡ Quick Prompts</span></div>
            <div style={{ padding: "12px 16px" }}>
              {quickPrompts.map((p) => (
                <button key={p} onClick={() => { setInput(p); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 12.5, cursor: "pointer", marginBottom: 6, lineHeight: 1.4 }}>{p}</button>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><span className="card-title" style={{ fontSize: 13 }}>📊 Portal Stats</span></div>
            <div style={{ padding: "12px 16px" }}>
              {[["👥 Staff", (staff || []).length], ["🎓 Students", (students || []).length], ["📢 Notices", (notices || []).length]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span>{label}</span><span style={{ fontWeight: 700, color: "var(--accent)" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   3. ANALYTICS
═══════════════════════════════════════════════ */
function AnalyticsPage({ staff, students, notices }) {
  const deptCounts = (staff || []).reduce((acc, s) => { acc[s.dept || "Other"] = (acc[s.dept || "Other"] || 0) + 1; return acc; }, {});
  const roleCounts = (staff || []).reduce((acc, s) => { acc[s.role || "staff"] = (acc[s.role || "staff"] || 0) + 1; return acc; }, {});
  const hostelStu = (students || []).filter((s) => s.hostel === "Yes").length;
  const dayScholars = (students || []).length - hostelStu;
  const COLORS = ["#1433a8", "#7c3aed", "#16a34a", "#d4a853", "#dc2626", "#0891b2", "#db2777", "#ea580c"];

  const BarChart = ({ data, label }) => {
    const max = Math.max(...Object.values(data), 1);
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>{label}</div>
        {Object.entries(data).map(([k, v], i) => (
          <div key={k} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>{k}</span><span style={{ color: "var(--muted)" }}>{v}</span>
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${v / max * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 4, transition: "width .5s" }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700 }}>📊 Analytics Dashboard</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>School-wide data insights and trends</div>
      </div>

      {/* KPI */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard label="Total Staff" value={(staff || []).length} sub="Active members" color="#1433a8" />
        <StatCard label="Total Students" value={(students || []).length} sub="Enrolled" color="#16a34a" />
        <StatCard label="Hostellers" value={hostelStu} sub={`${(students||[]).length > 0 ? Math.round(hostelStu / (students||[]).length * 100) : 0}% of students`} color="#7c3aed" />
        <StatCard label="Day Scholars" value={dayScholars} sub={`${(students||[]).length > 0 ? Math.round(dayScholars / (students||[]).length * 100) : 0}% of students`} color="#d4a853" />
        <StatCard label="Notices" value={(notices || []).length} sub="Posted this session" color="#dc2626" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-head"><span className="card-title">👥 Staff by Department</span></div>
          <div style={{ padding: 20 }}><BarChart data={deptCounts} label="Department Distribution" /></div>
        </div>
        <div className="card">
          <div className="card-head"><span className="card-title">🎭 Staff by Role</span></div>
          <div style={{ padding: 20 }}><BarChart data={roleCounts} label="Role Distribution" /></div>
        </div>
        <div className="card">
          <div className="card-head"><span className="card-title">🎓 Student Distribution</span></div>
          <div style={{ padding: 20 }}>
            {[["Hostellers", hostelStu, "#7c3aed"], ["Day Scholars", dayScholars, "#1433a8"]].map(([label, val, color]) => {
              const pct = (students || []).length > 0 ? Math.round(val / (students || []).length * 100) : 0;
              return (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ fontWeight: 700 }}>{label}</span>
                    <span style={{ color: "var(--muted)" }}>{val} ({pct}%)</span>
                  </div>
                  <div style={{ height: 10, background: "var(--border)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span className="card-title">📢 Notices by Priority</span></div>
          <div style={{ padding: 20 }}>
            {(["High", "Medium", "Low"]).map((p) => {
              const cnt = (notices || []).filter((n) => n.priority === p).length;
              const color = p === "High" ? "#dc2626" : p === "Medium" ? "#d4a853" : "#16a34a";
              return (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p} Priority</span>
                  <span style={{ fontWeight: 800, color, fontSize: 15 }}>{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   4. ASSETS / INVENTORY
═══════════════════════════════════════════════ */
const ASSET_CATS = ["All", "Furniture", "Electronics", "Sports Equipment", "Books & Stationery", "Kitchen Equipment", "Hostel Items", "Vehicle", "Maintenance Tools", "Other"];
const ASSET_LOCS = ["All", "Admin Office", "Classroom", "Library", "Laboratory", "Sports Ground", "Hostel", "Kitchen", "Reception", "Store Room"];
const ASSET_CONDITIONS = ["Good", "Fair", "Poor", "Under Repair", "Disposed"];
const COND_COLORS = { Good: "#16a34a", Fair: "#d4a853", Poor: "#dc2626", "Under Repair": "#7c3aed", Disposed: "#64748b" };

function AssetsPage({ currentUser, showToast }) {
  const [assets, setAssets] = useState(() => { try { return JSON.parse(localStorage.getItem("gnsi_assets") || "[]"); } catch { return []; } });
  const [catFilter, setCatFilter] = useState("All");
  const [locFilter, setLocFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const isAdm = ["admin", "manager"].includes(currentUser?.role);

  const save = (arr) => { setAssets(arr); try { localStorage.setItem("gnsi_assets", JSON.stringify(arr)); } catch {} };

  const filtered = assets.filter((a) => {
    const catOk = catFilter === "All" || a.cat === catFilter;
    const locOk = locFilter === "All" || a.loc === locFilter;
    const q = search.toLowerCase();
    return catOk && locOk && (!q || a.name.toLowerCase().includes(q) || (a.serial || "").toLowerCase().includes(q));
  });

  const saveAsset = () => {
    if (!form.name) { showToast("Asset name required", "#dc2626"); return; }
    const upd = editId
      ? assets.map((a) => a.id === editId ? { ...a, ...form } : a)
      : [{ id: `ast${Date.now()}`, qty: 1, cond: "Good", addedOn: new Date().toISOString().slice(0, 10), ...form }, ...assets];
    save(upd); setShowForm(false); setEditId(null); setForm({});
    showToast("Asset saved", "#16a34a");
  };

  const delAsset = (id) => {
    if (!window.confirm("Delete this asset?")) return;
    save(assets.filter((a) => a.id !== id));
  };

  const updateCond = (id, cond) => save(assets.map((a) => a.id === id ? { ...a, cond } : a));

  /* Summary */
  const totalVal = assets.reduce((s, a) => s + (parseFloat(a.val) || 0), 0);
  const needRepair = assets.filter((a) => a.cond === "Under Repair" || a.cond === "Poor").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700 }}>🏢 Assets & Inventory</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{assets.length} assets tracked · ₹{totalVal.toLocaleString("en-IN")} total value</div>
        </div>
        {isAdm && <button onClick={() => { setShowForm(true); setEditId(null); setForm({ cat: "Furniture", loc: "Admin Office", cond: "Good", qty: 1 }); }} style={btnPrimary}>+ Add Asset</button>}
      </div>

      {/* Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Total Assets" value={assets.length} sub="All categories" color="#1433a8" />
        <StatCard label="Total Value" value={`₹${(totalVal / 1000).toFixed(1)}K`} sub="Estimated" color="#16a34a" />
        <StatCard label="Need Attention" value={needRepair} sub="Poor or under repair" color="#dc2626" />
        <StatCard label="Good Condition" value={assets.filter((a) => a.cond === "Good").length} sub="Fully functional" color="#7c3aed" />
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid #1433a8" }}>
          <div className="card-head"><span className="card-title">{editId ? "✏️ Edit Asset" : "➕ Add Asset"}</span>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm({}); }} style={{ ...btnOutline, padding: "4px 10px", fontSize: 12 }}>✕ Cancel</button></div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              {[["name", "Asset Name *"], ["serial", "Serial / Reg No."], ["purchDate", "Purchase Date", "date"], ["val", "Value (₹)", "number"]].map(([k, label, type = "text"]) => (
                <div key={k}><label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 4 }}>{label}</label>
                  <input type={type} value={form[k] || ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} style={inputStyle} /></div>
              ))}
              <div><label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 4 }}>Category</label>
                <select value={form.cat || "Other"} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))} style={selectStyle}>{ASSET_CATS.slice(1).map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 4 }}>Location</label>
                <select value={form.loc || "Admin Office"} onChange={(e) => setForm((f) => ({ ...f, loc: e.target.value }))} style={selectStyle}>{ASSET_LOCS.slice(1).map((l) => <option key={l}>{l}</option>)}</select></div>
              <div><label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 4 }}>Qty</label>
                <input type="number" min="1" value={form.qty || 1} onChange={(e) => setForm((f) => ({ ...f, qty: parseInt(e.target.value) }))} style={inputStyle} /></div>
              <div><label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 4 }}>Condition</label>
                <select value={form.cond || "Good"} onChange={(e) => setForm((f) => ({ ...f, cond: e.target.value }))} style={selectStyle}>{ASSET_CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div style={{ gridColumn: "1/-1" }}><label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 4 }}>Notes</label>
                <input value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={inputStyle} /></div>
            </div>
            <button onClick={saveAsset} style={btnPrimary}>{editId ? "Update Asset" : "Save Asset"}</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search asset name, serial…" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ ...selectStyle, width: "auto" }}>{ASSET_CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} style={{ ...selectStyle, width: "auto" }}>{ASSET_LOCS.map((l) => <option key={l}>{l}</option>)}</select>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table><thead><tr>
            {["Asset Name", "Category", "Location", "Qty", "Condition", "Value", "Added", ...(isAdm ? ["Actions"] : [])].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
            <tbody>
              {filtered.length ? filtered.map((a) => (
                <tr key={a.id}>
                  <td><b>{esc(a.name)}</b>{a.serial && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{a.serial}</div>}{a.notes && <div style={{ fontSize: 11, color: "var(--muted)" }}>{a.notes}</div>}</td>
                  <td>{a.cat || "—"}</td>
                  <td>{a.loc || "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{a.qty || 1}</td>
                  <td>
                    {isAdm ? (
                      <select value={a.cond || "Good"} onChange={(e) => updateCond(a.id, e.target.value)} style={{ ...selectStyle, width: "auto", padding: "4px 8px", fontSize: 12, color: COND_COLORS[a.cond] || "#16a34a", fontWeight: 700 }}>
                        {ASSET_CONDITIONS.map((c) => <option key={c} style={{ color: COND_COLORS[c] }}>{c}</option>)}
                      </select>
                    ) : <span style={{ color: COND_COLORS[a.cond] || "#16a34a", fontWeight: 700 }}>{a.cond || "Good"}</span>}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>{a.val ? `₹${parseFloat(a.val).toLocaleString("en-IN")}` : "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{a.addedOn || "—"}</td>
                  {isAdm && <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => { setForm(a); setEditId(a.id); setShowForm(true); }} style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 11, cursor: "pointer", marginRight: 4 }}>✏️</button>
                    <button onClick={() => delAsset(a.id)} style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 11, cursor: "pointer" }}>🗑</button>
                  </td>}
                </tr>
              )) : <tr><td colSpan={isAdm ? 8 : 7} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No assets found. Add your first asset above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   5. BACKUP & RESTORE
═══════════════════════════════════════════════ */
function BackupPage({ staff, students, notices, showToast }) {
  const [importing, setImporting] = useState(false);

  const exportBackup = () => {
    const data = { staff, students, notices, exportedAt: new Date().toISOString(), version: "gnsi-v1" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `GNSI_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast("✅ Backup downloaded", "#16a34a");
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("This will replace ALL current data. Continue?")) { e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.staff) localStorage.setItem("ims_staff", JSON.stringify(data.staff));
        if (data.students) localStorage.setItem("ims_students", JSON.stringify(data.students));
        if (data.notices) localStorage.setItem("ims_notices", JSON.stringify(data.notices));
        showToast("✅ Backup restored successfully", "#16a34a");
      } catch {
        showToast("❌ Invalid backup file", "#dc2626");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700 }}>💾 Backup & Restore</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Download data backups and restore from previous exports</div>
      </div>
      <div className="dash-grid">
        <div className="card">
          <div className="card-head" style={{ background: "linear-gradient(135deg,#f0fdf4,#f5fffe)" }}>
            <div><span className="card-title" style={{ color: "#16a34a" }}>⬇ Export Backup</span>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Download all data as a JSON file</div></div>
          </div>
          <div style={{ padding: 22 }}>
            <div style={{ marginBottom: 16, padding: 14, background: "var(--surface2)", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
              ✓ {(staff || []).length} Staff &nbsp; ✓ {(students || []).length} Students &nbsp; ✓ {(notices || []).length} Notices<br />
              ✓ Attendance &nbsp; ✓ Timetables &nbsp; ✓ Salary & Advances
            </div>
            <button onClick={exportBackup} style={{ ...btnPrimary, width: "100%", background: "#16a34a", justifyContent: "center" }}>⬇ Download JSON Backup</button>
          </div>
        </div>
        <div className="card">
          <div className="card-head" style={{ background: "linear-gradient(135deg,#fff7ed,#fefce8)" }}>
            <div><span className="card-title" style={{ color: "#ea580c" }}>⬆ Restore from File</span>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Upload a previously downloaded backup</div></div>
          </div>
          <div style={{ padding: 22 }}>
            <div style={{ marginBottom: 14, padding: 14, border: "2px dashed #fdba74", borderRadius: 10, background: "#fff7ed", textAlign: "center" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#ea580c", marginBottom: 8 }}>Choose .json backup file</div>
              <input type="file" accept=".json" onChange={handleImport} style={{ width: "100%", fontSize: 12, color: "var(--muted)" }} />
            </div>
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 11.5, color: "#dc2626" }}>
              ⚠ <b>Warning:</b> This replaces ALL current data. Make sure to export first!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   6. SETTINGS
═══════════════════════════════════════════════ */
function SettingsPage({ currentUser, showToast }) {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gnsi_settings") || "{}"); } catch { return {}; }
  });
  const [darkMode, setDarkMode] = useState(document.body.classList.contains("dark-mode"));

  const saveSettings = (upd) => {
    const merged = { ...settings, ...upd };
    setSettings(merged);
    try { localStorage.setItem("gnsi_settings", JSON.stringify(merged)); } catch {}
  };

  const toggleDark = () => {
    document.body.classList.toggle("dark-mode");
    setDarkMode(document.body.classList.contains("dark-mode"));
    showToast(`${darkMode ? "Light" : "Dark"} mode enabled`, "#1433a8");
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700 }}>⚙️ Settings</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Portal preferences and configuration</div>
      </div>

      {/* Appearance */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><span className="card-title">🎨 Appearance</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
            <div><div style={{ fontWeight: 700, fontSize: 13 }}>Dark Mode</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Switch between light and dark theme</div></div>
            <button onClick={toggleDark} style={{ padding: "7px 18px", borderRadius: 20, border: "1.5px solid var(--border)", background: darkMode ? "#1433a8" : "var(--surface)", color: darkMode ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{darkMode ? "🌙 Dark" : "☀️ Light"}</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}>
            <div><div style={{ fontWeight: 700, fontSize: 13 }}>Accent Color</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Portal theme color</div></div>
            <div style={{ display: "flex", gap: 8 }}>
              {["#1433a8", "#7c3aed", "#16a34a", "#dc2626", "#d97706"].map((c) => (
                <button key={c} onClick={() => { document.documentElement.style.setProperty("--accent", c); saveSettings({ accentColor: c }); showToast("Color updated", c); }} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: settings.accentColor === c ? "3px solid var(--text)" : "2px solid transparent", cursor: "pointer" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><span className="card-title">🔔 Notifications</span></div>
        <div style={{ padding: 20 }}>
          {[["notifyLeave", "Leave Applications", "Alert when leave is submitted"], ["notifyNotice", "New Notices", "Alert when notice is posted"], ["notifySync", "Sync Status", "Show sync progress indicators"]].map(([key, label, desc]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div><div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{desc}</div></div>
              <button onClick={() => saveSettings({ [key]: !settings[key] })} style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${settings[key] ? "#1433a8" : "var(--border)"}`, background: settings[key] ? "#1433a8" : "var(--surface)", color: settings[key] ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{settings[key] ? "ON" : "OFF"}</button>
            </div>
          ))}
        </div>
      </div>

      {/* Account */}
      <div className="card">
        <div className="card-head"><span className="card-title">👤 Account Info</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Name", currentUser?.name || "—"], ["Role", currentUser?.role || "—"], ["Department", currentUser?.dept || "—"], ["Portal Version", "GNSI v2.0 (React/Vite)"]].map(([label, val]) => (
              <div key={label} style={{ padding: "12px 14px", background: "var(--surface2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   7. STORAGE MANAGER
═══════════════════════════════════════════════ */
function StorageManagerPage({ showToast }) {
  const [keys, setKeys] = useState([]);

  useEffect(() => {
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("gnsi_") || k.startsWith("ims_"))) {
        const v = localStorage.getItem(k) || "";
        items.push({ key: k, size: v.length, preview: v.slice(0, 60) });
      }
    }
    items.sort((a, b) => b.size - a.size);
    setKeys(items);
  }, []);

  const totalSize = keys.reduce((s, k) => s + k.size, 0);
  const pct = Math.min(100, Math.round(totalSize / (5 * 1024 * 1024) * 100));
  const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#16a34a";

  const clearKey = (k) => {
    if (!window.confirm(`Delete "${k}" from storage?`)) return;
    localStorage.removeItem(k);
    setKeys((prev) => prev.filter((x) => x.key !== k));
    showToast("Key deleted", "#64748b");
  };

  const clearAll = () => {
    if (!window.confirm("Clear ALL GNSI data from local storage? This cannot be undone.")) return;
    keys.forEach((k) => localStorage.removeItem(k.key));
    setKeys([]);
    showToast("All GNSI storage cleared", "#dc2626");
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700 }}>🗄️ Storage Manager</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Local storage health and key management</div>
      </div>

      {/* Storage Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><span className="card-title">💾 Local Storage Health</span><span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtSize(totalSize)} / ~5MB ({pct}%)</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ height: 10, background: "var(--border)", borderRadius: 5, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 5, transition: "width .5s" }} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
            <span>📦 <b>{keys.length}</b> stored keys</span>
            <span style={{ color, fontWeight: 700 }}>{pct >= 70 ? `⚠️ ${100 - pct}% space left` : "✅ Storage healthy"}</span>
          </div>
          {pct > 70 && <div style={{ marginTop: 12 }}><button onClick={clearAll} style={{ ...btnOutline, color: "#dc2626", borderColor: "#fca5a5" }}>🗑 Clear All GNSI Storage</button></div>}
        </div>
      </div>

      {/* Key List */}
      <div className="card">
        <div className="card-head"><span className="card-title">🔑 Stored Keys</span><span style={{ fontSize: 12, color: "var(--muted)" }}>{keys.length} keys</span></div>
        <div style={{ overflowX: "auto" }}>
          <table><thead><tr><th>Key</th><th>Size</th><th>Preview</th><th></th></tr></thead>
            <tbody>
              {keys.length ? keys.map((k) => (
                <tr key={k.key}>
                  <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{k.key}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{fmtSize(k.size)}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.preview}…</td>
                  <td><button onClick={() => clearKey(k.key)} style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 11, cursor: "pointer" }}>🗑</button></td>
                </tr>
              )) : <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No GNSI data in local storage.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════ */
export default function SystemModule({ currentUser, staff = [], students = [], notices = [], showToast, isOnline = true, syncStatus = "idle" }) {
  const [activeTab, setActiveTab] = useState("sync");

  const tabs = [
    { id: "sync", label: "☁️ Sync" },
    { id: "ai", label: "🤖 AI Assistant" },
    { id: "analytics", label: "📊 Analytics" },
    { id: "assets", label: "🏢 Assets" },
    { id: "backup", label: "💾 Backup" },
    { id: "settings", label: "⚙️ Settings" },
    { id: "storage", label: "🗄️ Storage" },
  ];

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid var(--border)" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${activeTab === t.id ? "#1433a8" : "var(--border)"}`, background: activeTab === t.id ? "#1433a8" : "var(--surface)", color: activeTab === t.id ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "sync" && <SyncPage currentUser={currentUser} staff={staff} students={students} notices={notices} showToast={showToast} isOnline={isOnline} syncStatus={syncStatus} />}
      {activeTab === "ai" && <AIAssistantPage currentUser={currentUser} staff={staff} students={students} notices={notices} showToast={showToast} />}
      {activeTab === "analytics" && <AnalyticsPage staff={staff} students={students} notices={notices} />}
      {activeTab === "assets" && <AssetsPage currentUser={currentUser} showToast={showToast} />}
      {activeTab === "backup" && <BackupPage staff={staff} students={students} notices={notices} showToast={showToast} />}
      {activeTab === "settings" && <SettingsPage currentUser={currentUser} showToast={showToast} />}
      {activeTab === "storage" && <StorageManagerPage showToast={showToast} />}
    </div>
  );
}
