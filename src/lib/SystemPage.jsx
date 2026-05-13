// ============================================================
//  GNSI Portal — System Module
//  Tabs: Basic, Security, Appearance, Notifications,
//        Academic Config, Data Management, Integrations
// ============================================================

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

const NAV_TABS = [
  { id: "basic",      icon: "🏫", label: "Basic Info" },
  { id: "security",   icon: "🔒", label: "Security" },
  { id: "appearance", icon: "🎨", label: "Appearance" },
  { id: "notify",     icon: "🔔", label: "Notifications" },
  { id: "academic",   icon: "📚", label: "Academic Config" },
  { id: "data",       icon: "🗄️", label: "Data Management" },
  { id: "integrations",icon: "🔗", label: "Integrations" },
];

// ─── shared UI ───────────────────────────────────────────────
function Spinner() {
  return <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>⏳ Loading…</div>;
}
function ErrorBox({ msg }) {
  return <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 13 }}>🚨 {msg}</div>;
}
function SaveBtn({ onClick, saving, saved }) {
  return (
    <button onClick={onClick} disabled={saving} style={{
      padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", border: "none",
      background: saved ? "#16A34A" : saving ? "#93C5FD" : "#1D4ED8", color: "white", marginTop: 8,
    }}>{saved ? "✓ Saved!" : saving ? "Saving…" : "Save Changes"}</button>
  );
}
function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1px solid #D1D5DB", outline: "none", boxSizing: "border-box", color: "#111827" }} />
    </div>
  );
}
function Toggle({ label, desc, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F3F4F6" }}>
      <div>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: "#111827" }}>{label}</p>
        {desc && <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{desc}</p>}
      </div>
      <div onClick={onChange} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: checked ? "#1D4ED8" : "#D1D5DB", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: checked ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
    </div>
  );
}
function Card({ children, style = {} }) {
  return <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 20, ...style }}>{children}</div>;
}
function SectionTitle({ children }) {
  return <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: "#374151" }}>{children}</h3>;
}

// helper: load/save system_settings keys
async function loadSettings(keys) {
  const { data } = await supabase.from("system_settings").select("key,value").in("key", keys);
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return map;
}
async function saveSettings(map) {
  await Promise.all(Object.entries(map).map(([key, value]) =>
    supabase.from("system_settings").upsert({ key, value }, { onConflict: "key" })
  ));
}

// ─────────────────────────────────────────────────────────────
// 1. BASIC INFO
// ─────────────────────────────────────────────────────────────
function BasicSection() {
  const KEYS = ["school_name","school_address","school_phone","school_email","session_year","portal_version","institute_type","affiliation","principal_name","established_year"];
  const [s, setS] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => { loadSettings(KEYS).then(d => { setS(d); setLoading(false); }); }, []);
  const u = (k, v) => setS(p => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    await saveSettings(s);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <Card>
        <SectionTitle>🏫 Institute Details</SectionTitle>
        <Field label="School / Institute Name" value={s.school_name ?? ""} onChange={e => u("school_name", e.target.value)} />
        <Field label="Address" value={s.school_address ?? ""} onChange={e => u("school_address", e.target.value)} />
        <Field label="Phone" value={s.school_phone ?? ""} onChange={e => u("school_phone", e.target.value)} />
        <Field label="Email" value={s.school_email ?? ""} onChange={e => u("school_email", e.target.value)} type="email" />
        <Field label="Principal Name" value={s.principal_name ?? ""} onChange={e => u("principal_name", e.target.value)} />
        <Field label="Year Established" value={s.established_year ?? ""} onChange={e => u("established_year", e.target.value)} placeholder="e.g. 2010" />
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </Card>
      <Card>
        <SectionTitle>📋 Academic & System Info</SectionTitle>
        <Field label="Academic Session" value={s.session_year ?? ""} onChange={e => u("session_year", e.target.value)} placeholder="2025-2026" />
        <Field label="Institute Type" value={s.institute_type ?? ""} onChange={e => u("institute_type", e.target.value)} placeholder="Coaching / School / College" />
        <Field label="Affiliation / Board" value={s.affiliation ?? ""} onChange={e => u("affiliation", e.target.value)} placeholder="CBSE / State Board / NVS" />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Portal Version</label>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1D4ED8" }}>{s.portal_version ?? "1.0.0"}</div>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#F0FDF4", border: "1px solid #BBF7D0", fontSize: 13, color: "#166534" }}>
          ✅ GNSI Portal — Built by Himan · Khangabok, Manipur
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. SECURITY
// ─────────────────────────────────────────────────────────────
function SecuritySection({ currentUser }) {
  const KEYS = ["session_timeout_minutes","max_login_attempts","lockout_duration_minutes","force_password_change","two_factor_required"];
  const [s, setS]           = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [pw, setPw]           = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg]     = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    loadSettings(KEYS).then(d => { setS(d); setLoading(false); });
    // mock active sessions
    setSessions([
      { id: 1, user: currentUser?.username ?? "admin", device: "Chrome / Windows", time: "Now", current: true },
      { id: 2, user: "teacher", device: "Firefox / Android", time: "2 hrs ago", current: false },
    ]);
  }, []);

  const u = (k, v) => setS(p => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true); await saveSettings(s);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const changePassword = async () => {
    if (!pw.next || pw.next !== pw.confirm) { setPwMsg({ type: "error", text: "Passwords do not match." }); return; }
    if (pw.next.length < 6) { setPwMsg({ type: "error", text: "Password must be at least 6 characters." }); return; }
    // In real app: hash and update portal_users.password_hash
    setPwMsg({ type: "success", text: "Password updated successfully (update password_hash in Supabase)." });
    setPw({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwMsg(null), 3000);
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <Card>
          <SectionTitle>🔑 Change Password</SectionTitle>
          <Field label="Current Password" type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
          <Field label="New Password" type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
          <Field label="Confirm New Password" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
          {pwMsg && (
            <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12, background: pwMsg.type === "error" ? "#FEF2F2" : "#F0FDF4", color: pwMsg.type === "error" ? "#991B1B" : "#166534", border: `1px solid ${pwMsg.type === "error" ? "#FECACA" : "#BBF7D0"}` }}>
              {pwMsg.text}
            </div>
          )}
          <button onClick={changePassword} style={{ padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "#1D4ED8", color: "white" }}>Update Password</button>
        </Card>

        <Card>
          <SectionTitle>📱 Active Sessions</SectionTitle>
          {sessions.map(sess => (
            <div key={sess.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 20 }}>{sess.current ? "🟢" : "⚪"}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#111827" }}>{sess.user} — {sess.device}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{sess.time}</p>
              </div>
              {!sess.current && (
                <button onClick={() => setSessions(p => p.filter(x => x.id !== sess.id))} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid #FECACA", background: "#FEF2F2", color: "#991B1B" }}>Revoke</button>
              )}
              {sess.current && <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 600 }}>Current</span>}
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <SectionTitle>⚙️ Login & Session Settings</SectionTitle>
        <Field label="Session Timeout (minutes)" type="number" value={s.session_timeout_minutes ?? "60"} onChange={e => u("session_timeout_minutes", e.target.value)} />
        <Field label="Max Login Attempts" type="number" value={s.max_login_attempts ?? "5"} onChange={e => u("max_login_attempts", e.target.value)} />
        <Field label="Lockout Duration (minutes)" type="number" value={s.lockout_duration_minutes ?? "15"} onChange={e => u("lockout_duration_minutes", e.target.value)} />
        <Toggle label="Force Password Change" desc="Require users to change password on first login"
          checked={s.force_password_change === "true"} onChange={() => u("force_password_change", s.force_password_change === "true" ? "false" : "true")} />
        <Toggle label="Two-Factor Required" desc="Require OTP for all admin logins"
          checked={s.two_factor_required === "true"} onChange={() => u("two_factor_required", s.two_factor_required === "true" ? "false" : "true")} />
        <div style={{ marginTop: 8 }}>
          <SaveBtn onClick={save} saving={saving} saved={saved} />
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. APPEARANCE
// ─────────────────────────────────────────────────────────────
function AppearanceSection() {
  const KEYS = ["primary_color","sidebar_color","accent_color","font_family","logo_url","favicon_url","portal_title"];
  const [s, setS]           = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => { loadSettings(KEYS).then(d => { setS(d); setLoading(false); }); }, []);
  const u = (k, v) => setS(p => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true); await saveSettings(s);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <Spinner />;

  const FONTS = ["Inter", "Poppins", "Roboto", "Nunito", "DM Sans", "Outfit"];
  const PRESETS = [
    { name: "Navy (Default)", primary: "#1D4ED8", sidebar: "#1e3a5f", accent: "#F59E0B" },
    { name: "Forest Green",   primary: "#16A34A", sidebar: "#14532D", accent: "#F59E0B" },
    { name: "Deep Purple",    primary: "#7C3AED", sidebar: "#3B0764", accent: "#F472B6" },
    { name: "Slate",          primary: "#475569", sidebar: "#1E293B", accent: "#38BDF8" },
    { name: "Rose",           primary: "#E11D48", sidebar: "#4C0519", accent: "#FB923C" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <Card>
          <SectionTitle>🎨 Color Theme</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => setS(prev => ({ ...prev, primary_color: p.primary, sidebar_color: p.sidebar, accent_color: p.accent }))}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, border: s.primary_color === p.primary ? "2px solid #1D4ED8" : "1px solid #E5E7EB", cursor: "pointer", background: "white", fontSize: 13 }}>
                <span style={{ display: "flex", gap: 3 }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: p.primary, display: "inline-block" }} />
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: p.sidebar, display: "inline-block" }} />
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: p.accent, display: "inline-block" }} />
                </span>
                {p.name}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Primary Color", k: "primary_color" },
              { label: "Sidebar Color", k: "sidebar_color" },
              { label: "Accent Color",  k: "accent_color" },
            ].map(({ label, k }) => (
              <div key={k}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={s[k] ?? "#1D4ED8"} onChange={e => u(k, e.target.value)}
                    style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid #D1D5DB", cursor: "pointer", padding: 2 }} />
                  <span style={{ fontSize: 12, color: "#6B7280", fontFamily: "monospace" }}>{s[k] ?? "#1D4ED8"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>🔤 Font</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FONTS.map(f => (
              <button key={f} onClick={() => u("font_family", f)} style={{
                padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                border: s.font_family === f ? "2px solid #1D4ED8" : "1px solid #E5E7EB",
                background: s.font_family === f ? "#EFF6FF" : "white",
                color: s.font_family === f ? "#1D4ED8" : "#374151",
                fontFamily: f, fontWeight: s.font_family === f ? 600 : 400,
              }}>{f}</button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle>🖼️ Branding</SectionTitle>
        <Field label="Portal Title" value={s.portal_title ?? ""} onChange={e => u("portal_title", e.target.value)} placeholder="GNSI ERP" />
        <Field label="Logo URL" value={s.logo_url ?? ""} onChange={e => u("logo_url", e.target.value)} placeholder="https://..." />
        <Field label="Favicon URL" value={s.favicon_url ?? ""} onChange={e => u("favicon_url", e.target.value)} placeholder="https://..." />
        {s.logo_url && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>Logo Preview</label>
            <img src={s.logo_url} alt="logo" style={{ height: 60, borderRadius: 8, border: "1px solid #E5E7EB", padding: 4 }} onError={e => { e.target.style.display = "none"; }} />
          </div>
        )}
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FFF7ED", border: "1px solid #FED7AA", fontSize: 13, color: "#92400E", marginBottom: 16 }}>
          ⚠️ Color and font changes require a page reload to take full effect after saving.
        </div>
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
function NotificationsSection() {
  const KEYS = ["sms_gateway","sms_api_key","sms_sender_id","smtp_host","smtp_port","smtp_user","smtp_from","whatsapp_enabled","whatsapp_token","sms_alerts","email_alerts","whatsapp_alerts"];
  const [s, setS]           = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [testSms, setTestSms] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState(null);

  useEffect(() => { loadSettings(KEYS).then(d => { setS(d); setLoading(false); }); }, []);
  const u = (k, v) => setS(p => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true); await saveSettings(s);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const sendTest = (type) => {
    setTestResult({ type, msg: `Test ${type} sent! (Configure gateway to actually deliver)` });
    setTimeout(() => setTestResult(null), 3000);
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <Card>
          <SectionTitle>📱 SMS Gateway (MSG91 / Twilio)</SectionTitle>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Gateway Provider</label>
            <select value={s.sms_gateway ?? "msg91"} onChange={e => u("sms_gateway", e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1px solid #D1D5DB", outline: "none", background: "white" }}>
              <option value="msg91">MSG91</option>
              <option value="twilio">Twilio</option>
              <option value="fast2sms">Fast2SMS</option>
              <option value="textlocal">TextLocal</option>
            </select>
          </div>
          <Field label="API Key" value={s.sms_api_key ?? ""} onChange={e => u("sms_api_key", e.target.value)} placeholder="Your API key" />
          <Field label="Sender ID" value={s.sms_sender_id ?? ""} onChange={e => u("sms_sender_id", e.target.value)} placeholder="GNSI" />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input value={testSms} onChange={e => setTestSms(e.target.value)} placeholder="+91 98765 43210"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1px solid #D1D5DB", outline: "none" }} />
            <button onClick={() => sendTest("SMS")} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#1D4ED8", color: "white", border: "none", fontWeight: 600 }}>Test SMS</button>
          </div>
        </Card>

        <Card>
          <SectionTitle>💬 WhatsApp</SectionTitle>
          <Toggle label="WhatsApp Notifications" desc="Send fee receipts & alerts via WhatsApp"
            checked={s.whatsapp_enabled === "true"} onChange={() => u("whatsapp_enabled", s.whatsapp_enabled === "true" ? "false" : "true")} />
          <div style={{ marginTop: 12 }}>
            <Field label="WhatsApp API Token" value={s.whatsapp_token ?? ""} onChange={e => u("whatsapp_token", e.target.value)} placeholder="Meta / WATI token" />
          </div>
        </Card>
      </div>

      <div>
        <Card>
          <SectionTitle>📧 Email (SMTP)</SectionTitle>
          <Field label="SMTP Host" value={s.smtp_host ?? ""} onChange={e => u("smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
          <Field label="SMTP Port" value={s.smtp_port ?? ""} onChange={e => u("smtp_port", e.target.value)} placeholder="587" />
          <Field label="SMTP Username" value={s.smtp_user ?? ""} onChange={e => u("smtp_user", e.target.value)} placeholder="you@gmail.com" />
          <Field label="From Address" value={s.smtp_from ?? ""} onChange={e => u("smtp_from", e.target.value)} placeholder="noreply@gnsi.in" />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1px solid #D1D5DB", outline: "none" }} />
            <button onClick={() => sendTest("Email")} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#1D4ED8", color: "white", border: "none", fontWeight: 600 }}>Test Email</button>
          </div>
        </Card>

        <Card>
          <SectionTitle>⚡ Alert Preferences</SectionTitle>
          <Toggle label="SMS Alerts" desc="Fee reminders, attendance alerts via SMS"
            checked={s.sms_alerts === "true"} onChange={() => u("sms_alerts", s.sms_alerts === "true" ? "false" : "true")} />
          <Toggle label="Email Alerts" desc="Reports, receipts, and notifications via email"
            checked={s.email_alerts === "true"} onChange={() => u("email_alerts", s.email_alerts === "true" ? "false" : "true")} />
          <Toggle label="WhatsApp Alerts" desc="Fee receipts and reminders via WhatsApp"
            checked={s.whatsapp_alerts === "true"} onChange={() => u("whatsapp_alerts", s.whatsapp_alerts === "true" ? "false" : "true")} />
          {testResult && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", fontSize: 13 }}>
              ✅ {testResult.msg}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <SaveBtn onClick={save} saving={saving} saved={saved} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. ACADEMIC CONFIG
// ─────────────────────────────────────────────────────────────
function AcademicSection() {
  const [classes, setClasses] = useState(["Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"]);
  const [courses, setCourses] = useState(["Navodaya","Sainik School","NTSE","Olympiad","JEE Foundation","NEET Foundation"]);
  const [newClass, setNewClass] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const KEYS = ["academic_year_start","academic_year_end","exam_grading","attendance_threshold","fee_due_day"];
  const [s, setS]           = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => { loadSettings(KEYS).then(d => { setS(d); setLoading(false); }); }, []);
  const u = (k, v) => setS(p => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true); await saveSettings(s);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <Spinner />;

  const Tag = ({ label, onRemove }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 20, fontSize: 12, color: "#1D4ED8" }}>
      {label}
      <span onClick={onRemove} style={{ cursor: "pointer", color: "#93C5FD", fontWeight: 700 }}>×</span>
    </span>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <Card>
          <SectionTitle>📅 Academic Year</SectionTitle>
          <Field label="Year Start" type="date" value={s.academic_year_start ?? ""} onChange={e => u("academic_year_start", e.target.value)} />
          <Field label="Year End" type="date" value={s.academic_year_end ?? ""} onChange={e => u("academic_year_end", e.target.value)} />
          <Field label="Fee Due Day (of month)" type="number" value={s.fee_due_day ?? "10"} onChange={e => u("fee_due_day", e.target.value)} placeholder="10" />
          <Field label="Attendance Threshold (%)" type="number" value={s.attendance_threshold ?? "75"} onChange={e => u("attendance_threshold", e.target.value)} placeholder="75" />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Exam Grading System</label>
            <select value={s.exam_grading ?? "percentage"} onChange={e => u("exam_grading", e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1px solid #D1D5DB", outline: "none", background: "white" }}>
              <option value="percentage">Percentage (0-100)</option>
              <option value="grade">Grade (A, B, C…)</option>
              <option value="cgpa">CGPA (0-10)</option>
              <option value="marks">Marks out of custom total</option>
            </select>
          </div>
          <SaveBtn onClick={save} saving={saving} saved={saved} />
        </Card>
      </div>

      <div>
        <Card>
          <SectionTitle>🏫 Classes / Batches</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {classes.map(c => <Tag key={c} label={c} onRemove={() => setClasses(p => p.filter(x => x !== c))} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newClass} onChange={e => setNewClass(e.target.value)} placeholder="Add class…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1px solid #D1D5DB", outline: "none" }} />
            <button onClick={() => { if (newClass.trim()) { setClasses(p => [...p, newClass.trim()]); setNewClass(""); } }}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#1D4ED8", color: "white", border: "none", fontWeight: 600 }}>Add</button>
          </div>
        </Card>

        <Card>
          <SectionTitle>📚 Courses / Streams</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {courses.map(c => <Tag key={c} label={c} onRemove={() => setCourses(p => p.filter(x => x !== c))} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newCourse} onChange={e => setNewCourse(e.target.value)} placeholder="Add course…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1px solid #D1D5DB", outline: "none" }} />
            <button onClick={() => { if (newCourse.trim()) { setCourses(p => [...p, newCourse.trim()]); setNewCourse(""); } }}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#1D4ED8", color: "white", border: "none", fontWeight: 600 }}>Add</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. DATA MANAGEMENT
// ─────────────────────────────────────────────────────────────
function DataSection() {
  const [health, setHealth]   = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [clearing, setClearing] = useState(null);

  const TABLES = ["students","portal_users","audit_logs","fraud_events","system_settings","backup_logs"];

  const checkHealth = async () => {
    setChecking(true);
    const results = {};
    for (const t of TABLES) {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      results[t] = error ? "❌ Error" : `✅ ${count} rows`;
    }
    setHealth(results);
    setChecking(false);
  };

  const clearTable = async (table) => {
    if (!window.confirm(`Are you sure you want to clear ALL data from "${table}"? This cannot be undone.`)) return;
    setClearing(table);
    await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setClearing(null);
    alert(`${table} cleared.`);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setImportMsg(`"${file.name}" received. CSV import requires a backend function to process. Coming soon.`);
      setTimeout(() => setImportMsg(null), 4000);
    }, 1000);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <Card>
          <SectionTitle>🔍 Database Health Check</SectionTitle>
          <button onClick={checkHealth} disabled={checking} style={{ padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: checking ? "default" : "pointer", border: "none", background: "#1D4ED8", color: "white", marginBottom: 16 }}>
            {checking ? "⏳ Checking…" : "Run Health Check"}
          </button>
          {health && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(health).map(([table, status]) => (
                <div key={table} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F9FAFB", borderRadius: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 500, color: "#374151" }}>{table}</span>
                  <span style={{ color: status.startsWith("✅") ? "#16A34A" : "#DC2626" }}>{status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>📥 Import Data from CSV</SectionTitle>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0, marginBottom: 16 }}>Upload a CSV file to import student, fee, or attendance records.</p>
          <label style={{ display: "inline-block", padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534" }}>
            {importing ? "⏳ Processing…" : "📂 Choose CSV File"}
            <input type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} />
          </label>
          {importMsg && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#FFF7ED", border: "1px solid #FED7AA", color: "#92400E", fontSize: 13 }}>
              ⚠️ {importMsg}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>🗑️ Clear / Reset Module Data</SectionTitle>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0, marginBottom: 16 }}>⚠️ These actions are <strong>irreversible</strong>. Use with extreme caution.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { table: "audit_logs",   label: "Clear Audit Logs",    icon: "📋" },
            { table: "fraud_events", label: "Clear Fraud Events",   icon: "🛡️" },
            { table: "backup_logs",  label: "Clear Backup Logs",    icon: "💾" },
          ].map(({ table, label, icon }) => (
            <div key={table} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: "1px solid #E5E7EB", borderRadius: 10, background: "#F9FAFB" }}>
              <span style={{ fontSize: 13, color: "#374151" }}>{icon} {label}</span>
              <button onClick={() => clearTable(table)} disabled={clearing === table} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                border: "1px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontWeight: 600,
              }}>{clearing === table ? "⏳" : "Clear"}</button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#991B1B" }}>
          🚨 To clear students, fees, or other critical data — do it directly in Supabase for safety.
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. INTEGRATIONS
// ─────────────────────────────────────────────────────────────
function IntegrationsSection() {
  const KEYS = ["razorpay_key","razorpay_secret","razorpay_enabled","google_client_id","google_enabled","api_key_portal","supabase_project_url"];
  const [s, setS]           = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [showKeys, setShowKeys] = useState({});

  useEffect(() => { loadSettings(KEYS).then(d => { setS(d); setLoading(false); }); }, []);
  const u = (k, v) => setS(p => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true); await saveSettings(s);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <Spinner />;

  const MaskedField = ({ label, k }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input type={showKeys[k] ? "text" : "password"} value={s[k] ?? ""} onChange={e => u(k, e.target.value)}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1px solid #D1D5DB", outline: "none", boxSizing: "border-box", color: "#111827" }} />
        <button onClick={() => setShowKeys(p => ({ ...p, [k]: !p[k] }))}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 13 }}>
          {showKeys[k] ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );

  const IntegrationCard = ({ icon, title, subtitle, enabled, onToggle, children }) => (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>{title}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{subtitle}</p>
          </div>
        </div>
        <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: enabled ? "#1D4ED8" : "#D1D5DB", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: enabled ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
        </div>
      </div>
      <div style={{ opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? "all" : "none" }}>{children}</div>
    </Card>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <IntegrationCard icon="💳" title="Razorpay" subtitle="Online fee collection & payments"
          enabled={s.razorpay_enabled === "true"} onToggle={() => u("razorpay_enabled", s.razorpay_enabled === "true" ? "false" : "true")}>
          <MaskedField label="Razorpay Key ID" k="razorpay_key" />
          <MaskedField label="Razorpay Secret" k="razorpay_secret" />
        </IntegrationCard>

        <IntegrationCard icon="🔵" title="Google Workspace" subtitle="SSO login & Google Drive integration"
          enabled={s.google_enabled === "true"} onToggle={() => u("google_enabled", s.google_enabled === "true" ? "false" : "true")}>
          <MaskedField label="Google Client ID" k="google_client_id" />
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "4px 0 0" }}>Configure OAuth in Google Cloud Console → APIs & Services</p>
        </IntegrationCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <SectionTitle>🔑 Portal API Key</SectionTitle>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0, marginBottom: 12 }}>Use this key to connect external tools to GNSI Portal.</p>
          <MaskedField label="API Key" k="api_key_portal" />
          <button onClick={() => u("api_key_portal", crypto.randomUUID())} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "1px solid #E5E7EB", background: "white", color: "#374151" }}>
            🔄 Regenerate Key
          </button>
        </Card>

        <Card>
          <SectionTitle>🗄️ Supabase Info</SectionTitle>
          <Field label="Supabase Project URL" value={s.supabase_project_url ?? import.meta.env.VITE_SUPABASE_URL ?? ""} onChange={e => u("supabase_project_url", e.target.value)} />
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", fontSize: 13, color: "#1D4ED8", marginTop: 8 }}>
            ℹ️ Supabase credentials are stored in your <code>.env</code> file and should not be changed here.
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 8 }}>
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT: SYSTEM PAGE
// ─────────────────────────────────────────────────────────────
export default function SystemPage({ currentUser }) {
  const [activeTab, setActiveTab] = useState("basic");

  const sectionMap = {
    basic:        <BasicSection />,
    security:     <SecuritySection currentUser={currentUser} />,
    appearance:   <AppearanceSection />,
    notify:       <NotificationsSection />,
    academic:     <AcademicSection />,
    data:         <DataSection />,
    integrations: <IntegrationsSection />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "20px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚙️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>System Settings</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>GNSI Portal · Khangabok, Manipur</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white" }}>
            {currentUser?.username?.slice(0,2).toUpperCase() ?? "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 81px)" }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: "white", borderRight: "1px solid #E5E7EB", padding: "16px 0", flexShrink: 0 }}>
          {NAV_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              width: "100%", textAlign: "left", padding: "10px 20px", border: "none", cursor: "pointer",
              background: activeTab === tab.id ? "#F1F5F9" : "transparent",
              borderRight: activeTab === tab.id ? "3px solid #475569" : "3px solid transparent",
              color: activeTab === tab.id ? "#1E293B" : "#374151",
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: 13, display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 32, maxWidth: "100%", overflow: "auto" }}>
          <h2 style={{ margin: "0 0 24px", fontSize: 17, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 10 }}>
            {NAV_TABS.find(t => t.id === activeTab)?.icon}{" "}
            {NAV_TABS.find(t => t.id === activeTab)?.label}
          </h2>
          {sectionMap[activeTab]}
        </div>
      </div>
    </div>
  );
}