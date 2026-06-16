// ============================================================
//  WebsiteTab.jsx — GNSI Public Website Manager
//  Drop into AdminPage.jsx as a new tab
//
//  Manages:
//  • Gallery images  (website_gallery table)
//  • Public notices  (notices table — existing)
//  • Site stats      (website_settings table, key-value)
//  • Founder message (website_settings table)
//  • Faculty cards   (website_faculty table)
//  • Enquiries inbox (enquiries table — read-only)
//  • Social links    (website_settings table)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from './supabase'

// ── shared colours matching GNSI portal design system ──────
const C = {
  navy:   "#0B1F3A",
  navy2:  "#0F2A4E",
  navy3:  "#153561",
  gold:   "#B8922A",
  goldL:  "#D4AE50",
  goldLL: "#EDD180",
  cream:  "#F8F3E8",
  slate:  "#3D4F6B",
  mist:   "#7A8FA8",
  red:    "#8B1A1A",
  green:  "#1A5C2A",
};

const SUB_TABS = [
  { id: "enquiries", icon: "📬", label: "Enquiries Inbox" },
  { id: "notices",   icon: "📣", label: "Public Notices" },
  { id: "gallery",   icon: "🖼️",  label: "Gallery" },
  { id: "faculty",   icon: "👨‍🏫", label: "Faculty Cards" },
  { id: "settings",  icon: "⚙️",  label: "Site Settings" },
];

// ── helpers ─────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const toast = (msg, type = "success") => {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:.75rem 1.2rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.85rem;letter-spacing:.06em;border-left:4px solid ${type === "success" ? "#4AE382" : "#f87171"};background:${C.navy2};color:${type === "success" ? "#4AE382" : "#f87171"};box-shadow:0 4px 20px rgba(0,0,0,.4)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
};

// ── styles ──────────────────────────────────────────────────
const s = {
  wrap: { padding: "1.5rem", fontFamily: "'Source Sans 3', sans-serif", background: "#0B1F3A", minHeight: "100vh", color: "#F8F3E8" },
  subNav:  { display: "flex", gap: ".4rem", marginBottom: "1.5rem", borderBottom: `1px solid rgba(184,146,42,.15)`, paddingBottom: "1rem", flexWrap: "wrap" },
  subBtn:  (active) => ({ background: active ? C.gold : "transparent", color: active ? C.navy : "rgba(248,243,232,.5)", border: `1px solid ${active ? C.gold : "rgba(184,146,42,.2)"}`, padding: ".4rem .9rem", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".72rem", letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", transition: ".2s", display: "flex", alignItems: "center", gap: ".4rem" }),
  card:    { background: "rgba(21,53,97,.4)", border: "1px solid rgba(184,146,42,.18)", marginBottom: "1rem" },
  cardHd:  { padding: ".8rem 1.1rem", borderBottom: "1px solid rgba(184,146,42,.1)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardTit: { fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".72rem", letterSpacing: ".15em", textTransform: "uppercase", color: C.goldL },
  cardBdy: { padding: "1rem 1.1rem" },
  row:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".6rem 0", borderBottom: "1px solid rgba(184,146,42,.07)", fontSize: ".85rem" },
  label:   { display: "block", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".66rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(248,243,232,.45)", marginBottom: ".35rem" },
  input:   { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(184,146,42,.22)", color: "#F8F3E8", fontSize: ".88rem", fontFamily: "'Source Sans 3',sans-serif", outline: "none", marginBottom: "1rem", transition: ".2s" },
  textarea:{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(184,146,42,.22)", color: "#F8F3E8", fontSize: ".88rem", fontFamily: "'Source Sans 3',sans-serif", outline: "none", marginBottom: "1rem", resize: "vertical", minHeight: "90px" },
  select:  { width: "100%", padding: "10px 14px", background: C.navy2, border: "1px solid rgba(184,146,42,.22)", color: "#F8F3E8", fontSize: ".88rem", fontFamily: "'Source Sans 3',sans-serif", outline: "none", marginBottom: "1rem" },
  btnGold: { background: C.gold, color: C.navy, border: "none", padding: ".55rem 1.2rem", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".75rem", letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", transition: ".2s" },
  btnRed:  { background: "rgba(139,26,26,.4)", color: "#f87171", border: "1px solid rgba(139,26,26,.4)", padding: ".4rem .8rem", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer" },
  btnGrn:  { background: "rgba(26,92,42,.4)", color: "#4AE382", border: "1px solid rgba(26,92,42,.4)", padding: ".4rem .8rem", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer" },
  grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  grid3:   { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".8rem" },
  badge:   (c) => ({ display: "inline-block", padding: ".18rem .55rem", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".6rem", letterSpacing: ".1em", textTransform: "uppercase", background: c === "High" ? "rgba(139,26,26,.3)" : c === "Low" ? "rgba(61,79,107,.3)" : "rgba(184,146,42,.2)", color: c === "High" ? "#f87171" : c === "Low" ? C.mist : C.goldLL, border: `1px solid ${c === "High" ? "rgba(139,26,26,.4)" : c === "Low" ? "rgba(61,79,107,.4)" : "rgba(184,146,42,.3)"}` }),
  loading: { display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", gap: ".6rem", color: "rgba(248,243,232,.28)", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".1em", textTransform: "uppercase", fontSize: ".78rem" },
  empty:   { textAlign: "center", padding: "2.5rem", color: "rgba(248,243,232,.25)", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".1em", textTransform: "uppercase", fontSize: ".75rem" },
  divider: { borderBottom: "1px solid rgba(184,146,42,.1)", margin: "1rem 0" },
  stat:    { background: "rgba(11,31,58,.5)", padding: "1rem", textAlign: "center" },
  statNum: { display: "block", fontFamily: "'EB Garamond',serif", fontSize: "1.8rem", color: C.goldLL, lineHeight: 1, marginBottom: ".2rem" },
  statLbl: { fontSize: ".62rem", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(248,243,232,.3)" },
};

// ════════════════════════════════════════════════════════════
//  ENQUIRIES INBOX
// ════════════════════════════════════════════════════════════
function EnquiriesSection() {
  const [rows, setRows]   = useState([]);
  const [load, setLoad]   = useState(true);
  const [open, setOpen]   = useState(null);
  const [search, setSrch] = useState("");
  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, unread: 0 });

  const load_ = useCallback(async () => {
    setLoad(true);
    const { data } = await supabase.from("enquiries").select("*").order("created_at", { ascending: false });
    if (data) {
      setRows(data);
      const now   = new Date();
      const today = now.toISOString().slice(0, 10);
      const week  = new Date(now - 7 * 86400000).toISOString();
      setStats({
        total:  data.length,
        today:  data.filter(r => r.created_at?.slice(0, 10) === today).length,
        week:   data.filter(r => r.created_at > week).length,
        unread: data.filter(r => !r.replied).length,
      });
    }
    setLoad(false);
  }, []);

  useEffect(() => { load_(); }, [load_]);

  const markReplied = async (id) => {
    await supabase.from("enquiries").update({ replied: true, replied_at: new Date().toISOString() }).eq("id", id);
    toast("Marked as replied");
    load_();
    setOpen(null);
  };

  const deleteEnq = async (id) => {
    if (!confirm("Delete this enquiry?")) return;
    await supabase.from("enquiries").delete().eq("id", id);
    toast("Deleted");
    load_();
    setOpen(null);
  };

  const filtered = rows.filter(r =>
    !search || [r.student_name, r.parent_name, r.phone, r.course].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Stats */}
      <div style={{ ...s.grid3, gridTemplateColumns: "repeat(4,1fr)", marginBottom: "1.2rem" }}>
        {[["Total", stats.total, C.goldLL], ["Today", stats.today, "#4AE382"], ["This Week", stats.week, C.goldL], ["Unread", stats.unread, "#f87171"]].map(([l, v, c]) => (
          <div key={l} style={s.stat}><strong style={{ ...s.statNum, color: c }}>{v}</strong><span style={s.statLbl}>{l}</span></div>
        ))}
      </div>

      {/* Search */}
      <input style={{ ...s.input, marginBottom: "1rem" }} placeholder="Search by name, phone, course…" value={search} onChange={e => setSrch(e.target.value)} />

      {load ? (
        <div style={s.loading}><div className="spin" />Loading enquiries…</div>
      ) : !filtered.length ? (
        <div style={s.empty}>No enquiries found</div>
      ) : (
        <div style={s.card}>
          <div style={s.cardHd}><span style={s.cardTit}>Enquiries ({filtered.length})</span><span style={{ color: "rgba(248,243,232,.3)", fontSize: ".72rem", fontFamily: "'Rajdhani',sans-serif" }}>Click a row to view details</span></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".83rem" }}>
              <thead>
                <tr>
                  {["Date", "Student", "Parent", "Phone", "Course", "Status", ""].map(h => (
                    <th key={h} style={{ background: "rgba(11,31,58,.6)", padding: ".6rem .9rem", textAlign: "left", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".64rem", letterSpacing: ".12em", textTransform: "uppercase", color: C.goldL, borderBottom: "1px solid rgba(184,146,42,.12)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setOpen(r)}>
                    <td style={{ padding: ".6rem .9rem", borderBottom: "1px solid rgba(184,146,42,.06)", color: "rgba(248,243,232,.45)", fontSize: ".75rem", fontFamily: "'Rajdhani',sans-serif", whiteSpace: "nowrap" }}>{fmt(r.created_at)}</td>
                    <td style={{ padding: ".6rem .9rem", borderBottom: "1px solid rgba(184,146,42,.06)", color: "rgba(248,243,232,.82)" }}>{r.student_name || "—"}</td>
                    <td style={{ padding: ".6rem .9rem", borderBottom: "1px solid rgba(184,146,42,.06)", color: "rgba(248,243,232,.55)" }}>{r.parent_name || "—"}</td>
                    <td style={{ padding: ".6rem .9rem", borderBottom: "1px solid rgba(184,146,42,.06)", color: C.goldL }}><a href={`tel:${r.phone}`} style={{ color: C.goldL }} onClick={e => e.stopPropagation()}>{r.phone || "—"}</a></td>
                    <td style={{ padding: ".6rem .9rem", borderBottom: "1px solid rgba(184,146,42,.06)", color: "rgba(248,243,232,.6)", fontSize: ".78rem" }}>{r.course || "—"}</td>
                    <td style={{ padding: ".6rem .9rem", borderBottom: "1px solid rgba(184,146,42,.06)" }}>
                      <span style={{ ...s.badge(r.replied ? "Low" : "High"), fontSize: ".58rem" }}>{r.replied ? "Replied" : "New"}</span>
                    </td>
                    <td style={{ padding: ".6rem .9rem", borderBottom: "1px solid rgba(184,146,42,.06)" }}>
                      <a href={`https://wa.me/${(r.phone || "").replace(/\D/g, "")}?text=Hello%20${encodeURIComponent(r.parent_name || "")}%2C%20thank%20you%20for%20enquiring%20about%20GNSI.%20Regarding%20${encodeURIComponent(r.student_name || "your%20child")}%E2%80%99s%20admission%20enquiry%20for%20${encodeURIComponent(r.course || "our%20course")}%2C%20we%20would%20like%20to%20discuss%20further.%20Please%20call%20us%20at%20%2B91%2089742%2098074%20or%20visit%20our%20campus%20at%20Khangabok%2C%20Thoubal%2C%20Manipur.`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ ...s.btnGrn, fontSize: ".62rem", padding: ".3rem .6rem", textDecoration: "none", display: "inline-block" }}>WA Reply</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,.92)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setOpen(null)}>
          <div style={{ background: C.navy2, border: `1px solid rgba(184,146,42,.3)`, padding: "1.8rem", width: "100%", maxWidth: "500px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
              <h3 style={{ fontFamily: "'EB Garamond',serif", color: "#F8F3E8", fontSize: "1.3rem" }}>Enquiry Details</h3>
              <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: "rgba(248,243,232,.4)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>
            {[["Student Name", open.student_name], ["Parent / Guardian", open.parent_name], ["Phone", open.phone], ["Class / Age", open.class_grade], ["Course Interested", open.course], ["Submitted", fmt(open.created_at)]].map(([l, v]) => (
              <div key={l} style={s.row}>
                <span style={{ color: "rgba(248,243,232,.38)", fontFamily: "'Rajdhani',sans-serif", fontSize: ".72rem", letterSpacing: ".08em", textTransform: "uppercase" }}>{l}</span>
                <strong style={{ color: "#F8F3E8", fontSize: ".85rem" }}>{v || "—"}</strong>
              </div>
            ))}
            {open.message && (
              <div style={{ marginTop: "1rem", padding: ".9rem", background: "rgba(11,31,58,.5)", border: "1px solid rgba(184,146,42,.12)" }}>
                <div style={{ ...s.label, marginBottom: ".5rem" }}>Message</div>
                <p style={{ color: "rgba(248,243,232,.65)", fontSize: ".85rem", lineHeight: 1.7 }}>{open.message}</p>
              </div>
            )}
            <div style={{ display: "flex", gap: ".7rem", marginTop: "1.3rem", flexWrap: "wrap" }}>
              <a href={`https://wa.me/${(open.phone || "").replace(/\D/g, "")}?text=Hello%20${encodeURIComponent(open.parent_name || "")}%2C%20this%20is%20GNSI%20Khangabok.%20We%20received%20your%20enquiry%20for%20${encodeURIComponent(open.student_name || "your%20child")}.%20Please%20contact%20us%20at%20%2B91%2089742%2098074%20or%20visit%20our%20campus.`} target="_blank" rel="noopener noreferrer" style={{ ...s.btnGrn, textDecoration: "none", display: "inline-block" }}>📱 Reply on WhatsApp</a>
              <a href={`tel:${open.phone}`} style={{ ...s.btnGold, textDecoration: "none", display: "inline-block" }}>📞 Call</a>
              {!open.replied && <button style={s.btnGrn} onClick={() => markReplied(open.id)}>✓ Mark Replied</button>}
              <button style={s.btnRed} onClick={() => deleteEnq(open.id)}>🗑 Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PUBLIC NOTICES MANAGER
// ════════════════════════════════════════════════════════════
function NoticesSection() {
  const [rows, setRows]   = useState([]);
  const [load, setLoad]   = useState(true);
  const [form, setForm]   = useState({ title: "", body: "", priority: "Medium", notice_date: new Date().toISOString().slice(0, 10), is_archived: false });
  const [editing, setEdit] = useState(null);
  const [saving, setSave] = useState(false);

  const load_ = useCallback(async () => {
    setLoad(true);
    const { data } = await supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(30);
    if (data) setRows(data);
    setLoad(false);
  }, []);

  useEffect(() => { load_(); }, [load_]);

  const save = async () => {
    if (!form.title || !form.body) return toast("Title and body are required", "error");
    setSave(true);
    const payload = { title: form.title, body: form.body, priority: form.priority, notice_date: form.notice_date, is_archived: false, posted_by: null };
    const { error } = editing
      ? await supabase.from("notices").update(payload).eq("id", editing)
      : await supabase.from("notices").insert(payload);
    setSave(false);
    if (error) return toast("Error: " + error.message, "error");
    toast(editing ? "Notice updated" : "Notice published to website ✓");
    setForm({ title: "", body: "", priority: "Medium", notice_date: new Date().toISOString().slice(0, 10), is_archived: false });
    setEdit(null);
    load_();
  };

  const archive = async (id, current) => {
    await supabase.from("notices").update({ is_archived: !current }).eq("id", id);
    toast(current ? "Notice restored" : "Notice archived");
    load_();
  };

  const del = async (id) => {
    if (!confirm("Delete this notice permanently?")) return;
    await supabase.from("notices").delete().eq("id", id);
    toast("Deleted");
    load_();
  };

  const startEdit = (n) => {
    setEdit(n.id);
    setForm({ title: n.title, body: n.body, priority: n.priority || "Medium", notice_date: n.notice_date || new Date().toISOString().slice(0, 10), is_archived: n.is_archived });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      {/* Compose */}
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing ? "✏️ Edit Notice" : "📝 Publish New Notice"}</span>{editing && <button style={s.btnRed} onClick={() => { setEdit(null); setForm({ title: "", body: "", priority: "Medium", notice_date: new Date().toISOString().slice(0, 10) }) }}>Cancel Edit</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Notice Title *</label>
              <input style={s.input} placeholder="e.g. Admissions Open 2026–27" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Priority</label>
                <select style={s.select} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Notice Date</label>
                <input type="date" style={s.input} value={form.notice_date} onChange={e => setForm(f => ({ ...f, notice_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <label style={s.label}>Notice Body *</label>
          <textarea style={s.textarea} placeholder="Write the full notice text here. This appears on the public website." value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} />
          <button style={{ ...s.btnGold, opacity: saving ? .6 : 1 }} onClick={save} disabled={saving}>
            {saving ? "Publishing…" : editing ? "Update Notice" : "Publish to Website →"}
          </button>
          <p style={{ color: "rgba(248,243,232,.28)", fontSize: ".72rem", fontFamily: "'Rajdhani',sans-serif", marginTop: ".5rem" }}>
            High priority notices appear with a red border on the public website. The top 3 active notices are shown on the homepage.
          </p>
        </div>
      </div>

      {/* List */}
      {load ? <div style={s.loading}><div className="spin" />Loading notices…</div> : (
        rows.map(n => (
          <div key={n.id} style={{ ...s.card, opacity: n.is_archived ? .55 : 1 }}>
            <div style={s.cardHd}>
              <div style={{ display: "flex", alignItems: "center", gap: ".7rem" }}>
                <span style={s.badge(n.priority)}>{n.priority || "Medium"}</span>
                <span style={{ color: "#F8F3E8", fontFamily: "'EB Garamond',serif", fontSize: "1rem" }}>{n.title}</span>
                {n.is_archived && <span style={{ ...s.badge("Low"), fontSize: ".55rem" }}>Archived</span>}
              </div>
              <div style={{ display: "flex", gap: ".5rem" }}>
                <button style={s.btnGold} onClick={() => startEdit(n)}>Edit</button>
                <button style={s.btnGrn} onClick={() => archive(n.id, n.is_archived)}>{n.is_archived ? "Restore" : "Archive"}</button>
                <button style={s.btnRed} onClick={() => del(n.id)}>Delete</button>
              </div>
            </div>
            <div style={{ padding: ".7rem 1.1rem" }}>
              <p style={{ color: "rgba(248,243,232,.55)", fontSize: ".83rem", lineHeight: 1.7, marginBottom: ".4rem" }}>{n.body?.slice(0, 180)}{n.body?.length > 180 ? "…" : ""}</p>
              <span style={{ color: "rgba(248,243,232,.28)", fontSize: ".68rem", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".06em", textTransform: "uppercase" }}>{fmt(n.notice_date || n.created_at)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  GALLERY MANAGER
// ════════════════════════════════════════════════════════════
function GallerySection() {
  const [rows, setRows]   = useState([]);
  const [load, setLoad]   = useState(true);
  const [form, setForm]   = useState({ image_url: "", caption: "", category: "Campus", sort_order: 0 });
  const [saving, setSave] = useState(false);
  const [uploadHint, setHint] = useState(false);

  const CATS = ["Campus", "Classroom", "Hostel", "Events", "Sports", "Alumni", "Results"];

  const load_ = useCallback(async () => {
    setLoad(true);
    const { data } = await supabase.from("website_gallery").select("*").order("sort_order").order("created_at");
    if (data) setRows(data);
    setLoad(false);
  }, []);

  useEffect(() => { load_(); }, [load_]);

  const save = async () => {
    if (!form.image_url) return toast("Image URL is required", "error");
    setSave(true);
    const { error } = await supabase.from("website_gallery").insert({ ...form, created_at: new Date().toISOString() });
    setSave(false);
    if (error) return toast("Error: " + error.message, "error");
    toast("Image added to gallery ✓");
    setForm({ image_url: "", caption: "", category: "Campus", sort_order: rows.length });
    load_();
  };

  const del = async (id) => {
    if (!confirm("Remove this image from the gallery?")) return;
    await supabase.from("website_gallery").delete().eq("id", id);
    toast("Removed");
    load_();
  };

  const updateCaption = async (id, caption) => {
    await supabase.from("website_gallery").update({ caption }).eq("id", id);
    toast("Caption updated");
    load_();
  };

  return (
    <div>
      {/* Upload hint */}
      <div style={{ ...s.card, borderColor: "rgba(184,146,42,.3)" }}>
        <div style={{ ...s.cardHd, cursor: "pointer" }} onClick={() => setHint(!uploadHint)}>
          <span style={s.cardTit}>📤 How to Upload Photos</span>
          <span style={{ color: C.goldL, fontSize: ".75rem", fontFamily: "'Rajdhani',sans-serif" }}>{uploadHint ? "Hide ▲" : "Show ▼"}</span>
        </div>
        {uploadHint && (
          <div style={{ padding: "1rem 1.1rem" }}>
            {[
              ["1", "Open Supabase Dashboard", "Go to supabase.com → your project → Storage"],
              ["2", "Create a bucket", "Click 'New Bucket' → name it gnsi-public → enable Public access"],
              ["3", "Upload your photos", "Drag and drop campus, faculty, event photos into the bucket"],
              ["4", "Copy the public URL", "Click on any uploaded file → Copy URL → paste it below"],
            ].map(([n, t, d]) => (
              <div key={n} style={{ display: "flex", gap: "1rem", marginBottom: ".8rem", alignItems: "flex-start" }}>
                <div style={{ width: "26px", height: "26px", background: C.gold, color: C.navy, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: ".75rem", flexShrink: 0 }}>{n}</div>
                <div><div style={{ color: "#F8F3E8", fontWeight: 600, fontSize: ".85rem", marginBottom: ".15rem" }}>{t}</div><div style={{ color: "rgba(248,243,232,.45)", fontSize: ".8rem" }}>{d}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add image form */}
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>➕ Add Gallery Image</span></div>
        <div style={s.cardBdy}>
          <label style={s.label}>Image URL (from Supabase Storage or any host) *</label>
          <input style={s.input} placeholder="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/photo.jpg" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
          {form.image_url && <img src={form.image_url} alt="preview" style={{ width: "100%", maxHeight: "180px", objectFit: "cover", marginBottom: "1rem", border: "1px solid rgba(184,146,42,.2)" }} onError={e => e.target.style.display = "none"} />}
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Caption</label>
              <input style={s.input} placeholder="e.g. Morning Assembly" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Category</label>
              <select style={s.select} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button style={{ ...s.btnGold, opacity: saving ? .6 : 1 }} onClick={save} disabled={saving}>{saving ? "Adding…" : "Add to Gallery →"}</button>
        </div>
      </div>

      {/* Gallery grid */}
      {load ? <div style={s.loading}><div className="spin" />Loading gallery…</div> : !rows.length ? (
        <div style={s.empty}>No gallery images yet — add your first photo above</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: ".8rem" }}>
          {rows.map(img => (
            <div key={img.id} style={{ background: "rgba(21,53,97,.4)", border: "1px solid rgba(184,146,42,.15)", overflow: "hidden" }}>
              <img src={img.image_url} alt={img.caption} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} onError={e => { e.target.style.display = "none" }} />
              <div style={{ padding: ".7rem" }}>
                <input
                  defaultValue={img.caption}
                  onBlur={e => { if (e.target.value !== img.caption) updateCaption(img.id, e.target.value) }}
                  style={{ ...s.input, marginBottom: ".5rem", fontSize: ".78rem", padding: "6px 10px" }}
                  placeholder="Caption…"
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "rgba(248,243,232,.3)", fontSize: ".62rem", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".06em", textTransform: "uppercase" }}>{img.category}</span>
                  <button style={s.btnRed} onClick={() => del(img.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  FACULTY MANAGER
// ════════════════════════════════════════════════════════════
function FacultySection() {
  const [rows, setRows]   = useState([]);
  const [load, setLoad]   = useState(true);
  const [form, setForm]   = useState({ name: "", role: "", subject: "", experience: "", photo_url: "", sort_order: 0 });
  const [editing, setEdit] = useState(null);
  const [saving, setSave] = useState(false);

  const load_ = useCallback(async () => {
    setLoad(true);
    const { data } = await supabase.from("website_faculty").select("*").order("sort_order").order("name");
    if (data) setRows(data);
    setLoad(false);
  }, []);

  useEffect(() => { load_(); }, [load_]);

  const save = async () => {
    if (!form.name || !form.role) return toast("Name and role are required", "error");
    setSave(true);
    const { error } = editing
      ? await supabase.from("website_faculty").update(form).eq("id", editing)
      : await supabase.from("website_faculty").insert(form);
    setSave(false);
    if (error) return toast("Error: " + error.message, "error");
    toast(editing ? "Faculty updated ✓" : "Faculty added ✓");
    setForm({ name: "", role: "", subject: "", experience: "", photo_url: "", sort_order: rows.length });
    setEdit(null);
    load_();
  };

  const del = async (id) => {
    if (!confirm("Remove this faculty member from the website?")) return;
    await supabase.from("website_faculty").delete().eq("id", id);
    toast("Removed");
    load_();
  };

  const startEdit = (f) => { setEdit(f.id); setForm({ name: f.name, role: f.role, subject: f.subject || "", experience: f.experience || "", photo_url: f.photo_url || "", sort_order: f.sort_order || 0 }); };

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing ? "✏️ Edit Faculty" : "➕ Add Faculty"}</span>{editing && <button style={s.btnRed} onClick={() => { setEdit(null); setForm({ name: "", role: "", subject: "", experience: "", photo_url: "", sort_order: 0 }) }}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Full Name *</label>
              <input style={s.input} placeholder="e.g. Moirangthem Himan Singh" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Designation / Role *</label>
              <input style={s.input} placeholder="e.g. Founder & Administrator" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            </div>
          </div>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Subject / Department</label>
              <input style={s.input} placeholder="e.g. Mathematics · Strategic Leadership" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Experience / Note</label>
              <input style={s.input} placeholder="e.g. 10+ Years · Est. GNSI 2016" value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} />
            </div>
          </div>
          <label style={s.label}>Photo URL (from Supabase Storage)</label>
          <input style={s.input} placeholder="https://… (leave blank for initials avatar)" value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} />
          {form.photo_url && <img src={form.photo_url} alt="preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "50%", border: `2px solid ${C.gold}`, marginBottom: "1rem" }} onError={e => e.target.style.display = "none"} />}
          <button style={{ ...s.btnGold, opacity: saving ? .6 : 1 }} onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Update Faculty" : "Add to Website →"}</button>
        </div>
      </div>

      {load ? <div style={s.loading}><div className="spin" />Loading…</div> : !rows.length ? (
        <div style={s.empty}>No faculty added yet</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: ".8rem" }}>
          {rows.map(f => (
            <div key={f.id} style={{ ...s.card, marginBottom: 0 }}>
              <div style={{ padding: "1.1rem", textAlign: "center" }}>
                {f.photo_url
                  ? <img src={f.photo_url} alt={f.name} style={{ width: "70px", height: "70px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.gold}`, margin: "0 auto .8rem" }} />
                  : <div style={{ width: "70px", height: "70px", borderRadius: "50%", background: C.navy, border: `2px solid ${C.gold}`, margin: "0 auto .8rem", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'EB Garamond',serif", fontSize: "1.5rem", color: C.goldL }}>{(f.name || "F").split(" ").map(w => w[0]).join("").slice(0, 2)}</div>
                }
                <div style={{ color: "#F8F3E8", fontFamily: "'EB Garamond',serif", fontSize: "1rem", marginBottom: ".2rem" }}>{f.name}</div>
                <div style={{ color: C.goldL, fontSize: ".72rem", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: ".2rem" }}>{f.role}</div>
                {f.subject && <div style={{ color: "rgba(248,243,232,.45)", fontSize: ".78rem", marginBottom: ".2rem" }}>{f.subject}</div>}
                {f.experience && <div style={{ color: "rgba(248,243,232,.28)", fontSize: ".68rem", fontFamily: "'Rajdhani',sans-serif" }}>{f.experience}</div>}
              </div>
              <div style={{ padding: ".6rem", borderTop: "1px solid rgba(184,146,42,.1)", display: "flex", gap: ".5rem", justifyContent: "center" }}>
                <button style={s.btnGold} onClick={() => startEdit(f)}>Edit</button>
                <button style={s.btnRed} onClick={() => del(f.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SITE SETTINGS (founder msg, stats, social, SEO)
// ════════════════════════════════════════════════════════════
function SettingsSection() {
  const [cfg, setCfg] = useState({});
  const [load, setLoad] = useState(true);
  const [saving, setSave] = useState(false);

  const KEYS = [
    { key: "founder_quote",     label: "Founder's Quote",          type: "textarea", placeholder: "Opening quote shown on the website under the founder section" },
    { key: "founder_bio",       label: "Founder's Bio (short)",    type: "textarea", placeholder: "2–3 sentences about the founder and GNSI's mission" },
    { key: "stat_students",     label: "Students Trained (stat)",  type: "text",     placeholder: "500+" },
    { key: "stat_officers",     label: "Officers Produced (stat)", type: "text",     placeholder: "200+" },
    { key: "stat_years",        label: "Years of Excellence",      type: "text",     placeholder: "10+" },
    { key: "stat_rate",         label: "Selection Rate (stat)",    type: "text",     placeholder: "95%" },
    { key: "social_facebook",   label: "Facebook URL",             type: "text",     placeholder: "https://facebook.com/gnsikhangabok" },
    { key: "social_youtube",    label: "YouTube URL",              type: "text",     placeholder: "https://youtube.com/@gnsikhangabok" },
    { key: "social_instagram",  label: "Instagram URL",            type: "text",     placeholder: "https://instagram.com/gnsikhangabok" },
    { key: "contact_phone",     label: "Contact Phone",            type: "text",     placeholder: "+91 89742 98074" },
    { key: "hero_tagline",      label: "Hero Tagline (sub-heading)",type: "text",    placeholder: "Manipur's premier residential coaching centre…" },
    { key: "admission_deadline",label: "Admission Deadline",        type: "text",    placeholder: "30 June 2026" },
  ];

  const load_ = useCallback(async () => {
    setLoad(true);
    const { data } = await supabase.from("website_settings").select("key,value");
    if (data) { const m = {}; data.forEach(r => m[r.key] = r.value); setCfg(m); }
    setLoad(false);
  }, []);

  useEffect(() => { load_(); }, [load_]);

  const saveAll = async () => {
    setSave(true);
    const upserts = Object.entries(cfg).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("website_settings").upsert(upserts, { onConflict: "key" });
    setSave(false);
    if (error) return toast("Error: " + error.message, "error");
    toast("All website settings saved ✓");
  };

  const set_ = (key, val) => setCfg(c => ({ ...c, [key]: val }));

  if (load) return <div style={s.loading}><div className="spin" />Loading settings…</div>;

  const groups = [
    { title: "Founder Section",  keys: ["founder_quote", "founder_bio"] },
    { title: "Public Stats",     keys: ["stat_students", "stat_officers", "stat_years", "stat_rate"] },
    { title: "Social Media",     keys: ["social_facebook", "social_youtube", "social_instagram"] },
    { title: "General Content",  keys: ["contact_phone", "hero_tagline", "admission_deadline"] },
  ];

  return (
    <div>
      {groups.map(g => (
        <div key={g.title} style={s.card}>
          <div style={s.cardHd}><span style={s.cardTit}>{g.title}</span></div>
          <div style={s.cardBdy}>
            <div style={g.keys.length === 4 ? s.grid2 : undefined}>
              {g.keys.map(key => {
                const kd = KEYS.find(k => k.key === key);
                return (
                  <div key={key}>
                    <label style={s.label}>{kd?.label}</label>
                    {kd?.type === "textarea"
                      ? <textarea style={s.textarea} placeholder={kd.placeholder} value={cfg[key] || ""} onChange={e => set_(key, e.target.value)} rows={3} />
                      : <input style={s.input} placeholder={kd?.placeholder} value={cfg[key] || ""} onChange={e => set_(key, e.target.value)} />
                    }
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <button style={{ ...s.btnGold, padding: ".7rem 2rem", fontSize: ".82rem", opacity: saving ? .6 : 1 }} onClick={saveAll} disabled={saving}>
        {saving ? "Saving…" : "💾 Save All Website Settings"}
      </button>

      <div style={{ marginTop: "1.5rem", padding: "1rem 1.2rem", background: "rgba(11,31,58,.4)", border: "1px solid rgba(184,146,42,.12)" }}>
        <div style={{ ...s.cardTit, marginBottom: ".7rem" }}>📋 Required Supabase Tables</div>
        <p style={{ color: "rgba(248,243,232,.45)", fontSize: ".82rem", lineHeight: 1.7, marginBottom: ".8rem" }}>Run this SQL once in your Supabase SQL Editor to create all tables needed by the Website tab:</p>
        <pre style={{ background: "rgba(0,0,0,.3)", padding: "1rem", fontSize: ".72rem", color: "#4AE382", overflowX: "auto", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{`-- Enquiries from public website form
CREATE TABLE IF NOT EXISTS enquiries (
  id           bigserial primary key,
  student_name text,
  parent_name  text,
  phone        text,
  class_grade  text,
  course       text,
  message      text,
  replied      boolean default false,
  replied_at   timestamptz,
  created_at   timestamptz default now()
);

-- Gallery images
CREATE TABLE IF NOT EXISTS website_gallery (
  id         bigserial primary key,
  image_url  text not null,
  caption    text,
  category   text default 'Campus',
  sort_order int  default 0,
  created_at timestamptz default now()
);

-- Faculty cards
CREATE TABLE IF NOT EXISTS website_faculty (
  id         bigserial primary key,
  name       text not null,
  role       text,
  subject    text,
  experience text,
  photo_url  text,
  sort_order int default 0
);

-- Site settings (key-value)
CREATE TABLE IF NOT EXISTS website_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);`}</pre>
        <button style={{ ...s.btnGold, marginTop: ".8rem", fontSize: ".72rem" }} onClick={() => { navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS enquiries (id bigserial primary key, student_name text, parent_name text, phone text, class_grade text, course text, message text, replied boolean default false, replied_at timestamptz, created_at timestamptz default now()); CREATE TABLE IF NOT EXISTS website_gallery (id bigserial primary key, image_url text not null, caption text, category text default 'Campus', sort_order int default 0, created_at timestamptz default now()); CREATE TABLE IF NOT EXISTS website_faculty (id bigserial primary key, name text not null, role text, subject text, experience text, photo_url text, sort_order int default 0); CREATE TABLE IF NOT EXISTS website_settings (key text primary key, value text, updated_at timestamptz default now());`); toast("SQL copied to clipboard ✓"); }}>📋 Copy SQL</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  MAIN WebsiteTab EXPORT
// ════════════════════════════════════════════════════════════
export default function WebsiteTab() {
  const [tab, setTab] = useState("enquiries");

  const SECTIONS = {
    enquiries: <EnquiriesSection />,
    notices:   <NoticesSection />,
    gallery:   <GallerySection />,
    faculty:   <FacultySection />,
    settings:  <SettingsSection />,
  };

  return (
    <div style={{ ...s.wrap, background: '#0B1F3A', minHeight: '100vh', margin: '-0px' }}>
      {/* Header */}
      <div style={{ marginBottom: "1.4rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(184,146,42,.15)" }}>
        <h2 style={{ fontFamily: "'EB Garamond', serif", color: "#F8F3E8", fontSize: "1.6rem", marginBottom: ".3rem" }}>🌐 Website Manager</h2>
        <p style={{ color: "rgba(248,243,232,.35)", fontFamily: "'Rajdhani',sans-serif", fontSize: ".75rem", letterSpacing: ".08em", textTransform: "uppercase" }}>Manage guidancekhangabok.in — Gallery · Notices · Faculty · Settings · Enquiries</p>
      </div>

      {/* Sub-tab nav */}
      <div style={s.subNav}>
        {SUB_TABS.map(t => (
          <button key={t.id} style={s.subBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Active section */}
      {SECTIONS[tab]}
    </div>
  );
}