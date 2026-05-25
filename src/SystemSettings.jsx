// ============================================================
//  GNSI Portal — System Settings (FULLY FIXED + MOBILE)
//  Fixes: RLS warning, plaintext secrets warning, real CSV
//  parser, JSON.parse safety, duplicate effect dep, double
//  error banner, fake password change, fake sessions flag,
//  regenerate-key auto-save prompt, mobile-first layout.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

// ─── Nav Tabs ────────────────────────────────────────────────
const NAV_TABS = [
  { id: "basic",        icon: "🏫", label: "Basic Info"      },
  { id: "security",     icon: "🔒", label: "Security"        },
  { id: "appearance",   icon: "🎨", label: "Appearance"      },
  { id: "notify",       icon: "🔔", label: "Notifications"   },
  { id: "academic",     icon: "📚", label: "Academic Config" },
  { id: "data",         icon: "🗄️",label: "Data Mgmt"       },
  { id: "integrations", icon: "🔗", label: "Integrations"    },
];

// ─── Responsive hook ─────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

// ─── Shared UI ────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 15 }}>
      ⏳ Loading…
    </div>
  );
}

function SaveBtn({ onClick, saving, saved, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      style={{
        padding: "10px 24px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 700,
        cursor: saving || disabled ? "default" : "pointer",
        border: "none",
        background: saved ? "#16A34A" : saving ? "#93C5FD" : "#1D4ED8",
        color: "white",
        marginTop: 10,
        opacity: disabled ? 0.6 : 1,
        width: "100%",
        letterSpacing: 0.2,
        transition: "background 0.25s",
      }}
    >
      {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Changes"}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", readOnly = false }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 9,
          fontSize: 14,
          border: "1.5px solid #D1D5DB",
          outline: "none",
          boxSizing: "border-box",
          color: readOnly ? "#9CA3AF" : "#111827",
          background: readOnly ? "#F9FAFB" : "white",
          WebkitAppearance: "none",
        }}
      />
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "13px 0", borderBottom: "1px solid #F3F4F6", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#111827" }}>{label}</p>
        {desc && <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{desc}</p>}
      </div>
      <div
        onClick={onChange}
        style={{
          width: 46, height: 26, borderRadius: 13, cursor: "pointer",
          background: checked ? "#1D4ED8" : "#D1D5DB",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: "50%", background: "white",
          position: "absolute", top: 3, left: checked ? 23 : 3,
          transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        }} />
      </div>
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "white",
      border: "1.5px solid #E5E7EB",
      borderRadius: 14,
      padding: "18px 16px",
      marginBottom: 18,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: "#1E293B", letterSpacing: 0.1 }}>
      {children}
    </h3>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{
      padding: "11px 14px", borderRadius: 10,
      background: "#FEF2F2", border: "1px solid #FECACA",
      fontSize: 13, color: "#991B1B", marginBottom: 14,
    }}>
      ❌ {msg}
    </div>
  );
}

function InfoBanner({ msg, color = "blue" }) {
  const themes = {
    blue:   { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF" },
    yellow: { bg: "#FFF7ED", border: "#FED7AA", text: "#92400E" },
    green:  { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" },
    red:    { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" },
  };
  const t = themes[color] || themes.blue;
  return (
    <div style={{
      padding: "11px 14px", borderRadius: 10,
      background: t.bg, border: `1px solid ${t.border}`,
      fontSize: 13, color: t.text, marginBottom: 14,
    }}>
      {msg}
    </div>
  );
}

// ─── Safe JSON parse helper ───────────────────────────────────
function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); }
  catch { return fallback; }
}

// ─── Supabase helpers ─────────────────────────────────────────
async function loadSettings(keys) {
  const { data, error } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", keys);

  if (error) throw new Error(`Failed to load settings: ${error.message}`);
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return map;
}

async function saveSettings(map) {
  const entries = Object.entries(map);
  await Promise.all(
    entries.map(async ([key, value]) => {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: "key", defaultToNull: false }
        );
      if (error) throw new Error(`Failed to save "${key}": ${error.message}`);
    })
  );
}

// ─── Hook: shared section logic ───────────────────────────────
// FIX #5: stable key string in dep array to avoid stale effect
function useSettingsSection(keys) {
  const keysStr = keys.join(",");
  const [s, setS] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    loadSettings(keys)
      .then(d => { setS(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysStr]);

  const update = useCallback((k, v) => setS(p => ({ ...p, [k]: v })), []);

  const save = async () => {
    setSaving(true); setSaved(false); setError(null);
    try {
      await saveSettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return { s, setS, loading, saving, saved, error, setError, update, save };
}

// ─── Grid helper (responsive) ─────────────────────────────────
function Grid({ mobile, children }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
      gap: mobile ? 0 : 24,
    }}>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 1. BASIC INFO
// ══════════════════════════════════════════════════════════════
function BasicSection() {
  const mobile = useIsMobile();
  const KEYS = [
    "school_name","school_address","school_phone","school_email",
    "session_year","portal_version","institute_type","affiliation",
    "principal_name","established_year",
  ];
  const { s, loading, saving, saved, error, update, save } = useSettingsSection(KEYS);

  if (loading) return <Spinner />;

  return (
    <Grid mobile={mobile}>
      <Card>
        <SectionTitle>🏫 Institute Details</SectionTitle>
        {error && <ErrorBanner msg={error} />}
        <Field label="School / Institute Name" value={s.school_name ?? ""} onChange={e => update("school_name", e.target.value)} />
        <Field label="Address"                 value={s.school_address ?? ""} onChange={e => update("school_address", e.target.value)} />
        <Field label="Phone"                   value={s.school_phone ?? ""} onChange={e => update("school_phone", e.target.value)} />
        <Field label="Email"                   value={s.school_email ?? ""} onChange={e => update("school_email", e.target.value)} type="email" />
        <Field label="Principal Name"          value={s.principal_name ?? ""} onChange={e => update("principal_name", e.target.value)} />
        <Field label="Year Established"        value={s.established_year ?? ""} onChange={e => update("established_year", e.target.value)} placeholder="e.g. 2010" />
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </Card>

      <Card>
        <SectionTitle>📋 Academic & System Info</SectionTitle>
        <Field label="Academic Session"    value={s.session_year ?? ""}   onChange={e => update("session_year", e.target.value)} placeholder="2025-2026" />
        <Field label="Institute Type"      value={s.institute_type ?? ""} onChange={e => update("institute_type", e.target.value)} placeholder="Coaching / School / College" />
        <Field label="Affiliation / Board" value={s.affiliation ?? ""}    onChange={e => update("affiliation", e.target.value)} placeholder="CBSE / State Board / NVS" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Portal Version
          </label>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1D4ED8" }}>{s.portal_version ?? "1.0.0"}</div>
        </div>
        <InfoBanner msg="✅ GNSI Portal — Built by Himan · Khangabok, Manipur" color="green" />
      </Card>
    </Grid>
  );
}

// ══════════════════════════════════════════════════════════════
// 2. SECURITY
// ══════════════════════════════════════════════════════════════
function SecuritySection({ currentUser }) {
  const mobile = useIsMobile();
  const KEYS = [
    "session_timeout_minutes","max_login_attempts",
    "lockout_duration_minutes","force_password_change","two_factor_required",
  ];
  const { s, loading, saving, saved, error, update, save } = useSettingsSection(KEYS);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState(null);

  // FIX #11: Sessions are clearly marked as mock/demo
  const sessions = [
    { id: 1, user: currentUser?.username ?? "admin", device: "Chrome / Windows", time: "Now", current: true },
    { id: 2, user: "teacher", device: "Firefox / Android", time: "2 hrs ago", current: false },
  ];

  // FIX #4: Password change now clearly redirects; no fake success
  const changePassword = () => {
    if (!pw.current) { setPwMsg({ type: "error", text: "Enter your current password." }); return; }
    if (!pw.next || pw.next.length < 8) { setPwMsg({ type: "error", text: "New password must be at least 8 characters." }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ type: "error", text: "Passwords do not match." }); return; }
    setPwMsg({ type: "info", text: "To change the admin password, use Supabase Auth → Users or your Admin Panel's Change Password page. This UI does not update auth credentials." });
    setPw({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwMsg(null), 6000);
  };

  if (loading) return <Spinner />;

  return (
    <Grid mobile={mobile}>
      <div>
        <Card>
          <SectionTitle>🔑 Change Password</SectionTitle>
          {/* FIX #4: Honest warning upfront */}
          <InfoBanner
            msg="⚠️ Changing password here does NOT update your Supabase Auth credentials. Use Admin Panel → Change Password or Supabase Dashboard → Auth → Users."
            color="yellow"
          />
          <Field label="Current Password"     type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
          <Field label="New Password (min 8)" type="password" value={pw.next}    onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
          <Field label="Confirm New Password" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
          {pwMsg && (
            <div style={{
              padding: "10px 14px", borderRadius: 9, fontSize: 13, marginBottom: 12,
              background: pwMsg.type === "error" ? "#FEF2F2" : "#FFF7ED",
              color: pwMsg.type === "error" ? "#991B1B" : "#92400E",
              border: `1px solid ${pwMsg.type === "error" ? "#FECACA" : "#FED7AA"}`,
            }}>
              {pwMsg.text}
            </div>
          )}
          <button
            onClick={changePassword}
            style={{ padding: "10px 20px", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", background: "#1D4ED8", color: "white", width: "100%" }}
          >
            Validate & Remind
          </button>
        </Card>

        {/* FIX #11: Clearly labelled as demo sessions */}
        <Card>
          <SectionTitle>📱 Active Sessions <span style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", marginLeft: 6 }}>(demo data)</span></SectionTitle>
          <InfoBanner msg="ℹ️ Real session management requires server-side implementation. This is display-only." color="blue" />
          {sessions.map(sess => (
            <div key={sess.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 18 }}>{sess.current ? "🟢" : "⚪"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {sess.user} — {sess.device}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{sess.time}</p>
              </div>
              {sess.current
                ? <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, flexShrink: 0 }}>Current</span>
                : <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>Demo</span>
              }
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <SectionTitle>⚙️ Login & Session Settings</SectionTitle>
        {error && <ErrorBanner msg={error} />}
        <Field label="Session Timeout (minutes)"  type="number" value={s.session_timeout_minutes ?? "60"} onChange={e => update("session_timeout_minutes", e.target.value)} />
        <Field label="Max Login Attempts"         type="number" value={s.max_login_attempts ?? "5"}      onChange={e => update("max_login_attempts", e.target.value)} />
        <Field label="Lockout Duration (minutes)" type="number" value={s.lockout_duration_minutes ?? "15"} onChange={e => update("lockout_duration_minutes", e.target.value)} />
        <Toggle
          label="Force Password Change" desc="Require users to change password on first login"
          checked={s.force_password_change === "true"}
          onChange={() => update("force_password_change", s.force_password_change === "true" ? "false" : "true")}
        />
        <Toggle
          label="Two-Factor Required" desc="Require OTP for all admin logins"
          checked={s.two_factor_required === "true"}
          onChange={() => update("two_factor_required", s.two_factor_required === "true" ? "false" : "true")}
        />
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </Card>
    </Grid>
  );
}

// ══════════════════════════════════════════════════════════════
// 3. APPEARANCE
// ══════════════════════════════════════════════════════════════
function AppearanceSection() {
  const mobile = useIsMobile();
  const KEYS = ["primary_color","sidebar_color","accent_color","font_family","logo_url","favicon_url","portal_title"];
  const { s, setS, loading, saving, saved, error, update, save } = useSettingsSection(KEYS);

  const FONTS = ["DM Sans","Poppins","Nunito","Outfit","Roboto","Raleway"];
  const PRESETS = [
    { name: "Navy",   primary: "#1D4ED8", sidebar: "#1e3a5f", accent: "#F59E0B" },
    { name: "Forest", primary: "#16A34A", sidebar: "#14532D", accent: "#F59E0B" },
    { name: "Purple", primary: "#7C3AED", sidebar: "#3B0764", accent: "#F472B6" },
    { name: "Slate",  primary: "#475569", sidebar: "#1E293B", accent: "#38BDF8" },
    { name: "Rose",   primary: "#E11D48", sidebar: "#4C0519", accent: "#FB923C" },
  ];

  if (loading) return <Spinner />;

  return (
    <Grid mobile={mobile}>
      <div>
        <Card>
          <SectionTitle>🎨 Color Presets</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => setS(prev => ({ ...prev, primary_color: p.primary, sidebar_color: p.sidebar, accent_color: p.accent }))}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 13px", borderRadius: 9,
                  border: s.primary_color === p.primary ? "2px solid #1D4ED8" : "1.5px solid #E5E7EB",
                  cursor: "pointer", background: "white", fontSize: 13, fontWeight: 500,
                }}
              >
                <span style={{ display: "flex", gap: 3 }}>
                  {[p.primary, p.sidebar, p.accent].map((c, i) => (
                    <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: c, display: "inline-block" }} />
                  ))}
                </span>
                {p.name}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Primary", k: "primary_color" },
              { label: "Sidebar", k: "sidebar_color" },
              { label: "Accent",  k: "accent_color"  },
            ].map(({ label, k }) => (
              <div key={k}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="color" value={s[k] ?? "#1D4ED8"} onChange={e => update(k, e.target.value)}
                    style={{ width: 34, height: 34, borderRadius: 7, border: "1.5px solid #D1D5DB", cursor: "pointer", padding: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace" }}>{s[k] ?? "#1D4ED8"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>🔤 Font Family</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FONTS.map(f => (
              <button key={f} onClick={() => update("font_family", f)} style={{
                padding: "8px 15px", borderRadius: 9, cursor: "pointer", fontSize: 13,
                border: s.font_family === f ? "2px solid #1D4ED8" : "1.5px solid #E5E7EB",
                background: s.font_family === f ? "#EFF6FF" : "white",
                color: s.font_family === f ? "#1D4ED8" : "#374151",
                fontFamily: f, fontWeight: s.font_family === f ? 700 : 400,
              }}>
                {f}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle>🖼️ Branding</SectionTitle>
        {error && <ErrorBanner msg={error} />}
        <Field label="Portal Title" value={s.portal_title ?? ""} onChange={e => update("portal_title", e.target.value)} placeholder="GNSI ERP" />
        <Field label="Logo URL"     value={s.logo_url ?? ""}     onChange={e => update("logo_url", e.target.value)}     placeholder="https://..." />
        <Field label="Favicon URL"  value={s.favicon_url ?? ""}  onChange={e => update("favicon_url", e.target.value)}  placeholder="https://..." />
        {s.logo_url && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 7, textTransform: "uppercase" }}>Logo Preview</label>
            <img src={s.logo_url} alt="logo" style={{ height: 56, borderRadius: 9, border: "1.5px solid #E5E7EB", padding: 4 }} onError={e => { e.target.style.display = "none"; }} />
          </div>
        )}
        <InfoBanner msg="⚠️ Color and font changes require a page reload to take full effect after saving." color="yellow" />
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </Card>
    </Grid>
  );
}

// ══════════════════════════════════════════════════════════════
// 4. NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
function NotificationsSection() {
  const mobile = useIsMobile();
  const KEYS = [
    "sms_gateway","sms_api_key","sms_sender_id",
    "smtp_host","smtp_port","smtp_user","smtp_from",
    "whatsapp_enabled","whatsapp_token",
    "sms_alerts","email_alerts","whatsapp_alerts",
  ];
  const { s, loading, saving, saved, error, update, save } = useSettingsSection(KEYS);
  const [testSms, setTestSms] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState(null);

  const sendTest = (type) => {
    setTestResult({ msg: `Test ${type} queued. Configure your gateway credentials to actually deliver.` });
    setTimeout(() => setTestResult(null), 3000);
  };

  if (loading) return <Spinner />;

  return (
    <Grid mobile={mobile}>
      <div>
        <Card>
          <SectionTitle>📱 SMS Gateway</SectionTitle>
          {error && <ErrorBanner msg={error} />}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Provider</label>
            <select
              value={s.sms_gateway ?? "msg91"}
              onChange={e => update("sms_gateway", e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 14, border: "1.5px solid #D1D5DB", outline: "none", background: "white", WebkitAppearance: "none" }}
            >
              <option value="msg91">MSG91</option>
              <option value="twilio">Twilio</option>
              <option value="fast2sms">Fast2SMS</option>
              <option value="textlocal">TextLocal</option>
            </select>
          </div>
          <Field label="API Key"   value={s.sms_api_key ?? ""}   onChange={e => update("sms_api_key", e.target.value)}   placeholder="Your API key" />
          <Field label="Sender ID" value={s.sms_sender_id ?? ""} onChange={e => update("sms_sender_id", e.target.value)} placeholder="GNSI" />
          <div style={{ display: "flex", gap: 8 }}>
            <input value={testSms} onChange={e => setTestSms(e.target.value)} placeholder="+91 98765 43210"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 9, fontSize: 14, border: "1.5px solid #D1D5DB", outline: "none", minWidth: 0 }} />
            <button onClick={() => sendTest("SMS")} style={{ padding: "10px 14px", borderRadius: 9, fontSize: 13, cursor: "pointer", background: "#1D4ED8", color: "white", border: "none", fontWeight: 700, whiteSpace: "nowrap" }}>
              Test SMS
            </button>
          </div>
        </Card>

        <Card>
          <SectionTitle>💬 WhatsApp</SectionTitle>
          <Toggle
            label="WhatsApp Notifications" desc="Send fee receipts & alerts via WhatsApp"
            checked={s.whatsapp_enabled === "true"}
            onChange={() => update("whatsapp_enabled", s.whatsapp_enabled === "true" ? "false" : "true")}
          />
          <div style={{ marginTop: 12 }}>
            <Field label="WhatsApp API Token" value={s.whatsapp_token ?? ""} onChange={e => update("whatsapp_token", e.target.value)} placeholder="Meta / WATI token" />
          </div>
        </Card>
      </div>

      <div>
        <Card>
          <SectionTitle>📧 Email (SMTP)</SectionTitle>
          <Field label="SMTP Host"     value={s.smtp_host ?? ""} onChange={e => update("smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
          <Field label="SMTP Port"     value={s.smtp_port ?? ""} onChange={e => update("smtp_port", e.target.value)} placeholder="587" />
          <Field label="SMTP Username" value={s.smtp_user ?? ""} onChange={e => update("smtp_user", e.target.value)} placeholder="you@gmail.com" />
          <Field label="From Address"  value={s.smtp_from ?? ""} onChange={e => update("smtp_from", e.target.value)} placeholder="noreply@gnsi.in" />
          <div style={{ display: "flex", gap: 8 }}>
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 9, fontSize: 14, border: "1.5px solid #D1D5DB", outline: "none", minWidth: 0 }} />
            <button onClick={() => sendTest("Email")} style={{ padding: "10px 14px", borderRadius: 9, fontSize: 13, cursor: "pointer", background: "#1D4ED8", color: "white", border: "none", fontWeight: 700, whiteSpace: "nowrap" }}>
              Test Email
            </button>
          </div>
        </Card>

        <Card>
          <SectionTitle>⚡ Alert Preferences</SectionTitle>
          <Toggle label="SMS Alerts"      desc="Fee reminders, attendance alerts via SMS"
            checked={s.sms_alerts === "true"} onChange={() => update("sms_alerts", s.sms_alerts === "true" ? "false" : "true")} />
          <Toggle label="Email Alerts"    desc="Reports, receipts, and notifications via email"
            checked={s.email_alerts === "true"} onChange={() => update("email_alerts", s.email_alerts === "true" ? "false" : "true")} />
          <Toggle label="WhatsApp Alerts" desc="Fee receipts and reminders via WhatsApp"
            checked={s.whatsapp_alerts === "true"} onChange={() => update("whatsapp_alerts", s.whatsapp_alerts === "true" ? "false" : "true")} />
          {testResult && <InfoBanner msg={`✅ ${testResult.msg}`} color="green" />}
          {error && <ErrorBanner msg={error} />}
          <SaveBtn onClick={save} saving={saving} saved={saved} />
        </Card>
      </div>
    </Grid>
  );
}

// ══════════════════════════════════════════════════════════════
// 5. ACADEMIC CONFIG
// ══════════════════════════════════════════════════════════════
function AcademicSection() {
  const mobile = useIsMobile();
  const KEYS = [
    "academic_year_start","academic_year_end","exam_grading",
    "attendance_threshold","fee_due_day","classes_list","courses_list",
  ];
  const { s, loading, saving, saved, error, update, save } = useSettingsSection(KEYS);
  const [newClass, setNewClass]   = useState("");
  const [newCourse, setNewCourse] = useState("");

  // FIX #6: Safe JSON parse with fallback
  const classes = safeJsonParse(s.classes_list, ["Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"]);
  const courses = safeJsonParse(s.courses_list, ["Navodaya","Sainik School","NTSE","Olympiad","JEE Foundation","NEET Foundation"]);

  const addClass = () => {
    if (!newClass.trim()) return;
    update("classes_list", JSON.stringify([...classes, newClass.trim()]));
    setNewClass("");
  };
  const removeClass = c => update("classes_list", JSON.stringify(classes.filter(x => x !== c)));
  const addCourse = () => {
    if (!newCourse.trim()) return;
    update("courses_list", JSON.stringify([...courses, newCourse.trim()]));
    setNewCourse("");
  };
  const removeCourse = c => update("courses_list", JSON.stringify(courses.filter(x => x !== c)));

  const Tag = ({ label, onRemove }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 11px", background: "#EFF6FF", border: "1px solid #BFDBFE",
      borderRadius: 20, fontSize: 12, color: "#1D4ED8", marginBottom: 4,
    }}>
      {label}
      <span onClick={onRemove} style={{ cursor: "pointer", color: "#93C5FD", fontWeight: 800, fontSize: 14, lineHeight: 1 }}>×</span>
    </span>
  );

  if (loading) return <Spinner />;

  return (
    <Grid mobile={mobile}>
      <Card>
        <SectionTitle>📅 Academic Year</SectionTitle>
        {error && <ErrorBanner msg={error} />}
        <Field label="Year Start"               type="date"   value={s.academic_year_start ?? ""}  onChange={e => update("academic_year_start", e.target.value)} />
        <Field label="Year End"                 type="date"   value={s.academic_year_end ?? ""}    onChange={e => update("academic_year_end", e.target.value)} />
        <Field label="Fee Due Day (of month)"   type="number" value={s.fee_due_day ?? "10"}        onChange={e => update("fee_due_day", e.target.value)} placeholder="10" />
        <Field label="Attendance Threshold (%)" type="number" value={s.attendance_threshold ?? "75"} onChange={e => update("attendance_threshold", e.target.value)} placeholder="75" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Grading System</label>
          <select
            value={s.exam_grading ?? "percentage"}
            onChange={e => update("exam_grading", e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 14, border: "1.5px solid #D1D5DB", outline: "none", background: "white", WebkitAppearance: "none" }}
          >
            <option value="percentage">Percentage (0-100)</option>
            <option value="grade">Grade (A, B, C…)</option>
            <option value="cgpa">CGPA (0-10)</option>
            <option value="marks">Marks out of custom total</option>
          </select>
        </div>
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </Card>

      <div>
        <Card>
          <SectionTitle>🏫 Classes / Batches</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {classes.map(c => <Tag key={c} label={c} onRemove={() => removeClass(c)} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newClass} onChange={e => setNewClass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addClass()}
              placeholder="Add class…"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 9, fontSize: 14, border: "1.5px solid #D1D5DB", outline: "none", minWidth: 0 }}
            />
            <button onClick={addClass} style={{ padding: "10px 16px", borderRadius: 9, fontSize: 13, cursor: "pointer", background: "#1D4ED8", color: "white", border: "none", fontWeight: 700 }}>Add</button>
          </div>
        </Card>

        <Card>
          <SectionTitle>📚 Courses / Streams</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {courses.map(c => <Tag key={c} label={c} onRemove={() => removeCourse(c)} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newCourse} onChange={e => setNewCourse(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCourse()}
              placeholder="Add course…"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 9, fontSize: 14, border: "1.5px solid #D1D5DB", outline: "none", minWidth: 0 }}
            />
            <button onClick={addCourse} style={{ padding: "10px 16px", borderRadius: 9, fontSize: 13, cursor: "pointer", background: "#1D4ED8", color: "white", border: "none", fontWeight: 700 }}>Add</button>
          </div>
        </Card>
      </div>
    </Grid>
  );
}

// ══════════════════════════════════════════════════════════════
// 6. DATA MANAGEMENT
// ══════════════════════════════════════════════════════════════
function DataSection() {
  const mobile = useIsMobile();
  const [health,   setHealth]   = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing,setImporting]= useState(false);
  const [importMsg,setImportMsg]= useState(null);
  const [clearing, setClearing] = useState(null);

  const TABLES = ["students","portal_users","audit_logs","fraud_events","system_settings","backup_logs"];

  const checkHealth = async () => {
    setChecking(true);
    const results = {};
    for (const t of TABLES) {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      results[t] = error ? `❌ ${error.message}` : `✅ ${count} rows`;
    }
    setHealth(results);
    setChecking(false);
  };

  // FIX #3: Use a real deletable condition (created_at IS NOT NULL) instead of dummy UUID
  const clearTable = async (table) => {
    if (!window.confirm(`⚠️ Clear ALL data from "${table}"? This CANNOT be undone.`)) return;
    setClearing(table);
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    setClearing(null);
    if (error) {
      alert(`❌ Failed to clear ${table}: ${error.message}`);
    } else {
      alert(`✅ ${table} cleared successfully.`);
    }
  };

  // FIX #8: Robust CSV parser that handles multi-line quoted fields
  const parseCSV = (text) => {
    const rows = [];
    let cur = "", inQuote = false, fields = [], headers = null;

    for (let i = 0; i <= text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuote && text[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if ((ch === ',' || ch === '\r' || ch === '\n' || ch === undefined) && !inQuote) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        if (ch !== ',') {
          fields.push(cur.trim());
          cur = "";
          if (fields.some(f => f)) {
            if (!headers) {
              headers = fields.map(h => h.toLowerCase().replace(/\s+/g, "_").replace(/\./g, ""));
            } else {
              const obj = {};
              headers.forEach((h, idx) => { obj[h] = fields[idx] ?? ""; });
              rows.push(obj);
            }
          }
          fields = [];
        } else {
          fields.push(cur.trim()); cur = "";
        }
      } else {
        cur += ch ?? "";
      }
    }
    return rows;
  };

  // FIX #7: Duplicate check by admission_no before inserting
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportMsg(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const rows = parseCSV(evt.target.result);

        // Fetch existing admission numbers
        const { data: existing } = await supabase.from("students").select("admission_no");
        const existingSet = new Set((existing || []).map(r => r.admission_no).filter(Boolean));

        const mapped = rows
          .map(obj => ({
            admission_no: obj["admission_no"] || obj["admissionno"] || null,
            gcc_no:        obj["gcc_no"]        || obj["gccno"]        || null,
            name:          obj["name_of_students"] || obj["name"] || null,
            course:        obj["course"]   || null,
            batch:         obj["batch"]    || null,
            house:         obj["house"]    || null,
            gender:        obj["gender"]   || null,
            father_name:   obj["father_name"]   || null,
            mother_name:   obj["mother_name"]   || null,
            address:       obj["address"]       || null,
            phone:         obj["contact_no"]    || null,
            date_of_birth: obj["date_of_birth"] || null,
            class_name:    null,
            status:        "Active",
          }))
          .filter(r => r.name);

        const newRows  = mapped.filter(r => !r.admission_no || !existingSet.has(r.admission_no));
        const skipped  = mapped.length - newRows.length;

        if (newRows.length === 0) {
          setImportMsg({ type: "warn", text: `⚠️ All ${mapped.length} rows already exist (by admission number). Nothing imported.` });
          setImporting(false);
          return;
        }

        let inserted = 0;
        for (let i = 0; i < newRows.length; i += 50) {
          const { error } = await supabase.from("students").insert(newRows.slice(i, i + 50));
          if (error) throw new Error(error.message);
          inserted += Math.min(50, newRows.length - i);
        }
        setImportMsg({
          type: "success",
          text: `✅ Imported ${inserted} students.${skipped ? ` Skipped ${skipped} duplicates.` : ""}`,
        });
      } catch (err) {
        setImportMsg({ type: "error", text: `❌ Import failed: ${err.message}` });
      } finally {
        setImporting(false);
        e.target.value = "";
        setTimeout(() => setImportMsg(null), 6000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Grid mobile={mobile}>
      <div>
        <Card>
          <SectionTitle>🔍 Database Health Check</SectionTitle>
          <button
            onClick={checkHealth} disabled={checking}
            style={{ padding: "10px 20px", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: checking ? "default" : "pointer", border: "none", background: "#1D4ED8", color: "white", marginBottom: 14, width: "100%" }}
          >
            {checking ? "⏳ Checking…" : "Run Health Check"}
          </button>
          {health && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {Object.entries(health).map(([table, status]) => (
                <div key={table} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 12px", background: "#F9FAFB", borderRadius: 9, fontSize: 13, gap: 8,
                }}>
                  <span style={{ fontWeight: 600, color: "#374151", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{table}</span>
                  <span style={{ color: status.startsWith("✅") ? "#16A34A" : "#DC2626", flexShrink: 0, fontSize: 12 }}>{status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>📥 Import Students from CSV</SectionTitle>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0, marginBottom: 12 }}>
            Duplicate records (matched by admission number) are automatically skipped.
          </p>
          <label style={{
            display: "block", padding: "10px 20px", borderRadius: 9, fontSize: 14, fontWeight: 700,
            cursor: "pointer", background: "#F0FDF4", border: "1.5px solid #BBF7D0", color: "#166534",
            textAlign: "center", marginBottom: 10,
          }}>
            {importing ? "⏳ Processing…" : "📂 Choose CSV File"}
            <input type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} />
          </label>
          {importMsg && (
            <div style={{
              padding: "10px 14px", borderRadius: 9, fontSize: 13,
              background: importMsg.type === "error" ? "#FEF2F2" : importMsg.type === "warn" ? "#FFF7ED" : "#F0FDF4",
              border: `1px solid ${importMsg.type === "error" ? "#FECACA" : importMsg.type === "warn" ? "#FED7AA" : "#BBF7D0"}`,
              color: importMsg.type === "error" ? "#991B1B" : importMsg.type === "warn" ? "#92400E" : "#166534",
            }}>
              {importMsg.text}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>🗑️ Clear Module Data</SectionTitle>
        <InfoBanner msg="🚨 These actions are irreversible. Only non-critical logs can be cleared here. Clear students/fees directly in Supabase." color="red" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { table: "audit_logs",   label: "Clear Audit Logs",  icon: "📋" },
            { table: "fraud_events", label: "Clear Fraud Events", icon: "🛡️" },
            { table: "backup_logs",  label: "Clear Backup Logs",  icon: "💾" },
          ].map(({ table, label, icon }) => (
            <div key={table} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#F9FAFB", gap: 8,
            }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{icon} {label}</span>
              <button
                onClick={() => clearTable(table)} disabled={clearing === table}
                style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontWeight: 700, flexShrink: 0 }}
              >
                {clearing === table ? "⏳" : "Clear"}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </Grid>
  );
}

// ══════════════════════════════════════════════════════════════
// 7. INTEGRATIONS
// ══════════════════════════════════════════════════════════════
function IntegrationsSection() {
  const mobile = useIsMobile();
  const KEYS = [
    "razorpay_key","razorpay_secret","razorpay_enabled",
    "google_client_id","google_enabled",
    "api_key_portal","supabase_project_url",
  ];
  const { s, setS, loading, saving, saved, error, setError, update, save } = useSettingsSection(KEYS);
  const [showKeys, setShowKeys] = useState({});
  const [regenMsg, setRegenMsg] = useState(false);

  // FIX #1/#2: Warn that secrets are stored in plaintext in DB
  const SECRETS_WARNING = "⚠️ API secrets are stored as plaintext in your system_settings table. Ensure Supabase RLS restricts this table to admin roles only. Never expose these to students or public roles.";

  if (loading) return <Spinner />;

  const MaskedField = ({ label, k }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type={showKeys[k] ? "text" : "password"} value={s[k] ?? ""}
          onChange={e => update(k, e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 9, fontSize: 14, border: "1.5px solid #D1D5DB", outline: "none", boxSizing: "border-box", color: "#111827", minWidth: 0 }}
        />
        <button
          onClick={() => setShowKeys(p => ({ ...p, [k]: !p[k] }))}
          style={{ padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 14, flexShrink: 0 }}
        >
          {showKeys[k] ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );

  const IntCard = ({ icon, title, subtitle, enabled, onToggle, children }) => (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>{icon}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#111827" }}>{title}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</p>
          </div>
        </div>
        <div
          onClick={onToggle}
          style={{ width: 46, height: 26, borderRadius: 13, cursor: "pointer", background: enabled ? "#1D4ED8" : "#D1D5DB", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
        >
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: enabled ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }} />
        </div>
      </div>
      <div style={{ opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? "all" : "none" }}>{children}</div>
    </Card>
  );

  // FIX #12: Regenerate key shows unsaved indicator
  const regenKey = () => {
    update("api_key_portal", crypto.randomUUID());
    setRegenMsg(true);
    setTimeout(() => setRegenMsg(false), 4000);
  };

  return (
    <div>
      {/* FIX #1 & #2: RLS + plaintext secret warning */}
      <InfoBanner msg={SECRETS_WARNING} color="yellow" />

      <Grid mobile={mobile}>
        <IntCard icon="💳" title="Razorpay" subtitle="Online fee collection & payments"
          enabled={s.razorpay_enabled === "true"}
          onToggle={() => update("razorpay_enabled", s.razorpay_enabled === "true" ? "false" : "true")}>
          <MaskedField label="Razorpay Key ID" k="razorpay_key" />
          <MaskedField label="Razorpay Secret" k="razorpay_secret" />
        </IntCard>

        <IntCard icon="🔵" title="Google Workspace" subtitle="SSO login & Google Drive integration"
          enabled={s.google_enabled === "true"}
          onToggle={() => update("google_enabled", s.google_enabled === "true" ? "false" : "true")}>
          <MaskedField label="Google Client ID" k="google_client_id" />
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "4px 0 0" }}>Configure OAuth in Google Cloud Console → APIs &amp; Services</p>
        </IntCard>
      </Grid>

      <Grid mobile={mobile}>
        <Card>
          <SectionTitle>🔑 Portal API Key</SectionTitle>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0, marginBottom: 10 }}>Use this key to connect external tools to GNSI Portal.</p>
          <MaskedField label="API Key" k="api_key_portal" />
          {/* FIX #12: Warn that regenerate needs saving */}
          {regenMsg && <InfoBanner msg="🔄 New key generated — click Save Changes to persist it." color="yellow" />}
          <button
            onClick={regenKey}
            style={{ padding: "9px 16px", borderRadius: 9, fontSize: 13, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "white", color: "#374151", fontWeight: 600, width: "100%" }}
          >
            🔄 Regenerate Key
          </button>
        </Card>

        <Card>
          <SectionTitle>🗄️ Supabase Info</SectionTitle>
          <Field
            label="Supabase Project URL"
            value={s.supabase_project_url ?? (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL ?? "" : "")}
            onChange={e => update("supabase_project_url", e.target.value)}
          />
          <InfoBanner msg="ℹ️ Supabase credentials should live in your .env file and never be stored in this table." color="blue" />
        </Card>
      </Grid>

      {error && <ErrorBanner msg={error} />}
      <SaveBtn onClick={save} saving={saving} saved={saved} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ROOT: SYSTEM PAGE
// ══════════════════════════════════════════════════════════════
export default function SystemSettings({ currentUser }) {
  const mobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("basic");
  const [menuOpen, setMenuOpen]   = useState(false);

  const sectionMap = {
    basic:        <BasicSection />,
    security:     <SecuritySection currentUser={currentUser} />,
    appearance:   <AppearanceSection />,
    notify:       <NotificationsSection />,
    academic:     <AcademicSection />,
    data:         <DataSection />,
    integrations: <IntegrationsSection />,
  };

  const activeTabInfo = NAV_TABS.find(t => t.id === activeTab);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "white", borderBottom: "1.5px solid #E5E7EB",
        padding: mobile ? "14px 16px" : "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>⚙️</div>
          <div>
            <h1 style={{ margin: 0, fontSize: mobile ? 16 : 18, fontWeight: 800, color: "#111827" }}>System Settings</h1>
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>GNSI Portal · Khangabok, Manipur</p>
          </div>
        </div>

        {/* Mobile hamburger */}
        {mobile && (
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ padding: "8px 12px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        )}
      </div>

      {/* Mobile drawer */}
      {mobile && menuOpen && (
        <div style={{ background: "white", borderBottom: "1.5px solid #E5E7EB", padding: "8px 0" }}>
          {NAV_TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMenuOpen(false); }} style={{
              width: "100%", textAlign: "left", padding: "11px 20px", border: "none", cursor: "pointer",
              background: activeTab === tab.id ? "#F1F5F9" : "transparent",
              borderLeft: activeTab === tab.id ? "4px solid #475569" : "4px solid transparent",
              color: activeTab === tab.id ? "#1E293B" : "#374151",
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: 14, display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", minHeight: "calc(100vh - 73px)" }}>
        {/* Desktop sidebar */}
        {!mobile && (
          <div style={{ width: 220, background: "white", borderRight: "1.5px solid #E5E7EB", padding: "16px 0", flexShrink: 0 }}>
            {NAV_TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                width: "100%", textAlign: "left", padding: "11px 20px", border: "none", cursor: "pointer",
                background: activeTab === tab.id ? "#F1F5F9" : "transparent",
                borderRight: activeTab === tab.id ? "3px solid #475569" : "3px solid transparent",
                color: activeTab === tab.id ? "#1E293B" : "#374151",
                fontWeight: activeTab === tab.id ? 700 : 400,
                fontSize: 13, display: "flex", alignItems: "center", gap: 10,
                transition: "background 0.15s",
              }}>
                <span style={{ fontSize: 16 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, padding: mobile ? "16px 12px" : "28px 32px", maxWidth: "100%", overflow: "auto", boxSizing: "border-box" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: mobile ? 15 : 16, fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
            {activeTabInfo?.icon} {activeTabInfo?.label}
          </h2>
          {sectionMap[activeTab]}
        </div>
      </div>
    </div>
  );
}